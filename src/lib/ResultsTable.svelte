<script lang="ts">
  import type { SearchResult, Conqueror } from '../core/types';

  let {
    results,
    labels,
    conquerors,
  }: {
    results: SearchResult[];
    labels: Record<string, string>;
    conquerors: Conqueror[];
  } = $props();

  const label = (id: string) => labels[id] ?? id;
</script>

{#if results.length}
  <section class="results">
    <h2>{results.length} results</h2>
    <div class="scroll">
      <table>
        <thead>
          <tr><th>#</th><th>Variant</th><th>Seed</th><th>Socket</th><th>Score</th><th>Gives</th></tr>
        </thead>
        <tbody>
          {#each results as r, i (`${r.variant}-${r.socketId}-${r.seed}`)}
            <tr>
              <td class="dim">{i + 1}</td>
              <td>{conquerors[r.variant]?.name ?? `#${r.variant}`}</td>
              <td class="mono">{r.seed}</td>
              <td class="mono">{r.socketId}</td>
              <td class="score">{r.score}</td>
              <td class="gives">
                {#each r.breakdown as b (b.outcomeId)}
                  <span class="pill">{label(b.outcomeId)}{#if b.count > 1}<em>×{b.count}</em>{/if}</span>
                {/each}
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
</style>
