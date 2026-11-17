import type { CharacterId } from '../engine/types';
export const BUILD_LOADOUTS: { route: string; character: CharacterId; cards: string[]; relics: string[] }[] = [
 { route:'combo', character:'traveler', cards:['quick_stab','twin_blades','chain_slash','lantern_poke','rhythm','haste','thousand_cuts','tempo','war_drum','trip','quick_stab','iron_will'], relics:['clocktower_gear','furnace_crown','flint','metronome','trail_boots','drummer_heart'] },
 { route:'bulwark', character:'traveler', cards:['raise_shield','shield_bash','thorn_mail','iron_wall','riposte','hold_fast','iron_will','shield_shatter','vigil','bulwark_counter','raise_shield','shield_bash'], relics:['gatekeeper_aegis','molten_sigil','rusted_plate','thorn_crown','shield_rivet','anvil_shard'] },
 { route:'cinder', character:'picker', cards:['light_up','wildfire','scorch_mark','detonate','lingering_fire','lingering_fire','heat_wave','cremation','everburning','ember_tongue','lingering_fire','ash_shield'], relics:['royal_ash_crown','deep_archive','tinderbox','soot_mask','ash_compass','rune_stone'] },
 { route:'ash', character:'picker', cards:['burn_pages','bone_ash','ash_feast','pass_the_flame','burn_it_all','ash_return','dust_to_dust','ash_offering','bone_ash','ash_return','stoke','ember_burst'], relics:['crowned_lantern','foundry_core','bone_urn','coal_pouch','kiln_spark','phoenix_ash'] },
 { route:'blood', character:'oathbound', cards:['blood_edge','blood_rite','leech_bite','blood_pact','martyr','numb','crimson_mail','sanguine','eye_for_eye','leech_bite','blood_rite','inflame'], relics:['belltower_pendulum','furnace_crown','iron_skull','blood_pendant','scar_band','war_horn'] },
 { route:'might', character:'oathbound', cards:['flex','inflame','bone_crusher','overpower','frenzy','demon_heart','heavy_blow','intimidate','blood_fury','overpower','leech_bite','numb'], relics:['sovereign_sigil','furnace_crown','war_horn','whetstone','war_standard','rune_stone'] },
 { route:'echo', character:'scholar', cards:['double_chant','echo_blade','resonance','mirror','ash_word','aria','rune_burst','finale','rune_shield','rune_wall','erudition','echo_blade'], relics:['crowned_lantern','deep_archive','old_tome','tuning_fork','ink_well','crystal_chime'] },
 { route:'focus', character:'scholar', cards:['rune_shield','focus','rune_wall','charged_blade','meditate','erudition','ward_rune','ash_equation','charged_blade','rune_shield','stoke','ember_burst'], relics:['gatekeeper_aegis','deep_archive','lens','bookmark','star_chart','ink_well'] },
];
// 每条路线各带一件第三章奖励；其余均为已取得的前章与常规来源遗物。
const chapterThreeRelics = ['astral_crown','moonward_aegis','starfire_seal','constellation_engine','sky_reliquary','astral_crown','eclipse_lens','constellation_engine'];
BUILD_LOADOUTS.forEach((loadout, i) => loadout.relics.push(chapterThreeRelics[i]));

/**
 * 余烬路线：四角色各一套，以共享余烬牌为主，只带少量本角色的余烬接口牌。
 * early 为第一章压力场景用的六张普通牌。独立导出，不改变其他审计脚本的既有构筑与基线。
 */
export const EMBER_LOADOUTS: ((typeof BUILD_LOADOUTS)[number] & { early: string[] })[] = [
 { route:'ember-traveler', character:'traveler',
   cards:['stoke','torch','searing_strike','coal_tip','camp_guard','warm_cloak','heat_sink','spare_torch','flame_breath','ember_blade','forge','ember_burst'],
   early:['stoke','torch','searing_strike','coal_tip','camp_guard','warm_cloak'],
   relics:['crowned_lantern','everburning_heart','charcoal_heart','ash_hourglass','ember_censer','rusted_plate','constellation_engine'] },
 { route:'ember-picker', character:'picker',
   cards:['ignite','ember_gust','coal_credit','ember_sift','sweeping_embers','stoke','firestorm','rekindle_coals','charcoal_insight','flame_breath','smoldering_star','ember_burst'],
   early:['ignite','ember_gust','coal_credit','ember_sift','sweeping_embers','stoke'],
   relics:['crowned_lantern','foundry_core','coal_pouch','cinder_censer','ash_hourglass','bone_urn','starfire_seal'] },
 { route:'ember-oathbound', character:'oathbound',
   cards:['ember_pulse','scar_cut','sling_volley','ration_bite','sharpened_coal','ember_blade','ember_exchange','insulated_coat','stoke','crown_of_sparks','cinder_mend','ember_burst'],
   early:['stoke','torch','sling_volley','ration_bite','ember_pulse','scar_cut'],
   relics:['sovereign_sigil','furnace_crown','scar_band','iron_skull','charcoal_heart','war_horn','astral_crown'] },
 { route:'ember-scholar', character:'scholar',
   cards:['banked_spark','searing_strike','ink_reserve','stoke','charcoal_insight','emergency_stash','ember_dance','ash_shield','sealed_flame','twilight_flame','ash_equation','ember_burst'],
   early:['banked_spark','searing_strike','ink_reserve','stoke','torch','coal_tip'],
   relics:['crowned_lantern','deep_archive','tuning_fork','bookmark','ash_hourglass','lens','eclipse_lens'] },
];
