import type { EventChoice, EventDef, EventOutcome } from '../engine/types';

const leave = (label = '继续赶路'): EventChoice => ({ id: 'leave', label, detail: '不作交易，安全离开。', outcomes: [] });
const gift = (relicId: string): EventOutcome => ({ kind: 'eventRelic', relicId });

/** 两章各补足到14种事件，15件问号专属遗物各有独立故事入口。 */
export const EXTRA_EVENTS: EventDef[] = [
  {
    id: 'mask_procession', chapter: 1, title: '无面游行', icon: '🎭',
    text: '纸面人排着长队穿过空街。队尾留着一个位置，领头者递来面具：「替一个被忘记的人走完这段路。」',
    choices: [
      { id: 'join', label: '戴上面具', detail: '获得问号专属遗物「无名面具」，加入诅咒「疑惧」。', outcomes: [gift('nameless_mask'), { kind: 'curse', cardId: 'doubt' }] },
      { id: 'guide', label: '为队伍提灯', detail: '失去 5 点生命，获得 28 金币。', requireHp: 6, outcomes: [{ kind: 'hp', amount: -5 }, { kind: 'gold', amount: 28 }] },
      leave('让出道路'),
    ],
  },
  {
    id: 'wish_tree', chapter: 1, title: '挂灯许愿树', icon: '🌠',
    text: '枯树上挂着许多熄灭的灯。最后一盏仍在发亮，树根下的铭牌写着：留下路费，便可取走未燃尽的愿望。',
    choices: [
      { id: 'wish', label: '留下路费', detail: '支付 65 金币，获得问号专属遗物「许愿余烬」。', requireGold: 65, outcomes: [{ kind: 'gold', amount: -65 }, gift('wishing_cinder')] },
      { id: 'warm', label: '在树下歇脚', detail: '回复 9 点生命。', outcomes: [{ kind: 'hp', amount: 9 }] },
      leave(),
    ],
  },
  {
    id: 'stopped_clock', chapter: 1, title: '停摆的钟铺', icon: '⌛',
    text: '满墙钟表停在同一刻。柜台后的老人把一粒光砂放在天平上：「拿你未来的一小段寿命，换一个现在。」',
    choices: [
      { id: 'time', label: '交换时间', detail: '失去 5 点最大生命，获得问号专属遗物「遗失的一刻」。', outcomes: [{ kind: 'maxHp', amount: -5 }, gift('lost_hour')] },
      { id: 'repair', label: '修好一只旧钟', detail: '获得 20 金币。', outcomes: [{ kind: 'gold', amount: 20 }] },
      leave('关上店门'),
    ],
  },
  {
    id: 'mirror_alley', chapter: 1, title: '镜巷尽头', icon: '🪞',
    text: '巷子尽头的镜面比你慢半步。你转身时，镜中的人仍举着一块发光碎片，示意你把手伸过去。',
    choices: [
      { id: 'reach', label: '穿过镜面', detail: '失去 11 点生命，获得问号专属遗物「镜中残影」。', requireHp: 12, outcomes: [{ kind: 'hp', amount: -11 }, gift('mirror_shard')] },
      { id: 'study', label: '观察倒影', detail: '获得一张随机罕见卡牌。', outcomes: [{ kind: 'card', rarity: 'uncommon' }] },
      leave('背向镜子离开'),
    ],
  },
  {
    id: 'buried_standard', chapter: 1, title: '落旗广场', icon: '🚩',
    text: '石像倒下后，一面旧旗被压在底座下面。旗杆仍然温热，广场的裂缝却随着你的脚步不断扩大。',
    choices: [
      { id: 'lift', label: '撬开底座', detail: '65% 概率获得问号专属遗物「地底誓旗」；失败失去 9 点生命。', requireHp: 10, outcomes: [{ kind: 'chance', p: 0.65, success: [gift('buried_banner')], fail: [{ kind: 'hp', amount: -9 }], successText: '底座侧翻，旧旗在你的灯旁重新舒展。', failText: '石像突然滑落。你抽身躲开，却被碎石擦伤。' }] },
      { id: 'salvage', label: '拾取旗边铜饰', detail: '获得 22 金币。', outcomes: [{ kind: 'gold', amount: 22 }] },
      leave('绕开裂缝'),
    ],
  },
  {
    id: 'moonwell_echo', chapter: 1, title: '月井回声', icon: '🐚',
    text: '井底没有水，只有海潮声。一枚螺壳悬在银白色的细线上，每当你靠近，它便吸走一点呼吸。',
    choices: [
      { id: 'descend', label: '沿绳下井', detail: '失去 8 点生命并支付 20 金币，获得问号专属遗物「月井螺壳」。', requireHp: 9, requireGold: 20, outcomes: [{ kind: 'hp', amount: -8 }, { kind: 'gold', amount: -20 }, gift('moonlit_shell')] },
      { id: 'listen', label: '在井边听潮', detail: '回复 12 点生命。', outcomes: [{ kind: 'hp', amount: 12 }] },
      leave(),
    ],
  },
  {
    id: 'street_workshop', chapter: 1, title: '补靴人的火炉', icon: '🧵',
    text: '补靴人守着一口小火炉，墙上挂满了无人来取的行囊。「你走得比他们远。趁火还热，整理一下吧。」',
    choices: [
      { id: 'temper', label: '借炉淬炼', detail: '支付 25 金币，升级一张牌。', requireGold: 25, outcomes: [{ kind: 'gold', amount: -25 }, { kind: 'upgradeCard' }] },
      { id: 'mend', label: '缝补伤处', detail: '支付 12 金币，回复 16 点生命。', requireGold: 12, outcomes: [{ kind: 'gold', amount: -12 }, { kind: 'hp', amount: 16 }] },
      leave('道谢离开'),
    ],
  },
  {
    id: 'deep_blank_archive', chapter: 2, title: '空白档案室', icon: '📜',
    text: '铸造工序的档案全被擦去了字迹。唯一完整的书页贴着价签，旁边有一句铅笔小字：它记得你还没学会的东西。',
    choices: [
      { id: 'buy', label: '买下空白书页', detail: '支付 70 金币，获得问号专属遗物「无字残页」。', requireGold: 70, outcomes: [{ kind: 'gold', amount: -70 }, gift('unwritten_page')] },
      { id: 'copy', label: '临摹残存笔画', detail: '升级一张牌，失去 6 点生命。', requireHp: 7, outcomes: [{ kind: 'hp', amount: -6 }, { kind: 'upgradeCard' }] },
      leave(),
    ],
  },
  {
    id: 'deep_bone_organ', chapter: 2, title: '骨管风琴', icon: '🦴',
    text: '废弃的排气井像一架巨大的风琴。最细的一根骨管仍在吹奏，音符让你的行囊变得越来越沉。',
    choices: [
      { id: 'take', label: '拆下骨管', detail: '获得问号专属遗物「低语骨笛」，加入诅咒「重负」。', outcomes: [gift('whispering_bone'), { kind: 'curse', cardId: 'burden' }] },
      { id: 'vent', label: '打开排气阀', detail: '失去 5 点生命，获得 35 金币。', requireHp: 6, outcomes: [{ kind: 'hp', amount: -5 }, { kind: 'gold', amount: 35 }] },
      leave('塞住耳朵离开'),
    ],
  },
  {
    id: 'deep_amber_clinic', chapter: 2, title: '琥珀诊所', icon: '💧',
    text: '诊所里没有医生，只有一滴封在琥珀中的泪。旧账簿旁摆着药布，字迹温柔而清楚：药与奇迹，各有价钱。',
    choices: [
      { id: 'amber', label: '买下琥珀', detail: '支付 85 金币，获得问号专属遗物「琥珀泪」。', requireGold: 85, outcomes: [{ kind: 'gold', amount: -85 }, gift('sealed_tear')] },
      { id: 'bandage', label: '购买药布', detail: '支付 18 金币，回复 22 点生命。', requireGold: 18, outcomes: [{ kind: 'gold', amount: -18 }, { kind: 'hp', amount: 22 }] },
      leave(),
    ],
  },
  {
    id: 'deep_star_crane', chapter: 2, title: '吊车上的星光', icon: '🌟',
    text: '废弃吊车的抓斗里困着一颗小星星。钢索摇摇欲坠，操作台上只剩两个方向：放下抓斗，或拉断安全锁。',
    choices: [
      { id: 'climb', label: '攀上吊臂', detail: '60% 概率获得问号专属遗物「流浪星石」；失败失去 13 点生命。', requireHp: 14, outcomes: [{ kind: 'chance', p: 0.6, success: [gift('vagrant_star')], fail: [{ kind: 'hp', amount: -13 }], successText: '你接住了坠落的星光。它在掌心轻轻跳动。', failText: '钢索断裂，你跌回操作台，星光坠入了炉道。' }] },
      { id: 'lower', label: '缓慢放下抓斗', detail: '获得 30 金币。', outcomes: [{ kind: 'gold', amount: 30 }] },
      leave('远离吊车'),
    ],
  },
  {
    id: 'deep_empty_throne', chapter: 2, title: '空炉王座', icon: '👑',
    text: '炉工用废铁焊出了一张王座。椅背上嵌着一顶空心冠，伸手触碰时，你听见自己心跳中少了一拍。',
    choices: [
      { id: 'crown', label: '戴上空心冠', detail: '失去 6 点最大生命，获得问号专属遗物「空心冠」。', outcomes: [{ kind: 'maxHp', amount: -6 }, gift('hollow_crown')] },
      { id: 'scrap', label: '拆下扶手银片', detail: '获得 26 金币。', outcomes: [{ kind: 'gold', amount: 26 }] },
      leave('向空座行礼'),
    ],
  },
  {
    id: 'deep_sleeping_dorm', chapter: 2, title: '无人宿舍的歌', icon: '🎵',
    text: '铁床早已空了，摇篮曲却仍在宿舍里回荡。床头的八音盒缺了一枚齿轮，你的金币恰好能卡进那个位置。',
    choices: [
      { id: 'repair', label: '修好八音盒', detail: '支付 45 金币并失去 7 点生命，获得问号专属遗物「失传摇篮曲」。', requireGold: 45, requireHp: 8, outcomes: [{ kind: 'gold', amount: -45 }, { kind: 'hp', amount: -7 }, gift('forgotten_lullaby')] },
      { id: 'sleep', label: '伴着歌声休息', detail: '回复 20 点生命，加入诅咒「冷灰」。', outcomes: [{ kind: 'hp', amount: 20 }, { kind: 'curse', cardId: 'cold_ash' }] },
      leave('轻轻关门'),
    ],
  },
  {
    id: 'deep_rift_ferryman', chapter: 2, title: '裂隙摆渡人', icon: '🏮',
    text: '一条裂隙把炉道截成两半。摆渡人把灯举到你面前：「它照的是没走过的路。带走灯，就得替我记住那些回不来的人。」',
    choices: [
      { id: 'lantern', label: '接过引路灯', detail: '获得问号专属遗物「裂隙灯」，加入诅咒「悔恨」。', outcomes: [gift('rift_lantern'), { kind: 'curse', cardId: 'regret' }] },
      { id: 'tale', label: '听他讲路', detail: '获得一张随机罕见卡牌。', outcomes: [{ kind: 'card', rarity: 'uncommon' }] },
      leave('自行绕路'),
    ],
  },
  {
    id: 'deep_red_oracle', chapter: 2, title: '赤石占卜台', icon: '🔮',
    text: '赤色石头摆在一张烧焦的桌上。每一块石头上都映着不同的结局，最亮的一块却只映出你的伤口。',
    choices: [
      { id: 'blood', label: '以血问路', detail: '失去 14 点生命，获得问号专属遗物「赤色卜石」。', requireHp: 15, outcomes: [{ kind: 'hp', amount: -14 }, gift('red_oracle')] },
      { id: 'lesson', label: '购买预言', detail: '支付 35 金币，获得一张随机稀有卡牌。', requireGold: 35, outcomes: [{ kind: 'gold', amount: -35 }, { kind: 'card', rarity: 'rare' }] },
      leave('不问未来'),
    ],
  },
  {
    id: 'deep_echo_door', chapter: 2, title: '反复敲响的门', icon: '🗝️',
    text: '你敲了一下铁门，里面回了两声。门缝里滑出一把钥匙，后面拖着一道像裂口般细长的影子。',
    choices: [
      { id: 'key', label: '拾起门钥', detail: '获得问号专属遗物「回声门钥」，加入诅咒「破绽」。', outcomes: [gift('echo_key'), { kind: 'curse', cardId: 'exposure' }] },
      { id: 'answer', label: '回应敲门声', detail: '失去 6 点生命，升级一张牌。', requireHp: 7, outcomes: [{ kind: 'hp', amount: -6 }, { kind: 'upgradeCard' }] },
      leave('安静离开'),
    ],
  },
  {
    id: 'deep_worker_canteen', chapter: 2, title: '末班食堂', icon: '🍲',
    text: '最后一锅汤还温着。厨工把空碗推过来，指了指门外成堆的煤袋：「吃饭，或帮我把这班活干完。」',
    choices: [
      { id: 'soup', label: '喝一碗热汤', detail: '支付 16 金币，最大生命增加 3，并回复 12 点生命。', requireGold: 16, outcomes: [{ kind: 'gold', amount: -16 }, { kind: 'maxHp', amount: 3 }, { kind: 'hp', amount: 12 }] },
      { id: 'work', label: '搬运煤袋', detail: '失去 9 点生命，获得 40 金币。', requireHp: 10, outcomes: [{ kind: 'hp', amount: -9 }, { kind: 'gold', amount: 40 }] },
      leave('告别厨工'),
    ],
  },
];
