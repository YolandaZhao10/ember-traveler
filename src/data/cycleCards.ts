import type { CardDef, Effect } from '../engine/types';

const block = (amount: number): Effect => ({ kind: 'block', amount });
const lose = (amount: number): Effect => ({ kind: 'loseHp', amount });
const move = (from: 'draw' | 'discard' | 'exhaust', to: 'hand' | 'draw' | 'discard', options: Partial<Extract<Effect, { kind: 'moveCard' }>> = {}): Effect => ({ kind: 'moveCard', from, to, ...options });
const status = (status: 'energyNext' | 'echo' | 'burn', amount: number, target: 'self' | 'all' = 'self'): Effect => ({ kind: 'status', status, amount, target });

/** 牌堆操作移动实体，不复制卡牌；各自服务连击、燃料、血量与蓄力循环。 */
export const CYCLE_CARDS: CardDef[] = [
  { id: 'blade_recall', name: '回锋整备', owner: 'traveler', archetype: 'combo', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    effects: [block(4), move('discard', 'hand', { filter: 'attack' })],
    upgrade: { effects: [block(7), move('discard', 'hand', { filter: 'attack' })] } },
  { id: 'shield_rotation', name: '换岗布防', owner: 'traveler', archetype: 'bulwark', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    effects: [block(6), move('discard', 'draw', { filter: 'skill' }), status('energyNext', 1)],
    upgrade: { effects: [block(9), move('discard', 'draw', { filter: 'skill' }), status('energyNext', 1)] } },
  { id: 'ash_sifting', name: '灰中分拣', owner: 'picker', archetype: 'ash', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    effects: [move('draw', 'discard', { sample: 3 }), { kind: 'draw', amount: 2 }, { kind: 'gainEmber', amount: 1 }],
    upgrade: { effects: [move('draw', 'discard', { sample: 3 }), { kind: 'draw', amount: 2 }, { kind: 'gainEmber', amount: 3 }] } },
  { id: 'cinder_salvage', name: '拾薪归炉', owner: 'picker', archetype: 'cinder', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    effects: [move('discard', 'hand', { filter: 'exhaust' }), status('burn', 3, 'all')],
    upgrade: { effects: [move('discard', 'hand', { filter: 'exhaust' }), status('burn', 4, 'all')] } },
  { id: 'blood_tether', name: '血线牵引', owner: 'oathbound', archetype: 'blood', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', exhaust: true,
    effects: [lose(3), move('discard', 'hand', { filter: 'action' })],
    upgrade: { effects: [lose(2), move('discard', 'hand', { filter: 'action' })] } },
  { id: 'scar_hold', name: '伤痕固守', owner: 'oathbound', archetype: 'might', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    effects: [lose(3), block(8), { kind: 'retainHand' }],
    upgrade: { effects: [lose(3), block(12), { kind: 'retainHand' }] } },
  { id: 'star_page_search', name: '星页检索', owner: 'scholar', archetype: 'echo', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    effects: [move('draw', 'hand', { sample: 3 }), status('echo', 1)],
    upgrade: { effects: [move('draw', 'hand', { sample: 4 }), status('echo', 1)] } },
  { id: 'palimpsest', name: '叠页演算', owner: 'scholar', archetype: 'focus', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', retain: true,
    effects: [move('discard', 'draw'), { kind: 'chargeHand', amount: 1 }],
    upgrade: { effects: [move('discard', 'draw'), { kind: 'chargeHand', amount: 2 }] } },
  { id: 'ember_retrieval', name: '余烬拾遗', archetype: 'ember', type: 'skill', rarity: 'rare', cost: 1, target: 'self', exhaust: true,
    effects: [move('exhaust', 'hand')], upgrade: { cost: 0 } },
];
