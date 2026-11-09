import { writeFileSync } from 'node:fs';
import { CARDS } from '../src/data/cards';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { planMove } from '../src/test/cardFloorBenchmark';
import type { CombatState } from '../src/engine/types';

// 同种子、同牌序、同策略对照。来源卡选择进入实际搜索，不给机器人自动最优的隐藏信息。
const seeds = 12;
const stages = [
  { id: 'single', floor: 7, tier: 'normal' as const, enemies: ['rubble_golem'] },
  { id: 'group', floor: 10, tier: 'normal' as const, enemies: ['ash_deacon', 'ash_cultist'] },
  { id: 'elite', floor: 12, tier: 'elite' as const, enemies: ['twin_sentinel', 'twin_sentinel'] },
];
const support = ['strike', 'strike', 'defend', 'defend', 'blood_edge', 'blood_rite', 'inflame', 'numb', 'vein_cutter', 'scarlet_harvest', 'titan_blows'];
function fight(cs: CombatState) {
  let actions = 0, sourcePlays = 0, invalid = false;
  while (cs.outcome === 'ongoing' && cs.turn <= 40 && actions++ < 300) {
    const move = planMove(cs, { depth: 3, width: 3, engines: true });
    if (move) {
      const step = playCard(cs, move.uid, move.target, move.replayUid);
      if (step.state === cs) { invalid = true; break; }
      sourcePlays += step.events.filter(e => e.type === 'cardPlayed' && e.name.startsWith('血誓重演')).length;
      cs = step.state;
    } else {
      cs = endPlayerTurn(cs).state;
      for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
      if (cs.outcome === 'ongoing') cs = startPlayerTurn(cs).state;
    }
    const cards = [cs.player.hand, cs.player.draw, cs.player.discard, cs.player.exhaust].flat();
    if (new Set(cards.map(c => c.uid)).size !== cards.length || cs.player.energy < 0 || !Number.isFinite(cs.player.hp)) invalid = true;
  }
  return { won: cs.outcome === 'won', stalled: cs.outcome === 'ongoing', invalid, sourcePlays, turns: cs.turn, hp: cs.player.hp };
}
const rows = [];
const original = CARDS.vein_cutter.exhaust;
try {
  for (const upgraded of [false, true]) for (const stage of stages) for (const variant of ['before', 'exhaust', 'replay'] as const) {
    CARDS.vein_cutter.exhaust = variant !== 'before';
    const ids = [...support, variant === 'replay' ? 'oath_reenactment' : 'defend'];
    const results = Array.from({ length: seeds }, (_, seed) => fight(createCombat(stage.id, stage.enemies, stage.tier,
      ids.map((defId, i) => ({ uid: `blood-${i}`, defId, upgraded: upgraded && i >= 4 })), 60, 80, ['blood_seal'],
      makeRng(`BLOOD-REPLAY-${seed}`, 'c'), 100, 'oathbound', encounterDifficulty(stage.floor, stage.tier)).state));
    const row = { stage: stage.id, variant, upgraded, seeds, wins: results.filter(r => r.won).length,
      invalid: results.filter(r => r.invalid).length, stalled: results.filter(r => r.stalled).length,
      sourcePlays: results.reduce((n, r) => n + r.sourcePlays, 0),
      avgHp: results.reduce((n, r) => n + r.hp, 0) / seeds, avgTurns: results.reduce((n, r) => n + r.turns, 0) / seeds };
    rows.push(row); console.log(JSON.stringify(row));
  }
} finally { CARDS.vein_cutter.exhaust = original; }
const failures = rows.filter(r => r.invalid || r.stalled).map(r => `${r.stage}/${r.variant}: 非法或停滞`);
if (rows.filter(r => r.variant === 'replay').some(r => r.sourcePlays === 0)) failures.push('新牌未实际参与测试');
writeFileSync('docs/blood-replay-v0.1.19.json', JSON.stringify({ seeds, battles: rows.length * seeds, rows, failures,
  note: '固定构筑压力对照，不代表整局或真人胜率。回血牌削弱允许较旧版降低续航；检查选择实际执行、实体唯一与战斗终止。' }, null, 2));
if (failures.length) { console.error(failures); process.exitCode = 1; }
