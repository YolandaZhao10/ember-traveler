/**
 * 带种子的随机数生成器（mulberry32），状态可序列化。
 * 每个用途（地图 / 奖励 / 战斗 / 事件 / 商店）使用独立的流，便于复现。
 */
export interface RngState {
  s: number;
}

export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function makeRng(seed: string, stream: string): RngState {
  return { s: hashSeed(`${seed}::${stream}`) || 0x9e3779b9 };
}

/** 返回 [0,1) 的浮点数，并推进状态（原地修改）。 */
export function nextFloat(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 返回 [min,max] 的整数。 */
export function nextInt(r: RngState, min: number, max: number): number {
  if (max < min) [min, max] = [max, min];
  return min + Math.floor(nextFloat(r) * (max - min + 1));
}

export function chance(r: RngState, p: number): boolean {
  return nextFloat(r) < p;
}

export function pick<T>(r: RngState, arr: readonly T[]): T {
  return arr[Math.floor(nextFloat(r) * arr.length)];
}

export function shuffle<T>(r: RngState, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(r) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedPick<T>(r: RngState, items: readonly { item: T; weight: number }[]): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let roll = nextFloat(r) * total;
  for (const it of items) {
    roll -= it.weight;
    if (roll < 0) return it.item;
  }
  return items[items.length - 1].item;
}

export function randomSeedString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
