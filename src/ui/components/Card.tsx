import { archetypeName, cardTypeName, describeCard, rarityName, viewCard, type DescribeContext } from '../../engine/cards';
import type { CardInstance } from '../../engine/types';
import { CardArt } from './CardArt';
import { useCardStyle } from '../art';

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
  const cardStyle = useCardStyle();
  const v = viewCard(card);
  const desc = describeCard(card, ctx);
  const notEnough = energy !== undefined && v.cost > energy;
  const cls = ['card', v.type, `rarity-${v.rarity}`, size, desc.length > (size === 'sm' ? 35 : 70) ? 'long-description' : '', v.upgraded ? 'upgraded' : '', unplayable ? 'unplayable' : ''].join(' ');
  return (
    <div className={`${cls} card-style-${cardStyle}`} onClick={onClick} role={presentation ? undefined : 'button'} aria-label={presentation ? undefined : `${v.name}，${cardTypeName(v.type)}，${v.cost < 0 ? '无法打出' : `费用 ${v.cost}`}`}>
      {cardStyle === 'ornate' && <svg className="card-filigree" viewBox="0 0 150 212" preserveAspectRatio="none" aria-hidden="true">
        <path d="M34 5H130Q145 5 145 20V192Q145 207 130 207H20Q5 207 5 192V38 M37 9H129Q141 9 141 21V191Q141 203 129 203H21Q9 203 9 191V40" />
        <path d="M111 5Q130 8 138 25M118 5Q132 13 145 15M5 173Q9 192 27 207M5 183Q17 190 17 207M123 207Q141 192 145 173M133 207Q133 190 145 183" />
        <path d="M67 207L75 198L83 207L75 211Z M140 34L145 26L149 34L145 42Z" />
      </svg>}
      {v.cost >= 0 && <div className={`cost ${notEnough ? 'notenough' : ''}`}>{v.cost}</div>}
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
