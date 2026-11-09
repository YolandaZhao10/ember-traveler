import type { CombatEvent } from '../engine/types';

export interface ImpactCue {
  eventIndex: number;
  targetId: string;
  kind: 'strike' | 'guard' | 'burn' | 'recoil';
  direction: 'left' | 'right';
  delayMs: number;
  heavy: boolean;
}

/** 只根据结算事件找受击者；群攻并行，同一目标的连击错开显示。 */
export function impactCues(events: CombatEvent[]): ImpactCue[] {
  const hits = new Map<string, number>();
  return events.flatMap((event, eventIndex) => {
    if (event.type !== 'damage' || event.amount + event.blocked + (event.prevented ?? 0) <= 0) return [];
    const count = hits.get(event.targetId) ?? 0;
    hits.set(event.targetId, count + 1);
    return [{
      eventIndex,
      targetId: event.targetId,
      kind: event.amount === 0 ? 'guard' : event.source === 'burn' ? 'burn'
        : event.source === 'player' || event.source === 'enemy' ? 'strike' : 'recoil',
      direction: event.targetId === 'player' ? 'left' : 'right',
      delayMs: Math.min(count * 85, 510),
      heavy: event.amount >= 12,
    } satisfies ImpactCue];
  });
}

export interface ImpactItem extends ImpactCue {
  id: number;
}
