import { useState } from 'react';
import { CHARACTER_LIST, CHARACTERS } from '../../data/characters';
import { CARDS } from '../../data/cards';
import { RELICS } from '../../data/relics';
import { difficultyName } from '../../data/difficulty';
import { journeyStats, loadHistory, recordJourney, type JourneyRecord } from '../../engine/history';
import { loadRun } from '../../engine/save';
import { closeOverlay, openOverlay } from '../store';
import { Modal } from './Common';
import { Card } from './Card';
import { DifficultySummary } from './DifficultyPicker';

const outcomes = { won: '通关', lost: '倒下', abandoned: '放弃' };
export function JourneyHistory() {
  const [records] = useState(() => { recordJourney(loadRun()); return loadHistory(); });
  const [character, setCharacter] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [selected, setSelected] = useState<JourneyRecord | null>(null);
  const filtered = records.filter(r => (difficulty === 'all' || difficultyName(r.difficulty) === difficulty) && (character === 'all' || r.character === character));
  const list = filtered.filter(r => outcome === 'all' || r.outcome === outcome);
  const total = journeyStats(filtered);
  return <Modal title={selected ? `${CHARACTERS[selected.character].name} · ${outcomes[selected.outcome]}牌组` : '旅程记录'} onClose={closeOverlay} wide>
    {selected ? <>
      <div className="history-detail-meta"><span>{new Date(selected.endedAt).toLocaleString('zh-CN')}</span><span>第 {selected.floor} 层 · 生命 {selected.hp}/{selected.maxHp}</span><span>种子 {selected.seed}</span></div>
      <div className="history-scroll">
        <DifficultySummary value={selected.difficulty} />
        <h4>结束时的牌组 · {selected.deck.reduce((n,c) => n + c.count, 0)} 张</h4>
        <div className="cardgrid history-deck">{selected.deck.map((c, i) => <div className="history-card" key={`${c.defId}-${c.upgraded}`}>
          {CARDS[c.defId] ? <Card card={{ defId: c.defId, upgraded: c.upgraded, uid: `record-${i}` }} size="sm" presentation /> : <span>{c.defId}{c.upgraded ? '+' : ''}</span>}<b>× {c.count}</b>
        </div>)}</div>
        <h4>持有遗物 · {selected.relics.length} 件</h4>
        <div className="history-relics">{selected.relics.map(id => <span key={id} title={RELICS[id]?.description}>{RELICS[id]?.icon} {RELICS[id]?.name ?? id}</span>)}</div>
      </div>
      <button className="btn" onClick={() => setSelected(null)}>返回记录</button>
    </> : <>
      <p className="subtitle">胜率 = 通关 ÷（通关 + 倒下）。进行中和放弃的旅程不计入胜率；同一局 SL 后更新原记录。</p>
      <div className="history-filters">
        <label>角色 <select aria-label="记录角色" value={character} onChange={e => setCharacter(e.target.value)}><option value="all">全部角色</option>{CHARACTER_LIST.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>难度 <select aria-label="记录难度" value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="all">全部难度</option>{['轻松', '标准', '挑战', '自定义'].map(d => <option key={d}>{d}</option>)}</select></label>
        <label>结果 <select aria-label="记录结果" value={outcome} onChange={e => setOutcome(e.target.value)}><option value="all">全部结果</option><option value="won">只看通关</option><option value="lost">只看倒下</option><option value="abandoned">只看放弃</option></select></label>
      </div>
      <div className="history-scroll">
        <table className="history-stats"><thead><tr><th>角色</th><th>通关</th><th>倒下</th><th>胜率</th><th>放弃</th></tr></thead><tbody>
          {[{ id: 'all', name: '合计' }, ...CHARACTER_LIST.filter(c => character === 'all' || character === c.id)].map(c => {
            const stats = c.id === 'all' ? total : journeyStats(filtered.filter(r => r.character === c.id));
            return <tr key={c.id}><th>{c.name}</th><td>{stats.wins}</td><td>{stats.losses}</td><td>{stats.winRate === null ? '—' : `${(stats.winRate * 100).toFixed(1)}%`}</td><td>{stats.abandoned}</td></tr>;
          })}
        </tbody></table>
        <div className="history-list">{list.length ? list.map(r => <button className={`history-entry ${r.outcome}`} key={r.id} onClick={() => setSelected(r)}>
          <b>{outcomes[r.outcome]} · {CHARACTERS[r.character].name}</b><span>{difficultyName(r.difficulty)} · 第 {r.floor} 层</span><small>{new Date(r.endedAt).toLocaleString('zh-CN')}</small><span>查看牌组 →</span>
        </button>) : <p className="history-empty">暂无符合条件的记录。结束旅程后会自动保存，历史旧对局无法补录。</p>}</div>
      </div>
      <button className="btn" onClick={() => openOverlay({ kind: 'menu' })}>返回菜单</button>
    </>}
  </Modal>;
}
