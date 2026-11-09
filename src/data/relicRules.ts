import type { RelicCombatEffect, RelicCombatRule, RelicCondition, RelicJourneyRule } from '../engine/types';
import { STATUSES } from './statuses';

function conditionText(c: RelicCondition): string {
  switch (c.kind) {
    case 'hpBelowHalf': return '生命不高于上限的一半';
    case 'retainedHand': return '手中有保留牌';
    case 'burningEnemy': return '有存活敌人正在燃烧';
    case 'emberAtLeast': return `余烬不少于 ${c.value}`;
    case 'blockAtLeast': return `格挡不少于 ${c.value}`;
    case 'attacksAtLeast': return `本回合打出至少 ${c.value} 张攻击牌`;
    case 'skillsAtLeast': return `本回合打出至少 ${c.value} 张技能牌`;
    case 'cardsAtMost': return `本回合出牌不超过 ${c.value} 张`;
    case 'exhaustedAtLeast': return `本回合消耗至少 ${c.value} 张牌`;
    case 'handAtLeast': return `手牌至少 ${c.value} 张`;
    case 'energyAtLeast': return `剩余能量不少于 ${c.value}`;
    case 'hpLostAtLeast': return `本回合因卡牌失去至少 ${c.value} 点生命`;
  }
}
function effectText(e: RelicCombatEffect): string {
  switch (e.kind) {
    case 'block': return `获得 ${e.amount} 点格挡`;
    case 'draw': return `抽 ${e.amount} 张牌`;
    case 'energy': return `获得 ${e.amount} 点能量`;
    case 'ember': return `获得 ${e.amount} 点余烬`;
    case 'heal': return `回复 ${e.amount} 点生命`;
    case 'damageAll': return `对所有敌人造成 ${e.amount} 点固定伤害（可被格挡）`;
    case 'damageLowest': return `对生命最低的敌人造成 ${e.amount} 点固定伤害（可被格挡）`;
    case 'charge': return `手中每张保留的蓄力牌额外蓄力 ${e.amount} 次`;
    case 'status': return `获得 ${e.amount} 层${STATUSES[e.status].name}`;
    case 'enemyStatus': return `对${e.target === 'all' ? '所有敌人' : '生命最低的敌人'}施加 ${e.amount} 层${STATUSES[e.status].name}`;
    case 'cleanse': return `移除自身 ${e.amount} 层${STATUSES[e.status].name}`;
  }
}
/** 新遗物的说明和结算共用同一份结构化规则，避免手写文案与实际触发分离。 */
export function describeRelicRules(combat: RelicCombatRule[] = [], journey: RelicJourneyRule[] = []): string {
  const actions = { cardPlayed: '打出卡牌', attackPlayed: '打出攻击牌', skillPlayed: '打出技能牌', powerPlayed: '打出能力牌', exhaust: '消耗卡牌', selfHpLoss: '因卡牌失去生命', echo: '触发回响或镜像', enemyKilled: '有敌人死亡' };
  return [
    ...combat.map(r => {
      let trigger: string;
      if (r.trigger === 'turnStart' || r.trigger === 'turnEnd') {
        const at = r.nth === 1 ? '首回合' : r.nth ? `第 ${r.nth} 回合` : r.every ? `第 ${r.every}、${r.every * 2}、${r.every * 3}……回合` : '每回合';
        trigger = `${at}${r.trigger === 'turnStart' ? '抽牌前' : '结束时'}`;
      } else {
        trigger = `每回合${r.nth === 1 ? '首次' : r.nth ? `第 ${r.nth} 次` : r.every ? `每 ${r.every} 次` : '每次'}${actions[r.trigger]}后`;
      }
      return `${trigger}${r.when?.length ? `，若${r.when.map(conditionText).join('且')}` : ''}：${r.effects.map(effectText).join('，')}。`;
    }),
    ...journey.map(r => {
      const trigger = r.trigger === 'victory' ? `${r.tier ? { normal: '普通', elite: '精英', boss: '首领' }[r.tier] : '每场'}战斗胜利后` : { obtain: '获得时', rest: '营火休息后', upgrade: '营火锻造升级卡牌后', purchase: '每次购买卡牌或遗物后（不含购买本遗物）', remove: '商店付费移除卡牌后' }[r.trigger];
      return `${trigger}：${r.effects.map(e => e.kind === 'gold' ? `获得 ${e.amount} 金币` : e.kind === 'maxHp' ? `最大生命增加 ${e.amount}` : `回复 ${e.amount} 点生命`).join('，')}。`;
    }),
  ].join('');
}
