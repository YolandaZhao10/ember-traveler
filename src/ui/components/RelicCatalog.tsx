import { useState } from 'react';
import { RELIC_LIST, relicAvailableTo } from '../../data/relics';
import { CHARACTER_LIST, CHARACTERS } from '../../data/characters';
import { CHAPTERS, CHAPTER_IDS } from '../../data/chapters';
import type { CharacterId, RelicDef } from '../../engine/types';
import { closeOverlay } from '../store';
import { Modal } from './Common';

const labels = { common: '普通', uncommon: '罕见', rare: '稀有', starter: '初始' };
export function RelicCatalog() {
  const [rarity, setRarity] = useState<RelicDef['rarity'] | 'all'>('all');
  const [character, setCharacter] = useState<CharacterId | 'all'>('all');
  const [exclusive, setExclusive] = useState(false);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'all' | 'event' | 'shop'>('all');
  const [chapter, setChapter] = useState<'all' | `${keyof typeof CHAPTERS}`>('all');
  const relics = RELIC_LIST.filter(r => (rarity === 'all' || r.rarity === rarity)
    && (!exclusive || !!r.owner)
    && (source === 'all' || r.source === source)
    && (chapter === 'all' || r.chapter === Number(chapter))
    && (character === 'all' || (r.rarity === 'starter' ? r.id === CHARACTERS[character].starterRelic : relicAvailableTo(r, character)))
    && `${r.name}${r.description}${r.owner ? CHARACTERS[r.owner].name : ''}`.includes(query.trim()));
  const regular = RELIC_LIST.filter(r => r.rarity !== 'starter' && !r.owner && !r.chapter && !r.source).length;
  const unique = RELIC_LIST.filter(r => r.owner).length;
  const starters = RELIC_LIST.filter(r => r.rarity === 'starter').length;
  return <Modal title="遗物图鉴" onClose={closeOverlay} wide>
    <div className="catalog-tabs">
      <button className="iconbtn" aria-pressed={rarity === 'all'} onClick={() => setRarity('all')}>全部遗物</button>
      {(['common', 'uncommon', 'rare', 'starter'] as const).map(r => <button className="iconbtn" aria-pressed={rarity === r} key={r} onClick={() => setRarity(r)}>{labels[r]} · {RELIC_LIST.filter(x => x.rarity === r).length}</button>)}
    </div>
    <div className="catalog-filters">
      <select aria-label="遗物角色筛选" value={character} onChange={e => setCharacter(e.target.value as CharacterId | 'all')}><option value="all">全部角色</option>{CHARACTER_LIST.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
      <button className="iconbtn" aria-pressed={exclusive} onClick={() => setExclusive(!exclusive)}>仅角色专属</button>
      <select aria-label="章节遗物筛选" value={chapter} onChange={e => setChapter(e.target.value as typeof chapter)}><option value="all">全部章节</option>{CHAPTER_IDS.map(id => <option key={id} value={id}>{CHAPTERS[id].label}专属</option>)}</select>
      <select aria-label="遗物来源筛选" value={source} onChange={e => setSource(e.target.value as typeof source)}><option value="all">全部来源</option><option value="event">问号专属</option><option value="shop">商店专属</option></select>
      <input aria-label="搜索遗物" placeholder="搜索遗物名称或效果" value={query} onChange={e => setQuery(e.target.value)} />
    </div>
    <p className="subtitle catalog-summary" aria-live="polite">显示 {relics.length} / {RELIC_LIST.length} 件 · 常规 {regular} 件、角色专属 {unique} 件、章节专属 {RELIC_LIST.filter(r => r.chapter).length} 件、问号专属 {RELIC_LIST.filter(r => r.source === 'event').length} 件、商店专属 {RELIC_LIST.filter(r => r.source === 'shop').length} 件、初始 {starters} 件。</p>
    <div className="relic-catalog-grid scroll" tabIndex={0} role="region" aria-label="遗物列表">{relics.map(r => <article className="panel relic-catalog-entry" key={r.id}><span className={`relic ${r.rarity}`}>{r.icon}</span><div><h3>{r.name} <small>{labels[r.rarity]}</small></h3>{r.owner && <span className="relic-owner">{CHARACTERS[r.owner].name}专属</span>}{r.chapter && <span className="relic-owner">{CHAPTERS[r.chapter].label}首领奖励</span>}{r.source && <span className="relic-owner">{r.source === 'event' ? '问号事件专属' : '商店专属'}</span>}<p>{r.description}</p></div></article>)}{!relics.length && <p className="subtitle">没有符合筛选条件的遗物。</p>}</div>
  </Modal>;
}
