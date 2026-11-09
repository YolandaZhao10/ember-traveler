import { describe, expect, it } from 'vitest';
import type { Effect } from '../engine/types';
import { effectDesign } from './cardDesign';

const draw: Effect = { kind: 'draw', amount: 1 };
const energy: Effect = { kind: 'energy', amount: 1 };
const block: Effect = { kind: 'block', amount: 5 };
const ember: Effect = { kind: 'gainEmber', amount: 2 };
const damage: Effect = { kind: 'damage', amount: 8 };

describe('卡牌效果相似性规范化', () => {
  const interchangeable: [string, Effect, Effect][] = [
    ['能量与抽牌', energy, draw],
    ['格挡与敌方虚弱', block, { kind: 'status', status: 'weak', amount: 1, target: 'target' }],
    ['格挡与余烬', block, ember],
    ['抽牌与余烬', draw, ember],
    ['抽牌与下回合能量', draw, { kind: 'status', status: 'energyNext', amount: 1, target: 'self' }],
  ];
  it.each(interchangeable)('%s 换序不能伪装成新效果', (_, a, b) => {
    for (const mode of ['design', 'exact'] as const) expect(effectDesign([a, b], mode)).toBe(effectDesign([b, a], mode));
  });

  const dependent: [string, Effect, Effect][] = [
    ['力量与攻击', { kind: 'status', status: 'strength', amount: 2, target: 'self' }, damage],
    ['易伤与攻击', { kind: 'status', status: 'vulnerable', amount: 1, target: 'target' }, damage],
    ['蓄力手牌与抽牌', { kind: 'chargeHand', amount: 1 }, draw],
    ['抽牌与消耗手牌', draw, { kind: 'exhaustHand', count: 1 }],
    ['回收与消耗手牌', { kind: 'returnExhausted', count: 1 }, { kind: 'exhaustHand', count: 1 }],
    ['余烬支出与按余烬结算', { kind: 'gainEmber', amount: -2 }, { kind: 'emberBurst', damagePer: 3 }],
    ['格挡与有格挡条件', block, { kind: 'conditional', cond: { kind: 'hasBlock' }, then: [draw] }],
  ];
  it.each(dependent)('%s 保留真实顺序差异', (_, a, b) => {
    for (const mode of ['design', 'exact'] as const) expect(effectDesign([a, b], mode)).not.toBe(effectDesign([b, a], mode));
  });

  it('独立效果可跨多个相邻交换归一化，但不能穿过条件屏障', () => {
    expect(effectDesign([draw, energy, ember])).toBe(effectDesign([ember, draw, energy]));
    const condition: Effect = { kind: 'conditional', cond: { kind: 'hasBlock' }, then: [energy, draw] };
    expect(effectDesign([condition])).toBe(effectDesign([{ ...condition, then: [draw, energy] }]));
    expect(effectDesign([draw, condition, energy])).not.toBe(effectDesign([energy, condition, draw]));
  });

  const defaults: [string, Effect, Effect][] = [
    ['攻击默认参数', damage, { ...damage, times: 1, aoe: false, strengthMult: 0, perHandCard: 0, lifesteal: false }],
    ['格挡攻击默认参数', { kind: 'damageByBlock' }, { kind: 'damageByBlock', mult: 1, bonus: 0, aoe: false, consume: false }],
    ['余烬伤害默认倍率', { kind: 'damagePerEmber', amount: 2 }, { kind: 'damagePerEmber', amount: 2, per: 1 }],
    ['余烬爆发缺省分支', { kind: 'emberBurst', damagePer: 3 }, { kind: 'emberBurst', damagePer: 3, blockPer: 0 }],
    ['消耗手牌缺省附加奖励', { kind: 'exhaustHand', count: 1 }, { kind: 'exhaustHand', count: 1, damagePerCard: 0, energyPerCard: 0 }],
  ];
  it.each(defaults)('%s 的缺省与显式默认值等效', (_, a, b) => {
    for (const mode of ['design', 'exact'] as const) expect(effectDesign([a], mode)).toBe(effectDesign([b], mode));
  });

  it('保留资源代价方向与同资源先花后得的顺序', () => {
    expect(effectDesign([ember])).toBe(effectDesign([{ kind: 'gainEmber', amount: 8 }]));
    const spend: Effect = { kind: 'gainEmber', amount: -2 };
    expect(effectDesign([ember])).not.toBe(effectDesign([spend]));
    expect(effectDesign([ember, spend])).not.toBe(effectDesign([spend, ember]));
    expect(effectDesign([{ kind: 'energy', amount: -1 }])).not.toBe(effectDesign([energy]));
    expect(effectDesign([{ kind: 'damageByBlock', consume: true }])).not.toBe(effectDesign([{ kind: 'damageByBlock' }]));
  });

  it('精确模式保留数值、段数和群体范围，近似模式不能用这些区别过关', () => {
    const stronger: Effect = { kind: 'damage', amount: 12, times: 2, aoe: true };
    expect(effectDesign([damage])).toBe(effectDesign([stronger]));
    expect(effectDesign([damage], 'exact')).not.toBe(effectDesign([stronger], 'exact'));
  });

  it('只合并连续纯伤害的近似设计，不吞掉吸血或成长攻击后面的普通命中', () => {
    expect(effectDesign([damage, damage])).toBe(effectDesign([damage]));
    const drain: Effect = { kind: 'damage', amount: 8, lifesteal: true };
    expect(effectDesign([drain, damage])).not.toBe(effectDesign([drain]));
    expect(effectDesign([damage, damage], 'exact')).not.toBe(effectDesign([damage], 'exact'));
  });

  it('保留回收选择规则和消耗手牌筛选，不能抹掉新机制', () => {
    for (const mode of ['design', 'exact'] as const) {
      expect(effectDesign([{ kind: 'returnExhausted', count: 1 }], mode)).not.toBe(effectDesign([{ kind: 'returnExhausted', count: 1, selection: 'highestCost' }], mode));
      expect(effectDesign([{ kind: 'exhaustHand', count: 'all' }], mode)).not.toBe(effectDesign([{ kind: 'exhaustHand', count: 'all', filter: 'curse' }], mode));
    }
  });
});
