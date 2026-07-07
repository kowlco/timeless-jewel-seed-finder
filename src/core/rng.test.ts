import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NumberGenerator } from './rng';

const cases = JSON.parse(readFileSync(resolve(__dirname, '../../fixtures/rng.json'), 'utf8')) as Array<{
  passiveGraphId: number;
  seed: number;
  sequence: number[];
}>;

describe('TinyMT32 RNG parity', () => {
  it('matches reference sequences byte-for-byte', () => {
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      const rng = new NumberGenerator();
      rng.reset(c.passiveGraphId, c.seed);
      const got = c.sequence.map(() => rng.generateUInt());
      expect(got, `graph=${c.passiveGraphId} seed=${c.seed}`).toEqual(c.sequence);
    }
  });
});
