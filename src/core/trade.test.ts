import { describe, it, expect } from 'vitest';
import { buildMultiTradeQuery } from './trade';

describe('buildMultiTradeQuery', () => {
  const gv = ['Xibaqua', 'Zerphi', 'Ahuana', 'Doryani'];

  it('ORs one filter per pick in a count>=1 group', () => {
    const q = buildMultiTradeQuery(
      1,
      [
        { variant: 0, seed: 1981 },
        { variant: 1, seed: 2022 },
      ],
      gv,
    );
    const group = q.query.stats[0];
    expect(group.type).toBe('count');
    expect(group.value).toEqual({ min: 1 });
    expect(group.filters).toEqual([
      { id: 'explicit.pseudo_timeless_jewel_xibaqua', value: { min: 1981, max: 1981 }, disabled: false },
      { id: 'explicit.pseudo_timeless_jewel_zerphi', value: { min: 2022, max: 2022 }, disabled: false },
    ]);
  });

  it('throws on an unknown conqueror', () => {
    expect(() => buildMultiTradeQuery(1, [{ variant: 9, seed: 1 }], gv)).toThrow();
  });
});
