import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { STANDARD_DIFFICULTY } from '../data/difficulty';
import { viewCard } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, enemyDamageGuard, playCard, startPlayerTurn } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { generateMap } from '../engine/map';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CardInstance, CombatState, RunState } from '../engine/types';
import { impactCues } from '../ui/combatFx';

const card = (defId: string, uid = defId): CardInstance => ({ uid, defId, upgraded: false });

function battle(ids = ['strike'], enemies = ['nightless_lord'], relics: string[] = []): CombatState {
  const cs = createCombat('final-guard-test', enemies, 'boss', [], 10000, 10000, relics,
    makeRng('FINAL-GUARD', 'combat'), 100).state;
  cs.player.hand = ids.map((id, i) => card(id, `hand-${i}`));
  return cs;
}

function play(cs: CombatState, defId: string, targetId = 'e0') {
  const c = cs.player.hand.find(c => c.defId === defId)!;
  expect(c).toBeDefined();
  const result = playCard(cs, c.uid, viewCard(c).target === 'enemy' ? targetId : null);
  expect(result.state).not.toBe(cs);
  return result;
}

function nextRound(cs: CombatState) {
  cs = endPlayerTurn(cs).state;
  for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
  return startPlayerTurn(cs).state;
}

function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}

function finalRun(): RunState {
  const run = R.newRun('FINAL-GUARD-SAVE');
  run.chapter = 4;
  run.map = generateMap(run.rng.map, 4);
  run.currentNodeId = Object.values(run.map.nodes).find(n => n.row === 3)!.id;
  run.hp = run.maxHp = 10000;
  run.relics = [];
  run.deck = Array.from({ length: 5 }, (_, i) => card('strike', `deck-${i}`));
  return R.travelTo(run, run.map.bossId);
}

afterEach(() => vi.unstubAllGlobals());

describe('最终首领按回合共享生命损失上限', () => {
  it.each([50, 100, 200])('生命难度 %i%% 的上限按强化后的生命算，查询不改变状态', bossHealth => {
    const cs = createCombat('final_boss_lord', ['nightless_lord'], 'boss', [], 10000, 10000, [],
      makeRng('GUARD-DIFFICULTY', 'combat'), 1, 'traveler',
      encounterDifficulty(64, 'boss', { ...STANDARD_DIFFICULTY, bossHealth })).state;
    const before = structuredClone(cs);
    const limit = Math.ceil(cs.enemies[0].maxHp * .25);
    expect(enemyDamageGuard(cs.enemies[0])).toEqual({ limit, lost: 0, remaining: limit });
    expect(cs).toEqual(before);
  });

  it.each(['ember_burst', 'shield_shatter', 'detonate', 'thousand_cuts'])('%s 的高额爆发或多段伤害也不能绕过上限', id => {
    const cs = battle([id]);
    cs.player.ember = 9999;
    cs.player.block = 10000;
    cs.player.statuses.strength = 10000;
    cs.enemies[0].statuses.burn = 10000;
    const limit = enemyDamageGuard(cs.enemies[0])!.limit;
    const result = play(cs, id);
    expect(cs.enemies[0].hp - result.state.enemies[0].hp).toBe(limit);
    expect(enemyDamageGuard(result.state.enemies[0])).toEqual({ limit, lost: limit, remaining: 0 });
    expect(result.events.filter(e => e.type === 'damage' && e.targetId === 'e0')
      .reduce((sum, e) => sum + (e.type === 'damage' ? e.amount : 0), 0)).toBe(limit);
    expect(result.events.some(e => e.type === 'death')).toBe(false);
    expect(result.state.outcome).toBe('ongoing');
  });

  it('格挡先吸收伤害，只有真实扣血占额度；零伤害不计入', () => {
    let cs = battle(['strike', 'strike', 'strike']);
    const limit = enemyDamageGuard(cs.enemies[0])!.limit;
    cs.enemies[0].block = 8;
    const first = play(cs, 'strike'); cs = first.state;
    expect(enemyDamageGuard(cs.enemies[0])!.lost).toBe(0);
    expect(first.events.find(e => e.type === 'damage')).toMatchObject({ amount: 0, blocked: 6 });
    const second = play(cs, 'strike'); cs = second.state;
    expect(enemyDamageGuard(cs.enemies[0])!.lost).toBe(4);
    expect(second.events.find(e => e.type === 'damage')).toMatchObject({ amount: 4, blocked: 2 });
    cs.player.statuses.strength = limit;
    const third = play(cs, 'strike'); cs = third.state;
    expect(third.events.find(e => e.type === 'damage')).toMatchObject({ amount: limit - 4, blocked: 0 });
    expect(enemyDamageGuard(cs.enemies[0])!.remaining).toBe(0);
  });

  it('部分抵消仍显示真实命中，完全抵消显示屏障反馈而不是吞掉攻击动画', () => {
    let cs = battle(['strike', 'strike', 'strike']);
    const limit = enemyDamageGuard(cs.enemies[0])!.limit;
    cs.player.statuses.strength = limit - 9;
    cs = play(cs, 'strike').state;
    delete cs.player.statuses.strength;
    const partial = play(cs, 'strike'); cs = partial.state;
    expect(partial.events.find(e => e.type === 'damage')).toMatchObject({ amount: 3, blocked: 0, prevented: 3 });
    expect(impactCues(partial.events).map(cue => [cue.targetId, cue.kind])).toEqual([['e0', 'strike']]);
    const prevented = play(cs, 'strike');
    expect(prevented.events.find(e => e.type === 'damage')).toMatchObject({ amount: 0, blocked: 0, prevented: 6 });
    expect(impactCues(prevented.events).map(cue => [cue.targetId, cue.kind])).toEqual([['e0', 'guard']]);
    expect(prevented.state.log.some(line => line.includes('承伤已达上限'))).toBe(true);
  });

  it('额度足够时的低血过量击杀不伪造屏障抵消或承伤已满提示', () => {
    const cs = battle(['strike']);
    cs.enemies[0].hp = 3;
    cs.player.statuses.strength = 10000;
    const result = play(cs, 'strike');
    const hit = result.events.find(e => e.type === 'damage');
    expect(hit).toMatchObject({ amount: 3, blocked: 0 });
    expect(hit).not.toHaveProperty('prevented');
    expect(result.events.some(e => e.type === 'log' && e.text.includes('承伤已达上限'))).toBe(false);
    expect(impactCues(result.events).map(cue => [cue.targetId, cue.kind])).toEqual([['e0', 'strike']]);
    expect(result.state.enemies[0].hp).toBe(0);
    expect(enemyDamageGuard(result.state.enemies[0])!.lost).toBe(3);
    expect(result.state.outcome).toBe('won');
  });

  it('回响与镜像的多次重放共享同一额度，后续牌不会刷新额度', () => {
    let cs = battle(['twin_blades', 'strike']);
    cs.player.statuses.echo = 1;
    cs.player.statuses.mirror = 1;
    const limit = enemyDamageGuard(cs.enemies[0])!.limit;
    cs.player.statuses.strength = Math.ceil(limit / 2);
    const result = play(cs, 'twin_blades'); cs = result.state;
    const hits = result.events.filter(e => e.type === 'damage' && e.targetId === 'e0');
    expect(hits.length).toBeGreaterThanOrEqual(6);
    expect(hits.some(e => e.type === 'damage' && e.amount === 0)).toBe(true);
    expect(cs.enemies[0].maxHp - cs.enemies[0].hp).toBe(limit);
    const hp = cs.enemies[0].hp;
    cs = play(cs, 'strike').state;
    expect(cs.enemies[0].hp).toBe(hp);
    expect(enemyDamageGuard(cs.enemies[0])!.lost).toBe(limit);
  });

  it('玩家回合末遗物、敌方燃烧与荆棘共享本回合剩余额度，下一玩家回合才刷新', () => {
    let cs = battle(['strike'], ['nightless_lord'], ['anvil_shard']);
    const limit = enemyDamageGuard(cs.enemies[0])!.limit;
    cs.player.statuses.strength = limit - 13; // 打击实际扣 limit - 7。
    cs.player.statuses.thorns = 50;
    cs.player.block = 100;
    cs.enemies[0].statuses.burn = 1;
    cs = play(cs, 'strike').state;
    expect(enemyDamageGuard(cs.enemies[0])!.remaining).toBe(7);
    const ended = endPlayerTurn(cs); cs = ended.state;
    expect(enemyDamageGuard(cs.enemies[0])!.remaining).toBe(2);
    const acted = enemyAct(cs, 'e0'); cs = acted.state;
    expect(acted.events.filter(e => e.type === 'damage' && e.targetId === 'e0')).toEqual([
      expect.objectContaining({ amount: 1, source: 'burn' }),
      expect.objectContaining({ amount: 1, source: 'thorns' }),
    ]);
    expect(enemyDamageGuard(cs.enemies[0])!.remaining).toBe(0);
    expect(enemyAct(cs, 'e0')).toEqual({ state: cs, events: [] });
    cs = startPlayerTurn(cs).state;
    expect(enemyDamageGuard(cs.enemies[0])).toEqual({ limit, lost: 0, remaining: limit });
  });

  it('新回合在焰柱伤害前刷新，多个焰柱也共用新额度', () => {
    let cs = battle(['strike']);
    const limit = enemyDamageGuard(cs.enemies[0])!.limit;
    cs.player.statuses.strength = 10000;
    cs = play(cs, 'strike').state;
    cs.player.ember = 9999;
    cs.player.statuses.flameAura = 2;
    cs.player.powerInstances = [
      { status: 'flameAura', amount: 1, progress: 0 },
      { status: 'flameAura', amount: 1, progress: 0 },
    ];
    const hp = cs.enemies[0].hp;
    cs = nextRound(cs);
    expect(hp - cs.enemies[0].hp).toBe(limit);
    expect(cs.turn).toBe(2);
    expect(enemyDamageGuard(cs.enemies[0])).toEqual({ limit, lost: limit, remaining: 0 });
    expect(cs.enemies[0].phase).toBe(2);
    expect(cs.enemies[0].moveId).toBe('awaken');
  });

  it('消耗触发的火种传递也受限，消耗多张牌不会反复获得新额度', () => {
    let cs = battle(['burn_pages', 'defend']);
    const limit = enemyDamageGuard(cs.enemies[0])!.limit;
    cs.player.statuses.kindling = 10000;
    const result = play(cs, 'burn_pages'); cs = result.state;
    expect(cs.player.exhaust).toHaveLength(2);
    expect(cs.enemies[0].maxHp - cs.enemies[0].hp).toBe(limit);
    expect(enemyDamageGuard(cs.enemies[0])!.remaining).toBe(0);
    expect(result.events.filter(e => e.type === 'damage' && e.targetId === 'e0')).toEqual([
      expect.objectContaining({ amount: limit }), expect.objectContaining({ amount: 0 }),
    ]);
  });

  it('结构化遗物的追加伤害只能使用本回合剩余的生命额度', () => {
    let cs = battle(['strike', 'blood_rite'], ['nightless_lord'], ['pulse_bead']);
    const limit = enemyDamageGuard(cs.enemies[0])!.limit;
    cs.player.statuses.strength = limit - 7;
    cs = play(cs, 'strike').state;
    expect(enemyDamageGuard(cs.enemies[0])!.remaining).toBe(1);
    const result = play(cs, 'blood_rite'); cs = result.state;
    expect(result.events.filter(e => e.type === 'damage' && e.targetId === 'e0'))
      .toEqual([expect.objectContaining({ amount: 1, source: 'aura' })]);
    expect(enemyDamageGuard(cs.enemies[0])!.remaining).toBe(0);
  });

  it('不能重复开始玩家回合、跳过敌方行动或阶段切换来清空额度', () => {
    let cs = battle(['strike']);
    cs.player.statuses.strength = 10000;
    cs = play(cs, 'strike').state;
    expect(startPlayerTurn(cs)).toEqual({ state: cs, events: [] });
    cs = endPlayerTurn(cs).state;
    expect(startPlayerTurn(cs)).toEqual({ state: cs, events: [] });
    cs = startPlayerTurn(enemyAct(cs, 'e0').state).state;
    cs.player.hand = [card('strike', 'phase-hit')];
    cs = play(cs, 'strike').state;
    expect(cs.enemies[0].phase).toBe(2);
    expect(cs.enemies[0].moveId).toBe('awaken');
    const remaining = enemyDamageGuard(cs.enemies[0])!.remaining;
    expect(remaining).toBe(0);
    cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
    expect(cs.enemies[0].flags.awakened).toBe(1);
    expect(enemyDamageGuard(cs.enemies[0])!.remaining).toBe(remaining);
  });

  it('吸血只按上限内真正扣掉的生命治疗，额度耗尽时不治疗', () => {
    let cs = battle(['strike', 'leech_bite', 'leech_bite']);
    cs.player.hp = 5000;
    const limit = enemyDamageGuard(cs.enemies[0])!.limit;
    cs.player.statuses.strength = limit - 9;
    cs = play(cs, 'strike').state;
    expect(enemyDamageGuard(cs.enemies[0])!.remaining).toBe(3);
    cs = play(cs, 'leech_bite').state;
    expect(cs.player.hp).toBe(5003);
    cs = play(cs, 'leech_bite').state;
    expect(cs.player.hp).toBe(5003);
  });

  it('治疗不会返还已用额度，下一回合仍按最大生命而非剩余生命计算', () => {
    const original = ENEMIES.nightless_lord.moves;
    ENEMIES.nightless_lord.moves = [...original, {
      id: 'guard-test-heal', name: '测试治疗', intent: 'special', actions: [{ kind: 'heal', amount: 10 }],
    }];
    try {
      let cs = battle(['strike']);
      cs.player.statuses.strength = 10000;
      cs = play(cs, 'strike').state;
      const limit = enemyDamageGuard(cs.enemies[0])!.limit;
      const hp = cs.enemies[0].hp;
      cs.enemies[0].moveId = 'guard-test-heal';
      cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
      expect(cs.enemies[0].hp).toBe(hp + 10);
      expect(enemyDamageGuard(cs.enemies[0])).toEqual({ limit, lost: limit, remaining: 0 });
      cs = startPlayerTurn(cs).state;
      expect(enemyDamageGuard(cs.enemies[0])).toEqual({ limit, lost: 0, remaining: limit });
    } finally {
      ENEMIES.nightless_lord.moves = original;
    }
  });

  it('敌人主动失血同样占额度，并保留至少1生命的非致死规则', () => {
    const original = ENEMIES.nightless_lord.moves;
    ENEMIES.nightless_lord.moves = [...original, {
      id: 'guard-test-sacrifice', name: '测试自损', intent: 'special', actions: [{ kind: 'loseHp', amount: 10000 }],
    }];
    try {
      for (const lowHp of [false, true]) {
        let cs = battle([]);
        if (lowHp) {
          cs.enemies[0].hp = 2;
          cs.enemies[0].phase = 2;
          cs.enemies[0].flags.awakened = 1;
        }
        const hp = cs.enemies[0].hp;
        const limit = enemyDamageGuard(cs.enemies[0])!.limit;
        cs.enemies[0].moveId = 'guard-test-sacrifice';
        const result = enemyAct(endPlayerTurn(cs).state, 'e0'); cs = result.state;
        const lost = lowHp ? 1 : limit;
        expect(cs.enemies[0].hp).toBe(hp - lost);
        expect(cs.enemies[0].hp).toBeGreaterThanOrEqual(1);
        expect(enemyDamageGuard(cs.enemies[0])!.lost).toBe(lost);
        expect(result.events.find(e => e.type === 'damage' && e.targetId === 'e0')).toMatchObject({ amount: lost, source: 'enemy' });
        expect(cs.outcome).toBe('ongoing');
      }
    } finally {
      ENEMIES.nightless_lord.moves = original;
    }
  });

  it('同一遭遇的敌人独立计数，普通敌人和第四章精英没有承伤上限', () => {
    let cs = battle(['strike', 'strike', 'strike'], ['nightless_lord', 'nightless_lord', 'last_warden']);
    const limit = enemyDamageGuard(cs.enemies[0])!.limit;
    cs.player.statuses.strength = 10000;
    cs = play(cs, 'strike', 'e0').state;
    expect(enemyDamageGuard(cs.enemies[0])!.remaining).toBe(0);
    expect(enemyDamageGuard(cs.enemies[1])!.remaining).toBe(limit);
    cs = play(cs, 'strike', 'e1').state;
    expect(enemyDamageGuard(cs.enemies[1])!.remaining).toBe(0);
    expect(enemyDamageGuard(cs.enemies[2])).toBeNull();
    cs = play(cs, 'strike', 'e2').state;
    expect(cs.enemies[2].hp).toBe(0);
    expect(cs.enemies[0].hp).toBeGreaterThan(0);
    expect(enemyDamageGuard(battle([], ['tomb_puppet']).enemies[0])).toBeNull();
  });
});

describe('最终首领承伤上限的保存、迁移和通关', () => {
  it('保存玩家与敌方行动中的额度，SL回到开局且刷新不能返还额度或重复行动', () => {
    storage();
    const original = finalRun();
    let run = structuredClone(original);
    run.combat!.player.statuses.strength = 10000;
    run = R.combatPlayCard(run, run.combat!.player.hand[0].uid, 'e0').run;
    expect(enemyDamageGuard(run.combat!.enemies[0])!.remaining).toBe(0);
    saveRun(run);
    run = loadRun()!;
    expect(enemyDamageGuard(run.combat!.enemies[0])!.remaining).toBe(0);
    run = R.combatEndTurn(run).run;
    run = R.combatEnemyAct(run, 'e0').run;
    saveRun(run);
    const restored = loadRun()!;
    expect(restored).toEqual(run);
    expect(R.combatEnemyAct(restored, 'e0')).toEqual({ run: restored, events: [] });
    expect(enemyDamageGuard(restored.combat!.enemies[0])!.remaining).toBe(0);
    expect(R.resetCurrentNode(restored)).toEqual(original);
    expect(enemyDamageGuard(R.combatStartTurn(restored).run.combat!.enemies[0])!.lost).toBe(0);
  });

  it.each([0, 6, 800])('v14存档和回退点按原生命迁移，已损失 %i 不重算血量或多给额度', lost => {
    const values = storage();
    const old = finalRun();
    old.version = 14;
    old.checkpoint!.version = 14;
    for (const snapshot of [old, old.checkpoint!]) {
      const e = snapshot.combat!.enemies[0];
      e.hp = 900 - lost;
      e.maxHp = 900;
      delete e.damageGuard;
    }
    const rng = structuredClone(old.rng);
    values.set('ember-traveler:save', JSON.stringify(old));
    const loaded = loadRun()!;
    expect(loaded.version).toBe(R.SAVE_VERSION);
    expect(loaded.checkpoint!.version).toBe(R.SAVE_VERSION);
    expect(loaded.rng).toEqual(rng);
    for (const snapshot of [loaded, loaded.checkpoint!]) {
      const e = snapshot.combat!.enemies[0];
      expect(e.maxHp).toBe(900);
      expect(e.hp).toBe(900 - lost);
      expect(enemyDamageGuard(e)).toEqual({ limit: 225, lost: Math.min(225, lost), remaining: 225 - Math.min(225, lost) });
    }
    saveRun(loaded);
    expect(loadRun()).toEqual(loaded);
    expect(R.resetCurrentNode(loaded).combat).toEqual(loaded.checkpoint!.combat);
  });

  it('连续四轮真实攻击可以击败首领，最终仍只给金币直接通关，不多发牌或遗物', () => {
    storage();
    let run = finalRun();
    const before = structuredClone(run);
    run.combat!.player.statuses.strength = 10000;
    const limit = enemyDamageGuard(run.combat!.enemies[0])!.limit;
    const maxHp = run.combat!.enemies[0].maxHp;
    for (let turn = 1; turn <= 4; turn++) {
      const strike = run.combat!.player.hand.find(c => c.defId === 'strike')!;
      expect(strike).toBeDefined();
      run = R.combatPlayCard(run, strike.uid, 'e0').run;
      expect(run.combat!.enemies[0].hp).toBe(Math.max(0, maxHp - limit * turn));
      expect(enemyDamageGuard(run.combat!.enemies[0])!.lost).toBe(Math.min(limit, maxHp - limit * (turn - 1)));
      if (turn < 4) {
        expect(run.combat!.outcome).toBe('ongoing');
        run = R.combatEndTurn(run).run;
        run = R.combatEnemyAct(run, 'e0').run;
        run = R.combatStartTurn(run).run;
      }
    }
    expect(run.combat!.outcome).toBe('won');
    run = R.finishCombat(run);
    expect(run.screen).toBe('victory');
    expect(run.gold).toBe(before.gold + 75);
    expect(run.reward).toBeNull();
    expect(run.deck).toEqual(before.deck);
    expect(run.relics).toEqual(before.relics);
    expect(R.finishCombat(run)).toBe(run);
    saveRun(run);
    expect(loadRun()).toEqual(run);
  });
});
