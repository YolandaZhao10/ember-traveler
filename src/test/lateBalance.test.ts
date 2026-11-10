import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { describeCard, viewCard } from '../engine/cards';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent, enemyIntentExtras, playCard, startPlayerTurn } from '../engine/combat';
import { CHARGE_MAX } from '../engine/constants';
import { encounterDifficulty } from '../engine/difficulty';
import { makeRng } from '../engine/rng';
import { convertResource } from '../engine/resourceConversion';
import { newRun, travelTo, resetCurrentNode } from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { CardInstance } from '../engine/types';

const card = (defId: string, uid = defId, bonus = 0): CardInstance => ({ defId, uid, bonus, upgraded: false });
const battle = (ids: string[] = []) => {
  const cs = createCombat('late-balance', ['nightless_lord'], 'boss', [], 9999, 9999, [], makeRng('LATE-BALANCE','c'), 0, 'traveler', encounterDifficulty(64,'boss',DIFFICULTY_PRESETS[2].settings)).state;
  cs.player.hand = ids.map((id,i) => card(id,`hand-${i}`)); return cs;
};
afterEach(() => vi.unstubAllGlobals());

describe('终局公平性与成长边界', () => {
  it('困难首领仍有1586生命与每回合25%承伤上限，63伤开场只使用一次，壁垒持续强化', () => {
    let cs = battle(); expect(cs.enemies[0].maxHp).toBe(1586); expect(cs.enemies[0].damageGuard?.limit).toBe(397);
    expect(enemyIntent(cs,cs.enemies[0])).toMatchObject({amount:63,times:1});
    for(let i=0;i<8;i++) { cs=endPlayerTurn(cs).state; cs=enemyAct(cs,'e0').state; cs=startPlayerTurn(cs).state; }
    expect(cs.enemies[0].moveHistory.filter(m=>m==='opening')).toHaveLength(1);
    expect(cs.enemies[0].statuses.strength).toBe(6);
  });
  it.each([0,1,24,25])('最终首领觉醒保留燃烧的一半并向上取整：%s层；其他减益清除', burn => {
    let cs = battle(); cs.enemies[0].hp=600; cs.enemies[0].statuses={burn,weak:3,vulnerable:3,frail:3}; cs.player.statuses.everburn=1;
    cs=endPlayerTurn(cs).state;
    expect(enemyIntentExtras(cs,cs.enemies[0])).toContain('清除其他负面，燃烧减半');
    cs=enemyAct(cs,'e0').state;
    expect(cs.enemies[0].statuses.burn ?? 0).toBe(Math.ceil(burn/2));
    expect(cs.enemies[0].statuses.weak ?? 0).toBe(0); expect(cs.enemies[0].statuses.vulnerable ?? 0).toBe(0); expect(cs.enemies[0].statuses.frail ?? 0).toBe(0);
    expect(cs.enemies[0].flags.awakened).toBe(1);
  });
  it('第三次攻击续势才起甲，回响计两次，第四至第六次不再次领取', () => {
    let cs=battle(['war_drum',...Array(5).fill('quick_stab')]);
    cs=playCard(cs,'hand-0',null).state;
    cs=playCard(cs,'hand-1','e0').state; expect(cs.player.block).toBe(0);
    cs.player.statuses.echo=1; cs=playCard(cs,'hand-2','e0').state;
    expect(cs.player.attacksPlayedThisTurn).toBe(3); expect(cs.player.block).toBe(8);
    for(const uid of ['hand-3','hand-4','hand-5']) cs=playCard(cs,uid,'e0').state;
    expect(cs.player.block).toBe(8);
  });
  it('蓄力上限同时约束保留、立即充能与卡面；回响不能绕过', () => {
    let cs=battle(['focus','charged_blade']); cs.player.hand[1].bonus=9; cs.player.statuses.echo=1;
    cs=playCard(cs,'hand-0',null).state; expect(cs.player.hand[0].bonus).toBe(CHARGE_MAX);
    cs.relics.push('star_chart'); cs.player.statuses.chargeMaster=3;
    cs=endPlayerTurn(cs).state; expect(cs.player.hand[0].bonus).toBe(CHARGE_MAX);
    const old=card('rune_shield','old',999); expect(viewCard(old).bonus).toBe(CHARGE_MAX);
    expect(describeCard(old,null)).toContain('获得 35 点格挡'); expect(describeCard(old,null)).toContain('最多蓄力 10 层');
    const actual=battle(); actual.player.hand=[old]; expect(playCard(actual,'old',null).state.player.block).toBe(35);
  });
  it('释放旧存档的超额蓄力按有效上限扣除，不能留下一大笔隐藏资源', () => {
    const cs=battle(); cs.player.hand=[card('charged_blade','old',999)];
    const effect={kind:'convertResource',resource:'charge',per:2,max:3,reward:'energy'} as const;
    expect(convertResource(cs.player,null,effect)).toBe(3); expect(cs.player.hand[0].bonus).toBe(4);
    expect(convertResource(cs.player,null,effect)).toBe(2); expect(convertResource(cs.player,null,effect)).toBe(0);
  });
  it('读档和SL快照均归一化各牌堆蓄力，不改变牌序、实体和随机流', () => {
    const values=new Map<string,string>(); vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
    const base=newRun('CHARGE-SAVE','scholar'), run=travelTo(base,base.map.startIds[0]);
    for(const s of [run,run.checkpoint!]) for(const pile of ['hand','draw','discard','exhaust'] as const) s.combat!.player[pile]=[card('rune_shield',pile,100)];
    saveRun(run);const restored=loadRun()!;
    for(const s of [restored,restored.checkpoint!]) {
      expect(s.combat!.rng).toEqual(run.combat!.rng);
      for(const pile of ['hand','draw','discard','exhaust'] as const) expect(s.combat!.player[pile]).toEqual([card('rune_shield',pile,10)]);
    }
    expect(resetCurrentNode(restored).combat!.player.hand[0].bonus).toBe(10);
    saveRun(restored);expect(loadRun()).toEqual(restored);
  });
});
