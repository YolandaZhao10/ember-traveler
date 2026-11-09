import { useEffect } from 'react';
import { CARDS } from '../../data/cards';
import { ENEMIES } from '../../data/enemies';
import { RELICS } from '../../data/relics';
import { CHARACTERS } from '../../data/characters';
import { CHAPTERS } from '../../data/chapters';
import { STATUSES } from '../../data/statuses';
import { enemyIntent, enemyMoveName } from '../../engine/combat';
import { calcBlock, calcDamage, describeCard } from '../../engine/cards';
import { scaleEnemyValue } from '../../engine/difficulty';
import { sortedDeck } from '../../engine/run';
import type { CardInstance, CombatDifficulty } from '../../engine/types';
import { closeOverlay, openOverlay, useGame, type Overlay } from '../store';
import { Card } from './Card';
import { CardCatalog } from './CardCatalog';
import { RelicCatalog } from './RelicCatalog';
import { GameMenu } from './GameMenu';
import { Help } from './Help';
import { JourneyHistory } from './JourneyHistory';
import { MapScreen } from '../screens/MapScreen';
import { Modal, StatusChips, intentText } from './Common';

export function Overlays() {
  const { overlay, run } = useGame();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (overlay && event.key === 'Escape') closeOverlay(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay]);
  if (!overlay) return null;
  if (overlay.kind === 'history') return <JourneyHistory />;
  if (overlay.kind === 'help') return <Help />;
  if (overlay.kind === 'catalog') return <CardCatalog initialCharacter={overlay.character} />;
  if (overlay.kind === 'relicCatalog') return <RelicCatalog />;
  if (overlay.kind === 'menu') return <GameMenu character={overlay.character} />;
  if (!run) return null;
  return <OverlayBody overlay={overlay} />;
}

function OverlayBody({ overlay }: { overlay: Overlay }) {
  const { run } = useGame();
  if (!run) return null;
  switch (overlay.kind) {
    case 'history': return null;
    case 'help': return null;
    case 'map':
      return <Modal title="旅途地图" onClose={closeOverlay} wide><MapScreen preview /></Modal>;
    case 'pile': {
      const cs = run.combat;
      let cards: CardInstance[] = [];
      let title = '';
      if (overlay.pile === 'deck') {
        cards = sortedDeck(run.deck);
        title = `牌组（${cards.length} 张）`;
      } else if (cs) {
        const raw = overlay.pile === 'draw' ? cs.player.draw : overlay.pile === 'discard' ? cs.player.discard : cs.player.exhaust;
        cards = overlay.pile === 'draw' ? sortedDeck(raw) : raw.slice().reverse();
        title = `${{ draw: '抽牌堆（顺序已打乱显示）', discard: '弃牌堆', exhaust: '消耗区' }[overlay.pile]}（${cards.length} 张）`;
      }
      return (
        <Modal title={title} onClose={closeOverlay} wide>
          <div className="cardgrid">
            {cards.length === 0 && <p className="subtitle">空</p>}
            {cards.map((c) => (
              <div className="cardwrap" key={c.uid}>
                <Card card={c} size="sm" onClick={() => void 0} />
              </div>
            ))}
          </div>
        </Modal>
      );
    }
    case 'card':
      return (
        <Modal title="卡牌详情" onClose={closeOverlay}>
          <div className="detail">
            <Card card={overlay.card} size="lg" showFlavor />
            <div className="info">
              <p>点击卡牌外区域关闭。</p>
              <p>升级后的版本：</p>
              {!overlay.card.upgraded && <Card card={{ ...overlay.card, upgraded: true }} size="sm" showFlavor />}
              {overlay.card.upgraded && <p className="subtitle">（已升级）</p>}
            </div>
          </div>
        </Modal>
      );
    case 'status': {
      const def = STATUSES[overlay.status];
      return (
        <Modal title={`${def.name} · ${overlay.ownerName}`} onClose={closeOverlay}>
          <p>{def.description(overlay.amount)}</p>
          {overlay.detail && <p>{overlay.detail}</p>}
          <p className="subtitle">
            {def.kind === 'debuff' ? '负面状态' : def.kind === 'buff' ? '增益状态' : '持续能力'}
            {def.decays ? '，拥有者回合结束时层数 -1。' : '。'}
          </p>
        </Modal>
      );
    }
    case 'relic': {
      const r = RELICS[overlay.relicId];
      return (
        <Modal title={`${r.icon} ${r.name}`} onClose={closeOverlay}>
          <p>{r.description}</p>
          <p className="subtitle">{{ starter: '初始遗物', common: '普通', uncommon: '罕见', rare: '稀有' }[r.rarity]}</p>
          {r.owner && <p className="relic-owner">{CHARACTERS[r.owner].name}专属</p>}
          {r.chapter && <p className="relic-owner">{CHAPTERS[r.chapter].label}首领奖励</p>}
        </Modal>
      );
    }
    case 'log': {
      const lines = run.combat?.log ?? [];
      return (
        <Modal title="战斗记录" onClose={closeOverlay}>
          <div className="loglist">
            {lines.map((l, i) => (
              <div key={i} className={l.startsWith('——') ? 'turn' : ''}>
                {l}
              </div>
            ))}
          </div>
        </Modal>
      );
    }
    case 'enemy': {
      const cs = run.combat;
      const e = cs?.enemies.find((x) => x.id === overlay.enemyId);
      if (!cs || !e) return null;
      const def = ENEMIES[e.defId];
      const intent = enemyIntent(cs, e);
      const it = intentText(intent);
      const move = def.moves.find((m) => m.id === e.moveId);
      return (
        <Modal title={e.name} onClose={closeOverlay}>
          <p>{def.description}</p>
          {(e.flags.stolenGold ?? 0) > 0 && <p>已偷走 <b>{e.flags.stolenGold}</b> 金币，击败它后全额返还。</p>}
          {cs.difficulty && <p className="subtitle">第 {cs.difficulty.floor} 层 · {cs.tier === 'elite' ? '精英额外强化' : cs.tier === 'boss' ? '首领强化' : '逐层强化'}<br />生命 ×{cs.difficulty.healthMultiplier.toFixed(2)} · 攻击 ×{cs.difficulty.attackMultiplier.toFixed(2)} · 格挡 ×{cs.difficulty.blockMultiplier.toFixed(2)}</p>}
          <p>
            <b>下一步：</b>
            {move ? `「${enemyMoveName(e)}」` : '—'} <span className={`intent ${it.cls}`}>{it.icon} {it.text}</span>
          </p>
          {move && (
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-dim)', fontSize: 13 }}>
              {move.actions.map((a, i) => (
                <li key={i}>{describeAction(a, e.statuses, cs.player.statuses, cs.difficulty)}</li>
              ))}
            </ul>
          )}
          <StatusChips statuses={e.statuses} ownerName={e.name} />
        </Modal>
      );
    }
    case 'pick': {
      const cards = sortedDeck(run.deck);
      return (
        <Modal title={overlay.title} onClose={overlay.onCancel ?? closeOverlay} wide>
          <div className="cardgrid">
            {cards.map((c) => {
              const ok = overlay.filter(c);
              return (
                <div className={`cardwrap ${ok ? '' : 'disabled'}`} key={c.uid}>
                  <Card card={c} size="sm" onClick={() => {
                    if (!ok) return;
                    if (overlay.previewUpgrade) openOverlay({ kind: 'upgrade', card: c, onConfirm: () => overlay.onPick(c.uid), onBack: () => openOverlay(overlay) });
                    else overlay.onPick(c.uid);
                  }} />
                </div>
              );
            })}
          </div>
        </Modal>
      );
    }
    case 'upgrade':
      return <Modal title="确认升级" onClose={closeOverlay} wide>
        <p className="subtitle">确认后才会升级这张牌。</p>
        <div className="upgrade-comparison">
          <div><h4>升级前</h4><Card card={overlay.card} presentation /></div>
          <span className="upgrade-arrow" aria-hidden="true">→</span>
          <div><h4>升级后</h4><Card card={{ ...overlay.card, upgraded: true }} presentation /></div>
        </div>
        <div className="upgrade-actions">
          <button className="btn ghost" onClick={closeOverlay}>取消</button>
          <button className="btn" onClick={overlay.onBack}>重新选择</button>
          <button className="btn primary" onClick={overlay.onConfirm}>确认升级</button>
        </div>
      </Modal>;
    case 'confirm':
      return (
        <Modal title={overlay.title} onClose={closeOverlay}>
          <p>{overlay.text}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={closeOverlay}>
              取消
            </button>
            <button
              className="btn danger"
              onClick={() => {
                closeOverlay();
                overlay.onYes();
              }}
            >
              确定
            </button>
          </div>
        </Modal>
      );
  }
}

function describeAction(a: import('../../engine/types').EnemyAction, self: import('../../engine/types').Statuses, player: import('../../engine/types').Statuses, difficulty?: CombatDifficulty): string {
  switch (a.kind) {
    case 'attack':
      return `攻击：${calcDamage(scaleEnemyValue(a.amount, difficulty?.attackMultiplier), self, player)} 点伤害${a.times && a.times > 1 ? ` × ${a.times}` : ''}`;
    case 'block':
      return `获得 ${calcBlock(scaleEnemyValue(a.amount, difficulty?.blockMultiplier), self)} 点格挡`;
    case 'status':
      return `${a.target === 'player' ? '对你' : a.target === 'self' ? '自身' : '全体同伴'}施加 ${a.amount} 层${STATUSES[a.status].name}`;
    case 'heal':
      return `回复 ${a.amount} 点生命`;
    case 'loseHp':
      return `失去 ${a.amount} 点生命`;
    case 'stealGold':
      return `偷走最多 ${a.amount} 金币（击败它后返还）`;
    case 'addCardToDiscard':
      return `向弃牌堆塞入 ${a.count} 张「${CARDS[a.cardId].name}」（仅本场战斗）：${describeCard({ uid: 'intent', defId: a.cardId, upgraded: false }, null)}`;
    case 'clearDebuffs':
      return '清除自身所有负面状态';
  }
}
