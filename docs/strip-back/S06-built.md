# S06 built: the war game and five facilities removed

Step S06 of the Strip Back Overhaul (`docs/STRIP-BACK-PLAN.md`; design in `docs/strip-back/B-panels-war.md` section 2 and `J-cross-cutting.md` sections 4, 5.5 and 8). Branch `lane-a`. The last version that still had the war game is commit `4f1db26` on main (the restore point); the old documents stay as history in `docs/archive/` with a "removed 22 October 2026" banner.

Shrines, the Library and the Arcane Laboratory are other steps and were not touched. The Wyvern Roost, Griffin Tower and Dire Wolf Den were already replaced by the Beast Pen (S14), which is kept.

## What was removed

- **The war game:** the War Council and War Table (screen, rules, battle engine, enemy AI, campaign wars, regiments and Lieutenants), Military Actions, defenders and the armoury, the Defend Bastion event, the war log. Files deleted: `war-table.js`, `war-table.css`, `war-table-rules.js`, `war-battle-rules.js`, `war-campaign-rules.js`, `war-ai.js`, `regiment-rules.js`, `data/war-room-data.js`, `data/war-units-data.js`, `tests/war-table.html`, the old mercenary brigade museum file and its test.
- **Five facilities:** Barracks, Armoury, Watchtower, War Room and Menagerie. The catalogue now has 15 facilities (the Beast Pen replaced three earlier, these five go). `startingBuilt` is `['workshop','dock']`.
- **Code inside kept files:** the war branches of `rules.js`, `creature-rules.js`, `commerce-rules.js`, `shared/js/campaign-rules.js` (the forecast), the DM doc, the Compendium (21 entries, 271 down to 250: the Menagerie's 13 beasts, the War Room's six units and Lieutenant, and the old Regiment (100)), the `bastion.css` war sections (the file is 1,370 lines now), the guide's war paragraphs.
- **Creature-rules functions removed:** `creatureWar`, `fightingCreatures`, `creatureRecovery`, `defending`, `creatureStatus`, `creatureWarLine` and the `RECOVERY_WORDS` table. Kept: everything the Beast Pen and bonding use.
- **Commerce:** the Commercial Convoy and Protected Maritime Approaches (the Barracks' and Watchtower's protections) are gone from the data. Only the Blessing of Pelagos remains. `R.protectionBusy` is removed. The generic charge/window rules for a voyage protection stay (the Blessing uses them) and the rules tests use stand-ins to keep them covered.
- **Pictures:** the war game's facility, panel, map and battle pictures moved to `tools/bastion/assets/extras/` (nothing deleted; 8 files moved). `menagerie.png` stays in place as the Beast Pen's tile, and the Wyvern Roost overlay art stays. `docs/ASSETS.md` lists every move.
- **Size:** against main after the second merge, 70 files changed, 1,535 lines added and 25,925 removed. 18 files deleted, 8 pictures and 3 old documents moved. About 14,600 of the removed lines were code, data and styles in `tools/bastion` and about 11,200 were tests.

## The migration (registry steps, in this order)

Added to `R.stripBackSteps` in `tools/bastion/strip-back-rules.js`, after `dropEvents` and before `sweepFacilities`. All three are pure, idempotent and leave the audit (I1 to I7) clean on the heavy fixture.

1. **`settleWarOrders`**: cancels every pending order of the five facilities with the gold it cost (a Drill, Arm Defenders, a Recruit Beast, a build) refunded, and cancels any War Action. A War Action cost no gold: declaring war took Honour/Respect and Political Capital at once, and those are not given back (the report line says so and points at Change a score in the DM doc).
2. **`dropWar`**: deletes `defenders`, `defenderBeasts`, `military`, `militaryActions`, `warMissions`, `warMissionSeq`, `warRecovery`, `wars`, `warLog`, `dayInProgress.attackRolled`, and `repairs` (Under Repair after a lost battle; only on a first conversion, never on a re-run). Each is said in plain English: the beasts with what they cost ("1 tiger (bought for 1,000 gp)": a purchase is not refunded), the Clans named as at war, the regiments and the Lieutenant.
3. **`dropWarFacilities`**: frees the slots, records each in `archivedFacilities` (the starting ones flagged `starting: true`, `slot: null`), removes their levels, resets `builtFacilities` to the two starting facilities, and drops the Convoy and Approaches protections (a held Convoy is said: it was a charge for the next ship, not gold). The report line says, for example, "Barracks, Armoury, Watchtower, War Room and Menagerie are gone with the war game. The War Room's and the Menagerie's slots are free."

`detect` for each step finds leftovers in a version 4 save (an older copy of the suite put war fields back), so a re-run gives the short "tidied again" notice. `R.fromSave` drops the war fields on every load, even damaged ones.

Start-up (`tools/bastion/tool.js`): the War Table's three saves (`tsi.bastion.warTable` and its two map keys) are set aside by `sweepOrphans()` only after the conversion has passed its check, the old Bastion has been copied and the converted Bastion has really been written (it runs inside `TSI.store.flush().then(...)` at the end of start-up, main's ordering). Reset no longer lists them. The guard that switched the sweep off while the War Table existed is gone.

**Merged with main's conversion-safety fixes (second merge, 22 October 2026).** Kept main's structures: `TSI.campaign.RETIRED_FACILITIES` is one `{ id: 'cancel' | 'move' }` table (the five war facilities were already `'cancel'`); `cancelledByConversion` also counts a War Action (`war_council` / `meta.kind === 'war_action'`) as cancelled, and a version 4 save read by the forecast still leaves out a War Action an older copy put back; a building War Room or Menagerie is not forecast (the table says `'cancel'`). My three steps use only `R.stripBackCancel` (gold refunded and itemised, so the stricter audit of cancelled orders is satisfied) and never `R.stripBackMoveOrder`, so `R.STRIP_BACK_MOVE_KEYS` is unchanged. Every audit guarantee (I1 to I7, including kept orders being identical and the steps being idempotent on a second run) passes on the heavy fixture and on the hand-made cases; the tests that build a converted Bastion by hand now start without the war game's fields, facilities and Barracks/Armoury/Watchtower levels, since a Bastion that still holds them is rightly "converted again".

## Static check (J 5.5) and the tests

`tests/static-check.js` (run `node tests/static-check.js`, no browser): every script and style a page or a tool names exists, including the pop-out windows' files; every Bastion picture the styles, code and data name exists; no code refers to the deleted war files, globals or facility ids (the conversion, the forecast's retired list and the Bastion's table of names are allowed); the deleted files stay deleted; scripts nothing loads are listed (the Explorer's switched-off `events-data.js` is the one known and allowed). Rules tests for the war game (four files) and the click-throughs `war-table.test.js` and `war-room.test.js` are deleted; the others were updated. The heavy fixture now also holds a Commercial Convoy and the Maritime Approaches, and `make-heavy.js` writes the five facilities' orders itself.

## Decisions made without asking

- **Under Repair machinery kept** (empty `repairs: {}`, the Library and Laboratory still use it); the migration only clears repairs on a first conversion, since only a lost battle caused one.
- **The tidy-up of orphan saves runs after the conversion**, not before, so a failed conversion never loses the War Table's saves.
- **A version 3 report always says the Barracks, Armoury and Watchtower are gone** (they were starting facilities), so the short opening box cannot be reached by a real version 3 save.
- **Honour, Respect and Political Capital spent on wars are not refunded**; the report says how to set them (Change a score in the DM doc).
- **A purchased Menagerie beast is not refunded**, but the report lists what it cost.
- **Compendium entries for the removed units are removed** (21), not left as dead links.
- **The commerce voyage-protection code stays generic**; only the Blessing is in data.
- **Old documents go to `docs/archive/`** with a banner; `docs/KNOWN_ISSUES.md` and `docs/PROGRESS.md` are not edited here (see `S06-known-issues-draft.md`).

## Results (after the second merge with main, tip `2981540`)

- `node tests/static-check.js`: passed (6 pages, 9 tool manifests, 148 files named, 112 source files scanned).
- Rules page (`node tests/run-rules.js`): all 1,016 tests passed.
- Click-throughs, one at a time: bastion-days 16, bastion-screen 53, beast-pen 24, beasthandler-bond 12, beasthandler-meet 34, beasthandler-phone 15, beasthandler-sweep 17, beasthandler 15, bridge 37, charter-terms 6, commerce 27, courier 27, creatures 23, dmdoc-edit 11, dmdoc 50, fights 15, guide 21, hall-records 10, migration-v4 35, parcels-more 3, phase1 129, phase2 71, phase4 57, phase5 50, phase7 70, phase9 82, region-warning 4, reinforcements 6, session-safety 6, shrines-explorer 11, shrines 9: every check passed.
- Passed only on a re-run alone: creatures (one run failed with "TSI is not defined" in a wait, while other lanes were running their own browsers; it passed twice alone), phase3 54 and phase6 74 (both timing-sensitive; they failed while the machine was busy and passed alone).
- phase8: 77 of 78 checks passed; the one failure is "Compared with the old Explorer", which needs the old Explorer cloned into `_legacy/` and always fails in a worktree (known).

## Environment note

The shared disk was full for part of the session (other lanes' 600 MB worktrees). It cut one rules run short and broke some tool output; I cleared stale temporary files and ran everything with the temp and screenshot folders on `/dev/shm`. No result below is from a truncated run.

## Where I stopped

All three migration steps, the code and data removal, the leftovers (CSS, pictures, archive, static check) and the test updates are committed. Nothing is left for S06 itself. Not started (later steps): Shrines, Library, Arcane Laboratory, Clan Influence and the Day Log.
