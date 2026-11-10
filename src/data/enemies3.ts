import type { EnemyAiContext, EnemyDef, EncounterDef } from '../engine/types';

const cycle = (ctx: EnemyAiContext, order: string[]) => order[ctx.enemy.turn % order.length];

/** 星骸天穹：破甲、连击与辅助敌人的组合，需要按意图决定集火顺序。 */
export const CHAPTER_THREE_ENEMIES: EnemyDef[] = [
  {
    id: 'star_moth', name: '星砂蛾', tier: 'normal', hp: [36, 41], sprite: 'star_moth',
    description: '星砂施加 1 层脆弱，并向弃牌堆塞入 2 张眩晕；眩晕占抽牌位，留在手中会在回合结束时消耗。扑击与合翼之间仍有反攻窗口。',
    moves: [
      { id: 'dust', name: '星砂落尘', intent: 'debuff', actions: [{ kind: 'status', status: 'frail', amount: 1, target: 'player' }, { kind: 'addCardToDiscard', cardId: 'dazed', count: 2 }] },
      { id: 'flutter', name: '碎翼扑击', intent: 'attack', actions: [{ kind: 'attack', amount: 4, times: 2 }] },
      { id: 'wings', name: '合拢月翼', intent: 'defend', actions: [{ kind: 'block', amount: 8 }] },
    ], chooseMove: c => cycle(c, ['dust', 'flutter', 'wings', 'flutter']),
  },
  {
    id: 'glass_wisp', name: '碎镜灵', tier: 'normal', hp: [32, 36], sprite: 'glass_wisp',
    description: '镜片以双击切割，随后轻击并重组。死亡时使你获得 1 层虚弱。',
    moves: [
      { id: 'shards', name: '飞镜', intent: 'attack', actions: [{ kind: 'attack', amount: 4, times: 2 }] },
      { id: 'assemble', name: '聚镜', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 1 }, { kind: 'block', amount: 9 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
    ], onDeath: [{ kind: 'status', status: 'weak', amount: 1, target: 'player' }],
    chooseMove: c => cycle(c, ['shards', 'assemble', 'shards']),
  },
  {
    id: 'astral_sentinel', name: '星轨卫士', tier: 'normal', hp: [65, 73], sprite: 'astral_sentinel',
    description: '星矛在架盾后刺击，再施加易伤。盾墙回合是蓄力的机会。',
    moves: [
      { id: 'orbit', name: '环轨盾', intent: 'defend', actions: [{ kind: 'block', amount: 16 }] },
      { id: 'spear', name: '贯星', intent: 'attack', actions: [{ kind: 'attack', amount: 15 }], hardActions: [{ kind: 'attack', amount: 15 }, { kind: 'block', amount: 4 }] },
      { id: 'mark', name: '星轨标记', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 6 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }] },
    ], chooseMove: c => cycle(c, ['orbit', 'spear', 'mark', 'spear']),
  },
  {
    id: 'wind_scribe', name: '风页抄写者', tier: 'normal', hp: [46, 53], sprite: 'wind_scribe',
    description: '将 2 张眩晕插入抽牌堆随机位置，扰乱接下来的过牌；之后轻击并施加1回合脆弱，再用纸刃攻击。每四轮塞牌一次。',
    moves: [
      { id: 'page', name: '迷失书页', intent: 'debuff', actions: [{ kind: 'addCardToDraw', cardId: 'dazed', count: 2 }], hardActions: [{ kind: 'attack', amount: 2 }, { kind: 'addCardToDraw', cardId: 'dazed', count: 2 }] },
      { id: 'chorus', name: '风中合诵', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 2 }, { kind: 'status', status: 'frail', amount: 1, target: 'player' }] },
      { id: 'cut', name: '纸刃', intent: 'attack', actions: [{ kind: 'attack', amount: 9 }] },
    ], chooseMove: c => cycle(c, ['page', 'chorus', 'cut', 'cut']),
  },
  {
    id: 'comet_hound', name: '彗尾猎犬', tier: 'normal', hp: [55, 63], sprite: 'comet_hound',
    description: '首回合彗星突袭造成16点基础伤害，仅使用一次，随后嗥叫整备。扑击与三连咬交替，嗥叫时先轻击再增加 1 力量。',
    moves: [
      { id: 'opening', name: '彗星突袭', intent: 'attack', actions: [{ kind: 'attack', amount: 16 }] },
      { id: 'lunge', name: '追彗扑击', intent: 'attack', actions: [{ kind: 'attack', amount: 13 }] },
      { id: 'howl', name: '长夜嗥叫', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 2 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
      { id: 'maul', name: '星痕三噬', intent: 'attack', actions: [{ kind: 'attack', amount: 4, times: 3 }] },
    ], chooseMove: c => c.enemy.turn === 0 ? 'opening' : cycle(c, ['lunge', 'howl', 'maul']),
  },
  {
    id: 'star_pilgrim', name: '失轨朝圣者', tier: 'normal', hp: [63, 71], sprite: 'star_pilgrim',
    description: '沉重的星仪兼具武器与护甲。重击后回复 4 生命，并把 1 张破绽塞入弃牌堆，放大后续攻击的威胁。',
    moves: [
      { id: 'burden', name: '负星而行', intent: 'defend_buff', actions: [{ kind: 'block', amount: 11 }, { kind: 'status', status: 'thorns', amount: 1, target: 'self' }] },
      { id: 'fall', name: '星仪坠落', intent: 'attack', actions: [{ kind: 'attack', amount: 16 }] },
      { id: 'repair', name: '拾回星屑', intent: 'special', actions: [{ kind: 'heal', amount: 4 }, { kind: 'addCardToDiscard', cardId: 'exposure', count: 1 }] },
    ], chooseMove: c => cycle(c, ['burden', 'fall', 'repair']),
  },
  {
    id: 'moon_duelist', name: '月蚀剑侍', tier: 'elite', hp: [129, 137], sprite: 'moon_duelist',
    description: '双刃后以轻斩留下 2 层易伤，再接落月重斩。月步时先轻击，再格挡并增长 2 力量；轻击弱于重斩，下一轮连击会更强。',
    moves: [
      { id: 'twins', name: '双月斩', intent: 'attack', actions: [{ kind: 'attack', amount: 7, times: 2 }] },
      { id: 'mark', name: '蚀影印', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 5 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }] },
      { id: 'crescent', name: '落月斩', intent: 'attack', actions: [{ kind: 'attack', amount: 22 }] },
      { id: 'step', name: '月步', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 3 }, { kind: 'block', amount: 16 }, { kind: 'status', status: 'strength', amount: 2, target: 'self' }] },
    ], chooseMove: c => cycle(c, ['twins', 'mark', 'crescent', 'step']),
  },
  {
    id: 'orrery_keeper', name: '星仪守望者', tier: 'elite', hp: [98, 106], sprite: 'orrery_keeper',
    description: '两只碎镜灵与他同行，共鸣、双击、迷雾依次循环，迷雾施加虚弱并向弃牌堆塞入 2 张眩晕。随从全部倒下后，不再施放迷雾，改为每次共鸣后连续两轮双击；已显示的意图不会改变。',
    moves: [
      { id: 'align', name: '星轨共鸣', intent: 'defend_buff', actions: [{ kind: 'block', amount: 12 }, { kind: 'status', status: 'strength', amount: 1, target: 'allies' }], hardActions: [{ kind: 'attack', amount: 2 }, { kind: 'block', amount: 12 }, { kind: 'status', status: 'strength', amount: 1, target: 'allies' }] },
      { id: 'rod', name: '双星杖', intent: 'attack', actions: [{ kind: 'attack', amount: 6, times: 2 }] },
      { id: 'mist', name: '迷星雾', intent: 'debuff', actions: [{ kind: 'status', status: 'weak', amount: 1, target: 'player' }, { kind: 'addCardToDiscard', cardId: 'dazed', count: 2 }] },
    ], chooseMove: c => cycle(c, c.allies.some(ally => ally.id !== c.enemy.id && ally.hp > 0)
      ? ['align', 'rod', 'mist'] : ['align', 'rod', 'rod']),
  },
  {
    id: 'shattered_titan', name: '崩星巨像', tier: 'elite', hp: [145, 154], sprite: 'shattered_titan',
    description: '开场有 2 荆棘。蓄盾后落锤、三连击；修补时以碎岩攻击，回复 8 生命并增长 1 力量，让下一轮进攻更强。每轮只有蓄盾时停止进攻。',
    onCombatStart: () => [{ kind: 'status', status: 'thorns', amount: 2, target: 'self' }],
    moves: [
      { id: 'rise', name: '拔起星岩', intent: 'defend', actions: [{ kind: 'block', amount: 18 }] },
      { id: 'crush', name: '崩天锤', intent: 'attack', actions: [{ kind: 'attack', amount: 24 }] },
      { id: 'shower', name: '碎星雨', intent: 'attack', actions: [{ kind: 'attack', amount: 5, times: 3 }] },
      { id: 'mend', name: '重聚星骸', intent: 'attack', actions: [{ kind: 'attack', amount: 6 }, { kind: 'heal', amount: 8 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
    ], chooseMove: c => cycle(c, ['rise', 'crush', 'shower', 'mend']),
  },
  {
    id: 'eclipse_archon', name: '坠星司辰', tier: 'boss', hp: [290, 290], sprite: 'eclipse_archon',
    description: '拨动星轨的天穹君王。半血进入日蚀：清除负面状态、获得 28 点基础格挡与 3 力量，同时自身获得2层虚弱，让转阶段后的第一次攻击减伤。星尘帷幕施加脆弱并向抽牌堆随机塞入 2 张眩晕；日蚀转阶段时仅向弃牌堆塞入 1 张疑惧一次；之后重斩、帷幕、三连击与屏障循环；屏障回合可以整备，展开屏障时自身获得2层易伤，下一玩家回合可趁隙爆发。',
    moves: [
      { id: 'scythe', name: '弦月镰', intent: 'attack', actions: [{ kind: 'attack', amount: 19 }] },
      { id: 'veil', name: '星尘帷幕', intent: 'debuff', actions: [{ kind: 'status', status: 'frail', amount: 2, target: 'player' }, { kind: 'addCardToDraw', cardId: 'dazed', count: 2 }], hardActions: [{ kind: 'attack', amount: 3 }, { kind: 'status', status: 'frail', amount: 2, target: 'player' }, { kind: 'addCardToDraw', cardId: 'dazed', count: 2 }] },
      { id: 'orbits', name: '双轨交错', intent: 'attack', actions: [{ kind: 'attack', amount: 10, times: 2 }] },
      { id: 'shell', name: '天穹屏障', intent: 'defend', actions: [{ kind: 'block', amount: 24 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'self' }] },
      { id: 'awaken', name: '日蚀降临', intent: 'special', actions: [{ kind: 'clearDebuffs' }, { kind: 'block', amount: 28 }, { kind: 'status', status: 'weak', amount: 2, target: 'self' }, { kind: 'status', status: 'strength', amount: 3, target: 'self' }, { kind: 'addCardToDiscard', cardId: 'doubt', count: 1 }] },
      { id: 'eclipse', name: '坠星裁决', intent: 'attack', actions: [{ kind: 'attack', amount: 23 }] },
      { id: 'rain', name: '群星陨落', intent: 'attack', actions: [{ kind: 'attack', amount: 7, times: 3 }] },
    ], checkPhase: e => e.phase === 1 && e.hp <= e.maxHp / 2 ? 2 : null,
    chooseMove: c => c.enemy.phase === 1 ? cycle(c, ['scythe', 'veil', 'orbits', 'shell']) : !c.enemy.flags.awakened ? 'awaken' : ['eclipse', 'veil', 'rain', 'shell'][(c.enemy.flags.p2turn ?? 0) % 4],
  },
];

export const CHAPTER_THREE_ENCOUNTERS: EncounterDef[] = [
  { id: 'sky_sentinel', enemies: ['astral_sentinel'], tier: 'normal', maxFloor: 4, chapter: 3 },
  { id: 'sky_moths', enemies: ['star_moth', 'star_moth'], tier: 'normal', maxFloor: 4, chapter: 3 },
  { id: 'sky_pilgrim', enemies: ['star_pilgrim'], tier: 'normal', maxFloor: 3, chapter: 3 },
  { id: 'sky_hound', enemies: ['comet_hound'], tier: 'normal', maxFloor: 3, chapter: 3 },
  { id: 'sky_scribe_moth', enemies: ['wind_scribe', 'star_moth'], tier: 'normal', minFloor: 2, chapter: 3 },
  { id: 'sky_mirrors', enemies: ['glass_wisp', 'glass_wisp'], tier: 'normal', minFloor: 3, chapter: 3 },
  { id: 'sky_sentinel_scribe', enemies: ['astral_sentinel', 'wind_scribe'], tier: 'normal', minFloor: 4, chapter: 3 },
  { id: 'sky_hound_mirror', enemies: ['comet_hound', 'glass_wisp'], tier: 'normal', minFloor: 5, chapter: 3 },
  { id: 'sky_pilgrim_scribe', enemies: ['star_pilgrim', 'wind_scribe'], tier: 'normal', minFloor: 6, chapter: 3 },
  { id: 'sky_scribe_swarm', enemies: ['wind_scribe', 'star_moth', 'star_moth'], tier: 'normal', minFloor: 6, chapter: 3 },
  { id: 'sky_elite_duelist', enemies: ['moon_duelist'], tier: 'elite', chapter: 3 },
  { id: 'sky_elite_keeper', enemies: ['orrery_keeper', 'glass_wisp', 'glass_wisp'], tier: 'elite', chapter: 3 },
  { id: 'sky_elite_titan', enemies: ['shattered_titan'], tier: 'elite', chapter: 3 },
  { id: 'sky_boss_archon', enemies: ['eclipse_archon'], tier: 'boss', chapter: 3 },
];
