import { CARDS } from '../data/cards';
import { ENEMIES } from '../data/enemies';
import { STATUSES } from '../data/statuses';
import { RELICS } from '../data/relics';
import { calcBlock, calcDamage, checkCondition, viewCard, type CardView } from './cards';
import { scaleEnemyValue } from './difficulty';
import { ensurePowerInstances } from './powers';
import { nextInt, pick, shuffle, type RngState } from './rng';
import type {
  CardInstance,
  CharacterId,
  CombatEvent,
  CombatDifficulty,
  CombatState,
  Effect,
  EnemyAction,
  EnemyState,
  Entity,
  Intent,
  PlayerCombat,
  RelicCombatTrigger,
  RelicCondition,
  StatusId,
  Statuses,
} from './types';

export const EMBER_MAX = 10;
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

/** 对实体造成伤害（经过格挡）。返回实际损失生命。 */
function dealDamage(
  _cs: CombatState,
  target: Entity,
  amount: number,
  ev: CombatEvent[],
  source: 'player' | 'enemy' | 'thorns' | 'burn' | 'aura',
  ignoreBlock = false,
): number {
  let blocked = 0;
  let remaining = amount;
  if (!ignoreBlock && target.block > 0) {
    blocked = Math.min(target.block, remaining);
    target.block -= blocked;
    remaining -= blocked;
  }
  const before = target.hp;
  target.hp = Math.max(0, target.hp - remaining);
  const lost = before - target.hp;
  ev.push({ type: 'damage', targetId: target.id, amount: lost, blocked, source });
  if (target.hp === 0) ev.push({ type: 'death', targetId: target.id });
  return lost;
}

function gainBlock(entity: Entity, amount: number, ev: CombatEvent[], cs?: CombatState) {
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
  }
  if (p.statuses.bloodArmor) {
    gainBlock(p, p.statuses.bloodArmor, ev, cs);
    log(cs, ev, `猩红护甲：获得 ${p.statuses.bloodArmor} 点格挡`);
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
          case 'heal': {
            const healed = Math.min(effect.amount, p.maxHp - p.hp);
            p.hp += healed;
            if (healed) ev.push({ type: 'heal', targetId: p.id, amount: healed });
            break;
          }
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
            for (const c of p.hand) if (viewCard(c).retain && viewCard(c).charge) c.bonus = (c.bonus ?? 0) + effect.amount;
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
function exhaustCard(cs: CombatState, card: CardInstance, ev: CombatEvent[]) {
  const p = cs.player;
  p.exhaust.push(card);
  p.turnFlags.exhausted = (p.turnFlags.exhausted ?? 0) + 1;
  log(cs, ev, `「${viewCard(card).name}」被消耗`);
  if (p.statuses.ashFeast) {
    gainBlock(p, p.statuses.ashFeast, ev, cs);
    log(cs, ev, `灰烬盛宴：获得 ${p.statuses.ashFeast} 点格挡`);
  }
  if (p.statuses.kindling) {
    const targets = aliveEnemies(cs);
    if (targets.length) {
      const t = pick(cs.rng, targets);
      const dmg = calcDamage(p.statuses.kindling, {}, t.statuses);
      dealDamage(cs, t, dmg, ev, 'player');
      log(cs, ev, `火种传递：对 ${t.name} 造成 ${dmg} 点伤害`);
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
      const healed = Math.min(2, p.maxHp - p.hp); p.hp += healed;
      ev.push({ type: 'heal', targetId: p.id, amount: healed }); relicProc(cs, 'phoenix_ash', ev);
    }
  }
  triggerRelics(cs, 'exhaust', ev);
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
export function enemyIntent(cs: CombatState, e: EnemyState): Intent | null {
  if (!e.moveId) return null;
  const def = ENEMIES[e.defId];
  const move = def.moves.find((m) => m.id === e.moveId);
  if (!move) return null;
  const atk = move.actions.find((a) => a.kind === 'attack');
  if (atk && atk.kind === 'attack') {
    const amount = calcDamage(scaleEnemyValue(atk.amount, cs.difficulty?.attackMultiplier), e.statuses, cs.player.statuses);
    const kind = move.intent === 'attack_debuff' || move.intent === 'special' ? 'attack_debuff' : 'attack';
    return { kind, amount, times: atk.times ?? 1 };
  }
  switch (move.intent) {
    case 'defend':
      return { kind: 'defend' };
    case 'buff':
      return { kind: 'buff' };
    case 'debuff':
      return { kind: 'debuff' };
    case 'defend_buff':
      return { kind: 'defend_buff' };
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
): StepResult {
  const ev: CombatEvent[] = [];
  const cs: CombatState = {
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
    gainEmber(cs, 4, ev, false);
    ev.push({ type: 'relic', relicId: 'ember_censer' });
    log(cs, ev, '余火香炉：获得 4 点余烬');
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
  if (cs.relics.includes('old_tome')) {
    addStatus(cs.player, 'echo', 1, ev);
    ev.push({ type: 'relic', relicId: 'old_tome' });
    log(cs, ev, '旧书：获得 1 层回响');
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
  log(cs, ev, `—— 第 ${cs.turn} 回合 ——`);
  p.turnFlags = {};
  for (const power of ensurePowerInstances(p)) if (power.status === 'mirror') power.progress = 0;
  if (!p.statuses.barricade) p.block = 0;
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
      for (const e of aliveEnemies(cs)) dealDamage(cs, e, dmg, ev, 'aura');
      log(cs, ev, `焰柱：对所有敌人造成 ${dmg} 点伤害`);
      handleEnemyDeaths(cs, ev);
      if (cs.outcome === 'won') return;
    }
  }
  p.energy = p.maxEnergy;
  if (cs.turn === 1 && cs.relics.includes('dawn_crystal')) { p.energy += 1; gainEmber(cs, 2, ev, false); relicProc(cs, 'dawn_crystal', ev); }
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
  if (cs.turn > 1 && cs.relics.includes('lens') && p.hand.length > 0) {
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
  let n = 5 + studyBeforeRelics;
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
export function canPlayCard(cs: CombatState, card: CardInstance): { ok: boolean; reason?: string } {
  const v = viewCard(card);
  if (cs.phase !== 'player' || cs.outcome !== 'ongoing') return { ok: false, reason: '现在不能出牌' };
  if (v.type === 'curse') return { ok: false, reason: '诅咒牌无法打出' };
  if (v.cost > cs.player.energy) return { ok: false, reason: '能量不足' };
  if (v.requireEmber > cs.player.ember) return { ok: false, reason: `需要 ${v.requireEmber} 点余烬` };
  if (v.target === 'enemy' && aliveEnemies(cs).length === 0) return { ok: false, reason: '没有目标' };
  return { ok: true };
}

export function needsTarget(card: CardInstance): boolean {
  return viewCard(card).target === 'enemy';
}

export function playCard(input: CombatState, uid: string, targetId: string | null): StepResult {
  const cs = clone(input);
  const ev: CombatEvent[] = [];
  const p = cs.player;
  const idx = p.hand.findIndex((c) => c.uid === uid);
  if (idx < 0) return { state: input, events: [] };
  const card = p.hand[idx];
  const v = viewCard(card);
  const check = canPlayCard(cs, card);
  if (!check.ok) return { state: input, events: [] };
  let target: EnemyState | null = null;
  if (v.target === 'enemy') {
    target = cs.enemies.find((e) => e.id === targetId && alive(e)) ?? null;
    if (!target) return { state: input, events: [] };
  }
  p.energy -= v.cost;
  p.hand.splice(idx, 1);
  // 只计入打出本牌之前已生效的余音，新打出的能力不会计入自己。
  const activeTempos = ensurePowerInstances(p).filter(power => power.status === 'tempo');
  // “下一张”只消费打牌之前已有的回响，不能被本牌刚获得的回响重复自己。
  const hadEcho = (p.statuses.echo ?? 0) > 0;
  ev.push({ type: 'cardPlayed', uid, name: v.name });
  log(cs, ev, `打出「${v.name}」${target ? ` → ${target.name}` : ''}`);

  const isFirstAttack = v.type === 'attack' && p.attacksPlayedThisTurn === 0;
  let extraDamage = 0;
  if (v.type === 'attack') {
    if (isFirstAttack && cs.relics.includes('flint')) {
      extraDamage += 4;
      ev.push({ type: 'relic', relicId: 'flint' });
    }
    if (p.statuses.crescendo) extraDamage += p.attacksPlayedThisTurn * p.statuses.crescendo;
  }

  resolveEffects(cs, v.effects, target, ev, extraDamage, v);

  // 回响和每张镜像分别贡献一次重放；重放不算再次打牌。
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
      log(cs, ev, `${source}：效果再次触发`);
      if (cs.relics.includes('crystal_chime') && !p.turnFlags.chime) {
        p.turnFlags.chime = 1; gainBlock(p, 5, ev, cs); relicProc(cs, 'crystal_chime', ev);
      }
      if (cs.relics.includes('tuning_fork')) {
        gainEmber(cs, 1, ev, false);
        ev.push({ type: 'relic', relicId: 'tuning_fork' });
      }
      triggerRelics(cs, 'echo', ev);
      resolveEffects(cs, v.effects, target, ev, extraDamage, v);
    }
  }

  // 计数
  p.cardsPlayedThisTurn += 1;
  if (v.type === 'attack') p.attacksPlayedThisTurn += 1;
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

function resolveEffects(cs: CombatState, effects: Effect[], target: EnemyState | null, ev: CombatEvent[], extraDamage: number, view?: CardView) {
  const p = cs.player;
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
    return { dmg, lost };
  };
  const spendEmber = (): number => {
    let e = p.ember;
    if (cs.relics.includes('ember_censer')) e = Math.max(3, e);
    gainEmber(cs, -p.ember, ev, false);
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
        for (let i = 0; i < times; i++) {
          const ts = targets(e.aoe);
          if (ts.length === 0) break;
          for (const t of ts) {
            const r = hit(e.amount, t, extra);
            log(cs, ev, `对 ${t.name} 造成 ${r.dmg} 点伤害`);
            if (e.lifesteal && r.lost > 0 && p.hp > 0) {
              const before = p.hp;
              p.hp = Math.min(p.maxHp, p.hp + Math.min(r.lost, e.lifestealCap ?? Infinity));
              if (p.hp > before) {
                ev.push({ type: 'heal', targetId: 'player', amount: p.hp - before });
                log(cs, ev, `吸血：回复 ${p.hp - before} 点生命`);
              }
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
            log(cs, ev, `以血还血：对 ${t.name} 额外造成 ${r.dmg} 点伤害`);
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
        log(cs, ev, `获得 ${e.amount} 点临时力量`);
        break;
      case 'doubleEmber':
        gainEmber(cs, p.ember, ev, false);
        log(cs, ev, `余烬翻倍为 ${p.ember}`);
        break;
      case 'discardRandom':
        for (let i = 0; i < e.count && p.hand.length; i++) {
          const idx = nextInt(cs.rng, 0, p.hand.length - 1);
          const [c] = p.hand.splice(idx, 1);
          p.discard.push(c);
          log(cs, ev, `弃置「${viewCard(c).name}」`);
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
          log(cs, ev, `以格挡对 ${t.name} 造成 ${r.dmg} 点伤害`);
        }
        break;
      }
      case 'damagePerAttack': {
        const times = p.attacksPlayedThisTurn + 1;
        for (let i = 0; i < times; i++) {
          const ts = targets(false);
          if (ts.length === 0) break;
          const r = hit(e.amount, ts[0]);
          log(cs, ev, `对 ${ts[0].name} 造成 ${r.dmg} 点伤害`);
        }
        break;
      }
      case 'damagePerEmber': {
        const bonus = Math.floor(p.ember / (e.per ?? 1)) * e.amount;
        if (bonus > 0) {
          for (const t of targets(false)) {
            const r = hit(bonus, t);
            log(cs, ev, `余烬加成：对 ${t.name} 额外造成 ${r.dmg} 点伤害`);
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
      case 'draw':
        drawCards(cs, e.amount, ev);
        break;
      case 'energy':
        p.energy += e.amount;
        break;
      case 'gainEmber':
        gainEmber(cs, e.amount, ev, e.amount > 0);
        break;
      case 'emberBurst': {
        const n = spendEmber();
        log(cs, ev, `消耗 ${n} 点余烬`);
        if (e.damagePer) {
          for (const t of targets(e.aoe)) {
            const r = hit(e.damagePer * n, t);
            log(cs, ev, `余烬爆发：对 ${t.name} 造成 ${r.dmg} 点伤害`);
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
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + e.amount);
        ev.push({ type: 'heal', targetId: 'player', amount: p.hp - before });
        log(cs, ev, `回复 ${p.hp - before} 点生命`);
        break;
      }
      case 'exhaustHand': {
        const n = e.count === 'all' ? p.hand.length : Math.min(e.count, p.hand.length);
        let exhausted = 0;
        for (let i = 0; i < n; i++) {
          if (!p.hand.length) break;
          const idx = e.count === 'all' ? 0 : Math.floor(nextInt(cs.rng, 0, p.hand.length - 1));
          const [c] = p.hand.splice(idx, 1);
          exhaustCard(cs, c, ev);
          exhausted++;
        }
        if (e.energyPerCard && exhausted) p.energy += e.energyPerCard * exhausted;
        if (e.damagePerCard) {
          for (let i = 0; i < exhausted; i++) {
            const ts = targets(false);
            if (!ts.length) break;
            const r = hit(e.damagePerCard, ts[0]);
            log(cs, ev, `焚尽：对 ${ts[0].name} 造成 ${r.dmg} 点伤害`);
          }
        }
        break;
      }
      case 'damagePerBurn': {
        for (const t of targets(e.aoe)) {
          const base = (t.statuses.burn ?? 0) * e.amount;
          if (base <= 0) continue;
          const r = hit(base, t);
          log(cs, ev, `热浪：对 ${t.name} 造成 ${r.dmg} 点伤害`);
        }
        break;
      }
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
          log(cs, ev, `引爆 ${layers} 层燃烧：对 ${t.name} 造成 ${r.dmg} 点伤害`);
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
      case 'returnExhausted': {
        for (let i = 0; i < e.count; i++) {
          if (!p.exhaust.length || p.hand.length >= HAND_MAX) break;
          const idx = nextInt(cs.rng, 0, p.exhaust.length - 1);
          const [c] = p.exhaust.splice(idx, 1);
          p.hand.push(c);
          log(cs, ev, `「${viewCard(c).name}」从消耗区回到手牌`);
        }
        break;
      }
      case 'conditional':
        if (checkCondition(e.cond, p, target)) resolveEffects(cs, e.then, target, ev, extraDamage);
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
    const ddef = ENEMIES[d.defId];
    if (ddef.onDeath) {
      for (const a of ddef.onDeath) applyEnemyAction(cs, d, a, ev);
    }
    if (cs.player.statuses.sanguine && cs.player.hp > 0) {
      const before = cs.player.hp;
      cs.player.hp = Math.min(cs.player.maxHp, cs.player.hp + cs.player.statuses.sanguine);
      ev.push({ type: 'heal', targetId: 'player', amount: cs.player.hp - before });
      log(cs, ev, `饮血：回复 ${cs.player.hp - before} 点生命`);
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
    log(cs, ev, '战斗胜利！');
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
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + p.statuses.regen);
    ev.push({ type: 'heal', targetId: 'player', amount: p.hp - before });
  }
  if (cs.relics.includes('anvil_shard') && p.block >= 10) {
    for (const e of aliveEnemies(cs)) dealDamage(cs, e, 5, ev, 'player');
    ev.push({ type: 'relic', relicId: 'anvil_shard' });
    log(cs, ev, '砧铁碎片：对所有敌人造成 5 点伤害');
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
  // 弃手牌（保留牌留在手上并蓄力）
  const kept: CardInstance[] = [];
  for (const c of p.hand) {
    const cv = viewCard(c);
    if (cv.retain) {
      if (cv.charge) c.bonus = (c.bonus ?? 0) + (cs.relics.includes('star_chart') ? 2 : 1);
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
    dealDamage(cs, e, b, ev, 'burn', true);
    log(cs, ev, `${e.name} 燃烧：受到 ${b} 点伤害`);
    if (!cs.player.statuses.everburn) addStatus(e, 'burn', -1, ev);
    handleEnemyDeaths(cs, ev);
    if (!alive(e) || cs.outcome !== 'ongoing') return { state: cs, events: ev };
  }
  const def = ENEMIES[e.defId];
  const move = def.moves.find((m) => m.id === e.moveId);
  if (move) {
    ev.push({ type: 'enemyMove', enemyId: e.id, moveName: move.name });
    log(cs, ev, `${e.name} 使用「${move.name}」`);
    for (const a of move.actions) {
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
        const lost = dealDamage(cs, p, dmg, ev, 'enemy');
        log(cs, ev, `${e.name} 攻击：${dmg} 点伤害（${lost} 点生命，${dmg - lost} 点被格挡）`);
        if (p.statuses.thorns) {
          dealDamage(cs, e, p.statuses.thorns, ev, 'thorns');
          log(cs, ev, `荆棘：对 ${e.name} 造成 ${p.statuses.thorns} 点伤害`);
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
        log(cs, ev, `${t.name} 获得 ${a.amount} 层${STATUSES[a.status].name}`);
      }
      break;
    }
    case 'heal':
      e.hp = Math.min(e.maxHp, e.hp + a.amount);
      ev.push({ type: 'heal', targetId: e.id, amount: a.amount });
      break;
    case 'loseHp':
      e.hp = Math.max(1, e.hp - a.amount);
      ev.push({ type: 'damage', targetId: e.id, amount: a.amount, blocked: 0, source: 'enemy' });
      log(cs, ev, `${e.name} 失去 ${a.amount} 点生命`);
      break;
    case 'stealGold':
      e.flags.stolenGold = (e.flags.stolenGold ?? 0) + a.amount;
      log(cs, ev, `${e.name} 偷走了 ${a.amount} 金币！`);
      break;
    case 'addCardToDiscard':
      for (let i = 0; i < a.count; i++) p.discard.push({ uid: newUid(cs), defId: a.cardId, upgraded: false });
      log(cs, ev, `${a.count} 张「${CARDS[a.cardId].name}」被塞进你的弃牌堆（仅本场战斗）`);
      break;
    case 'clearDebuffs':
      for (const k of Object.keys(e.statuses) as StatusId[]) {
        if (STATUSES[k].kind === 'debuff') delete e.statuses[k];
      }
      log(cs, ev, `${e.name} 清除了所有负面状态`);
      break;
  }
}

/** 敌人全部行动完毕后，开始玩家新回合 */
export function startPlayerTurn(input: CombatState): StepResult {
  const cs = clone(input);
  const ev: CombatEvent[] = [];
  if (cs.outcome !== 'ongoing') return { state: input, events: [] };
  startPlayerTurnInPlace(cs, ev);
  return { state: cs, events: ev };
}

/** 战斗中被偷走的金币总量 */
export function stolenGold(cs: CombatState): number {
  return cs.enemies.reduce((s, e) => s + (e.flags.stolenGold ?? 0), 0);
}

export function statusEntries(s: Statuses): { id: StatusId; amount: number }[] {
  return (Object.keys(s) as StatusId[]).map((id) => ({ id, amount: s[id] ?? 0 })).filter((x) => x.amount !== 0);
}

export type { PlayerCombat };
