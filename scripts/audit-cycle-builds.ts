import { writeFileSync } from 'node:fs';
import { CARDS } from '../src/data/cards';
import { CYCLE_CARDS } from '../src/data/cycleCards';
import { CHARACTERS } from '../src/data/characters';
import { createCombat, playCard, endPlayerTurn, enemyAct, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { planMove } from '../src/test/cardFloorBenchmark';
import type { CharacterId, CombatState } from '../src/engine/types';

const builds: Record<CharacterId, { support: string[]; control: string[] }> = {
  traveler: { support: ['spin_kick', 'rhythm', 'raise_shield', 'haste', 'trail_supply', 'unburden_armor', 'vanguard_oath'], control: ['measured_step', 'brace_line', 'sunward_step'] },
  picker: { support: ['light_up', 'wildfire', 'burn_pages', 'borrow_flame', 'ash_index', 'tinder_bundle', 'sheltering_ash'], control: ['sift_ash', 'smoke_cover', 'sunward_step'] },
  oathbound: { support: ['vein_cutter', 'crimson_covenant', 'blood_watch', 'blood_rite', 'pulse_memory', 'borrow_fury', 'flex'], control: ['bind_wounds', 'gather_fury', 'sunward_step'] },
  scholar: { support: ['charged_blade', 'rune_shield', 'patient_study', 'echo_footnotes', 'release_charge', 'double_chant', 'future_memory'], control: ['woven_words', 'rune_cache', 'sunward_step'] },
};
const stages = [
  { id: 'single', enemies: ['rubble_golem'], floor: 8, tier: 'normal' as const },
  { id: 'group', enemies: ['ash_deacon', 'ash_cultist'], floor: 12, tier: 'normal' as const },
  { id: 'elite', enemies: ['ash_knight'], floor: 12, tier: 'elite' as const },
];
const seeds = 8;
function fight(cs: CombatState) {
  const initialHp = cs.player.hp, plays: Record<string, number> = {};
  let actions = 0, inTurn = 0, maxTurnPlays = 0, invalid = false;
  while (cs.outcome === 'ongoing' && cs.turn <= 35 && actions++ < 350) {
    const move = planMove(cs, { depth: 3, width: 4, engines: true });
    if (move) {
      const id = cs.player.hand.find(c => c.uid === move.uid)!.defId;
      const result = playCard(cs, move.uid, move.target, move.replayUid);
      if (result.state === cs) { invalid = true; break; }
      cs = result.state; plays[id] = (plays[id] ?? 0) + 1;
      maxTurnPlays = Math.max(maxTurnPlays, ++inTurn);
      if (inTurn > 100) { invalid = true; break; }
    } else {
      cs = endPlayerTurn(cs).state;
      for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
      if (cs.outcome === 'ongoing') cs = startPlayerTurn(cs).state;
      inTurn = 0;
    }
    const cards = [cs.player.hand, cs.player.draw, cs.player.discard, cs.player.exhaust].flat();
    if (new Set(cards.map(c => c.uid)).size !== cards.length || [cs.player.energy, cs.player.hp, cs.player.ember].some(n => n < 0 || !Number.isFinite(n))) { invalid = true; break; }
  }
  return { win: cs.outcome === 'won', stalled: cs.outcome === 'ongoing', invalid, hpLoss: initialHp - cs.player.hp, turns: cs.turn, maxTurnPlays, plays };
}
const rows = [], failures: string[] = [];
for (const owner of Object.keys(builds) as CharacterId[]) for (const up of [false, true]) for (const stage of stages) {
  const build = builds[owner], ch = CHARACTERS[owner];
  const sample = (candidate: boolean) => {
    const additions = candidate ? [...CYCLE_CARDS.filter(c => c.owner === owner).map(c => c.id), 'ember_retrieval'] : build.control;
    const ids = ['strike', 'defend', 'defend', ...build.support, ...additions];
    if (ids.some(id => !CARDS[id] || CARDS[id].owner && CARDS[id].owner !== owner)) throw new Error('非法构筑：' + owner);
    const results = Array.from({ length: seeds }, (_, seed) => fight(createCombat(stage.id, stage.enemies, stage.tier,
      ids.map((defId, i) => ({ defId, uid: `cycle-${i}`, upgraded: up && i >= 3 })), ch.maxHp, ch.maxHp, [ch.starterRelic], makeRng(`CYCLE-BUILD-${seed}`, 'c'), 100, owner, encounterDifficulty(stage.floor, stage.tier)).state));
    const plays: Record<string, number> = {};
    for (const r of results) for (const [id, count] of Object.entries(r.plays)) plays[id] = (plays[id] ?? 0) + count;
    return { wins: results.filter(r => r.win).length, invalid: results.filter(r => r.invalid).length, stalled: results.filter(r => r.stalled).length,
      hpLoss: results.reduce((s, r) => s + r.hpLoss, 0) / seeds, turns: results.reduce((s, r) => s + r.turns, 0) / seeds,
      maxTurnPlays: Math.max(...results.map(r => r.maxTurnPlays)), plays };
  };
  const candidate = sample(true), control = sample(false);
  rows.push({ owner, up, stage: stage.id, candidate, control });
  if (candidate.invalid || candidate.stalled || control.invalid || control.stalled) failures.push(`${owner}/${up}/${stage.id}: 非法状态或未结束`);
}
for (const c of CYCLE_CARDS) if (rows.every(r => !r.candidate.plays[c.id])) failures.push(c.id + ': 未实际打出');
const summary = Object.keys(builds).map(owner => {
  const group = rows.filter(r => r.owner === owner);
  const candidateWins = group.reduce((s, r) => s + r.candidate.wins, 0), controlWins = group.reduce((s, r) => s + r.control.wins, 0);
  if (candidateWins < controlWins - group.length * seeds * .25) failures.push(owner + ': 构筑胜场严重退化');
  return { owner, fightsPerBuild: group.length * seeds, candidateWins, controlWins, maxTurnPlays: Math.max(...group.map(r => r.candidate.maxTurnPlays)) };
});
const report = { note: '4角色合法13张构筑；基础/升级×单体/群体/精英×8种子，新卡组与同数旧功能牌对照。固定真实费用、初始遗物，3步束搜索；检查选牌实体守恒、每回合100次出牌上限、战斗结束与严重退化。机器人仅看已知手牌和显示的候选；样本胜率不等于真人或整局胜率。', fights: rows.length * seeds * 2, summary, failures, rows };
writeFileSync('docs/cycle-builds-v0.1.22.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ fights: report.fights, summary, failures }, null, 2));
if (failures.length) process.exitCode = 1;
