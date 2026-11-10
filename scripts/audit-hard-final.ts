import { readFileSync, writeFileSync } from 'node:fs';
import { CARDS } from '../src/data/cards';
import { CHARACTERS } from '../src/data/characters';
import { DIFFICULTY_PRESETS } from '../src/data/difficulty';
import { RELICS } from '../src/data/relics';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';
import { BUILD_LOADOUTS } from '../src/test/buildLoadouts';
import { planMove } from '../src/test/cardFloorBenchmark';
import type { CombatState } from '../src/engine/types';

const arg = (key: string) => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1]; };
const seeds = Number(arg('--seeds') ?? 32), offset = Number(arg('--offset') ?? 0), depth = Number(arg('--depth') ?? 3);
if (![seeds, depth].every(n => Number.isInteger(n) && n > 0) || !Number.isInteger(offset) || offset < 0) throw new Error('invalid options');
// 全部构筑在修改数值前固定；与旧组使用相同牌数、升级数和遗物，不根据测试结果挑选获胜牌序。
const synergy: Record<string, string[]> = {
  combo: ['quick_stab','twin_blades','chain_slash','spin_kick','haste','trail_supply','blade_recall','tempo','war_drum','vanguard_oath','iron_will','thousand_cuts'],
  bulwark: ['raise_shield','shield_bash','iron_wall','hold_fast','iron_will','iron_rebuke','shield_rotation','unburden_armor','long_road','vigil','bulwark_counter','raise_shield'],
  cinder: ['light_up','coal_heart','add_fuel','lingering_fire','heat_wave','cremation','everburning','borrow_flame','cinder_salvage','white_hot','choking_embers','ash_shield'],
  ash: ['burn_pages','bone_ash','ash_feast','pass_the_flame','ash_return','dust_to_dust','ash_feast','ash_reserve','ash_sifting','ash_index','bone_ash','ash_return'],
  blood: ['blood_rite','leech_bite','blood_pact','numb','crimson_mail','crimson_covenant','blood_watch','vein_cutter','pulse_memory','oath_reenactment','leech_bite','oath_judgement'],
  might: ['frenzy','frenzy','hammer_rain','overpower','demon_heart','mountain_splitter','borrow_fury','iron_blooded','war_avatar','scar_hold','leech_bite','numb'],
  echo: ['double_chant','echo_blade','resonance','mirror','aria','finale','rune_shield','rune_wall','erudition','star_page_search','echo_footnotes','echo_blade'],
  focus: ['rune_shield','focus','rune_wall','charged_blade','meditate','erudition','ward_rune','ash_equation','charged_blade','palimpsest','release_charge','ember_burst'],
};
function fight(cs: CombatState) {
  let actions = 0, invalid = false, openingHp = cs.player.hp;
  const plays: Record<string, number> = {};
  while (cs.outcome === 'ongoing' && cs.turn <= 60 && actions++ < 800) {
    const move = planMove(cs, { depth, width: 4, engines: true });
    if (move) {
      const id = cs.player.hand.find(c => c.uid === move.uid)!.defId;
      const next = playCard(cs, move.uid, move.target, move.replayUid).state;
      if (next === cs) { invalid = true; break; }
      plays[id] = (plays[id] ?? 0) + 1; cs = next;
    } else {
      cs = endPlayerTurn(cs).state;
      for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
      if (cs.turn === 1) openingHp = cs.player.hp;
      if (cs.outcome === 'ongoing') cs = startPlayerTurn(cs).state;
    }
    const piles = [...cs.player.hand, ...cs.player.draw, ...cs.player.discard, ...cs.player.exhaust];
    if (new Set(piles.map(c => c.uid)).size !== piles.length || [cs.player.hp, cs.player.energy, cs.player.ember].some(n => !Number.isFinite(n) || n < 0) || cs.enemies.some(e => e.hp < 0)) { invalid = true; break; }
  }
  return { won: cs.outcome === 'won', stalled: cs.outcome === 'ongoing', invalid, turn: cs.turn, hp: cs.player.hp, openingHp, bossHp: cs.enemies[0].hp, bossHpRatio: cs.enemies[0].hp / cs.enemies[0].maxHp, plays };
}
const rows = [];
for (const profile of ['legacy', 'synergy']) for (const build of BUILD_LOADOUTS) {
  if (arg('--profile') && profile !== arg('--profile') || arg('--route') && !arg('--route')!.split(',').includes(build.route)) continue;
  const cards = profile === 'legacy' ? build.cards : synergy[build.route];
  const ch = CHARACTERS[build.character], relics = [ch.starterRelic, ...build.relics];
  if (cards.length !== 12 || cards.some(id => !CARDS[id] || CARDS[id].owner && CARDS[id].owner !== build.character)) throw new Error('invalid deck: '+build.route);
  const growth = relics.flatMap(id => RELICS[id].journey ?? []).filter(r => r.trigger === 'obtain').flatMap(r => r.effects).reduce((sum, e) => sum + (e.kind === 'maxHp' ? e.amount : 0), 0);
  const hp = ch.maxHp + growth;
  const deck = ['strike','strike','defend','defend',...ch.starterDeck.slice(-2),...cards].map((defId, i) => ({ uid: `final-${i}`, defId, upgraded: i >= 6 }));
  const results = Array.from({ length: seeds }, (_, seed) => ({ seed: seed + offset, ...fight(createCombat('final_boss_lord', ['nightless_lord'], 'boss', deck, hp, hp, relics, makeRng(`HARD-FINAL-${seed + offset}`, 'c'), 100, build.character, encounterDifficulty(64, 'boss', DIFFICULTY_PRESETS[process.argv.includes('--standard') ? 1 : 2].settings)).state) }));
  const avg = (key: 'turn' | 'bossHpRatio' | 'openingHp') => results.reduce((s, r) => s + r[key], 0) / seeds;
  const row = { profile, character: build.character, route: build.route, cards, relics, hp, seeds, wins: results.filter(r => r.won).length, openingDeaths: results.filter(r => !r.won && r.turn === 1).length, turn: avg('turn'), openingHp: avg('openingHp'), bossHpRatio: avg('bossHpRatio'), results };
  rows.push(row);
  console.log(JSON.stringify({ ...row, cards: undefined, relics: undefined, results: undefined }));
}
const summary = Object.keys(CHARACTERS).map(character => {
  const rs = rows.filter(r => r.character === character), results = rs.flatMap(r => r.results);
  return { character, fights: results.length, wins: results.filter(r => r.won).length, rate: results.filter(r => r.won).length / results.length };
}).filter(r => r.fights);
const failures = rows.flatMap(r => r.results.filter(s => s.stalled || s.invalid).map(s => `${r.profile}/${r.route}/${s.seed}: invalid/stalled`));
if (process.argv.includes('--gate') && (rows.length !== 16 || seeds < 16)) failures.push('正式验收需要全部4角色、2组8路线，每组至少16种子');
if (process.argv.includes('--gate')) for (const r of summary) if (r.rate > .05) failures.push(`${r.character}: 胜率超过5%上限`);
const result = { note: '满血固定成熟18张牌，12张升级，初始+3章节+4普通来源遗物。两组8路线；同一启发式机器人（深度见depth、宽度4），不窥视抽牌堆。逐角色统计，非整局/真人胜率。', seeds, offset, depth, challenge: !process.argv.includes('--standard'), summary, failures, rows };
if (arg('--before')) {
  const before = JSON.parse(readFileSync(arg('--before')!, 'utf8'));
  if (before.seeds !== seeds || before.offset !== offset || before.depth !== depth || before.challenge !== result.challenge || JSON.stringify(before.rows.map((r: typeof rows[number]) => [r.profile,r.route,r.cards,r.relics])) !== JSON.stringify(rows.map(r => [r.profile,r.route,r.cards,r.relics]))) throw new Error('incompatible baseline');
  console.log('BEFORE', JSON.stringify(before.summary));
}
if (arg('--output')) writeFileSync(arg('--output')!, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ summary, failures }));
if (failures.length) process.exitCode = 1;
