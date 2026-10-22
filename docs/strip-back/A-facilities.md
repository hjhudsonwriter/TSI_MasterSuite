# AREA A: the 13 facilities to remove (analysis only, nothing in the repo was changed)

Repo: `/home/user/TSI_MasterSuite`, branch `claude/gallant-ramanujan-klwz70` at `4f1db26`.
Everything below was read from the code at that commit. Where I say "verified", I ran the real rules files in a scratch page (`.../scratchpad/analysis/scratch.html`, `sim1.js`) against the seven real saved Bastions in `tests/fixtures/`, with the 13 facilities stripped out of the data. Where I say "read", I read the code but did not run it.

---------------------------------------------------------------------

## 0. The short version

* The Bastion's data has **22 facilities and 73 orders** today. The 13 to remove hold **73 of those orders** (Menagerie 1, War Room 4, Library 2, Arcane Lab 3, Armoury 1, Watchtower 2, Barracks 2, three Shrines 6 each = 18, Wyvern Roost 14, Griffin Tower 13, Dire Wolf Den 13). 9 facilities survive; with the new Temple and Beast Pit that is 11.
* **The handover calls them "Temple of Telluria / Aurush / Pelagos". In the code they are "Shrine of ..." (`shrine_telluria`, `shrine_aurush`, `shrine_pelagos`)**; nothing in the Bastion is called "Temple of ..." (that wording only exists for in-world provinces in `shared/data/regions.js` and for Notice Board quest factions). Same people, different name: treat "Temple" as the new name of the merged Shrines.
* Three of the 13 are **starting facilities** (Barracks, Armoury, Watchtower: always built, no construction slot, listed in `startingBuilt`). Ten are built in construction slots. After the change only **Workshop and Dock** start built.
* What **moves** (per the handover): Library + Arcane Laboratory content into the Workshop's Scholar (L3) and Alchemist (L4); three Shrines into one Temple; Wyvern Roost + Griffin Tower + Dire Wolf Den into the Beast Pit. What **simply disappears**: Menagerie, War Room, Armoury, Watchtower, Barracks, and the leftovers listed in section 3.
* **Gaps in the handover** (things it does not say): the Barracks' Guard Commercial Convoy and the Watchtower's Protect Maritime Approaches both feed the Dock's voyage-risk system (section 3.2); the Shrines' Craft order and two of their three Pray options; the Bastion Defenders / Menagerie Beasts / Military lists in the Management panel (every source of them is being removed); how the Temple levels; how many of a god's four blessing orders make the "3" (section 7).
* **The migration is the hard part.** An old save with a Roost, Library, Shrine, War Room or Laboratory built would, if we just deleted the data, keep a **ghost tile in a construction slot** that opens no panel and cannot be demolished from the screen (verified), and its pending orders would be **thrown away silently when due, with their gold** (read: `tool.js` `completeOrder` final branch; `R.dropOrderGoods` only logs when the order held goods). A proper v3 to v4 migration, modelled on the existing `R.migrateToV3`, is needed (section 5).
* The **Beast Handler phone/companion goes empty** if `creatures-data.js` `species.*.home` is not re-pointed at the Beast Pit's id (verified in code: `P.homes` drops a species whose home facility is not in the data).
* **Silent-bug trap in the Temple:** `R.shrineGod()` only matches the id pattern `shrine_(telluria|aurush|pelagos)`. A facility called `temple` gets `''`, so `R.favourBlocker` returns `''` and `R.issueOrder` does `s.favour[''] -= ...`; favour would never be charged and `s.favour['']` would be created. The Temple needs its own god lookup (section 7).

---------------------------------------------------------------------

## 1. Where the facilities live (index of files)

| What | File and lines |
|---|---|
| Facility definitions (orders, options, costs, days, level gates) | `tools/bastion/data/facilities-data.js` (2811 lines). Definitions start: workshop 74, barracks 264, watchtower 292, dock 320, armoury 377, war_room 393, arcane_laboratory 461, library_scriptorium 611, herbal_gardens 665, fishery_smokehouse 991, timber_sawmill 1144, stone_masonworks 1297, weavers_hall 1456, courier_exchange 1615, hall_of_emissaries 1623, menagerie 1810, wyvern_roost 1892, griffin_tower 2080, dire_wolf_den 2258, shrine_telluria 2436, shrine_aurush 2558, shrine_pelagos 2691. The long header comment (lines 1-72) describes every earlier decision. |
| Which facilities start built | `tools/bastion/data/bastion-data.js` line 8 `startingBuilt: ['barracks','armoury','watchtower','workshop','dock']` |
| Tile paintings | `bastion-data.js` `facilityImages` (from line 14) and `facilityTileCrops` (from line 37: wyvern_roost, griffin_tower, dire_wolf_den use crops of the map overlays; the other four crops are plot facilities) |
| Map label positions | `bastion-data.js` `mapLabels` (from line 70) |
| Map overlays (what is drawn on the painting when built) | `bastion-data.js` `map.overlays` (from line 160) |
| What a level adds besides orders | `bastion-data.js` `levelEffects` (from line 111): `dock`, `courier_exchange`, `griffin_tower` 121, `dire_wolf_den` 122, `war_room` 123, `hall_of_emissaries` 124, `herbal_gardens` |
| Old retired ids (smithy, arcane_study, laboratory, library, garden, greenhouse, gaming_hall) and their v2 to v3 conversion | `bastion-data.js` `retiredFacilities` (from line 133) and `rules.js` `R.migrateToV3` (lines 227-329) |
| Slot and plot counts, build days, level cap | `rules.js` `R.constructionSlotsForLevel` 1172 (0/2/4/5/6 at party level <5, 5-8, 9-12, 13-16, 17+), `R.plotsForLevel` 1215 (data `developmentPlots`: 0/2/4/6 from party level 1/9/13/17), `bastion-data.js` `time.buildDays` (21 days at required level 5-8, 28 at 9-12, 35 at 13+), `levels` (max 5; upgrade 7/14/21/28 days, no gold) |
| Per-facility special code in rules | `rules.js`: shrine id regex 624; `R.computeFnCost` Armoury cost 1740; Library research note 1928; favour spend 1933-1948; `completeSimpleOrder` 2598-2724: favour_blessing/oracle_hint/blessing_rest 2626-2640, Barracks 2641, Watchtower 2646, Armoury 2651, `protectionWindow` 2659, Convoy 2666, Pelagos blessing 2674, Great Rite 2682, War Room drill/muster/recruit 2689-2698, Menagerie 2699, Hall upgrade 2704; Hall's Register Port Charter lookup 917 |
| War Room rules | `tools/bastion/regiment-rules.js` (whole file: hard-codes `'war_room'` at lines 270, 278, 301, 327, 346, 381), `tools/bastion/data/war-room-data.js`, `war-campaign-rules.js` (`R.recruitUnit` ~288-330, `R.warCouncilOpen` ~478-484) |
| Creature (beast building) rules | `tools/bastion/creature-rules.js` (housing, rooms, training, first flight), `tools/bastion/data/creatures-data.js` (species `home`, `room`, `roomBase`, `trainingPlaces`, `trainingBonus`) |
| Voyage protections | `tools/bastion/data/commerce-data.js` lines 151-155 (`protections`), `tools/bastion/commerce-rules.js` 244-262, 754-785 |
| Screens | `tools/bastion/tool.js`: grid order 3166-3167 (`GRID_START`); `fnRow` 3350-3460; War Room Recruit picker 3388/3493; `renderFacPanel` 3820-3860 (adds `regimentSection`, `shrineSection`, `creatureSection`); Dock protection list 3898/3927; `shrineSection` 4105; `regimentSection` 4124; `creatureSection` ~4170; construction picker 4437-4520; Management panel 1447-1640; Favour panel 779-815 and 882; day loop 4842-4866; `completeOrder` 4930-5000; War Council lock text 5425; `debug.reveal` mapping 5630-5650; top-bar facility count starts at the text "5" (5352) |
| Shared (DM doc, Explorer) | `shared/js/campaign-rules.js` (`FACILITY_NAMES` 37-43, `inDaysSave` 52, `bastionComing` 70-160); `shared/js/bridge-rules.js` line 143 `FALLBACK_CREATURES` with the three homes; `shared/data/party-items.js` (the seven Shrine items' text "(from the Shrine of ...)") |
| Beast Handler | `tools/beasthandler/projection.js` `P.homes` 70-77, `ordersFor` 143-190, snapshot 245-285; `bastion-link.js` 278-310; `model.js` 71; `view.js` 239-261, 422, 450-498 |
| Script manifests that list the war and creature files | `shared/data/tools.js` (Bastion tool lines 84-120, Beast Handler 194-222), `tests/rules.html` lines 79-100, `tests/harness.html` (uses tools.js) |

---------------------------------------------------------------------

## 2. The 13 facilities, one by one

Build time comes from the facility's `requiredLevel` (party level): 21 days at 5-8, 28 at 9-12, 35 at 13+. "L" = the facility's own level (1-5) that unlocks an order (`requiredFacilityLevel`). Every facility also has the generic **Upgrade** row (7/14/21/28 days to reach L2/L3/L4/L5, no gold), which is not in its data.

### 2.1 Barracks (`barracks`), starting facility, party level 5
Definition `facilities-data.js` 264-291.
* **Recruit Defenders** (`recruit_defenders`): L1, 5 days, 0 gp. On completion rolls 1d4 and adds that many to `state.defenders.count` (`rules.js` 2641-2645).
* **Guard Commercial Convoy** (`guard_commercial_convoy`): L2, 3 days, 0 gp, `protectionCharge: 'commercial_convoy'`, `protectionMax: 1`. Adds one "Commercial Convoy" charge (max 1 held) to `state.tradeNetwork.protections.commercial_convoy.charges` (`rules.js` 2666-2672). The next cargo ship the Dock sends uses it up: its chance of trouble at sea is 5 points lower. Refused while a charge is already held (`R.protectionBusy`, `commerce-rules.js` 763).
* **Provides to:** the **defenders count** (read by the Management panel, the War Council lock, the war: `war-campaign-rules.js` 484, 559, 693, 748, 1357; `war-battle-rules.js` 848-854); the **Dock** (Convoy charge).
* **Depends on it:** `commerce-data.js` line 152 (`facId: 'barracks'`); `tool.js` 3166-3167, 3357 (comment), 5425 (war-lock wording "Recruit defenders at the Barracks"); level-effect text none.
* **Saved state:** `facilityLevels.barracks`, pending orders with `facId: 'barracks'`, `defenders.count`, `tradeNetwork.protections.commercial_convoy`.
* **Art:** `assets/facilities/barracks.png` (tile). No map overlay: the building is painted into `map/bastion_base.jpg` (the base painting keeps showing it after removal). Label in `mapLabels.barracks` {1530, 250}.
* **Tests:** `tests/rules/bastion.test.js` (30 mentions), `bastion-campaign.test.js` (21), `commerce.test.js` (10), `campaign.test.js` (2), `explorer.test.js` (1); e2e `bastion-screen` (13), `phase9` (8), `charter-terms` (4), `bastion-days` (3: it uses Barracks Recruit Defenders as its sample order), `phase8` (1: a hand-written Barracks order). Fixtures: all seven.
* **Verdict:** disappears. Its Convoy has no stated new home (question Q4).

### 2.2 Armoury (`armoury`), starting facility, party level 5
Definition 377-392.
* **Arm Defenders** (`arm_defenders`): 3 days, cost **100 gp + 100 gp x current defenders** (hard-coded in `R.computeFnCost`, `rules.js` 1740). On completion sets `defenders.armed = defenders.count > 0` (2651). The Armed flag then stays on (known behaviour, `BASTION-EXPLORER-REFERENCE.md` line 882).
* **Provides to:** the war only (`war-battle-rules.js` 451, 850, 1903: unarmed defenders get an Attack penalty); the Management panel text "Armed / Unarmed" (`tool.js` 1628).
* **Depends on it:** `tool.js` only (grid order). Nothing else.
* **Saved state:** `defenders.armed`, pending orders (which carry gold already paid in `costGP`).
* **Art:** `facilities/armoury.png`; in the base painting; label {2240, 470}.
* **Tests:** `bastion.test.js` 7, `bastion-campaign.test.js` 1, e2e `bastion-screen` 8, `phase9` 7.
* **Verdict:** disappears (the whole Defenders/armed idea only matters to the war).

### 2.3 Watchtower (`watchtower`), starting facility, party level 5
Definition 292-319.
* **Patrol** (`patrol`): L1, 1 day, 0 gp. Sets `defenders.patrolUntil = day + 7`; defenders have Advantage in an attack while it lasts (`rules.js` 2646-2650, `R.patrolActive` 2738; read by `war-campaign-rules.js` 1371).
* **Protect Maritime Approaches** (`protect_maritime_approaches`): L2, 2 days, 0 gp, `protectionWindow: 'maritime_approaches'`, `windowDays: 7`. Writes `tradeNetwork.protections.maritime_approaches = { untilDay: day + 6 }` (`rules.js` 2659-2665). **Every cargo ship the Dock sends during those 7 days has its voyage risk 5 points lower** (`commerce-data.js` 153; `R.voyageProtections` 248). Not used up; cannot be re-ordered while active.
* **Provides to:** the **Dock's voyage risk** (commerce); the war (Patrol Advantage).
* **Depends on it:** `commerce-data.js` 153; tests `commerce.test.js`, e2e `charter-terms.test.js`; `tool.js` 3357 (comment), `.tsi-bas-...` Patrol CSS comment `bastion.css` 1305.
* **Saved state:** `defenders.patrolUntil`, `tradeNetwork.protections.maritime_approaches`, `facilityLevels.watchtower`, pending orders.
* **Art:** `facilities/watchtower.png`; in the base painting (the round tower); label {1760, 112}.
* **Tests:** `bastion.test.js` 6, `commerce.test.js` 10, e2e `bastion-screen` 21 (most of any removed starter), `charter-terms` 2, `phase9` 5.
* **Verdict:** disappears. Q4.

### 2.4 Menagerie (`menagerie`), party level 13, 35 days to build
Definition 1810-1891.
* **Recruit Beast** (`recruit_beast`): 10 days; gold per beast (paid at issue): Ape 500, Black Bear 500, Brown Bear 1000, Constrictor Snake 250, Crocodile 500, Dire Wolf 1000, Giant Vulture 1000, Hyena 50, Jackal 50, Lion 1000, Owlbear 3500, Panther 250, Tiger 1000. On completion the beast is added by name to `state.defenderBeasts` (`rules.js` 2699-2703).
* **Provides to:** `defenderBeasts` (Management panel "Menagerie Beasts", `R.beastQty` 3038, the War Council lock, the war: beasts committed to a War Action, `war-units-data.js` `beasts` table of 13 profiles). **Nothing to the new creature system**: `creatures-data.js` line 18 says the Menagerie is "separate and unchanged" and "nothing moves between the two". The Menagerie's "Dire Wolf" is not the Beast Pit's `dire_wolf`.
* **Compendium:** 13 beast names are Compendium items that come only from this order (section 3.5).
* **Saved state:** `defenderBeasts` (list of `{name, qty, ...}`), pending orders with gold paid.
* **Art:** `facilities/menagerie.png`; **no** map overlay and no map label (never had one).
* **Tests:** `bastion.test.js` 6, `bastion-campaign.test.js` 6, `creatures.test.js` 2, e2e `phase9` 9.
* **Verdict:** disappears entirely (not mentioned as moving anywhere). Beast list becomes dead data.

### 2.5 War Room (`war_room`), party level 17, 35 days to build
Definition 393-460. Data `war-room-data.js`; rules `regiment-rules.js`.
* **Recruit** (`recruit`): L1, 7 days, 0 gp. Options: Lieutenant (1), Archers (50), Levy Infantry (150), Line Infantry (100), Heavy Infantry (50), Light Cavalry (50), Shock Cavalry (25) (kept in step with `war-units-data.js`). Completion: `R.recruitUnit` (`war-campaign-rules.js`), which first refills a depleted regiment of that kind, else adds a regiment record to `state.military`.
* **Drill a Regiment** (`drill`): L2, 7 days; gold = 25 gp x Battle Value (Trained, 7 days: +1 Resolve, +0.5 BV) or 50 gp x BV (Veteran, 14 more days: +1 Cohesion, +0.5 BV). Drill places by level 0/1/2/2/3 (`war-room-data.js` `drillSlots`; `bastion-data.js` `levelEffects.war_room` (line 123) says "1 drill place" at L2, "2" at L3, "3" at L5). One drill per regiment; gold paid at issue.
* **Coordinated Muster** (L3, 7 days, raises 2 formations) and **Grand Muster** (L5, 7 days, raises 3).
* **Each-day hook:** `R.settleRegiments` (Recouping refills; drills wait while their regiment is away) is called from the day loop (`tool.js` 4857).
* **Provides to:** `state.military` (regiments, each its own record with grade/strength/recoup), the War Council and War Table, `war-units-data.js` stat blocks, the Compendium's seven unit entries (source "War Room", `compendium-data.js` ~71, 918, 1044, 1058, 1065, 1527).
* **Saved state:** `military` (including `num`, `grade`, `depleted`, `recoup`), `warRecovery`, pending drill orders (`chosen.regimentId`), `facilityLevels.war_room`.
* **UI:** `recruitPicker` (hover stat blocks) `tool.js` 3493; `regimentSection` 4124; Military list in Management 1500-1560; `openerFor` 'wr-' mapping 5645; CSS `bastion.css` 1126, 1512.
* **Art:** `facilities/war_room.png`; map overlay `map/overlays/war_room.png`; label {1780, 585}. Also `panels/military.png` (Management panel art).
* **Tests:** `war-room.test.js` e2e (13) is wholly about this; `bastion.test.js` 15, `bastion-campaign.test.js` 12, e2e `phase9` 13, `bastion-screen` 3, fixture `bastion-pr8a-sample.json` (4 regiments).
* **Docs:** `docs/specs/war-room-training.txt`, `docs/MILITARY-DIPLOMACY-PLAN.md`, `docs/WAR-RULES.md`, KNOWN_ISSUES BAS-94.
* **Verdict:** disappears with the war. Its removal strands about 5 more files (`regiment-rules.js`, `war-room-data.js`, big parts of `war-campaign-rules.js`, `war-table.js`, `war-battle-rules.js`, `war-ai.js`, `war-units-data.js`), which belong to the "War Council / no more war games VTT" removal (another analyst's area); the manifests in `shared/data/tools.js` and `tests/rules.html` list them.

### 2.6 Library & Scriptorium (`library_scriptorium`), party level 5, `productionLimit: 1`
Definition 611-664. Merged from the old Library (`mergedFrom: ['library']`).
* **Research** (`research`): L1, 5 days, 0 gp, four options: Geographical Scriptures, Religious Scriptures, Combat Scriptures, Political scriptures. Completion: the named scripture goes into the Warehouse with note "Library & Scriptorium" (final `optionLabel` branch of `completeSimpleOrder`, 2713-2721). The "research notes" in `bastion-data.js` `scriptureNotes` never attach because the keys do not match the option names (known issue B16). So today a Scripture is just a Warehouse line.
* **Prepare Overland Travel Charts** (`prepare_overland_travel_charts`): L2, 4 days, 0 gp, `production: true`. Makes 1 `overland_chart` good in the Warehouse (`goods-data.js` line 55), one chart order at a time (`productionLimit: 1`). Charts are **sent by the Courier Exchange** (`courier-data.js` `items.overland_chart`, `manualAdd`) to the party's Travel bags and used in the Explorer ("Use a chart today", +1 six-mile hex, 3 days of use each: `tools/explorer/rules.js` 430-455, `journey.js` 1022, `shared/data/party-items.js` 24).
* **Provides to:** Courier Exchange / Explorer (charts). Nothing else reads the Scriptures.
* **Depends on it:** `rules.js` 1928 (note lookup); `campaign-rules.js` `FACILITY_NAMES.library_scriptorium` (37-43); `retiredFacilities.library` (old v2 id); `bastion-data.js` image/label/overlay; `courier-data.js` comment 66-67.
* **Saved state:** `facilityLevels.library_scriptorium`, pending orders, Warehouse rows of Scriptures and charts (these stay).
* **Art:** `facilities/library.png`, overlay `map/overlays/library.png`, label {216, 261}.
* **Tests:** `bastion.test.js` 49 (most of any), `creatures.test.js` 1 rules + e2e 17 (the chart order), `session-safety.test.js` 5, `bastion-screen` e2e 27, `phase9` 12; fixtures `pr3`, `pr7`, `pr8a`.
* **Verdict:** MOVES to the Workshop's **Scholar (L3)**: "Calligrapher's Tools orders + Overland Charts + Research". See section 6 for exact lists and the naming mismatch.

### 2.7 Arcane Laboratory (`arcane_laboratory`), party level 5
Definition 461-610. Merged from the old Arcane Study + Laboratory (`mergedFrom`).
* **Craft Common** (5 days): Bead of Nourishment, Bead of Refreshment, Lock of Trickery, Mystery Key, Potion of Climbing.
* **Craft Uncommon** (10 days): Bag of Holding, Cap of Water Breathing, Circlet of Blasting, Cloak of Protection, Gem of Brightness, Hat of Disguise, Potion of Poison, Potion of Resistance, Potion of Water Breathing, Saddle of the Cavalier, Sending Stones.
* **Alchemy** (5 days, `requiredPartyLevel: 9`): 20 options: Burnt Othur Fumes (Poison), Essence of Ether (Poison), Torpor (Poison), Acid vial, Alchemist's fire, Basic poison, Antitoxin, Firebomb, Frost vial, Sticky bomb, Potion of healing (common), Potion of greater/superior/supreme healing (base item), Potion of climbing / water breathing / resistance (base item), Darkvision draught, Stoneskin varnish, Vitality tonic.
* All three cost 0 gp; each puts 1 item (by name) into the Warehouse with note "Arcane Laboratory".
* **Provides to:** Warehouse items only. It is mentioned (not used) in `research-data.js`: `needs.lab` ("the Arcane Laboratory having recipes of its own") on one Herbal Gardens research choice (line ~199), the tree intro (47) and choice texts (173, 187, 213); `goods-data.js` line 49 (`alchemical_flowers` "Advanced Arcane Laboratory ingredients"). Those are wording and one disabled-choice reason, no code.
* **Art:** `facilities/laboratory.png`, overlay `map/overlays/laboratory.png`, label {633, 264}.
* **Tests:** `bastion.test.js` 13, e2e `phase9` 11, `bastion-screen` 1, `campaign.test.js` 1; fixtures `pr3`, `before-overhaul` (v2 Laboratory L2 with a pending Craft order and a repair).
* **Verdict:** MOVES to the Workshop's **Alchemist (L4)**: "Alchemist's Tools + any items this doesn't already include that can be crafted at the Arcane Laboratory". Exact leftover list in section 6.

### 2.8 Shrines of Telluria / Aurush / Pelagos (`shrine_telluria`, `shrine_aurush`, `shrine_pelagos`), each party level 8, 21 days
Definitions 2436-2557, 2558-2690, 2691-2811. The three are identical in shape.
* **Craft** (5 days, 0 gp): two charms each, e.g. Tellurian Root Charm / Stone Charm, Aurush Sun / Ember Charm, Pelagos Tide / Current Charm (notes: advantage on a save once per short rest; "Value = 100gp / 120gp"). Become Warehouse items.
* **Pray** (1 day, 0 gp): three options each: (1) Guidance / Insight / Tidings = `oracle_hint` (1d10, hint on 4-7), (2) Embrace / Radiance / Deep Rest = `blessing_rest` (1d6, long-rest effects on 5-6), (3) **Blessing** = `favour_blessing` (rolls 1d20 and adds that % to the god's bar, max 100, `R.addFavourPercent`). **The handover's "Pray to *God*" is option (3) only**; (1) and (2) have no home in the handover and would disappear.
* Level orders (all production orders hold goods; the favour % is taken **once when the order starts**, `rules.js` 1933-1948):

| God | L2 (0% favour) | L3 (5%) | L4 (10%) | L5 (25%) |
|---|---|---|---|---|
| Telluria | Prepare Earthward Talisman, 3 d, 1 talisman | Prepare Rootguard Salve, 4 d, 2 doses | Bless Bastion Foundations, 5 d, **`waiting` (never orderable: "no Bastion event damages a facility by natural causes yet")** | Great Rite of Telluria, 7 d (Earth's Endurance) |
| Aurush | Prepare Blessed Lantern, 3 d, 1 lantern | Prepare Purification Incense, 4 d, 2 portions | Consecrate Expedition Supplies, 5 d, 3 Cleansing Portions | Great Rite of Aurush, 7 d (Cleansing Radiance) |
| Pelagos | Bless Voyage, 3 d, 1 Voyage Blessing | Prepare Aquatic Protection Charm, 4 d, 1 charm | Bless Commercial Shipment, 5 d, one "Blessing of Pelagos" kept for the Dock (-10 points of voyage risk) | Great Rite of Pelagos, 7 d (Tide's Passage) |

* **Provides to:** (a) **Warehouse goods** `earthward_talisman`, `rootguard_salve`, `blessed_lantern`, `purification_incense`, `cleansing_portion`, `voyage_blessing`, `aquatic_protection_charm` (`goods-data.js` 56-62), carried by the Courier Exchange (`courier-data.js` 36-46) into the Explorer's Travel bags (`shared/data/party-items.js` 50-110: texts say "from the Shrine of ..."); the Explorer's rest events can offer them (`offer` tags). (b) **Great Rites** in `state.greatRites`, given to the party on an expedition in the Explorer (`tools/explorer/journey.js` 1184; `R.assignGreatRite` `rules.js` 613; `shrines-explorer.test.js`). (c) **Blessing of Pelagos** charge to the Dock (`commerce-data.js` 154, `rules.js` 2674-2681). (d) **Favour bars** `state.favour.{telluria,aurush,pelagos}`: shown by the Favour of the Gods panel (to be removed) and, per region, by the DM doc (`shared/js/campaign-rules.js` 286-293, `dmdoc.js` 364) and editable through the DM doc's "Change a score" (`dmdoc-rules.js` 110-118, `R.applyDmEdits` `rules.js` 489).
* **Special code:** `R.shrineGod` (624), `R.favourBlocker` (627), `R.GOD_NAMES`, `R.RITE_NAMES`, `R.cleanGreatRites` (598-611); `tool.js` `shrineSection` 4105 and the issue-button text "Not enough Favour".
* **Saved state:** `favour` (kept), `greatRites` (kept), `tradeNetwork.protections.pelagos_blessing`, pending orders (with `favourCost` already deducted), `facilityLevels.shrine_*`.
* **Art:** `facilities/shrine_of_{telluria,aurush,pelagos}.png` (1536x1024, ~2.5 MB each), overlays `map/overlays/shrine_of_*.png`, labels {2252,722}/{1275,532}/{2668,840}; older shrine overlay files already in `assets/extras/`.
* **Tests:** `shrines.test.js` e2e (15 mentions: the whole levels 2-5 flow), `shrines-explorer.test.js` (1), `bastion.test.js` 36 (shrine ids), `phase9` 10, `bastion-screen` 3, `commerce.test.js` 1, `campaign.test.js` 1, `session-safety` 1; fixtures `pr8b` (three Shrines at L5, favour 60%), `pr3` (Aurush).
* **Verdict:** MOVES to one **Temple** (section 7). Craft charms, the two non-favour Pray options and whichever of the four level orders do not make the "3 blessings" disappear.

### 2.9 Wyvern Roost / Griffin Tower / Dire Wolf Den (`wyvern_roost`, `griffin_tower`, `dire_wolf_den`), each party level 5, 21 days
Definitions 1892-2079, 2080-2257, 2258-2435. Data and rules: `creatures-data.js`, `creature-rules.js`.
* **House orders (3 days, 0 gp):** Roost: **House Elara's Wyvern** (`housesCreature: 'elara_wyvern'`, once ever) and **House a Wyvern** (`housesSpecies: 'wyvern'`); Tower: **House a Griffin**; Den: **House a Dire Wolf**. The order's list is built from the creatures of that kind waiting for a home (granted by the DM in the Explorer), and the chosen creature's id is kept in the order. `R.completeHousing` (`creature-rules.js` 277) sets `status 'housed'`, `home = fac.id`.
* **Room:** `creatures-data.js` `room`: 1 per level, plus `roomBase 1` at the Roost (Elara's wyvern is one of them): Roost 2-6, Tower 1-5, Den 1-5. Tower and Den `levelEffects` say "Room for one more ... " at L2-L5 (`bastion-data.js` 127-128).
* **Training orders (all free unless stated): 12 at the Tower and Den, 12 at the Roost**, each one named creature, each needing a handler and a Bond level: Safe Acclimatisation (L1, 5 d, finishes Bond 1 "ready for the DM to confirm"), Establish Keeper's Routine (L1, 7 d, to Bond 2), Signal & Recall / Heel & Recall (L2, 7 d, Bond 3), Territorial / Den Defence Drills (L2, 7 d, +1 Resolve in Defend Bastion), Open-Sky Return / Roaming Return (L3, 10 d, Bond 4), Aerial Sentinel / Pack Sentinel (L3, 7 d, +1 Defence), **Commission Riding Harness (L4, 7 d, 150 gp, not refunded)**, Controlled Ascent & Landing / Steady Gait (L4, 14 d), Emergency Recall (L4, 7 d), The Rider's Pact / Oath (L5, 14 d, Bond 5, needs a DM-confirmed first mounted flight), Elite Aerial Defence / Diving Strike / Pack Hunt Drills (L5, 10 d, +1 Attack), Aerial Combat Signals / Mounted Pack Signals (L5, 14 d). Training places at once by level 1/1/2/2/3 (`development.trainingPlaces`). In the handover, **only "House Beast Here" and "Acclimatise With Beast" remain**, so all of this goes: the programmes, the Defend-Bastion bonuses (`trainingBonus`), the harness, the first-flight confirmation, the rider's pact, `R.tickTraining` (day loop `tool.js` 4856), `R.trainingOptions/Blocker/issueTraining/completeTraining`.
* **State on each creature that stays valid:** `development` { handlerId, bond {level 0-5, ready}, temperament, training{}, harness, firstFlight, handlerHistory, chronicle, regional, profileLog } (`R.cleanDevelopment` `rules.js` 697 **does not check training ids against the facility data**, so a creature's bond, handler, temperament, regional variety and Chronicle survive intact if the training orders vanish).
* **Provides to:** the **Beast Handler** (projection builds its directory from `P.homes`: species whose `home` facility exists in the data; `snap.facilities`, `detail.facility`, request `fac` field); the war (`R.fightingCreatures`: housed creatures defend the Ironbow; war area); the Explorer's "Grant a creature" pop-up text names the Tower/Den (`explorer/tool.js` 1494; `journey.js` 665; `bridge-rules.js` 47, 143, 161).
* **Art:** no tile painting: tiles are crops of the map overlays (`facilityTileCrops`); overlays `map/overlays/{wyvern_roost,griffin_tower,dire_wolf_den}.png`; labels {2081,326}/{1279,306}/{2460,701}.
* **Tests:** `creatures.test.js` rules (61/63/20 mentions) and e2e (28/35/14), `wyvern-bonding` rules (25) and e2e (10), `beast-bonding` rules and e2e, `beasthandler-*` rules (link 11/4/3, projection 23/8/4, model 5/1, tables 1/1/1) and e2e (`beasthandler`, `-meet`, `-phone`, `-write`), fixtures `pr7`, `pr8a`.
* **Verdict:** MOVES to one **Beast Pit** (another analyst owns its design). From the facility-removal side the key points are in sections 5 and 8.

---------------------------------------------------------------------

## 3. What the removed facilities PROVIDE to other systems

### 3.1 Matrix

| Provider | Gives | Consumed by | After the change |
|---|---|---|---|
| Barracks | defenders (1d4 per order) | Management panel; War Council lock; war | gone (source gone) |
| Barracks | Convoy charge (-5 risk, 1 kept) | Dock voyages (`commerce`) | gone unless re-homed (Q4) |
| Armoury | Armed flag | war (unarmed Attack penalty) | gone |
| Watchtower | Patrol Advantage 7 days | war | gone |
| Watchtower | Maritime Approaches window 7 days, -5 risk on every ship | Dock voyages | gone unless re-homed (Q4) |
| Menagerie | named beasts in `defenderBeasts` | Management; war; War Council lock | gone |
| War Room | regiments, Lieutenants, drilling, Musters, Recouping | Management; War Council; War Table | gone with the war |
| Library | Scriptures (plain Warehouse lines) | nothing reads them | -> Scholar "Research" |
| Library | Overland charts | Courier Exchange -> Explorer Travel bags | -> Scholar |
| Arcane Lab | 36 distinct craftable items | Warehouse | -> Alchemist (leftovers) |
| Shrines | seven Warehouse goods | Courier Exchange; Explorer bags and rest-event offers | partly (Q1) |
| Shrines | Great Rites | Explorer (Great Rites given on expedition) | -> Temple |
| Shrines | Blessing of Pelagos charge (-10 risk) | Dock voyages | -> Temple (Bless Commercial Shipment) |
| Shrines | Favour % (Pray) | spent by Shrine orders; DM doc meter and edit | -> Temple bars |
| Beast buildings | housing and rooms | creature register; Beast Handler; war | -> Beast Pit |
| Beast buildings | bond milestones by training | creature `development.bond.ready`, DM confirm | replaced by days-away bonding (other analyst) |

### 3.2 Voyage protections (the Dock's commerce)
`commerce-data.js` `protections` has exactly three entries: `commercial_convoy` (facId `barracks`, -5, consumed), `maritime_approaches` (facId `watchtower`, -5, 7-day window), `pelagos_blessing` (facId `shrine_pelagos`, -10, consumed). All three are applied automatically when a ship sails and recorded on the voyage (`R.voyageProtections`). The Dock panel shows all three in a "Voyage protection" list (`tool.js` 3898, 3927) built from this data. The handover moves only the Pelagos blessing (as a Temple blessing). If the other two are removed from the data, the Dock list shrinks to one line and the stored charges/windows in saves become dead (clean them in the migration). Do **not** leave the entries in the data with `available: true`: the Dock would show "Commercial Convoy: none ready" forever with no way to prepare one. The two "available" flags could instead be set false (list shows "not available yet") but that is clutter. Tests: `commerce.test.js` (Watchtower 10, Barracks 10), e2e `charter-terms.test.js`.

### 3.3 The Management panel's lists
`tool.js` 1447-1640. "Bastion Defenders" (+1 / -1 buttons, count, Armed flag), "Menagerie Beasts", "Creatures" (the new register), the Beast Handler DM box, and "Military" (with Clear). The handover does **not** list the Management panel for removal, but the sources of Defenders (Barracks), Armed (Armoury), Menagerie Beasts (Menagerie), Military (War Room) all go, and Defenders only matter to the war. The Creatures list and Beast Handler box are needed by the Pit. This needs Harry's word (Q5). Also: panel art `assets/panels/bastion_defenders.png`, `military.png`.

### 3.4 The Favour system
`state.favour` (0-100 per god) is **not** being removed by the handover (the Temple shows a bar per god) but the "Favour of the Gods" panel is. Panel code `tool.js` 779-815 (bars, god icons from `GOD_PATHS` line 51, a Claim button that resets a bar to 0) and the redraw at 882; bottom-bar button 5421/5451; `debug.reveal` map 5634. The Temple can reuse `godIcon`/`GOD_PATHS` and the bar CSS (`.tsi-bas-meter`). "Claim" disappears: the Temple's "Receive Blessing" is the new reset. DM doc: `campaign-rules.js` 286-293 and `dmdoc.js` 364 show the region god's Favour meter and `dmdoc-rules.js` has a `favour` edit kind; the DM doc overhaul (another analyst) decides whether those stay.

### 3.5 The Compendium
`R.compendiumIndex` (`rules.js` 3370) builds the item list from every facility's non-production option labels plus the tool tables. Computed by running it with and without the 13: **270 items today, 227 after, 43 vanish**: the 13 Menagerie beasts; the 7 War Room units; the 4 Scriptures; the 6 charms; the 9 prayers (3 per god); and from the Arcane Lab: Potion of Poison, Burnt Othur Fumes (Poison), Essence of Ether (Poison), Torpor (Poison). Of those 43, **"Potion of Poison" is one of the 36 items that have a card picture** (`bastion-data.js` `compendiumCards`), so its card would be orphaned unless the Alchemist keeps that item. The test title in `bastion.test.js` line 40 pins "270 compendium items (271 entries)" and "22 facilities". `tool.js` 5240-5310 also builds War Room unit entries from `war-units-data.js` (source "War Room").

### 3.6 Creature system and Beast Handler
* `creatures-data.js` ties species to buildings in five tables: `species.*.home`, `room`, `roomBase`, `development.trainingPlaces`, `development.trainingBonus` (keyed by the training order ids `wyr_`, `grf_`, `dwf_`). All must be redone for one Pit.
* `rules.js` `R.cleanCreatures` (749) keeps `home` as plain text with no validation, so a creature still pointing at `griffin_tower` loads fine but `R.housedAt(s, 'beast_pit')` will not find it (it matches `c.home === facId`). The Beast Handler lists a creature only if `home.facId` is built (`projection.js` 93-96).
* `P.homes` (`projection.js` 70-77): `if (home && r.facility(data, home))`, so with the buildings gone and `species.home` unchanged, **the phone app shows no beasts at all** (and `model.js` 71 says "No beast buildings stand at the Ironbow yet").
* `shared/js/bridge-rules.js` 143: `FALLBACK_CREATURES` hard-codes the three homes for the Explorer's grant text.
* Elara's wyvern is credited Bond 1 once (`R.cleanCreatures` and `R.newDevelopment`, with a Chronicle line "Existing relationship credited; Bond 1 per campaign decision"), so under the handover's "acclimatisation passes to reach Bond 1" it should count as already acclimatised.

---------------------------------------------------------------------

## 4. What REMAINS afterwards

| Facility (id) | Kind | Req. party level | Orders (level) |
|---|---|---|---|
| Workshop (`workshop`) | starting, no slot | 5 | craft (1), craft_magic_item (1), smithing (legacy only) -> to be replaced by the five-staff design (another analyst) |
| Dock (`dock`) | starting, no slot | 5 | charter_berth (1) + cargo section (Dock levels 2-5: lots 2/3/4/5, ships 1/1/1/2, standing shipments at 4); will gain Port Charter + Routes |
| Hall of Emissaries (`hall_of_emissaries`) | construction slot | 5 | being stripped to a single-level records page |
| Temple (`temple`, new) | construction slot | proposed 8 | Pray x3, Receive Blessing x3 |
| Beast Pit (`beast_pit`, new) | construction slot | proposed 5 | House Beast Here, Acclimatise With Beast |
| Herbal Gardens | Development Plot | 5 | harvest (1), cultivate (1), cultivate_specialist (2), field_medical_supplies (3), commercial_medicinal_crops (4), major_botanical_production (5); research tree |
| Fishery & Smokehouse | plot | 5 | 6 production orders (L1-L5) |
| Timber Yard & Sawmill | plot | 5 | 6 production orders |
| Stone Quarry & Masonworks | plot | 5 | 6 production orders |
| Weavers' Hall | plot | 5 | 6 production orders |
| Courier Exchange | plot | 5 | none (its own parcel section) |

* **Slots after the change:** the construction-slot list has 6 rows at party level 17 but only **three slot facilities exist** (Hall, Temple, Pit). Slot counts (`constructionSlotsForLevel`): 0 / 2 / 4 / 5 / 6. At party level 9+, at least one slot can never be used; at level 13-17, three. Plots (6 facilities for 0/2/4/6 plots) are unaffected. The slot numbers are not in the handover: Q10.
* The grid code's `GRID_START` (`tool.js` 3166) expects up to five starters: with two it will still work (it filters by `startingBuilt`), but the first row's balance changes. The top-bar count starts as the literal text "5" (5352); it is rewritten by `renderCounts` (4525) so only the first paint is wrong.
* **Level gates other code checks:** `R.fnAvailable` (1833) uses `requiredFacilityLevel`, `requiredPartyLevel` (the Arcane Lab's Alchemy 9 goes), `onlyIfLegacy` (Smithy); `R.levelUnlocks` (1437) feeds the "Level N unlocks:" line from `requiredFacilityLevel` plus `levelEffects`; `R.upgradeCheck` (1478) applies to every built facility (so a "single-level" flag is needed for the Hall; the Pit and Temple need a decision); `R.demolishFacility` refuses `startingBuilt` ids with the literal text "one of the five starting facilities" (1395).
* **Level-by-level, who relied on a removed facility's level:** creature rooms and training places (creature data), drill places (`war-room-data.js`), protection orders (Barracks/Watchtower L2), Shrine orders (L2-L5), Library charts (L2), none else.

---------------------------------------------------------------------

## 5. The migration problem (a saved Bastion with any of the 13)

### 5.1 What a save holds that touches these facilities
`tsi.bastion.state` fields:
* `builtExtras[]` (construction slots: `{facId, status, startDay, readyDay}`): Library, Arcane Lab, Shrines x3, Roost, Tower, Den, War Room, Menagerie. The three starters are **not** in the save's slot lists (`builtFacilities` is saved but never read: `R.builtFacilityIds` uses `startingBuilt` + slots/plots).
* `facilityLevels{}` (keys for all built, including starters), `repairs{}`, `research{}`.
* `pendingOrders[]`: `{id, facId, fnId, chosen, optionLabel, notes, label, costGP, issuedDay, dueDay, inputs?, favourCost?, meta?}`. Gold (`costGP`), held Warehouse goods (`inputs`) and spent Favour (`favourCost`) are taken **at issue**.
* Results already delivered and staying valid: `warehouse[]`, `defenders`, `defenderBeasts`, `military`, `favour`, `greatRites`, `tradeNetwork.protections`, `creatures[]` (with `home`), each creature's `development`, `warRecovery`.
* Elsewhere: `tsi.bastion.ui`, the Explorer save (Great Rites assigned, Travel-bag items from the Shrines/Library), `tsi.beasthandler.*` (paired phones, queue), and the phone's stored snapshot (its `facilities[].id` are `wyvern_roost` etc. and requests carry `fac`).

### 5.2 What happens if we just delete the data (verified by running the rules)
Using the five fixtures against a catalogue without the 13:
* `bastion-pr7-sample` (Library + Roost + Tower + Den built): `builtIds` contains four ids the data does not know; `slotRows` shows **4/4 slots used by ghosts**; `unknownBuilt` = all four. The tile is drawn with the id as its name (`builtTile`), clicking it does nothing (`openFacility` returns null for an unknown id), so **they cannot be demolished from the screen** and they eat the slots.
* `bastion-pr3-sample`: Library, Arcane Lab and Shrine of Aurush ghosts (3 of 4 used slots).
* `bastion-before-overhaul` (a v2 save): `R.migrateToV3` itself still converts to `arcane_laboratory` (a now-removed id), with a pending `alchemy` order whose `R.orderKind` is `'none'`.
* `facilityLevels` keeps `barracks`, `armoury`, `watchtower`, etc.
* **Pending orders** (read, not run): `completeOrder`'s last branch (`tool.js` 5004-5008) removes an order whose facility is missing, returns its held goods, **logs nothing if it held none**. The gold paid (Menagerie beasts 50-3500 gp, Armoury 100+ gp, War Room drill, harnesses 150 gp) and the spent Favour are simply lost. The order also sits in the Pending Orders list and the DM doc's "Orders pending" and "next word from the Ironbow" (`campaign-rules.js bastionComing` counts every order, using only its saved `label`) until the due day.
* `R.fromSave` does not filter `pendingOrders` or `builtExtras` by known facility (read).

### 5.3 The existing pattern to copy
`R.migrateToV3` (`rules.js` 227-329) + `bastion-data.js retiredFacilities` + the screen's handling:
* a raw-save converter run once from `R.fromSave` (353), returning `{save, lines}` where `lines` are plain-English report lines;
* a table `retiredFacilities: { old: { to, name, fns, legacy } }`; `to: null` = gone (goes into `archivedFacilities` as an audit record); a target that is a starting facility frees the slot; two halves of a merge keep the built one (else the first ready) and free the other; highest level wins; latest repair wins; pending orders follow their facility, with an order-id rename table `fns`;
* `state.migration.v3 = { day, lines, shown }` plus a Day Log line; the screen shows the report once as a notice (`tool.js` ~5660);
* **before converting, the screen quarantines an untouched copy** of the old save (`tool.js` 88-92) so it is in Back up everything;
* idempotent (a converted v3 returns unchanged; `bastion.test.js` 1436 checks `migrateToV3(toSave(once))` is a no-op);
* test fixtures: all seven `tests/fixtures/bastion-*.json`.

### 5.4 Recommended design for v3 -> v4 (a "strip-back" migration)
1. **New version number.** `R.defaultState` -> `v: 4`; a new `R.migrateToV4(raw, data)` chained after V3 in `R.fromSave` (`v===2` -> V3 -> V4; `v===3` -> V4). Places that must learn about 4 or they will mis-read the save: `rules.js` 229 (V3 guard), 353 (fromSave), **1056 `R.isOldSave` (`s.v !== 2 && s.v !== 3`)**, `tool.js` 91 (`migrating = saved.v === 2`: extend so a v3 is also quarantined), **`shared/js/campaign-rules.js` 52 `inDaysSave` (`ba.v === 2 || ba.v === 3`): if forgotten, the DM doc and the Explorer's "Ironbow sends word" return nothing for every v4 save**, and the tests that assert `v === 3`. (Alternative with no bump: make the clean-up part of `R.fromSave` and idempotent; simpler, but loses the "report once" and "keep an untouched copy first" behaviour.)
2. **Data table** (in `bastion-data.js`, next to `retiredFacilities`), e.g. `stripBack`: `barracks, armoury, watchtower, war_room, menagerie -> null`; `library_scriptorium, arcane_laboratory -> workshop` (a starting facility, so the slot is simply freed, as the Smithy's was); `shrine_* -> temple`; `wyvern_roost, griffin_tower, dire_wolf_den -> beast_pit`; with a per-order rule table (below).
3. **Slots:** every removed facility's slot entry is freed (`''`); if a merge target is built/being built from any of the sources, keep one entry (`{facId:'temple'}` or `{facId:'beast_pit'}`) in the first sources' slot, same rule as V3 (built beats building; else the earliest `readyDay`). Starters need no slot work.
4. **Levels:** delete the removed ids; Temple level = highest of the shrines (V3 precedent); Pit: the highest of the three, or 1 if the Pit is single-level; Workshop level is **not** raised.
5. **Repairs:** drop for removed ids; carry the latest repair onto a merge target (V3 precedent).
6. **Pending orders** (one decision per order, and every one reported in `lines`):
   * Orders at facilities that vanish outright (Barracks, Armoury, Watchtower, Menagerie, War Room, Library, Arcane Lab): cancel; refund `costGP` to the treasury; return `inputs` to the Warehouse (`R.returnGoods`); say so. (Cancel normally keeps the gold, B9, and demolish gives none back; this removal is not the player's choice, so a refund is the fair default: Q6.) A Drill also leaves its regiment row as it was.
   * Shrine production and Great Rite orders: if the recipe survives in the Temple's list, carry it over (new `fnId`, same `dueDay`, `favourCost` kept); else cancel and give back the Favour (`s.favour[god] += o.favourCost`, capped 100) and goods.
   * Shrine Pray: the Blessing option carries over as the Temple's Pray for that god (the roll happens on the due day as now); Guidance/Rest cancel (no cost).
   * House orders (`house_*`): carry over to the Pit's House order (they hold only a creature id); the creature stays/returns to `waiting` if cancelled (no gold involved, nothing lost).
   * Training orders: cancel; refund the Harness' 150 gp (`costGP`); the creature's `development` is untouched.
   * Upgrade orders at a vanished facility: cancel; at a merge target: cancel (the target level is rebuilt anyway).
7. **Creatures:** for every housed creature set `home = 'beast_pit'`; keep `development` whole. Housed creatures that outnumber the Pit's "one of each kind" rule are **kept** (Q8). A creature that was housed in a demolished building (home not built) keeps its new `home` and reappears when the Pit is built, as today.
8. **Commerce:** delete `tradeNetwork.protections.commercial_convoy` and `.maritime_approaches` (if not re-homed, Q4); keep `pelagos_blessing`.
9. **Leave alone (data kept, panel decision elsewhere):** `defenders`, `defenderBeasts`, `military`, `warRecovery`, `wars`, `favour`, `greatRites`, `warehouse`, `research`, `legacyFacilities`. Do not delete player data just because its panel is going.
10. **Report:** `state.migration.v4 = { day, lines, shown:false }` and one Day Log line `Facilities`; the existing notice in `tool.js` (~5660) pattern shows it once; record in `archivedFacilities` the removed facilities that stood (V3 pattern); add a KNOWN_ISSUES entry with the BAS-99 id (BAS-98 is the highest today).
11. **Idempotent and safe on re-import:** `R.toSave(once)` through `migrateToV4` must be a no-op. Backups made before the change still import (`R.saveProblem` accepts them) and convert at the next open.
12. **Not migrated, must be tolerated:** the Beast Handler phone's stored snapshot and any queued request whose `fac` names an old building: they are refused/ignored by the existing "stale snapshot / unknown building" paths (read: `bastion-link.js` 278-281 refuses when `c.home !== home.facId`), but the phone page and the `snapshot` shape change belong to the Beast analysts; flag it.

### 5.5 Edge cases to test (use the fixtures as inputs)
| Fixture | What it proves |
|---|---|
| `bastion-before-overhaul.json` (v2: Arcane Study, Laboratory L2 with repair and pending Craft, Smithy, Gaming Hall, Garden building) | the V2 -> V3 -> V4 chain; arcane_laboratory -> Workshop; repair dropped |
| `bastion-pr3-sample.json` (Library, Arcane Lab, Aurush Shrine built; herbal gardens L5) | three vanishing slots freed; Aurush -> Temple |
| `bastion-pr7-sample.json` (Library L2, Roost, Tower, Den) | beast merge; `creatures` empty here, so add granted/housed ones in the test |
| `bastion-pr8a-sample.json` (War Room L2, 4 regiments, Roost/Tower/Den) | War Room gone, `military` kept untouched |
| `bastion-pr8b-sample.json` (three Shrines L5, favour 60%, Courier Exchange) | three Shrines -> one Temple; level 5; favour kept at 60% |
| `bastion-pr5/6-sample.json` | starters only: levels for barracks/armoury/watchtower removed, nothing else changes |
Plus hand-made: a pending Menagerie order with gold; a pending Shrine order holding goods and `favourCost`; a pending harness order; a building (not yet built) Library; two sources of a merge (one built, one building); a second run of the migration (must be a no-op).

---------------------------------------------------------------------

## 6. The Workshop receives Library + Arcane Laboratory (exact content)

The Workshop's staff design (Handyman L1, Smith L2, Scholar L3, Alchemist L4, Artisan L5) belongs to another analyst; this section gives the source content.

**Naming mismatches in the handover vs the data:** the data's tool tables are "Calligrapher's **Supplies**" and "Alchemist's **Supplies**" (`tools-data.js`), not "... Tools". "Research" is the Library's scripture order, not the Herbal Gardens' research tree (`research-data.js`), which is a different "Research" row on that facility's panel.

**Scholar (L3) = three things:**
1. *Calligrapher's Supplies* (12 craftable items, 1 each into the Warehouse, 3 days like all Workshop Craft): Spell scroll (mundane script), Certificate or deed, Official seal script, Chart of Southern Province, Chart of Western Province, Chart of Eastern Province, Chart of Northern Province, Chart of Midland Province, Chart of The North Isle, Chart of The East Isle, Chart of The Bolt Isle, Chart of the Great Sea Road. (These "Chart of ..." are ordinary Warehouse items; they are **not** the `overland_chart` good.)
2. *Overland Charts*: the Library's `prepare_overland_travel_charts` as it is: 4 days, 0 gp, 1 `overland_chart` good, `production: true`, one at a time (`productionLimit`). It currently needs Library L2; as the Scholar it needs Workshop L3.
3. *Research*: the Library's `research` order: 5 days, 0 gp, Geographical / Religious / Combat / Political scriptures into the Warehouse; the "note" feature has never worked (B16).

**Alchemist (L4) = Alchemist's Supplies (17 items) + the Arcane Laboratory leftovers.** Alchemist's Supplies: Acid vial, Alchemist's fire, Basic poison, Antitoxin, Firebomb (reskinned alchemist's fire), Frost vial (cold variant), Sticky bomb (glue grenade), Potion of healing (common), Potion of greater healing (base item), Potion of superior healing (base item), Potion of supreme healing (base item), Potion of climbing (base item), Potion of water breathing (base item), Potion of resistance (base item), Darkvision draught (base item), Stoneskin varnish (base item), Vitality tonic (base item).
Computed difference with the Arcane Laboratory's 36 listed options (name comparison, ignoring the "(base item)" suffix):
* In Alchemy but **not** in Alchemist's Supplies (3): Burnt Othur Fumes (Poison), Essence of Ether (Poison), Torpor (Poison).
* In Craft Common but not in it (4): Bead of Nourishment, Bead of Refreshment, Lock of Trickery, Mystery Key. (Potion of Climbing is the same item as "Potion of climbing (base item)".)
* In Craft Uncommon but not in it (9): Bag of Holding, Cap of Water Breathing, Circlet of Blasting, Cloak of Protection, Gem of Brightness, Hat of Disguise, Potion of Poison, Saddle of the Cavalier, Sending Stones. (Potion of Resistance and Potion of Water Breathing duplicate the "(base item)" lines.)
* Of those, **4 are already in the Workshop's separate "Craft Magic Item" order** (22 items, 10 days): Bead of Nourishment, Bead of Refreshment, Bag of Holding, Saddle of the Cavalier. What happens to that order is the Workshop analyst's call; if it stays, those four exist twice.
* Name clash to settle in the build (not a Harry question): the Arcane Lab used "Potion of Climbing / Resistance / Water Breathing" (these three have Compendium **card pictures**), the Alchemist's list uses "Potion of ... (base item)" for the same things. Keep the Alchemist's wording and add the Arcane Lab names only if the card pictures are wanted.
* Gating changes: the Alchemy order's `requiredPartyLevel: 9` has no equivalent; the Workshop's staff level now gates it. The Arcane Lab's different durations (5 days common/alchemy, 10 days uncommon) become the Alchemist's order days (Workshop Craft is 3 days): a decision for the Workshop build.

---------------------------------------------------------------------

## 7. The Temple (notes for the merged facility; facility side only)

* **Name/ids:** suggest `temple` / "Temple"; `R.shrineGod` must become data-driven (e.g. a `god` field on each Temple function, or the function id carries the god) instead of the `shrine_(telluria|aurush|pelagos)` regex. Every place that calls it: `rules.js` 627-632 (`favourBlocker`), 1936/1948 (spend), 2685 (Great Rite `god:`), `tool.js` 4106 (`shrineSection`). **If this is missed the Temple's blessings cost no Favour and, worse, create `s.favour['']`.**
* **Reusable existing code:** pending order machinery, `favourCost` taken at issue (but now the *whole bar*: 100 instead of 0/5/10/25), `R.addFavourPercent` for Pray, `completeProduction` for goods, the protection-charge path for Bless Commercial Shipment, the Great Rite path (`s.greatRites`), `favourBlocker` for "greyed out until full". The new screen is a three-column panel with god icon, name, bar, **Pray to X** button and **Receive Blessing** dropdown + button (the existing `fnRow` is a list of rows, so the Temple needs its own section like `shrineSection`, the Dock's `cargoSection` or the Courier's section).
* **Economics:** a Pray adds 1d20 (mean 10.5%), so a full bar takes about 10 prayers (1 day each, one order at a time per god at the moment). Today a Great Rite costs 25% (about 2-3 prayers). Not an error, but a big change in pace; flag in KNOWN_ISSUES.
* **Candidate blessings per god (the "3" in the handover):**
  * Pelagos: Voyage Blessing (L2), Aquatic Protection Charm (L3), Bless Commercial Shipment (L4), Great Rite (L5). Harry's example names L2, L4, L5.
  * Telluria: Earthward Talisman (L2), Rootguard Salve (L3), Bless Bastion Foundations (L4, a placeholder that cannot be ordered at all), Great Rite (L5).
  * Aurush: Blessed Lantern (L2), Purification Incense (L3), Consecrate Expedition Supplies (L4), Great Rite (L5).
  Q1 asks which three.
* **What does not carry over by default:** Craft (6 charms); Pray options (1) hints and (2) long-rest; whichever fourth blessing is dropped; `Claim`.
* **Items already made** (talismans etc. in the Warehouse or the Explorer's Travel bags) stay valid: keep the seven goods in `goods-data.js`, `courier-data.js` and `party-items.js`, even if a blessing that makes one is dropped, otherwise stock in a save loses its name. Update the "(from the Shrine of ...)" texts (`party-items.js` 51-108) to "Temple"; the Explorer's rest-event `offer` tags are unaffected.
* **Great Rites already waiting** (`s.greatRites`) keep working (they are keyed by `rite` -> god, not by facility).
* **Map/art:** no single Temple painting; the three shrine overlays exist and `R.mapOverlays` can draw several pictures for one facility (it groups by `pic`, the data may list the same `fac` more than once). Q9.
* **DM doc and Explorer shared code** need no change except text: `FACILITY_NAMES` (`campaign-rules.js` 37) already makes "Temple" from `temple`; the special `shrine` word rule at lines 46-47 can go.
* **Req. party level:** 8 for each Shrine today (21-day build); a single Temple would normally inherit 8. Q10.

---------------------------------------------------------------------

## 8. The Beast Pit (facility-side notes only; its design is another analyst's)

* Replaces three `species.home` values, `room`/`roomBase`, `trainingPlaces`, `trainingBonus` (section 3.6). "One of each type" means room is a per-species flag, not a per-level number; `R.creatureRoom` (creature-rules.js 232) and the three "Room: n of m" lines (`tool.js creatureSection` ~4180) need replacing.
* New species Buckbear and Fellcat need `creatures-data.js` entries; the `war:` block, `defendOnly`, `worstResult`, `woundedDays` exist only for the war and should not be copied.
* The Pit must keep the `housesSpecies` mechanics: `R.housingOptions`, `R.waitingCreatures`, `R.houseOrderAt` (one House order at a time per building), `R.releaseCreature` (Release…), `R.renameCreature` (names) and `R.assignHandler`, because those are "housed, then named, then assigned a handler as before".
* `R.creatureDemolishNote`, `R.creatureStatus` talk about "the Tower isn't standing" text; wording changes.
* A **single-level** facility flag (no Upgrade row) is needed for the Hall; the Pit probably wants it too (room does not grow); needs a decision from Harry only if he wants the Pit to level (Q10).

---------------------------------------------------------------------

## 9. Contradictions, ambiguities and conflicts

1. **"Temple of X"** in the handover vs **"Shrine of X"** in the code (section 0).
2. **"Favour of the gods" panel removed, but the Temple needs Favour bars**: consistent only if "remove the panel" means the bottom-bar panel (and Claim), not the stored `favour` (my reading; the DM doc's favour edit/meter depends on the stored value).
3. **"Spend the full bar" vs the existing partial costs** (0/5/10/25%): a rule change, not a copy. Harry's "e.g." of three Pelagos blessings leaves out the L3 Aquatic Protection Charm.
4. **"Exactly the same as the 'blessings' prayer"**: only one of the three prayers adds Favour.
5. **Starting facilities** are removed too (Barracks, Armoury, Watchtower) but code, tests, docs and two message strings say there are "five starting facilities" that "can't be demolished".
6. **Defenders/Menagerie Beasts/Military lists** are not listed for removal yet lose all their sources.
7. **Voyage protections** (Convoy, Approaches) have no stated destination.
8. **"One of each beast type"** vs existing saves that can hold up to 6 wyverns, 5 griffins, 5 dire wolves, and vs the Explorer's grant of "further wyverns" (19 October 2026 decision in `creatures-data.js` 89-92).
9. **"Calligrapher's Tools / Alchemist's Tools"** are "Supplies" in the data; "Research" is ambiguous (section 6).
10. **Under Repair** (`state.repairs`, chosen at random from built facilities after a lost Defend Bastion) only exists for the war; the war area decides. It will keep working with fewer facilities.
11. **CLAUDE.md:** its "faithful rebuild" rule is superseded by the handover. Rules that still bite: plain `<script>` tags (any new `migrate`/Temple/Pit file must be added to the manifests: `shared/data/tools.js`, `tests/rules.html`, and for the Beast Handler page `beasthandler.html` if used); data in `.js` data files, rules apart from screen (the Temple's logic belongs in `rules.js`/a rules file, not `tool.js`); clean shutdown (the Temple/Pit screens must use `life.on`); **art must be moved to `assets/extras/` and listed in `docs/ASSETS.md`, never deleted** (10 facility paintings, 9 map overlays; ASSETS.md rows 307-323 and 431-441); "Bugs: only fix ... record every fix in KNOWN_ISSUES"; UK English and Scarlett Isles spellings; no keys or online services.
12. **`guide.html` is tested** (`tests/e2e/guide.test.js` checks every bold label the guide names exists in its tool). The guide has bold text for Barracks, Armoury, Watchtower, Library, Arcane, War Room, Shrines, Roost, Tower, Den, Menagerie at lines 195, 203, 212, 220, 230, 234, 237-243, 247-256, 272-274, 295. Remove/rewrite them with the code or that test fails.

---------------------------------------------------------------------

## 10. Everything that must be touched (checklist by file)

**Data:** `tools/bastion/data/facilities-data.js` (delete 13 blocks, add Temple + Beast Pit, update header comment); `bastion-data.js` (`startingBuilt`, `facilityImages`, `facilityTileCrops`, `mapLabels`, `map.overlays`, `levelEffects`, a new migration table, `hallTips` unaffected); `commerce-data.js` (`protections`); `creatures-data.js` (all five tables, new species); `research-data.js` (`needs.lab`, texts 47/173/187/213); `goods-data.js` (line 49 text; keep the seven shrine goods and the chart); `war-room-data.js` (delete with the war); `compendium-data.js` (the 43 entries: keep the file's hand-written entries or retire; item test counts change); `shared/data/party-items.js` (shrine texts), `shared/data/tools.js` (manifests).
**Rules:** `rules.js` (migration, `defaultState`/`v`, `fromSave`, `isOldSave`, `computeFnCost` Armoury branch, `issueOrder` Library note + drill/muster branches, `fnOptions`, `completeSimpleOrder` branches, `R.shrineGod`, `favourBlocker`, `startingBuilt` text, `demolishFacility` message, `isEmissary` untouched); `creature-rules.js` (rooms, homes, training removal); `regiment-rules.js`, `war-campaign-rules.js` (`recruitUnit`, `warCouncilOpen`, `beastQty` use) and the rest of the war: war area; `commerce-rules.js` (comments only if protections change); `courier-rules.js` unaffected.
**Screens:** `tool.js` (GRID_START; `fnRow` special cases; Recruit picker; `regimentSection`; `shrineSection` -> Temple panel; `creatureSection` -> Pit; Management panel; Favour panel; War lock text; `openerFor`; first-paint count "5"; day loop `tickTraining`/`settleRegiments`; stat-tip code for beasts/units), `bastion.css` (Menagerie/Military row styles 738, War Room picker 1126, Watchtower comment 1305, regiments 1512, creatures 507).
**Shared / other tools:** `shared/js/campaign-rules.js` (`inDaysSave`, `FACILITY_NAMES`, shrine word rule), `shared/js/bridge-rules.js` (`FALLBACK_CREATURES`, comments 47/161), `tools/explorer/tool.js` 1494 and `journey.js` 665 (text), `tools/beasthandler/projection.js`/`model.js`/`view.js`/`bastion-link.js` (facility shape, text).
**Art:** move to `tools/bastion/assets/extras/` and update `docs/ASSETS.md`: facility paintings `barracks, armoury, watchtower, menagerie, war_room, library, laboratory, shrine_of_{telluria,aurush,pelagos}` (reuse some for Temple/Pit tiles if wanted) and map overlays `library, laboratory, war_room, shrine_of_*, wyvern_roost, griffin_tower, dire_wolf_den` (keep what the Temple/Pit draw); panel art `bastion_defenders.png`, `military.png` if their panels go.
**Tests that must change** (counts are mentions of the 13 ids): rules `bastion` (about 165), `bastion-campaign` (about 45), `creatures` (about 150), `wyvern-bonding` (25), `beast-bonding`, `beasthandler-link/-model/-projection/-tables`, `commerce` (21), `campaign`, `explorer` (1), `session-safety` (8); e2e `phase9` (about 75), `bastion-screen` (about 80), `creatures` (about 95), `shrines` (15), `shrines-explorer` (1), `war-room` (delete/rewrite), `wyvern-bonding`, `beast-bonding`, `beasthandler`, `-meet`, `-phone`, `-write`, `charter-terms` (6), `bastion-days` (3) and `phase8` (1) (they use a Barracks order as their sample; use a Dock or Workshop order), `guide`; `tests/rules.html` manifest; seven fixtures stay (they are the inputs for the migration tests). `tests/e2e/README.md` descriptions of the removed tests.
**Docs:** `docs/BASTION-EXPLORER-REFERENCE.md` (sections 5.3 table lines 847-880, 991-993, 1228-1252, 1406, 1733, 1891-1894), `docs/FACILITIES-OVERHAUL-PLAN.md`, `docs/BASTION-MAP-ART.md`, `docs/ASSETS.md`, `docs/MILITARY-DIPLOMACY-PLAN.md` and `docs/WAR-RULES.md` (war), `docs/specs/*` (mark superseded: war-room-training, griffin-dire-wolf-development-proposal, beast-handler-proposal, hall-of-emissaries-redesign), `docs/PROGRESS.md`, `docs/KNOWN_ISSUES.md` (new entries from BAS-99; and a note that BAS-89/94/95/96 are superseded), `guide.html`, `docs/PHONE-PAGE.md`.

---------------------------------------------------------------------

## 11. Suggested order of work for this area (inside the one big PR)

1. Decide the questions that change data (Q1-Q5, Q10), since they decide the Temple/Pit definitions and the Dock's protection list.
2. Data first: new facility blocks; strip the 13; `startingBuilt = ['workshop','dock']`; images/labels/overlays; commerce protections; creature homes.
3. Rules: `R.migrateToV4` + its table + version gates + `isOldSave` + `inDaysSave`; make the god lookup data-driven; strip dead branches in `completeSimpleOrder`/`computeFnCost`/`issueOrder`/`fnOptions`.
4. Write the migration tests **before** the screens (the fixtures exist), including idempotence.
5. Screens: grid, Temple panel, Beast Pit panel, Management panel decision, Favour panel removal.
6. Shared code and the Beast Handler's use of the facility id.
7. Manifests, tests, guide, docs, art moves. Re-run `guide.test.js` last.

---------------------------------------------------------------------

## 12. Questions for Harry (also in the structured summary)

Q1. **Which three blessings per god?** (default: Pelagos exactly as his example; Aurush: Blessed Lantern, Consecrate Expedition Supplies, Great Rite; Telluria: Earthward Talisman, Rootguard Salve, Great Rite. This drops Aquatic Protection Charm, Purification Incense, Bless Bastion Foundations, the six Craft charms and the hint/long-rest prayers.)
Q2. **How the Temple runs:** does it have levels 1-5 with each blessing keeping its old level (Voyage/Talisman/Lantern 2, Salve 3, Commercial Shipment/Consecrate 4, Great Rite 5), and are Pray (1 day) and the blessing orders still timed orders (3/4/5/7 days) that spend the full bar when they start? (default yes to all)
Q3. (merged into Q2.)
Q4. **Voyage protections from Barracks and Watchtower:** disappear, or move to the Dock? (default: disappear; the Dock keeps only the Pelagos blessing)
Q5. **Management panel lists** (Defenders, Menagerie Beasts, Military): remove with the war, or keep as hand-typed notes? (default: remove; keep Creatures and the Beast Handler box)
Q6. **Converting the live campaign:** give gold, Favour and held goods back for orders the removal cancels; Temple takes the highest shrine level; no free Workshop levels. (default yes, with a plain-English report on first open)
Q7. (merged into Q6.)
Q8. **Beasts over the one-per-type limit:** keep them all housed (limit applies to new beasts only)? (default yes; Elara's wyvern counts as the wyvern slot and counts as already acclimatised at Bond 1)
Q9. **Map and tile art for the Temple and the Beast Pit:** draw the three existing shrine / beast-building paintings together until new art exists? The Barracks, Armoury and Watchtower stay visible in the base painting. (default yes)
Q10. **Build rules:** Temple at party level 8 and Beast Pit at 5, 21 days each; construction slots left at 0/2/4/5/6 even though only Hall, Temple, Pit use them; Pit single-level. (default yes)
