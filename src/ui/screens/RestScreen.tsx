import { Backdrop } from '../components/Art';
import { CHAPTERS } from '../../data/chapters';
import { canUpgrade, relicJourneyBonus, restHealAmount, restUpgradeHealAmount } from '../../engine/run';
import { Campfire } from '../sprites/Sprites';
import { visualPreferences } from '../../engine/save';
import { CampActionArt } from '../components/CampActionArt';
import { openOverlay, restHeal, restLeave, restRefine, restUpgrade, useGame } from '../store';

export function RestScreen() {
  const { run, settings } = useGame();
  const detailed = visualPreferences(settings).backgrounds === 'detailed';
  const r = run?.rest;
  if (!run || !r) return null;
  const healAmt = restHealAmount(run);
  const upgradable = run.deck.some(canUpgrade);
  const extras = (trigger: 'rest' | 'upgrade') => {
    const health = relicJourneyBonus(run, trigger, 'maxHp');
    const gold = relicJourneyBonus(run, trigger, 'gold');
    return `${health ? `，最大生命 +${health}` : ''}${gold ? `，金币 +${gold}` : ''}`;
  };
  const upgradeHeal = restUpgradeHealAmount(run);
  return (
    <div className={`screen center-screen grain scroll rest-screen${detailed ? ' camp-detailed' : ''}`}>
      <Backdrop id={CHAPTERS[run.chapter].restArt} dim={0.62} />
      <div className="camp-hearth"><Campfire className="campfire" /></div>
      <h2>营火</h2>
      <p className="subtitle">火光下，灰烬暂时安静。你可以做一件事。</p>
      <div className="restopts">
        <button className="restopt" disabled={r.used} onClick={() => restHeal()}>
          {detailed ? <CampActionArt kind="rest" /> : <span className="big" aria-hidden="true">🛌</span>}
          <b>休息</b>
          <span>回复生命 +{healAmt}（含遗物加成）{extras('rest')}</span>
        </button>
        <button
          className="restopt"
          disabled={r.used || !upgradable}
          onClick={() =>
            openOverlay({
              kind: 'pick',
              title: '选择要升级的牌',
              filter: canUpgrade,
              onPick: restUpgrade,
              previewUpgrade: true,
            })
          }
        >
          {detailed ? <CampActionArt kind="forge" /> : <span className="big" aria-hidden="true">⚒️</span>}
          <b>锻造</b>
          <span>升级一张牌{upgradeHeal ? `，回复 ${upgradeHeal} 点生命` : ''}{extras('upgrade')}</span>
        </button>
        <button
          className="restopt"
          disabled={r.used || run.campRefined || run.deck.length <= 1}
          onClick={() => openOverlay({
            kind: 'pick',
            title: '选择要永久移除的牌',
            filter: () => true,
            onPick: restRefine,
            previewRemove: true,
          })}
        >
          {detailed ? <CampActionArt kind="refine" /> : <span className="big" aria-hidden="true">✂</span>}
          <b>精简</b>
          <span>免费永久移除一张牌，让余下的牌更容易抽到。</span>
          <span className="camp-refine-quota">{run.campRefined ? '本章精简机会已用完' : run.deck.length <= 1 ? '至少保留一张牌' : '每章一次 · 占用本次营火行动'}</span>
        </button>
      </div>
      {r.used && <p className="subtitle">你已经利用了这团火。</p>}
      <button className="btn primary" onClick={() => restLeave()}>
        {r.used ? '继续前进' : '什么也不做，继续前进'}
      </button>
    </div>
  );
}
