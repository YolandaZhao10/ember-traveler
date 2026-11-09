import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { describeCard } from '../engine/cards';
import { createCombat, endPlayerTurn, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CardInstance } from '../engine/types';

const card = (defId: string, upgraded = false, uid = defId): CardInstance => ({ uid, defId, upgraded });
function battle(id: string, up = false) {
  const cs = createCombat('distinct-core', ['tomb_puppet', 'tomb_puppet'], 'normal', [], 30, 60, [], makeRng(id, 'combat'), 0, CARDS[id].owner ?? 'traveler').state;
  cs.player.hand = [card(id, up)];
  cs.player.draw = Array.from({ length: 10 }, (_, i) => card('strike', false, `draw-${i}`));
  for (const enemy of cs.enemies) enemy.hp = enemy.maxHp = 1000;
  return cs;
}

describe('基础与通用卡牌的不同用途', () => {
  it.each([false, true])('灰烬步需要已有格挡才能补充余烬（升级=%s）', up => {
    for (const block of [0, 5]) {
      const cs = battle('ash_step', up); cs.player.block = block;
      const result = playCard(cs, 'ash_step', null).state;
      expect(result.player.ember).toBe(block ? 2 : 0);
      expect(result.player.hand).toHaveLength(up ? 2 : 1);
      expect(result.player.exhaust.map(c => c.defId)).toContain('ash_step');
    }
  });
  it.each([false, true])('连环斩为后续攻击积蓄临时力量，不增幅自身（升级=%s）', up => {
    for (const prior of [0, 1]) {
      const cs = battle('chain_slash', up); cs.player.attacksPlayedThisTurn = prior;
      const result = playCard(cs, 'chain_slash', 'e0').state;
      expect(result.enemies[0].hp).toBe(1000 - (up ? 11 : 8));
      expect(result.player.statuses.strength ?? 0).toBe(prior ? (up ? 3 : 2) : 0);
      expect(result.player.hand).toHaveLength(0);
      expect(endPlayerTurn(result).state.player.statuses.strength ?? 0).toBe(0);
    }
  });
  it.each([false, true])('灰烬再临优先取回实际费用最高的牌，保留剩余消耗堆（升级=%s）', up => {
    const cs = battle('ash_return', up);
    cs.player.exhaust = [card('strike'), card('demon_heart', true), card('stone_throw'), card('heavy_blow')];
    const result = playCard(cs, 'ash_return', null).state;
    expect(result.player.hand.map(c => c.defId)).toEqual(up ? ['demon_heart', 'heavy_blow'] : ['demon_heart']);
    expect(result.player.exhaust.map(c => c.defId)).toEqual(up ? ['strike', 'stone_throw'] : ['strike', 'stone_throw', 'heavy_blow']);
    expect(result.player.energy).toBe(2);
    expect(describeCard(card('ash_return', up), null)).toContain('按费用从高到低');
  });
  it.each([false, true])('尘归尘只消耗诅咒，无诅咒时也不误伤有用牌（升级=%s）', up => {
    for (const cursed of [false, true]) {
      const cs = battle('dust_to_dust', up);
      cs.player.hand.push(card('strike'), card('defend'));
      if (cursed) cs.player.hand.push(card('regret'), card('regret', false, 'second-curse'));
      const result = playCard(cs, 'dust_to_dust', null).state;
      expect(result.player.hand.map(c => c.defId)).toEqual(['strike', 'defend']);
      expect(result.player.exhaust).toHaveLength(cursed ? 2 : 0);
      expect(result.player.block).toBe(up ? 13 : 9);
    }
  });
  it.each([false, true])('重锤先移除选定敌人格挡，再造成伤害（升级=%s）', up => {
    const cs = battle('heavy_blow', up); cs.enemies[0].block = cs.enemies[1].block = 50;
    const result = playCard(cs, 'heavy_blow', 'e0').state;
    expect(result.enemies[0].block).toBe(0);
    expect(result.enemies[0].hp).toBe(1000 - (up ? 27 : 20));
    expect(result.enemies[1].block).toBe(50);
    expect(result.enemies[0].statuses.vulnerable ?? 0).toBe(0);
  });
  it.each([false, true])('符文壁提供一次蓄力防御和持续金属化（升级=%s）', up => {
    const cs = battle('rune_wall', up); cs.player.hand[0].bonus = 3;
    const result = playCard(cs, 'rune_wall', null).state;
    expect(result.player.block).toBe((up ? 13 : 9) + 12);
    expect(result.player.statuses.metallicize).toBe(up ? 3 : 2);
    expect(result.player.exhaust.map(c => c.defId)).toContain('rune_wall');
    expect(endPlayerTurn(result).state.player.block).toBe((up ? 13 : 9) + 12 + (up ? 3 : 2));
  });
  it.each([false, true])('停战烟施加群体虚弱并换手牌，不附带格挡（升级=%s）', up => {
    const cs = battle('truce_smoke', up); cs.player.hand.push(card('defend'));
    const result = playCard(cs, 'truce_smoke', null).state;
    expect(result.enemies.every(e => e.statuses.weak === 2)).toBe(true);
    expect(result.player.hand).toHaveLength(up ? 3 : 2);
    expect(result.player.discard.map(c => c.defId)).toEqual(['defend', 'truce_smoke']);
    expect(result.player.block).toBe(0);
  });
  it.each([false, true])('重拨余火消耗余烬回收牌，资源不足不可打出（升级=%s）', up => {
    const cs = battle('rekindle_coals', up); cs.player.exhaust = [card('tinder_bundle')];
    expect(playCard(cs, 'rekindle_coals', null).state).toEqual(cs);
    cs.player.ember = 3;
    const result = playCard(cs, 'rekindle_coals', null).state;
    expect(result.player.ember).toBe(1);
    expect(result.player.energy).toBe(2);
    expect(result.player.hand.map(c => c.defId)).toContain('tinder_bundle');
    expect(result.player.hand).toHaveLength(up ? 3 : 2);
    expect(result.player.exhaust).toHaveLength(0);
  });
  it.each([false, true])('篝火避难所消耗余烬建立持续防御，不再只是一次大格挡（升级=%s）', up => {
    const cs = battle('bonfire_shelter', up); cs.player.ember = 5;
    const result = playCard(cs, 'bonfire_shelter', null).state;
    expect(result.player.ember).toBe(0);
    expect(result.player.energy).toBe(1);
    expect(result.player.block).toBe(0);
    expect(result.player.statuses.metallicize).toBe(up ? 8 : 6);
    expect(result.player.statuses.regen).toBe(up ? 3 : 2);
    const ended = endPlayerTurn(result).state;
    expect(ended.player.block).toBe(up ? 8 : 6);
    expect(ended.player.hp).toBe(30 + (up ? 3 : 2));
    expect(result.player.discard).toHaveLength(0);
  });
});
