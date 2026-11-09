import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { appendMapPoint, commitMapStroke, eraseMapNotes, MAX_MAP_STROKES, readMapNotes, type MapNoteScope, type MapNotes, type MapPoint, type MapStroke } from '../mapNotes';

/** 只在主动开启绘图工具时接管拖动；显示笔迹的 SVG 组始终不接收输入。 */
export function useMapInk(scope: MapNoteScope | null, W: number, H: number) {
  const [tool, setTool] = useState<'pen' | 'eraser' | null>(null);
  const [draft, setDraft] = useState<MapStroke>([]);
  const gesture = useRef<{ id: number; svg: SVGSVGElement; points: MapStroke; scope: MapNoteScope; tool: 'pen' | 'eraser' } | null>(null);
  const finish = () => {
    const active = gesture.current;
    // 先清空手势，再释放捕获；随后到达的 lostpointercapture 不会重复保存或删除笔迹。
    gesture.current = null;
    if (active?.tool === 'pen') commitMapStroke(active.scope, active.points);
    if (active?.svg.hasPointerCapture(active.id)) active.svg.releasePointerCapture(active.id);
    setDraft([]);
  };
  const stop = () => { finish(); setTool(null); };
  useEffect(() => {
    setTool(null);
    // 触控手势取消、切换窗口/地图或页面隐藏都保留已画出的部分。
    const onHide = () => { if (document.hidden) finish(); };
    window.addEventListener('blur', finish);
    window.addEventListener('pagehide', finish);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      finish();
      window.removeEventListener('blur', finish);
      window.removeEventListener('pagehide', finish);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [scope?.journey, scope?.page]);
  const point = (event: ReactPointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const local = event.currentTarget.createSVGPoint();
    local.x = event.clientX; local.y = event.clientY;
    const p = local.matrixTransform(matrix.inverse());
    return { x: p.x / W, y: p.y / H };
  };
  const erase = (svg: SVGSVGElement, page: MapNoteScope, from: MapPoint, to: MapPoint, starting = false) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return false;
    const size = { x: W * Math.hypot(matrix.a, matrix.b), y: H * Math.hypot(matrix.c, matrix.d) };
    // 忽略极小抖动，减少重复裁切造成的细碎采样点。
    if (!starting && Math.hypot((to.x - from.x) * size.x, (to.y - from.y) * size.y) < 3) return false;
    eraseMapNotes(page, from, to, size);
    return true;
  };
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    const p = point(event);
    if (!p) return;
    if (active.tool === 'eraser') {
      if (erase(active.svg, active.scope, active.points[0], p)) active.points = [p];
    } else {
      active.points = appendMapPoint(active.points, p);
      setDraft(active.points);
    }
  };
  const handlers = {
    onPointerDownCapture: (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!tool || !scope || event.button !== 0 || !event.isPrimary || gesture.current || (tool === 'pen' && readMapNotes(scope).length >= MAX_MAP_STROKES)) return;
      const p = point(event);
      if (!p) return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const points = tool === 'eraser' ? [p] : appendMapPoint([], p);
      gesture.current = { id: event.pointerId, svg: event.currentTarget, points, scope, tool };
      if (tool === 'eraser') erase(event.currentTarget, scope, p, p, true);
      else setDraft(points);
    },
    onPointerMove: move,
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => {
      const active = gesture.current;
      if (!active || active.id !== event.pointerId || !scope) return;
      move(event);
      finish();
    },
    onPointerCancel: (event: ReactPointerEvent<SVGSVGElement>) => { if (gesture.current?.id === event.pointerId) finish(); },
    onLostPointerCapture: (event: ReactPointerEvent<SVGSVGElement>) => { if (gesture.current?.id === event.pointerId) finish(); },
  };
  return { drawing: tool === 'pen', erasing: tool === 'eraser', editing: tool !== null, draft, handlers, stop,
    selectTool: (next: 'pen' | 'eraser') => { finish(); setTool(value => value === next ? null : next); } };
}

export function MapInk({ strokes, draft, W, H }: { strokes: MapNotes; draft: MapStroke; W: number; H: number }) {
  return <g className="map-ink" pointerEvents="none" aria-hidden="true">
    {[...strokes, ...(draft.length ? [draft] : [])].map((stroke, i) => <path key={i}
      d={stroke.map((p, j) => `${j === 0 || p.breakBefore ? 'M' : 'L'}${p.x * W},${p.y * H}${j === stroke.length - 1 || stroke[j + 1].breakBefore ? `L${p.x * W},${p.y * H}` : ''}`).join(' ')} vectorEffect="non-scaling-stroke" />)}
  </g>;
}
