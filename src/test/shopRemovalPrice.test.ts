import { afterEach, describe, expect, it, vi } from 'vitest';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { RunState } from '../engine/types';

function shop(input = R.newRun('REMOVE-PRICE')) {
  const run = structuredClone(input); run.screen = 'map'; run.currentNodeId = null;
  const id = run.map.startIds[0]; run.map.nodes[id].type = 'shop';
  return R.travelTo(run, id);
}
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
}
afterEach(() => vi.unstubAllGlobals());

describe('商店删牌按本局使用次数涨价', () => {
  it('75、125、175、225逐次累加，跨章节与普通/问号商店共用计数', () => {
    let run = R.newRun('REMOVE-CHAPTER'); run.gold = 2000;
    for (const chapter of [1, 2, 3, 4] as const) {
      run = shop(run); expect(run.chapter).toBe(chapter); expect(run.shop!.removePrice).toBe(75 + 50 * (chapter - 1));
      const gold = run.gold, cost = run.shop!.removePrice;
      run = R.shopRemoveCard(run, run.deck[0].uid);
      expect(run.gold).toBe(gold - cost); expect(run.shopRemovals).toBe(chapter);
      if (chapter < 4) { run.screen = 'chapter'; run = R.enterNextChapter(run); expect(run.shopRemovals).toBe(chapter); }
    }
    const mystery = R.newRun('REMOVE-Q'); mystery.gold = 300; mystery.shopRemovals = 2;
    const id = mystery.map.startIds[0]; mystery.map.nodes[id].type = 'event'; mystery.map.nodes[id].mysteryType = 'shop';
    expect(R.travelTo(mystery, id).shop!.removePrice).toBe(175);
  });
  it('涨价后再七五折，货架价不会因当店买到折扣遗物改变', () => {
    const run = R.newRun('REMOVE-DISCOUNT'); run.shopRemovals = 3; run.relics.push('merchant_scale');
    expect(shop(run).shop!.removePrice).toBe(169);
    const current = shop(); current.relics.push('merchant_scale'); current.gold = 500;
    const next = R.shopRemoveCard(current, current.deck[0].uid);
    expect(next.gold).toBe(425); expect(shop(next).shop!.removePrice).toBe(94);
  });
  it('取消、缺钱、无效卡、重复点击和非商店操作不增加次数；营火精简也不增加', () => {
    const current = shop(); current.gold = 500;
    expect(R.shopRemoveCard(current, 'missing')).toBe(current);
    const poor = { ...current, gold: 74 }; expect(R.shopRemoveCard(poor, poor.deck[0].uid)).toBe(poor);
    const away = { ...current, screen: 'map' as const }; expect(R.shopRemoveCard(away, away.deck[0].uid)).toBe(away);
    expect(R.shopLeave(current).shopRemovals).toBe(0);
    const paid = R.shopRemoveCard(current, current.deck[0].uid);
    expect(R.shopRemoveCard(paid, paid.deck[0].uid)).toBe(paid);
    const rest: RunState = { ...paid, screen: 'rest', rest: { used: false, picking: false } };
    expect(R.restRefine(rest, rest.deck[0].uid).shopRemovals).toBe(1);
  });
  it('刷新保持涨价次数，SL同时撤回删牌、金币和计数，新旅程从75开始', () => {
    storage(); const current = shop(); current.gold = 500; current.checkpoint!.gold = 500;
    const paid = R.shopRemoveCard(current, current.deck[0].uid); saveRun(paid);
    expect(loadRun()!.shopRemovals).toBe(1); expect(shop(loadRun()!).shop!.removePrice).toBe(125);
    const reset = R.resetCurrentNode(loadRun()!);
    expect(reset.shopRemovals).toBe(0); expect(reset.gold).toBe(500); expect(reset.deck).toEqual(current.deck);
    expect(R.shopRemoveCard(reset, reset.deck[0].uid).shopRemovals).toBe(1);
    expect(shop().shop!.removePrice).toBe(75);
  });
  it('v17旧档从零累计，保留既有货架原价及回退点，不追扣旧账', () => {
    storage(); const old = shop(); old.version = 17; old.checkpoint!.version = 17; old.shop!.removePrice = 56;
    delete (old as Partial<RunState>).shopRemovals; delete (old.checkpoint as Partial<RunState>).shopRemovals;
    saveRun(old); const loaded = loadRun()!;
    expect(loaded.version).toBe(R.SAVE_VERSION); expect(loaded.shopRemovals).toBe(0);
    expect(loaded.checkpoint!.shopRemovals).toBe(0); expect(loaded.shop!.removePrice).toBe(56);
    expect(loaded.gold).toBe(old.gold); expect(loaded.deck).toEqual(old.deck);
    saveRun(loaded); expect(loadRun()).toEqual(loaded);
  });
});
