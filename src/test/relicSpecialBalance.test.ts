import { describe, expect, it } from 'vitest';
import { viewCard } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import type { CharacterId, CombatState, RunState } from '../engine/types';

const card = (defId: string, uid: string) => ({ uid, defId, upgraded: false });
function battle(relics: string[], hand = ['strike'], character: CharacterId = 'traveler', enemies = ['tomb_puppet']): CombatState {
  const deck = Array.from({ length: 40 }, (_, i) => card('strike', `deck-${i}`));
  const cs = createCombat('special-balance', enemies, 'normal', deck, 20, 100, relics, makeRng('SPECIAL-BALANCE', 'combat'), 100, character).state;
  cs.player.hand = hand.map((id, i) => card(id, `hand-${i}`));
  cs.player.draw = deck;
  cs.enemies.forEach(e => { e.hp = e.maxHp = 1000; e.block = 0; e.statuses = {}; e.moveId = 'smash'; });
  return cs;
}
const next = (cs: CombatState) => startPlayerTurn(endPlayerTurn(cs).state).state;
function use(cs: CombatState, id: string, target = 'e0') {
  const c = cs.player.hand.find(c => c.defId === id)!;
  return playCard(cs, c.uid, viewCard(c).target === 'enemy' ? target : null).state;
}
function enter(run: RunState, type: 'shop' | 'rest') {
  const id = run.map.startIds[0]; run.map.nodes[id].type = type; return R.travelTo(run, id);
}

describe('问号遗物的收益上限和独立用途', () => {
  it('许愿余烬的四回合免费治疗不超过4，开场余烬不超过3', () => {
    let cs = battle(['wishing_cinder']);
    expect(cs.player.ember).toBeLessThanOrEqual(3);
    const initialHp = cs.player.hp;
    for (let turn = 0; turn < 4; turn++) cs = next(cs);
    expect(cs.player.hp - initialHp).toBe(4);
  });

  it('镜中残影在首回合结束才准备回响，不放大第一张攻击且不重复赠送', () => {
    let cs = battle(['mirror_shard']);
    expect(cs.player.statuses.echo ?? 0).toBe(0);
    expect(cs.player.block).toBe(0);
    cs = use(cs, 'strike');
    expect(cs.enemies[0].hp).toBe(994);
    cs = endPlayerTurn(cs).state;
    expect(cs.player.statuses.echo).toBe(1);
    expect(cs.player.block).toBe(6);
    expect(endPlayerTurn(cs).state).toBe(cs);
    cs = startPlayerTurn(cs).state;
    cs = use(cs, 'strike');
    expect(cs.enemies[0].hp).toBe(982);
    cs = endPlayerTurn(cs).state;
    expect(cs.player.statuses.echo ?? 0).toBe(0);
    expect(cs.player.block).toBe(0);
  });

  it('遗失的一刻只在第二回合提供一份额外能量和抽牌，不形成永久加能', () => {
    let cs = battle(['lost_hour']);
    expect(cs.player.energy).toBe(3);
    cs = next(cs);
    expect(cs.player.energy).toBe(4);
    expect(cs.player.hand).toHaveLength(6);
    cs = next(cs);
    expect(cs.player.energy).toBe(3);
    expect(cs.player.hand).toHaveLength(5);
  });

  it('无字残页三技能只为下一回合蓄能，本回合不会返能接回收循环', () => {
    let cs = battle(['unwritten_page'], ['defend', 'defend', 'defend']);
    for (let i = 0; i < 3; i++) cs = use(cs, 'defend');
    expect(cs.player.energy).toBe(0);
    expect(cs.player.statuses.energyNext).toBe(1);
    expect(cs.player.hand).toHaveLength(1);
    cs = next(cs);
    expect(cs.player.energy).toBe(4);
    expect(cs.player.statuses.energyNext ?? 0).toBe(0);
    cs = next(cs);
    expect(cs.player.energy).toBe(3);
  });

  it('琥珀泪的最大生命与第三回合应急回血不同于即时生命包', () => {
    const run = R.newRun('AMBER-TEAR'); run.hp = 20;
    R.addRelic(run, 'sealed_tear');
    expect(run.maxHp).toBe(82);
    expect(run.hp).toBe(20);
    const once = structuredClone(run); R.addRelic(run, 'sealed_tear'); expect(run).toEqual(once);
    let low = battle(['sealed_tear']);
    low = next(low); expect(low.player.hp).toBe(20);
    low = next(low); expect(low.player.hp).toBe(25);
    low = next(low); expect(low.player.hp).toBe(25);
    let healthy = battle(['sealed_tear']); healthy.player.hp = 60;
    healthy = next(next(healthy)); expect(healthy.player.hp).toBe(60);
  });

  it('失传摇篮曲在首个击杀时补牌回血，同回合再次击杀不追加收益', () => {
    let cs = battle(['forgotten_lullaby'], ['quick_stab', 'quick_stab'], 'traveler', ['ash_rat', 'ash_rat', 'ash_rat']);
    cs.enemies[0].hp = cs.enemies[1].hp = 1;
    const drawCount = cs.player.draw.length;
    cs = use(cs, 'quick_stab');
    expect(cs.player.hp).toBe(22); expect(cs.player.draw).toHaveLength(drawCount - 1);
    cs = use(cs, 'quick_stab', 'e1');
    expect(cs.player.hp).toBe(22); expect(cs.player.draw).toHaveLength(drawCount - 1);
    expect(cs.outcome).toBe('ongoing');
  });

  it('裂隙灯用余烬维持防守，不再是环火仪的燃烧加强版', () => {
    const cs = battle(['rift_lantern']); cs.player.ember = 4;
    const inactive = endPlayerTurn(cs).state;
    expect(inactive.player.block).toBe(0); expect(inactive.enemies[0].statuses.weak ?? 0).toBe(0);
    cs.player.ember = 5;
    const control = structuredClone(cs); control.relics = [];
    const active = endPlayerTurn(cs).state;
    expect(active.player.ember).toBe(5);
    expect(active.player.block).toBe(4);
    expect(active.enemies[0].statuses.weak).toBe(1);
    expect(active.enemies[0].statuses.burn ?? 0).toBe(0);
    const attacked = enemyAct(active, 'e0').state;
    const unprotected = enemyAct(endPlayerTurn(control).state, 'e0').state;
    expect(attacked.player.hp - unprotected.player.hp).toBeGreaterThan(4);
  });

  it('赤色卜石不能抵消血刃的自损代价，三次自损只返1生命和1牌', () => {
    let cs = battle(['red_oracle'], ['blood_edge', 'blood_edge', 'blood_edge'], 'oathbound');
    const drawCount = cs.player.draw.length;
    cs = use(cs, 'blood_edge'); expect(cs.player.hp).toBe(18);
    cs = use(cs, 'blood_edge'); expect(cs.player.hp).toBe(17);
    cs = use(cs, 'blood_edge'); expect(cs.player.hp).toBe(15);
    expect(cs.player.draw).toHaveLength(drawCount - 1);
  });
});

describe('商店专属的长期收益与操作边界', () => {
  it('休息与锻造保持不同用途，二者成长收益不能叠在同一个营火', () => {
    const base = R.newRun('SHOP-CAMP-BOUND'); base.hp = 20; base.gold = 1000;
    base.relics = ['smith_contract', 'caravan_hearth', 'forge_savings'];
    const camp = enter(base, 'rest');
    const rest = R.restHeal(camp);
    expect(rest.maxHp - camp.maxHp).toBe(1);
    expect(rest.gold - camp.gold).toBe(30);
    expect(rest.hp - camp.hp).toBe(Math.floor(camp.maxHp * 0.3));
    expect(R.restUpgrade(rest, rest.deck[0].uid)).toBe(rest);
    const upgrade = R.restUpgrade(camp, camp.deck[0].uid);
    expect(upgrade.maxHp - camp.maxHp).toBe(1);
    expect(upgrade.gold - camp.gold).toBe(16);
    expect(upgrade.hp - camp.hp).toBe(6);
    expect(R.restHeal(upgrade)).toBe(upgrade);
    expect(R.resetCurrentNode(upgrade)).toEqual(camp);
  });

  it('暖茶减少交易回血，净灰火盆保留付费删牌成长且同店只触发一次', () => {
    const base = R.newRun('SHOP-TRADE-BOUND'); base.hp = 20; base.gold = 1000;
    base.relics = ['merchant_tea', 'purifying_brazier'];
    const shop = enter(base, 'shop');
    const bought = R.shopBuyCard(shop, 0);
    expect(bought.hp - shop.hp).toBe(4);
    expect(bought.gold).toBe(shop.gold - shop.shop!.cards[0].price);
    expect(R.shopBuyCard(bought, 0)).toBe(bought);
    const removed = R.shopRemoveCard(shop, shop.deck[0].uid);
    expect(removed.maxHp - shop.maxHp).toBe(2);
    expect(removed.hp - shop.hp).toBe(6);
    expect(removed.gold).toBe(shop.gold - shop.shop!.removePrice);
    expect(R.shopRemoveCard(removed, removed.deck[0].uid)).toBe(removed);
  });
});
