import { playOptions } from './playOptions';
import { describe, expect, it } from 'vitest';
import { EVENTS } from '../data/events';
import { viewCard } from '../engine/cards';
import { aliveEnemies, canPlayCard } from '../engine/combat';
import { availableNodes } from '../engine/map';
import { makeRng, nextFloat, pick } from '../engine/rng';
import * as R from '../engine/run';
import type { RunState } from '../engine/types';

/**
 * 无头模拟：一个简单的机器人从开局一直玩到死亡或通关，
 * 用来验证完整流程、存档可序列化、不会卡死。
 */
function botCombat(run: RunState, rng: { s: number }): RunState {
  let guard = 0;
  while (run.combat && run.combat.outcome === 'ongoing' && guard++ < 400) {
    const cs = run.combat;
    // 出牌：优先攻击血量最低的敌人
    const playable = cs.player.hand.filter((c) => canPlayCard(cs, c).ok);
    if (playable.length) {
      // 低费优先，稍带随机
      playable.sort((a, b) => viewCard(a).cost - viewCard(b).cost + (nextFloat(rng) - 0.5));
      const c = playable[0];
      const v = viewCard(c);
      const enemies = aliveEnemies(cs).slice().sort((a, b) => a.hp - b.hp);
      const option = playOptions(cs, c)[0];
      const target = option.replayUid ? option.target : v.target === 'enemy' ? enemies[0].id : null;
      const before = run;
      run = R.combatPlayCard(run, c.uid, target, option.replayUid).run;
      if (run === before) throw new Error(`出牌失败 ${v.name}`);
      continue;
    }
    run = R.combatEndTurn(run).run;
    for (const e of run.combat!.enemies.map((e) => e.id)) {
      if (run.combat!.outcome !== 'ongoing') break;
      run = R.combatEnemyAct(run, e).run;
    }
    if (run.combat!.outcome === 'ongoing') run = R.combatStartTurn(run).run;
  }
  if (guard >= 400) throw new Error('战斗未在 400 步内结束');
  return R.finishCombat(run);
}

export function playRun(seed: string): RunState {
  const rng = makeRng(seed, 'bot');
  let run = R.newRun(seed);
  let steps = 0;
  while (run.screen !== 'gameover' && run.screen !== 'victory' && steps++ < 2000) {
    // 模拟刷新：序列化再反序列化
    run = JSON.parse(JSON.stringify(run));
    switch (run.screen) {
      case 'chapter':
        run = R.enterNextChapter(run);
        break;
      case 'map': {
        const opts = availableNodes(run.map, run.currentNodeId);
        expect(opts.length).toBeGreaterThan(0);
        run = R.travelTo(run, pick(rng, opts));
        break;
      }
      case 'combat':
        run = botCombat(run, rng);
        break;
      case 'reward': {
        run = R.rewardTakeGold(run);
        if (run.reward!.relicChoices?.length) run = R.rewardTakeRelic(run, run.reward!.relicChoices[0]);
        else if (run.reward!.relic) run = R.rewardTakeRelic(run);
        if (run.reward!.cards.length && nextFloat(rng) < 0.85) run = R.rewardTakeCard(run, pick(rng, run.reward!.cards).uid);
        else run = R.rewardSkipCard(run);
        run = R.rewardLeave(run);
        break;
      }
      case 'shop': {
        const s = run.shop!;
        const idx = s.cards.findIndex((c) => !c.sold && c.price <= run.gold);
        if (idx >= 0 && nextFloat(rng) < 0.7) run = R.shopBuyCard(run, idx);
        const ridx = run.shop!.relics.findIndex((r) => !r.sold && r.price <= run.gold);
        if (ridx >= 0) run = R.shopBuyRelic(run, ridx);
        if (!run.shop!.removeUsed && run.gold >= run.shop!.removePrice) {
          const strike = run.deck.find((c) => c.defId === 'strike');
          if (strike) run = R.shopRemoveCard(run, strike.uid);
        }
        run = R.shopLeave(run);
        break;
      }
      case 'rest': {
        if (run.hp < run.maxHp * 0.6) run = R.restHeal(run);
        else {
          run = R.restStartUpgrade(run);
          const c = run.deck.find(R.canUpgrade);
          if (c) run = R.restUpgrade(run, c.uid);
          else run = R.restCancelUpgrade(run);
        }
        run = R.restLeave(run);
        break;
      }
      case 'event': {
        const ev = EVENTS[run.event!.eventId];
        const avail = ev.choices.filter((c) => R.eventChoiceAvailable(run, c.id));
        expect(avail.length).toBeGreaterThan(0);
        run = R.eventChoose(run, pick(rng, avail).id);
        if (run.event?.pendingPick) {
          const c = run.event.pendingPick === 'upgrade' ? run.deck.find(R.canUpgrade) : run.deck[0];
          if (c) run = R.eventPickCard(run, c.uid);
          else run = R.eventLeave(run);
        }
        if (run.screen === 'event') run = R.eventLeave(run);
        break;
      }
    }
  }
  expect(steps).toBeLessThan(2000);
  return run;
}

describe('完整一局模拟', () => {
  it('新局首战后只能进入第 2 层，刷新奖励也不会跳到第 8 层', () => {
    let run = R.newRun('ARTCHECK');
    run = R.travelTo(run, run.map.startIds[0]);
    expect(run.floor).toBe(0);
    run = botCombat(run, makeRng('first-floor', 'bot'));
    expect(run.screen).toBe('reward');
    run = R.rewardLeave(JSON.parse(JSON.stringify(run)));
    const next = availableNodes(run.map, run.currentNodeId);
    expect(next.length).toBeGreaterThan(0);
    expect(next.every((id) => run.map.nodes[id].row === 1)).toBe(true);
    const eighth = Object.values(run.map.nodes).find((n) => n.row === 7)!;
    expect(R.travelTo(run, eighth.id)).toBe(run);
    expect(R.travelTo(run, next[0]).floor).toBe(1);
  });

  it('30 个种子都能正常走到死亡或通关', () => {
    let wins = 0;
    let floors = 0;
    for (let i = 0; i < 30; i++) {
      const run = playRun(`sim-${i}`);
      expect(['gameover', 'victory']).toContain(run.screen);
      expect(run.combat).toBeNull();
      if (run.screen === 'victory') wins++;
      floors += run.floor;
    }
    // 机器人很笨，不要求高胜率；但也不能完全打不到后期
    expect(floors / 30).toBeGreaterThan(3);
    console.log(`bot 胜率 ${wins}/30，平均到达层数 ${(floors / 30).toFixed(1)}`);
  });

  it('同一种子结果可复现', () => {
    const a = playRun('repro');
    const b = playRun('repro');
    expect(a.floor).toBe(b.floor);
    expect(a.screen).toBe(b.screen);
    expect(a.deck.map((c) => c.defId)).toEqual(b.deck.map((c) => c.defId));
  });

  it('奖励不可重复领取', () => {
    let run = R.newRun('reward');
    run = R.travelTo(run, run.map.startIds[0]);
    run = botCombat(run, makeRng('x', 'y'));
    if (run.screen === 'reward') {
      const g = run.gold;
      run = R.rewardTakeGold(run);
      const g2 = run.gold;
      expect(R.rewardTakeGold(run).gold).toBe(g2);
      expect(g2).toBeGreaterThan(g);
      const deckN = run.deck.length;
      run = R.rewardTakeCard(run, run.reward!.cards[0].uid);
      expect(run.deck.length).toBe(deckN + 1);
      expect(R.rewardTakeCard(run, run.reward!.cards[1].uid).deck.length).toBe(deckN + 1);
    }
  });
});
