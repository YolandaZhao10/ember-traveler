import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureRecordId, journeyStats, loadHistory, recordJourney } from '../engine/history';
import { clearSave, loadRun, saveRun } from '../engine/save';
import * as R from '../engine/run';

function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  return values;
}
afterEach(() => vi.unstubAllGlobals());

describe('旅程记录与胜率', () => {
  it('进行中和第一章胜利不结算，最终通关保存升级牌、重复数量、遗物和难度', () => {
    storage(); let run = R.newRun('HISTORY', 'scholar', { enemyHealth: 67, enemyIntent: 88, bossHealth: 200, bossIntent: 150, gold: 123, relicRarity: 50, cardRarity: 175 });
    ensureRecordId(run); saveRun(run); expect(loadHistory()).toHaveLength(0);
    run.screen = 'chapter'; saveRun(run); expect(loadHistory()).toHaveLength(0);
    run = R.enterNextChapter(run); run.screen = 'victory'; run.floor = 39;
    run.deck[0].upgraded = true; run.relics.push('furnace_crown');
    saveRun(run); const record = loadHistory()[0];
    expect(record.outcome).toBe('won'); expect(record.character).toBe('scholar'); expect(record.difficulty.gold).toBe(123);
    expect(record.deck.reduce((n,c) => n + c.count, 0)).toBe(run.deck.length);
    expect(record.deck.find(c => c.defId === run.deck[0].defId && c.upgraded)?.count).toBe(1);
    expect(record.deck.some(c => c.count > 1)).toBe(true); expect(record.relics).toContain('furnace_crown');
    run.deck[0].upgraded = false; run.relics.pop(); expect(loadHistory()[0]).toEqual(record);
    clearSave(); expect(loadHistory()).toHaveLength(1);
  });
  it('同种子不同旅程分别计数，刷新不重复，死亡后SL通关更新同一条记录', () => {
    storage(); let run = R.newRun('SAME'); ensureRecordId(run); run = R.travelTo(run, run.map.startIds[0]);
    const start = run; run = { ...run, screen: 'gameover', hp: 0 }; saveRun(run); saveRun(loadRun());
    expect(loadHistory()).toHaveLength(1); expect(journeyStats(loadHistory()).losses).toBe(1);
    run = R.resetCurrentNode(loadRun()!); expect(run.recordId).toBe(start.recordId);
    saveRun(run); expect(loadHistory()).toHaveLength(1);
    run.screen = 'victory'; run.floor = 39; saveRun(run); saveRun(loadRun());
    expect(loadHistory()).toHaveLength(1); expect(journeyStats(loadHistory())).toEqual({ wins: 1, losses: 0, abandoned: 0, winRate: 1 });
    const other = R.newRun('SAME'); ensureRecordId(other); other.screen = 'gameover'; recordJourney(other);
    expect(loadHistory()).toHaveLength(2); expect(journeyStats(loadHistory()).winRate).toBe(0.5);
  });
  it('放弃单列且不纳入胜率，已有结算记录不会被放弃覆盖，各角色独立统计', () => {
    storage(); const run = R.newRun('ABANDON', 'picker'); ensureRecordId(run); recordJourney(run, true);
    expect(journeyStats(loadHistory())).toEqual({ wins: 0, losses: 0, abandoned: 1, winRate: null });
    const won = R.newRun('WIN', 'traveler'); ensureRecordId(won); won.screen = 'victory'; recordJourney(won);
    won.screen = 'reward'; recordJourney(won, true);
    expect(journeyStats(loadHistory().filter(r => r.character === 'traveler')).wins).toBe(1);
    expect(journeyStats(loadHistory().filter(r => r.character === 'picker')).winRate).toBeNull();
  });
  it('旧已结算存档使用稳定标识去重，记录损坏或禁用存储时不阻止游玩', () => {
    const values = storage(); const legacy = R.newRun('LEGACY-HISTORY'); legacy.screen = 'victory';
    const before = JSON.stringify(legacy); recordJourney(legacy); recordJourney(JSON.parse(before));
    expect(loadHistory()).toHaveLength(1); expect(JSON.stringify(legacy)).toBe(before);
    values.set('ember-traveler:history', '{broken'); expect(loadHistory()).toEqual([]);
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } });
    expect(() => recordJourney(legacy)).not.toThrow(); expect(loadHistory()).toEqual([]);
  });
});
