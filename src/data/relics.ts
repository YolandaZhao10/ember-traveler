import type { Archetype, CharacterId, RelicDef } from '../engine/types';
import { defineRelic, EXPANDED_RELICS, EXCLUSIVE_RELICS } from './extraRelics';
import { CHAPTER_RELICS } from './chapterRelics';
import { EVENT_RELICS, SHOP_RELICS } from './specialRelics';
import { RELIC_TUNING as T } from './relicBalance';

/**
 * 遗物定义。原遗物保留按 id 触发；扩展遗物以结构化规则驱动结算和描述。
 */
export const RELICS: Record<string, RelicDef> = {};
function def(r: RelicDef) {
  if (RELICS[r.id]) throw new Error(`重复遗物 ID：${r.id}`);
  RELICS[r.id] = r;
}

def({
  id: 'ember_lantern',
  name: '余烬灯',
  rarity: 'starter',
  icon: '🏮',
  description: '每场战斗开始时获得 2 点余烬。',
  archetype: 'ember',
});
def({
  id: 'flint',
  name: '燧石',
  rarity: 'common',
  icon: '🪨',
  description: `每回合打出的第一张攻击牌伤害 +${T.flintDamage}。`,
  archetype: 'combo',
});
def({
  id: 'metronome',
  name: '节拍怀表',
  rarity: 'uncommon',
  icon: '⏱️',
  description: '每回合打出第 3 张牌时抽 1 张牌。',
  archetype: 'combo',
});
def({
  id: 'drummer_heart',
  name: '鼓手之心',
  rarity: 'rare',
  icon: '🥁',
  description: '每回合打出第 3 张攻击牌时获得 1 点能量。',
  archetype: 'combo',
});
def({
  id: 'rusted_plate',
  name: '锈蚀胸甲',
  rarity: 'common',
  icon: '🛡️',
  description: '每回合开始时获得 3 点格挡。',
  archetype: 'bulwark',
});
def({
  id: 'thorn_crown',
  name: '荆棘冠',
  rarity: 'uncommon',
  icon: '👑',
  description: '每场战斗开始时获得 3 点荆棘。',
  archetype: 'bulwark',
});
def({
  id: 'anvil_shard',
  name: '砧铁碎片',
  rarity: 'rare',
  icon: '⚒️',
  description: '回合结束时若格挡不少于 10，对所有敌人造成 5 点伤害。',
  archetype: 'bulwark',
});
def({
  id: 'charcoal_heart',
  name: '炭心',
  rarity: 'uncommon',
  icon: '🖤',
  description: '每回合结束时获得 1 点余烬。',
  archetype: 'ember',
});
def({
  id: 'ash_hourglass',
  name: '灰烬沙漏',
  rarity: 'rare',
  icon: '⏳',
  description: '每当你通过卡牌获得余烬时，额外获得 1 点。',
  archetype: 'ember',
});
def({
  id: 'ember_censer',
  name: '余火香炉',
  rarity: 'uncommon',
  icon: '🔥',
  description: `战斗开始时，若余烬为 0 则获得 ${T.censerOpeningEmber} 点余烬；消耗余烬的卡牌至少按 ${T.censerMinimumEmber} 点结算。`,
  archetype: 'ember',
});
def({
  id: 'canteen',
  name: '旅人水壶',
  rarity: 'common',
  icon: '🫙',
  description: `每场战斗胜利后回复 ${T.canteenHeal} 点生命。`,
});
def({
  id: 'merchant_scale',
  name: '商人的秤',
  rarity: 'common',
  icon: '⚖️',
  description: '商店所有商品价格降低 25%。',
});
def({
  id: 'rune_stone',
  name: '旧符文石',
  rarity: 'uncommon',
  icon: '🪬',
  description: '每场战斗的第一回合获得 1 点额外能量。',
});
def({
  id: 'blood_charm',
  name: '血契护符',
  rarity: 'rare',
  icon: '🩸',
  description: '获得时最大生命 +12 并回复 12 点生命。',
});
def({
  id: 'watchers_eye',
  name: '守望者之眼',
  rarity: 'rare',
  icon: '👁️',
  description: '每场战斗开始时，所有敌人获得 1 层易伤。',
});
def({
  id: 'ash_compass',
  name: '灰烬罗盘',
  rarity: 'common',
  icon: '🧭',
  description: '每场战斗开始时多抽 1 张牌。',
});

def({
  id: 'picker_bell',
  name: '拾灰者的铃',
  rarity: 'starter',
  icon: '🔔',
  description: '每场战斗开始时，所有敌人获得 2 层燃烧。',
  archetype: 'cinder',
});
def({
  id: 'tinderbox',
  name: '火绒盒',
  rarity: 'uncommon',
  icon: '🧰',
  description: '敌人每次因燃烧受到的伤害 +2。',
  archetype: 'cinder',
});
def({
  id: 'bone_urn',
  name: '骨灰坛',
  rarity: 'uncommon',
  icon: '🏺',
  description: '每回合第一次有牌被消耗时，抽 1 张牌。',
  archetype: 'ash',
});
def({
  id: 'cinder_censer',
  name: '余烬镣铐',
  rarity: 'rare',
  icon: '⛓️',
  description: '每回合结束时，若本回合有牌被消耗，获得 2 点余烬。',
  archetype: 'ash',
});

def({
  id: 'blood_seal',
  name: '血誓印',
  rarity: 'starter',
  icon: '🩹',
  description: '每场战斗开始时失去 2 点生命，获得 1 点力量。',
  archetype: 'blood',
});
def({
  id: 'iron_skull',
  name: '铁颅',
  rarity: 'uncommon',
  icon: '💀',
  description: '每当你因卡牌失去生命时，获得 2 点格挡。',
  archetype: 'blood',
});
def({
  id: 'red_vial',
  name: '血瓶',
  rarity: 'rare',
  icon: '🧪',
  description: '每场战斗胜利后，回复本场因卡牌失去生命的一半。',
  archetype: 'blood',
});
def({
  id: 'war_horn',
  name: '战号',
  rarity: 'uncommon',
  icon: '📯',
  description: '每回合第一次获得力量时，额外获得 1 点。',
  archetype: 'might',
});
def({
  id: 'echo_stone',
  name: '回响石',
  rarity: 'starter',
  icon: '🪨',
  description: '每场战斗开始时获得 1 层回响（下一张牌触发两次）。',
  archetype: 'echo',
});
def(defineRelic('old_tome', '旧书', 'uncommon', '📖', [{ trigger: 'powerPlayed', nth: 1, effects: [{ kind: 'status', status: 'echo', amount: 1 }] }], 'echo'));
def({
  id: 'tuning_fork',
  name: '音叉',
  rarity: 'rare',
  icon: '🎼',
  description: '每当回响被触发时，获得 1 点余烬。',
  archetype: 'echo',
});
def({
  id: 'lens',
  name: '透镜',
  rarity: 'uncommon',
  icon: '🔍',
  description: `第 ${T.lensInterval}、${T.lensInterval * 2}、${T.lensInterval * 3}……回合开始时，若手中有保留牌，获得 1 点能量。`,
  archetype: 'focus',
});

// 第一批扩展保留原有效果。
const EXTRA_RELICS: RelicDef[] = [
  { id: 'trail_boots', name: '踏灰靴', rarity: 'common', icon: '🥾', archetype: 'combo', description: '每回合打出第 2 张攻击牌时，获得 3 点格挡。' },
  { id: 'shield_rivet', name: '盾铆', rarity: 'common', icon: '🔩', archetype: 'bulwark', description: '每场战斗的第一回合开始时，获得 8 点格挡。' },
  { id: 'coal_pouch', name: '炭灰袋', rarity: 'common', icon: '🎒', archetype: 'ash', description: '每回合第一次有牌被消耗时，获得 1 点余烬。' },
  { id: 'soot_mask', name: '烟灰面罩', rarity: 'common', icon: '🎭', archetype: 'cinder', description: '每回合开始时，若有存活敌人正在燃烧，获得 3 点格挡。' },
  { id: 'scar_band', name: '伤痕腕带', rarity: 'common', icon: '🩹', archetype: 'blood', description: '每回合第一次因卡牌失去生命时，获得 1 点余烬。' },
  { id: 'whetstone', name: '血铁磨石', rarity: 'common', icon: '🪓', archetype: 'might', description: '每场战斗开始时，获得 1 点力量。' },
  { id: 'ink_well', name: '墨井', rarity: 'common', icon: '🖋️', archetype: 'echo', description: '每回合打出的第一张技能牌结算后，获得 3 点格挡。' },
  { id: 'bookmark', name: '银叶书签', rarity: 'common', icon: '🔖', archetype: 'focus', description: '第二回合起，若回合开始时手中有保留牌，额外抽 1 张牌。' },
  { id: 'ration_pack', name: '行粮包', rarity: 'common', icon: '🍞', description: '营火休息时额外回复 5 点生命。' },
  { id: 'coin_purse', name: '旧钱袋', rarity: 'common', icon: '👛', description: '普通与精英战斗胜利后的金币奖励增加 5。' },
  { id: 'duelist_clasp', name: '决斗扣环', rarity: 'uncommon', icon: '📎', archetype: 'combo', description: '每回合打出第 3 张牌时，获得 2 点余烬。' },
  { id: 'kiln_spark', name: '窑火残芯', rarity: 'uncommon', icon: '🧨', archetype: 'ash', description: '回合结束时，若本回合消耗了至少 2 张牌，对所有存活敌人施加 2 层燃烧。' },
  { id: 'blood_pendant', name: '血滴坠饰', rarity: 'uncommon', icon: '💧', archetype: 'blood', description: '每回合第一次因卡牌失去生命时，抽 1 张牌。' },
  { id: 'crystal_chime', name: '水晶风铃', rarity: 'uncommon', icon: '🎐', archetype: 'echo', description: '每回合第一次触发回响或镜像时，获得 5 点格挡。' },
  { id: 'bastion_core', name: '堡垒核心', rarity: 'rare', icon: '🏰', archetype: 'bulwark', description: '回合结束时，若格挡不少于 15，获得 1 层蓄能（下回合 +1 能量）。' },
  { id: 'phoenix_ash', name: '余灰灵种', rarity: 'rare', icon: '🌱', archetype: 'ash', description: `每回合第一次有牌被消耗时，回复 ${T.phoenixHeal} 点生命。` },
  { id: 'war_standard', name: '不屈战旗', rarity: 'rare', icon: '🚩', archetype: 'might', description: '回合结束时，若本回合打出至少 3 张攻击牌，获得 1 点力量。' },
  { id: 'star_chart', name: '旧世星图', rarity: 'rare', icon: '🌌', archetype: 'focus', description: '回合结束时，每张保留的蓄力牌额外蓄力 1 次。' },
  defineRelic('dawn_crystal', '破晓晶石', 'rare', '💎', [{ trigger: 'turnEnd', nth: 1, when: [{ kind: 'energyAtLeast', value: 1 }], effects: [{ kind: 'status', status: 'energyNext', amount: 2 }, { kind: 'ember', amount: 2 }] }]),
  { id: 'pilgrim_seal', name: '朝圣者印章', rarity: 'rare', icon: '🕊️', description: '在营火锻造升级卡牌时，回复 5 点生命。' },
  { id: 'clockwork_sun', name: '发条日轮', rarity: 'rare', icon: '☀️', description: '每场战斗的第 3、6、9……回合开始时，额外获得 1 点能量并多抽 1 张牌。' },
];
EXTRA_RELICS.forEach(def);
EXPANDED_RELICS.forEach(def);
EXCLUSIVE_RELICS.forEach(def);
CHAPTER_RELICS.forEach(def);
EVENT_RELICS.forEach(def);
SHOP_RELICS.forEach(def);

export const RELIC_LIST = Object.values(RELICS);
const CHAR_ARCHETYPES: Record<CharacterId, Archetype[]> = {
  traveler: ['basic', 'combo', 'bulwark', 'ember'],
  picker: ['basic', 'cinder', 'ash', 'ember'],
  oathbound: ['basic', 'blood', 'might', 'ember'],
  scholar: ['basic', 'echo', 'focus', 'ember'],
};
export function relicAvailableTo(r: RelicDef, character: CharacterId): boolean {
  return (!r.owner || r.owner === character) && (!r.archetype || CHAR_ARCHETYPES[character].includes(r.archetype));
}
export function relicPool(owned: string[], character: CharacterId, rarity?: RelicDef['rarity']): RelicDef[] {
  return RELIC_LIST.filter((r) => r.rarity !== 'starter' && !r.chapter && !r.source && !owned.includes(r.id) && relicAvailableTo(r, character) && (!rarity || r.rarity === rarity));
}
