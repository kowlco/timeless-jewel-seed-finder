import { describe, it, expect } from 'vitest';
import { gzipSync } from 'node:zlib';
import { ShardEncoder } from '../core/shard';
import { decodeShardGz } from './loader';
import type { Aggregate } from '../core/types';

describe('shard loader', () => {
  it('decodes a gzipped shard back to aggregates', async () => {
    const enc = new ShardEncoder();
    enc.addRow(0, 10, 100, new Map([['notable:1', 2]]));
    enc.addRow(1, 20, 101, new Map([['stat:5', 3]]));
    const gz = gzipSync(enc.finish());

    const rows = await decodeShardGz(new Uint8Array(gz));
    const expected: Aggregate[] = [
      { variant: 0, socketId: 10, seed: 100, counts: { 'notable:1': 2 } },
      { variant: 1, socketId: 20, seed: 101, counts: { 'stat:5': 3 } },
    ];
    expect(rows).toEqual(expected);
  });
});
