import type { RelicCombatRule as C, RelicJourneyRule as J, RelicDef } from '../engine/types';
import { defineRelic } from './extraRelics';

const start = (effects: C['effects']): C => ({ trigger: 'turnStart', nth: 1, effects });
const count = (trigger: C['trigger'], nth: number, effects: C['effects']): C => ({ trigger, nth, effects });
const trip = (trigger: J['trigger'], effects: J['effects']): J => ({ trigger, effects });
const relic = (source: 'event' | 'shop', id: string, name: string, icon: string, rules: (C | J)[]): RelicDef => ({
  ...defineRelic(id, name, 'rare', icon, rules), source,
});

/** 只从问号事件的随机奖励或对应故事中获得，不进入精英、商店或章节奖励池。 */
export const EVENT_RELICS: RelicDef[] = [
  relic('event', 'nameless_mask', '无名面具', '🎭', [start([{ kind: 'enemyStatus', status: 'weak', amount: 2, target: 'all' }, { kind: 'block', amount: 8 }])]),
  relic('event', 'wishing_cinder', '许愿余烬', '🌠', [start([{ kind: 'ember', amount: 4 }, { kind: 'status', status: 'regen', amount: 2 }])]),
  relic('event', 'lost_hour', '遗失的一刻', '⌛', [{ trigger: 'turnStart', nth: 2, effects: [{ kind: 'energy', amount: 2 }, { kind: 'draw', amount: 1 }] }]),
  relic('event', 'mirror_shard', '镜中残影', '🪞', [start([{ kind: 'status', status: 'echo', amount: 1 }, { kind: 'block', amount: 10 }])]),
  relic('event', 'buried_banner', '地底誓旗', '🚩', [start([{ kind: 'status', status: 'strength', amount: 2 }, { kind: 'enemyStatus', status: 'vulnerable', amount: 1, target: 'all' }])]),
  relic('event', 'moonlit_shell', '月井螺壳', '🐚', [{ trigger: 'turnStart', every: 3, effects: [{ kind: 'heal', amount: 3 }, { kind: 'block', amount: 8 }] }]),
  relic('event', 'unwritten_page', '无字残页', '📜', [count('skillPlayed', 3, [{ kind: 'draw', amount: 1 }, { kind: 'energy', amount: 1 }])]),
  relic('event', 'whispering_bone', '低语骨笛', '🦴', [count('exhaust', 2, [{ kind: 'damageAll', amount: 6 }, { kind: 'block', amount: 4 }])]),
  relic('event', 'sealed_tear', '琥珀泪', '💧', [trip('obtain', [{ kind: 'maxHp', amount: 14 }, { kind: 'heal', amount: 14 }])]),
  relic('event', 'vagrant_star', '流浪星石', '🌟', [count('cardPlayed', 5, [{ kind: 'status', status: 'energyNext', amount: 1 }, { kind: 'ember', amount: 3 }])]),
  relic('event', 'hollow_crown', '空心冠', '👑', [start([{ kind: 'status', status: 'dexterity', amount: 2 }, { kind: 'status', status: 'thorns', amount: 2 }])]),
  relic('event', 'forgotten_lullaby', '失传摇篮曲', '🎵', [trip('victory', [{ kind: 'heal', amount: 7 }, { kind: 'gold', amount: 4 }])]),
  relic('event', 'rift_lantern', '裂隙灯', '🏮', [{ trigger: 'turnEnd', when: [{ kind: 'emberAtLeast', value: 5 }], effects: [{ kind: 'enemyStatus', status: 'burn', amount: 3, target: 'all' }, { kind: 'block', amount: 4 }] }]),
  relic('event', 'red_oracle', '赤色卜石', '🔮', [count('selfHpLoss', 2, [{ kind: 'heal', amount: 2 }, { kind: 'draw', amount: 1 }])]),
  relic('event', 'echo_key', '回声门钥', '🗝️', [count('echo', 1, [{ kind: 'energy', amount: 1 }, { kind: 'block', amount: 6 }])]),
];

/** 每店保留一个特殊货位，围绕商旅交易与营火整备。 */
export const SHOP_RELICS: RelicDef[] = [
  relic('shop', 'caravan_ledger', '商队回馈账', '📒', [trip('purchase', [{ kind: 'gold', amount: 12 }])]),
  relic('shop', 'merchant_tea', '商旅暖茶壶', '🫖', [trip('purchase', [{ kind: 'heal', amount: 5 }]), trip('rest', [{ kind: 'heal', amount: 8 }])]),
  relic('shop', 'purifying_brazier', '净灰火盆', '🔥', [trip('remove', [{ kind: 'maxHp', amount: 3 }, { kind: 'heal', amount: 8 }])]),
  relic('shop', 'smith_contract', '行商铸契', '⚒️', [trip('upgrade', [{ kind: 'gold', amount: 22 }, { kind: 'heal', amount: 5 }])]),
  relic('shop', 'caravan_hearth', '驿站炉印', '🏕️', [trip('rest', [{ kind: 'maxHp', amount: 3 }, { kind: 'heal', amount: 9 }])]),
  relic('shop', 'forge_savings', '炉边储金匣', '🧰', [trip('rest', [{ kind: 'gold', amount: 28 }]), trip('upgrade', [{ kind: 'maxHp', amount: 2 }, { kind: 'heal', amount: 2 }])]),
];
