import { readFileSync, writeFileSync } from 'node:fs';
import { CARDS } from '../src/data/cards';
import { CHARACTERS } from '../src/data/characters';
import { createCombat, playCard, endPlayerTurn, enemyAct, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { planMove } from '../src/test/cardFloorBenchmark';
import type { CardDef, CombatState } from '../src/engine/types';
const arg=(key:string)=>{const i=process.argv.indexOf(key);return i<0?undefined:process.argv[i+1];};
const baseline=arg('--baseline');if(!baseline)throw new Error('需要 --baseline 旧卡表');
const old=Object.fromEntries((JSON.parse(readFileSync(baseline,'utf8')) as CardDef[]).map(c=>[c.id,c]));
const current={...CARDS};const seeds=Number(arg('--seeds')??8);
const cases:Record<string,string[]>={
 vanguard_oath:['quick_stab','twin_blades','rhythm','measured_step','brace_line','raise_shield','spin_kick'],
 long_road:['raise_shield','shield_bash','iron_will','hold_fast','riposte','brace_line','measured_step'],
 cremation:['light_up','wildfire','scorch_mark','detonate','add_fuel','heat_wave','everburning'],
 undying_furnace:['stoke','tinder_bundle','ember_exchange','charcoal_insight','white_hot','light_up','ember_burst'],
 ash_reserve:['bone_ash','burn_pages','ration_bite','salvage_scraps','buried_knife','tinder_bundle','ash_offering'],
 crimson_covenant:['blood_edge','ember_pulse','blood_rite','blood_watch','leech_bite','blood_sip','scarlet_harvest'],
 crimson_mail:['blood_edge','ember_pulse','blood_rite','blood_watch','leech_bite','blood_sip','scarlet_harvest'],
 war_avatar:['flex','frenzy','bone_crusher','double_punch','gather_fury','inflame','numb'],
 iron_blooded:['flex','frenzy','bone_crusher','double_punch','gather_fury','inflame','numb'],
 silent_prelude:['charged_blade','rune_shield','surge_glyph','focus','echo_blade','meditate','delayed_thrust'],
 living_manuscript:['double_chant','echo_blade','resonance','mirror','aria','rune_shield','finale'],
 astral_shelter:['charged_blade','rune_shield','rune_wall','surge_glyph','meditate','focus','patient_study'],
 crown_of_sparks:['stoke','ember_blade','ember_exchange','tinder_bundle','fanning_strike','twin_blades','iron_will'],
 bonfire_shelter:['stoke','tinder_bundle','ember_heart','ember_blade','shield_bash','raise_shield','ember_burst'],
};
const stages=[{id:'single',enemies:['rubble_golem'],floor:8,tier:'normal' as const},{id:'group',enemies:['ash_deacon','ash_cultist'],floor:12,tier:'normal' as const},{id:'elite',enemies:['ash_knight'],floor:12,tier:'elite' as const}];
function fight(cs:CombatState,id:string){
 const hp=cs.player.hp;let actions=0,plays=0,invalid=false;
 while(cs.outcome==='ongoing'&&cs.turn<=35&&actions++<350){
  const move=planMove(cs,{depth:3,width:3,engines:true});
  if(move){const card=cs.player.hand.find(c=>c.uid===move.uid)!;const step=playCard(cs,move.uid,move.target,move.replayUid);if(step.state===cs){invalid=true;break;}plays+=Number(card.defId===id);cs=step.state;}
  else{cs=endPlayerTurn(cs).state;for(const e of cs.enemies)cs=enemyAct(cs,e.id).state;if(cs.outcome==='ongoing')cs=startPlayerTurn(cs).state;}
  const cards=[cs.player.hand,cs.player.draw,cs.player.discard,cs.player.exhaust].flat();
  if(new Set(cards.map(c=>c.uid)).size!==cards.length||cs.player.energy<0||cs.player.ember<0||!Number.isFinite(cs.player.hp)){invalid=true;break;}
 }
 return{win:cs.outcome==='won',stalled:cs.outcome==='ongoing',invalid,plays,hpLoss:(hp-cs.player.hp)/hp,turns:cs.turn};
}
const rows=[],failures:string[]=[];
for(const [id,support] of Object.entries(cases))for(const upgraded of [false,true])for(const stage of stages){
 const character=current[id].owner??'traveler',ch=CHARACTERS[character];
 const ids=['strike','strike','defend','defend',...ch.starterDeck.slice(-2),...support,id];
 if(ids.some(id=>!current[id]||current[id].owner&&current[id].owner!==character))throw new Error('非法牌组 '+id);
 const sample=(before:boolean)=>{
  Object.assign(CARDS,before?old:current);
  const results=Array.from({length:seeds},(_,i)=>fight(createCombat(stage.id,stage.enemies,stage.tier,ids.map((defId,j)=>({defId,uid:`power-${j}`,upgraded:upgraded&&j>=6})),ch.maxHp,ch.maxHp,[ch.starterRelic],makeRng(`POWER-${i}`,'c'),100,character,encounterDifficulty(stage.floor,stage.tier)).state,id));
  return{wins:results.filter(r=>r.win).length,invalid:results.filter(r=>r.invalid).length,stalled:results.filter(r=>r.stalled).length,plays:results.reduce((s,r)=>s+r.plays,0),hpLoss:results.reduce((s,r)=>s+r.hpLoss,0)/seeds,turns:results.reduce((s,r)=>s+r.turns,0)/seeds};
 };
 const control=sample(true),candidate=sample(false);rows.push({id,upgraded,stage:stage.id,seeds,candidate,control});
 if(candidate.invalid||candidate.stalled||control.invalid||control.stalled)failures.push(`${id}/${stage.id}/${upgraded}:非法或停滞`);
 if(candidate.wins<control.wins-seeds*.25||candidate.hpLoss>control.hpLoss+.2)failures.push(`${id}/${stage.id}/${upgraded}:严重退化`);
}
Object.assign(CARDS,current);
for(const id of Object.keys(cases))if(rows.filter(r=>r.id===id).every(r=>r.candidate.plays===0))failures.push(id+':新能力未实际打出');
const result={note:'14张重做能力，配套合法支持牌，基础/升级×单体/群体/精英，每组8种子，同策略同牌序新旧对照。按单场胜率下降25个百分点/额外损血20%作严重退化护栏；仅用于部署与构筑收益检查，不是全局胜率。',fights:rows.length*seeds*2,rows,failures};
writeFileSync('docs/power-builds-v0.1.20.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({fights:result.fights,failures},null,2));if(failures.length)process.exitCode=1;
