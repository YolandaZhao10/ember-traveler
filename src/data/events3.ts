import type { EventChoice, EventDef } from '../engine/types';

const leave: EventChoice = { id: 'leave', label: '继续攀登', detail: '不作交易。', outcomes: [] };
/** 星骸天穹的独立事件池；终章为固定路线，不抽取事件。 */
export const CHAPTER_THREE_EVENTS: EventDef[] = [
  {
    id: 'sky_fallen_observatory', chapter: 3, title: '坠落观星台', icon: '🔭',
    text: '镜筒仍朝着早已熄灭的星辰。你可以沿裂开的边缘取下星石，也可以抄录幸存的观测笔记。',
    choices: [
      { id: 'star', label: '取回流浪星', detail: '失去 12 点生命，获得「流浪星石」。', requireHp: 13, outcomes: [{ kind: 'hp', amount: -12 }, { kind: 'eventRelic', relicId: 'vagrant_star' }] },
      { id: 'notes', label: '抄录星图', detail: '获得一张随机罕见卡牌。', outcomes: [{ kind: 'card', rarity: 'uncommon' }] }, leave,
    ],
  },
  {
    id: 'sky_moon_pool', chapter: 3, title: '无底月池', icon: '🌙',
    text: '月光在没有水的石池里泛起波纹。池底的贝壳轻声呼唤，岸上有一捧温暖的星泉。',
    choices: [
      { id: 'shell', label: '潜入月影', detail: '支付 55 金币，获得「月井螺壳」。', requireGold: 55, outcomes: [{ kind: 'gold', amount: -55 }, { kind: 'eventRelic', relicId: 'moonlit_shell' }] },
      { id: 'drink', label: '饮下星泉', detail: '回复 22 点生命。', outcomes: [{ kind: 'hp', amount: 22 }] }, leave,
    ],
  },
  {
    id: 'sky_silent_choir', chapter: 3, title: '无声唱诗班', icon: '🎶',
    text: '空袍围成一圈，歌声只在脑海里响起。它们请求你带走最后一节旋律。',
    choices: [
      { id: 'song', label: '记住末节', detail: '获得「失传摇篮曲」，加入诅咒「疑惧」。', outcomes: [{ kind: 'eventRelic', relicId: 'forgotten_lullaby' }, { kind: 'curse', cardId: 'doubt' }] },
      { id: 'listen', label: '静听一曲', detail: '回复 16 点生命。', outcomes: [{ kind: 'hp', amount: 16 }] }, leave,
    ],
  },
  {
    id: 'sky_mirror_orbit', chapter: 3, title: '破碎镜轨', icon: '🪞',
    text: '一圈月镜绕着空心支架旋转。其中一片倒映着你尚未走过的路。',
    choices: [
      { id: 'mirror', label: '握住未来', detail: '失去 10 点生命，获得「镜中残影」。', requireHp: 11, outcomes: [{ kind: 'hp', amount: -10 }, { kind: 'eventRelic', relicId: 'mirror_shard' }] },
      { id: 'release', label: '放下旧影', detail: '支付 25 金币，移除一张牌。', requireGold: 25, outcomes: [{ kind: 'gold', amount: -25 }, { kind: 'removeCard' }] }, leave,
    ],
  },
  {
    id: 'sky_last_minute', chapter: 3, title: '停在黎明前的钟', icon: '🕰️',
    text: '指针永远差一分钟走向天亮。钟下的守望人想用这段停滞的时间换你一点寿命。',
    choices: [
      { id: 'hour', label: '收下停滞之时', detail: '最大生命减少 6，获得「遗失的一刻」。', requireHp: 7, outcomes: [{ kind: 'maxHp', amount: -6 }, { kind: 'eventRelic', relicId: 'lost_hour' }] },
      { id: 'repair', label: '校准旧钟', detail: '获得 30 金币。', outcomes: [{ kind: 'gold', amount: 30 }] }, leave,
    ],
  },
  {
    id: 'sky_blank_constellation', chapter: 3, title: '无名星座', icon: '📜',
    text: '观星档案中有一页从未被写满。风将它翻到你的面前。',
    choices: [
      { id: 'page', label: '购买空白星页', detail: '支付 75 金币，获得「无字残页」。', requireGold: 75, outcomes: [{ kind: 'gold', amount: -75 }, { kind: 'eventRelic', relicId: 'unwritten_page' }] },
      { id: 'study', label: '临摹旧术', detail: '失去 7 点生命，升级一张牌。', requireHp: 8, outcomes: [{ kind: 'hp', amount: -7 }, { kind: 'upgradeCard' }] }, leave,
    ],
  },
  {
    id: 'sky_rift_bridge', chapter: 3, title: '裂空摆渡站', icon: '🏮',
    text: '断桥两端隔着无声的虚空。摆渡人的灯可以照见对岸，也会把桥下的阴影带进你的行囊。',
    choices: [
      { id: 'lantern', label: '借走摆渡灯', detail: '获得「裂隙灯」，加入诅咒「冷灰」。', outcomes: [{ kind: 'eventRelic', relicId: 'rift_lantern' }, { kind: 'curse', cardId: 'cold_ash' }] },
      { id: 'help', label: '帮忙系缆', detail: '获得 28 金币。', outcomes: [{ kind: 'gold', amount: 28 }] }, leave,
    ],
  },
  {
    id: 'sky_empty_crown', chapter: 3, title: '无人加冕礼', icon: '👑',
    text: '白石王座面向夜空，冠冕悬在空中。每靠近一步，你都感到自己的呼吸变轻。',
    choices: [
      { id: 'crown', label: '戴上空冠', detail: '最大生命减少 7，获得「空心冠」。', requireHp: 8, outcomes: [{ kind: 'maxHp', amount: -7 }, { kind: 'eventRelic', relicId: 'hollow_crown' }] },
      { id: 'salute', label: '向空座致意', detail: '回复 18 点生命。', outcomes: [{ kind: 'hp', amount: 18 }] }, leave,
    ],
  },
  {
    id: 'sky_meteor_well', chapter: 3, title: '陨星井', icon: '☄️',
    text: '陨石穿透平台，井壁上嵌着一个未被烧毁的匣子。松动的石阶只够你走一次。',
    choices: [
      { id: 'reach', label: '攀下井壁', detail: '70% 概率获得随机遗物；否则失去 14 点生命。', requireHp: 15, outcomes: [{ kind: 'chance', p: 0.7, success: [{ kind: 'relic' }], fail: [{ kind: 'hp', amount: -14 }], successText: '你带回了陨星中的遗物。', failText: '石阶断裂，你勉强爬回井口。' }] },
      { id: 'ore', label: '收集井口矿石', detail: '获得 24 金币。', outcomes: [{ kind: 'gold', amount: 24 }] }, leave,
    ],
  },
  {
    id: 'sky_cloud_forge', chapter: 3, title: '云端冷锻', icon: '⚒️',
    text: '一位铸匠用冰冷的星铁敲打武器。他的火炉已经熄灭，技艺却仍然锋利。',
    choices: [
      { id: 'temper', label: '以星铁淬炼', detail: '支付 35 金币，升级一张牌。', requireGold: 35, outcomes: [{ kind: 'gold', amount: -35 }, { kind: 'upgradeCard' }] },
      { id: 'scrap', label: '留下旧武器', detail: '移除一张牌，获得 15 金币。', outcomes: [{ kind: 'removeCard' }, { kind: 'gold', amount: 15 }] }, leave,
    ],
  },
  {
    id: 'sky_seed_garden', chapter: 3, title: '逆风花园', icon: '🌱',
    text: '白石缝隙里生长着朝下开放的花。园丁把最后的种子包好，问你愿不愿意带它见到真正的太阳。',
    choices: [
      { id: 'seed', label: '服下星籽', detail: '支付 30 金币，最大生命增加 5，回复 15 点生命。', requireGold: 30, outcomes: [{ kind: 'gold', amount: -30 }, { kind: 'maxHp', amount: 5 }, { kind: 'hp', amount: 15 }] },
      { id: 'water', label: '饮下露水', detail: '回复 12 点生命。', outcomes: [{ kind: 'hp', amount: 12 }] }, leave,
    ],
  },
  {
    id: 'sky_wind_library', chapter: 3, title: '风中书库', icon: '📚',
    text: '书页沿星轨飞舞。一本封闭的紫金书停在你手边，封面沉重得像一块夜空。',
    choices: [
      { id: 'book', label: '带走禁书', detail: '获得一张随机稀有卡牌，加入诅咒「重负」。', outcomes: [{ kind: 'card', rarity: 'rare' }, { kind: 'curse', cardId: 'burden' }] },
      { id: 'copy', label: '抄录短章', detail: '支付 25 金币，获得一张随机罕见卡牌。', requireGold: 25, outcomes: [{ kind: 'gold', amount: -25 }, { kind: 'card', rarity: 'uncommon' }] }, leave,
    ],
  },
  {
    id: 'sky_wishing_comet', chapter: 3, title: '未落的许愿星', icon: '✨',
    text: '流星停在断柱之间。你能听见里面有人许愿，却没有人记得愿望是什么。',
    choices: [
      { id: 'wish', label: '替它许愿', detail: '60% 概率获得「许愿余烬」；否则失去 10 点生命。', requireHp: 11, outcomes: [{ kind: 'chance', p: 0.6, success: [{ kind: 'eventRelic', relicId: 'wishing_cinder' }], fail: [{ kind: 'hp', amount: -10 }], successText: '流星将最后一点暖光交给你。', failText: '星光碎裂，你被灼热碎屑击中。' }] },
      { id: 'warm', label: '靠近取暖', detail: '回复 14 点生命。', outcomes: [{ kind: 'hp', amount: 14 }] }, leave,
    ],
  },
  {
    id: 'sky_echo_stairs', chapter: 3, title: '回声天梯', icon: '🗝️',
    text: '每一步都传来两次脚步声。阶梯顶端的一把钥匙，似乎在等待另一个你。',
    choices: [
      { id: 'key', label: '循着第二声脚步', detail: '支付 45 金币并失去 6 点生命，获得「回声门钥」。', requireGold: 45, requireHp: 7, outcomes: [{ kind: 'gold', amount: -45 }, { kind: 'hp', amount: -6 }, { kind: 'eventRelic', relicId: 'echo_key' }] },
      { id: 'lesson', label: '记住回声的节拍', detail: '失去 8 点生命，升级一张牌。', requireHp: 9, outcomes: [{ kind: 'hp', amount: -8 }, { kind: 'upgradeCard' }] }, leave,
    ],
  },
];
