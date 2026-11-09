import { describe, expect, it } from 'vitest';
import { RELIC_LIST } from '../data/relics';
import { EVENT_RELICS, SHOP_RELICS } from '../data/specialRelics';
import { CHAPTER_RELICS } from '../data/chapterRelics';
import { relicCategory } from '../ui/relicCatalog';

describe('遗物图鉴独立分类', () => {
  it('稀有分类只含常规与角色专属，问号、商店、章节奖励各自独立收录', () => {
    const ids = (items: typeof RELIC_LIST) => items.map(r => r.id).sort();
    const rare = RELIC_LIST.filter(r => relicCategory(r) === 'rare');
    expect(rare).toHaveLength(49);
    expect(rare.every(r => r.rarity === 'rare' && !r.source && !r.chapter)).toBe(true);
    expect(rare.filter(r => r.owner)).toHaveLength(4);
    expect(ids(RELIC_LIST.filter(r => relicCategory(r) === 'event'))).toEqual(ids(EVENT_RELICS));
    expect(ids(RELIC_LIST.filter(r => relicCategory(r) === 'shop'))).toEqual(ids(SHOP_RELICS));
    expect(ids(RELIC_LIST.filter(r => relicCategory(r) === 'chapter'))).toEqual(ids(CHAPTER_RELICS));
  });
  it('全部208件完整分为七类，常规三档与初始遗物数量保持正确', () => {
    const counts = RELIC_LIST.reduce<Record<string, number>>((result, r) => { const key = relicCategory(r); result[key] = (result[key] ?? 0) + 1; return result; }, {});
    expect(counts).toEqual({ common: 49, uncommon: 49, rare: 49, event: 15, shop: 6, chapter: 36, starter: 4 });
    expect(RELIC_LIST).toHaveLength(208);
  });
});
