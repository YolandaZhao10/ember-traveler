import { CARD_LIST, CARDS } from '../data/cards';
import { describeCard, viewCard } from '../engine/cards';
import { canPlayCard, createCombat, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { cardTransferChoices, cardTransferEffect } from '../engine/cardTransfer';
import type { CombatState } from '../engine/types';

/** 可复现的效果边界探针，不把预置资源当作免费获得，也不用于推算真人胜率。 */
export const RARITY_CONTEXTS = ['bare', 'prepared', 'group', 'debuffed'] as const;
export type RarityContext = typeof RARITY_CONTEXTS[number];
const card = (defId: string, upgraded = false, uid = defId) => ({ defId, upgraded, uid });
export function rarityFixture(id: string, upgraded = false, context: RarityContext = 'bare'): CombatState {
  const state = createCombat('rarity-audit', context === 'group' ? ['tomb_puppet', 'tomb_puppet'] : ['tomb_puppet'],
    'normal', [], 60, 100, [], makeRng('RARITY-AUDIT', 'c'), 100, CARDS[id].owner ?? 'traveler').state;
  state.enemies.forEach(e => { e.hp = e.maxHp = 10000; e.block = 0; e.statuses = {}; });
  const candidate = { ...card(id, upgraded), bonus: context === 'bare' ? 0 : 2 };
  state.player.hand = [candidate, card('strike', false, 'fuel-1'), card('defend', false, 'fuel-2'), card('ashes', false, 'fuel-3')];
  state.player.draw = Array.from({ length: 20 }, (_, i) => card('strike', false, `draw-${i}`));
  if (id === 'oath_reenactment') state.player.discard = [card('strike', false, 'discard-target')];
  state.player.energy = 3;
  state.player.ember = context === 'bare' ? viewCard(candidate).requireEmber : 8;
  if (context !== 'bare') {
    state.player.block = 12;
    state.player.attacksPlayedThisTurn = 2; state.player.cardsPlayedThisTurn = 3;
    state.player.hpLostThisTurn = 4; state.player.turnFlags.exhausted = 1;
    state.player.statuses = { strength: 3, echo: 1 };
    state.player.exhaust = [card('bone_ash', false, 'ex-1'), card('defend', false, 'ex-2'), card('strike', false, 'ex-3')];
    state.enemies.forEach(e => { e.statuses.burn = 6; e.burnApplied = 10; });
  }
  if (context === 'debuffed') {
    state.player.statuses.weak = 1; state.player.statuses.frail = 1; state.player.statuses.burn = 3;
    state.enemies.forEach(e => { e.block = 10; e.statuses.vulnerable = 1; });
  }
  const transfer = cardTransferEffect(candidate);
  if (transfer?.from === 'discard') state.player.discard = [card('strike', false, 'discard-target'), card('defend', false, 'discard-skill'), card('blood_rite', false, 'discard-exhaust')];
  if (transfer?.from === 'exhaust' && !state.player.exhaust.length) state.player.exhaust = [card('defend', false, 'ex-target')];
  return state;
}
export function rarityProbe(id: string, upgraded: boolean, context: RarityContext) {
  const before = rarityFixture(id, upgraded, context), candidate = before.player.hand[0];
  const view = viewCard(candidate), allowed = canPlayCard(before, candidate).ok;
  const result = playCard(before, candidate.uid, view.target === 'enemy' || id === 'oath_reenactment' ? 'e0' : null, cardTransferChoices(before, candidate)[0]?.uid ?? 'discard-target');
  const after = result.state;
  return {
    id, upgraded, context, allowed, played: after !== before,
    cost: view.cost, exhaust: view.exhaust, retain: view.retain,
    description: describeCard(candidate, null),
    damage: before.enemies.reduce((n, e, i) => n + e.hp - after.enemies[i].hp, 0),
    block: after.player.block - before.player.block,
    hp: after.player.hp - before.player.hp,
    energy: after.player.energy - before.player.energy,
    ember: after.player.ember - before.player.ember,
    hand: after.player.hand.length - before.player.hand.length,
    exhausted: after.player.exhaust.length - before.player.exhaust.length,
    statuses: after.player.statuses,
    enemyStatuses: after.enemies.map(e => e.statuses),
    invalid: [after.player.hp, after.player.block, after.player.energy, after.player.ember, ...after.enemies.map(e => e.hp)]
      .some(n => !Number.isFinite(n) || !Number.isInteger(n) || n < 0),
  };
}
export function probeEveryCard() {
  return CARD_LIST.flatMap(c => (c.cost < 0 || c.type === 'status' ? [false] : [false, true]).flatMap(upgraded =>
    RARITY_CONTEXTS.map(context => rarityProbe(c.id, upgraded, context))));
}
