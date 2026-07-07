// Loads the transformation tables + tree into the browser (lazily, on first use)
// so a selected result can be expanded node-by-node via core/transform.
import { buildTables, type Tables } from '../core/tables';
import type { TreeData } from '../core/radius';
import { TREE_VERSION } from '../config';

function baseUrl(): string {
  try {
    return import.meta.env?.BASE_URL ?? '/';
  } catch {
    return '/';
  }
}

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${baseUrl()}data/${TREE_VERSION}/${file}`);
  if (!res.ok) throw new Error(`failed to load ${file}: ${res.status}`);
  return (await res.json()) as T;
}

export interface TreeAssets {
  tables: Tables;
  tree: TreeData;
  altSkillNames: Map<number, string>;
  statNames: Map<number, string>;
  graphToNode: Map<number, { name: string }>;
}

let cache: Promise<TreeAssets> | null = null;

export function loadTreeAssets(): Promise<TreeAssets> {
  if (!cache) {
    cache = (async () => {
      const [passives, atv, altSkills, altAdds, stats, statDesc, tree] = await Promise.all([
        fetchJson<Record<string, unknown>[]>('passive_skills.json'),
        fetchJson<Record<string, unknown>[]>('alternate_tree_versions.json'),
        fetchJson<(Record<string, unknown> & { Name?: string })[]>('alternate_passive_skills.json'),
        fetchJson<Record<string, unknown>[]>('alternate_passive_additions.json'),
        fetchJson<{ _index: number; Id: string }[]>('stats.json'),
        fetchJson<Record<string, string>>('stat_descriptions.json'),
        fetchJson<TreeData>('tree.json'),
      ]);
      const tables = buildTables(passives, atv, altSkills, altAdds);
      const altSkillNames = new Map<number, string>();
      for (const r of altSkills) altSkillNames.set(r._index as number, (r.Name as string) ?? '');
      const statNames = new Map<number, string>();
      for (const s of stats) statNames.set(s._index, statDesc[s.Id] ?? s.Id);
      const graphToNode = new Map<number, { name: string }>();
      for (const [, n] of Object.entries(
        tree.nodes as Record<string, { skill?: number; name?: string }>,
      )) {
        if (n.skill !== undefined) graphToNode.set(n.skill, { name: n.name ?? `#${n.skill}` });
      }
      return { tables, tree, altSkillNames, statNames, graphToNode };
    })();
  }
  return cache;
}
