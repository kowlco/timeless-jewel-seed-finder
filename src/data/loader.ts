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

const labelCache = new Map<JewelType, Promise<Record<string, string>>>();

// Outcome-id → human label catalog for the target picker (built by precompute).
export function loadLabels(jewel: JewelType): Promise<Record<string, string>> {
  let p = labelCache.get(jewel);
  if (!p) {
    p = (async () => {
      const res = await fetch(`${baseUrl()}shards/${TREE_VERSION}/${jewel}.labels.json`);
      if (!res.ok) throw new Error(`failed to load labels ${jewel}: ${res.status}`);
      return (await res.json()) as Record<string, string>;
    })();
    labelCache.set(jewel, p);
  }
  return p;
}

const cache = new Map<JewelType, Promise<Aggregate[]>>();

export function loadShard(jewel: JewelType): Promise<Aggregate[]> {
  let p = cache.get(jewel);
  if (!p) {
    p = (async () => {
      const url = `${baseUrl()}shards/${TREE_VERSION}/${jewel}.bin`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`failed to load shard ${jewel}: ${res.status}`);
      return decodeShardGz(new Uint8Array(await res.arrayBuffer()));
    })();
    cache.set(jewel, p);
  }
  return p;
}
