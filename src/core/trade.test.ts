import { describe, it, expect } from 'vitest';
import { buildTradeQuery, buildTradeUrl } from './trade';

describe('trade links', () => {
  it('builds a single-seed query with the right pseudo stat per conqueror', () => {
    const q = buildTradeQuery(4, 'Venarius', 5521);
    const filters = q.query.stats[0].filters;
    expect(filters).toHaveLength(4);
    const venarius = filters.find((f) => f.id === 'explicit.pseudo_timeless_jewel_venarius')!;
    expect(venarius.value).toEqual({ min: 5521, max: 5521 });
    expect(venarius.disabled).toBe(false);
    // other conquerors present but disabled
    expect(filters.filter((f) => f.disabled).length).toBe(3);
  });

  it('Elegant Hubris uses the displayed seed directly (no ×20)', () => {
    const q = buildTradeQuery(5, 'Cadiro', 16000);
    const f = q.query.stats[0].filters.find((x) => x.id.endsWith('cadiro'))!;
    expect(f.value).toEqual({ min: 16000, max: 16000 });
  });

  it('URL targets the official trade site with an encoded query', () => {
    const url = buildTradeUrl(4, 'Venarius', 5521, 'Standard');
    expect(url.startsWith('https://www.pathofexile.com/trade/search/Standard?q=')).toBe(true);
    const q = JSON.parse(decodeURIComponent(url.split('?q=')[1]));
    expect(q.query.stats[0].filters[0].value.min).toBe(5521);
  });

  it('rejects an unknown conqueror', () => {
    expect(() => buildTradeQuery(4, 'Nobody', 1)).toThrow();
  });
});
