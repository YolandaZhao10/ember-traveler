import { afterEach, describe, expect, it, vi } from 'vitest';
import { RELICS, RELIC_LIST, relicPool } from '../data/relics';
import { EVENT_RELICS, SHOP_RELICS } from '../data/specialRelics';
import { CARDS } from '../data/cards';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { RunState } from '../engine/types';

function enter(run: RunState, type: 'shop' | 'elite' | 'event' | 'rest') {
  const id = run.map.startIds[0]; run.map.nodes[id].type = type; return R.travelTo(run, id);
}
function mockStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
}
afterEach(() => vi.unstubAllGlobals());

describe('问号与商店专属遗物的渠道和持久化', () => {
  it('新增15件问号、6件商店专属，总数208，全部稀有强度且不进入常规池', () => {
    expect(EVENT_RELICS).toHaveLength(15); expect(SHOP_RELICS).toHaveLength(6); expect(RELIC_LIST).toHaveLength(208);
    for (const r of [...EVENT_RELICS, ...SHOP_RELICS]) expect(r.rarity).toBe('rare');
    for (const owner of ['traveler', 'picker', 'oathbound', 'scholar'] as const) {
      expect(relicPool([], owner).some(r => r.source)).toBe(false);
      for (let seed = 0; seed < 25; seed++) {
        const elite = enter(R.newRun(`SPECIAL-ELITE-${seed}`, owner), 'elite'); elite.combat!.outcome = 'won';
        expect(RELICS[R.finishCombat(elite).reward!.relic!].source).toBeUndefined();
        const shop = enter(R.newRun(`SPECIAL-SHOP-${seed}`, owner), 'shop');
        expect(shop.shop!.relics).toHaveLength(6);
        expect(shop.shop!.relics.filter(r => RELICS[r.relicId].source === 'shop')).toHaveLength(1);
        expect(shop.shop!.relics.some(r => RELICS[r.relicId].source === 'event')).toBe(false);
        expect(new Set(shop.shop!.relics.map(r => r.relicId)).size).toBe(6);
      }
    }
  });
  it('问号随机遗物有机会给专属也会给常规，15件均可出现且从不掉落商店专属', () => {
    const seen = new Set<string>(); let ordinary = 0;
    for (let seed = 0; seed < 800; seed++) {
      const base = enter(R.newRun(`QUESTION-RELIC-${seed}`), 'event');
      base.event = { eventId: 'cursed_reliquary', resolvedText: null, pendingPick: null, done: false };
      const result = R.eventChoose(base, 'relic');
      expect(result.relics).toHaveLength(2); expect(R.eventChoose(result, 'relic')).toBe(result);
      const relic = RELICS[result.relics[1]];
      expect(relic.source).not.toBe('shop');
      if (relic.source === 'event') seen.add(relic.id); else ordinary++;
    }
    expect(seen.size).toBe(15); expect(ordinary).toBeGreaterThan(400); expect(ordinary).toBeLessThan(750);
  });
  it('已持有专属不会重复出现，特殊池全部收集后商店回填常规遗物', () => {
    const base = R.newRun('EMPTY-SPECIAL'); base.relics.push(...SHOP_RELICS.map(r => r.id), ...EVENT_RELICS.map(r => r.id));
    const shop = enter(structuredClone(base), 'shop');
    expect(shop.shop!.relics).toHaveLength(6); expect(shop.shop!.relics.every(r => !RELICS[r.relicId].source)).toBe(true);
    const event = enter(structuredClone(base), 'event'); event.event = { eventId: 'cursed_reliquary', resolvedText: null, pendingPick: null, done: false };
    const result = R.eventChoose(event, 'relic'); expect(RELICS[result.relics[result.relics.length - 1]].source).toBeUndefined();
  });
  it('交易返金不作用于本遗物购买，后续买牌/遗物各触发一次，SL撤销并保持货架', () => {
    mockStorage();
    const base = R.newRun('SHOP-REBATE'); base.gold = 2000;
    const shop = enter(base, 'shop'); shop.shop!.relics[0] = { relicId: 'caravan_ledger', price: 290, sold: false };
    // 测试货架覆盖后重新固定回退点。
    const { checkpoint: _checkpoint, ...snapshot } = structuredClone(shop); shop.checkpoint = snapshot;
    let result = R.shopBuyRelic(shop, 0); expect(result.gold).toBe(1710);
    const before = result.gold; const price = result.shop!.cards[0].price;
    result = R.shopBuyCard(result, 0); expect(result.gold).toBe(before - price + 12);
    expect(R.shopBuyCard(result, 0)).toBe(result);
    const beforeRelic = result.gold; const relicPrice = result.shop!.relics[1].price;
    result = R.shopBuyRelic(result, 1); expect(result.gold).toBe(beforeRelic - relicPrice + 12);
    saveRun(result); expect(loadRun()).toEqual(result); expect(R.resetCurrentNode(loadRun()!)).toEqual(shop);
  });
  it('商店删牌与营火专属奖励各只结算一次，取消敲牌不提供收益', () => {
    const base = R.newRun('CAMP-SPECIAL'); base.gold = 1000; base.hp = 20;
    base.relics.push('purifying_brazier', 'smith_contract', 'caravan_hearth', 'forge_savings');
    const shop = enter(structuredClone(base), 'shop'); const removed = R.shopRemoveCard(shop, shop.deck[0].uid);
    expect(removed.maxHp).toBe(74); expect(removed.hp).toBe(26); expect(R.shopRemoveCard(removed, removed.deck[0].uid)).toBe(removed);
    const rest = enter(structuredClone(base), 'rest');
    const cancelled = R.restCancelUpgrade(R.restStartUpgrade(rest)); expect(cancelled.gold).toBe(rest.gold); expect(cancelled.hp).toBe(rest.hp);
    const upgraded = R.restUpgrade(rest, rest.deck[0].uid);
    expect(upgraded.gold).toBe(1016); expect(upgraded.maxHp).toBe(73); expect(upgraded.hp).toBe(26);
    expect(R.restUpgrade(upgraded, upgraded.deck[1].uid)).toBe(upgraded); expect(R.resetCurrentNode(upgraded)).toEqual(rest);
    const healed = R.restHeal(rest); expect(healed.gold).toBe(1030); expect(healed.maxHp).toBe(73); expect(healed.hp).toBe(41);
  });
});

describe('前三章本角色稀有卡奖励', () => {
  it('各角色多种子始终三张不同的专属稀有牌，刷新和SL不重掷或重复领取', () => {
    mockStorage();
    for (const character of ['traveler', 'picker', 'oathbound', 'scholar'] as const) for (const chapter of [1, 2, 3] as const) for (let seed = 0; seed < 20; seed++) {
      let run = R.newRun(`PERSONAL-BOSS-${seed}`, character); run.chapter = chapter;
      run.currentNodeId = Object.values(run.map.nodes).find(n => n.row === 18)!.id;
      run = R.travelTo(run, run.map.bossId); run.combat!.outcome = 'won';
      const reward = R.finishCombat(run); const cards = reward.reward!.cards;
      expect(cards).toHaveLength(3); expect(new Set(cards.map(c => c.defId)).size).toBe(3);
      expect(cards.every(c => CARDS[c.defId].rarity === 'rare' && CARDS[c.defId].owner === character)).toBe(true);
      const selected = R.rewardTakeCard(reward, cards[0].uid);
      expect(R.rewardTakeCard(selected, cards[1].uid)).toBe(selected);
      saveRun(selected); expect(loadRun()).toEqual(selected); expect(R.resetCurrentNode(loadRun()!)).toEqual(reward);
      const alternative = R.rewardTakeCard(R.resetCurrentNode(selected), cards[1].uid);
      expect(alternative.deck.some(c => c.uid === cards[0].uid)).toBe(false); expect(alternative.deck[alternative.deck.length - 1]).toEqual(cards[1]);
    }
  });
});
