import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CombatState, RunState } from '../engine/types';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function combat(gold = 50, enemies = ['looter']): CombatState {
  return createCombat('stolen-gold', enemies, 'normal', [], 200, 200, [], makeRng('STOLEN-GOLD', 'combat'), 100, 'traveler', undefined, gold).state;
}
function steal(input: CombatState, index = 0): CombatState {
  const cs = input.phase === 'enemy' ? copy(input) : endPlayerTurn(input).state;
  cs.enemies[index].moveId = cs.enemies[index].defId === 'ash_taxman' ? 'levy' : 'steal';
  delete cs.enemies[index].flags.acted;
  return enemyAct(cs, cs.enemies[index].id).state;
}
function kill(input: CombatState, index = 0) {
  const cs = input.phase === 'player' ? copy(input) : startPlayerTurn(input).state;
  cs.player.hand = [{ uid: 'finish-thief', defId: 'strike', upgraded: false }];
  cs.player.energy = 3;
  cs.enemies[index].hp = 1;
  cs.enemies[index].block = 0;
  return playCard(cs, 'finish-thief', cs.enemies[index].id);
}
function battleRun(gold = 50, enemies = ['looter']): RunState {
  const run = R.travelTo(R.newRun('STOLEN-GOLD'), R.newRun('STOLEN-GOLD').map.startIds[0]);
  run.gold = gold;
  run.combat = combat(gold, enemies);
  run.hp = run.combat.player.hp;
  run.maxHp = run.hp;
  run.relics = [];
  const { checkpoint: _checkpoint, ...snapshot } = run;
  run.checkpoint = copy(snapshot);
  return run;
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

describe('偷钱与击杀返还', () => {
  it.each([0, 7, 50])('钱包为 %s 时只偷走实际拥有的金币，击杀原额返还', gold => {
    const stolen = steal(combat(gold));
    expect(stolen.gold).toBe(Math.max(0, gold - 12));
    expect(stolen.enemies[0].flags.stolenGold ?? 0).toBe(Math.min(gold, 12));
    const killed = kill(stolen).state;
    expect(killed.gold).toBe(gold);
    expect(killed.enemies[0].flags.stolenGold ?? 0).toBe(0);
    expect(killed.outcome).toBe('won');
  });

  it('反复征税累计实际偷款，钱包耗尽后不产生额外可返还金币', () => {
    let cs = combat(45, ['ash_taxman']);
    for (let i = 0; i < 4; i++) {
      cs = steal(cs);
      if (i < 3) cs = startPlayerTurn(cs).state;
    }
    expect(cs.gold).toBe(0);
    expect(cs.enemies[0].flags.stolenGold).toBe(45);
    expect(kill(cs).state.gold).toBe(45);
  });

  it('多个偷钱敌人各自记账，逐个击杀只返还对应敌人的偷款', () => {
    let cs = steal(steal(combat(50, ['looter', 'ash_taxman']), 0), 1);
    expect(cs.gold).toBe(18);
    expect(cs.enemies.map(e => e.flags.stolenGold)).toEqual([12, 20]);
    cs = kill(cs, 0).state;
    expect(cs.gold).toBe(30);
    expect(cs.outcome).toBe('ongoing');
    const unchanged = endPlayerTurn(cs).state;
    expect(unchanged.gold).toBe(30);
    expect(unchanged.enemies[1].flags.stolenGold).toBe(20);
    expect(kill(unchanged, 1).state.gold).toBe(50);
  });

  it('群攻同时击杀全部偷钱敌人，返还总额且不能重复触发死亡收益', () => {
    let cs = steal(steal(combat(50, ['looter', 'ash_taxman']), 0), 1);
    cs = startPlayerTurn(cs).state;
    cs.enemies.forEach(e => { e.hp = 1; e.block = 0; });
    cs.player.hand = [{ uid: 'aoe', defId: 'final_conflagration', upgraded: false }];
    cs.player.ember = 1;
    const dead = playCard(cs, 'aoe', null).state;
    expect(dead.enemies.every(e => e.hp === 0)).toBe(true);
    expect(dead.gold).toBe(50);
    expect(dead.enemies.every(e => !e.flags.stolenGold)).toBe(true);
    expect(endPlayerTurn(dead).state).toBe(dead);
    expect(enemyAct(dead, 'e0').state).toBe(dead);
    expect(startPlayerTurn(dead).state).toBe(dead);
  });

  it.each(['burn', 'thorns'] as const)('%s 击杀也返还金币，并阻止敌人继续偷窃', source => {
    let cs = startPlayerTurn(steal(combat(50))).state;
    cs.enemies[0].hp = 1;
    if (source === 'burn') cs.enemies[0].statuses.burn = 1;
    else cs.player.statuses.thorns = 1;
    cs = endPlayerTurn(cs).state;
    cs.enemies[0].moveId = 'steal';
    const dead = enemyAct(cs, 'e0').state;
    expect(dead.gold).toBe(50);
    expect(dead.enemies[0].flags.stolenGold ?? 0).toBe(0);
    expect(dead.outcome).toBe('won');
  });

  it('敌人攻击与荆棘同归于尽时已死敌人返款，玩家仍判负', () => {
    let cs = startPlayerTurn(steal(combat(50))).state;
    cs.player.hp = 1;
    cs.player.statuses.thorns = 1;
    cs.enemies[0].hp = 1;
    cs = endPlayerTurn(cs).state;
    cs.enemies[0].moveId = 'steal';
    const dead = enemyAct(cs, 'e0').state;
    expect(dead.gold).toBe(50);
    expect(dead.player.hp).toBe(0);
    expect(dead.enemies[0].hp).toBe(0);
    expect(dead.outcome).toBe('lost');
  });

  it('未曾偷钱的敌人死亡不会凭空增加金币', () => {
    const cs = kill(combat(50)).state;
    expect(cs.gold).toBe(50);
    expect(cs.outcome).toBe('won');
  });

  it('局内钱包实时同步；胜利不再扣偷款，归还金额不受难度或遗物奖励放大', () => {
    let run = battleRun();
    run.difficulty.gold = 200;
    run.relics = ['coin_purse'];
    run = R.combatEndTurn(run).run;
    run.combat!.enemies[0].moveId = 'steal';
    run = R.combatEnemyAct(run, 'e0').run;
    expect(run.gold).toBe(38);
    run = R.combatStartTurn(run).run;
    run.combat!.player.hand = [{ uid: 'kill', defId: 'strike', upgraded: false }];
    run.combat!.enemies[0].hp = 1;
    run = R.combatPlayCard(run, 'kill', 'e0').run;
    expect(run.gold).toBe(50);
    const reward = R.finishCombat(run);
    expect(reward.gold).toBe(50);
    expect(reward.reward!.gold).toBeGreaterThanOrEqual(35);
    expect(reward.reward!.gold).toBeLessThanOrEqual(45);
    const taken = R.rewardTakeGold(reward);
    expect(taken.gold).toBe(50 + reward.reward!.gold);
    expect(R.rewardTakeGold(taken)).toBe(taken);
    expect(R.finishCombat(reward)).toBe(reward);
  });

  it('尚未击杀偷钱怪就倒下时，不返还仍在敌人手里的金币', () => {
    let run = battleRun();
    run = R.combatEndTurn(run).run;
    run.combat!.enemies[0].moveId = 'steal';
    run = R.combatEnemyAct(run, 'e0').run;
    run = R.combatStartTurn(run).run;
    run.combat!.player.hp = 1;
    run = R.combatEndTurn(run).run;
    run.combat!.enemies[0].moveId = 'lunge';
    run = R.combatEnemyAct(run, 'e0').run;
    expect(R.finishCombat(run).gold).toBe(38);
  });

  it('被偷和返还之后刷新、快速 SL、奖励重选均不会重复扣款或刷钱', () => {
    memoryStorage();
    const original = battleRun();
    let run = R.combatEndTurn(original).run;
    run.combat!.enemies[0].moveId = 'steal';
    run = R.combatEnemyAct(run, 'e0').run;
    saveRun(run);
    run = loadRun()!;
    expect(run.gold).toBe(38);
    expect(R.combatEnemyAct(run, 'e0').run).toBe(run);
    expect(R.resetCurrentNode(run)).toEqual(original);
    run = R.combatStartTurn(run).run;
    run.combat!.player.hand = [{ uid: 'kill', defId: 'strike', upgraded: false }];
    run.combat!.enemies[0].hp = 1;
    run = R.combatPlayCard(run, 'kill', 'e0').run;
    saveRun(run);
    const won = loadRun()!;
    expect(won.gold).toBe(50);
    expect(won.combat!.enemies[0].flags.stolenGold ?? 0).toBe(0);
    const reward = R.finishCombat(won);
    const reset = R.resetCurrentNode(R.rewardTakeGold(reward));
    expect(reset.gold).toBe(50);
    expect(reset.combat).toBeNull();
    expect(R.rewardTakeGold(reset).gold).toBe(50 + reward.reward!.gold);
  });

  it('v13 旧战斗只扣活敌实际能持有的偷款，当前局与回退点一起迁移且不重复扣', () => {
    const values = memoryStorage();
    const run = battleRun(25, ['ash_taxman', 'looter', 'looter']);
    const legacy = JSON.parse(JSON.stringify(run));
    legacy.version = 13;
    delete legacy.combat.gold;
    legacy.combat.enemies[0].flags.stolenGold = 20;
    legacy.combat.enemies[1].flags.stolenGold = 12;
    legacy.combat.enemies[2].flags.stolenGold = 12;
    legacy.combat.enemies[2].hp = 0;
    legacy.combat.enemies[2].flags.deadHandled = 1;
    legacy.checkpoint.version = 13;
    legacy.checkpoint.gold = 70;
    delete legacy.checkpoint.combat.gold;
    legacy.checkpoint.combat.enemies[0].flags.stolenGold = 8;
    legacy.checkpoint.combat.enemies[1].flags.stolenGold = 7;
    legacy.checkpoint.combat.enemies[1].hp = 0;
    values.set('ember-traveler:save', JSON.stringify(legacy));
    const migrated = loadRun()!;
    expect(migrated.version).toBe(R.SAVE_VERSION);
    expect(migrated.gold).toBe(0);
    expect(migrated.combat!.gold).toBe(0);
    expect(migrated.combat!.enemies.map(e => e.flags.stolenGold ?? 0)).toEqual([20, 5, 0]);
    expect(migrated.checkpoint!.gold).toBe(62);
    expect(migrated.checkpoint!.combat!.gold).toBe(62);
    expect(migrated.checkpoint!.combat!.enemies.map(e => e.flags.stolenGold ?? 0)).toEqual([8, 0, 0]);
    expect(loadRun()).toEqual(migrated);
    saveRun(migrated);
    expect(loadRun()).toEqual(migrated);
    const reset = R.resetCurrentNode(migrated);
    expect(reset.gold).toBe(62);
    expect(reset.combat!.gold).toBe(62);
  });

  it('v13 已经击杀但尚未进奖励的战斗不会追扣死敌偷款', () => {
    const values = memoryStorage();
    const legacy = JSON.parse(JSON.stringify(battleRun(50)));
    legacy.version = 13;
    delete legacy.combat.gold;
    legacy.combat.enemies[0].hp = 0;
    legacy.combat.enemies[0].flags.deadHandled = 1;
    legacy.combat.enemies[0].flags.stolenGold = 120;
    legacy.combat.outcome = 'won';
    legacy.combat.phase = 'ended';
    values.set('ember-traveler:save', JSON.stringify(legacy));
    const loaded = loadRun()!;
    expect(loaded.gold).toBe(50);
    expect(loaded.combat!.gold).toBe(50);
    expect(loaded.combat!.enemies[0].flags.stolenGold ?? 0).toBe(0);
    expect(R.finishCombat(loaded).gold).toBe(50);
  });
});
