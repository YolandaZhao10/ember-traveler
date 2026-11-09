import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { aliveEnemies, createCombat, endPlayerTurn, enemyAct, enemyIntent, playCard, startPlayerTurn, stolenGold } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import { intentText } from '../ui/components/Common';

const battle = (ids = ['looter'], seed = 'ESCAPE') => createCombat('escape-test', ids, 'normal', [], 1000, 1000, [], makeRng(seed, 'c'), 100, 'traveler', undefined, 100).state;
afterEach(() => vi.unstubAllGlobals());

describe('偷钱怪逃跑', () => {
  it.each(['looter', 'ash_taxman'])('%s前五回合绝无逃跑，第六回合起随机预告且有完整玩家回合可阻止', id => {
    let attempts = 0;
    for (let seed = 0; seed < 300; seed++) {
      let cs = battle([id], `ESCAPE-BOUNDARY-${seed}`);
      for (let turn = 1; turn <= 5; turn++) {
        expect(cs.turn).toBe(turn); expect(enemyIntent(cs, cs.enemies[0])?.kind).not.toBe('escape');
        cs = endPlayerTurn(cs).state; cs = enemyAct(cs, 'e0').state; cs = startPlayerTurn(cs).state;
      }
      expect(cs.turn).toBe(6); expect(cs.phase).toBe('player'); expect(cs.enemies[0].hp).toBeGreaterThan(0);
      if (cs.enemies[0].moveId === 'escape') {
        attempts++;
        expect(intentText(enemyIntent(cs, cs.enemies[0])).text).toBe('逃跑');
        expect(cs.enemies[0].flags.escaped).toBeUndefined();
      }
    }
    expect(attempts).toBeGreaterThan(40); expect(attempts).toBeLessThan(85);
  });

  it('逃跑只移出自己并带走实际偷款，不触发死亡、饮血、击杀遗物或同伴复仇', () => {
    let cs = battle(['looter', 'twin_sentinel']); cs.phase = 'enemy'; cs.enemies[0].moveId = 'steal';
    cs = enemyAct(cs, 'e0').state;
    expect(cs.gold).toBe(88); expect(stolenGold(cs)).toBe(12);
    cs.enemies[0].flags.acted = 0; cs.enemies[0].moveId = 'escape';
    cs.player.statuses.sanguine = 9; cs.player.hp = 500;
    const allyStrength = cs.enemies[1].statuses.strength;
    const escaped = enemyAct(cs, 'e0');
    expect(escaped.state.gold).toBe(88); expect(stolenGold(escaped.state)).toBe(0);
    expect(escaped.state.enemies[0].flags).toMatchObject({ escaped: 1, escapedGold: 12, deadHandled: 1 });
    expect(escaped.state.player.hp).toBe(500); expect(escaped.state.enemies[1].statuses.strength).toBe(allyStrength);
    expect(escaped.events.some(e => e.type === 'death')).toBe(false);
    expect(aliveEnemies(escaped.state).map(e => e.defId)).toEqual(['twin_sentinel']);
    expect(escaped.state.outcome).toBe('ongoing');
    expect(enemyAct(escaped.state, 'e0').state).toBe(escaped.state);
    const next = startPlayerTurn(escaped.state).state;
    next.player.hand = [{ uid: 'strike', defId: 'strike', upgraded: false }];
    expect(playCard(next, 'strike', 'e0').state).toBe(next);
    expect(next.log.join('\n')).toContain('带走 12 金币');
  });

  it.each(['attack', 'burn'] as const)('准备逃跑时被%s击杀仍然全额返还且不逃跑', source => {
    const cs = battle(); cs.enemies[0].moveId = 'escape'; cs.enemies[0].hp = 1;
    cs.enemies[0].flags.stolenGold = 12; cs.gold = 88;
    cs.player.hand = [{ uid: 'strike', defId: 'strike', upgraded: false }];
    if (source === 'burn') cs.enemies[0].statuses.burn = 1;
    const result = source === 'attack' ? playCard(cs, 'strike', 'e0').state : enemyAct(endPlayerTurn(cs).state, 'e0').state;
    expect(result.gold).toBe(100); expect(stolenGold(result)).toBe(0);
    expect(result.enemies[0].flags.escaped).toBeUndefined(); expect(result.outcome).toBe('won');
  });

  it.each(['looter', 'ash_taxman'])('%s独自逃走不掉金币、卡牌或遗物，不计击杀；刷新和SL保持钱款与意图', id => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    const base = R.newRun(`ESCAPE-RUN-${id}`); base.gold = 100;
    const node = base.map.nodes[base.map.startIds[0]];
    node.type = ENEMIES[id].tier === 'elite' ? 'elite' : 'combat'; node.row = 4;
    node.encounterId = id === 'looter' ? 'looter1' : 'elite_taxman';
    const start = R.travelTo(base, node.id);
    const fleeing = structuredClone(start); fleeing.combat!.enemies[0].moveId = 'escape';
    fleeing.combat!.enemies[0].flags.stolenGold = 12; fleeing.gold = fleeing.combat!.gold = 88;
    saveRun(fleeing); const loaded = loadRun()!;
    expect(loaded.combat).toEqual(fleeing.combat);
    const ended = R.combatEnemyAct(R.combatEndTurn(loaded).run, 'e0').run;
    expect(ended.combat!.outcome).toBe('won');
    const finished = R.finishCombat(ended);
    expect(finished.screen).toBe('map'); expect(finished.reward).toBeNull(); expect(finished.gold).toBe(88);
    expect(finished.stats).toMatchObject({ enemiesKilled: 0, elitesKilled: 0, floorsCleared: 1 });
    expect(finished.relics).toEqual(start.relics); expect(finished.hp).toBe(start.hp);
    expect(R.finishCombat(finished)).toBe(finished);
    saveRun(finished); expect(R.resetCurrentNode(loadRun()!)).toEqual(start);
  });

  it('偷钱怪逃走后击败剩余小怪仍正常领奖，击杀数只计算被击败者', () => {
    const base = R.newRun('PARTIAL-ESCAPE');
    const node = base.map.nodes[base.map.startIds[0]]; node.row = 5; node.encounterId = 'looter_crow';
    const run = R.travelTo(base, node.id), cs = run.combat!;
    cs.enemies[0].hp = 0; cs.enemies[0].flags = { escaped: 1, deadHandled: 1, escapedGold: 12 };
    cs.enemies[1].hp = 0; cs.enemies[1].flags.deadHandled = 1; cs.outcome = 'won';
    const reward = R.finishCombat(run);
    expect(reward.screen).toBe('reward'); expect(reward.stats.enemiesKilled).toBe(1);
    expect(reward.reward!.cards).toHaveLength(3); expect(reward.reward!.gold).toBeGreaterThanOrEqual(15);
  });
});
