#!/usr/bin/env node
/**
 * 通过可配置的图片生成接口批量生成游戏贴图。
 *
 * 用法：
 *   node scripts/gen-art.mjs                                 # 生成全部缺失的图
 *   node scripts/gen-art.mjs --only characters,backgrounds    # 只生成某几类
 *   node scripts/gen-art.mjs --force                          # 覆盖已有文件
 *   node scripts/gen-art.mjs --dry                            # 只打印将要生成的清单
 *   node scripts/gen-art.mjs --manifest-only                  # 仅登记已有贴图，无需密钥
 *
 * 接口配置：IMAGE_API_URL、IMAGE_MODEL、IMAGE_API_KEY，优先读取环境变量，其次 .env.local。
 * 脚本不会打印密钥。输出到 public/art/，并写入 public/art/manifest.json 供游戏加载。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chapterTwoArt } from './chapter-two-art.mjs';
import { laterChapterArt } from './later-chapter-art.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'art');
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};

function loadSetting(name) {
  if (process.env[name]) return process.env[name];
  const envFile = join(root, '.env.local');
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*"?([^"\\n]+)"?`, 'm'));
    if (m) return m[1].trim();
  }
  return null;
}

const STYLE =
  'Dark fairy-tale hand-painted board game illustration, charcoal black, aged parchment, dark gold and ember orange palette, soft firelight, engraved rune motifs, visible brush texture, painterly, high detail, no text, no watermark, no letters.';
const SPRITE = 'Full body, centered, facing slightly left toward the viewer, isolated on a fully transparent background, nothing else in frame.';

const CHARACTERS = {
  traveler: 'A lone hooded traveler in a worn dark brown cloak carrying a small iron lantern with a glowing ember flame, gold belt, calm and determined.',
  picker: 'An ash picker: a lean scavenger in a patched dark-red robe with a cloth face mask, a bulging leather satchel, holding a staff topped with a small brass bell that glows faintly with ember light.',
  oathbound: 'An oathbound warrior: a broad-shouldered fighter in dark crimson plate with blood-red rune lines glowing on the armor, a huge greatsword resting on the shoulder, short dark hair, fierce expression.',
  scholar: 'An ash scholar: a slender young scholar in a deep-blue hooded robe with round gold spectacles, a floating open book and glowing blue runic sigils orbiting one hand.',
};

const ENEMIES = {
  rat: 'A swarm-type ash rat, oversized, grey-brown fur dusted with ash, glowing orange eyes, snarling.',
  puppet: 'A tomb puppet guardian made of bones, old rope and wooden planks, hollow glowing gold eyes, lurching.',
  ember: 'A stray ember spirit: a living flame creature with a soft white-hot core and two dark eye sockets, trailing sparks.',
  spider: 'A bone spider the size of a dog, pale chitin and bone plates, purple glowing eyes, venom dripping fangs.',
  cultist: 'An ash cultist in a tattered dark red robe, face hidden in shadow, holding a ritual knife, an ember glowing at the chest.',
  golem: 'A rubble golem assembled from broken grey stone blocks of an old city, an ember glowing in its chest cavity, massive fists.',
  looter: 'A looter: a wiry human bandit in dark grey leathers and a hood, a short knife and a small money pouch, sly grin.',
  crow: 'A shade crow, a large black bird with ragged shadowy feathers, violet glowing eyes, gold beak, wings spread.',
  knight: 'An ash knight: a tall armored knight in blackened grey plate with a gold crown emblem, tower shield and longsword, red eyes glowing inside the helm.',
  priest: 'A pyre priest in a burnt orange and crimson robe, holding a golden staff, flames licking from the sleeves, eyes glowing gold.',
  sentinel: 'A stone sentinel statue guardian, blocky grey granite body, carved runes glowing blue, heavy stone fists.',
  sovereign: 'The Ash Sovereign, final boss: a towering regal figure in a black and gold ceremonial robe, a gold crown, a hollow face with two burning ember eyes, a huge glowing ember in the chest, holding a gold scepter.',
  bat: 'An ash bat with ragged dark wings, pale red eyes, tiny fangs, mid-flight.',
  snail: 'A rust snail: a large snail with a rusted iron spiral shell, olive green body, dripping acid, two eye stalks.',
  deacon: 'An ash deacon: a tall robed cult leader in dark purple and gold vestments, holding a glowing violet censer, face hidden under a hood.',
  hollow: 'A hollow guard: an empty suit of spiked grey armor standing upright with nobody inside, dark void in the helmet, iron spikes on shoulders and gauntlets.',
  grub: 'An ember grub: a fat segmented larva with cracked dark red skin, molten orange light glowing through the cracks, small mandibles.',
  piper: 'A bone piper: a gaunt skeletal musician in a ragged dark coat, playing a long flute carved from bone, purple musical notes shimmering.',
  taxman: 'An ash taxman: a stern undead official in a black top hat and dark coat, carrying a heavy ledger and a bag of gold coins, cold grey face.',
  beast: 'A pyre beast: a large four-legged predator with dark burnt fur, horns, a burning fire visible inside its ribcage, glowing orange eyes.',
  bellheart: 'The Heart of the Belltower, boss: a huge clockwork mechanism shaped like a bell tower core, brass gears and a great golden bell, an ember core glowing in the center, cracked stone casing.',
};

const BACKGROUNDS = {
  bg_title: 'A wide landscape of an ancient city buried in grey ash under a dark sky, ruined towers and arches, one small warm lantern light glowing on a path, distant orange glow on the horizon.',
  bg_battle: 'A ruined ash-covered street in an ancient city at night, broken stone arches and leaning columns on both sides, a clear open cobblestone ground in the middle, soft ember glow and drifting ash particles, moody and atmospheric, wide composition, empty of people.',
  bg_boss: 'A vast dark throne hall of an ancient palace filled with ash, cracked gold pillars, a huge empty throne in the background lit by ember light, drifting sparks, wide composition, empty of people.',
  bg_map: 'A top-down painted parchment map of a ruined ancient city in ash, winding streets, ruined districts, a great tower at the top, drawn in ink and dark gold on aged parchment, soft vignette, no text, no labels.',
  bg_event: 'A quiet ash-covered courtyard at night with an old stone well, dead trees and a flickering candle, painterly, wide composition, empty of people.',
  bg_shop: 'A merchant\'s covered cart in a ruined ash city alley at night, hanging lanterns with warm light, shelves of odd relics and cards, wide composition, empty of people.',
  bg_rest: 'A small campfire among the ruins of an ancient city at night, warm firelight on broken stone walls, sparks rising, a bedroll beside the fire, wide composition, empty of people.',
};

const ARCHETYPES = {
  art_basic: 'An abstract painterly texture of parchment and charcoal with a faint gold rune, soft and neutral.',
  art_combo: 'An abstract painterly motif of three crossed blades in motion with crimson and gold speed trails on dark background.',
  art_bulwark: 'An abstract painterly motif of an old iron shield with gold rim and blue glow on dark stone background.',
  art_ember: 'An abstract painterly motif of glowing orange embers and sparks rising from dark ash.',
  art_cinder: 'An abstract painterly motif of wild red fire consuming dry grass and bones on a dark background.',
  art_ash: 'An abstract painterly motif of grey ash and burnt paper pages crumbling, pale light.',
  art_blood: 'An abstract painterly motif of dark crimson blood drops and a cracked red rune on dark background.',
  art_might: 'An abstract painterly motif of a clenched armored fist surrounded by golden energy on a dark background.',
  art_echo: 'An abstract painterly motif of concentric glowing blue sound rings over dark stone.',
  art_focus: 'An abstract painterly motif of a glowing green rune circle with an eye at the center on a dark background.',
  art_curse: 'An abstract painterly motif of grey smoke and a dark broken rune, lifeless.',
};

const groups = {
  ...chapterTwoArt,
  ...laterChapterArt,
  characters: Object.entries(CHARACTERS).map(([id, p]) => ({ id: `char_${id}`, prompt: `${STYLE} ${p} ${SPRITE}`, size: '1024x1024', transparent: true })),
  enemies: Object.entries(ENEMIES).map(([id, p]) => ({ id: `enemy_${id}`, prompt: `${STYLE} ${p} ${SPRITE} Monster design for a card game.`, size: '1024x1024', transparent: true })),
  backgrounds: Object.entries(BACKGROUNDS).map(([id, p]) => ({ id, prompt: `${STYLE} ${p}`, size: '1536x1024', transparent: false })),
  archetypes: Object.entries(ARCHETYPES).map(([id, p]) => ({ id, prompt: `${STYLE} ${p} Square card illustration, no border, no frame.`, size: '1024x1024', transparent: false })),
};

const only = opt('--only')?.split(',') ?? Object.keys(groups);
const force = flag('--force');
const dry = flag('--dry');
const quality = opt('--quality') ?? 'medium';
const tasks = only.flatMap((g) => groups[g] ?? []);

function outPath(t) {
  return join(outDir, `${t.id}.${t.transparent ? 'webp' : 'jpg'}`);
}

async function generate(config, t) {
  const body = {
    model: config.model,
    prompt: t.prompt,
    size: t.size,
    quality,
    n: 1,
    output_format: t.transparent ? 'webp' : 'jpeg',
    output_compression: t.transparent ? 85 : 88,
  };
  if (t.transparent) body.background = 'transparent';
  const res = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${t.id}: HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${t.id}: 响应中没有图片数据`);
  writeFileSync(outPath(t), Buffer.from(b64, 'base64'));
}

function writeManifest() {
  const files = readdirSync(outDir).filter((f) => /\.(webp|png|jpg|jpeg)$/i.test(f));
  const manifest = {};
  for (const f of files) manifest[f.replace(/\.[^.]+$/, '')] = `art/${f}`;
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return Object.keys(manifest).length;
}

async function main() {
  if (flag('--manifest-only')) {
    console.log(`manifest 包含 ${writeManifest()} 张图`);
    return;
  }
  const pending = tasks.filter((t) => force || !existsSync(outPath(t)));
  console.log(`共 ${tasks.length} 张，需生成 ${pending.length} 张（质量 ${quality}）`);
  if (dry) {
    for (const t of pending) console.log(`- ${t.id} [${t.size}${t.transparent ? ', 透明' : ''}]`);
    return;
  }
  if (!pending.length) {
    console.log(`manifest 包含 ${writeManifest()} 张图`);
    return;
  }
  const config = { key: loadSetting('IMAGE_API_KEY'), model: loadSetting('IMAGE_MODEL'), url: loadSetting('IMAGE_API_URL') };
  if (!config.key || !config.model || !config.url) {
    console.error('请配置 IMAGE_API_URL、IMAGE_MODEL 和 IMAGE_API_KEY（环境变量或 .env.local）。');
    process.exit(1);
  }
  let done = 0;
  let failed = 0;
  const concurrency = 3;
  const queue = pending.slice();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const t = queue.shift();
        try {
          await generate(config, t);
          done++;
          console.log(`✓ ${t.id} (${done}/${pending.length})`);
          writeManifest();
        } catch (e) {
          failed++;
          console.error(`✗ ${e.message}`);
        }
      }
    }),
  );
  console.log(`完成：成功 ${done}，失败 ${failed}；manifest 包含 ${writeManifest()} 张图`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
