import type { CharacterId } from '../../engine/types';
import { abandonRun, changeVisualStyle, closeOverlay, confirmFinishRun, openOverlay, quickReset, toTitle, toggleFastAnim, toggleSound, useGame } from '../store';
import { visualPreferences } from '../../engine/save';
import { Modal } from './Common';
import { DifficultySummary } from './DifficultyPicker';

export function GameMenu({ character }: { character?: CharacterId }) {
  const { run, showTitle, busy, settings } = useGame();
  const active = !showTitle && run;
  const settled = run?.screen === 'victory' || run?.screen === 'gameover';
  const visuals = visualPreferences(settings);
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
        <div className="visual-settings">
          <h4>画面风格</h4>
          {([['characters', '人物'], ['enemies', '怪物'], ['backgrounds', '场景背景']] as const).map(([key, label]) => <fieldset className="visual-style-row" key={key}>
            <legend>{label}</legend>
            {([['detailed', '现有'], ['simple', '简易']] as const).map(([value, text]) => <label className={visuals[key] === value ? 'selected' : ''} key={value}>
              <input type="radio" name={`visual-${key}`} checked={visuals[key] === value} onChange={() => changeVisualStyle(key, value)} />{text}
            </label>)}
          </fieldset>)}
          <fieldset className="visual-style-row"><legend>卡牌</legend>
            {([['normal', '正常'], ['simple', '简单'], ['ornate', '繁复']] as const).map(([value, text]) => <label className={visuals.cards === value ? 'selected' : ''} key={value}>
              <input type="radio" name="visual-cards" checked={visuals.cards === value} onChange={() => changeVisualStyle('cards', value)} />{text}
            </label>)}
          </fieldset>
          <p className="subtitle">分别选择，立即生效并自动保存。繁复卡牌增加纹饰、流派纹章与效果标记。</p>
        </div>
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
