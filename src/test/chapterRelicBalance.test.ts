import { describe, expect, it } from 'vitest';
import { CHAPTER_RELICS } from '../data/chapterRelics';
import { RELICS } from '../data/relics';
import { describeRelicRules } from '../data/relicRules';
import { createCombat, endPlayerTurn, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import type { CombatState } from '../engine/types';

const card = (defId: string, uid: string) => ({ defId, uid, upgraded: false });
function battle(relics: string[] = []): CombatState {
  const deck = Array.from({ length: 60 }, (_, i) => card('strike', `draw-${i}`));
  const cs = createCombat('chapter-balance', ['furnace_drone', 'furnace_drone'], 'normal', deck,
    30, 100, relics, makeRng('CHAPTER-BALANCE', 'combat'), 100, 'oathbound').state;
  cs.enemies.forEach(e => { e.hp = e.maxHp = 10000; e.block = 0; });
  return cs;
}
const next = (cs: CombatState) => startPlayerTurn(endPlayerTurn(cs).state).state;
function playInjected(cs: CombatState, defId: string, uid: string) {
  cs.player.hand.push(card(defId, uid));
  return playCard(cs, uid, defId === 'quick_stab' ? 'e0' : null);
}
function victory(relics: string[], tier: 'normal' | 'elite' = 'normal') {
  let run = R.newRun('CHAPTER-JOURNEY'); run.relics = relics; run.hp = 20;
  run.map.nodes[run.map.startIds[0]].type = tier === 'elite' ? 'elite' : 'combat';
  run = R.travelTo(run, run.map.startIds[0]);
  run.combat!.outcome = 'won';
  return R.finishCombat(run);
}

describe('章节遗物的资源与恢复边界', () => {
  it('主齿轮一回合打八张牌也只奖励一次，下一回合恢复计数', () => {
    let cs = battle(['clocktower_gear']); cs.player.hand = [];
    const energy = cs.player.energy, draw = cs.player.draw.length;
    let procs = 0;
    for (let i = 0; i < 8; i++) {
      const step = playInjected(cs, 'quick_stab', `hit-${i}`); cs = step.state;
      procs += step.events.filter(e => e.type === 'relic' && e.relicId === 'clocktower_gear').length;
    }
    expect(procs).toBe(1);
    expect(cs.player.energy - energy).toBe(1);
    expect(draw - cs.player.draw.length).toBe(1);
    expect(cs.player.block).toBeGreaterThanOrEqual(5);
    expect(cs.player.block).toBeLessThanOrEqual(6);
    cs = next(cs); cs.player.hand = [];
    for (let i = 0; i < 4; i++) cs = playInjected(cs, 'quick_stab', `again-${i}`).state;
    expect(cs.player.energy).toBe(4);
    expect(cs.player.block).toBeLessThanOrEqual(6);
  });

  it('大摆锤六回合最多返三能量，偶数回合解除虚弱而不继续增加抽牌', () => {
    let cs = battle(['belltower_pendulum']);
    let bonusEnergy = cs.player.energy - 3;
    expect(cs.player.hand.length).toBe(5);
    for (let turn = 2; turn <= 6; turn++) {
      cs = endPlayerTurn(cs).state;
      cs.player.statuses.weak = 2;
      cs = startPlayerTurn(cs).state;
      bonusEnergy += cs.player.energy - 3;
      expect(cs.player.hand.length).toBe(5);
      expect(cs.player.statuses.weak).toBe(turn % 2 === 0 ? 1 : 2);
    }
    expect(bonusEnergy).toBe(3);
  });

  it('深城总典保留持续过牌优势，但不凭一件遗物把每回合手牌变成八张', () => {
    let cs = battle(['deep_archive']);
    expect(cs.player.hand.length).toBeLessThanOrEqual(7);
    for (let i = 0; i < 4; i++) {
      cs = next(cs);
      expect(cs.player.hand.length).toBe(6);
      expect(cs.player.energy).toBe(3);
    }
  });

  it('万炉动力核每回合首次消耗只返一能量，连耗不会反复供能', () => {
    let cs = battle(['foundry_core']); cs.player.hand = [];
    const before = cs.player.energy;
    for (let i = 0; i < 4; i++) cs = playInjected(cs, 'pick_up', `exhaust-${i}`).state;
    expect(cs.player.energy - before).toBe(1);
    cs = next(cs); cs.player.hand = [];
    cs = playInjected(cs, 'pick_up', 'next-exhaust').state;
    expect(cs.player.energy).toBe(4);
  });

  it('王冠开局状态、王灯与罗盘开局供能受到章奖上限约束', () => {
    expect(battle(['royal_ash_crown']).enemies.every(e => (e.statuses.burn ?? 0) <= 8)).toBe(true);
    expect(battle(['starfire_seal']).enemies.every(e => (e.statuses.burn ?? 0) <= 10)).toBe(true);
    expect(battle(['crowned_lantern']).player.energy).toBeLessThanOrEqual(4);
    expect(battle(['comet_compass']).player.energy).toBeLessThanOrEqual(5);
    expect(battle(['furnace_crown']).player.statuses.strength).toBeLessThanOrEqual(3);
    expect(battle(['astral_crown']).player.statuses.strength).toBeLessThanOrEqual(4);
    expect(battle(['gatekeeper_aegis']).player.statuses.dexterity ?? 0).toBe(0);
  });

  it('城门巨盾给予固定开场盾和回合末防御，不再复制敏捷护符的出牌收益', () => {
    let cs = battle(['gatekeeper_aegis']);
    expect(cs.player.block).toBe(18);
    expect(cs.player.statuses.dexterity ?? 0).toBe(0);
    cs = playInjected(cs, 'defend', 'defend').state;
    expect(cs.player.block).toBe(23);
    cs = endPlayerTurn(cs).state;
    expect(cs.player.block).toBe(26);
    cs = startPlayerTurn(cs).state;
    expect(cs.player.block).toBe(0);
    expect(endPlayerTurn(cs).state.player.block).toBe(3);
  });

  it('满月圣盾偶数回合提供防御并清脆弱，奇数回合没有被动墙', () => {
    let cs = battle(['moonward_aegis']);
    expect(cs.player.block).toBe(0);
    for (let turn = 2; turn <= 4; turn++) {
      cs = endPlayerTurn(cs).state; cs.player.statuses.frail = 2;
      cs = startPlayerTurn(cs).state;
      expect(cs.player.block).toBe(turn % 2 === 0 ? 16 : 0);
      expect(cs.player.statuses.frail).toBe(turn % 2 === 0 ? 1 : 2);
    }
  });

  it('御风总谱奖励技能序列的易伤，不再靠每三牌反复抽牌', () => {
    let cs = battle(['windbound_ledger']); cs.player.hand = [];
    const draw = cs.player.draw.length;
    for (let i = 0; i < 8; i++) cs = playInjected(cs, 'quick_stab', `attack-${i}`).state;
    expect(cs.player.draw.length).toBe(draw);
    expect(cs.enemies.every(e => !e.statuses.vulnerable)).toBe(true);
    for (let i = 0; i < 6; i++) cs = playInjected(cs, 'flex', `skill-${i}`).state;
    expect(cs.enemies.every(e => e.statuses.vulnerable === 1)).toBe(true);
    expect(cs.player.block).toBe(6);
    expect(cs.player.draw.length).toBe(draw);
  });

  it('古城心石第二回合需实际防御铺垫才恢复，不能空等或拖回合刷血', () => {
    const run = R.newRun('HEART'); run.hp = 20;
    const beforeMax = run.maxHp;
    R.addRelic(run, 'old_city_heart');
    expect(run.maxHp - beforeMax).toBe(12);
    expect(run.hp).toBe(20);
    let cs = next(battle(['old_city_heart']));
    expect(cs.player.hp).toBe(30);
    cs = playInjected(cs, 'defend', 'shield-a').state;
    cs = playInjected(cs, 'defend', 'shield-b').state;
    expect(cs.player.block).toBe(10);
    expect(cs.player.energy).toBe(1);
    cs = endPlayerTurn(cs).state;
    expect(cs.player.hp).toBe(36);
    expect(endPlayerTurn(cs).state).toBe(cs);
    cs = startPlayerTurn(cs).state;
    cs = playInjected(cs, 'defend', 'again-a').state;
    cs = playInjected(cs, 'defend', 'again-b').state;
    cs = next(cs);
    for (let i = 0; i < 5; i++) cs = next(cs);
    expect(cs.player.hp).toBe(36);
    const unprepared = next(battle(['old_city_heart']));
    expect(endPlayerTurn(playInjected(unprepared, 'defend', 'only-shield').state).state.player.hp).toBe(30);
    R.addRelic(run, 'old_city_heart'); expect(run.maxHp - beforeMax).toBe(12);
  });

  it('深城金库将主要收益放在精英战后，与纯金币铸币模区分', () => {
    const run = R.newRun('TREASURY'), gold = run.gold;
    R.addRelic(run, 'deep_city_treasury');
    expect(run.gold - gold).toBeGreaterThan(0);
    expect(run.gold - gold).toBeLessThanOrEqual(150);
    const ordinary = victory(['deep_city_treasury']), elite = victory(['deep_city_treasury'], 'elite');
    expect(ordinary.reward!.gold).toBe(victory([]).reward!.gold);
    expect(elite.reward!.gold - victory([], 'elite').reward!.gold).toBe(40);
  });

  it('古道圣匣胜利成长与治疗各结算一次，不再是金币水壶的数值升级', () => {
    const plain = victory([]), result = victory(['pilgrim_reliquary']);
    expect(result.maxHp - plain.maxHp).toBe(1);
    expect(result.hp - plain.hp).toBe(3);
    expect(result.reward!.gold).toBe(plain.reward!.gold);
    expect(R.finishCombat(result)).toBe(result);
    expect(R.resetCurrentNode(R.rewardTakeGold(result))).toEqual(result);
  });

  it('每章仍有九件，自动说明对应真实规则，停发纪念遗物继续兼容', () => {
    for (const chapter of [1, 2, 3, 4]) expect(CHAPTER_RELICS.filter(r => r.chapter === chapter)).toHaveLength(9);
    for (const relic of CHAPTER_RELICS) expect(relic.description).toBe(describeRelicRules(relic.combat, relic.journey));
    expect(RELICS.nightless_key.journey![0].effects).toEqual([{ kind: 'gold', amount: 600 }]);
  });
});
