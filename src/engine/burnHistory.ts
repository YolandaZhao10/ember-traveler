import type { Entity } from './types';

/** 每名敌人的本场施加总量；旧数据只能从现存燃烧开始记录，不能推测过去。 */
export function appliedBurn(entity: Entity): number {
  const recorded = 'burnApplied' in entity ? entity.burnApplied : undefined;
  return typeof recorded === 'number' && Number.isFinite(recorded)
    ? Math.max(0, recorded) : Math.max(0, entity.statuses.burn ?? 0);
}

/** 在修改当前燃烧之前记账。衰减、引爆与净化不减少累计值，玩家不记账。 */
export function recordBurn(entity: Entity, amount: number) {
  if ('defId' in entity && amount > 0) {
    const tracked: Entity & { burnApplied?: number } = entity;
    tracked.burnApplied = appliedBurn(entity) + amount;
  }
}
