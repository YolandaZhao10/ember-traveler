import type { Archetype, CharacterId, RelicCombatEffect as E, RelicCombatRule as C, RelicCondition as W, RelicDef, RelicJourneyRule as J } from '../engine/types';
import { describeRelicRules } from './relicRules';

const effect = (kind: 'block' | 'draw' | 'energy' | 'ember' | 'heal' | 'damageAll' | 'damageLowest' | 'charge', amount: number): E => ({ kind, amount });
const status = (status: Extract<E, { kind: 'status' }>['status'], amount: number): E => ({ kind: 'status', status, amount });
const enemy = (status: Extract<E, { kind: 'status' }>['status'], amount: number, target: 'all' | 'lowest' = 'all'): E => ({ kind: 'enemyStatus', status, amount, target });
const when = (kind: Extract<W, { value: number }>['kind'], value: number): W => ({ kind, value });
const start = (effects: E[], nth = 1): C => ({ trigger: 'turnStart', nth, effects });
const periodic = (every: number, effects: E[]): C => ({ trigger: 'turnStart', every, effects });
const end = (condition: W | W[], effects: E[]): C => ({ trigger: 'turnEnd', when: Array.isArray(condition) ? condition : [condition], effects });
const count = (trigger: C['trigger'], nth: number, effects: E[]): C => ({ trigger, nth, effects });
const opening = (condition: W, effects: E[]): C => ({ trigger: 'turnStart', when: [condition], effects });
const trip = (trigger: J['trigger'], effects: J['effects'], tier?: J['tier']): J => ({ trigger, effects, ...(tier ? { tier } : {}) });
const health = (amount: number): J['effects'] => [{ kind: 'maxHp', amount }, { kind: 'heal', amount }];
const b = (n: number) => effect('block', n), d = (n: number) => effect('draw', n), e = (n: number) => effect('ember', n);
const h = (n: number) => effect('heal', n), energy = (n = 1) => effect('energy', n), hit = (n: number) => effect('damageLowest', n), aoe = (n: number) => effect('damageAll', n);
const low: W = { kind: 'hpBelowHalf' }, kept: W = { kind: 'retainedHand' }, burning: W = { kind: 'burningEnemy' };

export function defineRelic(id: string, name: string, rarity: RelicDef['rarity'], icon: string, rules: (C | J)[], archetype?: Archetype, owner?: CharacterId): RelicDef {
  const combat = rules.filter((r): r is C => !['obtain', 'victory', 'rest', 'upgrade', 'purchase', 'remove'].includes(r.trigger));
  const journey = rules.filter((r): r is J => ['obtain', 'victory', 'rest', 'upgrade', 'purchase', 'remove'].includes(r.trigger));
  return { id, name, rarity, icon, archetype, owner, combat, journey, description: describeRelicRules(combat, journey) };
}
const relic = defineRelic;

/** 新增90件常规遗物，每档30件；与原45件合计每档45件。 */
export const EXPANDED_RELICS: RelicDef[] = [
  // 普通：小幅资源补足、开场准备和容易满足的触发条件。
  relic('copper_feather', '铜羽', 'common', '🪶', [{ ...count('attackPlayed', 2, [d(1)]), when: [when('skillsAtLeast', 1)] }]),
  relic('quartz_charm', '石英护符', 'common', '🔹', [start([status('dexterity', 1)])]),
  relic('hunter_tag', '猎人木牌', 'common', '🏷️', [start([enemy('weak', 1)])]),
  relic('cold_match', '冷火柴', 'common', '🕯️', [start([enemy('burn', 3, 'lowest')])], 'cinder'),
  relic('linen_wrap', '洁净麻布', 'common', '🧵', [start([h(3), b(3)])]),
  relic('dew_phial', '露水瓶', 'common', '💧', [periodic(3, [h(2)])]),
  relic('spare_buckle', '备用扣带', 'common', '🪢', [end(when('cardsAtMost', 2), [b(4)])]),
  relic('warm_pebble', '暖手石', 'common', '🪨', [end(when('energyAtLeast', 1), [e(1)])]),
  relic('ash_lining', '灰絮内衬', 'common', '🧥', [end(when('emberAtLeast', 5), [b(3)])]),
  relic('bronze_spike', '铜刺', 'common', '🔱', [end(when('blockAtLeast', 8), [hit(3)])], 'bulwark'),
  relic('patient_bead', '静候珠', 'common', '📿', [end(when('handAtLeast', 3), [b(4)])]),
  relic('shelter_stone', '避风石', 'common', '🪨', [end(low, [b(3)])]),
  relic('brass_knuckle', '黄铜指虎', 'common', '🥊', [count('attackPlayed', 1, [e(1)])]),
  relic('leather_guard', '皮革护腕', 'common', '🧤', [count('attackPlayed', 3, [{ kind: 'cleanse', status: 'weak', amount: 1 }, b(2)])], 'combo'),
  relic('nimble_thread', '灵巧丝线', 'common', '🧶', [count('skillPlayed', 2, [d(1)])]),
  relic('tin_badge', '锡制徽章', 'common', '🎖️', [count('cardPlayed', 4, [b(4)])]),
  relic('novice_seal', '学徒印章', 'common', '🔰', [count('powerPlayed', 1, [b(4)])]),
  relic('brittle_bell', '脆响铃', 'common', '🔔', [count('cardPlayed', 5, [aoe(3)])]),
  relic('flint_scraper', '刮火片', 'common', '🔥', [count('attackPlayed', 2, [enemy('burn', 2, 'lowest')])]),
  relic('woven_cord', '编织绳', 'common', '🪢', [count('skillPlayed', 3, [e(2)])]),
  relic('ash_brush', '扫灰帚', 'common', '🧹', [count('exhaust', 1, [b(4)])], 'ash'),
  relic('charcoal_sieve', '炭筛', 'common', '🧺', [count('exhaust', 2, [{ kind: 'cleanse', status: 'frail', amount: 1 }, e(1)])], 'ash'),
  relic('pulse_bead', '脉搏珠', 'common', '🔴', [count('selfHpLoss', 1, [hit(3)])], 'blood'),
  relic('echo_shell', '回声贝', 'common', '🐚', [count('echo', 1, [h(1)])], 'echo'),
  relic('sealed_rations', '密封干粮', 'common', '🥫', [trip('obtain', [{ kind: 'heal', amount: 12 }]), trip('victory', [{ kind: 'heal', amount: 1 }], 'normal')]),
  relic('bronze_token', '铜制筹码', 'common', '🪙', [trip('remove', [{ kind: 'gold', amount: 12 }])]),
  relic('trail_spice', '旅途香料', 'common', '🌿', [trip('rest', [{ kind: 'heal', amount: 4 }, { kind: 'gold', amount: 4 }])]),
  relic('smith_apron', '铁匠围裙', 'common', '🦺', [trip('upgrade', [{ kind: 'maxHp', amount: 1 }])]),
  relic('wayfarer_coin', '行脚钱', 'common', '🪙', [trip('victory', [{ kind: 'gold', amount: 3 }, { kind: 'heal', amount: 1 }])]),
  relic('hunter_receipt', '悬赏凭据', 'common', '📜', [trip('victory', [{ kind: 'gold', amount: 12 }], 'elite')]),

  // 罕见：构筑条件、跨回合资源和旅程收益。
  relic('dusk_glass', '暮色镜片', 'uncommon', '🔮', [start([status('arcaneWard', 1)], 2)]),
  relic('storm_bell', '风暴铃', 'uncommon', '🔔', [count('powerPlayed', 1, [enemy('weak', 1), enemy('vulnerable', 1, 'lowest')])]),
  relic('scribe_scroll', '抄写员卷轴', 'uncommon', '📜', [start([d(2), e(1)])]),
  relic('wound_salve', '清火药膏', 'uncommon', '🧴', [start([h(6), { kind: 'cleanse', status: 'burn', amount: 4 }])]),
  relic('ember_seed', '余烬种核', 'uncommon', '🌰', [start([e(3), b(4)])]),
  relic('copper_clock', '铜摆钟', 'uncommon', '🕰️', [start([energy(), b(4)], 3)]),
  relic('frost_pendant', '霜纹吊坠', 'uncommon', '❄️', [periodic(2, [enemy('weak', 1)])]),
  relic('ember_clock', '火星计时器', 'uncommon', '⏲️', [periodic(3, [e(3)])]),
  relic('sentry_lamp', '岗哨灯', 'uncommon', '🏮', [opening(burning, [{ kind: 'cleanse', status: 'burn', amount: 2 }, b(2)])], 'cinder'),
  relic('pilgrim_guard', '朝圣护符', 'uncommon', '🛡️', [opening(low, [b(5)])]),
  relic('focused_ring', '凝思指环', 'uncommon', '💍', [opening(kept, [e(2)])], 'focus'),
  relic('pulse_dial', '脉动刻盘', 'uncommon', '🧭', [periodic(4, [status('strength', 1), b(4)])]),
  relic('forge_belt', '锻炉腰带', 'uncommon', '🔗', [end([when('blockAtLeast', 12), when('energyAtLeast', 1)], [status('strength', 1)])], 'bulwark'),
  relic('ash_screen', '灰幕披肩', 'uncommon', '🧣', [end(when('attacksAtLeast', 3), [b(6)])], 'combo'),
  relic('midnight_ink', '午夜墨瓶', 'uncommon', '🖋️', [end(when('skillsAtLeast', 2), [status('energyNext', 1)])]),
  relic('cinder_orbit', '环火仪', 'uncommon', '🪐', [end(when('emberAtLeast', 6), [enemy('burn', 2)])]),
  relic('patient_compass', '慢行罗盘', 'uncommon', '🧭', [end(when('cardsAtMost', 2), [status('energyNext', 1)])]),
  relic('raven_mask', '渡鸦面具', 'uncommon', '🎭', [{ ...end(low, [h(2)]), every: 2 }]),
  relic('embershield', '余灰屏障', 'uncommon', '🛡️', [end(when('exhaustedAtLeast', 2), [b(7)])], 'ash'),
  relic('striker_crest', '突击纹章', 'uncommon', '⚔️', [count('attackPlayed', 3, [d(1), e(1)])], 'combo'),
  relic('warding_ink', '护身墨', 'uncommon', '🖌️', [count('skillPlayed', 2, [enemy('weak', 1, 'lowest')])]),
  relic('chorus_ribbon', '合唱缎带', 'uncommon', '🎀', [count('cardPlayed', 4, [status('energyNext', 1)])]),
  relic('spark_crown', '火花冠冕', 'uncommon', '👑', [count('powerPlayed', 1, [e(3)])]),
  relic('ash_dynamo', '灰烬发电机', 'uncommon', '⚙️', [count('exhaust', 3, [energy()])], 'ash'),
  relic('red_thread', '猩红丝线', 'uncommon', '🧵', [count('selfHpLoss', 2, [status('strength', 1)])], 'blood'),
  relic('strongroot', '坚根结', 'uncommon', '🪵', [trip('victory', [{ kind: 'maxHp', amount: 1 }], 'elite')]),
  relic('mint_stamp', '铸币印', 'uncommon', '🪙', [trip('purchase', [{ kind: 'maxHp', amount: 1 }])]),
  relic('camp_kit', '宿营工具箱', 'uncommon', '🧰', [trip('rest', [{ kind: 'gold', amount: 18 }])]),
  relic('furnace_coupon', '铸匠酬金券', 'uncommon', '🎫', [trip('upgrade', [{ kind: 'gold', amount: 15 }])]),
  relic('bounty_ledger', '猎赏账簿', 'uncommon', '📒', [trip('victory', [{ kind: 'heal', amount: 4 }, { kind: 'gold', amount: 15 }], 'elite')]),

  // 稀有：长线成长、强条件回报与流派核心。
  relic('citadel_heart', '城塞之心', 'rare', '🏰', [start([status('metallicize', 3)])]),
  relic('ruby_coil', '红宝石线圈', 'rare', '🧿', [start([status('forge', 1)])]),
  relic('barbed_standard', '棘刃军旗', 'rare', '🚩', [start([status('thorns', 2), status('strength', 1)])]),
  relic('lantern_archive', '灯火档案', 'rare', '📚', [start([status('study', 1)])]),
  relic('crimson_idol', '赤玉神像', 'rare', '🗿', [start([status('regen', 1), b(5)])]),
  relic('obsidian_lens', '黑曜透镜', 'rare', '🔍', [start([enemy('burn', 4), enemy('vulnerable', 1)])]),
  relic('dawn_bell', '黎明钟', 'rare', '🔔', [start([status('echo', 1), d(1)], 2)]),
  relic('deep_clock', '深城时钟', 'rare', '🕰️', [periodic(4, [e(3), enemy('vulnerable', 1)])]),
  relic('titan_seal', '巨人印', 'rare', '🪨', [periodic(3, [status('strength', 2), status('strengthDown', 2), b(4)])], 'might'),
  relic('scholar_orbit', '星轨盘', 'rare', '🪐', [periodic(3, [status('dexterity', 1)])]),
  relic('ash_moon', '灰月', 'rare', '🌘', [opening(burning, [e(2)])], 'cinder'),
  relic('revival_rune', '复苏刻符', 'rare', '💠', [{ ...periodic(3, [h(4)]), when: [low] }]),
  relic('sentinel_core', '守卫核心', 'rare', '⚙️', [opening(when('blockAtLeast', 10), [status('thorns', 1)])], 'bulwark'),
  relic('eternity_candle', '永夜烛', 'rare', '🕯️', [end(when('emberAtLeast', 8), [aoe(6)])]),
  relic('thunder_drum', '雷鸣鼓', 'rare', '🥁', [end(when('attacksAtLeast', 4), [aoe(7)])], 'combo'),
  relic('sanctuary_bell', '圣所钟', 'rare', '🔔', [end(when('skillsAtLeast', 3), [b(10)])]),
  relic('oath_chalice', '誓血圣杯', 'rare', '🏆', [end(when('hpLostAtLeast', 4), [h(3)])], 'blood'),
  relic('library_hourglass', '书库沙漏', 'rare', '⌛', [end([kept, when('energyAtLeast', 1)], [b(5), status('energyNext', 1)])], 'focus'),
  relic('coal_vessel', '煤魂容器', 'rare', '⚱️', [end(when('exhaustedAtLeast', 3), [status('echo', 1)])], 'ash'),
  relic('blazing_diadem', '炽光王冠', 'rare', '👑', [count('cardPlayed', 5, [energy(), d(1)])]),
  relic('champion_medal', '冠军勋章', 'rare', '🏅', [count('attackPlayed', 4, [status('strength', 1), b(4)])], 'combo'),
  relic('black_sun', '黑日', 'rare', '🌑', [count('powerPlayed', 2, [status('echo', 1), b(8)])]),
  relic('blood_engine', '血泵引擎', 'rare', '🫀', [count('selfHpLoss', 3, [energy(), d(1)])], 'blood'),
  relic('echo_prism', '回声棱镜', 'rare', '🔺', [count('echo', 2, [status('energyNext', 1)])], 'echo'),
  relic('ash_reactor', '灰烬反应炉', 'rare', '♨️', [count('exhaust', 2, [aoe(4), e(1)])], 'ash'),
  relic('soul_vessel', '聚魂瓮', 'rare', '🏺', [count('enemyKilled', 1, [h(3), e(2)])]),
  relic('worldroot', '世界树根', 'rare', '🌳', [trip('obtain', health(8)), trip('rest', [{ kind: 'heal', amount: 3 }])]),
  relic('royal_seal', '旧王御印', 'rare', '💮', [trip('victory', [{ kind: 'gold', amount: 45 }, { kind: 'heal', amount: 8 }], 'boss')]),
  relic('wandering_hearth', '行走炉膛', 'rare', '🏠', [trip('rest', [{ kind: 'maxHp', amount: 2 }, { kind: 'heal', amount: 6 }])]),
  relic('master_anvil', '大师铁砧', 'rare', '⚒️', [start([status('dexterity', 1)]), trip('upgrade', [{ kind: 'gold', amount: 12 }])]),
];

/** 额外12件真角色专属遗物，每个角色每档各1件。 */
export const EXCLUSIVE_RELICS: RelicDef[] = [
  relic('roadward_pin', '旅人归途针', 'common', '🧷', [{ ...count('attackPlayed', 2, [enemy('vulnerable', 1, 'lowest')]), when: [when('blockAtLeast', 5)] }], 'combo', 'traveler'),
  relic('vanguard_token', '旅人守锋令', 'uncommon', '🛡️', [end([when('attacksAtLeast', 2), when('blockAtLeast', 10)], [status('energyNext', 1)])], 'bulwark', 'traveler'),
  relic('voyager_banner', '旅人长征旗', 'rare', '🚩', [count('cardPlayed', 6, [aoe(8), b(8)])], 'combo', 'traveler'),
  relic('soot_bell', '拾灰者焚铃', 'common', '🔔', [count('exhaust', 1, [enemy('burn', 2)])], 'ash', 'picker'),
  relic('kiln_gut', '拾灰者灰囊', 'uncommon', '🎒', [end(when('exhaustedAtLeast', 2), [e(2), b(5)])], 'ash', 'picker'),
  relic('phoenix_crown', '拾灰者涅槃冠', 'rare', '🐦‍🔥', [start([status('pyre', 1), status('ashFeast', 2)], 3)], 'cinder', 'picker'),
  relic('oath_needle', '血誓者缝血针', 'common', '🪡', [count('selfHpLoss', 1, [{ kind: 'cleanse', status: 'vulnerable', amount: 1 }, b(2)])], 'blood', 'oathbound'),
  relic('scar_crown', '血誓者伤痕冠', 'uncommon', '👑', [end(when('hpLostAtLeast', 4), [status('strength', 1), b(3)])], 'blood', 'oathbound'),
  relic('crimson_covenant', '血誓者赤契', 'rare', '📕', [count('selfHpLoss', 2, [h(2), status('energyNext', 1)])], 'blood', 'oathbound'),
  relic('scholar_quill', '学者复写羽', 'common', '🪶', [count('echo', 1, [enemy('weak', 1, 'lowest')])], 'echo', 'scholar'),
  relic('sealed_codex', '学者封存秘典', 'uncommon', '📘', [{ ...count('powerPlayed', 1, [effect('charge', 1), b(3)]), when: [kept] }], 'focus', 'scholar'),
  relic('infinity_quill', '学者无尽笔', 'rare', '✒️', [{ ...count('echo', 2, [effect('charge', 1), e(2)]), when: [kept] }], 'focus', 'scholar'),
];
