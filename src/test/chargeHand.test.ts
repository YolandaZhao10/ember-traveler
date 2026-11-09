import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { describeCard } from '../engine/cards';
import { createCombat, endPlayerTurn, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CardInstance, CombatState } from '../engine/types';

const SOURCE = '__charge_hand_probe';
const card = (defId: string, uid = defId, upgraded = false, bonus = 0): CardInstance => ({ uid, defId, upgraded, bonus });

// 测试源牌也具备蓄力属性，验证打出后已离开手牌，不能给自己充能。
beforeAll(() => {
  CARDS[SOURCE] = {
    id: SOURCE, name: '蓄力规则测试牌', type: 'skill', rarity: 'rare', archetype: 'focus', owner: 'scholar',
    cost: 0, target: 'self', retain: true, exhaust: true, charge: { block: 1 },
    effects: [{ kind: 'draw', amount: 1 }, { kind: 'chargeHand', amount: 2 }],
    upgrade: { effects: [{ kind: 'draw', amount: 2 }, { kind: 'chargeHand', amount: 3 }] },
  };
});
afterAll(() => { delete CARDS[SOURCE]; });

function battle(upgraded = false): CombatState {
  const cs = createCombat('charge-test', ['tomb_puppet'], 'normal', [], 50, 52, [], makeRng('CHARGE-HAND', 'c'), 100, 'scholar').state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 1000;
  cs.player.energy = 10;
  cs.player.hand = [card(SOURCE, SOURCE, upgraded, 5)];
  return cs;
}

describe('手牌立即蓄力', () => {
  it.each([false, true])('增加所有手中蓄力牌的蓄力回合，包含刚抽到的牌，不改变其他牌堆（升级=%s）', up => {
    const cs = battle(up);
    cs.player.hand.push(card('charged_blade', 'attack', up, 1), card('rune_shield', 'shield', up), card('surge_glyph', 'both', up, 3), card('patient_study', 'retain-only'), card('strike', 'plain'));
    cs.player.draw = [card('charged_blade', 'undrawn', up, 6), card('strike', 'draw-plain'), card('surge_glyph', 'draw-charge', up, 2)];
    cs.player.discard = [card('rune_shield', 'discarded', up, 4)];
    cs.player.exhaust = [card('surge_glyph', 'exhausted', up, 7)];
    const snapshot = structuredClone(cs);
    const result = playCard(cs, SOURCE, null);
    const p = result.state.player;
    const bonuses = Object.fromEntries(p.hand.map(c => [c.uid, c.bonus]));
    const n = up ? 3 : 2;
    expect(bonuses).toMatchObject({ attack: 1 + n, shield: n, both: 3 + n, 'draw-charge': 2 + n, 'retain-only': 0, plain: 0 });
    expect(p.draw.find(c => c.uid === 'undrawn')?.bonus).toBe(6);
    expect(p.discard).toEqual(snapshot.player.discard);
    expect(p.exhaust.find(c => c.uid === 'exhausted')?.bonus).toBe(7);
    expect(p.exhaust.find(c => c.uid === SOURCE)?.bonus).toBe(5);
    expect(p.hand.some(c => c.uid === SOURCE)).toBe(false);
    expect(cs).toEqual(snapshot);
    expect(describeCard(card(SOURCE, SOURCE, up), null)).toContain(`手中所有蓄力牌立即蓄力 ${n} 回合`);
    expect(result.events.some(e => e.type === 'log' && e.text.includes(`立即蓄力 ${n} 回合`))).toBe(true);
  });

  it('回响重复抽牌和蓄力：先入手的牌加两次，第二次才抽入的牌仅加一次', () => {
    const cs = battle();
    cs.player.statuses.echo = 1;
    cs.player.hand.push(card('charged_blade', 'held'));
    cs.player.draw = [card('surge_glyph', 'second-draw'), card('rune_shield', 'first-draw')];
    const result = playCard(cs, SOURCE, null).state;
    expect(Object.fromEntries(result.player.hand.map(c => [c.uid, c.bonus]))).toEqual({ held: 4, 'first-draw': 4, 'second-draw': 2 });
    expect(result.player.statuses.echo ?? 0).toBe(0);
    expect(result.player.exhaust.find(c => c.uid === SOURCE)?.bonus).toBe(5);
  });

  it.each([false, true])('蓄力后的伤害和格挡说明等于真实结算，预览不改状态（目标牌升级=%s）', up => {
    let cs = battle();
    cs.player.hand.push(card('charged_blade', 'attack', up, 1), card('rune_shield', 'shield', up), card('surge_glyph', 'both', up, 1));
    cs.player.statuses.strength = 2; cs.player.statuses.dexterity = 1;
    cs = playCard(cs, SOURCE, null).state;
    for (const [uid, damage, block] of [['attack', up ? 25 : 22, 0], ['shield', 0, up ? 15 : 12], ['both', up ? 15 : 13, up ? 14 : 12]] as const) {
      const instance = cs.player.hand.find(c => c.uid === uid)!;
      const snapshot = structuredClone(cs);
      const text = describeCard(instance, { player: cs.player, target: cs.enemies[0], relics: cs.relics, isFirstAttack: cs.player.attacksPlayedThisTurn === 0, crescendoBonus: 0 });
      expect(cs).toEqual(snapshot);
      if (damage) expect(text).toContain(`造成 ${damage} 点伤害`);
      if (block) expect(text).toContain(`获得 ${block} 点格挡`);
      cs = playCard(cs, uid, damage ? 'e0' : null).state;
      expect(snapshot.enemies[0].hp - cs.enemies[0].hp).toBe(damage);
      expect(cs.player.block - snapshot.player.block).toBe(block);
    }
  });

  it('星图不额外放大立即蓄力，回合结束仍按原规则继续蓄力', () => {
    const cs = battle(); cs.relics.push('star_chart');
    cs.player.hand.push(card('rune_shield', 'shield'));
    const charged = playCard(cs, SOURCE, null).state;
    expect(charged.player.hand.find(c => c.uid === 'shield')?.bonus).toBe(2);
    const retained = endPlayerTurn(charged).state;
    expect(retained.player.hand.find(c => c.uid === 'shield')?.bonus).toBe(4);
  });

  it('没有蓄力手牌时安全结算，不给普通牌或仅保留牌创建蓄力', () => {
    const cs = battle(); cs.player.hand.push(card('strike', 'plain'), card('patient_study', 'retain-only'));
    const result = playCard(cs, SOURCE, null).state;
    expect(result.player.hand.map(c => c.bonus)).toEqual([0, 0]);
    expect(result.player.exhaust.map(c => c.uid)).toContain(SOURCE);
  });
});
