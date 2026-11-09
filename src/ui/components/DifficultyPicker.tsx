import { useEffect, useState } from 'react';
import { DIFFICULTY_FIELDS, DIFFICULTY_PRESETS, difficultyName, difficultyPercent } from '../../data/difficulty';
import type { RunDifficulty } from '../../engine/types';
import { Modal } from './Common';

export function DifficultyPicker({ value, onChange, onClose }: { value: RunDifficulty; onChange: (v: RunDifficulty) => void; onClose: () => void }) {
  const [custom, setCustom] = useState(() => difficultyName(value) === '自定义');
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return <Modal title="新旅程难度" onClose={onClose} wide>
    <p className="subtitle">选择基础难度，或自定义各项强度。本局开始后固定，刷新和 SL 保持不变。</p>
    <div className="difficulty-presets">{DIFFICULTY_PRESETS.map(p => <button className="btn" key={p.name} aria-pressed={!custom && difficultyName(value) === p.name} onClick={() => { setCustom(false); onChange({ ...p.settings }); }}>{p.name}</button>)}
      <button className="btn" aria-pressed={custom} onClick={() => setCustom(true)}>自定义</button>
    </div>
    <div className="difficulty-scroll">
      <div className="difficulty-grid">{DIFFICULTY_FIELDS.map(f => <label className="difficulty-field" key={f.key}>
        <span>{f.label}<output htmlFor={`difficulty-${f.key}`}>{difficultyPercent(f.key, value[f.key])}%</output></span>
        {custom && <><input id={`difficulty-${f.key}`} type="range" aria-label={f.label} min="50" max="200" step="1" value={difficultyPercent(f.key, value[f.key])} onChange={e => onChange({ ...value, [f.key]: Number(e.target.value) })} />
          <span className="range-labels"><small>50%</small><small>200%</small></span></>}
        <small>{f.help}</small>
      </label>)}</div>
    </div>
    <button className="btn primary" onClick={onClose}>完成设置</button>
  </Modal>;
}

export function DifficultySummary({ value }: { value: RunDifficulty }) {
  return <details className="difficulty-summary"><summary>本局难度：{difficultyName(value)}</summary>
    <dl>{DIFFICULTY_FIELDS.map(f => <div key={f.key}><dt>{f.label}</dt><dd>{difficultyPercent(f.key, value[f.key])}%</dd></div>)}</dl>
  </details>;
}
