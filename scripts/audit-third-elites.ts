import { writeFileSync, readFileSync } from 'node:fs';
import { CHARACTERS } from '../src/data/characters';
import { CARDS } from '../src/data/cards';
import { ENCOUNTERS, ENEMIES } from '../src/data/enemies';
import { RELICS } from '../src/data/relics';
import { viewCard } from '../src/engine/cards';
import { aliveEnemies, canPlayCard, playCard, createCombat, endPlayerTurn, enemyAct, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { incomingDamage, cardValue } from '../src/test/balanceBot';
import type { CharacterId, CombatState } from '../src/engine/types';

// 固定第三章构筑作配对压力测试，不是随机整局或真人胜率。双方牌组/随机序列完全相同。
const loadouts: { route: string; character: CharacterId; cards: string[]; relics: string[] }[] = [
 { route:'combo', character:'traveler', cards:['quick_stab','twin_blades','chain_slash','spin_kick','rhythm','haste','thousand_cuts','tempo','war_drum','trip','quick_stab','iron_will'], relics:['clocktower_gear','furnace_crown','flint','metronome','trail_boots','drummer_heart'] },
 { route:'bulwark', character:'traveler', cards:['raise_shield','shield_bash','thorn_mail','iron_wall','riposte','hold_fast','iron_will','shield_shatter','vigil','bulwark_counter','raise_shield','shield_bash'], relics:['gatekeeper_aegis','molten_sigil','rusted_plate','thorn_crown','shield_rivet','anvil_shard'] },
 { route:'cinder', character:'picker', cards:['light_up','wildfire','scorch_mark','detonate','add_fuel','lingering_fire','heat_wave','cremation','everburning','ember_tongue','lingering_fire','ash_shield'], relics:['royal_ash_crown','deep_archive','tinderbox','soot_mask','ash_compass','rune_stone'] },
 { route:'ash', character:'picker', cards:['burn_pages','bone_ash','ash_feast','pass_the_flame','burn_it_all','ash_return','dust_to_dust','ash_offering','bone_ash','ash_return','stoke','ember_burst'], relics:['crowned_lantern','foundry_core','bone_urn','coal_pouch','kiln_spark','phoenix_ash'] },
 { route:'blood', character:'oathbound', cards:['blood_edge','blood_rite','leech_bite','blood_pact','martyr','numb','crimson_mail','sanguine','eye_for_eye','leech_bite','blood_rite','inflame'], relics:['belltower_pendulum','furnace_crown','iron_skull','blood_pendant','scar_band','war_horn'] },
 { route:'might', character:'oathbound', cards:['flex','inflame','bone_crusher','overpower','frenzy','demon_heart','heavy_blow','intimidate','blood_fury','overpower','leech_bite','numb'], relics:['sovereign_sigil','furnace_crown','war_horn','whetstone','war_standard','rune_stone'] },
 { route:'echo', character:'scholar', cards:['double_chant','echo_blade','resonance','mirror','ash_word','aria','rune_burst','finale','rune_shield','rune_wall','erudition','echo_blade'], relics:['crowned_lantern','deep_archive','old_tome','tuning_fork','ink_well','crystal_chime'] },
 { route:'focus', character:'scholar', cards:['rune_shield','focus','rune_wall','charged_blade','meditate','erudition','ward_rune','ash_equation','charged_blade','rune_shield','stoke','ember_burst'], relics:['gatekeeper_aegis','deep_archive','lens','bookmark','star_chart','ink_well'] },
];
const arg = (key: string) => { const i=process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i+1]; };
const enemyModule = arg('--enemy-module');
if (enemyModule) {
 const legacy = await import(enemyModule) as { CHAPTER_THREE_ENEMIES: typeof ENEMIES[string][] };
 for (const enemy of legacy.CHAPTER_THREE_ENEMIES) ENEMIES[enemy.id] = enemy;
}
const seeds = Number(arg('--seeds') ?? 20);
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('invalid seeds');
const encounters = ENCOUNTERS.filter(e=>['sky_elite_duelist','sky_elite_keeper','sky_elite_titan','sky_sentinel_scribe','sky_hound_mirror','sky_scribe_swarm'].includes(e.id));
function fight(cs: CombatState) {
 const startingHp=cs.player.hp; let actions=0, cardsPlayed=0, invalid=false, damageTaken=0;
 while(cs.outcome==='ongoing' && cs.turn<=60 && actions++<1000) {
  const opts=cs.player.hand.filter(c=>canPlayCard(cs,c).ok).map(c=>({c,s:cardValue(cs,c,incomingDamage(cs)-cs.player.block)})).sort((a,b)=>b.s-a.s);
  const beforeHp=cs.player.hp;
  if(opts[0]?.s>0.5) {
   const c=opts[0].c, target=viewCard(c).target==='enemy'?aliveEnemies(cs).sort((a,b)=>a.hp-b.hp)[0].id:null;
   const next=playCard(cs,c.uid,target).state;
   if(next===cs) {invalid=true;break;} cs=next;cardsPlayed++;
  } else {
   cs=endPlayerTurn(cs).state;
   for(const e of cs.enemies) {if(cs.outcome!=='ongoing')break;cs=enemyAct(cs,e.id).state;}
   if(cs.outcome==='ongoing')cs=startPlayerTurn(cs).state;
  }
  damageTaken+=Math.max(0,beforeHp-cs.player.hp);
  if(!Number.isFinite(cs.player.hp)||!Number.isFinite(cs.player.energy)||cs.player.energy<0) {invalid=true;break;}
 }
 return {won:cs.outcome==='won',stalled:cs.outcome==='ongoing',invalid,hpLost:startingHp-cs.player.hp,hpLossRatio:(startingHp-cs.player.hp)/startingHp,damageTaken,turns:cs.turn,cardsPlayed,enemyHpLeft:cs.enemies.reduce((s,e)=>s+e.hp,0)};
}
const rows=[];
for (const localFloor of [5,12,18]) for(const encounter of encounters) for(const spec of loadouts) {
 const ch=CHARACTERS[spec.character], relics=[ch.starterRelic,...spec.relics];
 for(const id of spec.cards) if(!CARDS[id] || CARDS[id].owner && CARDS[id].owner!==spec.character)throw new Error(`Invalid card ${spec.route}/${id}`);
 for(const id of relics) if(!RELICS[id])throw new Error(`Invalid relic ${id}`);
 const growth=spec.relics.reduce((n,id)=>n+(RELICS[id].journey??[]).filter(r=>r.trigger==='obtain').flatMap(r=>r.effects).reduce((a,e)=>a+(e.kind==='maxHp'?e.amount:0),0),0);
 const hp=ch.maxHp+growth;
 const ids=['strike','strike','defend','defend',...ch.starterDeck.slice(-2),...spec.cards];
 const deck=ids.map((defId,i)=>({defId,uid:`bench-${i}`,upgraded:i>=6 && i<14}));
 const results=Array.from({length:seeds},(_,seed)=>fight(createCombat(encounter.id,encounter.enemies,encounter.tier,deck,hp,hp,relics,makeRng(`THIRD-ELITE-${seed}`,'c'),100,spec.character,encounterDifficulty(40+localFloor-1,encounter.tier)).state));
 const mean=(key:'hpLost'|'hpLossRatio'|'damageTaken'|'turns'|'enemyHpLeft'|'cardsPlayed')=>results.reduce((n,r)=>n+r[key],0)/seeds;
 rows.push({encounter:encounter.id,route:spec.route,character:spec.character,localFloor,hp,seeds,wins:results.filter(r=>r.won).length,stalled:results.filter(r=>r.stalled).length,invalid:results.filter(r=>r.invalid).length,hpLost:mean('hpLost'),hpLossRatio:mean('hpLossRatio'),damageTaken:mean('damageTaken'),turns:mean('turns'),enemyHpLeft:mean('enemyHpLeft'),cardsPlayed:mean('cardsPlayed')});
}
const pressure=[];
for(const localFloor of [5,12,18]) for(const enc of encounters) {
 let totalDamage=0,peak=0,totalHp=0;
 for(let seed=0;seed<seeds;seed++) {
  let cs=createCombat(enc.id,enc.enemies,enc.tier,[],10000,10000,[],makeRng(`PRESSURE-${seed}`,'c'),100,'traveler',encounterDifficulty(40+localFloor-1,enc.tier)).state;
  totalHp+=cs.enemies.reduce((sum,e)=>sum+e.hp,0);
  for(let turn=0;turn<9;turn++) {const hp=cs.player.hp;cs=endPlayerTurn(cs).state;for(const e of cs.enemies)cs=enemyAct(cs,e.id).state;peak=Math.max(peak,hp-cs.player.hp);cs=startPlayerTurn(cs).state;}
  totalDamage+=10000-cs.player.hp;
 }
 pressure.push({encounter:enc.id,localFloor,hp:totalHp/seeds,damage9:totalDamage/seeds,peak});
}
const aggregate=encounters.map(enc=>{const set=rows.filter(r=>r.encounter===enc.id);return {encounter:enc.id,wins:set.reduce((s,r)=>s+r.wins,0),fights:set.length*seeds,hpLost:set.reduce((s,r)=>s+r.hpLost,0)/set.length,turns:set.reduce((s,r)=>s+r.turns,0)/set.length,stalled:set.reduce((s,r)=>s+r.stalled,0),invalid:set.reduce((s,r)=>s+r.invalid,0)};});
const result={note:'固定18张牌（6初始+12路线），8张升级；初始遗物+2前章遗物+4普通来源遗物，生命仅计初始和遗物获得成长。每场满血，标准难度，3精英与3普通组合同种子配对。使用既有启发式机器人；不代表真人或随机整局胜率。',seeds,loadouts,aggregate,pressure,rows};
const output=arg('--output');if(output)writeFileSync(output,JSON.stringify(result,null,2));
const beforePath=arg('--before');
if(beforePath) {const before=JSON.parse(readFileSync(beforePath,'utf8')) as typeof result;console.log(JSON.stringify({before:before.aggregate,after:aggregate,pressureBefore:before.pressure,pressureAfter:pressure},null,2));}
else console.log(JSON.stringify({aggregate,pressure},null,2));
if(rows.some(r=>r.invalid||r.stalled))process.exitCode=1;
