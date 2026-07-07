<script lang="ts">
  import type { SearchResult, JewelType, Conqueror } from '../core/types';
  import { loadTreeAssets } from '../data/browserData';
  import { calculate } from '../core/transform';
  import { nodesInRadius, nodeWorldPos, LARGE_RADIUS } from '../core/radius';
  import {
    isPassiveSkillValidForAlteration,
    getPassiveSkillType,
    PassiveSkillType,
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

  type Kind = 'keystone' | 'notable' | 'stat' | 'plain';
  interface VNode {
    wx: number;
    wy: number;
    icon?: string;
    cat: string;
    kind: Kind;
    label?: string;
    title: string;
    lines: string[];
  }

  const SIZE = 520;
  const COLORS: Record<Kind, string> = {
    keystone: '#e5c07b',
    notable: '#7aa2f7',
    stat: '#98c379',
    plain: '#4a4a52',
  };
  const ICON_SIZE: Record<Kind, number> = { keystone: 30, notable: 24, stat: 15, plain: 12 };

  let canvas: HTMLCanvasElement | undefined = $state();
  let tip = $state<{ x: number; y: number; node: VNode } | null>(null);

  let vnodes: VNode[] = [];
  let hit: { px: number; py: number; r: number; v: VNode }[] = [];
  let center = { x: 0, y: 0 };
  const sheets = new Map<string, HTMLImageElement>();

  function sheet(url: string): HTMLImageElement | undefined {
    let img = sheets.get(url);
    if (!img) {
      img = new Image();
      img.onload = () => draw();
      img.src = url;
      sheets.set(url, img);
      return undefined;
    }
    return img.complete && img.naturalWidth > 0 ? img : undefined;
  }

  function build(assets: Awaited<ReturnType<typeof loadTreeAssets>>, r: SearchResult, conq: Conqueror) {
    const { tables, tree, altSkillNames, statNames } = assets;
    const g2i = new Map<number, number>();
    for (const p of tables.passiveByIndex.values()) g2i.set(p.graphId, p.index);
    const altById = new Map(tables.allAltSkills.map((s) => [s.index, s]));
    const addById = new Map(tables.allAltAdditions.map((a) => [a.index, a]));
    const statLine = (key: number, val: number) => `${statNames.get(key) ?? '#' + key}: ${val}`;

    const out: VNode[] = [];
    for (const nodeId of nodesInRadius(r.socketId, tree)) {
      const node = tree.nodes[String(nodeId)];
      if (!node) continue;
      const { x, y } = nodeWorldPos(node, tree);
      const name = node.name ?? `#${nodeId}`;
      const idx = g2i.get(nodeId);
      const passive = idx === undefined ? undefined : tables.passiveByIndex.get(idx);

      if (!passive || !isPassiveSkillValidForAlteration(passive)) {
        out.push({ wx: x, wy: y, icon: node.icon, cat: 'normalActive', kind: 'plain', title: name, lines: node.stats ?? [] });
        continue;
      }
      const info = calculate(idx!, r.seed, jewel, conq, tables);
      const lines: string[] = [];
      let kind: Kind = 'stat';
      let label: string | undefined;
      let cat = 'normalActive';

      if (info.skill !== null) {
        const alt = altById.get(info.skill);
        const to = altSkillNames.get(info.skill) ?? `#${info.skill}`;
        const t = getPassiveSkillType(passive);
        if (t === PassiveSkillType.KeyStone) {
          kind = 'keystone';
          cat = 'keystoneActive';
        } else if (t === PassiveSkillType.Notable) {
          kind = 'notable';
          cat = 'notableActive';
        } else kind = 'stat';
        if (kind !== 'stat') label = to;
        lines.push(`→ ${to}`);
        if (alt) info.statRolls.forEach((v, i) => lines.push(statLine(alt.statsKeys[i], v)));
      }
      for (const add of info.additions) {
        const a = addById.get(add.addition);
        if (a) add.statRolls.forEach((v, i) => lines.push('+ ' + statLine(a.statsKeys[i], v)));
      }
      out.push({ wx: x, wy: y, icon: node.icon, cat, kind, label, title: name, lines });
    }
    return out;
  }

  function draw() {
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const margin = 30;
    const scale = (SIZE / 2 - margin) / LARGE_RADIUS;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const tx = (x: number) => cx + (x - center.x) * scale;
    const ty = (y: number) => cy + (y - center.y) * scale;

    ctx.strokeStyle = '#3a3a44';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, LARGE_RADIUS * scale, 0, Math.PI * 2);
    ctx.stroke();

    const assets = lastAssets;
    hit = [];
    const order: Kind[] = ['plain', 'stat', 'notable', 'keystone'];
    for (const kind of order) {
      for (const n of vnodes) {
        if (n.kind !== kind) continue;
        const px = tx(n.wx);
        const py = ty(n.wy);
        const size = ICON_SIZE[kind];
        const coord = n.icon ? assets?.tree.sprites?.[n.cat]?.coords?.[n.icon] : undefined;
        const url = assets?.tree.sprites?.[n.cat]?.filename;
        const img = coord && url ? sheet(url) : undefined;
        if (img && coord) {
          ctx.drawImage(img, coord.x, coord.y, coord.w, coord.h, px - size / 2, py - size / 2, size, size);
        } else {
          ctx.fillStyle = COLORS[kind];
          ctx.beginPath();
          ctx.arc(px, py, size / 3, 0, Math.PI * 2);
          ctx.fill();
        }
        if (kind === 'keystone' || kind === 'notable') {
          ctx.strokeStyle = COLORS[kind];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, size / 2 + 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        hit.push({ px, py, r: Math.max(size / 2, 8), v: n });
      }
    }

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const n of vnodes) {
      if ((n.kind === 'keystone' || n.kind === 'notable') && n.label) {
        ctx.fillStyle = COLORS[n.kind];
        ctx.fillText(n.label, tx(n.wx) + ICON_SIZE[n.kind] / 2 + 3, ty(n.wy));
      }
    }
  }

  function onMove(e: MouseEvent) {
    const rect = canvas!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: (typeof hit)[number] | null = null;
    let bestD = Infinity;
    for (const h of hit) {
      const d = (h.px - mx) ** 2 + (h.py - my) ** 2;
      if (d < h.r * h.r && d < bestD) {
        bestD = d;
        best = h;
      }
    }
    tip = best ? { x: mx, y: my, node: best.v } : null;
  }

  let lastAssets: Awaited<ReturnType<typeof loadTreeAssets>> | null = null;

  $effect(() => {
    const r = result;
    const conq = conqueror;
    if (!r || !conq || !canvas) return;
    tip = null;
    loadTreeAssets().then((assets) => {
      if (result !== r) return;
      lastAssets = assets;
      const socket = assets.tree.nodes[String(r.socketId)];
      center = nodeWorldPos(socket, assets.tree);
      vnodes = build(assets, r, conq);
      draw();
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
    <div class="canvas-wrap">
      <canvas
        bind:this={canvas}
        style="width:{SIZE}px;height:{SIZE}px"
        onmousemove={onMove}
        onmouseleave={() => (tip = null)}
      ></canvas>
      {#if tip}
        <div
          class="tooltip"
          style="left:{Math.min(tip.x + 12, SIZE - 220)}px;top:{Math.min(tip.y + 12, SIZE - 20)}px"
        >
          <strong>{tip.node.title}</strong>
          {#each tip.node.lines as l (l)}<div class="tl">{l}</div>{/each}
          {#if tip.node.lines.length === 0}<div class="tl dim">unchanged</div>{/if}
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  .tv {
    margin-top: 1rem;
    background: #16161a;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 1rem;
  }
  .canvas-wrap {
    position: relative;
    width: 520px;
    max-width: 100%;
  }
  canvas {
    display: block;
    background: #0d0d10;
    border-radius: 8px;
    max-width: 100%;
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
  .tooltip {
    position: absolute;
    pointer-events: none;
    max-width: 240px;
    background: #000d;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 0.4rem 0.55rem;
    font-size: 0.78rem;
    line-height: 1.35;
    z-index: 10;
  }
  .tooltip strong {
    color: #eee;
  }
  .tl {
    color: #bbb;
  }
  .tl.dim {
    color: #777;
  }
</style>
