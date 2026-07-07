<script lang="ts">
  import type { SearchResult, Conqueror, JewelType } from '../core/types';
  import { buildTradeUrl } from '../core/trade';

  let {
    results,
    labels,
    conquerors,
    jewel,
    league = 'Standard',
    selected = null,
    socketNames = {},
    capped = false,
    pickedKeys = new Set<string>(),
    onselect,
    ontogglepick,
  }: {
    results: SearchResult[];
    labels: Record<string, string>;
    conquerors: Conqueror[];
    jewel: JewelType;
    league?: string;
    selected?: SearchResult | null;
    socketNames?: Record<string, string>;
    capped?: boolean;
    pickedKeys?: Set<string>;
    onselect?: (r: SearchResult) => void;
    ontogglepick?: (r: SearchResult) => void;
  } = $props();

  const pickKey = (r: SearchResult) => `${r.variant}:${r.seed}`;

  const isSel = (r: SearchResult) =>
    selected != null &&
    selected.variant === r.variant &&
    selected.socketId === r.socketId &&
    selected.seed === r.seed;

  const label = (id: string) => labels[id] ?? id;
  const tradeHref = (r: SearchResult) =>
    buildTradeUrl(jewel, conquerors[r.variant]?.name ?? '', r.seed, league);
</script>

{#if results.length}
  <section class="results">
    <h2>
      {results.length} results
      {#if capped}<span class="capnote">(capped at {results.length} — raise “min matches” to narrow)</span>{/if}
    </h2>
    <div class="scroll">
      <table>
        <thead>
          <tr><th title="pick for stash regex">✓</th><th>#</th><th>Variant</th><th>Seed</th><th>Socket</th><th>Score</th><th>Gives</th><th>Buy</th></tr>
        </thead>
        <tbody>
          {#each results as r, i (`${r.variant}-${r.socketId}-${r.seed}`)}
            <tr class:sel={isSel(r)} onclick={() => onselect?.(r)}>
              <td class="pick">
                <input
                  type="checkbox"
                  checked={pickedKeys.has(pickKey(r))}
                  onclick={(e) => e.stopPropagation()}
                  onchange={() => ontogglepick?.(r)}
                />
              </td>
              <td class="dim">{i + 1}</td>
              <td>{conquerors[r.variant]?.name ?? `#${r.variant}`}</td>
              <td class="mono">{r.seed}</td>
              <td class="socket" title={String(r.socketId)}>{socketNames[r.socketId] ?? `#${r.socketId}`}</td>
              <td class="score">{r.score}</td>
              <td class="gives">
                {#each r.breakdown as b (b.outcomeId)}
                  <span class="pill">{label(b.outcomeId)}{#if b.count > 1}<em>×{b.count}</em>{/if}</span>
                {/each}
              </td>
              <td>
                <a
                  class="trade"
                  href={tradeHref(r)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onclick={(e) => e.stopPropagation()}>trade ↗</a
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

<style>
  .results {
    margin-top: 1.25rem;
  }
  .capnote {
    font-size: 0.8rem;
    font-weight: 400;
    color: #d19a66;
    margin-left: 0.5rem;
  }
  .scroll {
    overflow-x: auto;
    border: 1px solid #333;
    border-radius: 8px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid #2a2a30;
    white-space: nowrap;
  }
  th {
    color: #aaa;
    position: sticky;
    top: 0;
    background: #17171b;
  }
  .mono {
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, monospace;
  }
  .socket {
    white-space: nowrap;
  }
  .pick {
    text-align: center;
    padding-right: 0.2rem;
  }
  .pick input {
    cursor: pointer;
  }
  .dim {
    color: #666;
  }
  .score {
    font-weight: 700;
    color: #7aa2f7;
  }
  .gives {
    white-space: normal;
  }
  .pill {
    display: inline-block;
    background: #222;
    border: 1px solid #383838;
    border-radius: 12px;
    padding: 0.05rem 0.5rem;
    margin: 0.1rem 0.2rem 0.1rem 0;
    font-size: 0.8rem;
  }
  .pill em {
    color: #999;
    font-style: normal;
    margin-left: 0.2rem;
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr:hover {
    background: #202028;
  }
  tbody tr.sel {
    background: #24303f;
  }
  .trade {
    color: #7aa2f7;
    text-decoration: none;
    white-space: nowrap;
  }
  .trade:hover {
    text-decoration: underline;
  }
</style>
