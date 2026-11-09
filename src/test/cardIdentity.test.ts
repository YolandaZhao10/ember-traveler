import { describe, expect, it } from 'vitest';
import { CARD_LIST } from '../data/cards';
import { viewDef, describeCard } from '../engine/cards';
import { createCombat, endPlayerTurn, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';

const card = (defId: string, upgraded = false) => ({ uid: defId, defId, upgraded });
function battle(defId: string, upgraded = false) {
  const cs = createCombat('identity', ['furnace_drone', 'furnace_drone'], 'normal', [], 50, 72, [], makeRng('IDENTITY', 'c'), 100).state;
  cs.enemies.forEach(e => { e.hp = e.maxHp = 1000; e.block = 0; e.statuses = {}; });
  cs.player.energy = 10; cs.player.ember = 3; cs.player.block = 0; cs.player.statuses = {};
  cs.player.hand = [card(defId, upgraded)];
  cs.player.draw = Array.from({ length: 20 }, (_, i) => ({ ...card('strike'), uid: `draw-${i}` }));
  return cs;
}
function play(defId: string, upgraded = false, echo = 0) {
  const cs = battle(defId, upgraded); cs.player.statuses.echo = echo;
  return playCard(cs, defId, 'e0').state;
}
const stable = (x: unknown): string => JSON.stringify(x, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);

describe('卡牌效果身份与升级边界', () => {
  it('不同卡牌的基础版/升级版不得完全同效，费用、名称、稀有度和角色不作为差异', () => {
    const mechanical = new Map<string, string>(); const descriptions = new Map<string, string>();
    for (const c of CARD_LIST) for (const up of c.type === 'curse' ? [false] : [false, true]) {
      const v = viewDef(c.id, up);
      // 保留、蓄力、消耗、余烬门槛与回合末效果会改变真实行为，属于牌的效果。
      const key = stable([v.effects, v.handEndEffects, v.target, v.exhaust, v.retain, v.charge ?? null, v.requireEmber]);
      const description = describeCard(card(c.id, up), null);
      for (const [map, signature] of [[mechanical, key], [descriptions, description]] as const) {
        const previous = map.get(signature);
        expect(!previous || previous === c.id, `${v.name} 与 ${previous} 效果重复`).toBe(true);
        map.set(signature, c.id);
      }
    }
  });
  it.each([false, true])('量步立即过牌，提灯巡守在本回合已出两张牌时为下一回合蓄能（升级=%s）', up => {
    const step = play('measured_step', up); const patrol = play('ember_patrol', up);
    expect(step.player.block).toBe(up ? 9 : 6); expect(step.player.hand).toHaveLength(1);
    expect(step.player.statuses.thorns ?? 0).toBe(0);
    expect(patrol.player.block).toBe(up ? 9 : 6); expect(patrol.player.hand).toHaveLength(0);
    expect(patrol.player.statuses.thorns ?? 0).toBe(0);
    expect(patrol.player.statuses.energyNext ?? 0).toBe(0);
    const ready = battle('ember_patrol', up); ready.player.cardsPlayedThisTurn = 2;
    expect(playCard(ready, 'ember_patrol', null).state.player.statuses.energyNext).toBe(1);
  });
  it.each([false, true])('火葬与猩红护甲有立即收益，区别于升级后的低稀有度能力（升级=%s）', up => {
    const fire = play('cremation', up); const armor = play('crimson_mail', up);
    expect(fire.enemies.map(e => e.statuses.burn)).toEqual([up ? 5 : 3, up ? 5 : 3]);
    expect(fire.player.statuses.pyre).toBe(up ? 3 : 2);
    expect(armor.player.block).toBe(up ? 12 : 8); expect(armor.player.statuses.bloodArmor).toBe(up ? 4 : 3);
    expect(play('coal_heart', true).enemies[0].statuses.burn ?? 0).toBe(0);
    expect(play('blood_watch', true).player.block).toBe(0);
  });
  it('双拳的临时力量在本次攻击后获得，后续攻击受益并在回合末移除', () => {
    let cs = play('double_punch');
    expect(cs.enemies[0].hp).toBe(992); expect(cs.player.statuses.strength).toBe(1);
    cs.player.hand.push(card('strike')); cs = playCard(cs, 'strike', 'e0').state;
    expect(cs.enemies[0].hp).toBe(985);
    expect(endPlayerTurn(cs).state.player.statuses.strength ?? 0).toBe(0);
  });
  it('符文爆发的回响条件与群体伤害真实执行，未触发时不附加', () => {
    expect(play('rune_burst').enemies.map(e => e.hp)).toEqual([992, 992]);
    const echoed = play('rune_burst', false, 1);
    // 首次有回响时8+4，重放前消耗回响，第二次只造成8。
    expect(echoed.enemies.map(e => e.hp)).toEqual([980, 980]);
  });
  it.each([false, true])('封存烈火兼有下回合能量，区别于干薪束（升级=%s）', up => {
    const result = play('sealed_flame', up);
    expect(result.player.ember).toBe(up ? 10 : 8);
    expect(result.player.statuses.energyNext).toBe(up ? 2 : 1);
    expect(result.player.exhaust.some(c => c.defId === 'sealed_flame')).toBe(true);
  });
});


describe('荆棘与盾牌的新取舍', () => {
  it.each(['mountain_splitter','line_breaker','titan_blows'])('%s先获得力量再攻击，卡面伤害与结算一致且预览不改变状态', id => {
    for (const horn of [false,true]) {
      const before = battle(id); before.player.statuses.strength = 3;
      if (horn) before.relics.push('war_horn');
      const original = JSON.stringify(before);
      const description = describeCard(card(id), {player:before.player,target:before.enemies[0],relics:before.relics,isFirstAttack:true,crescendoBonus:0});
      expect(JSON.stringify(before)).toBe(original);
      const result = playCard(before,id,id === 'line_breaker' ? null : 'e0');
      const hit = result.events.find(e => e.type === 'damage' && e.targetId === 'e0');
      expect(hit).toBeDefined();
      if (hit?.type === 'damage') expect(description).toContain(`造成 ${hit.amount} 点伤害`);
      if (id === 'mountain_splitter') expect(result.state.player.statuses.strength).toBe(horn ? 7 : 6);
    }
  });
  it.each([false,true])('刺盾姿态放大自身已有荆棘、抽牌并消耗，不再给即时格挡（升级=%s）', up => {
    const before = battle('thorn_stance',up); before.player.statuses.thorns=3;
    const after = playCard(before,'thorn_stance',null).state;
    expect(after.player.statuses.thorns).toBe((3+(up?2:1))*2); expect(after.player.block).toBe(0);
    expect(after.player.hand).toHaveLength(1); expect(after.player.exhaust.map(c=>c.defId)).toContain('thorn_stance');
    expect(describeCard(card('thorn_stance',up),null)).toContain('自身的荆棘层数翻倍');
    expect(play('thorn_mail',up).player.block).toBe(up?6:4);
    expect(play('thorn_mail',up).player.statuses.thorns).toBe(up?3:2);
  });
  it.each([false,true])('碎盾先消耗格挡再按倍数群攻；盾击保留格挡且只击中所选敌人（升级=%s）',up=>{
    const before=battle('shield_shatter',up);before.player.block=12;
    const after=playCard(before,'shield_shatter',null).state;
    expect(after.player.block).toBe(0);expect(after.enemies.map(e=>e.hp)).toEqual([1000-12*(up?3:2),1000-12*(up?3:2)]);
    expect(after.player.energy).toBe(8);expect(describeCard(card('shield_shatter',up),null)).toContain('消耗所有格挡');
    const shield=battle('shield_bash',up);shield.player.block=12;const kept=playCard(shield,'shield_bash','e0').state;
    expect(kept.player.block).toBe(up?15:12);expect(kept.enemies[1].hp).toBe(1000);
  });
  it('碎盾回响不能重复消费同一份格挡，零格挡不制造基础伤害，反伤死亡停止后续目标',()=>{
    const echoed=battle('shield_shatter');echoed.player.block=10;echoed.player.statuses.echo=1;
    expect(playCard(echoed,'shield_shatter',null).state.enemies.map(e=>e.hp)).toEqual([980,980]);
    expect(play('shield_shatter').enemies.map(e=>e.hp)).toEqual([1000,1000]);
    const lethal=battle('shield_shatter');lethal.player.hp=4;lethal.player.block=10;lethal.enemies[0].statuses.thorns=5;
    const after=playCard(lethal,'shield_shatter',null).state;
    expect(after.outcome).toBe('lost');expect(after.player.block).toBe(0);expect(after.enemies[1].hp).toBe(1000);
  });
});
