import { Backdrop } from '../components/Art';
import { CHAPTERS, FINAL_CHAPTER, nextChapter } from '../../data/chapters';
import { RELICS } from '../../data/relics';
import { Card } from '../components/Card';
import { openOverlay, rewardLeave, rewardSkipCard, rewardTakeCard, rewardTakeGold, rewardTakeRelic, useGame } from '../store';

export function RewardScreen() {
  const { run } = useGame();
  const r = run?.reward;
  if (!run || !r) return null;
  const relic = r.relic ? RELICS[r.relic] : null;
  const chapterEnd = r.chapterComplete ?? (run.currentNodeId && run.map.nodes[run.currentNodeId].type === 'boss' ? run.chapter : null);
  const choices = r.relicChoices ?? [];
  return (
    <div className="screen center-screen grain scroll">
      <Backdrop id={CHAPTERS[run.chapter].battleArt} dim={0.62} />
      <h2>{chapterEnd ? `${CHAPTERS[chapterEnd].label}通关` : '战斗胜利'}</h2>
      <p className="subtitle">{chapterEnd === FINAL_CHAPTER ? '无昼之主已经倒下。领取本角色稀有卡牌与终章纪念遗物，为旅程留下最后的战利品。' : chapterEnd ? `${CHAPTERS[chapterEnd].name}的首领已倒下。领取本角色稀有卡牌与章节遗物，准备前往${CHAPTERS[nextChapter(chapterEnd)!].name}。` : '灰烬散去，火种仍在。领取战利品后继续前进。'}</p>
      <div className="rewardlist">
        <div className={`rewardrow panel ${r.goldTaken ? 'taken' : ''}`}>
          <div className="lbl">
            <span style={{ fontSize: 22 }}>🪙</span> {r.gold} 金币
          </div>
          <button className="btn small" onClick={() => rewardTakeGold()} disabled={r.goldTaken}>
            {r.goldTaken ? '已领取' : '领取'}
          </button>
        </div>
        {relic && !choices.length && (
          <div className={`rewardrow panel ${r.relicTaken ? 'taken' : ''}`}>
            <div className="lbl">
              <button className={`relic ${relic.rarity}`} onClick={() => openOverlay({ kind: 'relic', relicId: relic.id })}>
                {relic.icon}
              </button>
              <div>
                <div>{relic.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400 }}>{relic.description}</div>
              </div>
            </div>
            <button className="btn small" onClick={() => rewardTakeRelic()} disabled={r.relicTaken}>
              {r.relicTaken ? '已领取' : '领取'}
            </button>
          </div>
        )}
      </div>
      {choices.length > 0 && <>
        <h3 className="chapter-relic-title">{CHAPTERS[chapterEnd ?? run.chapter].label}专属遗物 · 三选一</h3>
        <div className="chapter-relic-choices">
          {choices.map(id => {
            const item = RELICS[id]; const selected = r.relic === id && r.relicTaken;
            return <article className={`panel chapter-relic-option ${selected ? 'selected' : ''}`} key={id}>
              <span className={`relic ${item.rarity}`}>{item.icon}</span>
              <h3>{item.name}</h3><p>{item.description}</p>
              <button className="btn primary" disabled={r.relicTaken} onClick={() => rewardTakeRelic(id)}>{selected ? '已选择' : '选择此遗物'}</button>
            </article>;
          })}
        </div>
      </>}
      {!r.cardTaken ? (
        <>
          <p className="subtitle">{chapterEnd ? '本角色稀有卡牌 · 三选一（右键 / 长按查看详情）' : '选择一张卡牌加入牌组（右键 / 长按查看详情）：'}</p>
          <div className="cardchoice">
            {r.cards.map((c) => (
              <div
                className="cardwrap"
                key={c.uid}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openOverlay({ kind: 'card', card: c, inCombat: false });
                }}
              >
                <Card card={c} showFlavor onClick={() => rewardTakeCard(c.uid)} />
              </div>
            ))}
          </div>
          <button className="btn ghost" onClick={() => rewardSkipCard()}>
            跳过卡牌
          </button>
        </>
      ) : r.cards.length > 0 ? (
        <p className="subtitle">卡牌奖励已处理。</p>
      ) : null}
      <button className="btn primary" disabled={(choices.length > 0 && !r.relicTaken) || (!!chapterEnd && !r.cardTaken)} onClick={() => rewardLeave()}>
        {chapterEnd === FINAL_CHAPTER ? '完成旅程' : chapterEnd ? '前往章间整备' : '继续前进'}
      </button>
    </div>
  );
}
