import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { describeCard } from '../engine/cards';
import { createCombat, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CardInstance, CombatState } from '../engine/types';

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
