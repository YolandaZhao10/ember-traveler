import type { ChapterId, RunDifficulty } from '../engine/types';

/** 章节入口的基础强度；章内每深入一层再加 FLOOR_STRENGTH_STEP。 */
export const CHAPTER_ENEMY_STRENGTH: Record<ChapterId, { health: number; attack: number; block: number }> = {
  1: { health: 1, attack: 1, block: 1 },
  2: { health: 1.5, attack: 1.3, block: 1.38 },
  3: { health: 2, attack: 1.6, block: 1.76 },
  4: { health: 2.5, attack: 1.9, block: 2.14 },
};
export const FLOOR_STRENGTH_STEP = { health: .02, attack: .012, block: .015 };

export const STANDARD_DIFFICULTY: RunDifficulty = {
  enemyHealth: 100, enemyIntent: 100, bossHealth: 100, bossIntent: 100, gold: 100, relicRarity: 100, cardRarity: 100,
};
export const DIFFICULTY_PRESETS: { name: string; settings: RunDifficulty }[] = [
  { name: '轻松', settings: { enemyHealth: 75, enemyIntent: 80, bossHealth: 75, bossIntent: 80, gold: 150, relicRarity: 200, cardRarity: 200 } },
  { name: '标准', settings: STANDARD_DIFFICULTY },
  { name: '挑战', settings: { ...STANDARD_DIFFICULTY, enemyHealth: 130, enemyIntent: 125, bossHealth: 130, bossIntent: 125 } },
];
export const DIFFICULTY_FIELDS: { key: keyof RunDifficulty; label: string; help: string }[] = [
  { key: 'enemyHealth', label: '怪物生命', help: '普通怪物与精英的生命，叠加章节与楼层强化。' },
  { key: 'gold', label: '金币掉落', help: '战斗金币奖励，不改变初始金币和事件固定金币。' },
  { key: 'relicRarity', label: '遗物稀有度倾向', help: '越高越容易获得稀有遗物；百分比表示倾向强度，并非掉落概率。' },
  { key: 'cardRarity', label: '卡牌稀有度倾向', help: '越高越容易获得稀有卡；首领和指定稀有度奖励不变。' },
  { key: 'enemyIntent', label: '怪物攻击意图', help: '普通怪物与精英的伤害和格挡；125%以上启用部分敌人的复合招式，出招顺序不变。' },
  { key: 'bossIntent', label: 'Boss 攻击意图', help: '首领的伤害和格挡；125%以上启用部分首领的复合招式，阶段与出招顺序不变。' },
  { key: 'bossHealth', label: 'Boss 生命', help: '独立调整首领生命，叠加章节与楼层强化。' },
];

/** 旧三档精确迁移到等效百分比，数值只接受有限的 50–200 整数。 */
export function difficultyPercent(key: keyof RunDifficulty, value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(50, Math.min(200, Math.round(value)));
  if (value === 'normal') return 100;
  const range = key === 'gold' ? [75, 150] : key.endsWith('Health') ? [75, 130] : key.endsWith('Intent') ? [80, 125] : [50, 200];
  return value === 'low' ? range[0] : value === 'high' ? range[1] : 100;
}
export function normalizeDifficulty(input?: Partial<RunDifficulty> | null): RunDifficulty {
  return Object.fromEntries(DIFFICULTY_FIELDS.map(({ key }) => [key, difficultyPercent(key, input?.[key])])) as unknown as RunDifficulty;
}
export function difficultyName(settings: RunDifficulty): string {
  return DIFFICULTY_PRESETS.find(p => DIFFICULTY_FIELDS.every(f => p.settings[f.key] === difficultyPercent(f.key, settings[f.key])))?.name ?? '自定义';
}
