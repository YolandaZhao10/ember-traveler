import { CHAPTERS, CHAPTER_IDS, CHAPTER_RECOVERY, nextChapter } from '../../data/chapters';
import { Backdrop } from '../components/Art';
import { enterNextChapter, openOverlay, useGame } from '../store';

export function ChapterScreen() {
  const { run } = useGame();
  if (!run) return null;
  const nextId = nextChapter(run.chapter);
  if (!nextId) return null;
  const next = CHAPTERS[nextId];
  const healed = Math.min(run.maxHp - run.hp, Math.ceil(run.maxHp * CHAPTER_RECOVERY));
  return (
    <div className="screen chapter-screen grain scroll">
      <Backdrop id={next.gateArt} dim={0.65} />
      <div className="chapter-story">
        <span className="chapter-kicker">{CHAPTERS[run.chapter].label}完成 · {CHAPTERS[run.chapter].name}</span>
        <h1>{next.arrival.split('，')[0]}<br /><em>{next.arrival.split('，')[1]}</em></h1>
        <p>{next.description}</p>
        <div className="chapter-route">{CHAPTER_IDS.map(id => <span key={id} className={id === nextId ? 'next-chapter' : ''}>{id} · {CHAPTERS[id].name}{id <= run.chapter ? ' ✓' : ''}</span>)}</div>
      </div>
      <section className="chapter-boarding panel">
        <span className="chapter-kicker">下一站 · 第 {next.startFloor + 1}–{next.startFloor + next.floors} 层</span>
        <h2>{next.name}</h2>
        <p className="subtitle">{next.inhabitants}</p>
        <div className="chapter-recovery"><span>启程前的片刻整备</span><b>❤ {run.hp} → {run.hp + healed}<small> / {run.maxHp}</small></b><p>进入时回复 50% 最大生命（本次 +{healed}）。</p></div>
        <p className="chapter-carry">保留 {run.deck.length} 张卡牌、{run.relics.length} 件遗物和 {run.gold} 金币。{nextId === 4 ? '终章沿唯一的五站路线前进。' : '新区域将生成独立路线。'}</p>
        <button className="btn primary" onClick={enterNextChapter}>进入{next.label} · {next.name} →</button>
        <button className="btn ghost" onClick={() => openOverlay({ kind: 'pile', pile: 'deck' })}>出发前查看牌组</button>
        <small>进度已保存，可稍后继续。</small>
      </section>
    </div>
  );
}
