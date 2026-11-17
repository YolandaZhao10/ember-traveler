import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { describeCard, viewDef } from '../engine/cards';
import { HAND_MAX, createCombat, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import type { CardInstance, CombatState } from '../engine/types';

const card = (defId: string, uid = defId, upgraded = false): CardInstance => ({ uid, defId, upgraded });
const text = (id: string, up: boolean) => describeCard(card(id, id, up), null);
function battle(id: string, upgraded: boolean, others: string[] = []): CombatState {
  const cs = createCombat('ash-rework', ['tomb_puppet'], 'normal', [], 40, 80, [], makeRng(`ASH-${id}`, 'c'), 100, 'picker').state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 1000;
  cs.player.hand = [card(id, 'src', upgraded), ...others.map((o, i) => card(o, `h${i}`))];
  cs.player.draw = Array.from({ length: 30 }, (_, i) => card('defend', `d${i}`));
  cs.player.discard = []; cs.player.exhaust = []; cs.player.energy = 3;
  return cs;
}
const play = (cs: CombatState, choice?: Parameters<typeof playCard>[3]) => {
  const res = playCard(cs, 'src', null, choice);
  expect(res.state).not.toBe(cs);
  return res.state;
};

describe('拾灰者灰烬路线五张牌的调整', () => {
  it.each([false, true])('灰壳：罕见；余烬基础和升级都是 2，格挡 14/18，升级后仍可自选（升级=%s）', up => {
    expect([CARDS.ash_shell.rarity, CARDS.ash_shell.cost, CARDS.ash_shell.owner]).toEqual(['uncommon', 1, 'picker']);
    expect(text('ash_shell', up)).toBe(up ? '选择手牌中 1 张牌消耗，获得 18 点格挡，获得 2 点余烬。消耗。' : '消耗手牌中随机 1 张牌，获得 14 点格挡，获得 2 点余烬。消耗。');
    const after = play(battle('ash_shell', up, ['strike', 'ashes']), up ? { exhaust: [['h1']] } : undefined);
    expect([after.player.block, after.player.ember]).toEqual([up ? 18 : 14, 2]);
    if (up) expect(after.player.exhaust.map(c => c.uid)).toEqual(['h1', 'src']);
  });

  it.each([false, true])('拾取：抽 2 张牌，获得 1/2 点余烬，消耗（升级=%s）', up => {
    expect(text('pick_up', up)).toBe(`抽 2 张牌，获得 ${up ? 2 : 1} 点余烬。消耗。`);
    const after = play(battle('pick_up', up));
    expect([after.player.hand.length, after.player.ember, after.player.energy, after.player.exhaust.map(c => c.uid)]).toEqual([2, up ? 2 : 1, 3, ['src']]);
  });

  it('拾取是拾灰者的初始牌：新开局与按 id 存放的旧存档牌都读到新效果', () => {
    expect(CHARACTERS.picker.starterDeck).toContain('pick_up');
    const run = R.newRun('ASH-REWORK', 'picker');
    const starter = run.deck.find(c => c.defId === 'pick_up')!;
    expect(describeCard(starter, null)).toBe('抽 2 张牌，获得 1 点余烬。消耗。');
    // 旧存档里只存 defId 与是否升级，读出来就是当前定义。
    const old: CardInstance = JSON.parse(JSON.stringify({ uid: 'old-save', defId: 'pick_up', upgraded: true }));
    expect(describeCard(old, null)).toBe('抽 2 张牌，获得 2 点余烬。消耗。');
    expect(viewDef('pick_up', true).effects).toEqual([{ kind: 'draw', amount: 2 }, { kind: 'gainEmber', amount: 2 }]);
  });

  it.each([false, true])('灰烬盛宴：每次消耗获得 5/8 点格挡，前 2 次消耗各抽 1 张不变（升级=%s）', up => {
    expect(text('ash_feast', up)).toBe(`每当你的一张牌被消耗时，获得 ${up ? 8 : 5} 点格挡，每回合生效后的前 2 次消耗，每次抽 1 张牌。`);
    let cs = play(battle('ash_feast', up));
    expect([cs.player.statuses.ashFeast, cs.player.statuses.ashInsight]).toEqual([up ? 8 : 5, 1]);
    cs.player.hand = [card('pick_up', 'src'), card('pick_up', 'p2'), card('pick_up', 'p3')];
    cs = play(cs);
    expect(cs.player.block).toBe(up ? 8 : 5);
    cs = playCard(cs, 'p2', null).state; cs = playCard(cs, 'p3', null).state;
    expect(cs.player.block).toBe(3 * (up ? 8 : 5));
    // 三张拾取各抽 2 张，加上前两次消耗各 1 张。
    expect(cs.player.hand).toHaveLength(8);
  });

  it.each([false, true])('灰中索引：没有上限，本回合每消耗过 1 张牌抽 1 张；升级后额外再抽 1 张（升级=%s）', up => {
    expect(text('ash_index', up)).toBe(up ? '本回合每消耗 1 张牌可兑换抽 1 张牌；已兑换部分不能重复计算，抽 1 张牌。消耗。' : '本回合每消耗 1 张牌可兑换抽 1 张牌；已兑换部分不能重复计算。消耗。');
    expect(viewDef('ash_index', up).effects[0]).toEqual({ kind: 'convertResource', resource: 'exhausts', per: 1, reward: 'draw' });
    for (const exhausted of [0, 1, 3, 6]) {
      const cs = battle('ash_index', up);
      cs.player.turnFlags.exhausted = exhausted;
      const after = play(cs);
      expect(after.player.hand, `已消耗 ${exhausted}`).toHaveLength(exhausted + (up ? 1 : 0));
      expect(after.player.turnFlags['converted:exhausts'] ?? 0).toBe(exhausted);
      expect(after.player.energy).toBe(3);
    }
  });

  it('灰中索引：已兑换的消耗不能重复计算，它自己的消耗留给之后的兑换；抽牌受手牌上限约束', () => {
    let cs = battle('ash_index', false, ['ash_index']);
    cs.player.turnFlags.exhausted = 2;
    cs = play(cs);
    expect(cs.player.hand.filter(c => c.defId === 'defend')).toHaveLength(2);
    // 第二张只能兑换第一张自身被消耗的那 1 次。
    cs = playCard(cs, 'h0', null).state;
    expect(cs.player.hand.filter(c => c.defId === 'defend')).toHaveLength(3);
    const full = battle('ash_index', true, Array.from({ length: 7 }, () => 'strike'));
    full.player.turnFlags.exhausted = 20;
    const capped = play(full);
    expect(capped.player.hand).toHaveLength(HAND_MAX);
    expect(capped.player.turnFlags['converted:exhausts']).toBe(20);
  });

  it.each([false, true])('灰中复苏：2 费、升级后 1 费，回复 12，基础和升级都随机消耗 2 张（升级=%s）', up => {
    expect([CARDS.phoenix_breath.cost, CARDS.phoenix_breath.upgrade?.cost, CARDS.phoenix_breath.rarity]).toEqual([2, 1, 'rare']);
    expect(viewDef('phoenix_breath', up).cost).toBe(up ? 1 : 2);
    expect(text('phoenix_breath', up)).toBe('消耗手牌中随机 2 张牌，回复 12 点生命。消耗。');
    const cs = battle('phoenix_breath', up, ['strike', 'defend', 'ashes']);
    const res = playCard(cs, 'src', null);
    expect(res.pending).toBeUndefined();
    const p = res.state.player;
    expect([p.hp, p.energy, p.exhaust.length, p.hand.length]).toEqual([52, up ? 2 : 1, 3, 1]);
    expect(res.state.rng).not.toEqual(cs.rng);
  });

  it('其他带上限的兑换牌不受影响；另外四张自选牌仍然自选', () => {
    for (const def of CARD_LIST) for (const up of [false, true]) {
      if (def.type === 'curse' && up) continue;
      for (const e of viewDef(def.id, up).effects) if (e.kind === 'convertResource' && def.id !== 'ash_index') expect(e.max, def.id).toBeGreaterThan(0);
    }
    for (const id of ['sift_ash', 'ash_shell', 'burial_veil', 'ash_offering']) {
      expect(viewDef(id, true).effects[0], id).toMatchObject({ kind: 'exhaustHand', choose: true });
      expect(viewDef(id, false).effects[0], id).not.toHaveProperty('choose');
    }
    for (const up of [false, true]) expect(viewDef('phoenix_breath', up).effects[0]).toEqual({ kind: 'exhaustHand', count: 2 });
  });
});
