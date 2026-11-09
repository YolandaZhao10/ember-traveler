import { useEffect, useId, useRef } from 'react';
import { availableNodes, MAP_ROWS, nodeTypeName } from '../../engine/map';
import { CHAPTERS } from '../../data/chapters';
import type { GameMap, MapNode } from '../../engine/types';
import { Backdrop } from '../components/Art';
import { travel, useGame } from '../store';

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
  const curRow = run?.currentNodeId ? run.map.nodes[run.currentNodeId].row : -1;
  const rows = run?.map.rows ?? MAP_ROWS;
  const H = TOP_SPACE + (rows - 1) * ROW_HEIGHT + BOTTOM_SPACE;
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
  const compact = map.rows <= 5;
  const W = compact ? 320 : 720;
  const colW = W / (map.cols + 1);
  const pos = (n: MapNode) => ({ x: colW * (n.col + 1), y: rowY(n.row) });
  const nodes = Object.values(map.nodes);
  const visited = new Set(run.visited);
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
    <div className={`screen map-screen ${preview ? 'map-preview' : ''} ${compact ? 'compact-map' : ''}`}>
      <div className="chapter-map-heading"><b>{chapter.label} · {chapter.name}</b><span>第 {chapter.startFloor + 1}–{chapter.startFloor + map.rows} 层</span></div>
      <div className="map-legend">
        <span>
          <b>{ICONS.combat}</b>战斗
        </span>
        <span>
          <b>{ICONS.elite}</b><span title="比普通战斗更强，胜利后额外掉落遗物">精英</span>
        </span>
        <span>
          <b>{ICONS.event}</b>事件
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
      <div className="map-stage">
        <Backdrop id={chapter.mapArt} dim={0.68} />
        <div className="map-wrap grain" ref={wrap}>
          <MapSvg map={map} W={W} H={H} pos={pos} nodes={nodes} visited={visited} reachable={reachable} avail={avail} currentId={run.currentNodeId} preview={preview} floorOffset={chapter.startFloor} />
        </div>
      </div>
      <p className="subtitle" style={{ textAlign: 'center', margin: 0 }}>
        {preview ? `${run.currentNodeId ? `当前位置：第 ${run.floor + 1} 层` : '尚未出发'} · 仅查看路线，关闭后继续当前进度。` : run.currentNodeId ? '选择下一个发光的节点前进。' : '选择一个起点开始旅程。'}
      </p>
    </div>
  );
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
  preview: boolean;
  floorOffset: number;
}) {
  const { map, W, H, pos, nodes, visited, reachable, avail, currentId, preview, floorOffset } = props;
  const glow = useId().replace(/:/g, '');
  return (
    <svg className="map-svg" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <radialGradient id={glow}>
          <stop offset="0%" stopColor="#ff7a2a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ff7a2a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {nodes.map((n) =>
        n.next.map((nx) => {
          const a = pos(n);
          const b = pos(map.nodes[nx]);
          const lit = visited.has(n.id) && visited.has(nx);
          const next = n.id === currentId && avail.includes(nx);
          const my = (a.y + b.y) / 2;
          return <path key={`${n.id}-${nx}`} className={`map-edge ${lit ? 'lit' : ''} ${next ? 'next' : ''}`} d={`M${a.x} ${a.y} C${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`} />;
        }),
      )}
      {nodes.map((n) => {
        const p = pos(n);
        const isAvail = avail.includes(n.id);
        const isCur = n.id === currentId;
        const isVisited = visited.has(n.id);
        const dead = !isAvail && !isCur && !isVisited && !reachable.has(n.id);
        const r = n.type === 'boss' ? 30 : 18;
        return (
          <g
            key={n.id}
            className={`map-node ${isAvail ? 'available' : ''} ${isCur ? 'current' : ''} ${isVisited ? 'visited' : ''} ${dead ? 'dead' : ''}`}
            transform={`translate(${p.x} ${p.y})`}
            onClick={preview ? undefined : () => isAvail && travel(n.id)}
            role={isAvail && !preview ? 'button' : undefined}
            aria-label={`${nodeTypeName(n.type)} 第 ${floorOffset + n.row + 1} 层${isCur ? ' · 当前位置' : ''}`}
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
