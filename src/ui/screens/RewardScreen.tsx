import { useEffect } from 'react';
import { Backdrop } from '../components/Art';
import { CHAPTERS, FINAL_CHAPTER, nextChapter } from '../../data/chapters';
import { RELICS } from '../../data/relics';
import { Card } from '../components/Card';
import { rewardDeckSummary } from '../rewardDeckSummary';
import { getState, openOverlay, rewardLeave, rewardSkipCard, rewardTakeCard, rewardTakeGold, rewardTakeRelic, useGame } from '../store';
import './RewardScreen.css';

export function RewardScreen() {
  const { run } = useGame();
  const r = run?.reward;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      const current = getState(), journey = current.run, reward = journey?.reward;
      if (!journey || !reward || journey.screen !== 'reward' || current.showTitle || current.overlay || current.busy) return;
      const key = event.key.toLowerCase();
      if (!['1', '2', '3', 's', 'enter'].includes(key)) return;
      // 聚焦其他按钮时保留其原生Enter操作，例如领取遗物；避免一个按键同时前进。
      if (key === 'enter' && target?.closest('button, a, [role="button"]') && !target.closest('[data-reward-continue]')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.repeat) return;
      if (key === 's') { if (!reward.cardTaken) rewardSkipCard(); }
      else if (key === 'enter') {
        const completed = reward.chapterComplete ?? (journey.currentNodeId && journey.map.nodes[journey.currentNodeId]?.type === 'boss' ? journey.chapter : null);
        if ((reward.relicChoices?.length && !reward.relicTaken) || (completed && !reward.cardTaken)) return;
        rewardLeave();
      }
      else if (!reward.cardTaken) {
        const card = reward.cards[Number(key) - 1];
        if (card) rewardTakeCard(card.uid);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  if (!run || !r) return null;
  const relic = r.relic ? RELICS[r.relic] : null;
  const chapterEnd = r.chapterComplete ?? (run.currentNodeId && run.map.nodes[run.currentNodeId].type === 'boss' ? run.chapter : null);
  const choices = r.relicChoices ?? [];
  const deck = rewardDeckSummary(run.deck);
  return (
    <div className="screen center-screen grain scroll">
      <Backdrop id={CHAPTERS[run.chapter].battleArt} dim={0.62} />
      <h2>{chapterEnd ? `${CHAPTERS[chapterEnd].label}通关` : '战斗胜利'}</h2>
      <p className="subtitle">{chapterEnd === FINAL_CHAPTER ? '无昼之主已经倒下，旅程完成。' : chapterEnd ? `${CHAPTERS[chapterEnd].name}的首领已倒下。领取本角色稀有卡牌与章节遗物，准备前往${CHAPTERS[nextChapter(chapterEnd)!].name}。` : '灰烬散去，火种仍在。领取战利品后继续前进。'}</p>
      <div className="rewardlist">
        <div className={`rewardrow panel ${r.goldTaken ? 'taken' : ''}`}>
          <div className="lbl">
            <span style={{ fontSize: 22 }}>🪙</span> {r.gold} 金币
            {!r.goldTaken && <small style={{ color: 'var(--text-dim)', fontWeight: 400 }}>离开时自动拾取</small>}
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
          <p className="subtitle">{chapterEnd ? '本角色稀有卡牌 · 三选一' : '选择一张卡牌加入牌组'} · 1 / 2 / 3 选牌 · 右键 / 长按查看详情</p>
          <div className="panel reward-deck-summary" aria-label="当前牌组概览">
            <strong>牌组 {deck.count} 张</strong>
            <span>攻击 {deck.types.attack} · 技能 {deck.types.skill} · 能力 {deck.types.power}{deck.types.curse ? ` · 诅咒 ${deck.types.curse}` : ''}</span>
            <span title="按升级后的费用计算，诅咒不参与平均">平均费用 {deck.averageCost === null ? '—' : deck.averageCost.toFixed(1)}</span>
            <button className="btn ghost small" onClick={() => openOverlay({ kind: 'pile', pile: 'deck' })}>查看牌组</button>
          </div>
          <div className="cardchoice">
            {r.cards.map((c, index) => (
              <div
                className="cardwrap"
                key={c.uid}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openOverlay({ kind: 'card', card: c, inCombat: false });
                }}
              >
                <kbd className="reward-choice-key">{index + 1}</kbd>
                <Card card={c} showFlavor onClick={() => rewardTakeCard(c.uid)} />
                <p className="reward-card-owned">已持有 {deck.copies[c.defId] ?? 0} 张</p>
              </div>
            ))}
          </div>
          <button className="btn ghost" aria-keyshortcuts="S" onClick={() => rewardSkipCard()}>
            跳过卡牌 · S
          </button>
        </>
      ) : r.cards.length > 0 ? (
        <p className="subtitle">卡牌奖励已处理。</p>
      ) : null}
      <button className="btn primary" data-reward-continue aria-keyshortcuts="Enter" disabled={(choices.length > 0 && !r.relicTaken) || (!!chapterEnd && !r.cardTaken)} onClick={() => rewardLeave()}>
        {chapterEnd === FINAL_CHAPTER ? '完成旅程' : chapterEnd ? '前往章间整备' : '继续前进'} · Enter
      </button>
    </div>
  );
}
