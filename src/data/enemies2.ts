import type { EnemyAiContext, EnemyDef, EncounterDef } from '../engine/types';

const cycle = (ctx: EnemyAiContext, order: string[]) => order[ctx.enemy.turn % order.length];

/** 熔炉深城的独立敌人、形象与遭遇。 */
export const CHAPTER_TWO_ENEMIES: EnemyDef[] = [
  {
    id: 'slag_tick', name: '炉渣虫', tier: 'normal', hp: [22, 26], sprite: 'slag_tick',
    description: '蜷在炉灰里的小虫。先喷出灼火再扑咬，死亡时给你施加 1 层燃烧。',
    moves: [
      { id: 'spit', name: '喷渣', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 4 }, { kind: 'status', status: 'burn', amount: 1, target: 'player' }] },
      { id: 'bite', name: '炽咬', intent: 'attack', actions: [{ kind: 'attack', amount: 7 }] },
    ],
    onDeath: [{ kind: 'status', status: 'burn', amount: 1, target: 'player' }],
    chooseMove: ctx => cycle(ctx, ['spit', 'bite']),
  },
  {
    id: 'furnace_drone', name: '铸铁傀儡', tier: 'normal', hp: [40, 46], sprite: 'furnace_drone',
    description: '撑起铁壳时排出冷灰，向弃牌堆塞入 1 张冷灰，干扰余烬积累；随后连续挥锤。',
    moves: [
      { id: 'shell', name: '排灰铁壳', intent: 'special', actions: [{ kind: 'block', amount: 10 }, { kind: 'addCardToDiscard', cardId: 'cold_ash', count: 1 }] },
      { id: 'hammer', name: '铸锤', intent: 'attack', actions: [{ kind: 'attack', amount: 13 }] },
      { id: 'pound', name: '连锤', intent: 'attack', actions: [{ kind: 'attack', amount: 6, times: 2 }] },
    ],
    chooseMove: ctx => cycle(ctx, ['shell', 'hammer', 'pound']),
  },
  {
    id: 'chain_guard', name: '锁链卫兵', tier: 'normal', hp: [44, 50], sprite: 'chain_guard',
    description: '空甲由锁链牵引。束缚施加 2 层易伤，下一击尤其危险；收链时可以反攻。',
    moves: [
      { id: 'bind', name: '束缚', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 5 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }] },
      { id: 'pull', name: '拖拽斩', intent: 'attack', actions: [{ kind: 'attack', amount: 12 }] },
      { id: 'coil', name: '收链', intent: 'defend', actions: [{ kind: 'block', amount: 10 }] },
    ],
    chooseMove: ctx => cycle(ctx, ['bind', 'pull', 'coil']),
  },
  {
    id: 'cinder_stoker', name: '添火侍从', tier: 'normal', hp: [32, 36], sprite: 'cinder_stoker',
    description: '添火为所有同伴增加 1 力量，挥钳后扬起 1 张冷灰塞入弃牌堆，再挥钳。每四次行动强化一次。',
    moves: [
      { id: 'stoke', name: '添火', intent: 'buff', actions: [{ kind: 'status', status: 'strength', amount: 1, target: 'allies' }] },
      { id: 'coal', name: '扬起冷灰', intent: 'debuff', actions: [{ kind: 'addCardToDiscard', cardId: 'cold_ash', count: 1 }] },
      { id: 'rake', name: '火钳', intent: 'attack', actions: [{ kind: 'attack', amount: 7 }] },
    ],
    chooseMove: ctx => cycle(ctx, ['stoke', 'rake', 'coal', 'rake']),
  },
  {
    id: 'soot_seer', name: '烟尘先知', tier: 'normal', hp: [36, 40], sprite: 'soot_seer',
    description: '从黑烟中预言炉心的苏醒。烟幕混入一张疑惧，接着攻击并使你虚弱。',
    moves: [
      { id: 'smoke', name: '烟幕', intent: 'debuff', actions: [{ kind: 'addCardToDiscard', cardId: 'doubt', count: 1 }] },
      { id: 'gaze', name: '灼目', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 8 }, { kind: 'status', status: 'weak', amount: 1, target: 'player' }] },
      { id: 'flare', name: '黑焰', intent: 'attack', actions: [{ kind: 'attack', amount: 11 }] },
    ],
    chooseMove: ctx => cycle(ctx, ['smoke', 'gaze', 'flare']),
  },
  {
    id: 'iron_hound', name: '铁颚猎兽', tier: 'normal', hp: [38, 44], sprite: 'iron_hound',
    description: '以齿轮为关节的猎兽。扑咬后蓄力，下次连咬会更疼。',
    moves: [
      { id: 'pounce', name: '扑咬', intent: 'attack', actions: [{ kind: 'attack', amount: 10 }] },
      { id: 'coil', name: '绷紧发条', intent: 'buff', actions: [{ kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
      { id: 'maul', name: '铁颚连咬', intent: 'attack', actions: [{ kind: 'attack', amount: 5, times: 2 }] },
    ],
    chooseMove: ctx => cycle(ctx, ['pounce', 'coil', 'maul']),
  },
  {
    id: 'forge_knight', name: '锻炉骑士', tier: 'elite', hp: [96, 104], sprite: 'forge_knight',
    description: '护甲尚未冷却的骑士。开场有 2 层荆棘；格挡、重斩、连斩依次循环。',
    onCombatStart: () => [{ kind: 'status', status: 'thorns', amount: 2, target: 'self' }],
    moves: [
      { id: 'temper', name: '淬甲', intent: 'defend', actions: [{ kind: 'block', amount: 16 }] },
      { id: 'cleave', name: '熔钢斩', intent: 'attack', actions: [{ kind: 'attack', amount: 17 }] },
      { id: 'double', name: '双重锻击', intent: 'attack', actions: [{ kind: 'attack', amount: 7, times: 2 }] },
    ],
    chooseMove: ctx => cycle(ctx, ['temper', 'cleave', 'double']),
  },
  {
    id: 'kiln_overseer', name: '炉窑监工', tier: 'elite', hp: [78, 86], sprite: 'kiln_overseer',
    description: '带着两只炉渣虫巡查的监工。号令强化同伴，炙杖连击之后会短暂休整。',
    moves: [
      { id: 'order', name: '催炉令', intent: 'buff', actions: [{ kind: 'status', status: 'strength', amount: 1, target: 'allies' }] },
      { id: 'rod', name: '炙杖', intent: 'attack', actions: [{ kind: 'attack', amount: 5, times: 2 }] },
      { id: 'guard', name: '炉灰屏障', intent: 'defend', actions: [{ kind: 'block', amount: 12 }] },
    ],
    chooseMove: ctx => cycle(ctx, ['order', 'rod', 'guard']),
  },
  {
    id: 'slag_colossus', name: '熔渣巨像', tier: 'elite', hp: [108, 116], sprite: 'slag_colossus',
    description: '熔渣凝结成的重型躯壳。积蓄力量后重击；修补时回复 6 点生命。',
    moves: [
      { id: 'gather', name: '聚渣', intent: 'defend_buff', actions: [{ kind: 'block', amount: 8 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
      { id: 'crush', name: '塌炉', intent: 'attack', actions: [{ kind: 'attack', amount: 20 }] },
      { id: 'mend', name: '熔接', intent: 'special', actions: [{ kind: 'heal', amount: 6 }] },
    ],
    chooseMove: ctx => cycle(ctx, ['gather', 'crush', 'mend']),
  },
  {
    id: 'everburning_core', name: '永燃炉心', tier: 'boss', hp: [220, 220], sprite: 'everburning_core',
    description: '深城的动力核心。泄压时混入冷灰并点燃你；半血后进入过载，清除负面状态、获得 20 格挡与 1 力量，随后在爆燃后重铸外壳，留出进攻窗口。',
    moves: [
      { id: 'pressure', name: '高压冲击', intent: 'attack', actions: [{ kind: 'attack', amount: 15 }] },
      { id: 'vent', name: '炉心泄压', intent: 'debuff', actions: [{ kind: 'status', status: 'burn', amount: 2, target: 'player' }, { kind: 'addCardToDiscard', cardId: 'cold_ash', count: 1 }] },
      { id: 'pistons', name: '双缸锻击', intent: 'attack', actions: [{ kind: 'attack', amount: 8, times: 2 }] },
      { id: 'shell', name: '重铸外壳', intent: 'defend', actions: [{ kind: 'block', amount: 16 }] },
      { id: 'overdrive', name: '炉心过载', intent: 'special', actions: [{ kind: 'clearDebuffs' }, { kind: 'block', amount: 20 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
      { id: 'eruption', name: '熔流喷发', intent: 'attack', actions: [{ kind: 'attack', amount: 19 }] },
      { id: 'cascade', name: '连环爆燃', intent: 'attack', actions: [{ kind: 'attack', amount: 6, times: 3 }] },
    ],
    checkPhase: e => e.phase === 1 && e.hp <= e.maxHp / 2 ? 2 : null,
    chooseMove: ctx => ctx.enemy.phase === 1 ? cycle(ctx, ['pressure', 'vent', 'pistons', 'shell'])
      : !ctx.enemy.flags.awakened ? 'overdrive' : ['eruption', 'vent', 'cascade', 'shell'][(ctx.enemy.flags.p2turn ?? 0) % 4],
  },
];

export const CHAPTER_TWO_ENCOUNTERS: EncounterDef[] = [
  { id: 'deep_drone', enemies: ['furnace_drone'], tier: 'normal', maxFloor: 3, chapter: 2 },
  { id: 'deep_ticks', enemies: ['slag_tick', 'slag_tick'], tier: 'normal', maxFloor: 4, chapter: 2 },
  { id: 'deep_guard', enemies: ['chain_guard'], tier: 'normal', maxFloor: 4, chapter: 2 },
  { id: 'deep_hound', enemies: ['iron_hound'], tier: 'normal', maxFloor: 3, chapter: 2 },
  { id: 'deep_stoker_tick', enemies: ['cinder_stoker', 'slag_tick'], tier: 'normal', minFloor: 2, chapter: 2 },
  { id: 'deep_seer', enemies: ['soot_seer', 'slag_tick'], tier: 'normal', minFloor: 3, chapter: 2 },
  { id: 'deep_drone_stoker', enemies: ['furnace_drone', 'cinder_stoker'], tier: 'normal', minFloor: 4, chapter: 2 },
  { id: 'deep_hounds', enemies: ['iron_hound', 'iron_hound'], tier: 'normal', minFloor: 5, chapter: 2 },
  { id: 'deep_guard_seer', enemies: ['chain_guard', 'soot_seer'], tier: 'normal', minFloor: 6, chapter: 2 },
  { id: 'deep_stoker_ticks', enemies: ['cinder_stoker', 'slag_tick', 'slag_tick'], tier: 'normal', minFloor: 6, chapter: 2 },
  { id: 'deep_elite_knight', enemies: ['forge_knight'], tier: 'elite', chapter: 2 },
  { id: 'deep_elite_overseer', enemies: ['kiln_overseer', 'slag_tick', 'slag_tick'], tier: 'elite', chapter: 2 },
  { id: 'deep_elite_colossus', enemies: ['slag_colossus'], tier: 'elite', chapter: 2 },
  { id: 'deep_boss_core', enemies: ['everburning_core'], tier: 'boss', chapter: 2 },
];
