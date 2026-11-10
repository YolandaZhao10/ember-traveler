import { describe, expect, it } from 'vitest';
import { CARDS, cardAvailableTo } from '../data/cards';
import { createCombat, endPlayerTurn, playCard, startPlayerTurn } from '../engine/combat';
import { describeCard, viewDef } from '../engine/cards';
import { makeRng } from '../engine/rng';
import type { CombatState } from '../engine/types';

const card = (defId: string, upgraded = false, uid = defId) => ({ defId, upgraded, uid });
const ids = ['trail_supply', 'unburden_armor', 'ash_index', 'borrow_flame', 'pulse_memory', 'borrow_fury', 'echo_footnotes', 'release_charge'];
function battle() {
  const cs = createCombat('resources', ['tomb_puppet'], 'normal', [], 20, 80, [], makeRng('RESOURCES', 'c'), 0, 'oathbound').state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 10000;
  cs.player.draw = Array.from({ length: 30 }, (_, i) => card('defend', false, `draw-${i}`));
  cs.player.hand = []; cs.player.energy = 3; return cs;
}
function use(cs: CombatState, id: string, up = false) {
  const c = card(id, up, `play-${cs.player.cardsPlayedThisTurn}`); cs.player.hand.push(c);
  return playCard(cs, c.uid, 'e0').state;
}
it('每角色各新增一张抽牌和一张加费罕见专属，基础与升级均消耗', () => {
  for (const owner of ['traveler', 'picker', 'oathbound', 'scholar'] as const) {
    const own = ids.filter(id => CARDS[id].owner === owner); expect(own).toHaveLength(2);
    for (const id of own) {
      expect(CARDS[id].rarity).toBe('uncommon'); expect(cardAvailableTo(CARDS[id], owner)).toBe(true);
      for (const up of [false, true]) expect(viewDef(id, up).exhaust).toBe(true);
    }
  }
});
describe.each([false, true])('角色资源转换（升级=%s）', up => {
  it.each(ids)('%s高资源也遵守单次上限，升级收益与卡面一致', id => {
    let cs = battle();
    cs.player.attacksPlayedThisTurn = 100; cs.player.block = 100;
    Object.assign(cs.player.turnFlags, { exhausted: 100, actualHealing: 100, resolvedCopies: 100 });
    Object.assign(cs.player.statuses, { strength: 100, strengthDown: 100 });
    cs.enemies[0].statuses.burn = 100;
    cs.player.hand = [{ ...card('charged_blade', false, 'charge'), bonus: 100 }];
    const effect = viewDef(id, up).effects[0];
    if (effect.kind !== 'convertResource') throw new Error('资源牌缺少转换效果');
    const before = JSON.stringify(cs), c = card(id, up);
    expect(describeCard(c, { player: cs.player, target: cs.enemies[0], relics: [], isFirstAttack: false, crescendoBonus: 0 })).toContain(`当前 ${effect.max}`);
    expect(JSON.stringify(cs)).toBe(before);
    cs = use(cs, id, up);
    expect(cs.player.energy).toBe(3 + (effect.reward === 'energy' ? effect.max : 0));
    expect(cs.player.hand).toHaveLength(1 + (effect.reward === 'draw' ? effect.max : 0));
  });
  it('战途补给核销攻击次数，但不倒退连击计数；回收不会重复兑现', () => {
    let cs = battle(); cs.player.attacksPlayedThisTurn = 2;
    cs = use(cs, 'trail_supply', up); expect(cs.player.hand).toHaveLength(2); expect(cs.player.attacksPlayedThisTurn).toBe(2);
    cs = use(cs, 'trail_supply', up); expect(cs.player.hand).toHaveLength(2);
    cs.player.attacksPlayedThisTurn++; cs = use(cs, 'trail_supply', up); expect(cs.player.hand).toHaveLength(3);
  });
  it('卸甲疾行真实损失护甲，整份兑换并留下余数；回响不能白拿', () => {
    let cs = battle(); cs.player.block = 29; cs.player.statuses.echo = 1;
    cs = use(cs, 'unburden_armor', up); expect(cs.player.energy).toBe(5); expect(cs.player.block).toBe(9);
    expect(cs.player.exhaust).toHaveLength(1); expect(cs.player.cardsPlayedThisTurn).toBe(2);
  });
  it('灰中索引只按已经发生的消耗抽牌；本牌消耗留待后续兑换', () => {
    let cs = battle(); cs.player.turnFlags.exhausted = 2; cs.player.statuses.echo = 1;
    cs = use(cs, 'ash_index', up); expect(cs.player.hand).toHaveLength(2); expect(cs.player.turnFlags.exhausted).toBe(3);
    cs = use(cs, 'ash_index', up); expect(cs.player.hand).toHaveLength(3);
  });
  it('借火鼓风消耗目标燃烧、保留不足整份部分，不能凭空产能', () => {
    let cs = battle(); cs.enemies[0].statuses.burn = 11; cs.player.statuses.echo = 1;
    cs = use(cs, 'borrow_flame', up); expect(cs.player.energy).toBe(5); expect(cs.enemies[0].statuses.burn).toBe(3);
    cs = use(cs, 'borrow_flame', up); expect(cs.player.energy).toBe(5);
  });
  it('回脉忆战认实际治疗，过量治疗不计，同一份治疗不能重复兑换', () => {
    let cs = battle(); cs.player.hp = 75;
    cs.player.ember = 4; cs = use(cs, 'cinder_mend', up); // 无论卡面治疗多少，生命缺口只有五点。
    expect(cs.player.turnFlags.actualHealing).toBe(5);
    cs.player.hand = []; cs.player.statuses.echo = 1;
    cs = use(cs, 'pulse_memory', up); expect(cs.player.hand).toHaveLength(2);
    cs = use(cs, 'pulse_memory', up); expect(cs.player.hand).toHaveLength(2);
    cs.player.ember = 4; cs = use(cs, 'cinder_mend', up); expect(cs.player.turnFlags.actualHealing).toBe(5);
  });
  it('借怒只消耗当前可用临时力量，回合末不会多扣永久力量', () => {
    let cs = battle(); cs.player.statuses.strength = 8; cs.player.statuses.strengthDown = 5;
    cs = use(cs, 'borrow_fury', up); expect(cs.player.energy).toBe(5); expect(cs.player.statuses.strength).toBe(4); expect(cs.player.statuses.strengthDown).toBe(1);
    cs = endPlayerTurn(cs).state; expect(cs.player.statuses.strength).toBe(3);
    cs = use(battle(), 'borrow_fury', up); expect(cs.player.energy).toBe(3);
  });
  it('回声批注只认完成的额外结算，普通出牌不计，下一回合清零', () => {
    let cs = battle(); cs.player.statuses.echo = 1; cs = use(cs, 'strike');
    expect(cs.player.turnFlags.resolvedCopies).toBe(1);
    cs = use(cs, 'echo_footnotes', up); expect(cs.player.hand).toHaveLength(1);
    cs = use(cs, 'echo_footnotes', up); expect(cs.player.hand).toHaveLength(1);
    cs = startPlayerTurn(endPlayerTurn(cs).state).state;
    const count = cs.player.hand.length; cs = use(cs, 'echo_footnotes', up); expect(cs.player.hand).toHaveLength(count);
  });
  it('释能演算从低蓄力起真实扣除，保留高蓄力输出的余数', () => {
    let cs = battle(); cs.player.hand = [{ ...card('charged_blade', false, 'high'), bonus: 4 }, { ...card('rune_shield', false, 'low'), bonus: 1 }];
    cs = use(cs, 'release_charge', up); expect(cs.player.energy).toBe(4);
    expect(cs.player.hand.map(c => c.bonus)).toEqual([2, 0]);
    cs = use(cs, 'release_charge', up); expect(cs.player.energy).toBe(4);
  });
  it.each(ids)('%s缺少对应资源时收益为零，预览不修改任何状态', id => {
    const cs = battle(), c = card(id, up); cs.player.hand = [c];
    const before = JSON.stringify(cs);
    const text = describeCard(c, { player: cs.player, target: cs.enemies[0], relics: cs.relics, isFirstAttack: false, crescendoBonus: 0 });
    expect(text).toContain('当前 0'); expect(JSON.stringify(cs)).toBe(before);
    const next = playCard(cs, c.uid, 'e0').state; expect(next.player.energy).toBe(3); expect(next.player.hand).toHaveLength(0);
  });
});
