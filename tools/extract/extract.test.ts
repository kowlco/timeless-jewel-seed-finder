import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA = resolve(__dirname, '../../data');
const version = JSON.parse(readFileSync(resolve(DATA, 'current.json'), 'utf8')).treeVersion as string;
const dir = resolve(DATA, version);
const load = (f: string) => JSON.parse(readFileSync(resolve(dir, f), 'utf8'));

describe('extract output', () => {
  it('produced all required table files', () => {
    for (const f of [
      'tree.json',
      'passive_skills.json',
      'alternate_passive_skills.json',
      'alternate_passive_additions.json',
      'alternate_tree_versions.json',
      'stats.json',
      'manifest.json',
    ]) {
      expect(existsSync(resolve(dir, f)), `${f} exists`).toBe(true);
    }
  });

  it('tree has jewel slots and orbit constants', () => {
    const tree = load('tree.json');
    expect(tree.jewelSlots.length).toBeGreaterThan(0);
    expect(tree.constants.orbitRadii.length).toBeGreaterThan(0);
    expect(tree.constants.skillsPerOrbit.length).toBeGreaterThan(0);
    expect(Object.keys(tree.nodes).length).toBeGreaterThan(1000);
  });

  it('AlternateTreeVersions has one row per jewel type with mapped fields', () => {
    const atv = load('alternate_tree_versions.json') as Array<Record<string, number | string | boolean>>;
    // Index 0 = None, 1..6 = the six jewels.
    expect(atv.length).toBe(7);
    const byId = Object.fromEntries(atv.map((r) => [r.Id, r]));
    // Verified live values (see extraction-findings note):
    expect(byId['Vaal'].NotableReplacementSpawnWeight).toBe(100);
    expect(byId['Karui'].NotableReplacementSpawnWeight).toBe(0);
    expect(byId['Templar'].NotableReplacementSpawnWeight).toBe(20);
    expect(byId['Karui'].MinimumAdditions).toBe(1);
    expect(byId['Karui'].MaximumAdditions).toBe(1);
    expect(byId['Vaal'].AreSmallAttributePassiveSkillsReplaced).toBe(true);
    expect(byId['Karui'].AreSmallNormalPassiveSkillsReplaced).toBe(false);
  });

  it('alternate_passive_skills carries named + positional columns', () => {
    const skills = load('alternate_passive_skills.json') as Array<Record<string, unknown>>;
    expect(skills.length).toBeGreaterThan(100);
    const s = skills[0];
    for (const key of ['AlternateTreeVersionsKey', 'StatsKeys', 'Stat1Min', 'SpawnWeight']) {
      expect(s, `has ${key}`).toHaveProperty(key);
    }
  });

  it('stats are indexed string ids', () => {
    const stats = load('stats.json') as Array<{ _index: number; Id: string }>;
    expect(stats.length).toBeGreaterThan(1000);
    expect(typeof stats[0].Id).toBe('string');
  });
});
