import { describe, it, expect } from 'vitest';
import { buildAggregate, encodeShard, decodeShard } from './shard';

describe('shard aggregate', () => {
  it('counts outcomes per (variant, socket, seed)', () => {
    const outcomes = ['notable:123', 'stat:45', 'stat:45', 'stat:99'];
    const agg = buildAggregate(1, 7, 100, outcomes);
    expect(agg.counts).toEqual({ 'notable:123': 1, 'stat:45': 2, 'stat:99': 1 });
    expect(agg.variant).toBe(1);
    expect(agg.socketId).toBe(7);
    expect(agg.seed).toBe(100);
  });

  it('round-trips through encode/decode', () => {
    const rows = [
      buildAggregate(1, 7, 100, ['notable:1']),
      buildAggregate(2, 7, 101, ['stat:2', 'stat:2']),
    ];
    expect(decodeShard(encodeShard(rows))).toEqual(rows);
  });
});
