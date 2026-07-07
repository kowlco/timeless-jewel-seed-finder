// Shard = compact, gzip-friendly encoding of per-(variant,socket,seed) outcome tallies.
import type { Aggregate } from '../../src/core/types';

export function buildAggregate(
  variant: number,
  socketId: number,
  seed: number,
  outcomeIds: string[],
): Aggregate {
  const counts: Record<string, number> = {};
  for (const id of outcomeIds) counts[id] = (counts[id] ?? 0) + 1;
  return { variant, socketId, seed, counts };
}

interface Encoded {
  dict: string[];
  rows: number[][]; // [variant, socketId, seed, dictIdx, count, dictIdx, count, ...]
}

export function encodeShard(rows: Aggregate[]): Uint8Array {
  const index = new Map<string, number>();
  const dict: string[] = [];
  const intern = (s: string): number => {
    let i = index.get(s);
    if (i === undefined) {
      i = dict.length;
      dict.push(s);
      index.set(s, i);
    }
    return i;
  };
  const encRows: number[][] = rows.map((r) => {
    const row: number[] = [r.variant, r.socketId, r.seed];
    for (const [k, v] of Object.entries(r.counts)) {
      row.push(intern(k), v);
    }
    return row;
  });
  const payload: Encoded = { dict, rows: encRows };
  return new TextEncoder().encode(JSON.stringify(payload));
}

export function decodeShard(bytes: Uint8Array): Aggregate[] {
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as Encoded;
  return payload.rows.map((row) => {
    const [variant, socketId, seed] = row;
    const counts: Record<string, number> = {};
    for (let i = 3; i < row.length; i += 2) {
      counts[payload.dict[row[i]]] = row[i + 1];
    }
    return { variant, socketId, seed, counts };
  });
}
