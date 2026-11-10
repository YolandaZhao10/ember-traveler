import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent, enemyIntentExtras, playCard, startPlayerTurn } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { makeRng } from '../engine/rng';
import { intentText } from '../ui/components/Common';

const cases = [
  ['twin_sentinel','guard','frail',1], ['ember_grub','wriggle','frail',1],
  ['ash_taxman','ledger','frail',2], ['slag_colossus','gather','vulnerable',2],
  ['wind_scribe','chorus','frail',1],
] as const;
function battle(id:string, hard=false) {
  return createCombat('debuff-role',[id],ENEMIES[id].tier,[],9999,9999,[],makeRng('DEBUFF-ROLES','c'),0,
    'traveler',encounterDifficulty(id==='slag_colossus'?24:4,ENEMIES[id].tier,DIFFICULTY_PRESETS[hard?2:1].settings)).state;
}
describe('单次攻击敌人的削弱整备',()=>{
  for (const hard of [false,true]) it.each(cases)(`%s/%s 预告与结算一致，不再每轮叠力量，困难=${hard}`, (id,move,status,amount)=>{
    let cs=battle(id,hard);cs.enemies[0].moveId=move;
    const intent=enemyIntent(cs,cs.enemies[0]);
    expect(intent?.kind).toBe(id==='wind_scribe'?'attack_debuff':'defend_debuff');
    if(id!=='wind_scribe')expect(intentText(intent).text).toBe('防御+削弱');
    expect(enemyIntentExtras(cs,cs.enemies[0])).toContain(`施加${status==='frail'?'脆弱':'易伤'} ${amount}`);
    const step=enemyAct(endPlayerTurn(cs).state,'e0');cs=step.state;
    expect(cs.player.statuses[status]).toBe(amount);expect(cs.enemies[0].statuses.strength??0).toBe(0);
    expect(enemyAct(cs,'e0').state).toBe(cs);
    cs=startPlayerTurn(cs).state;
    if(status==='frail') {
      cs.player.hand=[{uid:'defend',defId:'defend',upgraded:false}];
      expect(playCard(cs,'defend',null).state.player.block).toBe(3);
    }
    expect(endPlayerTurn(cs).state.player.statuses[status]??0).toBe(amount-1);
  });
  it('聚渣留出完整玩家回合，易伤在下一次重击生效，再下一轮失效',()=>{
    let cs=createCombat('colossus',['slag_colossus'],'elite',[],999,999,[],makeRng('COL','c'),0).state;
    cs.enemies[0].moveId='gather';cs=enemyAct(endPlayerTurn(cs).state,'e0').state;
    cs=startPlayerTurn(cs).state;cs.enemies[0].moveId='crush';
    expect(cs.player.statuses.vulnerable).toBe(2);expect(enemyIntent(cs,cs.enemies[0])).toMatchObject({amount:24});
    const hp=cs.player.hp;cs=enemyAct(endPlayerTurn(cs).state,'e0').state;expect(hp-cs.player.hp).toBe(24);
    cs=startPlayerTurn(cs).state;cs.enemies[0].moveId='mend';
    expect(cs.player.statuses.vulnerable).toBe(1);expect(enemyIntent(cs,cs.enemies[0])).toMatchObject({amount:6});
    cs=endPlayerTurn(cs).state;
    expect(cs.player.statuses.vulnerable??0).toBe(0);
    const before=cs.player.hp;expect(before-enemyAct(cs,'e0').state.player.hp).toBe(6);
  });
  it('困难添火侍从塞冷灰同时施加一回合脆弱，标准只塞牌',()=>{
    for(const hard of [false,true]) {
      let cs=battle('cinder_stoker',hard);cs.enemies[0].moveId='coal';cs=enemyAct(endPlayerTurn(cs).state,'e0').state;
      expect(cs.player.statuses.frail??0).toBe(hard?1:0);expect(cs.enemies[0].statuses.strength??0).toBe(0);
      expect(cs.player.discard.map(c=>c.defId)).toEqual(['cold_ash']);
    }
  });
});
