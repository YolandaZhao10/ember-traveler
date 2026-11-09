import { playOptions } from './playOptions';
import { cardTransferEffect } from '../engine/cardTransfer';
import { CARDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { viewCard } from '../engine/cards';
import { aliveEnemies, canPlayCard, createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { makeRng } from '../engine/rng';
import type { CardInstance, CharacterId, CombatState } from '../engine/types';

/** 双方使用相同合法支持牌；不白送力量、失血、格挡或燃烧状态。 */
export const CARD_FLOOR_CASES = [
  { id: 'rune_shield', baseline: 'defend', support: ['meditate', 'focus'] },
  { id: 'charged_blade', baseline: 'strike', support: ['meditate', 'focus'] },
  { id: 'wildfire', baseline: 'strike', support: ['light_up', 'tend_coals'] },
  { id: 'coal_lance', baseline: 'strike', support: ['light_up', 'tend_coals'] },
  { id: 'overpower', baseline: 'strike', support: ['flex', 'inflame'] },
  { id: 'eye_for_eye', baseline: 'strike', support: ['blood_edge', 'blood_rite'] },
  { id: 'riposte', baseline: 'strike', support: ['raise_shield', 'iron_will'] },
  { id: 'chain_slash', baseline: 'strike', support: ['quick_stab', 'quick_stab'] },
  { id: 'scorch_mark', baseline: 'strike', support: ['light_up', 'tend_coals'] },
  { id: 'iron_rebuke', baseline: 'strike', support: ['raise_shield', 'iron_will'] },
  { id: 'spark_lure', baseline: 'strike', support: ['ignite', 'kindle'] },
  { id: 'thousand_cuts', baseline: 'strike', support: ['quick_stab', 'quick_stab'] },
] as const;

const ENCOUNTERS = [
  { id: 'single', enemies: ['tomb_puppet'] },
  { id: 'multiple', enemies: ['tomb_puppet', 'ash_rat'] },
] as const;
export const CARD_FLOOR_SEEDS = 10;

export interface FightResult {
  outcome: CombatState['outcome'];
  hpLost: number;
  turns: number;
  actions: number;
  cardsPlayed: number;
  replacementPlays: number;
  invalid: boolean;
}
export interface FightSummary {
  wins: number;
  losses: number;
  stalled: number;
  invalid: number;
  hpLost: number;
  turns: number;
  actions: number;
  cardsPlayed: number;
  replacementPlays: number;
}
export interface CardFloorRow {
  id: string;
  name: string;
  upgraded: boolean;
  encounter: string;
  baseline: string;
  support: readonly string[];
  replacementCount: number;
  candidate: FightSummary;
  control: FightSummary;
}

interface PlannedMove { uid: string; target: string | null; replayUid?: string }
// 玩家生命跨战斗保留；优先保存生命，而不是为少打一回合接受大量额外损血。
const HP_WEIGHT = 3;

/**
 * 用真实敌方回合评估当前回合的短计划，避免把条件效果统一当成“+1分”。
 * 未来收益只用于比较仍在进行的战斗；门槛始终按最终胜负、损血和回合统计。
 */
function turnValue(input: CombatState, knownUids: Set<string>, engines = false): number {
  let cs = input.outcome === 'ongoing' ? endPlayerTurn(input).state : input;
  for (const enemy of cs.enemies) {
    if (cs.outcome !== 'ongoing') break;
    cs = enemyAct(cs, enemy.id).state;
  }
  if (cs.outcome === 'won') return 100000 + cs.player.hp * HP_WEIGHT;
  if (cs.outcome === 'lost') return -100000;
  const p = cs.player;
  let future = (p.statuses.strength ?? 0) * 2 + (p.statuses.metallicize ?? 0) * 2 + (p.statuses.energyNext ?? 0) * 2;
  future += (p.statuses.regen ?? 0) * 2 + p.ember * 0.3;
  if (engines) {
    // 同一估值器用于旧牌与新牌，只按机制估值，不按牌名或版本加分。
    const weights = { comboFlow: 5, guardReserve: 0.7, ashInsight: 6, bloodDraw: 4, chargeMaster: 6,
      ashFeast: 2, kindling: 2, echo: 4, resonance: 9, mirror: 6, tempo: 6, crescendo: 3,
      study: 6, dexterity: 3, thorns: 2, pyre: 4, everburn: 5, arcaneWard: 3,
      bloodArmor: 2, bloodRage: 4, demonHeart: 5, forge: 3, emberHeart: 2, spentEmberDraw: 4, bloodOath: 4, recoveryArmor: 0.5, temperedMight: 3, furyWard: 0.5, vanguardCycle: 2, patientGuard: 0.8, emberConduit: 1.5, ashRecall: 1, burningRelay: 2, sparkCrown: 1.5, chargedEcho: 1.5, repriseStudy: 4, retainedWard: 1.5 };
    for (const [status, weight] of Object.entries(weights)) future += (p.statuses[status as keyof typeof weights] ?? 0) * weight;
  }
  // endPlayerTurn 已实际保留并蓄力；仅计一部分下回合潜力，不能用纸面蓄力掩盖当前失血。
  for (const card of p.hand.filter(card => knownUids.has(card.uid))) {
    const v = viewCard(card);
    future += 0.5 + Math.min(12, (v.bonus * (v.charge?.damage ?? 0)) + (v.bonus * (v.charge?.block ?? 0))) * 0.5;
  }
  // 未知抽牌只按张数估值，不能根据尚未抽到的牌名、类型或保留属性做决定。
  future += input.player.hand.filter(card => !knownUids.has(card.uid)).length * 0.5;
  for (const enemy of aliveEnemies(cs)) {
    const burn = enemy.statuses.burn ?? 0;
    future += Math.min(enemy.hp, burn + Math.max(0, burn - 1)) * 0.5;
    future -= (enemy.statuses.strength ?? 0) * 2;
  }
  return p.hp * HP_WEIGHT - aliveEnemies(cs).reduce((sum, enemy) => sum + enemy.hp, 0) + future;
}

/** 两方同一策略、无牌名分支。至多五次出牌，束宽六，保留立即结束回合的选项。 */
export function planMove(cs: CombatState, options = { depth: 5, width: 6, engines: false }): PlannedMove | null {
  const knownUids = new Set(cs.player.hand.map(card => card.uid));
  // 搜索过程中抽到的未知牌用普通占位牌表示，避免回合末诅咒/保留也泄露牌序。
  const hideUnknown = (state: CombatState, known: Set<string>): CombatState => ({ ...state, player: { ...state.player,
    hand: state.player.hand.map(card => known.has(card.uid) ? card : { uid: card.uid, defId: 'strike', upgraded: false }),
  } });
  let best = { score: turnValue(cs, knownUids, options.engines), first: null as PlannedMove | null };
  let beam = [{ state: cs, first: null as PlannedMove | null, score: best.score, known: knownUids }];
  for (let depth = 0; depth < options.depth && beam.length; depth++) {
    const next: typeof beam = [];
    for (const plan of beam) {
      if (plan.state.outcome !== 'ongoing') continue;
      const seen = new Set<string>();
      for (const card of plan.state.player.hand) {
        if (!plan.known.has(card.uid)) continue;
        const key = `${card.defId}:${card.upgraded}:${card.bonus ?? 0}`;
        if (seen.has(key) || !canPlayCard(plan.state, card).ok) continue;
        seen.add(key);
        for (const { target, replayUid } of playOptions(plan.state, card)) {
          const result = playCard(plan.state, card.uid, target, replayUid).state;
          if (result === plan.state) continue;
          // 已打出或离手的牌不再已知；即使搜索内洗回原 UID，也只能在真实抽到后重新规划。
          const handUids = new Set(result.player.hand.map(c => c.uid));
          const known = new Set([...plan.known].filter(uid => uid !== card.uid && handUids.has(uid)));
          // 玩家自己选回手中的牌是已知牌，可以继续规划；普通未知抽牌仍隐藏。
          if (cardTransferEffect(card)?.to === 'hand' && replayUid && handUids.has(replayUid)) known.add(replayUid);
          const state = hideUnknown(result, known);
          const score = turnValue(state, known, options.engines);
          const first = plan.first ?? { uid: card.uid, target, replayUid };
          if (score > best.score + 0.0001) best = { score, first };
          next.push({ state, first, score, known });
        }
      }
    }
    beam = next.sort((a, b) => b.score - a.score).slice(0, options.width);
  }
  return best.first;
}

function playFight(cs: CombatState, replacementCount: number): FightResult {
  const startingHp = cs.player.hp;
  let actions = 0, cardsPlayed = 0, replacementPlays = 0, invalid = false;
  while (cs.outcome === 'ongoing' && cs.turn <= 30 && actions++ < 240) {
    const move = planMove(cs);
    if (move) {
      const next = playCard(cs, move.uid, move.target, move.replayUid).state;
      if (next === cs) { invalid = true; break; }
      cs = next;
      cardsPlayed++;
      if (move.uid === 'bench-10' || (replacementCount === 2 && move.uid === 'bench-11')) replacementPlays++;
    } else {
      cs = endPlayerTurn(cs).state;
      for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
      if (cs.outcome === 'ongoing') cs = startPlayerTurn(cs).state;
    }
    if (!Number.isFinite(cs.player.hp) || !Number.isFinite(cs.player.energy) || cs.player.energy < 0) { invalid = true; break; }
  }
  return { outcome: cs.outcome, hpLost: startingHp - cs.player.hp, turns: cs.turn, actions, cardsPlayed, replacementPlays, invalid };
}

function summarize(results: FightResult[]): FightSummary {
  const average = (key: 'hpLost' | 'turns' | 'actions' | 'cardsPlayed' | 'replacementPlays') => results.reduce((sum, r) => sum + r[key], 0) / results.length;
  return {
    wins: results.filter(r => r.outcome === 'won').length,
    losses: results.filter(r => r.outcome === 'lost').length,
    stalled: results.filter(r => r.outcome === 'ongoing').length,
    invalid: results.filter(r => r.invalid).length,
    hpLost: average('hpLost'), turns: average('turns'), actions: average('actions'), cardsPlayed: average('cardsPlayed'), replacementPlays: average('replacementPlays'),
  };
}

/** 12 张牌；候选与基础对照替换位、升级、初始随机状态一致，后续由真实操作推进。 */
export function runCardFloorBenchmark(seedCount = CARD_FLOOR_SEEDS): CardFloorRow[] {
  if (!Number.isInteger(seedCount) || seedCount < 1) throw new Error('种子数量必须是正整数');
  const rows: CardFloorRow[] = [];
  for (const spec of CARD_FLOOR_CASES) for (const upgraded of [false, true]) for (const encounter of ENCOUNTERS) {
    const character: CharacterId = CARDS[spec.id].owner ?? 'traveler';
    const ch = CHARACTERS[character];
    // 符文护盾是学者初始牌，按正常初始数量仅替换一张；其余为两张奖励牌。
    const replacementCount = spec.id === 'rune_shield' ? 1 : 2;
    const simulate = (replacement: string) => Array.from({ length: seedCount }, (_, seed) => {
      const ids = ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', ...spec.support, replacement, replacementCount === 1 ? 'defend' : replacement];
      const deck: CardInstance[] = ids.map((defId, i) => ({ uid: `bench-${i}`, defId, upgraded: (i === 10 || (i === 11 && replacementCount === 2)) && upgraded }));
      const cs = createCombat(`floor-${encounter.id}`, [...encounter.enemies], 'normal', deck, ch.maxHp, ch.maxHp, [ch.starterRelic],
        makeRng(`CARD-FLOOR-${seed}`, 'combat'), 100, character, encounterDifficulty(4, 'normal')).state;
      return playFight(cs, replacementCount);
    });
    rows.push({ id: spec.id, name: CARDS[spec.id].name, upgraded, encounter: encounter.id, baseline: spec.baseline, support: spec.support, replacementCount,
      candidate: summarize(simulate(spec.id)), control: summarize(simulate(spec.baseline)) });
  }
  return rows;
}

/** 严重退化护栏；细致的伤害/格挡收益与上限由 cardFloor.test.ts 的真实结算验证。 */
export function cardFloorFailures(rows: CardFloorRow[]): string[] {
  const failures: string[] = [];
  for (const spec of CARD_FLOOR_CASES) {
    const group = rows.filter(r => r.id === spec.id);
    const variants = new Set(group.map(r => `${r.upgraded}:${r.encounter}`));
    if (group.length !== 4 || variants.size !== 4) failures.push(`${spec.id}: 缺少基础/升级及单/多敌对照`);
    for (const row of group) {
      const label = `${spec.id}${row.upgraded ? '+' : ''}/${row.encounter}`;
      const a = row.candidate, b = row.control;
      if (![...Object.values(a), ...Object.values(b)].every(Number.isFinite)) failures.push(`${label}: 非有限统计值`);
      if (a.stalled || b.stalled || a.invalid || b.invalid) failures.push(`${label}: 存在超时或非法状态`);
      if (a.wins < b.wins) failures.push(`${label}: 胜场低于基础牌对照`);
      // 一张基础防御与一个完整回合只作为严重退化界限，不是细致平衡已通过的证据。
      if (a.hpLost > b.hpLost + 5) failures.push(`${label}: 平均额外损血超过一张基础防御`);
      if (a.turns > b.turns + 1) failures.push(`${label}: 平均战斗延长超过一个回合`);
    }
  }
  return failures;
}

/** 保留最初的优势指标为诊断警示；速度与损血有取舍时不能强求同时领先。 */
export function cardFloorWarnings(rows: CardFloorRow[]): string[] {
  const warnings: string[] = [];
  for (const spec of CARD_FLOOR_CASES) for (const upgraded of [false, true]) {
    const advantage = rows.filter(r => r.id === spec.id && r.upgraded === upgraded).some(({ candidate: a, control: b }) =>
      a.wins > b.wins || (a.wins === b.wins && (a.hpLost <= b.hpLost - 1 || (a.hpLost <= b.hpLost && a.turns <= b.turns - 0.25))));
    if (!advantage) warnings.push(`${spec.id}${upgraded ? '+' : ''}: 未达到少损1生命或不多损血且快0.25回合的优势指标`);
  }
  return warnings;
}
