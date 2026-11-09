import type { EnemyAiContext, EnemyDef, EncounterDef } from '../engine/types';

const last = (c: EnemyAiContext) => c.enemy.moveHistory[c.enemy.moveHistory.length - 1];
const cycle = (c: EnemyAiContext, moves: string[]) => moves[c.enemy.turn % moves.length];

/** 前三章各三种普通敌人。条件只在选择下一意图时判断，玩家出牌期间不变招。 */
export const EXTRA_ENEMIES: EnemyDef[] = [
  {
    id: 'ash_crossbow', name: '灰巷弩手', tier: 'normal', hp: [30, 34], sprite: 'ash_crossbow',
    description: '架弩时自身获得2层易伤，随后射出重矢，再用短刀掩护装填。抓住架弩后暴露的回合抢攻。',
    moves: [
      { id: 'aim', name: '架弩露隙', intent: 'special', actions: [{ kind: 'status', status: 'vulnerable', amount: 2, target: 'self' }] },
      { id: 'bolt', name: '穿街重矢', intent: 'attack', actions: [{ kind: 'attack', amount: 14 }] },
      { id: 'reload', name: '装填短刺', intent: 'attack', actions: [{ kind: 'attack', amount: 4 }] },
    ], chooseMove: c => cycle(c, ['aim', 'bolt', 'reload']),
  },
  {
    id: 'ash_duelist', name: '灰衣决斗者', tier: 'normal', hp: [34, 38], sprite: 'ash_duelist',
    description: '斩击后准备反击架势：获得7格挡与2荆棘，下次回斩前移除这2荆棘。若选招时你的格挡至少8，改用佯攻施加脆弱。已显示的意图不会临时改变。',
    moves: [
      { id: 'slash', name: '试探斩', intent: 'attack', actions: [{ kind: 'attack', amount: 9 }] },
      { id: 'parry', name: '反击架势', intent: 'defend_buff', actions: [{ kind: 'block', amount: 7 }, { kind: 'status', status: 'thorns', amount: 2, target: 'self' }] },
      { id: 'riposte', name: '收势回斩', intent: 'attack', actions: [{ kind: 'status', status: 'thorns', amount: -2, target: 'self' }, { kind: 'attack', amount: 9 }] },
      { id: 'feint', name: '绕盾佯攻', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 5 }, { kind: 'status', status: 'frail', amount: 1, target: 'player' }] },
    ], chooseMove: c => last(c) === 'parry' ? 'riposte' : last(c) === 'slash' ? (c.player.block >= 8 ? 'feint' : 'parry') : 'slash',
  },
  {
    id: 'grave_lamplighter', name: '守灯人', tier: 'normal', hp: [24, 28], sprite: 'grave_lamplighter',
    description: '以灯火治疗生命比例最低的存活敌人6点（包括自身），随后敲击、扬灰削弱。治疗每三次行动一次，优先集火可以切断救援。',
    moves: [
      { id: 'mend', name: '扶灯救护', intent: 'buff', actions: [{ kind: 'healWeakest', amount: 6 }] },
      { id: 'knock', name: '灯杆敲击', intent: 'attack', actions: [{ kind: 'attack', amount: 5 }] },
      { id: 'ash', name: '扬灰遮目', intent: 'debuff', actions: [{ kind: 'status', status: 'weak', amount: 1, target: 'player' }] },
    ], chooseMove: c => cycle(c, ['knock', 'mend', 'ash']),
  },
  {
    id: 'pressure_boiler', name: '游走压力釜', tier: 'normal', hp: [48, 54], sprite: 'pressure_boiler',
    description: '加压获得8格挡与2力量，喷汽后移除这2力量并自损5生命（不会自杀）；冷却时轻击并暴露2层易伤。爆发后是反攻窗口。',
    moves: [
      { id: 'pressure', name: '封阀加压', intent: 'defend_buff', actions: [{ kind: 'block', amount: 8 }, { kind: 'status', status: 'strength', amount: 2, target: 'self' }] },
      { id: 'vent', name: '超压喷汽', intent: 'attack', actions: [{ kind: 'attack', amount: 16 }, { kind: 'status', status: 'strength', amount: -2, target: 'self' }, { kind: 'loseHp', amount: 5 }] },
      { id: 'cool', name: '开阀冷却', intent: 'attack', actions: [{ kind: 'attack', amount: 5 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'self' }] },
    ], chooseMove: c => cycle(c, ['pressure', 'vent', 'cool']),
  },
  {
    id: 'quench_smith', name: '淬火匠', tier: 'normal', hp: [38, 44], sprite: 'quench_smith',
    description: '交替锤击与护身锤。选招时若正在燃烧，会改为淬火：净化自身并获得6格挡，两次淬火之间至少两次其他行动。可在淬火后重新点燃。',
    moves: [
      { id: 'hammer', name: '锻打', intent: 'attack', actions: [{ kind: 'attack', amount: 11 }] },
      { id: 'guard', name: '护身锤', intent: 'attack', actions: [{ kind: 'attack', amount: 6 }, { kind: 'block', amount: 6 }] },
      { id: 'quench', name: '浸水淬火', intent: 'defend', actions: [{ kind: 'clearDebuffs' }, { kind: 'block', amount: 6 }] },
    ], chooseMove: c => (c.enemy.statuses.burn ?? 0) > 0 && !c.enemy.moveHistory.slice(-2).includes('quench')
      ? 'quench' : last(c) === 'hammer' ? 'guard' : 'hammer',
  },
  {
    id: 'slag_saw', name: '炉轨锯轮', tier: 'normal', hp: [40, 46], sprite: 'slag_saw',
    description: '三连试切后磨齿增加2力量，再发动五连锯，随后移除这2力量。卡齿回合只防御并使自身虚弱，荆棘与减伤能克制密集连击。',
    moves: [
      { id: 'cut', name: '三齿试切', intent: 'attack', actions: [{ kind: 'attack', amount: 3, times: 3 }] },
      { id: 'sharpen', name: '磨齿提速', intent: 'buff', actions: [{ kind: 'status', status: 'strength', amount: 2, target: 'self' }] },
      { id: 'saw', name: '五齿连锯', intent: 'attack', actions: [{ kind: 'attack', amount: 2, times: 5 }, { kind: 'status', status: 'strength', amount: -2, target: 'self' }] },
      { id: 'jam', name: '卡齿停转', intent: 'defend', actions: [{ kind: 'block', amount: 5 }, { kind: 'status', status: 'weak', amount: 2, target: 'self' }] },
    ], chooseMove: c => cycle(c, ['cut', 'sharpen', 'saw', 'jam']),
  },
  {
    id: 'sealed_archivist', name: '禁页看守', tier: 'normal', hp: [46, 52], sprite: 'sealed_archivist',
    description: '仅开场行动塞入1张会保留的重负（只限本场），随后斩页、封书防护、双刃轮换。弃置或消耗重负可解放手牌空间。',
    moves: [
      { id: 'seal', name: '禁页封存', intent: 'debuff', actions: [{ kind: 'addCardToDiscard', cardId: 'burden', count: 1 }] },
      { id: 'cut', name: '断章斩', intent: 'attack', actions: [{ kind: 'attack', amount: 12 }] },
      { id: 'close', name: '合卷禁声', intent: 'defend_buff', actions: [{ kind: 'block', amount: 9 }, { kind: 'status', status: 'weak', amount: 1, target: 'player' }] },
      { id: 'twins', name: '禁页双刃', intent: 'attack', actions: [{ kind: 'attack', amount: 5, times: 2 }] },
    ], chooseMove: c => c.enemy.turn === 0 ? 'seal' : ['cut', 'close', 'twins'][(c.enemy.turn - 1) % 3],
  },
  {
    id: 'phase_lancer', name: '隙星枪客', tier: 'normal', hp: [44, 50], sprite: 'phase_lancer',
    description: '锁定时自身获得2层易伤，下一枪造成8点基础穿透伤害、无视格挡，再接普通横扫。穿透仍受力量、虚弱与易伤修正，可趁锁定回合击杀或削弱。',
    moves: [
      { id: 'lock', name: '裂隙锁定', intent: 'special', actions: [{ kind: 'status', status: 'vulnerable', amount: 2, target: 'self' }] },
      { id: 'pierce', name: '穿隙刺', intent: 'attack', actions: [{ kind: 'attack', amount: 8, piercing: true }] },
      { id: 'sweep', name: '收枪横扫', intent: 'attack', actions: [{ kind: 'attack', amount: 10 }] },
    ], chooseMove: c => cycle(c, ['lock', 'pierce', 'sweep']),
  },
  {
    id: 'orbit_gambler', name: '逆轨棋士', tier: 'normal', hp: [50, 56], sprite: 'orbit_gambler',
    description: '落子回合只获得8格挡。之后选招时，若你的格挡至少10就准备14伤害破阵并施加脆弱，否则准备三连击；不会随你本回合出牌改变已显示的意图。',
    moves: [
      { id: 'place', name: '布下星局', intent: 'defend', actions: [{ kind: 'block', amount: 8 }] },
      { id: 'break', name: '破阵一击', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 14 }, { kind: 'status', status: 'frail', amount: 1, target: 'player' }] },
      { id: 'triple', name: '三子追击', intent: 'attack', actions: [{ kind: 'attack', amount: 5, times: 3 }] },
    ], chooseMove: c => c.enemy.turn % 3 === 0 ? 'place' : c.player.block >= 10 ? 'break' : 'triple',
  },
];

export const EXTRA_ENCOUNTERS: EncounterDef[] = [
  { id: 'alley_crossbow', enemies: ['ash_crossbow'], tier: 'normal', chapter: 1, minFloor: 1, maxFloor: 6 },
  { id: 'alley_duel', enemies: ['ash_duelist'], tier: 'normal', chapter: 1, minFloor: 3 },
  { id: 'lamp_and_rat', enemies: ['grave_lamplighter', 'ash_rat'], tier: 'normal', chapter: 1, minFloor: 2, maxFloor: 7 },
  { id: 'crossbow_ambush', enemies: ['ash_crossbow', 'shade_crow'], tier: 'normal', chapter: 1, minFloor: 6 },
  { id: 'lamplit_patrol', enemies: ['ash_duelist', 'grave_lamplighter'], tier: 'normal', chapter: 1, minFloor: 7 },
  { id: 'deep_pressure', enemies: ['pressure_boiler'], tier: 'normal', chapter: 2, minFloor: 1, maxFloor: 6 },
  { id: 'deep_quenching', enemies: ['quench_smith'], tier: 'normal', chapter: 2, maxFloor: 6 },
  { id: 'deep_saw_track', enemies: ['slag_saw'], tier: 'normal', chapter: 2, minFloor: 1, maxFloor: 6 },
  { id: 'deep_smith_ticks', enemies: ['quench_smith', 'slag_tick'], tier: 'normal', chapter: 2, minFloor: 5 },
  { id: 'deep_saw_ticks', enemies: ['slag_saw', 'slag_tick'], tier: 'normal', chapter: 2, minFloor: 7 },
  { id: 'sky_sealed_archive', enemies: ['sealed_archivist'], tier: 'normal', chapter: 3, maxFloor: 7 },
  { id: 'sky_phase_lance', enemies: ['phase_lancer'], tier: 'normal', chapter: 3, minFloor: 1, maxFloor: 6 },
  { id: 'sky_starboard', enemies: ['orbit_gambler'], tier: 'normal', chapter: 3, minFloor: 2, maxFloor: 7 },
  { id: 'sky_lancer_mirror', enemies: ['phase_lancer', 'glass_wisp'], tier: 'normal', chapter: 3, minFloor: 6 },
  { id: 'sky_archive_moth', enemies: ['sealed_archivist', 'star_moth'], tier: 'normal', chapter: 3, minFloor: 7 },
];
