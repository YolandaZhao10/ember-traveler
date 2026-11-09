import { afterEach, describe, expect, it, vi } from 'vitest';
import { viewCard } from '../engine/cards';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import { EVENT_LIST } from '../data/events';
import type { ChapterId, NodeType, RunState } from '../engine/types';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function enter(type: NodeType, seed = 'QUICK-SL', chapter: ChapterId = 1) {
  const run = R.newRun(seed);
  run.chapter = chapter;
  run.hp = 40;
  run.gold = 600;
  run.map.nodes[run.map.startIds[0]].type = type;
  return R.travelTo(run, run.map.startIds[0]);
}
function win(run: RunState) {
  const next = copy(run);
  next.combat!.outcome = 'won';
  return R.finishCombat(next);
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
afterEach(() => vi.unstubAllGlobals());

describe('当前节点快速 SL', () => {
  it('出牌和敌方行动后恢复整个战斗开局，重放相同攻击得到相同结果', () => {
    const original = enter('combat');
    const cs = original.combat!;
    const attack = cs.player.hand.find((c) => viewCard(c).type === 'attack')!;
    const played = R.combatPlayCard(original, attack.uid, cs.enemies[0].id);
    let later = R.combatEndTurn(played.run).run;
    for (const e of later.combat!.enemies) later = R.combatEnemyAct(later, e.id).run;
    const restored = R.resetCurrentNode(copy(later));
    expect(restored).toEqual(original);
    expect(R.combatPlayCard(restored, attack.uid, cs.enemies[0].id)).toEqual(played);
    expect(restored.checkpoint).not.toHaveProperty('checkpoint');
  });

  it('领奖后只回退奖励，保留战后生命与击杀统计，不再重打战斗', () => {
    const original = enter('elite');
    original.combat!.player.hp = 17;
    const reward = win(original);
    let claimed = R.rewardTakeGold(reward);
    claimed = R.rewardTakeCard(claimed, claimed.reward!.cards[0].uid);
    claimed = R.rewardTakeRelic(claimed);
    claimed = R.rewardLeave(claimed);
    const restored = R.resetCurrentNode(claimed);
    expect(restored).toEqual(reward);
    expect(restored.combat).toBeNull();
    expect(restored.hp).toBe(17);
    expect(restored.stats.enemiesKilled).toBeGreaterThan(0);
    expect(R.resetCurrentNode(restored)).toEqual(reward);
    const reselected = R.rewardTakeCard(restored, restored.reward!.cards[1].uid);
    expect(reselected.deck.some((card) => card.uid === reward.reward!.cards[0].uid)).toBe(false);
    expect(reselected.deck).toHaveLength(reward.deck.length + 1);
  });

  it('旧版领奖存档补齐奖励回退点，返还生命遗物收益且不丢当前进度', () => {
    const values = memoryStorage();
    const battle = enter('elite');
    const reward = win(battle);
    reward.reward!.relic = 'blood_charm';
    reward.checkpoint = null;
    const baseline = R.resetCurrentNode(reward);
    const claimed = R.rewardTakeRelic(R.rewardTakeGold(R.rewardTakeCard(baseline, baseline.reward!.cards[0].uid)));
    for (const version of [4, 5]) {
      values.set('ember-traveler:save', JSON.stringify({ ...claimed, version, checkpoint: version === 4 ? undefined : battle.checkpoint }));
      const loaded = loadRun()!;
      expect(loaded.gold).toBe(claimed.gold);
      expect(loaded.maxHp).toBe(claimed.maxHp);
      expect(R.resetCurrentNode(loaded)).toEqual(baseline);
      expect(R.resetCurrentNode(R.rewardLeave(loaded))).toEqual(baseline);
    }
  });

  it('敲牌离开营火后仍可撤回并重选，进入下一节点才更换回退点', () => {
    const original = enter('rest');
    const upgraded = R.restLeave(R.restUpgrade(original, original.deck[0].uid));
    const restored = R.resetCurrentNode(upgraded);
    expect(restored).toEqual(original);
    const alternate = R.restUpgrade(restored, original.deck[1].uid);
    expect(alternate.deck[0].upgraded).toBe(false);
    expect(alternate.deck[1].upgraded).toBe(true);
    const map = R.restLeave(alternate);
    const nextId = map.map.nodes[map.currentNodeId!].next[0];
    map.map.nodes[nextId].type = 'shop';
    const next = R.travelTo(map, nextId);
    expect(R.resetCurrentNode(R.shopLeave(next))).toEqual(next);
    expect(next.checkpoint!.currentNodeId).toBe(nextId);
    expect(next.checkpoint).not.toHaveProperty('checkpoint');
  });

  it('商店回退恢复删牌、商品库存与金币', () => {
    const original = enter('shop');
    let run = R.shopBuyCard(original, 0);
    run = R.shopBuyRelic(run, 0);
    run = R.shopRemoveCard(run, original.deck[0].uid);
    expect(run.gold).toBeLessThan(original.gold);
    expect(run.deck.some((card) => card.uid === original.deck[0].uid)).toBe(false);
    expect(R.resetCurrentNode(R.shopLeave(run))).toEqual(original);
  });

  it('随机事件回退保持事件与随机结果一致', () => {
    const base = R.newRun('EVENT-SL');
    base.usedEvents = EVENT_LIST.filter((event) => event.id !== 'ember_sprite').map((event) => event.id);
    base.map.nodes[base.map.startIds[0]].type = 'event';
    base.map.nodes[base.map.startIds[0]].mysteryType = 'event';
    const original = R.travelTo(base, base.map.startIds[0]);
    const choice = R.eventChoose(original, 'absorb');
    const restored = R.resetCurrentNode(choice);
    expect(restored).toEqual(original);
    expect(R.eventChoose(restored, 'absorb')).toEqual(choice);
  });

  it('死亡后刷新恢复战斗，最终胜利后刷新保持通关', () => {
    memoryStorage();
    for (const outcome of ['lost', 'won'] as const) {
      const original = enter('boss', 'FINAL-SL', 4);
      const terminal = copy(original);
      terminal.combat!.outcome = outcome;
      if (outcome === 'lost') terminal.combat!.player.hp = 0;
      const reward = R.finishCombat(terminal);
      const ended = reward;
      saveRun(ended);
      const loaded = loadRun()!;
      expect(loaded.screen).toBe(outcome === 'lost' ? 'gameover' : 'victory');
      expect(R.resetCurrentNode(loaded)).toEqual(outcome === 'lost' ? original : reward);
    }
  });

  it('v4 存档升级保留原进度，不伪造回退点；新局不会继承旧节点', () => {
    const values = memoryStorage();
    const original = enter('combat');
    const { checkpoint: _checkpoint, ...old } = copy(original);
    values.set('ember-traveler:save', JSON.stringify({ ...old, version: 4 }));
    const migrated = loadRun()!;
    expect(migrated).toEqual({ ...old, version: R.SAVE_VERSION, checkpoint: null });
    expect(R.resetCurrentNode(migrated)).toBe(migrated);
    migrated.screen = 'map';
    migrated.combat = null;
    const nextId = migrated.map.nodes[migrated.currentNodeId!].next[0];
    migrated.map.nodes[nextId].type = 'rest';
    const next = R.travelTo(migrated, nextId);
    expect(next.checkpoint!.version).toBe(R.SAVE_VERSION);
    expect(R.resetCurrentNode(R.restHeal(next))).toEqual(next);
    expect(R.newRun('FRESH').checkpoint).toBeNull();
  });
});
