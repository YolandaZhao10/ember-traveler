import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCombat, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { viewCard } from '../engine/cards';
import { impactCues } from '../ui/combatFx';

function scene(cardId: string) {
  return createCombat('fx', ['tomb_puppet', 'tomb_puppet', 'tomb_puppet'], 'normal',
    [{ uid: 'attack', defId: cardId, upgraded: false }], 72, 72, [], makeRng('fx', 'c'), 1).state;
}

describe('命中特效与实际结算一致', () => {
  it('单体攻击只反馈所选目标，完全格挡显示护盾', () => {
    const cs = scene('strike');
    cs.enemies[1].block = 20;
    const { events } = playCard(cs, 'attack', 'e1');
    expect(impactCues(events).map((cue) => [cue.targetId, cue.kind])).toEqual([['e1', 'guard']]);
  });

  it('双刃在同一敌人身上产生两次按序命中', () => {
    const { events } = playCard(scene('twin_blades'), 'attack', 'e2');
    const cues = impactCues(events);
    expect(cues.map((cue) => cue.targetId)).toEqual(['e2', 'e2']);
    expect(cues[1].delayMs).toBeGreaterThan(cues[0].delayMs);
  });

  it('群攻逐个反馈全部活着的敌人，首击同时发生', () => {
    const cs = scene('flame_breath');
    cs.player.ember = 5;
    const { events } = playCard(cs, 'attack', null);
    const cues = impactCues(events);
    expect(new Set(cues.map((cue) => cue.targetId))).toEqual(new Set(['e0', 'e1', 'e2']));
    expect(cues.every((cue) => cue.delayMs === 0)).toBe(true);
  });

  it('燃烧和荆棘反馈不会画成一次武器挥击，无伤害不产生命中', () => {
    const cues = impactCues([
      { type: 'damage', targetId: 'e0', amount: 3, blocked: 0, source: 'burn' },
      { type: 'damage', targetId: 'player', amount: 2, blocked: 0, source: 'thorns' },
      { type: 'damage', targetId: 'e1', amount: 0, blocked: 0, source: 'player' },
    ]);
    expect(cues.map((cue) => cue.kind)).toEqual(['burn', 'recoil']);
  });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('攻击前摇开始前已保存结算结果，动画结束后恢复操作', async () => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  const store = await import('../ui/store');
  store.newGame('ARTCHECK');
  store.travel(store.getState().run!.map.startIds[0]);
  const cs = store.getState().run!.combat!;
  const initialRun = store.getState().run;
  const card = cs.player.hand.find((c) => viewCard(c).type === 'attack')!;
  const action = store.playCardDirect(card.uid, cs.enemies[0].id);
  expect(store.getState().busy).toBe(true);
  expect(store.getState().attacking).toBe('player');
  store.quickReset(); // 前摇中不能被 SL 打断，再由旧动画覆盖新进度。
  expect(store.getState().run?.combat).toBe(initialRun?.combat);
  const saved = JSON.parse(values.get('ember-traveler:save')!);
  expect(saved.combat.player.hand.some((c: { uid: string }) => c.uid === card.uid)).toBe(false);
  expect(saved.combat.enemies[0].hp).toBeLessThan(cs.enemies[0].hp);
  await vi.advanceTimersByTimeAsync(150);
  expect(store.getState().impacts[0].targetId).toBe(cs.enemies[0].id);
  await vi.runAllTimersAsync();
  await action;
  expect(store.getState().busy).toBe(false);
  expect(store.getState().attacking).toBeNull();
  store.quickReset();
  expect(store.getState().run).toEqual({ ...initialRun, elapsedMs: store.getState().run!.elapsedMs });
  expect(store.getState().run!.elapsedMs).toBeGreaterThanOrEqual(initialRun!.elapsedMs);
  expect(store.getState().impacts).toEqual([]);
  const restoredSave = JSON.parse(values.get('ember-traveler:save')!);
  expect(restoredSave).toEqual({ ...initialRun, elapsedMs: restoredSave.elapsedMs });
  await vi.runAllTimersAsync();
});
