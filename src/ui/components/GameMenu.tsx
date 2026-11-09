import type { CharacterId } from '../../engine/types';
import { abandonRun, closeOverlay, openOverlay, quickReset, toTitle, toggleFastAnim, toggleSound, useGame } from '../store';
import { Modal } from './Common';
import { DifficultySummary } from './DifficultyPicker';

export function GameMenu({ character }: { character?: CharacterId }) {
  const { run, showTitle, busy, settings } = useGame();
  const active = !showTitle && run;
  return (
    <Modal title="菜单" onClose={closeOverlay}>
      {active && <p className="subtitle">进度自动保存 · 种子：{run.seed}</p>}
      {active && <DifficultySummary value={run.difficulty} />}
      <div className="menu-actions">
        <button className="btn" onClick={() => openOverlay({ kind: 'help' })}>怎么玩</button>
        <button className="btn" onClick={() => openOverlay({ kind: 'history' })}>旅程记录 · 胜率与获胜牌组</button>
        {active && <>
          <button className="btn" disabled={busy || !run.checkpoint} onClick={quickReset}>↶ 快速 SL</button>
          <p className="subtitle menu-note">{run.checkpoint?.screen === 'reward' ? '重新选择本次战利品，撤销领奖，不需要重打战斗；奖励内容不重掷。' : run.checkpoint && !run.checkpoint.currentNodeId ? '回到本章地图起点，保留章间整备结果。' : run.checkpoint ? `回到第 ${run.floor + 1} 层节点开始，撤销本节点操作；随机结果不重掷。` : '本节点暂无回退点，进入下一节点后可用。'}</p>
        </>}
        <button className="btn" onClick={() => openOverlay({ kind: 'catalog', character: character ?? (active ? run.character : undefined) })}>卡牌图鉴</button>
        <button className="btn" onClick={() => openOverlay({ kind: 'relicCatalog' })}>遗物图鉴</button>
        <button className={`btn ${settings.sound ? '' : 'ghost'}`} onClick={toggleSound}>音效：{settings.sound ? '开' : '关'}</button>
        <button className={`btn ${settings.fastAnim ? '' : 'ghost'}`} onClick={toggleFastAnim}>快速动画：{settings.fastAnim ? '开' : '关'}</button>
        {active && <>
          <button className="btn" onClick={toTitle}>返回标题（保留存档）</button>
          <button className="btn danger" onClick={() => openOverlay({ kind: 'confirm', title: '放弃本局', text: '将删除当前存档，此操作无法撤销。', onYes: abandonRun })}>放弃本局（删除存档）</button>
        </>}
      </div>
    </Modal>
  );
}
