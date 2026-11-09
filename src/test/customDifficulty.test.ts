import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARDS } from '../data/cards';
import { RELICS } from '../data/relics';
import { DIFFICULTY_PRESETS, STANDARD_DIFFICULTY, difficultyName, normalizeDifficulty } from '../data/difficulty';
import { encounterDifficulty } from '../engine/difficulty';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { DifficultyLevel, RunDifficulty } from '../engine/types';

const store = () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  return data;
};
afterEach(() => vi.unstubAllGlobals());
describe('新旅程自定义难度', () => {
  it('预设和自定义数据互不共享引用，无效或缺失的选项回退标准', () => {
    for (const preset of DIFFICULTY_PRESETS) {
      const run = R.newRun('CUSTOM', 'scholar', preset.settings);
      expect(run.difficulty).toEqual(preset.settings); expect(run.difficulty).not.toBe(preset.settings);
      expect(run.maxHp).toBe(52); expect(difficultyName(run.difficulty)).toBe(preset.name);
    }
    expect(normalizeDifficulty({ gold: 'high' })).toEqual({ ...STANDARD_DIFFICULTY, gold: 150 });
    expect(normalizeDifficulty(JSON.parse('{"gold":"invalid","bossHealth":"invalid"}'))).toEqual(STANDARD_DIFFICULTY);
    expect(difficultyName({ ...STANDARD_DIFFICULTY, gold: 'high' })).toBe('自定义');
  });
  it('怪物生命、意图、Boss生命和意图四项独立；精英仍叠加额外倍率', () => {
    const custom: RunDifficulty = { ...STANDARD_DIFFICULTY, enemyHealth: 'low', enemyIntent: 'high', bossHealth: 'high', bossIntent: 'low' };
    for (const tier of ['normal', 'elite', 'boss'] as const) {
      const standard = encounterDifficulty(19, tier); const changed = encounterDifficulty(19, tier, custom);
      expect(changed.healthMultiplier).toBeCloseTo(standard.healthMultiplier * (tier === 'boss' ? 1.3 : 0.75));
      expect(changed.attackMultiplier).toBeCloseTo(standard.attackMultiplier * (tier === 'boss' ? 0.8 : 1.25));
      expect(changed.blockMultiplier).toBeCloseTo(standard.blockMultiplier * (tier === 'boss' ? 0.8 : 1.25));
    }
    expect(encounterDifficulty(10, 'elite', custom).healthMultiplier).toBeGreaterThan(encounterDifficulty(10, 'normal', custom).healthMultiplier);
  });
  it('新局创建实际采用难度设置，意图与实际伤害一致，出招顺序不变', () => {
    const custom = { ...STANDARD_DIFFICULTY, enemyHealth: 'high' as const, enemyIntent: 'low' as const };
    const run = R.newRun('CUSTOM-BATTLE', 'traveler', custom);
    const battle = R.travelTo(run, run.map.startIds[0]);
    expect(battle.combat!.difficulty).toEqual(encounterDifficulty(0, 'normal', custom));
    const make = (settings: RunDifficulty) => createCombat('test', ['tomb_puppet'], 'normal', [], 100, 100, [], makeRng('CUSTOM', 'c'), 0, 'traveler', encounterDifficulty(0, 'normal', settings)).state;
    const standard = make(STANDARD_DIFFICULTY); let changed = make(custom);
    expect(changed.enemies[0].maxHp).toBe(Math.round(standard.enemies[0].maxHp * 1.3));
    expect(changed.enemies[0].moveId).toBe(standard.enemies[0].moveId);
    const intent = enemyIntent(changed, changed.enemies[0]); expect(intent).toMatchObject({ kind: 'attack', amount: 7 });
    changed = enemyAct(endPlayerTurn(changed).state, 'e0').state;
    expect(changed.player.hp).toBe(93);
  });
  it.each<DifficultyLevel>(['low', 'normal', 'high'])('金币%s档影响实际战斗奖励，不改变初始金币', level => {
    let run = R.newRun('CUSTOM-GOLD', 'traveler', { ...STANDARD_DIFFICULTY, gold: level });
    expect(run.gold).toBe(R.newRun('STANDARD').gold);
    run = R.travelTo(run, run.map.startIds[0]); run.combat!.outcome = 'won';
    const gold = R.finishCombat(run).reward!.gold; const [low, high] = R.combatGoldRange(0, 'normal', level);
    expect(gold).toBeGreaterThanOrEqual(low); expect(gold).toBeLessThanOrEqual(high);
  });
  it('卡牌稀有度同时影响普通/精英/商店，仍逐层上升，首领始终稀有', () => {
    for (const tier of ['normal', 'elite', 'shop'] as const) for (let floor = 0; floor < 65; floor++) {
      const low = R.cardRarityWeights(floor, tier, 'low'); const normal = R.cardRarityWeights(floor, tier); const high = R.cardRarityWeights(floor, tier, 'high');
      expect(low.rare).toBeLessThan(normal.rare); expect(high.rare).toBeGreaterThan(normal.rare);
      expect(high.common + high.uncommon + high.rare).toBeCloseTo(100);
      if (floor) for (const level of ['low', 'normal', 'high'] as const) expect(R.cardRarityWeights(floor, tier, level).rare).toBeGreaterThan(R.cardRarityWeights(floor - 1, tier, level).rare);
    }
    for (const level of ['low', 'normal', 'high'] as const) expect(R.cardRarityWeights(19, 'boss', level)).toEqual({ common: 0, uncommon: 0, rare: 100 });
    const sample = (level: DifficultyLevel) => {
      const run = R.newRun('CUSTOM-CARDS', 'traveler', { ...STANDARD_DIFFICULTY, cardRarity: level }); run.floor = 20;
      return Array.from({ length: 600 }, () => R.generateCardChoices(run, 'normal', 1)[0]).filter(c => CARDS[c.defId].rarity === 'rare').length;
    };
    expect(sample('high')).toBeGreaterThan(sample('low') + 100);
  });
  it('遗物稀有度影响随机事件与商店，货品仍不重复且排除初始遗物', () => {
    const sample = (level: DifficultyLevel) => {
      let rare = 0;
      for (let i = 0; i < 120; i++) for (const type of ['shop', 'event'] as const) {
        let run = R.newRun(`RELIC-BIAS-${i}`, 'traveler', { ...STANDARD_DIFFICULTY, relicRarity: level });
        const id = run.map.startIds[0]; run.map.nodes[id].type = type; run = R.travelTo(run, id);
        if (type === 'shop') {
          expect(new Set(run.shop!.relics.map(r => r.relicId)).size).toBe(6);
          rare += run.shop!.relics.filter(r => RELICS[r.relicId].rarity === 'rare').length;
        } else {
          run.event!.eventId = 'ash_altar'; run = R.eventChoose(run, 'gold');
          if (RELICS[run.relics[run.relics.length - 1]].rarity === 'rare') rare++;
        }
      }
      return rare;
    };
    expect(sample('high')).toBeGreaterThan(sample('low') + 100);
  });
  it('自定义难度跨章、存档恢复与SL保持；修改开局参数不污染已经开始的旅程', () => {
    store(); const selected = { ...DIFFICULTY_PRESETS[0].settings };
    let run = R.newRun('PERSIST-DIFFICULTY', 'traveler', selected); selected.gold = 'low';
    run = R.travelTo(run, run.map.startIds[0]); saveRun(run);
    const restored = loadRun()!; expect(restored).toEqual(run); expect(restored.difficulty.gold).toBe(150);
    expect(R.resetCurrentNode(restored)).toEqual(run);
    const next = R.enterNextChapter({ ...restored, screen: 'chapter', chapter: 1 });
    expect(next.difficulty).toEqual(restored.difficulty); expect(next.checkpoint!.difficulty).toEqual(restored.difficulty);
  });
  it('v7存档补标准难度，保留当前战斗、20层地图、商店价格和回退点', () => {
    const data = store(); let run = R.newRun('LEGACY-7'); run = R.travelTo(run, run.map.startIds[0]);
    const legacy = JSON.parse(JSON.stringify(run)); legacy.version = 7; delete legacy.difficulty; delete legacy.checkpoint.difficulty;
    data.set('ember-traveler:save', JSON.stringify(legacy)); const restored = loadRun()!;
    expect(restored.version).toBe(R.SAVE_VERSION); expect(restored.difficulty).toEqual(STANDARD_DIFFICULTY);
    expect(restored.map).toEqual(run.map); expect(restored.combat).toEqual(run.combat);
    expect(restored.checkpoint!.difficulty).toEqual(STANDARD_DIFFICULTY);
    saveRun(restored); expect(loadRun()).toEqual(restored);
  });
  it('50–200% 连续百分比真实作用于战斗、金币和稀有度，越界被限制', () => {
    expect(normalizeDifficulty({ enemyHealth: 1, gold: 999, bossHealth: NaN, enemyIntent: 83.7 })).toMatchObject({ enemyHealth: 50, gold: 200, bossHealth: 100, enemyIntent: 84 });
    for (let value = 50; value <= 200; value++) {
      const settings = { ...STANDARD_DIFFICULTY, enemyHealth: value, enemyIntent: value, bossHealth: value, bossIntent: value };
      for (const tier of ['normal', 'elite', 'boss'] as const) {
        const standard = encounterDifficulty(20, tier); const changed = encounterDifficulty(20, tier, settings);
        expect(changed.healthMultiplier).toBeCloseTo(standard.healthMultiplier * value / 100);
        expect(changed.attackMultiplier).toBeCloseTo(standard.attackMultiplier * value / 100);
        expect(changed.blockMultiplier).toBeCloseTo(standard.blockMultiplier * value / 100);
      }
      const range = R.combatGoldRange(20, 'elite', value); const base = R.combatGoldRange(20, 'elite', 100);
      expect(range).toEqual(base.map(n => Math.round(n * value / 100)));
      if (value > 50) {
        expect(R.cardRarityWeights(20, 'normal', value).rare).toBeGreaterThan(R.cardRarityWeights(20, 'normal', value - 1).rare);
        expect(R.relicRarityWeights(20, value).rare).toBeGreaterThan(R.relicRarityWeights(20, value - 1).rare);
      }
    }
  });
  it('v8/v9 三档存档和回退点等效迁移，任意百分比跨章、刷新、SL保留', () => {
    const values = store(); const old = { enemyHealth: 'low', enemyIntent: 'high', bossHealth: 'high', bossIntent: 'low', gold: 'high', relicRarity: 'low', cardRarity: 'high' } as const;
    for (const version of [8, 9]) {
      let run = R.newRun('OLD-SLIDER'); run = R.travelTo(run, run.map.startIds[0]);
      run.version = version; run.difficulty = { ...old }; run.checkpoint!.difficulty = { ...old };
      values.set('ember-traveler:save', JSON.stringify(run)); const loaded = loadRun()!;
      expect(loaded.difficulty).toEqual({ enemyHealth: 75, enemyIntent: 125, bossHealth: 130, bossIntent: 80, gold: 150, relicRarity: 50, cardRarity: 200 });
      expect(loaded.checkpoint!.difficulty).toEqual(loaded.difficulty); expect(loaded.combat).toEqual(run.combat);
    }
    let run = R.newRun('SLIDER-PERSIST', 'scholar', { ...STANDARD_DIFFICULTY, enemyHealth: 83, cardRarity: 177, bossIntent: 52 });
    run = R.travelTo(run, run.map.startIds[0]); saveRun(run);
    expect(loadRun()).toEqual(run); expect(R.resetCurrentNode(loadRun()!).difficulty).toEqual(run.difficulty);
    expect(R.enterNextChapter({ ...run, screen: 'chapter' }).difficulty).toEqual(run.difficulty);
  });

});
