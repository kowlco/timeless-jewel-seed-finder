// Precompute one jewel's shard: for every (variant, socket, seed), tally the
// transformation outcomes across the nodes in the socket's radius.
// Usage: npm run precompute -- --jewel 3 [--maxSockets N]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { loadTables, calculate } from '../../src/core/transform';
import { nodesInRadius, type TreeData } from '../../src/core/radius';
import { isPassiveSkillValidForAlteration, PassiveSkillType } from '../../src/core/tables';
import { SEED_RANGES, CONQUERORS, type JewelType } from '../../src/core/types';
import { ShardEncoder } from './shard';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface RawRow {
  _index: number;
  PassiveSkillGraphId?: number;
  StatsKeys?: number[];
  PassiveType?: number[];
}

function main() {
  const jewelArg = arg('jewel');
  if (jewelArg === 'all') {
    for (let j = 1; j <= 6; j++) runJewel(j as JewelType);
    return;
  }
  const jewel = Number(jewelArg) as JewelType;
  if (!jewel || jewel < 1 || jewel > 6) throw new Error('usage: precompute --jewel <1..6|all>');
  runJewel(jewel);
}

function runJewel(jewel: JewelType) {
  const maxSockets = arg('maxSockets') ? Number(arg('maxSockets')) : Infinity;

  const version = JSON.parse(readFileSync(resolve(ROOT, 'data/current.json'), 'utf8')).treeVersion as string;
  const dataDir = resolve(ROOT, 'data', version);
  const load = (f: string) => JSON.parse(readFileSync(resolve(dataDir, f), 'utf8'));

  const tables = loadTables(dataDir);
  const tree = load('tree.json') as TreeData;

  // graphId -> passive index; alt skill/addition -> stat keys + keystone flag.
  const graphToIndex = new Map<number, number>();
  for (const r of load('passive_skills.json') as RawRow[]) {
    if (r.PassiveSkillGraphId !== undefined) graphToIndex.set(r.PassiveSkillGraphId, r._index);
  }
  const altSkillMeta = new Map<
    number,
    { stats: number[]; kind: 'keystone' | 'notable' | 'small'; name: string }
  >();
  for (const r of load('alternate_passive_skills.json') as (RawRow & { Name?: string })[]) {
    const pt = r.PassiveType ?? [];
    const kind = pt.includes(PassiveSkillType.KeyStone)
      ? 'keystone'
      : pt.includes(PassiveSkillType.Notable)
        ? 'notable'
        : 'small';
    altSkillMeta.set(r._index, { stats: r.StatsKeys ?? [], kind, name: r.Name ?? '' });
  }
  const altAddStats = new Map<number, number[]>();
  for (const r of load('alternate_passive_additions.json') as RawRow[]) {
    altAddStats.set(r._index, r.StatsKeys ?? []);
  }
  const statId = new Map<number, string>();
  for (const r of load('stats.json') as { _index: number; Id: string }[]) statId.set(r._index, r.Id);

  // Valid transformable passive indices per socket (radius is seed/variant independent).
  const sockets = tree.jewelSlots.slice(0, maxSockets);
  const socketPassives = new Map<number, number[]>();
  for (const socket of sockets) {
    const valid: number[] = [];
    for (const graphId of nodesInRadius(socket, tree)) {
      const idx = graphToIndex.get(graphId);
      if (idx === undefined) continue;
      if (isPassiveSkillValidForAlteration(tables.passiveByIndex.get(idx))) valid.push(idx);
    }
    socketPassives.set(socket, valid);
  }

  const range = SEED_RANGES[jewel];
  const step = range.special ? 20 : 1;
  const conquerors = CONQUERORS[jewel];

  let seedCount = 0;
  for (let s = range.min; s <= range.max; s += step) seedCount++;
  const totalRows = conquerors.length * sockets.length * seedCount;
  let done = 0;

  const encoder = new ShardEncoder();
  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);

  for (let vi = 0; vi < conquerors.length; vi++) {
    const conq = conquerors[vi];
    for (const socket of sockets) {
      const passives = socketPassives.get(socket)!;
      for (let seed = range.min; seed <= range.max; seed += step) {
        counts.clear();
        for (const pIdx of passives) {
          const info = calculate(pIdx, seed, jewel, conq, tables);
          if (info.skill !== null) {
            const meta = altSkillMeta.get(info.skill);
            if (meta?.kind === 'keystone') bump(`keystone:${info.skill}`);
            else if (meta?.kind === 'notable') bump(`notable:${info.skill}`);
            // Replaced small passive → target by the stats it grants.
            else for (const st of meta?.stats ?? []) bump(`stat:${st}`);
          }
          for (const add of info.additions) {
            // Augment additions: users target the added stats.
            for (const st of altAddStats.get(add.addition) ?? []) bump(`stat:${st}`);
          }
        }
        encoder.addRow(vi, socket, seed, counts);
        if (++done % 20000 === 0) console.log(`  ${done}/${totalRows} rows`);
      }
    }
  }

  const raw = encoder.finish();
  const gz = gzipSync(raw, { level: 9 });
  const outDir = resolve(ROOT, 'public/shards', version);
  mkdirSync(outDir, { recursive: true });
  // Extension is deliberately NOT `.gz`: a `.gz` name makes static servers set
  // Content-Encoding: gzip, which the browser transparently decompresses — then our
  // manual DecompressionStream would double-decompress. `.bin` holds the gzip bytes.
  writeFileSync(resolve(outDir, `${jewel}.bin`), gz);
  const meta = {
    jewel,
    treeVersion: version,
    variants: conquerors.length,
    sockets: sockets.length,
    seedCount,
    rows: totalRows,
    rawBytes: raw.length,
    gzBytes: gz.length,
  };
  writeFileSync(resolve(outDir, `${jewel}.meta.json`), JSON.stringify(meta, null, 2));

  // Label catalog for the target picker: every outcome id in this jewel's dictionary.
  const labels: Record<string, string> = {};
  for (const id of encoder.getDict()) {
    const sep = id.indexOf(':');
    const kind = id.slice(0, sep);
    const n = Number(id.slice(sep + 1));
    if (kind === 'notable' || kind === 'keystone') labels[id] = altSkillMeta.get(n)?.name || id;
    else if (kind === 'stat') labels[id] = statId.get(n) || id;
    else labels[id] = id;
  }
  writeFileSync(resolve(outDir, `${jewel}.labels.json`), JSON.stringify(labels));
  console.log('done', JSON.stringify(meta));
}

main();
