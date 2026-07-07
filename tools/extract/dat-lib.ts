// Reusable extraction primitives built on pathofexile-dat's PUBLIC API.
// We read .dat columns POSITIONALLY so unnamed (`_`) columns are accessible —
// the CLI collapses all unnamed columns under key '' (see extraction-findings note).
import { FileLoader, toCdnUrl } from 'pathofexile-dat/bundles.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// pathofexile-dat/dat.js triggers a file:// wasm fetch on import that Node/undici
// rejects. Install a fetch shim, then import it dynamically. We don't use the wasm
// analysis; the shim only lets the module load.
type DatModule = {
  readDatFile: (ext: string, buf: Uint8Array) => DatFile;
  readColumn: (header: Header, datFile: DatFile) => unknown[];
  getHeaderLength: (header: Header, datFile: DatFile) => number;
};
let datMod: DatModule | null = null;
export async function loadDatModule(): Promise<DatModule> {
  if (datMod) return datMod;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: unknown) => {
    const url =
      typeof input === 'string'
        ? input
        : ((input as { url?: string; href?: string })?.url ??
          (input as { href?: string })?.href ??
          String(input));
    if (typeof url === 'string' && url.startsWith('file:')) {
      const buf = await fs.readFile(fileURLToPath(url));
      const ct = url.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
      return new Response(buf, { headers: { 'content-type': ct } });
    }
    return realFetch(input as RequestInfo, init as RequestInit);
  }) as typeof fetch;
  datMod = (await import('pathofexile-dat/dat.js')) as unknown as DatModule;
  return datMod;
}

export interface DatFile {
  rowCount: number;
}
export interface Header {
  name: string;
  offset: number;
  type: unknown;
}
export interface SchemaColumn {
  name?: string | null;
  type: string;
  array?: boolean;
  interval?: boolean;
}
export interface SchemaTable {
  name: string;
  validFor: number;
  columns: SchemaColumn[];
}

// ---- bundle loader glue (copied from pathofexile-dat CLI; uses only public toCdnUrl) ----
class CdnBundleLoader {
  constructor(
    private cacheDir: string,
    private patchVer: string,
  ) {}
  static async create(cacheRoot: string, patchVer: string): Promise<CdnBundleLoader> {
    const cacheDir = path.join(cacheRoot, patchVer);
    await fs.mkdir(cacheDir, { recursive: true });
    return new CdnBundleLoader(cacheDir, patchVer);
  }
  async fetchFile(name: string): Promise<Uint8Array> {
    const cached = path.join(this.cacheDir, name.replace(/\//g, '@'));
    try {
      return await fs.readFile(cached);
    } catch {
      /* not cached */
    }
    const res = await fetch(toCdnUrl(this.patchVer, name));
    if (!res.ok) throw new Error(`CDN fetch failed for ${name}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(cached, buf);
    return new Uint8Array(buf);
  }
}
class CachingBundleLoader {
  private cache = new Map<string, Uint8Array>();
  constructor(private inner: CdnBundleLoader) {}
  async fetchFile(name: string): Promise<Uint8Array> {
    let bin = this.cache.get(name);
    if (!bin) {
      bin = await this.inner.fetchFile(name);
      this.cache.set(name, bin);
    }
    return bin;
  }
  clearBundleCache(): void {
    this.cache.clear();
  }
}

export interface Loader {
  getFileContents(fullPath: string): Promise<Uint8Array>;
}

export async function createLoader(cacheRoot: string, patch: string): Promise<Loader> {
  const cdn = await CdnBundleLoader.create(cacheRoot, patch);
  // FileLoader.create builds the file index from '_.index.bin'.
  return (await FileLoader.create(new CachingBundleLoader(cdn))) as unknown as Loader;
}

export async function fetchSchema(url: string): Promise<{ version: number; tables: SchemaTable[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`schema fetch failed: ${res.status}`);
  return (await res.json()) as { version: number; tables: SchemaTable[] };
}

export function selectTable(
  schema: { tables: SchemaTable[] },
  name: string,
  validFor: number,
): SchemaTable {
  const found = schema.tables.filter((t) => t.name === name);
  const t = found.find((s) => s.validFor & validFor) ?? found[0];
  if (!t) throw new Error(`schema has no table "${name}"`);
  return t;
}

// Replicates pathofexile-dat's importHeaders offset computation so we can read
// every column by position — including unnamed ones.
export function buildHeaders(cols: SchemaColumn[], datFile: DatFile, dat: DatModule): Header[] {
  const headers: Header[] = [];
  let offset = 0;
  for (const c of cols) {
    const h: Header = {
      name: c.name || '',
      offset,
      type: {
        array: c.array,
        interval: c.interval,
        integer:
          c.type === 'u16'
            ? { unsigned: true, size: 2 }
            : c.type === 'u32'
              ? { unsigned: true, size: 4 }
              : c.type === 'i16'
                ? { unsigned: false, size: 2 }
                : c.type === 'i32'
                  ? { unsigned: false, size: 4 }
                  : c.type === 'enumrow'
                    ? { unsigned: false, size: 4 }
                    : undefined,
        decimal: c.type === 'f32' ? { size: 4 } : undefined,
        string: c.type === 'string' ? {} : undefined,
        boolean: c.type === 'bool' ? {} : undefined,
        key: c.type === 'row' || c.type === 'foreignrow' ? { foreign: c.type === 'foreignrow' } : undefined,
      },
    };
    headers.push(h);
    offset += dat.getHeaderLength(h, datFile);
  }
  return headers;
}

// Reads a table into positional columns. Row i, column j = columns[j][i].
export async function readTable(
  loader: Loader,
  dat: DatModule,
  schemaTable: SchemaTable,
): Promise<{ rowCount: number; columns: unknown[][] }> {
  const buf = await loader.getFileContents(`Data/${schemaTable.name}.datc64`);
  const datFile = dat.readDatFile('.datc64', buf);
  const headers = buildHeaders(schemaTable.columns, datFile, dat);
  const columns = headers.map((h) => dat.readColumn(h, datFile));
  return { rowCount: datFile.rowCount, columns };
}

export const SCHEMA_URL =
  'https://github.com/poe-tool-dev/dat-schema/releases/download/latest/schema.min.json';
