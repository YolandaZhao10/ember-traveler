import type { EventDef } from '../engine/types';
import { CHAPTER_TWO_EVENTS } from './events2';
import { CHAPTER_THREE_EVENTS } from './events3';
import { EXTRA_EVENTS } from './extraEvents';

export const EVENTS: Record<string, EventDef> = {};
function def(e: EventDef) {
  if (EVENTS[e.id]) throw new Error(`重复事件 ID：${e.id}`);
  EVENTS[e.id] = e;
}

def({
  id: 'ash_altar',
  title: '灰烬祭坛',
  icon: '🕯️',
  text: '一座被灰覆盖的祭坛。石面上刻着：「以血换火，以火换路。」祭坛中央有一只凹槽，恰好能放下你的灯。',
  choices: [
    {
      id: 'blood',
      label: '献上鲜血',
      detail: '失去 7 点生命，获得一张随机稀有卡牌。',
      requireHp: 8,
      outcomes: [
        { kind: 'hp', amount: -7 },
        { kind: 'card', rarity: 'rare' },
      ],
    },
    {
      id: 'gold',
      label: '献上金币',
      detail: '支付 40 金币，获得一个随机遗物。',
      requireGold: 40,
      outcomes: [
        { kind: 'gold', amount: -40 },
        { kind: 'relic' },
      ],
    },
    { id: 'leave', label: '离开', detail: '什么也不做。', outcomes: [] },
  ],
});

def({
  id: 'lost_peddler',
  weight: 0.35,
  title: '迷途商贩',
  icon: '🎒',
  text: '一个推着破车的商贩从灰雾里钻出来。「要清一清行囊吗？或者，挑件旧物带上。难得遇见旅人，这件就送你了。」',
  choices: [
    {
      id: 'remove',
      label: '付钱删牌',
      detail: '支付 45 金币，从牌组中移除一张牌。',
      requireGold: 45,
      outcomes: [{ kind: 'gold', amount: -45 }, { kind: 'removeCard' }],
    },
    {
      id: 'relic',
      label: '收下旅途赠礼',
      detail: '免费获得一件随机遗物。',
      outcomes: [{ kind: 'relic' }],
    },
    { id: 'leave', label: '离开', detail: '谢绝好意。', outcomes: [] },
  ],
});

def({
  id: 'silent_well',
  title: '寂静井',
  icon: '🪣',
  text: '一口古井，井水异常清澈，却映不出你的脸。井沿散落着别人丢下的硬币。',
  choices: [
    {
      id: 'drink',
      label: '饮水',
      detail: '回复 18 点生命，但一张「灰烬」诅咒卡会混入牌组。',
      outcomes: [
        { kind: 'hp', amount: 18 },
        { kind: 'curse', cardId: 'ashes' },
      ],
    },
    {
      id: 'coins',
      label: '捞取硬币',
      detail: '获得 35 金币，失去 4 点最大生命。',
      outcomes: [
        { kind: 'gold', amount: 35 },
        { kind: 'maxHp', amount: -4 },
      ],
    },
    { id: 'leave', label: '离开', detail: '不去打扰井水。', outcomes: [] },
  ],
});

def({
  id: 'gravekeeper',
  title: '守墓人',
  icon: '⚰️',
  text: '一个佝偻的老人在整理无名墓碑。他没有抬头：「活人来这里，总是想要点什么。」',
  choices: [
    {
      id: 'upgrade',
      label: '请他磨刀',
      detail: '升级一张牌，失去 5 点最大生命。',
      outcomes: [{ kind: 'upgradeCard' }, { kind: 'maxHp', amount: -5 }],
    },
    {
      id: 'help',
      label: '帮他干活',
      detail: '获得 25 金币，受到 6 点伤害。',
      requireHp: 7,
      outcomes: [
        { kind: 'gold', amount: 25 },
        { kind: 'hp', amount: -6 },
      ],
    },
    { id: 'leave', label: '离开', detail: '让他继续安静。', outcomes: [] },
  ],
});

def({
  id: 'ember_sprite',
  title: '余火幼灵',
  icon: '✨',
  text: '一团小小的火焰在你的灯旁打转，似乎想钻进去。它看上去很不稳定。',
  choices: [
    {
      id: 'absorb',
      label: '让它进灯',
      detail: '70% 概率获得遗物「炭心」；否则灯芯炸开，受到 10 点伤害。',
      outcomes: [
        {
          kind: 'chance',
          p: 0.7,
          success: [{ kind: 'relic', relicId: 'charcoal_heart' }],
          fail: [{ kind: 'hp', amount: -10 }],
          successText: '火焰安静地沉入灯芯，灯光变得更稳定了。',
          failText: '灯芯猛地炸开，灼伤了你的手。',
        },
      ],
    },
    {
      id: 'warm',
      label: '借它取暖',
      detail: '回复 10 点生命。',
      outcomes: [{ kind: 'hp', amount: 10 }],
    },
    { id: 'leave', label: '离开', detail: '任它飘走。', outcomes: [] },
  ],
});

def({
  id: 'fallen_belltower',
  title: '倒塌的钟楼',
  icon: '🔔',
  text: '钟楼横倒在街道上，巨钟半埋在瓦砾里。缝隙中隐约有金属的光。',
  choices: [
    {
      id: 'search',
      label: '钻进去搜索',
      detail: '50% 概率获得 60 金币；否则瓦砾塌落，受到 12 点伤害。',
      outcomes: [
        {
          kind: 'chance',
          p: 0.5,
          success: [{ kind: 'gold', amount: 60 }],
          fail: [{ kind: 'hp', amount: -12 }],
          successText: '你在钟舌下找到一个装满金币的小匣子。',
          failText: '一块石板滑落，砸在你肩上。',
        },
      ],
    },
    {
      id: 'ring',
      label: '敲响巨钟',
      detail: '获得一张随机非基础卡牌。',
      outcomes: [{ kind: 'card' }],
    },
    { id: 'leave', label: '绕行', detail: '不冒险。', outcomes: [] },
  ],
});

def({
  id: 'cursed_reliquary', title: '低语遗匣', icon: '🗝️',
  text: '石匣里摆着三件无主之物。每当你伸手，便听见一个声音说出它的代价。',
  choices: [
    { id: 'coins', label: '取走钱囊', detail: '获得 80 金币，加入「悔恨」：留在手中到回合结束失去 2 点生命。', outcomes: [{ kind: 'gold', amount: 80 }, { kind: 'curse', cardId: 'regret' }] },
    { id: 'manuscript', label: '翻开秘卷', detail: '获得一张稀有卡，加入「疑惧」：留在手中到回合结束获得 1 层虚弱。', outcomes: [{ kind: 'card', rarity: 'rare' }, { kind: 'curse', cardId: 'doubt' }] },
    { id: 'relic', label: '拿起遗物', detail: '获得随机遗物，加入「朽败」：留在手中到回合结束获得 1 层脆弱。', outcomes: [{ kind: 'relic' }, { kind: 'curse', cardId: 'frailty' }] },
    { id: 'leave', label: '合上石匣', detail: '不作交易。', outcomes: [] },
  ],
});
CHAPTER_TWO_EVENTS.forEach(def);
CHAPTER_THREE_EVENTS.forEach(def);
EXTRA_EVENTS.forEach(def);
export const EVENT_LIST = Object.values(EVENTS);
