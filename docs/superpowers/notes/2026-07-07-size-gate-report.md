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

## Decision (needs sign-off — lands in the ambiguous 8–15 MB band per §11)

Recommended: **keep offline precompute**, but treat the encoding as unfinished — Plan 2 must ship
a compact binary/inverted encoding with a **<5 MB/jewel** budget, and re-measure. On-demand
worker search is a poor fallback here: a full-jewel pass is ~35 s single-threaded, too slow to run
per interactive search.

Alternative if <5 MB proves unreachable: **hybrid** — ship a small notables/keystones-only index
(~1–2 MB/jewel) for the common case, and compute stat-level detail for a *selected* result
on-demand (one socket+seed = milliseconds).
