import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { DIFFICULTY_PRESETS, STANDARD_DIFFICULTY } from '../data/difficulty';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent, enemyIntentExtras, enemyMoveActions } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { makeRng } from '../engine/rng';
import { calcBlock, calcDamage } from '../engine/cards';
import { loadRun } from '../engine/save';
import { newRun, resetCurrentNode, travelTo, SAVE_VERSION } from '../engine/run';

afterEach(() => vi.unstubAllGlobals());
const cases = Object.values(ENEMIES).flatMap(e => e.moves.filter(m => m.hardActions).map(m => ({ enemy: e.id, move: m.id })));
describe('挑战复合意图', () => {
  it('125%起启用，普通与首领各自读取对应选项，低难度不受楼层倍率影响', () => {
    expect(encounterDifficulty(64, 'normal').complexIntents).toBe(false);
    for (const tier of ['normal', 'elite', 'boss'] as const) {
      expect(encounterDifficulty(0, tier, DIFFICULTY_PRESETS[2].settings).complexIntents).toBe(true);
      expect(encounterDifficulty(0, tier, { ...STANDARD_DIFFICULTY, enemyIntent: 124, bossIntent: 124 }).complexIntents).toBe(false);
      expect(encounterDifficulty(0, tier, { ...STANDARD_DIFFICULTY, enemyIntent: 125 }).complexIntents).toBe(tier !== 'boss');
      expect(encounterDifficulty(0, tier, { ...STANDARD_DIFFICULTY, bossIntent: 125 }).complexIntents).toBe(tier === 'boss');
    }
  });
  it.each(cases)('$enemy/$move：预告、格挡、塞牌和强化实际各执行一次，标准保持原招式', ({ enemy, move }) => {
    const def = ENEMIES[enemy], m = def.moves.find(m => m.id === move)!;
    const difficulty = encounterDifficulty(40, def.tier, DIFFICULTY_PRESETS[2].settings);
    const cs = createCombat('hard-intents', [enemy], def.tier, [], 9999, 9999, [], makeRng('HARD', 'c'), 0, 'traveler', difficulty).state;
    const e = cs.enemies[0]; e.moveId = move; e.statuses = {}; cs.player.statuses = {};
    const standard = { ...cs, difficulty: { ...difficulty, complexIntents: false } };
    expect(enemyMoveActions(standard, m)).toEqual(m.actions);
    expect(enemyMoveActions(cs, m)).toEqual(m.hardActions);
    expect(enemyIntentExtras(standard, e)).toEqual([]);
    expect(enemyIntentExtras(cs, e).length > 0).toBe(m.hardActions!.some(a => a.kind !== 'attack'));
    const atk = m.hardActions!.find(a => a.kind === 'attack');
    const intent = enemyIntent(cs, e)!;
    const result = enemyAct(endPlayerTurn(cs).state, e.id);
    const damage = result.events.filter(ev => ev.type === 'damage' && ev.targetId === 'player');
    if (atk?.kind === 'attack') {
      expect(['attack', 'attack_debuff']).toContain(intent.kind);
      if (intent.kind !== 'attack_debuff' && intent.kind !== 'attack') throw new Error('attack intent missing');
      expect(intent.amount).toBe(calcDamage(Math.round(atk.amount * difficulty.attackMultiplier), {}, {}));
      expect(damage).toHaveLength(atk.times ?? 1);
      expect(damage.reduce((n, ev) => n + (ev.type === 'damage' ? ev.amount : 0), 0)).toBe(intent.amount * intent.times);
    } else expect(damage).toHaveLength(0);
    for (const a of m.hardActions!) {
      if (a.kind === 'block') expect(result.state.enemies[0].block).toBe(calcBlock(Math.round(a.amount * difficulty.blockMultiplier), {}));
      if (a.kind === 'addCardToDraw' || a.kind === 'addCardToDiscard') {
        const pile = a.kind === 'addCardToDraw' ? 'draw' : 'discard';
        expect(result.state.player[pile].filter(c => c.defId === a.cardId)).toHaveLength(a.count);
      }
      if (a.kind === 'status' && a.target !== 'player') expect(result.events.filter(ev => ev.type === 'status' && ev.targetId === e.id && ev.status === a.status && ev.amount === a.amount)).toHaveLength(1);
    }
    expect(result.state.enemies[0].moveHistory).toEqual([move]);
  });
  it('旧战斗和回退点保持原意图，下一场采用新规则', () => {
    let run = newRun('HARD-MIGRATE', 'traveler', DIFFICULTY_PRESETS[2].settings);
    run = travelTo(run, run.map.startIds[0]); run.version = 18;
    delete run.combat!.difficulty!.complexIntents;
    run.checkpoint = JSON.parse(JSON.stringify({ ...run, checkpoint: undefined }));
    const values = new Map([['ember-traveler:save', JSON.stringify(run)]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    const loaded = loadRun()!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.combat!.difficulty!.complexIntents).toBe(false);
    expect(resetCurrentNode(loaded).combat!.difficulty!.complexIntents).toBe(false);
    expect(encounterDifficulty(1, 'normal', loaded.difficulty).complexIntents).toBe(true);
  });
});
