import { useSyncExternalStore } from 'react';
import { randomSeedString } from '../engine/rng';
import * as R from '../engine/run';
import { clearSave, loadRun, loadSettings, saveRun, saveSettings, type Settings } from '../engine/save';
import type { CardInstance, CharacterId, CombatEvent, RunDifficulty, RunState, StatusId } from '../engine/types';
import { setSoundEnabled, sfx } from './sound';
import { STATUSES } from '../data/statuses';
import { viewCard } from '../engine/cards';
import { impactCues, type ImpactItem } from './combatFx';
import { ensureRecordId, recordJourney } from '../engine/history';

export interface FxItem {
  id: number;
  targetId: string;
  text: string;
  kind: 'damage' | 'block' | 'heal' | 'status' | 'ember' | 'miss';
  delayMs?: number;
}

export type Overlay =
  | { kind: 'history' }
  | { kind: 'help' }
  | { kind: 'relicCatalog' }
  | { kind: 'catalog'; character?: CharacterId }
  | { kind: 'pile'; pile: 'deck' | 'draw' | 'discard' | 'exhaust' }
  | { kind: 'card'; card: CardInstance; inCombat: boolean }
  | { kind: 'status'; status: StatusId; amount: number; ownerName: string; detail?: string }
  | { kind: 'relic'; relicId: string }
  | { kind: 'log' }
  | { kind: 'map' }
  | { kind: 'enemy'; enemyId: string }
  | { kind: 'pick'; title: string; filter: (c: CardInstance) => boolean; onPick: (uid: string) => void; onCancel?: () => void; previewUpgrade?: boolean }
  | { kind: 'upgrade'; card: CardInstance; onConfirm: () => void; onBack: () => void }
  | { kind: 'confirm'; title: string; text: string; onYes: () => void }
  | { kind: 'menu'; character?: CharacterId };

export interface UIState {
  run: RunState | null;
  showTitle: boolean;
  hasSave: boolean;
  busy: boolean;
  selectedCard: string | null;
  fx: FxItem[];
  impacts: ImpactItem[];
  playing: string | null;
  attacking: string | null;
  overlay: Overlay | null;
  toast: string | null;
  banner: string | null;
  settings: Settings;
  lastEvents: CombatEvent[];
}

let state: UIState = {
  run: null,
  showTitle: true,
  hasSave: false,
  busy: false,
  selectedCard: null,
  fx: [],
  impacts: [],
  playing: null,
  attacking: null,
  overlay: null,
  toast: null,
  banner: null,
  settings: loadSettings(),
  lastEvents: [],
};
setSoundEnabled(state.settings.sound);
state.hasSave = loadRun() !== null;

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function set(patch: Partial<UIState>) {
  state = { ...state, ...patch };
  emit();
}
export function useGame(): UIState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
export function getState() {
  return state;
}

let fxId = 0;
function delay(ms: number) {
  const m = state.settings.fastAnim ? 0.45 : 1;
  return new Promise<void>((r) => setTimeout(r, ms * m));
}

function persist(run: RunState | null) {
  saveRun(run);
}

function setRun(run: RunState, save = true) {
  set({ run });
  if (save) persist(run);
}

// ---------- 标题 ----------
export function newGame(seed?: string, character: CharacterId = 'traveler', difficulty?: RunDifficulty) {
  recordJourney(loadRun(), true);
  const s = (seed?.trim() || randomSeedString()).toUpperCase();
  const run = R.newRun(s, character, difficulty);
  ensureRecordId(run);
  clearSave();
  set({ showTitle: false, selectedCard: null, overlay: null, hasSave: true, impacts: [], fx: [] });
  setRun(run);
  sfx('click');
}

export function continueGame() {
  const run = loadRun();
  if (!run) return;
  ensureRecordId(run, JSON.stringify(run));
  recordJourney(run);
  set({ showTitle: false, selectedCard: null, overlay: null, impacts: [], fx: [] });
  setRun(run, false);
  // 战斗已结束但未结算（例如在结算动画期间刷新）
  if (run.combat && run.combat.outcome !== 'ongoing') {
    setRun(R.finishCombat(run));
  } else if (run.combat && run.combat.phase === 'enemy') {
    void runEnemyPhase();
  }
}

export function toTitle() {
  set({ showTitle: true, hasSave: loadRun() !== null, overlay: null, selectedCard: null });
}

export function abandonRun() {
  recordJourney(state.run, true);
  clearSave();
  set({ run: null, showTitle: true, hasSave: false, overlay: null });
}

export function toggleSound() {
  const settings = { ...state.settings, sound: !state.settings.sound };
  setSoundEnabled(settings.sound);
  saveSettings(settings);
  set({ settings });
  if (settings.sound) sfx('click');
}
export function toggleFastAnim() {
  const settings = { ...state.settings, fastAnim: !state.settings.fastAnim };
  saveSettings(settings);
  set({ settings });
}

// ---------- 覆盖层 ----------
export function openOverlay(o: Overlay) {
  set({ overlay: o });
}
export function closeOverlay() {
  set({ overlay: null });
}
let bannerTimer: ReturnType<typeof setTimeout> | null = null;
export function banner(text: string) {
  set({ banner: text });
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => set({ banner: null }), 1100);
}
let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(text: string) {
  set({ toast: text });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: null }), 1600);
}

// ---------- 地图 ----------
export function travel(nodeId: string) {
  if (!state.run || state.busy) return;
  if (!R.canTravelTo(state.run, nodeId)) return;
  sfx('click');
  const next = R.travelTo(state.run, nodeId);
  set({ impacts: [], fx: [] });
  setRun(next);
  if (next.combat) banner(next.combat.tier === 'boss' ? '首领战' : next.combat.tier === 'elite' ? '精英战' : '遭遇战');
}

export function quickReset() {
  if (!state.run || state.busy) return;
  const next = R.resetCurrentNode(state.run);
  if (next === state.run) return;
  if (bannerTimer) clearTimeout(bannerTimer);
  if (toastTimer) clearTimeout(toastTimer);
  set({ selectedCard: null, overlay: null, fx: [], impacts: [], playing: null, attacking: null, lastEvents: [], banner: null, toast: null });
  setRun(next);
  sfx('click');
  toast(next.currentNodeId === null ? `已回到第 ${next.chapter} 章地图起点` : `已回到第 ${next.floor + 1} 层${next.screen === 'reward' ? '奖励选择' : '节点开始'}`);
}

// ---------- 战斗 ----------
function pushFx(items: Omit<FxItem, 'id'>[]) {
  if (!items.length) return;
  const added = items.map((i) => ({ ...i, id: ++fxId }));
  set({ fx: [...state.fx, ...added] });
  setTimeout(() => {
    const ids = new Set(added.map((a) => a.id));
    set({ fx: state.fx.filter((f) => !ids.has(f.id)) });
  }, 1100 + Math.max(...added.map((f) => f.delayMs ?? 0)));
}

function showEvents(events: CombatEvent[]) {
  const fx: Omit<FxItem, 'id'>[] = [];
  const cues = impactCues(events);
  const impacts = cues.map((cue) => ({ ...cue, id: ++fxId, delayMs: cue.delayMs * (state.settings.fastAnim ? 0.45 : 1) }));
  let hit = false;
  let blk = false;
  let ember = false;
  let death = false;
  let heal = false;
  for (const [eventIndex, e] of events.entries()) {
    switch (e.type) {
      case 'damage':
        if (e.amount > 0 || e.blocked > 0) {
          fx.push({ targetId: e.targetId, text: e.amount > 0 ? `-${e.amount}` : `挡下 ${e.blocked}`, kind: e.amount > 0 ? 'damage' : 'miss', delayMs: impacts.find((cue) => cue.eventIndex === eventIndex)?.delayMs });
          if (e.amount > 0) {
            hit = true;
          }
          if (e.blocked > 0) blk = true;
        }
        break;
      case 'block':
        fx.push({ targetId: e.targetId, text: `+${e.amount} 格挡`, kind: 'block' });
        blk = true;
        break;
      case 'heal':
        if (e.amount > 0) {
          fx.push({ targetId: e.targetId, text: `+${e.amount}`, kind: 'heal' });
          heal = true;
        }
        break;
      case 'ember':
        fx.push({ targetId: 'player', text: `${e.amount > 0 ? '+' : ''}${e.amount} 余烬`, kind: 'ember' });
        ember = true;
        break;
      case 'status':
        if (e.amount > 0) fx.push({ targetId: e.targetId, text: `+${e.amount} ${statusLabel(e.status)}`, kind: 'status' });
        break;
      case 'death':
        death = true;
        break;
      case 'phase': {
        const en = state.run?.combat?.enemies.find((x) => x.id === e.enemyId);
        banner(`${en?.name ?? '敌人'} 进入第 ${e.phase} 阶段！`);
        break;
      }
    }
  }
  pushFx(fx);
  set({ impacts, lastEvents: events });
  if (impacts.length) {
    const ids = new Set(impacts.map((cue) => cue.id));
    setTimeout(() => set({ impacts: state.impacts.filter((cue) => !ids.has(cue.id)) }), 650 + Math.max(...impacts.map((cue) => cue.delayMs)));
  }
  if (hit) sfx('hit');
  else if (blk) sfx('block');
  if (ember) sfx('ember');
  if (heal) sfx('heal');
  if (death) sfx('death');
  return 420 + Math.max(0, ...cues.map((cue) => cue.delayMs));
}

function statusLabel(id: StatusId) {
  return STATUSES[id]?.name ?? id;
}

export function selectCardByIndex(i: number) {
  const hand = state.run?.combat?.player.hand;
  if (!hand || !hand[i]) return;
  selectCard(hand[i].uid);
}

export function selectCard(uid: string | null) {
  if (state.busy) return;
  if (state.selectedCard === uid) uid = null;
  set({ selectedCard: uid });
  if (uid) sfx('click');
}

export async function playSelected(targetId: string | null) {
  const uid = state.selectedCard;
  const run = state.run;
  if (!uid || !run || !run.combat || state.busy) return;
  const card = run.combat.player.hand.find((c) => c.uid === uid);
  if (!card) return;
  const res = R.combatPlayCard(run, uid, targetId);
  if (res.run === run) {
    toast('无法打出');
    return;
  }
  const attacks = viewCard(card).type === 'attack';
  set({ busy: true, selectedCard: null, playing: uid, attacking: attacks ? 'player' : null, impacts: [] });
  // 先保存结算结果，前摇期间刷新也不会回滚出牌或重复结算。
  persist(res.run);
  sfx(attacks ? 'swing' : 'play');
  if (attacks) await delay(150);
  setRun(res.run, false);
  const recovery = showEvents(res.events);
  await delay(recovery);
  set({ playing: null, attacking: null });
  await afterStep();
}

export async function playCardDirect(uid: string, targetId: string | null) {
  set({ selectedCard: uid });
  await playSelected(targetId);
}

async function afterStep() {
  const run = state.run;
  if (run?.combat && run.combat.outcome !== 'ongoing') {
    if (run.combat.outcome === 'won') sfx('win');
    else sfx('lose');
    await delay(900);
    const next = R.finishCombat(state.run!);
    set({ busy: false, selectedCard: null });
    setRun(next);
    return;
  }
  set({ busy: false });
  persist(state.run);
}

export async function endTurn() {
  const run = state.run;
  if (!run || !run.combat || state.busy || run.combat.phase !== 'player') return;
  set({ busy: true, selectedCard: null });
  sfx('click');
  const res = R.combatEndTurn(run);
  setRun(res.run);
  showEvents(res.events);
  if (res.run.combat?.outcome === 'ongoing') banner('敌人回合');
  await delay(350);
  await runEnemyPhase();
}

async function runEnemyPhase() {
  set({ busy: true });
  let run = state.run!;
  if (run.combat && run.combat.outcome === 'ongoing') {
    for (const e of run.combat.enemies) {
      run = state.run!;
      if (!run.combat || run.combat.outcome !== 'ongoing') break;
      if (e.hp <= 0) continue;
      const cur = run.combat.enemies.find((x) => x.id === e.id);
      if (!cur || cur.hp <= 0 || cur.flags.acted) continue;
      sfx('intent');
      const res = R.combatEnemyAct(run, e.id);
      // 若敌人先被燃烧击败，就不会制造一次不存在的挥击。
      const attacks = res.events.some((event) => event.type === 'damage' && event.source === 'enemy');
      persist(res.run);
      set({ playing: e.id, attacking: attacks ? e.id : null, impacts: [] });
      if (attacks) sfx('swing');
      await delay(attacks ? 150 : 300);
      setRun(res.run, false);
      const recovery = showEvents(res.events);
      await delay(recovery);
      set({ playing: null, attacking: null });
    }
  }
  run = state.run!;
  if (run.combat && run.combat.outcome === 'ongoing') {
    const res = R.combatStartTurn(run);
    setRun(res.run, false);
    showEvents(res.events);
    if (res.run.combat) banner(`第 ${res.run.combat.turn} 回合`);
    sfx('draw');
    await delay(300);
  }
  await afterStep();
}

// ---------- 奖励 / 商店 / 营火 / 事件 ----------
function simple(fn: (r: RunState) => RunState, sound?: Parameters<typeof sfx>[0]) {
  return (...args: unknown[]) => {
    void args;
    if (!state.run || state.busy) return;
    const next = fn(state.run);
    if (next !== state.run) {
      if (sound) sfx(sound);
      setRun(next);
    }
  };
}

export const rewardTakeGold = simple(R.rewardTakeGold, 'gold');
export function rewardTakeRelic(relicId?: string) {
  if (!state.run || state.busy) return;
  const next = R.rewardTakeRelic(state.run, relicId);
  if (next !== state.run) { sfx('heal'); setRun(next); }
}
export const rewardSkipCard = simple(R.rewardSkipCard, 'click');
export const rewardLeave = simple(R.rewardLeave, 'click');
export const enterNextChapter = simple(R.enterNextChapter, 'heal');
export function rewardTakeCard(uid: string) {
  if (!state.run || state.busy) return;
  sfx('draw');
  setRun(R.rewardTakeCard(state.run, uid));
}

export function shopBuyCard(i: number) {
  if (!state.run) return;
  const next = R.shopBuyCard(state.run, i);
  if (next === state.run) toast('金币不足');
  else {
    sfx('gold');
    setRun(next);
  }
}
export function shopBuyRelic(i: number) {
  if (!state.run) return;
  const next = R.shopBuyRelic(state.run, i);
  if (next === state.run) toast('金币不足');
  else {
    sfx('gold');
    setRun(next);
  }
}
export function shopRemove(uid: string) {
  if (!state.run) return;
  const next = R.shopRemoveCard(state.run, uid);
  if (next === state.run) toast('无法移除');
  else {
    sfx('death');
    setRun(next);
  }
  closeOverlay();
}
export const shopLeave = simple(R.shopLeave, 'click');

export const restHeal = simple(R.restHeal, 'heal');
export const restLeave = simple(R.restLeave, 'click');
export function restUpgrade(uid: string) {
  if (!state.run) return;
  const next = R.restUpgrade(state.run, uid);
  if (next !== state.run) sfx('ember');
  setRun(next);
  closeOverlay();
}

export function eventChoose(id: string) {
  if (!state.run) return;
  const next = R.eventChoose(state.run, id);
  if (next !== state.run) {
    sfx('click');
    setRun(next);
  }
}
export function eventPick(uid: string) {
  if (!state.run) return;
  setRun(R.eventPickCard(state.run, uid));
  closeOverlay();
}
export const eventLeave = simple(R.eventLeave, 'click');

// ---------- 开发调试钩子（仅 dev 模式） ----------
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __ember: unknown }).__ember = {
    getState,
    setRun: (run: RunState) => setRun(run),
    engine: R,
  };
}
