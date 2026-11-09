import { describe, expect, it } from 'vitest';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent, playCard, startPlayerTurn } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { makeRng } from '../engine/rng';

describe('高压开场与第三章首领', () => {
  it.each([
    ['ash_duelist', 3, 'normal', 12], ['slag_saw', 21, 'normal', 12],
    ['comet_hound', 40, 'normal', 16], ['nightless_lord', 64, 'boss', 24],
  ] as const)('%s开场只使用一次，实际攻击符合可见意图，下一回合留下整备窗口', (id, floor, tier, base) => {
    let cs = createCombat('opener', [id], tier, [], 1000, 1000, [], makeRng('OPENING', 'c'), 100, 'traveler', encounterDifficulty(floor, tier)).state;
    expect(cs.phase).toBe('player'); expect(cs.player.hp).toBe(1000); expect(cs.enemies[0].moveId).toBe('opening');
    const intent = enemyIntent(cs, cs.enemies[0]);
    if (intent?.kind !== 'attack') throw new Error('开场未预告攻击');
    expect(intent.amount * intent.times).toBeGreaterThanOrEqual(base);
    cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
    expect(cs.player.hp).toBe(1000 - intent.amount * intent.times);
    expect(enemyIntent(cs, cs.enemies[0])?.kind).not.toBe('attack');
    for (let i = 0; i < 10; i++) {
      cs = startPlayerTurn(cs).state; expect(cs.enemies[0].moveId).not.toBe('opening');
      cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
    }
    expect(cs.enemies[0].moveHistory.filter(m => m === 'opening')).toHaveLength(1);
  });
  it('第三章Boss标准60层生命提高，帷幕保留非攻击整备，仍每轮保留屏障窗口', () => {
    let cs = createCombat('boss', ['eclipse_archon'], 'boss', [], 1000, 1000, [], makeRng('BOSS', 'c'), 100, 'traveler', encounterDifficulty(59, 'boss')).state;
    expect(cs.enemies[0].hp).toBe(Math.round(290 * encounterDifficulty(59, 'boss').healthMultiplier));
    const sequence = [];
    for (let i = 0; i < 4; i++) {
      sequence.push(cs.enemies[0].moveId); const intent = enemyIntent(cs, cs.enemies[0]);
      const before = cs.player.hp;
      cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
      expect(before - cs.player.hp).toBe(intent?.kind === 'attack' || intent?.kind === 'attack_debuff' ? intent.amount * intent.times : 0);
      cs = startPlayerTurn(cs).state;
    }
    expect(sequence).toEqual(['scythe', 'veil', 'orbits', 'shell']);
    expect(cs.enemies[0].block).toBeGreaterThan(0);
    expect(cs.enemies[0].statuses.vulnerable).toBe(1);
  });
  it('半血日蚀只触发一次，过渡后的第一击减伤，之后恢复完整强度', () => {
    const card = { uid: 'phase-hit', defId: 'strike', upgraded: false };
    let cs = createCombat('boss', ['eclipse_archon'], 'boss', [card], 1000, 1000, [], makeRng('PHASE', 'c'), 100, 'traveler', encounterDifficulty(59, 'boss')).state;
    cs.enemies[0].hp = Math.ceil(cs.enemies[0].maxHp / 2) + 1;
    cs = playCard(cs, card.uid, 'e0').state;
    expect(cs.enemies[0].moveId).toBe('awaken');
    cs = startPlayerTurn(enemyAct(endPlayerTurn(cs).state, 'e0').state).state;
    expect(cs.enemies[0].statuses).toMatchObject({ strength: 3, weak: 1 });
    expect(cs.enemies[0].moveId).toBe('eclipse');
    const weakened = enemyIntent(cs, cs.enemies[0]);
    const clean = structuredClone(cs); delete clean.enemies[0].statuses.weak;
    const full = enemyIntent(clean, clean.enemies[0]);
    if (weakened?.kind !== 'attack' || full?.kind !== 'attack') throw new Error('日蚀攻击未正确预告');
    expect(weakened.amount).toBe(Math.floor(full.amount * .75));
    const hp = cs.player.hp;
    cs = startPlayerTurn(enemyAct(endPlayerTurn(cs).state, 'e0').state).state;
    expect(hp - cs.player.hp).toBe(weakened.amount);
    expect(cs.enemies[0].statuses.weak ?? 0).toBe(0);
    for (let i = 0; i < 3; i++) cs = startPlayerTurn(enemyAct(endPlayerTurn(cs).state, 'e0').state).state;
    expect(cs.enemies[0].moveId).toBe('eclipse');
    expect(enemyIntent(cs, cs.enemies[0])).toEqual(full);
    expect(cs.enemies[0].moveHistory.filter(m => m === 'awaken')).toHaveLength(1);
  });
});
