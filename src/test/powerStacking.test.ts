import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCombat, playCard, endPlayerTurn, startPlayerTurn } from '../engine/combat';
import { describeCard } from '../engine/cards';
import { makeRng } from '../engine/rng';
import { loadRun, saveRun } from '../engine/save';
import * as R from '../engine/run';
import type { CardInstance, CombatState } from '../engine/types';
let serial = 0;
const card = (defId: string, upgraded = false): CardInstance => ({ defId, upgraded, uid: `power-${++serial}` });
function setup() {
  const cs = createCombat('POWER', ['tomb_puppet'], 'normal', [], 100, 100, [], makeRng('POWER', 'combat'), 0).state;
  cs.player.energy = 100; cs.enemies[0].hp = cs.enemies[0].maxHp = 10000;
  cs.player.draw = Array.from({ length: 60 }, () => card('defend')); return cs;
}
function play(cs: CombatState, defId: string, upgraded = false) {
  const c = card(defId, upgraded); cs.player.hand.push(c); return playCard(cs, c.uid, 'e0');
}
afterEach(() => vi.unstubAllGlobals());

describe('能力牌独立叠加', () => {
  it('两张普通余音错开计数，每累计3张各抽1张且可在同一回合反复触发', () => {
    let cs = play(setup(), 'tempo').state;
    expect(cs.player.powerInstances).toEqual([{ status: 'tempo', amount: 1, progress: 0 }]);
    cs = play(cs, 'defend').state;
    cs = play(cs, 'tempo').state;
    expect(cs.player.powerInstances?.map(p => p.progress)).toEqual([2, 0]);
    let step = play(cs, 'defend'); expect(step.events.filter(e => e.type === 'draw')).toEqual([{ type: 'draw', count: 1 }]); cs = step.state;
    expect(cs.player.powerInstances?.map(p => p.progress)).toEqual([0, 1]);
    cs = play(cs, 'defend').state; step = play(cs, 'defend');
    expect(step.events.filter(e => e.type === 'draw')).toEqual([{ type: 'draw', count: 1 }]); cs = step.state;
    step = play(cs, 'defend'); expect(step.events.filter(e => e.type === 'draw')).toEqual([{ type: 'draw', count: 1 }]);
    expect(step.state.player.energy).toBe(93); // 7张1费牌，没有旧版余音的隐含能量。
  });
  it('普通/升级余音分别抽1/2张，回响重放额外计牌，跨回合保留进度', () => {
    let cs = play(play(setup(), 'tempo').state, 'tempo', true).state;
    cs.player.statuses.echo = 1; cs = play(cs, 'defend').state;
    expect(cs.player.powerInstances?.map(p => p.progress)).toEqual([0, 2]);
    cs = startPlayerTurn(endPlayerTurn(cs).state).state;
    expect(cs.player.powerInstances?.map(p => p.progress)).toEqual([0, 2]); cs.player.energy = 100; cs.player.hand = [];
    let step = play(cs, 'defend'); expect(step.events.filter(e => e.type === 'draw')).toEqual([{ type: 'draw', count: 2 }]);
    step = play(step.state, 'defend'); expect(step.events.filter(e => e.type === 'draw')).toHaveLength(0);
    step = play(step.state, 'defend'); expect(step.events.filter(e => e.type === 'draw')).toEqual([{ type: 'draw', count: 1 }]);
    expect(describeCard(card('tempo'), null)).toContain('抽 1 张牌'); expect(describeCard(card('tempo', true), null)).toContain('抽 2 张牌');
  });
  it('两张镜像和回响分别重放，之后本回合不再重复，新打出的镜像仍可触发', () => {
    let cs = play(play(setup(), 'mirror').state, 'mirror').state; cs.player.statuses.echo = 1;
    let step = play(cs, 'strike'); expect(step.state.enemies[0].hp).toBe(9976); expect(step.state.player.attacksPlayedThisTurn).toBe(4);
    expect(step.events.filter(e => e.type === 'damage' && e.source === 'player')).toHaveLength(4);
    step = play(step.state, 'strike'); expect(step.state.enemies[0].hp).toBe(9970);
    cs = play(step.state, 'mirror').state; step = play(cs, 'strike'); expect(step.state.enemies[0].hp).toBe(9958);
    cs = startPlayerTurn(endPlayerTurn(step.state).state).state; cs.player.energy = 100;
    step = play(cs, 'strike'); expect(step.events.filter(e => e.type === 'damage' && e.source === 'player')).toHaveLength(4);
  });
  it('焰柱按每张余烬加成分别结算，数值型能力正常累加，格挡保留等规则不重复改变', () => {
    let cs = play(play(setup(), 'pillar_of_flame').state, 'pillar_of_flame', true).state;
    cs.player.ember = 4; cs = startPlayerTurn(endPlayerTurn(cs).state).state;
    expect(cs.enemies[0].hp).toBe(9990); // 普通4 + 升级6
    expect(describeCard(card('pillar_of_flame'), null)).not.toContain('+1');
    cs = setup(); cs = play(play(cs, 'iron_will').state, 'iron_will').state;
    const amount = cs.player.statuses.metallicize!; expect(amount).toBeGreaterThan(3);
    cs.player.block = 0; expect(endPlayerTurn(cs).state.player.block).toBe(amount);
  });
  it('每张能力和计数保存到战斗，刷新保持进度，SL撤回本节点获得的能力', () => {
    const values = new Map<string,string>(); vi.stubGlobal('localStorage', { getItem:(k:string)=>values.get(k)??null, setItem:(k:string,v:string)=>values.set(k,v), removeItem:(k:string)=>values.delete(k) });
    let run = R.newRun('POWER-SAVE'); run = R.travelTo(run,run.map.startIds[0]); run.combat = play(play(setup(),'tempo').state,'tempo',true).state;
    saveRun(run); expect(loadRun()).toEqual(run); expect(loadRun()!.combat!.player.powerInstances?.map(p=>p.progress)).toEqual([1,0]);
    expect(R.resetCurrentNode(loadRun()!).combat!.player.powerInstances).toEqual([]);
    const legacy = JSON.parse(JSON.stringify(run)); legacy.version=10; delete legacy.combat.player.powerInstances;
    values.set('ember-traveler:save',JSON.stringify(legacy)); const restored=loadRun()!;
    expect(restored.version).toBe(R.SAVE_VERSION); expect(restored.combat!.player.powerInstances).toEqual([{ status:'tempo',amount:3,progress:0 }]);
  });
  it.each([false,true])('终夜焚天升级=%s：消耗全部余烬群攻并虚弱，不再提供格挡', upgraded => {
    let cs=setup(); cs.enemies.push({...cs.enemies[0],id:'e1',statuses:{},flags:{}}); cs.player.ember=5;
    const step=play(cs,'final_conflagration',upgraded); cs=step.state;
    expect(cs.player.energy).toBe(98); expect(cs.player.ember).toBe(0); expect(cs.player.block).toBe(0);
    for (const enemy of cs.enemies) { expect(enemy.hp).toBe(10000-5*(upgraded?5:4)); expect(enemy.statuses.weak).toBe(upgraded?2:1); }
    const description=describeCard(card('final_conflagration',upgraded),null);
    expect(description).toContain(`每点余烬 ${upgraded?5:4}`); expect(description).toContain(`${upgraded?2:1} 层虚弱`); expect(description).not.toContain('格挡');
    cs=setup(); cs.player.ember=0; cs=play(cs,'final_conflagration',upgraded).state;
    expect(cs.enemies[0].hp).toBe(10000); expect(cs.enemies[0].statuses.weak).toBe(upgraded?2:1);
  });

});
