import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHARACTERS } from '../src/data/characters';
import { ENCOUNTERS, ENEMIES } from '../src/data/enemies';
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
// 同章、同层、同遭遇比较新旧定义，牌组、初始状态和随机序列保持相同。
const cases: [string, string, number][] = args.includes('--chapters')
  ? ENCOUNTERS.filter(e => e.chapter === 2 || e.chapter === 3).flatMap(e => {
    const depths = e.tier === 'boss' ? [19] : e.tier === 'elite' ? [4, 11, 17]
      : [...new Set([e.minFloor ?? 0, Math.min(e.maxFloor ?? 17, 17)])];
    return depths.map(d => [e.id, e.id, (e.chapter! - 1) * 20 + d] as [string, string, number]);
  }) : [
  ['alley_duel','alley_duel',3], ['lamplit_patrol','lamplit_patrol',10],
  ['deep_saw_track','deep_saw_track',21], ['deep_saw_ticks','deep_saw_ticks',28],
  ['sky_hound','sky_hound',40], ['sky_hound_mirror','sky_hound_mirror',48],
  ['sky_boss_archon','sky_boss_archon',59], ['final_boss_lord','final_boss_lord',64],
];
const baselineDir = value('--baseline-dir');
if (!baselineDir) throw new Error('需要 --baseline-dir，包含前一版本的四个敌人模块');
const current = { ...ENEMIES }, old = { ...ENEMIES };
for (const [file, key] of [['enemies2-before-openers.ts','CHAPTER_TWO_ENEMIES'],['enemies3-before-openers.ts','CHAPTER_THREE_ENEMIES'],['enemies4-before-openers.ts','CHAPTER_FOUR_ENEMIES'],['extraEnemies-before-openers.ts','EXTRA_ENEMIES']]) {
  const module = await import(resolve(baselineDir, file));
  for (const enemy of module[key]) old[enemy.id] = enemy;
}
function fight(cs: CombatState) {
  const hp = cs.player.hp; let actions = 0, invalid = false;
  const trace: unknown[] = [];
  while (cs.outcome === 'ongoing' && cs.turn <= 40 && actions++ < 400) {
    const move = planMove(cs, { depth: 3, width: 3, engines: true });
    if (args.includes('--trace')) trace.push({ turn: cs.turn, hp: cs.player.hp, block: cs.player.block, energy: cs.player.energy, move: move ? cs.player.hand.find(c=>c.uid===move.uid)?.defId : 'end', enemies: cs.enemies.map(e=>({hp:e.hp,block:e.block,intent:e.moveId,phase:e.phase})) });
    if (move) { const next = playCard(cs, move.uid, move.target, move.replayUid).state; if (next === cs) { invalid = true; break; } cs = next; }
    else { cs = endPlayerTurn(cs).state; for (const e of cs.enemies) cs = enemyAct(cs, e.id).state; if (cs.outcome === 'ongoing') cs = startPlayerTurn(cs).state; }
    if (!Number.isFinite(cs.player.hp) || cs.player.energy < 0 || cs.enemies.some(e => e.hp < 0)) { invalid = true; break; }
  }
  return { won: cs.outcome === 'won', stalled: cs.outcome === 'ongoing', invalid, turns: cs.turn, hpLoss: (hp - cs.player.hp) / hp, ...(args.includes('--trace') ? {trace} : {}) };
}
const rows = [];
for (const [id, reference, floor] of cases) for (const build of BUILD_LOADOUTS) {
  if (value('--route') && value('--route') !== build.route || value('--encounter') && !value('--encounter')!.split(',').includes(id)) continue;
  const ch = CHARACTERS[build.character], chapter = Math.floor(floor / 20) + 1;
  const ids = ['strike','strike','defend','defend',...ch.starterDeck.slice(-2),...(chapter === 1 ? early[build.route] : build.cards)];
  // 第二章仅取一件前章奖励和两件常规遗物，第三章再加第二章奖励；不提前给第三章奖励。
  const relics = [ch.starterRelic, ...(chapter === 4 ? build.relics : chapter === 3 ? build.relics.filter(id => RELICS[id].chapter !== 3) : chapter === 2 ? [build.relics[0], ...build.relics.slice(2,4)] : [])];
  const growth = relics.reduce((n,id) => n + (RELICS[id].journey ?? []).filter(r => r.trigger === 'obtain').flatMap(r => r.effects).reduce((s,e) => s + (e.kind === 'maxHp' ? e.amount : 0),0),0);
  const hp = ch.maxHp + growth;
  const deck = ids.map((defId,i) => ({uid:`new-enemy-${i}`,defId,upgraded: chapter >= 3 ? i >= 6 : chapter === 2 && i >= 6 && i < 10}));
  const sample = (encounterId: string, baseline: boolean) => {
    Object.assign(ENEMIES, baseline ? old : current);
    const encounter = ENCOUNTERS.find(e => e.id === encounterId)!;
    const local = floor - (chapter - 1) * 20;
    if ((encounter.chapter ?? 1) !== chapter || local < (encounter.minFloor ?? 0) || local > (encounter.maxFloor ?? 19)) throw new Error(`illegal fixture ${encounterId}:${floor}`);
    const results = Array.from({length:seeds},(_,i) => fight(createCombat(encounterId,encounter.enemies,encounter.tier,deck,hp,hp,relics,makeRng(`NEW-ENEMY-${i}`,'c'),100,build.character,encounterDifficulty(floor,encounter.tier)).state));
    return {wins:results.filter(r=>r.won).length,stalled:results.filter(r=>r.stalled).length,invalid:results.filter(r=>r.invalid).length,
      hpLoss:results.reduce((s,r)=>s+r.hpLoss,0)/seeds,turns:results.reduce((s,r)=>s+r.turns,0)/seeds, ...(args.includes('--trace') ? {results} : {})};
  };
  rows.push({id,reference,floor,route:build.route,seeds,candidate:sample(id,false),control:sample(reference,true)});
}
const failures: string[] = [];
for (const row of rows) if (row.candidate.stalled || row.candidate.invalid || row.control.stalled || row.control.invalid) failures.push(`${row.id}/${row.route}:停滞或非法状态`);
Object.assign(ENEMIES, current);
for (const chapter of [1,2,3,4]) for (const build of BUILD_LOADOUTS) {
  const subset = rows.filter(r => Math.floor(r.floor / 20) + 1 === chapter && r.route === build.route);
  if (!subset.length) continue;
  const mean = (side:'candidate'|'control',key:'wins'|'hpLoss')=>subset.reduce((s,r)=>s+r[side][key],0)/subset.length;
  if (mean('candidate','wins') / seeds < mean('control','wins') / seeds - .25 || mean('candidate','hpLoss') > mean('control','hpLoss') + .25)
    failures.push(`第${chapter}章/${build.route}:同场景加强幅度超过护栏`);
}
if (args.includes('--chapters')) for (const row of rows) {
  const limit = row.floor < 40 ? .20 : .25;
  if (row.candidate.wins < row.control.wins - seeds * limit || row.candidate.hpLoss > row.control.hpLoss + limit)
    failures.push(`${row.id}/${row.floor + 1}层/${row.route}:单场景加强幅度超过护栏`);
}
for (const row of rows.filter(r => r.id === 'sky_boss_archon')) {
  if (row.candidate.wins < row.control.wins - seeds * .25 || row.candidate.hpLoss > row.control.hpLoss + .25 || row.control.wins > 0 && row.candidate.wins === 0) failures.push(`第三章首领/${row.route}:单独压力护栏未通过`);
}
for (const id of new Set(cases.map(c=>c[0]))) {
  const subset = rows.filter(r=>r.id===id);
  if (subset.length && !value('--route') && subset.every(r=>r.candidate.wins===0)) failures.push(`${id}:所有构筑零胜`);
}
const result = {note:'固定构筑、同章同层同遭遇前后对照；第三章不提前持有本章首领奖励，终章才带第三章遗物。按章节与流派检查胜率下降不超过25个百分点，生命损失比例不额外增加超过0.25；--chapters另逐场景检查第二章20%、第三章25%的同类护栏。第三章首领原有胜场的流派不得变成零胜；不得停滞或非法状态，不代表真人胜率。',seeds,rows,failures};
if(value('--output'))writeFileSync(value('--output')!,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({fights:rows.length*seeds*2,candidateWins:rows.reduce((s,r)=>s+r.candidate.wins,0),controlWins:rows.reduce((s,r)=>s+r.control.wins,0),failures},null,2));
if(failures.length)process.exitCode=1;
