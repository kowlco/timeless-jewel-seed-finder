import { describe, it, expect } from 'vitest';
import { search } from './search';
import type { Aggregate, Target } from './types';

const rows: Aggregate[] = [
  { variant: 0, socketId: 10, seed: 100, counts: { 'notable:1': 2, 'stat:5': 3 } },
  { variant: 0, socketId: 10, seed: 101, counts: { 'notable:1': 1 } },
  { variant: 1, socketId: 20, seed: 200, counts: { 'stat:5': 10 } },
];

describe('search', () => {
  it('scores weight × count and ranks descending', () => {
    const targets: Target[] = [
      { outcomeId: 'notable:1', weight: 10 },
      { outcomeId: 'stat:5', weight: 1 },
    ];
    const res = search(3, rows, targets, 10);
    // row0: 2*10+3*1=23; row2: 10*1=10; row1: 1*10=10
    expect(res[0].score).toBe(23);
    expect(res[0].seed).toBe(100);
    expect(res.map((r) => r.score)).toEqual([23, 10, 10]);
    expect(res[0].jewel).toBe(3);
    expect(res[0].breakdown).toContainEqual({ outcomeId: 'notable:1', count: 2 });
    expect(res[0].breakdown).toContainEqual({ outcomeId: 'stat:5', count: 3 });
  });

  it('drops rows missing a required target', () => {
    const targets: Target[] = [
      { outcomeId: 'notable:1', weight: 1, required: true },
      { outcomeId: 'stat:5', weight: 1 },
    ];
    const res = search(3, rows, targets, 10);
    expect(res.map((r) => r.seed).sort()).toEqual([100, 101]); // socket 20 lacks notable:1
  });

  it('honours topN', () => {
    const res = search(3, rows, [{ outcomeId: 'stat:5', weight: 1 }], 1);
    expect(res.length).toBe(1);
    expect(res[0].seed).toBe(200); // stat:5 count 10 wins
  });

  it('excludes zero-score rows', () => {
    const res = search(3, rows, [{ outcomeId: 'notable:999', weight: 1 }], 10);
    expect(res).toEqual([]);
  });
});
