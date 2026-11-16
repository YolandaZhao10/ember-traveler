import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARDS, RETIRED_CARDS } from '../data/cards';
import { describeCard, viewCard, viewDef } from '../engine/cards';
import { createCombat, endPlayerTurn, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CardInstance, CombatState, RunState } from '../engine/types';

const card = (defId: string, upgraded = false, uid = defId): CardInstance => ({ uid, defId, upgraded });
function battle(ids: string[], upgraded = false, enemies = 2): CombatState {
  const cs = createCombat('shared-pool', Array.from({ length: enemies }, () => 'tomb_puppet'), 'normal', [], 80, 80, [], makeRng('SHARED-POOL', 'c'), 100).state;
  cs.enemies.forEach(e => { e.hp = e.maxHp = 1000; e.block = 0; e.statuses = {}; });
  cs.player.hand = ids.map((id, i) => card(id, upgraded, `${id}-${i}`));
  cs.player.draw = Array.from({ length: 12 }, (_, i) => card('defend', false, `draw-${i}`));
  cs.player.energy = 3;
  return cs;
}
function use(cs: CombatState, uid: string): CombatState {
  const c = cs.player.hand.find(c => c.uid === uid)!;
  const next = playCard(cs, uid, viewCard(c).target === 'enemy' ? 'e0' : null).state;
  expect(next, `${uid} 应能打出`).not.toBe(cs);
  return next;
}

describe.each([false, true])('阶段一：共享牌不再依赖燃烧，升级=%s', up => {
  it('炭尖按本回合已出牌数给余烬，与目标是否燃烧无关', () => {
    let cs = battle(['coal_tip', 'defend', 'defend', 'coal_tip'], up);
    cs.player.energy = 4;
    cs.enemies[0].statuses.burn = 5;
    cs = use(cs, 'coal_tip-0');
    expect(cs.player.ember).toBe(0);
    expect(1000 - cs.enemies[0].hp).toBe(up ? 10 : 7);
    cs = use(use(cs, 'defend-1'), 'defend-2');
    delete cs.enemies[0].statuses.burn;
    cs = use(cs, 'coal_tip-3');
    expect(cs.player.ember).toBe(up ? 3 : 2);
    expect(describeCard(card('coal_tip', up), null)).toBe(`造成 ${up ? 10 : 7} 点伤害，若本回合已打出 2 张以上卡牌：获得 ${up ? 3 : 2} 点余烬。`);
  });

  it('炽边斗篷在余烬不少于 3 时额外获得格挡，不再施加燃烧', () => {
    const low = use(battle(['warm_cloak'], up), 'warm_cloak-0');
    expect(low.player.block).toBe(up ? 9 : 6);
    const fueled = battle(['warm_cloak'], up); fueled.player.ember = 3;
    const high = use(fueled, 'warm_cloak-0');
    expect(high.player.block).toBe(up ? 15 : 10);
    expect(high.player.ember).toBe(3);
    expect(high.enemies.every(e => !e.statuses.burn)).toBe(true);
  });

  it('烈焰吐息消耗全部余烬群伤后施加全体易伤，易伤不放大本次伤害', () => {
    const cs = battle(['flame_breath'], up); cs.player.ember = 4;
    const after = use(cs, 'flame_breath-0');
    for (const e of after.enemies) {
      expect(1000 - e.hp).toBe(4 * (up ? 3 : 2));
      expect(e.statuses.vulnerable).toBe(1);
      expect(e.statuses.burn ?? 0).toBe(0);
    }
    expect(after.player.ember).toBe(0);
  });

  it('掷出火把造成伤害、给余烬并施加易伤，打出后进入弃牌堆', () => {
    const after = use(battle(['spare_torch'], up), 'spare_torch-0');
    expect(1000 - after.enemies[0].hp).toBe(up ? 12 : 8);
    expect(after.player.ember).toBe(up ? 3 : 2);
    expect(after.enemies[0].statuses.vulnerable).toBe(1);
    expect(after.enemies[0].statuses.burn ?? 0).toBe(0);
    expect(after.player.discard.map(c => c.defId)).toEqual(['spare_torch']);
    expect(after.player.exhaust).toHaveLength(0);
  });

  it('炭火启示回合结束时保留在手中', () => {
    const cs = battle(['charcoal_insight', 'defend'], up);
    const ended = endPlayerTurn(cs).state;
    expect(ended.player.hand.map(c => c.defId)).toEqual(['charcoal_insight']);
    expect(describeCard(card('charcoal_insight', up), null)).toBe(`消耗 2 点余烬，抽 ${up ? 4 : 3} 张牌。需要 2 点余烬。保留。`);
  });

  it('淬炭刃为普通牌，造成伤害并获得 1 点力量后消耗', () => {
    expect(CARDS.sharpened_coal.rarity).toBe('common');
    const after = use(battle(['sharpened_coal'], up), 'sharpened_coal-0');
    expect(1000 - after.enemies[0].hp).toBe(up ? 9 : 6);
    expect(after.player.statuses.strength).toBe(1);
    expect(after.player.exhaust.map(c => c.defId)).toEqual(['sharpened_coal']);
  });
});

describe('阶段一：诱火移除与旧存档', () => {
  afterEach(() => vi.unstubAllGlobals());
  function storage() {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    return values;
  }

  it('诱火不再是可获得的牌，替代牌与它同费用、同类型、同稀有度', () => {
    expect(CARDS.spark_lure).toBeUndefined();
    const replacement = viewDef(RETIRED_CARDS.spark_lure.replacement);
    expect(RETIRED_CARDS.spark_lure.name).toBe('诱火');
    expect([replacement.name, replacement.cost, replacement.type, replacement.rarity, replacement.target]).toEqual(['燃烧', 1, 'skill', 'common', 'enemy']);
    expect(CARDS[RETIRED_CARDS.spark_lure.replacement].owner).toBeUndefined();
  });

  it('旧存档各处的诱火读档后换成燃烧并保留升级与标识，无法识别的牌被移除，回退点同样处理', () => {
    storage();
    const run: RunState = R.travelTo(R.newRun('RETIRED-CARD'), R.newRun('RETIRED-CARD').map.startIds[0]);
    expect(run.combat).not.toBeNull();
    const old = (uid: string, upgraded = false): CardInstance => ({ uid, defId: 'spark_lure', upgraded });
    const unknown = (uid: string): CardInstance => ({ uid, defId: 'card_from_another_build', upgraded: false });
    const deckSize = run.deck.length;
    for (const snapshot of [run, run.checkpoint!]) {
      snapshot.deck.push(old('deck-old', true), unknown('deck-unknown'));
      const p = snapshot.combat!.player;
      p.hand.push({ ...old('hand-old'), bonus: 0 });
      p.draw.push(old('draw-old', true));
      p.discard.push(old('discard-old'), unknown('discard-unknown'));
      p.exhaust.push(old('exhaust-old'));
      snapshot.reward = { gold: 12, goldTaken: false, cardTaken: false, relic: null, relicTaken: false, cards: [old('reward-old', true), card('strike', false, 'reward-strike'), unknown('reward-unknown')] };
      snapshot.shop = { removePrice: 75, removeUsed: false, relics: [], cards: [{ card: old('shop-old'), price: 51, sold: false }, { card: unknown('shop-unknown'), price: 60, sold: false }] };
    }
    const rng = JSON.stringify(run.rng);
    saveRun(run);
    const loaded = loadRun()!;
    expect(loaded).not.toBeNull();
    for (const snapshot of [loaded, loaded.checkpoint!]) {
      const p = snapshot.combat!.player;
      const everywhere = [...snapshot.deck, ...p.hand, ...p.draw, ...p.discard, ...p.exhaust, ...snapshot.reward!.cards, ...snapshot.shop!.cards.map(item => item.card)];
      // 所有残留实体都能正常生成卡面，不会因未知牌抛错。
      for (const c of everywhere) expect(() => describeCard(c, null)).not.toThrow();
      expect(everywhere.some(c => !CARDS[c.defId])).toBe(false);
      expect(snapshot.deck).toHaveLength(deckSize + 1);
      expect(snapshot.deck.find(c => c.uid === 'deck-old')).toEqual({ uid: 'deck-old', defId: 'ignite', upgraded: true });
      expect(p.hand.find(c => c.uid === 'hand-old')).toEqual({ uid: 'hand-old', defId: 'ignite', upgraded: false, bonus: 0 });
      expect(p.draw.find(c => c.uid === 'draw-old')).toEqual({ uid: 'draw-old', defId: 'ignite', upgraded: true });
      expect(p.discard.map(c => c.uid)).toContain('discard-old');
      expect(p.discard.map(c => c.uid)).not.toContain('discard-unknown');
      expect(p.exhaust.find(c => c.uid === 'exhaust-old')?.defId).toBe('ignite');
      expect(snapshot.reward!.cards.map(c => [c.uid, c.defId, c.upgraded])).toEqual([['reward-old', 'ignite', true], ['reward-strike', 'strike', false]]);
      expect(snapshot.shop!.cards).toEqual([{ card: { uid: 'shop-old', defId: 'ignite', upgraded: false }, price: 51, sold: false }]);
    }
    // 迁移不消耗随机流；再次保存读取结果稳定。
    expect(JSON.stringify(loaded.rng)).toBe(rng);
    saveRun(loaded);
    expect(loadRun()).toEqual(loaded);
    // 替换后的牌在战斗中可以正常打出。
    const hand = loaded.combat!.player.hand.find(c => c.uid === 'hand-old')!;
    loaded.combat!.player.energy = 3;
    const played = playCard(loaded.combat!, hand.uid, loaded.combat!.enemies[0].id).state;
    expect(played.enemies[0].statuses.burn).toBeGreaterThanOrEqual(3);
  });
});
