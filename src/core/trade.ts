// Builds official pathofexile.com/trade deep links for a specific jewel seed.
// Ported from reference frontend/src/lib/trade.ts. The stored seed is already the
// tradeable/displayed value (Elegant Hubris included — no ×20 needed here).
import type { JewelType } from './types';

export const TRADE_STAT_NAMES: Record<JewelType, Record<string, string>> = {
  1: {
    Xibaqua: 'explicit.pseudo_timeless_jewel_xibaqua',
    Zerphi: 'explicit.pseudo_timeless_jewel_zerphi',
    Ahuana: 'explicit.pseudo_timeless_jewel_ahuana',
    Doryani: 'explicit.pseudo_timeless_jewel_doryani',
  },
  2: {
    Kaom: 'explicit.pseudo_timeless_jewel_kaom',
    Rakiata: 'explicit.pseudo_timeless_jewel_rakiata',
    Kiloava: 'explicit.pseudo_timeless_jewel_kiloava',
    Akoya: 'explicit.pseudo_timeless_jewel_akoya',
  },
  3: {
    Deshret: 'explicit.pseudo_timeless_jewel_deshret',
    Balbala: 'explicit.pseudo_timeless_jewel_balbala',
    Asenath: 'explicit.pseudo_timeless_jewel_asenath',
    Nasima: 'explicit.pseudo_timeless_jewel_nasima',
  },
  4: {
    Venarius: 'explicit.pseudo_timeless_jewel_venarius',
    Maxarius: 'explicit.pseudo_timeless_jewel_maxarius',
    Dominus: 'explicit.pseudo_timeless_jewel_dominus',
    Avarius: 'explicit.pseudo_timeless_jewel_avarius',
  },
  5: {
    Cadiro: 'explicit.pseudo_timeless_jewel_cadiro',
    Victario: 'explicit.pseudo_timeless_jewel_victario',
    Chitus: 'explicit.pseudo_timeless_jewel_chitus',
    Caspiro: 'explicit.pseudo_timeless_jewel_caspiro',
  },
  6: {
    Vorana: 'explicit.pseudo_timeless_jewel_vorana',
    Uhtred: 'explicit.pseudo_timeless_jewel_uhtred',
    Medved: 'explicit.pseudo_timeless_jewel_medved',
  },
};

export function buildTradeQuery(jewel: JewelType, conqueror: string, seed: number) {
  const names = TRADE_STAT_NAMES[jewel];
  if (!names) throw new Error(`unknown jewel ${jewel}`);
  if (!names[conqueror]) throw new Error(`unknown conqueror "${conqueror}" for jewel ${jewel}`);
  return {
    query: {
      status: { option: 'any' },
      stats: [
        {
          type: 'count',
          value: { min: 1 },
          disabled: false,
          filters: Object.keys(names).map((conq) => ({
            id: names[conq],
            value: { min: seed, max: seed },
            disabled: conq !== conqueror,
          })),
        },
      ],
    },
    sort: { price: 'asc' },
  };
}

export function buildTradeUrl(
  jewel: JewelType,
  conqueror: string,
  seed: number,
  league = 'Standard',
): string {
  const q = JSON.stringify(buildTradeQuery(jewel, conqueror, seed));
  return `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}?q=${encodeURIComponent(q)}`;
}

// One search matching ANY of the picked (conqueror, seed) jewels. A `count` stat
// group with `min: 1` is an OR across its filters, so each pick contributes one
// enabled filter pinned to its own conqueror pseudo-stat and exact seed.
export function buildMultiTradeQuery(
  jewel: JewelType,
  picks: { variant: number; seed: number }[],
  conquerorNames: string[],
) {
  const names = TRADE_STAT_NAMES[jewel];
  if (!names) throw new Error(`unknown jewel ${jewel}`);
  const filters = picks.map((p) => {
    const conqueror = conquerorNames[p.variant];
    const id = names[conqueror];
    if (!id) throw new Error(`unknown conqueror "${conqueror}" for jewel ${jewel}`);
    return { id, value: { min: p.seed, max: p.seed }, disabled: false };
  });
  return {
    query: {
      status: { option: 'any' },
      stats: [{ type: 'count', value: { min: 1 }, disabled: false, filters }],
    },
    sort: { price: 'asc' },
  };
}

export function buildMultiTradeUrl(
  jewel: JewelType,
  picks: { variant: number; seed: number }[],
  conquerorNames: string[],
  league = 'Standard',
): string {
  const q = JSON.stringify(buildMultiTradeQuery(jewel, picks, conquerorNames));
  return `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}?q=${encodeURIComponent(q)}`;
}
