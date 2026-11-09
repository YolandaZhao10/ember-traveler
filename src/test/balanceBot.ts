import { RELIC_TUNING as T } from '../data/relicBalance';
import { CARDS } from '../data/cards';
import { calcBlock, calcDamage, viewCard } from '../engine/cards';
import { aliveEnemies, enemyIntent, discardReplayChoices } from '../engine/combat';
import type { CardInstance, CombatState } from '../engine/types';

export function incomingDamage(cs: CombatState): number {
  let total = 0;
  for (const e of aliveEnemies(cs)) {
    const it = enemyIntent(cs, e);
    if (it && (it.kind === 'attack' || it.kind === 'attack_debuff')) total += it.amount * it.times;
  }
  return total;
}

export function cardValue(cs: CombatState, c: CardInstance, needBlock: number): number {
  const v = viewCard(c);
  const p = cs.player;
  const target = aliveEnemies(cs).sort((a, b) => a.hp - b.hp)[0];
  let dmg = 0;
  let blk = 0;
  let util = 0;
  for (const e of v.effects) {
    switch (e.kind) {
      case 'damage': {
        const extra = (e.strengthMult ? (p.statuses.strength ?? 0) * e.strengthMult : 0) + (e.perHandCard ? p.hand.length * e.perHandCard : 0) + (v.charge?.damage ? v.charge.damage * v.bonus : 0);
        dmg += calcDamage(e.amount, p.statuses, target?.statuses ?? null, extra) * (e.times ?? 1) * (e.aoe ? aliveEnemies(cs).length : 1);
        if (e.lifesteal) util += 2;
        break;
      }
      case 'damageByBlock':
        dmg += calcDamage(p.block * (e.mult ?? 1) + (e.bonus ?? 0), p.statuses, target?.statuses ?? null) * (e.aoe ? aliveEnemies(cs).length : 1);
        break;
      case 'damagePerAttack':
        dmg += calcDamage(e.amount, p.statuses, target?.statuses ?? null) * (p.attacksPlayedThisTurn + 1);
        break;
      case 'damagePerEmber':
        dmg += Math.floor(p.ember / (e.per ?? 1)) * e.amount;
        break;
      case 'emberBurst': {
        const n = Math.max(p.ember, cs.relics.includes('ember_censer') ? T.censerMinimumEmber : 0);
        if (e.damagePer) dmg += e.damagePer * n * (e.aoe ? aliveEnemies(cs).length : 1);
        if (e.blockPer) blk += calcBlock(e.blockPer * n, p.statuses);
        if (e.damagePer && target && e.damagePer * n >= target.hp + target.block) util += 10; // 能直接击杀
        else if (n < 6) util -= 8; // 余烬太少不值得爆发
        break;
      }
      case 'block':
        blk += calcBlock(e.amount + (v.charge?.block ? v.charge.block * v.bonus : 0), p.statuses);
        break;
      case 'draw':
        util += e.amount * 2;
        break;
      case 'energy':
        util += e.amount * 3;
        break;
      case 'gainEmber':
        util += e.amount > 0 ? e.amount * 1.2 : 0;
        break;
      case 'status':
        util += e.target === 'self' ? 5 : 3;
        break;
      case 'heal':
        util += e.amount;
        break;
      case 'conditional':
        util += 1;
        break;
      case 'exhaustHand': {
        const n = e.count === 'all' ? Math.max(0, p.hand.length - 1) : e.count;
        if (e.damagePerCard) dmg += e.damagePerCard * n;
        if (e.energyPerCard) util += 2 * n;
        util -= n * 1.5; // 失去手牌的代价
        if (p.statuses.ashFeast) blk += (p.statuses.ashFeast ?? 0) * n;
        if (p.statuses.kindling) dmg += (p.statuses.kindling ?? 0) * n;
        break;
      }
      case 'damagePerBurn':
        dmg += aliveEnemies(cs).reduce((s, en) => s + (en.statuses.burn ?? 0) * e.amount, 0);
        break;
      case 'consumeBurn': {
        const b = target?.statuses.burn ?? 0;
        dmg += b * e.damagePer;
        if (b < 4) util -= 6;
        break;
      }
      case 'doubleStatus': {
        const b = e.target === 'self' ? p.statuses[e.status] ?? 0 : target?.statuses[e.status] ?? 0;
        util += b >= 3 ? b * 1.5 : -4;
        break;
      }
      case 'replayDiscard':
        util += Math.max(0, ...discardReplayChoices(cs).map(choice => cardValue(cs, choice, needBlock) * Math.max(0.5, viewCard(choice).cost)));
        break;
      case 'returnExhausted':
        util += p.exhaust.length ? 4 : -5;
        break;
      case 'loseHp':
        util -= p.hp < 20 ? 30 : e.amount * 0.8;
        if (p.statuses.bloodRage) util += 4;
        break;
      case 'tempStrength':
        util += p.hand.some((h) => CARDS[h.defId].type === 'attack') ? e.amount * 2 : 0;
        break;
      case 'damagePerHpLost':
        dmg += p.hpLostThisTurn * e.mult;
        break;
      case 'doubleEmber':
        util += p.ember >= 3 ? p.ember : -3;
        break;
      case 'discardRandom':
        util -= 1;
        break;
    }
  }
  // 回响下优先打高价值攻击
  if (p.statuses.echo && v.type !== 'power') dmg *= 1.6;
  if (v.type === 'power') util += 6;
  const blockUseful = Math.min(blk, Math.max(0, needBlock));
  const score = dmg * 1.0 + blockUseful * 1.3 + (blk - blockUseful) * 0.15 + util;
  return score / Math.max(0.5, v.cost);
}

