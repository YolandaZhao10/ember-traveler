import type { ChapterId, RelicCombatRule as C, RelicJourneyRule as J, RelicDef } from '../engine/types';
import { defineRelic } from './extraRelics';

const start = (effects: C['effects']): C => ({ trigger: 'turnStart', nth: 1, effects });
const obtain = (effects: J['effects']): J => ({ trigger: 'obtain', effects });
const relic = (chapter: ChapterId, id: string, name: string, icon: string, rules: (C | J)[]): RelicDef => ({ ...defineRelic(id, name, 'rare', icon, rules), chapter });

export const CHAPTER_RELICS: RelicDef[] = [
  relic(1, 'crowned_lantern', '古城王灯', '🏮', [start([{ kind: 'energy', amount: 1 }, { kind: 'ember', amount: 4 }, { kind: 'draw', amount: 2 }])]),
  relic(1, 'gatekeeper_aegis', '城门巨盾', '🛡️', [start([{ kind: 'status', status: 'metallicize', amount: 3 }, { kind: 'block', amount: 18 }])]),
  relic(1, 'belltower_pendulum', '钟楼大摆锤', '🕰️', [{ trigger: 'turnStart', every: 2, effects: [{ kind: 'cleanse', status: 'weak', amount: 1 }, { kind: 'energy', amount: 1 }] }]),
  relic(1, 'royal_ash_crown', '灰王余冠', '👑', [start([{ kind: 'enemyStatus', status: 'burn', amount: 8, target: 'all' }, { kind: 'enemyStatus', status: 'weak', amount: 1, target: 'all' }, { kind: 'enemyStatus', status: 'vulnerable', amount: 1, target: 'all' }])]),
  relic(1, 'pilgrim_reliquary', '古道圣匣', '⚱️', [{ trigger: 'victory', effects: [{ kind: 'maxHp', amount: 1 }, { kind: 'heal', amount: 3 }] }]),
  relic(1, 'ancient_coin_mold', '古城铸币模', '🪙', [obtain([{ kind: 'gold', amount: 220 }])]),
  relic(1, 'old_city_heart', '古城心石', '💎', [obtain([{ kind: 'maxHp', amount: 12 }]), { trigger: 'turnEnd', nth: 2, when: [{ kind: 'blockAtLeast', value: 10 }], effects: [{ kind: 'heal', amount: 6 }] }]),
  relic(1, 'clocktower_gear', '钟楼主齿轮', '⚙️', [{ trigger: 'cardPlayed', nth: 4, effects: [{ kind: 'block', amount: 6 }, { kind: 'draw', amount: 1 }, { kind: 'energy', amount: 1 }] }]),
  relic(1, 'sovereign_sigil', '灰烬王玺', '💮', [start([{ kind: 'status', status: 'strength', amount: 3 }]), { trigger: 'turnEnd', when: [{ kind: 'cardsAtMost', value: 2 }], effects: [{ kind: 'ember', amount: 2 }] }]),
  relic(2, 'furnace_crown', '熔炉君冠', '👑', [obtain([{ kind: 'maxHp', amount: 16 }, { kind: 'heal', amount: 16 }]), start([{ kind: 'status', status: 'strength', amount: 3 }])]),
  relic(2, 'deep_city_treasury', '深城金库钥', '🗝️', [obtain([{ kind: 'gold', amount: 120 }]), { trigger: 'victory', tier: 'elite', effects: [{ kind: 'gold', amount: 40 }] }]),
  relic(2, 'everburning_heart', '永燃炉心碎片', '❤️‍🔥', [obtain([{ kind: 'maxHp', amount: 20 }, { kind: 'heal', amount: 20 }]), start([{ kind: 'status', status: 'forge', amount: 1 }])]),
  relic(2, 'molten_sigil', '熔金铭牌', '🔶', [obtain([{ kind: 'maxHp', amount: 12 }, { kind: 'heal', amount: 12 }, { kind: 'gold', amount: 100 }]), start([{ kind: 'status', status: 'dexterity', amount: 3 }])]),
  relic(2, 'chainbreaker', '断锁之证', '⛓️‍💥', [obtain([{ kind: 'maxHp', amount: 8 }, { kind: 'heal', amount: 48 }]), start([{ kind: 'block', amount: 24 }])]),
  relic(2, 'foundry_core', '万炉动力核', '⚙️', [obtain([{ kind: 'gold', amount: 140 }]), { trigger: 'exhaust', nth: 1, effects: [{ kind: 'energy', amount: 1 }, { kind: 'draw', amount: 1 }] }]),
  relic(2, 'deep_archive', '深城总典', '📚', [obtain([{ kind: 'maxHp', amount: 8 }, { kind: 'heal', amount: 8 }]), start([{ kind: 'status', status: 'study', amount: 1 }, { kind: 'draw', amount: 1 }])]),
  relic(2, 'ember_sun', '炉底旭日', '☀️', [obtain([{ kind: 'gold', amount: 180 }]), { trigger: 'turnStart', nth: 2, effects: [{ kind: 'status', status: 'echo', amount: 2 }] }]),
  relic(2, 'forge_master_seal', '铸城宗师印', '⚒️', [obtain([{ kind: 'maxHp', amount: 14 }, { kind: 'heal', amount: 14 }, { kind: 'gold', amount: 70 }]), { trigger: 'upgrade', effects: [{ kind: 'heal', amount: 8 }] }]),
  relic(3, 'astral_crown', '司辰星冠', '👑', [obtain([{ kind: 'maxHp', amount: 12 }, { kind: 'heal', amount: 20 }]), start([{ kind: 'status', status: 'strength', amount: 4 }, { kind: 'status', status: 'dexterity', amount: 2 }])]),
  relic(3, 'moonward_aegis', '满月圣盾', '🌕', [obtain([{ kind: 'heal', amount: 30 }]), { trigger: 'turnStart', every: 2, effects: [{ kind: 'block', amount: 16 }, { kind: 'cleanse', status: 'frail', amount: 1 }] }]),
  relic(3, 'constellation_engine', '群星枢轴', '⚙️', [obtain([{ kind: 'gold', amount: 100 }]), { trigger: 'turnStart', effects: [{ kind: 'energy', amount: 1 }, { kind: 'ember', amount: 1 }] }]),
  relic(3, 'comet_compass', '引星罗盘', '🧭', [start([{ kind: 'draw', amount: 2 }, { kind: 'energy', amount: 2 }, { kind: 'block', amount: 10 }])]),
  relic(3, 'sky_reliquary', '天穹圣匣', '⚱️', [obtain([{ kind: 'maxHp', amount: 24 }, { kind: 'heal', amount: 40 }, { kind: 'gold', amount: 80 }])]),
  relic(3, 'eclipse_lens', '日蚀透镜', '🔮', [obtain([{ kind: 'heal', amount: 16 }]), { trigger: 'turnStart', every: 3, effects: [{ kind: 'status', status: 'echo', amount: 1 }, { kind: 'draw', amount: 1 }] }]),
  relic(3, 'meteor_chalice', '陨星圣杯', '🏆', [obtain([{ kind: 'gold', amount: 200 }]), { trigger: 'victory', effects: [{ kind: 'heal', amount: 10 }] }]),
  relic(3, 'starfire_seal', '星火永印', '🌟', [start([{ kind: 'enemyStatus', status: 'burn', amount: 10, target: 'all' }, { kind: 'enemyStatus', status: 'vulnerable', amount: 2, target: 'all' }]), { trigger: 'turnStart', every: 2, effects: [{ kind: 'ember', amount: 3 }] }]),
  relic(3, 'windbound_ledger', '御风总谱', '📖', [{ trigger: 'skillPlayed', nth: 3, effects: [{ kind: 'enemyStatus', status: 'vulnerable', amount: 1, target: 'all' }, { kind: 'block', amount: 6 }] }, obtain([{ kind: 'gold', amount: 120 }])]),
  // 终章纪念遗物已经停发；保留旧定义兼容历史记录，不参与当前奖励池与可获得遗物去重验收。
  relic(4, 'dawn_crown', '黎明王冠', '👑', [obtain([{ kind: 'maxHp', amount: 40 }, { kind: 'heal', amount: 100 }])]),
  relic(4, 'first_sun', '初升之日', '☀️', [obtain([{ kind: 'maxHp', amount: 25 }, { kind: 'heal', amount: 60 }, { kind: 'gold', amount: 300 }])]),
  relic(4, 'nightless_key', '开昼之钥', '🗝️', [obtain([{ kind: 'gold', amount: 600 }])]),
  relic(4, 'last_ember', '最后的火种', '🔥', [obtain([{ kind: 'maxHp', amount: 50 }, { kind: 'heal', amount: 50 }])]),
  relic(4, 'homeward_lantern', '归途明灯', '🏮', [obtain([{ kind: 'heal', amount: 200 }, { kind: 'gold', amount: 200 }])]),
  relic(4, 'unbroken_oath', '不灭之誓', '💮', [obtain([{ kind: 'maxHp', amount: 30 }, { kind: 'heal', amount: 80 }, { kind: 'gold', amount: 150 }])]),
  relic(4, 'court_standard', '终庭胜旗', '🚩', [obtain([{ kind: 'maxHp', amount: 20 }, { kind: 'heal', amount: 40 }, { kind: 'gold', amount: 400 }])]),
  relic(4, 'daybreak_bell', '破晓之钟', '🔔', [obtain([{ kind: 'heal', amount: 120 }, { kind: 'gold', amount: 350 }])]),
  relic(4, 'traveler_epilogue', '旅人终卷', '📜', [obtain([{ kind: 'maxHp', amount: 35 }, { kind: 'heal', amount: 35 }, { kind: 'gold', amount: 250 }])]),
];
