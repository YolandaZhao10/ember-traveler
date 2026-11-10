import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { ENEMIES } from '../data/enemies';
import { createCombat, endPlayerTurn, enemyAct, startPlayerTurn } from '../engine/combat';
import { generateMap } from '../engine/map';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';

const polluters = [
  ['tomb_puppet','dust','ashes'],['rust_snail','acid','slime'],
  ['furnace_drone','shell','cold_ash'],['cinder_stoker','coal','scorch'],
  ['star_pilgrim','repair','exposure'],['last_warden','sheathe','doubt'],
];
describe('章节敌人特色与精英比例', () => {
  it.each(polluters)('%s的%s实际塞入%s：不重复行动、不污染永久牌组且日志正确', (id,move,curse) => {
    let run = R.newRun('POLLUTION'); const deck = structuredClone(run.deck);
    run.combat = createCombat(id,[id],ENEMIES[id].tier,run.deck,500,500,[],makeRng('POLLUTION','combat'),run.uidCounter).state;
    run.combat.enemies[0].moveId = move;
    let cs = enemyAct(endPlayerTurn(run.combat).state,'e0').state;
    expect(cs.player.discard.filter(c=>c.defId===curse)).toHaveLength(1);
    expect(cs.log.some(l=>l.includes(`「${CARDS[curse].name}」`) && l.includes('仅本场战斗'))).toBe(true);
    expect(enemyAct(cs,'e0').state).toBe(cs);
    // 下一轮洗牌能抽到新牌，且所有卡牌 uid 唯一。
    cs.player.draw=[]; cs.player.discard=cs.player.discard.filter(c=>c.defId===curse);
    cs=startPlayerTurn(cs).state; expect(cs.player.hand.some(c=>c.defId===curse)).toBe(true);
    const cards=[...cs.player.hand,...cs.player.draw,...cs.player.discard,...cs.player.exhaust];
    expect(new Set(cards.map(c=>c.uid)).size).toBe(cards.length);
    run.combat=cs; run.combat.outcome='won'; expect(R.finishCombat(run).deck).toEqual(deck);
  });
  it.each(['ash_sovereign','bell_heart','everburning_core','eclipse_archon','nightless_lord'])('%s二阶段每四次行动至少有一次不直接攻击的整备窗口', id => {
    const cs=createCombat('cycle',[id],'boss',[],1000,1000,[],makeRng(id,'c'),0).state;
    const e=cs.enemies[0]; e.phase=2;e.flags.awakened=1;
    const moves=Array.from({length:4},(_,i)=>{e.flags.p2turn=i;return ENEMIES[id].moves.find(m=>m.id===ENEMIES[id].chooseMove({enemy:e,allies:cs.enemies,player:cs.player,rng:cs.rng}))!;});
    expect(moves.some(m=>m.actions.some(a=>a.kind==='block')&&!m.actions.some(a=>a.kind==='attack'))).toBe(true);
  });
  it('1000种子精英密度适度提高，保留前四层保护、同层上限与不连续精英', () => {
    let elite=0,total=0;
    for(let i=0;i<1000;i++) {
      const map=generateMap(makeRng(`ELITE-DENSITY-${i}`,'map')); const nodes=Object.values(map.nodes);
      for(const n of nodes) if(n.type==='elite') {
        expect(n.row).toBeGreaterThanOrEqual(4);
        expect(nodes.filter(p=>p.row===n.row&&p.type==='elite')).toHaveLength(1);
        expect(n.next.every(id=>map.nodes[id].type!=='elite')).toBe(true);
      }
      const candidates=nodes.filter(n=>n.row>=4&&n.row<18);
      elite+=candidates.filter(n=>n.type==='elite').length;total+=candidates.length;
    }
    // 节点约束后的实际比例；仍给战斗、事件和补给保留空间。
    expect(elite/total).toBeGreaterThan(.105); expect(elite/total).toBeLessThan(.125);
  });
});
