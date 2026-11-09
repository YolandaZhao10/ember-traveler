import type { Effect } from '../engine/types';
import { viewDef } from '../engine/cards';

/** 设计审查：数值、费用、段数、单体/群体和保留/消耗本身不能作为唯一特色。
 * 保留真实资源的正负方向、条件类型、成长公式与蓄力机制。
 */
export function cardDesign(id: string, upgraded: boolean): string {
  const v = viewDef(id, upgraded);
  function shape(value: unknown): unknown {
    if (typeof value === 'number') return value < 0 ? 'negative' : 'positive';
    if (Array.isArray(value)) return value.map(x => shape(x));
    if (!value || typeof value !== 'object') return value;
    const data = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(data).sort().filter(k => !['aoe','times','bonus'].includes(k)).map(k => [k, k === 'target' && data[k] !== 'self' ? 'enemy' : shape(data[k])]));
  }
  // Adjacent flat damage clauses are still just fixed damage unless gated or scaled.
  const effects = v.effects.reduce<Effect[]>((all,e) => {
    if (e.kind === 'damage' && Object.keys(e).every(k => ['kind','amount','times','aoe'].includes(k)) && all[all.length - 1]?.kind === 'damage') return all;
    return [...all,e];
  }, []);
  return JSON.stringify([shape(effects), shape(v.handEndEffects), shape(v.charge ?? null)]);
}
