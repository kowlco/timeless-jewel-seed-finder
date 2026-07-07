import { describe, it, expect } from 'vitest';
import { buildSeedRegex, buildStashQuery } from './stashRegex';

// Every produced regex must actually match all of its input seeds (as the whole
// string) and the compression must hit the documented compact forms.
const matchesAll = (re: string, seeds: number[]) =>
  seeds.every((s) => new RegExp(`^(?:${re})$`).test(String(s)));

describe('buildSeedRegex', () => {
  it('returns empty for no seeds', () => {
    expect(buildSeedRegex([])).toBe('');
  });

  it('passes a single seed through verbatim', () => {
    expect(buildSeedRegex([1981])).toBe('1981');
  });

  it('collapses a single differing digit into a character class', () => {
    expect(buildSeedRegex([1981, 1985])).toBe('198[15]');
  });

  it('factors shared prefixes and branches', () => {
    expect(buildSeedRegex([121, 122, 199])).toBe('1(2[12]|99)');
  });

  it('makes a shared-prefix terminal suffix optional with a group', () => {
    expect(buildSeedRegex([19, 1981])).toBe('19(81)?');
  });

  it('makes a single optional trailing char atomic', () => {
    expect(buildSeedRegex([12, 123])).toBe('123?');
  });

  it('ignores duplicates and input order', () => {
    expect(buildSeedRegex([1985, 1981, 1985])).toBe('198[15]');
  });

  it('always matches every input seed', () => {
    const seeds = [1981, 1985, 121, 122, 199, 19, 5388, 2022, 8000, 100];
    const re = buildSeedRegex(seeds);
    expect(matchesAll(re, seeds)).toBe(true);
  });
});

describe('buildStashQuery', () => {
  const conq = ['Xibaqua', 'Zerphi', 'Ahuana', 'Doryani'];

  it('is empty with no picks', () => {
    expect(buildStashQuery([], conq, true)).toBe('');
  });

  it('merges seeds and ignores conqueror when disabled', () => {
    const picks = [
      { variant: 0, seed: 1981 },
      { variant: 2, seed: 1985 },
    ];
    expect(buildStashQuery(picks, conq, false)).toBe('198[15]');
  });

  it('ties each seed to its conqueror when enabled', () => {
    const picks = [{ variant: 0, seed: 1981 }];
    expect(buildStashQuery(picks, conq, true)).toBe('1981.*Xibaqua');
  });

  it('groups seeds per conqueror across variants', () => {
    const picks = [
      { variant: 0, seed: 1981 },
      { variant: 0, seed: 1985 },
      { variant: 1, seed: 2022 },
    ];
    expect(buildStashQuery(picks, conq, true)).toBe('(198[15].*Xibaqua|2022.*Zerphi)');
  });

  it('matches the seed+conqueror in real jewel text but not another conqueror', () => {
    const re = buildStashQuery([{ variant: 0, seed: 1981 }], conq, true);
    const rx = new RegExp(re);
    expect(rx.test('Bathed in the blood of 1981 sacrificed in the name of Xibaqua')).toBe(true);
    expect(rx.test('Bathed in the blood of 1981 sacrificed in the name of Zerphi')).toBe(false);
  });
});
