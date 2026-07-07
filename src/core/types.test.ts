import { describe, it, expect } from 'vitest';
import { SEED_RANGES, CONQUERORS, JEWEL_NAMES } from './types';

describe('jewel constants', () => {
  it('has the classic 5 jewels named', () => {
    expect(JEWEL_NAMES[1]).toBe('Glorious Vanity');
    expect(JEWEL_NAMES[5]).toBe('Elegant Hubris');
  });
  it('elegant hubris seed range is special', () => {
    expect(SEED_RANGES[5]).toEqual({ min: 2000, max: 160000, special: true });
  });
  it('glorious vanity has 4 conquerors', () => {
    expect(CONQUERORS[1].map((c) => c.name)).toEqual(['Xibaqua', 'Zerphi', 'Ahuana', 'Doryani']);
    expect(CONQUERORS[1][2]).toEqual({ name: 'Ahuana', index: 2, version: 1 });
  });
});
