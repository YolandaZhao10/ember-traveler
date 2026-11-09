import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { describeCard } from '../engine/cards';
import { createCombat, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { EMBER_MAX } from '../engine/constants';
import type { CardDef, CombatState, Effect } from '../engine/types';

const SOURCE = '__burn_to_ember_probe';

function withCard(run: (cs: CombatState) => void, effects?: Effect[]) {
  const previous = CARDS[SOURCE];
  const def: CardDef = {
    id: SOURCE, name: '燃烧兑换测试牌', type: 'skill', rarity: 'rare', archetype: 'cinder',
    cost: 0, target: 'enemy', effects: effects ?? [{ kind: 'burnToEmber', amount: 2, max: 5 }],
    upgrade: { effects: [{ kind: 'burnToEmber', amount: 3, max: 8 }] },
  };
  try {
    CARDS[SOURCE] = def;
    const cs = createCombat('burn-exchange', ['tomb_puppet', 'tomb_puppet'], 'normal', [], 50, 52, [], makeRng('BURN-EXCHANGE', 'combat'), 100, 'scholar').state;
    cs.player.hand = [{ uid: SOURCE, defId: SOURCE, upgraded: false }];
    cs.player.statuses = {}; cs.player.ember = 0; cs.player.block = 0;
    for (const enemy of cs.enemies) {
      enemy.hp = enemy.maxHp = 100; enemy.block = 20; enemy.statuses = {};
    }
    run(cs);
  } finally {
    if (previous) CARDS[SOURCE] = previous;
    else delete CARDS[SOURCE];
  }
}

const preview = (cs: CombatState) => describeCard(cs.player.hand[0], {
  player: cs.player, target: cs.enemies[0], relics: cs.relics, isFirstAttack: true, crescendoBonus: 0,
});

describe('燃烧兑换余烬', () => {
  it.each([
    { layers: 2, initial: 0, up: false, gained: 4 },
    { layers: 12, initial: 0, up: false, gained: 5 },
    { layers: 12, initial: 9, up: false, gained: 5 },
    { layers: 12, initial: EMBER_MAX - 1, up: false, gained: 1 },
    { layers: 12, initial: EMBER_MAX, up: false, gained: 0 },
    { layers: 3, initial: 0, up: true, gained: 8 },
  ])('$layers 层燃烧 / $initial 余烬 / 升级 $up：清空目标燃烧，实际获得 $gained 余烬', ({ layers, initial, up, gained }) => {
    withCard(cs => {
      cs.player.hand[0].upgraded = up; cs.player.ember = initial;
      cs.player.statuses = { strength: 100, weak: 3 };
      cs.enemies[0].statuses = { burn: layers, vulnerable: 3, thorns: 9 };
      cs.enemies[1].statuses.burn = 7;
      const before = structuredClone(cs);
      expect(preview(cs)).toContain(`每层获得 ${up ? 3 : 2} 点余烬（基础上限 ${up ? 8 : 5} 点）`);
      expect(preview(cs)).toContain(`当前获得 ${gained} 点余烬`);
      expect(cs).toEqual(before);
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state.player.ember).toBe(initial + gained);
      expect(result.state.enemies[0].statuses).toEqual({ vulnerable: 3, thorns: 9 });
      expect(result.state.enemies[1].statuses.burn).toBe(7);
      expect(result.state.enemies.map(e => [e.hp, e.block])).toEqual([[100, 20], [100, 20]]);
      expect(result.state.player.hp).toBe(50);
      expect(result.events.some(e => e.type === 'damage')).toBe(false);
      expect(result.state.log).toContain(`消耗 ${cs.enemies[0].name} 的 ${layers} 层燃烧，获得 ${gained} 点余烬`);
      expect(cs).toEqual(before);
    });
  });

  it('回响第二次不再兑换同一份燃烧，也不额外触发沙漏与熔炉', () => {
    withCard(cs => {
      cs.player.statuses = { echo: 1, forge: 2 };
      cs.relics.push('ash_hourglass'); cs.enemies[0].statuses.burn = 3;
      expect(preview(cs)).toContain('当前获得 6 点余烬');
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state.player.ember).toBe(6);
      expect(result.state.player.block).toBe(12);
      expect(result.events.filter(e => e.type === 'ember')).toEqual([{ type: 'ember', amount: 6, total: 6 }]);
      expect(result.events.filter(e => e.type === 'status' && e.status === 'burn')).toHaveLength(1);
    });
  });

  it('目标无燃烧时没有余烬，也不能凭空触发沙漏或熔炉', () => {
    withCard(cs => {
      cs.player.statuses = { forge: 2, echo: 1 }; cs.relics.push('ash_hourglass');
      expect(preview(cs)).toContain('当前获得 0 点余烬');
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state.player.ember).toBe(0);
      expect(result.state.player.block).toBe(0);
      expect(result.state.enemies[0].statuses).toEqual({});
      expect(result.events.some(e => e.type === 'ember' || e.type === 'block')).toBe(false);
    });
  });

  it('余烬接近上限时熔炉只按实际获得数触发', () => {
    withCard(cs => {
      cs.player.ember = EMBER_MAX - 1; cs.player.statuses.forge = 3;
      cs.relics.push('ash_hourglass'); cs.enemies[0].statuses.burn = 7;
      expect(preview(cs)).toContain('当前获得 1 点余烬');
      const result = playCard(cs, SOURCE, 'e0').state;
      expect(result.player.ember).toBe(EMBER_MAX);
      expect(result.player.block).toBe(3);
    });
  });

  it('已死亡目标不能被选中，不消耗牌也不清除其残留燃烧', () => {
    withCard(cs => {
      cs.enemies[0].hp = 0; cs.enemies[0].statuses.burn = 4;
      expect(preview(cs)).toContain('当前获得 0 点余烬');
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state).toBe(cs);
      expect(result.events).toEqual([]);
      expect(result.state.enemies[0].statuses.burn).toBe(4);
    });
  });

  it('目标在同一张牌的前序伤害中死亡时，不再兑换尸体上的燃烧', () => {
    withCard(cs => {
      cs.enemies[0].statuses.burn = 4;
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state.enemies[0].hp).toBe(0);
      expect(result.state.enemies[0].statuses.burn).toBe(4);
      expect(result.state.player.ember).toBe(0);
      expect(result.events.some(e => e.type === 'ember')).toBe(false);
    }, [{ kind: 'damage', amount: 200 }, { kind: 'burnToEmber', amount: 2, max: 5 }]);
  });

  it('后续预览与结算使用清除后的燃烧、获得后的余烬，预览不改战斗状态', () => {
    withCard(cs => {
      cs.enemies[0].statuses.burn = 4; cs.player.ember = 1;
      const before = structuredClone(cs), description = preview(cs);
      expect(description).toContain('当前获得 5 点余烬');
      expect(description).toContain('基础上限 20）（当前 0 点格挡）');
      expect(description).toContain('余烬翻倍（6 → 12）');
      expect(cs).toEqual(before);
      const result = playCard(cs, SOURCE, 'e0').state;
      expect(result.player.ember).toBe(12);
      expect(result.player.block).toBe(0);
      expect(result.enemies[0].statuses.burn).toBeUndefined();
    }, [{ kind: 'burnToEmber', amount: 2, max: 5 }, { kind: 'blockPerBurn', amount: 3, max: 20 }, { kind: 'doubleEmber' }]);
  });
});
