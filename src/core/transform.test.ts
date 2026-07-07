import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculate, type AltInfo } from './transform';
import { loadTables } from './tablesNode';
import { CONQUERORS, type JewelType } from './types';

const version = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/current.json'), 'utf8'),
).treeVersion as string;
const tables = loadTables(resolve(__dirname, '../../data', version));

interface Case {
  passiveId: number;
  seed: number;
  jewel: JewelType;
  conqueror: string;
  result: AltInfo;
}
const cases = JSON.parse(
  readFileSync(resolve(__dirname, '../../fixtures/transform.json'), 'utf8'),
) as Case[];

describe('transform parity', () => {
  it('matches reference Calculate on the golden sample', () => {
    expect(cases.length).toBeGreaterThan(1000);
    let checked = 0;
    for (const c of cases) {
      const conq = CONQUERORS[c.jewel].find((x) => x.name === c.conqueror)!;
      const got = calculate(c.passiveId, c.seed, c.jewel, conq, tables);
      expect(got, `passive=${c.passiveId} seed=${c.seed} jewel=${c.jewel} ${c.conqueror}`).toEqual(
        c.result,
      );
      checked++;
    }
    expect(checked).toBe(cases.length);
  });

  it('is deterministic', () => {
    const conq = CONQUERORS[cases[0].jewel].find((x) => x.name === cases[0].conqueror)!;
    const a = calculate(cases[0].passiveId, cases[0].seed, cases[0].jewel, conq, tables);
    const b = calculate(cases[0].passiveId, cases[0].seed, cases[0].jewel, conq, tables);
    expect(a).toEqual(b);
  });
});
