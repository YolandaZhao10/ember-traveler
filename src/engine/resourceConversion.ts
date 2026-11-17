import { CARDS } from '../data/cards';
import { chargeLimit, clampCharge } from './constants';
import type { CardInstance, Effect, Entity, PlayerCombat, Statuses } from './types';

/** 手牌里实际有效的蓄力层数；旧存档里超出上限的部分不算。 */
const heldCharge = (c: CardInstance) => clampCharge(c.bonus ?? 0, chargeLimit(CARDS[c.defId]?.charge));

/** 只兑现当前实际可用的临时力量，不消耗永久力量或负力量。 */
export const temporaryStrength = (statuses: Statuses): number => Math.max(0, Math.min(statuses.strength ?? 0, statuses.strengthDown ?? 0));

export type ResourceConversion = Extract<Effect, { kind: 'convertResource' }>;
const creditSource = { attacks: 'attacks', exhausts: 'exhausted', healing: 'actualHealing', echoes: 'resolvedCopies' } as const;

/** 消耗真实资源或本回合尚未兑换的计数；回响和回收不能重复兑换同一份收益。 */
export function convertResource(p: PlayerCombat, target: Entity | null, effect: ResourceConversion): number {
  const { resource, per, max = Infinity } = effect;
  if (per <= 0 || max <= 0 || p.hp <= 0) return 0;
  let available = 0;
  const credit = resource in creditSource;
  const spentKey = `converted:${resource}`;
  if (credit) {
    const key = creditSource[resource as keyof typeof creditSource];
    available = (resource === 'attacks' ? p.attacksPlayedThisTurn : p.turnFlags[key] ?? 0) - (p.turnFlags[spentKey] ?? 0);
  } else if (resource === 'block') available = p.block;
  else if (resource === 'ember') available = p.ember;
  else if (resource === 'burn') available = target && target.hp > 0 ? target.statuses.burn ?? 0 : 0;
  else if (resource === 'tempStrength') available = temporaryStrength(p.statuses);
  else if (resource === 'charge') available = p.hand.reduce((n, c) => n + heldCharge(c), 0);
  const earned = Math.max(0, Math.min(max, Math.floor(available / per)));
  // 整份消耗：来源全部用掉，不足一份的余数也不留。
  const spent = effect.consumeAll && (resource === 'ember' || resource === 'burn') ? Math.max(0, available) : earned * per;
  if (!spent) return 0;
  if (credit) p.turnFlags[spentKey] = (p.turnFlags[spentKey] ?? 0) + spent;
  else if (resource === 'block') p.block -= spent;
  else if (resource === 'ember') p.ember -= spent;
  else if (resource === 'burn' && target) target.statuses.burn = (target.statuses.burn ?? 0) - spent;
  else if (resource === 'tempStrength') {
    p.statuses.strength = (p.statuses.strength ?? 0) - spent;
    p.statuses.strengthDown = (p.statuses.strengthDown ?? 0) - spent;
  } else if (resource === 'charge') {
    let left = spent;
    for (const c of [...p.hand].sort((a, b) => heldCharge(a) - heldCharge(b))) {
      const use = Math.min(left, heldCharge(c));
      if (use) c.bonus = heldCharge(c) - use;
      left -= use;
      if (!left) break;
    }
  }
  return earned;
}

export function conversionText(e: ResourceConversion): string {
  const reward = e.reward === 'draw' ? '抽 1 张牌' : '获得 1 点能量';
  const cap = e.max === undefined ? '' : e.reward === 'draw' ? `，最多抽 ${e.max} 张` : `，最多获得 ${e.max} 点`;
  const credits = {
    attacks: `打出 ${e.per} 张攻击牌`, exhausts: `消耗 ${e.per} 张牌`,
    healing: `实际回复 ${e.per} 点生命`, echoes: `完成 ${e.per} 次回响或镜像`,
  };
  if (e.resource in credits) return `本回合每${credits[e.resource as keyof typeof credits]}${reward}${cap}，不重复计算`;
  const sources = { block: '当前格挡', burn: '目标燃烧', tempStrength: '当前临时力量', charge: '手牌蓄力层数（从蓄力最低的牌起）', ember: '当前余烬' };
  const unit = e.resource === 'burn' || e.resource === 'charge' ? '层' : '点';
  const all = e.consumeAll && (e.resource === 'ember' || e.resource === 'burn');
  const source = all ? (e.resource === 'ember' ? '所有余烬' : '目标所有燃烧') : sources[e.resource as keyof typeof sources];
  return `消耗${source}：每 ${e.per} ${unit}${reward}${cap}${all ? '' : '（不足一份不消耗）'}`;
}
