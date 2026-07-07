// Build a compact regex that matches a set of timeless-jewel seeds for the
// in-game stash search (which is regex with a small character budget). The seed
// is printed verbatim in the jewel's text (e.g. Glorious Vanity "Bathed in the
// blood of 1981 sacrificed …"), so matching the digit string finds the jewel.
//
// Compression is a classic regex trie: shared prefixes are factored out and
// single-character branches collapse into character classes, e.g.
//   [1981, 1985]        -> 198[15]
//   [121, 122, 199]     -> 1(2[12]|99)
//   [19, 1981]          -> 19(81)?

// The in-game stash/inventory search field accepts at most this many characters.
export const STASH_SEARCH_LIMIT = 50;

interface TrieNode {
  children: Map<string, TrieNode>;
  end: boolean;
}
function node(): TrieNode {
  return { children: new Map(), end: false };
}

function insert(root: TrieNode, digits: string): void {
  let cur = root;
  for (const ch of digits) {
    let next = cur.children.get(ch);
    if (!next) {
      next = node();
      cur.children.set(ch, next);
    }
    cur = next;
  }
  cur.end = true;
}

// A token is "atomic" if a trailing `?` binds to the whole thing without a group:
// a single char, a character class, or an already-parenthesised group.
function isAtomic(re: string): boolean {
  if (re.length === 1) return true;
  if (/^\[[^\]]+\]$/.test(re)) return true;
  // Fully wrapped in one balanced group, e.g. (a|b) but not (a)(b).
  if (re[0] === '(' && re[re.length - 1] === ')') {
    let depth = 0;
    for (let i = 0; i < re.length; i++) {
      if (re[i] === '(') depth++;
      else if (re[i] === ')') {
        depth--;
        if (depth === 0 && i !== re.length - 1) return false;
      }
    }
    return true;
  }
  return false;
}

function toRegex(n: TrieNode): string {
  const keys = [...n.children.keys()].sort();
  if (keys.length === 0) return '';

  const alts: string[] = [];
  const charClass: string[] = [];
  for (const k of keys) {
    const sub = toRegex(n.children.get(k)!);
    if (sub === '') charClass.push(k);
    else alts.push(k + sub);
  }
  if (charClass.length === 1) alts.push(charClass[0]);
  else if (charClass.length > 1) alts.push(`[${charClass.join('')}]`);

  let result = alts.length === 1 ? alts[0] : `(${alts.join('|')})`;

  // This node also terminates a seed → everything after it is optional.
  if (n.end) result = isAtomic(result) ? `${result}?` : `(${result})?`;
  return result;
}

// Regex matching every given seed, compressed. Duplicates are ignored; order of
// input does not matter. Returns '' for an empty input.
export function buildSeedRegex(seeds: number[]): string {
  const unique = [...new Set(seeds.map((s) => String(s)))];
  if (unique.length === 0) return '';
  const root = node();
  for (const s of unique) insert(root, s);
  return toRegex(root);
}

export interface SeedPick {
  variant: number; // conqueror index
  seed: number;
}

// Shortest substring of `name` (length >= minLen) that is not a substring of any
// other name in `all` (case-insensitive) — enough to identify the conqueror.
// minLen keeps fragments long enough that a proper-noun slice won't collide with
// the fixed connective words of the jewel's flavour text (e.g. "sacrificed …").
export function distinctFragment(name: string, all: string[], minLen = 3): string {
  const lower = name.toLowerCase();
  const others = all.filter((n) => n !== name).map((n) => n.toLowerCase());
  for (let len = Math.min(Math.max(minLen, 1), name.length); len <= name.length; len++) {
    for (let i = 0; i + len <= name.length; i++) {
      const frag = lower.slice(i, i + len);
      if (!others.some((o) => o.includes(frag))) return name.slice(i, i + len);
    }
  }
  return name;
}

// Build the full stash-search regex for a set of picked (conqueror, seed) jewels.
//
// A given seed under a different conqueror is a different jewel, so when
// `matchConqueror` is set the seed is tied to its conqueror name. The seed is
// always printed before the conqueror in the jewel's text (e.g. "… of 1981
// sacrificed in the name of Xibaqua"), so `seed.*Conqueror` matches precisely.
// Without it, seeds from every picked conqueror are merged into one short list.
export function buildStashQuery(
  picks: SeedPick[],
  conquerorNames: string[],
  matchConqueror: boolean,
): string {
  if (picks.length === 0) return '';
  if (!matchConqueror) return buildSeedRegex(picks.map((p) => p.seed));

  const byConqueror = new Map<number, number[]>();
  for (const p of picks) {
    const seeds = byConqueror.get(p.variant) ?? [];
    seeds.push(p.seed);
    byConqueror.set(p.variant, seeds);
  }
  const parts: string[] = [];
  for (const [variant, seeds] of [...byConqueror.entries()].sort((a, b) => a[0] - b[0])) {
    const seedRe = buildSeedRegex(seeds);
    const conqueror = conquerorNames[variant];
    // Shrink the conqueror to its shortest distinguishing fragment (Xibaqua → Xib).
    parts.push(conqueror ? `${seedRe}.*${distinctFragment(conqueror, conquerorNames)}` : seedRe);
  }
  return parts.length === 1 ? parts[0] : `(${parts.join('|')})`;
}
