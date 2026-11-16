import { CHARACTERS } from '../src/data/characters';
import { ENCOUNTERS } from '../src/data/enemies';
import { RELICS } from '../src/data/relics';
import { BUILD_LOADOUTS, EMBER_LOADOUTS } from '../src/test/buildLoadouts';

/** 固定构筑的压力场景；audit-builds 与 audit-signature 共用，保证两边打的是同一批战斗。 */
export type BuildLoadout = (typeof BUILD_LOADOUTS)[number] & { early?: string[] };
export const ALL_BUILDS: BuildLoadout[] = [...BUILD_LOADOUTS, ...EMBER_LOADOUTS];

const EARLY_CARDS: Record<string, string[]> = {
 combo:['quick_stab','twin_blades','chain_slash','spin_kick','rhythm','measured_step'],
 bulwark:['raise_shield','shield_bash','riposte','vigil','brace_line','ember_patrol'],
 cinder:['light_up','wildfire','scorch_mark','lingering_fire','tend_coals','smoke_screen'],
 ash:['bone_ash','bone_ash','sift_ash','salvage_scraps','ash_shell','buried_knife'],
 blood:['blood_edge','leech_bite','numb','crimson_step','bind_wounds','blood_insight'],
 might:['inflame','overpower','bone_crusher','double_punch','battle_breath','frenzy'],
 echo:['echo_blade','ash_word','aria','echo_veil','reverberant_cut','quiet_sentence'],
 focus:['charged_blade','focus','measured_breath','surge_glyph','delayed_thrust','patient_study'],
};
export const BUILD_STAGES = [{id:'early-single',floor:6,tier:'normal' as const,enemies:['tomb_puppet']},
 {id:'early-group',floor:8,tier:'normal' as const,enemies:['tomb_puppet','ash_rat']},
 ...['sky_boss_archon','final_boss_lord'].map(id=>{const e=ENCOUNTERS.find(e=>e.id===id)!;return{id,floor:id==='sky_boss_archon'?59:64,tier:e.tier,enemies:e.enemies};})];
export type BuildStage = (typeof BUILD_STAGES)[number];
export const matureStage = (stage: BuildStage) => stage.floor > 20;

/** 第一章用六张普通牌，之后用完整的十二张构筑牌。 */
export const supportingCards = (build: BuildLoadout, stage: BuildStage): string[] =>
 [...(matureStage(stage) ? build.cards : build.early ?? EARLY_CARDS[build.route])];

/** 四张基础牌 + 两张角色初始特色牌 + 支持牌；成熟阶段支持牌全部升级，遗物带来的生命上限一并计入。 */
export function buildScenario(build: BuildLoadout, stage: BuildStage, supporting = supportingCards(build, stage)) {
 const ch = CHARACTERS[build.character], mature = matureStage(stage);
 const ids = ['strike','strike','defend','defend',...ch.starterDeck.slice(-2),...supporting];
 const relics = [ch.starterRelic,...(mature?build.relics.filter(id=>stage.floor>=60||RELICS[id].chapter!==3):[])];
 const growth = relics.reduce((n,id)=>n+(RELICS[id].journey??[]).filter(r=>r.trigger==='obtain').flatMap(r=>r.effects).reduce((a,e)=>a+(e.kind==='maxHp'?e.amount:0),0),0);
 return { ids, relics, hp: ch.maxHp+growth, deck: (cards: string[]) => cards.map((defId,i)=>({uid:`build-${i}`,defId,upgraded:mature&&i>=6})) };
}
