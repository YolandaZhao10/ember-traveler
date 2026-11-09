import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { RELICS } from '../data/relics';
import * as R from '../engine/run';

function won(floor: number, tier: 'normal' | 'elite' | 'boss') {
  let run = R.newRun('GOLD-FIXED'); run = R.travelTo(run, run.map.startIds[0]);
  run.floor = floor; run.chapter = floor < 20 ? 1 : 2;
  run.combat!.tier = tier; run.combat!.outcome = 'won';
  return run;
}
describe('固定战斗金币与商店价格', () => {
  it('65层所有商品和删牌价格均不涨价，七五折仍生效且货架与SL固定', () => {
    for (const discount of [false, true]) for (let floor = 0; floor < 65; floor++) {
      let run = R.newRun('PRICE-FIXED'); run.chapter = floor < 20 ? 1 : 2;
      if (discount) run.relics.push('merchant_scale');
      const id = run.map.startIds[0]; run.map.nodes[id].type = 'shop'; run.map.nodes[id].row = floor % 20;
      run = R.travelTo(run, id);
      const mul = discount ? 0.75 : 1;
      expect(run.shop!.priceMultiplier).toBe(mul); expect(run.shop!.removePrice).toBe(Math.round(75 * mul));
      const cardBase = { common: [45, 55], uncommon: [70, 80], rare: [120, 150] };
      const relicBase = { common: [150, 180], uncommon: [200, 250], rare: [280, 300] };
      for (const rarity of ['common', 'uncommon', 'rare'] as const) {
        expect(R.cardShopPriceRange(run, rarity)).toEqual(cardBase[rarity].map(n => Math.round(n * mul)));
        expect(R.relicShopPriceRange(run, rarity)).toEqual(relicBase[rarity].map(n => Math.round(n * mul)));
      }
      for (const item of run.shop!.cards) {
        const [low, high] = R.cardShopPriceRange(run, CARDS[item.card.defId].rarity);
        expect(item.price).toBeGreaterThanOrEqual(low); expect(item.price).toBeLessThanOrEqual(high);
      }
      for (const item of run.shop!.relics) {
        const [low, high] = R.relicShopPriceRange(run, RELICS[item.relicId].rarity);
        expect(item.price).toBeGreaterThanOrEqual(low); expect(item.price).toBeLessThanOrEqual(high);
      }
      expect(R.resetCurrentNode(run).shop).toEqual(run.shop);
    }
  });
  it('普通15–20、精英20–30、首领75，跨章不涨，实际结算与SL保持且不能重复领取', () => {
    for (let floor = 0; floor < 65; floor++) {
      for (const tier of ['normal', 'elite', 'boss'] as const) {
        const expected = tier === 'normal' ? [15, 20] : tier === 'elite' ? [20, 30] : [75, 75];
        expect(R.combatGoldRange(floor, tier)).toEqual(expected);
        const next = R.finishCombat(won(floor, tier)); const gold = next.reward!.gold;
        expect(gold).toBeGreaterThanOrEqual(expected[0]); expect(gold).toBeLessThanOrEqual(expected[1]);
        expect(R.finishCombat(next)).toBe(next);
        const claimed = R.rewardTakeGold(next);
        expect(claimed.gold).toBe(next.gold + gold); expect(R.rewardTakeGold(claimed)).toBe(claimed);
        expect(R.resetCurrentNode(claimed)).toEqual(next);
      }
    }
  });
  it('金币难度与遗物额外收益仍独立生效', () => {
    expect(R.combatGoldRange(39, 'elite', 200)).toEqual([40, 60]);
    expect(R.combatGoldRange(39, 'boss', 50)).toEqual([38, 38]);
    const plain = won(25, 'normal'); const bonus = structuredClone(plain);
    bonus.relics.push('coin_purse', 'wayfarer_coin');
    expect(R.finishCombat(bonus).reward!.gold - R.finishCombat(plain).reward!.gold).toBe(8);
  });
  it('当店买入天平不重算旧货架，下一店才采用新折扣', () => {
    let run = R.newRun('BUY-DISCOUNT'); run.gold = 999;
    const id = run.map.startIds[0]; run.map.nodes[id].type = 'shop'; run = R.travelTo(run, id);
    run.shop!.relics[0] = { relicId: 'merchant_scale', price: 150, sold: false };
    const bought = R.shopBuyRelic(run, 0);
    expect(bought.shop!.cards).toEqual(run.shop!.cards);
    expect(R.cardShopPriceRange(bought, 'common')).toEqual([45, 55]);
    expect(bought.shop!.discounted).toBe(false);
    expect(R.cardShopPriceRange(R.shopLeave(bought), 'common')).toEqual([34, 41]);
  });
});
