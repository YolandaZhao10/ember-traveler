/** 战斗内资源边界；结算与卡牌预览必须使用同一个值。 */
export const EMBER_MAX = 9999;
export const BLOCK_MAX = 9999;

/** 蓄力保留跨轮成长，但不能靠无限拖延把基础牌滚成无限收益。 */
export const CHARGE_MAX = 10;
export const clampCharge = (value: number) => Math.max(0, Math.min(CHARGE_MAX, Number.isFinite(value) ? Math.floor(value) : 0));
