import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLOCK_MAX, createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';

const battle = () => createCombat('block-cap', ['ash_knight'], 'elite', [], 100, 100, [], makeRng('BLOCK-CAP', 'c'), 100).state;
afterEach(() => vi.unstubAllGlobals());

describe('四位数格挡上限', () => {
  it('卡牌封顶9999，只计入实际获得量；已满时不制造格挡浮字或额外计数', () => {
    expect(BLOCK_MAX).toBe(9999);
    const cs = battle(); cs.player.block = 9997;
    cs.player.hand = [{ uid: 'd1', defId: 'defend', upgraded: false }, { uid: 'd2', defId: 'defend', upgraded: false }];
    const first = playCard(cs, 'd1', null);
    expect(first.state.player.block).toBe(9999); expect(first.state.player.blockGainedThisTurn).toBe(2);
    expect(first.events).toContainEqual({ type: 'block', targetId: 'player', amount: 2 });
    const second = playCard(first.state, 'd2', null);
    expect(second.state.player.block).toBe(9999); expect(second.state.player.blockGainedThisTurn).toBe(2);
    expect(second.events.some(e => e.type === 'block')).toBe(false);
  });

  it('熔炉产生的格挡与敌人防御均服从同一上限', () => {
    const cs = battle(); cs.player.block = 9998; cs.player.statuses.forge = 10;
    cs.player.hand = [{ uid: 'stoke', defId: 'stoke', upgraded: false }];
    const played = playCard(cs, 'stoke', null).state;
    expect(played.player.block).toBe(9999); expect(played.player.blockGainedThisTurn).toBe(1);
    const enemy = endPlayerTurn(played).state; enemy.enemies[0].moveId = 'wall'; enemy.enemies[0].statuses.dexterity = 20000;
    expect(enemyAct(enemy, 'e0').state.enemies[0].block).toBe(9999);
  });

  it('9999格挡可正常抵伤、保留并继续补足，不会越界或变负', () => {
    const cs = battle(); cs.player.block = 9999; cs.player.statuses.barricade = 1;
    let next = endPlayerTurn(cs).state; next.enemies[0].moveId = 'cleave';
    next = enemyAct(next, 'e0').state;
    expect(next.player.block).toBe(9987); expect(next.player.hp).toBe(100);
    next = startPlayerTurn(next).state; expect(next.player.block).toBe(9987);
    next.player.statuses.dexterity = 100; next.player.hand = [{ uid: 'd', defId: 'defend', upgraded: false }];
    expect(playCard(next, 'd', null).state.player.block).toBe(9999);
  });

  it('旧档与回退点的超额格挡归到9999，不改其他战斗状态，刷新不再变动', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    const base = R.newRun('OLD-BLOCK'), run = R.travelTo(base, base.map.startIds[0]);
    for (const snapshot of [run, run.checkpoint!]) {
      snapshot.version = 16; snapshot.combat!.player.block = 12000; snapshot.combat!.enemies[0].block = 18000;
    }
    saveRun(run); const loaded = loadRun()!;
    for (const snapshot of [loaded, loaded.checkpoint!]) {
      expect(snapshot.combat!.player.block).toBe(9999); expect(snapshot.combat!.enemies[0].block).toBe(9999);
      expect(snapshot.combat!.rng).toEqual(run.combat!.rng);
      expect(snapshot.combat!.player.hand).toEqual(run.combat!.player.hand);
    }
    saveRun(loaded); expect(loadRun()).toEqual(loaded); expect(R.resetCurrentNode(loaded).combat!.player.block).toBe(9999);
  });
});
