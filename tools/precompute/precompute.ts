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
import { SEED_RANGES, CONQUERORS, type JewelType, type Aggregate } from '../../src/core/types';
import { buildAggregate, encodeShard } from './shard';

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
  const jewel = Number(arg('jewel')) as JewelType;
  if (!jewel || jewel < 1 || jewel > 6) throw new Error('usage: precompute --jewel <1..6>');
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
  const altSkillMeta = new Map<number, { stats: number[]; keystone: boolean }>();
  for (const r of load('alternate_passive_skills.json') as RawRow[]) {
    altSkillMeta.set(r._index, {
      stats: r.StatsKeys ?? [],
      keystone: (r.PassiveType ?? []).includes(PassiveSkillType.KeyStone),
    });
  }
  const altAddStats = new Map<number, number[]>();
  for (const r of load('alternate_passive_additions.json') as RawRow[]) {
    altAddStats.set(r._index, r.StatsKeys ?? []);
  }

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

  const rows: Aggregate[] = [];
  let seedCount = 0;
  for (let s = range.min; s <= range.max; s += step) seedCount++;
  const totalRows = conquerors.length * sockets.length * seedCount;
  let done = 0;

  for (let vi = 0; vi < conquerors.length; vi++) {
    const conq = conquerors[vi];
    for (const socket of sockets) {
      const passives = socketPassives.get(socket)!;
      for (let seed = range.min; seed <= range.max; seed += step) {
        const outcomes: string[] = [];
        for (const pIdx of passives) {
          const info = calculate(pIdx, seed, jewel, conq, tables);
          if (info.skill !== null) {
            const meta = altSkillMeta.get(info.skill);
            outcomes.push(`${meta?.keystone ? 'keystone' : 'notable'}:${info.skill}`);
            for (const st of meta?.stats ?? []) outcomes.push(`stat:${st}`);
          }
          for (const add of info.additions) {
            outcomes.push(`add:${add.addition}`);
            for (const st of altAddStats.get(add.addition) ?? []) outcomes.push(`stat:${st}`);
          }
        }
        rows.push(buildAggregate(vi, socket, seed, outcomes));
        if (++done % 20000 === 0) console.log(`  ${done}/${totalRows} rows`);
      }
    }
  }

  const raw = encodeShard(rows);
  const gz = gzipSync(raw, { level: 9 });
  const outDir = resolve(ROOT, 'data/shards', version);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, `${jewel}.bin.gz`), gz);
  const meta = {
    jewel,
    treeVersion: version,
    variants: conquerors.length,
    sockets: sockets.length,
    seedCount,
    rows: rows.length,
    rawBytes: raw.length,
    gzBytes: gz.length,
  };
  writeFileSync(resolve(outDir, `${jewel}.meta.json`), JSON.stringify(meta, null, 2));
  console.log('done', JSON.stringify(meta));
}

main();
