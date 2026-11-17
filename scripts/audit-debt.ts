import { writeFileSync } from 'node:fs';
import { CHAPTERS } from '../src/data/chapters';
import { debtCollectorId } from '../src/data/debtCollectors';
import { BUILD_LOADOUTS } from '../src/test/buildLoadouts';
import { createCombat, playCard, endPlayerTurn, enemyAct, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { planMove } from '../src/test/cardFloorBenchmark';
import { buildScenario } from './buildScenarios';
import type { ChapterId, CombatState } from '../src/engine/types';

/** 各章讨债人与同章首领的并排对比：同一批构筑牌组、同样的首领倍率、相同种子。 */
const arg = (key: string) => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1]; };
const seeds = Number(arg('--seeds') ?? 40);
const BOSSES: Record<ChapterId, string[]> = { 1: ['ash_sovereign', 'bell_heart'], 2: ['everburning_core'], 3: ['eclipse_archon'], 4: ['nightless_lord'] };

function fight(cs: CombatState) {
  const hp = cs.player.hp; let actions = 0, invalid = false;
  while (cs.outcome === 'ongoing' && cs.turn <= 60 && actions++ < 600) {
    const move = planMove(cs, { depth: 3, width: 3, engines: true });
    if (move) { const next = playCard(cs, move.uid, move.target, move.replayUid).state; if (next === cs) { invalid = true; break; } cs = next; }
    else { cs = endPlayerTurn(cs).state; for (const e of cs.enemies) cs = enemyAct(cs, e.id).state; if (cs.outcome === 'ongoing') cs = startPlayerTurn(cs).state; }
    if (!Number.isFinite(cs.player.hp) || cs.enemies.some(e => !Number.isFinite(e.hp) || e.hp < 0)) { invalid = true; break; }
  }
  return { won: cs.outcome === 'won', stalled: cs.outcome === 'ongoing', invalid, turns: cs.turn, hpLoss: hp - cs.player.hp, hpLossRatio: (hp - cs.player.hp) / hp };
}

const rows = [];
for (const chapter of [1, 2, 3, 4] as ChapterId[]) {
  const floor = CHAPTERS[chapter].startFloor + CHAPTERS[chapter].floors - 1;
  const difficulty = encounterDifficulty(floor, 'boss');
  for (const [kind, enemies, tier] of [['collector', [debtCollectorId(chapter)], 'normal'], ...BOSSES[chapter].map(id => ['boss', [id], 'boss'])] as [string, string[], 'normal' | 'boss'][]) {
    for (const build of BUILD_LOADOUTS) {
      // 第一章用六张普通牌的早期牌组，之后用完整的成型牌组；遗物随章节解锁。
      const stage = { id: enemies[0], floor, tier, enemies };
      const { ids, relics, hp, deck } = buildScenario(build, stage);
      const results = Array.from({ length: seeds }, (_, seed) => fight(createCombat(enemies[0], enemies, tier, deck(ids), hp, hp, relics, makeRng(`DEBT-${seed}`, 'c'), 100, build.character, difficulty).state));
      const mean = (k: 'hpLoss' | 'hpLossRatio' | 'turns') => results.reduce((s, r) => s + r[k], 0) / seeds;
      rows.push({ chapter, kind, enemy: enemies[0], route: build.route, seeds, wins: results.filter(r => r.won).length, stalled: results.filter(r => r.stalled).length, invalid: results.filter(r => r.invalid).length, hpLoss: mean('hpLoss'), hpLossRatio: mean('hpLossRatio'), turns: mean('turns') });
      console.log(JSON.stringify(rows.at(-1)));
    }
  }
}
const failures = rows.filter(r => r.stalled || r.invalid).map(r => `${r.enemy}/${r.route}: 停滞或非法状态`);
if (arg('--output')) writeFileSync(arg('--output')!, JSON.stringify({ seeds, rows }, null, 1));
console.log('Failures:', failures); if (failures.length) process.exitCode = 1;
