import type { EventDef } from '../engine/types';

export const CHAPTER_TWO_EVENTS: EventDef[] = [
  {
    id: 'deep_oath_furnace', chapter: 2, title: '誓约熔炉', icon: '⚖',
    text: '熄灭的炉膛中传来低声报价。它愿意给你力量，只要你带走一部分炉底的阴影。',
    choices: [
      { id: 'warmth', label: '借走炉温', detail: '回复 24 点生命，加入「冷灰」：留在手中到回合结束失去 2 点余烬。', outcomes: [{ kind: 'hp', amount: 24 }, { kind: 'curse', cardId: 'cold_ash' }] },
      { id: 'vitality', label: '重铸身躯', detail: '最大生命增加 8，加入「破绽」：留在手中到回合结束获得 1 层易伤。', outcomes: [{ kind: 'maxHp', amount: 8 }, { kind: 'curse', cardId: 'exposure' }] },
      { id: 'inherit', label: '继承遗物', detail: '获得随机遗物，加入「重负」：无法打出且每回合保留，直到被弃置或消耗。', outcomes: [{ kind: 'relic' }, { kind: 'curse', cardId: 'burden' }] },
      { id: 'leave', label: '拒绝誓约', detail: '不作交易。', outcomes: [] },
    ],
  },
  {
    id: 'deep_blacksmith', chapter: 2, title: '最后的铸匠', icon: '⚒',
    text: '一名铸匠独坐在冷却台前。他指着你的行囊：「武器可以重铸，旧伤却不能。你想留下哪一样？」',
    choices: [
      { id: 'temper', label: '淬炼卡牌', detail: '支付 40 金币，升级一张牌。', requireGold: 40, outcomes: [{ kind: 'gold', amount: -40 }, { kind: 'upgradeCard' }] },
      { id: 'scrap', label: '回收旧物', detail: '移除一张牌，获得 20 金币。', outcomes: [{ kind: 'removeCard' }, { kind: 'gold', amount: 20 }] },
      { id: 'leave', label: '告别', detail: '继续赶路。', outcomes: [] },
    ],
  },
  {
    id: 'deep_cooling_pool', chapter: 2, title: '冷却池', icon: '♨',
    text: '青蓝色的冷却液在石池里缓缓流动。附近堆着工匠用来止痛的药布，排水口则卡着一只金属匣子。',
    choices: [
      { id: 'rest', label: '包扎伤口', detail: '回复 18 点生命。', outcomes: [{ kind: 'hp', amount: 18 }] },
      { id: 'dive', label: '捞出匣子', detail: '失去 8 点生命，获得 65 金币。', requireHp: 9, outcomes: [{ kind: 'hp', amount: -8 }, { kind: 'gold', amount: 65 }] },
      { id: 'leave', label: '离开', detail: '不作停留。', outcomes: [] },
    ],
  },
  {
    id: 'deep_sealed_vault', chapter: 2, title: '封炉库房', icon: '⚙',
    text: '库房门上的封蜡早已融化，内部还剩一架完整的工匠遗物。取走它需要穿过烧红的铁栅。',
    choices: [
      { id: 'reach', label: '穿过铁栅', detail: '失去 12 点生命，获得一个随机遗物。', requireHp: 13, outcomes: [{ kind: 'hp', amount: -12 }, { kind: 'relic' }] },
      { id: 'study', label: '抄下工艺', detail: '获得一张随机罕见卡牌。', outcomes: [{ kind: 'card', rarity: 'uncommon' }] },
      { id: 'leave', label: '封上库房', detail: '什么也不取。', outcomes: [] },
    ],
  },
];
