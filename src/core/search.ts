import type { Aggregate, Target, SearchResult, JewelType } from './types';

// Score every aggregate against weighted targets and return the top-N ranked results.
// score = Σ weight × count(outcome); matches = Σ count (unweighted). Rows missing any
// `required` target, scoring zero, or with fewer than `minMatches` total matches are
// dropped. `topN` is only a safety cap on the returned list — narrowing is done via
// `minMatches`, not an arbitrary rank limit.
export function search(
  jewel: JewelType,
  rows: Aggregate[],
  targets: Target[],
  topN: number,
  minMatches = 0,
): SearchResult[] {
  const required = targets.filter((t) => t.required);
  const results: SearchResult[] = [];

  for (const row of rows) {
    let ok = true;
    for (const t of required) {
      if (!row.counts[t.outcomeId]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    let score = 0;
    let matches = 0;
    const breakdown: { outcomeId: string; count: number }[] = [];
    for (const t of targets) {
      const count = row.counts[t.outcomeId];
      if (count) {
        score += t.weight * count;
        matches += count;
        breakdown.push({ outcomeId: t.outcomeId, count });
      }
    }
    if (score <= 0 || matches < minMatches) continue;

    results.push({
      jewel,
      variant: row.variant,
      seed: row.seed,
      socketId: row.socketId,
      score,
      matches,
      breakdown,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}
