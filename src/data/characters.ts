import type { Archetype, CharacterId } from '../engine/types';

/**
 * 招牌动作：各角色最常做的动作。共鸣牌按本回合的完成次数结算，
 * 卡面用 text 里的用语直接写出具体动作。
 */
export type SignatureKind =
  | 'guardedAttack'      // 打出时已有格挡的攻击牌
  | 'exhaust'            // 一张牌被消耗（含自身消耗）
  | 'burnCard'           // 打出的牌以自身效果对敌人施加了燃烧
  | 'cardHpLoss'         // 因卡牌失去生命
  | 'tempStrengthCard'   // 打出的牌以自身效果让自己获得临时力量
  | 'replayOrCharged';   // 完成回响或镜像重放、打出蓄力不少于 2 层的牌
export interface SignatureDef {
  /** 计数时机，可以有多个；每次都计 weight 次 */
  kinds: SignatureKind[];
  /** 每次动作计入的次数 */
  weight: number;
  /** 因卡牌单次失去生命不少于 atLeast 时改计 weight 次；label 是卡面上的称呼 */
  heavy?: { atLeast: number; weight: number; label: string };
  /**
   * each 接在「本回合」之后；reached 接在「若本回合」之后，nth 接在「每回合」之后。
   * actions 是按普通动作算所需的次数，heavyActions 是全靠大额失血时所需的次数（没有大额规则时两者相同）。
   */
  text: { each: string; reached: (actions: number, heavyActions: number) => string; nth: (actions: number, heavyActions: number) => string };
}

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
  signature: SignatureDef;
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
      { name: '连击', text: '先用低费攻击续势返能，再用多段终结技兑现连击。' },
      { name: '壁垒', text: '保留剩余格挡，再决定用盾反击还是碎盾爆发。' },
      { name: '余烬', text: '先积累余烬，再一次性爆发。' },
    ],
    signature: {
      kinds: ['guardedAttack'], weight: 1,
      text: { each: '拥有格挡时每打出 1 张攻击牌', reached: n => `拥有格挡时已打出 ${n} 张以上攻击牌`, nth: n => `拥有格挡时打出第 ${n} 张攻击牌后` },
    },
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
      { name: '灰烬', text: '消耗补牌、护体与伤害，付费回收时也获得防护。' },
      { name: '余烬', text: '与旅人共享的余烬卡池。' },
    ],
    signature: {
      kinds: ['exhaust', 'burnCard'], weight: 1,
      text: {
        each: '每有 1 张牌被消耗、每打出 1 张施加燃烧的牌',
        reached: n => `被消耗的牌与打出的施加燃烧的牌合计 ${n} 张以上`,
        nth: n => `被消耗的牌与打出的施加燃烧的牌合计达到 ${n} 张时`,
      },
    },
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
      { name: '血誓', text: '失血换节奏，吸血回补；可组合失血起甲与实际治疗转甲。' },
      { name: '狂力', text: '安排临时力量的爆发回合，用多段与力量倍率收割。' },
      { name: '余烬', text: '与其他角色共享的余烬卡池。' },
    ],
    signature: {
      kinds: ['cardHpLoss', 'tempStrengthCard'], weight: 2, heavy: { atLeast: 4, weight: 3, label: '单次失去 4 点以上' },
      text: {
        each: '每次因卡牌失去生命、每打出 1 张获得临时力量的牌',
        reached: (n, heavy) => `因卡牌失去生命与打出获得临时力量的牌合计 ${n} 次以上${heavy < n ? `，或有 ${heavy} 次单次失去 4 点以上生命` : ''}`,
        nth: (n, heavy) => `因卡牌失去生命与打出获得临时力量的牌合计达到 ${n} 次时${heavy < n ? `，或${heavy > 1 ? `第 ${heavy} 次` : ''}单次失去 4 点以上生命时` : ''}`,
      },
    },
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
      { name: '专注', text: '保留牌蓄力，提前存能；达到蓄力门槛后释放返能。' },
      { name: '余烬', text: '与其他角色共享的余烬卡池。' },
    ],
    signature: {
      kinds: ['replayOrCharged'], weight: 2,
      text: { each: '每完成 1 次回响或镜像重放、每打出 1 张蓄力 ≥2 的牌', reached: n => `已完成 ${n} 次以上回响、镜像重放或打出蓄力 ≥2 的牌`, nth: n => `第 ${n} 次完成回响、镜像重放或打出蓄力 ≥2 的牌时` },
    },
    sprite: 'scholar',
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);
