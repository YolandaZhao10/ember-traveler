import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { describeCard } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { conditionalDominations } from './cardDominance';
import type { CombatState } from '../engine/types';
const battle=(id:string,upgraded=false)=>{
  const cs=createCombat('conditional',['ash_knight'],'elite',[],100,100,[],makeRng('CONDITIONAL','c'),0).state;
  cs.enemies[0].hp=cs.enemies[0].maxHp=1000;cs.enemies[0].statuses={};
  cs.player.hand=[{uid:'card',defId:id,upgraded}];return cs;
};
const round=(input:CombatState)=>{let cs=endPlayerTurn(input).state;cs.enemies[0].moveId='wall';cs=enemyAct(cs,'e0').state;return startPlayerTurn(cs).state;};
describe('条件牌的用途和收益',()=>{
  it('全卡池基础/升级与普通升级对稀有基础不出现同费条件完全下位',()=>expect(conditionalDominations()).toEqual([]));
  it('确实能识别旧盾缘，而不是只对新定义返回空列表',()=>{
    const old=CARDS.shield_edge.effects;
    try { CARDS.shield_edge.effects=[{kind:'damage',amount:7},{kind:'conditional',cond:{kind:'hasBlock'},then:[{kind:'block',amount:5}]}];
      expect(conditionalDominations()).toContainEqual({weaker:'shield_edge',weakerUpgraded:false,stronger:'cross_guard',strongerUpgraded:false});
    } finally { CARDS.shield_edge.effects=old; }
  });
  it.each([false,true])('盾缘提供临时反伤，交锋提供即时防护，基础/升级=%s',up=>{
    const before=battle('shield_edge',up);before.player.block=10;
    const after=playCard(before,'card','e0').state;
    expect(after.enemies[0].hp).toBe(1000-(up?9:6));expect(after.player.block).toBe(10);expect(after.player.statuses.tempThorns).toBe(up?3:2);
    const naked=playCard(battle('shield_edge',up),'card','e0').state;expect(naked.player.statuses.tempThorns??0).toBe(0);
    const cross=playCard(battle('cross_guard',up),'card','e0').state;expect(cross.player.block).toBe(up?8:6);expect(cross.player.statuses.thorns??0).toBe(0);
    expect(describeCard(before.player.hand[0],null)).toContain('荆棘');
  });
  it.each([false,true])('临时荆棘支持本轮回响叠加，跨回合清空且不扣遗物的永久荆棘，升级=%s',up=>{
    let cs=battle('shield_edge',up);cs.player.block=30;cs.player.statuses={thorns:3,echo:1};
    cs=playCard(cs,'card','e0').state;
    expect(cs.player.statuses.tempThorns).toBe(up?6:4);expect(cs.player.statuses.thorns).toBe(3);
    cs=JSON.parse(JSON.stringify(cs));
    cs=endPlayerTurn(cs).state;cs.enemies[0].moveId='cleave';cs.enemies[0].block=0;
    const before=cs.enemies[0].hp, step=enemyAct(cs,'e0');
    expect(step.events.filter(e=>e.type==='damage'&&e.source==='thorns')).toHaveLength(1);
    expect(before-step.state.enemies[0].hp).toBe(3+(up?6:4));
    cs=startPlayerTurn(step.state).state;
    expect(cs.player.statuses.tempThorns??0).toBe(0);expect(cs.player.statuses.thorns).toBe(3);
  });
  it.each([false,true])('荆棘甲打出后消耗，洗牌不会再次抽回；回响也只移除一个实体，升级=%s',up=>{
    let cs=battle('thorn_mail',up);cs.player.statuses.echo=1;
    cs=playCard(cs,'card',null).state;
    expect(cs.player.statuses.thorns).toBe(up?6:4);expect(cs.player.exhaust.map(c=>c.uid)).toEqual(['card']);
    cs=round(cs);expect([...cs.player.hand,...cs.player.draw,...cs.player.discard]).toHaveLength(0);
    expect(describeCard({uid:'card',defId:'thorn_mail',upgraded:up},null)).toContain('消耗');
  });
  it.each([false,true])('守夜只在下回合保留剩余盾，不能凭空造盾或变成永久固守，升级=%s',up=>{
    let cs=battle('camp_guard',up);cs.player.ember=3;cs.player.block=10;
    cs=playCard(cs,'card',null).state;expect(cs.player.block).toBe(up?19:16);
    cs=round(cs);expect(cs.player.block).toBe(up?12:8);expect(cs.player.statuses.guardOnce??0).toBe(0);
    cs=round(cs);expect(cs.player.block).toBe(0);
    let spent=battle('camp_guard',up);spent.player.ember=3;spent=playCard(spent,'card',null).state;spent.player.block=0;expect(round(spent).player.block).toBe(0);
    const cold=playCard(battle('camp_guard',up),'card',null).state;expect(cold.player.statuses.guardOnce??0).toBe(0);
  });
  it('守夜与架势相加但不超过已有格挡，固守时也消耗一次性准备',()=>{
    let cs=battle('camp_guard');cs.player.ember=3;cs.player.block=20;cs.player.statuses.guardReserve=4;
    cs=round(playCard(cs,'card',null).state);expect(cs.player.block).toBe(12);expect(round(cs).player.block).toBe(4);
    cs=battle('camp_guard');cs.player.ember=3;cs.player.statuses.barricade=1;cs=round(playCard(cs,'card',null).state);
    expect(cs.player.block).toBe(6);expect(cs.player.statuses.guardOnce??0).toBe(0);
  });
  it.each([false,true])('扇火斩支付余烬换牌，回响必须再次支付；余烬不足则仅攻击，升级=%s',up=>{
    const cs=battle('fanning_strike',up);cs.player.statuses.echo=1;cs.player.ember=2;
    cs.player.hand.push({uid:'discard-me',defId:'defend',upgraded:false});cs.player.draw=Array.from({length:6},(_,i)=>({uid:`draw-${i}`,defId:'defend',upgraded:false}));
    const step=playCard(cs,'card','e0');
    expect(step.state.player.ember).toBe(0);expect(step.state.player.hand).toHaveLength(up?3:2);
    expect(step.events.filter(e=>e.type==='cardRemoved'&&e.destination==='discard')).toHaveLength(1);
    expect(step.state.enemies[0].hp).toBe(1000-2*(up?11:8));
    const cold=battle('fanning_strike',up);cold.player.ember=1;expect(playCard(cold,'card','e0').state.player.ember).toBe(1);
  });
});
