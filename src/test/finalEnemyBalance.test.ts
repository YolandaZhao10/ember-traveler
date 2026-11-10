import { describe, expect, it } from 'vitest';
import { DIFFICULTY_PRESETS, STANDARD_DIFFICULTY } from '../data/difficulty';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent, startPlayerTurn } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { makeRng } from '../engine/rng';
import type { CombatState, RunDifficulty } from '../engine/types';

function battle(id: 'last_warden' | 'nightless_lord', settings: RunDifficulty = STANDARD_DIFFICULTY) {
  const boss = id === 'nightless_lord';
  return createCombat('final-balance-test', [id], boss ? 'boss' : 'elite', [], 10000, 10000, [],
    makeRng('FINAL-BALANCE', 'combat'), 100, 'traveler', encounterDifficulty(boss ? 64 : 61, boss ? 'boss' : 'elite', settings)).state;
}

function round(input: CombatState) {
  let cs = endPlayerTurn(input).state;
  const enemy = cs.enemies[0];
  const intent = enemyIntent(cs, enemy);
  const attacks = intent?.kind === 'attack' || intent?.kind === 'attack_debuff';
  const hp = cs.player.hp;
  const result = enemyAct(cs, enemy.id);
  expect(hp - result.state.player.hp).toBe(attacks ? intent.amount * intent.times : 0);
  expect(enemyAct(result.state, enemy.id)).toEqual({ state: result.state, events: [] });
  cs = result.state;
  return { state: startPlayerTurn(cs).state, move: enemy.moveId, damage: hp - cs.player.hp, attacks };
}

describe('终章精英与首领攻防节奏', () => {
  it('标准难度第62/65层的生命上限分别为550和1220，开场不额外叠盾', () => {
    for (const [id, hp] of [['last_warden', 550], ['nightless_lord', 1220]] as const) {
      const cs = battle(id);
      expect(cs.enemies[0].hp).toBe(hp);
      expect(cs.enemies[0].maxHp).toBe(hp);
      expect(cs.enemies[0].block).toBe(0);
    }
  });

  it.each(DIFFICULTY_PRESETS)('$name难度：精英每四轮三攻一整备，意图吻合实际伤害', ({ settings }) => {
    let cs = battle('last_warden', settings);
    const moves: string[] = [], hits: boolean[] = [];
    for (let turn = 0; turn < 8; turn++) {
      const result = round(cs); cs = result.state;
      moves.push(result.move!); hits.push(result.attacks);
    }
    expect(moves).toEqual(['seal', 'verdict', 'twins', 'sheathe', 'seal', 'verdict', 'twins', 'sheathe']);
    expect(hits).toEqual(cs.difficulty?.complexIntents ? Array(8).fill(true) : [false, true, true, true, false, true, true, true]);
    expect(cs.enemies[0].statuses.strength).toBe(4);
    expect([...cs.player.hand, ...cs.player.draw, ...cs.player.discard].filter(c => c.defId === 'doubt')).toHaveLength(2);
  });

  it('精英收剑先轻斩再叠力，保留封庭易伤后的重斩与下一轮力量成长', () => {
    let cs = battle('last_warden');
    cs = round(cs).state;
    expect(cs.player.statuses.vulnerable).toBe(2);
    const firstVerdict = round(cs); cs = firstVerdict.state;
    expect(firstVerdict.damage).toBe(72);
    cs = round(cs).state;
    const sheathe = round(cs); cs = sheathe.state;
    expect(sheathe.damage).toBe(13);
    expect(cs.enemies[0].statuses.strength).toBe(2);
    expect(cs.enemies[0].block).toBe(25);
    expect(round(cs).damage).toBe(0);
    cs = round(cs).state;
    expect(round(cs).damage).toBe(75);
  });

  it.each(DIFFICULTY_PRESETS)('$name难度：首领一阶段三攻一整备，敕令轻伤后再施加虚弱与冷灰', ({ settings }) => {
    let cs = battle('nightless_lord', settings);
    const hits: boolean[] = [], moves: string[] = [];
    for (let turn = 0; turn < 4; turn++) {
      const result = round(cs); cs = result.state;
      hits.push(result.attacks); moves.push(result.move!);
      if (turn === 1) {
        expect(cs.player.statuses.weak).toBe(2);
        expect([...cs.player.hand, ...cs.player.draw, ...cs.player.discard].some(c => c.defId === 'cold_ash')).toBe(true);
      }
    }
    expect(moves).toEqual(['opening', 'edict', 'pulse', 'wall']);
    expect(hits).toEqual([true, true, true, false]);
    expect(cs.enemies[0].statuses.strength ?? 0).toBe(cs.difficulty?.complexIntents ? 2 : 0);
    expect(cs.enemies[0].block).toBeGreaterThan(0);
  });

  it('半血变身仍只触发一次，二阶段壁垒是可规划的安全回合，不继续叠力', () => {
    let cs = battle('nightless_lord');
    cs.enemies[0].hp = Math.floor(cs.enemies[0].maxHp / 2);
    cs.enemies[0].statuses.weak = 2;
    cs.enemies[0].statuses.vulnerable = 2;
    const awaken = round(cs); cs = awaken.state;
    expect(awaken.move).toBe('awaken');
    expect(awaken.damage).toBe(6);
    expect(cs.enemies[0].statuses.weak ?? 0).toBe(0);
    expect(cs.enemies[0].statuses.vulnerable ?? 0).toBe(0);
    expect(cs.enemies[0].statuses.strength).toBe(3);
    const moves: string[] = [], hits: boolean[] = [];
    for (let turn = 0; turn < 8; turn++) {
      const result = round(cs); cs = result.state;
      moves.push(result.move!); hits.push(result.attacks);
    }
    expect(moves).toEqual(['nightfall', 'wall', 'extinguish', 'edict', 'nightfall', 'wall', 'extinguish', 'edict']);
    expect(hits).toEqual([true, false, true, true, true, false, true, true]);
    expect(cs.enemies[0].statuses.strength).toBe(3);
    expect(cs.enemies[0].moveHistory.filter(id => id === 'awaken')).toHaveLength(1);
  });
});
