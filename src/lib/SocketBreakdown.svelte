<script lang="ts">
  import type { SearchResult, JewelType, Conqueror } from '../core/types';
  import { loadTreeAssets } from '../data/browserData';
  import { calculate } from '../core/transform';
  import { nodesInRadius } from '../core/radius';
  import { isPassiveSkillValidForAlteration, getPassiveSkillType, PassiveSkillType } from '../core/tables';

  let {
    result,
    jewel,
    conqueror,
  }: {
    result: SearchResult | null;
    jewel: JewelType;
    conqueror: Conqueror | undefined;
  } = $props();

  interface Line {
    from: string;
    to: string;
    kind: 'keystone' | 'notable' | 'small';
  }
  let lines = $state<Line[]>([]);
  let additions = $state(0);
  let status = $state<'idle' | 'loading' | 'error'>('idle');
  let err = $state('');

  $effect(() => {
    const r = result;
    const conq = conqueror;
    if (!r || !conq) {
      lines = [];
      additions = 0;
      return;
    }
    status = 'loading';
    loadTreeAssets()
      .then(({ tables, tree, altSkillNames, graphToNode }) => {
        const g2i = new Map<number, number>();
        for (const p of tables.passiveByIndex.values()) g2i.set(p.graphId, p.index);

        const out: Line[] = [];
        let adds = 0;
        for (const nodeId of nodesInRadius(r.socketId, tree)) {
          const idx = g2i.get(nodeId);
          if (idx === undefined) continue;
          const passive = tables.passiveByIndex.get(idx);
          if (!isPassiveSkillValidForAlteration(passive)) continue;
          const info = calculate(idx, r.seed, jewel, conq, tables);
          adds += info.additions.length;
          if (info.skill !== null) {
            const type = getPassiveSkillType(passive!);
            if (type === PassiveSkillType.KeyStone || type === PassiveSkillType.Notable) {
              out.push({
                from: graphToNode.get(nodeId)?.name ?? `#${nodeId}`,
                to: altSkillNames.get(info.skill) ?? `#${info.skill}`,
                kind: type === PassiveSkillType.KeyStone ? 'keystone' : 'notable',
              });
            }
          }
        }
        out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'keystone' ? -1 : 1));
        lines = out;
        additions = adds;
        status = 'idle';
      })
      .catch((e) => {
        status = 'error';
        err = String(e);
      });
  });
</script>

{#if result}
  <section class="bd">
    <h3>Socket {result.socketId} · seed {result.seed} · {conqueror?.name}</h3>
    {#if status === 'loading'}
      <p class="dim">loading tree…</p>
    {:else if status === 'error'}
      <p class="err">{err}</p>
    {:else}
      {#if lines.length}
        <ul>
          {#each lines as l (l.from + l.to)}
            <li>
              <span class="kind {l.kind}">{l.kind}</span>
              <span class="from">{l.from}</span>
              <span class="arrow">→</span>
              <span class="to">{l.to}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="dim">No notable/keystone transforms in this socket.</p>
      {/if}
      {#if additions}<p class="dim">+ {additions} stat additions across the radius.</p>{/if}
    {/if}
  </section>
{/if}

<style>
  .bd {
    margin-top: 1rem;
    background: #1b1b1f;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 1rem;
  }
  h3 {
    margin: 0 0 0.6rem;
    font-size: 1rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  .kind {
    min-width: 66px;
    font-size: 0.7rem;
    text-transform: uppercase;
    color: #888;
  }
  .kind.keystone {
    color: #e5c07b;
  }
  .kind.notable {
    color: #7aa2f7;
  }
  .from {
    color: #999;
  }
  .arrow {
    color: #555;
  }
  .to {
    font-weight: 600;
  }
  .dim {
    color: #888;
  }
  .err {
    color: #e06c75;
  }
</style>
