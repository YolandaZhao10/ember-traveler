import { viewCard } from '../engine/cards';
import { aliveEnemies, canPlayCard, discardReplayChoices, needsDiscardReplay, playCard, type PlayChoice } from '../engine/combat';
import { cardTransferChoices, cardTransferEffect } from '../engine/cardTransfer';
import type { CardInstance, CombatState } from '../engine/types';

/**
 * 机器人为「选择手牌中 N 张牌消耗」挑牌的规则。数字越小越先被消耗，同级按手牌顺序：
 *   0 诅咒牌和状态牌；
 *   1 打击、防御；
 *   2 本回合打不出的牌（能量或余烬不够、没有目标等）；
 *   3 其他牌。
 * 要调整机器人的取舍，只改这个函数。
 */
export function exhaustPriority(cs: CombatState, card: CardInstance): number {
  const v = viewCard(card);
  if (v.type === 'curse' || v.type === 'status') return 0;
  if (card.defId === 'strike' || card.defId === 'defend') return 1;
  if (!canPlayCard(cs, card).ok) return 2;
  return 3;
}

/** 从 hand 里按上面的优先级选 count 张，返回 uid。 */
export function chooseExhaust(cs: CombatState, hand: CardInstance[], count: number): string[] {
  return hand.map((card, index) => ({ card, index, rank: exhaustPriority(cs, card) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index).slice(0, count).map(item => item.card.uid);
}

/** 本体与每次重放各补一组选择，直到引擎不再要求；返回 undefined 表示这张牌不需要选牌。 */
function exhaustChoices(cs: CombatState, card: CardInstance, target: string | null, replayUid?: string): string[][] | undefined {
  const exhaust: string[][] = [];
  for (let guard = 0; guard < 12; guard++) {
    const pending = playCard(cs, card.uid, target, { replayUid, exhaust }).pending;
    if (!pending) break;
    exhaust.push(chooseExhaust(cs, pending.hand, pending.count));
  }
  return exhaust.length ? exhaust : undefined;
}

/** 探针用：照常出牌，遇到「选择手牌消耗」时按机器人规则补齐每一组选择。 */
export function playWithChoices(cs: CombatState, uid: string, target: string | null, replayUid?: string) {
  const card = cs.player.hand.find(c => c.uid === uid);
  const exhaust = card ? exhaustChoices(cs, card, target, replayUid) : undefined;
  return playCard(cs, uid, target, exhaust ? { replayUid, exhaust } : replayUid);
}

/** 机器人只能从公开弃牌堆、手牌和存活敌人中选择，与玩家的确认入口一致。replayUid 可直接传给 playCard。 */
export function playOptions(cs: CombatState, card: CardInstance): { target: string | null; replayUid?: string | PlayChoice }[] {
  const transferring = !!cardTransferEffect(card);
  const choices = transferring ? cardTransferChoices(cs, card) : needsDiscardReplay(card) ? discardReplayChoices(cs) : [undefined];
  return choices.flatMap(choice => {
    const v = viewCard(transferring ? card : choice ?? card);
    const targets = v.target === 'enemy' ? aliveEnemies(cs).map(e => e.id) : [null];
    return targets.map(target => {
      const exhaust = exhaustChoices(cs, card, target, choice?.uid);
      if (exhaust) return { target, replayUid: { replayUid: choice?.uid, exhaust } };
      return { target, ...(choice ? { replayUid: choice.uid } : {}) };
    });
  });
}
