import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards';
import { EVENTS } from '../data/events';
import { calcBlock, calcDamage, viewCard } from '../engine/cards';
import { aliveEnemies, canPlayCard, enemyIntent } from '../engine/combat';
import { availableNodes } from '../engine/map';
import { makeRng, nextFloat, pick } from '../engine/rng';
import * as R from '../engine/run';
import type { Archetype, CardInstance, CharacterId, CombatState, RunState } from '../engine/types';

/**
 * 启发式机器人：看意图决定防御还是进攻，按流派选牌。
 * 用来粗略评估数值难度（不是严格验收，只打印统计并做宽松断言）。
 */
function incomingDamage(cs: CombatState): number {
  let total = 0;
  for (const e of aliveEnemies(cs)) {
    const it = enemyIntent(cs, e);
    if (it && (it.kind === 'attack' || it.kind === 'attack_debuff')) total += it.amount * it.times;
  }
  return total;
}

function cardValue(cs: CombatState, c: CardInstance, needBlock: number): number {
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
        const n = Math.max(p.ember, cs.relics.includes('ember_censer') ? 3 : 0);
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

let lastBossHp = -1;
function botCombat(run: RunState): RunState {
  let guard = 0;
  while (run.combat && run.combat.outcome === 'ongoing' && guard++ < 400) {
    const cs = run.combat;
    const need = incomingDamage(cs) - cs.player.block;
    const playable = cs.player.hand.filter((c) => canPlayCard(cs, c).ok);
    if (playable.length) {
      const scored = playable.map((c) => ({ c, s: cardValue(cs, c, need) })).sort((a, b) => b.s - a.s);
      const best = scored[0];
      if (best.s > 0.5) {
        const v = viewCard(best.c);
        const target = v.target === 'enemy' ? aliveEnemies(cs).sort((a, b) => a.hp - b.hp)[0].id : null;
        const next = R.combatPlayCard(run, best.c.uid, target).run;
        if (next !== run) {
          run = next;
          continue;
        }
      }
    }
    run = R.combatEndTurn(run).run;
    for (const e of run.combat!.enemies.map((e) => e.id)) {
      if (run.combat!.outcome !== 'ongoing') break;
      run = R.combatEnemyAct(run, e).run;
    }
    if (run.combat!.outcome === 'ongoing') run = R.combatStartTurn(run).run;
  }
  if (run.combat?.tier === 'boss') lastBossHp = run.combat.enemies[0].hp;
  return R.finishCombat(run);
}

function playRun(seed: string, arch: Archetype, character: CharacterId = 'traveler'): { run: RunState; deaths: string; hpAtBoss: number; bossHpLeft: number; stalled?: boolean } {
  let hpAtBoss = -1;
  let bossHpLeft = -1;
  const rng = makeRng(seed, 'bot');
  let run = R.newRun(seed, character);
  let lastEnc = '';
  let steps = 0;
  const likes = (c: CardInstance) => CARDS[c.defId].archetype === arch;
  while (run.screen !== 'gameover' && run.screen !== 'victory' && steps++ < 2000) {
    switch (run.screen) {
      case 'chapter':
        run = R.enterNextChapter(run);
        break;
      case 'map': {
        const opts = availableNodes(run.map, run.currentNodeId);
        // 血量低时避开精英
        const safe = opts.filter((id) => run.map.nodes[id].type !== 'elite' || run.hp > run.maxHp * 0.6);
        run = R.travelTo(run, pick(rng, safe.length ? safe : opts));
        break;
      }
      case 'combat': {
        lastEnc = run.combat!.encounterId;
        const isBoss = run.combat!.tier === 'boss';
        if (isBoss) hpAtBoss = run.hp;
        const before = run;
        run = botCombat(run);
        // 单场达到行动上限后报告机器人停滞；不要在外层再续跑最多 2000 次。
        if (run.combat?.outcome === 'ongoing') return { run, deaths: '', hpAtBoss, bossHpLeft, stalled: true };
        if (isBoss && run.screen === 'gameover') {
          // 从战斗前状态重放到死亡，取 boss 剩余血量
          void before;
          bossHpLeft = lastBossHp;
        }
        break;
      }
      case 'reward': {
        run = R.rewardTakeGold(run);
        if (run.reward!.relicChoices?.length) run = R.rewardTakeRelic(run, run.reward!.relicChoices[0]);
        else if (run.reward!.relic) run = R.rewardTakeRelic(run);
        const cards = run.reward!.cards;
        const fav = cards.filter(likes);
        const rare = cards.filter((c) => CARDS[c.defId].rarity === 'rare');
        const choice = fav[0] ?? rare[0] ?? (run.deck.length < 16 ? cards[0] : null);
        run = choice ? R.rewardTakeCard(run, choice.uid) : R.rewardSkipCard(run);
        run = R.rewardLeave(run);
        break;
      }
      case 'shop': {
        const ridx = run.shop!.relics.findIndex((r) => !r.sold && r.price <= run.gold);
        if (ridx >= 0) run = R.shopBuyRelic(run, ridx);
        if (!run.shop!.removeUsed && run.gold >= run.shop!.removePrice) {
          const strike = run.deck.find((c) => c.defId === 'strike' && !c.upgraded);
          if (strike) run = R.shopRemoveCard(run, strike.uid);
        }
        const idx = run.shop!.cards.findIndex((c) => !c.sold && c.price <= run.gold && likes(c.card));
        if (idx >= 0) run = R.shopBuyCard(run, idx);
        run = R.shopLeave(run);
        break;
      }
      case 'rest': {
        if (run.hp < run.maxHp * 0.7) run = R.restHeal(run);
        else {
          const c = run.deck.filter(R.canUpgrade).sort((a, b) => (likes(b) ? 1 : 0) - (likes(a) ? 1 : 0))[0];
          if (c) run = R.restUpgrade(run, c.uid);
        }
        run = R.restLeave(run);
        break;
      }
      case 'event': {
        const ev = EVENTS[run.event!.eventId];
        const avail = ev.choices.filter((c) => R.eventChoiceAvailable(run, c.id));
        const pickId = (run.hp < run.maxHp * 0.5 ? avail.find((c) => c.detail.includes('回复')) : null) ?? avail[nextFloat(rng) < 0.5 ? 0 : avail.length - 1];
        run = R.eventChoose(run, pickId.id);
        if (run.event?.pendingPick) {
          const c = run.event.pendingPick === 'upgrade' ? run.deck.find(R.canUpgrade) : run.deck.find((x) => x.defId === 'strike') ?? run.deck[0];
          run = c ? R.eventPickCard(run, c.uid) : R.eventLeave(run);
        }
        if (run.screen === 'event') run = R.eventLeave(run);
        break;
      }
    }
  }
  return { run, deaths: run.screen === 'gameover' ? lastEnc : '', hpAtBoss, bossHpLeft };
}

describe('数值粗评', () => {
  it('启发式机器人在三条流派下的胜率与到达层数', () => {
    const archs: { arch: Archetype; character: CharacterId }[] = [
      { arch: 'combo', character: 'traveler' },
      { arch: 'bulwark', character: 'traveler' },
      { arch: 'ember', character: 'traveler' },
      { arch: 'cinder', character: 'picker' },
      { arch: 'ash', character: 'picker' },
      { arch: 'ember', character: 'picker' },
      { arch: 'blood', character: 'oathbound' },
      { arch: 'might', character: 'oathbound' },
      { arch: 'echo', character: 'scholar' },
      { arch: 'focus', character: 'scholar' },
    ];
    const summary: string[] = [];
    let totalWins = 0;
    let totalFloor = 0;
    let n = 0;
    for (const { arch, character } of archs) {
      let wins = 0;
      let floors = 0;
      let stalled = 0;
      const deaths: Record<string, number> = {};
      const N = 20;
      const hpAtBoss: number[] = [];
      const bossLeft: number[] = [];
      for (let i = 0; i < N; i++) {
        const { run, deaths: d, hpAtBoss: h, bossHpLeft: b, stalled: timeout } = playRun(`bal-${arch}-${i}`, arch, character);
        if (timeout) stalled++;
        if (run.screen === 'victory') wins++;
        floors += run.floor + 1;
        if (d) deaths[d] = (deaths[d] ?? 0) + 1;
        if (h >= 0) hpAtBoss.push(h);
        if (b >= 0) bossLeft.push(b);
      }
      const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0) : '-');
      totalWins += wins;
      totalFloor += floors;
      n += N;
      const top = Object.entries(deaths)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}×${v}`)
        .join(' ');
      summary.push(`${character}/${arch}: 胜 ${wins}/${N}，停滞 ${stalled}，平均层 ${(floors / N).toFixed(1)}，到 boss 时血 ${avg(hpAtBoss)}（${hpAtBoss.length} 次），死时 boss 剩 ${avg(bossLeft)}，主要死于 ${top}`);
    }
    console.log(summary.join('\n'));
    expect(totalFloor / n).toBeGreaterThan(5);
    expect(totalWins).toBeGreaterThanOrEqual(0);
  });
});
