/** 商店借款：借到的金币，以及下次进店时归还的金额。 */
export const LOAN_AMOUNT = 200;
export const LOAN_REPAY = 250;

/** 战斗内资源边界；结算与卡牌预览必须使用同一个值。 */
export const EMBER_MAX = 9999;
export const BLOCK_MAX = 9999;

/** 蓄力保留跨轮成长，但不能靠无限拖延把基础牌滚成无限收益。 */
export const CHARGE_MAX = 10;
/** 这张牌的蓄力上限：max 为单张牌自带的更低上限，缺省或更高时仍受全局上限约束；uncapped 的牌不设上限。 */
export const chargeLimit = (charge?: { max?: number; uncapped?: true }): number => charge?.uncapped ? Infinity : Math.min(CHARGE_MAX, charge?.max ?? CHARGE_MAX);
/** limit 用 chargeLimit 取得；缺省按全局上限。 */
export const clampCharge = (value: number, limit: number = CHARGE_MAX) => Math.max(0, Math.min(limit, Number.isFinite(value) ? Math.floor(value) : 0));
