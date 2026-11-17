import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { DEBT_COLLECTORS, debtCollectorId } from '../data/debtCollectors';
import { RELIC_LIST, RELICS, relicPool } from '../data/relics';
import { LOAN_AMOUNT, LOAN_REPAY } from '../engine/constants';
import { encounterDifficulty } from '../engine/difficulty';
import { availableNodes } from '../engine/map';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import { scoreJourney } from '../engine/score';
import type { ChapterId, RunState } from '../engine/types';
import { RelicBar, loanText } from '../ui/components/Common';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** 把下一站改成指定类型并前往；mystery 表示问号节点变成的商店。 */
function go(input: RunState, type: 'shop' | 'mystery' | 'combat'): RunState {
  const run = copy(input);
  const id = availableNodes(run.map, run.currentNodeId)[0];
  const node = run.map.nodes[id];
  if (type === 'mystery') { node.type = 'event'; node.mysteryType = 'shop'; } else { node.type = type; delete node.mysteryType; }
  delete node.encounterId;
  const next = R.travelTo(run, id);
  expect(next).not.toBe(run);
  return next;
}
function start(seed = 'LOAN', gold = 100, chapter: ChapterId = 1): RunState {
  const run = R.newRun(seed);
  run.chapter = chapter; run.gold = gold;
  return run;
}
const firstShop = (seed = 'LOAN', gold = 100, chapter: ChapterId = 1) => go(start(seed, gold, chapter), 'shop');
/** 借款后离店，再走到下一家商店门口。 */
function borrowAndReturn(gold: number, seed = 'LOAN', via: 'shop' | 'mystery' = 'shop'): RunState {
  const left = R.shopLeave(R.shopBorrow(firstShop(seed)));
  left.gold = gold;
  return go(left, via);
}
function finish(run: RunState, outcome: 'won' | 'lost'): RunState {
  const next = copy(run);
  next.combat!.outcome = outcome;
  if (outcome === 'lost') next.combat!.player.hp = 0;
  else for (const e of next.combat!.enemies) e.hp = 0;
  return R.finishCombat(next);
}
const bar = (run: RunState) => renderToStaticMarkup(React.createElement(RelicBar, { relics: run.relics, loan: run.loan }));
const lit = (html: string) => (html.match(/aria-label="贷款，未结清"/g) ?? []).length;
const gray = (html: string) => (html.match(/class="relic loan settled"/g) ?? []).length;

function memoryStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  return values;
}
afterEach(() => vi.unstubAllGlobals());

describe('商店借款', () => {
  it('数值是常量：借 200，还 250', () => {
    expect([LOAN_AMOUNT, LOAN_REPAY]).toEqual([200, 250]);
  });

  it('借款后金币 +200，不能再借，遗物栏出现一个点亮的「贷款」，其余状态不变', () => {
    const shop = firstShop();
    expect(shop.screen).toBe('shop');
    expect(shop.loan).toBeUndefined();
    expect(R.canBorrow(shop)).toBe(true);
    expect(lit(bar(shop)) + gray(bar(shop))).toBe(0);
    const borrowed = R.shopBorrow(shop);
    expect(borrowed.gold).toBe(shop.gold + 200);
    expect(borrowed.loan).toEqual({ outstanding: true, settled: 0 });
    expect(R.canBorrow(borrowed)).toBe(false);
    expect(R.shopBorrow(borrowed)).toBe(borrowed);
    expect([lit(bar(borrowed)), gray(bar(borrowed))]).toEqual([1, 0]);
    expect(bar(borrowed)).toContain('下次进商店时归还 250 金币，或与讨债人一战。');
    expect({ ...borrowed, gold: shop.gold, loan: undefined }).toEqual({ ...shop, loan: undefined });
  });

  it('下次进店金币 ≥ 250：出现二选一；归还则扣 250 后进店，贷款变灰', () => {
    const door = borrowAndReturn(250);
    expect(door.screen).toBe('debt');
    expect(door.loan).toEqual({ outstanding: true, settled: 0, stage: 'choice' });
    expect(door.shop).not.toBeNull();
    const repaid = R.debtRepay(door);
    expect([repaid.screen, repaid.gold, repaid.combat]).toEqual(['shop', 0, null]);
    expect(repaid.loan).toEqual({ outstanding: false, settled: 1 });
    expect(repaid.shop).toEqual(door.shop);
    expect([lit(bar(repaid)), gray(bar(repaid))]).toEqual([0, 1]);
    expect(bar(repaid)).toContain('已结清。');
    expect(loanText(true)).toBe('已结清。');
  });

  it('下次进店金币 ≥ 250：选择迎战则进入讨债战斗', () => {
    const fight = R.debtFight(borrowAndReturn(400));
    expect(fight.screen).toBe('combat');
    expect(fight.gold).toBe(400);
    expect(fight.loan).toEqual({ outstanding: true, settled: 0, stage: 'fight' });
    expect(fight.combat!.enemies.map(e => e.defId)).toEqual(['debt_collector_1']);
    expect(fight.combat!.tier).toBe('normal');
  });

  it('下次进店金币 < 250：不能归还，只能迎战', () => {
    const door = borrowAndReturn(249);
    expect(door.screen).toBe('debt');
    expect(R.debtRepay(door)).toBe(door);
    expect(R.debtFight(door).screen).toBe('combat');
  });

  it('讨债战斗胜利：金币不变、没有奖励，随后进入商店，货架正常；击杀数加一但通关层数不加', () => {
    const door = borrowAndReturn(120);
    const fight = R.debtFight(door);
    const won = finish(fight, 'won');
    expect([won.screen, won.gold, won.reward, won.combat]).toEqual(['shop', 120, null, null]);
    expect(won.shop).toEqual(door.shop);
    expect(won.loan).toEqual({ outstanding: false, settled: 1 });
    expect(won.deck).toEqual(door.deck);
    expect(won.relics).toEqual(door.relics);
    expect(won.stats.enemiesKilled).toBe(door.stats.enemiesKilled + 1);
    expect(won.stats.floorsCleared).toBe(door.stats.floorsCleared);
    expect(R.canBorrow(won)).toBe(true);
    expect(R.shopBuyCard({ ...won, gold: 999 }, 0).deck).toHaveLength(won.deck.length + 1);
  });

  it('讨债战斗胜利按普通战斗结算遗物效果：水壶回血、钱袋 +5 金币', () => {
    const door = borrowAndReturn(120);
    door.relics.push('canteen', 'coin_purse');
    door.hp = 30;
    const fight = R.debtFight(door);
    const hp = fight.combat!.player.hp;
    const won = finish(fight, 'won');
    expect(won.hp).toBeGreaterThan(hp);
    expect(won.gold).toBe(125);
    expect(won.reward).toBeNull();
  });

  it('讨债战斗失败按普通战败处理，且战败后不能回退重打', () => {
    const lost = finish(R.debtFight(borrowAndReturn(120)), 'lost');
    expect(lost.screen).toBe('gameover');
    expect(lost.combat).toBeNull();
    expect(R.resetCurrentNode(lost)).toBe(lost);
  });

  it('普通战败后同样不能回退重打；战斗进行中仍可回退', () => {
    const fight = go(start('LOAN-NORMAL'), 'combat');
    const cs = fight.combat!;
    const played = R.combatPlayCard(fight, cs.player.hand[0].uid, cs.enemies[0].id).run;
    expect(R.resetCurrentNode(played)).toEqual(fight);
    const lost = finish(fight, 'lost');
    expect(R.resetCurrentNode(lost)).toBe(lost);
  });

  it('了结后可以再借：一个灰色、一个点亮；借三次还三次后有三个灰色，更多时合并显示数量', () => {
    let run = R.debtRepay(borrowAndReturn(900));
    run = R.shopBorrow(run);
    expect(run.loan).toEqual({ outstanding: true, settled: 1 });
    expect([lit(bar(run)), gray(bar(run))]).toEqual([1, 1]);
    for (let i = 0; i < 2; i++) {
      run = go(R.shopLeave(run), 'shop');
      run = R.debtRepay(run);
      if (i === 0) run = R.shopBorrow(run);
    }
    expect(run.loan).toEqual({ outstanding: false, settled: 3 });
    expect([lit(bar(run)), gray(bar(run))]).toEqual([0, 3]);
    const many = bar({ ...run, loan: { outstanding: true, settled: 7 } });
    expect([lit(many), gray(many)]).toEqual([1, 1]);
    expect(many).toContain('×7');
  });

  it('「贷款」不在遗物表和遗物池里，不改变持有遗物、遗物池与计分', () => {
    const shop = firstShop();
    const borrowed = R.shopBorrow(shop);
    expect(borrowed.relics).toEqual(shop.relics);
    expect(RELIC_LIST.some(r => r.name === '贷款')).toBe(false);
    expect(Object.keys(RELICS).some(id => /loan|debt/.test(id))).toBe(false);
    expect(relicPool(borrowed.relics, borrowed.character).map(r => r.id)).toEqual(relicPool(shop.relics, shop.character).map(r => r.id));
    const settled = R.debtRepay(borrowAndReturn(900));
    expect(settled.relics).toEqual(shop.relics);
    const scored = (run: RunState) => scoreJourney({ ...run, screen: 'victory', gold: 0 });
    expect(scored(settled)).toEqual(scored({ ...settled, loan: undefined }));
  });

  it('讨债人不进任何遭遇池，四个章节各一个，沿用税吏形象，不逃跑、不偷金币、不塞牌', () => {
    expect(DEBT_COLLECTORS.map(e => e.id)).toEqual([1, 2, 3, 4].map(c => debtCollectorId(c as ChapterId)));
    expect(ENCOUNTERS.some(e => e.enemies.some(id => id.startsWith('debt_collector')))).toBe(false);
    for (const e of DEBT_COLLECTORS) {
      expect(ENEMIES[e.id]).toBe(e);
      expect([e.name, e.sprite, e.checkPhase, e.onDeath, e.onCombatStart]).toEqual(['讨债人', 'taxman', undefined, undefined, undefined]);
      const kinds = new Set(e.moves.flatMap(m => m.actions.map(a => a.kind)));
      for (const kind of kinds) expect(['attack', 'block', 'status']).toContain(kind);
    }
    expect(DEBT_COLLECTORS.map(e => e.hp[0])).toEqual([69, 116, 145, 215]);
  });

  it('事件变成的商店同样触发了结', () => {
    const door = borrowAndReturn(300, 'LOAN', 'mystery');
    expect(door.map.nodes[door.currentNodeId!].type).toBe('event');
    expect(door.screen).toBe('debt');
    expect(R.debtRepay(door).screen).toBe('shop');
  });

  it('终章商店不能借款；第三章借的款在终章商店照常了结，对手是终章讨债人', () => {
    const final = firstShop('LOAN-FINAL', 100, 4);
    expect(final.screen).toBe('shop');
    expect(R.canBorrow(final)).toBe(false);
    expect(R.shopBorrow(final)).toBe(final);
    const third = R.shopLeave(R.shopBorrow(firstShop('LOAN-THIRD', 100, 3)));
    third.chapter = 4;
    const door = go(third, 'shop');
    expect(door.screen).toBe('debt');
    expect(R.debtFight(door).combat!.enemies[0].defId).toBe('debt_collector_4');
    const repaid = R.debtRepay({ ...door, gold: 250 });
    expect([repaid.screen, repaid.loan?.outstanding, R.canBorrow(repaid)]).toEqual(['shop', false, false]);
  });
});

describe('借款与回退、随机数', () => {
  it('在店里回退会连同借款一起撤销，不能重复借款', () => {
    const shop = firstShop();
    const borrowed = R.shopBorrow(shop);
    const reset = R.resetCurrentNode(borrowed);
    expect(reset).toEqual(shop);
    expect([reset.gold, reset.loan]).toEqual([shop.gold, undefined]);
    expect(lit(bar(reset))).toBe(0);
  });

  it('归还后回退不会退回选择，也不会重复扣款', () => {
    const repaid = R.debtRepay(borrowAndReturn(600));
    const bought = R.shopBuyCard(repaid, 0);
    const reset = R.resetCurrentNode(bought);
    expect(reset).toEqual(repaid);
    expect([reset.screen, reset.gold, reset.loan]).toEqual(['shop', 350, { outstanding: false, settled: 1 }]);
    expect(R.debtRepay(reset)).toBe(reset);
    expect(R.debtFight(reset)).toBe(reset);
    expect([lit(bar(reset)), gray(bar(reset))]).toEqual([0, 1]);
  });

  it('选择迎战后回退只回到这场战斗的开头，不能改成归还；打赢后回退停在已结清的商店', () => {
    const fight = R.debtFight(borrowAndReturn(600));
    const cs = fight.combat!;
    const played = R.combatPlayCard(fight, cs.player.hand[0].uid, cs.enemies[0].id).run;
    const reset = R.resetCurrentNode(played);
    expect(reset).toEqual(fight);
    expect(R.debtRepay(reset)).toBe(reset);
    expect([lit(bar(reset)), gray(bar(reset))]).toEqual([1, 0]);
    const won = finish(fight, 'won');
    const after = R.resetCurrentNode(R.shopBuyCard(won, 0));
    expect(after).toEqual(won);
    expect(R.debtFight(after)).toBe(after);
    expect(after.loan).toEqual({ outstanding: false, settled: 1 });
  });

  it('归还或打赢后的货架、随机流都与没借款时进店完全一样', () => {
    for (const settle of ['repay', 'fight'] as const) {
      const plainFirst = R.shopLeave(firstShop('LOAN-SHELF'));
      const loanFirst = R.shopLeave(R.shopBorrow(firstShop('LOAN-SHELF')));
      plainFirst.gold = loanFirst.gold = 400;
      const plain = go(plainFirst, 'shop');
      const door = go(loanFirst, 'shop');
      let settled: RunState;
      if (settle === 'repay') settled = R.debtRepay(door);
      else {
        // 真实打几步再结算，确认战斗内的随机数不会泄漏到其他随机流。
        let fight = R.debtFight(door);
        fight = R.combatPlayCard(fight, fight.combat!.player.hand[0].uid, fight.combat!.enemies[0].id).run;
        fight = R.combatEndTurn(fight).run;
        for (const e of fight.combat!.enemies) fight = R.combatEnemyAct(fight, e.id).run;
        fight = R.combatStartTurn(fight).run;
        settled = finish(fight, 'won');
      }
      expect(settled.screen).toBe('shop');
      expect(settled.shop).toEqual(plain.shop);
      expect(settled.rng).toEqual(plain.rng);
      expect(settled.seenEncounters).toEqual(plain.seenEncounters);
      expect(settled.map).toEqual(plain.map);
      // 之后的战斗节点遇到相同的敌人、相同的开局手牌。
      const nextPlain = go(R.shopLeave(plain), 'combat'), nextLoan = go(R.shopLeave(settled), 'combat');
      expect(nextLoan.combat!.enemies.map(e => [e.defId, e.hp, e.moveId])).toEqual(nextPlain.combat!.enemies.map(e => [e.defId, e.hp, e.moveId]));
      expect(nextLoan.combat!.player.hand.map(c => c.defId)).toEqual(nextPlain.combat!.player.hand.map(c => c.defId));
    }
  });

  it('讨债人的强度以章末首领倍率为底，随商店所在楼层往上加，不会比原来弱', () => {
    const chapterEnd = encounterDifficulty(19, 'boss');
    const early = R.debtFight(borrowAndReturn(0));
    expect(early.floor).toBe(1);
    const d = early.combat!.difficulty!;
    expect(d.healthMultiplier).toBeCloseTo(chapterEnd.healthMultiplier + 0.02 * 1.1, 6);
    expect(d.attackMultiplier).toBeCloseTo(chapterEnd.attackMultiplier + 0.012 * 1.08, 6);
    expect(d.blockMultiplier).toBeGreaterThan(chapterEnd.blockMultiplier);
    const at = (floor: number, chapter: 1 | 2 | 3 | 4 = 1) => R.debtCollectorDifficulty({ chapter, floor, difficulty: early.difficulty });
    expect(at(0).healthMultiplier).toBeCloseTo(chapterEnd.healthMultiplier, 6);
    expect(at(0).attackMultiplier).toBeCloseTo(chapterEnd.attackMultiplier, 6);
    for (let floor = 1; floor < 20; floor++) expect(at(floor).healthMultiplier).toBeGreaterThan(at(floor - 1).healthMultiplier);
    expect(at(19).healthMultiplier).toBeCloseTo(chapterEnd.healthMultiplier + 19 * 0.02 * 1.1, 6);
    // 终章的商店同样以终章首领倍率为底。
    expect(at(62, 4).healthMultiplier).toBeCloseTo(encounterDifficulty(64, 'boss').healthMultiplier + 2 * 0.02 * 1.1, 6);
    const lateDoor = borrowAndReturn(0); lateDoor.floor = 17;
    expect(R.debtFight(lateDoor).combat!.enemies[0].maxHp).toBeGreaterThan(early.combat!.enemies[0].maxHp);
  });

  it('第二章讨债人的催告施加 1 层虚弱', () => {
    const notice = DEBT_COLLECTORS[1].moves.find(m => m.id === 'notice')!;
    expect(notice.actions).toEqual([{ kind: 'attack', amount: 9 }, { kind: 'status', status: 'weak', amount: 1, target: 'player' }]);
  });
});

describe('借款与存档', () => {
  it('旧存档没有借款字段时按没借过处理，可以正常借款', () => {
    memoryStorage();
    const shop = firstShop('LOAN-OLD');
    expect('loan' in shop).toBe(false);
    saveRun(shop);
    const loaded = loadRun()!;
    expect(loaded.loan).toBeUndefined();
    expect(lit(bar(loaded)) + gray(bar(loaded))).toBe(0);
    expect(R.shopBorrow(loaded).loan).toEqual({ outstanding: true, settled: 0 });
  });

  it('借款状态、了结选择和讨债战斗都能存读档，存档版本不变', () => {
    memoryStorage();
    const door = borrowAndReturn(300, 'LOAN-SAVE');
    for (const state of [door, R.debtFight(door), R.debtRepay(door)]) {
      saveRun(state);
      const loaded = loadRun()!;
      expect(loaded).toEqual(state);
      expect(loaded.version).toBe(20);
    }
    expect(R.SAVE_VERSION).toBe(20);
  });
});
