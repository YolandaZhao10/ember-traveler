import type { Effect } from '../engine/types';
import { viewDef } from '../engine/cards';
import { STATUSES } from '../data/statuses';

/** 持续能力的包含关系也算重复；自动加力量不因回合开始/结束而成为新设计。 */
export function powerCore(effects: Effect[]): string[] {
  return [...new Set(effects.flatMap(e => e.kind === 'status' && e.target === 'self' && e.amount > 0
    && (STATUSES[e.status].kind === 'power' || ['strength', 'dexterity', 'thorns', 'ritual'].includes(e.status))
    ? [e.status === 'ritual' || e.status === 'demonHeart' ? 'automaticStrength' : e.status] : []))].sort();
}

export function containsPowerCore(a: Effect[], b: Effect[]): boolean {
  const core = powerCore(a), other = powerCore(b);
  return core.length > 0 && core.every(effect => other.includes(effect));
}

type Mode = 'design' | 'exact';
type NormalizedEffect = Record<string, unknown>;

// Only known independent operations may commute. Everything else preserves its
// position relative to dependencies, including conditions and hand changes.
const scalarKinds = new Set(['draw', 'energy', 'gainEmber', 'block', 'heal']);
function independent(a: Effect, b: Effect): boolean {
  if (scalarKinds.has(a.kind) && scalarKinds.has(b.kind)) return a.kind !== b.kind;
  const passiveStatus = (e: Effect) => e.kind === 'status' && (
    (e.target === 'self' && e.status === 'energyNext') ||
    (e.target !== 'self' && ['weak', 'vulnerable', 'frail', 'burn'].includes(e.status))
  );
  return (scalarKinds.has(a.kind) && passiveStatus(b)) || (scalarKinds.has(b.kind) && passiveStatus(a));
}

function shape(value: unknown, mode: Mode): unknown {
  if (typeof value === 'number') return mode === 'exact' ? value : value < 0 ? 'negative' : value === 0 ? 'zero' : 'positive';
  if (Array.isArray(value)) return value.map(x => shape(x, mode));
  if (!value || typeof value !== 'object') return value;
  const data = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(data).sort().filter(k => data[k] !== undefined).map(k => [
    k, mode === 'design' && k === 'target' && data[k] !== 'self' ? 'enemy' : shape(data[k], mode),
  ]));
}

function normalizeEffect(effect: Effect, mode: Mode): NormalizedEffect {
  const e = { ...effect } as NormalizedEffect;
  const omitDefault = (key: string, value: unknown) => {
    if (e[key] === undefined || e[key] === value) delete e[key];
  };
  if (['damage', 'damageByBlock', 'damagePerBurn', 'emberBurst'].includes(effect.kind)) omitDefault('aoe', false);
  switch (effect.kind) {
    case 'damage':
      omitDefault('times', 1);
      omitDefault('strengthMult', 0);
      omitDefault('perHandCard', 0);
      omitDefault('perExhaustedCard', 0);
      if (!effect.perExhaustedCard) delete e.exhaustBonusMax;
      omitDefault('lifesteal', false);
      if (!effect.lifesteal || effect.lifestealCap === Infinity) delete e.lifestealCap;
      break;
    case 'damageByBlock':
      omitDefault('mult', 1);
      omitDefault('bonus', 0);
      omitDefault('consume', false);
      break;
    case 'damagePerEmber': omitDefault('per', 1); break;
    case 'emberBurst':
      omitDefault('damagePer', 0);
      omitDefault('blockPer', 0);
      break;
    case 'exhaustHand':
      omitDefault('damagePerCard', 0);
      omitDefault('energyPerCard', 0);
      break;
    case 'returnExhausted': omitDefault('selection', 'random'); break;
    case 'conditional': e.then = normalizeEffects(effect.then, mode); break;
  }
  if (mode === 'design') for (const key of ['aoe', 'times', 'bonus']) delete e[key];
  return shape(e, mode) as NormalizedEffect;
}

function normalizeEffects(effects: Effect[], mode: Mode): NormalizedEffect[] {
  const normalized = effects.map(e => normalizeEffect(e, mode));
  const keys = normalized.map(e => JSON.stringify(e));
  const remaining = new Set(effects.map((_, i) => i));
  const ordered: NormalizedEffect[] = [];
  // Lexical topological ordering is invariant under adjacent independent swaps,
  // without moving anything across a real dependency or a conditional barrier.
  while (remaining.size) {
    const ready = [...remaining].filter(i => ![...remaining].some(j => j < i && !independent(effects[j], effects[i])));
    ready.sort((a, b) => keys[a].localeCompare(keys[b]) || a - b);
    const next = ready[0];
    remaining.delete(next);
    ordered.push(normalized[next]);
  }
  if (mode === 'exact') return ordered;
  // Separate flat hits are a numeric variation, but never erase an attached
  // lifesteal/scaling mechanic or a resource's negative direction.
  const plainDamage = (e: NormalizedEffect) => e.kind === 'damage' && Object.keys(e).every(k => ['kind', 'amount'].includes(k));
  return ordered.filter((e, i) => !(i > 0 && plainDamage(e) && plainDamage(ordered[i - 1]) && e.amount === ordered[i - 1].amount));
}

export function effectDesign(effects: Effect[], mode: Mode = 'design'): string {
  return JSON.stringify(normalizeEffects(effects, mode));
}

function chargeShape(charge: { damage?: number; block?: number; ember?: number; max?: number } | undefined, mode: Mode): unknown {
  // 单牌蓄力上限只是数值，不构成近似设计上的差异；精确机制仍保留。
  const active = Object.fromEntries(Object.entries(charge ?? {}).filter(([key, n]) => n !== undefined && n !== 0 && (mode === 'exact' || key !== 'max')));
  return Object.keys(active).length ? shape(active, mode) : null;
}

/**
 * 已人工审核、允许保留的同设计牌对（两个 ID 按字典序以 / 连接）。
 * 疾风余烬 / 藏炭：共享牌改为消耗手牌换余烬以提供消耗接口，藏炭后续单独重做。
 * 以下四对是按指定数值调整后命中的，数值不动，登记为已审核：
 * 铁壁 / 举盾：铁壁去掉回合末格挡后只剩一次性格挡，与举盾只差数值和费用。
 * 盾击 / 持盾冲锋：持盾冲锋去掉易伤后是「先获得格挡，再按格挡打出伤害」，与盾击升级版同形。
 * 拢火 / 干薪束：新牌拢火只获得余烬，与共享牌干薪束只差数值、费用和消耗。
 * 燃料交换 / 剔灯：新牌剔灯用余烬换能量，与共享牌燃料交换只差数值、消耗和生命代付。
 */
export const REVIEWED_DESIGN_PAIRS = new Set(['ember_gust/pocket_coals', 'iron_wall/raise_shield', 'shield_bash/shield_rush', 'gather_embers/tinder_bundle', 'ember_exchange/trim_lamp']);

/** 数值、费用、段数、单体/群体和保留/消耗不能作为唯一特色。 */
export function cardDesign(id: string, upgraded: boolean): string {
  const v = viewDef(id, upgraded);
  return JSON.stringify([normalizeEffects(v.effects, 'design'), normalizeEffects(v.handEndEffects, 'design'), chargeShape(v.charge, 'design')]);
}

/** 完全同效审查用的键：只看实际结算的效果与蓄力成长，忽略费用、保留、消耗、目标与角色。 */
export function effectIdentity(id: string, upgraded: boolean): string {
  const v = viewDef(id, upgraded);
  return effectDesign(v.effects, 'exact') + effectDesign(v.handEndEffects, 'exact') + JSON.stringify(chargeShape(v.charge, 'exact'));
}

/** 精确效果审查：仍忽略名称、费用、稀有度，但保留实际数值与结算机制。 */
export function cardMechanics(id: string, upgraded: boolean): string {
  const v = viewDef(id, upgraded);
  return JSON.stringify([
    v.type, normalizeEffects(v.effects, 'exact'), normalizeEffects(v.handEndEffects, 'exact'),
    v.target, v.exhaust, v.ethereal, v.retain, chargeShape(v.charge, 'exact'), v.requireEmber, v.hpFallback,
  ]);
}
