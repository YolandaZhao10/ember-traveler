import { afterEach, describe, expect, it, vi } from 'vitest';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { RunState } from '../engine/types';

function camp(seed = 'CAMP-REFINE'): RunState {
  const run = R.newRun(seed);
  run.hp = 25;
  const id = run.map.startIds[0];
  run.map.nodes[id].type = 'rest';
  return R.travelTo(run, id);
}

function memoryStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('营火精简的构筑取舍', () => {
  it('只移除所选副本，消耗营火行动和本章机会，不附送治疗或消耗金币', () => {
    const original = camp();
    const before = structuredClone(original);
    const target = original.deck[1];
    const result = R.restRefine(original, target.uid);
    expect(result.deck).toEqual(original.deck.filter(card => card.uid !== target.uid));
    expect(result.deck.some(card => card.defId === target.defId)).toBe(true);
    expect(result.rest!.used).toBe(true);
    expect(result.campRefined).toBe(true);
    expect(result.hp).toBe(original.hp);
    expect(result.gold).toBe(original.gold);
    expect(result.rng).toEqual(original.rng);
    expect(original).toEqual(before);
  });

  it('可以删升级牌和永久诅咒，且保留其他牌的升级状态', () => {
    const original = camp();
    original.deck[0].upgraded = true;
    original.deck.push({ uid: 'permanent-curse', defId: 'ashes', upgraded: false });
    const withoutCurse = R.restRefine(original, 'permanent-curse');
    expect(withoutCurse.deck.some(card => card.uid === 'permanent-curse')).toBe(false);
    expect(withoutCurse.deck[0].upgraded).toBe(true);
    const withoutUpgrade = R.restRefine(original, original.deck[0].uid);
    expect(withoutUpgrade.deck).toHaveLength(original.deck.length - 1);
    expect(withoutUpgrade.deck.some(card => card.uid === original.deck[0].uid)).toBe(false);
  });

  it('回血、锻造、精简只能完成一种，非法目标或离开营火后不扣机会', () => {
    const original = camp();
    const uid = original.deck[0].uid;
    const refined = R.restRefine(original, uid);
    expect(R.restHeal(refined)).toBe(refined);
    expect(R.restUpgrade(refined, refined.deck[0].uid)).toBe(refined);
    expect(R.restRefine(refined, refined.deck[0].uid)).toBe(refined);
    const healed = R.restHeal(original);
    const upgraded = R.restUpgrade(original, uid);
    expect(R.restRefine(healed, uid)).toBe(healed);
    expect(R.restRefine(upgraded, uid)).toBe(upgraded);
    expect(healed.campRefined).toBe(false);
    expect(upgraded.campRefined).toBe(false);
    expect(R.restRefine(original, 'missing-card')).toBe(original);
    const map = R.restLeave(original);
    expect(R.restRefine(map, uid)).toBe(map);
    const staleRest = { ...original, screen: 'map' as const };
    expect(R.restRefine(staleRest, uid)).toBe(staleRest);
  });

  it('不能删掉最后一张牌，但两张时可以删一张', () => {
    const original = camp();
    original.deck = original.deck.slice(0, 2);
    const result = R.restRefine(original, original.deck[0].uid);
    expect(result.deck).toHaveLength(1);
    const oneCard = { ...result, campRefined: false, rest: { used: false, picking: false } };
    expect(R.restRefine(oneCard, oneCard.deck[0].uid)).toBe(oneCard);
  });

  it('本章后续营火不能再免费删牌，但仍能回血或锻造；进入下一章重置一次', () => {
    const original = camp();
    const refined = R.restRefine(original, original.deck[0].uid);
    const map = R.restLeave(refined);
    const nextId = map.map.nodes[map.currentNodeId!].next[0];
    map.map.nodes[nextId].type = 'rest';
    const nextCamp = R.travelTo(map, nextId);
    expect(R.restRefine(nextCamp, nextCamp.deck[0].uid)).toBe(nextCamp);
    expect(R.restHeal(nextCamp).hp).toBeGreaterThan(nextCamp.hp);
    expect(R.restUpgrade(nextCamp, nextCamp.deck[0].uid).deck[0].upgraded).toBe(true);
    for (const chapter of [1, 2, 3] as const) {
      const transition = { ...refined, chapter, screen: 'chapter' as const };
      const nextChapter = R.enterNextChapter(transition);
      expect(nextChapter.chapter).toBe(chapter + 1);
      expect(nextChapter.campRefined).toBe(false);
      expect(nextChapter.checkpoint!.campRefined).toBe(false);
      const startId = nextChapter.map.startIds[0];
      nextChapter.map.nodes[startId].type = 'rest';
      const next = R.travelTo(nextChapter, startId);
      expect(R.restRefine(next, next.deck[0].uid).campRefined).toBe(true);
    }
  });

  it('不触发商店付费删牌、营火回血或锻造的遗物收益', () => {
    const original = camp();
    original.relics.push('purifying_brazier', 'bronze_token', 'smith_contract', 'caravan_hearth', 'forge_savings');
    const result = R.restRefine(original, original.deck[0].uid);
    expect(result.hp).toBe(original.hp);
    expect(result.maxHp).toBe(original.maxHp);
    expect(result.gold).toBe(original.gold);
    expect(result.relics).toEqual(original.relics);
  });

  it('刷新保留精简与已用次数，SL 可撤回并改为回血或另一张牌', () => {
    memoryStorage();
    const original = camp();
    const refined = R.restRefine(original, original.deck[0].uid);
    saveRun(refined);
    expect(loadRun()).toEqual(refined);
    const restored = R.resetCurrentNode(R.restLeave(loadRun()!));
    expect(restored).toEqual(original);
    expect(R.restHeal(restored).hp).toBeGreaterThan(original.hp);
    const alternate = R.restRefine(restored, original.deck[1].uid);
    expect(alternate.deck.some(card => card.uid === original.deck[0].uid)).toBe(true);
    expect(alternate.deck.some(card => card.uid === original.deck[1].uid)).toBe(false);
  });

  it('旧存档和回退点补齐未使用状态，不改变牌组、生命或随机流', () => {
    const values = memoryStorage();
    const old = camp();
    old.version = 15;
    delete old.campRefined;
    old.checkpoint!.version = 15;
    delete old.checkpoint!.campRefined;
    values.set('ember-traveler:save', JSON.stringify(old));
    const loaded = loadRun()!;
    expect(loaded.version).toBe(R.SAVE_VERSION);
    expect(loaded.campRefined).toBe(false);
    expect(loaded.checkpoint!.campRefined).toBe(false);
    expect(loaded.deck).toEqual(old.deck);
    expect(loaded.hp).toBe(old.hp);
    expect(loaded.rng).toEqual(old.rng);
    expect(R.restRefine(loaded, loaded.deck[0].uid).campRefined).toBe(true);
  });
});

it('营火精简预览取消不改变牌组，只有确认才保存删牌与额度', async () => {
  vi.useFakeTimers();
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const values = memoryStorage();
  values.set('ember-traveler:settings', JSON.stringify({ sound: false, fastAnim: true }));
  vi.stubGlobal('window', { setInterval, addEventListener: () => {}, removeEventListener: () => {} });
  vi.stubGlobal('document', { hidden: false, addEventListener: () => {}, removeEventListener: () => {} });
  const original = camp('CAMP-REFINE-PREVIEW');
  saveRun(original);
  const store = await import('../ui/store');
  store.continueGame();
  const baseline = structuredClone(store.getState().run!);
  const card = baseline.deck[0];
  const preview = { kind: 'remove' as const, card, onConfirm: () => store.restRefine(card.uid), onBack: () => {} };
  store.openOverlay(preview);
  expect(store.getState().run).toEqual(baseline);
  store.closeOverlay();
  expect(store.getState().overlay).toBeNull();
  expect(store.getState().run).toEqual(baseline);
  store.openOverlay(preview);
  preview.onConfirm();
  const result = store.getState().run!;
  expect(store.getState().overlay).toBeNull();
  expect(result.deck.some(c => c.uid === card.uid)).toBe(false);
  expect(result.campRefined).toBe(true);
  expect(result.rest!.used).toBe(true);
  expect(loadRun()).toEqual(result);
});
