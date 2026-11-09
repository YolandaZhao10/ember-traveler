/**
 * 第二章专属素材设计提示词。
 * 独立设计，不使用第一章图片的改色或裁切版本。
 * 敌人交付透明 PNG，导入时转 WebP；背景交付 JPG。
 */
const STYLE = 'Dark fairy-tale hand-painted board-game illustration, fine brush texture, engraved industrial runes, weathered iron, oxidized copper, charcoal, pale ash, small amber molten cores and restrained cold teal accents. Gothic underground foundry, never sci-fi neon, not cartoon or 3D rendering. Clear silhouette at small game size. No text, letters, watermark or frame. Brand-new design, not a recolor of chapter-one art.';
const SPRITE = 'Full body or whole machine, centered with at least 8% empty margin, no cropped head, feet or weapon. Facing LEFT toward the player: head, gaze, nose and attack direction left, side or left three-quarter view. Warm rim light and clear silhouette. Genuine fully transparent background, no checkerboard texture, environment, floor, pedestal or rectangular smoke. Keep smoke close to the body.';
const SCENE = 'Wide landscape, no people or monsters. Low-contrast desaturated distance, small warm distant furnace lights. Quiet negative space so foreground characters and UI remain readable. No giant foreground flames.';

const ENEMIES = {
  slag_tick: 'A low six-legged slag beetle, irregular obsidian and cooled slag armored shell, tiny orange core cracks in its belly, iron pincers pointing left. Not a larva or grub.',
  furnace_drone: 'A squat industrial cast-iron automaton, riveted barrel torso with one circular furnace door, piston legs, one huge hammer arm and one pincer arm, flat steel mask head. No bones or wood.',
  chain_guard: 'A tall thin hollow iron jailer with a long-nosed helmet, heavy chain coiled over one shoulder, a chain hook dragging left and a small shield. Emphasize chains rather than spikes.',
  cinder_stoker: 'A hunched furnace worker with coal-stained face, goggles, black leather apron, thick gloves, backpack coal basket and long fire poker. No cultist robe.',
  soot_seer: 'A tall thin faceless soot diviner with a ceramic respirator mask, layered ash-cloth cloak, slender censer and a little body-bound soot smoke. No purple bishop vestments.',
  iron_hound: 'A lean four-legged mechanical hound, steel ribs, copper geared joints, huge jagged steel lower jaw, left-facing stalking pose, small back boiler. No fur or antlers.',
  forge_knight: 'A broad heavy forging knight with rounded welder mask, thick riveted plate, a little shoulder steam, huge two-handed hammer toward left, copper-red apron and a few blunt spikes. No crown, sword or tower shield.',
  kiln_overseer: 'A tall gaunt industrial foreman with an iron mesh face mask, high metal collar, long leather coat, long red-hot branding iron and chain-ring command rod, stern left-facing pose. No religious staff or accompanying creatures.',
  slag_colossus: 'A huge asymmetric industrial scrap giant made of slag blocks, bent rails and discarded furnace doors, oversized anvil fist, orange cracks, oppressive left-facing pose. Not a stone-wall golem.',
  everburning_core: 'A giant cylindrical living furnace on three mechanical legs, thick concentric iron rings, white-orange burning core, heavy pistons, left-pointing flame nozzle, heavy chains wrapped around its body. Show the whole machine. No bell, clock tower, clocks or background architecture.',
};

const BACKGROUNDS = {
  bg_deep_battle: 'An underground foundry with a wide empty horizontal iron-plate corridor, riveted columns, tiny far furnaces, hanging chains and cooling pipes, cool teal ambient light and copper-orange distant glow. Continuous flat wide floor, empty center and bottom.',
  bg_deep_boss: 'A huge underground reactor hall, empty round foundry platform far back, vault chains, stone arches and steel braces. Wide continuous floor, empty front left and right. No boss figure, bell or throne.',
  bg_deep_map: 'A birdseye hand-painted subterranean foundry city, furnace districts, cooling canals, bridges, elevators, workshops and a distant round core factory. Parchment blue-grey ink and dark copper, low contrast. No icons, nodes, routes or labels.',
  bg_deep_event: 'An underground blacksmith workshop with cooling pool, anvil, tools, slag and copper pipes, a tiny furnace door at rear right, quiet empty center.',
  bg_deep_shop: 'A relic shop in a riveted iron shed, old tool racks, closed boxes, mine lamps, copper parts and fabric curtains, empty left table and center. No merchant or signs.',
  bg_deep_rest: 'An underground shelter platform, small warm brazier, worn bedroll, flask and iron railing, distant quiet blue-grey foundry. Not an open-air ruin campfire.',
  bg_deep_gate: 'A grand underground elevator platform overlooking a layered descending industrial city, steel cables, lamps, chimneys and small furnace glows. Cinematic horizontal composition, dark left and middle for a title and quiet right for UI. No people.',
};

export const chapterTwoArt = {
  chapter2_enemies: Object.entries(ENEMIES).map(([id, subject]) => ({
    id: `enemy_${id}`, prompt: `${STYLE} ${subject} ${SPRITE}`, size: '1024x1024', transparent: true,
  })),
  chapter2_backgrounds: Object.entries(BACKGROUNDS).map(([id, subject]) => ({
    id, prompt: `${STYLE} ${subject} ${SCENE}`, size: '1536x1024', transparent: false,
  })),
};
