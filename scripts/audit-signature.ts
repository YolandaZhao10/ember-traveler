import { writeFileSync } from 'node:fs';
import { CHARACTERS, CHARACTER_LIST } from '../src/data/characters';
import { createCombat, playCard, endPlayerTurn, enemyAct, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { signatureCount } from '../src/engine/signature';
import { planMove } from '../src/test/cardFloorBenchmark';
import { ALL_BUILDS, BUILD_STAGES, buildScenario } from './buildScenarios';
import type { CombatState } from '../src/engine/types';

// 统计各角色每个玩家回合结束时的招牌动作计数；与 audit:builds 用同一批牌组、场景、种子和规划器。
const arg=(key:string)=>{const i=process.argv.indexOf(key);return i<0?undefined:process.argv[i+1];};
const seeds=Number(arg('--seeds')??10);
if(!Number.isInteger(seeds)||seeds<1)throw new Error('invalid seeds');
const [low,high]=[Number(arg('--min')??2),Number(arg('--max')??3)];

/** 返回每个玩家回合结束（或战斗在该回合内结束）时的计数。 */
function turnCounts(cs:CombatState){
 const counts:number[]=[];let actions=0;
 while(cs.outcome==='ongoing'&&cs.turn<=50&&actions++<500){
  const move=planMove(cs,{depth:3,width:3,engines:true});
  if(move){
   const next=playCard(cs,move.uid,move.target,move.replayUid).state;
   if(next===cs)break;
   if(next.outcome!=='ongoing')counts.push(signatureCount(next.player));
   cs=next;
  }else{
   counts.push(signatureCount(cs.player));
   cs=endPlayerTurn(cs).state;for(const e of cs.enemies)cs=enemyAct(cs,e.id).state;if(cs.outcome==='ongoing')cs=startPlayerTurn(cs).state;
  }
 }
 return counts;
}
const summarize=(counts:number[])=>{
 const n=counts.length||1,share=(min:number)=>counts.filter(c=>c>=min).length/n;
 return{turns:counts.length,mean:counts.reduce((s,c)=>s+c,0)/n,atLeast1:share(1),atLeast3:share(3),atLeast4:share(4)};
};
const rows=[];
for(const build of ALL_BUILDS.filter(b=>!arg('--route')||b.route===arg('--route'))){
 const counts:number[]=[];
 for(const stage of BUILD_STAGES){
  const scenario=buildScenario(build,stage);
  for(let seed=0;seed<seeds;seed++)counts.push(...turnCounts(createCombat(stage.id,stage.enemies,stage.tier,scenario.deck(scenario.ids),scenario.hp,scenario.hp,scenario.relics,
   makeRng(`BUILD-${seed}`,'c'),100,build.character,encounterDifficulty(stage.floor,stage.tier)).state));
 }
 rows.push({character:build.character,route:build.route,counts,...summarize(counts)});
 const r=rows.at(-1)!;
 console.log(`${build.character}/${build.route}: ${r.turns} 回合，每回合平均 ${r.mean.toFixed(2)} 次，≥1 次 ${(r.atLeast1*100).toFixed(0)}%，≥3 次 ${(r.atLeast3*100).toFixed(0)}%，≥4 次 ${(r.atLeast4*100).toFixed(0)}%`);
}
const characters=CHARACTER_LIST.filter(c=>rows.some(r=>r.character===c.id)).map(c=>{
 const all=rows.filter(r=>r.character===c.id),s=summarize(all.flatMap(r=>r.counts));
 // 各构筑等权平均，避免回合数多的构筑主导结论。
 const routeMean=all.reduce((n,r)=>n+r.mean,0)/all.length;
 return{character:c.id,name:c.name,weight:CHARACTERS[c.id].signature.weight,...s,routeMean,inTarget:routeMean>=low&&routeMean<=high};
});
console.log(`\n目标：每回合平均 ${low}～${high} 次（按构筑等权平均）`);
for(const c of characters)console.log(`${c.name}: 构筑等权 ${c.routeMean.toFixed(2)} 次，全部回合 ${c.mean.toFixed(2)} 次（${c.turns} 回合），≥3 次 ${(c.atLeast3*100).toFixed(0)}%，≥4 次 ${(c.atLeast4*100).toFixed(0)}% → ${c.inTarget?'在目标内':'偏离目标'}`);
const output=arg('--output');
if(output)writeFileSync(output,JSON.stringify({seeds,target:[low,high],characters,routes:rows.map(({counts:_counts,...r})=>r)},null,2));
// 统计脚本只汇报，是否调整权重由设计决定；仅在显式要求时把偏离当作失败。
if(process.argv.includes('--strict')&&characters.some(c=>!c.inTarget))process.exitCode=1;
