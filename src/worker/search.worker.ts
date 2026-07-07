// Runs the (potentially large) shard scoring off the main thread.
import { loadShard } from '../data/loader';
import { search } from '../core/search';
import type { JewelType, Target } from '../core/types';

export interface SearchRequest {
  type: 'search';
  jewel: JewelType;
  variants: number[]; // variant indices to include; empty = all
  targets: Target[];
  topN: number;
}

self.onmessage = async (e: MessageEvent<SearchRequest>) => {
  const msg = e.data;
  if (msg.type !== 'search') return;
  try {
    const rows = await loadShard(msg.jewel);
    const filtered =
      msg.variants.length > 0 ? rows.filter((r) => msg.variants.includes(r.variant)) : rows;
    const results = search(msg.jewel, filtered, msg.targets, msg.topN);
    self.postMessage({ type: 'result', results });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
