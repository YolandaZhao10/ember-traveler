import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateMap, validateMap } from '../src/engine/map';
import { resolveMystery } from '../src/engine/mystery';
import { makeRng, pick } from '../src/engine/rng';
import type { GameMap, MysteryType, NodeType } from '../src/engine/types';

const args = process.argv.slice(2);
const value = (flag: string) => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const seeds = 500;
const baselinePath = value('--baseline-map');
const previous: typeof generateMap | undefined = baselinePath ? (await import(resolve(baselinePath))).generateMap : undefined;
const failures: string[] = [];
const emptyCounts = (): Record<NodeType, number> => ({ combat: 0, event: 0, shop: 0, elite: 0, rest: 0, boss: 0 });

function inspect(map: GameMap, label: string) {
  const nodes = Object.values(map.nodes).sort((a, b) => a.row - b.row);
  if (!validateMap(map)) failures.push(`${label}: invalid map`);
  const min = new Map(map.startIds.map(id => [id, 0])), max = new Map(min);
  for (const node of nodes) {
    const own = node.type === 'rest' ? 1 : 0;
    for (const id of node.next) {
      min.set(id, Math.min(min.get(id) ?? Infinity, (min.get(node.id) ?? 0) + own));
      max.set(id, Math.max(max.get(id) ?? 0, (max.get(node.id) ?? 0) + own));
    }
  }
  if ((min.get(map.bossId) ?? 0) < 2 || (max.get(map.bossId) ?? Infinity) > 5) failures.push(`${label}: camp range`);
  if (nodes.some(n => n.row < 4 && n.type === 'elite')) failures.push(`${label}: early elite`);
  if (nodes.filter(n => n.row === 18).some(n => n.type !== 'rest')) failures.push(`${label}: boss camps`);
  for (let row = 0; row < 19; row++) if (nodes.filter(n => n.row === row).length < 3) failures.push(`${label}: narrow floor ${row}`);
}

function audit(generator: typeof generateMap, mixed: boolean) {
  const nodeCounts = emptyCounts(), routeCounts = emptyCounts();
  const mysteryCounts: Record<MysteryType, number> = { event: 0, combat: 0, shop: 0 };
  let routes = 0, maps = 0;
  for (const chapter of [1, 2, 3] as const) for (let i = 0; i < seeds; i++) {
    const seed = `MYSTERY-AUDIT-${chapter}-${i}`, map = generator(makeRng(seed, 'map'), chapter);
    maps++; inspect(map, `${mixed ? 'after' : 'before'}:${chapter}:${i}`);
    for (const node of Object.values(map.nodes)) nodeCounts[node.type]++;
    // 每图三条随机完整路线，选择器独立，不利用未揭晓的问号结果。
    for (let path = 0; path < 3; path++) {
      routes++;
      const run = { seed, chapter, map: structuredClone(map), visited: [] as string[] };
      const rng = makeRng(seed, `route:${path}`), recent: MysteryType[] = [];
      let options = run.map.startIds;
      while (options.length) {
        const node = run.map.nodes[pick(rng, options)];
        const type = node.type === 'event' && mixed ? resolveMystery(run, node) : node.type;
        if (node.type === 'event') {
          const kind = type as MysteryType;
          if (kind !== 'event' && recent.slice(-2).includes(kind)) failures.push(`${seed}: repeated ${kind}`);
          recent.push(kind); mysteryCounts[kind]++;
        }
        routeCounts[type]++;
        run.visited.push(node.id); options = node.next;
      }
    }
  }
  return { maps, routes, nodeCounts, mysteryCounts, routeCounts,
    questionNodePercent: nodeCounts.event / Object.values(nodeCounts).reduce((a, b) => a + b, 0) * 100,
    averagePerRoute: Object.fromEntries(Object.entries(routeCounts).map(([key, n]) => [key, n / routes])) };
}
const before = previous ? audit(previous, false) : undefined;
const after = audit(generateMap, true);
if (before && after.questionNodePercent <= before.questionNodePercent) failures.push('question frequency did not increase');
const result = { note: '随机完整路径与地图结构统计，不模拟战斗胜率；每种子三路径不预知问号结果。', seedsPerChapter: seeds, before, after, failures };
if (value('--output')) writeFileSync(value('--output')!, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
