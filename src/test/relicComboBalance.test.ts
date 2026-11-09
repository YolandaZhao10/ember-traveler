import { describe, expect, it } from 'vitest';
import { viewCard } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CardInstance, CharacterId, CombatEvent, CombatState } from '../engine/types';

type CardSpec = string | { id: string; upgraded: boolean };
const copies = (id: string, count: number): CardSpec[] => Array.from({ length: count }, () => id);
const mirror: CardSpec = { id: 'mirror', upgraded: true };

function battle(character: CharacterId, relics: string[], hand: CardSpec[], drawOrder: CardSpec[]): CombatState {
  const deck: CardInstance[] = [...hand, ...drawOrder].map((spec, i) => ({
    uid: `combo-${i}`,
    defId: typeof spec === 'string' ? spec : spec.id,
    upgraded: typeof spec === 'string' ? false : spec.upgraded,
  }));
  const cs = createCombat('relic-combo', ['tomb_puppet'], 'normal', deck, 50, 100, relics, makeRng('RELIC-COMBO', 'combat'), 100, character).state;
  // 固定一个合法手牌上限内的压力局面与有限牌堆；出牌过程中不添牌、不补能、不改触发计数。
  cs.player.hand = deck.slice(0, hand.length);
  cs.player.draw = deck.slice(hand.length).reverse();
  cs.player.discard = [];
  cs.player.exhaust = [];
  // 仅延长靶子的存活时间，仍让它正常执行敌方回合。
  cs.enemies[0].hp = cs.enemies[0].maxHp = 1000;
  return cs;
}

function use(cs: CombatState, events: CombatEvent[], id = cs.player.hand[0]?.defId): CombatState {
  const card = cs.player.hand.find(c => c.defId === id)!;
  expect(card).toBeDefined();
  expect(viewCard(card).cost).toBe(0);
  const step = playCard(cs, card.uid, viewCard(card).target === 'enemy' ? 'e0' : null);
  expect(step.state).not.toBe(cs);
  events.push(...step.events);
  return step.state;
}

function emptyHand(cs: CombatState, events: CombatEvent[]): CombatState {
  // 有限循环护栏：若资源回流使整手一直打不完，应失败，而不是让测试挂起。
  for (let i = 0; i < 40 && cs.player.hand.length; i++) cs = use(cs, events);
  expect(cs.player.hand).toHaveLength(0);
  expect(cs.outcome).toBe('ongoing');
  return cs;
}

function nextTurn(cs: CombatState): CombatState {
  cs = endPlayerTurn(cs).state;
  cs = enemyAct(cs, 'e0').state;
  return startPlayerTurn(cs).state;
}

const procs = (events: CombatEvent[], id: string) => events.filter(e => e.type === 'relic' && e.relicId === id).length;
const draws = (events: CombatEvent[]) => events.reduce((n, e) => n + (e.type === 'draw' ? e.count : 0), 0);

describe('有限牌组的遗物组合资源上限', () => {
  it('连续打出十二张零费攻击，齿轮、怀表、鼓心各只返一次资源，次回合重新计数', () => {
    let cs = battle('traveler', ['clocktower_gear', 'metronome', 'drummer_heart'], copies('quick_stab', 10), copies('quick_stab', 20));
    const first: CombatEvent[] = [];
    cs = emptyHand(cs, first);
    expect(cs.player.cardsPlayedThisTurn).toBe(12);
    expect(cs.player.attacksPlayedThisTurn).toBe(12);
    expect(cs.player.energy).toBe(5);
    expect(cs.player.block).toBe(6);
    expect(draws(first)).toBe(2);
    expect(cs.player.draw).toHaveLength(18);
    expect(new Set(first.filter(e => e.type === 'cardPlayed').map(e => e.uid)).size).toBe(12);
    for (const relic of cs.relics) expect(procs(first, relic)).toBe(1);

    cs = nextTurn(cs);
    expect(cs.player.energy).toBe(3);
    expect(cs.player.block).toBe(0);
    const second: CombatEvent[] = [];
    cs = emptyHand(cs, second);
    expect(cs.player.cardsPlayedThisTurn).toBe(7);
    expect(cs.player.energy).toBe(5);
    expect(cs.player.block).toBe(6);
    expect(draws(second)).toBe(2);
    expect(cs.player.draw).toHaveLength(11);
    for (const relic of cs.relics) expect(procs(second, relic)).toBe(1);
  });

  it('多次消耗与十二张技能不重复返能，残页蓄能到下一轮，两个触发器逐回合重置', () => {
    let cs = battle('traveler', ['foundry_core', 'unwritten_page'],
      [...copies('tinder_bundle', 3), ...copies('shutter_lamp', 7)],
      [...copies('shutter_lamp', 2), ...copies('tinder_bundle', 2), ...copies('shutter_lamp', 15)]);
    const first: CombatEvent[] = [];
    cs = emptyHand(cs, first);
    expect(cs.player.skillsPlayedThisTurn).toBe(12);
    expect(cs.player.exhaust).toHaveLength(12); // 干薪束与掩灯都消耗，返能仍只触发一次
    expect(cs.player.energy).toBe(4);
    expect(cs.player.statuses.energyNext).toBe(1);
    expect(draws(first)).toBe(2);
    for (const relic of cs.relics) expect(procs(first, relic)).toBe(1);

    cs = nextTurn(cs);
    expect(cs.player.energy).toBe(4);
    expect(cs.player.statuses.energyNext ?? 0).toBe(0);
    const second: CombatEvent[] = [];
    cs = emptyHand(cs, second);
    expect(cs.player.skillsPlayedThisTurn).toBe(7);
    expect(cs.player.exhaust).toHaveLength(19);
    expect(cs.player.energy).toBe(5);
    expect(cs.player.statuses.energyNext).toBe(1);
    expect(draws(second)).toBe(2);
    for (const relic of cs.relics) expect(procs(second, relic)).toBe(1);
    cs = nextTurn(cs);
    expect(cs.player.energy).toBe(4);
    expect(cs.player.statuses.energyNext ?? 0).toBe(0);
  });

  it('旧书与黑日叠加镜像时能力不被回响复制，五次伤害仍只算一张牌，门钥每轮只返一次能量', () => {
    let cs = battle('scholar', ['old_tome', 'black_sun', 'echo_key', 'clocktower_gear'],
      [mirror, mirror, mirror, 'whisper_needle', 'whisper_needle'],
      ['whisper_needle', mirror, ...copies('whisper_needle', 8)]);
    const first: CombatEvent[] = [];
    for (let i = 0; i < 3; i++) cs = use(cs, first, 'mirror');
    expect(cs.player.powerInstances).toHaveLength(3);
    expect(cs.player.statuses.echo).toBe(2);
    expect(cs.player.cardsPlayedThisTurn).toBe(3);
    expect(cs.player.energy).toBe(3);
    expect(procs(first, 'old_tome')).toBe(1);
    expect(procs(first, 'black_sun')).toBe(1);
    expect(procs(first, 'echo_key')).toBe(0);

    cs = use(cs, first, 'whisper_needle');
    expect(cs.enemies[0].hp).toBe(990); // 本体 + 回响 + 三张独立镜像，每次 2 点伤害。
    expect(cs.player.cardsPlayedThisTurn).toBe(4);
    expect(cs.player.attacksPlayedThisTurn).toBe(1);
    expect(cs.player.energy).toBe(5);
    expect(cs.player.block).toBe(18);
    expect(cs.player.statuses.echo).toBe(1);
    cs = emptyHand(cs, first);
    expect(cs.player.cardsPlayedThisTurn).toBe(6);
    expect(cs.player.energy).toBe(5);
    expect(cs.player.statuses.echo ?? 0).toBe(0);
    for (const relic of cs.relics) expect(procs(first, relic)).toBe(1);

    cs = nextTurn(cs);
    const second: CombatEvent[] = [];
    cs = use(cs, second, 'mirror');
    expect(cs.player.powerInstances).toHaveLength(4);
    expect(cs.player.statuses.echo).toBe(1);
    expect(cs.player.energy).toBe(3);
    const enemyHp = cs.enemies[0].hp;
    cs = use(cs, second, 'whisper_needle');
    expect(enemyHp - cs.enemies[0].hp).toBe(12);
    expect(cs.player.cardsPlayedThisTurn).toBe(2);
    expect(cs.player.attacksPlayedThisTurn).toBe(1);
    expect(cs.player.energy).toBe(4);
    expect(cs.player.block).toBe(4);
    cs = emptyHand(cs, second);
    expect(cs.player.energy).toBe(5);
    expect(procs(second, 'old_tome')).toBe(1);
    expect(procs(second, 'black_sun')).toBe(0);
    expect(procs(second, 'echo_key')).toBe(1);
    expect(procs(second, 'clocktower_gear')).toBe(1);
  });

  it('回响消耗牌可以结算两次卡面收益，却只消耗一次且不会重复触发能力、消耗或三技能返利', () => {
    let cs = battle('scholar', ['old_tome', 'foundry_core', 'echo_key', 'unwritten_page'],
      [mirror, 'traveling_supplies', 'traveling_supplies', 'shutter_lamp', 'shutter_lamp'], copies('shutter_lamp', 8));
    const events: CombatEvent[] = [];
    cs = use(cs, events, 'mirror');
    cs = use(cs, events, 'traveling_supplies');
    expect(cs.player.hp).toBe(58);
    expect(cs.player.exhaust).toHaveLength(1);
    expect(cs.player.cardsPlayedThisTurn).toBe(2);
    expect(cs.player.skillsPlayedThisTurn).toBe(1);
    expect(cs.player.energy).toBe(5);
    expect(cs.player.statuses.echo ?? 0).toBe(0);
    expect(draws(events)).toBe(3); // 药包自身抽两次，动力核只抽一次。
    expect(procs(events, 'unwritten_page')).toBe(0);

    cs = emptyHand(cs, events);
    expect(cs.player.hp).toBe(62);
    expect(cs.player.cardsPlayedThisTurn).toBe(10);
    expect(cs.player.skillsPlayedThisTurn).toBe(9);
    expect(cs.player.exhaust).toHaveLength(9); // 两张药包和七张掩灯，各只消耗一次
    expect(cs.player.energy).toBe(5);
    expect(cs.player.statuses.energyNext).toBe(1);
    expect(cs.player.powerInstances).toHaveLength(1);
    expect(draws(events)).toBe(5);
    expect(cs.player.draw).toHaveLength(3);
    for (const relic of cs.relics) expect(procs(events, relic)).toBe(1);
  });
});
