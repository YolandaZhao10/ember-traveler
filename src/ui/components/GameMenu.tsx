import type { CharacterId } from '../../engine/types';
import { abandonRun, changeArtStyle, closeOverlay, confirmFinishRun, openOverlay, quickReset, toTitle, toggleFastAnim, toggleSound, useGame } from '../store';
import { Modal } from './Common';
import { DifficultySummary } from './DifficultyPicker';

export function GameMenu({ character }: { character?: CharacterId }) {
  const { run, showTitle, busy, settings } = useGame();
  const active = !showTitle && run;
  const settled = run?.screen === 'victory' || run?.screen === 'gameover';
  return (
    <Modal title="菜单" onClose={closeOverlay}>
      {active && <p className="subtitle">进度自动保存 · 种子：{run.seed}</p>}
      {active && <DifficultySummary value={run.difficulty} />}
      <div className="menu-actions">
        <button className="btn" onClick={() => openOverlay({ kind: 'help' })}>怎么玩</button>
        <button className="btn" onClick={() => openOverlay({ kind: 'history' })}>旅程记录 · 胜率与获胜牌组</button>
        {active && <>
          <button className="btn" disabled={busy || !run.checkpoint} onClick={quickReset} aria-keyshortcuts="R" title="R 快速 SL，输入文字时不会触发">↶ 快速 SL · R</button>
          <p className="subtitle menu-note">{run.checkpoint?.screen === 'reward' ? '重新选择本次战利品，撤销领奖，不需要重打战斗；奖励内容不重掷。' : run.checkpoint && !run.checkpoint.currentNodeId ? '回到本章地图起点，保留章间整备结果。' : run.checkpoint ? `回到第 ${run.floor + 1} 层节点开始，撤销本节点操作；随机结果不重掷。` : '本节点暂无回退点，进入下一节点后可用。'}</p>
        </>}
        <button className="btn" onClick={() => openOverlay({ kind: 'catalog', character: character ?? (active ? run.character : undefined) })}>卡牌图鉴</button>
        <button className="btn" onClick={() => openOverlay({ kind: 'relicCatalog' })}>遗物图鉴</button>
        <fieldset className="art-style-picker">
          <legend>画风</legend>
          <label className={settings.artStyle === 'detailed' ? 'selected' : ''}>
            <input type="radio" name="art-style" value="detailed" checked={settings.artStyle === 'detailed'} onChange={() => changeArtStyle('detailed')} />
            精细画风
          </label>
          <label className={settings.artStyle === 'simple' ? 'selected' : ''}>
            <input type="radio" name="art-style" value="simple" checked={settings.artStyle === 'simple'} onChange={() => changeArtStyle('simple')} />
            简易画风
          </label>
          <p>角色、怪物、卡面与背景同时切换，自动记住选择。</p>
        </fieldset>
        <button className={`btn ${settings.sound ? '' : 'ghost'}`} onClick={toggleSound}>音效：{settings.sound ? '开' : '关'}</button>
        <button className={`btn ${settings.fastAnim ? '' : 'ghost'}`} onClick={toggleFastAnim}>快速动画：{settings.fastAnim ? '开' : '关'}</button>
        {active && <>
          <button className="btn" onClick={toTitle}>返回标题（保留存档）</button>
          {settled ? <button className="btn primary" disabled={busy} onClick={confirmFinishRun}>结束旅程（保留{run.screen === 'victory' ? '通关' : '结算'}记录）</button>
            : <button className="btn danger" onClick={() => openOverlay({ kind: 'confirm', title: '放弃本局', text: '将删除当前存档，此操作无法撤销。', onYes: abandonRun })}>放弃本局（删除存档）</button>}
        </>}
      </div>
    </Modal>
  );
}
