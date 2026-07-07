import type { SearchRequest } from '../worker/search.worker';
import type { SearchResult } from '../core/types';

let worker: Worker | null = null;
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../worker/search.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export function runSearch(req: Omit<SearchRequest, 'type'>): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'result') {
        cleanup();
        resolve(e.data.results as SearchResult[]);
      } else if (e.data?.type === 'error') {
        cleanup();
        reject(new Error(e.data.message));
      }
    };
    const cleanup = () => w.removeEventListener('message', onMsg);
    w.addEventListener('message', onMsg);
    w.postMessage({ type: 'search', ...req } satisfies SearchRequest);
  });
}
