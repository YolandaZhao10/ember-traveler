import { useId } from 'react';
import { CARDS } from '../../data/cards';
import { CardMotif, cardMotif } from './CardMotif';
import type { Archetype, CardType } from '../../engine/types';
import { useArt, useCardStyle } from '../art';

/**
 * 卡面插画：按卡牌 id 选择符号，按流派配色并叠加手绘底图。
 * 缺少位图时使用内联 SVG 背景，保留每张牌各自的识别符号。
 */
const PALETTE: Record<Archetype, { bg1: string; bg2: string; fg: string; glow: string }> = {
  basic: { bg1: '#3b3129', bg2: '#1c1613', fg: '#d6c391', glow: '#c9a24a' },
  combo: { bg1: '#4a2a3b', bg2: '#1c1016', fg: '#ffd27a', glow: '#ff6a8a' },
  bulwark: { bg1: '#243b4a', bg2: '#0f1a22', fg: '#9ec4e0', glow: '#5f8fb4' },
  ember: { bg1: '#5a2a12', bg2: '#1f0f08', fg: '#ffb347', glow: '#ff7a2a' },
  cinder: { bg1: '#5a1a1a', bg2: '#200808', fg: '#ff8a5a', glow: '#ff3b1f' },
  ash: { bg1: '#3a3a3a', bg2: '#101010', fg: '#d9d4c7', glow: '#8a8a8a' },
  blood: { bg1: '#5a1020', bg2: '#1a0408', fg: '#ff6b7a', glow: '#c2203a' },
  might: { bg1: '#5a3a10', bg2: '#1f1304', fg: '#ffcf6b', glow: '#e08a1f' },
  echo: { bg1: '#1f3a5a', bg2: '#08101f', fg: '#8fd3ff', glow: '#3f8fd1' },
  focus: { bg1: '#2a4a3a', bg2: '#08140f', fg: '#9fe3b8', glow: '#3fb37a' },
  status: { bg1: '#514460', bg2: '#151321', fg: '#c9b9e0', glow: '#9480cf' },
  curse: { bg1: '#222', bg2: '#050505', fg: '#777', glow: '#333' },
};

function Glyph({ id, type, fg }: { id: string; type: CardType; fg: string }) {
  const s = { fill: 'none', stroke: fg, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'dazed':
      return <path d="M66 51 C67 29 34 27 31 49 C27 76 73 82 80 50 C87 15 25 11 18 49 M43 51 C43 39 60 40 59 51 C58 61 45 61 43 54" {...s} />;
    case 'strike':
    case 'quick_stab':
      return <path d="M30 70 L70 30 M62 30 H70 V38 M30 62 L38 70" {...s} />;
    case 'twin_blades':
      return <path d="M25 72 L55 30 M40 72 L75 30 M50 30 h5 M70 30 h5" {...s} />;
    case 'chain_slash':
      return <path d="M20 65 Q50 20 80 55 M30 75 Q50 45 72 72" {...s} />;
    case 'spin_kick':
      return <path d="M50 50 m-22 0 a22 22 0 1 1 44 0 M72 50 L82 42 M72 50 L82 58" {...s} />;
    case 'rhythm':
    case 'ash_step':
      return <path d="M25 70 L25 40 L45 35 L45 65 M25 70 a6 6 0 1 0 0.1 0 M45 65 a6 6 0 1 0 0.1 0 M60 45 L75 30 M60 60 L80 50" {...s} />;
    case 'haste':
      return <path d="M30 55 H60 M25 45 H55 M35 65 H65 M60 35 L80 50 L60 65" {...s} />;
    case 'thousand_cuts':
      return <path d="M20 30 L80 70 M20 50 L80 50 M20 70 L80 30 M50 20 L50 80" {...s} />;
    case 'tempo':
      return <path d="M50 22 v40 M38 62 a12 8 0 1 0 24 0 a12 8 0 1 0 -24 0 M50 22 q20 5 22 20" {...s} />;
    case 'war_drum':
      return <path d="M28 40 h44 v28 a22 8 0 0 1 -44 0 z M28 40 a22 8 0 0 0 44 0 a22 8 0 0 0 -44 0 M35 25 L45 38 M65 25 L55 38" {...s} />;
    case 'trip':
      return <path d="M30 70 L50 35 L70 70 M25 75 H75 M50 35 L50 22" {...s} />;
    case 'defend':
    case 'raise_shield':
    case 'iron_wall':
      return <path d="M50 20 L75 30 V52 Q75 70 50 80 Q25 70 25 52 V30 Z M50 30 V70" {...s} />;
    case 'shield_bash':
      return <path d="M42 22 L64 30 V50 Q64 66 42 76 Q22 66 22 50 V30 Z M66 42 L84 42 M72 32 L84 42 L72 52" {...s} />;
    case 'thorn_mail':
      return <path d="M50 22 L74 32 V52 Q74 70 50 78 Q26 70 26 52 V32 Z M30 36 L18 28 M70 36 L82 28 M28 58 L16 60 M72 58 L84 60" {...s} />;
    case 'riposte':
      return <path d="M24 70 L60 34 M54 34 H60 V40 M60 70 Q78 60 76 40 M40 24 L48 32" {...s} />;
    case 'hold_fast':
      return <path d="M22 70 h56 M22 56 h56 M22 42 h56 M36 42 v14 M64 42 v14 M50 56 v14 M30 28 h40 v14 h-40 z" {...s} />;
    case 'iron_will':
      return <path d="M50 22 L72 34 V62 L50 76 L28 62 V34 Z M50 36 L60 42 V56 L50 62 L40 56 V42 Z" {...s} />;
    case 'shield_shatter':
      return <path d="M50 22 L74 32 V50 L58 62 L50 78 L42 62 L26 50 V32 Z M50 40 L44 52 L54 56 L48 68 M20 70 L30 62 M80 70 L70 62" {...s} />;
    case 'vigil':
      return <path d="M20 50 Q50 20 80 50 Q50 80 20 50 Z M50 50 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0" {...s} />;
    case 'bulwark_counter':
      return <path d="M50 24 L70 32 V50 Q70 66 50 74 Q30 66 30 50 V32 Z M14 50 L26 50 M74 50 L86 50 M18 40 L26 46 M82 40 L74 46" {...s} />;
    case 'kindle':
    case 'stoke':
    case 'torch':
      return <path d="M50 78 Q28 64 36 44 Q40 56 48 54 Q42 36 58 22 Q58 40 66 46 Q74 60 64 72 Q60 78 50 78 Z M50 70 Q44 62 50 54 Q56 62 50 70 Z" {...s} />;
    case 'ember_burst':
    case 'flame_breath':
      return <path d="M50 50 L50 18 M50 50 L78 34 M50 50 L82 58 M50 50 L64 82 M50 50 L36 82 M50 50 L18 58 M50 50 L22 34 M50 50 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0" {...s} />;
    case 'ash_shield':
      return <path d="M50 22 L74 32 V52 Q74 70 50 78 Q26 70 26 52 V32 Z M50 66 Q40 58 46 48 Q48 54 52 52 Q48 42 58 36 Q58 46 62 50 Q66 60 58 66 Z" {...s} />;
    case 'ember_heart':
      return <path d="M50 76 Q20 54 24 36 Q30 20 50 32 Q70 20 76 36 Q80 54 50 76 Z M50 62 Q44 56 48 50 Q50 54 52 52 Q50 46 56 42 Q56 50 58 52 Q60 58 54 62 Z" {...s} />;
    case 'ignite':
      return <path d="M30 70 Q30 40 50 30 Q70 40 70 70 Z M50 30 V18 M42 76 H58 M24 54 L16 48 M76 54 L84 48" {...s} />;
    case 'searing_strike':
    case 'ember_blade':
      return <path d="M28 72 L66 34 M60 34 H66 V40 M70 26 Q74 18 80 22 Q74 24 76 32 M24 78 L32 70" {...s} />;
    case 'ember_dance':
      return <path d="M30 76 Q40 50 30 30 M50 76 Q62 52 50 24 M70 76 Q80 50 70 30 M20 60 L80 40" {...s} />;
    case 'pillar_of_flame':
      return <path d="M40 80 H60 M44 80 V40 Q44 24 50 18 Q56 24 56 40 V80 M50 30 L50 44 M30 60 Q36 52 32 44 M70 60 Q64 52 68 44" {...s} />;
    case 'forge':
      return <path d="M22 60 H78 L70 72 H30 Z M30 60 V44 H70 V60 M44 44 V32 H56 V44 M50 20 V30" {...s} />;
    case 'ember_gust':
      return <path d="M18 40 Q40 30 60 40 T82 40 M18 56 Q40 46 60 56 T82 56 M60 26 Q66 20 64 32" {...s} />;
    case 'cinder_mend':
      return <path d="M50 22 V78 M22 50 H78 M34 34 L66 66 M66 34 L34 66" {...s} />;
    case 'ashes':
      return <path d="M30 70 Q50 60 70 70 M34 60 Q50 50 66 60 M40 50 Q50 44 60 50 M50 44 V30" {...s} />;
    case 'light_up':
    case 'lingering_fire':
      return <path d="M40 78 L62 78 M44 78 Q36 60 50 48 Q52 60 58 58 Q54 44 66 34 Q64 52 72 60 Q76 72 62 78 M24 40 L34 50 M20 56 L30 56" {...s} />;
    case 'wildfire':
      return <path d="M14 76 Q22 56 30 72 Q36 50 44 70 Q50 44 58 68 Q64 50 72 72 Q78 56 86 76 Z" {...s} />;
    case 'scorch_mark':
      return <path d="M26 72 L64 34 M58 34 H64 V40 M40 20 Q44 28 38 34 M60 70 Q70 62 66 50" {...s} />;
    case 'detonate':
      return <path d="M50 50 L50 16 M50 50 L80 30 M50 50 L86 56 M50 50 L72 82 M50 50 L30 84 M50 50 L14 60 M50 50 L22 26 M50 50 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0" {...s} />;
    case 'add_fuel':
      return <path d="M30 30 L40 72 L60 72 L70 30 Z M36 30 Q50 22 64 30 M44 46 Q50 40 56 46" {...s} />;
    case 'heat_wave':
      return <path d="M16 70 Q30 56 44 70 T72 70 T100 70 M16 52 Q30 38 44 52 T72 52 M16 34 Q30 20 44 34 T72 34" {...s} />;
    case 'cremation':
      return <path d="M24 74 H76 M30 74 V56 H70 V74 M50 56 Q40 44 48 34 Q50 42 54 40 Q50 28 60 20 Q58 34 66 40 Q72 50 62 56" {...s} />;
    case 'everburning':
      return <path d="M50 20 Q66 34 60 50 Q58 42 52 44 Q58 58 46 70 Q44 60 40 62 Q34 48 50 20 Z M30 76 Q50 86 70 76" {...s} />;
    case 'ember_tongue':
      return <path d="M30 60 Q50 20 70 60 Q60 54 50 70 Q40 54 30 60 Z M50 70 V82" {...s} />;
    case 'pick_up':
      return <path d="M30 72 L36 40 L64 40 L70 72 Z M44 40 Q50 26 56 40 M40 56 L60 56" {...s} />;
    case 'burn_pages':
      return <path d="M30 26 H62 L70 34 V74 H30 Z M62 26 V34 H70 M38 44 H60 M38 54 H56 M50 74 Q40 66 46 58 Q50 64 54 60 Q52 52 60 48 Q60 60 64 64 Q66 72 58 74" {...s} />;
    case 'bone_ash':
      return <path d="M30 70 L70 30 M28 64 Q22 70 28 76 Q34 78 36 72 M64 36 Q70 30 76 34 Q78 40 72 42" {...s} />;
    case 'ash_feast':
      return <path d="M20 60 H80 L74 76 H26 Z M28 60 Q50 40 72 60 M44 48 L50 38 L56 48" {...s} />;
    case 'pass_the_flame':
      return <path d="M20 70 L40 50 M34 50 H40 V56 M60 50 L80 30 M74 30 H80 V36 M44 46 Q50 36 56 46 Q50 42 44 46 Z" {...s} />;
    case 'burn_it_all':
      return <path d="M20 80 Q30 50 40 80 Q50 40 60 80 Q70 50 80 80 M30 30 L50 14 L70 30" {...s} />;
    case 'ash_return':
      return <path d="M50 24 a26 26 0 1 1 -18 7 M32 20 V32 H44 M50 40 V56 L60 62" {...s} />;
    case 'dust_to_dust':
      return <path d="M50 20 L74 30 V52 Q74 70 50 78 Q26 70 26 52 V30 Z M34 60 Q50 52 66 60 M38 68 Q50 62 62 68" {...s} />;
    case 'blood_edge':
    case 'martyr':
      return <path d="M28 72 L66 34 M60 34 H66 V40 M70 24 Q74 30 70 36 Q66 30 70 24 Z M24 78 L32 70" {...s} />;
    case 'blood_rite':
    case 'blood_fury':
      return <path d="M50 20 Q66 44 62 58 Q58 72 50 76 Q42 72 38 58 Q34 44 50 20 Z M30 30 L24 22 M70 30 L76 22" {...s} />;
    case 'leech_bite':
      return <path d="M30 50 Q50 20 70 50 Q50 80 30 50 Z M40 44 L44 56 M50 42 L50 58 M60 44 L56 56" {...s} />;
    case 'blood_pact':
    case 'crimson_mail':
      return <path d="M50 22 L74 32 V52 Q74 70 50 78 Q26 70 26 52 V32 Z M50 36 Q58 48 56 56 Q54 64 50 66 Q46 64 44 56 Q42 48 50 36 Z" {...s} />;
    case 'numb':
      return <path d="M26 50 H40 L46 36 L54 64 L60 50 H74" {...s} />;
    case 'sanguine':
      return <path d="M36 30 H64 L60 70 H40 Z M40 44 H60 M50 20 V30" {...s} />;
    case 'eye_for_eye':
      return <path d="M20 50 Q50 24 80 50 Q50 76 20 50 Z M50 50 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M50 20 L50 28 M50 72 L50 80" {...s} />;
    case 'flex':
    case 'frenzy':
    case 'inflame':
      return <path d="M30 70 L30 50 Q30 34 46 34 Q54 34 56 42 L56 50 M56 50 Q70 46 74 58 Q76 70 64 72 L30 72" {...s} />;
    case 'bone_crusher':
    case 'heavy_blow':
      return <path d="M44 78 L62 22 M54 30 L74 36 L70 48 L50 44 Z M56 26 L78 32" {...s} />;
    case 'overpower':
      return <path d="M50 20 L58 40 L80 44 L63 58 L68 80 L50 68 L32 80 L37 58 L20 44 L42 40 Z" {...s} />;
    case 'demon_heart':
      return <path d="M50 76 Q20 54 24 36 Q30 20 50 32 Q70 20 76 36 Q80 54 50 76 Z M34 24 L40 32 M66 24 L60 32" {...s} />;
    case 'intimidate':
      return <path d="M30 40 Q50 24 70 40 M30 60 Q50 76 70 60 M40 46 L44 54 M60 46 L56 54" {...s} />;
    case 'echo_card':
    case 'double_chant':
    case 'resonance':
      return <path d="M50 50 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M50 50 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 M50 50 m-32 0 a32 32 0 1 0 64 0 a32 32 0 1 0 -64 0" {...s} />;
    case 'echo_blade':
      return <path d="M24 72 L60 36 M54 36 H60 V42 M40 76 L74 42 M68 42 H74 V48" {...s} />;
    case 'mirror':
      return <path d="M50 20 V80 M26 30 L46 40 V66 L26 76 Z M74 30 L54 40 V66 L74 76 Z" {...s} />;
    case 'ash_word':
      return <path d="M26 36 Q50 26 74 36 M30 50 H70 M26 64 Q50 74 74 64" {...s} />;
    case 'aria':
      return <path d="M36 70 a6 6 0 1 0 0.1 0 M60 64 a6 6 0 1 0 0.1 0 M42 70 V30 L66 24 V64 M42 40 L66 34" {...s} />;
    case 'rune_burst':
      return <path d="M50 50 L50 20 M50 50 L76 36 M50 50 L78 62 M50 50 L60 80 M50 50 L40 80 M50 50 L22 62 M50 50 L24 36 M38 50 L62 50 M50 38 L50 62" {...s} />;
    case 'finale':
      return <path d="M30 76 V28 H62 L70 36 V76 Z M62 28 V36 H70 M38 46 H62 M38 56 H58 M38 66 H54" {...s} />;
    case 'rune_shield':
    case 'rune_wall':
      return <path d="M50 20 L74 30 V52 Q74 70 50 80 Q26 70 26 52 V30 Z M40 44 L50 36 L60 44 L50 60 Z M50 60 V68" {...s} />;
    case 'focus':
    case 'erudition':
      return <path d="M50 50 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 M50 50 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M50 18 V28 M50 72 V82 M18 50 H28 M72 50 H82" {...s} />;
    case 'charged_blade':
      return <path d="M28 72 L64 36 M58 36 H64 V42 M70 20 L74 30 L82 24 L78 36" {...s} />;
    case 'meditate':
      return <path d="M50 30 a8 8 0 1 0 0.1 0 M34 72 Q34 54 50 50 Q66 54 66 72 Z M26 76 H74" {...s} />;
    case 'ward_rune':
      return <path d="M30 26 H70 V74 H30 Z M40 36 L60 64 M60 36 L40 64 M50 30 V70" {...s} />;
    case 'ash_equation':
      return <path d="M26 40 H48 M26 52 H48 M56 36 L74 56 M74 36 L56 56 M26 66 H74" {...s} />;
    case 'foresight':
      return <path d="M20 50 Q50 24 80 50 Q50 76 20 50 Z M50 50 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M62 30 L70 22 M66 32 L74 30" {...s} />;
    case 'ash_offering':
      return <path d="M30 78 H70 M36 78 V62 H64 V78 M50 62 V44 M38 44 H62 M50 30 Q46 22 50 16 Q54 22 50 30 M40 36 L46 42 M60 36 L54 42" {...s} />;
    default:
      if (type === 'attack') return <path d="M30 70 L70 30 M62 30 H70 V38" {...s} />;
      if (type === 'power') return <path d="M50 22 L58 42 L80 44 L63 58 L68 80 L50 68 L32 80 L37 58 L20 44 L42 42 Z" {...s} />;
      return <path d="M50 20 L75 30 V52 Q75 70 50 80 Q25 70 25 52 V30 Z" {...s} />;
  }
}

export function CardArt({ id, archetype, type }: { id: string; archetype: Archetype; type: CardType }) {
  const p = PALETTE[archetype];
  const gid = `art-${useId().replace(/:/g, '')}`;
  const art = useArt('cards');
  const style = useCardStyle();
  const bg = art[`art_${archetype}`];
  return (
    <svg viewBox={style === 'ornate' ? '0 0 160 100' : '0 0 100 100'} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g transform={style === 'ornate' ? 'translate(30 0)' : undefined}>
      {bg && <image href={bg} x={style === 'ornate' ? -30 : 0} y="0" width={style === 'ornate' ? 160 : 100} height="100" preserveAspectRatio="xMidYMid slice" />}
      <defs>
        <radialGradient id={gid} cx="50%" cy="55%" r="65%">
          <stop offset="0%" stopColor={p.bg1} />
          <stop offset="100%" stopColor={p.bg2} />
        </radialGradient>
        <filter id={`${gid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect x={style === 'ornate' ? -30 : 0} width={style === 'ornate' ? 160 : 100} height="100" fill={`url(#${gid})`} opacity={bg ? 0.35 : 1} />
      {style === 'ornate' && <g fill="none" stroke={p.fg} opacity=".48" strokeWidth=".65">
        <circle cx="50" cy="50" r="39" /><circle cx="50" cy="50" r="34" strokeDasharray="1 4" />
        <path d="M50 7L54 14L50 21L46 14Z M50 79L54 86L50 93L46 86Z M7 50L14 46L21 50L14 54Z M79 50L86 46L93 50L86 54Z M17 17L28 20L20 28Z M83 17L80 28L72 20Z M17 83L20 72L28 80Z M83 83L72 80L80 72Z" />
      </g>}
      <circle cx="50" cy="52" r="26" fill={p.glow} opacity="0.22" filter={`url(#${gid}-glow)`} />
      <g opacity="0.25" stroke={p.fg} strokeWidth="0.8" fill="none">
        <path d="M0 90 Q25 70 50 90 T100 90" />
        <path d="M0 10 Q25 30 50 10 T100 10" />
      </g>
      <g filter={`url(#${gid}-glow)`} opacity="0.7">
        <Glyph id={id} type={type} fg={p.glow} />
      </g>
      {style === 'ornate' ? <>
        <CardMotif motif={cardMotif(type, CARDS[id]?.effects ?? [])} fg={p.fg} glow={p.glow} dark={p.bg2} />
        <g transform="translate(71 71) scale(.24)"><circle cx="50" cy="50" r="46" fill={p.bg2} stroke={p.fg} strokeWidth="4" /><Glyph id={id} type={type} fg={p.fg} /></g>
      </> : <Glyph id={id} type={type} fg={p.fg} />}
      </g>
    </svg>
  );
}
