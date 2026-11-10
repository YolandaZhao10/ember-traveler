import { viewCard } from '../engine/cards';
import type { CardInstance, CardType } from '../engine/types';

/** 费用来自升级后的实际卡牌定义；诅咒不参与可打出卡牌的平均费用。 */
export function rewardDeckSummary(deck: CardInstance[]) {
  const types: Record<CardType, number> = { attack: 0, skill: 0, power: 0, curse: 0, status: 0 };
  const copies: Record<string, number> = {};
  let totalCost = 0;
  for (const card of deck) {
    const view = viewCard(card);
    types[view.type]++;
    copies[card.defId] = (copies[card.defId] ?? 0) + 1;
    if (view.cost >= 0) totalCost += view.cost;
  }
  const playableCount = deck.length - types.curse - types.status;
  return { count: deck.length, types, copies, averageCost: playableCount ? totalCost / playableCount : null };
}
