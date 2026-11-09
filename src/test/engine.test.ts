import { describe, expect, it } from 'vitest';
import { CARDS, CARD_LIST } from '../data/cards';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { EVENT_LIST } from '../data/events';
import { RELIC_LIST, relicPool } from '../data/relics';
import * as R from '../engine/run';
import { describeCard, viewCard } from '../engine/cards';
import { canPlayCard, createCombat, endPlayerTurn, enemyAct, enemyIntent, playCard, startPlayerTurn } from '../engine/combat';
import { generateMap, validateMap } from '../engine/map';
import { makeRng } from '../engine/rng';
import type { CardInstance, CombatState } from '../engine/types';

let uidN = 0;
const card = (defId: string, upgraded = false): CardInstance => ({ uid: `t${++uidN}`, defId, upgraded });

function combatWith(deck: CardInstance[], enemies: string[], relics: string[] = [], seed = 'test'): CombatState {
  return createCombat('t', enemies, 'normal', deck, 60, 60, relics, makeRng(seed, 'c'), 0).state;
}

function handCard(cs: CombatState, defId: string) {
  const c = cs.player.hand.find((c) => c.defId === defId);
  if (!c) throw new Error(`手牌中没有 ${defId}`);
  return c;
}

describe('内容数量', () => {
  it('达到第一版范围要求', () => {
    expect(CARD_LIST.filter((c) => c.type !== 'curse').length).toBeGreaterThanOrEqual(30);
    expect(RELIC_LIST.length).toBeGreaterThanOrEqual(10);
    const defs = Object.values(ENEMIES);
    expect(defs.filter((e) => e.tier === 'normal').length).toBeGreaterThanOrEqual(8);
    expect(defs.filter((e) => e.tier === 'elite').length).toBeGreaterThanOrEqual(3);
    expect(defs.filter((e) => e.tier === 'boss').length).toBeGreaterThanOrEqual(1);
    expect(EVENT_LIST.length).toBeGreaterThanOrEqual(6);
  });
  it('每张非诅咒卡都有可区分的升级版本', () => {
    for (const c of CARD_LIST) {
      if (c.type === 'curse') continue;
      const a = describeCard(card(c.id), null) + viewCard(card(c.id)).cost;
      const b = describeCard(card(c.id, true), null) + viewCard(card(c.id, true)).cost;
      expect(b, c.id).not.toEqual(a);
    }
  });
  it('遭遇引用的敌人与敌人招式都存在', () => {
    for (const enc of ENCOUNTERS) for (const id of enc.enemies) expect(ENEMIES[id], id).toBeDefined();
    for (const e of Object.values(ENEMIES)) {
      for (let t = 0; t < 12; t++) {
        const cs = combatWith([card('strike')], [e.id], [], `s${t}`);
        const mv = cs.enemies[0].moveId!;
        expect(e.moves.some((m) => m.id === mv), `${e.id} -> ${mv}`).toBe(true);
      }
    }
  });
});

describe('地图', () => {
  it('所有节点都能通向 Boss，且类型分布合理', () => {
    for (let i = 0; i < 40; i++) {
      const map = generateMap(makeRng(`m${i}`, 'map'));
      expect(validateMap(map)).toBe(true);
      const nodes = Object.values(map.nodes);
      expect(nodes.filter((n) => n.type === 'elite').length).toBeGreaterThanOrEqual(2);
      expect(nodes.filter((n) => n.type === 'shop').length).toBeGreaterThanOrEqual(1);
      expect(map.rows).toBe(20);
      expect(nodes.filter((n) => n.row === 18).every(n => n.type === 'rest')).toBe(true);
      expect(map.nodes.boss.row).toBe(19);
      for (const node of nodes) for (const next of node.next) expect(map.nodes[next].row).toBe(node.row + 1);
      expect(nodes.filter((n) => n.row === 0).every((n) => n.type === 'combat')).toBe(true);
      expect(map.nodes.boss.type).toBe('boss');
    }
  });
});

describe('战斗基础', () => {
  it('开局抽 5 张，余烬灯给 2 余烬，抽牌堆不足时洗牌', () => {
    const deck = Array.from({ length: 7 }, () => card('strike'));
    const cs = combatWith(deck, ['tomb_puppet'], ['ember_lantern']);
    expect(cs.player.hand.length).toBe(5);
    expect(cs.player.draw.length).toBe(2);
    expect(cs.player.ember).toBe(2);
    // 打两张、结束回合，下回合需要洗牌
    let s = cs;
    s = playCard(s, s.player.hand[0].uid, 'e0').state;
    s = playCard(s, s.player.hand[0].uid, 'e0').state;
    s = endPlayerTurn(s).state;
    expect(s.player.hand.length).toBe(0);
    expect(s.player.discard.length).toBe(5);
    s = enemyAct(s, 'e0').state;
    s = startPlayerTurn(s).state;
    expect(s.player.hand.length).toBe(5);
    expect(s.player.draw.length + s.player.discard.length + s.player.hand.length).toBe(7);
  });

  it('费用、目标与余烬需求被校验', () => {
    const cs = combatWith([card('ember_blade'), card('iron_wall'), card('iron_wall'), card('ashes'), card('strike')], ['tomb_puppet']);
    expect(canPlayCard(cs, handCard(cs, 'ember_blade')).ok).toBe(false); // 余烬 0 < 2
    expect(canPlayCard(cs, handCard(cs, 'ashes')).ok).toBe(false);
    let s = playCard(cs, handCard(cs, 'iron_wall').uid, null).state;
    expect(s.player.energy).toBe(1);
    expect(s.player.block).toBe(12);
    expect(canPlayCard(s, handCard(s, 'iron_wall')).ok).toBe(false); // 能量不足
    // 无效目标不会结算
    const before = s;
    s = playCard(s, handCard(s, 'strike').uid, 'e9').state;
    expect(s).toBe(before);
  });

  it('伤害公式：力量、虚弱、易伤；意图与实际一致', () => {
    const cs = combatWith([card('strike'), card('trip'), card('vigil'), card('strike'), card('strike')], ['tomb_puppet']);
    let s = playCard(cs, handCard(cs, 'trip').uid, 'e0').state; // 2 易伤
    const hpBefore = s.enemies[0].hp;
    s = playCard(s, handCard(s, 'strike').uid, 'e0').state;
    expect(hpBefore - s.enemies[0].hp).toBe(9); // 6 * 1.5
    s = playCard(s, handCard(s, 'vigil').uid, 'e0').state; // 敌人虚弱
    const intent = enemyIntent(s, s.enemies[0])!;
    const moveDmg = ENEMIES.tomb_puppet.moves.find((m) => m.id === s.enemies[0].moveId)!;
    if (intent.kind === 'attack') {
      expect(intent.amount).toBe(Math.floor((moveDmg.actions[0] as { amount: number }).amount * 0.75));
      const blockBefore = s.player.block;
      const hp = s.player.hp;
      s = endPlayerTurn(s).state;
      s = enemyAct(s, 'e0').state;
      expect(hp - s.player.hp).toBe(Math.max(0, intent.amount - blockBefore));
    }
  });

  it('多段攻击与荆棘：攻击者可能在中途死亡', () => {
    const cs = combatWith([card('thorn_mail'), card('thorn_mail'), card('thorn_mail'), card('defend'), card('defend')], ['looter'], ['thorn_crown']);
    let s = cs;
    s = playCard(s, handCard(s, 'thorn_mail').uid, null).state;
    s = playCard(s, handCard(s, 'thorn_mail').uid, null).state; // 荆棘 3+2+2 = 7
    expect(s.player.statuses.thorns).toBe(7);
    s.enemies[0].hp = 10;
    s.enemies[0].moveId = 'flurry'; // 3 × 3
    s = endPlayerTurn(s).state;
    const hp = s.player.hp;
    s = enemyAct(s, 'e0').state;
    expect(s.enemies[0].hp).toBe(0);
    expect(s.outcome).toBe('won');
    // 只挨了两下：第二下后荆棘致死
    const taken = hp - s.player.hp;
    expect(taken).toBeLessThanOrEqual(6);
  });

  it('余烬：上限 10，爆发消耗全部并按点数结算', () => {
    const cs = combatWith([card('stoke'), card('stoke'), card('stoke'), card('ember_burst'), card('strike')], ['rubble_golem']);
    let s = cs;
    s = playCard(s, handCard(s, 'stoke').uid, null).state;
    s = playCard(s, handCard(s, 'stoke').uid, null).state;
    s = playCard(s, handCard(s, 'stoke').uid, null).state;
    expect(s.player.ember).toBe(9);
    expect(s.player.energy).toBe(0);
    s.player.energy = 3;
    // 补一张 stoke 测试上限
    s.player.hand.push(card('stoke'));
    s = playCard(s, handCard(s, 'stoke').uid, null).state;
    expect(s.player.ember).toBe(10);
    const hp = s.enemies[0].hp;
    s = playCard(s, handCard(s, 'ember_burst').uid, 'e0').state;
    expect(hp - s.enemies[0].hp).toBe(40);
    expect(s.player.ember).toBe(0);
  });

  it('能力牌打出后不进入弃牌堆，消耗牌进入消耗区，升级改变数值', () => {
    const cs = combatWith([card('iron_will'), card('haste'), card('strike', true), card('defend'), card('defend')], ['tomb_puppet']);
    let s = playCard(cs, handCard(cs, 'iron_will').uid, null).state;
    expect(s.player.statuses.metallicize).toBe(3);
    expect(s.player.discard.length).toBe(0);
    s = playCard(s, handCard(s, 'haste').uid, null).state;
    expect(s.player.exhaust.length).toBe(1);
    expect(s.player.energy).toBe(3); // 1-1+1
    const hp = s.enemies[0].hp;
    s = playCard(s, handCard(s, 'strike').uid, 'e0').state;
    expect(hp - s.enemies[0].hp).toBe(9);
    s = endPlayerTurn(s).state;
    expect(s.player.block).toBe(3); // 钢铁意志
  });

  it('Boss 阶段切换与清除减益', () => {
    const cs = combatWith([card('trip'), card('strike'), card('strike'), card('strike'), card('strike')], ['ash_sovereign']);
    let s = playCard(cs, handCard(cs, 'trip').uid, 'e0').state;
    expect(s.enemies[0].statuses.vulnerable).toBe(2);
    s.enemies[0].hp = Math.floor(s.enemies[0].maxHp / 2) + 5; // 一击（6×1.5=9）后跌破一半
    s = playCard(s, handCard(s, 'strike').uid, 'e0').state;
    expect(s.enemies[0].phase).toBe(2);
    expect(s.enemies[0].moveId).toBe('awaken');
    s = endPlayerTurn(s).state;
    s = enemyAct(s, 'e0').state;
    expect(s.enemies[0].statuses.vulnerable).toBeUndefined();
    expect(s.enemies[0].block).toBe(18);
    expect(s.player.statuses.weak).toBe(2);
    expect(['sear_sky', 'ignite', 'cinder_storm']).toContain(s.enemies[0].moveId);
  });

  it('双生哨卫：同伴死亡触发暴怒', () => {
    const cs = combatWith([card('strike'), card('strike'), card('strike'), card('strike'), card('strike')], ['twin_sentinel', 'twin_sentinel']);
    let s = cs;
    s.enemies[0].hp = 1;
    s = playCard(s, s.player.hand[0].uid, 'e0').state;
    expect(s.enemies[0].hp).toBe(0);
    expect(s.enemies[1].statuses.strength).toBe(3);
    expect(s.outcome).toBe('ongoing');
  });

  it('玩家死亡结算', () => {
    const cs = combatWith([card('strike'), card('strike'), card('strike'), card('strike'), card('strike')], ['rubble_golem']);
    let s = cs;
    s.player.hp = 1;
    s.enemies[0].moveId = 'crush';
    s = endPlayerTurn(s).state;
    s = enemyAct(s, 'e0').state;
    expect(s.outcome).toBe('lost');
    expect(s.player.hp).toBe(0);
  });

  it('描述数值随状态变化', () => {
    const cs = combatWith([card('strike'), card('strike'), card('strike'), card('strike'), card('strike')], ['tomb_puppet'], ['flint']);
    cs.player.statuses.strength = 2;
    const text = describeCard(handCard(cs, 'strike'), {
      player: cs.player,
      target: cs.enemies[0],
      relics: cs.relics,
      isFirstAttack: true,
      crescendoBonus: 0,
    });
    expect(text).toContain('12'); // 6 + 2 + 4
    expect(CARDS.strike).toBeDefined();
  });

  it('同一回合敌人不会重复行动（刷新恢复安全）', () => {
    const cs = combatWith([card('strike'), card('strike'), card('strike'), card('strike'), card('strike')], ['tomb_puppet', 'tomb_puppet']);
    let s = endPlayerTurn(cs).state;
    const hp = s.player.hp;
    s = enemyAct(s, 'e0').state;
    const afterFirst = s.player.hp;
    const again = enemyAct(s, 'e0');
    expect(again.events.length).toBe(0);
    expect(again.state.player.hp).toBe(afterFirst);
    s = enemyAct(s, 'e1').state;
    expect(s.enemies.every((e) => e.flags.acted === 1)).toBe(true);
    s = startPlayerTurn(s).state;
    expect(s.enemies.every((e) => !e.flags.acted)).toBe(true);
    expect(hp - s.player.hp).toBeGreaterThanOrEqual(0);
  });

  describe('拾灰者', () => {
    const pickerCombat = (deck: CardInstance[], enemies: string[], relics: string[] = ['picker_bell']) =>
      createCombat('t', enemies, 'normal', deck, 60, 60, relics, makeRng('picker', 'c'), 0, 'picker').state;

    it('铃铛开场施加燃烧；燃烧在敌人回合开始结算并衰减；火绒盒加伤；不灭之火阻止衰减', () => {
      let s = pickerCombat([card('strike'), card('strike'), card('strike'), card('strike'), card('strike')], ['tomb_puppet'], ['picker_bell', 'tinderbox']);
      expect(s.enemies[0].statuses.burn).toBe(2);
      const hp = s.enemies[0].hp;
      s = endPlayerTurn(s).state;
      s = enemyAct(s, 'e0').state;
      expect(hp - s.enemies[0].hp).toBe(4); // 2 + 2
      expect(s.enemies[0].statuses.burn).toBe(1);
      s.player.statuses.everburn = 1;
      s = startPlayerTurn(s).state;
      s = endPlayerTurn(s).state;
      s = enemyAct(s, 'e0').state;
      expect(s.enemies[0].statuses.burn).toBe(1);
    });

    it('添油翻倍、引爆移除燃烧并按层数伤害、灼痕条件加伤', () => {
      let s = pickerCombat([card('add_fuel'), card('detonate'), card('scorch_mark'), card('strike'), card('strike')], ['rubble_golem']);
      s = playCard(s, handCard(s, 'add_fuel').uid, 'e0').state;
      expect(s.enemies[0].statuses.burn).toBe(4);
      let hp = s.enemies[0].hp;
      s = playCard(s, handCard(s, 'scorch_mark').uid, 'e0').state;
      expect(hp - s.enemies[0].hp).toBe(10); // 6 + 4
      hp = s.enemies[0].hp;
      s = playCard(s, handCard(s, 'detonate').uid, 'e0').state;
      expect(hp - s.enemies[0].hp).toBe(12); // 4 × 3
      expect(s.enemies[0].statuses.burn).toBeUndefined();
    });

    it('焚书消耗随机手牌换能量并触发灰烬盛宴 / 火种传递 / 骨灰坛；灰烬再临取回', () => {
      let s = pickerCombat([card('ash_feast'), card('pass_the_flame'), card('burn_pages'), card('strike'), card('strike')], ['tomb_puppet'], ['picker_bell', 'bone_urn']);
      s.player.energy = 5;
      s = playCard(s, handCard(s, 'ash_feast').uid, null).state;
      s = playCard(s, handCard(s, 'pass_the_flame').uid, null).state;
      s.player.draw.push(card('defend')); // 供骨灰坛抽牌
      const handBefore = s.player.hand.length; // 3
      const enemyHp = s.enemies[0].hp;
      const energy = s.player.energy;
      s = playCard(s, handCard(s, 'burn_pages').uid, null).state;
      expect(s.player.exhaust.length).toBe(1);
      expect(s.player.block).toBe(3); // 灰烬盛宴
      expect(enemyHp - s.enemies[0].hp).toBe(4); // 火种传递
      expect(s.player.energy).toBe(energy + 1);
      // 焚书本身进弃牌堆、消耗一张、骨灰坛抽一张 → 手牌 -1 -1 +1
      expect(s.player.hand.length).toBe(handBefore - 1);
      s.player.hand.push(card('ash_return'));
      s.player.energy = 3;
      const exhaustedId = s.player.exhaust[0].uid;
      s = playCard(s, handCard(s, 'ash_return').uid, null).state;
      expect(s.player.exhaust.length).toBe(0);
      expect(s.player.hand.some((c) => c.uid === exhaustedId)).toBe(true);
    });

    it('焚尽消耗全部手牌并按张数造成伤害', () => {
      let s = pickerCombat([card('burn_it_all'), card('strike'), card('strike'), card('defend'), card('defend')], ['rubble_golem']);
      const hp = s.enemies[0].hp;
      s = playCard(s, handCard(s, 'burn_it_all').uid, 'e0').state;
      expect(s.player.hand.length).toBe(0);
      expect(s.player.exhaust.length).toBe(4);
      expect(hp - s.enemies[0].hp).toBe(24);
    });

    it('卡池与遗物池按角色过滤', () => {
      const runT = R.newRun('pool', 'traveler');
      const runP = R.newRun('pool', 'picker');
      expect(runP.relics).toEqual(['picker_bell']);
      expect(runP.deck.map((c) => c.defId)).toContain('light_up');
      for (let i = 0; i < 20; i++) {
        for (const c of R.generateCardChoices(runT, 'normal', 3)) expect(['combo', 'bulwark', 'ember', 'basic']).toContain(CARDS[c.defId].archetype);
        for (const c of R.generateCardChoices(runP, 'normal', 3)) expect(['cinder', 'ash', 'ember', 'basic']).toContain(CARDS[c.defId].archetype);
      }
      expect(relicPool([], 'picker').some((r) => r.archetype === 'combo')).toBe(false);
      expect(relicPool([], 'traveler').some((r) => r.archetype === 'cinder')).toBe(false);
    });
  });

  describe('血誓者 / 灰语学者 / 新敌人', () => {
    const mk = (deck: CardInstance[], enemies: string[], relics: string[], ch: 'oathbound' | 'scholar' | 'traveler' = 'traveler') =>
      createCombat('t', enemies, 'normal', deck, 60, 60, relics, makeRng('x', 'c'), 0, ch).state;

    it('血誓印、失去生命触发血契与铁颅、临时力量回合结束消失、吸血', () => {
      let s = mk([card('blood_pact'), card('flex'), card('blood_edge'), card('leech_bite'), card('strike')], ['rubble_golem'], ['blood_seal', 'iron_skull'], 'oathbound');
      expect(s.player.hp).toBe(58);
      expect(s.player.statuses.strength).toBe(1);
      s = playCard(s, handCard(s, 'blood_pact').uid, null).state;
      s = playCard(s, handCard(s, 'flex').uid, null).state; // +2 临时
      expect(s.player.statuses.strength).toBe(3);
      const hpBefore = s.player.hp;
      const ehp = s.enemies[0].hp;
      s = playCard(s, handCard(s, 'blood_edge').uid, 'e0').state; // 失去 2 → 血契 +1 力量（先于伤害）→ 9+4=13
      expect(s.player.hp).toBe(hpBefore - 2);
      expect(s.player.statuses.strength).toBe(4);
      expect(s.player.block).toBe(2); // 铁颅
      expect(ehp - s.enemies[0].hp).toBe(13);
      s.player.hp = 30;
      s.player.energy = 1;
      const e2 = s.enemies[0].hp;
      s = playCard(s, handCard(s, 'leech_bite').uid, 'e0').state; // 7+4 = 11 吸血
      expect(e2 - s.enemies[0].hp).toBe(11);
      expect(s.player.hp).toBe(41);
      s = endPlayerTurn(s).state;
      expect(s.player.statuses.strength).toBe(2); // 力竭 -2
      expect(s.player.statuses.strengthDown).toBeUndefined();
    });

    it('回响让下一张牌触发两次并被消耗；镜像只对每回合首张攻击；音叉给余烬', () => {
      let s = mk([card('strike'), card('mirror'), card('strike'), card('defend'), card('defend')], ['rubble_golem'], ['echo_stone', 'tuning_fork'], 'scholar');
      expect(s.player.statuses.echo).toBe(1);
      s.player.energy = 5;
      s = playCard(s, handCard(s, 'mirror').uid, null).state; // 能力牌不消耗回响
      expect(s.player.statuses.echo).toBe(1);
      const hp = s.enemies[0].hp;
      s = playCard(s, handCard(s, 'strike').uid, 'e0').state; // 原始效果 + 回响 + 镜像
      expect(hp - s.enemies[0].hp).toBe(18);
      expect(s.player.statuses.echo).toBeUndefined();
      expect(s.player.ember).toBe(2);
      const hp2 = s.enemies[0].hp;
      s = playCard(s, handCard(s, 'strike').uid, 'e0').state; // 第二张攻击：无镜像
      expect(hp2 - s.enemies[0].hp).toBe(6);
    });

    it('保留牌留在手上并蓄力；蓄能下回合加能量；博学多抽', () => {
      let s = mk([card('rune_shield'), card('focus'), card('erudition'), card('strike'), card('strike')], ['tomb_puppet'], ['echo_stone'], 'scholar');
      s.player.draw.push(card('defend'), card('defend'), card('defend'), card('defend'), card('defend'), card('defend'));
      s.player.energy = 5;
      s.player.statuses = {}; // 清掉回响便于计算
      s = playCard(s, handCard(s, 'erudition').uid, null).state;
      s = playCard(s, handCard(s, 'focus').uid, null).state;
      const shield = handCard(s, 'rune_shield');
      s = endPlayerTurn(s).state;
      expect(s.player.hand.map((c) => c.uid)).toEqual([shield.uid]);
      expect(s.player.hand[0].bonus).toBe(1);
      s = enemyAct(s, 'e0').state;
      s = startPlayerTurn(s).state;
      expect(s.player.energy).toBe(4); // 蓄能 +1
      expect(s.player.hand.length).toBe(1 + 6); // 保留 1 + 抽 5 + 博学 1
      s.player.statuses.frail = 0;
      delete s.player.statuses.frail;
      s = playCard(s, shield.uid, null).state;
      expect(s.player.block).toBe(4 + 3);
    });

    it('攻击带荆棘的敌人会反伤；余烬虫死亡点燃玩家；钟楼之心二阶段', () => {
      let s = mk([card('strike'), card('strike'), card('strike'), card('strike'), card('strike')], ['hollow_guard'], []);
      expect(s.enemies[0].statuses.thorns).toBe(2);
      s = playCard(s, s.player.hand[0].uid, 'e0').state;
      expect(s.player.hp).toBe(58);
      let g = mk([card('strike'), card('strike'), card('strike'), card('strike'), card('strike')], ['ember_grub'], []);
      g.enemies[0].hp = 1;
      g = playCard(g, g.player.hand[0].uid, 'e0').state;
      expect(g.outcome).toBe('won');
      expect(g.player.statuses.burn).toBe(2);
      let b = mk([card('strike'), card('strike'), card('strike'), card('strike'), card('strike')], ['bell_heart'], []);
      b.enemies[0].hp = 66;
      b = playCard(b, b.player.hand[0].uid, 'e0').state;
      expect(b.enemies[0].phase).toBe(2);
      expect(b.enemies[0].moveId).toBe('overdrive');
      b = endPlayerTurn(b).state;
      b = enemyAct(b, 'e0').state;
      expect(b.player.discard.filter((c) => c.defId === 'ashes').length).toBe(2);
      expect(['flurry', 'toll', 'shatter']).toContain(b.enemies[0].moveId);
    });

    it('四名角色都能开局，卡池互不串用', () => {
      for (const ch of ['traveler', 'picker', 'oathbound', 'scholar'] as const) {
        const run = R.newRun('four', ch);
        expect(run.deck.length).toBe(10);
        for (let i = 0; i < 15; i++) {
          for (const c of R.generateCardChoices(run, 'normal', 3)) {
            const d = CARDS[c.defId];
            expect(!d.owner || d.owner === ch, `${ch} got ${d.id}`).toBe(true);
          }
        }
      }
    });
  });
});
