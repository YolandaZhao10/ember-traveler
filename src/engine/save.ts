import { ensureRewardCheckpoint, resumeFinalVictory, resumeLegacyVictory, SAVE_VERSION } from './run';
import type { RunState } from './types';
import { CHAPTERS, FLOORS_PER_CHAPTER } from '../data/chapters';
import { normalizeDifficulty } from '../data/difficulty';
import { expandLegacyRoutes } from './map';
import { recordJourney } from './history';
import { ensurePowerInstances } from './powers';
import { ENEMIES } from '../data/enemies';
import { ensureEncounterPlan } from './encounters';
import { BLOCK_MAX } from './constants';

type Snapshot = NonNullable<RunState['checkpoint']>;

/** 保留旧节点和已发生的选择；新增路段连接在旧首领之前，不消耗随机流。 */
function migrateLayout(input: Snapshot): Snapshot {
  const run: Snapshot = JSON.parse(JSON.stringify(input));
  const map = run.map;
  const oldStart = run.chapter === 4 ? CHAPTERS[4].startFloor : (run.chapter - 1) * map.rows;
  if (run.chapter !== 4 && map.rows < FLOORS_PER_CHAPTER) {
    const boss = map.nodes[map.bossId];
    const firstRow = boss.row;
    const id = (row: number) => `expanded-${row}`;
    for (const node of Object.values(map.nodes)) node.next = node.next.map(next => next === map.bossId ? id(firstRow) : next);
    const types = ['combat', 'event', 'rest', 'combat', 'shop', 'combat', 'event', 'rest'] as const;
    for (let row = firstRow; row < FLOORS_PER_CHAPTER - 1; row++) {
      map.nodes[id(row)] = {
        id: id(row), row, col: boss.col,
        type: row === FLOORS_PER_CHAPTER - 2 ? 'rest' : types[(row - firstRow) % types.length],
        next: [row === FLOORS_PER_CHAPTER - 2 ? map.bossId : id(row + 1)],
      };
    }
    boss.row = FLOORS_PER_CHAPTER - 1;
    map.rows = FLOORS_PER_CHAPTER;
  }
  run.floor = CHAPTERS[run.chapter].startFloor + (run.currentNodeId ? map.nodes[run.currentNodeId].row : Math.max(0, run.floor - oldStart));
  run.version = SAVE_VERSION;
  run.elapsedMs = Number.isFinite(run.elapsedMs) ? Math.max(0, run.elapsedMs) : 0;
  run.difficulty = normalizeDifficulty(run.difficulty);
  if (run.combat) ensurePowerInstances(run.combat.player);
  if (input.version < 15 && run.combat) {
    for (const enemy of run.combat.enemies) {
      const ratio = ENEMIES[enemy.defId]?.maxHpLossPerTurn;
      if (!ratio || enemy.damageGuard) continue;
      const limit = Math.max(1, Math.ceil(enemy.maxHp * ratio));
      // 旧档没有逐回合损血账本：保守计入已损失生命，新回合正常刷新。
      // 不重算已开始战斗的生命，也不消耗随机流；回退点采用相同迁移。
      enemy.damageGuard = { limit, lost: Math.min(limit, Math.max(0, enemy.maxHp - enemy.hp)) };
    }
  }
  if (input.version < 14 && run.combat) {
    // 旧版偷窃只记账、战后才扣钱。仅把存活敌人尚未归还的账目转成实际扣款。
    // 旧日志可能已截断，按敌人顺序限额分配，确保绝不凭空生成返还金币。
    let available = run.gold;
    for (const enemy of run.combat.enemies) {
      if (enemy.flags.stolenGold === undefined) continue;
      const held = enemy.hp > 0 && run.combat.outcome !== 'won'
        ? Math.min(available, Math.max(0, enemy.flags.stolenGold)) : 0;
      enemy.flags.stolenGold = held;
      available -= held;
    }
    run.gold = run.combat.gold = available;
  }
  if (input.version < 12 && run.chapter !== 4) expandLegacyRoutes(map, run.visited);
  if (input.version < 16) {
    run.campRefined = run.campRefined === true;
    ensureEncounterPlan(run);
  }
  if (input.version < 17) {
    // 旧问号只会触发事件：保留历史与当前事件，不重抽，也不改未访问节点。
    for (const id of new Set([...run.visited, ...(run.currentNodeId ? [run.currentNodeId] : [])])) {
      const node = map.nodes[id];
      if (node?.type === 'event') node.mysteryType = 'event';
    }
  }
  // 旧档没有可靠的历次付费删牌记录，从更新后开始计数，已生成货架保留原价。
  if (input.version < 18) run.shopRemovals = 0;
  // 已领取完第二章奖励的旧结局直接接入整备，不补发金币、卡牌或遗物。
  if (input.version < 12 && run.chapter === 2 && run.screen === 'victory') {
    run.screen = 'chapter';
    run.endMessage = null;
  }
  if (run.screen === 'gameover') run.endMessage = `你在第 ${run.floor + 1} 层倒下，火种熄灭了。`;
  return run;
}

const KEY = 'ember-traveler:save';
const SETTINGS_KEY = 'ember-traveler:settings';

export type ArtStyle = 'detailed' | 'simple';

export interface Settings {
  sound: boolean;
  fastAnim: boolean;
  artStyle: ArtStyle;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function saveRun(run: RunState | null) {
  const s = storage();
  if (!s) return;
  try {
    recordJourney(run);
    if (!run || run.screen === 'title' || ((run.screen === 'gameover' || run.screen === 'victory') && !run.checkpoint)) s.removeItem(KEY);
    else s.setItem(KEY, JSON.stringify(run));
  } catch {
    /* 存储已满或被禁用 */
  }
}

export function loadRun(): RunState | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    for (const snapshot of [run, run.checkpoint]) {
      if (!snapshot?.combat) continue;
      for (const entity of [snapshot.combat.player, ...snapshot.combat.enemies]) entity.block = Math.min(BLOCK_MAX, Math.max(0, entity.block));
    }
    // 旧版只有第一章；快照也升级，避免 SL 后退回旧结构。
    if (run.version >= 4 && run.version < SAVE_VERSION) {
      const singleChapter = run.version < 6;
      const { checkpoint, ...snapshot } = run;
      const migrated: RunState = {
        ...migrateLayout({ ...snapshot, chapter: singleChapter ? 1 : run.chapter }),
        checkpoint: run.version === 4 || !checkpoint ? null : migrateLayout({ ...checkpoint, chapter: singleChapter ? 1 : checkpoint.chapter }),
      };
      return ensureRewardCheckpoint(resumeFinalVictory(singleChapter ? resumeLegacyVictory(migrated) : migrated));
    }
    if (run.version !== SAVE_VERSION) {
      s.removeItem(KEY);
      return null;
    }
    run.difficulty = normalizeDifficulty(run.difficulty);
    if (run.checkpoint) run.checkpoint.difficulty = normalizeDifficulty(run.checkpoint.difficulty);
    return ensureRewardCheckpoint(run);
  } catch {
    return null;
  }
}

export function clearSave() {
  storage()?.removeItem(KEY);
}

export function loadSettings(): Settings {
  const s = storage();
  try {
    const raw = s?.getItem(SETTINGS_KEY);
    if (raw) {
      const value = JSON.parse(raw);
      return {
        sound: typeof value?.sound === 'boolean' ? value.sound : true,
        fastAnim: typeof value?.fastAnim === 'boolean' ? value.fastAnim : false,
        artStyle: value?.artStyle === 'simple' ? 'simple' : 'detailed',
      };
    }
  } catch {
    /* ignore */
  }
  return { sound: true, fastAnim: false, artStyle: 'detailed' };
}

export function saveSettings(st: Settings) {
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(st));
  } catch {
    /* ignore */
  }
}
