import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARDS, cardAvailableTo } from '../data/cards';
import { cardRole, distinctRewardPool } from '../engine/cardChoices';
import { makeRng, pick, weightedPick } from '../engine/rng';
import * as R from '../engine/run';
import type { CardDef, CharacterId, RunState } from '../engine/types';
import { rewardDeckSummary } from '../ui/rewardDeckSummary';

const characters: CharacterId[] = ['traveler', 'picker', 'oathbound', 'scholar'];

/** 原抽取流程作为对照：保证功能筛选不重掷稀有度或额外推进随机流。 */
function unfilteredChoices(run: RunState, tier: R.CardRewardTier, n: number): CardDef[] {
  const weights = R.cardRarityWeights(run.floor, tier, run.difficulty.cardRarity);
  const selected: CardDef[] = [];
  while (selected.length < n) {
    const rarity = weightedPick(run.rng.reward, (['common', 'uncommon', 'rare'] as const).map(item => ({ item, weight: weights[item] })));
    const pool = CARD_LIST.filter(card => card.rarity === rarity && !selected.some(c => c.id === card.id)
      && (tier === 'boss' ? card.owner === run.character : cardAvailableTo(card, run.character)));
    if (pool.length) selected.push(pick(run.rng.reward, pool));
  }
  return selected;
}

describe('卡牌奖励功能分工', () => {
  it('按直接作用分类，攻击附带资源、格挡附带抽牌仍保留主要用途', () => {
    for (const id of ['strike', 'cross_guard', 'tend_coals']) expect(cardRole(CARDS[id]), id).toBe('offense');
    for (const id of ['defend', 'measured_step', 'ash_shell', 'ember_plate', 'smoke_screen']) expect(cardRole(CARDS[id]), id).toBe('defense');
    for (const id of ['sift_ash', 'pocket_coals', 'blood_rite', 'steadfast_guard', 'long_road']) expect(cardRole(CARDS[id]), id).toBe('engine');
  });

  it('条件收益不会盖过无条件收益，也不把失血与负面状态等代价当主要功能', () => {
    const card: CardDef = {
      ...CARDS.sift_ash,
      effects: [
        { kind: 'loseHp', amount: 3 },
        { kind: 'status', status: 'vulnerable', amount: 1, target: 'self' },
        { kind: 'gainEmber', amount: -2 },
        { kind: 'conditional', cond: { kind: 'hasBlock' }, then: [{ kind: 'block', amount: 8 }] },
        { kind: 'draw', amount: 2 },
      ],
    };
    expect(cardRole(card)).toBe('engine');
    expect(cardRole({ ...card, effects: [{ kind: 'conditional', cond: { kind: 'hasBlock' }, then: [{ kind: 'block', amount: 8 }] }] })).toBe('defense');
  });

  it('只在第三槽避开前两张相同功能，没有别的功能时安全回退，不修改原池', () => {
    const pool = [CARDS.cross_guard, CARDS.ember_patrol, CARDS.sift_ash];
    const snapshot = pool.slice();
    expect(distinctRewardPool(pool, [])).toBe(pool);
    expect(distinctRewardPool(pool, [CARDS.strike])).toBe(pool);
    expect(distinctRewardPool(pool, [CARDS.strike, CARDS.defend])).toBe(pool);
    expect(distinctRewardPool(pool, [CARDS.strike, CARDS.twin_blades])).toEqual([CARDS.ember_patrol, CARDS.sift_ash]);
    expect(distinctRewardPool(pool, [CARDS.strike, CARDS.twin_blades, CARDS.ember_patrol])).toBe(pool);
    const singleRole = [CARDS.cross_guard];
    expect(distinctRewardPool(singleRole, [CARDS.strike, CARDS.twin_blades])).toBe(singleRole);
    const empty: CardDef[] = [];
    expect(distinctRewardPool(empty, [CARDS.strike, CARDS.twin_blades])).toBe(empty);
    expect(pool).toEqual(snapshot);
  });

  it.each(characters)('%s 的三选一保留稀有度、角色范围与随机流，同时避免功能全部相同', character => {
    const base = R.newRun(`ROLE-${character}`, character);
    let changedOffers = 0;
    for (const tier of ['normal', 'elite', 'boss'] as const) {
      for (let i = 0; i < 40; i++) {
        const run = structuredClone(base);
        run.floor = i % 65;
        run.rng.reward = makeRng(`ROLE-${tier}-${i}`, character);
        const replay = structuredClone(run);
        const control = structuredClone(run);
        const original = unfilteredChoices(control, tier, 3);
        const result = R.generateCardChoices(run, tier, 3);
        const defs = result.map(card => CARDS[card.defId]);

        expect(R.generateCardChoices(replay, tier, 3)).toEqual(result);
        expect(run.rng.reward).toEqual(control.rng.reward);
        expect(defs.map(card => card.rarity)).toEqual(original.map(card => card.rarity));
        expect(defs.slice(0, 2)).toEqual(original.slice(0, 2));
        expect(new Set(defs.map(card => card.id)).size).toBe(3);
        expect(new Set(defs.map(cardRole)).size).toBeGreaterThan(1);
        for (const card of defs) {
          expect(cardAvailableTo(card, character)).toBe(true);
          if (tier === 'boss') expect(card).toMatchObject({ owner: character, rarity: 'rare' });
        }
        if (defs[2].id !== original[2].id) changedOffers++;
      }
    }
    expect(changedOffers).toBeGreaterThan(0);
  });

  it('商店十张牌沿用原抽取结果，单张奖励也不强加功能限制', () => {
    for (const [tier, n] of [['shop', 10], ['normal', 1]] as const) {
      const run = R.newRun(`ROLE-UNAFFECTED-${tier}`, 'scholar');
      const control = structuredClone(run);
      expect(R.generateCardChoices(run, tier, n).map(card => card.defId)).toEqual(unfilteredChoices(control, tier, n).map(card => card.id));
      expect(run.rng.reward).toEqual(control.rng.reward);
    }
  });
});

describe('奖励旁的牌组概览', () => {
  it('使用升级后的实际费用，诅咒计入张数但不参与平均，同名升级牌合并持有数量', () => {
    const discounted = CARD_LIST.find(card => card.upgrade.cost !== undefined && card.upgrade.cost < card.cost)!;
    const curse = CARD_LIST.find(card => card.type === 'curse')!;
    const summary = rewardDeckSummary([
      { uid: 'base', defId: discounted.id, upgraded: false },
      { uid: 'upgraded', defId: discounted.id, upgraded: true },
      { uid: 'curse', defId: curse.id, upgraded: false },
    ]);
    expect(summary.count).toBe(3);
    expect(summary.types.curse).toBe(1);
    expect(summary.types[discounted.type]).toBe(2);
    expect(summary.averageCost).toBe((discounted.cost + discounted.upgrade.cost!) / 2);
    expect(summary.copies[discounted.id]).toBe(2);
  });

  it('空牌组或只有诅咒时没有平均费用', () => {
    const curse = CARD_LIST.find(card => card.type === 'curse')!;
    expect(rewardDeckSummary([]).averageCost).toBeNull();
    expect(rewardDeckSummary([{ uid: 'curse', defId: curse.id, upgraded: false }]).averageCost).toBeNull();
  });
});
