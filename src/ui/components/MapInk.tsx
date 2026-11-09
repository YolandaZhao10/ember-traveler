import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { appendMapPoint, commitMapStroke, MAX_MAP_STROKES, readMapNotes, type MapNoteScope, type MapNotes, type MapStroke } from '../mapNotes';

/** 只在主动开启画笔时接管拖动；显示笔迹的 SVG 组始终不接收输入。 */
export function useMapInk(scope: MapNoteScope | null, W: number, H: number) {
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<MapStroke>([]);
  const gesture = useRef<{ id: number; svg: SVGSVGElement; points: MapStroke; scope: MapNoteScope } | null>(null);
  const finish = () => {
    const active = gesture.current;
    // 先清空手势，再释放捕获；随后到达的 lostpointercapture 不会重复保存或删除笔迹。
    gesture.current = null;
    if (active) commitMapStroke(active.scope, active.points);
    if (active?.svg.hasPointerCapture(active.id)) active.svg.releasePointerCapture(active.id);
    setDraft([]);
  };
  const stop = () => { finish(); setDrawing(false); };
  useEffect(() => {
    setDrawing(false);
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
  const handlers = {
    onPointerDownCapture: (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!drawing || !scope || event.button !== 0 || !event.isPrimary || gesture.current || readMapNotes(scope).length >= MAX_MAP_STROKES) return;
      const p = point(event);
      if (!p) return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const points = appendMapPoint([], p);
      gesture.current = { id: event.pointerId, svg: event.currentTarget, points, scope };
      setDraft(points);
    },
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => {
      const active = gesture.current;
      if (!active || active.id !== event.pointerId) return;
      const p = point(event);
      if (!p) return;
      active.points = appendMapPoint(active.points, p);
      setDraft(active.points);
    },
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => {
      const active = gesture.current;
      if (!active || active.id !== event.pointerId || !scope) return;
      const p = point(event);
      if (p) active.points = appendMapPoint(active.points, p);
      finish();
    },
    onPointerCancel: (event: ReactPointerEvent<SVGSVGElement>) => { if (gesture.current?.id === event.pointerId) finish(); },
    onLostPointerCapture: (event: ReactPointerEvent<SVGSVGElement>) => { if (gesture.current?.id === event.pointerId) finish(); },
  };
  return { drawing, draft, handlers, stop, toggle: () => { finish(); setDrawing(value => !value); } };
}

export function MapInk({ strokes, draft, W, H }: { strokes: MapNotes; draft: MapStroke; W: number; H: number }) {
  return <g className="map-ink" pointerEvents="none" aria-hidden="true">
    {[...strokes, ...(draft.length ? [draft] : [])].map((stroke, i) => <polyline key={i}
      points={(stroke.length === 1 ? [stroke[0], stroke[0]] : stroke).map(p => `${p.x * W},${p.y * H}`).join(' ')} vectorEffect="non-scaling-stroke" />)}
  </g>;
}
