import type { CardDef, Effect } from './types';

export type CardRole = 'offense' | 'defense' | 'engine';

function effectRole(effect: Effect): CardRole | null {
  switch (effect.kind) {
    case 'damage':
    case 'damagePerHpLost':
    case 'damageByBlock':
    case 'damagePerAttack':
    case 'damagePerEmber':
    case 'damagePerBurn':
    case 'consumeBurn':
    case 'consumeVulnerable':
    case 'spreadBurn':
    case 'removeBlock':
      return 'offense';
    case 'block':
    case 'blockPerBurn':
    case 'blockPerHand':
    case 'heal':
    case 'clearDebuffs':
      return 'defense';
    case 'emberBurst':
      return effect.blockPer ? 'defense' : effect.damagePer ? 'offense' : null;
    case 'status':
      if (effect.target !== 'self') {
        if (effect.amount > 0 && ['weak', 'strengthDown'].includes(effect.status)) return 'defense';
        if (effect.amount > 0 && ['burn', 'vulnerable', 'frail'].includes(effect.status)) return 'offense';
        if (effect.status === 'strength' && effect.amount < 0) return 'defense';
        return null;
      }
      if (effect.amount <= 0 || ['weak', 'vulnerable', 'frail', 'burn', 'strengthDown'].includes(effect.status)) return null;
      return ['dexterity', 'thorns', 'metallicize', 'barricade', 'regen', 'forge', 'ashFeast', 'bloodArmor', 'sanguine', 'arcaneWard'].includes(effect.status) ? 'defense' : 'engine';
    case 'exhaustHand':
      return effect.damagePerCard ? 'offense' : effect.energyPerCard || effect.filter === 'curse' ? 'engine' : null;
    case 'gainEmber':
    case 'energy':
      return effect.amount > 0 ? 'engine' : null;
    case 'draw':
    case 'doubleEmber':
    case 'chargeHand':
    case 'returnExhausted':
    case 'doubleStatus':
    case 'tempStrength':
    case 'burnToEmber':
      return 'engine';
    // 失血、弃牌与普通消耗手牌可能是代价，不用它们覆盖这张牌的收益。
    case 'loseHp':
    case 'discardRandom':
    case 'conditional':
      return null;
  }
}

function primaryRole(effects: Effect[]): CardRole | null {
  const roles = effects.map(effectRole).filter((role): role is CardRole => role !== null);
  // 有防护的混合技能仍算防御，不会因为附带抽牌就被当成另一种功能。
  if (roles.includes('defense')) return 'defense';
  if (roles.includes('offense')) return 'offense';
  return roles.length ? 'engine' : null;
}

/** 粗分奖励功能，不评估强弱或流派适配。攻击牌重在输出，能力牌重在持续准备。 */
export function cardRole(card: CardDef): CardRole {
  if (card.type === 'attack') return 'offense';
  if (card.type === 'power') return 'engine';
  const immediate = primaryRole(card.effects);
  if (immediate) return immediate;
  const conditionalEffects = (effects: Effect[]): Effect[] => effects.flatMap(effect => effect.kind === 'conditional'
    ? [...effect.then, ...conditionalEffects(effect.then)] : []);
  return primaryRole(conditionalEffects(card.effects)) ?? 'engine';
}

/**
 * 第三张奖励只避开前两张共同的功能；稀有度、角色和去重由调用者先筛好。
 * 不重掷稀有度、不读取牌组、不消耗随机数；当前池没有其他功能时保留原池。
 */
export function distinctRewardPool(pool: CardDef[], chosen: CardDef[]): CardDef[] {
  if (chosen.length !== 2) return pool;
  const role = cardRole(chosen[0]);
  if (cardRole(chosen[1]) !== role) return pool;
  const distinct = pool.filter(card => cardRole(card) !== role);
  return distinct.length ? distinct : pool;
}
