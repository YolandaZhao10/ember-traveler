import type { PlayerCombat, PowerInstance } from './types';

export const INDEPENDENT_POWERS = ['tempo', 'flameAura', 'mirror'] as const;

/** 旧版只存总层数，缺少逐张来源；将缺失的总量恢复为一个能力实例。 */
export function ensurePowerInstances(player: PlayerCombat): PowerInstance[] {
  const powers = player.powerInstances ??= [];
  for (const status of INDEPENDENT_POWERS) {
    const total = powers.filter(p => p.status === status).reduce((n,p) => n + p.amount, 0);
    const missing = (player.statuses[status] ?? 0) - total;
    if (missing > 0) powers.push({ status, amount: missing, progress: 0 });
  }
  return powers;
}
