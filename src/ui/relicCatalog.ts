import type { RelicDef } from '../engine/types';

export const RELIC_CATEGORIES = [
  { id: 'common', label: '普通遗物' },
  { id: 'uncommon', label: '罕见遗物' },
  { id: 'rare', label: '稀有遗物' },
  { id: 'event', label: '问号专属' },
  { id: 'shop', label: '商店专属' },
  { id: 'chapter', label: '章节专属' },
  { id: 'starter', label: '初始遗物' },
] as const;
export type RelicCategory = typeof RELIC_CATEGORIES[number]['id'];

/** 专属来源优先于稀有度，各页互斥，避免稀有页混入问号、商店或章节奖励。 */
export function relicCategory(relic: RelicDef): RelicCategory {
  return relic.source ?? (relic.chapter ? 'chapter' : relic.rarity);
}
