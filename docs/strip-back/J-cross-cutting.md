# AREA J: cross-cutting. Save migration, tests, docs, clean-up and order of work

Analysis only. Nothing in the repo was changed. Code read at `76c1276` (branch `claude/gallant-ramanujan-klwz70`; main `4f1db26` plus Harry's three beast pictures). Line numbers are for that commit.
I read the sibling reports A (facilities), B (panels and war), C (identity and crest), D (DM doc), E (workshop and development facilities), F (Temple, Hall, Dock), G (Beast Pit and bonding) and H (Beast Handler app) before writing this, and checked every claim I rely on against the code. Where those reports disagree with each other I say so and settle it in section 4.1.
Scratch material (rule-test counts, per-file tables, a baseline run of every test) is in `.../scratchpad/analysis/` (`rules-checks.json`, `rules-by-group.json`, `disp2.js`, `e2e-baseline/`).

---------------------------------------------------------------------
## 0. The short version

1. **One save, one version bump, one migration.** Every area of the handover changes the Bastion's save, so there is exactly one new step, `R.migrateToV4`, chained after the existing `R.migrateToV3` (v2 to v3 to v4). Each area adds its own **sub-step** to it, in its own commit, with its own tests. The pieces are idempotent and each recognises its own leftovers, so a half-converted or hand-edited save still comes out clean.
2. **Three things break silently if the version bump is forgotten**, and nothing in the existing tests would catch them: `shared/js/campaign-rules.js:52` (`inDaysSave` accepts only v 2 or 3, so the DM doc and the Explorer's "The Ironbow sends word" would go blank for every v 4 save), `tools/bastion/tool.js:91` (only a v 2 save is set aside before converting), and the fact that the **DM doc, the Explorer and the Beast Handler read the raw `tsi.bastion.state` record**, which stays v 3 until the Bastion itself is next opened. So every shared reader must accept v 2, 3 and 4 and ignore leftovers (section 2.4).
3. **The existing "set aside" is a move, not a copy** (`shared/js/store.js:466-483`: it deletes the live key, then the screen writes the converted save a few milliseconds later, `tool.js:5662`). That was acceptable for the v3 change. For a conversion that hands back gold and removes whole systems it should be copy first, then write, then verify. I recommend a small `TSI.store.keepCopy` helper and a **fail-closed audit** (section 4.5).
4. **"Never loses gold or goods silently" is made testable.** Seven invariants (section 4.5) are checked by a pure function `R.stripBackAudit(before, after)` that runs in the tests on every fixture and, at run time, before anything is written. If it fails the Bastion refuses to convert, changes nothing and says so.
5. **The tests.** Of the 1,285 rules tests (19,211 individual checks): about **458 tests (7,792 checks) are for removed things and go**, about **220 are rewritten**, about **600 stay**. Of the 36 click-through files (about 1,010 checks): **6 files go whole** (`war-table`, `war-room`, `wyvern-bonding`, `beast-bonding`, `beasthandler-write`, plus the War Table test page), about **12 are rewritten or heavily edited**, the rest stay. Tables in section 5.
6. **The guide's own test is weaker than it looks.** `tests/e2e/guide.test.js` checks each bold word against the tool's *code* including comments and data, so a stale word survives as long as it appears anywhere under `tools/<id>/`. Add a "stale words" check (section 6.4) or the guide will drift.
7. **Size.** The war code is 564 KB plus 35 KB of data plus 18 KB archived (about 1.2 MB with its tests) out of a 599 MB working tree. The download is big because of art, not code. Even deleting every retired picture would save only about 37 MB (6 per cent). So there is no size reason to delete art: **move it to `assets/extras/`** (as was done for the Smithy, the Gaming Hall and the old Arcane Study) and keep `bastion-new-art/` exactly as Harry uploaded it.
8. **Order of work:** 24 small steps, S00 to S23 (section 8). Replacement-before-removal throughout, so the suite is runnable and green after each one. The war removal (S06) is necessarily one large commit because `tool.js` calls war functions while it builds the screen (B proved this by experiment).
9. **Estimate (gross, section 9):** about **37,000 lines removed and about 13,000 added**, a net of about **minus 24,000** across code, tests and docs. Roughly half the removal is test code.

---------------------------------------------------------------------
## 1. Baseline measured today (so "green" means something)

| Check | Result |
|---|---|
| `tests/rules.html` (Chromium, `file://`) | **1,285 of 1,285 tests pass; 19,211 individual checks** (4,959 of them in one War AI test group, "legality, speed and whole battles", 4,373 in one test) |
| `tests/e2e/phase9.test.js` | 124 checks, **4 min 18 s** |
| `tests/e2e/bastion-days.test.js` | 16 checks, 28 s |
| every other e2e file | measured by a full sequential run, results in section 5.2 (`e2e-baseline/summary.txt`) |
| Working tree (no `.git`, no `_legacy`) | 599 MB; `.git` 634 MB; `_legacy` about 1 GB (never committed) |

Line totals today: Bastion code and data 31,399 (JS, CSS, data), Beast Handler 3,548, shared JS and CSS 6,661, rules tests 19,386, click-through tests 22,090, docs 10,593, `guide.html` 361.

---------------------------------------------------------------------
## 2. The save: where the version lives, and everything that reads it

### 2.1 The Bastion's records

| Key | Written by | Notes |
|---|---|---|
| `tsi.bastion.state` | the Bastion | The save. `v: 3` today. Loaded through `R.fromSave` (`rules.js:350-457`), which copies **only the fields it knows**; anything else is dropped on the next save. That is why a field cannot simply be removed from `fromSave` without first being dealt with. |
| `tsi.bastion.ui` | the Bastion | `{ gridOpen, whSort, warNoticed }` (`R.cleanUi`, `rules.js:1063`). `warNoticed` goes. |
| `tsi.bastion.crest` | the Bastion | Keep as is (`R.isCrest`). |
| `tsi.bastion.warMap`, `.warTable`, `.warTerrain` | the War Table | Go. `warMap` can hold an uploaded picture (megabytes). `R.importProblem` currently **refuses** a file whose three keys are malformed (`rules.js:1153-1155`). After the change they must be **ignored**, not validated, or an old backup would be refused. |
| `tsi.explorer.save`, `.mapImage` | the Explorer | No version field; `R.fromSave` of the Explorer tolerates unknown fields. One new optional field proposed by D: `journey.expedition.endedDay`. No migration needed (absent means null). |
| `tsi.dmdoc.layout`, `tsi.dmdoc.edits` | the DM doc | Layout needs a version number (D: the old 440 wide shape would reopen as a narrow box). Edits stay. |
| `tsi.dmdoc.quest` | the DM doc (new) | In the `dmdoc` family, so "Back up everything" and "Restore" carry it with **no change** (D checked). Not in the campaign file. A Restore of an older backup deletes it (restore replaces everything), worth one line in the guide. |
| `tsi.beasthandler.queue`, `.meetDraft` | the Beast Handler | Obsolete once the request protocol goes (H assumption A7). Delete at first open of the new Beast Handler. `.viewAs` stays. |
| `tsi.quarantine.bastion.state.<stamp>` | the migration (new entries) | In the `quarantine` family, so it is in "Back up everything". |

### 2.2 Every place that checks the version (all must change together)

| Where | Today | Change |
|---|---|---|
| `rules.js:139`, `:207` | `v: 2` literal, then `s.v = 3` | `v = 4` in `R.defaultState` |
| `rules.js:227-328` `R.migrateToV3` | returns early for `v === 3` (`:229`), sets `v = 3` (`:321`) and `migration.v3` (`:322`) | **Leave untouched**; its eight tests (`bastion.test.js:1282-1440`) call it directly and stay valid |
| `rules.js:353` `R.fromSave` | converts only `saved.v === 2` | chain: v 2 to V3, then any v below 4 (or a v 4 save with leftovers) to V4 |
| `rules.js:1035-1052` `R.saveProblem` | needs 4 of 7 "marks" (including `defenders`); lists damaged-field checks for war fields | marks list loses `defenders`; list and map checks lose every field that is dropped (an old file with a damaged war field must still import, because the field is ignored) |
| `rules.js:1055-1057` `R.isOldSave` | `s.v !== 2 && s.v !== 3 && ('turn' in s ...)` | cosmetic (a v 4 save has no `turn` key so it is never "old"), but update it so it reads true |
| `rules.js:1143-1158` `R.importProblem` | validates the three War Table keys | drop those three checks |
| `tool.js:84-93` | `migrating = saved.v === 2`: only then is a copy set aside | `saved.v < 4` or leftovers found |
| `tool.js:5660-5674` | one 30-second notice, `shown` flag set at once | a modal that stays until acknowledged (section 4.6) |
| `tool.js:5683-5685` `validateImport` | `ns.rules.importProblem(records)` | unchanged |
| **`shared/js/campaign-rules.js:52` `inDaysSave`** | `ba.v === 2 || ba.v === 3` | **`2, 3 or 4`**. If missed, `summary().orders`, `nextWord` and `ironbowNews` return nothing for every v 4 save, in the DM doc and in the Explorer's Make Camp pop-up, with no error |
| `tests/e2e/phase9.test.js:2737, 2749` | `state().v === 3` after converting a v 2 file | `=== 4` |
| docs | `BASTION-EXPLORER-REFERENCE.md` section 5.13 and header comments in `rules.js` | new `docs/BASTION-SAVE.md` (section 6.5) |

### 2.3 How v2 to v3 was done (the pattern to reuse)

- **Pure function on the raw save, before `fromSave` tidies it** (`R.migrateToV3`, `rules.js:227-328`): returns `{ save, lines }`, where `lines` are plain-English report lines.
- **A data table**, `bastion-data.js` `retiredFacilities` (`:133-141`): `{ old: { to, name, fns, legacy } }`. `to: null` means gone (recorded in `archivedFacilities`); a target that is a starting facility frees the slot; two halves of one merge keep the built one (else the earliest ready), the highest level, the latest repair; pending orders follow their facility with their ids, due days and costs, and `fns` renames an order id.
- **A report stored in the save**, `s.migration.v3 = { day, lines, shown }`, plus one Day Log line. The screen shows it once (`tool.js:5665-5670`).
- **A copy set aside first** (`tool.js:88-92`): `TSI.store.quarantine` moves the old record to `tsi.quarantine.bastion.state.<stamp>`, then the converted one is saved.
- **Idempotent**: a converted save comes back unchanged (`bastion.test.js:1436`).
- **Tested with the seven fixtures** in `tests/fixtures/` (v 2: `bastion-before-overhaul.json`; v 3: `-pr3`, `-pr5`, `-pr6`, `-pr7`, `-pr8a`, `-pr8b`).
- The earlier turn-to-day change (8 October 2026) was different: a save in Bastion turns is **set aside and never converted** (`R.isOldSave`, `tool.js:84-87`). Not repeated here.

### 2.4 Who reads the raw Bastion save without going through the Bastion

This is the part that is easy to miss. All of these read `tsi.bastion.state` directly (`TSI.store.fresh` / `get`) and so see **a v 3 save until the Bastion is next opened after the update**, then a v 4 save:

| Reader | What it reads | Must tolerate |
|---|---|---|
| `shared/js/dmdoc.js`, `shared/js/campaign-rules.js` (`summary`, `bastionComing`, `ironbowNews`) | `partyLevel`, `pendingOrders`, `politicalCapital`, `honourRespectByClan`, `favour`, `diplomaticRecords`, `dmEdits`, `diplomacy` arrays, `wars`, `warRecovery`, `tradeNetwork` | v 2, 3 and 4. For a v 3 save: **ignore** orders whose `facId` is a retired id (so the DM doc does not say "Your army is ready to march" for a War Action that the next open will cancel). Cheapest: a shared constant `TSI.campaign.RETIRED_FACILITIES` that `summary` and `bastionComing` filter on. |
| `tools/explorer/tool.js` (lines 1415-1440, 1560, 1745-1760) and `shared/js/bridge-rules.js` `B.portStatus` | `tradeNetwork.portCharters`, `parcels`, `pendingOrders` (matches on `fnId === 'register_port_charter'`, **not** on the facility), `partyLevel`, `creatures`, `greatRites` | Both Hall and Dock as the home of `register_port_charter`; v 3 and v 4 |
| `tools/beasthandler/tool.js:62` | `R.fromSave(TSI.clone(saved), data)` **in memory, on every read** | the migration must be a pure function with no storage calls (so the laptop copy gets a clean view without writing) |
| `shared/js/backup.js` | `TSI.importChecks.bastion` = `R.importProblem` (`rules.js:3425`) | an old campaign file is accepted and converted when the Bastion opens |

### 2.5 The campaign save group and the other validators

- `CAMPAIGN = ['explorer', 'bastion']` (`backup-rules.js:35`). Either tool's Export writes one `tsi-campaign-<date>.json` holding both tools' records; either tool's Import replaces both after `checkRecords` runs each tool's `importProblem` (the other tool's rules are loaded by each tool's manifest for that purpose: `shared/data/tools.js` Explorer entry lines 151-153 load `tools/bastion/rules.js`). **Consequence:** `rules.js` must keep loading cleanly in the Explorer with no war file present, and must never refer to a global that only the Bastion's own manifest provides.
- **Import and Restore write records raw** (`TSI.store.replace`, `backup.js:287, 347`). Nothing converts at import time; the Bastion converts at its next open. So Harry's old "Back up everything" files and old campaign files must remain *acceptable* (valid records, no refusal for removed keys) and *convertible*.
- A Restore with `{ all: true }` also brings back old orphan keys (`tsi.bastion.warMap` and friends). The Bastion's start-up must therefore move any orphan war keys to quarantine **every time it opens**, not only once (a cheap `if (store.has(k))` loop; cost nothing when absent).
- `TSI.storeRules.SUITE_FAMILIES` and `RESERVED_TOOLS` (`store-rules.js:20-24`) need no change: `dmdoc` and `quarantine` are already families.

---------------------------------------------------------------------
## 3. Every field of the Bastion save, and what happens to it

Source: `R.defaultState` (`rules.js:111-210`) and `R.fromSave` (`:350-457`) plus the fields added by other files (`beast`, `creatures`, `greatRites`, `bridge`, `dmEdits`, `diplomaticRecords`, `research`). "Owner" is the sibling report that designed the change.

| Field | Fate | Gold / goods safety | Owner |
|---|---|---|---|
| `treasuryGP` | kept; **only ever raised** by refunds and the one-off contract settlement | the treasury is never reduced | J |
| `partyLevel`, `day`, `anchored`, `word`, `dayInProgress` | kept (`dayInProgress.attackRolled` dropped; an unknown stage such as `war` already falls back to `orders`, `rules.js:417`) | | B |
| `builtFacilities` | vestigial: saved but never read (`R.builtFacilityIds` uses `startingBuilt`); reset to the new starting list (`workshop`, `dock`) | | A |
| `builtExtras` (construction slots) | each retired id is freed or merged: war family freed; `library_scriptorium`, `arcane_laboratory` freed (the Workshop is a starting facility); the three shrines become one `temple`; the three beast buildings one `beast_pit`; built beats building, else earliest ready (reuse the V3 merge logic, `rules.js:256-275`, extracted into a shared helper). **Ghost sweep:** any id the catalogue does not know is freed and its orders cancelled with refund | slots are free of cost | A, F, G, J |
| `builtPlots` | kept; same ghost sweep | | A |
| `facilityLevels` | retired ids deleted; `temple`, `beast_pit`, `hall_of_emissaries` set to 1 (single level); `workshop`, `dock` and the plot facilities untouched; **no free levels** for the Workshop | | A, F |
| `pendingOrders` | one disposition per order (keep, move, cancel with refund), table in section 4.3 | **gold, Favour and held goods all returned** | A, F, G, E, J |
| `defenders`, `defenderBeasts`, `military` | dropped. Counts and names go in the report. Menagerie beasts listed with what they cost | completed purchases are not refunded (question Q2) | A, B |
| `militaryActions`, `warMissions`, `warMissionSeq`, `warRecovery`, `wars`, `repairs`, `warLog`, `lastEvent`, `lastEventDay` | dropped (`repairs` only ever came from a lost Defend Bastion battle). Clans that were at war are named in the report | Honour/Respect and Political Capital already lost to declaring war are **not** changed (Q2) | B |
| `artisanTools` | dropped; the report names the tables the DM had chosen | | E |
| `legacyFacilities` (`smithy`) | dropped (the Smithing order is replaced by the Smith's list) | | E |
| `warehouse` | kept; returned goods added through `R.returnGoods` | goods never lost | J |
| `favour` | kept; `favourCost` of cancelled orders added back, capped at 100, **overflow listed in the report** | never reduced | F |
| `politicalCapital`, `honourRespectByClan`, `diplomaticRecords`, `dmEdits`, `bridge` (receipts), `research`, `word` | kept untouched | `bridge.done` receipts are the once-only guard for the Explorer link; losing one is "the one way a change could count twice" (`rules.js:526-530`) | B, F |
| `greatRites` | kept (keyed by `rite`, not by facility) | | F |
| `tradeNetwork.portCharters`, `.voyages`, `.schedules`, `.cargoSales`, `.marketLedger`, `.parcels` | **kept exactly** (they live inside the same object as the old consortium data, so the object cannot be cleared whole) | ships at sea and sales untouched | F |
| `tradeNetwork.protections.pelagos_blessing` | kept; `commercial_convoy` and `maritime_approaches` dropped (their buildings go; Q4 of A/F decides whether they are re-homed) | a held Convoy is a charge, not gold; reported | A, F |
| `tradeNetwork.active/strategy/stability/routes/highRiskRouting/yieldBonusPct`, `diplomacy.*`, `arbitration.queue` | the Hall's money engine. Wound down at migration with a **final settlement** (section 4.4, question Q1); then cleared | **remaining expected income paid once** | F, J |
| `organization`, `clanHonor`, `trustedClientsByClan` | dropped; a founded Clan's name seeds `partyName` once | | C |
| `partyName` | **new**, string, at most 40 characters, default `''` | | C |
| `creatures[]` | each housed one gets `home: 'beast_pit'`; `development` kept whole (training, harness, first flight stay as hidden history); bond 1 or more counts as acclimatised; over-the-limit beasts all kept | no beast is ever released | G |
| `creatures[].development.bonding`, `.acclimatise`, `.initiation` | **new, created lazily** the first time they are used; **the migration creates none and rolls no dice** (so it stays pure and repeatable) | | G, H |
| `beast` (`campaignId`, `accept`, `handlers`, `done`, `floor`) | `campaignId`, `handlers` (the pairing secrets) and `accept` kept; `done` (order-request receipts) and `floor` can go once the request protocol is gone (H assumption A7) | | H |
| `log` | dropped **last** (S19). Until then it keeps being written, so no step has to change 55 call sites and 32 test files at once | the old log is in the set-aside copy; the report offers it as a text file | B |
| `v` | 4 | | J |
| `migration.v4`, `archivedFacilities` | new report record `{ day, lines, summary, shown }`; archived entries appended for the facilities that stood | | A |

Fields **not** in the Bastion save but changed by this overhaul: the Explorer's `journey.expedition.endedDay` (D), the DM doc's `tsi.dmdoc.quest` and versioned layout (D), the Beast Handler's keys (section 2.1).

---------------------------------------------------------------------
## 4. The one migration (v 3 to v 4)

### 4.1 Where the sibling designs disagree, and what I settled

| Point | A / B / E / F say | G says | C says | Settled |
|---|---|---|---|---|
| Version-gated or version-free? | A, B, E, F: a v 3 to v 4 step in `fromSave` | G: version-free, detect old ids | C: tiny, sits in `fromSave` | **Both.** One entry point `R.migrateToV4` runs when `v < 4`. Each sub-step is idempotent and finds its own leftovers, and `R.stripBackLeftovers(s)` is checked on every load, so a v 4 save overwritten by an older copy of the suite (SUI-19) is cleaned again with a short notice. |
| Keep inert data for removed systems? | A: keep (`defenders`, `military`, `wars`...) "do not delete player data just because its panel is going". B: delete. C: keep `organization`. | | | **Drop from the live save, keep everything in the set-aside copy, and say so in the report.** Reasons: dead fields grow every backup and need cleaning code forever; the set-aside copy is complete and restorable; the report lists counts. The only inert survivals are creature `development.training/harness/firstFlight` (history inside a record that stays). |
| Refund the gold of orders the removal cancels? | A, F, G: yes (a deliberate departure from "Cancel keeps the gold", B9, because the player did not cancel). B: orders cost nothing for war. | | | **Yes.** All three agree and the brief requires it. |
| Hall contracts and routes still running | F: stop at migration (policy 1), alternative grandfather | | | **Final settlement** (pay the remaining expected income once, then end them). This keeps "never loses gold" true; F's policy 1 stops them with no payout. Question Q1. |
| `R.log` and the Day Log | B: delete `state.log` and `R.log` | G: notifications use the log too | | **Panel first, state last** (S10, S19). |
| Version of `migrateToV3` | E: re-point the v2-era ids straight at `workshop` | | | **Do not touch V3 or its table.** Its eight tests stay valid, the chain does the rest (v2 `library` goes to `library_scriptorium` in V3, then to the Workshop in V4). |
| Beast Handler `s.beast.done` | | | | dropped when the protocol goes (S13), not in the first version of the migration |

### 4.2 Shape of the code

```
R.migrateToV4 = function (raw, data) → { save, report }
   report = { lines: [plain English], gold: { refunded, settlement, items:[{label, gp}] },
              favour: { telluria, aurush, pelagos, lost:{...} },
              goods: [{name, qty}], cancelled: [{label, why}], moved: [{label, to}],
              removed: { defenders, beasts:[{name, qty, value}], regiments, lieutenants, ... },
              notes: [...] }
```
- Pure: no storage, no clock beyond the Bastion's own `day`, no `Math.random`, no dice.
- Runs on the **raw** save before `R.fromSave` tidies it (like V3), so it can still see the fields that `fromSave` is about to drop.
- Sub-steps, in this order (each is a small function in `rules.js`, or in a new `tools/bastion/strip-back-rules.js` that the Beast Handler laptop copy and the Explorer's import check also load, so there is one place to read):
  1. `sweepFacilities` (slots, plots, levels, repairs, ghost ids)
  2. `settleOrders` (the table in 4.3: keep, move, cancel with refund)
  3. `windDownHall` (contracts, routes, disputes, tokens; final settlement)
  4. `dropWar` (all war and army fields; list what was there)
  5. `rehomeBeasts` (creatures to the Pit; keep development)
  6. `identity` (`partyName` from a founded Clan once)
  7. `workshop` (`artisanTools`, `legacyFacilities`)
  8. `finish` (`v = 4`, `migration.v4`, `archivedFacilities`)
- Each later step in the work order (section 8) adds or fills in its own sub-step; S01 ships the shell with `sweepFacilities` and the audit, so every later commit only adds a function and its tests.
- The data lives in `bastion-data.js` `stripBack = { facilities, orders, names, menagerieValue }`: names of retired facilities (for the report, after their definitions are deleted from `facilities-data.js`), the disposition table, and the 13 Menagerie prices (so the report can say "a Tiger, bought for 1,000 gp").
- **The Beast Handler laptop copy and the Explorer call `R.fromSave`/`importProblem`**, so the file must load in both manifests (`shared/data/tools.js`) and in `tests/rules.html`.

### 4.3 Pending orders: one rule for each (consolidating A, E, F, G)

An order carries `costGP` (taken when it was issued), `favourCost` (taken from the god's bar when it started), `inputs` (goods set aside from the Warehouse) and its `id`, `issuedDay`, `dueDay`. The migration keeps an order's **id, due day and chosen item** whenever it moves.

| Order at | Action | Refund |
|---|---|---|
| `workshop.*`, `dock.*`, plot facilities, `courier_exchange`, Herbal Gardens | keep | none |
| any `upgrade` order at a facility that stays | keep | none |
| `barracks.*`, `watchtower.*` (Recruit, Convoy, Patrol, Approaches) | cancel | `costGP` (normally 0) |
| `armoury.arm_defenders` | cancel | `costGP` (100 + 100 per defender) |
| `war_room.recruit/drill/coordinated_muster/grand_muster` | cancel | `costGP` (a drill: 25 or 50 gp x Battle Value) |
| `war_council` / `meta.kind === 'war_action'` | cancel | none (its cost was Honour/Respect and Political Capital, already applied, Q2) |
| `menagerie.recruit_beast` | cancel | `costGP` (50 to 3,500 gp) |
| `library_scriptorium.research`, `.prepare_overland_travel_charts` | **move** to the Workshop's Scholar orders | none |
| `arcane_laboratory.craft_common/craft_uncommon/alchemy` | **move** to the Workshop's Alchemist orders (keep `chosen.craftItem`) | none |
| any `upgrade` at a facility that is merged away | cancel | none (free) |
| `shrine_*.pray` | option 3 (the Favour prayer) **moves** to `temple.pray_<god>`; options 1 and 2 (hint, long rest) cancel | none |
| `shrine_*` blessings and Great Rites that survive in the Temple's list | **move**, keeping `favourCost` paid | none |
| `shrine_*` orders that do not survive (Craft, dropped blessings) | cancel | `favourCost` back to the bar (cap 100), `inputs` back to the Warehouse |
| `hall_of_emissaries.register_port_charter` | **move** to `dock.register_port_charter` | none |
| `hall_of_emissaries.host_delegation/inter_clan_summit/arbitration_authority/trade_consortium/secure_trade_agreement` | cancel | `costGP` (150, 450, 600, 900, 250) |
| `trade_network.upgrade` (Stability 75 gp, Yield 90 gp) | cancel | `costGP` |
| `wyvern_roost/griffin_tower/dire_wolf_den.house_*` | **move** to `beast_pit.house_beast` (`chosen` keeps the creature id; label rewritten) | none |
| `…` training orders (`trains`) | cancel | `costGP` (the 150 gp Riding Harness only) |
| a facility id the catalogue does not know | cancel | `costGP`, `favourCost`, `inputs` |

Cancel always: remove the order, add `costGP` to `treasuryGP`, add `favourCost` to the god's bar (cap 100, overflow reported), call `R.returnGoods(s, data, o.inputs)`, add one line to the report with the order's saved `label`. (`R.cancelOrder` and `R.demolishFacility` keep their own rule "no refund", B9, for the DM's own choices.)

A moved order must still **complete** after it moves. E proved the engine completes an order whose function is still present in the data; so the moved-to functions (Scholar, Alchemist, Temple, Pit) must exist in the data **before** this sub-step ships, and a moved order must complete even if the new home's level is lower than the old home's (the order is already paid).

### 4.4 The Hall's running money (decision needed, question Q1)

`R.tickDiplomacy` (`rules.js:2784-2823`) pays `income` every 7 days from each contract (`agreements`, `arbitrations`, `consortiums`) straight into the treasury, and `R.settleRoute` (`:2878-2920`) pays a route's `yieldGP` each sailing, with a typed d20 in the day's flow for high-risk routes and a dispute for a bad failure (`R.enqueueDispute`). With Resolve and the Council Ledger gone, neither can run unattended: an old route that rolls badly would file a dispute nobody can judge.

- **Recommended (default for Q1): final settlement.** At migration, for every contract `income x R.shipmentsLeft(rec, every)`; for every live route `R.routePayout(s, r, 'success') x` the sailings left before `expiresDay`. Add the total to the treasury **once**, put each line in the report, then clear `diplomacy`, `arbitration`, `tradeNetwork` legacy fields. Expected values only (no dice), so the migration stays pure.
- Alternative (c): end them with no payout (F's policy 1). Simplest and loses expected future income; not "never loses gold".
- Alternative (b): let them run to their natural end with no screen. Keeps about 300 lines of rules and the daily typed d20; not recommended.
- Either way: **cooldowns, Summit discount, Favour Tokens, disputes** simply end (no gold value) and the report says so.

### 4.5 The guarantees, and how they are tested and enforced

`R.stripBackAudit(before, after, report)` returns a list of problems (empty when fine). It is used three ways: in every migration test, in a property test over generated saves, and at run time before anything is written.

| # | Invariant |
|---|---|
| I1 | `after.treasuryGP === before.treasuryGP + report.gold.refunded + report.gold.settlement`; every pence is itemised in `report.gold.items`; never lower |
| I2 | Warehouse after = Warehouse before + returned `inputs` (by good id and quantity; typed rows untouched) |
| I3 | Each god's Favour after >= before; after = min(100, before + refunds); any overflow is in the report |
| I4 | Every pending order before is accounted for once: kept (same id), moved (same id, new place) or cancelled (listed with why). The three counts add up |
| I5 | Creatures: same ids, same count, same `status`; `development` deep-equal except nothing; only `home` changes |
| I6 | Deep-equal before and after for: `bridge`, `dmEdits`, `diplomaticRecords`, `politicalCapital`, `honourRespectByClan`, `greatRites`, `research`, `word`, and `tradeNetwork.{portCharters, voyages, schedules, cargoSales, marketLedger, parcels, protections.pelagos_blessing}` |
| I7 | Idempotent: `migrate(toSave(migrate(x)))` equals `migrate(x)`; loading twice gives the same save |

**Fail closed.** If the audit finds a problem at run time, the Bastion does **not** write, does **not** set anything aside, and opens a small page: "The Bastion couldn't be converted safely. Nothing has been changed. Download your Bastion as a file" (the raw record as JSON). This costs about 40 lines and removes the worst case.

**Copy first, then write.** New `TSI.store.keepCopy(key, reason)` writes `tsi.quarantine.bastion.state.<stamp>` while leaving the live key alone (and returns when both are in the batch to be flushed); only then is the converted state written, and the same flush covers both. Today's `quarantine` deletes the live key first (`store.js:477-480`), so a crash in the few milliseconds before `save()` leaves no live Bastion at all (it would start a fresh one on the next open). Also stops the Explorer and DM doc seeing "no Bastion" for a moment, which they read every 2 seconds.

### 4.6 What Harry sees (plain English, and how it is kept)

On the first open after the update the Bastion shows **one box that stays until he presses "I've read this"**, not a 30-second corner notice (the flag `shown` is set only when he presses it, so a closed window shows it again). Headline first, then grouped lines. Draft (UK English; numbers filled in from the report):

> **The Bastion has changed.** Here is exactly what happened to yours.
> **Gold.** 1,350 gp went back into the treasury (it was 2,000 gp, it is now 3,350 gp): Armoury, Arm Defenders, 300 gp; Menagerie, Recruit Beast (Tiger), 1,000 gp; Riding Harness for the griffin Swiftwing, 150 gp. **Trade.** Your running Trade Agreement with Clan Karr and your sea route to Clan Molten were paid out in full as one final amount of 420 gp and then closed. **Favour.** Pelagos got 10% back.
> **Goods.** 3 lots of Raw Timber were returned to the Warehouse.
> **Places that are gone.** Barracks, Armoury, Watchtower, War Room, Menagerie. Their orders were cancelled (listed above).
> **Places that joined others.** The Library & Scriptorium and the Arcane Laboratory: their jobs now belong to the Workshop's Scholar and Alchemist. The three Shrines became one Temple. The Wyvern Roost, Griffin Tower and Dire Wolf Den became one Beast Pit; your 3 beasts are all still there with their names, handlers, bonds and notes.
> **The army and the war.** 6 defenders, 2 giant vultures (bought for 2,000 gp) and 4 regiments are gone with the War Council. Clan Bacca was at war with you; the Honour/Respect and Political Capital you had already lost are unchanged (use Change a score in the DM doc if you want them back).
> **Your Party.** Your Clan, Clan Ironbow, is now just your Party Name; its chief and motto are not kept.
> A copy of your Bastion exactly as it was is saved in "Back up everything". Don't open an older copy of the suite on this laptop afterwards: it would not understand this save.
> [Save this as a text file] [I've read this]

- The same text stays readable later through a **"What changed"** button in the Management panel (`migration.v4.lines`), and "Save this as a text file" uses `TSI.download`.
- The report is also the place for the old **Day Log**: offer "Save the old Day Log as a text file" (about 25 lines), since that is the only on-screen history of what happened, and the panel is going.
- Lines are built by the migration (pure), so a unit test can read them for jargon: no "undefined", no ids such as `war_room`, plural/singular right, every cancelled order named by its saved label.

### 4.7 Edge cases to test (each one a named test)

1. A fresh Bastion (no save): no migration, no box.
2. A Bastion with nothing to convert except version: bump silently, short one-line box ("the Bastion has been updated; nothing of yours changed").
3. Pending order whose `inputs` name a good the data no longer has: returned as a typed row, not lost.
4. Favour refund that would pass 100: capped, overflow in the report.
5. Two shrines built and one still building; Roost built and Tower building: built wins; the building one stops; free slot.
6. Creatures but no beast building left standing (demolished earlier, creatures stayed): creatures re-homed to a Pit that is **not built**, so they would be invisible. Default: the migration builds the Pit **free, in the first empty slot**, and says so (a Pit costs time, not gold; this only fixes visibility).
7. Over the limit: two griffins housed. Both kept; the report says no more griffins can be housed.
8. A beast mid-pending-House order: order moved; creature stays `waiting`.
9. `dayInProgress` part-way (cancelled roll) with a skipped war or Hall order: skipped list tidied; day resumes.
10. A save at `v 4` with a leftover (older copy overwrote): cleaned with a short box.
11. A damaged field in a dropped list (`military: 'x'`): ignored, not refused.
12. A v 2 file (Harry's oldest backup): v 2 to V3 to V4 in one go; report holds both change lists.
13. Reset Travel after migration: new absolute-day fields (`partyName` none; `migration.v4.day` is history).
14. The Beast Handler laptop copy calls `R.fromSave` on a v 3 save: same output, no writes.
15. Explorer open while the Bastion migrates: Explorer's 2-second read never sees an empty Bastion (copy first).
16. Import of a v 3 campaign file into the new suite, then Bastion opens: converted once, report once.
17. The same v 3 file imported twice: the second import is converted again from its own older state (it does not double-refund, because refunds are computed from that file).

### 4.8 Test assets for the migration

- Keep the seven fixtures: they already cover Library, Arcane Lab, one Shrine, three Shrines (Favour 60), Roost/Tower/Den, War Room with 4 regiments, Hall + Dock with charters, Courier Exchange, and one v 2 file. **None of them has a pending order at a retired facility, a creature, a war, a contract or a log of any size** (checked today), so they cannot show refunds or re-homing.
- Add **one generated "heavy" fixture**, `tests/fixtures/bastion-v3-heavy.json`, made by a small Node script (`tests/fixtures/make-heavy.js`, runs the real `R.defaultState` and fills every field): all 13 retired facilities built or building across slots, 10 pending orders (each of 4.3's rows, each with gold, Favour and inputs), 3 beasts at different bonds with development, 2 contracts + 1 consortium + 2 routes + 1 dispute + tokens, a war in force against one Clan, 4 regiments, 2 Menagerie beasts, defenders armed, `artisanTools` chosen, a founded Clan, a 200-line log, a Great Rite, a held Pelagos blessing, charters with terms history, a ship at sea, a standing shipment, parcels. Plus a `tests/fixtures/README.md` line.
- The heavy fixture also feeds the e2e test (open on the test page, check the box, numbers and tiles).
- Optional and private: ask Harry for an export of his real campaign and run the migration on it (kept out of the repo). Not required for the PR.

---------------------------------------------------------------------
## 5. Tests: what exists for removed things, and what happens to each

Method: I ran `tests/rules.html` headless with a wrapper that records the number of individual checks (`t.ok/equal/same/throws`) in every test, mapped each test group back to its file (`rules-by-group.json`), and assigned each group a fate by reading its test names. Group-level, so a few mixed groups are rounded; counts are accurate to a handful of tests. The click-through counts are from a full sequential baseline run today.

### 5.1 Rules tests (`tests/rules/*.test.js`, loaded by `tests/rules.html`)

Totals today: **1,285 tests, 19,211 checks, 36 files.** Fate by test count (checks in brackets):

| Fate | Tests | Checks |
|---|---|---|
| Delete (the feature is removed) | 458 | 7,792 |
| Rewrite (feature stays in a new form) | 219 | 1,693 |
| Edit lightly (shrines-explorer, dmdoc, bridge, diplomacy, session-safety) | 8 | 62 (plus a few lines in 5 more files) |
| Keep as they are | 600 | 9,664 |

| File | Tests / checks | Fate | Notes |
|---|---|---|---|
| `bastion-battle.test.js` | 132 / 975 | **delete file** | the battle engine |
| `bastion-campaign.test.js` | 123 / 957 | **delete file** | Military list, committing forces, missions, Military Action, after-battle, recovery, wars, Defend Bastion, Under Repair, stat blocks, and the 9 War Room regiment tests. B asked "check nothing non-war hides here": all 12 groups are war |
| `bastion-war-ai.test.js` | 61 / 4,959 | **delete file** | one group alone ("legality, speed and whole battles", 5 tests) is 4,373 checks, so the rules page also gets noticeably quicker |
| `bastion-war-table.test.js` | 48 / 400 | **delete file** | |
| `beast-bonding.test.js` | 21 / 102 | **delete file** | griffin and dire-wolf training and riding programmes |
| `wyvern-bonding.test.js` | 28 / 134 | 9 delete (riding), 19 rewrite | what survives is bond, handler, temperament, Chronicle, save/reload, rename: fold into the new `beast-pit.test.js` |
| `bastion.test.js` | 121 / 1,117 | **32 delete (181)**, **60 rewrite (658)**, 29 keep (278) | delete: "the Hall of Emissaries" (12), "trade routes" (3), "the Council Ledger" (2), "identity" (4), "war" (3), "the Military Action" (8). Rewrite: content (5), orders (8), completing orders (7), passing a day (8), events and Compendium (2), goods and production (13), Stone Quarry and Weavers (5), saving (9), crest and War Table saves (3). Keep: construction (6), facility levels (4), research (6), **v 2 to v 3 (8)**, Development Plots (5) |
| `creatures.test.js` | 45 / 347 | 9 delete ("defending the Ironbow on the War Table"), 36 rewrite (291) | keep the grant message, release, rename, clean/save and Reset Travel checks (G) |
| `commerce.test.js` | 77 / 653 | 6 delete (Barracks and Watchtower protections), 8 rewrite (Hall registers a charter; the old trade), 63 keep | the Pelagos blessing tests move to the Temple |
| `beasthandler-projection.test.js` | 28 / 146 | 13 delete (orders, building lock, Under Repair, harness never offered), 8 rewrite, 7 keep | the leak tests (no treasury, log, DM notes) are the safety net: **adapt, never drop**. Add one for `tsi.dmdoc.quest` (D) and for `partyName` (C) |
| `beasthandler-link.test.js` | 34 / 233 | mostly rewrite; ~27 about applying requests, receipts, building lock and forged requests go (H lists them by line) | |
| `beasthandler-model.test.js` | 18 / 128 | rewrite | pills now have a fill |
| `beasthandler-tables.test.js` | 8 / 63 | rewrite | five kinds, Blacktide as a sixth wolf, Buckbear and Fellcat tables |
| `beasthandler-profile.test.js` | 7 / 58 | rewrite | dice and tables stay; typed-text checks stay only if the DM still types |
| `beasthandler-codes.test.js` | 6 / 32 | rewrite | depends on the QR decision |
| `campaign.test.js` | 17 / 102 | rewrite | `summary` shape for the new DM doc; `bastionComing` loses war, event, Hall-action, creature-recovery lines |
| `session-safety.test.js` | 15 / 82 | 3 rewrite (what a level unlocks), 12 keep | |
| `shrines-explorer.test.js` | 8 / 62 | edit | `shrine_*` ids become `temple`; the Great Rite logic is unchanged |
| `diplomacy.test.js` | 9 / 64 | keep | Hall records; Day Log assertions change at S19 |
| `bridge.test.js` | 46 / 197 | keep | one test deleted ("a War Action cancelled the same day gives back its own cost"); wording changes |
| `dmdoc.test.js`, `dmdoc-edits.test.js` | 16 / 61, 6 / 35 | keep, edit | `defaultRect` is pinned at 440 x 800 (`dmdoc.test.js:16-24`); add Quest tests |
| everything else (crest, pelagosi, quests, ritual, arenas, encounter, explorer, explorer-journey, fights, core, lifecycle, store-rules, backup-rules, hmac, courier) | | **keep** | no change |

Why "keep" matters: `store-rules`, `backup-rules`, `lifecycle` and `core` are the safety net for the migration's helper (`keepCopy`), the family keys and the clean shutdown of every new screen (CLAUDE.md: stop timers and listeners).

### 5.2 Click-through tests (`tests/e2e/*.test.js`, Playwright over `file://`)

Baseline (every file, run sequentially, today): see `e2e-baseline/summary.txt`. Counts below are "All N checks passed".

E2E_TABLE_PLACEHOLDER

### 5.3 Tests to add (with rough sizes)

Rules page:
| New file | Tests | What |
|---|---|---|
| `strip-back.test.js` | ~45 | every item of 4.2 to 4.7; the seven audit invariants over all fixtures plus the heavy one; property test over 200 generated saves (seeded); the report's wording |
| `beast-pit.test.js` | ~35 | cap per kind, Elara once, House Beast Here, acclimatise pass/fail/lock, take out/return, the day tick scenarios of G section 2.4 (including Reset Travel shifting every new day field), confirm milestone and carry-over, handler rules, cleaner keeps fields |
| `temple.test.js` | ~15 | data-driven god (no `favour['']`), Pray adds 1d20, Receive Blessing locked until 100, spends the whole bar, three blessings per god |
| `workshop-staff.test.js` | ~14 | staff open by level, one job per staff, lists and days, moved Library and Laboratory orders complete once |
| `dev-facilities.test.js` | ~12 | each of the four shows only its level's order(s); a replaced order is refused; a pending order completes after an upgrade; Cancel returns inputs once |
| `party-name.test.js` | ~8 | clean, 40 characters, seeded once from a founded Clan, never re-seeded after clearing |
| `dmdoc-quest.test.js`, `doc-text.test.js` | ~14, ~10 | key, cap (200,000 characters), merge by `at`, clean-up, DOCX/PDF text extraction without a browser |
| `beasthandler-initiation.test.js`, `beasthandler-bond.test.js` | ~12, ~8 | fixed variety, even pick across faces, set once, DM lines kept, never touches bond; pill fill |
| `static.test.js` (or Node script) | 4 | see 5.5 |

Click-throughs: `migration-v4` (about 14 checks, section 7.3), `beast-pit` (~20), `temple` (~12), Workshop staff and Development facilities (about 10, inside `bastion-screen`), Dock with charters and Routes (~10, inside `commerce`), DM doc rewrite (about 16) and DM doc import (~8), Beast Handler Bond page and reveal (~25 across the rewritten files), guide stale-words (+1). Every new screen gets the layout check at **1707 x 930 (ratio 1.5) and 1920 x 1080 (ratio 1)** (CLAUDE.md), plus the existing full-screen and 1280 x 720 sizes the repo's `helpers.js` offers.

### 5.4 Keeping the suite green step by step

- **Add a one-line gate for the rules page** (`tests/run-rules.js`, 30 lines, the wrapper I used) so a step can be checked in about 20 seconds instead of through `phase1.test.js` (which opens `tests/rules.html` at line 1653 but takes minutes).
- **A deleted test file also loses its `<script>` tag** in `tests/rules.html` in the same commit; likewise a deleted source file loses its tag in `tests/rules.html`, `shared/data/tools.js` (Bastion entry lines 82-120, Beast Handler 194-227), `beasthandler.html`, and, for the war test page, the whole `tests/war-table.html`.
- **Replacement before removal** (section 8): move what must survive (Explorer delivery list, Resolve results, Favour bars, Port Charter box) to its new home and switch the tests to it **before** deleting the old panel.
- Tests that read the Day Log (`state().log`, `open-log`) or the Clan Influence list (`[data-test=bridge-row]`, `open-influence`) are many (B counts 18 click-through files and 14 rules files). Switch the e2e ones to the new Explorer-deliveries list at S02; switch the `b.log` assertions only at S19, mechanically.
- **Test pages:** `tests/harness.html` loads `tools.js`, so it follows the manifests by itself; `tests/rules.html`, `beasthandler.html` and `tests/pin-check.html` (mentions `pc-`) are hand-written lists.

### 5.5 Two cheap checks that catch what the existing tests cannot

1. **Static check** (a Node script, no browser): (a) every file in every manifest exists and every non-test script in a tool folder is listed somewhere; (b) every `asset('...')`, `url(...)` and `src:` path under `tools/bastion` points at a file (the e2e "missing file" log only sees pictures that a test actually causes to load); (c) a **denylist of retired ids** (`war_room`, `shrine_`, `wyvern_roost`, `griffin_tower`, `dire_wolf_den`, `library_scriptorium`, `arcane_laboratory`, `barracks`, `armoury`, `watchtower`, `menagerie`) is absent from code and data outside `stripBack`, the migration, `bastion-data.js` `stripBack`, tests and docs.
2. **Stale words in the guide and the home screen:** `guide.test.js` only checks that each bold word appears *somewhere* in `tools/<id>/` (comments and data included; read `guide.test.js:140-160`). After the war code is deleted, "War Council" may still sit in a comment, so the test would pass with a guide that still describes it. Add: no mention of *Day Log, Clan Influence, War Council, Menagerie, Barracks, Armoury, Watchtower, War Room, Library & Scriptorium, Arcane Laboratory, Shrine of, Wyvern Roost, Griffin Tower, Dire Wolf Den, Artisan Tools, Form Clan, Council Ledger, Host Delegation, Trade Consortium, Bastion Events* in `guide.html` or in the Bastion and Beast Handler `desc` lines of `shared/data/tools.js`.

---------------------------------------------------------------------
## 6. Docs, the guide, the home screen, PROGRESS and KNOWN_ISSUES

Counts are lines that mention a removed thing (Menagerie, War Room/Council/Table, Library, Laboratory, Armoury, Watchtower, Barracks, Shrine, beast buildings, Day Log, Clan Influence, Favour of the Gods, Bastion Events, Artisan, Council Ledger, Host Delegation, Consortium, Summit, Trade Agreement, Form Clan, Party Identity, defenders, regiments, Lieutenants, At War, Under Repair).

### 6.1 Document by document

| Document | Lines (mentions) | What to do | Step |
|---|---|---|---|
| `CLAUDE.md` | | **Not touched by a session.** If Harry approves the phone relay (H's Q5), the amendment to ground rule 2 and the second public config file must be **Harry's own wording**. The "Current phase: faithful rebuild" paragraph is already superseded for this PR by his handover; he may want to restate it. | |
| `README.md` | 20 (0) | nothing | |
| `docs/PLAN.md` | 802 (26) | tool-list wording; one line saying the Bastion was stripped back on 22 October 2026 and where the plan now lives | S22 |
| `docs/PROGRESS.md` | 1,146 (157) | see 6.3 | S22 |
| `docs/KNOWN_ISSUES.md` | 3,535 (284) | see 6.2 | per step, finalised S22 |
| `docs/ASSETS.md` | 527 (41 rows) | see section 7.2 | S20 |
| `docs/BASTION-EXPLORER-REFERENCE.md` | 1,942 (198) | **Banner "describes the code as of 12 October 2026; the Bastion was stripped back on 22 October (see docs/BASTION-SAVE.md and docs/STRIP-BACK-PLAN.md)"** and patch only sections 5.3 (facility table 847-880), 5.7 to 5.13 (Favour, Clan Influence, Hall and trade, war 1225-1415, events 1416-1442, word 1443, saves 1460) and 6 (map facility list 1878-1886). It is already stale for PR 5 to 9 and the Beast Handler, so a short new schema document (6.5) is worth more than patching 700 lines. | S22 |
| `docs/BASTION-OVERHAUL.md` | 389 (87) | banner "partly superseded: Build 3's Form Clan and the War Council lock are gone"; section 4 and 3 | S22 |
| `docs/FACILITIES-OVERHAUL-PLAN.md` | 339 (47) | banner; correct line 151 ("War Room ... KEEP (protected)") with "removed 22 October 2026 at Harry's request" | S22 |
| `docs/BASTION-MAP-ART.md` | 148 (32) | which overlays are retired; which new ones are needed for the Temple and the Pit (A's Q9) | S20 |
| `docs/WAR-RULES.md` (388), `docs/MILITARY-DIPLOMACY-PLAN.md` (212, section 1 is War Room, section 2 the Hall's records which **stay**), `docs/specs/war-room-training.txt` (216) | | `git mv` into `docs/archive/` (new folder) with a one-line banner "removed with the war game on 22 October 2026; last working code is at tag `before-strip-back`" | S06 |
| `docs/specs/griffin-dire-wolf-development-proposal.md` (95), `beast-handler-proposal.md` (239, sections 5 to 8 and decisions D2 to D5 obsolete), `hall-of-emissaries-redesign.txt` (357; its "do not erase historical contracts or income" guardrail is the thing the new migration answers) | | banner "superseded by the Strip Back Overhaul"; do not rewrite history | S22 |
| `docs/PHONE-PAGE.md` | 91 (1) | rewrite: read-only app, QR pairing, the new file list (`assets/buckbear/`, `assets/fellcat/`, new data files), no request codes; its line 91 "not part of the plan you approved" becomes the plan | S18 |
| `docs/LEVEL-9-10-READINESS.md` | 61 (10) | banner (war and Clan items obsolete) | S22 |
| `tests/e2e/README.md` | 67 lines, about 20 paragraphs | remove the descriptions of `war-room`, `war-table`, `wyvern-bonding`, `beast-bonding`, `beasthandler-write`; rewrite `bastion-screen`, `creatures`, `shrines`, `beasthandler*`, `dmdoc*`, `phase9`; add `migration-v4`, `beast-pit`, `temple`, `static` | each step, finished S22 |
| `licences/README.md` | 41 (1) | PDF.js is now used by the DM doc as well as the Combat Tracker (README line "Only the Combat Tracker loads them"); a row for any vendored QR library | S17, S18 |
| `tests/fixtures/` | | a line in a new `README.md` for the heavy fixture and how it is made | S01 |
| **new** `docs/STRIP-BACK-PLAN.md` | | the order of work, decisions made (with Harry's answers) and a status line per step, so a later session can pick up | S00, kept current |
| **new** `docs/BASTION-SAVE.md` | | the v 4 schema (section 3 of this report), the migration history v2, v3, v4, the "unknown fields are dropped" trap, how to add a field safely (add to `defaultState` **and** `fromSave` **and** `saveProblem` if it must be an object, and test "loading twice") | S01, kept current |
| **new** `docs/PHONE-LINK-SETUP.md` | | only if the relay is approved: step by step, no jargon, checked against the live console | S18 |

### 6.2 KNOWN_ISSUES: ids to reserve (so parallel sessions do not collide)

Highest used today: `BAS-98`, `SUI-52`, `EXP-45`, `BH-05`. The file's rule: one-line before/after per fix and per bug left alone. Reserve:

| Id | Entry |
|---|---|
| BAS-99 | Strip Back Overhaul: overview, restore point (`before-strip-back`), and the **list of entries now history** (below) |
| BAS-100 | The war game and its five facilities removed (War Room, Armoury, Barracks, Watchtower, Menagerie) |
| BAS-101 | Bastion Events removed |
| BAS-102 | Clan Influence, Favour of the Gods and Day Log panels removed (what moved where) |
| BAS-103 | The Hall reduced to Clan Relations and Diplomatic Records; single level |
| BAS-104 | The Dock takes the Port Charter system and the Routes map |
| BAS-105 | The Temple (three Shrines merged; whole-bar blessings) |
| BAS-106 | The Beast Pit (one of each kind; Acclimatise; away and back; days bond) |
| BAS-107 | Workshop staff replace the Artisan Tools |
| BAS-108 | Development facilities: one order per level |
| BAS-109 | Form Clan removed; Party Name added |
| BAS-110 | The v 4 conversion: what it did to gold, Favour, goods, orders, beasts |
| BAS-111 | Voyage protections from the Barracks and Watchtower |
| SUI-53, SUI-54, SUI-55 | DM doc overhaul; Quest box and imports; static and stale-word checks |
| EXP-46 | Expedition end day; the five kinds in "Grant a creature" |
| BH-06 to BH-09 | Request protocol removed; fixed varieties "until further notice"; QR pairing; relay (if built) |

**Entries that become history** (add one `Status: removed in the Strip Back Overhaul` line to BAS-99 rather than editing 50 entries): `BAS-06, 15, 16, 21-24, 26, 27, 29, 32-35` (Hall, Library, Shrine details), `BAS-41-59` (war: nineteen entries), `BAS-66-68` (Brigade, Party Identity, Build 3), `BAS-89-96` (Library charts, creatures, War Room, Shrines), `SUI-46-50` (protections, Hall order, Roost/Tower/Den bonding), `BH-04` (building lock), parts of `SUI-21/22/23/38/39` (DM doc layout) and `BH-01, 02, 05`. That is about 45 BAS, 5 SUI and 4 BH entries. The summary table at the top (BAS 23 / 2 / 47 / 25 / 1) is "worked out from the entries": add a line "entries from BAS-99 on are counted separately".

### 6.3 PROGRESS.md

- "Where things stand" (lines 3 to 7) is one paragraph of several thousand words. Replace with a short summary and a pointer to the "Done" list.
- "Done": a new entry at the top for this PR (Harry's checklist is given at the end of the session, per CLAUDE.md). Old entries stay as history.
- "Next" (lines 958 to 978) still says "Harry tries Build 3"; replace.
- "Open questions for Harry" (979 to 1,110, 131 lines): close the ones answered on 21 October and list this PR's.
- "Notes for future sessions" (1,111 to 1,146): the rule "Never let a request type do more than `profile.set`..." and the facility architecture notes change.

### 6.4 `guide.html` (361 lines) and the home screen

| Section | What |
|---|---|
| `#bastion` (lines 193 to 262, 36 KB, 57 list items, **35 of them name a removed thing**) | rewrite about 70 per cent: top bar and buttons (now Warehouse, Management), the facility grid (nine facilities plus Temple and Pit), orders, the new Dock (Port Charters, Routes), the Hall (Clan Relations, Diplomatic Records), Temple, Beast Pit, Workshop staff, development facilities, Party Name, "The Ironbow sends word", and delete the war, Day Log, Clan Influence, Favour, Form Clan and Menagerie paragraphs |
| `#beasthandler` (lines 293 to 306, 13 items) | rewrite: read-only app, three tabs (Profile, Bond, Chronicle), the reveal, QR pairing; remove Orders, Send request, Edit or roll |
| `#explorer` (lines 263 to 282) | creatures (five kinds, Beast Pit), Shrines become Temple, Port Charters registered at the Dock, expedition end |
| DM doc paragraph (line 120) | rewrite for four panels, Quest box, imports |
| `#saving` (lines 140 to 158) | one new bullet: after the update the Bastion shows a box listing what changed; a copy of the old Bastion is in Back up everything; do not open an older copy of the suite afterwards |
| `#tools` intro and contents (lines 91 to 111) | check names |
| `shared/data/tools.js` line 80 | Bastion: "Manage facilities, orders, events, treasury and staff for your bastion, day by day with the Explorer." becomes "Manage facilities, orders, trade and the treasury of your bastion, day by day with the Explorer." |
| `shared/data/tools.js` line 189 and comment 187 | Beast Handler: "...See your wyvern, griffin or dire wolf..." becomes the five kinds and "bond tracker"; "keeps only the small queue of requests" goes. The card's phase code (`BH-1`, pinned by `phase1.test.js:22`) may stay |
| The Crest Creator | "Clan Crest Creator" and its "Clan/Party Name" field (C) are not in the handover; leave unless Harry says |

### 6.5 `docs/BASTION-SAVE.md` (new; the schema document nobody has written)

Contents: the field table in section 3, the version history (v 2 days overhaul, v 3 facilities overhaul, v 4 strip back), where each cleaner lives (`R.cleanCreatures`, `R.cleanDevelopment`, `R.cleanBridge`, `R.cleanCommerce`, `R.cleanCourier`, `R.cleanDiplomaticRecords`, `R.cleanDmEdits`, `R.cleanGreatRites`, `R.cleanBeast`), the rule "a top-level field that `R.fromSave` does not list is dropped on the next save", "rules that the Explorer's import check loads must not need a Bastion-only global", and the migration report format. A short note for future sessions in `PROGRESS.md` should point to it.

---------------------------------------------------------------------
## 7. File size and clean-up consequences

### 7.1 What is deleted (code, data, tests)

| Group | Files | Lines | Bytes |
|---|---|---|---|
| War code | `tools/bastion/war-campaign-rules.js` 2,495; `war-table.js` 3,168; `war-battle-rules.js` 1,950; `war-table-rules.js` 964; `war-ai.js` 718; `regiment-rules.js` 406; `war-table.css` 1,225 | 10,926 | 564,201 |
| War and event data | `data/war-units-data.js` 375; `data/war-room-data.js` 53; `data/events-data.js` 113 | 541 | 35,393 |
| Archived Brigade | `tools/bastion/archive/mercenary-brigade.js` | 336 | 18,296 |
| Tests that go whole | rules: `bastion-battle` 1,907, `bastion-campaign` 2,259, `bastion-war-ai` 952, `bastion-war-table` 822, `beast-bonding` 225, `wyvern-bonding` 426 (folded into `beast-pit`); e2e: `war-table` 2,107, `war-room` 355, `wyvern-bonding` 212, `beast-bonding` 93, `beasthandler-write` 316; `tests/war-table.html` 131; `tests/archive/mercenary-brigade.test.js` 161 | about 10,000 | 617,303 |
| Docs moved to `docs/archive/` | `WAR-RULES.md` 388, `MILITARY-DIPLOMACY-PLAN.md` 212, `specs/war-room-training.txt` 216 | 816 | about 60 KB |
| Partial removal inside kept files | `tool.js` about 2,650 of 5,687; `rules.js` about 640 of 3,426; `creature-rules.js` about 420 of 799; `bastion.css` about 520 of 1,559; `bastion-data.js` about 280 of 648; `facilities-data.js` about 1,500 of 2,811; Beast Handler files about 1,130 of 3,548 | about 7,500 | |

Total repository effect: about **1.2 MB of text** out of a **599 MB** working tree (0.2 per cent). Nothing about the ZIP download changes meaningfully; it is 600 MB because of the art.

**Delete or archive the old code?** The Mercenary Brigade was archived (`tools/bastion/archive/`, unloaded, with a "how to put it back" header and a test file under `tests/archive/`). I recommend **not** doing that for 11,000 lines of war code: it cannot run without its data, test page and screens, it would rot, and git already holds it. Instead create the tag `before-strip-back` on `76c1276`, put the tag name in `docs/archive/` banners and in `BAS-99`, and delete. B asked for Harry's explicit OK because the old plans called `war-units-data.js` and `war-battle-rules.js` "protected" (`docs/MILITARY-DIPLOMACY-PLAN.md:35`, `docs/FACILITIES-OVERHAUL-PLAN.md:151`): see question Q5.

### 7.2 Art: move, do not delete

CLAUDE.md: "bring every image ... across ... put unused files in the tool's `assets/extras/`, and list every file's old and new location in `docs/ASSETS.md`". The repo already does exactly this for retired buildings (`tools/bastion/assets/extras/facilities/` holds the Smithy, Garden, Gaming Hall, Scriptorium and the others; `extras/ui/` holds `war_panel.png` and the old route art; `extras/old-map/`). So: `git mv` (keeps history), update the CSS or data that named them, and change the ASSETS rows from "Yes" to "No: retired 22 October 2026, kept in extras".

| Picture(s) | Size | Goes to | Condition |
|---|---|---|---|
| `facilities/barracks.png`, `armoury.png`, `watchtower.png`, `menagerie.png`, `war_room.png` | 10.1 MB | `extras/facilities/` | always (the building is gone) |
| `facilities/library.png`, `laboratory.png` | 3.9 MB | `extras/facilities/` | unless the Workshop's Scholar and Alchemist use them as their cards |
| `facilities/shrine_of_{telluria,aurush,pelagos}.png` | 7.8 MB | stay until the Temple's tile is decided; the unused ones move | A's Q9 |
| `map/overlays/{library,laboratory,war_room}.png` | 0.46 MB | `extras/map/overlays/` | always |
| `map/overlays/shrine_of_*.png` (3), `wyvern_roost.png`, `griffin_tower.png`, `dire_wolf_den.png` | 0.46 MB | stay while the Temple and Pit draw them; else extras | A Q9, G Q6 |
| `panels/military.png`, `bastion_defenders.png`, `artisan_tools.png` | 5.7 MB | `extras/panels/` | the CSS at `bastion.css:888-892` goes with them |
| `ui/trade_signing.png`, `trade_disputes.png`, `wax_stamp.png` | 9.3 MB | `extras/ui/` | used only by the Hall's result and Ledger pop-ups (`tool.js:4941, 5085, 5210`; `bastion.css:1383-1390`) |
| `ui/clan_trading_locations.png` and the seven `*_trade_route.png` | 7.6 MB | **stay** | the Routes map moves to the Dock |
| `facilities/hall_inner.png`, `hall_of_emissaries.png` | 4.4 MB | **stay** | the Hall remains |
| `war/defend-bastion-coast.jpg` | 0.37 MB | `extras/war/` | the Defend Bastion battle map |
| Compendium cards (36) | 1.5 MB | stay | the Alchemist keeps most of those items |
| `bastion-new-art/` (Harry's 6.8 MB of uploads) | | **do not touch** | it is his originals folder, no code reads it, it is the only record of the overlays for retired buildings; only `docs/BASTION-MAP-ART.md` gets a note |

Total that could move: about **37 MB of 599 MB (6 per cent)**. Deleting would save that much; moving saves nothing and breaks no rule. **Question Q4** asks Harry to confirm the move (default) or delete.

New pictures that are *not* here yet: Temple tile and map overlay, Beast Pit tile and overlay (A, G). Until Harry supplies them the data reuses the Shrine and Roost paintings (A's and G's defaults).

### 7.3 Browser-side clean-up (data in Harry's browser, not in the repo)

- `tsi.bastion.warMap`, `.warTable`, `.warTerrain`: moved to quarantine by the first open of the new Bastion (and again after any Restore of an old backup, section 2.5). `Reset` stops listing them (`tool.js:5333`).
- `tsi.beasthandler.queue`, `.meetDraft`: deleted by the new Beast Handler at its first open.
- The phone's own storage (separate origin, per phone): v 1 snapshots are rejected by the version check; nothing to do.
- Each migration adds one `tsi.quarantine.bastion.state.<stamp>` record, which stays in "Back up everything". It can be 200 KB to a few MB with a long log. No automatic deletion (the suite never deletes saves), but the "What changed" box says it can be removed from the home screen's Back up everything only by a future clean-up tool; do not promise one.

### 7.4 Every list that names a script or a data file (must change in the same commit as the file)

| List | Entries to remove |
|---|---|
| `shared/data/tools.js` Bastion entry (lines 82 to 120) | css `war-table.css`; js `events-data`, `war-units-data`, `war-room-data`, `regiment-rules`, `war-table-rules`, `war-battle-rules`, `war-ai`, `war-campaign-rules`, `war-table.js` (9) |
| `shared/data/tools.js` Beast Handler entry (194 to 227) | `events-data`, `war-units-data`, `war-room-data`, `regiment-rules`, `war-table-rules`, `war-battle-rules`, `war-ai`, `war-campaign-rules` (8). It loads the Bastion's rules wholesale only to read the save; it never opens the war files |
| `shared/data/tools.js` Explorer entry (126 to 156) | none, but it loads `tools/bastion/rules.js` and `data/creatures-data.js`, so those must load alone |
| `tests/rules.html` | lines 82, 84, 90, 96 to 100 (script tags) and 131 to 135 (the four war test files) plus `beast-bonding`, `wyvern-bonding` |
| `beasthandler.html` (the phone page) | add the new data files; remove none of the Bastion (it loads none) |
| `tests/war-table.html`, `tests/pin-check.html` | delete the first; check the second (mentions `pc-`) |
| `tests/harness.html` | follows `tools.js` |

---------------------------------------------------------------------
## 8. Order of work for ONE pull request: 23 steps, about 26 commits

Principles:
1. **Replacement before removal.** What must survive (Explorer deliveries list, Resolve results, Favour bars, Port Charter box, Routes map) gets its new home and its tests switched **before** the old panel is deleted.
2. **Data and rules before screens, screens before deletion**, so each commit adds or removes one thing and the rules page stays green.
3. **The migration grows with the work.** S01 ships the shell and the safety net; each later step adds its sub-step (4.2) and its tests in the **same commit** as the change that needs it. A step that removes a facility without its migration sub-step must not be committed.
4. **Retire, never delete, an order id** that an old save may still hold (E): a pending order whose function vanished completes to nothing. The migration handles it, but the data keeps `retired: true` entries for any id that is *kept* (the four development facilities).
5. **`tool.js`, `rules.js` and `facilities-data.js` are touched by almost every step**: run them serially. Disjoint lanes that can run in parallel are listed at the end.
6. **Gate** = the rules page (`tests/run-rules.js`, about 20 s) plus the named click-throughs, plus `guide.test.js` whenever user-visible words change. After S06b, S11, S14 and S22 run **everything**.

### 8.1 The steps

| Step | What | Migration sub-step added | Tests added / changed / deleted | Gate (besides the rules page) |
|---|---|---|---|---|
| **S00** | Baseline and restore point: tag `before-strip-back` on `76c1276`; `docs/STRIP-BACK-PLAN.md`; `tests/run-rules.js`; record the green baseline (1,285 tests; every e2e file) | none | none | none |
| **S01** | **Version 4 shell.** `defaultState` v 4; `R.migrateToV4` skeleton chained after V3; `R.needsStripBack`, `R.stripBackAudit` (I1 to I7), `sweepFacilities` (ghost ids); `bastion-data.js` `stripBack` table (names only); `inDaysSave` 2/3/4 and `TSI.campaign.RETIRED_FACILITIES`; `TSI.store.keepCopy`; copy-first in `tool.js`; the "The Bastion has changed" box with "I've read this" and "Save as text file"; Management "What changed"; orphan-key sweep; `tests/fixtures/make-heavy.js` and `bastion-v3-heavy.json` | `sweepFacilities`, `finish` | new `strip-back.test.js` (~15 to start), `campaign.test.js` (v 4 accepted; retired orders ignored), `phase9` lines 2737 and 2749, new `migration-v4.test.js` (box shown once, acknowledged, survives reload, copy in Back up everything) | `phase9`, `bastion-days`, `dmdoc`, `bridge`, `phase1` (store), `guide` |
| **S02** | **Replacement surfaces.** "Changes from the Explorer" list (with refused/skipped reasons) in Management; Resolve results and refused/skipped reasons as notices; e2e readers of `[data-test=bridge-row]` / `open-influence` switched to the new list (old panel still there) | none | `bridge`, `commerce`, `courier`, `creatures`, `hall-records` e2e edits | those five, `bastion-screen` |
| **S03** | **Beast Handler data.** Tables for Buckbear and Fellcat (provisional d8 tables marked DRAFT), Blacktide as a sixth wolf, `fixedRegional` per kind, art map, `SPECIES_WORDS`, empty-region tolerance | none | `beasthandler-tables`, picture-coverage test relaxed for varieties without a picture | `beasthandler*` e2e, `phone` |
| **S04** | **Development facilities: one order per level** (E): `levelOrders: 'replace'` on the Timber Yard, Fishery, Stone Quarry and Weavers' Hall; `R.fnAvailable` hides; upgrade confirm with the stock line; level text "replaces". Herbal Gardens untouched (E's default) | none (no save change) | rewrite `bastion.test.js:1503-1760`, `bastion-screen.test.js:422-440, 500-575`; new `dev-facilities.test.js` | `bastion-screen`, `phase9` (construction, orders) |
| **S05** | **Remove Bastion Events**: panel, button, `onRollEvent`, `R.rollEvent/resolveEvent/isEventDay/nextEventDay`, the auto block in `R.finishDay`, `events-data.js`, `BASTION_EVENT_EVERY`, the "A Bastion event is due" forecast line, `.tsi-bas-event*` CSS, three manifest lines | `dropWar` begins: drop `lastEvent`, `lastEventDay` | delete 2 + edit 3 rules tests; `phase9` (passing days), `bastion-screen` (bottom bar) | `phase9`, `bastion-screen`, `bastion-days`, `dmdoc`, `phase8` (Make Camp word) |
| **S06a** | **War, part 1: the screens.** Remove War Council button and panel, At War tags, Military flows, War Table launch, startup notices, Management's Military/Defenders/Menagerie lists, War Room picker and regiment section, Compendium war units. Rules, data and facility blocks **still present** | none yet | delete e2e `war-table`, `war-room`, `tests/war-table.html`; edit `phase9` (3 sections), `bastion-screen` (bar, lock), `creatures` (War Table tokens) | `phase9`, `bastion-screen`, `creatures`, `guide` |
| **S06b** | **War, part 2: rules, data, the five facilities.** Delete the seven war files and three data files; remove Barracks, Armoury, Watchtower, War Room, Menagerie blocks; `startingBuilt = ['workshop','dock']`; creature war profiles; war ticks in `R.startDay` and lines in `shiftDays`; `saveProblem` lists; `importProblem` war keys; `cleanUi.warNoticed`; `onReset`; manifests (17 lines) and `rules.html`; commerce protections `commercial_convoy` and `maritime_approaches` (Q-A4 default: removed); "five starting facilities" wording; guide war paragraphs | `settleOrders` rows for the war family; `dropWar` (defenders, beasts, military, wars, repairs, warLog, MA, missions, recovery); protections; store sweep for the three War Table keys | delete 4 rules files (364 tests) and trim `bastion`, `creatures`, `bridge`, `campaign` (about 30 tests); heavy-fixture assertions for refunds | **everything** (rules, all e2e) |
| **S06c** | War leftovers: `bastion.css` war sections, `assets/war/` and the military/defenders panels to `extras`, `docs/archive/` moves | none | static check added (5.5) | rules, `phase1` (no missing files) |
| **S07** | **Party Name; Form Clan removed** (C): `partyName`, `R.cleanPartyName`, panel and badge rebuilt, `identityRules`, `canFormClan`, `onFormClan`, `crestField`, Brigade start-up bits removed | `identity` (seed `partyName` once from a founded Clan; drop `organization`, `clanHonor`, `trustedClientsByClan`) | delete "identity" tests (4); `party-name.test.js`; `phase9` identity/crest sections; `bastion-screen` badge states | `phase9`, `bastion-screen`, `phase2` (Use for the Bastion), `guide` |
| **S08** | **The Dock takes the Port Charter system and the Routes map** (F): `register_port_charter` function moves; Port Charters box and terms to the Dock (tabs); Routes map fed by charters and ships; strings Hall to Dock in `bridge-rules.js`, `ports.js`, `commerce-rules.js`, the Explorer's dialog (also the wrong "Level 2" text) | `settleOrders`: Hall `register_port_charter` moves to the Dock | rewrite "the Hall registers" (4 rules tests), `commerce`, `charter-terms`, `bridge` e2e | `commerce`, `charter-terms`, `bridge`, `phase8` (Explorer dialog) |
| **S09** | **The Hall stripped** (F): no actions, no upgrade, no Routes/Resolve/Council Ledger/Trade Network/Clear Diplomacy Records; Clan Relations and Diplomatic Records remain; `singleLevel` flag read by `R.upgradeCheck` and `upgradeRow`; `tickDiplomacy`, `settleRoute`, `rule`, `emissary*`, `networkUpgrades` and the art uses removed | `windDownHall` (final settlement, Q1), Hall order refunds, `trade_network` orders | delete Hall (12), routes (3), Ledger (2) tests; rewrite `hall-records`; `phase9` Hall/trade/Ledger sections (about 14 checks) | `hall-records`, `phase9`, `commerce`, `dmdoc`, `bastion-screen` |
| **S10** | **Clan Influence and Day Log panels removed.** PC and H&R stay in Clan Relations; typed H&R box, Honour Change, Support, Favour Tokens, `R.bridgeHistory` caller go; `state.log` still written | none | `phase9`/`bastion-screen` hit-tests; `bastion-days` (`open-log`) | `bastion-screen`, `phase9`, `bridge`, `bastion-days` |
| **S11** | **Temple** (F): data-driven god, Pray, Receive Blessing, thirds panel; **Favour panel and Claim removed**; Shrine blocks removed; Explorer/party-item texts "Shrine" to "Temple"; `singleLevel` | shrine slots to `temple`; Shrine orders move or cancel with Favour back; Craft cancelled | rewrite `shrines.test.js`; edit `shrines-explorer`; `temple.test.js`; `commerce` (Pelagos) | **everything** |
| **S12** | **Workshop staff** (E): five staff cards, `craftTables`, Scholar (Library content), Alchemist (Laboratory content), Artisan Tools removed; Library and Laboratory blocks removed; Compendium counts; wording in `research-data.js`, `goods-data.js` | `workshop` (drop `artisanTools`, `legacyFacilities`), Library and Laboratory orders move | `bastion.test.js` Craft, Compendium and v 2 cases; `workshop-staff.test.js` | `bastion-screen`, `phase9`, `courier`, `creatures` (chart source) |
| **S13** | **Beast Handler app part 1** (H): request protocol and Orders deleted; three-tab bar (Profile, Bond, Chronicle); Profile read-only; staged reveal against the **old** buildings; `R.rollInitiation` in the Bastion; `checkBeast` queue removed | drop `s.beast.done`/`floor` | delete 13 projection tests, ~27 link tests, `beasthandler-write` e2e; rewrite `meet`; `beasthandler-initiation.test.js` | `beasthandler*` (4 files), `phone`, `dmdoc` |
| **S14** | **Beast Pit** (G): housing (one per kind), Acclimatise With Beast, take out and return, `R.tickBonding` in `R.startDay` (and every new day field in `R.shiftDays`), DM confirms milestones, five kinds in the Explorer's Grant (de-duplicated "the Beast Pit" sentence); Roost, Tower, Den blocks and all training, harness, first flight, war profiles removed | `rehomeBeasts`; House orders move; training orders cancelled (harness refunded); free Pit if creatures exist (4.7 #6) | delete `wyvern-bonding`, `beast-bonding`; rewrite `creatures`; `beast-pit.test.js` (rules and e2e) | **everything** |
| **S15** | **Beast Handler part 2**: snapshot v 2 (one Pit, `bonding` block, a Bond 0 beast sends no detail), Bond page with filling pills and Bonding Days, the DM's box moved into the Pit panel | none | `beasthandler-projection` (adapt leak tests), `beasthandler-bond.test.js` | `beasthandler*`, `phone`, `beast-pit` |
| **S16** | **DM doc** (D): `expedition.endedDay` in the Explorer, `summary` shape (heroes with effects, party effects, expedition), 2 x 2 layout, Quest box (`tsi.dmdoc.quest`), PDF/DOCX/text import, one pop-out at a time, layout version | none | rewrite `dmdoc.test.js` (rules and e2e), `dmdoc-edit`; `phase1` DM doc geometry (440 x 800 pinned); `dmdoc-quest`, `doc-text` | `dmdoc`, `dmdoc-edit`, `phase1`, `phase8` |
| **S17** | **Phone link** (H): QR pairing and the DM's link box; relay behind an off switch **only if Harry approves and amends ground rule 2** | none | `beasthandler-phone` (pairing by address), a stand-in relay test | `phone` |
| **S18** | **Day Log state removal and the wording sweep**: delete `R.log`, `log()`, `logAll()`, `state.log`, `lastEvent` remnants; "the Day Log says so" text in about 15 places; mechanical update of the `b.log` assertions in about 14 rules files and 18 e2e files; the report's old-log text-file button stays (reads from the set-aside copy) | `log` dropped | mechanical edits | **everything** |
| **S19** | **Art and map**: retired pictures to `extras`; map overlays, labels, tile crops for the Temple and the Pit; `docs/ASSETS.md` (41 rows plus the three new beast pictures); `BASTION-MAP-ART.md`; re-measure the badge clearance at four sizes (C: 4 px at 1280 x 720) | none | static check; `phase1` no-missing-files | `bastion-screen`, `phase9`, `phase1` |
| **S20** | **Guide, home-screen text, stale-word check** (6.4, 5.5) | none | `guide.test.js` + stale words | `guide`, `phase1` |
| **S21** | **Docs**: PROGRESS, KNOWN_ISSUES (BAS-99 to BAS-111, SUI-53 to 55, EXP-46, BH-06 to 09), `BASTION-SAVE.md`, banners, reference document, `tests/e2e/README.md`, licences | none | none | none |
| **S22** | **Full regression and the PR**: rules page, every e2e file, the layout check at 1707 x 930 (1.5) and 1920 x 1080 (1), offline run, the migration rehearsed on every fixture and on a copy of Harry's real campaign if he supplies one, PR description (handover versus code differences), Harry's tickbox list with the branch ZIP link at the top | | | everything |

### 8.2 Dependency graph

```
S00 ─ S01 ──┬─ S02 ───────────────────────────────┐
            ├─ S03 ──────────────┐                │
            ├─ S04               │                ├─ S10 ─┐
            └─ S05 ─ S06a ─ S06b ─ S06c           │       │
                         │      └─ S07            │       │
                         ├────── S08 ─ S09 ───────┘       │
                         │                                 │
                         └─ S11 ─ S12 ─────────────────────┤
              S03 ─ S13 ─ S14 ─ S15 ──────────────────────┤
                              S15 ─ S17 (needs Harry)     │
              S05,S06b,S09,S11,S14 ─ S16 (DM doc) ────────┤
                         S06b,S09,S10,S11,S14 ─ S18 ──────┤
                         S11,S12,S14 ─ S19 ─ S20 ─ S21 ─ S22
```
Hard edges: **S01 before everything**; **S02 before S10**; **S08 before S09**; **S06 before S07** (the war reads `organization`); **S03 before S13**; **S13 before S14**; **S14 before S15**; **S18 after every step that writes the log**; **S19 after S11, S12, S14** (the art decisions); **S20, S21, S22 last**. Soft edges (only because both edit the same files): S04, S05, S08 to S12.

### 8.3 What can run in parallel (disjoint files)

| Lane | Steps | Files touched | Conflicts to watch |
|---|---|---|---|
| Bastion core (serial) | S01, S04 to S12, S14, S18, S19 | `tool.js`, `rules.js`, `facilities-data.js`, `bastion-data.js`, `bastion.css`, `shared/data/tools.js`, `tests/rules.html` | none inside the lane if serial |
| Beast Handler files | S03, S13, S15, S17 | `tools/beasthandler/*`, `beasthandler.html`, their tests | S13 needs `R.rollInitiation` in `rules.js`; S15 needs S14 |
| DM doc | S16 | `shared/js/dmdoc*.js`, `components.css`, `campaign-rules.js`, Explorer `journey.js`, tests | `campaign-rules.js` is also touched by S01, S05, S06b, S09 (forecast lines): do S16 after S09 or merge those lines first |
| Docs | S21 | docs only | write the per-step notes (KNOWN_ISSUES drafts) as each step lands, finalise at S21 |

### 8.4 Checkpoints Harry can test before the end (his choice; he asked for one PR)

Push the branch after S06c (war gone, everything else as before), after S11 (Hall, Dock, Temple), after S15 (Beasts and the app). Each is a ZIP he can open without committing to the rest. The migration box will show only what has been converted so far, which is itself a useful test of the box. **Do not merge between checkpoints.**

### 8.5 Time

Test runtimes measured today: the rules page about 20 s; `phase9` 4 min 18 s; `bastion-screen` 70 s; the whole click-through suite (sequential) E2E_TOTAL_PLACEHOLDER. After S06b the suite is shorter (the 122-check War Table file and the 4,959-check War AI file are gone).
