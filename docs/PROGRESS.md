# Progress

## Where things stand

**Phase 2 (Clan Crest Creator) is built and tested. Phase 3 (Pelagosi Puzzle Trials) is next, and waits for Harry's go-ahead and his answers to P1–P4.**

Double-click `index.html` to open the suite. The Clan Crest Creator opens from its card. The other six tools say "Coming in phase N" until their phases are done. The plan is in `docs/PLAN.md`, the bug list in `docs/KNOWN_ISSUES.md`, and the notes for building each tool in `docs/BUILDING-A-TOOL.md`.

## Done

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
  - `tests/rules.html` now has 68 rules tests. Among them, three crests the old tool drew must match character for character.
  - `tests/e2e/phase2.test.js`: 31 click-through checks.
  - `tests/e2e/phase1.test.js`: now 65 checks, including the test page's separation.
  - All pass.
- **Found and fixed while building:**
  - A drop-down and a hidden part of the crest drawing were given the same internal name, which made every crest draw darker. Separate prefixes fixed it, and a test now checks that no two ids on the page match.
  - The phase 1 tests assumed no tool was built. They now read which tools are built from the tool list.


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
**Phase 3: Pelagosi Puzzle Trials** (with Harry's go-ahead). It proves that timers and sounds stop cleanly. Its "done when" list is in `docs/PLAN.md` section 4. Before it starts, Harry answers P1–P4.

## Open questions for Harry

Each tool's questions are needed before that tool's phase. The full wording and defaults are in `docs/PLAN.md` section 6.

- **Clan Crest Creator (phase 2):** answered (K1–K4).
  - One small follow-up: the Crest saves nothing, so leaving it loses the current design. As the plan says, it doesn't ask "Leave?" first, just like the old tool. Would you like it to ask when you've changed the design?
- **Pelagosi Puzzle Trials (phase 3):** P1–P4
- **Notice Board (phase 4):** N1–N5
- **Heartwood Ritual (phase 5):** R1–R10. **R2 has no default:** when should the Husk roll happen?
- **Arenas (phase 6):** A1–A9
- **Combat Tracker (phase 7):** C1–C11. **C6 has no default:** fix the line-of-sight cones, or leave them out?
- **Explorer (phase 8):** E1–E16
- **Bastion (phase 9):** B2–B13 and B15–B24. **B2 has no default:** one or three Host Delegation rolls?

## Notes for future sessions
- **Old code:** re-clone the old repos into `_legacy/` if they're missing (the links are in handover section 16). Download the Ritual films from the release.
- **Testing:** the sandbox's Playwright Chromium can't play MP4s, and it can't reach the Firebase database or the shop. Put those checks on Harry's Edge checklist.
- **Matt's database:** never write to the live Knightly Treasures database while testing.
- **Building a tool:** follow `docs/BUILDING-A-TOOL.md`. Set `built: true` in `shared/data/tools.js` and the card, the Switch tool menu, Export/Import and backups all follow.
- **Running the tests:** double-click `tests/rules.html`, or run `NODE_PATH=/opt/node22/lib/node_modules node tests/e2e/phaseN.test.js` for each phase in this sandbox (see `tests/e2e/README.md`). Re-run every earlier phase's click-through after changing anything in `shared/`.
- **Not tested here:** Edge itself, the TV, and Windows' "Animation effects" switch (the reduce-motion setting was simulated). Phase 2 adds opening a downloaded crest PNG in another program. These are on Harry's checklist in each pull request.
- **Old-tool comparisons:** `tests/e2e/phase2.test.js` compares the Crest with the old tool when `_legacy/clan-crest-creator` is there. Re-clone it before changing `tools/crest/`.
