<script lang="ts">
  import type { SearchResult, JewelType, Conqueror } from '../core/types';
  import { loadTreeAssets } from '../data/browserData';
  import { calculate } from '../core/transform';
  import { nodesInRadius, nodeWorldPos, orbitAngleAt, LARGE_RADIUS } from '../core/radius';
  import {
    isPassiveSkillValidForAlteration,
    getPassiveSkillType,
    PassiveSkillType,
  } from '../core/tables';

  let {
    result,
    jewel,
    conqueror,
    socketName,
  }: {
    result: SearchResult | null;
    jewel: JewelType;
    conqueror: Conqueror | undefined;
    socketName?: string;
  } = $props();

  type Kind = 'keystone' | 'notable' | 'stat' | 'plain';
  interface VNode {
    id: number;
    wx: number;
    wy: number;
    group?: number;
    orbit?: number;
    orbitIndex?: number;
    out: number[];
    icon?: string;
    iconCat: string;
    frame: string;
    kind: Kind;
    highlight: boolean;
    title: string;
    lines: string[];
  }

  const SIZE = 520;
  const FRAME = { keystone: 54, notable: 40, stat: 22, plain: 20 };
  const ICON = { keystone: 34, notable: 25, stat: 13, plain: 12 };
  const RING = { keystone: '#e5c07b', notable: '#7aa2f7', stat: '#98c379', plain: '#4a4a52' };

  let canvas: HTMLCanvasElement | undefined = $state();
  let tip = $state<{ x: number; y: number; node: VNode } | null>(null);

  let vnodes: VNode[] = [];
  let vmap = new Map<number, VNode>();
  let hit: { px: number; py: number; r: number; v: VNode }[] = [];
  let center = { x: 0, y: 0 };
  let lastAssets: Awaited<ReturnType<typeof loadTreeAssets>> | null = null;
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
    const statLine = (key: number, val: number) => {
      const t = statNames.get(key) ?? `#${key}`;
      return t.includes('#') ? t.replace('#', String(val)) : `${t}: ${val}`;
    };

    const out: VNode[] = [];
    for (const nodeId of nodesInRadius(r.socketId, tree)) {
      const node = tree.nodes[String(nodeId)];
      if (!node) continue;
      const pos = nodeWorldPos(node, tree);
      const name = node.name ?? `#${nodeId}`;
      const outIds = (node.out ?? []).map(Number);
      const idx = g2i.get(nodeId);
      const passive = idx === undefined ? undefined : tables.passiveByIndex.get(idx);
      const base = {
        id: nodeId,
        wx: pos.x,
        wy: pos.y,
        group: node.group,
        orbit: node.orbit,
        orbitIndex: node.orbitIndex,
        out: outIds,
      };

      if (!passive || !isPassiveSkillValidForAlteration(passive)) {
        out.push({
          ...base,
          icon: node.icon,
          iconCat: 'normalActive',
          frame: 'PSSkillFrameActive',
          kind: 'plain',
          highlight: false,
          title: name,
          lines: node.stats ?? [],
        });
        continue;
      }
      const info = calculate(idx!, r.seed, jewel, conq, tables);
      const lines: string[] = [];
      let kind: Kind = 'stat';
      let iconCat = 'normalActive';
      let frame = 'PSSkillFrameActive';
      let highlight = false;

      if (info.skill !== null) {
        const alt = altById.get(info.skill);
        const to = altSkillNames.get(info.skill) ?? `#${info.skill}`;
        const t = getPassiveSkillType(passive);
        if (t === PassiveSkillType.KeyStone) {
          kind = 'keystone';
          iconCat = 'keystoneActive';
          frame = 'KeystoneFrameAllocated';
          highlight = true;
        } else if (t === PassiveSkillType.Notable) {
          kind = 'notable';
          iconCat = 'notableActive';
          frame = 'NotableFrameAllocated';
          highlight = true;
        }
        lines.push(`→ ${to}`);
        if (alt) info.statRolls.forEach((v, i) => lines.push(statLine(alt.statsKeys[i], v)));
      }
      for (const add of info.additions) {
        const a = addById.get(add.addition);
        if (a) add.statRolls.forEach((v, i) => lines.push('+ ' + statLine(a.statsKeys[i], v)));
      }
      out.push({ ...base, icon: node.icon, iconCat, frame, kind, highlight, title: name, lines });
    }
    return out;
  }

  function draw() {
    const ctx = canvas?.getContext('2d');
    const assets = lastAssets;
    if (!ctx || !canvas || !assets) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#080c11';
    ctx.fillRect(0, 0, SIZE, SIZE);

    const margin = 34;
    const scale = (SIZE / 2 - margin) / LARGE_RADIUS;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const tx = (x: number) => cx + (x - center.x) * scale;
    const ty = (y: number) => cy + (y - center.y) * scale;
    const { orbitRadii, skillsPerOrbit } = assets.tree.constants;

    // connections (under nodes)
    ctx.strokeStyle = '#524518';
    ctx.lineWidth = 3.5;
    const done = new Set<string>();
    for (const n of vnodes) {
      for (const oid of n.out) {
        const t = vmap.get(oid);
        if (!t) continue;
        const key = Math.min(n.id, oid) + ':' + Math.max(n.id, oid);
        if (done.has(key)) continue;
        done.add(key);
        ctx.beginPath();
        if (n.group !== t.group || n.orbit !== t.orbit || n.orbit === undefined) {
          ctx.moveTo(tx(n.wx), ty(n.wy));
          ctx.lineTo(tx(t.wx), ty(t.wy));
        } else {
          const g = assets.tree.groups[String(n.group)];
          const toA = (deg: number) => Math.PI / 180 - (Math.PI / 180) * deg - Math.PI / 2;
          const a = toA(orbitAngleAt(n.orbit!, n.orbitIndex!, skillsPerOrbit));
          const b = toA(orbitAngleAt(t.orbit!, t.orbitIndex!, skillsPerOrbit));
          const diff = Math.abs(Math.max(a, b) - Math.min(a, b));
          const fa = diff > Math.PI ? Math.max(a, b) : Math.min(a, b);
          const fb = diff > Math.PI ? Math.min(a, b) : Math.max(a, b);
          ctx.arc(tx(g.x), ty(g.y), orbitRadii[n.orbit!] * scale + 1, fa, fb);
        }
        ctx.stroke();
      }
    }

    // radius circle
    ctx.strokeStyle = '#2f2a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, LARGE_RADIUS * scale, 0, Math.PI * 2);
    ctx.stroke();

    // nodes: plain/stat first, highlighted on top
    hit = [];
    const order: Kind[] = ['plain', 'stat', 'notable', 'keystone'];
    const frameSheetUrl = assets.tree.sprites?.frame?.filename;
    for (const kind of order) {
      for (const n of vnodes) {
        if (n.kind !== kind) continue;
        const px = tx(n.wx);
        const py = ty(n.wy);
        const fsize = FRAME[kind];
        const isize = ICON[kind];

        // glow for highlighted
        if (n.highlight) {
          ctx.beginPath();
          ctx.fillStyle = kind === 'keystone' ? 'rgba(229,192,123,0.18)' : 'rgba(122,162,247,0.18)';
          ctx.arc(px, py, fsize * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }

        // frame
        const fc = assets.tree.sprites?.frame?.coords?.[n.frame];
        const fimg = fc && frameSheetUrl ? sheet(frameSheetUrl) : undefined;
        if (fimg && fc)
          ctx.drawImage(fimg, fc.x, fc.y, fc.w, fc.h, px - fsize / 2, py - fsize / 2, fsize, fsize);

        // icon
        const iSheet = assets.tree.sprites?.[n.iconCat];
        const ic = n.icon ? iSheet?.coords?.[n.icon] : undefined;
        const iimg = ic && iSheet ? sheet(iSheet.filename) : undefined;
        if (iimg && ic)
          ctx.drawImage(iimg, ic.x, ic.y, ic.w, ic.h, px - isize / 2, py - isize / 2, isize, isize);
        else {
          ctx.fillStyle = RING[kind];
          ctx.beginPath();
          ctx.arc(px, py, isize / 3, 0, Math.PI * 2);
          ctx.fill();
        }
        hit.push({ px, py, r: Math.max(fsize / 2, 9), v: n });
      }
    }

    // socket marker
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  function onMove(e: MouseEvent) {
    const rect = canvas!.getBoundingClientRect();
    const sx = SIZE / rect.width;
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top) * sx;
    let best: (typeof hit)[number] | null = null;
    let bestD = Infinity;
    for (const h of hit) {
      const d = (h.px - mx) ** 2 + (h.py - my) ** 2;
      if (d < h.r * h.r && d < bestD) {
        bestD = d;
        best = h;
      }
    }
    tip = best ? { x: mx / sx, y: my / sx, node: best.v } : null;
  }

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
      vmap = new Map(vnodes.map((v) => [v.id, v]));
      draw();
    });
  });
</script>

{#if result}
  <section class="tv">
    <div class="legend">
      {#if socketName}<span class="socket-name">{socketName}</span>{/if}
      <span class="k keystone">keystone</span>
      <span class="k notable">notable</span>
      <span class="k stat">stat / augment</span>
      <span class="dim">hover a node</span>
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
          style="left:{Math.min(tip.x + 14, SIZE - 230)}px;top:{Math.min(tip.y + 8, SIZE - 40)}px"
        >
          <strong>{tip.node.title}</strong>
          {#each tip.node.lines as l (l)}<div class="tl" class:to={l.startsWith('→')}>{l}</div>{/each}
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
    background: #080c11;
    border-radius: 8px;
    max-width: 100%;
    height: auto;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 0.6rem;
    font-size: 0.75rem;
    align-items: center;
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
  .dim {
    color: #777;
  }
  .socket-name {
    font-weight: 600;
    color: #eee;
    margin-right: 0.25rem;
  }
  .tooltip {
    position: absolute;
    pointer-events: none;
    max-width: 240px;
    background: #000e;
    border: 1px solid #555;
    border-radius: 6px;
    padding: 0.4rem 0.55rem;
    font-size: 0.78rem;
    line-height: 1.4;
    z-index: 10;
  }
  .tooltip strong {
    color: #eee;
  }
  .tl {
    color: #bbb;
  }
  .tl.to {
    color: #e5c07b;
    font-weight: 600;
  }
  .tl.dim {
    color: #777;
  }
</style>
