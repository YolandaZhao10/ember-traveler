import { describe, expect, it } from 'vitest';
import { createCombat, endPlayerTurn, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import type { CombatState } from '../engine/types';

const card = (defId: string, uid = defId) => ({ uid, defId, upgraded: false });
function battle(relics: string[], character: 'traveler' | 'picker' | 'oathbound' | 'scholar' = 'traveler') {
  const cs = createCombat('relic-regular-balance', ['furnace_drone'], 'normal', [], 30, 100, relics, makeRng('RELIC-REGULAR', 'combat'), 100, character).state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 10000;
  cs.player.draw = Array.from({ length: 80 }, (_, i) => card('strike', `draw-${i}`));
  cs.player.hand = [];
  return cs;
}
function play(input: CombatState, defId: string, uid = defId) {
  input.player.hand.push(card(defId, uid));
  return playCard(input, uid, 'e0').state;
}
function next(input: CombatState) { return startPlayerTurn(endPlayerTurn(input).state).state; }

describe('常规与角色专属遗物的强度边界和差异', () => {
  it('保留牌不能让封存秘典被动每回合加能量；实际打出能力后才蓄力', () => {
    let cs = battle(['sealed_codex'], 'scholar');
    cs.player.hand = [card('rune_shield', 'held')];
    cs = next(cs);
    expect(cs.player.energy).toBe(3);
    const before = cs.player.hand.find(c => c.uid === 'held')!.bonus ?? 0;
    cs = play(cs, 'resonance');
    expect(cs.player.hand.find(c => c.uid === 'held')!.bonus).toBe(before + 1);
    expect(cs.player.block).toBe(3);
    const after = cs.player.hand.find(c => c.uid === 'held')!.bonus;
    cs.player.energy = 3;
    cs = play(cs, 'resonance', 'second');
    expect(cs.player.hand.find(c => c.uid === 'held')!.bonus).toBe(after);
  });

  it('无尽笔不再无条件提供回响；两次真实回响才给一次蓄力奖励', () => {
    let cs = battle(['infinity_quill'], 'scholar');
    cs.player.hand = [card('rune_shield', 'held')];
    cs = next(cs);
    expect(cs.player.statuses.echo ?? 0).toBe(0);
    const before = cs.player.hand.find(c => c.uid === 'held')!.bonus ?? 0;
    cs.player.statuses.echo = 3;
    cs = play(cs, 'quick_stab', 'first');
    expect(cs.player.hand.find(c => c.uid === 'held')!.bonus).toBe(before);
    cs = play(cs, 'quick_stab', 'second');
    expect(cs.player.hand.find(c => c.uid === 'held')!.bonus).toBe(before + 1);
    expect(cs.player.ember).toBe(4); // 无尽笔2余烬，加第二张疾刺及其回响各1余烬。
    cs = play(cs, 'strike', 'third');
    expect(cs.player.hand.find(c => c.uid === 'held')!.bonus).toBe(before + 1);
    expect(cs.player.ember).toBe(4); // 无尽笔2余烬，加第二张疾刺及其回响各1余烬。
  });

  it('守锋令不会在防守和连击条件下每回合同时叠力量与额外能量', () => {
    let cs = battle(['vanguard_token']);
    cs.player.block = 10;
    cs = play(cs, 'quick_stab', 'first'); cs = play(cs, 'quick_stab', 'second');
    cs = endPlayerTurn(cs).state;
    expect(cs.player.statuses.strength ?? 0).toBe(0);
    expect(cs.player.statuses.energyNext).toBe(1);
    cs = startPlayerTurn(cs).state;
    expect(cs.player.energy).toBe(4);
    expect(cs.player.statuses.energyNext ?? 0).toBe(0);
  });

  it('渡鸦面具六回合最多治疗六点，不能每回合无代价回血', () => {
    let cs = battle(['raven_mask']); const hp = cs.player.hp;
    for (let i = 0; i < 6; i++) cs = next(cs);
    expect(cs.player.hp - hp).toBeGreaterThan(0);
    expect(cs.player.hp - hp).toBeLessThanOrEqual(6);
    cs.player.hp = 70;
    cs = next(cs); cs = next(cs);
    expect(cs.player.hp).toBe(70);
  });

  it('铜羽需要先技能后第二次攻击，不再与开场抽牌罗盘同质', () => {
    let cs = battle(['copper_feather']);
    expect(cs.player.hand).toHaveLength(0);
    const draw = cs.player.draw.length;
    cs = play(cs, 'defend');
    cs = play(cs, 'quick_stab', 'first'); expect(cs.player.draw.length).toBe(draw);
    cs = play(cs, 'quick_stab', 'second'); expect(cs.player.draw.length).toBe(draw - 1);
    cs = play(cs, 'quick_stab', 'third'); expect(cs.player.draw.length).toBe(draw - 1);
  });

  it('岗哨灯以清燃烧和少量格挡换掉纯格挡强化版', () => {
    let cs = battle(['sentry_lamp'], 'picker');
    cs.enemies[0].statuses.burn = 3;
    cs.player.statuses.burn = 4;
    cs = next(cs);
    // 玩家先结算燃烧4→3，再由遗物清2→1；不能回溯免除本次燃烧。
    expect(cs.player.hp).toBe(26);
    expect(cs.player.statuses.burn).toBe(1);
    expect(cs.player.block).toBe(2);
  });

  it('护身墨削弱敌人，炭筛清理脆弱并积累余烬，不再复制格挡/抽牌遗物', () => {
    let cs = battle(['warding_ink', 'charcoal_sieve'], 'picker');
    cs.player.statuses.frail = 2;
    cs = play(cs, 'pick_up', 'first');
    const afterFirst = cs.player.draw.length;
    cs = play(cs, 'pick_up', 'second');
    expect(cs.player.draw.length).toBe(afterFirst - 1); // 只来自拾取本身
    expect(cs.player.statuses.frail).toBe(1);
    expect(cs.player.ember).toBe(1);
    expect(cs.player.block).toBe(0);
    expect(cs.enemies[0].statuses.weak).toBe(1);
  });

  it('干粮与坚根不再是血契护符的不同数字版，铸币印不再一次性发金币', () => {
    const run = R.newRun('REGULAR-OBTAIN'); run.hp = 20;
    const hp = run.maxHp, gold = run.gold;
    R.addRelic(run, 'sealed_rations');
    expect(run.maxHp).toBe(hp); expect(run.hp).toBe(32);
    R.addRelic(run, 'strongroot');
    expect(run.maxHp).toBe(hp);
    R.addRelic(run, 'mint_stamp');
    expect(run.gold).toBe(gold);
  });
  it('巨人印提供周期临时力量，战后归还，不复制磨石的永久力量', () => {
    let cs = battle(['titan_seal'], 'oathbound');
    expect(cs.player.statuses.strength ?? 0).toBe(0);
    cs = next(cs); expect(cs.player.statuses.strength ?? 0).toBe(0);
    cs = next(cs); expect(cs.player.statuses.strength).toBe(2);
    expect(cs.player.statuses.strengthDown).toBe(2); expect(cs.player.block).toBe(4);
    cs = next(cs); expect(cs.player.statuses.strength ?? 0).toBe(0);
    cs = next(cs); cs = next(cs); expect(cs.player.statuses.strength).toBe(2);
    cs = next(cs); expect(cs.player.statuses.strength ?? 0).toBe(0);
  });

  it('铜筹码只在付费删牌返金，铸币印只在实际购买后成长；重复操作不再触发', () => {
    let run = R.newRun('REGULAR-ECONOMY'); run.gold = 1000;
    R.addRelic(run, 'bronze_token'); R.addRelic(run, 'mint_stamp');
    run.map.nodes[run.map.startIds[0]].type = 'shop';
    run = R.travelTo(run, run.map.startIds[0]);
    const hp = run.maxHp, cost = run.shop!.removePrice;
    run = R.shopRemoveCard(run, run.deck[0].uid);
    expect(run.gold).toBe(1000 - cost + 12); expect(run.maxHp).toBe(hp);
    expect(R.shopRemoveCard(run, run.deck[0].uid)).toBe(run);
    const gold = run.gold, price = run.shop!.cards[0].price;
    run = R.shopBuyCard(run, 0);
    expect(run.gold).toBe(gold - price); expect(run.maxHp).toBe(hp + 1);
    expect(R.shopBuyCard(run, 0)).toBe(run);
  });

  it('围裙提供锻造后的生命上限成长，铁砧提供锻造资金，均只结算一次', () => {
    let run = R.newRun('REGULAR-FORGE'); run.hp = 20;
    R.addRelic(run, 'smith_apron'); R.addRelic(run, 'master_anvil');
    run.map.nodes[run.map.startIds[0]].type = 'rest';
    run = R.travelTo(run, run.map.startIds[0]);
    const hp = run.maxHp, gold = run.gold;
    run = R.restUpgrade(run, run.deck[0].uid);
    expect(run.maxHp).toBe(hp + 1); expect(run.hp).toBe(20); expect(run.gold).toBe(gold + 12);
    expect(R.restUpgrade(run, run.deck[1].uid)).toBe(run);
  });

  it('缝血针缓解易伤并格挡，不再覆盖血滴坠饰的抽牌能力', () => {
    let cs = battle(['oath_needle'], 'oathbound');
    cs.player.statuses.vulnerable = 2;
    let control = structuredClone(cs); control.relics = [];
    cs = play(cs, 'crimson_step', 'first-loss'); control = play(control, 'crimson_step', 'first-loss');
    expect(cs.player.statuses.vulnerable).toBe(1);
    expect(cs.player.block - control.player.block).toBe(2);
    expect(cs.player.draw.length).toBe(control.player.draw.length);
    cs = play(cs, 'crimson_step', 'second-loss'); control = play(control, 'crimson_step', 'second-loss');
    expect(cs.player.statuses.vulnerable).toBe(1);
    expect(cs.player.block - control.player.block).toBe(2);
    expect(cs.player.draw.length).toBe(control.player.draw.length);
  });

  it('暮色镜片从第二回合起按真实剩余手牌护体，不增加敏捷或首回合固定格挡', () => {
    let cs = battle(['dusk_glass']);
    expect(cs.player.statuses.dexterity ?? 0).toBe(0);
    expect(cs.player.statuses.arcaneWard ?? 0).toBe(0); expect(cs.player.block).toBe(0);
    cs = next(cs);
    expect(cs.player.statuses.arcaneWard).toBe(1);
    cs.player.hand = [card('strike', 'a'), card('defend', 'b'), card('rune_shield', 'held')];
    cs = endPlayerTurn(cs).state;
    expect(cs.player.block).toBe(3);
    cs = startPlayerTurn(cs).state;
    expect(cs.player.statuses.arcaneWard).toBe(1);
    cs.player.hand = [];
    cs = endPlayerTurn(cs).state; expect(cs.player.block).toBe(0);
  });

  it('破晓晶石以首回合剩余能量准备下回合爆发，不能复制开场能量石或重复领取', () => {
    let cs = battle(['dawn_crystal']);
    expect(cs.player.energy).toBe(3); expect(cs.player.ember).toBe(0);
    cs.player.energy = 1;
    cs = endPlayerTurn(cs).state;
    expect(cs.player.statuses.energyNext).toBe(2); expect(cs.player.ember).toBe(2);
    expect(endPlayerTurn(cs).state).toBe(cs);
    cs = startPlayerTurn(cs).state;
    expect(cs.player.energy).toBe(5); expect(cs.player.statuses.energyNext ?? 0).toBe(0);
    cs = endPlayerTurn(cs).state;
    expect(cs.player.statuses.energyNext ?? 0).toBe(0); expect(cs.player.ember).toBe(2);
    cs = startPlayerTurn(cs).state; expect(cs.player.energy).toBe(3);
    let spent = battle(['dawn_crystal']); spent.player.energy = 0;
    spent = endPlayerTurn(spent).state;
    expect(spent.player.statuses.energyNext ?? 0).toBe(0); expect(spent.player.ember).toBe(0);
  });

  it('风暴铃以每回合第一张能力为代价，全体虚弱但只易伤最低生命目标', () => {
    let cs = createCombat('storm-test', ['furnace_drone', 'furnace_drone'], 'normal', [], 30, 100, ['storm_bell'], makeRng('STORM', 'combat'), 100).state;
    cs.enemies[0].hp = 60; cs.enemies[1].hp = 40;
    expect(cs.enemies.every(e => !e.statuses.weak && !e.statuses.vulnerable)).toBe(true);
    cs = play(cs, 'war_drum', 'first-power');
    expect(cs.enemies.map(e => e.statuses.weak ?? 0)).toEqual([1, 1]);
    expect(cs.enemies.map(e => e.statuses.vulnerable ?? 0)).toEqual([0, 1]);
    cs.player.energy = 3; cs = play(cs, 'war_drum', 'second-power');
    expect(cs.enemies.map(e => e.statuses.weak ?? 0)).toEqual([1, 1]);
    expect(cs.enemies.map(e => e.statuses.vulnerable ?? 0)).toEqual([0, 1]);
  });

});
