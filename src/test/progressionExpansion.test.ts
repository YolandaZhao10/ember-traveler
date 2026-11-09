import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAPTER_RELICS } from '../data/chapterRelics';
import { RELICS, relicPool } from '../data/relics';
import { generateMap, validateMap } from '../engine/map';
import { makeRng } from '../engine/rng';
import { loadRun, saveRun } from '../engine/save';
import * as R from '../engine/run';
import type { ChapterId } from '../engine/types';

const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  return values;
}
function victory(chapter: ChapterId) {
  let run = R.newRun(`CHAPTER-PRIZE-${chapter}`); run.chapter = chapter;
  run.currentNodeId = Object.values(run.map.nodes).find(n => n.row === 18)!.id;
  run = R.travelTo(run, run.map.bossId); run.combat!.outcome = 'won';
  return R.finishCombat(run);
}
afterEach(() => vi.unstubAllGlobals());

describe('地图、章节战利品和掉落成长', () => {
  it('100种子每章前四层无精英，前19层至少3节点，首领唯一且没有断路或交叉', () => {
    const observedMinimums = new Set<number>();
    const layouts = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const map = generateMap(makeRng(`WIDE-${seed}`, 'map'));
      expect(validateMap(map)).toBe(true);
      const nodes = Object.values(map.nodes);
      for (let row = 0; row < 19; row++) expect(nodes.filter(n => n.row === row).length).toBeGreaterThanOrEqual(3);
      expect(nodes.filter(n => n.row === 19)).toHaveLength(1);
      expect(nodes.filter(n => n.row < 4).every(n => n.type !== 'elite')).toBe(true);
      expect(nodes.filter(n => n.type === 'elite').length).toBeGreaterThanOrEqual(2);
      // 动态规划求全部起点至各节点的最少营火数，覆盖合流后改道的所有路线。
      const minimumRests: Record<string, number> = Object.fromEntries(map.startIds.map(id => [id, 0]));
      const maximumRests: Record<string, number> = { ...minimumRests };
      for (const n of [...nodes].sort((a,b) => a.row - b.row)) {
        const count = minimumRests[n.id] + (n.type === 'rest' ? 1 : 0);
        const maxCount = maximumRests[n.id] + (n.type === 'rest' ? 1 : 0);
        for (const id of n.next) minimumRests[id] = Math.min(minimumRests[id] ?? Infinity, count);
        for (const id of n.next) maximumRests[id] = Math.max(maximumRests[id] ?? 0, maxCount);
      }
      observedMinimums.add(minimumRests[map.bossId]);
      layouts.add(nodes.filter(n => n.type === 'rest' && n.row < 18).map(n => n.id).join(','));
      expect(minimumRests[map.bossId]).toBeGreaterThanOrEqual(2);
      expect(maximumRests[map.bossId]).toBeLessThanOrEqual(5);
      expect(nodes.filter(n => n.row === 18).every(n => n.type === 'rest')).toBe(true);
      const reachable = new Set(map.startIds);
      for (const n of [...nodes].sort((a,b) => a.row - b.row)) {
        expect(reachable.has(n.id)).toBe(true);
        n.next.forEach(id => { expect(map.nodes[id].row).toBe(n.row + 1); reachable.add(id); });
        if (n.row >= 18) continue;
        for (const id of n.next) for (const other of nodes.filter(x => x.row === n.row && x.col > n.col)) {
          for (const next of other.next) expect(map.nodes[id].col).toBeLessThanOrEqual(map.nodes[next].col);
        }
      }
    }
    expect(observedMinimums.has(2)).toBe(true);
    expect(layouts.size).toBeGreaterThan(90);
  });
  it('卡牌第一层标准70/29/1，精英遗物概率逐层变稀有且跨章不重置', () => {
    expect(R.cardRarityWeights(0, 'normal')).toEqual({ common: 70, uncommon: 29, rare: 1 });
    expect(R.relicRarityWeights(0)).toEqual({ common: 60, uncommon: 35, rare: 5 });
    expect(R.relicRarityWeights(64)).toEqual({ common: 20, uncommon: 40, rare: 40 });
    for (const level of ['low', 'normal', 'high'] as const) for (let floor = 0; floor < 65; floor++) {
      const w = R.relicRarityWeights(floor, level);
      expect(w.common + w.uncommon + w.rare).toBeCloseTo(100);
      if (floor) expect(w.rare).toBeGreaterThan(R.relicRarityWeights(floor - 1, level).rare);
    }
  });
  it('精英实际掉落恰好1件，高层稀有更多且绝不掉落章节/异角色遗物', () => {
    const sample = (floor: number) => {
      let rare = 0;
      for (let seed = 0; seed < 600; seed++) {
        let run = R.newRun(`ELITE-LOOT-${seed}`, 'picker');
        run.map.nodes[run.map.startIds[0]].type = 'elite'; run = R.travelTo(run, run.map.startIds[0]);
        run.floor = floor; run.combat!.outcome = 'won'; const reward = R.finishCombat(run);
        const relic = RELICS[reward.reward!.relic!];
        expect(relic).toBeDefined(); expect(relic.chapter).toBeUndefined(); expect(!relic.owner || relic.owner === 'picker').toBe(true);
        const claimed = R.rewardTakeRelic(reward); expect(claimed.relics.length).toBe(reward.relics.length + 1); expect(R.rewardTakeRelic(claimed)).toBe(claimed);
        if (relic.rarity === 'rare') rare++;
      }
      return rare;
    };
    expect(sample(64)).toBeGreaterThan(sample(4) + 100);
  });
  it.each([1, 2, 3] as const)('第%s章有9件独立遗物，3选1不能跳过或重复选，SL和刷新保留候选', chapter => {
    storage();
    const pool = CHAPTER_RELICS.filter(r => r.chapter === chapter);
    expect(pool).toHaveLength(9);
    for (const owner of ['traveler', 'picker', 'oathbound', 'scholar'] as const) expect(relicPool([], owner).every(r => !r.chapter)).toBe(true);
    const reward = victory(chapter); const ids = reward.reward!.relicChoices!;
    expect(ids).toHaveLength(3); expect(new Set(ids).size).toBe(3);
    expect(ids.every(id => pool.some(r => r.id === id))).toBe(true);
    expect(R.rewardLeave(reward)).toBe(reward); expect(R.rewardTakeRelic(reward)).toBe(reward);
    expect(R.rewardTakeRelic(reward, 'flint')).toBe(reward);
    saveRun(reward); expect(loadRun()).toEqual(reward);
    const picked = R.rewardTakeRelic(reward, ids[0]); expect(picked.relics).toContain(ids[0]);
    expect(R.rewardTakeRelic(picked, ids[1])).toBe(picked);
    const left = R.rewardLeave(picked); expect(left.screen).toBe('chapter');
    saveRun(left); const reloaded = loadRun()!; expect(reloaded).toEqual(left);
    const reset = R.resetCurrentNode(reloaded); expect(reset).toEqual(reward);
    const alternative = R.rewardTakeRelic(reset, ids[1]); expect(alternative.relics).not.toContain(ids[0]); expect(alternative.relics).toContain(ids[1]);
    expect(alternative.combat).toBeNull();
  });
  it('v8单线旧地图平滑补齐路线，不重掷牌组/随机流，存档及SL保持新地图', () => {
    const values = storage(); const run = R.newRun('OLD-SINGLE-ROUTE'); run.version = 8;
    run.map.nodes = Object.fromEntries(Array.from({ length: 20 }, (_, row) => { const id = row === 19 ? 'boss' : `old-${row}`; return [id, { id, row, col: 3, type: row === 19 ? 'boss' : row === 18 ? 'rest' : row === 3 ? 'elite' : 'combat', next: row === 19 ? [] : [row === 18 ? 'boss' : `old-${row + 1}`] }]; }));
    run.map.startIds = ['old-0']; run.currentNodeId = 'old-0'; run.visited = ['old-0'];
    const { checkpoint: _checkpoint, ...snapshot } = copy(run); run.checkpoint = snapshot;
    const rng = copy(run.rng); const deck = copy(run.deck);
    values.set('ember-traveler:save', JSON.stringify(run));
    const loaded = loadRun()!; expect(loaded.version).toBe(13); expect(loaded.rng).toEqual(rng); expect(loaded.deck).toEqual(deck);
    expect(loaded.map.nodes['old-3'].type).toBe('combat'); expect(validateMap(loaded.map)).toBe(true);
    for (let row = 0; row < 19; row++) expect(Object.values(loaded.map.nodes).filter(n => n.row === row).length).toBeGreaterThanOrEqual(3);
    expect(R.resetCurrentNode(loaded).map).toEqual(loaded.map);
    saveRun(loaded); expect(loadRun()).toEqual(loaded);
  });
});
