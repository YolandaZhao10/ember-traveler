import { describe, expect, it } from 'vitest';
import { CARD_LIST } from '../data/cards';
import { STATUSES } from '../data/statuses';
import { describeCard, viewDef } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CombatState } from '../engine/types';
import { containsPowerCore } from './cardDesign';
const card = (defId: string, upgraded = false, uid = defId) => ({ uid, defId, upgraded });
function battle() {
 const cs = createCombat('sustain', ['tomb_puppet','tomb_puppet'], 'normal', [], 20, 200, [], makeRng('sustain','c'), 100, 'oathbound').state;
 cs.enemies.forEach(e=>{e.hp=e.maxHp=10000;e.statuses={};e.block=0;});
 cs.player.draw=Array.from({length:30},(_,i)=>card('defend',false,`draw-${i}`));
 cs.player.energy=20;return cs;
}
function use(cs: CombatState,id:string,up=false,target: string|null='e0',replay?:string) {
 cs.player.hand.push(card(id,up,`${id}-${cs.player.cardsPlayedThisTurn}`));
 return playCard(cs,cs.player.hand[cs.player.hand.length - 1].uid,target,replay).state;
}
const next = (cs:CombatState) => startPlayerTurn(endPlayerTurn(cs).state).state;

describe('重放的资源与实体边界',()=>{
 it.each([false,true])('余烬只够一次治疗时回响跳过额外收益（升级=%s）',up=>{
  let cs=battle();cs.player.statuses.echo=1;cs.player.ember=4;
  cs=use(cs,'cinder_mend',up,null);
  expect(cs.player.hp).toBe(20+(up?18:14));expect(cs.player.ember).toBe(0);
  expect(cs.player.cardsPlayedThisTurn).toBe(1);expect(cs.player.exhaust).toHaveLength(1);
  expect(cs.player.statuses.echo??0).toBe(0);
 });
 it('充足余烬允许有限的双次治疗，费用和出牌次数准确',()=>{
  let cs=battle();cs.player.statuses.echo=1;cs.player.ember=8;
  cs=use(cs,'cinder_mend',true,null);expect(cs.player.hp).toBe(56);expect(cs.player.ember).toBe(0);expect(cs.player.cardsPlayedThisTurn).toBe(2);
 });
 it('镜像额外攻击也不能透支固定余烬费用',()=>{
  let cs=battle();cs.player.statuses.mirror=2;cs.player.ember=viewDef('ember_blade').requireEmber;
  cs=use(cs,'ember_blade');expect(cs.player.attacksPlayedThisTurn).toBe(1);expect(cs.player.ember).toBe(0);
 });
 it.each(['vein_cutter','scarlet_harvest','blood_rite','cinder_mend'])('血誓重演对%s执行一次实体消耗，不能自抽或留在弃牌堆',id=>{
  let cs=battle();cs.player.draw=[];cs.player.discard=[card(id,true,'selected')];cs.player.statuses.echo=1;cs.player.ember=8;
  cs=use(cs,'oath_reenactment',true,'e0','selected');
  expect(cs.player.exhaust.filter(c=>c.uid==='selected')).toHaveLength(1);
  expect([cs.player.draw,cs.player.hand,cs.player.discard].flat().some(c=>c.uid==='selected')).toBe(false);
  expect(cs.player.exhaust).toHaveLength(2);
  const all=[cs.player.draw,cs.player.hand,cs.player.discard,cs.player.exhaust].flat();expect(new Set(all.map(c=>c.uid)).size).toBe(all.length);
 });
 it('回响猩红收割的再生总治疗有限，不能停留刷满血',()=>{
  let cs=battle();cs.enemies.forEach(e=>e.block=9999);cs.player.statuses.echo=1;cs.player.hpLostThisTurn=1;
  cs=use(cs,'scarlet_harvest',true,null);expect(cs.player.statuses.regen).toBe(6);
  const heals:number[]=[];
  for(let i=0;i<12;i++){const hp=cs.player.hp;cs=next(cs);heals.push(cs.player.hp-hp);}
  expect(heals).toEqual([6,5,4,3,2,1,0,0,0,0,0,0]);expect(cs.player.hp).toBe(41);
  expect(STATUSES.regen.description(6)).toContain('减少 1');
 });
 it('重放牌不能选择另一张重放牌；重复回收必须实际支付费用',()=>{
  let cs=battle();cs.player.hand=[card('oath_reenactment',true)];cs.player.discard=[card('oath_reenactment',true,'other')];
  expect(playCard(cs,'oath_reenactment',null,'other').state).toBe(cs);
  cs=battle();cs.player.exhaust=[card('cinder_mend',true)];cs.player.ember=6;cs.player.energy=1;
  cs=use(cs,'rekindle_coals',true,null);expect(cs.player.energy).toBe(0);expect(cs.player.ember).toBe(4);
  cs=playCard(cs,'cinder_mend',null).state;expect(cs.player.hp).toBe(38);expect(cs.player.ember).toBe(0);
  cs.player.hand.push(card('rekindle_coals',true));expect(playCard(cs,'rekindle_coals',null).state).toBe(cs);
 });
});

describe.each([false,true])('能力用途与有限资源联动（升级=%s）',up=>{
 it('血色守望失血起甲，血色盟约累计失血换能量与治疗，回血再起甲',()=>{
  let cs=use(use(use(battle(),'blood_watch',up),'crimson_covenant',up),'crimson_mail',up);cs.player.block=0;
  const energy=cs.player.energy;
  cs=use(cs,'ember_pulse');expect(cs.player.hp).toBe(18);expect(cs.player.block).toBe(up?4:3);
  cs=use(cs,'ember_pulse');expect(cs.player.hp).toBe(16+(up?3:2));expect(cs.player.energy).toBe(energy+1);
  expect(cs.player.block).toBe((up?4:3)*2+(up?3:2));
  cs=use(cs,'ember_pulse');cs=use(cs,'ember_pulse');expect(cs.player.energy).toBe(energy+1);
  expect(cs.player.hp).toBe(12+(up?3:2));
 });
 it('血色守望受到敌人攻击失血也起甲，但完全格挡不触发',()=>{
  let cs=use(battle(),'blood_watch',up);cs.enemies[0].moveId='smash';
  cs=endPlayerTurn(cs).state;const hp=cs.player.hp;cs=enemyAct(cs,'e0').state;
  expect(cs.player.hp).toBe(hp-9);expect(cs.player.block).toBe(up?4:3);
  cs=use(battle(),'blood_watch',up);cs.player.block=20;cs=endPlayerTurn(cs).state;cs=enemyAct(cs,'e0').state;
  expect(cs.player.hp).toBe(20);expect(cs.player.block).toBe(11);
 });
 it('回生甲按实际治疗计算，每回合有上限，满血和致死失血无收益',()=>{
  let cs=use(battle(),'crimson_mail',up);cs.player.block=0;
  cs=use(cs,'ration_bite',true);expect(cs.player.block).toBe(5);
  for(let i=0;i<6;i++)cs=use(cs,'ration_bite',true);
  expect(cs.player.block).toBe(up?18:12);
  cs=next(cs);cs.player.hp=cs.player.maxHp;cs=use(cs,'ration_bite',true);expect(cs.player.block).toBe(0);
  cs=use(cs,'crimson_covenant',up);cs.player.hp=2;cs=use(cs,'ember_pulse');expect(cs.player.hp).toBe(0);expect(cs.outcome).toBe('lost');
 });
 it('铁血需要临时力量与两次攻击；等待回合不会自动叠力量',()=>{
  let cs=use(battle(),'iron_blooded',up);cs=next(cs);expect(cs.player.statuses.strength??0).toBe(0);
  cs.player.energy=20;cs=use(cs,'flex',true);cs=use(cs,'strike');cs=use(cs,'strike');
  expect(cs.player.statuses.strengthDown??0).toBe(0);cs=endPlayerTurn(cs).state;expect(cs.player.statuses.strength).toBe(2);
 });
 it('战意化身仅临时力量起甲，永久力量不生效，每回合封顶',()=>{
  let cs=use(battle(),'war_avatar',up);cs=use(cs,'inflame');expect(cs.player.block).toBe(0);
  for(let i=0;i<8;i++)cs=use(cs,'flex',true);expect(cs.player.block).toBe(up?18:12);
 });
 it('先锋誓言需要攻守配对，每回合最多两对，回响同类不白送收益',()=>{
  let cs=use(battle(),'vanguard_oath',up);cs=use(cs,'strike');cs=use(cs,'strike');expect(cs.player.block).toBe(0);
  cs=use(cs,'defend');expect(cs.player.block).toBe(5+(up?6:4));expect(cs.player.turnFlags.vanguardPairs).toBe(1);
  cs=use(cs,'strike');cs=use(cs,'defend');cs=use(cs,'strike');cs=use(cs,'defend');expect(cs.player.turnFlags.vanguardPairs).toBe(2);
 });
 it('漫长守望必须留下能量，耗尽能量则没有未来收益',()=>{
  let cs=use(battle(),'long_road',up);cs.player.energy=0;cs=endPlayerTurn(cs).state;expect(cs.player.block).toBe(0);expect(cs.player.statuses.drawNext??0).toBe(0);
  cs=next(battle());cs=use(cs,'long_road',up);cs=endPlayerTurn(cs).state;expect(cs.player.block).toBe(up?11:8);expect(cs.player.statuses.drawNext).toBe(2);
 });
 it('火星冠冕需要实际花余烬，不息炉膛要求单次至少3，不能凭等待获利',()=>{
  let cs=use(use(battle(),'crown_of_sparks',up),'undying_furnace',up);cs.player.ember=8;
  cs=use(cs,'ember_sift',false,null);expect(cs.player.statuses.strength).toBe(2);expect(cs.enemies[0].statuses.burn??0).toBe(0);
  cs=use(cs,'ember_exchange',false,null);expect(cs.player.statuses.strength).toBe(2);expect(cs.enemies[0].statuses.burn).toBe(up?9:6);
  cs=endPlayerTurn(cs).state;expect(cs.player.statuses.strength??0).toBe(0);
 });
 it('灰烬储备仅第二次消耗回收一次，不能每次消耗取回自己',()=>{
  let cs=use(battle(),'ash_reserve',up);expect(cs.player.block).toBe(up?12:8);cs.player.block=0;cs=use(cs,'ration_bite');expect(cs.player.hand.some(c=>c.defId==='ration_bite')).toBe(false);
  cs=use(cs,'ember_exchange'); // 余烬不足：不会执行，不应计数。
  expect(cs.player.turnFlags.ashRecall).toBe(1);
  cs=use(cs,'ration_bite');expect(cs.player.block).toBe(up?12:8);expect(cs.player.hand.filter(c=>c.defId==='ration_bite')).toHaveLength(1);
  cs=use(cs,'ration_bite');expect(cs.player.block).toBe(up?12:8);
 });
 it('火葬死亡传播不会在同一死者上重复触发',()=>{
  let cs=use(battle(),'cremation',up);cs.enemies[0].statuses.burn=7;cs.enemies[0].hp=1;
  cs=use(cs,'strike');expect(cs.enemies[1].statuses.burn).toBe((up?21:14)+7);
  cs=use(cs,'defend',false,null);expect(cs.enemies[1].statuses.burn).toBe((up?21:14)+7);
 });
 it('寂静序曲按蓄力触发一次；活页秘典按实际回响计数，不按普通出牌计数',()=>{
  let cs=use(use(battle(),'silent_prelude',up),'living_manuscript',up);
  cs.player.hand=[{...card('charged_blade'),bonus:2}];cs=playCard(cs,'charged_blade','e0').state;
  expect(cs.player.statuses.echo).toBe(1);expect(cs.player.attacksPlayedThisTurn).toBe(1);
  cs=use(cs,'defend');expect(cs.player.turnFlags.repriseStudy).toBe(1);
  cs.player.statuses.echo=1;const energy=cs.player.energy;cs=use(cs,'defend');expect(cs.player.energy).toBe(energy);expect(cs.player.turnFlags.repriseStudy).toBe(2);
 });
 it('星界庇护用掉真实蓄力换防御；篝火避难所持续消耗燃料',()=>{
  let cs=use(battle(),'astral_shelter',up);cs.player.hand=[{...card('charged_blade'),bonus:2}];cs=endPlayerTurn(cs).state;
  expect(cs.player.block).toBe(up?9:6);expect(cs.player.statuses.thorns).toBe(1);expect(cs.player.hand[0].bonus).toBe(2);
  cs=use(battle(),'bonfire_shelter',up);cs.player.ember=5;cs=endPlayerTurn(cs).state;expect(cs.player.ember).toBe(2);expect(cs.player.block).toBe(up?24:18);
  cs=next(cs);expect(cs.player.ember).toBe(2);expect(cs.player.block).toBe(0);
 });
});

it('持续能力不能通过附赠效果或换触发时点覆盖另一张能力，含升级交叉',()=>{
 const powers=CARD_LIST.filter(c=>c.type==='power');const overlaps:string[]=[];
 for(const a of powers)for(const b of powers)if(a.id!==b.id)for(const au of [false,true])for(const bu of [false,true]){
  if(containsPowerCore(viewDef(a.id,au).effects,viewDef(b.id,bu).effects))overlaps.push(a.id+'/'+b.id);
 }
 expect(overlaps).toEqual([]);
 expect(containsPowerCore([{kind:'status',status:'demonHeart',amount:2,target:'self'}],[{kind:'status',status:'ritual',amount:3,target:'self'}])).toBe(true);
 expect(describeCard(card('crimson_covenant'),null)).not.toBe(describeCard(card('blood_watch'),null));
});

it('多张盟约叠加也不能把同一笔卖血变成净治疗，能量每回合仍只返一次',()=>{
 let cs=battle();cs.player.statuses.bloodOath=30;
 const hp=cs.player.hp,energy=cs.player.energy;
 for(let i=0;i<6;i++)cs=use(cs,'ember_pulse');
 expect(cs.player.hp).toBe(hp-8);expect(cs.player.energy).toBe(energy+1);
});
it.each(['coal_credit','ember_sift'])('%s普通转换牌无余烬不能打出，回响不能透支，打后消耗',id=>{
 let cs=battle();cs.player.hand=[card(id)];expect(playCard(cs,id,null).state).toBe(cs);
 cs.player.statuses.echo=1;cs.player.ember=2;
 cs=playCard(cs,id,null).state;expect(cs.player.ember).toBe(0);expect(cs.player.cardsPlayedThisTurn).toBe(1);expect(cs.player.exhaust.some(c=>c.defId===id)).toBe(true);
});
it.each(['ember_blade','ember_burst'])('%s的牌面伤害包含消费余烬触发的临时力量且预览不改状态',id=>{
 const cs=battle();cs.player.ember=8;cs.player.statuses.sparkCrown=4;cs.relics=['war_horn'];cs.player.hand=[card(id)];
 const before=JSON.stringify(cs),text=describeCard(cs.player.hand[0],{player:cs.player,target:cs.enemies[0],relics:cs.relics,isFirstAttack:true,crescendoBonus:0});
 expect(JSON.stringify(cs)).toBe(before);
 const result=playCard(cs,id,'e0'),damage=result.events.find(e=>e.type==='damage'&&e.targetId==='e0');
 expect(damage?.type).toBe('damage');if(damage?.type==='damage')expect(text).toContain(String(damage.amount));
});
