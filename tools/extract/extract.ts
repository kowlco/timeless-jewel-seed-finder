// Build-time extractor: official GGG tree + self-extracted .dat transformation
// tables (via pathofexile-dat public API, read positionally). Writes committed
// assets under data/<treeVersion>/ so the site build is hermetic.
//
// Usage: npm run extract -- --patch 3.28.0.14.3 --tree 3.28.0
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
import {
  loadDatModule,
  createLoader,
  fetchSchema,
  selectTable,
  readTable,
  SCHEMA_URL,
  type SchemaTable,
} from './dat-lib';

const POE1 = 1; // schema validFor bit

interface Args {
  patch: string;
  tree: string;
}
function parseArgs(argv: string[]): Args {
  const m = new Map<string, string>();
  for (let i = 2; i < argv.length; i += 2) m.set(argv[i].replace(/^--/, ''), argv[i + 1]);
  const patch = m.get('patch');
  const tree = m.get('tree');
  if (!patch || !tree) throw new Error('usage: extract --patch <a.b.c.d> --tree <a.b.c>');
  return { patch, tree };
}

// Positional rows keyed by schema column name, or `c<i>` when unnamed.
function rowsFromTable(
  table: SchemaTable,
  read: { rowCount: number; columns: unknown[][] },
): Record<string, unknown>[] {
  const keys = table.columns.map((c, i) => c.name || `c${i}`);
  const out: Record<string, unknown>[] = [];
  for (let r = 0; r < read.rowCount; r++) {
    const row: Record<string, unknown> = { _index: r };
    for (let c = 0; c < keys.length; c++) row[keys[c]] = read.columns[c][r];
    out.push(row);
  }
  return out;
}

// AlternateTreeVersions column mapping — verified (see extraction-findings note).
interface AtvRow {
  Index: number;
  Id: string;
  AreSmallAttributePassiveSkillsReplaced: boolean;
  AreSmallNormalPassiveSkillsReplaced: boolean;
  MinimumAdditions: number;
  MaximumAdditions: number;
  NotableReplacementSpawnWeight: number;
}
function normalizeAtv(read: { rowCount: number; columns: unknown[][] }): AtvRow[] {
  const rows: AtvRow[] = [];
  for (let r = 0; r < read.rowCount; r++) {
    rows.push({
      Index: r,
      Id: read.columns[0][r] as string,
      AreSmallAttributePassiveSkillsReplaced: read.columns[1][r] as boolean,
      AreSmallNormalPassiveSkillsReplaced: read.columns[2][r] as boolean,
      MinimumAdditions: read.columns[5][r] as number,
      MaximumAdditions: read.columns[6][r] as number,
      NotableReplacementSpawnWeight: read.columns[9][r] as number,
    });
  }
  return rows;
}

interface RawTreeNode {
  skill?: number;
  name?: string;
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  group?: number;
  orbit?: number;
  orbitIndex?: number;
  stats?: string[];
  icon?: string;
  expansionJewel?: unknown; // present on cluster sockets — excluded from timeless slots
}

interface SpriteSheet {
  filename: string;
  coords: Record<string, { x: number; y: number; w: number; h: number }>;
}
function normalizeTree(raw: {
  nodes: Record<string, RawTreeNode>;
  groups: Record<string, { x: number; y: number }>;
  jewelSlots: number[];
  constants: { orbitRadii: number[]; skillsPerOrbit: number[] };
  sprites: Record<string, Record<string, SpriteSheet>>;
}) {
  const nodes: Record<string, RawTreeNode> = {};
  for (const [id, n] of Object.entries(raw.nodes)) {
    if (n.skill === undefined) continue; // skip proxy/class-start entries without a skill
    nodes[id] = {
      skill: n.skill,
      name: n.name,
      isNotable: n.isNotable,
      isKeystone: n.isKeystone,
      isMastery: n.isMastery,
      isJewelSocket: n.isJewelSocket,
      group: n.group,
      orbit: n.orbit,
      orbitIndex: n.orbitIndex,
      stats: n.stats ?? [],
      icon: n.icon,
    };
  }

  // Keep only the sprite categories we render, at the highest zoom level. Icons are
  // sub-rects of a sheet hosted on the GGG CDN.
  const sprites: Record<string, SpriteSheet> = {};
  for (const cat of ['normalActive', 'notableActive', 'keystoneActive', 'mastery']) {
    const byZoom = raw.sprites?.[cat];
    if (!byZoom) continue;
    const zooms = Object.keys(byZoom);
    sprites[cat] = byZoom[zooms[zooms.length - 1]];
  }
  const groups: Record<string, { x: number; y: number }> = {};
  for (const [id, g] of Object.entries(raw.groups)) groups[id] = { x: g.x, y: g.y };
  // Timeless jewels go only in regular (non-cluster) sockets. Cluster sockets carry
  // an `expansionJewel` property — exclude them.
  const timelessSlots = raw.jewelSlots.filter((id) => !raw.nodes[String(id)]?.expansionJewel);
  return {
    constants: {
      orbitRadii: raw.constants.orbitRadii,
      skillsPerOrbit: raw.constants.skillsPerOrbit,
    },
    jewelSlots: timelessSlots,
    groups,
    nodes,
    sprites,
  };
}

async function main() {
  const { patch, tree } = parseArgs(process.argv);
  const outDir = resolve(__dirname, '../../data', tree);
  mkdirSync(outDir, { recursive: true });
  const cacheRoot = resolve(__dirname, 'work/.cache');

  // 1. Official GGG passive tree (pinned by version).
  console.log(`fetching tree ${tree} ...`);
  const treeUrl = `https://raw.githubusercontent.com/grindinggear/skilltree-export/${tree}/data.json`;
  const treeRes = await fetch(treeUrl);
  if (!treeRes.ok) throw new Error(`tree fetch failed: ${treeRes.status}`);
  const treeJson = normalizeTree(await treeRes.json());

  // 2. .dat transformation tables (self-extracted via pathofexile-dat lib).
  console.log(`extracting tables for patch ${patch} ...`);
  const dat = await loadDatModule();
  const loader = await createLoader(cacheRoot, patch);
  const schema = await fetchSchema(SCHEMA_URL);

  const atv = selectTable(schema, 'AlternateTreeVersions', POE1);
  const altSkills = selectTable(schema, 'AlternatePassiveSkills', POE1);
  const altAdds = selectTable(schema, 'AlternatePassiveAdditions', POE1);
  const passives = selectTable(schema, 'PassiveSkills', POE1);
  const stats = selectTable(schema, 'Stats', POE1);

  const alternate_tree_versions = normalizeAtv(await readTable(loader, dat, atv));
  const alternate_passive_skills = rowsFromTable(altSkills, await readTable(loader, dat, altSkills));
  const alternate_passive_additions = rowsFromTable(altAdds, await readTable(loader, dat, altAdds));
  const passive_skills = rowsFromTable(passives, await readTable(loader, dat, passives));
  // Stats is large; we only need the string Id per row index (StatsKeys reference these).
  const statsRead = await readTable(loader, dat, stats);
  const stat_translations = null; // deferred (Plan 2 render); MVP English only, done later
  const statsIdCol = stats.columns.findIndex((c) => (c.name || '') === 'Id');
  const stats_ids = statsRead.columns[statsIdCol === -1 ? 0 : statsIdCol].map((id, i) => ({
    _index: i,
    Id: id as string,
  }));

  const files: Record<string, unknown> = {
    'tree.json': treeJson,
    'alternate_tree_versions.json': alternate_tree_versions,
    'alternate_passive_skills.json': alternate_passive_skills,
    'alternate_passive_additions.json': alternate_passive_additions,
    'passive_skills.json': passive_skills,
    'stats.json': stats_ids,
  };

  const checksums: Record<string, string> = {};
  for (const [name, data] of Object.entries(files)) {
    const json = JSON.stringify(data);
    writeFileSync(resolve(outDir, name), json);
    checksums[name] = createHash('sha256').update(json).digest('hex');
  }
  const manifest = {
    treeVersion: tree,
    patch,
    extractedAt: new Date().toISOString(),
    checksums,
  };
  writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(
    resolve(__dirname, '../../data/current.json'),
    JSON.stringify({ treeVersion: tree }, null, 2),
  );
  void stat_translations;
  console.log(
    `done → data/${tree}/ (atv=${alternate_tree_versions.length}, altSkills=${alternate_passive_skills.length}, altAdds=${alternate_passive_additions.length}, passives=${passive_skills.length}, stats=${stats_ids.length})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
