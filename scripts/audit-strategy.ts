import { writeFileSync } from 'node:fs';
import { CARD_LIST, CARDS, cardAvailableTo } from '../src/data/cards';
import { ENEMIES } from '../src/data/enemies';
import { cardRole } from '../src/engine/cardChoices';
import { ensureEncounterPlan, plannedEncounter } from '../src/engine/encounters';
import { generateMap, validateMap } from '../src/engine/map';
import { makeRng, pick, weightedPick } from '../src/engine/rng';
import { previewRoute } from '../src/engine/routePreview';
import * as R from '../src/engine/run';
import type { CardDef, ChapterId, CharacterId, MapNode, RunState } from '../src/engine/types';

// 本脚本检查选择的结构与既有约束，不模拟战斗，也不计算玩家胜率。
const mapSeeds = 300;
const rewardSamples = 200;
const characters: CharacterId[] = ['traveler', 'picker', 'oathbound', 'scholar'];
const failures: string[] = [];
const check = (ok: boolean, message: string) => { if (!ok) failures.push(message); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const percent = (n: number, total: number) => total ? Number((n / total * 100).toFixed(2)) : 0;

function mapCounters(chapter: ChapterId) {
  return { chapter, maps: 0, validMaps: 0, validPlans: 0, battleNodes: 0, plannedBattleNodes: 0,
    rowsWithMultipleCombats: 0, rowsWithDistinctFormations: 0, forks: 0, forksWithDistinctNodeTypes: 0,
    forksWithDistinctChoices: 0, combatForks: 0, combatForksWithDistinctFormations: 0,
    forksWithDistinctSupplyOrEliteOutlook: 0 };
}
const mapRows = ([1, 2, 3] as const).map(mapCounters);

for (let seed = 0; seed < mapSeeds; seed++) {
  const run = R.newRun(`STRATEGY-MAP-${seed}`);
  for (const row of mapRows) {
    run.chapter = row.chapter;
    if (row.chapter > 1) run.map = generateMap(run.rng.map, row.chapter);
    const randomBefore = structuredClone(run.rng);
    ensureEncounterPlan(run);
    check(same(run.rng, randomBefore), `规划推进随机流：${seed}/${row.chapter}`);
    const plannedMap = structuredClone(run.map);
    ensureEncounterPlan(run);
    check(same(run.map, plannedMap), `重复规划改变身份：${seed}/${row.chapter}`);
    row.maps++;
    if (validateMap(run.map)) row.validMaps++;
    const nodes = Object.values(run.map.nodes);
    const battleNodes = nodes.filter(node => ['combat', 'elite', 'boss'].includes(node.type));
    row.battleNodes += battleNodes.length;
    const valid = battleNodes.filter(node => {
      const encounter = plannedEncounter(run, node);
      return encounter && encounter.enemies.every(id => !!ENEMIES[id]);
    });
    row.plannedBattleNodes += valid.length;
    if (valid.length === battleNodes.length) row.validPlans++;

    // 按敌人 ID 多重集合区分阵容，避免遭遇名称不同但敌人相同被误算为差异。
    const formation = (node: MapNode) => plannedEncounter(run, node)?.enemies.slice().sort().join('+') ?? '';
    const identity = (node: MapNode) => `${node.type}:${formation(node)}`;
    for (let floor = 0; floor < run.map.rows; floor++) {
      const combats = nodes.filter(node => node.row === floor && node.type === 'combat');
      if (combats.length < 2) continue;
      row.rowsWithMultipleCombats++;
      if (new Set(combats.map(formation)).size > 1) row.rowsWithDistinctFormations++;
    }

    // 开局选路视为一个分叉，其余以任一节点有至少两条直接后路计数。
    const forks = [run.map.startIds, ...nodes.map(node => node.next)].filter(ids => ids.length > 1);
    for (const ids of forks) {
      row.forks++;
      const options = ids.map(id => run.map.nodes[id]);
      if (new Set(options.map(node => node.type)).size > 1) row.forksWithDistinctNodeTypes++;
      if (new Set(options.map(identity)).size > 1) row.forksWithDistinctChoices++;
      const combats = options.filter(node => node.type === 'combat');
      if (combats.length > 1) {
        row.combatForks++;
        if (new Set(combats.map(formation)).size > 1) row.combatForksWithDistinctFormations++;
      }
      const outlooks = options.map(node => {
        const preview = previewRoute(run.map, node.id);
        check(preview.reachable.has(node.id) && preview.reachable.has(run.map.bossId), `后路预览断路：${seed}/${row.chapter}/${node.id}`);
        return [preview.nearestRest, preview.nearestShop, preview.elites.min, preview.elites.max].join('/');
      });
      if (new Set(outlooks).size > 1) row.forksWithDistinctSupplyOrEliteOutlook++;
    }
    check(same(run.map, plannedMap) && same(run.rng, randomBefore), `预览修改地图或随机流：${seed}/${row.chapter}`);
  }
}
for (const row of mapRows) {
  check(row.validMaps === row.maps, `第 ${row.chapter} 章存在断路图`);
  check(row.validPlans === row.maps, `第 ${row.chapter} 章存在无有效遭遇的战斗节点`);
}

/** 对照版本复刻本轮之前的先稀有度、再纯随机牌 ID 流程。 */
function legacyChoices(run: RunState, tier: R.CardRewardTier, count: number): CardDef[] {
  const weights = R.cardRarityWeights(run.floor, tier, run.difficulty.cardRarity);
  const chosen: CardDef[] = [];
  let guard = 0;
  while (chosen.length < count && guard++ < 100) {
    const rarity = weightedPick(run.rng.reward, (['common', 'uncommon', 'rare'] as const).map(item => ({ item, weight: weights[item] })));
    const pool = CARD_LIST.filter(card => card.rarity === rarity && !chosen.some(c => c.id === card.id)
      && (tier === 'boss' ? card.owner === run.character : cardAvailableTo(card, run.character)));
    if (pool.length) chosen.push(pick(run.rng.reward, pool));
  }
  return chosen;
}
const rewardRows = [];
let unchangedShops = 0;
for (const character of characters) {
  const base = R.newRun(`STRATEGY-REWARD-${character}`, character);
  for (const tier of ['normal', 'elite', 'boss'] as const) {
    const row = { character, tier, groups: rewardSamples, sameRaritySequence: 0, sameRandomState: 0,
      sameFirstTwoCards: 0, oldAllSameRole: 0, newAllSameRole: 0, changedThirdCard: 0 };
    for (let seed = 0; seed < rewardSamples; seed++) {
      const current = structuredClone(base);
      current.floor = seed % 65;
      current.rng.reward = makeRng(`STRATEGY-REWARD-${seed}`, `${character}:${tier}`);
      const before = structuredClone(current);
      const replay = structuredClone(current);
      const oldCards = legacyChoices(before, tier, 3);
      const newCards = R.generateCardChoices(current, tier, 3).map(card => CARDS[card.defId]);
      if (same(oldCards.map(card => card.rarity), newCards.map(card => card.rarity))) row.sameRaritySequence++;
      if (same(before.rng.reward, current.rng.reward)) row.sameRandomState++;
      if (same(oldCards.slice(0, 2).map(card => card.id), newCards.slice(0, 2).map(card => card.id))) row.sameFirstTwoCards++;
      if (new Set(oldCards.map(cardRole)).size === 1) row.oldAllSameRole++;
      if (new Set(newCards.map(cardRole)).size === 1) row.newAllSameRole++;
      if (oldCards[2]?.id !== newCards[2]?.id) row.changedThirdCard++;
      const label = `${character}/${tier}/${seed}`;
      check(newCards.length === 3 && new Set(newCards.map(card => card.id)).size === 3, `牌数/去重异常：${label}`);
      check(newCards.every(card => cardAvailableTo(card, character)), `越角色奖励：${label}`);
      check(tier !== 'boss' || newCards.every(card => card.rarity === 'rare' && card.owner === character), `首领专属稀有限制失效：${label}`);
      check(same(newCards.map(card => card.id), R.generateCardChoices(replay, tier, 3).map(card => card.defId)), `奖励不可复现：${label}`);
    }
    check(row.sameRaritySequence === rewardSamples && row.sameRandomState === rewardSamples && row.sameFirstTwoCards === rewardSamples,
      `改变既有抽样约束：${character}/${tier}`);
    rewardRows.push({ ...row, oldAllSameRolePercent: percent(row.oldAllSameRole, row.groups), newAllSameRolePercent: percent(row.newAllSameRole, row.groups) });
  }
  // 商店继续使用原来的十张抽牌，不应用奖励三选一的功能筛选。
  for (let seed = 0; seed < rewardSamples; seed++) {
    const current = structuredClone(base);
    current.rng.reward = makeRng(`STRATEGY-SHOP-${seed}`, character);
    const control = structuredClone(current);
    if (same(R.generateCardChoices(current, 'shop', 10).map(card => card.defId), legacyChoices(control, 'shop', 10).map(card => card.id))
      && same(current.rng.reward, control.rng.reward)) unchangedShops++;
  }
}
check(unchangedShops === characters.length * rewardSamples, '商店抽样发生变化');
const sum = (key: 'groups' | 'sameRaritySequence' | 'sameRandomState' | 'oldAllSameRole' | 'newAllSameRole' | 'changedThirdCard') => rewardRows.reduce((n, row) => n + row[key], 0);
const result = {
  note: '选择结构审计，不包含战斗，不代表玩家胜率、整局胜率或已完成全局平衡。地图为300个固定种子的前三章连续地图随机流；奖励为4角色×3种奖励×200组，楼层循环0–64，标准难度。',
  maps: mapRows.map(row => ({ ...row,
    distinctFormationRowPercent: percent(row.rowsWithDistinctFormations, row.rowsWithMultipleCombats),
    distinctChoiceForkPercent: percent(row.forksWithDistinctChoices, row.forks),
    distinctOutlookForkPercent: percent(row.forksWithDistinctSupplyOrEliteOutlook, row.forks) })),
  rewards: { groups: sum('groups'), sameRaritySequence: sum('sameRaritySequence'), sameRandomState: sum('sameRandomState'),
    oldAllSameRole: sum('oldAllSameRole'), newAllSameRole: sum('newAllSameRole'),
    oldAllSameRolePercent: percent(sum('oldAllSameRole'), sum('groups')), newAllSameRolePercent: percent(sum('newAllSameRole'), sum('groups')),
    changedThirdCard: sum('changedThirdCard'), rows: rewardRows },
  shops: { samples: characters.length * rewardSamples, unchanged: unchangedShops },
  failures,
};
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0) {
  const path = process.argv[outputIndex + 1];
  if (!path) throw new Error('--output 需要文件路径');
  writeFileSync(path, JSON.stringify(result, null, 2));
}
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
