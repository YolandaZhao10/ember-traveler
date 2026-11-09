import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { viewCard } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import type { CombatState } from '../engine/types';

const card = (id: string, up = false, uid = id) => ({ uid, defId: id, upgraded: up });
function battle(id: string, up = false, enemies = 1): CombatState {
  const cs = createCombat('card-floor', Array.from({ length: enemies }, () => 'tomb_puppet'), 'normal', [], 200, 200, [], makeRng('CARD-FLOOR', 'combat'), 100, CARDS[id].owner ?? 'traveler').state;
  cs.enemies.forEach(e => { e.hp = e.maxHp = 1000; e.block = 0; e.statuses = {}; e.moveId = 'smash'; });
  cs.player.hand = [card(id, up)];
  cs.player.draw = Array.from({ length: 12 }, (_, i) => card('defend', false, `draw-${i}`));
  cs.player.energy = 3;
  return cs;
}
function use(cs: CombatState, uid: string) {
  const c = cs.player.hand.find(c => c.uid === uid)!;
  return playCard(cs, uid, viewCard(c).target === 'enemy' ? 'e0' : null).state;
}
function measure(id: string, up = false, setup?: (cs: CombatState) => void) {
  const before = battle(id, up);
  setup?.(before);
  const after = use(before, id);
  return {
    before, after,
    damage: before.enemies[0].hp - after.enemies[0].hp,
    block: after.player.block - before.player.block,
    cost: before.player.energy - after.player.energy,
  };
}
function round(input: CombatState) {
  let cs = endPlayerTurn(input).state;
  for (const id of cs.enemies.map(e => e.id)) {
    cs.enemies.find(e => e.id === id)!.moveId = 'smash';
    cs = enemyAct(cs, id).state;
  }
  return cs.outcome === 'ongoing' ? startPlayerTurn(cs).state : cs;
}
const upgrades = [false, true] as const;

describe('基础打击、防御的实际收益下限', () => {
  it.each(['charged_blade', 'overpower', 'eye_for_eye', 'riposte', 'chain_slash', 'scorch_mark'].flatMap(id => upgrades.map(up => ({ id, up }))))('$id 升级=$up：无铺垫时不弱于同费打击，裸伤仍受上限限制', ({ id, up }) => {
    const base = measure('strike', up);
    const candidate = measure(id, up);
    expect(candidate.cost).toBe(base.cost);
    expect(candidate.cost).toBe(1);
    expect(candidate.damage).toBeGreaterThanOrEqual(base.damage);
    // 这些均可重复使用，不应靠本轮补强变成无条件的高倍爆发牌。
    expect(candidate.damage).toBeLessThanOrEqual(12);
    expect(candidate.after.player.hp).toBe(candidate.before.player.hp);
    expect(candidate.after.player.energy).toBe(2);
  });

  it.each(upgrades)('符文护盾升级=%s：紧急防御至少等于防御，不能免去能量代价', up => {
    const base = measure('defend', up);
    const candidate = measure('rune_shield', up);
    expect(candidate.cost).toBe(base.cost);
    expect(candidate.block).toBeGreaterThanOrEqual(base.block);
    expect(candidate.block).toBeLessThanOrEqual(base.block + 2);
    const exhaustedEnergy = battle('rune_shield', up);
    exhaustedEnergy.player.energy = 0;
    expect(use(exhaustedEnergy, 'rune_shield')).toBe(exhaustedEnergy);
  });

  it.each(['rune_shield', 'charged_blade'])('%s 经过真实回合保留后继续成长，不增加消耗或改变费用', id => {
    for (const up of upgrades) {
      const immediate = measure(id, up);
      const before = round(battle(id, up));
      expect(before.player.hand.some(c => c.uid === id)).toBe(true);
      const after = use(before, id);
      const value = id === 'rune_shield' ? after.player.block - before.player.block : before.enemies[0].hp - after.enemies[0].hp;
      const baseValue = id === 'rune_shield' ? immediate.block : immediate.damage;
      expect(value).toBeGreaterThan(baseValue);
      expect(value).toBeLessThanOrEqual(baseValue + 5);
      expect(before.player.energy - after.player.energy).toBe(immediate.cost);
      expect(after.player.exhaust.some(c => c.uid === id)).toBe(false);
    }
  });

  it.each(['coal_lance', 'iron_rebuke'])('%s 无铺垫时仍能攻击，但不应超过两张同级打击', id => {
    for (const up of upgrades) {
      const base = measure('strike', up);
      const candidate = measure(id, up);
      expect(candidate.cost).toBe(2 * base.cost);
      // 长枪的额外费用主要换燃烧收益；回敬另有持续虚弱和格挡转伤。
      expect(candidate.damage).toBeGreaterThanOrEqual(base.damage + (id === 'coal_lance' ? 3 : 0));
      expect(candidate.damage).toBeLessThanOrEqual(base.damage * 2);
      expect(candidate.after.player.energy).toBe(1);
    }
  });
});

describe('轻量构筑条件带来优势，而非只抬高面板', () => {
  it('一层力量已足以让力量碾压超过同样力量下的打击', () => {
    for (const up of upgrades) {
      const setup = (cs: CombatState) => { cs.player.statuses.strength = 1; };
      const base = measure('strike', up, setup);
      const candidate = measure('overpower', up, setup);
      expect(candidate.cost).toBe(base.cost);
      expect(candidate.damage).toBeGreaterThan(base.damage);
      expect(candidate.damage).toBeLessThanOrEqual(base.damage + 4);
    }
  });

  it('以血还血在已失去两点生命后有收益，不能凭空恢复生命或获得能量', () => {
    for (const up of upgrades) {
      const base = measure('strike', up);
      const naked = measure('eye_for_eye', up);
      const candidate = measure('eye_for_eye', up, cs => { cs.player.hp -= 2; cs.player.hpLostThisTurn = 2; });
      expect(candidate.damage).toBeGreaterThan(base.damage);
      expect(candidate.damage - naked.damage).toBeGreaterThanOrEqual(4);
      expect(candidate.damage - naked.damage).toBeLessThanOrEqual(6);
      expect(candidate.damage).toBeLessThanOrEqual(base.damage * 2);
      expect(candidate.after.player.hp).toBe(198);
      expect(candidate.cost).toBe(1);
    }
  });

  it('已有五格挡的反击产生额外伤害，同时保留防御资源', () => {
    for (const up of upgrades) {
      const base = measure('strike', up);
      const naked = measure('riposte', up);
      const candidate = measure('riposte', up, cs => { cs.player.block = 5; });
      expect(candidate.damage).toBeGreaterThan(naked.damage);
      expect(candidate.damage).toBeGreaterThan(base.damage);
      expect(candidate.damage).toBeLessThanOrEqual(base.damage * 2);
      expect(candidate.after.player.block).toBe(5);
      expect(candidate.cost).toBe(1);
    }
  });

  it('灼痕对两层燃烧的目标有增益，并且不消费已有燃烧', () => {
    for (const up of upgrades) {
      const base = measure('strike', up);
      const naked = measure('scorch_mark', up);
      const candidate = measure('scorch_mark', up, cs => { cs.enemies[0].statuses.burn = 2; });
      expect(candidate.damage).toBeGreaterThan(naked.damage);
      expect(candidate.damage).toBeGreaterThan(base.damage);
      expect(candidate.damage).toBeLessThanOrEqual(base.damage * 2);
      expect(candidate.after.enemies[0].statuses.burn).toBe(2);
      expect(candidate.cost).toBe(1);
    }
  });

  it('连环斩在真实打出两张零费攻击后强化后续打击，临时力量不会留到下回合', () => {
    for (const up of upgrades) {
      let cs = battle('chain_slash', up);
      cs.player.hand.push(card('quick_stab', false, 'setup-a'), card('quick_stab', false, 'setup-b'), card('strike', up));
      cs = use(use(cs, 'setup-a'), 'setup-b');
      const before = cs;
      cs = use(cs, 'chain_slash');
      const beforeStrike = cs;
      cs = use(cs, 'strike');
      const base = measure('strike', up);
      expect(before.enemies[0].hp - cs.enemies[0].hp).toBeGreaterThan(base.damage * 2);
      expect(beforeStrike.enemies[0].hp - cs.enemies[0].hp).toBeLessThanOrEqual(base.damage + 3);
      expect(before.player.energy - cs.player.energy).toBe(2);
      expect(round(cs).player.statuses.strength ?? 0).toBe(0);
    }
  });

  it('炭火长枪在两层燃烧下至少达到两张打击的伤害，而且不消耗燃烧', () => {
    for (const up of upgrades) {
      const base = measure('strike', up);
      const candidate = measure('coal_lance', up, cs => { cs.enemies[0].statuses.burn = 2; });
      expect(candidate.damage).toBeGreaterThanOrEqual(base.damage * 2);
      expect(candidate.damage).toBeLessThanOrEqual(base.damage * 2 + 4);
      expect(candidate.cost).toBe(base.cost * 2);
      expect(candidate.after.enemies[0].statuses.burn).toBe(2);
    }
  });

  it('铁壁回敬配合一张防御：攻击与虚弱减伤之和足以支付两费，格挡不被消费', () => {
    for (const up of upgrades) {
      const prepare = (id: string) => {
        let cs = battle(id, up);
        cs.player.hand.push(card('defend', false, 'setup-block'));
        cs = use(cs, 'setup-block');
        return cs;
      };
      const before = prepare('iron_rebuke');
      const candidate = use(before, 'iron_rebuke');
      const control = prepare('strike');
      control.player.hand.push(card('strike', up, 'second-strike'));
      const attacked = use(use(control, 'strike'), 'second-strike');
      expect(candidate.player.block).toBe(before.player.block);
      expect(candidate.player.energy).toBe(attacked.player.energy);
      const returned = round(candidate);
      const unweakened = round(attacked);
      const damage = before.enemies[0].hp - candidate.enemies[0].hp;
      const savedHp = returned.player.hp - unweakened.player.hp;
      const twoStrikes = control.enemies[0].hp - attacked.enemies[0].hp;
      expect(savedHp).toBeGreaterThan(0);
      expect(damage + savedHp).toBeGreaterThanOrEqual(twoStrikes);
      expect(damage + savedHp).toBeLessThanOrEqual(twoStrikes + 5);
    }
  });

  it('千刃有两次零费铺垫时达到稀有终结技收益，但不会无条件获得同样段数', () => {
    for (const up of upgrades) {
      let cs = battle('thousand_cuts', up);
      cs.player.hand.push(card('quick_stab', false, 'setup-a'), card('quick_stab', false, 'setup-b'));
      cs = use(use(cs, 'setup-a'), 'setup-b');
      const before = cs;
      const after = use(cs, 'thousand_cuts');
      const damage = before.enemies[0].hp - after.enemies[0].hp;
      const twoStrikes = measure('strike', up).damage * 2;
      expect(damage).toBeGreaterThanOrEqual(twoStrikes + measure('strike').damage);
      expect(damage).toBeLessThanOrEqual(twoStrikes + 8);
      expect(before.player.energy - after.player.energy).toBe(2);
      expect(measure('thousand_cuts', up).damage).toBeLessThan(damage / 2);
    }
  });
});

describe('延迟、群体和功能收益不能仅按单段数字判断', () => {
  it('燎原只花一费，在三次敌人行动内对每个目标至少兑现一次打击的伤害', () => {
    for (const up of upgrades) {
      const before = battle('wildfire', up, 2);
      let cs = use(before, 'wildfire');
      expect(before.player.energy - cs.player.energy).toBe(1);
      const base = measure('strike', up).damage;
      for (let i = 0; i < 3; i++) cs = round(cs);
      for (const [index, enemy] of cs.enemies.entries()) {
        const damage = before.enemies[index].hp - enemy.hp;
        expect(damage).toBeGreaterThanOrEqual(base);
        expect(damage).toBeLessThanOrEqual(base * 2);
      }
      expect(cs.enemies.reduce((sum, e) => sum + (1000 - e.hp), 0)).toBeGreaterThanOrEqual(base * 2);
    }
  });

  it('诱火两回合内的燃烧与真实虚弱减伤合计超过打击，同时不会变成超额持续伤害', () => {
    for (const up of upgrades) {
      const before = battle('spark_lure', up);
      let candidate = use(before, 'spark_lure');
      let control = battle('strike', up);
      expect(before.player.energy - candidate.player.energy).toBe(1);
      for (let i = 0; i < 2; i++) { candidate = round(candidate); control = round(control); }
      const damage = before.enemies[0].hp - candidate.enemies[0].hp;
      const savedHp = candidate.player.hp - control.player.hp;
      const base = measure('strike', up).damage;
      expect(savedHp).toBeGreaterThan(0);
      expect(damage + savedHp).toBeGreaterThan(base);
      expect(damage + savedHp).toBeLessThanOrEqual(base * 2);
    }
  });

  it('荆棘甲虽然即时格挡较低，敌人攻击后防护与反伤之和仍超过基础防御', () => {
    for (const up of upgrades) {
      const armor = measure('thorn_mail', up);
      const defense = measure('defend', up);
      const bare = battle('strike', up);
      const armored = round(armor.after);
      const undefended = round(bare);
      const prevented = armored.player.hp - undefended.player.hp;
      const reflected = armor.before.enemies[0].hp - armored.enemies[0].hp;
      expect(armor.block).toBeLessThan(defense.block);
      expect(prevented + reflected).toBeGreaterThan(defense.block);
      expect(armor.cost).toBe(defense.cost);
    }
  });

  it('抽牌、多段与零费牌保留各自优势，不强行把每段都提高到打击', () => {
    for (const up of upgrades) {
      const base = measure('strike', up);
      const echoed = measure('echo_blade', up);
      expect(echoed.damage).toBeLessThan(base.damage);
      expect(echoed.after.player.hand).toHaveLength(echoed.before.player.hand.length);
      expect(echoed.cost).toBe(base.cost);
      const twin = measure('twin_blades', up, cs => { cs.player.statuses.strength = 1; });
      const single = measure('strike', up, cs => { cs.player.statuses.strength = 1; });
      expect(twin.damage).toBeGreaterThan(single.damage);
      expect(twin.cost).toBe(single.cost);
      const free = measure('quick_stab', up, cs => { cs.player.energy = 0; });
      expect(free.damage).toBeGreaterThan(0);
      expect(free.cost).toBe(0);
      const cannotPay = battle('strike', up);
      cannotPay.player.energy = 0;
      expect(use(cannotPay, 'strike')).toBe(cannotPay);
    }
  });
});
