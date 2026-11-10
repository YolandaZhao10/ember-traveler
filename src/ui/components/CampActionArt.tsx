/** 营火选项的装饰画，不参与点击、布局之外的状态或规则。 */
export function CampActionArt({ kind }: { kind: 'rest' | 'forge' | 'refine' }) {
  return <svg className="camp-action-art" viewBox="0 0 220 100" aria-hidden="true" focusable="false">
    <ellipse cx="110" cy="85" rx="75" ry="8" fill="#100f12" opacity=".7" />
    <path d="M18 77 38 32 61 66 82 24 113 69 149 34 181 66 202 43" fill="none" stroke="#8d6143" opacity=".22" />
    {kind === 'rest' ? <>
      <path d="M48 79 101 22 153 79Z" fill="#554534" stroke="#c5a478" strokeWidth="2" />
      <path d="M101 22 113 79H70Z" fill="#29272a" stroke="#a48356" />
      <path d="m101 22 6 57M48 79l-14 8m119-8 14 8" stroke="#d0ab72" strokeWidth="1.5" />
      <path d="M77 75q18-13 31 0v7H77Z" fill="#8b573b" />
      <path d="M164 72V47q0-15 12-15" fill="none" stroke="#b89462" strokeWidth="3" />
      <path d="M157 50h15l4 23h-23Z" fill="#d28740" stroke="#e1bb79" />
      <path d="M164 55v13" stroke="#ffe7a9" strokeWidth="3" />
      <circle cx="164" cy="62" r="19" fill="#ffb149" opacity=".1" />
    </> : kind === 'forge' ? <>
      <path d="M66 57h99l-20 13h-18v9h12v7H89v-7h11V67H79Z" fill="#50545c" stroke="#b5a7a0" strokeWidth="2" />
      <path d="m93 27 12-12 25 25-12 12Z" fill="#857a70" stroke="#dbc5a2" strokeWidth="2" />
      <path d="m113 47-23 25" stroke="#b98252" strokeWidth="7" />
      <path d="m56 81 18-8m-20-1 20 9" stroke="#8a5534" strokeWidth="5" />
      <path d="M55 72q-10-14 3-21-1 11 8 8 3-12 7-20 14 24-3 34Z" fill="#dd7136" />
      <path d="M59 71q-3-9 4-13l5 12Z" fill="#f6c86a" />
      <path className="camp-art-sparks" d="m132 44 4-7m7 15 8-2m-20-19 2-5m-55 9-2-5" stroke="#efbd6c" strokeWidth="2" />
    </> : <>
      <g transform="rotate(-13 94 53)"><rect x="67" y="22" width="41" height="58" rx="4" fill="#3e454b" stroke="#b49b6a" strokeWidth="2" /><path d="M74 29h27v35H74Z" fill="none" stroke="#7c8d8f" /><path d="m81 56 14-19m-14 7 14 10" stroke="#d2c4a0" strokeWidth="2" /></g>
      <g transform="rotate(12 126 56)"><rect x="108" y="28" width="41" height="58" rx="4" fill="#684132" stroke="#d7a66e" strokeWidth="2" /><path d="m115 41 24 32m-24 0 24-32" stroke="#a77f5b" /><path d="M112 32h32v47h-32Z" fill="none" stroke="#b88b60" /></g>
      <path d="M144 86q-16-14-5-32 0 12 8 16 10-12 6-25 23 24 11 41Z" fill="#d46d38" />
      <path d="M148 85q-8-8 1-15 1 6 7 5 4 6 0 10Z" fill="#f4c374" />
      <path className="camp-art-sparks" d="m158 31 2-7m8 25 4-3m-32-6-2-6" stroke="#e6b26a" strokeWidth="2" />
    </>}
    <path d="M25 92h65m40 0h65m-85-3 3 3-3 3-3-3Z" fill="none" stroke="#b18b54" opacity=".65" />
  </svg>;
}
