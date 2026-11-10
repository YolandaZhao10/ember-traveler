import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARDS } from '../data/cards';
import { describeCard, describeEffects, viewCard } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { loadRun, saveRun } from '../engine/save';
import { newRun, resetCurrentNode, SAVE_VERSION, travelTo } from '../engine/run';
import type { CombatState } from '../engine/types';

const card = (defId: string, upgraded = false, uid = defId) => ({ defId, upgraded, uid });
const ID = 'rekindle_history';
function battle(enemies = ['tomb_puppet', 'tomb_puppet'], relics: string[] = []) {
  const cs = createCombat('burn-history', enemies, 'normal', [], 9999, 9999, relics, makeRng('BURN-HISTORY', 'c'), 100, 'picker').state;
  for (const e of cs.enemies) { e.hp = e.maxHp = 10000; e.block = 0; }
  return cs;
}
function use(cs: CombatState, id: string, target = 'e0', up = false) {
  cs.player.hand.push(card(id, up, `${id}-${cs.player.cardsPlayedThisTurn}`));
  cs.player.energy = 9;
  return playCard(cs, cs.player.hand[cs.player.hand.length - 1].uid, target).state;
}
const context = (cs: CombatState, i = 0) => ({ player: cs.player, target: cs.enemies[i], relics: cs.relics, isFirstAttack: true, crescendoBonus: 0 });
afterEach(() => vi.unstubAllGlobals());

describe('旧火重燃与逐敌燃烧记录', () => {
  it.each([false, true])('升级=%s：保留跨回合，按累计施加，支付一次费用后消耗', up => {
    let cs = use(battle(), 'tend_coals');
    cs.player.hand = [card(ID, up)];
    expect(viewCard(cs.player.hand[0])).toMatchObject({ cost: up ? 1 : 2, retain: true, exhaust: true, rarity: 'uncommon' });
    expect(CARDS[ID].owner).toBe('picker');
    cs = endPlayerTurn(cs).state;
    for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
    cs = startPlayerTurn(cs).state;
    expect(cs.player.hand.some(c => c.uid === ID)).toBe(true);
    expect(cs.enemies[0].statuses.burn).toBe(3);
    expect(cs.enemies[0].burnApplied).toBe(4);
    const before = structuredClone(cs);
    expect(describeCard(card(ID, up), context(cs))).toContain('当前 4 层');
    expect(cs).toEqual(before);
    const result = playCard(cs, ID, 'e0');
    expect(result.state.player.energy).toBe(3 - (up ? 1 : 2));
    expect(result.state.player.exhaust.filter(c => c.uid === ID)).toHaveLength(1);
    expect(result.state.enemies[0]).toMatchObject({ statuses: { burn: 7 }, burnApplied: 8 });
    expect(result.state.enemies[1].burnApplied).toBe(0);
    expect(cs).toEqual(before);
  });

  it('群体、翻倍与传播分别记账，燃烧伤害和衰减不当作新增层数', () => {
    let cs = use(battle(), 'wildfire'); // 4 / 4
    cs = use(cs, 'tend_coals'); // 8 / 4
    cs = use(cs, 'add_fuel'); // 16 / 4
    cs = use(cs, 'flashover'); // 22 / 26
    expect(cs.enemies.map(e => e.burnApplied)).toEqual([22, 26]);
    cs = use(cs, 'detonate');
    expect(cs.enemies[0].statuses.burn).toBeUndefined();
    expect(cs.enemies[0].burnApplied).toBe(22);
    cs = use(cs, ID);
    expect(cs.enemies.map(e => [e.statuses.burn, e.burnApplied])).toEqual([[22, 44], [26, 26]]);
    cs = endPlayerTurn(cs).state;
    for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
    expect(cs.enemies.map(e => [e.statuses.burn, e.burnApplied])).toEqual([[21, 44], [25, 26]]);
  });

  it('开场遗物、能力和余烬触发的燃烧也计入；新战斗重新计数', () => {
    let cs = battle(undefined, ['picker_bell']);
    expect(cs.enemies.map(e => e.burnApplied)).toEqual([2, 2]);
    cs.player.statuses.pyre = 2;
    cs = endPlayerTurn(cs).state;
    expect(cs.enemies.map(e => e.burnApplied)).toEqual([4, 4]);
    for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
    cs = startPlayerTurn(cs).state;
    cs.player.statuses.emberConduit = 6; cs.player.ember = 5;
    cs = use(cs, 'ember_burst');
    expect(cs.enemies.map(e => e.burnApplied)).toEqual([10, 10]);
    expect(battle().enemies.map(e => e.burnApplied)).toEqual([0, 0]);
  });

  it('首领净化燃烧不会清除历史，清空或转换燃烧后仍能重燃', () => {
    let cs = use(battle(['ash_sovereign']), 'tend_coals');
    cs.enemies[0].moveId = 'awaken';
    cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
    expect(cs.enemies[0].statuses.burn).toBeUndefined();
    expect(cs.enemies[0].burnApplied).toBe(4);
    cs = startPlayerTurn(cs).state;
    cs = use(cs, ID);
    cs = use(cs, 'white_hot');
    expect(cs.enemies[0].statuses.burn).toBeUndefined();
    expect(cs.enemies[0].burnApplied).toBe(8);
    cs = use(cs, ID);
    expect(cs.enemies[0].statuses.burn).toBe(8);
  });

  it('回响按每次实际结算时的累计值重放，本牌施加也记账，只扣一次费/消耗一个实体', () => {
    const cs = use(battle(), 'tend_coals');
    cs.player.hand = [card(ID)]; cs.player.energy = 3; cs.player.statuses.echo = 1;
    const result = playCard(cs, ID, 'e0');
    expect(result.events.filter(e => e.type === 'status' && e.status === 'burn').map(e => e.type === 'status' ? e.amount : 0)).toEqual([4, 8]);
    expect(result.state.enemies[0]).toMatchObject({ statuses: { burn: 16 }, burnApplied: 16 });
    expect(result.state.player).toMatchObject({ energy: 1, cardsPlayedThisTurn: 3 });
    expect(result.state.player.exhaust).toEqual([card(ID)]);
    expect(result.state.player.statuses.echo ?? 0).toBe(0);
  });

  it('零历史不会凭空生火；无效/死亡目标不扣费、不消耗', () => {
    const cs = battle(); cs.player.hand = [card(ID)];
    for (const target of [null, 'missing']) expect(playCard(cs, ID, target).state).toBe(cs);
    cs.enemies[1].hp = 0;
    expect(playCard(cs, ID, 'e1').state).toBe(cs);
    const after = playCard(cs, ID, 'e0').state;
    expect(after.enemies[0].burnApplied).toBe(0); expect(after.enemies[0].statuses.burn).toBeUndefined();
    expect(after.player.exhaust).toHaveLength(1);
  });

  it('卡面按前序施加/翻倍/消耗更新历史预览，预览不写入状态', () => {
    const cs = battle(), before = structuredClone(cs);
    const text = describeEffects([
      { kind: 'status', status: 'burn', amount: 3, target: 'target' },
      { kind: 'doubleStatus', status: 'burn' }, { kind: 'consumeBurn', damagePer: 1 },
      { kind: 'reapplyBurn' }, { kind: 'reapplyBurn' },
    ], context(cs));
    expect(text).toContain('当前 6 层'); expect(text).toContain('当前 12 层');
    expect(cs).toEqual(before);
  });

  it.each([false, true])('存档与SL都保留各自累计量；旧存档=%s只以现存燃烧接续、不重掷随机', legacy => {
    let run = newRun('BURN-SAVE', 'picker'); run = travelTo(run, run.map.startIds[0]);
    run.combat = use(battle(), 'tend_coals');
    run.checkpoint = structuredClone({ ...run, checkpoint: undefined });
    run.combat = use(run.combat, 'detonate');
    const rng = structuredClone(run.combat.rng);
    if (legacy) {
      run.version = run.checkpoint!.version = 19;
      for (const snapshot of [run, run.checkpoint!]) for (const e of snapshot.combat!.enemies) Reflect.deleteProperty(e, 'burnApplied');
    }
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    saveRun(run);
    const loaded = loadRun()!;
    expect(loaded.version).toBe(SAVE_VERSION); expect(loaded.checkpoint!.version).toBe(SAVE_VERSION);
    expect(loaded.combat!.enemies[0].burnApplied).toBe(legacy ? 0 : 4);
    expect(resetCurrentNode(loaded).combat!.enemies[0].burnApplied).toBe(4);
    expect(loaded.combat!.rng).toEqual(rng);
  });
});

describe.each([false, true])('破阵横扫永久力量，升级=%s', up => {
  it('先增力再群攻，回合结束仅移除之前已有的临时力量，之后力量继续叠加', () => {
    let cs = battle(); const amount = up ? 3 : 2;
    cs.player.hand = [card('line_breaker', up)]; cs.player.statuses = { strength: 7, strengthDown: 4 };
    cs.player.hpLostThisTurn = 1;
    const text = describeCard(cs.player.hand[0], context(cs));
    expect(text).toContain(`获得 ${amount} 层力量`); expect(text).not.toContain('回合结束时失去');
    const result = playCard(cs, 'line_breaker', null); cs = result.state;
    expect(cs.player.statuses.strength).toBe(7 + amount); expect(cs.player.statuses.strengthDown).toBe(4);
    expect(cs.player.block).toBe(up ? 8 : 6);
    expect(cs.enemies.map(e => e.hp)).toEqual([10000 - (up ? 20 : 16), 10000 - (up ? 20 : 16)]);
    cs = endPlayerTurn(cs).state;
    expect(cs.player.statuses.strength).toBe(3 + amount);
    for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
    cs = startPlayerTurn(cs).state;
    cs = use(cs, 'line_breaker', 'e0', up);
    expect(endPlayerTurn(cs).state.player.statuses.strength).toBe(3 + amount * 2);
    expect(battle().player.statuses.strength ?? 0).toBe(0);
  });
});
