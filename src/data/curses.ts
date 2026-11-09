import type { CardDef, Effect } from '../engine/types';

function curse(id: string, name: string, handEndEffects: Effect[], flavor: string, retain = false): CardDef {
  return { id, name, type: 'curse', rarity: 'curse', archetype: 'curse', cost: -1, target: 'none', effects: [], handEndEffects, retain, upgrade: {}, flavor };
}

export const EXTRA_CURSES: CardDef[] = [
  curse('regret', '悔恨', [{ kind: 'loseHp', amount: 2 }], '旧事割开新伤。'),
  curse('doubt', '疑惧', [{ kind: 'status', status: 'weak', amount: 1, target: 'self' }], '下一次挥刃，也许仍会落空。'),
  curse('frailty', '朽败', [{ kind: 'status', status: 'frail', amount: 1, target: 'self' }], '盾下藏着一条看不见的裂纹。'),
  curse('cold_ash', '冷灰', [{ kind: 'gainEmber', amount: -2 }], '灰还在，火已冷。'),
  curse('exposure', '破绽', [{ kind: 'status', status: 'vulnerable', amount: 1, target: 'self' }], '黑暗知道你守不住的地方。'),
  curse('burden', '重负', [], '无法放下的行囊。可以用其他牌弃置或消耗。', true),
];
