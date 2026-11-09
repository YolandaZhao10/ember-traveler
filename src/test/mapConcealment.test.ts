import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { RunState } from '../engine/types';
import { newRun } from '../engine/run';
const fixture=vi.hoisted(()=>({run:null as RunState|null}));
vi.mock('../ui/store',()=>({useGame:()=>({run:fixture.run}),travel:vi.fn()}));
vi.mock('../ui/art',()=>({useArt:()=>({})}));
import { MapScreen } from '../ui/screens/MapScreen';
it.each([false,true])('地图查看模式=%s：普通战斗节点不泄露人数、敌名，首领仍可预览',preview=>{
 fixture.run=newRun('HIDDEN-ENCOUNTER');
 const html=renderToStaticMarkup(React.createElement(MapScreen,{preview}));
 const labels=[...html.matchAll(/aria-label="(战斗 第 [^"]+)"/g)].map(m=>m[1]);
 expect(labels.length).toBeGreaterThan(10);
 for(const label of labels)expect(label).toMatch(/^战斗 第 \d+ 层(?: · 可前往)? · 查看详情$/);
 // 初始可选节点全部普通战，因此不应有任何人数角标。
 expect(html).not.toMatch(/\d+ 名敌人/);
 expect(html).toMatch(/aria-label="首领 第 20 层 · [^"]+ · 查看详情"/);
 expect(html).toContain('补给');
});
