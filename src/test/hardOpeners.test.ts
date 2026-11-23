import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../data/chapters';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { createCombat, endPlayerTurn, enemyAct, enemyMoveActions, startPlayerTurn } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { makeRng } from '../engine/rng';

describe('挑战难度的开局招式', () => {
  it.each([2, 3, 4] as const)('第%s章每个敌组里每只怪的第一招都带攻击', chapter => {
    for (const enc of ENCOUNTERS.filter(e => (e.chapter ?? 1) === chapter)) for (let seed = 0; seed < 30; seed++) {
      const cs = createCombat(enc.id, enc.enemies, enc.tier, [], 999, 999, [], makeRng(`OPEN-${seed}`, 'c'), 0, 'traveler',
        encounterDifficulty(CHAPTERS[chapter].startFloor + 3, enc.tier, DIFFICULTY_PRESETS[2].settings)).state;
      for (const e of cs.enemies) {
        const move = ENEMIES[e.defId].moves.find(m => m.id === e.moveId)!;
        expect(enemyMoveActions(cs, move).some(a => a.kind === 'attack'), `${enc.id}/${e.defId}/${move.id}`).toBe(true);
      }
    }
  });
});

describe('精英都有成长手段', () => {
  const grows = (xs: { kind: string; status?: string; target?: string; amount?: number }[]) =>
    xs.some(a => a.kind === 'status' && (a.status === 'strength' || a.status === 'ritual') && a.target !== 'player' && (a.amount ?? 0) > 0)
    || (xs.some(a => a.kind === 'attack') && xs.some(a => a.kind === 'status' && a.target === 'player' && ['vulnerable', 'weak', 'frail'].includes(a.status ?? '')));
  const elites = [...new Set(ENCOUNTERS.filter(e => e.tier === 'elite').flatMap(e => e.enemies))].filter(id => ENEMIES[id].tier === 'elite');
  it.each(elites)('%s 在标准和挑战难度下都有：加力量，或攻击并施加易伤、虚弱、脆弱', id => {
    expect(ENEMIES[id].moves.some(m => grows(m.actions))).toBe(true);
    expect(ENEMIES[id].moves.some(m => grows(m.hardActions ?? m.actions))).toBe(true);
  });
});

describe('挑战难度的首领成长', () => {
  /** 8 回合后主怪身上的力量；首领在第 4 回合后被压到半血以触发阶段变化。 */
  const growth = (encId: string) => {
    const enc = ENCOUNTERS.find(e => e.id === encId)!; const ch = (enc.chapter ?? 1) as 1 | 2 | 3 | 4, c = CHAPTERS[ch];
    const floor = c.startFloor + (enc.tier === 'boss' ? c.floors - 1 : ch === 4 ? 1 : 4);
    let total = 0; const N = 12;
    for (let s = 0; s < N; s++) {
      let cs = createCombat('g', enc.enemies, enc.tier, [], 999999, 999999, [], makeRng(`GROW-${s}`, 'c'), 0, 'traveler', encounterDifficulty(floor, enc.tier, DIFFICULTY_PRESETS[2].settings)).state;
      for (let t = 0; t < 8; t++) {
        if (enc.tier === 'boss' && t === 4) for (const e of cs.enemies) e.hp = Math.min(e.hp, Math.floor(e.maxHp / 2));
        cs.player.draw = []; cs.player.hand = []; cs.player.discard = [];
        cs = endPlayerTurn(cs).state;
        for (const e of cs.enemies) if (e.hp > 0 && !e.flags.escaped) cs = enemyAct(cs, e.id).state;
        cs.player.statuses = {};
        cs = startPlayerTurn(cs).state;
      }
      total += Math.max(0, ...cs.enemies.filter(e => e.hp > 0 && !e.flags.escaped).map(e => e.statuses.strength ?? 0));
    }
    return total / N;
  };
  it('终章的精英和首领，成长比前三章所有精英和首领的最高值至少高 25%', () => {
    const of = (ch: number) => ENCOUNTERS.filter(e => (e.chapter ?? 1) === ch && e.tier !== 'normal').map(e => growth(e.id));
    const before = Math.max(...[1, 2, 3].flatMap(of));
    for (const g of of(4)) expect(g).toBeGreaterThanOrEqual(before * 1.25);
  });

  it('每章首领的力量成长高于本章所有精英，且高于上一章的首领', () => {
    let previous = 0;
    for (const ch of [1, 2, 3, 4]) {
      const of = (tier: string) => ENCOUNTERS.filter(e => (e.chapter ?? 1) === ch && e.tier === tier).map(e => growth(e.id));
      const elites = of('elite'), bosses = of('boss');
      for (const boss of bosses) { expect(boss).toBeGreaterThan(Math.max(...elites)); expect(boss).toBeGreaterThan(previous); }
      previous = Math.max(...bosses);
    }
  });
});
