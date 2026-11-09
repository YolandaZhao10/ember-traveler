import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { describeCard, viewCard } from '../engine/cards';
import { canPlayCard, createCombat, discardReplayChoices, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import type { CardInstance } from '../engine/types';
import { planMove } from './cardFloorBenchmark';

const card = (defId: string, upgraded = false, uid = defId): CardInstance => ({ defId, upgraded, uid });
function fixture(upgraded = false) {
  const cs = createCombat('replay-test', ['tomb_puppet', 'tomb_puppet'], 'normal', [], 20, 80, [], makeRng('replay', 'test'), 100, 'oathbound').state;
  cs.player.hand = [card('oath_reenactment', upgraded)];
  cs.player.discard = [card('strike'), card('defend')];
  cs.player.draw = Array.from({ length: 10 }, (_, i) => card('defend', false, `draw-${i}`));
  cs.enemies.forEach(e => { e.hp = e.maxHp = 1000; e.statuses = {}; });
  return cs;
}
const replay = (cs: ReturnType<typeof fixture>, uid = 'strike', target: string | null = 'e1') => playCard(cs, 'oath_reenactment', target, uid);
const piles = (cs: ReturnType<typeof fixture>) => [cs.player.hand, cs.player.draw, cs.player.discard, cs.player.exhaust].flat();

describe.each([false, true])('回血牌与血誓重演（升级=%s）', up => {
  it.each(['vein_cutter', 'scarlet_harvest'])('%s 回复生命后消耗，回响也只消耗一张实体牌', id => {
    const cs = fixture(up); cs.player.hand = [card(id, up)]; cs.player.statuses.echo = 1;
    expect(viewCard(cs.player.hand[0]).exhaust).toBe(true);
    expect(describeCard(cs.player.hand[0], null)).toContain('消耗');
    const after = playCard(cs, id, id === 'vein_cutter' ? 'e0' : null).state;
    expect(after.player.hp).toBeGreaterThan(cs.player.hp);
    expect(after.player.exhaust.map(c => c.defId)).toEqual([id]);
    expect(after.player.discard.some(c => c.defId === id)).toBe(false);
    expect(after.player.attacksPlayedThisTurn).toBe(2);
  });
  it('免目标牌能量，准确攻击选定敌人，来源消耗且原牌仍在弃牌堆', () => {
    const cs = fixture(up); cs.player.discard = [card('titan_blows')];
    cs.player.energy = up ? 1 : 2;
    const saved = JSON.stringify(cs), result = replay(cs, 'titan_blows');
    expect(JSON.stringify(cs)).toBe(saved);
    expect(result.state.player.energy).toBe(0);
    expect(result.state.enemies[0].hp).toBe(1000);
    expect(result.state.enemies[1].hp).toBeLessThan(1000);
    expect(result.state.player.discard).toEqual(cs.player.discard);
    expect(result.state.player.exhaust.map(c => c.defId)).toEqual(['oath_reenactment']);
    expect(result.state.player.cardsPlayedThisTurn).toBe(2);
    expect(result.state.player.skillsPlayedThisTurn).toBe(1);
    expect(result.state.player.attacksPlayedThisTurn).toBe(1);
    expect(result.events.filter(e => e.type === 'cardPlayed').map(e => e.name)).toEqual(['血誓重演' + (up ? '+' : ''), '巨人连击']);
  });
  it('技能不要求敌人，所有实体牌 UID 不增不减', () => {
    const cs = fixture(up), before = piles(cs).map(c => c.uid).sort();
    const after = replay(cs, 'defend', null).state;
    expect(after.player.block).toBe(5);
    expect(after.player.skillsPlayedThisTurn).toBe(2);
    expect(piles(after).map(c => c.uid).sort()).toEqual(before);
  });
});

describe('弃牌重放的事务与联动', () => {
  it('没有合法弃牌时禁用；不接受手牌、消耗区、能力、诅咒或重放牌', () => {
    const cs = fixture();
    cs.player.discard = [card('oath_reenactment', false, 'other-replay'), card('ashes'), card('inflame')];
    expect(discardReplayChoices(cs)).toEqual([]);
    expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(false);
    for (const uid of ['other-replay', 'ashes', 'inflame', 'oath_reenactment', 'missing']) expect(replay(cs, uid).state).toBe(cs);
  });
  it('未选择、目标死亡、能量不足及伪造的选择都不扣资源或推进随机状态', () => {
    const cs = fixture();
    expect(playCard(cs, 'oath_reenactment', 'e0').state).toBe(cs);
    expect(replay(cs, 'strike', null).state).toBe(cs);
    cs.enemies[1].hp = 0;
    expect(replay(cs).state).toBe(cs);
    cs.player.energy = 1;
    expect(replay(cs, 'strike', 'e0').state).toBe(cs);
    cs.player.energy = 3; cs.player.exhaust = [card('titan_blows')];
    expect(replay(cs, 'titan_blows', 'e0').state).toBe(cs);
  });
  it('失血与余烬费用照常支付，不能无视余烬门槛', () => {
    const cs = fixture(); cs.player.discard = [card('blood_edge')];
    expect(replay(cs, 'blood_edge').state.player.hp).toBe(cs.player.hp - 2);
    const emberCard = Object.values(CARDS).find(c => c.requireEmber && c.type === 'attack')!;
    cs.player.discard = [card(emberCard.id)]; cs.player.ember = 0;
    expect(replay(cs, emberCard.id).state).toBe(cs);
    cs.player.ember = emberCard.requireEmber!;
    const after = replay(cs, emberCard.id).state;
    expect(after.player.ember).toBe(0);
    expect(after.enemies[1].hp).toBeLessThan(1000);
  });
  it('来源和重放均触发余音与第三张牌遗物，技能也正常激怒敌人', () => {
    const cs = fixture(); cs.player.cardsPlayedThisTurn = 1;
    cs.relics = ['duelist_clasp'];
    cs.player.statuses.tempo = 1;
    cs.player.powerInstances = [{ status: 'tempo', amount: 1, progress: 1 }];
    cs.enemies[0].statuses.enrage = 2;
    const after = replay(cs, 'defend', null).state;
    expect(after.player.cardsPlayedThisTurn).toBe(3);
    expect(after.player.ember).toBe(2);
    expect(after.player.hand).toHaveLength(1);
    expect(after.player.powerInstances![0].progress).toBe(0);
    expect(after.enemies[0].statuses.strength).toBe(4);
  });
  it('回响重放来源两次，每次使用同一选择，总计四次出牌、只付一次费', () => {
    const cs = fixture(); cs.player.statuses.echo = 1;
    const after = replay(cs).state;
    expect(after.player.cardsPlayedThisTurn).toBe(4);
    expect(after.player.attacksPlayedThisTurn).toBe(2);
    expect(after.enemies[1].hp).toBe(988);
    expect(after.player.energy).toBe(1);
    expect(after.player.statuses.echo ?? 0).toBe(0);
    expect(after.player.exhaust).toHaveLength(1);
    expect(after.player.discard.filter(c => c.uid === 'strike')).toHaveLength(1);
  });
  it('重放获得的新回响不递归复制自己，留给下一张手动出牌', () => {
    const cs = fixture(); cs.player.discard = [card('echo_card')];
    const after = replay(cs, 'echo_card', null).state;
    expect(after.player.cardsPlayedThisTurn).toBe(2);
    expect(after.player.statuses.echo).toBe(1);
  });
  it('抽牌洗回所选牌时不生成第二张实体卡，来源回响仍锁定同一效果', () => {
    const cs = fixture(); cs.player.discard = [card('blood_rite')]; cs.player.draw = []; cs.player.statuses.echo = 1;
    const after = replay(cs, 'blood_rite', null).state;
    expect(after.player.cardsPlayedThisTurn).toBe(4);
    expect(after.player.hp).toBe(cs.player.hp - 6);
    expect(piles(after).filter(c => c.uid === 'blood_rite')).toHaveLength(1);
  });
  it('目标死后不将回响转移给其他敌人', () => {
    const cs = fixture(); cs.player.statuses.echo = 1; cs.enemies[1].hp = 6;
    const after = replay(cs).state;
    expect(after.enemies[0].hp).toBe(1000);
    expect(after.enemies[1].hp).toBe(0);
    expect(after.player.attacksPlayedThisTurn).toBe(1);
  });
  it('回响的第二次重放仍检查余烬费用，不能透支', () => {
    const cs = fixture();
    const paid = Object.values(CARDS).find(c => c.requireEmber && c.type === 'attack')!;
    cs.player.discard = [card(paid.id)]; cs.player.ember = paid.requireEmber!; cs.player.statuses.echo = 1;
    const after = replay(cs, paid.id).state;
    expect(after.player.ember).toBe(0);
    expect(after.player.attacksPlayedThisTurn).toBe(1);
    expect(after.player.cardsPlayedThisTurn).toBe(3);
  });
  it('快速SL恢复来源与弃牌选择，重做不会增加实体牌', () => {
    let run = R.newRun('replay-reset', 'oathbound'); run.screen = 'combat'; run.combat = fixture();
    const { checkpoint: _checkpoint, ...snapshot } = run;
    run.checkpoint = JSON.parse(JSON.stringify(snapshot));
    const before = JSON.stringify(run.combat);
    run = R.combatPlayCard(run, 'oath_reenactment', 'e1', 'strike').run;
    run = R.resetCurrentNode(JSON.parse(JSON.stringify(run)));
    expect(JSON.stringify(run.combat)).toBe(before);
    const after = R.combatPlayCard(run, 'oath_reenactment', null, 'defend').run;
    expect(after.combat!.player.block).toBe(5);
    expect(after.stats.cardsPlayed).toBe(2);
  });
  it('局内出牌统计包含重放，序列化恢复结果相同', () => {
    const run = R.newRun('replay-stats', 'oathbound'); run.screen = 'combat'; run.combat = fixture();
    const result = R.combatPlayCard(run, 'oath_reenactment', 'e1', 'strike');
    expect(result.run.stats.cardsPlayed).toBe(2);
    expect(R.combatPlayCard(JSON.parse(JSON.stringify(run)), 'oath_reenactment', 'e1', 'strike').run).toEqual(result.run);
  });
  it('平衡机器人能主动选择弃牌中的高费攻击，实际执行而非跳过新牌', () => {
    const cs = fixture(true); cs.player.discard = [card('defend'), card('titan_blows')]; cs.player.energy = 1;
    const move = planMove(cs, { depth: 2, width: 3, engines: false });
    expect(move?.uid).toBe('oath_reenactment');
    expect(move?.replayUid).toBe('titan_blows');
    expect(playCard(cs, move!.uid, move!.target, move!.replayUid).state).not.toBe(cs);
  });
});
