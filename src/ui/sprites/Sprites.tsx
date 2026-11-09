/**
 * 手绘风格的 SVG 形象：旅人、怪物、火焰、营火。
 * 所有图形为简单几何拼接，使用统一配色。
 */

const INK = '#1a1411';
const PARCH = '#e8d9b5';
const EMBER = '#ff7a2a';
const EMBER2 = '#ffb347';
const GOLD = '#c9a24a';

export function FlameIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 140" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="fl1" cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor="#fff2c2" />
          <stop offset="40%" stopColor={EMBER2} />
          <stop offset="100%" stopColor="#8a2b12" />
        </radialGradient>
      </defs>
      <path d="M50 130 C20 110 14 80 30 55 C34 70 44 76 50 72 C40 50 50 25 66 10 C62 38 80 48 84 66 C92 95 76 122 50 130 Z" fill="url(#fl1)" />
      <path d="M50 118 C36 108 36 92 46 82 C47 90 52 92 54 90 C48 78 56 66 62 62 C60 76 72 82 72 96 C72 110 62 118 50 118 Z" fill="#fff2c2" opacity="0.85" />
    </svg>
  );
}

export function Campfire({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <ellipse cx="80" cy="140" rx="60" ry="10" fill="#000" opacity="0.4" />
      <path d="M30 130 L130 110" stroke="#5a3a1f" strokeWidth="12" strokeLinecap="round" />
      <path d="M30 110 L130 130" stroke="#6d4a28" strokeWidth="12" strokeLinecap="round" />
      <path d="M80 118 C50 100 46 72 62 50 C66 64 76 70 80 66 C70 44 80 22 96 10 C92 36 110 46 114 62 C122 90 106 114 80 118 Z" fill={EMBER} />
      <path d="M80 108 C66 98 66 84 76 74 C77 82 82 84 84 82 C78 70 86 58 92 54 C90 68 102 74 102 88 C102 100 92 108 80 108 Z" fill="#fff2c2" opacity="0.9" />
      <circle cx="40" cy="60" r="2" fill={EMBER2} />
      <circle cx="120" cy="40" r="2.5" fill={EMBER2} />
      <circle cx="100" cy="20" r="1.5" fill={EMBER2} />
    </svg>
  );
}

export function PlayerSprite({ className, kind = 'traveler' }: { className?: string; kind?: 'traveler' | 'picker' | 'oathbound' | 'scholar' }) {
  if (kind === 'picker') return <PickerSprite className={className} />;
  if (kind === 'oathbound') return <OathboundSprite className={className} />;
  if (kind === 'scholar') return <ScholarSprite className={className} />;
  return (
    <svg viewBox="0 0 160 170" className={className} aria-hidden="true">
      <ellipse cx="80" cy="160" rx="46" ry="8" fill="#000" opacity="0.45" />
      {/* 斗篷 */}
      <path d="M80 30 C50 40 40 80 36 150 L124 150 C120 80 110 40 80 30 Z" fill="#3a2d22" stroke={INK} strokeWidth="3" />
      <path d="M80 36 C62 46 56 80 52 148 L80 150 Z" fill="#4a3a2c" opacity="0.6" />
      {/* 兜帽 */}
      <path d="M80 22 C58 22 48 42 50 62 C60 56 70 54 80 54 C90 54 100 56 110 62 C112 42 102 22 80 22 Z" fill="#4a3a2c" stroke={INK} strokeWidth="3" />
      <path d="M62 60 C66 50 72 46 80 46 C88 46 94 50 98 60 C92 58 86 57 80 57 C74 57 68 58 62 60 Z" fill="#120e0b" />
      <circle cx="73" cy="56" r="2" fill={EMBER2} />
      <circle cx="87" cy="56" r="2" fill={EMBER2} />
      {/* 手与灯 */}
      <path d="M112 90 C126 92 132 104 128 118" stroke="#3a2d22" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M128 118 L128 128" stroke={GOLD} strokeWidth="3" />
      <rect x="116" y="126" width="24" height="28" rx="4" fill="#2b241e" stroke={GOLD} strokeWidth="3" />
      <path d="M128 148 C122 144 122 136 126 132 C127 136 129 136 130 134 C128 130 131 127 133 126 C133 132 136 134 136 140 C136 146 132 148 128 148 Z" fill={EMBER} />
      <circle cx="128" cy="140" r="14" fill={EMBER} opacity="0.25" />
      {/* 腰带 */}
      <path d="M50 108 C70 114 90 114 112 108" stroke={GOLD} strokeWidth="4" fill="none" />
    </svg>
  );
}

function PickerSprite({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 170" className={className} aria-hidden="true">
      <ellipse cx="80" cy="160" rx="46" ry="8" fill="#000" opacity="0.45" />
      {/* 破旧长袍 */}
      <path d="M80 34 C54 44 46 86 40 150 L120 150 C114 86 106 44 80 34 Z" fill="#4a3a3a" stroke={INK} strokeWidth="3" />
      <path d="M60 150 L64 100 L72 150 M88 150 L92 104 L100 150" stroke="#2b1f1f" strokeWidth="3" fill="none" />
      {/* 披巾与面罩 */}
      <path d="M80 26 C60 26 50 44 52 64 C62 58 72 56 80 56 C88 56 98 58 108 64 C110 44 100 26 80 26 Z" fill="#6b4a3a" stroke={INK} strokeWidth="3" />
      <path d="M58 62 C62 54 70 50 80 50 C90 50 98 54 102 62 Z" fill="#120e0b" />
      <path d="M64 66 C72 72 88 72 96 66 L94 76 L66 76 Z" fill="#8a7a62" stroke={INK} strokeWidth="2" />
      <circle cx="72" cy="58" r="2.5" fill="#ffd27a" />
      <circle cx="88" cy="58" r="2.5" fill="#ffd27a" />
      {/* 背囊 */}
      <path d="M40 80 C26 84 24 110 30 128 L48 126 C46 108 48 92 54 82 Z" fill="#5a4a36" stroke={INK} strokeWidth="3" />
      <path d="M30 100 L48 98" stroke="#2b1f1f" strokeWidth="2" />
      {/* 手持铃杖 */}
      <path d="M110 92 C120 96 126 108 124 120" stroke="#4a3a3a" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M126 150 L130 60" stroke="#6d5634" strokeWidth="4" strokeLinecap="round" />
      <path d="M118 60 C118 44 142 44 142 60 L146 66 H114 Z" fill={GOLD} stroke={INK} strokeWidth="3" />
      <circle cx="130" cy="70" r="3" fill={INK} />
      <path d="M126 44 Q130 34 134 44" stroke={EMBER} strokeWidth="3" fill="none" />
      <circle cx="130" cy="56" r="16" fill={EMBER2} opacity="0.18" />
      {/* 腰带与挂饰 */}
      <path d="M48 110 C70 116 90 116 112 110" stroke={GOLD} strokeWidth="4" fill="none" />
      <path d="M70 114 L68 128 M74 114 L74 126" stroke="#d6c391" strokeWidth="2" />
    </svg>
  );
}

function OathboundSprite({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 170" className={className} aria-hidden="true">
      <ellipse cx="80" cy="160" rx="50" ry="8" fill="#000" opacity="0.45" />
      {/* 宽阔躯干与护甲 */}
      <path d="M80 36 C50 44 42 90 38 150 L122 150 C118 90 110 44 80 36 Z" fill="#5a1a22" stroke={INK} strokeWidth="3" />
      <path d="M56 72 L104 72 L100 118 L60 118 Z" fill="#7a2a30" stroke={INK} strokeWidth="2" />
      <path d="M62 84 L98 84 M64 98 L96 98" stroke="#3a0d10" strokeWidth="2" />
      {/* 肩甲 */}
      <path d="M38 70 C34 56 50 50 58 60 L56 78 Z M122 70 C126 56 110 50 102 60 L104 78 Z" fill="#8a3a3a" stroke={INK} strokeWidth="3" />
      {/* 头 */}
      <circle cx="80" cy="40" r="20" fill="#c9a07a" stroke={INK} strokeWidth="3" />
      <path d="M60 36 C64 20 96 20 100 36 L96 30 C88 24 72 24 64 30 Z" fill="#2b1a14" stroke={INK} strokeWidth="2" />
      <path d="M70 40 L76 42 M84 42 L90 40" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M68 48 Q80 54 92 48" stroke="#8a2b22" strokeWidth="3" fill="none" />
      {/* 巨剑 */}
      <path d="M118 150 L140 50" stroke="#9ea4a8" strokeWidth="9" strokeLinecap="round" />
      <path d="M140 50 L146 36" stroke="#cfd6dc" strokeWidth="6" strokeLinecap="round" />
      <path d="M108 112 L132 118" stroke={GOLD} strokeWidth="6" strokeLinecap="round" />
      {/* 血纹 */}
      <path d="M74 118 Q78 128 74 138 M86 118 Q90 130 84 140" stroke="#c2203a" strokeWidth="3" fill="none" />
    </svg>
  );
}

function ScholarSprite({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 170" className={className} aria-hidden="true">
      <ellipse cx="80" cy="160" rx="44" ry="8" fill="#000" opacity="0.45" />
      {/* 长袍 */}
      <path d="M80 34 C56 42 50 90 46 150 L114 150 C110 90 104 42 80 34 Z" fill="#1f3a5a" stroke={INK} strokeWidth="3" />
      <path d="M80 40 C70 60 68 100 66 148 L80 150 Z" fill="#2c4f78" opacity="0.6" />
      <path d="M60 120 H100 M62 134 H98" stroke="#8fd3ff" strokeWidth="1.5" opacity="0.6" />
      {/* 头与眼镜 */}
      <circle cx="80" cy="40" r="18" fill="#e8d9b5" stroke={INK} strokeWidth="3" />
      <path d="M62 34 C66 18 94 18 98 34 C90 28 70 28 62 34 Z" fill="#6b5a4a" stroke={INK} strokeWidth="2" />
      <circle cx="72" cy="42" r="6" fill="none" stroke={GOLD} strokeWidth="2" />
      <circle cx="88" cy="42" r="6" fill="none" stroke={GOLD} strokeWidth="2" />
      <path d="M78 42 H82" stroke={GOLD} strokeWidth="2" />
      <circle cx="72" cy="42" r="2" fill={INK} />
      <circle cx="88" cy="42" r="2" fill={INK} />
      {/* 悬浮书与符文 */}
      <path d="M100 86 L132 80 L134 104 L102 110 Z" fill="#d6c391" stroke={INK} strokeWidth="2" />
      <path d="M106 92 L126 88 M107 99 L127 95" stroke="#6d5634" strokeWidth="1.5" />
      <circle cx="118" cy="70" r="5" fill="#8fd3ff" opacity="0.9" />
      <circle cx="118" cy="70" r="12" fill="#8fd3ff" opacity="0.2" />
      <circle cx="40" cy="96" r="3" fill="#8fd3ff" opacity="0.8" />
      <circle cx="34" cy="112" r="2" fill="#8fd3ff" opacity="0.6" />
      {/* 手 */}
      <path d="M100 100 C92 104 88 112 92 120" stroke="#1f3a5a" strokeWidth="9" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Shadow() {
  return <ellipse cx="80" cy="150" rx="48" ry="8" fill="#000" opacity="0.45" />;
}
function Eyes({ x1, x2, y, color = EMBER2, r = 4 }: { x1: number; x2: number; y: number; color?: string; r?: number }) {
  return (
    <>
      <circle cx={x1} cy={y} r={r} fill={color} />
      <circle cx={x2} cy={y} r={r} fill={color} />
    </>
  );
}

export function EnemySprite({ kind, className }: { kind: string; className?: string }) {
  const stroke = { stroke: INK, strokeWidth: 3 };
  let body: JSX.Element;
  switch (kind) {
    case 'rat':
      body = (
        <>
          <ellipse cx="86" cy="118" rx="42" ry="26" fill="#5a4a3c" {...stroke} />
          <path d="M44 118 C20 110 14 130 20 140" stroke="#5a4a3c" strokeWidth="6" fill="none" strokeLinecap="round" />
          <ellipse cx="118" cy="104" rx="20" ry="16" fill="#6b5a4a" {...stroke} />
          <path d="M112 90 L118 72 L126 90 Z M128 92 L140 78 L142 96 Z" fill="#6b5a4a" {...stroke} />
          <Eyes x1={116} x2={128} y={102} r={3} />
          <path d="M136 108 L146 110" stroke={PARCH} strokeWidth="2" />
        </>
      );
      break;
    case 'puppet':
      body = (
        <>
          <path d="M50 150 L56 80 L104 80 L110 150 Z" fill="#7a6a55" {...stroke} />
          <rect x="60" y="40" width="40" height="44" rx="6" fill="#8a7a62" {...stroke} />
          <path d="M40 90 L30 130 M120 90 L132 130" stroke="#5a4a36" strokeWidth="8" strokeLinecap="round" />
          <path d="M60 60 L100 60 M80 40 L80 20 M60 20 L100 20" stroke="#3a2d22" strokeWidth="2" />
          <Eyes x1={70} x2={90} y={56} color="#c9a24a" r={4} />
          <path d="M66 74 L94 74" stroke="#3a2d22" strokeWidth="3" strokeDasharray="4 4" />
        </>
      );
      break;
    case 'ember':
      body = (
        <>
          <path d="M80 148 C40 126 34 86 56 52 C60 74 74 82 80 76 C66 50 82 22 102 8 C96 44 118 56 122 80 C132 116 110 144 80 148 Z" fill={EMBER} {...stroke} />
          <path d="M80 134 C60 122 60 100 74 86 C76 98 82 100 86 96 C78 80 90 66 98 60 C96 78 112 86 112 104 C112 122 98 134 80 134 Z" fill="#fff2c2" opacity="0.9" />
          <Eyes x1={70} x2={92} y={108} color={INK} r={4} />
        </>
      );
      break;
    case 'spider':
      body = (
        <>
          <path d="M40 110 L20 80 M48 122 L18 120 M112 110 L140 80 M112 122 L142 120 M50 130 L26 150 M110 130 L134 150" stroke="#2b241e" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="80" cy="120" rx="36" ry="26" fill="#3a3028" {...stroke} />
          <circle cx="80" cy="84" r="20" fill="#4a3f36" {...stroke} />
          <path d="M72 100 L68 112 M88 100 L92 112" stroke={PARCH} strokeWidth="3" />
          <Eyes x1={72} x2={88} y={80} color="#c99cff" r={4} />
          <Eyes x1={64} x2={96} y={88} color="#c99cff" r={2.5} />
        </>
      );
      break;
    case 'cultist':
      body = (
        <>
          <path d="M80 30 C50 44 44 96 42 150 L118 150 C116 96 110 44 80 30 Z" fill="#4a2a2a" {...stroke} />
          <path d="M80 22 C60 22 52 40 54 58 C64 52 72 50 80 50 C88 50 96 52 106 58 C108 40 100 22 80 22 Z" fill="#5a3030" {...stroke} />
          <path d="M62 56 C68 48 74 46 80 46 C86 46 92 48 98 56 C90 54 70 54 62 56 Z" fill="#120e0b" />
          <Eyes x1={73} x2={87} y={52} color={EMBER} r={2.5} />
          <path d="M80 80 L80 130 M66 96 L94 96" stroke={GOLD} strokeWidth="3" />
          <circle cx="80" cy="110" r="6" fill={EMBER} opacity="0.8" />
        </>
      );
      break;
    case 'golem':
      body = (
        <>
          <path d="M30 150 L40 100 L60 90 L100 90 L120 100 L130 150 Z" fill="#5a5048" {...stroke} />
          <path d="M50 92 L46 54 L70 40 L94 40 L116 56 L112 92 Z" fill="#6b6058" {...stroke} />
          <path d="M20 110 L34 150 M140 110 L126 150" stroke="#5a5048" strokeWidth="16" strokeLinecap="round" />
          <path d="M60 70 L72 66 M90 66 L102 70 M66 120 L80 110 L96 122" stroke="#3a3028" strokeWidth="3" />
          <Eyes x1={68} x2={96} y={62} color={EMBER} r={4} />
          <circle cx="80" cy="112" r="8" fill={EMBER} opacity="0.5" />
        </>
      );
      break;
    case 'looter':
      body = (
        <>
          <path d="M80 44 C56 52 50 96 48 150 L112 150 C110 96 104 52 80 44 Z" fill="#3a3a44" {...stroke} />
          <circle cx="80" cy="36" r="18" fill="#6b5a4a" {...stroke} />
          <path d="M62 36 L98 36 L96 28 L64 28 Z" fill="#2b241e" />
          <Eyes x1={73} x2={87} y={38} color={PARCH} r={2.5} />
          <path d="M108 90 L140 60" stroke="#9ea4a8" strokeWidth="5" strokeLinecap="round" />
          <path d="M104 94 L112 86" stroke={GOLD} strokeWidth="6" strokeLinecap="round" />
          <circle cx="50" cy="118" r="12" fill="#5a3a1f" {...stroke} />
          <circle cx="50" cy="118" r="4" fill={GOLD} />
        </>
      );
      break;
    case 'crow':
      body = (
        <>
          <path d="M80 70 C44 70 30 96 36 130 C50 122 66 124 80 130 C94 124 110 122 124 130 C130 96 116 70 80 70 Z" fill="#1e1a22" {...stroke} />
          <path d="M36 110 L6 90 L30 86 M124 110 L154 90 L130 86" fill="#1e1a22" {...stroke} />
          <circle cx="80" cy="60" r="16" fill="#2b2530" {...stroke} />
          <path d="M92 60 L112 66 L92 68 Z" fill={GOLD} {...stroke} />
          <Eyes x1={74} x2={84} y={56} color="#c99cff" r={3} />
          <path d="M70 132 L66 150 M90 132 L94 150" stroke={GOLD} strokeWidth="3" />
        </>
      );
      break;
    case 'knight':
      body = (
        <>
          <path d="M80 30 C52 40 46 92 44 150 L116 150 C114 92 108 40 80 30 Z" fill="#4a4a52" {...stroke} />
          <path d="M60 60 L100 60 L96 110 L64 110 Z" fill="#6b6b74" {...stroke} />
          <path d="M80 20 C66 20 60 32 60 46 L100 46 C100 32 94 20 80 20 Z" fill="#5a5a62" {...stroke} />
          <path d="M66 46 L94 46 L92 58 L68 58 Z" fill="#120e0b" />
          <Eyes x1={74} x2={86} y={52} color={EMBER} r={2.5} />
          <path d="M80 10 L80 22 M70 14 L90 14" stroke={GOLD} strokeWidth="3" />
          <path d="M110 70 L150 40 M146 36 L156 48" stroke="#9ea4a8" strokeWidth="6" strokeLinecap="round" />
          <path d="M20 70 L50 70 L50 130 L20 130 Z" fill="#3a3a44" {...stroke} />
          <path d="M28 80 L42 80 L42 120 L28 120 Z" fill={GOLD} opacity="0.5" />
        </>
      );
      break;
    case 'priest':
      body = (
        <>
          <path d="M80 26 C48 44 44 96 40 150 L120 150 C116 96 112 44 80 26 Z" fill="#6a2a1a" {...stroke} />
          <path d="M80 18 C60 18 54 36 56 54 C66 48 74 46 80 46 C86 46 94 48 104 54 C106 36 100 18 80 18 Z" fill="#8a3a1a" {...stroke} />
          <path d="M64 54 C70 46 76 44 80 44 C84 44 90 46 96 54 C88 52 72 52 64 54 Z" fill="#120e0b" />
          <Eyes x1={73} x2={87} y={50} color={EMBER2} r={3} />
          <path d="M80 70 L80 140" stroke={GOLD} strokeWidth="4" />
          <path d="M64 84 L96 84 M70 100 L90 100" stroke={GOLD} strokeWidth="3" />
          <path d="M28 150 C20 130 26 110 34 104 C34 116 40 120 42 118 C38 106 46 96 52 92 C50 106 60 112 60 124 C60 140 46 150 28 150 Z" fill={EMBER} opacity="0.9" />
          <path d="M132 150 C124 130 130 110 138 104 C138 116 144 120 146 118 C142 106 150 96 156 92 C154 106 164 112 164 124 C164 140 150 150 132 150 Z" fill={EMBER} opacity="0.9" transform="translate(-20 0)" />
        </>
      );
      break;
    case 'sentinel':
      body = (
        <>
          <path d="M44 150 L50 70 L110 70 L116 150 Z" fill="#6b6a62" {...stroke} />
          <path d="M56 70 L52 36 L108 36 L104 70 Z" fill="#7a7970" {...stroke} />
          <path d="M52 36 L60 16 L100 16 L108 36 Z" fill="#8a8980" {...stroke} />
          <path d="M30 80 L40 140 M130 80 L120 140" stroke="#6b6a62" strokeWidth="14" strokeLinecap="round" />
          <Eyes x1={70} x2={90} y={52} color="#9ec4e0" r={4} />
          <path d="M66 100 L94 100 M70 118 L90 118" stroke="#3a3a30" strokeWidth="3" />
          <circle cx="80" cy="88" r="6" fill="#9ec4e0" opacity="0.6" />
        </>
      );
      break;
    case 'sovereign':
      body = (
        <>
          <path d="M80 20 C40 36 32 96 28 150 L132 150 C128 96 120 36 80 20 Z" fill="#2b1a14" {...stroke} />
          <path d="M80 28 C62 40 58 90 56 148 L80 150 Z" fill="#4a2a1a" opacity="0.6" />
          <path d="M80 12 C62 12 54 28 56 46 C64 40 72 38 80 38 C88 38 96 40 104 46 C106 28 98 12 80 12 Z" fill="#3a2418" {...stroke} />
          <path d="M60 10 L64 -4 L72 10 L80 -8 L88 10 L96 -4 L100 10 Z" fill={GOLD} {...stroke} transform="translate(0 14)" />
          <path d="M64 46 C70 38 76 36 80 36 C84 36 90 38 96 46 C88 44 72 44 64 46 Z" fill="#050302" />
          <Eyes x1={72} x2={88} y={42} color={EMBER} r={3.5} />
          <path d="M80 70 L80 120 M66 86 L94 86" stroke={GOLD} strokeWidth="4" />
          <circle cx="80" cy="104" r="10" fill={EMBER} opacity="0.85" />
          <circle cx="80" cy="104" r="18" fill={EMBER} opacity="0.25" />
          <path d="M120 70 L150 20 M150 20 L156 36 M150 20 L136 26" stroke={GOLD} strokeWidth="5" strokeLinecap="round" fill="none" />
        </>
      );
      break;
    case 'bat':
      body = (
        <>
          <path d="M80 90 C60 90 50 108 54 126 C64 118 74 118 80 124 C86 118 96 118 106 126 C110 108 100 90 80 90 Z" fill="#2b2030" {...stroke} />
          <path d="M54 110 L14 86 L34 112 L10 118 L50 124 M106 110 L146 86 L126 112 L150 118 L110 124" fill="#2b2030" {...stroke} />
          <circle cx="80" cy="92" r="12" fill="#3a2a40" {...stroke} />
          <path d="M72 82 L70 70 L78 80 M88 82 L90 70 L82 80" fill="#3a2a40" {...stroke} />
          <Eyes x1={75} x2={85} y={92} color="#ff6b7a" r={2.5} />
          <path d="M76 100 L78 106 M84 100 L82 106" stroke={PARCH} strokeWidth="2" />
        </>
      );
      break;
    case 'snail':
      body = (
        <>
          <path d="M30 140 C40 120 80 112 120 124 L130 140 Z" fill="#6b8a4a" {...stroke} />
          <circle cx="92" cy="104" r="34" fill="#7a5a3a" {...stroke} />
          <path d="M92 104 m-22 0 a22 22 0 1 1 44 0 a22 22 0 1 1 -44 0 M92 104 m-10 0 a10 10 0 1 1 20 0" fill="none" stroke="#5a3a1f" strokeWidth="3" />
          <path d="M70 96 Q60 72 72 60 M84 92 Q96 70 92 58" stroke="#8a6d2c" strokeWidth="2" strokeDasharray="3 3" fill="none" />
          <path d="M34 130 C30 110 40 100 52 104 L48 116" fill="#6b8a4a" {...stroke} />
          <path d="M40 104 L34 88 M48 102 L50 86" stroke="#6b8a4a" strokeWidth="4" strokeLinecap="round" />
          <Eyes x1={34} x2={50} y={86} color={PARCH} r={3} />
        </>
      );
      break;
    case 'deacon':
      body = (
        <>
          <path d="M80 26 C46 42 42 96 38 150 L122 150 C118 96 114 42 80 26 Z" fill="#3a2430" {...stroke} />
          <path d="M80 18 C58 18 52 36 54 56 C64 50 72 48 80 48 C88 48 96 50 106 56 C108 36 102 18 80 18 Z" fill="#5a3450" {...stroke} />
          <path d="M64 56 C70 48 76 46 80 46 C84 46 90 48 96 56 C88 54 72 54 64 56 Z" fill="#120e0b" />
          <Eyes x1={73} x2={87} y={52} color="#c99cff" r={3} />
          <path d="M62 80 L98 80 M80 66 L80 132 M70 100 H90" stroke={GOLD} strokeWidth="4" />
          <circle cx="80" cy="100" r="8" fill="#c99cff" opacity="0.7" />
          <path d="M40 90 L22 130 M120 90 L138 130" stroke="#3a2430" strokeWidth="10" strokeLinecap="round" />
        </>
      );
      break;
    case 'hollow':
      body = (
        <>
          <path d="M80 34 C54 44 48 92 46 150 L114 150 C112 92 106 44 80 34 Z" fill="#4a4a52" {...stroke} />
          <path d="M60 64 L100 64 L96 112 L64 112 Z" fill="#5a5a62" {...stroke} />
          <path d="M80 22 C66 22 60 34 60 48 L100 48 C100 34 94 22 80 22 Z" fill="#5a5a62" {...stroke} />
          <path d="M66 48 L94 48 L92 60 L68 60 Z" fill="#050302" />
          <path d="M46 70 L30 56 M50 90 L30 86 M114 70 L130 56 M110 90 L130 86 M60 112 L46 128 M100 112 L114 128 M80 22 L80 8" stroke="#9ea4a8" strokeWidth="3" strokeLinecap="round" />
          <path d="M72 72 L88 72 M70 86 L90 86" stroke="#2b2b30" strokeWidth="2" />
        </>
      );
      break;
    case 'grub':
      body = (
        <>
          <path d="M26 128 C30 100 60 92 90 96 C120 100 136 116 134 136 C110 146 50 146 26 128 Z" fill="#8a4a2a" {...stroke} />
          <path d="M44 112 Q50 134 44 140 M64 104 Q70 132 64 142 M84 102 Q90 132 84 142 M104 106 Q110 132 104 140" stroke="#5a2a12" strokeWidth="3" fill="none" />
          <circle cx="124" cy="112" r="18" fill="#9a5a3a" {...stroke} />
          <Eyes x1={120} x2={132} y={108} color={EMBER2} r={3} />
          <path d="M60 120 Q70 108 80 120 Q90 132 100 120" stroke={EMBER} strokeWidth="4" fill="none" opacity="0.9" />
          <circle cx="80" cy="120" r="16" fill={EMBER} opacity="0.2" />
          <path d="M132 120 L140 128 M134 100 L142 92" stroke="#9a5a3a" strokeWidth="3" />
        </>
      );
      break;
    case 'piper':
      body = (
        <>
          <path d="M80 40 C58 50 52 96 50 150 L110 150 C108 96 102 50 80 40 Z" fill="#3a3a30" {...stroke} />
          <circle cx="80" cy="34" r="16" fill="#e8d9b5" {...stroke} />
          <Eyes x1={74} x2={86} y={32} color={INK} r={3} />
          <path d="M72 42 Q80 46 88 42" stroke={INK} strokeWidth="2" fill="none" />
          <path d="M70 34 Q60 20 66 10 M90 34 Q100 20 94 10" stroke="#e8d9b5" strokeWidth="2" fill="none" />
          <path d="M86 56 L140 28" stroke="#d6c391" strokeWidth="6" strokeLinecap="round" />
          <circle cx="104" cy="47" r="2" fill={INK} />
          <circle cx="114" cy="42" r="2" fill={INK} />
          <circle cx="124" cy="37" r="2" fill={INK} />
          <path d="M142 18 L146 10 M150 24 L158 20" stroke="#c99cff" strokeWidth="3" strokeLinecap="round" />
          <path d="M72 80 L60 70 M60 70 Q50 60 58 52" stroke="#3a3a30" strokeWidth="8" strokeLinecap="round" fill="none" />
        </>
      );
      break;
    case 'taxman':
      body = (
        <>
          <path d="M80 30 C50 44 44 96 42 150 L118 150 C116 96 110 44 80 30 Z" fill="#2a2a3a" {...stroke} />
          <path d="M60 20 H100 L96 36 H64 Z M54 36 H106" fill="#1a1a24" {...stroke} />
          <circle cx="80" cy="46" r="14" fill="#c9c0b0" {...stroke} />
          <Eyes x1={75} x2={85} y={44} color={INK} r={2.5} />
          <path d="M74 52 Q80 50 86 52" stroke={INK} strokeWidth="2" fill="none" />
          <path d="M68 70 L92 70 L96 120 L64 120 Z" fill="#d6c391" {...stroke} />
          <path d="M72 82 H88 M72 92 H88 M72 102 H84" stroke="#5a4a36" strokeWidth="2" />
          <path d="M118 90 L142 70 M142 70 L150 62" stroke="#6d5634" strokeWidth="6" strokeLinecap="round" />
          <circle cx="152" cy="60" r="8" fill={GOLD} {...stroke} />
          <path d="M30 100 Q24 120 34 140" stroke="#2a2a3a" strokeWidth="10" strokeLinecap="round" fill="none" />
          <circle cx="34" cy="142" r="8" fill={GOLD} {...stroke} />
        </>
      );
      break;
    case 'beast':
      body = (
        <>
          <path d="M24 140 C20 100 50 70 90 72 C128 74 148 100 140 140 Z" fill="#4a2a1a" {...stroke} />
          <path d="M40 140 L36 154 M64 140 L62 156 M100 140 L104 156 M126 140 L132 154" stroke="#3a1a0a" strokeWidth="10" strokeLinecap="round" />
          <circle cx="120" cy="80" r="26" fill="#5a3a2a" {...stroke} />
          <path d="M104 60 L96 40 L112 56 M136 60 L144 40 L128 56" fill="#5a3a2a" {...stroke} />
          <Eyes x1={112} x2={130} y={78} color={EMBER} r={4} />
          <path d="M108 96 L112 104 M120 98 L120 106 M132 96 L128 104" stroke={PARCH} strokeWidth="3" />
          <path d="M74 118 Q66 104 74 94 Q76 102 80 100 Q76 88 86 82 Q86 94 92 98 Q98 108 88 118 Z" fill={EMBER} opacity="0.95" />
          <circle cx="82" cy="104" r="20" fill={EMBER} opacity="0.25" />
          <path d="M40 90 Q30 80 36 70" stroke="#4a2a1a" strokeWidth="8" strokeLinecap="round" fill="none" />
        </>
      );
      break;
    case 'bellheart':
      body = (
        <>
          <path d="M30 150 L40 40 L120 40 L130 150 Z" fill="#3a3028" {...stroke} />
          <path d="M40 40 L60 14 L100 14 L120 40 Z" fill="#4a3f36" {...stroke} />
          <circle cx="80" cy="76" r="24" fill="#2b241e" {...stroke} />
          <circle cx="80" cy="76" r="16" fill="none" stroke={GOLD} strokeWidth="3" strokeDasharray="4 4" />
          <circle cx="80" cy="76" r="7" fill={EMBER} />
          <circle cx="80" cy="76" r="30" fill={EMBER} opacity="0.15" />
          <path d="M56 110 C56 96 104 96 104 110 L108 128 H52 Z" fill={GOLD} {...stroke} />
          <circle cx="80" cy="134" r="5" fill={INK} />
          <circle cx="48" cy="56" r="10" fill="none" stroke="#9ea4a8" strokeWidth="4" strokeDasharray="3 3" />
          <circle cx="114" cy="54" r="12" fill="none" stroke="#9ea4a8" strokeWidth="4" strokeDasharray="3 3" />
          <path d="M20 90 L34 100 M140 90 L126 100" stroke="#9ea4a8" strokeWidth="6" strokeLinecap="round" />
          <Eyes x1={70} x2={90} y={30} color={EMBER2} r={3} />
        </>
      );
      break;
    default:
      body = <circle cx="80" cy="100" r="40" fill="#555" {...stroke} />;
  }
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <Shadow />
      {body}
    </svg>
  );
}
