<script lang="ts">
  import { JEWEL_NAMES, CONQUERORS, type JewelType, type Target } from './core/types';
  import { loadLabels } from './data/loader';
  import { runSearch } from './lib/searchClient';
  import type { SearchResult } from './core/types';
  import ResultsTable from './lib/ResultsTable.svelte';
  import SocketBreakdown from './lib/SocketBreakdown.svelte';
  import TreeView from './lib/TreeView.svelte';

  const JEWELS = [1, 2, 3, 4, 5, 6] as JewelType[];

  let jewel = $state<JewelType>(1);
  let variants = $state<number[]>([]); // empty = all conquerors
  let labels = $state<Record<string, string>>({});
  let query = $state('');
  let targets = $state<(Target & { label: string })[]>([]);
  let results = $state<SearchResult[]>([]);
  let selected = $state<SearchResult | null>(null);
  let status = $state<'idle' | 'loading' | 'searching' | 'error'>('idle');
  let errorMsg = $state('');

  $effect(() => {
    const j = jewel;
    status = 'loading';
    labels = {};
    loadLabels(j)
      .then((l) => {
        labels = l;
        status = 'idle';
      })
      .catch((e) => {
        status = 'error';
        errorMsg = String(e);
      });
  });

  const suggestions = $derived(
    query.trim().length < 2
      ? []
      : Object.entries(labels)
          .filter(
            ([id, label]) =>
              label.toLowerCase().includes(query.toLowerCase()) &&
              !targets.some((t) => t.outcomeId === id),
          )
          .slice(0, 25),
  );

  function addTarget(id: string, label: string) {
    targets = [...targets, { outcomeId: id, label, weight: 1, required: false }];
    query = '';
  }
  function removeTarget(id: string) {
    targets = targets.filter((t) => t.outcomeId !== id);
  }
  function toggleVariant(v: number) {
    variants = variants.includes(v) ? variants.filter((x) => x !== v) : [...variants, v];
  }

  async function doSearch() {
    if (targets.length === 0) return;
    status = 'searching';
    results = [];
    selected = null;
    try {
      results = await runSearch({
        jewel,
        variants: [...variants],
        targets: targets.map(({ outcomeId, weight, required }) => ({ outcomeId, weight, required })),
        topN: 200,
      });
      status = 'idle';
    } catch (e) {
      status = 'error';
      errorMsg = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<main>
  <h1>Timeless Jewel Seed Finder</h1>
  <p class="sub">
    Pick a jewel and the passives you want, then search <strong>every seed and socket at once</strong
    >.
  </p>

  <section class="panel">
    <label class="row">
      <span>Jewel</span>
      <select bind:value={jewel}>
        {#each JEWELS as j (j)}<option value={j}>{JEWEL_NAMES[j]}</option>{/each}
      </select>
    </label>

    <div class="row">
      <span>Variants</span>
      <div class="variants">
        {#each CONQUERORS[jewel] as c, i (c.name)}
          <label class="chip">
            <input
              type="checkbox"
              checked={variants.includes(i)}
              onchange={() => toggleVariant(i)}
            />
            {c.name}
          </label>
        {/each}
        <span class="hint">{variants.length === 0 ? '(all)' : ''}</span>
      </div>
    </div>

    <div class="row">
      <span>Targets</span>
      <div class="picker">
        <input
          placeholder={status === 'loading'
            ? 'loading labels…'
            : 'search notable / keystone / stat…'}
          bind:value={query}
          disabled={status === 'loading'}
        />
        {#if suggestions.length}
          <ul class="suggestions">
            {#each suggestions as [id, label] (id)}
              <li>
                <button type="button" onclick={() => addTarget(id, label)}>
                  <span class="kind">{id.split(':')[0]}</span>{label}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

    {#if targets.length}
      <ul class="targets">
        {#each targets as t (t.outcomeId)}
          <li>
            <span class="tlabel"><span class="kind">{t.outcomeId.split(':')[0]}</span>{t.label}</span>
            <label>w <input type="number" bind:value={t.weight} min="0" step="1" /></label>
            <label class="req"><input type="checkbox" bind:checked={t.required} /> required</label>
            <button type="button" class="rm" onclick={() => removeTarget(t.outcomeId)}>✕</button>
          </li>
        {/each}
      </ul>
    {/if}

    <button class="search" onclick={doSearch} disabled={!targets.length || status === 'searching'}>
      {status === 'searching' ? 'Searching…' : 'Search all sockets'}
    </button>
    {#if status === 'error'}<p class="err">{errorMsg}</p>{/if}
  </section>

  <div class="results-area" class:split={!!selected}>
    <div class="table-col">
      <ResultsTable
        {results}
        {labels}
        {jewel}
        {selected}
        conquerors={CONQUERORS[jewel]}
        onselect={(r) => (selected = r)}
      />
    </div>
    {#if selected}
      <aside class="detail-col">
        <TreeView result={selected} {jewel} conqueror={CONQUERORS[jewel][selected.variant]} />
        <SocketBreakdown result={selected} {jewel} conqueror={CONQUERORS[jewel][selected.variant]} />
      </aside>
    {/if}
  </div>
</main>

<style>
  main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1.5rem;
    font-family: system-ui, sans-serif;
  }
  h1 {
    margin: 0;
  }
  .sub {
    color: #999;
    margin-top: 0.25rem;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    background: #1b1b1f;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 1rem;
  }
  .row {
    display: grid;
    grid-template-columns: 90px 1fr;
    align-items: start;
    gap: 0.75rem;
  }
  .row > span {
    padding-top: 0.35rem;
    color: #aaa;
  }
  select,
  input {
    background: #111;
    color: inherit;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 0.35rem 0.5rem;
  }
  .variants {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .chip {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
    background: #111;
    border: 1px solid #444;
    border-radius: 20px;
    padding: 0.2rem 0.6rem;
  }
  .hint {
    color: #666;
  }
  .picker {
    position: relative;
  }
  .picker input {
    width: 100%;
    box-sizing: border-box;
  }
  .suggestions {
    position: absolute;
    z-index: 5;
    left: 0;
    right: 0;
    margin: 2px 0 0;
    padding: 0;
    list-style: none;
    background: #111;
    border: 1px solid #444;
    border-radius: 6px;
    max-height: 260px;
    overflow: auto;
  }
  .suggestions button {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: inherit;
    padding: 0.35rem 0.5rem;
    cursor: pointer;
  }
  .suggestions button:hover {
    background: #2a2a30;
  }
  .kind {
    display: inline-block;
    min-width: 62px;
    color: #7aa2f7;
    font-size: 0.75rem;
    text-transform: uppercase;
  }
  .targets {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .targets li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .tlabel {
    flex: 1;
  }
  .targets input[type='number'] {
    width: 4rem;
  }
  .req {
    color: #aaa;
  }
  .rm {
    background: none;
    border: none;
    color: #e06c75;
    cursor: pointer;
  }
  .search {
    align-self: flex-start;
    background: #7aa2f7;
    color: #000;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    font-weight: 600;
    cursor: pointer;
  }
  .search:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .err {
    color: #e06c75;
  }
  .results-area {
    display: flex;
    gap: 1.25rem;
    align-items: flex-start;
  }
  .table-col {
    flex: 1;
    min-width: 0;
  }
  .detail-col {
    flex: none;
    width: 560px;
    position: sticky;
    top: 1rem;
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
  }
  @media (max-width: 1120px) {
    .results-area {
      flex-direction: column;
    }
    .detail-col {
      position: static;
      width: 100%;
      max-height: none;
    }
  }
</style>
