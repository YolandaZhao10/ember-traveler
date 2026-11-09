import type { EnemyAiContext, EnemyDef, EncounterDef } from '../engine/types';

const cycle = (ctx: EnemyAiContext, order: string[]) => order[ctx.enemy.turn % order.length];

/** 星骸天穹：破甲、连击与辅助敌人的组合，需要按意图决定集火顺序。 */
export const CHAPTER_THREE_ENEMIES: EnemyDef[] = [
  {
    id: 'star_moth', name: '星砂蛾', tier: 'normal', hp: [28, 32], sprite: 'star_moth',
    description: '星砂施加 1 层脆弱并塞入 1 张朽败，持续干扰防御；扑击与合翼之间仍有反攻窗口。',
    moves: [
      { id: 'dust', name: '星砂落尘', intent: 'debuff', actions: [{ kind: 'status', status: 'frail', amount: 1, target: 'player' }, { kind: 'addCardToDiscard', cardId: 'frailty', count: 1 }] },
      { id: 'flutter', name: '碎翼扑击', intent: 'attack', actions: [{ kind: 'attack', amount: 4, times: 2 }] },
      { id: 'wings', name: '合拢月翼', intent: 'defend', actions: [{ kind: 'block', amount: 7 }] },
    ], chooseMove: c => cycle(c, ['dust', 'flutter', 'wings', 'flutter']),
  },
  {
    id: 'glass_wisp', name: '碎镜灵', tier: 'normal', hp: [32, 36], sprite: 'glass_wisp',
    description: '镜片以双击切割，随后重组。死亡时使你获得 1 层虚弱。',
    moves: [
      { id: 'shards', name: '飞镜', intent: 'attack', actions: [{ kind: 'attack', amount: 4, times: 2 }] },
      { id: 'assemble', name: '聚镜', intent: 'defend_buff', actions: [{ kind: 'block', amount: 8 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
    ], onDeath: [{ kind: 'status', status: 'weak', amount: 1, target: 'player' }],
    chooseMove: c => cycle(c, ['shards', 'assemble', 'shards']),
  },
  {
    id: 'astral_sentinel', name: '星轨卫士', tier: 'normal', hp: [52, 58], sprite: 'astral_sentinel',
    description: '星矛在架盾后刺击，再施加易伤。盾墙回合是蓄力的机会。',
    moves: [
      { id: 'orbit', name: '环轨盾', intent: 'defend', actions: [{ kind: 'block', amount: 14 }] },
      { id: 'spear', name: '贯星', intent: 'attack', actions: [{ kind: 'attack', amount: 14 }] },
      { id: 'mark', name: '星轨标记', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 6 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }] },
    ], chooseMove: c => cycle(c, ['orbit', 'spear', 'mark', 'spear']),
  },
  {
    id: 'wind_scribe', name: '风页抄写者', tier: 'normal', hp: [37, 42], sprite: 'wind_scribe',
    description: '将朽败写入弃牌堆，之后为所有同伴增加力量；独处时也能用风页攻击。',
    moves: [
      { id: 'page', name: '朽页', intent: 'debuff', actions: [{ kind: 'addCardToDiscard', cardId: 'frailty', count: 1 }] },
      { id: 'chorus', name: '风中合诵', intent: 'buff', actions: [{ kind: 'status', status: 'strength', amount: 1, target: 'allies' }] },
      { id: 'cut', name: '纸刃', intent: 'attack', actions: [{ kind: 'attack', amount: 8 }] },
    ], chooseMove: c => cycle(c, ['page', 'chorus', 'cut', 'cut']),
  },
  {
    id: 'comet_hound', name: '彗尾猎犬', tier: 'normal', hp: [44, 50], sprite: 'comet_hound',
    description: '扑击与三连咬交替，嗥叫时增加 1 力量并暂停攻击。',
    moves: [
      { id: 'lunge', name: '追彗扑击', intent: 'attack', actions: [{ kind: 'attack', amount: 12 }] },
      { id: 'howl', name: '长夜嗥叫', intent: 'buff', actions: [{ kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
      { id: 'maul', name: '星痕三噬', intent: 'attack', actions: [{ kind: 'attack', amount: 4, times: 3 }] },
    ], chooseMove: c => cycle(c, ['lunge', 'howl', 'maul']),
  },
  {
    id: 'star_pilgrim', name: '失轨朝圣者', tier: 'normal', hp: [50, 56], sprite: 'star_pilgrim',
    description: '沉重的星仪兼具武器与护甲。重击后回复 4 生命，并把 1 张破绽塞入弃牌堆，放大后续攻击的威胁。',
    moves: [
      { id: 'burden', name: '负星而行', intent: 'defend_buff', actions: [{ kind: 'block', amount: 10 }, { kind: 'status', status: 'thorns', amount: 1, target: 'self' }] },
      { id: 'fall', name: '星仪坠落', intent: 'attack', actions: [{ kind: 'attack', amount: 15 }] },
      { id: 'repair', name: '拾回星屑', intent: 'special', actions: [{ kind: 'heal', amount: 4 }, { kind: 'addCardToDiscard', cardId: 'exposure', count: 1 }] },
    ], chooseMove: c => cycle(c, ['burden', 'fall', 'repair']),
  },
  {
    id: 'moon_duelist', name: '月蚀剑侍', tier: 'elite', hp: [112, 120], sprite: 'moon_duelist',
    description: '双刃、标记与重斩依次发动。月步时只格挡并增长力量，注意下一轮连击。',
    moves: [
      { id: 'twins', name: '双月斩', intent: 'attack', actions: [{ kind: 'attack', amount: 7, times: 2 }] },
      { id: 'mark', name: '蚀影印', intent: 'debuff', actions: [{ kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }] },
      { id: 'crescent', name: '落月斩', intent: 'attack', actions: [{ kind: 'attack', amount: 21 }] },
      { id: 'step', name: '月步', intent: 'defend_buff', actions: [{ kind: 'block', amount: 14 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
    ], chooseMove: c => cycle(c, ['twins', 'mark', 'crescent', 'step']),
  },
  {
    id: 'orrery_keeper', name: '星仪守望者', tier: 'elite', hp: [92, 100], sprite: 'orrery_keeper',
    description: '两只碎镜灵与他同行。校准星轨会强化所有同伴，随后以星杖发动双击。',
    moves: [
      { id: 'align', name: '星轨共鸣', intent: 'defend_buff', actions: [{ kind: 'block', amount: 12 }, { kind: 'status', status: 'strength', amount: 1, target: 'allies' }] },
      { id: 'rod', name: '双星杖', intent: 'attack', actions: [{ kind: 'attack', amount: 6, times: 2 }] },
      { id: 'mist', name: '迷星雾', intent: 'debuff', actions: [{ kind: 'status', status: 'weak', amount: 1, target: 'player' }] },
    ], chooseMove: c => cycle(c, ['align', 'rod', 'mist']),
  },
  {
    id: 'shattered_titan', name: '崩星巨像', tier: 'elite', hp: [132, 140], sprite: 'shattered_titan',
    description: '开场有 2 荆棘。先蓄盾，落锤后散出镜片，修补时短暂停止进攻。',
    onCombatStart: () => [{ kind: 'status', status: 'thorns', amount: 2, target: 'self' }],
    moves: [
      { id: 'rise', name: '拔起星岩', intent: 'defend', actions: [{ kind: 'block', amount: 18 }] },
      { id: 'crush', name: '崩天锤', intent: 'attack', actions: [{ kind: 'attack', amount: 24 }] },
      { id: 'shower', name: '碎星雨', intent: 'attack', actions: [{ kind: 'attack', amount: 5, times: 3 }] },
      { id: 'mend', name: '重聚星骸', intent: 'special', actions: [{ kind: 'heal', amount: 8 }] },
    ], chooseMove: c => cycle(c, ['rise', 'crush', 'shower', 'mend']),
  },
  {
    id: 'eclipse_archon', name: '坠星司辰', tier: 'boss', hp: [260, 260], sprite: 'eclipse_archon',
    description: '拨动星轨的天穹君王。半血进入日蚀：清除负面状态、获得 24 格挡与 2 力量。之后重斩、星尘帷幕、三连击与屏障循环；屏障回合可以整备。',
    moves: [
      { id: 'scythe', name: '弦月镰', intent: 'attack', actions: [{ kind: 'attack', amount: 18 }] },
      { id: 'veil', name: '星尘帷幕', intent: 'debuff', actions: [{ kind: 'status', status: 'frail', amount: 2, target: 'player' }, { kind: 'addCardToDiscard', cardId: 'doubt', count: 1 }] },
      { id: 'orbits', name: '双轨交错', intent: 'attack', actions: [{ kind: 'attack', amount: 9, times: 2 }] },
      { id: 'shell', name: '天穹屏障', intent: 'defend', actions: [{ kind: 'block', amount: 20 }] },
      { id: 'awaken', name: '日蚀降临', intent: 'special', actions: [{ kind: 'clearDebuffs' }, { kind: 'block', amount: 24 }, { kind: 'status', status: 'strength', amount: 2, target: 'self' }] },
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
