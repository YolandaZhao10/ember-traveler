import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../data/chapters';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { createCombat, enemyMoveActions } from '../engine/combat';
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
