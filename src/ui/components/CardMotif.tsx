import type { CardType, Effect } from '../../engine/types';

export type Motif = 'blade' | 'shield' | 'heart' | 'pages' | 'crystal' | 'recall' | 'flame' | 'seal';
export function cardMotif(type: CardType, effects: Effect[]): Motif {
  const all = effects.flatMap(e => e.kind === 'conditional' ? e.then : [e]);
  if (all.some(e => e.kind === 'moveCard' || e.kind === 'returnExhausted' || e.kind === 'replayDiscard')) return 'recall';
  if (all.some(e => e.kind === 'heal' || (e.kind === 'damage' && e.lifesteal))) return 'heart';
  if (all.some(e => e.kind === 'energy' || (e.kind === 'convertResource' && e.reward === 'energy'))) return 'crystal';
  if (all.some(e => e.kind === 'draw' || (e.kind === 'convertResource' && e.reward === 'draw'))) return 'pages';
  if (all.some(e => e.kind === 'exhaustHand' || e.kind === 'emberBurst' || e.kind === 'gainEmber' || e.kind === 'consumeBurn')) return 'flame';
  return type === 'attack' ? 'blade' : type === 'skill' ? 'shield' : 'seal';
}

/** 繁复模式的实体纹章，采用牌面实际效果分类，仍保留原图标作小印记。 */
export function CardMotif({ motif, fg, glow, dark }: { motif: Motif; fg: string; glow: string; dark: string }) {
  const ink = { stroke: fg, strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return <g {...ink} fill={dark} data-motif={motif}>
    {motif === 'blade' && <>
      <path d="M34 69L30 61L67 18L78 14L76 28L39 72Z" fill={glow} /><path d="M34 65L74 20L68 32L39 69" fill={fg} opacity=".7" />
      <path d="M22 63L28 57L45 74L39 80Z M32 74L21 85L15 79L26 68Z" /><path d="M18 79L24 85M23 73L29 79M24 56Q21 45 34 38 M48 77Q60 77 68 65" />
      <circle cx="34" cy="68" r="3" fill={fg} />
    </>}
    {motif === 'shield' && <>
      <path d="M50 16L79 29L76 59Q71 76 50 87Q29 76 24 59L21 29Z" fill={glow} /><path d="M50 23L71 33L69 57Q65 70 50 78Q35 70 31 57L29 33Z" />
      <path d="M50 23V78M29 42H71M39 33L50 28L61 33M37 60L50 70L63 60" /><path d="M50 37L60 49L50 63L40 49Z" fill={fg} opacity=".7" />
      {[[-22, -16], [22, -16], [-18, 13], [18, 13]].map(([x,y],i) => <circle key={i} cx={50+x} cy={49+y} r="1.5" fill={fg} />)}
    </>}
    {motif === 'heart' && <>
      <path d="M50 78Q19 59 23 39Q26 22 42 30L50 37L58 30Q75 22 78 39Q82 59 50 78Z" fill={glow} /><path d="M49 39Q34 31 31 42Q28 52 41 63" strokeWidth="3" opacity=".7" />
      <path d="M34 51H43L48 41L54 63L60 51H69 M50 17V25M22 23L29 30M78 23L71 30 M42 82L50 91L58 82" />
    </>}
    {motif === 'pages' && <>
      <path d="M22 25L65 17L78 75L35 83Z" fill={glow} /><path d="M16 34Q32 27 49 36Q67 27 84 34V77Q66 70 49 80Q32 70 16 77Z" />
      <path d="M49 36V80M23 42Q32 38 41 43M23 50Q32 46 41 51M23 58Q32 54 41 59M23 66L41 67 M58 43H76M58 51H76M58 59H71" />
      <path d="M64 47L69 50L64 55L60 51Z" fill={fg} /><path d="M47 80L53 81V90L49 87L45 90V80" fill={glow} />
    </>}
    {motif === 'crystal' && <>
      <path d="M50 15L73 38L66 70L50 86L32 68L27 38Z" fill={glow} /><path d="M50 15L42 38L50 69L59 38Z" fill={fg} opacity=".65" />
      <path d="M27 38H73L50 86M32 68L50 69L66 70M50 15L59 38M42 38L32 68" /><path d="M17 44L20 52L15 60M83 44L80 52L85 60M38 88H62" />
    </>}
    {motif === 'recall' && <>
      <path d="M31 26H62L70 34V74H31Z" fill={glow} /><path d="M62 26V34H70M39 43H60M39 52H56M39 61H52" />
      <path d="M78 34Q92 58 70 80Q47 99 25 76M25 76L24 88M25 76L38 78 M22 63Q7 39 30 20Q48 7 65 18M65 18L53 18M65 18L62 7" fill="none" strokeWidth="3" />
      <path d="M50 46L56 53L50 60L44 53Z" fill={fg} />
    </>}
    {motif === 'flame' && <>
      <path d="M50 79Q24 75 27 55Q27 45 37 37Q34 49 43 48Q36 30 58 13Q53 33 64 42Q82 56 70 71Q64 80 50 79Z" fill={glow} />
      <path d="M50 72Q39 67 44 56Q49 58 48 49Q62 55 61 63Q61 72 50 72Z" fill={fg} /><path d="M29 82H71L65 89H35Z M20 52L17 43M78 30L82 22M36 22L32 15" />
    </>}
    {motif === 'seal' && <>
      <path d="M50 14L61 31L81 27L75 47L88 61L68 67L63 87L47 75L28 84L27 63L10 52L29 42L30 21Z" fill={glow} />
      <circle cx="50" cy="50" r="23" /><circle cx="50" cy="50" r="17" strokeDasharray="3 3" />
      <path d="M50 33L61 50L50 67L39 50Z M33 50H67" fill={fg} opacity=".7" />
    </>}
  </g>;
}
