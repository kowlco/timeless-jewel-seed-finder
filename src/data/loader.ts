import { decodeShard } from '../core/shard';
import type { Aggregate, JewelType } from '../core/types';
import { TREE_VERSION } from '../config';

// Gunzip via the platform DecompressionStream (browser + Node 18+).
export async function gunzip(gz: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(gz as BodyInit).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decodeShardGz(gz: Uint8Array): Promise<Aggregate[]> {
  return decodeShard(await gunzip(gz));
}

function baseUrl(): string {
  // Vite injects BASE_URL; fall back to '/' outside a bundle.
  try {
    return import.meta.env?.BASE_URL ?? '/';
  } catch {
    return '/';
  }
}

const cache = new Map<JewelType, Promise<Aggregate[]>>();

export function loadShard(jewel: JewelType): Promise<Aggregate[]> {
  let p = cache.get(jewel);
  if (!p) {
    p = (async () => {
      const url = `${baseUrl()}shards/${TREE_VERSION}/${jewel}.bin.gz`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`failed to load shard ${jewel}: ${res.status}`);
      return decodeShardGz(new Uint8Array(await res.arrayBuffer()));
    })();
    cache.set(jewel, p);
  }
  return p;
}
