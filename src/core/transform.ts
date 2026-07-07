// Port of reference calculator/main.go + calculator/tree_manager.go.
// Produces the same AltInfo shape as the golden fixtures (fixtures/transform.json).
import { NumberGenerator } from './rng';
import type { JewelType, Conqueror } from './types';
import {
  type Tables,
  type PassiveSkill,
  type AltTreeVersion,
  type AltSkill,
  PassiveSkillType,
  getPassiveSkillType,
  isPassiveSkillValidForAlteration,
  getApplicableAltSkills,
  getApplicableAltAdditions,
  getAltSkillKeystone,
} from './tables';

export interface AltInfo {
  skill: number | null;
  statRolls: number[];
  additions: { addition: number; statRolls: number[] }[];
}

const ELEGANT_HUBRIS: JewelType = 5;

function effectiveSeed(jewel: JewelType, seed: number): number {
  return jewel === ELEGANT_HUBRIS ? Math.floor(seed / 20) : seed;
}

function isReplaced(
  p: PassiveSkill,
  atv: AltTreeVersion,
  rng: NumberGenerator,
  graphId: number,
  seed: number,
): boolean {
  if (p.isKeystone) return true;
  if (p.isNotable) {
    if (atv.notableReplacementSpawnWeight >= 100) return true;
    if (atv.notableReplacementSpawnWeight === 0) return false;
    rng.reset(graphId, seed);
    return rng.generate(0, 100) < atv.notableReplacementSpawnWeight;
  }
  if (p.statIndices.length === 1 && getPassiveSkillType(p) === PassiveSkillType.SmallAttribute) {
    return atv.areSmallAttributeReplaced;
  }
  return atv.areSmallNormalReplaced;
}

function rollAdditions(
  minAdd: number,
  maxAdd: number,
  rng: NumberGenerator,
  p: PassiveSkill,
  atv: AltTreeVersion,
  tables: Tables,
): { addition: number; statRolls: number[] }[] {
  let count = minAdd;
  if (maxAdd > minAdd) count = rng.generate(minAdd, maxAdd);
  const out: { addition: number; statRolls: number[] }[] = [];
  const applicable = getApplicableAltAdditions(tables, p, atv.index);
  for (let k = 0; k < count; k++) {
    let rolled = null as ReturnType<typeof rollOneAddition>;
    while (rolled === null) rolled = rollOneAddition(applicable, rng);
    const elements = Math.min(rolled.statsKeys.length, 2);
    const statRolls: number[] = [];
    for (let j = 0; j < elements; j++) {
      let v = rolled.statMin[j];
      if (rolled.statMax[j] > rolled.statMin[j]) v = rng.generateSigned(rolled.statMin[j], rolled.statMax[j]);
      statRolls.push(v);
    }
    out.push({ addition: rolled.index, statRolls });
  }
  return out;
}

function rollOneAddition(
  applicable: ReturnType<typeof getApplicableAltAdditions>,
  rng: NumberGenerator,
) {
  let total = 0;
  for (const a of applicable) total += a.spawnWeight;
  let roll = rng.generateSingle(total);
  for (const a of applicable) {
    if (a.spawnWeight > roll) return a;
    roll -= a.spawnWeight;
  }
  return null;
}

function augment(
  p: PassiveSkill,
  atv: AltTreeVersion,
  rng: NumberGenerator,
  graphId: number,
  seed: number,
  tables: Tables,
): AltInfo {
  rng.reset(graphId, seed);
  if (getPassiveSkillType(p) === PassiveSkillType.Notable) rng.generate(0, 100);
  return {
    skill: null,
    statRolls: [],
    additions: rollAdditions(atv.minimumAdditions, atv.maximumAdditions, rng, p, atv, tables),
  };
}

function replace(
  p: PassiveSkill,
  atv: AltTreeVersion,
  conq: Conqueror,
  rng: NumberGenerator,
  graphId: number,
  seed: number,
  tables: Tables,
): AltInfo {
  if (p.isKeystone) {
    const ks = getAltSkillKeystone(tables, atv.index, conq.index, conq.version);
    if (!ks) return { skill: null, statRolls: [], additions: [] };
    const n = Math.min(ks.statsKeys.length, 4);
    const statRolls = new Array(n).fill(0) as number[];
    if (n > 0) statRolls[0] = ks.stat1Min;
    return { skill: ks.index, statRolls, additions: [] };
  }

  const applicable = getApplicableAltSkills(tables, p, atv.index);
  rng.reset(graphId, seed);
  if (getPassiveSkillType(p) === PassiveSkillType.Notable) rng.generate(0, 100);

  let rolled: AltSkill | null = null;
  let currentSpawnWeight = 0;
  for (const skill of applicable) {
    currentSpawnWeight += skill.spawnWeight;
    if (rng.generateSingle(currentSpawnWeight) < skill.spawnWeight) rolled = skill;
  }
  if (!rolled) return { skill: null, statRolls: [], additions: [] };

  const elements = Math.min(rolled.statsKeys.length, 4);
  const statRolls: number[] = [];
  for (let i = 0; i < elements; i++) {
    let v = rolled.statMin[i];
    if (rolled.statMax[i] > rolled.statMin[i]) v = rng.generateSigned(rolled.statMin[i], rolled.statMax[i]);
    statRolls.push(v);
  }

  if (rolled.randomMin === 0 && rolled.randomMax === 0) {
    return { skill: rolled.index, statRolls, additions: [] };
  }
  const minAdd = atv.minimumAdditions + rolled.randomMin;
  const maxAdd = atv.maximumAdditions + rolled.randomMax;
  return {
    skill: rolled.index,
    statRolls,
    additions: rollAdditions(minAdd, maxAdd, rng, p, atv, tables),
  };
}

export function calculate(
  passiveId: number,
  seed: number,
  jewel: JewelType,
  conqueror: Conqueror,
  tables: Tables,
): AltInfo {
  const empty: AltInfo = { skill: null, statRolls: [], additions: [] };
  const p = tables.passiveByIndex.get(passiveId);
  if (!p || !isPassiveSkillValidForAlteration(p)) return empty;
  const atv = tables.atvByIndex.get(jewel);
  if (!atv) return empty;

  const eff = effectiveSeed(jewel, seed);
  const rng = new NumberGenerator();
  if (isReplaced(p, atv, rng, p.graphId, eff)) {
    return replace(p, atv, conqueror, rng, p.graphId, eff, tables);
  }
  return augment(p, atv, rng, p.graphId, eff, tables);
}
