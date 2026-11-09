import { normalizeDifficulty } from '../data/difficulty';
import type { CardInstance, CharacterId, RunDifficulty, RunState } from './types';

export type JourneyOutcome = 'won' | 'lost' | 'abandoned';
export interface JourneyRecord {
  id: string;
  endedAt: string;
  character: CharacterId;
  seed: string;
  difficulty: RunDifficulty;
  outcome: JourneyOutcome;
  floor: number;
  hp: number;
  maxHp: number;
  elapsedMs?: number;
  deck: { defId: string; upgraded: boolean; count: number }[];
  relics: string[];
}
const KEY = 'ember-traveler:history';
function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** 记录标识不参与游戏随机流；同一种子开启两次旅程仍是两条记录。 */
export function ensureRecordId(run: RunState, legacySource?: string) {
  if (!run.recordId) {
    let hash = 2166136261;
    if (legacySource) for (let i = 0; i < legacySource.length; i++) hash = Math.imul(hash ^ legacySource.charCodeAt(i), 16777619);
    run.recordId = legacySource ? `legacy-${(hash >>> 0).toString(16)}` : crypto.randomUUID();
  }
  if (run.checkpoint) run.checkpoint.recordId = run.recordId;
}

export function loadHistory(): JourneyRecord[] {
  try {
    const data = JSON.parse(storage()?.getItem(KEY) ?? 'null');
    if (data?.version !== 1 || !Array.isArray(data.records)) return [];
    return data.records.filter((r: JourneyRecord) => r && typeof r.id === 'string' && ['won', 'lost', 'abandoned'].includes(r.outcome)
      && ['traveler', 'picker', 'oathbound', 'scholar'].includes(r.character) && Array.isArray(r.deck) && Array.isArray(r.relics));
  } catch { return []; }
}

function deckSummary(deck: CardInstance[]): JourneyRecord['deck'] {
  const groups = new Map<string, JourneyRecord['deck'][number]>();
  for (const card of deck) {
    const key = `${card.defId}:${card.upgraded}`;
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { defId: card.defId, upgraded: card.upgraded, count: 1 });
  }
  return [...groups.values()];
}

/** 同局 SL 后更新原记录，不累加胜负；放弃已有结算的旅程保留其结果。 */
export function recordJourney(run: RunState | null, abandoned = false) {
  const s = storage();
  if (!s || !run) return;
  const outcome: JourneyOutcome | null = run.screen === 'victory' ? 'won' : run.screen === 'gameover' ? 'lost' : abandoned ? 'abandoned' : null;
  if (!outcome) return;
  if (!run.recordId) {
    const source = JSON.stringify(run);
    run = { ...run, checkpoint: null };
    ensureRecordId(run, source);
  }
  const records = loadHistory();
  const previous = records.find(r => r.id === run.recordId);
  if (outcome === 'abandoned' && previous && previous.outcome !== 'abandoned') return;
  const record: JourneyRecord = {
    id: run.recordId!, endedAt: previous?.endedAt ?? new Date().toISOString(), character: run.character,
    seed: run.seed, difficulty: normalizeDifficulty(run.difficulty), outcome, floor: run.floor + 1,
    hp: run.hp, maxHp: run.maxHp, elapsedMs: run.elapsedMs, deck: deckSummary(run.deck), relics: [...run.relics],
  };
  try { s.setItem(KEY, JSON.stringify({ version: 1, records: [record, ...records.filter(r => r.id !== record.id)] })); } catch { /* 存储不可用时仍允许游玩。 */ }
}

export function journeyStats(records: JourneyRecord[]) {
  const wins = records.filter(r => r.outcome === 'won').length;
  const losses = records.filter(r => r.outcome === 'lost').length;
  return { wins, losses, abandoned: records.filter(r => r.outcome === 'abandoned').length, winRate: wins + losses ? wins / (wins + losses) : null };
}
