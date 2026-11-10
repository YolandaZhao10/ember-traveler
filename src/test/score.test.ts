import { afterEach, expect, it, vi } from 'vitest';
import { scoreJourney } from '../engine/score';
import { newRun } from '../engine/run';
import { loadHistory, recordJourney, ensureRecordId } from '../engine/history';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { CARDS } from '../data/cards';
import { createCombat } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JourneyScore } from '../ui/components/JourneyScore';

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
  expect(score.version).toBe(2);
  expect(score.multiplier).toBe(1); expect(scoreJourney(JSON.parse(before))).toEqual(score);
  expect(JSON.stringify(run)).toBe(before);
  run.screen = 'gameover'; expect(scoreJourney(run)).toBeNull();
  run.screen = 'victory'; run.chapter = 3; expect(scoreJourney(run)).toBeNull();
});
it('金币封顶，重复遗物不计分；无时间/伤害刷分', () => {
  const run = victory(); run.gold = 1000;
  const score = scoreJourney(run)!;
  run.gold = 1e9; run.stats.damageDealt = 1e9; run.elapsedMs = 1e9;
  run.relics.push(run.relics[0]);
  expect(scoreJourney(run)!.total).toBe(score.total);
});
it('构筑最多计算20张，升级加分；诅咒单独加分，状态和未知卡不虚增', () => {
  const run = victory();
  run.deck = Array.from({ length: 20 }, (_, i) => ({ uid: String(i), defId: 'defend', upgraded: false }));
  const get = () => scoreJourney(run)!.parts.find(p => p.label === '构筑完成度')!.points;
  const base = get(); run.deck[0].upgraded = true; expect(get()).toBe(base + 15);
  run.deck.push({ uid: 'extra', defId: 'defend', upgraded: false }); expect(get()).toBe(base + 15);
  const beforeCurse = scoreJourney(run)!.total;
  run.deck.push({ uid: 'curse', defId: 'doubt', upgraded: false });
  expect(get()).toBe(base + 15); expect(scoreJourney(run)!.total).toBe(beforeCurse + 40);
  run.deck.push({ uid: 'unknown', defId: 'removed-card', upgraded: true }, { uid: 'status', defId: 'dazed', upgraded: false });
  expect(get()).toBe(base + 15); expect(scoreJourney(run)!.total).toBe(beforeCurse + 40);
});
it('每种永久诅咒都加分，同名逐张计算；移除后不再加分，战斗临时塞牌不算', () => {
  const run = victory(), base = scoreJourney(run)!.total;
  const curses = Object.values(CARDS).filter(c => c.type === 'curse');
  expect(curses.length).toBeGreaterThan(1);
  for (const c of curses) run.deck.push({ uid: c.id, defId: c.id, upgraded: false });
  expect(scoreJourney(run)!.total).toBe(base + curses.length * 40);
  run.deck.push({ uid: 'repeat', defId: curses[0].id, upgraded: false });
  expect(scoreJourney(run)!.parts.find(p => p.label === '负咒前行')!.points).toBe((curses.length + 1) * 40);
  run.deck = run.deck.filter(c => CARDS[c.defId].type !== 'curse');
  run.combat = createCombat('score', ['ash_rat'], 'normal', run.deck, run.hp, run.maxHp, run.relics, makeRng('SCORE-TEMP', 'c'), 100).state;
  run.combat.player.hand.push({ uid: 'temporary', defId: 'doubt', upgraded: false });
  expect(scoreJourney(run)!.total).toBe(base);
});
it.each([[0, 0], [999, 0], [1000, 0], [1001, -1], [1250, -250], [1500, -500], [1e9, -500]])('累计出牌%d次的效率分为%d，额外出牌不会增加总分', (played, points) => {
  const run = victory(), base = scoreJourney(run)!.total;
  run.stats.cardsPlayed = played;
  const score = scoreJourney(run)!;
  expect(score.parts.find(p => p.label === '出牌效率')!.points).toBe(points);
  expect(score.total).toBe(base + points);
});
it('奖励与扣分一起应用难度系数，界面显示真正的负号而非加负号', () => {
  const run = victory(); run.stats.cardsPlayed = 1250;
  run.deck.push({ uid: 'curse', defId: 'doubt', upgraded: false });
  run.difficulty = { ...DIFFICULTY_PRESETS[2].settings };
  const score = scoreJourney(run)!;
  expect(score.total).toBe(Math.round(score.parts.reduce((n, p) => n + p.points, 0) * score.multiplier));
  const html = renderToStaticMarkup(createElement(JourneyScore, { score }));
  expect(html).toContain('出牌效率<b class="score-penalty">-250</b>');
  expect(html).toContain('负咒前行<b>+40</b>');
  expect(html).not.toContain('+-');
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
  const legacy = loadHistory()[0];
  legacy.score = { version: 1, total: 1234, multiplier: 1, parts: [{ label: '出牌积累', points: 500, detail: '旧计分规则' }] };
  values.set('ember-traveler:history', JSON.stringify({ version: 2, records: [legacy] }));
  const another = victory(); ensureRecordId(another); recordJourney(another);
  expect(loadHistory().find(r => r.id === legacy.id)?.score).toEqual(legacy.score);
  const old = loadHistory()[0]; delete old.score;
  values.set('ember-traveler:history', JSON.stringify({ version: 1, records: [old] }));
  expect(loadHistory()[0].score).toBeUndefined();
});
