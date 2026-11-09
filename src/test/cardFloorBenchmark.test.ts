import { describe, expect, it } from 'vitest';
import { CARD_FLOOR_CASES, cardFloorFailures, cardFloorWarnings, runCardFloorBenchmark } from './cardFloorBenchmark';

describe('基础打防实战严重退化护栏', () => {
  it('固定种子逐场对照不降低胜场、不严重增加损血或回合，也不陷入循环', () => {
    const rows = runCardFloorBenchmark();
    expect(rows).toHaveLength(CARD_FLOOR_CASES.length * 4);
    expect(cardFloorFailures(rows)).toEqual([]);
    // 如实打印原优势指标未达标项，不能把该护栏通过解释成所有牌全面强于打防。
    console.info('仍需结合构筑用途解读的优势警示：', cardFloorWarnings(rows));
    const broken = structuredClone(rows);
    broken[0].candidate.wins--;
    broken[1].candidate.hpLost = broken[1].control.hpLost + 6;
    broken[2].candidate.turns = broken[2].control.turns + 2;
    broken[3].candidate.stalled++;
    const failures = cardFloorFailures(broken);
    expect(failures.some(f => f.includes('胜场低于'))).toBe(true);
    expect(failures.some(f => f.includes('额外损血'))).toBe(true);
    expect(failures.some(f => f.includes('战斗延长'))).toBe(true);
    expect(failures.some(f => f.includes('超时或非法'))).toBe(true);
  }, 60000);
});
