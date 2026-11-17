import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARDS } from '../data/cards';
import { describeCard, viewDef } from '../engine/cards';
import { canPlayCard, createCombat, playCard } from '../engine/combat';
import { makeRng, nextInt } from '../engine/rng';
import type { CardInstance, CombatState, Effect } from '../engine/types';
import { planMove } from './cardFloorBenchmark';
import { chooseExhaust, exhaustPriority, playOptions } from './playOptions';

const CHOSEN = [
  { id: 'sift_ash', count: 1, base: '消耗手牌中随机 1 张牌，抽 2 张牌。', up: '选择手牌中 1 张牌消耗，抽 3 张牌。' },
  { id: 'ash_shell', count: 1, base: '消耗手牌中随机 1 张牌，获得 14 点格挡，获得 2 点余烬。消耗。', up: '选择手牌中 1 张牌消耗，获得 18 点格挡，获得 2 点余烬。消耗。' },
  { id: 'burial_veil', count: 2, base: '消耗手牌中随机 2 张牌，获得 13 点格挡，抽 1 张牌。', up: '选择手牌中 2 张牌消耗，获得 18 点格挡，抽 2 张牌。' },
  { id: 'ash_offering', count: 2, base: '消耗手牌中随机 2 张牌，获得 4 点余烬，抽 2 张牌。消耗。', up: '选择手牌中 2 张牌消耗，获得 5 点余烬，抽 3 张牌。消耗。' },
] as const;
const ids = CHOSEN.map(c => c.id) as readonly string[];
const card = (defId: string, uid = defId, upgraded = false): CardInstance => ({ uid, defId, upgraded });
const OTHERS = ['bone_ash', 'strike', 'defend', 'ashes'];

/** 手里是被测牌和 others；抽牌堆是按顺序的防御，抽牌不会触发洗牌。 */
function battle(id: string, upgraded: boolean, others: string[] = OTHERS): CombatState {
  const cs = createCombat('chosen-exhaust', ['tomb_puppet'], 'normal', [], 40, 80, [], makeRng(`CHOSEN-${id}`, 'c'), 100, 'picker').state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 1000;
  cs.player.hand = [card(id, 'src', upgraded), ...others.map((o, i) => card(o, `h${i}`))];
  cs.player.draw = Array.from({ length: 12 }, (_, i) => card('defend', `d${i}`));
  cs.player.discard = []; cs.player.exhaust = [];
  cs.player.energy = 3;
  return cs;
}
const exhausted = (cs: CombatState) => cs.player.exhaust.map(c => c.uid).filter(uid => uid !== 'src');
const chooses = (effects: Effect[]) => effects.filter(e => e.kind === 'exhaustHand' && e.choose).length;

describe('拾灰者：升级后选择消耗哪几张手牌', () => {
  it('只有这四张牌的升级版启用选择，基础版和其他牌（含灰中复苏）都保持随机', () => {
    for (const def of CARD_LIST) for (const up of [false, true]) {
      if (def.type === 'curse' && up) continue;
      expect(chooses(viewDef(def.id, up).effects), `${def.id}/${up}`).toBe(up && ids.includes(def.id) ? 1 : 0);
    }
  });

  it.each(CHOSEN)('$id：卡面基础版写随机，升级版写选择，数值提升保留', ({ id, base, up }) => {
    expect(describeCard(card(id), null)).toBe(base);
    expect(describeCard(card(id, id, true), null)).toBe(up);
  });

  it.each(CHOSEN)('$id+：不带选择时不结算，只说明要选几张、能选哪些牌（不含它自己）', ({ id, count }) => {
    const cs = battle(id, true), before = JSON.stringify(cs);
    const res = playCard(cs, 'src', null);
    expect(res.state).toBe(cs);
    expect(res.events).toEqual([]);
    expect(res.pending).toEqual({ group: 0, count, hand: cs.player.hand.slice(1), action: 'exhaust' });
    expect(JSON.stringify(cs)).toBe(before);
    // 等待选牌只存在于返回值里，战斗状态没有任何「选牌中」的字段，存档与回退不会卡住。
    expect(before).not.toContain('pending');
    expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(true);
  });

  it.each(CHOSEN)('$id+：选满后消耗的正是所选的牌，可以选诅咒牌和打不出的牌，不掷随机数', ({ id, count }) => {
    const cs = battle(id, true);
    cs.player.hand.push(card('titan_blows', 'heavy'));
    expect(canPlayCard(cs, cs.player.hand.find(c => c.uid === 'h3')!).ok).toBe(false);
    const pick = count === 1 ? ['h3'] : ['h3', 'heavy'];
    const res = playCard(cs, 'src', null, { exhaust: [pick] });
    expect(res.state).not.toBe(cs);
    expect(res.pending).toBeUndefined();
    expect(exhausted(res.state)).toEqual(pick);
    expect(res.state.rng).toEqual(cs.rng);
    expect(res.events.filter(e => e.type === 'cardRemoved' && e.destination === 'exhaust' && pick.includes(e.card.uid)).every(e => e.type === 'cardRemoved' && !e.random)).toBe(true);
  });

  it.each(CHOSEN)('$id+：必须选满，不能少选、多选、重复、选它自己或选不在手里的牌', ({ id, count }) => {
    const cs = battle(id, true);
    const bad = [[], count === 1 ? ['h0', 'h1'] : ['h0'], count === 1 ? ['src'] : ['h0', 'src'], count === 1 ? ['d0'] : ['h0', 'd0'], ...(count === 2 ? [['h0', 'h0'], ['h0', 'h1', 'h2']] : [])];
    for (const group of bad) {
      const res = playCard(cs, 'src', null, { exhaust: [group] });
      expect(res.state, JSON.stringify(group)).toBe(cs);
      expect(res.events).toEqual([]);
      expect(res.pending).toBeUndefined();
    }
  });

  it.each(CHOSEN)('$id+：手牌不足时选完现有的即可；手牌为空时直接打出，其余效果照常', ({ id, count }) => {
    const one = battle(id, true, ['strike']);
    expect(playCard(one, 'src', null).pending).toEqual({ group: 0, count: 1, hand: [one.player.hand[1]], action: 'exhaust' });
    const played = playCard(one, 'src', null, { exhaust: [['h0']] }).state;
    expect(exhausted(played)).toEqual(['h0']);
    if (count === 2) expect(playCard(one, 'src', null, { exhaust: [[]] }).state).toBe(one);

    const empty = battle(id, true, []);
    const res = playCard(empty, 'src', null);
    expect(res.pending).toBeUndefined();
    expect(res.state).not.toBe(empty);
    expect(exhausted(res.state)).toEqual([]);
    const p = res.state.player;
    if (id === 'sift_ash') expect(p.hand).toHaveLength(3);
    if (id === 'ash_shell') expect([p.block, p.ember]).toEqual([18, 2]);
    if (id === 'burial_veil') expect([p.block, p.hand.length]).toEqual([18, 2]);
    if (id === 'ash_offering') expect([p.ember, p.hand.length]).toEqual([5, 3]);
  });

  it.each(CHOSEN)('$id 基础版仍然随机：不需要选择，消耗的牌与随机数消耗和改动前一致', ({ id, count }) => {
    const cs = battle(id, false);
    const res = playCard(cs, 'src', null);
    expect(res.pending).toBeUndefined();
    expect(res.state).not.toBe(cs);
    // 改动前的规则：每消耗一张，在剩余手牌里掷一次 nextInt(0, 手牌数 - 1)。
    const rng = { ...cs.rng }, hand = cs.player.hand.slice(1).map(c => c.uid), expected: string[] = [];
    for (let i = 0; i < count; i++) expected.push(hand.splice(nextInt(rng, 0, hand.length - 1), 1)[0]);
    expect(exhausted(res.state)).toEqual(expected);
    expect(res.state.rng).toEqual(rng);
    // 多传一组选择也不会改变随机结果。
    expect(playCard(cs, 'src', null, { exhaust: [['h0', 'h1'].slice(0, count)] }).state).toEqual(res.state);
  });

  it('回响重放时重新选择：第二组从重放时的手牌里选，包含刚抽到的牌', () => {
    const cs = battle('sift_ash', true);
    cs.player.statuses.echo = 1;
    const first = playCard(cs, 'src', null, { exhaust: [['h1']] });
    expect(first.state).toBe(cs);
    expect(first.pending!.group).toBe(1);
    expect(first.pending!.count).toBe(1);
    expect(first.pending!.hand.map(c => c.uid)).toEqual(['h0', 'h2', 'h3', 'd11', 'd10', 'd9']);
    // 第二组不能沿用已经被消耗的牌。
    expect(playCard(cs, 'src', null, { exhaust: [['h1'], ['h1']] }).state).toBe(cs);
    const done = playCard(cs, 'src', null, { exhaust: [['h1'], ['d10']] });
    expect(done.pending).toBeUndefined();
    expect(exhausted(done.state)).toEqual(['h1', 'd10']);
    expect(done.state.player.statuses.echo ?? 0).toBe(0);
    expect(done.state.player.hand.map(c => c.uid)).toEqual(['h0', 'h2', 'h3', 'd11', 'd9', 'd8', 'd7', 'd6']);
    expect(done.state.player.energy).toBe(2);
  });

  it('回响重放时没有手牌可选就跳过消耗，其余效果照常', () => {
    const cs = battle('ash_shell', true, ['strike']);
    cs.player.statuses.echo = 1;
    const done = playCard(cs, 'src', null, { exhaust: [['h0']] });
    expect(done.pending).toBeUndefined();
    expect(exhausted(done.state)).toEqual(['h0']);
    expect([done.state.player.block, done.state.player.ember]).toEqual([36, 4]);
  });

  it('消耗触发与随机消耗完全一样：灰烬盛宴、火种传递、灰中启示、骨灰坛和消耗计数', () => {
    const setup = (up: boolean) => {
      const cs = battle('burial_veil', up, ['strike', 'defend']);
      cs.relics.push('bone_urn');
      Object.assign(cs.player.statuses, { ashFeast: 3, kindling: 4, ashInsight: 1 });
      return cs;
    };
    const chosen = playCard(setup(true), 'src', null, { exhaust: [['h0', 'h1']] }).state;
    const random = playCard(setup(false), 'src', null).state;
    expect(exhausted(chosen)).toEqual(['h0', 'h1']);
    for (const state of [chosen, random]) {
      // 随机版可能烧到消耗触发刚抽上来的牌，这里只比较触发次数。
      expect(exhausted(state)).toHaveLength(2);
      expect(state.player.turnFlags.exhausted).toBe(2);
      expect(state.player.turnFlags.ashInsight).toBe(2);
      expect(1000 - state.enemies[0].hp).toBe(8);
    }
    // 两边只差升级带来的格挡 18/13 和抽牌 2/1。
    expect(chosen.player.block - random.player.block).toBe(5);
    expect(chosen.player.hand.length - random.player.hand.length).toBe(1);
    expect(chosen.player.turnFlags.signature).toBe(random.player.turnFlags.signature);
  });

  it('现有的选牌牌不受影响：字符串形式的 replayUid 与对象形式等价', () => {
    const cs = createCombat('chosen-legacy', ['tomb_puppet'], 'normal', [], 60, 60, [], makeRng('LEGACY', 'c'), 100, 'oathbound').state;
    cs.player.hand = [card('oath_reenactment', 'src')];
    cs.player.discard = [card('strike', 'target')];
    cs.player.energy = 3;
    const legacy = playCard(cs, 'src', 'e0', 'target');
    expect(legacy.state).not.toBe(cs);
    expect(legacy.pending).toBeUndefined();
    expect(playCard(cs, 'src', 'e0', { replayUid: 'target' })).toEqual(legacy);
    expect(playCard(cs, 'src', 'e0', { replayUid: 'target', exhaust: [['target']] })).toEqual(legacy);
    expect(playCard(cs, 'src', 'e0').state).toBe(cs);
  });
});

describe('测试机器人的选牌规则', () => {
  it('优先诅咒和状态牌，其次打击、防御，再其次本回合打不出的牌，最后才是其他牌', () => {
    const cs = battle('sift_ash', true, ['bone_ash', 'titan_blows', 'defend', 'ashes', 'strike', 'dazed']);
    cs.player.energy = 1;
    const hand = cs.player.hand.slice(1);
    expect(hand.map(c => exhaustPriority(cs, c))).toEqual([3, 2, 1, 0, 1, 0]);
    expect(chooseExhaust(cs, hand, 6).map(uid => hand.find(c => c.uid === uid)!.defId)).toEqual(['ashes', 'dazed', 'defend', 'strike', 'titan_blows', 'bone_ash']);
    expect(chooseExhaust(cs, hand, 2)).toEqual(['h3', 'h5']);
  });

  it('机器人出这些牌时带齐每一组选择，回响时也一样；规划出的一步可以直接结算', () => {
    for (const { id, count } of CHOSEN) {
      const cs = battle(id, true);
      cs.player.statuses.echo = 1;
      const [option] = playOptions(cs, cs.player.hand[0]);
      expect(typeof option.replayUid).toBe('object');
      const res = playCard(cs, 'src', option.target, option.replayUid);
      expect(res.state, id).not.toBe(cs);
      expect(res.pending).toBeUndefined();
      // 第一组按规则先烧诅咒（h3 灰烬），不足再烧打击。
      expect(exhausted(res.state).slice(0, count)).toEqual(count === 1 ? ['h3'] : ['h3', 'h1']);
    }
    const cs = battle('sift_ash', true, ['ashes', 'ashes']);
    cs.player.energy = 1;
    const move = planMove(cs, { depth: 2, width: 3, engines: true });
    if (move) expect(playCard(cs, move.uid, move.target, move.replayUid).state).not.toBe(cs);
    expect(CARDS.sift_ash.upgrade?.effects?.[0]).toEqual({ kind: 'exhaustHand', count: 1, choose: true });
  });
});
