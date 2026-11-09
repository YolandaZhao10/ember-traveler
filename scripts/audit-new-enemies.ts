import { writeFileSync } from 'node:fs';
import { CHARACTERS } from '../src/data/characters';
import { ENCOUNTERS } from '../src/data/enemies';
import { RELICS } from '../src/data/relics';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { BUILD_LOADOUTS } from '../src/test/buildLoadouts';
import { planMove } from '../src/test/cardFloorBenchmark';
import type { CombatState } from '../src/engine/types';

const args = process.argv.slice(2), value = (flag: string) => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const seeds = Number(value('--seeds') ?? 8);
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('invalid seeds');
const early: Record<string, string[]> = {
  combo: ['quick_stab','twin_blades','chain_slash','spin_kick','rhythm','measured_step'],
  bulwark: ['raise_shield','shield_bash','riposte','vigil','brace_line','ember_patrol'],
  cinder: ['light_up','wildfire','scorch_mark','lingering_fire','tend_coals','smoke_screen'],
  ash: ['bone_ash','bone_ash','sift_ash','salvage_scraps','ash_shell','buried_knife'],
  blood: ['blood_edge','leech_bite','numb','crimson_step','bind_wounds','blood_insight'],
  might: ['inflame','overpower','bone_crusher','double_punch','battle_breath','frenzy'],
  echo: ['echo_blade','ash_word','aria','echo_veil','reverberant_cut','quiet_sentence'],
  focus: ['charged_blade','focus','measured_breath','surge_glyph','delayed_thrust','patient_study'],
};
// 每对都是同章、合法楼层的现有普通遭遇；仅改变敌组，其余状态和种子相同。
const cases = [
  ['alley_crossbow','snail1',3], ['alley_duel','hollow1',6], ['lamp_and_rat','puppet_rat',4],
  ['crossbow_ambush','looter_crow',9], ['lamplit_patrol','snail_hollow',12],
  ['deep_pressure','deep_drone',23], ['deep_quenching','deep_guard',22], ['deep_saw_track','deep_hound',23],
  ['deep_smith_ticks','deep_stoker_tick',27], ['deep_saw_ticks','deep_seer',30],
  ['sky_sealed_archive','sky_pilgrim',43], ['sky_phase_lance','sky_hound',43], ['sky_starboard','sky_sentinel',44],
  ['sky_lancer_mirror','sky_hound_mirror',49], ['sky_archive_moth','sky_scribe_moth',52],
] as const;
function fight(cs: CombatState) {
  const hp = cs.player.hp; let actions = 0, invalid = false;
  while (cs.outcome === 'ongoing' && cs.turn <= 40 && actions++ < 400) {
    const move = planMove(cs, { depth: 3, width: 3, engines: true });
    if (move) { const next = playCard(cs, move.uid, move.target).state; if (next === cs) { invalid = true; break; } cs = next; }
    else { cs = endPlayerTurn(cs).state; for (const e of cs.enemies) cs = enemyAct(cs, e.id).state; if (cs.outcome === 'ongoing') cs = startPlayerTurn(cs).state; }
    if (!Number.isFinite(cs.player.hp) || cs.player.energy < 0 || cs.enemies.some(e => e.hp < 0)) { invalid = true; break; }
  }
  return { won: cs.outcome === 'won', stalled: cs.outcome === 'ongoing', invalid, turns: cs.turn, hpLoss: (hp - cs.player.hp) / hp };
}
const rows = [];
for (const [id, reference, floor] of cases) for (const build of BUILD_LOADOUTS) {
  const ch = CHARACTERS[build.character], chapter = floor < 20 ? 1 : floor < 40 ? 2 : 3;
  const ids = ['strike','strike','defend','defend',...ch.starterDeck.slice(-2),...(chapter === 1 ? early[build.route] : build.cards)];
  // 第二章仅取一件前章奖励和两件常规遗物，第三章再加第二章奖励；不提前给第三章奖励。
  const relics = [ch.starterRelic, ...(chapter === 1 ? [] : [build.relics[0], ...build.relics.slice(2,4)]), ...(chapter === 3 ? [build.relics[1]] : [])];
  const growth = relics.reduce((n,id) => n + (RELICS[id].journey ?? []).filter(r => r.trigger === 'obtain').flatMap(r => r.effects).reduce((s,e) => s + (e.kind === 'maxHp' ? e.amount : 0),0),0);
  const hp = ch.maxHp + growth;
  const deck = ids.map((defId,i) => ({uid:`new-enemy-${i}`,defId,upgraded: chapter === 3 ? i >= 6 : chapter === 2 && i >= 6 && i < 10}));
  const sample = (encounterId: string) => {
    const encounter = ENCOUNTERS.find(e => e.id === encounterId)!;
    const local = floor - (chapter - 1) * 20;
    if ((encounter.chapter ?? 1) !== chapter || local < (encounter.minFloor ?? 0) || local > (encounter.maxFloor ?? 19)) throw new Error(`illegal fixture ${encounterId}:${floor}`);
    const results = Array.from({length:seeds},(_,i) => fight(createCombat(encounterId,encounter.enemies,'normal',deck,hp,hp,relics,makeRng(`NEW-ENEMY-${i}`,'c'),100,build.character,encounterDifficulty(floor,'normal')).state));
    return {wins:results.filter(r=>r.won).length,stalled:results.filter(r=>r.stalled).length,invalid:results.filter(r=>r.invalid).length,
      hpLoss:results.reduce((s,r)=>s+r.hpLoss,0)/seeds,turns:results.reduce((s,r)=>s+r.turns,0)/seeds};
  };
  rows.push({id,reference,floor,route:build.route,seeds,candidate:sample(id),control:sample(reference)});
}
const failures: string[] = [];
for (const row of rows) if (row.candidate.stalled || row.candidate.invalid || row.control.stalled || row.control.invalid) failures.push(`${row.id}/${row.route}:停滞或非法状态`);
for (const chapter of [1,2,3]) for (const build of BUILD_LOADOUTS) {
  const subset = rows.filter(r => Math.floor(r.floor / 20) + 1 === chapter && r.route === build.route);
  const mean = (side:'candidate'|'control',key:'wins'|'hpLoss')=>subset.reduce((s,r)=>s+r[side][key],0)/subset.length;
  if (mean('candidate','wins') / seeds < mean('control','wins') / seeds - .15 || mean('candidate','hpLoss') > mean('control','hpLoss') + .15)
    failures.push(`第${chapter}章/${build.route}:相对既有普通遭遇负担增加过多`);
}
for (const [id] of cases) if (rows.filter(r=>r.id===id).every(r=>r.candidate.wins===0)) failures.push(`${id}:所有构筑零胜`);
const result = {note:'固定构筑、同章同层普通遭遇对照；不代表真人或整局胜率。新敌组允许有强弱差异，逐章逐路线检查胜率下降不超过15个百分点、平均生命损失比例不额外增加超过0.15。',seeds,rows,failures};
if(value('--output'))writeFileSync(value('--output')!,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({fights:rows.length*seeds*2,candidateWins:rows.reduce((s,r)=>s+r.candidate.wins,0),controlWins:rows.reduce((s,r)=>s+r.control.wins,0),failures},null,2));
if(failures.length)process.exitCode=1;
