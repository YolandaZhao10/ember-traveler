import { RELICS } from '../../data/relics';
import { STATUSES } from '../../data/statuses';
import { statusEntries } from '../../engine/combat';
import type { Intent, PowerInstance, Statuses } from '../../engine/types';
import { openOverlay } from '../store';

export function StatusChips({ statuses, ownerName, powers = [] }: { statuses: Statuses; ownerName: string; powers?: PowerInstance[] }) {
  const entries = statusEntries(statuses).filter(({ id }) => !powers.some(p => p.status === id));
  return (
    <div className="statuses">
      {powers.map((power, index) => {
        const progress = power.status === 'tempo' ? `${power.progress}/3` : power.status === 'mirror' ? power.progress ? '已触发' : '待触发' : '';
        const name = `${STATUSES[power.status].name}${power.status === 'tempo' && power.amount > 1 ? '+' : ''}`;
        return <button key={`power-${index}`} className="chip power" title={`${name}：${STATUSES[power.status].description(power.amount)} ${progress}`} onClick={e => {
          e.stopPropagation(); openOverlay({ kind: 'status', status: power.status, amount: power.amount, ownerName, detail: progress ? `这张${name}的进度：${progress}` : undefined });
        }}>{name}<b>{progress || `#${index + 1}`}</b></button>;
      })}
      {entries.map(({ id, amount }) => {
        const def = STATUSES[id];
        return (
          <button
            key={id}
            className={`chip ${def.kind}`}
            onClick={(e) => {
              e.stopPropagation();
              openOverlay({ kind: 'status', status: id, amount, ownerName });
            }}
            title={def.description(amount)}
          >
            {def.name}
            {def.id !== 'barricade' && <b>{amount}</b>}
          </button>
        );
      })}
    </div>
  );
}

export function intentText(intent: Intent | null): { icon: string; text: string; cls: string } {
  if (!intent) return { icon: '…', text: '', cls: 'special' };
  switch (intent.kind) {
    case 'attack':
      return { icon: '⚔', text: `${intent.piercing ? '穿透 ' : ''}${intent.times > 1 ? `${intent.amount} × ${intent.times}` : `${intent.amount}`}`, cls: 'attack' };
    case 'attack_debuff':
      return { icon: '⚔✦', text: `${intent.piercing ? '穿透 ' : ''}${intent.times > 1 ? `${intent.amount} × ${intent.times}` : `${intent.amount}`}`, cls: 'attack' };
    case 'defend':
      return { icon: '🛡', text: '防御', cls: 'defend' };
    case 'buff':
      return { icon: '▲', text: '强化', cls: 'buff' };
    case 'debuff':
      return { icon: '▼', text: '削弱', cls: 'debuff' };
    case 'defend_buff':
      return { icon: '🛡▲', text: '防御+强化', cls: 'defend' };
    case 'special':
      return { icon: '✦', text: '特殊', cls: 'special' };
    case 'escape':
      return { icon: '➜', text: '逃跑', cls: 'escape' };
  }
}

export function RelicBar({ relics }: { relics: string[] }) {
  return (
    <div className="relicbar">
      {relics.map((id) => {
        const r = RELICS[id];
        if (!r) return null;
        return (
          <button key={id} className={`relic ${r.rarity}`} title={`${r.name}：${r.description}`} onClick={() => openOverlay({ kind: 'relic', relicId: id })}>
            {r.icon}
          </button>
        );
      })}
    </div>
  );
}

export function HpBar({ hp, maxHp, block }: { hp: number; maxHp: number; block: number }) {
  return (
    <div className={`hpbar ${block > 0 ? 'has-block' : ''}`}>
      <div className="hpbar-track"><div className="fill" style={{ width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%` }} /></div>
      <div className="txt">
        {hp} / {maxHp}
      </div>
      {block > 0 && <div className="blockbadge" title={`格挡 ${block}，上限 9999`} aria-label={`格挡 ${block}`}>{block}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose?: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={`modal panel grain ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{title}</h3>
          {onClose && (
            <button className="iconbtn" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
