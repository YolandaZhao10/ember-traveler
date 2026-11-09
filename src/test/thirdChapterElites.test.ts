import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTY_PRESETS, STANDARD_DIFFICULTY } from '../data/difficulty';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent, playCard, startPlayerTurn } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { generateMap } from '../engine/map';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CombatState, RunDifficulty } from '../engine/types';

function battle(ids: string[], floor = 51, settings: RunDifficulty = STANDARD_DIFFICULTY) {
  return createCombat('third-elite-test', ids, 'elite', [], 2000, 2000, [], makeRng('THIRD-ELITE', 'combat'), 100,
    'traveler', encounterDifficulty(floor, 'elite', settings)).state;
}

/** 在回合末状态递减后读意图，与本次真实结算逐敌对照。 */
function round(input: CombatState) {
  let cs = endPlayerTurn(input).state;
  const actions: { move: string | null; damage: number; attacks: boolean }[] = [];
  for (const id of cs.enemies.map(e => e.id)) {
    const enemy = cs.enemies.find(e => e.id === id)!;
    if (enemy.hp <= 0) continue;
    const intent = enemyIntent(cs, enemy);
    const attacks = intent?.kind === 'attack' || intent?.kind === 'attack_debuff';
    const hp = cs.player.hp;
    const result = enemyAct(cs, id);
    expect(hp - result.state.player.hp).toBe(attacks ? intent.amount * intent.times : 0);
    expect(enemyAct(result.state, id)).toEqual({ state: result.state, events: [] });
    actions.push({ move: enemy.moveId, damage: hp - result.state.player.hp, attacks });
    cs = result.state;
  }
  return { state: startPlayerTurn(cs).state, actions };
}

afterEach(() => vi.unstubAllGlobals());

describe('第三章精英攻防节奏', () => {
  it.each(DIFFICULTY_PRESETS.flatMap(p => [44, 51, 57].map(floor => ({ name: p.name, settings: p.settings, floor }))))(
    '$name 第$floor层的剑侍与巨像每轮三攻一整备，意图与真实损血一致', ({ floor, settings }) => {
      for (const id of ['moon_duelist', 'shattered_titan']) {
        let cs = battle([id], floor, settings);
        const hits: number[] = [];
        const moves: string[] = [];
        for (let turn = 0; turn < 8; turn++) {
          const result = round(cs); cs = result.state;
          hits.push(result.actions.filter(a => a.attacks).length);
          moves.push(result.actions[0].move!);
        }
        expect(hits.slice(0, 4).reduce((sum, n) => sum + n, 0)).toBe(3);
        expect(hits.slice(4).reduce((sum, n) => sum + n, 0)).toBe(3);
        expect(moves.slice(4)).toEqual(moves.slice(0, 4));
        expect(cs.enemies[0].block).toBeGreaterThanOrEqual(0);
        expect(cs.outcome).toBe('ongoing');
      }
    },
  );

  it('剑侍先轻斩再施加易伤，下一重斩吃到易伤；月步仍留空档但强化下轮双击', () => {
    let cs = battle(['moon_duelist']);
    const first = round(cs); cs = first.state;
    const mark = round(cs); cs = mark.state;
    expect(mark.actions[0].attacks).toBe(true);
    expect(mark.actions[0].damage).toBeLessThan(first.actions[0].damage);
    expect(cs.player.statuses.vulnerable).toBe(2);
    const clean = structuredClone(cs); delete clean.player.statuses.vulnerable;
    const markedCrescent = round(cs); cs = markedCrescent.state;
    const cleanCrescent = round(clean);
    expect(markedCrescent.actions[0].damage).toBe(Math.floor(cleanCrescent.actions[0].damage * 1.5));
    const step = round(cs); cs = step.state;
    expect(step.actions[0].damage).toBe(0);
    expect(cs.enemies[0].block).toBeGreaterThan(0);
    expect(cs.enemies[0].statuses.strength).toBe(2);
    expect(round(cs).actions[0].damage).toBeGreaterThan(first.actions[0].damage);
  });

  it('巨像首轮蓄盾不额外叠力，修补仍攻击并强化下轮，治疗受生命上限限制', () => {
    let cs = battle(['shattered_titan']);
    expect(cs.enemies[0].statuses.thorns).toBe(2);
    const rise = round(cs); cs = rise.state;
    expect(rise.actions[0].damage).toBe(0);
    expect(cs.enemies[0].statuses.strength ?? 0).toBe(0);
    const firstCrush = round(cs); cs = firstCrush.state;
    cs = round(cs).state;
    cs.enemies[0].hp -= 20;
    const injuredHp = cs.enemies[0].hp;
    const mend = round(cs); cs = mend.state;
    expect(mend.actions[0].damage).toBeGreaterThan(0);
    expect(cs.enemies[0].hp).toBe(injuredHp + 8);
    expect(cs.enemies[0].statuses.strength).toBe(1);
    cs = round(cs).state;
    const nextCrush = round(cs); cs = nextCrush.state;
    expect(nextCrush.actions[0].damage).toBeGreaterThan(firstCrush.actions[0].damage);
    cs = round(cs).state;
    cs.enemies[0].hp = cs.enemies[0].maxHp - 3;
    cs = round(cs).state;
    expect(cs.enemies[0].hp).toBe(cs.enemies[0].maxHp);
  });

  it('守望者有任一随从存活时保留原三人组节奏，独处后每三轮双击两次', () => {
    for (const ids of [['orrery_keeper', 'glass_wisp', 'glass_wisp'], ['orrery_keeper', 'glass_wisp']]) {
      let cs = battle(ids); const moves: string[] = [];
      for (let turn = 0; turn < 3; turn++) { const result = round(cs); moves.push(result.actions[0].move!); cs = result.state; }
      expect(moves).toEqual(['align', 'rod', 'mist']);
    }
    let solo = battle(['orrery_keeper']); const moves: string[] = [];
    for (let turn = 0; turn < 6; turn++) { const result = round(solo); moves.push(result.actions[0].move!); solo = result.state; }
    expect(moves).toEqual(['align', 'rod', 'rod', 'align', 'rod', 'rod']);
  });

  it('实际击杀最后随从不会更改已展示的迷雾；下一轮才改为单独战斗节奏', () => {
    let cs = battle(['orrery_keeper', 'glass_wisp', 'glass_wisp']);
    cs = round(round(cs).state).state;
    expect(cs.enemies[0].moveId).toBe('mist');
    cs.player.hand = [
      { uid: 'kill-a', defId: 'strike', upgraded: false },
      { uid: 'kill-b', defId: 'strike', upgraded: false },
    ];
    for (const [i, uid] of ['kill-a', 'kill-b'].entries()) {
      cs.enemies[i + 1].hp = 1; cs.enemies[i + 1].block = 0;
      cs = playCard(cs, uid, `e${i + 1}`).state;
      expect(cs.enemies[i + 1].hp).toBe(0);
      expect(cs.enemies[0].moveId).toBe('mist');
    }
    const pending = round(cs); cs = pending.state;
    expect(pending.actions[0].move).toBe('mist');
    expect(pending.actions[0].damage).toBe(0);
    const moves: string[] = [];
    for (let turn = 0; turn < 3; turn++) { const result = round(cs); moves.push(result.actions[0].move!); cs = result.state; }
    expect(moves).toEqual(['align', 'rod', 'rod']);
  });

  it('第三章精英真实进入节点、保存恢复和SL保持强化倍率与已行动标记，不重复叠力或回复', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    let run = R.newRun('THIRD-ELITE-SAVE');
    run.chapter = 3; run.map = generateMap(run.rng.map, 3);
    const node = Object.values(run.map.nodes).find(n => n.type === 'elite')!;
    expect(node).toBeDefined();
    const previous = Object.values(run.map.nodes).find(n => n.next.includes(node.id))!;
    run.currentNodeId = previous.id; run.visited = [previous.id];
    run.hp = run.maxHp = 2000; run.deck = []; run.relics = [];
    run.seenEncounters = ['sky_elite_duelist', 'sky_elite_keeper'];
    run = R.travelTo(run, node.id);
    expect(run.combat!.enemies[0].defId).toBe('shattered_titan');
    const original = structuredClone(run);
    for (let turn = 0; turn < 4; turn++) {
      run = R.combatEndTurn(run).run;
      run = R.combatEnemyAct(run, 'e0').run;
      saveRun(run);
      const loaded = loadRun()!;
      expect(loaded).toEqual(run);
      expect(loaded.combat!.difficulty).toEqual(original.combat!.difficulty);
      expect(R.combatEnemyAct(loaded, 'e0')).toEqual({ run: loaded, events: [] });
      run = R.combatStartTurn(loaded).run;
    }
    const reset = R.resetCurrentNode(run);
    expect(reset).toEqual(original);
    expect(R.combatEnemyAct(R.combatEndTurn(reset).run, 'e0')).toEqual(R.combatEnemyAct(R.combatEndTurn(original).run, 'e0'));
  });
});
