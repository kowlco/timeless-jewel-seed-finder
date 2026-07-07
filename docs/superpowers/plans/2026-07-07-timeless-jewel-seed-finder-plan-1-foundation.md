# Timeless Jewel Seed Finder — Implementation Plan 1: Foundation & Size Gate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data-extraction pipeline and a TS port of the timeless-jewel transformation algorithm, validated byte-for-byte against the reference implementation, then precompute one jewel's shard and measure its compressed size to resolve the runtime-architecture decision gate.

**Architecture:** Node/TS build-time tools extract the passive tree (official GGG export) and the `.dat` transformation tables (self-extracted from GGPK via `pathofexile-dat`). A pure-TS `core/transform` port of the game's TinyMT32-seeded algorithm reads those tables. `tools/precompute` runs `core/transform` over one jewel's `(variant, socket, seed)` space to produce a compressed shard whose real size decides whether the offline-precompute runtime holds (spec §11).

**Tech Stack:** TypeScript (strict), Vite, Svelte, Vitest, Node LTS, `pathofexile-dat`. Reference algorithm source: `github.com/Vilsol/timeless-jewels` (MIT), fetched via `gh api`.

## Global Constraints

- TypeScript `strict: true`; all runtime `core/*` modules are pure (no DOM, no Node APIs) so they run in browser, worker, and Node test alike.
- Data language: **English only** for MVP (stat translations).
- Passive tree is **pinned by version** — every asset lives under `data/<treeVersion>/`; never fetch "latest" implicitly.
- Committed data: extracted assets and precomputed shards are committed so the site build is hermetic (no network at build).
- Correctness anchor: `core/transform` must match reference `calculator.Calculate` **byte-for-byte** on the committed golden fixtures (spec §5).
- RNG/arithmetic is unsigned-32-bit. In TS use `>>> 0` for wraparound and `Math.imul` for 32-bit multiply. Never use bare `*` on RNG state.
- Reference repo is a **development-time oracle only** — no Vilsol code or baked data ships in the site.
- Jewel scope: 6 jewel types exist in the reference (incl. `HeroicTragedy`); MVP targets the 5 classic timeless jewels but the port must not hardcode "5" — drive off the data tables.

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts   # Task 1
tools/extract/                                                    # Task 2
  extract.ts            # CLI entry: tree + dat tables → data/<ver>/
  pathofexile-dat.config.ts
  normalize.ts          # raw dat JSON → compact runtime tables
  extract.test.ts
data/<treeVersion>/     # committed output of Task 2 (tree.json, tables, manifest.json)
src/core/
  types.ts              # Task 3: jewel/variant/seed-range/outcome types + constants
  types.test.ts
  rng.ts                # Task 5: TinyMT32 port
  rng.test.ts
  transform.ts          # Task 6: Calculate + AlternateTreeManager port
  transform.test.ts
  tables.ts             # Task 6: typed loaders + data accessors ported from data/manager.go
  radius.ts             # Task 7: nodesInRadius
  radius.test.ts
tools/reference/        # Task 4: Go dumper that emits golden fixtures
  dump.go
fixtures/
  rng.json              # Task 4 output (committed)
  transform.json        # Task 4 output (committed)
tools/precompute/       # Task 8
  precompute.ts
  shard.ts              # aggregate + encode + compress
  precompute.test.ts
data/shards/<treeVersion>/   # Task 8 output (one jewel for the gate)
docs/superpowers/notes/2026-07-07-size-gate-report.md   # Task 9
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `src/main.ts`, `index.html`, `src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` (Vitest) and `npm run dev` (Vite+Svelte). Path alias `@core/*` → `src/core/*`.

- [ ] **Step 1: Write the failing test**

`src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs typescript + vitest', () => {
    const x: number = 40 + 2;
    expect(x).toBe(42);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — command/script not found (no `package.json` yet).

- [ ] **Step 3: Scaffold the project**

```bash
npm create vite@latest . -- --template svelte-ts
npm install
npm install -D vitest
```

`package.json` — ensure scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: { '@core': resolve(__dirname, 'src/core') } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
});
```

Add to `tsconfig.json` `compilerOptions`: `"strict": true`, `"paths": { "@core/*": ["src/core/*"] }`, `"baseUrl": "."`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite+svelte+ts+vitest project"
```

---

## Task 2: Data extraction pipeline (`tools/extract`)

**Files:**
- Create: `tools/extract/extract.ts`, `tools/extract/pathofexile-dat.config.ts`, `tools/extract/normalize.ts`, `tools/extract/extract.test.ts`
- Create (committed output): `data/<treeVersion>/tree.json`, `.../passive_skills.json`, `.../alternate_passive_skills.json`, `.../alternate_passive_additions.json`, `.../alternate_tree_versions.json`, `.../stats.json`, `.../stat_translations.json`, `.../manifest.json`

**Interfaces:**
- Consumes: nothing (network at extraction time only).
- Produces: on-disk JSON tables consumed by Tasks 3, 6, 7, 8. Exact shapes fixed in `normalize.ts` and asserted in the test:
  - `tree.json`: `{ version: string, constants: { orbitRadii: number[], skillsPerOrbit: number[] }, nodes: Record<string, TreeNode>, groups: Record<string, {x:number,y:number}>, jewelSlots: number[] }` where `TreeNode = { skill: number, group?: number, orbit?: number, orbitIndex?: number, isNotable?: boolean, isKeystone?: boolean, isJewelSocket?: boolean, name: string }`.
  - Each table JSON is an array of row objects keyed by the columns the algorithm needs (confirmed in Step 3 against the tool's output).
  - `manifest.json`: `{ treeVersion: string, patch: string, extractedAt: string, checksums: Record<string,string> }`.

- [ ] **Step 1: Confirm `pathofexile-dat` exposes the required tables**

Run (research spike, no code yet):
```bash
npx pathofexile-dat@latest --help
```
Then create `tools/extract/pathofexile-dat.config.ts` requesting these tables (names per the schema; adjust to the tool's actual table identifiers):
`AlternatePassiveSkills`, `AlternatePassiveAdditions`, `AlternateTreeVersions`, `PassiveSkills`, `Stats`.
Run the tool once against the current patch and inspect output. **Gate:** if any of the five tables is absent from the schema, STOP and report — this invalidates the self-extraction assumption (spec §11). Record the actual column names you see; the normalize step and test below must use those exact names.

- [ ] **Step 2: Write the failing test**

`tools/extract/extract.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(__dirname, '../../data');

function latestVersionDir(): string {
  const manifest = JSON.parse(readFileSync(resolve(DIR, 'current.json'), 'utf8'));
  return resolve(DIR, manifest.treeVersion);
}

describe('extract output', () => {
  let dir: string;
  beforeAll(() => { dir = latestVersionDir(); });

  it('produced all required tables', () => {
    for (const f of [
      'tree.json', 'passive_skills.json', 'alternate_passive_skills.json',
      'alternate_passive_additions.json', 'alternate_tree_versions.json',
      'stats.json', 'stat_translations.json', 'manifest.json',
    ]) {
      expect(existsSync(resolve(dir, f)), `${f} exists`).toBe(true);
    }
  });

  it('tree has jewel slots and orbit constants', () => {
    const tree = JSON.parse(readFileSync(resolve(dir, 'tree.json'), 'utf8'));
    expect(tree.jewelSlots.length).toBeGreaterThan(0);
    expect(tree.constants.orbitRadii.length).toBeGreaterThan(0);
    expect(tree.constants.skillsPerOrbit.length).toBeGreaterThan(0);
  });

  it('alternate_tree_versions has one row per jewel type', () => {
    const rows = JSON.parse(readFileSync(resolve(dir, 'alternate_tree_versions.json'), 'utf8'));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows[0]).toHaveProperty('MinimumAdditions');
    expect(rows[0]).toHaveProperty('MaximumAdditions');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- extract`
Expected: FAIL — `data/current.json` missing.

- [ ] **Step 4: Implement the extractor**

`tools/extract/extract.ts` — CLI parsing `--patch` and `--tree`:
```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeTree, normalizeTables } from './normalize';

async function main() {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
  }
  const patch = args.get('patch');
  const treeVersion = args.get('tree');
  if (!patch || !treeVersion) throw new Error('usage: extract --patch <p> --tree <v>');

  const outDir = resolve(__dirname, '../../data', treeVersion);
  mkdirSync(outDir, { recursive: true });

  // 1. Official GGG tree export (public raw JSON, pinned by version).
  const treeUrl = `https://raw.githubusercontent.com/grindinggear/skilltree-export/${treeVersion}/data.json`;
  const rawTree = await (await fetch(treeUrl)).json();
  const tree = normalizeTree(rawTree);

  // 2. .dat tables via pathofexile-dat (writes raw JSON into a temp dir; see config).
  //    Invoke the tool from ./pathofexile-dat.config.ts's runner, then normalize.
  const tables = await normalizeTables(patch); // reads the tool's raw output

  const files: Record<string, unknown> = {
    'tree.json': tree,
    ...tables, // passive_skills.json, alternate_*.json, stats.json, stat_translations.json
  };

  const checksums: Record<string, string> = {};
  for (const [name, data] of Object.entries(files)) {
    const json = JSON.stringify(data);
    writeFileSync(resolve(outDir, name), json);
    checksums[name] = createHash('sha256').update(json).digest('hex');
  }
  const manifest = { treeVersion, patch, extractedAt: new Date().toISOString(), checksums };
  writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(resolve(__dirname, '../../data/current.json'), JSON.stringify({ treeVersion }, null, 2));
  console.log(`extracted ${treeVersion} (patch ${patch}) → ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

`normalize.ts` implements `normalizeTree(raw)` (map GGG `nodes`/`groups` into the shape above; derive `jewelSlots` from nodes where `isJewelSocket`; copy `constants.orbitRadii` and `constants.skillsPerOrbit`) and `normalizeTables(patch)` (read the raw `.dat` JSON produced by `pathofexile-dat`, keep only needed columns using the exact names recorded in Step 1, write one file per table). Add npm script: `"extract": "tsx tools/extract/extract.ts"` and `npm i -D tsx`.

- [ ] **Step 5: Run the extractor, then the test**

```bash
npm run extract -- --patch 3.27 --tree 3.27.0
npm test -- extract
```
Expected: extractor prints success; test PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/extract data/current.json data/*/ package.json package-lock.json
git commit -m "feat(extract): self-extract tree + transformation tables"
```

---

## Task 3: Core types & jewel constants (`src/core/types.ts`)

**Files:**
- Create: `src/core/types.ts`, `src/core/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (imported by every later task):
```ts
export type JewelType = 1 | 2 | 3 | 4 | 5 | 6; // GloriousVanity..HeroicTragedy
export const JEWEL_NAMES: Record<JewelType, string>;
export interface Conqueror { name: string; index: number; version: number; }
export const CONQUERORS: Record<JewelType, Conqueror[]>;
export interface SeedRange { min: number; max: number; special: boolean; }
export const SEED_RANGES: Record<JewelType, SeedRange>;
export type OutcomeKind = 'notable' | 'keystone' | 'stat';
export interface Aggregate { variant: number; socketId: number; seed: number; counts: Record<string, number>; }
export interface Target { outcomeId: string; weight: number; required?: boolean; }
export interface SearchResult { jewel: JewelType; variant: number; seed: number; socketId: number; score: number; breakdown: { outcomeId: string; count: number }[]; }
```

- [ ] **Step 1: Write the failing test**

`src/core/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SEED_RANGES, CONQUERORS, JEWEL_NAMES } from './types';

describe('jewel constants', () => {
  it('has the classic 5 jewels named', () => {
    expect(JEWEL_NAMES[1]).toBe('Glorious Vanity');
    expect(JEWEL_NAMES[5]).toBe('Elegant Hubris');
  });
  it('elegant hubris seed range is special', () => {
    expect(SEED_RANGES[5]).toEqual({ min: 2000, max: 160000, special: true });
  });
  it('glorious vanity has 4 conquerors', () => {
    expect(CONQUERORS[1].map((c) => c.name)).toEqual(['Xibaqua', 'Zerphi', 'Ahuana', 'Doryani']);
    expect(CONQUERORS[1][2]).toEqual({ name: 'Ahuana', index: 2, version: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- types`
Expected: FAIL — cannot find `./types`.

- [ ] **Step 3: Implement (values transcribed verbatim from reference `data/jewels.go`)**

`src/core/types.ts`:
```ts
export type JewelType = 1 | 2 | 3 | 4 | 5 | 6;

export const JEWEL_NAMES: Record<JewelType, string> = {
  1: 'Glorious Vanity', 2: 'Lethal Pride', 3: 'Brutal Restraint',
  4: 'Militant Faith', 5: 'Elegant Hubris', 6: 'Heroic Tragedy',
};

export interface Conqueror { name: string; index: number; version: number; }
export const CONQUERORS: Record<JewelType, Conqueror[]> = {
  1: [{ name: 'Xibaqua', index: 1, version: 0 }, { name: 'Zerphi', index: 2, version: 0 }, { name: 'Ahuana', index: 2, version: 1 }, { name: 'Doryani', index: 3, version: 0 }],
  2: [{ name: 'Kaom', index: 1, version: 0 }, { name: 'Rakiata', index: 2, version: 0 }, { name: 'Kiloava', index: 3, version: 0 }, { name: 'Akoya', index: 3, version: 1 }],
  3: [{ name: 'Deshret', index: 1, version: 0 }, { name: 'Balbala', index: 1, version: 1 }, { name: 'Asenath', index: 2, version: 0 }, { name: 'Nasima', index: 3, version: 0 }],
  4: [{ name: 'Venarius', index: 1, version: 0 }, { name: 'Maxarius', index: 1, version: 1 }, { name: 'Dominus', index: 2, version: 0 }, { name: 'Avarius', index: 3, version: 0 }],
  5: [{ name: 'Cadiro', index: 1, version: 0 }, { name: 'Victario', index: 2, version: 0 }, { name: 'Chitus', index: 3, version: 0 }, { name: 'Caspiro', index: 3, version: 1 }],
  6: [{ name: 'Vorana', index: 1, version: 0 }, { name: 'Uhtred', index: 2, version: 0 }, { name: 'Medved', index: 3, version: 0 }],
};

export interface SeedRange { min: number; max: number; special: boolean; }
export const SEED_RANGES: Record<JewelType, SeedRange> = {
  1: { min: 100, max: 8000, special: false },
  2: { min: 10000, max: 18000, special: false },
  3: { min: 500, max: 8000, special: false },
  4: { min: 2000, max: 10000, special: false },
  5: { min: 2000, max: 160000, special: true },
  6: { min: 100, max: 8000, special: false },
};

export type OutcomeKind = 'notable' | 'keystone' | 'stat';
export interface Aggregate { variant: number; socketId: number; seed: number; counts: Record<string, number>; }
export interface Target { outcomeId: string; weight: number; required?: boolean; }
export interface SearchResult {
  jewel: JewelType; variant: number; seed: number; socketId: number;
  score: number; breakdown: { outcomeId: string; count: number }[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/types.test.ts
git commit -m "feat(core): jewel types, conquerors, seed ranges"
```

---

## Task 4: Generate golden fixtures from the reference (`tools/reference`)

**Files:**
- Create: `tools/reference/dump.go`
- Create (committed output): `fixtures/rng.json`, `fixtures/transform.json`

**Interfaces:**
- Consumes: the reference Go module (cloned at execution time).
- Produces:
  - `fixtures/rng.json`: `Array<{ passiveGraphId: number, seed: number, sequence: number[] }>` — first 8 `GenerateUInt()` values after `Reset(passiveGraphId, seed)`.
  - `fixtures/transform.json`: `Array<{ passiveId: number, seed: number, jewel: number, conqueror: string, result: AltInfo }>` where `AltInfo` mirrors `data.AlternatePassiveSkillInformation` serialized as `{ skill: number|null, statRolls: number[], additions: Array<{ addition: number, statRolls: number[] }> }`.

- [ ] **Step 1: Clone the reference and add a dumper**

```bash
git clone --depth 1 https://github.com/Vilsol/timeless-jewels /tmp/tj-ref
```
Create `/tmp/tj-ref/dump/main.go` that builds a **representative sample**: for each jewel type, each conqueror, seeds `{min, min+1, mid, max-1, max}` (mid = (min+max)/2, honoring the `Special` /20), and ~20 passive ids spanning small/notable/keystone. For each combo call `calculator.Calculate` and serialize to the `AltInfo` shape. Also emit `rng.json`: for a handful of `(passiveGraphId, seed)` pairs, `Reset` then record 8 `GenerateUInt()` values. Use `data.GetPassiveSkillByIndex` to pick real passive ids (filter with `data.IsPassiveSkillValidForAlteration`). Exposing the RNG may require calling `random.NumberGenerator` directly (it's exported).

- [ ] **Step 2: Run the dumper and land the fixtures**

```bash
cd /tmp/tj-ref && go run ./dump > /tmp/fixtures.json
# dumper writes two files, or split one JSON into the two fixture files:
mkdir -p "$OLDPWD/fixtures"
cp /tmp/tj-ref/rng.json /tmp/tj-ref/transform.json "$OLDPWD/fixtures/"
```
Sanity: `fixtures/transform.json` should have `6 jewels × 3-4 conquerors × 5 seeds × ~20 passives` ≈ 2000–2600 entries.

- [ ] **Step 3: Add a spot-check note**

Append 2–3 manually-verified rows (captured from the live Vilsol web tool or in-game) to `docs/superpowers/notes/2026-07-07-transform-spotchecks.md`, recording input → expected replaced notable name. These guard against inheriting a reference bug (spec §5).

- [ ] **Step 4: Commit**

```bash
git add fixtures docs/superpowers/notes/2026-07-07-transform-spotchecks.md
git commit -m "test(core): commit golden fixtures from reference"
```

---

## Task 5: Port the TinyMT32 RNG (`src/core/rng.ts`)

**Files:**
- Create: `src/core/rng.ts`, `src/core/rng.test.ts`

**Interfaces:**
- Consumes: `fixtures/rng.json` (Task 4).
- Produces: `class NumberGenerator { reset(passiveGraphId: number, seed: number): void; generateUInt(): number; generateSingle(exclusiveMax: number): number; generate(min: number, max: number): number; generateSigned(min: number, max: number): number; }` — consumed by Task 6.

- [ ] **Step 1: Write the failing test**

`src/core/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NumberGenerator } from './rng';

const cases = JSON.parse(readFileSync(resolve(__dirname, '../../fixtures/rng.json'), 'utf8')) as
  Array<{ passiveGraphId: number; seed: number; sequence: number[] }>;

describe('TinyMT32 RNG parity', () => {
  it('matches reference sequences byte-for-byte', () => {
    for (const c of cases) {
      const rng = new NumberGenerator();
      rng.reset(c.passiveGraphId, c.seed);
      const got = c.sequence.map(() => rng.generateUInt());
      expect(got).toEqual(c.sequence);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rng`
Expected: FAIL — cannot find `./rng`.

- [ ] **Step 3: Implement the port (transcribed from reference `random/main.go`)**

`src/core/rng.ts`:
```ts
const u32 = (n: number): number => n >>> 0;
const mul = (a: number, b: number): number => Math.imul(a, b) >>> 0;

const IC0 = 0x40336050, IC1 = 0xcfa3723c, IC2 = 0x3cac5f6f, IC3 = 0x3793fdff;
const SH0 = 1, SH1 = 10, MASK = 0x7fffffff, ALPHA = 0x19660d, BRAVO = 0x5d588b65;

const manipAlpha = (v: number): number => mul(u32(v ^ (v >>> 27)), ALPHA);
const manipBravo = (v: number): number => mul(u32(v ^ (v >>> 27)), BRAVO);

export class NumberGenerator {
  private state = new Uint32Array(4);

  reset(passiveGraphId: number, seed: number): void {
    this.state[0] = IC0; this.state[1] = IC1; this.state[2] = IC2; this.state[3] = IC3;
    this.initialize([u32(passiveGraphId), u32(seed)]);
  }

  private initialize(seeds: number[]): void {
    const s = this.state;
    let index = 1;
    for (const seed of seeds) {
      let r = manipAlpha(u32(s[index % 4] ^ s[(index + 1) % 4] ^ s[(index + 3) % 4]));
      s[(index + 1) % 4] = u32(s[(index + 1) % 4] + r);
      r = u32(r + seed + index);
      s[(index + 2) % 4] = u32(s[(index + 2) % 4] + r);
      s[index % 4] = r;
      index = (index + 1) % 4;
    }
    for (let k = 0; k < 5; k++) {
      let r = manipAlpha(u32(s[index % 4] ^ s[(index + 1) % 4] ^ s[(index + 3) % 4]));
      s[(index + 1) % 4] = u32(s[(index + 1) % 4] + r);
      r = u32(r + index);
      s[(index + 2) % 4] = u32(s[(index + 2) % 4] + r);
      s[index % 4] = r;
      index = (index + 1) % 4;
    }
    for (let k = 0; k < 4; k++) {
      let r = manipBravo(u32(s[index % 4] + s[(index + 1) % 4] + s[(index + 3) % 4]));
      s[(index + 1) % 4] = u32(s[(index + 1) % 4] ^ r);
      r = u32(r - index);
      s[(index + 2) % 4] = u32(s[(index + 2) % 4] ^ r);
      s[index % 4] = r;
      index = (index + 1) % 4;
    }
    for (let k = 0; k < 8; k++) this.next();
  }

  private next(): void {
    const s = this.state;
    let a = s[3];
    let b = u32((u32(s[0] & MASK) ^ s[1]) ^ s[2]);
    a = u32(a ^ u32(a << SH0));
    b = u32(b ^ (u32(b >>> SH0) ^ a));
    s[0] = s[1]; s[1] = s[2]; s[2] = u32(a ^ u32(b << SH1)); s[3] = b;
    s[1] = u32(s[1] ^ (u32(-(b & 1)) & 0x8f7011ee));
    s[2] = u32(s[2] ^ (u32(-(b & 1)) & 0xfc78ff1f));
  }

  private temper(): number {
    const s = this.state;
    const b = u32(s[0] + (s[2] >>> 8));
    const a = u32(s[3] ^ b);
    return u32(a ^ (u32(-(b & 1)) & 0x3793fdff));
  }

  generateUInt(): number { this.next(); return this.temper(); }
  generateSingle(exclusiveMax: number): number { return u32(this.generateUInt() % exclusiveMax); }
  generate(min: number, max: number): number {
    const a = u32(min + 0x80000000), b = u32(max + 0x80000000);
    const roll = this.generateSingle(u32(b - a + 1));
    return u32(u32(roll + a) + 0x80000000);
  }
  generateSigned(min: number, max: number): number { return this.generate(u32(min), u32(max)) | 0; }
}
```
Note: `(index + 3) % 4` equals the reference's `(index + 4 - 1) % 4`; `(index + 2) % 4` equals `((index + 1) + 1) % 4`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- rng`
Expected: PASS — all fixture sequences match.

- [ ] **Step 5: Commit**

```bash
git add src/core/rng.ts src/core/rng.test.ts
git commit -m "feat(core): TinyMT32 RNG port with reference parity"
```

---

## Task 6: Port the transformation (`src/core/transform.ts` + `src/core/tables.ts`)

**Files:**
- Create: `src/core/tables.ts` (typed loaders + data accessors ported from reference `data/manager.go`, `data/main.go`), `src/core/transform.ts`, `src/core/transform.test.ts`

**Interfaces:**
- Consumes: `NumberGenerator` (Task 5), extracted tables (Task 2), `fixtures/transform.json` (Task 4), `CONQUERORS`/`SEED_RANGES` (Task 3).
- Produces:
```ts
export interface AltInfo { skill: number | null; statRolls: number[]; additions: Array<{ addition: number; statRolls: number[] }>; }
export function calculate(passiveId: number, seed: number, jewel: JewelType, conqueror: Conqueror, tables: Tables): AltInfo;
export function loadTables(dir: string): Tables; // Node; browser variant loads via fetch in Plan 2
```

- [ ] **Step 1: Fetch the remaining reference source to port the data accessors**

```bash
for f in data/main.go data/manager.go data/types.go data/skill_tree_types.go; do
  echo "== $f =="; gh api -H "Accept: application/vnd.github.raw" "repos/Vilsol/timeless-jewels/contents/$f";
done > /tmp/tj-data.go.txt
```
Port these functions into `tables.ts`, driven off the Task 2 JSON tables (not the reference's baked `.json.gz`): `getPassiveSkillByIndex`, `isPassiveSkillValidForAlteration`, `getPassiveSkillType`, `isSmallAttribute`, `getAlternateTreeVersionIndex`, `getApplicableAlternatePassiveSkills`, `getApplicableAlternatePassiveAdditions`, `getAlternatePassiveSkillKeyStone`, and `getStatMinMax(skill, isMin, i)`. Keep them pure and typed.

- [ ] **Step 2: Write the failing test**

`src/core/transform.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculate, loadTables } from './transform';
import { CONQUERORS } from './types';

const tables = loadTables(resolve(__dirname, '../../data',
  JSON.parse(readFileSync(resolve(__dirname, '../../data/current.json'), 'utf8')).treeVersion));
const cases = JSON.parse(readFileSync(resolve(__dirname, '../../fixtures/transform.json'), 'utf8'));

describe('transform parity', () => {
  it('matches reference Calculate byte-for-byte on the golden sample', () => {
    for (const c of cases) {
      const conq = CONQUERORS[c.jewel as 1|2|3|4|5|6].find((x) => x.name === c.conqueror)!;
      const got = calculate(c.passiveId, c.seed, c.jewel, conq, tables);
      expect(got).toEqual(c.result);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- transform`
Expected: FAIL — cannot find `./transform`.

- [ ] **Step 4: Implement `calculate` + `AlternateTreeManager` (ported from `calculator/main.go` + `tree_manager.go`)**

`src/core/transform.ts` — port the control flow exactly:
```ts
// getSeed: Elegant Hubris (alternateTreeVersion.Index === 5) uses seed/20.
// Calculate:
//   skill = getPassiveSkillByIndex(passiveId); if !valid → empty AltInfo
//   atv = getAlternateTreeVersionIndex(jewel); conq resolved from CONQUERORS
//   if isPassiveSkillReplaced(rng) → replacePassiveSkill(rng) else { additions: augmentPassiveSkill(rng) }
// isPassiveSkillReplaced:
//   keystone → true
//   notable → weight>=100 true; weight==0 false; else rng.reset(...); rng.generate(0,100) < weight
//   single small-attribute stat → atv.AreSmallAttributePassiveSkillsReplaced
//   else → atv.AreSmallNormalPassiveSkillsReplaced
// augmentPassiveSkill: rng.reset(); if type==Notable rng.generate(0,100); rollAdditions(atv.min,atv.max,rng)
// replacePassiveSkill: keystone → GetAlternatePassiveSkillKeyStone, statRolls=[stat1Min];
//   else applicable = getApplicableAlternatePassiveSkills; rng.reset(); if Notable rng.generate(0,100);
//   currentSpawnWeight loop selecting rolled skill; roll up-to-4 stats via getStatMinMax + generateSigned;
//   if randomMin==0 && randomMax==0 → return; else rollAdditions(atv.min+randomMin, atv.max+randomMax, rng)
// rollAdditions / rollAlternatePassiveAddition: mirror tree_manager.go exactly (retry until non-nil).
```
Serialize the returned `AltInfo` with the **same field order and null/empty conventions** as the fixtures (skill id or null; `statRolls` trimmed to the rolled element count; `additions` array). Match array lengths precisely — the golden test compares deep equality.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- transform`
Expected: PASS — all ~2000+ golden cases match. If any mismatch, diff the first failing case against the reference `Calculate` and fix the port (do not edit fixtures).

- [ ] **Step 6: Add a determinism test and commit**

Add to `transform.test.ts`:
```ts
it('is deterministic', () => {
  const conq = CONQUERORS[1][0];
  expect(calculate(cases[0].passiveId, 100, 1, conq, tables))
    .toEqual(calculate(cases[0].passiveId, 100, 1, conq, tables));
});
```
```bash
npm test -- transform
git add src/core/tables.ts src/core/transform.ts src/core/transform.test.ts
git commit -m "feat(core): transformation port with reference parity"
```

---

## Task 7: Radius membership (`src/core/radius.ts`)

**Files:**
- Create: `src/core/radius.ts`, `src/core/radius.test.ts`

**Interfaces:**
- Consumes: `tree.json` (Task 2).
- Produces: `export function nodesInRadius(socketId: number, tree: TreeData): number[];` and `export function nodeWorldPos(node, tree): { x: number; y: number };` — consumed by Task 8.

- [ ] **Step 1: Capture one real socket→nodes sample from the reference tool**

From the Vilsol web tool (or its `frontend` radius helper), record for **one** jewel socket the set of affected passive node ids at the timeless (Large) radius. Save as `fixtures/radius-socket-<id>.json` = `{ socketId: number, radius: number, nodeIds: number[] }`. Timeless radius is Large (1500 tree units) — confirm the exact constant from the tree data / reference and record it in the fixture.

- [ ] **Step 2: Write the failing test**

`src/core/radius.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nodesInRadius } from './radius';

const ver = JSON.parse(readFileSync(resolve(__dirname, '../../data/current.json'), 'utf8')).treeVersion;
const tree = JSON.parse(readFileSync(resolve(__dirname, `../../data/${ver}/tree.json`), 'utf8'));
const sample = JSON.parse(readFileSync(resolve(__dirname, '../../fixtures/radius-socket-' + tree.jewelSlots[0] + '.json'), 'utf8'));

describe('nodesInRadius', () => {
  it('matches the reference-affected node set for a known socket', () => {
    const got = nodesInRadius(sample.socketId, tree).sort((a, b) => a - b);
    expect(got).toEqual([...sample.nodeIds].sort((a, b) => a - b));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- radius`
Expected: FAIL — cannot find `./radius`.

- [ ] **Step 4: Implement orbital geometry + radius filter**

`src/core/radius.ts`:
```ts
// world position from group + orbit (skilltree-export layout):
//   angle = orbitAngle(orbit, orbitIndex, tree.constants)  // uniform: orbitIndex/skillsPerOrbit[orbit]*2π
//   x = group.x + orbitRadii[orbit] * Math.sin(angle)
//   y = group.y - orbitRadii[orbit] * Math.cos(angle)
// Newer trees supply per-orbit angle tables for 16/40-node orbits — use them when present.
// nodesInRadius: pos of socket node; include every node whose Euclidean distance <= LARGE_RADIUS
//   and which is a real passive (has a group/orbit; exclude sockets, mastery, class-start).
export const LARGE_RADIUS = 1500; // confirm against tree data in Step 1
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- radius`
Expected: PASS. If off-by-a-few nodes, the angle table for non-uniform orbits is the usual culprit — apply the per-orbit angle table.

- [ ] **Step 6: Commit**

```bash
git add src/core/radius.ts src/core/radius.test.ts fixtures/radius-socket-*.json
git commit -m "feat(core): radius membership from tree geometry"
```

---

## Task 8: Precompute one jewel's shard (`tools/precompute`)

**Files:**
- Create: `tools/precompute/precompute.ts`, `tools/precompute/shard.ts`, `tools/precompute/precompute.test.ts`
- Create (committed output): `data/shards/<treeVersion>/<jewel>.bin.gz` + `<jewel>.meta.json`

**Interfaces:**
- Consumes: `calculate` (Task 6), `nodesInRadius` (Task 7), constants (Task 3).
- Produces: a shard file of `Aggregate` rows for one jewel across all its conquerors × all jewel sockets × all seeds, plus a meta file `{ jewel, treeVersion, variants, sockets, seedCount, rawBytes, gzBytes, rows }`.

- [ ] **Step 1: Write the failing test**

`tools/precompute/precompute.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildAggregate, encodeShard, decodeShard } from './shard';

describe('shard aggregate', () => {
  it('counts outcomes per (variant, socket, seed)', () => {
    const outcomes = ['notable:123', 'stat:45', 'stat:45', 'stat:99'];
    const agg = buildAggregate(1, 7, 100, outcomes);
    expect(agg.counts).toEqual({ 'notable:123': 1, 'stat:45': 2, 'stat:99': 1 });
  });
  it('round-trips through encode/decode', () => {
    const rows = [buildAggregate(1, 7, 100, ['notable:1']), buildAggregate(2, 7, 101, ['stat:2', 'stat:2'])];
    expect(decodeShard(encodeShard(rows))).toEqual(rows);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- precompute`
Expected: FAIL — cannot find `./shard`.

- [ ] **Step 3: Implement aggregation, encoding, and the driver**

`shard.ts`: `buildAggregate(variant, socketId, seed, outcomeIds: string[]): Aggregate` (tally into `counts`); `encodeShard(rows): Uint8Array` (compact binary — intern outcome-id strings into a dictionary, then rows as varint indices+counts); `decodeShard(bytes): Aggregate[]`. `precompute.ts`: for the `--jewel` arg, for each conqueror, each `tree.jewelSlots` socket, each seed in range (honor `special` /20 → *20), compute `calculate` for every node in `nodesInRadius(socket)`, map each `AltInfo` to outcome ids (`notable:<skill>`, `keystone:<skill>`, `stat:<statKey>` per addition/replacement), `buildAggregate`, collect, `encodeShard`, gzip, write `.bin.gz` + `.meta.json`. Add script `"precompute": "tsx tools/precompute/precompute.ts"`.

- [ ] **Step 4: Run test, then generate the real shard**

```bash
npm test -- precompute
npm run precompute -- --jewel 3   # Brutal Restraint: mid-size seed range, 4 conquerors
```
Expected: test PASS; a `data/shards/<ver>/3.bin.gz` + meta written.

- [ ] **Step 5: Commit**

```bash
git add tools/precompute data/shards package.json
git commit -m "feat(precompute): per-jewel shard builder"
```

---

## Task 9: Size gate decision (spec §11)

**Files:**
- Create: `docs/superpowers/notes/2026-07-07-size-gate-report.md`

**Interfaces:**
- Consumes: the shard meta from Task 8.
- Produces: a written go/no-go decision that unblocks Plan 2.

- [ ] **Step 1: Measure and extrapolate**

Read `data/shards/<ver>/3.meta.json`. Record `gzBytes` for Brutal Restraint. Extrapolate the full dataset: per-jewel ≈ observed; total ≈ Σ over jewels scaled by their `variants × seedCount`. Note Elegant Hubris is the largest (widest seed range).

- [ ] **Step 2: Write the report and decide**

`docs/superpowers/notes/2026-07-07-size-gate-report.md`: record measured per-jewel gz size, extrapolated per-jewel and total, and the decision:
- **Per-jewel shard ≤ ~8 MB gz →** offline-precompute holds. Plan 2 proceeds as designed (lazy per-jewel shard load).
- **Per-jewel shard > ~8 MB gz →** trigger the spec §11 fallback: Plan 2 uses on-demand search in a worker (reusing `calculate` + `nodesInRadius`), no shipped shards. Document this so Plan 2 is written against the confirmed architecture.

Pick the threshold with the user if the measurement lands ambiguously (5–12 MB).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/notes/2026-07-07-size-gate-report.md
git commit -m "docs: size gate measurement and runtime decision"
```

---

## Self-Review

- **Spec coverage (Plan 1 portion):** §3 data provenance → Task 2; §4 `core/types`/`transform`/`radius` → Tasks 3/6/7; §4 `tools/extract`/`precompute` → Tasks 2/8; §5 correctness oracle (bulk + spot-checks) → Task 4 + Task 6; §11 size gate → Tasks 8/9. Runtime search/UI/trade/tree-render/deploy (§4 runtime, §6, §7, §10) are **deferred to Plan 2** by design (gate-dependent).
- **Placeholder scan:** RNG, types, and constants carry full verbatim code. Extraction column names, the `data/manager.go` accessors, and the one radius sample are explicitly generated/confirmed at execution time from named sources (not hand-waved) — these are genuine external-dependency confirmations, not placeholders.
- **Type consistency:** `AltInfo`, `Aggregate`, `Target`, `SearchResult`, `NumberGenerator`, `calculate`, `nodesInRadius`, `loadTables` names are consistent across Tasks 3/5/6/7/8. `Aggregate.counts` keys use the `kind:id` outcome-id convention shared by Tasks 6 and 8.
- **Gate discipline:** Task 2 Step 1 and Task 9 are hard stops that can flip assumptions (table availability; runtime architecture). Plan 2 is intentionally not written until Task 9 resolves.
