import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENTS, EVENT_LIST } from '../data/events';
import { EXTRA_EVENTS } from '../data/extraEvents';
import { EVENT_RELICS } from '../data/specialRelics';
import { RELICS } from '../data/relics';
import * as R from '../engine/run';
import { loadRun, saveRun } from '../engine/save';
import type { ChapterId, EventOutcome, RunState } from '../engine/types';

function outcomes(list: EventOutcome[]): EventOutcome[] {
  return list.flatMap(o => o.kind === 'chance' ? [o, ...outcomes(o.success), ...outcomes(o.fail)] : [o]);
}
function enter(run: RunState): RunState {
  run.screen = 'map'; run.currentNodeId = null;
  const id = run.map.startIds[0]; run.map.nodes[id].type = 'event';
  return R.travelTo(run, id);
}
function event(id: string, seed = 'NEW-EVENT'): RunState {
  const base = R.newRun(seed); base.hp = 40; base.gold = 200; base.chapter = EVENTS[id].chapter ?? 1;
  base.usedEvents = EVENT_LIST.filter(e => e.id !== id).map(e => e.id);
  return enter(base);
}
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
}
afterEach(() => vi.unstubAllGlobals());

describe('扩展问号事件', () => {
  it('新增17个，前三章各14个共42个，15件问号遗物均有对应故事，所有事件都有安全退出', () => {
    expect(EXTRA_EVENTS).toHaveLength(17); expect(EVENT_LIST).toHaveLength(42);
    expect(new Set(EVENT_LIST.map(e => e.id)).size).toBe(42); expect(new Set(EVENT_LIST.map(e => e.title)).size).toBe(42);
    for (const chapter of [1, 2, 3]) expect(EVENT_LIST.filter(e => (e.chapter ?? 1) === chapter)).toHaveLength(14);
    const gifts = EXTRA_EVENTS.flatMap(e => e.choices.flatMap(c => outcomes(c.outcomes))).filter(o => o.kind === 'eventRelic');
    expect(gifts).toHaveLength(15);
    expect(new Set(gifts.map(g => g.relicId))).toEqual(new Set(EVENT_RELICS.map(r => r.id)));
    for (const e of EVENT_LIST) {
      expect(new Set(e.choices.map(c => c.id)).size).toBe(e.choices.length);
      expect(e.choices.some(c => !c.outcomes.length && !c.requireGold && !c.requireHp)).toBe(true);
    }
  });
  it.each([1, 2, 3] as ChapterId[])('第%s章连续三轮都无轮内重复，轮间不连发同一事件，相同种子可重现', chapter => {
    for (let seed = 0; seed < 30; seed++) {
      const sequence = () => {
        let run = R.newRun(`EVENT-ROTATION-${seed}`); run.chapter = chapter; const ids: string[] = [];
        for (let i = 0; i < 42; i++) {
          run = enter(run); const id = run.event!.eventId;
          expect(EVENTS[id].chapter ?? 1).toBe(chapter); expect(id).not.toBe(ids[ids.length - 1]);
          ids.push(id); run = R.eventLeave(run);
        }
        for (let i = 0; i < 3; i++) expect(new Set(ids.slice(i * 14, i * 14 + 14)).size).toBe(14);
        return ids;
      };
      expect(sequence()).toEqual(sequence());
    }
  });
  it('旧局出现过的事件继续记忆，新增未见事件优先，两章事件池互不串入', () => {
    const old = R.newRun('LEGACY-EVENTS');
    old.usedEvents = EVENT_LIST.filter(e => !EXTRA_EVENTS.some(x => x.id === e.id)).map(e => e.id);
    const newIds = new Set(EXTRA_EVENTS.filter(e => e.chapter === 1).map(e => e.id));
    let run = old;
    for (let i = 0; i < 7; i++) { run = enter(run); expect(newIds.delete(run.event!.eventId)).toBe(true); run = R.eventLeave(run); }
    expect(newIds.size).toBe(0);
    run.chapter = 2; const next = enter(run); expect(EXTRA_EVENTS.some(e => e.chapter === 2 && e.id === next.event!.eventId)).toBe(true);
  });
  it.each(EXTRA_EVENTS.map(e => [e.title, e] as const))('%s：全部可选分支可结算、离开、SL重做且不能重复领取', (_title, def) => {
    for (const choice of def.choices) {
      const start = event(def.id); expect(start.event!.eventId).toBe(def.id);
      expect(R.eventChoiceAvailable(start, choice.id)).toBe(true);
      let result = R.eventChoose(start, choice.id);
      expect(R.eventChoose(result, choice.id)).toBe(result); expect(result.hp).toBeGreaterThan(0);
      expect(result.event!.resolvedText).not.toMatch(/undefined|NaN/);
      if (result.event!.pendingPick) {
        const selected = result.deck.find(c => result.event!.pendingPick !== 'upgrade' || R.canUpgrade(c))!;
        const before = result; result = R.eventPickCard(result, selected.uid);
        expect(R.eventPickCard(result, selected.uid)).toBe(result);
        expect(result.deck.find(c => c.uid === selected.uid)?.upgraded).toBe(true);
        expect(result.gold).toBe(before.gold); expect(result.hp).toBe(before.hp);
      }
      expect(result.event!.done).toBe(true); expect(R.resetCurrentNode(R.eventLeave(result))).toEqual(start);
      expect(R.eventChoose(R.resetCurrentNode(result), choice.id)).toEqual(R.eventChoose(start, choice.id));
    }
  });
  it('明确的专属奖励必定给指定问号遗物，支付生命/金币与诅咒代价和获得时成长都真实结算', () => {
    const wish = R.eventChoose(event('wish_tree'), 'wish'); expect(wish.gold).toBe(135); expect(wish.relics).toContain('wishing_cinder');
    const mirror = R.eventChoose(event('mirror_alley'), 'reach'); expect(mirror.hp).toBe(29); expect(mirror.relics).toContain('mirror_shard');
    const mask = R.eventChoose(event('mask_procession'), 'join'); expect(mask.relics).toContain('nameless_mask'); expect(mask.deck.filter(c => c.defId === 'doubt')).toHaveLength(1);
    const amber = R.eventChoose(event('deep_amber_clinic'), 'amber'); expect(amber.gold).toBe(115); expect(amber.maxHp).toBe(86); expect(amber.hp).toBe(54);
    const crown = R.eventChoose(event('deep_empty_throne'), 'crown'); expect(crown.maxHp).toBe(66); expect(crown.relics).toContain('hollow_crown');
  });
  it.each([['buried_standard', 'lift', 'buried_banner', 9], ['deep_star_crane', 'climb', 'vagrant_star', 13]] as const)('%s的风险分支能成功也能失败，失败不发遗物且SL不能重掷', (id, choice, relic, damage) => {
    const branches = new Set<boolean>();
    for (let seed = 0; seed < 40; seed++) {
      const start = event(id, `EVENT-CHANCE-${seed}`); const result = R.eventChoose(start, choice); const success = result.relics.includes(relic);
      branches.add(success); expect(result.hp).toBe(start.hp - (success ? 0 : damage));
      expect(result.relics.length).toBe(start.relics.length + (success ? 1 : 0));
      expect(R.eventChoose(R.resetCurrentNode(result), choice)).toEqual(result);
    }
    expect(branches).toEqual(new Set([true, false]));
  });
  it('已持有奖励时只替换未持有问号遗物，集齐后明确提示50金币，不漏到其他渠道', () => {
    const start = event('wish_tree'); start.relics.push('wishing_cinder');
    expect(R.eventRelicChoiceNote(start, 'wish')).toContain('未持有');
    const swapped = R.eventChoose(start, 'wish'); const gift = swapped.relics[swapped.relics.length - 1];
    expect(RELICS[gift].source).toBe('event'); expect(gift).not.toBe('wishing_cinder');
    start.relics = [...new Set([...start.relics, ...EVENT_RELICS.map(r => r.id)])];
    expect(R.eventRelicChoiceNote(start, 'wish')).toContain('50 金币');
    const full = R.eventChoose(start, 'wish'); expect(full.relics).toEqual(start.relics); expect(full.gold).toBe(start.gold - 65 + 50);
    expect(R.eventRelicChoiceNote(start, 'warm')).toBeNull();
  });
  it('缺金币/生命和无可升级卡时不能选择，资源与随机流不变，安全退出始终可用', () => {
    const poor = event('wish_tree'); poor.gold = 64; expect(R.eventChoiceUnavailableReason(poor, 'wish')).toContain('65'); expect(R.eventChoose(poor, 'wish')).toBe(poor);
    poor.gold = 65; expect(R.eventChoiceAvailable(poor, 'wish')).toBe(true);
    const hurt = event('mirror_alley'); hurt.hp = 11; expect(R.eventChoose(hurt, 'reach')).toBe(hurt); hurt.hp = 12; expect(R.eventChoiceAvailable(hurt, 'reach')).toBe(true);
    const upgraded = event('street_workshop'); upgraded.deck.forEach(c => c.upgraded = true);
    expect(R.eventChoiceUnavailableReason(upgraded, 'temper')).toBe('没有可升级的卡牌'); expect(R.eventChoose(upgraded, 'temper')).toBe(upgraded);
    expect(R.eventChoiceAvailable(upgraded, 'leave')).toBe(true);
    const empty = event('lost_peddler'); empty.deck = []; expect(R.eventChoiceAvailable(empty, 'sell')).toBe(false);
  });
  it('专属遗物与升级选择刷新保持，SL恢复代价、奖励和事件历史', () => {
    storage();
    for (const [id, choice] of [['deep_amber_clinic', 'amber'], ['deep_blank_archive', 'copy']] as const) {
      const start = event(id); const chosen = R.eventChoose(start, choice); saveRun(chosen);
      const loaded = loadRun()!; expect(loaded).toEqual(chosen); expect(loaded.usedEvents).toEqual(start.usedEvents);
      expect(R.resetCurrentNode(loaded)).toEqual(start);
      if (loaded.event!.pendingPick) {
        const selected = loaded.deck[0]; const finished = R.eventPickCard(loaded, selected.uid);
        saveRun(finished); expect(loadRun()!.deck[0].upgraded).toBe(true); expect(R.resetCurrentNode(loadRun()!)).toEqual(start);
      }
    }
  });
});
