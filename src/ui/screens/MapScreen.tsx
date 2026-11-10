import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { availableNodes, MAP_ROWS, nodeTypeName } from '../../engine/map';
import { plannedEncounter } from '../../engine/encounters';
import { previewRoute } from '../../engine/routePreview';
import { CHAPTERS } from '../../data/chapters';
import { ENEMIES } from '../../data/enemies';
import type { GameMap, MapNode, RunState } from '../../engine/types';
import { Backdrop } from '../components/Art';
import { MapInk, useMapInk } from '../components/MapInk';
import { mapNoteScope, MAX_MAP_STROKES, useMapNotes, writeMapNotes, type MapNotes } from '../mapNotes';
import { getState, travel, useGame } from '../store';

const ICONS: Record<MapNode['type'], string> = {
  combat: '⚔',
  elite: '☠',
  event: '?',
  shop: '$',
  rest: '♨',
  boss: '👑',
};
const ROW_HEIGHT = 60;
const TOP_SPACE = 72;
const BOTTOM_SPACE = 48;

export function MapScreen({ preview = false }: { preview?: boolean }) {
  const { run } = useGame();
  const wrap = useRef<HTMLDivElement>(null);
  const [selectedId, selectNode] = useState<string | null>(null);
  useEffect(() => selectNode(null), [run?.chapter, run?.currentNodeId]);
  const curRow = run?.currentNodeId ? run.map.nodes[run.currentNodeId].row : -1;
  const rows = run?.map.rows ?? MAP_ROWS;
  const H = TOP_SPACE + (rows - 1) * ROW_HEIGHT + BOTTOM_SPACE;
  const compact = rows <= 5;
  const W = compact ? 320 : 720;
  const noteScope = useMemo(() => run ? mapNoteScope(run) : null, [run?.recordId, run?.character, run?.seed, run?.chapter, run?.map]);
  const notes = useMapNotes(noteScope);
  const ink = useMapInk(noteScope, W, H);
  const rowY = (row: number) => TOP_SPACE + (rows - 1 - row) * ROW_HEIGHT;
  const focusY = rowY(Math.max(0, curRow));
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const locate = () => {
      const svg = el.querySelector('svg');
      if (!svg) return;
      // 使用实际 SVG 高度换算，当前位置靠近下方，为前面的路线留出视野。
      el.scrollTop = Math.max(0, focusY * svg.getBoundingClientRect().height / H - el.clientHeight * 0.8);
    };
    locate();
    const observer = new ResizeObserver(locate);
    observer.observe(el);
    return () => observer.disconnect();
  }, [focusY, H]);
  if (!run) return null;
  const map = run.map;
  const chapter = CHAPTERS[run.chapter];
  const avail = availableNodes(map, run.currentNodeId);
  const colW = W / (map.cols + 1);
  const pos = (n: MapNode) => ({ x: colW * (n.col + 1), y: rowY(n.row) });
  const nodes = Object.values(map.nodes);
  const visited = new Set(run.visited);
  const selected = selectedId ? map.nodes[selectedId] : undefined;
  const branch = selected ? previewRoute(map, selected.id) : null;
  // 已经无法到达的节点（在当前层以下或不在可达分支）
  const reachable = new Set<string>();
  const stack = run.currentNodeId ? [...map.nodes[run.currentNodeId].next] : [...map.startIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    stack.push(...(map.nodes[id]?.next ?? []));
  }
  return (
    <div className={`screen map-screen ${preview ? 'map-preview' : ''} ${compact ? 'compact-map' : ''}`}
      onKeyDownCapture={event => {
        if (ink.editing && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); ink.stop(); }
      }}>
      <div className="map-heading-row">
        <div className="chapter-map-heading"><b>{chapter.label} · {chapter.name}</b><span>第 {chapter.startFloor + 1}–{chapter.startFloor + map.rows} 层</span></div>
        <div className="map-note-tools" role="group" aria-label="个人路线标注">
          <button className={`btn small map-pen ${ink.drawing ? 'active' : ''}`} aria-pressed={ink.drawing} onClick={() => ink.selectTool('pen')} title="自由绘制绿色计划路线，仅作个人参考，不改变实际路线">{ink.drawing ? '完成标注' : '绿色标注'}</button>
          <button className={`btn small map-eraser ${ink.erasing ? 'active' : ''}`} aria-pressed={ink.erasing} onClick={() => ink.selectTool('eraser')} title="擦去绿色笔迹中碰到的部分，保留其余线段">{ink.erasing ? '完成擦除' : '橡皮擦'}</button>
          <button className="btn small ghost" disabled={!notes.length || !!ink.draft.length} onClick={() => noteScope && writeMapNotes(noteScope, notes.slice(0, -1))}>撤销一笔</button>
          <button className="btn small ghost" disabled={!notes.length || !!ink.draft.length} onClick={() => noteScope && writeMapNotes(noteScope, [])}>清空标注</button>
        </div>
      </div>
      <div className="map-legend">
        <span>
          <b>{ICONS.combat}</b>战斗
        </span>
        <span>
          <b>{ICONS.elite}</b><span title="比普通战斗更强，胜利后额外掉落遗物">精英</span>
        </span>
        <span>
          <b>{ICONS.event}</b><span title="可能遇到事件、普通战斗或商店，进入后揭晓">问号</span>
        </span>
        <span>
          <b>{ICONS.shop}</b>商店
        </span>
        <span>
          <b>{ICONS.rest}</b>营火
        </span>
        <span>
          <b>{ICONS.boss}</b>首领
        </span>
        <span style={{ marginLeft: 'auto' }}>种子 {run.seed}</span>
      </div>
      <div className="map-route-layout">
        <div className="map-stage">
          <Backdrop id={chapter.mapArt} dim={0.68} />
          <div className="map-wrap grain" ref={wrap}>
            <MapSvg map={map} W={W} H={H} pos={pos} nodes={nodes} visited={visited} reachable={reachable} avail={avail} currentId={run.currentNodeId} floorOffset={chapter.startFloor} selectedId={selectedId} branch={branch?.reachable} onSelect={selectNode} run={run} notes={notes} ink={ink} preview={preview} />
          </div>
        </div>
        <RoutePanel run={run} selected={selected} preview={preview} canEnter={!ink.editing && !!selected && avail.includes(selected.id) && run.screen === 'map'} reachable={!!selected && reachable.has(selected.id)} onSelect={selectNode} />
      </div>
      <p className="subtitle" style={{ textAlign: 'center', margin: 0 }}>
        {ink.erasing ? '点击或划过绿线，只擦掉碰到的部分 · 右键或 Esc 结束擦除。' : ink.drawing ? notes.length >= MAX_MAP_STROKES ? '标注已满，请使用橡皮擦、撤销或清空后继续。右键或 Esc 结束标注。' : '拖动绘制绿色计划路线 · 滚轮查看地图 · 右键或 Esc 结束标注。绿线仅作参考。' : preview ? `${run.currentNodeId ? `当前位置：第 ${run.floor + 1} 层` : '尚未出发'} · WASD / 方向键查看节点，预览不能进入。` : 'WASD / 方向键选择节点 · Enter 确认进入所选可前往节点 · Tab 切换按钮。'}
      </p>
    </div>
  );
}

const NODE_REWARDS: Record<MapNode['type'], string> = {
  combat: '胜利后获得金币，并从卡牌奖励中选一张；也可以跳过选牌。',
  elite: '胜利后获得金币、随机遗物，并从卡牌奖励中选一张。',
  boss: '胜利后获得金币、本角色稀有卡牌三选一，以及章节遗物三选一。',
  event: '可能遇到事件、普通战斗或商店，进入后揭晓。事件可能交换生命、金币、卡牌或获得问号专属遗物。',
  shop: '用金币购买卡牌、遗物或移除一张牌，商品进入商店后揭示。',
  rest: '休息、锻造、精简三选一。精简每章一次，会占用本次营火行动。',
};

export function RoutePanel({ run, selected, preview, canEnter, reachable, onSelect }: {
  run: RunState;
  selected: MapNode | undefined;
  preview: boolean;
  canEnter: boolean;
  reachable: boolean;
  onSelect: (id: string) => void;
}) {
  const encounter = selected && selected.type === 'boss' ? plannedEncounter(run, selected) : undefined;
  const route = selected ? previewRoute(run.map, selected.id) : null;
  const enemies = encounter ? [...new Set(encounter.enemies)].map((id) => ({ enemy: ENEMIES[id], count: encounter.enemies.filter((enemyId) => enemyId === id).length })) : [];
  const distance = (value: number | null) => value === null ? '后路没有' : value === 0 ? '本站' : `最快 ${value} 层后`;
  return <aside className="route-panel" aria-label="节点与后路预览">
    <div className="route-panel-content">
      {selected ? <>
        <div className="route-panel-heading"><span>第 {CHAPTERS[run.chapter].startFloor + selected.row + 1} 层</span><h3>{ICONS[selected.type]} {nodeTypeName(selected.type)}</h3></div>
        {enemies.length > 0 && <section className="route-enemies" aria-label="遭遇敌人">
          <h4>敌方阵容 · 共 {encounter!.enemies.length} 名</h4>
          {enemies.map(({ enemy, count }) => <div className="route-enemy" key={enemy.id}><b>{enemy.name}{count > 1 ? ` ×${count}` : ''}</b><p>{enemy.description}</p></div>)}
        </section>}
        <section className="route-reward"><h4>{selected.type === 'rest' || selected.type === 'shop' ? '可以做什么' : '收获'}</h4><p>{selected.type === 'boss' && run.chapter === 4 ? '击败无昼之主，完成本局旅程。终战后直接结算。' : NODE_REWARDS[selected.type]}</p></section>
        {route && <section className="route-outlook"><h4>沿此分支直到本章首领</h4><dl>
          <div><dt>营火</dt><dd>{distance(route.nearestRest)}</dd></div>
          <div><dt>已知商店</dt><dd>{distance(route.nearestShop)}</dd></div>
          <div><dt>精英</dt><dd>{route.elites.min === route.elites.max ? route.elites.min : `${route.elites.min}–${route.elites.max}`} 场</dd></div>
        </dl><p className="route-note">包含所选节点；亮线为可达后路。“最快”取最近支路，精英数量随分叉选择变化。</p></section>}
        {!reachable && selected.id !== run.currentNodeId && <p className="route-note">这条路线已无法前往，可查看节点资料。</p>}
      </> : <div className="route-panel-empty"><h3>规划这段旅程</h3><p>点选地图节点，查看收获、沿途补给与首领资料，再决定下一步。</p><p>衡量精英的风险与收益，为休息、锻造或精简牌组留出路线。</p></div>}
    </div>
    <div className="route-panel-actions">
      {selected && canEnter && !preview && <button className="btn primary" data-map-enter aria-keyshortcuts="Enter" onClick={() => travel(selected.id)}>确认前往 · {nodeTypeName(selected.type)} · Enter</button>}
      {selected && (!canEnter || preview) && <span className="route-note">{preview ? '查看模式 · 关闭地图继续当前进度' : selected.id === run.currentNodeId ? '当前位置' : reachable ? '前方节点预览，请先选择相邻节点' : '节点资料'}</span>}
      {selected?.id !== run.map.bossId && <button className="btn small ghost" onClick={() => onSelect(run.map.bossId)}>查看本章首领</button>}
    </div>
  </aside>;
}

function MapSvg(props: {
  map: GameMap;
  W: number;
  H: number;
  pos: (n: MapNode) => { x: number; y: number };
  nodes: MapNode[];
  visited: Set<string>;
  reachable: Set<string>;
  avail: string[];
  currentId: string | null;
  floorOffset: number;
  selectedId: string | null;
  branch: Set<string> | undefined;
  onSelect: (id: string) => void;
  run: RunState;
  notes: MapNotes;
  ink: ReturnType<typeof useMapInk>;
  preview: boolean;
}) {
  const { map, W, H, pos, nodes, visited, reachable, avail, currentId, floorOffset, selectedId, branch, onSelect, run, notes, ink, preview } = props;
  const glow = useId().replace(/:/g, '');
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const focusId = selectedId ?? avail[0] ?? currentId ?? nodes[0]?.id;
  const moveFocus = (node: MapNode, key: string) => {
    const row = key === 'ArrowUp' ? node.row + 1 : key === 'ArrowDown' ? node.row - 1 : node.row;
    const choices = nodes.filter((candidate) => candidate.row === row && (key === 'ArrowLeft' ? candidate.col < node.col : key === 'ArrowRight' ? candidate.col > node.col : true));
    const target = choices.sort((a, b) => Math.abs(a.col - node.col) - Math.abs(b.col - node.col) || a.col - b.col)[0];
    if (target) focusNode(target.id);
  };
  const focusNode = (id: string) => {
    onSelect(id);
    nodeRefs.current.get(id)?.focus({ preventScroll: true });
    nodeRefs.current.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || ink.editing) return;
      const current = getState();
      if (current.busy || current.showTitle || (preview ? current.overlay?.kind !== 'map' : current.overlay || current.run?.screen !== 'map')) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      const direction = ({ w: 'ArrowUp', a: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight' } as Record<string, string>)[event.key.toLowerCase()] ?? event.key;
      const moving = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(direction);
      if (!moving && event.key !== 'Enter') return;
      if (!moving && target?.closest('button, a') && !target.closest('[data-map-enter]')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.repeat) return;
      const focused = [...nodeRefs.current.entries()].find(([, element]) => element === document.activeElement)?.[0];
      const id = selectedId ?? focused ?? avail[0] ?? currentId;
      if (!id) return;
      if (!selectedId) { focusNode(id); return; }
      if (moving) moveFocus(map.nodes[id], direction);
      else if (!preview && avail.includes(id)) travel(id);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selectedId, avail, currentId, ink.editing, preview, map, nodes]);
  return (
    <svg className={`map-svg ${ink.editing ? 'editing' : ''} ${ink.drawing ? 'drawing' : ''} ${ink.erasing ? 'erasing' : ''}`} viewBox={`0 0 ${W} ${H}`} {...ink.handlers}
      onClickCapture={event => { if (ink.editing) { event.preventDefault(); event.stopPropagation(); } }}
      onContextMenu={event => { if (ink.editing) { event.preventDefault(); event.stopPropagation(); ink.stop(); } }}>
      <defs>
        <radialGradient id={glow}>
          <stop offset="0%" stopColor="#ff7a2a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ff7a2a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <MapInk strokes={notes} draft={ink.draft} W={W} H={H} />
      {nodes.map((n) =>
        n.next.map((nx) => {
          const a = pos(n);
          const b = pos(map.nodes[nx]);
          const lit = visited.has(n.id) && visited.has(nx);
          const next = n.id === currentId && avail.includes(nx);
          const inBranch = branch?.has(n.id) && branch.has(nx);
          const my = (a.y + b.y) / 2;
          return <path key={`${n.id}-${nx}`} className={`map-edge ${lit ? 'lit' : ''} ${next ? 'next' : ''} ${inBranch ? 'branch' : ''} ${branch && !inBranch && !lit ? 'outside-branch' : ''}`} d={`M${a.x} ${a.y} C${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`} />;
        }),
      )}
      {nodes.map((n) => {
        const p = pos(n);
        const isAvail = avail.includes(n.id);
        const isCur = n.id === currentId;
        const isVisited = visited.has(n.id);
        const dead = !isAvail && !isCur && !isVisited && !reachable.has(n.id);
        const encounter = n.type === 'boss' ? plannedEncounter(run, n) : undefined;
        const r = n.type === 'boss' ? 30 : 18;
        return (
          <g
            key={n.id}
            ref={(element) => { if (element) nodeRefs.current.set(n.id, element); else nodeRefs.current.delete(n.id); }}
            className={`map-node ${isAvail ? 'available' : ''} ${isCur ? 'current' : ''} ${isVisited ? 'visited' : ''} ${dead ? 'dead' : ''} ${selectedId === n.id ? 'selected' : ''} ${branch?.has(n.id) ? 'branch' : ''}`}
            transform={`translate(${p.x} ${p.y})`}
            onClick={() => onSelect(n.id)}
            onKeyDown={(event) => {
              if (event.key === ' ') { event.preventDefault(); onSelect(n.id); }
            }}
            role="button"
            tabIndex={n.id === focusId ? 0 : -1}
            aria-pressed={selectedId === n.id}
            aria-label={`${nodeTypeName(n.type)} 第 ${floorOffset + n.row + 1} 层${isCur ? ' · 当前位置' : isAvail ? ' · 可前往' : ''}${encounter ? ` · ${encounter.enemies.map((id) => ENEMIES[id].name).join('、')}` : ''} · 查看详情`}
          >
            {n.type === 'boss' && <circle r="60" fill={`url(#${glow})`} />}
            <circle className="node-ring" r={r} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={n.type === 'boss' ? 26 : 18} fill={n.type === 'elite' ? '#ff9d8a' : n.type === 'rest' ? '#ffb347' : n.type === 'shop' ? '#ffd27a' : '#e8d9b5'} fontWeight="700">
              {ICONS[n.type]}
            </text>
            {(isAvail || isCur) && (
              <text y={-r - 6} textAnchor="middle" fontSize="10" fill="#ffb347">
                {isCur ? '当前位置' : nodeTypeName(n.type)}
              </text>
            )}
            {isAvail && encounter && <text y={r + 12} textAnchor="middle" fontSize="9" fill="#dbcba8">{encounter.enemies.length} 名敌人</text>}
          </g>
        );
      })}
      {Array.from({ length: map.rows }).map((_, r) => (
        <text key={r} x={14} y={TOP_SPACE + (map.rows - 1 - r) * ROW_HEIGHT + 4} fontSize="12" fill="#b7a98a">
          {floorOffset + r + 1}
        </text>
      ))}
    </svg>
  );
}
