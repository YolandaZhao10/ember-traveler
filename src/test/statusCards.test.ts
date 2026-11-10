import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARD_LIST, CARDS } from '../data/cards';
import { ENEMIES } from '../data/enemies';
import { describeCard } from '../engine/cards';
import { canPlayCard, createCombat, drawCards, endPlayerTurn, enemyAct, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { encounterDifficulty } from '../engine/difficulty';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CardInstance } from '../engine/types';

const card = (defId: string, uid = defId): CardInstance => ({ defId, uid, upgraded: false });
function battle(id = 'wind_scribe') {
  return createCombat('status-test', [id], ENEMIES[id].tier, [], 500, 500, [], makeRng('DAZED', 'c'), 100).state;
}
afterEach(() => vi.unstubAllGlobals());

describe('眩晕与后期塞牌', () => {
  it('眩晕独立为状态牌，不能打出、敲牌或进入奖励池', () => {
    const cs = battle(); cs.player.hand = [card('dazed')];
    expect(CARDS.dazed).toMatchObject({ type: 'status', rarity: 'status', ethereal: true });
    expect(canPlayCard(cs, cs.player.hand[0])).toMatchObject({ ok: false });
    expect(playCard(cs, 'dazed', null).state).toBe(cs);
    expect(R.canUpgrade(card('dazed'))).toBe(false);
    expect(CARD_LIST.filter(c => ['common', 'uncommon', 'rare'].includes(c.rarity)).some(c => c.id === 'dazed')).toBe(false);
    expect(describeCard(card('dazed'), null)).toContain('占用抽牌位，不补抽');
    expect(describeCard(card('dazed'), null)).toContain('自动消耗（优先于保留）');
  });
  it('抽五张时眩晕占位，不立即消失或自动补抽', () => {
    const cs = battle(); cs.player.draw = [card('strike', 'left'), ...Array.from({ length: 5 }, (_, i) => card(i === 4 ? 'dazed' : 'defend', `draw-${i}`))];
    drawCards(cs, 5, []);
    expect(cs.player.hand).toHaveLength(5); expect(cs.player.hand[0].defId).toBe('dazed');
    expect(cs.player.draw.map(c => c.uid)).toEqual(['left']); expect(cs.player.exhaust).toHaveLength(0);
  });
  it('回合末优先于临时保留而消耗，牌堆中尚未抽到的眩晕不提前清除', () => {
    const cs = battle(); cs.player.hand = [card('dazed'), card('defend')];
    cs.player.draw = [card('dazed', 'draw')]; cs.player.discard = [card('dazed', 'discard')];
    cs.player.turnFlags['retain:dazed'] = 1; cs.player.turnFlags['retain:defend'] = 1;
    const result = endPlayerTurn(cs);
    expect(result.state.player.hand.map(c => c.uid)).toEqual(['defend']);
    expect(result.state.player.exhaust.map(c => c.uid)).toEqual(['dazed']);
    expect(result.state.player.draw.map(c => c.uid)).toEqual(['draw']); expect(result.state.player.discard.map(c => c.uid)).toEqual(['discard']);
    expect(result.events).toContainEqual({ type: 'cardRemoved', card: card('dazed'), destination: 'exhaust', random: false });
    expect(endPlayerTurn(result.state).state).toBe(result.state);
  });
  it('自动消耗衔接灰烬盛宴、抽牌及灰烬储备，不丢牌、不重复消耗或反复取回自己', () => {
    const cs = battle(); cs.player.hand = [card('dazed', 'a')]; cs.player.draw = [card('defend', 'b'), card('dazed', 'c')];
    cs.player.statuses = { ashInsight: 1, ashFeast: 4, ashRecall: 3 };
    const result = endPlayerTurn(cs), p = result.state.player;
    expect(p.exhaust.map(c => c.uid)).toEqual(['a', 'c']); expect(p.discard.map(c => c.uid)).toEqual(['b']);
    expect(p.hand).toHaveLength(0); expect(p.block).toBe(11); expect(p.turnFlags.exhausted).toBe(2);
    expect(result.events.filter(e => e.type === 'cardRemoved')).toHaveLength(2);
  });
  it('自动消耗的反击杀敌后立即结束，不继续结算后续牌', () => {
    const cs = battle(); cs.player.hand = [card('dazed', 'a'), card('dazed', 'b')];
    cs.player.statuses.kindling = 10; cs.enemies[0].hp = 1;
    const result = endPlayerTurn(cs);
    expect(result.state.outcome).toBe('won'); expect(result.state.phase).toBe('ended');
    expect(result.state.player.exhaust).toHaveLength(1); expect(result.state.player.hand.map(c => c.uid)).toEqual(['b']);
  });
  it('主动随机消耗或随机弃置眩晕使用已有离手事件，不在回合末重复触发', () => {
    for (const source of ['burn_pages', 'truce_smoke']) {
      const cs = battle(); cs.player.hand = [card(source), card('dazed')];
      const result = playCard(cs, source, null);
      const removed = result.events.filter(e => e.type === 'cardRemoved' && e.card.uid === 'dazed');
      expect(removed).toHaveLength(1);
      expect(removed[0]).toMatchObject({ destination: source === 'burn_pages' ? 'exhaust' : 'discard', random: true });
      if (source === 'burn_pages') expect(endPlayerTurn(result.state).events.filter(e => e.type === 'cardRemoved')).toHaveLength(0);
    }
  });
  it.each([
    ['star_moth', 'dust', 'discard', 2], ['wind_scribe', 'page', 'draw', 2],
    ['orrery_keeper', 'mist', 'discard', 2], ['eclipse_archon', 'veil', 'draw', 2],
    ['last_warden', 'seal', 'draw', 2], ['nightless_lord', 'wall', 'discard', 3],
  ] as const)('%s的%s将眩晕放入%s，数量%s且重复调用不复制', (id, move, pile, count) => {
    const cs = battle(id); cs.enemies[0].moveId = move;
    cs.player.draw = Array.from({ length: 6 }, (_, i) => card('strike', `old-${i}`));
    const input = endPlayerTurn(cs).state, result = enemyAct(input, 'e0');
    expect(result.state.player[pile].filter(c => c.defId === 'dazed')).toHaveLength(count);
    expect(result.state.player.draw.filter(c => c.defId !== 'dazed')).toEqual(cs.player.draw);
    expect(enemyAct(result.state, 'e0').state).toBe(result.state);
    expect(enemyAct(input, 'e0')).toEqual(result);
    const cards = [...result.state.player.draw, ...result.state.player.discard];
    expect(new Set(cards.map(c => c.uid)).size).toBe(cards.length);
  });
  it('塞牌数量不随难度倍率扩大，诅咒每次至多一张', () => {
    for (const id of ['star_moth', 'wind_scribe', 'star_pilgrim', 'sealed_archivist', 'orrery_keeper', 'eclipse_archon', 'last_warden', 'nightless_lord']) {
      for (const move of ENEMIES[id]?.moves ?? []) for (const a of move.actions) {
        if (a.kind === 'addCardToDraw' || a.kind === 'addCardToDiscard') expect(a.count).toBeLessThanOrEqual(CARDS[a.cardId].type === 'curse' ? 1 : 3);
      }
    }
    const cs = battle(); cs.difficulty = encounterDifficulty(64, 'boss');
    cs.enemies[0].moveId = 'page';
    expect(enemyAct(endPlayerTurn(cs).state, 'e0').state.player.draw.filter(c => c.defId === 'dazed')).toHaveLength(2);
  });
  it('刷新与SL保持插牌位置，战后永久牌组不带走眩晕', () => {
    let run = R.newRun('STATUS-SAVE'); run = R.travelTo(run, run.map.startIds[0]);
    const deck = structuredClone(run.deck);
    run.combat = battle(); run.combat.enemies[0].moveId = 'page';
    run.combat = enemyAct(endPlayerTurn(run.combat).state, 'e0').state;
    const data = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    saveRun(run); const loaded = loadRun()!;
    expect(loaded.combat!.player.draw).toEqual(run.combat.player.draw);
    expect(R.resetCurrentNode(loaded).combat!.player.draw.every(c => c.defId !== 'dazed')).toBe(true);
    loaded.combat!.outcome = 'won'; expect(R.finishCombat(loaded).deck).toEqual(deck);
  });
});
