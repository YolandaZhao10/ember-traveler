import type { StatusDef, StatusId } from '../engine/types';

export const STATUSES: Record<StatusId, StatusDef> = {
  strength: {
    id: 'strength',
    name: '力量',
    kind: 'buff',
    description: (n) => `攻击造成的伤害 ${n >= 0 ? '+' : ''}${n}。`,
  },
  dexterity: {
    id: 'dexterity',
    name: '敏捷',
    kind: 'buff',
    description: (n) => `卡牌获得的格挡 ${n >= 0 ? '+' : ''}${n}。`,
  },
  weak: {
    id: 'weak',
    name: '虚弱',
    kind: 'debuff',
    decays: true,
    description: (n) => `攻击造成的伤害减少 25%。剩余 ${n} 回合。`,
  },
  vulnerable: {
    id: 'vulnerable',
    name: '易伤',
    kind: 'debuff',
    decays: true,
    description: (n) => `受到的攻击伤害增加 50%。剩余 ${n} 回合。`,
  },
  frail: {
    id: 'frail',
    name: '脆弱',
    kind: 'debuff',
    decays: true,
    description: (n) => `卡牌获得的格挡减少 25%。剩余 ${n} 回合。`,
  },
  thorns: {
    id: 'thorns',
    name: '荆棘',
    kind: 'buff',
    description: (n) => `每次受到攻击时，对攻击者造成 ${n} 点伤害。`,
  },
  burn: {
    id: 'burn',
    name: '燃烧',
    kind: 'debuff',
    description: (n) => `回合开始时受到 ${n} 点伤害（无视格挡），然后层数减 1。`,
  },
  metallicize: {
    id: 'metallicize',
    name: '钢铁意志',
    kind: 'power',
    description: (n) => `每回合结束时获得 ${n} 点格挡。`,
  },
  barricade: {
    id: 'barricade',
    name: '固守',
    kind: 'power',
    description: () => `格挡不会在回合开始时消失。`,
  },
  ritual: {
    id: 'ritual',
    name: '仪式',
    kind: 'buff',
    description: (n) => `每回合结束时获得 ${n} 点力量。`,
  },
  emberHeart: {
    id: 'emberHeart',
    name: '火种之心',
    kind: 'power',
    description: (n) => `每回合结束时获得 ${n} 点余烬。`,
  },
  flameAura: {
    id: 'flameAura',
    name: '焰柱',
    kind: 'power',
    description: (n) => `每回合开始时，对所有敌人造成等于余烬数${n > 1 ? ` +${n - 1}` : ''} 的伤害（不消耗余烬）。每张独立触发。`,
  },
  tempo: {
    id: 'tempo',
    name: '余音',
    kind: 'power',
    description: (n) => `生效后每打出 3 张牌，抽 ${n} 张牌。每张独立计数，进度跨回合保留。`,
  },
  crescendo: {
    id: 'crescendo',
    name: '战鼓',
    kind: 'power',
    description: (n) => `每打出一张攻击牌，本回合之后的攻击牌伤害 +${n}。`,
  },
  forge: {
    id: 'forge',
    name: '熔炉',
    kind: 'power',
    description: (n) => `每当你获得余烬时，每点余烬获得 ${n} 点格挡。`,
  },
  enrage: {
    id: 'enrage',
    name: '激怒',
    kind: 'buff',
    description: (n) => `每当玩家打出技能牌时，获得 ${n} 点力量。`,
  },
  vengeance: {
    id: 'vengeance',
    name: '复仇',
    kind: 'buff',
    description: (n) => `同伴倒下时已获得 ${n} 点力量并变得愤怒。`,
  },
  regen: {
    id: 'regen',
    name: '再生',
    kind: 'buff',
    description: (n) => `每回合结束时回复 ${n} 点生命。`,
  },
  ashFeast: {
    id: 'ashFeast',
    name: '灰烬盛宴',
    kind: 'power',
    description: (n) => `每当你的一张牌被消耗时，获得 ${n} 点格挡。`,
  },
  kindling: {
    id: 'kindling',
    name: '火种传递',
    kind: 'power',
    description: (n) => `每当你的一张牌被消耗时，对随机敌人造成 ${n} 点伤害。`,
  },
  pyre: {
    id: 'pyre',
    name: '火葬',
    kind: 'power',
    description: (n) => `每回合结束时，所有敌人获得 ${n} 层燃烧。`,
  },
  everburn: {
    id: 'everburn',
    name: '不灭之火',
    kind: 'power',
    description: () => `敌人的燃烧层数不再随回合减少。`,
  },
  strengthDown: {
    id: 'strengthDown',
    name: '力竭',
    kind: 'debuff',
    description: (n) => `回合结束时失去 ${n} 点力量。`,
  },
  bloodRage: {
    id: 'bloodRage',
    name: '血契',
    kind: 'power',
    description: (n) => `每当你因卡牌失去生命时，获得 ${n} 点力量。`,
  },
  bloodArmor: {
    id: 'bloodArmor',
    name: '猩红护甲',
    kind: 'power',
    description: (n) => `每当你失去生命时，获得 ${n} 点格挡。`,
  },
  sanguine: {
    id: 'sanguine',
    name: '饮血',
    kind: 'power',
    description: (n) => `每当敌人死亡时，回复 ${n} 点生命。`,
  },
  demonHeart: {
    id: 'demonHeart',
    name: '恶魔之心',
    kind: 'power',
    description: (n) => `每回合开始时获得 ${n} 点力量。`,
  },
  echo: {
    id: 'echo',
    name: '回响',
    kind: 'buff',
    description: (n) => `接下来打出的 ${n} 张非能力牌效果触发两次。`,
  },
  resonance: {
    id: 'resonance',
    name: '共鸣',
    kind: 'power',
    description: (n) => `每回合开始时获得 ${n} 层回响。`,
  },
  mirror: {
    id: 'mirror',
    name: '镜像',
    kind: 'power',
    description: (n) => `每回合生效后的第一张攻击牌额外触发 ${n} 次。每张独立触发，可与回响叠加。`,
  },
  energyNext: {
    id: 'energyNext',
    name: '蓄能',
    kind: 'buff',
    description: (n) => `下回合开始时获得 ${n} 点额外能量。`,
  },
  study: {
    id: 'study',
    name: '博学',
    kind: 'power',
    description: (n) => `每回合开始时多抽 ${n} 张牌。`,
  },
  arcaneWard: {
    id: 'arcaneWard',
    name: '守护符文',
    kind: 'power',
    description: (n) => `回合结束时，手牌中每有一张牌获得 ${n} 点格挡。`,
  },
};

export function statusName(id: StatusId): string {
  return STATUSES[id].name;
}
