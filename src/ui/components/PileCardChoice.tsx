import { useState } from 'react';
import { describeCard, viewCard } from '../../engine/cards';
import { cardTransferChoices } from '../../engine/cardTransfer';
import type { ExhaustChoiceRequest } from '../../engine/combat';
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
    <p className="subtitle">{describeCard(source, null, run?.character)}</p>
    <p className="subtitle">确认时支付 {viewCard(source).cost} 能量。选择只移动一张原牌，不视为打出；后续抽牌照常结算。</p>
    <PileChoices cards={choices} selectedUid={choiceUid} onPick={setChoiceUid} onConfirm={confirm} onCancel={closeOverlay} canConfirm={!!choice} busy={busy} />
    <div className="upgrade-actions">
      <button className="btn ghost" aria-keyshortcuts="Escape" onClick={closeOverlay}>取消 Esc</button>
      <button className="btn primary" aria-keyshortcuts="Enter" disabled={!choice || busy} onClick={confirm}>确认{choice ? `「${viewCard(choice).name}」` : ''} · Enter</button>
    </div>
  </Modal>;
}

/** 在手牌里选 N 张消耗或弃置：必须选满才能确认。重放需要再选时会带着已确认的各组重新打开。 */
export function HandExhaustChoice({ cardUid, targetId, replayUid, exhaust, request }: {
  cardUid: string; targetId: string | null; replayUid?: string; exhaust: string[][]; request: ExhaustChoiceRequest;
}) {
  const { run, busy } = useGame();
  const [picked, setPicked] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const source = run?.combat?.player.hand.find(c => c.uid === cardUid);
  if (!source) return null;
  const full = picked.length === request.count;
  const verb = request.action === 'discard' ? '弃置' : '消耗';
  // 选牌前已经抽到了新牌（例如先抽牌再选择弃置）：不能取消出牌，否则等于免费看了牌堆顶。
  const revealed = request.hand.some(c => !run?.combat?.player.hand.some(h => h.uid === c.uid));
  const cancel = revealed ? () => {} : closeOverlay;
  const toggle = (uid: string | null) => {
    if (!uid) return;
    setFocus(uid);
    setPicked(current => current.includes(uid) ? current.filter(id => id !== uid) : current.length < request.count ? [...current, uid] : current);
  };
  const confirm = () => { if (full && !busy) void playCardDirect(cardUid, targetId, { replayUid, exhaust: [...exhaust, picked] }); };
  const names = picked.map(uid => viewCard(request.hand.find(c => c.uid === uid)!).name).join('、');
  return <Modal title={`${viewCard(source).name} · 选择 ${request.count} 张牌${verb}（已选 ${picked.length}/${request.count}）`} onClose={revealed ? undefined : closeOverlay} wide>
    <p className="subtitle">{describeCard(source, null, run?.character)}</p>
    <p className="subtitle">{request.group > 0 ? `第 ${request.group + 1} 次结算（重放）：从此时的手牌里重新选择。` : `确认时支付 ${viewCard(source).cost} 能量。`}必须选满 {request.count} 张；再点一次已选的牌可以取消选中。{revealed ? '已经抽到新牌，不能取消出牌。' : ''}</p>
    <PileChoices cards={request.hand} selectedUid={focus} selectedUids={picked} onPick={toggle} onConfirm={confirm} onCancel={cancel} canConfirm={full} busy={busy} cancellable={!revealed} />
    <div className="upgrade-actions">
      {!revealed && <button className="btn ghost" aria-keyshortcuts="Escape" onClick={closeOverlay}>取消 Esc</button>}
      <button className="btn primary" aria-keyshortcuts="Enter" disabled={!full || busy} onClick={confirm}>{full ? `${verb}「${names}」` : `还需选择 ${request.count - picked.length} 张`} · Enter</button>
    </div>
  </Modal>;
}
