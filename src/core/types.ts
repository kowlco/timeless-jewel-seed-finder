export type JewelType = 1 | 2 | 3 | 4 | 5 | 6;

export const JEWEL_NAMES: Record<JewelType, string> = {
  1: 'Glorious Vanity',
  2: 'Lethal Pride',
  3: 'Brutal Restraint',
  4: 'Militant Faith',
  5: 'Elegant Hubris',
  6: 'Heroic Tragedy',
};

export interface Conqueror {
  name: string;
  index: number;
  version: number;
}

// Verbatim from reference data/jewels.go (TimelessJewelConquerors).
export const CONQUERORS: Record<JewelType, Conqueror[]> = {
  1: [
    { name: 'Xibaqua', index: 1, version: 0 },
    { name: 'Zerphi', index: 2, version: 0 },
    { name: 'Ahuana', index: 2, version: 1 },
    { name: 'Doryani', index: 3, version: 0 },
  ],
  2: [
    { name: 'Kaom', index: 1, version: 0 },
    { name: 'Rakiata', index: 2, version: 0 },
    { name: 'Kiloava', index: 3, version: 0 },
    { name: 'Akoya', index: 3, version: 1 },
  ],
  3: [
    { name: 'Deshret', index: 1, version: 0 },
    { name: 'Balbala', index: 1, version: 1 },
    { name: 'Asenath', index: 2, version: 0 },
    { name: 'Nasima', index: 3, version: 0 },
  ],
  4: [
    { name: 'Venarius', index: 1, version: 0 },
    { name: 'Maxarius', index: 1, version: 1 },
    { name: 'Dominus', index: 2, version: 0 },
    { name: 'Avarius', index: 3, version: 0 },
  ],
  5: [
    { name: 'Cadiro', index: 1, version: 0 },
    { name: 'Victario', index: 2, version: 0 },
    { name: 'Chitus', index: 3, version: 0 },
    { name: 'Caspiro', index: 3, version: 1 },
  ],
  6: [
    { name: 'Vorana', index: 1, version: 0 },
    { name: 'Uhtred', index: 2, version: 0 },
    { name: 'Medved', index: 3, version: 0 },
  ],
};

export interface SeedRange {
  min: number;
  max: number;
  special: boolean;
}

// Verbatim from reference data/jewels.go (TimelessJewelSeedRanges).
export const SEED_RANGES: Record<JewelType, SeedRange> = {
  1: { min: 100, max: 8000, special: false },
  2: { min: 10000, max: 18000, special: false },
  3: { min: 500, max: 8000, special: false },
  4: { min: 2000, max: 10000, special: false },
  5: { min: 2000, max: 160000, special: true },
  6: { min: 100, max: 8000, special: false },
};

export type OutcomeKind = 'notable' | 'keystone' | 'stat';

export interface Aggregate {
  variant: number;
  socketId: number;
  seed: number;
  counts: Record<string, number>;
}

export interface Target {
  outcomeId: string;
  weight: number;
  required?: boolean;
}

export interface SearchResult {
  jewel: JewelType;
  variant: number;
  seed: number;
  socketId: number;
  score: number;
  matches: number; // total matched passives (Σ counts, unweighted)
  breakdown: { outcomeId: string; count: number }[];
}
