import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { availableNodes, validateMap } from '../engine/map';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { ChapterId, RunState } from '../engine/types';
import { CHAPTER_IDS, CHAPTERS, TOTAL_FLOORS } from '../data/chapters';
import { STANDARD_DIFFICULTY } from '../data/difficulty';

const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
function storage(run: RunState) {
  const data = new Map([['ember-traveler:save', JSON.stringify(run)]]);
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string,v: string) => data.set(k,v), removeItem: (k: string) => data.delete(k) });
}
function legacy(chapter: ChapterId, boss = false) {
  let run = R.newRun('LEGACY-20'); run.chapter = chapter;
  run.map.rows = 12; run.map.nodes.boss.row = 11;
  for (const [id, n] of Object.entries(run.map.nodes)) {
    if (id !== 'boss' && n.row > 10) delete run.map.nodes[id];
    else if (n.row === 10) { n.type = 'rest'; n.next = ['boss']; }
  }
  if (boss) run.currentNodeId = Object.values(run.map.nodes).find(n => n.row === 10)!.id;
  run = R.travelTo(run, boss ? 'boss' : run.map.startIds[0]);
  run.floor = (chapter - 1) * 12 + (boss ? 11 : 0); run.version = 6;
  delete run.combat!.difficulty;
  const { checkpoint: _, ...snapshot } = run;
  run.checkpoint = copy(snapshot);
  return run;
}
afterEach(() => vi.unstubAllGlobals());

describe('逐层难度与20层迁移', () => {
  it('1–65层威胁系数逐层增加，同层精英和首领强于普通遭遇', () => {
    for (let floor = 0; floor < TOTAL_FLOORS; floor++) {
      const n = encounterDifficulty(floor, 'normal'); const e = encounterDifficulty(floor, 'elite'); const b = encounterDifficulty(floor, 'boss');
      for (const key of ['healthMultiplier', 'attackMultiplier', 'blockMultiplier'] as const) {
        expect(e[key]).toBeGreaterThan(n[key]); expect(b[key]).toBeGreaterThan(n[key]);
        if (floor > 0) expect(n[key]).toBeGreaterThan(encounterDifficulty(floor - 1, 'normal')[key]);
      }
    }
  });
  it('每章入口比上一章末层进一步强化，跨章增幅大于章内单层增幅，自定义倍率仍一致', () => {
    for (const chapter of CHAPTER_IDS.slice(1)) for (const tier of ['normal', 'elite', 'boss'] as const) for (const percent of [50, 100, 200]) {
      const floor = CHAPTERS[chapter].startFloor;
      const settings = { ...STANDARD_DIFFICULTY, enemyHealth: percent, enemyIntent: percent, bossHealth: percent, bossIntent: percent };
      const before = encounterDifficulty(floor - 1, tier, settings);
      const entry = encounterDifficulty(floor, tier, settings);
      const next = encounterDifficulty(floor + 1, tier, settings);
      for (const key of ['healthMultiplier', 'attackMultiplier', 'blockMultiplier'] as const) {
        expect(entry[key] - before[key]).toBeGreaterThan(next[key] - entry[key]);
        expect(next[key]).toBeGreaterThan(entry[key]);
      }
    }
    const entries = CHAPTER_IDS.map(c => encounterDifficulty(CHAPTERS[c].startFloor, 'normal'));
    expect(entries.map(x => x.healthMultiplier)).toEqual([1, 1.5, 2, 2.5]);
    expect(entries.map(x => x.attackMultiplier)).toEqual([1, 1.3, 1.6, 1.9]);
  });
  it('生命、意图、实际多段伤害与敌人格挡都使用同一强化，虚弱易伤仍生效', () => {
    const d = encounterDifficulty(39, 'elite');
    let cs = createCombat('scale', ['furnace_drone'], 'elite', [], 1000, 1000, [], makeRng('SCALE', 'c'), 0, 'traveler', d).state;
    const base = createCombat('scale', ['furnace_drone'], 'elite', [], 1000, 1000, [], makeRng('SCALE', 'c'), 0).state;
    expect(cs.enemies[0].maxHp).toBe(Math.round(base.enemies[0].maxHp * d.healthMultiplier));
    cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
    expect(cs.enemies[0].block).toBe(23);
    cs.phase = 'player'; cs.enemies[0].moveId = 'pound'; cs.enemies[0].statuses.weak = 1; delete cs.enemies[0].flags.acted;
    cs.player.statuses.vulnerable = 2;
    const intent = enemyIntent(cs, cs.enemies[0])!;
    expect(intent.kind).toBe('attack');
    if (intent.kind !== 'attack') throw Error('Expected attack');
    const before = cs.player.hp; cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
    expect(before - cs.player.hp).toBe(intent.amount * intent.times);
  });
  it('现有战斗保存的强度和生命不因新曲线、刷新或SL被重新计算', () => {
    let run = R.newRun('SAVED-STRENGTH');
    run = R.travelTo(run, run.map.startIds[0]);
    run.combat!.difficulty = { floor: 41, healthMultiplier: 1.8, attackMultiplier: 1.48, blockMultiplier: 1.6 };
    run.combat!.enemies[0].hp = 7;
    const { checkpoint: _, ...snapshot } = run;
    run.checkpoint = copy(snapshot);
    storage(run); const loaded = loadRun()!;
    expect(loaded.combat).toEqual(run.combat);
    expect(R.resetCurrentNode(loaded).combat).toEqual(run.combat);
    saveRun(loaded); expect(loadRun()!.combat).toEqual(run.combat);
    expect(encounterDifficulty(40, 'normal').healthMultiplier).toBe(2);
  });
  it.each<ChapterId>([1, 2])('第%s章旧战斗与SL完整保留，旧路线增加8层且始终连接首领', chapter => {
    const old = legacy(chapter); storage(old);
    const loaded = loadRun()!;
    expect(loaded.version).toBe(12); expect(loaded.map.rows).toBe(20); expect(validateMap(loaded.map)).toBe(true);
    expect(loaded.combat).toEqual(old.combat); expect(loaded.rng).toEqual(old.rng); expect(loaded.deck).toEqual(old.deck);
    expect(loaded.floor).toBe(chapter === 1 ? 0 : 20);
    expect(R.resetCurrentNode(loaded).combat).toEqual(old.combat);
    expect(R.resetCurrentNode(loaded).map).toEqual(loaded.map);
    let id = loaded.map.startIds[0]; let length = 1;
    while (id !== loaded.map.bossId) { const next = availableNodes(loaded.map, id)[0]; expect(loaded.map.nodes[next].row).toBe(loaded.map.nodes[id].row + 1); id = next; length++; }
    expect(length).toBe(20);
    saveRun(loaded); expect(loadRun()).toEqual(loaded);
  });
  it.each<ChapterId>([1, 2])('旧第%s章首领战升级只调整楼层编号，不重置生命、阶段或重复变强', chapter => {
    const old = legacy(chapter, true); old.combat!.enemies[0].hp = 17; old.combat!.enemies[0].phase = 2; storage(old);
    const loaded = loadRun()!;
    expect(loaded.floor).toBe(chapter === 1 ? 19 : 39); expect(loaded.combat).toEqual(old.combat);
    saveRun(loaded); expect(loadRun()).toEqual(loaded);
  });
});
