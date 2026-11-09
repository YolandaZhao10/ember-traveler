import { describe, it, expect } from 'vitest';
import { describeCard, viewCard } from '../engine/cards';
import { createCombat, playCard, endPlayerTurn, enemyAct, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CombatState } from '../engine/types';
const card=(defId:string,uid=defId,bonus=0)=>({defId,uid,upgraded:false,bonus});
function battle(ids:string[]){
 const cs=createCombat('synergy',['tomb_puppet'],'normal',[],100,100,[],makeRng('BUILD-SYNERGY','c'),100).state;
 cs.enemies[0].hp=cs.enemies[0].maxHp=10000;cs.enemies[0].statuses={};
 cs.player.hand=ids.map((id,i)=>card(id,`${id}-${i}`));cs.player.draw=Array.from({length:30},(_,i)=>card('defend',`draw-${i}`));
 return cs;
}
function use(cs:CombatState,id:string){const c=cs.player.hand.find(c=>c.defId===id)!;expect(c).toBeDefined();const next=playCard(cs,c.uid,viewCard(c).target==='enemy'?'e0':null).state;expect(next).not.toBe(cs);return next;}
function round(cs:CombatState){cs=endPlayerTurn(cs).state;cs=enemyAct(cs,'e0').state;return startPlayerTurn(cs).state;}
describe('流派按动作运转，不依靠无条件数值',()=>{
 it('连击先布战鼓、接三次攻击续费；多段只算一次，回响另算一次',()=>{
  let cs=battle(['war_drum','quick_stab','twin_blades','quick_stab','thousand_cuts']);
  cs=use(cs,'war_drum');cs=use(cs,'quick_stab');cs.player.statuses.echo=1;
  cs=use(cs,'twin_blades');expect(cs.player.attacksPlayedThisTurn).toBe(3);expect(cs.player.energy).toBe(2);
  cs=use(cs,'quick_stab');expect(cs.player.energy).toBe(2);
  const hp=cs.enemies[0].hp;cs=use(cs,'thousand_cuts');expect(hp-cs.enemies[0].hp).toBe(50);expect(cs.player.energy).toBe(0);
 });
 it('续势不在第六次攻击重复返能，叠加两张只提高第三次返能',()=>{
  let cs=battle(['war_drum','war_drum',...Array(6).fill('quick_stab')]);cs=use(use(cs,'war_drum'),'war_drum');
  for(let i=0;i<6;i++)cs=use(cs,'quick_stab');expect(cs.player.energy).toBe(3);
 });
 it('节奏达到条件会续航，但消耗后无法靠两张互抽循环',()=>{
  let cs=battle(['quick_stab','quick_stab','rhythm','rhythm']);cs=use(use(cs,'quick_stab'),'quick_stab');
  const energy=cs.player.energy;cs=use(use(cs,'rhythm'),'rhythm');expect(cs.player.energy).toBe(energy);
  expect(cs.player.exhaust.filter(c=>c.defId==='rhythm')).toHaveLength(2);
 });
 it.each([0,4,20])('架势只能保留已有格挡，余量 %s，不能凭空造盾',remaining=>{
  let cs=use(battle(['iron_will']),'iron_will');cs=endPlayerTurn(cs).state;cs=enemyAct(cs,'e0').state;cs.player.block=remaining;
  cs=startPlayerTurn(cs).state;expect(cs.player.block).toBe(Math.min(remaining,6));
  cs.player.statuses.barricade=1;cs=endPlayerTurn(cs).state;cs=enemyAct(cs,'e0').state;cs.player.block=20;cs=startPlayerTurn(cs).state;expect(cs.player.block).toBe(20);
 });
 it('选择碎盾清场会花掉防护；盾击保留格挡供敌方回合使用',()=>{
  const before=battle(['shield_bash','shield_shatter']);before.player.block=20;
  const bash=use(before,'shield_bash'),shatter=use(before,'shield_shatter');
  expect(bash.player.block).toBe(20);expect(shatter.player.block).toBe(0);
  expect(before.enemies[0].hp-shatter.enemies[0].hp).toBe(2*(before.enemies[0].hp-bash.enemies[0].hp));
 });
 it('铺火后添油翻倍并防护，引爆会花掉后续持续伤害',()=>{
  let cs=battle(['light_up','add_fuel','detonate']);cs=use(cs,'light_up');cs=use(cs,'add_fuel');
  expect(cs.enemies[0].statuses.burn).toBe(6);expect(cs.player.block).toBe(6);
  const hp=cs.enemies[0].hp;cs=use(cs,'detonate');expect(hp-cs.enemies[0].hp).toBe(18);expect(cs.enemies[0].statuses.burn??0).toBe(0);
 });
 it('灰烬盛宴前两次消耗补牌，第三次只给格挡；下一回合重新可抽',()=>{
  let cs=use(battle(['ash_feast','bone_ash','bone_ash','bone_ash']),'ash_feast');cs.player.energy=5;
  for(let i=0;i<3;i++)cs=use(cs,'bone_ash');expect(cs.player.hand).toHaveLength(2);expect(cs.player.block).toBe(12);
  cs=round(cs);cs.player.hand=[card('bone_ash')];cs=use(cs,'bone_ash');expect(cs.player.hand).toHaveLength(1);
 });
 it('两张消耗能力叠加抽牌量，但共享每回合两次窗口',()=>{
  let cs=use(use(battle(['ash_feast','ash_feast','bone_ash','bone_ash','bone_ash']),'ash_feast'),'ash_feast');cs.player.energy=5;
  for(let i=0;i<3;i++)cs=use(cs,'bone_ash');expect(cs.player.hand).toHaveLength(4);expect(cs.player.block).toBe(24);
 });
 it('血契仅在首次实际卡牌失血补牌，重复失血继续力量收益但不无限抽牌',()=>{
  let cs=use(battle(['blood_pact','blood_edge','blood_edge']),'blood_pact');cs=use(cs,'blood_edge');cs=use(cs,'blood_edge');
  expect(cs.player.hp).toBe(96);expect(cs.player.hand).toHaveLength(1);expect(cs.player.statuses.strength).toBe(2);
 });
 it.each([false,true])('灰烬再临升级=%s：先消耗再回收才给防护，与无条件回收防御牌区别',upgraded=>{
  let cs=battle(['bone_ash','ash_return']);cs.player.hand[1].upgraded=upgraded;
  cs.player.exhaust=[card('defend','old-exhaust')];
  const immediate=use(cs,'ash_return');expect(immediate.player.block).toBe(0);
  cs=use(cs,'bone_ash');cs=use(cs,'ash_return');expect(cs.player.block).toBe(upgraded?12:9);
 });
 it('致死卖血不会抽牌救活自己，战斗立即失败',()=>{
  let cs=use(battle(['blood_pact','blood_edge']),'blood_pact');cs.player.hp=2;const draw=cs.player.draw.length;
  cs=use(cs,'blood_edge');expect(cs.outcome).toBe('lost');expect(cs.player.draw).toHaveLength(draw);
 });
 it('狂力的临时力量要先打，再打多段；回合结束全部临时部分消退',()=>{
  let cs=battle(['frenzy','overpower']);cs=use(cs,'frenzy');const hp=cs.enemies[0].hp;cs=use(cs,'overpower');
  expect(hp-cs.enemies[0].hp).toBe(20);expect(endPlayerTurn(cs).state.player.statuses.strength??0).toBe(0);
 });
 it('回响先给下一张防护或爆发准备复制，能力部署不消耗回响',()=>{
  let cs=battle(['echo_card','mirror','echo_blade']);cs=use(cs,'echo_card');expect(cs.player.block).toBe(5);
  cs=use(cs,'mirror');expect(cs.player.statuses.echo).toBe(1);const hp=cs.enemies[0].hp;cs=use(cs,'echo_blade');
  expect(hp-cs.enemies[0].hp).toBe(24);expect(cs.player.cardsPlayedThisTurn).toBe(5);expect(cs.player.attacksPlayedThisTurn).toBe(3);
 });
 it('专注立即充能，凝神奖励跨回合保留；释放返能每回合只有一次',()=>{
  let cs=battle(['ward_rune','focus','charged_blade','charged_blade']);cs=use(use(cs,'ward_rune'),'focus');
  cs=round(cs);const blades=cs.player.hand.filter(c=>c.defId==='charged_blade');expect(blades.map(c=>c.bonus)).toEqual([3,3]);expect(cs.player.energy).toBe(5);
  cs=use(cs,'charged_blade');expect(cs.player.energy).toBe(5);cs=use(cs,'charged_blade');expect(cs.player.energy).toBe(4);
 });
 it.each([0,1,2,4])('迟发刺的控制需要自己的蓄力 %s，回响不能代替蓄力',bonus=>{
  let cs=battle(['delayed_thrust']);cs.player.hand[0].bonus=bonus;cs.player.statuses.echo=1;
  cs=use(cs,'delayed_thrust');expect(cs.enemies[0].statuses.vulnerable??0).toBe(bonus>=2?2:0);
  expect(describeCard(card('delayed_thrust'),null)).toContain('本牌已蓄力至少 2 层');
 });
 it('新增能力状态与当回合触发进度在序列化后保持，不能靠刷新重复返能',()=>{
  let cs=use(battle(['ward_rune','charged_blade','charged_blade']),'ward_rune');cs.player.hand.forEach(c=>c.bonus=2);
  cs=use(cs,'charged_blade');cs=JSON.parse(JSON.stringify(cs));const before=cs.player.energy;
  cs=use(cs,'charged_blade');expect(cs.player.energy).toBe(before-1);expect(cs.player.statuses.chargeMaster).toBe(1);
 });
});
