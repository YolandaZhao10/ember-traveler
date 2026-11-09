import { useSyncExternalStore } from 'react';
import type { RunState } from '../engine/types';

export type MapPoint = Readonly<{ x: number; y: number }>;
export type MapStroke = readonly MapPoint[];
export type MapNotes = readonly MapStroke[];
export type MapNoteScope = { journey: string; page: string };
const KEY = 'ember-traveler:map-notes';
const EMPTY: MapNotes = [];
export const MAX_MAP_STROKES = 100;
const MAX_POINTS = 512;
type Notebook = { version: 1; journey: string; pages: Record<string, MapNotes> };
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
  const points = stroke.length >= MAX_POINTS ? stroke.filter((_, i) => i % 2 === 0 || i === stroke.length - 1) : stroke;
  return [...points, next];
}

function sanitizeNotes(value: unknown): MapNotes {
  if (!Array.isArray(value)) return EMPTY;
  return value.slice(0, MAX_MAP_STROKES).flatMap(stroke => {
    if (!Array.isArray(stroke) || stroke.length > MAX_POINTS) return [];
    if (stroke.some(p => !p || typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return [];
    return stroke.length >= 1 ? [stroke.map(p => ({ x: p.x, y: p.y }))] : [];
  });
}

function book(): Notebook {
  if (notebook) return notebook;
  notebook = { version: 1, journey: '', pages: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw?.version === 1 && typeof raw.journey === 'string' && raw.pages && typeof raw.pages === 'object' && !Array.isArray(raw.pages)) {
      notebook = { version: 1, journey: raw.journey, pages: Object.fromEntries(Object.entries(raw.pages).slice(-4).map(([id, strokes]) => [id, sanitizeNotes(strokes)])) };
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
  notebook = { version: 1, journey: scope.journey, pages: Object.fromEntries(Object.entries(pages).slice(-4)) };
  try { localStorage.setItem(KEY, JSON.stringify(notebook)); } catch { /* 保留本次会话内的笔迹。 */ }
  for (const listener of listeners) listener();
}

/** 用最新已保存列表追加，连续落笔或两个地图视图不会覆盖先前的笔迹。 */
export function commitMapStroke(scope: MapNoteScope, stroke: MapStroke) {
  if (stroke.length) writeMapNotes(scope, [...readMapNotes(scope), stroke]);
}

export function useMapNotes(scope: MapNoteScope | null): MapNotes {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => scope ? readMapNotes(scope) : EMPTY,
    () => EMPTY,
  );
}
