import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { ENEMIES } from '../data/enemies';
import { describeCard } from '../engine/cards';
import { canPlayCard, createCombat, endPlayerTurn, enemyAct, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { canUpgrade, newRun, travelTo, finishCombat } from '../engine/run';
import { encounterDifficulty } from '../engine/difficulty';
const card = (defId: string, uid = defId) => ({ defId, uid, upgraded: false });
function battle(id = 'tomb_puppet') {
  const cs = createCombat('variety', [id], ENEMIES[id].tier, [], 100, 100, [], makeRng('STATUS-VARIETY','c'), 100).state;
  cs.player.draw = []; cs.player.hand = []; cs.player.discard = [];
  return cs;
}
describe('状态牌各有处理方式', () => {
  it.each(['scorch','slime','tangle'])('%s 独立为状态牌，不可升级，不进入永久牌组', id => {
    expect(CARDS[id].type).toBe('status'); expect(CARDS[id].rarity).toBe('status');
    expect(canUpgrade(card(id))).toBe(false);
    expect(describeCard(card(id), null)).toContain('仅本场战斗');
    let run = newRun('STATUS-PERMANENT'); run = travelTo(run, run.map.startIds[0]);
    const before = structuredClone(run.deck);
    run.combat!.player.discard.push(card(id)); run.combat!.outcome = 'won';
    expect(finishCombat(run).deck).toEqual(before);
  });
  it.each([0,1,5])('灼伤固定2伤害可格挡，格挡=%s；不套用力量和易伤、不触发卖血收益', block => {
    const cs = battle(); cs.player.hand = [card('scorch')]; cs.player.block = block;
    cs.player.statuses = {strength:20,weak:2,vulnerable:2,bloodRage:4};
    cs.player.turnFlags['retain:scorch'] = 1;
    expect(canPlayCard(cs, card('scorch')).ok).toBe(false);
    const r = endPlayerTurn(cs);
    expect(r.state.player.hp).toBe(100 - Math.max(0,2-block));
    expect(r.state.player.block).toBe(Math.max(0,block-2));
    expect(r.state.player.statuses.strength).toBe(20);
    expect(r.state.player.turnFlags.cardHpLost ?? 0).toBe(0);
    expect(r.state.player.exhaust.map(c=>c.defId)).toEqual(['scorch']);
    expect(r.events.filter(e=>e.type==='damage')).toHaveLength(1);
  });
  it('提前弃灼伤或消耗可避免伤害，致死则停止其余结算', () => {
    const cs = battle(); cs.player.hand = [card('tangle'), card('scorch')];
    const after = playCard(cs, 'tangle', null).state;
    expect(endPlayerTurn(after).state.player.hp).toBe(100);
    cs.player.hp = 1; cs.player.hand = [card('scorch'),card('dazed')];
    const dead = endPlayerTurn(cs).state;
    expect(dead.outcome).toBe('lost'); expect(dead.player.hp).toBe(0);
    expect(dead.player.exhaust).toHaveLength(0);
  });
  it('黏液付1能量清除；不打则正常进弃牌堆，能量不足不能清除', () => {
    const cs = battle(); cs.player.hand = [card('slime')];
    const played = playCard(cs,'slime',null).state;
    expect(played.player.energy).toBe(2); expect(played.player.exhaust).toEqual([card('slime')]);
    expect(played.player.skillsPlayedThisTurn).toBe(0);
    expect(endPlayerTurn(cs).state.player.discard).toEqual([card('slime')]);
    cs.player.energy=0; expect(playCard(cs,'slime',null).state).toBe(cs);
    expect(describeCard(card('slime'),null)).toContain('打出以清除此状态牌');
  });
  it('缠缚0费随机弃其他手牌，回响重复弃牌但实体只消耗一次；空手可解开', () => {
    const cs = battle(); cs.player.hand=[card('tangle'),card('strike'),card('defend')]; cs.player.statuses.echo=1;
    const after=playCard(cs,'tangle',null).state;
    expect(after.player.energy).toBe(3); expect(after.player.exhaust).toEqual([card('tangle')]);
    expect(after.player.discard.map(c=>c.defId).sort()).toEqual(['defend','strike']);
    expect(after.player.hand).toHaveLength(0); expect(after.player.cardsPlayedThisTurn).toBe(2);
    expect(playCard(after,'tangle',null).state).toBe(after);
    cs.player.hand=[card('tangle')]; expect(playCard(cs,'tangle',null).state.player.exhaust).toEqual([card('tangle')]);
  });
  it.each([
    ['rust_snail','acid','discard',['slime']],
    ['cinder_stoker','coal','discard',['scorch']],
    ['wind_scribe','page','draw',['dazed','tangle']],
    ['orrery_keeper','mist','discard',['dazed','slime']],
    ['eclipse_archon','veil','draw',['dazed','scorch']],
    ['last_warden','seal','draw',['dazed','tangle']],
    ['nightless_lord','wall','discard',['dazed','scorch','slime']],
  ] as const)('%s 的%s在普通和困难均塞入预告的牌，保持总张数', (id,move,pile,expected) => {
    for(const hard of [false,true]) {
      const cs = battle(id); cs.enemies[0].moveId=move;
      if(hard) cs.difficulty={...encounterDifficulty(64,ENEMIES[id].tier),complexIntents:true};
      const input=endPlayerTurn(cs).state;
      const result=enemyAct(input,'e0');
      expect(result.state.player[pile].map(c=>c.defId).sort()).toEqual([...expected].sort());
      expect(enemyAct(input,'e0')).toEqual(result);
      expect(enemyAct(result.state,'e0').state).toBe(result.state);
    }
  });
});
