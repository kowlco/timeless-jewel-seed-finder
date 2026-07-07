<script lang="ts">
  import type { SearchResult, JewelType, Conqueror } from '../core/types';
  import { loadTreeAssets } from '../data/browserData';
  import { calculate } from '../core/transform';
  import { nodesInRadius, nodeWorldPos, LARGE_RADIUS, type TreeData } from '../core/radius';
  import {
    isPassiveSkillValidForAlteration,
    getPassiveSkillType,
    PassiveSkillType,
    type Tables,
  } from '../core/tables';

  let {
    result,
    jewel,
    conqueror,
  }: {
    result: SearchResult | null;
    jewel: JewelType;
    conqueror: Conqueror | undefined;
  } = $props();

  interface DrawNode {
    x: number;
    y: number;
    kind: 'keystone' | 'notable' | 'stat' | 'plain';
    label?: string;
  }

  let canvas: HTMLCanvasElement | undefined = $state();
  const SIZE = 520;

  function classify(
    tables: Tables,
    tree: TreeData,
    names: Map<number, string>,
    r: SearchResult,
    conq: Conqueror,
  ): DrawNode[] {
    const g2i = new Map<number, number>();
    for (const p of tables.passiveByIndex.values()) g2i.set(p.graphId, p.index);
    const out: DrawNode[] = [];
    for (const nodeId of nodesInRadius(r.socketId, tree)) {
      const node = tree.nodes[String(nodeId)];
      if (!node) continue;
      const { x, y } = nodeWorldPos(node, tree);
      const idx = g2i.get(nodeId);
      const passive = idx === undefined ? undefined : tables.passiveByIndex.get(idx);
      if (!passive || !isPassiveSkillValidForAlteration(passive)) {
        out.push({ x, y, kind: 'plain' });
        continue;
      }
      const info = calculate(idx!, r.seed, jewel, conq, tables);
      if (info.skill !== null) {
        const t = getPassiveSkillType(passive);
        if (t === PassiveSkillType.KeyStone)
          out.push({ x, y, kind: 'keystone', label: names.get(info.skill) });
        else if (t === PassiveSkillType.Notable)
          out.push({ x, y, kind: 'notable', label: names.get(info.skill) });
        else out.push({ x, y, kind: 'stat' });
      } else {
        out.push({ x, y, kind: info.additions.length ? 'stat' : 'plain' });
      }
    }
    return out;
  }

  const COLORS = { keystone: '#e5c07b', notable: '#7aa2f7', stat: '#98c379', plain: '#4a4a52' };

  function draw(nodes: DrawNode[], center: { x: number; y: number }) {
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const margin = 24;
    const scale = (SIZE / 2 - margin) / LARGE_RADIUS;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const tx = (x: number) => cx + (x - center.x) * scale;
    const ty = (y: number) => cy + (y - center.y) * scale;

    // radius circle
    ctx.strokeStyle = '#3a3a44';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, LARGE_RADIUS * scale, 0, Math.PI * 2);
    ctx.stroke();

    // plain first, then highlighted on top
    const order: DrawNode['kind'][] = ['plain', 'stat', 'notable', 'keystone'];
    for (const kind of order) {
      for (const n of nodes) {
        if (n.kind !== kind) continue;
        const rad = kind === 'keystone' ? 6 : kind === 'notable' ? 4.5 : kind === 'stat' ? 2.5 : 1.8;
        ctx.fillStyle = COLORS[kind];
        ctx.beginPath();
        ctx.arc(tx(n.x), ty(n.y), rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // socket marker
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();

    // labels for keystones/notables
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const n of nodes) {
      if ((n.kind === 'keystone' || n.kind === 'notable') && n.label) {
        ctx.fillStyle = COLORS[n.kind];
        ctx.fillText(n.label, tx(n.x) + 7, ty(n.y));
      }
    }
  }

  $effect(() => {
    const r = result;
    const conq = conqueror;
    if (!r || !conq || !canvas) return;
    loadTreeAssets().then(({ tables, tree, altSkillNames }) => {
      if (result !== r) return; // superseded
      const socket = tree.nodes[String(r.socketId)];
      const center = nodeWorldPos(socket, tree);
      const nodes = classify(tables, tree, altSkillNames, r, conq);
      draw(nodes, center);
    });
  });
</script>

{#if result}
  <section class="tv">
    <div class="legend">
      <span class="k keystone">keystone</span>
      <span class="k notable">notable</span>
      <span class="k stat">stat/augment</span>
      <span class="k plain">unaffected</span>
    </div>
    <canvas bind:this={canvas} style="width:{SIZE}px;height:{SIZE}px"></canvas>
  </section>
{/if}

<style>
  .tv {
    margin-top: 1rem;
    background: #16161a;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 1rem;
    display: inline-block;
  }
  canvas {
    display: block;
    background: #0d0d10;
    border-radius: 8px;
  }
  .legend {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.6rem;
    font-size: 0.75rem;
  }
  .k::before {
    content: '';
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    margin-right: 0.3rem;
    vertical-align: middle;
  }
  .k.keystone::before {
    background: #e5c07b;
  }
  .k.notable::before {
    background: #7aa2f7;
  }
  .k.stat::before {
    background: #98c379;
  }
  .k.plain::before {
    background: #4a4a52;
  }
</style>
