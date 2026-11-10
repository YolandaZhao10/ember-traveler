import { describe, expect, it } from 'vitest';
import { describeCard, viewDef } from '../engine/cards';
import { createCombat, endPlayerTurn, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { BLOCK_MAX } from '../engine/constants';
import type { CardInstance } from '../engine/types';
const card = (defId: string, upgraded = false, uid = defId): CardInstance => ({ uid, defId, upgraded });
function battle(id: string, up = false) {
  const cs = createCombat('distinct', ['tomb_puppet', 'tomb_puppet'], 'normal', [], 40, 80, [], makeRng('DISTINCT-V17', 'c'), 100).state;
  cs.enemies.forEach(e => { e.hp = e.maxHp = 1000; e.block = 0; e.statuses = {}; });
  cs.player.energy = 10; cs.player.ember = 10; cs.player.statuses = {}; cs.player.block = 0;
  cs.player.hand = [card(id, up)]; cs.player.discard = []; cs.player.exhaust = [];
  cs.player.draw = Array.from({ length: 20 }, (_, i) => card('strike', false, `draw-${i}`));
  return cs;
}
function played(id: string, up = false) { return playCard(battle(id, up), id, 'e0').state; }

describe('差异化卡牌的实际取舍', () => {
  it.each([false, true])('骨灰按当前消耗区成长且无额外伤害上限，不提前计入自己（升级=%s）', up => {
    const naked = played('bone_ash', up);
    expect(1000 - naked.enemies[0].hp).toBe(up ? 25 : 18);
    const cs = battle('bone_ash', up); cs.player.exhaust = Array.from({ length: 20 }, (_, i) => card('ashes', false, `x${i}`));
    cs.player.statuses = { strength: 2, weak: 1 }; cs.enemies[0].statuses.vulnerable = 1;
    const snapshot = JSON.stringify(cs);
    const text = describeCard(cs.player.hand[0], {player:cs.player,target:cs.enemies[0],relics:[],isFirstAttack:true,crescendoBonus:0});
    const damage = Math.floor(Math.floor(((up ? 25 + 20 * 3 : 18 + 20 * 2) + 2) * .75) * 1.5);
    expect(text).toContain(`造成 ${damage} 点伤害`); expect(JSON.stringify(cs)).toBe(snapshot);
    expect(text).not.toContain('最多');
    const after = playCard(cs,'bone_ash','e0').state;
    expect(1000 - after.enemies[0].hp).toBe(damage);
    expect(after.player.exhaust).toHaveLength(21);
  });
  it.each([false, true])('骨灰回响两次按原消耗区结算，实体只在两次攻击后消耗（升级=%s）', up => {
    const cs = battle('bone_ash', up); cs.player.statuses.echo = 1;
    cs.player.exhaust = Array.from({ length: 30 }, (_, i) => card('ashes', false, `x${i}`));
    const result = playCard(cs, 'bone_ash', 'e0');
    const expected = up ? 115 : 78;
    expect(result.events.filter(e => e.type === 'damage').map(e => e.type === 'damage' ? e.amount : 0)).toEqual([expected, expected]);
    expect(result.state.player.exhaust).toHaveLength(31);
    expect(result.state.player.energy).toBe(9);
  });
  it.each([false,true])('碎骨返能和威吓斩控制需要力量达标（升级=%s）', up => {
    for (const strength of [2,3]) {
      const cs = battle('bone_crusher',up); cs.player.statuses.strength = strength;
      expect(playCard(cs,'bone_crusher','e0').state.player.energy).toBe(strength === 3 ? 9 : 8);
      const threat = battle('threatening_cut',up); threat.player.statuses.strength = strength;
      expect(playCard(threat,'threatening_cut','e0').state.enemies[0].statuses.weak ?? 0).toBe(strength === 3 ? up ? 3 : 2 : 0);
    }
  });
  it('埋灰短刃只在已有消耗后回收最高费牌，不能回收自己', () => {
    const cs = battle('buried_knife'); cs.player.exhaust = [card('defend'),card('ember_burst')];
    expect(playCard(cs,'buried_knife','e0').state.player.hand).toHaveLength(0);
    cs.player.turnFlags.exhausted = 1;
    const p = playCard(cs,'buried_knife','e0').state.player;
    expect(p.hand.map(c=>c.defId)).toEqual(['ember_burst']);
    expect(p.exhaust.map(c=>c.defId)).toEqual(['defend','buried_knife']);
  });
  it.each([false,true])('编织咒语按抽牌后手牌结算，满手封顶且接受敏捷/脆弱（升级=%s）', up => {
    const cs = battle('woven_words',up);
    expect(playCard(cs,'woven_words',null).state.player.block).toBe(up ? 6 : 4);
    cs.player.hand.push(...Array.from({length:9},(_,i)=>card('burden',false,`h${i}`)));
    cs.player.statuses = {dexterity:2,frail:1};
    const after = playCard(cs,'woven_words',null).state;
    expect(after.player.hand).toHaveLength(10); expect(after.player.block).toBe(Math.floor(((up?16:12)+2)*.75));
  });
  it.each([false, true])('烟屏燃烧转格挡无卡牌上限，只读取所选敌人的当前燃烧（升级=%s）', up => {
    for (const burn of [0, 30, 1000]) {
      const cs = battle('smoke_screen', up); cs.enemies[0].statuses.burn = burn;
      cs.enemies[0].burnApplied = 2000; cs.enemies[1].statuses.burn = 500;
      const snapshot = structuredClone(cs);
      const text = describeCard(cs.player.hand[0], { player:cs.player,target:cs.enemies[0],relics:[],isFirstAttack:false,crescendoBonus:0 });
      expect(text).not.toContain('上限'); expect(text).toContain(`当前 ${burn} 点格挡`);
      expect(cs).toEqual(snapshot);
      const after = playCard(cs,'smoke_screen','e0').state;
      expect(after.player.block).toBe((up ? 9 : 6) + burn);
      expect(after.enemies[0].statuses).toMatchObject({ burn, weak: 1 });
      expect(after.enemies[1].statuses.weak).toBeUndefined();
    }
  });
  it.each([false, true])('烟屏仍正确修正敏捷/脆弱，回响重放，角色总格挡遵循9999边界（升级=%s）', up => {
    const cs = battle('smoke_screen', up); cs.player.statuses = { dexterity: 2, frail: 1, echo: 1 };
    cs.enemies[0].statuses.burn = 40;
    const after = playCard(cs, 'smoke_screen', 'e0').state;
    expect(after.player.block).toBe((Math.floor(((up ? 9 : 6) + 2) * .75) + 31) * 2);
    expect(after.enemies[0].statuses.weak).toBe(2); expect(after.player.energy).toBe(9);
    cs.player.block = BLOCK_MAX - 1;
    const capped = playCard(cs, 'smoke_screen', 'e0').state;
    expect(capped.player.block).toBe(BLOCK_MAX); expect(capped.player.blockGainedThisTurn).toBe(1);
  });
  it('折光刃以回响放大已有易伤，鸣钟为下回合蓄能', () => {
    const cs = battle('refracted_blade'); cs.player.statuses.echo = 1; cs.enemies[0].statuses.vulnerable = 2;
    const after = playCard(cs,'refracted_blade','e0').state;
    expect(after.enemies[0].statuses.vulnerable).toBe(4); expect(after.enemies[0].hp).toBe(964);
    const bell = battle('resounding_bell'); bell.player.statuses.echo = 1;
    const ringing = playCard(bell,'resounding_bell',null).state;
    expect(ringing.player.statuses.energyNext).toBe(1); expect(ringing.enemies.map(e=>e.hp)).toEqual([968,968]);
  });
  it.each([false,true])('破碎合唱兑现易伤后移除它，重放不能重复兑现同一份层数（升级=%s）', up => {
    const cs = battle('shattered_chorus',up); cs.player.statuses.echo = 1;
    cs.enemies[0].statuses.vulnerable = 3; cs.enemies[1].statuses.vulnerable = 1;
    const after = playCard(cs,'shattered_chorus',null).state;
    const base = up ? 26 : 18, per = up ? 8 : 6;
    expect(after.enemies.map(e=>e.hp)).toEqual([1000-3*per-base*2,1000-per-base*2]);
    expect(after.enemies.every(e=>!e.statuses.vulnerable)).toBe(true);
  });
  it('破碎合唱遵守首领承伤上限，反伤死亡后停止后续目标', () => {
    const cs = battle('shattered_chorus'); cs.enemies[0].statuses.vulnerable = 4;
    cs.enemies[0].damageGuard = {limit:10,lost:0};
    expect(playCard(cs,'shattered_chorus',null).state.enemies[0].hp).toBe(990);
    cs.player.hp = 1; cs.enemies[0].statuses.thorns = 2;
    const dead = playCard(cs,'shattered_chorus',null).state;
    expect(dead.outcome).toBe('lost'); expect(dead.enemies[1].hp).toBe(1000);
  });
  it('移除易伤后的卡面伤害不再享受易伤，预览不改变战斗', () => {
    const cs = battle('shattered_chorus'); cs.enemies[0].statuses.vulnerable = 3;
    const before = JSON.stringify(cs);
    const text = describeCard(cs.player.hand[0], {player:cs.player,target:cs.enemies[0],relics:[],isFirstAttack:true,crescendoBonus:0});
    expect(text).toContain('对所有敌人造成 18 点伤害');
    expect(JSON.stringify(cs)).toBe(before);
  });
  it('灯下庇护固定支付余烬并清除减益，不再耗光余烬；归一打完弃置余下手牌', () => {
    const cs = battle('lantern_shelter'); cs.player.statuses = {weak:1,vulnerable:1,frail:1,burn:3,strength:2,strengthDown:2};
    const p = playCard(cs,'lantern_shelter',null).state.player;
    expect(p.ember).toBe(7); expect(p.block).toBe(20); expect(p.statuses).toEqual({strength:2,strengthDown:2});
    const shot = battle('singularity'); shot.player.hand.push(card('defend'),card('regret'));
    const after = playCard(shot,'singularity','e0').state;
    expect(after.enemies[0].hp).toBe(976); expect(after.player.hand).toHaveLength(0);
    expect(after.player.discard.map(c=>c.defId)).toEqual(['defend','regret','singularity']);
  });
  it('向阳而行换掉整手而非追加抽牌，余烬疗愈提供净化', () => {
    const cs = battle('sunward_step'); cs.player.hand.push(card('regret'));
    const p = playCard(cs,'sunward_step',null).state.player;
    expect(p.hand).toHaveLength(4); expect(p.discard[0].defId).toBe('regret'); expect(p.block).toBe(12);
    const mend = battle('cinder_mend'); mend.player.statuses.burn = 8;
    const cured = playCard(mend,'cinder_mend',null).state.player;
    expect(cured.hp).toBe(54); expect(cured.block).toBe(0); expect(cured.statuses.burn).toBeUndefined();
  });
  it('长明按实际消费触发，回响不双领，存档恢复保留本回合额度，下回合恢复', () => {
    let cs = battle('ember_blade'); cs.player.statuses = {spentEmberDraw:2,echo:1};
    cs = playCard(cs,'ember_blade','e0').state;
    expect(cs.player.ember).toBe(6); expect(cs.player.hand).toHaveLength(2); expect(cs.player.block).toBe(12);
    cs = JSON.parse(JSON.stringify(cs)); cs.player.hand.push(card('ember_blade',false,'second'));
    cs = playCard(cs,'second','e0').state; expect(cs.player.hand).toHaveLength(2);
    cs = startPlayerTurn(endPlayerTurn(cs).state).state; cs.player.hand = [card('ember_blade')]; cs.player.energy = 3;
    cs = playCard(cs,'ember_blade','e0').state; expect(cs.player.hand).toHaveLength(2);
  });
  it('长明不把零余烬香炉保底、冷灰惩罚或获得余烬当作花费', () => {
    const empty = battle('ash_shield'); empty.player.ember = 0; empty.player.statuses.spentEmberDraw = 1; empty.relics = ['ember_censer'];
    expect(playCard(empty,'ash_shield',null).state.player.hand).toHaveLength(0);
    const curse = battle('cold_ash'); curse.player.statuses.spentEmberDraw = 1;
    const ended = endPlayerTurn(curse).state;
    expect(ended.player.turnFlags.spentEmberDraw).toBeUndefined(); expect(ended.player.draw).toHaveLength(20);
    const stoke = battle('stoke'); stoke.player.statuses.spentEmberDraw = 1;
    expect(playCard(stoke,'stoke',null).state.player.hand).toHaveLength(0);
  });
  it('长明能力按数值叠加，能力移出牌堆且只影响实际花费', () => {
    let cs = battle('lasting_light'); cs.player.hand.push(card('lasting_light',true,'light2'),card('ash_shield'));
    cs = playCard(cs,'lasting_light',null).state; cs = playCard(cs,'light2',null).state;
    expect(cs.player.statuses.spentEmberDraw).toBe(3); expect(cs.player.exhaust).toHaveLength(0);
    cs = playCard(cs,'ash_shield',null).state; expect(cs.player.hand).toHaveLength(3);
    expect(viewDef('lasting_light').effects).not.toContainEqual(expect.objectContaining({status:'forge'}));
  });
});
