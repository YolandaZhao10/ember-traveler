import { useId } from 'react';
import type { CardAim } from '../useCardAim';

export function TargetingArrow({ aim }: { aim: CardAim }) {
  const marker = useId().replace(/:/g, '');
  const { from, to } = aim;
  const control = { x: from.x + (to.x - from.x) * 0.3, y: from.y + (to.y - from.y) * 0.7 };
  const path = `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;
  return (
    <svg className={`targeting-arrow ${aim.ready ? 'locked' : ''}`} role="img" aria-label={`${aim.name}指向线${aim.ready ? '，目标已锁定' : ''}`}>
      <defs><marker id={marker} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1 L11 6 L1 11 L4 6 Z" fill="currentColor" /></marker></defs>
      <path className="aim-shadow" d={path} />
      <path className="aim-line" d={path} markerEnd={`url(#${marker})`} />
      <circle className="aim-origin" cx={from.x} cy={from.y} r="5" />
      {aim.ready && <g className="aim-reticle" transform={`translate(${to.x} ${to.y})`}>
        <circle r="25" /><path d="M-35 0 H-17 M17 0 H35 M0 -35 V-17 M0 17 V35" />
      </g>}
    </svg>
  );
}
