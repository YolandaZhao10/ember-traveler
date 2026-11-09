import type { RngState } from './rng';

// ---------- 卡牌 ----------
export type CardType = 'attack' | 'skill' | 'power' | 'curse';
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'curse';
export type Archetype = 'basic' | 'combo' | 'bulwark' | 'ember' | 'cinder' | 'ash' | 'blood' | 'might' | 'echo' | 'focus' | 'curse';
export type CharacterId = 'traveler' | 'picker' | 'oathbound' | 'scholar';
export type ChapterId = 1 | 2 | 3 | 4;
/** 百分比；字符串只用于兼容旧存档/规则调用。新界面与存档统一使用 50–200。 */
export type DifficultyLevel = number | 'low' | 'normal' | 'high';
export interface RunDifficulty {
  enemyHealth: DifficultyLevel;
  enemyIntent: DifficultyLevel;
  bossHealth: DifficultyLevel;
  bossIntent: DifficultyLevel;
  gold: DifficultyLevel;
  relicRarity: DifficultyLevel;
  cardRarity: DifficultyLevel;
}
export type TargetMode = 'enemy' | 'all_enemies' | 'self' | 'none';

export type StatusId =
  | 'strength'
  | 'dexterity'
  | 'weak'
  | 'vulnerable'
  | 'frail'
  | 'thorns'
  | 'burn'
  | 'metallicize'
  | 'barricade'
  | 'ritual'
  | 'emberHeart'
  | 'flameAura'
  | 'tempo'
  | 'crescendo'
  | 'forge'
  | 'enrage'
  | 'vengeance'
  | 'regen'
  | 'ashFeast'
  | 'kindling'
  | 'pyre'
  | 'everburn'
  | 'strengthDown'
  | 'bloodRage'
  | 'bloodArmor'
  | 'sanguine'
  | 'demonHeart'
  | 'echo'
  | 'resonance'
  | 'mirror'
  | 'energyNext'
  | 'study'
  | 'arcaneWard';

export type Condition =
  | { kind: 'emberAtLeast'; value: number }
  | { kind: 'attacksThisTurnAtLeast'; value: number }
  | { kind: 'cardsThisTurnAtLeast'; value: number }
  | { kind: 'hasBlock' }
  | { kind: 'targetBurning' }
  | { kind: 'lostHpThisTurn' }
  | { kind: 'hasEcho' };

export type Effect =
  | { kind: 'damage'; amount: number; times?: number; aoe?: boolean; strengthMult?: number; lifesteal?: boolean; lifestealCap?: number; perHandCard?: number }
  | { kind: 'damagePerHpLost'; mult: number }
  | { kind: 'loseHp'; amount: number }
  | { kind: 'tempStrength'; amount: number }
  | { kind: 'doubleEmber' }
  | { kind: 'discardRandom'; count: number }
  | { kind: 'damageByBlock'; bonus?: number; aoe?: boolean; mult?: number; consume?: boolean }
  | { kind: 'damagePerAttack'; amount: number }
  | { kind: 'damagePerEmber'; amount: number; per?: number }
  | { kind: 'block'; amount: number }
  | { kind: 'draw'; amount: number }
  | { kind: 'energy'; amount: number }
  | { kind: 'gainEmber'; amount: number }
  | { kind: 'emberBurst'; damagePer?: number; blockPer?: number; aoe?: boolean }
  | { kind: 'status'; status: StatusId; amount: number; target: 'target' | 'all' | 'self' }
  | { kind: 'heal'; amount: number }
  | { kind: 'exhaustHand'; count: number | 'all'; damagePerCard?: number; energyPerCard?: number }
  | { kind: 'damagePerBurn'; amount: number; aoe?: boolean }
  | { kind: 'consumeBurn'; damagePer: number }
  | { kind: 'doubleStatus'; status: StatusId; target?: 'self' }
  | { kind: 'returnExhausted'; count: number }
  | { kind: 'conditional'; cond: Condition; then: Effect[] };

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  rarity: Rarity;
  archetype: Archetype;
  /** 专属角色；省略表示所有角色可用 */
  owner?: CharacterId;
  cost: number;
  target: TargetMode;
  effects: Effect[];
  /** 回合结束时仍在手中的诅咒，在减益递减后触发。 */
  handEndEffects?: Effect[];
  exhaust?: boolean;
  /** 回合结束时保留在手牌 */
  retain?: boolean;
  /** 每保留一回合，伤害 / 格挡增加 */
  charge?: { damage?: number; block?: number };
  requireEmber?: number;
  flavor?: string;
  upgrade: {
    name?: string;
    cost?: number;
    effects?: Effect[];
    exhaust?: boolean;
    requireEmber?: number;
  };
}

export interface CardInstance {
  uid: string;
  defId: string;
  upgraded: boolean;
  /** 蓄力层数（保留回合数），仅战斗内有效 */
  bonus?: number;
}

// ---------- 状态 / 实体 ----------
export interface StatusDef {
  id: StatusId;
  name: string;
  kind: 'buff' | 'debuff' | 'power';
  /** 持续类：拥有者回合结束时 -1 */
  decays?: boolean;
  description: (amount: number) => string;
}

export type Statuses = Partial<Record<StatusId, number>>;

export interface Entity {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: Statuses;
}

// ---------- 敌人 ----------
export type Intent =
  | { kind: 'attack'; amount: number; times: number }
  | { kind: 'attack_debuff'; amount: number; times: number }
  | { kind: 'defend' }
  | { kind: 'buff' }
  | { kind: 'debuff' }
  | { kind: 'special' }
  | { kind: 'defend_buff' };

export type EnemyAction =
  | { kind: 'attack'; amount: number; times?: number }
  | { kind: 'block'; amount: number }
  | { kind: 'status'; status: StatusId; amount: number; target: 'player' | 'self' | 'allies' }
  | { kind: 'heal'; amount: number }
  | { kind: 'loseHp'; amount: number }
  | { kind: 'stealGold'; amount: number }
  | { kind: 'addCardToDiscard'; cardId: string; count: number }
  | { kind: 'clearDebuffs' };

export interface EnemyMove {
  id: string;
  name: string;
  intent: Intent['kind'];
  actions: EnemyAction[];
}

export interface EnemyState extends Entity {
  defId: string;
  moveId: string | null;
  moveHistory: string[];
  turn: number;
  phase: number;
  flags: Record<string, number>;
}

export interface EnemyAiContext {
  enemy: EnemyState;
  allies: EnemyState[];
  player: Entity;
  rng: RngState;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: [number, number];
  tier: 'normal' | 'elite' | 'boss';
  sprite: string;
  moves: EnemyMove[];
  /** 选择下一步行动 */
  chooseMove: (ctx: EnemyAiContext) => string;
  /** 战斗开始 / 受伤 / 盟友死亡等钩子 */
  onCombatStart?: (ctx: EnemyAiContext) => EnemyAction[];
  onAllyDeath?: (ctx: EnemyAiContext) => EnemyAction[];
  /** 自身死亡时执行（可对玩家施加状态 / 伤害） */
  onDeath?: EnemyAction[];
  /** 阶段切换：返回新阶段编号（否则 null） */
  checkPhase?: (enemy: EnemyState) => number | null;
  description: string;
}

export interface EncounterDef {
  id: string;
  enemies: string[];
  tier: 'normal' | 'elite' | 'boss';
  /** 省略表示第一章；层数范围均为章内 0–19。 */
  chapter?: ChapterId;
  minFloor?: number;
  maxFloor?: number;
}

// ---------- 遗物 ----------
export type RelicRarity = 'starter' | 'common' | 'uncommon' | 'rare';
export type RelicCombatTrigger = 'turnStart' | 'turnEnd' | 'cardPlayed' | 'attackPlayed' | 'skillPlayed' | 'powerPlayed' | 'exhaust' | 'selfHpLoss' | 'echo' | 'enemyKilled';
export type RelicCondition =
  | { kind: 'hpBelowHalf' | 'retainedHand' | 'burningEnemy' }
  | { kind: 'emberAtLeast' | 'blockAtLeast' | 'attacksAtLeast' | 'skillsAtLeast' | 'cardsAtMost' | 'exhaustedAtLeast' | 'handAtLeast' | 'energyAtLeast' | 'hpLostAtLeast'; value: number };
export type RelicCombatEffect =
  | { kind: 'block' | 'draw' | 'energy' | 'ember' | 'heal' | 'damageAll' | 'damageLowest' | 'charge'; amount: number }
  | { kind: 'status'; status: StatusId; amount: number }
  | { kind: 'enemyStatus'; status: StatusId; amount: number; target: 'all' | 'lowest' }
  | { kind: 'cleanse'; status: 'burn' | 'weak' | 'vulnerable' | 'frail'; amount: number };
export interface RelicCombatRule {
  trigger: RelicCombatTrigger;
  /** 指定战斗回合数，或本回合事件第几次；每 N 次与指定次数互斥。 */
  nth?: number;
  every?: number;
  when?: RelicCondition[];
  effects: RelicCombatEffect[];
}
export interface RelicJourneyRule {
  trigger: 'obtain' | 'victory' | 'rest' | 'upgrade' | 'purchase' | 'remove';
  tier?: 'normal' | 'elite' | 'boss';
  effects: { kind: 'heal' | 'gold' | 'maxHp'; amount: number }[];
}
export interface RelicDef {
  id: string;
  name: string;
  rarity: RelicRarity;
  icon: string;
  description: string;
  archetype?: Archetype;
  /** 真正的角色专属遗物，只能由对应角色获得。 */
  owner?: CharacterId;
  combat?: RelicCombatRule[];
  journey?: RelicJourneyRule[];
  /** 章节首领独立三选一池，不进入普通掉落和商店。 */
  chapter?: ChapterId;
  /** 独立获取渠道，不进入常规遗物池。 */
  source?: 'event' | 'shop';
}

// ---------- 事件 ----------
export type EventOutcome =
  | { kind: 'hp'; amount: number }
  | { kind: 'maxHp'; amount: number }
  | { kind: 'gold'; amount: number }
  | { kind: 'relic'; relicId?: string }
  | { kind: 'eventRelic'; relicId?: string }
  | { kind: 'card'; cardId?: string; rarity?: Rarity }
  | { kind: 'curse'; cardId: string }
  | { kind: 'removeCard' }
  | { kind: 'upgradeCard' }
  | { kind: 'chance'; p: number; success: EventOutcome[]; fail: EventOutcome[]; successText: string; failText: string };

export interface EventChoice {
  id: string;
  label: string;
  detail: string;
  outcomes: EventOutcome[];
  requireGold?: number;
  requireHp?: number;
}

export interface EventDef {
  id: string;
  chapter?: ChapterId;
  title: string;
  text: string;
  icon: string;
  choices: EventChoice[];
}

// ---------- 战斗 ----------
export type Pile = 'draw' | 'hand' | 'discard' | 'exhaust';
export interface PowerInstance {
  status: 'tempo' | 'flameAura' | 'mirror';
  amount: number;
  /** 余音跨回合累计出牌数；镜像为本回合是否已触发。 */
  progress: number;
}

export interface PlayerCombat extends Entity {
  powerInstances?: PowerInstance[];
  energy: number;
  maxEnergy: number;
  ember: number;
  draw: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exhaust: CardInstance[];
  cardsPlayedThisTurn: number;
  attacksPlayedThisTurn: number;
  skillsPlayedThisTurn: number;
  blockGainedThisTurn: number;
  hpLostThisTurn: number;
  selfHpLost: number;
  /** 每回合遗物触发标记 */
  turnFlags: Record<string, number>;
}

export type CombatEvent =
  | { type: 'cardPlayed'; uid: string; name: string }
  | { type: 'damage'; targetId: string; amount: number; blocked: number; source: 'player' | 'enemy' | 'thorns' | 'burn' | 'aura' }
  | { type: 'block'; targetId: string; amount: number }
  | { type: 'status'; targetId: string; status: StatusId; amount: number }
  | { type: 'heal'; targetId: string; amount: number }
  | { type: 'ember'; amount: number; total: number }
  | { type: 'draw'; count: number }
  | { type: 'shuffle' }
  | { type: 'death'; targetId: string }
  | { type: 'enemyMove'; enemyId: string; moveName: string }
  | { type: 'relic'; relicId: string }
  | { type: 'phase'; enemyId: string; phase: number }
  | { type: 'log'; text: string };

export interface CombatDifficulty {
  floor: number;
  healthMultiplier: number;
  attackMultiplier: number;
  blockMultiplier: number;
}

export interface CombatState {
  /** 旧存档中的当前战斗可不带强化；新遭遇按楼层固定强化。 */
  difficulty?: CombatDifficulty;
  encounterId: string;
  tier: 'normal' | 'elite' | 'boss';
  player: PlayerCombat;
  enemies: EnemyState[];
  turn: number;
  phase: 'player' | 'enemy' | 'ended';
  outcome: 'ongoing' | 'won' | 'lost';
  log: string[];
  rng: RngState;
  relics: string[];
  uidCounter: number;
  character: CharacterId;
}

// ---------- 地图 ----------
export type NodeType = 'combat' | 'elite' | 'event' | 'shop' | 'rest' | 'boss';
export interface MapNode {
  id: string;
  row: number;
  col: number;
  type: NodeType;
  next: string[];
}
export interface GameMap {
  rows: number;
  cols: number;
  nodes: Record<string, MapNode>;
  startIds: string[];
  bossId: string;
}

// ---------- 局内状态 ----------
export type Screen =
  | 'title'
  | 'map'
  | 'combat'
  | 'reward'
  | 'event'
  | 'shop'
  | 'rest'
  | 'chapter'
  | 'gameover'
  | 'victory';

export interface RewardState {
  gold: number;
  goldTaken: boolean;
  cards: CardInstance[];
  cardTaken: boolean;
  relic: string | null;
  relicTaken: boolean;
  relicChoices?: string[];
  chapterComplete?: ChapterId;
}

export interface ShopItemCard {
  card: CardInstance;
  price: number;
  sold: boolean;
}
export interface ShopItemRelic {
  relicId: string;
  price: number;
  sold: boolean;
}
export interface ShopState {
  /** 进店时固定；旧存档货架没有这些字段，仍保留原标价。 */
  priceMultiplier?: number;
  discounted?: boolean;
  cards: ShopItemCard[];
  relics: ShopItemRelic[];
  removePrice: number;
  removeUsed: boolean;
}

export interface EventState {
  eventId: string;
  resolvedText: string | null;
  pendingPick: 'remove' | 'upgrade' | null;
  done: boolean;
}

export interface RestState {
  used: boolean;
  picking: boolean;
}

export interface RunStats {
  floorsCleared: number;
  enemiesKilled: number;
  cardsPlayed: number;
  damageDealt: number;
  elitesKilled: number;
}

export interface RunState {
  version: number;
  /** 与随机种子无关的本局记录标识，刷新、跨章与 SL 均保留。 */
  recordId?: string;
  /** 前台游玩累计毫秒；SL 不回退，首页、后台与结算暂停。 */
  elapsedMs: number;
  difficulty: RunDifficulty;
  /** 当前节点或战后奖励阶段开始时的完整状态，不递归保存历史回退点。 */
  checkpoint: Omit<RunState, 'checkpoint'> | null;
  seed: string;
  character: CharacterId;
  rng: {
    map: RngState;
    reward: RngState;
    combat: RngState;
    event: RngState;
    shop: RngState;
  };
  screen: Screen;
  chapter: ChapterId;
  map: GameMap;
  currentNodeId: string | null;
  visited: string[];
  /** 整局层数，从 0 开始；前三章各 20 层，终章 5 层。 */
  floor: number;
  hp: number;
  maxHp: number;
  gold: number;
  deck: CardInstance[];
  relics: string[];
  combat: CombatState | null;
  reward: RewardState | null;
  shop: ShopState | null;
  event: EventState | null;
  rest: RestState | null;
  usedEvents: string[];
  seenEncounters: string[];
  stats: RunStats;
  uidCounter: number;
  endMessage: string | null;
}
