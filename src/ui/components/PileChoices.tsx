import { useEffect, useRef, useState } from 'react';
import { viewCard } from '../../engine/cards';
import type { CardInstance } from '../../engine/types';
import { Card } from './Card';

const PAGE_SIZE = 10;

/** 快捷键只作用于当前选牌窗口，不传到战斗手牌或结束回合。 */
export function PileChoices({ cards, selectedUid, onPick, onConfirm, onCancel, canConfirm, busy }: {
  cards: CardInstance[];
  selectedUid: string | null;
  onPick: (uid: string | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  canConfirm: boolean;
  busy: boolean;
}) {
  const [requestedPage, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount - 1);
  const shown = cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedButton = useRef<HTMLButtonElement>(null);
  const turnPage = (next: number) => {
    if (next < 0 || next >= pageCount || next === page) return;
    setPage(next);
    onPick(null);
  };
  useEffect(() => {
    selectedButton.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedUid, page]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return;
      const digit = /^[0-9]$/.test(event.key);
      const paging = pageCount > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight');
      if (!digit && !paging && event.key !== 'Enter' && event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || busy) return;
      if (event.key === 'Escape') onCancel();
      else if (event.key === 'Enter') { if (canConfirm) onConfirm(); }
      else if (paging) turnPage(page + (event.key === 'ArrowRight' ? 1 : -1));
      else {
        const index = event.key === '0' ? 9 : Number(event.key) - 1;
        if (shown[index]) onPick(shown[index].uid);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [shown, page, pageCount, busy, canConfirm, onPick, onConfirm, onCancel]);
  return <>
    <p className="pile-choice-help"><kbd>1–9</kbd> / <kbd>0</kbd> 选择本页卡牌 · <kbd>Enter</kbd> 确认 · <kbd>Esc</kbd> 取消</p>
    {pageCount > 1 && <div className="pile-choice-pages" aria-label="候选牌翻页">
      <button className="btn small ghost" disabled={busy || page === 0} onClick={() => turnPage(page - 1)}>← 上一页</button>
      <span>第 {page + 1} / {pageCount} 页 · 共 {cards.length} 张 · ← → 翻页</span>
      <button className="btn small ghost" disabled={busy || page === pageCount - 1} onClick={() => turnPage(page + 1)}>下一页 →</button>
    </div>}
    <div className="replay-choices cardgrid">
      {shown.map((card, index) => <button ref={card.uid === selectedUid ? selectedButton : undefined}
        className={`replay-choice ${card.uid === selectedUid ? 'selected' : ''}`} key={card.uid}
        aria-label={`选择${viewCard(card).name}`} aria-pressed={card.uid === selectedUid} aria-keyshortcuts={index === 9 ? '0' : String(index + 1)}
        disabled={busy} onClick={() => onPick(card.uid)}>
        <kbd className="pile-choice-key" aria-hidden="true">{index === 9 ? '0' : index + 1}</kbd>
        <Card card={card} size="sm" presentation />
      </button>)}
      {!cards.length && <p>牌堆中没有符合条件的牌。</p>}
    </div>
  </>;
}
