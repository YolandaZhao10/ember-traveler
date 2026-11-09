import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { canPlayCard, needsTarget } from '../engine/combat';
import { viewCard } from '../engine/cards';
import type { CardInstance, TargetMode } from '../engine/types';
import { getState, playCardDirect, selectCard, useGame } from './store';

type Point = { x: number; y: number };
export interface CardAim {
  from: Point;
  to: Point;
  targetId: string | null;
  mode: TargetMode;
  ready: boolean;
  name: string;
}
type Gesture = { uid: string; pointerId: number; start: Point; source: HTMLElement; dragged: boolean };

/** 桌面拖放与点击选牌共用同一套命中检测；结算仍交给规则层。 */
export function useCardAim(root: RefObject<HTMLDivElement>) {
  const { selectedCard, busy, overlay, run } = useGame();
  const [aim, setAim] = useState<CardAim | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointer = useRef<Point | null>(null);
  const suppressClick = useRef(false);
  const refresh = useRef(() => {});
  const cancel = useRef(() => {});

  useEffect(() => {
    function releaseGesture() {
      const g = gesture.current;
      gesture.current = null;
      if (g?.source.hasPointerCapture(g.pointerId)) g.source.releasePointerCapture(g.pointerId);
      setDragging(null);
    }
    function cancelAim() {
      releaseGesture();
      selectCard(null);
      setAim(null);
    }
    function currentAim(): CardAim | null {
      const state = getState();
      const cs = state.run?.combat;
      const card = cs?.player.hand.find((c) => c.uid === state.selectedCard);
      if (!cs || !card || state.busy || state.overlay || !canPlayCard(cs, card).ok) return null;
      if (!needsTarget(card) && !gesture.current?.dragged) return null;
      const source = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-card-uid]') ?? [])
        .find((el) => el.dataset.cardUid === card.uid);
      if (!source) return null;
      const rect = source.getBoundingClientRect();
      const from = { x: rect.x + rect.width / 2, y: rect.top + 12 };
      const point = pointer.current ?? { x: from.x, y: from.y - 90 };
      const hit = document.elementFromPoint(point.x, point.y);
      const entity = hit?.closest<HTMLElement>('.entity[data-entity-id]');
      const enemy = cs.enemies.find((e) => e.id === entity?.dataset.entityId && e.hp > 0);
      const onField = !!hit && !!root.current?.querySelector('.battlefield')?.contains(hit);
      const mode = viewCard(card).target;
      const ready = needsTarget(card) ? !!enemy : onField;
      const target = needsTarget(card) ? (enemy ? entity : null)
        : mode === 'self' && ready ? root.current?.querySelector<HTMLElement>('.player-entity') : null;
      const targetRect = target?.querySelector('.combat-figure')?.getBoundingClientRect();
      const to = targetRect ? { x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height * 0.5 }
        : point.y >= rect.top && !gesture.current?.dragged ? { x: from.x, y: from.y - 90 } : point;
      return { from, to, ready, mode, targetId: enemy?.id ?? null, name: viewCard(card).name };
    }
    refresh.current = () => setAim(currentAim());
    cancel.current = cancelAim;
    const move = (event: globalThis.PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      const g = gesture.current;
      if (g && g.pointerId === event.pointerId && !g.dragged && Math.hypot(event.clientX - g.start.x, event.clientY - g.start.y) >= 8) {
        const state = getState();
        if (state.busy || state.overlay) return releaseGesture();
        g.dragged = true;
        g.source.setPointerCapture(g.pointerId);
        setDragging(g.uid);
        if (state.selectedCard !== g.uid) selectCard(g.uid);
      }
      refresh.current();
    };
    const up = (event: globalThis.PointerEvent) => {
      const g = gesture.current;
      if (!g || g.pointerId !== event.pointerId) return;
      pointer.current = { x: event.clientX, y: event.clientY };
      const drop = currentAim();
      releaseGesture();
      if (!g.dragged) return;
      // pointerup 后浏览器还会合成 click，不能重复出牌或打开敌人详情。
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 0);
      setAim(null);
      if (drop?.ready && getState().selectedCard === g.uid) void playCardDirect(g.uid, drop.mode === 'enemy' ? drop.targetId : null);
      else selectCard(null);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelAim(); };
    const leave = (event: globalThis.PointerEvent) => { if (!event.relatedTarget && !gesture.current) setAim(null); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelAim);
    window.addEventListener('pointerout', leave);
    window.addEventListener('blur', cancelAim);
    window.addEventListener('keydown', key);
    window.addEventListener('resize', refresh.current);
    root.current?.addEventListener('scroll', refresh.current, true);
    const container = root.current;
    const update = refresh.current;
    return () => {
      releaseGesture();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancelAim);
      window.removeEventListener('pointerout', leave);
      window.removeEventListener('blur', cancelAim);
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', update);
      container?.removeEventListener('scroll', update, true);
    };
  }, [root]);

  useEffect(() => {
    if (busy || overlay || !selectedCard) {
      const g = gesture.current;
      gesture.current = null;
      if (g?.source.hasPointerCapture(g.pointerId)) g.source.releasePointerCapture(g.pointerId);
      setDragging(null);
      setAim(null);
      return;
    }
    // 跟随选牌抬起的短动画更新箭头起点，停止后不再逐帧测量。
    const until = performance.now() + 220;
    let frame = 0;
    const update = () => { refresh.current(); if (performance.now() < until) frame = requestAnimationFrame(update); };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [selectedCard, busy, overlay, run?.combat]);

  return {
    aim, dragging,
    onCardPointerDown: (event: PointerEvent<HTMLDivElement>, card: CardInstance) => {
      // 触屏保留横向翻手牌、长按详情及点选目标，避免把滑动误作出牌。
      if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary) return;
      const state = getState();
      const cs = state.run?.combat;
      if (!cs || state.busy || state.overlay || !canPlayCard(cs, card).ok) return;
      pointer.current = { x: event.clientX, y: event.clientY };
      gesture.current = { uid: card.uid, pointerId: event.pointerId, start: pointer.current, source: event.currentTarget, dragged: false };
    },
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onContextMenuCapture: (event: MouseEvent<HTMLDivElement>) => {
      if (!aim && !gesture.current?.dragged) return;
      event.preventDefault();
      event.stopPropagation();
      cancel.current();
    },
  };
}
