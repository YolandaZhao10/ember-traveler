import { CARD_LIST, CARDS, cardAvailableTo } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { difficultyPercent, normalizeDifficulty } from '../data/difficulty';
import { CHAPTERS, CHAPTER_RECOVERY, FINAL_CHAPTER, nextChapter, TOTAL_FLOORS } from '../data/chapters';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { EVENTS, EVENT_LIST } from '../data/events';
import { RELICS, relicPool, relicAvailableTo } from '../data/relics';
import { CHAPTER_RELICS } from '../data/chapterRelics';
import { EVENT_RELICS, SHOP_RELICS } from '../data/specialRelics';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn, stolenGold, type StepResult } from './combat';
import { availableNodes, generateMap, validateMap } from './map';
import { encounterDifficulty, rarityBias } from './difficulty';
import { chance, makeRng, nextInt, pick, shuffle, weightedPick } from './rng';
import type { CardInstance, CharacterId, CombatEvent, DifficultyLevel, EventOutcome, Rarity, RelicRarity, RelicJourneyRule, RunDifficulty, RunState, ShopState } from './types';

export const SAVE_VERSION = 12;

/** 数据定义新增字段不写入存档；计数沿用已保存的 turnFlags。 */
export function relicJourneyBonus(run: RunState, trigger: RelicJourneyRule['trigger'], kind: 'heal' | 'gold' | 'maxHp', tier?: RelicJourneyRule['tier']): number {
  return run.relics.reduce((total, id) => {
    const relic = RELICS[id];
    if (relic?.owner && relic.owner !== run.character) return total;
    return total + (relic?.journey ?? []).filter(r => r.trigger === trigger && (!r.tier || r.tier === tier))
      .reduce((sum, r) => sum + r.effects.filter(e => e.kind === kind).reduce((n, e) => n + e.amount, 0), 0);
  }, 0);
}

function applyJourneyHealth(run: RunState, trigger: RelicJourneyRule['trigger'], tier?: RelicJourneyRule['tier']) {
  run.maxHp += relicJourneyBonus(run, trigger, 'maxHp', tier);
  run.hp = Math.min(run.maxHp, run.hp + relicJourneyBonus(run, trigger, 'heal', tier));
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function recordCheckpoint(run: RunState): RunState {
  const { checkpoint: _previous, ...snapshot } = run;
  run.checkpoint = clone(snapshot);
  return run;
}

function uid(run: RunState): string {
  run.uidCounter += 1;
  return `d${run.uidCounter}`;
}

export function makeCard(run: RunState, defId: string, upgraded = false): CardInstance {
  return { uid: uid(run), defId, upgraded };
}

// ---------- 新局 ----------
export function newRun(seed: string, character: CharacterId = 'traveler', difficulty?: RunDifficulty): RunState {
  const ch = CHARACTERS[character];
  const run: RunState = {
    version: SAVE_VERSION,
    difficulty: normalizeDifficulty(difficulty),
    checkpoint: null,
    seed,
    character,
    rng: {
      map: makeRng(seed, 'map'),
      reward: makeRng(seed, 'reward'),
      combat: makeRng(seed, 'combat'),
      event: makeRng(seed, 'event'),
      shop: makeRng(seed, 'shop'),
    },
    screen: 'map',
    chapter: 1,
    map: { rows: 0, cols: 0, nodes: {}, startIds: [], bossId: 'boss' },
    currentNodeId: null,
    visited: [],
    floor: 0,
    hp: ch.maxHp,
    maxHp: ch.maxHp,
    gold: ch.gold,
    deck: [],
    relics: [ch.starterRelic],
    combat: null,
    reward: null,
    shop: null,
    event: null,
    rest: null,
    usedEvents: [],
    seenEncounters: [],
    stats: { floorsCleared: 0, enemiesKilled: 0, cardsPlayed: 0, damageDealt: 0, elitesKilled: 0 },
    uidCounter: 0,
    endMessage: null,
  };
  let map = generateMap(run.rng.map);
  let guard = 0;
  while (!validateMap(map) && guard++ < 20) map = generateMap(run.rng.map);
  run.map = map;
  run.deck = ch.starterDeck.map((id) => makeCard(run, id));
  return run;
}

// ---------- 地图 ----------
export function canTravelTo(run: RunState, nodeId: string): boolean {
  return run.screen === 'map' && availableNodes(run.map, run.currentNodeId).includes(nodeId);
}

export function travelTo(input: RunState, nodeId: string): RunState {
  if (!canTravelTo(input, nodeId)) return input;
  const run = clone(input);
  const node = run.map.nodes[nodeId];
  run.currentNodeId = nodeId;
  run.visited.push(nodeId);
  run.floor = CHAPTERS[run.chapter].startFloor + node.row;
  switch (node.type) {
    case 'combat':
      startEncounter(run, 'normal');
      break;
    case 'elite':
      startEncounter(run, 'elite');
      break;
    case 'boss':
      startEncounter(run, 'boss');
      break;
    case 'event':
      startEvent(run);
      break;
    case 'shop':
      run.shop = generateShop(run);
      run.screen = 'shop';
      break;
    case 'rest':
      run.rest = { used: false, picking: false };
      run.screen = 'rest';
      break;
  }
  return recordCheckpoint(run);
}

/** 回退节点或战后领奖阶段：包含牌组、奖励、统计、所有随机流，不能累积收益。 */
export function resetCurrentNode(run: RunState): RunState {
  const snapshot = ensureRewardCheckpoint(run).checkpoint;
  if (!snapshot || snapshot.chapter !== run.chapter || snapshot.currentNodeId !== run.currentNodeId) return run;
  return { ...clone(snapshot), checkpoint: clone(snapshot) };
}

/** 兼容更新前停留在领奖页的存档；保留现有进度，只补齐领奖前的回退点。 */
export function ensureRewardCheckpoint(input: RunState): RunState {
  if (input.screen !== 'reward' || !input.reward || input.checkpoint?.screen === 'reward') return input;
  const start = clone(input);
  const reward = start.reward!;
  if (reward.goldTaken) start.gold -= reward.gold;
  if (reward.cardTaken) {
    const ids = new Set(reward.cards.map((card) => card.uid));
    start.deck = start.deck.filter((card) => !ids.has(card.uid));
  }
  if (reward.relicTaken && reward.relic && start.relics.includes(reward.relic)) {
    start.relics = start.relics.filter((id) => id !== reward.relic);
    if (reward.relic === 'blood_charm') { start.maxHp -= 12; start.hp -= 12; }
  }
  reward.goldTaken = false;
  reward.cardTaken = false;
  reward.relicTaken = false;
  return { ...input, checkpoint: recordCheckpoint(start).checkpoint };
}

// ---------- 战斗 ----------
function startEncounter(run: RunState, tier: 'normal' | 'elite' | 'boss'): RunState {
  const localFloor = run.floor - CHAPTERS[run.chapter].startFloor;
  const pool = ENCOUNTERS.filter(
    (e) => (e.chapter ?? 1) === run.chapter && e.tier === tier && (e.minFloor === undefined || localFloor >= e.minFloor) && (e.maxFloor === undefined || localFloor <= e.maxFloor),
  );
  const fresh = pool.filter((e) => !run.seenEncounters.includes(e.id));
  const enc = pick(run.rng.combat, fresh.length ? fresh : pool);
  run.seenEncounters.push(enc.id);
  const res = createCombat(enc.id, enc.enemies, tier, run.deck, run.hp, run.maxHp, run.relics, run.rng.combat, run.uidCounter, run.character, encounterDifficulty(run.floor, tier, run.difficulty));
  run.rng.combat.s = res.state.rng.s;
  run.combat = res.state;
  run.screen = 'combat';
  return run;
}

function applyCombatStep(input: RunState, step: StepResult): { run: RunState; events: CombatEvent[] } {
  if (step.events.length === 0 && step.state === input.combat) return { run: input, events: [] };
  const run = clone(input);
  run.combat = step.state;
  run.rng.combat.s = step.state.rng.s;
  run.hp = step.state.player.hp;
  return { run, events: step.events };
}

export function combatPlayCard(run: RunState, cardUid: string, targetId: string | null) {
  if (!run.combat) return { run, events: [] as CombatEvent[] };
  const step = playCard(run.combat, cardUid, targetId);
  const out = applyCombatStep(run, step);
  if (out.events.length) {
    out.run.stats.cardsPlayed += 1;
    out.run.stats.damageDealt += step.events.filter((e) => e.type === 'damage' && e.source === 'player').reduce((s, e) => s + (e.type === 'damage' ? e.amount : 0), 0);
  }
  return out;
}

export function combatEndTurn(run: RunState) {
  if (!run.combat) return { run, events: [] as CombatEvent[] };
  return applyCombatStep(run, endPlayerTurn(run.combat));
}

export function combatEnemyAct(run: RunState, enemyId: string) {
  if (!run.combat) return { run, events: [] as CombatEvent[] };
  return applyCombatStep(run, enemyAct(run.combat, enemyId));
}

export function combatStartTurn(run: RunState) {
  if (!run.combat) return { run, events: [] as CombatEvent[] };
  return applyCombatStep(run, startPlayerTurn(run.combat));
}

/** 战斗结束 → 奖励 / 死亡 / 通关 */
/** 基础金币按战斗类型固定区间；难度倍率仍生效，SL 不重掷。 */
export function combatGoldRange(_floor: number, tier: 'normal' | 'elite' | 'boss', level: DifficultyLevel = 'normal'): [number, number] {
  const [low, high] = tier === 'boss' ? [75, 75] : tier === 'elite' ? [20, 30] : [15, 20];
  const multiplier = difficultyPercent('gold', level) / 100;
  return [Math.round(low * multiplier), Math.round(high * multiplier)];
}

export function finishCombat(input: RunState): RunState {
  const cs = input.combat;
  if (!cs || cs.outcome === 'ongoing') return input;
  const run = clone(input);
  run.hp = cs.player.hp;
  run.uidCounter = Math.max(run.uidCounter, cs.uidCounter);
  if (cs.outcome === 'lost') {
    run.screen = 'gameover';
    run.endMessage = `你在第 ${run.floor + 1} 层倒下，火种熄灭了。`;
    run.combat = null;
    return run;
  }
  run.stats.enemiesKilled += cs.enemies.length;
  if (cs.tier === 'elite') run.stats.elitesKilled += 1;
  run.stats.floorsCleared += 1;
  // 战斗中新增的牌（如诅咒）不会进入牌组——仅战斗内有效
  if (run.relics.includes('canteen')) run.hp = Math.min(run.maxHp, run.hp + 6);
  if (run.relics.includes('red_vial') && cs.player.selfHpLost > 0) run.hp = Math.min(run.maxHp, run.hp + Math.floor(cs.player.selfHpLost / 2));
  const stolen = stolenGold(cs);
  if (stolen) run.gold = Math.max(0, run.gold - stolen);
  applyJourneyHealth(run, 'victory', cs.tier);
  const bonusGold = relicJourneyBonus(run, 'victory', 'gold', cs.tier);
  if (cs.tier === 'boss') {
    return chapterBossReward(run);
  }
  const gold = nextInt(run.rng.reward, ...combatGoldRange(run.floor, cs.tier, run.difficulty.gold)) + (run.relics.includes('coin_purse') ? 5 : 0) + bonusGold;
  run.reward = {
    gold,
    goldTaken: false,
    cards: generateCardChoices(run, cs.tier === 'elite' ? 'elite' : 'normal', 3),
    cardTaken: false,
    relic: cs.tier === 'elite' ? pickRelic(run) : null,
    relicTaken: false,
  };
  run.combat = null;
  run.screen = 'reward';
  return recordCheckpoint(run);
}

/** 已完成第一章的胜利结算使用同一奖励流程，不重复计算战斗收益。 */
function chapterBossReward(run: RunState): RunState {
  run.combat = null;
  run.screen = 'reward';
  run.endMessage = null;
  run.reward = {
    gold: nextInt(run.rng.reward, ...combatGoldRange(run.floor, 'boss', run.difficulty.gold)) + relicJourneyBonus(run, 'victory', 'gold', 'boss'), goldTaken: false,
    cards: generateCardChoices(run, 'boss', 3), cardTaken: false,
    relic: null, relicTaken: false,
    relicChoices: shuffle(run.rng.reward, CHAPTER_RELICS.filter(r => r.chapter === run.chapter && !run.relics.includes(r.id))).slice(0, 3).map(r => r.id),
    chapterComplete: run.chapter,
  };
  return recordCheckpoint(run);
}

/** v4/v5 的结局现在是第一章通关；保留现有牌组与统计，补上过章奖励。 */
export function resumeLegacyVictory(input: RunState): RunState {
  if (input.chapter !== 1 || input.screen !== 'victory') return input;
  return chapterBossReward(clone(input));
}

export function enterNextChapter(input: RunState): RunState {
  const next = nextChapter(input.chapter);
  if (input.screen !== 'chapter' || !next) return input;
  const run = clone(input);
  run.chapter = next;
  run.map = generateMap(run.rng.map, next);
  run.currentNodeId = null;
  run.visited = [];
  run.floor = CHAPTERS[next].startFloor;
  run.hp = Math.min(run.maxHp, run.hp + Math.ceil(run.maxHp * CHAPTER_RECOVERY));
  run.combat = null;
  run.reward = null;
  run.shop = null;
  run.event = null;
  run.rest = null;
  run.endMessage = null;
  run.screen = 'map';
  // 新章独立回退点，不能通过 SL 反复领取过章恢复或返回上一章。
  return recordCheckpoint(run);
}

function pickRelic(run: RunState, rarity?: 'common' | 'uncommon' | 'rare'): string | null {
  const pool = relicPool(run.relics, run.character, rarity);
  if (!pool.length) return null;
  const weights = relicRarityWeights(run.floor, run.difficulty.relicRarity);
  const selected = rarity ?? weightedPick(run.rng.reward, (['common', 'uncommon', 'rare'] as const)
    .filter(tier => pool.some(r => r.rarity === tier)).map(item => ({ item, weight: weights[item] })));
  return pick(run.rng.reward, pool.filter(r => r.rarity === selected)).id;
}

/** 精英与随机事件先抽稀有度再抽遗物，不受各角色可用遗物数量影响。 */
export function relicRarityWeights(floor: number, level: DifficultyLevel = 'normal'): Record<'common' | 'uncommon' | 'rare', number> {
  const progress = Math.max(0, Math.min(1, floor / (TOTAL_FLOORS - 1)));
  const weights = { common: (60 - 40 * progress) * rarityBias('common', level), uncommon: (35 + 5 * progress) * rarityBias('uncommon', level), rare: (5 + 35 * progress) * rarityBias('rare', level) };
  const total = weights.common + weights.uncommon + weights.rare;
  return { common: weights.common / total * 100, uncommon: weights.uncommon / total * 100, rare: weights.rare / total * 100 };
}

export type CardRewardTier = 'normal' | 'elite' | 'shop' | 'boss';
/** 整局楼层从 0 开始，连续线性提升稀有度；首领始终为稀有牌。 */
export function cardRarityWeights(floor: number, tier: CardRewardTier, level: DifficultyLevel = 'normal'): Record<'common' | 'uncommon' | 'rare', number> {
  if (tier === 'boss') return { common: 0, uncommon: 0, rare: 100 };
  const progress = Math.max(0, Math.min(1, floor / (TOTAL_FLOORS - 1)));
  const [start, end] = tier === 'elite' ? [[60, 35, 5], [15, 40, 45]]
    : tier === 'shop' ? [[40, 42, 18], [20, 40, 40]] : [[70, 29, 1], [25, 45, 30]];
  const common = start[0] + (end[0] - start[0]) * progress;
  const rare = start[2] + (end[2] - start[2]) * progress;
  const weights = { common, uncommon: 100 - common - rare, rare };
  if (level === 'normal') return weights;
  for (const key of ['common', 'uncommon', 'rare'] as const) weights[key] *= rarityBias(key, level);
  const total = weights.common + weights.uncommon + weights.rare;
  for (const key of ['common', 'uncommon', 'rare'] as const) weights[key] = weights[key] / total * 100;
  return weights;
}

export function generateCardChoices(run: RunState, tier: CardRewardTier, n: number): CardInstance[] {
  const weights = cardRarityWeights(run.floor, tier, run.difficulty.cardRarity);
  const chosen: string[] = [];
  let guard = 0;
  while (chosen.length < n && guard++ < 100) {
    const r = weightedPick(run.rng.reward, (['common', 'uncommon', 'rare'] as const).map((k) => ({ item: k, weight: weights[k] })));
    const pool = CARD_LIST.filter((c) => c.rarity === r && !chosen.includes(c.id) && (tier === 'boss' ? c.owner === run.character : cardAvailableTo(c, run.character)));
    if (!pool.length) continue;
    chosen.push(pick(run.rng.reward, pool).id);
  }
  return chosen.map((id) => makeCard(run, id));
}

// ---------- 奖励 ----------
export function rewardTakeGold(input: RunState): RunState {
  if (!input.reward || input.reward.goldTaken) return input;
  const run = clone(input);
  run.gold += run.reward!.gold;
  run.reward!.goldTaken = true;
  return run;
}
export function rewardTakeCard(input: RunState, cardUid: string): RunState {
  if (!input.reward || input.reward.cardTaken) return input;
  const card = input.reward.cards.find((c) => c.uid === cardUid);
  if (!card) return input;
  const run = clone(input);
  run.deck.push(card);
  run.reward!.cardTaken = true;
  return run;
}
export function rewardSkipCard(input: RunState): RunState {
  if (!input.reward || input.reward.cardTaken) return input;
  const run = clone(input);
  run.reward!.cardTaken = true;
  return run;
}
export function rewardTakeRelic(input: RunState, relicId?: string): RunState {
  if (!input.reward || input.reward.relicTaken) return input;
  const choices = input.reward.relicChoices;
  const selected = choices?.length ? relicId && choices.includes(relicId) ? relicId : null : input.reward.relic;
  if (!selected || !RELICS[selected] || (RELICS[selected].owner && RELICS[selected].owner !== input.character) || input.relics.includes(selected)) return input;
  const run = clone(input);
  addRelic(run, selected);
  run.reward!.relic = selected;
  run.reward!.relicTaken = true;
  return run;
}
export function rewardLeave(input: RunState): RunState {
  if (input.screen !== 'reward') return input;
  if (input.reward?.relicChoices?.length && !input.reward.relicTaken) return input;
  let run = ensureRewardCheckpoint(input);
  if (run.reward && !run.reward.goldTaken) run = rewardTakeGold(run);
  if (run.reward && run.reward.relic && !run.reward.relicTaken) run = rewardTakeRelic(run);
  run = clone(run);
  const completed = run.reward?.chapterComplete ?? (run.currentNodeId && run.map.nodes[run.currentNodeId]?.type === 'boss' ? run.chapter : null);
  const bossGold = run.reward?.gold ?? 0;
  run.reward = null;
  run.screen = completed === FINAL_CHAPTER ? 'victory' : completed ? 'chapter' : 'map';
  if (completed === FINAL_CHAPTER) run.endMessage = `无昼之主终于倒下。你走过灰烬古城、熔炉深城与星骸天穹，在余火终庭点亮了黎明。${TOTAL_FLOORS} 层旅程完成。首领战利品：${bossGold} 金币。`;
  return run;
}

export function addRelic(run: RunState, relicId: string) {
  const relic = RELICS[relicId];
  if (!relic || (relic.owner && relic.owner !== run.character) || run.relics.includes(relicId)) return;
  run.relics.push(relicId);
  if (relicId === 'blood_charm') {
    run.maxHp += 12;
    run.hp = Math.min(run.maxHp, run.hp + 12);
  }
  for (const rule of relic.journey ?? []) if (rule.trigger === 'obtain') {
    for (const effect of rule.effects) {
      if (effect.kind === 'maxHp') run.maxHp += effect.amount;
      if (effect.kind === 'heal') run.hp = Math.min(run.maxHp, run.hp + effect.amount);
      if (effect.kind === 'gold') run.gold += effect.amount;
    }
  }
}

// ---------- 商店 ----------
const BASE_CARD_PRICES: Record<Rarity, [number, number]> = { common: [45, 55], uncommon: [70, 80], rare: [120, 150], starter: [30, 30], curse: [0, 0] };
const BASE_RELIC_PRICES: Record<RelicRarity, [number, number]> = { common: [150, 180], uncommon: [200, 250], rare: [280, 300], starter: [0, 0] };
export function relicShopPriceRange(run: RunState, rarity: RelicRarity): [number, number] {
  const [low, high] = BASE_RELIC_PRICES[rarity];
  const mul = run.shop?.priceMultiplier ?? priceMul(run);
  return [Math.round(low * mul), Math.round(high * mul)];
}
export function cardShopPriceRange(run: RunState, rarity: Rarity): [number, number] {
  const [low, high] = BASE_CARD_PRICES[rarity];
  const mul = run.shop?.priceMultiplier ?? priceMul(run);
  return [Math.round(low * mul), Math.round(high * mul)];
}
function priceMul(run: RunState) {
  return run.relics.includes('merchant_scale') ? 0.75 : 1;
}
function generateShop(run: RunState): ShopState {
  const cards = generateCardChoices(run, 'shop', 10);
  const special = SHOP_RELICS.filter(r => !run.relics.includes(r.id));
  const relicIds: string[] = special.length ? [pick(run.rng.shop, special).id] : [];
  for (let i = relicIds.length; i < 6; i++) {
    const pool = relicPool([...run.relics, ...relicIds], run.character);
    if (pool.length) relicIds.push(weightedPick(run.rng.shop, pool.map(r => ({ item: r.id, weight: rarityBias(r.rarity, run.difficulty.relicRarity) }))));
  }
  const mul = priceMul(run);
  return {
    priceMultiplier: mul,
    discounted: run.relics.includes('merchant_scale'),
    cards: cards.map((card) => ({
      card,
      price: Math.round(nextInt(run.rng.shop, ...BASE_CARD_PRICES[CARDS[card.defId].rarity]) * mul),
      sold: false,
    })),
    relics: relicIds.map((id) => ({
      relicId: id,
      price: Math.round(nextInt(run.rng.shop, ...BASE_RELIC_PRICES[RELICS[id].rarity]) * mul),
      sold: false,
    })),
    removePrice: Math.round(75 * mul),
    removeUsed: false,
  };
}
export function shopBuyCard(input: RunState, index: number): RunState {
  const item = input.shop?.cards[index];
  if (!item || item.sold || input.gold < item.price) return input;
  const run = clone(input);
  run.gold -= item.price;
  run.shop!.cards[index].sold = true;
  run.deck.push(item.card);
  applyJourneyHealth(run, 'purchase');
  run.gold += relicJourneyBonus(run, 'purchase', 'gold');
  return run;
}
export function shopBuyRelic(input: RunState, index: number): RunState {
  const item = input.shop?.relics[index];
  if (!item || item.sold || input.gold < item.price || !RELICS[item.relicId] || !relicAvailableTo(RELICS[item.relicId], input.character) || input.relics.includes(item.relicId)) return input;
  const run = clone(input);
  run.gold -= item.price;
  run.shop!.relics[index].sold = true;
  // 先结算已持有的交易遗物，买入的遗物从下一笔交易开始生效。
  applyJourneyHealth(run, 'purchase');
  run.gold += relicJourneyBonus(run, 'purchase', 'gold');
  addRelic(run, item.relicId);
  return run;
}
export function shopRemoveCard(input: RunState, cardUid: string): RunState {
  const s = input.shop;
  if (!s || s.removeUsed || input.gold < s.removePrice) return input;
  if (!input.deck.some((c) => c.uid === cardUid)) return input;
  const run = clone(input);
  run.gold -= s.removePrice;
  run.shop!.removeUsed = true;
  run.deck = run.deck.filter((c) => c.uid !== cardUid);
  applyJourneyHealth(run, 'remove');
  run.gold += relicJourneyBonus(run, 'remove', 'gold');
  return run;
}
export function shopLeave(input: RunState): RunState {
  if (input.screen !== 'shop') return input;
  const run = clone(input);
  run.shop = null;
  run.screen = 'map';
  return run;
}

// ---------- 营火 ----------
export function restHealAmount(run: RunState): number {
  return Math.min(run.maxHp + relicJourneyBonus(run, 'rest', 'maxHp') - run.hp, Math.floor(run.maxHp * 0.3) + (run.relics.includes('ration_pack') ? 5 : 0) + relicJourneyBonus(run, 'rest', 'heal'));
}

export function restUpgradeHealAmount(run: RunState): number {
  return Math.min(run.maxHp + relicJourneyBonus(run, 'upgrade', 'maxHp') - run.hp, (run.relics.includes('pilgrim_seal') ? 5 : 0) + relicJourneyBonus(run, 'upgrade', 'heal'));
}

export function restHeal(input: RunState): RunState {
  if (!input.rest || input.rest.used) return input;
  const run = clone(input);
  const heal = restHealAmount(run);
  run.maxHp += relicJourneyBonus(run, 'rest', 'maxHp');
  run.hp += heal;
  run.gold += relicJourneyBonus(run, 'rest', 'gold');
  run.rest!.used = true;
  return run;
}
export function restStartUpgrade(input: RunState): RunState {
  if (!input.rest || input.rest.used) return input;
  const run = clone(input);
  run.rest!.picking = true;
  return run;
}
export function restCancelUpgrade(input: RunState): RunState {
  if (!input.rest) return input;
  const run = clone(input);
  run.rest!.picking = false;
  return run;
}
export function restUpgrade(input: RunState, cardUid: string): RunState {
  if (!input.rest || input.rest.used) return input;
  const run = clone(input);
  const card = run.deck.find((c) => c.uid === cardUid);
  if (!card || card.upgraded || CARDS[card.defId].type === 'curse') return input;
  card.upgraded = true;
  const heal = restUpgradeHealAmount(run);
  run.maxHp += relicJourneyBonus(run, 'upgrade', 'maxHp');
  run.hp += heal;
  run.gold += relicJourneyBonus(run, 'upgrade', 'gold');
  run.rest!.used = true;
  run.rest!.picking = false;
  return run;
}
export function restLeave(input: RunState): RunState {
  if (input.screen !== 'rest') return input;
  const run = clone(input);
  run.rest = null;
  run.screen = 'map';
  return run;
}

export function canUpgrade(card: CardInstance): boolean {
  return !card.upgraded && CARDS[card.defId].type !== 'curse';
}

// ---------- 事件 ----------
/** 随机遗物事件有25%机会发现问号专属；池耗尽后回到常规池。 */
function pickEventRelic(run: RunState): string | null {
  const special = EVENT_RELICS.filter(r => !run.relics.includes(r.id) && relicAvailableTo(r, run.character));
  if (special.length && (!relicPool(run.relics, run.character).length || chance(run.rng.event, 0.25))) return pick(run.rng.event, special).id;
  return pickRelic(run);
}

function startEvent(run: RunState): RunState {
  const pool = EVENT_LIST.filter((e) => (e.chapter ?? 1) === run.chapter);
  // 先抽未见事件；耗尽后按出现次数轮换，且不连续遇到同一事件。
  const counts = new Map<string, number>();
  for (const id of run.usedEvents) counts.set(id, (counts.get(id) ?? 0) + 1);
  const last = run.usedEvents[run.usedEvents.length - 1];
  const candidates = pool.length > 1 ? pool.filter(e => e.id !== last) : pool;
  const least = Math.min(...candidates.map(e => counts.get(e.id) ?? 0));
  const ev = pick(run.rng.event, candidates.filter(e => (counts.get(e.id) ?? 0) === least));
  run.usedEvents.push(ev.id);
  run.event = { eventId: ev.id, resolvedText: null, pendingPick: null, done: false };
  run.screen = 'event';
  return run;
}

function eventOutcomes(outcomes: EventOutcome[]): EventOutcome[] {
  return outcomes.flatMap(o => o.kind === 'chance' ? [o, ...eventOutcomes(o.success), ...eventOutcomes(o.fail)] : [o]);
}

export function eventChoiceUnavailableReason(run: RunState, choiceId: string): string | null {
  const ev = run.event && EVENTS[run.event.eventId];
  const ch = ev?.choices.find(c => c.id === choiceId);
  if (!ch) return '选项不存在';
  if (ch.requireGold && run.gold < ch.requireGold) return `需要 ${ch.requireGold} 金币`;
  if (ch.requireHp && run.hp < ch.requireHp) return `至少需要 ${ch.requireHp} 点生命`;
  const outcomes = eventOutcomes(ch.outcomes);
  if (outcomes.some(o => o.kind === 'upgradeCard') && !run.deck.some(canUpgrade)) return '没有可升级的卡牌';
  if (outcomes.some(o => o.kind === 'removeCard') && !run.deck.length) return '没有可移除的卡牌';
  return null;
}

export function eventChoiceAvailable(run: RunState, choiceId: string): boolean {
  return eventChoiceUnavailableReason(run, choiceId) === null;
}

/** 专属奖励的替代规则在支付代价前告知玩家。 */
export function eventRelicChoiceNote(run: RunState, choiceId: string): string | null {
  const choice = run.event && EVENTS[run.event.eventId]?.choices.find(c => c.id === choiceId);
  const gifts = choice ? eventOutcomes(choice.outcomes).filter(o => o.kind === 'eventRelic') : [];
  if (!gifts.length) return null;
  if (EVENT_RELICS.every(r => run.relics.includes(r.id))) return '问号专属已集齐：该遗物奖励改为 50 金币。';
  if (gifts.some(o => o.relicId && run.relics.includes(o.relicId))) return '已拥有此遗物：改为随机一件未持有的问号专属遗物。';
  return null;
}

export interface EventRelicPreview { name: string; description: string; icon: string; probability: number }

/** 只读规则说明，不提前抽取随机结果，也不消耗事件或奖励随机流。 */
export function eventRelicPreviews(run: RunState, choiceId: string): EventRelicPreview[] {
  const choice = run.event && EVENTS[run.event.eventId]?.choices.find(c => c.id === choiceId);
  const previews: EventRelicPreview[] = [];
  const walk = (outcomes: EventOutcome[], probability = 1) => {
    for (const outcome of outcomes) {
      if (outcome.kind === 'chance') {
        walk(outcome.success, probability * outcome.p);
        walk(outcome.fail, probability * (1 - outcome.p));
      } else if (probability > 0 && (outcome.kind === 'relic' || outcome.kind === 'eventRelic')) {
        const eventPool = EVENT_RELICS.filter(r => !run.relics.includes(r.id) && relicAvailableTo(r, run.character));
        const specified = outcome.relicId ? RELICS[outcome.relicId] : undefined;
        const fixed = specified && !run.relics.includes(specified.id) && relicAvailableTo(specified, run.character)
          && (outcome.kind === 'relic' || eventPool.includes(specified)) ? specified : undefined;
        const pool = outcome.kind === 'eventRelic' ? eventPool : [...eventPool, ...relicPool(run.relics, run.character)];
        const known = fixed ?? (pool.length === 1 ? pool[0] : undefined);
        previews.push(known ? { name: known.name, description: known.description, icon: known.icon, probability }
          : pool.length ? { name: outcome.kind === 'eventRelic' ? '随机问号专属遗物' : '随机遗物', icon: '🎁', probability,
            description: outcome.kind === 'eventRelic' ? '从尚未持有的问号专属遗物中随机获得一件，具体效果在获得后揭晓。' : '从可获得的常规或问号专属遗物中随机获得一件，具体效果在获得后揭晓。' }
          : { name: '50 金币', icon: '🪙', probability, description: '可获得的遗物已集齐，此次遗物奖励改为 50 金币。' });
      }
    }
  };
  if (choice) walk(choice.outcomes);
  return previews;
}

export function eventChoose(input: RunState, choiceId: string): RunState {
  if (!input.event || input.event.done || input.event.resolvedText !== null) return input;
  if (!eventChoiceAvailable(input, choiceId)) return input;
  const run = clone(input);
  const ev = EVENTS[run.event!.eventId];
  const ch = ev.choices.find((c) => c.id === choiceId)!;
  const texts: string[] = [];
  applyOutcomes(run, ch.outcomes, texts);
  run.event!.resolvedText = texts.length ? texts.join(' ') : '你转身离开。';
  if (!run.event!.pendingPick) run.event!.done = true;
  if (run.hp <= 0) {
    run.screen = 'gameover';
    run.endMessage = '你在一次草率的决定中失去了最后的火种。';
    run.event = null;
  }
  return run;
}

function applyOutcomes(run: RunState, outcomes: EventOutcome[], texts: string[]) {
  for (const o of outcomes) {
    switch (o.kind) {
      case 'hp':
        if (o.amount < 0) {
          run.hp = Math.max(0, run.hp + o.amount);
          texts.push(`失去 ${-o.amount} 点生命。`);
        } else {
          const before = run.hp;
          run.hp = Math.min(run.maxHp, run.hp + o.amount);
          texts.push(`回复 ${run.hp - before} 点生命。`);
        }
        break;
      case 'maxHp':
        run.maxHp = Math.max(1, run.maxHp + o.amount);
        run.hp = Math.min(run.hp, run.maxHp);
        texts.push(`最大生命 ${o.amount > 0 ? '+' : ''}${o.amount}。`);
        break;
      case 'gold':
        run.gold = Math.max(0, run.gold + o.amount);
        texts.push(o.amount >= 0 ? `获得 ${o.amount} 金币。` : `支付 ${-o.amount} 金币。`);
        break;
      case 'relic': {
        const id = o.relicId && RELICS[o.relicId] && relicAvailableTo(RELICS[o.relicId], run.character) && !run.relics.includes(o.relicId) ? o.relicId : pickEventRelic(run);
        if (id) {
          addRelic(run, id);
          texts.push(`获得遗物「${RELICS[id].name}」。`);
        } else {
          run.gold += 50;
          texts.push('没有可获得的遗物，改为获得 50 金币。');
        }
        break;
      }
      case 'eventRelic': {
        const pool = EVENT_RELICS.filter(r => !run.relics.includes(r.id) && relicAvailableTo(r, run.character));
        const relic = pool.find(r => r.id === o.relicId) ?? (pool.length ? pick(run.rng.event, pool) : null);
        if (relic) {
          addRelic(run, relic.id);
          texts.push(`获得问号专属遗物「${relic.name}」。`);
        } else {
          run.gold += 50;
          texts.push('问号专属遗物已全部获得，改为获得 50 金币。');
        }
        break;
      }
      case 'card': {
        let defId = o.cardId;
        if (!defId) {
          const weights = cardRarityWeights(run.floor, 'normal', run.difficulty.cardRarity);
          const rarity = o.rarity ?? weightedPick(run.rng.event, (['common', 'uncommon', 'rare'] as const).map(item => ({ item, weight: weights[item] })));
          const pool = CARD_LIST.filter(c => cardAvailableTo(c, run.character) && c.rarity === rarity);
          defId = pick(run.rng.event, pool).id;
        }
        run.deck.push(makeCard(run, defId));
        texts.push(`获得卡牌「${CARDS[defId].name}」。`);
        break;
      }
      case 'curse':
        run.deck.push(makeCard(run, o.cardId));
        texts.push(`「${CARDS[o.cardId].name}」混入了你的牌组。`);
        break;
      case 'removeCard':
        run.event!.pendingPick = 'remove';
        texts.push('选择一张要移除的牌。');
        break;
      case 'upgradeCard':
        run.event!.pendingPick = 'upgrade';
        texts.push('选择一张要升级的牌。');
        break;
      case 'chance': {
        const ok = chance(run.rng.event, o.p);
        texts.push(ok ? o.successText : o.failText);
        applyOutcomes(run, ok ? o.success : o.fail, texts);
        break;
      }
    }
  }
}

export function eventPickCard(input: RunState, cardUid: string): RunState {
  const ev = input.event;
  if (!ev || !ev.pendingPick) return input;
  const run = clone(input);
  const card = run.deck.find((c) => c.uid === cardUid);
  if (!card) return input;
  if (ev.pendingPick === 'remove') {
    run.deck = run.deck.filter((c) => c.uid !== cardUid);
    run.event!.resolvedText += ` 移除了「${CARDS[card.defId].name}」。`;
  } else {
    if (!canUpgrade(card)) return input;
    card.upgraded = true;
    run.event!.resolvedText += ` 升级了「${CARDS[card.defId].name}」。`;
  }
  run.event!.pendingPick = null;
  run.event!.done = true;
  return run;
}

export function eventLeave(input: RunState): RunState {
  if (input.screen !== 'event' || !input.event) return input;
  // 未做选择直接离开 = 选择“离开”
  const run = clone(input);
  run.event = null;
  run.screen = 'map';
  return run;
}

// ---------- 工具 ----------
export function sortedDeck(deck: CardInstance[]): CardInstance[] {
  const order: Record<string, number> = { attack: 0, skill: 1, power: 2, curse: 3 };
  return deck.slice().sort((a, b) => {
      const da = CARDS[a.defId];
      const db = CARDS[b.defId];
      if (order[da.type] !== order[db.type]) return order[da.type] - order[db.type];
      if (da.cost !== db.cost) return da.cost - db.cost;
      return da.name.localeCompare(db.name, 'zh');
    });
}

export function enemyName(defId: string): string {
  return ENEMIES[defId]?.name ?? defId;
}
