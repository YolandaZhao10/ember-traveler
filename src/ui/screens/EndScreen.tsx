import { formatJourneyTime } from '../journeyClock';
import { RELICS } from '../../data/relics';
import { CHAPTERS } from '../../data/chapters';
import { sortedDeck } from '../../engine/run';
import { Card } from '../components/Card';
import { FlameIcon } from '../sprites/Sprites';
import { toTitle, newGame, useGame } from '../store';

export function EndScreen({ victory }: { victory: boolean }) {
  const { run } = useGame();
  if (!run) return null;
  const st = run.stats;
  return (
    <div className="screen center-screen grain scroll">
      <FlameIcon className="flame" />
      <h2 style={{ color: victory ? 'var(--ember-2)' : '#c94c3f' }}>{victory ? '火种照亮了出口' : '火种熄灭'}</h2>
      <p className="subtitle" style={{ maxWidth: 520, textAlign: 'center' }}>
        {CHAPTERS[run.chapter].label} · {CHAPTERS[run.chapter].name} — {run.endMessage}
      </p>
      <p className="subtitle">本局用时 {formatJourneyTime(run.elapsedMs)}</p>
      <div className="endstats">
        <div className="panel">
          <b>{run.floor + 1}</b>
          <span>到达层数</span>
        </div>
        <div className="panel">
          <b>{st.enemiesKilled}</b>
          <span>击败敌人</span>
        </div>
        <div className="panel">
          <b>{st.elitesKilled}</b>
          <span>击败精英</span>
        </div>
        <div className="panel">
          <b>{st.cardsPlayed}</b>
          <span>打出卡牌</span>
        </div>
        <div className="panel">
          <b>{st.damageDealt}</b>
          <span>造成伤害</span>
        </div>
        <div className="panel">
          <b>{run.gold}</b>
          <span>剩余金币</span>
        </div>
      </div>
      <div className="relicbar">
        {run.relics.map((id) => (
          <span key={id} className={`relic ${RELICS[id].rarity}`} title={RELICS[id].name}>
            {RELICS[id].icon}
          </span>
        ))}
      </div>
      <p className="subtitle">最终牌组（{run.deck.length} 张）· 种子 {run.seed}</p>
      <div className="cardgrid">
        {sortedDeck(run.deck).map((c) => (
          <Card key={c.uid} card={c} size="sm" />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn primary" onClick={() => newGame(undefined, run.character)}>
          再来一局
        </button>
        <button className="btn" onClick={() => newGame(run.seed, run.character)}>
          用同一种子重开
        </button>
        <button className="btn ghost" onClick={toTitle}>
          回到标题（保留回退点）
        </button>
      </div>
    </div>
  );
}
