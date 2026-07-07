// Typed loaders + data accessors ported from reference data/manager.go + data/main.go.
// Column names come from our own extraction (data/<ver>/*.json); positional c<N>
// columns equal the reference's Var<N> (verified — see extraction-findings note).
export const PassiveSkillType = {
  None: 0,
  SmallAttribute: 1,
  SmallNormal: 2,
  Notable: 3,
  KeyStone: 4,
  JewelSocket: 5,
} as const;
export type PassiveSkillTypeValue = (typeof PassiveSkillType)[keyof typeof PassiveSkillType];

export interface PassiveSkill {
  index: number;
  statIndices: number[];
  graphId: number;
  isKeystone: boolean;
  isNotable: boolean;
  isJewelSocket: boolean;
}
export interface AltSkill {
  index: number;
  atvKey: number;
  passiveType: number[];
  statsKeys: number[];
  statMin: number[]; // [Stat1Min..Stat4Min]
  statMax: number[]; // [Stat1Max..Stat4Max]
  spawnWeight: number;
  conquerorIndex: number;
  conquerorVersion: number;
  randomMin: number;
  randomMax: number;
  stat1Min: number;
}
export interface AltAddition {
  index: number;
  atvKey: number;
  passiveType: number[];
  statsKeys: number[];
  statMin: number[]; // [Stat1Min, Stat2Min]
  statMax: number[]; // [Stat1Max, Stat2Max]
  spawnWeight: number;
}
export interface AltTreeVersion {
  index: number;
  areSmallAttributeReplaced: boolean;
  areSmallNormalReplaced: boolean;
  minimumAdditions: number;
  maximumAdditions: number;
  notableReplacementSpawnWeight: number;
}

export interface Tables {
  passiveByIndex: Map<number, PassiveSkill>;
  atvByIndex: Map<number, AltTreeVersion>;
  allAltSkills: AltSkill[];
  allAltAdditions: AltAddition[];
  reverseSkills: Map<number, Map<number, AltSkill[]>>;
  reverseAdditions: Map<number, Map<number, AltAddition[]>>;
}

type Row = Record<string, unknown>;
const num = (v: unknown): number => (v as number) ?? 0;

// Pure table builder from raw extracted rows — shared by Node and browser loaders.
export function buildTables(
  passiveRows: Row[],
  atvRows: Row[],
  altSkillRows: Row[],
  altAddRows: Row[],
): Tables {
  const passiveByIndex = new Map<number, PassiveSkill>();
  for (const r of passiveRows) {
    passiveByIndex.set(num(r._index), {
      index: num(r._index),
      statIndices: (r.Stats as number[]) ?? [],
      graphId: num(r.PassiveSkillGraphId),
      isKeystone: r.IsKeystone === true,
      isNotable: r.IsNotable === true,
      isJewelSocket: r.IsJewelSocket === true,
    });
  }

  const atvByIndex = new Map<number, AltTreeVersion>();
  for (const r of atvRows) {
    atvByIndex.set(num(r.Index), {
      index: num(r.Index),
      areSmallAttributeReplaced: r.AreSmallAttributePassiveSkillsReplaced === true,
      areSmallNormalReplaced: r.AreSmallNormalPassiveSkillsReplaced === true,
      minimumAdditions: num(r.MinimumAdditions),
      maximumAdditions: num(r.MaximumAdditions),
      notableReplacementSpawnWeight: num(r.NotableReplacementSpawnWeight),
    });
  }

  const allAltSkills: AltSkill[] = altSkillRows.map((r) => ({
    index: num(r._index),
    atvKey: num(r.AlternateTreeVersionsKey),
    passiveType: (r.PassiveType as number[]) ?? [],
    statsKeys: (r.StatsKeys as number[]) ?? [],
    statMin: [num(r.Stat1Min), num(r.Stat2Min), num(r.c9), num(r.c11)],
    statMax: [num(r.Stat1Max), num(r.Stat2Max), num(r.c10), num(r.c12)],
    spawnWeight: num(r.SpawnWeight),
    conquerorIndex: num(r.c18),
    conquerorVersion: num(r.c24),
    randomMin: num(r.RandomMin),
    randomMax: num(r.RandomMax),
    stat1Min: num(r.Stat1Min),
  }));

  const allAltAdditions: AltAddition[] = altAddRows.map((r) => ({
    index: num(r._index),
    atvKey: num(r.AlternateTreeVersionsKey),
    passiveType: (r.PassiveType as number[]) ?? [],
    statsKeys: (r.StatsKeys as number[]) ?? [],
    statMin: [num(r.Stat1Min), num(r.c6)],
    statMax: [num(r.Stat1Max), num(r.c7)],
    spawnWeight: num(r.SpawnWeight),
  }));

  // Reverse indices — build order = JSON row order (matches reference data/main.go init).
  const reverseSkills = new Map<number, Map<number, AltSkill[]>>();
  for (const alt of allAltSkills) {
    for (const t of alt.passiveType) {
      let byAtv = reverseSkills.get(t);
      if (!byAtv) reverseSkills.set(t, (byAtv = new Map()));
      const list = byAtv.get(alt.atvKey) ?? [];
      list.push(alt);
      byAtv.set(alt.atvKey, list);
    }
  }
  const reverseAdditions = new Map<number, Map<number, AltAddition[]>>();
  for (const alt of allAltAdditions) {
    for (const t of alt.passiveType) {
      let byAtv = reverseAdditions.get(t);
      if (!byAtv) reverseAdditions.set(t, (byAtv = new Map()));
      const list = byAtv.get(alt.atvKey) ?? [];
      list.push(alt);
      byAtv.set(alt.atvKey, list);
    }
  }

  return {
    passiveByIndex,
    atvByIndex,
    allAltSkills,
    allAltAdditions,
    reverseSkills,
    reverseAdditions,
  };
}

export function isSmallAttribute(stat: number): boolean {
  const bp = (stat + 1 - 574) >>> 0; // uint32 underflow → large → fails the <=6 test
  return bp <= 6 && (0x49 & (1 << bp)) !== 0;
}

export function getPassiveSkillType(p: PassiveSkill): number {
  if (p.isJewelSocket) return PassiveSkillType.JewelSocket;
  if (p.isKeystone) return PassiveSkillType.KeyStone;
  if (p.isNotable) return PassiveSkillType.Notable;
  if (p.statIndices.length === 1 && isSmallAttribute(p.statIndices[0]))
    return PassiveSkillType.SmallAttribute;
  return PassiveSkillType.SmallNormal;
}

export function isPassiveSkillValidForAlteration(p: PassiveSkill | undefined): boolean {
  if (!p) return false;
  const t = getPassiveSkillType(p);
  return t !== PassiveSkillType.None && t !== PassiveSkillType.JewelSocket;
}

export function getApplicableAltSkills(tables: Tables, p: PassiveSkill, atvIndex: number): AltSkill[] {
  return tables.reverseSkills.get(getPassiveSkillType(p))?.get(atvIndex) ?? [];
}
export function getApplicableAltAdditions(
  tables: Tables,
  p: PassiveSkill,
  atvIndex: number,
): AltAddition[] {
  return tables.reverseAdditions.get(getPassiveSkillType(p))?.get(atvIndex) ?? [];
}

export function getAltSkillKeystone(
  tables: Tables,
  atvIndex: number,
  conquerorIndex: number,
  conquerorVersion: number,
): AltSkill | null {
  let found: AltSkill | null = null;
  for (const skill of tables.allAltSkills) {
    if (skill.atvKey !== atvIndex) continue;
    if (skill.conquerorIndex !== conquerorIndex) continue;
    if (skill.conquerorVersion !== conquerorVersion) continue;
    found = skill;
    break;
  }
  if (!found) return null;
  return found.passiveType.includes(PassiveSkillType.KeyStone) ? found : null;
}
