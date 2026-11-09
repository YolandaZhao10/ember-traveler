import type { Effect, Entity, PlayerCombat } from './types';

export type ResourceConversion = Extract<Effect, { kind: 'convertResource' }>;
const creditSource = { attacks: 'attacks', exhausts: 'exhausted', healing: 'actualHealing', echoes: 'resolvedCopies' } as const;

/** 消耗真实资源或本回合尚未兑换的计数；回响和回收不能重复兑换同一份收益。 */
export function convertResource(p: PlayerCombat, target: Entity | null, effect: ResourceConversion): number {
  const { resource, per, max } = effect;
  if (per <= 0 || max <= 0 || p.hp <= 0) return 0;
  let available = 0;
  const credit = resource in creditSource;
  const spentKey = `converted:${resource}`;
  if (credit) {
    const key = creditSource[resource as keyof typeof creditSource];
    available = (resource === 'attacks' ? p.attacksPlayedThisTurn : p.turnFlags[key] ?? 0) - (p.turnFlags[spentKey] ?? 0);
  } else if (resource === 'block') available = p.block;
  else if (resource === 'burn') available = target && target.hp > 0 ? target.statuses.burn ?? 0 : 0;
  else if (resource === 'tempStrength') available = Math.min(Math.max(0, p.statuses.strength ?? 0), p.statuses.strengthDown ?? 0);
  else if (resource === 'charge') available = p.hand.reduce((n, c) => n + Math.max(0, c.bonus ?? 0), 0);
  const earned = Math.max(0, Math.min(max, Math.floor(available / per))), spent = earned * per;
  if (!spent) return 0;
  if (credit) p.turnFlags[spentKey] = (p.turnFlags[spentKey] ?? 0) + spent;
  else if (resource === 'block') p.block -= spent;
  else if (resource === 'burn' && target) target.statuses.burn = (target.statuses.burn ?? 0) - spent;
  else if (resource === 'tempStrength') {
    p.statuses.strength = (p.statuses.strength ?? 0) - spent;
    p.statuses.strengthDown = (p.statuses.strengthDown ?? 0) - spent;
  } else if (resource === 'charge') {
    let left = spent;
    for (const c of [...p.hand].sort((a, b) => (a.bonus ?? 0) - (b.bonus ?? 0))) {
      const use = Math.min(left, Math.max(0, c.bonus ?? 0));
      if (use) c.bonus = (c.bonus ?? 0) - use;
      left -= use;
      if (!left) break;
    }
  }
  return earned;
}

export function conversionText(e: ResourceConversion): string {
  const credits = {
    attacks: `打出 ${e.per} 张攻击牌`, exhausts: `消耗 ${e.per} 张牌`,
    healing: `实际回复 ${e.per} 生命`, echoes: `完成 ${e.per} 次回响或镜像`,
  };
  if (e.resource in credits) {
    return `本回合每${credits[e.resource as keyof typeof credits]}可兑换${e.reward === 'draw' ? '抽 1 张牌' : '1 点能量'}，本次最多 ${e.max}；已兑换部分不能重复计算`;
  }
  const sources = {
    attacks: '本回合尚未兑换的攻击次数', exhausts: '本回合尚未兑换的消耗牌数',
    healing: '本回合尚未兑换的实际治疗量', echoes: '本回合尚未兑换的已完成回响／镜像次数',
    block: '当前格挡', burn: '目标燃烧', tempStrength: '当前临时力量', charge: '手牌蓄力层数（从蓄力最低的牌起）',
  };
  return `消耗${sources[e.resource]}：每 ${e.per} ${e.resource === 'attacks' || e.resource === 'echoes' ? '次' : e.resource === 'exhausts' ? '张' : e.resource === 'burn' || e.resource === 'charge' ? '层' : '点'}${e.reward === 'draw' ? '抽 1 张牌' : '获得 1 点能量'}，最多${e.reward === 'draw' ? `抽 ${e.max} 张` : `获得 ${e.max} 点`}（不足一份不消耗）`;
}
