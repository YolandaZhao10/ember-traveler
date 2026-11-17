import { CHARACTERS, type SignatureDef } from '../data/characters';
import type { CharacterId, PlayerCombat } from './types';

/** 旅途誓火在本回合第几次计数时触发。 */
export const KINDRED_VOW_AT = 3;

/** 本回合招牌动作计数；存放在每回合清空的 turnFlags 中，旧存档无需迁移。 */
export const signatureCount = (p: Pick<PlayerCombat, 'turnFlags'>): number => p.turnFlags.signature ?? 0;

/** 没有角色上下文（图鉴、历史记录等）时的通用说法。 */
const GENERIC: Pick<SignatureDef, 'weight' | 'heavy' | 'text'> = {
  weight: 1,
  text: {
    each: '每完成 1 次角色专长动作',
    reached: n => `已完成 ${n} 次以上角色专长动作`,
    nth: n => `第 ${n} 次完成角色专长动作时`,
  },
};
const signatureOf = (character?: CharacterId | null) => (character ? CHARACTERS[character].signature : GENERIC);
/** 达到指定计数至少需要完成几次动作（每次动作可能计多次）。 */
const actionsFor = (count: number, weight: number) => Math.max(1, Math.ceil(count / weight));
/** 普通动作与全靠大额失血各需几次；没有大额规则时两者相同。 */
function actionsNeeded(s: Pick<SignatureDef, 'weight' | 'heavy'>, count: number): [number, number] {
  const actions = actionsFor(count, s.weight);
  return [actions, s.heavy ? actionsFor(count, s.heavy.weight) : actions];
}

/**
 * 「本回合……」的逐次加成用语；value 已换算成当前角色每做一次动作的实际加成，
 * heavy 为单次大额失血时的加成。
 */
export function signatureEachText(character: CharacterId | null | undefined, per: number): { each: string; value: number; heavy?: { label: string; value: number } } {
  const s = signatureOf(character);
  return { each: s.text.each, value: per * s.weight, ...(s.heavy ? { heavy: { label: s.heavy.label, value: per * s.heavy.weight } } : {}) };
}

/** 条件用语：接在「若本回合」之后。 */
export function signatureReachedText(character: CharacterId | null | undefined, count: number): string {
  const s = signatureOf(character);
  return s.text.reached(...actionsNeeded(s, count));
}

/** 旅途誓火的完整说明；卡面与状态提示共用。 */
export function kindredVowText(amount: number, character?: CharacterId | null): string {
  const s = signatureOf(character);
  return `每回合${s.text.nth(...actionsNeeded(s, KINDRED_VOW_AT))}，获得 ${amount} 点能量并抽 ${amount} 张牌。每回合仅一次。`;
}
