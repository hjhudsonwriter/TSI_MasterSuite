# Scarlett Isles tool suite recreation handover

Prepared for Harry Hudson and the AI coding agent implementing the master repository. Research date 25 September 2026.

> **Owner's notes — read these first**
>
> - This suite is for Harry's own table: running and testing it at local D&D sessions with friends. Where this handover talks about deployment, hosting or release, CLAUDE.md decides instead.
> - Harry has never set up or used Firebase. Ignore every instruction below about Firebase exports, migration, database rules or sync adapters. Where this document describes Firebase code in the old tools, treat it as a description of code to be replaced with local-only saving.
> - The tool list is the eight tools in section 2. No other tools from Harry's old hub page are part of the suite.
> - Where anything here conflicts with CLAUDE.md, CLAUDE.md wins.

Recreate the eight completed Scarlett Isles DND tools described here as one coherent suite, using the supplied repositories as the implementation reference. Preserve the campaign content, working interactions, audiovisual presentation and saved data. Deliver a functioning integrated product, rather than a page of links to the old deployments.

This is a source-based handover, not a certification that every current feature is bug-free. Public repository trees and the available HTML, CSS, JavaScript and JSON were inspected. JavaScript syntax checks passed for the downloaded scripts. Live browser gameplay, Firebase permissions and data, audiovisual playback, and all deployment paths still require acceptance testing. The source register records the reviewed tree fingerprints so later repository changes can be identified.

# 1 Instructions for the receiving coding agent

Read this document and every supplied repository before replacing any implementation. First produce an inventory of entry points, datasets, assets, storage keys, external services and playable flows. Resolve each module to the source tree in the register. If Harry supplies a newer version, record the differences and use that version after checking for regressions.

Build for a novice owner who should be able to run, update and back up the suite using clear instructions. Retain a browser-based experience, desktop DM controls and player-facing displays. Do not introduce an account system, paid AI service, full automated D&D rules engine or unrelated campaign expansion simply because a new architecture makes it possible.

Preserve implemented behaviour first. Correct demonstrable bugs with a recorded before-and-after explanation. Where two working tools disagree on a game rule, retain explicit compatibility policies until Harry chooses the canonical rule. Recommendations in sections 12 to 15 describe the proposed suite; they are not claims about existing functionality.

Do not silently overwrite browser saves or the existing Firebase database. Export them, validate migration against copies, produce a comparison report and retain the original exports. Repository code alone does not contain a player's browser saves or the live shared Firebase records.

Deliver the complete repository, deployment configuration, source and asset inventory, versioned save schema, migration utilities, meaningful tests, a short user guide, a maintenance guide and a list of any unresolved decisions. Finish with evidence for each acceptance check. An attractive shell with missing systems does not meet the brief.

# 2 Included products and authoritative sources

The completed product inventory is eight tools. A completed product can contain a defect or an unfinished optional extension; that does not mean its entire functioning core should be discarded. Preserve the completed core and keep incomplete extensions out of the release scope.

| **ID** | **Product** | **Repository under hjhudsonwriter unless stated** |
| --- | --- | --- |
| M01 | Combat Tracker and VTT Battlemap | scarlettisles-encounter-tracker |
| M03 | Notice Board Quest Generator | scarlett-isles-quest-generator |
| M04 | Scarlett Isles Explorer | scarlett-isles-explorer |
| M05 | The Ironbow Bastion Manager | bastion_manager |
| M07 | Clan Crest Creator | clan-crest-creator |
| M08 | Arenas of The Scarlett Isles | arenas-of-the-scarlett-isles |
| M09 | The Heartwood Ritual | tellurian-ritual-engine |
| M10 | Pelagosi Puzzle Trials | pelagosi_marker_rune_puzzle |

Use the exact repository spellings above. Historical references to scarlett-isles-encounter-tracker and clan_crest_creator are not the current repository names. The Heartwood Ritual is implemented in tellurian-ritual-engine.

# 3 Source priority and scope boundary

Use this priority: the supplied current repository and verified behaviour; explicit owner decisions; this source review; older conversation summaries; stale README descriptions. If these conflict, record the discrepancy instead of silently selecting whichever is easiest to implement.

The attached CODE (2).pdf contains 90 pages of Encounter Tracker and VTT source. It is useful historical evidence, but the reviewed repository has a later VTT implementation with measurement, persistent explored fog, removal controls and fullscreen controls. Do not recreate only the PDF version and lose those additions.

The earlier World Hub build is excluded: history identifies unfinished authored world content, settlement/encounter integration and battlemap handoff. Quest Session Forge is excluded: history records an unfinished Worker/API deployment, and the working Quest Generator explicitly disables its remote expansion function. Do not turn that abandoned dependency into a prerequisite for the completed notice board.

The older Campaign Manager is a predecessor and content source, not an additional product to rebuild wholesale. Its extracted Explorer and standalone Bastion Manager are the relevant implementations. The repository named DM-session-hub currently contains an older Ironbow Bastion Manager implementation, not a separate completed session-writing tool. Deduplicate it against M05. Preserve useful provenance or content only after comparison; do not count its misleading repository title as a new feature.

Exclude Unreal Engine projects, Lord and Lance, proposed world-pressure systems and other speculative expansions. Existing narrative text and maps within the eight tools remain in scope. The original Heartwood campaign content must remain in the Ritual even though later notice-board requirements sought to avoid repeating that campaign's roots and Veinwood themes.

# 4 M01 Combat Tracker and VTT Battlemap

## Purpose and workflow

This is the DM combat desk and its linked player-facing battlemap. Create or import combatants into Storage, select them into an encounter, set or roll initiative, begin combat, select the recipient of damage or conditions, and complete the active combatant's turn. Open vtt.html in the named ScarlettVTT popup for map and token display.

The combatant library supports PCs, monsters and NPCs, names, maximum HP, initiative bonus, portrait URL and reference/stat-block link. Editing a library entry updates matching encounter copies by baseId while preserving the copy suffix and clamping current HP. Encounter instances use encId so duplicate monsters remain distinct. Saved encounters are reusable templates with load, duplicate and delete; loading generates fresh instance IDs, restores full HP and clears conditions.

## Rules and state

The encounter state contains name, status, roster, turnIndex and round. Statuses are idle, ready, running, paused and ended. Automatic initiative is d20 plus the library bonus; descending initiative uses alphabetical name as the tie-breaker. Missing initiative becomes zero when combat begins. Defeated and zero-HP combatants are skipped. Rounds increment when turn selection wraps. When every monster is defeated, a running encounter ends automatically; a roster containing no monsters does not auto-end by that rule.

Positive damage reduces HP; negative damage heals. The handler subtracts Math.floor(input) and clamps HP between zero and maximum. Complete Turn first applies damage and an optional condition to the selected target, then decreases conditions on the combatant whose turn ended, then advances. Add Condition alone does not advance the turn. Structured conditions contain name and remaining; legacy string conditions are retained without a countdown. A repeated structured condition refreshes its remaining duration.

Preserve the distinction between active combatant and selected damage target. This is a central interaction, not an incidental dropdown. Keep the inspector, round and turn feedback, HP display, status controls, stat-block links, manual roster editing and encounter templates.

## Battlemap behaviour

The current VTT supports map-image upload, map removal, pan and zoom, token resizing, multi-selection, dragging, grid visibility/size/offset, snapping, measuring, fullscreen controls and token visibility/removal. Uploaded map files are limited to approximately 4 MiB before data-URL storage. Token positions are normalised. Camera state contains x, y and zoom. Default token size is 56; square grid size is 70 pixels and opacity 0.35.

Measurement uses Euclidean distance in world coordinates, divided by grid size and multiplied by five feet. It is not a diagonal-cost 5e pathfinder. The earlier snap implementation centres tokens on grid intersections; verify the current desired alignment rather than silently changing it to cell centres. Space-drag pans, Ctrl-wheel zooms and Ctrl interactions support selection. Preserve touch/pointer cancellation handling and prevent control clicks from also starting a map gesture.

Fog combines a live reveal radius around PC tokens and persistent explored cells. The default radius is six squares; explored storage is capped at 12,000 entries. Include reveal/cover/reset controls and the choice of monsters above or under fog. Keep hidden and removed token state separate from defeat in the encounter. The active turn highlights the corresponding token.

## Persistence and interfaces

Storage keys are encounterTracker.v1, encounterTracker.vtt.state and encounterTracker.vtt.mapImage. Tracker and popup communicate through same-origin browser storage events. This is not remote multiplayer synchronisation. A unified single-page application must additionally notify its own in-page components because storage events do not provide that internal update mechanism.

The existing campaign JSON export schema is encounter-tracker-campaign@1 and exports the combatant library, not the entire encounter, saved encounters, map and VTT state. Import merges library entries using name|type|maxHp and assigns new IDs. PDF import uses PDF.js text extraction, finds a likely name and HP, defaults missing HP to ten and creates a monster. It is not OCR or a complete stat-block parser. Preserve the bounded feature and clear fallback messages.

Source anchors: app.js defaultState, applyDamageAndMaybeCondition, tickDownConditionsForCombatant, checkAutoEnd, exportCampaignJson; vtt.js loadVttState, renderTokens, stampExploredFromTokens, distanceFeet; index.html, vtt.html, styles.css, vtt.css and sw.js. Copy the webmanifest too; a registration call alone does not prove that offline installation works.

## Acceptance and repair priorities

Two copies of one monster retain different IDs and independent HP. Editing their library source updates the intended shared fields.

Completing one turn damages the selected target, expires only the ending actor's conditions and advances once, including wraparound and defeated combatants.

Map, fog, tokens and measurement remain aligned after resize, fullscreen, pan, zoom and reload. Hidden monsters remain hidden in the player display.

Migrate all three keys. A complete suite backup must include state omitted from the legacy library-only export.

Verify pause/resume: the supplied flow uses Begin to sort and restart the round. Do not present this as a true resume without preserving round and turn.

Repair atomic validation: the damage helper can return after invalid input while Complete Turn continues. Healing also needs an explicit policy for clearing a stale defeated flag. Record these as bug fixes, not new rules.

# 5 M03 Notice Board Quest Generator

## Content and normal use

The current data/quests.json contains 180 quests, not the 100 mentioned in older delivery notes. Preserve IDs and all authored fields: title, province, settlement, quest_type, faction, honour_required, level_min, level_max, difficulty, reward_gp, NPC/poster, description/notice, secondary_rewards and tags. Retain field aliases supported by the renderer.

Filter by province, faction, quest type, party level and clan/temple honour. Current eligibility reads these controls; difficulty appears in quest data but is not read by eligiblePool as a separate filter. Party level is clamped to 7 through 16. Bounties are a special case: shown only for selected party levels 7 through 10, regardless of their own level band. Honour supports object gates such as {clan: 1} and legacy numeric gates with honour_type. Current input selectors expose -3 through 3 for both honour values.

Generate pins one to six notices. If eligible bounties exist, the algorithm selects at most one bounty first, then fills with ordinary quests. Accept stores a quest persistently; decline only removes it from the currently displayed board. Accepted quests are grouped by province and can be selected, removed and marked as the primary quest.

## Outlines and player display

Selecting an accepted quest shows a local deterministic outline: premise, six scene beats, encounter type/setup/twist, checks with DCs, complication and resolution. Seeded selection is based on quest ID, and the outline is cached. This is a template-based generator, not a live AI call. expandQuestOnce explicitly throws because the Cloudflare expansion is disabled. Do not recreate that unfinished extension.

The popout clones the notice-board view for players, hiding the side panels. It is a display clone; cloned buttons do not inherit the original event listeners. Preserve the DM/player separation and make refresh reliable, including clearing an empty board.

Storage keys are si_noticeboard_accepted_v1, si_noticeboard_outlines_v1 and si_primary_quest_id. Firebase activeQuests receives primaryQuest with id, title, quest_type, tags, province, settlement and difficulty, plus updatedAt. If no explicit primary is valid, the first accepted quest is the fallback. Rewards are described in text; accepting a quest is not proof of completion and must not automatically credit gold.

## Content and migration checks

Retain all 180 current records and compare duplicates by ID rather than title. Preserve authored reward amounts instead of applying older generic price bands. The history requested exclusion of old Veinwood/root campaign material from new notice-board content, but buildOutlineFromQuest still contains Root-Woken, Vein-touched and roots text. Flag this as a content discrepancy and replace only with approved alternatives; do not erase such material from the separate Ritual.

Test filter combinations with empty results, honour boundary gates, the bounty exception, one-bounty generation, acceptance deduplication, stable outlines, primary removal and activeQuests updates. Test the fallback when Firebase is unavailable. Source anchors: eligiblePool, honourPass, buildOutlineFromQuest, acceptQuest, renderAccepted, syncAcceptedToFirebase, openBoardPopout and data/quests.json.

# 6 M04 Scarlett Isles Explorer

## Maps and party movement

This is the campaign's travel interface, distinct from the encounter battlemap. The current MAP_PRESETS contains ten maps: Eastern North and South; Midland; Northern East and West; Southern East and West; East Isle; North Isle; Western South. These map to seven event regions. Preserve filenames and map IDs, plus the transition-spawn configuration. The portfolio's older reference to eight maps is not the current content count.

Default party tokens are Kaelen, Umbrys, Magnus, Elara and Charles. Tokens contain id, name, initial, normalised x/y, size, groupId and milesUsed. Preserve selection, grouping, resizing, pointy-top hex grid, offsets, opacity, snap, map upload, fullscreen, hideable controls and Free Move. Free Move deliberately avoids travel costs and event triggers.

Normal movement converts axial hex displacement to six miles per hex. Each moved hero is charged; moves exceeding any affected hero's 30-mile daily allowance are rejected. Group formation and map-transition placement must remain coherent. Pace text is Slow through 18 miles, Normal through 24, and Fast through 30 with the displayed stealth/foraging or passive-perception guidance. These are campaign mechanics, not real-world distance estimates.

## Exploration and events

Fog stores revealed axial cells per map key; markers appear according to revealed fog. data/markers.json stores markersByMapId, normalised coordinates, thumbnails, descriptions and submap image paths. Preserve authored markers and submap presentation; do not assume an unimplemented fully navigable settlement system.

data/events.json contains seven provincial groups. Northern has 39 travel entries; each other region has 40. Campfire entries number 47 in six regions and 40 in North Isle. That is 279 travel and 322 campfire records across the region arrays, including repeated content where authored. Do not deduplicate a repeated regional event in a way that removes its regional availability.

Travel events trigger at most once per day at a random threshold from 6 to 24 miles. Event steps and choices can branch, display media, request table rolls and produce outcome text or gold notes. Preserve IDs, branch links, checks, choice consequences and deity/province context. MAIN_EVENTS contains The Tide Remembers prologue and The Turning Tide, with a forced-event queue that can replace a camp event when due.

Make Camp handles the camp/forced event, increments the day, resets every hero's mileage and prepares the next travel threshold. A Bastion prompt occurs at days 8, 15, 22 and so on using day modulo seven equals one. This is currently a prompt, not an automatic call into the separate Bastion application.

Weather is present in the current source even though older history said it was parked. After a three-day cooldown there is a 45 percent check at camp; the selected event requests a manual roll and shows outcome guidance. Rain, storm, blizzard and sun/heat video overlays last for the day. Preserve the actual table and distinguish displayed consequences from mechanically enforced movement changes.

## Saves and important limitations

The key is scarlettIsles.explorer.v1. saveNow and buildSavePayload contain freeMove, mapSrc, mapPresetId, mapDataUrl, snap, travel, grid, fog and tokens. Import validates basic grid/tokens/travel shape and replaces the local save. Migration must also preserve map identity, reveal sets, forced events, weather dates and group membership.

The runtime has trackers.gold and trackers.log, but the save/export payload omits trackers. applyOutcome displays rations changes without updating a persistent ration balance. Weekly camp code resets the gold tracker. Do not turn this into a shared party wallet without first separating temporary per-player event accounting from persistent gold. These are concrete data-loss and semantic issues to repair or clarify.

Multiple events can open the same modal during one camp action, so camp, weather and Bastion prompts can overwrite each other. The suite should queue them without applying an outcome twice. Preserve the original order of mechanics and explicitly define which day an event belongs to.

Acceptance: a grouped six-mile move charges each member once; an over-budget move rolls back; Free Move is free; fog remains per map after reload; export/import restores the full journey; day 8 prompts exactly one Bastion action; an event cannot be lost behind a weather modal. Source anchors: explorerDefaultState, onTokenPointerUp, applyPartySpawnWithFormation, drawFog, applyOutcome, Make Camp handler, saveNow and buildSavePayload.

# 7 M05 The Ironbow Bastion Manager

## Core model and use

Manage the party's base over seven-day Bastion turns: treasury, level, facilities, construction, orders, defenders, beasts, military, warehouse, crafting, diplomacy, trade and events. Preserve The Ironbow artwork and facility overlays as campaign content while separating the base identity from reusable management rules.

Data files are facilities.json with 18 facilities, tools_tables.json with 12 named tables, events.json with a d100 event table and descriptions, and compendium_items.json. The compendium includes incomplete metadata rows alongside local detail fallbacks; do not present every row as a fully authored item profile. Preserve existing local information and external reference links.

Five facilities start built: Barracks, Armoury, Watchtower, Workshop and Dock. Special construction slots are zero below level 5, two at 5, four at 9, five at 13 and six at 17. Construction time is three turns for required levels 5 through 8, four for 9 through 12, and five for 13 upward. Built, building and reserved facility IDs are distinct; a queued construction must occupy capacity once.

Other facilities include Arcane Study, Garden, Gaming Hall, Smithy, Library, Laboratory, Greenhouse, Menagerie, War Room, Hall of Emissaries, and shrines of all three gods. Preserve each requiredLevel, function, option, cost, duration and reward from JSON. Shrines are level 8; Menagerie is 13 and War Room 17. Six artisan-tool slots feed Workshop crafting options.

Orders queue with completion turns and are resolved on Advance Turn. That action currently increments the turn, ticks diplomacy, resolves active trade, ticks construction, clears the previous event, expires patrol advantage, completes due orders and generates an automatic d100 event when the new turn is divisible by four. Preserve sequencing: expiring an old patrol benefit before completing a fresh patrol order has a meaningful effect.

## Political and economic systems

Keep treasuryGP, warehouse quantities/notes, defenders.count, armed and patrol flags, defenderBeasts and military quantities separate. Same-name military entries may merge using qty; do not count rows as unit counts. Armoury cost currently computes 100 plus 100 per defender. An older description of a Smithy/Workshop discount is not implemented in that cost helper and must not be silently restored as existing behaviour.

Hall of Emissaries supports upgrades, trade agreements, delegations, summits, arbitration authority and consortium activity. Preserve planning modals, manual d20 resolution, outcome tiers, cooldowns, expiring agreements, reputation, political capital, route overlays and the council ledger. Do not reduce it to one generic diplomacy roll.

Trade routes have clan, commodity, risk, yieldGP, stabilityDC/status and expiry information. The network tracks active status, strategy, stability, recruitment boosts and lastResolvedTurn. Route DC starts at 12, changes with stability, risk, strategy and high-risk routing, and is clamped to 6 through 20. Payout includes percentage upgrades and a high-risk bonus; strong success pays 120 percent of the boosted result, normal success the boosted result, failure zero. Preserve routePayout, routeDC and resolver side effects together.

Arbitration queues and resolves disputes; decisions can affect trade and political standing. Facility overlays are implemented in renderBastionMapOverlays, despite an earlier unresolved installation attempt. Preserve PNG alignment and the source's overlay filename mapping, and verify the result visually with the actual assets.

## Identity and war already implemented

The code includes Unsworn, Clan and Mercenary identities. Preserve this existing subsystem without expanding the historically parked territory/war roadmap. Organisation fields include type, name, chief, motto and foundedAtTurn. Clan Honour is 0 through 100, initially 40. Per-clan Honour/Respect is -5 through 5. Trusted Clients is 0 through 100, initially 50. Political Capital is -100 through 100. Divine Favour is a separate 0 through 100 value for each god.

Support for a clan is round((Political Capital + 100)/2 + HonourRespect*4), clamped to 0 through 100. Clan formation requires party level at least 9, total support at least 360 and at least three clans with support at least 55. Mercenary formation requires level at least 7 and at least three defenders.

War actions queue for the next turn. Objectives and DCs are raid 14, skirmish 13, defend 12 and seize_outpost 15. Commitment modifier is min(4, floor(defenders/2)) + min(2, beasts) + min(3, floor((lieutenants+regiments)/2)). Outcomes modify treasury, target Political Capital, casualties and identity-specific scores; preserve the exact deltas and clickable war log from resolveWarOrderAsync. A full strategic warfare simulator is outside scope.

## Saves and acceptance

The current USE_TEST_STORAGE constant is true. The app therefore selects ironbow_bastion_state_v1_TEST rather than ironbow_bastion_state_v1. Inspect and offer both during migration, with provenance and timestamps where available; never assume the production-named key contains the latest played state. Download Save exports state; import replaces it after confirmation. Preserve normalisation for old builtExtras and military structures.

Test level and support gates at both sides of each boundary; facility capacity while building; treasury deductions; one-time order completion; manual-roll cancellation; route expiry; trade payout only once per turn; warehouse saves; overlays; test and production save import. Advance Turn removes due orders before awaited resolution, so cancellation or reload can lose unresolved work. Replace this with a resumable transaction while preserving the rules.

Source anchors: loadState, constructionSlotsForLevel, buildTurnsForRequiredLevel, issueOrderWithMeta, completeOrderAsync, tickConstruction, renderBastionMapOverlays, tickDiplomacyOnAdvanceTurn, routeDC, routePayout, resolveTradeRoutesModal, supportForClanKey and resolveWarOrderAsync. The facility JSON is the detailed catalogue, not the older README.

# 8 M07 Clan Crest Creator

This is a procedural SVG editor with transparent PNG export, not a generative image API. Preserve the editable clan name, random name, randomise-all, reset and live preview. The controls cover shield shape, border style/width, field pattern, palette, texture, sigil/scale/fill mode and banner style/text.

Current libraries contain six shield shapes, five border styles, eight field patterns, four textures, twelve palettes, sixteen sigils and four banner options including none. Shields are heater, round, kite, Spanish, Gothic and oval badge. Patterns are solid, per fess, per pale, per bend, quarterly, chevron, stripes and cross. Sigils include sword, twin swords, crown, tree, wave, mountain, moon, sun, eye, anchor, book, runic knot, stag, flame, mini shield and compass.

The SVG design space is 1024 by 1024; export rasterises it to a 2048 by 2048 PNG with no background fill. Preserve clipping paths, texture/filter definitions, border treatment, two-tone rendering, banner typography, escaping and safe filenames. Random names combine the actual source name banks; a name suffix is selected with 55 percent probability.

The current editor state is in memory, with no localStorage persistence found in app.js. Saving editable designs in the suite is a proposed improvement; the existing completed output is the downloaded PNG. Do not describe current SVG download or an AI-generation backend as existing features.

Source anchors: state, SHIELDS/BORDERS/PATTERNS/TEXTURES/PALETTES/SIGILS/BANNERS, draw, renderPattern, renderSigil, renderBanner and downloadSvgAsPng. Test every control, escaped names, randomisation, long banner text and exported dimensions/transparency. Use unique SVG definition IDs if multiple crest previews share one document. Optional suite integration can attach an exported crest or saved design parameters to a Bastion identity after fidelity is established.

# 9 M08 Arenas of The Scarlett Isles

## Current game loop

The current build is a cinematic hybrid skill-check and attack minigame. It has evolved beyond the earlier lightweight grid-board README. Preserve the current POV scenes, enemy-state overlays, hit/failure animation, crowd and combat sounds, player/enemy HP panels, turn dock, rules dock, results and progression. Do not revert it to the older draggable-board concept merely because the README is simpler.

Two arenas contain six rounds. Add players with name, HP and image; select the arena and round; enter and read the rules; choose a living player and skill approach; select Easy/Standard/Hard and a modifier; roll the skill check; optionally roll an attack and apply numeric or NdM damage to a target; resolve the turn. Skill and attack are separate. A successful attack is compared with hit_dc, not a complete imported D&D armour/attack model.

## Exact round configuration

| **Arena round ID** | **Successes / failures** | **Skill DCs easy standard hard** | **Failure damage** | **Prize GP** |
| --- | --- | --- | --- | --- |
| Swyth r1 | 6 / 3 | 13 15 17 | 2d6 | 500 |
| Swyth r4 | 9 / 3 | 16 17 19 | 5d6 | 5000 |
| Swyth r5 | 12 / 2 | 17 18 20 | 8d6 | 50000 |
| Middlemount mm_r1 | 6 / 3 | 13 15 17 | 2d6 | 1000 |
| Middlemount mm_r2 | 8 / 5 | 15 17 19 | 5d6 | 8000 |
| Middlemount mm_r3 | 10 / 5 | 16 18 20 | 6d6 | 25000 |

Swyth rounds deliberately retain IDs r1, r4 and r5 while displaying rounds one, two and three. Do not renumber IDs during data migration. Attack DC/default damage is 14/2d8, 15/2d10 and 16/3d10 for each arena's three rounds. Enemy rosters are two 45-HP duelists; one 95-HP Razor-Boar and two 55-HP Hooked Hyenas; a 200-HP Wyvern; two 45-HP duelists; three 45-HP Lion Totems plus two 90-HP Lion Swordsmen; and one 220-HP Lion Knight.

Swyth Beast-Pen grants two successes once per player for a successful Hard Animal Handling check. Middlemount Lion Totems tracks three totems; destroying the last also defeats remaining guardians. The current generic score-victory path still exists despite the round text emphasising totem destruction, so test and settle that precedence explicitly. Lion's Mark failures hurt the marked living player instead of the active player; two players at zero HP is an additional defeat condition in mm_r3.

Turn limits are six, eight, eight for Swyth and six, seven, seven for Middlemount. Beyond the limit, overtime can add failures and damage one randomly selected living player. The data key party_damage_each_turn does not mean every party member is damaged. Copy each overtime expression from arenas.json.

## Outcomes and state

Reaching the success target can finish a round; failures or a party wipe can lose it. Defeating all enemies currently indicates the round can be ended as a win, rather than automatically following the same path as score victory. Resolution precedence matters if a turn meets multiple conditions. Winning adds the round prize to totalGold and presents HP/score and next-round or leave controls.

Storage key tsi_arenas_state_v3_pov saves players with HP/portraits, totalGold, arenaId and roundId. It does not save the complete active enemy, success/failure, turn and overlay state. Portraits are compressed, with a quota fallback that drops images. Do not promise mid-round resume until the suite implements a full run save.

Source anchors: data/arenas.json; startRound, openTurnDock, resolveTurnFromDock, applyFailureToPlayer, applyOvertimePressure, ensureLionsMark, endRound and overlay/SFX maps. Preserve each named enemy's living/dead overlay combination; do not use one interchangeable effect for all encounters.

Acceptance: exercise all six rounds, a marked-player failure, Beast-Pen bonus only once, final totem death, overtime, KO and score victory, defeat and reload. Guard Apply Damage and End Round against duplicate application; the code sets damageApplied but the inspected Apply handler does not reject an already-applied hit. Store roll results as data rather than inferring pass/fail from a rendered tick symbol. Add tests before changing those mutation paths.

# 10 M09 The Heartwood Ritual

## Presentation and control

This is the completed Tellurian finale engine. Retain its animated Heartwood, three stones, pulse and heartbeat response, round pips, event preview/application, threat panel, manual-roll action modals, log, DM dock, reset, sound toggle and ending cinematics. Entry files are index.html, ritual.js and styles.css, with cinematics/player.html and local media. It is a table-assisted encounter, not automated player combat.

## Exact ritual rules

There are eight rounds. Weight, Memory and Silence each hold progress 0 through 3, stress 0 through 4, locked and cracked flags. Three progress locks an uncracked stone. Stress four cracks it irreversibly in the normal action flow and prevents further attempts or assistance. A single cracked stone does not immediately end the ritual. All three cracked causes immediate failure. All three locked seals the ritual immediately.

Weight succeeds when the entered result meets 12 plus that stone's stress. Success adds one progress; failure adds one stress. Assist arms advantage for the next table roll, entered as its final result; failing despite the armed assist adds an additional stress. The assist is consumed.

Memory targets are six in rounds 1 to 2, seven in rounds 3 to 5 and eight thereafter. Assist adjusts the next target, clamped to 2 through 12. An exact result adds progress and removes one stress; one away adds progress; farther away adds stress. Preserve the special target mechanic rather than rewriting it as a normal d20 threshold.

Silence DC is max(8, 10 + stress - spell slot), with slot clamped to 0 through 9. Success adds progress and failure adds stress. Assist stores a slot value for the next attempt. The current code prioritises the armed preset over typed input even though its comment suggests an override; fix the interface or precedence explicitly.

Six events are Root Surge, Echo of What Was, Arcane Backwash, False Calm, Veinwood Thrum and Moment of Reprieve. They stress Weight, Memory, Silence, nothing, all eligible stones, or relieve the highest-stress stone respectively. Event stress skips locked stones; non-event stress has a different path. Rolling or cycling previews an event; Apply Event mutates state.

## Threats and endings

Threats are Rootbound Husk with 35 HP, Rootbound Buckbear with 55 and Rootbound Wyvern with 120. On round advance an unresolved Husk adds stress to a random stone; Buckbear stresses all; Wyvern can cause immediate fractured failure. Threat damagePerRound fields are not equivalent to an automated party HP system.

Threat triggers reside in updatePulse: Husk has a 50 percent check at total stress at least six; Buckbear can enter from round six with no locks; Wyvern becomes eligible automatically from round seven or through combinations of stress/fracture conditions. Wyvern can replace a Husk but does not replace an active Buckbear. Defeating the Wyvern removes one stress and adds two progress to each stone, then sets noMoreIntrusions. Preserve the actual ordering, including cracked-stone limitations.

At the final-round resolution, three locks produce True Seal. Otherwise two or more cracked stones produce Fractured Containment; zero or one produces Strained Binding. The source uses a failed phase for both imperfect containment outcomes. Do not rewrite both as total narrative destruction merely from the enum name.

Cinematics reference GitHub Release tag v1.1-ritual-endings: true_seal.mp4, strained_binding.mp4, fractured_containment.mp4 and wyvern_emergency.mp4. These remote release assets are additional to the repository's local video folder. Capture and preserve them during implementation. The final seal overlay waits for the cinematic and has a media-error fallback. Audio includes heartbeat_loop and progress/stress/lock/interrupt/seal effects.

## Reliability and acceptance

No localStorage persistence is implemented in ritual.js. Reload restarts the encounter. Suite checkpointing is a proposed addition. Threat randomness currently occurs in a render-related function; repeated UI renders can therefore affect game outcomes. Move random decisions into explicit actions with stored results, documenting the intended once-per-action semantics. Prevent repeated event application or duplicate finale media when controls are clicked twice.

Test all stone success/failure boundaries, consumed assists, crack behaviour, locked-stone event immunity, each threat and its defeat, early seal, both timeout endings and missing-video fallback. Reference functions: applyModal, addStress, setLockedIfComplete, updatePulse, nextRound, resolveThreat and openCinematic. Historical narrative suggestions about different ritual paths are not a replacement for this implemented engine.

# 11 M10 Pelagosi Puzzle Trials

## The Marker Remembers

pelagosi_marker_rune_puzzle is a completed two-mode app. Its current first mode is a memory trial, not the superseded three-rune drag puzzle described in some early conversations. The five runes are Anchor, Tide, Depth, Life and Remains. A generated master sequence feeds rounds of length three, four and five. Flash/gap timings in milliseconds are 950/260, 700/220 and 520/180. Preserve input locking while showing the sequence, round feedback, clue progression, aura, tremor and reset behaviour.

A wrong answer triggers a surge, locks input, animates failure and restarts the trial. The displayed in-world consequence is a DC12 Dexterity save within 15 feet, otherwise prone and pushed ten feet. The app presents that instruction rather than editing character sheets. Final success restores the keystone, reveals deliberate removal and the Aurushi sunburst, then plays staged underwater/tremor feedback and a success modal.

## The Tidal Sequence

Phase one independently rotates a rune and direction on four pillars. The exact solution is top-left Flow/right, top-right Echo/down, bottom-right Depth/left and bottom-left Stone/up. Rune choices are Flow, Echo, Depth, Stone, Current and Anchor; direction order is up, right, down, left. Phase two unlocks the central basin, whose solution is Current. Anchor is the initial tempting wrong basin answer.

Wrong checks increase pressure through Calm, Stirring, Rising, Reversing and Surge. At Reversing the displayed consequence is DC13 Strength or a ten-foot pull toward the basin. At pressure four the surge instructs DC14 Dexterity or 2d6 bludgeoning and prone, then resets. Preserve outer-loop completion, basin unlocking, attempts, progress feedback, start/reset/randomisation controls and the success sequence.

Source anchors: MEMORY_ROUND_CONFIG, buildMasterSequence, playRoundSequence, handleRuneInput, handleFailure, solveMemoryTrial, TIDAL_SOLUTION, TIDAL_PRESSURE_STATES, checkTidalAlignment and solveTidalSequence. Preserve both artwork compositions and the five WAV files: cavern-open, puzzle-fail, puzzle-solve, rune-click and rune-place. The current state is in memory; adding save/resume is a suite enhancement.

Test switching modes during playback, reset during every delayed animation, wrong input and correct completion for both modes, the fourth-pressure reset, and repeated click protection. Cancel stale timers and playback when leaving a module so a previous puzzle cannot open a modal over another tool.

# 12 Integration decisions that must remain explicit

## Separate faction values

Divine Favour, Political Capital, Support, Clan Honour and Trusted Clients are separate quantities with different ranges; a shared faction ID does not make their values interchangeable.

## Time and money ownership

Use one in-game day service for travel and acknowledged Bastion turns. Starting on day one means the first seven elapsed travel days lead to the day-eight prompt. Do not auto-run a Bastion turn again when reloading that day.

Keep Bastion treasury, Arena prize total, Explorer event tracker and any future player wallet separate until transfer rules are agreed. Existing quest rewards and puzzle consequences often remain table-adjudicated. A shared suite should not silently deduct HP, consume rations or credit the same reward twice merely because modules can now talk to each other.

## Source and presentation differences

Current source wins over old feature summaries: ten Explorer maps, 180 quests, six Arena rounds and two current Pelagosi modes. The source also contains defects; preserve successful user workflows rather than blindly retaining every coding mistake. Keep scarlet/burgundy, gold, dark panels and readable parchment elements where used. Preserve the distinctive ritual and arena presentation and all three gods; do not reskin the whole suite as a generic nautical dashboard.

# 13 Recommended master repository architecture

Use one repository and one deployable suite, with modules separated by domain. A lightweight TypeScript build is a reasonable proposal for maintainability, but no framework migration is required merely to make the folder structure look modern. Choose the stack after running the original flows. Keep large authored data and audiovisual assets outside UI component code where practical.

| **Proposed path** | **Responsibility** |
| --- | --- |
| apps/suite | Router, campaign selection, navigation and entry points |
| modules/encounters and modules/battlemap | Combat rules, DM UI and player projection |
| modules/quests, explorer, bastion | Campaign systems and their own state |
| modules/crests, arenas, ritual, puzzles | Remaining completed tools |
| packages/domain | IDs, typed records, rule policies and action contracts |
| packages/storage | Local database, backups and legacy migrations |
| packages/sync | Shared service adapter, permissions and conflict handling |
| packages/ui | Shared accessible controls and design tokens |
| content/scarlett-isles | Versioned quests, events, facilities, items and scenarios |
| public/assets | Namespaced images, audio, video, fonts and icons |
| tests and docs | Regression fixtures, acceptance flows and owner guides |

The shell owns campaign identity and navigation. Modules own their rules and transient UI; they receive state and dispatch explicit actions. Avoid combining the old app.js files as global scripts: they reuse names such as state, el, render, app and Firebase initialization, plus generic CSS classes and DOM IDs. That approach will create collisions and duplicate listeners.

Use campaign-scoped stable IDs for people, factions, maps, quests, items and encounters. Preserve legacy IDs in migration mappings. Encounter instances remain distinct from character/library records. Preserve independent current HP unless the user explicitly commits an encounter result to a shared character. Loaded encounter templates should still be fresh encounters.

A proposed versioned save envelope contains schemaVersion, campaignId, contentVersion, createdAt, updatedAt, moduleStates, assetReferences and migrationProvenance. Prefer IndexedDB for larger maps and portraits, with explicit export packaging; localStorage remains a migration source and can hold small preferences. A downloadable backup must include uploaded assets or clearly list unresolved external dependencies.

Wrap Firebase behind a shared service adapter. The existing activeQuests data must remain recoverable. Introduce campaign namespacing only through a deliberate migration; preserve the old campaign's global-node data in a snapshot. The exact database rules, ownership and auth configuration must be checked before live writes. Public Firebase configuration is not sufficient evidence of either security or insecurity.

Player views should receive only their approved projection: visible tokens/maps and published notices. Hiding DM panels in CSS is not a privacy boundary. Same-device popouts can use an explicit message channel and validated messages; remote cross-device features should use authorised shared state. Do not promise remote VTT multiplayer when only the current quest data is remotely synced.

# 14 Migration and implementation sequence

## Phase one establish the baseline

Record each repository tree and branch, capture all assets including GitHub Release videos, and run each module with sample data. Build a feature matrix with source anchors and screenshots of key states. Inspect JSON references and all dynamic asset mappings, especially arena overlays, facility overlays and map transitions. Preserve original repositories read-only during the reconstruction.

## Phase two protect existing campaign data

On the browser/device used to play, export every legacy key before changing anything. Capture both Bastion keys, all three Encounter/VTT keys, Explorer state, quest acceptance/outlines/primary and Arena profile. Obtain a separate authorised Firebase export for the shared activeQuests node and preserve service configuration/rules. Browser state on another device cannot be inferred from GitHub.

Implement dry-run imports into a new campaign with a human-readable report: source, counts, old/new IDs, fields restored, unknown fields retained, assets copied and anything unrecoverable because the old tool never saved it. Preserve raw legacy payloads. Validate malformed data and unsupported schema versions without erasing a working campaign. Do not attempt to invent missing mid-round Arena or Ritual history.

## Phase three restore each completed module

Port one module at a time behind the suite navigation. Keep domain functions testable separately from UI rendering. Preserve content and presentation before changing game rules. Start with Encounter/VTT and Quest Generator because their import paths establish the shared model; then Explorer and Bastion; then crest, arenas, ritual and puzzles. This order is a proposal, not a dependency that should block independent working modules.

## Phase four integrate explicit actions

Link Explorer's weekly prompt to an acknowledged Bastion advancement with an idempotency key. Allow optional transfers of earned rewards or encounter HP only as visible owner-approved actions. Keep a small audit log of important mutations and undo where safe. Do not introduce automatic flows from the incomplete World Hub.

## Phase five release and hand over

Test a copied real campaign end to end, then deploy the suite under its repository base path with reliable deep links. Preserve popup functionality and asset URLs after route nesting. Give the owner numbered steps for install, run, build, deploy, import, export, restore and adding content. Provide a release checklist and rollback procedure. Keep old deployments available until the user accepts the migrated campaign.

# 15 Required regression and delivery checks

## Functional gates

Every included module opens from the home page and works without depending on an excluded project.

All authored content counts and stable IDs match the migration manifest; no placeholder datasets replace current content.

Encounter rules, travel distance, Bastion gates, Arena special cases and both puzzle modes pass their module checks.

The ritual completes through True Seal, Strained Binding and Fractured Containment with correct media fallback.

A full campaign export/import round trip preserves saved state and uploaded assets. Old saves remain untouched until migration is accepted.

## Reliability gates

Keep randomness out of rendering. Store resolved results before effects, sounds and animations. A rerender, popup refresh or back navigation must not reroll a threat or apply a reward. Disable or deduplicate actions while resolving. Model Bastion advancement and Arena completion so interruption can resume safely.

Check popup blockers, file import rejection, quota exhaustion, missing images/audio/video, CDN failure, offline status and shared-service errors. A caught initialization error does not guarantee offline operation when an ES module import itself cannot load. Service-worker caches must be versioned and scoped so an old standalone worker cannot keep serving stale suite files. Bundle dependencies where the intended offline contract requires it.

Test normal laptop and large-screen DM views, fullscreen controls, keyboard navigation, focus in modals, touch gestures, readable contrast and reduced-motion/audio controls. Do not run Space-to-pan shortcuts while the user is typing in an input. Dispose listeners, timers, audio and observers when switching modules.

## Deliverables and definition of done

The final master repository must contain working source, current content, a complete asset manifest, reproducible build instructions, a deployment configuration, example safe fixtures, schema and migrations, automated rule tests and documented browser acceptance results. Include a concise owner guide and a coding-agent maintenance guide identifying where to add quests, maps, facilities, arenas and media.

Provide a known-issues list separating inherited defects, deliberately changed rules, unresolved owner decisions and verified limitations. Record security-sensitive settings as deployment configuration. Keep source provenance and notices for third-party libraries and campaign assets.

Do not declare completion while modules are merely links, content is scaffolded, saves are incomplete, or key acceptance checks are untested. A single coherent suite must preserve the established tools' useful behaviour and make their shared state understandable and recoverable.

# 16 Evidence and provenance register

The following register identifies the public source trees reviewed on 25 September 2026. Fingerprints are Git tree SHAs returned by the GitHub tree API, not release numbers or claims of live deployment status. Each module section names its principal files and functions. Use full repository exports supplied by Harry for implementation, including binary assets and any newer changes.

Supporting evidence includes CODE (2).pdf for the historical Encounter/VTT implementation; HH Creative Portfolio.pdf, pages 5 to 10, for the played Ritual and wider tool suite; and Harry_Hudson_CV_Creative_Technologist.docx for the shipped browser-tool inventory. Historical conversations from January to May 2026 informed scope and exclusions. Current source corrected several stale counts and mechanisms. No private Firebase campaign data was read or modified for this review.

## M01 source reference

Repository: [https://github.com/hjhudsonwriter/scarlettisles-encounter-tracker](https://github.com/hjhudsonwriter/scarlettisles-encounter-tracker)

Source tree: 5eb724c1c0b4fbdd1ab66eb413ffad17161beeb2

Historically linked Pages address: [https://hjhudsonwriter.github.io/scarlettisles-encounter-tracker/](https://hjhudsonwriter.github.io/scarlettisles-encounter-tracker/)

## M03 source reference

Repository: [https://github.com/hjhudsonwriter/scarlett-isles-quest-generator](https://github.com/hjhudsonwriter/scarlett-isles-quest-generator)

Source tree: 093601f239a23cef103deabcfcdc8da55197103f

Historically linked Pages address: [https://hjhudsonwriter.github.io/scarlett-isles-quest-generator/](https://hjhudsonwriter.github.io/scarlett-isles-quest-generator/)

## M04 source reference

Repository: [https://github.com/hjhudsonwriter/scarlett-isles-explorer](https://github.com/hjhudsonwriter/scarlett-isles-explorer)

Source tree: f7004d66a4fc852b6bca20a39cd00e933965dfb2

Historically linked Pages address: [https://hjhudsonwriter.github.io/scarlett-isles-explorer/](https://hjhudsonwriter.github.io/scarlett-isles-explorer/)

## M05 source reference

Repository: [https://github.com/hjhudsonwriter/bastion_manager](https://github.com/hjhudsonwriter/bastion_manager)

Source tree: 5668db38d7383646caf0fc83d08e62c7af096b4b

Historically linked Pages address: [https://hjhudsonwriter.github.io/bastion_manager/](https://hjhudsonwriter.github.io/bastion_manager/)

## M07 source reference

Repository: [https://github.com/hjhudsonwriter/clan-crest-creator](https://github.com/hjhudsonwriter/clan-crest-creator)

Source tree: 5df97c08bc0656cd52314374350fb3814253e9fe

## M08 source reference

Repository: [https://github.com/hjhudsonwriter/arenas-of-the-scarlett-isles](https://github.com/hjhudsonwriter/arenas-of-the-scarlett-isles)

Source tree: 72752497ebc2eceee73085b154041a6c6175e1a8

## M09 source reference

Repository: [https://github.com/hjhudsonwriter/tellurian-ritual-engine](https://github.com/hjhudsonwriter/tellurian-ritual-engine)

Source tree: 8b51ff98553f7f7123696548915000edae311608

## M10 source reference

Repository: [https://github.com/hjhudsonwriter/pelagosi_marker_rune_puzzle](https://github.com/hjhudsonwriter/pelagosi_marker_rune_puzzle)

Source tree: 0c7e659185ec215a5baefc2dae991de38e48f635

# 17 Legacy storage checklist

The table lists exact known keys or remote nodes. It is a migration checklist, not a guarantee that the old application saved every runtime field.

| **Module** | **Legacy location** | **Important scope** |
| --- | --- | --- |
| Encounter | encounterTracker.v1 | Library, saved encounter templates, current encounter and UI target |
| Battlemap | encounterTracker.vtt.state | Camera, tokens, grid, fog and visibility |
| Battlemap image | encounterTracker.vtt.mapImage | Uploaded map data URL |
| Quests | si_noticeboard_accepted_v1 | Accepted quest records |
| Quest outlines | si_noticeboard_outlines_v1 | Deterministic outline cache |
| Primary quest | si_primary_quest_id | Chosen quest ID |
| Explorer | scarlettIsles.explorer.v1 | Saved journey; legacy tracker omission requires attention |
| Bastion production | ironbow_bastion_state_v1 | Inspect alongside test key |
| Bastion test | ironbow_bastion_state_v1_TEST | Selected by reviewed current source |
| Arena | tsi_arenas_state_v3_pov | Players, HP, gold and selection; partial run save |
| Firebase | activeQuests | primaryQuest and updatedAt |

Crest Creator, Heartwood Ritual and Pelagosi Puzzle Trials have no app-state localStorage persistence in the inspected scripts. Also retain discovered UI preference keys and any unfamiliar fields in raw legacy snapshots until they have been classified.

# 18 Final implementation brief

Rebuild the eight included completed tools as a single Scarlett Isles suite. Preserve current content, media, mechanics and useful workflows. Use the supplied repositories and this document to establish a tested baseline before restructuring. Keep excluded unfinished projects outside scope. Import legacy browser and Firebase data through validated, reversible migrations. Make conflicting rules explicit, fix demonstrable bugs without inventing campaign rules, and provide a working end-to-end release with complete backup and owner instructions.
