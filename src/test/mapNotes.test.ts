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

it.each(['{', 'null', '{"version":99,"journey":"journey-a","pages":{}}'])('损坏或未知版本标注安全忽略：%s', async raw => {
  data.set(key, raw);
  const { readMapNotes, writeMapNotes } = await import('../ui/mapNotes');
  expect(readMapNotes(scope)).toEqual([]);
  writeMapNotes(scope, [stroke]);
  expect(readMapNotes(scope)).toEqual([stroke]);
});

it('无效坐标和过量笔迹不会导致无限渲染或破坏其他有效笔迹', async () => {
  data.set(key, JSON.stringify({ version: 1, journey: scope.journey, pages: {
    [scope.page]: [stroke, [{ x: -1, y: .2 }, { x: 0, y: 0 }], [{ x: null, y: .2 }, { x: 0, y: 0 }], Array(4097).fill(stroke[0])],
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

it('橡皮擦只裁掉接触部分，两端和其他笔迹不变，反复擦空白不重新连线', async () => {
  const { eraseMapStrokes } = await import('../ui/mapNotes');
  const lines = [.2, .5, .8].map(x => [{ x, y: .1 }, { x, y: .9 }]);
  const point = { x: .5, y: .5 }, size = { x: 1000, y: 1000 };
  const remaining = eraseMapStrokes(lines, point, point, size);
  expect(remaining).toHaveLength(3);
  expect(remaining[0]).toBe(lines[0]); expect(remaining[2]).toBe(lines[2]);
  expect(remaining[1][0]).toEqual(lines[1][0]); expect(remaining[1][3]).toEqual(lines[1][1]);
  expect(remaining[1][1].y).toBeCloseTo(.492); expect(remaining[1][2].y).toBeCloseTo(.508);
  expect(remaining[1][2].breakBefore).toBe(true);
  expect(eraseMapStrokes(remaining, point, point, size)).toBe(remaining);
  expect(lines[1]).toHaveLength(2);
});

it('拖动擦出一段空隙，快速跨过两条线也不会漏擦；不波及远处标注', async () => {
  const { eraseMapStrokes } = await import('../ui/mapNotes');
  const lines = [.2, .5, .8].map(x => [{ x, y: .1 }, { x, y: .9 }]);
  const remaining = eraseMapStrokes(lines, { x: .1, y: .5 }, { x: .6, y: .5 }, { x: 1000, y: 1000 });
  expect(remaining).toHaveLength(3);
  expect(remaining.slice(0, 2).every(s => s.some(p => p.breakBefore))).toBe(true);
  expect(remaining[2]).toBe(lines[2]);
  const along = eraseMapStrokes([lines[1]], { x: .5, y: .3 }, { x: .5, y: .7 }, { x: 1000, y: 1000 })[0];
  expect(along[1].y).toBeCloseTo(.292); expect(along[2].y).toBeCloseTo(.708);
  expect(along[2].breakBefore).toBe(true);
});

it('同一笔多次局部擦除只增加断点，不新增笔数或删除其余部分', async () => {
  const { eraseMapStrokes } = await import('../ui/mapNotes');
  let notes: MapNotes = [[{ x: .1, y: .5 }, { x: .9, y: .5 }]];
  for (const x of [.3, .5, .7]) notes = eraseMapStrokes(notes, { x, y: .5 }, { x, y: .5 }, { x: 1000, y: 1000 });
  expect(notes).toHaveLength(1);
  expect(notes[0].filter(p => p.breakBefore)).toHaveLength(3);
  expect(notes[0][0]).toEqual({ x: .1, y: .5 });
  expect(notes[0][notes[0].length - 1]).toEqual({ x: .9, y: .5 });
});

it('主地图与缩小预览均按屏幕像素命中，整笔都被覆盖时才完全删除', async () => {
  const { eraseMapStrokes } = await import('../ui/mapNotes');
  const dot = [{ x: .5, y: .5 }];
  for (const size of [{ x: 720, y: 1260 }, { x: 320, y: 560 }]) {
    const hit = { x: .5 + 7 / size.x, y: .5 };
    const miss = { x: .5 + 10 / size.x, y: .5 };
    expect(eraseMapStrokes([dot], hit, hit, size)).toEqual([]);
    expect(eraseMapStrokes([dot], miss, miss, size)).toEqual([dot]);
  }
  expect(eraseMapStrokes([[{ x: .499, y: .5 }, { x: .501, y: .5 }]], dot[0], dot[0], { x: 1000, y: 1000 })).toEqual([]);
});

it('旧笔迹可继续局部擦除，断点刷新后保留，不影响其他章和对局存档', async () => {
  data.set(key, JSON.stringify({ version: 1, journey: scope.journey, pages: { [scope.page]: [stroke] } }));
  const notes = await import('../ui/mapNotes');
  const run = newRun('ERASER'); saveRun(run);
  const saved = data.get('ember-traveler:save');
  const other = { ...scope, page: '2:another-map' };
  expect(notes.readMapNotes(scope)).toEqual([stroke]);
  notes.writeMapNotes(other, [stroke]);
  notes.eraseMapNotes(scope, stroke[1], stroke[1], { x: 720, y: 1260 });
  const result = notes.readMapNotes(scope);
  expect(result[0].some(p => p.breakBefore)).toBe(true);
  expect(JSON.parse(data.get(key)!).version).toBe(2);
  vi.resetModules();
  const restored = await import('../ui/mapNotes');
  expect(restored.readMapNotes(scope)).toEqual(result);
  expect(restored.readMapNotes(other)).toEqual([stroke]);
  expect(data.get('ember-traveler:save')).toBe(saved);
});
