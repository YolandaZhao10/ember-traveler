import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCombat, endPlayerTurn, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { cardExitCues } from '../ui/cardExitFx';
import type { CardInstance } from '../engine/types';

const card = (defId: string, uid = defId, upgraded = false): CardInstance => ({ defId, uid, upgraded });
function scene(id: string) {
  const cs = createCombat('card-exit', ['tomb_puppet'], 'normal', [], 60, 80, [], makeRng('CARD-EXIT', 'c'), 100).state;
  cs.player.hand = [card(id), card('strike'), card('defend', 'upgraded-defend', true), { ...card('charged_blade'), bonus: 3 }];
  cs.player.draw = []; cs.player.discard = []; cs.player.exhaust = []; cs.enemies[0].hp = 1000;
  return cs;
}

describe('卡牌离手动画对应真实实体', () => {
  it('随机消耗快照包含实际牌名版本、蓄力，来源自身消耗单独标识；回响不重复消费来源实体', () => {
    const cs = scene('burn_pages'); cs.player.statuses.echo = 1;
    const result = playCard(cs, 'burn_pages', null), cues = cardExitCues(result.events);
    expect(cues.filter(c => c.random)).toHaveLength(2);
    expect(cues.map(c => c.card.uid)).toEqual(result.state.player.exhaust.map(c => c.uid));
    expect(cues.filter(c => c.card.uid === 'burn_pages')).toHaveLength(1);
    for (const cue of cues) expect(cue.card).toEqual(cs.player.hand.find(c => c.uid === cue.card.uid));
    result.state.player.exhaust[0].upgraded = !result.state.player.exhaust[0].upgraded;
    expect(cues[0].card).toEqual(cs.player.hand.find(c => c.uid === cues[0].card.uid));
  });
  it('随机弃牌即使随后洗回手牌，也保留当时被弃置的卡牌快照', () => {
    const cs = scene('truce_smoke'); cs.player.statuses.echo = 1;
    const result = playCard(cs, 'truce_smoke', null), cues = cardExitCues(result.events);
    expect(cues).toHaveLength(2);
    expect(cues.every(c => c.destination === 'discard' && c.random)).toBe(true);
    expect(cues.every(c => cs.player.hand.some(h => h.uid === c.card.uid))).toBe(true);
    expect(cues.some(c => result.state.player.hand.some(h => h.uid === c.card.uid))).toBe(true);
    expect(new Set([...result.state.player.hand, ...result.state.player.draw, ...result.state.player.discard].map(c => c.uid)).size).toBe(4);
  });
  it('全部弃置/消耗按顺序分批，正常出牌弃置与回合结束不刷提示', () => {
    const cs = scene('final_offering');
    cs.player.hand.push(...Array.from({ length: 6 }, (_, i) => card('defend', `more-${i}`)));
    const cues = cardExitCues(playCard(cs, 'final_offering', null).events);
    expect(cues).toHaveLength(10); expect(cues.every(c => !c.random)).toBe(true);
    expect(cues[4].delayMs).toBeGreaterThan(cues[0].durationMs);
    expect(cues.every(c => c.slot < 4)).toBe(true);
    expect(cardExitCues(playCard(scene('defend'), 'defend', null).events)).toEqual([]);
    expect(cardExitCues(endPlayerTurn(scene('strike')).events)).toEqual([]);
  });
  it('快动画仍给每张牌至少700毫秒，结束时间覆盖最后一批', () => {
    const events = playCard(scene('empty_the_satchel'), 'empty_the_satchel', null).events;
    const normal = cardExitCues(events), fast = cardExitCues(events, true);
    expect(fast.map(c => c.card)).toEqual(normal.map(c => c.card));
    expect(fast.every(c => c.durationMs === 700)).toBe(true);
    expect(fast[fast.length - 1].delayMs + fast[fast.length - 1].durationMs).toBeLessThan(normal[normal.length - 1].delayMs + normal[normal.length - 1].durationMs);
  });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('结算先保存，动画期间不能重复出牌；动画清理后恢复操作，SL不会重播旧动画', async () => {
  vi.resetModules(); vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  const R = await import('../engine/run'); const { saveRun } = await import('../engine/save');
  const run = R.newRun('EXIT-STORE'); run.screen = 'combat'; run.combat = scene('burn_pages');
  saveRun(run);
  const store = await import('../ui/store'); store.continueGame();
  const action = store.playCardDirect('burn_pages', null);
  expect(store.getState().busy).toBe(true);
  expect(store.getState().cardExits.length).toBeGreaterThan(0);
  expect(JSON.parse(values.get('ember-traveler:save')!).combat.player.exhaust).toHaveLength(2);
  const remaining = store.getState().run!.combat!.player.hand[0];
  await store.playCardDirect(remaining.uid, null);
  expect(store.getState().run!.combat!.player.cardsPlayedThisTurn).toBe(1);
  await vi.runAllTimersAsync(); await action;
  expect(store.getState().busy).toBe(false); expect(store.getState().cardExits).toEqual([]);
  store.quickReset(); expect(store.getState().cardExits).toEqual([]);
});
