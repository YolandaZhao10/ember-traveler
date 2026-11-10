import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CARD_LIST, CARDS, cardAvailableTo } from '../../data/cards';
import { CHARACTER_LIST, CHARACTERS } from '../../data/characters';
import { archetypeName, cardTypeName, describeCard } from '../../engine/cards';
import type { Archetype, CardDef, CardInstance, CardType, CharacterId, Rarity } from '../../engine/types';
import { canUpgrade } from '../../engine/run';
import { closeOverlay } from '../store';
import { Card } from './Card';
import { Modal } from './Common';

type Group = CharacterId | 'all' | 'shared' | 'curse' | 'status';
const instance = (id: string, upgraded = false): CardInstance => ({ uid: `catalog-${id}`, defId: id, upgraded });
const ownerName = (card: CardDef) => card.owner ? CHARACTERS[card.owner].name : card.type === 'status' ? '状态牌' : card.type === 'curse' ? '诅咒牌' : '四角色通用';

export function CardCatalog({ initialCharacter }: { initialCharacter?: CharacterId }) {
  const [group, setGroup] = useState<Group>(initialCharacter ?? 'all');
  const [archetype, setArchetype] = useState<Archetype | 'all'>('all');
  const [type, setType] = useState<CardType | 'all'>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [includeShared, setIncludeShared] = useState(false);
  const [query, setQuery] = useState('');
  const [upgraded, setUpgraded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const listPosition = useRef({ scrollTop: 0, cardId: '' });
  const showDetail = (id: string) => {
    listPosition.current = { scrollTop: gridRef.current?.scrollTop ?? 0, cardId: id };
    setSelected(id);
  };
  useLayoutEffect(() => {
    // 详情与列表共用图鉴状态，返回时恢复原列表位置和键盘焦点。
    if (selected || !gridRef.current || !listPosition.current.cardId) return;
    gridRef.current.scrollTop = listPosition.current.scrollTop;
    gridRef.current.querySelector<HTMLButtonElement>(`[data-card-id="${listPosition.current.cardId}"]`)?.focus({ preventScroll: true });
  }, [selected]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      if (selected) setSelected(null);
      else closeOverlay();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selected]);

  const pool = CARD_LIST.filter((card) => {
    if (group === 'curse' || group === 'status') return card.type === group;
    if (card.type === 'curse' || card.type === 'status') return false;
    if (group === 'all') return true;
    return group === 'shared' ? !card.owner : cardAvailableTo(card, group) && (includeShared || card.owner === group);
  }).sort((a, b) => group === 'all' || group === 'shared' || group === 'curse' ? 0 : Number(!a.owner) - Number(!b.owner));
  const routes = [...new Set(pool.map((card) => card.archetype))];
  const cards = pool.filter((card) => (archetype === 'all' || card.archetype === archetype)
    && (rarity === 'all' || card.rarity === rarity)
    && (type === 'all' || card.type === type)
    && `${card.name} ${archetypeName(card.archetype)} ${describeCard(instance(card.id, upgraded && canUpgrade(instance(card.id))), null)}`.includes(query.trim()));
  const detail = selected ? CARDS[selected] : null;

  return (
    <Modal title="卡牌图鉴" onClose={selected ? () => setSelected(null) : closeOverlay} wide>
      {detail ? (
        <div className="catalog-detail">
          <button className="btn small ghost" onClick={() => setSelected(null)}>← 返回图鉴</button>
          <p className="subtitle">{ownerName(detail)} · {archetypeName(detail.archetype)} · {detail.name}</p>
          <div className="catalog-comparison">
            <div><h4>基础版</h4><Card card={instance(detail.id)} size="lg" showFlavor presentation /></div>
            {canUpgrade(instance(detail.id)) && <div><h4>升级版</h4><Card card={instance(detail.id, true)} size="lg" showFlavor presentation /></div>}
          </div>
          {!canUpgrade(instance(detail.id)) && <p className="subtitle">{detail.type === 'status' ? '状态牌仅存在于本场战斗' : '诅咒牌'}，无法升级，不会作为普通奖励出现。</p>}
        </div>
      ) : (
        <>
          <div className="catalog-tabs" aria-label="卡牌分类">
            {([{ id: 'all', name: '全部角色' }, ...CHARACTER_LIST, { id: 'shared', name: '通用牌' }, { id: 'curse', name: '诅咒牌' }, { id: 'status', name: '状态牌' }] as { id: Group; name: string }[]).map((item) => (
              <button key={item.id} className={`iconbtn ${group === item.id ? 'active' : ''}`} aria-pressed={group === item.id}
                onClick={() => { setGroup(item.id); setArchetype('all'); setType('all'); setRarity('all'); setQuery(''); }}>{item.name}</button>
            ))}
          </div>
          <div className="catalog-filters">
            <input aria-label="搜索卡牌" placeholder="搜索牌名、效果或流派" value={query} onChange={(e) => setQuery(e.target.value)} />
            {group !== 'curse' && group !== 'status' && <>
              <select aria-label="流派筛选" value={archetype} onChange={(e) => setArchetype(e.target.value as Archetype | 'all')}>
                <option value="all">全部流派</option>
                {routes.map((route) => <option key={route} value={route}>{archetypeName(route)}</option>)}
              </select>
              <select aria-label="类型筛选" value={type} onChange={(e) => setType(e.target.value as CardType | 'all')}>
                <option value="all">全部类型</option>
                {(['attack', 'skill', 'power'] as const).map((t) => <option key={t} value={t}>{cardTypeName(t)}</option>)}
              </select>
              <select aria-label="稀有度筛选" value={rarity} onChange={e => setRarity(e.target.value as Rarity | 'all')}>
                <option value="all">全部稀有度</option><option value="common">普通</option><option value="uncommon">罕见</option><option value="rare">稀有</option><option value="starter">初始</option>
              </select>
              {group !== 'all' && group !== 'shared' && <button className={`iconbtn ${includeShared ? 'active' : ''}`} aria-pressed={includeShared} onClick={() => setIncludeShared(!includeShared)}>包含通用牌</button>}
              <button className={`iconbtn ${upgraded ? 'active' : ''}`} aria-pressed={upgraded} onClick={() => setUpgraded(!upgraded)}>查看{upgraded ? '基础版' : '升级版'}</button>
            </>}
          </div>
          <p className="subtitle catalog-summary" aria-live="polite">共 {cards.length} 张 · {group === 'curse' || group === 'status' ? `${group === 'status' ? '状态牌' : '诅咒牌'} · 无法打出或升级，点击查看效果` : <>{upgraded ? '升级版' : '基础版'} · {group === 'all' || group === 'shared' ? '点击卡牌对比升级效果' : includeShared ? '专属牌与通用牌' : '仅该角色专属牌'}</>}</p>
          <div className="cardgrid catalog-grid" ref={gridRef}>
            {cards.map((card) => (
              <button className="catalog-entry" key={card.id} data-card-id={card.id} onClick={() => showDetail(card.id)} aria-label={`查看${card.name}`}>
                <span className="catalog-owner">{ownerName(card)}</span>
                <Card card={instance(card.id, upgraded && canUpgrade(instance(card.id)))} size="sm" presentation />
              </button>
            ))}
            {!cards.length && <p className="subtitle">没有匹配的卡牌，试试其他关键词或筛选。</p>}
          </div>
        </>
      )}
    </Modal>
  );
}
