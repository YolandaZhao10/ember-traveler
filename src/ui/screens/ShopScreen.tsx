import { Backdrop } from '../components/Art';
import { CHAPTERS } from '../../data/chapters';
import { RELICS } from '../../data/relics';
import { CHARACTERS } from '../../data/characters';
import { Card } from '../components/Card';
import { openOverlay, shopBuyCard, shopBuyRelic, shopLeave, shopRemove, useGame } from '../store';

export function ShopScreen() {
  const { run } = useGame();
  const s = run?.shop;
  if (!run || !s) return null;
  return (
    <div className="screen center-screen shop-screen grain scroll">
      <Backdrop id={CHAPTERS[run.chapter].shopArt} dim={0.62} />
      <div className="shop-heading">
        <h2>灰雾商人</h2>
        <p className="subtitle">「火种换不来东西，金币可以。」 当前金币：{run.gold}</p>
      </div>
      <div className="shop-stock">
        <section className="shop-section" aria-labelledby="shop-cards-heading">
          <h3 id="shop-cards-heading">卡牌 · {s.cards.filter(c => !c.sold).length} 张可购买</h3>
          <div className="shopgrid shop-cards">
            {s.cards.map((item, i) => (
              <div className={`shopitem ${item.sold ? 'sold' : ''}`} key={item.card.uid}>
                <div
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openOverlay({ kind: 'card', card: item.card, inCombat: false });
                  }}
                >
                  <Card card={item.card} size="sm" onClick={() => openOverlay({ kind: 'card', card: item.card, inCombat: false })} />
                </div>
                <button className="btn small" disabled={item.sold || run.gold < item.price} onClick={() => shopBuyCard(i)}>
                  {item.sold ? '已售出' : <span className={`price ${run.gold < item.price ? 'poor' : ''}`}>🪙 {item.price}</span>}
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="shop-section" aria-labelledby="shop-relics-heading">
          <h3 id="shop-relics-heading">遗物 · {s.relics.filter(r => !r.sold).length} 件可购买</h3>
          <div className="shopgrid shop-relics">
            {s.relics.map((item, i) => {
              const r = RELICS[item.relicId];
              return (
                <div className={`relicitem panel ${item.sold ? 'sold' : ''}`} key={item.relicId}>
                  <div className="shop-relic-heading">
                    <button className={`relic ${r.rarity}`} onClick={() => openOverlay({ kind: 'relic', relicId: r.id })}>
                      {r.icon}
                    </button>
                    <b>{r.name}{r.source === 'shop' && <small className="relic-owner">商店专属</small>}{r.owner && <small className="relic-owner">{CHARACTERS[r.owner].name}专属</small>}</b>
                  </div>
                  <p className="shop-relic-description">{r.description}</p>
                  <button className="btn small" disabled={item.sold || run.gold < item.price} onClick={() => shopBuyRelic(i)}>
                    {item.sold ? '已售出' : <span className={`price ${run.gold < item.price ? 'poor' : ''}`}>🪙 {item.price}</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <div className="shop-footer">
        <div className="relicitem panel shop-service">
          <span style={{ fontSize: 28 }}>🔥</span>
          <div className="txt">
            <b>焚毁一张牌</b>
            从牌组中永久移除一张牌。每店限一次，下次基础价增加 50 金币。
          </div>
          <button
            className="btn small"
            disabled={s.removeUsed || run.gold < s.removePrice}
            onClick={() =>
              openOverlay({
                kind: 'pick',
                title: `选择要移除的牌（${s.removePrice} 金币）`,
                filter: () => true,
                onPick: shopRemove,
              })
            }
          >
            {s.removeUsed ? '已使用' : <span className={`price ${run.gold < s.removePrice ? 'poor' : ''}`}>🪙 {s.removePrice}</span>}
          </button>
        </div>
        <button className="btn primary" onClick={() => shopLeave()}>
          离开商店
        </button>
      </div>
    </div>
  );
}
