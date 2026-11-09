import { useState } from 'react';
import { RELIC_LIST, relicAvailableTo } from '../../data/relics';
import { CHARACTER_LIST, CHARACTERS } from '../../data/characters';
import { CHAPTERS, CHAPTER_IDS } from '../../data/chapters';
import type { CharacterId } from '../../engine/types';
import { RELIC_CATEGORIES, relicCategory, type RelicCategory } from '../relicCatalog';
import { closeOverlay } from '../store';
import { Modal } from './Common';

export function RelicCatalog() {
  const [category, setCategory] = useState<RelicCategory | 'all'>('all');
  const [character, setCharacter] = useState<CharacterId | 'all'>('all');
  const [exclusive, setExclusive] = useState(false);
  const [query, setQuery] = useState('');
  const [chapter, setChapter] = useState<'all' | `${keyof typeof CHAPTERS}`>('all');
  const relics = RELIC_LIST.filter(r => (category === 'all' || relicCategory(r) === category)
    && (!exclusive || !!r.owner)
    && (chapter === 'all' || r.chapter === Number(chapter))
    && (character === 'all' || (r.rarity === 'starter' ? r.id === CHARACTERS[character].starterRelic : relicAvailableTo(r, character)))
    && `${r.name}${r.description}${r.owner ? CHARACTERS[r.owner].name : ''}`.includes(query.trim()));
  const chooseCategory = (value: RelicCategory | 'all') => { setCategory(value); setChapter('all'); };
  return <Modal title="遗物图鉴" onClose={closeOverlay} wide>
    <div className="catalog-tabs" aria-label="遗物分类">
      <button className="iconbtn" aria-pressed={category === 'all'} onClick={() => chooseCategory('all')}>全部遗物 · {RELIC_LIST.length}</button>
      {RELIC_CATEGORIES.map(c => <button className="iconbtn" aria-pressed={category === c.id} key={c.id} onClick={() => chooseCategory(c.id)}>{c.label} · {RELIC_LIST.filter(r => relicCategory(r) === c.id).length}</button>)}
    </div>
    <div className="catalog-filters">
      <select aria-label="遗物角色筛选" value={character} onChange={e => setCharacter(e.target.value as CharacterId | 'all')}><option value="all">全部角色</option>{CHARACTER_LIST.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
      <button className="iconbtn" aria-pressed={exclusive} onClick={() => setExclusive(!exclusive)}>仅角色专属</button>
      <select aria-label="章节遗物筛选" value={chapter} onChange={e => { const value = e.target.value as typeof chapter; setChapter(value); if (value !== 'all') setCategory('chapter'); }}><option value="all">全部章节</option>{CHAPTER_IDS.map(id => <option key={id} value={id}>{CHAPTERS[id].label}专属</option>)}</select>
      <input aria-label="搜索遗物" placeholder="搜索遗物名称或效果" value={query} onChange={e => setQuery(e.target.value)} />
    </div>
    <p className="subtitle catalog-summary" aria-live="polite">显示 {relics.length} / {RELIC_LIST.length} 件 · 问号、商店与章节专属独立收录，稀有页只展示常规及角色专属稀有遗物。</p>
    <div className="relic-catalog-list scroll" key={category} tabIndex={0} role="region" aria-label="遗物列表">
      {RELIC_CATEGORIES.map(c => {
        const entries = relics.filter(r => relicCategory(r) === c.id);
        if (!entries.length) return null;
        return <section className="relic-catalog-section" aria-label={c.label} key={c.id}>
          <h3 className="relic-catalog-heading">{c.label}<small>{entries.length} 件</small></h3>
          <div className="relic-catalog-grid">{entries.map(r => <article className="panel relic-catalog-entry" key={r.id}>
            <span className={`relic ${r.rarity}`}>{r.icon}</span>
            <div><h4>{r.name}</h4>{r.owner && <span className="relic-owner">{CHARACTERS[r.owner].name}专属</span>}{r.chapter && <span className="relic-owner">{CHAPTERS[r.chapter].label}首领奖励</span>}<p>{r.description}</p></div>
          </article>)}</div>
        </section>;
      })}
      {!relics.length && <p className="subtitle">没有符合筛选条件的遗物。</p>}
    </div>
  </Modal>;
}
