import { formatJourneyTime } from './journeyClock';
import { nodeTypeName } from '../engine/map';
import { CHAPTERS } from '../data/chapters';
import { ChapterScreen } from './screens/ChapterScreen';
import { RelicBar } from './components/Common';
import { Overlays } from './components/Overlays';
import { CombatScreen } from './screens/CombatScreen';
import { EndScreen } from './screens/EndScreen';
import { EventScreen } from './screens/EventScreen';
import { MapScreen } from './screens/MapScreen';
import { RestScreen } from './screens/RestScreen';
import { RewardScreen } from './screens/RewardScreen';
import { ShopScreen } from './screens/ShopScreen';
import { TitleScreen } from './screens/TitleScreen';
import { openOverlay, toggleSound, useGame } from './store';

export function App() {
  const { run, showTitle, toast, settings, busy } = useGame();
  const screen = showTitle || !run ? 'title' : run.screen;
  return (
    <div className={`app chapter-${screen === 'title' ? 1 : run?.chapter ?? 1}`}>
      {screen !== 'title' && run && (
        <header className="topbar">
          <span className="brand">余烬旅人</span>
          <span className="stat hp" title="生命值跨战斗保留">
            ❤ {run.hp}/{run.maxHp}
          </span>
          <span className="stat gold">🪙 {run.gold}</span>
          <span className="stat floor">
            <span className="chapter-badge" title={CHAPTERS[run.chapter].name}>{CHAPTERS[run.chapter].label}</span> 第 {run.floor + 1} 层{run.currentNodeId ? ` · ${nodeTypeName(run.map.nodes[run.currentNodeId].type)}` : ''}
          </span>
          <span className="stat journey-time" title="本局前台游玩用时；首页、后台与结算暂停，快速 SL 不回退">用时 {formatJourneyTime(run.elapsedMs)}</span>
          <RelicBar relics={run.relics} />
          <span className="spacer" />
          <button className="iconbtn" onClick={() => openOverlay({ kind: 'map' })} title="查看当前位置和路线">地图</button>
          <button className="iconbtn" onClick={() => openOverlay({ kind: 'pile', pile: 'deck' })}>
            牌组 {run.deck.length}
          </button>
          {run.combat && (
            <button className="iconbtn" onClick={() => openOverlay({ kind: 'log' })}>
              记录
            </button>
          )}
          <button className={`iconbtn ${settings.sound ? 'active' : ''}`} onClick={toggleSound} title="音效开关">
            {settings.sound ? '🔊' : '🔇'}
          </button>
          <button className="iconbtn" disabled={busy} onClick={() => openOverlay({ kind: 'menu' })} title="菜单">
            ☰
          </button>
        </header>
      )}
      {screen === 'title' && <TitleScreen />}
      {screen === 'map' && <MapScreen />}
      {screen === 'combat' && <CombatScreen />}
      {screen === 'reward' && <RewardScreen />}
      {screen === 'event' && <EventScreen />}
      {screen === 'shop' && <ShopScreen />}
      {screen === 'rest' && <RestScreen />}
      {screen === 'chapter' && <ChapterScreen />}
      {screen === 'gameover' && <EndScreen victory={false} />}
      {screen === 'victory' && <EndScreen victory />}
      <Overlays />
      {toast && screen !== 'combat' && <div className="toast">{toast}</div>}
      {toast && screen === 'combat' && <div className="toast" style={{ top: 110 }}>{toast}</div>}
    </div>
  );
}
