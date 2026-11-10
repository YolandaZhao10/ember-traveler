import { readFileSync, writeFileSync } from 'node:fs';
import { CARD_LIST, CARDS } from '../src/data/cards';
import { CHARACTERS } from '../src/data/characters';
import { describeCard } from '../src/engine/cards';
import { createCombat, playCard, endPlayerTurn, enemyAct, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { planMove } from '../src/test/cardFloorBenchmark';
import { probeEveryCard } from '../src/test/cardRarityAudit';
import type { CardDef, CombatState } from '../src/engine/types';
const arg = (key: string) => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1]; };
if (arg('--cards')) for (const c of JSON.parse(readFileSync(arg('--cards')!, 'utf8')) as CardDef[]) CARDS[c.id] = c;
const elite = process.argv.includes('--elite');
const seeds = Number(arg('--seeds') ?? 2);
const seedOffset = Number(arg('--seed-offset') ?? 0);
if (!Number.isInteger(seedOffset) || seedOffset < 0) throw new Error('invalid seed offset');
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('seeds must be positive');
const supports: Record<string, string[]> = {
 combo: ['quick_stab','twin_blades','chain_slash','haste','tempo','raise_shield'],
 bulwark: ['raise_shield','raise_shield','iron_will','shield_bash','thorn_mail','stoke'],
 cinder: ['light_up','lingering_fire','wildfire','tend_coals','coal_heart','stoke'],
 ash: ['burn_pages','bone_ash','ash_feast','ash_return','stoke','ash_shell'],
 blood: ['blood_edge','blood_rite','leech_bite','blood_pact','numb','inflame'],
 might: ['inflame','overpower','frenzy','double_punch','leech_bite','numb'],
 echo: ['echo_card','echo_blade','mirror','aria','echo_veil','measured_breath'],
 focus: ['focus','charged_blade','rune_shield','ward_rune','meditate','stoke'],
 ember: ['stoke','stoke','kindle','ember_heart','ember_blade','ash_shield'],
 basic: ['stoke','stoke','kindle','ember_heart','ember_blade','ash_shield'],
};
function fight(cs: CombatState) {
 const startHp = cs.player.hp; let actions = 0, plays = 0, invalid = false;
 while (cs.outcome === 'ongoing' && cs.turn <= 50 && actions++ < 500) {
  const move = planMove(cs, { depth: 3, width: 3, engines: true });
  if (move) {
   if (move.uid.startsWith('candidate')) plays++;
   const next = playCard(cs, move.uid, move.target, move.replayUid).state;
   if (next === cs) { invalid = true; break; } cs = next;
  } else {
   cs = endPlayerTurn(cs).state;
   for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
   if (cs.outcome === 'ongoing') cs = startPlayerTurn(cs).state;
  }
  if (![cs.player.hp, cs.player.energy, ...cs.enemies.map(e => e.hp)].every(n => Number.isFinite(n) && n >= 0)) { invalid = true; break; }
 }
 return { won: cs.outcome === 'won', stalled: cs.outcome === 'ongoing', invalid, hpLoss: startHp - cs.player.hp, turns: cs.turn, plays };
}
const probes = probeEveryCard();
const failures = probes.filter(p => p.invalid || p.allowed !== p.played).map(p => `${p.id}/${p.upgraded}/${p.context}: effect probe`);
const rows = [];
if (!process.argv.includes('--probes-only')) for (const def of CARD_LIST.filter(c => c.cost >= 0 && c.type !== 'status' && (!arg('--only') || arg('--only')!.split(',').includes(c.id)))) {
 const owner = def.owner ?? 'traveler', ch = CHARACTERS[owner];
 for (const upgraded of [false,true]) for (const group of [false,true]) {
  // 每张牌使用同流派的相同六张支持牌；只有两个候选位升级，其他牌保持基础版。
  const ids = ['strike','strike','defend','defend',...supports[def.archetype],def.id,def.id];
  const deck = ids.map((defId, i) => ({defId,uid:i >= 10 ? `candidate-${i}` : `support-${i}`,upgraded:i >= 10 && upgraded}));
  const enemies = elite ? (group ? ['twin_sentinel','twin_sentinel'] : ['ash_knight']) : (group ? ['tomb_puppet','ash_rat'] : ['tomb_puppet']);
  const tier = elite ? 'elite' : 'normal';
  const results = Array.from({length:seeds},(_,seed) => fight(createCombat('rarity-fight',enemies,tier,deck,ch.maxHp,ch.maxHp,
   [ch.starterRelic],makeRng(`RARITY-${seed + seedOffset}`,'c'),100,owner,encounterDifficulty(elite ? 16 : group ? 12 : 9,tier)).state));
  const mean = (key:'hpLoss'|'turns'|'plays') => results.reduce((n,r) => n + r[key],0)/seeds;
  const row = {id:def.id,upgraded,group,seeds,wins:results.filter(r=>r.won).length,stalled:results.filter(r=>r.stalled).length,
   invalid:results.filter(r=>r.invalid).length,hpLoss:mean('hpLoss'),turns:mean('turns'),plays:mean('plays')};
  if(row.stalled || row.invalid) failures.push(`${def.id}/${upgraded}/${group}: fight stalled/invalid`);
  rows.push(row);
 }
 console.log(`${def.id}: ${rows.slice(-4).map(r=>`${r.wins}/${r.seeds} ${r.hpLoss.toFixed(1)}hp`).join(' | ')}`);
}
const cards = CARD_LIST.map(c => ({id:c.id,name:c.name,owner:c.owner??'shared',rarity:c.rarity,type:c.type,archetype:c.archetype,
 base:describeCard({uid:'audit',defId:c.id,upgraded:false},null),upgrade:c.type==='curse'?null:describeCard({uid:'audit',defId:c.id,upgraded:true},null)}));
const report = { elite, seedOffset, note:'逐牌实结算与12张支持牌组探针。预置效果情景不代表资源免费；固定机器人与牌组不等于真人胜率。稀有度由定位、费用、启动代价和成型收益一起评审，不能按单一分数排序。',
 cardCount:cards.length, variants:probes.length/4, seeds, fights:rows.length*seeds, failures, cards, probes, rows };
if(arg('--output'))writeFileSync(arg('--output')!,JSON.stringify(report,null,2));
console.log(JSON.stringify({cards:report.cardCount,variants:report.variants,probes:probes.length,fights:report.fights,failures}));
if(failures.length)process.exitCode=1;
