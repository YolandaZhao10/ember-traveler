import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARDS, RETIRED_CARDS } from '../data/cards';
import { describeCard, viewCard, viewDef } from '../engine/cards';
import { canPlayCard, createCombat, discardReplayChoices, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CardInstance, CharacterId, CombatState, RunState } from '../engine/types';

const card = (defId: string, upgraded = false, uid = defId): CardInstance => ({ uid, defId, upgraded });
function battle(ids: string[], upgraded = false, enemies = 2, character: CharacterId = 'traveler'): CombatState {
  const cs = createCombat('shared-pool', Array.from({ length: enemies }, () => 'tomb_puppet'), 'normal', [], 80, 80, [], makeRng('SHARED-POOL', 'c'), 100, character).state;
  cs.enemies.forEach(e => { e.hp = e.maxHp = 1000; e.block = 0; e.statuses = {}; });
  cs.player.hand = ids.map((id, i) => card(id, upgraded, `${id}-${i}`));
  cs.player.draw = Array.from({ length: 12 }, (_, i) => card('defend', false, `draw-${i}`));
  cs.player.energy = 3;
  return cs;
}
function use(cs: CombatState, uid: string): CombatState {
  const c = cs.player.hand.find(c => c.uid === uid)!;
  const next = playCard(cs, uid, viewCard(c).target === 'enemy' ? 'e0' : null).state;
  expect(next, `${uid} 应能打出`).not.toBe(cs);
  return next;
}
/** 完整走一轮：结束回合、敌人行动、开始下一回合。 */
function round(input: CombatState): CombatState {
  let cs = endPlayerTurn(input).state;
  for (const id of cs.enemies.map(e => e.id)) cs = enemyAct(cs, id).state;
  return startPlayerTurn(cs).state;
}
const ctxOf = (cs: CombatState) => ({ player: cs.player, target: cs.enemies[0], relics: cs.relics, isFirstAttack: cs.player.attacksPlayedThisTurn === 0, crescendoBonus: 0 });

describe.each([false, true])('阶段一：共享牌不再依赖燃烧，升级=%s', up => {
  it('炭尖按本回合已出牌数给余烬，与目标是否燃烧无关', () => {
    let cs = battle(['coal_tip', 'defend', 'defend', 'coal_tip'], up);
    cs.player.energy = 4;
    cs.enemies[0].statuses.burn = 5;
    cs = use(cs, 'coal_tip-0');
    expect(cs.player.ember).toBe(0);
    expect(1000 - cs.enemies[0].hp).toBe(up ? 10 : 7);
    cs = use(use(cs, 'defend-1'), 'defend-2');
    delete cs.enemies[0].statuses.burn;
    cs = use(cs, 'coal_tip-3');
    expect(cs.player.ember).toBe(up ? 3 : 2);
    expect(describeCard(card('coal_tip', up), null)).toBe(`造成 ${up ? 10 : 7} 点伤害，若本回合已打出 2 张以上卡牌：获得 ${up ? 3 : 2} 点余烬。`);
  });

  it('炽边斗篷在余烬不少于 3 时额外获得格挡，不再施加燃烧', () => {
    const low = use(battle(['warm_cloak'], up), 'warm_cloak-0');
    expect(low.player.block).toBe(up ? 9 : 6);
    const fueled = battle(['warm_cloak'], up); fueled.player.ember = 3;
    const high = use(fueled, 'warm_cloak-0');
    expect(high.player.block).toBe(up ? 15 : 10);
    expect(high.player.ember).toBe(3);
    expect(high.enemies.every(e => !e.statuses.burn)).toBe(true);
  });

  it('烈焰吐息消耗全部余烬群伤后施加全体易伤，易伤不放大本次伤害', () => {
    const cs = battle(['flame_breath'], up); cs.player.ember = 4;
    const after = use(cs, 'flame_breath-0');
    for (const e of after.enemies) {
      expect(1000 - e.hp).toBe(4 * (up ? 3 : 2));
      expect(e.statuses.vulnerable).toBe(1);
      expect(e.statuses.burn ?? 0).toBe(0);
    }
    expect(after.player.ember).toBe(0);
  });

  it('掷出火把造成伤害、给余烬并施加易伤，打出后进入弃牌堆', () => {
    const after = use(battle(['spare_torch'], up), 'spare_torch-0');
    expect(1000 - after.enemies[0].hp).toBe(up ? 12 : 8);
    expect(after.player.ember).toBe(up ? 3 : 2);
    expect(after.enemies[0].statuses.vulnerable).toBe(1);
    expect(after.enemies[0].statuses.burn ?? 0).toBe(0);
    expect(after.player.discard.map(c => c.defId)).toEqual(['spare_torch']);
    expect(after.player.exhaust).toHaveLength(0);
  });

  it('炭火启示回合结束时保留在手中', () => {
    const cs = battle(['charcoal_insight', 'defend'], up);
    const ended = endPlayerTurn(cs).state;
    expect(ended.player.hand.map(c => c.defId)).toEqual(['charcoal_insight']);
    expect(describeCard(card('charcoal_insight', up), null)).toBe(`消耗 2 点余烬，抽 ${up ? 4 : 3} 张牌。需要 2 点余烬。保留。`);
  });

  it('淬炭刃为普通牌，造成伤害并获得 1 点力量后消耗', () => {
    expect(CARDS.sharpened_coal.rarity).toBe('common');
    const after = use(battle(['sharpened_coal'], up), 'sharpened_coal-0');
    expect(1000 - after.enemies[0].hp).toBe(up ? 9 : 6);
    expect(after.player.statuses.strength).toBe(1);
    expect(after.player.exhaust.map(c => c.defId)).toEqual(['sharpened_coal']);
  });
});

describe('阶段一：诱火移除与旧存档', () => {
  afterEach(() => vi.unstubAllGlobals());
  function storage() {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    return values;
  }

  it('诱火不再是可获得的牌，替代牌与它同费用、同类型、同稀有度', () => {
    expect(CARDS.spark_lure).toBeUndefined();
    const replacement = viewDef(RETIRED_CARDS.spark_lure.replacement);
    expect(RETIRED_CARDS.spark_lure.name).toBe('诱火');
    expect([replacement.name, replacement.cost, replacement.type, replacement.rarity, replacement.target]).toEqual(['燃烧', 1, 'skill', 'common', 'enemy']);
    expect(CARDS[RETIRED_CARDS.spark_lure.replacement].owner).toBeUndefined();
  });

  it('旧存档各处的诱火读档后换成燃烧并保留升级与标识，无法识别的牌被移除，回退点同样处理', () => {
    storage();
    const run: RunState = R.travelTo(R.newRun('RETIRED-CARD'), R.newRun('RETIRED-CARD').map.startIds[0]);
    expect(run.combat).not.toBeNull();
    const old = (uid: string, upgraded = false): CardInstance => ({ uid, defId: 'spark_lure', upgraded });
    const unknown = (uid: string): CardInstance => ({ uid, defId: 'card_from_another_build', upgraded: false });
    const deckSize = run.deck.length;
    for (const snapshot of [run, run.checkpoint!]) {
      snapshot.deck.push(old('deck-old', true), unknown('deck-unknown'));
      const p = snapshot.combat!.player;
      p.hand.push({ ...old('hand-old'), bonus: 0 });
      p.draw.push(old('draw-old', true));
      p.discard.push(old('discard-old'), unknown('discard-unknown'));
      p.exhaust.push(old('exhaust-old'));
      snapshot.reward = { gold: 12, goldTaken: false, cardTaken: false, relic: null, relicTaken: false, cards: [old('reward-old', true), card('strike', false, 'reward-strike'), unknown('reward-unknown')] };
      snapshot.shop = { removePrice: 75, removeUsed: false, relics: [], cards: [{ card: old('shop-old'), price: 51, sold: false }, { card: unknown('shop-unknown'), price: 60, sold: false }] };
    }
    const rng = JSON.stringify(run.rng);
    saveRun(run);
    const loaded = loadRun()!;
    expect(loaded).not.toBeNull();
    for (const snapshot of [loaded, loaded.checkpoint!]) {
      const p = snapshot.combat!.player;
      const everywhere = [...snapshot.deck, ...p.hand, ...p.draw, ...p.discard, ...p.exhaust, ...snapshot.reward!.cards, ...snapshot.shop!.cards.map(item => item.card)];
      // 所有残留实体都能正常生成卡面，不会因未知牌抛错。
      for (const c of everywhere) expect(() => describeCard(c, null)).not.toThrow();
      expect(everywhere.some(c => !CARDS[c.defId])).toBe(false);
      expect(snapshot.deck).toHaveLength(deckSize + 1);
      expect(snapshot.deck.find(c => c.uid === 'deck-old')).toEqual({ uid: 'deck-old', defId: 'ignite', upgraded: true });
      expect(p.hand.find(c => c.uid === 'hand-old')).toEqual({ uid: 'hand-old', defId: 'ignite', upgraded: false, bonus: 0 });
      expect(p.draw.find(c => c.uid === 'draw-old')).toEqual({ uid: 'draw-old', defId: 'ignite', upgraded: true });
      expect(p.discard.map(c => c.uid)).toContain('discard-old');
      expect(p.discard.map(c => c.uid)).not.toContain('discard-unknown');
      expect(p.exhaust.find(c => c.uid === 'exhaust-old')?.defId).toBe('ignite');
      expect(snapshot.reward!.cards.map(c => [c.uid, c.defId, c.upgraded])).toEqual([['reward-old', 'ignite', true], ['reward-strike', 'strike', false]]);
      expect(snapshot.shop!.cards).toEqual([{ card: { uid: 'shop-old', defId: 'ignite', upgraded: false }, price: 51, sold: false }]);
    }
    // 迁移不消耗随机流；再次保存读取结果稳定。
    expect(JSON.stringify(loaded.rng)).toBe(rng);
    saveRun(loaded);
    expect(loadRun()).toEqual(loaded);
    // 替换后的牌在战斗中可以正常打出。
    const hand = loaded.combat!.player.hand.find(c => c.uid === 'hand-old')!;
    loaded.combat!.player.energy = 3;
    const played = playCard(loaded.combat!, hand.uid, loaded.combat!.enemies[0].id).state;
    expect(played.enemies[0].statuses.burn).toBeGreaterThanOrEqual(3);
  });
});

describe('阶段二：余烬不足时用生命代付', () => {
  it('余烬足够时照常消耗余烬，不失去生命也不触发失血联动', () => {
    const cs = battle(['ember_blade'], false, 1, 'oathbound'); cs.player.ember = 2; cs.player.statuses.bloodRage = 1;
    const after = use(cs, 'ember_blade-0');
    expect(after.player.hp).toBe(80);
    expect(after.player.ember).toBe(0);
    expect(1000 - after.enemies[0].hp).toBe(18);
    expect(after.player.statuses.strength ?? 0).toBe(0);
  });

  it('余烬不足时灰烬之刃仍可打出：失去 4 点生命、跳过余烬消耗，并按因卡牌失血触发血契、铁颅、血之筹码与烬血誓约', () => {
    const cs = battle(['ember_blade'], false, 1, 'oathbound');
    cs.player.ember = 1; cs.relics = ['iron_skull'];
    cs.player.statuses = { bloodRage: 1, bloodDraw: 1, emberOath: 2, sparkCrown: 4 };
    expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(true);
    const saved = JSON.stringify(cs);
    const text = describeCard(cs.player.hand[0], ctxOf(cs));
    expect(JSON.stringify(cs)).toBe(saved);
    const after = use(cs, 'ember_blade-0');
    expect(after.player.hp).toBe(76);
    expect([after.player.hpLostThisTurn, after.player.selfHpLost, after.player.turnFlags.cardHpLost]).toEqual([4, 4, 4]);
    // 血契的力量先于伤害生效；余烬只因烬血誓约增加，本牌的 2 点消耗被跳过，也不算消耗过余烬。
    expect(after.player.statuses.strength).toBe(1);
    expect(1000 - after.enemies[0].hp).toBe(19);
    expect(after.player.ember).toBe(3);
    expect(after.player.turnFlags.sparkCrown).toBeUndefined();
    expect(after.player.block).toBe(2);
    expect(after.player.hand).toHaveLength(1);
    // 战斗中的牌面与实际结算一致。
    expect(text).toContain('失去 4 点生命（余烬不足，不消耗余烬）');
    expect(text).toContain('造成 19 点伤害');
    expect(text).not.toContain('消耗 2 点余烬');
  });

  it('牌面常驻写明生命代付，不再写需要余烬', () => {
    expect(describeCard(card('ember_blade'), null)).toBe('消耗 2 点余烬，造成 18 点伤害。余烬不足时改为失去 4 点生命。');
    expect(describeCard(card('ember_exchange'), null)).toBe('消耗 3 点余烬，获得 2 点能量。余烬不足时改为失去 5 点生命。消耗。');
    expect(describeCard(card('molten_blood_strike'), null)).toBe('消耗 3 点余烬，造成 16 点伤害，获得 3 点力量，回合结束时失去。余烬不足时改为失去 5 点生命。');
  });

  it('燃料交换余烬不足时用 5 点生命换能量，并消耗自身', () => {
    const cs = battle(['ember_exchange'], false, 1, 'oathbound'); cs.player.energy = 0;
    const after = use(cs, 'ember_exchange-0');
    expect([after.player.hp, after.player.energy, after.player.ember]).toEqual([75, 2, 0]);
    expect(after.player.exhaust.map(c => c.defId)).toEqual(['ember_exchange']);
  });

  it('回响与镜像的每次重放各自判断：余烬用完后改为逐次失去生命', () => {
    const cs = battle(['ember_blade'], false, 1, 'scholar'); cs.player.ember = 2;
    cs.player.statuses = { mirror: 1, echo: 1 };
    const after = use(cs, 'ember_blade-0');
    expect(after.player.attacksPlayedThisTurn).toBe(3);
    expect(after.player.ember).toBe(0);
    expect(after.player.hp).toBe(72);
    expect(1000 - after.enemies[0].hp).toBe(54);
  });

  it('血誓重演可以选择余烬不足的代付牌，重放时失去生命', () => {
    const cs = battle(['oath_reenactment'], false, 1, 'oathbound');
    cs.player.discard = [card('ember_blade', false, 'old-blade'), card('firestorm', false, 'old-rain')];
    expect(discardReplayChoices(cs).map(c => c.uid)).toEqual(['old-blade']);
    const after = playCard(cs, 'oath_reenactment-0', 'e0', 'old-blade').state;
    expect(after.player.hp).toBe(76);
    expect(1000 - after.enemies[0].hp).toBe(18);
  });

  it('生命不够代付时倒下，后续效果不再结算', () => {
    const cs = battle(['ember_blade'], false, 1, 'oathbound'); cs.player.hp = 4;
    const after = use(cs, 'ember_blade-0');
    expect(after.outcome).toBe('lost');
    expect(after.enemies[0].hp).toBe(1000);
  });
});

describe('阶段二：蓄力增加余烬与单牌蓄力上限', () => {
  it.each([false, true])('余烬灯芯升级=%s：每保留一回合多给 1 点余烬，最多 4 层', up => {
    let cs = battle(['ember_wick'], up, 1); cs.player.hp = cs.player.maxHp = 1000;
    expect(describeCard(cs.player.hand[0], null)).toBe(`获得 ${up ? 3 : 2} 点余烬。保留。每保留一回合获得的余烬 +1，最多蓄力 4 层。消耗。`);
    expect(use(cs, 'ember_wick-0').player.ember).toBe(up ? 3 : 2);
    for (let turn = 1; turn <= 6; turn++) {
      cs = round(cs);
      expect(cs.player.hand.find(c => c.uid === 'ember_wick-0')!.bonus).toBe(Math.min(4, turn));
    }
    const text = describeCard(cs.player.hand.find(c => c.uid === 'ember_wick-0')!, ctxOf(cs));
    expect(text).toContain(`获得 ${up ? 7 : 6} 点余烬`);
    expect(text).toContain('（已蓄力 4/4）');
    const before = cs.player.ember;
    const after = use(cs, 'ember_wick-0');
    expect(after.player.ember - before).toBe(up ? 7 : 6);
    expect(after.player.exhaust.map(c => c.defId)).toEqual(['ember_wick']);
  });

  it('立即蓄力、凝神与星图都不能突破单牌上限；灰烬沙漏对整张牌只多给 1 点', () => {
    let cs = battle(['ember_wick', 'future_memory'], false, 1, 'scholar');
    cs.player.hp = cs.player.maxHp = 1000;
    cs.player.hand[0].bonus = 3; cs.player.hand[1].upgraded = true;
    cs = use(cs, 'future_memory-1');
    expect(cs.player.hand.find(c => c.uid === 'ember_wick-0')!.bonus).toBe(4);
    cs.relics = ['star_chart', 'ash_hourglass']; cs.player.statuses.chargeMaster = 1;
    cs = round(cs);
    expect(cs.player.hand.find(c => c.uid === 'ember_wick-0')!.bonus).toBe(4);
    const before = cs.player.ember;
    cs = use(cs, 'ember_wick-0');
    expect(cs.player.ember - before).toBe(2 + 4 + 1);
  });

  it.each([false, true])('灼热打击升级=%s：保留后每层 +3 伤害，最多 4 层；余烬加伤不随蓄力变化', up => {
    let cs = battle(['searing_strike'], up, 1); cs.player.hp = cs.player.maxHp = 1000;
    expect(describeCard(cs.player.hand[0], null)).toBe(`造成 ${up ? 12 : 9} 点伤害，若余烬 ≥ 5：造成 ${up ? 6 : 5} 点伤害。保留。每保留一回合伤害 +3，最多蓄力 4 层。`);
    for (let turn = 0; turn < 6; turn++) cs = round(cs);
    expect(cs.player.hand.find(c => c.uid === 'searing_strike-0')!.bonus).toBe(4);
    // 旧存档里超出上限的层数同样按 4 层结算。
    cs.player.hand.find(c => c.uid === 'searing_strike-0')!.bonus = 9;
    expect(viewCard(cs.player.hand.find(c => c.uid === 'searing_strike-0')!).bonus).toBe(4);
    cs.player.ember = 5; cs.player.statuses = {}; cs.enemies[0].block = 0; cs.enemies[0].statuses = {};
    const hp = cs.enemies[0].hp;
    const after = use(cs, 'searing_strike-0');
    expect(hp - after.enemies[0].hp).toBe((up ? 12 : 9) + 12 + (up ? 6 : 5));
  });

  it.each([false, true])('静燃之页升级=%s：格挡随蓄力成长到 6 层为止，蓄力不足 2 层不抽牌', up => {
    const cs = battle(['quiet_burning_page'], up, 1);
    expect(describeCard(cs.player.hand[0], null)).toBe(`获得 ${up ? 10 : 7} 点格挡，若本牌已蓄力至少 2 层：抽 2 张牌。保留。每保留一回合格挡 +3，最多蓄力 6 层。`);
    const cold = use(cs, 'quiet_burning_page-0');
    expect([cold.player.block, cold.player.hand.length]).toEqual([up ? 10 : 7, 0]);
    cs.player.hand[0].bonus = 2;
    const warm = use(cs, 'quiet_burning_page-0');
    expect([warm.player.block, warm.player.hand.length]).toEqual([(up ? 10 : 7) + 6, 2]);
    cs.player.hand[0].bonus = 10;
    expect(use(cs, 'quiet_burning_page-0').player.block).toBe((up ? 10 : 7) + 18);
  });
});

describe('阶段二：血誓者与学者的余烬接口牌', () => {
  it.each([false, true])('血燃升级=%s：本回合失去过生命才给余烬', up => {
    const cs = battle(['blood_kindling'], up, 1, 'oathbound');
    const dry = use(cs, 'blood_kindling-0');
    expect([dry.player.block, dry.player.ember]).toEqual([up ? 10 : 7, 0]);
    cs.player.hpLostThisTurn = 2;
    expect(use(cs, 'blood_kindling-0').player.ember).toBe(up ? 4 : 3);
  });

  it.each([false, true])('烬血誓约升级=%s：每回合只在首次因卡牌失去生命时给余烬，下回合重新生效', up => {
    let cs = battle(['ember_blood_oath', 'ember_pulse', 'ember_pulse'], false, 1, 'oathbound');
    cs.player.hp = cs.player.maxHp = 1000; cs.player.hand[0].upgraded = up;
    const gain = up ? 3 : 2;
    cs = use(cs, 'ember_blood_oath-0');
    expect(cs.player.statuses.emberOath).toBe(gain);
    cs = use(cs, 'ember_pulse-1');
    expect(cs.player.ember).toBe(2 + gain);
    cs = use(cs, 'ember_pulse-2');
    expect(cs.player.ember).toBe(4 + gain);
    cs = round(cs);
    cs.player.hand.push(card('ember_pulse', false, 'next-turn'));
    const before = cs.player.ember;
    expect(use(cs, 'next-turn').player.ember - before).toBe(2 + gain);
  });

  it.each([false, true])('熔血重击升级=%s：先造成伤害再获得临时力量；余烬不足时失去 5 点生命且保留余烬', up => {
    const cs = battle(['molten_blood_strike'], up, 1, 'oathbound'); cs.player.ember = 3;
    const paid = use(cs, 'molten_blood_strike-0');
    expect([paid.player.ember, paid.player.hp, 1000 - paid.enemies[0].hp]).toEqual([0, 80, up ? 21 : 16]);
    expect([paid.player.statuses.strength, paid.player.statuses.strengthDown]).toEqual([up ? 4 : 3, up ? 4 : 3]);
    cs.player.ember = 2;
    const bled = use(cs, 'molten_blood_strike-0');
    expect([bled.player.ember, bled.player.hp, 1000 - bled.enemies[0].hp]).toEqual([2, 75, up ? 21 : 16]);
  });

  it('烬文注释消耗余烬换 1 层回响，升级后只需要 1 点余烬', () => {
    const cs = battle(['ember_annotation'], false, 1, 'scholar'); cs.player.ember = 1;
    expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(false);
    cs.player.hand[0].upgraded = true;
    const after = use(cs, 'ember_annotation-0');
    expect([after.player.ember, after.player.statuses.echo, after.player.energy]).toEqual([0, 1, 3]);
    expect(after.player.exhaust).toHaveLength(1);
    expect(describeCard(card('ember_annotation'), null)).toBe('消耗 2 点余烬，获得 1 层回响。需要 2 点余烬。消耗。');
    expect(describeCard(card('ember_annotation', true), null)).toBe('消耗 1 点余烬，获得 1 层回响。需要 1 点余烬。消耗。');
  });

  it.each([false, true])('余烬刻度升级=%s：消耗 3 余烬获得格挡，手中蓄力牌各蓄力 1 回合且不超过各自上限', up => {
    const cs = battle(['ember_gradation', 'ember_wick', 'charged_blade', 'defend'], false, 1, 'scholar');
    cs.player.hand[0].upgraded = up; cs.player.hand[1].bonus = 4; cs.player.ember = 3;
    const after = use(cs, 'ember_gradation-0');
    expect([after.player.ember, after.player.block]).toEqual([0, up ? 12 : 8]);
    expect(after.player.hand.map(c => c.bonus ?? 0)).toEqual([4, 1, 0]);
    cs.player.ember = 2;
    expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(false);
  });

  it.each([false, true])('燃页终稿升级=%s：消耗全部余烬，基础、每点余烬与蓄力合并为一次命中，牌面数字与结算一致', up => {
    const cs = battle(['burning_final_draft'], up, 1, 'scholar');
    cs.player.ember = 5; cs.player.hand[0].bonus = 2; cs.player.statuses.strength = 1;
    expect(describeCard(card('burning_final_draft', up), null)).toBe(`消耗所有余烬：造成 ${up ? 14 : 10} 点伤害，每点余烬 +${up ? 4 : 3}。保留。每保留一回合伤害 +3，最多蓄力 10 层。`);
    const text = describeCard(cs.player.hand[0], ctxOf(cs));
    const { state: after, events } = playCard(cs, 'burning_final_draft-0', 'e0');
    const expected = (up ? 14 : 10) + 5 * (up ? 4 : 3) + 2 * 3 + 1;
    expect(1000 - after.enemies[0].hp).toBe(expected);
    expect(events.filter(e => e.type === 'damage' && e.targetId === 'e0')).toHaveLength(1);
    expect(after.player.ember).toBe(0);
    expect(text).toContain(`（当前 ${expected}）`);
  });
});
