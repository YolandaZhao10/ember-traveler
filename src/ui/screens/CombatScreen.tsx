import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { CHARACTERS } from '../../data/characters';
import { CHAPTERS } from '../../data/chapters';
import { ENEMIES } from '../../data/enemies';
import { viewCard, type DescribeContext } from '../../engine/cards';
import { EMBER_MAX, aliveEnemies, canPlayCard, enemyIntent, needsTarget } from '../../engine/combat';
import type { CardInstance, CombatState, EnemyState } from '../../engine/types';
import { Card } from '../components/Card';
import { HpBar, StatusChips, intentText } from '../components/Common';
import { Backdrop, EnemyArt, PlayerArt } from '../components/Art';
import { ImpactEffects, SwingArc } from '../components/CombatEffects';
import { TargetingArrow } from '../components/TargetingArrow';
import { useCardAim } from '../useCardAim';
import type { ImpactItem } from '../combatFx';
import { closeOverlay, endTurn, openOverlay, playSelected, selectCard, selectCardByIndex, useGame, type FxItem } from '../store';

export function CombatScreen() {
  const { run, busy, selectedCard, fx, impacts, playing, attacking, banner: bannerText, overlay, settings } = useGame();
  const cs = run?.combat;
  const root = useRef<HTMLDivElement>(null);
  const { aim, dragging, onCardPointerDown, onClickCapture, onContextMenuCapture } = useCardAim(root);
  const field = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hits = impacts.filter((hit) => hit.kind === 'strike');
    if (!hits.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const distance = hits.some((hit) => hit.heavy) ? 5 : 3;
    const animation = field.current?.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${-distance}px, 2px)` },
      { transform: `translate(${distance}px, -1px)` },
      { transform: 'translate(-1px, 0)' },
      { transform: 'translate(0, 0)' },
    ], { duration: settings.fastAnim ? 130 : 210, easing: 'ease-out' });
    return () => animation?.cancel();
  }, [impacts, settings.fastAnim]);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement) return;
      if (ev.key === 'Escape') {
        if (overlay) closeOverlay();
        else selectCard(null);
        return;
      }
      if (overlay) return;
      // 聚焦按钮时 Enter 交给按钮自身，避免快速 SL / 图鉴同时触发结束回合。
      if (ev.key === 'Enter' && ev.target instanceof Element && ev.target.closest('button, [role="button"]')) return;
      if (ev.key === 'e' || ev.key === 'E' || ev.key === 'Enter') {
        void endTurn();
        return;
      }
      if (/^[1-9]$/.test(ev.key)) selectCardByIndex(Number(ev.key) - 1);
      if (ev.key === '0') selectCardByIndex(9);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay]);
  if (!run || !cs) return null;
  const p = cs.player;
  const selected = selectedCard ? p.hand.find((c) => c.uid === selectedCard) ?? null : null;
  const targeting = !!selected && needsTarget(selected);
  const alive = aliveEnemies(cs);
  const singleTarget = alive.length === 1 ? alive[0] : null;

  const ctxFor = (card: CardInstance, target: EnemyState | null): DescribeContext => {
    const v = viewCard(card);
    return {
      player: p,
      target,
      relics: cs.relics,
      isFirstAttack: v.type === 'attack' && p.attacksPlayedThisTurn === 0,
      crescendoBonus: v.type === 'attack' ? p.attacksPlayedThisTurn * (p.statuses.crescendo ?? 0) : 0,
    };
  };

  const onEnemyClick = (e: EnemyState) => {
    if (busy || e.hp <= 0) return;
    if (targeting) void playSelected(e.id);
    else openOverlay({ kind: 'enemy', enemyId: e.id });
  };

  const onCardClick = (c: CardInstance) => {
    if (busy) return;
    const check = canPlayCard(cs, c);
    if (selectedCard === c.uid) {
      // 单体牌始终明确指向敌人，重复点牌只取消瞄准。
      if (!check.ok) return selectCard(null);
      if (!needsTarget(c)) void playSelected(null);
      else selectCard(null);
      return;
    }
    if (!check.ok) {
      selectCard(null);
      openOverlay({ kind: 'card', card: c, inCombat: true });
      return;
    }
    selectCard(c.uid);
  };

  return (
    <div ref={root} className={`screen combat ${settings.fastAnim ? 'fast-animations' : ''} ${aim ? 'aiming' : ''}`} onClickCapture={onClickCapture} onContextMenuCapture={onContextMenuCapture} onDragStartCapture={(event) => event.preventDefault()}>
      <div ref={field} className={`battlefield grain ${dragging && aim?.ready && !targeting ? 'drop-ready' : ''}`} style={{ '--enemy-count': cs.enemies.length } as CSSProperties} onClick={() => {
        if (!busy && selectedCard) { if (targeting) selectCard(null); else void playSelected(null); }
      }}>
        <Backdrop id={cs.tier === 'boss' ? CHAPTERS[run.chapter].bossArt : CHAPTERS[run.chapter].battleArt} dim={1} />
        <div className="ground" />
        {/* 玩家 */}
        <div className="side" onClick={(e) => e.stopPropagation()}>
          <div data-entity-id="player" className={`entity player-entity ${attacking === 'player' ? 'acting' : ''} ${aim?.ready && aim.mode === 'self' ? 'aimed' : ''}`}>
            <FxLayer fx={fx} targetId="player" />
            <CombatFigure impacts={impacts.filter((hit) => hit.targetId === 'player')} attacking={attacking === 'player'}>
              <PlayerArt kind={CHARACTERS[run.character].sprite} className="sprite player" />
            </CombatFigure>
            <div className="ename">{CHARACTERS[run.character].name}</div>
            <HpBar hp={p.hp} maxHp={p.maxHp} block={p.block} />
            <StatusChips statuses={p.statuses} powers={p.powerInstances} ownerName={CHARACTERS[run.character].name} />
          </div>
          <div className="player-hud">
            <div className="orb energy" title="能量：每回合恢复">
              {p.energy}
              <span className="lbl">能量 / {p.maxEnergy}</span>
            </div>
            <EmberMeter value={p.ember} />
          </div>
        </div>
        {/* 敌人 */}
        <div className="enemies">
          {cs.enemies.map((e) => (
            <EnemyView key={e.id} e={e} cs={cs} targetable={targeting && e.hp > 0} aimed={!!aim?.ready && e.hp > 0 && (aim.mode === 'all_enemies' || (aim.mode === 'enemy' && aim.targetId === e.id))} acting={attacking === e.id} impacts={impacts.filter((hit) => hit.targetId === e.id)} fx={fx} onClick={() => onEnemyClick(e)} />
          ))}
        </div>
        {bannerText && <div className="banner">{bannerText}</div>}
        <div className="minilog" onClick={(e) => { e.stopPropagation(); openOverlay({ kind: 'log' }); }} title="点击查看完整战斗记录">
          {cs.log.slice(-3).map((l, i) => (
            <div key={cs.log.length - 3 + i}>{l}</div>
          ))}
        </div>
      </div>

      {/* 手牌区 */}
      <div className="handarea">
        <div className="pilecol">
          <button className="pilebtn" onClick={() => openOverlay({ kind: 'pile', pile: 'draw' })} aria-label="抽牌堆">
            <b>{p.draw.length}</b>抽牌堆
          </button>
          <div className="hand-shortcuts" aria-label="出牌快捷键提示">
            <span><kbd>1–9</kbd> / <kbd>0</kbd> 选牌</span>
            <span>有目标：点敌人<br />无目标：点打出</span>
            <span><kbd>Esc</kbd> 取消选牌</span>
          </div>
        </div>
        <Hand
          hand={p.hand}
          energy={p.energy}
          cs={cs}
          selected={selectedCard}
          playing={playing}
          busy={busy}
          dragging={dragging}
          onCardPointerDown={onCardPointerDown}
          onCardClick={onCardClick}
          ctxFor={(c) => ctxFor(c, singleTarget ?? (alive[0] ?? null))}
          onDetail={(c) => openOverlay({ kind: 'card', card: c, inCombat: true })}
        />
        <div className="pilecol">
          <button className="btn primary endturn" onClick={() => void endTurn()} disabled={busy || cs.phase !== 'player'} aria-label={busy ? '处理中' : '结束回合'} title="E 结束回合；Enter 未聚焦其他按钮时也可结束回合">
            <span>{busy ? '…' : '结束回合'}</span>
            <kbd className="endturn-shortcut" aria-hidden="true">E</kbd>
          </button>
          <button className="pilebtn" onClick={() => openOverlay({ kind: 'pile', pile: 'discard' })} aria-label="弃牌堆">
            <b>{p.discard.length}</b>弃牌堆
          </button>
          {p.exhaust.length > 0 && (
            <button className="iconbtn" onClick={() => openOverlay({ kind: 'pile', pile: 'exhaust' })}>
              消耗 {p.exhaust.length}
            </button>
          )}
        </div>
      </div>
      {aim && <TargetingArrow aim={aim} />}
      {selected && !targeting && !dragging && !overlay && (
        <div className="toast" style={{ top: 'auto', bottom: 'calc(var(--hand-h) + 8px)', pointerEvents: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{viewCard(selected).name}</span>
          <button className="btn small primary" onClick={() => void playSelected(null)}>
            打出
          </button>
          <button className="btn small ghost" onClick={() => openOverlay({ kind: 'card', card: selected, inCombat: true })}>
            详情
          </button>
          <button className="btn small ghost" onClick={() => selectCard(null)}>
            取消
          </button>
        </div>
      )}
    </div>
  );
}

function CombatFigure({ impacts, attacking, children, defeated = false }: { impacts: ImpactItem[]; attacking: boolean; children: ReactNode; defeated?: boolean }) {
  const reaction = impacts.find((hit) => hit.kind !== 'guard');
  return (
    <div className="combat-figure">
      <div key={defeated ? 'defeated' : reaction?.id ?? 'idle'} className={`sprite-motion ${reaction ? 'hurt' : ''}`}>
        {children}
      </div>
      {attacking && <SwingArc />}
      <ImpactEffects impacts={impacts} />
    </div>
  );
}

function FxLayer({ fx, targetId }: { fx: FxItem[]; targetId: string }) {
  const mine = fx.filter((f) => f.targetId === targetId);
  return (
    <div className="fxlayer">
      {mine.map((f, i) => (
        <div key={f.id} className={`fx ${f.kind}`} style={{ top: `${20 + (i % 3) * 14}%`, left: `${50 + ((i % 2) * 2 - 1) * 10}%`, animationDelay: `${f.delayMs ?? 0}ms` }}>
          {f.text}
        </div>
      ))}
    </div>
  );
}

function EnemyView({ e, cs, targetable, aimed, acting, impacts, fx, onClick }: { e: EnemyState; cs: CombatState; targetable: boolean; aimed: boolean; acting: boolean; impacts: ImpactItem[]; fx: FxItem[]; onClick: () => void }) {
  const def = ENEMIES[e.defId];
  const intent = cs ? enemyIntent(cs, e) : null;
  const it = intentText(intent);
  const dead = e.hp <= 0;
  return (
    <div data-entity-id={e.id} className={`entity ${targetable ? 'targetable' : ''} ${aimed ? 'aimed' : ''} ${dead ? 'dead' : ''} ${acting ? 'acting' : ''}`} onClick={(ev) => { ev.stopPropagation(); onClick(); }} role="button" aria-disabled={dead || undefined} aria-label={`${e.name}，生命 ${e.hp}/${e.maxHp}`}>
      <FxLayer fx={fx} targetId={e.id} />
      {!dead && (
        <div className={`intent ${it.cls}`} title="点击查看敌人详情">
          <span>{it.icon}</span>
          <span>{it.text}</span>
          {intent && (intent.kind === 'attack' || intent.kind === 'attack_debuff') && <span className="movename">{def.moves.find((m) => m.id === e.moveId)?.name}</span>}
        </div>
      )}
      <CombatFigure impacts={impacts} attacking={acting} defeated={dead}>
        <EnemyArt kind={def.sprite} className="sprite" />
      </CombatFigure>
      <div className="ename">{e.name}</div>
      <HpBar hp={e.hp} maxHp={e.maxHp} block={e.block} />
      <StatusChips statuses={e.statuses} ownerName={e.name} />
    </div>
  );
}

function EmberMeter({ value }: { value: number }) {
  return (
    <div className="embermeter" onClick={() => openOverlay({ kind: 'status', status: 'emberHeart', amount: value, ownerName: '余烬资源' })} title="余烬：0–10，战斗内跨回合保留，战斗结束清空">
      <div className="cells">
        {Array.from({ length: EMBER_MAX }).map((_, i) => (
          <div key={i} className={`cell ${i < value ? 'on' : ''}`} />
        ))}
      </div>
      <div className="lbl">余烬 {value}/{EMBER_MAX}</div>
    </div>
  );
}

function Hand(props: {
  hand: CardInstance[];
  energy: number;
  cs: CombatState;
  selected: string | null;
  playing: string | null;
  busy: boolean;
  dragging: string | null;
  onCardPointerDown: (event: PointerEvent<HTMLDivElement>, card: CardInstance) => void;
  onCardClick: (c: CardInstance) => void;
  ctxFor: (c: CardInstance) => DescribeContext;
  onDetail: (c: CardInstance) => void;
}) {
  const { hand, energy, cs, selected, playing, busy, dragging, onCardPointerDown, onCardClick, ctxFor, onDetail } = props;
  const prev = useRef<Set<string>>(new Set());
  const [entering, setEntering] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fresh = new Set(hand.filter((c) => !prev.current.has(c.uid)).map((c) => c.uid));
    prev.current = new Set(hand.map((c) => c.uid));
    if (fresh.size) {
      setEntering(fresh);
      const t = setTimeout(() => setEntering(new Set()), 350);
      return () => clearTimeout(t);
    }
  }, [hand]);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div className="hand">
      {hand.map((c, index) => {
        const ok = cs ? canPlayCard(cs, c).ok : false;
        return (
          <div
            key={c.uid}
            data-card-uid={c.uid}
            className={`cardwrap ${ok && !busy ? 'draggable' : ''} ${dragging === c.uid ? 'dragging' : ''} ${selected === c.uid ? 'selected' : ''} ${playing === c.uid ? 'playing' : ''} ${entering.has(c.uid) ? 'entering' : ''}`}
            onPointerDown={(event) => onCardPointerDown(event, c)}
            onContextMenu={(e) => {
              e.preventDefault();
              onDetail(c);
            }}
            onTouchStart={() => {
              longPress.current = setTimeout(() => onDetail(c), 500);
            }}
            onTouchEnd={() => longPress.current && clearTimeout(longPress.current)}
            onTouchMove={() => longPress.current && clearTimeout(longPress.current)}
          >
            <kbd className="hand-shortcut-key" aria-hidden="true">{(index + 1) % 10}</kbd>
            <Card card={c} ctx={ctxFor(c)} energy={energy} unplayable={!ok || busy} onClick={() => onCardClick(c)} />
          </div>
        );
      })}
      {hand.length === 0 && <div className="subtitle">手牌为空</div>}
    </div>
  );
}
