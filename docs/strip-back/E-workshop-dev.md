# Area E: Workshop overhaul and Development-facility mechanics overhaul

Analysis only. Nothing in the repo was edited. Repo state read: branch `claude/gallant-ramanujan-klwz70`, commit `76c1276` (main at `4f1db26` plus Harry's three beast pictures). Everything below was read from the code and checked by running the real `rules.js` in a throw-away Node VM (scratch scripts are in this folder: `proto.js`, `cmp.js`, `inv.js`, `gen*.js`).

Line numbers are for `tools/bastion/rules.js` ("rules"), `tools/bastion/tool.js` ("tool"), `tools/bastion/data/facilities-data.js` ("fac-data") unless stated.

---

## 0. The headlines

1. **The Artisan Tools feature is small and easy to remove**, but three things hang off it: `Craft` is the only order built from them (rules:1780, 1910, 2711), the Compendium labels every tool-table item "Craft (via Artisan Tools)" (rules:3392), and 7 test fixtures plus 3 test files mention `artisanTools`.
2. **The handover says "4 production based development facilities (excluding Courier Exchange)". The code has FIVE** plot facilities besides the Courier Exchange: Herbal Gardens, Fishery & Smokehouse, Timber Yard & Sawmill, Stone Quarry & Masonworks, Weavers' Hall (six with the Courier Exchange; the in-app guide says exactly that). Four of them are built to one pattern (Level 5 build, `productionLimit: 1`, six orders, no research); the Herbal Gardens is not (see 2 below). I recommend the four, leaving the Herbal Gardens alone, **but this is Harry's call** (Q7).
3. **"Replace the Level 1 order at Level 2" strands the goods chain.** In all four facilities the Level 2, 3 and (Stone and Weavers) 4 orders use goods the earlier orders made (Raw Timber -> Sawn Lumber -> Construction Timber; Fresh Fish -> Preserved Fish -> Packs; Raw Stone -> Dressed Stone -> Masonry/Stonework; Ordinary Textiles -> Sailcloth/Garments). Once the Level 1 order is gone nothing can make Raw Timber, and the DM **cannot add trade goods by hand** (`R.manualAddGoods` / `R.addSupplies`, courier-rules.js:545-556, refuse anything that is cargo; the list is just packs and charts). A Level 2 Timber Yard with an empty Warehouse is a dead end. 10 of the 12 orders at Levels 2 to 4 are affected (every one except the Level 4 Premium Hardwood and Premium Seafood). This is the biggest conflict in the area (Q9).
4. **Level 5 has two orders in each of the four facilities** (e.g. Major Timber Harvest and Bulk Lumber Processing), and they feed each other (bulk processing uses 3 of what the other makes). The handover's "only one order at a time" cannot be literal at Level 5 without breaking the chain. Proposed: both show at Level 5, still one running at a time (Q8).
5. **The Herbal Gardens cannot take the replace rule without breaking its research tree.** Research opens at Level 2 (the same moment the Level 1 Harvest and Greenhouse Harvest would be replaced), and 9 of the tree's 12 working research choices touch those two Level 1 orders, and 5 of them do nothing else. Also the Herbal Gardens has TWO orders at Level 1 (Harvest and Greenhouse Harvest, the second gated by party level 9). Details in section 7.
6. **Pending orders are safe, if (and only if) the replaced orders stay in the data file.** Proved with the real rules: an order issued at Level 1 still completes after the facility reaches Level 2 even though it is no longer offered. If an order id were deleted from `facilities-data.js`, a pending one would turn into `orderKind` "none" and complete to nothing (rules:2726, 2232). So: hide by level, never delete.
7. **No save change is needed for the development-facility change** (no new save field; levels already exist). **The Workshop change does need a save step** because the Library & Scriptorium and Arcane Laboratory are being removed (handover) and their pending orders must be re-homed; the existing v2->v3 machinery (`R.migrateToV3`, rules:227) is the pattern to extend, but it is hard-wired to `v === 2` (rules:229, 353; tool:91) and `shared/js/campaign-rules.js:52` only accepts v2/v3.
8. **Content the handover leaves open** (the Workshop cannot be finished without it): the Handyman's list ("to be provided"), the Artisan's extras ("TBD"), and where six artisan tables (103 items), Craft Magic Item (22), three Armaments-table items and the legacy Smithing go. Section 4.
9. **Staff concurrency is undefined.** Today Craft is one-at-a-time (rules:1808). Five staff could mean five jobs at once (about five times today's crafting speed). Q3.
10. **Name mismatches to settle quietly:** Harry writes "Alchemist's Tools" and "Calligrapher's Tools"; the data tables are "Alchemist’s Supplies" and "Calligrapher’s Supplies" (use the data's names). Harry's Scholar "Research" is the Library's scripture order, not the facility Research trees (tokens and branches) that the Herbal Gardens has; both words would sit in one Bastion.

---

## 1. The Workshop today

### 1.1 Data (fac-data:73 onwards)
- `workshop`, `requiredLevel: 5` (irrelevant: it is a starting facility, `bastion-data.js:8` `startingBuilt`), three functions:
  - `craft` (line 78): 3 days, 0 gp, **no options in the file**. The list is built at run time from the Artisan Tools the DM picked.
  - `craft_magic_item` (line 87): 10 days, 22 fixed options.
  - `smithing` (line 163): 5 days, 29 fixed options, `onlyIfLegacy: "smithy"` (shown only if the save's `legacyFacilities` contains "smithy"; rules:1846).
- Workshop has **no `requiredFacilityLevel` on any order and no `levelEffects.workshop`** (bastion-data.js:111 onwards), so its Upgrade row says "Level N unlocks nothing new yet" (tests/rules/session-safety.test.js:45, 59 assert that). Levels 1 to 5 exist for it (generic Upgrade, 7/14/21/28 days, no gold: bastion-data.js:99-104, rules:1478-1500) but do nothing.

### 1.2 Artisan Tools (the six slots)
- State: `state.artisanTools`, an array of exactly six strings (rules:125 default; rules:373 loader keeps strings only). It is saved with the Bastion; `R.saveProblem` (rules:1035) does not check it.
- UI: `artCard` in tool:3111-3153: six `<select>`s (`data-test="artisan-0".."artisan-5"`), each offering "(None)" plus the nine table names from `R.toolTableNames` (rules:1768: names ending "Tools"/"Supplies"), a hover tooltip showing the first 24 items, Save and Clear buttons (Clear asks first). It is put in the Workshop's facility panel at tool:3844 (`id === 'workshop' ? ... artisan`). `renderArtisan()` is called from the main render at tool:5563. CSS: `bastion.css:488` (`.tsi-bas-facpanel__artisan`), `:892` (background `assets/panels/artisan_tools.png`, 1.88 MB), `:1194` (the tool grid). The picture's licence/location is recorded in docs/ASSETS.md:333.
- Flow: `R.craftItems(s, tools)` (rules:1772) unions the chosen tables and sorts A to Z; `R.fnOptions` (rules:1780-1783) returns them as `{label, craftItem}` for `workshop/craft` only; `R.issueOrder` (rules:1910-1913) re-derives the chosen item from the index; `R.completeSimpleOrder` (rules:2711-2714) appends 1 typed Warehouse row (note "Workshop") and logs "Crafted: X".
- A fresh Bastion has no tables picked, so **Craft's list starts empty** (docs/BASTION-EXPLORER-REFERENCE.md:987).
- Craft is one at a time: `pendingSame` (rules:1808) refuses a second pending order with the same facility and order id. Craft Magic Item and Smithing are separate order ids, so they can run beside it.

### 1.3 Where the other things the handover names live today
| Handover item | Where it is now |
|---|---|
| Smith's Tools | Artisan table "Smith’s Tools" (30 items, tools-data.js:51); also the legacy `smithing` order (29 items, 5 days) |
| Calligrapher's Tools orders | Artisan table "Calligrapher’s Supplies" (12 items, tools-data.js:218): 3 free-text items plus 9 "Chart of ..." items |
| Overland Charts | Library & Scriptorium `prepare_overland_travel_charts` (fac-data:638; Library Level 2) |
| Research | Library & Scriptorium `research` (fac-data:616): the four scriptures |
| Alchemist's Tools | Artisan table "Alchemist’s Supplies" (17 items, tools-data.js:83); and Arcane Laboratory `alchemy` (20 items, party level 9) |
| "anything the Arcane Laboratory could craft" | Arcane Laboratory `craft_common` (5), `craft_uncommon` (11), `alchemy` (20) |

### 1.4 Other things that mention the Artisan Tools
- Compendium: `R.compendiumIndex` (rules:3370-3395) lists all 12 tables' items as "Workshop - Craft (via Artisan Tools)" (the pill text is built in tool:5287). The count assertion is 270 items / 271 entries (tests/rules/bastion.test.js:55-56 and creatures.test.js:194).
- Tests: tests/rules/bastion.test.js:49-50 (12 tables, 9 selectable), :145 (`artisanTools.length === 6`), :259-272 (Craft from Smith's Tools); tests/e2e/phase9.test.js:2490-2498 and bastion-screen.test.js:800-808 (artisan selects and Craft options); fixtures `tests/fixtures/bastion-*.json` (7 files carry `artisanTools`).
- Docs: guide.html lines 204 and 247; docs/BASTION-EXPLORER-REFERENCE.md:821, 856, 984-987, 1471; docs/LEVEL-9-10-READINESS.md:20 (E1 Clear buttons); docs/PROGRESS.md; KNOWN_ISSUES BAS-17 and BAS-39 (history only).
- Stale data text: Craft's `notes` (fac-data:84) lists 12 sets including Tinker's, Cobbler's and Thieves' Tools, which have no table; the panel already hides that note for Craft (tool:3351, `!isCraft && fn.notes`).

---

## 2. What the handover wants, and where it is vague or clashes

> Remove "applying Artisan Tools". Where the 6 Artisan Tool slots are, put 5 staff slots that open one by one as the Workshop upgrades: L1 Handyman (common crafting, list to be provided), L2 Smith (Smith's Tools), L3 Scholar (Calligrapher's Tools orders + Overland Charts + Research), L4 Alchemist (Alchemist's Tools + anything else the Arcane Laboratory could craft), L5 Artisan (adds options to each earlier list, TBD).

Vague, clashing or missing:
- **L1 and L5 contents are not given.** CLAUDE.md says never to call something finished if it is a placeholder; these two have to ship as explicit, recorded placeholders (KNOWN_ISSUES) or wait for Harry's lists.
- **Six artisan tables have no staff member:** Weaver's, Leatherworker's, Carpenter's, Mason's, Glassblower's Tools and Brewer's Supplies (104 rows, 103 distinct; "Backpack" is in two). Today a DM can pick them. The handover never mentions them. Probably what "common crafting" is meant to cover.
- **Craft Magic Item (22 items, 10 days) is not mentioned.** Not an artisan-tool feature, so I read it as staying.
- **Staff concurrency** (can the Scholar research and draw a chart at once? do five staff work in parallel?) is not said.
- **"Orders"** for the Scholar: the handover says "Calligrapher's Tools orders + Overland Charts + Research" - three different kinds of order (free-text item crafting; a production recipe that makes a supply good; a scripture that becomes a Warehouse row). They need different engine paths (rules:2250 production, 2711 craft, 2716 generic), see 5.2.
- **Overland Charts move later**: Library Level 2 today -> Workshop Level 3 (Scholar). Tests creatures.test.js:224-278 assert the Library's wording.
- **Alchemist wording** "any items this doesn't already include": by exact label that is 19 items; by meaning, 3 of them are the same potion under another name (section 4).
- **Existing campaigns lose breadth, not data**: a Workshop at Level 1 would offer only the Handyman's list, where a DM could previously pick any six tables. Intentional per the handover, but worth a line in the migration notice.

---

## 3. Inventory: every current order that would land under a staff member

### 3.1 Everything that exists today, order by order

All of these cost **0 gp** (`costGP: 0`, or `null`/`costText: null` for `smithing`, which `R.computeFnCost` reads as 0). The Workshop is a starting facility, so nothing here has a party-level gate except where stated.

| # | Facility | Order id (file line) | Label | Days | What it makes / how it ends | Choices | Gates and quirks |
|---|---|---|---|---|---|---|---|
| W1 | Workshop | `craft` (facilities-data.js:78) | Craft | 3 | 1 of the chosen item goes into the Warehouse as a typed row (note "Workshop"); log "Crafted: X" (rules.js:2711) | Built on the fly: every item in the Artisan Tools tables the DM picked in the six slots, A to Z (`R.craftItems`, rules.js:1772). Empty list until the DM picks tables | One `craft` at a time (`pendingSame`, rules.js:1808). The data `notes` text still lists 12 sets (it names Tinker's, Cobbler's and Thieves' Tools, which have no table); the panel hides that note |
| W2 | Workshop | `craft_magic_item` (:87) | Craft Magic Item | 10 | Typed row with the item's name (generic path, rules.js:2716) | 22 fixed items | Note says "not available until party level 9" but there is no `requiredPartyLevel`: it is **not enforced** (Harry's B7, "kept as a note only") |
| W3 | Workshop | `smithing` (:163) | Smithing | 5 | Typed row | 29 fixed items | `onlyIfLegacy: "smithy"`: hidden unless the save has `legacyFacilities` containing "smithy" (a Bastion that once had the Smithy). Items are the Smith's Tools table without Javelin |
| L1 | Library & Scriptorium | `research` (:616) | Research | 5 | Typed row named after the scripture, note "Library & Scriptorium" (the scripture benefit text never attaches: BAS-26 / B16, rules.js:1928 looks up "Geographical Scriptures" in a table keyed "Geographical") | 4: Geographical Scriptures; Religious Scriptures; Combat Scriptures; Political scriptures | Not a production order, so it runs beside the chart order. Has **nothing to do with the facility Research trees** (tokens, branches), which only the Herbal Gardens has |
| L2 | Library & Scriptorium | `prepare_overland_travel_charts` (:638) | Prepare Overland Travel Charts | 4 | 1 `overland_chart` good into the Warehouse (a supply, not a trade good), via `R.completeProduction` | 1 (`outputs: [{good: overland_chart, qty: 1}]`) | `requiredFacilityLevel: 2`, `production: true`; the Library has `productionLimit: 1`. No gold, no inputs. The Courier Exchange can carry charts; the DM can also "+ Add supplies" them |
| A1 | Arcane Laboratory | `craft_common` (:469) | Craft Common | 5 | Typed row | 5 | none |
| A2 | Arcane Laboratory | `craft_uncommon` (:494) | Craft Uncommon | 10 | Typed row | 11 | none |
| A3 | Arcane Laboratory | `alchemy` (:537) | Alchemy | 5 | Typed row | 20 | `requiredPartyLevel: 9` (kept from the old Laboratory by Harry's D1, 13 October 2026) |

### 3.2 The item lists, exactly as stored

**The nine selectable tables** (tools-data.js; `R.toolTableNames` picks names ending "Tools" or "Supplies"). Names are the data's: **Smith’s Tools, Alchemist’s *Supplies*, Calligrapher’s *Supplies*** (Harry's handover says "Alchemist’s Tools" and "Calligrapher’s Tools"; same tables).

- **Smith’s Tools** (30): Battleaxe; Handaxe; Greataxe; Warhammer; War pick; Longsword; Shortsword; Greatsword; Scimitar; Rapier; Dagger; Spear; Javelin; Trident; Mace; Morningstar; Flail; Halberd; Glaive; Pike; Lance; Chain shirt; Scale mail; Chain mail; Plate armor; Ring mail; Half plate; Manacles; Caltrops; Grappling hook
- **Alchemist’s Supplies** (17): Acid vial; Alchemist’s fire; Basic poison; Antitoxin; Firebomb (reskinned alchemist’s fire); Frost vial (cold variant); Sticky bomb (glue grenade); Potion of healing (common); Potion of greater healing (base item); Potion of superior healing (base item); Potion of supreme healing (base item); Potion of climbing (base item); Potion of water breathing (base item); Potion of resistance (base item); Darkvision draught (base item); Stoneskin varnish (base item); Vitality tonic (base item)
- **Calligrapher’s Supplies** (12): Spell scroll (mundane script); Certificate or deed; Official seal script; Chart of Southern Province; Chart of Western Province; Chart of Eastern Province; Chart of Northern Province; Chart of Midland Province; Chart of The North Isle; Chart of The East Isle; Chart of The Bolt Isle; Chart of the Great Sea Road
- **Weaver’s Tools** (19): Common clothes; Costume clothes; Fine clothes; Traveler’s clothes; Robe; Cloak; Clan Farmer Warrior Disguise; Clan Blackstone Warden Disguise; Clan Bacca Warrior Disguise; Clan Slade Warrior Disguise; Clan Rowthorn Warrior Disguise; Clan Molten Warrior Disguise; Clan Karr Warrior Disguise; Agent of Aurush Disguise; Pelagosi Tide-Preacher Disguise; Tellurian Priest Disguise; Blanket; Bedroll; Backpack
- **Leatherworker’s Tools** (27): Leather armor; Studded leather armor; Hide armor; Leather shield cover; Leather shield straps; Leather scabbard; Leather sheath; Boots; Gloves; Bracers; Leather coat; Reinforced cloak; Backpack; Saddlebags; Quiver; Map case (leather); Whip; Sling pouch; Saddle; Tack and reins; Tent (leather panels); Bedroll straps; Waterproof cover; Boots (magic item base); Belt (magic item base); Cloak (magic item base); Bracers (magic item base)
- **Carpenter’s Tools** (21): Wooden shield; Wood‑cored shield; Wooden laminar armor piece; Door frame; Window frame; Gate frame; Portcullis frame; Chest (wooden); Coffer (wooden); Lockbox (wooden body); Ladder; Scaffolding section; Platform; Stake; Barricade; Palisade section; Small boat hull (simple); Cabin (wooden structure); Interior wall (wood); Wooden floor section; Bridge (wood)
- **Mason’s Tools** (17): Stone wall section; Brick wall section; Tower (stone); Keep (stone); Cellar (stone); Foundation (stone); Stone staircase; Brick fireplace; Brick chimney; Stone door; Stone threshold; Stone bridge; Stone road section; Statue; Flagstone floor; Stone tile; Moat lining (stone)
- **Glassblower’s Tools** (7): Arcane focus (crystal); Arcane focus (orb); Bottle, glass; Vial, glass; Spyglass; Window pane; Stained glass window
- **Brewer’s Supplies** (13): Fermented ale; Fermented beer; Fermented cider; Fermented mead; Fermented wine (table); Strong liquor (simple); Weak beer / small beer; Keg of ale; Keg of beer; Cask of wine; Bottle of wine; Bottle of spirits; Brewing yeast culture

**The three tables the DM cannot pick** (only the Compendium shows them): 
- **Arcana Table** (15): Bead of Nourishment; Bead of Refreshment; Lock of Trickery; Mystery Key; Potion of Climbing; Bag of Holding; Cap of Water Breathing; Circlet of Blasting; Cloak of Protection; Gem of Brightness; Hat of Disguise; Potion of Resistance; Potion of Water Breathing; Saddle of the Cavalier; Sending Stones
- **Armaments Table** (10): Dread Helm; Moon-Touched Sword; Shield of Expression; Smoldering Armor; Walloping Ammunition; Saddle of the Cavalier; Sentinel Shield; Shield, +1; Sword of Vengeance; Wraps of Unarmed Power, +1
- **Magic Items (Implements) Table** (14): Bead of Nourishment; Bead of Refreshment; Charlatan's Die; Bag of Holding; Boots of Striding and Springing; Boots of the Winterlands; Gloves of Swimming and Climbing; Gloves of Thievery; Potion of Healing (greater); Potion of Water Breathing; Ring of Jumping; Ring of Swimming; Ring of Warmth; Stone of Good Luck

**Fixed order lists:**
- **Craft Magic Item** (22): Bead of Nourishment; Bead of Refreshment; Charlatan's Die; Bag of Holding; Boots of Striding and Springing; Boots of the Winterlands; Gloves of Swimming and Climbing; Gloves of Thievery; Potion of Healing (greater); Potion of Water Breathing; Ring of Jumping; Ring of Swimming; Ring of Warmth; Rope of Climbing; Stone of Good Luck; Shield of Expression; Walloping Ammunition; Saddle of the Cavalier; Sentinel Shield; Shield, +1; Sword of Vengeance; Wraps of Unarmed Power, +1
- **Smithing** (29, legacy): the Smith’s Tools table less Javelin.
- **Craft Common** (5): Bead of Nourishment; Bead of Refreshment; Lock of Trickery; Mystery Key; Potion of Climbing
- **Craft Uncommon** (11): Bag of Holding; Cap of Water Breathing; Circlet of Blasting; Cloak of Protection; Gem of Brightness; Hat of Disguise; Potion of Poison; Potion of Resistance; Potion of Water Breathing; Saddle of the Cavalier; Sending Stones
- **Alchemy** (20): Burnt Othur Fumes (Poison); Essence of Ether (Poison); Torpor (Poison); Acid vial; Alchemist’s fire; Basic poison; Antitoxin; Firebomb (reskinned alchemist’s fire); Frost vial (cold variant); Sticky bomb (glue grenade); Potion of healing (common); Potion of greater healing (base item); Potion of superior healing (base item); Potion of supreme healing (base item); Potion of climbing (base item); Potion of water breathing (base item); Potion of resistance (base item); Darkvision draught (base item); Stoneskin varnish (base item); Vitality tonic (base item)
- **Research** (4): Geographical Scriptures; Religious Scriptures; Combat Scriptures; Political scriptures
- **Prepare Overland Travel Charts** (1): "1 Overland chart"

### 3.3 Proposed mapping: staff member -> existing orders

The principle: **keep every existing order id and its numbers** (so pending orders in saves still complete and no number changes without Harry asking), tag each with its staff member and the Workshop level it needs, and add only what the handover adds. Ids are unique across Workshop, Library & Scriptorium and Arcane Laboratory (checked: craft, craft_magic_item, smithing, research, prepare_overland_travel_charts, craft_common, craft_uncommon, alchemy), so moving the Library's and Laboratory's orders into the Workshop needs only a change of `facId`.

| Staff | Opens at Workshop level | Orders (id) and days | Items | Source today |
|---|---|---|---|---|
| **Handyman** | 1 | `craft` (kept id), 3 days | **List to be provided by Harry.** Proposed placeholder: the six unclaimed tables joined (Weaver’s 19, Leatherworker’s 27, Carpenter’s 21, Mason’s 17, Glassblower’s 7, Brewer’s Supplies 13 = 104 rows, **103 distinct**) | Workshop Craft with those six picked |
| **Smith** | 2 | new `craft_smith`, 3 days (the Workshop Craft time) | Smith’s Tools table, **30** (includes Javelin) | Workshop Craft with Smith’s Tools picked |
| | | `smithing` (legacy, 5 days, 29): retire. Keep the id in the data as `retired: true` (hidden, still completes) so a pending one finishes; then nothing hangs off `legacyFacilities: ["smithy"]` any more | | Smithy -> Workshop merge (rules:1846) |
| **Scholar** | 3 | new `craft_scholar`, 3 days | Calligrapher’s Supplies table, **12** (Spell scroll (mundane script), Certificate or deed, Official seal script, nine "Chart of ..." items) | Workshop Craft with that table picked |
| | 3 | `prepare_overland_travel_charts`, 4 days, no gold, makes 1 `overland_chart` | 1 | Library & Scriptorium, was Library Level 2 |
| | 3 | `research`, 5 days | 4 scriptures | Library & Scriptorium |
| **Alchemist** | 4 | new `craft_alchemist`, 3 days | Alchemist’s Supplies table, **17** | Workshop Craft with that table picked |
| | 4 | `alchemy`, 5 days, shrink to the **3** poisons the 17 do not cover: Burnt Othur Fumes (Poison), Essence of Ether (Poison), Torpor (Poison) | 3 | Arcane Laboratory (was 20 items, party level 9) |
| | 4 | `craft_common`, 5 days | 5 (4 if the duplicate potion is dropped) | Arcane Laboratory |
| | 4 | `craft_uncommon`, 10 days | 11 (9 if the two duplicate potions are dropped) | Arcane Laboratory |
| **Artisan** | 5 | no orders of its own: adds options to each list above (TBD) | none yet | new |
| *(no staff)* | - | `craft_magic_item`, 10 days, 22 items | 22 | Workshop, unchanged |

Why the shrink of `alchemy` is safe: a pending order stores its own `chosen` option, label and notes (rules:1943) and completes from those, not from the data's current option list. Why keep `craft` as the Handyman's id: a v3 save can hold a pending `craft` with `chosen.craftItem` "Longsword"; `R.completeSimpleOrder` completes any `craft` with a `craftItem` (to be generalised from `fn.id === 'craft'` to "has `craftItem`"), whichever staff list it came from.

**The Alchemist's total**, by label: 17 (Alchemist’s Supplies) + 3 poisons + 5 common + 11 uncommon = 36. Near-duplicates inside that (same potion, different label): "Potion of Climbing" (Common) vs "Potion of climbing (base item)"; "Potion of Resistance" (Uncommon) vs "Potion of resistance (base item)"; "Potion of Water Breathing" (Uncommon) vs "Potion of water breathing (base item)". The handover's "items this doesn't already include" arguably excludes those three (-> 33 items), but they differ in time (3 days from Alchemist’s Supplies vs 5 or 10 from the Laboratory). Q5.

Overlaps with Craft Magic Item (kept, 10 days): Bead of Nourishment, Bead of Refreshment (Common, 5 days at the Lab), Bag of Holding, Potion of Water Breathing, Saddle of the Cavalier (Uncommon, 10 days at the Lab). So five items can be made two ways at different speeds, and Bead of Nourishment/Refreshment would be 5 days via the Alchemist but 10 via Craft Magic Item. This duplication already exists today (Workshop vs Arcane Laboratory) and is not a new problem; flagged so Harry can say if it should be tidied.

---

## 4. Items with no obvious home (the flag list)

| # | What | Why it has no home | Proposed handling |
|---|---|---|---|
| 1 | **Six artisan tables, 103 distinct items** (Weaver’s, Leatherworker’s, Carpenter’s, Mason’s, Glassblower’s, Brewer’s) | Handover gives them to nobody; Handyman's list "to be provided" | Handyman placeholder now; Harry's list replaces it; whatever he does not want common goes to the Artisan (L5) extras |
| 2 | **Craft Magic Item** (22 items, 10 days; the party-level-9 note is not enforced, B7) | Not a staff list, not mentioned | Leave as a separate Workshop order, shown under the staff cards. Q4 |
| 3 | **Dread Helm, Moon-Touched Sword, Smoldering Armor** | In the Armaments Table (Compendium only); craftable nowhere today (the other seven Armaments items are in Craft Magic Item) | Leave as Compendium-only, as now. Candidates for Artisan/Smith extras later. Q6 |
| 4 | **Rope of Climbing** | In Craft Magic Item but in neither the Magic Items nor the Armaments table (data inconsistency, harmless) | None needed; mention in KNOWN_ISSUES |
| 5 | **Legacy Smithing** (29 items, 5 days) | Smith (3 days, 30 items) now covers it | Retire (hidden, completes if pending); note in the migration summary |
| 6 | **Research** (scriptures) | Fits the Scholar, but the word clashes with the facility Research trees | Keep the label "Research" for Harry's wording, but the Scholar's card/title should say "Scripture research" in the UI so the Herbal Gardens' Research box (tokens) is not confused with it. The note bug BAS-26 (benefit text never attaches, rules:1928) moves with it: leave alone and record |
| 7 | **Arcane Laboratory's non-order role**: `research-data.js` has a need `lab` ("the Arcane Laboratory having recipes of its own", line 41) behind the choice `rare_cultivar_development`; Herbal Gardens text names the Laboratory (research-data.js:47, 173, 187, 213; goods-data.js:49) | The Laboratory is going | Rewrite the wording to "the Alchemist" (the Workshop's L4); the choice stays "coming later" (no effect is built). Text-only |
| 8 | **Party-level-9 gate on Alchemy** (and the Greenhouse Harvest's, which is the Herbal Gardens' business) | Harry's D1 (13 October) kept it for the merged Laboratory; the Laboratory is gone | Default: no party gate, Workshop level only (the same 17 items were never gated). Q5 |
| 9 | **Library `productionLimit: 1`** (one chart order at a time) | Property of the Library, which is removed | Not needed on the Workshop: `pendingSame` already allows one pending `prepare_overland_travel_charts` (rules:1808). If staff are "one job at a time" (Q3) it is covered anyway |
| 10 | **Handyman and Artisan content** | Not supplied | Placeholders, recorded in KNOWN_ISSUES |
| 11 | **Library/Laboratory map art and tiles** (`map/overlays/library.png`, `laboratory.png`; tile pictures `library.png`, `laboratory.png`; coordinates bastion-data.js:76-77, overlays :161-162) | Facilities removed | Per CLAUDE.md move to `assets/extras/`, list in docs/ASSETS.md; remove overlay entries so the map does not look for them |
| 12 | **Chart wording**: "Chart of Southern Province" (a Calligrapher item, a typed Warehouse row) vs "Overland chart" (a counted supply good with 3 days of Explorer use) | Easy to confuse at the table | Keep both; no engine link between them. Mention in the guide |

---

## 5. Proposed design for the Workshop

### 5.1 Data (content in data files, per CLAUDE.md)
In `facilities-data.js`, `workshop` gets:
- `"staff": [{ id: "handyman", name: "Handyman", level: 1, blurb: "Common crafting" }, { id: "smith", name: "Smith", level: 2, ... }, scholar 3, alchemist 4, artisan 5]` - names, levels and one-line blurbs.
- On each order: `"staff": "<id>"` and `"requiredFacilityLevel": <the staff level>` (the existing gate field, so `R.fnAvailable` rules:1833-1851 already says "Needs Level N").
- Craft orders name their tables instead of reading the save: `"craftTables": ["Smith’s Tools"]` (Handyman: the six; Scholar: `["Calligrapher’s Supplies"]`; Alchemist: `["Alchemist’s Supplies"]`). Optional `"days"` per item later.
- `"artisanExtras": []` per order (the Level 5 hook: `R.fnOptions` appends it when the Workshop is Level 5). Empty until Harry supplies lists.
- `levelEffects.workshop` (bastion-data.js:111) is not needed if `R.levelUnlocks` (rules:1437) also reads `staff` (it already lists orders opening at a level), so the Upgrade row can say "Level 3 unlocks: the Scholar (Calligraphy, Overland Charts, Research)".

### 5.2 Rules (plain functions, apart from screens)
- Delete: `artisanTools` default (rules:125) and loader line (rules:373); `R.craftItems` (rules:1772) becomes `R.craftItemsFor(data, fn, level)`; `R.toolTableNames` (rules:1768) is only needed by the removed UI.
- Generalise three hard-coded `fac.id === 'workshop' && fn.id === 'craft'` branches to "this order has `craftTables`": `R.fnOptions` (rules:1781), `R.issueOrder` (rules:1910), and the completion (rules:2711, also accept any pending `craft` whose `chosen.craftItem` is set so old orders finish). The item's own days (`chosen.days`) are already honoured by `R.orderDaysAt` (rules:1692-1694).
- New `R.staffBusy(s, data, fac, fn)` (modelled on `productionBusy`, rules:2290): refuses an order if another pending order at the Workshop has the same `staff`, with a message such as "The Smith is busy: Workshop: Craft (Longsword), due on Day 14." (Only if Q3 stays at the default.)
- `R.compendiumIndex` (rules:3392): the tool-table pass currently labels everything "Craft (via Artisan Tools)"; label by the staff who owns the table, or keep one neutral label. The count stays 270 only if every item stays reachable; the three Armaments orphans and the three unselectable tables are already counted.
- `orderLabel` (rules:1802): a staff order reads "Workshop: Craft (Longsword)" today; suggest "Workshop: Smith - Longsword" so the Day Log and "The Ironbow sends word" say who did it. Optional.

### 5.3 Screen (tool.js, bastion.css)
- Remove `artCard`, its six selects, `renderArtisan` (tool:3111-3153, 5563) and the panel block (tool:3844); remove CSS `bastion.css:488`, `:892`, `:1194` and move `assets/panels/artisan_tools.png` to extras.
- Replace with a **staff strip** of five cards in the Workshop's panel: name, "Opens at Level N", a locked state until the Workshop reaches it, and inside each open card that staff member's order rows (the existing `fnRow`, tool:3348). `renderFacPanel` (tool:3817) builds `fns` from `fac.functions`; for the Workshop it would group by `fn.staff` instead of listing flat. `isCraft` (tool:3351) becomes "has `craftTables`". Five cards in a row at 1707 x 930: about 300 px each inside the wide panel, so it fits; the e2e layout checks (`H.layoutCheck`) will need the Workshop added.
- The Upgrade row text (tool:3208 `unlockLine`) says what each level opens.

### 5.4 Saves and migration (the Workshop's share)
The handover removes the Library & Scriptorium and the Arcane Laboratory, so a v3 save can hold: built or building slots, a level, a repair record, and **pending orders** (`research`, `prepare_overland_travel_charts`, `craft_common`, `craft_uncommon`, `alchemy`). Extend the existing machinery:
- `bastion-data.js` `retiredFacilities` (line 134 onwards) gains `library_scriptorium: { to: 'workshop', name: 'Library & Scriptorium', fns: {} }` and `arcane_laboratory: { to: 'workshop', ... }`; the three v2-era entries (`arcane_study`, `laboratory`, `library`) should point **straight to `workshop`** (not through the facilities that no longer exist), keeping `laboratory: fns { craft: 'alchemy' }`.
- Because the Workshop is a starting facility, `migrateToV3` already does the right thing for a target in `startingBuilt` (rules:249-253): frees the slot, keeps nothing else. Pending orders follow with their ids, due days and costs (rules:282-297). Levels of the removed buildings are *not* carried to the Workshop (the code deliberately skips that for starting targets, rules:299-308). Repairs likewise.
- It needs a **v3 -> v4 step**: `migrateToV3` returns early for `v === 3` (rules:229) and `R.fromSave` only calls it for `v === 2` (rules:353); `tool.js:91` quarantines an untouched copy only when `saved.v === 2`; `shared/js/campaign-rules.js:52` `inDaysSave` accepts only 2 or 3. These are shared with every other removal in the handover (Menagerie, War Room, Armoury, Temples ...), so the migration should be written once for all areas; the Workshop's part is the rows above plus: drop `artisanTools` (silently ignored by the loader anyway), leave `legacyFacilities` alone, and add a line to the plain-English summary ("The Library & Scriptorium and Arcane Laboratory are gone; their orders now belong to the Scholar and the Alchemist, and the Workshop's levels open them").
- Warehouse rows, the chart stock, goods and gold are untouched.
- A pending Library `prepare_overland_travel_charts` completes through `R.completeProduction` (rules:2250), which logs with `fac.name`: it will say "Workshop: ..." in the completion line while the stored label still says "Library & Scriptorium: ...". Cosmetic; tests/e2e/creatures.test.js:250-278 assert the Library wording.

### 5.5 Tests and docs to touch (Workshop)
- Rules: tests/rules/bastion.test.js lines 42 (name), 49-56, 145, 259-272, 291 (days), 1047 (Compendium links: expects `facName === 'Arcane Laboratory'` for Bag of Holding), 1372-1384 and the migration group (Smithy/Library/Laboratory cases, lines ~1300-1460), 1457; 1762-1776 (Library chart order); tests/rules/session-safety.test.js:43-45, 59-60, 76-86 (level unlocks for library_scriptorium and workshop); tests/rules/creatures.test.js:194.
- E2e: tests/e2e/bastion-screen.test.js:800-808; phase9.test.js:2150 (Craft Magic Item index 3), 2490-2498, 2697-2700 (a v2 fixture expecting `arcane_laboratory`/`alchemy` and `workshop`/`smithing`); creatures.test.js:5, 38, 224-278; courier.test.js if it touches charts.
- Fixtures: `tests/fixtures/bastion-pr3-sample.json` (library and laboratory built), `bastion-pr7-sample.json` and `bastion-pr8a-sample.json` (library) - each carries a Library; they become migration fixtures for v3 -> v4.
- New tests: staff opening by level; one-at-a-time per staff (if kept); each list's contents and days; a pending Library chart order and Laboratory `alchemy` order migrating and completing once; loading twice changes nothing; no `artisanTools` after a round trip; Compendium count.
- Docs: guide.html (203-206 facility names, 204, 234, 247); docs/BASTION-EXPLORER-REFERENCE.md (821, 856-870, 984-987, 1471); PROGRESS.md; a new KNOWN_ISSUES entry (suggested BAS-99 onwards: staff slots; Handyman/Artisan placeholders; Smithing retired; BAS-26 left alone); ASSETS.md (artisan_tools.png and the Library/Laboratory art to extras); tests/e2e/README.md.

---

## 6. Development facilities: which ones, and every Level 1 to 5 order

### 6.1 What counts as a "production based development facility"
A facility is a "Development Plot" facility when its data has `"plot": true` (fac-data; `R.startBuild` places it on a plot, never a slot; plots open 0/2/4/6 at party level 1/9/13/17). There are **six**:

| Facility (id) | fac-data line | Orders | `productionLimit` | Research tree | Matches "Timber Yard pattern"? |
|---|---|---|---|---|---|
| Herbal Gardens (`herbal_gardens`) | 665 | 6 (2 at Level 1) | none | **yes** (4 branches, 3 stages) | no |
| Fishery & Smokehouse (`fishery_smokehouse`) | 991 | 6 | 1 | no | yes |
| Timber Yard & Sawmill (`timber_sawmill`) | 1144 | 6 | 1 | no | yes (the original) |
| Stone Quarry & Masonworks (`stone_masonworks`) | 1297 | 6 | 1 | no | yes |
| Weavers' Hall (`weavers_hall`) | 1456 | 6 | 1 | no | yes |
| Courier Exchange (`courier_exchange`) | 1615 | **0** (`functions: []`; parcels have their own section) | - | no | excluded by Harry |

**Harry's "4" is not any literal count in the code:** excluding the Courier Exchange leaves five. The guide (guide.html, Development Plots paragraph) and the plan (docs/FACILITIES-OVERHAUL-PLAN.md section 6, "the six production facilities") both say six including the Courier Exchange. Before 19 October 2026 there were only four plot facilities (Herbal Gardens, Fishery, Timber Yard, Courier Exchange; phase9.test.js:310 still lists those four); with Stone and Weavers added the number became six.

Two readings:
- **(A) The four built to one pattern** - Timber Yard & Sawmill, Fishery & Smokehouse, Stone Quarry & Masonworks, Weavers' Hall. Each: Level 5 build, `productionLimit: 1`, six orders (one per level, two at Level 5), no gold, goods chain, no research. Harry's own example (Timber Yard: "Raw Timber" at Level 1, "Sawn Lumber" at Level 2) is in this group. This is the reading the handover's sentence "Current L1-L5 orders do not need to change" fits best.
- **(B) All five** (adds the Herbal Gardens). Breaks several things (section 7).

**Recommendation: (A), with the Herbal Gardens left exactly as it is.** Q7.

Everything below is for (A) unless it says otherwise. All orders: 0 gp. None uses `needsResearch`; none is affected by research (only the Herbal Gardens has a tree: `R.researchTree`, rules:1513, returns null for the others).

### 6.2 Every Level 1 to 5 order of the four (generated from facilities-data.js)

"Inputs from" says which order (at which level) makes the good this order uses. A Level 5 input that comes from the sibling Level 5 order means the two Level 5 orders feed each other.


**Timber Yard & Sawmill** (`timber_sawmill`, plot, productionLimit 1)

| Lvl | Order id | Order name | Days | Gold | Uses (taken when issued) | Makes | Inputs from |
|---|---|---|---|---|---|---|---|
| 1 | `harvest_timber` | Harvest Timber | 4 | 0 | nothing | 1 lot Raw Timber | - |
| 2 | `saw_lumber` | Saw Lumber | 4 | 0 | 1 lot Raw Timber | 1 lot Sawn Lumber | L1 harvest_timber / L5 major_timber_harvest |
| 3 | `prepare_construction_timber` | Prepare Construction Timber | 5 | 0 | 1 lot Sawn Lumber | 1 lot Construction Timber | L2 saw_lumber / L5 bulk_lumber_processing |
| 4 | `harvest_premium_hardwood` | Harvest Premium Hardwood | 7 | 0 | nothing | 1 lot Premium Hardwood | - |
| 5 | `major_timber_harvest` | Major Timber Harvest | 9 | 0 | nothing | 3 lots Raw Timber | - |
| 5 | `bulk_lumber_processing` | Bulk Lumber Processing | 8 | 0 | 3 lots Raw Timber | 3 lots Sawn Lumber | L1 harvest_timber / L5 major_timber_harvest |

**Fishery & Smokehouse** (`fishery_smokehouse`, plot, productionLimit 1)

| Lvl | Order id | Order name | Days | Gold | Uses (taken when issued) | Makes | Inputs from |
|---|---|---|---|---|---|---|---|
| 1 | `catch_fresh_fish` | Catch Fresh Fish | 3 | 0 | nothing | 1 lot Fresh Fish | - |
| 2 | `smoke_salt_catch` | Smoke / Salt Catch | 3 | 0 | 1 lot Fresh Fish | 1 lot Preserved Fish | L1 catch_fresh_fish / L5 commercial_fishing_fleet |
| 3 | `prepare_expedition_provisions` | Prepare Expedition Provisions | 4 | 0 | 1 lot Preserved Fish | 5 packs Expedition Provision Pack | L2 smoke_salt_catch / L5 bulk_smokehouse_production |
| 4 | `catch_premium_seafood` | Catch Premium Seafood | 6 | 0 | nothing | 1 lot Premium Seafood | - |
| 5 | `commercial_fishing_fleet` | Organise Commercial Fishing Fleet | 8 | 0 | nothing | 3 lots Fresh Fish | - |
| 5 | `bulk_smokehouse_production` | Bulk Smokehouse Production | 7 | 0 | 3 lots Fresh Fish | 3 lots Preserved Fish | L1 catch_fresh_fish / L5 commercial_fishing_fleet |

**Stone Quarry & Masonworks** (`stone_masonworks`, plot, productionLimit 1)

| Lvl | Order id | Order name | Days | Gold | Uses (taken when issued) | Makes | Inputs from |
|---|---|---|---|---|---|---|---|
| 1 | `extract_raw_stone` | Extract Raw Stone | 4 | 0 | nothing | 1 lot Raw Stone | - |
| 2 | `produce_dressed_stone` | Produce Dressed Stone | 4 | 0 | 1 lot Raw Stone | 1 lot Dressed Stone | L1 extract_raw_stone / L5 bulk_raw_stone_extraction |
| 3 | `produce_structural_masonry` | Produce Structural Masonry | 5 | 0 | 1 lot Dressed Stone | 1 lot Structural Masonry | L2 produce_dressed_stone / L5 bulk_stone_processing |
| 4 | `produce_decorative_stonework` | Produce Decorative Stonework | 7 | 0 | 1 lot Dressed Stone | 1 lot Decorative Stonework | L2 produce_dressed_stone / L5 bulk_stone_processing |
| 5 | `bulk_raw_stone_extraction` | Bulk Raw Stone Extraction | 9 | 0 | nothing | 3 lots Raw Stone | - |
| 5 | `bulk_stone_processing` | Bulk Stone Processing | 8 | 0 | 3 lots Raw Stone | 3 lots Dressed Stone | L1 extract_raw_stone / L5 bulk_raw_stone_extraction |

**Weavers' Hall** (`weavers_hall`, plot, productionLimit 1)

| Lvl | Order id | Order name | Days | Gold | Uses (taken when issued) | Makes | Inputs from |
|---|---|---|---|---|---|---|---|
| 1 | `produce_ordinary_textiles` | Produce Ordinary Textiles | 4 | 0 | nothing | 1 lot Ordinary Textiles | - |
| 2 | `produce_sailcloth` | Produce Sailcloth | 4 | 0 | 1 lot Ordinary Textiles | 1 lot Sailcloth | L1 produce_ordinary_textiles / L5 bulk_textile_production |
| 3 | `produce_specialist_garments` | Produce Specialist Garments | 5 | 0 | 1 lot Ordinary Textiles | 1 lot Specialist Garments | L1 produce_ordinary_textiles / L5 bulk_textile_production |
| 4 | `improved_specialist_garment_production` | Improved Specialist Garment Production | 7 | 0 | 2 lots Ordinary Textiles | 2 lots Specialist Garments | L1 produce_ordinary_textiles / L5 bulk_textile_production |
| 5 | `bulk_textile_production` | Bulk Textile Production | 9 | 0 | nothing | 3 lots Ordinary Textiles | - |
| 5 | `bulk_sailcloth_production` | Bulk Sailcloth Production | 8 | 0 | 3 lots Ordinary Textiles | 3 lots Sailcloth | L1 produce_ordinary_textiles / L5 bulk_textile_production |


### 6.3 Do later goods need earlier ones? Yes, almost all of them (the main conflict)

Read from the "Inputs from" column above. For each level, can the order be run with an empty Warehouse (**self-sufficient**) or does it use something an earlier, now-replaced order made?

| Facility | L1 | L2 | L3 | L4 | L5 (two orders) |
|---|---|---|---|---|---|
| Timber Yard | self-sufficient | needs Raw Timber (made at L1) | needs Sawn Lumber (made at L2) | self-sufficient (Premium Hardwood) | self-sufficient together: Major Harvest makes the Raw Timber Bulk Processing uses |
| Fishery | self-sufficient | needs Fresh Fish (L1) | needs Preserved Fish (L2) | self-sufficient (Premium Seafood) | self-sufficient together |
| Stone Quarry | self-sufficient | needs Raw Stone (L1) | needs Dressed Stone (L2) | needs Dressed Stone (**L2, two levels back**) | self-sufficient together |
| Weavers' Hall | self-sufficient | needs Ordinary Textiles (L1) | needs Ordinary Textiles (**L1, two back**) | needs 2 Ordinary Textiles (**L1, three back**) | self-sufficient together |

So **10 of the 12 orders at Levels 2 to 4 cannot be run unless the player stockpiled goods before upgrading**, and once the stockpile is used up the facility has nothing to do until the next level. Specific consequences, all proved with the real rules (`proto.js`):
- A Level 2 Timber Yard with no Raw Timber: Saw Lumber is refused ("Needs 1 lot of Raw Timber in the Warehouse; it has 0 lots."). Weavers' Level 4 with no stock: refused ("Needs 2 lots of Ordinary Textiles ...").
- **There is no other way to get the missing good.** Trade goods are cargo; `R.manualAddGoods` (courier-rules.js:545) only offers non-cargo supplies (today: Expedition Provision Pack and Overland chart), and `R.addSupplies` (:553) answers "Only supplies on the list can be added by hand." for Raw Timber. The only hand-edit is the count box on an existing Warehouse goods row, and a cargo row is removed the moment it reaches 0 (`R.pruneEmptyCargo`, rules:2196; Harry, 19 October 2026), so the rescue vanishes exactly when it is needed. The Dock does not buy goods.
- The one loophole is Demolish and rebuild: the level resets to 1 (`R.demolishFacility`, rules:1391) so Level 1 comes back, at the cost of a 21-day build and a plot.
- Expedition Provision Packs (Fishery Level 3, 1 Preserved Fish -> 5 packs) can still be added by hand (they are on the manual list), but Preserved Fish itself cannot.
- An upgrade does not take the facility away from Level N until it completes (it is a separate pending order: rules:1492-1500), so a player can keep making Level N goods for the 7, 14, 21 or 28 days the upgrade takes, and should stockpile in that window. That is the natural play pattern, but nothing in the screen tells them today.
- These goods are also trade cargo (Raw Timber 100 gp, Sawn Lumber 160 ... goods-data.js:28-44), so a stockpile competes with selling at the Dock.

This is a rule question for Harry, not a coding detail (Q9). Options, in order of how closely they follow the handover:
1. **Literal (recommended default).** Replace exactly as written; keep every recipe as is. Add warnings only: the Upgrade row and a confirmation before the Upgrade order say "Level 2 replaces Harvest Timber with Saw Lumber. Saw Lumber uses 1 lot of Raw Timber, which this yard can no longer make. The Warehouse has N." and a line on a dead-end order ("needs X, made at an earlier level") so a stuck player knows why. No new rules, no data change to any recipe.
2. **Self-contained orders.** Remove the `inputs` from the ten dependent recipes (data only). Every level then works on its own. But Sawn Lumber, Dressed Stone and the rest become free, which changes the economy Harry approved (inputs set aside when an order starts: BAS-76) and the saved sample files.
3. **A DM rescue.** Let "+ Add supplies" add the intermediate trade goods of these four facilities. Goes against Harry's PR 6 rule that hand-added goods must not make gold (they would, at the Dock).
4. **Keep earlier orders visible but greyed**, under an "Earlier levels" fold. Does not match "Raw Timber is no longer an option".

### 6.4 How "one order at a time, upgrading replaces it" maps onto the engine

What the engine does today (all four facilities): every function is listed in the panel; those above the facility's level show a disabled button "Needs Level N." (`R.fnAvailable`, rules:1833-1851, called from `fnRow`, tool:3348 on); `productionLimit: 1` (rules:2290 `productionBusy`) already makes only one production order *run* at a time; each pending order stores its own `chosen` recipe, inputs held, label and due day (rules:1943), so it completes without consulting the data's order list - **as long as `R.fn(fac, order.fnId)` still finds the order** (rules:2603-2604; otherwise `R.dropOrderGoods`, rules:2232, returns held goods and the product is lost).

So the change is small, because "the previous order stops being offered" is not "the previous order stops existing":

1. **Data flag.** Add `"levelOrders": "replace"` to the four facilities in facilities-data.js (explicit; do not infer it from `productionLimit`). Do not delete or renumber any order.
2. **`R.fnAvailable` (rules:1833).** For a facility with the flag: an order whose `requiredFacilityLevel` (default 1) differs from the facility's current level returns `{ ok: false, hidden: true, message: 'That order belongs to Level N.' }`. `renderFacPanel` (tool:3817) already skips `hidden` orders, so the panel then shows only the current level's order (two at Level 5), and `R.issueOrder` (rules:1853) already refuses a hidden one with that message, so a stale button, a test or a hand-edited page cannot issue a replaced order. Nothing else in the issue/complete path changes.
3. **Level text.** `R.levelUnlocks`/`R.levelUnlockSummary` (rules:1437, 1453) and `unlockLine` (tool:3208) say "Level 2 unlocks: Saw Lumber"; for the flagged facilities they should say "Level 2 replaces Harvest Timber with Saw Lumber" (and at Level 5 "replaces Premium Hardwood with Major Timber Harvest and Bulk Lumber Processing"). `onUpgrade` (tool:4601) currently issues with no confirmation; for these four it should ask first with the stock line from 6.3 option 1.
4. **Panel copy.** The facility panel header (tool:3817) could say "Level N: <order name>" once; the guide sentence "an order that needs a higher level says so on its button" no longer applies to them.
5. **Level 5.** Keep both orders (they feed each other: Bulk Lumber Processing uses 3 Raw Timber, which only Major Timber Harvest makes at Level 5). `productionLimit: 1` still means one runs at a time, so "only one order at a time" holds for *running*, and the list is two long at Level 5. Q8.
6. **Pending orders across an upgrade.** (a) An order issued at Level N is still pending when the upgrade completes: it completes normally and its goods go to the Warehouse (proved). (b) It still counts toward `productionLimit`, so the new Level N+1 order shows "busy: one production order at a time (<old order>, due Day X)" until it ends; Cancel returns its held inputs (`R.cancelOrder`, rules:1996). (c) Under Repair behaves as before: orders wait. (d) An upgrade may be issued while an order is pending, as now (research and upgrades are not production orders: rules:2294).
7. **Saves.** No new field, no migration: levels already live in `facilityLevels`. A save with a Timber Yard at Level 3 simply shows only Construction Timber (Level 3's order) from now on. Reload twice: unchanged.
8. **Goods engine, research engine, Compendium, Dock, Courier, Explorer link**: untouched. `R.compendiumIndex` skips `production` orders (rules:3381); none of the four has `needsResearch` or a research tree; `commerce-data.js` and `courier-data.js` refer to goods, not orders.
9. **Map and tiles**: unchanged (`R.mapLabels`, rules:1286, shows name and level).

**Proof run** (`proto.js`, the real `rules.js` loaded in a throw-away VM with only `R.fnAvailable` replaced in memory by the rule in step 2; nothing in the repo changed): with a Timber Yard on a plot,
- offered orders by level: L1 `harvest_timber`; L2 `saw_lumber`; L3 `prepare_construction_timber`; L4 `harvest_premium_hardwood`; L5 `major_timber_harvest` and `bulk_lumber_processing`;
- at Level 2, issuing the replaced `harvest_timber` is refused: "That order belongs to Level 1.";
- an order issued at Level 1 and still pending at Level 2 completes normally ("Added to Warehouse: 1 lot of Raw Timber.");
- then Saw Lumber is issued and takes the one Raw Timber ("Taken from the Warehouse: 1 lot of Raw Timber."); a second Saw Lumber is refused as "already pending"; and with the Warehouse empty it is refused with "Needs 1 lot of Raw Timber in the Warehouse; it has 0 lots." - the dead end described in 6.3;
- `R.levelUnlocks` still says "Saw Lumber" at Level 2 and lists both Level 5 orders at Level 5, i.e. the Upgrade text needs the new "replaces" wording (step 3).

### 6.5 Tests and docs to touch (development facilities)
- Rules: tests/rules/bastion.test.js - 1503-1514 (`stoneStock(3, ...)` issues `extract_raw_stone` and `produce_dressed_stone` at Level 3), 1532-1537 (Weavers at Level 1 asks for `produce_sailcloth`, expecting "Needs Level 2."), 1708-1727 (Timber at Level 2 issues `harvest_timber` and `saw_lumber` together, and at Level 1 expects "Needs Level 2."), 1749-1760 (Fishery at Level 5 issues `prepare_expedition_provisions`, a Level 3 order), the helpers `plots()` (1542) and `stoneStock` (1471); the "orders open by their level" wording in several test names. The structural assertions at 1479-1494 (days, levels, labels, goods exist) stay valid because no order changes.
- E2e: tests/e2e/bastion-screen.test.js 500-575 (Stone, Weavers and Timber panels expect all six rows with "Needs Level N." on the locked ones; Timber at Level 2 expects both Level 1 and Level 2 rows) and 422-440; phase9.test.js 456-470 and 2787-2793 (builds and the pr3 sample, which should be unaffected).
- New tests: each of the four shows only its current level's order(s) at Levels 1 to 5; a replaced order cannot be issued; an order pending across an upgrade completes once and its goods arrive; Cancel after the upgrade returns the held goods once; a dead-end level reports why; the Upgrade confirmation text; reload twice; Herbal Gardens unchanged (reading A).
- Docs: guide.html (Development Plots paragraph, the "Goods:" paragraph that still says "The Timber Yard and the Fishery run one production order at a time", the Stone/Weavers paragraph, and the Upgrade paragraph "A level opens new orders at the Herbal Gardens, the Timber Yard and the Fishery"); PROGRESS.md; a new KNOWN_ISSUES entry (deliberate change, Harry's STRIP BACK handover); docs/FACILITIES-OVERHAUL-PLAN.md only as history. The data header comment in facilities-data.js (lines 1-69) should gain a line on `levelOrders`.

---

## 7. What happens to the Herbal Gardens (and to its research tree)

**Reading A (recommended): the Herbal Gardens keeps its current behaviour.** Nothing changes: Level 1 Harvest and Greenhouse Harvest stay, Levels 2 to 5 add their orders (cumulative), the tree and its 7 + 14 + 21 day projects stay. Only wording changes: the tree's text and a "coming" need name the Arcane Laboratory (research-data.js lines 41, 47, 173, 187, 213; goods-data.js:49), which is being removed. They should say "the Workshop's Alchemist".

### The Herbal Gardens today (generated from facilities-data.js)

**Herbal Gardens** (`herbal_gardens`, plot, **no** productionLimit; research tree in research-data.js)

| Lvl | Order id | Order name | Days | Gate | Choices (days if different; uses -> makes) |
|---|---|---|---|---|---|
| 1 | `harvest` | Harvest | 7 |  not production (free Warehouse row) | Antitoxin (2 vials) ; Rations (100) ; Healer's Kit ; Potion of Healing ; Basic Poison |
| 1 | `cultivate` | Greenhouse Harvest | 10 | party level 9 not production (free Warehouse row) | Greater Potion of Healing ; Truth Serum ; Assassin's Blood ; Pale Tincture ; Malice |
| 2 | `cultivate_specialist` | Cultivate Specialist Plants | 4 |  production | Restorative Herbs (10 portions) -> 10 portions Restorative Herbs ; Antivenom Roots (10 portions) -> 10 portions Antivenom Roots ; Toxic Blossoms (10 portions) -> 10 portions Toxic Blossoms ; Alchemical Flowers (10 portions) -> 10 portions Alchemical Flowers |
| 3 | `field_medical_supplies` | Prepare Field Medical Supplies | 7 |  production | 2 Healer's Kits + 4 Antitoxin vials [6d] (uses 5 portions Restorative Herbs, 5 portions Antivenom Roots) -> 2 x Healer's Kit, 2 x Antitoxin (2 vials) ; 2 Potions of Healing [7d] (uses 10 portions Restorative Herbs) -> 2 x Potion of Healing ; 2 doses of Basic Poison [7d] (uses 10 portions Toxic Blossoms) -> 2 x Basic Poison |
| 4 | `commercial_medicinal_crops` | Harvest Commercial Medicinal Crops | 6 |  production | Medicinal Herbs (1 lot) [6d] -> 1 lot Medicinal Herbs ; Refined Botanical Reagents (1 lot) [7d] (uses 10 portions Alchemical Flowers) -> 1 lot Refined Botanical Reagents {needs research: botanical_extraction} |
| 5 | `major_botanical_production` | Major Botanical Production | 8 |  production | Major Medicinal Harvest: Medicinal Herbs (3 lots) [8d] -> 3 lots Medicinal Herbs ; Advanced Ingredient Cultivation: Restorative Herbs (30 portions) [8d] -> 30 portions Restorative Herbs ; Advanced Ingredient Cultivation: Antivenom Roots (30 portions) [8d] -> 30 portions Antivenom Roots ; Advanced Ingredient Cultivation: Toxic Blossoms (30 portions) [8d] -> 30 portions Toxic Blossoms ; Advanced Ingredient Cultivation: Alchemical Flowers (30 portions) [8d] -> 30 portions Alchemical Flowers ; Rare Botanical Extraction: Rare Botanical Extracts (1 lot) [10d] (uses 20 portions Alchemical Flowers) -> 1 lot Rare Botanical Extracts {needs research: exotic_flora_conservatory} |


### If Harry does mean the Herbal Gardens too (reading B): what breaks

1. **It has two Level 1 orders**, not one: Harvest (7 days, 5 products, free Warehouse rows) and Greenhouse Harvest (`cultivate`, 10 days, 5 products, party level 9). "Whatever it is listed as currently" is ambiguous; they would need folding into one order or Harry choosing one. It also has no `productionLimit` today, so up to six of its orders can run at once (one per order id); "one at a time" would be a new rule for it.
2. **Research opens at Level 2** (`R.researchCheck`, rules:1610; one token per level from 2) - the same moment Harvest and Greenhouse Harvest would be replaced. Of the 12 research choices that actually work today (the other 12 say "coming later"), **9 touch those two Level 1 orders and 5 do nothing else**, so they could never matter:
   - only on Level 1 orders: Fertile Soil (+25% rations/antitoxin on Harvest), Efficient Planting (Harvest 1 day faster), Healing Herb Refinement (Harvest's Potion of Healing x2), Improved Antitoxins (Harvest's Antitoxin 4 vials), Concentrated Restoratives (Greenhouse Harvest's Greater Potion x2);
   - half dead: Intensive Cultivation, Crop Rotation, Bountiful Harvests, Perpetual Growing Cycle (each also affects `cultivate_specialist` or later orders, which would still work);
   - unaffected: Specialist Seedbeds, Botanical Extraction, Exotic Flora Conservatory.
3. **Ingredient chain:** Level 3 Field Medical Supplies uses Restorative Herbs / Antivenom Roots / Toxic Blossoms made only at Level 2 (and at Level 5 by Advanced Ingredient Cultivation); Level 4 Refined Botanical Reagents uses 10 Alchemical Flowers (Level 2 or Level 5 only). The Healer's Kit, Potion of Healing and Basic Poison the Level 1 Harvest made directly would then only come from the Level 3 recipes.
4. **Tree wording** ("all six Herbal Gardens orders", "Harvest, Greenhouse Harvest, Cultivate Specialist Plants and Harvest Commercial Medicinal Crops") would be wrong.
5. **Size:** `herbal_gardens` appears 116 times in tests/rules/bastion.test.js and 49 times in bastion-screen.test.js; the research tests would need real redesign, not just edits.
So reading B is a research redesign, not a mechanics tweak. If Harry wants it, I would ask for his decision on items 1 to 3 first.

---

## 8. Questions that belong to Harry (each with a proposed default he can just approve)

**Workshop**
- **Q1. The Handyman's list (Level 1).** The handover says "list to be provided". Default: until Harry sends it, the Handyman crafts from the six artisan tables nobody else claims (103 items, 3 days each), so nothing the Workshop can make today is lost; it is clearly marked as a placeholder in the data and in KNOWN_ISSUES, and his list replaces it by editing one data file.
- **Q2. The Artisan (Level 5) is "TBD".** Default: build the fifth card and the hook that adds extra options to each earlier list, ship it saying "Extra options: to come", and record it as a known placeholder. Nothing is invented.
- **Q3. Can staff work at the same time?** Default: each staff member does one job at a time and the five work in parallel (so the Scholar cannot research and draw a chart together, but the Smith and the Alchemist can work side by side). Today only one Craft can run at once; this makes crafting up to five times faster. Alternatives: the whole Workshop does one job at a time, or every list is its own order.
- **Q4. Craft Magic Item (22 items, 10 days).** Not mentioned. Default: stays exactly as it is, as a separate order under the staff cards, with no party-level gate (the old "level 9" note was never applied; Harry's earlier B7).
- **Q5. The Alchemist's list.** Default: the 17 Alchemist’s Supplies items at 3 days, plus the 3 extra poisons at 5 days, plus the Laboratory's Craft Common (5 days) and Craft Uncommon (10 days) lists, each item keeping the time it has now, with no party-level-9 gate; and the three potions that are the same as one already in the Alchemist's 17 (Potion of Climbing, Potion of Resistance, Potion of Water Breathing) are left out, giving 33 items. Say if you would rather keep all 36, or keep the party-level-9 rule.
- **Q6. Dread Helm, Moon-Touched Sword, Smoldering Armor.** They are in the Compendium but nobody can craft them today. Default: leave them as they are.

**Development facilities**
- **Q7. Which are "the 4"?** The code has five besides the Courier Exchange. Default: Timber Yard & Sawmill, Fishery & Smokehouse, Stone Quarry & Masonworks and Weavers' Hall; the Herbal Gardens stays as it is, because it has two Level 1 orders and a research tree that starts at Level 2, which replacing would break.
- **Q8. Level 5 has two orders in each.** Default: both appear at Level 5 (they feed each other), still only one running at a time.
- **Q9. After an upgrade nobody can make the earlier goods.** So Level 2 Saw Lumber needs Raw Timber you can no longer produce, and the DM cannot add trade goods by hand. Default: do exactly what the handover says, and add a warning before each upgrade that says what the new order uses and how much you hold, so you stockpile first. Alternatives: let each order make its own input (the cheapest fix, but it changes the economy), or let you add the missing goods by hand.

(Not asked because I can settle them: using the data's table names ("Supplies"), hiding rather than deleting replaced orders, moving the Library/Laboratory art to extras, renaming wording that mentions the Arcane Laboratory, and the migration of pending orders.)

---

## 9. Risks and things to watch while building

- **Hiding must never become deleting.** Any order id removed from the data silently loses a pending order's product (rules:2232, 2726). Hence retired ids stay with `retired: true`.
- **Load-twice rule** (docs/FACILITIES-OVERHAUL-PLAN.md finding 1): `R.fromSave` copies only known fields; if a staff or level field were ever added to the save it must be added to the loader. This design adds none.
- **The v3 -> v4 migration is shared** with every other removal in the handover; two people writing it separately would collide. It must run on the raw save before the loader cleans it (finding 2 of the plan), keep an untouched copy, and be safe to run twice.
- **Cosmetic seams after migration:** pending Library/Laboratory orders keep their old stored labels; the completion line names the Workshop.
- **Balance drift:** five parallel crafters (Q3) and a Library chart order one level later (Workshop Level 3 is 21 days of upgrades in all, against Library Level 2 at 7 days, though the Workshop needs no 21-day build and no party level 5) change how fast charts and magic items appear. The upgrade clock is 7/14/21/28 days per step (bastion-data.js:99-104), so cumulatively Level 2 is 7 days, Level 3 is 21, Level 4 is 42 and Level 5 is 70.
- **Compendium count** (270/271) changes with every facility removal in the handover, not only this area; update the two assertions once all areas are in.
- **Layout:** five staff cards plus Upgrade row plus Craft Magic Item inside the Workshop panel must fit 1707 x 930 and 1920 x 1080 with no sideways scroll (tests/e2e use `H.layoutCheck`).
- **Starting facilities:** the handover removes Barracks, Watchtower and Armoury, which are three of the five `startingBuilt` facilities (bastion-data.js:8); the Workshop is the one that stays, but every "five starting facilities" statement (guide, tests such as bastion-screen.test.js:197, phase9.test.js:288) changes. That belongs to the facility-removal area but touches the Workshop's panel tests.
- **KNOWN_ISSUES entries to write** (CLAUDE.md): the Workshop staff change (deliberate), the Handyman and Artisan placeholders, Smithing retired, BAS-26 left alone, the replace rule and its stranded-input consequence, and whichever of Q1 to Q9 Harry answers.

## 10. Suggested build order for these two items (one PR, small commits)
1. Dev facilities: data flag, `R.fnAvailable`, level text, Upgrade confirmation, tests, guide. (No migration; can land first and stand alone.)
2. Workshop data: `staff`, `craftTables`, retired ids, moved Library/Laboratory orders (data + rules), rules tests.
3. Workshop screen: staff strip, remove Artisan Tools card and CSS, move the artisan picture to extras, e2e tests.
4. The shared v3 -> v4 migration: add the Workshop rows, fixtures, load-twice tests.
5. Wording clean-up (research-data.js, goods-data.js), docs, KNOWN_ISSUES, ASSETS.md.
