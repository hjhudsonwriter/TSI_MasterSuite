# S14 and S15 built: the Beast Pen, day-by-day bonding, and the Beast Handler's Bond page

Steps S14 and S15 of the Strip Back Overhaul (design: `docs/strip-back/G-beastpit-bonding.md` and `H-handler-app.md`; Harry's final decisions override the G report, which called the building the Beast Pit). Branch `lane-b`, worktree `wt-b`. Both steps are finished and every gate is green (see "Tests"). Nothing was pushed.

## Harry's decisions as built

- The building is **Beast Pen**, id `beast_pen`: party level 5, a construction slot, 21 days, **one level only** (no Upgrade row, `singleLevel: true` in its data), holding **one beast of each of five kinds** (wyvern, griffin, dire wolf, buckbear, fellcat). Beasts housed before the limit stay; the limit only blocks housing a new one (the House Beast Here button says "The Beast Pen keeps one griffin at a time: Swiftwing lives here.").
- A new Bastion no longer holds Elara's wyvern; an existing save that has her keeps her.
- **Acclimatise With Beast**: the handler rolls Animal Handling at the table and the DM types the total in a box (1 to 60). DC **20** for every kind (`acclimatise.dc` in `creatures-data.js`; a per-kind `dc` can be added). It is instant, not a pending order. A pass: Bond 1, the beast leaves the dropdown, `R.rollInitiation` runs (the Beast Handler's first meeting). A fail: that beast can't try again for 3 in-game days (a fail on Day 10 blocks Days 11 and 12; Day 13 is allowed). The retry day moves with Reset Travel.
- **Bonding Days** count only while a beast is "Away from the Ironbow" and are **totals**: Bond 2 at 10, 3 at 20, 4 at 30, 5 at 50 (`bondTotals` in the data). They are never lost, keep counting while a milestone waits, and one level rises per scene (the DM confirms, as before). The tick is inside `R.startDay`, once per day, with an idempotency guard (`bonding.lastTick`).
- Buttons: "Take (name) on the road" and "Return (name) to the Beast Pen". Labels: "At the Beast Pen" and "Away from the Ironbow since Day N". Both buttons are refused while the Bastion is behind the Explorer or a day is part-way through.
- Harry's painting `tools/bastion/assets/facilities/beast_pen.jpg` runs the full width of the top of the Pen's panel (`data-test=fac-banner`), with the level, orders and beasts beneath it. The Pen's tile uses the Menagerie's painting (`menagerie.png`) and its map overlay reuses the Wyvern Roost's building; no picture file was moved or deleted.
- The Management creature list and the "Beast Handler (players)" box moved **into the Pen's panel**.
- Removed from the screens: training programmes, riding harness, first flight, Rider's Pact, Controlled Ascent, and the old three buildings' orders. What an old save had recorded stays hidden in the saved beast's `development`.
- The Explorer's **Grant a creature…** offers all five kinds; its sentence says "the Beast Pen" once and that the Pen keeps one of each kind.

## What changed, by file

- `tools/bastion/data/creatures-data.js`: species `home: 'beast_pen'`; Buckbear and Fellcat added; `grantable` has five kinds; `pen.perKind: 1`; `acclimatise { dc: 20, skill: 'Animal Handling', retryDays: 3 }`; `bondTotals`. Room, development, riding and "coming later" data removed. `unique.elara_wyvern` kept (for an existing save).
- `tools/bastion/data/facilities-data.js`: the three buildings replaced by `beast_pen` with `house_beast` and `acclimatise` (20 facilities in all).
- `tools/bastion/data/bastion-data.js`: tile, panel picture, map overlay and label for the Pen.
- `tools/bastion/rules.js`: `cleanDevelopment` keeps `bonding { away, awaySince, lastTick, days }` and `acclimatise { tries, retryDay, last }`; `R.shiftDays` shifts **every** new absolute day (`awaySince`, `lastTick`, `retryDay`, `last.day`); `R.startDay` ends with `R.tickBonding`; order handling for the two Pen orders; `upgradeCheck` answers "one level only"; demolish refused while beasts live there.
- `tools/bastion/creature-rules.js`: the Pen and bonding API (`R.PEN_ID`, `penPerKind`, `penRoom`, `penStands`, `acclimatise*`, `bondTotal`, `bondingDays`, `isAway`, `bondProgress`, `refreshBondReady`, `tickBonding`, `awayBlocker`, `takeOut`, `returnToPit`, `penStatus`, `penSummary`, `housingBlocker`, `completeHousing`, `assignHandler`, `confirmBond`, `nextStepLine`). Training, harness, first flight and riding rules removed.
- `tools/bastion/strip-back-rules.js`: new conversion step **`rehomeBeasts`** (above `sweepFacilities`), and the audit extended for moved orders.
- `tools/bastion/tool.js` and `bastion.css`: the Pen's panel (banner, stalls, beast blocks with pills, Take out and Return buttons, Acclimatise row and dialog, the Beast Handler box), the tile marker `tile-bond-ready`, Management's list and box removed.
- `shared/js/bridge-rules.js` (the fallback creature list, five kinds), `shared/js/campaign-rules.js` (`MOVED_ORDERS`, so a version 3 save's forecast still lists the moved House orders), `shared/data/tools.js` (Beast Handler description), `tools/explorer/tool.js` (Grant dialog text and de-duplication).
- S15: `tools/beasthandler/projection.js` (snapshot stays version 2; a `bonding` block and `place` per creature; one facility entry, the Beast Pen at level 1; a Bond 0 beast still sends no detail), `model.js`, `view.js`, `beasthandler.css`, `dm-panel.js`.
- Docs: `guide.html`, `docs/PHONE-PAGE.md`, `tests/e2e/README.md`.

## The conversion step `rehomeBeasts`

Pure, idempotent, no dice, audit-clean (checks I1 to I7), plain-English lines in the report under "joined", "beasts" and "orders". It keeps one built Wyvern Roost, Griffin Tower or Dire Wolf Den slot (the earliest ready) as the Beast Pen and frees the others; renames the old ids in the saved levels and repairs; moves homes to `beast_pen`; **moves** House orders to the Pen's House Beast Here (same cost, inputs and due day; label "Beast Pen: House Beast Here (name)"); **cancels** training and upgrade orders with a refund through `R.stripBackCancel`; releases no creature; builds a free Pen only when beasts are already housed and no old building stands. Tested on `tests/fixtures/bastion-v3-heavy.json` and on Harry's sample files. I did **not** change `TSI.campaign.RETIRED_FACILITIES` (the three old ids stay on it, because they are still retired ids in an old save); I added `MOVED_ORDERS` beside it, which makes the forecast keep the moved orders.

## Tests

- Rules (`node tests/run-rules.js`): **1386 passing**. New `tests/rules/beast-pen.test.js` (46 tests: acclimatise boundary 19/20, retry days, bonding totals, idempotent tick, shiftDays, take out and return, one-of-each limit, migration on the heavy fixture, leaks). Deleted: `wyvern-bonding` and `beast-bonding` (rules and e2e). Rewritten: `creatures`, and the Beast Handler projection, model, link and initiation tests.
- E2E, all one at a time from a double-clicked `index.html` (or the test page where the test says so), offline: `beast-pen` 24/24 (new), `creatures` 23/23, `beasthandler` 15/15, `beasthandler-meet` 26/26, `beasthandler-phone` 15/15, `beasthandler-bond` 12/12, `migration-v4` 22/22, `dmdoc` 50/50, `bridge` 33/33, `bastion-screen` 55/55, `bastion-days` 16/16, `guide` 21/21, `phase1` 128/128, `phase9` 123/123, `phase8` 77/78 (the one failure is "Compared with the old Explorer", which needs `_legacy/` and always fails in a worktree), plus `war-room` 12/12, `shrines` 9/9 and `shrines-explorer` 11/11.
- `tests/e2e/beast-pen.test.js` proves each day is counted once: the Explorer makes camp with the Bastion closed; a save left at Day 19 while the Explorer is on Day 25; the Bastion window reloaded (F5) at six moments around a day passing; Reset Travel (the days move back, the next camp counts). It also checks the panel at 1707 x 930 (ratio 1.5) and 1920 x 1080 (ratio 1).
- Changed tests on purpose: `war-room.test.js` opens the Beast Pen instead of the Griffin Tower (one line; Harry's sample now converts to a Pen); `bastion-screen.test.js` expects the Pen where the three buildings were; `migration-v4` and the Beast Handler e2e files use `beast_pen`.

## Decisions I made myself

1. A beast already at Bond N counts as having `bondTotal(N)` days (the effective Bonding Days are the larger of what was counted and the total for its level). Otherwise a migrated Bond 3 beast would show an empty Bond 4 pill with no days at all.
2. The Pen's map overlay reuses the Wyvern Roost's building art (the Menagerie has no map overlay); the tile uses `menagerie.png`.
3. A free Pen is only built when creatures are already housed and no old building stands (waiting beasts alone do not get a building).
4. A moved House order that would break the one-of-each cap keeps that beast waiting; the report line says so. Elara's moved order completes only if no wyvern is housed yet.
5. Take out and Return are both refused while the Bastion is behind the Explorer or mid-day; the day a beast goes out is not counted.
6. The acclimatise function has `days: 1` in its data only to satisfy the rule that every order has days; it is never queued.
7. A new data flag `singleLevel` marks a facility with one level; the Hall of Emissaries will need the same.
8. `R.creatureStatus` and the war lines for beasts were left in place (unused by the Pen screens) for the war-removal step to delete.
9. A trip that began "before Day 1" after Reset Travel is shown as "since before Day 1".

## Merge notes for the lead

Another lane is deleting war code and the Barracks, Armoury, Watchtower, War Room and Menagerie. Likely overlaps, all small: `tools/bastion/data/creatures-data.js`, `facilities-data.js`, `bastion-data.js`, `creature-rules.js`, `rules.js` (`startDay`, `shiftDays`, `issueOrder`), `tool.js`, `guide.html` (the creatures block still has the line "Creatures defend the Ironbow…", which is war text I left alone), `tests/rules.html`, `tests/e2e/bastion-days.test.js` (it recruits at the Barracks) and `war-room.test.js`.

## Where I stopped

Nothing is left over: S14 and S15 are finished, committed and tested. Not started (other steps): the QR link and live updating of the phone, the Hall, the Temple, the Workshop, the Party Name editor.
