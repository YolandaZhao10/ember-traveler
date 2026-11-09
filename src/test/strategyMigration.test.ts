import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENCOUNTERS } from '../data/enemies';
import { plannedEncounter } from '../engine/encounters';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { RunState } from '../engine/types';

const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}
function legacy(input: RunState): RunState {
  const run = copy(input);
  for (const snapshot of [run, run.checkpoint]) {
    if (!snapshot) continue;
    snapshot.version = 15;
    delete snapshot.campRefined;
    for (const node of Object.values(snapshot.map.nodes)) delete node.encounterId;
  }
  return run;
}
afterEach(() => vi.unstubAllGlobals());

describe('路线预览和营火精简的旧档兼容', () => {
  it('v15 战斗迁移不重算怪物、手牌和随机流，当前节点记录实际敌组', () => {
    storage();
    const base = R.newRun('STRATEGY-OLD-BATTLE');
    const old = legacy(R.travelTo(base, base.map.startIds[0]));
    old.combat!.enemies[0].hp -= 3;
    old.combat!.player.hp -= 2;
    old.hp = old.combat!.player.hp;
    saveRun(old);
    const loaded = loadRun()!;
    expect(loaded.version).toBe(R.SAVE_VERSION);
    expect(loaded.campRefined).toBe(false);
    for (const key of ['combat', 'deck', 'rng', 'gold', 'hp', 'maxHp', 'stats'] as const) expect(loaded[key]).toEqual(old[key]);
    expect(loaded.map.nodes[loaded.currentNodeId!].encounterId).toBe(old.combat!.encounterId);
    const reset = R.resetCurrentNode(loaded);
    expect(reset.combat).toEqual(old.checkpoint!.combat);
    expect(reset.map).toEqual(loaded.map);
    saveRun(loaded);
    expect(loadRun()).toEqual(loaded);
  });

  it('旧奖励与旧战斗回退点中的未来敌组一致，不影响已经生成的奖励', () => {
    storage();
    const base = R.newRun('STRATEGY-OLD-REWARD');
    const battle = R.travelTo(base, base.map.startIds[0]);
    // 模拟旧版本中的敌组与本版种子规划不同，回退点仍停留在战斗开局。
    const alternative = ENCOUNTERS.find(e => (e.chapter ?? 1) === 1 && e.tier === 'normal' && e.id !== battle.combat!.encounterId)!;
    battle.combat!.encounterId = alternative.id;
    battle.checkpoint!.combat!.encounterId = alternative.id;
    battle.combat!.outcome = 'won';
    const reward = R.finishCombat(battle);
    reward.checkpoint = battle.checkpoint;
    const old = legacy(reward);
    saveRun(old);
    const loaded = loadRun()!;
    const reset = R.resetCurrentNode(loaded);
    for (const id of Object.keys(loaded.map.nodes)) {
      if (loaded.visited.includes(id)) continue;
      expect(reset.map.nodes[id].encounterId).toBe(loaded.map.nodes[id].encounterId);
    }
    expect(loaded.reward).toEqual(old.reward);
    expect(loaded.rng).toEqual(old.rng);
    expect(reset.screen).toBe('reward');
    expect(reset.combat).toBeNull();
  });

  it.each(['event', 'shop', 'rest'] as const)('v15 %s 内容和回退点保持，补齐前路后进入仍与预告相同', type => {
    storage();
    const base = R.newRun(`STRATEGY-OLD-${type}`);
    base.map.nodes[base.map.startIds[0]].type = type;
    const old = legacy(R.travelTo(base, base.map.startIds[0]));
    saveRun(old);
    const loaded = loadRun()!;
    expect(loaded[type]).toEqual(old[type]);
    expect(loaded.rng).toEqual(old.rng);
    expect(R.resetCurrentNode(loaded).map).toEqual(loaded.map);
    const node = Object.values(loaded.map.nodes).find(n => n.row > 0 && n.type === 'combat')!;
    expect(plannedEncounter(loaded, node)?.id).toBe(node.encounterId);
    const ready = { ...loaded, screen: 'map' as const, currentNodeId: null };
    ready.map.startIds = [node.id];
    const entered = R.travelTo(ready, node.id);
    expect(entered.combat!.encounterId).toBe(node.encounterId);
  });

  it('本版已完成精简的存档和回退点不在刷新时补回额度', () => {
    storage();
    const base = R.newRun('STRATEGY-NEW-SAVE');
    base.map.nodes[base.map.startIds[0]].type = 'rest';
    const start = R.travelTo(base, base.map.startIds[0]);
    const refined = R.restRefine(start, start.deck[0].uid);
    saveRun(refined);
    const loaded = loadRun()!;
    expect(loaded).toEqual(refined);
    expect(loaded.campRefined).toBe(true);
    expect(R.restRefine(loaded, loaded.deck[0].uid)).toBe(loaded);
    expect(R.resetCurrentNode(loaded)).toEqual(start);
  });
});
