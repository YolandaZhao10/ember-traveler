import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARDS } from '../data/cards';
import { describeCard, viewCard, viewDef } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CombatState, Effect } from '../engine/types';

const card = (defId: string, upgraded = false, uid = defId) => ({ defId, upgraded, uid });
function battle(id: string, upgraded = false) {
  const cs = createCombat('zero-cost', ['tomb_puppet'], 'normal', [], 100, 100, [], makeRng('ZERO-COST', 'combat'), 100,
    CARDS[id].owner ?? 'traveler').state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 1000;
  cs.enemies[0].statuses = {};
  cs.player.hand = [card(id, upgraded)];
  cs.player.draw = Array.from({ length: 10 }, (_, i) => card('defend', false, `draw-${i}`));
  cs.player.energy = 0;
  return cs;
}
function use(cs: CombatState, uid: string) {
  const selected = cs.player.hand.find(c => c.uid === uid)!;
  const result = playCard(cs, uid, viewCard(selected).target === 'enemy' ? 'e0' : null);
  expect(result.state).not.toBe(cs);
  return result;
}
function nextTurn(input: CombatState) {
  let cs = endPlayerTurn(input).state;
  cs = enemyAct(cs, 'e0').state;
  return startPlayerTurn(cs).state;
}
const variants = (ids: string[]) => ids.flatMap(id => [false, true].map(upgraded => ({ id, upgraded })));
const newlyExhausting = ['burn_pages', 'blood_rite', 'folded_ward', 'shutter_lamp', 'intimidate'];

describe('零费资源牌的真实消耗边界', () => {
  it.each(variants(newlyExhausting))('$id 升级=$upgraded：零能量可打出，卡牌仅消耗一次并离开抽弃循环', ({ id, upgraded }) => {
    const before = battle(id, upgraded);
    before.player.statuses.ashFeast = 2;
    if (id === 'burn_pages') before.player.hand.push(card('strike', false, 'fuel'));
    const { state: after, events } = use(before, id);
    expect(after.player.exhaust.filter(c => c.uid === id)).toHaveLength(1);
    expect([...after.player.hand, ...after.player.draw, ...after.player.discard].some(c => c.uid === id)).toBe(false);
    expect(after.player.turnFlags.exhausted).toBe(id === 'burn_pages' ? 2 : 1);
    expect(events.filter(e => e.type === 'cardPlayed')).toHaveLength(1);
    expect(describeCard(card(id, upgraded), null)).toContain('消耗。');
    expect(after.player.energy).toBe(id === 'burn_pages' || id === 'blood_rite' ? 1 : 0);
    if (id === 'blood_rite') expect(after.player.hp).toBe(before.player.hp - 3);
    if (id === 'intimidate') expect(after.enemies[0].statuses.weak).toBe(upgraded ? 2 : 1);
    // 真正走完洗牌过程，不能把刚打出的零费资源牌再次抽回。
    let later = after;
    for (let turn = 0; turn < 3; turn++) later = nextTurn(later);
    expect([...later.player.hand, ...later.player.draw, ...later.player.discard].some(c => c.uid === id)).toBe(false);
    expect(later.player.exhaust.filter(c => c.uid === id)).toHaveLength(1);
  });

  it('回响焚书分别消耗两张手牌；本牌消耗不能给自身再返能', () => {
    const cs = battle('burn_pages');
    cs.player.hand.push(card('strike', false, 'fuel-a'), card('defend', false, 'fuel-b'));
    cs.player.statuses.echo = 1; cs.player.statuses.ashFeast = 2;
    const { state: after, events } = use(cs, 'burn_pages');
    expect(after.player.energy).toBe(2);
    expect(after.player.block).toBe(6);
    expect(after.player.exhaust.map(c => c.uid).sort()).toEqual(['burn_pages', 'fuel-a', 'fuel-b']);
    expect(after.player.turnFlags.exhausted).toBe(3);
    expect(events.filter(e => e.type === 'cardPlayed')).toHaveLength(2);
    expect(after.player.cardsPlayedThisTurn).toBe(2);
    const alone = use(battle('burn_pages'), 'burn_pages').state;
    expect(alone.player.energy).toBe(0);
    expect(alone.player.exhaust).toHaveLength(1);
  });

  it.each([false, true])('回响血祭升级=%s：两次收益支付两次生命，但只触发一次本牌消耗收益', upgraded => {
    const cs = battle('blood_rite', upgraded);
    cs.player.statuses.echo = 1; cs.player.statuses.ashFeast = 2;
    const after = use(cs, 'blood_rite').state;
    expect(after.player.hp).toBe(94);
    expect(after.player.energy).toBe(2);
    expect(after.player.hand).toHaveLength(upgraded ? 6 : 4);
    expect(after.player.block).toBe(2);
    expect(after.player.exhaust.map(c => c.uid)).toEqual(['blood_rite']);
    expect(after.player.cardsPlayedThisTurn).toBe(2);
  });

  it('折页护符仍可保留蓄力，回响后仅消耗一次；只有结算时拥有回响才储能', () => {
    let cs = battle('folded_ward');
    cs = nextTurn(nextTurn(cs));
    const stored = cs.player.hand.find(c => c.uid === 'folded_ward')!;
    expect(stored.bonus).toBe(2);
    cs.player.block = 0; cs.player.energy = 0;
    cs.player.statuses.echo = 1; cs.player.statuses.ashFeast = 2;
    const after = use(cs, 'folded_ward').state;
    expect(after.player.block).toBe((3 + 2 * 2) * 2 + 2);
    expect(after.player.statuses.energyNext).toBe(1);
    expect(after.player.exhaust.filter(c => c.uid === 'folded_ward')).toHaveLength(1);
    expect(after.player.energy).toBe(0);
  });
});

// 可重复零费牌必须明确审核预算；新增牌不能仅凭费用为零就绕过资源循环限制。
const repeatBudgets: Record<string, { damage?: number[]; block?: number[]; ember?: number | number[]; strength?: number[] }> = {
  quick_stab: { damage: [3, 5], ember: 1 },
  flex: { strength: [1, 2] },
  rally_step: { block: [3, 5], ember: 1 },
  swift_return: { damage: [5, 7], block: [4, 6] },
  charred_dart: { damage: [3, 5], block: [2, 3] },
  crimson_step: { block: [6, 8] },
  ember_pulse: { ember: [2, 3] },
  whisper_needle: { damage: [2, 4], ember: 1 },
  steady_breath: { block: [2, 4], ember: 1 },
};
function resourceEffect(effect: Effect): boolean {
  if (effect.kind === 'conditional') return effect.then.some(resourceEffect);
  return ['draw', 'energy', 'heal', 'returnExhausted', 'exhaustHand'].includes(effect.kind)
    || effect.kind === 'status' && ['energyNext', 'regen', 'echo'].includes(effect.status);
}

describe('可重复零费牌的收益预算', () => {
  it('每个基础或升级的可重复零费版本都有审核预算，不能附带免费过牌、回能、回收或保留蓄力', () => {
    const unchecked: string[] = [];
    for (const def of CARD_LIST) for (const upgraded of [false, true]) {
      const v = viewDef(def.id, upgraded);
      if (v.cost !== 0 || v.exhaust || v.type === 'power') continue;
      if (!repeatBudgets[v.id]) unchecked.push(v.name);
      expect(v.charge, v.name).toBeUndefined();
      expect(v.effects.some(resourceEffect), v.name).toBe(false);
    }
    expect(unchecked, '新增可重复零费牌须先审查收益及组合，再登记预算').toEqual([]);
  });

  it.each(variants(Object.keys(repeatBudgets)))('$id 升级=$upgraded：满足条件后的真实收益受限，仍进入弃牌堆', ({ id, upgraded }) => {
    const cs = battle(id, upgraded);
    cs.player.cardsPlayedThisTurn = 2; cs.player.attacksPlayedThisTurn = 2;
    cs.enemies[0].statuses.burn = 1;
    // 回响只在低语针场景启用，伤害与出牌次数各计两次。
    if (id === 'whisper_needle') cs.player.statuses.echo = 1;
    const after = use(cs, id).state;
    const budget = repeatBudgets[id], up = Number(upgraded);
    const damage = cs.enemies[0].hp - after.enemies[0].hp;
    expect(damage).toBeLessThanOrEqual((budget.damage?.[up] ?? 0) * (id === 'whisper_needle' ? 2 : 1));
    expect(after.player.block).toBeLessThanOrEqual(budget.block?.[up] ?? 0);
    expect(after.player.ember).toBeLessThanOrEqual(Array.isArray(budget.ember) ? budget.ember[up] : budget.ember ?? 0);
    expect(after.player.statuses.strength ?? 0).toBeLessThanOrEqual(budget.strength?.[up] ?? 0);
    expect(damage + after.player.block + after.player.ember + (after.player.statuses.strength ?? 0)).toBeGreaterThan(0);
    expect(after.player.energy).toBe(0);
    expect(after.player.hand).toHaveLength(0);
    expect(after.player.discard.filter(c => c.uid === id)).toHaveLength(1);
    expect(after.player.exhaust).toHaveLength(0);
    expect(after.player.cardsPlayedThisTurn).toBe(id === 'whisper_needle' ? 4 : 3);
    if (['crimson_step', 'ember_pulse'].includes(id)) expect(after.player.hp).toBe(98);
    if (id === 'flex') expect(nextTurn(after).player.statuses.strength ?? 0).toBe(0);
  });
});

describe('零费升级能力仍是一次部署，不伪装成消耗', () => {
  it.each(['forge', 'everburning', 'blood_pact', 'mirror'])('%s 打出后从所有牌堆移出，不额外触发消耗遗物或能力', id => {
    const cs = battle(id, true);
    cs.relics = ['bone_urn', 'foundry_core'];
    cs.player.statuses.ashFeast = 2; cs.player.statuses.echo = 1;
    expect(viewDef(id, true).cost).toBe(0);
    expect(viewDef(id, true).exhaust).toBe(false);
    const { state: after, events } = use(cs, id);
    expect([...after.player.hand, ...after.player.draw, ...after.player.discard, ...after.player.exhaust].some(c => c.uid === id)).toBe(false);
    expect(after.player.draw).toHaveLength(10);
    expect(after.player.hand).toHaveLength(0);
    expect(after.player.block).toBe(0);
    expect(after.player.energy).toBe(0);
    expect(after.player.turnFlags.exhausted ?? 0).toBe(0);
    expect(after.player.statuses.echo).toBe(1);
    expect(events.some(e => e.type === 'relic' && cs.relics.includes(e.relicId))).toBe(false);
    const status = { forge: 'forge', everburning: 'everburn', blood_pact: 'bloodRage', mirror: 'mirror' } as const;
    expect(after.player.statuses[status[id as keyof typeof status]]).toBe(id === 'blood_pact' ? 2 : 1);
  });
});
