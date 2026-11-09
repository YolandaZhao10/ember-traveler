import type { CombatDifficulty, CombatState, DifficultyLevel, RunDifficulty } from './types';
import { difficultyPercent, STANDARD_DIFFICULTY } from '../data/difficulty';

/** 楼层从 0 开始。强化在遭遇创建时固定，刷新与 SL 不会重复叠乘。 */
export function encounterDifficulty(floor: number, tier: CombatState['tier'], settings: RunDifficulty = STANDARD_DIFFICULTY): CombatDifficulty {
  const depth = Math.max(0, Math.floor(floor));
  const elite = tier === 'elite';
  const boss = tier === 'boss';
  const health = difficultyPercent(boss ? 'bossHealth' : 'enemyHealth', boss ? settings.bossHealth : settings.enemyHealth) / 100;
  const intent = difficultyPercent(boss ? 'bossIntent' : 'enemyIntent', boss ? settings.bossIntent : settings.enemyIntent) / 100;
  return {
    floor: depth + 1,
    healthMultiplier: (1 + depth * 0.02) * (elite ? 1.18 : boss ? 1.10 : 1) * health,
    attackMultiplier: (1 + depth * 0.012) * (elite ? 1.15 : boss ? 1.08 : 1) * intent,
    blockMultiplier: (1 + depth * 0.015) * (elite ? 1.15 : boss ? 1.10 : 1) * intent,
  };
}

export function rarityBias(rarity: 'common' | 'uncommon' | 'rare' | 'starter', level: DifficultyLevel = 'normal'): number {
  if (rarity === 'starter') return 0;
  const value = difficultyPercent('cardRarity', level);
  if (rarity === 'uncommon') return 1;
  // 100% 为标准倾向；两侧连续插值，归一化后形成真实掉落概率。
  if (value <= 100) return rarity === 'common' ? 2 - value / 100 : value / 100;
  return rarity === 'common' ? 1 - (value - 100) / 200 : 1 + (value - 100) * 0.0075;
}

export function scaleEnemyValue(base: number, multiplier = 1): number {
  return Math.max(0, Math.round(base * multiplier));
}
