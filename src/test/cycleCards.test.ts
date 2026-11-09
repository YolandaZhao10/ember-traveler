import { describe, expect, it } from 'vitest';
import { CYCLE_CARDS } from '../data/cycleCards';
import { CARDS } from '../data/cards';
import { cardTransferChoices, cardTransferEffect } from '../engine/cardTransfer';
import { describeCard, viewCard } from '../engine/cards';
import { HAND_MAX, canPlayCard, createCombat, discardReplayChoices, endPlayerTurn, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import type { CardInstance, CombatState } from '../engine/types';

const card = (defId: string, upgraded = false, uid = defId): CardInstance => ({ defId, upgraded, uid });
function fixture(id: string, up = false) {
  const cs = createCombat('cycle', ['tomb_puppet'], 'normal', [], 50, 80, [], makeRng('CYCLE', 'c'), 100, CARDS[id].owner ?? 'traveler').state;
  cs.player.hand = [card(id, up)];
  cs.player.discard = [card('strike'), card('defend'), card('borrow_flame')];
  cs.player.draw = Array.from({ length: 12 }, (_, i) => card('defend', false, `draw-${i}`));
  cs.player.exhaust = [card('vein_cutter')];
  cs.enemies[0].hp = cs.enemies[0].maxHp = 1000; cs.enemies[0].statuses = {};
  return cs;
}
const piles = (cs: CombatState) => [cs.player.hand, cs.player.draw, cs.player.discard, cs.player.exhaust].flat();
const uids = (cs: CombatState) => piles(cs).map(c => c.uid).sort();
const use = (cs: CombatState, uid: string, selected?: string) => playCard(cs, uid, viewCard(cs.player.hand.find(c => c.uid === uid)!).target === 'enemy' ? 'e0' : null, selected).state;

describe.each([false, true])('循环卡基础/升级=%s', up => {
  it.each(CYCLE_CARDS)('$name 能合法结算，实体牌守恒，回响不复制所选牌', def => {
    const cs = fixture(def.id, up), source = cs.player.hand[0], saved = JSON.stringify(cs);
    cs.player.statuses.echo = 1;
    const expected = uids(cs), choice = cardTransferChoices(cs, source)[0];
    const after = use(cs, source.uid, choice?.uid);
    expect(after).not.toBe(cs); expect(uids(after)).toEqual(expected);
    expect(after.player.energy).toBe(3 - viewCard(source).cost);
    expect(after.player.cardsPlayedThisTurn).toBe(2);
    if (choice) expect(piles(after).filter(c => c.uid === choice.uid)).toHaveLength(1);
    expect(cs.player.hand[0]).toEqual(JSON.parse(saved).player.hand[0]);
    expect(describeCard(source, null)).not.toContain('undefined');
    if (def.exhaust) expect(after.player.exhaust.some(c => c.uid === source.uid)).toBe(true);
  });
  it('选择技能置顶后下一次抽牌优先获得，费用按原卡支付', () => {
    let cs = fixture('shield_rotation', up);
    cs.player.hand.push(card('spin_kick'));
    cs = use(cs, 'shield_rotation', 'defend');
    expect(cs.player.draw[cs.player.draw.length - 1]?.uid).toBe('defend');
    expect(cs.player.statuses.energyNext).toBe(1);
    cs = use(cs, 'spin_kick');
    expect(cs.player.hand.some(c => c.uid === 'defend')).toBe(true);
    expect(cs.player.cardsPlayedThisTurn).toBe(2);
  });
  it('余烬拾遗费用1→0，自身消耗，可选择一张已经消耗的回血牌但不免费打出', () => {
    const cs = fixture('ember_retrieval', up), hp = cs.player.hp;
    const after = use(cs, 'ember_retrieval', 'vein_cutter');
    expect(after.player.energy).toBe(up ? 3 : 2);
    expect(after.player.hp).toBe(hp); expect(after.player.hand[0].uid).toBe('vein_cutter');
    expect(after.player.exhaust.map(c => c.uid)).toEqual(['ember_retrieval']);
  });
});

describe('牌堆选择事务', () => {
  it('随机三选一查看不推进随机流，取消/序列化重开仍是同一组，不能选择未展示的牌', () => {
    const cs = fixture('star_page_search'), source = cs.player.hand[0], before = JSON.stringify(cs);
    const choices = cardTransferChoices(cs, source);
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map(c => c.uid)).size).toBe(3);
    expect(cardTransferChoices(JSON.parse(before), source)).toEqual(choices);
    expect(JSON.stringify(cs)).toBe(before);
    const hidden = cs.player.draw.find(c => !choices.some(x => x.uid === c.uid))!;
    for (const uid of [undefined, 'missing', hidden.uid, 'strike']) expect(use(cs, source.uid, uid)).toBe(cs);
    const after = use(cs, source.uid, choices[1].uid);
    expect(after.player.hand.map(c => c.uid)).toEqual([choices[1].uid]);
    expect(after.player.draw.map(c => c.uid)).toEqual(cs.player.draw.filter(c => c.uid !== choices[1].uid).map(c => c.uid));
    expect(after.rng).not.toEqual(cs.rng);
  });
  it('候选不足三张时展示全部，空堆不能出牌也不扣费', () => {
    const cs = fixture('star_page_search'); cs.player.draw = [card('strike')];
    expect(cardTransferChoices(cs, cs.player.hand[0])).toHaveLength(1);
    cs.player.draw = [];
    expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(false);
    expect(use(cs, 'star_page_search', 'strike')).toBe(cs);
  });
  it('弃牌过滤按类型与消耗属性，不从消耗区偷取；血誓重演不接受嵌套选牌', () => {
    const attack = fixture('blade_recall');
    expect(cardTransferChoices(attack, attack.player.hand[0]).map(c => c.uid)).toEqual(['strike']);
    const fuel = fixture('cinder_salvage');
    expect(cardTransferChoices(fuel, fuel.player.hand[0]).map(c => c.uid)).toEqual(['borrow_flame']);
    expect(use(fuel, 'cinder_salvage', 'vein_cutter')).toBe(fuel);
    fuel.player.discard = CYCLE_CARDS.filter(c => cardTransferEffect(card(c.id))).map(c => card(c.id));
    expect(discardReplayChoices(fuel)).toEqual([]);
  });
  it('失血触发洗牌抽牌时，被选中的实体先保留，之后只回手一次', () => {
    const cs = fixture('blood_tether'); cs.player.draw = []; cs.player.discard = [card('strike'), card('defend')];
    cs.player.statuses.bloodDraw = 2;
    const after = use(cs, 'blood_tether', 'strike');
    expect(after.player.hand.map(c => c.uid).sort()).toEqual(['defend', 'strike']);
    expect(uids(after)).toEqual(uids(cs));
  });
  it('失血触发补满手牌时，被选牌留在来源；失血死亡时也不丢牌', () => {
    const cs = fixture('blood_tether');
    cs.player.hand.push(...Array.from({ length: HAND_MAX - 1 }, (_, i) => card('defend', false, `h-${i}`)));
    cs.player.statuses.bloodDraw = 1;
    const after = use(cs, 'blood_tether', 'strike');
    expect(after.player.hand).toHaveLength(HAND_MAX);
    expect(after.player.discard.some(c => c.uid === 'strike')).toBe(true);
    expect(uids(after)).toEqual(uids(cs));
    const dying = fixture('blood_tether'); dying.player.hp = 2;
    const lost = use(dying, 'blood_tether', 'strike');
    expect(lost.outcome).toBe('lost'); expect(uids(lost)).toEqual(uids(dying));
  });
  it('消耗区回收排除自己、另一张同牌及条件回收牌，阻止零费互捞', () => {
    const cs = fixture('ember_retrieval', true);
    cs.player.exhaust = ['ember_retrieval', 'shard_throw', 'ember_salvage', 'rekindle_coals'].map(id => card(id, true, `ex-${id}`));
    expect(cardTransferChoices(cs, cs.player.hand[0])).toEqual([]);
    for (const c of cs.player.exhaust) expect(use(cs, 'ember_retrieval', c.uid)).toBe(cs);
    expect(describeCard(cs.player.hand[0], null)).toContain('不能选择带消耗区回收效果');
  });
  it('保留当前手牌一回合；之后新抽的牌正常弃置，刷新后仍保留，下回合不永久保留', () => {
    let cs = fixture('scar_hold'); cs.player.hand.push(card('defend'), card('spin_kick'));
    cs = use(cs, 'scar_hold'); cs = use(cs, 'spin_kick');
    const drawn = cs.player.hand.find(c => c.uid !== 'defend')!;
    cs = endPlayerTurn(JSON.parse(JSON.stringify(cs))).state;
    expect(cs.player.hand.map(c => c.uid)).toEqual(['defend']);
    expect(cs.player.discard.some(c => c.uid === drawn.uid)).toBe(true);
    cs.phase = 'enemy'; cs = startPlayerTurn(cs).state;
    cs = endPlayerTurn(cs).state;
    expect(cs.player.hand).toHaveLength(0);
  });
  it('SL恢复选择前资源、牌堆及取样，重做不会复制实体', () => {
    let run = R.newRun('CYCLE-SL', 'scholar'); run.screen = 'combat'; run.combat = fixture('star_page_search');
    const { checkpoint: _checkpoint, ...snapshot } = run; run.checkpoint = structuredClone(snapshot);
    const before = structuredClone(run), choice = cardTransferChoices(run.combat, run.combat.player.hand[0])[1];
    run = R.combatPlayCard(run, 'star_page_search', null, choice.uid).run;
    const played = structuredClone(run.combat);
    run = R.resetCurrentNode(JSON.parse(JSON.stringify(run)));
    expect(run.combat).toEqual(before.combat);
    expect(R.combatPlayCard(run, 'star_page_search', null, choice.uid).run.combat).toEqual(played);
  });
});

describe('四角色资源牌实际联动', () => {
  it('旅人回收攻击接第三攻返能，再用战途补给兑换真实连击次数', () => {
    let cs = fixture('blade_recall'); cs.player.hand.push(card('trail_supply'));
    cs.player.statuses.comboFlow = 1; cs.player.attacksPlayedThisTurn = 2;
    cs = use(cs, 'blade_recall', 'strike'); cs = use(cs, 'strike');
    expect(cs.player.energy).toBe(2); expect(cs.player.attacksPlayedThisTurn).toBe(3);
    cs = use(cs, 'trail_supply');
    expect(cs.player.hand).toHaveLength(2); expect(cs.player.exhaust.some(c => c.uid === 'trail_supply')).toBe(true);
  });
  it('拾灰者回收未用的借火鼓风，补燃烧后真实消耗燃烧换费', () => {
    let cs = fixture('cinder_salvage', true);
    cs = use(cs, 'cinder_salvage', 'borrow_flame');
    expect(cs.enemies[0].statuses.burn).toBe(4);
    cs = use(cs, 'borrow_flame');
    expect(cs.player.energy).toBe(3); expect(cs.enemies[0].statuses.burn ?? 0).toBe(0);
    expect(cs.player.exhaust.some(c => c.uid === 'borrow_flame')).toBe(true);
    expect(cardTransferChoices(cs, card('cinder_salvage'))).toEqual([]);
  });
  it('血线牵引触发失血抽牌、血甲和盟约，接回血与回脉忆战；资源受代价与消耗限制', () => {
    let cs = fixture('blood_tether'); cs.player.hand.push(card('pulse_memory'));
    cs.player.discard = [card('vein_cutter')]; cs.player.exhaust = [];
    cs.player.statuses = { bloodDraw: 1, bloodArmor: 3, bloodOath: 2 };
    cs.player.turnFlags.bloodOathLoss = 1;
    cs = use(cs, 'blood_tether', 'vein_cutter');
    expect(cs.player.energy).toBe(4); expect(cs.player.block).toBe(3);
    expect(cs.player.hp).toBe(49);
    cs = use(cs, 'vein_cutter'); cs = use(cs, 'pulse_memory');
    expect(cs.player.hand.length).toBeGreaterThan(1);
    expect(cs.player.exhaust.map(c => c.uid)).toEqual(expect.arrayContaining(['blood_tether', 'vein_cutter', 'pulse_memory']));
    expect(canPlayCard(cs, card('blood_tether')).ok).toBe(false);
  });
  it('学者置顶释能演算并蓄力，抽到后可花蓄力换费，不能重复核销', () => {
    let cs = fixture('palimpsest', true);
    cs.player.hand.push(card('charged_blade'), card('patient_study'));
    cs.player.discard = [card('release_charge')];
    cs = use(cs, 'palimpsest', 'release_charge');
    expect(cs.player.hand.find(c => c.uid === 'charged_blade')?.bonus).toBe(2);
    cs = use(cs, 'patient_study'); expect(cs.player.hand.some(c => c.uid === 'release_charge')).toBe(true);
    cs = use(cs, 'release_charge');
    expect(cs.player.energy).toBe(2); expect(cs.player.hand.find(c => c.uid === 'charged_blade')?.bonus).toBe(0);
    expect(cs.player.exhaust.some(c => c.uid === 'release_charge')).toBe(true);
  });
  it('回收与抽牌攻击可以形成小循环，但每次消耗能量，零能量会停止', () => {
    let cs = fixture('blood_tether');
    cs.player.hand = [card('blade_recall', false, 'recall-a')];
    cs.player.discard = [card('spin_kick')]; cs.player.draw = [];
    cs.player.energy = 3;
    cs = use(cs, 'recall-a', 'spin_kick'); cs = use(cs, 'spin_kick');
    // 回旋踢抽回刚弃置的整备，实体守恒；第二轮仍需支付能量。
    expect(cs.player.hand.some(c => c.uid === 'recall-a')).toBe(true);
    cs = use(cs, 'recall-a', 'spin_kick');
    expect(cs.player.energy).toBe(0); expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(false);
    expect(uids(cs)).toEqual(['spin_kick', 'recall-a', 'vein_cutter'].sort());
  });
});
