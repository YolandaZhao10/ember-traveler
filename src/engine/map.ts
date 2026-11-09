import { nextInt, pick, shuffle, type RngState } from './rng';
import type { ChapterId, GameMap, MapNode, NodeType } from './types';
import { FLOORS_PER_CHAPTER } from '../data/chapters';

export const MAP_ROWS = FLOORS_PER_CHAPTER;
export const MAP_COLS = 7;
const PATHS = 6;
const LANES = [1, 3, 5];
const restBand = (row: number) => row >= 3 && row <= 7 ? 0 : row >= 11 && row <= 16 ? 1 : -1;
const laneAt = (col: number) => col < 2 ? 0 : col > 4 ? 2 : 1;

/**
 * 生成带分支与汇合的地图。
 * 算法：从底部随机起点出发生成若干条向上的路径，每步列偏移 -1/0/+1，
 * 并禁止与相邻路径交叉；所有倒数第二层节点连接到 Boss。
 */
export function generateMap(rng: RngState, chapter: ChapterId = 1): GameMap {
  if (chapter === 4) {
    const route: NodeType[] = ['rest', 'elite', 'shop', 'rest', 'boss'];
    const nodes = route.map((type, row): MapNode => ({ id: row === 4 ? 'boss' : `final-${row}`, row, col: 3, type, next: row === 4 ? [] : [row === 3 ? 'boss' : `final-${row + 1}`] }));
    return { rows: route.length, cols: MAP_COLS, nodes: Object.fromEntries(nodes.map(n => [n.id, n])), startIds: [nodes[0].id], bossId: 'boss' };
  }
  const rows = MAP_ROWS;
  const cols = MAP_COLS;
  const grid: (MapNode | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  // 前段每条分支保证一处错层营火，后段可选补给；再加首领门前营火。
  // 分支通过前段营火后可以汇合/改道，保证所有完整路线至少两处。
  const early = shuffle(rng, [3, 4, 5, 6, 7]).slice(0, 3);
  const late = shuffle(rng, [11, 12, 13, 14, 15, 16]).slice(0, 3);
  const campRows = LANES.map((_, lane) => [early[lane], nextInt(rng, 0, 1) ? late[lane] : -1]);
  const camps = new Set(LANES.flatMap((col, lane) => campRows[lane].filter(row => row >= 0).map(row => `${row}-${col}`)));
  const edges = new Set<string>();
  const key = (r: number, c: number) => `${r}-${c}`;

  const ensure = (r: number, c: number): MapNode => {
    if (!grid[r][c]) grid[r][c] = { id: key(r, c), row: r, col: c, type: 'combat', next: [] };
    return grid[r][c]!;
  };

  const lastRow = rows - 2;
  // 三条基础路线贯穿整章，随机分支可以汇合，但每层不会收缩到三个节点以下。
  for (const col of LANES) {
    for (let row = 0; row <= lastRow; row++) {
      const node = ensure(row, col);
      if (row < lastRow) {
        const next = key(row + 1, col);
        node.next.push(next);
        edges.add(`${node.id}>${next}`);
      }
    }
  }
  for (let p = 0; p < PATHS; p++) {
    let c = p < 2 ? (p === 0 ? nextInt(rng, 0, cols - 1) : pickDifferentStart(rng, cols, grid)) : nextInt(rng, 0, cols - 1);
    ensure(0, c);
    for (let r = 0; r < lastRow; r++) {
      const candidates: number[] = [];
      for (const d of [-1, 0, 1]) {
        const nc = c + d;
        if (nc < 0 || nc >= cols) continue;
        const band = restBand(r + 1);
        if (band >= 0) {
          const lane = laneAt(nc);
          if (restBand(r) === band && laneAt(c) !== lane) continue;
          if (campRows[lane][band] === r + 1 && nc !== LANES[lane]) continue;
        }
        // 防止交叉：左边节点不能连到右上方越过右边节点连到左上方的线
        if (d === -1 && edges.has(`${key(r, c - 1)}>${key(r + 1, c)}`)) continue;
        if (d === 1 && edges.has(`${key(r, c + 1)}>${key(r + 1, c)}`)) continue;
        candidates.push(nc);
      }
      const nc = pick(rng, candidates);
      ensure(r + 1, nc);
      const e = `${key(r, c)}>${key(r + 1, nc)}`;
      if (!edges.has(e)) {
        edges.add(e);
        grid[r][c]!.next.push(key(r + 1, nc));
      }
      c = nc;
    }
  }

  // Boss 节点
  const boss: MapNode = { id: 'boss', row: rows - 1, col: Math.floor(cols / 2), type: 'boss', next: [] };
  for (let c = 0; c < cols; c++) {
    const n = grid[lastRow][c];
    if (n) n.next.push('boss');
  }

  // 分配节点类型
  for (const node of grid[lastRow]) if (node) camps.add(node.id);
  assignTypes(grid, rng, camps);

  const nodes: Record<string, MapNode> = { boss };
  for (const row of grid) for (const n of row) if (n) nodes[n.id] = n;
  const startIds = grid[0].filter((n): n is MapNode => !!n).map((n) => n.id);
  return { rows, cols, nodes, startIds, bossId: 'boss' };
}

function pickDifferentStart(rng: RngState, cols: number, grid: (MapNode | null)[][]): number {
  const free = [];
  for (let c = 0; c < cols; c++) if (!grid[0][c]) free.push(c);
  return free.length ? pick(rng, free) : nextInt(rng, 0, cols - 1);
}

function assignTypes(grid: (MapNode | null)[][], rng: RngState, camps: Set<string>) {
  const rows = grid.length;
  const lastRow = rows - 2;
  // 父节点索引
  const parents: Record<string, MapNode[]> = {};
  for (const row of grid) for (const n of row) if (n) for (const nx of n.next) (parents[nx] ??= []).push(n);

  for (let r = 0; r <= lastRow; r++) {
    const rowNodes = shuffle(rng, grid[r].filter((n): n is MapNode => !!n));
    for (const n of rowNodes) {
      let type: NodeType;
      if (r === 0) type = 'combat';
      else if (camps.has(n.id)) type = 'rest';
      else {
        const weights: { item: NodeType; weight: number }[] = [
          { item: 'combat', weight: 42 },
          { item: 'event', weight: 22 },
          { item: 'elite', weight: r >= 4 ? 18 : 0 },
          { item: 'rest', weight: r >= 3 && r <= lastRow - 2 && !n.next.some(id => camps.has(id)) ? 10 : 0 },
          { item: 'shop', weight: r >= 2 ? 8 : 0 },
        ];
        type = weightedNodeType(rng, weights);
        // 规则：父节点为 rest/shop/elite 时不重复同类
        const ps = parents[n.id] ?? [];
        if ((type === 'rest' || type === 'shop' || type === 'elite') && ps.some((p) => p.type === type)) type = 'combat';
        // 同层最多 1 个精英 / 商店；营火允许错层或同层随机分布。
        const rowCount = (t: NodeType) => grid[r].filter((x) => x && x.type === t && x !== n).length;
        if ((type === 'elite' || type === 'shop') && rowCount(type) >= 1) type = 'combat';
        if (type === 'shop' && grid.flat().filter((x) => x && x.type === 'shop' && x !== n).length >= 4) type = 'combat';
      }
      n.type = type;
    }
  }
  // 给未来必经营火预留名额，删去会使某条完整路线超过 5 处的随机营火。
  const nodes = grid.flat().filter((n): n is MapNode => !!n);
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const futureMandatory: Record<string, number> = {};
  for (const n of [...nodes].reverse()) futureMandatory[n.id] = Math.max(0, ...n.next.filter(id => byId[id]).map(id => (camps.has(id) ? 1 : 0) + futureMandatory[id]));
  const maxBefore: Record<string, number> = {};
  for (const n of nodes) {
    const before = maxBefore[n.id] ?? 0;
    if (n.type === 'rest' && !camps.has(n.id) && before + 1 + futureMandatory[n.id] > 5) n.type = 'combat';
    const count = before + (n.type === 'rest' ? 1 : 0);
    for (const id of n.next) maxBefore[id] = Math.max(maxBefore[id] ?? 0, count);
  }
  // 保证整张图至少有 2 个精英、1 个商店。
  const all = grid.flat().filter((n): n is MapNode => !!n && n.row > 0 && n.row < lastRow);
  const ensureCount = (type: NodeType, min: number, rowMin: number) => {
    let count = all.filter((n) => n.type === type).length;
    const pool = shuffle(rng, all.filter((n) => n.type === 'combat' && n.row >= rowMin));
    while (count < min && pool.length) {
      const candidate = pool.pop()!;
      if ((type === 'elite' || type === 'shop') && (all.some(n => n.row === candidate.row && n.type === type)
        || (parents[candidate.id] ?? []).some(n => n.type === type)
        || candidate.next.some(id => all.find(n => n.id === id)?.type === type))) continue;
      candidate.type = type;
      count++;
    }
  };
  ensureCount('elite', 2, 4);
  ensureCount('shop', 1, 2);
  ensureCount('event', 3, 1);
}

/** 旧存档补齐基础路线，不重掷原节点或消耗随机流；已进入的精英照常结算。 */
export function expandLegacyRoutes(map: GameMap, visited: string[]) {
  const final = map.rows - 2;
  for (const col of [1, 3, 5]) {
    const lane: MapNode[] = [];
    for (let row = 0; row <= final; row++) {
      let node = Object.values(map.nodes).find(n => n.row === row && n.col === col);
      if (!node) {
        const id = `route-${row}-${col}`;
        node = { id, row, col, type: row === final ? 'rest' : 'combat', next: [] };
        map.nodes[id] = node;
      }
      lane.push(node);
    }
    if (!map.startIds.includes(lane[0].id)) map.startIds.push(lane[0].id);
    lane.forEach((node, row) => {
      const next = row === final ? map.bossId : lane[row + 1].id;
      if (!node.next.includes(next)) node.next.push(next);
    });
  }
  for (const node of Object.values(map.nodes)) if (node.row < 4 && node.type === 'elite' && !visited.includes(node.id)) node.type = 'combat';
  for (const node of Object.values(map.nodes)) if (node.row === final && !visited.includes(node.id)) node.type = 'rest';
  map.startIds.sort((a, b) => map.nodes[a].col - map.nodes[b].col);
}

function weightedNodeType(rng: RngState, items: { item: NodeType; weight: number }[]): NodeType {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let roll = nextInt(rng, 0, total - 1);
  for (const it of items) {
    roll -= it.weight;
    if (roll < 0) return it.item;
  }
  return 'combat';
}

export function nodeTypeName(t: NodeType): string {
  return { combat: '战斗', elite: '精英', event: '事件', shop: '商店', rest: '营火', boss: '首领' }[t];
}

/** 当前可前往的节点 */
export function availableNodes(map: GameMap, currentId: string | null): string[] {
  if (!currentId) return map.startIds;
  return map.nodes[currentId]?.next ?? [];
}

/** 校验：每个节点都能到达 Boss */
export function validateMap(map: GameMap): boolean {
  const memo = new Map<string, boolean>();
  const reach = (id: string): boolean => {
    if (id === map.bossId) return true;
    if (memo.has(id)) return memo.get(id)!;
    const n = map.nodes[id];
    const ok = !!n && n.next.some(reach);
    memo.set(id, ok);
    return ok;
  };
  return map.startIds.length > 0 && Object.keys(map.nodes).every(reach);
}
