import { describe, expect, it } from 'vitest';
import { canPlayCard, createCombat, playCard } from '../engine/combat';
import { cardTransferChoices } from '../engine/cardTransfer';
import { makeRng } from '../engine/rng';
const card = (defId: string, upgraded = false, uid = defId) => ({ defId, uid, upgraded });
function battle(id: string, up: boolean) {
  const cs = createCombat('new-echo', ['tomb_puppet'], 'normal', [], 52, 52, [], makeRng('NEW-ECHO', 'c'), 100, 'scholar').state;
  cs.player.hand = [card(id, up), card('strike')];
  cs.enemies[0].hp = cs.enemies[0].maxHp = 1000; cs.enemies[0].statuses = {};
  cs.player.draw = [card('defend', false, 'old-top')];
  cs.player.discard = [card('echo_blade', false, 'chosen'), card('mirror'), card('doubt')];
  return cs;
}
describe.each([false, true])('学者新增回响牌，升级=%s', up => {
  it('引声刺先攻击后准备回响，新获得的回响不复制自己；下一张牌复制且只付一次费', () => {
    let cs = battle('echo_primer', up);
    cs = playCard(cs, 'echo_primer', 'e0').state;
    expect(cs.enemies[0].hp).toBe(1000 - (up ? 9 : 6));
    expect(cs.player.statuses.echo).toBe(1); expect(cs.player.cardsPlayedThisTurn).toBe(1);
    expect(cs.player.exhaust.map(c => c.uid)).toEqual(['echo_primer']);
    const hp = cs.enemies[0].hp; cs = playCard(cs, 'strike', 'e0').state;
    expect(hp - cs.enemies[0].hp).toBe(12); expect(cs.player.energy).toBe(1);
    expect(cs.player.statuses.echo ?? 0).toBe(0); expect(cs.player.cardsPlayedThisTurn).toBe(3);
  });
  it('已有回响时引声刺只重放一次，保存新回响并只消耗一个实体', () => {
    const cs = battle('echo_primer', up); cs.player.statuses.echo = 1;
    const after = playCard(cs, 'echo_primer', 'e0').state;
    expect(after.enemies[0].hp).toBe(1000 - (up ? 18 : 12));
    expect(after.player.statuses.echo).toBe(2); expect(after.player.cardsPlayedThisTurn).toBe(2);
    expect(after.player.energy).toBe(2); expect(after.player.exhaust).toHaveLength(1);
  });
  it('回声归页只选弃牌攻击或技能，取消/失效选择不扣费，回响仅置顶同一实体一次', () => {
    const cs = battle('echo_recall', up); cs.player.statuses.echo = 1;
    expect(cardTransferChoices(cs, cs.player.hand[0]).map(c => c.uid)).toEqual(['chosen']);
    for (const choice of [undefined, 'mirror', 'doubt', 'missing']) expect(playCard(cs, 'echo_recall', null, choice).state).toBe(cs);
    const after = playCard(cs, 'echo_recall', null, 'chosen').state;
    expect(after.player.draw.map(c => c.uid)).toEqual(['old-top', 'chosen']);
    expect(after.player.discard.map(c => c.uid)).toEqual(['mirror', 'doubt']);
    expect(after.player.statuses.echo).toBe(up ? 4 : 2);
    expect(after.player.energy).toBe(2); expect(after.player.cardsPlayedThisTurn).toBe(2);
    expect(after.player.exhaust.map(c => c.uid)).toEqual(['echo_recall']);
    const piles = [after.player.hand, after.player.draw, after.player.discard, after.player.exhaust].flat();
    expect(piles.filter(c => c.uid === 'chosen')).toHaveLength(1);
    cs.player.discard = []; expect(canPlayCard(cs, cs.player.hand[0]).ok).toBe(false);
  });
});
