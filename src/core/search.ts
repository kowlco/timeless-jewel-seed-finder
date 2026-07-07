import type { Aggregate, Target, SearchResult, JewelType } from './types';

// Score every aggregate against weighted targets and return the top-N ranked results.
// score = Σ weight × count(outcome). Rows missing any `required` target are dropped.
export function search(
  jewel: JewelType,
  rows: Aggregate[],
  targets: Target[],
  topN: number,
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
    const breakdown: { outcomeId: string; count: number }[] = [];
    for (const t of targets) {
      const count = row.counts[t.outcomeId];
      if (count) {
        score += t.weight * count;
        breakdown.push({ outcomeId: t.outcomeId, count });
      }
    }
    if (score <= 0) continue;

    results.push({
      jewel,
      variant: row.variant,
      seed: row.seed,
      socketId: row.socketId,
      score,
      breakdown,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}
