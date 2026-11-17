import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARDS, RETIRED_CARDS } from '../data/cards';
import { canPlayCard, createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { describeCard } from '../engine/cards';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CardInstance, CombatState } from '../engine/types';

const card = (defId: string, uid = defId, upgraded = false): CardInstance => ({ uid, defId, upgraded, bonus: 0 });
const text = (id: string, upgraded: boolean) => describeCard(card(id, id, upgraded), null);

function battle(id: string, upgraded: boolean, enemies = 1): CombatState {
  const cs = createCombat('traveler-pass2', Array.from({ length: enemies }, () => 'tomb_puppet'), 'normal', [], 50, 60, [], makeRng(`${id}-${upgraded}`, 'combat'), 100, 'traveler').state;
  for (const enemy of cs.enemies) { enemy.hp = enemy.maxHp = 1000; enemy.block = 0; enemy.statuses = {}; }
  cs.player.hand = [card(id, id, upgraded)];
  cs.player.draw = Array.from({ length: 10 }, (_, i) => card('defend', `draw-${i}`));
  cs.player.energy = 3;
  return cs;
}
function play(cs: CombatState, id: string, choice?: string): CombatState {
  const before = structuredClone(cs);
  const result = playCard(cs, id, CARDS[cs.player.hand.find(c => c.uid === id)!.defId].target === 'enemy' ? cs.enemies[0].id : null, choice).state;
  expect(result, `${id} 应能打出`).not.toBe(cs);
  expect(cs).toEqual(before);
  return result;
}
const lost = (cs: CombatState, i = 0) => 1000 - cs.enemies[i].hp;
/** 结束回合、让敌人都行动完，再开始下一回合。 */
function nextTurn(input: CombatState): CombatState {
  let cs = endPlayerTurn(input).state;
  for (const e of cs.enemies) { e.moveId = 'wall'; cs = enemyAct(cs, e.id).state; }
  return startPlayerTurn(cs).state;
}

describe('旅人·连击（第二轮）', () => {
  it.each([false, true])('交锋：伤害 6/8，格挡 6/8（升级=%s）', up => {
    expect(text('cross_guard', up)).toBe(`造成 ${up ? 8 : 6} 点伤害，获得 ${up ? 8 : 6} 点格挡。`);
    const after = play(battle('cross_guard', up), 'cross_guard');
    expect([lost(after), after.player.block]).toEqual(up ? [8, 8] : [6, 6]);
  });

  it.each([false, true])('柄击：伤害固定 7，虚弱 1/2（升级=%s）', up => {
    expect(text('pommel_jab', up)).toBe(`造成 7 点伤害，对目标施加 ${up ? 2 : 1} 层虚弱。`);
    const after = play(battle('pommel_jab', up), 'pommel_jab');
    expect([lost(after), after.enemies[0].statuses.weak]).toEqual([7, up ? 2 : 1]);
  });

  it.each([false, true])('量步：先获得 8/11 点格挡，再抽 1 张牌（升级=%s）', up => {
    expect(text('measured_step', up)).toBe(`获得 ${up ? 11 : 8} 点格挡，抽 1 张牌。`);
    expect(CARDS.measured_step.effects.map(e => e.kind)).toEqual(['block', 'draw']);
    const after = play(battle('measured_step', up), 'measured_step');
    expect([after.player.block, after.player.hand.length]).toEqual([up ? 11 : 8, 1]);
  });

  it('急速升为稀有，效果不变', () => {
    expect([CARDS.haste.rarity, CARDS.haste.cost, CARDS.haste.exhaust]).toEqual(['rare', 0, true]);
    expect([text('haste', false), text('haste', true)]).toEqual(['获得 1 点能量，抽 1 张牌。消耗。', '获得 1 点能量，抽 2 张牌。消耗。']);
  });

  it.each([false, true])('战途补给：1 费（升级 0 费），没有上限，本回合每打出 1 张攻击牌抽 1 张，消耗（升级=%s）', up => {
    expect(text('trail_supply', up)).toBe('本回合每打出 1 张攻击牌抽 1 张牌，不重复计算。消耗。');
    expect([CARDS.trail_supply.cost, CARDS.trail_supply.upgrade?.cost]).toEqual([1, 0]);
    for (const attacks of [0, 2, 5]) {
      const cs = battle('trail_supply', up); cs.player.attacksPlayedThisTurn = attacks;
      const after = play(cs, 'trail_supply');
      expect([after.player.hand.length, after.player.energy], `${attacks} 张攻击牌`).toEqual([attacks, up ? 3 : 2]);
      expect(after.player.exhaust.map(c => c.defId)).toEqual(['trail_supply']);
    }
  });

  it('战途补给不重复计算：同一回合取回后再打，只为新打出的攻击牌抽牌', () => {
    let cs = battle('trail_supply', true); cs.player.attacksPlayedThisTurn = 2;
    cs = play(cs, 'trail_supply');
    expect(cs.player.hand).toHaveLength(2);
    cs.player.hand = [cs.player.exhaust.pop()!]; cs.player.attacksPlayedThisTurn = 3;
    expect(play(cs, 'trail_supply').player.hand).toHaveLength(1);
  });

  it.each([false, true])('余音：2 费（升级 1 费），每打出 3 张牌抽 1 张（升级=%s）', up => {
    expect(text('tempo', up)).toBe('生效后每打出 3 张牌，抽 1 张牌。每张独立计数，进度跨回合保留。');
    let cs = battle('tempo', up);
    cs.player.hand.push(card('defend', 'a'), card('defend', 'b'), card('defend', 'c'));
    cs.player.energy = 5;
    cs = play(cs, 'tempo');
    expect(cs.player.energy).toBe(up ? 4 : 3);
    cs = play(play(cs, 'a'), 'b');
    expect(cs.player.hand.map(c => c.uid)).toEqual(['c']);
    cs = play(cs, 'c');
    expect(cs.player.hand).toHaveLength(1);
  });

  it.each([false, true])('战鼓：不再逐张加伤；第 3 张攻击牌后获得 1 点能量和 6/8 点格挡（升级=%s）', up => {
    expect(text('war_drum', up)).toBe(`每回合打出第 3 张攻击牌后，获得 1 点能量和 ${up ? 8 : 6} 点格挡。回响与镜像重放也计数。`);
    let cs = battle('war_drum', up);
    cs.player.hand.push(...['a', 'b', 'c', 'd'].map(uid => card('quick_stab', uid)));
    cs = play(cs, 'war_drum');
    expect(cs.player.statuses.crescendo ?? 0).toBe(0);
    cs = play(play(cs, 'a'), 'b');
    // 每张疾刺都是 3 点，没有逐张 +1。
    expect([lost(cs), cs.player.block, cs.player.energy]).toEqual([6, 0, 2]);
    cs = play(cs, 'c');
    expect([lost(cs), cs.player.block, cs.player.energy]).toEqual([9, up ? 8 : 6, 3]);
    cs = play(cs, 'd');
    expect([lost(cs), cs.player.block, cs.player.energy]).toEqual([12, up ? 8 : 6, 3]);
  });

  it('两张战鼓叠加：能量与格挡各自相加', () => {
    let cs = battle('war_drum', false);
    cs.player.hand.push(card('war_drum', 'second', true), ...['a', 'b', 'c'].map(uid => card('quick_stab', uid)));
    cs = play(play(cs, 'war_drum'), 'second');
    for (const uid of ['a', 'b', 'c']) cs = play(cs, uid);
    expect([cs.player.block, cs.player.energy]).toEqual([14, 3]);
  });
});

describe('旅人·壁垒（第二轮）', () => {
  it.each([false, true])('换岗布防：卡面写「下回合获得 1 点能量」，下回合确实多 1 点能量（升级=%s）', up => {
    expect(text('shield_rotation', up)).toBe(`获得 ${up ? 9 : 6} 点格挡，从弃牌堆选择 1 张技能牌放到抽牌堆顶，下回合获得 1 点能量。`);
    let cs = battle('shield_rotation', up);
    cs.player.discard = [card('defend', 'pick')];
    cs = play(cs, 'shield_rotation', 'pick');
    expect(cs.player.draw[cs.player.draw.length - 1].uid).toBe('pick');
    expect(nextTurn(cs).player.energy).toBe(4);
  });

  it.each([false, true])('铁壁：只获得 16/22 点格挡，不再有回合末格挡（升级=%s）', up => {
    expect(text('iron_wall', up)).toBe(`获得 ${up ? 22 : 16} 点格挡。`);
    const after = play(battle('iron_wall', up), 'iron_wall');
    expect([after.player.block, after.player.statuses.metallicize ?? 0]).toEqual([up ? 22 : 16, 0]);
  });

  it.each([false, true])('铁卫护送：对所有敌人施加 1 层虚弱和 1 层易伤（升级=%s）', up => {
    expect(text('iron_escort', up)).toBe(`获得 ${up ? 18 : 14} 点格挡，对所有敌人施加 1 层虚弱，对所有敌人施加 1 层易伤，抽 ${up ? 2 : 1} 张牌。`);
    const after = play(battle('iron_escort', up, 2), 'iron_escort');
    expect(after.enemies.map(e => [e.statuses.weak, e.statuses.vulnerable])).toEqual([[1, 1], [1, 1]]);
    expect([after.player.block, after.player.hand.length]).toEqual([up ? 18 : 14, up ? 2 : 1]);
  });

  it.each([false, true])('持盾冲锋：不再施加易伤（升级=%s）', up => {
    expect(text('shield_rush', up)).toBe(`获得 ${up ? 14 : 10} 点格挡，造成等于当前格挡 +3的伤害。`);
    const after = play(battle('shield_rush', up), 'shield_rush');
    expect([lost(after), after.player.block, after.enemies[0].statuses.vulnerable ?? 0]).toEqual([up ? 17 : 13, up ? 14 : 10, 0]);
  });

  it.each([false, true])('旅途重甲：格挡 8/10，敏捷 2 不变（升级=%s）', up => {
    expect(text('road_armor', up)).toBe(`获得 ${up ? 10 : 8} 点格挡，获得 2 层敏捷。`);
    const after = play(battle('road_armor', up), 'road_armor');
    expect([after.player.block, after.player.statuses.dexterity]).toEqual([up ? 10 : 8, 2]);
  });

  it('固守：3 费，升级后 2 费，仍然整场保留格挡', () => {
    expect([CARDS.hold_fast.cost, CARDS.hold_fast.upgrade?.cost]).toEqual([3, 2]);
    for (const up of [false, true]) {
      let cs = battle('hold_fast', up); cs.player.block = 9;
      cs = play(cs, 'hold_fast');
      expect(cs.player.energy).toBe(up ? 1 : 0);
      cs = nextTurn(nextTurn(cs));
      expect(cs.player.block).toBe(9);
    }
  });

  it.each([false, true])('不动阵地：荆棘 1/2，回合末格挡 6/8 不变（升级=%s）', up => {
    expect(text('steadfast_guard', up)).toBe(`每回合结束时获得 ${up ? 8 : 6} 点格挡，获得 ${up ? 2 : 1} 层荆棘。`);
  });

  it.each([false, true])('壁垒誓约：格挡只在下一个回合开始时保留一次，再下一个回合照常清空（升级=%s）', up => {
    expect(text('bastion_oath', up)).toBe(`获得 ${up ? 24 : 18} 点格挡，下一个回合开始时格挡不会消失，只生效一次。消耗。`);
    let cs = play(battle('bastion_oath', up), 'bastion_oath');
    expect([cs.player.statuses.barricadeOnce, cs.player.statuses.barricade ?? 0]).toEqual([1, 0]);
    cs = nextTurn(cs);
    expect([cs.player.block, cs.player.statuses.barricadeOnce ?? 0]).toEqual([up ? 24 : 18, 0]);
    cs = nextTurn(cs);
    expect(cs.player.block).toBe(0);
  });

  it('壁垒誓约连打两张也只保留一个回合，不会攒成两回合', () => {
    let cs = battle('bastion_oath', false);
    cs.player.hand.push(card('bastion_oath', 'second'));
    cs.player.energy = 4;
    cs = nextTurn(play(play(cs, 'bastion_oath'), 'second'));
    expect(cs.player.block).toBe(36);
    expect(nextTurn(cs).player.block).toBe(0);
  });

  it.each([false, true])('铁壁回敬：伤害为格挡 × 2，没有固定加成；虚弱 2/4（升级=%s）', up => {
    expect(text('iron_rebuke', up)).toBe(`造成等于当前格挡 × 2的伤害，对目标施加 ${up ? 4 : 2} 层虚弱。`);
    const cs = battle('iron_rebuke', up); cs.player.block = 11;
    const after = play(cs, 'iron_rebuke');
    expect([lost(after), after.player.block, after.enemies[0].statuses.weak]).toEqual([22, 11, up ? 4 : 2]);
  });

  it.each([false, true])('灯下庇护：卡面不再写「需要 3 点余烬」，但余烬不足 3 点仍不能打出（升级=%s）', up => {
    expect(text('lantern_shelter', up)).toBe(`消耗 3 点余烬，清除自身的虚弱、易伤、脆弱与燃烧，获得 ${up ? 28 : 20} 点格挡。保留。`);
    const cs = battle('lantern_shelter', up); cs.player.ember = 2;
    expect(canPlayCard(cs, cs.player.hand[0])).toEqual({ ok: false, reason: '需要 3 点余烬' });
    cs.player.ember = 3;
    const after = play(cs, 'lantern_shelter');
    expect([after.player.ember, after.player.block]).toEqual([0, up ? 28 : 20]);
  });
});

describe('旅人新牌：拢火、剔灯', () => {
  it.each([false, true])('拢火：旅人专属普通技能，1 费，获得 4/6 点余烬，进入弃牌堆（升级=%s）', up => {
    const def = CARDS.gather_embers;
    expect([def.name, def.owner, def.type, def.rarity, def.cost, def.exhaust, def.retain]).toEqual(['拢火', 'traveler', 'skill', 'common', 1, undefined, undefined]);
    expect(text('gather_embers', up)).toBe(`获得 ${up ? 6 : 4} 点余烬。`);
    const after = play(battle('gather_embers', up), 'gather_embers');
    expect([after.player.ember, after.player.energy, after.player.discard.map(c => c.defId)]).toEqual([up ? 6 : 4, 2, ['gather_embers']]);
  });

  it.each([false, true])('剔灯：旅人专属罕见技能，0 费，消耗 4 点余烬获得 2/3 点能量，不消耗（升级=%s）', up => {
    const def = CARDS.trim_lamp;
    expect([def.name, def.owner, def.type, def.rarity, def.cost, def.requireEmber, def.exhaust, def.hpFallback]).toEqual(['剔灯', 'traveler', 'skill', 'uncommon', 0, 4, undefined, undefined]);
    expect(text('trim_lamp', up)).toBe(`消耗 4 点余烬，获得 ${up ? 3 : 2} 点能量。需要 4 点余烬。`);
    const cs = battle('trim_lamp', up); cs.player.ember = 5; cs.player.energy = 0;
    const after = play(cs, 'trim_lamp');
    expect([after.player.ember, after.player.energy, after.player.discard.map(c => c.defId), after.player.exhaust]).toEqual([1, up ? 3 : 2, ['trim_lamp'], []]);
  });

  it('剔灯余烬不足 4 点时不能打出；每次都要实付 4 点，8 点余烬只够打两次', () => {
    const short = battle('trim_lamp', false); short.player.ember = 3;
    expect(canPlayCard(short, short.player.hand[0]).ok).toBe(false);
    let cs = battle('trim_lamp', false);
    cs.player.hand = ['a', 'b', 'c'].map(uid => card('trim_lamp', uid)); cs.player.ember = 8; cs.player.energy = 0;
    cs = play(play(cs, 'a'), 'b');
    expect([cs.player.ember, cs.player.energy]).toEqual([0, 4]);
    expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(false);
  });
});

describe('旅人删除的三张牌与旧存档', () => {
  afterEach(() => vi.unstubAllGlobals());
  const table = { swift_return: ['回身刺', 'quick_stab'], spin_kick: ['回旋踢', 'lantern_poke'], hooking_cut: ['钩刃', 'twin_blades'] } as const;

  it('回身刺、回旋踢、钩刃不再存在；替代牌是旅人连击里稀有度不高于罕见的现有牌', () => {
    for (const [id, [name, replacement]] of Object.entries(table)) {
      expect(CARDS[id], id).toBeUndefined();
      expect(Object.values(CARDS).some(c => c.name === name)).toBe(false);
      expect(RETIRED_CARDS[id]).toEqual({ name, replacement });
      const to = CARDS[replacement];
      expect([to.owner, to.archetype], replacement).toEqual(['traveler', 'combo']);
      expect(['common', 'uncommon']).toContain(to.rarity);
    }
  });

  it('旧存档里的这三张牌读档后换成替代牌，保留升级与标识', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    const run = R.travelTo(R.newRun('RETIRED-COMBO', 'traveler'), R.newRun('RETIRED-COMBO', 'traveler').map.startIds[0]);
    const size = run.deck.length;
    Object.keys(table).forEach((id, i) => {
      run.deck.push({ uid: `deck-${id}`, defId: id, upgraded: i % 2 === 0 });
      run.combat!.player.draw.push({ uid: `draw-${id}`, defId: id, upgraded: true, bonus: 0 });
    });
    saveRun(run);
    const loaded = loadRun()!;
    expect(loaded.deck).toHaveLength(size + 3);
    Object.entries(table).forEach(([id, [, replacement]], i) => {
      expect(loaded.deck.find(c => c.uid === `deck-${id}`)).toEqual({ uid: `deck-${id}`, defId: replacement, upgraded: i % 2 === 0 });
      expect(loaded.combat!.player.draw.find(c => c.uid === `draw-${id}`)).toMatchObject({ defId: replacement, upgraded: true });
    });
  });
});
