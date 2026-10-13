# Ironbow facilities overhaul: the plan (Phase 0 audit, with Harry's decisions)

**For:** Harry (and his planning AI)  
**Date:** 13 October 2026  
**Scope:** the Phase 0 audit (no code changed), saved here on 13 October 2026 with Harry's answers (section 0), as the plan for the overhaul.  
**Read alongside:** `IRONBOW_BASTION_FACILITIES_V4_CLAUDE_CODE_HANDOFF.md` (the brief) and `docs/BASTION-EXPLORER-REFERENCE.md` (the 12 October audit, unchanged).

---

## 0. Harry's decisions (13 October 2026)

| # | Decision |
|---|---|
| D1 | Approved as recommended: merged buildings need party level 5; every old order keeps its own party-level gate (the Laboratory's and Greenhouse's orders still need 9); the Smithy's own order stays in saves that had a Smithy. |
| D2 | The Gaming Hall simply goes from the game: an old save's Gaming Hall is removed when it loads (its slot freed, a note in the Day Log), and it can't be built. |
| D3 | Approved: if both halves of a merge were built, the second slot is freed. |
| D4 | **Changed:** the new facilities are **not** hidden. Harry wants to see them come alive as they're made: they're listed (marked in development) from pull request 1a, and each becomes buildable in the pull request that gives it working orders. |
| D5 | Harry's real campaign save is probably lost (computer migration); he may rebuild it from session notes. The migration is tested with made-up saves covering every case. |
| D6, D7 | Approved: no upgrading while Under Repair; the Hall's roll modifier stays +6 at levels 4–5. |
| D8 | **Changed:** upgrades take **7 / 14 / 21 / 28 days** to reach levels 2 / 3 / 4 / 5, and cost no gold for now. |
| D9–D11 | Approved, and the new art goes **first**: the map pull request comes before 1a (done 13 October). |

**Clarifications from Harry's planning AI (13 October), agreed:**
- Elara owns the wyvern and it lives at Ironbow as a defender: that's settled story. The data is what's missing, and the Wyvern Roost pull request asks Harry for its profile and starting bond rather than inventing them.
- Building time counts as an investment even though no gold was spent; a proper migration and the freed slot are enough (no extra compensation).
- Universal Clan Honour/Respect is a confirmed goal. Before Phase 4, an event-by-event conversion table goes to Harry for approval, and the old text notes must never cause a change to be applied twice.
- Before any items, reputation changes or shipments pass between the tools, a proper single-writer lock with unique transaction ids and completion records saved with each effect, so a second window can take over safely. This is a formal acceptance test.
- The migration keeps an untouched copy, converts before the loader cleans, and saving, reloading, exporting and importing never repeat it.

## 1. Starting point, verified

| Check | Result |
|---|---|
| Live code | `main` at **`d8f6566`** (pull request #18 merged, 12 October). No other open pull requests. |
| Same as the reference? | Yes. The working branch was fully merged; the code the reference describes is the code on `main`. |
| SUI-29 fix present | Yes: `shared/js/store.js` (`inflightKeys`, `lastRead`). |
| Tests on that code (12 October) | All passing: `tests/rules.html` 813; e2e `phase1` 126, `phase8` 81, `phase9` 114, `bastion-screen` 37, `bastion-days` 16, `fights` 15, `dmdoc` 11. |
| New art | In `bastion-new-art/`, unused by the code, as the brief says. |

Coding will restart the working branch from `main` (the old one is merged), and every phase will be its own pull request.

---

## 2. What the live code adds to the brief

The brief is careful and largely matches the code. These are the things I found in the code that change *how* the work should be done. Each one is a risk if missed.

1. **Both tools rebuild their saves from known fields only.**
   - Where: the Bastion's `R.fromSave` (`tools/bastion/rules.js` 197–289) and the Explorer's `R.fromSave` / `J.clean`.
   - What happens: they start from a fresh default state and copy across only the fields they know.
   - The risk: anything new (facility levels 4–5, research, creatures, party inventory, messages between the tools) **vanishes on the next reload** unless the loader is taught about it.
   - What to do: every phase adds its fields to the loaders, with a "reload twice, nothing changes" test.

2. **The Bastion silently drops things belonging to facilities it doesn't recognise.**
   - Under Repair records for unknown facilities are deleted on load (`cleanRepairs`, rules.js 307–315).
   - Orders at unknown facilities become kind `none` and are removed quietly (`R.orderKind`).
   - What to do: the merge must be done by a **migration step that runs on the raw save before the loader cleans it**. A loader-time alias alone isn't enough.

3. **Two merges collide on order names.**
   - The Workshop and the Smithy both have an order called `craft`.
   - The Garden and the Greenhouse both have an order called `harvest`.
   - The risk: the Bastion allows one pending order per facility and order name ("That order is already pending"). After a naive merge, an old save could hold two identical pending orders, and the merged building would lose the ability to run both at once, as it can today.
   - What to do: the Smithy's order becomes `smithing` and the Greenhouse's becomes something like `cultivate`, with pending orders re-labelled by (old facility, old order, choice), never by label.

4. **The Smithy's recipes already live in the Workshop.**
   - All 29 Smithy items are in the Workshop's "Smith's Tools" table, which also has Javelin, making 30. The Workshop makes them in **3 days** against the Smithy's **5**.
   - So nothing is lost in the merge, provided someone who owned a Smithy but doesn't have Smith's Tools in one of their six artisan sets keeps the Smithy's own order.

5. **Building and upgrading cost no gold today.**
   - `R.startBuild` charges nothing, and the Hall upgrade is free (B4).
   - So retiring the Gaming Hall, or freeing a slot when two merged buildings were both built, **loses no paid gold**. The only cost is the days spent building.
   - Also, upgrade prices for levels 2–5 would be the first time buildings cost gold at all. That's a real economy decision (D8).

6. **Facility levels are capped at 3 in two places.**
   - Where: `R.getFacilityLevel` (rules.js 555) and the Hall's upgrade (rules.js 1003; data `maxLevel: 3`).
   - Only the Hall uses levels; every other built facility sits at level 1.
   - What to do: raising the cap must keep the Hall's +2/+4/+6 behaviour exactly.

7. **Elara's wyvern is not in the code or the save anywhere.**
   - The Menagerie's 13 beasts have no wyvern. The only wyvern in the suite is the Arenas boss.
   - So "presently a Bastion defender" is true in the story, not in the data. It also has **no War Table profile**: a wyvern can't fight a Defend Bastion battle until one is designed.
   - What to do: registering it is new data entry, not a migration (decision needed in Phase 7).

8. **The "clan honour" notes in Explorer events point to the Notice Board, not the Bastion.**
   - 13 of the 17 `dm` notes in `journey-events.js` read "Notice Board: consider ±1 clan honour with Clan …".
   - A 14th is conditional: "If this ever comes out: −1 clan honour with Clan Farmer".
   - The risk: turning them into real Bastion Honour/Respect changes is a rules change, not a wiring job. Decide per event (Phase 4).

9. **The Explorer names Bastion facilities by reshaping their code names.**
   - Where: `shared/js/campaign-rules.js` 35–39 (the forecast and the DM doc).
   - The problem: `library_scriptorium` would read "Library Scriptorium", and `weavers_hall` "Weavers Hall".
   - What to do: a small shared list of display names, loadable by the Explorer page.

10. **Nothing stops two Bastion windows both passing days.**
    - The tab guard only warns. Today that's harmless: each window passes the day and the last save wins.
    - Once the Bastion accepts deliveries or reputation changes from the Explorer, two processors could accept the same one twice.
    - What to do: before the Explorer–Bastion link (Phase 4), only one Bastion window may process (the first one opened), using the tab guard's existing heartbeat.

11. **Pending orders already have every safety the brief asks for.**
    - They survive Reset Travel (`R.shiftDays`), wait while Under Repair, can't run twice in a day, resume after a cancelled roll (Resolve), appear in the Explorer's forecast and in the DM doc, and are saved in the campaign file.
    - Recommendation: **upgrades, research, production and training are all pending orders of new kinds.** No separate job queue. They then inherit all of that safety for free.

12. **The Explorer has no list of ports.**
    - The town pins have no "port" flag. Six pins have port-like names (Bleakharbour, Steelport, Moltenport, Timberport, Goldport, Redport), and only some have town maps.
    - The port registry for Port Charters has to be written as new data, with your list (Phase 5).

---

## 3. KEEP / EXTEND / REPLACE / DEFER

| Area (code) | Decision | Notes |
|---|---|---|
| Day engine: `checkClock`, `passDays`, `R.startDay` / `finishDay`, `dayInProgress`, `R.shiftDays` | **KEEP** | New order kinds plug into the existing "orders" stage; `R.shiftDays` gains each new date field. |
| Explorer travel, Make Camp, weather, events, follow-ups, fights hand-off | **KEEP** | Hooks are added only in Phase 4, only where a pilot needs one. |
| `shared/js/store.js` (SUI-29-safe `fresh`) | **KEEP** | Reused for every cross-window read. |
| Campaign save, Back up everything, Import checks | **EXTEND** | New fields ride inside `tsi.bastion.state` / `tsi.explorer.save`, so backups cover them automatically. Import checks accept the new save version. |
| Bastion save loader `R.fromSave`, `R.saveProblem` | **EXTEND** | Versioned migration (v2 → v3) runs before cleaning; the original v2 save is kept aside first. |
| Explorer save loader `R.fromSave`, `J.clean` | **EXTEND** (Phase 4) | Party inventory and message list. |
| `facilities-data.js` (18 facilities) | **EXTEND** | 22-facility catalogue; legacy ids kept as aliases for the migration and history only; per-order party-level gates kept. |
| Five starting facilities and their orders | **KEEP** | Recruit Defenders, Arm Defenders, Patrol, Charter Berth, Workshop Craft (and Craft Magic Item) unchanged at level 1. |
| Smithy, Garden, Greenhouse, Arcane Study, Laboratory, Library | **REPLACE** (by merging) | Into Workshop, Herbal Gardens, Arcane Laboratory, Library & Scriptorium; every recipe, time and pending order preserved. |
| Gaming Hall | **REPLACE** (retire) | No new building; an existing one is archived and its slot freed (D2). |
| Facility levels (`facilityLevels`, cap 3) | **EXTEND** | Levels 1–5 for all; one generic Upgrade order; the Hall's L1–L3 rules unchanged. |
| Hall of Emissaries, Trade Network, Council Ledger, routes, investments | **KEEP** | Commodity routes come later as a separate route mode (`legacy_abstract` vs `commodity_backed`). |
| War Room, `war-units-data.js`, War Table, battle rules, AI, war campaign | **KEEP** (protected) | Phase 8 adds per-formation training only. |
| Menagerie beasts (`defenderBeasts` rows) | **KEEP**, later **EXTEND** | The creature registry in Phase 7 adapts it; no beast is copied. |
| Warehouse (free-form rows) | **KEEP**, later **EXTEND** | Phase 3 adds item ids and lots beside the free rows, without converting them. |
| `TSI.campaign.ironbowNews`, DM doc | **EXTEND** | Shared display names (finding 9); new order kinds appear in the forecast as "complete" or "needs your roll", never as delivered. |
| Bastion map (`fitMap`, overlays list) | **EXTEND** (art pull request) | `MAP_RATIO` 3000/1250; overlay per new facility id. |
| Explorer–Bastion messages, party inventory, effects, Port Charters, creatures, research trees, commodities | **NEW**, phased | See section 6. |
| Scout Lodge, Infirmary, Shipwright's Yard, combination bonuses, Clan-state politics, story-generating Library, instant breeding | **DEFER** | As the brief says. |

---

## 4. Save migration plan (Phase 1a)

**How it works:**
1. When a Bastion save loads, if it is `v: 2`, an untouched copy is first set aside under the suite's existing quarantine name. That copy is included in Back up everything.
2. Then a pure function rewrites the raw save to `v: 3`.
3. Then the normal loader runs.
4. The migration runs once (it checks the version), so reloading or re-importing never repeats it.
5. A plain-English summary pop-up appears once, and the same summary goes into the Day Log.

**Facility mapping**

| Old (id → order) | New facility (id) | New order id | Kept exactly |
|---|---|---|---|
| `workshop` → `craft`, `craft_magic_item` | Workshop (`workshop`) | unchanged | 3-day craft from the six artisan sets; 10-day Craft Magic Item |
| `smithy` → `craft` | Workshop | `smithing` | the Smithy's 29 items at 5 days, for saves that had a Smithy (D1) |
| `arcane_study` → `craft_common`, `craft_uncommon` | Arcane Laboratory (`arcane_laboratory`) | unchanged | 5 and 10 days, same lists |
| `laboratory` → `craft` | Arcane Laboratory | `alchemy` | 5 days, 20 recipes |
| `garden` → `harvest` | Herbal Gardens (`herbal_gardens`) | `harvest` | 7 days, 5 products |
| `greenhouse` → `harvest` | Herbal Gardens | `cultivate` | 10 days, 5 products |
| `library` → `research` | Library & Scriptorium (`library_scriptorium`) | `research` | 5 days, four scriptures and their notes |
| `gaming_hall` → `trade` | retired | (none) | see D2 |

**Rules the migration follows:**
- **Pending orders:** each keeps its id, due day, cost paid and choice. Only its facility and order name change, matched on (old facility, old order, choice).
- **Built in slots:**
  - one source built → that slot becomes the merged building;
  - both built → the earlier slot holds the merged building and the later slot is freed;
  - one built and one under construction → the built one wins, and the construction is noted in the summary (nothing was paid);
  - both under construction → the one finishing first is kept.
- **Under Repair:** the merged building keeps the **later** repair end day, and orders at either source wait for it.
- **Levels:** the merged building's level is the highest of its sources'. Today that's always 1.
- **Party-level gates:** each union order keeps its source's gate. The Laboratory's and Greenhouse's orders keep needing party level 9, so no rule changes in Phase 1a (see D1).
- **History:** the Day Log, War Log and word lines keep their old names; they're history.
- **Never touched by the migration:**
  - the Warehouse;
  - the treasury;
  - the Hall and its records;
  - routes;
  - wars, missions and the War Table;
  - the crest and identity;
  - a day left part-way.

**Tests to add:** saved fixtures for:
- every merge case above;
- the Gaming Hall built, and under construction;
- repairs on both sources;
- the Hall at level 3 mid-upgrade;
- a full War Room roster;
- a day left part-way.

Each fixture is loaded twice and must come out identical. Each is also exported and imported as a campaign file, and restored from a whole-suite backup. Existing tests that build a Smithy or Garden are updated deliberately, each change listed in the pull request.

---

## 5. Cross-window hazards

| Hazard | Handling |
|---|---|
| A new field lost on reload (finding 1) | Loader updated in the same pull request; "reload twice" test. |
| Two Bastion windows processing (finding 10) | Single processor (the first-opened window) before Phase 4. |
| Explorer → Bastion changes (reputation, couriers, charters) | The brief's own design: an append-only message list inside the Explorer save, each message with a unique id. The Bastion reads it with `fresh`, applies each once, and records a receipt in its own save; the Explorer reads the receipts. Neither tool ever writes the other's save. |
| Moving items between Warehouse and party bags | Two-step with receipts. An item is never in both places: it is reserved or "in transit" until the other side confirms. |
| A campaign file restored from an older moment | Receipts are keyed by message id, so replaying is safe; a backup made on the home screen pairs copies from one moment (since the SUI-29 review). |
| The Explorer seeing Bastion results | Today the Explorer reads the Bastion's save only at Make Camp, in fights and in the DM doc. Receipts need a regular read, the same 2-second pattern the DM doc already uses. |
| Reset Travel | Every new date field is added to `R.shiftDays` (and the Explorer's equivalent), with a Reset Travel test per phase. |

---

## 6. Proposed pull requests (each small, tested, and approved before the next)

| # | Pull request | Contents | Ready to start when |
|---|---|---|---|
| 1a | **Catalogue and migration** | The four merges and the retired Gaming Hall, the v2 → v3 migration with its summary, the shared display names, loader updates, and the tests in section 4. The 8 new facilities are defined but **not buildable or shown** until their own pull request. No new gameplay. | D1–D5 answered |
| Art | **The new map** | 3000 × 1250 painting, overlays mapped to the new ids, the crest over the sky, both screen sizes. Independent of the rest; can follow 1a straight away. | D9–D11 answered |
| 1b | **Levels 1–5** | Levels for all 22; one generic Upgrade order (a pending order); levels shown in each facility's panel; existing orders all available at level 1; the Hall's L1–L3 behaviour unchanged. | D6–D8 answered |
| 2 | **Research engine plus a pilot** | Research trees as data, research as pending orders, a whitelist of effect types (never code stored in a save), and one pilot tree. | Research model and the pilot tree approved |
| 3 | **Warehouse lots plus two industries** | Item ids and lots beside the free rows; Timber Yard & Sawmill and Fishery & Smokehouse buildable; the slots decision applied. | Slots, commodity list and prices approved |
| 4 | **The Explorer link** | Message list and receipts, party inventory, the single-processor guard, and one or two benefit pilots (for example a chart for one extra 6-mile hex) and one reputation change from an event. | Pilot effects and the events to convert approved |
| 5 | Commodity trade and Port Charters | `commodity_backed` routes beside the old ones; a pilot port or two. | Trade decisions approved |
| 6 | Courier Exchange | Deliveries to set collection points. | Party-inventory rules approved |
| 7 | Creatures | Creature registry, Wyvern Roost with Elara's wyvern, Griffin Tower, Dire Wolf Den. | Creature decisions approved |
| 8 | Military and diplomacy research | War Room training per formation, Hall level 4–5 orders, shrine extras. | Balance approved |
| 9 | Final polish | Remaining tiles, guide, full campaign dry-run. | — |

**Progress (13 October 2026):** the art pull request (#19), 1a (#20, with Demolish) and 1b are done. 1a lists the eight new facilities as "In development" rather than hiding them (D4). 1b gives the Hall the same Upgrade as every facility, so its Level 2 now takes 7 days instead of 14 (D8's table applies to all); its bonus and actions at Levels 1 to 3 are unchanged.

**Every pull request will:**
- leave every existing test passing;
- add its own tests;
- be checked from a double-clicked file at 1707 × 930 (pixel ratio 1.5) and 1920 × 1080 (pixel ratio 1), and with two windows;
- update `PROGRESS.md`, `KNOWN_ISSUES.md` and `ASSETS.md`;
- end with your tickbox checklist.

---

## 7. The decisions as they were asked (Harry's answers are in section 0)

Only what's needed to start the first two or three pull requests. My recommendation is given for each; **none of the brief's example numbers is treated as approved.**

### Before pull request 1a (catalogue and migration)

- **D1. Gates and recipes on merged buildings.**
  - *Recommendation:* the merged buildings need party level 5 to build, as the Garden, Arcane Study and Library did. Each old order keeps its old gate: the Laboratory's alchemy and the Greenhouse's products still need party level 9.
  - The Smithy's own order stays only in saves that had a Smithy. Everyone else smiths through the Workshop's Smith's Tools, which is faster.
  - The result is that no rule changes in this pull request.
- **D2. The Gaming Hall.**
  - *Recommendation:* retire it on load. Its slot is freed, the building record is kept in an archive list, and a pending Trade order (which pays nothing) is removed with a Day Log note.
  - Nothing to refund, because building and Trade cost no gold.
- **D3. Both merged sources built.**
  - *Recommendation:* the second slot is simply freed. Nothing was paid, so no compensation.
- **D4. The 8 new facilities.**
  - *Recommendation:* they stay hidden until the pull request that makes each one work, so nothing appears that does nothing.
- **D5. Your real save (strongly recommended).**
  - Please send a campaign file: the Explorer's **Export Save** or the Bastion's **Download Save (JSON)**.
  - I'll test the migration on your actual Bastion, not just made-up saves. Attach it here in the chat, not on GitHub, so it stays out of the repository.

### Before pull request 1b (levels)

- **D6. Upgrading while Under Repair.**
  - *Recommendation:* refused, like any other order.
  - An upgrade in progress doesn't stop the building's other orders. That's how the Hall's upgrade works today.
- **D7. The Hall at levels 4–5.**
  - *Recommendation:* the roll modifier stays **+6**. Levels 4–5 only unlock new orders later (Phase 8).
- **D8. Upgrade times and costs.**
  - Today buildings and the Hall's upgrade are free, and the Hall's upgrade takes 14 days.
  - *Recommendation, provisional and kept in one data table:* days to reach each level of **14 / 21 / 28 / 35** (L2 / L3 / L4 / L5), and **no gold** until the economy exists in Phase 3, then revisit.
  - Or give me your own numbers.

### Before the art pull request

- **D9. When.**
  - *Recommendation:* right after 1a, as its own pull request.
- **D10. Overlays.**
  - *Recommendation:*
    - Herbal Gardens uses the Greenhouse painting;
    - Arcane Laboratory uses the Laboratory;
    - Library & Scriptorium uses the Library;
    - the three Shrines shown once built, reversing B12, which only covered the old, misnamed art;
    - no map overlay for the Workshop's merged Smithy, the Courier Exchange or the Menagerie.
- **D11. Tile pictures for facilities with no painting.**
  - *Recommendation:* a neutral, clearly marked placeholder tile (the facility's name on a dark painted frame) until you paint one. It's never another facility's picture.

### Decided later (tracked, not needed now)

- **Construction slots (Phase 3).** Today 0 / 2 / 4 / 5 / 6. At your level (9–10) that's 4 slots for 17 optional facilities, against 9 optional today after the merges. The options:
  - (a) keep it;
  - (b) add separate production plots;
  - (c) raise the totals.

  *Recommendation:* (b), which keeps the creature buildings scarce. The numbers are your call.
- **Research model (Phase 2):** choices per level, time and cost, how many at once, respecs.
- **Commodities and Clan demand (Phase 3/5):** which goods, lot sizes, prices, and each Clan's wants. Your old Clan specialities are the starting point.
- **Explorer link (Phase 4):**
  - Which of the 13 "Notice Board: consider ±1 clan honour" notes (and the conditional Farmer one) should become real Bastion Honour/Respect changes?
  - The chart benefit (one extra 6-mile hex?).
  - What party inventory tracks.
- **Ports (Phase 5):** which towns are ports for Port Charters, and the pilot one or two.
- **Creatures (Phase 7):**
  - Elara's wyvern's name and starting bond;
  - the character levels for each companion stage;
  - a War Table profile if it should fight;
  - how griffins and dire wolves are obtained.
- **Military (Phase 8):** each training effect and its Battle Value.

---

## 8. Where the brief and the code differ (the code wins)

| Brief | Code |
|---|---|
| "Elara's wyvern … presently a Bastion defender" (§1.1, §5E) | Not in the code or the save; no wyvern beast or War Table profile (finding 7). |
| "Seven current maps/regions" (§2.6) | 10 Explorer maps covering 7 regions. |
| Gaming Hall retirement may need "compensation" (§3.2, §11.2) | Building and its Trade order cost no gold (finding 5). |
| Smithy "resource investment" to preserve (§3.2) | None: construction is free. Recipes are already all in Smith's Tools (finding 4). |
| "+1 clan honour" `dm` outcomes as Bastion reputation (§6.3, §8) | The notes name the Notice Board; converting them is a rules decision per event (finding 8). |
| Shared storage "readable via `fresh`" for receipts (§6.1) | True, but the Explorer reads the Bastion only at Make Camp, in fights and in the DM doc; receipts need a regular read (section 5). |
| Facility levels exist (§4.1) | Only the Hall uses levels, capped at 3 in two places (finding 6). |

**Order now:** the art pull request (13 October), then 1a, 1b and on, each approved before the next.
