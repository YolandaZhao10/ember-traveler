import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCombat, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import { STATUSES } from '../data/statuses';

function setup(id = 'strike') {
  const cs = createCombat('echo-count', ['tomb_puppet'], 'normal', [], 100, 100, [], makeRng('ECHO-COUNT', 'c'), 100).state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 10000;
  cs.player.hand = [{ uid: 'played', defId: id, upgraded: false }];
  cs.player.draw = Array.from({ length: 30 }, (_, i) => ({ uid: `draw-${i}`, defId: 'defend', upgraded: false }));
  cs.player.statuses.echo = 1;
  return cs;
}
afterEach(() => vi.unstubAllGlobals());

describe('回响逐次计入出牌次数', () => {
  it.each(['strike', 'defend'])('%s一次回响算两次，能量只付一次、实体卡只弃置一次', id => {
    const before = setup(id), { state: cs, events } = playCard(before, 'played', 'e0');
    expect(cs.player.cardsPlayedThisTurn).toBe(2);
    expect(cs.player.attacksPlayedThisTurn).toBe(id === 'strike' ? 2 : 0);
    expect(cs.player.skillsPlayedThisTurn).toBe(id === 'defend' ? 2 : 0);
    expect(cs.player.energy).toBe(2); expect(cs.player.discard.map(c => c.uid)).toEqual(['played']);
    expect(events.filter(e => e.type === 'cardPlayed')).toHaveLength(2);
    expect(cs.player.statuses.echo ?? 0).toBe(0);
  });

  it('余音在两次之间过门槛，两张能力分别保留自己的进度', () => {
    const cs = setup('defend'); cs.player.statuses.tempo = 3;
    cs.player.powerInstances = [{ status: 'tempo', amount: 1, progress: 1 }, { status: 'tempo', amount: 2, progress: 2 }];
    const step = playCard(cs, 'played', null);
    expect(step.events.filter(e => e.type === 'draw')).toEqual([{ type: 'draw', count: 2 }, { type: 'draw', count: 1 }]);
    expect(step.state.player.powerInstances?.map(p => p.progress)).toEqual([0, 1]);
  });

  it('第二/第三次攻击触发不跳过，首次加伤不重复，递增伤害使用最新攻击计数', () => {
    const cs = setup(); cs.relics = ['flint', 'trail_boots', 'drummer_heart']; cs.player.statuses.crescendo = 2;
    let next = playCard(cs, 'played', 'e0').state;
    expect(next.enemies[0].hp).toBe(9983); // 首次 6+3，回响 6+2。
    expect(next.player.block).toBe(3);
    next.player.statuses.echo = 1; next.player.statuses.comboFlow = 1;
    next.player.hand.push({ uid: 'again', defId: 'strike', upgraded: false });
    next = playCard(next, 'again', 'e0').state;
    expect(next.player.attacksPlayedThisTurn).toBe(4); expect(next.player.energy).toBe(3); // 第二次付1，第三攻返2，仅一次。
  });

  it('第N张牌的遗物在重放中结算，不会漏掉被跨过的门槛', () => {
    const cs = setup('defend'); cs.relics = ['clocktower_gear'];
    cs.player.cardsPlayedThisTurn = 3; cs.player.turnFlags['relic:cardPlayed'] = 3;
    const next = playCard(cs, 'played', null).state;
    expect(next.player.cardsPlayedThisTurn).toBe(5); expect(next.player.energy).toBe(3);
    expect(next.player.block).toBe(16); expect(next.player.hand).toHaveLength(1);
  });

  it('复制技能也会激怒敌人两次；非能力牌以外不消耗回响', () => {
    const cs = setup('defend'); cs.enemies[0].statuses.enrage = 2;
    expect(playCard(cs, 'played', null).state.enemies[0].statuses.strength).toBe(4);
    const power = playCard(setup('tempo'), 'played', null).state;
    expect(power.player.cardsPlayedThisTurn).toBe(1); expect(power.player.statuses.echo).toBe(1);
    expect(power.player.powerInstances?.[0].progress).toBe(0);
  });

  it('镜像与回响统一累计，但复制不递归触发复制；新获得回响留给下一张', () => {
    const cs = setup(); cs.player.statuses.mirror = 2;
    cs.player.powerInstances = [{ status: 'mirror', amount: 1, progress: 0 }, { status: 'mirror', amount: 1, progress: 0 }];
    const next = playCard(cs, 'played', 'e0').state;
    expect(next.player.cardsPlayedThisTurn).toBe(4); expect(next.player.attacksPlayedThisTurn).toBe(4);
    expect(next.player.energy).toBe(2); expect(next.enemies[0].hp).toBe(9976);
    const generated = setup('echo_card'); generated.player.statuses.echo = 0;
    const result = playCard(generated, 'played', null).state;
    expect(result.player.cardsPlayedThisTurn).toBe(1); expect(result.player.statuses.echo).toBeGreaterThan(0);
  });

  it('第一次已结束战斗时不虚增第二次出牌，反伤致死同样停止', () => {
    const cs = setup(); cs.enemies[0].hp = 1;
    const won = playCard(cs, 'played', 'e0');
    expect(won.state.outcome).toBe('won'); expect(won.state.player.cardsPlayedThisTurn).toBe(1);
    expect(won.events.filter(e => e.type === 'cardPlayed')).toHaveLength(1);
    const lethal = setup(); lethal.enemies[0].statuses.thorns = 100;
    const lost = playCard(lethal, 'played', 'e0');
    expect(lost.state.outcome).toBe('lost'); expect(lost.state.player.cardsPlayedThisTurn).toBe(1);
  });

  it('局内总出牌统计同步计入重放，刷新保留、SL撤回', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    const base = R.newRun('ECHO-SAVE'), run = R.travelTo(base, base.map.startIds[0]); run.combat = setup();
    const played = R.combatPlayCard(run, 'played', 'e0').run;
    expect(played.stats.cardsPlayed).toBe(2); saveRun(played);
    expect(loadRun()!.combat!.player.cardsPlayedThisTurn).toBe(2); expect(loadRun()!.stats.cardsPlayed).toBe(2);
    expect(R.resetCurrentNode(loadRun()!).stats.cardsPlayed).toBe(0);
    expect(STATUSES.echo.description(1)).toContain('计入出牌次数');
  });
});
