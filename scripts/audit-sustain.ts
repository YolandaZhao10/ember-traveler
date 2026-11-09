import { writeFileSync } from 'node:fs';
import { CARDS } from '../src/data/cards';
import { RELICS } from '../src/data/relics';
import { createCombat, canPlayCard, playCard, endPlayerTurn, startPlayerTurn } from '../src/engine/combat';
import { makeRng, pick } from '../src/engine/rng';
import type { CharacterId, Statuses } from '../src/engine/types';
import { playOptions } from '../src/test/playOptions';
import { probePair, resourcePairs } from '../src/test/balanceProbe';
const common=['cinder_mend','rekindle_coals','rekindle_coals','ember_exchange','coal_credit','ember_sift','traveling_supplies','stoke'];
const blood=['oath_reenactment','oath_reenactment','vein_cutter','scarlet_harvest','blood_rite','pain_trade','ember_pulse','ember_pulse','pulse_memory','borrow_fury','flex','crimson_covenant','crimson_mail'];
const ash=['ash_return','ash_return','salvage_scraps','burn_pages','ash_offering','ember_salvage','tinder_bundle','ration_bite','ash_index','borrow_flame','light_up'];
const echo=['double_chant','echo_card','grand_recitation','aria','ash_equation','charged_blade','meditate','rune_shield','echo_footnotes','release_charge'];
const traveler=['trail_supply','unburden_armor','quick_stab','twin_blades','raise_shield','shield_bash','rhythm','haste'];
const cases:{id:string;character:CharacterId;cards:string[];statuses:Statuses;relics:string[]}[]=[
 {id:'traveler',character:'traveler',cards:[...common,...traveler],statuses:{comboFlow:2,guardReserve:4,barricade:1},relics:['ember_lantern','crowned_lantern','foundry_core','clocktower_gear']},
 {id:'blood',character:'oathbound',cards:[...common,...blood],statuses:{bloodOath:3,recoveryArmor:18,bloodArmor:4,bloodRage:1,bloodDraw:2},relics:['blood_seal','crowned_lantern','foundry_core','eclipse_lens','phoenix_ash']},
 {id:'ash',character:'picker',cards:[...common,...ash],statuses:{ashFeast:6,ashInsight:2,ashRecall:12,emberHeart:2},relics:['picker_bell','crowned_lantern','foundry_core','constellation_engine','bone_urn','phoenix_ash']},
 {id:'echo',character:'scholar',cards:[...common,...echo],statuses:{resonance:1,mirror:2,repriseStudy:3,chargeMaster:2,chargedEcho:9},relics:['echo_stone','crowned_lantern','deep_archive','eclipse_lens','tuning_fork','echo_key']},
 {id:'cross-character-upper-bound',character:'oathbound',cards:[...common,...traveler,...blood,...ash,...echo],statuses:{bloodOath:3,recoveryArmor:18,bloodArmor:4,bloodDraw:3,ashInsight:2,ashRecall:12,resonance:2,mirror:2,repriseStudy:3,comboFlow:2,chargedEcho:9,chargeMaster:2},relics:['crowned_lantern','foundry_core','eclipse_lens','tuning_fork','bone_urn','echo_key','clocktower_gear','phoenix_ash']},
];
const rows=[],failures:string[]=[];let pairMax=0;
for(const [a,b] of resourcePairs()){
 const probe=probePair(a,b,100,{comboFlow:2,ashInsight:2,bloodDraw:3,chargeMaster:2,repriseStudy:3});
 pairMax=Math.max(pairMax,probe.actions);
 if(probe.invalid||probe.actions>=100)failures.push(`pair:${a.defId}/${b.defId}`);
}
for(const spec of cases)for(const upgraded of [false,true]){
 let actions=0,replays=0,maxTurnPlays=0,maxHeal=0,invalid=0,limitHits=0;
 if(spec.cards.some(id=>!CARDS[id]||spec.id!=='cross-character-upper-bound'&&CARDS[id].owner&&CARDS[id].owner!==spec.character)||spec.relics.some(id=>!RELICS[id]))throw new Error('非法压力夹具 '+spec.id);
 for(let seed=0;seed<24;seed++){
  const deck=spec.cards.map((defId,i)=>({defId,uid:`card-${i}`,upgraded}));
  let cs=createCombat('sustain-stress',['tomb_puppet'],'normal',deck,1000,10000,spec.relics,makeRng(`SUSTAIN-${seed}`,'c'),100,spec.character).state;
  Object.assign(cs.player.statuses,spec.statuses);cs.enemies[0].hp=cs.enemies[0].maxHp=1e9;cs.player.ember=10;
  const policy=makeRng(`POLICY-${seed}`,'policy');
  for(let turn=0;turn<12 && cs.outcome==='ongoing';turn++){
   let plays=0;const hp=cs.player.hp;
   while(plays<200){
    const options=cs.player.hand.filter(c=>canPlayCard(cs,c).ok).flatMap(c=>playOptions(cs,c).map(o=>({uid:c.uid,...o})));
    if(!options.length)break;
    const move=pick(policy,options),step=playCard(cs,move.uid,move.target,move.replayUid);
    if(step.state===cs){invalid++;break;}
    replays+=step.events.filter(e=>e.type==='cardPlayed'&&e.name.startsWith('血誓重演')).length;
    cs=step.state;plays++;actions++;
    const all=[cs.player.hand,cs.player.draw,cs.player.discard,cs.player.exhaust].flat();
    if(new Set(all.map(c=>c.uid)).size!==all.length||cs.player.energy<0||cs.player.ember<0||!Number.isFinite(cs.player.hp)){invalid++;break;}
   }
   maxTurnPlays=Math.max(maxTurnPlays,plays);if(plays>=200)limitHits++;
   cs=endPlayerTurn(cs).state;maxHeal=Math.max(maxHeal,cs.player.hp-hp);cs=startPlayerTurn(cs).state;
  }
 }
 rows.push({scenario:spec.id,upgraded,seeds:24,turns:12,actions,replays,maxTurnPlays,maxHeal,invalid,limitHits});
 if(invalid||limitHits)failures.push(spec.id+':invalid/limit');
}
const result={note:'已部署能力的极端资源循环压力，不是正常通关率。前四组使用各角色可获得牌；第五组刻意跨角色，属于不可自然取得的上界。24策略种子，基础/升级，各12回合；每回合200次手动操作护栏，包含弃牌选择、回响、消耗回收和实际治疗。两牌组合另枚举。未穷尽任意多牌策略。',pairs:resourcePairs().length,pairMax,rows,failures};
writeFileSync('docs/sustain-v0.1.20.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
