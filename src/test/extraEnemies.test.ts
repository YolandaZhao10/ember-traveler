import { describe, expect, it } from 'vitest';
import { ENEMIES, ENCOUNTERS } from '../data/enemies';
import { EXTRA_ENEMIES, EXTRA_ENCOUNTERS } from '../data/extraEnemies';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent, playCard, startPlayerTurn } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { makeRng } from '../engine/rng';
import { extraEnemyBody } from '../ui/sprites/ExtraEnemySprites';
import { intentText } from '../ui/components/Common';
import type { CombatState } from '../engine/types';

const battle = (ids: string[], floor = 0) => createCombat('extra-test', ids, 'normal', [], 3000, 3000, [], makeRng('NEW-MONSTERS', 'c'), 100,
  'traveler', encounterDifficulty(floor, 'normal')).state;
function round(cs: CombatState) {
  cs = endPlayerTurn(cs).state;
  for (const e of cs.enemies) cs = enemyAct(cs, e.id).state;
  return startPlayerTurn(cs).state;
}

describe('前三章新增普通怪的独立行为', () => {
  it('每章三种新怪、五组新遭遇，均有独立形象，终章内容保持不变', () => {
    expect(EXTRA_ENEMIES).toHaveLength(9); expect(EXTRA_ENCOUNTERS).toHaveLength(15);
    for (const chapter of [1, 2, 3]) {
      const encounters = EXTRA_ENCOUNTERS.filter(e => e.chapter === chapter);
      expect(encounters).toHaveLength(5);
      expect(new Set(encounters.flatMap(e => e.enemies).filter(id => EXTRA_ENEMIES.some(e => e.id === id))).size).toBe(3);
      expect(encounters.every(e => e.tier === 'normal')).toBe(true);
    }
    for (const enemy of EXTRA_ENEMIES) expect(extraEnemyBody(enemy.sprite), enemy.id).toBeDefined();
    expect(ENCOUNTERS.filter(e => e.chapter === 4).map(e => e.tier)).toEqual(['elite', 'boss']);
  });

  it.each(EXTRA_ENEMIES.map(e => e.id))('%s：12回合的伤害意图与真实结算一致，刷新不改意图', id => {
    const chapter = EXTRA_ENCOUNTERS.find(e => e.enemies.includes(id))!.chapter!;
    let cs = battle([id], (chapter - 1) * 20 + 6);
    for (let t = 0; t < 12; t++) {
      cs = endPlayerTurn(cs).state;
      const intent = enemyIntent(cs, cs.enemies[0]), hp = cs.player.hp;
      expect(enemyIntent(JSON.parse(JSON.stringify(cs)), cs.enemies[0])).toEqual(intent);
      const next = enemyAct(cs, 'e0');
      const damage = intent?.kind === 'attack' || intent?.kind === 'attack_debuff' ? intent.amount * intent.times : 0;
      expect(hp - next.state.player.hp).toBe(damage);
      expect(enemyAct(next.state, 'e0').events).toEqual([]);
      cs = startPlayerTurn(next.state).state;
    }
  });

  it('弩手架弩后确实暴露一整个玩家回合，决斗者反击只持续到回斩前', () => {
    let crossbow = round(battle(['ash_crossbow']));
    expect(crossbow.enemies[0].statuses.vulnerable).toBe(1); expect(crossbow.enemies[0].moveId).toBe('bolt');
    crossbow = round(crossbow); expect(crossbow.enemies[0].statuses.vulnerable).toBeUndefined();
    let duelist = round(round(battle(['ash_duelist'])));
    expect(duelist.enemies[0].statuses.thorns).toBe(2); expect(duelist.enemies[0].moveId).toBe('riposte');
    duelist = round(duelist); expect(duelist.enemies[0].statuses.thorns).toBeUndefined();
  });

  it('救护按生命比例选择存活目标，不超量治疗或复活死者，日志使用真实治疗量', () => {
    let cs = battle(['grave_lamplighter', 'ash_rat', 'tomb_puppet']);
    cs.enemies[0].moveId = 'mend'; cs.enemies[1].hp = 1; cs.enemies[2].hp = 5;
    cs.phase = 'enemy'; const hp = cs.enemies[1].hp;
    const result = enemyAct(cs, 'e0');
    expect(result.state.enemies[1].hp).toBe(hp + 6); expect(result.state.enemies[2].hp).toBe(5);
    cs = battle(['grave_lamplighter', 'ash_rat']); cs.phase = 'enemy'; cs.enemies[0].moveId = 'mend';
    cs.enemies[1].hp = 0; cs.enemies[1].flags.deadHandled = 1; cs.enemies[0].hp -= 2;
    const healed = enemyAct(cs, 'e0');
    expect(healed.state.enemies[1].hp).toBe(0); expect(healed.state.enemies[0].hp).toBe(cs.enemies[0].maxHp);
    expect(healed.events).toContainEqual({ type: 'heal', targetId: 'e0', amount: 2 });
  });

  it('压力釜和锯轮的爆发力量不会无限累积，压力釜自损不会自杀', () => {
    for (const id of ['pressure_boiler', 'slag_saw']) {
      let cs = battle([id]);
      for (let turn = 0; turn < 12; turn++) {
        cs = round(cs);
        expect(cs.enemies[0].statuses.strength ?? 0).toBeGreaterThanOrEqual(0);
        expect(cs.enemies[0].statuses.strength ?? 0).toBeLessThanOrEqual(2);
      }
    }
    const cs = battle(['pressure_boiler']); cs.enemies[0].hp = 1; cs.enemies[0].moveId = 'vent'; cs.enemies[0].statuses.strength = 2;
    expect(round(cs).enemies[0].hp).toBe(1);
  });

  it('淬火匠有净化冷却，禁页看守整场只塞一张重负', () => {
    let cs = battle(['quench_smith']);
    cs.enemies[0].statuses.burn = 10;
    cs = round(cs); expect(cs.enemies[0].moveId).toBe('quench');
    cs = round(cs); expect(cs.enemies[0].statuses.burn).toBeUndefined();
    cs.enemies[0].statuses.burn = 5;
    cs = round(cs); expect(cs.enemies[0].moveId).not.toBe('quench');
    cs = round(cs); expect(cs.enemies[0].moveId).toBe('quench');
    let archive = battle(['sealed_archivist']);
    for (let i = 0; i < 12; i++) archive = round(archive);
    expect([...archive.player.draw, ...archive.player.hand, ...archive.player.discard].filter(c => c.defId === 'burden')).toHaveLength(1);
  });

  it('穿透意图明确显示，伤害无视格挡但受虚弱修正，仍触发荆棘', () => {
    const cs = battle(['phase_lancer']); cs.phase = 'enemy'; cs.enemies[0].moveId = 'pierce';
    cs.enemies[0].statuses.weak = 1; cs.player.block = 100; cs.player.statuses.thorns = 3;
    const intent = enemyIntent(cs, cs.enemies[0]);
    expect(intent).toEqual({ kind: 'attack', amount: 6, times: 1, piercing: true });
    expect(intentText(intent).text).toBe('穿透 6');
    const result = enemyAct(cs, 'e0');
    expect(cs.player.hp - result.state.player.hp).toBe(6); expect(result.state.player.block).toBe(100);
    expect(cs.enemies[0].hp - result.state.enemies[0].hp).toBe(3);
  });

  it('棋士只在选下一招时读取格挡，玩家出牌后当前意图仍不改变', () => {
    const cs = battle(['orbit_gambler']); cs.phase = 'enemy'; cs.player.block = 12;
    const result = enemyAct(cs, 'e0').state;
    expect(result.enemies[0].moveId).toBe('break');
    const next = startPlayerTurn(result).state;
    next.player.hand = [{ uid: 'guard', defId: 'defend', upgraded: false }];
    const played = playCard(next, 'guard', null).state;
    expect(played.enemies[0].moveId).toBe('break');
    expect(ENEMIES.orbit_gambler.chooseMove({ enemy: { ...played.enemies[0], turn: 2 }, allies: played.enemies, player: { ...played.player, block: 0 }, rng: played.rng })).toBe('triple');
  });
});
