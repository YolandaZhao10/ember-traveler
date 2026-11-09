import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARD_LIST, CARDS } from '../data/cards';
import { CHAPTERS } from '../data/chapters';
import { ENCOUNTERS } from '../data/enemies';
import { CHAPTER_TWO_ENEMIES } from '../data/enemies2';
import { EVENTS } from '../data/events';
import { createCombat, endPlayerTurn, enemyAct, playCard } from '../engine/combat';
import { availableNodes, validateMap } from '../engine/map';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { ChapterId, CharacterId, RunState } from '../engine/types';

const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
function boss(chapter: ChapterId = 1, character: CharacterId = 'traveler') {
  const run = R.newRun('CHAPTERS', character);
  run.chapter = chapter;
  run.currentNodeId = Object.values(run.map.nodes).find(n => n.row === 18)!.id;
  run.deck[0].upgraded = true;
  return R.travelTo(run, run.map.bossId);
}
function win(input: RunState) {
  const run = copy(input);
  run.combat!.outcome = 'won';
  run.combat!.player.hp = 17;
  return R.finishCombat(run);
}
function chooseRelic(run: RunState) { return run.reward?.relicChoices?.length ? R.rewardTakeRelic(run, run.reward.relicChoices[0]) : run; }
function nextChapter() { return R.enterNextChapter(R.rewardLeave(chooseRelic(win(boss())))); }
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
  return values;
}
afterEach(() => vi.unstubAllGlobals());

describe('前三章连续旅程', () => {
  it.each<CharacterId>(['traveler', 'picker', 'oathbound', 'scholar'])('%s 前三章 Boss 都提供三张不同的本角色专属稀有牌、遗物与75金币', character => {
    for (const chapter of [1, 2, 3] as const) {
      const run = win(boss(chapter, character));
      expect(run.screen).toBe('reward');
      expect(run.chapter).toBe(chapter);
      expect(run.floor).toBe(chapter * 20 - 1);
      expect(run.hp).toBe(17);
      expect(run.reward!.cards).toHaveLength(3);
      expect(new Set(run.reward!.cards.map(c => c.defId)).size).toBe(3);
      expect(run.reward!.cards.every(c => CARDS[c.defId].rarity === 'rare' && CARDS[c.defId].owner === character)).toBe(true);
      expect(run.reward!.gold).toBe(75);
      expect(run.reward!.relicChoices).toHaveLength(3);
      expect(R.finishCombat(run)).toBe(run);
    }
  });

  it('领奖后继承牌组升级、遗物、金币和统计，整备只恢复一次生命', () => {
    const reward = win(boss());
    const picked = R.rewardTakeCard(reward, reward.reward!.cards[0].uid);
    const passage = R.rewardLeave(chooseRelic(picked));
    expect(passage.screen).toBe('chapter');
    expect(R.resetCurrentNode(passage)).toEqual(reward);
    const next = R.enterNextChapter(passage);
    expect(next.chapter).toBe(2);
    expect(next.screen).toBe('map');
    expect(next.floor).toBe(20);
    expect(next.hp).toBe(Math.min(passage.maxHp, passage.hp + Math.ceil(passage.maxHp * 0.5)));
    for (const key of ['deck', 'relics', 'gold', 'maxHp', 'stats', 'character', 'uidCounter'] as const) expect(next[key]).toEqual(passage[key]);
    expect(next.currentNodeId).toBeNull();
    expect(next.visited).toEqual([]);
    expect(validateMap(next.map)).toBe(true);
    expect(next.map).not.toEqual(passage.map);
    expect(R.enterNextChapter(next)).toBe(next);
    expect(R.resetCurrentNode(next)).toEqual(next);
    expect(R.enterNextChapter(R.newRun('NO-SKIP'))).toMatchObject({ chapter: 1, floor: 0 });
  });

  it('第二章从第 21 层开始，首战后只能到第 22 层，SL 不跨章', () => {
    const entry = nextChapter();
    const first = R.travelTo(entry, entry.map.startIds[0]);
    expect(first.floor).toBe(20);
    expect(first.chapter).toBe(2);
    expect(first.combat!.encounterId).toMatch(/^deep_/);
    const reward = win(first);
    const map = R.rewardLeave(reward);
    const options = availableNodes(map.map, map.currentNodeId);
    expect(options.every(id => map.map.nodes[id].row === 1)).toBe(true);
    expect(R.travelTo(map, options[0]).floor).toBe(21);
    expect(R.resetCurrentNode(map)).toEqual(reward);
    const invalid = { ...first, checkpoint: { ...first.checkpoint!, chapter: 1 as const } };
    expect(R.resetCurrentNode(invalid)).toBe(invalid);
  });

  it('第二章第40层领取奖励后进入章间整备，SL回到领奖而死亡SL重打', () => {
    const start = boss(2);
    expect(start.floor).toBe(39);
    expect(start.combat!.enemies[0].defId).toBe('everburning_core');
    const won = win(start);
    expect(won.screen).toBe('reward');
    const completed = R.rewardLeave(chooseRelic(won));
    expect(completed.screen).toBe('chapter');
    expect(completed.endMessage).toBeNull();
    expect(R.resetCurrentNode(completed)).toEqual(won);
    const dead = copy(start);
    dead.combat!.outcome = 'lost'; dead.combat!.player.hp = 0;
    const lost = R.finishCombat(dead);
    expect(lost.screen).toBe('gameover');
    expect(R.resetCurrentNode(lost)).toEqual(start);
  });

  it('每层都有对应章节的遭遇池，第二章普通战不会混入第一章敌人', () => {
    for (const chapter of [1, 2, 3] as const) for (let floor = 0; floor < 20; floor++) {
      for (const tier of ['normal', 'elite', 'boss'] as const) {
        const pool = ENCOUNTERS.filter(e => (e.chapter ?? 1) === chapter && e.tier === tier && floor >= (e.minFloor ?? 0) && floor <= (e.maxFloor ?? 19));
        expect(pool.length).toBeGreaterThan(0);
        if (chapter === 2) expect(pool.every(e => e.enemies.every(id => CHAPTER_TWO_ENEMIES.some(enemy => enemy.id === id)))).toBe(true);
      }
    }
  });

  it('第二章事件、商店和营火独立运行，操作后可回退', () => {
    const entry = nextChapter();
    for (const type of ['event', 'shop', 'rest'] as const) {
      const base = copy(entry);
      base.gold = 500;
      base.map.nodes[base.map.startIds[0]].type = type;
      const start = R.travelTo(base, base.map.startIds[0]);
      let changed = start;
      if (type === 'event') {
        expect(EVENTS[start.event!.eventId].chapter).toBe(2);
        changed = R.eventChoose(start, EVENTS[start.event!.eventId].choices[0].id);
      } else if (type === 'shop') changed = R.shopBuyCard(start, 0);
      else changed = R.restUpgrade(start, start.deck.find(c => !c.upgraded)!.uid);
      expect(R.resetCurrentNode(changed)).toEqual(start);
    }
  });

  it('章间与第二章刷新保持进度、回退点和随机地图', () => {
    storage();
    const passage = R.rewardLeave(chooseRelic(win(boss())));
    saveRun(passage);
    expect(loadRun()).toEqual(passage);
    const next = R.enterNextChapter(loadRun()!);
    expect(next).toEqual(R.enterNextChapter(passage));
    saveRun(next);
    expect(loadRun()).toEqual(next);
    const battle = R.travelTo(next, next.map.startIds[0]);
    saveRun(battle);
    expect(R.resetCurrentNode(loadRun()!)).toEqual(battle);
  });

  it.each([4, 5])('v%s 已通关旧存档接入章间奖励，迁移不重复计算统计或丢失卡牌', version => {
    const values = storage();
    const old = { ...win(boss()), screen: 'victory', reward: null, version, chapter: undefined, checkpoint: version === 4 ? undefined : { ...boss().checkpoint, chapter: undefined, version } };
    values.set('ember-traveler:save', JSON.stringify(old));
    const loaded = loadRun()!;
    expect(loaded.screen).toBe('reward');
    expect(loaded.version).toBe(12);
    expect(loaded.chapter).toBe(1);
    expect(loaded.stats).toEqual(old.stats);
    expect(loaded.deck).toEqual(old.deck);
    expect(loadRun()).toEqual(loaded);
    saveRun(loaded);
    expect(loadRun()).toEqual(loaded);
    expect(R.resetCurrentNode(loadRun()!)).toEqual(loaded);
    expect(R.enterNextChapter(R.rewardLeave(chooseRelic(loaded))).chapter).toBe(2);
  });

  it('永燃炉心半血时预告过载并只执行一次，之后进入二阶段循环', () => {
    const strike = { uid: 'test-strike', defId: 'strike', upgraded: false };
    let cs = createCombat('boss-test', ['everburning_core'], 'boss', [strike], 72, 72, [], makeRng('CORE', 'combat'), 10).state;
    cs.enemies[0].hp = 115;
    cs = playCard(cs, strike.uid, 'e0').state;
    expect(cs.enemies[0].phase).toBe(2);
    expect(cs.enemies[0].moveId).toBe('overdrive');
    cs = enemyAct(endPlayerTurn(cs).state, 'e0').state;
    expect(cs.enemies[0].flags.awakened).toBe(1);
    expect(cs.enemies[0].block).toBe(20);
    expect(cs.enemies[0].moveId).not.toBe('overdrive');
  });

  it('新敌人在不同回合选择的招式均有定义', () => {
    for (const enemy of CHAPTER_TWO_ENEMIES) {
      const cs = createCombat('check', [enemy.id], enemy.tier, CARD_LIST.slice(0, 5).map((c, i) => ({ uid: `${i}`, defId: c.id, upgraded: false })), 72, 72, [], makeRng(enemy.id, 'combat'), 10).state;
      for (let turn = 0; turn < 15; turn++) {
        const e = cs.enemies[0];
        e.turn = turn;
        const move = enemy.chooseMove({ enemy: e, allies: cs.enemies, player: cs.player, rng: cs.rng });
        expect(enemy.moves.some(m => m.id === move), enemy.id).toBe(true);
      }
    }
    expect(CHAPTERS[2].startFloor).toBe(20);
  });
});
