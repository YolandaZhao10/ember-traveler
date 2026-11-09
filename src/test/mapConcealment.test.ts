import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { RunState } from '../engine/types';
import { newRun } from '../engine/run';
import { plannedEncounter } from '../engine/encounters';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
const fixture=vi.hoisted(()=>({run:null as RunState|null}));
vi.mock('../ui/store',()=>({useGame:()=>({run:fixture.run}),travel:vi.fn()}));
vi.mock('../ui/art',()=>({useArt:()=>({})}));
import { MapScreen, RoutePanel } from '../ui/screens/MapScreen';
it.each([false,true])('地图查看模式=%s：普通、精英节点不泄露人数和敌名，首领仍可预览',preview=>{
 fixture.run=newRun('HIDDEN-ENCOUNTER');
 // 让精英成为可选节点，覆盖角标；无论已访问或未来节点都不得透露阵容。
 const elite=Object.values(fixture.run.map.nodes).find(n=>n.type==='elite')!;
 fixture.run.map.startIds=[elite.id];
 const html=renderToStaticMarkup(React.createElement(MapScreen,{preview}));
 for(const kind of ['战斗','精英']) {
  const labels=[...html.matchAll(new RegExp(`aria-label="(${kind} 第 [^"]+)"`,'g'))].map(m=>m[1]);
  expect(labels.length).toBeGreaterThan(0);
  for(const label of labels)expect(label).toMatch(new RegExp(`^${kind} 第 \\d+ 层(?: · 可前往)? · 查看详情$`));
 }
 expect(html).not.toMatch(/\d+ 名敌人/);
 expect(html).toMatch(/aria-label="首领 第 20 层 · [^"]+ · 查看详情"/);
});
it.each(ENCOUNTERS.filter(e=>(e.chapter??1)===1 && (e.tier==='elite'||e.tier==='normal')).map(e=>e.id))('%s：选择节点后的详情也不泄露阵容，并保留收获和路线取舍',encounterId=>{
 const encounter=ENCOUNTERS.find(e=>e.id===encounterId)!;
 const run=newRun('HIDDEN-PANEL');
 const selected=Object.values(run.map.nodes).find(n=>n.row===(encounter.minFloor??0))!;
 selected.type=encounter.tier==='elite'?'elite':'combat'; selected.encounterId=encounterId;
 expect(plannedEncounter(run,selected)).toBeDefined();
 for(const preview of [false,true]) {
  const html=renderToStaticMarkup(React.createElement(RoutePanel,{run,selected,preview,canEnter:true,reachable:true,onSelect:()=>{}}));
  expect(html).not.toMatch(/敌方阵容|名敌人|遭遇敌人/);
  for(const id of encounter.enemies)expect(html).not.toContain(ENEMIES[id].name);
  expect(html).toContain('收获'); expect(html).toContain('沿此分支');
 }
});
it('首领选中详情继续显示敌方资料',()=>{
 const run=newRun('HIDDEN-BOSS'),selected=run.map.nodes[run.map.bossId];
 const html=renderToStaticMarkup(React.createElement(RoutePanel,{run,selected,preview:false,canEnter:false,reachable:true,onSelect:()=>{}}));
 expect(html).toContain('敌方阵容');
 for(const id of plannedEncounter(run,selected)!.enemies)expect(html).toContain(ENEMIES[id].name);
});
