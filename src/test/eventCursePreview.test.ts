import { afterEach, describe, expect, it } from 'vitest';
import { CARD_LIST } from '../data/cards';
import { EVENT_LIST, EVENTS } from '../data/events';
import { describeCard } from '../engine/cards';
import { eventCursePreviews, newRun } from '../engine/run';
import type { EventOutcome } from '../engine/types';
const fixtureId = 'curse-preview-fixture';
afterEach(()=>{delete EVENTS[fixtureId];});
function preview(outcomes: EventOutcome[]) {
  EVENTS[fixtureId] = {id:fixtureId,title:'预览测试',text:'',icon:'?',choices:[{id:'risk',label:'风险',detail:'',outcomes}]};
  const run = newRun('CURSE-PREVIEW');
  run.event = {eventId:fixtureId,done:false,resolvedText:null,pendingPick:null};
  const before = JSON.stringify(run);
  const result = eventCursePreviews(run,'risk');
  expect(JSON.stringify(run)).toBe(before);
  return result;
}
describe('问号事件诅咒说明',()=>{
  it.each(CARD_LIST.filter(c=>c.type==='curse'))('$name 使用实际卡牌说明，无法打出、保留和回合末惩罚均显示',c=>{
    const rows = preview([{kind:'curse',cardId:c.id}]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({cardId:c.id,name:c.name,probability:1});
    expect(rows[0].description).toContain(describeCard({uid:'c',defId:c.id,upgraded:false},null));
    if(c.id==='doubt')expect(rows[0].description).toContain('减少 25%');
    if(c.id==='exposure')expect(rows[0].description).toContain('增加 50%');
  });
  it('递归展示风险分支概率，不提前掷骰，不显示不可能发生的分支',()=>{
    const result = preview([{kind:'chance',p:.5,successText:'',failText:'',success:[{kind:'chance',p:.4,successText:'',failText:'',success:[{kind:'curse',cardId:'regret'}],fail:[]}],fail:[{kind:'curse',cardId:'doubt'}]},
      {kind:'chance',p:0,successText:'',failText:'',success:[{kind:'curse',cardId:'burden'}],fail:[]}]);
    expect(result.map(r=>[r.cardId,r.probability])).toEqual([['regret',.2],['doubt',.5]]);
  });
  it('所有现有事件的直接诅咒都能在点选前预览，离开和其他选择不混入风险',()=>{
    let found=0;
    for(const event of EVENT_LIST)for(const choice of event.choices){
      const run=newRun('EVENT-PREVIEW');run.event={eventId:event.id,done:false,resolvedText:null,pendingPick:null};
      const expected=choice.outcomes.filter(o=>o.kind==='curse');
      const before=JSON.stringify(run);const result=eventCursePreviews(run,choice.id);
      expect(result.map(r=>r.cardId)).toEqual(expected.map(o=>o.cardId));
      expect(JSON.stringify(run)).toBe(before); found+=result.length;
    }
    expect(found).toBeGreaterThan(10);
    expect(eventCursePreviews(newRun('NO-EVENT'),'missing')).toEqual([]);
  });
});
