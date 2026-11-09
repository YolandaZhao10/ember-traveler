import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import * as R from '../engine/run';

describe('随楼层上升的卡牌稀有度', () => {
  it('65层每层概率归一，普通减少、稀有增加，精英始终优于同层普通战', () => {
    for (let floor = 0; floor < 65; floor++) {
      for (const tier of ['normal', 'elite', 'shop'] as const) {
        const w = R.cardRarityWeights(floor, tier);
        expect(w.common + w.uncommon + w.rare).toBeCloseTo(100);
        expect(Math.min(w.common, w.uncommon, w.rare)).toBeGreaterThan(0);
        if (floor) {
          const prev = R.cardRarityWeights(floor - 1, tier);
          expect(w.common).toBeLessThan(prev.common); expect(w.rare).toBeGreaterThan(prev.rare);
          expect(w.uncommon + 2 * w.rare).toBeGreaterThan(prev.uncommon + 2 * prev.rare);
        }
      }
      expect(R.cardRarityWeights(floor, 'elite').rare).toBeGreaterThan(R.cardRarityWeights(floor, 'normal').rare);
      expect(R.cardRarityWeights(floor, 'boss')).toEqual({ common: 0, uncommon: 0, rare: 100 });
    }
    expect(R.cardRarityWeights(0, 'normal')).toEqual({ common: 70, uncommon: 29, rare: 1 });
    expect(R.cardRarityWeights(64, 'normal')).toEqual({ common: 25, uncommon: 45, rare: 30 });
    expect(R.cardRarityWeights(-1, 'normal')).toEqual(R.cardRarityWeights(0, 'normal'));
    expect(R.cardRarityWeights(99, 'normal')).toEqual(R.cardRarityWeights(64, 'normal'));
  });
  it('实际普通战、精英和商店抽取的高层稀有牌更多，随机流可复现', () => {
    for (const tier of ['normal', 'elite', 'shop'] as const) {
      const sample = (floor: number) => {
        const run = R.newRun(`RARITY-${tier}`); run.floor = floor;
        const counts = { common: 0, uncommon: 0, rare: 0 };
        for (let i = 0; i < 1200; i++) {
          const c = R.generateCardChoices(run, tier, 1)[0];
          const rarity = CARDS[c.defId].rarity;
          if (rarity !== 'common' && rarity !== 'uncommon' && rarity !== 'rare') throw Error('非法奖励');
          counts[rarity]++;
        }
        return counts;
      };
      const low = sample(0); const high = sample(64);
      expect(high.rare).toBeGreaterThan(low.rare + 150); expect(high.common).toBeLessThan(low.common);
      expect(sample(64)).toEqual(high);
    }
  });
  it('不指定稀有度的事件随楼层提升，明确稀有奖励不被降档', () => {
    const sample = (floor: number, eventId: string, choice: string) => {
      let rare = 0;
      for (let i = 0; i < 300; i++) {
        let run = R.newRun(`EVENT-RARITY-${i}`); run.map.nodes[run.map.startIds[0]].type = 'event';
        run = R.travelTo(run, run.map.startIds[0]); run.floor = floor; run.event!.eventId = eventId;
        const next = R.eventChoose(run, choice); if (CARDS[next.deck[next.deck.length - 1].defId].rarity === 'rare') rare++;
      }
      return rare;
    };
    expect(sample(64, 'fallen_belltower', 'ring')).toBeGreaterThan(sample(0, 'fallen_belltower', 'ring') + 35);
    expect(sample(0, 'ash_altar', 'blood')).toBe(300);
  });
});
