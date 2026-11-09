import { afterEach, describe, expect, it, vi } from 'vitest';
import { JourneyClock, formatJourneyTime, journeyClockRunning } from '../ui/journeyClock';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import { generateMap } from '../engine/map';
import { loadHistory } from '../engine/history';

afterEach(() => vi.unstubAllGlobals());
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string,v: string) => values.set(k,v), removeItem: (k: string) => values.delete(k) });
  return values;
}

describe('对局计时与旧终章结算', () => {
  it('仅累计前台游玩，切后台、首页与结算暂停，重新打开不补离线时间', () => {
    const clock = new JourneyClock(1000); const run = R.newRun('CLOCK');
    expect(clock.sample(5000, true)).toBe(0);
    expect(clock.sample(6500, false)).toBe(1500);
    expect(clock.sample(100000, true)).toBe(0);
    expect(clock.sample(101000, true)).toBe(1000);
    expect(new JourneyClock(101000).sample(999999, true)).toBe(0);
    expect(journeyClockRunning(run, false, false)).toBe(true);
    expect(journeyClockRunning(run, true, false)).toBe(false);
    expect(journeyClockRunning(run, false, true)).toBe(false);
    for (const screen of ['victory','gameover','title'] as const) expect(journeyClockRunning({...run,screen},false,false)).toBe(false);
    expect(formatJourneyTime(59999)).toBe('00:59'); expect(formatJourneyTime(3661000)).toBe('1:01:01');
  });
  it('刷新、SL与跨章保留累计时间，新局清零，结束记录保存用时', () => {
    storage(); let run = R.newRun('CLOCK-SAVE'); run.recordId = 'clock-id';
    run = R.travelTo(run, run.map.startIds[0]); run.elapsedMs = 65000;
    saveRun(run); run = loadRun()!; expect(run.elapsedMs).toBe(65000);
    const reset = R.resetCurrentNode(run); expect(reset.elapsedMs).toBe(65000);
    expect(reset.combat).toEqual(run.checkpoint!.combat);
    run.screen = 'chapter'; expect(R.enterNextChapter(run).elapsedMs).toBe(65000);
    run.screen = 'gameover'; saveRun(run); expect(loadHistory()[0].elapsedMs).toBe(65000);
    expect(R.newRun(run.seed).elapsedMs).toBe(0);
  });
  it('v12进行中存档只补计时，不改既有地图、战斗、商店或随机流', () => {
    const values = storage(); const run = R.travelTo(R.newRun('OLD-TIMER'), R.newRun('OLD-TIMER').map.startIds[0]);
    const old = JSON.parse(JSON.stringify(run)); old.version = 12; delete old.elapsedMs;
    old.checkpoint.version = 12; delete old.checkpoint.elapsedMs;
    values.set('ember-traveler:save', JSON.stringify(old)); const loaded = loadRun()!;
    expect(loaded.elapsedMs).toBe(0); expect(loaded.checkpoint!.elapsedMs).toBe(0);
    for(const key of ['map','combat','shop','rng','deck','gold'] as const) expect(loaded[key]).toEqual(run[key]);
    saveRun(loaded); expect(loadRun()).toEqual(loaded);
  });
  it('v12终章起点及回退点保持第61层，不因五站地图错算楼层', () => {
    const values=storage();const run=R.newRun('FINAL-START');run.chapter=4;run.floor=60;run.map=generateMap(run.rng.map,4);run.version=12;
    const {checkpoint,...snapshot}=run;run.checkpoint=structuredClone(snapshot);
    values.set('ember-traveler:save',JSON.stringify(run));const loaded=loadRun()!;
    expect(loaded.floor).toBe(60);expect(loaded.checkpoint!.floor).toBe(60);
    // 地形与连接保持原样；v16 会为尚未进入的精英、首领补齐固定敌组。
    expect(loaded.map).toMatchObject(run.map);
    expect(loaded.checkpoint!.map).toEqual(loaded.map);
    expect(loaded.map.nodes['final-1'].encounterId).toBe('final_elite_warden');
    expect(loaded.map.nodes[loaded.map.bossId].encounterId).toBe('final_boss_lord');
  });
  it.each([false,true])('旧终章奖励迁移直接结算，金币已领取=%s时均不重复发奖', goldTaken => {
    const values = storage(); let run = R.newRun('OLD-FINAL'); run.chapter = 4; run.floor = 64;
    run.screen = 'reward'; run.version = 12;
    run.reward = {gold:75,goldTaken,cards:[],cardTaken:false,relic:null,relicTaken:false,relicChoices:['final_dawn_crown'],chapterComplete:4};
    const expected = run.gold + (goldTaken ? 0 : 75);
    values.set('ember-traveler:save',JSON.stringify(run)); run = loadRun()!;
    expect(run.screen).toBe('victory'); expect(run.reward).toBeNull(); expect(run.gold).toBe(expected);
    expect(run.checkpoint!.screen).toBe('victory'); expect(R.resetCurrentNode(run)).toEqual(run);
    saveRun(run); expect(loadRun()).toEqual(run); expect(R.finishCombat(run)).toBe(run);
  });
});
