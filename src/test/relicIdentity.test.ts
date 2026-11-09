import { describe, expect, it } from 'vitest';
import { RELICS, RELIC_LIST } from '../data/relics';
import { relicMechanicDuplicates, relicMechanicSignature } from './relicIdentityAudit';

describe('遗物机制去重', () => {
  it('199件可获得遗物不能仅靠名称、数量、阈值、稀有度或获取渠道区分', () => {
    expect(RELIC_LIST.filter(r => r.chapter !== 4)).toHaveLength(199);
    expect(relicMechanicDuplicates()).toEqual([]);
    const descriptions = RELIC_LIST.filter(r => r.chapter !== 4).map(r => r.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
  it('交换独立效果顺序、提高数值并换名称稀有度，仍识别为同机制', () => {
    const original = RELICS.clocktower_gear;
    const reskin = structuredClone(original);
    reskin.id = 'counterfeit'; reskin.name = '另一个名字'; reskin.rarity = 'common'; reskin.source = 'event';
    reskin.combat![0].nth = 8;
    reskin.combat![0].effects.reverse().forEach(e => e.amount *= 2);
    expect(relicMechanicSignature(reskin)).toBe(relicMechanicSignature(original));
    expect(relicMechanicDuplicates([original, reskin])).toEqual([[original.id, reskin.id]]);
  });
  it('已拆分的旧重复家族具有不同触发或实际用途', () => {
    for (const [a, b] of [
      ['echo_stone', 'old_tome'], ['blood_charm', 'sealed_tear'], ['trail_boots', 'leather_guard'],
      ['bone_urn', 'charcoal_sieve'], ['clockwork_sun', 'deep_clock'], ['worldroot', 'sky_reliquary'],
      ['wandering_hearth', 'caravan_hearth'], ['dusk_glass', 'gatekeeper_aegis'],
      ['ancient_coin_mold', 'deep_city_treasury'], ['ash_reactor', 'soot_bell'],
    ]) expect(relicMechanicSignature(RELICS[a])).not.toBe(relicMechanicSignature(RELICS[b]));
  });
  it('新增旧式ID必须补充机制覆盖，不能默默漏审；9件停发纪念遗物单列', () => {
    expect(() => relicMechanicSignature({ ...RELICS.flint, id: 'unreviewed' })).toThrow('缺少旧遗物机制适配');
    expect(RELIC_LIST.filter(r => r.chapter === 4)).toHaveLength(9);
  });
});
