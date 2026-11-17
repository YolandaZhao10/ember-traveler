import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARDS, RETIRED_CARDS, cardAvailableTo } from '../data/cards';
import { canPlayCard, createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn, type PlayChoice } from '../engine/combat';
import { describeCard } from '../engine/cards';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CardInstance, CharacterId, CombatState } from '../engine/types';
import { playWithChoices } from './playOptions';

const characters: CharacterId[] = ['traveler', 'picker', 'oathbound', 'scholar'];
const card = (defId: string, uid = defId, upgraded = false): CardInstance => ({ uid, defId, upgraded, bonus: 0 });
const text = (id: string, upgraded: boolean) => describeCard(card(id, id, upgraded), null);

function battle(id: string, upgraded: boolean, enemies = 1, relics: string[] = []): CombatState {
  const cs = createCombat('shared-pass2', Array.from({ length: enemies }, () => 'tomb_puppet'), 'normal', [], 50, 80, relics, makeRng(`${id}-${upgraded}`, 'combat'), 100, 'traveler').state;
  for (const enemy of cs.enemies) { enemy.hp = enemy.maxHp = 1000; enemy.block = 0; enemy.statuses = {}; }
  cs.player.ember = 0;
  cs.player.hand = [card(id, id, upgraded)];
  cs.player.draw = Array.from({ length: 12 }, (_, i) => card('defend', `draw-${i}`));
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
function nextTurn(input: CombatState): CombatState {
  let cs = endPlayerTurn(input).state;
  for (const e of cs.enemies) { e.moveId = 'wall'; cs = enemyAct(cs, e.id).state; }
  return startPlayerTurn(cs).state;
}

describe('选择弃置：新交互', () => {
  it('烬中翻阅：抽 2 张（升级不加），基础版随机弃 1 张，升级版选择 1 张弃置', () => {
    expect([text('ember_sift', false), text('ember_sift', true)]).toEqual(['消耗 2 点余烬，抽 2 张牌，随机弃置 1 张手牌。需要 2 点余烬。', '消耗 2 点余烬，抽 2 张牌，选择 1 张手牌弃置。需要 2 点余烬。']);
    const cs = battle('ember_sift', true); cs.player.ember = 3; cs.player.hand.push(card('strike', 'held'));
    const before = JSON.stringify(cs);
    const waiting = playCard(cs, 'ember_sift', null);
    // 等待选择时不提交任何结果；可选的是抽牌之后的手牌（不含它自己）。
    expect(waiting.state).toBe(cs);
    expect(waiting.events).toEqual([]);
    expect(waiting.pending).toMatchObject({ group: 0, count: 1, action: 'discard' });
    expect(waiting.pending!.hand.map(c => c.uid)).toEqual(['held', 'draw-11', 'draw-10']);
    expect(JSON.stringify(cs)).toBe(before);
    const after = play(cs, 'ember_sift', { exhaust: [['draw-11']] });
    expect(after.player.hand.map(c => c.uid)).toEqual(['held', 'draw-10']);
    expect(after.player.discard.map(c => c.uid)).toEqual(['draw-11', 'ember_sift']);
    expect([after.player.ember, after.player.exhaust, after.player.turnFlags.exhausted ?? 0]).toEqual([1, [], 0]);
  });

  it('选择弃置必须选满，且只能选当时手牌里的牌；不合法的选择不结算', () => {
    const cs = battle('ember_sift', true); cs.player.ember = 2; cs.player.hand.push(card('strike', 'held'));
    for (const bad of [[], ['held', 'draw-11'], ['nope'], ['ember_sift']]) {
      const res = playCard(cs, 'ember_sift', null, { exhaust: [bad] });
      expect(res.state, JSON.stringify(bad)).toBe(cs);
      expect(res.pending).toBeUndefined();
    }
  });

  it('被回响重放时两次各选一次；手牌为空且抽不到牌时直接结算', () => {
    const cs = battle('ember_sift', true); cs.player.ember = 4; cs.player.statuses.echo = 1; cs.player.hand.push(card('strike', 'held'));
    const second = playCard(cs, 'ember_sift', null, { exhaust: [['held']] });
    expect(second.state).toBe(cs);
    expect(second.pending).toMatchObject({ group: 1, count: 1, action: 'discard' });
    expect(second.pending!.hand.map(c => c.uid)).toEqual(['draw-11', 'draw-10', 'draw-9', 'draw-8']);
    const after = play(cs, 'ember_sift', { exhaust: [['held'], ['draw-8']] });
    expect(after.player.hand.map(c => c.uid)).toEqual(['draw-11', 'draw-10', 'draw-9']);
    expect(after.player.ember).toBe(0);
    const empty = battle('ember_sift', true); empty.player.ember = 2; empty.player.draw = [];
    expect(play(empty, 'ember_sift').player.hand).toEqual([]);
  });

  it('翻找行囊：升为稀有，抽 3 张（升级不加），基础版随机弃 2 张，升级版选择 2 张弃置', () => {
    expect(CARDS.emergency_stash.rarity).toBe('rare');
    expect([text('emergency_stash', false), text('emergency_stash', true)]).toEqual(['抽 3 张牌，随机弃置 2 张手牌，获得 1 层蓄能。消耗。', '抽 3 张牌，选择 2 张手牌弃置，获得 1 层蓄能。消耗。']);
    const base = play(battle('emergency_stash', false), 'emergency_stash');
    expect([base.player.hand.length, base.player.discard.length, base.player.statuses.energyNext]).toEqual([1, 2, 1]);
    const cs = battle('emergency_stash', true);
    expect(playCard(cs, 'emergency_stash', null).pending).toMatchObject({ count: 2, action: 'discard' });
    const after = play(cs, 'emergency_stash', { exhaust: [['draw-11', 'draw-9']] });
    expect([after.player.hand.map(c => c.uid), after.player.discard.map(c => c.uid), after.player.exhaust.map(c => c.uid)]).toEqual([['draw-10'], ['draw-11', 'draw-9'], ['emergency_stash']]);
  });

  it('测试机器人能为选择弃置补齐选择', () => {
    const cs = battle('emergency_stash', true);
    const res = playWithChoices(cs, 'emergency_stash', null);
    expect(res.pending).toBeUndefined();
    expect(res.state.player.discard).toHaveLength(2);
  });
});

describe('通用·底座（第二轮）', () => {
  it.each([false, true])('炭中寻页：没有上限，余烬全部消耗，余数也不留（升级=%s）', up => {
    expect(text('coal_page_search', up)).toBe('消耗所有余烬：每 2 点抽 1 张牌。需要 2 点余烬。消耗。');
    for (const ember of [2, 5, 13]) {
      const cs = battle('coal_page_search', up); cs.player.ember = ember;
      const after = play(cs, 'coal_page_search');
      expect([after.player.hand.length, after.player.ember], `${ember} 点`).toEqual([Math.floor(ember / 2), 0]);
    }
  });

  it.each([false, true])('烬炉鼓风：没有上限，不足一份的余数不消耗（升级=%s）', up => {
    expect(text('ember_bellows', up)).toBe('消耗当前余烬：每 2 点获得 1 点能量（不足一份不消耗）。需要 2 点余烬。消耗。');
    const cs = battle('ember_bellows', up); cs.player.ember = 13; cs.player.energy = 0;
    const after = play(cs, 'ember_bellows');
    expect([after.player.energy, after.player.ember]).toEqual([6, 1]);
  });

  it.each([false, true])('余温未散：降为普通；清除自身的所有效果，增益与能力也一并清除（升级=%s）', up => {
    expect(CARDS.enduring_warmth.rarity).toBe('common');
    expect(text('enduring_warmth', up)).toBe(`回复 ${up ? 7 : 5} 点生命，清除自身的所有效果（增益与能力也一并清除）。消耗。`);
    let cs = battle('enduring_warmth', up);
    cs.player.hand.push(card('tempo', 'power'), card('pursuit_step', 'temp'));
    cs.player.cardsPlayedThisTurn = 2; cs.player.energy = 5; cs.player.hp = 40;
    cs = play(play(cs, 'power'), 'temp');
    Object.assign(cs.player.statuses, { weak: 2, burn: 3, dexterity: 2, thorns: 1, barricade: 1, metallicize: 4 });
    expect(cs.player.powerInstances).toHaveLength(1);
    const after = play(cs, 'enduring_warmth');
    expect(after.player.statuses).toEqual({});
    expect(after.player.powerInstances).toEqual([]);
    expect(after.player.hp).toBe(40 + (up ? 7 : 5));
    // 能力不再生效：回合末没有格挡，临时力量不会变成负力量。
    const ended = endPlayerTurn(after).state;
    expect([ended.player.block, ended.player.statuses.strength ?? 0]).toEqual([0, 0]);
  });

  it.each([false, true])('燃尽迎曦抽 3/4 张；百灯夜行余烬 4/5、格挡 10/15（升级=%s）', up => {
    expect(text('embers_to_dawn', up)).toBe(`消耗 5 点余烬，获得 3 点能量，抽 ${up ? 4 : 3} 张牌，获得 ${up ? 3 : 2} 层力量。需要 5 点余烬。消耗。`);
    const dawn = battle('embers_to_dawn', up); dawn.player.ember = 5;
    expect(play(dawn, 'embers_to_dawn').player.hand).toHaveLength(up ? 4 : 3);
    expect(text('lantern_procession', up)).toBe(`对所有敌人造成 ${up ? 18 : 14} 点伤害，获得 ${up ? 5 : 4} 点余烬，获得 ${up ? 15 : 10} 点格挡。`);
    const after = play(battle('lantern_procession', up, 2), 'lantern_procession');
    expect([lost(after, 0), lost(after, 1), after.player.ember, after.player.block]).toEqual([up ? 18 : 14, up ? 18 : 14, up ? 5 : 4, up ? 15 : 10]);
  });

  it.each([false, true])('余烬爆发每点余烬 4/6；焰柱 2 费（升级 1 费），升级不再 +2 伤害（升级=%s）', up => {
    expect(text('ember_burst', up)).toBe(`消耗所有余烬：造成每点余烬 ${up ? 6 : 4} 的伤害。`);
    expect([CARDS.pillar_of_flame.cost, CARDS.pillar_of_flame.upgrade?.cost]).toEqual([2, 1]);
    expect(text('pillar_of_flame', up)).not.toContain('+');
    let cs = play(battle('pillar_of_flame', up), 'pillar_of_flame');
    expect(cs.player.energy).toBe(up ? 2 : 1);
    cs.player.ember = 5;
    expect(lost(nextTurn(cs))).toBe(5);
  });
});

describe('新增底座牌：火光引路、薪火不绝', () => {
  it.each([false, true])('火光引路：稀有能力，1 费；每回合第一次获得余烬时抽 1/2 张，第二次不再抽，下回合重新可抽（升级=%s）', up => {
    const def = CARDS.guiding_firelight;
    expect([def.name, def.owner, def.hook, def.kindred, def.type, def.rarity, def.cost]).toEqual(['火光引路', undefined, undefined, undefined, 'power', 'rare', 1]);
    for (const character of characters) expect(cardAvailableTo(def, character)).toBe(true);
    expect(text('guiding_firelight', up)).toBe(`每回合第一次获得余烬时，抽 ${up ? 2 : 1} 张牌。`);
    let cs = battle('guiding_firelight', up);
    cs.player.hand.push(card('tinder_bundle', 'a'), card('tinder_bundle', 'b'));
    cs = play(cs, 'guiding_firelight');
    expect([cs.player.energy, cs.player.statuses.emberDraw]).toEqual([2, up ? 2 : 1]);
    cs = play(cs, 'a');
    expect([cs.player.ember, cs.player.hand.length]).toEqual([3, 1 + (up ? 2 : 1)]);
    cs = play(cs, 'b');
    expect([cs.player.ember, cs.player.hand.length]).toEqual([6, up ? 2 : 1]);
    cs = nextTurn(cs);
    cs.player.hand = [card('tinder_bundle', 'c')];
    expect(play(cs, 'c').player.hand).toHaveLength(up ? 2 : 1);
  });

  it('火光引路：消耗余烬不算获得；打出它之前获得的余烬不补抽；遗物给的余烬也算', () => {
    let cs = battle('guiding_firelight', false); cs.player.ember = 5;
    cs.player.hand.push(card('ember_exchange', 'spend'));
    cs = play(play(cs, 'guiding_firelight'), 'spend');
    expect([cs.player.hand.length, cs.player.turnFlags.emberDraw ?? 0]).toEqual([0, 0]);
    // 炭心在回合结束时给 1 点余烬：这是本回合第一次获得余烬。
    const relic = play(battle('guiding_firelight', false, 1, ['charcoal_heart']), 'guiding_firelight');
    const ended = endPlayerTurn(relic).state;
    expect([ended.player.ember, ended.player.turnFlags.emberDraw]).toEqual([1, 1]);
  });

  it.each([false, true])('薪火不绝：稀有能力，3 费；每累计获得 4/3 点余烬获得 1 点能量，进度跨回合保留（升级=%s）', up => {
    const per = up ? 3 : 4;
    const def = CARDS.undying_kindling;
    expect([def.name, def.owner, def.hook, def.type, def.rarity, def.cost]).toEqual(['薪火不绝', undefined, undefined, 'power', 'rare', 3]);
    expect(text('undying_kindling', up)).toBe(`每累计获得 ${per} 点余烬，获得 1 点能量。每张独立计数，进度跨回合保留。`);
    let cs = battle('undying_kindling', up);
    cs.player.hand.push(card('tinder_bundle', 'a'), card('tinder_bundle', 'b', true));
    cs = play(cs, 'undying_kindling');
    expect([cs.player.energy, cs.player.powerInstances]).toEqual([0, [{ status: 'emberEngine', amount: per, progress: 0 }]]);
    cs = play(cs, 'a'); // 累计 3
    expect([cs.player.energy, cs.player.powerInstances![0].progress]).toEqual(up ? [1, 0] : [0, 3]);
    cs = play(cs, 'b'); // 再得 5，累计 8
    expect([cs.player.energy, cs.player.powerInstances![0].progress]).toEqual(up ? [2, 2] : [2, 0]);
    // 进度跨回合保留。
    const progress = cs.player.powerInstances![0].progress;
    cs = nextTurn(cs);
    expect(cs.player.powerInstances![0].progress).toBe(progress);
    cs.player.hand = [card('tinder_bundle', 'c')]; cs.player.energy = 0;
    cs = play(cs, 'c'); // 再得 3
    expect(cs.player.energy).toBe(up ? 1 : 0);
  });

  it('薪火不绝每张独立计数：先后打出的两张各按自己的进度结算；消耗余烬不计入', () => {
    let cs = battle('undying_kindling', false);
    cs.player.hand.push(card('tinder_bundle', 'a'), card('undying_kindling', 'second', true), card('tinder_bundle', 'b'), card('ember_exchange', 'spend'));
    cs.player.energy = 6;
    cs = play(play(cs, 'undying_kindling'), 'a'); // 第一张累计 3
    cs = play(cs, 'second');
    expect(cs.player.powerInstances).toEqual([{ status: 'emberEngine', amount: 4, progress: 3 }, { status: 'emberEngine', amount: 3, progress: 0 }]);
    const energy = cs.player.energy;
    cs = play(cs, 'b'); // 两张各再得 3：第一张 6 → 触发，余 2；第二张 3 → 触发，余 0
    expect(cs.player.energy).toBe(energy + 2);
    expect(cs.player.powerInstances!.map(p => p.progress)).toEqual([2, 0]);
    cs = play(cs, 'spend');
    expect(cs.player.powerInstances!.map(p => p.progress)).toEqual([2, 0]);
  });
});

describe('通用·接口牌（第二轮）', () => {
  it.each([false, true])('辟邪灯：格挡 10，带消耗；余烬 ≥ 6 的敏捷 1/2 不变（升级=%s）', up => {
    expect(text('warding_lantern', up)).toBe(`获得 10 点格挡，若余烬 ≥ 6：获得 ${up ? 2 : 1} 层敏捷，获得 1 层荆棘。消耗。`);
    const after = play(battle('warding_lantern', up), 'warding_lantern');
    expect([after.player.block, after.player.exhaust.map(c => c.defId)]).toEqual([10, ['warding_lantern']]);
  });

  it.each([false, true])('火雨：技能，不造成伤害，消耗 2 点余烬对所有敌人施加 7/10 层燃烧（升级=%s）', up => {
    expect([CARDS.firestorm.type, CARDS.firestorm.cost, CARDS.firestorm.target]).toEqual(['skill', 2, 'all_enemies']);
    expect(text('firestorm', up)).toBe(`消耗 2 点余烬，对所有敌人施加 ${up ? 10 : 7} 层燃烧。需要 2 点余烬。`);
    const cs = battle('firestorm', up, 2); cs.player.ember = 2;
    const after = play(cs, 'firestorm');
    expect([after.enemies.map(e => e.statuses.burn), after.enemies.map(e => e.hp), after.player.attacksPlayedThisTurn, after.player.skillsPlayedThisTurn]).toEqual([[up ? 10 : 7, up ? 10 : 7], [1000, 1000], 0, 1]);
  });

  it.each([false, true])('闷燃之星：技能，2 费（升级 1 费），消耗 8 点余烬使目标燃烧翻倍，没有伤害和易伤（升级=%s）', up => {
    expect([CARDS.smoldering_star.type, CARDS.smoldering_star.cost, CARDS.smoldering_star.upgrade?.cost, CARDS.smoldering_star.requireEmber]).toEqual(['skill', 2, 1, 8]);
    expect(text('smoldering_star', up)).toBe('消耗 8 点余烬，使目标的燃烧层数翻倍。需要 8 点余烬。');
    const short = battle('smoldering_star', up); short.player.ember = 7;
    expect(canPlayCard(short, short.player.hand[0]).ok).toBe(false);
    const cs = battle('smoldering_star', up, 2); cs.player.ember = 9; cs.enemies[0].statuses.burn = 6; cs.enemies[0].burnApplied = 6; cs.enemies[1].statuses.burn = 2;
    const after = play(cs, 'smoldering_star');
    expect([after.enemies.map(e => e.statuses.burn), lost(after), after.enemies[0].statuses.vulnerable ?? 0, after.player.ember, after.player.energy]).toEqual([[12, 2], 0, 0, 1, up ? 2 : 1]);
    // 翻倍增加的层数记入本场对该敌人累计施加的燃烧。
    expect(after.enemies[0].burnApplied).toBe(12);
  });

  it('余烬拾遗只简化卡面，规则不变：仍不能选带消耗区回收效果的牌', () => {
    expect([text('ember_retrieval', false), CARDS.ember_retrieval.cost, CARDS.ember_retrieval.upgrade?.cost]).toEqual(['从消耗区选择 1 张牌加入手牌。消耗。', 1, 0]);
    expect(CARDS.ember_retrieval.effects).toEqual([{ kind: 'moveCard', from: 'exhaust', to: 'hand' }]);
    const cs = battle('ember_retrieval', false);
    cs.player.exhaust = [card('ash_return', 'recovery'), card('strike', 'plain')];
    expect(playCard(cs, 'ember_retrieval', null, 'recovery').state).toBe(cs);
    expect(play(cs, 'ember_retrieval', 'plain').player.hand.map(c => c.uid)).toEqual(['plain']);
  });

  it.each([false, true])('血誓者接口：灰烬之刃 18/25；余烬疗愈 1 费、回复 15；涅槃之息消耗 8 点余烬（升级=%s）', up => {
    expect(text('ember_blade', up)).toBe(`消耗 2 点余烬，造成 ${up ? 25 : 18} 点伤害。余烬不足时改为失去 4 点生命。`);
    expect(CARDS.cinder_mend.cost).toBe(1);
    expect(text('cinder_mend', up)).toBe('消耗 4 点余烬，回复 15 点生命，清除自身的虚弱、易伤、脆弱与燃烧。需要 4 点余烬。消耗。');
    expect(text('phoenix_respite', up)).toBe(`消耗 8 点余烬，回复 ${up ? 14 : 10} 点生命，获得 ${up ? 5 : 4} 层再生（回合末治疗后减少1层）。需要 8 点余烬。消耗。`);
    const short = battle('phoenix_respite', up); short.player.ember = 7;
    expect(canPlayCard(short, short.player.hand[0]).ok).toBe(false);
    const cs = battle('phoenix_respite', up); cs.player.ember = 9;
    expect(play(cs, 'phoenix_respite').player.ember).toBe(1);
  });

  it.each([false, true])('灰语学者接口：封存烈火的蓄能固定 1 层（升级=%s）', up => {
    expect(text('sealed_flame', up)).toBe(`获得 ${up ? 7 : 5} 点余烬，获得 1 层蓄能。保留。消耗。`);
  });
});

describe('通用删除的两张牌与旧存档', () => {
  afterEach(() => vi.unstubAllGlobals());
  const table = { flame_breath: ['烈焰吐息', 'sweeping_embers', 'uncommon'], final_conflagration: ['终夜焚天', 'lantern_procession', 'rare'] } as const;
  const order = ['common', 'uncommon', 'rare'];

  it('烈焰吐息、终夜焚天不再存在；替代牌是通用底座里稀有度不高于原牌的现有牌，四个角色都能用', () => {
    for (const [id, [name, replacement, rarity]] of Object.entries(table)) {
      expect(CARDS[id], id).toBeUndefined();
      expect(RETIRED_CARDS[id]).toEqual({ name, replacement });
      const to = CARDS[replacement];
      expect([to.owner, to.hook, to.archetype], replacement).toEqual([undefined, undefined, 'ember']);
      expect(order.indexOf(to.rarity)).toBeLessThanOrEqual(order.indexOf(rarity));
    }
  });

  it('旧存档里的这两张牌读档后换成替代牌，保留升级与标识', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    const run = R.travelTo(R.newRun('RETIRED-SHARED', 'scholar'), R.newRun('RETIRED-SHARED', 'scholar').map.startIds[0]);
    run.deck.push({ uid: 'old-a', defId: 'flame_breath', upgraded: true }, { uid: 'old-b', defId: 'final_conflagration', upgraded: false });
    saveRun(run);
    const loaded = loadRun()!;
    expect(loaded.deck.find(c => c.uid === 'old-a')).toEqual({ uid: 'old-a', defId: 'sweeping_embers', upgraded: true });
    expect(loaded.deck.find(c => c.uid === 'old-b')).toEqual({ uid: 'old-b', defId: 'lantern_procession', upgraded: false });
  });

  it('旧存档里不设上限的蓄力层数读档后不被截断，有上限的牌仍按上限', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    const run = R.travelTo(R.newRun('CHARGE-SAVE', 'scholar'), R.newRun('CHARGE-SAVE', 'scholar').map.startIds[0]);
    run.combat!.player.hand = [{ uid: 'wick', defId: 'ember_wick', upgraded: false, bonus: 15 }, { uid: 'page', defId: 'quiet_burning_page', upgraded: false, bonus: 15 }];
    saveRun(run);
    expect(loadRun()!.combat!.player.hand.map(c => c.bonus)).toEqual([15, 6]);
  });
});
