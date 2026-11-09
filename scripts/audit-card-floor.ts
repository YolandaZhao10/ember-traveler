import { CARD_FLOOR_SEEDS, cardFloorFailures, cardFloorWarnings, runCardFloorBenchmark } from '../src/test/cardFloorBenchmark';
import { readFileSync } from 'node:fs';
import { CARDS } from '../src/data/cards';
import type { CardDef } from '../src/engine/types';

// 用历史卡定义在独立诊断进程复跑同一策略，绝不改写游戏源文件。
const snapshotIndex = process.argv.indexOf('--cards');
if (snapshotIndex >= 0) {
  const snapshot = JSON.parse(readFileSync(process.argv[snapshotIndex + 1], 'utf8')) as CardDef[];
  for (const card of snapshot) CARDS[card.id] = card;
}

const seedsIndex = process.argv.indexOf('--seeds');
const seedCount = seedsIndex < 0 ? CARD_FLOOR_SEEDS : Number(process.argv[seedsIndex + 1]);
const rows = runCardFloorBenchmark(seedCount);
const failures = cardFloorFailures(rows);
const warnings = cardFloorWarnings(rows);
const round = (value: number) => Math.round(value * 10000) / 10000;
console.log(JSON.stringify({
  note: '基础打击/防御实战替换对照。相同12张牌、初始随机状态和两张真实支持牌；符文护盾按初始牌数量仅1替换位，其余2位。五步/束宽六通用规划模拟当前已知敌方行动，未知抽牌只按张数评价且搜索中不可打出；双方无牌名偏置。仍只代表这组战斗，不代表真人通关率。',
  seedsPerMatchup: seedCount,
  fights: rows.length * seedCount * 2,
  criteria: '严重退化护栏：每行零超时/非法、胜场不降低；平均额外损血不超过5，平均战斗不延长超过1回合。具体收益与上限另由cardFloor.test.ts验证。',
  warningCriteria: '原优势指标保持：每形态至少一个场景胜场更多，或同胜场平均损血少1，或不多损血且快0.25回合。未达标不直接判为劣卡；--strict-advantage使这些警示也非零退出。',
  failures,
  warnings,
  deltas: rows.map(r => ({ id: r.id, upgraded: r.upgraded, encounter: r.encounter,
    wins: r.candidate.wins - r.control.wins, hpLost: round(r.candidate.hpLost - r.control.hpLost),
    turns: round(r.candidate.turns - r.control.turns), actions: round(r.candidate.actions - r.control.actions),
    cardsPlayed: round(r.candidate.cardsPlayed - r.control.cardsPlayed),
    replacementPlays: round(r.candidate.replacementPlays - r.control.replacementPlays) })),
  hpRegressions: rows.filter(r => r.candidate.hpLost > r.control.hpLost).map(r => ({ id: r.id, upgraded: r.upgraded, encounter: r.encounter,
    extraHpLost: round(r.candidate.hpLost - r.control.hpLost), turnDelta: round(r.candidate.turns - r.control.turns) })),
  rows,
}, null, 2));
if (failures.length || (process.argv.includes('--strict-advantage') && warnings.length)) process.exitCode = 1;
