import { CARDS } from '../data/cards';
import { RELICS } from '../data/relics';
import { normalizeDifficulty } from '../data/difficulty';
import type { RunState } from './types';

export interface JourneyScore {
  version: 1;
  total: number;
  multiplier: number;
  parts: { label: string; points: number; detail: string }[];
}
const cap = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));

/** 只评价已通关的最终快照，不改变随机流；SL恢复统计，不能重复累加得分。 */
export function scoreJourney(run: RunState): JourneyScore | null {
  if (run.screen !== 'victory' || run.chapter !== 4) return null;
  const relicPoints = [...new Set(run.relics)].reduce((sum, id) => {
    const r = RELICS[id];
    return sum + (!r ? 0 : r.chapter ? 100 : r.source ? 75 : ({ starter: 10, common: 25, uncommon: 50, rare: 75 }[r.rarity] ?? 0));
  }, 0);
  const deck = run.deck.flatMap(c => {
    const def = CARDS[c.defId];
    if (!def || def.type === 'curse' || def.type === 'status') return [];
    const value = { starter: 10, common: 25, uncommon: 40, rare: 65, curse: 0, status: 0 }[def.rarity];
    return [value + (c.upgraded ? 15 : 0)];
  }).sort((a, b) => b - a).slice(0, 20);
  const curses = run.deck.filter(c => CARDS[c.defId]?.type === 'curse').length;
  const parts = [
    { label: '终庭通关', points: 3000, detail: '击败无昼之主，完成四章旅程' },
    { label: '探索与精英', points: Math.round(cap(run.stats.floorsCleared, 65) * 20 + cap(run.stats.elitesKilled, 20) * 50), detail: `完成 ${run.stats.floorsCleared} 层 ×20，击败 ${run.stats.elitesKilled} 名精英 ×50（最多20名）` },
    { label: '遗物收藏', points: relicPoints, detail: `${new Set(run.relics).size} 件；初始10、普通25、罕见50、稀有/问号/商店75、章节100分，重复ID不累加` },
    { label: '金币储备', points: Math.floor(cap(run.gold, 1000)), detail: `剩余 ${run.gold} 金币，每枚1分，上限1000分` },
    { label: '出牌积累', points: Math.floor(cap(run.stats.cardsPlayed, 250) * 2), detail: `累计打出 ${run.stats.cardsPlayed} 张，含回响和重放；每张2分，上限500分` },
    { label: '构筑完成度', points: Math.max(0, deck.reduce((sum, n) => sum + n, 0) - curses * 40), detail: `取分值最高的20张：初始10、普通25、罕见40、稀有65，升级另加15；每张诅咒扣40。评价稀有度与升级投入，不等于实际战力或联动强度` },
  ];
  const d = normalizeDifficulty(run.difficulty);
  const combat = (Number(d.enemyHealth) + Number(d.enemyIntent) + Number(d.bossHealth) + Number(d.bossIntent)) / 400;
  const reward = (Number(d.gold) + Number(d.cardRarity) + Number(d.relicRarity)) / 300;
  const multiplier = Math.round(Math.max(.25, Math.min(2, combat / Math.max(1, reward))) * 100) / 100;
  return { version: 1, parts, multiplier, total: Math.round(parts.reduce((sum, p) => sum + p.points, 0) * multiplier) };
}
