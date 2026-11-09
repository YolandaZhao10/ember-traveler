import { RELIC_LIST } from '../data/relics';
import type { RelicDef } from '../engine/types';

// 按 ID 结算的旧遗物适配为同一审查模型；未覆盖的新旧式遗物必须显式补充。
// 此处不参与结算；实际收益由 relicCoreBalance / relicCollection 等测试验证。
const fx = (kind: string, status?: string, target?: string) => ({ kind, ...(status ? { status } : {}), ...(target ? { target } : {}) });
const rule = (trigger: string, effects: ReturnType<typeof fx>[], when: string[] = [], cadence = 'once') => ({ trigger, cadence, when, effects });
const opening = (...effects: ReturnType<typeof fx>[]) => rule('turnStart', effects);
const count = (trigger: string, ...effects: ReturnType<typeof fx>[]) => rule(trigger, effects);
const end = (when: string[], ...effects: ReturnType<typeof fx>[]) => rule('turnEnd', effects, when, 'each');
const trip = (trigger: string, ...effects: ReturnType<typeof fx>[]) => ({ trigger, effects });
const b = () => fx('block'), draw = () => fx('draw'), energy = () => fx('energy'), ember = () => fx('ember'), heal = () => fx('heal');
const status = (id: string) => fx('status', id), enemy = (id: string) => fx('enemyStatus', id, 'all');
const gold = () => fx('gold'), maxHp = () => fx('maxHp');

const LEGACY: Record<string, { combat?: unknown[]; journey?: unknown[]; special?: string[] }> = {
  ember_lantern: { combat: [opening(ember())] },
  flint: { special: ['firstAttackDamageBonus'] },
  metronome: { combat: [count('cardPlayed', draw())] },
  drummer_heart: { combat: [count('attackPlayed', energy())] },
  rusted_plate: { combat: [rule('turnStart', [b()], [], 'each')] },
  thorn_crown: { combat: [opening(status('thorns'))] },
  anvil_shard: { combat: [end(['blockAtLeast'], fx('damageAll'))] },
  charcoal_heart: { combat: [end([], ember())] },
  ash_hourglass: { special: ['cardEmberBonus'] },
  ember_censer: { special: ['zeroEmberOpening', 'minimumEmberSpend'] },
  canteen: { journey: [trip('victory', heal())] },
  merchant_scale: { special: ['shopDiscount'] },
  rune_stone: { combat: [opening(energy())] },
  blood_charm: { journey: [trip('obtain', maxHp(), heal())] },
  watchers_eye: { combat: [opening(enemy('vulnerable'))] },
  ash_compass: { combat: [opening(draw())] },
  picker_bell: { combat: [opening(enemy('burn'))] },
  tinderbox: { special: ['enemyBurnDamageBonus'] },
  bone_urn: { combat: [count('exhaust', draw())] },
  cinder_censer: { combat: [end(['exhaustedAtLeast'], ember())] },
  blood_seal: { combat: [opening(fx('loseHp'), status('strength'))] },
  iron_skull: { combat: [rule('selfHpLoss', [b()], [], 'each')] },
  red_vial: { special: ['victoryRefundCardHpLoss'] },
  war_horn: { special: ['firstStrengthGainBonus'] },
  echo_stone: { combat: [opening(status('echo'))] },
  old_tome: { combat: [opening(status('echo'))] }, // 历史快照；现版由结构化规则覆盖。
  tuning_fork: { combat: [rule('echo', [ember()], [], 'each')] },
  lens: { combat: [rule('turnStart', [energy()], ['retainedHand'], 'periodic')] },
  trail_boots: { combat: [count('attackPlayed', b())] },
  shield_rivet: { combat: [opening(b())] },
  coal_pouch: { combat: [count('exhaust', ember())] },
  soot_mask: { combat: [rule('turnStart', [b()], ['burningEnemy'], 'each')] },
  scar_band: { combat: [count('selfHpLoss', ember())] },
  whetstone: { combat: [opening(status('strength'))] },
  ink_well: { combat: [count('skillPlayed', b())] },
  bookmark: { combat: [rule('turnStart', [draw()], ['retainedHand'], 'each')] },
  ration_pack: { journey: [trip('rest', heal())] },
  coin_purse: { journey: [{ ...trip('victory', gold()), tier: 'normal-or-elite' }] },
  duelist_clasp: { combat: [count('cardPlayed', ember())] },
  kiln_spark: { combat: [end(['exhaustedAtLeast'], enemy('burn'))] },
  blood_pendant: { combat: [count('selfHpLoss', draw())] },
  crystal_chime: { combat: [count('echo', b())] },
  bastion_core: { combat: [end(['blockAtLeast'], status('energyNext'))] },
  phoenix_ash: { combat: [count('exhaust', heal())] },
  war_standard: { combat: [end(['attacksAtLeast'], status('strength'))] },
  star_chart: { combat: [end(['retainedHand'], fx('charge'))] },
  dawn_crystal: { combat: [opening(energy(), ember())] },
  pilgrim_seal: { journey: [trip('upgrade', heal())] },
  clockwork_sun: { combat: [rule('turnStart', [energy(), draw()], [], 'periodic')] },
};

function sorted<T>(xs: T[]): T[] {
  return [...xs].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** 忽略名称、数值、计数阈值、稀有度与来源；保留时机、触发频率类型、条件及资源种类。 */
export function relicMechanicSignature(relic: RelicDef): string {
  const structured = relic.combat?.length || relic.journey?.length;
  const model = structured ? {
    combat: (relic.combat ?? []).map(r => ({
      trigger: r.trigger,
      cadence: r.nth !== undefined ? 'once' : r.every ? 'periodic' : 'each',
      when: (r.when ?? []).map(c => c.kind),
      effects: r.effects.map(e => fx(e.kind, 'status' in e ? e.status : undefined, 'target' in e ? e.target : undefined)),
    })),
    journey: (relic.journey ?? []).map(r => ({ trigger: r.trigger, effects: r.effects.map(e => fx(e.kind)), ...(r.tier ? { tier: r.tier } : {}) })),
  } : LEGACY[relic.id];
  if (!model) throw new Error(`缺少旧遗物机制适配：${relic.id}`);
  // 遗物效果集合用于筛查，顺序依赖另由人工复核与真实结算测试负责。
  const canonical = (value: unknown): unknown => Array.isArray(value) ? sorted(value.map(canonical))
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, v]) => !Array.isArray(v) || v.length).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
  return JSON.stringify(canonical(model));
}

export function relicMechanicDuplicates(relics: RelicDef[] = RELIC_LIST): string[][] {
  const groups = new Map<string, string[]>();
  // 终章九件已停发，只保留旧存档纪念定义，不纳入当前可获得内容去重。
  for (const relic of relics.filter(r => r.chapter !== 4)) {
    const key = relicMechanicSignature(relic);
    groups.set(key, [...(groups.get(key) ?? []), relic.id]);
  }
  return [...groups.values()].filter(ids => ids.length > 1);
}
