import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARDS, cardAvailableTo } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import * as R from '../engine/run';
import { createCombat, playCard } from '../engine/combat';
import { makeRng } from '../engine/rng';
import { loadRun, saveRun } from '../engine/save';
import type { CharacterId } from '../engine/types';

const characters: CharacterId[] = ['traveler', 'picker', 'oathbound', 'scholar'];
const foreignHook = (id: string, character: CharacterId) => { const c = CARDS[id]; return !c.owner && !!c.hook && c.hook !== character; };
const hooks = CARD_LIST.filter(c => c.hook);

describe('通用牌的发牌范围：底座牌、本角色接口牌与共鸣牌', () => {
  it('四个角色各有接口牌；接口牌只对本角色可用，底座牌与共鸣牌人人可用，初始牌不带接口', () => {
    for (const character of characters) expect(hooks.some(c => c.hook === character)).toBe(true);
    for (const c of CARD_LIST.filter(c => !c.owner)) for (const character of characters) {
      expect(cardAvailableTo(c, character), `${c.name}/${character}`).toBe(!c.hook || c.hook === character);
    }
    expect(hooks.every(c => !c.owner && !c.kindred && c.rarity !== 'starter')).toBe(true);
    for (const character of characters) expect(CHARACTERS[character].starterDeck.some(id => foreignHook(id, character))).toBe(false);
  });

  it.each(characters)('%s：大量普通、精英、首领奖励与商店都不出现其他角色的接口牌，本角色接口牌与底座牌都能出现', character => {
    const run = R.newRun(`HOOK-${character}`, character);
    const seen = new Set<string>();
    for (let i = 0; i < 2400; i++) {
      run.floor = i % 60;
      for (const tier of ['normal', 'elite', 'boss'] as const) for (const c of R.generateCardChoices(run, tier, 3)) {
        expect(foreignHook(c.defId, character), CARDS[c.defId].name).toBe(false);
        seen.add(c.defId);
      }
      if (i % 4 === 0) for (const c of R.generateShopCards(run)) {
        expect(foreignHook(c.defId, character), `商店 ${CARDS[c.defId].name}`).toBe(false);
        seen.add(c.defId);
      }
    }
    for (const c of CARD_LIST.filter(c => !c.owner && ['common', 'uncommon', 'rare'].includes(c.rarity))) {
      expect(seen.has(c.id), c.name).toBe(!c.hook || c.hook === character);
    }
  });

  it.each(characters)('%s：事件随机给牌不出现其他角色的接口牌', character => {
    let run = R.newRun(`HOOK-EVENT-${character}`, character);
    const id = run.map.startIds[0];
    run.map.nodes[id].type = 'event'; run.map.nodes[id].mysteryType = 'event';
    run = R.travelTo(run, id);
    run.event!.eventId = 'fallen_belltower';
    for (let i = 0; i < 1500; i++) {
      run.floor = i % 60;
      const before = run.deck.length;
      const next = R.eventChoose(run, 'ring');
      expect(next.deck).toHaveLength(before + 1);
      const gained = next.deck[next.deck.length - 1].defId;
      expect(foreignHook(gained, character), CARDS[gained].name).toBe(false);
      // 只推进事件随机流，牌组保持原样，避免共享牌数量改变来源比例。
      run.rng = next.rng;
    }
  });

  it('旧存档牌组里已有的其他角色接口牌读档后保留，并且仍能打出', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); },
    };
    const run = R.travelTo(R.newRun('HOOK-SAVE', 'traveler'), R.newRun('HOOK-SAVE', 'traveler').map.startIds[0]);
    run.deck.push({ uid: 'kept-1', defId: 'ember_blade', upgraded: true }, { uid: 'kept-2', defId: 'searing_strike', upgraded: false });
    saveRun(run);
    const loaded = loadRun()!;
    expect(loaded.deck.filter(c => c.uid.startsWith('kept-')).map(c => [c.defId, c.upgraded])).toEqual([['ember_blade', true], ['searing_strike', false]]);
    const cs = createCombat('hook-save', ['tomb_puppet'], 'normal', [], 50, 60, [], makeRng('hook-save', 'combat'), 100, 'traveler').state;
    cs.player.hand = [{ uid: 'kept-2', defId: 'searing_strike', upgraded: false, bonus: 0 }];
    const hp = cs.enemies[0].hp;
    expect(playCard(cs, 'kept-2', 'e0').state.enemies[0].hp).toBeLessThan(hp);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
