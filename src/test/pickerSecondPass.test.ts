import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARDS, RETIRED_CARDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { cardTransferChoices } from '../engine/cardTransfer';
import { canPlayCard, createCombat, endPlayerTurn, playCard, type PlayChoice } from '../engine/combat';
import { describeCard } from '../engine/cards';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CardInstance, CombatState } from '../engine/types';

const card = (defId: string, uid = defId, upgraded = false): CardInstance => ({ uid, defId, upgraded, bonus: 0 });
const text = (id: string, upgraded: boolean) => describeCard(card(id, id, upgraded), null);

function battle(id: string, upgraded: boolean, enemies = 1, relics: string[] = []): CombatState {
  const cs = createCombat('picker-pass2', Array.from({ length: enemies }, () => 'tomb_puppet'), 'normal', [], 50, 60, relics, makeRng(`${id}-${upgraded}`, 'combat'), 100, 'picker').state;
  for (const enemy of cs.enemies) { enemy.hp = enemy.maxHp = 1000; enemy.block = 0; enemy.statuses = {}; enemy.burnApplied = 0; }
  cs.player.hand = [card(id, id, upgraded)];
  cs.player.draw = Array.from({ length: 10 }, (_, i) => card('defend', `draw-${i}`));
  cs.player.energy = 3;
  return cs;
}
function play(cs: CombatState, id: string, choice?: string | PlayChoice): CombatState {
  const before = structuredClone(cs);
  const result = playCard(cs, id, CARDS[cs.player.hand.find(c => c.uid === id)!.defId].target === 'enemy' ? cs.enemies[0].id : null, choice).state;
  expect(result, `${id} 应能打出`).not.toBe(cs);
  expect(cs).toEqual(before);
  return result;
}
const lost = (cs: CombatState, i = 0) => 1000 - cs.enemies[i].hp;
const burn = (cs: CombatState) => cs.enemies.map(e => e.statuses.burn ?? 0);

describe('拾灰者·焚烧（第二轮）', () => {
  it.each([false, true])('点燃带消耗；它是初始牌，新开局的牌组里就是新效果（升级=%s）', up => {
    expect(text('light_up', up)).toBe(`造成 ${up ? 10 : 7} 点伤害，对目标施加 ${up ? 4 : 3} 层燃烧。消耗。`);
    expect(CHARACTERS.picker.starterDeck).toContain('light_up');
    const after = play(battle('light_up', up), 'light_up');
    expect([lost(after), burn(after), after.player.exhaust.map(c => c.defId), after.player.discard]).toEqual([up ? 10 : 7, [up ? 4 : 3], ['light_up'], []]);
  });

  it.each([false, true])('燎原只点燃目标 4/6 层（升级=%s）', up => {
    expect(text('wildfire', up)).toBe(`对目标施加 ${up ? 6 : 4} 层燃烧。`);
    expect(CARDS.wildfire.target).toBe('enemy');
    expect(burn(play(battle('wildfire', up, 2), 'wildfire'))).toEqual([up ? 6 : 4, 0]);
  });

  it('余火 2 费；拨炭燃烧 3/4；炉口吐息升为罕见；不灭之火 2 费（升级 1 费）', () => {
    expect(CARDS.lingering_fire.cost).toBe(2);
    expect([text('tend_coals', false), text('tend_coals', true)]).toEqual(['对目标施加 3 层燃烧，抽 1 张牌。', '对目标施加 4 层燃烧，抽 1 张牌。']);
    expect(CARDS.furnace_breath.rarity).toBe('uncommon');
    expect([CARDS.everburning.cost, CARDS.everburning.upgrade?.cost]).toEqual([2, 1]);
    const after = play(battle('lingering_fire', false), 'lingering_fire');
    expect([after.player.energy, burn(after), after.player.block]).toEqual([1, [4], 7]);
  });

  it.each([false, true])('灼灰横扫：技能，2 费（升级 1 费），不造成伤害，对所有敌人施加 3 层燃烧（升级=%s）', up => {
    expect([CARDS.scalding_sweep.type, CARDS.scalding_sweep.cost, CARDS.scalding_sweep.upgrade?.cost]).toEqual(['skill', 2, 1]);
    expect(text('scalding_sweep', up)).toBe('对所有敌人施加 3 层燃烧。');
    const after = play(battle('scalding_sweep', up, 2), 'scalding_sweep');
    expect([burn(after), after.enemies.map(e => e.hp), after.player.energy, after.player.attacksPlayedThisTurn]).toEqual([[3, 3], [1000, 1000], up ? 2 : 1, 0]);
  });

  it.each([false, true])('借火鼓风：每 4/3 层换 1 点能量，没有上限，目标燃烧全部消耗，余数也不留（升级=%s）', up => {
    expect(text('borrow_flame', up)).toBe(`消耗目标所有燃烧：每 ${up ? 3 : 4} 层获得 1 点能量。消耗。`);
    for (const layers of [0, 2, 11, 40]) {
      const cs = battle('borrow_flame', up); cs.player.energy = 0;
      if (layers) cs.enemies[0].statuses.burn = layers;
      const after = play(cs, 'borrow_flame');
      expect([after.player.energy, burn(after)], `${layers} 层`).toEqual([Math.floor(layers / (up ? 3 : 4)), [0]]);
    }
  });

  it.each([false, true])('引爆：2 费，每层 2/3 点伤害（升级=%s）', up => {
    expect(text('detonate', up)).toBe(`移除目标所有燃烧，每层造成 ${up ? 3 : 2} 点伤害。`);
    const cs = battle('detonate', up); cs.enemies[0].statuses.burn = 7;
    const after = play(cs, 'detonate');
    expect([lost(after), burn(after), after.player.energy]).toEqual([up ? 21 : 14, [0], 1]);
  });

  it.each([false, true])('烟幕护身：格挡固定 7，虚弱 1/2（升级=%s）', up => {
    expect(text('smoke_cover', up)).toBe(`消耗手牌中随机 1 张牌，获得 7 点格挡，对所有敌人施加 ${up ? 2 : 1} 层虚弱。`);
  });

  it.each([false, true])('拾薪归炉：从消耗堆选 1 张牌移入弃牌堆，不触发消耗，对所有敌人施加 3/4 层燃烧（升级=%s）', up => {
    expect(text('cinder_salvage', up)).toBe(`从消耗区选择 1 张牌移入弃牌堆，对所有敌人施加 ${up ? 4 : 3} 层燃烧。`);
    const cs = battle('cinder_salvage', up, 2);
    cs.player.exhaust = [card('strike', 'gone-a'), card('bone_ash', 'gone-b')];
    cs.player.discard = [card('defend', 'in-discard')];
    expect(cardTransferChoices(cs, cs.player.hand[0]).map(c => c.uid)).toEqual(['gone-a', 'gone-b']);
    expect(playCard(cs, 'cinder_salvage', null, 'in-discard').state).toBe(cs);
    const after = play(cs, 'cinder_salvage', 'gone-b');
    expect(after.player.exhaust.map(c => c.uid)).toEqual(['gone-a']);
    expect(after.player.discard.map(c => c.uid)).toEqual(['in-discard', 'gone-b', 'cinder_salvage']);
    expect([burn(after), after.player.turnFlags.exhausted ?? 0]).toEqual([[up ? 4 : 3, up ? 4 : 3], 0]);
  });

  it('拾薪归炉在消耗堆没有牌时不能打出（沿用牌堆选牌的既有规则）', () => {
    const cs = battle('cinder_salvage', false);
    expect(canPlayCard(cs, cs.player.hand[0])).toEqual({ ok: false, reason: '牌堆中没有符合条件的牌' });
  });

  it.each([false, true])('热浪：倍率 4/5，不再施加虚弱（升级=%s）', up => {
    expect(text('heat_wave', up)).toBe(`对所有敌人造成等于其燃烧层数 × ${up ? 5 : 4} 的伤害。`);
    const cs = battle('heat_wave', up, 2); cs.enemies[0].statuses.burn = 3; cs.enemies[1].statuses.burn = 5;
    const after = play(cs, 'heat_wave');
    expect([lost(after, 0), lost(after, 1), after.enemies.map(e => e.statuses.weak ?? 0)]).toEqual(up ? [15, 25, [0, 0]] : [12, 20, [0, 0]]);
  });

  it.each([false, true])('白热：每层 1 点余烬不设上限，每 3/2 层 1 点能量，抽 3 张（升级=%s）', up => {
    expect(text('white_hot', up)).toBe(`消耗目标所有燃烧：每层获得 1 点余烬，每 ${up ? 2 : 3} 层获得 1 点能量，抽 3 张牌。消耗。`);
    const cs = battle('white_hot', up); cs.enemies[0].statuses.burn = 25; cs.player.energy = 1;
    const after = play(cs, 'white_hot');
    expect([after.player.ember, after.player.energy, after.player.hand.length, burn(after)]).toEqual([25, up ? 12 : 8, 3, [0]]);
  });

  it.each([false, true])('火葬：稀有技能，3 费，消耗；点燃后立即结算一次燃烧伤害（升级=%s）', up => {
    const n = up ? 21 : 14;
    const def = CARDS.cremation;
    expect([def.type, def.rarity, def.cost, def.exhaust]).toEqual(['skill', 'rare', 3, true]);
    expect(text('cremation', up)).toBe(`对所有敌人施加 ${n} 层燃烧，立即结算一次所有敌人的燃烧伤害；若有敌人因此死亡，将其剩余燃烧施加给其他所有敌人。消耗。`);
    const cs = battle('cremation', up, 2); cs.enemies[1].statuses.burn = 3; cs.enemies[0].block = 50;
    const after = play(cs, 'cremation');
    // 燃烧伤害无视格挡；结算后各减 1 层。
    expect([lost(after, 0), lost(after, 1), burn(after), after.enemies[0].block]).toEqual([n, n + 3, [n - 1, n + 2], 50]);
    expect([after.player.energy, after.player.exhaust.map(c => c.defId), after.player.statuses.burningRelay ?? 0]).toEqual([0, ['cremation'], 0]);
  });

  it('火葬：被这次结算烧死的敌人把剩余燃烧传给其他敌人，传过去的燃烧本次不再结算；不灭之火生效时不减层；引火盒照常 +2', () => {
    const cs = battle('cremation', false, 3); cs.enemies[0].hp = 10; cs.enemies[0].statuses.burn = 6;
    const after = play(cs, 'cremation');
    expect(after.enemies[0].hp).toBe(0);
    // 死者剩 19 层；另外两个各自结算后剩 13 层，再各得 19 层。
    expect([burn(after).slice(1), lost(after, 1), lost(after, 2)]).toEqual([[32, 32], 14, 14]);
    const ever = battle('cremation', false); ever.player.statuses.everburn = 1;
    expect(burn(play(ever, 'cremation'))).toEqual([14]);
    const box = play(battle('cremation', false, 1, ['tinderbox']), 'cremation');
    expect([lost(box), burn(box)]).toEqual([16, [13]]);
  });

  it.each([false, true])('送葬火炬：2 费（升级 1 费），每层 6 点伤害，不再有固定伤害，重新点燃 5 层（升级=%s）', up => {
    expect(text('funeral_pyre', up)).toBe('移除目标所有燃烧，每层造成 6 点伤害，对目标施加 5 层燃烧。');
    const cs = battle('funeral_pyre', up); cs.enemies[0].statuses.burn = 4;
    const after = play(cs, 'funeral_pyre');
    expect([lost(after), burn(after), after.player.energy]).toEqual([24, [5], up ? 2 : 1]);
    expect(lost(play(battle('funeral_pyre', up), 'funeral_pyre'))).toBe(0);
  });

  it.each([false, true])('窒息余火：不再施加脆弱，改为清除自身的负面效果（升级=%s）', up => {
    expect(text('choking_embers', up)).toBe(`对所有敌人施加 ${up ? 8 : 6} 层燃烧，对所有敌人施加 ${up ? 3 : 2} 层虚弱，清除自身的虚弱、易伤、脆弱与燃烧。`);
    const cs = battle('choking_embers', up, 2);
    cs.player.statuses = { weak: 2, vulnerable: 1, frail: 3, burn: 4, strength: 2, thorns: 1 };
    const after = play(cs, 'choking_embers');
    expect(after.player.statuses).toEqual({ strength: 2, thorns: 1 });
    expect(after.enemies.map(e => [e.statuses.burn, e.statuses.weak, e.statuses.frail ?? 0])).toEqual(Array(2).fill([up ? 8 : 6, up ? 3 : 2, 0]));
  });

  it('不息炉膛：每回合首次一次性实际消耗至少 3 点余烬就触发，不限于卡牌；不足 3 点不触发，每回合一次', () => {
    expect(text('undying_furnace', false)).toBe('每回合首次实际消耗至少 3 点余烬时，对所有敌人施加 6 层燃烧。');
    // 篝火避难所在回合结束时自动消耗 3 点余烬：不是因一张牌，也触发。
    const cs = battle('strike', false, 2);
    Object.assign(cs.player.statuses, { emberConduit: 6, emberBastion: 18 }); cs.player.ember = 4;
    const ended = endPlayerTurn(cs).state;
    expect([burn(ended), ended.player.ember, ended.player.turnFlags.emberConduit]).toEqual([[6, 6], 1, 1]);
    // 一次只消耗 2 点不触发；同一回合第二次达到也只触发一次。
    const small = battle('charcoal_insight', false); small.player.statuses.emberConduit = 6; small.player.ember = 9;
    small.player.hand.push(card('ember_exchange', 'three'), card('ember_exchange', 'again'));
    let after = play(small, 'charcoal_insight');
    expect(burn(after)).toEqual([0]);
    after = play(after, 'three');
    expect(burn(after)).toEqual([6]);
    expect(burn(play(after, 'again'))).toEqual([6]);
  });
});

describe('拾灰者·灰烬（第二轮）', () => {
  it('焚书：基础版随机，升级版选择 1 张消耗，不再抽牌', () => {
    expect([text('burn_pages', false), text('burn_pages', true)]).toEqual(['消耗手牌中随机 1 张牌，每消耗一张获得 1 点能量。消耗。', '选择手牌中 1 张牌消耗，每消耗一张获得 1 点能量。消耗。']);
    const cs = battle('burn_pages', true); cs.player.hand.push(card('strike', 'a'), card('defend', 'b')); cs.player.energy = 0;
    expect(playCard(cs, 'burn_pages', null).pending).toMatchObject({ group: 0, count: 1, action: 'exhaust' });
    const after = play(cs, 'burn_pages', { exhaust: [['b']] });
    expect([after.player.exhaust.map(c => c.uid), after.player.hand.map(c => c.uid), after.player.energy]).toEqual([['b', 'burn_pages'], ['a'], 1]);
  });

  it('藏炭：余烬 3（升级不加），升级版选择 1 张消耗', () => {
    expect([text('pocket_coals', false), text('pocket_coals', true)]).toEqual(['消耗手牌中随机 1 张牌，获得 3 点余烬。消耗。', '选择手牌中 1 张牌消耗，获得 3 点余烬。消耗。']);
  });

  it.each([false, true])('骨灰：罕见，2 费，数值不变（升级=%s）', up => {
    expect([CARDS.bone_ash.rarity, CARDS.bone_ash.cost]).toEqual(['uncommon', 2]);
    expect(text('bone_ash', up)).toBe(`造成 ${up ? 25 : 18} 点伤害，消耗区每张牌 +${up ? 3 : 2}。消耗。`);
    expect(play(battle('bone_ash', up), 'bone_ash').player.energy).toBe(1);
  });

  it.each([false, true])('尘归尘：消耗手牌中的所有诅咒牌和状态牌，其他牌不动（升级=%s）', up => {
    expect(text('dust_to_dust', up)).toBe(`消耗手牌中的所有诅咒牌和状态牌，获得 ${up ? 13 : 9} 点格挡。`);
    const cs = battle('dust_to_dust', up);
    cs.player.hand.push(card('ashes', 'curse'), card('dazed', 'status-a'), card('slime', 'status-b'), card('strike', 'keep'));
    const after = play(cs, 'dust_to_dust');
    expect(after.player.exhaust.map(c => c.uid).sort()).toEqual(['curse', 'status-a', 'status-b']);
    expect([after.player.hand.map(c => c.uid), after.player.block]).toEqual([['keep'], up ? 13 : 9]);
  });

  it('捡拾残页：基础版随机取回，升级版选择 1 张取回；消耗堆为空时升级版也能打出', () => {
    expect([text('salvage_scraps', false), text('salvage_scraps', true)]).toEqual(['从消耗区随机取回 1 张牌，获得 4 点格挡。', '从消耗区选择 1 张牌加入手牌，获得 7 点格挡。']);
    const cs = battle('salvage_scraps', true);
    cs.player.exhaust = [card('strike', 'gone-a'), card('bone_ash', 'gone-b')];
    // 有牌可选时必须选一张。
    expect(playCard(cs, 'salvage_scraps', null).state).toBe(cs);
    const after = play(cs, 'salvage_scraps', 'gone-b');
    expect([after.player.hand.map(c => c.uid), after.player.exhaust.map(c => c.uid), after.player.block]).toEqual([['gone-b'], ['gone-a'], 7]);
    const empty = battle('salvage_scraps', true);
    expect(canPlayCard(empty, empty.player.hand[0]).ok).toBe(true);
    const played = play(empty, 'salvage_scraps');
    expect([played.player.block, played.player.hand]).toEqual([7, []]);
  });

  it('碎片齐射：升级版选择 1 张消耗，伤害 8/12 不变', () => {
    expect([text('scrap_volley', false), text('scrap_volley', true)]).toEqual(['消耗手牌中随机 1 张牌，每消耗一张获得 1 点能量，对所有敌人造成 8 点伤害。消耗。', '选择手牌中 1 张牌消耗，每消耗一张获得 1 点能量，对所有敌人造成 12 点伤害。消耗。']);
    const cs = battle('scrap_volley', true, 2); cs.player.hand.push(card('strike', 'a'), card('defend', 'b'));
    const after = play(cs, 'scrap_volley', { exhaust: [['a']] });
    expect([after.enemies.map(e => 1000 - e.hp), after.player.hand.map(c => c.uid), after.player.energy]).toEqual([[12, 12], ['b'], 3]);
  });

  it.each([false, true])('葬灰帷幕带消耗（升级=%s）', up => {
    expect(text('burial_veil', up).endsWith('消耗。')).toBe(true);
    const cs = battle('burial_veil', up); cs.player.hand.push(card('strike', 'a'), card('defend', 'b'));
    const after = play(cs, 'burial_veil', up ? { exhaust: [['a', 'b']] } : undefined);
    expect(after.player.exhaust.map(c => c.uid).sort()).toEqual(['a', 'b', 'burial_veil']);
    expect(after.player.discard).toEqual([]);
  });

  it.each([false, true])('灰中分拣：选中的牌被消耗而不是弃置，触发消耗联动（升级=%s）', up => {
    expect(text('ash_sifting', up)).toBe(`从抽牌堆随机 3 张牌中选择 1 张消耗，抽 2 张牌，获得 ${up ? 3 : 1} 点余烬。`);
    const cs = battle('ash_sifting', up); cs.player.statuses.ashFeast = 5;
    const pick = cardTransferChoices(cs, cs.player.hand[0])[0].uid;
    const after = play(cs, 'ash_sifting', pick);
    expect(after.player.exhaust.map(c => c.uid)).toEqual([pick]);
    expect([after.player.discard.map(c => c.uid), after.player.turnFlags.exhausted, after.player.block, after.player.draw.length]).toEqual([['ash_sifting'], 1, 5, 7]);
  });

  it.each([false, true])('焚尽：2 费（升级 1 费），每张 9 点伤害（升级=%s）', up => {
    expect(text('burn_it_all', up)).toBe('消耗手牌中的所有牌，每消耗一张造成 9 点伤害。');
    const cs = battle('burn_it_all', up); cs.player.hand.push(card('strike', 'a'), card('defend', 'b'));
    const after = play(cs, 'burn_it_all');
    expect([lost(after), after.player.energy]).toEqual([18, up ? 2 : 1]);
  });

  it('只简化卡面的四张牌：埋灰短刃、灰烬再临、灰中索引、灰烬储备，规则不变', () => {
    expect(text('buried_knife', false)).toBe('造成 14 点伤害，若本回合消耗过牌：从消耗区取回 1 张费用最高的牌。消耗。');
    expect(text('ash_return', true)).toBe('从消耗区取回 2 张费用最高的牌，若本回合消耗过牌：获得 18 点格挡。');
    expect(text('ash_index', false)).toBe('本回合每消耗 1 张牌抽 1 张牌，不重复计算。消耗。');
    expect(text('ash_reserve', false)).toBe('获得 8 点格挡，每回合第 2 次消耗牌时，获得 8 点格挡并从消耗区取回 1 张费用最高的牌。');
    expect(CARDS.buried_knife.effects[1]).toEqual({ kind: 'conditional', cond: { kind: 'exhaustedThisTurn' }, then: [{ kind: 'returnExhausted', count: 1, selection: 'highestCost' }] });
    expect(CARDS.ash_return.upgrade?.effects?.[0]).toEqual({ kind: 'returnExhausted', count: 2, selection: 'highestCost' });
    expect(CARDS.ash_index.effects).toEqual([{ kind: 'convertResource', resource: 'exhausts', per: 1, reward: 'draw' }]);
    expect(CARDS.ash_reserve.effects).toEqual([{ kind: 'block', amount: 8 }, { kind: 'status', status: 'ashRecall', amount: 8, target: 'self' }]);
  });
});

describe('拾灰者删除的三张牌与旧存档', () => {
  afterEach(() => vi.unstubAllGlobals());
  const table = { add_fuel: ['添油', 'lingering_fire', 'cinder'], black_smoke: ['浓烟', 'smoke_cover', 'cinder'], reclaimed_spark: ['回收火星', 'salvage_scraps', 'ash'] } as const;

  it('添油、浓烟、回收火星不再存在；替代牌是拾灰者同流派、稀有度不高于罕见的现有牌；隔火带只是改效果，id 保留', () => {
    for (const [id, [name, replacement, archetype]] of Object.entries(table)) {
      expect(CARDS[id], id).toBeUndefined();
      expect(Object.values(CARDS).some(c => c.name === name)).toBe(false);
      expect(RETIRED_CARDS[id]).toEqual({ name, replacement });
      const to = CARDS[replacement];
      expect([to.owner, to.archetype], replacement).toEqual(['picker', archetype]);
      expect(['common', 'uncommon']).toContain(to.rarity);
    }
    expect(CARDS.firebreak.name).toBe('隔火带');
    expect(RETIRED_CARDS.firebreak).toBeUndefined();
  });

  it('旧存档里的这三张牌读档后换成替代牌，保留升级与标识', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    const run = R.travelTo(R.newRun('RETIRED-PICKER', 'picker'), R.newRun('RETIRED-PICKER', 'picker').map.startIds[0]);
    const size = run.deck.length;
    Object.keys(table).forEach((id, i) => run.deck.push({ uid: `deck-${id}`, defId: id, upgraded: i % 2 === 0 }));
    saveRun(run);
    const loaded = loadRun()!;
    expect(loaded.deck).toHaveLength(size + 3);
    Object.entries(table).forEach(([id, [, replacement]], i) => expect(loaded.deck.find(c => c.uid === `deck-${id}`)).toEqual({ uid: `deck-${id}`, defId: replacement, upgraded: i % 2 === 0 }));
  });
});
