import type { JourneyScore as Score } from '../../engine/score';

export function JourneyScore({ score }: { score: Score }) {
  return <section className="journey-score panel" aria-label="通关评分">
    <div className="score-heading"><span>通关评分</span><strong>{score.total.toLocaleString('zh-CN')}</strong><span>难度系数 ×{score.multiplier.toFixed(2)}</span></div>
    <details><summary>查看评分明细</summary>
      <dl>{score.parts.map(p => <div key={p.label}><dt>{p.label}<b>+{p.points}</b></dt><dd>{p.detail}</dd></div>)}</dl>
      <p className="subtitle">总分 = 各项之和 × 难度系数。系数按四项生命/意图设置的平均比例计算；金币和两项稀有度的平均倾向超过100%时，相应下调系数（0.25–2.00）。用时与伤害总量不额外加分。</p>
    </details>
  </section>;
}
