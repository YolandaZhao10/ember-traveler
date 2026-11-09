import type { ChapterId } from '../engine/types';

export const FLOORS_PER_CHAPTER = 20;
export const CHAPTER_IDS: readonly ChapterId[] = [1, 2, 3, 4];
export const FINAL_CHAPTER: ChapterId = 4;
export const TOTAL_FLOORS = FLOORS_PER_CHAPTER * 3 + 5;

export function nextChapter(chapter: ChapterId): ChapterId | null {
  return CHAPTER_IDS[CHAPTER_IDS.indexOf(chapter) + 1] ?? null;
}

interface ChapterDefinition {
  name: string;
  label: string;
  startFloor: number;
  floors: number;
  mapArt: string;
  battleArt: string;
  bossArt: string;
  eventArt: string;
  shopArt: string;
  restArt: string;
  gateArt: string;
  description: string;
  arrival: string;
  inhabitants: string;
}

export const CHAPTERS: Record<ChapterId, ChapterDefinition> = {
  1: {
    name: '灰烬古城', label: '第一章', startFloor: 0, floors: FLOORS_PER_CHAPTER,
    mapArt: 'bg_map', battleArt: 'bg_battle', bossArt: 'bg_boss',
    eventArt: 'bg_event', shopArt: 'bg_shop', restArt: 'bg_rest', gateArt: 'bg_title',
    description: '穿过荒废的街巷，寻找古城深处的火种。',
    arrival: '灰烬深处，火种未熄。', inhabitants: '灰烬之王 · 钟楼之心',
  },
  2: {
    name: '熔炉深城', label: '第二章', startFloor: FLOORS_PER_CHAPTER, floors: FLOORS_PER_CHAPTER,
    mapArt: 'bg_deep_map', battleArt: 'bg_deep_battle', bossArt: 'bg_deep_boss',
    eventArt: 'bg_deep_event', shopArt: 'bg_deep_shop', restArt: 'bg_deep_rest', gateArt: 'bg_deep_gate',
    description: '王座下的升降梯通往一座仍在运转的铸造城。锁链拖着空甲穿过炉道，深处的永燃炉心正在吞噬整座古城的余火。',
    arrival: '火种之下，还有一座城。', inhabitants: '铁甲守卫 · 炉渣虫群 · 永燃炉心',
  },
  3: {
    name: '星骸天穹', label: '第三章', startFloor: FLOORS_PER_CHAPTER * 2, floors: FLOORS_PER_CHAPTER,
    mapArt: 'bg_sky_map', battleArt: 'bg_sky_battle', bossArt: 'bg_sky_boss',
    eventArt: 'bg_sky_event', shopArt: 'bg_sky_shop', restArt: 'bg_sky_rest', gateArt: 'bg_sky_gate',
    description: '炉心熄灭后，封闭的通天升梯重新升起。崩碎的观星圣殿漂浮在云海之上，坠星司辰仍在拨动最后的星轨。带着余火走过断桥，让漫长的日蚀迎来黎明。',
    arrival: '熄灭炉火，点亮群星。', inhabitants: '星轨卫士 · 月蚀剑侍 · 坠星司辰',
  },
  4: {
    name: '余火终庭', label: '终章', startFloor: FLOORS_PER_CHAPTER * 3, floors: 5,
    mapArt: 'bg_final_map', battleArt: 'bg_final_battle', bossArt: 'bg_final_boss',
    eventArt: 'bg_final_gate', shopArt: 'bg_final_shop', restArt: 'bg_final_rest', gateArt: 'bg_final_gate',
    description: '星轨尽头只剩一条通往黎明的路。先在营火旁整备，穿过终庭执卫的封锁，在最后的商店补给，再点亮王庭门前的火堆。无昼之主守着最后一枚火种。',
    arrival: '最后的余火，最后的一程。', inhabitants: '营火 → 精英 → 商店 → 营火 → 无昼之主',
  },
};

export const CHAPTER_RECOVERY = 0.5;
