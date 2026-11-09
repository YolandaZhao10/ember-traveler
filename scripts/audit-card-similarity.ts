import { readFileSync, writeFileSync } from 'node:fs';
import { CARD_LIST, CARDS } from '../src/data/cards';
import { describeCard, viewDef } from '../src/engine/cards';
import { cardDesign, cardMechanics, effectDesign } from '../src/test/cardDesign';
import type { CardDef } from '../src/engine/types';
const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
if (arg('--cards')) for (const c of JSON.parse(readFileSync(arg('--cards')!, 'utf8')) as CardDef[]) CARDS[c.id] = c;
const variants = CARD_LIST.flatMap(c => (c.type === 'curse' ? [false] : [false,true]).map(upgraded => ({id:c.id,upgraded})));
function collisions(signature: (id: string, up: boolean) => string, rewardsOnly = false) {
 const seen = new Map<string, typeof variants>(), pairs = new Map<string, string>();
 for (const v of variants) {
  const c = CARDS[v.id]; if (rewardsOnly && ['starter','curse'].includes(c.rarity)) continue;
  const key = signature(v.id,v.upgraded), group = seen.get(key) ?? [];
  for (const other of group) if (other.id !== v.id) {
   const ids = [v.id,other.id].sort();
   pairs.set(ids.join('/'),ids.map(id=>`${CARDS[id].name} (${id})`).join(' / '));
  }
  group.push(v);seen.set(key,group);
 }
 return [...pairs].sort(([a],[b])=>a.localeCompare(b)).map(([ids,names])=>({ids,names}));
}
const report = {
 cards: CARD_LIST.length, variants: variants.length,
 exactMechanics: collisions(cardMechanics),
 rewardEffectIdentity: collisions((id,up)=>{const v=viewDef(id,up);return effectDesign(v.effects,'exact')+effectDesign(v.handEndEffects,'exact');},true),
 globalRewardDesign: collisions(cardDesign,true),
 ledger: CARD_LIST.map(c=>({id:c.id,name:c.name,owner:c.owner??'shared',rarity:c.rarity,
  base:describeCard({uid:'a',defId:c.id,upgraded:false},null),
  upgrade:c.type==='curse'?null:describeCard({uid:'a',defId:c.id,upgraded:true},null)})),
 note:'所有基础/升级交叉比较。近似设计忽略数字、费用、段数、单群体、保留/消耗及角色；保留实际条件、成长资源与效果顺序。自动检查无法代替对“附送小效果”的人工定位审查。',
};
if(arg('--output'))writeFileSync(arg('--output')!,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,ledger:undefined},null,2));
if(report.exactMechanics.length||report.rewardEffectIdentity.length||report.globalRewardDesign.length)process.exitCode=1;
