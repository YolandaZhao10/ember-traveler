import type { EnemyDef, EnemyAiContext, EncounterDef } from '../engine/types';
import { chance, pick } from '../engine/rng';
import { CHAPTER_TWO_ENCOUNTERS, CHAPTER_TWO_ENEMIES } from './enemies2';
import { CHAPTER_THREE_ENCOUNTERS, CHAPTER_THREE_ENEMIES } from './enemies3';
import { CHAPTER_FOUR_ENCOUNTERS, CHAPTER_FOUR_ENEMIES } from './enemies4';
import { EXTRA_ENEMIES, EXTRA_ENCOUNTERS } from './extraEnemies';

export const ENEMIES: Record<string, EnemyDef> = {};
function def(e: EnemyDef) {
  ENEMIES[e.id] = e;
}

const last = (ctx: EnemyAiContext, n = 1) => ctx.enemy.moveHistory[ctx.enemy.moveHistory.length - n];
const cycle = (ctx: EnemyAiContext, order: string[]) => order[ctx.enemy.turn % order.length];

// ---------- 普通敌人 ----------
def({
  id: 'ash_rat',
  name: '灰烬鼠',
  tier: 'normal',
  hp: [12, 16],
  sprite: 'rat',
  description: '成群出没的小东西。单只不足为惧，聚在一起会越来越凶。',
  moves: [
    { id: 'bite', name: '啃咬', intent: 'attack', actions: [{ kind: 'attack', amount: 4 }] },
    { id: 'swarm', name: '群聚', intent: 'buff', actions: [{ kind: 'status', status: 'strength', amount: 1, target: 'allies' }] },
  ],
  chooseMove: (ctx) => {
    if (ctx.enemy.turn === 0) return chance(ctx.rng, 0.5) ? 'bite' : 'swarm';
    if (last(ctx) === 'swarm') return 'bite';
    return chance(ctx.rng, 0.35) ? 'swarm' : 'bite';
  },
});

def({
  id: 'tomb_puppet',
  name: '守墓傀儡',
  tier: 'normal',
  hp: [28, 32],
  sprite: 'puppet',
  description: '重击后抖落墓灰，将 1 张灰烬塞入弃牌堆；随后支撑躯壳，留下两个不攻击的回合。',
  moves: [
    { id: 'smash', name: '重击', intent: 'attack', actions: [{ kind: 'attack', amount: 9 }] },
    { id: 'dust', name: '抖落墓灰', intent: 'debuff', actions: [{ kind: 'addCardToDiscard', cardId: 'ashes', count: 1 }] },
    { id: 'brace', name: '支撑', intent: 'defend', actions: [{ kind: 'block', amount: 6 }] },
  ],
  chooseMove: (ctx) => cycle(ctx, ['smash', 'dust', 'brace']),
});

def({
  id: 'stray_ember',
  name: '流浪余火',
  tier: 'normal',
  hp: [18, 22],
  sprite: 'ember',
  description: '失去主人的火种，漫无目的地灼烧一切。',
  moves: [
    { id: 'spark', name: '火花', intent: 'attack', actions: [{ kind: 'attack', amount: 6 }] },
    {
      id: 'scorch',
      name: '灼烫',
      intent: 'attack_debuff',
      actions: [
        { kind: 'attack', amount: 3 },
        { kind: 'status', status: 'burn', amount: 2, target: 'player' },
      ],
    },
  ],
  chooseMove: (ctx) => (last(ctx) === 'scorch' ? 'spark' : chance(ctx.rng, 0.5) ? 'scorch' : 'spark'),
});

def({
  id: 'bone_spider',
  name: '蚀骨蛛',
  tier: 'normal',
  hp: [20, 24],
  sprite: 'spider',
  description: '牙上淬着让人无力的毒。',
  moves: [
    {
      id: 'fang',
      name: '毒牙',
      intent: 'attack_debuff',
      actions: [
        { kind: 'attack', amount: 5 },
        { kind: 'status', status: 'weak', amount: 1, target: 'player' },
      ],
    },
    { id: 'web', name: '织网', intent: 'debuff', actions: [{ kind: 'status', status: 'frail', amount: 2, target: 'player' }] },
    { id: 'rend', name: '撕咬', intent: 'attack', actions: [{ kind: 'attack', amount: 8 }] },
  ],
  chooseMove: (ctx) => {
    if (ctx.enemy.turn === 0) return 'fang';
    if (last(ctx) === 'web') return 'rend';
    if (last(ctx) === 'rend') return chance(ctx.rng, 0.6) ? 'fang' : 'web';
    return chance(ctx.rng, 0.5) ? 'web' : 'rend';
  },
});

def({
  id: 'ash_cultist',
  name: '灰烬信徒',
  tier: 'normal',
  hp: [34, 38],
  sprite: 'cultist',
  description: '向灰烬祈祷的狂信者。越拖越危险，速战速决。',
  moves: [
    { id: 'chant', name: '咒文', intent: 'buff', actions: [{ kind: 'status', status: 'ritual', amount: 1, target: 'self' }] },
    { id: 'strike', name: '仪式刀', intent: 'attack', actions: [{ kind: 'attack', amount: 6 }] },
  ],
  chooseMove: (ctx) => (ctx.enemy.turn === 0 ? 'chant' : 'strike'),
});

def({
  id: 'rubble_golem',
  name: '碎石魔像',
  tier: 'normal',
  hp: [40, 46],
  sprite: 'golem',
  description: '古城的碎石自己站了起来。每次挥击都很沉。',
  moves: [
    { id: 'crush', name: '碾压', intent: 'attack', actions: [{ kind: 'attack', amount: 12 }] },
    { id: 'fortify', name: '加固', intent: 'defend_buff', actions: [{ kind: 'block', amount: 10 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
    { id: 'slam', name: '震地', intent: 'attack', actions: [{ kind: 'attack', amount: 4, times: 2 }] },
  ],
  chooseMove: (ctx) => cycle(ctx, ['slam', 'fortify', 'crush']),
});

def({
  id: 'looter',
  name: '掠夺者',
  tier: 'normal',
  hp: [26, 30],
  sprite: 'looter',
  description: '第二回合偷窃。前5回合不会逃跑，第6回合起每次选择意图有20%概率准备逃跑；在它行动前击败可追回金币，否则带钱离场。',
  moves: [
    { id: 'lunge', name: '突刺', intent: 'attack', actions: [{ kind: 'attack', amount: 7 }] },
    { id: 'flurry', name: '连刺', intent: 'attack', actions: [{ kind: 'attack', amount: 3, times: 3 }] },
    { id: 'steal', name: '偷窃', intent: 'special', actions: [{ kind: 'attack', amount: 5 }, { kind: 'stealGold', amount: 12 }] },
    { id: 'escape', name: '携财逃跑', intent: 'escape', actions: [{ kind: 'escape' }] },
  ],
  chooseMove: (ctx) => {
    if (ctx.enemy.turn >= 5 && chance(ctx.rng, 0.2)) return 'escape';
    if (ctx.enemy.turn === 1) return 'steal';
    return last(ctx) === 'flurry' ? 'lunge' : chance(ctx.rng, 0.5) ? 'flurry' : 'lunge';
  },
});

def({
  id: 'shade_crow',
  name: '暗影夜鸦',
  tier: 'normal',
  hp: [16, 20],
  sprite: 'crow',
  description: '它们的叫声会让人手脚发软。',
  moves: [
    { id: 'dive', name: '俯冲', intent: 'attack', actions: [{ kind: 'attack', amount: 7 }] },
    {
      id: 'caw',
      name: '聒噪',
      intent: 'debuff',
      actions: [
        { kind: 'status', status: 'weak', amount: 1, target: 'player' },
        { kind: 'status', status: 'frail', amount: 1, target: 'player' },
      ],
    },
  ],
  chooseMove: (ctx) => {
    if (last(ctx) === 'caw') return 'dive';
    return chance(ctx.rng, 0.4) ? 'caw' : 'dive';
  },
});

// ---------- 精英 ----------
def({
  id: 'ash_knight',
  name: '灰烬骑士',
  tier: 'elite',
  hp: [72, 72],
  sprite: 'knight',
  description: '仍在守卫早已不存在的王座。盾墙后面越来越硬。',
  moves: [
    { id: 'cleave', name: '斩击', intent: 'attack', actions: [{ kind: 'attack', amount: 12 }] },
    { id: 'wall', name: '盾墙', intent: 'defend_buff', actions: [{ kind: 'block', amount: 12 }, { kind: 'status', status: 'strength', amount: 2, target: 'self' }] },
    { id: 'charge', name: '冲锋', intent: 'attack', actions: [{ kind: 'attack', amount: 7, times: 2 }] },
  ],
  chooseMove: (ctx) => cycle(ctx, ['charge', 'wall', 'cleave']),
});

def({
  id: 'pyre_priest',
  name: '焚火祭司',
  tier: 'elite',
  hp: [64, 64],
  sprite: 'priest',
  description: '以自己的血为燃料。打出技能牌会激怒它。',
  moves: [
    {
      id: 'prayer',
      name: '燃烧祈祷',
      intent: 'attack_debuff',
      actions: [
        { kind: 'attack', amount: 4 },
        { kind: 'status', status: 'burn', amount: 4, target: 'player' },
      ],
    },
    { id: 'rain', name: '火雨', intent: 'attack', actions: [{ kind: 'attack', amount: 7, times: 2 }] },
    { id: 'offering', name: '献祭', intent: 'buff', actions: [{ kind: 'loseHp', amount: 5 }, { kind: 'status', status: 'strength', amount: 2, target: 'self' }] },
  ],
  onCombatStart: () => [{ kind: 'status', status: 'enrage', amount: 1, target: 'self' }],
  chooseMove: (ctx) => {
    if (ctx.enemy.turn === 0) return 'prayer';
    return cycle(ctx, ['offering', 'rain', 'prayer']);
  },
});

def({
  id: 'twin_sentinel',
  name: '双生哨卫',
  tier: 'elite',
  hp: [40, 40],
  sprite: 'sentinel',
  description: '一对石像守卫。其中一个倒下时，另一个会暴怒。',
  moves: [
    { id: 'strike', name: '石拳', intent: 'attack', actions: [{ kind: 'attack', amount: 9 }] },
    { id: 'guard', name: '护卫', intent: 'defend_buff', actions: [{ kind: 'block', amount: 8 }, { kind: 'status', status: 'strength', amount: 1, target: 'allies' }] },
  ],
  chooseMove: (ctx) => {
    const idx = ctx.allies.findIndex((a) => a.id === ctx.enemy.id);
    return (ctx.enemy.turn + idx) % 2 === 0 ? 'strike' : 'guard';
  },
  onAllyDeath: () => [
    { kind: 'status', status: 'strength', amount: 3, target: 'self' },
    { kind: 'status', status: 'vengeance', amount: 3, target: 'self' },
  ],
});

// ---------- Boss ----------
def({
  id: 'ash_sovereign',
  name: '灰烬之王',
  tier: 'boss',
  hp: [125, 125],
  sprite: 'sovereign',
  description: '古城最后的主人。生命降至一半时，王冠下的余烬会重新燃起：清除负面状态、获得格挡与力量，并让你虚弱、脆弱。',
  moves: [
    { id: 'regal_slash', name: '王权斩', intent: 'attack', actions: [{ kind: 'attack', amount: 12 }] },
    { id: 'ash_storm', name: '灰烬风暴', intent: 'attack', actions: [{ kind: 'attack', amount: 5, times: 3 }] },
    { id: 'ash_wall', name: '灰烬壁垒', intent: 'defend_buff', actions: [{ kind: 'block', amount: 12 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
    {
      id: 'awaken',
      name: '余烬苏醒',
      intent: 'special',
      actions: [
        { kind: 'clearDebuffs' },
        { kind: 'block', amount: 18 },
        { kind: 'status', status: 'strength', amount: 1, target: 'self' },
        { kind: 'status', status: 'weak', amount: 2, target: 'player' },
        { kind: 'status', status: 'frail', amount: 2, target: 'player' },
      ],
    },
    { id: 'sear_sky', name: '焚天', intent: 'attack', actions: [{ kind: 'attack', amount: 16 }] },
    { id: 'cinder_storm', name: '余烬风暴', intent: 'attack', actions: [{ kind: 'attack', amount: 6, times: 3 }] },
    {
      id: 'ignite',
      name: '引燃',
      intent: 'attack_debuff',
      actions: [
        { kind: 'attack', amount: 5 },
        { kind: 'status', status: 'burn', amount: 3, target: 'player' },
        { kind: 'addCardToDiscard', cardId: 'ashes', count: 1 },
      ],
    },
  ],
  checkPhase: (e) => (e.phase === 1 && e.hp <= e.maxHp / 2 ? 2 : null),
  chooseMove: (ctx) => {
    const e = ctx.enemy;
    if (e.phase === 2) {
      if (!e.flags.awakened) return 'awaken';
      const order = ['sear_sky', 'ignite', 'cinder_storm', 'ash_wall'];
      return order[(e.flags.p2turn ?? 0) % order.length];
    }
    const prev = last(ctx);
    if (e.turn === 0) return 'ash_storm';
    if (prev === 'ash_wall') return pick(ctx.rng, ['regal_slash', 'ash_storm']);
    if (prev === 'regal_slash') return chance(ctx.rng, 0.5) ? 'ash_storm' : 'ash_wall';
    return chance(ctx.rng, 0.5) ? 'regal_slash' : 'ash_wall';
  },
});

// ---------- 新增普通敌人 ----------
def({
  id: 'ash_bat',
  name: '灰烬蝠',
  tier: 'normal',
  hp: [10, 13],
  sprite: 'bat',
  description: '靠吸血维生的小东西，打它们要快。',
  moves: [
    { id: 'drain', name: '吸血', intent: 'attack', actions: [{ kind: 'attack', amount: 3 }, { kind: 'heal', amount: 3 }] },
    { id: 'shriek', name: '尖啸', intent: 'debuff', actions: [{ kind: 'status', status: 'frail', amount: 1, target: 'player' }] },
  ],
  chooseMove: (ctx) => (last(ctx) === 'shriek' ? 'drain' : chance(ctx.rng, 0.3) ? 'shriek' : 'drain'),
});

def({
  id: 'rust_snail',
  name: '锈甲蜗',
  tier: 'normal',
  hp: [30, 34],
  sprite: 'snail',
  description: '缩壳后喷出锈灰，造成轻伤并将 1 张灰烬塞入弃牌堆，随后碾压。',
  moves: [
    { id: 'shell', name: '缩壳', intent: 'defend', actions: [{ kind: 'block', amount: 12 }] },
    { id: 'acid', name: '锈灰喷吐', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 3 }, { kind: 'addCardToDiscard', cardId: 'ashes', count: 1 }] },
    { id: 'roll', name: '碾压', intent: 'attack', actions: [{ kind: 'attack', amount: 8 }] },
  ],
  chooseMove: (ctx) => cycle(ctx, ['shell', 'acid', 'roll']),
});

def({
  id: 'ash_deacon',
  name: '灰烬执事长',
  tier: 'normal',
  hp: [44, 50],
  sprite: 'deacon',
  description: '信徒的头目，会为同伴祈福。半血以下治疗 6 点并获得 4 格挡，两次治疗之间至少行动两次。',
  moves: [
    { id: 'bless', name: '祈福', intent: 'buff', actions: [{ kind: 'status', status: 'strength', amount: 1, target: 'allies' }] },
    { id: 'firerain', name: '火雨', intent: 'attack', actions: [{ kind: 'attack', amount: 4, times: 2 }] },
    { id: 'mend', name: '治疗', intent: 'buff', actions: [{ kind: 'heal', amount: 6 }, { kind: 'block', amount: 4 }] },
  ],
  chooseMove: (ctx) => {
    if (ctx.enemy.turn === 0) return 'bless';
    if (ctx.enemy.hp < ctx.enemy.maxHp * 0.5 && !ctx.enemy.moveHistory.slice(-2).includes('mend')) return 'mend';
    return last(ctx) === 'firerain' ? (chance(ctx.rng, 0.5) ? 'bless' : 'firerain') : 'firerain';
  },
});

def({
  id: 'hollow_guard',
  name: '空壳守卫',
  tier: 'normal',
  hp: [36, 40],
  sprite: 'hollow',
  description: '盔甲里早已没有人。开场有 1 层荆棘，攻击它会被反伤。',
  moves: [
    { id: 'stance', name: '守势', intent: 'defend', actions: [{ kind: 'block', amount: 8 }] },
    { id: 'cleave', name: '重劈', intent: 'attack', actions: [{ kind: 'attack', amount: 10 }] },
  ],
  onCombatStart: () => [{ kind: 'status', status: 'thorns', amount: 1, target: 'self' }],
  chooseMove: (ctx) => cycle(ctx, ['stance', 'cleave']),
});

def({
  id: 'ember_grub',
  name: '余烬虫',
  tier: 'normal',
  hp: [22, 26],
  sprite: 'grub',
  description: '肚子里装满余火。死的时候会炸开，点燃你。',
  moves: [
    { id: 'spit', name: '喷火', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 5 }, { kind: 'status', status: 'burn', amount: 2, target: 'player' }] },
    { id: 'wriggle', name: '蠕动', intent: 'defend_buff', actions: [{ kind: 'block', amount: 5 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
  ],
  onDeath: [{ kind: 'status', status: 'burn', amount: 2, target: 'player' }],
  chooseMove: (ctx) => cycle(ctx, ['spit', 'wriggle']),
});

def({
  id: 'bone_piper',
  name: '骨笛手',
  tier: 'normal',
  hp: [24, 28],
  sprite: 'piper',
  description: '笛声让人手软，刺耳的高音还会在你的牌堆里留下灰烬。',
  moves: [
    { id: 'tune', name: '笛音', intent: 'debuff', actions: [{ kind: 'status', status: 'weak', amount: 1, target: 'player' }, { kind: 'status', status: 'vulnerable', amount: 1, target: 'player' }] },
    { id: 'knock', name: '敲击', intent: 'attack', actions: [{ kind: 'attack', amount: 6 }] },
    { id: 'screech', name: '刺耳', intent: 'special', actions: [{ kind: 'attack', amount: 3 }, { kind: 'addCardToDiscard', cardId: 'ashes', count: 1 }] },
  ],
  chooseMove: (ctx) => cycle(ctx, ['tune', 'knock', 'screech', 'knock']),
});

// ---------- 新增精英 ----------
def({
  id: 'ash_taxman',
  name: '灰烬税吏',
  tier: 'elite',
  hp: [78, 78],
  sprite: 'taxman',
  description: '抢走金币并定期净化。前5回合不会逃跑，第6回合起每次选择意图有20%概率准备逃跑；行动前击败可追回金币，逃走则带钱离场且不掉落精英遗物。',
  moves: [
    { id: 'levy', name: '征税', intent: 'special', actions: [{ kind: 'attack', amount: 8 }, { kind: 'stealGold', amount: 20 }] },
    { id: 'verdict', name: '审判', intent: 'attack', actions: [{ kind: 'attack', amount: 14 }] },
    { id: 'ledger', name: '账本壁垒', intent: 'defend_buff', actions: [{ kind: 'block', amount: 10 }, { kind: 'clearDebuffs' }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
    { id: 'escape', name: '携账逃跑', intent: 'escape', actions: [{ kind: 'escape' }] },
  ],
  chooseMove: (ctx) => ctx.enemy.turn >= 5 && chance(ctx.rng, 0.2) ? 'escape' : cycle(ctx, ['levy', 'verdict', 'ledger']),
});

def({
  id: 'pyre_beast',
  name: '焚心兽',
  tier: 'elite',
  hp: [84, 84],
  sprite: 'beast',
  description: '胸腔里烧着一团火。咆哮时增长力量并削弱你，随后撕裂、吞噬；每轮咆哮都是反攻窗口。',
  moves: [
    { id: 'roar', name: '咆哮', intent: 'debuff', actions: [{ kind: 'status', status: 'strength', amount: 1, target: 'self' }, { kind: 'status', status: 'weak', amount: 1, target: 'player' }] },
    { id: 'rend', name: '撕裂', intent: 'attack', actions: [{ kind: 'attack', amount: 7, times: 2 }] },
    { id: 'devour', name: '吞噬', intent: 'attack', actions: [{ kind: 'attack', amount: 14 }, { kind: 'heal', amount: 4 }] },
  ],
  chooseMove: (ctx) => cycle(ctx, ['roar', 'rend', 'devour']),
});

// ---------- 第二个 Boss ----------
def({
  id: 'bell_heart',
  name: '钟楼之心',
  tier: 'boss',
  hp: [130, 130],
  sprite: 'bellheart',
  description: '古城钟楼的机械核心。钟声削弱你，齿轮保护它；生命减半后失控，连击、钟鸣、碎钟后会重整齿轮，留出反攻回合。',
  moves: [
    { id: 'toll', name: '钟鸣', intent: 'attack_debuff', actions: [{ kind: 'attack', amount: 5 }, { kind: 'status', status: 'weak', amount: 1, target: 'player' }, { kind: 'status', status: 'frail', amount: 1, target: 'player' }] },
    { id: 'pendulum', name: '摆锤', intent: 'attack', actions: [{ kind: 'attack', amount: 11 }] },
    { id: 'gears', name: '齿轮壁垒', intent: 'defend_buff', actions: [{ kind: 'block', amount: 14 }, { kind: 'status', status: 'strength', amount: 1, target: 'self' }] },
    {
      id: 'overdrive',
      name: '失控',
      intent: 'special',
      actions: [
        { kind: 'clearDebuffs' },
        { kind: 'status', status: 'strength', amount: 1, target: 'self' },
        { kind: 'block', amount: 12 },
        { kind: 'addCardToDiscard', cardId: 'ashes', count: 2 },
      ],
    },
    { id: 'shatter', name: '碎钟', intent: 'attack', actions: [{ kind: 'attack', amount: 16 }] },
    { id: 'flurry', name: '钟锤连击', intent: 'attack', actions: [{ kind: 'attack', amount: 3, times: 4 }] },
  ],
  checkPhase: (e) => (e.phase === 1 && e.hp <= e.maxHp / 2 ? 2 : null),
  chooseMove: (ctx) => {
    const e = ctx.enemy;
    if (e.phase === 2) {
      if (!e.flags.awakened) return 'overdrive';
      const order = ['flurry', 'toll', 'shatter', 'gears'];
      return order[(e.flags.p2turn ?? 0) % order.length];
    }
    if (e.turn === 0) return 'toll';
    const prev = last(ctx);
    if (prev === 'toll') return chance(ctx.rng, 0.6) ? 'pendulum' : 'gears';
    if (prev === 'pendulum') return chance(ctx.rng, 0.5) ? 'gears' : 'toll';
    return 'pendulum';
  },
});

// ---------- 遭遇 ----------
[...CHAPTER_TWO_ENEMIES, ...CHAPTER_THREE_ENEMIES, ...CHAPTER_FOUR_ENEMIES, ...EXTRA_ENEMIES].forEach(def);
export const ENCOUNTERS: EncounterDef[] = [
  ...CHAPTER_TWO_ENCOUNTERS, ...CHAPTER_THREE_ENCOUNTERS, ...CHAPTER_FOUR_ENCOUNTERS,
  ...EXTRA_ENCOUNTERS,
  { id: 'rats3', enemies: ['ash_rat', 'ash_rat', 'ash_rat'], tier: 'normal', maxFloor: 4 },
  { id: 'crows2', enemies: ['shade_crow', 'shade_crow'], tier: 'normal', maxFloor: 5 },
  { id: 'ember1', enemies: ['stray_ember'], tier: 'normal', maxFloor: 3 },
  { id: 'spider1', enemies: ['bone_spider'], tier: 'normal', maxFloor: 4 },
  { id: 'puppet1', enemies: ['tomb_puppet'], tier: 'normal', maxFloor: 5 },
  { id: 'puppet_rat', enemies: ['tomb_puppet', 'ash_rat'], tier: 'normal', minFloor: 3 },
  { id: 'cultist1', enemies: ['ash_cultist'], tier: 'normal', minFloor: 3 },
  { id: 'golem1', enemies: ['rubble_golem'], tier: 'normal', minFloor: 4 },
  { id: 'looter_crow', enemies: ['looter', 'shade_crow'], tier: 'normal', minFloor: 4 },
  { id: 'spiders2', enemies: ['bone_spider', 'bone_spider'], tier: 'normal', minFloor: 5 },
  { id: 'embers2', enemies: ['stray_ember', 'stray_ember'], tier: 'normal', minFloor: 5 },
  { id: 'cultist_rats', enemies: ['ash_cultist', 'ash_rat', 'ash_rat'], tier: 'normal', minFloor: 6 },
  { id: 'looter1', enemies: ['looter'], tier: 'normal', minFloor: 2, maxFloor: 6 },
  { id: 'bats3', enemies: ['ash_bat', 'ash_bat', 'ash_bat'], tier: 'normal', maxFloor: 4 },
  { id: 'snail1', enemies: ['rust_snail'], tier: 'normal', minFloor: 1, maxFloor: 6 },
  { id: 'piper1', enemies: ['bone_piper'], tier: 'normal', maxFloor: 5 },
  { id: 'grub_bat', enemies: ['ember_grub', 'ash_bat'], tier: 'normal', minFloor: 2, maxFloor: 7 },
  { id: 'hollow1', enemies: ['hollow_guard'], tier: 'normal', minFloor: 3 },
  { id: 'deacon1', enemies: ['ash_deacon'], tier: 'normal', minFloor: 5 },
  { id: 'deacon_cultist', enemies: ['ash_deacon', 'ash_cultist'], tier: 'normal', minFloor: 7 },
  { id: 'piper_grubs', enemies: ['bone_piper', 'ember_grub', 'ash_bat'], tier: 'normal', minFloor: 6 },
  { id: 'snail_hollow', enemies: ['rust_snail', 'hollow_guard'], tier: 'normal', minFloor: 7 },
  { id: 'elite_knight', enemies: ['ash_knight'], tier: 'elite' },
  { id: 'elite_priest', enemies: ['pyre_priest'], tier: 'elite' },
  { id: 'elite_twins', enemies: ['twin_sentinel', 'twin_sentinel'], tier: 'elite' },
  { id: 'elite_taxman', enemies: ['ash_taxman'], tier: 'elite' },
  { id: 'elite_beast', enemies: ['pyre_beast'], tier: 'elite' },
  { id: 'boss_sovereign', enemies: ['ash_sovereign'], tier: 'boss' },
  { id: 'boss_bellheart', enemies: ['bell_heart'], tier: 'boss' },
];
