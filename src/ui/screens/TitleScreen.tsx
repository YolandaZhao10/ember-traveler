import { useState } from 'react';
import { CHARACTER_LIST } from '../../data/characters';
import { RELICS } from '../../data/relics';
import { STANDARD_DIFFICULTY, difficultyName } from '../../data/difficulty';
import type { CharacterId, RunDifficulty } from '../../engine/types';
import { loadRun } from '../../engine/save';
import { Backdrop, PlayerArt } from '../components/Art';
import { DifficultyPicker } from '../components/DifficultyPicker';
import { FlameIcon } from '../sprites/Sprites';
import { continueGame, newGame, openOverlay, useGame } from '../store';

export function TitleScreen() {
  const { hasSave } = useGame();
  const [savedRun] = useState(() => loadRun());
  const [seed, setSeed] = useState('');
  const [confirmNew, setConfirmNew] = useState(false);
  const [character, setCharacter] = useState<CharacterId>('traveler');
  const [difficulty, setDifficulty] = useState<RunDifficulty>({ ...STANDARD_DIFFICULTY });
  const [showDifficulty, setShowDifficulty] = useState(false);
  const settled = savedRun?.screen === 'victory' || savedRun?.screen === 'gameover';
  return (
    <>
    <div className="screen title-screen grain scroll">
      <Backdrop id="bg_title" dim={0.6} />
      <button className="iconbtn title-menu" onClick={() => openOverlay({ kind: 'menu', character })}>☰ 菜单</button>
      <div className="title-brand">
        <FlameIcon className="flame" />
        <div>
        <h1>余烬旅人</h1>
        <div className="sub">EMBER TRAVELER · 灰烬古城 / 熔炉深城</div>
        </div>
      </div>
      <div className="charselect">
        {CHARACTER_LIST.map((c) => {
          const relic = RELICS[c.starterRelic];
          return (
            <button key={c.id} className={`charcard ${character === c.id ? 'selected' : ''}`} onClick={() => setCharacter(c.id)}>
              <PlayerArt kind={c.sprite} className="charsprite" />
              <div className="charinfo">
                <b>{c.name}</b>
                <span className="chartitle">{c.title}</span>
                <span className="chardesc">{c.description}</span>
                <span className="charrelic" title={relic.description}>
                  {relic.icon} {relic.name}：{relic.description}
                </span>
                <span className="charroutes">
                  {c.routes.map((r) => (
                    <em key={r.name} title={r.text}>
                      {r.name}
                    </em>
                  ))}
                  <small>生命 {c.maxHp}</small>
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="title-actions">
        <div className="title-primary-actions">
        {hasSave && (
          <button className="btn primary" onClick={continueGame}>
            {settled ? '查看本局结算' : '继续旅程'}{savedRun ? ` · 第 ${savedRun.chapter} 章 · 第 ${savedRun.floor + 1} 层` : ''}
          </button>
        )}
        <div className="new-run-actions">{hasSave && !confirmNew ? (
          <button className="btn" onClick={() => setConfirmNew(true)}>
            新的旅程（从第 1 层开始）
          </button>
        ) : (
          <button className={`btn ${hasSave && !settled ? 'danger' : 'primary'}`} onClick={() => newGame(seed, character, difficulty)}>
            {hasSave ? settled ? '结束本局，开始新旅程' : '放弃存档，开始新旅程' : '开始旅程'}
          </button>
        )}<button className="btn" onClick={() => setShowDifficulty(true)}>难度设置 · {difficultyName(difficulty)}</button></div>
        </div>
        {hasSave && savedRun && (
          <div className="subtitle">存档：{CHARACTER_LIST.find((c) => c.id === savedRun.character)?.name} · 生命 {savedRun.hp}/{savedRun.maxHp} · {difficultyName(savedRun.difficulty)}难度 · 种子 {savedRun.seed}{savedRun.screen === 'gameover' || savedRun.screen === 'victory' ? ' · 已结算，可快速 SL' : ''}</div>
        )}
        <div className="seedrow">
          <label htmlFor="seed">种子</label>
          <input id="seed" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="留空随机" maxLength={16} />
        </div>
      </div>
    </div>
    {showDifficulty && <DifficultyPicker value={difficulty} onChange={setDifficulty} onClose={() => setShowDifficulty(false)} />}
    </>
  );
}
