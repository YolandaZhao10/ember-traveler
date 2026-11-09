import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { newRun } from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { MapNotes, MapStroke } from '../ui/mapNotes';

const key = 'ember-traveler:map-notes';
const scope = { journey: 'journey-a', page: '1:map-a' };
const stroke = [{ x: .2, y: .9 }, { x: .4, y: .8 }, { x: .6, y: .6 }];
let data: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

it('标注、撤销和清空独立保存，不改对局、回退点或随机流', async () => {
  const notes = await import('../ui/mapNotes');
  const run = newRun('MAP-NOTES');
  run.recordId = 'journey-a';
  saveRun(run);
  const before = JSON.stringify(run), saved = data.get('ember-traveler:save');
  const page = notes.mapNoteScope(run);
  notes.writeMapNotes(page, [stroke, [...stroke].reverse()]);
  notes.writeMapNotes(page, notes.readMapNotes(page).slice(0, -1));
  expect(notes.readMapNotes(page)).toEqual([stroke]);
  vi.resetModules();
  const reloaded = await import('../ui/mapNotes');
  expect(reloaded.readMapNotes(page)).toEqual([stroke]);
  reloaded.writeMapNotes(page, []);
  expect(reloaded.readMapNotes(page)).toEqual([]);
  expect(JSON.stringify(run)).toBe(before);
  expect(data.get('ember-traveler:save')).toBe(saved);
  expect(loadRun()).toEqual(run);
});

it('同局进度变化仍用同一页；新局、章节和地图拓扑变化不会串线', async () => {
  const { mapNoteScope, writeMapNotes, readMapNotes } = await import('../ui/mapNotes');
  const run = newRun('SAME-SEED'); run.recordId = 'run-one';
  const original = mapNoteScope(run);
  writeMapNotes(original, [stroke]);
  run.currentNodeId = run.map.startIds[0]; run.visited.push(run.currentNodeId);
  expect(mapNoteScope(run)).toEqual(original);
  run.recordId = 'run-two';
  expect(readMapNotes(mapNoteScope(run))).toEqual([]);
  run.recordId = 'run-one'; run.chapter = 2;
  expect(readMapNotes(mapNoteScope(run))).toEqual([]);
  run.chapter = 1; run.map.nodes[run.map.startIds[0]].next = [];
  expect(readMapNotes(mapNoteScope(run))).toEqual([]);
  expect(readMapNotes(original)).toEqual([stroke]);
});

it('四章分别保留，修改一章不清空其他章，新局不继承旧笔迹', async () => {
  const { writeMapNotes, readMapNotes } = await import('../ui/mapNotes');
  for (let chapter = 1; chapter <= 4; chapter++) writeMapNotes({ ...scope, page: String(chapter) }, [stroke]);
  writeMapNotes({ ...scope, page: '2' }, []);
  for (const chapter of [1, 3, 4]) expect(readMapNotes({ ...scope, page: String(chapter) })).toEqual([stroke]);
  expect(readMapNotes({ ...scope, page: '2' })).toEqual([]);
  writeMapNotes({ ...scope, journey: 'new-run' }, [stroke]);
  expect(readMapNotes({ ...scope, page: '1' })).toEqual([]);
});

it.each(['{', 'null', '{"version":2,"journey":"journey-a","pages":{}}'])('损坏或未知版本标注安全忽略：%s', async raw => {
  data.set(key, raw);
  const { readMapNotes, writeMapNotes } = await import('../ui/mapNotes');
  expect(readMapNotes(scope)).toEqual([]);
  writeMapNotes(scope, [stroke]);
  expect(readMapNotes(scope)).toEqual([stroke]);
});

it('无效坐标和过量笔迹不会导致无限渲染或破坏其他有效笔迹', async () => {
  data.set(key, JSON.stringify({ version: 1, journey: scope.journey, pages: {
    [scope.page]: [stroke, [{ x: -1, y: .2 }, { x: 0, y: 0 }], [{ x: null, y: .2 }, { x: 0, y: 0 }], Array(513).fill(stroke[0])],
  } }));
  const { readMapNotes, writeMapNotes, MAX_MAP_STROKES } = await import('../ui/mapNotes');
  expect(readMapNotes(scope)).toEqual([stroke]);
  writeMapNotes(scope, [[{ x: NaN, y: 0 }, { x: .5, y: .5 }], ...Array(500).fill(stroke)] as MapNotes);
  expect(readMapNotes(scope).length).toBeLessThanOrEqual(MAX_MAP_STROKES);
  expect(readMapNotes(scope).every(s => s.every(p => Number.isFinite(p.x)))).toBe(true);
});

it('长线持续采样并保留起点和终点，出界点夹在地图边缘', async () => {
  const { appendMapPoint } = await import('../ui/mapNotes');
  let line: MapStroke = [];
  for (let i = 0; i <= 2500; i++) line = appendMapPoint(line, { x: i % 2, y: i / 2500 });
  expect(line.length).toBeLessThanOrEqual(512);
  expect(line[0]).toEqual({ x: 0, y: 0 });
  expect(line[line.length - 1]).toEqual({ x: 0, y: 1 });
  expect(appendMapPoint([], { x: -4, y: 8 })).toEqual([{ x: 0, y: 1 }]);
  expect(appendMapPoint(line, { x: Infinity, y: 0 })).toBe(line);
});

it('浏览器禁止本地存储时仍可在当前会话画线和清空', async () => {
  vi.stubGlobal('localStorage', { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  const { readMapNotes, writeMapNotes } = await import('../ui/mapNotes');
  expect(readMapNotes(scope)).toEqual([]);
  writeMapNotes(scope, [stroke]);
  expect(readMapNotes(scope)).toEqual([stroke]);
  writeMapNotes(scope, []);
  expect(readMapNotes(scope)).toEqual([]);
});

it('快速连续落笔逐笔追加，点状标记与中断前的短笔画也会保留', async () => {
  const { commitMapStroke, readMapNotes } = await import('../ui/mapNotes');
  const expected: MapStroke[] = [];
  for (let i = 0; i < 80; i++) {
    const line = i % 2 ? stroke : [{ x: i / 100, y: .5 }];
    expected.push(line); commitMapStroke(scope, line);
  }
  expect(readMapNotes(scope)).toEqual(expected);
  commitMapStroke(scope, []);
  expect(readMapNotes(scope)).toEqual(expected);
  vi.resetModules();
  expect((await import('../ui/mapNotes')).readMapNotes(scope)).toEqual(expected);
});
