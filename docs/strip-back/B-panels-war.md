# Area B: the five panels to remove, and the war game

Analysis only. Nothing in the repo was changed. Checked against commit `4f1db26` (branch `claude/gallant-ramanujan-klwz70`, reset to main).
Line numbers are for that commit. "tool.js" means `tools/bastion/tool.js` (5,687 lines), "rules.js" means `tools/bastion/rules.js` (3,426 lines) unless a path is given.

Scratch experiments are in `.../scratchpad/analysis/` (`sim/` is a light copy of the code with the war scripts switched off; `run-rules.js`, `probe-bastion.js`, `probe-tool.js` are the read-only Playwright scripts). Section 7 reports what they showed.

---

## 0. The short version

1. Harry's five panels are five of the seven buttons in the Bastion's bottom bar (`tool.js` 5443-5453): **Day Log**, **Events** (left); **Clan Influence**, **Favour**, **War Council** (right). Only **Warehouse** and **Management** stay. The "Events" is the *Bastion's* d100 event panel, not the Explorer's travel/campfire events (those are untouched).
2. Four of the five are self-contained screens with little behind them. **War Council is not**: it is the front door of a whole mini-game of about 510 KB of code (`war-*.js`, `regiment-rules.js`), 56 KB of CSS (1,225 lines), 2 data files, 3 pictures, about 8,500 lines of tests and 3 whole documents (plus mentions in about 10 more). It is wired into the day engine, the save loader, the import checker, the Compendium, the creatures, the DM doc's "next word", and the tool-loading lists of both the Bastion and the Beast Handler.
3. **You cannot just stop loading the war scripts.** I tried it: the Bastion refuses to open (`R.warActionObjectives is not a function`) because `tool.js` calls war functions while it builds its screen. Explorer and Beast Handler still open fine without them. The removal is a real edit of `tool.js`, `rules.js`, `creature-rules.js`, the shared `campaign-rules.js`, `dmdoc.js` and `shared/data/tools.js`.
4. Things that must **stay** although they sit inside the panels: the three Favour bars and their rules (they move into the new Temple); each Clan's Honour/Respect and Political Capital (the Hall already shows them in "Clan Relations"); the Explorer-to-Bastion "applied once" receipts (`state.bridge`); "The Ironbow sends word" (`state.word`, `R.addWord`, `TSI.campaign.ironbowNews`); Orders pending; the DM doc's "Change A Score" (already handles Political Capital, Honour/Respect and Favour).
5. Things that are safe to delete outright: the Day Log (`state.log`), the Bastion event (`state.lastEvent`, `lastEventDay`, `events-data.js`), Favour Tokens, the "Honour Change" reset, the typed Honour/Respect box, "Support" (with Form Clan, which is another area), all war state, Under Repair (only a lost Defend Bastion ever caused it), the "At War" tags.
6. Removing the Day Log removes the only on-screen record of a few things (Section 8). The ones that matter: results of orders finished with the **Resolve** button (a Shrine prayer's roll, a craft) were written only to the log; and the "refused / skipped" explanations for Explorer deliveries were shown only in Clan Influence's "Changes from the Explorer" list. Both need a small replacement (Section 8).
7. The existing tests lean on all of this: 30 rules tests outside the four war test files fail when war code and the event table go; about 60 e2e checks drive the removed panels. Section 10.
8. Needs Harry's confirmation: deleting the code that earlier plans called "protected" (Section 5.3), and what happens to any live war in his campaign save (Section 12).

---

## 1. What the handover says, and what it means in the code

Handover (page 1): "Remove the following panels from the interface: Favour of the Gods, Clan Influence, War Council, Day Log, Events. Remove all of the above panels and all of their associated functionality - no more war games VTT."

| Handover name | Bottom-bar button (`data-test`) | Panel card id / title | Built at (tool.js) | Opener |
|---|---|---|---|---|
| Favour of the Gods | `open-favour` (label "Favour", aria "Favour of the Gods") | `favour` / "Favour of the Gods" | 790-811 | `openFavour` 5421, button 5451 |
| Clan Influence | `open-influence` | `influence` / "Clan Influence" | 813-878 (+ `renderSide` 880-907, `renderBridge` 909-947) | `openInfluence` 5420, button 5450 |
| War Council | `open-war` (padlock, `is-locked`, `is-alert`) | `war` / "Banner & War Council" | 1639-1701 (+ about 750 lines more, to 2443) | `openWarPanel` 5422, `warBtn` 5427-5442 |
| Day Log | `open-log` | `log` / "Day Log" | 952-960, filled by `renderTop` 996-1006 | `openLog` 5418, button 5446 |
| Events | `open-events` | `events` / "Bastion Events" | 980-989, filled by `renderTop` 1031-1045 | `openEvents` 5419, button 5447 |

The panels are built once and kept current by `renderAll` (5545-5570: `renderSide`, `renderTop`, `renderWar`, `renderWarLock`). `ns.debug.reveal` finds a panel's button through `openerFor` (5632-5653: `logCard`, `eventCard`, `influenceCard`, `favourCard`, `warCard`, `wr-` prefix → `tile-war_room`).

Assumptions I made (no real ambiguity, but worth the PR saying so):
- "Events" = Bastion Events panel. The Explorer's own events (`tools/explorer/journey.js`, `data/journey-events.js`, "Roll an event now") are not touched. A different file with the same name, `tools/explorer/data/events-data.js` (1.1 MB, the old 601 Explorer events, already switched off and not loaded), must **not** be confused with `tools/bastion/data/events-data.js` (7.3 KB, the Bastion's 11-row d100 table).
- "No more war games VTT" = the **War Table** (`war-table.js`, the full-screen battle grid) and everything feeding it. It does **not** mean the **Combat Tracker & VTT Battlemap** tool (`tools/encounter/`), which is a separate top-level tool. Nothing in `tools/encounter/` references the war code (checked). "Fog of War" in the Explorer and the Battlemap is an unrelated feature name.
- "Diplomatic Events" at the Hall = the existing **Diplomatic Records** ("Record an event…", `diplomacy-rules.js`, `state.diplomaticRecords`). Harry's PR 9 spec (`docs/specs/hall-of-emissaries-redesign.txt` section 6) calls this the "hybrid diplomatic event system"; only the DM-authored half was ever built. The Hall panel already shows **Clan Relations** (per Clan: H&R, PC, running restrictions/privileges) and **Diplomatic Records**, which is exactly "Clan Honour/Respect, Clan Political Capital, Diplomatic Events". So that part of the handover is already how the Hall looks; the work is removing everything else from it (Area C's job).

---

## 2. Panel by panel

### 2.1 Favour of the Gods

**What it is.** Three bars (Telluria, Aurush, Pelagos), each 0-100%, a little SVG icon per god (`GOD_PATHS` 51-55, `godIcon` 779-789), a `Claim` button that appears at 100% and sets the bar back to 0 (`favourList` 791-805; Claim writes `state.favour[key] = 0` and `log('Favour Claimed', ...)` at 794-798). Hint text: "Shrine blessings add 1d20% to their god."

**State it owns.** `state.favour = { telluria, aurush, pelagos }`, each clamped 0..100 (default 126; load 374 via `numMap`).

**Who writes it.**
- `R.completeSimpleOrder` (rules.js 2626-2629): a Shrine's "Pray" option `favour_blessing` rolls `R.d(20, rand)` and calls `R.addFavourPercent` (2314-2318). This is the "Pray" the Temple keeps.
- `R.issueOrder` (1933-1948): an order with `favourCost` subtracts that % from the Shrine's god when it *starts* (Shrine Level 3-5 orders: 5%, 10%, 25%; `favourBlocker` 627-633 refuses when short; `R.shrineGod`, `R.GOD_NAMES` 624-625).
- `R.applyDmEdits` (rules.js 504, via DM doc kind `favour`, range 0-100).
- tool.js Claim button (the only way down to 0 other than spending).

**Who reads it.**
- The panel (`renderSide` 881-887).
- `R.favourBlocker`, `R.issueOrder` (gating Shrine orders, 2nd-5th level blessings, Great Rites in `state.greatRites`).
- DM doc: `TSI.campaign.summary` reads `ba.favour[reg.god]` (campaign-rules.js 286, 293) and `dmdoc.js` draws the "Favour" meter (364). The DM doc's "Change A Score" can set a god's Favour (`dmdoc-rules.js` `EDIT_KINDS.favour`).
- `rules.js saveProblem` map check (1045).
- Explorer: Shrines panel (Great Rites, `tools/explorer/tool.js`) reads `state.greatRites`, not Favour directly.
- Tests: `tests/e2e/shrines.test.js`, `phase9.test.js` (`claim-*`), `bastion-screen.test.js` (`open-favour`), `dmdoc*.test.js`, `rules/bastion.test.js`, `campaign.test.js`, `diplomacy.test.js`, `dmdoc-edits.test.js`, `commerce.test.js`.

**Verdict.** Delete the *panel*: `favourCard`, `openFavour`, the `panelButton('favour')`, the Claim button and `'Favour Claimed'` log line, `.tsi-bas-favour`. **Keep and move into the Temple**: `state.favour`, `R.addFavourPercent`, the `favour_blessing` Pray rule, `GOD_PATHS`/`godIcon`, `B.gods` (bastion-data.js 353-357), the bar CSS (`.tsi-bas-meter`, `.tsi-bas-bar-fill`, `.tsi-bas-god-icon*`, bastion.css around 752-800), the DM doc meter and score edit.

**Contradiction to flag to Area (Temple).** The handover's Receive Blessing "spends that full bar ... then your favour bar resets". Today's blessing orders spend only part of it (Voyage Blessing 0%, Aquatic Charm 5%, Bless Commercial Shipment 10%, Great Rite 25%: `facilities-data.js` Pelagos block, 2691-2811) and `Claim` was a bare reset with no benefit. The Temple analyst needs to decide whether `favourCost` is replaced by "full bar" (and what happens to `greatRites`, `R.favourBlocker`, `protectionCharge` and the Shrine tests).

### 2.2 Clan Influence

**What it is.** One pop-up with four things:
1. Per Clan (7 rows, `influenceList` 825-861): a Political Capital bar (-100..+100) with an "Honour Change" button at +-100; a typed **Honour/Respect** box (-5..+5); a computed **Support** number (`R.supportForClanKey`, rules.js 2998-3001, = (PC+100)/2 + 4*HR).
2. **Changes from the Explorer** (`bridgeList`, `renderBridge` 910-947): the newest 10 receipts from `state.bridge.done`: Honour/Respect changes, Port Charters, parcel pickups, creature grants, Great Rite handovers; "applied / skipped / refused" with the reason (`r.why`).
3. **Favour Tokens** counter (`tokensPill`, `state.diplomacy.tokens`).
4. Help text.

**State it shows / owns.**
- `state.politicalCapital[clan]` (-100..100), `state.honourRespectByClan[clan]` (-5..5): **keep** (below).
- `state.bridge = { fresh, done: { messageId: { r, day, at, clan, hr, was, now, text, why, type?, ... } } }`: **keep** (it is the once-only guard for Explorer messages; losing a receipt is "the one way a change could count twice", rules.js 526-530).
- `state.diplomacy.tokens`: written only by Host Delegation (rules.js 2489), displayed only here, never spent anywhere. **Dead; delete** (and Host Delegation goes with the Hall's actions).
- `state.trustedClientsByClan`: not shown here (archived Brigade); harmless.

**Who writes Political Capital / Honour/Respect.**
- Explorer standing outcomes: 8 event moments send +-1 H&R through `TSI.bridge` messages; applied by `R.applyInbox` (rules.js 816-991) → `R.adjustStanding` (783-790) with a receipt. Triggered by `checkClock`/`passDays`/`settleInbox` (tool.js 4666-4670, 4713-4748, 4802-4831).
- DM doc "Change A Score" (kinds `pc`, `hr`): `checkDmEdits` (tool.js 4752-4764) → `R.applyDmEdits`.
- The Clan Influence typed box (tool.js 834-851; `change`/`blur` handlers) and the "Honour Change" button (828-832: sets PC to 0, one log line "Honour Change prompted for Clan X. Political Capital reset to neutral"; **no other effect**).
- Hall actions (`R.applyEmissary`, tier `pcDelta`; `R.addPoliticalCapital`): go with the Hall's removed actions.
- Diplomatic Records: `R.confirmDipRecord` applies `hr`/`pc` consequences (diplomacy-rules.js): **stays**.
- War: `R.warPenalty` / `declare war` (H&R and PC cost) and war outcomes (`bastion-data.js` `war.outcomes` pc deltas, war-campaign-rules.js 1723): **go**.

**Who reads them.**
- Hall "Clan Relations" box (`clanRelationsBox` tool.js 2571-2589, `R.clanRelations`, diplomacy-rules.js): **stays**.
- DM doc "Where the party is" (campaign-rules.js 284-292) and its Change A Score dialog (dmdoc.js 221, 228-283).
- `R.supportForClanKey` / `R.canFormClan`: only the panel and Form Clan (Area D, party identity).
- Tests: `phase9.test.js` (`pc-*`, `honour-*`, `hr-*`, `support-*`), `bastion-screen.test.js`, `hall-records.test.js`, `phase8.test.js`; `bridge.test.js`, `commerce.test.js`, `courier.test.js`, `creatures.test.js` e2e use `[data-test=bridge-row]` / `open-influence` as the only visible proof a delivery arrived.

**Verdict.** Delete `influenceCard`, `influenceList`, `pcRows`, `trackerRows`, `tokensPill`, `bridgeList`, `renderSide` (after moving the Favour half out), `renderBridge`, `R.bridgeHistory` (rules.js 995-1000), the "Honour Change" and typed H&R controls, `.tsi-bas-influence*` CSS (bastion.css 549-575, 1495-1510). Keep every number and the receipts. Reword the two notices that say "Clan Influence lists it / says why" (tool.js 4687, 4689) and the five `R.log` lines in `applyInbox` that say "Clan Influence lists them" (rules.js 885, 888, 893, 898) plus `creature-rules.js` 349.

### 2.3 War Council ("Banner & War Council")

See Section 5 for the full inventory. The panel is `warCard` (tool.js 1648-1701): War Action form (Target Clan, Objective Raid/Skirmish/Seize Outpost, Enemy force tier, "Forces to commit" grid of defenders, Lieutenants, each regiment type, each beast kind, Intelligence, Battle Value, cost line, `Queue War Action` = `onQueueWar` 1941-1957), Military Actions box (`maBox`, `renderMilitary` 2060-2091), Wars box with **Make peace** (`warsBox`, `renderWars` 2096, `onMakePeace` 2114), War Log (`state.warLog`, `openWarReport` 1922).

It is locked (padlock) until `R.warCouncilOpen(state)` (war-campaign-rules.js 482): needs a defender, a Menagerie beast or a War Room unit.

**State it owns.** `warLog`, `militaryActions`, `warMissions`, `warRecovery`, `warMissionSeq`, `wars`, `repairs`, plus `military` (rows), `defenderBeasts` (Menagerie), `defenders.{count,armed,patrolUntil}`; pending orders with `facId: 'war_council'` / `meta.kind: 'war_action'`; `tsi.bastion.ui.warNoticed`; stores `tsi.bastion.warMap`, `tsi.bastion.warTable`, `tsi.bastion.warTerrain`.

**Verdict.** Delete all of it (pending Harry's OK on Section 5.3). The pieces that need care are in Section 6.

### 2.4 Day Log

**What it is.** A list of the newest 80 entries of `state.log` (`renderTop` 996-1006: title, "Day N · timestamp", body), a "Clear log" button with an "are you sure" (954-959). `logCard` 953.

**State it owns.** `state.log` = `[{ title, body, at, day }]`, newest first, never trimmed (`R.log` rules.js 55-57; load 396; `saveProblem` list check 1041; `R.migrateToV3` writes one at 324-325).

**Who writes it.** 
- tool.js: `log()` / `logAll()` (111-112) are called about 55 times (48 `log(` + 7 `logAll(`), nearly every action: construction, orders, warehouse, defenders, identity, diplomacy, trade, creatures, save file downloaded, etc.
- rules.js: 19 `R.log(` calls (applyDmEdits 511, applyInbox 882-986 [about 14], handToParty 2079, startDay 3251, finishDay 3281, migrateToV3 324). Other files: `creature-rules.js` 2, `diplomacy-rules.js` 3, `war-campaign-rules.js` 13, `tools/beasthandler/bastion-link.js` 4 (160, 167, 232, 315).
- Plus about 40 rule functions return `{ log: [title, body] }` pairs for the screen to write (`R.issueOrder`, `R.completeSimpleOrder`, `R.settleVoyages`, `creatureGrantLine`, `confirmBond`, ...). Those return values are asserted in tests and are harmless if the screen stops writing them.

**Who reads it.**
- The panel (`renderTop`), "Clear log".
- **`R.startDay` (rules.js 3243-3247)** reads `s.log.length` and copies new log bodies into the day's news (`R.addWord`) for the war ticks (`tickRecovery`, `tickWars`, `tickRepairs`). War only. If `state.log` is removed without removing this loop, passing a day crashes.
- Wording that points at it: notices at tool.js 4761 ("The Day Log keeps it"), 4794, 5663, 5669, 5673; help texts 3069, 3096 (Warehouse "+ Add supplies", "Hand to the party"); `dmdoc.js` 257 and 280; rules.js comments 398, 462, 2060; `guide.html` 13 places (120, 195, 197, 203, 206, 214, 216, 219, 228, 230, 242, 247, 257).
- Nothing else in the code reads it: not the Explorer, not `TSI.campaign`, not the DM doc, not the Beast Handler (its `projection.js` header says in plain words it never holds the Day Log).
- Tests asserting on `state.log`: 18 e2e files and 14 rules files (`bastion.test.js` 3 mentions, `session-safety`, `creatures`, `courier`, `bridge`, `diplomacy`, `dmdoc-edits`, `beasthandler-link` lines 77-119, ...).

**Verdict.** Delete `state.log`, `R.log`, `log()`, `logAll()`, `logCard`, `logList`, `openLog`, button, `.tsi-bas-log*` CSS (bastion.css 823-840). Keep the `{ log: [...] }` *return values* of rule functions (nothing downstream needs them but tests do; they can go in a later tidy). Alternative considered and rejected: keeping a hidden `state.log` with no screen (contradicts "all associated functionality"; it also grows the save forever).

### 2.5 Events (Bastion Events)

**What it is.** `eventCard` 984: **Roll Bastion Event** (`onRollEvent` 5233-5237 → `R.rollEvent`), "The next automatic event: Day N (every 28 days)", and the last event's name, roll and description lines (`renderTop` 1031-1045).

**State it owns.** `state.lastEvent` ({ roll, name, lines, at, day }) and `state.lastEventDay` (rules.js 142, 144, 394-395, `R.shiftDays` 3315).

**Data.** `tools/bastion/data/events-data.js` (`TSI_DATA.bastionEvents`: `eventTable` 11 rows, `descriptions`), `bastion-data.js time.eventEvery: 28` (273) and the comment above it (266-267), `R.time(data).eventEvery` (rules.js 83).

**Who writes it.** `R.rollEvent` (3200-3206) from the button, and `R.finishDay` (3276-3289) automatically on Day 29, 57, 85... (`R.isEventDay` 3209, `R.nextEventDay` 3213), which also logs "Auto event (Day N)..." and adds the news line "Bastion event: X (rolled N)."

**Who reads it.**
- `shared/js/campaign-rules.js` 69 (`BASTION_EVENT_EVERY: 28`) and 158-161: `bastionComing` adds "A Bastion event is due." to the forecast. That forecast feeds **both** the DM doc's "Next word from the Ironbow" **and** the Explorer's "The Ironbow sends word…" at Make Camp. If the event goes and this line stays, the Explorer keeps announcing a Bastion event every 28 days that never comes.
- `R.finishDay` signature `(s, data, events, rand, now)`: called from `tool.js` 4880 and from tests (campaign.test.js 150; bastion.test.js 582-640; bastion-campaign.test.js 1640-1705).
- `data.events` is passed around: `tool.js` 64, `tools/beasthandler/tool.js` 47, and the `bdata` object in about 18 test files (`events: T.bastionEvents`). Removing `events-data.js` makes those `undefined`, which is fine for everything except `R.finishDay`/`rollEvent` tests.
- Docs: `BASTION-EXPLORER-REFERENCE.md` section 5.11 states "Events are text for the DM only. Nothing in them changes the Bastion's numbers." So nothing mechanical is lost.
- Tests: `phase9.test.js`, `phase5.test.js`, `bastion-screen.test.js` (`open-events`, `roll-event`), `rules/bastion.test.js` 51, 582-640, 1036-1042, 1931.

**Verdict.** Delete all of it: card, button, `onRollEvent`, `R.rollEvent`/`resolveEvent`/`isEventDay`/`nextEventDay`, the automatic block in `R.finishDay`, `lastEvent`, `lastEventDay`, `eventEvery`, `events-data.js` (and its two lines in `tools.js` 87 and 198), `BASTION_EVENT_EVERY`, the "A Bastion event is due." forecast line, `.tsi-bas-event*` CSS (bastion.css 841-849), `tests/rules.html` line 82. The Bastion event table's "Attack" row (51-55) was only text; the real attack mechanic was the war's Defend Bastion.

---

## 3. State fields: keep, delete, migrate

Bastion save is `tsi.bastion.state` (`v: 3` today). `R.fromSave` (rules.js 350-457) starts from `R.defaultState` and copies only the fields it knows, so a field removed from `fromSave` simply disappears on the next save. Precedent for keeping a safety copy: the v2→v3 migration sets the original aside with `TSI.store.quarantine` (tool.js 84-92).

| Field | Owner today | Verdict | Notes |
|---|---|---|---|
| `favour` | Favour panel / Shrines | **KEEP** | Temple bars; DM doc meter and edit |
| `greatRites` | Shrines (Explorer hands them out) | KEEP (Temple area) | uses `favourCost` |
| `politicalCapital`, `honourRespectByClan` | Clan Influence / Hall | **KEEP** | Hall "Clan Relations", DM doc, Diplomatic Records |
| `clanHonor`, `organization`, `trustedClientsByClan` | Party identity | Area D | not mine |
| `bridge` (`fresh`, `done`) | Explorer link | **KEEP** | once-only guard; display moves |
| `dmEdits` | DM doc edits | **KEEP** | |
| `word`, `dayInProgress.news` | "Ironbow sends word" | **KEEP** | |
| `diplomaticRecords` | Hall | **KEEP** | |
| `diplomacy` (`agreements`...`consortiums`, `rep`, `cooldowns`, `tokens`) | Hall actions | Area C | `tokens` dead (no spender) |
| `log` | Day Log | **DELETE** | |
| `lastEvent`, `lastEventDay` | Events | **DELETE** | |
| `warLog`, `militaryActions`, `warMissions`, `warMissionSeq`, `warRecovery`, `wars`, `repairs` | War | **DELETE** | `repairs` only ever set by a lost Defend Bastion (war-campaign-rules.js 1845) |
| `military` (rows), `defenderBeasts`, `defenders.{count,armed,patrolUntil}` | War Room / Menagerie / Barracks / Armoury / Watchtower | **DELETE** with the facilities (Area A) | After war goes, nothing reads them except the Management panel and those facilities' orders (grep: rules.js 1741, 2643-2652, 2696, 2701, 2739; tool.js 1479-1635) |
| pending orders with `facId` `war_council` / `war_room` | War | **DELETE on load** | `R.orderKind` (rules.js 2726-2730) returns `'war'` for them; unknown facility orders are otherwise dropped by `completeOrder`'s last branch (tool.js 5004-5013) with goods returned |
| `ui.warNoticed` | War pop-ups | DELETE | `R.cleanUi` 1063-1070 |
| `tsi.bastion.warMap`, `.warTable`, `.warTerrain` | War Table | DELETE (quarantine first) | `warMap` can hold an uploaded picture (megabytes) |

Compatibility traps when the version number changes (it has to, because several areas change the save):
- `shared/js/campaign-rules.js` line 52, `inDaysSave(ba)`: accepts only `v === 2 || v === 3`. A `v: 4` Bastion would make the DM doc and the Explorer's "Ironbow sends word" show nothing. Same check likely in `R.isOldSave` (rules.js 1055-1057: `s.v !== 2 && s.v !== 3 && ('turn' in s ...)`).
- `R.saveProblem` (1035-1051) lists `log`, `warLog`, `militaryActions`, `warRecovery`, `warMissions`, `wars`, `repairs`, `military`, `defenderBeasts`, `defenders` as shape checks. Removing a name from these lists is safe; leaving it is harmless for old files.
- `R.importProblem` (1143-1160) **rejects** a file whose `tsi.bastion.warMap/warTable/warTerrain` is malformed (via `R.isWarMap/isWarTable/isWarTerrain`, which call `ns.warTableRules`). After war-table-rules.js is gone those checks must be removed, and the importer must **ignore** old war keys instead of refusing the file (Harry's older "Back up everything" files contain them).
- `R.shiftDays` (3309-3341) moves war days at 3323-3329 (`wars`, `repairs`, `warRecovery`, `militaryActions`, `warMissions`) and `lastEventDay` 3315: delete those lines.
- `tool.js onReset` (5329-5335) removes `['state','crest','warMap','warTable','warTerrain']`: drop the last three (but a one-time cleanup for existing browsers is useful).

---

## 4. What must be KEPT because other kept features need it

1. **Favour (`state.favour`) and its rules**, for the Temple, the Shrines' orders, Great Rites, the DM doc's Favour meter and its score edit. Move `GOD_PATHS`, `godIcon`, the bar markup and CSS rather than rewriting them.
2. **Political Capital and Honour/Respect** values and their writers (Explorer standing outcomes via `applyInbox`, DM doc edits, Diplomatic Records). The Hall's `clanRelationsBox` already displays both. The DM doc already edits both (`Change A Score`). Nothing needs to be built to keep Harry's list "Clan Honour/Respect, Clan Political Capital, Diplomatic Events" at the Hall.
3. **`R.clanName`** is defined **twice**: `war-campaign-rules.js` 88 and `commerce-rules.js` 127. The war file loads later and wins today; deleting it leaves the commerce version (identical for the seven known keys; for an unknown key commerce returns the key as the Bridge names it, war returned a capitalised key or "Unknown"). `clanTitle()` in tool.js 1865 uses it (and `charterTermsBlock` 2853). Nothing to rebuild, but worth a test.
4. **The Explorer-to-Bastion receipts** (`state.bridge`, `R.applyInbox`, `R.cleanBridge`) and the notices `tellSettled` (tool.js 4671-4691). Only the *list* in Clan Influence goes.
5. **"The Ironbow sends word"**: `R.addWord` (rules.js 89-94), `dayInProgress.news`, `state.word`, `showWord` (tool.js 4888-4906), `R.finishDay`'s push to `state.word` (3284-3287), and `TSI.campaign.ironbowNews/bastionComing` (campaign-rules.js 77-180). The Explorer calls `TSI.campaign.ironbowNews` from `tools/explorer/rules.js` 787 and shows it in `tools/explorer/tool.js` 973-984.
6. **Orders pending** (`R.upcoming` rules.js 3354-3367; `campaign.summary().orders`).
7. **DM doc "Change A Score"** (`dmdoc-rules.js` EDIT_KINDS `pc`, `hr`, `favour`; `R.applyDmEdits`). It becomes *more* important: it is now the only way to nudge a score by hand.
8. **Dock/commerce pieces that read Clan lists** (`B.clans`, `clanTrade`): not war.
9. **Compendium** (tool.js 5239-5319): keep, but its "War Room units" glue goes (below).
10. **Creatures' register** (`R.creatures`, `creature-rules.js`): the register stays for the Beast Pit; only the *war profile* parts go (Section 6.4).

---

## 5. The war game: inventory

### 5.1 Code (all under `tools/bastion/` unless noted)

| File | Bytes | Lines | What it is | Loaded by |
|---|---|---|---|---|
| `war-campaign-rules.js` | 137,501 | 2,495 | The Bastion's side of war: Military list, what can be committed, missions, Military Action, wars (declare / attack every 7 days / end after 42 quiet days / Make peace), Defend Bastion, casualties, recovery (`tickRecovery`, `tickWars`, `tickRepairs`), Under Repair, `normalizeWar`, `warCouncilOpen` | Bastion (tools.js 105), Beast Handler laptop tool (tools.js 215), `tests/rules.html` 100 |
| `war-battle-rules.js` | 96,393 | 1,950 | `TSI.bastion.battleRules`: the battle itself | Bastion 103, Beast Handler 213, rules.html 98, `tests/war-table.html` 36 |
| `war-table.js` | 165,414 | 3,168 | The War Table screen (`TSI.bastion.warTable.open`) | Bastion 115, war-table.html 38 |
| `war-table-rules.js` | 54,336 | 964 | Board geometry, saved settings, preset maps, terrain | Bastion 102, BH 212, rules.html 97, war-table.html 35 |
| `war-ai.js` | 34,189 | 718 | Enemy commander | Bastion 104, BH 214, rules.html 99, war-table.html 37 |
| `regiment-rules.js` | 20,793 | 406 | War Room regiments: records, grades, Drill, Recouping, Musters | Bastion 101, BH 211, rules.html 96 |
| `war-table.css` | 55,575 | 1,225 | War Table styles (`.tsi-bas-wt*`) | Bastion css list (tools.js 82), war-table.html 12 |
| `data/war-units-data.js` | 25,590 | 375 | `TSI_DATA.bastionWar`: units, stat blocks, objectives, tiers, terrain, `presetMaps` (Defend Bastion coast), weather overlays | Bastion 89, BH 199, rules.html 84, war-table.html 34 |
| `data/war-room-data.js` | 2,505 | 53 | `bastionWarRoom`: training grades, drill slots, Recouping | Bastion 95, BH 205, rules.html 90 |
| `data/events-data.js` | 7,298 | 113 | Bastion d100 events (belongs to Section 2.5, not war) | Bastion 87, BH 198, rules.html 82 |
| `archive/mercenary-brigade.js` | 18,296 | 336 | The archived single-roll war + Brigade, with restore notes | not loaded |
| inside `tool.js` | n/a | about 1,300 of 5,687 | see 5.2 | |
| inside `rules.js` | n/a | about 400 | see 6.2 | |
| inside `bastion.css` | n/a | about 330 lines in 7 marked sections | see 6.5 | |

War files total about 593 KB (code 509 KB + data 28 KB + CSS 56 KB), plus the 18 KB archive file; the events file (7 KB) is separate. Not war despite the name or the grep hit: `diplomacy-rules.js` (the Hall's Diplomatic Records, **keep**).

### 5.2 Where war sits inside `tool.js` (to be cut)

| Lines | What |
|---|---|
| 1-14 (header comment), 64-66 | `data.warRoom`, `var W = D.bastionWar` |
| 94-105 | `formerBrigade` start-up (identity area) |
| 156-291 | "At War" tags: `warNames`, `nameRe`, `tagWars`, `tagAll`, the `tagWatch` MutationObserver (255-274), `settling` 276-288; called at 131, 152, 1874, 1879, 1963, 2115, 5569; `POP` marker stays only if something else uses it |
| 1199 | crest offer waits on `militaryRunning || warTableOpen` |
| 436-497 | `statTip`, `unitBlock`, `awayNote`, `awayList` (war stat blocks, recovery) |
| 1515-1637 | Management's Military / Menagerie / Defenders: `militaryInfo`, `fieldUnit`, `beastInfo`, `renderForceList` (Area A decides what remains of Management) |
| 1639-2443 | The War Council, Military Action flow, War Table launch: `warSpecs`, `makeWarRow`, `showWar`, `showCost`, `showIntel`, `renderWar`, `openWarReport`, `onQueueWar`, `declareWarAsk`, `renderMilitary`, `renderWars`, `onMakePeace`, `militaryPrompt`, `attackModal`, `militaryResultModal`, `openWarTable` 2337, `reportBattle` 2391, `callOffAsk`, `onContinueMilitary`, `onCallOff` (about 805 lines) |
| 4857-4861 | `R.settleRegiments` in the day's trade stage |
| 4871-4879, 4920-4925 | the day's attack roll and `defendBastion` |
| 4948-4961 | `completeOrder` `kind === 'war'` branch |
| 3388, 3468, 3848 | War Room recruit picker, `regimentSection` (facility area) |
| 5244-5262 (+ 5272, 5273, 5307) | Compendium's War Room units (`warRoomUnits`, `warUnitSummary`) |
| 5333 | Reset removes war stores |
| 5423-5442 | `warBtn`, `WAR_LOCKED`, `renderWarLock` |
| 5583-5591 | start-up notice "An attack on your Bastion is waiting" |
| 5598-5599, 5605 | `ns.debug.military`, `warTable` |

### 5.3 "Protected" files: flagged, needs Harry's confirmation

Earlier plans (written under the faithful-rebuild rule) call the war code protected:
- `docs/MILITARY-DIPLOMACY-PLAN.md` line 35: "(`war-units-data.js` and `war-battle-rules.js` are protected)".
- `docs/FACILITIES-OVERHAUL-PLAN.md` line 151: "War Room, `war-units-data.js`, War Table, battle rules, AI, war campaign | **KEEP** (protected)".
- Several `docs/specs` and `PROGRESS.md` entries describe the War Table as finished work approved by Harry (2, 4, 15 October 2026).

The handover (22 October) now says "no more war games VTT". That is a later, explicit instruction and it wins over the old plan, but it deletes about 600 KB of tested code and about 8,500 lines of tests, and the old docs were written to stop exactly this. **I would not delete until Harry says yes** (Question 1). The safe version of "yes" keeps everything recoverable: a git tag on the current main before the deletion (so the code is one command away), the pictures moved to `assets/extras/` as CLAUDE.md requires, and the old docs kept as history with a "removed on 22 October 2026 (Strip Back Overhaul)" note.

### 5.4 Tests

Rules tests (`tests/rules/`, `tests/rules.html`; baseline in my scratch copy: 1,285 tests, 1,284 pass; the one failure is only because I left the art out of the copy):

| File | Tests | Lines | Verdict |
|---|---|---|---|
| `bastion-battle.test.js` | 132 | 1,907 | delete |
| `bastion-campaign.test.js` | 123 | 2,259 | delete (it also covers `R.warForces`, `normalizeWar`, regiments, Recouping; check nothing non-war hides in it) |
| `bastion-war-ai.test.js` | 61 | 952 | delete |
| `bastion-war-table.test.js` | 48 | 822 | delete |
| `bastion.test.js` | 121 | 2,052 | edit: remove the war, Military Action, events, Compendium-war tests (14 fail without war code, listed in Section 7) and the `eventTable` count (line 51) |
| `creatures.test.js` | 45 | 980 | edit: 14 war/Defend tests fail (listed in Section 7) |
| `bridge.test.js` | 46 | 743 | edit: 1 (`undoWarDeclaration`) |
| `campaign.test.js` | 17 | 295 | edit: 1 fails on `eventTable`; lines 69-78, 116-124, 139-141 build war_council orders, `wars`, `warRecovery`, `repairs`, "A Bastion event is due." |
| `wyvern-bonding.test.js`, `beast-bonding.test.js`, `session-safety.test.js`, `beasthandler-link.test.js`, `diplomacy.test.js`, `dmdoc-edits.test.js` | n/a | n/a | assertions on `b.log[0].body` etc. change when `state.log` goes |

So **364 tests in four files** go whole, and about **30** more in four other files change or go. About 920 of 1,285 would remain.

End-to-end (`tests/e2e/`, Playwright against `file://`): `war-table.test.js` (123 checks, 2,107 lines) and `war-room.test.js` (12 checks, 355 lines) go whole; `tests/war-table.html` (131 lines, the War Table's own test page) goes; `phase9.test.js` (2,855 lines, 121 checks) loses its sections "Party identity and the War Council" (lines 857-1414, partly identity and Area D), "The War Room, the Military panel and the Menagerie" (1688-1901), "Wars, the Defend Bastion event and Under Repair" (1902-2412), plus `claim-*`, `roll-event`, `open-events`, `open-log` bits; `bastion-screen.test.js` (the bottom-bar section 823-945 and the lock check 864-944; its "17 tiles" and "labels for armoury, barracks, dock, watchtower, workshop" lines belong to Area A); `bastion-days.test.js` (`open-log` x2, "Day Log"); `creatures.test.js` (War Table tokens, 611-617); `reinforcements.test.js` is the **Combat Tracker**, not war (keep). Tests that look at `open-influence` / `bridge-row` to prove a delivery arrived (`commerce`, `courier`, `creatures`, `bridge` e2e) must read `TSI.bastion.debug.state().bridge.done` instead, or a new place that shows deliveries. `tests/archive/mercenary-brigade.test.js` goes with the archive. Fixtures (`tests/fixtures/bastion-pr*-sample.json`, `bastion-before-overhaul.json`) contain war fields and are the best material for migration tests: keep them.

### 5.5 Docs and guide

- Whole-document war material: `docs/WAR-RULES.md` (30 KB), `docs/MILITARY-DIPLOMACY-PLAN.md` (14.6 KB; section 1 is War Room, section 2 is the Hall's diplomatic records, which stays), `docs/specs/war-room-training.txt` (11 KB).
- Mentions to bring up to date: `docs/BASTION-EXPLORER-REFERENCE.md` (about 102 lines: 5.7 "Warehouse, Artisan Tools, Management, Favour, Compendium, Treasury, Day Log" line 977; 5.8 Clan influence 1025; 5.10 War 1225-1415; 5.11 Bastion events 1416-1442; 5.12 word 1443; 5.13 saves 1460; section 4.5 Explorer events are NOT affected), `docs/BASTION-OVERHAUL.md` (41), `docs/FACILITIES-OVERHAUL-PLAN.md` (15, including the "protected" line 151), `docs/ASSETS.md` (8, lines 333-337, 389, 422), `docs/BASTION-MAP-ART.md` (61-62), `docs/PLAN.md` (6), `docs/PROGRESS.md` (97) and `docs/KNOWN_ISSUES.md` (147; append a dated "removed in the Strip Back Overhaul" section, do not rewrite history), `tests/e2e/README.md` (lines 38-52 describe the war tests).
- `guide.html` (the how-to guide Harry uses): war paragraphs at lines 243, 250-260 (War Room Recruit, Drill, War Council lock, declaring war, At War tags, attacks, losing a defence/Under Repair, Begin Military Action, fighting the battle, Call off), Day Log mentions (120, 195, 197, 203, 206, 214, 216, 219, 228, 230, 242, 247, 257), Clan Influence mention (195, 212). `tests/e2e/guide.test.js` checks the guide's structure; re-run it after editing.

### 5.6 Assets

Per CLAUDE.md, "bring every image ... across ... put unused files in the tool's `assets/extras/`" and list in `docs/ASSETS.md`. So: do **not** delete the pictures, move them.
- `tools/bastion/assets/war/defend-bastion-coast.jpg` (380 KB, the War Table's Defend Bastion map; referenced only by `war-units-data.js` 347 and tests).
- `tools/bastion/assets/panels/military.png` (1.9 MB, CSS `tsi-bas-box--military` bastion.css 890) and `bastion_defenders.png` (1.9 MB, CSS 888): only used behind Management's Military and Defenders boxes.
- `tools/bastion/assets/extras/ui/war_panel.png` (2.7 MB) is already in extras.
- Facility pictures (`war_room.png`, `barracks.png`, etc.) are Area A.
- Weather films the war reused live in `tools/explorer/assets/overlays/` (`blizzard_overlay.mp4`, `rain_overlay.mp4`, `sun_heat_overlay.mp4`) and are the Explorer's: **keep**.

---

## 6. Entanglement in files that must be edited (not deleted)

### 6.1 `shared/data/tools.js`
Bastion entry: css line 82 (drop `war-table.css`); js list lines 87 (`events-data`), 89 (`war-units-data`), 95 (`war-room-data`), 101-105 (`regiment-rules`, `war-table-rules`, `war-battle-rules`, `war-ai`, `war-campaign-rules`), 115 (`war-table.js`). Beast Handler entry: lines 198, 199, 205, 211-215 (it loads the Bastion's rules wholesale so it can read the save; it needs none of the war files). Careful: the comment at line 139-141 mentions the Explorer's old `events-data.js`; do not delete the closing `*/` (my first scratch edit did, and swallowed the next file in the Explorer's list).

### 6.2 `rules.js` (about 400 lines)
- 55-57 `R.log`; 120-181 defaults for war/log/event fields; 394-396, 412, 429-430, 443, 455 loaders (`normalizeWar`); 1002-1030 `cleanWars`, `cleanRepairs`; 1035-1051 `saveProblem` lists; 1063-1070 `cleanUi.warNoticed`; 1112-1160 war-key import checks; 1740-1742 Armoury cost (Area A); 1793-1795, 1875-1881 `issueDrill` hooks; 1812-1825 Under Repair (`underRepair`, `repairRefusal`; used at 1487, 1620, 1857, 1956, 2747, 3358 and in tool.js about 20 places and `courier-rules.js` 276); 1993-2005 `cancelOrder` → `undoWarDeclaration`; 2641-2701 barracks/war-room/menagerie completion (Area A); 2726-2730 `orderKind` 'war'; 2738 `patrolActive`; 3030-3045 `militaryQty`, `beastQty`; 3059-3185 Military Action rolls (`militaryName`, `militaryRoll`, `luckMod`, ... `militarySummary`); 3187-3217 events; 3243-3247 the log-to-word loop and war ticks in `R.startDay`; 3276-3282 automatic event in `R.finishDay`; 3315-3329 `shiftDays` war lines.
- `R.startDay` after cleaning: only `completeConstruction` + `tickDiplomacy` (the latter belongs to Area C).

### 6.3 `shared/js/campaign-rules.js`
`bastionComing`: war lines at 93-94 (`war_council`/`war_action` orders), 111 (ended agreements/delegations/summits; Area C), 114-116 (repairs), 117-124 (`warRecovery`), 153-157 (`wars` attack), 158-161 (event), plus `OBJECTIVES` (line 53), `clanTitle` (54). `summary` stays (and still reads `ba.favour` for the DM doc). `inDaysSave` version check (52). Tests: `tests/rules/campaign.test.js`.

### 6.4 Creatures (shared with the Beast Pit rework)
`creature-rules.js` 358-415 (`creatureWar`, `warCreatures`, `creatureRecovery`, `creatureStatus` kinds 'defending'/'recovering', `creatureWarLine` uses `R.warData`), 453-455 (discipline adds to Defend numbers), 621, 633 (training pauses while recovering), 758-770 (first-flight check "Not wounded or defending"); `data/creatures-data.js` 28-81 (each species' `war:` profile: Cohesion, Attack, Defence, Move, Resolve, Battle Value, trait). `tools/beasthandler/projection.js` 200-203 (`trainingOf`: `paused: !!rec`) and `view.js` 157 ("Paused while recovering"). These disappear or collapse to constants; the Beast Pit analyst (Area for beasts) owns the replacement, but the war analyst must not leave them dangling.

### 6.5 `bastion.css` (89 KB)
The file has marked sections, so the cut is mostly whole sections. Cut: "Banner & War Council" (894-971, including the Military Action rows `tsi-bas-ma*` at 933-970 and the At War tag), "Wars" (972-1004, `tsi-bas-wars*`, `tsi-bas-atwar`, `tsi-bas-declare*`, `tsi-bas-modal--war`), "Under Repair" (1005-1016; plus the repair rules at 370, 465, 482), the Military Action pop-ups `tsi-bas-ma-pop*` (1273-1294), "The War Room's regiments" (starts 1512, `tsi-bas-regiment*`), "Day Log · Bastion Map · Bastion Event" (823-849: keep only what the *map* rules there need), "Clan Influence: changes from the Explorer" (1495-1511), the Clan Influence rows (549-575, and the Clan Influence half of 850-870), `tsi-bas-box--military` / `--defenders` backgrounds (888-890; Area A). **Keep** the meter and god-icon rules in "Favour of the Gods and Political Capital (their panels)" (744-822: `tsi-bas-meter*`, `tsi-bas-bar-fill*`, `tsi-bas-god-icon*`) for the Temple, but drop `tsi-bas-token-pill` (810) and the Political-Capital-only bar variants if the Hall does not draw bars. The `.tsi-bas-pbtn*` rules (262-264, 1438) stay for Warehouse and Management. The header comment at 228 names the removed buttons. Note: a plain `grep tsi-bas-ma` also hits the **map** classes (`tsi-bas-map*`), which must stay.

### 6.6 Other
- `dmdoc.js` 257, 280: reword "its Day Log records / keeps it". Tile code for Orders pending and "Next word" (336-343) stays.
- `tools/beasthandler/bastion-link.js` lines 160, 167, 232, 315 call `R.log`; their comments at 212 mention the Day Log. The DM's panel (`dm-panel.js`) uses `R.beastRecent`, not the log.
- `tools/beasthandler/tool.js` 47 builds `data` with `events: D.bastionEvents`.
- `tests/rules.html` lines 82, 84, 90, 96-100 (scripts) and 132-135 (the four war test files); `tests/harness.html` (does not load war files); `tests/pin-check.html` mentions `pc-`.
- `README.md`/`docs/PLAN.md`: a line each.

---

## 7. Experiments (read-only, in scratch)

All in `.../scratchpad/analysis/sim/` (a 14 MB copy without art); the repo was not touched.

1. **Baseline** `tests/rules.html` in Chromium over `file://`: 1,284 / 1,285 pass (the failure is the missing battle-map pictures I left out of the copy).
2. **Switch off the war scripts, `events-data.js` and the four war test files** (`rules-nowar.html`): 890 pass, **31 fail**; 1 is the missing-art one, **30 are real dependencies**:
   - `bastion.test.js` (14): content count of events (`eventTable`); passing a day (automatic event); "Bastion: war" x2 (`R.warAvailable`); "the Military Action" x7 (`R.beginMilitaryAction`); events and the Compendium (d100 table); saving x2 (a Military Action surviving a save/reload; a damaged one dropped).
   - `creatures.test.js` (14): the data (War Table numbers); Demolish x2 (`R.warForces`); "the Menagerie is unchanged" (`R.warCouncilOpen`); "defending the Ironbow on the War Table" x9 (`beginDefence`, `creatureStatBlock`, `warCommit2`, ...); the save (recovery record).
   - `campaign.test.js` (1): "the word the Explorer sends at Make Camp" fails on `eventTable`.
   - `bridge.test.js` (1): "a War Action cancelled the same day gives back its own cost" (`undoWarDeclaration`).
   Every one of these is a war or event test, so none is a regression; they are the list of tests to delete or rewrite in the PR.
3. **Open the Bastion over `file://` with the war scripts removed from the tool list**: it does not open. `[TSI] The Ironbow Bastion Manager failed to open: TypeError: R.warActionObjectives is not a function`. The war code is called while `tool.js` builds the screen, not just when a button is pressed.
4. **Same, Explorer and Beast Handler** (with the list edited correctly): both open with no errors. The Explorer's fight hand-off (`tools/explorer/fights.js`) reads only `partyLevel` from the Bastion save.

---

## 8. What the Day Log and Events provided to other things

**To the Beast Handler.**
- Nothing it reads. `projection.js` (the phone's snapshot) excludes the log by design; the phone page (`beasthandler.html`) loads none of the Bastion code.
- It *writes* four log lines (pairing code made / taken back, a profile changed, an order accepted: `bastion-link.js` 160, 167, 232, 315) as an audit trail. The same facts survive elsewhere: `state.beast.done` receipts (`R.beastRecent`, shown in the DM's Beast Handler panel) and `development.profileLog` (profile changes). So deleting `R.log` calls there loses no data; just the duplicate line.
- It *loads* the war files and `events-data.js` (tools.js 198-215) only because it loads the Bastion's rules wholesale.
- Wording: tool.js 4794 notice "The Day Log keeps it."
- `creatureRecovery` (a war record) feeds the phone's "Paused while recovering" training label (`projection.js` 200, `view.js` 157). That label becomes unreachable; with the Beast Pit rework the training orders themselves go (not my area).

**To the DM doc.**
- Nothing reads the log. The DM doc reads `pendingOrders` (Orders pending), `bastionComing` (Next word from the Ironbow), `politicalCapital`, `honourRespectByClan`, `favour`, `diplomaticRecords`, `partyLevel` and `tsi.dmdoc.edits` receipts (`dmEdits.done`).
- The *forecast* includes lines that go: "A Bastion event is due." (Events), "Clan X may attack: the Bastion rolls to see." and "Your army is ready to march on..." (war), recovery/repairs lines (war), and agreement/delegation/summit endings (Area C). After the cut "Next word from the Ironbow" lists only construction finished, orders complete, sea routes needing a roll, cargo ships, parcels, and records ending.
- Dialog text in the DM doc mentions the Day Log (dmdoc.js 257, 280).

**To the Explorer's "The Ironbow sends word".**
- Same forecast function, `TSI.campaign.ironbowNews`. The Explorer shows what the Bastion has coming for the days the party just travelled. Events and war lines vanish from it as above. It does not read `state.log`.
- The Bastion's *own* "Ironbow sends word" pop-up is `state.word`, built by `R.addWord`. `R.addWord` is called from `startDay`, `finishDay`, `completeOrder` (in-day), `applyInbox`, commerce and courier settle functions: keep. The one place it was fed *from the log* is the war-tick loop in `R.startDay` 3247 (delete with the war ticks).

**Silent consequences of removing the Day Log (needs a small replacement; I will do it unless Harry objects).**
1. `completeOrder`'s `'simple'` branch (tool.js 4996-5003) writes the result of an order to the log and, only `inDay`, to the day's word. An order finished with **Resolve** (a cancelled roll earlier) gives the DM no message except the log. A Shrine's Pray roll ("Rolled 1d20 = 14. Added +14%") is the clearest case. Fix: show a notice (or small pop-up) with the result lines when `inDay` is false.
2. Explorer deliveries that are **skipped or refused** (Port Charter, parcel, creature, Great Rite, or an unknown Clan) were explained only in Clan Influence's list ("Skipped: Port Charter... Grant it again in the Explorer if it should count"). Applied ones still get a notice. Fix: make the refused/skipped notice carry its own reason (`tellSettled` 4686-4690 currently says "Clan Influence says why").
3. `R.handToParty` (rules.js 2064-2081) wrote "the DM records it on the D&D sheet" to the log; the dialog already says it; nothing lost.
4. A Mercenary-Brigade and facilities-migration report (tool.js 5664-5674) refer to the log; replace by the notice text itself.
5. Audit history (what happened when) is gone. The campaign save and Back up everything no longer hold it. If Harry wants a last copy, a download of the old log at migration time is a cheap courtesy (Question 5, optional).

---

## 9. Explorer fight hand-off: separate, not war

`tools/explorer/fights.js` (5.5 KB) + `tools/explorer/data/fights-data.js` (9.5 KB) turn an Explorer event's enemies into a Combat Tracker encounter (SRD stats, a battle map from `tools/encounter/assets/battlemaps/`), and report back. It reads `bastionSave.partyLevel` and nothing else from the Bastion (fights.js 21-26). It does not touch `war-units-data.js`, the War Table or any regiment. It is the DM's Combat Tracker feature. **Keep.** Mention in the PR so Harry does not wonder.

---

## 10. Test and doc workload (rough)

- Delete: 4 rules test files (364 tests, 5,940 lines), `tests/war-table.html`, `e2e/war-table.test.js` (123 checks), `e2e/war-room.test.js` (12), `tests/archive/mercenary-brigade.test.js`.
- Edit: `bastion.test.js` (about 14 tests plus log assertions), `creatures.test.js` (14), `bridge.test.js` (1), `campaign.test.js` (1 plus fixtures), about 11 other rules/e2e files that read `b.log` / `open-influence` / `bridge-row`, `phase9.test.js` (3 whole sections of 9 plus scattered checks), `bastion-screen.test.js` (bottom bar and lock), `bastion-days.test.js`, `creatures.test.js` e2e, `tests/e2e/README.md`, `tests/rules.html`.
- Fixtures: keep `tests/fixtures/bastion-pr*-sample.json`; they are the ideal inputs for "old save with a war and a log opens cleanly" migration tests.
- Add: rules tests for the migration (war fields dropped, war_council / war_room pending orders removed, favour / PC / H&R / bridge receipts / word kept), `inDaysSave` with the new version, import of an old file carrying `warMap/warTable/warTerrain`, `startDay`/`finishDay` without log or events, `bastionComing` without war/event lines, `R.clanName`.

---

## 11. Contradictions, gaps and risks in the handover (for the PR description)

1. **Favour model.** Handover: Receive Blessing spends the full bar and resets. Code: blessing orders spend 0/5/10/25% of the bar. See 2.1; the Temple analyst must settle it.
2. **"Honour Change" and Support are not mentioned.** They disappear with Clan Influence. "Honour Change" never had an effect beyond resetting the bar; Support only existed for Form Clan, which the handover also removes. No loss.
3. **The Hall keeps Political Capital, but nothing in the Hall can change it any more.** Host Delegation, Secure Writ, Inter-Clan Summit and Trade Consortium (the writers) are removed; the typed box and Honour Change button go with Clan Influence. After the PR a score changes only by Explorer standing outcomes, Diplomatic Record consequences and the DM doc's Change A Score. That is consistent with the DM-led direction but worth Harry knowing (Question 3).
4. **Diplomatic Events cadence.** The PR 9 spec suggested hooking optional "offered" diplomatic incidents to the 28-day Bastion event. With Events gone there is no cadence to hook; the DM-authored Diplomatic Records are all that remain (Question 4).
5. **War state in live saves.** Anything queued, mustering or mid-battle is dropped (Section 12).
6. **Nobody can see war-related Under Repair or "Patrol active" any more; both go with the war.** `R.patrolActive` only fed the war.
7. **The Management panel** keeps three war-fed boxes (Defenders, Menagerie Beasts, Military) whose facilities the handover removes. Area A decides what is left of Management; if the Beast Handler DM panel stays there (`beastDm`, tool.js 1462, 1496-1497) it still needs a home.
8. **Barracks and Watchtower had non-war jobs** that the handover does not mention moving: commerce protections (`commerce-data.js` 152-153: "Guard Commercial Convoy" at the Barracks, "Protect Maritime Approaches" at the Watchtower). Area A/C must cover them, or the Dock loses two protections (and `tests/e2e/charter-terms.test.js`).
9. **Docs call the war files "protected".** Needs explicit confirmation (Question 1).
10. **Version number.** Every area changes the save; one migration for the whole PR; update `inDaysSave` (campaign-rules.js 52) and `R.isOldSave` together or the DM doc/Explorer news silently go blank.
11. **Wording that mentions removed things lives in notices, help text, the guide, the DM doc and about 140 test/doc lines.** A search-and-replace pass at the end is needed; I found 13 "Day Log" places in the guide and 11 in the reference doc.
12. **`R.clanName` defined twice** (war file and commerce file); safe, but delete one with care.

---

## 12. Migration and compatibility plan for this area (proposal)

1. On first load of a Bastion save that still has any of the removed fields: set aside an untouched copy (`TSI.store.quarantine`, so it is in Back up everything), then build the new state (`R.fromSave` already ignores unknown fields). Say what happened once in a notice, as the v2→v3 migration did.
2. Drop: `log`, `lastEvent`, `lastEventDay`, `warLog`, `militaryActions`, `warMissions`, `warMissionSeq`, `warRecovery`, `wars`, `repairs`, `diplomacy.tokens`, and (with Area A) `military`, `defenderBeasts`, `defenders`. Remove pending orders at `war_council` (they cost no gold; the H&R and PC cost of declaring war was already applied and stays) and, with Area A's refund policy, at `war_room`.
3. Keep verbatim: `favour`, `politicalCapital`, `honourRespectByClan`, `bridge`, `dmEdits`, `word`, `dayInProgress` (drop its `attackRolled`), `diplomaticRecords`.
4. Quarantine and then remove the three War Table stores: `tsi.bastion.warMap`, `.warTable`, `.warTerrain`; clear `ui.warNoticed`.
5. Old backups: `R.importProblem` must accept them (ignore the war keys) and the importer must not choke on a v3 save while the new version is v4; both directions covered by tests using the existing fixtures.
6. `tests/rules` and `tests/e2e` for each of the above.

---

## 13. Suggested order of work for this area

1. Decide with Harry: Q1 (delete protected code), Q2 (live war), Q3-Q5.
2. Take the git tag; move the three pictures to `assets/extras/` and update `ASSETS.md`.
3. Cut the screen: remove the five buttons/cards/openers/renderers from `tool.js`; remove the At War tag machinery; remove `warCard` and the Military Action flow; fix `renderAll`, `openerFor`, `ns.debug`, `onReset`. Move the Favour bar markup into the Temple (Area for Temple) in the same commit so the bars are never lost.
4. Cut the rules: `R.log` and callers; event functions; war ticks in `R.startDay`; `finishDay`; `shiftDays`; `cleanUi`; import checks; `saveProblem` lists; `campaign-rules.js` forecast lines.
5. Delete the war files and data, fix `tools.js` x2, `rules.html`, `tests/war-table.html`.
6. Add the replacement notices (Section 8, items 1-2).
7. Tests, then docs and guide.

---

## 14. Questions for Harry (also returned in the structured summary)

1. **OK to delete the war game?** Earlier plans called `war-units-data.js` and `war-battle-rules.js` "protected". Default: yes, delete the War Table, battle rules, enemy AI, campaign rules, regiments, the Defend Bastion attacks and their tests; mark the last version with a tag so it can be brought back; keep the pictures in `extras`.
2. **Is there a real war, queued War Action, regiment or Military list in your live campaign?** Default: assume none that matters; keep a safety copy, drop them, and say so once on screen. Honour/Respect and Political Capital already lost to declaring war stay as they are.
3. **Score editing without Clan Influence.** Default: the Hall only shows Honour/Respect and Political Capital; to change one by hand use the DM doc's Change A Score (already there). The "Honour Change" button only reset the bar, so nothing automatic is lost.
4. **Diplomatic Events:** default: the Hall keeps only the DM-written Diplomatic Records; the old idea of automatic 28-day diplomatic incidents is dropped with the Bastion event.
5. **Optional: a last copy of the old Day Log?** Default: no; the safety copy in the backup holds it. Offer a one-off download only if he asks.
