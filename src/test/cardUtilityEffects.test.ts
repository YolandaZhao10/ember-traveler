import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { describeCard } from '../engine/cards';
import { createCombat, endPlayerTurn, HAND_MAX, playCard } from '../engine/combat';
import { makeRng, nextInt } from '../engine/rng';
import type { CardDef, CardInstance, CombatState, Effect } from '../engine/types';

const SOURCE = '__utility_source';
const PLAIN = '__utility_plain';
const CURSE = '__utility_curse';
const MID = '__utility_mid';
const HIGH = '__utility_high';
const instance = (defId: string, uid = defId, upgraded = false): CardInstance => ({ uid, defId, upgraded });

// 所有卡牌数值由测试自行定义，避免内容平衡修改使规则测试失效。
function withCards(effects: Effect[], run: (cs: CombatState) => void, patch: Partial<CardDef> = {}) {
  const base: Omit<CardDef, 'id' | 'name'> = { type: 'skill', rarity: 'common', archetype: 'basic', cost: 0, target: 'self', effects: [], upgrade: {} };
  const definitions: CardDef[] = [
    { ...base, id: SOURCE, name: '规则探针', effects, ...patch },
    { ...base, id: PLAIN, name: '普通测试牌', cost: 1, upgrade: { cost: 0 } },
    { ...base, id: CURSE, name: '诅咒测试牌', type: 'curse', rarity: 'curse', archetype: 'curse' },
    { ...base, id: MID, name: '中费测试牌', cost: 2 },
    { ...base, id: HIGH, name: '高费测试牌', cost: 3, upgrade: { cost: 1 } },
  ];
  const originals = new Map(definitions.map(d => [d.id, CARDS[d.id]]));
  try {
    for (const def of definitions) CARDS[def.id] = def;
    const cs = createCombat('utility-test', ['tomb_puppet', 'tomb_puppet', 'tomb_puppet'], 'normal', [], 50, 52, [], makeRng('UTILITY', 'combat'), 100, 'scholar').state;
    for (const enemy of cs.enemies) { enemy.hp = enemy.maxHp = 1000; enemy.block = 0; enemy.statuses = {}; }
    cs.player.hand = [instance(SOURCE)];
    cs.player.draw = []; cs.player.discard = []; cs.player.exhaust = [];
    cs.player.energy = 20; cs.player.block = 0; cs.player.statuses = {};
    run(cs);
  } finally {
    for (const [id, original] of originals) {
      if (original) CARDS[id] = original;
      else delete CARDS[id];
    }
  }
}

function text(cs: CombatState) {
  return describeCard(cs.player.hand.find(c => c.uid === SOURCE)!, {
    player: cs.player, target: cs.enemies[0], relics: cs.relics, isFirstAttack: true, crescendoBonus: 0,
  });
}

describe('净化与破除格挡', () => {
  it('净化移除虚弱、易伤、脆弱与燃烧，保留力竭、增益和能力，后续格挡预览使用净化后的状态', () => {
    withCards([{ kind: 'clearDebuffs' }, { kind: 'block', amount: 10 }], cs => {
      cs.player.statuses = { weak: 2, vulnerable: 3, frail: 2, burn: 5, strengthDown: 4, strength: 8, dexterity: 2, metallicize: 3, barricade: 1 };
      const before = structuredClone(cs);
      expect(text(cs)).toContain('清除自身的虚弱、易伤、脆弱与燃烧，获得 12 点格挡');
      expect(cs).toEqual(before);
      const result = playCard(cs, SOURCE, null);
      expect(result.state.player.statuses).toEqual({ strengthDown: 4, strength: 8, dexterity: 2, metallicize: 3, barricade: 1 });
      expect(result.state.player.block).toBe(12);
      expect(result.events.filter(e => e.type === 'status' && e.amount < 0)).toHaveLength(4);
      expect(result.state.log).toContain('清除了自身的虚弱、易伤、脆弱与燃烧');
      expect(cs).toEqual(before);
    });
  });

  it('临时力量净化后仍保留归还标记，回响所得的临时力量在回合结束全部归还', () => {
    withCards([{ kind: 'tempStrength', amount: 4 }, { kind: 'clearDebuffs' }], cs => {
      cs.player.statuses = { strength: 3, echo: 1, weak: 2 };
      const played = playCard(cs, SOURCE, null).state;
      expect(played.player.statuses.strength).toBe(11);
      expect(played.player.statuses.strengthDown).toBe(8);
      expect(played.player.statuses.weak).toBeUndefined();
      const ended = endPlayerTurn(played).state;
      expect(ended.player.statuses.strength).toBe(3);
      expect(ended.player.statuses.strengthDown).toBeUndefined();
    });
  });

  it('破甲只移除选定敌人的格挡，后续伤害正常穿过；回响不会重复移除旧格挡', () => {
    withCards([{ kind: 'removeBlock' }, { kind: 'damage', amount: 7 }], cs => {
      cs.player.statuses.echo = 1;
      cs.player.block = 9;
      cs.enemies[0].block = 30; cs.enemies[1].block = 12;
      expect(text(cs)).toContain('移除目标全部格挡');
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state.enemies[0].block).toBe(0);
      expect(result.state.enemies[0].hp).toBe(986);
      expect(result.state.enemies[1].block).toBe(12);
      expect(result.state.player.block).toBe(9);
      expect(result.state.log).toContain(`移除 ${cs.enemies[0].name} 的全部 30 点格挡`);
      expect(result.state.log).toContain(`移除 ${cs.enemies[0].name} 的全部 0 点格挡`);
    }, { target: 'enemy', type: 'attack' });
  });

  it('不能对已死亡的目标出牌，不消耗费用或移除其格挡', () => {
    withCards([{ kind: 'removeBlock' }], cs => {
      cs.enemies[0].hp = 0; cs.enemies[0].block = 30;
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state).toBe(cs);
      expect(result.events).toEqual([]);
      expect(result.state.enemies[0].block).toBe(30);
    }, { target: 'enemy' });
  });
});

describe('燃烧传播与燃烧格挡', () => {
  it('传播叠加给其他存活敌人，源层数不变；回响再次传播', () => {
    withCards([{ kind: 'spreadBurn' }], cs => {
      cs.enemies[0].statuses.burn = 4; cs.enemies[1].statuses.burn = 2;
      cs.enemies[2].hp = 0; cs.enemies[2].statuses.burn = 9;
      cs.player.statuses.echo = 1;
      expect(text(cs)).toContain('将目标当前的燃烧层数施加给其他所有存活敌人（不移除目标燃烧）');
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state.enemies.map(e => e.statuses.burn)).toEqual([4, 10, 9]);
      expect(result.events.filter(e => e.type === 'status' && e.status === 'burn').map(e => e.type === 'status' ? [e.targetId, e.amount] : [])).toEqual([['e1', 4], ['e1', 4]]);
    }, { target: 'enemy' });
  });

  it('源目标没有燃烧时，不创建燃烧字段也不影响其他目标的燃烧', () => {
    withCards([{ kind: 'spreadBurn' }], cs => {
      cs.enemies[1].statuses.burn = 3;
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state.enemies.map(e => e.statuses)).toEqual([{}, { burn: 3 }, {}]);
      expect(result.events.some(e => e.type === 'status' && e.status === 'burn')).toBe(false);
    }, { target: 'enemy' });
  });

  it('同一张牌先杀死目标后，不再传播其燃烧或从尸体获取格挡', () => {
    withCards([{ kind: 'damage', amount: 1001 }, { kind: 'spreadBurn' }, { kind: 'blockPerBurn', amount: 3, max: 12 }], cs => {
      cs.enemies[0].statuses.burn = 5; cs.player.statuses.dexterity = 8;
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state.enemies[0].hp).toBe(0);
      expect(result.state.enemies[1].statuses.burn).toBeUndefined();
      expect(result.state.enemies[2].statuses.burn).toBeUndefined();
      expect(result.state.player.block).toBe(0);
    }, { target: 'enemy', type: 'attack' });
  });

  it.each([
    { burn: 0, dex: 0, frail: 0, expected: 0 },
    { burn: 3, dex: 2, frail: 0, expected: 11 },
    { burn: 10, dex: 4, frail: 0, expected: 14 },
    { burn: 10, dex: 2, frail: 1, expected: 9 },
    { burn: 0, dex: 2, frail: 1, expected: 1 },
    { burn: 10, dex: -20, frail: 1, expected: 0 },
  ])('基础格挡先封顶再修正：$burn 燃烧 / $dex 敏捷 / $frail 脆弱 → $expected 格挡', ({ burn, dex, frail, expected }) => {
    withCards([{ kind: 'blockPerBurn', amount: 3, max: 10 }], cs => {
      cs.enemies[0].statuses.burn = burn;
      cs.player.statuses = { dexterity: dex, frail };
      const before = structuredClone(cs);
      expect(text(cs)).toContain(`基础上限 10）（当前 ${expected} 点格挡）`);
      expect(cs).toEqual(before);
      const result = playCard(cs, SOURCE, 'e0');
      expect(result.state.player.block).toBe(expected);
      expect(result.state.player.blockGainedThisTurn).toBe(expected);
    }, { target: 'enemy' });
  });

  it('预览考虑同牌先施加或翻倍燃烧；回响每次重新读取当前层数', () => {
    withCards([{ kind: 'status', status: 'burn', amount: 2, target: 'target' }, { kind: 'doubleStatus', status: 'burn' }, { kind: 'blockPerBurn', amount: 2, max: 20 }], cs => {
      cs.enemies[0].statuses.burn = 1; cs.player.statuses.echo = 1;
      const before = structuredClone(cs);
      expect(text(cs)).toContain('当前 12 点格挡');
      expect(cs).toEqual(before);
      const result = playCard(cs, SOURCE, 'e0').state;
      expect(result.enemies[0].statuses.burn).toBe(16);
      expect(result.player.block).toBe(32);
    }, { target: 'enemy' });
  });
});

describe('全手牌弃置和限定诅咒消耗', () => {
  it('弃置所有当前手牌后抽牌至上限，回响再弃掉新抽入的牌；源牌始终在结算区', () => {
    withCards([{ kind: 'discardRandom', count: 'all' }, { kind: 'draw', amount: 15 }], cs => {
      cs.player.hand.push(instance(PLAIN, 'held-plain'), instance(CURSE, 'held-curse'));
      cs.player.draw = Array.from({ length: 30 }, (_, i) => instance(PLAIN, `draw-${i}`));
      cs.player.statuses.echo = 1;
      expect(text(cs)).toContain('弃置所有手牌');
      expect(text(cs)).not.toContain('all');
      const result = playCard(cs, SOURCE, null).state;
      expect(result.player.hand).toHaveLength(HAND_MAX);
      expect(result.player.hand.map(c => c.uid)).toEqual(Array.from({ length: 10 }, (_, i) => `draw-${19 - i}`));
      expect(result.player.draw).toHaveLength(10);
      expect(result.player.discard).toHaveLength(12);
      expect(result.player.discard.some(c => c.uid === SOURCE)).toBe(false);
      expect(result.player.exhaust.map(c => c.uid)).toEqual([SOURCE]);
    }, { exhaust: true });
  });

  it('仅消耗效果开始时在手中的诅咒，消耗触发抽入的诅咒和普通牌都保留', () => {
    withCards([{ kind: 'exhaustHand', count: 'all', filter: 'curse', energyPerCard: 1, damagePerCard: 2 }], cs => {
      cs.player.hand.push(instance(PLAIN, 'plain'), instance(CURSE, 'curse-a'), instance(CURSE, 'curse-b'));
      cs.player.draw.push(instance(CURSE, 'drawn-curse'));
      cs.relics.push('bone_urn');
      expect(text(cs)).toContain('消耗手牌中的所有诅咒牌');
      expect(text(cs)).toContain('当前 2 张');
      const result = playCard(cs, SOURCE, 'e0').state;
      expect(result.player.hand.map(c => c.uid)).toEqual(['plain', 'drawn-curse']);
      expect(result.player.exhaust.map(c => c.uid)).toEqual(['curse-a', 'curse-b']);
      expect(result.player.discard.map(c => c.uid)).toEqual([SOURCE]);
      expect(result.player.energy).toBe(22);
      expect(result.enemies[0].hp).toBe(996);
    }, { target: 'enemy' });
  });

  it('没有诅咒时不会误消耗普通牌，不给消耗奖励；回响仍安全', () => {
    withCards([{ kind: 'exhaustHand', count: 'all', filter: 'curse', energyPerCard: 3 }], cs => {
      cs.player.hand.push(instance(PLAIN, 'plain')); cs.player.statuses.echo = 1;
      const result = playCard(cs, SOURCE, null).state;
      expect(result.player.hand.map(c => c.uid)).toEqual(['plain']);
      expect(result.player.exhaust).toEqual([]);
      expect(result.player.energy).toBe(20);
    });
  });

  it('随机消耗数量受诅咒候选限制，回响可消耗剩余诅咒，普通牌不入候选', () => {
    withCards([{ kind: 'exhaustHand', count: 1, filter: 'curse' }], cs => {
      cs.player.hand.push(instance(PLAIN, 'plain'), instance(CURSE, 'curse-a'), instance(CURSE, 'curse-b'), instance(CURSE, 'curse-c'));
      cs.player.statuses.echo = 1;
      expect(text(cs)).toContain('随机 1 张诅咒牌');
      const result = playCard(cs, SOURCE, null).state;
      expect(result.player.exhaust).toHaveLength(2);
      expect(result.player.exhaust.every(c => c.defId === CURSE)).toBe(true);
      expect(result.player.hand.filter(c => c.defId === PLAIN)).toHaveLength(1);
      expect(result.player.hand.filter(c => c.defId === CURSE)).toHaveLength(1);
    });
  });
});

describe('优先取回高费用消耗牌', () => {
  it('按升级后的实际费用降序取回，同费保持消耗区原顺序，源牌不能取回自己', () => {
    withCards([{ kind: 'returnExhausted', count: 3, selection: 'highestCost' }], cs => {
      cs.player.exhaust = [instance(HIGH, 'up-high', true), instance(MID, 'first-mid'), instance(PLAIN, 'up-low', true), instance(HIGH, 'base-high'), instance(MID, 'second-mid')];
      const rngBefore = { ...cs.rng };
      expect(text(cs)).toContain('按费用从高到低取回 3 张牌到手牌（同费按消耗顺序）');
      const result = playCard(cs, SOURCE, null).state;
      expect(result.player.hand.map(c => c.uid)).toEqual(['base-high', 'first-mid', 'second-mid']);
      expect(result.player.exhaust.map(c => c.uid)).toEqual(['up-high', 'up-low', SOURCE]);
      expect(result.rng).toEqual(rngBefore);
    }, { exhaust: true });
  });

  it('满手只取回能放入的牌，回响也不能突破上限或丢失未取回的牌', () => {
    withCards([{ kind: 'returnExhausted', count: 3, selection: 'highestCost' }], cs => {
      cs.player.hand.push(...Array.from({ length: 9 }, (_, i) => instance(PLAIN, `held-${i}`)));
      cs.player.exhaust = [instance(MID, 'mid'), instance(HIGH, 'high'), instance(PLAIN, 'low')];
      cs.player.statuses.echo = 1;
      const result = playCard(cs, SOURCE, null).state;
      expect(result.player.hand).toHaveLength(HAND_MAX);
      expect(result.player.hand[result.player.hand.length - 1]?.uid).toBe('high');
      expect(result.player.exhaust.map(c => c.uid)).toEqual(['mid', 'low']);
    });
  });

  it('回响继续从剩余消耗区按顺序取回，空消耗区安全', () => {
    withCards([{ kind: 'returnExhausted', count: 2, selection: 'highestCost' }], cs => {
      cs.player.exhaust = [instance(PLAIN, 'low'), instance(HIGH, 'high'), instance(MID, 'mid')];
      cs.player.statuses.echo = 1;
      const result = playCard(cs, SOURCE, null).state;
      expect(result.player.hand.map(c => c.uid)).toEqual(['high', 'mid', 'low']);
      expect(result.player.exhaust).toEqual([]);
    });
  });

  it('未指定筛选仍按相同随机序列取牌并消耗相同 RNG 次数', () => {
    withCards([{ kind: 'returnExhausted', count: 2 }], cs => {
      cs.player.exhaust = [instance(HIGH, 'high'), instance(PLAIN, 'low'), instance(MID, 'mid')];
      const expectedRng = { ...cs.rng }, remaining = [...cs.player.exhaust], expected: CardInstance[] = [];
      for (let i = 0; i < 2; i++) expected.push(...remaining.splice(nextInt(expectedRng, 0, remaining.length - 1), 1));
      expect(text(cs)).toContain('从消耗区随机取回 2 张牌到手牌');
      const result = playCard(cs, SOURCE, null).state;
      expect(result.player.hand).toEqual(expected);
      expect(result.player.exhaust).toEqual(remaining);
      expect(result.rng).toEqual(expectedRng);
    });
  });
});
