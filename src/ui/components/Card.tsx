import { archetypeName, cardTypeName, describeCard, rarityName, viewCard, type DescribeContext } from '../../engine/cards';
import type { CardInstance } from '../../engine/types';
import { CardArt } from './CardArt';

interface Props {
  card: CardInstance;
  size?: 'sm' | 'md' | 'lg';
  ctx?: DescribeContext | null;
  energy?: number;
  unplayable?: boolean;
  showFlavor?: boolean;
  presentation?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

/** 高亮描述中的数字 */
function renderDesc(text: string) {
  const parts = text.split(/(\d+)/g);
  return parts.map((p, i) => (/^\d+$/.test(p) ? <span key={i} className="hl">{p}</span> : <span key={i}>{p}</span>));
}

export function Card({ card, size = 'md', ctx = null, energy, unplayable, showFlavor, presentation, onClick }: Props) {
  const v = viewCard(card);
  const desc = describeCard(card, ctx);
  const notEnough = energy !== undefined && v.cost > energy;
  const cls = ['card', v.type, `rarity-${v.rarity}`, size, v.upgraded ? 'upgraded' : '', unplayable ? 'unplayable' : ''].join(' ');
  return (
    <div className={cls} onClick={onClick} role={presentation ? undefined : 'button'} aria-label={presentation ? undefined : `${v.name}，${cardTypeName(v.type)}，费用 ${v.cost}`}>
      {v.type !== 'curse' && <div className={`cost ${notEnough ? 'notenough' : ''}`}>{v.cost}</div>}
      <div className={`rarity-dot ${v.rarity}`} />
      <div className="chead">
        <span className="cname">{v.name}</span>
      </div>
      <div className="cart">
        <CardArt id={v.id} archetype={v.archetype} type={v.type} />
      </div>
      <div className="ctype">
        <span>{cardTypeName(v.type)}</span>
        <span className="arch">{archetypeName(v.archetype)}</span>
        <span>{rarityName(v.rarity)}</span>
      </div>
      <div className="cdesc">
        <div>{renderDesc(desc)}</div>
      </div>
      {showFlavor && v.flavor && <div className="cflavor">{v.flavor}</div>}
    </div>
  );
}
