import type { CardDef, CharacterId } from '../engine/types';
import { EXTRA_CHARACTER_CARDS } from './extraCards';
import { EXTRA_SHARED_CARDS } from './sharedCards';
import { EXTRA_CURSES } from './curses';
import { CYCLE_CARDS } from './cycleCards';

/**
 * 所有卡牌定义。描述文本由效果数据自动生成（见 engine/describe.ts），
 * 保证显示数值与实际结算一致。
 */
export const CARDS: Record<string, CardDef> = {};

function def(c: CardDef) {
  if (CARDS[c.id]) throw new Error(`重复卡牌 ID：${c.id}`);
  CARDS[c.id] = c;
}

// ---------- 基础 ----------
def({
  id: 'strike',
  name: '打击',
  type: 'attack',
  rarity: 'starter',
  archetype: 'basic',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 6 }],
  upgrade: { effects: [{ kind: 'damage', amount: 9 }] },
  flavor: '最朴素的一击。',
});
def({
  id: 'defend',
  name: '防御',
  type: 'skill',
  rarity: 'starter',
  archetype: 'basic',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'block', amount: 5 }],
  upgrade: { effects: [{ kind: 'block', amount: 8 }] },
  flavor: '把斗篷裹紧。',
});
def({
  id: 'kindle',
  name: '引火',
  type: 'attack',
  rarity: 'starter',
  archetype: 'ember',
  cost: 1,
  target: 'enemy',
  effects: [
    { kind: 'damage', amount: 5 },
    { kind: 'gainEmber', amount: 2 },
  ],
  upgrade: {
    effects: [
      { kind: 'damage', amount: 7 },
      { kind: 'gainEmber', amount: 2 },
    ],
  },
  flavor: '火种在灰烬中苏醒。',
});
def({
  id: 'ash_step',
  name: '灰烬步',
  type: 'skill',
  rarity: 'starter',
  archetype: 'combo',
  owner: 'traveler',
  cost: 0,
  target: 'self',
  exhaust: true,
  effects: [
    { kind: 'draw', amount: 1 },
    { kind: 'conditional', cond: { kind: 'hasBlock' }, then: [{ kind: 'gainEmber', amount: 2 }] },
  ],
  upgrade: {
    effects: [
      { kind: 'draw', amount: 2 },
      { kind: 'conditional', cond: { kind: 'hasBlock' }, then: [{ kind: 'gainEmber', amount: 2 }] },
    ],
  },
  flavor: '踏过灰烬，不留脚印。',
});

// ---------- 连击 ----------
def({
  id: 'quick_stab',
  name: '疾刺',
  type: 'attack',
  rarity: 'common',
  archetype: 'combo',
  owner: 'traveler',
  cost: 0,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 3 }, { kind: 'conditional', cond: { kind: 'attacksThisTurnAtLeast', value: 2 }, then: [{ kind: 'gainEmber', amount: 1 }] }],
  upgrade: { effects: [{ kind: 'damage', amount: 5 }, { kind: 'conditional', cond: { kind: 'attacksThisTurnAtLeast', value: 2 }, then: [{ kind: 'gainEmber', amount: 1 }] }] },
});
def({
  id: 'twin_blades',
  name: '双刃',
  type: 'attack',
  rarity: 'common',
  archetype: 'combo',
  owner: 'traveler',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 5, times: 2 }],
  upgrade: { effects: [{ kind: 'damage', amount: 7, times: 2 }] },
});
def({
  id: 'chain_slash',
  name: '连环斩',
  type: 'attack',
  rarity: 'common',
  archetype: 'combo',
  owner: 'traveler',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 8 }, { kind: 'conditional', cond: { kind: 'attacksThisTurnAtLeast', value: 1 }, then: [{ kind: 'tempStrength', amount: 2 }] }],
  upgrade: { effects: [{ kind: 'damage', amount: 11 }, { kind: 'conditional', cond: { kind: 'attacksThisTurnAtLeast', value: 1 }, then: [{ kind: 'tempStrength', amount: 3 }] }] },
});
def({
  id: 'spin_kick',
  name: '回旋踢',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'combo',
  owner: 'traveler',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 9 }, { kind: 'draw', amount: 1 }],
  upgrade: { effects: [{ kind: 'damage', amount: 12 }, { kind: 'draw', amount: 1 }] },
});
def({
  id: 'rhythm',
  exhaust: true,
  name: '节奏',
  type: 'skill',
  rarity: 'common',
  archetype: 'combo',
  owner: 'traveler',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'draw', amount: 2 }, { kind: 'conditional', cond: { kind: 'attacksThisTurnAtLeast', value: 2 }, then: [{ kind: 'energy', amount: 1 }] }],
  upgrade: { effects: [{ kind: 'draw', amount: 3 }, { kind: 'conditional', cond: { kind: 'attacksThisTurnAtLeast', value: 2 }, then: [{ kind: 'energy', amount: 1 }] }] },
});
def({
  id: 'haste',
  name: '急速',
  type: 'skill',
  rarity: 'uncommon',
  archetype: 'combo',
  owner: 'traveler',
  cost: 0,
  target: 'self',
  exhaust: true,
  effects: [
    { kind: 'energy', amount: 1 },
    { kind: 'draw', amount: 1 },
  ],
  upgrade: { effects: [{ kind: 'energy', amount: 1 }, { kind: 'draw', amount: 2 }] },
});
def({
  id: 'thousand_cuts',
  name: '千刃',
  type: 'attack',
  rarity: 'rare',
  archetype: 'combo',
  owner: 'traveler',
  cost: 2,
  target: 'enemy',
  effects: [{ kind: 'damagePerAttack', amount: 6 }],
  upgrade: { effects: [{ kind: 'damagePerAttack', amount: 8 }] },
  flavor: '每一刀都为下一刀铺路。',
});
def({
  id: 'tempo',
  name: '余音',
  type: 'power',
  rarity: 'uncommon',
  archetype: 'combo',
  owner: 'traveler',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'tempo', amount: 1, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'tempo', amount: 2, target: 'self' }] },
});
def({
  id: 'war_drum',
  name: '战鼓',
  type: 'power',
  rarity: 'rare',
  archetype: 'combo',
  owner: 'traveler',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'crescendo', amount: 1, target: 'self' }, { kind: 'status', status: 'comboFlow', amount: 1, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'crescendo', amount: 2, target: 'self' }, { kind: 'status', status: 'comboFlow', amount: 1, target: 'self' }] },
});
def({
  id: 'trip',
  name: '绊倒',
  type: 'skill',
  rarity: 'common',
  archetype: 'combo',
  owner: 'traveler',
  cost: 1,
  target: 'enemy',
  effects: [
    { kind: 'status', status: 'vulnerable', amount: 2, target: 'target' },
    { kind: 'draw', amount: 1 },
  ],
  upgrade: {
    effects: [
      { kind: 'status', status: 'vulnerable', amount: 3, target: 'target' },
      { kind: 'draw', amount: 1 },
    ],
  },
});

// ---------- 壁垒 ----------
def({
  id: 'raise_shield',
  name: '举盾',
  type: 'skill',
  rarity: 'common',
  archetype: 'bulwark',
  owner: 'traveler',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'block', amount: 9 }],
  upgrade: { effects: [{ kind: 'block', amount: 13 }] },
});
def({
  id: 'shield_bash',
  name: '盾击',
  type: 'attack',
  rarity: 'common',
  archetype: 'bulwark',
  owner: 'traveler',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'damageByBlock' }],
  upgrade: {
    effects: [
      { kind: 'block', amount: 3 },
      { kind: 'damageByBlock' },
    ],
  },
  flavor: '盾不只用来挡。',
});
def({
  id: 'thorn_mail',
  name: '荆棘甲',
  type: 'skill',
  rarity: 'uncommon',
  archetype: 'bulwark',
  owner: 'traveler',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'block', amount: 7 }, { kind: 'status', status: 'thorns', amount: 2, target: 'self' }],
  upgrade: { effects: [{ kind: 'block', amount: 10 }, { kind: 'status', status: 'thorns', amount: 3, target: 'self' }] },
});
def({
  id: 'iron_wall',
  name: '铁壁',
  type: 'skill',
  rarity: 'uncommon',
  archetype: 'bulwark',
  owner: 'traveler',
  cost: 2,
  target: 'self',
  effects: [{ kind: 'block', amount: 16 }, { kind: 'status', status: 'metallicize', amount: 3, target: 'self' }],
  upgrade: { effects: [{ kind: 'block', amount: 22 }, { kind: 'status', status: 'metallicize', amount: 4, target: 'self' }] },
});
def({
  id: 'riposte',
  name: '反击',
  type: 'attack',
  rarity: 'common',
  archetype: 'bulwark',
  owner: 'traveler',
  cost: 1,
  target: 'enemy',
  effects: [
    { kind: 'damage', amount: 6 },
    { kind: 'conditional', cond: { kind: 'hasBlock' }, then: [{ kind: 'damage', amount: 4 }] },
  ],
  upgrade: {
    effects: [
      { kind: 'damage', amount: 9 },
      { kind: 'conditional', cond: { kind: 'hasBlock' }, then: [{ kind: 'damage', amount: 5 }] },
    ],
  },
});
def({
  id: 'hold_fast',
  name: '固守',
  type: 'power',
  rarity: 'rare',
  archetype: 'bulwark',
  owner: 'traveler',
  cost: 2,
  target: 'self',
  effects: [{ kind: 'status', status: 'barricade', amount: 1, target: 'self' }],
  upgrade: { cost: 1 },
  flavor: '城墙不会在清晨倒塌。',
});
def({
  id: 'iron_will',
  name: '钢铁意志',
  type: 'power',
  rarity: 'uncommon',
  archetype: 'bulwark',
  owner: 'traveler',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'metallicize', amount: 4, target: 'self' }, { kind: 'status', status: 'guardReserve', amount: 6, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'metallicize', amount: 6, target: 'self' }, { kind: 'status', status: 'guardReserve', amount: 9, target: 'self' }] },
});
def({
  id: 'shield_shatter',
  name: '碎盾',
  type: 'attack',
  rarity: 'rare',
  archetype: 'bulwark',
  owner: 'traveler',
  cost: 2,
  target: 'all_enemies',
  effects: [{ kind: 'damageByBlock', aoe: true, mult: 2, consume: true }],
  upgrade: { effects: [{ kind: 'damageByBlock', aoe: true, mult: 3, consume: true }] },
  flavor: '让他们尝尝城墙的重量。',
});
def({
  id: 'vigil',
  name: '守望',
  type: 'skill',
  rarity: 'common',
  archetype: 'bulwark',
  owner: 'traveler',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'block', amount: 8 }, { kind: 'status', status: 'weak', amount: 1, target: 'target' }],
  upgrade: { effects: [{ kind: 'block', amount: 11 }, { kind: 'status', status: 'weak', amount: 1, target: 'target' }] },
});
def({
  id: 'bulwark_counter',
  name: '盾墙反震',
  type: 'skill',
  rarity: 'uncommon',
  archetype: 'bulwark',
  owner: 'traveler',
  cost: 1,
  target: 'all_enemies',
  effects: [{ kind: 'block', amount: 9 }, { kind: 'status', status: 'vulnerable', amount: 1, target: 'all' }],
  upgrade: { effects: [{ kind: 'block', amount: 13 }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'all' }] },
});

// ---------- 余烬 ----------
def({
  id: 'stoke',
  name: '添薪',
  type: 'skill',
  rarity: 'common',
  archetype: 'ember',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'block', amount: 6 }, { kind: 'gainEmber', amount: 3 }],
  upgrade: { effects: [{ kind: 'block', amount: 9 }, { kind: 'gainEmber', amount: 4 }] },
});
def({
  id: 'ember_burst',
  name: '余烬爆发',
  type: 'attack',
  rarity: 'rare',
  archetype: 'ember',
  cost: 2,
  target: 'enemy',
  effects: [{ kind: 'emberBurst', damagePer: 6 }],
  upgrade: { effects: [{ kind: 'emberBurst', damagePer: 8 }] },
  flavor: '所有积蓄，一息之间。',
});
def({
  id: 'flame_breath',
  name: '烈焰吐息',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'ember',
  cost: 1,
  target: 'all_enemies',
  effects: [{ kind: 'emberBurst', damagePer: 2, aoe: true }, { kind: 'status', status: 'burn', amount: 3, target: 'all' }],
  upgrade: { effects: [{ kind: 'emberBurst', damagePer: 3, aoe: true }, { kind: 'status', status: 'burn', amount: 4, target: 'all' }] },
});
def({
  id: 'ash_shield',
  name: '灰烬护盾',
  type: 'skill',
  rarity: 'uncommon',
  archetype: 'ember',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'emberBurst', blockPer: 3 }],
  upgrade: { effects: [{ kind: 'emberBurst', blockPer: 4 }] },
});
def({
  id: 'ember_heart',
  name: '火种之心',
  type: 'power',
  rarity: 'uncommon',
  archetype: 'ember',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'emberHeart', amount: 1, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'emberHeart', amount: 2, target: 'self' }] },
});
def({
  id: 'ignite',
  name: '燃烧',
  type: 'skill',
  rarity: 'common',
  archetype: 'ember',
  cost: 1,
  target: 'enemy',
  effects: [
    { kind: 'status', status: 'burn', amount: 3, target: 'target' },
    { kind: 'gainEmber', amount: 1 },
  ],
  upgrade: {
    effects: [
      { kind: 'status', status: 'burn', amount: 5, target: 'target' },
      { kind: 'gainEmber', amount: 1 },
    ],
  },
});
def({
  id: 'searing_strike',
  name: '灼热打击',
  type: 'attack',
  rarity: 'common',
  archetype: 'ember',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 9 }, { kind: 'conditional', cond: { kind: 'emberAtLeast', value: 5 }, then: [{ kind: 'damage', amount: 5 }] }],
  upgrade: { effects: [{ kind: 'damage', amount: 12 }, { kind: 'conditional', cond: { kind: 'emberAtLeast', value: 5 }, then: [{ kind: 'damage', amount: 6 }] }] },
});
def({
  id: 'ember_dance',
  name: '余火之舞',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'ember',
  cost: 1,
  target: 'enemy',
  effects: [
    { kind: 'damage', amount: 5 },
    { kind: 'damagePerEmber', amount: 1, per: 1 },
  ],
  upgrade: {
    effects: [
      { kind: 'damage', amount: 7 },
      { kind: 'damagePerEmber', amount: 1, per: 1 },
    ],
  },
});
def({
  id: 'pillar_of_flame',
  name: '焰柱',
  type: 'power',
  rarity: 'rare',
  archetype: 'ember',
  cost: 2,
  target: 'self',
  effects: [{ kind: 'status', status: 'flameAura', amount: 1, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'flameAura', amount: 3, target: 'self' }] },
  flavor: '火光所及之处，灰烬低语。',
});
def({
  id: 'torch',
  name: '火炬',
  type: 'skill',
  rarity: 'common',
  archetype: 'ember',
  cost: 1,
  target: 'self',
  effects: [
    { kind: 'draw', amount: 1 },
    { kind: 'gainEmber', amount: 2 },
    { kind: 'conditional', cond: { kind: 'emberAtLeast', value: 8 }, then: [{ kind: 'draw', amount: 1 }] },
  ],
  upgrade: {
    effects: [
      { kind: 'draw', amount: 2 },
      { kind: 'gainEmber', amount: 2 },
      { kind: 'conditional', cond: { kind: 'emberAtLeast', value: 8 }, then: [{ kind: 'draw', amount: 1 }] },
    ],
  },
});
def({
  id: 'forge',
  name: '熔炉',
  type: 'power',
  rarity: 'rare',
  archetype: 'ember',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'forge', amount: 1, target: 'self' }],
  upgrade: { cost: 0 },
});
def({
  id: 'ember_blade',
  name: '灰烬之刃',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'ember',
  cost: 1,
  target: 'enemy',
  requireEmber: 2,
  effects: [
    { kind: 'gainEmber', amount: -2 },
    { kind: 'damage', amount: 18 },
  ],
  upgrade: {
    effects: [
      { kind: 'gainEmber', amount: -2 },
      { kind: 'damage', amount: 24 },
    ],
  },
});
def({
  id: 'ember_gust',
  name: '疾风余烬',
  type: 'skill',
  rarity: 'common',
  archetype: 'ember',
  cost: 0,
  target: 'self',
  exhaust: true,
  effects: [
    { kind: 'gainEmber', amount: 1 },
    { kind: 'draw', amount: 1 },
  ],
  upgrade: {
    effects: [
      { kind: 'gainEmber', amount: 2 },
      { kind: 'draw', amount: 1 },
    ],
  },
});
def({
  id: 'cinder_mend',
  name: '余烬疗愈',
  type: 'skill',
  rarity: 'rare',
  archetype: 'ember',
  cost: 0,
  target: 'self',
  exhaust: true,
  requireEmber: 4,
  effects: [
    { kind: 'gainEmber', amount: -4 },
    { kind: 'heal', amount: 14 },
    { kind: 'clearDebuffs' },
  ],
  upgrade: {
    effects: [
      { kind: 'gainEmber', amount: -4 },
      { kind: 'heal', amount: 18 },
      { kind: 'clearDebuffs' },
    ],
  },
});

// ---------- 拾灰者：焚烧 ----------
def({
  id: 'light_up',
  name: '点燃',
  type: 'attack',
  rarity: 'starter',
  archetype: 'cinder',
  owner: 'picker',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 7 }, { kind: 'status', status: 'burn', amount: 3, target: 'target' }],
  upgrade: { effects: [{ kind: 'damage', amount: 10 }, { kind: 'status', status: 'burn', amount: 4, target: 'target' }] },
  flavor: '先让它烧起来。',
});
def({
  id: 'wildfire',
  name: '燎原',
  type: 'skill',
  rarity: 'common',
  archetype: 'cinder',
  owner: 'picker',
  cost: 1,
  target: 'all_enemies',
  effects: [{ kind: 'status', status: 'burn', amount: 4, target: 'all' }],
  upgrade: { effects: [{ kind: 'status', status: 'burn', amount: 6, target: 'all' }] },
});
def({
  id: 'scorch_mark',
  name: '灼痕',
  type: 'attack',
  rarity: 'common',
  archetype: 'cinder',
  owner: 'picker',
  cost: 1,
  target: 'enemy',
  effects: [
    { kind: 'damage', amount: 6 },
    { kind: 'conditional', cond: { kind: 'targetBurning' }, then: [{ kind: 'damage', amount: 4 }] },
  ],
  upgrade: {
    effects: [
      { kind: 'damage', amount: 9 },
      { kind: 'conditional', cond: { kind: 'targetBurning' }, then: [{ kind: 'damage', amount: 5 }] },
    ],
  },
});
def({
  id: 'detonate',
  name: '引爆',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'cinder',
  owner: 'picker',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'consumeBurn', damagePer: 3 }],
  upgrade: { effects: [{ kind: 'consumeBurn', damagePer: 4 }] },
  flavor: '火焰越旺，炸得越响。',
});
def({
  id: 'add_fuel',
  name: '添油',
  type: 'skill',
  rarity: 'uncommon',
  archetype: 'cinder',
  owner: 'picker',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'doubleStatus', status: 'burn' }, { kind: 'blockPerBurn', amount: 1, max: 12 }],
  upgrade: { effects: [{ kind: 'doubleStatus', status: 'burn' }, { kind: 'blockPerBurn', amount: 1, max: 18 }] },
});
def({
  id: 'lingering_fire',
  name: '余火',
  type: 'skill',
  rarity: 'common',
  archetype: 'cinder',
  owner: 'picker',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'status', status: 'burn', amount: 4, target: 'target' }, { kind: 'block', amount: 7 }],
  upgrade: { effects: [{ kind: 'status', status: 'burn', amount: 6, target: 'target' }, { kind: 'block', amount: 10 }] },
});
def({
  id: 'heat_wave',
  name: '热浪',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'cinder',
  owner: 'picker',
  cost: 2,
  target: 'all_enemies',
  effects: [{ kind: 'damagePerBurn', amount: 3, aoe: true }, { kind: 'status', status: 'weak', amount: 1, target: 'all' }],
  upgrade: { effects: [{ kind: 'damagePerBurn', amount: 4, aoe: true }, { kind: 'status', status: 'weak', amount: 2, target: 'all' }] },
});
def({
  id: 'cremation',
  name: '火葬',
  type: 'power',
  rarity: 'rare',
  archetype: 'cinder',
  owner: 'picker',
  cost: 2,
  target: 'self',
  effects: [{ kind: 'status', status: 'burningRelay', amount: 4, target: 'self' }, { kind: 'status', status: 'burn', amount: 14, target: 'all' }],
  upgrade: { effects: [{ kind: 'status', status: 'burningRelay', amount: 6, target: 'self' }, { kind: 'status', status: 'burn', amount: 21, target: 'all' }] },
  flavor: '灰烬城的葬礼只有一种形式。',
});
def({
  id: 'everburning',
  name: '不灭之火',
  type: 'power',
  rarity: 'rare',
  archetype: 'cinder',
  owner: 'picker',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'everburn', amount: 1, target: 'self' }],
  upgrade: { cost: 0 },
});
def({
  id: 'ember_tongue',
  name: '烬舌',
  type: 'skill',
  rarity: 'common',
  archetype: 'cinder',
  owner: 'picker',
  cost: 0,
  target: 'enemy',
  exhaust: true,
  effects: [
    { kind: 'conditional', cond: { kind: 'targetBurning' }, then: [{ kind: 'gainEmber', amount: 1 }] },
    { kind: 'status', status: 'burn', amount: 1, target: 'target' },
    { kind: 'draw', amount: 1 },
  ],
  upgrade: {
    effects: [
      { kind: 'conditional', cond: { kind: 'targetBurning' }, then: [{ kind: 'gainEmber', amount: 1 }] },
      { kind: 'status', status: 'burn', amount: 2, target: 'target' },
      { kind: 'draw', amount: 1 },
    ],
  },
});

// ---------- 拾灰者：灰烬（消耗） ----------
def({
  id: 'pick_up',
  name: '拾取',
  type: 'skill',
  rarity: 'starter',
  archetype: 'ash',
  owner: 'picker',
  cost: 0,
  target: 'self',
  exhaust: true,
  effects: [{ kind: 'draw', amount: 1 }],
  upgrade: { effects: [{ kind: 'draw', amount: 2 }] },
  flavor: '别人不要的，我要。',
});
def({
  id: 'burn_pages',
  name: '焚书',
  type: 'skill',
  rarity: 'common',
  archetype: 'ash',
  owner: 'picker',
  cost: 0,
  target: 'self',
  exhaust: true,
  effects: [{ kind: 'exhaustHand', count: 1, energyPerCard: 1 }],
  upgrade: {
    effects: [
      { kind: 'exhaustHand', count: 1, energyPerCard: 1 },
      { kind: 'draw', amount: 1 },
    ],
  },
});
def({
  id: 'bone_ash',
  name: '骨灰',
  type: 'attack',
  rarity: 'common',
  archetype: 'ash',
  owner: 'picker',
  cost: 1,
  target: 'enemy',
  exhaust: true,
  effects: [{ kind: 'damage', amount: 18, perExhaustedCard: 2, exhaustBonusMax: 12 }],
  upgrade: { effects: [{ kind: 'damage', amount: 25, perExhaustedCard: 3, exhaustBonusMax: 18 }] },
});
def({
  id: 'ash_feast',
  name: '灰烬盛宴',
  type: 'power',
  rarity: 'uncommon',
  archetype: 'ash',
  owner: 'picker',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'ashFeast', amount: 4, target: 'self' }, { kind: 'status', status: 'ashInsight', amount: 1, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'ashFeast', amount: 6, target: 'self' }, { kind: 'status', status: 'ashInsight', amount: 1, target: 'self' }] },
});
def({
  id: 'pass_the_flame',
  name: '火种传递',
  type: 'power',
  rarity: 'uncommon',
  archetype: 'ash',
  owner: 'picker',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'kindling', amount: 8, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'kindling', amount: 12, target: 'self' }] },
});
def({
  id: 'burn_it_all',
  name: '焚尽',
  type: 'attack',
  rarity: 'rare',
  archetype: 'ash',
  owner: 'picker',
  cost: 2,
  target: 'enemy',
  effects: [{ kind: 'exhaustHand', count: 'all', damagePerCard: 9 }],
  upgrade: { effects: [{ kind: 'exhaustHand', count: 'all', damagePerCard: 12 }] },
  flavor: '什么都不留下。',
});
def({
  id: 'ash_return',
  name: '灰烬再临',
  type: 'skill',
  rarity: 'uncommon',
  archetype: 'ash',
  owner: 'picker',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'returnExhausted', count: 1, selection: 'highestCost' }, { kind: 'conditional', cond: { kind: 'exhaustedThisTurn' }, then: [{ kind: 'block', amount: 9 }] }],
  upgrade: { effects: [{ kind: 'returnExhausted', count: 2, selection: 'highestCost' }, { kind: 'conditional', cond: { kind: 'exhaustedThisTurn' }, then: [{ kind: 'block', amount: 12 }] }] },
});
def({
  id: 'dust_to_dust',
  name: '尘归尘',
  type: 'skill',
  rarity: 'common',
  archetype: 'ash',
  owner: 'picker',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'exhaustHand', count: 'all', filter: 'curse' }, { kind: 'block', amount: 9 }],
  upgrade: { effects: [{ kind: 'exhaustHand', count: 'all', filter: 'curse' }, { kind: 'block', amount: 13 }] },
});
def({
  id: 'ash_offering',
  name: '献灰',
  type: 'skill',
  rarity: 'rare',
  archetype: 'ash',
  owner: 'picker',
  cost: 1,
  target: 'self',
  exhaust: true,
  effects: [
    { kind: 'exhaustHand', count: 2 },
    { kind: 'gainEmber', amount: 4 },
    { kind: 'draw', amount: 2 },
  ],
  upgrade: {
    effects: [
      { kind: 'exhaustHand', count: 2 },
      { kind: 'gainEmber', amount: 5 },
      { kind: 'draw', amount: 3 },
    ],
  },
});

// ---------- 血誓者：血誓 ----------
def({
  id: 'blood_edge',
  name: '血刃',
  type: 'attack',
  rarity: 'starter',
  archetype: 'blood',
  owner: 'oathbound',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'loseHp', amount: 2 }, { kind: 'damage', amount: 14 }],
  upgrade: { effects: [{ kind: 'loseHp', amount: 2 }, { kind: 'damage', amount: 18 }] },
  flavor: '刀刃先尝过持刀者的血。',
});
def({
  id: 'blood_rite',
  name: '血祭',
  type: 'skill',
  rarity: 'common',
  archetype: 'blood',
  owner: 'oathbound',
  cost: 0,
  target: 'self',
  exhaust: true,
  effects: [
    { kind: 'loseHp', amount: 3 },
    { kind: 'draw', amount: 2 },
    { kind: 'energy', amount: 1 },
  ],
  upgrade: {
    effects: [
      { kind: 'loseHp', amount: 3 },
      { kind: 'draw', amount: 3 },
      { kind: 'energy', amount: 1 },
    ],
  },
});
def({
  id: 'leech_bite',
  name: '吸血撕咬',
  type: 'attack',
  rarity: 'common',
  archetype: 'blood',
  owner: 'oathbound',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 7, lifesteal: true, lifestealCap: 6 }],
  upgrade: { effects: [{ kind: 'damage', amount: 10, lifesteal: true, lifestealCap: 8 }] },
});
def({
  id: 'blood_pact',
  name: '血契',
  type: 'power',
  rarity: 'uncommon',
  archetype: 'blood',
  owner: 'oathbound',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'bloodRage', amount: 1, target: 'self' }, { kind: 'status', status: 'bloodDraw', amount: 1, target: 'self' }],
  upgrade: { cost: 0, effects: [{ kind: 'status', status: 'bloodRage', amount: 1, target: 'self' }, { kind: 'status', status: 'bloodDraw', amount: 2, target: 'self' }] },
});
def({
  id: 'martyr',
  name: '殉道',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'blood',
  owner: 'oathbound',
  cost: 2,
  target: 'enemy',
  effects: [{ kind: 'loseHp', amount: 5 }, { kind: 'damage', amount: 30 }],
  upgrade: { effects: [{ kind: 'loseHp', amount: 5 }, { kind: 'damage', amount: 38 }] },
});
def({
  id: 'numb',
  name: '痛觉麻痹',
  type: 'skill',
  rarity: 'common',
  archetype: 'blood',
  owner: 'oathbound',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'block', amount: 8 }, { kind: 'conditional', cond: { kind: 'lostHpThisTurn' }, then: [{ kind: 'block', amount: 5 }] }],
  upgrade: { effects: [{ kind: 'block', amount: 11 }, { kind: 'conditional', cond: { kind: 'lostHpThisTurn' }, then: [{ kind: 'block', amount: 6 }] }] },
});
def({
  id: 'crimson_mail',
  name: '猩红护甲',
  type: 'power',
  rarity: 'rare',
  archetype: 'blood',
  owner: 'oathbound',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'block', amount: 12 }, { kind: 'status', status: 'recoveryArmor', amount: 12, target: 'self' }],
  upgrade: { effects: [{ kind: 'block', amount: 17 }, { kind: 'status', status: 'recoveryArmor', amount: 18, target: 'self' }] },
});
def({
  id: 'sanguine',
  name: '饮血',
  type: 'power',
  rarity: 'uncommon',
  archetype: 'blood',
  owner: 'oathbound',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'sanguine', amount: 6, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'sanguine', amount: 9, target: 'self' }] },
});
def({
  id: 'eye_for_eye',
  name: '以血还血',
  type: 'attack',
  rarity: 'common',
  archetype: 'blood',
  owner: 'oathbound',
  cost: 1,
  target: 'enemy',
  effects: [
    { kind: 'damage', amount: 6 },
    { kind: 'damagePerHpLost', mult: 2 },
  ],
  upgrade: {
    effects: [
      { kind: 'damage', amount: 9 },
      { kind: 'damagePerHpLost', mult: 3 },
    ],
  },
});

// ---------- 血誓者：狂力 ----------
def({
  id: 'flex',
  name: '蓄力',
  type: 'skill',
  rarity: 'starter',
  archetype: 'might',
  owner: 'oathbound',
  cost: 0,
  target: 'self',
  effects: [{ kind: 'tempStrength', amount: 1 }],
  upgrade: { effects: [{ kind: 'tempStrength', amount: 2 }] },
});
def({
  id: 'inflame',
  name: '怒吼',
  type: 'power',
  rarity: 'common',
  archetype: 'might',
  owner: 'oathbound',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'strength', amount: 3, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'strength', amount: 4, target: 'self' }] },
});
def({
  id: 'bone_crusher',
  name: '碎骨',
  type: 'attack',
  rarity: 'common',
  archetype: 'might',
  owner: 'oathbound',
  cost: 2,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 24 }, { kind: 'conditional', cond: { kind: 'strengthAtLeast', value: 3 }, then: [{ kind: 'energy', amount: 1 }] }],
  upgrade: { effects: [{ kind: 'damage', amount: 32 }, { kind: 'conditional', cond: { kind: 'strengthAtLeast', value: 3 }, then: [{ kind: 'energy', amount: 1 }] }] },
});
def({
  id: 'overpower',
  name: '力量碾压',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'might',
  owner: 'oathbound',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 8, strengthMult: 2 }],
  upgrade: { effects: [{ kind: 'damage', amount: 11, strengthMult: 2 }] },
  flavor: '力量越大，责任越小。',
});
def({
  id: 'frenzy',
  name: '狂暴',
  type: 'skill',
  rarity: 'uncommon',
  archetype: 'might',
  owner: 'oathbound',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'tempStrength', amount: 4 }, { kind: 'draw', amount: 1 }],
  upgrade: { effects: [{ kind: 'tempStrength', amount: 6 }, { kind: 'draw', amount: 1 }] },
});
def({
  id: 'demon_heart',
  name: '恶魔之心',
  type: 'power',
  rarity: 'rare',
  archetype: 'might',
  owner: 'oathbound',
  cost: 2,
  target: 'self',
  effects: [{ kind: 'status', status: 'demonHeart', amount: 2, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'demonHeart', amount: 3, target: 'self' }] },
});
def({
  id: 'heavy_blow',
  name: '重锤',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'might',
  owner: 'oathbound',
  cost: 2,
  target: 'enemy',
  effects: [{ kind: 'removeBlock' }, { kind: 'damage', amount: 20 }],
  upgrade: { effects: [{ kind: 'removeBlock' }, { kind: 'damage', amount: 27 }] },
});
def({
  id: 'intimidate',
  name: '震慑',
  type: 'skill',
  rarity: 'common',
  archetype: 'might',
  owner: 'oathbound',
  cost: 0,
  target: 'all_enemies',
  exhaust: true,
  effects: [{ kind: 'status', status: 'weak', amount: 1, target: 'all' }],
  upgrade: { effects: [{ kind: 'status', status: 'weak', amount: 2, target: 'all' }] },
});
def({
  id: 'blood_fury',
  name: '血怒',
  type: 'attack',
  rarity: 'rare',
  archetype: 'might',
  owner: 'oathbound',
  cost: 1,
  target: 'all_enemies',
  effects: [
    { kind: 'loseHp', amount: 3 },
    { kind: 'damage', amount: 5, times: 2, aoe: true },
    { kind: 'tempStrength', amount: 2 },
  ],
  upgrade: {
    effects: [
      { kind: 'loseHp', amount: 3 },
      { kind: 'damage', amount: 7, times: 2, aoe: true },
      { kind: 'tempStrength', amount: 3 },
    ],
  },
});

// ---------- 灰语学者：回响 ----------
def({
  id: 'echo_card',
  name: '回响',
  type: 'skill',
  rarity: 'starter',
  archetype: 'echo',
  owner: 'scholar',
  cost: 1,
  target: 'self',
  exhaust: true,
  effects: [{ kind: 'status', status: 'echo', amount: 1, target: 'self' }, { kind: 'block', amount: 5 }],
  upgrade: { exhaust: false, effects: [{ kind: 'status', status: 'echo', amount: 1, target: 'self' }, { kind: 'block', amount: 7 }] },
  flavor: '每句话，古城都会复述一遍。',
});
def({
  id: 'double_chant',
  name: '双重咏唱',
  type: 'skill',
  rarity: 'uncommon',
  archetype: 'echo',
  owner: 'scholar',
  cost: 1,
  target: 'self',
  exhaust: true,
  effects: [{ kind: 'status', status: 'echo', amount: 2, target: 'self' }],
  upgrade: { cost: 0 },
});
def({
  id: 'echo_blade',
  name: '回声刃',
  type: 'attack',
  rarity: 'common',
  archetype: 'echo',
  owner: 'scholar',
  cost: 1,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 8 }, { kind: 'draw', amount: 1 }, { kind: 'conditional', cond: { kind: 'hasEcho' }, then: [{ kind: 'gainEmber', amount: 1 }] }],
  upgrade: { effects: [{ kind: 'damage', amount: 11 }, { kind: 'draw', amount: 1 }, { kind: 'conditional', cond: { kind: 'hasEcho' }, then: [{ kind: 'gainEmber', amount: 1 }] }] },
});
def({
  id: 'resonance',
  name: '共鸣',
  type: 'power',
  rarity: 'rare',
  archetype: 'echo',
  owner: 'scholar',
  cost: 2,
  target: 'self',
  effects: [{ kind: 'status', status: 'resonance', amount: 1, target: 'self' }],
  upgrade: { cost: 1 },
});
def({
  id: 'mirror',
  name: '镜像',
  type: 'power',
  rarity: 'uncommon',
  archetype: 'echo',
  owner: 'scholar',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'mirror', amount: 1, target: 'self' }],
  upgrade: { cost: 0 },
});
def({
  id: 'ash_word',
  name: '灰语',
  type: 'skill',
  rarity: 'common',
  archetype: 'echo',
  owner: 'scholar',
  cost: 1,
  target: 'enemy',
  effects: [
    { kind: 'status', status: 'weak', amount: 1, target: 'target' },
    { kind: 'status', status: 'vulnerable', amount: 1, target: 'target' },
  ],
  upgrade: {
    effects: [
      { kind: 'status', status: 'weak', amount: 2, target: 'target' },
      { kind: 'status', status: 'vulnerable', amount: 2, target: 'target' },
    ],
  },
});
def({
  id: 'aria',
  name: '咏叹',
  type: 'skill',
  rarity: 'common',
  archetype: 'echo',
  owner: 'scholar',
  cost: 1,
  target: 'self',
  effects: [
    { kind: 'draw', amount: 2 },
    { kind: 'conditional', cond: { kind: 'hasEcho' }, then: [{ kind: 'gainEmber', amount: 2 }] },
  ],
  upgrade: {
    effects: [
      { kind: 'draw', amount: 3 },
      { kind: 'conditional', cond: { kind: 'hasEcho' }, then: [{ kind: 'gainEmber', amount: 2 }] },
    ],
  },
});
def({
  id: 'rune_burst',
  name: '符文爆发',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'echo',
  owner: 'scholar',
  cost: 2,
  target: 'all_enemies',
  effects: [{ kind: 'damage', amount: 11, aoe: true }, { kind: 'conditional', cond: { kind: 'hasEcho' }, then: [{ kind: 'damage', amount: 4, aoe: true }] }],
  upgrade: { effects: [{ kind: 'damage', amount: 15, aoe: true }, { kind: 'conditional', cond: { kind: 'hasEcho' }, then: [{ kind: 'damage', amount: 6, aoe: true }] }] },
});
def({
  id: 'finale',
  name: '终章',
  type: 'attack',
  rarity: 'rare',
  archetype: 'echo',
  owner: 'scholar',
  cost: 2,
  target: 'enemy',
  effects: [{ kind: 'damage', amount: 16, perHandCard: 2 }],
  upgrade: { effects: [{ kind: 'damage', amount: 22, perHandCard: 2 }] },
  flavor: '手里的每一页都是伏笔。',
});

// ---------- 灰语学者：专注 ----------
def({
  id: 'rune_shield',
  name: '符文护盾',
  type: 'skill',
  rarity: 'starter',
  archetype: 'focus',
  owner: 'scholar',
  cost: 1,
  target: 'self',
  retain: true,
  charge: { block: 3 },
  effects: [{ kind: 'block', amount: 5 }],
  upgrade: { effects: [{ kind: 'block', amount: 8 }] },
});
def({
  id: 'focus',
  name: '专注',
  type: 'skill',
  rarity: 'common',
  archetype: 'focus',
  owner: 'scholar',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'energyNext', amount: 2, target: 'self' }, { kind: 'chargeHand', amount: 1 }],
  upgrade: { effects: [{ kind: 'status', status: 'energyNext', amount: 3, target: 'self' }, { kind: 'chargeHand', amount: 1 }] },
});
def({
  id: 'rune_wall',
  name: '符文壁',
  type: 'skill',
  rarity: 'uncommon',
  archetype: 'focus',
  owner: 'scholar',
  cost: 1,
  target: 'self',
  retain: true,
  exhaust: true,
  charge: { block: 4 },
  effects: [{ kind: 'block', amount: 9 }, { kind: 'status', status: 'metallicize', amount: 2, target: 'self' }],
  upgrade: { effects: [{ kind: 'block', amount: 13 }, { kind: 'status', status: 'metallicize', amount: 3, target: 'self' }] },
});
def({
  id: 'charged_blade',
  name: '蓄势之刃',
  type: 'attack',
  rarity: 'uncommon',
  archetype: 'focus',
  owner: 'scholar',
  cost: 1,
  target: 'enemy',
  retain: true,
  charge: { damage: 4 },
  effects: [{ kind: 'damage', amount: 10 }],
  upgrade: { effects: [{ kind: 'damage', amount: 14 }] },
});
def({
  id: 'meditate',
  name: '冥想',
  type: 'skill',
  rarity: 'common',
  archetype: 'focus',
  owner: 'scholar',
  cost: 0,
  target: 'self',
  retain: true,
  exhaust: true,
  effects: [
    { kind: 'conditional', cond: { kind: 'hasBlock' }, then: [{ kind: 'status', status: 'energyNext', amount: 1, target: 'self' }] },
    { kind: 'draw', amount: 1 },
  ],
  upgrade: {
    effects: [
      { kind: 'conditional', cond: { kind: 'hasBlock' }, then: [{ kind: 'status', status: 'energyNext', amount: 2, target: 'self' }] },
      { kind: 'draw', amount: 1 },
    ],
  },
});
def({
  id: 'erudition',
  name: '博学',
  type: 'power',
  rarity: 'rare',
  archetype: 'focus',
  owner: 'scholar',
  cost: 2,
  target: 'self',
  effects: [{ kind: 'status', status: 'study', amount: 1, target: 'self' }],
  upgrade: { cost: 1 },
});
def({
  id: 'ward_rune',
  name: '守护符文',
  type: 'power',
  rarity: 'uncommon',
  archetype: 'focus',
  owner: 'scholar',
  cost: 1,
  target: 'self',
  effects: [{ kind: 'status', status: 'arcaneWard', amount: 2, target: 'self' }, { kind: 'status', status: 'chargeMaster', amount: 1, target: 'self' }],
  upgrade: { effects: [{ kind: 'status', status: 'arcaneWard', amount: 3, target: 'self' }, { kind: 'status', status: 'chargeMaster', amount: 1, target: 'self' }] },
});
def({
  id: 'ash_equation',
  name: '灰烬方程',
  type: 'skill',
  rarity: 'rare',
  archetype: 'focus',
  owner: 'scholar',
  cost: 1,
  target: 'self',
  exhaust: true,
  effects: [
    { kind: 'doubleEmber' },
    { kind: 'draw', amount: 2 },
  ],
  upgrade: { cost: 0 },
});
def({
  id: 'foresight',
  name: '预读',
  type: 'skill',
  rarity: 'common',
  archetype: 'focus',
  owner: 'scholar',
  cost: 1,
  target: 'self',
  effects: [
    { kind: 'draw', amount: 3 },
    { kind: 'discardRandom', count: 1 },
  ],
  upgrade: {
    effects: [
      { kind: 'draw', amount: 4 },
      { kind: 'discardRandom', count: 1 },
    ],
  },
});

// ---------- 诅咒 ----------
def({
  id: 'ashes',
  name: '灰烬',
  type: 'curse',
  rarity: 'curse',
  archetype: 'curse',
  cost: -1,
  target: 'none',
  effects: [],
  upgrade: {},
  flavor: '无法打出。占据手牌。',
});

EXTRA_CHARACTER_CARDS.forEach(def);
EXTRA_SHARED_CARDS.forEach(def);
EXTRA_CURSES.forEach(def);
CYCLE_CARDS.forEach(def);
export const CARD_LIST: CardDef[] = Object.values(CARDS);

export function cardsOfRarity(r: CardDef['rarity']): CardDef[] {
  return CARD_LIST.filter((c) => c.rarity === r);
}

export function cardAvailableTo(c: CardDef, character: CharacterId): boolean {
  return !c.owner || c.owner === character;
}
