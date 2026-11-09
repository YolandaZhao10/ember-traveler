import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENT_RELICS, SHOP_RELICS } from '../data/specialRelics';
import { CHAPTER_RELICS } from '../data/chapterRelics';
import { EXPANDED_RELICS, EXCLUSIVE_RELICS } from '../data/extraRelics';
import { RELICS, RELIC_LIST, relicAvailableTo, relicPool } from '../data/relics';
import { describeRelicRules } from '../data/relicRules';
import { createCombat, endPlayerTurn, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { loadRun, saveRun } from '../engine/save';
import * as R from '../engine/run';
import type { CharacterId, CombatEvent, CombatState, RelicCombatRule, RelicCondition, RelicDef, RunState } from '../engine/types';

const characters: CharacterId[] = ['traveler', 'picker', 'oathbound', 'scholar'];
const additions = [...EXPANDED_RELICS, ...EXCLUSIVE_RELICS];
const combatRelics = [...additions, ...CHAPTER_RELICS, ...EVENT_RELICS, ...SHOP_RELICS].flatMap(r => (r.combat ?? []).map(rule => ({ ...r, combat: [rule] })));
const journeyRelics = [...additions, ...CHAPTER_RELICS, ...EVENT_RELICS, ...SHOP_RELICS].filter(r => r.journey?.length);
const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const card = (defId: string, uid = defId) => ({ uid, defId, upgraded: false });

function battle(owner: CharacterId = 'traveler') {
  const cs = createCombat('relic-collection', ['furnace_drone', 'furnace_drone'], 'normal', [], 35, 100, [], makeRng('EXPANDED-RELICS', 'c'), 100, owner).state;
  cs.enemies.forEach(e => { e.hp = e.maxHp = 10000; e.statuses = {}; e.block = 0; });
  cs.player.hand = [];
  cs.player.draw = Array.from({ length: 60 }, (_, i) => card('strike', `draw-${i}`));
  cs.player.energy = 99;
  return cs;
}

function meet(cs: CombatState, c: RelicCondition, yes = true) {
  const p = cs.player;
  switch (c.kind) {
    case 'hpBelowHalf': p.hp = yes ? 35 : 90; break;
    case 'retainedHand': p.hand = yes ? [card('rune_shield', 'retained')] : []; break;
    case 'burningEnemy': cs.enemies[0].statuses.burn = yes ? 3 : 0; break;
    case 'emberAtLeast': p.ember = yes ? c.value : 0; break;
    case 'blockAtLeast': p.block = yes ? c.value : 0; p.statuses.barricade = 1; break;
    case 'attacksAtLeast': p.attacksPlayedThisTurn = yes ? c.value : 0; break;
    case 'skillsAtLeast': p.skillsPlayedThisTurn = yes ? c.value : 0; break;
    case 'cardsAtMost': p.cardsPlayedThisTurn = yes ? c.value : c.value + 1; break;
    case 'exhaustedAtLeast': p.turnFlags.exhausted = yes ? c.value : 0; break;
    case 'handAtLeast': p.hand = yes ? Array.from({ length: c.value }, (_, i) => card('strike', `hand-${i}`)) : []; break;
    case 'energyAtLeast': p.energy = yes ? c.value : 0; break;
    case 'hpLostAtLeast': p.turnFlags.cardHpLost = yes ? c.value : 0; break;
  }
}

function scenario(r: RelicDef, enabled: boolean, conditions = true) {
  const rule = r.combat![0];
  let cs = battle(r.owner);
  cs.relics = enabled ? [r.id] : [];
  for (const c of rule.when ?? []) meet(cs, c, conditions);
  const turn = rule.nth ?? rule.every ?? 1;
  if (rule.trigger === 'turnStart') {
    cs.turn = turn - 1; cs.phase = 'enemy';
    return startPlayerTurn(cs);
  }
  if (rule.trigger === 'turnEnd') {
    cs.turn = turn;
    return endPlayerTurn(cs);
  }
  const events: CombatEvent[] = [];
  const ids: Partial<Record<RelicCombatRule['trigger'], string>> = { cardPlayed: 'quick_stab', attackPlayed: 'quick_stab', skillPlayed: 'defend', powerPlayed: 'war_drum', exhaust: 'pick_up', selfHpLoss: 'crimson_step', echo: 'quick_stab', enemyKilled: 'quick_stab' };
  for (let i = 0; i < turn; i++) {
    const c = card(ids[rule.trigger]!, `played-${i}`);
    cs.player.hand.push(c);
    if (rule.trigger === 'echo') cs.player.statuses.echo = 1;
    if (rule.trigger === 'enemyKilled') cs.enemies[0].hp = 1;
    const result = playCard(cs, c.uid, 'e0'); cs = result.state; events.push(...result.events);
  }
  return { state: cs, events };
}

afterEach(() => vi.unstubAllGlobals());

describe('208件遗物的内容与角色边界', () => {
  it('常规135、角色专属12、章节专属36、问号15、商店6、初始4，ID与名称唯一，每件新增遗物都有可执行规则', () => {
    expect(RELIC_LIST).toHaveLength(208);
    expect(EXPANDED_RELICS).toHaveLength(90); expect(EXCLUSIVE_RELICS).toHaveLength(12);
    expect(new Set(RELIC_LIST.map(r => r.id)).size).toBe(208);
    expect(new Set(RELIC_LIST.map(r => r.name)).size).toBe(208);
    for (const rarity of ['common', 'uncommon', 'rare'] as const) {
      expect(RELIC_LIST.filter(r => r.rarity === rarity && !r.owner && !r.chapter && !r.source)).toHaveLength(45);
      for (const owner of characters) expect(EXCLUSIVE_RELICS.filter(r => r.owner === owner && r.rarity === rarity)).toHaveLength(1);
    }
    for (const r of additions) {
      expect((r.combat?.length ?? 0) + (r.journey?.length ?? 0)).toBeGreaterThan(0);
      expect(r.description).toBe(describeRelicRules(r.combat, r.journey));
      for (const rule of r.combat ?? []) expect(!!rule.nth && !!rule.every).toBe(false);
    }
  });

  it.each(characters)('%s的商店、奖励与随机事件只包含可用遗物，专属可正常获得', owner => {
    for (const r of EXCLUSIVE_RELICS) expect(relicAvailableTo(r, owner)).toBe(r.owner === owner);
    for (let seed = 0; seed < 20; seed++) {
      let run = R.newRun(`RELIC-SHOP-${seed}`, owner);
      run.map.nodes[run.map.startIds[0]].type = 'shop'; run = R.travelTo(run, run.map.startIds[0]);
      expect(run.shop!.relics).toHaveLength(6);
      expect(new Set(run.shop!.relics.map(r => r.relicId)).size).toBe(6);
      for (const r of run.shop!.relics) expect(relicAvailableTo(RELICS[r.relicId], owner)).toBe(true);
    }
    for (const special of EXCLUSIVE_RELICS.filter(r => r.owner === owner)) {
      const base = R.newRun('ONLY-EXCLUSIVE', owner);
      base.relics.push(...relicPool(base.relics, owner).filter(r => r.id !== special.id).map(r => r.id));
      const shopBase = copy(base); shopBase.map.nodes[shopBase.map.startIds[0]].type = 'shop';
      const shop = R.travelTo(shopBase, shopBase.map.startIds[0]);
      expect(shop.shop!.relics.filter(r => !RELICS[r.relicId].source).map(r => r.relicId)).toEqual([special.id]);
      const eliteBase = copy(base); eliteBase.map.nodes[eliteBase.map.startIds[0]].type = 'elite';
      const elite = R.travelTo(eliteBase, eliteBase.map.startIds[0]); elite.combat!.outcome = 'won';
      expect(R.finishCombat(elite).reward!.relic).toBe(special.id);
      const event = copy(base); event.screen = 'event'; event.event = { eventId: 'cursed_reliquary', resolvedText: null, pendingPick: null, done: false };
      const eventResult = R.eventChoose(event, 'relic');
      expect(eventResult.relics.length).toBe(event.relics.length + 1);
      expect(eventResult.relics.some(id => id === special.id || RELICS[id].source === 'event')).toBe(true);
      // 直接授予也必须拒绝异角色遗物。
      for (const other of characters.filter(c => c !== owner)) {
        const invalid = R.newRun('INVALID-OWNER', other); const before = copy(invalid);
        R.addRelic(invalid, special.id); expect(invalid).toEqual(before);
      }
    }
  });
});

describe('逐件验证新增战斗遗物的真实结算', () => {
  it.each(combatRelics.map(r => [r.name, r] as const))('%s', (_name, r) => {
    const actual = scenario(r, true); const plain = scenario(r, false);
    expect(actual.events.filter(e => e.type === 'relic' && e.relicId === r.id)).toHaveLength(1);
    const a = actual.state.player, b = plain.state.player;
    for (const effect of r.combat![0].effects) {
      switch (effect.kind) {
        case 'block': expect(a.block - b.block).toBe(effect.amount); break;
        case 'draw': expect(a.draw.length).toBe(b.draw.length - effect.amount - (r.combat![0].trigger === 'turnStart' ? r.combat![0].effects.filter(x => x.kind === 'status' && x.status === 'study').reduce((n, x) => n + x.amount, 0) : 0)); break;
        case 'energy': expect(a.energy - b.energy).toBe(effect.amount); break;
        case 'ember': expect(a.ember - b.ember).toBe(effect.amount); break;
        case 'heal': expect(a.hp - b.hp).toBe(effect.amount); break;
        case 'status': expect((a.statuses[effect.status] ?? 0) - (b.statuses[effect.status] ?? 0)).toBe(effect.amount); break;
        case 'enemyStatus':
          actual.state.enemies.forEach((enemy, i) => expect((enemy.statuses[effect.status] ?? 0) - (plain.state.enemies[i].statuses[effect.status] ?? 0)).toBe(effect.target === 'all' || i === 0 ? effect.amount : 0));
          break;
        case 'damageAll':
          actual.state.enemies.forEach((enemy, i) => expect(plain.state.enemies[i].hp - enemy.hp).toBe(effect.amount));
          break;
        case 'damageLowest': expect(plain.state.enemies[0].hp - actual.state.enemies[0].hp).toBe(effect.amount); expect(actual.state.enemies[1].hp).toBe(plain.state.enemies[1].hp); break;
        case 'charge': expect(a.hand.find(c => c.uid === 'retained')!.bonus! - b.hand.find(c => c.uid === 'retained')!.bonus!).toBe(effect.amount); break;
        case 'cleanse': expect(a.statuses[effect.status] ?? 0).toBe(0); break;
      }
    }
    if (r.combat![0].when?.length) expect(scenario(r, true, false).events.some(e => e.type === 'relic' && e.relicId === r.id)).toBe(false);
  });
});

function enter(run: RunState, kind: 'rest' | 'shop' | 'combat' | 'elite' | 'boss') {
  const id = run.map.startIds[0]; run.map.nodes[id].type = kind;
  return R.travelTo(run, id);
}

describe('逐件验证新增旅程遗物与SL', () => {
  it.each(journeyRelics.map(r => [r.name, r] as const))('%s', (_name, r) => {
    const rule = r.journey![0];
    const base = R.newRun('JOURNEY-RELIC'); base.hp = 20; base.gold = 100;
    let actual: RunState, plain: RunState;
    if (rule.trigger === 'obtain') {
      actual = copy(base); R.addRelic(actual, r.id); plain = base;
      const once = copy(actual); R.addRelic(actual, r.id); expect(actual).toEqual(once);
    } else {
      const withRelic = copy(base); withRelic.relics.push(r.id);
      if (rule.trigger === 'victory') {
        const kind = rule.tier === 'boss' ? 'boss' : rule.tier === 'elite' ? 'elite' : 'combat';
        const won = enter(withRelic, kind); won.combat!.outcome = 'won';
        const normal = enter(base, kind); normal.combat!.outcome = 'won';
        actual = R.finishCombat(won); plain = R.finishCombat(normal);
        expect(R.finishCombat(actual)).toBe(actual);
        expect(R.resetCurrentNode(R.rewardTakeGold(actual))).toEqual(actual);
      } else if (rule.trigger === 'purchase' || rule.trigger === 'remove') {
        base.gold = withRelic.gold = 1000;
        const entered = enter(withRelic, 'shop'); const normal = enter(base, 'shop');
        const act = (run: RunState) => rule.trigger === 'purchase' ? R.shopBuyCard(run, 0) : R.shopRemoveCard(run, run.deck[0].uid);
        actual = act(entered); plain = act(normal);
        expect(act(actual)).toBe(actual); expect(R.resetCurrentNode(actual)).toEqual(entered);
      } else {
        const entered = enter(withRelic, 'rest'); const normal = enter(base, 'rest');
        const act = (run: RunState) => rule.trigger === 'rest' ? R.restHeal(run) : R.restUpgrade(run, run.deck[0].uid);
        actual = act(entered); plain = act(normal);
        expect(act(actual)).toBe(actual); expect(R.resetCurrentNode(actual)).toEqual(entered);
        expect(actual.hp - entered.hp).toBe(rule.trigger === 'rest' ? R.restHealAmount(entered) : R.restUpgradeHealAmount(entered));
      }
    }
    for (const effect of rule.effects) {
      if (effect.kind === 'maxHp') expect(actual.maxHp - plain.maxHp).toBe(effect.amount);
      if (effect.kind === 'heal') expect(actual.hp).toBe(Math.min(actual.maxHp, plain.hp + effect.amount));
      if (effect.kind === 'gold') expect((actual.reward?.gold ?? actual.gold) - (plain.reward?.gold ?? plain.gold)).toBe(effect.amount);
    }
  });
});

describe('加强后的章节遗物', () => {
  it('钟楼主齿轮在第4与第8张各触发一次，钟楼大摆锤每回合供能和抽牌', () => {
    let cs = battle(); cs.relics = ['clocktower_gear'];
    const openingEnergy = cs.player.energy; const events: CombatEvent[] = [];
    for (let i = 0; i < 8; i++) {
      const uid = `gear-${i}`; cs.player.hand.push(card('quick_stab', uid));
      const step = playCard(cs, uid, 'e0'); cs = step.state; events.push(...step.events);
    }
    expect(events.filter(e => e.type === 'relic' && e.relicId === 'clocktower_gear')).toHaveLength(2);
    expect(cs.player.energy).toBe(openingEnergy + 2); expect(cs.player.block).toBe(16);
    expect(cs.player.draw).toHaveLength(58);
    cs = battle(); cs.relics = ['belltower_pendulum'];
    for (let i = 0; i < 4; i++) {
      cs.player.hand = []; cs = startPlayerTurn(endPlayerTurn(cs).state).state;
      expect(cs.player.energy).toBe(4); expect(cs.player.hand).toHaveLength(6);
    }
  });
});

describe('遗物组合、死亡与存档边界', () => {
  it('首次与第N次触发不会因回响增加出牌次数，下一回合重新计数', () => {
    let cs = battle('traveler'); cs.relics = ['brass_knuckle', 'roadward_pin']; cs.player.statuses.echo = 2;
    for (let i = 0; i < 3; i++) { cs.player.hand.push(card('strike', `q${i}`)); cs = playCard(cs, `q${i}`, 'e0').state; }
    expect(cs.player.ember).toBe(2); expect(cs.player.block).toBe(4);
    cs = startPlayerTurn(endPlayerTurn(cs).state).state;
    cs.player.hand.push(card('strike', 'again')); cs = playCard(cs, 'again', 'e0').state;
    expect(cs.player.ember).toBe(3); expect(cs.player.block).toBe(0);
  });
  it('开场抽牌和遗物余烬尊重上限，遗物余烬不再触发卡牌沙漏加成', () => {
    const deck = Array.from({ length: 30 }, (_, i) => card('strike', `c${i}`));
    const cs = createCombat('open', ['furnace_drone'], 'normal', deck, 35, 100, ['ash_compass', 'copper_feather', 'scribe_scroll', 'lantern_archive', 'ember_seed', 'ash_hourglass'], makeRng('OPEN', 'c'), 100).state;
    expect(cs.player.hand).toHaveLength(10); expect(cs.player.ember).toBe(4); expect(cs.player.block).toBe(6);
    const next = startPlayerTurn(endPlayerTurn(cs).state).state;
    expect(next.player.hand).toHaveLength(6); expect(next.player.ember).toBe(4);
  });
  it('固定伤害可被格挡、不吃力量和易伤、不触发荆棘，击杀只结算一次', () => {
    const cs = battle(); cs.relics = ['bronze_spike', 'soul_vessel']; cs.player.block = 8; cs.player.statuses.strength = 99;
    cs.enemies[0].hp = 2; cs.enemies[0].block = 1; cs.enemies[0].statuses = { thorns: 99, vulnerable: 5 };
    const result = endPlayerTurn(cs); expect(result.state.enemies[0].hp).toBe(0); expect(result.state.player.hp).toBe(38);
    expect(result.state.player.ember).toBe(2); expect(result.events.filter(e => e.type === 'relic' && e.relicId === 'soul_vessel')).toHaveLength(1);
    expect(endPlayerTurn(result.state).state).toBe(result.state);
  });
  it('失血致死不能由遗物复活，也不能继续获得资源', () => {
    const cs = battle('oathbound'); cs.relics = ['crimson_covenant', 'oath_needle', 'pulse_bead']; cs.player.hp = 1;
    cs.player.turnFlags['relic:selfHpLoss'] = 1; cs.player.hand = [card('crimson_step')];
    const result = playCard(cs, 'crimson_step', 'e0');
    expect(result.state.outcome).toBe('lost'); expect(result.state.player.hp).toBe(0);
    expect(result.events.filter(e => e.type === 'relic')).toHaveLength(0);
  });
  it('固定伤害击杀最后敌人时触发胜利，死亡附加燃烧仍然结算', () => {
    const cs = createCombat('death', ['slag_tick'], 'normal', [], 35, 100, [], makeRng('DEATH', 'c'), 100).state;
    cs.enemies[0].hp = 3; cs.player.block = 8; cs.relics = ['bronze_spike'];
    const result = endPlayerTurn(cs).state;
    expect(result.outcome).toBe('won'); expect(result.player.statuses.burn).toBe(1);
    expect(endPlayerTurn(result).state).toBe(result);
  });
  it('旧遗物与新增蓄力叠加只在回合结束发生一次', () => {
    const cs = battle('scholar'); cs.relics = ['star_chart', 'library_hourglass', 'infinity_quill']; cs.player.hand = [card('rune_shield', 'keep'), card('meditate', 'plain')];
    const result = endPlayerTurn(cs).state;
    expect(result.player.hand.find(c => c.uid === 'keep')!.bonus).toBe(5);
    expect(result.player.hand.find(c => c.uid === 'plain')!.bonus).toBeUndefined();
    expect(result.player.statuses.echo).toBe(1); expect(endPlayerTurn(result).state).toBe(result);
  });
  it('专属遗物计数随刷新保持，战斗SL回到原始触发进度', () => {
    const values = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, val: string) => values.set(key, val), removeItem: (key: string) => values.delete(key) });
    const base = R.newRun('EXCLUSIVE-SAVE', 'traveler'); R.addRelic(base, 'roadward_pin');
    base.deck = Array.from({ length: 10 }, (_, i) => card('quick_stab', `c${i}`));
    const original = enter(base, 'combat');
    const first = R.combatPlayCard(original, original.combat!.player.hand[0].uid, 'e0').run;
    saveRun(first); const resumed = loadRun()!; expect(resumed).toEqual(first);
    expect(resumed.combat!.player.turnFlags['relic:attackPlayed']).toBe(1);
    const uid = resumed.combat!.player.hand[0].uid;
    expect(R.combatPlayCard(resumed, uid, 'e0')).toEqual(R.combatPlayCard(first, uid, 'e0'));
    expect(R.resetCurrentNode(resumed)).toEqual(original);
  });
});
