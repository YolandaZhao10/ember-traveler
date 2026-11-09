import type { GameMap } from './types';

export interface RoutePreview {
  /** 包含所选节点；只包含能沿该分支到达本章首领的节点。 */
  reachable: Set<string>;
  /** 距离按层数计算；0 表示所选节点本身，null 表示后路没有此类节点。 */
  nearestRest: number | null;
  nearestShop: number | null;
  /** 从所选节点到首领，完整路线经过的精英数量范围。 */
  elites: { min: number; max: number };
}

/** 纯地图分析，预览不会改地图、存档或随机状态。 */
export function previewRoute(map: GameMap, nodeId: string): RoutePreview {
  const reachable = new Set<string>();
  const selected = map.nodes[nodeId];
  const empty = { reachable, nearestRest: null, nearestShop: null, elites: { min: 0, max: 0 } };
  if (!selected) return empty;
  const ranges = new Map<string, { min: number; max: number }>();
  const ordered = Object.values(map.nodes).sort((a, b) => b.row - a.row);
  for (const node of ordered) {
    if (node.id === map.bossId) {
      ranges.set(node.id, { min: 0, max: 0 });
      continue;
    }
    const children = node.next.flatMap((id) => ranges.has(id) ? [ranges.get(id)!] : []);
    if (children.length) {
      const own = node.type === 'elite' ? 1 : 0;
      ranges.set(node.id, { min: own + Math.min(...children.map((child) => child.min)), max: own + Math.max(...children.map((child) => child.max)) });
    }
  }
  if (!ranges.has(nodeId)) return empty;
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id) || !ranges.has(id)) continue;
    reachable.add(id);
    stack.push(...map.nodes[id].next);
  }
  const nearest = (type: 'rest' | 'shop') => {
    const distances = [...reachable].filter((id) => map.nodes[id].type === type).map((id) => map.nodes[id].row - selected.row);
    return distances.length ? Math.min(...distances) : null;
  };
  return { reachable, nearestRest: nearest('rest'), nearestShop: nearest('shop'), elites: ranges.get(nodeId)! };
}
