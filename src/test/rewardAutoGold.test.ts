import { afterEach, describe, expect, it, vi } from 'vitest';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
afterEach(()=>vi.unstubAllGlobals());
function victory(tier:'normal'|'elite'|'boss') {
  let run=R.newRun('AUTO-GOLD');run=R.travelTo(run,run.map.startIds[0]);
  run.combat!.tier=tier;run.combat!.outcome='won';return R.finishCombat(run);
}
describe('战后金币自动拾取',()=>{
  it.each(['normal','elite','boss'] as const)('%s 遗漏金币在离开时领取一次，刷新和SL不会累计',tier=>{
    let run=victory(tier); const start=run.gold,amount=run.reward!.gold,deck=run.deck;
    if(run.reward!.relicChoices?.length)run=R.rewardTakeRelic(run,run.reward!.relicChoices[0]);
    const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)});
    saveRun(run);run=loadRun()!;
    const left=R.rewardLeave(run);expect(left.gold).toBe(start+amount);expect(left.deck).toEqual(deck);
    expect(R.rewardLeave(left)).toBe(left);expect(R.rewardTakeGold(left)).toBe(left);
    saveRun(left);const restored=loadRun()!;expect(restored.gold).toBe(start+amount);
    let reset=R.resetCurrentNode(restored);expect(reset.gold).toBe(start);expect(reset.screen).toBe('reward');
    if(reset.reward!.relicChoices?.length)reset=R.rewardTakeRelic(reset,reset.reward!.relicChoices[0]);
    expect(R.rewardLeave(reset).gold).toBe(start+amount);
    expect(R.rewardLeave(R.rewardTakeGold(run)).gold).toBe(start+amount);
  });
  it('首领遗物未选定时不能提前离开或自动领取金币',()=>{
    const run=victory('boss');expect(R.rewardLeave(run)).toBe(run);expect(run.reward!.goldTaken).toBe(false);
  });
});
