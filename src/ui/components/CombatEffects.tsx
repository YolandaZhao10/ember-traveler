import type { CSSProperties } from 'react';
import type { ImpactItem } from '../combatFx';

/** 挥击跟随攻击者，命中与格挡留在实际受击者身上。 */
export function SwingArc() {
  return (
    <svg className="swing-arc" viewBox="0 0 200 200" aria-hidden="true">
      <path className="swing-trail" d="M25 168 Q190 142 149 22" pathLength="1" />
      <path className="swing-core" d="M25 168 Q190 142 149 22" pathLength="1" />
    </svg>
  );
}

export function ImpactEffects({ impacts }: { impacts: ImpactItem[] }) {
  return (
    <div className="impact-layer" aria-hidden="true">
      {impacts.map((hit) => (
        <svg key={hit.id} className={`impact impact-${hit.kind} from-${hit.direction} ${hit.heavy ? 'heavy' : ''}`}
          data-target={hit.targetId} viewBox="0 0 200 200" style={{ '--impact-delay': `${hit.delayMs}ms` } as CSSProperties}>
          <g className="impact-shape">
            <circle className="impact-halo" cx="100" cy="100" r="32" />
            {hit.kind === 'strike' ? (
              <>
                <path className="hit-slash" d="M33 155 Q100 110 168 38 Q132 113 40 163 Z" />
                <path className="hit-core" d="M39 157 L163 44" />
              </>
            ) : hit.kind === 'guard' ? (
              <path className="guard-shield" d="M100 47 L143 65 L137 110 Q127 141 100 157 Q73 141 63 110 L57 65 Z" />
            ) : (
              <circle className="hit-ring" cx="100" cy="100" r="44" />
            )}
            {Array.from({ length: 8 }, (_, i) => (
              <path key={i} className="hit-spark" d="M100 54 L100 34" transform={`rotate(${i * 45 + hit.id % 19} 100 100)`} />
            ))}
          </g>
        </svg>
      ))}
    </div>
  );
}
