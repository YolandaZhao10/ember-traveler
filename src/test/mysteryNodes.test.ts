import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../data/chapters';
import { ENCOUNTERS } from '../data/enemies';
import { EVENTS } from '../data/events';
import { ensureEncounterPlan, plannedEncounter } from '../engine/encounters';
import { generateMap, validateMap } from '../engine/map';
import { resolveMystery } from '../engine/mystery';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { ChapterId, MapNode, MysteryType, RunState } from '../engine/types';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const kinds: MysteryType[] = ['event', 'combat', 'shop'];
function route(seed: string, chapter: ChapterId = 1): RunState {
  const run = R.newRun(seed); run.chapter = chapter; run.gold = 600;
  // 独立问号测试路线；真实地图结构在下方多种子验证。
  const nodes = Array.from({ length: 18 }, (_, row): MapNode => ({
    id: `q${row}`, row, col: 3, type: 'event', next: row < 17 ? [`q${row + 1}`] : [],
  }));
  run.map = { rows: 20, cols: 7, nodes: Object.fromEntries(nodes.map(n => [n.id, n])), startIds: ['q0'], bossId: 'boss' };
  return run;
}
function matching(kind: MysteryType, chapter: ChapterId): RunState {
  for (let seed = 0; seed < 100; seed++) {
    const run = route(`MYSTERY-ENTRY-${seed}`, chapter);
    const probe = copy(run);
    if (resolveMystery(probe, probe.map.nodes.q0) === kind) return run;
  }
  throw new Error(`没有找到测试种子：${chapter}/${kind}`);
}
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}
afterEach(() => vi.unstubAllGlobals());

describe('问号随机去向', () => {
  it.each([1, 2, 3] as const)('第%s章三种随机结果使用本章内容、实际楼层与正常奖励，刷新和SL不重掷', chapter => {
    storage();
    for (const kind of kinds) {
      const base = matching(kind, chapter), original = copy(base);
      const start = R.travelTo(base, 'q0');
      expect(base).toEqual(original);
      expect(start.screen).toBe(kind === 'event' ? 'event' : kind === 'combat' ? 'combat' : 'shop');
      expect(start.floor).toBe(CHAPTERS[chapter].startFloor);
      expect(start.visited).toEqual(['q0']);
      expect(start.map.nodes.q0).toMatchObject({ type: 'event', mysteryType: kind });
      expect(R.travelTo(base, 'q0')).toEqual(start);
      expect(R.travelTo(start, 'q0')).toBe(start);
      let changed = start;
      if (kind === 'event') {
        const def = EVENTS[start.event!.eventId];
        expect(def.chapter ?? 1).toBe(chapter);
        expect(start.usedEvents).toEqual([def.id]);
        changed = R.eventLeave(R.eventChoose(start, def.choices.find(c => !c.outcomes.length)!.id));
      } else if (kind === 'shop') {
        expect(start.shop!.cards).toHaveLength(10); expect(start.shop!.relics).toHaveLength(6);
        expect(start.usedEvents).toEqual([]);
        changed = R.shopLeave(R.shopBuyCard(start, 0));
        expect(changed.gold).toBeLessThan(start.gold);
      } else {
        const enc = ENCOUNTERS.find(e => e.id === start.combat!.encounterId)!;
        expect(enc.chapter ?? 1).toBe(chapter); expect(enc.tier).toBe('normal');
        expect(plannedEncounter(start, start.map.nodes.q0)?.id).toBe(enc.id);
        expect(start.usedEvents).toEqual([]);
        const repaired = copy(start); ensureEncounterPlan(repaired);
        expect(repaired).toEqual(start);
        changed = R.combatEndTurn(start).run;
        const victory = copy(start); victory.combat!.outcome = 'won';
        const reward = R.finishCombat(victory);
        expect(reward.reward!.cards).toHaveLength(3); expect(reward.reward!.relic).toBeNull();
        expect(reward.reward!.gold).toBeGreaterThanOrEqual(15); expect(reward.reward!.gold).toBeLessThanOrEqual(20);
        expect(reward.stats.floorsCleared).toBe(1);
        const left = R.rewardLeave(reward);
        expect(left.screen).toBe('map'); expect(left.gold).toBe(reward.gold + reward.reward!.gold);
        expect(R.resetCurrentNode(left)).toEqual(reward);
      }
      saveRun(changed);
      expect(loadRun()).toEqual(changed);
      expect(R.resetCurrentNode(loadRun()!)).toEqual(start);
    }
  });

  it('战斗与商店至少隔两个问号才能再次出现，事件允许连发；无固定轮换且不推进其他随机流', () => {
    const counts = { event: 0, combat: 0, shop: 0 }, sequences = new Set<string>();
    let repeatedEvent = false;
    for (let seed = 0; seed < 400; seed++) {
      const run = route(`MYSTERY-COOLDOWN-${seed}`), rng = copy(run.rng), sequence: MysteryType[] = [];
      for (const node of Object.values(run.map.nodes)) {
        const result = resolveMystery(run, node);
        if (result !== 'event') expect(sequence.slice(-2)).not.toContain(result);
        else if (sequence[sequence.length - 1] === 'event') repeatedEvent = true;
        expect(resolveMystery(run, node)).toBe(result);
        sequence.push(result); counts[result]++; run.visited.push(node.id);
        // 序列化后依然记住冷却；本次记录也不会被重复写进访问历史。
        const loaded = copy(run);
        if (node.next[0]) expect(resolveMystery(loaded, loaded.map.nodes[node.next[0]]))
          .toBe(resolveMystery(copy(run), copy(run.map.nodes[node.next[0]])));
      }
      expect(run.rng).toEqual(rng); sequences.add(sequence.join(','));
    }
    expect(repeatedEvent).toBe(true); expect(sequences.size).toBeGreaterThan(300);
    // 样本只校验事件仍占多数，另外两类确实可出现；不要求人为轮换配额。
    expect(counts.event).toBeGreaterThan(7200 * 0.65);
    expect(counts.combat).toBeGreaterThan(7200 * 0.1);
    expect(counts.shop).toBeGreaterThan(7200 * 0.04);
  });

  it('刚离开明示商店时，下一个问号不会再次变成商店', () => {
    for (let seed = 0; seed < 100; seed++) {
      const run = route(`NO-BACK-TO-BACK-SHOP-${seed}`);
      run.map.nodes.q0.type = 'shop'; run.visited = ['q0'];
      expect(resolveMystery(run, run.map.nodes.q1)).not.toBe('shop');
    }
  });

  it('无效移动与地图预览不会揭示问号或消耗随机数', () => {
    const run = route('MYSTERY-NO-SPOILER'), before = copy(run);
    expect(R.travelTo(run, 'q9')).toBe(run);
    ensureEncounterPlan(run);
    for (const node of Object.values(run.map.nodes)) {
      expect(plannedEncounter(run, node)).toBeUndefined(); expect(node.mysteryType).toBeUndefined();
    }
    expect(run).toEqual(before);
  });

  it('旧版已访问问号与当前事件保留，未访问问号仍未知，迁移和回退均不改随机流', () => {
    const values = storage();
    const base = matching('event', 2);
    const old = R.travelTo(base, 'q0');
    for (const snapshot of [old, old.checkpoint!]) {
      snapshot.version = 16;
      for (const node of Object.values(snapshot.map.nodes)) delete node.mysteryType;
    }
    values.set('ember-traveler:save', JSON.stringify(old));
    const loaded = loadRun()!;
    expect(loaded.version).toBe(R.SAVE_VERSION);
    for (const key of ['event', 'rng', 'deck', 'usedEvents', 'gold', 'hp'] as const) expect(loaded[key]).toEqual(old[key]);
    expect(loaded.map.nodes.q0.mysteryType).toBe('event');
    expect(loaded.map.nodes.q1.mysteryType).toBeUndefined();
    expect(R.resetCurrentNode(loaded)).toEqual(loaded);
    saveRun(loaded); expect(loadRun()).toEqual(loaded);
  });

  it('提高问号比例后仍满足前三章地图限制，终章固定五站不受影响', () => {
    let questions = 0, total = 0;
    for (const chapter of [1, 2, 3, 4] as const) for (let seed = 0; seed < 100; seed++) {
      const map = generateMap(makeRng(`MORE-MYSTERY-${seed}`, 'map'), chapter), nodes = Object.values(map.nodes);
      expect(validateMap(map)).toBe(true);
      if (chapter === 4) {
        expect(nodes.map(n => n.type)).toEqual(['rest', 'elite', 'shop', 'rest', 'boss']);
        continue;
      }
      for (let row = 0; row < 19; row++) expect(nodes.filter(n => n.row === row).length).toBeGreaterThanOrEqual(3);
      expect(nodes.filter(n => n.row < 4).some(n => n.type === 'elite')).toBe(false);
      expect(nodes.filter(n => n.row === 18).every(n => n.type === 'rest')).toBe(true);
      expect(nodes.filter(n => n.type === 'shop').length).toBeLessThanOrEqual(4);
      expect(nodes.every(n => n.mysteryType === undefined)).toBe(true);
      questions += nodes.filter(n => n.type === 'event').length; total += nodes.length;
    }
    expect(questions / total).toBeGreaterThan(0.2);
    expect(questions / total).toBeLessThan(0.35);
  });
});
