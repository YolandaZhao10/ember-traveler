import { afterEach, expect, it, vi } from 'vitest';
import { CARD_LIST, CARDS, cardAvailableTo } from '../data/cards';
import { makeRng, weightedPick } from '../engine/rng';
import { cardRarityWeights, cardShopPriceRange, generateShopCards, newRun, resetCurrentNode, shopBuyCard, travelTo } from '../engine/run';
import { loadRun, saveRun } from '../engine/save';

const characters = ['traveler', 'picker', 'oathbound', 'scholar'] as const;
const tiers = ['common', 'uncommon', 'rare'] as const;
afterEach(() => vi.unstubAllGlobals());

it.each(characters)('%s 商店跨楼层和难度保证首排类型、第二排通用牌、不重样和原稀有度配比', character => {
  for (let seed = 0; seed < 30; seed++) for (const floor of [0, 20, 40, 60]) for (const difficulty of [50, 100, 200]) {
    const run = newRun(`SHOP-LAYOUT-${seed}`, character); run.floor = floor; run.difficulty.cardRarity = difficulty;
    const before = structuredClone(run);
    const weights = cardRarityWeights(floor, 'shop', difficulty);
    const expected = Array.from({ length: 10 }, () => weightedPick(before.rng.reward, tiers.map(item => ({ item, weight: weights[item] }))));
    const cards = generateShopCards(run), defs = cards.map(c => CARDS[c.defId]);
    expect(defs).toHaveLength(10);
    expect(defs.slice(0, 5).map(c => c.type)).toEqual(['attack', 'attack', 'skill', 'skill', 'power']);
    expect(defs.slice(5).filter(c => !c.owner).length).toBeGreaterThanOrEqual(2);
    expect(defs[5].owner).toBeUndefined(); expect(defs[6].owner).toBeUndefined();
    expect(new Set(cards.map(c => c.uid)).size).toBe(10);
    expect(new Set(cards.map(c => c.defId)).size).toBe(10);
    expect(defs.every(c => cardAvailableTo(c, character))).toBe(true);
    expect(defs.every(c => tiers.some(r => r === c.rarity))).toBe(true);
    if (expected.some(r => CARD_LIST.some(c => c.rarity === r && c.type === 'power' && cardAvailableTo(c, character)))) {
      expect(defs.map(c => c.rarity).sort()).toEqual(expected.sort());
    } else {
      expect(defs.filter(c => c.rarity === 'common')).toHaveLength(9);
    }
    // 未改动原价格随机流；种子与生成顺序确定同一货架。
    expect(run.rng.shop).toEqual(before.rng.shop);
    const replay = newRun(`SHOP-LAYOUT-${seed}`, character); replay.floor = floor; replay.difficulty.cardRarity = difficulty;
    expect(generateShopCards(replay)).toEqual(cards);
  }
});

it('极端十次都抽到普通、又没有普通能力牌时仅补能力位，仍生成十张不同的牌', () => {
  const run = newRun('SHOP-POWER-FALLBACK', 'traveler');
  const weights = cardRarityWeights(0, 'shop', 50); run.difficulty.cardRarity = 50;
  let found = false;
  for (let seed = 0; seed < 10000; seed++) {
    const rng = makeRng(`ALL-COMMON-${seed}`, 'reward'), copy = structuredClone(rng);
    const rolls = Array.from({ length: 10 }, () => weightedPick(copy, tiers.map(item => ({ item, weight: weights[item] }))));
    if (!rolls.every(r => r === 'common')) continue;
    run.rng.reward = rng; found = true; break;
  }
  expect(found).toBe(true);
  const defs = generateShopCards(run).map(c => CARDS[c.defId]);
  expect(defs[4].type).toBe('power');
  expect(defs.filter(c => c.rarity === 'common')).toHaveLength(9);
  expect(new Set(defs.map(c => c.id)).size).toBe(10);
});

it.each([false, true])('购买、SL与刷新保持货架位置和随机价格，折扣=%s', discount => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  let run = newRun('SHOP-LAYOUT-SAVE', 'scholar'); run.gold = 5000;
  if (discount) run.relics.push('merchant_scale');
  const node = run.map.startIds[0]; run.map.nodes[node].type = 'shop'; run = travelTo(run, node);
  for (const item of run.shop!.cards) {
    const [min, max] = cardShopPriceRange(run, CARDS[item.card.defId].rarity);
    expect(item.price).toBeGreaterThanOrEqual(min); expect(item.price).toBeLessThanOrEqual(max);
  }
  const purchased = shopBuyCard(run, 5);
  expect(purchased.shop!.cards[5].sold).toBe(true);
  expect(purchased.gold).toBe(run.gold - run.shop!.cards[5].price);
  expect(purchased.shop!.cards.map(c => c.card)).toEqual(run.shop!.cards.map(c => c.card));
  saveRun(purchased); expect(loadRun()).toEqual(purchased);
  expect(resetCurrentNode(loadRun()!)).toEqual(run);
});
