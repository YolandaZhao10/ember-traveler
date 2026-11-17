import type { ChapterId, EnemyAiContext, EnemyDef } from '../engine/types';

const cycle = (c: EnemyAiContext, moves: string[]) => moves[c.enemy.turn % moves.length];
const ORDER = ['notice', 'compound', 'interest', 'enforce'];

interface CollectorNumbers {
  hp: number;
  /** 催告：伤害与施加给玩家的减益。 */
  notice: number; weak?: number; frail?: number;
  /** 利滚利：每段伤害与段数。 */
  compound: [number, number];
  /** 加息：格挡与力量。 */
  block: number; strength: number;
  /** 强制执行：单段重击。 */
  enforce: number;
}

/**
 * 讨债人：生命为该章首领的一半，前八回合平均伤害约为首领的 90%～110%（基础值，倍率与首领相同）。
 * 只用攻击、多段、格挡、力量成长和减益；不转阶段、不塞牌、不召唤、不逃跑、不偷金币。
 */
const NUMBERS: Record<ChapterId, CollectorNumbers> = {
  1: { hp: 69, notice: 8, weak: 1, compound: [5, 2], block: 8, strength: 1, enforce: 14 },
  2: { hp: 116, notice: 9, frail: 1, compound: [4, 3], block: 12, strength: 1, enforce: 14 },
  3: { hp: 145, notice: 12, weak: 2, compound: [7, 2], block: 16, strength: 2, enforce: 18 },
  4: { hp: 215, notice: 14, weak: 1, frail: 1, compound: [6, 3], block: 20, strength: 2, enforce: 24 },
};

export const debtCollectorId = (chapter: ChapterId) => `debt_collector_${chapter}`;

function collector(chapter: ChapterId): EnemyDef {
  const n = NUMBERS[chapter];
  const debuffs = [n.weak ? `${n.weak} 层虚弱` : '', n.frail ? `${n.frail} 层脆弱` : ''].filter(Boolean).join('和');
  return {
    id: debtCollectorId(chapter), name: '讨债人', tier: 'normal', hp: [n.hp, n.hp], sprite: 'taxman',
    description: `灰雾商人雇来收账的人。催告造成伤害并施加${debuffs}，随后利滚利连击、加息获得格挡与 ${n.strength} 点力量，再强制执行重击，四招循环。拖得越久越疼；不会逃跑，也不碰你的金币。`,
    moves: [
      { id: 'notice', name: '催告', intent: 'attack_debuff', actions: [
        { kind: 'attack', amount: n.notice },
        ...(n.weak ? [{ kind: 'status' as const, status: 'weak' as const, amount: n.weak, target: 'player' as const }] : []),
        ...(n.frail ? [{ kind: 'status' as const, status: 'frail' as const, amount: n.frail, target: 'player' as const }] : []),
      ] },
      { id: 'compound', name: '利滚利', intent: 'attack', actions: [{ kind: 'attack', amount: n.compound[0], times: n.compound[1] }] },
      { id: 'interest', name: '加息', intent: 'defend_buff', actions: [{ kind: 'block', amount: n.block }, { kind: 'status', status: 'strength', amount: n.strength, target: 'self' }] },
      { id: 'enforce', name: '强制执行', intent: 'attack', actions: [{ kind: 'attack', amount: n.enforce }] },
    ],
    chooseMove: c => cycle(c, ORDER),
  };
}

export const DEBT_COLLECTORS: EnemyDef[] = ([1, 2, 3, 4] as ChapterId[]).map(collector);
