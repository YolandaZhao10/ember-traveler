import { readFileSync, writeFileSync } from 'node:fs';
import { CARDS } from '../src/data/cards';
import { CHARACTERS } from '../src/data/characters';
import { ENCOUNTERS } from '../src/data/enemies';
import { RELICS } from '../src/data/relics';
import { createCombat, playCard, endPlayerTurn, enemyAct, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { planMove } from '../src/test/cardFloorBenchmark';
import { BUILD_LOADOUTS } from '../src/test/buildLoadouts';
import type { CardDef, CombatState } from '../src/engine/types';
const arg=(key:string)=>{const i=process.argv.indexOf(key);return i<0?undefined:process.argv[i+1];};
const seeds=Number(arg('--seeds')??10);
if(!Number.isInteger(seeds)||seeds<1)throw new Error('invalid seeds');
if(arg('--cards'))for(const c of JSON.parse(readFileSync(arg('--cards')!,'utf8')) as CardDef[])CARDS[c.id]=c;
const early: Record<string,string[]>={
 combo:['quick_stab','twin_blades','chain_slash','spin_kick','rhythm','measured_step'],
 bulwark:['raise_shield','shield_bash','riposte','vigil','brace_line','ember_patrol'],
 cinder:['light_up','wildfire','scorch_mark','lingering_fire','tend_coals','smoke_screen'],
 ash:['bone_ash','bone_ash','sift_ash','salvage_scraps','ash_shell','buried_knife'],
 blood:['blood_edge','leech_bite','numb','crimson_step','bind_wounds','blood_insight'],
 might:['inflame','overpower','bone_crusher','double_punch','battle_breath','frenzy'],
 echo:['echo_blade','ash_word','aria','echo_veil','reverberant_cut','quiet_sentence'],
 focus:['charged_blade','focus','measured_breath','surge_glyph','delayed_thrust','patient_study'],
};
const stages=[{id:'early-single',floor:6,tier:'normal' as const,enemies:['tomb_puppet']},
 {id:'early-group',floor:8,tier:'normal' as const,enemies:['tomb_puppet','ash_rat']},
 ...['sky_boss_archon','final_boss_lord'].map(id=>{const e=ENCOUNTERS.find(e=>e.id===id)!;return{id,floor:id==='sky_boss_archon'?59:64,tier:e.tier,enemies:e.enemies};})];
function fight(cs:CombatState){
 const hp=cs.player.hp,total=cs.enemies.reduce((s,e)=>s+e.hp,0);let actions=0,invalid=false;
 while(cs.outcome==='ongoing'&&cs.turn<=50&&actions++<500){
  const move=planMove(cs,{depth:3,width:3,engines:true});
  if(move){const next=playCard(cs,move.uid,move.target,move.replayUid).state;if(next===cs){invalid=true;break;}cs=next;}
  else{cs=endPlayerTurn(cs).state;for(const e of cs.enemies)cs=enemyAct(cs,e.id).state;if(cs.outcome==='ongoing')cs=startPlayerTurn(cs).state;}
  if(!Number.isFinite(cs.player.hp)||cs.player.energy<0||cs.enemies.some(e=>e.hp<0||e.damageGuard&&e.damageGuard.lost>e.damageGuard.limit)){invalid=true;break;}
 }
 return{won:cs.outcome==='won',stalled:cs.outcome==='ongoing',invalid,turns:cs.turn,hpLoss:(hp-cs.player.hp)/hp,enemyLeft:cs.enemies.reduce((s,e)=>s+e.hp,0)/total};
}
const rows=[];
for(const build of BUILD_LOADOUTS.filter(b=>!arg('--route')||b.route===arg('--route')))for(const stage of stages){
 const ch=CHARACTERS[build.character],mature=stage.floor>20;
 const ids=['strike','strike','defend','defend',...ch.starterDeck.slice(-2),...(mature?build.cards:early[build.route])];
 const relics=[ch.starterRelic,...(mature?build.relics:[])];
 const growth=relics.reduce((n,id)=>n+(RELICS[id].journey??[]).filter(r=>r.trigger==='obtain').flatMap(r=>r.effects).reduce((a,e)=>a+(e.kind==='maxHp'?e.amount:0),0),0);
 const hp=ch.maxHp+growth;
 const deck=ids.map((defId,i)=>({uid:`build-${i}`,defId,upgraded:mature&&i>=6}));
 const results=Array.from({length:seeds},(_,seed)=>fight(createCombat(stage.id,stage.enemies,stage.tier,deck,hp,hp,relics,makeRng(`BUILD-${seed}`,'c'),100,build.character,encounterDifficulty(stage.floor,stage.tier)).state));
 const mean=(k:'hpLoss'|'enemyLeft'|'turns')=>results.reduce((s,r)=>s+r[k],0)/seeds;
 rows.push({route:build.route,stage:stage.id,seeds,wins:results.filter(r=>r.won).length,stalled:results.filter(r=>r.stalled).length,invalid:results.filter(r=>r.invalid).length,hpLoss:mean('hpLoss'),enemyLeft:mean('enemyLeft'),turns:mean('turns')});
 console.log(JSON.stringify(rows.at(-1)));
}
const output=arg('--output');if(output)writeFileSync(output,JSON.stringify({seeds,rows},null,2));
const failures=rows.filter(r=>r.stalled||r.invalid).map(r=>`${r.route}/${r.stage}:停滞或非法状态`);
if(arg('--before')){
 const before=JSON.parse(readFileSync(arg('--before')!,'utf8')).rows as typeof rows;
 for(const build of BUILD_LOADOUTS.filter(b=>!arg('--route')||b.route===arg('--route'))){
  const a=rows.filter(r=>r.route===build.route),b=before.filter(r=>r.route===build.route);
  // 胜场优先；同胜场时比较存活与剩余敌血，不能以拖长战斗伪造收益。
  const score=(rs:typeof rows)=>rs.reduce((s,r)=>s+r.wins/r.seeds*3-r.hpLoss-r.enemyLeft,0);
  if(a.filter(r=>!r.stage.startsWith('early')).every(r=>r.wins===0))failures.push(`${build.route}:成熟构筑全部压力场景零胜场`);
  const delta=score(a)-score(b);console.log(`${build.route} paired score ${delta.toFixed(3)}`);
  if(a.length!==b.length||delta< -0.05)failures.push(`${build.route}:前后配对退化 ${delta}`);
 }
}
console.log('Failures:',failures);if(failures.length)process.exitCode=1;
