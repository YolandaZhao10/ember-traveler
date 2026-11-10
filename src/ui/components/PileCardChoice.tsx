import { useState } from 'react';
import { describeCard, viewCard } from '../../engine/cards';
import { cardTransferChoices } from '../../engine/cardTransfer';
import { closeOverlay, playCardDirect, useGame } from '../store';
import { PileChoices } from './PileChoices';
import { Modal } from './Common';

export function PileCardChoice({ cardUid }: { cardUid: string }) {
  const { run, busy } = useGame();
  const [choiceUid, setChoiceUid] = useState<string | null>(null);
  const cs = run?.combat;
  const source = cs?.player.hand.find(c => c.uid === cardUid);
  const choices = source && cs ? cardTransferChoices(cs, source) : [];
  const choice = choices.find(c => c.uid === choiceUid);
  const confirm = () => { if (choice && !busy) void playCardDirect(cardUid, null, choice.uid); };
  if (!cs || !source) return null;
  return <Modal title={`${viewCard(source).name} · 选择卡牌`} onClose={closeOverlay} wide>
    <p className="subtitle">{describeCard(source, null)}</p>
    <p className="subtitle">确认时支付 {viewCard(source).cost} 能量。选择只移动一张原牌，不视为打出；后续抽牌照常结算。</p>
    <PileChoices cards={choices} selectedUid={choiceUid} onPick={setChoiceUid} onConfirm={confirm} onCancel={closeOverlay} canConfirm={!!choice} busy={busy} />
    <div className="upgrade-actions">
      <button className="btn ghost" aria-keyshortcuts="Escape" onClick={closeOverlay}>取消 Esc</button>
      <button className="btn primary" aria-keyshortcuts="Enter" disabled={!choice || busy} onClick={confirm}>确认{choice ? `「${viewCard(choice).name}」` : ''} · Enter</button>
    </div>
  </Modal>;
}
