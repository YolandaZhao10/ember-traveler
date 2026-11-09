import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { describeCard } from '../engine/cards';
import { createCombat, endPlayerTurn, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CardInstance, CombatState } from '../engine/types';

const card = (defId: string, uid = defId, upgraded = false, bonus = 0): CardInstance => ({ uid, defId, upgraded, bonus });

function battle(id: string, upgraded: boolean, enemies = 1): CombatState {
  const cs = createCombat('distinct-extra', Array.from({ length: enemies }, () => 'tomb_puppet'), 'normal', [], 50, 60, [], makeRng(id, 'combat'), 100, CARDS[id].owner ?? 'traveler').state;
  for (const enemy of cs.enemies) enemy.hp = enemy.maxHp = 1000;
  cs.player.hand = [card(id, id, upgraded)];
  cs.player.draw = Array.from({ length: 10 }, (_, i) => card('strike', `draw-${i}`));
  return cs;
}

function play(cs: CombatState, id: string, target: string | null = null): CombatState {
  const before = structuredClone(cs);
  const result = playCard(cs, id, target).state;
  expect(result).not.toBe(cs);
  expect(cs).toEqual(before);
  return result;
}

describe('专属卡牌的不同用途', () => {
  it.each([false, true])('漫长守望提供持续抽牌和护甲，不替代固守保留格挡（升级=%s）', up => {
    let cs = battle('long_road', up);
    cs.player.block = 10;
    cs = play(cs, 'long_road');
    expect(cs.player.statuses.study).toBe(1);
    expect(cs.player.statuses.barricade ?? 0).toBe(0);
    cs = endPlayerTurn(cs).state;
    expect(cs.player.block).toBe(up ? 13 : 12);
    cs = startPlayerTurn(cs).state;
    expect(cs.player.block).toBe(0);
    expect(cs.player.hand).toHaveLength(6);
  });

  it.each([false, true])('追风步提供有门槛的临时力量，不再返还能量（升级=%s）', up => {
    for (const previous of [1, 2]) {
      const cs = battle('pursuit_step', up);
      cs.player.cardsPlayedThisTurn = previous;
      const result = play(cs, 'pursuit_step');
      expect(result.player.hand).toHaveLength(up ? 2 : 1);
      expect(result.player.energy).toBe(3);
      expect(result.player.statuses.strength ?? 0).toBe(previous === 2 ? (up ? 3 : 2) : 0);
      expect(result.player.exhaust.map(c => c.defId)).toContain('pursuit_step');
      expect(endPlayerTurn(result).state.player.statuses.strength ?? 0).toBe(0);
    }
  });

  it.each([false, true])('不息步伐在三次攻击后准备下一张牌的回响，不重复自己或返还能量（升级=%s）', up => {
    for (const previous of [2, 3]) {
      const cs = battle('unbroken_stride', up);
      cs.player.attacksPlayedThisTurn = previous;
      const result = play(cs, 'unbroken_stride');
      expect(result.player.hand).toHaveLength(up ? 3 : 2);
      expect(result.player.statuses.echo ?? 0).toBe(previous === 3 ? 1 : 0);
      expect(result.player.energy).toBe(3);
      expect(result.player.exhaust.map(c => c.defId)).toContain('unbroken_stride');
    }
  });

  it.each([false, true])('藏炭把随机一张剩余手牌转为余烬，不再附赠格挡（升级=%s）', up => {
    const cs = battle('pocket_coals', up);
    cs.player.hand.push(card('strike', 'candidate-a'), card('defend', 'candidate-b'));
    const result = play(cs, 'pocket_coals');
    expect(result.player.hand).toHaveLength(1);
    expect(result.player.exhaust).toHaveLength(2);
    expect(result.player.exhaust.filter(c => c.uid.startsWith('candidate-'))).toHaveLength(1);
    expect(result.player.exhaust.map(c => c.defId)).toContain('pocket_coals');
    expect(result.player.ember).toBe(up ? 4 : 3);
    expect(result.player.block).toBe(0);
    expect(result.player.energy).toBe(3);
  });

  it.each([false, true])('火线蔓延传播选中目标已有和刚获得的燃烧，保留余烬且不造成直接伤害（升级=%s）', up => {
    const cs = battle('flashover', up, 4);
    cs.player.ember = 7;
    cs.enemies[0].statuses.burn = 8;
    cs.enemies[1].statuses.burn = 2;
    cs.enemies[3].hp = 0;
    cs.enemies[3].flags.deadHandled = 1;
    const result = play(cs, 'flashover', 'e0');
    const layers = up ? 12 : 11;
    expect(result.enemies.map(e => e.statuses.burn ?? 0)).toEqual([layers, layers + 2, layers, 0]);
    expect(result.enemies.map(e => e.hp)).toEqual([1000, 1000, 1000, 0]);
    expect(result.player.ember).toBe(7);
    expect(result.player.energy).toBe(1);
    expect(describeCard(card('flashover', 'preview', up), null)).toContain('燃烧');
  });

  it.each([false, true])('白热清除目标燃烧换取有上限余烬和手牌，不再复制引爆伤害（升级=%s）', up => {
    for (const layers of [0, 3, 12]) {
      const cs = battle('white_hot', up, 2);
      cs.player.ember = 1;
      cs.enemies[0].statuses.burn = layers;
      cs.enemies[1].statuses.burn = 4;
      const result = play(cs, 'white_hot', 'e0');
      expect(result.enemies[0].statuses.burn ?? 0).toBe(0);
      expect(result.enemies[1].statuses.burn).toBe(4);
      expect(result.enemies.map(e => e.hp)).toEqual([1000, 1000]);
      expect(result.player.ember).toBe(1 + Math.min(layers, 5));
      expect(result.player.hand).toHaveLength(up ? 3 : 2);
      expect(result.player.energy).toBe(2);
      expect(result.player.exhaust.map(c => c.defId)).toEqual(['white_hot']);
    }
  });

  it('白热被回响时只兑现一次燃烧，但两次抽牌均生效', () => {
    const cs = battle('white_hot', false);
    cs.player.statuses.echo = 1;
    cs.enemies[0].statuses.burn = 9;
    const result = play(cs, 'white_hot', 'e0');
    expect(result.player.ember).toBe(5);
    expect(result.player.hand).toHaveLength(4);
    expect(result.enemies[0].hp).toBe(1000);
    expect(result.enemies[0].statuses.burn ?? 0).toBe(0);
    expect(result.player.exhaust.map(c => c.defId)).toEqual(['white_hot']);
  });

  it.each([false, true])('隔火带根据选中目标的燃烧提供有上限格挡，不再点燃所有敌人（升级=%s）', up => {
    for (const initialBurn of [1, 30]) {
      const cs = battle('firebreak', up, 2);
      cs.enemies[0].statuses.burn = initialBurn;
      const result = play(cs, 'firebreak', 'e0');
      expect(result.player.energy).toBe(2);
      expect(result.enemies[0].statuses.burn).toBe(initialBurn + (up ? 3 : 2));
      expect(result.enemies[1].statuses.burn ?? 0).toBe(0);
      expect(result.player.block).toBe(initialBurn === 1 ? (up ? 8 : 6) : (up ? 24 : 18));
    }
  });

  it.each([false, true])('最后献礼用少量生命换一整手新牌，弃牌先于抽牌，不再获得能量（升级=%s）', up => {
    const cs = battle('final_offering', up);
    cs.player.hand.push(card('strike', 'old-a'), card('defend', 'old-b'), card('blood_rite', 'old-c'));
    const result = play(cs, 'final_offering');
    expect(result.player.hp).toBe(up ? 47 : 46);
    expect(result.player.energy).toBe(3);
    expect(result.player.hand).toHaveLength(up ? 6 : 5);
    expect(result.player.hand.every(c => c.uid.startsWith('draw-'))).toBe(true);
    expect(result.player.discard.map(c => c.uid)).toEqual(['old-a', 'old-b', 'old-c']);
    expect(result.player.exhaust.map(c => c.defId)).toEqual(['final_offering']);
  });

  it.each([false, true])('岿然先解除脆弱再获得足额格挡，保留增益且不再提升力量（升级=%s）', up => {
    const cs = battle('unshaken', up);
    cs.player.statuses = { frail: 2, weak: 2, vulnerable: 2, burn: 3, strength: 2, thorns: 1 };
    const result = play(cs, 'unshaken');
    expect(result.player.block).toBe(up ? 13 : 9);
    expect(result.player.statuses).toEqual({ strength: 2, thorns: 1 });
    expect(result.player.exhaust.map(c => c.defId)).toContain('unshaken');
  });

  it('追风步的临时力量不会被岿然变成永久力量', () => {
    let cs = battle('pursuit_step', true);
    cs.player.cardsPlayedThisTurn = 2;
    cs.player.hand.push(card('unshaken'));
    cs = play(cs, 'pursuit_step');
    expect(cs.player.statuses.strength).toBe(3);
    cs.player.statuses.weak = 2;
    cs = play(cs, 'unshaken');
    expect(cs.player.statuses.weak ?? 0).toBe(0);
    expect(cs.player.statuses.strengthDown).toBe(3);
    expect(endPlayerTurn(cs).state.player.statuses.strength ?? 0).toBe(0);
  });

  it.each([false, true])('破碎符文把回响转为手牌蓄力，不再施加易伤（升级=%s）', up => {
    for (const initialEcho of [0, 1, 2]) {
      const cs = battle('fractured_rune', up);
      cs.player.statuses.echo = initialEcho;
      cs.player.hand.push(card('charged_blade', 'charged', false, 2), card('patient_study', 'retain-only'));
      const result = play(cs, 'fractured_rune', 'e0');
      expect(result.enemies[0].hp).toBe(1000 - (up ? 12 : 8) * (initialEcho ? 2 : 1));
      expect(result.enemies[0].statuses.vulnerable ?? 0).toBe(0);
      expect(result.player.hand.find(c => c.uid === 'charged')?.bonus).toBe(2 + initialEcho);
      expect(result.player.hand.find(c => c.uid === 'retain-only')?.bonus).toBe(0);
    }
  });

  it.each([false, true])('未来记忆先抽牌再给手中蓄力牌充能，不再提供下回合能量（升级=%s）', up => {
    const cs = battle('future_memory', up);
    cs.player.hand.push(card('surge_glyph', 'held', false, 1), card('patient_study', 'retain-only'));
    cs.player.draw = [card('strike', 'plain-draw'), card('charged_blade', 'drawn-blade'), card('rune_shield', 'drawn-shield')];
    cs.player.discard = [card('charged_blade', 'discarded', false, 4)];
    const result = play(cs, 'future_memory');
    const amount = up ? 3 : 2;
    const bonuses = Object.fromEntries(result.player.hand.map(c => [c.uid, c.bonus]));
    expect(bonuses).toMatchObject({ held: 1 + amount, 'retain-only': 0, 'drawn-blade': amount, 'drawn-shield': amount });
    expect(result.player.statuses.energyNext ?? 0).toBe(0);
    expect(result.player.discard[0].bonus).toBe(4);
    expect(result.player.exhaust.map(c => c.defId)).toEqual(['future_memory']);
    expect(describeCard(card('future_memory', 'preview', up), null)).toContain(`立即蓄力 ${amount} 回合`);
  });

  it.each(['future_memory', 'pocket_coals', 'final_offering'])('%s 的战斗内蓄力、消耗或弃牌不修改传入的永久牌组', id => {
    const deck = [card(id), card('charged_blade'), card('strike'), card('defend'), card('ashes')];
    const before = structuredClone(deck);
    let cs = createCombat('deck-safety', ['tomb_puppet'], 'normal', deck, 50, 60, [], makeRng('deck-safety', 'combat'), 100, 'scholar').state;
    cs = play(cs, id);
    if (id === 'future_memory') expect(cs.player.hand.find(c => c.defId === 'charged_blade')?.bonus).toBe(2);
    if (id === 'pocket_coals') expect(cs.player.exhaust).toHaveLength(2);
    if (id === 'final_offering') expect(cs.player.hp).toBe(46);
    expect(cs.player.exhaust.map(c => c.defId)).toContain(id);
    expect(deck).toEqual(before);
  });
});
