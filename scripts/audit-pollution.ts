import { readFileSync, writeFileSync } from 'node:fs';
import { DIFFICULTY_PRESETS } from '../src/data/difficulty';
import { CHARACTERS } from '../src/data/characters';
import { ENCOUNTERS } from '../src/data/enemies';
import { RELICS } from '../src/data/relics';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { viewCard } from '../src/engine/cards';
import { BUILD_LOADOUTS } from '../src/test/buildLoadouts';
import { planMove } from '../src/test/cardFloorBenchmark';
import type { CombatState } from '../src/engine/types';

const arg = (key: string) => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1]; };
const seeds = Number(arg('--seeds') ?? 8);
const seedOffset = Number(arg('--seed-offset') ?? 0);
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('invalid seeds');
if (!Number.isInteger(seedOffset) || seedOffset < 0) throw new Error('invalid seed offset');
const challenge = process.argv.includes('--challenge');
const legacyIntents = process.argv.includes('--legacy-intents');
const cases = [
  ['sky_moths', 42], ['sky_scribe_moth', 45], ['sky_sentinel_scribe', 49],
  ['sky_scribe_swarm', 53], ['sky_archive_moth', 53], ['sky_elite_keeper', 55],
  ['sky_boss_archon', 59], ['final_elite_warden', 61], ['final_boss_lord', 64],
] as const;
function fight(cs: CombatState) {
  const hp = cs.player.hp; let actions = 0, invalid = false, maxDeadHand = 0, dazedSeen = new Set<string>();
  while (cs.outcome === 'ongoing' && cs.turn <= 60 && actions++ < 800) {
    for (const c of cs.player.hand) if (c.defId === 'dazed') dazedSeen.add(c.uid);
    maxDeadHand = Math.max(maxDeadHand, cs.player.hand.filter(c => viewCard(c).cost < 0).length);
    const move = planMove(cs, { depth: 2, width: 3, engines: true });
    if (move) {
      const next = playCard(cs, move.uid, move.target, move.replayUid).state;
      if (next === cs) { invalid = true; break; }
      cs = next;
    } else {
      cs = endPlayerTurn(cs).state;
      for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
      if (cs.outcome === 'ongoing') cs = startPlayerTurn(cs).state;
    }
    const piles = [...cs.player.hand, ...cs.player.draw, ...cs.player.discard, ...cs.player.exhaust];
    if (new Set(piles.map(c => c.uid)).size !== piles.length || !Number.isFinite(cs.player.hp) || cs.player.energy < 0 || cs.enemies.some(e => e.hp < 0)) { invalid = true; break; }
  }
  return { won: cs.outcome === 'won', stalled: cs.outcome === 'ongoing', invalid, hpLoss: (hp - cs.player.hp) / hp, turns: cs.turn, maxDeadHand, dazedSeen: dazedSeen.size };
}
const rows = [];
for (const [id, floor] of cases.filter(([id]) => !arg('--encounter') || id === arg('--encounter'))) for (const build of BUILD_LOADOUTS) {
  const encounter = ENCOUNTERS.find(e => e.id === id)!, ch = CHARACTERS[build.character];
  const relics = [ch.starterRelic, ...build.relics.filter(r => floor >= 60 || RELICS[r].chapter !== 3)];
  const growth = relics.flatMap(id => RELICS[id].journey ?? []).filter(r => r.trigger === 'obtain').flatMap(r => r.effects).reduce((sum, e) => sum + (e.kind === 'maxHp' ? e.amount : 0), 0);
  const hp = ch.maxHp + growth;
  const deck = ['strike', 'strike', 'defend', 'defend', ...ch.starterDeck.slice(-2), ...build.cards].map((defId, i) => ({ uid: `pollution-${i}`, defId, upgraded: i >= 6 }));
  const results = Array.from({ length: seeds }, (_, seed) => fight(createCombat(id, encounter.enemies, encounter.tier, deck, hp, hp, relics, makeRng(`POLLUTION-${seed + seedOffset}`, 'c'), 100, build.character, { ...encounterDifficulty(floor, encounter.tier, DIFFICULTY_PRESETS[challenge ? 2 : 1].settings), ...(legacyIntents ? { complexIntents: false } : {}) }).state));
  const mean = (key: 'hpLoss' | 'turns' | 'maxDeadHand' | 'dazedSeen') => results.reduce((sum, r) => sum + r[key], 0) / seeds;
  rows.push({ id, floor: floor + 1, character: build.character, route: build.route, seeds, wins: results.filter(r => r.won).length, stalled: results.filter(r => r.stalled).length, invalid: results.filter(r => r.invalid).length, hpLoss: mean('hpLoss'), turns: mean('turns'), maxDeadHand: mean('maxDeadHand'), dazedSeen: mean('dazedSeen') });
}
const failures = rows.filter(r => r.stalled || r.invalid).map(r => `${r.id}/${r.route}: 停滞或非法状态`);
const baseline = arg('--before') ? JSON.parse(readFileSync(arg('--before')!, 'utf8')) : undefined;
if (baseline && (!!baseline.challenge !== challenge || (baseline.seedOffset ?? 0) !== seedOffset)) throw new Error('incompatible difficulty or seeds');
const before = baseline?.rows as typeof rows | undefined;
const comparison = [];
if (before) for (const [id] of cases.filter(([id]) => !arg('--encounter') || id === arg('--encounter'))) {
  const now = rows.filter(r => r.id === id), old = before.filter(r => r.id === id);
  if (old.length !== now.length || old.some(r => r.seeds !== seeds)) throw new Error('incompatible baseline');
  const win = (rs: typeof rows) => rs.reduce((s, r) => s + r.wins, 0) / (rs.length * seeds);
  const loss = (rs: typeof rows) => rs.reduce((s, r) => s + r.hpLoss, 0) / rs.length;
  comparison.push({ id, winBefore: win(old), winAfter: win(now), hpLossBefore: loss(old), hpLossAfter: loss(now) });
  // 用户明确要求困难最终Boss接近10%：该场允许下降20个百分点，其他遭遇仍为15。
  const maxDrop = challenge && id === 'final_boss_lord' ? .20 : .15;
  if (win(now) < win(old) - maxDrop || loss(now) > loss(old) + .15) failures.push(`${id}: 胜率下降超过${maxDrop * 100}或额外生命损失超过15个百分点`);
}
const result = { challenge, legacyIntents, seedOffset, note: '4角色8路线、合法后期遭遇、固定18张成熟牌组配对。难度见challenge字段，每场满血；仅终章携带第三章遗物。启发式机器人不代表真人或整局胜率。检查停滞、实体重复、非法状态；生命损失增加不超过15个百分点；胜率下降最多15个百分点，仅困难最终Boss按用户约10%目标放宽至20个百分点。', seeds, fights: rows.length * seeds, comparison, failures, rows };
if (arg('--output')) writeFileSync(arg('--output')!, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ fights: result.fights, wins: rows.reduce((s, r) => s + r.wins, 0), comparison, failures }, null, 2));
if (failures.length) process.exitCode = 1;
