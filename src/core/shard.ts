// Shard = compact binary encoding of per-(variant,socket,seed) outcome tallies.
// Format (then gzipped): varint dictCount, [varint len + utf8]*, varint rowCount,
// per row: u8 variant, varint socket, varint seed, varint nOutcomes,
//          (varint outcomeIdx, varint count)*.
import type { Aggregate } from './types';

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

class ByteWriter {
  private buf = new Uint8Array(1024);
  len = 0;
  private ensure(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(this.buf);
    this.buf = nb;
  }
  u8(b: number): void {
    this.ensure(1);
    this.buf[this.len++] = b;
  }
  varint(n: number): void {
    this.ensure(6);
    while (n >= 0x80) {
      this.buf[this.len++] = (n & 0x7f) | 0x80;
      n = Math.floor(n / 128);
    }
    this.buf[this.len++] = n;
  }
  bytes(b: Uint8Array): void {
    this.ensure(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  result(): Uint8Array {
    return this.buf.subarray(0, this.len);
  }
}

class ByteReader {
  pos = 0;
  constructor(private buf: Uint8Array) {}
  u8(): number {
    return this.buf[this.pos++];
  }
  varint(): number {
    let shift = 1;
    let res = 0;
    let b: number;
    do {
      b = this.buf[this.pos++];
      res += (b & 0x7f) * shift;
      shift *= 128;
    } while (b & 0x80);
    return res;
  }
  bytes(n: number): Uint8Array {
    const s = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
}

// Streaming encoder — writes rows to a byte buffer as they arrive so a full jewel's
// worth of aggregates never lives in memory at once (avoids OOM on replace-heavy jewels).
export class ShardEncoder {
  private dict: string[] = [];
  private index = new Map<string, number>();
  private rowBuf = new ByteWriter();
  private rowCount = 0;
  private intern(s: string): number {
    let i = this.index.get(s);
    if (i === undefined) {
      i = this.dict.length;
      this.dict.push(s);
      this.index.set(s, i);
    }
    return i;
  }
  addRow(variant: number, socketId: number, seed: number, counts: Map<string, number>): void {
    this.rowBuf.u8(variant);
    this.rowBuf.varint(socketId);
    this.rowBuf.varint(seed);
    this.rowBuf.varint(counts.size);
    for (const [k, v] of counts) {
      this.rowBuf.varint(this.intern(k));
      this.rowBuf.varint(v);
    }
    this.rowCount++;
  }
  finish(): Uint8Array {
    const w = new ByteWriter();
    const enc = new TextEncoder();
    w.varint(this.dict.length);
    for (const s of this.dict) {
      const b = enc.encode(s);
      w.varint(b.length);
      w.bytes(b);
    }
    w.varint(this.rowCount);
    w.bytes(this.rowBuf.result());
    return w.result();
  }
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

  // First pass: intern to build the dictionary and cache per-row entries.
  const encRows = rows.map((r) => {
    const entries: [number, number][] = [];
    for (const [k, v] of Object.entries(r.counts)) entries.push([intern(k), v]);
    return { variant: r.variant, socketId: r.socketId, seed: r.seed, entries };
  });

  const w = new ByteWriter();
  const enc = new TextEncoder();
  w.varint(dict.length);
  for (const s of dict) {
    const b = enc.encode(s);
    w.varint(b.length);
    w.bytes(b);
  }
  w.varint(encRows.length);
  for (const r of encRows) {
    w.u8(r.variant);
    w.varint(r.socketId);
    w.varint(r.seed);
    w.varint(r.entries.length);
    for (const [idx, count] of r.entries) {
      w.varint(idx);
      w.varint(count);
    }
  }
  return w.result();
}

export function decodeShard(bytes: Uint8Array): Aggregate[] {
  const r = new ByteReader(bytes);
  const dec = new TextDecoder();
  const dictCount = r.varint();
  const dict: string[] = new Array(dictCount);
  for (let i = 0; i < dictCount; i++) {
    const len = r.varint();
    dict[i] = dec.decode(r.bytes(len));
  }
  const rowCount = r.varint();
  const rows: Aggregate[] = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    const variant = r.u8();
    const socketId = r.varint();
    const seed = r.varint();
    const n = r.varint();
    const counts: Record<string, number> = {};
    for (let j = 0; j < n; j++) {
      const idx = r.varint();
      counts[dict[idx]] = r.varint();
    }
    rows[i] = { variant, socketId, seed, counts };
  }
  return rows;
}
