import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../data/enemies';
import { ensureEncounterPlan, plannedEncounter } from '../engine/encounters';
import { generateMap } from '../engine/map';
import { makeRng } from '../engine/rng';
import { previewRoute } from '../engine/routePreview';
import { newRun, resetCurrentNode, travelTo } from '../engine/run';
import type { ChapterId, GameMap, MapNode } from '../engine/types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('地图固定遭遇与路线决策', () => {
  it('四章多种子均预告合法敌组，同层有足够候选时不重复，不改变拓扑或随机流', () => {
    for (const chapter of [1, 2, 3, 4] as ChapterId[]) for (let seed = 0; seed < 12; seed++) {
      const run = newRun(`route-plan-${seed}`);
      run.chapter = chapter;
      run.map = generateMap(makeRng(run.seed, 'map'), chapter);
      const original = clone(run.map);
      const rng = clone(run.rng);
      ensureEncounterPlan(run);
      expect(run.rng).toEqual(rng);
      for (const node of Object.values(run.map.nodes)) {
        const encounter = plannedEncounter(run, node);
        if (['combat', 'elite', 'boss'].includes(node.type)) {
          expect(encounter, `${chapter}:${node.id}`).toBeDefined();
          expect(encounter!.chapter ?? 1).toBe(chapter);
          expect(encounter!.tier).toBe(node.type === 'combat' ? 'normal' : node.type);
          expect(node.row).toBeGreaterThanOrEqual(encounter!.minFloor ?? 0);
          expect(node.row).toBeLessThanOrEqual(encounter!.maxFloor ?? 99);
        } else expect(encounter).toBeUndefined();
        const { encounterId: _id, ...topology } = node;
        expect(topology).toEqual(original.nodes[node.id]);
      }
      for (let row = 0; row < run.map.rows; row++) {
        const fights = Object.values(run.map.nodes).filter((node) => node.row === row && node.type === 'combat');
        const pool = ENCOUNTERS.filter((encounter) => (encounter.chapter ?? 1) === chapter && encounter.tier === 'normal' && row >= (encounter.minFloor ?? 0) && row <= (encounter.maxFloor ?? 99));
        expect(new Set(fights.map((node) => node.encounterId)).size).toBe(Math.min(fights.length, pool.length));
      }
      const copy = clone(run);
      ensureEncounterPlan(copy);
      expect(copy).toEqual(run);
    }
  });

  it('同种子重建得到相同敌组，已有合法预告不被改写', () => {
    const run = newRun('stable-plans');
    ensureEncounterPlan(run);
    const other = clone(run);
    Object.values(other.map.nodes).forEach((node) => delete node.encounterId);
    ensureEncounterPlan(other);
    expect(other.map).toEqual(run.map);
    const node = run.map.nodes[run.map.startIds[0]];
    const replacement = ENCOUNTERS.find((encounter) => encounter.tier === 'normal' && (encounter.chapter ?? 1) === 1 && (encounter.minFloor ?? 0) === 0 && encounter.id !== node.encounterId)!;
    node.encounterId = replacement.id;
    ensureEncounterPlan(run);
    expect(node.encounterId).toBe(replacement.id);
  });

  it('读取拒绝章、层数或类型不匹配的预告，不让无效数据进入战斗', () => {
    const run = newRun('invalid-plans');
    const node = run.map.nodes[run.map.startIds[0]];
    node.encounterId = 'deacon_cultist';
    expect(plannedEncounter(run, node)).toBeUndefined();
    node.encounterId = 'boss_sovereign';
    expect(plannedEncounter(run, node)).toBeUndefined();
    node.encounterId = ENCOUNTERS.find((encounter) => encounter.chapter === 2)!.id;
    expect(plannedEncounter(run, node)).toBeUndefined();
    node.encounterId = 'missing-encounter';
    expect(plannedEncounter(run, node)).toBeUndefined();
    ensureEncounterPlan(run);
    expect(plannedEncounter(run, node)).toBeDefined();
  });

  it('旧存档只补未来节点，当前战斗保留实际敌组；与无战斗快照的未来计划一致', () => {
    const initial = newRun('legacy-plan');
    const run = travelTo(initial, initial.map.startIds[0]);
    for (const node of Object.values(run.map.nodes)) delete node.encounterId;
    const reward = clone(run);
    reward.combat = null;
    const conflicting = ENCOUNTERS.find((encounter) => encounter.tier === 'normal' && (encounter.chapter ?? 1) === 1 && (encounter.minFloor ?? 0) === 0 && encounter.id !== run.combat!.encounterId)!;
    run.map.nodes[run.currentNodeId!].encounterId = conflicting.id;
    const originalCombat = clone(run.combat);
    const originalRng = clone(run.rng);
    ensureEncounterPlan(run);
    ensureEncounterPlan(reward);
    expect(run.combat).toEqual(originalCombat);
    expect(run.rng).toEqual(originalRng);
    expect(run.map.nodes[run.currentNodeId!].encounterId).toBe(run.combat!.encounterId);
    expect(reward.map.nodes[run.currentNodeId!].encounterId).toBeUndefined();
    for (const node of Object.values(run.map.nodes).filter((node) => !run.visited.includes(node.id))) {
      expect(node.encounterId).toBe(reward.map.nodes[node.id].encounterId);
    }
  });

  it('反复查看地图不改变进度；进入与 SL 的敌组都与预告一致', () => {
    const run = newRun('preview-matches-entry');
    ensureEncounterPlan(run);
    const original = clone(run);
    const node = run.map.nodes[run.map.startIds[0]];
    const expected = plannedEncounter(run, node)!;
    for (let i = 0; i < 10; i++) {
      Object.values(run.map.nodes).forEach((candidate) => { plannedEncounter(run, candidate); previewRoute(run.map, candidate.id); });
    }
    expect(run).toEqual(original);
    const entered = travelTo(run, node.id);
    expect(entered.combat!.encounterId).toBe(expected.id);
    expect(entered.combat!.enemies.map((enemy) => enemy.defId)).toEqual(expected.enemies);
    expect(resetCurrentNode(entered).combat).toEqual(entered.combat);
  });
});

describe('后路统计', () => {
  const node = (id: string, row: number, type: MapNode['type'], next: string[]): MapNode => ({ id, row, col: 0, type, next });
  const nodes = [node('start', 0, 'combat', ['camp', 'elite']), node('camp', 1, 'rest', ['shop']), node('elite', 1, 'elite', ['elite2', 'shop']), node('shop', 2, 'shop', ['lastcamp']), node('elite2', 2, 'elite', ['lastcamp']), node('lastcamp', 3, 'rest', ['boss']), node('boss', 4, 'boss', []), node('deadend', 1, 'shop', [])];
  const map: GameMap = { rows: 5, cols: 3, nodes: Object.fromEntries(nodes.map((n) => [n.id, n])), startIds: ['start'], bossId: 'boss' };

  it('分叉中计算最近补给和完整路线精英范围，合流不会重复计数', () => {
    const preview = previewRoute(map, 'start');
    expect(preview.nearestRest).toBe(1);
    expect(preview.nearestShop).toBe(2);
    expect(preview.elites).toEqual({ min: 0, max: 2 });
    expect(preview.reachable).toEqual(new Set(nodes.filter((n) => n.id !== 'deadend').map((n) => n.id)));
  });

  it('所选精英计入风险；本站营火距离为零；不会显示邻近但无法抵达的商店', () => {
    expect(previewRoute(map, 'elite').elites).toEqual({ min: 1, max: 2 });
    expect(previewRoute(map, 'camp').nearestRest).toBe(0);
    expect(previewRoute(map, 'elite2').nearestShop).toBeNull();
    expect(previewRoute(map, 'boss').elites).toEqual({ min: 0, max: 0 });
    expect(previewRoute(map, 'deadend').reachable.size).toBe(0);
    expect(previewRoute(map, 'missing').reachable.size).toBe(0);
  });
});
