import { viewCard } from '../engine/cards';
import { aliveEnemies, discardReplayChoices, needsDiscardReplay } from '../engine/combat';
import type { CardInstance, CombatState } from '../engine/types';

/** 机器人只能从公开弃牌堆和存活敌人中选择，与玩家的确认入口一致。 */
export function playOptions(cs: CombatState, card: CardInstance): { target: string | null; replayUid?: string }[] {
  const choices = needsDiscardReplay(card) ? discardReplayChoices(cs) : [undefined];
  return choices.flatMap(choice => {
    const v = viewCard(choice ?? card);
    const targets = v.target === 'enemy' ? aliveEnemies(cs).map(e => e.id) : [null];
    return targets.map(target => ({ target, ...(choice ? { replayUid: choice.uid } : {}) }));
  });
}
