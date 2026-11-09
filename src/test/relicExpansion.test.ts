import { describe, expect, it } from 'vitest';
import { createCombat, endPlayerTurn, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import type { CombatState } from '../engine/types';

function battle(relics: string[], ids: string[] = ['strike']) {
  const hand = ids.map((defId,i) => ({ uid: `h${i}`, defId, upgraded: false }));
  const cs = createCombat('relic', ['furnace_drone'], 'normal', hand, 60, 100, relics, makeRng('RELICS', 'c'), 100).state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 10000;
  cs.player.hand = hand; cs.player.draw = Array.from({ length: 30 }, (_, i) => ({ uid: `d${i}`, defId: 'strike', upgraded: false }));
  return cs;
}
function play(cs: CombatState, defId: string) { return playCard(cs, cs.player.hand.find(c => c.defId === defId)!.uid, 'e0').state; }
const next = (cs: CombatState) => startPlayerTurn(endPlayerTurn(cs).state).state;

describe('新增21个遗物的真实触发', () => {
  it('磨石和盾铆只在开场触发，破晓晶石需首回合节省能量并在第二回合兑现', () => {
    let cs = battle(['whetstone', 'shield_rivet', 'dawn_crystal']);
    expect(cs.player.statuses.strength).toBe(1); expect(cs.player.block).toBe(8);
    expect(cs.player.energy).toBe(3); expect(cs.player.ember).toBe(0);
    cs = next(cs); expect(cs.player.statuses.strength).toBe(1); expect(cs.player.block).toBe(0); expect(cs.player.energy).toBe(5); expect(cs.player.ember).toBe(2);
    cs = next(cs); expect(cs.player.energy).toBe(3); expect(cs.player.ember).toBe(2);
  });
  it('踏灰靴、墨井、决斗扣环按出牌次数触发，回响另计一次但首次和第N次奖励不重复', () => {
    let cs = battle(['trail_boots', 'ink_well', 'duelist_clasp'], ['quick_stab', 'quick_stab', 'defend', 'defend']);
    cs.player.statuses.echo = 1;
    cs = play(cs, 'quick_stab'); expect(cs.player.block).toBe(3);
    cs = play(cs, 'quick_stab'); expect(cs.player.block).toBe(3);
    cs = play(cs, 'defend'); expect(cs.player.block).toBe(11); expect(cs.player.ember).toBe(3);
    cs = play(cs, 'defend'); expect(cs.player.block).toBe(16); expect(cs.player.ember).toBe(3);
  });
  it('炭灰袋与灵种每回合仅第一次消耗触发，窑芯需要至少两张', () => {
    let cs = battle(['coal_pouch', 'phoenix_ash', 'kiln_spark'], ['pick_up', 'bone_ash']);
    cs = play(cs, 'pick_up'); expect(cs.player.hp).toBe(61); expect(cs.player.ember).toBe(1);
    expect(endPlayerTurn(cs).state.enemies[0].statuses.burn ?? 0).toBe(0);
    cs = play(cs, 'bone_ash'); expect(cs.player.hp).toBe(61); expect(cs.player.ember).toBe(1);
    cs = endPlayerTurn(cs).state; expect(cs.enemies[0].statuses.burn).toBe(2);
    expect(endPlayerTurn(cs).state).toBe(cs);
    cs = startPlayerTurn(cs).state; cs.player.hand.push({ uid: 'again', defId: 'pick_up', upgraded: false });
    cs = play(cs, 'pick_up'); expect(cs.player.hp).toBe(62); expect(cs.player.ember).toBe(2);
  });
  it('烟灰面罩需要存活燃烧敌人，格挡在新回合清除之后获得', () => {
    let cs = battle(['soot_mask']); expect(cs.player.block).toBe(0);
    cs.enemies[0].statuses.burn = 2; cs = next(cs); expect(cs.player.block).toBe(3);
    delete cs.enemies[0].statuses.burn; cs = next(cs); expect(cs.player.block).toBe(0);
  });
  it('血滴坠饰和伤痕腕带只对本回合第一次卡牌失血生效', () => {
    let cs = battle(['blood_pendant', 'scar_band'], ['crimson_step', 'crimson_step']);
    cs = play(cs, 'crimson_step'); expect(cs.player.draw.length).toBe(29); expect(cs.player.ember).toBe(1);
    cs = play(cs, 'crimson_step'); expect(cs.player.draw.length).toBe(29); expect(cs.player.ember).toBe(1); expect(cs.player.hp).toBe(56);
    cs = next(cs); cs.player.hand.push({ uid: 'again', defId: 'crimson_step', upgraded: false });
    const before = cs.player.draw.length; cs = play(cs, 'crimson_step'); expect(cs.player.draw.length).toBe(before - 1); expect(cs.player.ember).toBe(2);
  });
  it.each(['echo', 'mirror'] as const)('水晶风铃在%s重复效果时只触发一次', kind => {
    let cs = battle(['crystal_chime'], ['quick_stab', 'quick_stab']); cs.player.statuses[kind] = 2;
    cs = play(cs, 'quick_stab'); expect(cs.player.block).toBe(5);
    cs = play(cs, 'quick_stab'); expect(cs.player.block).toBe(5);
    cs = next(cs); cs.player.statuses[kind] = 1; cs = play(cs, 'strike'); expect(cs.player.block).toBe(5);
  });
  it('书签增加抽牌，星图只增强保留的蓄力牌，重复结束回合不重复蓄力', () => {
    let cs = battle(['bookmark', 'star_chart'], ['rune_shield', 'meditate', 'strike']);
    cs = endPlayerTurn(cs).state;
    expect(cs.player.hand.find(c => c.defId === 'rune_shield')!.bonus).toBe(2);
    expect(cs.player.hand.find(c => c.defId === 'meditate')!.bonus ?? 0).toBe(0);
    expect(endPlayerTurn(cs).state).toBe(cs);
    cs = startPlayerTurn(cs).state; expect(cs.player.hand).toHaveLength(8);
  });
  it('堡垒核心和战旗检查回合结束条件，蓄能在下回合仅兑现一次', () => {
    let cs = battle(['bastion_core', 'war_standard'], ['quick_stab', 'quick_stab', 'quick_stab']);
    cs.player.block = 15;
    for (let i = 0; i < 3; i++) cs = play(cs, 'quick_stab');
    cs = endPlayerTurn(cs).state; expect(cs.player.statuses.energyNext).toBe(1); expect(cs.player.statuses.strength).toBe(1);
    cs = startPlayerTurn(cs).state; expect(cs.player.energy).toBe(4); expect(cs.player.statuses.energyNext).toBeUndefined();
    cs = next(cs); expect(cs.player.energy).toBe(3); expect(cs.player.statuses.strength).toBe(1);
  });
  it('发条日轮每三个回合加能量和抽牌', () => {
    let cs = battle(['clockwork_sun']);
    cs = next(cs); expect(cs.player.energy).toBe(3); expect(cs.player.hand).toHaveLength(5);
    cs = next(cs); expect(cs.player.energy).toBe(4); expect(cs.player.hand).toHaveLength(6);
    cs = next(cs); expect(cs.player.energy).toBe(3); expect(cs.player.hand).toHaveLength(5);
  });
  it('行粮与印章营火收益显示值等于结算值，SL可撤销，不能重复领取', () => {
    let base = R.newRun('CAMP'); base.hp = 20; base.relics.push('ration_pack', 'pilgrim_seal');
    base.map.nodes[base.map.startIds[0]].type = 'rest'; base = R.travelTo(base, base.map.startIds[0]);
    const healed = R.restHeal(base); expect(healed.hp - base.hp).toBe(R.restHealAmount(base)); expect(healed.hp).toBe(46);
    expect(R.restHeal(healed)).toBe(healed); expect(R.resetCurrentNode(healed)).toEqual(base);
    const upgraded = R.restUpgrade(base, base.deck[0].uid); expect(upgraded.hp).toBe(25); expect(upgraded.deck[0].upgraded).toBe(true);
    expect(R.restUpgrade(upgraded, base.deck[1].uid)).toBe(upgraded); expect(R.resetCurrentNode(upgraded)).toEqual(base);
  });
  it('钱袋普通与精英奖励多5金币，领奖后SL不会累积收益', () => {
    for (const tier of ['combat', 'elite'] as const) {
      let a = R.newRun('COINS'); a.map.nodes[a.map.startIds[0]].type = tier; a = R.travelTo(a, a.map.startIds[0]);
      a.combat!.outcome = 'won'; const b = JSON.parse(JSON.stringify(a)); b.relics.push('coin_purse');
      const plain = R.finishCombat(a); const bonus = R.finishCombat(b); expect(bonus.reward!.gold).toBe(plain.reward!.gold + 5);
      const taken = R.rewardTakeGold(bonus); expect(R.rewardTakeGold(taken)).toEqual(taken); expect(R.resetCurrentNode(taken)).toEqual(bonus);
    }
  });
});
