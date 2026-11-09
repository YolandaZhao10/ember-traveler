import { Backdrop } from '../components/Art';
import { CHAPTERS } from '../../data/chapters';
import { EVENTS } from '../../data/events';
import { canUpgrade, eventChoiceUnavailableReason, eventRelicChoiceNote, eventRelicPreviews, eventCursePreviews } from '../../engine/run';
import { eventChoose, eventLeave, eventPick, openOverlay, useGame } from '../store';

export function EventScreen() {
  const { run } = useGame();
  const ev = run?.event;
  if (!run || !ev) return null;
  const def = EVENTS[ev.eventId];
  const openPick = () => {
    const upgrade = ev.pendingPick === 'upgrade';
    openOverlay({
      kind: 'pick',
      title: upgrade ? '选择要升级的牌' : '选择要移除的牌',
      filter: (c) => (upgrade ? canUpgrade(c) : true),
      onPick: eventPick,
      previewUpgrade: upgrade,
      onCancel: () => void 0,
    });
  };
  return (
    <div className="screen center-screen grain scroll">
      <Backdrop id={CHAPTERS[run.chapter].eventArt} dim={0.62} />
      <div className="eventcard parchment grain">
        <div className="icon">{def.icon}</div>
        <h2 style={{ textAlign: 'center' }}>{def.title}</h2>
        <p>{def.text}</p>
        {ev.resolvedText === null ? (
          <div className="choices">
            {def.choices.map((c) => {
              const reason = eventChoiceUnavailableReason(run, c.id);
              const note = eventRelicChoiceNote(run, c.id);
              return (
                <button key={c.id} className="choice" disabled={!!reason} onClick={() => eventChoose(c.id)}>
                  <b>{c.label}</b>
                  <span>
                    {c.detail}
                    {note && ` ${note}`}
                    {reason && `（${reason}）`}
                  </span>
                  {eventRelicPreviews(run, c.id).map((relic, index) => <span className="event-relic-preview" key={index}>
                    <strong>{relic.icon} {relic.name}<small>{relic.probability < 1 ? `${Math.round(relic.probability * 100)}% 概率获得` : '奖励详情'}</small></strong>
                    <span>{relic.description}</span>
                  </span>)}
                  {eventCursePreviews(run, c.id).map((curse, index) => <span className="event-relic-preview event-curse-preview" key={`curse-${index}`}>
                    <strong>诅咒 · {curse.name}<small>{curse.probability < 1 ? `${Number((curse.probability * 100).toFixed(2))}% 概率加入牌组` : '将加入牌组'}</small></strong>
                    <span>{curse.description}</span>
                  </span>)}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div className="resolved">{ev.resolvedText}</div>
            {ev.pendingPick ? (
              <button className="btn primary" onClick={openPick}>
                {ev.pendingPick === 'upgrade' ? '选择要升级的牌' : '选择要移除的牌'}
              </button>
            ) : (
              <button className="btn primary" onClick={() => eventLeave()}>
                继续前进
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
