# AREA G: the Beast Pit and the new bonding system

Analysis only. Nothing in the repo was edited. Read at commit `76c1276` on `claude/gallant-ramanujan-klwz70`. One scratch prototype of the day-counting rules is at `/tmp/claude-0/-home-user-TSI-MasterSuite/2e4b90a8-69de-58d9-bccc-879a8d4b21b4/scratchpad/analysis/g-bonding-prototype.js` (its output is in Appendix D).

---

## 0. Headline findings

1. The creature system is already well separated: **record and cleaners** in `tools/bastion/rules.js` (always loaded, also by the Explorer), **rules** in `tools/bastion/creature-rules.js`, **data** in `tools/bastion/data/creatures-data.js`, **orders** in `tools/bastion/data/facilities-data.js` (three buildings), **screens** in `tools/bastion/tool.js`. The Beast Handler only ever *reads* a snapshot built from those and *asks* through `profile.set` / `order.request`. So the Pit is a re-plumbing, not a rewrite of the data model.
2. **Days are best counted inside `R.startDay`** (`rules.js:3237`). It is the one place that moves `s.day` forward, it is saved together with the new day (`tool.js:4820-4822`, `done()`), the Bastion passes every missed Explorer day through it one at a time, and a closed Bastion simply catches up on re-opening. That gives exactly-once counting for free. The one trap, which the prototype proves, is that **every absolute-day field I add must also be moved by `R.shiftDays`** (Reset Travel), otherwise a day-guard such as `lastTick` silently stops crediting days after a reset.
3. Nearly all of the old creature machinery **dies** under the handover: training programmes (SUI-48/49/50), training places, the 150 gp harness, first flight / riding, Defend Bastion bonuses, room-per-level, the three buildings, the war lines. Their *saved data* should be kept in the save (never destroyed) but not shown.
4. Things the handover leaves open that need Harry (section 4): the acclimatisation DC / who rolls; how many days each bond level needs; what happens to days earned while a milestone waits; whether Elara's wyvern counts as "the one wyvern"; whether the Pit is built like the old buildings; Blacktide's text; the d8 tables; whether the Profile screen stays editable.
5. **Hidden bug waiting to happen:** the Explorer's Grant dialog builds its sentence from one "home" per kind (`tools/explorer/tool.js:1507`). With five kinds all homed at the Pit it would print "the Beast Pit, the Beast Pit, the Beast Pit, the Beast Pit or the Beast Pit". Must de-duplicate.
6. **Version trap:** `shared/js/campaign-rules.js:52` (`inDaysSave`: `ba.v === 2 || ba.v === 3`) and `rules.js:1056` (`isOldSave`) are keyed on the save version. If the overall strip-back bumps `v`, the DM doc, `bastionComing` and Make Camp's "The Ironbow sends word" go silent for the new save. I recommend the beast migration is **idempotent and version-free** (detects the old ids itself), so it does not depend on whoever owns the version bump.

---

## 1. The current system, end to end

### 1.1 Data: `tools/bastion/data/creatures-data.js` (`window.TSI_DATA.bastionCreatures`)

| Key | Lines | What it holds | Fate |
|---|---|---|---|
| `provisional` | 32 | flag | keep |
| `species` | 48-86 | `wyvern` (home `wyvern_roost`), `griffin` (`griffin_tower`), `dire_wolf` (`dire_wolf_den`). Each: `name`, `short` (War Table token), `plural`, `home`, `war{...}`, `defendOnly`, `worstResult`, `woundedDays` | keep `name`, `plural`; `home` becomes `'beast_pit'` for all; **delete** `short`, `war`, `defendOnly`, `worstResult`, `woundedDays` if the war strip-back removes the War Table; add `buckbear`, `fellcat` |
| `grantable` | 92 | `['griffin','dire_wolf','wyvern']`, what the Explorer's Grant box offers | add `'buckbear'`, `'fellcat'` |
| `unique.elara_wyvern` | 95-107 | species wyvern, owner `elara`, `ownerName`, `name:''`, `defaultName:"Elara's wyvern"` | keep |
| `room` / `roomBase` | 115-116 | `{griffin_tower:1, dire_wolf_den:1, wyvern_roost:1}` per level; Roost base +1 | **replace** by one-per-kind cap (`pit.perKind: 1`) |
| `houseDays` | 122 | 3, only for the Explorer's pop-up wording (the real days are in facilities-data) | keep (3) |
| `nameMax` | 127 | 40, must equal `B.NAME_MAX` in `shared/js/bridge-rules.js:208` | keep |
| `development` | 134-159 | `trainingPlaces`, `rideNoun`, `firstFlightPartyLevel`, `trainingBonus` (9 ids) | **delete all four** |
| `comingLater` | 162 | "Mounted riding and flight..." | delete / reword |

### 1.2 The save record: `tools/bastion/rules.js`

| Thing | Where | Notes |
|---|---|---|
| `s.creatures` default | `defaultState` lines 197-201 | `[]` |
| `R.fromSave` | 350-457; creatures at 437 (`R.cleanCreatures(s.creatures, d.day)`), beast record at 439 | the migration hook point is just before line 353's `var s = ...` |
| `R.BOND_NAMES` | 672 | `['Unfamiliar','Acclimatised','Trusting','Bonded','Devoted','Legendary Partnership']` (bond 0-5) |
| `R.CHRONICLE_MAX` | 673 | 500 |
| `R.isPrivateNote` | 676 | fail-closed DM-only flag |
| `R.newDevelopment` | 680 | `{version:1, handlerId, bond:{level,ready}, temperament:{dominant,attachment,trigger}, training:{}, harness:{fitted,paidGP,fittedDay}, firstFlight:{approved,day,handlerId}, handlerHistory:[], seq, chronicle:[]}`; Elara's gets `handlerId:'elara'`, `bond.level:1` and Chronicle entry `ch-credit` |
| `R.cleanDevelopment` | 697-747 | **builds the kept object field by field.** A field it does not list is dropped on every reload. `regional` (≤60) and `profileLog` (≤40) are appended only when set (older saves byte-identical). **New fields must be added here.** |
| `R.CREATURE_KEYS` | 748 | `['id','species','owner','name','status','home','grantedDay','housedDay','msgId']` |
| `R.cleanCreatures` | 749-778 | `status` is `'waiting'` or `'housed'`; `home` kept only when housed; `development` kept via `cleanDevelopment`; Elara's wyvern credited Bond 1 once if housed without a development |
| `R.cleanBridge` | 537-590 | creature receipts keep `type:'creature'`, `species`, `name`, `creatureId`, `held` |
| `R.applyInbox` | 816-991; creature branch 949-960; "fresh Bastion skips earlier grants" 872-899 | `R.addCreatureGrant` + `receipt()` in one state change; notice only `if (cg.added)` |
| `R.saveProblem` | 1035-1051 | `creatures` is in the "must be a list" check (line 1041) |
| `R.shiftDays` | 3309-3341; creatures at 3337-3338 (`grantedDay`, `housedDay`) | Chronicle entry days and `handlerHistory` days are **not** shifted (history) |
| `R.startDay` | 3237-3257 | see 1.7 |
| `R.finishDay` | 3276-3289 | pushes `dayInProgress.news` into `s.word` |
| `R.clockAction` | 3295-3303 | `none` / `anchor` / `pass` / `shift` |
| `R.anchor` | 3344-3349 | first read of the Explorer's day: shifts everything, passes nothing |
| `R.migrateToV3` | 227-328 | the pattern to copy for a retired-facility merge; runs only when `saved.v === 2` (line 353) |
| `R.fnOptions` | 1780-1801 | `housesSpecies` (1792) and `trains` (1798) branches |
| `R.issueOrder` | 1853-1949 | `trains` (1861), `housesCreature/housesSpecies` (1871-1874, 1918-1926) |
| `R.completeSimpleOrder` | 2598-... | `trains` (2611), housing (2614) |
| `R.upgradeCheck` / `R.issueUpgrade` | 1478 / 1492 | every facility gets an Upgrade; `data.bastion.levels.max = 5` |
| `R.builtFacilityIds` | 1296 | returns whatever ids are in `builtExtras`, **even ids the data no longer knows** (so un-migrated old ids would look "built") |

Creature record (what is saved): `{ id, species, owner, name, status, home, grantedDay, housedDay, msgId, development? }`. Ids: `elara_wyvern`, or `cr-<explorer message id>` (`R.creatureIdFor`, creature-rules.js:128).

### 1.3 The three buildings and their orders: `tools/bastion/data/facilities-data.js`

All three: `requiredLevel: 5` (party level 5), a construction slot, 21 days to build (`time.buildDays` in bastion-data.js), no gold, Upgrade 7/14/21/28 days (bastion-data.js `levels`), `levelEffects` "Room for one more ..." (bastion-data.js:121-122, tower and den only).

| Building | Lines | Orders (id: days, level, key flags) |
|---|---|---|
| **Wyvern Roost** `wyvern_roost` | 1891-2077 | `house_elara_wyvern` (3d, `housesCreature:'elara_wyvern'`), `house_wyvern` (3d, `housesSpecies:'wyvern'`), then 12 `trains:true` programmes: `wyr_safe_acclimatisation` (5d, L1, `needsBond:0`, `bondTarget:1`), `wyr_keeper_routine` (7d, L1, B1 to B2), `wyr_signal_recall` (7d, L2, B2 to B3), `wyr_defence_drills` (7d, L2, +1 Resolve), `wyr_open_sky_return` (10d, L3, B3 to B4), `wyr_aerial_sentinel` (7d, L3, +1 Defence), `wyr_riding_harness` (7d, L4, **150 gp**, `fitsHarness`), `wyr_ascent_landing` (14d, L4, `role:'ascent'`), `wyr_emergency_recall` (7d, L4), `wyr_riders_pact` (14d, L5, B4 to B5, `needsFirstFlight`), `wyr_elite_defence` (10d, L5, +1 Attack), `wyr_combat_signals` (14d, L5) |
| **Griffin Tower** `griffin_tower` | 2079-2255 | `house_griffin` (3d, `housesSpecies:'griffin'`) + 12 `grf_*` programmes (same shape) |
| **Dire Wolf Den** `dire_wolf_den` | 2257-2433 | `house_dire_wolf` (3d, `housesSpecies:'dire_wolf'`) + 12 `dwf_*` programmes (`dwf_heel_recall`, `dwf_steady_gait`, `dwf_riders_oath`, ...) |

Facility-data header comment describing the flags: lines 62-69. Menagerie (a different thing, per-kind counts in `defenderBeasts`): 1809-1889; not touched by this area.

Other places that name the three ids (all must change): `bastion-data.js` 38-40 (`facilityTileCrops`), 84-86 (`mapLabels`), 121-122 (`levelEffects`), 169-171 (`map.overlays`); `shared/js/bridge-rules.js:143` (`FALLBACK_CREATURES`); `tools/bastion/tool.js:4206` (empty-state text); `tests/rules/bastion.test.js:77`, `session-safety.test.js:51`, `beasthandler-tables.test.js:99`, `tests/e2e/bastion-screen.test.js:317-321`, `tests/e2e/war-room.test.js:274`, plus the creature test files in 1.11.

### 1.4 Creature rules inventory: `tools/bastion/creature-rules.js` (799 lines), with a fate for each

| Function (line) | Fate |
|---|---|
| `cdata`, `R.creaturesData`, `creatureSpecies`, `creatureUnique`, `speciesName`, `speciesNoun`, `speciesNounPlural`, `speciesHome`, `creatureFacilityName`, `creatureNameMax`, `grantableSpecies` (65-115) | KEEP (the two `room` readers 106-114 are replaced) |
| `R.creatures`, `creatureById`, `creatureIdFor`, `creatureName`, `creatureOrderName`, `creatureOwnerName` (118-151) | KEEP |
| `isHouseOrder`, `houseOrderFor`, `houseOrderAt`, `waitingCreatures`, `releaseBlocker`, `releaseCreature`, `renameCreature`, `housingOptions`, `housedAt` (154-227) | KEEP; `renameCreature` loses its training-order lines (211-216) |
| `creatureRoom` (232-242), `creatureRoomPerLevel` / `creatureRoomBase` (106-114) | REPLACE with `R.pitRoom` (one per kind) |
| `housingBlocker` (245-273), `completeHousing` (277-306) | CHANGE: cap per kind instead of room per building; a pending House order for the same kind blocks only that kind; completion re-checks the cap (a migrated order could otherwise over-fill) |
| `addCreatureGrant`, `creatureGrantLine`, `creatureGrantNotice`, `creatureReceiptHead` (312-355) | KEEP unchanged (home name comes from `speciesHome`, so the text becomes "waiting for a home at the Beast Pit") |
| `creatureWar`, `fightingCreatures`, `creatureRecovery`, `defending`, `RECOVERY_WORDS`, `creatureWarLine` (359-415, 409) | DELETE with the War Table |
| `creatureStatus` (393-407) | CHANGE: kinds become `waiting`, `housing`, `pit` (at the Beast Pit), `away` ("Away from the Ironbow"), optionally `locked` |
| `creaturesAt` (418-425), `creatureDemolishNote` (427-439) | REPLACE (`R.pitSummary`); demolish rule in 2.1 |
| `devOf`, `ensureDev`, `devView`, `bondName`, `handlerName`, `addChronicle` (460-480) | KEEP |
| `trainOrder`, `trainingOrders`, `trainingOrderFor`, `trainingPlaces`, `trainingDone`, `fnSpecies`, `rideNoun`, `trainingFacility`, `trainingFnByRole`, `hasDevelopment`, `trainingOptions`, `trainingBlocker`, `issueTraining`, `completeTraining`, `tickTraining`, `trainingStatus` (483-636) | DELETE (see migration for in-flight orders). Note `R.hasDevelopment` is used by `tool.js:746`; after the change every kind has a profile |
| `assignHandler` (643-669) | CHANGE: remove `trainingOrderFor` check (654) and `firstFlight` reset (660-663); add "return the beast first if away"; reset `bonding` on a new pairing |
| `setTemperament` (671-683), `addChronicleNote` (699-707) | KEEP |
| `confirmBond` (685-697) | CHANGE: after the level rises, start the next pill (2.5) |
| `nextStepLine` (709-735) | REWRITE as a Pit line ("Needs a handler", "Ready to acclimatise", "Out on the road: 3 of 7 days to Bond 3", "Bond 3 is ready: confirm after a scene") |
| `firstFlightLevel`, `firstFlightChecks`, `firstFlightReady`, `ridingLine`, `confirmFirstFlight` (743-798) | DELETE |

### 1.5 How a creature is granted in the Explorer (end to end)

1. **Dialog:** `tools/explorer/tool.js` `onCreature` (1498) opens `creatureDialog` (1499-1548): kind select from `TSI.bridge.grantable()` (1501-1504), optional name (max 40) and "What for". Body sentence 1514-1516 (mentions each kind's home, "one creature for each level of the building"). Confirm (`ask`, 1535) then `grantNow` (1540) calls `J.grantCreature`.
2. **Rule:** `tools/explorer/journey.js` `J.grantCreature` (674-702): refuses if the browser is not saving (`opts.memory`), if `!B.isGrantable(species)`, name over 40. Id = `newUid() + ':dm:0'`. Pushes `B.creatureMessage({... species, name, text})` into `journey.outbox`. Each grant is a new animal (granting twice gives two).
3. **Message:** `shared/js/bridge-rules.js` `B.creatureMessage` (315-326); `B.CREATURE_FIELDS` (181); `B.check` for `type:'creature'` (427-432): id pattern, `B.isGrantable(m.species)`, name length. `B.grantable()` (145) reads `TSI_DATA.bastionCreatures.grantable`; `FALLBACK_CREATURES` (143) is used only on a page without the data (the DM doc, say); a test (`tests/rules/creatures.test.js:153`) asserts it matches the data. `B.speciesHomeName` (162) **title-cases the home id** ("beast_pit" gives "Beast Pit").
4. **Bastion side:** `R.applyInbox` (rules.js:949-960) → `R.addCreatureGrant` (creature-rules.js:312) creates `{status:'waiting', home:''}`; the receipt (`bridge.done[msg.id]`, with `creatureId`) is written in the same state change; the Day Log line (`R.creatureGrantLine`) and, only when newly added, a word line plus notice (`R.creatureGrantNotice`) are raised. Shown by `tellSettled` (`tool.js:4683-4685`, title "Creatures.").
5. **Explorer feedback:** `B.statusOf` (bridge-rules.js:499-517) reads `bastionSave.creatures` to say "house it at the X" or "it lives at the Ironbow now".
6. **Bastion "fresh" skip:** a Bastion started from nothing marks earlier grants `skipped` (rules.js:872-899).

### 1.6 Housing, naming, handler, Chronicle, DM confirmations (Bastion screens)

All in `tools/bastion/tool.js`:

- creature helpers/row/profile: `creatureKindLine` (499), `creatureTip` (508, uses `R.creatureStatBlock`, a war function), `onRelease` (524), `onRenameCreature` (534), `onAssignHandler` (551), `onTemperament` (577; uses `TSI.beasthandler.profile.options` for the datalists), `onConfirmBond` (613; modal with a required scene note of at least 3 letters), `onChronicleNote` (640; DM-only tick), `onConfirmFlight` (658), `wyvernProfile` (684-718), `creatureRow` (719-748).
- Management list: `creatureList` (1460), render at 1630-1633 (compact rows, `mgmt-creature`); Beast Handler box in Management (1462, 1496).
- House order UI: `fnRow` (3348-3451; `isHousing` 3356, `isTrain` 3366, dropdown 3377, blocker lines 3409-3414, button text 3420-3421), `housingShort` (3453-3461).
- Building panel: `creatureSection(facId)` (4174-4212; room line, "Living here", "Waiting for a home", "Coming later"); added to the panel at 3847. Test-id → tile opener mapping for tooltips: 5638-5645.
- Demolish note: `R.creatureDemolishNote` used at 4565-4566.
- Receipts list ("Changes from the Explorer" in the Clan Influence panel, which is being removed): 918-944 (`R.creatureReceiptHead`).

Existing rules to preserve: first handler assignment keeps the bond; a change needs a reason (≥3 letters), is refused while a programme is running, keeps `handlerHistory` (last 20), resets bond to 0 unless the DM ticks "credit the old bond", clears `bond.ready`, writes a public Chronicle line; the reason stays visible to players (Harry, 21 Oct 2026, beast-handler-proposal §10).

### 1.7 The day clock, and how the Bastion catches up days

The Explorer is the only clock. `R.makeCamp` (`tools/explorer/rules.js:736-793`) is the **only** thing that raises `state.travel.day` (line 753, by exactly 1). `R.resetTravel` (798) sets it back to 1. There is no "rest N days" command, and the `loseDay` event effect only sets `travel.dayLost` (miles), not the day. So "several days at once" only ever arises from **the Bastion being closed while the Explorer made camp several times**, or from importing/restoring a save.

The Bastion follows it (`tools/bastion/tool.js`):

- `checkClock` (4713-4748), every 2 seconds (4797) and on tab focus (4798): reads `tsi.explorer.save` fresh, `R.clockAction(state, explorerDay)` (rules.js:3295): `anchor` (first read: `R.anchor`, shifts everything, passes nothing), `shift` (Explorer day went back: `R.shiftDays(state, by)`, passes nothing), `pass` (calls `onAdvance` → `passDays`), `none`.
- `passDays` (4802-4831) loops: if no day in progress and `explorerDay > state.day`, `R.startDay(state, data)` → `settleInbox()` → `done()` (a save) → `runDay()`; repeats for each missed day, then shows "The Ironbow sends word..." once (`showWord`, 4888).
- `R.startDay` (rules.js:3237-3257): `s.day += 1`; sets `s.dayInProgress = {day, stage:'trade', skipped:[], attackRolled:false, news:[]}`; runs `tickRecovery/tickWars/tickRepairs`; **echoes any Day Log lines those added into `R.addWord`** (3243-3247, loop over `s.log` entries added since `before`); completes construction; ticks diplomacy.
- `runDay` (4834-4884): stage `trade` (routes, voyages, parcels, `tickTraining` at 4856, regiments; then `R.finishRoutes` and `save()`), stage `orders` (due orders), war roll, `R.finishDay`, `done()`.
- A day left half-way (window closed) resumes from `s.dayInProgress.stage`.
- Exactly-once today: the day number and its start-of-day ticks are in one in-memory change saved by the next `done()`; per-stage work is guarded by the stage flag (`R.finishRoutes` moves it in the same write as `save()`); `tickTraining` additionally uses `o.pausedOn` (an absolute day, **not shifted** by `shiftDays`, a small latent flaw not in my scope).
- `R.shiftDays` (3309) moves every dated field when the Explorer day goes back, so what was due in 4 days is still due in 4.
- The Bastion is a single-window tool (`single: true` via `shared/js/toollock.js`), so two windows cannot both count.
- Documented in `docs/BASTION-OVERHAUL.md` lines 16, 24, 71, 80, 96, 299; tested in `tests/e2e/bastion-days.test.js`.

### 1.8 Notifications ("The Ironbow sends word...")

- Inside a day being passed: `R.addWord(s, line)` (rules.js:89) appends to `s.dayInProgress.news` (only works while a day is in progress); `R.finishDay` copies to `s.word`; `showWord()` pops it once and clears it.
- Outside a day (the DM is clicking): `notice(text, {type,title,id,timeout})` toasts, e.g. `tellSettled` (tool.js:4671-4691).
- The Explorer's Make Camp shows what the Bastion has **coming** (`TSI.campaign.ironbowNews`, `shared/js/campaign-rules.js:169`, from `C.bastionComing` 77-163, which reads the raw saved Bastion: orders by `dueDay`, builds by `readyDay`, repairs, recovery, routes...). The DM doc's "Next Word From The Ironbow" uses the same list (`C.summary` 269-273). House orders already appear there as "Griffin Tower: House a Griffin (Swiftwing) is complete." (line 98-101).

### 1.9 Everything the Beast Handler reads and writes

**`tools/beasthandler/projection.js`** (read-only; builds the player's snapshot, `P.KIND='tsi.beasthandler.snapshot'`, `P.VERSION=1`):
- via `R()` = `TSI.bastion.rules`: `creaturesData(data).species`, `speciesHome`, `facility`, `speciesName`, `builtFacilityIds`, `housedAt`, `trainingOrders`, `trainingOrderFor`, `creatureRecovery` (war), `devView`, `creatureName`, `handlerName`, `bondName`, `getFacilityLevel`, `underRepair`, `orderDays`, `daysText`, `trainingBlocker`, `isPrivateNote`, `dayLabel`, `beastCampaignId`, `beastReceiptsFor`.
- `P.homes(data)` (70) is **one entry per species**; with a shared home this returns the same facility five times. `P.build` (242-285) loops over homes, so it would emit five copies of the Pit unless regrouped.
- `pendingAt` (84) and `ordersFor` (143-182): the building lock and available orders, **delete**. `trainingOf` (195), `viewRev` (206, includes `d.training`, `d.orders`), `detailOf` (211-237: `facility`, `handler`, `bond{level,name,max}`, `training`, `profile{regional,dominant,attachment,trigger}`, `chronicle` (private notes removed, ids renumbered), `orders`, `artKey`), `P.check` (288, version gate).
- Snapshot top level: `kind, version, campaign, asOfDay, asOfLabel, handler{id,name,hasCreatures}, receipts, facilities[], creatures{}`.

**`tools/beasthandler/bastion-link.js`** (Bastion-side authority; exactly-once receipts in `s.beast.done`, floor, 1000 max):
- `TYPES = ['profile.set','order.request']` (57); `R.cleanBeast` (66); registry/pairing/revoke (124-169); `beastReceiptsFor` (174, uses `pendingOrders`, creature Chronicle `link`); `R.setProfile` (214, writes `development.temperament`, `.regional`, `.profileLog`); `R.beastProcess` (249): refusal ladder; **creature must be `housed` in the species' home and the building standing (278-281)**; `profile.set` via `Pf.check` (285-293); `order.request` via `R.trainingBlocker` + `R.issueOrder` (295-317); `beastProcessQueue` (322), `beastProcessCode` (337), `beastSnapshotCode` (351, signs a snapshot with the handler's secret and cuts the Chronicle to 40).
- Bastion window polls the laptop queue every 2 s: `checkBeast` (`tool.js:4784-4796`).

**`tools/beasthandler/dm-panel.js`** (Management box): lists handlers (`R.beastRegistry`), pairing / snapshot / paste-request codes, accept switch, recent requests. Text at line 153 ("Give a beast a handler in its building's panel...") and 156 ("...a free training order") needs rewording.

**`tools/beasthandler/model.js`**: `bondPills` (27, pill `state` is `done|current|todo`, no fill), `regionalInfo` (42, strips a trailing/leading species word from `SPECIES_WORDS = ['direwolf','wolf','wyvern','griffin']` at line 41; **must gain `buckbear`, `fellcat`**), `artFor` (61), `homeMessage` (69-75, names the three buildings), `confirmLines` (87, orders), `requestRows` (162), `waitingOrderAt` (186), `cleanQueue` (196, types check at 202).

**`tools/beasthandler/view.js`**: tabs Profile / Orders / Chronicle (`nav` 267); `renderMain` (287: portrait, bond bar, training line, kind line "Wyvern · Wyvern Roost, Level 2"); `renderOrders` (447) and `renderConfirm` (494) to delete; `renderProfileEdit` (357, lets the player type/roll everything); `hero` (90).
**`intro.js`**: the three-panel first meeting (subspecies by typing/tapping chips/rolling, then personality), `Pf.suggestOne` regional = an even pick (`profile-rules.js:70-76`).
**`profile-rules.js`**: `Pf.suggest`, `suggestOne`, `options`, `check`, `changed`; `Pf.LABELS`.
**Data:** `data/profile-tables.js` (d12 shared `dominant`; `species.wyvern|griffin|dire_wolf` each with `attachment` d8, `trigger` d8, `regional[5]`; `beastPlayerOrders` at 166-170), `data/art-map.js` (variants by regional id; `default:{src:''}`).
**Hosts:** `tool.js` (laptop, polls Bastion every 3 s, `data` object at line 47) and `phone.js` (offline code swap; loads only the companion's files, **not** the Bastion's rules; it uses `projection.js` only for `P.check` / `handlerKey`).
**Registration:** `shared/data/tools.js` 183-215 (file lists; description string at 189 names "wyvern, griffin or dire wolf"); `beasthandler.html` script tags 28-40.

### 1.10 Elara's wyvern

- Unique creature `elara_wyvern` (creatures-data.js:96-106). Housed by the Roost's `house_elara_wyvern` order (3 days, `housesCreature`), **once ever** (`housingBlocker` 248-257, `completeHousing` 282-294).
- Created with `R.newDevelopment({id:'elara_wyvern'})`: handler `elara`, **Bond 1**, Chronicle `ch-credit`: "Existing relationship credited; Bond 1 per campaign decision." Also credited on load for a housed Elara's wyvern with no development (`cleanCreatures` 774).
- Her name is `''` until Harry gives one (data `unique.elara_wyvern.name`); display "Elara's wyvern"; renameable by the DM (BAS-97).
- She is the wyvern that makes the Roost's room "one more than its level" (base +1).

### 1.11 Tests and docs that mention all of this

**Rules tests** (`tests/rules/`, run on `tests/rules.html`): `creatures.test.js` (980 lines, 133 building-id mentions; test list at lines 131, 153, 167-282, 284-480, 487-670, 687-850, 853-980), `wyvern-bonding.test.js` (426), `beast-bonding.test.js` (225), `beasthandler-projection.test.js` (451; 31 mentions), `beasthandler-link.test.js` (597), `beasthandler-model.test.js` (207), `beasthandler-tables.test.js` (106; asserts 5 varieties per kind), `beasthandler-profile.test.js` (95), `beasthandler-codes.test.js` (73), small references in `bastion.test.js:77`, `session-safety.test.js:51`, `bridge.test.js`, `diplomacy.test.js`, `shrines-explorer.test.js`.
**e2e** (`tests/e2e/`): `creatures.test.js` (846), `wyvern-bonding.test.js` (212), `beast-bonding.test.js` (93), `beasthandler.test.js` (301), `beasthandler-write.test.js` (316), `beasthandler-meet.test.js` (841), `beasthandler-phone.test.js` (419), `bastion-screen.test.js:317-321`, `war-room.test.js:274`, `bridge.test.js`, `phase5/6/7/9`, `reinforcements`, `shrines`. Descriptions in `tests/e2e/README.md` lines 44-47 and 64-67.
**Fixtures:** `tests/fixtures/bastion-pr7/8a/8b-sample.json` have the buildings but **no creature records**, so a creature migration test needs a new fixture.
**Docs:** `docs/KNOWN_ISSUES.md` (EXP-42/43, SUI-34, BAS-90/91/93/97, SUI-41, SUI-48/49/50/51/52, BH-01 to BH-05), `docs/specs/beast-handler-proposal.md` (decisions D1-D9, §8, §10, §11), `docs/specs/griffin-dire-wolf-development-proposal.md` (superseded), `docs/PHONE-PAGE.md` (file list line 61-74 needs `assets/buckbear/`, `assets/fellcat/`), `docs/PROGRESS.md` (11-39, 94, 950), `docs/BASTION-EXPLORER-REFERENCE.md` (874, 1878-1886), `docs/ASSETS.md` (462-482: the three new pictures are **not yet recorded**), `docs/FACILITIES-OVERHAUL-PLAN.md`, `guide.html` (237-243, 272, 293-305), `shared/data/tools.js:189`.

---

## 2. Design: how the handover maps onto it

Nothing below changes the principle that **the Bastion is the only authority** and the Beast Handler only reads a snapshot and asks.

### 2.1 One facility: the Beast Pit

New entry in `facilities-data.js` (id `beast_pit`, display name "Beast Pit", a single string so the working title is cheap to change; do **not** change the id later):

```
{ name: 'Beast Pit', id: 'beast_pit', requiredLevel: 5, singleLevel: true,
  description: 'Home to one beast of each kind: wyvern, griffin, dire wolf, buckbear and fellcat.',
  functions: [
    { id: 'house_beast', label: 'House Beast Here', days: 3, costGP: 0, costText: '0', housesSpecies: '*', options: [], notes: ... },
    { id: 'acclimatise', label: 'Acclimatise With Beast', acclimatise: true, costGP: 0, costText: '0', options: [], notes: ... }
  ] }
```

- **Build rules:** same as the old buildings (party level 5, construction slot, 21 days) by default (question Q5). A save that had any of the three keeps one slot (migration merges them).
- **Single level:** the Pit has nothing for Upgrade to unlock (capacity is fixed "until further notice"). Add a data flag (the Hall will need the same; coordinate with the Hall area) so `R.upgradeCheck` returns `{ok:false, top:true}` and the Upgrade row is hidden. Keep the cap in data (`creatures-data.js` `pit: { perKind: 1 }`) so a later phase can make it level-based without code changes.
- **House Beast Here** keeps the existing House-order machinery (an order with `days:3` whose `chosen` keeps the creature id: `fnOptions` → `housingOptions`, `issueOrder` 1918-1923). Changes: `housesSpecies:'*'` means "any waiting kind"; the dropdown also offers `Elara's wyvern` (the unique, once ever) while she is not yet at the Ironbow; label rewriting for `renameCreature` stays.
- **One-at-a-time rule:** the old "one House order per building" (`houseOrderAt`, creature-rules.js:163 and 261-265) becomes "one pending House order per **kind**". With one Pit this stops three old orders blocking each other; the cap check stops duplicates.
- **Cap per kind** (`R.pitRoom(s, data, species)`): `housed` of that kind (status `housed`) + pending House order for that kind must be `< pit.perKind (1)`. Message: "The Beast Pit houses one griffin at a time: Swiftwing lives here." A creature over the cap (old save with two griffins) is **never evicted**; it only blocks further housing of that kind (the old `over` idea, creature-rules.js:239).
- **Demolish:** refuse while any creature is housed or away ("Return and house them elsewhere first" is impossible, so effectively: the Pit stays once it has beasts). Reason: with the Roost etc. gone there is nowhere else to press Return, and away beasts would keep earning days with no way to stop. Replace `creatureDemolishNote` (used at tool.js:4565) with a blocker in `onDemolish`.
- **Under Repair:** drop any `repairs` use for the Pit if the war strip-back removes repairs.
- **Map/tile art:** `bastion-data.js` needs `facilityTileCrops.beast_pit`, `mapLabels.beast_pit`, a `map.overlays` entry. No Pit art exists (no repo file mentions a Pit). Default: reuse the Wyvern Roost overlay and its crop/label position until Harry supplies a Pit picture (Q6); keep the other two overlays in `assets/extras/`.

### 2.2 The two orders

**House Beast Here** (above).

**Acclimatise With Beast** is the only other order. Recommended implementation: an **instant action**, not a pending order, shown in the facility panel as an order row (dropdown + button "Roll to acclimatise..."):

- Dropdown = `R.acclimatiseOptions(s, data)`: every creature with `status:'housed'` in the Pit, `bond.level === 0`. Show the handler's name; a beast with **no handler** is listed disabled "needs a handler" (assign one with the existing "Assign handler..."); a beast in its lock shows "tries again Day N". A beast that passes **disappears** (bond ≥ 1).
- The roll: a dialog shows the beast, handler, the DC and the skill, and a number box for **the handler's total** (the player rolls at the table and the DM types it, the Bastion's existing pattern: `rules.js` header "rolls typed at the table are passed in"; compare the Hall's typed rolls in `completeOrder`). `R.acclimatise(s, data, id, total, now)`:
  - refuses if: not housed in a standing Pit, bond ≥ 1, no handler, `s.day < retryDay`, the Bastion is behind the Explorer or mid-day (UI guard), total not a whole number 1-60;
  - **pass** (`total >= dc`): `bond.level = 1`, `bond.ready = null`, start the first pill (`bonding.need = bondDays[2]`), public Chronicle line (cat `bond`): "Acclimatised with Elara on Day 12 (rolled 22 against DC 20)", Day Log line, and an Ironbow-word line if a day is in progress;
  - **fail:** `acclimatise.retryDay = s.day + 3` (a failure on Day 10 means Days 11 and 12 are blocked and Day 13 is allowed; "3 in-game days"), `acclimatise.tries += 1`, a **DM-only** Chronicle note ("Failed acclimatisation Day 10: rolled 14 against DC 20"), Day Log line. Per beast (not per handler, not for the whole order).
- Not an order with days (`R.orderDays` forces ≥1 and a pending order would need the "cancelled roll leaves the order due" machinery); the handover's wording ("selected from a dropdown and then rolled for"; a retry lock measured in days) reads as an immediate roll. If Harry wants a duration first, it can be made a 1-day order whose completion opens the same dialog.
- Data (`creatures-data.js`): `acclimatise: { dc: 20, skill: 'Animal Handling', retryDays: 3 }` as defaults, with an optional per-kind override (`species.<id>.acclimatiseDC`).
- Reuse for the screen: add a branch in `fnRow` (tool.js:3348): `isAcclimatise` (select from options, `issue.textContent = 'Roll to acclimatise...'`, blocker line). `R.issueOrder` must not be reachable for this fn (return `{ok:false}` with a message); the click handler calls the new dialog.

### 2.3 Away from the Ironbow and back

Buttons beside the beast's name in the Pit's "Living here" list (replace the old `wyvernProfile`/`creatureRow`):

| State | Label shown | Button | Rule function |
|---|---|---|---|
| housed, bond 0 | "At the Beast Pit. Not acclimatised yet." | none (use Acclimatise With Beast) | |
| housed, bond ≥ 1, at the Pit | "At the Beast Pit" | **"Take <name> on the road"** (proposed wording; icon: road/paw) | `R.takeOut` |
| away | **"Away from the Ironbow"**, "since Day 12 · 5 days together" | **"Return <name> to the Beast Pit"** (exact wording from the handover) | `R.returnToPit` |

- `R.takeOut(s, data, id, now)`: only if housed, bond ≥ 1, has a handler, not already away, the Pit stands, and the Bastion is **not behind the Explorer and not mid-day** (otherwise days between the Bastion's day and the Explorer's day would be credited for a trip that started "now"). Sets `bonding.away=true`, `awaySince=s.day`, `lastTick=s.day`; ensures `bonding.need` is set; Chronicle (public, short) "Taken out on the road with Elara (Day 12)"; Day Log line.
- `R.returnToPit(...)`: sets `away=false`, clears `awaySince`/`lastTick`, keeps `days` and `pill`; Chronicle "Returned to the Beast Pit on Day 19 after 7 days together"; Day Log line.
- Both idempotent: a second press returns `{ok:false, message:'already ...'}`; the screen uses `TSI.oneAtATime` (as `onConfirmBond`, tool.js:613).
- `R.assignHandler`: refused while away ("Return Stormwing to the Beast Pit first"); a new pairing resets `bonding` and, unless the old bond is credited, the beast must be acclimatised again with the new handler.
- UI gating variable: `busy = turnRunning || state.dayInProgress || (state.anchored && explorerDay !== null && explorerDay > state.day)` (`explorerDay` is the screen's variable at tool.js:4663; the "behind" test is already in `renderTurnButton`, 4694). The 2-second clock catches up, so the block is brief.
- A beast with no Pit standing (old save, no building) cannot be taken out until a Pit stands.

### 2.4 Day-by-day bonding: exact counting rules

**The tick:** `R.tickBonding(s, data, now)` called from `R.startDay` right after the day moves on and **after** the echo loop (rules.js:3247), so it adds its own Day Log line and `R.addWord` line explicitly (no double word). Per creature with `development.bonding.away === true` and `bond.level` in 1-4:

```
if (b.lastTick !== null && b.lastTick >= s.day) return;   // idempotency guard
b.lastTick = s.day; b.days += 1;                          // Bonding Days (always)
if (!bond.ready) { b.pill += 1; if (b.pill >= b.need) { bond.ready = level + 1; announce once; } }
else if (BANK) b.pill += 1;                                // days kept while a milestone waits (Q3)
```

At Bond 5 only `days` increases. At the Pit nothing increases.

Because the credit is in the same in-memory change as `s.day += 1` and the next `done()` saves both (tool.js:4820-4822), a day can never be counted without being passed, or passed without being counted.

| Scenario | What happens | Why it cannot double count or lose a day |
|---|---|---|
| **Bastion open, camp made once** | `checkClock` (≤2 s later) → one `startDay` → +1 | one call per new Explorer day |
| **Bastion closed, Explorer makes camp 5 times** | on re-opening `checkClock` sees `explorerDay - state.day = 5`, `passDays` loops 5 `startDay`s, each saved; +5 | the loop is driven by the day number; a half-done day resumes by `dayInProgress.stage` and `startDay` is not re-run |
| **Window closed mid-catch-up** | the days already passed were saved; the rest pass next time | each day is credited in the write that moves `s.day` |
| **Explorer "rests/travels several days at once"** | there is no such command today; if one is added later it still raises `travel.day` by N and the Bastion passes N days | the Bastion never reads "N", only the day number |
| **Beast returned part-way** (out Day 10, back Day 14) | `startDay` for 11, 12, 13, 14 credited (4 days = nights spent together; the take-out day is not counted, the return day is) | `returnToPit` stops further ticks; `days`, `pill` and `ready` are kept |
| **Take out and return the same day** | 0 days | no `startDay` between |
| **Taken out while the Bastion lags the Explorer** | not allowed (UI + rule) | otherwise catch-up days would be credited for a trip that had not started |
| **Reset Travel** (Explorer day back to 1) | `clockAction` → `shift`: `R.shiftDays` moves `awaySince`, `lastTick`, `acclimatise.retryDay`, `acclimatise.last.day` by the same amount; **no days credited or lost**; later camps credit normally | prototype shows the bug if `lastTick` is not shifted (Appendix D) |
| **First read of the Explorer's day** (`anchor`) | `R.anchor` calls `shiftDays`; nothing passed | same |
| **Import of an older Bastion backup while the Explorer is ahead** | the Bastion passes the extra days once, as it does for orders | the backup's own record is the baseline |
| **Same `startDay` called twice for one day** (a test, a future second call site) | the `lastTick >= s.day` guard makes the second a no-op | belt and braces |
| **Handler changed** | pairing restarts (`days`, `pill`, `ready`, `away` reset; beast must be at the Pit) | old pairing's days never leak |
| **Two Bastion windows** | prevented by the single-window lock (`toollock.js`) | |

**Not needed and not recommended:** deriving days as `s.day - awaySince`. It would also be immune to double counting, but it cannot freeze a pill while a milestone waits and cannot show a per-pill fill without extra banked fields, so a counter is clearer. The prototype uses the counter.

**Display count, if wanted ("pending days"):** the laptop Beast Handler and the DM doc could add `max(0, explorerDay - bastion.day)` to the shown Bonding Days for a closed Bastion, but milestones must only ever be raised by the Bastion passing the days. Default: show credited days only.

### 2.5 Milestone → DM notification → confirm → next pill

- When `pill >= need` and `bond.ready === null` and `level < 5`: `bond.ready = level + 1` (this is the **existing** `development.bond.ready` mechanism, kept whole by `cleanDevelopment` 699-700, and `R.confirmBond`/`onConfirmBond`/"Confirm bond milestone..." remain the DM's sign-off with the required scene note).
- **Notification, three layers:**
  1. In the day being passed: Day Log line and `R.addWord`: "Stormwing and Elara have spent 7 days together: Bond 2 (Trusting) is ready. Run a scene, then confirm it in the Beast Pit." It shows in "The Ironbow sends word..." once (`showWord`) and, if the Bastion is open at the moment, a toast via `notice()` (`tellSettled` pattern).
  2. Persistent: the Pit's tile badge (reuse `tsi-bas-tile__count`/`__over` style, tool.js:3684-3685) and the beast row's primary button "Confirm bond milestone..." (already styled `tsi-btn--primary`, tool.js:701).
  3. Optional, small and consistent with the handover's DM doc "Next Word From The Ironbow": `C.bastionComing` (campaign-rules.js:77) learns a `'bond'` line "Stormwing's Bond 2 milestone arrives" at day `ba.day + (need - pill)` for any away beast not already ready, and "Stormwing's Bond 2 is ready for your scene" if `ready` (needs the saved `bonding.need`, so no data file is required in the DM doc or Explorer; this also puts it in the Explorer's Make Camp word).
- `R.confirmBond` (creature-rules.js:685) after raising the level: `bonding.need = bondDays[level+1]` (0 at Bond 5), `pill = BANK ? max(0, pill - oldNeed) : 0`, and if the carried pill already meets the next need, `ready` is set again and the log says so (a second scene is needed; no skipping).
- Nothing lowers a bond by itself (keep). No waive.

### 2.6 New save fields (all inside `development`, so `R.cleanDevelopment` keeps them; cleaners go in `rules.js`, **not** creature-rules.js, because the Explorer loads only rules.js)

```
creature.development.bonding = {            // written only when something is set (older saves stay byte-identical)
  away: false,            // true = "Away from the Ironbow"
  awaySince: null,        // Explorer day it went out (whole number, may be <= 0 after Reset Travel)
  lastTick: null,         // last Explorer day credited (idempotency guard)
  days: 0,                // Bonding Days with this handler, all trips
  pill: 0,                // days counted toward the current pill (target = bond.level + 1)
  need: 0                 // days that pill needs, copied from data when the pill starts (0 at Bond 5 or before Bond 1)
}
creature.development.acclimatise = {        // written only after a first try
  tries: 0,
  retryDay: null,         // first Explorer day it may try again after a fail
  last: { day, total, dc, pass }            // for the Chronicle and the DM's line
}
```

- `R.cleanDevelopment` (rules.js:697): add `bonding` (clamp `days`/`pill`/`need` 0-100000; `away` only boolean true; `awaySince`/`lastTick` via `dayNum` only when away; at Bond 0 or a beast not housed force `away=false`) and `acclimatise` (retryDay `dayNum`, last as numbers/booleans). Keep key order fixed so "loading twice gives the same save" tests stay valid.
- `R.shiftDays` (rules.js:3337 block): for each creature with `development`: shift `bonding.awaySince`, `bonding.lastTick`, `acclimatise.retryDay`, `acclimatise.last.day`.
- `R.newDevelopment`: nothing new by default (fields appear when first used). Elara's wyvern: no change (Bond 1, handler elara, so she is acclimatised from the start).
- Obsolete but **kept in the save, never shown**: `development.training`, `.harness`, `.firstFlight`, Chronicle lines about training/flight. They are harmless to the cleaner and preserve history.
- No new top-level `s.*` field for bonding. One migration marker `s.migration.beastPit = { day, lines, shown }` (same shape as `migration.v3`, tool.js:5665-5670 shows it once). No new storage key, so "Back up everything" is unchanged.
- `R.CREATURE_KEYS` (748) and `cleanCreatures` (761-775): no change needed (everything is under `development`). The creature `home` becomes `'beast_pit'`.
- Snapshot-only (not saved): see 2.10.

### 2.7 New and changed rule functions (proposal; all plain functions, in `creature-rules.js` unless noted)

New: `R.pitData(data)`, `R.pitFacId`, `R.pitHoused(s,data)`, `R.pitRoom(s,data,species)`, `R.pitSummary(s,data)` (the five stalls: kind, who lives there, pending, free, over), `R.acclimatiseData(data)`, `R.acclimatiseOptions`, `R.acclimatiseBlocker`, `R.acclimatise`, `R.bondNeed(data, toLevel)`, `R.bondProgress(s,data,c)` → `{level,next,days,pill,need,fraction,ready,away,since,total}` (used by the screen, the DM doc and the snapshot), `R.takeOut`, `R.returnToPit`, `R.awayBlocker`, `R.tickBonding`, `R.refreshBondReady`, `R.migrateBeastPit` (in rules.js).
Changed: `housingBlocker`, `completeHousing`, `housingOptions`, `creatureStatus`, `assignHandler`, `confirmBond`, `nextStepLine`, `renameCreature`, `R.fnOptions` (rules.js:1780: add the acclimatise branch, remove `trains`), `R.issueOrder` (1853: remove `trains`, guard `acclimatise`), `R.completeSimpleOrder` (2611-2616), `R.startDay`, `R.shiftDays`, `R.cleanDevelopment`.
Deleted: see 1.4.

### 2.8 Screen changes (`tools/bastion/tool.js`)

- Replace `wyvernProfile` (684-718), `creatureRow` (719-748), `creatureSection` (4174-4212), `housingShort` (3453), the `isTrain` branches in `fnRow` (3366, 3377, 3404, 3409, 3420-3421), `onConfirmFlight` (658-683), `creatureTip`/`creatureWarLine` (508-519, 723) with a **`pitSection()`**: five stalls (Wyvern, Griffin, Dire Wolf, Buckbear, Fellcat), each showing the beast (name, kind, handler, location, bond line + Bond 1-5 pills with the fill, Bonding Days, buttons Rename, Assign handler, Take out / Return, Confirm bond milestone, Temperament Edit, Add a note, and the Chronicle `<details>`), plus "Waiting for a home" (creatures granted and not yet housed, with Release).
- Keep: `onRelease`, `onRenameCreature`, `onAssignHandler`, `onTemperament`, `onConfirmBond`, `onChronicleNote` (all as they are, bar wording).
- `tellSettled`/Management list/`openerFor` test-id regexes (5638-5645) need the new ids.
- The Management panel's creature list and "Beast Handler (players)" box stay (the handover does not remove Management).
- A small "pairing" entry point on a beast row once Bond ≥ 1 ("Beast Handler...") is the natural place for whatever the phone-link area builds (QR / link).

### 2.9 Adding Buckbear and Fellcat

**Bastion data (`creatures-data.js`):** add
```
buckbear: { name: 'Buckbear', plural: 'Buckbears', home: 'beast_pit' },
fellcat:  { name: 'Fellcat',  plural: 'Fellcats',  home: 'beast_pit' }
```
and set `home: 'beast_pit'` on the other three; `grantable: ['wyvern','griffin','dire_wolf','buckbear','fellcat']` (this order is the Explorer's list order).
**Explorer / link:**
- `shared/js/bridge-rules.js:143` `FALLBACK_CREATURES`: add both with `home:'beast_pit'` (the test at `tests/rules/creatures.test.js:153` enforces equality with the data).
- `tools/explorer/tool.js:1507` `homesText`: de-duplicate homes before joining; rewrite the sentence at 1514-1516 ("...until the Beast Pit houses it (House Beast Here: 3 days). The Pit keeps one beast of each kind."). Consider an optional soft warning when the Bastion's saved creatures already hold or wait for that kind (the dialog can read `tsi.bastion.state` as the harbour box does, tool.js:1567): warn, do not block.
- Article logic `/^[aeiou]/` already gives "a buckbear", "a fellcat" (tool.js:1506, journey.js:680).
- `B.check` (bridge-rules.js:427-432) accepts them automatically through `isGrantable`.
**Beast Handler tables (`data/profile-tables.js`):** add `species.buckbear` and `species.fellcat` with `regional[5]` each (Harry's text, appendix A) and **`attachment` / `trigger` d8 tables (not supplied: appendix B has clearly marked provisional drafts)**. Without those two tables `Pf.rollTable` returns null and the personality step ("Fill in all three, or roll for them", intro.js:217) can never be completed for these two kinds.
  - Add Blacktide as a **sixth** dire wolf variety (id `blacktide`); its region/appearance text was not supplied (only the picture). The `regional` list is length-driven (`profile-rules.js:70-76`), but `tests/rules/beasthandler-tables.test.js` asserts "5 each / 15 in all" and copy says "five" (`intro.js:169`, `view.js:121` use `opts.regional.length`, fine; docs/PHONE-PAGE.md/ASSETS mention fifteen).
  - `profile-tables.js` fixed outcomes: add `fixedRegional: 'bloodcrest' | 'dawnmantle' | 'blacktide' | 'broadcrown' | 'lichenback'` per kind, read by `Pf.suggestOne(…,'regional')` (so the "roll" can still look like a roll: the UI should shuffle through names and land on it; it should not print a roll number, because the same kind would always print the same number, e.g. Bloodcrest is entry 4 of the wyvern list).
  - Authority: `R.beastProcess` / `Pf.check` should refuse a player `profile.set` whose `regional` is not the kind's fixed variety, whose personality lines are not entries of the tables, or that changes a profile already initiated; the DM still edits freely through `onTemperament`. (The app's rolling is on the phone, so the Bastion is where "you get what you are given" must be enforced.)
  - `SPECIES_WORDS` (model.js:41): add `'buckbear'`, `'fellcat'`.
  - `Pf.LABELS`, `M.title`, `M.speciesNoun` need no change.
**Art (`data/art-map.js`):** add
```
buckbear: { label:'Buckbear', alt:'A buckbear', default:{src:''}, variants:{ broadcrown:{src:'buckbear/broadcrown.webp'} } },
fellcat:  { label:'Fellcat',  alt:'A fellcat',  default:{src:''}, variants:{ lichenback:{src:'fellcat/lichenback.webp'} } }
```
and `dire_wolf.variants.blacktide: { src:'dire-wolf/blacktide.webp' }`. The three files already exist (commit `76c1276`: `tools/beasthandler/assets/buckbear/broadcrown.webp` 387,954 B, `dire-wolf/blacktide.webp` 371,334 B, `fellcat/lichenback.webp` 388,174 B). The other nine varieties have no picture yet: they fall through to the honest empty frame (`hero`, view.js:90-124), which the hero/about copy already handles ("There is no painted picture for ..."). `docs/ASSETS.md` does not list the three files yet; the phone file list (`docs/PHONE-PAGE.md:72`) must add `assets/buckbear/` and `assets/fellcat/`. `M.regionalInfo` shows `info.area + ': ' + info.where + '.'` (view.js:345, intro.js:167): make it skip a blank `area`/`where` (needed for Blacktide until Harry supplies them).
**Registry text:** `shared/data/tools.js:189` ("See your wyvern, griffin or dire wolf") → list all five; `model.js:71` `homeMessage` → "No beast has been acclimatised yet..." ; `dm-panel.js:153, 156` wording.

### 2.10 Beast Handler projection contract (snapshot v2), bonding and acclimatisation

- `P.VERSION = 2`. Old phone snapshots fail `P.check` ("different version") and are dropped by `phone.js usable()`; pairing codes (campaign id + handler + secret) stay valid, so players only need a fresh snapshot.
- `P.build` returns **one** facility, the Beast Pit (id, name, level 1), whose `creatures[]` lists every housed beast of every kind (`species` already on each row); no per-species duplicates (`P.homes` becomes "the Pit + its kinds").
- A beast is **`mine` / detailed only when `bond.level >= 1`** (acclimatised): "Upon passing acclimatisation, this is when the Beast Handler App ... becomes available". An un-acclimatised beast appears in the directory as "awaiting acclimatisation" (name, kind, handler) and the handler sees the "no beasts ready yet" message (`M.homeMessage`).
- Detail gains `location: 'pit'|'away'`, and `bonding`:
```
bonding: { away, awaySince, awaySinceLabel, days,                 // "Bonding Days"
           pill: { n: level+1 or null, days, need, fraction, full }, // the filling pill
           ready: level|null }                                       // pill full, waiting for the DM
```
  Pills 1..level are full; pill `level+1` fills by `fraction`; later pills empty. `M.bondPills` (model.js:27) needs a `fill` per pill (the current `state` of `current` for `n===level` can stay as the highlight).
- Remove from detail: `facility`, `training`, `orders`; from the top level: `receipts` for `order.request` (keep for `profile.set`); `viewRev` input (206) drops `d.training`/`d.orders`.
- `R.beastProcess` (bastion-link.js:249): refuse `order.request` with a plain message but still write a receipt (so a queued or phone request never repeats); replace the "housed in the species' home" test (278-281) with "housed in the standing Pit and acclimatised (bond ≥ 1)"; delete `P.isPlayerOrder`/`beastPlayerOrders` (profile-tables.js:160-170) and `R.beastReceiptsFor`'s order states; keep `TYPES` for cleaning old receipts (`cleanBeast` 88).
- `P.handlers`/`R.beastRegistry` keep working (count acclimatised beasts per handler).
- **What the live link needs from the Bastion** (for the phone-link area; I do not design the transport): the snapshot is a pure function (`P.build`), so any transport (code swap, QR, relay) ships the same JSON. Publish points: after each `startDay`/`tickBonding` (the day count changed), after take out / return, acclimatise, confirm bond, handler change, `profile.set`. `snap.madeAt` is compared by the phone (phone.js:135) so a relay must keep it monotonic. **Days only advance while the Bastion window is open**, so a relay can only be as fresh as the last time the DM's Bastion ran; nothing on a server can count Explorer days by itself.

### 2.11 Migration of saved creatures and buildings (`R.migrateBeastPit(raw, data)`)

Idempotent, version-free, run on the **raw** save inside `R.fromSave` (before `normalizeBuiltExtras`/`tidyPlots`, i.e. next to the `migrateToV3` call, rules.js:353), modelled on `migrateToV3` (227-328). A save with none of the old ids is returned untouched (so a second run, an Import, and the Beast Handler laptop's `R.fromSave` copy are harmless). Adds report lines to `s.migration.beastPit` (shown once with `notice()`; "the Bastion as it was is kept as a set-aside copy" is the existing quarantine pattern, tool.js:88-92).

1. **Buildings.** Slots in `builtExtras` (and `builtPlots`) with `facId` in `{wyvern_roost, griffin_tower, dire_wolf_den}` become one `beast_pit` entry: keep the first `built` one, else the earliest-ready `building` one; free the other slots (reuse the "two halves of one merge" logic, rules.js:256-275). `facilityLevels`, `repairs`, `research` for the three ids are deleted; `facilityLevels.beast_pit = 1`.
2. **Creature homes.** Every creature with `status:'housed'` gets `home:'beast_pit'`. No Pit standing but creatures housed (a demolished building): keep them housed (as the old Demolish rule did); the screen says the Pit must stand before they can go out.
3. **Pending orders.**
   - House orders (`house_wyvern`, `house_griffin`, `house_dire_wolf`, `house_elara_wyvern`): moved to `facId:'beast_pit'`, `fnId:'house_beast'`, id/`dueDay`/`issuedDay`/`chosen` kept, `label`/`optionLabel` rewritten ("Beast Pit: House Beast Here (Swiftwing)"). Up to three can run side by side.
   - Training orders (`chosen.trainCreatureId`) and Upgrade orders at the three ids: **cancelled**; a paid training order (only the 150 gp harness) is **refunded** to `treasuryGP` (the facility is going away by Harry's own decision; the usual "Cancel gives nothing back" rule does not fit). Listed in the report.
4. **Creature records.** Left as they are, except: nothing is credited or removed. Bond levels stay; **bond ≥ 1 counts as acclimatised** (including Elara's wyvern and any beast whose old Safe Acclimatisation was confirmed); bond 0 beasts must now pass the roll. A leftover `bond.ready` (e.g. an old programme's milestone not yet confirmed) stays and the DM can still confirm it. `training`, `harness`, `firstFlight` stay in the save, hidden. No `bonding` is created (every beast starts at the Pit; fields appear when first used).
5. **Over the cap.** Two or more of one kind housed: all stay; the report line says which kind is over and that no more of that kind can be housed.
6. **Beast Handler record (`s.beast`).** Unchanged (campaign id, paired handlers, receipts). Old `order.request` receipts stay as history.
7. **Explorer bridge receipts** for earlier grants are untouched, so no grant can come back.
8. `migration.beastPit` is the one-off marker (and report), not a version gate.

Fixtures/tests: build a new fixture `tests/fixtures/bastion-pit-before.json` with the three buildings built, a housed Elara's wyvern (Bond 1), a griffin at Bond 2 with `training` done, a griffin in a pending Keeper's Routine order, a harness order (150 gp pending), a House Beast order for a waiting dire wolf, a waiting wyvern; assert every line above and "loading twice gives the same save".

### 2.12 Tests and docs to change

**Delete or fold into the new suite:** `tests/rules/wyvern-bonding.test.js`, `beast-bonding.test.js` (keep the Chronicle DM-only and development-record save/load assertions), most of `creatures.test.js` (keep: grant message/check/receipts 284-480, release, rename, clean/save 853-935, Reset Travel 902); `tests/e2e/wyvern-bonding.test.js`, `beast-bonding.test.js`, most of `creatures.test.js`.
**Rewrite:** `beasthandler-projection` (+ leak test: no un-acclimatised beast detail), `-link` (profile.set rules, refused `order.request`, acclimatised gate), `-model` (pills with fill), `-tables` (6 dire wolf, 5 buckbear, 5 fellcat, fixed varieties, provisional flags), e2e `beasthandler*.test.js` (meeting without chips), `bastion-screen.test.js:317`, `war-room.test.js:274`.
**New:** `tests/rules/beast-pit.test.js` (cap per kind, Elara once, House Beast Here, acclimatise pass/fail/lock/shift, take out/return, tick scenarios of 2.4, confirm + carry-over, assign-handler rules, cleaner keeps/repairs fields, shiftDays, migration) and `tests/e2e/beast-pit.test.js` (two-window: Explorer makes camp N times with the Bastion closed, then open: days credited once; Reset Travel; reload mid-catch-up).
**Docs:** KNOWN_ISSUES new entry (deliberate change; before/after), supersede notes on SUI-48/49/50 and BH-04, `docs/specs/beast-handler-proposal.md` §12, `griffin-dire-wolf-development-proposal.md` (superseded), PHONE-PAGE, ASSETS (three pictures + folders), BASTION-EXPLORER-REFERENCE (874-ish tables, map facility list 1878-1886), PROGRESS, `guide.html` (237-243, 272, 293-305), `tests/e2e/README.md` (44-47, 64-67).

---

## 3. Contradictions, ambiguities and conflicts with existing behaviour or CLAUDE.md

1. **"Handler rolls" vs who rolls.** The handover says "handlers must complete a strict, difficult DC roll" but not the skill, the DC, or whether the app rolls. The Bastion cannot know a player's modifier, so a typed total is the only workable form (Q1).
2. **"X amount of days" is never given** (Q2), and what happens to days that pass while a milestone waits is unstated (Q3).
3. **Elara's wyvern vs "1 of each type".** She is a wyvern; the cap would make her *the* wyvern, and any granted wyvern could not be housed beside her (today's Roost houses 2 at Level 1 precisely so both fit, creatures-data.js:113-116, Harry 19 Oct 2026). Needs a ruling (Q4).
4. **Dire Wolf "Blacktide (new)" is a sixth variety**, not a replacement, yet the existing tables, tests and copy are built around exactly five per kind; its text is missing.
5. **Initiation: "remove the ability to manually input regional varieties and personality traits"** but "Profile: this screen is already built, keep it". The Profile tab's *Edit* lets the player type or reroll everything at any time, which undoes "you get what you are given". Needs a ruling (Q9).
6. **The Beast Handler "visual aid only, no orders panel"** deletes `order.request`, the building lock (BH-04), `beastPlayerOrders` (decision D5) and the whole Orders tab, all approved by Harry on 21 October 2026. The handover overrides them; the earlier docs (`beast-handler-proposal.md` §8, §10) should be marked superseded.
7. **The removed Safe Acclimatisation was a 5-day free order confirmed by the DM after a scene; the new one is a roll that gives Bond 1 immediately with no scene.** Bond 1 therefore no longer has a DM narrative sign-off (the handover says "the bond moves to Level 1" on a pass). I have followed the handover.
8. **Riding preparation (harness 150 gp, first flight, Rider's Pact, Bond 5 gate) disappears**, though SUI-49/50 were approved days ago. Bond 5 now comes only from days. The handover states "the only other order should be Acclimatise With Beast", so I have treated this as intended, but it is worth stating to Harry in plain words.
9. **Defend Bastion bonuses (+1 Resolve/Defence/Attack) and creature war stats** lose their purpose if the War Table goes (the handover removes War Council "and all associated functionality - no more war games VTT"). This area assumes the war strip-back happens; if the War Table stayed, creatures would still defend and `species.war` would have to stay and gain stats for buckbear/fellcat.
10. **The Day Log panel is removed** but my notifications use `R.log` too. Harmless if `s.log` stays in the save; if the war/area owners delete `R.log`, the notifications must use only `R.addWord` + `notice`.
11. **CLAUDE.md ground rule 2 (no online services except Knightly Treasures)** vs the handover's request to consider Firebase/Supabase for the phone link. Not decided here; this area only guarantees the Bastion has no network calls and that the snapshot is transport-neutral (2.10). The Bastion would never call the relay; whichever component publishes must be loaded outside `rules.js`.
12. **The handover says the Pit "working title".** The id `beast_pit` ends up in saves and tests; the label can change cheaply, but `B.speciesHomeName` (bridge-rules.js:162) title-cases the id instead of reading the facility's name, so a renamed label would disagree with the Explorer's wording. Fix when renaming.
13. **Chronicle category labels** (`model.js:79` `CATS`: training, bond, handler, flight, note) lack a label for the new "taken out / returned" lines (`pit` or `travel`).
14. **`R.isOldSave` and `inDaysSave` version tests** (see headline 6) are a cross-area risk if the strip-back changes `s.v`.
15. **Lore link in Harry's note:** "Rootbound Buckbear could be read as a Broadcrown corrupted by the Veinwood. Only adopt that if you want it." Not adopted; the Heartwood Ritual (`tools/ritual/`, art `img/buckbear.png`) is untouched.

---

## 4. Questions for Harry (each has a proposed default)

See the structured output for the short list. In full:

- **Q1 Acclimatisation roll:** which skill, what DC, who rolls, instant or after some days. *Default:* the handler rolls Animal Handling at the table, the DM types the total, **DC 20** for every kind (one number in `creatures-data.js`, easy to change per kind), immediate, a pass gives Bond 1 straight away, a fail locks that beast until 3 days later.
- **Q2 Days per bond level.** *Default:* Bond 2 after 7 days together, Bond 3 after 10 more, Bond 4 after 14 more, Bond 5 after 21 more (52 days in all; one table in the data).
- **Q3 Days that pass while a milestone waits for your scene.** *Default:* they are kept and count toward the next pill (never lost); the alternative is that the pill stays full and the next one starts empty after you confirm.
- **Q4 Elara's wyvern and "one of each kind".** *Default:* she is the Beast Pit's one wyvern (she keeps Bond 1 and handler Elara), offered first in House Beast Here; a granted wyvern waits until there is room (nothing is ever sent away); a save that already has two of one kind keeps both and only blocks a third.
- **Q5 How the Pit is built.** *Default:* like the old three (party level 5, a construction slot, 21 days), one level only (no Upgrade), your existing slot kept.
- **Q6 Pit art.** *Default:* reuse the Wyvern Roost painting and map spot until you supply a Pit picture.
- **Q7 Blacktide.** *Default:* a sixth Dire Wolf variety (the other five stay); appearance drafted from your picture only, region left blank for you to fill.
- **Q8 Buckbear and Fellcat d8 tables.** *Default:* I draft provisional ones (Appendix B) marked as drafts for you to edit.
- **Q9 Profile after the first meeting.** *Default:* players can see it but not edit or reroll it; you change it from the Bastion.

---

## Appendix A. Draft variety entries (Harry's wording, UK English; for `profile-tables.js`)

Format `{ id, name, area, where, appearance }`. `area` = province/isle; clan in brackets in `where`. Camouflage kept inside `appearance`.

**Buckbear** (`fixedRegional: 'broadcrown'`)
- `broadcrown` Broadcrown: area "Northern Province"; where "The old-growth forests around Nightwood (Clan Blackstone), among moss, ferns and forest streams"; appearance "The largest variety. A shaggy, dark-brown coat with tawny-gold tips, heaviest in a ruff around the neck and shoulders; tall, wide pale antlers with many upturned points, forming a crown; amber eyes and long, pale claws."
- `shovelhorn` Shovelhorn: "North Isle"; "The frozen country around Coldpass (Clan Karr)"; "Stocky and heavily built, with a thick double coat from cream to smoke-grey, small rounded ears, and broad, flat antlers like a moose's, which it uses to scrape snow off food."
- `cragbuck` Cragbuck: "Midland Province"; "The slopes of The Fangs (Clan Bacca)"; "Lean and long-legged, with a slate-grey coat with silver flecks and short antlers with few points, swept back close to the skull so they do not catch on rock. A sure-footed climber."
- `fenwallow` Fenwallow: "Eastern Province"; "The marshes and waterways (Clan Slade)"; "Low and heavy, with an oily, dark-brown coat that sheds water and is usually caked in mud, wide splayed paws for bog ground, and short, forward-curving antlers often hung with reeds. A strong swimmer."
- `saltcoat` Saltcoat: "East Isle"; "The coast and forest edges (Clan Rowthorn)"; "The smallest variety, with a russet-red coat bleached paler at the tips by salt and sun and narrow antlers with a slight forward hook. Forages rock pools and the tideline for shellfish and fish."

**Fellcat** (`fixedRegional: 'lichenback'`)
- `mistveil` Mistveil: "North Isle"; "The coast and fog banks of Bleaker's Bay (Clan Karr)"; "A thick silver coat with faint smoke-grey rosettes, tufted ears, oversized paws and pale grey-green eyes; fur that holds a damp sheen from the sea air. Camouflage: sea mist."
- `whiteout` Whiteout: area "Icepoint"; where "Icepoint"; "The palest and heaviest variety: an almost pure white coat with barely visible markings, the deepest fur with fur-covered paw pads, a long thick tail it wraps over its face when resting, and ice-blue eyes. Camouflage: snow." (Harry gave only "Region: Icepoint": use it for `where` and leave `area` blank or "Icepoint".)
- `lichenback` Lichenback: "Northern highlands" (no province given); "The northern highlands"; "Leaner, built for rock rather than snow, with a grey coat mottled grey-green like lichen that turns frost-white in winter, the longest ear tufts, a shorter tail and hard, scarred paw pads. Camouflage: frost-covered stone."
- `tawnyfell` Tawnyfell: "Midland Province"; "The scree and lower slopes of The Fangs (Clan Bacca)"; "A shorter coat, smoke-brown to tawny-grey, and longer legs; hunts at dusk below the snowline. Camouflage: scree and twilight."
- `smokecoat` Smokecoat: "Western Province"; "The high gorges of the Shadow Mountains (Clan Farmer)"; "The smallest and rarest variety, with a charcoal-grey coat with near-black rosettes; hunts at night. Camouflage: darkness and shadowed rock."

**Dire Wolf** `blacktide` Blacktide: area/where blank until Harry supplies them. Appearance drafted from the picture only (a black-and-tan wolf on a storm-lashed rocky shore beside a wrecked ship, under a red banner bearing a white tree): "A black-and-tan coat, wet and storm-lashed, found on rocky shores among wrecks." (flag as provisional).

## Appendix B. Provisional d8 tables for Buckbear and Fellcat (NOT supplied by Harry: clearly marked drafts in the style of the existing tables)

**Buckbear, Attachment Cue (d8):** 1 Low, huffing greeting; 2 Lowers its antlers; 3 Leans its weight against handler; 4 Nuzzles handler's shoulder; 5 Shields handler with its bulk; 6 Rubs its antlers on a nearby post; 7 Recognises handler's footsteps; 8 Follows at handler's heel unprompted.
**Buckbear, Instinctive Trigger (d8):** 1 Sudden loud crashes; 2 Stranger approaching its food; 3 Open flame; 4 Rough handling of its antlers; 5 Rival buckbear nearby; 6 Cramped stalls; 7 Barking hounds; 8 Strange predator scents.
**Fellcat, Attachment Cue (d8):** 1 Slow, deliberate blink; 2 Soft rumbling purr; 3 Head-butts handler's hand; 4 Curls its tail around handler's arm; 5 Settles to rest within reach; 6 Leaves a small kill at handler's feet; 7 Flicks its ear tufts toward handler's voice; 8 Pads silently alongside handler.
**Fellcat, Instinctive Trigger (d8):** 1 Sudden bright light; 2 Being cornered; 3 Unfamiliar hounds; 4 Loud clanging; 5 Being stared down; 6 Hands near its tail; 7 Strangers moving behind it; 8 Fast movement at the edge of its sight.
(Keep `provisional: true` in the data and a comment so they are easy to find and replace.)

## Appendix C. File-by-file impact summary for this area

`tools/bastion/data/creatures-data.js` (species, grantable, pit cap, bonding/acclimatise numbers; delete room/development); `tools/bastion/data/facilities-data.js` (delete three buildings 1891-2433, add `beast_pit`, header comment 62-69); `tools/bastion/data/bastion-data.js` (38-40, 84-86, 121-122, 169-171, new entries, optional `retiredFacilities`-style map); `tools/bastion/rules.js` (cleaners, shiftDays, startDay, fnOptions, issueOrder, completeSimpleOrder, fromSave migration hook, migration function, upgrade single-level flag); `tools/bastion/creature-rules.js` (sections in 1.4); `tools/bastion/tool.js` (2.8, plus 4565 demolish, 4683 notices, 4856 `tickTraining` call removal, 5638-5645 openers, 5665 migration notice); `tools/bastion/war-campaign-rules.js` (`creatureStatBlock` 2335 and the creature lines in `warForces` 554-563, 659-690 go with the war); `shared/js/bridge-rules.js` (143, header 41-48); `shared/js/campaign-rules.js` (52 version test, optional bond line in `bastionComing`, FACILITY_NAMES if needed); `shared/data/tools.js` (189); `tools/explorer/tool.js` (1499-1548); `tools/beasthandler/{projection,bastion-link,model,view,intro,profile-rules,dm-panel,tool}.js` and `data/{profile-tables,art-map}.js`; `beasthandler.html` (no new scripts); tests and docs per 2.12.

## Appendix D. Prototype output (scratch, not repo code)

`g-bonding-prototype.js` models take-out, nine caught-up days (a milestone fires once on the 7th), a repeated tick on the same day (ignored), a part-way return (days kept, nothing added at the Pit), confirm (next pill needs 10), a Reset Travel shift, and the freeze/bank choice:

```
take out on day 10 -> ok already
after 9 caught-up days: day 19 days 9 pill 7 ready 2   (READY fired once, on day 17)
re-tick same day -> null days 9
return -> ok days 9 pill 7;  3 days at the Pit: days 9 (unchanged)
confirm -> level 2 pill 0 need 10;  out 5 days: pill 5 / 10
shift: day 27 -> 1, days/pill kept 14 / 5, lastTick 1, awaySince -4;  next day credits exactly one
NAIVE (lastTick not shifted): days credited after reset = 0 (should be 1)
freeze -> 12 days and a late confirm: pill 0 / 10 (5 days lost);  bank -> pill 5 / 10 (kept)
```
