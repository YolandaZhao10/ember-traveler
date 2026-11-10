import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { describeCard, viewCard } from '../engine/cards';
import { createCombat, endPlayerTurn, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';

const card = (defId: string, upgraded: boolean) => ({ defId, uid: defId, upgraded });
function battle(defId: string, up: boolean) {
  const cs = createCombat('guard-heal', ['tomb_puppet'], 'normal', [], 40, 72, [], makeRng('GUARD-HEAL', 'c'), 100, 'oathbound').state;
  cs.player.hand = [card(defId, up)];
  return cs;
}
describe.each([false, true])('止血护势与余温未散，升级=%s', up => {
  it('普通专属1费，先格挡再回复，使用后弃置可复用；升级按8防3回结算', () => {
    const cs = battle('staunching_guard', up);
    expect(CARDS.staunching_guard).toMatchObject({ rarity: 'common', owner: 'oathbound' });
    expect(viewCard(cs.player.hand[0])).toMatchObject({ cost: 1, exhaust: false });
    expect(describeCard(cs.player.hand[0], null)).toBe(`获得 ${up ? 8 : 7} 点格挡，回复 ${up ? 3 : 2} 点生命。`);
    const after = playCard(cs, 'staunching_guard', null).state;
    expect(after.player.block).toBe(up ? 8 : 7); expect(after.player.hp).toBe(up ? 43 : 42);
    expect(after.player.energy).toBe(2); expect(after.player.discard).toEqual(cs.player.hand);
    expect(after.player.exhaust).toHaveLength(0); expect(after.player.cardsPlayedThisTurn).toBe(1);
  });
  it('回响只重放一次、不额外扣费；按实际治疗触发复苏护甲，不会满血空刷', () => {
    const cs = battle('staunching_guard', up); cs.player.hp = 71;
    cs.player.statuses = { echo: 1, recoveryArmor: 2 };
    const after = playCard(cs, 'staunching_guard', null).state;
    expect(after.player.hp).toBe(72); expect(after.player.energy).toBe(2);
    expect(after.player.cardsPlayedThisTurn).toBe(2); expect(after.player.discard).toHaveLength(1);
    expect(after.player.block).toBe((up ? 8 : 7) * 2 + 2);
    expect(after.player.turnFlags.actualHealing).toBe(1);
    expect(after.player.statuses.echo ?? 0).toBe(0);
  });
  it('余温未散转为回血净化并消耗，不再与新牌共享格挡回血效果', () => {
    const cs = battle('enduring_warmth', up);
    cs.player.statuses = { weak: 2, vulnerable: 2, frail: 2, burn: 3, strength: 6, strengthDown: 2 };
    const after = playCard(cs, 'enduring_warmth', null).state;
    expect(after.player.hp).toBe(up ? 47 : 45); expect(after.player.block).toBe(0);
    expect(after.player.statuses).toEqual({ strength: 6, strengthDown: 2 });
    expect(after.player.exhaust).toEqual(cs.player.hand);
    expect(endPlayerTurn(after).state.player.statuses.strength).toBe(4);
  });
});
