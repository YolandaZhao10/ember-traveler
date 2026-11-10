import type { EnemyDef, EncounterDef } from '../engine/types';

export const CHAPTER_FOUR_ENEMIES: EnemyDef[] = [
  {
    id: 'last_warden', name: '终庭执卫', tier: 'elite', hp: [185, 185], sprite: 'last_warden',
    description: '最后一道守卫。先举盾施加易伤，并向抽牌堆随机塞入 2 张眩晕，随后重斩与双击；收剑时追加一次轻斩、获得 2 力量并塞入 1 张疑惧。每四轮只有封庭敕令停止攻击。',
    moves: [
      { id: 'seal', name: '封庭敕令', intent: 'special', actions: [{ kind: 'block', amount: 16 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }, { kind: 'addCardToDraw', cardId: 'dazed', count: 2 }], hardActions: [{ kind: 'attack', amount: 3 }, { kind: 'block', amount: 16 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }, { kind: 'addCardToDraw', cardId: 'dazed', count: 2 }] },
      { id: 'verdict', name: '断路重斩', intent: 'attack', actions: [{ kind: 'attack', amount: 22 }], hardActions: [{ kind: 'attack', amount: 22 }, { kind: 'block', amount: 5 }] },
      { id: 'twins', name: '守门双击', intent: 'attack', actions: [{ kind: 'attack', amount: 9, times: 2 }] },
      { id: 'sheathe', name: '收剑封志', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 6 }, { kind: 'block', amount: 10 }, { kind: 'status', status: 'strength', amount: 2, target: 'self' }, { kind: 'addCardToDiscard', cardId: 'doubt', count: 1 }] },
    ], chooseMove: c => ['seal', 'verdict', 'twins', 'sheathe'][c.enemy.turn % 4],
  },
  {
    id: 'nightless_lord', name: '无昼之主', tier: 'boss', hp: [430, 430], sprite: 'nightless_lord',
    description: '封存黎明的最终首领。首回合裂晓重扫造成24点基础伤害，仅使用一次；永夜屏障限制每回合的生命损失，熄光敕令也会造成伤害。半血时先轻击，再清除其他负面状态、将燃烧减半（向上取整）、获得 30 点基础格挡与 3 力量。熄光敕令向弃牌堆塞入 1 张冷灰；终夜壁垒向弃牌堆塞入 3 张眩晕。常规循环中每四轮只有终夜壁垒停止攻击，二阶段蓄盾后发动四连击。',
    maxHpLossPerTurn: 0.25,
    moves: [
      { id: 'opening', name: '裂晓重扫', intent: 'attack', actions: [{ kind: 'attack', amount: 24 }], hardActions: [{ kind: 'attack', amount: 24 }] },
      { id: 'sweep', name: '永夜横扫', intent: 'attack', actions: [{ kind: 'attack', amount: 22 }], hardActions: [{ kind: 'attack', amount: 24 }, { kind: 'block', amount: 6 }] },
      { id: 'edict', name: '熄光敕令', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 5 }, { kind: 'status', status: 'weak', amount: 2, target: 'player' }, { kind: 'addCardToDiscard', cardId: 'cold_ash', count: 1 }] },
      { id: 'pulse', name: '暗日三鸣', intent: 'attack', actions: [{ kind: 'attack', amount: 7, times: 3 }] },
      { id: 'wall', name: '终夜壁垒', intent: 'special', actions: [{ kind: 'block', amount: 24 }, { kind: 'addCardToDiscard', cardId: 'dazed', count: 3 }], hardActions: [{ kind: 'block', amount: 24 }, { kind: 'addCardToDiscard', cardId: 'dazed', count: 3 }, { kind: 'status', status: 'strength', amount: 3, target: 'self' }] },
      { id: 'awaken', name: '吞没天光', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 4 }, { kind: 'clearDebuffs', keepBurnRatio: 0.5 }, { kind: 'block', amount: 30 }, { kind: 'status', status: 'strength', amount: 3, target: 'self' }] },
      { id: 'nightfall', name: '长夜终临', intent: 'attack', actions: [{ kind: 'attack', amount: 29 }] },
      { id: 'extinguish', name: '四重灭灯', intent: 'attack', actions: [{ kind: 'attack', amount: 6, times: 4 }] },
    ], checkPhase: e => e.phase === 1 && e.hp <= e.maxHp / 2 ? 2 : null,
    chooseMove: c => c.enemy.phase === 1 ? c.enemy.turn === 0 ? 'opening' : ['sweep', 'edict', 'pulse', 'wall'][c.enemy.turn % 4]
      : !c.enemy.flags.awakened ? 'awaken' : ['nightfall', 'wall', 'extinguish', 'edict'][(c.enemy.flags.p2turn ?? 0) % 4],
  },
];
export const CHAPTER_FOUR_ENCOUNTERS: EncounterDef[] = [
  { id: 'final_elite_warden', enemies: ['last_warden'], tier: 'elite', chapter: 4 },
  { id: 'final_boss_lord', enemies: ['nightless_lord'], tier: 'boss', chapter: 4 },
];
