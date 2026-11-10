import { convertResource, conversionText } from './resourceConversion';
import { cardTransferChoices, cardTransferEffect, type CardTransfer } from './cardTransfer';
import { CARDS } from '../data/cards';
import { ENEMIES } from '../data/enemies';
import { STATUSES } from '../data/statuses';
import { RELICS } from '../data/relics';
import { RELIC_TUNING as T } from '../data/relicBalance';
import { calcBlock, calcDamage, checkCondition, viewCard, type CardView } from './cards';
import { scaleEnemyValue } from './difficulty';
import { ensurePowerInstances } from './powers';
import { BLOCK_MAX, EMBER_MAX, clampCharge } from './constants';
import { nextInt, pick, shuffle, type RngState } from './rng';
import type {
  CardInstance,
  CharacterId,
  CombatEvent,
  CombatDifficulty,
  CombatState,
  Effect,
  EnemyAction,
  EnemyMove,
  EnemyState,
  Entity,
  Intent,
  PlayerCombat,
  RelicCombatTrigger,
  RelicCondition,
  StatusId,
  Statuses,
} from './types';

export { EMBER_MAX } from './constants';
export { BLOCK_MAX } from './constants';
export const HAND_MAX = 10;

function relicProc(cs: CombatState, relicId: string, ev: CombatEvent[]) {
  ev.push({ type: 'relic', relicId });
  log(cs, ev, `${RELICS[relicId].name}触发`);
}

export interface StepResult {
  state: CombatState;
  events: CombatEvent[];
}

// ---------- 工具 ----------
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function log(cs: CombatState, ev: CombatEvent[], text: string) {
  cs.log.push(text);
  if (cs.log.length > 80) cs.log.shift();
  ev.push({ type: 'log', text });
}

function addStatus(entity: Entity, status: StatusId, amount: number, ev: CombatEvent[]) {
  if (amount === 0) return;
  if ('hand' in entity && amount > 0 && (status === 'tempo' || status === 'flameAura' || status === 'mirror')) {
    ensurePowerInstances(entity as PlayerCombat).push({ status, amount, progress: 0 });
  }
  const cur = entity.statuses[status] ?? 0;
  let next = cur + amount;
  if (status === 'barricade') next = Math.min(1, next);
  if (next <= 0 && status !== 'strength' && status !== 'dexterity') {
    delete entity.statuses[status];
  } else {
    entity.statuses[status] = next;
  }
  ev.push({ type: 'status', targetId: entity.id, status, amount });
}

function alive(e: Entity) {
  return e.hp > 0;
}

export function aliveEnemies(cs: CombatState): EnemyState[] {
  return cs.enemies.filter(alive);
}

/** 同一份持久化额度用于结算、血条和敌人详情。 */
export function enemyDamageGuard(enemy: EnemyState) {
  const guard = enemy.damageGuard;
  return guard ? { ...guard, remaining: Math.max(0, guard.limit - guard.lost) } : null;
}

/** 对实体造成伤害（经过格挡）。返回实际损失生命。 */
function dealDamage(
  cs: CombatState,
  target: Entity,
  amount: number,
  ev: CombatEvent[],
  source: 'player' | 'enemy' | 'thorns' | 'burn' | 'aura',
  ignoreBlock = false,
): number {
  let blocked = 0;
  let remaining = Math.max(0, amount);
  if (!ignoreBlock && target.block > 0) {
    blocked = Math.min(target.block, remaining);
    target.block -= blocked;
    remaining -= blocked;
  }
  const guard = 'defId' in target ? (target as EnemyState).damageGuard : undefined;
  // 超过剩余生命的部分不算屏障减伤，避免正常击杀也提示承伤已满。
  remaining = Math.min(target.hp, remaining);
  const prevented = guard ? Math.max(0, remaining - Math.max(0, guard.limit - guard.lost)) : 0;
  remaining -= prevented;
  const before = target.hp;
  target.hp = Math.max(0, target.hp - remaining);
  const lost = before - target.hp;
  if (guard) guard.lost += lost;
  ev.push({ type: 'damage', targetId: target.id, amount: lost, blocked, source, ...(prevented > 0 ? { prevented } : {}) });
  if (prevented > 0) log(cs, ev, `${target.name} 的永夜屏障抵消 ${prevented} 点伤害，本回合承伤已达上限`);
  if (target.hp === 0) ev.push({ type: 'death', targetId: target.id });
  if (target.id === 'player' && lost > 0 && target.hp > 0 && target.statuses.bloodArmor) {
    gainBlock(target, target.statuses.bloodArmor, ev, cs);
    log(cs, ev, `血甲：获得 ${target.statuses.bloodArmor} 点格挡`);
  }
  return lost;
}

/** 所有战斗治疗按实际回复量触发回生甲；零治疗、过量治疗与死亡均不能刷甲。 */
function healPlayer(cs: CombatState, amount: number, ev: CombatEvent[]): number {
  const p = cs.player;
  if (p.hp <= 0) return 0;
  const healed = Math.max(0, Math.min(amount, p.maxHp - p.hp));
  p.hp += healed;
  p.turnFlags.actualHealing = (p.turnFlags.actualHealing ?? 0) + healed;
  if (healed) ev.push({ type: 'heal', targetId: p.id, amount: healed });
  const armor = Math.min(healed * 2, Math.max(0, (p.statuses.recoveryArmor ?? 0) - (p.turnFlags.recoveryArmor ?? 0)));
  if (armor > 0) {
    p.turnFlags.recoveryArmor = (p.turnFlags.recoveryArmor ?? 0) + armor;
    gainBlock(p, armor, ev, cs);
    log(cs, ev, `回生甲：实际治疗转化为 ${armor} 格挡`);
  }
  return healed;
}

function gainBlock(entity: Entity, amount: number, ev: CombatEvent[], cs?: CombatState) {
  if (amount <= 0) return;
  amount = Math.min(amount, Math.max(0, BLOCK_MAX - entity.block));
  if (amount <= 0) return;
  entity.block += amount;
  ev.push({ type: 'block', targetId: entity.id, amount });
  if (cs && entity.id === 'player') cs.player.blockGainedThisTurn += amount;
}

function gainEmber(cs: CombatState, amount: number, ev: CombatEvent[], fromCard: boolean) {
  const p = cs.player;
  if (amount > 0 && fromCard && cs.relics.includes('ash_hourglass')) amount += 1;
  const before = p.ember;
  p.ember = Math.max(0, Math.min(EMBER_MAX, p.ember + amount));
  const delta = p.ember - before;
  if (delta !== 0) ev.push({ type: 'ember', amount: delta, total: p.ember });
  if (delta > 0 && p.statuses.forge) {
    const blk = delta * (p.statuses.forge ?? 0);
    gainBlock(p, blk, ev, cs);
    log(cs, ev, `熔炉：获得 ${blk} 点格挡`);
  }
}

/** 玩家因卡牌失去生命（无视格挡），触发血契 / 猩红护甲 / 铁颅 */
function playerLoseHp(cs: CombatState, amount: number, ev: CombatEvent[], fromCard: boolean) {
  const p = cs.player;
  if (amount <= 0) return;
  const before = p.hp;
  p.hp = Math.max(0, p.hp - amount);
  const lost = before - p.hp;
  ev.push({ type: 'damage', targetId: 'player', amount: lost, blocked: 0, source: 'player' });
  p.hpLostThisTurn += lost;
  if (fromCard) {
    p.selfHpLost += lost;
    p.turnFlags.cardHpLost = (p.turnFlags.cardHpLost ?? 0) + lost;
    log(cs, ev, `失去 ${lost} 点生命`);
    if (lost > 0 && p.hp > 0 && p.statuses.bloodDraw && !p.turnFlags.bloodDraw) {
      p.turnFlags.bloodDraw = 1;
      drawCards(cs, p.statuses.bloodDraw, ev);
      log(cs, ev, `血之筹码：抽 ${p.statuses.bloodDraw} 张牌`);
    }
    if (p.statuses.bloodRage) {
      gainStrength(cs, p.statuses.bloodRage, ev);
      log(cs, ev, `血契：获得 ${p.statuses.bloodRage} 点力量`);
    }
    if (cs.relics.includes('iron_skull')) {
      gainBlock(p, 2, ev, cs);
      ev.push({ type: 'relic', relicId: 'iron_skull' });
    }
    if (lost > 0 && p.hp > 0 && !p.turnFlags.bloodRelics) {
      p.turnFlags.bloodRelics = 1;
      if (cs.relics.includes('scar_band')) { gainEmber(cs, 1, ev, false); relicProc(cs, 'scar_band', ev); }
      if (cs.relics.includes('blood_pendant')) { drawCards(cs, 1, ev); relicProc(cs, 'blood_pendant', ev); }
    }
    if (lost > 0) triggerRelics(cs, 'selfHpLoss', ev);
    if (lost > 0 && p.hp > 0 && p.statuses.bloodOath && !p.turnFlags.bloodOathDone) {
      p.turnFlags.bloodOathLoss = (p.turnFlags.bloodOathLoss ?? 0) + lost;
      if (p.turnFlags.bloodOathLoss >= 4) {
        p.turnFlags.bloodOathDone = 1;
        healPlayer(cs, Math.min(p.statuses.bloodOath, p.turnFlags.bloodOathLoss), ev);
        p.energy += 1;
        log(cs, ev, '血色盟约：失血达到 4，治疗并获得 1 能量');
      }
    }
  }
  if (lost > 0 && p.hp > 0 && p.statuses.bloodArmor) {
    gainBlock(p, p.statuses.bloodArmor, ev, cs);
    log(cs, ev, `血甲：获得 ${p.statuses.bloodArmor} 点格挡`);
  }
  if (p.hp <= 0) finishLost(cs, ev);
}

/** 玩家获得力量（战号加成） */
function gainStrength(cs: CombatState, amount: number, ev: CombatEvent[]) {
  const p = cs.player;
  if (amount > 0 && cs.relics.includes('war_horn') && !p.turnFlags.warHorn) {
    p.turnFlags.warHorn = 1;
    amount += 1;
    ev.push({ type: 'relic', relicId: 'war_horn' });
  }
  addStatus(p, 'strength', amount, ev);
}

function relicCondition(cs: CombatState, c: RelicCondition): boolean {
  const p = cs.player;
  switch (c.kind) {
    case 'hpBelowHalf': return p.hp <= p.maxHp / 2;
    case 'retainedHand': return p.hand.some(card => viewCard(card).retain);
    case 'burningEnemy': return aliveEnemies(cs).some(e => (e.statuses.burn ?? 0) > 0);
    case 'emberAtLeast': return p.ember >= c.value;
    case 'blockAtLeast': return p.block >= c.value;
    case 'attacksAtLeast': return p.attacksPlayedThisTurn >= c.value;
    case 'skillsAtLeast': return p.skillsPlayedThisTurn >= c.value;
    case 'cardsAtMost': return p.cardsPlayedThisTurn <= c.value;
    case 'exhaustedAtLeast': return (p.turnFlags.exhausted ?? 0) >= c.value;
    case 'handAtLeast': return p.hand.length >= c.value;
    case 'energyAtLeast': return p.energy >= c.value;
    case 'hpLostAtLeast': return (p.turnFlags.cardHpLost ?? 0) >= c.value;
  }
}

/** 遗物的固定伤害/格挡不套用卡牌的力量、敏捷与荆棘；不递归触发出牌事件。 */
function triggerRelics(cs: CombatState, trigger: RelicCombatTrigger, ev: CombatEvent[]) {
  const p = cs.player;
  if (p.hp <= 0 || cs.outcome !== 'ongoing') return;
  const key = `relic:${trigger}`;
  const count = trigger === 'turnStart' || trigger === 'turnEnd' ? cs.turn : (p.turnFlags[key] ?? 0) + 1;
  p.turnFlags[key] = count;
  for (const id of cs.relics) {
    const relic = RELICS[id];
    if (relic?.owner && relic.owner !== cs.character) continue;
    for (const rule of relic?.combat ?? []) {
      if (rule.trigger !== trigger || (rule.nth !== undefined && rule.nth !== count) || (rule.every && count % rule.every !== 0)) continue;
      if (rule.when?.some(c => !relicCondition(cs, c))) continue;
      relicProc(cs, id, ev);
      for (const effect of rule.effects) {
        if (p.hp <= 0 || cs.outcome !== 'ongoing') return;
        const lowest = () => aliveEnemies(cs).reduce<EnemyState | null>((best, e) => !best || e.hp < best.hp ? e : best, null);
        switch (effect.kind) {
          case 'block': gainBlock(p, effect.amount, ev, cs); break;
          case 'draw': drawCards(cs, effect.amount, ev); break;
          case 'energy': p.energy += effect.amount; break;
          case 'ember': gainEmber(cs, effect.amount, ev, false); break;
          case 'heal': healPlayer(cs, effect.amount, ev); break;
          case 'status':
            if (effect.status === 'strength') gainStrength(cs, effect.amount, ev);
            else addStatus(p, effect.status, effect.amount, ev);
            break;
          case 'enemyStatus': {
            const target = lowest();
            for (const e of effect.target === 'all' ? aliveEnemies(cs) : target ? [target] : []) addStatus(e, effect.status, effect.amount, ev);
            break;
          }
          case 'damageAll':
            for (const e of aliveEnemies(cs)) dealDamage(cs, e, effect.amount, ev, 'aura');
            break;
          case 'damageLowest': {
            const target = lowest();
            if (target) dealDamage(cs, target, effect.amount, ev, 'aura');
            break;
          }
          case 'cleanse': addStatus(p, effect.status, -Math.min(effect.amount, p.statuses[effect.status] ?? 0), ev); break;
          case 'charge':
            for (const c of p.hand) if (viewCard(c).retain && viewCard(c).charge) c.bonus = clampCharge((c.bonus ?? 0) + effect.amount);
            break;
        }
      }
    }
  }
}

function newUid(cs: CombatState): string {
  cs.uidCounter += 1;
  return `c${cs.uidCounter}`;
}

// ---------- 消耗 ----------
/** 将一张牌放入消耗区并触发"消耗时"效果 */
function exhaustCard(cs: CombatState, card: CardInstance, ev: CombatEvent[], random = false) {
  const p = cs.player;
  p.exhaust.push(card);
  ev.push({ type: 'cardRemoved', card: { ...card }, destination: 'exhaust', random });
  p.turnFlags.exhausted = (p.turnFlags.exhausted ?? 0) + 1;
  log(cs, ev, `「${viewCard(card).name}」被消耗`);
  if (p.hp > 0 && cs.outcome === 'ongoing' && p.statuses.ashInsight && (p.turnFlags.ashInsight ?? 0) < 2) {
    p.turnFlags.ashInsight = (p.turnFlags.ashInsight ?? 0) + 1;
    drawCards(cs, p.statuses.ashInsight, ev);
    log(cs, ev, `灰中启示：抽 ${p.statuses.ashInsight} 张牌`);
  }
  if (p.statuses.ashFeast) {
    gainBlock(p, p.statuses.ashFeast, ev, cs);
    log(cs, ev, `灰烬盛宴：获得 ${p.statuses.ashFeast} 点格挡`);
  }
  if (p.statuses.kindling) {
    const targets = aliveEnemies(cs);
    if (targets.length) {
      const t = pick(cs.rng, targets);
      const dmg = calcDamage(p.statuses.kindling, {}, t.statuses);
      const lost = dealDamage(cs, t, dmg, ev, 'player');
      log(cs, ev, `火种传递：${t.name} 失去 ${lost} 点生命`);
    }
  }
  if (cs.relics.includes('bone_urn') && p.turnFlags.exhausted === 1) {
    drawCards(cs, 1, ev);
    ev.push({ type: 'relic', relicId: 'bone_urn' });
    log(cs, ev, '骨灰坛：抽 1 张牌');
  }
  if (p.turnFlags.exhausted === 1) {
    if (cs.relics.includes('coal_pouch')) { gainEmber(cs, 1, ev, false); relicProc(cs, 'coal_pouch', ev); }
    if (cs.relics.includes('phoenix_ash') && p.hp > 0) {
      healPlayer(cs, T.phoenixHeal, ev); relicProc(cs, 'phoenix_ash', ev);
    }
  }
  triggerRelics(cs, 'exhaust', ev);
  if (p.hp > 0 && cs.outcome === 'ongoing' && p.statuses.ashRecall) {
    p.turnFlags.ashRecall = (p.turnFlags.ashRecall ?? 0) + 1;
    if (p.turnFlags.ashRecall === 2) {
      gainBlock(p, p.statuses.ashRecall, ev, cs);
      resolveEffects(cs, [{ kind: 'returnExhausted', count: 1, selection: 'highestCost' }], null, ev, 0);
      log(cs, ev, '灰烬储备：第二次消耗，取回最高费牌');
    }
  }
}

// ---------- 抽牌 ----------
export function drawCards(cs: CombatState, n: number, ev: CombatEvent[]) {
  const p = cs.player;
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (p.hand.length >= HAND_MAX) break;
    if (p.draw.length === 0) {
      if (p.discard.length === 0) break;
      p.draw = shuffle(cs.rng, p.discard);
      p.discard = [];
      ev.push({ type: 'shuffle' });
      log(cs, ev, '弃牌堆洗入抽牌堆');
    }
    const c = p.draw.pop()!;
    p.hand.push(c);
    drawn++;
  }
  if (drawn > 0) ev.push({ type: 'draw', count: drawn });
}

// ---------- 意图计算 ----------
export function enemyMoveActions(cs: CombatState, move: EnemyMove): EnemyAction[] {
  return cs.difficulty?.complexIntents && move.hardActions ? move.hardActions : move.actions;
}

/** 复合行动的附加效果直接显示在意图旁，详细数值仍来自同一组规则。 */
export function enemyIntentExtras(cs: CombatState, e: EnemyState): string[] {
  const move = ENEMIES[e.defId].moves.find(m => m.id === e.moveId);
  if (!move) return [];
  if (!cs.difficulty?.complexIntents || !move.hardActions) return move.actions.flatMap(a => {
    if (a.kind === 'clearDebuffs' && a.keepBurnRatio) return ['清除其他负面，燃烧减半'];
    if (a.kind === 'status' && a.target === 'player' && ['frail', 'vulnerable'].includes(a.status)) return [`施加${STATUSES[a.status].name} ${a.amount}`];
    return [];
  });
  return enemyMoveActions(cs, move).flatMap(a => {
    if (a.kind === 'clearDebuffs') return [a.keepBurnRatio ? '清除其他负面，燃烧减半' : '清除负面状态'];
    if (a.kind === 'block') return [`格挡 ${calcBlock(scaleEnemyValue(a.amount, cs.difficulty?.blockMultiplier), e.statuses)}`];
    if (a.kind === 'status') return [`${a.target === 'player' ? '施加' : a.target === 'allies' ? '全体' : ''}${STATUSES[a.status].name} ${a.amount}`];
    if (a.kind === 'addCardToDraw' || a.kind === 'addCardToDiscard') return [`${CARDS[a.cardId].name} ×${a.count} → ${a.kind === 'addCardToDraw' ? '抽牌堆' : '弃牌堆'}`];
    return [];
  });
}

/** 意图与敌人详情共享预览；玩家最后一层易伤会在攻击前过期。 */
export function previewEnemyAttack(cs: CombatState, enemy: EnemyState, base: number): number {
  const targetStatuses = cs.phase === 'player' && cs.player.statuses.vulnerable === 1
    ? { ...cs.player.statuses, vulnerable: 0 } : cs.player.statuses;
  return calcDamage(scaleEnemyValue(base, cs.difficulty?.attackMultiplier), enemy.statuses, targetStatuses);
}

export function enemyIntent(cs: CombatState, e: EnemyState): Intent | null {
  if (!e.moveId) return null;
  const def = ENEMIES[e.defId];
  const move = def.moves.find((m) => m.id === e.moveId);
  if (!move) return null;
  const actions = enemyMoveActions(cs, move);
  const atk = actions.find((a) => a.kind === 'attack');
  if (atk && atk.kind === 'attack') {
    const amount = previewEnemyAttack(cs, e, atk.amount);
    const kind = move.intent === 'attack_debuff' || move.intent === 'special' || (cs.difficulty?.complexIntents && move.hardActions && actions.some(a => a.kind !== 'attack')) ? 'attack_debuff' : 'attack';
    return { kind, amount, times: atk.times ?? 1, ...(atk.piercing ? { piercing: true } : {}) };
  }
  switch (move.intent) {
    case 'escape':
      return { kind: 'escape' };
    case 'defend':
      return { kind: 'defend' };
    case 'buff':
      return { kind: 'buff' };
    case 'debuff':
      return { kind: 'debuff' };
    case 'defend_buff':
      return { kind: 'defend_buff' };
    case 'defend_debuff':
      return { kind: 'defend_debuff' };
    default:
      return { kind: 'special' };
  }
}

export function enemyMoveName(e: EnemyState): string {
  const def = ENEMIES[e.defId];
  return def.moves.find((m) => m.id === e.moveId)?.name ?? '???';
}

function chooseIntent(cs: CombatState, e: EnemyState) {
  const def = ENEMIES[e.defId];
  const id = def.chooseMove({ enemy: e, allies: aliveEnemies(cs), player: cs.player, rng: cs.rng });
  e.moveId = id;
}

// ---------- 战斗开始 ----------
export function createCombat(
  encounterId: string,
  enemyIds: string[],
  tier: CombatState['tier'],
  deck: CardInstance[],
  hp: number,
  maxHp: number,
  relics: string[],
  rng: RngState,
  uidStart: number,
  character: CharacterId = 'traveler',
  difficulty?: CombatDifficulty,
  gold = 0,
): StepResult {
  const ev: CombatEvent[] = [];
  const cs: CombatState = {
    gold,
    difficulty,
    encounterId,
    tier,
    player: {
      id: 'player',
      name: '旅人',
      hp,
      maxHp,
      block: 0,
      statuses: {},
      powerInstances: [],
      energy: 0,
      maxEnergy: 3,
      ember: 0,
      draw: [],
      hand: [],
      discard: [],
      exhaust: [],
      cardsPlayedThisTurn: 0,
      attacksPlayedThisTurn: 0,
      skillsPlayedThisTurn: 0,
      blockGainedThisTurn: 0,
      hpLostThisTurn: 0,
      selfHpLost: 0,
      turnFlags: {},
    },
    enemies: [],
    turn: 0,
    phase: 'player',
    outcome: 'ongoing',
    log: [],
    rng: { s: rng.s },
    relics: relics.slice(),
    uidCounter: uidStart,
    character,
  };
  enemyIds.forEach((id, i) => {
    const def = ENEMIES[id];
    const hpv = scaleEnemyValue(nextInt(cs.rng, def.hp[0], def.hp[1]), difficulty?.healthMultiplier);
    cs.enemies.push({
      id: `e${i}`,
      defId: id,
      name: def.name + (enemyIds.filter((x) => x === id).length > 1 ? ` ${String.fromCharCode(65 + enemyIds.slice(0, i).filter((x) => x === id).length)}` : ''),
      hp: hpv,
      maxHp: hpv,
      block: 0,
      statuses: {},
      moveId: null,
      moveHistory: [],
      turn: 0,
      phase: 1,
      flags: {},
      ...(def.maxHpLossPerTurn ? { damageGuard: { limit: Math.max(1, Math.ceil(hpv * def.maxHpLossPerTurn)), lost: 0 } } : {}),
    });
  });
  cs.player.draw = shuffle(cs.rng, deck.map((c) => ({ ...c, bonus: 0 })));
  log(cs, ev, `遭遇：${cs.enemies.map((e) => e.name).join('、')}`);

  // 敌人开场钩子
  for (const e of cs.enemies) {
    const def = ENEMIES[e.defId];
    if (def.onCombatStart) {
      const acts = def.onCombatStart({ enemy: e, allies: cs.enemies, player: cs.player, rng: cs.rng });
      for (const a of acts) applyEnemyAction(cs, e, a, ev);
    }
  }
  // 遗物开场
  if (cs.relics.includes('whetstone')) { gainStrength(cs, 1, ev); relicProc(cs, 'whetstone', ev); }
  if (cs.relics.includes('ember_lantern')) {
    gainEmber(cs, 2, ev, false);
    ev.push({ type: 'relic', relicId: 'ember_lantern' });
    log(cs, ev, '余烬灯：获得 2 点余烬');
  }
  if (cs.relics.includes('ember_censer') && cs.player.ember === 0) {
    gainEmber(cs, T.censerOpeningEmber, ev, false);
    ev.push({ type: 'relic', relicId: 'ember_censer' });
    log(cs, ev, `余火香炉：获得 ${T.censerOpeningEmber} 点余烬`);
  }
  if (cs.relics.includes('thorn_crown')) {
    addStatus(cs.player, 'thorns', 3, ev);
    ev.push({ type: 'relic', relicId: 'thorn_crown' });
    log(cs, ev, '荆棘冠：获得 3 点荆棘');
  }
  if (cs.relics.includes('picker_bell')) {
    for (const e of cs.enemies) addStatus(e, 'burn', 2, ev);
    ev.push({ type: 'relic', relicId: 'picker_bell' });
    log(cs, ev, '拾灰者的铃：所有敌人获得 2 层燃烧');
  }
  if (cs.relics.includes('blood_seal')) {
    playerLoseHp(cs, 2, ev, false);
    gainStrength(cs, 1, ev);
    ev.push({ type: 'relic', relicId: 'blood_seal' });
    log(cs, ev, '血誓印：失去 2 点生命，获得 1 点力量');
  }
  if (cs.relics.includes('echo_stone')) {
    addStatus(cs.player, 'echo', 1, ev);
    ev.push({ type: 'relic', relicId: 'echo_stone' });
    log(cs, ev, '回响石：获得 1 层回响');
  }

  if (cs.relics.includes('watchers_eye')) {
    for (const e of cs.enemies) addStatus(e, 'vulnerable', 1, ev);
    ev.push({ type: 'relic', relicId: 'watchers_eye' });
    log(cs, ev, '守望者之眼：所有敌人获得 1 层易伤');
  }
  for (const e of cs.enemies) chooseIntent(cs, e);
  // 第一回合
  startPlayerTurnInPlace(cs, ev);
  return { state: cs, events: ev };
}

// ---------- 回合开始 ----------
function startPlayerTurnInPlace(cs: CombatState, ev: CombatEvent[]) {
  const p = cs.player;
  cs.turn += 1;
  cs.phase = 'player';
  // 必须在焰柱与回合开始遗物造成伤害之前刷新；敌方回合仍沿用上一轮额度。
  for (const e of cs.enemies) if (e.damageGuard) e.damageGuard.lost = 0;
  log(cs, ev, `—— 第 ${cs.turn} 回合 ——`);
  p.turnFlags = {};
  for (const power of ensurePowerInstances(p)) if (power.status === 'mirror') power.progress = 0;
  if (!p.statuses.barricade) p.block = Math.min(p.block, (p.statuses.guardReserve ?? 0) + (p.statuses.guardOnce ?? 0));
  if (p.statuses.guardOnce) addStatus(p, 'guardOnce', -p.statuses.guardOnce, ev);
  if (p.statuses.tempThorns) addStatus(p, 'tempThorns', -p.statuses.tempThorns, ev);
  // 燃烧
  if (p.statuses.burn) {
    const b = p.statuses.burn;
    dealDamage(cs, p, b, ev, 'burn', true);
    log(cs, ev, `燃烧：受到 ${b} 点伤害`);
    addStatus(p, 'burn', -1, ev);
    if (p.hp <= 0) return finishLost(cs, ev);
  }
  if (cs.relics.includes('rusted_plate')) {
    gainBlock(p, 3, ev, cs);
    ev.push({ type: 'relic', relicId: 'rusted_plate' });
  }
  if (cs.turn === 1 && cs.relics.includes('shield_rivet')) { gainBlock(p, 8, ev, cs); relicProc(cs, 'shield_rivet', ev); }
  if (cs.relics.includes('soot_mask') && aliveEnemies(cs).some(e => (e.statuses.burn ?? 0) > 0)) {
    gainBlock(p, 3, ev, cs); relicProc(cs, 'soot_mask', ev);
  }
  for (const power of ensurePowerInstances(p).filter(power => power.status === 'flameAura')) {
    const dmg = p.ember + power.amount - 1;
    if (dmg > 0) {
      for (const e of aliveEnemies(cs)) {
        const lost = dealDamage(cs, e, dmg, ev, 'aura');
        log(cs, ev, `焰柱：${e.name} 失去 ${lost} 点生命`);
      }
      handleEnemyDeaths(cs, ev);
      if (cs.outcome === 'won') return;
    }
  }
  p.energy = p.maxEnergy;
  if (cs.turn % 3 === 0 && cs.relics.includes('clockwork_sun')) { p.energy += 1; relicProc(cs, 'clockwork_sun', ev); }
  if (cs.turn === 1 && cs.relics.includes('rune_stone')) {
    p.energy += 1;
    ev.push({ type: 'relic', relicId: 'rune_stone' });
  }
  if (p.statuses.energyNext) {
    p.energy += p.statuses.energyNext;
    log(cs, ev, `蓄能：获得 ${p.statuses.energyNext} 点能量`);
    delete p.statuses.energyNext;
  }
  if (cs.turn % T.lensInterval === 0 && cs.relics.includes('lens') && p.hand.some(card => viewCard(card).retain)) {
    p.energy += 1;
    ev.push({ type: 'relic', relicId: 'lens' });
    log(cs, ev, '透镜：获得 1 点能量');
  }
  if (p.statuses.demonHeart) {
    gainStrength(cs, p.statuses.demonHeart, ev);
    log(cs, ev, `恶魔之心：获得 ${p.statuses.demonHeart} 点力量`);
  }
  if (p.statuses.resonance) {
    addStatus(p, 'echo', p.statuses.resonance, ev);
    log(cs, ev, `共鸣：获得 ${p.statuses.resonance} 层回响`);
  }
  p.cardsPlayedThisTurn = 0;
  p.attacksPlayedThisTurn = 0;
  p.skillsPlayedThisTurn = 0;
  p.blockGainedThisTurn = 0;
  p.hpLostThisTurn = 0;
  for (const e of cs.enemies) delete e.flags.acted;
  const studyBeforeRelics = p.statuses.study ?? 0;
  let n = 5 + studyBeforeRelics + (p.statuses.drawNext ?? 0);
  delete p.statuses.drawNext;
  if (cs.turn === 1 && cs.relics.includes('ash_compass')) n += 1;
  if (cs.turn > 1 && p.hand.some(c => viewCard(c).retain) && cs.relics.includes('bookmark')) { n += 1; relicProc(cs, 'bookmark', ev); }
  if (cs.turn % 3 === 0 && cs.relics.includes('clockwork_sun')) n += 1;
  triggerRelics(cs, 'turnStart', ev);
  handleEnemyDeaths(cs, ev);
  if (cs.outcome !== 'ongoing') return;
  // 开场获得博学时，当回合的常规抽牌也应包含它。
  n += (p.statuses.study ?? 0) - studyBeforeRelics;
  drawCards(cs, n, ev);
}

// ---------- 出牌 ----------
export function needsDiscardReplay(card: CardInstance): boolean {
  const containsReplay = (effects: Effect[]): boolean => effects.some(effect =>
    effect.kind === 'replayDiscard' || (effect.kind === 'conditional' && containsReplay(effect.then)));
  return containsReplay(viewCard(card).effects);
}

/** 选择只读取公开弃牌堆；费用豁免仅限能量，禁止重放选择器互相递归。 */
export function discardReplayChoices(cs: CombatState): CardInstance[] {
  return cs.player.discard.filter(card => {
    const v = viewCard(card);
    return (v.type === 'attack' || v.type === 'skill') && !needsDiscardReplay(card) && !cardTransferEffect(card)
      && v.requireEmber <= cs.player.ember && (v.target !== 'enemy' || aliveEnemies(cs).length > 0);
  });
}

export function canPlayCard(cs: CombatState, card: CardInstance): { ok: boolean; reason?: string } {
  const v = viewCard(card);
  if (cs.phase !== 'player' || cs.outcome !== 'ongoing') return { ok: false, reason: '现在不能出牌' };
  if (v.cost < 0) return { ok: false, reason: v.type === 'status' ? '状态牌无法打出' : '诅咒牌无法打出' };
  if (v.cost > cs.player.energy) return { ok: false, reason: '能量不足' };
  if (v.requireEmber > cs.player.ember) return { ok: false, reason: `需要 ${v.requireEmber} 点余烬` };
  if (v.target === 'enemy' && aliveEnemies(cs).length === 0) return { ok: false, reason: '没有目标' };
  if (needsDiscardReplay(card) && !discardReplayChoices(cs).length) return { ok: false, reason: '弃牌堆没有可重放的攻击或技能' };
  if (cardTransferEffect(card) && !cardTransferChoices(cs, card).length) return { ok: false, reason: '牌堆中没有符合条件的牌' };
  return { ok: true };
}

export function needsTarget(card: CardInstance): boolean {
  return viewCard(card).target === 'enemy';
}

export function playCard(input: CombatState, uid: string, targetId: string | null, replayUid?: string): StepResult {
  const cs = clone(input);
  const ev: CombatEvent[] = [];
  const p = cs.player;
  const idx = p.hand.findIndex((c) => c.uid === uid);
  if (idx < 0) return { state: input, events: [] };
  const card = p.hand[idx];
  const v = viewCard(card);
  const check = canPlayCard(cs, card);
  if (!check.ok) return { state: input, events: [] };
  const replayChoice = needsDiscardReplay(card) ? discardReplayChoices(cs).find(c => c.uid === replayUid) : undefined;
  if (needsDiscardReplay(card) && !replayChoice) return { state: input, events: [] };
  // 固定确认时的卡牌版本；本次重放的抽牌、洗牌不会复制实体或改变选择。
  const replay = replayChoice ? { ...replayChoice } : undefined;
  const transferEffect = cardTransferEffect(card);
  const transferCard = transferEffect ? cardTransferChoices(cs, card, cs.rng).find(c => c.uid === replayUid) : undefined;
  if (transferEffect && !transferCard) return { state: input, events: [] };
  const transfer: CardMoveResolution | undefined = transferEffect && transferCard ? {
    effect: transferEffect, card: transferCard, index: p[transferEffect.from].findIndex(c => c.uid === transferCard.uid), resolved: false,
  } : undefined;
  let target: EnemyState | null = null;
  if (v.target === 'enemy' || (replay && viewCard(replay).target === 'enemy')) {
    target = cs.enemies.find((e) => e.id === targetId && alive(e)) ?? null;
    if (!target) return { state: input, events: [] };
  }
  p.energy -= v.cost;
  p.hand.splice(idx, 1);
  // 选择的实体暂时离开来源牌堆，失血触发的抽牌/洗牌不能把它提前移动或复制。
  if (transfer) p[transfer.effect.from].splice(transfer.index, 1);
  // 结算中的实体离开牌堆，不能被自己的抽牌洗回或作为消耗素材。
  if (replay) p.discard.splice(p.discard.findIndex(c => c.uid === replay.uid), 1);
  let replayed = false;
  // 只计入打出本牌之前已生效的余音，新打出的能力不会计入自己。
  const activeTempos = ensurePowerInstances(p).filter(power => power.status === 'tempo');
  // “下一张”只消费打牌之前已有的回响，不能被本牌刚获得的回响重复自己。
  const hadEcho = (p.statuses.echo ?? 0) > 0;
  const releaseCharge = !!p.statuses.chargeMaster && !!v.charge && v.bonus >= 2 && !p.turnFlags.chargeMaster;
  ev.push({ type: 'cardPlayed', uid, name: v.name });
  log(cs, ev, `打出「${v.name}」${target ? ` → ${target.name}` : ''}`);

  // 每次实际重放都独立结算一次出牌计数与触发；费用和实体卡去向仍只处理一次。
  const finishPlay = (v: CardView, releaseCharge: boolean) => {
    // 计数
    p.cardsPlayedThisTurn += 1;
    if (v.type === 'attack') p.attacksPlayedThisTurn += 1;
    if (cs.outcome === 'ongoing' && p.hp > 0) {
      if (v.type === 'attack' && p.attacksPlayedThisTurn === 3 && p.statuses.comboFlow) {
        p.energy += p.statuses.comboFlow;
        gainBlock(p, p.statuses.comboFlow * 8, ev, cs);
        log(cs, ev, `续势：获得 ${p.statuses.comboFlow} 点能量和 ${p.statuses.comboFlow * 8} 点格挡`);
      }
      if (releaseCharge && !p.turnFlags.chargeMaster) {
        p.turnFlags.chargeMaster = 1;
        p.energy += 1;
        log(cs, ev, '凝神：返还 1 点能量');
      }
      if (v.type === 'attack' && p.statuses.temperedMight) {
        p.turnFlags.temperedMight = (p.turnFlags.temperedMight ?? 0) + 1;
        if (p.turnFlags.temperedMight === 2) {
          const kept = Math.min(p.statuses.temperedMight, p.statuses.strengthDown ?? 0, Math.max(0, p.statuses.strength ?? 0));
          if (kept) { addStatus(p, 'strengthDown', -kept, ev); log(cs, ev, `淬血：${kept} 点临时力量转为永久`); }
        }
      }
      if (p.statuses.vanguardCycle && (v.type === 'attack' || v.type === 'skill')) {
        const kind = v.type === 'attack' ? 1 : 2;
        if (p.turnFlags.vanguardKind && p.turnFlags.vanguardKind !== kind && (p.turnFlags.vanguardPairs ?? 0) < 2) {
          p.turnFlags.vanguardPairs = (p.turnFlags.vanguardPairs ?? 0) + 1;
          p.turnFlags.vanguardKind = 0;
          gainBlock(p, p.statuses.vanguardCycle, ev, cs); drawCards(cs, 1, ev);
        } else p.turnFlags.vanguardKind = kind;
      }
      if (p.statuses.chargedEcho && v.charge && v.bonus >= 2 && !p.turnFlags.chargedEcho) {
        p.turnFlags.chargedEcho = 1;
        gainBlock(p, p.statuses.chargedEcho, ev, cs); addStatus(p, 'echo', 1, ev);
      }
    }
    if (v.type === 'skill') p.skillsPlayedThisTurn += 1;
    triggerRelics(cs, 'cardPlayed', ev);
    if (v.type === 'attack') triggerRelics(cs, 'attackPlayed', ev);
    if (v.type === 'skill') triggerRelics(cs, 'skillPlayed', ev);
    if (v.type === 'power') triggerRelics(cs, 'powerPlayed', ev);
    if (v.type === 'skill' && p.skillsPlayedThisTurn === 1 && cs.relics.includes('ink_well')) {
      gainBlock(p, 3, ev, cs); relicProc(cs, 'ink_well', ev);
    }
    if (v.type === 'attack' && p.attacksPlayedThisTurn === 2 && cs.relics.includes('trail_boots')) {
      gainBlock(p, 3, ev, cs); relicProc(cs, 'trail_boots', ev);
    }

    // 敌人激怒
    if (v.type === 'skill') {
      for (const e of aliveEnemies(cs)) {
        if (e.statuses.enrage) {
          addStatus(e, 'strength', e.statuses.enrage, ev);
          log(cs, ev, `${e.name} 被激怒，获得 ${e.statuses.enrage} 点力量`);
        }
      }
    }

    // 节奏类触发
    if (p.cardsPlayedThisTurn === 3) {
      if (cs.relics.includes('duelist_clasp')) { gainEmber(cs, 2, ev, false); relicProc(cs, 'duelist_clasp', ev); }
      if (cs.relics.includes('metronome')) {
        drawCards(cs, 1, ev);
        ev.push({ type: 'relic', relicId: 'metronome' });
        log(cs, ev, '节拍怀表：抽 1 张牌');
      }
    }
    if (p.hp > 0 && cs.outcome === 'ongoing') for (const power of activeTempos) {
      power.progress++;
      if (power.progress === 3) {
        power.progress = 0;
        log(cs, ev, `余音：累计打出 3 张牌，抽 ${power.amount} 张牌`);
        drawCards(cs, power.amount, ev);
      }
    }
    if (v.type === 'attack' && p.attacksPlayedThisTurn === 3 && cs.relics.includes('drummer_heart')) {
      p.energy += 1;
      ev.push({ type: 'relic', relicId: 'drummer_heart' });
      log(cs, ev, '鼓手之心：获得 1 点能量');
    }
  };
  const resolvePlay = (v: CardView, target: EnemyState | null, releaseCharge: boolean) => {
    let extraDamage = 0;
    if (v.type === 'attack') {
      if (p.attacksPlayedThisTurn === 0 && cs.relics.includes('flint')) {
        extraDamage += T.flintDamage;
        ev.push({ type: 'relic', relicId: 'flint' });
      }
      if (p.statuses.crescendo) extraDamage += p.attacksPlayedThisTurn * p.statuses.crescendo;
    }
    resolveEffects(cs, v.effects, target, ev, extraDamage, v, transfer);
    finishPlay(v, releaseCharge);
    handleEnemyDeaths(cs, ev);
  };
  const resolveSource = () => {
    resolvePlay(v, target, releaseCharge);
    if (!replay || cs.outcome !== 'ongoing' || p.hp <= 0) return;
    const selected = viewCard(replay);
    if (selected.requireEmber > p.ember || (selected.target === 'enemy' && (!target || !alive(target)))) {
      log(cs, ev, '重放停止：所选目标已倒下或余烬不足');
      return;
    }
    replayed = true;
    ev.push({ type: 'cardPlayed', uid: replay.uid, name: selected.name });
    log(cs, ev, `血誓重演：免费重放「${selected.name}」${selected.target === 'enemy' ? ` → ${target!.name}` : ''}`);
    // 这是已被触发的重放，不再次消耗回响或递归触发镜像；新获得的回响留给下一张手动出牌。
    resolvePlay(selected, selected.target === 'enemy' ? target : null,
      !!p.statuses.chargeMaster && !!selected.charge && selected.bonus >= 2 && !p.turnFlags.chargeMaster);
  };
  resolveSource();

  // 只读取本次手动出牌之前的回响。重放获得的新回响留给下一张牌，不能递归复制。
  if (v.type !== 'power' && cs.outcome === 'ongoing') {
    const repeats: string[] = [];
    if (hadEcho) {
      addStatus(p, 'echo', -1, ev);
      repeats.push('回响');
    }
    if (v.type === 'attack') for (const power of ensurePowerInstances(p).filter(power => power.status === 'mirror' && power.progress === 0)) {
      power.progress = 1;
      for (let i = 0; i < power.amount; i++) repeats.push('镜像');
    }
    for (const source of repeats) {
      if (cs.outcome !== 'ongoing' || p.hp <= 0) break;
      if (v.requireEmber > p.ember) {
        log(cs, ev, `${source}停止：重放「${v.name}」需要 ${v.requireEmber} 点余烬`);
        continue;
      }
      ev.push({ type: 'cardPlayed', uid, name: v.name });
      log(cs, ev, `${source}：再次打出「${v.name}」`);
      if (cs.relics.includes('crystal_chime') && !p.turnFlags.chime) {
        p.turnFlags.chime = 1; gainBlock(p, 5, ev, cs); relicProc(cs, 'crystal_chime', ev);
      }
      if (cs.relics.includes('tuning_fork')) {
        gainEmber(cs, 1, ev, false);
        ev.push({ type: 'relic', relicId: 'tuning_fork' });
      }
      triggerRelics(cs, 'echo', ev);
      resolveSource();
      p.turnFlags.resolvedCopies = (p.turnFlags.resolvedCopies ?? 0) + 1;
      if (p.hp > 0 && cs.outcome === 'ongoing' && p.statuses.repriseStudy) {
        p.turnFlags.repriseStudy = (p.turnFlags.repriseStudy ?? 0) + 1;
        if (p.turnFlags.repriseStudy === 2) { drawCards(cs, p.statuses.repriseStudy, ev); p.energy += 1; }
      }
    }
  }

  // 回响只重复效果：被选牌遵循自己的消耗规则，实体和消耗触发各处理一次。
  if (replay) {
    if (replayed && viewCard(replay).exhaust) exhaustCard(cs, replay, ev);
    else p.discard.push(replay);
  }
  if (transfer && !transfer.resolved) p[transfer.effect.from].splice(Math.min(transfer.index, p[transfer.effect.from].length), 0, transfer.card);

  // 卡牌去向
  if (v.type === 'power') {
    // 能力牌打出后移除
  } else if (v.exhaust) {
    exhaustCard(cs, card, ev);
  } else {
    p.discard.push(card);
  }

  handleEnemyDeaths(cs, ev);
  return { state: cs, events: ev };
}

type CardMoveResolution = { effect: CardTransfer; card: CardInstance; index: number; resolved: boolean };
function resolveEffects(cs: CombatState, effects: Effect[], target: EnemyState | null, ev: CombatEvent[], extraDamage: number, view?: CardView, transfer?: CardMoveResolution) {
  const p = cs.player;
  const onEmberSpent = (amount: number) => {
    if (amount <= 0 || !view || view.type === 'curse' || p.hp <= 0 || cs.outcome !== 'ongoing') return;
    if (amount >= 3 && p.statuses.emberConduit && !p.turnFlags.emberConduit) {
      p.turnFlags.emberConduit = 1;
      for (const enemy of aliveEnemies(cs)) addStatus(enemy, 'burn', p.statuses.emberConduit, ev);
    }
    if (p.statuses.sparkCrown && !p.turnFlags.sparkCrown) {
      p.turnFlags.sparkCrown = 1;
      resolveEffects(cs, [{ kind: 'tempStrength', amount: Math.min(amount, p.statuses.sparkCrown) }], null, ev, 0);
    }
    if (!p.statuses.spentEmberDraw || p.turnFlags.spentEmberDraw) return;
    p.turnFlags.spentEmberDraw = 1;
    gainBlock(p, p.statuses.spentEmberDraw * 6, ev, cs);
    drawCards(cs, p.statuses.spentEmberDraw, ev);
    log(cs, ev, `长明：获得 ${p.statuses.spentEmberDraw * 6} 点格挡，抽 ${p.statuses.spentEmberDraw} 张牌`);
  };
  const chargeDmg = view?.charge?.damage ? view.charge.damage * view.bonus : 0;
  const chargeBlk = view?.charge?.block ? view.charge.block * view.bonus : 0;
  const targets = (aoe: boolean | undefined): EnemyState[] => {
    if (aoe) return aliveEnemies(cs);
    return target && alive(target) ? [target] : [];
  };
  const hit = (base: number, tgt: EnemyState, extra = 0) => {
    const dmg = calcDamage(base, p.statuses, tgt.statuses, extraDamage + extra);
    const lost = dealDamage(cs, tgt, dmg, ev, 'player');
    if (tgt.statuses.thorns && p.hp > 0) {
      dealDamage(cs, p, tgt.statuses.thorns, ev, 'thorns');
      log(cs, ev, `${tgt.name} 的荆棘：你受到 ${tgt.statuses.thorns} 点伤害`);
      if (p.hp <= 0) finishLost(cs, ev);
    }
    return { lost };
  };
  const spendEmber = (): number => {
    let e = p.ember;
    const actual = p.ember;
    if (cs.relics.includes('ember_censer')) e = Math.max(T.censerMinimumEmber, e);
    gainEmber(cs, -p.ember, ev, false);
    onEmberSpent(actual);
    return e;
  };

  for (const e of effects) {
    if (cs.outcome !== 'ongoing') return;
    switch (e.kind) {
      case 'damage': {
        const times = e.times ?? 1;
        let extra = chargeDmg;
        if (e.strengthMult) extra += (p.statuses.strength ?? 0) * e.strengthMult;
        if (e.perHandCard) extra += p.hand.length * e.perHandCard;
        if (e.perExhaustedCard) extra += Math.min(p.exhaust.length * e.perExhaustedCard, e.exhaustBonusMax ?? 0);
        for (let i = 0; i < times; i++) {
          const ts = targets(e.aoe);
          if (ts.length === 0) break;
          for (const t of ts) {
            const r = hit(e.amount, t, extra);
            log(cs, ev, `对 ${t.name} 造成 ${r.lost} 点生命伤害`);
            if (e.lifesteal && r.lost > 0 && p.hp > 0) {
              const healed = healPlayer(cs, Math.min(r.lost, e.lifestealCap ?? Infinity), ev);
              if (healed) log(cs, ev, `吸血：回复 ${healed} 点生命`);
            }
          }
        }
        break;
      }
      case 'damagePerHpLost': {
        const bonus = p.hpLostThisTurn * e.mult;
        if (bonus > 0) {
          for (const t of targets(false)) {
            const r = hit(bonus, t);
            log(cs, ev, `以血还血：对 ${t.name} 额外造成 ${r.lost} 点生命伤害`);
          }
        }
        break;
      }
      case 'loseHp':
        playerLoseHp(cs, e.amount, ev, true);
        break;
      case 'tempStrength':
        gainStrength(cs, e.amount, ev);
        addStatus(p, 'strengthDown', e.amount, ev);
        if (p.statuses.furyWard) {
          const amount = Math.min(e.amount * 3, Math.max(0, p.statuses.furyWard - (p.turnFlags.furyWard ?? 0)));
          p.turnFlags.furyWard = (p.turnFlags.furyWard ?? 0) + amount;
          gainBlock(p, amount, ev, cs);
        }
        log(cs, ev, `获得 ${e.amount} 点临时力量`);
        break;
      case 'doubleEmber':
        gainEmber(cs, p.ember, ev, false);
        log(cs, ev, `余烬翻倍为 ${p.ember}`);
        break;
      case 'discardRandom': {
        const n = e.count === 'all' ? p.hand.length : e.count;
        for (let i = 0; i < n && p.hand.length; i++) {
          const idx = e.count === 'all' ? 0 : nextInt(cs.rng, 0, p.hand.length - 1);
          const [c] = p.hand.splice(idx, 1);
          p.discard.push(c);
          ev.push({ type: 'cardRemoved', card: { ...c }, destination: 'discard', random: e.count !== 'all' });
          log(cs, ev, `弃置「${viewCard(c).name}」`);
        }
        break;
      }
      case 'clearDebuffs':
        // 力竭是临时力量的归还标记，不能通过净化将临时力量变为永久力量。
        for (const status of ['weak', 'vulnerable', 'frail', 'burn'] as const) {
          const amount = p.statuses[status] ?? 0;
          if (amount) ev.push({ type: 'status', targetId: p.id, status, amount: -amount });
          delete p.statuses[status];
        }
        log(cs, ev, '清除了自身的虚弱、易伤、脆弱与燃烧');
        break;
      case 'removeBlock':
        for (const t of targets(false)) {
          log(cs, ev, `移除 ${t.name} 的全部 ${t.block} 点格挡`);
          t.block = 0;
        }
        break;
      case 'damageByBlock': {
        const base = p.block * (e.mult ?? 1) + (e.bonus ?? 0);
        if (e.consume) {
          log(cs, ev, `消耗 ${p.block} 点格挡`);
          p.block = 0;
        }
        for (const t of targets(e.aoe)) {
          if (cs.outcome !== 'ongoing') break;
          const r = hit(base, t);
          log(cs, ev, `以格挡对 ${t.name} 造成 ${r.lost} 点生命伤害`);
        }
        break;
      }
      case 'damagePerAttack': {
        const times = p.attacksPlayedThisTurn + 1;
        for (let i = 0; i < times; i++) {
          const ts = targets(false);
          if (ts.length === 0) break;
          const r = hit(e.amount, ts[0]);
          log(cs, ev, `对 ${ts[0].name} 造成 ${r.lost} 点生命伤害`);
        }
        break;
      }
      case 'damagePerEmber': {
        const bonus = Math.floor(p.ember / (e.per ?? 1)) * e.amount;
        if (bonus > 0) {
          for (const t of targets(false)) {
            const r = hit(bonus, t);
            log(cs, ev, `余烬加成：对 ${t.name} 额外造成 ${r.lost} 点生命伤害`);
          }
        }
        break;
      }
      case 'block': {
        const b = calcBlock(e.amount + chargeBlk, p.statuses);
        gainBlock(p, b, ev, cs);
        log(cs, ev, `获得 ${b} 点格挡`);
        break;
      }
      case 'blockPerBurn':
        for (const t of targets(false)) {
          const b = calcBlock(Math.min((t.statuses.burn ?? 0) * e.amount, e.max), p.statuses);
          gainBlock(p, b, ev, cs);
          log(cs, ev, `借助 ${t.name} 的燃烧获得 ${b} 点格挡`);
        }
        break;
      case 'blockPerHand': {
        const b = calcBlock(Math.min(p.hand.length * e.amount, e.max), p.statuses);
        gainBlock(p, b, ev, cs);
        log(cs, ev, `手牌护盾：获得 ${b} 点格挡`);
        break;
      }
      case 'consumeVulnerable':
        for (const t of targets(e.aoe)) {
          if (cs.outcome !== 'ongoing') break;
          const n = t.statuses.vulnerable ?? 0;
          if (n <= 0) continue;
          delete t.statuses.vulnerable;
          ev.push({ type: 'status', targetId: t.id, status: 'vulnerable', amount: -n });
          const r = hit(n * e.damagePer, t);
          log(cs, ev, `击碎 ${t.name} 的 ${n} 层易伤，造成 ${r.lost} 点生命伤害`);
        }
        break;
      case 'convertResource': {
        const beforeBurn = target?.statuses.burn ?? 0, beforeStrength = p.statuses.strength ?? 0;
        const earned = convertResource(p, target ?? null, e);
        if (e.reward === 'draw') drawCards(cs, earned, ev);
        else p.energy += earned;
        if (target && beforeBurn !== (target.statuses.burn ?? 0)) ev.push({ type: 'status', targetId: target.id, status: 'burn', amount: (target.statuses.burn ?? 0) - beforeBurn });
        if (beforeStrength !== (p.statuses.strength ?? 0)) ev.push({ type: 'status', targetId: p.id, status: 'strength', amount: (p.statuses.strength ?? 0) - beforeStrength });
        log(cs, ev, `${conversionText(e)}；本次${e.reward === 'draw' ? '抽牌' : '获得能量'} ${earned}`);
        break;
      }
      case 'draw':
        drawCards(cs, e.amount, ev);
        break;
      case 'moveCard': {
        if (!transfer || transfer.resolved) break;
        transfer.resolved = true;
        const card = transfer.card;
        if (e.to === 'hand' && p.hand.length >= HAND_MAX) {
          p[e.from].splice(Math.min(transfer.index, p[e.from].length), 0, card);
          log(cs, ev, `手牌已满，「${viewCard(card).name}」留在原牌堆`);
        } else {
          p[e.to].push(card); // 抽牌堆末端即堆顶。
          log(cs, ev, `将「${viewCard(card).name}」移入${e.to === 'hand' ? '手牌' : e.to === 'draw' ? '抽牌堆顶' : '弃牌堆'}`);
        }
        break;
      }
      case 'retainHand':
        for (const card of p.hand) p.turnFlags[`retain:${card.uid}`] = 1;
        log(cs, ev, `本回合结束时保留当前 ${p.hand.length} 张手牌`);
        break;
      case 'chargeHand':
        for (const card of p.hand) {
          const charged = viewCard(card);
          if (!charged.charge) continue;
          card.bonus = clampCharge((card.bonus ?? 0) + e.amount);
          log(cs, ev, `「${charged.name}」立即蓄力 ${e.amount} 回合（累计 ${card.bonus}）`);
        }
        break;
      case 'energy':
        p.energy += e.amount;
        break;
      case 'gainEmber': {
        const before = p.ember;
        gainEmber(cs, e.amount, ev, e.amount > 0);
        onEmberSpent(before - p.ember);
        break;
      }
      case 'emberBurst': {
        const n = spendEmber();
        log(cs, ev, `消耗 ${n} 点余烬`);
        if (e.damagePer) {
          for (const t of targets(e.aoe)) {
            const r = hit(e.damagePer * n, t);
            log(cs, ev, `余烬爆发：对 ${t.name} 造成 ${r.lost} 点生命伤害`);
          }
        }
        if (e.blockPer) {
          const b = calcBlock(e.blockPer * n, p.statuses);
          gainBlock(p, b, ev, cs);
          log(cs, ev, `获得 ${b} 点格挡`);
        }
        break;
      }
      case 'status': {
        const ents: Entity[] = e.target === 'self' ? [p] : e.target === 'all' ? aliveEnemies(cs) : targets(false);
        for (const t of ents) {
          if (t.id === 'player' && e.status === 'strength') gainStrength(cs, e.amount, ev);
          else addStatus(t, e.status, e.amount, ev);
          log(cs, ev, `${t.name} 获得 ${e.amount} 层${STATUSES[e.status].name}`);
        }
        break;
      }
      case 'heal': {
        const healed = healPlayer(cs, e.amount, ev);
        log(cs, ev, `回复 ${healed} 点生命`);
        break;
      }
      case 'exhaustHand': {
        // 有筛选时固定本次效果开始时的候选，消耗触发的抽牌不能被顺带消耗。
        const candidates = e.filter === 'curse' ? p.hand.filter(c => viewCard(c).type === 'curse') : null;
        const available = candidates?.length ?? p.hand.length;
        const n = e.count === 'all' ? available : Math.min(e.count, available);
        let exhausted = 0;
        for (let i = 0; i < n; i++) {
          if (!p.hand.length) break;
          let idx: number;
          if (candidates) {
            const selected = e.count === 'all' ? 0 : nextInt(cs.rng, 0, candidates.length - 1);
            const [candidate] = candidates.splice(selected, 1);
            idx = p.hand.findIndex(c => c.uid === candidate.uid);
            if (idx < 0) continue;
          } else idx = e.count === 'all' ? 0 : nextInt(cs.rng, 0, p.hand.length - 1);
          const [c] = p.hand.splice(idx, 1);
          exhaustCard(cs, c, ev, e.count !== 'all');
          exhausted++;
        }
        if (e.energyPerCard && exhausted) p.energy += e.energyPerCard * exhausted;
        if (e.damagePerCard) {
          for (let i = 0; i < exhausted; i++) {
            const ts = targets(false);
            if (!ts.length) break;
            const r = hit(e.damagePerCard, ts[0]);
            log(cs, ev, `焚尽：对 ${ts[0].name} 造成 ${r.lost} 点生命伤害`);
          }
        }
        break;
      }
      case 'damagePerBurn': {
        for (const t of targets(e.aoe)) {
          const base = (t.statuses.burn ?? 0) * e.amount;
          if (base <= 0) continue;
          const r = hit(base, t);
          log(cs, ev, `热浪：对 ${t.name} 造成 ${r.lost} 点生命伤害`);
        }
        break;
      }
      case 'spreadBurn':
        for (const source of targets(false)) {
          const layers = source.statuses.burn ?? 0;
          if (layers <= 0) break;
          for (const t of aliveEnemies(cs)) {
            if (t.id === source.id) continue;
            addStatus(t, 'burn', layers, ev);
            log(cs, ev, `将 ${source.name} 的 ${layers} 层燃烧传播给 ${t.name}`);
          }
        }
        break;
      case 'burnToEmber':
        for (const t of targets(false)) {
          const layers = t.statuses.burn ?? 0;
          if (layers <= 0) continue;
          delete t.statuses.burn;
          ev.push({ type: 'status', targetId: t.id, status: 'burn', amount: -layers });
          const before = p.ember;
          gainEmber(cs, Math.min(layers * e.amount, e.max), ev, true);
          log(cs, ev, `消耗 ${t.name} 的 ${layers} 层燃烧，获得 ${p.ember - before} 点余烬`);
        }
        break;
      case 'consumeBurn': {
        for (const t of targets(false)) {
          const layers = t.statuses.burn ?? 0;
          if (layers <= 0) {
            log(cs, ev, `${t.name} 没有燃烧，引爆落空`);
            continue;
          }
          delete t.statuses.burn;
          ev.push({ type: 'status', targetId: t.id, status: 'burn', amount: -layers });
          const r = hit(layers * e.damagePer, t);
          log(cs, ev, `引爆 ${layers} 层燃烧：对 ${t.name} 造成 ${r.lost} 点生命伤害`);
        }
        break;
      }
      case 'doubleStatus': {
        for (const t of e.target === 'self' ? [p] : targets(false)) {
          const cur = t.statuses[e.status] ?? 0;
          if (cur > 0) {
            if (t.id === 'player' && e.status === 'strength') gainStrength(cs, cur, ev);
            else addStatus(t, e.status, cur, ev);
            log(cs, ev, `${t.name} 的${STATUSES[e.status].name}翻倍为 ${t.statuses[e.status]}`);
          }
        }
        break;
      }
      case 'replayDiscard':
        // 在完整出牌流程中结算：先记录来源技能，再重放确认时选定的牌。
        break;
      case 'returnExhausted': {
        for (let i = 0; i < e.count; i++) {
          const eligible = p.exhaust.map((c, index) => ({ c, index })).filter(({ c }) => !p.turnFlags[`endExhaust:${c.uid}`]);
          if (!eligible.length || p.hand.length >= HAND_MAX) break;
          let idx = eligible[0].index;
          if (e.selection === 'highestCost') {
            for (const { c, index } of eligible) {
              if (viewCard(c).cost > viewCard(p.exhaust[idx]).cost) idx = index;
            }
          } else idx = eligible[nextInt(cs.rng, 0, eligible.length - 1)].index;
          const [c] = p.exhaust.splice(idx, 1);
          p.hand.push(c);
          log(cs, ev, `「${viewCard(c).name}」从消耗区回到手牌`);
        }
        break;
      }
      case 'conditional':
        if (checkCondition(e.cond, p, target, view?.bonus ?? 0)) resolveEffects(cs, e.then, target, ev, extraDamage, view ? { ...view, charge: undefined } : undefined, transfer);
        break;
    }
  }
}

// ---------- 死亡处理 ----------
function handleEnemyDeaths(cs: CombatState, ev: CombatEvent[]) {
  const newlyDead = cs.enemies.filter((e) => e.hp <= 0 && !e.flags.deadHandled);
  for (const d of newlyDead) {
    d.flags.deadHandled = 1;
    d.moveId = null;
    log(cs, ev, `${d.name} 倒下了`);
    const returnedGold = d.flags.stolenGold ?? 0;
    if (returnedGold > 0) {
      d.flags.stolenGold = 0;
      cs.gold += returnedGold;
      log(cs, ev, `追回 ${d.name} 偷走的 ${returnedGold} 金币`);
    }
    const ddef = ENEMIES[d.defId];
    if (ddef.onDeath) {
      for (const a of ddef.onDeath) applyEnemyAction(cs, d, a, ev);
    }
    if (cs.player.statuses.sanguine && cs.player.hp > 0) {
      const healed = healPlayer(cs, cs.player.statuses.sanguine, ev);
      log(cs, ev, `饮血：回复 ${healed} 点生命`);
    }
    if (cs.player.hp > 0 && cs.player.statuses.burningRelay) {
      const burn = Math.max(d.statuses.burn ?? 0, cs.player.statuses.burningRelay);
      for (const ally of aliveEnemies(cs)) addStatus(ally, 'burn', burn, ev);
      log(cs, ev, `葬火传播：传播 ${burn} 层燃烧`);
    }
    triggerRelics(cs, 'enemyKilled', ev);
    for (const ally of aliveEnemies(cs)) {
      const def = ENEMIES[ally.defId];
      if (def.onAllyDeath) {
        for (const a of def.onAllyDeath({ enemy: ally, allies: aliveEnemies(cs), player: cs.player, rng: cs.rng })) {
          applyEnemyAction(cs, ally, a, ev);
        }
        log(cs, ev, `${ally.name} 因同伴倒下而暴怒`);
      }
    }
  }
  // 阶段检查
  for (const e of aliveEnemies(cs)) {
    const def = ENEMIES[e.defId];
    if (def.checkPhase) {
      const np = def.checkPhase(e);
      if (np !== null && np !== e.phase) {
        e.phase = np;
        ev.push({ type: 'phase', enemyId: e.id, phase: np });
        log(cs, ev, `${e.name} 进入第 ${np} 阶段！`);
        chooseIntent(cs, e);
      }
    }
  }
  if (aliveEnemies(cs).length === 0 && cs.outcome === 'ongoing') {
    cs.outcome = 'won';
    cs.phase = 'ended';
    log(cs, ev, cs.enemies.every(e => e.flags.escaped) ? '敌人全部逃离，未获得战利品。' : '战斗胜利！');
  }
}

function finishLost(cs: CombatState, ev: CombatEvent[]) {
  cs.outcome = 'lost';
  cs.phase = 'ended';
  log(cs, ev, '你倒在了灰烬中……');
}

// ---------- 回合结束 ----------
export function endPlayerTurn(input: CombatState): StepResult {
  const cs = clone(input);
  const ev: CombatEvent[] = [];
  if (cs.phase !== 'player' || cs.outcome !== 'ongoing') return { state: input, events: [] };
  const p = cs.player;
  cs.phase = 'enemy';
  log(cs, ev, '回合结束');
  if (p.statuses.metallicize) {
    gainBlock(p, p.statuses.metallicize, ev, cs);
    log(cs, ev, `钢铁意志：获得 ${p.statuses.metallicize} 点格挡`);
  }
  if (p.statuses.emberHeart) {
    gainEmber(cs, p.statuses.emberHeart, ev, false);
    log(cs, ev, `火种之心：获得 ${p.statuses.emberHeart} 点余烬`);
  }
  if (cs.relics.includes('charcoal_heart')) {
    gainEmber(cs, 1, ev, false);
    ev.push({ type: 'relic', relicId: 'charcoal_heart' });
    log(cs, ev, '炭心：获得 1 点余烬');
  }
  if (p.statuses.emberBastion && p.ember >= 3) {
    gainEmber(cs, -3, ev, false); gainBlock(p, p.statuses.emberBastion, ev, cs);
    log(cs, ev, '燃料壁垒：消耗 3 余烬维持护盾');
  }
  if (p.statuses.pyre) {
    for (const e of aliveEnemies(cs)) addStatus(e, 'burn', p.statuses.pyre, ev);
    log(cs, ev, `火葬：所有敌人获得 ${p.statuses.pyre} 层燃烧`);
  }
  if (cs.relics.includes('cinder_censer') && p.turnFlags.exhausted) {
    gainEmber(cs, 2, ev, false);
    ev.push({ type: 'relic', relicId: 'cinder_censer' });
    log(cs, ev, '余烬镣铐：获得 2 点余烬');
  }
  if (cs.relics.includes('kiln_spark') && (p.turnFlags.exhausted ?? 0) >= 2) {
    for (const e of aliveEnemies(cs)) addStatus(e, 'burn', 2, ev);
    relicProc(cs, 'kiln_spark', ev);
  }
  if (p.statuses.regen) {
    healPlayer(cs, p.statuses.regen, ev);
  }
  if (p.statuses.patientGuard && p.energy > 0) {
    gainBlock(p, p.statuses.patientGuard, ev, cs); addStatus(p, 'drawNext', 2, ev);
  }
  if (p.statuses.retainedWard) {
    const charged = p.hand.filter(c => !!viewCard(c).charge && (c.bonus ?? 0) > 0).sort((a, b) => a.bonus! - b.bonus!)[0];
    if (charged) {
      charged.bonus = clampCharge(charged.bonus ?? 0) - 1; gainBlock(p, p.statuses.retainedWard, ev, cs); addStatus(p, 'thorns', 1, ev);
      log(cs, ev, `星界护幕：消耗「${viewCard(charged).name}」1 点蓄力`);
    }
  }
  if (cs.relics.includes('anvil_shard') && p.block >= 10) {
    for (const e of aliveEnemies(cs)) {
      const lost = dealDamage(cs, e, 5, ev, 'player');
      log(cs, ev, `砧铁碎片：${e.name} 失去 ${lost} 点生命`);
    }
    ev.push({ type: 'relic', relicId: 'anvil_shard' });
    handleEnemyDeaths(cs, ev);
  }
  if (p.statuses.arcaneWard && p.hand.length) {
    const b = p.statuses.arcaneWard * p.hand.length;
    gainBlock(p, b, ev, cs);
    log(cs, ev, `守护符文：获得 ${b} 点格挡`);
  }
  if (cs.relics.includes('bastion_core') && p.block >= 15) { addStatus(p, 'energyNext', 1, ev); relicProc(cs, 'bastion_core', ev); }
  if (cs.relics.includes('war_standard') && p.attacksPlayedThisTurn >= 3) { gainStrength(cs, 1, ev); relicProc(cs, 'war_standard', ev); }
  triggerRelics(cs, 'turnEnd', ev);
  handleEnemyDeaths(cs, ev);
  if (cs.outcome !== 'ongoing') return { state: cs, events: ev };
  if (p.statuses.strengthDown) {
    addStatus(p, 'strength', -p.statuses.strengthDown, ev);
    log(cs, ev, `力竭：失去 ${p.statuses.strengthDown} 点力量`);
    delete p.statuses.strengthDown;
  }
  // 玩家减益递减
  decayStatuses(p, ev);
  // 在递减之后结算仍在手中的诅咒，让新施加的减益持续到敌人/下个玩家回合。
  // 固定本次手牌快照；诅咒触发遗物后新抽入的牌不追加结算，死亡或胜利立即停止。
  for (const c of [...p.hand]) {
    if (cs.outcome !== 'ongoing') break;
    const cv = viewCard(c);
    if (cv.handEndEffects.length) {
      log(cs, ev, `诅咒「${cv.name}」触发`);
      resolveEffects(cs, cv.handEndEffects, null, ev, 0, cv);
    }
  }
  if (p.hp <= 0) return { state: cs, events: ev };
  // 自动消耗优先于保留；消耗联动新抽入的状态牌也处理。
  // 本轮清理过的牌暂不可被自动取回，避免灰烬储备把同一实体反复消耗。
  while (cs.outcome === 'ongoing') {
    const index = p.hand.findIndex(c => viewCard(c).ethereal);
    if (index < 0) break;
    const [c] = p.hand.splice(index, 1);
    p.turnFlags[`endExhaust:${c.uid}`] = 1;
    exhaustCard(cs, c, ev);
    handleEnemyDeaths(cs, ev);
  }
  for (const key of Object.keys(p.turnFlags)) if (key.startsWith('endExhaust:')) delete p.turnFlags[key];
  if (cs.outcome !== 'ongoing') return { state: cs, events: ev };
  // 弃手牌（保留牌留在手上并蓄力）
  const kept: CardInstance[] = [];
  for (const c of p.hand) {
    const cv = viewCard(c);
    if (cv.retain || p.turnFlags[`retain:${c.uid}`]) {
      if (cv.charge) c.bonus = clampCharge((c.bonus ?? 0) + (cs.relics.includes('star_chart') ? 2 : 1) + (p.statuses.chargeMaster ?? 0));
      kept.push(c);
    } else p.discard.push(c);
  }
  if (kept.length) log(cs, ev, `保留 ${kept.length} 张牌`);
  if (cs.relics.includes('star_chart') && kept.some(c => viewCard(c).charge)) relicProc(cs, 'star_chart', ev);
  p.hand = kept;
  if ((cs.outcome as string) === 'won') cs.phase = 'ended';
  return { state: cs, events: ev };
}

function decayStatuses(ent: Entity, ev: CombatEvent[]) {
  for (const k of Object.keys(ent.statuses) as StatusId[]) {
    if (STATUSES[k].decays) addStatus(ent, k, -1, ev);
  }
}

// ---------- 敌人行动 ----------
export function enemyAct(input: CombatState, enemyId: string): StepResult {
  const cs = clone(input);
  const ev: CombatEvent[] = [];
  if (cs.outcome !== 'ongoing' || cs.phase !== 'enemy') return { state: input, events: [] };
  const e = cs.enemies.find((x) => x.id === enemyId);
  if (!e || !alive(e) || e.flags.acted) return { state: input, events: [] };
  e.flags.acted = 1;
  e.block = 0;
  if (e.statuses.burn) {
    const b = e.statuses.burn + (cs.relics.includes('tinderbox') ? 2 : 0);
    const lost = dealDamage(cs, e, b, ev, 'burn', true);
    log(cs, ev, `${e.name} 燃烧：失去 ${lost} 点生命`);
    if (!cs.player.statuses.everburn) addStatus(e, 'burn', -1, ev);
    handleEnemyDeaths(cs, ev);
    if (!alive(e) || cs.outcome !== 'ongoing') return { state: cs, events: ev };
  }
  const def = ENEMIES[e.defId];
  const move = def.moves.find((m) => m.id === e.moveId);
  if (move) {
    ev.push({ type: 'enemyMove', enemyId: e.id, moveName: move.name });
    log(cs, ev, `${e.name} 使用「${move.name}」`);
    for (const a of enemyMoveActions(cs, move)) {
      if (cs.outcome !== 'ongoing' || !alive(e)) break;
      applyEnemyAction(cs, e, a, ev);
    }
    e.moveHistory.push(move.id);
    if (move.id === 'awaken' || move.id === 'overdrive') e.flags.awakened = 1;
    else if (e.phase === 2) e.flags.p2turn = (e.flags.p2turn ?? 0) + 1;
  }
  if (e.statuses.ritual && alive(e)) {
    addStatus(e, 'strength', e.statuses.ritual, ev);
    log(cs, ev, `${e.name} 的仪式：获得 ${e.statuses.ritual} 点力量`);
  }
  e.turn += 1;
  decayStatuses(e, ev);
  handleEnemyDeaths(cs, ev);
  if (cs.outcome === 'ongoing' && alive(e)) chooseIntent(cs, e);
  return { state: cs, events: ev };
}

function applyEnemyAction(cs: CombatState, e: EnemyState, a: EnemyAction, ev: CombatEvent[]) {
  const p = cs.player;
  switch (a.kind) {
    case 'attack': {
      const times = a.times ?? 1;
      for (let i = 0; i < times; i++) {
        if (!alive(e) || p.hp <= 0) break;
        const dmg = calcDamage(scaleEnemyValue(a.amount, cs.difficulty?.attackMultiplier), e.statuses, p.statuses);
        const lost = dealDamage(cs, p, dmg, ev, 'enemy', a.piercing);
        log(cs, ev, `${e.name} ${a.piercing ? '穿透攻击' : '攻击'}：${dmg} 点伤害（${lost} 点生命${a.piercing ? '，无视格挡' : `，${dmg - lost} 点被格挡`}）`);
        const thorns = (p.statuses.thorns ?? 0) + (p.statuses.tempThorns ?? 0);
        if (thorns > 0) {
          const reflected = dealDamage(cs, e, thorns, ev, 'thorns');
          log(cs, ev, `荆棘：${e.name} 失去 ${reflected} 点生命`);
        }
        if (p.hp <= 0) {
          finishLost(cs, ev);
          return;
        }
      }
      break;
    }
    case 'block': {
      const b = calcBlock(scaleEnemyValue(a.amount, cs.difficulty?.blockMultiplier), e.statuses);
      gainBlock(e, b, ev);
      log(cs, ev, `${e.name} 获得 ${b} 点格挡`);
      break;
    }
    case 'status': {
      const targets: Entity[] = a.target === 'player' ? [p] : a.target === 'self' ? [e] : aliveEnemies(cs);
      for (const t of targets) {
        addStatus(t, a.status, a.amount, ev);
        log(cs, ev, `${t.name} ${a.amount < 0 ? '减少' : '获得'} ${Math.abs(a.amount)} 层${STATUSES[a.status].name}`);
      }
      break;
    }
    case 'heal':
      e.hp = Math.min(e.maxHp, e.hp + a.amount);
      ev.push({ type: 'heal', targetId: e.id, amount: a.amount });
      break;
    case 'healWeakest': {
      const target = aliveEnemies(cs).reduce<EnemyState | null>((lowest, ally) =>
        !lowest || ally.hp / ally.maxHp < lowest.hp / lowest.maxHp ? ally : lowest, null);
      if (!target) break;
      const amount = Math.min(a.amount, target.maxHp - target.hp);
      target.hp += amount;
      ev.push({ type: 'heal', targetId: target.id, amount });
      log(cs, ev, `${e.name} 为${target.name}回复 ${amount} 点生命`);
      break;
    }
    case 'escape': {
      const taken = e.flags.stolenGold ?? 0;
      e.flags.escaped = 1;
      e.flags.escapedGold = taken;
      e.flags.stolenGold = 0;
      // 离场复用零生命的不可选中状态，但绝不进入死亡钩子或返还金币。
      e.flags.deadHandled = 1;
      e.hp = 0; e.block = 0; e.statuses = {}; e.moveId = null;
      log(cs, ev, `${e.name} 逃跑了${taken > 0 ? `，带走 ${taken} 金币` : ''}。`);
      break;
    }
    case 'loseHp': {
      const lost = dealDamage(cs, e, Math.min(a.amount, Math.max(0, e.hp - 1)), ev, 'enemy', true);
      log(cs, ev, `${e.name} 失去 ${lost} 点生命`);
      break;
    }
    case 'stealGold': {
      const amount = Math.min(cs.gold, a.amount);
      cs.gold -= amount;
      e.flags.stolenGold = (e.flags.stolenGold ?? 0) + amount;
      log(cs, ev, amount > 0 ? `${e.name} 偷走了 ${amount} 金币！击败它可追回。` : `${e.name} 没有偷到金币。`);
      break;
    }
    case 'addCardToDiscard':
    case 'addCardToDraw':
      for (let i = 0; i < a.count; i++) {
        const card = { uid: newUid(cs), defId: a.cardId, upgraded: false };
        if (a.kind === 'addCardToDraw') p.draw.splice(nextInt(cs.rng, 0, p.draw.length), 0, card);
        else p.discard.push(card);
      }
      log(cs, ev, `${a.count} 张「${CARDS[a.cardId].name}」被塞进你的${a.kind === 'addCardToDraw' ? '抽牌堆随机位置' : '弃牌堆'}（仅本场战斗）`);
      break;
    case 'clearDebuffs':
      for (const k of Object.keys(e.statuses) as StatusId[]) {
        if (STATUSES[k].kind !== 'debuff') continue;
        const keep = k === 'burn' ? Math.ceil((e.statuses[k] ?? 0) * Math.max(0, Math.min(1, a.keepBurnRatio ?? 0))) : 0;
        if (keep > 0) e.statuses[k] = keep;
        else delete e.statuses[k];
      }
      log(cs, ev, `${e.name} ${a.keepBurnRatio ? "清除其他负面状态，保留部分燃烧" : "清除了所有负面状态"}`);
      break;
  }
}

/** 敌人全部行动完毕后，开始玩家新回合 */
export function startPlayerTurn(input: CombatState): StepResult {
  const cs = clone(input);
  const ev: CombatEvent[] = [];
  if (cs.outcome !== 'ongoing' || cs.phase !== 'enemy') return { state: input, events: [] };
  if (cs.enemies.some(e => e.damageGuard) && aliveEnemies(cs).some(e => !e.flags.acted)) return { state: input, events: [] };
  startPlayerTurnInPlace(cs, ev);
  return { state: cs, events: ev };
}

/** 战斗中仍由敌人持有、尚未返还的金币总量。 */
export function stolenGold(cs: CombatState): number {
  return cs.enemies.reduce((s, e) => s + (e.flags.stolenGold ?? 0), 0);
}

export function statusEntries(s: Statuses): { id: StatusId; amount: number }[] {
  return (Object.keys(s) as StatusId[]).map((id) => ({ id, amount: s[id] ?? 0 })).filter((x) => x.amount !== 0);
}

export type { PlayerCombat };
