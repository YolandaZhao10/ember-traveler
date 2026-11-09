import { ENCOUNTERS } from '../data/enemies';
import { makeRng, pick } from './rng';
import type { EncounterDef, MapNode, RunState } from './types';

type EncounterPlanRun = Pick<RunState, 'seed' | 'chapter' | 'map' | 'visited' | 'currentNodeId' | 'combat'>;

function encounterTier(node: MapNode): EncounterDef['tier'] | undefined {
  if (node.type === 'combat' || (node.type === 'event' && node.mysteryType === 'combat')) return 'normal';
  if (node.type === 'elite' || node.type === 'boss') return node.type;
  return undefined;
}

function eligible(run: Pick<RunState, 'chapter'>, node: MapNode, encounter: EncounterDef): boolean {
  return (encounter.chapter ?? 1) === run.chapter
    && encounter.tier === encounterTier(node)
    && (encounter.minFloor === undefined || node.row >= encounter.minFloor)
    && (encounter.maxFloor === undefined || node.row <= encounter.maxFloor);
}

/** 地图预览与实际入场共用此读取入口；读取不会推进任何随机流。 */
export function plannedEncounter(run: Pick<RunState, 'chapter'>, node: MapNode): EncounterDef | undefined {
  return ENCOUNTERS.find((encounter) => encounter.id === node.encounterId && eligible(run, node, encounter));
}

/**
 * 只补齐地图遭遇，不消耗局内随机流，也不生成战斗。
 * 旧存档已访问节点保持历史；当前已开始的战斗以实际遭遇为准。
 */
export function ensureEncounterPlan(run: EncounterPlanRun): void {
  const nodes = Object.values(run.map.nodes).sort((a, b) => a.row - b.row || a.col - b.col || a.id.localeCompare(b.id));
  const visited = new Set(run.visited);
  const parentIds = new Map<string, string[]>();
  for (const node of nodes) {
    for (const child of node.next) parentIds.set(child, [...(parentIds.get(child) ?? []), node.id]);
  }
  const planned = new Map<string, string>();
  for (let row = 0; row < run.map.rows; row++) {
    const rowNodes = nodes.filter((node) => node.row === row && encounterTier(node));
    const used = new Set<string>();
    // 先计算整图标准规划，不让 visited / 当前战斗 / 部分旧 ID 改变未来节点。
    // 因此旧主存档与战斗开局 checkpoint 即使进度不同，补齐的后路仍一致。
    for (const node of rowNodes) {
      const pool = ENCOUNTERS.filter((encounter) => eligible(run, node, encounter));
      if (!pool.length) continue;
      const parents = new Set((parentIds.get(node.id) ?? []).map((id) => planned.get(id)));
      const distinct = pool.filter((encounter) => !used.has(encounter.id));
      const varied = distinct.filter((encounter) => !parents.has(encounter.id));
      const choices = varied.length ? varied : distinct.length ? distinct : pool;
      const encounter = pick(makeRng(run.seed, `encounter-plan:${run.chapter}:${node.id}`), choices);
      planned.set(node.id, encounter.id);
      used.add(encounter.id);
    }
  }
  for (const node of nodes) {
    // 已开始的战斗保留实际身份，即使旧预告与它冲突；不影响刚算好的后路。
    if (node.id === run.currentNodeId && run.combat) {
      const actual = ENCOUNTERS.find((encounter) => encounter.id === run.combat!.encounterId && eligible(run, node, encounter));
      if (actual) { node.encounterId = actual.id; continue; }
    }
    // 已保存的身份优先，防止补齐过程改变玩家已经看过的节点。
    if (plannedEncounter(run, node)) continue;
    if (!visited.has(node.id) && planned.has(node.id)) node.encounterId = planned.get(node.id);
  }
}
