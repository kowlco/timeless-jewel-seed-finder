<script lang="ts">
  import { buildStashQuery, STASH_SEARCH_LIMIT, type SeedPick } from '../core/stashRegex';
  import { buildMultiTradeUrl } from '../core/trade';
  import type { Conqueror, JewelType } from '../core/types';

  let {
    picks,
    conquerors,
    jewel,
    league = 'Standard',
    onclear,
  }: {
    picks: SeedPick[];
    conquerors: Conqueror[];
    jewel: JewelType;
    league?: string;
    onclear?: () => void;
  } = $props();

  let matchConqueror = $state(true);
  let copied = $state(false);

  const names = $derived(conquerors.map((c) => c.name));
  const regex = $derived(buildStashQuery(picks, names, matchConqueror));
  const over = $derived(regex.length > STASH_SEARCH_LIMIT);
  const tradeUrl = $derived(picks.length ? buildMultiTradeUrl(jewel, picks, names, league) : '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(regex);
      copied = true;
      setTimeout(() => (copied = false), 1200);
    } catch {
      copied = false;
    }
  }
</script>

{#if picks.length}
  <section class="stash">
    <div class="head">
      <h3>Selected seeds <span class="count">· {picks.length} picked</span></h3>
      <div class="actions">
        <a class="trade" href={tradeUrl} target="_blank" rel="noopener noreferrer">trade all ↗</a>
        <button class="clear" onclick={() => onclear?.()}>clear</button>
      </div>
    </div>

    <div class="sub">
      <span class="lbl">Stash search regex</span>
      <label class="opt">
        <input type="checkbox" bind:checked={matchConqueror} />
        match conqueror (precise, but longer)
      </label>
    </div>

    <div class="box">
      <code class:over>{regex}</code>
      <button class="copy" onclick={copy}>{copied ? 'copied ✓' : 'copy'}</button>
    </div>

    <p class="len" class:over>
      {regex.length} / {STASH_SEARCH_LIMIT} chars
      {#if over}— over the in-game limit; deselect some seeds or turn off “match conqueror”.{/if}
    </p>
    <p class="hint">Paste into the in-game stash/inventory search. Filter to the jewel type first.</p>
  </section>
{/if}

<style>
  .stash {
    margin-top: 1rem;
    background: #1b1b1f;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 1rem;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .count {
    color: #888;
    font-weight: 400;
    font-size: 0.85rem;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .trade {
    color: #7aa2f7;
    text-decoration: none;
    font-size: 0.9rem;
    white-space: nowrap;
  }
  .trade:hover {
    text-decoration: underline;
  }
  .clear {
    background: none;
    border: 1px solid #444;
    border-radius: 6px;
    color: #aaa;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .sub {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    margin: 0.7rem 0 0.4rem;
    flex-wrap: wrap;
  }
  .lbl {
    color: #aaa;
    font-size: 0.85rem;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: #ccc;
    font-size: 0.85rem;
  }
  .box {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }
  code {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    white-space: nowrap;
    background: #111;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 0.5rem 0.6rem;
    font-family: ui-monospace, monospace;
    font-size: 0.9rem;
    color: #98c379;
  }
  code.over {
    color: #e06c75;
    border-color: #6b2b2f;
  }
  .copy {
    background: #7aa2f7;
    color: #000;
    border: none;
    border-radius: 6px;
    padding: 0 0.9rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .len {
    margin: 0.5rem 0 0.2rem;
    font-size: 0.8rem;
    color: #888;
  }
  .len.over {
    color: #e06c75;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: #666;
  }
</style>
