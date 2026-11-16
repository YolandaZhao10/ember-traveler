import { describe, expect, it } from 'vitest';
import { CARD_LIST } from '../data/cards';
import { CHARACTER_LIST, CHARACTERS } from '../data/characters';
import { describeCard, statusDescription, viewCard, viewDef } from '../engine/cards';
import { canPlayCard, createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { KINDRED_VOW_AT, signatureCount } from '../engine/signature';
import type { CardInstance, CharacterId, CombatState, Effect } from '../engine/types';

const card = (defId: string, upgraded = false, uid = defId): CardInstance => ({ uid, defId, upgraded });
function battle(character: CharacterId, ids: string[], enemies = 1): CombatState {
  const cs = createCombat('kindred', Array.from({ length: enemies }, () => 'tomb_puppet'), 'normal', [], 500, 500, [], makeRng('KINDRED', 'c'), 100, character).state;
  cs.enemies.forEach(e => { e.hp = e.maxHp = 100000; e.block = 0; e.statuses = {}; });
  cs.player.hand = ids.map((id, i) => card(id, false, `${id}-${i}`));
  cs.player.draw = Array.from({ length: 12 }, (_, i) => card('defend', false, `draw-${i}`));
  cs.player.energy = 9;
  return cs;
}
function use(cs: CombatState, uid: string): CombatState {
  const c = cs.player.hand.find(c => c.uid === uid)!;
  const next = playCard(cs, uid, viewCard(c).target === 'enemy' ? 'e0' : null).state;
  expect(next, `${uid} 应能打出`).not.toBe(cs);
  return next;
}
function round(input: CombatState): CombatState {
  let cs = endPlayerTurn(input).state;
  for (const id of cs.enemies.map(e => e.id)) cs = enemyAct(cs, id).state;
  return startPlayerTurn(cs).state;
}
const lost = (cs: CombatState, index = 0) => 100000 - cs.enemies[index].hp;
const withCount = (cs: CombatState, count: number) => { cs.player.turnFlags.signature = count; return cs; };

describe('各角色的招牌动作计数', () => {
  it('旅人：只有打出时已有格挡的攻击牌才计 1 次，本牌自己获得的格挡和技能牌都不算；回合开始清零', () => {
    let cs = battle('traveler', ['strike', 'strike', 'defend', 'cross_guard', 'strike']);
    cs = use(cs, 'strike-0');
    expect(signatureCount(cs.player)).toBe(0);
    cs = use(cs, 'cross_guard-3');
    expect(cs.player.block).toBeGreaterThan(0);
    expect(signatureCount(cs.player)).toBe(0);
    cs = use(cs, 'defend-2');
    expect(signatureCount(cs.player)).toBe(0);
    cs = use(cs, 'strike-1');
    expect(signatureCount(cs.player)).toBe(1);
    // 回响重放是又一次出牌，同样计数。
    cs.player.statuses.echo = 1;
    cs = use(cs, 'strike-4');
    expect(signatureCount(cs.player)).toBe(3);
    expect(signatureCount(round(cs).player)).toBe(0);
  });

  it('拾灰者：每有一张牌被消耗计 1 次，自身消耗也算；其他角色消耗牌不计数', () => {
    let cs = battle('picker', ['pick_up', 'ember_gust', 'strike', 'defend']);
    cs = use(cs, 'pick_up-0');
    expect(signatureCount(cs.player)).toBe(1);
    cs = use(cs, 'ember_gust-1');
    expect(signatureCount(cs.player)).toBe(3);
    expect(cs.player.turnFlags.exhausted).toBe(3);
    const other = use(battle('traveler', ['ember_gust', 'strike']), 'ember_gust-0');
    expect(other.player.turnFlags.exhausted).toBe(2);
    expect(signatureCount(other.player)).toBe(0);
  });

  it('拾灰者：每打出一张以自身效果对敌人施加燃烧的牌也计 1 次，按牌而不按层数；能力带出的燃烧不算', () => {
    let cs = battle('picker', ['light_up', 'ignite', 'add_fuel', 'strike']);
    cs = use(cs, 'light_up-0');
    expect(cs.enemies[0].statuses.burn).toBe(3);
    expect(signatureCount(cs.player)).toBe(1);
    cs = use(cs, 'strike-3');
    expect(signatureCount(cs.player)).toBe(1);
    // 回响重放是又一次出牌，再计一次。
    cs.player.statuses.echo = 1;
    cs = use(cs, 'ignite-1');
    expect(signatureCount(cs.player)).toBe(3);
    // 添油让已有燃烧翻倍算施加燃烧，本牌消耗另计。
    cs = use(cs, 'add_fuel-2');
    expect(signatureCount(cs.player)).toBe(5);
    // 目标没有燃烧时添油没有施加任何燃烧，只算自身消耗。
    expect(signatureCount(use(battle('picker', ['add_fuel']), 'add_fuel-0').player)).toBe(1);
    // 炉膛导流在出牌过程中给敌人上了燃烧，但不是这张牌自身的效果。
    const conduit = battle('picker', ['ember_exchange']);
    conduit.player.ember = 3; conduit.player.statuses.emberConduit = 6;
    const after = use(conduit, 'ember_exchange-0');
    expect(after.enemies[0].statuses.burn).toBe(6);
    expect(signatureCount(after.player)).toBe(1);
    // 其他角色施加燃烧不计数。
    expect(signatureCount(use(battle('traveler', ['ignite']), 'ignite-0').player)).toBe(0);
  });

  it('血誓者：每次因卡牌失去生命计 2 次，单次失去 4 点以上计 3 次，生命代付同样算', () => {
    let cs = battle('oathbound', ['ember_pulse', 'pain_trade', 'ember_blade', 'strike']);
    cs = use(cs, 'ember_pulse-0');
    expect(signatureCount(cs.player)).toBe(2);
    cs = use(cs, 'pain_trade-1');
    expect(signatureCount(cs.player)).toBe(5);
    // 余烬足够时灰烬之刃不失血，不计数。
    expect(signatureCount(use(cs, 'ember_blade-2').player)).toBe(5);
    cs.player.ember = 0;
    cs = use(cs, 'ember_blade-2');
    expect(signatureCount(cs.player)).toBe(8);
    // 敌人造成的伤害不是因卡牌失去生命。
    const hit = endPlayerTurn(battle('oathbound', ['strike'])).state;
    expect(signatureCount(enemyAct(hit, 'e0').state.player)).toBe(0);
  });

  it('血誓者：每打出一张以自身效果获得临时力量的牌也计 2 次，按牌而不按点数；永久力量和能力带出的临时力量不算', () => {
    let cs = battle('oathbound', ['flex', 'frenzy', 'inflame', 'blood_fury', 'strike']);
    cs = use(cs, 'flex-0');
    expect(signatureCount(cs.player)).toBe(2);
    cs = use(cs, 'frenzy-1');
    expect(cs.player.statuses.strengthDown).toBe(5);
    expect(signatureCount(cs.player)).toBe(4);
    // 怒吼给的是永久力量。
    cs = use(cs, 'inflame-2');
    expect(signatureCount(cs.player)).toBe(4);
    // 血怒既失去 3 点生命又获得临时力量，两个动作各计一次。
    cs = use(cs, 'blood_fury-3');
    expect(signatureCount(cs.player)).toBe(8);
    // 火星加冕在消耗余烬时带出的临时力量不是这张牌自身的效果。
    const crowned = battle('oathbound', ['ember_blade']);
    crowned.player.ember = 2; crowned.player.statuses.sparkCrown = 4;
    const after = use(crowned, 'ember_blade-0');
    expect(after.player.statuses.strengthDown).toBe(2);
    expect(signatureCount(after.player)).toBe(0);
    // 其他角色获得临时力量不计数。
    const traveler = use(use(battle('traveler', ['chain_slash', 'strike']), 'strike-1'), 'chain_slash-0');
    expect(traveler.player.statuses.strengthDown).toBe(2);
    expect(signatureCount(traveler.player)).toBe(0);
  });

  it('血誓者一次大额失血就达到 3 次计数，直接触发旅途誓火；两次小额失血在第二次触发', () => {
    let heavy = battle('oathbound', ['pain_trade', 'ember_pulse']);
    heavy.player.statuses.kindredVow = 1;
    heavy = use(heavy, 'pain_trade-0');
    // 以痛换势自带 2 能量，再加旅途誓火的 1 能量与 1 张牌。
    expect([signatureCount(heavy.player), heavy.player.energy, heavy.player.hand.length]).toEqual([3, 12, 2]);
    expect(use(heavy, 'ember_pulse-1').player.energy).toBe(12);

    let light = battle('oathbound', ['ember_pulse', 'ember_pulse']);
    light.player.statuses.kindredVow = 1;
    light = use(light, 'ember_pulse-0');
    expect([signatureCount(light.player), light.player.energy, light.player.hand.length]).toEqual([2, 9, 1]);
    light = use(light, 'ember_pulse-1');
    expect([signatureCount(light.player), light.player.energy, light.player.hand.length]).toEqual([4, 10, 1]);
  });

  it('灰语学者：每次完成回响或镜像重放、每打出一张蓄力 ≥2 的牌各计 2 次', () => {
    let cs = battle('scholar', ['strike', 'charged_blade', 'charged_blade', 'strike', 'charged_blade']);
    cs.player.statuses.echo = 1;
    cs = use(cs, 'strike-0');
    expect(signatureCount(cs.player)).toBe(2);
    cs.player.hand.find(c => c.uid === 'charged_blade-1')!.bonus = 1;
    cs = use(cs, 'charged_blade-1');
    expect(signatureCount(cs.player)).toBe(2);
    cs.player.hand.find(c => c.uid === 'charged_blade-2')!.bonus = 2;
    cs = use(cs, 'charged_blade-2');
    expect(signatureCount(cs.player)).toBe(4);
    // 镜像每回合触发一次重放。
    cs = round(cs);
    cs.player.hand.push(card('strike', false, 'mirrored'), card('charged_blade', false, 'both'));
    cs.player.energy = 9; cs.player.statuses.mirror = 1;
    cs = use(cs, 'mirrored');
    expect(signatureCount(cs.player)).toBe(2);
    // 带回响打出蓄力牌：打出计一次，重放再计一次。
    cs.player.statuses.echo = 1;
    cs.player.hand.find(c => c.uid === 'both')!.bonus = 3;
    cs = use(cs, 'both');
    expect(signatureCount(cs.player)).toBe(6);
  });
});

describe.each([false, true])('共鸣牌按招牌动作次数结算，升级=%s', up => {
  const kin = (cs: CombatState, id: string) => { cs.player.hand.find(c => c.defId === id)!.upgraded = up; return cs; };

  it('火种共鸣每次计数 +3 伤害，最多 +12；本牌自己的这次出牌不计入自身', () => {
    const base = up ? 8 : 5;
    expect(lost(use(kin(battle('traveler', ['kindred_spark']), 'kindred_spark'), 'kindred_spark-0'))).toBe(base);
    expect(lost(use(kin(withCount(battle('traveler', ['kindred_spark']), 2), 'kindred_spark'), 'kindred_spark-0'))).toBe(base + 6);
    expect(lost(use(kin(withCount(battle('traveler', ['kindred_spark']), 9), 'kindred_spark'), 'kindred_spark-0'))).toBe(base + 12);
    const guarded = kin(battle('traveler', ['kindred_spark']), 'kindred_spark'); guarded.player.block = 5;
    const after = use(guarded, 'kindred_spark-0');
    expect(lost(after)).toBe(base);
    expect(signatureCount(after.player)).toBe(1);
  });

  it('同源余火按计数给余烬，最多 4 点；没有计数时灰烬沙漏也不白给', () => {
    const play = (count: number) => {
      const cs = kin(withCount(battle('picker', ['kindred_afterglow']), count), 'kindred_afterglow');
      cs.relics = ['ash_hourglass'];
      return use(cs, 'kindred_afterglow-0').player;
    };
    expect([play(0).block, play(0).ember]).toEqual([up ? 9 : 6, 0]);
    expect(play(3).ember).toBe(4);
    expect(play(9).ember).toBe(5);
  });

  it('黎明前夜计数达到 4 时再打一次群体伤害并获得 3 余烬', () => {
    const base = up ? 16 : 12;
    const low = use(kin(withCount(battle('oathbound', ['kindred_dawn'], 2), 3), 'kindred_dawn'), 'kindred_dawn-0');
    expect([lost(low, 0), lost(low, 1), low.player.ember]).toEqual([base, base, 0]);
    const high = use(kin(withCount(battle('oathbound', ['kindred_dawn'], 2), 4), 'kindred_dawn'), 'kindred_dawn-0');
    expect([lost(high, 0), lost(high, 1), high.player.ember]).toEqual([base + 12, base + 12, 3]);
  });

  it('余烬回声达到门槛给 2 能量，否则给 2 余烬', () => {
    const threshold = up ? 2 : 3;
    const under = use(kin(withCount(battle('traveler', ['kindred_refrain']), threshold - 1), 'kindred_refrain'), 'kindred_refrain-0');
    expect([under.player.energy, under.player.ember]).toEqual([9, 2]);
    const met = use(kin(withCount(battle('traveler', ['kindred_refrain']), threshold), 'kindred_refrain'), 'kindred_refrain-0');
    expect([met.player.energy, met.player.ember]).toEqual([11, 0]);
    expect(met.player.exhaust.map(c => c.defId)).toEqual(['kindred_refrain']);
  });
});

describe('给能量的效果每回合各只生效一次', () => {
  it('余烬回声被回响重放时，第二次结算改给余烬', () => {
    const cs = withCount(battle('traveler', ['kindred_refrain']), 3);
    cs.player.statuses.echo = 1;
    const after = use(cs, 'kindred_refrain-0');
    expect(after.player.cardsPlayedThisTurn).toBe(2);
    expect([after.player.energy, after.player.ember]).toEqual([11, 2]);
  });

  it('余烬回声同一回合取回后再打或再打第二张都只给余烬，下一回合恢复', () => {
    let cs = withCount(battle('traveler', ['kindred_refrain', 'kindred_refrain']), 5);
    cs = use(cs, 'kindred_refrain-0');
    expect([cs.player.energy, cs.player.ember]).toEqual([11, 0]);
    cs = use(cs, 'kindred_refrain-1');
    expect([cs.player.energy, cs.player.ember]).toEqual([11, 2]);
    // 从消耗区取回同一张牌，本回合仍不能再拿能量。
    cs = JSON.parse(JSON.stringify(cs));
    cs.player.hand.push(cs.player.exhaust.pop()!);
    cs = use(cs, cs.player.hand[cs.player.hand.length - 1].uid);
    expect([cs.player.energy, cs.player.ember]).toEqual([11, 4]);
    cs = withCount(round(cs), 3);
    cs.player.hand.push(card('kindred_refrain', false, 'next-turn'));
    const energy = cs.player.energy;
    expect(use(cs, 'next-turn').player.energy).toBe(energy + 2);
  });

  it('旅途誓火在本回合第 3 次计数时给 1 能量并抽 1 张，之后不再触发，下回合重新生效', () => {
    let cs = battle('traveler', ['kindred_vow', 'strike', 'strike', 'strike', 'strike']);
    cs.player.block = 50;
    cs = use(cs, 'kindred_vow-0');
    expect(viewDef('kindred_vow', true).cost).toBe(0);
    cs = use(use(cs, 'strike-1'), 'strike-2');
    expect([cs.player.energy, cs.player.hand.length]).toEqual([6, 2]);
    cs = use(cs, 'strike-3');
    expect(signatureCount(cs.player)).toBe(3);
    expect([cs.player.energy, cs.player.hand.length]).toEqual([6, 2]);
    cs = use(cs, 'strike-4');
    expect([cs.player.energy, cs.player.hand.length]).toEqual([5, 1]);
    cs = round(cs);
    cs.player.block = 50; cs.player.energy = 9;
    cs.player.hand = ['a', 'b', 'c'].map(uid => card('strike', false, uid));
    cs = use(use(use(cs, 'a'), 'b'), 'c');
    expect([cs.player.energy, cs.player.hand.length]).toEqual([7, 1]);
  });

  it('旅途誓火对一次计 2 的角色在越过门槛时触发一次；计数已过门槛后才打出则本回合不触发；叠加两张只放大这一次', () => {
    let cs = battle('scholar', ['strike', 'strike', 'strike']);
    cs.player.statuses.kindredVow = 1; cs.player.statuses.echo = 3;
    cs = use(cs, 'strike-0');
    expect([signatureCount(cs.player), cs.player.energy, cs.player.hand.length]).toEqual([2, 8, 2]);
    cs = use(cs, 'strike-1');
    expect([signatureCount(cs.player), cs.player.energy, cs.player.hand.length]).toEqual([4, 8, 2]);
    cs = use(cs, 'strike-2');
    expect([signatureCount(cs.player), cs.player.energy, cs.player.hand.length]).toEqual([6, 7, 1]);

    let late = withCount(battle('picker', ['kindred_vow', 'pick_up']), 3);
    late = use(use(late, 'kindred_vow-0'), 'pick_up-1');
    expect(signatureCount(late.player)).toBe(4);
    expect(late.player.energy).toBe(8);

    let stacked = withCount(battle('picker', ['pick_up', 'pick_up']), 2);
    stacked.player.statuses.kindredVow = 2;
    stacked = use(stacked, 'pick_up-0');
    // 拾取自身抽 1 张，再加旅途誓火的 2 张。
    expect([stacked.player.energy, stacked.player.hand.length]).toEqual([11, 4]);
    stacked = use(stacked, 'pick_up-1');
    expect(stacked.player.energy).toBe(11);
  });
});

describe('指定组合不会无限出牌：旅人的战鼓 + 鼓手之心 + 旅途誓火 + 余烬回声', () => {
  it('四个回能来源一回合合计最多 5 点能量；带大量零费攻击和余音连打十回合，每回合出牌数都有限', () => {
    const ids = ['war_drum', 'kindred_vow', 'tempo', 'kindred_refrain', 'kindred_refrain', 'raise_shield', 'raise_shield', ...Array(10).fill('quick_stab'), 'spin_kick', 'spin_kick'];
    const deck = ids.map((id, i) => card(id, false, `deck-${i}`));
    let cs = createCombat('kindred-loop', ['tomb_puppet'], 'normal', deck, 500, 500, ['drummer_heart'], makeRng('KINDRED-LOOP', 'c'), 100, 'traveler').state;
    cs.enemies[0].hp = cs.enemies[0].maxHp = 100000;
    const order = (c: CardInstance) => {
      const v = viewCard(c);
      // 先部署能力，再起盾，再打攻击；余烬回声留到攻击之后。
      return c.defId === 'kindred_refrain' ? 3 : v.type === 'power' ? 0 : v.type === 'skill' ? 1 : 2;
    };
    let maxPlays = 0, maxPaid = 0;
    for (let turn = 0; turn < 10 && cs.outcome === 'ongoing'; turn++) {
      let plays = 0, paid = 0;
      while (plays < 200) {
        const next = cs.player.hand.filter(c => canPlayCard(cs, c).ok).sort((a, b) => order(a) - order(b))[0];
        if (!next) break;
        paid += viewCard(next).cost;
        cs = use(cs, next.uid);
        plays++;
      }
      expect(plays, `第 ${turn + 1} 回合出牌没有停下`).toBeLessThan(200);
      maxPlays = Math.max(maxPlays, plays); maxPaid = Math.max(maxPaid, paid);
      cs.player.hp = cs.player.maxHp;
      cs = round(cs);
    }
    // 基础 3 能量 + 续势 1 + 鼓手之心 1 + 旅途誓火 1 + 余烬回声 2。
    expect(maxPaid).toBeLessThanOrEqual(8);
    expect(maxPlays).toBeLessThanOrEqual(30);
    expect(maxPlays).toBeGreaterThan(5);
  });

  it('同一回合里四个来源各自只回一次能量', () => {
    let cs = battle('traveler', ['kindred_refrain', 'kindred_refrain', ...Array(7).fill('quick_stab')]);
    cs.relics = ['drummer_heart'];
    cs.player.statuses = { comboFlow: 1, crescendo: 1, kindredVow: 1 };
    cs.player.block = 50; cs.player.energy = 0;
    for (let i = 2; i < 5; i++) cs = use(cs, `quick_stab-${i}`);
    expect(cs.player.energy).toBe(3);
    cs = use(cs, 'kindred_refrain-0');
    expect(cs.player.energy).toBe(5);
    for (let i = 5; i < 9; i++) cs = use(cs, `quick_stab-${i}`);
    // 再打四张攻击和第二张余烬回声，能量不再增加，只换来 2 点余烬。
    expect(cs.player.energy).toBe(5);
    const ember = cs.player.ember;
    cs = use(cs, 'kindred_refrain-1');
    expect(cs.player.energy).toBe(5);
    expect(cs.player.ember).toBe(ember + 2);
  });
});

describe('卡面按角色写出具体动作，不出现「招牌动作」', () => {
  const voices: (CharacterId | null)[] = [null, ...CHARACTER_LIST.map(c => c.id)];

  it('所有卡牌在任何角色或通用措辞下都不出现「招牌动作」，非共鸣牌的文字与角色无关', () => {
    for (const def of CARD_LIST) for (const up of def.cost < 0 ? [false] : [false, true]) {
      const generic = describeCard(card(def.id, up), null);
      for (const voice of voices) {
        const text = describeCard(card(def.id, up), null, voice);
        expect(text, def.name).not.toContain('招牌动作');
        if (!def.kindred) expect(text, def.name).toBe(generic);
      }
    }
    expect(CARD_LIST.filter(c => c.kindred).map(c => c.name)).toEqual(['火种共鸣', '同源余火', '余烬回声', '旅途誓火', '黎明前夜']);
    for (const def of CARD_LIST.filter(c => c.kindred)) expect([def.owner, def.archetype]).toEqual([undefined, 'ember']);
  });

  it('火种共鸣与同源余火按角色换算每次动作的实际加成', () => {
    const spark = (voice: CharacterId | null) => describeCard(card('kindred_spark'), null, voice);
    expect(spark('traveler')).toBe('造成 5 点伤害，本回合拥有格挡时每打出 1 张攻击牌 +3（最多 +12）。');
    expect(spark('picker')).toBe('造成 5 点伤害，本回合每有 1 张牌被消耗、每打出 1 张施加燃烧的牌 +3（最多 +12）。');
    expect(spark('oathbound')).toBe('造成 5 点伤害，本回合每次因卡牌失去生命、每打出 1 张获得临时力量的牌 +6（单次失去 4 点以上 +9，最多 +12）。');
    expect(spark('scholar')).toBe('造成 5 点伤害，本回合每完成 1 次回响或镜像重放、每打出 1 张蓄力 ≥2 的牌 +6（最多 +12）。');
    expect(spark(null)).toBe('造成 5 点伤害，本回合每完成 1 次角色专长动作 +3（最多 +12）。');
    expect(describeCard(card('kindred_afterglow'), null, 'traveler')).toBe('获得 6 点格挡，本回合拥有格挡时每打出 1 张攻击牌获得 1 点余烬（最多 4 点）。');
    expect(describeCard(card('kindred_afterglow'), null, 'oathbound')).toBe('获得 6 点格挡，本回合每次因卡牌失去生命、每打出 1 张获得临时力量的牌获得 2 点余烬（单次失去 4 点以上获得 3 点，最多 4 点）。');
    expect(describeCard(card('kindred_afterglow'), null, 'scholar')).toBe('获得 6 点格挡，本回合每完成 1 次回响或镜像重放、每打出 1 张蓄力 ≥2 的牌获得 2 点余烬（最多 4 点）。');
  });

  it('门槛类文字按角色换算成需要完成的动作次数', () => {
    expect(describeCard(card('kindred_refrain'), null, 'traveler')).toBe('若本回合拥有格挡时已打出 3 张以上攻击牌：获得 2 点能量（每回合限 1 次）；否则获得 2 点余烬。消耗。');
    expect(describeCard(card('kindred_refrain'), null, 'oathbound')).toBe('若本回合因卡牌失去生命与打出获得临时力量的牌合计 2 次以上，或有 1 次单次失去 4 点以上生命：获得 2 点能量（每回合限 1 次）；否则获得 2 点余烬。消耗。');
    expect(describeCard(card('kindred_refrain', true), null, 'oathbound')).toContain('若本回合因卡牌失去生命与打出获得临时力量的牌合计 1 次以上：');
    expect(describeCard(card('kindred_dawn'), null, 'oathbound')).toContain('若本回合因卡牌失去生命与打出获得临时力量的牌合计 2 次以上：');
    expect(describeCard(card('kindred_refrain'), null, 'scholar')).toContain('若本回合已完成 2 次以上回响、镜像重放或打出蓄力 ≥2 的牌：');
    expect(describeCard(card('kindred_refrain', true), null, 'scholar')).toContain('若本回合已完成 1 次以上回响、镜像重放或打出蓄力 ≥2 的牌：');
    expect(describeCard(card('kindred_refrain', true), null, 'picker')).toContain('若本回合被消耗的牌与打出的施加燃烧的牌合计 2 张以上：');
    expect(describeCard(card('kindred_dawn'), null, 'picker')).toBe('对所有敌人造成 12 点伤害，若本回合被消耗的牌与打出的施加燃烧的牌合计 4 张以上：对所有敌人造成 12 点伤害，获得 3 点余烬。');
    expect(describeCard(card('kindred_dawn'), null)).toContain('若本回合已完成 4 次以上角色专长动作：');
  });

  it('门槛文字里的「合计 N 次，或有 M 次大额失血」与实际计数完全等价', () => {
    const thresholds = new Set<number>([KINDRED_VOW_AT]);
    const collect = (effects: Effect[]) => { for (const e of effects) if (e.kind === 'conditional') { if (e.cond.kind === 'signatureThisTurnAtLeast') thresholds.add(e.cond.value); collect(e.then); collect(e.else ?? []); } };
    for (const def of CARD_LIST) { collect(def.effects); collect(def.upgrade.effects ?? []); }
    expect([...thresholds].sort()).toEqual([2, 3, 4]);
    for (const { id } of CHARACTER_LIST) {
      const { weight, heavy } = CHARACTERS[id].signature;
      for (const threshold of thresholds) {
        const actions = Math.max(1, Math.ceil(threshold / weight));
        const heavyActions = heavy ? Math.max(1, Math.ceil(threshold / heavy.weight)) : actions;
        // normal 为普通动作次数，big 为单次大额失血次数。
        for (let normal = 0; normal <= 6; normal++) for (let big = 0; big <= (heavy ? 4 : 0); big++) {
          const met = normal * weight + big * (heavy?.weight ?? 0) >= threshold;
          const described = normal + big >= actions || (heavyActions < actions && big >= heavyActions);
          expect(described, `${id} 门槛 ${threshold}：普通 ${normal} 次、大额 ${big} 次`).toBe(met);
        }
      }
    }
  });

  it('旅途誓火的卡面与状态提示按角色写出触发时机', () => {
    expect(describeCard(card('kindred_vow'), null, 'traveler')).toBe('每回合拥有格挡时打出第 3 张攻击牌后，获得 1 点能量并抽 1 张牌。每回合仅一次。');
    expect(statusDescription('kindredVow', 1, 'picker')).toBe('每回合被消耗的牌与打出的施加燃烧的牌合计达到 3 张时，获得 1 点能量并抽 1 张牌。每回合仅一次。');
    expect(statusDescription('kindredVow', 1, 'oathbound')).toBe('每回合因卡牌失去生命与打出获得临时力量的牌合计达到 2 次时，或单次失去 4 点以上生命时，获得 1 点能量并抽 1 张牌。每回合仅一次。');
    expect(statusDescription('kindredVow', 2, 'scholar')).toBe('每回合第 2 次完成回响、镜像重放或打出蓄力 ≥2 的牌时，获得 2 点能量并抽 2 张牌。每回合仅一次。');
    expect(statusDescription('kindredVow', 1)).toBe('每回合第 3 次完成角色专长动作时，获得 1 点能量并抽 1 张牌。每回合仅一次。');
    expect(statusDescription('strength', 2, 'traveler')).toBe(statusDescription('strength', 2));
  });

  it('战斗中的卡面显示当前加成，数字与实际结算一致', () => {
    const cs = withCount(battle('oathbound', ['kindred_spark', 'kindred_afterglow']), 2);
    const ctx = { player: cs.player, target: cs.enemies[0], relics: cs.relics, isFirstAttack: true, crescendoBonus: 0 };
    const spark = describeCard(cs.player.hand[0], ctx, 'oathbound');
    expect(spark).toContain('造成 11 点伤害');
    expect(spark).toContain('（当前 +6）');
    expect(lost(use(cs, 'kindred_spark-0'))).toBe(11);
    expect(describeCard(cs.player.hand[1], ctx, 'oathbound')).toContain('（当前共 2 点）');
    expect(use(cs, 'kindred_afterglow-1').player.ember).toBe(2);
  });
});
