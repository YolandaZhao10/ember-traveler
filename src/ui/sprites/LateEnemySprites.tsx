/** 后三章简易形象，按体型与章节着色；保留武器、轮廓及朝左姿态。 */
const kinds: Record<string, [string, string]> = {
  slag_tick: ['bug', '#bb7654'], furnace_drone: ['golem', '#839692'], chain_guard: ['guard', '#8dada9'],
  cinder_stoker: ['mage', '#ca824d'], soot_seer: ['mage', '#ad86a3'], iron_hound: ['hound', '#9aa6a5'],
  forge_knight: ['guard', '#d88853'], kiln_overseer: ['mage', '#b4a071'], slag_colossus: ['golem', '#c87e4a'], everburning_core: ['core', '#ff9c53'],
  star_moth: ['moth', '#b8abd5'], glass_wisp: ['crystal', '#a8d9ed'], astral_sentinel: ['guard', '#97baca'],
  wind_scribe: ['mage', '#a6b8df'], comet_hound: ['hound', '#bfb0e1'], star_pilgrim: ['golem', '#a89cbb'],
  moon_duelist: ['guard', '#cab8df'], orrery_keeper: ['mage', '#c1afd7'], shattered_titan: ['golem', '#9da4ce'], eclipse_archon: ['lord', '#ba9ed6'],
  last_warden: ['guard', '#bda57e'], nightless_lord: ['lord', '#d7a376'],
};
export function lateEnemyBody(kind: string): JSX.Element | undefined {
  const entry = kinds[kind]; if (!entry) return;
  const [shape, color] = entry;
  return <g stroke="#18151d" strokeWidth="3" strokeLinejoin="round" fill={color}>
    {shape === 'guard' && <>
      <path d="M68 62L106 65L117 112L106 145L88 145L86 112L73 145L54 145L62 107Z M57 23L91 17L111 39L95 66L60 59Z" />
      <path d="M58 39H86L81 51H54Z" fill="#201c26" /><path d="M59 43H72" stroke="#ffe4ac" />
      <path d="M60 73L31 69L27 109L48 125L65 108Z" fill="#35333f" /><path d="M47 78V111M34 93H58" stroke={color} />
      <path d="M107 73L128 98M122 104L141 36M131 33L146 33L143 59" fill="none" stroke={color} strokeWidth="7" />
      <path d="M91 26L96 7L109 29" fill="#dcd0b4" />
    </>}
    {shape === 'mage' && <>
      <path d="M79 39Q42 67 47 143L114 143Q120 81 100 49Z" fill="#34313f" /><path d="M56 59Q42 20 74 18Q104 18 109 56L78 72Z" />
      <path d="M51 46L78 41L88 60L56 61Z" fill="#191922" /><path d="M56 51H68" stroke="#e7dcff" />
      <path d="M64 83L24 80L30 111L66 117Z" fill="#e4d5ba" /><path d="M32 88L56 94M34 96L57 102" stroke="#6c5860" />
      <path d="M112 142V47" stroke={color} strokeWidth="6" /><circle cx="112" cy="39" r="13" fill="none" stroke={color} /><path d="M112 28L117 39L112 50L106 39Z" />
    </>}
    {shape === 'golem' && <>
      <path d="M42 62L67 47L105 54L125 92L110 122L53 121L32 91Z M49 121L44 147H66L77 120M93 120L100 148H122L114 118" />
      <path d="M48 28L88 18L111 44L85 68L45 54Z" /><path d="M48 39L77 35L69 46L43 49Z" fill="#251f2a" /><path d="M51 41L64 40" stroke="#ffe4ac" />
      <path d="M43 69L19 78L15 110L36 112M114 70L139 82L144 114L124 118" />
      <path d="M83 62L69 86L89 96L76 116" fill="none" stroke="#fff0c2" />
    </>}
    {shape === 'hound' && <>
      <path d="M43 83Q94 59 123 90L133 122L107 130L96 111L58 117L49 139L30 139L29 107Z" />
      <path d="M53 69L27 57L16 93L33 112L65 98Z M31 64L29 42L47 66M117 89Q149 65 145 43" /><path d="M20 86L36 82" stroke="#fff0c2" />
      <path d="M20 97L39 100L32 108Z" fill="#211d28" /><path d="M66 76L73 60L82 73L94 56L100 77" fill="#ddd7ed" />
    </>}
    {shape === 'moth' && <>
      <path d="M74 76Q42 13 14 41Q9 76 60 101Q9 90 28 133Q61 144 78 98M83 75Q110 18 143 40Q149 78 96 101Q145 92 129 131Q98 145 81 98" />
      <path d="M48 54L61 80L33 71Z M114 54L101 80L131 71Z" fill="#49405d" /><ellipse cx="79" cy="86" rx="9" ry="32" fill="#4b4557" /><path d="M77 56L62 38M83 56L95 38" fill="none" />
    </>}
    {shape === 'bug' && <>
      <ellipse cx="87" cy="105" rx="45" ry="28" /><path d="M48 89L21 78M48 110L18 116M70 127L57 147M104 126L119 146M125 100L146 86" fill="none" stroke={color} strokeWidth="7" /><circle cx="44" cy="99" r="21" /><path d="M26 94L38 91" stroke="#ffda89" /><path d="M70 80L81 100L105 82M80 103L76 128" fill="none" />
    </>}
    {(shape === 'crystal' || shape === 'core') && <>
      <circle cx="80" cy="82" r="48" fill="none" stroke={color} strokeWidth="6" strokeDasharray="15 6" /><path d="M80 23L112 64L100 112L78 139L48 106L44 62Z" /><path d="M80 23L69 68L80 110L112 64M44 62L69 68L48 106M80 110L78 139" fill="none" /><circle cx="76" cy="81" r="13" fill="#fff0bf" />
    </>}
    {shape === 'lord' && <>
      <path d="M71 58L108 60L138 147L28 147L47 82Z" fill="#37303f" /><path d="M52 24L88 20L108 45L87 72L56 60Z" /><path d="M53 25L44 5L64 18L75 2L84 19L108 9L101 33Z" /><path d="M53 42L82 40L72 53L50 52Z" fill="#19151e" /><path d="M56 45H69" stroke="#ffe1a3" />
      <path d="M61 75L86 86L101 67L111 123L81 140L51 121Z" /><path d="M83 83V133M54 98L104 103" fill="none" stroke="#e4c997" /><path d="M45 80L22 106M22 106L15 30L31 57L29 111" fill="none" stroke={color} strokeWidth="6" /><circle cx="94" cy="48" r="43" fill="none" stroke={color} strokeWidth="2" strokeDasharray="5 7" />
    </>}
  </g>;
}
