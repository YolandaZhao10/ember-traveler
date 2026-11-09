import { describe, expect, it } from 'vitest';
import { CARD_LIST } from '../data/cards';
import { cardDesign } from './cardDesign';
import { viewDef } from '../engine/cards';
import type { Effect } from '../engine/types';

describe('卡牌近似设计回归审查', () => {
  it('需要指定敌人的效果必须提供选敌入口，不能藏在无目标或群体牌内而落空', () => {
    function needsTarget(e: Effect): boolean {
      switch (e.kind) {
        case 'damage': case 'damageByBlock': case 'damagePerBurn': return !e.aoe;
        case 'damagePerHpLost': case 'damagePerAttack': case 'damagePerEmber': case 'consumeBurn': return true;
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
  it('同一角色可获得的不同卡牌，基础与升级版均不能只换数值、费用、段数、单体群体或保留消耗', () => {
    const groups = new Map<string, typeof CARD_LIST>();
    for (const card of CARD_LIST.filter(c => !['starter','curse'].includes(c.rarity))) for (const upgraded of [false,true]) {
      const key = cardDesign(card.id,upgraded); const group = groups.get(key) ?? [];
      if (!group.some(c => c.id === card.id)) group.push(card);
      groups.set(key,group);
    }
    const conflicts = new Set<string>();
    for (const group of groups.values()) for (const a of group) for (const b of group) {
      if (a.id < b.id && (!a.owner || !b.owner || a.owner === b.owner)) conflicts.add(`${a.name} / ${b.name}`);
    }
    expect([...conflicts], '同卡池出现只改表面参数的设计，请调整真实条件、资源代价或机制').toEqual([]);
  });
});
