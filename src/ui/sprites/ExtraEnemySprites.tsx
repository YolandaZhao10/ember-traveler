/** 新普通敌人的独立轮廓；朝左，配色分别对应古城、熔炉、星骸。 */
export function extraEnemyBody(kind: string): JSX.Element | undefined {
  const edge = { stroke: '#1b1820', strokeWidth: 3, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'ash_crossbow': return <g {...edge}>
      <path d="M62 78L109 72L127 142L94 148L78 112L59 143L38 140Z" fill="#67584c" />
      <path d="M58 73Q38 34 66 25Q95 20 99 62L77 78Z" fill="#93846c" />
      <path d="M47 52L70 47L78 66L49 68Z" fill="#30272a" />
      <path d="M49 54L60 53" stroke="#ffc782" strokeWidth="4" />
      <path d="M47 92L113 98M44 70Q12 94 43 120M43 70L43 120" fill="none" stroke="#c4a175" strokeWidth="6" />
      <path d="M13 94L76 94M13 94L24 89M13 94L24 100" fill="none" stroke="#dad4c4" />
      <path d="M90 78L76 103L55 104" fill="none" stroke="#a38f77" strokeWidth="13" />
      <path d="M115 50L132 56L116 111L105 107Z" fill="#453b32" />
    </g>;
    case 'ash_duelist': return <g {...edge}>
      <path d="M72 68L107 77L125 132L91 118L76 149L57 145L62 104L39 133Z" fill="#5a6470" />
      <path d="M63 39L91 31L109 54L85 75L59 65Z" fill="#a1a7a5" />
      <path d="M58 51L83 49L82 61L60 61Z" fill="#26252a" /><path d="M61 55L73 55" stroke="#ffd18a" />
      <path d="M81 81L51 101L35 90" fill="none" stroke="#939a9c" strokeWidth="10" />
      <path d="M29 99L17 31L36 82L42 102Z" fill="#d7d5c6" /><path d="M19 98L47 94" stroke="#c29d66" strokeWidth="5" />
      <path d="M98 91L131 109L123 124" fill="none" stroke="#788592" strokeWidth="10" />
      <path d="M122 118L147 76L132 125Z" fill="#babec6" />
      <path d="M74 68L111 73L123 96L98 92Z" fill="#80654c" />
    </g>;
    case 'grave_lamplighter': return <g {...edge}>
      <path d="M63 66Q104 65 110 90L130 149L43 148L55 102Z" fill="#605a49" />
      <path d="M60 71Q43 40 62 27Q94 18 107 65L85 77Z" fill="#8a8068" />
      <path d="M51 51L76 45L77 64L55 66Z" fill="#2a2924" /><path d="M56 54L64 53" stroke="#ffdb88" strokeWidth="4" />
      <path d="M82 88L55 103L30 95M38 41L35 149" fill="none" stroke="#aa9070" strokeWidth="7" />
      <path d="M23 58L47 57L51 87L20 87Z" fill="#e0ac50" /><path d="M27 62L43 61L43 81L27 81Z" fill="#fff2b1" strokeWidth="1" />
      <path d="M31 58L30 48L41 48L41 58M73 109L79 145M96 100L110 143" fill="none" stroke="#b09f76" />
      <circle cx="36" cy="73" r="25" fill="#ffcb65" stroke="none" opacity=".13" />
    </g>;
    case 'pressure_boiler': return <g {...edge}>
      <path d="M45 124L33 146L56 149L70 126M102 126L111 147L135 148L123 122" fill="#526675" />
      <rect x="44" y="52" width="79" height="79" rx="24" fill="#697b80" /><path d="M43 74H124M43 109H124" stroke="#b28b5a" strokeWidth="7" />
      <path d="M47 85H21V69H7V99H45" fill="#829ba1" /><path d="M97 52V32H114V53" fill="#8e7b64" />
      <circle cx="80" cy="46" r="19" fill="#d5c4a0" /><path d="M80 46L89 35" stroke="#c84824" strokeWidth="4" />
      <rect x="69" y="86" width="35" height="17" rx="3" fill="#2b3439" /><path d="M73 92H96" stroke="#ffbd66" strokeWidth="4" />
      <path d="M105 28Q89 16 103 8M18 65Q7 54 19 44" fill="none" stroke="#c3d6d6" strokeWidth="5" opacity=".7" />
    </g>;
    case 'quench_smith': return <g {...edge}>
      <path d="M63 76L105 74L118 122L104 149L84 149L83 121L63 149L42 146L58 109Z" fill="#55636b" />
      <path d="M52 42L92 32L110 62L76 82L50 68Z" fill="#7b9297" /><path d="M47 53L82 50L80 65L50 68Z" fill="#2e373b" />
      <path d="M55 57H72" stroke="#ffbf67" strokeWidth="5" /><path d="M65 78L104 76L114 125L62 127Z" fill="#a47950" />
      <path d="M64 91L36 112M32 68L40 133" stroke="#a4afb2" strokeWidth="10" />
      <path d="M13 60L49 56L53 80L17 84Z" fill="#6c8890" />
      <path d="M109 94L134 104L129 117" fill="none" stroke="#718a90" strokeWidth="10" />
      <path d="M116 111L147 111L139 142L124 142Z" fill="#568e9a" /><path d="M121 119H141" stroke="#a1d8dc" />
    </g>;
    case 'slag_saw': return <g {...edge}>
      <path d="M47 93L102 75L140 110L129 139L54 142Z" fill="#657b82" />
      <path d="M58 110L117 99L128 126L67 134Z" fill="#a5794c" />
      <path d="M45 29L56 45L74 39L76 60L94 70L80 86L88 104L67 108L61 127L44 115L26 122L21 102L4 93L17 77L10 58L31 54Z" fill="#afbec2" />
      <circle cx="48" cy="79" r="24" fill="#4e6872" /><circle cx="48" cy="79" r="10" fill="#e49845" />
      <circle cx="78" cy="139" r="14" fill="#283940" /><circle cx="123" cy="137" r="14" fill="#283940" />
      <path d="M92 83V56H109V88" fill="#6b817f" /><path d="M98 59L129 71" stroke="#a2b4b8" strokeWidth="7" />
      <path d="M75 115L93 109" stroke="#ffd17f" strokeWidth="5" />
    </g>;
    case 'sealed_archivist': return <g {...edge}>
      <path d="M64 68L105 67L129 144L49 149L55 103Z" fill="#61577f" />
      <path d="M59 31L96 24L109 61L78 79L54 61Z" fill="#9b90b3" /><path d="M53 50L82 46L79 62L56 66Z" fill="#292338" />
      <path d="M59 54L70 53" stroke="#cceaff" strokeWidth="4" />
      <path d="M19 78L52 70L77 82L78 126L48 117L18 124Z" fill="#c4b5a2" />
      <path d="M49 75L48 116M26 87L40 82M26 99L40 95M58 88L70 93M57 100L70 105" fill="none" stroke="#6a6382" />
      <path d="M21 101L77 101" stroke="#9eb9c9" strokeWidth="5" /><rect x="42" y="96" width="15" height="17" rx="2" fill="#a38cd2" />
      <path d="M97 88L124 108L138 78" fill="none" stroke="#9b90b3" strokeWidth="10" /><path d="M137 80L136 37L148 70Z" fill="#d8d9ed" />
    </g>;
    case 'phase_lancer': return <g {...edge}>
      <path d="M70 68L108 73L123 141L104 149L88 110L62 143L42 139L61 102Z" fill="#576a8e" />
      <path d="M65 28L100 34L107 62L76 76L54 59Z" fill="#a0bad6" /><path d="M53 49L84 47L76 59L56 61Z" fill="#2a3149" />
      <path d="M58 52L70 51" stroke="#d8f7ff" strokeWidth="4" />
      <path d="M71 83L52 96L96 95" fill="none" stroke="#a0bad6" strokeWidth="12" />
      <path d="M20 89L140 102" stroke="#8db9de" strokeWidth="7" /><path d="M4 87L34 73L27 91L33 108Z" fill="#d6f8ff" />
      <path d="M102 76L142 110L133 145L107 125" fill="#6b4b9d" opacity=".8" />
      <ellipse cx="28" cy="91" rx="13" ry="36" fill="none" stroke="#bb92ff" strokeWidth="2" strokeDasharray="6 6" />
    </g>;
    case 'orbit_gambler': return <g {...edge}>
      <path d="M67 76L105 72L125 144L46 147L55 109Z" fill="#5d5483" />
      <path d="M65 38L96 31L107 66L78 77L56 61Z" fill="#a4a4c2" /><path d="M54 51L79 47L77 63L56 65Z" fill="#2a2947" />
      <path d="M58 55L68 54" stroke="#f1d6ff" strokeWidth="4" />
      <path d="M46 33L111 29L95 14L74 24L56 16Z" fill="#77669d" />
      <path d="M69 87L43 103L23 88M102 84L126 98L137 82" fill="none" stroke="#a9a0c3" strokeWidth="11" />
      <ellipse cx="81" cy="112" rx="68" ry="20" fill="none" stroke="#a5bfed" strokeWidth="2" />
      <path d="M14 75L26 59L37 76L26 87ZM119 62L130 48L142 63L131 75Z" fill="#d8c5fa" />
      <path d="M61 118L79 106L95 120L78 135Z" fill="#a7d2e6" /><circle cx="78" cy="120" r="4" fill="#51406b" />
    </g>;
  }
}
