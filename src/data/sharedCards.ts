import type { CardDef, Condition, Effect, StatusId } from '../engine/types';

type Options = Pick<CardDef, 'exhaust' | 'retain' | 'requireEmber'> & { target?: CardDef['target']; upgradeCost?: number };
type Entry = Omit<CardDef, 'rarity'>;
const hit = (amount: number, extra: Partial<Extract<Effect, { kind: 'damage' }>> = {}): Effect => ({ kind: 'damage', amount, ...extra });
const block = (amount: number): Effect => ({ kind: 'block', amount });
const draw = (amount: number): Effect => ({ kind: 'draw', amount });
const ember = (amount: number): Effect => ({ kind: 'gainEmber', amount });
const energy = (amount: number): Effect => ({ kind: 'energy', amount });
const heal = (amount: number): Effect => ({ kind: 'heal', amount });
const discard = (count: number): Effect => ({ kind: 'discardRandom', count });
const status = (status: StatusId, amount: number, target: 'self' | 'target' | 'all' = 'self'): Effect => ({ kind: 'status', status, amount, target });
const when = (cond: Condition, ...then: Effect[]): Effect => ({ kind: 'conditional', cond, then });
const coals = (value: number): Condition => ({ kind: 'emberAtLeast', value });
function make(type: CardDef['type'], id: string, name: string, cost: number, effects: Effect[], upgraded: Effect[], options: Options = {}): Entry {
  const { upgradeCost, target = type === 'attack' ? 'enemy' : 'self', ...flags } = options;
  return { id, name, archetype: 'ember', type, cost, target, effects, ...flags, upgrade: { effects: upgraded, ...(upgradeCost === undefined ? {} : { cost: upgradeCost }) } };
}
const A = (id: string, name: string, cost: number, effects: Effect[], up: Effect[], opts?: Options) => make('attack', id, name, cost, effects, up, opts);
const S = (id: string, name: string, cost: number, effects: Effect[], up: Effect[], opts?: Options) => make('skill', id, name, cost, effects, up, opts);
const P = (id: string, name: string, cost: number, effects: Effect[], up: Effect[], opts?: Options) => make('power', id, name, cost, effects, up, opts);
export const EXTRA_SHARED_CARDS: CardDef[] = [];
function add(rarity: 'common' | 'uncommon' | 'rare', entries: Entry[]) {
  EXTRA_SHARED_CARDS.push(...entries.map(entry => ({ ...entry, rarity })));
}

// 四角色共享：旅行补给、余烬积蓄与释放；强力恢复、爆发资源用消耗限制循环。
add('common', [
  A('stone_throw', '投石', 0, [discard(1), hit(8), draw(1)], [discard(1), hit(11), draw(1)], { exhaust: true }),
  S('camp_guard', '守夜', 1, [block(7), when(coals(3), block(2))], [block(9), when(coals(3), block(3))]),
  A('sweeping_embers', '扫火', 1, [hit(4, { aoe: true }), ember(1)], [hit(6, { aoe: true }), ember(1)], { target: 'all_enemies' }),
  A('coal_tip', '炭尖', 1, [hit(7), when({ kind: 'targetBurning' }, ember(2))], [hit(10), when({ kind: 'targetBurning' }, ember(3))]),
  S('shutter_lamp', '掩灯', 0, [block(3), when(coals(3), status('weak', 1, 'all'))], [block(5), when(coals(3), status('weak', 1, 'all'))], { exhaust: true }),
  S('tinder_bundle', '干薪束', 0, [ember(3)], [ember(5)], { exhaust: true }),
  S('field_notes', '行旅札记', 1, [draw(2), discard(1), ember(1)], [draw(3), discard(1), ember(2)]),
  S('spark_lure', '诱火', 1, [status('burn', 3, 'target'), status('weak', 1, 'target')], [status('burn', 4, 'target'), status('weak', 1, 'target')], { target: 'enemy' }),
  A('lantern_flash', '灯闪', 1, [hit(6), status('vulnerable', 1, 'target'), when(coals(3), block(4))], [hit(9), status('vulnerable', 1, 'target'), when(coals(3), block(6))]),
  S('warm_cloak', '炽边斗篷', 1, [block(6), when(coals(3), status('burn', 2, 'all'))], [block(9), when(coals(3), status('burn', 3, 'all'))]),
  A('fanning_strike', '扇火斩', 1, [hit(8), when(coals(5), draw(1))], [hit(11), when(coals(5), draw(1))]),
  S('ration_bite', '一口干粮', 0, [heal(3)], [heal(5)], { exhaust: true }),
  S('banked_spark', '守住火种', 1, [block(7), when(coals(4), status('energyNext', 1))], [block(10), when(coals(4), status('energyNext', 1))], { retain: true }),
  S('steady_breath', '匀息', 0, [block(2), when({ kind: 'cardsThisTurnAtLeast', value: 2 }, ember(1))], [block(4), when({ kind: 'cardsThisTurnAtLeast', value: 2 }, ember(1))]),
  A('sling_volley', '连掷火石', 2, [hit(3, { times: 4 }), when(coals(5), status('energyNext', 1))], [hit(4, { times: 4 }), when(coals(5), status('energyNext', 2))]),
]);
add('uncommon', [
  S('ember_exchange', '燃料交换', 0, [ember(-3), energy(2)], [ember(-3), energy(2), draw(1)], { requireEmber: 3, exhaust: true }),
  A('firestorm', '火雨', 2, [ember(-2), hit(10, { aoe: true }), status('burn', 3, 'all')], [ember(-2), hit(14, { aoe: true }), status('burn', 4, 'all')], { target: 'all_enemies', requireEmber: 2 }),
  S('insulated_coat', '隔热外衣', 2, [block(14), ember(2), status('regen', 1)], [block(18), ember(3), status('regen', 2)], { exhaust: true }),
  A('heat_sink', '卸热', 1, [{ kind: 'emberBurst', damagePer: 2, blockPer: 2 }], [{ kind: 'emberBurst', damagePer: 3, blockPer: 2 }]),
  S('charcoal_insight', '炭火启示', 1, [ember(-2), draw(3)], [ember(-2), draw(4)], { requireEmber: 2 }),
  S('rekindle_coals', '重拨余火', 1, [ember(-2), { kind: 'returnExhausted', count: 1 }, draw(1)], [ember(-2), { kind: 'returnExhausted', count: 1 }, draw(2)], { retain: true, requireEmber: 2 }),
  S('truce_smoke', '停战烟', 1, [status('weak', 2, 'all'), discard(1), draw(2)], [status('weak', 2, 'all'), discard(1), draw(3)]),
  S('warding_lantern', '辟邪灯', 1, [block(9), when(coals(6), status('dexterity', 1), status('thorns', 1))], [block(12), when(coals(6), status('dexterity', 2), status('thorns', 1))]),
  A('spare_torch', '掷出火把', 1, [hit(9), ember(2), status('burn', 3, 'target')], [hit(14), ember(3), status('burn', 4, 'target')], { exhaust: true }),
  S('traveling_supplies', '随身药包', 0, [heal(4), draw(1)], [heal(6), draw(1)], { exhaust: true }),
  S('emergency_stash', '翻找行囊', 0, [draw(3), discard(2), status('energyNext', 1)], [draw(4), discard(2), status('energyNext', 1)], { exhaust: true }),
  S('enduring_warmth', '余温未散', 2, [heal(5), block(10)], [heal(7), block(14)], { exhaust: true }),
  A('sharpened_coal', '淬炭刃', 1, [hit(8), status('strength', 1)], [hit(12), status('strength', 1)], { exhaust: true }),
]);
add('rare', [
  P('crown_of_sparks', '火星冠冕', 2, [status('emberHeart', 1), status('strength', 1)], [status('emberHeart', 2), status('strength', 1)]),
  A('final_conflagration', '终夜焚天', 2, [{ kind: 'emberBurst', damagePer: 4, aoe: true }, { kind: 'status', status: 'weak', amount: 1, target: 'all' }], [{ kind: 'emberBurst', damagePer: 5, aoe: true }, { kind: 'status', status: 'weak', amount: 2, target: 'all' }], { target: 'all_enemies' }),
  A('smoldering_star', '闷燃之星', 2, [hit(18), when(coals(8), status('burn', 8, 'target'), status('vulnerable', 2, 'target'))], [hit(22), when(coals(8), status('burn', 12, 'target'), status('vulnerable', 3, 'target'))]),
  P('bonfire_shelter', '篝火避难所', 2, [ember(-5), status('metallicize', 6), status('regen', 2)], [ember(-5), status('metallicize', 8), status('regen', 3)], { requireEmber: 5 }),
  S('phoenix_respite', '涅槃之息', 1, [ember(-6), heal(12)], [ember(-6), heal(16)], { requireEmber: 6, exhaust: true }),
  S('embers_to_dawn', '燃尽迎曦', 0, [ember(-5), energy(3), draw(2), status('strength', 2)], [ember(-5), energy(3), draw(3), status('strength', 3)], { requireEmber: 5, exhaust: true }),
  P('lasting_light', '长明灯', 2, [status('forge', 1), status('emberHeart', 1)], [status('forge', 1), status('emberHeart', 1)], { upgradeCost: 1 }),
  A('lantern_procession', '百灯夜行', 2, [hit(10, { aoe: true }), ember(3), block(5)], [hit(14, { aoe: true }), ember(3), block(8)], { target: 'all_enemies' }),
  S('sunward_step', '向阳而行', 1, [block(10), draw(2), ember(2)], [block(14), draw(3), ember(3)], { exhaust: true }),
  S('sealed_flame', '封存烈火', 0, [ember(5), status('energyNext', 1)], [ember(7), status('energyNext', 2)], { retain: true, exhaust: true }),
  A('twilight_flame', '暮火裁决', 2, [hit(16), status('weak', 2, 'target'), status('vulnerable', 2, 'target')], [hit(22), status('weak', 2, 'target'), status('vulnerable', 2, 'target')]),
]);
