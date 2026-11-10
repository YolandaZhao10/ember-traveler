import { afterEach, expect, it, vi } from 'vitest';
import { scoreJourney } from '../engine/score';
import { newRun } from '../engine/run';
import { loadHistory, recordJourney, ensureRecordId } from '../engine/history';
import { DIFFICULTY_PRESETS } from '../data/difficulty';

function victory() {
  const run = newRun('SCORE'); run.chapter = 4; run.screen = 'victory'; run.floor = 64;
  run.stats = { floorsCleared: 65, enemiesKilled: 80, cardsPlayed: 300, damageDealt: 9000, elitesKilled: 10 };
  run.gold = 450; return run;
}
afterEach(() => vi.unstubAllGlobals());
it('仅终章胜利评分；评分来自最终快照、可复算且不修改状态', () => {
  expect(scoreJourney(newRun('SCORE'))).toBeNull();
  const run = victory(), before = JSON.stringify(run), score = scoreJourney(run)!;
  expect(score.total).toBe(score.parts.reduce((n, p) => n + p.points, 0));
  expect(score.multiplier).toBe(1); expect(scoreJourney(JSON.parse(before))).toEqual(score);
  expect(JSON.stringify(run)).toBe(before);
  run.screen = 'gameover'; expect(scoreJourney(run)).toBeNull();
  run.screen = 'victory'; run.chapter = 3; expect(scoreJourney(run)).toBeNull();
});
it('金币和出牌封顶，重复遗物不计分；无时间/伤害刷分', () => {
  const run = victory(); run.gold = 1000;
  const score = scoreJourney(run)!;
  run.gold = 1e9; run.stats.cardsPlayed = 1e9; run.stats.damageDealt = 1e9; run.elapsedMs = 1e9;
  run.relics.push(run.relics[0]);
  expect(scoreJourney(run)!.total).toBe(score.total);
});
it('牌组最多计算20张，升级加分、诅咒扣分，未知卡不虚增', () => {
  const run = victory();
  run.deck = Array.from({ length: 20 }, (_, i) => ({ uid: String(i), defId: 'defend', upgraded: false }));
  const get = () => scoreJourney(run)!.parts.find(p => p.label === '构筑完成度')!.points;
  const base = get(); run.deck[0].upgraded = true; expect(get()).toBe(base + 15);
  run.deck.push({ uid: 'extra', defId: 'defend', upgraded: false }); expect(get()).toBe(base + 15);
  run.deck.push({ uid: 'curse', defId: 'doubt', upgraded: false }); expect(get()).toBe(base + 15 - 40);
  run.deck.push({ uid: 'unknown', defId: 'removed-card', upgraded: true }); expect(get()).toBe(base + 15 - 40);
});
it('挑战系数高于标准，增加掉落便利会下调，旧记录兼容，SL覆盖同局分数', () => {
  const run = victory(), base = scoreJourney(run)!.total; ensureRecordId(run);
  run.difficulty = { ...DIFFICULTY_PRESETS[2].settings }; expect(scoreJourney(run)!.total).toBeGreaterThan(base);
  run.difficulty.gold = 200; expect(scoreJourney(run)!.multiplier).toBeLessThan(1.28);
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
  recordJourney(run); recordJourney(run); expect(loadHistory()).toHaveLength(1);
  expect(loadHistory()[0].score).toEqual(scoreJourney(run));
  run.gold = 0; recordJourney(run); expect(loadHistory()).toHaveLength(1); expect(loadHistory()[0].score).toEqual(scoreJourney(run));
  const old = loadHistory()[0]; delete old.score;
  values.set('ember-traveler:history', JSON.stringify({ version: 1, records: [old] }));
  expect(loadHistory()[0].score).toBeUndefined();
});
