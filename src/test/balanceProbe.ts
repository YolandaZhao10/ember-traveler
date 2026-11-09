import { createCombat, canPlayCard, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CardInstance, Statuses } from '../engine/types';
import { CARD_LIST, CARDS } from '../data/cards';
import { viewCard } from '../engine/cards';
import { playOptions } from './playOptions';

export function resourcePairs(): [CardInstance, CardInstance][] {
  const pool = CARD_LIST.filter(d => !['power', 'curse'].includes(d.type))
    .flatMap(d => [false, true].map(upgraded => ({ defId: d.id, uid: d.id, upgraded })))
    .filter(c => { const v = viewCard(c); return v.cost <= 1 && /draw|returnExhausted|lifesteal|"energy"|replayDiscard|"heal"|regen|echo/.test(JSON.stringify(v.effects)); });
  return pool.flatMap(a => pool.filter(b => !CARDS[a.defId].owner || !CARDS[b.defId].owner || CARDS[a.defId].owner === CARDS[b.defId].owner).map(b => [a, b] as [CardInstance, CardInstance]));
}

/** 极薄牌组，无遗物/能力；满足连击、格挡、燃烧与本回合失血门槛，检查双牌资源循环。 */
export function probePair(a: CardInstance, b: CardInstance, limit = 80, statuses: Statuses = {}) {
  let cs = createCombat('audit', ['tomb_puppet'], 'normal', [], 100, 100, [], makeRng('LOOP', 'c'), 100).state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 1000000;
  cs.player.hand = [{ ...a, uid: 'probe-0' }, { ...b, uid: 'probe-1' }];
  cs.player.ember = 10; cs.player.cardsPlayedThisTurn = 10; cs.player.attacksPlayedThisTurn = 10;
  cs.player.block = 10; cs.player.hpLostThisTurn = 10; cs.enemies[0].statuses.burn = 10;
  cs.player.statuses = { ...statuses };
  if (statuses.comboFlow) cs.player.attacksPlayedThisTurn = 0;
  if (statuses.chargeMaster) cs.player.hand.forEach(c => { c.bonus = 2; });
  let actions = 0, invalid = false;
  while (actions < limit) {
    const card = cs.player.hand.find(c => canPlayCard(cs, c).ok);
    if (!card || cs.outcome !== 'ongoing') break;
    const option = playOptions(cs, card)[0];
    if (!option) { invalid = true; break; }
    const step = playCard(cs, card.uid, option.target, option.replayUid);
    if (step.state === cs || !step.events.some(e => e.type === 'cardPlayed')) { invalid = true; break; }
    cs = step.state; actions++;
  }
  return { actions, state: cs, invalid };
}
