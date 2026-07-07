// Node-only table loader (tests, precompute). The browser uses buildTables() with
// fetched JSON instead — see src/data/browserData.ts. Kept separate so tables.ts
// stays free of node:fs and is safe to import in the browser.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildTables, type Tables } from './tables';

type Row = Record<string, unknown>;

export function loadTables(dataDir: string): Tables {
  const read = (f: string): Row[] => JSON.parse(readFileSync(resolve(dataDir, f), 'utf8')) as Row[];
  return buildTables(
    read('passive_skills.json'),
    read('alternate_tree_versions.json'),
    read('alternate_passive_skills.json'),
    read('alternate_passive_additions.json'),
  );
}
