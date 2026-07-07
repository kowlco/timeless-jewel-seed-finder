# Timeless Jewel Seed Finder — Implementation Plan 2: Runtime (search + UI + deploy)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the validated core (Plan 1) into the actual static site: compact shards, an all-socket weighted search, a Svelte UI (jewel/target pickers, results table, socket breakdown, trade links, adapted tree render), deployed to GitHub Pages.

**Architecture:** Build-time precompute writes compact per-jewel shards (<5 MB gz each — gate decision). The browser lazily loads a jewel's shard, decodes it, and `core/search` scores it against weighted targets. Selecting a result renders it via `core/transform` (single seed+socket) on the adapted tree view and builds a trade link.

**Tech Stack:** TypeScript, Svelte 5, Vite, Vitest. Reuses Plan 1 `core/*`.

## Global Constraints

- Reuse Plan 1 `core/transform`, `core/rng`, `core/radius`, `core/tables`, `core/types`. Do not fork them.
- Compact shard budget: **< 5 MB gz per jewel** (spec §11 gate decision 2026-07-07). Re-measure in Task 1; if unreachable, escalate before building UI.
- All search/scoring pure TS, runs in a Web Worker (keep UI responsive).
- English-only labels (MVP). Notable/keystone labels from alt-skill `Name`; stat labels from extracted stat descriptions.
- Static site only; deploy to GitHub Pages with correct `base`.

---

## Task 1: Compact shard encoding + re-measure (gate follow-up)

**Files:**
- Modify: `tools/precompute/shard.ts` (binary varint encode/decode)
- Modify: `tools/precompute/precompute.test.ts` (round-trip on binary)
- Modify: `tools/precompute/precompute.ts` (write `.bin.gz`, add outcome-dictionary sidecar)

**Interfaces:**
- Produces: `encodeShard(rows, dict): Uint8Array` (binary), `decodeShard(bytes): { rows: Aggregate[] }`. Shard file format: `[u32 dictCount][dict strings][u32 rowCount][rows...]`, each row `[u8 variant][u16 socket][varint seed][u8 nOutcomes][ (varint outcomeIdx, varint count)... ]`. Gzipped.

- [ ] **Step 1: Write failing round-trip test** — binary encode/decode of a few aggregates equals input.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement binary varint encode/decode** (shared outcome dictionary, `DataView`/`Uint8Array` varints).
- [ ] **Step 4: Run test → pass.**
- [ ] **Step 5: Re-measure** — `npm run precompute -- --jewel 3`; record gz size. **Gate:** if > 5 MB, try (a) split outcomes into a per-jewel dictionary of only-present ids (done), (b) drop redundant `add:` ids keeping stats, (c) delta-encode seeds. If still > 5 MB after these, STOP and report.
- [ ] **Step 6: Precompute all 6 jewels**, commit shards under `data/shards/<ver>/`. Update `.gitignore` to un-ignore shards. Commit.

## Task 2: Outcome labels (for the target picker)

**Files:**
- Modify: `tools/extract/extract.ts` (also emit `stat_descriptions.json` — English only)
- Create: `src/core/labels.ts` (`buildOutcomeLabels(dataDir|assets): Map<string,string>`)
- Create: `src/core/labels.test.ts`

**Interfaces:**
- Produces: `outcomeLabel(id: string, labels): string` — `notable:123`→ alt-skill Name, `keystone:..`→Name, `stat:456`→ stat description text, `add:..`→ addition Name/Id.

- [ ] Extract `Metadata/StatDescriptions/stat_descriptions.txt` via pathofexile-dat files export (English), normalize stat-id → text.
- [ ] TDD `labels.ts`: a known notable id → its Name; a known stat id → its text.
- [ ] Commit.

## Task 3: `core/search` (all-socket weighted scoring)

**Files:**
- Create: `src/core/search.ts`, `src/core/search.test.ts`

**Interfaces:**
- Produces: `search(rows: Aggregate[], targets: Target[], topN: number): SearchResult[]` — score = Σ weight×count; drop rows failing a `required` target; rank desc; top-N via bounded heap; `breakdown` lists matched outcomes+counts.

- [ ] TDD: fake aggregates + targets → expected ranking, required-filter, breakdown. Commit.

## Task 4: `data/loader` + search worker

**Files:**
- Create: `src/data/loader.ts` (fetch + gunzip + `decodeShard`; `DecompressionStream`), `src/worker/search.worker.ts`, `src/data/loader.test.ts`

**Interfaces:**
- Produces: `loadShard(jewel): Promise<{rows, dict}>`, worker protocol `{type:'search', jewel, targets, topN}` → `{type:'result', results}` / progress.

- [ ] TDD loader decode against a committed small shard. Worker wraps `core/search`. Commit.

## Task 5: UI shell + JewelSelect + TargetPicker

**Files:**
- Create: `src/lib/JewelSelect.svelte`, `src/lib/TargetPicker.svelte`, `src/lib/state.svelte.ts`
- Modify: `src/App.svelte`

- [ ] Jewel + variant(s) select. Target autocomplete over labels with weight inputs + required toggle. Wire to worker; render nothing yet but log results. Manual verify via `npm run dev`. Commit.

## Task 6: ResultsTable + SocketBreakdown

**Files:**
- Create: `src/lib/ResultsTable.svelte`, `src/lib/SocketBreakdown.svelte`

- [ ] Sortable ranked table (jewel/variant/seed/socket/score + breakdown). Row select → SocketBreakdown computes the selected (seed,socket) node-by-node via `core/transform` + `core/radius` + labels. Commit.

## Task 7: `core/trade` + trade links

**Files:**
- Create: `src/core/trade.ts`, `src/core/trade.test.ts`; wire button into ResultsTable.

**Interfaces:**
- `buildTradeUrl(jewel, seed, league): string` — official `pathofexile.com/trade/search/<league>?q=<url-encoded JSON>` with the jewel's seed stat filter. Handle Elegant Hubris display seed = internal×20.

- [ ] Port trade query shape from reference `frontend/src/lib/trade.ts`. TDD snapshot per jewel incl. EH. Commit.

## Task 8: TreeView (adapt reference renderer)

**Files:**
- Create: `src/lib/TreeView.svelte` (canvas), `src/lib/tree_render.ts`

- [ ] Adapt reference `frontend/src/lib/skill_tree.ts` + `SkillTree.svelte`: draw nodes/groups, jewel radius circle, transformed nodes for the selected (seed,socket). Sprites from GGG CDN with graceful fallback. Pan/zoom. Manual verify. Commit.

## Task 9: Build + deploy to GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`; Modify `vite.config.ts` (`base`).

- [ ] Vite static build; Pages Actions workflow; committed shards make build hermetic. Verify `npm run build` locally. Commit.

## Self-Review
- Search/UI/trade/render/deploy cover spec §4 runtime, §6, §7, §10. Encoding gate re-checked in Task 1. Build-awareness/multilang remain out (phase 2).
