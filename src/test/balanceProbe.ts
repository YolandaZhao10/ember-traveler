import { createCombat, canPlayCard, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CardInstance } from '../engine/types';
import { CARD_LIST, CARDS } from '../data/cards';
import { viewCard } from '../engine/cards';

export function resourcePairs(): [CardInstance, CardInstance][] {
  const pool = CARD_LIST.filter(d => !['power', 'curse'].includes(d.type))
    .flatMap(d => [false, true].map(upgraded => ({ defId: d.id, uid: d.id, upgraded })))
    .filter(c => { const v = viewCard(c); return v.cost <= 1 && /draw|returnExhausted|lifesteal|"energy"/.test(JSON.stringify(v.effects)); });
  return pool.flatMap(a => pool.filter(b => !CARDS[a.defId].owner || !CARDS[b.defId].owner || CARDS[a.defId].owner === CARDS[b.defId].owner).map(b => [a, b] as [CardInstance, CardInstance]));
}

/** 极薄牌组，无遗物/能力；满足连击、格挡、燃烧与本回合失血门槛，检查双牌资源循环。 */
export function probePair(a: CardInstance, b: CardInstance, limit = 80) {
  let cs = createCombat('audit', ['tomb_puppet'], 'normal', [], 100, 100, [], makeRng('LOOP', 'c'), 100).state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 1000000;
  cs.player.hand = [{ ...a, uid: 'probe-0' }, { ...b, uid: 'probe-1' }];
  cs.player.ember = 10; cs.player.cardsPlayedThisTurn = 10; cs.player.attacksPlayedThisTurn = 10;
  cs.player.block = 10; cs.player.hpLostThisTurn = 10; cs.enemies[0].statuses.burn = 10;
  let actions = 0;
  while (actions < limit) {
    const card = cs.player.hand.find(c => canPlayCard(cs, c).ok);
    if (!card || cs.outcome !== 'ongoing') break;
    cs = playCard(cs, card.uid, 'e0').state; actions++;
  }
  return { actions, state: cs };
}
