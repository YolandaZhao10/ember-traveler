import type { ChapterId, RelicCombatRule as C, RelicJourneyRule as J, RelicDef } from '../engine/types';
import { defineRelic } from './extraRelics';

const start = (effects: C['effects']): C => ({ trigger: 'turnStart', nth: 1, effects });
const obtain = (effects: J['effects']): J => ({ trigger: 'obtain', effects });
const relic = (chapter: ChapterId, id: string, name: string, icon: string, rules: (C | J)[]): RelicDef => ({ ...defineRelic(id, name, 'rare', icon, rules), chapter });

export const CHAPTER_RELICS: RelicDef[] = [
  relic(1, 'crowned_lantern', '古城王灯', '🏮', [start([{ kind: 'energy', amount: 2 }, { kind: 'ember', amount: 5 }, { kind: 'draw', amount: 2 }])]),
  relic(1, 'gatekeeper_aegis', '城门巨盾', '🛡️', [start([{ kind: 'status', status: 'dexterity', amount: 4 }, { kind: 'block', amount: 24 }])]),
  relic(1, 'belltower_pendulum', '钟楼大摆锤', '🕰️', [{ trigger: 'turnStart', effects: [{ kind: 'energy', amount: 1 }, { kind: 'draw', amount: 1 }] }]),
  relic(1, 'royal_ash_crown', '灰王余冠', '👑', [start([{ kind: 'enemyStatus', status: 'burn', amount: 12, target: 'all' }, { kind: 'enemyStatus', status: 'weak', amount: 2, target: 'all' }, { kind: 'enemyStatus', status: 'vulnerable', amount: 2, target: 'all' }])]),
  relic(1, 'pilgrim_reliquary', '古道圣匣', '⚱️', [{ trigger: 'victory', effects: [{ kind: 'heal', amount: 8 }, { kind: 'gold', amount: 15 }] }]),
  relic(1, 'ancient_coin_mold', '古城铸币模', '🪙', [obtain([{ kind: 'gold', amount: 300 }])]),
  relic(1, 'old_city_heart', '古城心石', '💎', [obtain([{ kind: 'maxHp', amount: 20 }, { kind: 'heal', amount: 40 }])]),
  relic(1, 'clocktower_gear', '钟楼主齿轮', '⚙️', [{ trigger: 'cardPlayed', every: 4, effects: [{ kind: 'block', amount: 8 }, { kind: 'draw', amount: 1 }, { kind: 'energy', amount: 1 }] }]),
  relic(1, 'sovereign_sigil', '灰烬王玺', '💮', [start([{ kind: 'status', status: 'strength', amount: 4 }]), { trigger: 'turnEnd', when: [{ kind: 'cardsAtMost', value: 2 }], effects: [{ kind: 'ember', amount: 3 }] }]),
  relic(2, 'furnace_crown', '熔炉君冠', '👑', [obtain([{ kind: 'maxHp', amount: 24 }, { kind: 'heal', amount: 24 }]), start([{ kind: 'status', status: 'strength', amount: 5 }])]),
  relic(2, 'deep_city_treasury', '深城金库钥', '🗝️', [obtain([{ kind: 'gold', amount: 450 }])]),
  relic(2, 'everburning_heart', '永燃炉心碎片', '❤️‍🔥', [obtain([{ kind: 'maxHp', amount: 30 }, { kind: 'heal', amount: 30 }]), start([{ kind: 'status', status: 'forge', amount: 2 }])]),
  relic(2, 'molten_sigil', '熔金铭牌', '🔶', [obtain([{ kind: 'maxHp', amount: 16 }, { kind: 'heal', amount: 16 }, { kind: 'gold', amount: 180 }]), start([{ kind: 'status', status: 'dexterity', amount: 5 }])]),
  relic(2, 'chainbreaker', '断锁之证', '⛓️‍💥', [obtain([{ kind: 'maxHp', amount: 12 }, { kind: 'heal', amount: 84 }]), start([{ kind: 'block', amount: 35 }])]),
  relic(2, 'foundry_core', '万炉动力核', '⚙️', [obtain([{ kind: 'gold', amount: 220 }]), { trigger: 'exhaust', nth: 1, effects: [{ kind: 'energy', amount: 2 }, { kind: 'draw', amount: 1 }] }]),
  relic(2, 'deep_archive', '深城总典', '📚', [obtain([{ kind: 'maxHp', amount: 12 }, { kind: 'heal', amount: 12 }]), start([{ kind: 'status', status: 'study', amount: 3 }, { kind: 'draw', amount: 2 }])]),
  relic(2, 'ember_sun', '炉底旭日', '☀️', [obtain([{ kind: 'gold', amount: 280 }]), { trigger: 'turnStart', nth: 2, effects: [{ kind: 'status', status: 'echo', amount: 3 }] }]),
  relic(2, 'forge_master_seal', '铸城宗师印', '⚒️', [obtain([{ kind: 'maxHp', amount: 20 }, { kind: 'heal', amount: 20 }, { kind: 'gold', amount: 120 }]), { trigger: 'upgrade', effects: [{ kind: 'heal', amount: 12 }] }]),
  relic(3, 'astral_crown', '司辰星冠', '👑', [obtain([{ kind: 'maxHp', amount: 18 }, { kind: 'heal', amount: 30 }]), start([{ kind: 'status', status: 'strength', amount: 6 }, { kind: 'status', status: 'dexterity', amount: 3 }])]),
  relic(3, 'moonward_aegis', '满月圣盾', '🌕', [obtain([{ kind: 'heal', amount: 45 }]), { trigger: 'turnStart', effects: [{ kind: 'block', amount: 12 }] }]),
  relic(3, 'constellation_engine', '群星枢轴', '⚙️', [obtain([{ kind: 'gold', amount: 150 }]), { trigger: 'turnStart', effects: [{ kind: 'energy', amount: 1 }, { kind: 'ember', amount: 2 }] }]),
  relic(3, 'comet_compass', '引星罗盘', '🧭', [start([{ kind: 'draw', amount: 3 }, { kind: 'energy', amount: 3 }, { kind: 'block', amount: 15 }])]),
  relic(3, 'sky_reliquary', '天穹圣匣', '⚱️', [obtain([{ kind: 'maxHp', amount: 32 }, { kind: 'heal', amount: 60 }, { kind: 'gold', amount: 120 }])]),
  relic(3, 'eclipse_lens', '日蚀透镜', '🔮', [obtain([{ kind: 'heal', amount: 24 }]), { trigger: 'turnStart', every: 2, effects: [{ kind: 'status', status: 'echo', amount: 1 }, { kind: 'draw', amount: 1 }] }]),
  relic(3, 'meteor_chalice', '陨星圣杯', '🏆', [obtain([{ kind: 'gold', amount: 320 }]), { trigger: 'victory', effects: [{ kind: 'heal', amount: 16 }] }]),
  relic(3, 'starfire_seal', '星火永印', '🌟', [start([{ kind: 'enemyStatus', status: 'burn', amount: 18, target: 'all' }, { kind: 'enemyStatus', status: 'vulnerable', amount: 3, target: 'all' }]), { trigger: 'turnStart', every: 2, effects: [{ kind: 'ember', amount: 4 }] }]),
  relic(3, 'windbound_ledger', '御风总谱', '📖', [{ trigger: 'cardPlayed', every: 3, effects: [{ kind: 'block', amount: 7 }, { kind: 'draw', amount: 1 }] }, obtain([{ kind: 'gold', amount: 180 }])]),
  // 终章纪念遗物只提供立即收益，完整记入最终旅程记录。
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
