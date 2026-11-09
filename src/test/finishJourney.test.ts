import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { newRun, travelTo, finishCombat } from '../engine/run';
import { generateMap } from '../engine/map';
import { loadRun, saveRun } from '../engine/save';
import { journeyStats, loadHistory } from '../engine/history';

beforeEach(() => {
  vi.resetModules();
  const values = new Map<string, string>([['ember-traveler:settings', JSON.stringify({ sound: false, fastAnim: true })]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

function finalBattle() {
  const run = newRun('FINISH-JOURNEY');
  run.recordId = 'finished-journey'; run.chapter = 4;
  run.map = generateMap(run.rng.map, 4);
  run.currentNodeId = Object.values(run.map.nodes).find(n => n.row === 3)!.id;
  run.elapsedMs = 123456;
  run.deck[0].upgraded = true;
  return travelTo(run, run.map.bossId);
}

it.each(['won', 'lost'] as const)('终章结算 %s 后结束旅程，保留原胜负、完整牌组与用时，且不重复记录', async outcome => {
  let run = finalBattle(); run.combat!.outcome = outcome;
  if (outcome === 'lost') run.combat!.player.hp = 0;
  run = finishCombat(run); saveRun(run);
  const store = await import('../ui/store'); store.continueGame();
  const before = loadHistory();
  expect(before).toHaveLength(1);
  expect(before[0]).toMatchObject({ outcome, floor: 65, elapsedMs: 123456 });
  expect(before[0].deck.some(c => c.upgraded)).toBe(true);
  store.finishRun();
  expect(store.getState()).toMatchObject({ run: null, hasSave: false, showTitle: true, overlay: null });
  expect(loadRun()).toBeNull();
  expect(loadHistory()).toEqual(before);
  expect(journeyStats(loadHistory()).abandoned).toBe(0);
  store.finishRun();
  expect(loadHistory()).toEqual(before);
  vi.resetModules();
  const restored = await import('../ui/store');
  expect(restored.getState().hasSave).toBe(false);
});

it('结束确认可以取消，保留通关存档和回退点', async () => {
  let run = finalBattle(); run.combat!.outcome = 'won'; run = finishCombat(run); saveRun(run);
  const store = await import('../ui/store'); store.continueGame();
  const before = loadRun();
  store.confirmFinishRun();
  expect(store.getState().overlay).toMatchObject({ kind: 'confirm', title: '结束旅程' });
  store.closeOverlay();
  expect(loadRun()).toEqual(before);
  expect(store.getState().run!.screen).toBe('victory');
  expect(store.getState().run!.checkpoint).not.toBeNull();
});

it('未打完的旅程不能走结束结算入口，仍使用原放弃流程', async () => {
  const run = newRun('STILL-PLAYING'); run.recordId = 'playing'; saveRun(run);
  const store = await import('../ui/store'); store.continueGame();
  store.confirmFinishRun(); store.finishRun();
  expect(store.getState().overlay).toBeNull();
  expect(loadRun()).toEqual(run);
  expect(loadHistory()).toEqual([]);
  store.abandonRun();
  expect(loadHistory()[0].outcome).toBe('abandoned');
  expect(loadRun()).toBeNull();
});
