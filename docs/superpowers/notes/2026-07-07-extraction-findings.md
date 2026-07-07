# Task 2 — Extraction findings (proven during execution)

Date: 2026-07-07. These refine Plan 1 Task 2 with facts verified by running code.

## Mechanism (works end-to-end)

- Current patch: **3.28.0.14.3** (from `poe-tool-dev/latest-patch-version`).
- `pathofexile-dat` downloads bundles from `patch.poecdn.com` — no game install needed. Confirmed working.
- **CLI cannot emit unnamed (`_`) columns distinctly** — `importHeaders` sets `name: column.name || ''`, so all unnamed columns collide under key `''`. Therefore the extractor uses `pathofexile-dat` **as a library** and reads columns **positionally**.
- Public API only exports `bundles.js`, `dat.js`, `sprites.js` (Node `exports` map blocks deep imports). So:
  - Import `FileLoader`, `toCdnUrl` from `pathofexile-dat/bundles.js`.
  - Copy the ~30-line `CdnBundleLoader` + `CachingBundleLoader` glue (uses only public `toCdnUrl`).
  - Import `readDatFile`, `readColumn`, `getHeaderLength` from `pathofexile-dat/dat.js`.
- **`dat.js` triggers a `file://` wasm fetch at import** (`dat-analysis/wasm.js`) which Node/undici rejects. Fix: install a `globalThis.fetch` shim that serves `file:` URLs from disk with `content-type: application/wasm`, THEN `await import('pathofexile-dat/dat.js')` dynamically. (We don't use `analyzeDatFile`; the shim just lets the module load.)
- Schema: `SCHEMA_URL = https://github.com/poe-tool-dev/dat-schema/releases/download/latest/schema.min.json` (from `pathofexile-dat-schema`). Build headers by replicating `importHeaders` (offset via `getHeaderLength`), then `readColumn` per column — including unnamed ones, addressed by position.
- Schema has **two `AlternateTreeVersions` entries**: `validFor & 1` (PoE1, unnamed, 10 cols) and `validFor & 2` (PoE2, named). Select PoE1 with `validFor & 1`.

## AlternateTreeVersions column mapping (NAILED)

PoE1 columns: `0:Id(string) 1:bool 2:bool 3..9:i32`. Row index == JewelType (1=Vaal/GloriousVanity … 6=Kalguuran/HeroicTragedy). Verified against Vilsol `data/types.go` struct tags AND live values:

| Field (Vilsol AlternateTreeVersion) | Column index |
|---|---|
| `Index` | row index (0–6) |
| `AreSmallAttributePassiveSkillsReplaced` (bool) | 1 |
| `AreSmallNormalPassiveSkillsReplaced` (bool) | 2 |
| `MinimumAdditions` (i32) | 5 |
| `MaximumAdditions` (i32) | 6 |
| `NotableReplacementSpawnWeight` (i32) | 9 |

Live values (col1,col2,col5,col6,col9): Vaal `t,t,0,0,100`; Karui `f,f,1,1,0`; Maraketh `f,f,1,1,0`; Templar `t,f,1,1,20`; Eternal `t,t,0,0,100`; Kalguuran `f,f,1,1,100`. Consistent with in-game replacement behaviour (GV/EH always replace notables=100; LP/BR never=0; MF rolls=20).

## Caveat — AlternatePassiveSkills stat slots

Vilsol's struct tags (`Stat2Min=Var6`, `Stat3Min=Var9`, `Stat4Min=Var11`, …) index HIS go-pob-data column order, which **differs** from poe-tool-dev's `_Core.gql` order. So do NOT transfer Var indices blindly for this table. Read all columns positionally; the exact Stat3/Stat4 slot positions are pinned by the Task 6 golden tests (a wrong slot fails skills with 3–4 stats).

## Reusable snippet

Working probe committed at `tools/extract/work/probe.mjs` (gitignored scratch) demonstrates the full read of AlternateTreeVersions. Fold its loader glue + header builder into `tools/extract`.
