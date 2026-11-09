import { makeRng, weightedPick } from './rng';
import type { MapNode, MysteryType, RunState } from './types';

/** 只在进入问号时调用。记录结果但不改变地图标记，也不推进其他随机流。 */
export function resolveMystery(run: Pick<RunState, 'seed' | 'chapter' | 'map' | 'visited'>, node: MapNode): MysteryType {
  if (node.mysteryType) return node.mysteryType;
  const previous = run.visited.filter(id => id !== node.id).map(id => run.map.nodes[id]).filter(Boolean);
  const recent = previous.filter(n => n.type === 'event').slice(-2).map(n => n.mysteryType ?? 'event');
  const last = previous[previous.length - 1];
  const choices: { item: MysteryType; weight: number }[] = [{ item: 'event', weight: 70 }];
  // 事件允许连续出现；战斗、商店在最近两个问号出现过就暂时移出池。
  if (!recent.includes('combat')) choices.push({ item: 'combat', weight: 20 });
  if (!recent.includes('shop') && last?.type !== 'shop') choices.push({ item: 'shop', weight: 10 });
  node.mysteryType = weightedPick(makeRng(run.seed, `mystery:${run.chapter}:${node.id}`), choices);
  return node.mysteryType;
}
