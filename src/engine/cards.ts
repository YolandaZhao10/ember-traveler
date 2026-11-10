import { convertResource, conversionText } from './resourceConversion';
import { appliedBurn, recordBurn } from './burnHistory';
import { RELIC_TUNING as T } from '../data/relicBalance';
import { EMBER_MAX, CHARGE_MAX, clampCharge } from './constants';
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
  ethereal: boolean;
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
    ethereal: d.ethereal ?? false,
    retain: d.retain ?? false,
    charge: d.charge,
    requireEmber: u.requireEmber ?? d.requireEmber ?? 0,
    flavor: d.flavor,
    upgraded: card.upgraded,
    bonus: clampCharge(card.bonus ?? 0),
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

export function checkCondition(cond: Condition, p: PlayerCombat, target: Entity | null = null, charge = 0): boolean {
  switch (cond.kind) {
    case 'strengthAtLeast': return (p.statuses.strength ?? 0) >= cond.value;
    case 'exhaustedThisTurn': return (p.turnFlags.exhausted ?? 0) > 0;
    case 'charged': return charge >= cond.value;
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
    case 'strengthAtLeast': return `若力量 ≥ ${cond.value}`;
    case 'exhaustedThisTurn': return '若本回合消耗过牌';
    case 'charged': return `若本牌已蓄力至少 ${cond.value} 层`;
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
  const bonus = extra + ctx.crescendoBonus + (ctx.isFirstAttack && ctx.relics.includes('flint') ? T.flintDamage : 0);
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
  if (ctx.relics.includes('ember_censer')) e = Math.max(T.censerMinimumEmber, e);
  return e;
}

export function describeEffects(effects: Effect[], ctx: DescribeContext | null, view?: CardView): string {
  // 同一张牌先增力量再攻击时，后续数字要使用增长后的力量；预览不能修改战斗。
  if (ctx) ctx = {
    ...ctx,
    player: { ...ctx.player, hand: ctx.player.hand.map(c => ({ ...c })), statuses: { ...ctx.player.statuses }, turnFlags: { ...ctx.player.turnFlags } },
    target: ctx.target ? { ...ctx.target, statuses: { ...ctx.target.statuses } } : null,
  };
  const previewStrength = (amount: number) => {
    if (!ctx || amount <= 0) return;
    if (ctx.relics.includes('war_horn') && !ctx.player.turnFlags.warHorn) {
      ctx.player.turnFlags.warHorn = 1;
      amount++;
    }
    ctx.player.statuses.strength = (ctx.player.statuses.strength ?? 0) + amount;
  };
  const previewEmberSpend = (amount: number) => {
    if (!ctx) return;
    const spent = Math.min(ctx.player.ember, amount);
    ctx.player.ember -= spent;
    if (spent <= 0) return;
    if (ctx.player.statuses.sparkCrown && !ctx.player.turnFlags.sparkCrown) {
      ctx.player.turnFlags.sparkCrown = 1;
      previewStrength(Math.min(spent, ctx.player.statuses.sparkCrown));
    }
    if (spent >= 3 && ctx.player.statuses.emberConduit && !ctx.player.turnFlags.emberConduit) {
      ctx.player.turnFlags.emberConduit = 1;
      if (ctx.target) {
        recordBurn(ctx.target, ctx.player.statuses.emberConduit);
        ctx.target.statuses.burn = (ctx.target.statuses.burn ?? 0) + ctx.player.statuses.emberConduit;
      }
    }
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
        if (e.perExhaustedCard) {
          notes.push(`，消耗区每张牌 +${e.perExhaustedCard}（最多 +${e.exhaustBonusMax ?? 0}）`);
          if (ctx) extra += Math.min(ctx.player.exhaust.length * e.perExhaustedCard, e.exhaustBonusMax ?? 0);
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
        parts.push(`余烬翻倍${ctx ? `（${ctx.player.ember} → ${Math.min(EMBER_MAX, ctx.player.ember * 2)}）` : ''}`);
        break;
      case 'discardRandom':
        parts.push(e.count === 'all' ? '弃置所有手牌' : `随机弃置 ${e.count} 张手牌`);
        break;
      case 'clearDebuffs':
        parts.push('清除自身的虚弱、易伤、脆弱与燃烧');
        if (ctx) for (const status of ['weak', 'vulnerable', 'frail', 'burn'] as const) delete ctx.player.statuses[status];
        break;
      case 'removeBlock':
        parts.push('移除目标全部格挡');
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
      case 'blockPerBurn': {
        const current = ctx?.target ? (ctx.target.hp > 0 ? blockText(Math.min((ctx.target.statuses.burn ?? 0) * e.amount, e.max), ctx) : '0') : null;
        parts.push(`获得等于目标燃烧层数 × ${e.amount} 的基础格挡（基础上限 ${e.max}）${current !== null ? `（当前 ${current} 点格挡）` : ''}`);
        break;
      }
      case 'blockPerHand':
        // 前置抽牌、消耗触发可能改变手牌；只给出结算公式，不假报抽牌结果。
        parts.push(`结算时每张手牌获得 ${e.amount} 点基础格挡（基础上限 ${e.max}）`);
        break;
      case 'consumeVulnerable':
        parts.push(`移除${e.aoe ? '所有敌人' : '目标'}的全部易伤，每层造成 ${e.damagePer} 点基础伤害（移除后结算攻击修正）`);
        if (ctx?.target) delete ctx.target.statuses.vulnerable;
        break;
      case 'convertResource': {
        const earned = ctx ? convertResource(ctx.player, ctx.target, e) : null;
        parts.push(conversionText(e) + (earned === null ? '' : `（当前 ${earned}）`));
        break;
      }
      case 'draw':
        parts.push(`抽 ${e.amount} 张牌`);
        break;
      case 'chargeHand':
        parts.push(`手中所有蓄力牌立即蓄力 ${e.amount} 回合`);
        break;
      case 'energy':
        parts.push(`获得 ${e.amount} 点能量`);
        break;
      case 'gainEmber':
        if (e.amount >= 0) {
          const bonus = ctx && ctx.relics.includes('ash_hourglass') ? 1 : 0;
          parts.push(`获得 ${e.amount + bonus} 点余烬`);
          if (ctx) ctx.player.ember = Math.min(EMBER_MAX, ctx.player.ember + e.amount + bonus);
        } else {
          parts.push(`消耗 ${-e.amount} 点余烬`);
          previewEmberSpend(-e.amount);
        }
        break;
      case 'emberBurst': {
        const spend = emberSpendAmount(ctx);
        if (ctx) previewEmberSpend(ctx.player.ember);
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
        if ((STATUSES[e.status].kind === 'power' || e.status === 'guardOnce' || e.status === 'tempThorns') && e.target === 'self') {
          parts.push(STATUSES[e.status].description(e.amount).replace(/。$/, ''));
        } else if (e.target === 'self') {
          parts.push(`获得 ${e.amount} 层${name}${e.status === 'regen' ? '（回合末治疗后减少1层）' : ''}`);
        } else {
          parts.push(`${tgt}施加 ${e.amount} 层${name}`);
        }
        if (e.target === 'self' && e.status === 'strength') previewStrength(e.amount);
        if (ctx?.target && e.target !== 'self' && e.status === 'burn') {
          recordBurn(ctx.target, e.amount);
          ctx.target.statuses.burn = Math.max(0, (ctx.target.statuses.burn ?? 0) + e.amount);
        }
        break;
      }
      case 'heal':
        parts.push(`回复 ${e.amount} 点生命`);
        break;
      case 'exhaustHand': {
        const what = e.filter === 'curse'
          ? (e.count === 'all' ? '手牌中的所有诅咒牌' : `手牌中随机 ${e.count} 张诅咒牌`)
          : (e.count === 'all' ? '手牌中的所有牌' : `手牌中随机 ${e.count} 张牌`);
        const n = ctx && e.count === 'all'
          ? (e.filter === 'curse' ? ctx.player.hand.filter(c => viewCard(c).type === 'curse').length : Math.max(0, ctx.player.hand.length - 1))
          : null;
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
      case 'reapplyBurn': {
        const layers = ctx?.target ? appliedBurn(ctx.target) : null;
        parts.push(`再次施加本场对目标累计施加过的燃烧（含已消退或移除）${layers !== null ? `（当前 ${layers} 层）` : ''}`);
        if (ctx?.target && layers !== null) {
          recordBurn(ctx.target, layers);
          ctx.target.statuses.burn = (ctx.target.statuses.burn ?? 0) + layers;
        }
        break;
      }
      case 'spreadBurn':
        parts.push('将目标当前的燃烧层数施加给其他所有存活敌人（不移除目标燃烧）');
        break;
      case 'burnToEmber': {
        let current: number | null = null;
        if (ctx?.target) {
          const layers = ctx.target.hp > 0 ? (ctx.target.statuses.burn ?? 0) : 0;
          const base = Math.min(layers * e.amount, e.max);
          current = layers > 0 && base > 0
            ? Math.max(0, Math.min(EMBER_MAX - ctx.player.ember, base + (ctx.relics.includes('ash_hourglass') ? 1 : 0)))
            : 0;
          if (layers > 0) delete ctx.target.statuses.burn;
          ctx.player.ember += current;
        }
        parts.push(`消耗目标所有燃烧：每层获得 ${e.amount} 点余烬（基础上限 ${e.max} 点）${current !== null ? `（当前获得 ${current} 点余烬）` : ''}`);
        break;
      }
      case 'consumeBurn': {
        const cur = ctx?.target ? `（当前 ${dmgText((ctx.target.statuses.burn ?? 0) * e.damagePer, ctx)}）` : '';
        parts.push(`移除目标所有燃烧，每层造成 ${e.damagePer} 点伤害${cur}`);
        if (ctx?.target) delete ctx.target.statuses.burn;
        break;
      }
      case 'doubleStatus':
        parts.push(`使${e.target === 'self' ? '自身' : '目标'}的${STATUSES[e.status].name}层数翻倍`);
        if (e.target === 'self' && e.status === 'strength') previewStrength(ctx?.player.statuses.strength ?? 0);
        if (ctx?.target && e.target !== 'self' && e.status === 'burn') {
          recordBurn(ctx.target, ctx.target.statuses.burn ?? 0);
          ctx.target.statuses.burn = (ctx.target.statuses.burn ?? 0) * 2;
        }
        break;
      case 'replayDiscard':
        parts.push('选择弃牌堆中一张攻击或技能，免能量重放一次（不能选择重放或牌堆选牌效果的牌；其他代价照付，原牌结算后弃置或消耗）');
        break;
      case 'moveCard': {
        const source = e.from === 'draw' ? '抽牌堆' : e.from === 'exhaust' ? '消耗区' : '弃牌堆';
        const filter = e.filter === 'action' ? '攻击或技能' : e.filter === 'attack' ? '攻击牌' : e.filter === 'skill' ? '技能牌' : e.filter === 'exhaust' ? '带消耗的牌' : '牌';
        const destination = e.to === 'hand' ? '手牌' : e.to === 'draw' ? '抽牌堆顶' : '弃牌堆';
        parts.push(`${e.sample ? `从${source}随机查看最多 ${e.sample} 张${filter}，` : `从${source}`}选择 1 张${e.sample ? '' : filter}移入${destination}（${e.from === 'exhaust' ? '不能选择带消耗区回收效果的牌；' : ''}回响不重复移动）`);
        break;
      }
      case 'retainHand':
        parts.push('本回合结束时保留当前手牌（之后新抽到的牌不保留）');
        break;
      case 'returnExhausted':
        parts.push(e.selection === 'highestCost'
          ? `从消耗区按费用从高到低取回 ${e.count} 张牌到手牌（同费按消耗顺序）`
          : `从消耗区随机取回 ${e.count} 张牌到手牌`);
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
      tail.push(`每保留一回合${seg}，最多蓄力 ${CHARGE_MAX} 层${view.bonus ? `（已蓄力 ${view.bonus}/${CHARGE_MAX}）` : ''}`);
    }
    if (view.exhaust) tail.push('消耗');
    if (view.cost < 0) tail.push('无法打出');
    if (view.ethereal) tail.push('占用抽牌位，不补抽。回合结束时若仍在手中，自动消耗（优先于保留）');
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
  return { attack: '攻击', skill: '技能', power: '能力', curse: '诅咒', status: '状态' }[t];
}
export function rarityName(r: CardDef['rarity']): string {
  return { starter: '基础', common: '普通', uncommon: '罕见', rare: '稀有', curse: '诅咒', status: '状态' }[r];
}
export function archetypeName(a: CardDef['archetype']): string {
  return { basic: '基础', combo: '连击', bulwark: '壁垒', ember: '余烬', cinder: '焚烧', ash: '灰烬', blood: '血誓', might: '狂力', echo: '回响', focus: '专注', curse: '诅咒', status: '干扰' }[a];
}
