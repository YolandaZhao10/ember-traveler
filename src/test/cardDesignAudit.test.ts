import { describe, expect, it } from 'vitest';
import { CARD_LIST } from '../data/cards';
import { cardDesign, cardMechanics, effectDesign } from './cardDesign';
import { viewDef } from '../engine/cards';
import type { Effect } from '../engine/types';

describe('卡牌近似设计回归审查', () => {
  it('跨稀有度交叉审查基础/升级效果，不能依赖费用、保留、消耗或角色掩盖完全同效', () => {
    const seen = new Map<string, string>();
    const conflicts = new Set<string>();
    for (const c of CARD_LIST.filter(c => !['starter', 'curse', 'status'].includes(c.rarity))) for (const up of [false, true]) {
      const v = viewDef(c.id, up);
      const key = effectDesign(v.effects, 'exact') + effectDesign(v.handEndEffects, 'exact');
      const previous = seen.get(key);
      if (previous && previous !== c.id) conflicts.add(`${previous} / ${c.id}${up ? '+' : ''}`);
      seen.set(key, c.id);
    }
    expect([...conflicts]).toEqual([]);
  });
  it('需要指定敌人的效果必须提供选敌入口，不能藏在无目标或群体牌内而落空', () => {
    function needsTarget(e: Effect): boolean {
      switch (e.kind) {
        case 'damage': case 'damageByBlock': case 'damagePerBurn': case 'consumeVulnerable': return !e.aoe;
        case 'damagePerHpLost': case 'damagePerAttack': case 'damagePerEmber': case 'consumeBurn':
        case 'removeBlock': case 'spreadBurn': case 'blockPerBurn': case 'burnToEmber': case 'consumeTempStrength': return true;
        case 'emberBurst': return !!e.damagePer && !e.aoe;
        case 'exhaustHand': return !!e.damagePerCard;
        case 'doubleStatus': return e.target !== 'self';
        case 'status': return e.target === 'target';
        case 'conditional': return e.cond.kind === 'targetBurning' || e.then.some(needsTarget);
        default: return false;
      }
    }
    for (const c of CARD_LIST) for (const up of [false,true]) {
      const v = viewDef(c.id,up);
      if (v.effects.some(needsTarget)) expect(v.target, `${v.name} 的单体效果缺少目标`).toBe('enemy');
    }
  });
  it('全角色与通用奖励牌，基础与升级版均不能只换数值、费用、段数、单体群体或保留消耗', () => {
    const groups = new Map<string, typeof CARD_LIST>();
    for (const card of CARD_LIST.filter(c => !['starter','curse','status'].includes(c.rarity))) for (const upgraded of [false,true]) {
      const key = cardDesign(card.id,upgraded); const group = groups.get(key) ?? [];
      if (!group.some(c => c.id === card.id)) group.push(card);
      groups.set(key,group);
    }
    const conflicts = new Set<string>();
    for (const group of groups.values()) for (const a of group) for (const b of group) {
      if (a.id < b.id) conflicts.add(`${a.name} / ${b.name}`);
    }
    expect([...conflicts], '同卡池出现只改表面参数的设计，请调整真实条件、资源代价或机制').toEqual([]);
  });
  it('通用奖励不能与角色非基础初始牌完全等效，包含无关效果换序和基础升级交叉比较', () => {
    const starters = CARD_LIST.filter(c => c.rarity === 'starter' && c.archetype !== 'basic');
    const shared = CARD_LIST.filter(c => !c.owner && ['common', 'uncommon', 'rare'].includes(c.rarity));
    const conflicts = new Set<string>();
    for (const a of starters) for (const b of shared) for (const aUp of [false, true]) for (const bUp of [false, true]) {
      if (cardMechanics(a.id, aUp) === cardMechanics(b.id, bUp)) conflicts.add(`${a.name}${aUp ? '+' : ''} / ${b.name}${bUp ? '+' : ''}`);
    }
    expect([...conflicts], '角色特色初始牌与通用奖励不能仅以换序、费用或稀有度区分').toEqual([]);
  });
});
