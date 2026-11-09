import { CARDS } from '../data/cards';
import { STATUSES } from '../data/statuses';
import type { CardDef, CardInstance, Condition, Effect, Entity, PlayerCombat, Statuses } from './types';

/** 当前卡牌（含升级）生效的定义视图 */
export interface CardView {
  id: string;
  name: string;
  type: CardDef['type'];
  rarity: CardDef['rarity'];
  archetype: CardDef['archetype'];
  cost: number;
  target: CardDef['target'];
  effects: Effect[];
  handEndEffects: Effect[];
  exhaust: boolean;
  retain: boolean;
  charge?: { damage?: number; block?: number };
  requireEmber: number;
  flavor?: string;
  upgraded: boolean;
  /** 蓄力层数 */
  bonus: number;
}

export function viewCard(card: CardInstance): CardView {
  const d = CARDS[card.defId];
  if (!d) throw new Error(`未知卡牌 ${card.defId}`);
  const u = card.upgraded ? d.upgrade : {};
  return {
    id: d.id,
    name: card.upgraded ? (u.name ?? d.name + '+') : d.name,
    type: d.type,
    rarity: d.rarity,
    archetype: d.archetype,
    cost: u.cost ?? d.cost,
    target: d.target,
    effects: u.effects ?? d.effects,
    handEndEffects: d.handEndEffects ?? [],
    exhaust: u.exhaust ?? d.exhaust ?? false,
    retain: d.retain ?? false,
    charge: d.charge,
    requireEmber: u.requireEmber ?? d.requireEmber ?? 0,
    flavor: d.flavor,
    upgraded: card.upgraded,
    bonus: card.bonus ?? 0,
  };
}

export function viewDef(defId: string, upgraded = false): CardView {
  return viewCard({ uid: 'preview', defId, upgraded });
}

// ---------- 伤害 / 格挡计算 ----------
export function calcDamage(base: number, attacker: Statuses, target: Statuses | null, extra = 0): number {
  let dmg = base + (attacker.strength ?? 0) + extra;
  if (attacker.weak) dmg = Math.floor(dmg * 0.75);
  if (target?.vulnerable) dmg = Math.floor(dmg * 1.5);
  return Math.max(0, dmg);
}

export function calcBlock(base: number, owner: Statuses): number {
  let b = base + (owner.dexterity ?? 0);
  if (owner.frail) b = Math.floor(b * 0.75);
  return Math.max(0, b);
}

export function checkCondition(cond: Condition, p: PlayerCombat, target: Entity | null = null): boolean {
  switch (cond.kind) {
    case 'targetBurning':
      return !!target && (target.statuses.burn ?? 0) > 0;
    case 'lostHpThisTurn':
      return p.hpLostThisTurn > 0;
    case 'hasEcho':
      return (p.statuses.echo ?? 0) > 0;
    case 'emberAtLeast':
      return p.ember >= cond.value;
    case 'attacksThisTurnAtLeast':
      return p.attacksPlayedThisTurn >= cond.value;
    case 'cardsThisTurnAtLeast':
      return p.cardsPlayedThisTurn >= cond.value;
    case 'hasBlock':
      return p.block > 0;
  }
}

function condText(cond: Condition): string {
  switch (cond.kind) {
    case 'emberAtLeast':
      return `若余烬 ≥ ${cond.value}`;
    case 'attacksThisTurnAtLeast':
      return `若本回合已打出 ${cond.value} 张以上攻击牌`;
    case 'cardsThisTurnAtLeast':
      return `若本回合已打出 ${cond.value} 张以上卡牌`;
    case 'hasBlock':
      return '若拥有格挡';
    case 'targetBurning':
      return '若目标正在燃烧';
    case 'lostHpThisTurn':
      return '若本回合失去过生命';
    case 'hasEcho':
      return '若拥有回响';
  }
}

export interface DescribeContext {
  player: PlayerCombat;
  target: Entity | null;
  relics: string[];
  /** 此牌打出时是否为本回合第一张攻击牌 */
  isFirstAttack: boolean;
  /** 打出本牌时已记入的战鼓加成 */
  crescendoBonus: number;
}

/** 将伤害数值按当前状态修正；无上下文时返回基础值 */
function dmgText(base: number, ctx: DescribeContext | null, extra = 0): string {
  if (!ctx) return `${base}`;
  const bonus = extra + ctx.crescendoBonus + (ctx.isFirstAttack && ctx.relics.includes('flint') ? 4 : 0);
  const v = calcDamage(base, ctx.player.statuses, ctx.target?.statuses ?? null, bonus);
  if (v !== base) return `${v}`;
  return `${base}`;
}

function blockText(base: number, ctx: DescribeContext | null): string {
  if (!ctx) return `${base}`;
  const v = calcBlock(base, ctx.player.statuses);
  return `${v}`;
}

function emberSpendAmount(ctx: DescribeContext | null): number | null {
  if (!ctx) return null;
  let e = ctx.player.ember;
  if (ctx.relics.includes('ember_censer')) e = Math.max(3, e);
  return e;
}

export function describeEffects(effects: Effect[], ctx: DescribeContext | null, view?: CardView): string {
  // 同一张牌先增力量再攻击时，后续数字要使用增长后的力量；预览不能修改战斗。
  if (ctx) ctx = { ...ctx, player: { ...ctx.player, statuses: { ...ctx.player.statuses }, turnFlags: { ...ctx.player.turnFlags } } };
  const previewStrength = (amount: number) => {
    if (!ctx || amount <= 0) return;
    if (ctx.relics.includes('war_horn') && !ctx.player.turnFlags.warHorn) {
      ctx.player.turnFlags.warHorn = 1;
      amount++;
    }
    ctx.player.statuses.strength = (ctx.player.statuses.strength ?? 0) + amount;
  };
  const parts: string[] = [];
  const chargeDmg = view?.charge?.damage ? view.charge.damage * view.bonus : 0;
  const chargeBlk = view?.charge?.block ? view.charge.block * view.bonus : 0;
  for (const e of effects) {
    switch (e.kind) {
      case 'damage': {
        const t = e.aoe ? '对所有敌人' : '';
        const times = e.times && e.times > 1 ? ` × ${e.times}` : '';
        let extra = chargeDmg;
        const notes: string[] = [];
        if (e.strengthMult) {
          notes.push(`（额外 +力量 × ${e.strengthMult}）`);
          if (ctx) extra += (ctx.player.statuses.strength ?? 0) * e.strengthMult;
        }
        if (e.perHandCard) {
          notes.push(`，手牌中每有一张牌 +${e.perHandCard}`);
          if (ctx) extra += Math.max(0, ctx.player.hand.length - 1) * e.perHandCard;
        }
        const healing = e.lifesteal ? `，按实际扣除的敌人生命回复生命${e.lifestealCap === undefined ? '' : `（每次命中最多 ${e.lifestealCap} 点）`}` : '';
        parts.push(`${t}造成 ${dmgText(e.amount, ctx, extra)} 点伤害${times}${notes.join('')}${healing}`);
        break;
      }
      case 'damagePerHpLost': {
        const cur = ctx ? `（当前 +${dmgText(ctx.player.hpLostThisTurn * e.mult, ctx) }）` : '';
        parts.push(`额外造成本回合失去生命 × ${e.mult} 的伤害${cur}`);
        break;
      }
      case 'loseHp':
        parts.push(`失去 ${e.amount} 点生命`);
        break;
      case 'tempStrength':
        parts.push(`获得 ${e.amount} 点力量，回合结束时失去`);
        previewStrength(e.amount);
        break;
      case 'doubleEmber':
        parts.push(`余烬翻倍${ctx ? `（${ctx.player.ember} → ${Math.min(10, ctx.player.ember * 2)}）` : ''}`);
        break;
      case 'discardRandom':
        parts.push(`随机弃置 ${e.count} 张手牌`);
        break;
      case 'damageByBlock': {
        const t = e.aoe ? '对所有敌人' : '';
        const consume = e.consume ? '消耗所有格挡，' : '';
        const multiplier = e.mult && e.mult !== 1 ? ` × ${e.mult}` : '';
        if (ctx) {
          // 若同一张牌先获得格挡，描述时考虑该格挡
          let blk = ctx.player.block;
          for (const pre of effects) {
            if (pre === e) break;
            if (pre.kind === 'block') blk += calcBlock(pre.amount, ctx.player.statuses);
          }
          parts.push(`${consume}${t}造成等于当前格挡${multiplier}${e.bonus ? ` +${e.bonus}` : ''}的伤害（${dmgText(blk * (e.mult ?? 1) + (e.bonus ?? 0), ctx)}）`);
        } else {
          parts.push(`${consume}${t}造成等于当前格挡${multiplier}${e.bonus ? ` +${e.bonus}` : ''}的伤害`);
        }
        break;
      }
      case 'damagePerAttack': {
        const n = ctx ? ctx.player.attacksPlayedThisTurn + 1 : null;
        parts.push(`造成 ${dmgText(e.amount, ctx)} 点伤害，次数等于本回合打出的攻击牌数（含本牌）${n !== null ? `（当前 ${n} 次）` : ''}`);
        break;
      }
      case 'damagePerEmber': {
        const per = e.per ?? 1;
        const bonus = ctx ? Math.floor(ctx.player.ember / per) * e.amount : null;
        parts.push(`每 ${per} 点余烬额外 +${e.amount} 伤害（不消耗）${bonus !== null ? `（当前 +${bonus}）` : ''}`);
        break;
      }
      case 'block':
        parts.push(`获得 ${blockText(e.amount + chargeBlk, ctx)} 点格挡`);
        break;
      case 'draw':
        parts.push(`抽 ${e.amount} 张牌`);
        break;
      case 'energy':
        parts.push(`获得 ${e.amount} 点能量`);
        break;
      case 'gainEmber':
        if (e.amount >= 0) {
          const bonus = ctx && ctx.relics.includes('ash_hourglass') ? 1 : 0;
          parts.push(`获得 ${e.amount + bonus} 点余烬`);
        } else parts.push(`消耗 ${-e.amount} 点余烬`);
        break;
      case 'emberBurst': {
        const spend = emberSpendAmount(ctx);
        const segs: string[] = [];
        if (e.damagePer) {
          const t = e.aoe ? '对所有敌人' : '';
          const total = spend !== null ? `（当前 ${dmgText(e.damagePer * spend, ctx)}）` : '';
          segs.push(`${t}造成每点余烬 ${e.damagePer} 的伤害${total}`);
        }
        if (e.blockPer) {
          const total = spend !== null ? `（当前 ${blockText(e.blockPer * spend, ctx)}）` : '';
          segs.push(`获得每点余烬 ${e.blockPer} 的格挡${total}`);
        }
        parts.push(`消耗所有余烬：${segs.join('，')}`);
        break;
      }
      case 'status': {
        const name = STATUSES[e.status].name;
        const tgt = e.target === 'self' ? '' : e.target === 'all' ? '对所有敌人' : '对目标';
        if (STATUSES[e.status].kind === 'power' && e.target === 'self') {
          parts.push(STATUSES[e.status].description(e.amount).replace(/。$/, ''));
        } else if (e.target === 'self') {
          parts.push(`获得 ${e.amount} 层${name}`);
        } else {
          parts.push(`${tgt}施加 ${e.amount} 层${name}`);
        }
        if (e.target === 'self' && e.status === 'strength') previewStrength(e.amount);
        break;
      }
      case 'heal':
        parts.push(`回复 ${e.amount} 点生命`);
        break;
      case 'exhaustHand': {
        const what = e.count === 'all' ? '手牌中的所有牌' : `手牌中随机 ${e.count} 张牌`;
        const n = ctx ? (e.count === 'all' ? Math.max(0, ctx.player.hand.length - 1) : null) : null;
        const segs: string[] = [`消耗${what}`];
        if (e.damagePerCard) segs.push(`每消耗一张造成 ${dmgText(e.damagePerCard, ctx)} 点伤害${n !== null ? `（当前 ${n} 张）` : ''}`);
        if (e.energyPerCard) segs.push(`每消耗一张获得 ${e.energyPerCard} 点能量`);
        parts.push(segs.join('，'));
        break;
      }
      case 'damagePerBurn': {
        const t = e.aoe ? '对所有敌人' : '';
        const cur = ctx?.target ? `（当前 ${dmgText((ctx.target.statuses.burn ?? 0) * e.amount, ctx)}）` : '';
        parts.push(`${t}造成等于其燃烧层数 × ${e.amount} 的伤害${cur}`);
        break;
      }
      case 'consumeBurn': {
        const cur = ctx?.target ? `（当前 ${dmgText((ctx.target.statuses.burn ?? 0) * e.damagePer, ctx)}）` : '';
        parts.push(`移除目标所有燃烧，每层造成 ${e.damagePer} 点伤害${cur}`);
        break;
      }
      case 'doubleStatus':
        parts.push(`使${e.target === 'self' ? '自身' : '目标'}的${STATUSES[e.status].name}层数翻倍`);
        if (e.target === 'self' && e.status === 'strength') previewStrength(ctx?.player.statuses.strength ?? 0);
        break;
      case 'returnExhausted':
        parts.push(`从消耗区随机取回 ${e.count} 张牌到手牌`);
        break;
      case 'conditional':
        // 分号明确结束条件范围，后面的无条件效果不能被误读为也需要条件。
        parts.push(`${condText(e.cond)}：${describeEffects(e.then, ctx).replace(/。$/, '')}；`);
        break;
    }
  }
  let text = parts.join('，').replace(/；，/g, '；').replace(/；$/, '');
  if (view) {
    const tail: string[] = [];
    if (view.requireEmber) tail.unshift(`需要 ${view.requireEmber} 点余烬`);
    if (view.retain) tail.push('保留');
    if (view.charge) {
      const seg = [view.charge.damage ? `伤害 +${view.charge.damage}` : '', view.charge.block ? `格挡 +${view.charge.block}` : ''].filter(Boolean).join('、');
      tail.push(`每保留一回合${seg}${view.bonus ? `（已蓄力 ${view.bonus}）` : ''}`);
    }
    if (view.exhaust) tail.push('消耗');
    if (view.type === 'curse') tail.push('无法打出');
    if (view.handEndEffects.length) tail.push(`回合结束时，若仍在手中：${describeEffects(view.handEndEffects, null).replace(/。$/, '')}`);
    if (tail.length) text = (text ? text + '。' : '') + tail.join('。');
  }
  return text ? text + '。' : '';
}

export function describeCard(card: CardInstance, ctx: DescribeContext | null): string {
  const v = viewCard(card);
  return describeEffects(v.effects, ctx, v);
}

export function cardTypeName(t: CardDef['type']): string {
  return { attack: '攻击', skill: '技能', power: '能力', curse: '诅咒' }[t];
}
export function rarityName(r: CardDef['rarity']): string {
  return { starter: '基础', common: '普通', uncommon: '罕见', rare: '稀有', curse: '诅咒' }[r];
}
export function archetypeName(a: CardDef['archetype']): string {
  return { basic: '基础', combo: '连击', bulwark: '壁垒', ember: '余烬', cinder: '焚烧', ash: '灰烬', blood: '血誓', might: '狂力', echo: '回响', focus: '专注', curse: '诅咒' }[a];
}
