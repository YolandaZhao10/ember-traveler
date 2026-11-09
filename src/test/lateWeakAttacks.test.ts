import { expect, it } from 'vitest';
import { createCombat, endPlayerTurn, enemyAct, enemyIntent } from '../engine/combat';
import { encounterDifficulty } from '../engine/difficulty';
import { makeRng } from '../engine/rng';
import { ENEMIES } from '../data/enemies';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
const moves=[['glass_wisp','assemble'],['wind_scribe','chorus'],['comet_hound','howl'],['moon_duelist','step'],['nightless_lord','awaken']] as const;
it.each(moves)('%s/%s强化轻击在三种难度及增减益下均预告真实伤害', (id,move)=>{
 for(const {settings} of DIFFICULTY_PRESETS){
  const def=ENEMIES[id],floor=id==='nightless_lord'?64:49;
  let cs=createCombat('light',[id],def.tier,[],10000,10000,[],makeRng('weakattack','c'),100,'traveler',encounterDifficulty(floor,def.tier,settings)).state;
  if(id==='nightless_lord'){cs.enemies[0].phase=2;cs.enemies[0].hp=Math.floor(cs.enemies[0].maxHp/2);}
  cs.enemies[0].moveId=move;cs.enemies[0].statuses.strength=3;cs.enemies[0].statuses.weak=2;cs.player.statuses.vulnerable=2;
  cs=endPlayerTurn(cs).state;
  const intent=enemyIntent(cs,cs.enemies[0]);expect(intent?.kind).toBe('attack_debuff');
  if (!intent || !('amount' in intent)) throw new Error('缺少攻击意图');
  const hp=cs.player.hp;cs=enemyAct(cs,'e0').state;
  expect(hp-cs.player.hp).toBe(intent.amount);expect(cs.player.hp).toBeLessThan(hp);
 }
});
