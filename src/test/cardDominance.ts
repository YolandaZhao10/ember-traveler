import { CARD_LIST } from '../data/cards';
import { viewDef, type CardView } from '../engine/cards';
import type { Effect } from '../engine/types';

type Payoff = { values: Record<string, number>; conditional: boolean };
/** 保守识别正向、可加的即时收益；遇到成长、资源代价、蓄力等机制就交给人工审查。 */
function payoff(effects: Effect[]): Payoff | null {
  const result: Payoff = { values: {}, conditional: false };
  for (const effect of effects) {
    if (effect.kind === 'conditional') {
      const nested = payoff(effect.then); if (!nested) return null;
      result.conditional = true;
      for (const [key, n] of Object.entries(nested.values)) result.values[key] = (result.values[key] ?? 0) + n;
      continue;
    }
    let key: string, amount: number;
    if (effect.kind === 'damage') {
      if ((effect.times ?? 1) !== 1 || effect.lifesteal || effect.strengthMult || effect.perHandCard || effect.perExhaustedCard) return null;
      key = effect.aoe ? 'damageAll' : 'damage'; amount = effect.amount;
      // 分开的两次攻击有两次力量、反伤等结算，不等价于单次数字相加。
      if (result.values[key] !== undefined) return null;
    } else if (['block', 'draw', 'energy', 'gainEmber'].includes(effect.kind) && 'amount' in effect) {
      key = effect.kind; amount = effect.amount;
    } else return null;
    if (amount < 0) return null;
    result.values[key] = (result.values[key] ?? 0) + amount;
  }
  return result;
}
const compatible = (a: CardView, b: CardView) => a.type === b.type && a.target === b.target && a.cost === b.cost
  && a.exhaust === b.exhaust && a.retain === b.retain && a.requireEmber === b.requireEmber
  && !a.charge && !b.charge && !a.handEndEffects.length && !b.handEndEffects.length;

/** 带条件牌即使所有条件都满足，仍被同费用无条件牌全面覆盖，才判为硬错误。 */
export function conditionalDominations() {
  const forms = CARD_LIST.filter(c => c.cost >= 0 && !['starter', 'curse', 'status'].includes(c.rarity))
    .flatMap(c => [false, true].map(upgraded => ({ def: c, upgraded, view: viewDef(c.id, upgraded), payoff: payoff(viewDef(c.id, upgraded).effects) })));
  const result: { weaker: string; weakerUpgraded: boolean; stronger: string; strongerUpgraded: boolean }[] = [];
  for (const a of forms) for (const b of forms) {
    if (a.def.id === b.def.id || !a.payoff?.conditional || !b.payoff || b.payoff.conditional || !compatible(a.view, b.view)) continue;
    if (a.def.owner && b.def.owner && a.def.owner !== b.def.owner) continue;
    // 基础与升级分开比；另比升级普通与基础稀有，不能靠稀有度隐藏覆盖。
    if (a.upgraded !== b.upgraded && !(a.upgraded && a.def.rarity === 'common' && !b.upgraded && b.def.rarity === 'rare')) continue;
    const keys = Object.keys(a.payoff.values);
    if (keys.length && keys.every(key => (b.payoff!.values[key] ?? 0) >= a.payoff!.values[key])) result.push({ weaker: a.def.id, weakerUpgraded: a.upgraded, stronger: b.def.id, strongerUpgraded: b.upgraded });
  }
  return result;
}
