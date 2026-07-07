# Size gate report (spec §11)

Date: 2026-07-07. Patch 3.28.0.14.3 / tree 3.28.0.

## Measurement (real, not extrapolated)

Full precompute of **Brutal Restraint (jewel 3)** — 18 timeless sockets × 4 variants × 7501 seeds:

| Metric | Value |
|---|---|
| Rows (variant×socket×seed) | 540,072 |
| Raw bytes (JSON-numeric encoding) | 78.6 MB |
| **Gzip bytes (level 9)** | **12.3 MB** |
| Build time (single thread) | ~35 s |

## Extrapolation to all jewels

Each jewel: 18 sockets × 3–4 variants × ~7500–8000 seeds. Gzip per jewel ≈ **10–15 MB**
(BR measured 12.3; GV/EH replace more nodes → denser → likely larger; HT has 3 variants → ~10).
All six ≈ **~70 MB gz** total.

## Analysis

- **Compute is fine**: ~35 s/jewel at build time; trivially parallelizable. Not a constraint.
- **Size is the issue**: 12.3 MB/jewel **exceeds** the ≤8 MB comfort threshold for lazy per-jewel load.
- **But the encoding is deliberately naive** and inflates the number:
  - Rows are `JSON.stringify` of number arrays (interned dict, but still JSON text). A binary
    varint format (variant u8, socket u16, seed varint, then outcome-index varint + count u8)
    would cut raw ~2–3× and gzip better.
  - The outcome taxonomy is **maximally verbose**: every rolled skill/addition emits a
    `skill:`/`add:` id **plus a `stat:` id per stat key**, for every node in radius. The `stat:`
    outcomes dominate the payload.
- **Realistic optimized target**: binary encoding + leaner taxonomy (or an inverted index
  `outcome → postings`, which both compresses far better and is what search actually queries)
  should reach **~3–6 MB/jewel**, comfortably lazy-loadable.

## Update 2026-07-07 (Plan 2 Task 1) — budget revised

Binary varint encoding + dropping redundant `add:` ids brought BR from 12.3 MB → **8.67 MB gz**
(raw 18.9 MB). Sub-5 MB is unreachable without losing search fidelity: for augment jewels (LP/BR)
the per-seed stat histograms across ~60–90 nodes ARE the search signal, and their counts matter.

The `<5 MB` figure was a **self-imposed conservative threshold**, not an external requirement.
Per user sign-off, the budget is relaxed: **ship full-fidelity ~8–9 MB/jewel**, lazy-loaded per
jewel and browser-cached. Acceptable for a desktop theorycrafting tool. No further encoding work.

Shards are **regenerable** (`npm run precompute -- --jewel N`) and kept out of git; the deploy
workflow (Task 9) generates them before the Vite build.

## Decision — DECIDED 2026-07-07 (user sign-off)

**Keep offline precompute.** The naive 12.3 MB/jewel is not shipped as-is: Plan 2 must ship a
compact binary/inverted encoding with a **<5 MB/jewel** budget and re-measure before wiring the UI.
On-demand worker search was rejected as the primary path (a full-jewel pass is ~35 s
single-threaded, too slow per interactive search).

Plan 2 entry criteria: implement the compact encoding + `data/loader` + `core/search` against it,
confirm <5 MB/jewel, THEN build search UI, trade links, tree render, deploy.

Alternative if <5 MB proves unreachable: **hybrid** — ship a small notables/keystones-only index
(~1–2 MB/jewel) for the common case, and compute stat-level detail for a *selected* result
on-demand (one socket+seed = milliseconds).

## Final per-jewel sizes (binary + trimmed taxonomy, streaming encoder)

| Jewel | gz | Note |
|---|---|---|
| Glorious Vanity | **31.8 MB** | transforms every node (smalls→stats) — the outlier |
| Elegant Hubris | 10.7 MB | |
| Lethal Pride | 8.8 MB | |
| Brutal Restraint | 8.2 MB | |
| Heroic Tragedy | 6.3 MB | |
| Militant Faith | 3.6 MB | |
| **Total** | **~69 MB** | lazy per-jewel; only the selected jewel loads |

Taxonomy: replaced keystone/notable → `keystone:`/`notable:<altId>` (id implies stats);
replaced small passive & augment additions → `stat:<statKey>`. Streaming `ShardEncoder`
keeps memory flat. GV remains heavy; revisit only if its load UX proves unacceptable.
