import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARDS, cardAvailableTo } from '../data/cards';
import { EXTRA_CHARACTER_CARDS } from '../data/extraCards';
import { EXTRA_SHARED_CARDS } from '../data/sharedCards';
import { SHOP_RELICS } from '../data/specialRelics';
import { RELICS, RELIC_LIST, relicPool } from '../data/relics';
import { describeCard, viewCard } from '../engine/cards';
import { createCombat, playCard } from '../engine/combat';
import { EMBER_MAX } from '../engine/constants';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import type { CardInstance, CharacterId } from '../engine/types';

const characters: CharacterId[] = ['traveler', 'picker', 'oathbound', 'scholar'];
const card = (id: string, upgraded = false, uid = id): CardInstance => ({ uid, defId: id, upgraded });
function battle(id: string, upgraded = false) {
  const cs = createCombat('content', ['furnace_drone', 'chain_guard'], 'normal', [card(id, upgraded)], 60, 80, [], makeRng('CONTENT', 'combat'), 100).state;
  cs.enemies.forEach(e => { e.hp = e.maxHp = 10000; e.statuses = { burn: 4 }; });
  cs.player.energy = 20; cs.player.ember = 8; cs.player.block = 5;
  cs.player.attacksPlayedThisTurn = 2; cs.player.cardsPlayedThisTurn = 2; cs.player.hpLostThisTurn = 4;
  cs.player.hand.push(...Array.from({ length: 3 }, (_, i) => card('defend', false, `h${i}`)));
  cs.player.draw = Array.from({ length: 10 }, (_, i) => card('strike', false, `d${i}`));
  cs.player.exhaust = [card('bone_ash', false, 'x0'), card('ashes', false, 'x1')];
  return cs;
}

describe('扩展卡池与遗物配额', () => {
  it('学者新局52生命；商店10张卡和6件遗物按稀有度随机定价，购买和SL保持货品价格', () => {
    expect(R.newRun('SCHOLAR', 'scholar')).toMatchObject({ hp: 52, maxHp: 52 });
    for (const owner of characters) {
      for (const discount of [false, true]) {
        let run = R.newRun(`SHOP-${owner}-${discount}`, owner); run.gold = 999;
        if (discount) run.relics.push('merchant_scale');
        const id = run.map.startIds[0]; run.map.nodes[id].type = 'shop'; run = R.travelTo(run, id);
        expect(run.shop!.cards).toHaveLength(10); expect(new Set(run.shop!.cards.map(c => c.card.defId)).size).toBe(10);
        expect(run.shop!.relics).toHaveLength(6); expect(new Set(run.shop!.relics.map(r => r.relicId)).size).toBe(6);
        for (const item of run.shop!.cards) {
          const rarity = CARDS[item.card.defId].rarity;
          expect(cardAvailableTo(CARDS[item.card.defId], owner)).toBe(true);
          const [low, high] = R.cardShopPriceRange(run, rarity);
          expect(item.price).toBeGreaterThanOrEqual(low); expect(item.price).toBeLessThanOrEqual(high);
        }
        for (const item of run.shop!.relics) {
          expect(run.relics).not.toContain(item.relicId);
          const [low, high] = R.relicShopPriceRange(run, RELICS[item.relicId].rarity);
          expect(item.price).toBeGreaterThanOrEqual(low); expect(item.price).toBeLessThanOrEqual(high);
        }
        const first = run.shop!.cards[0]; const bought = R.shopBuyCard(run, 0);
        expect(bought.gold).toBe(run.gold - first.price); expect(bought.shop!.cards.filter(c => !c.sold)).toHaveLength(9);
        expect(R.shopBuyCard(bought, 0)).toBe(bought); expect(R.resetCurrentNode(bought)).toEqual(run);
      }
    }
    const run = R.newRun('PRICE');
    expect(['common', 'uncommon', 'rare'].map(r => R.cardShopPriceRange(run, r as 'common' | 'uncommon' | 'rare'))).toEqual([[45, 55], [70, 80], [120, 150]]);
    expect(['common', 'uncommon', 'rare'].map(r => R.relicShopPriceRange(run, r as 'common' | 'uncommon' | 'rare'))).toEqual([[150, 180], [200, 250], [280, 300]]);
    run.relics.push('merchant_scale');
    expect(['common', 'uncommon', 'rare'].map(r => R.cardShopPriceRange(run, r as 'common' | 'uncommon' | 'rare'))).toEqual([[34, 41], [53, 60], [90, 113]]);
  });
  it('遗物池只剩少量时不重复补货，全部持有时商店正常打开', () => {
    for (const remain of [0, 2]) {
      let run = R.newRun('RELICS-EMPTY'); run.relics.push(...SHOP_RELICS.map(r => r.id));
      const pool = relicPool(run.relics, run.character); run.relics.push(...pool.slice(remain).map(r => r.id));
      const id = run.map.startIds[0]; run.map.nodes[id].type = 'shop'; run = R.travelTo(run, id);
      expect(run.shop!.relics).toHaveLength(remain);
      expect(run.shop!.cards).toHaveLength(10);
    }
  });
  it.each(characters)('%s 专属牌恰好普通20、罕见18、稀有15，初始牌另计', owner => {
    const cards = CARD_LIST.filter(c => c.owner === owner);
    for (const [rarity, count] of [['common', 20], ['uncommon', 18], ['rare', 15]] as const) expect(cards.filter(c => c.rarity === rarity)).toHaveLength(count);
    expect(cards.filter(c => c.rarity === 'starter').length).toBeGreaterThan(0);
    for (const c of cards) for (const other of characters) expect(cardAvailableTo(c, other)).toBe(owner === other);
  });
  it('通用牌恰好普通20、罕见18、稀有15；初始和诅咒另计，四角色都能获得', () => {
    const shared = CARD_LIST.filter(c => !c.owner);
    for (const [rarity, count] of [['common', 20], ['uncommon', 18], ['rare', 15]] as const) expect(shared.filter(c => c.rarity === rarity)).toHaveLength(count);
    expect(shared.filter(c => c.rarity === 'starter')).toHaveLength(3);
    expect(shared.filter(c => c.rarity === 'curse')).toHaveLength(7);
    for (const c of shared) for (const owner of characters) expect(cardAvailableTo(c, owner)).toBe(true);
  });
  it('卡牌282张且名称唯一，常规遗物三档各45个，另有12个专属和4个初始', () => {
    expect(CARD_LIST).toHaveLength(282); expect(EXTRA_CHARACTER_CARDS).toHaveLength(143); expect(EXTRA_SHARED_CARDS).toHaveLength(39);
    expect(new Set(CARD_LIST.map(c => c.id)).size).toBe(282);
    expect(new Set(CARD_LIST.map(c => c.name)).size).toBe(282);
    expect(RELIC_LIST).toHaveLength(208);
    for (const rarity of ['common', 'uncommon', 'rare']) {
      expect(RELIC_LIST.filter(r => r.rarity === rarity && !r.owner && !r.chapter && !r.source)).toHaveLength(45);
      expect(RELIC_LIST.filter(r => r.rarity === rarity && r.owner)).toHaveLength(4);
    }
    expect(RELIC_LIST.filter(r => r.rarity === 'starter')).toHaveLength(4);
    for (const owner of characters) expect(relicPool([], owner).every(r => r.rarity !== 'starter')).toBe(true);
  });
  it.each(characters)('%s 普通、精英、商店及首领奖励过滤正确，所有专属牌均能生成', character => {
    const run = R.newRun(`POOL-${character}`, character);
    const seen = new Set<string>();
    for (let i = 0; i < 800; i++) {
      const tier = (['normal', 'elite', 'shop', 'boss'] as const)[i % 4];
      run.floor = Math.floor(i / 4) % 40;
      const reward = R.generateCardChoices(run, tier, 3);
      expect(new Set(reward.map(c => c.defId)).size).toBe(reward.length);
      for (const c of reward) {
        expect(cardAvailableTo(CARDS[c.defId], character)).toBe(true);
        expect(['starter', 'curse']).not.toContain(CARDS[c.defId].rarity);
        if (tier === 'boss') { expect(CARDS[c.defId].rarity).toBe('rare'); expect(CARDS[c.defId].owner).toBe(character); }
        seen.add(c.defId);
      }
    }
    for (const c of CARD_LIST.filter(c => cardAvailableTo(c, character) && !['starter', 'curse'].includes(c.rarity))) expect(seen.has(c.id), c.id).toBe(true);
  });
  it('全部新增牌的基础版与升级版可实际出牌，描述完整，结算数值有效', () => {
    for (const def of [...EXTRA_CHARACTER_CARDS, ...EXTRA_SHARED_CARDS]) for (const up of [false, true]) {
      const cs = battle(def.id, up); const c = cs.player.hand[0]; const v = viewCard(c);
      const result = playCard(cs, c.uid, v.target === 'enemy' ? 'e0' : null);
      expect(result.events.some(e => e.type === 'cardPlayed'), def.id).toBe(true);
      expect(describeCard(c, null)).not.toMatch(/undefined|NaN/);
      expect(result.state.player.hp, def.id).toBeGreaterThan(0);
      expect(result.state.player.ember).toBeGreaterThanOrEqual(0); expect(result.state.player.ember).toBeLessThanOrEqual(EMBER_MAX);
      const zones = [...result.state.player.hand, ...result.state.player.draw, ...result.state.player.discard, ...result.state.player.exhaust];
      expect(new Set(zones.map(c => c.uid)).size, def.id).toBe(zones.length);
      for (const e of result.events) if (e.type === 'damage' || e.type === 'block' || e.type === 'heal') expect(Number.isFinite(e.amount), def.id).toBe(true);
    }
  });
  it('新牌的格挡转伤害、燃烧倍率、力量倍率与保留蓄力按规则结算', () => {
    let cs = battle('shield_rush');
    let after = playCard(cs, 'shield_rush', 'e0').state;
    expect(after.player.block).toBe(15); expect(cs.enemies[0].hp - after.enemies[0].hp).toBe(18);
    cs = battle('coal_lance', true); after = playCard(cs, 'coal_lance', 'e0').state;
    expect(cs.enemies[0].hp - after.enemies[0].hp).toBe(30); expect(after.enemies[0].statuses.burn).toBe(4);
    cs = battle('mountain_splitter'); cs.player.statuses.strength = 3; after = playCard(cs, 'mountain_splitter', 'e0').state;
    expect(cs.enemies[0].hp - after.enemies[0].hp).toBe(24);
    cs = battle('surge_glyph'); cs.player.hand[0].bonus = 2; cs.player.statuses.echo = 1; after = playCard(cs, 'surge_glyph', 'e0').state;
    expect(cs.enemies[0].hp - after.enemies[0].hp).toBe(18); expect(after.player.block).toBe(23);
  });
});
