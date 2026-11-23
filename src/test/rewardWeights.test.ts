import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARDS, cardAvailableTo } from '../data/cards';
import { chance, makeRng, pick, weightedPick } from '../engine/rng';
import * as R from '../engine/run';
import type { CardDef, CardInstance, CharacterId, RunState } from '../engine/types';

const characters: CharacterId[] = ['traveler', 'picker', 'oathbound', 'scholar'];
const rewardRarities = ['common', 'uncommon', 'rare'];
const add = (run: RunState, ...ids: string[]) => { for (const id of ids) run.deck.push({ uid: `extra-${run.deck.length}`, defId: id, upgraded: false }); return run; };

/** 改版前的抽取流程：固定按基础概率抽共享池，池内均匀抽取。用来确认随机数消耗次数不变。 */
function uniformChoices(run: RunState, tier: R.CardRewardTier, n: number): CardDef[] {
  const weights = R.cardRarityWeights(run.floor, tier, run.difficulty.cardRarity);
  const selected: CardDef[] = [];
  while (selected.length < n) {
    const rarity = weightedPick(run.rng.reward, (['common', 'uncommon', 'rare'] as const).map(item => ({ item, weight: weights[item] })));
    let pool = CARD_LIST.filter(card => card.rarity === rarity && !selected.some(c => c.id === card.id)
      && (tier === 'boss' ? card.owner === run.character : cardAvailableTo(card, run.character)));
    if (tier === 'normal' || tier === 'elite') {
      const shared = chance(run.rng.reward, R.SHARED_REWARD_CHANCE);
      pool = pool.filter(c => shared ? !c.owner : c.owner === run.character);
    }
    if (pool.length) selected.push(pick(run.rng.reward, pool));
  }
  return selected;
}

describe('共享牌的主接口标注', () => {
  const HOOKS: Record<CharacterId, string[]> = {
    traveler: ['投石', '守夜', '匀息', '辟邪灯', '卸热', '掷出火把', '熔炉', '篝火避难所'],
    picker: ['燃烧', '燃烬借力', '疾风余烬', '火雨', '重拨余火', '闷燃之星', '余烬拾遗'],
    oathbound: ['一口干粮', '连掷火石', '灰烬之刃', '燃料交换', '隔热外衣', '淬炭刃', '余烬疗愈', '火星冠冕', '涅槃之息'],
    scholar: ['守住火种', '灼热打击', '炭火启示', '翻找行囊', '封存烈火', '暮火裁决', '余烬灯芯', '静燃之页'],
  };
  it.each(characters)('%s 的接口牌与设计表一致，且都是可作为奖励的共享牌', character => {
    const hooked = CARD_LIST.filter(c => c.hook === character);
    expect(hooked.map(c => c.name).sort()).toEqual([...HOOKS[character]].sort());
    for (const c of hooked) {
      expect(c.owner, c.name).toBeUndefined();
      expect(rewardRarities, c.name).toContain(c.rarity);
      expect(c.kindred, c.name).toBeUndefined();
    }
  });
  it('专属牌没有接口标注；五张共鸣牌另行标记', () => {
    expect(CARD_LIST.filter(c => c.hook && c.owner)).toEqual([]);
    expect(CARD_LIST.filter(c => c.kindred)).toHaveLength(5);
  });
});

describe('奖励抽共享池的概率', () => {
  it.each(characters)('%s：初始牌组为 35%；打击、防御、引火、诅咒和专属牌都不计入共享牌数', character => {
    const run = R.newRun(`SHARE-${character}`, character);
    expect(R.sharedRewardChance(run.deck)).toBe(0.35);
    add(run, 'strike', 'defend', 'kindle', 'kindle', 'ashes', 'ashes', 'ashes');
    add(run, ...CARD_LIST.filter(c => c.owner === character && c.rarity === 'common').slice(0, 4).map(c => c.id));
    expect(R.sharedRewardChance(run.deck)).toBe(0.35);
    add(run, 'stoke', 'torch');
    expect(R.sharedRewardChance(run.deck)).toBe(0.35);
    add(run, 'kindred_spark');
    expect(R.sharedRewardChance(run.deck)).toBe(0.45);
    // 卡牌事件沿用调整前的 25% / 35%。
    expect(R.sharedRewardChance(run.deck, 'event')).toBe(0.35);
    expect(R.sharedRewardChance(R.newRun('CHANCE-EVENT', character).deck, 'event')).toBe(0.25);
  });

  it.each(characters)('%s：牌组有 3 张共享牌后，普通与精英奖励每槽约 45% 来自共享池，首领仍只出专属稀有牌', character => {
    for (const tier of ['normal', 'elite'] as const) {
      const run = add(R.newRun(`SHARE35-${character}-${tier}`, character), 'stoke', 'torch', 'tinder_bundle');
      let shared = 0, total = 0;
      for (let i = 0; i < 1500; i++) {
        run.floor = i % 65;
        for (const c of R.generateCardChoices(run, tier, 3)) { shared += Number(!CARDS[c.defId].owner); total++; }
      }
      expect(shared / total).toBeGreaterThan(0.43);
      expect(shared / total).toBeLessThan(0.47);
      expect(R.generateCardChoices(run, 'boss', 3).every(c => CARDS[c.defId].owner === character && CARDS[c.defId].rarity === 'rare')).toBe(true);
    }
  });
});

describe('共享池内的加权', () => {
  it('权重：本角色接口牌与共鸣牌 1.5，其余 1；专属牌恒为 1；旅人全部为 1', () => {
    const weight = (id: string, character: CharacterId) => R.sharedRewardWeight(CARDS[id], character);
    expect([weight('ignite', 'picker'), weight('kindred_spark', 'picker'), weight('stone_throw', 'picker'), weight('stoke', 'picker'), weight('light_up', 'picker')]).toEqual([1.5, 1.5, 1, 1, 1]);
    expect([weight('ember_blade', 'oathbound'), weight('ember_blade', 'scholar'), weight('searing_strike', 'scholar'), weight('kindred_dawn', 'scholar')]).toEqual([1.5, 1, 1.5, 1.5]);
    for (const c of CARD_LIST) expect(R.sharedRewardWeight(c, 'traveler'), c.name).toBe(1);
  });

  it.each(['picker', 'oathbound', 'scholar'] as const)('%s：抽到的共享牌里，本角色接口牌与共鸣牌的单张出现率约为普通共享牌的 1.5 倍，其他角色的接口牌不出现', character => {
    const run = R.newRun(`WEIGHT-${character}`, character);
    run.floor = 30;
    const seen = new Map<string, number>();
    for (let i = 0; i < 60000; i++) {
      const [c] = R.generateCardChoices(run, 'normal', 1);
      if (!CARDS[c.defId].owner) seen.set(c.defId, (seen.get(c.defId) ?? 0) + 1);
    }
    // 同一稀有度内比较，排除稀有度权重与池子大小的影响。
    for (const rarity of ['common', 'uncommon'] as const) {
      const pool = CARD_LIST.filter(c => !c.owner && c.rarity === rarity);
      const mean = (cards: CardDef[]) => cards.reduce((n, c) => n + (seen.get(c.id) ?? 0), 0) / cards.length;
      const favored = mean(pool.filter(c => c.kindred || c.hook === character));
      const neutral = mean(pool.filter(c => !c.hook && !c.kindred));
      expect(favored / neutral, `${rarity} 本角色`).toBeGreaterThan(1.3);
      expect(favored / neutral, `${rarity} 本角色`).toBeLessThan(1.7);
    }
    for (const c of CARD_LIST.filter(c => !c.owner && rewardRarities.includes(c.rarity))) {
      if (c.hook && c.hook !== character) expect(seen.get(c.id) ?? 0, c.name).toBe(0);
      else expect(seen.get(c.id) ?? 0, c.name).toBeGreaterThan(0);
    }
  });

  it('旅人暂不加权：共享牌不足 3 张时，奖励与改版前的均匀抽取逐张相同', () => {
    for (const tier of ['normal', 'elite', 'boss'] as const) for (let i = 0; i < 120; i++) {
      const run = R.newRun('TRAVELER-UNIFORM', 'traveler');
      run.floor = i % 65; run.rng.reward = makeRng(`TRAVELER-${tier}-${i}`, 'reward');
      const control = structuredClone(run);
      // 单张奖励不做三选一的功能区分，可与旧流程逐张比较。
      expect(R.generateCardChoices(run, tier, 1).map(c => c.defId)).toEqual(uniformChoices(control, tier, 1).map(c => c.id));
      expect(run.rng.reward).toEqual(control.rng.reward);
    }
  });

  it.each(characters)('%s：加权后每个奖励槽消耗的随机数次数与改版前相同，首领奖励结果不变', character => {
    for (const tier of ['normal', 'elite', 'boss'] as const) for (let i = 0; i < 80; i++) {
      const run = R.newRun(`DRAWS-${character}`, character);
      if (i % 2) add(run, 'stoke', 'torch', 'tinder_bundle');
      run.floor = i % 65; run.rng.reward = makeRng(`DRAWS-${tier}-${i}`, character);
      const control = structuredClone(run);
      const cards: CardInstance[] = R.generateCardChoices(run, tier, 1);
      const before = uniformChoices(control, tier, 1);
      expect(run.rng.reward).toEqual(control.rng.reward);
      expect(CARDS[cards[0].defId].rarity).toBe(before[0].rarity);
      if (tier === 'boss') expect(cards[0].defId).toBe(before[0].id);
    }
  });
});
