import { describe, expect, it } from 'vitest';
import { describeCard, viewCard } from '../engine/cards';
import { createCombat, endPlayerTurn, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';

const card = (defId: string, upgraded = false, uid = defId) => ({ defId, upgraded, uid });
function battle(id: string, up: boolean) {
  const cs = createCombat('blood-rework', ['tomb_puppet', 'tomb_puppet'], 'normal', [], 40, 100, [], makeRng('BLOOD-REWORK', 'c'), 100, 'oathbound').state;
  cs.player.hand = [card(id, up)];
  for (const e of cs.enemies) { e.hp = e.maxHp = 1000; e.block = 0; e.statuses = {}; }
  return cs;
}

describe.each([false, true])('回血与群攻卡牌调整，升级=%s', up => {
  it('疾风余烬改用弃牌换余烬，与拾取的抽牌用途分开', () => {
    const cs = battle('ember_gust', up);
    cs.player.hand.push(card('strike', false, 'fuel'));
    const after = playCard(cs, 'ember_gust', null).state;
    expect(after.player.ember).toBe(up ? 6 : 4);
    expect(after.player.discard.map(c => c.uid)).toEqual(['fuel']);
    expect(after.player.hand).toHaveLength(0);
    expect(after.player.exhaust).toEqual([card('ember_gust', up)]);
    expect(after.player.energy).toBe(3);
  });
  it('拾取抽1/2张并给2/3余烬；回响重复收益但本牌只消耗一次', () => {
    const cs = battle('pick_up', up); cs.player.energy = 0;
    cs.player.draw = Array.from({length: 6}, (_, i) => card('strike', false, `draw-${i}`));
    expect(describeCard(cs.player.hand[0], null)).toBe(`抽 ${up ? 2 : 1} 张牌，获得 ${up ? 3 : 2} 点余烬。消耗。`);
    const once = playCard(cs, 'pick_up', null).state;
    expect(once.player.hand).toHaveLength(up ? 2 : 1);
    expect(once.player.ember).toBe(up ? 3 : 2);
    expect(once.player.energy).toBe(0);
    cs.player.statuses.echo = 1;
    const twice = playCard(cs, 'pick_up', null).state;
    expect(twice.player.hand).toHaveLength(up ? 4 : 2);
    expect(twice.player.ember).toBe(up ? 6 : 4);
    expect(twice.player.exhaust).toEqual([card('pick_up', up)]);
    cs.player.ember = 9998;
    expect(playCard(cs, 'pick_up', null).state.player.ember).toBe(9999);
  });

  it('力量碾压兑现临时力量，保留永久力量；预览与实际伤害一致且不修改原状态', () => {
    const cs = battle('overpower', up); cs.player.statuses = { strength: 7, strengthDown: 4, weak: 1 };
    cs.enemies[0].statuses.vulnerable = 1;
    const before = structuredClone(cs);
    const damage = Math.floor(Math.floor((up ? 34 : 27) * .75) * 1.5);
    expect(describeCard(cs.player.hand[0], {player:cs.player,target:cs.enemies[0],relics:[],isFirstAttack:true,crescendoBonus:0})).toContain(`当前消耗 4 点，造成 ${damage} 点伤害`);
    expect(cs).toEqual(before);
    const after = playCard(cs, 'overpower', cs.enemies[0].id).state;
    expect(after.enemies[0].hp).toBe(1000 - damage);
    expect(after.player.statuses.strength).toBe(3);
    expect(after.player.statuses.strengthDown ?? 0).toBe(0);
    expect(endPlayerTurn(after).state.player.statuses.strength).toBe(3);
  });

  it('力量碾压回响不能重复兑现临时力量，后续借怒不能再次兑换它', () => {
    const cs = battle('overpower', up); cs.player.statuses = { strength: 7, strengthDown: 4, echo: 1 };
    cs.player.hand.push(card('borrow_fury'));
    const after = playCard(cs, 'overpower', cs.enemies[0].id).state;
    expect(after.enemies[0].hp).toBe(1000 - (up ? 34 + 14 : 27 + 11));
    expect(after.player.statuses.strength).toBe(3);
    expect(after.player.energy).toBe(2);
    expect(after.player.discard).toEqual([card('overpower', up)]);
    expect(playCard(after, 'borrow_fury', null).state.player.energy).toBe(2);
  });

  it('力量碾压不消耗永久或负力量，无效目标不花费资源', () => {
    const cs = battle('overpower', up); cs.player.statuses = { strength: 3 };
    const after = playCard(cs, 'overpower', cs.enemies[0].id).state;
    expect(after.player.statuses.strength).toBe(3);
    expect(after.enemies[0].hp).toBe(1000 - (up ? 14 : 11));
    cs.player.statuses = { strength: -2, strengthDown: 4 };
    const negative = playCard(cs, 'overpower', cs.enemies[0].id).state;
    expect(negative.player.statuses).toMatchObject({strength:-2,strengthDown:4});
    expect(negative.enemies[0].hp).toBe(1000 - (up ? 9 : 6));
    expect(playCard(cs, 'overpower', 'missing').state).toEqual(cs);
  });

  it('蓄力恢复1/2临时力量，给2/3余烬并消耗，不再治疗；回响重复收益', () => {
    const cs = battle('flex', up); cs.player.energy = 0;
    const text = describeCard(cs.player.hand[0], null);
    expect(text).not.toContain('回复'); expect(text).toContain('回合结束时失去');
    expect(text).toContain(`获得 ${up ? 3 : 2} 点余烬`);
    expect(viewCard(cs.player.hand[0]).cost).toBe(0);
    const once = playCard(cs, 'flex', null).state;
    expect(once.player.hp).toBe(40); expect(once.player.ember).toBe(up ? 3 : 2);
    expect(once.player.statuses.strength).toBe(up ? 2 : 1);
    expect(once.player.statuses.strengthDown).toBe(up ? 2 : 1);
    cs.player.statuses.echo = 1;
    const twice = playCard(cs, 'flex', null).state;
    expect(twice.player.hp).toBe(40); expect(twice.player.energy).toBe(0);
    expect(twice.player.statuses.strength).toBe(up ? 4 : 2);
    expect(twice.player.ember).toBe(up ? 6 : 4);
    expect(twice.player.exhaust).toEqual([card('flex', up)]); expect(twice.player.discard).toHaveLength(0);
    expect(endPlayerTurn(twice).state.player.statuses.strength ?? 0).toBe(0);
  });

  it('一口干粮先随机弃手牌再回复6/8，回响重复弃牌与治疗但不会弃掉自身', () => {
    const cs = battle('ration_bite', up); cs.player.energy = 0;
    cs.player.hand.push(card('strike', false, 'fuel-a'), card('defend', false, 'fuel-b'));
    const before = structuredClone(cs);
    const result = playCard(cs, 'ration_bite', null);
    expect(cs).toEqual(before);
    expect(result.state.player.hp).toBe(up ? 48 : 46);
    expect(result.state.player.discard).toHaveLength(1);
    expect(['fuel-a', 'fuel-b']).toContain(result.state.player.discard[0].uid);
    expect(result.state.player.hand).toHaveLength(1);
    expect(result.state.player.exhaust).toEqual([card('ration_bite', up)]);
    expect(playCard(cs, 'ration_bite', null).state).toEqual(result.state);
    cs.player.statuses.echo = 1;
    const twice = playCard(cs, 'ration_bite', null).state;
    expect(twice.player.hp).toBe(up ? 56 : 52);
    expect(twice.player.discard.map(c => c.uid).sort()).toEqual(['fuel-a', 'fuel-b']);
    expect(twice.player.hand).toHaveLength(0); expect(twice.player.exhaust).toHaveLength(1);
  });

  it('血怒从5×2升级为5×3群攻，攻击后才获得临时力量，保留失血代价', () => {
    const cs = battle('blood_fury', up); cs.player.statuses.strength = 2;
    const before = structuredClone(cs);
    const text = describeCard(cs.player.hand[0], { player:cs.player,target:cs.enemies[0],relics:[],isFirstAttack:true,crescendoBonus:0 });
    expect(text).toContain(`7 点伤害 × ${up ? 3 : 2}`); expect(cs).toEqual(before);
    const result = playCard(cs, 'blood_fury', null);
    const hits = result.events.filter(e => e.type === 'damage' && e.targetId !== 'player');
    expect(hits).toHaveLength((up ? 3 : 2) * 2);
    expect(hits.every(e => e.type === 'damage' && e.amount === 7)).toBe(true);
    expect(result.state.enemies.map(e => e.hp)).toEqual(up ? [979, 979] : [986, 986]);
    expect(result.state.player.hp).toBe(37); expect(result.state.player.energy).toBe(2);
    expect(result.state.player.statuses.strength).toBe(up ? 5 : 4);
    expect(endPlayerTurn(result.state).state.player.statuses.strength).toBe(2);
  });

  it('血怒回响重复完整失血和群攻流程，每次按结算时的力量打满段数', () => {
    const cs = battle('blood_fury', up); cs.player.statuses = { echo: 1, strength: 2 };
    const result = playCard(cs, 'blood_fury', null);
    const n = up ? 3 : 2, second = up ? 10 : 9;
    expect(result.state.enemies.map(e => e.hp)).toEqual([1000 - n * (7 + second), 1000 - n * (7 + second)]);
    expect(result.state.player.hp).toBe(34); expect(result.state.player.energy).toBe(2);
    expect(result.state.player.discard).toHaveLength(1); expect(result.state.player.cardsPlayedThisTurn).toBe(2);
  });

  it('撼地仍有额外力量倍率与群攻，不新增或删除敌人已有虚弱', () => {
    const cs = battle('earthbreaker', up); cs.player.statuses.strength = 2;
    cs.enemies[1].statuses.weak = 1;
    const text = describeCard(cs.player.hand[0], null);
    expect(text).not.toContain('虚弱'); expect(text).toContain('额外 +力量 × 1');
    const result = playCard(cs, 'earthbreaker', null);
    expect(result.state.enemies.map(e => e.hp)).toEqual(up ? [976, 976] : [981, 981]);
    expect(result.state.enemies[0].statuses.weak).toBeUndefined(); expect(result.state.enemies[1].statuses.weak).toBe(1);
    expect(result.events.some(e => e.type === 'status' && e.status === 'weak')).toBe(false);
    expect(result.state.player.energy).toBe(1);
  });
});
