import type { Archetype, CardDef, CharacterId, Condition, Effect, StatusId } from '../engine/types';

type Options = Pick<CardDef, 'exhaust' | 'retain' | 'charge' | 'requireEmber'> & { target?: CardDef['target']; upgradeCost?: number };
type Entry = Omit<CardDef, 'owner' | 'rarity'>;
const hit = (amount: number, extra: Partial<Extract<Effect, { kind: 'damage' }>> = {}): Effect => ({ kind: 'damage', amount, ...extra });
const block = (amount: number): Effect => ({ kind: 'block', amount });
const draw = (amount: number): Effect => ({ kind: 'draw', amount });
const ember = (amount: number): Effect => ({ kind: 'gainEmber', amount });
const energy = (amount: number): Effect => ({ kind: 'energy', amount });
const lose = (amount: number): Effect => ({ kind: 'loseHp', amount });
const strength = (amount: number): Effect => ({ kind: 'tempStrength', amount });
const status = (status: StatusId, amount: number, target: 'self' | 'target' | 'all' = 'self'): Effect => ({ kind: 'status', status, amount, target });
const when = (cond: Condition, ...then: Effect[]): Effect => ({ kind: 'conditional', cond, then });
const attacks = (value: number): Condition => ({ kind: 'attacksThisTurnAtLeast', value });
const cards = (value: number): Condition => ({ kind: 'cardsThisTurnAtLeast', value });
const burning: Condition = { kind: 'targetBurning' };
const wounded: Condition = { kind: 'lostHpThisTurn' };
const echo: Condition = { kind: 'hasEcho' };
const charged: Condition = { kind: 'charged', value: 2 };
const guarded: Condition = { kind: 'hasBlock' };
const recover = (count: number): Effect => ({ kind: 'returnExhausted', count });
const exhaust = (count: number | 'all'): Effect => ({ kind: 'exhaustHand', count });
function make(type: CardDef['type'], id: string, name: string, archetype: Archetype, cost: number, effects: Effect[], upgraded: Effect[], options: Options = {}): Entry {
  const { upgradeCost, target = type === 'attack' ? 'enemy' : 'self', ...flags } = options;
  return { id, name, archetype, type, cost, target, effects, ...flags, upgrade: { effects: upgraded, ...(upgradeCost === undefined ? {} : { cost: upgradeCost }) } };
}
const A = (id: string, name: string, route: Archetype, cost: number, effects: Effect[], up: Effect[], opts?: Options) => make('attack', id, name, route, cost, effects, up, opts);
const S = (id: string, name: string, route: Archetype, cost: number, effects: Effect[], up: Effect[], opts?: Options) => make('skill', id, name, route, cost, effects, up, opts);
const P = (id: string, name: string, route: Archetype, cost: number, effects: Effect[], up: Effect[], opts?: Options) => make('power', id, name, route, cost, effects, up, opts);
export const EXTRA_CHARACTER_CARDS: CardDef[] = [];
function add(owner: CharacterId, rarity: 'common' | 'uncommon' | 'rare', entries: Entry[]) {
  EXTRA_CHARACTER_CARDS.push(...entries.map(entry => ({ ...entry, owner, rarity })));
}

// 旅人：用连击接续资源，以护甲支撑反击。
add('traveler', 'common', [
  A('cross_guard', '交锋', 'combo', 1, [hit(7), block(6)], [hit(10), block(8)]),
  A('pommel_jab', '柄击', 'combo', 1, [hit(7), status('weak', 1, 'target')], [hit(10), status('weak', 1, 'target')]),
  A('trail_cut', '踏痕斩', 'combo', 1, [hit(8), when(guarded, ember(2))], [hit(11), when(guarded, ember(2))]),
  A('frontier_sweep', '开路横斩', 'combo', 1, [hit(7, { aoe: true }), when(attacks(2), status('vulnerable', 1, 'all'))], [hit(10, { aoe: true }), when(attacks(2), status('vulnerable', 2, 'all'))], { target: 'all_enemies' }),
  S('steady_grip', '稳握', 'combo', 0, [block(4), when(cards(2), draw(1))], [block(7), when(cards(2), draw(1))], { exhaust: true }),
  S('measured_step', '量步', 'combo', 1, [draw(1), block(8)], [draw(1), block(11)]),
  A('shield_edge', '盾缘', 'bulwark', 1, [hit(7), when(guarded, block(5))], [hit(10), when(guarded, block(7))]),
  S('brace_line', '架盾', 'bulwark', 1, [when(guarded, status('metallicize', 1)), block(7)], [when(guarded, status('metallicize', 2)), block(10)]),
  S('ember_patrol', '提灯巡守', 'bulwark', 1, [block(9), when(cards(2), status('energyNext', 1))], [block(12), when(cards(2), status('energyNext', 1))]),
  S('rally_step', '整步', 'bulwark', 0, [block(3), when(attacks(1), ember(1))], [block(5), when(attacks(1), ember(1))]),
  A('lantern_poke', '灯火突刺', 'combo', 1, [hit(6), ember(1), when(attacks(2), draw(1))], [hit(9), ember(1), when(attacks(2), draw(1))]),
]);
add('traveler', 'uncommon', [
  S('pursuit_step', '追风步', 'combo', 0, [draw(1), when(cards(2), strength(2))], [draw(2), when(cards(2), strength(3))], { exhaust: true }),
  A('hooking_cut', '钩刃', 'combo', 1, [hit(4, { times: 2 }), status('vulnerable', 1, 'target')], [hit(6, { times: 2 }), status('vulnerable', 1, 'target')]),
  A('blade_rain', '碎刃雨', 'combo', 2, [hit(6, { times: 2, aoe: true }), status('weak', 1, 'all'), when(cards(3), draw(1))], [hit(8, { times: 2, aoe: true }), status('weak', 2, 'all'), when(cards(3), draw(2))], { target: 'all_enemies' }),
  S('marching_rhythm', '行军拍', 'combo', 1, [draw(2), when(attacks(2), status('energyNext', 1))], [draw(3), when(attacks(2), status('energyNext', 1))]),
  A('swift_return', '回身刺', 'combo', 0, [hit(5), when(attacks(2), block(4))], [hit(7), when(attacks(2), block(6))]),
  S('ember_plate', '余烬锻甲', 'bulwark', 1, [ember(-2), block(12), draw(1)], [ember(-2), block(16), draw(1)], { requireEmber: 2 }),
  S('iron_escort', '铁卫护送', 'bulwark', 2, [block(14), status('weak', 1, 'all'), draw(1)], [block(18), status('weak', 1, 'all'), draw(2)]),
  A('shield_rush', '持盾冲锋', 'bulwark', 2, [block(10), { kind: 'damageByBlock', bonus: 3 }, status('vulnerable', 1, 'target')], [block(14), { kind: 'damageByBlock', bonus: 3 }, status('vulnerable', 2, 'target')]),
  P('road_armor', '旅途重甲', 'bulwark', 2, [block(5), status('dexterity', 2)], [block(8), status('dexterity', 2)]),
  S('thorn_stance', '刺盾姿态', 'bulwark', 1, [status('thorns', 1), { kind: 'doubleStatus', status: 'thorns', target: 'self' }, draw(1)], [status('thorns', 2), { kind: 'doubleStatus', status: 'thorns', target: 'self' }, draw(1)], { exhaust: true }),
  A('guard_breaker', '破阵刃', 'combo', 2, [hit(12), status('weak', 2, 'target'), when(attacks(2), status('vulnerable', 2, 'target'))], [hit(17), status('weak', 2, 'target'), when(attacks(2), status('vulnerable', 3, 'target'))]),
]);
add('traveler', 'rare', [
  A('blade_tempest', '连刃风暴', 'combo', 2, [hit(4, { times: 3, aoe: true }), when(attacks(2), status('crescendo', 1))], [hit(5, { times: 3, aoe: true }), when(attacks(2), status('crescendo', 2))], { target: 'all_enemies' }),
  A('last_lantern', '长夜终灯', 'combo', 2, [hit(20), when(attacks(2), hit(12))], [hit(26), when(attacks(2), hit(16))]),
  S('unbroken_stride', '不息步伐', 'combo', 0, [draw(2), when(attacks(3), status('echo', 1))], [draw(3), when(attacks(3), status('echo', 1))], { exhaust: true }),
  P('vanguard_oath', '先锋誓言', 'combo', 2, [status('vanguardCycle', 4)], [status('vanguardCycle', 6)]),
  A('encircling_blades', '环刃', 'combo', 1, [hit(3, { times: 4 }), when(attacks(2), status('energyNext', 1))], [hit(4, { times: 4 }), when(attacks(2), status('energyNext', 2))]),
  P('steadfast_guard', '不动阵地', 'bulwark', 2, [status('metallicize', 6), status('thorns', 4)], [status('metallicize', 8), status('thorns', 5)]),
  S('bastion_oath', '壁垒誓约', 'bulwark', 2, [block(18), status('barricade', 1)], [block(24), status('barricade', 1)], { exhaust: true }),
  A('iron_rebuke', '铁壁回敬', 'bulwark', 2, [{ kind: 'damageByBlock', bonus: 6, mult: 2 }, status('weak', 2, 'target')], [{ kind: 'damageByBlock', bonus: 10, mult: 2 }, status('weak', 3, 'target')]),
  S('lantern_shelter', '灯下庇护', 'bulwark', 1, [ember(-3), { kind: 'clearDebuffs' }, block(20)], [ember(-3), { kind: 'clearDebuffs' }, block(28)], { requireEmber: 3, retain: true }),
  P('long_road', '漫长守望', 'bulwark', 2, [status('patientGuard', 8)], [status('patientGuard', 11)]),
  A('dawn_charge', '破晓冲锋', 'combo', 2, [hit(12, { aoe: true }), ember(3), when(attacks(2), status('energyNext', 2))], [hit(16, { aoe: true }), ember(4), when(attacks(2), status('energyNext', 2))], { target: 'all_enemies' }),
]);

// 拾灰者：点火、控场与消耗回收；高收益治疗和资源牌均限制重复使用。
add('picker', 'common', [
  A('cinder_hook', '火钳勾击', 'cinder', 1, [when(burning, draw(1)), hit(7), status('burn', 2, 'target')], [when(burning, draw(1)), hit(10), status('burn', 3, 'target')]),
  A('charred_dart', '炭刺', 'cinder', 0, [hit(3), when(burning, block(2))], [hit(5), when(burning, block(3))]),
  S('smoke_screen', '烟屏', 'cinder', 1, [block(6), { kind: 'blockPerBurn', amount: 1, max: 8 }, status('weak', 1, 'target')], [block(9), { kind: 'blockPerBurn', amount: 1, max: 12 }, status('weak', 1, 'target')], { target: 'enemy' }),
  S('tend_coals', '拨炭', 'cinder', 1, [status('burn', 3, 'target'), draw(1)], [status('burn', 4, 'target'), draw(1)], { target: 'enemy' }),
  A('scalding_sweep', '灼灰横扫', 'cinder', 1, [hit(4, { aoe: true }), status('burn', 1, 'all')], [hit(6, { aoe: true }), status('burn', 1, 'all')], { target: 'all_enemies' }),
  S('coal_wrap', '裹炭', 'cinder', 1, [block(8), when({ kind: 'emberAtLeast', value: 4 }, ember(2))], [block(11), when({ kind: 'emberAtLeast', value: 4 }, ember(2))]),
  A('furnace_breath', '炉口吐息', 'cinder', 2, [when(burning, block(6)), hit(18), status('burn', 4, 'target')], [when(burning, block(8)), hit(24), status('burn', 4, 'target')]),
  S('ash_shell', '灰壳', 'ash', 1, [exhaust(1), block(14), ember(2)], [exhaust(1), block(18), ember(3)], { exhaust: true }),
  A('shard_throw', '残片投掷', 'ash', 0, [hit(6), when({ kind: 'emberAtLeast', value: 3 }, ember(-2), recover(1))], [hit(9), when({ kind: 'emberAtLeast', value: 3 }, ember(-2), recover(1))], { exhaust: true }),
  S('salvage_scraps', '捡拾残页', 'ash', 1, [recover(1), block(4)], [recover(1), block(7)]),
  S('sift_ash', '筛灰', 'ash', 1, [exhaust(1), draw(2)], [exhaust(1), draw(3)]),
  S('pocket_coals', '藏炭', 'ash', 0, [exhaust(1), ember(3)], [exhaust(1), ember(4)], { exhaust: true }),
  A('buried_knife', '埋灰短刃', 'ash', 1, [hit(14), when({ kind: 'exhaustedThisTurn' }, { kind: 'returnExhausted', count: 1, selection: 'highestCost' })], [hit(19), when({ kind: 'exhaustedThisTurn' }, { kind: 'returnExhausted', count: 1, selection: 'highestCost' })], { exhaust: true }),
]);
add('picker', 'uncommon', [
  S('smoke_cover', '烟幕护身', 'cinder', 1, [exhaust(1), block(7), status('weak', 1, 'all')], [exhaust(1), block(10), status('weak', 2, 'all')]),
  A('flashpoint', '燃点', 'cinder', 1, [hit(8), when(burning, status('vulnerable', 2, 'target'))], [hit(12), when(burning, status('vulnerable', 2, 'target'))]),
  A('coal_lance', '炭火长枪', 'cinder', 2, [{ kind: 'damagePerBurn', amount: 2 }, hit(14)], [{ kind: 'damagePerBurn', amount: 3 }, hit(18)]),
  S('black_smoke', '浓烟', 'cinder', 1, [exhaust(1), status('burn', 2, 'all'), status('weak', 1, 'all')], [exhaust(1), status('burn', 3, 'all'), status('weak', 2, 'all')]),
  S('firebreak', '隔火带', 'cinder', 1, [status('burn', 2, 'target'), { kind: 'blockPerBurn', amount: 2, max: 18 }], [status('burn', 3, 'target'), { kind: 'blockPerBurn', amount: 2, max: 24 }], { target: 'enemy' }),
  P('coal_heart', '炉灰余温', 'cinder', 1, [status('pyre', 1)], [status('pyre', 2)]),
  S('ember_salvage', '烬中寻宝', 'ash', 1, [recover(2), ember(1)], [recover(3), ember(1)], { exhaust: true }),
  A('scrap_volley', '碎片齐射', 'ash', 1, [{ kind: 'exhaustHand', count: 1, energyPerCard: 1 }, hit(8, { aoe: true })], [{ kind: 'exhaustHand', count: 1, energyPerCard: 1 }, hit(12, { aoe: true })], { target: 'all_enemies', exhaust: true }),
  S('burial_veil', '葬灰帷幕', 'ash', 1, [exhaust(2), block(13), draw(1)], [exhaust(2), block(18), draw(2)]),
  S('reclaimed_spark', '回收火星', 'ash', 1, [recover(1), status('energyNext', 1)], [recover(1), status('energyNext', 2)], { exhaust: true }),
  A('ash_carver', '刻灰刀', 'ash', 1, [hit(9), recover(1)], [hit(13), recover(1)]),
  P('sheltering_ash', '积灰护甲', 'ash', 1, [status('ashFeast', 3), status('metallicize', 3)], [status('ashFeast', 4), status('metallicize', 4)]),
]);
add('picker', 'rare', [
  S('flashover', '火线蔓延', 'cinder', 2, [status('burn', 6, 'target'), { kind: 'spreadBurn' }], [status('burn', 8, 'target'), { kind: 'spreadBurn' }], { target: 'enemy' }),
  A('funeral_pyre', '送葬火炬', 'cinder', 2, [{ kind: 'consumeBurn', damagePer: 4 }, hit(14), status('burn', 5, 'target')], [{ kind: 'consumeBurn', damagePer: 5 }, hit(18), status('burn', 7, 'target')]),
  S('choking_embers', '窒息余火', 'cinder', 2, [status('burn', 6, 'all'), status('weak', 2, 'all'), status('frail', 2, 'all')], [status('burn', 8, 'all'), status('weak', 3, 'all'), status('frail', 3, 'all')]),
  S('white_hot', '白热', 'cinder', 1, [{ kind: 'burnToEmber', amount: 1, max: 10 }, energy(1), draw(2)], [{ kind: 'burnToEmber', amount: 1, max: 14 }, energy(1), draw(3)], { target: 'enemy', exhaust: true }),
  P('undying_furnace', '不息炉膛', 'cinder', 2, [status('emberConduit', 6)], [status('emberConduit', 9)]),
  P('ash_reserve', '灰烬储备', 'ash', 1, [block(8), status('ashRecall', 8)], [block(12), status('ashRecall', 12)]),
  S('last_salvage', '终末打捞', 'ash', 1, [recover(3), block(10), status('energyNext', 1)], [recover(4), block(14), status('energyNext', 2)], { exhaust: true }),
  S('phoenix_breath', '灰中复苏', 'ash', 1, [exhaust(2), { kind: 'heal', amount: 12 }], [exhaust(2), { kind: 'heal', amount: 16 }], { exhaust: true }),
  A('ash_storm', '灰暴', 'ash', 2, [hit(16, { aoe: true }), exhaust(1), draw(2)], [hit(22, { aoe: true }), exhaust(1), draw(3)], { target: 'all_enemies', exhaust: true }),
  S('empty_the_satchel', '倾尽行囊', 'ash', 0, [{ kind: 'exhaustHand', count: 'all', energyPerCard: 1 }, draw(3)], [{ kind: 'exhaustHand', count: 'all', energyPerCard: 1 }, draw(4)], { exhaust: true }),
  A('embers_requiem', '残烬挽歌', 'ash', 2, [exhaust(1), hit(10, { times: 2 }), recover(2)], [exhaust(1), hit(13, { times: 2 }), recover(2)], { exhaust: true }),
]);

// 血誓者：低费失血换节奏，回复与护甲托住风险，力量构筑拥有多段与群攻出口。
add('oathbound', 'common', [
  S('crimson_step', '猩红步', 'blood', 0, [lose(2), block(6)], [lose(2), block(8)]),
  A('scar_cut', '伤疤斩', 'blood', 1, [hit(8), when(wounded, ember(2))], [hit(11), when(wounded, ember(2))]),
  S('blood_insight', '痛中醒悟', 'blood', 1, [draw(2), when(wounded, block(4))], [draw(2), when(wounded, block(7))]),
  A('crimson_thrust', '猩红突刺', 'blood', 1, [hit(10), when(wounded, status('vulnerable', 2, 'target'))], [hit(14), when(wounded, status('vulnerable', 2, 'target'))]),
  S('bind_wounds', '裹伤', 'blood', 1, [block(9), when(wounded, draw(1))], [block(12), when(wounded, draw(1))]),
  A('blood_sip', '血滴', 'blood', 0, [lose(1), hit(5, { lifesteal: true })], [lose(1), hit(7, { lifesteal: true })], { exhaust: true }),
  S('ember_pulse', '烬血脉动', 'blood', 0, [lose(2), ember(2)], [lose(2), ember(3)]),
  A('line_breaker', '破阵横扫', 'might', 2, [strength(2), hit(7, { aoe: true }), when(wounded, block(6))], [strength(3), hit(10, { aoe: true }), when(wounded, block(8))], { target: 'all_enemies' }),
  A('double_punch', '双拳', 'might', 1, [hit(4, { times: 2 }), strength(1)], [hit(6, { times: 2 }), strength(1)]),
  S('battle_breath', '战息', 'might', 1, [block(7), strength(1)], [block(10), strength(2)]),
  A('iron_elbow', '铁肘', 'might', 1, [hit(6), block(4), when({ kind: 'strengthAtLeast', value: 3 }, block(6))], [hit(9), block(6), when({ kind: 'strengthAtLeast', value: 3 }, block(8))]),
  A('threatening_cut', '威吓斩', 'might', 1, [hit(8), when({ kind: 'strengthAtLeast', value: 3 }, status('weak', 2, 'target'))], [hit(11), when({ kind: 'strengthAtLeast', value: 3 }, status('weak', 3, 'target'))]),
  S('gather_fury', '聚怒', 'might', 0, [strength(2), when(wounded, draw(1))], [strength(3), when(wounded, draw(1))], { exhaust: true }),
]);
add('oathbound', 'uncommon', [
  S('oath_reenactment', '血誓重演', 'blood', 2, [{ kind: 'replayDiscard' }], [{ kind: 'replayDiscard' }], { exhaust: true, upgradeCost: 1 }),
  A('blood_reckoning', '血债追偿', 'blood', 1, [hit(8), when(wounded, draw(2))], [hit(12), when(wounded, draw(2))]),
  S('scar_shield', '伤痕盾', 'blood', 1, [lose(3), block(14), status('thorns', 1)], [lose(3), block(19), status('thorns', 2)]),
  A('vein_cutter', '割脉刃', 'blood', 2, [hit(11, { lifesteal: true }), status('weak', 1, 'target')], [hit(15, { lifesteal: true }), status('weak', 2, 'target')], { exhaust: true }),
  S('pain_trade', '以痛换势', 'blood', 0, [lose(4), energy(2)], [lose(3), energy(2)], { exhaust: true }),
  A('scar_echo', '旧伤回响', 'blood', 1, [{ kind: 'damagePerHpLost', mult: 2 }, draw(1)], [{ kind: 'damagePerHpLost', mult: 3 }, draw(2)], { retain: true }),
  P('blood_watch', '血色守望', 'blood', 1, [status('bloodArmor', 3)], [status('bloodArmor', 4)]),
  S('battle_readiness', '战意整备', 'might', 1, [block(8), status('strength', 1), when(wounded, status('energyNext', 1))], [block(11), status('strength', 2), when(wounded, status('energyNext', 1))], { exhaust: true }),
  A('splinter_armor', '裂甲重击', 'might', 1, [hit(5, { strengthMult: 1 }), status('vulnerable', 2, 'target')], [hit(8, { strengthMult: 1 }), status('vulnerable', 2, 'target')]),
  A('hammer_rain', '乱锤', 'might', 2, [hit(6, { times: 3 }), when(wounded, strength(2))], [hit(8, { times: 3 }), when(wounded, strength(3))]),
  S('battle_orders', '战吼号令', 'might', 1, [strength(3), status('weak', 1, 'all')], [strength(4), status('weak', 1, 'all')]),
  A('crushing_stride', '碾踏', 'might', 2, [hit(10, { aoe: true }), status('vulnerable', 1, 'all'), when(wounded, block(8))], [hit(13, { aoe: true }), status('vulnerable', 2, 'all'), when(wounded, block(10))], { target: 'all_enemies' }),
  S('unshaken', '岿然', 'might', 1, [{ kind: 'clearDebuffs' }, block(9)], [{ kind: 'clearDebuffs' }, block(13)], { exhaust: true }),
]);
add('oathbound', 'rare', [
  S('oath_renewal', '誓血回生', 'blood', 1, [lose(4), status('regen', 5)], [lose(4), status('regen', 6)], { exhaust: true }),
  A('scarlet_harvest', '猩红收割', 'blood', 2, [hit(9, { aoe: true, lifesteal: true }), when(wounded, status('regen', 2))], [hit(13, { aoe: true, lifesteal: true }), when(wounded, status('regen', 3))], { target: 'all_enemies', exhaust: true }),
  S('final_offering', '最后献礼', 'blood', 0, [lose(4), { kind: 'discardRandom', count: 'all' }, draw(5)], [lose(3), { kind: 'discardRandom', count: 'all' }, draw(6)], { exhaust: true }),
  P('crimson_covenant', '血色盟约', 'blood', 1, [status('bloodOath', 2)], [status('bloodOath', 3)]),
  A('oath_judgement', '誓约裁决', 'blood', 2, [lose(3), hit(14), { kind: 'damagePerHpLost', mult: 4 }], [lose(3), hit(20), { kind: 'damagePerHpLost', mult: 5 }]),
  S('redoubt_of_blood', '血筑堡垒', 'blood', 2, [lose(4), block(24), status('barricade', 1)], [lose(4), block(30), status('barricade', 1)], { exhaust: true }),
  A('mountain_splitter', '断岳', 'might', 2, [{ kind: 'doubleStatus', status: 'strength', target: 'self' }, hit(12, { strengthMult: 1 })], [{ kind: 'doubleStatus', status: 'strength', target: 'self' }, hit(16, { strengthMult: 1 })], { exhaust: true }),
  A('titan_blows', '巨人连击', 'might', 3, [strength(2), hit(5, { times: 4 }), status('weak', 1, 'target')], [strength(3), hit(7, { times: 4 }), status('weak', 2, 'target')]),
  P('war_avatar', '战意化身', 'might', 1, [status('furyWard', 12)], [status('furyWard', 18)]),
  S('unstoppable_rage', '不可阻挡', 'might', 1, [lose(3), strength(6), draw(2)], [lose(3), strength(8), draw(3)], { exhaust: true }),
  A('earthbreaker', '撼地', 'might', 2, [hit(15, { strengthMult: 1, aoe: true }), status('weak', 2, 'all')], [hit(20, { strengthMult: 1, aoe: true }), status('weak', 3, 'all')], { target: 'all_enemies' }),
  P('iron_blooded', '铁血', 'might', 2, [status('temperedMight', 2)], [status('temperedMight', 3)]),
]);

// 灰语学者：回响放大组合牌，保留蓄力牌提供跨回合规划。
add('scholar', 'common', [
  S('echo_veil', '余响护幕', 'echo', 1, [block(8), when(echo, draw(1))], [block(12), when(echo, draw(1))]),
  A('whisper_needle', '低语针', 'echo', 0, [hit(2), when(echo, ember(1))], [hit(4), when(echo, ember(1))]),
  A('reverberant_cut', '震音斩', 'echo', 1, [hit(9), { kind: 'blockPerHand', amount: 2, max: 8 }], [hit(12), { kind: 'blockPerHand', amount: 2, max: 12 }]),
  S('quiet_sentence', '静默句', 'echo', 1, [status('weak', 2, 'target'), draw(1)], [status('weak', 3, 'target'), draw(1)], { target: 'enemy' }),
  A('rune_splinters', '符文碎屑', 'echo', 1, [hit(4, { aoe: true }), ember(1), when(echo, draw(1))], [hit(6, { aoe: true }), ember(2), when(echo, draw(1))], { target: 'all_enemies' }),
  S('listen_to_ash', '听灰', 'echo', 0, [exhaust(1), draw(2), when(echo, ember(2))], [exhaust(1), draw(3), when(echo, ember(3))], { exhaust: true }),
  A('inscribed_edge', '铭文刃', 'echo', 1, [hit(6), status('vulnerable', 1, 'target'), when(echo, block(4))], [hit(9), status('vulnerable', 2, 'target'), when(echo, block(6))]),
  A('surge_glyph', '蓄光', 'focus', 1, [hit(5), block(5)], [hit(7), block(7)], { retain: true, charge: { damage: 2, block: 2 } }),
  S('folded_ward', '折页护符', 'focus', 0, [block(3), when(echo, status('energyNext', 1))], [block(5), when(echo, status('energyNext', 1))], { retain: true, charge: { block: 2 }, exhaust: true }),
  S('patient_study', '耐心研读', 'focus', 1, [draw(2)], [draw(3)], { retain: true }),
  A('stored_spark', '封存火花', 'focus', 0, [hit(4), ember(1), status('energyNext', 1)], [hit(6), ember(2), status('energyNext', 1)], { retain: true, exhaust: true }),
  S('measured_breath', '调息', 'focus', 1, [block(8), status('energyNext', 1)], [block(11), status('energyNext', 1)]),
  A('delayed_thrust', '迟发刺', 'focus', 1, [hit(9), when(charged, status('vulnerable', 1, 'target'))], [hit(12), when(charged, status('vulnerable', 2, 'target'))], { retain: true, charge: { damage: 2 } }),
  S('ink_reserve', '储墨', 'focus', 1, [block(5), ember(2), when(echo, status('energyNext', 1))], [block(8), ember(3), when(echo, status('energyNext', 1))], { retain: true }),
]);
add('scholar', 'uncommon', [
  A('refracted_blade', '折光刃', 'echo', 1, [when(echo, { kind: 'doubleStatus', status: 'vulnerable' }), hit(6, { times: 2 })], [when(echo, { kind: 'doubleStatus', status: 'vulnerable' }), hit(8, { times: 2 })]),
  S('harmonic_shield', '和声盾', 'echo', 1, [block(11), when(echo, ember(3))], [block(15), when(echo, ember(4))]),
  A('resounding_bell', '鸣钟', 'echo', 2, [hit(16, { aoe: true }), when(echo, status('energyNext', 1))], [hit(22, { aoe: true }), when(echo, status('energyNext', 2))], { target: 'all_enemies' }),
  S('woven_words', '编织咒语', 'echo', 1, [draw(2), { kind: 'blockPerHand', amount: 2, max: 12 }], [draw(3), { kind: 'blockPerHand', amount: 2, max: 16 }]),
  P('opening_chord', '开篇和弦', 'echo', 1, [status('echo', 2), block(6)], [status('echo', 3), block(8)]),
  A('fractured_rune', '破碎符文', 'echo', 1, [hit(8), when(echo, { kind: 'chargeHand', amount: 1 })], [hit(12), when(echo, { kind: 'chargeHand', amount: 1 })]),
  S('sealed_page', '封存咒页', 'focus', 0, [status('energyNext', 2)], [status('energyNext', 3)], { retain: true, exhaust: true }),
  S('crystal_barrier', '晶壁', 'focus', 2, [block(18), draw(1)], [block(24), draw(1)], { retain: true, charge: { block: 4 } }),
  A('constellation_arrow', '星图箭', 'focus', 1, [hit(9), status('weak', 1, 'target')], [hit(12), status('weak', 2, 'target')], { retain: true, charge: { damage: 3 } }),
  S('rune_cache', '符文储匣', 'focus', 1, [status('energyNext', 2), recover(1)], [status('energyNext', 3), recover(1)], { exhaust: true }),
  A('orbital_shards', '环绕碎晶', 'focus', 1, [hit(6, { aoe: true }), when(charged, block(6))], [hit(9, { aoe: true }), when(charged, block(9))], { target: 'all_enemies', retain: true, charge: { damage: 2 } }),
  P('quiet_observatory', '寂静观测', 'focus', 1, [status('arcaneWard', 1), status('metallicize', 4)], [status('arcaneWard', 2), status('metallicize', 5)]),
]);
add('scholar', 'rare', [
  P('silent_prelude', '寂静序曲', 'echo', 2, [status('chargedEcho', 6)], [status('chargedEcho', 9)]),
  A('endless_sentence', '长句终结', 'echo', 2, [hit(5, { times: 3 }), when(echo, draw(2))], [hit(7, { times: 3 }), when(echo, draw(3))]),
  S('grand_recitation', '宏大咏唱', 'echo', 1, [draw(3), ember(3), status('echo', 1)], [draw(4), ember(4), status('echo', 1)], { exhaust: true }),
  A('shattered_chorus', '破碎合唱', 'echo', 2, [{ kind: 'consumeVulnerable', damagePer: 6, aoe: true }, hit(18, { aoe: true })], [{ kind: 'consumeVulnerable', damagePer: 8, aoe: true }, hit(26, { aoe: true })], { target: 'all_enemies' }),
  P('living_manuscript', '活页秘典', 'echo', 2, [status('repriseStudy', 2)], [status('repriseStudy', 3)]),
  A('falling_stars', '群星坠落', 'focus', 2, [hit(14, { aoe: true }), status('vulnerable', 2, 'all'), status('energyNext', 1)], [hit(18, { aoe: true }), status('vulnerable', 3, 'all'), status('energyNext', 1)], { target: 'all_enemies', retain: true, charge: { damage: 3 } }),
  S('timeless_ward', '恒久护印', 'focus', 1, [block(16), status('energyNext', 2)], [block(22), status('energyNext', 3)], { retain: true, charge: { block: 3 }, exhaust: true }),
  S('future_memory', '未来记忆', 'focus', 0, [draw(2), { kind: 'chargeHand', amount: 2 }], [draw(3), { kind: 'chargeHand', amount: 3 }], { retain: true, exhaust: true }),
  A('singularity', '归一', 'focus', 2, [hit(18, { perHandCard: 3 }), { kind: 'discardRandom', count: 'all' }], [hit(24, { perHandCard: 4 }), { kind: 'discardRandom', count: 'all' }], { retain: true, charge: { damage: 4 } }),
  P('astral_shelter', '星界庇护', 'focus', 2, [status('retainedWard', 6)], [status('retainedWard', 9)]),
  S('sealed_sanctuary', '封印圣所', 'focus', 2, [block(22), status('regen', 3)], [block(28), status('regen', 4)], { retain: true, exhaust: true }),
]);


// 角色资源转换：真实支付护甲/燃烧/临时力量/蓄力，或核销本回合计数。
// 计数兑换不改变连击等原有触发，且不会因回响、重放或回收重复核销。
const convert = (resource: Extract<Effect, { kind: 'convertResource' }>['resource'], per: number, max: number, reward: 'draw' | 'energy'): Effect => ({ kind: 'convertResource', resource, per, max, reward });
add('traveler', 'uncommon', [
  S('trail_supply', '战途补给', 'combo', 0, [convert('attacks', 1, 2, 'draw')], [convert('attacks', 1, 3, 'draw')], { exhaust: true }),
  S('unburden_armor', '卸甲疾行', 'bulwark', 0, [convert('block', 10, 2, 'energy')], [convert('block', 10, 3, 'energy')], { exhaust: true }),
]);
add('picker', 'uncommon', [
  S('ash_index', '灰中索引', 'ash', 0, [convert('exhausts', 1, 3, 'draw')], [convert('exhausts', 1, 4, 'draw')], { exhaust: true }),
  S('borrow_flame', '借火鼓风', 'cinder', 0, [convert('burn', 4, 2, 'energy')], [convert('burn', 4, 3, 'energy')], { target: 'enemy', exhaust: true }),
]);
add('oathbound', 'uncommon', [
  S('pulse_memory', '回脉忆战', 'blood', 0, [convert('healing', 2, 3, 'draw')], [convert('healing', 2, 4, 'draw')], { exhaust: true }),
  S('borrow_fury', '借怒', 'might', 0, [convert('tempStrength', 2, 2, 'energy')], [convert('tempStrength', 2, 3, 'energy')], { exhaust: true }),
]);
add('scholar', 'uncommon', [
  S('echo_footnotes', '回声批注', 'echo', 0, [convert('echoes', 1, 3, 'draw')], [convert('echoes', 1, 4, 'draw')], { exhaust: true }),
  S('release_charge', '释能演算', 'focus', 0, [convert('charge', 2, 2, 'energy')], [convert('charge', 2, 3, 'energy')], { exhaust: true }),
]);
