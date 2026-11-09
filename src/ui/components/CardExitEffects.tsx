import type { CSSProperties } from 'react';
import { viewCard } from '../../engine/cards';
import type { CardExitItem } from '../cardExitFx';
import { Card } from './Card';

export function CardExitEffects({ items }: { items: CardExitItem[] }) {
  if (!items.length) return null;
  const slots = Math.min(4, items.length);
  return <div className="card-exit-layer" role="status" aria-live="polite" aria-label="卡牌去向">
    {items.map(item => <div key={item.id} className={`card-exit ${item.destination}`} style={{
      '--exit-slot': item.slot - (slots - 1) / 2,
      animationDelay: `${item.delayMs}ms`, animationDuration: `${item.durationMs}ms`,
    } as CSSProperties}>
      <div className="card-exit-label">{item.random ? '随机' : ''}{item.destination === 'exhaust' ? '消耗' : '弃置'} · {viewCard(item.card).name}</div>
      <div className="card-exit-face"><Card card={item.card} size="sm" presentation /></div>
      <span className="card-exit-trail" aria-hidden="true" />
    </div>)}
  </div>;
}
