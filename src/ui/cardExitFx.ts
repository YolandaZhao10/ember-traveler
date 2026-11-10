import type { CardInstance, CombatEvent } from '../engine/types';

export interface CardExitCue {
  card: CardInstance;
  destination: 'exhaust' | 'discard';
  random: boolean;
  slot: number;
  delayMs: number;
  durationMs: number;
}
export interface CardExitItem extends CardExitCue { id: number }

/** 每批最多四张，以实际离手顺序展示；快动画仍留出读牌名的时间。 */
export function cardExitCues(events: CombatEvent[], fast = false): CardExitCue[] {
  const removed = events.filter((e): e is Extract<CombatEvent, { type: 'cardRemoved' }> => e.type === 'cardRemoved');
  const played = new Set(events.filter(e => e.type === 'cardPlayed').map(e => e.uid));
  let batchStart = 0, batchEnd = 0;
  return removed.map((e, i) => {
    if (i > 0 && i % 4 === 0) batchStart = batchEnd + 220;
    const ownExhaust = e.destination === 'exhaust' && !e.random && played.has(e.card.uid);
    const durationMs = ownExhaust ? (fast ? 360 : 600) : (fast ? 1100 : 1400);
    const delayMs = batchStart + i % 4 * 70;
    batchEnd = Math.max(batchEnd, delayMs + durationMs);
    return { card: { ...e.card }, destination: e.destination, random: e.random,
      slot: i % 4, durationMs, delayMs };
  });
}
