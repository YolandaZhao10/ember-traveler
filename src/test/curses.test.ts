import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARD_LIST, CARDS } from '../data/cards';
import { EXTRA_CURSES } from '../data/curses';
import { EVENT_LIST } from '../data/events';
import { describeCard } from '../engine/cards';
import { canPlayCard, createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CardInstance, EventOutcome } from '../engine/types';

const card = (defId: string, uid = defId): CardInstance => ({ defId, uid, upgraded: false });
function combat(ids: string[]) {
  const cs = createCombat('curses', ['tomb_puppet'], 'normal', [], 60, 72, [], makeRng('CURSES', 'combat'), 100).state;
  cs.player.hand = ids.map(id => card(id)); cs.player.ember = 5;
  return cs;
}
afterEach(() => vi.unstubAllGlobals());
describe('诅咒结算与获得途径', () => {
  it('7种诅咒都不能打出或升级，描述来自同一效果定义', () => {
    const curses = CARD_LIST.filter(c => c.type === 'curse'); expect(curses).toHaveLength(7);
    for (const c of curses) {
      const cs = combat([c.id]);
      expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(false);
      expect(playCard(cs, c.id, null).state).toBe(cs);
      expect(R.canUpgrade(card(c.id))).toBe(false);
      expect(describeCard(card(c.id), null)).toContain('无法打出');
      if (c.handEndEffects?.length) expect(describeCard(card(c.id), null)).toContain('回合结束时，若仍在手中');
    }
  });
  it('留在手中的悔恨无视格挡，冷灰削减余烬，弃牌和消耗区的诅咒不触发', () => {
    const cs = combat(['regret', 'cold_ash']); cs.player.block = 100;
    cs.player.discard = [card('regret', 'discard')]; cs.player.exhaust = [card('cold_ash', 'exhaust')];
    const result = endPlayerTurn(cs);
    expect(result.state.player.hp).toBe(58); expect(result.state.player.block).toBe(100); expect(result.state.player.ember).toBe(3);
    expect(result.state.player.hand).toHaveLength(0);
    expect(endPlayerTurn(result.state).state).toBe(result.state);
    const empty = combat(['cold_ash']); empty.player.ember = 1;
    expect(endPlayerTurn(empty).state.player.ember).toBe(0);
  });
  it('虚弱、脆弱不在施加时立刻消失，易伤影响接下来的敌人攻击', () => {
    let cs = endPlayerTurn(combat(['doubt', 'frailty', 'exposure'])).state;
    expect(cs.player.statuses).toMatchObject({ weak: 1, frail: 1, vulnerable: 1 });
    cs.enemies[0].moveId = 'smash';
    const normal = structuredClone(cs); delete normal.player.statuses.vulnerable;
    const hurt = enemyAct(cs, 'e0').state; const plain = enemyAct(normal, 'e0').state;
    expect(cs.player.hp - hurt.player.hp).toBe(13); expect(cs.player.hp - plain.player.hp).toBe(9);
    cs = startPlayerTurn(hurt).state;
    expect(cs.player.statuses).toMatchObject({ weak: 1, frail: 1 });
    cs.player.hand = []; cs = endPlayerTurn(cs).state;
    expect(cs.player.statuses.weak ?? 0).toBe(0); expect(cs.player.statuses.frail ?? 0).toBe(0);
  });
  it('重负保留占手牌，但可以消耗；被提前消耗的悔恨不扣血', () => {
    let cs = endPlayerTurn(combat(['burden'])).state;
    expect(cs.player.hand.map(c => c.defId)).toEqual(['burden']);
    cs = combat(['burn_pages', 'regret']); cs.player.energy = 3;
    // 焚书只剩一个可消耗目标，避免随机选择影响断言。
    cs = playCard(cs, 'burn_pages', null).state;
    expect(cs.player.exhaust.some(c => c.defId === 'regret')).toBe(true);
    expect(endPlayerTurn(cs).state.player.hp).toBe(60);
  });
  it('诅咒致死后立即结束，不会继续加减益、被后续回血复活或重复触发', () => {
    const cs = combat(['regret', 'doubt']); cs.player.hp = 1;
    const ended = endPlayerTurn(cs).state;
    expect(ended).toMatchObject({ phase: 'ended', outcome: 'lost' }); expect(ended.player.hp).toBe(0);
    expect(ended.player.statuses.weak).toBeUndefined(); expect(enemyAct(ended, 'e0').state).toBe(ended);
  });
  it('六种新增诅咒均有事件来源，选择、存档、刷新和SL不会重复添加', () => {
    const sources = EVENT_LIST.flatMap(event => event.choices.flatMap(choice => choice.outcomes.filter((o): o is Extract<EventOutcome, { kind: 'curse' }> => o.kind === 'curse').map(outcome => ({ event, choice, id: outcome.cardId }))));
    for (const curse of EXTRA_CURSES) {
      const source = sources.find(s => s.id === curse.id)!; expect(source).toBeTruthy();
      let run = R.newRun('CURSE-EVENT'); run.chapter = source.event.chapter ?? 1;
      const id = run.map.startIds[0]; run.map.nodes[id].type = 'event'; run.map.nodes[id].mysteryType = 'event'; run = R.travelTo(run, id);
      run.event!.eventId = source.event.id; run.checkpoint = null;
      const snapshot = structuredClone(run); run.checkpoint = snapshot;
      const changed = R.eventChoose(run, source.choice.id);
      expect(changed.deck.filter(c => c.defId === curse.id)).toHaveLength(1);
      expect(R.eventChoose(changed, source.choice.id)).toBe(changed);
      const data = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
      saveRun(changed); const restored = loadRun()!; expect(restored.deck).toEqual(changed.deck);
      expect(R.resetCurrentNode(restored).deck.some(c => c.defId === curse.id)).toBe(false);
      expect(R.shopRemoveCard({ ...changed, screen: 'shop', gold: 999, shop: { cards: [], relics: [], removePrice: 50, removeUsed: false } }, changed.deck.find(c => c.defId === curse.id)!.uid).deck.some(c => c.defId === curse.id)).toBe(false);
    }
  });
  it('烟尘先知产生战斗内疑惧，战后不会混入永久牌组', () => {
    let run = R.newRun('TEMP-CURSE'); run = R.travelTo(run, run.map.startIds[0]);
    run.combat = createCombat('seer', ['soot_seer'], 'normal', run.deck, run.hp, run.maxHp, run.relics, run.rng.combat, run.uidCounter).state;
    run.combat = enemyAct(endPlayerTurn(run.combat).state, 'e0').state;
    expect(run.combat.player.discard.some(c => c.defId === 'doubt')).toBe(true);
    run.combat.outcome = 'won'; const after = R.finishCombat(run);
    expect(after.deck.every(c => CARDS[c.defId].type !== 'curse')).toBe(true);
  });
});
