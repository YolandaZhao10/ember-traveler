import { useEffect, useState } from 'react';
import { describeCard, viewCard } from '../../engine/cards';
import { cardTransferChoices } from '../../engine/cardTransfer';
import { closeOverlay, playCardDirect, useGame } from '../store';
import { Card } from './Card';
import { Modal } from './Common';

export function PileCardChoice({ cardUid }: { cardUid: string }) {
  const { run, busy } = useGame();
  const [choiceUid, setChoiceUid] = useState<string | null>(null);
  const cs = run?.combat;
  const source = cs?.player.hand.find(c => c.uid === cardUid);
  const choices = source && cs ? cardTransferChoices(cs, source) : [];
  const choice = choices.find(c => c.uid === choiceUid);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || !choice || busy) return;
      e.preventDefault();
      void playCardDirect(cardUid, null, choice.uid);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardUid, choice, busy]);
  if (!cs || !source) return null;
  return <Modal title={`${viewCard(source).name} · 选择卡牌`} onClose={closeOverlay} wide>
    <p className="subtitle">{describeCard(source, null)}</p>
    <p className="subtitle">确认时支付 {viewCard(source).cost} 能量。选择只移动一张原牌，不视为打出；后续抽牌照常结算。</p>
    <div className="replay-choices cardgrid">
      {choices.map(c => <button className={`replay-choice ${c.uid === choiceUid ? 'selected' : ''}`} key={c.uid} aria-label={`选择${viewCard(c).name}`} aria-pressed={c.uid === choiceUid} onClick={() => setChoiceUid(c.uid)}>
        <Card card={c} size="sm" presentation />
      </button>)}
      {!choices.length && <p>牌堆中没有符合条件的牌。</p>}
    </div>
    <div className="upgrade-actions">
      <button className="btn ghost" onClick={closeOverlay}>取消 Esc</button>
      <button className="btn primary" disabled={!choice || busy} onClick={() => { if (choice) void playCardDirect(cardUid, null, choice.uid); }}>确认{choice ? `「${viewCard(choice).name}」` : ''} · Enter</button>
    </div>
  </Modal>;
}
