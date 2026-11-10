import { useState } from 'react';
import { useArt } from '../art';
import { EnemySprite, PlayerSprite } from '../sprites/Sprites';

type PlayerKind = 'traveler' | 'picker' | 'oathbound' | 'scholar';

/** 玩家形象：有位图用位图，否则 SVG */
export function PlayerArt({ kind, className }: { kind: PlayerKind; className?: string }) {
  const art = useArt('characters');
  const [broken, setBroken] = useState(false);
  const url = art[`char_${kind}`];
  if (url && !broken) return <img src={url} alt="" className={`${className ?? ''} sprite-img`} draggable={false} onError={() => setBroken(true)} />;
  return <PlayerSprite kind={kind} className={className} />;
}

/** 敌人形象 */
export function EnemyArt({ kind, className }: { kind: string; className?: string }) {
  const art = useArt('enemies');
  const [broken, setBroken] = useState(false);
  const url = art[`enemy_${kind}`];
  if (url && !broken) return <img src={url} alt="" data-sprite={kind} className={`${className ?? ''} sprite-img`} draggable={false} onError={() => setBroken(true)} />;
  return <EnemySprite kind={kind} className={className} />;
}

/** 场景背景层：绝对定位铺满父元素，叠加暗色渐变保证文字可读 */
export function Backdrop({ id, dim = 0.55, blur = false }: { id: string; dim?: number; blur?: boolean }) {
  const art = useArt('backgrounds');
  const url = art[id];
  if (!url) return null;
  return (
    <div className={`backdrop ${blur ? 'blur' : ''}`} aria-hidden="true">
      <img src={url} alt="" draggable={false} />
      <div className="backdrop-dim" style={{ opacity: dim }} />
    </div>
  );
}
