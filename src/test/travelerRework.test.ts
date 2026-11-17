import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARDS, RETIRED_CARDS } from '../data/cards';
import { describeCard } from '../engine/cards';
import { canPlayCard, createCombat, endPlayerTurn, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CardInstance, CombatState, RunState } from '../engine/types';

const card = (defId: string, uid = defId, upgraded = false): CardInstance => ({ uid, defId, upgraded, bonus: 0 });
const text = (id: string, upgraded: boolean) => describeCard(card(id, id, upgraded), null);

/** 手里只有被测牌；attacks 为本回合此前已打出的攻击牌数。 */
function battle(id: string, upgraded: boolean, attacks: number, enemies = 1): CombatState {
  const cs = createCombat('combo-rework', Array.from({ length: enemies }, () => 'tomb_puppet'), 'normal', [], 50, 60, [], makeRng(`${id}-${upgraded}-${attacks}`, 'combat'), 100, 'traveler').state;
  for (const enemy of cs.enemies) { enemy.hp = enemy.maxHp = 1000; enemy.block = 0; enemy.statuses = {}; }
  cs.player.hand = [card(id, id, upgraded)];
  cs.player.draw = Array.from({ length: 10 }, (_, i) => card('defend', `draw-${i}`));
  cs.player.attacksPlayedThisTurn = attacks;
  cs.player.cardsPlayedThisTurn = attacks;
  cs.player.energy = 3;
  return cs;
}
function play(cs: CombatState, id: string): CombatState {
  const before = structuredClone(cs);
  const target = CARDS[id].target === 'enemy' ? cs.enemies[0].id : null;
  const result = playCard(cs, id, target).state;
  expect(result, id).not.toBe(cs);
  expect(cs).toEqual(before);
  return result;
}
const lost = (cs: CombatState, i = 0) => 1000 - cs.enemies[i].hp;
const CONDITION = '若本回合已打出 1 张以上攻击牌';

describe('旅人连击牌：条件降为「已打出 1 张攻击牌」', () => {
  it('战鼓降为罕见，效果与卡面不变', () => {
    expect(CARDS.war_drum.rarity).toBe('uncommon');
    expect(CARDS.war_drum.cost).toBe(1);
    expect(CARDS.war_drum.effects).toEqual([{ kind: 'status', status: 'crescendo', amount: 1, target: 'self' }, { kind: 'status', status: 'comboFlow', amount: 1, target: 'self' }]);
    expect(CARDS.war_drum.upgrade?.effects).toEqual([{ kind: 'status', status: 'crescendo', amount: 2, target: 'self' }, { kind: 'status', status: 'comboFlow', amount: 1, target: 'self' }]);
  });

  it.each([false, true])('疾刺：首张不给余烬，第二张攻击牌起给 1 点（升级=%s）', up => {
    expect(text('quick_stab', up)).toBe(`造成 ${up ? 5 : 3} 点伤害，${CONDITION}：获得 1 点余烬。`);
    const first = play(battle('quick_stab', up, 0), 'quick_stab');
    expect([lost(first), first.player.ember]).toEqual([up ? 5 : 3, 0]);
    const second = play(battle('quick_stab', up, 1), 'quick_stab');
    expect([lost(second), second.player.ember]).toEqual([up ? 5 : 3, 1]);
  });

  it.each([false, true])('灯火突刺：伤害 7/10，固定 1 点余烬，已出 1 张攻击牌时抽 1 张（升级=%s）', up => {
    expect(text('lantern_poke', up)).toBe(`造成 ${up ? 10 : 7} 点伤害，获得 1 点余烬，${CONDITION}：抽 1 张牌。`);
    const first = play(battle('lantern_poke', up, 0), 'lantern_poke');
    expect([lost(first), first.player.ember, first.player.hand.length]).toEqual([up ? 10 : 7, 1, 0]);
    const second = play(battle('lantern_poke', up, 1), 'lantern_poke');
    expect([lost(second), second.player.ember, second.player.hand.length]).toEqual([up ? 10 : 7, 1, 1]);
  });

  it.each([false, true])('开路横斩：已出 1 张攻击牌时对全体施加易伤（升级=%s）', up => {
    expect(text('frontier_sweep', up)).toBe(`对所有敌人造成 ${up ? 10 : 7} 点伤害，${CONDITION}：对所有敌人施加 ${up ? 2 : 1} 层易伤。`);
    const first = play(battle('frontier_sweep', up, 0, 2), 'frontier_sweep');
    expect(first.enemies.map(e => [1000 - e.hp, e.statuses.vulnerable ?? 0])).toEqual([[up ? 10 : 7, 0], [up ? 10 : 7, 0]]);
    const second = play(battle('frontier_sweep', up, 1, 2), 'frontier_sweep');
    expect(second.enemies.map(e => [1000 - e.hp, e.statuses.vulnerable ?? 0])).toEqual([[up ? 10 : 7, up ? 2 : 1], [up ? 10 : 7, up ? 2 : 1]]);
  });

  it.each([false, true])('破阵刃：虚弱无条件，已出 1 张攻击牌时追加易伤（升级=%s）', up => {
    expect(text('guard_breaker', up)).toBe(`造成 ${up ? 17 : 12} 点伤害，对目标施加 2 层虚弱，${CONDITION}：对目标施加 ${up ? 3 : 2} 层易伤。`);
    const first = play(battle('guard_breaker', up, 0), 'guard_breaker').enemies[0];
    expect([1000 - first.hp, first.statuses.weak, first.statuses.vulnerable ?? 0]).toEqual([up ? 17 : 12, 2, 0]);
    const second = play(battle('guard_breaker', up, 1), 'guard_breaker').enemies[0];
    expect([1000 - second.hp, second.statuses.weak, second.statuses.vulnerable]).toEqual([up ? 17 : 12, 2, up ? 3 : 2]);
  });

  it.each([false, true])('行军拍：抽牌后固定获得 4 点格挡，已出 1 张攻击牌时再得 1 层蓄能（升级=%s）', up => {
    expect(text('marching_rhythm', up)).toBe(`抽 ${up ? 3 : 2} 张牌，获得 4 点格挡，${CONDITION}：获得 1 层蓄能。`);
    expect(CARDS.marching_rhythm.effects.map(e => e.kind)).toEqual(['draw', 'block', 'conditional']);
    expect(CARDS.marching_rhythm.upgrade?.effects?.map(e => e.kind)).toEqual(['draw', 'block', 'conditional']);
    const first = play(battle('marching_rhythm', up, 0), 'marching_rhythm').player;
    expect([first.hand.length, first.block, first.statuses.energyNext ?? 0]).toEqual([up ? 3 : 2, 4, 0]);
    const second = play(battle('marching_rhythm', up, 1), 'marching_rhythm').player;
    expect([second.hand.length, second.block, second.statuses.energyNext]).toEqual([up ? 3 : 2, 4, 1]);
  });

  it.each([false, true])('追风步：条件仍是已打出 2 张牌，临时力量 3/4（升级=%s）', up => {
    expect(text('pursuit_step', up)).toBe(`抽 ${up ? 2 : 1} 张牌，若本回合已打出 2 张以上卡牌：获得 ${up ? 4 : 3} 点力量，回合结束时失去。消耗。`);
    const one = battle('pursuit_step', up, 0); one.player.cardsPlayedThisTurn = 1;
    expect(play(one, 'pursuit_step').player.statuses.strength ?? 0).toBe(0);
    const two = battle('pursuit_step', up, 0); two.player.cardsPlayedThisTurn = 2;
    expect(play(two, 'pursuit_step').player.statuses.strength).toBe(up ? 4 : 3);
  });

  it.each([false, true])('千刃：已出 1 张攻击牌时打两段并获得 12/16 点格挡，首张出则只有一段（升级=%s）', up => {
    expect(text('thousand_cuts', up)).toBe(`造成 ${up ? 8 : 6} 点伤害，次数等于本回合打出的攻击牌数（含本牌），${CONDITION}：获得 ${up ? 16 : 12} 点格挡。`);
    const first = play(battle('thousand_cuts', up, 0), 'thousand_cuts');
    expect([lost(first), first.player.block]).toEqual([up ? 8 : 6, 0]);
    const second = play(battle('thousand_cuts', up, 1), 'thousand_cuts');
    expect([lost(second), second.player.block]).toEqual([up ? 16 : 12, up ? 16 : 12]);
  });

  it.each([false, true])('长夜终灯：已出 1 张攻击牌时追加 10/13 点伤害（升级=%s）', up => {
    expect(text('last_lantern', up)).toBe(`造成 ${up ? 26 : 20} 点伤害，${CONDITION}：造成 ${up ? 13 : 10} 点伤害。`);
    expect(lost(play(battle('last_lantern', up, 0), 'last_lantern'))).toBe(up ? 26 : 20);
    expect(lost(play(battle('last_lantern', up, 1), 'last_lantern'))).toBe(up ? 39 : 30);
  });

  it.each([false, true])('连刃风暴：已出 1 张攻击牌时获得 1/2 层渐强（升级=%s）', up => {
    expect(text('blade_tempest', up)).toContain(`对所有敌人造成 ${up ? 5 : 4} 点伤害 × 3，${CONDITION}：`);
    const first = play(battle('blade_tempest', up, 0, 2), 'blade_tempest');
    expect([first.enemies.map(e => 1000 - e.hp), first.player.statuses.crescendo ?? 0]).toEqual([[up ? 15 : 12, up ? 15 : 12], 0]);
    const second = play(battle('blade_tempest', up, 1, 2), 'blade_tempest');
    expect([second.enemies.map(e => 1000 - e.hp), second.player.statuses.crescendo]).toEqual([[up ? 15 : 12, up ? 15 : 12], up ? 2 : 1]);
  });

  it.each([false, true])('破晓冲锋：已出 1 张攻击牌时获得 2 层蓄能，余烬不受条件影响（升级=%s）', up => {
    expect(text('dawn_charge', up)).toBe(`对所有敌人造成 ${up ? 16 : 12} 点伤害，获得 ${up ? 4 : 3} 点余烬，${CONDITION}：获得 2 层蓄能。`);
    const first = play(battle('dawn_charge', up, 0, 2), 'dawn_charge');
    expect([first.enemies.map(e => 1000 - e.hp), first.player.ember, first.player.statuses.energyNext ?? 0]).toEqual([[up ? 16 : 12, up ? 16 : 12], up ? 4 : 3, 0]);
    const second = play(battle('dawn_charge', up, 1, 2), 'dawn_charge');
    expect([second.enemies.map(e => 1000 - e.hp), second.player.ember, second.player.statuses.energyNext]).toEqual([[up ? 16 : 12, up ? 16 : 12], up ? 4 : 3, 2]);
  });

  it('本轮不动的牌保持原条件：节奏、回身刺、环刃仍要求已打出 2 张攻击牌', () => {
    for (const id of ['rhythm', 'swift_return', 'encircling_blades']) for (const up of [false, true]) expect(text(id, up), id).toContain('若本回合已打出 2 张以上攻击牌');
  });
});

describe('旅人壁垒牌：只加输出，不动叠甲', () => {
  const guard = (id: string, up: boolean, blockNow: number, enemies = 1) => { const cs = battle(id, up, 0, enemies); cs.player.block = blockNow; return cs; };

  it.each([false, true])('盾击：伤害为当前格挡 +4；升级先获得 3 点格挡再 +6，格挡不消耗（升级=%s）', up => {
    expect(text('shield_bash', up)).toBe(up ? '获得 3 点格挡，造成等于当前格挡 +6的伤害。' : '造成等于当前格挡 +4的伤害。');
    const naked = play(guard('shield_bash', up, 0), 'shield_bash');
    expect([lost(naked), naked.player.block]).toEqual([up ? 9 : 4, up ? 3 : 0]);
    const walled = play(guard('shield_bash', up, 20), 'shield_bash');
    expect([lost(walled), walled.player.block]).toEqual([up ? 29 : 24, up ? 23 : 20]);
  });

  it.each([false, true])('反击：拥有格挡时追加 6/8 点伤害（升级=%s）', up => {
    expect(text('riposte', up)).toBe(`造成 ${up ? 9 : 6} 点伤害，若拥有格挡：造成 ${up ? 8 : 6} 点伤害。`);
    expect(lost(play(guard('riposte', up, 0), 'riposte'))).toBe(up ? 9 : 6);
    expect(lost(play(guard('riposte', up, 5), 'riposte'))).toBe(up ? 17 : 12);
  });

  it.each([false, true])('盾缘：拥有格挡时获得 3/4 点临时荆棘（升级=%s）', up => {
    expect(text('shield_edge', up)).toContain(`造成 ${up ? 9 : 6} 点伤害，若拥有格挡：获得 ${up ? 4 : 3} 点临时荆棘`);
    expect(play(guard('shield_edge', up, 0), 'shield_edge').player.statuses.tempThorns ?? 0).toBe(0);
    const walled = play(guard('shield_edge', up, 5), 'shield_edge');
    expect([lost(walled), walled.player.statuses.tempThorns, walled.player.block]).toEqual([up ? 9 : 6, up ? 4 : 3, 5]);
  });

  it.each([false, true])('荆棘甲：格挡不变，荆棘 3/4，仍然消耗（升级=%s）', up => {
    expect(text('thorn_mail', up)).toBe(`获得 ${up ? 10 : 7} 点格挡，获得 ${up ? 4 : 3} 层荆棘。消耗。`);
    const after = play(guard('thorn_mail', up, 0), 'thorn_mail').player;
    expect([after.block, after.statuses.thorns, after.exhaust.map(c => c.defId)]).toEqual([up ? 10 : 7, up ? 4 : 3, ['thorn_mail']]);
  });

  it.each([false, true])('碎盾：倍率固定为 3，升级只把费用降到 1（升级=%s）', up => {
    expect(text('shield_shatter', up)).toBe('消耗所有格挡，对所有敌人造成等于当前格挡 × 3的伤害。');
    expect(CARDS.shield_shatter.cost).toBe(2);
    expect(CARDS.shield_shatter.upgrade).toEqual({ cost: 1 });
    const after = play(guard('shield_shatter', up, 15, 2), 'shield_shatter');
    expect([after.enemies.map(e => 1000 - e.hp), after.player.block, after.player.energy]).toEqual([[45, 45], 0, up ? 2 : 1]);
  });

  it('本轮不动的壁垒牌保持原样：铁壁、架盾、漫长守望', () => {
    expect(CARDS.iron_wall.effects).toEqual([{ kind: 'block', amount: 16 }, { kind: 'status', status: 'metallicize', amount: 4, target: 'self' }]);
    expect(CARDS.iron_wall.upgrade?.effects).toEqual([{ kind: 'block', amount: 22 }, { kind: 'status', status: 'metallicize', amount: 5, target: 'self' }]);
    expect(CARDS.brace_line.effects.map(e => e.kind)).toEqual(['conditional', 'block']);
    expect(CARDS.long_road.effects).toEqual([{ kind: 'status', status: 'patientGuard', amount: 8, target: 'self' }]);
  });
});

describe('旅人新牌：引灯连斩', () => {
  it('旅人专属的 0 费罕见连击攻击牌，不消耗、不保留、不能以生命代付', () => {
    const def = CARDS.lantern_flurry;
    expect([def.name, def.owner, def.archetype, def.rarity, def.type, def.cost, def.target]).toEqual(['引灯连斩', 'traveler', 'combo', 'uncommon', 'attack', 0, 'enemy']);
    expect([def.requireEmber, def.exhaust, def.retain, def.hpFallback, def.charge]).toEqual([2, undefined, undefined, undefined, undefined]);
    expect(def.upgrade?.cost).toBeUndefined();
  });

  it.each([false, true])('消耗 2 点余烬，造成 3/4 点伤害 × 2，抽 1 张牌，进入弃牌堆（升级=%s）', up => {
    expect(text('lantern_flurry', up)).toBe(`消耗 2 点余烬，造成 ${up ? 4 : 3} 点伤害 × 2，抽 1 张牌。需要 2 点余烬。`);
    const cs = battle('lantern_flurry', up, 0); cs.player.ember = 3; cs.player.energy = 0;
    const after = play(cs, 'lantern_flurry');
    expect([lost(after), after.player.ember, after.player.energy, after.player.attacksPlayedThisTurn]).toEqual([up ? 8 : 6, 1, 0, 1]);
    expect(after.player.hand.map(c => c.defId)).toEqual(['defend']);
    expect(after.player.discard.map(c => c.defId)).toEqual(['lantern_flurry']);
    expect(after.player.exhaust).toEqual([]);
  });

  it.each([false, true])('余烬不足 2 点时不能打出，也不会改为失去生命（升级=%s）', up => {
    for (const ember of [0, 1]) {
      const cs = battle('lantern_flurry', up, 0); cs.player.ember = ember;
      expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(false);
      expect(playCard(cs, 'lantern_flurry', cs.enemies[0].id).state).toBe(cs);
    }
  });

  it('不带保留：回合结束时留在手里的引灯连斩进入弃牌堆', () => {
    const cs = battle('lantern_flurry', false, 0);
    const after = endPlayerTurn(cs).state;
    expect(after.player.hand.map(c => c.defId)).not.toContain('lantern_flurry');
    expect(after.player.discard.map(c => c.defId)).toContain('lantern_flurry');
  });

  it('每次都要实付 2 点余烬：4 点余烬只够连打两张', () => {
    let cs = battle('lantern_flurry', false, 0);
    cs.player.hand = [card('lantern_flurry', 'a'), card('lantern_flurry', 'b'), card('lantern_flurry', 'c')];
    cs.player.ember = 4;
    for (const uid of ['a', 'b']) cs = playCard(cs, uid, cs.enemies[0].id).state;
    expect([lost(cs), cs.player.ember]).toEqual([12, 0]);
    expect(canPlayCard(cs, cs.player.hand.find(c => c.uid === 'c')!).ok).toBe(false);
  });
});

describe('不息步伐移除与旧存档', () => {
  afterEach(() => vi.unstubAllGlobals());
  function storage() {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  }

  it('不息步伐不再是可获得的牌，替代牌急速同为旅人的 0 费消耗技能', () => {
    expect(CARDS.unbroken_stride).toBeUndefined();
    expect(Object.values(CARDS).some(c => c.name === '不息步伐')).toBe(false);
    expect(RETIRED_CARDS.unbroken_stride).toEqual({ name: '不息步伐', replacement: 'haste' });
    const haste = CARDS.haste;
    expect([haste.name, haste.owner, haste.cost, haste.type, haste.exhaust]).toEqual(['急速', 'traveler', 0, 'skill', true]);
  });

  it('旧存档各处的不息步伐读档后换成急速并保留升级与标识，回退点同样处理，不消耗随机流', () => {
    storage();
    const run: RunState = R.travelTo(R.newRun('RETIRED-STRIDE', 'traveler'), R.newRun('RETIRED-STRIDE', 'traveler').map.startIds[0]);
    expect(run.combat).not.toBeNull();
    const old = (uid: string, upgraded = false): CardInstance => ({ uid, defId: 'unbroken_stride', upgraded });
    const deckSize = run.deck.length;
    for (const snapshot of [run, run.checkpoint!]) {
      snapshot.deck.push(old('deck-old', true));
      const p = snapshot.combat!.player;
      p.hand.push({ ...old('hand-old'), bonus: 0 });
      p.draw.push(old('draw-old', true));
      p.discard.push(old('discard-old'));
      p.exhaust.push(old('exhaust-old'));
      snapshot.reward = { gold: 12, goldTaken: false, cardTaken: false, relic: null, relicTaken: false, cards: [old('reward-old', true)] };
      snapshot.shop = { removePrice: 75, removeUsed: false, relics: [], cards: [{ card: old('shop-old'), price: 150, sold: false }] };
    }
    const rng = JSON.stringify(run.rng);
    saveRun(run);
    const loaded = loadRun()!;
    expect(loaded).not.toBeNull();
    for (const snapshot of [loaded, loaded.checkpoint!]) {
      const p = snapshot.combat!.player;
      const everywhere = [...snapshot.deck, ...p.hand, ...p.draw, ...p.discard, ...p.exhaust, ...snapshot.reward!.cards, ...snapshot.shop!.cards.map(item => item.card)];
      for (const c of everywhere) expect(() => describeCard(c, null)).not.toThrow();
      expect(everywhere.some(c => !CARDS[c.defId])).toBe(false);
      expect(snapshot.deck).toHaveLength(deckSize + 1);
      expect(snapshot.deck.find(c => c.uid === 'deck-old')).toEqual({ uid: 'deck-old', defId: 'haste', upgraded: true });
      expect(p.hand.find(c => c.uid === 'hand-old')).toEqual({ uid: 'hand-old', defId: 'haste', upgraded: false, bonus: 0 });
      expect(p.draw.find(c => c.uid === 'draw-old')).toEqual({ uid: 'draw-old', defId: 'haste', upgraded: true });
      expect(p.discard.find(c => c.uid === 'discard-old')?.defId).toBe('haste');
      expect(p.exhaust.find(c => c.uid === 'exhaust-old')?.defId).toBe('haste');
      expect(snapshot.reward!.cards).toEqual([{ uid: 'reward-old', defId: 'haste', upgraded: true }]);
      expect(snapshot.shop!.cards).toEqual([{ card: { uid: 'shop-old', defId: 'haste', upgraded: false }, price: 150, sold: false }]);
    }
    expect(JSON.stringify(loaded.rng)).toBe(rng);
    // 换成的急速可以正常打出：获得 1 点能量、抽牌并消耗。
    const cs = loaded.combat!; cs.player.hand = cs.player.hand.filter(c => c.uid === 'hand-old'); cs.player.draw = [card('defend', 'd1'), card('defend', 'd2')];
    const energy = cs.player.energy, after = playCard(cs, 'hand-old', null).state;
    expect([after.player.energy, after.player.hand.length, after.player.exhaust.some(c => c.uid === 'hand-old')]).toEqual([energy + 1, 1, true]);
  });
});

