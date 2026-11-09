import { useSyncExternalStore } from 'react';
import type { RunState } from '../engine/types';

export type MapPoint = Readonly<{ x: number; y: number; breakBefore?: true }>;
export type MapStroke = readonly MapPoint[];
export type MapNotes = readonly MapStroke[];
export type MapNoteScope = { journey: string; page: string };
const KEY = 'ember-traveler:map-notes';
const EMPTY: MapNotes = [];
export const MAX_MAP_STROKES = 100;
const MAX_SAMPLE_POINTS = 512;
const MAX_POINTS = 4096;
type Notebook = { version: 2; journey: string; pages: Record<string, MapNotes> };
let notebook: Notebook | undefined;
const listeners = new Set<() => void>();

/** 标注按地图坐标归一化；浏览/缩放/滚动不会改变其落点。 */
export function appendMapPoint(stroke: MapStroke, point: MapPoint): MapStroke {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return stroke;
  const next = { x: Math.round(Math.max(0, Math.min(1, point.x)) * 10000) / 10000,
    y: Math.round(Math.max(0, Math.min(1, point.y)) * 10000) / 10000 };
  const last = stroke[stroke.length - 1];
  if (last && Math.hypot(next.x - last.x, next.y - last.y) < .001) return stroke;
  // 长笔画保留起点、末端并稀疏中间采样，不截断正在绘制的线路。
  const points = stroke.length >= MAX_SAMPLE_POINTS ? stroke.filter((_, i) => i % 2 === 0 || i === stroke.length - 1) : stroke;
  return [...points, next];
}

function sanitizeNotes(value: unknown): MapNotes {
  if (!Array.isArray(value)) return EMPTY;
  return value.slice(0, MAX_MAP_STROKES).flatMap(stroke => {
    if (!Array.isArray(stroke) || stroke.length > MAX_POINTS) return [];
    if (stroke.some(p => !p || typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return [];
    return stroke.length >= 1 ? [stroke.map(p => ({ x: p.x, y: p.y, ...(p.breakBefore === true ? { breakBefore: true as const } : {}) }))] : [];
  });
}

function book(): Notebook {
  if (notebook) return notebook;
  notebook = { version: 2, journey: '', pages: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if ((raw?.version === 1 || raw?.version === 2) && typeof raw.journey === 'string' && raw.pages && typeof raw.pages === 'object' && !Array.isArray(raw.pages)) {
      notebook = { version: 2, journey: raw.journey, pages: Object.fromEntries(Object.entries(raw.pages).slice(-4).map(([id, strokes]) => [id, sanitizeNotes(strokes)])) };
    }
  } catch { /* 存储不可用时，本次打开仍可标注。 */ }
  return notebook;
}

export function mapNoteScope(run: RunState): MapNoteScope {
  // 包含拓扑，旧地图迁移或地图变化后不会把笔迹贴到另一套路线；不消耗游戏随机流。
  const layout = JSON.stringify([run.map.rows, run.map.cols, Object.values(run.map.nodes).sort((a, b) => a.id.localeCompare(b.id)).map(n => [n.id, n.row, n.col, n.next])]);
  let hash = 2166136261;
  for (let i = 0; i < layout.length; i++) hash = Math.imul(hash ^ layout.charCodeAt(i), 16777619);
  return { journey: run.recordId ?? `legacy:${run.character}:${run.seed}`, page: `${run.chapter}:${hash >>> 0}` };
}

export function readMapNotes(scope: MapNoteScope): MapNotes {
  const data = book();
  return data.journey === scope.journey ? data.pages[scope.page] ?? EMPTY : EMPTY;
}

export function writeMapNotes(scope: MapNoteScope, strokes: MapNotes) {
  const data = book();
  const pages = data.journey === scope.journey ? { ...data.pages } : {};
  delete pages[scope.page];
  pages[scope.page] = sanitizeNotes(strokes);
  notebook = { version: 2, journey: scope.journey, pages: Object.fromEntries(Object.entries(pages).slice(-4)) };
  try { localStorage.setItem(KEY, JSON.stringify(notebook)); } catch { /* 保留本次会话内的笔迹。 */ }
  for (const listener of listeners) listener();
}

/** 用最新已保存列表追加，连续落笔或两个地图视图不会覆盖先前的笔迹。 */
export function commitMapStroke(scope: MapNoteScope, stroke: MapStroke) {
  if (stroke.length) writeMapNotes(scope, [...readMapNotes(scope), stroke]);
}

/** 将每段线裁去橡皮路径覆盖的部分；断点留在同一笔内，不挤掉其他笔迹。 */
export function eraseMapStrokes(notes: MapNotes, from: MapPoint, to: MapPoint, size: MapPoint, radius = 8): MapNotes {
  const pixel = (p: MapPoint) => ({ x: p.x * size.x, y: p.y * size.y });
  const a = pixel(from), b = pixel(to);
  const ex = b.x - a.x, ey = b.y - a.y, length = Math.hypot(ex, ey);
  // 线段与圆相交的参数范围；两端圆与中间矩形合成拖动时扫过的胶囊区域。
  const circle = (u: MapPoint, v: MapPoint, center: MapPoint): [number, number] | null => {
    const dx = v.x - u.x, dy = v.y - u.y, px = u.x - center.x, py = u.y - center.y;
    const aa = dx * dx + dy * dy, bb = 2 * (px * dx + py * dy), cc = px * px + py * py - radius * radius;
    if (!aa) return cc <= 0 ? [0, 1] : null;
    const d = bb * bb - 4 * aa * cc;
    if (d < 0) return null;
    const lo = Math.max(0, (-bb - Math.sqrt(d)) / (2 * aa)), hi = Math.min(1, (-bb + Math.sqrt(d)) / (2 * aa));
    return hi - lo > 1e-9 ? [lo, hi] : null;
  };
  const cut = (u: MapPoint, v: MapPoint): [number, number] | null => {
    const ranges = [circle(u, v, a), circle(u, v, b)].filter((r): r is [number, number] => r !== null);
    if (length) {
      let lo = 0, hi = 1;
      const clip = (start: number, delta: number, min: number, max: number) => {
        if (!delta) { if (start < min || start > max) hi = -1; return; }
        const t1 = (min - start) / delta, t2 = (max - start) / delta;
        lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
      };
      clip(((u.x - a.x) * ex + (u.y - a.y) * ey) / length, ((v.x - u.x) * ex + (v.y - u.y) * ey) / length, 0, length);
      clip(((u.y - a.y) * ex - (u.x - a.x) * ey) / length, ((v.y - u.y) * ex - (v.x - u.x) * ey) / length, -radius, radius);
      if (hi - lo > 1e-9) ranges.push([lo, hi]);
    }
    return ranges.length ? [Math.min(...ranges.map(r => r[0])), Math.max(...ranges.map(r => r[1]))] : null;
  };
  let changed = false;
  const remaining = notes.flatMap(stroke => {
    const subpaths: MapPoint[][] = [];
    for (const p of stroke) {
      if (!subpaths.length || p.breakBefore) subpaths.push([]);
      subpaths[subpaths.length - 1].push(p);
    }
    const pieces: MapPoint[][] = [];
    let erased = false;
    for (const path of subpaths) {
      if (path.length === 1) {
        if (cut(pixel(path[0]), pixel(path[0]))) erased = true;
        else pieces.push(path);
        continue;
      }
      let piece: MapPoint[] = [];
      const flush = () => { if (piece.length) pieces.push(piece); piece = []; };
      for (let i = 1; i < path.length; i++) {
        const u = path[i - 1], v = path[i], range = cut(pixel(u), pixel(v));
        if (!range) { if (!piece.length) piece.push(u); piece.push(v); continue; }
        erased = true;
        const at = (t: number) => ({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t });
        if (range[0] > 0) { if (!piece.length) piece.push(u); piece.push(at(range[0])); }
        flush();
        if (range[1] < 1) piece = [at(range[1]), v];
      }
      flush();
    }
    if (!erased) return [stroke];
    const points = pieces.flatMap((piece, index) => piece.map((p, i) => ({ x: p.x, y: p.y, ...(index > 0 && i === 0 ? { breakBefore: true as const } : {}) })));
    // 极端反复擦除时不截断整条线，更不能挤掉其他标注。
    if (points.length > MAX_POINTS) return [stroke];
    changed = true;
    return points.length ? [points] : [];
  });
  return changed ? remaining : notes;
}

export function eraseMapNotes(scope: MapNoteScope, from: MapPoint, to: MapPoint, size: MapPoint) {
  const notes = readMapNotes(scope);
  const remaining = eraseMapStrokes(notes, from, to, size);
  if (remaining !== notes) writeMapNotes(scope, remaining);
}

export function useMapNotes(scope: MapNoteScope | null): MapNotes {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => scope ? readMapNotes(scope) : EMPTY,
    () => EMPTY,
  );
}
