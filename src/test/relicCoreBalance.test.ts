import { describe, expect, it } from 'vitest';
import { RELICS } from '../data/relics';
import { describeCard } from '../engine/cards';
import { createCombat, endPlayerTurn, playCard, startPlayerTurn } from '../engine/combat';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';

const card = (defId: string, uid = defId) => ({ defId, uid, upgraded: false });
function battle(relics: string[], hand: string[] = []) {
  const cs = createCombat('relic-balance', ['tomb_puppet', 'ash_rat'], 'normal', [], 30, 100, relics, makeRng('RELIC-CORE', 'c'), 100).state;
  cs.player.hand = hand.map((id, i) => card(id, `${id}-${i}`));
  cs.player.draw = Array.from({ length: 40 }, (_, i) => card('strike', `draw-${i}`));
  cs.enemies.forEach(e => { e.hp = e.maxHp = 10000; e.block = 0; e.statuses = {}; });
  return cs;
}
const next = (cs: ReturnType<typeof battle>) => startPlayerTurn(endPlayerTurn(cs).state).state;

describe('核心遗物适度削弱与机制差异', () => {
  it('燧石第一攻击的额外收益不超过半张打击，下一张攻击不再加成，预览与结算一致', () => {
    let cs = battle(['flint'], ['strike', 'strike']);
    const preview = describeCard(cs.player.hand[0], { player: cs.player, target: cs.enemies[0], relics: cs.relics, isFirstAttack: true, crescendoBonus: 0 });
    const hp = cs.enemies[0].hp;
    cs = playCard(cs, 'strike-0', 'e0').state;
    const first = hp - cs.enemies[0].hp;
    expect(first).toBeGreaterThan(6); expect(first).toBeLessThanOrEqual(9);
    expect(preview).toContain(`造成 ${first} 点伤害`);
    cs = playCard(cs, 'strike-1', 'e0').state;
    expect(hp - cs.enemies[0].hp).toBe(first + 6);
    expect(RELICS.flint.description).toContain(`+${first - 6}`);
  });

  it('余火香炉只补空余烬开场，零余烬爆发最多按两点结算且预览一致', () => {
    let cs = battle(['ember_censer'], ['ember_burst']);
    expect(cs.player.ember).toBe(3);
    const withStarter = battle(['ember_lantern', 'ember_censer']);
    expect(withStarter.player.ember).toBe(2);
    cs.player.ember = 0;
    const preview = describeCard(cs.player.hand[0], { player: cs.player, target: cs.enemies[0], relics: cs.relics, isFirstAttack: true, crescendoBonus: 0 });
    const hp = cs.enemies[0].hp;
    cs = playCard(cs, 'ember_burst-0', 'e0').state;
    expect(hp - cs.enemies[0].hp).toBe(12); // 2 余烬 × 6，原保底3余烬会造成18。
    expect(preview).toContain('12'); expect(cs.player.ember).toBe(0);
  });

  it('旅人水壶每胜回复不超过一张基础防御，结算重入和奖励SL不重复治疗', () => {
    let run = R.newRun('CANTEEN'); run.relics = ['canteen']; run.hp = 20;
    run = R.travelTo(run, run.map.startIds[0]); run.combat!.outcome = 'won';
    const result = R.finishCombat(run);
    expect(result.hp - run.hp).toBeGreaterThan(0); expect(result.hp - run.hp).toBeLessThanOrEqual(5);
    expect(R.finishCombat(result)).toBe(result);
    expect(R.resetCurrentNode(R.rewardTakeGold(result)).hp).toBe(result.hp);
  });

  it('余灰灵种每回合最多回复1生命，第二次消耗及重复结束不会刷治疗', () => {
    let cs = battle(['phoenix_ash'], ['pick_up', 'pick_up']);
    cs = playCard(cs, 'pick_up-0', null).state; expect(cs.player.hp).toBe(31);
    cs = playCard(cs, 'pick_up-1', null).state; expect(cs.player.hp).toBe(31);
    cs = next(cs); cs.player.hand.push(card('pick_up', 'again'));
    cs = playCard(cs, 'again', null).state; expect(cs.player.hp).toBe(32);
  });

  it('透镜只在偶数回合兑现保留收益，没有保留牌也不能获得额外能量', () => {
    let cs = battle(['lens'], ['rune_shield']);
    expect(cs.player.energy).toBe(3);
    for (const expected of [4, 3, 4]) { cs = next(cs); expect(cs.player.energy).toBe(expected); }
    cs.player.hand = []; cs = next(cs); cs = next(cs); expect(cs.player.energy).toBe(3);
  });

  it('旧书需要打出能力牌；与开场回响石用途不同，每回合仅触发一次且不重放能力本身', () => {
    let cs = battle(['old_tome'], ['war_drum', 'war_drum']); cs.player.energy = 10;
    expect(cs.player.statuses.echo ?? 0).toBe(0);
    expect(battle(['echo_stone']).player.statuses.echo).toBe(1);
    cs = playCard(cs, 'war_drum-0', null).state;
    expect(cs.player.statuses.echo).toBe(1); expect(cs.player.statuses.crescendo).toBe(1);
    cs = playCard(cs, 'war_drum-1', null).state;
    expect(cs.player.statuses.echo).toBe(1); expect(cs.player.statuses.crescendo).toBe(2);
    cs = next(cs); cs.player.hand = [card('war_drum', 'again')];
    cs = playCard(cs, 'again', null).state;
    expect(cs.player.statuses.echo).toBe(2);
  });
});
