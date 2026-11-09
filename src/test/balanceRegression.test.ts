import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARDS } from '../data/cards';
import { describeCard } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { probePair, resourcePairs } from './balanceProbe';

const card = (defId: string, upgraded = false) => ({ uid: defId, defId, upgraded });
function battle(id: string, upgraded = false) {
  const cs = createCombat('balance', ['tomb_puppet'], 'normal', [], 30, 100, [], makeRng('balance', 'c'), 100).state;
  cs.enemies[0].hp = cs.enemies[0].maxHp = 1000;
  cs.player.hand = [card(id, upgraded)];
  return cs;
}

describe('平衡边界回归', () => {
  it('全部非能力牌的双副本不能在无遗物/能力时无限自循环', () => {
    const loops: string[] = [];
    for (const def of CARD_LIST.filter(c => !['curse', 'power'].includes(c.type))) for (const up of [false, true]) {
      if (probePair(card(def.id, up), card(def.id, up)).actions === 80) loops.push(`${def.name}${up ? '+' : ''}`);
    }
    expect(loops).toEqual([]);
  });
  it('同角色可获得的低费过牌/回收/吸血组合不能两张无限循环，含两种起手顺序', () => {
    const loops: string[] = [];
    for (const [a, b] of resourcePairs()) if (probePair(a, b).actions === 80) loops.push(`${a.defId}${a.upgraded}+${b.defId}${b.upgraded}`);
    expect(loops).toEqual([]);
  });
  it('本牌新获得的回响留给下一张，已有回响仍能重复咏唱且只扣一次', () => {
    let cs = playCard(battle('double_chant'), 'double_chant', null).state;
    expect(cs.player.statuses.echo).toBe(2);
    cs.player.hand = [card('strike')];
    cs = playCard(cs, 'strike', 'e0').state;
    expect(cs.enemies[0].hp).toBe(988); expect(cs.player.statuses.echo).toBe(1);
    const existing = battle('double_chant'); existing.player.statuses.echo = 1;
    expect(playCard(existing, 'double_chant', null).state.player.statuses.echo).toBe(4);
  });
  it('新增续航能力在叠加压力下也不能让低费双牌形成无限循环', () => {
    const loops: string[] = [];
    for (const [a, b] of resourcePairs()) {
      // 跨流派能力一并开启，作为强于实际可获得组合的上界压力。
      if (probePair(a, b, 80, { comboFlow: 2, ashInsight: 2, bloodDraw: 3, chargeMaster: 2 }).actions === 80)
        loops.push(`${a.defId}${a.upgraded}+${b.defId}${b.upgraded}`);
    }
    expect(loops).toEqual([]);
  });
  it.each([false, true])('烬舌仅在目标事先燃烧时获得余烬，打完消耗（升级=%s）', up => {
    const plain = playCard(battle('ember_tongue', up), 'ember_tongue', 'e0').state;
    expect(plain.player.ember).toBe(0); expect(plain.enemies[0].statuses.burn).toBe(up ? 2 : 1);
    expect(describeCard(card('ember_tongue', up), null)).toContain('若目标正在燃烧：获得 1 点余烬；对目标施加');
    const burning = battle('ember_tongue', up); burning.enemies[0].statuses.burn = 1;
    const result = playCard(burning, 'ember_tongue', 'e0').state;
    expect(result.player.ember).toBe(1); expect(result.player.exhaust.map(c => c.defId)).toContain('ember_tongue');
  });
  it.each([false, true])('吸血受实际扣血、回复上限和玩家存活约束（升级=%s）', up => {
    const cs = battle('leech_bite', up); cs.player.statuses.strength = 30;
    const cap = up ? 8 : 6;
    expect(playCard(cs, 'leech_bite', 'e0').state.player.hp).toBe(30 + cap);
    expect(describeCard(card('leech_bite', up), null)).toContain(`最多 ${cap} 点`);
    cs.enemies[0].block = 100;
    expect(playCard(cs, 'leech_bite', 'e0').state.player.hp).toBe(30);
    cs.enemies[0].block = 0; cs.enemies[0].hp = 2;
    expect(playCard(cs, 'leech_bite', 'e0').state.player.hp).toBe(32);
    cs.player.hp = 1; cs.enemies[0].statuses.thorns = 1;
    const dead = playCard(cs, 'leech_bite', 'e0').state;
    expect(dead.player.hp).toBe(0); expect(dead.outcome).toBe('lost');
  });
  it.each([false, true])('同费余烬爆发的单体伤害高于终夜焚天，群攻保留虚弱特色（升级=%s）', up => {
    const single = battle('ember_burst', up), aoe = battle('final_conflagration', up);
    single.player.ember = aoe.player.ember = 10;
    const a = playCard(single, 'ember_burst', 'e0').state, b = playCard(aoe, 'final_conflagration', null).state;
    expect(a.enemies[0].hp).toBeLessThan(b.enemies[0].hp);
    expect(a.player.ember).toBe(0); expect(b.player.ember).toBe(0);
    expect(b.enemies[0].statuses.weak).toBe(up ? 2 : 1);
    expect(CARDS.ember_burst.cost).toBe(CARDS.final_conflagration.cost);
  });
  it('执事长持续半血时不会每隔一回合治疗', () => {
    let cs = createCombat('deacon', ['ash_deacon'], 'normal', [], 1000, 1000, [], makeRng('deacon', 'c'), 0).state;
    for (let turn = 0; turn < 12; turn++) {
      cs.enemies[0].hp = 10;
      cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
      cs = startPlayerTurn(cs).state;
    }
    const heals = cs.enemies[0].moveHistory.map((m, i) => m === 'mend' ? i : -1).filter(i => i >= 0);
    expect(heals.length).toBeGreaterThan(1);
    expect(heals.slice(1).every((t, i) => t - heals[i] >= 3)).toBe(true);
  });
  it('熔渣巨像每轮两次攻击，一次整备；熔接的攻击意图与伤害一致', () => {
    let cs = createCombat('colossus', ['slag_colossus'], 'elite', [], 1000, 1000, [], makeRng('colossus', 'c'), 0).state;
    let attacks = 0;
    for (let turn = 0; turn < 3; turn++) {
      const intent = enemyIntent(cs, cs.enemies[0]); const hp = cs.player.hp;
      cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
      if (intent?.kind === 'attack') { expect(hp - cs.player.hp).toBe(intent.amount * intent.times); attacks++; }
      cs = startPlayerTurn(cs).state;
    }
    expect(attacks).toBe(2);
  });
});
