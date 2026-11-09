import { CHARACTERS } from '../src/data/characters';
import type { CharacterId } from '../src/engine/types';
import { incomingDamage, cardValue } from '../src/test/balanceBot';
import { CARD_LIST } from '../src/data/cards';
import { ENCOUNTERS, ENEMIES } from '../src/data/enemies';
import { CHAPTERS } from '../src/data/chapters';
import { viewCard } from '../src/engine/cards';
import { aliveEnemies, canPlayCard, playCard, createCombat, endPlayerTurn, enemyAct, startPlayerTurn } from '../src/engine/combat';
import { encounterDifficulty } from '../src/engine/difficulty';
import { makeRng } from '../src/engine/rng';

import { probePair, resourcePairs } from '../src/test/balanceProbe';

const loops = [];
for (const def of CARD_LIST.filter(c => c.type !== 'curse' && c.type !== 'power')) for (const upgraded of [false, true]) {
  const card = { uid: '', defId: def.id, upgraded };
  if (probePair(card, card).actions === 80) loops.push(viewCard(card).name);
}
const pairs = resourcePairs();
const pairLoops = pairs.filter(([a, b]) => probePair(a, b).actions === 80).map(([a, b]) => [viewCard(a).name, viewCard(b).name]);

// 标准难度、合法楼层、10 固定种子，观察 9 回合的原始压力；不攻击/不防御。
// 不等同于胜率：集火、格挡、反伤、回复、清除减益与构筑都未参与。
const encounters = ENCOUNTERS.flatMap(enc => (enc.tier === 'boss' ? [1, 2] : [1]).map(phase => {
  const chapter = enc.chapter ?? 1;
  const local = chapter === 4 ? (enc.tier === 'boss' ? 4 : 1) : enc.tier === 'boss' ? 19 : Math.min(enc.maxFloor ?? 12, Math.max(enc.minFloor ?? 0, 12));
  const floor = CHAPTERS[chapter].startFloor + local;
  let totalDamage = 0, peak = 0, totalHp = 0, curses = 0;
  for (let seed = 0; seed < 10; seed++) {
    let cs = createCombat(enc.id, enc.enemies, enc.tier, [], 10000, 10000, [], makeRng(`PRESSURE-${seed}`, 'c'), 100, 'traveler', encounterDifficulty(floor, enc.tier)).state;
    if (phase === 2) cs.enemies.forEach(e => { e.hp = Math.floor(e.maxHp / 2); });
    totalHp += cs.enemies.reduce((sum, e) => sum + e.hp, 0);
    for (let turn = 0; turn < 9; turn++) {
      const hp = cs.player.hp;
      cs = endPlayerTurn(cs).state;
      for (const id of cs.enemies.map(e => e.id)) cs = enemyAct(cs, id).state;
      peak = Math.max(peak, hp - cs.player.hp);
      cs = startPlayerTurn(cs).state;
    }
    totalDamage += 10000 - cs.player.hp;
    curses += [...cs.player.hand, ...cs.player.draw, ...cs.player.discard, ...cs.player.exhaust].length;
  }
  return { id: enc.id, chapter, floor: floor + 1, tier: enc.tier, enemies: enc.enemies.map(id => ENEMIES[id].name).join('+'), phase, startingHp: totalHp / 10, damage9Turns: totalDamage / 10, peak, curses: curses / 10 };
})).sort((a, b) => a.chapter - b.chapter || a.tier.localeCompare(b.tier) || b.damage9Turns - a.damage9Turns);
// 第一章固定 12 张牌、2 张升级打击、初始遗物；每场满血，四角色各 10 种子。
// 仅对照普通遭遇与精英的损血，不代表随机选牌的整局胜率。
const added = { traveler:['cross_guard','iron_will','thorn_mail','shield_bash'], picker:['lingering_fire','scorch_mark','ash_feast','bone_ash'], oathbound:['inflame','leech_bite','crimson_step','bone_crusher'], scholar:['rune_shield','echo_blade','mirror','erudition'] };
const calibration=[];
for(const enc of ENCOUNTERS.filter(e=>!e.chapter && e.tier!=='boss')) {
 let wins=0,loss=0,turns=0;
 for(const character of Object.keys(added) as CharacterId[]) for(let i=0;i<10;i++) {
  const ch=CHARACTERS[character];
  const deck=[...ch.starterDeck.slice(2),...added[character]].map((defId,j)=>({defId,uid:'c'+j,upgraded:j<2}));
  const floor=Math.min(enc.maxFloor??11,11);
  let cs=createCombat(enc.id,enc.enemies,enc.tier,deck,ch.maxHp,ch.maxHp,[ch.starterRelic],makeRng('FIXED-'+i,'c'),100,character,encounterDifficulty(floor,enc.tier)).state;
  let actions=0;
  while(cs.outcome==='ongoing'&&cs.turn<30&&actions++<300){
    const opts=cs.player.hand.filter(c=>canPlayCard(cs,c).ok).map(c=>({c,s:cardValue(cs,c,incomingDamage(cs)-cs.player.block)})).sort((a,b)=>b.s-a.s);
    if(opts[0]?.s>0.5){cs=playCard(cs,opts[0].c.uid,aliveEnemies(cs).sort((a,b)=>a.hp-b.hp)[0].id).state;continue;}
    cs=endPlayerTurn(cs).state;for(const e of cs.enemies)cs=enemyAct(cs,e.id).state;
    if(cs.outcome==='ongoing')cs=startPlayerTurn(cs).state;
  }
  wins+=Number(cs.outcome==='won');loss+=ch.maxHp-cs.player.hp;turns+=cs.turn;
 }
 calibration.push({id:enc.id,tier:enc.tier,wins,loss:loss/40,turns:turns/40});
}

console.log(JSON.stringify({ note: '双副本循环筛查与无防御压力诊断，不能代替真实对局胜率。', cards: CARD_LIST.length, monsters: Object.keys(ENEMIES).length, loops, pairsChecked: pairs.length, pairLoops, encounters, calibration }, null, 2));
