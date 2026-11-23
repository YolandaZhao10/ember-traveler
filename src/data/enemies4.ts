import type { EnemyDef, EncounterDef } from '../engine/types';

export const CHAPTER_FOUR_ENEMIES: EnemyDef[] = [
  {
    id: 'last_warden', name: '终庭执卫', tier: 'elite', hp: [185, 185], sprite: 'last_warden',
    description: '最后一道守卫。先举盾施加易伤，并向抽牌堆随机塞入 1 张眩晕和 1 张缠缚，随后重斩与双击；收剑时追加一次轻斩、获得 4 力量并塞入 1 张疑惧。第二轮改用烙庭印（轻斩、格挡并施加 2 层脆弱）和裂阶三斩，八回合一个循环，只有封庭敕令不攻击。',
    moves: [
      { id: 'seal', name: '封庭敕令', intent: 'special', actions: [{ kind: 'block', amount: 16 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }, { kind: 'addCardToDraw', cardId: 'dazed', count: 1 }, { kind: 'addCardToDraw', cardId: 'tangle', count: 1 }], hardActions: [{ kind: 'attack', amount: 3 }, { kind: 'block', amount: 16 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }, { kind: 'addCardToDraw', cardId: 'dazed', count: 1 }, { kind: 'addCardToDraw', cardId: 'tangle', count: 1 }, { kind: 'status', status: 'strength', amount: 4, target: 'self' }] },
      { id: 'verdict', name: '断路重斩', intent: 'attack', actions: [{ kind: 'attack', amount: 22 }], hardActions: [{ kind: 'attack', amount: 24 }, { kind: 'block', amount: 5 }] },
      { id: 'twins', name: '守门双击', intent: 'attack', actions: [{ kind: 'attack', amount: 9, times: 2 }], hardActions: [{ kind: 'attack', amount: 10, times: 2 }] },
      { id: 'sheathe', name: '收剑封志', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 6 }, { kind: 'block', amount: 10 }, { kind: 'status', status: 'strength', amount: 4, target: 'self' }, { kind: 'addCardToDiscard', cardId: 'doubt', count: 1 }], hardActions: [{ kind: 'attack', amount: 6 }, { kind: 'block', amount: 10 }, { kind: 'status', status: 'strength', amount: 6, target: 'self' }, { kind: 'addCardToDiscard', cardId: 'doubt', count: 1 }] },
      { id: 'brand', name: '烙庭印', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 8 }, { kind: 'block', amount: 12 }, { kind: 'status', status: 'frail', amount: 2, target: 'player' }], hardActions: [{ kind: 'attack', amount: 9 }, { kind: 'block', amount: 12 }, { kind: 'status', status: 'frail', amount: 2, target: 'player' }, { kind: 'status', status: 'strength', amount: 4, target: 'self' }] },
      { id: 'sunder', name: '裂阶三斩', intent: 'attack', actions: [{ kind: 'attack', amount: 6, times: 3 }], hardActions: [{ kind: 'attack', amount: 7, times: 3 }] },
    ], chooseMove: c => ['seal', 'verdict', 'twins', 'sheathe', 'brand', 'sunder', 'verdict', 'sheathe'][c.enemy.turn % 8],
  },
  {
    id: 'nightless_lord', name: '无昼之主', tier: 'boss', hp: [430, 430], sprite: 'nightless_lord',
    description: '封存黎明的最终首领。首回合裂晓重扫造成24点基础伤害，仅使用一次；永夜屏障限制每回合的生命损失，熄光敕令也会造成伤害。半血时先轻击，再清除其他负面状态、将燃烧减半（向上取整）、获得 30 点基础格挡与 7 力量（挑战难度 9）；终夜壁垒每次再加 1 力量（挑战难度 6）。两个阶段各八回合一个循环，后四回合换成蚀日锁链、冷灰潮（一阶段）与末暮、虚空烙印（二阶段）。熄光敕令向弃牌堆塞入 1 张冷灰；终夜壁垒向弃牌堆塞入 眩晕、灼伤、黏液各 1 张。常规循环中每四轮只有终夜壁垒停止攻击，二阶段蓄盾后发动四连击。',
    maxHpLossPerTurn: 0.25,
    moves: [
      { id: 'opening', name: '裂晓重扫', intent: 'attack', actions: [{ kind: 'attack', amount: 24 }], hardActions: [{ kind: 'attack', amount: 24 }] },
      { id: 'sweep', name: '永夜横扫', intent: 'attack', actions: [{ kind: 'attack', amount: 22 }], hardActions: [{ kind: 'attack', amount: 24 }, { kind: 'block', amount: 6 }] },
      { id: 'edict', name: '熄光敕令', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 5 }, { kind: 'status', status: 'weak', amount: 2, target: 'player' }, { kind: 'addCardToDiscard', cardId: 'cold_ash', count: 1 }] },
      { id: 'pulse', name: '暗日三鸣', intent: 'attack', actions: [{ kind: 'attack', amount: 7, times: 3 }] },
      { id: 'wall', name: '终夜壁垒', intent: 'special', actions: [{ kind: 'block', amount: 24 }, { kind: 'addCardToDiscard', cardId: 'dazed', count: 1 }, { kind: 'addCardToDiscard', cardId: 'scorch', count: 1 }, { kind: 'addCardToDiscard', cardId: 'slime', count: 1 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }], hardActions: [{ kind: 'block', amount: 24 }, { kind: 'addCardToDiscard', cardId: 'dazed', count: 1 }, { kind: 'addCardToDiscard', cardId: 'scorch', count: 1 }, { kind: 'addCardToDiscard', cardId: 'slime', count: 1 }, { kind: 'status', status: 'strength', amount: 6, target: 'self' }] },
      { id: 'awaken', name: '吞没天光', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 4 }, { kind: 'clearDebuffs', keepBurnRatio: 0.5 }, { kind: 'block', amount: 30 }, { kind: 'status', status: 'strength', amount: 7, target: 'self' }], hardActions: [{ kind: 'attack', amount: 4 }, { kind: 'clearDebuffs', keepBurnRatio: 0.5 }, { kind: 'block', amount: 30 }, { kind: 'status', status: 'strength', amount: 9, target: 'self' }] },
      { id: 'nightfall', name: '长夜终临', intent: 'attack', actions: [{ kind: 'attack', amount: 29 }] },
      { id: 'extinguish', name: '四重灭灯', intent: 'attack', actions: [{ kind: 'attack', amount: 6, times: 4 }] },
      { id: 'chain', name: '蚀日锁链', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 14 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }], hardActions: [{ kind: 'attack', amount: 16 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }] },
      { id: 'tide', name: '冷灰潮', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 9, times: 2 }, { kind: 'addCardToDraw', cardId: 'cold_ash', count: 1 }], hardActions: [{ kind: 'attack', amount: 10, times: 2 }, { kind: 'addCardToDraw', cardId: 'cold_ash', count: 1 }] },
      { id: 'dusk', name: '末暮', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 18 }, { kind: 'status', status: 'frail', amount: 2, target: 'player' }], hardActions: [{ kind: 'attack', amount: 20 }, { kind: 'status', status: 'frail', amount: 2, target: 'player' }] },
      { id: 'voidbrand', name: '虚空烙印', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 10, times: 2 }, { kind: 'addCardToDiscard', cardId: 'doubt', count: 1 }], hardActions: [{ kind: 'attack', amount: 11, times: 2 }, { kind: 'addCardToDiscard', cardId: 'doubt', count: 1 }] },
    ], checkPhase: e => e.phase === 1 && e.hp <= e.maxHp / 2 ? 2 : null,
    // 两个阶段各八回合一个循环；每个循环的前四回合与原来相同。
    chooseMove: c => c.enemy.phase === 1 ? c.enemy.turn === 0 ? 'opening' : ['sweep', 'edict', 'pulse', 'wall', 'chain', 'tide', 'pulse', 'wall'][c.enemy.turn % 8]
      : !c.enemy.flags.awakened ? 'awaken' : ['nightfall', 'wall', 'extinguish', 'edict', 'dusk', 'wall', 'voidbrand', 'edict'][(c.enemy.flags.p2turn ?? 0) % 8],
  },
];
export const CHAPTER_FOUR_ENCOUNTERS: EncounterDef[] = [
  { id: 'final_elite_warden', enemies: ['last_warden'], tier: 'elite', chapter: 4 },
  { id: 'final_boss_lord', enemies: ['nightless_lord'], tier: 'boss', chapter: 4 },
];
