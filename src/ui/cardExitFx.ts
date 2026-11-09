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
  const durationMs = fast ? 700 : 1050;
  return removed.map((e, i) => ({ card: { ...e.card }, destination: e.destination, random: e.random,
    slot: i % 4, durationMs, delayMs: Math.floor(i / 4) * (durationMs + 220) + i % 4 * 70 }));
}
