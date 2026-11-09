import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAPTER_IDS, CHAPTERS, TOTAL_FLOORS } from '../data/chapters';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { CHAPTER_THREE_ENEMIES } from '../data/enemies3';
import { CHAPTER_FOUR_ENEMIES } from '../data/enemies4';
import { CHAPTER_THREE_EVENTS } from '../data/events3';
import { CHAPTER_RELICS } from '../data/chapterRelics';
import { EVENT_LIST } from '../data/events';
import { RELICS } from '../data/relics';
import { EVENT_RELICS } from '../data/specialRelics';
import { createCombat, endPlayerTurn, enemyAct, playCard } from '../engine/combat';
import { generateMap, validateMap, availableNodes } from '../engine/map';
import { makeRng } from '../engine/rng';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import { ensureRecordId, loadHistory } from '../engine/history';
import type { ChapterId, RunState } from '../engine/types';
const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  return values;
}
afterEach(() => vi.unstubAllGlobals());
function boss(chapter: ChapterId) {
  const run = R.newRun('LAST-CHAPTERS'); run.chapter = chapter; run.map = generateMap(run.rng.map, chapter);
  run.currentNodeId = Object.values(run.map.nodes).find(n => n.row === run.map.rows - 2)!.id;
  return R.travelTo(run, run.map.bossId);
}
function win(run: RunState) { const next = copy(run); next.combat!.outcome = 'won'; return R.finishCombat(next); }
function claim(run: RunState) { return R.rewardLeave(R.rewardTakeRelic(R.rewardTakeCard(run, run.reward!.cards[0].uid), run.reward!.relicChoices![0])); }
function event(id: string) {
  const run = R.newRun('PREVIEW'); run.chapter = 3; run.gold = 500; run.hp = 50;
  run.usedEvents = EVENT_LIST.filter(e => e.id !== id).map(e => e.id); run.map.nodes[run.map.startIds[0]].type = 'event';
  return R.travelTo(run, run.map.startIds[0]);
}

describe('第三章与五站终章', () => {
  it('章节连续共65层，第三章20层，终章所有种子都只有指定5节点、不能跳站', () => {
    expect(TOTAL_FLOORS).toBe(65); expect(CHAPTERS[3].startFloor).toBe(40); expect(CHAPTERS[4].startFloor).toBe(60);
    for (let seed = 0; seed < 50; seed++) {
      const rng = makeRng(`FINAL-${seed}`, 'map'); const before = copy(rng); const map = generateMap(rng, 4);
      expect(rng).toEqual(before); expect(map.rows).toBe(5); expect(validateMap(map)).toBe(true);
      const nodes = Object.values(map.nodes).sort((a,b) => a.row-b.row);
      expect(nodes.map(n => n.type)).toEqual(['rest', 'elite', 'shop', 'rest', 'boss']); expect(map.startIds).toEqual([nodes[0].id]);
      nodes.forEach((n,i) => expect(n.next).toEqual(i === 4 ? [] : [nodes[i+1].id]));
      const run = R.newRun('NO-SKIP'); run.chapter = 4; run.map = map;
      expect(R.travelTo(run, map.bossId)).toBe(run);
    }
  });
  it.each([2, 3] as const)('第%s章领奖后继承所有资源，恢复生命一次，刷新与SL不能跨章', chapter => {
    storage(); const reward = win(boss(chapter)); const passage = claim(reward); expect(passage.screen).toBe('chapter');
    saveRun(passage); const next = R.enterNextChapter(loadRun()!);
    expect(next.chapter).toBe(chapter + 1); expect(next.floor).toBe(CHAPTERS[next.chapter].startFloor);
    for (const key of ['deck', 'relics', 'gold', 'maxHp', 'stats', 'difficulty'] as const) expect(next[key]).toEqual(passage[key]);
    expect(next.hp).toBe(Math.min(next.maxHp, passage.hp + Math.ceil(next.maxHp * .5)));
    expect(R.enterNextChapter(next)).toBe(next); expect(R.resetCurrentNode(next)).toEqual(next);
    saveRun(next); expect(loadRun()).toEqual(next); expect(next.map.rows).toBe(CHAPTERS[next.chapter].floors);
  });
  it('第四章从61层逐站走完：两次营火、精英奖、10牌6遗物商店、65层首领直接结算及唯一通关记录', () => {
    storage(); let run = R.enterNextChapter(claim(win(boss(3)))); ensureRecordId(run); run.gold = 1000; run.hp = 10;
    const floors: number[] = []; const screens: string[] = [];
    for (let step = 0; step < 5; step++) {
      expect(run.screen).toBe('map'); const opts = availableNodes(run.map, run.currentNodeId); expect(opts).toHaveLength(1);
      run = R.travelTo(run, opts[0]); floors.push(run.floor + 1); screens.push(run.screen);
      saveRun(run); expect(loadRun()).toEqual(run); const start = run;
      if (step === 0) run = R.restLeave(R.restHeal(run));
      if (step === 1) { const reward = win(run); expect(reward.reward!.relic).toBeTruthy(); expect(reward.reward!.gold).toBeGreaterThanOrEqual(20); run = R.rewardLeave(reward); }
      if (step === 2) { expect(run.shop!.cards).toHaveLength(10); expect(run.shop!.relics).toHaveLength(6); run = R.shopLeave(R.shopBuyCard(run, 0)); }
      if (step === 3) run = R.restLeave(R.restUpgrade(run, run.deck.find(R.canUpgrade)!.uid));
      if (step === 0 || step === 2 || step === 3) expect(R.resetCurrentNode(run)).toEqual(start);
      if (step < 4) { saveRun(run); expect(loadHistory()).toHaveLength(0); }
    }
    expect(floors).toEqual([61,62,63,64,65]); expect(screens).toEqual(['rest','combat','shop','rest','combat']);
    expect(run.combat!.enemies[0].defId).toBe('nightless_lord');
    const before = run; run = win(run); expect(run.screen).toBe('victory');
    expect(run.reward).toBeNull(); expect(run.gold).toBe(before.gold + 75);
    expect(run.deck).toEqual(before.deck); expect(run.relics).toEqual(before.relics);
    expect(R.finishCombat(run)).toBe(run); expect(R.rewardLeave(run)).toBe(run);
    expect(run.endMessage).toContain('65'); expect(R.enterNextChapter(run)).toBe(run);
    saveRun(run); saveRun(loadRun()); expect(loadHistory()).toHaveLength(1); expect(loadHistory()[0].floor).toBe(65);
    expect(R.resetCurrentNode(loadRun()!)).toEqual(run);
  });
  it('v11第二章已通关存档接入第三章，保留战利品和随机流，不重复发奖', () => {
    const values = storage(); const old = claim(win(boss(2))); old.version = 11; old.screen = 'victory'; old.endMessage = '永燃炉心已熄灭'; old.checkpoint!.version = 11;
    values.set('ember-traveler:save', JSON.stringify(old)); const loaded = loadRun()!;
    expect(loaded.screen).toBe('chapter'); expect(loaded.endMessage).toBeNull(); expect(loaded.version).toBe(13);
    for (const key of ['deck','relics','gold','hp','maxHp','stats','rng'] as const) expect(loaded[key]).toEqual(old[key]);
    expect(R.enterNextChapter(loaded).chapter).toBe(3); saveRun(loaded); expect(loadRun()).toEqual(loaded);
    expect(R.resetCurrentNode(loaded).reward!.chapterComplete).toBe(2);
  });
  it('第三章所有层有独立遭遇，终章只用独立精英与首领，每章独有9件奖励', () => {
    const ids = CHAPTER_THREE_ENEMIES.map(e => e.id); expect(ids).toHaveLength(10);
    for (let floor = 0; floor < 20; floor++) for (const tier of ['normal','elite','boss'] as const) {
      const pool = ENCOUNTERS.filter(e => e.chapter === 3 && e.tier === tier && floor >= (e.minFloor ?? 0) && floor <= (e.maxFloor ?? 19));
      expect(pool.length).toBeGreaterThan(0); expect(pool.every(e => e.enemies.every(id => ids.includes(id)))).toBe(true);
    }
    expect(ENCOUNTERS.filter(e => e.chapter === 3).some(e => e.enemies.length === 3)).toBe(true);
    expect(ENCOUNTERS.filter(e => e.chapter === 4).map(e => e.enemies[0])).toEqual(['last_warden','nightless_lord']);
    for (const id of CHAPTER_IDS) expect(CHAPTER_RELICS.filter(r => r.chapter === id)).toHaveLength(9);
    expect(new Set([...Object.values(CHAPTERS).flatMap(c => [c.mapArt,c.battleArt,c.bossArt,c.shopArt,c.restArt])]).size).toBe(20);
  });
  it.each([...CHAPTER_THREE_ENEMIES, ...CHAPTER_FOUR_ENEMIES].map(e => [e.name,e] as const))('%s所有阶段与回合选择均有有效招式', (_name,def) => {
    const cs = createCombat('ai', [def.id], def.tier, [], 100,100,[], makeRng(def.id,'c'),0).state;
    for (const phase of [1,2]) for (const awakened of [0,1]) for (let turn=0;turn<16;turn++) {
      const e = cs.enemies[0]; e.phase=phase; e.turn=turn; e.flags.awakened=awakened; e.flags.p2turn=turn;
      expect(ENEMIES[def.id].moves.some(m => m.id === def.chooseMove({enemy:e,allies:cs.enemies,player:cs.player,rng:cs.rng}))).toBe(true);
    }
  });
  it.each(['eclipse_archon','nightless_lord'])('%s半血预告觉醒，觉醒只执行一次且随后轮转', id => {
    const card = {uid:'strike',defId:'strike',upgraded:false}; let cs=createCombat('phase',[id],'boss',[card],1000,1000,[],makeRng(id,'c'),0).state;
    cs.enemies[0].hp=cs.enemies[0].maxHp/2+1; cs=playCard(cs,card.uid,'e0').state;
    expect(cs.enemies[0].phase).toBe(2); expect(cs.enemies[0].moveId).toBe('awaken');
    cs=enemyAct(endPlayerTurn(cs).state,'e0').state; expect(cs.enemies[0].flags.awakened).toBe(1);
    expect(cs.enemies[0].moveId).not.toBe('awaken'); expect(cs.enemies[0].block).toBe(id==='eclipse_archon'?24:30);
  });
});

describe('问号奖励效果预览与第三章事件', () => {
  it.each(CHAPTER_THREE_EVENTS.map(e => [e.title,e] as const))('%s全部选项可结算，预览不改变结果，刷新和SL保留选择', (_name,def) => {
    storage();
    for(const choice of def.choices) {
      const start=event(def.id); const before=copy(start); R.eventRelicPreviews(start,choice.id); expect(start).toEqual(before);
      expect(R.eventChoiceAvailable(start,choice.id)).toBe(true);
      let result=R.eventChoose(start,choice.id); expect(result).toEqual(R.eventChoose(before,choice.id)); expect(R.eventChoose(result,choice.id)).toBe(result);
      if(result.event?.pendingPick) result=R.eventPickCard(result,result.deck.find(c=>result.event!.pendingPick!=='upgrade'||R.canUpgrade(c))!.uid);
      expect(result.event!.done).toBe(true); saveRun(result); expect(loadRun()).toEqual(result);
      expect(R.resetCurrentNode(R.eventLeave(result))).toEqual(start);
    }
  });
  it('指定遗物显示真实规则，风险标注概率，已拥有与全部集齐显示真实替代奖励', () => {
    const run=event('sky_fallen_observatory'); let p=R.eventRelicPreviews(run,'star')[0];
    expect(p).toEqual({ name:RELICS.vagrant_star.name, description:RELICS.vagrant_star.description, icon:RELICS.vagrant_star.icon, probability:1 });
    run.relics.push('vagrant_star'); p=R.eventRelicPreviews(run,'star')[0]; expect(p.name).toBe('随机问号专属遗物');
    run.relics.push(...EVENT_RELICS.map(r=>r.id)); expect(R.eventRelicPreviews(run,'star')[0].name).toBe('50 金币');
    expect(R.eventRelicPreviews(event('sky_wishing_comet'),'wish')[0].probability).toBe(.6);
    expect(R.eventRelicPreviews(event('sky_meteor_well'),'reach')[0]).toMatchObject({name:'随机遗物',probability:.7});
    expect(R.eventRelicPreviews(run,'leave')).toEqual([]);
    const old=R.newRun('OLD-PREVIEW'); old.event={eventId:'ember_sprite',resolvedText:null,pendingPick:null,done:false};
    expect(R.eventRelicPreviews(old,'absorb')[0]).toMatchObject({name:RELICS.charcoal_heart.name,description:RELICS.charcoal_heart.description,probability:.7});
  });
});
