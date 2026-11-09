import type { Archetype, CharacterId } from '../engine/types';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  description: string;
  maxHp: number;
  gold: number;
  starterDeck: string[];
  starterRelic: string;
  archetypes: Archetype[];
  routes: { name: string; text: string }[];
  sprite: 'traveler' | 'picker' | 'oathbound' | 'scholar';
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  traveler: {
    id: 'traveler',
    name: '旅人',
    title: '携带最后火种的人',
    description: '稳健的全能者。以余烬灯积累余烬，可走连击、壁垒或余烬三条路线。',
    maxHp: 72,
    gold: 80,
    starterDeck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'kindle', 'ash_step'],
    starterRelic: 'ember_lantern',
    archetypes: ['basic', 'combo', 'bulwark', 'ember'],
    routes: [
      { name: '连击', text: '低费牌、抽牌与多段攻击形成节奏。' },
      { name: '壁垒', text: '格挡、荆棘与格挡转伤害。' },
      { name: '余烬', text: '先积累余烬，再一次性爆发。' },
    ],
    sprite: 'traveler',
  },
  picker: {
    id: 'picker',
    name: '拾灰者',
    title: '在灰烬中翻找遗物的人',
    description: '更激进、更依赖节奏。初始铃铛让所有敌人一开场就燃烧；擅长叠加燃烧并引爆，或主动消耗手牌换取资源。',
    maxHp: 66,
    gold: 80,
    starterDeck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'light_up', 'pick_up'],
    starterRelic: 'picker_bell',
    archetypes: ['basic', 'cinder', 'ash', 'ember'],
    routes: [
      { name: '焚烧', text: '给敌人叠加燃烧，用引爆、热浪借火放大伤害。' },
      { name: '灰烬', text: '消耗手牌换能量、格挡与伤害，再从消耗区取回。' },
      { name: '余烬', text: '与旅人共享的余烬卡池。' },
    ],
    sprite: 'picker',
  },
  oathbound: {
    id: 'oathbound',
    name: '血誓者',
    title: '以血为誓的斗士',
    description: '生命最高，但要用血换力量。失去生命可以换取抽牌、能量与伤害；堆叠力量后一击定胜负。',
    maxHp: 80,
    gold: 80,
    starterDeck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'blood_edge', 'flex'],
    starterRelic: 'blood_seal',
    archetypes: ['basic', 'blood', 'might', 'ember'],
    routes: [
      { name: '血誓', text: '失去生命换取资源与伤害，吸血回补，失血触发力量或格挡。' },
      { name: '狂力', text: '堆叠力量，用按力量倍增的攻击收割。' },
      { name: '余烬', text: '与其他角色共享的余烬卡池。' },
    ],
    sprite: 'oathbound',
  },
  scholar: {
    id: 'scholar',
    name: '灰语学者',
    title: '研读灰烬符文的人',
    description: '生命最低，但最会"算牌"。回响让下一张牌触发两次；保留在手的蓄力牌越等越强；还能为下回合储存能量。',
    maxHp: 52,
    gold: 80,
    starterDeck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'echo_card', 'rune_shield'],
    starterRelic: 'echo_stone',
    archetypes: ['basic', 'echo', 'focus', 'ember'],
    routes: [
      { name: '回响', text: '让下一张牌触发两次，放大关键牌。' },
      { name: '专注', text: '保留蓄力牌、储存能量、多抽牌。' },
      { name: '余烬', text: '与其他角色共享的余烬卡池。' },
    ],
    sprite: 'scholar',
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);
