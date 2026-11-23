import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../data/enemies';
import { generateMap } from '../engine/map';
import * as R from '../engine/run';
import { makeRng, pick } from '../engine/rng';
import type { ChapterId, RunState } from '../engine/types';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const elites = (chapter: ChapterId) => ENCOUNTERS.filter(e => e.tier === 'elite' && (e.chapter ?? 1) === chapter).map(e => e.id);

/** 站到某个精英节点的上一站，把这个精英节点预排成 planned，带着 seen 记录走进去。 */
function enterElite(seed: string, chapter: ChapterId, planned: string, seen: string[]): RunState {
  const run = R.newRun(seed);
  if (chapter !== 1) { run.chapter = chapter; run.map = generateMap(run.rng.map, chapter); }
  const node = Object.values(run.map.nodes).find(n => n.type === 'elite')!;
  const previous = Object.values(run.map.nodes).find(n => n.next.includes(node.id))!;
  run.currentNodeId = previous.id; run.visited = [previous.id];
  node.encounterId = planned;
  run.seenEncounters = seen;
  return R.travelTo(run, node.id);
}

describe('精英尽量不重复', () => {
  it('预排的精英没打过时照常出现', () => {
    for (const chapter of [1, 2, 3] as ChapterId[]) for (const id of elites(chapter)) {
      expect(enterElite('ELITE-KEEP', chapter, id, elites(chapter).filter(e => e !== id)).combat!.encounterId).toBe(id);
    }
  });

  it('预排的精英已经打过时，换成本章还没打过的一组', () => {
    for (const chapter of [1, 2, 3] as ChapterId[]) for (let i = 0; i < 20; i++) {
      const pool = elites(chapter);
      const planned = pool[i % pool.length];
      const run = enterElite(`ELITE-VARY-${i}`, chapter, planned, [planned]);
      const actual = run.combat!.encounterId;
      expect(pool).toContain(actual);
      expect(actual).not.toBe(planned);
      expect(run.map.nodes[run.currentNodeId!].encounterId).toBe(actual);
      expect(run.seenEncounters).toEqual([planned, actual]);
    }
  });

  it('只剩一组没打过时必定是那一组', () => {
    for (const chapter of [1, 2, 3] as ChapterId[]) {
      const pool = elites(chapter);
      const left = pool[pool.length - 1];
      expect(enterElite('ELITE-LAST', chapter, pool[0], pool.slice(0, -1)).combat!.encounterId).toBe(left);
    }
  });

  it('本章精英都打过后，换成最久没遇到的一组', () => {
    const [a, b, c] = elites(2);
    expect(enterElite('ELITE-OLDEST', 2, c, [a, b, c]).combat!.encounterId).toBe(a);
    expect(enterElite('ELITE-OLDEST', 2, c, [a, b, c, a]).combat!.encounterId).toBe(b);
    expect(enterElite('ELITE-OLDEST', 2, a, [b, c, a]).combat!.encounterId).toBe(b);
  });

  it('同一存档重复进入结果相同，且不推进战斗随机流', () => {
    const [a, b] = elites(1);
    const varied = enterElite('ELITE-STABLE', 1, a, [a]);
    expect(enterElite('ELITE-STABLE', 1, a, [a]).combat!.encounterId).toBe(varied.combat!.encounterId);
    // 直接预排成同一组、没有打过记录时，战斗开局应当完全一致。
    const plain = enterElite('ELITE-STABLE', 1, varied.combat!.encounterId, []);
    expect(copy(varied.combat)).toEqual(copy(plain.combat));
    expect(b).toBeDefined();
  });

  it('普通战同一敌组本局只出现一次：预排的打过了就换成当前楼层可用、没打过的一组', () => {
    const run = R.newRun('NORMAL-VARY');
    const id = run.map.startIds[0];
    const planned = run.map.nodes[id].encounterId!;
    run.seenEncounters = [planned];
    const entered = R.travelTo(run, id);
    const actual = ENCOUNTERS.find(e => e.id === entered.combat!.encounterId)!;
    expect(actual.id).not.toBe(planned);
    expect(actual.tier).toBe('normal');
    expect(actual.minFloor ?? 0).toBe(0);
    expect(R.travelTo(run, id).combat!.encounterId).toBe(actual.id);
  });

  it('首领不换：打过记录里有它也照常出现', () => {
    const run = R.newRun('BOSS-KEEP');
    const boss = Object.values(run.map.nodes).find(n => n.type === 'boss')!;
    const previous = Object.values(run.map.nodes).find(n => n.next.includes(boss.id))!;
    run.currentNodeId = previous.id; run.visited = [previous.id];
    const planned = boss.encounterId!;
    run.seenEncounters = [planned];
    expect(R.travelTo(run, boss.id).combat!.encounterId).toBe(planned);
  });

  it.each([1, 2, 3] as ChapterId[])('第%s章随机走完整条路线，普通战不出现重复敌组，精英在组数用完前不重复', chapter => {
    for (let seed = 0; seed < 60; seed++) {
      let run = R.newRun(`PATH-${chapter}-${seed}`);
      if (chapter !== 1) { run.chapter = chapter; run.map = generateMap(run.rng.map, chapter); }
      run.hp = run.maxHp = 9999;
      const rng = makeRng(`PATH-${chapter}-${seed}`, 'walk');
      const fought: string[] = [];
      let options = run.map.startIds;
      while (options.length) {
        const id = pick(rng, options);
        const node = run.map.nodes[id];
        if (node.type === 'combat' || node.type === 'elite') {
          const entered = R.travelTo(run, id);
          fought.push(entered.combat!.encounterId);
          run = { ...entered, combat: null, screen: 'map' } as typeof run;
        } else {
          run.currentNodeId = id; run.visited = [...run.visited, id];
        }
        options = node.next;
      }
      expect(fought.length).toBeGreaterThan(2);
      const tierOf = (id: string) => ENCOUNTERS.find(e => e.id === id)!.tier;
      const normals = fought.filter(id => tierOf(id) === 'normal'), eliteFights = fought.filter(id => tierOf(id) === 'elite');
      expect(new Set(normals).size, normals.join(',')).toBe(normals.length);
      // 精英组数有限（第二、三章各 3 组），路线上的精英多于组数时才会重复。
      expect(new Set(eliteFights).size, eliteFights.join(',')).toBe(Math.min(eliteFights.length, elites(chapter).length));
    }
  });
});
