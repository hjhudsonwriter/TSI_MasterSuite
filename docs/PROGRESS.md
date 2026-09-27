# Progress

## Where things stand

**Phases 4 (Notice Board), 5 (The Heartwood Ritual) and 6 (Arenas of The Scarlett Isles) are built and tested.** At Harry's request they were built together, in one session with one pull request and one combined checklist. **Phase 7 (Combat Tracker desk) is next,** and waits for Harry's go-ahead and his answers to C1–C11.

Double-click `index.html` to open the suite. Five tools now open from their cards: the Clan Crest Creator, the Pelagosi Puzzle Trials, the Notice Board, The Heartwood Ritual and the Arenas. The other three say "Coming in phase N" until their phases are done. The plan is in `docs/PLAN.md`, the bug list in `docs/KNOWN_ISSUES.md`, and the notes for building each tool in `docs/BUILDING-A-TOOL.md`.

## Done

### Phase 6: Arenas of The Scarlett Isles (26–27 September 2026)
- **Rebuilt as it was:**
  - Both arenas and all six rounds, with the same prizes, DCs, approaches, opponents, failure damage, tempo limits and overtime.
  - The arena picture with its standing, hit and fail pictures: the fallen duelist stays fallen, the Beast-Pen shows whichever beasts are down, the swordsmen stand in front of the three Lion Totems, and the Lion's Mark badge and its big announcement with the horn.
  - The turn panel (skill check, attack roll, damage and Apply), the rules and results panels, End Round, Forfeit, Back to Start, Reset Run and Add Player, and every sound at the old volumes, with the crowd looping through a round.
  - It saves the party (with portraits), the gold and the chosen arena and round, as before.
- **Your answers (all the defaults):** A1–A3 and A7–A9 kept as they were; players take turns in order (A4); damage is applied once per turn (A5); a skill roll can still be re-rolled or changed before Resolve Turn (A6).
- **Fixed (they broke the tool, lost data or applied something twice):**
  - It works double-clicked and offline (ARN-01, ARN-06).
  - Apply deals a turn's damage once, even after re-rolling the attack (ARN-02).
  - A round's prize is paid once. After a result, Play Turn, End Round and Forfeit are off until the next round or Leave Arena (ARN-03, ARN-04).
  - A full storage no longer wipes everyone's portraits: a warning appears, nothing is stripped, and it saves again on the next change (ARN-05).
  - A double click on Play Turn or Add counts once (ARN-07, ARN-08).
  - Replaying the Lion Totems starts with both swordsmen standing (ARN-09).
- **Layout:** the arena picture keeps its 16:9 frame and grows to fit. The turn panel has its own column beside it, and the Round Console (with Play Turn) sits under the picture, so the whole turn and Play Turn are in view on your laptop and the TV (ARN-10). Party and Opponents are on the right.
- **Kept as they were** (listed in KNOWN_ISSUES ARN-11 to ARN-27), for example: a cancelled turn still counts, the footer gold catches up only after the next change, and changing the Arena or Round list restarts a round without asking.
- **Leaving mid-round** asks "Leave the Arenas of The Scarlett Isles?" first, and closing the tool stops the crowd and every picture timer.
- **Reduce motion:** the Lion's Mark pulses and the announcement throb more slowly.
- **Checked against the old tool:** with the same dice, the two tools played all six rounds side by side (wins, losses, hits, misses, the Beast-Pen bonus, totems, the Lion's Mark and overtime) and showed the same thing at every one of 186 steps: scores, HP, gold, pictures, sounds, panels and the log.
- **Structure:** arenas and media list in `tools/arenas/data/arenas-data.js`, rules in `rules.js`, the screen in `tool.js`, styles in `arenas.css`. All 71 pictures and sounds are in `tools/arenas/assets/`, the two unused ones in `extras/` (`docs/ASSETS.md`).

### Phase 5: The Heartwood Ritual (26 September 2026)
- **Rebuilt as it was:** the three stones (Weight, Memory and Silence) with their rolls, Assists, Progress, Stress and cracks; the eight rounds; the six Heartwood events; the Husk, Buckbear and Wyvern; the Pulse; the three endings and the Final Seal; the DM Dock and the `` ` ``, N and E keys; the heartbeat and sounds; and the root film behind the screen. The films play inside the page, as before. It saves nothing, as before.
- **Your answers:** R2, threats are checked once per round, when Next Round is pressed. The rest are the defaults: the name stays "The Heartwood Ritual" (R1), events can repeat (R3), sound is Enable only (R8), the P key is gone (R7) and there's no log panel (R10).
- **Fixed:**
  - Reset Ritual crashed and left the old ritual on screen (RIT-01). It now starts completely fresh.
  - The Silence buttons were off the bottom of a laptop screen (RIT-02). The Ritual is now drawn at the old size and scaled to fit: about 91% on your laptop, full size on the TV.
  - The crack pictures, films and fonts work offline (RIT-03 to RIT-05).
  - Threats no longer roll on every redraw (RIT-06, R2).
  - A double press on Next Round or Apply Event counts once, and Enable Sound can't start two heartbeats (RIT-07 to RIT-09).
  - Reset also clears armed Assists, the finale's timers and a paused heartbeat (RIT-10).
- **Leaving mid-ritual** asks first, and closing it stops the heartbeat, films and timers.
- **Checked against the old tool:** 46 moves played in both side by side, with the screens compared after each.

### Phase 4: Notice Board Quest Generator (26 September 2026)
- **Rebuilt as it was:** all 180 quests word for word; the filters (level, count, type, province, faction and the honour settings); Generate, Decline, Accept with the quest outline, the ★ and Remove; the accepted list grouped by province; the wooden notice board; and the players' pop-out board.
- **Your answers (all the defaults):** one bounty at levels 7–10 (N1) and the bounty level bands (N2) kept; one Clan and one Temple Honour value (N3); the players' window shows the notices only, with no buttons (N4); the Root and Veinwood text kept word for word until you send replacements (N5).
- **Saving:** accepted quests, their outlines and the ★ are saved, with Export, Import and "Back up everything".
- **The Knightly Treasures link (your Option A):** the ★ still tells Matt Owen's shop which quest is active, with the same message at the same moments as the old tool. Offline it skips quietly; next time the Notice Board opens online, the shop catches up. Removing the ★ quest now sends one message instead of two identical ones. "Open shop ↗" sits beside it. The Firebase library is stored in the suite folder, and only the Notice Board loads it.
- **Fixed:** it works double-clicked and offline; the players' window no longer goes stale and reconnects after a reload; a full or damaged save is reported and kept, never lost (QST-01 to QST-07).
- **Layout:** Quest Outline, the board and Accepted Quests side by side, fitting your laptop and the TV.
- **Checked against the old tool:** with the same dice, the same boards, wording and tilts; every quest's outline word for word; the same shop messages (one fewer on removing the ★ quest).

### Tests for phases 4 to 6
- `tests/rules.html`: 171 rules tests (81 new: Notice Board, Ritual and Arenas).
- `tests/e2e/phase4.test.js` (64 checks), `phase5.test.js` (53) and `phase6.test.js` (79). All pass.
- The earlier click-throughs (phases 1 to 3) still pass.
- **Not tested here:** the live Knightly Treasures link (this sandbox can't reach Matt's database, and tests never write to it), the films playing (the test browser can't play MP4s), hearing the sounds, Edge itself and the TV. These are on Harry's checklist.

### Phase 3: Pelagosi Puzzle Trials (26 September 2026)
- **Rebuilt as it was:**
  - **The Marker Remembers:** three rounds of 3, 4 and 5 runes at the old speeds, the same five runes, the DC 12 Dexterity surge, and the Marker sinking at the end with its tremor and cavern sound.
  - **The Tidal Sequence:** the same starting disorder, the Flow → Echo ↓ Depth ← Stone ↑ solution, the basin answer (Current), and pressure from Calm to Surge with the same hints and DCs. Shuffle Pillars never lands on the answer.
  - The same wording everywhere, the same pop-ups, art, sounds, flashes and drifting light. It saves nothing, as before.
- **Your answers:**
  - P1: laid out for you clicking on the laptop. It fits the TV too.
  - P2: the five missing Tidal sounds each have a ready-made slot and stay silent until you supply them. The note in `tools/pelagosi/assets/audio/` lists their names.
  - P3: a double-clicked Memory rune still counts twice.
  - P4: pressure still carries into the basin step, and Reset still restarts Memory straight away but sends the Tidal Sequence back to BEGIN (KNOWN_ISSUES PEL-18).
- **Fixed (they broke the tool or applied something twice):**
  - Leftover timers. In the old tool, Reset, switching puzzle, or starting again during an animation left old timers running. The puzzle could then skip to round II, restart twice, unlock itself, or pop up a success window over a fresh puzzle. Each puzzle now has its own set of timers, cancelled whenever it's reset, restarted, switched away from or closed (PEL-01 to 06, 09 to 11).
  - A double click on CHECK ALIGNMENT counted as two checks. It now counts once (PEL-07).
  - Fonts now work offline (PEL-08).
  - The old tool needed scrolling on a laptop. The new three-column layout fits your laptop, full screen and the TV with every button in view, and the chamber keeps its 3:2 shape so the pillars sit on their plinths (PEL-12).
- **Kept as they were:** the solve chime playing twice, BEGIN during a sequence opening the rules over it, and the basin box overlapping the pillar tiles (PEL-15 to 17).
- **Reduce motion:** the shakes, tremors and screen flashes are gentler and the drifting light slower. The rune flashes keep their exact timings, because they're part of the puzzle.
- **Leaving mid-puzzle** asks "Leave the Pelagosi Puzzle Trials?" first.
- **Checked against the old tool:**
  - The Memory sequence is built exactly as the old tool built it, given the same dice (300 sequences).
  - The Tidal counts and checks agree with the old tool on 500 random layouts.
  - A whole Tidal session and a whole Memory trial show the same texts, step by step, as the old tool.
- **Structure:**
  - Content in `tools/pelagosi/data/pelagosi-data.js`, rules in `rules.js`, the screen in `tool.js`, styles in `pelagosi.css`. Every class starts `tsi-pel-`.
  - Art and sounds in `tools/pelagosi/assets/`; the two unused files in `assets/extras/` (listed in `docs/ASSETS.md`).
  - The shared lifecycle helper gained **timer groups** (`life.group()`), described in `docs/BUILDING-A-TOOL.md`, for tools with several animations that must stop separately.
- **Tests:**
  - `tests/rules.html` now has 90 rules tests, including the Pelagosi rules and timer groups.
  - `tests/e2e/phase3.test.js`: 58 click-through checks, including every leftover-timer bug re-created to show it's gone.
  - The phase 1 (65) and phase 2 (31) click-throughs still pass.
  - All pass.

### Phase 2: Clan Crest Creator (25 September 2026)
- **Rebuilt as it was:**
  - Same parts, 12 palettes, 16 sigils, names and mottos.
  - Random Name, Random Crest and Reset.
  - The 2048 × 2048 see-through PNG, named after the clan.
  - It saves nothing, as before.
- **In the suite's look.** Your laptop showed Download half off the screen and Random Crest and Reset below it. The four control groups now sit two by two beside the preview, so every control and Download fit your laptop, full screen and the TV. The hub's painted art shows behind it, as in the old tool.
- **Your answers:**
  - K1 and K2: kept as they were.
  - K3: "of the Scarlett Isles" and the motto "In Scarlett We Stand" have two t's; the "Scarlet" name word and the "Scarlet & Gold" palette keep one.
  - K4: the motto is in Cinzel in the preview and the PNG, with the font packed inside the downloaded picture.
- **Checked against the old tool:**
  - The drawing code was carried across line for line and compared with the old tool's over 12,480 settings, with no differences apart from the planned part names and motto font.
  - Random Crest and Random Name roll the same results from the same dice.
  - A downloaded PNG without a motto is byte-for-byte the old tool's.
- **Structure:**
  - Content in `tools/crest/data/`, rules in `rules.js`, the drawing in `draw.js`, the screen in `tool.js`, styles in `crest.css`.
  - Every rule is scoped to the Crest, and every id starts `tsi-crest-field-` (controls) or `tsi-crest-svg-` (the drawing).
- **Phase 1 fix: the test page is kept apart from the real suite.** `tests/harness.html` now has its own database (`tsi.test`) and its own backups.
  - The real suite refuses test backups, and the test page refuses real ones.
  - Any Demo tool data left in the real database from phase 1 is removed.
  - The test page says "Test page" in the top bar and the browser tab.
- **Tests:**
  - `tests/rules.html` now has 69 rules tests. Among them, three crests the old tool drew must match character for character.
  - `tests/e2e/phase2.test.js`: 31 click-through checks.
  - `tests/e2e/phase1.test.js`: now 65 checks, including the test page's separation.
  - All pass.
- **Found and fixed while building:**
  - A drop-down and a hidden part of the crest drawing were given the same internal name, which made every crest draw darker. Separate prefixes fixed it, and a test now checks that no two ids on the page match.
  - The phase 1 tests assumed no tool was built. They now read which tools are built from the tool list.
- **Found by Harry in Edge (26 September):** one rules test failed because Edge writes its UK dates with a comma ("Friday, 25 September"). The suite now writes dates itself, the same in every browser, and a new test pretends to be Edge to keep it that way (KNOWN_ISSUES SUI-18).


### Phase 1: the shell (25 September 2026)
- **Home screen:**
  - The hub's logo, the name "The Scarlett Isles: D&D Tool Suite" and the tagline "One doorway. Many wonders. Choose your tool.", over the hub's painted art.
  - Eight tool cards with pill tags: DM Tool, World, Players, Set Pieces. Each unbuilt tool says "Coming in phase N" and can't be opened yet.
  - Footer: "© Scarlett Isles Campaign", **Knightly Treasures shop ↗** (needs internet), **Back up everything** and **Restore**.
- **Top bar**, the same on every screen: the crest and suite name (Home), the tool's name, **Switch tool**, and for tools that save, "Saved ✓", **Export** and **Import**.
- **Design system:** `shared/tokens.css` (colours, fonts, sizes, spacing, motion, taken from the hub and Bastion CSS) and `shared/components.css` (buttons, one crimson main button, cards, pill tags, panels, pop-ups, notices, form fields, gold focus ring). Reduce-motion is respected. The fonts are bundled, so nothing loads from the internet.
- **Opening and closing tools:** each tool opens as a fresh page load. There's a lifecycle helper that stops a tool's timers, sounds, videos and listeners. Tools that don't save can ask "Leave …?" first.
- **Saving:**
  - Saves go in the browser's built-in database, named `tsi.suite`, with every key starting `tsi.`.
  - A failed save shows "Not saved" and a warning with Export.
  - A damaged save is set aside, never deleted.
  - A second open tab shows an "Already open" warning.
- **Backups:**
  - **Back up everything** downloads a dated file. **Restore** checks the file, shows what's in it and asks first, offering to download what's there now.
  - Each saving tool gets Export and Import, which check the file the same way.
  - Another tool's file, a random file or a damaged one is refused with a plain-English reason.
- **Player windows:** `player.html` and a postMessage link. It recovers when either window is refreshed, reconnects when the tool's page reloads, and closes when you leave the tool. Tested from double-clicked files.
- **Errors:** a plain-English bar with Details and Reload.
- **Tests:**
  - `tests/rules.html` has 45 rules tests; double-click to run.
  - `tests/e2e/phase1.test.js` has 58 click-through checks at the laptop, full-screen laptop, TV and small-window sizes, with the internet off.
  - `tests/harness.html` adds a pretend Demo tool for testing the shell. All tests pass.
- **Docs:** `docs/BUILDING-A-TOOL.md` explains how each tool plugs into the shell. `docs/PLAN.md`'s folder layout is updated to match what was built.
- **Found and fixed while testing:**
  - Tool names starting with "The" would have read "the The Ironbow Bastion Manager".
  - Notices first sat over the middle of the screen, covering tool buttons. They now sit in the bottom-right corner.
  - The painted art was briefly hidden behind the page's own background.
  - The double-click guard ignored a wait of zero (found by the rules tests).


### Planning session (25 September 2026)
- **Old repos:** all nine cloned read-only into `_legacy/`, which is now in `.gitignore`. Each is at exactly the commit the handover reviewed.
- **Ritual films:** the four films downloaded from the `v1.1-ritual-endings` release into `_legacy/_ritual_release/`. They're not committed; they're copied in during phase 5.
- **Survey:** each tool was surveyed from a double-clicked file in Chromium and independently re-checked. The old hub page and the Bastion's CSS were used for the design system, and a separate audit found where the tools' code would clash.
- **Suite-wide tests:**
  - Script loading, `fetch`, Workers and storage limits from `file://`.
  - IndexedDB.
  - Player windows with `postMessage`, including reload and refresh recovery.
  - Canvas taint, bundled PDF.js and downloads.
  - The results are in the appendix of `docs/PLAN.md`.
- **Plan:** version 1 went to Harry. He answered the 14 questions; version 2 builds them in.
- **CLAUDE.md** updated to match Harry's answers:
  - The suite's name.
  - Screen sizes, and Edge first.
  - The one Knightly Treasures Firebase link, with its settings-file exception.
  - Clickable links allowed.
  - The Ritual films play in-page.
  - The Set Pieces group.
  - Copy all art.
  - The old-save import phase removed.

## Next
**Phase 7a: Combat Tracker desk** (with Harry's go-ahead), then 7b, the Battlemap. It's the first tool with a two-way player window, the PDF reader and large maps, and it must work on the TV. Its "done when" lists are in `docs/PLAN.md` section 4. Before it starts, Harry answers C1–C11 (C6 has no default).

## Open questions for Harry

Each tool's questions are needed before that tool's phase. The full wording and defaults are in `docs/PLAN.md` section 6.

- **Clan Crest Creator (phase 2):** answered (K1–K4).
  - One small follow-up: the Crest saves nothing, so leaving it loses the current design. As the plan says, it doesn't ask "Leave?" first, just like the old tool. Would you like it to ask when you've changed the design?
- **Pelagosi Puzzle Trials (phase 3):** answered (P1–P4).
  - When you have the five Tidal sounds, give them to a session and ask it to add the Pelagosi sounds.
- **Notice Board (phase 4):** answered (N1–N5).
- **Heartwood Ritual (phase 5):** answered (R1–R10).
- **Arenas (phase 6):** answered (A1–A9).
  - Three kept behaviours you're likely to notice at the table: a cancelled turn still uses up that player's go (ARN-14); the gold under the arena catches up only after the next change (ARN-25); and changing the Arena or Round list mid-round restarts it without asking (ARN-27). Say if you'd like any changed.
- **Combat Tracker (phase 7):** C1–C11. **C6 has no default:** fix the line-of-sight cones, or leave them out?
- **Explorer (phase 8):** E1–E16
- **Bastion (phase 9):** B2–B13 and B15–B24. **B2 has no default:** one or three Host Delegation rolls?

## Notes for future sessions
- **Old code:** re-clone the old repos into `_legacy/` if they're missing (the links are in handover section 16). Download the Ritual films from the release.
- **Testing:** the sandbox's Playwright Chromium can't play MP4s, and it can't reach the Firebase database or the shop. Put those checks on Harry's Edge checklist.
- **Matt's database:** never write to the live Knightly Treasures database while testing.
- **Building a tool:** follow `docs/BUILDING-A-TOOL.md`. Set `built: true` in `shared/data/tools.js` and the card, the Switch tool menu, Export/Import and backups all follow.
- **Running the tests:** double-click `tests/rules.html`, or run `NODE_PATH=/opt/node22/lib/node_modules node tests/e2e/phaseN.test.js` for each phase in this sandbox (see `tests/e2e/README.md`). Re-run every earlier phase's click-through after changing anything in `shared/`.
- **Browser differences:** don't rely on the browser's own date or number formats (`toLocaleDateString` and the like); Edge's differ from the test browser's. Write them out in code, as `TSI.dates` does.
- **Not tested here:** Edge itself, the TV, and Windows' "Animation effects" switch (the reduce-motion setting was simulated). Phase 2 adds opening a downloaded crest PNG in another program. These are on Harry's checklist in each pull request.
- **Old-tool comparisons:** each tool's click-through compares it with the old tool when that tool is in `_legacy/` (see `tests/e2e/README.md`). Re-clone the old repo before changing a built tool.
- **Timers in tools with several animations:** use a `life.group()` per puzzle, scene or round, and clear it on reset, restart and switch (see `docs/BUILDING-A-TOOL.md`).
- **Clock control in tests:** `phase6.test.js` controls the page's clock (Playwright's `page.clock`) to move the 5-second pictures on. Its fast-forward sometimes moves the page's clock by less than asked, so the test checks and repeats (`passTime`).
- **Fixed dice in tests:** the Arenas (like the old tool) make each opponent's id from a roll plus the time. If a test fixes the dice before a round starts, the opponents share an id and the target list can't tell them apart. Use varied dice (`__seed`) whenever a round starts.
- **The Notice Board's shop link in tests:** `phase4.test.js` plays Matt's database with a stand-in. Never point a test at the real one.
- **Sound in tests:** the test browser can load the sounds but nobody hears them. The Pelagosi test records which sounds start and when; hearing them is on Harry's checklist.
