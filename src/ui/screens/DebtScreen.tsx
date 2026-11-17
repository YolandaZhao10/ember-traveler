import { Backdrop } from '../components/Art';
import { CHAPTERS } from '../../data/chapters';
import { LOAN_REPAY } from '../../engine/constants';
import { debtFight, debtRepay, useGame } from '../store';

/** 进店前了结借款：金币够就二选一，不够只能迎战。 */
export function DebtScreen() {
  const { run } = useGame();
  if (!run || run.loan?.stage !== 'choice') return null;
  const canRepay = run.gold >= LOAN_REPAY;
  return (
    <div className="screen center-screen debt-screen grain">
      <Backdrop id={CHAPTERS[run.chapter].shopArt} dim={0.72} />
      <div className="panel debt-panel" role="dialog" aria-labelledby="debt-heading">
        <h2 id="debt-heading">🧾 贷款到期</h2>
        {canRepay
          ? <p>灰雾商人拦在门口：「先把账结了。」归还 {LOAN_REPAY} 金币，或者拒绝归还，与讨债人一战。当前金币：{run.gold}。</p>
          : <p>你只有 {run.gold} 金币，不够归还 {LOAN_REPAY}。讨债人已经等在门口，只能迎战。</p>}
        <p className="subtitle">打赢讨债人没有任何战斗奖励，随后照常进店；倒下则旅程结束。</p>
        <div className="debt-actions">
          {canRepay && <button className="btn primary" onClick={debtRepay}>归还 {LOAN_REPAY} 金币</button>}
          <button className={`btn ${canRepay ? '' : 'primary'}`} onClick={debtFight}>{canRepay ? '拒绝归还，迎战讨债人' : '迎战讨债人'}</button>
        </div>
      </div>
    </div>
  );
}
