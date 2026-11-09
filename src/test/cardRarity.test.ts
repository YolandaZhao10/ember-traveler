import { expect, it, describe } from 'vitest';
import { CARD_LIST } from '../data/cards';
import { describeCard, viewDef } from '../engine/cards';
import { canPlayCard, endPlayerTurn, playCard, startPlayerTurn } from '../engine/combat';
import { rarityFixture, rarityProbe, RARITY_CONTEXTS } from './cardRarityAudit';
import type { CombatState } from '../engine/types';
const use = (cs: CombatState) => playCard(cs, cs.player.hand[0].uid, viewDef(cs.player.hand[0].defId).target === 'enemy' ? 'e0' : null).state;
const setup = (id: string, up: boolean) => {
 const cs = rarityFixture(id, up); cs.player.ember = 8; return cs;
};
const hit = (cs: CombatState) => cs.enemies[0].hp - use(cs).enemies[0].hp;

describe('全卡表基础/升级效果审查', () => {
 it.each(CARD_LIST.map(c=>c.id))('%s：四种资源情景下可合法结算，诅咒仍不能打出，状态不变成负数或小数',id=>{
  const def=CARD_LIST.find(c=>c.id===id)!;
  for(const up of def.type==='curse'?[false]:[false,true])for(const context of RARITY_CONTEXTS){
   const before=rarityFixture(id,up,context),saved=JSON.stringify(before);
   const probe=rarityProbe(id,up,context);
   expect(probe.allowed).toBe(def.type!=='curse');
   expect(probe.played).toBe(probe.allowed);expect(probe.invalid).toBe(false);
   use(before);expect(JSON.stringify(before)).toBe(saved);
   if(viewDef(id,up).requireEmber>0){before.player.ember=0;expect(canPlayCard(before,before.player.hand[0]).ok).toBe(false);}
  }
 });
 it('五个可获得牌池保持原稀有度配额，血誓者另增一张罕见重放牌',()=>{
  for(const owner of [undefined,'traveler','picker','oathbound','scholar']) {
   const pool=CARD_LIST.filter(c=>c.owner===owner);
   expect(['common','uncommon','rare'].map(r=>pool.filter(c=>c.rarity===r).length)).toEqual([20,owner === 'oathbound' ? 19 : 18,15]);
  }
 });
});

describe.each([false,true])('稀有牌的实际费用与成型收益（升级=%s）', up=>{
 it('长夜终灯用连击换爆发，环刃用四段与蓄能区别于普通双刃',()=>{
  const last=setup('last_lantern',up);last.player.attacksPlayedThisTurn=2;
  expect(hit(last)).toBe(up?42:32);
  expect(hit(last)).toBeGreaterThan(hit(setup('twin_blades',up))*2);
  const ring=setup('encircling_blades',up);ring.player.attacksPlayedThisTurn=2;
  expect(hit(ring)).toBe(up?16:12);
  expect(use(ring).player.statuses.energyNext).toBe(up?2:1);
  ring.player.statuses.strength=3;
  expect(hit(ring)).toBe((up?16:12)+12);
 });
 it('铁壁回敬消耗两能量换双倍格挡伤害和虚弱，不能消费格挡或超过合理倍数',()=>{
  const cs=setup('iron_rebuke',up);cs.player.block=13;
  const after=use(cs);expect(after.enemies[0].hp).toBe(10000-26-(up?10:6));
  expect(after.player.block).toBe(13);expect(after.player.energy).toBe(1);
  expect(after.enemies[0].statuses.weak).toBe(up?3:2);
  expect(describeCard(cs.player.hand[0],null)).toContain('格挡 × 2');
 });
 it('送葬火炬的两费燃烧结算不低于两次同级引爆倍率，并重新点火',()=>{
  const rare=setup('funeral_pyre',up),uncommon=setup('detonate',up);
  rare.enemies[0].statuses.burn=uncommon.enemies[0].statuses.burn=6;
  const after=use(rare);expect(hit(rare)).toBeGreaterThanOrEqual(hit(uncommon)*2);
  expect(after.enemies[0].statuses.burn).toBe(up?7:5);
  expect(after.player.energy).toBe(1);
 });
 it('白热转换燃烧并返还费用，消耗后不能成为免费反复抽牌',()=>{
  const cs=setup('white_hot',up);cs.player.ember=0;cs.enemies[0].statuses.burn=20;
  const after=use(cs);expect(after.player.ember).toBe(up?14:10);
  expect(after.player.energy).toBe(3);expect(after.enemies[0].statuses.burn??0).toBe(0);
  expect(after.player.exhaust.some(c=>c.defId==='white_hot')).toBe(true);
 });
 it('血色盟约比血契更侧重重复卖血成长，不能免费获得收益',()=>{
  let cs=use(setup('crimson_covenant',up));
  expect(cs.player.statuses.strength??0).toBe(0);
  cs.player.hand=[{uid:'blood',defId:'blood_edge',upgraded:false}];
  const hp=cs.player.hp;cs=playCard(cs,'blood','e0').state;
  expect(cs.player.hp).toBe(hp-2);expect(cs.player.statuses.strength).toBe(up?3:2);
  expect(cs.player.block).toBe(up?4:3);expect(cs.player.energy).toBe(0);
 });
 it('不动阵地与战意化身具有比一费基础能力更高的反击收益',()=>{
  let guard=use(setup('steadfast_guard',up));
  expect(guard.player.statuses.thorns).toBe(up?5:4);
  guard=endPlayerTurn(guard).state;expect(guard.player.block).toBe(up?8:6);
  const avatar=use(setup('war_avatar',up));
  expect(avatar.player.statuses.strength).toBeGreaterThan(use(setup('inflame',up)).player.statuses.strength!);
  expect(avatar.player.statuses.thorns).toBe(up?5:4);
 });
 it('铁血两费部署，同时提供成长与当回合防护',()=>{
  let cs=use(setup('iron_blooded',up));expect(cs.player.energy).toBe(1);
  cs=endPlayerTurn(cs).state;expect(cs.player.block).toBe(up?7:5);
  cs=startPlayerTurn(cs).state;expect(cs.player.statuses.strength).toBe(up?2:1);
 });
 it('恒久护印给予更大的单次防护和蓄能；普通调息保持可循环优势',()=>{
  const rare=use(setup('timeless_ward',up)),common=use(setup('measured_breath',up));
  expect(rare.player.block).toBeGreaterThan(common.player.block);
  expect(rare.player.statuses.energyNext).toBeGreaterThan(common.player.statuses.energyNext!);
  expect(rare.player.exhaust.some(c=>c.defId==='timeless_ward')).toBe(true);
  expect(common.player.discard.some(c=>c.defId==='measured_breath')).toBe(true);
 });
 it('火星冠冕比火种之心更快产出余烬，并提供力量；仍需两能量部署',()=>{
  const cs=use(setup('crown_of_sparks',up));expect(cs.player.energy).toBe(1);
  expect(cs.player.statuses.emberHeart).toBeGreaterThan(use(setup('ember_heart',up)).player.statuses.emberHeart!);
  expect(cs.player.statuses.strength).toBe(up?3:2);
 });
 it('开篇和弦是一费一次部署，出牌后移除且不会触发消耗收益',()=>{
  const cs=setup('opening_chord',up);cs.player.energy=1;cs.player.statuses.ashFeast=4;
  const after=use(cs);expect(after.player.energy).toBe(0);
  expect(after.player.statuses.echo).toBe(up?3:2);expect(after.player.block).toBe(up?8:6);
  expect([...after.player.hand,...after.player.discard,...after.player.draw,...after.player.exhaust].some(c=>c.defId==='opening_chord')).toBe(false);
 });
});
