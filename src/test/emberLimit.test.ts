import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeCard, viewCard } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { EMBER_MAX } from '../engine/constants';
import { makeRng } from '../engine/rng';
import { loadRun, saveRun } from '../engine/save';
import * as R from '../engine/run';
import type { CardInstance, CombatState } from '../engine/types';

const card = (defId: string, uid = defId, upgraded = false): CardInstance => ({ uid, defId, upgraded });
function battle(ids: string[] = [], relics: string[] = []): CombatState {
  const cs = createCombat('ember-limit', ['tomb_puppet'], 'normal', [], 100, 100, relics, makeRng('EMBER-LIMIT', 'combat'), 100, 'scholar').state;
  cs.player.hand = ids.map((id, i) => card(id, `hand-${i}`));
  cs.player.draw = Array.from({ length: 20 }, (_, i) => card('defend', `draw-${i}`));
  cs.enemies[0].hp = cs.enemies[0].maxHp = 100000;
  cs.enemies[0].block = 0; cs.enemies[0].statuses = {};
  return cs;
}
function play(cs: CombatState, id: string) {
  const c = cs.player.hand.find(c => c.defId === id)!;
  return playCard(cs, c.uid, viewCard(c).target === 'enemy' ? cs.enemies[0].id : null);
}
function preview(cs: CombatState, id: string) {
  return describeCard(cs.player.hand.find(c => c.defId === id)!, {
    player: cs.player, target: cs.enemies[0], relics: cs.relics, isFirstAttack: true, crescendoBonus: 0,
  });
}
function round(cs: CombatState) {
  cs = endPlayerTurn(cs).state;
  cs = enemyAct(cs, cs.enemies[0].id).state;
  return startPlayerTurn(cs).state;
}
afterEach(() => vi.unstubAllGlobals());

describe('余烬使用9999内部边界', () => {
  it('正常卡牌能够积累到十点以上，并跨真实敌人回合保留', () => {
    expect(EMBER_MAX).toBe(9999);
    let cs = battle(['tinder_bundle', 'tinder_bundle', 'tinder_bundle', 'stoke']);
    for (let i = 0; i < 3; i++) cs = play(cs, 'tinder_bundle').state;
    expect(cs.player.ember).toBe(9);
    cs = play(cs, 'stoke').state;
    expect(cs.player.ember).toBe(12); expect(cs.player.energy).toBe(2);
    cs = round(cs);
    expect(cs.turn).toBe(2); expect(cs.player.ember).toBe(12);
  });

  it.each([{ relics: [] }, { relics: ['ash_hourglass'] }])('卡牌与沙漏获得余烬只到内部边界，熔炉按实际增长结算：$relics', ({ relics }) => {
    let cs = battle(['stoke'], relics);
    cs.player.ember = EMBER_MAX - 1; cs.player.statuses.forge = 2;
    const result = play(cs, 'stoke'); cs = result.state;
    expect(cs.player.ember).toBe(9999);
    expect(result.events.filter(e => e.type === 'ember')).toEqual([{ type: 'ember', amount: 1, total: 9999 }]);
    expect(cs.player.block).toBe(8); // 添薪6 + 实际获得1余烬带来2格挡
    cs.player.hand.push(card('stoke', 'again'));
    const full = play(cs, 'stoke');
    expect(full.state.player.ember).toBe(9999);
    expect(full.state.player.block - cs.player.block).toBe(6);
    expect(full.events.some(e => e.type === 'ember')).toBe(false);
  });

  it('遗物资源超过十点仍生效，旧式与结构化遗物都服从相同内部边界', () => {
    let cs = battle([], ['dawn_crystal', 'charcoal_heart', 'ash_hourglass']);
    cs.player.ember = 12;
    cs = endPlayerTurn(cs).state;
    expect(cs.player.ember).toBe(15); // 炭心1 + 首回合晶石2，不受沙漏放大
    let capped = battle([], ['dawn_crystal', 'charcoal_heart', 'ash_hourglass']);
    capped.player.ember = EMBER_MAX - 1; capped.player.statuses.forge = 2;
    const end = endPlayerTurn(capped);
    expect(end.state.player.ember).toBe(9999);
    expect(end.state.player.block).toBe(2);
    expect(end.events.filter(e => e.type === 'ember')).toEqual([{ type: 'ember', amount: 1, total: 9999 }]);
  });

  it.each([{ initial: 6, total: 12 }, { initial: 20, total: 40 }, { initial: 5001, total: 9999 }])('灰烬方程实际翻倍$initial→$total，预览不修改状态', ({ initial, total }) => {
    const cs = battle(['ash_equation'], ['ash_hourglass']); cs.player.ember = initial;
    const before = structuredClone(cs);
    expect(preview(cs, 'ash_equation')).toContain(`余烬翻倍（${initial} → ${total}）`);
    expect(cs).toEqual(before);
    const result = play(cs, 'ash_equation');
    expect(result.state.player.ember).toBe(total);
    expect(result.events.filter(e => e.type === 'ember')).toEqual([{ type: 'ember', amount: total - initial, total }]);
  });

  it.each([false, true])('高余烬爆发升级=%s：预览与实际伤害一致，并只消费一次全部资源', upgraded => {
    const cs = battle(['ember_burst']); cs.player.ember = 25; cs.player.hand[0].upgraded = upgraded;
    const expected = 25 * (upgraded ? 8 : 6);
    const before = structuredClone(cs);
    expect(preview(cs, 'ember_burst')).toContain(`当前 ${expected}`);
    expect(cs).toEqual(before);
    const result = play(cs, 'ember_burst');
    expect(cs.enemies[0].hp - result.state.enemies[0].hp).toBe(expected);
    expect(result.state.player.ember).toBe(0); expect(result.state.player.energy).toBe(1);
    expect(result.events.filter(e => e.type === 'ember')).toEqual([{ type: 'ember', amount: -25, total: 0 }]);
  });

  it('9999余烬爆发与高额护盾仍得到有限的真实数值', () => {
    const cs = battle(['ember_burst']); cs.player.ember = EMBER_MAX;
    expect(preview(cs, 'ember_burst')).toContain('当前 59994');
    const result = play(cs, 'ember_burst');
    expect(cs.enemies[0].hp - result.state.enemies[0].hp).toBe(59994);
    expect(result.state.player.ember).toBe(0);
    const shield = battle(['ash_shield']); shield.player.ember = 15;
    expect(preview(shield, 'ash_shield')).toContain('当前 45');
    const guarded = play(shield, 'ash_shield').state;
    expect(guarded.player.block).toBe(45); expect(guarded.player.ember).toBe(0);
  });

  it('固定消耗与冷灰扣减仍可清零，不能成为负数或被沙漏反向加成', () => {
    let cs = battle(['ember_blade'], ['ash_hourglass']); cs.player.ember = 2;
    cs = play(cs, 'ember_blade').state; expect(cs.player.ember).toBe(0);
    cs.player.hand.push(card('cold_ash')); cs = endPlayerTurn(cs).state; expect(cs.player.ember).toBe(0);
    const one = battle(['cold_ash'], ['ash_hourglass']); one.player.ember = 1;
    const result = endPlayerTurn(one);
    expect(result.state.player.ember).toBe(0);
    expect(result.events.filter(e => e.type === 'ember')).toEqual([{ type: 'ember', amount: -1, total: 0 }]);
  });

  it.each([13, 9998])('保存与SL不会截断高余烬或重复增益：当前 %i', initial => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    let run = R.newRun('EMBER-LIMIT-SAVE');
    run.relics = ['ember_lantern', 'crowned_lantern', 'ember_seed', 'scribe_scroll', 'wishing_cinder'];
    run.deck = Array.from({ length: 10 }, (_, i) => card('stoke', `deck-${i}`));
    run = R.travelTo(run, run.map.startIds[0]);
    expect(run.combat!.player.ember).toBe(13);
    const original = structuredClone(run);
    run.combat!.player.ember = initial;
    const uid = run.combat!.player.hand[0].uid;
    run = R.combatPlayCard(run, uid, null).run;
    expect(run.combat!.player.ember).toBe(Math.min(9999, initial + 3));
    saveRun(run);
    const resumed = loadRun()!;
    expect(resumed).toEqual(run);
    expect(resumed.checkpoint!.combat!.player.ember).toBe(13);
    const reset = R.resetCurrentNode(resumed);
    expect(reset).toEqual(original);
    expect(R.combatPlayCard(reset, uid, null)).toEqual(R.combatPlayCard(original, uid, null));
    expect(R.combatPlayCard(reset, uid, null).run.combat!.player.ember).toBe(16);
  });
});
