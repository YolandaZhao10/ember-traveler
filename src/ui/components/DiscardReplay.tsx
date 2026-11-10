import { useState } from 'react';
import { viewCard } from '../../engine/cards';
import { aliveEnemies, discardReplayChoices } from '../../engine/combat';
import { closeOverlay, playCardDirect, useGame } from '../store';
import { PileChoices } from './PileChoices';
import { Modal } from './Common';

export function DiscardReplay({ cardUid }: { cardUid: string }) {
  const { run, busy } = useGame();
  const [choiceUid, setChoiceUid] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const cs = run?.combat;
  const source = cs?.player.hand.find(c => c.uid === cardUid);
  if (!cs || !source) return null;
  const choices = discardReplayChoices(cs);
  const choice = choices.find(c => c.uid === choiceUid);
  const enemies = aliveEnemies(cs);
  const targeted = choice && viewCard(choice).target === 'enemy';
  const validTarget = !targeted || enemies.some(e => e.id === targetId);
  const pick = (uid: string | null) => {
    setChoiceUid(uid);
    setTargetId(enemies.length === 1 ? enemies[0].id : null);
  };
  const confirm = () => { if (choice && validTarget && !busy) void playCardDirect(cardUid, targeted ? targetId : null, choice.uid); };
  return <Modal title="血誓重演 · 选择要重放的牌" onClose={closeOverlay} wide>
    <p className="subtitle">确认时支付 {viewCard(source).cost} 能量，并消耗血誓重演。所选牌免能量重放一次，其他代价照常支付；结算后弃置，带消耗则消耗。不能选择能力、诅咒、重放或牌堆选牌效果的牌。</p>
    <PileChoices cards={choices} selectedUid={choiceUid} onPick={pick} onConfirm={confirm} onCancel={closeOverlay} canConfirm={!!choice && validTarget} busy={busy} />
    {targeted && <div className="replay-targets" role="group" aria-label="选择重放目标">
      <span>先选择目标，再按 Enter：</span>
      {enemies.map(e => <button key={e.id} className={`btn ${targetId === e.id ? 'primary' : ''}`} aria-pressed={targetId === e.id} onClick={() => setTargetId(e.id)}>{e.name} · {e.hp}/{e.maxHp}</button>)}
    </div>}
    <div className="upgrade-actions">
      <button className="btn ghost" aria-keyshortcuts="Escape" onClick={closeOverlay}>取消 Esc</button>
      <button className="btn primary" aria-keyshortcuts="Enter" disabled={!choice || !validTarget || busy} onClick={confirm}>确认重放{choice ? `「${viewCard(choice).name}」` : ''} · Enter</button>
    </div>
  </Modal>;
}
