import { describe, expect, it } from 'vitest';
import { CARDS, cardAvailableTo } from '../data/cards';
import { describeCard } from '../engine/cards';
import { createCombat, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CharacterId } from '../engine/types';
const card=(defId:string,upgraded=false,uid=defId)=>({defId,upgraded,uid});
function battle(id:string,up:boolean,ember:number){
  const cs=createCombat('conversion',['tomb_puppet'],'normal',[],50,100,[],makeRng('EMBER-CONVERT','c'),100).state;
  cs.player.hand=[card(id,up)];cs.player.energy=0;cs.player.ember=ember;
  cs.player.draw=Array.from({length:20},(_,i)=>card('strike',false,`draw-${i}`));return cs;
}
describe.each(['coal_page_search','ember_bellows'])('通用余烬转换：%s',id=>{
  it('四角色皆可获取，0费的基础与升级都消耗',()=>{
    for(const character of ['traveler','picker','oathbound','scholar'] as CharacterId[])expect(cardAvailableTo(CARDS[id],character)).toBe(true);
    expect(CARDS[id].owner).toBeUndefined();expect(CARDS[id].exhaust).toBe(true);expect(CARDS[id].cost).toBe(0);
  });
  // 两张牌都已取消上限。炭中寻页把余烬全部消耗（余数也不留）；烬炉鼓风只消耗整份，余数留存。
  const all=id==='coal_page_search';
  it.each([false,true])('升级=%s，按2余烬一份兑换，没有上限；不足2点不能打出',up=>{
    for(const ember of [0,1,2,3,5,8,9999]){
      const cs=battle(id,up,ember),earned=Math.floor(ember/2),spent=all?ember:earned*2;
      const snapshot=structuredClone(cs);
      const text=describeCard(cs.player.hand[0],{player:cs.player,target:null,relics:[],isFirstAttack:true,crescendoBonus:0});
      expect(text).toContain(`当前 ${earned}`);expect(cs).toEqual(snapshot);
      const r=playCard(cs,id,null);
      if(ember<2){expect(r.state).toBe(cs);continue;}
      expect(r.state.player.ember).toBe(ember-spent);
      expect(r.state.player.energy).toBe(all?0:earned);
      // 抽牌仍受手牌上限 10 张约束。
      expect(r.state.player.hand.length).toBe(all?Math.min(earned,10):0);
      expect(r.state.player.exhaust).toEqual([card(id,up)]);
      expect(r.events.filter(e=>e.type==='ember')).toEqual([{type:'ember',amount:-spent,total:ember-spent}]);
    }
  });
  it.each([false,true])('升级=%s，回响/重复回收不能透支余烬或重复消费',up=>{
    const cs=battle(id,up,9);cs.player.statuses.echo=1;
    const r=playCard(cs,id,null).state;
    // 本体已把能换的余烬换完，回响那次余烬不足 2 点而停止。
    expect(r.player.ember).toBe(all?0:1);expect(r.player.exhaust).toEqual([card(id,up)]);
    expect(r.player.cardsPlayedThisTurn).toBe(1);
    expect(r.player.energy).toBe(all?0:4);
    expect(r.player.hand.length).toBe(all?4:0);
    // 模拟通过付费回收再次拿到原实体：余额不足时，仍不能再次兑换。
    r.player.hand.push(r.player.exhaust.pop()!);
    expect(playCard(r,id,null).state).toBe(r);
  });
  it('实际消耗触发长明、导流与火星冠冕一次，不能重复发出状态事件',()=>{
    const cs=battle(id,false,8);cs.player.statuses={spentEmberDraw:1,emberConduit:3,sparkCrown:2};
    const r=playCard(cs,id,null);
    expect(r.state.player.block).toBe(6);
    expect(r.state.player.statuses.strength).toBe(2);expect(r.state.player.statuses.strengthDown).toBe(2);
    expect(r.state.enemies[0].statuses.burn).toBe(3);
    expect(r.events.filter(e=>e.type==='status'&&e.status==='strength')).toHaveLength(1);
    expect(r.events.filter(e=>e.type==='status'&&e.status==='burn')).toHaveLength(1);
    expect(r.state.player.hand.length).toBe(all?5:1);
    expect(r.state.player.ember).toBe(0);
    if(!all)expect(r.state.player.energy).toBe(4);
  });
});
