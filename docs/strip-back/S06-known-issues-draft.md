# S06 known-issues draft (for the lead to renumber into docs/KNOWN_ISSUES.md)

Not added to `docs/KNOWN_ISSUES.md` itself, to avoid merge clashes. Ids below are placeholders (BAS-S06a to BAS-S06g); rename to the next free BAS numbers when merged. All are deliberate changes from Harry's Strip Back brief (22 October 2026). The restore point is commit `4f1db26`.

### BAS-S06a · The war game is removed (Strip Back Overhaul, S06)
**Deliberate change** · other

- **Before:** the Bastion had a War Council and War Table (regiments, Lieutenants, a battle engine, enemy armies, campaign wars against Clans, Military Actions, a Defend Bastion event, defenders and an armoury, a war log) and the Compendium listed the units.
- **After:** all of it is gone from the screen, the rules, the data, the forecast, the DM doc, the Compendium (21 entries) and the guide; the war pictures are in `tools/bastion/assets/extras/`, the old documents in `docs/archive/` with a "removed 22 October 2026" banner.
- **Evidence:** `tools/bastion/` (war files deleted), `tools/bastion/rules.js`, `shared/js/campaign-rules.js`, `guide.html`; `tests/static-check.js`.

### BAS-S06b · Barracks, Armoury, Watchtower, War Room and Menagerie are removed
**Deliberate change** · other

- **Before:** the Bastion had 20 facilities and started with five built (Workshop, Dock, Barracks, Armoury, Watchtower).
- **After:** 15 facilities, and it starts with two built (Workshop, Dock). In an existing Bastion the five go to "gone facilities" (`archivedFacilities`), with their slots freed and their levels removed.
- **Evidence:** `tools/bastion/data/facilities-data.js`, `bastion-data.js` (`startingBuilt`), `strip-back-rules.js` (`dropWarFacilities`); `tests/rules/bastion.test.js`, `strip-back.test.js`.

### BAS-S06c · Orders of the removed facilities, and War Actions, are cancelled when a saved Bastion is converted
**Deliberate change** · data

- **Before:** a pending Drill, Arm Defenders, Recruit Beast or build order of a war facility, or a War Action, would have kept running.
- **After:** the conversion cancels each one and gives back the gold it cost (the report lists them); a War Action cost no gold, so nothing is refunded, and the Honour/Respect and Political Capital it took are not given back (the report points at Change a score in the DM doc).
- **Evidence:** `strip-back-rules.js` (`settleWarOrders`); `tests/rules/strip-back.test.js`, `tests/e2e/migration-v4.test.js`.

### BAS-S06d · The army, the wars, the Menagerie's beasts and the war log are dropped when a saved Bastion is converted
**Deliberate change** · data

- **Before:** a version 3 save kept `defenders`, `defenderBeasts`, `military`, `militaryActions`, `warMissions`, `warRecovery`, `wars`, `warLog` and the day's attack roll.
- **After:** they are deleted and said in plain English (the beasts with what they cost, so a purchase made is not refunded; the Clans named as at war; regiments and the Lieutenant). Nothing is dropped silently, and the converted file passes the audit (I1 to I7). A re-run on a version 4 save tidies again with a short notice.
- **Evidence:** `strip-back-rules.js` (`dropWar`); `tests/rules/strip-back.test.js`, `tests/e2e/migration-v4.test.js`.

### BAS-S06e · Facilities Under Repair are cleared when a version 3 Bastion is converted
**Deliberate change** · data

- **Before:** a facility Under Repair after a lost battle stayed under repair for its days.
- **After:** only a lost battle in the war game ever caused a repair, so a first conversion clears them (the facilities work again, said in the report). The Under Repair machinery stays for later steps (an empty `repairs`), and a re-run on a version 4 save never clears repairs.
- **Evidence:** `strip-back-rules.js` (`dropWar`); `tests/rules/bastion.test.js` (repairs).

### BAS-S06f · The Commercial Convoy and the Maritime Approaches protections are gone from the Dock
**Deliberate change** · other

- **Before:** the Barracks and the Watchtower gave the Dock two voyage protections (Guard Commercial Convoy, Protected Maritime Approaches) beside the Blessing of Pelagos.
- **After:** the Dock offers only the Blessing of Pelagos. A saved Convoy or Approaches is dropped on conversion and said (a held Convoy was a charge for the next ship, not gold). The generic charge-and-window rules stay (the Blessing uses them); `R.protectionBusy` is removed.
- **Evidence:** `tools/bastion/data/commerce-data.js`, `commerce-rules.js`, `strip-back-rules.js` (`dropWarFacilities`); `tests/rules/commerce.test.js`, `tests/e2e/charter-terms.test.js`.

### BAS-S06g · The War Table's saves are set aside after the conversion, and Reset no longer lists them
**Deliberate change** · data

- **Before:** the War Table kept its settings and map in `tsi.bastion.warTable` and its map keys; Reset listed them and a backup checked them.
- **After:** they are ignored by import checks, set aside (not deleted) by the Bastion's start-up only after the conversion has passed its check and the converted Bastion has been saved, and left out of Reset.
- **Evidence:** `tools/bastion/tool.js` (`sweepOrphans`), `rules.js` (`importProblem`); `tests/rules/bastion.test.js`, `tests/e2e/migration-v4.test.js`, `bastion-screen.test.js`.

### Left alone (not bugs I fixed; to know about)
- A version 3 save's report always says the Barracks, Armoury and Watchtower are gone (they were starting facilities), so the short "nothing to convert" box cannot be reached by a real version 3 save.
- `tests/rules/bastion.test.js` still has an old "never touched" test for the version 2 to 3 conversion that uses a War Room and wars as sample data; it tests that older conversion, which is unchanged, and passes.
- The heavy fixture (`tests/fixtures/bastion-v3-heavy.json`) was regenerated: the key order of war fields differs; harmless.
- The shared disk filled up while this step ran (other lanes' worktrees). It is an environment problem, not a code one; it truncated one rules run, which was re-run in full.
