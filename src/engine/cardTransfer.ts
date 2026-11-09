import { viewCard } from './cards';
import { shuffle, type RngState } from './rng';
import type { CardInstance, CombatState, Effect } from './types';

export type CardTransfer = Extract<Effect, { kind: 'moveCard' }>;
export function cardTransferEffect(card: CardInstance): CardTransfer | undefined {
  return viewCard(card).effects.find((e): e is CardTransfer => e.kind === 'moveCard');
}

/** 消耗区自选回收不能互捞回收牌，包括条件中的回收效果。 */
export function hasExhaustRecovery(effects: Effect[]): boolean {
  return effects.some(e => e.kind === 'returnExhausted' || (e.kind === 'moveCard' && e.from === 'exhaust') || (e.kind === 'conditional' && hasExhaustRecovery(e.then)));
}

/** 查看候选不推进随机流；确认出牌时才传入实战随机流消费同一次取样。 */
export function cardTransferChoices(cs: CombatState, source: CardInstance, rng: RngState = { ...cs.rng }): CardInstance[] {
  const effect = cardTransferEffect(source);
  if (!effect) return [];
  const pool = cs.player[effect.from].filter(card => {
    if (card.uid === source.uid) return false;
    const view = viewCard(card);
    if (effect.from === 'exhaust' && hasExhaustRecovery(view.effects)) return false;
    if (effect.filter === 'action') return view.type === 'attack' || view.type === 'skill';
    if (effect.filter === 'exhaust') return view.exhaust;
    return !effect.filter || view.type === effect.filter;
  });
  return effect.sample ? shuffle(rng, pool).slice(0, effect.sample) : pool;
}
