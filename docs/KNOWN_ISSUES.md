# Known issues

Every bug found in the eight old tools during planning, and what the rebuild will do about each one. CLAUDE.md's rule: **only fix a bug if it breaks the tool, loses saved data, or applies something twice.** Everything else stays exactly as it was, and is listed here for Harry to decide on later.

**Status: phases 1 (the shell), 2 (Clan Crest Creator), 3 (Pelagosi Puzzle Trials) and 4 (Notice Board) are built.** The shell's share of the suite-wide (SUI) fixes is in place and tested, and each entry has a **Phase 1** line saying what's done. Every Clan Crest Creator entry has a **Phase 2** line, every Pelagosi entry a **Phase 3** line and every Notice Board entry a **Phase 4** line, saying whether it was fixed, changed or kept. The other tools' entries are unchanged until their phases. Each tool's session updates its own entries as it goes: it marks each one fixed, or confirms it was left alone, and adds anything new it finds.

## How to read an entry

- **Decision** is one of:
  - **Must fix:** it breaks the tool, loses saved data, applies something twice, or stops the tool working from a double-clicked file.
  - **Fixed by the new design:** the suite's shared structure removes the problem without extra work in the tool, for example shared pop-ups, scoped styles or tidy shutdown.
  - **Deliberate change:** behaviour changes on purpose because of a CLAUDE.md rule or Harry's answer.
  - **Later, Harry's call:** kept exactly as it is, because it's a rule, lore or behaviour question. The question number in `docs/PLAN.md` section 6 is given where there is one.
  - **No longer relevant:** doesn't apply to the suite, for example it only affected old saves.
  - **Checked: not a bug:** the second check disproved it.
- **Before / After:** what happens in the old tool, and what the rebuild will do.
- **Evidence:** `file:line` references point into the old repo in `_legacy/<repo>`. Names like `t2.js` or `run2.js` are test scripts from the planning session. They aren't in the repo; the finding is described in words beside them.
- IDs (e.g. `ENC-03`) stay fixed, so sessions and pull requests can refer to them.

## Summary

| Tool | Must fix | Fixed by design | Deliberate | Later (Harry's call) | Not relevant / not a bug |
|---|---|---|---|---|---|
| Suite-wide (SUI) | 5 | 11 | 2 | 0 | 0 |
| Combat Tracker & VTT Battlemap (ENC) | 13 | 0 | 0 | 15 | 0 |
| Notice Board Quest Generator (QST) | 7 | 5 | 1 | 11 | 2 |
| Scarlett Isles Explorer (EXP) | 12 | 3 | 0 | 12 | 0 |
| The Ironbow Bastion Manager (BAS) | 15 | 1 | 1 | 18 | 0 |
| Clan Crest Creator (CRS) | 0 | 4 | 2 | 7 | 1 |
| Arenas of The Scarlett Isles (ARN) | 8 | 2 | 0 | 17 | 0 |
| The Heartwood Ritual (RIT) | 9 | 1 | 0 | 15 | 1 |
| Pelagosi Puzzle Trials (PEL) | 11 | 1 | 0 | 6 | 0 |

(The counts are worked out from the entries below. If they ever disagree, the entries win.)

## Not tested during planning (limitations)

- **Edge itself.** Testing used Chromium, the engine inside Edge. Edge-specific checks are on Harry's lists.
- **Video playback.** The test browser can't play MP4s (a licensing gap Edge doesn't have). Films and weather videos are checked by Harry in Edge.
- **Firefox.** Not available in the sandbox. Firefox isn't required (Harry uses Edge); record any Firefox problems here if found.
- **The live Knightly Treasures link.** The sandbox's network rules block `*.firebaseio.com` and `mattjowen1991-hue.github.io`. Checked by Harry in Edge in phase 4.
- **The older `v1.0-ritual` release.** Its files couldn't be listed. The current Ritual only uses `v1.1-ritual-endings`.
- **DM-session-hub.** The handover (section 3) mentions this old copy of the Bastion. It wasn't cloned (question B24).

---

## Suite-wide

These come from checking the eight tools against each other: the collision audit, the design extraction, and the storage and file tests.

### SUI-01 · Tools' code names clash when they share one page
**Fixed by the new design**
- **Before:** Four tools put 49–174 names each in the page's shared space (`state`, `$`, `STORAGE_KEY`, `startRound`, `setStatus`…). Loaded together, the second tool refuses to start, or a button silently runs the other tool's code. Inline `onclick` text in the Ritual, Bastion and Explorer relies on page-wide names.
- **After (planned):** Each tool lives in its own namespace (`window.TSI.<tool>`) with `start()`/`stop()`, and only one tool is loaded per page load. Inline `onclick` handlers become normal listeners.
- **Evidence:** Collision audit, planning session. Tested by loading two tools into one page.
- **Phase 1:** Done in the shell. Only one tool is loaded per page load, and tools register through `TSI.registerTool` with their code under `window.TSI.<tool>`. Tested with the Demo tool in `tests/harness.html`.

### SUI-02 · Styles leak between tools
**Fixed by the new design**
- **Before:** 44 class names are shared by 2–7 tools with different looks (`.btn`, `.modal`, `.panel`, `.hidden`…). Every tool styles `body`, bare buttons and inputs. The Ritual's `.modal` would hide the Arenas and Pelagosi pop-ups. 22 CSS variables share names but mean different things (`--ink` is dark in some tools, light in others).
- **After (planned):** Every tool's classes are prefixed and scoped under its own root. One shared token set. A tool's styles load only while it's open.
- **Evidence:** Collision audit.
- **Phase 1:** All shared styles are prefixed `tsi-`, and a tool's styles load only while it's open. Each tool prefixes and scopes its own in its phase (`docs/BUILDING-A-TOOL.md`).

### SUI-03 · Things keep running after a tool is closed
**Fixed by the new design**
- **Before:** After its screen was removed, the Ritual heartbeat and the Arenas crowd kept playing, Pelagosi's timers kept firing (pop-ups over other screens), Explorer's 5 page-wide listeners stayed attached, and the Ritual and Pelagosi left classes on `<html>`/`<body>`.
- **After (planned):** Each tool opens with a fresh page load (`index.html?tool=…`). Each tool also has a `stop()`, and a shared lifecycle helper tracks timers, sounds, videos and listeners.
- **Evidence:** Collision audit (runtime tests).
- **Phase 1:** Done and tested. Each tool opens with a fresh page load. Before leaving, the shell calls the tool's `stop()`, then stops everything the lifecycle helper tracks (timers, animation frames, listeners, key shortcuts, sounds, videos), closes pop-ups and player windows, and saves. Tests: `tests/rules.html` (Lifecycle) and the "closing a tool stops…" click-through.

### SUI-04 · Keyboard shortcuts fire while typing
**Fixed by the new design**
- **Before:** Typing "Nell never ends" moved the Ritual from round 1 to 4 (N, E). The battlemap swallowed spaces, and Explorer hid its controls on "h".
- **After (planned):** Shortcuts only work in their own tool and never while a text box has focus.
- **Evidence:** Collision audit (runtime test).
- **Phase 1:** Done and tested. `life.onKey` ignores key presses while a text box has focus or a pop-up is open.

### SUI-05 · The small browser storage is shared by every file on the laptop and fills silently
**Fixed by the new design**
- **Before:** In Chromium, every double-clicked page shares one storage area of about 5.24 million characters (measured). One 4 MB battlemap fills it. Most old tools then fail to save with no message (Tracker, Notice Board, Explorer, Bastion); Arenas strips every portrait.
- **After (planned):** Saves go in the browser's built-in database (IndexedDB), whose names start with `tsi.`. A save failure shows a clear warning.
- **Evidence:** Measured in Chromium from file://. IndexedDB worked with hundreds of MB free and is also shared by every file:// page, hence the `tsi.` prefix.
- **Phase 1:** Done and tested. Saves go in the browser's built-in database (`tsi.suite`). A failed save shows "Not saved" and a warning with an Export button, and it retries on the next change; tested with storage pretending to be full. If the database can't be used, the suite falls back to the small storage and says so, and if that fails too it warns that nothing is being saved.

### SUI-06 · Two open copies overwrite each other's saves
**Fixed by the new design**
- **Before:** Tested in the Tracker and the Notice Board: whichever copy saves last wipes the other's changes.
- **After (planned):** One saver per tool; a second tab shows a "suite already open" warning.
- **Evidence:** Tracker test5.js; Notice Board v2 test D.
- **Phase 1:** Done and tested. Both tabs show an "Already open" warning, which goes when one closes. Switching tools or reloading never sets off a false warning. It warns rather than blocks: both tabs can still save, so Harry closes one.

### SUI-07 · Error details are hidden on double-clicked pages
**Fixed by the new design**
- **Before:** Chromium reports errors from separate script files on file:// pages only as "Script error.", so failures are silent.
- **After (planned):** The shell catches each tool's errors itself and shows a plain-English bar.
- **Evidence:** Collision audit (runtime test).
- **Phase 1:** Done and tested. Errors show a plain-English bar with Details and Reload. Errors in a tool's start and stop, and in anything run through the lifecycle helper, show full details. Other errors still show the bar, but may only say "Script error."

### SUI-08 · Fonts come from Google (seven tools)
**Must fix** · won't work offline
- **Before:** The Tracker, Notice Board, Explorer, Bastion, Arenas, Ritual and Pelagosi load fonts from Google Fonts. Offline, they fall back to plain system fonts.
- **After (planned):** The fonts are bundled unmodified in `shared/fonts/` with their SIL OFL licences.
- **Evidence:** Every tool's runtime test (ERR_CERT_AUTHORITY_INVALID for fonts.googleapis.com).
- **Phase 1:** Fixed for the whole suite: the fonts are bundled in `shared/fonts/`. Tested with the internet off; nothing loads from the internet.

### SUI-09 · Data and pictures can't be loaded from a double-clicked file
**Must fix** · won't work double-clicked
- **Before:** `fetch()` of local JSON is blocked, so the Notice Board, Explorer, Bastion and Arenas don't work. A "GitHub Pages" path helper builds wrong folders (`file:///home/…`) in the Explorer, Bastion and Ritual.
- **After (planned):** Data becomes `.js` files loaded with plain script tags, and every path becomes a plain relative path.
- **Evidence:** Per-tool entries below.
- **Phase 1:** The shell loads each tool's files with plain script tags and relative paths, and never uses `fetch()`. Each tool's data is converted to `.js` files in its phase.

### SUI-10 · Layouts don't fit Harry's laptop or the TV
**Must fix** (layout requirement)
- **Before:**
  - The Bastion needs 1,754 px of width.
  - The Notice Board outline is cut off below 1,600 px.
  - The Ritual's Silence buttons are off-screen in normal laptop windows.
  - The Pelagosi Check button is below the fold at every size.
  - The Arenas rules panel is clipped on short screens.
- **After (planned):** Every tool fits the laptop (about 1707 × 930 in a maximised Edge window, pixel ratio 1.5) with no sideways scrolling and its main controls in view. The Explorer, Combat Tracker/Battlemap and Bastion also fit the TV (1920 × 1080), including when a window moves between the screens.
- **Evidence:** Layout measurements in the planning session. Harry's answer 4.
- **Phase 1:** The home screen fits the laptop window (1707 × 930), full screen (1707 × 1067), the TV (1920 × 1080) and a smaller window (1280 × 720), with no sideways scroll. Each tool is checked in its phase.

### SUI-11 · Body text is set in capitals
**Deliberate change** (CLAUDE.md "sleeker")
- **Before:** 92.5% of the Bastion's visible words are in Cinzel, which has no lower-case letters, plus 15 `text-transform: uppercase` rules.
- **After (planned):** Body text is in Cormorant Garamond, in sentence case. Capitals only for headings, labels and buttons. Log text stays exactly as the rules code writes it.
- **Evidence:** Design extraction.
- **Phase 1:** The shared components follow this. Each tool in its phase.

### SUI-12 · The Bastion's focus ring is accidentally pink-red, and its hover and pill styles contradict each other
**Deliberate change** (Harry's answer 14)
- **Before:** A later CSS rule overrides the intended gold focus ring with pink-red, and the hover border with white. `.pill` is defined three times.
- **After (planned):** One gold focus ring and one set of button and pill styles from the shared tokens.
- **Evidence:** bastion_manager/styles.css:110-121, 135-139, 270, 1021, 1209.
- **Phase 1:** Done in the shared styles: one gold focus ring, one button and pill style.

### SUI-13 · Buttons without a class show in Arial
**Fixed by the new design**
- **Before:** The compendium list, compendium search and modal ✕ in the Bastion don't inherit the page font.
- **After (planned):** The shared base style sets `button, input, select { font: inherit }`.
- **Evidence:** Design extraction.
- **Phase 1:** Done in the shared base styles.

### SUI-14 · No tool respects the reduce-motion setting
**Fixed by the new design**
- **Before:** 24 `@keyframes` across five tools, and no `prefers-reduced-motion` rule anywhere.
- **After (planned):** Shared animation lengths drop to zero under reduce-motion; signature animations slow down (Harry's answer 8).
- **Evidence:** Design extraction.
- **Phase 1:** Done for the shared styles and tested: with "reduce motion" on, the home cards don't move on hover. The tokens give tools `--tsi-signature-slowdown` for their own animations.

### SUI-15 · Crimson used as text is hard to read
**Fixed by the new design**
- **Before:** Crimson text reaches only 2.5–2.9:1 contrast on the dark backgrounds, and gold on crimson 3.5:1.
- **After (planned):** Crimson is never used for text; primary buttons carry parchment-coloured text. Everything else measured passes.
- **Evidence:** Contrast measurements in the design extraction.
- **Phase 1:** The shared components follow this (the crimson main button has parchment text). Each tool in its phase.

### SUI-16 · Too many "main" buttons
**Fixed by the new design**
- **Before:** The Bastion shows 5 crimson primary buttons at once and Arenas 3; the Notice Board makes every button crimson.
- **After (planned):** One filled crimson main action per panel; the others are outlined gold.
- **Evidence:** Design extraction.
- **Phase 1:** The shared components provide one crimson main button style. Each tool in its phase.

---


### SUI-17 · The test page shared its saved data and backups with the real suite
**Must fix** · could mix test data into real saves (found after phase 1; Harry asked for the fix)

- **Before:** In phase 1, `tests/harness.html` (the test page with the pretend Demo tool) saved into the same browser database as the real suite. Its Demo tool data could appear in "Back up everything", and a test backup could be restored into the real suite.
- **After:** Fixed in phase 2. The test page has its own database (`tsi.test`), its own small-storage names and its own "already open" list. Its backups are marked as test backups (`"space": "test"`) and named `tsi-test-…`. The real suite refuses test backups and the test page refuses real ones. Any Demo tool data left in the real database is removed when the suite opens, and left out if an older backup holds it. The test page says "Test page" in the top bar and the browser tab.
- **Evidence:** tests/e2e/phase1.test.js "The test page is kept apart from the real suite"; tests/rules.html "Saving: the test page is kept apart" and "Backups: the test page is kept apart".


### SUI-18 · Dates in pop-ups read differently in Edge ("Friday, 25 September")
**Fixed** · found by Harry's phase 2 check of `tests/rules.html` in Edge

- **Before:** The suite asked the browser for its own UK date format. Edge writes "Friday, 25 September 2026" (with a comma) and the test browser "Friday 25 September 2026", so one rules test failed in Edge only. The dates appear in the Restore and Import pop-ups and the save-status tooltip.
- **After:** Dates are written out by the suite itself, "Friday 25 September 2026 at 14:03", the same in every browser. A new rules test pretends to be Edge to make sure of it.
- **Evidence:** `shared/js/core.js` (`TSI.dates.human`); `tests/rules/core.test.js` "dates read the same in every browser".

## Combat Tracker & VTT Battlemap
Old repo: `_legacy/scarlettisles-encounter-tracker` (file:line references point there).

### ENC-01 · Complete Turn keeps going after an error
**Must fix** · applies something twice · listed in the handover

- **Before:** If you type damage plus a condition with Turns set to 0 or less, the damage is applied and you get 'Turns must be 1 or more'. The condition is skipped, but the turn still moves on. When you fix the number and press Complete Turn again, the turn moves on a second time, so the next creature loses its turn. A creature knocked to 0 HP this way is also not marked DEFEATED.
- **After (planned):** Check every input first. If anything is invalid, change nothing, show the message and don't advance. Keep this in the separated rules file.
- **Checker's note:** Nuance: the DEFEATED mark is applied on the retry if the same target is still selected. The 'Damage must be a number' branch cannot be reached in Chromium: bad text in the number box reads as empty and is silently ignored (t11).
- **Evidence:** app.js:309-312 returns before the defeated check at 327; app.js:914-942 carries on regardless. The damage-not-a-number branch (292-295) behaves the same but is rarely reachable. test2.js: Aria 30→25, turn went Aria→Goblin a; the retry went Goblin a→Borin; Goblin a at 0/7 with no DEFEATED.

### ENC-02 · Healed creatures stay DEFEATED and never get another turn
**Must fix** · breaks the tool · listed in the handover

- **Before:** Once anyone hits 0 HP they are marked DEFEATED. Healing them later raises their HP but they keep the DEFEATED badge and are skipped forever, and a healed monster stays off the map. You can't fix it mid-fight without pausing, removing and re-adding them, which loses their place.
- **After (planned):** Clear the defeated mark when healing takes HP above 0. The exact policy, including PCs at 0 HP, needs Harry's answer.
- **Decision note:** C2 sets the exact rule (default: clear DEFEATED when healed above 0; PCs at 0 still skipped).
- **Checker's note:** Needs Harry's policy on when the mark clears, and whether PCs at 0 HP get turns for death saves.
- **Evidence:** app.js:327 sets defeated; nothing clears it. app.js:232 skips defeated; vtt.js:652 hides defeated monsters. test2.js: Borin 0→10 HP still [DEF]; the next 6 turns went Goblin→Aria→Goblin→Aria→Goblin→Aria.

### ENC-03 · Tokens slide off their map squares when you zoom, resize or go fullscreen
**Must fix** · breaks the tool

- **Before:** Token positions are stored relative to the window, not the map picture. Zooming makes every token land on a different part of the map. Resizing the window or going fullscreen shifts them too, for example after placing tokens and then putting the window fullscreen on the TV. Revealed fog follows the same wrong positions.
- **After (planned):** Store token and fog positions in map-picture coordinates that don't change with zoom or window size. The handover's acceptance check requires alignment after resize, fullscreen, zoom and reload.
- **Checker's note:** Ctrl+wheel zoom hides the problem until the next redraw, then tokens jump (t3). The handover's acceptance check requires alignment.
- **Evidence:** vtt.js:476-493 divides by zoom; vtt.css:74-82 fits the map picture separately. test4.js: token at (0.839, 0.801) of the map moved to (0.805, 0.801) at 1100px wide, (0.934, 0.813) at 1500x700, (0.800, 0.788) fullscreen, and (0.567, 0.565) at zoom 1.45. Snap also uses the on-screen token size (vtt.js:851), so it lands off-grid while zoomed.

### ENC-04 · Maps near 4 MB silently fail to save or show
**Must fix** · breaks the tool

- **Before:** The limit says about 4 MB, but maps from roughly 3.8 MB upwards don't fit in the browser's small storage. Nothing appears and there is no message.
- **After (planned):** Store the map picture in IndexedDB (tested from file://) and show a clear message if saving ever fails.
- **Decision note:** C9. Map pictures move to the browser's built-in database.
- **Checker's note:** The real ceiling is about 3.93 MB with otherwise empty storage. After a failure, the file picker keeps the same file, so choosing it again does nothing.
- **Evidence:** vtt.js:519-535 and 150 (no try/catch). test3.js: a 4,072,528-byte PNG gave pageerror 'Setting the value of encounterTracker.vtt.mapImage exceeded the quota'; the map was not stored or shown. Storage limit measured at 5,242,880 characters, shared by all file:// pages.

### ENC-05 · When browser storage is full, changes silently don't save
**Must fix** · loses saved data

- **Before:** If the shared browser storage is nearly full (a big map could do it, and in the suite all eight tools share it), adding or changing anything fails with no message. The change is lost on reload.
- **After (planned):** The shared save system catches failures and warns. Big items go to IndexedDB.
- **Checker's note:** A 3.6 MB map alone leaves only about 435K characters for every file:// page, so all eight suite tools would share what is left.
- **Evidence:** app.js:127-133 and vtt.js:227-229 have no try/catch. test7.js: with storage nearly full, Add to Library threw 'exceeded the quota'; the entry was not shown and was gone after reload.

### ENC-06 · Two tracker windows overwrite each other's saves
**Must fix** · loses saved data

- **Before:** The battlemap window has a 'Back to Tracker' link that opens a second tracker inside it. With two trackers open, whichever saves last wipes out what the other added.
- **After (planned):** Remove the link from the map window. In the suite, have one saver per tool and warn if the suite is open twice.
- **Checker's note:** Clicking Battlemap in the popup's tracker then turns the popup back into vtt.html, because it is the named window.
- **Evidence:** vtt.html:22. app.js saves its whole in-memory copy (127-133) and never listens for changes. test5.js: one entry added in each window; only 'FromWindowB' survived.

### ENC-07 · A bad import file breaks the whole tracker until Reset
**Must fix** · breaks the tool

- **Before:** Importing a JSON file with a combatant that has no name is accepted and saved. The tracker then shows nothing, even after reloading, until you press Reset and lose everything.
- **After (planned):** Check each imported entry and skip or reject bad ones with a message.
- **Checker's note:** The 'Campaign imported.' alert at 1029 never appears because render throws first. A nameless entry only crashes when another entry of the same type exists (comparator 426).
- **Evidence:** app.js:1003-1025 accepts entries without a name; app.js:426 a.name.localeCompare throws. test2.js: pageerror 'Cannot read properties of undefined (reading 'localeCompare')'; library and board empty after reload.

### ENC-08 · A damaged save is silently deleted
**Must fix** · loses saved data

- **Before:** If the saved data is ever damaged, the tracker quietly deletes all of it and starts empty. The battlemap likewise resets and overwrites its settings.
- **After (planned):** Keep a copy of an unreadable save and tell the user, rather than deleting it.
- **Checker's note:** The old tool itself never writes bad JSON, so the trigger is outside it (hand edits, another page writing the key). It is still worth guarding in the shared save layer.
- **Evidence:** app.js:96-99; vtt.js:220-222. test7.js: a corrupted save left the key deleted (null).

### ENC-09 · PDF import needs the internet
**Must fix** · won't work double-clicked / offline

- **Before:** The PDF reader is fetched from the web, so without Wi-Fi 'Import PDF' just says 'pdf.js failed to load.'
- **After (planned):** Bundle PDF.js 3.11.174 locally with its licence.
- **Checker's note:** The name guess picks up the next capitalised word, as the survey says.
- **Evidence:** index.html:264-270; test2.js alert. test_pdf.js: with PDF.js bundled locally it works from a double-clicked file ('Imported: Goblin Boss Small (HP 21)').

### ENC-10 · Fancy heading fonts need the internet
**Must fix** · won't work double-clicked / offline

- **Before:** The Cinzel fonts come from Google, so offline the headings and buttons fall back to a plain serif.
- **After (planned):** Bundle the fonts in the shared design tokens.
- **Evidence:** styles.css:7; test1.js request failed; computed font falls back to Georgia.

### ENC-11 · Offline cache and install button don't work from a file
**Must fix** · won't work double-clicked / offline

- **Before:** The 'install as app' and offline cache only worked on the website. From a file they just log an error.
- **After (planned):** Remove them. They aren't needed from a local folder.
- **Checker's note:** Not really a blocker: it only logs a warning. It is simply removed.
- **Evidence:** app.js:1090-1114; sw.js; test1.js warning 'The URL protocol of the current origin ('null') is not supported'.

### ENC-12 · 'Monsters: Above fog' does nothing
**Must fix** · breaks the tool

- **Before:** The battlemap has a button to show monsters on top of the fog of war. Pressing it changes the label, but the monsters stay hidden under the fog exactly as before.
- **After (planned):** In the rebuild, put above-fog monster tokens in a layer above the fog canvas. This is a feature the handover requires; if Harry prefers a strict rebuild, record it as 'other'.
- **Evidence:** vtt.js:664-667 gives monster tokens z-index 30, but they sit inside #tokenLayer (z-index 10, a stacking context: a layer its contents cannot rise above; vtt.css:92-96), and the fog canvas at z-index 20 is its sibling (vtt.css:98-103, vtt.js:345). t6.js pixel at the goblin: [14,4,5] with Under and [14,4,5] with Above, against [141,49,56] with the fog revealed. shots/t6_monsters_above_fog.png

### ENC-13 · Double-clicking action buttons does the action twice
**Must fix** · applies something twice

- **Before:** A quick double-click on Complete Turn moves on two turns, so a creature silently loses its go. Double-clicking Add Selected adds everyone twice (including a second copy of each PC), and double-clicking Save Current Encounter saves two templates.
- **After (planned):** Ignore a second click that arrives within a moment of the first on these action buttons. This changes no rules. It is user-triggered, so confirm with Harry that he counts it as a bug.
- **Evidence:** No guard in app.js:914-942, 788-829 or 944-973. t1.js B: dblclick went from Borin's turn to Goblin a in round 2, skipping Aria. t10.js: roster [Aria, Goblin, Aria a, Goblin a]; 2 templates saved ('Encounter 1', 'Encounter 2')

### ENC-14 · Resuming after Pause restarts the fight at round 1
**Later, Harry's call** · other · listed in the handover

- **Before:** The screen says 'Paused. Resume by pressing Begin.' Pressing Begin actually re-sorts everyone, goes back to round 1 and jumps to the top of the order, so you lose your place.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C3
- **Checker's note:** The handover also says not to present this as a true resume. It could be argued to lose saved data (the round and turn position), so it's Harry's call: change the wording or preserve round and turn.
- **Evidence:** app.js:869-891 and 347. test2.js: round 5 on Goblin's turn became round 1 on Aria's turn.

### ENC-15 · LOS cone overlays do nothing
**Later, Harry's call** · other

- **Before:** Clicking 'Add LOS Cone' makes nothing appear and saves nothing. A cone that somehow exists can't be moved or cleared.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C6 (fix it or leave it out; no default). Added minutes before the last commit, so an unfinished extension.
- **Checker's note:** This was an unfinished extension added minutes before the snapshot (a674db3, cee8e6a on 2026-02-24). Handover s.2 says keep incomplete extensions out of scope. Ask Harry to drop it or finish it; it is not a core break.
- **Evidence:** vtt.js:61-66 edits a fresh copy read from storage; vtt.js:227-229 saveVttState() ignores what it is given and saves the in-memory state instead; vtt.js:571-577 re-reads storage. test3.js: 0 cones in page and storage after Add; an injected cone didn't move, and 'Clear overlays' left it in place.

### ENC-16 · Removed map tokens can't be brought back
**Later, Harry's call** · other

- **Before:** Shift+clicking a token removes it from the map, for example for a monster that flees. There is no button to put it back for that encounter.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C7
- **Evidence:** vtt.js:796-802; 'removed' is never cleared anywhere. test3.js: Orc removed; no restore control.

### ENC-17 · Single-token hiding is half-removed
**Later, Harry's call** · other

- **Before:** The map still checks for individually hidden tokens, but no button sets them any more. Only 'hide all monsters' works.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C8
- **Evidence:** vtt.js:674 reads vttState.hidden; nothing writes it except Reveal clearing it (app.js:141, 182). Setter removed in the January 2026 history.

### ENC-18 · Hide/Reveal Monsters buttons are wired twice
**Later, Harry's call** · other

- **Before:** Each click saves twice and refreshes the map twice. It is harmless because the result is the same.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Harmless because the result is the same.
- **Evidence:** app.js:136-142 and 177-183

### ENC-19 · Map's 'Hide monsters' label goes out of step
**Later, Harry's call** · other

- **Before:** After hiding monsters from the tracker, the map's own button still says 'Hide monsters'.
- **After:** Kept as it is in the rebuild.
- **Evidence:** vtt.js:1359-1368 does not update the label (only 1190-1197, 1481-1483 do). test3.js.

### ENC-20 · Fullscreen side buttons don't work while the ruler is on
**Later, Harry's call** · other

- **Before:** In fullscreen with the ruler switched on, clicking Grid and other side buttons starts a measurement instead.
- **After:** Kept as it is in the rebuild.
- **Evidence:** vtt.js:917-929 ignores only #btnMeasure. test6.js: fsBtnGrid click with the ruler on made no change.

### ENC-21 · Space bar blocked on map buttons and can get stuck
**Later, Harry's call** · other

- **Before:** Space can't press a focused button on the map window, and if the window loses focus while Space is held, clicks keep panning. If this code shared a page with text boxes, you couldn't type spaces.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** The stuck-after-losing-focus part is from reading the code (no blur reset), not tested.
- **Evidence:** vtt.js:906-915. test3.js: Space on a focused Grid button did nothing, Enter worked.

### ENC-22 · Explored fog squares ignore the grid nudge and change with grid size
**Later, Harry's call** · other

- **Before:** Revealed squares don't line up with a nudged grid, and changing the grid size moves the revealed areas.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** From reading the code, not run.
- **Evidence:** vtt.js:407-411 draws cells without offX/offY; cells are stored as grid numbers (vtt.js:772-778).

### ENC-23 · Editing a combatant whose name ends in a single letter mangles copies
**Later, Harry's call** · other

- **Before:** Renaming 'Captain K' to 'Captain J' would make the encounter copy 'Captain J K', because the tool thinks ' K' is a copy letter. Copy letters after 'z' become symbols, and removing then re-adding copies can repeat a name. Found by reading the code, not tested.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Now tested, not only read. The suffix-after-z and repeat-after-remove parts are from reading the code (801-803).
- **Evidence:** app.js:749-752, 801-803

### ENC-24 · Reset doesn't clear the battlemap
**Later, Harry's call** · other

- **Before:** The Reset button wipes the library and encounter but leaves the map picture and battlemap settings.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C10
- **Evidence:** app.js:1084-1088; test2.js: the mapImage key remained after Reset.

### ENC-25 · Fog doesn't lift when you drag a PC until you click somewhere else
**Later, Harry's call** · other

- **Before:** When you drag a player's token into a dark area, the darkness doesn't clear around them. It only updates after you click empty map or press a fog button, so the players watching can be left looking at a dark map.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C11 (default: clear the fog when you let go of a token)
- **Evidence:** vtt.js:842-891 (drag move and release) saves positions and explored cells but never calls drawFog. t3.js: drawFog count unchanged through drag and drop; fog alpha 230 at the dropped PC, 2 after a click on empty map

### ENC-26 · Adding combatants mid-fight stops the fight and resets it to round 1
**Later, Harry's call** · other

- **Before:** If you add reinforcements with Add Selected during a running fight, the fight drops back to 'Ready', the round goes back to 1, Complete Turn greys out, and pressing Begin restarts from the top of the order. You lose your place in the fight.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C4
- **Evidence:** app.js:788-829 always sets status 'ready', turnIndex 0 and round 1, and nothing disables Add Selected while running (352-358). t1.js C: 'running round=2 turn=Goblin a' became 'ready round=1 turn=Aria'; Complete Turn disabled; after Begin, round 1 and Aria's turn

### ENC-27 · Tokens with long names snap and reveal fog off-centre
**Later, Harry's call** · other

- **Before:** When a character's name label is wider than their token picture, snapping puts the picture beside the grid corner instead of on it, and the fog circle is centred to one side of the token.
- **After:** Kept as it is in the rebuild.
- **Evidence:** vtt.js:862-869 (snap) and 428-434 (fog circle) assume the picture's centre is at left + picture width/2, but the token box is as wide as its label (vtt.css:106-113). t6.js: 'Lady Seraphine of the Crimson Vale' ended 16.4px off the intersection (token box 228.8px wide, picture 56px); a short name ('Aria') was exactly on it

### ENC-28 · Mistyped damage is silently ignored while the turn still moves on
**Later, Harry's call** · other

- **Before:** If you mistype the damage (for example '5-'), the tool treats it as no damage, gives no warning, and still ends the turn.
- **After:** Kept as it is in the rebuild.
- **Decision note:** May be covered by the Complete Turn "check every input first" fix.
- **Evidence:** The damage box is type=number (index.html:232), so Chromium reports '' for bad text and app.js:290 skips it. t11.js: typing '5-' gave value '' and the turn advanced Aria→Goblin with no damage and no dialog


## Notice Board Quest Generator
Old repo: `_legacy/scarlett-isles-quest-generator` (file:line references point there).

### QST-01 · Quest data can't load from a double-clicked file
**Must fix** · won't work double-clicked / offline

- **Before:** Opened from a folder with no web server, Chrome refuses to read quests.json, so the board stays empty and Generate does nothing.
- **After (planned):** Store the quests as a .js data file loaded with a normal script tag, with a check for 180 records.
- **Checker's note:** Must fix to rebuild: turn the data into a .js file.
- **Evidence:** app.js:683; console 'Fetch API cannot load file:///…/data/quests.json. URL scheme "file" is not supported.' (run1_raw.js, raw_file_load.png)
- **Phase 4:** Fixed. The 180 quests are in `tools/quests/data/quests-data.js`, word for word, loaded with a plain script tag. Tests: "Loaded 180" with the internet off; the rules tests count 180 quests numbered 1 to 180.

### QST-02 · Fonts and Firebase come from the internet
**Must fix** · won't work double-clicked / offline

- **Before:** With no Wi-Fi the special fonts don't load (plain fonts appear instead), and Firebase's code fails to load.
- **After (planned):** Bundle fonts with the suite; delete Firebase.
- **Decision note:** Fonts are bundled. The Firebase library is also bundled locally; its connection to Matt's shop stays online by design (answer 11, Option A) and skips quietly offline.
- **Checker's note:** Neither stops the old tool working: fonts fall back, and the Firebase failure is caught at app.js:23-34. Both still break CLAUDE.md's no-internet rule, so remove Firebase and bundle the fonts.
- **Evidence:** index.html:7-9, 118-119; requestfailed in run1
- **Phase 4:** Fixed. The fonts come from the suite folder. The Firebase library (9.22.0, as before) is stored in `tools/quests/lib/firebase/` and only the Notice Board loads it. With no internet, the only thing the page reaches for is Matt's database, which fails quietly in the background: no error bar, and the Notice Board works fully. (The old tool couldn't even load the library offline; the new one keeps retrying the connection, which is harmless and invisible.) Tests: the page with the internet off, and the ★ with the internet off.

### QST-03 · Players' window keeps showing notices after the board is cleared or emptied
**Must fix** · breaks the tool · listed in the handover

- **Before:** If you press Clear, or decline the last notice, the TV/second screen still shows the old notices until you press Pop-out Board again.
- **After (planned):** The new player page receives the board by postMessage after every change, including an empty board.
- **Checker's note:** There is a third case the survey missed: Generate with no matching quests. The handover asks for this to be fixed (line 117). The postMessage player page fixes it if it also sends empty boards.
- **Evidence:** app.js:744-748 (Clear never updates the popout), 535-538 (empty board returns before the update at 644). Verified: DM 0 / players 3 after Clear; DM 0 / players 1 after declining all.
- **Phase 4:** Fixed. The players' window is sent the whole board after every change, including Clear, declining the last notice and a Generate that finds nothing. Test: "it follows Generate, Decline, Clear and an empty Generate straight away".

### QST-04 · Quest Outline panel cut off on laptop screens
**Must fix** · breaks the tool

- **Before:** On screens narrower than about 1600 pixels, the left edge of the Quest Outline panel is off-screen and you can't scroll to it (115 pixels hidden on a 1366-wide laptop).
- **After (planned):** The rebuilt layout sizes the three columns to fit a laptop screen.
- **Checker's note:** On Harry's likely laptop widths the start of every outline line is unreadable. The new layout fixes it anyway.
- **Evidence:** styles.css:340-349 (fixed minimum column widths, centred); run4_layout.js: leftPanelX -158 at 1280, -115 at 1366, -78 at 1440, -30 at 1536; laptop_1366.png
- **Phase 4:** Fixed. The three columns fit the laptop, full screen and the TV, and each panel scrolls inside itself. Tests at all four sizes.

### QST-05 · Saving isn't protected against errors
**Must fix** · loses saved data

- **Before:** If the browser refuses to save (storage full or blocked), Accept or the star stops working partway. If a save ever gets corrupted, the tool starts with an empty list and overwrites it at the next Accept.
- **After (planned):** The shared save system catches errors and keeps a copy of anything it can't read.
- **Checker's note:** It really is lost data: an accept that looks successful vanishes on reload. It becomes likely in the suite, because every tool shares one storage area of about 5 MB (see missed items). The shared save module must catch failed saves and warn Harry.
- **Evidence:** app.js:48, 119, 127 (setItem not wrapped in try/catch); 114-117 (a corrupt save becomes [] and is overwritten)
- **Phase 4:** Fixed by the suite's saving: a failed save shows "Not saved" and a warning; a save that can't be read is set aside and kept, never deleted. Test: "a damaged save is set aside, not deleted, and Accept still works".

### QST-06 · Pop-out Board stops working after the DM page is reloaded
**Must fix** · won't work double-clicked / offline

- **Before:** If Harry refreshes the main Notice Board page while the players' window is open, the Pop-out Board button stops working. The players' screen stays stuck on the old notices until someone closes it by hand. This only happens when the tool is opened from a file, which is how the suite will run.
- **After (planned):** Use the planned separate player page with postMessage. When the DM page loads, or when Pop-out is pressed, reconnect to the same named window, and have the player page announce 'ready' to window.opener.
- **Evidence:** v3b_output.txt: after the DM page reloads, clicking Pop-out Board throws "Blocked a frame with origin \"null\" from accessing a frame with origin \"null\"" at app.js:765 (popWin.document). The players' window keeps its old cards. The scratch test quests-verify/pm2/test.js shows the postMessage design recovers: after a DM reload the player page's window.opener still reaches the DM tab, window.open('', name) returns the existing players' window, and window.open(url, name) reuses it.
- **Phase 4:** Fixed. After the DM's page is reloaded, the players' window reconnects by itself, and Pop-out Board brings the same window forward rather than opening a second one. Test.

### QST-07 · Two open copies of the tool overwrite each other's saves
**Must fix** · loses saved data

- **Before:** If the Notice Board is open in two tabs or windows at once, whichever one saves last wipes out what the other one saved: accepted quests, outlines, and the star.
- **After (planned):** The shared save module should re-read before writing (or listen for storage changes from other tabs) and warn if the suite is open twice.
- **Evidence:** v2_output.txt D: tab A accepted 42 and 7 and starred 42. Tab B, opened earlier, then accepted 179. The save became [179]. After a reload, tab A showed only [179], the star key still pointed at 42 (a quest no longer in the list), and the outlines for 42 and 7 were gone. Cause: whole-list saves from memory (app.js:119, 127) and nothing listens for changes from other tabs.
- **Phase 4:** Covered by the suite's "Already open" warning (SUI-06). As with every tool, it warns rather than blocks, so close one of the two.

### QST-08 · Players' window goes blank if refreshed
**Fixed by the new design** · other

- **Before:** If anyone presses refresh on the players' screen, it turns blank until the DM presses Pop-out Board again.
- **After (planned):** The player page asks the DM page for the current board when it loads.
- **Decision note:** The new player window asks for the board when it loads.
- **Checker's note:** Workaround: press Pop-out Board again. That only works if the DM page has not been reloaded as well (see the new bug). A real F5 keypress in desktop Chrome was not tested separately; the headless reload behaved like this.
- **Evidence:** run3_misc.js: after reload the popout has no content (popout_after_refresh.png)
- **Phase 4:** Fixed. A refreshed players' window asks for the board and gets it straight back. Test.

### QST-09 · Players' window updated once per notice
**Fixed by the new design** · other

- **Before:** The players' window is redrawn once for every notice pinned (6 times for 6 notices). It's wasteful but harmless.
- **After (planned):** Send one update after the board is drawn.
- **Decision note:** One update per board change.
- **Checker's note:** Harmless.
- **Evidence:** app.js:644 inside forEach; run2 'calls: 6'
- **Phase 4:** Fixed. One update per change.

### QST-10 · Old error message tells you to use GitHub Pages
**Fixed by the new design** · other

- **Before:** The load-error message says to serve the folder with GitHub Pages, which doesn't apply to the suite.
- **After (planned):** Reword it for the suite.
- **Decision note:** The GitHub Pages advice is removed; data can no longer fail to load.
- **Checker's note:** Reword it in the rebuild.
- **Evidence:** app.js:844
- **Phase 4:** Fixed. The quests can't fail to load any more, so the message has gone.

### QST-11 · Leftover unused code
**Fixed by the new design** · other

- **Before:** Some old pieces do nothing: two unused faction checks, an empty 'active filters' function, a search for a panel that doesn't exist, and the switched-off online expansion.
- **After (planned):** Don't port them.
- **Decision note:** Not ported.
- **Checker's note:** Don't port any of it.
- **Evidence:** app.js:459-464, 508-512, 816, 346-350
- **Phase 4:** Not ported.

### QST-12 · Damaged saves stop Accept working
**Fixed by the new design** · other

- **Before:** If a saved value is ever damaged or the wrong shape, for example by a bad import, the Accept button stops working completely until the save is cleared.
- **After (planned):** The shared load and import code checks shapes (a list of quests with number ids; an outline object keyed by id; a number for the star) and keeps a copy of anything it rejects.
- **Decision note:** The shared save layer checks the shape of saved data and keeps a copy of anything it rejects.
- **Evidence:** v1_output.txt C: a saved value of 'null' makes Accept throw "Cannot read properties of null (reading 'some')", '{}' throws 'accepted.some is not a function', and an outline save of 'null' throws on Accept after the quest was already saved (the list then wrongly shows 'No accepted quests yet'). The old tool itself never writes these values.
- **Phase 4:** Fixed. Saved data is checked as it loads (anything damaged is set aside) and when a file is imported (a damaged file is refused and nothing changes). Tests, and rules tests for each check.

### QST-13 · Removing the starred quest sent two identical online updates
**Deliberate change** · other

- **Before:** Removing the starred quest sent the same message to the online database twice. It had no effect in the game, and it goes away with Firebase.
- **After (planned):** Disappears when Firebase is removed.
- **Decision note:** Harry chose to keep the Knightly Treasures link (answer 11, Option A). The suite sends one update per change; the shop sees no difference.
- **Checker's note:** This only affected the online shop. The quest details were identical but the timestamps could differ. It goes away with Firebase, and nothing in the game was counted twice.
- **Evidence:** app.js:372 and 449; run2 'writesForRemove: 2'
- **Phase 4:** Done. Removing the ★ quest sends the shop one message. A test compares every message with the old tool's: they're identical, except that the old tool sent this one twice.

### QST-14 · Dead Accept/Decline buttons on the players' screen
**Later, Harry's call** · other · listed in the handover

- **Before:** Players see Accept and Decline buttons on their screen, but clicking them does nothing.
- **After:** Kept as it is in the rebuild.
- **Decision note:** N4 (default: players' screen shows the notices only)
- **Checker's note:** The handover also notes this (line 117). Ask Harry whether players should see buttons at all.
- **Evidence:** app.js:807 cloneNode copies buttons without their click handlers; verified popout Accept click → DM accepted count unchanged
- **Phase 4:** Changed as Harry chose (N4): the players' window shows the notices only, with no buttons. Test.

### QST-15 · Empty-board and error messages hidden behind the board art
**Later, Harry's call** · other

- **Before:** The 'No notices yet' hint and the 'Couldn't load quest data' warning sit underneath the wooden board picture, so you never see them. A failed load just looks like an empty board.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Note for testing: elementFromPoint does not show this, because the art layer has pointer-events:none. Only a screenshot shows it.
- **Evidence:** styles.css:158-181 (art layer is positioned; #emptyState isn't); screenshots raw_file_load.png, flow07_empty_board.png
- **Phase 4:** Kept: the "No notices yet" card is still underneath the board art. The load-error message no longer exists (QST-10).

### QST-16 · Every level 7-10 board always includes a bounty
**Later, Harry's call** · other

- **Before:** The code says 'at most one bounty', but in practice there is always exactly one bounty when any is eligible. With Count 1 you only ever get a bounty. Choosing Quest Type 'Bounty' only ever pins one notice, and a province filter can give far fewer notices than you asked for.
- **After:** Kept as it is in the rebuild.
- **Decision note:** N1
- **Checker's note:** A rules question for Harry. Keep it as it is in the faithful rebuild.
- **Evidence:** app.js:730-738; 200/200 boards at Lv7 had exactly 1 bounty; Quest Type Bounty + Count 6 → 1 notice; Bolt Isle Lv7 Count 6 → 3 of pool 12
- **Phase 4:** Kept (N1). Tests: exactly one bounty on 200 level 7 boards; Count 1 gives just the bounty; Quest Type Bounty gives one notice.

### QST-17 · A level 11-13 bounty only appears at levels 7-10
**Later, Harry's call** · other

- **Before:** 'Goldport’s Firebrand Smugglers' (quest 77) is written for levels 11-13, but because all bounties are forced to levels 7-10 it never appears for a level 11-13 party.
- **After:** Kept as it is in the rebuild.
- **Decision note:** N2
- **Checker's note:** Five bounties are affected, not one. Harry's call.
- **Evidence:** app.js:496-498; quests.json id 77 level 11-13; run5 id77AtL11 false
- **Phase 4:** Kept (N2). Test: quest 77 shows at levels 7 and 10 but not 11.

### QST-18 · Rescue quest outline has no proper enemy
**Later, Harry's call** · other

- **Before:** The one Rescue quest ('The Bolt Isle Hostage Note') gets 'Unknown Threat' as its enemy and only one generic skill check, because there's no Rescue list.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Keep for now.
- **Evidence:** app.js:185, 241-243; run2 OUTLINES.rescue
- **Phase 4:** Kept. Test.

### QST-19 · Root/Veinwood themes in notice-board content
**Later, Harry's call** · other · listed in the handover

- **Before:** Outlines can mention 'Root-Woken Scouts', 'Vein-touched Wolves' and roots, and six bounties are named Rootbound Husk or Veinwarped Mawclaw, although Harry wanted these themes kept to the Heartwood Ritual.
- **After:** Kept as it is in the rebuild.
- **Decision note:** N5 (kept word for word until Harry sends replacements)
- **Checker's note:** This is content, not a bug. Keep the text word for word until Harry sends approved replacements.
- **Evidence:** app.js:173, 259; quests.json ids 105, 122, 123, 125, 143, 155
- **Phase 4:** Kept word for word (N5), in `tools/quests/data/quests-data.js` and `tools/quests/data/outline-data.js`, ready for Harry's replacements.

### QST-20 · Party Level box shows out-of-range numbers
**Later, Harry's call** · other

- **Before:** You can type 20 or 3 in Party Level. The box keeps showing it while the tool quietly uses 16 or 7.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Harry's call.
- **Evidence:** app.js:488; run2 CLAMP
- **Phase 4:** Kept. Test.

### QST-21 · Accepted quests are frozen copies
**Later, Harry's call** · other

- **Before:** An accepted quest is saved as a full copy. If Harry later fixes a quest's text or reward in the data, already-accepted copies and their outlines keep the old version.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Keep the behaviour. Relevant to the later import step.
- **Evidence:** app.js:356-357, 157
- **Phase 4:** Kept.

### QST-22 · Declining a notice re-tilts all the other notices
**Later, Harry's call** · other

- **Before:** When you decline one notice, every other notice on the board (and on the players' screen) jumps to a new random angle.
- **After:** Kept as it is in the rebuild.
- **Evidence:** v1_output.txt: tilts before a decline [0.48, -1.13, -0.51, -1.20, -0.57, 0.34]deg; after [0.93, -0.03, 0.93, -1.07, -0.59]deg. renderParchments redraws every card with a new Math.random tilt (app.js:544, 624).
- **Phase 4:** Kept. Test: given the same dice, the new tilts after a Decline match the old tool's exactly.

### QST-23 · Removing an accepted quest is instant, with no way back
**Later, Harry's call** · other

- **Before:** Clicking the ✕ removes an accepted quest straight away, with no 'are you sure?'. The only way to get it back is to keep pressing Generate until it happens to appear again.
- **After:** Kept as it is in the rebuild.
- **Evidence:** app.js:406 (the ✕ is a small span), 440-456 (removes immediately). At Lv 7 the random pool has 97 quests (pool.py).
- **Phase 4:** Kept.

### QST-24 · Firebase update left mismatched quote marks in outline text
**Later, Harry's call** · other

- **Before:** The shop update of 11 Feb swapped some curly apostrophes for straight ones and left odd pairs, so outlines read "The ‘villain' is being coerced…", "‘catch'" and "‘doing'".
- **After:** Kept as it is in the rebuild.
- **Evidence:** git show a6dab50 (Matt Owen): ’ replaced with ' across the word banks; today app.js:187, 212, 221 have mismatched ‘…' pairs
- **Phase 4:** Kept word for word.

### QST-25 · Outlines saved between 23 Jan and 5 Feb 2026 say 'A notice calls for help.'
**No longer relevant** · other

- **Before:** Until 5 February the quest text was stored under a different name, and the outline builder didn't look there. Any quest accepted in that period got the stand-in premise 'A notice calls for help.' That outline is saved forever and never rebuilt, so it will come across if old saves are imported later.
- **After:** Kept as it is in the rebuild.
- **Decision note:** Old saves are not being imported (answer 9).
- **Evidence:** git show 1eed80b:data/quests.json: all 100 quests use 'summary', and a8e3e66 (5 Feb) moved it to 'description'. app.js:245 premise = description || notice (it never reads summary). A node check on old record 42 gives the premise 'A notice calls for help.', while current data gives the real text. app.js:157 never rebuilds a cached outline. OUTLINE_KEY was added 23 Jan (377dbe5).
- **Phase 4:** No longer relevant (no old saves are imported).

### QST-26 · Star tooltip still mentions the shop
**No longer relevant** · other

- **Before:** Hovering over the gold star says 'Primary quest for shop', but the shop link is being removed.
- **After:** Kept as it is in the rebuild.
- **Decision note:** The shop link is kept (answer 11, Option A), so "Primary quest for shop" stays true.
- **Evidence:** app.js:401
- **Phase 4:** Kept: "Primary quest for shop" on the ★ quest, "Set as primary quest" on the others.

## Scarlett Isles Explorer
Old repo: `_legacy/scarlett-isles-explorer` (file:line references point there).

### EXP-01 · Camp-night pop-ups overwrite each other
**Must fix** · breaks the tool · listed in the handover

- **Before:** When Make Camp triggers more than one thing (a campfire event, weather and the weekly Bastion reminder), they all use the same pop-up, so only the last one stays. On a weather night the campfire event silently disappears; on day 8 both the campfire event and the weather vanish, and the weather still counts towards its 3-day wait.
- **After (planned):** Collect the night's pop-ups in a queue and show them one after another in the original order (campfire or main event, then weather, then Bastion). Each outcome is applied only when its own button is clicked.
- **Decision note:** E4 confirms the order (default: campfire or main event, then weather, then the Bastion prompt).
- **Checker's note:** The handover acceptance also requires that 'an event cannot be lost behind a weather modal'. The fix queues the pop-ups, and each outcome applies only on its own click.
- **Evidence:** app.js:2358-2414 calls openEventModal/openWeatherModal one after another on the same #evModal. Playwright with the random roll forced: day 2 and 5 final pop-up 'Weather', campfire discarded; day 8 final 'Bastion Turn', lastWeatherDay=8, activeWeather=null.

### EXP-02 · Enter or Space repeats Make Camp behind the pop-up
**Must fix** · applies something twice

- **Before:** After clicking Make Camp the keyboard focus stays on that button behind the pop-up. Pressing Enter or Space (a natural way to 'continue') makes camp again, skipping days, resetting miles and replacing the event.
- **After (planned):** The shared modal moves focus into the pop-up and blocks the page behind it until it closes.
- **Checker's note:** The shared modal should move focus into the pop-up and trap it there.
- **Evidence:** misc_test.js: activeElement = explorerMakeCamp; day 2, then after Enter and Space, day 4.

### EXP-03 · Heroes' miles forgotten after a reload
**Must fix** · loses saved data

- **Before:** Each hero's miles for the day are saved, but when the page is reopened they are all set back to 0/30, and the next save overwrites the real numbers. The party can then walk more than 30 miles in a day.
- **After (planned):** Restore milesUsed when loading, and when importing old saves.
- **Checker's note:** Import is affected in the same way, because it also goes through this load path after its reload (1329-1333).
- **Evidence:** app.js:1213-1225 merges x, y, size, groupId and axial but not milesUsed. flow_test: pills K12/U6/M6 before reload, all 0 after; the next save wrote 0s.

### EXP-04 · With Snap on, changing map leaves the party drawn in the old spot
**Must fix** · breaks the tool

- **Before:** Moving to a connected map is meant to place the party at that map's entry point. With Snap on, the tokens stay where they were on screen while the tool thinks they are at the entry point, so fog opens in one place and the tokens sit in another, and the next drag jumps.
- **After (planned):** After a spawn, recalculate each token's hex from its new position.
- **Checker's note:** Borderline breaks_tool. It is the same root cause as the new 'Snap on + fullscreen/resize mis-charges miles' bug, so fix them together.
- **Evidence:** applyPartySpawnWithFormation (app.js:152-169) changes x/y but keeps the old t.axial, and renderTokens draws from axial when snap is on (1855-1906). transition_test.js snap_true: kaelen saved x 0.688, drawn x 0.119.

### EXP-05 · Uploading a large map stops all saving
**Must fix** · loses saved data

- **Before:** A map picture just under the 4 MB limit is too big for the browser's save space once converted. The tool errors, the map does not appear, and nothing done after that is saved until the page is reopened. In the suite all eight tools share that space.
- **After (planned):** Keep the uploaded picture in IndexedDB (tsi.explorer.uploadedMap), wrap every save in try/catch and show a plain 'couldn't save' warning.
- **Checker's note:** The numbers need correcting: the quota is about 5.24M characters, and a 3.9 MB file fits when the Explorer is alone (see corrections).
- **Evidence:** 4 MB checked on file size (app.js:2120), but base64 is about 1.33x. explorerSave (441-443) has no try/catch. env_test: a 4.1 MB file gave an uncaught QuotaExceededError, the map was not shown, the Hex Grid button stopped responding and nothing saved. Chromium file:// budget is about 4.98M characters, shared by all file:// pages.

### EXP-06 · Pictures, videos and data paths assume the old website address
**Must fix** · won't work double-clicked / offline

- **Before:** The tool works out file locations as if it were on the old GitHub website. Opened from a folder, it looks in the wrong place, so no maps, pins, main-event pictures or weather videos appear.
- **After (planned):** Use plain relative paths.
- **Checker's note:** logo.png (536) and hero.png (CSS) use plain relative paths and do load.
- **Evidence:** app.js:6-20 withBase. file:// test: file:///home/assets/maps/the_north_isle.jpg ERR_FILE_NOT_FOUND.

### EXP-07 · Events and pins are downloaded in a way browsers block from a file
**Must fix** · won't work double-clicked / offline

- **Before:** Opened by double-click, the travel and campfire events and the location pins never load, so Make Camp and travel show nothing.
- **After (planned):** Turn the JSON files into script data files loaded with <script>.
- **Evidence:** app.js:188, 269 fetch(); console 'URL scheme "file" is not supported'.

### EXP-08 · Fonts need the internet
**Must fix** · won't work double-clicked / offline

- **Before:** Without Wi-Fi the special fantasy fonts don't load and the tool falls back to a plain font.
- **After (planned):** Bundle the fonts locally.
- **Evidence:** index.html:8-10; ERR_CERT_AUTHORITY_INVALID; document.fonts empty.

### EXP-09 · Import replaces the journey without asking
**Must fix** · other

- **Before:** Choosing a backup file instantly overwrites the current journey and reloads, with no 'are you sure?'.
- **After (planned):** Required by the suite rules anyway: ask first, then load in place without reloading.
- **Decision note:** CLAUDE.md: safe imports always ask first.
- **Checker's note:** The suite rules require a confirm anyway. See the new bug: a malformed but shape-passing file permanently breaks the tool.
- **Evidence:** app.js:1315-1334; flow_test: 0 dialogs, day jumped to 42.

### EXP-10 · Map pins, grid, fog and tokens shift with window size
**Must fix** · other

- **Before:** Everything on the map is placed relative to the box around the map, not the map picture itself. On a smaller or wider screen, pins drift away from their towns and a 6-mile hex covers a different amount of land.
- **After (planned):** Harry's call. Keep as is unless he wants everything pinned to the picture (would need a one-off conversion of positions).
- **Decision note:** Moved from later because the Explorer must work on both the 16:10 laptop and the 16:9 TV (answer 4). Positions tie to the map picture; the 33 marker positions are converted once and Harry checks them (E16).
- **Checker's note:** In fullscreen the pins sit in the same place on any 16:9 screen. The drift shows up in windowed mode and between windowed and fullscreen.
- **Evidence:** aspect_test.js: Coldpass pin at 0.718 of map width (1400x1100) vs 0.832 (1280x720); hexes across the map 16.1 vs 10.5.

### EXP-11 · With Snap on, going fullscreen (or any window resize) makes moves cost the wrong miles
**Must fix** · breaks the tool

- **Before:** If Snap is on and the map area changes size, for example when Harry presses Fullscreen for the TV, the heroes are still drawn where they were, but the tool now thinks they are somewhere else. The next time a hero is dragged one hex, the tool charges for the distance from that invisible spot. In the test, a one-hex move cost 18 miles instead of 6, and the same happens after reopening the browser at a different window size.
- **After (planned):** When Snap is on, work out each hero's hex from the saved position (after any resize, fullscreen change, load or map change, or on every draw). The same change fixes the map-transition bug.
- **Evidence:** t_snap_fs2.js at 1366x768, then fullscreen 1368x770. Snap on: drawn top-left [735,377] vs saved position [837,524] px; a visible one-hex drag took Kaelen from 6 to 24 miles. Snap off: drawn [867,504] and saved [868,505] agree; the same drag went from 6 to 12. Code: renderTokens draws from pixel-based t.axial (1855-1906), while drag start and cost use x/y (2597-2615, 2762-2768). The resize handler (2245-2247) never re-syncs, and load restores the old axial (1222-1224).

### EXP-12 · A slightly wrong backup file can lock up the Explorer for good
**Must fix** · breaks the tool

- **Before:** Import only checks that the file has 'grid', 'tokens' and 'travel'. A hand-edited or damaged backup that passes that check but has an empty entry in the heroes list is saved, and after that the Explorer crashes every time it opens. No buttons work until the browser's stored data is cleared. From a double-clicked file, clearing that data would also wipe every other tool's saves.
- **After (planned):** The suite's safe import must check every hero entry (and the other fields) before replacing anything. Loading must survive a bad save by falling back to defaults and keeping a copy of the bad data.
- **Evidence:** t_import.js with bad_save.json {"grid":{},"tokens":[null],"travel":{}}: 0 dialogs, reload, pageerror "Cannot read properties of null (reading 'id')", Hex Grid button dead. After a second reload: 2 page errors and the bad save still stored. Code: looksLikeExplorerSave 1289-1296, explorerSave(obj) at 1329, crash at 1212.

### EXP-13 · H key hides the controls everywhere
**Fixed by the new design** · other

- **Before:** Pressing H anywhere toggles Hide UI. Outside fullscreen it only changes the button label, and in the suite it could fire while another tool is open.
- **After (planned):** Scope to the Explorer while it's open, and ignore when typing.
- **Decision note:** Shortcuts only work in their own tool and never while typing.
- **Checker's note:** The uiHidden class also stays set after leaving fullscreen, so the button still reads 'Show UI'.
- **Evidence:** app.js:2236-2241 window keydown.

### EXP-14 · Double-clicking Make Camp makes the night's event vanish
**Fixed by the new design** · other

- **Before:** The first click opens the campfire event. The second click lands on the dark background behind the pop-up, and clicking that background closes the pop-up, so the event disappears before anyone reads it. The day only advances once.
- **After (planned):** In the shared modal, don't close event pop-ups on a backdrop click (or ignore clicks for a moment after opening). Harry's call.
- **Decision note:** The shared pop-up takes focus and can't be clicked through by accident.
- **Evidence:** t_camp.js: dblclick on Make Camp took the saved day from 4 to 5 and left the pop-up closed. Code: backdrop click closes the modal (1166). The Make Camp button sits under the full-screen backdrop (styles.css .evModal_backdrop inset:0).

### EXP-15 · Browser pop-up messages throw the TV view out of fullscreen
**Fixed by the new design** · other

- **Before:** The Explorer uses the browser's own small message boxes (such as 'Enter a valid roll number', 'Select 2+ tokens first', the Pick Marker XY copy box and the reset confirmations). When one appears in fullscreen, the browser leaves fullscreen, so the players' view drops back to the normal window.
- **After (planned):** Using the suite's own in-page messages and confirm boxes, inside the Explorer's fullscreen frame, fixes this.
- **Decision note:** The suite's own in-page pop-ups stay inside the fullscreen view.
- **Evidence:** t_fs_alert.js: fullscreenElement 'explorerFsWrap' before an alert and null after it. Built-in pop-ups at app.js:529, 788, 1095, 2122, 2143, 2158, 2192, 2203, 2306, 2319, 2431. The test used headless Chromium; confirm by hand in Chrome and Edge.

### EXP-16 · Event gold tally and log are not saved and reset weekly
**Later, Harry's call** · other · listed in the handover

- **Before:** The Gold figure from travel events disappears on reload and isn't in the backup file. It is also zeroed every 7th day. The event note log is kept in memory but never shown.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E1
- **Checker's note:** The original never saved this, so it is not 'loses saved data' under the policy.
- **Evidence:** saveNow 1239-1251 and buildSavePayload 1255-1268 omit trackers; 2397 resets gold; 864 writes the log, which nothing displays. flow_test goldAfterReload 0.

### EXP-17 · Rations are only mentioned, never counted
**Later, Harry's call** · other · listed in the handover

- **Before:** Events say 'you gain 2 rations' but there is no ration total anywhere.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E2
- **Evidence:** app.js:870 notice only; no ration store; CSS styles a missing #explorerRations.

### EXP-18 · Gold display doesn't update straight after an outcome
**Later, Harry's call** · other

- **Before:** After an event gives or takes gold, the Gold number stays the same until you next move a token.
- **After:** Kept as it is in the rebuild.
- **Evidence:** applyOutcome (847-877) never refreshes the HUD; flow_test: notice '-10 gold' while #explorerGold showed 0.

### EXP-19 · Fog button shows Off after reopening when fog is on
**Later, Harry's call** · other

- **Before:** After a reload the Fog of War button says Off even though fog is showing, so the first click appears to do nothing.
- **After:** Kept as it is in the rebuild.
- **Evidence:** updateFogToggleUI (1579) is not called at start-up; misc_test: saved enabled=true, label 'Fog of War: Off'.

### EXP-20 · Region dropdown doesn't follow the loaded map
**Later, Harry's call** · other

- **Before:** Loading North Isle switches the events to North Isle, but the Region box still says Northern Province.
- **After:** Kept as it is in the rebuild.
- **Evidence:** provinceSel set only at 2053; flow_test: dropdown northern_province, state the_north_isle.

### EXP-21 · Reset Travel leaves the weather wait behind
**Later, Harry's call** · other

- **Before:** After Reset Travel back to Day 1, weather can't happen again until the old day number plus 3 (e.g. day 14), and the day's travel event can be blocked.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E9
- **Checker's note:** travelEventDay blocks the day-1 travel event only when the reset happens on day 1 after that day's event.
- **Evidence:** app.js:2430-2442; misc_test: lastWeatherDay stayed 11; no weather on days 2-5 even when forced.

### EXP-22 · Weather can be closed without rolling
**Later, Harry's call** · other

- **Before:** The weather pop-up has two Close buttons. Closing it skips the weather (no video, no effect) but still uses up the 3-day wait.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E8
- **Evidence:** openWeatherModal 1034-1134 passes choices [], so renderStep adds a Close (922-931); lastWeatherDay is set at 2384 before resolving.

### EXP-23 · Line breaks in event text are lost
**Later, Harry's call** · other

- **Before:** Maerys Vell's letter and the weather 'ROLL:' line run together as one paragraph instead of the layout Harry wrote.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E12
- **Checker's note:** This also affects the weather 'EFFECT:' line built with \n\n at 1114.
- **Evidence:** .evModal_desc has no white-space rule (styles.css:635-642, 823-827, 928-931); screenshot http_07_main_event_letter.png.

### EXP-24 · 146 events have a second part that can never be reached
**Later, Harry's call** · other

- **Before:** Many events contain a written second scene, but no button leads to it, so players never see it.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E3
- **Evidence:** analyse2.py: 146 events with an unreachable 'step2' (e.g. Bridge Out, Roadside Peddler).

### EXP-25 · A refused 'Too far' move still uncovers the fog and the pins
**Later, Harry's call** · other

- **Before:** While a hero is being dragged, the fog clears along the way. If the move is then refused for going over 30 miles, the hero snaps back but the uncovered land and any town pins there stay revealed, and are saved at the next save. On a TV that can show players places they never reached.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E13
- **Evidence:** t_transition_fog.js with fog on: 19 revealed hexes before and 90 after a refused drag. Pins went from 0 to 3. Kaelen's miles stayed at 0 with notice 'Too far...'. Code: reveals happen during the drag (2709-2712, 2740-2750), while the refusal branch (2793-2818) restores positions and hexes but not the fog store. The next saveNow writes it.

### EXP-26 · Grid opacity slider at 0 still shows the grid
**Later, Harry's call** · other

- **Before:** Dragging the grid opacity all the way down to 0 brings the grid back at its default strength instead of hiding it.
- **After:** Kept as it is in the rebuild.
- **Evidence:** app.js:1755 uses 'Number(state.grid.opacity) || 0.35', so 0 becomes 0.35. t_opacity.js: slider 0.05 gave max alpha 29, slider 0 gave max alpha 166 (drawn at 35%).

### EXP-27 · Reset Fog wipes a map's explored area with no 'are you sure?'
**Later, Harry's call** · other

- **Before:** One click on Reset Fog permanently clears everything the party has uncovered on that map, and it saves straight away. Clear map and Reset Travel both ask first.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E14
- **Evidence:** app.js:1637-1655: no confirm, and saveNow runs via updateFogFromFocus or directly. Compare the confirms at 2143 and 2431.


## The Ironbow Bastion Manager
Old repo: `_legacy/bastion_manager` (file:line references point there).

### BAS-01 · Reloading or importing wipes party identity, war log and all diplomacy
**Must fix** · loses saved data

- **Before:** Every time the page is reopened or a backup is imported, the tool forgets whether the party formed a Clan or Mercenary Brigade (and its name), Clan Honour, the Honour/Respect and Trusted Clients numbers, the war log, and every trade agreement, delegation, summit, writ and consortium, plus Favour Tokens and cooldowns. Losing a consortium also makes its trade route expire on the next turn.
- **After (planned):** Restore every saved field (with safe defaults) in the new loader; add a round-trip test (save, reload, compare).
- **Checker's note:** saveState writes the whole state (4911-4913), so exports made before a reload do contain these fields. A loader that restores every field will recover them from such files. Combined with the new 'route never reopens' bug, a reload kills those clans' trade routes for good.
- **Evidence:** loadState copies only some fields (app.js:4841-4902); organization, clanHonor, honourRespectByClan, trustedClientsByClan, warLog and diplomacy are left out. Runtime: B2 agreements [] after reload; B3 'org type unsworn, warLog 0' and route expired with no income next turn; B5 identity lost after Download, Reset, Import.

### BAS-02 · Advance Turn loses orders if a dice roll is cancelled (or the page is reloaded mid-turn)
**Must fix** · loses saved data · listed in the handover

- **Before:** When the turn advances, the tool takes all due orders off the list before asking for dice rolls. If you cancel a Hall roll (Cancel, the X, Escape, or clicking outside the box), the tool hits an error part-way. The turn has already moved on, the remaining orders vanish, and the gold paid for them is gone. Reloading during the rolls loses them the same way.
- **After (planned):** Make Advance Turn a resumable step list saved in state (e.g. state.turnInProgress): mark each order done only after its result is applied. A cancelled roll keeps the order pending, or re-asks on resume. Keep the exact rule order.
- **Checker's note:** This affects all 5 Hall actions, not only Delegation. A reload during the start-of-turn trade roll strands orders instead of losing them (new bug).
- **Evidence:** app.js:585-590 removes the due orders first; rollD20Manual returns null on cancel (1678) and roll.d20 then crashes (935). Host Delegation checks the wrong variable, if(!roll) instead of r1/r2 (1029, 1031). ensureDiplomacyState saves mid-turn (1549). Runtime B2: 'Cannot read properties of null (reading d20)', turn 2 to 3, Barracks order gone, defenders unchanged, pending [].

### BAS-03 · Double-clicking Advance Turn can cancel a roll and lose orders
**Must fix** · loses saved data

- **Before:** If a Hall or war order is due, the second click of a double-click lands on the dark area behind the dice box. That counts as Cancel and triggers the order loss above.
- **After (planned):** Disable Advance Turn while a turn is resolving; don't let backdrop clicks cancel roll boxes; rely on the resumable turn above.
- **Checker's note:** Also: with no roll due, a double-click runs two full turns, and Enter or Space re-triggers Advance behind an open box (new bugs). One fix covers all three: a 'turn in progress' guard.
- **Evidence:** The backdrop click cancels (app.js:1727). The Advance button is never disabled while the turn resolves (560-604). Runtime B4 dblclick: turn 1 to 2, both orders gone, pageerror.

### BAS-04 · Lowering the Party Level deletes built facilities
**Must fix** · loses saved data

- **Before:** Picking a lower level, even by mistake, permanently deletes any built or half-built facilities in slots above the new limit. Picking the higher level again does not bring them back.
- **After (planned):** Never trim saved slots when the level drops; show extra slots as 'over capacity' (ask Harry how they should behave).
- **Decision note:** B8 decides how over-capacity buildings behave (default: kept and marked "over capacity").
- **Checker's note:** A Hall under construction is lost the same way.
- **Evidence:** renderFacilities trims builtExtras to the slot count (app.js:4333-4334) and the next save keeps the trimmed list. Runtime B1: level 9 with 4 builds, then level 5 and a treasury edit left 2, back to level 9 still showed 2 plus 2 empty slots.

### BAS-05 · Cancelled trade-route roll lets routes pay out again
**Must fix** · applies something twice

- **Before:** If a high-risk route's roll is cancelled, the routes already paid that turn can be paid again by pressing Resolve (or by the next attempt). Gold is added two or three times in one turn.
- **After (planned):** Record each route's result for the turn as it is applied; skip routes already resolved this turn; resume only the unresolved ones.
- **Checker's note:** A double-click on Resolve (second click on the backdrop = cancel) and Enter pressed while the box is open (new bug) trigger the same double pay.
- **Evidence:** lastResolvedTurn is only set at the end (app.js:2571); the cancel path returns early (2520-2525) after earlier routes were already paid (2497-2506). Runtime B4: treasury 10000, 10100, 10200, 10300 from three Resolve clicks in one turn.

### BAS-06 · Host Delegation applies Political Capital twice
**Must fix** · applies something twice

- **Before:** A Host Delegation changes the target clan's Political Capital twice: once from a first general roll and again from the Diplomacy and Insight rolls. That makes three dice prompts, and a great result gives +30 instead of +15.
- **After (planned):** Confirm with Harry which roll set is intended, then apply PC once. Don't change it without an answer.
- **Decision note:** Only changed once Harry answers B2 (which roll set is the rule).
- **Checker's note:** Needs Harry to choose which roll set is the real rule. The delegation's summary text is also lost (new bug).
- **Evidence:** The outer tier PC change (app.js:958-977) applies to every kind, and the delegation block applies its own again (1045-1067). Runtime B2: 'Political Capital: +15 (Clan Rowthorn)' listed twice; rowthorn = 30.

### BAS-07 · The tool does not start from a double-clicked file
**Must fix** · won't work double-clicked / offline

- **Before:** Opened straight from a folder, the tool shows an error box and no buttons work, because it loads its data in a way browsers block for local files and builds wrong file paths.
- **After (planned):** Data as .js files loaded with script tags; relative paths; everything wired inside the tool's namespace.
- **Checker's note:** withBase builds file:///home/... from the first path segment (app.js:10-14).
- **Evidence:** fetch of 4 JSON files (app.js:333-340) plus withBase (10-14). Runtime A: 'URL scheme file not supported', alert 'App error during init'.

### BAS-08 · Facility pictures and map overlays missing from a double-clicked file
**Must fix** · won't work double-clicked / offline

- **Before:** Even with the data fixed, the facility pictures and the building overlays on the map would not show from a local file.
- **After (planned):** Relative asset paths from the tool folder.
- **Checker's note:** Verified by reading the code, not re-run. CSS backgrounds and trade/ledger art use relative paths and would load.
- **Evidence:** withBase makes /home/assets/... paths (app.js:1269, 2180, 4453). Runtime C: ERR_FILE_NOT_FOUND for every facility picture and overlay.

### BAS-09 · Fonts need the internet
**Must fix** · won't work double-clicked / offline

- **Before:** Without Wi-Fi the tool loses its Cinzel and Uncial lettering and falls back to a plain system font.
- **After (planned):** Bundle the fonts locally through the shared design tokens (with licences).
- **Evidence:** styles.css:2 @import Google Fonts; runtime: blocked, fallback font in screenshots

### BAS-10 · Pressing Enter or Space while a dice box is open runs Advance Turn a second time
**Must fix** · applies something twice

- **Before:** After you click Advance Bastion Turn, the button behind the dice box stays selected. If you press Enter or Space to 'confirm' the box, the tool quietly starts another whole turn underneath it. The turn counter jumps by two, building work counts down twice, contract income is paid twice, and 'Turn Advanced' is logged twice.
- **After (planned):** While a turn is resolving, ignore Advance (disable the button and keep a turn-in-progress flag). Move focus into each box and trap it there. Handle this inside the resumable-turn design.
- **Evidence:** The boxes never move keyboard focus (openSIModalChoice app.js:1693-1750). Advance has no in-progress guard (560-604). Runtime t_enter.js A: document.activeElement = advanceTurnBtn; after Enter the turn went 2 to 3 while the first box was still open, Library construction went 3 to 1, and the log shows 'Turn Advanced: 3' twice. Test C: Space does the same with a war roll box.

### BAS-11 · Pressing Enter while a trade-route dice box is open pays every route twice
**Must fix** · applies something twice

- **Before:** The same focus problem on the Resolve button: pressing Enter while the route roll box is open resolves the trade routes a second time in the same turn, and all the gold is paid twice.
- **After (planned):** Busy guard on Resolve, plus recording each route as resolved for the turn as soon as it pays (same fix as the cancel double-pay).
- **Evidence:** Resolve keeps focus (runtime t_more.js D: activeElement = btnResolveTradeRoutes; two stacked 'Resolve Route: Karr' boxes). Runtime t_resolve.js: one resolve 10000 to 10220; with one Enter press 10000 to 10440. lastResolvedTurn is only set at the end (2571).

### BAS-12 · Double-clicking Advance Turn runs two whole turns
**Must fix** · applies something twice

- **Before:** If nothing needs a dice roll, a double-click on Advance Bastion Turn moves the Bastion on two turns (14 days) at once. Building work and income tick twice, and there is no warning.
- **After (planned):** Ignore repeat clicks while a turn is being resolved and for a short moment after. Ask Harry whether he also wants a confirm step.
- **Evidence:** Runtime t_enter.js B: dblclick gave turn 1 to 3, Library remaining 3 to 1, two 'Turn Advanced' log lines. No guard exists (app.js:560-604).

### BAS-13 · Orders can get stuck in Pending forever after a skipped turn
**Must fix** · loses saved data · listed in the handover

- **Before:** An order only completes on exactly the turn it was due. If the page is reloaded while the start-of-turn trade roll box is open (or a turn is skipped by the Enter problem above), that turn's orders never complete. They sit in Pending Orders showing an old turn, and the gold paid for them is gone.
- **After (planned):** Complete every order whose due turn is at or before the current turn (<=), inside the resumable Advance transaction. Keep resolution order unchanged.
- **Evidence:** Due check is o.completeTurn === state.turn (app.js:585-586). turn+1 is saved by tickDiplomacyOnAdvanceTurn before the trade box (562-576, 2385). Runtime t_more.js H: reload during the Karr route roll, then two Advances; at turn 5 the Barracks order still says 'Completes on Turn 3' and defenders are unchanged.

### BAS-14 · Importing the wrong JSON file silently wipes the Bastion
**Must fix** · loses saved data

- **Before:** Import accepts any JSON file. If you pick another tool's save (easy once eight tools all export JSON), the tool says 'Import this save?', then loads a blank starting Bastion (0 gold, turn 1, empty warehouse). Your real save is gone.
- **After (planned):** Check that the file is a Bastion save (tool id / schema version / expected fields) and refuse or warn clearly. Show what will be replaced before confirming. Keep a one-step undo backup of the current save.
- **Evidence:** app.js:637-659 writes the parsed file straight to storage, with no check that it is a Bastion save. loadState fills defaults (4841-4907). Runtime t_import.js: treasury 4321, turn 9, warehouse [Longship] became 0, 1, ['New Item'] after importing {"players":[...],"prizeTotal":300}.

### BAS-15 · Double-clicking Queue War Action queues two wars
**Must fix** · applies something twice

- **Before:** Queue War Action has no cost and no duplicate check, so a double-click queues two identical war actions. Next turn both are rolled, and gold, Political Capital and casualties are applied twice.
- **After (planned):** Ignore rapid repeat clicks. Ask Harry whether more than one war action per turn is allowed at all.
- **Decision note:** B22 decides whether more than one war per turn is allowed at all.
- **Evidence:** The handler has no guard (app.js:472-507). queueWarAction pushes every time (5262-5275). Runtime t_more.js G: pending = ['War Action@2','War Action@2'] after one dblclick.

### BAS-16 · Diplomacy panel collapse arrow does nothing
**Fixed by the new design** · other

- **Before:** The ▾ button on the Diplomacy & Trade panel opens and closes in the same click, so it never collapses.
- **After (planned):** Bind once in the rebuild.
- **Decision note:** Panels use the shared collapse control, bound once.
- **Evidence:** makeCardCollapsibleById runs twice for diplomacyPanel (app.js:158 and 2083) and binds two listeners. Runtime B6: collapsed false after one click.

### BAS-17 · Unsaved Warehouse and Artisan Tools edits vanish
**Deliberate change** · other

- **Before:** Typing in the Warehouse, or picking Artisan Tools, is lost if you click anything else (such as +1 Defender or changing the gold) before pressing Save, even though the map says the tool saves automatically.
- **After (planned):** CLAUDE.md's autosave rule covers this: save warehouse and tool edits as they are made. Record it as behaviour changed by the autosave rule.
- **Decision note:** CLAUDE.md autosave rule: edits save as they are made.
- **Checker's note:** The CLAUDE.md autosave rule removes this by design. Record it as a deliberate behaviour change.
- **Evidence:** render() rebuilds both from saved state (app.js:1290-1292, 1380-1404, 3424-3451). Runtime B5: edit reverted to 'Rope'; artisan pick reverted to ''.

### BAS-18 · Treasure event can never be rolled
**Later, Harry's call** · other

- **Before:** Rolls of 99 or 100 show 'Unknown' instead of the Treasure event, so Treasure never happens.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B11. Recommended fix (a one-character reading slip in Harry's own table); only with Harry's OK.
- **Checker's note:** One-character content fix, but it doesn't break, lose or double anything, so it is Harry's call.
- **Evidence:** resolveEvent reads '99-00' as 99 to 0 (app.js:4728-4736). Runtime B1: roll 99 and roll 100 both show 'Unknown, No description text found'.

### BAS-19 · Four facility overlays never appear on the map
**Later, Harry's call** · other

- **Before:** Overlay art exists for the Gaming Hall and all three shrines, but the tool looks for different file names, so those buildings never appear on the Bastion map.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B12
- **Evidence:** app.js:1269 builds '<facId>_overlay.png'; the files are gambling_hall_overlay.png and shrine_of_{telluria,aurush,pelagos}_overlay.png. media.py shows exists=False; runtime 404s.

### BAS-20 · Clicking a compendium card picture throws an error
**Later, Harry's call** · other

- **Before:** Clicking an item's card picture in the Compendium does nothing (the enlarge feature was never written).
- **After:** Kept as it is in the rebuild.
- **Evidence:** openImageViewer is called at app.js:4312 but defined nowhere. Runtime B5 pageerror 'openImageViewer is not defined'.

### BAS-21 · Trade Agreement duration choice ignored
**Later, Harry's call** · other

- **Before:** The 1/3/6-turn duration picked when planning a Trade Agreement has no effect; it always lasts 4 turns plus or minus the roll.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B5
- **Evidence:** meta.durationTurns is set (app.js:1998) but resolution uses fn.special.durationTurns (905, 979). Runtime B2: picked 6, got 5 turns.

### BAS-22 · Hall upgrades are free
**Later, Harry's call** · other

- **Before:** Upgrading the Hall of Emissaries costs nothing, although the data lists 600gp and 1,200gp.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B4
- **Checker's note:** An upgrade can still be ordered at L3, for nothing.
- **Evidence:** upgrade_hall costGP 0 and costByNextLevel unused (app.js:1215-1220, 3306). Runtime B3: 20000 to 20000.

### BAS-23 · Writ of Authority bonus never granted
**Later, Harry's call** · other

- **Before:** The Writ's help text says +2 on the next 3 council verdicts, but nothing ever gives that bonus.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B6
- **Evidence:** authorityBonusTurns is never set above 0 (app.js:2895, 2929; tooltip 3581-3587)

### BAS-24 · Consortium pays twice each turn
**Later, Harry's call** · other

- **Before:** One Trade Consortium pays its contract income and its trade route payout every turn, the same amount twice. This may or may not be intended.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B3. If Harry says one income was intended, this becomes an "applies twice" fix.
- **Checker's note:** The behaviour is real. Whether it is a bug depends on Harry: if he says one income was intended, it becomes an applies-twice fix.
- **Evidence:** route yieldGP = consortium perTurn (app.js:1144); tickDiplomacy pays incomePerTurn (2336-2341) and routes pay routePayout (2497-2506). Runtime B4: +174 contract and +174 route.

### BAS-25 · Beasts counted by row, not number
**Later, Harry's call** · applies something twice

- **Before:** Two of the same beast show as 'x2' but count as one beast for war, and a single beast casualty removes the whole pair.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B10. The checker notes the casualty part removes more beasts than it should.
- **Checker's note:** The casualty part is damage counted twice. The availability undercount is 'other'. The handover warns against counting rows.
- **Evidence:** app.js:476 and 5211 use .length; 5359-5363 splices a row. Runtime B6: 'Owlbear x2', war hint '1 beasts'.

### BAS-26 · Library scripture notes never attach
**Later, Harry's call** · other

- **Before:** Research scriptures should carry advantage notes (e.g. 'Adv. on Survival checks'), but the names don't match, so the warehouse just says 'Library'.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B16
- **Checker's note:** The six shrine charm notes are hidden too (new item).
- **Evidence:** Map keys 'Geographical', 'War' and so on (app.js:3290-3303) vs options 'Geographical Scriptures' and so on. Runtime B3: warehouse notes 'Library'.

### BAS-27 · Trade Agreement routes never glow on the Sea Trade Routes map
**Later, Harry's call** · other

- **Before:** The trade map is meant to show routes for Trade Agreements too, but the clan is stored as 'Clan Blackstone', so no route overlay is found.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Verified by reading the code only.
- **Evidence:** tradeRouteOverlayFileForClan compares lowercased 'clan blackstone' (app.js:2617-2629, 2652-2658)

### BAS-28 · Cancelling a pending order doesn't refund gold
**Later, Harry's call** · other

- **Before:** Cancelling a queued order keeps the gold already paid.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B9
- **Checker's note:** Design question for Harry.
- **Evidence:** app.js:3236-3244. Runtime B6: 1000, 600 after issue, 600 after cancel.

### BAS-29 · Arbitration log shows '[object Object]'
**Later, Harry's call** · other

- **Before:** The Turn Log line for a council verdict prints '[object Object]' instead of the dice number.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** The popup itself shows roll.d20 correctly (3014).
- **Evidence:** app.js:2953-2954 uses ${roll} (an object). Runtime B4 log.

### BAS-30 · Compendium card pictures and local descriptions mostly hidden
**Later, Harry's call** · other

- **Before:** 19 of the 55 item cards and 35 hand-written item descriptions (20 not stored anywhere else) never show, because of name mismatches and unused code.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B15
- **Evidence:** app.js:3904-3906 (exact names), 3665-3878 (no callers); data analysis: 36 of 55 cards matched

### BAS-31 · Minor: duplicate Clear Warehouse handler; missing seal sound; broken HTML nesting; treasury can go negative then snap to 0 on reload
**Later, Harry's call** · other

- **Before:** Small tidy-ups. 'Cleared warehouse' is logged twice. The seal sound file does not exist. The page has mismatched sections. A failed delegation can push gold below zero, and the next reload quietly resets it to 0.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B17 covers whether the treasury may go negative.
- **Checker's note:** Also: once defenders drop to 0 through war casualties, the armed flag stays true, so later recruits show 'Armed' without paying (5354-5357, 263-266).
- **Evidence:** app.js:530 and 1485; 3055; index.html:186-188, 497-499; app.js:1086 vs 4843

### BAS-32 · A Trade Consortium can never reopen a route that has expired
**Later, Harry's call** · breaks the tool

- **Before:** When a consortium's trade route ends, it stays on the list marked 'expired'. Signing a new consortium with the same clan later pays contract income but never opens a new route, so that clan's trade route is dead for good. Because a reload already wipes consortiums and expires their routes, one reload permanently kills trade with those clans.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B21. Less urgent once the reload wipe (above) is fixed.
- **Evidence:** The existence check ignores status: routes.some(r => clan matches) (app.js:1135-1136). Expired routes are never removed (2360-2369, 2375-2381). Runtime t_reopen.js: with an expired Blackstone route, a Great Success consortium gave '+260 gp/turn' but no 'Route opened' line; the route stayed 'expired' and the next Advance paid only contract income.

### BAS-33 · A natural 1 on a Hall action counts as a success
**Later, Harry's call** · other

- **Before:** If you roll a 1 on a Hall of Emissaries action, the result box says 'Bad Failure', but the deal is still signed at full income with no Political Capital loss and no cooldown. That is better than rolling a 2, which fails with -20 Political Capital and a 2-turn cooldown.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B20
- **Evidence:** tierFromRoll returns 'critical_failure' (app.js:1862). The tier table has no branch for it (958-962), so it keeps turnsAdj 0, income ×1 and PC 0. formatTier prints 'Bad Failure' (1875). Runtime t_more.js E: roll 1 gave a 'Trade Agreement (4 turns) +69 gp/turn', PC +0, no cooldown. E2: roll 2 gave no deal, PC -20, cooldown 2.

### BAS-34 · Host Delegation result box loses its summary line
**Later, Harry's call** · other

- **Before:** After a Host Delegation, the result box has an empty line where the outcome text should be (for example 'The delegation leaves impressed. Promises become leverage.'). The text is written but never shown or logged.
- **After:** Kept as it is in the rebuild.
- **Evidence:** Inner 'let summary' (app.js:1043) shadows the outer one (941), which stays ''. Runtime t_more.js F: the first .siResSummary is empty, and the log body ends with a blank summary.

### BAS-35 · Shrine charm effects are never shown
**Later, Harry's call** · other

- **Before:** The six shrine charms each have written effects in the data (for example Tellurian Root Charm: 'Advantage on CON saving throws once per short rest. Value = 100gp.'). The tool never shows this text, and crafted charms go to the warehouse with only the shrine's name as the note.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B23
- **Evidence:** The option notes are in facilities.json (shrine craft options). The generic warehouse path uses order notes only (app.js:1244-1246). issueOrder sets notes only for the Library (3284-3303). renderFunction shows fn.notes, not option notes (4542). The compendium entries for the charms are empty.


## Clan Crest Creator
Old repo: `_legacy/clan-crest-creator` (file:line references point there).

### CRS-01 · Fixed internal ids in the crest drawing
**Fixed by the new design** · other · listed in the handover

- **Before:** The crest's hidden drawing parts use fixed names such as 'shadow'. In one combined suite, two crests on screen (or another tool using the same names) could borrow each other's shadow or shape cut-out and draw wrongly. Not a problem in the old stand-alone tool.
- **After (planned):** Must do as part of the rebuild (CLAUDE.md namespacing): prefix every id with a unique tsi-crest-… prefix. Does not change how the crest looks.
- **Decision note:** Every SVG id gets a tsi-crest- prefix (namespacing rule).
- **Checker's note:** A rebuild requirement (namespacing), not a legacy bug. The bigger clash risk is the HTML control ids; see new_bugs.
- **Evidence:** app.js:296-299, 318, 324, 330, 335, 399, 404. No clashes found in the other seven legacy tools (grep).
- **Phase 2:** Fixed. The drawing's hidden part names now start `tsi-crest-svg-` (clip, texture, gloss, shadow, stripes). The tests check every id on the page is unique.

### CRS-02 · Crest's control ids clash with the Heartwood Ritual's
**Fixed by the new design** · breaks the tool

- **Before:** Two of the crest's on-screen controls use the same hidden names as controls in the Heartwood Ritual: its Reset button and its motto box. If both tools' pages are ever in the suite at once and not renamed, the crest could wire itself to the Ritual's 'Reset Ritual' button, or the Ritual to the crest's. Pressing one tool's button would then act in the other.
- **After (planned):** Must do as part of the rebuild (CLAUDE.md namespacing): prefix every crest element id (e.g. tsi-crest-reset), or look elements up inside the crest's own root element rather than the whole page. The handover's section 13 warns about generic DOM ids in general but does not name this clash.
- **Decision note:** Namespacing rule: ids prefixed and looked up inside the tool.
- **Evidence:** The crest looks up elements by id with getElementById (app.js:4, 115, 130): 'btnReset' and 'bannerText'. The Ritual uses the same ids: tellurian-ritual-engine/index.html:194 (id="bannerText"), :294 (id="btnReset"), ritual.js:108, 139. getElementById returns the first match in the page.
- **Phase 2:** Fixed. The Crest's controls are built inside its own screen and never looked up across the page, and their ids start `tsi-crest-field-`. While building, the tests caught a new clash of the same kind (the Texture drop-down and the drawing's texture layer shared a name, which darkened every crest). It was fixed before release by the two prefixes above.

### CRS-03 · Crest stylesheet restyles every element on the page, not just the crest
**Fixed by the new design** · breaks the tool

- **Before:** The crest's style file doesn't only style its own parts. It also sets the look of every page body, label, dropdown, text box and slider. Loaded into the shared suite unchanged, it would change fonts, colours and sizes in the other tools too.
- **After (planned):** Must do in the rebuild: scope every rule under a crest root class (e.g. .tsi-crest label), give the classes a crest- prefix, and take body and page-wide styling from the shared design tokens.
- **Decision note:** Namespacing rule: styles prefixed and scoped to the tool.
- **Evidence:** styles.css:13-21 (*, html, body with background #080707 and a system font), 150-153 (label), 155-167 (select, input[type=text]), 169-171 (input[type=range]). The classes are also generic (.btn, .panel, .grid, .row, .block, .preview, .bg, .topbar, .wrap, .hint); .btn is also used by the Ritual.
- **Phase 2:** Fixed. Every rule in `tools/crest/crest.css` is scoped under `.tsi-tool--crest` and every class starts `tsi-crest-`. The page-wide styles come from the shared tokens. A test reads the stylesheet and checks it.

### CRS-04 · Round shield has a line through the middle and a stick hanging below
**Later, Harry's call** · other

- **Before:** Choosing the Round shield draws a gold line straight down the centre of the shield and a thin 'handle' poking out below it, so it looks like a paddle rather than a round shield. It also appears in the downloaded PNG.
- **After:** Kept as it is in the rebuild.
- **Decision note:** K1
- **Checker's note:** Cosmetic, and in the PNG too. Keep it for the faithful rebuild and ask Harry.
- **Evidence:** shieldPathRound app.js:686-693 draws the circle, then a curve from the top down to y+h-40 and closes back to the top, so the border stroke traces a vertical line. Screenshot 05_round_sun_solid.png and 06_contact_sheet.png (round).
- **Phase 2:** Kept as it is (Harry's answer K1). The Round shield is drawn exactly as before.

### CRS-05 · Downloaded PNG uses a different font for the motto than the preview
**Deliberate change** (Harry's answer K4; was *Later, Harry's call*) · other

- **Before:** The motto on screen is in a plain modern font, but the saved picture uses an old-fashioned newspaper-style font instead, because the picture can't see the page's fonts. What you see is not quite what you get.
- **After:** The motto uses the suite's Cinzel font in both the preview and the PNG (see Phase 2).
- **Decision note:** K4 (default: the suite font, embedded so preview and PNG match)
- **Checker's note:** Not a fix-now bug. It is a rebuild decision, because the new suite font would change the preview anyway.
- **Evidence:** No font-family on banner text (app.js:581-583, 595-597, 617-619). Preview font = system sans (styles.css:17); export crop 07b_export_banner_zoom.png shows serif 'HOLD FAST'.
- **Phase 2:** Changed (Harry's answer K4). The motto is now set in the suite's Cinzel font in the preview **and** the PNG. The font file is packed inside the downloaded picture (`tools/crest/data/motto-font.js`, the unchanged Cinzel file as base64), so what you see is what you get. A test checks the PNG really uses it.

### CRS-06 · Long mottos spill off the banner and get cut off
**Later, Harry's call** · other · listed in the handover

- **Before:** A long motto runs past the ends of the ribbon/plaque/scroll. With 26 wide letters it runs off both edges of the picture and is cut off in the PNG. Even the built-in motto 'In Scarlet We Stand' pokes slightly past the ribbon.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Harry's call later. Not from the handover, which lists it only as a test case.
- **Evidence:** renderBanner fixed font-size 34 and banner width 464 (app.js:572-624). Playwright bbox: 26 W's = x -10, width 1,045 in a 1,024 image; 'In Scarlet We Stand' ribbon = 269-756 vs banner 280-744. Screenshots 03_longbanner_*.png.
- **Phase 2:** Kept as it is. Long mottos still run past the banner.

### CRS-07 · Random names have no space between the two words
**Later, Harry's call** · other

- **Before:** Random names come out as 'StormOath' or 'EmberCircle of the Salt Coast' with a capital in the middle and no space, while the starting name is 'Blackstone Wardens'. The file name then becomes e.g. 'EmberCircle_of_the_Salt_Coast.png'.
- **After:** Kept as it is in the rebuild.
- **Decision note:** K2
- **Checker's note:** Faithful: keep it and ask Harry.
- **Evidence:** app.js:15 `${a}${b}${c}`; Playwright random samples 'StormOath', 'EmberCircle of the Salt Coast', 'ScarletKindred'.
- **Phase 2:** Kept as it is (Harry's answer K2): "StormOath", no space.

### CRS-08 · 'Etched' texture only darkens the shield
**Later, Harry's call** · other

- **Before:** Choosing the 'Etched' texture just makes the whole shield a bit darker; no visible etching pattern appears.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Cosmetic. Keep it.
- **Evidence:** renderTexture etch (app.js:456-464) displaces a plain black rectangle at 25% opacity, so only its edges move. Contact sheet 06_contact_sheet.png, texture row.
- **Phase 2:** Kept as it is.

### CRS-09 · Error message tells the user to open the developer console
**Later, Harry's call** · other

- **Before:** If a download fails, the pop-up says 'Open console for details', which means nothing to a non-developer.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Later: use a plain-English message.
- **Evidence:** app.js:210-213
- **Phase 2:** Kept the old wording ("Download failed. Open console for details."), now shown in the suite's own pop-up with the technical details underneath, instead of a browser alert.

### CRS-10 · An invisible control character in the motto makes the download fail
**Later, Harry's call** · other

- **Before:** If a hidden control character gets into the motto box (only possible by pasting, not by typing), the preview still shows the crest but Download fails with the 'Open console' message. Ordinary typing, including emoji, '&', '<' and quotes, works fine.
- **After:** Kept as it is in the rebuild.
- **Evidence:** Motto set to 'Hold\u0001Fast': the preview renders 'HOLD\u0001FAST', and Download gives no file plus alert 'Download failed. Open console for details.' (run1.out ctrlChar). XMLSerializer outputs the character raw, so the SVG image is not valid XML and img.onerror fires (app.js:633-645). Tab, emoji and '&' all exported OK.
- **Phase 2:** Kept as it is. A hidden control character pasted into the motto still makes Download fail, with the message above.

### CRS-11 · Double-clicking Download saves two copies
**Later, Harry's call** · other

- **Before:** Clicking Download twice quickly saves two identical pictures, e.g. a second copy named 'Blackstone_Wardens (1).png'. Nothing is lost or counted twice; it just leaves an extra file.
- **After:** Kept as it is in the rebuild.
- **Evidence:** page.dblclick('#btnDownload') produced 2 download events, both 'Blackstone_Wardens.png' (run1.out doubleClickDownloads). The handler has no busy flag (app.js:201-214).
- **Phase 2:** Kept as it is: a double click still saves two copies. The tests check this still happens, so it isn't changed by accident.

### CRS-12 · Some clan names give a wrong or odd file name
**Checked: not a bug** · other

- **Before:** The 'Saved as' hint can differ from the real saved file: a name of '...' shows '....png' but saves as 'png.png'. In the test browser, any name with an accent, curly apostrophe or emoji (e.g. 'Café Oath', 'Tide’s Oath') saved as 'download' with no .png ending. This last part may be a quirk of the test browser and is not confirmed in normal Chrome.
- **After:** Kept as it is in the rebuild.
- **Decision note:** Refuted by the checker: the "download" file names came from the test machine's language setting. Only the "..." name mismatch remains (trivial).
- **Evidence:** safeFileName app.js:278-285 only strips / \ : * ? " < > | and spaces. Playwright run2.js/run3.js/run4.js (a plain test link with 'Café Oath.png' also became 'download', so possibly headless-only).
- **Phase 2:** Kept as it is: the same file-name clean-up as the old tool.



### CRS-13 · "Scarlet" with one t where it means the Scarlett Isles
**Deliberate change** (Harry's answer K3, 25 September 2026)

- **Before:** The random place "of the Scarlet Isles" and the random motto "In Scarlet We Stand" spelled the Isles with one t.
- **After:** Both have two t's: "of the Scarlett Isles" and "In Scarlett We Stand". Harry decided the motto means the Isles. Where "Scarlet" is the colour, it keeps one t: the "Scarlet" first word in random names (like Black, Iron and Ember) and the "Scarlet & Gold" palette.
- **Evidence:** app.js:7, 9, 55, 258. The tests check the spellings.

### CRS-14 · Download, Random Crest and Reset are below the fold on the laptop
**Fixed by the new design** · layout (SUI-10)

- **Before:** In a maximised window on Harry's laptop (1707 × 930), the Download button was half off the bottom of the screen, and Random Crest and Reset were fully below it. The page was 1,042 px tall.
- **After:** The four control groups sit two by two beside the preview. Every control, the preview and Download are in view at 1707 × 930, in full screen and on the TV, with no sideways scroll. The preview crest grows with the window's height.
- **Evidence:** Measured in the planning and phase 2 sessions; tests/e2e/phase2.test.js "Fits the laptop and the TV".

## Arenas of The Scarlett Isles
Old repo: `_legacy/arenas-of-the-scarlett-isles` (file:line references point there).

### ARN-01 · Tool won't start when index.html is double-clicked
**Must fix** · won't work double-clicked / offline

- **Before:** The arena list is loaded in a way browsers block for files on your laptop. Opening the old page from a folder shows the layout but nothing works: the Arena and Round lists are empty and the buttons do nothing.
- **After (planned):** Store the arena data as a .js data file loaded with a normal script tag (window.TSI_DATA.arenas). No values change.
- **Checker's note:** load() runs before the fetch (1856), so an old save is never damaged even when the tool fails to start.
- **Evidence:** app.js:1858 fetch('data/arenas.json'). Test t1: 'Fetch API cannot load file:///…/data/arenas.json. URL scheme "file" is not supported.', pageerror 'Failed to fetch', 0 dropdown options.

### ARN-02 · Apply can deal one hit's damage again and again
**Must fix** · applies something twice · listed in the handover

- **Before:** After one successful attack, every extra click on Apply rolls and deals the damage again, with the hit picture and sounds each time. Re-rolling the attack also allows another Apply.
- **After (planned):** Keep the turn's attack result as data and refuse a second Apply once damage has been applied. Ask Harry whether re-rolling the attack should also be locked after damage is applied.
- **Decision note:** A5 decides once per turn or once per attack roll (default: once per turn).
- **Checker's note:** After the target dies, the DM can switch to another living target in the dropdown and Apply the same hit again.
- **Evidence:** app.js:1617-1653: damageApplied is set at 1652 but never checked; 1587 clears it on each attack roll. Test t2: 3 clicks with damage 10 took Arena Duelist 1 from 45 to 15 HP, and the hit sound played 3 times.

### ARN-03 · Round prize can be paid more than once
**Must fix** · applies something twice · listed in the handover

- **Before:** After a round is won and the prize paid, pressing End Round then 'Count as Win' pays the prize again. It works every time, including after closing the results panel.
- **After (planned):** Record that the round is finished and the prize paid, and pay the prize at most once per round. After a result, turn off End Round, Forfeit and Play Turn until the next round starts or Leave Arena is pressed.
- **Checker's note:** After a Defeat, End Round → Count as Win also pays the prize. The same 'round finished' flag covers this.
- **Evidence:** endRound adds reward_gp on every call (app.js:1244-1248); the End Round button has no 'already finished' check (1949-1969). Test t2: gold went from 500 to 1000 on a round already cleared.

### ARN-04 · The round keeps running after it has been won or lost
**Must fix** · applies something twice

- **Before:** When a round ends, the tool doesn't mark it as over. Play Turn still works, overtime keeps hurting players, and reaching the target again pays the prize again.
- **After (planned):** Use the same 'round finished' flag as the prize fix.
- **Checker's note:** Forfeit after a win still shows a Defeat dock, and the crowd loop keeps playing until Leave Arena.
- **Evidence:** endRound never sets runActive = false (app.js:1240-1296); openTurnDock only checks runActive (1396). Test t2: after 'Round Cleared', Play Turn plus Resolve raised gold from 1000 to 1500 and applied overtime damage.

### ARN-05 · When storage is full, every portrait is erased and a 'not added' player comes back
**Must fix** · loses saved data

- **Before:** If the laptop's browser storage is full, adding a player with a picture says 'Storage is full… Try a smaller image' and appears not to add them. Behind the scenes the tool saves anyway without anyone's pictures. After a reload that player is back, and every player's portrait is gone. Any later save while storage is tight also quietly strips all portraits. All double-clicked pages share one storage area, so another tool filling it (for example the Battlemap's saved maps) can trigger this.
- **After (planned):** Save through the shared save module. If storage is full, keep the last good save exactly as it was, tell Harry clearly, and keep memory and storage in step. Never drop portraits silently.
- **Checker's note:** The chosen fix is right: keep the last good save, keep memory and storage in step, and tell Harry.
- **Evidence:** app.js:211-219 (strips all images and saves), 1839-1846 (only memory is rolled back). Test t5: with storage filled, adding 'Cael' with a portrait showed the alert; memory held [Runa(portrait), Bram(portrait)] while storage and the reloaded page held [Runa, Bram, Cael] with no portraits. Origin check: location.origin 'file://' is shared by other file pages.

### ARN-06 · Fonts come from the internet
**Must fix** · won't work double-clicked / offline

- **Before:** The Lion's Mark lettering uses fonts downloaded from Google. With no Wi-Fi it falls back to a plain serif.
- **After (planned):** Use the suite's locally bundled Cinzel and IM Fell English SC.
- **Checker's note:** Nothing breaks. Only the Lion's Mark lettering (styles.css:532, 594) falls back to Georgia. It is still a CLAUDE.md 'no online resources' item.
- **Evidence:** index.html:8-10; test: requestfailed fonts.googleapis.com ERR_CERT_AUTHORITY_INVALID

### ARN-07 · Double-clicking Play Turn uses up two turns and skips a player
**Must fix** · applies something twice

- **Before:** If you double-click Play Turn, or click it again while a turn is already open, the tool counts two turns. The player whose turn it should have been is skipped, and overtime arrives a turn early. In the Lion's Mark round it can also re-pick the mark and blow the horn again.
- **After (planned):** Ignore Play Turn while a turn is already open. Whether a cancelled turn should count stays Harry's call.
- **Evidence:** openTurnDock adds to the turn counter and the rotation on every call, with no check for a turn already open (app.js:1411, 1437, 1422-1433). Run t2.js: the turn counter went 1→3 after one double-click, and the active player shown was Cael (Bram skipped).

### ARN-08 · Double-clicking Add with a portrait adds the player twice
**Must fix** · applies something twice

- **Before:** When you add a player with a picture, a quick double-click on Add creates two copies of that player, each with the portrait. Both are saved.
- **After (planned):** Turn off the Add button while the portrait is being processed. Accept only one submit per open form.
- **Evidence:** The submit handler is async and waits while the portrait is shrunk (app.js:1833), before it adds the player (1837) and closes the form (1849), so a second submit gets through. Run t4.js: stored players ['Runa:4391','Runa:4391'] after one double-click. Without a portrait, no duplicate appeared.

### ARN-09 · Replaying Lion Totems shows the swordsmen already dead
**Fixed by the new design** · other

- **Before:** If you play the Lion Totems round again in the same session, the picture shows both swordsmen dead from the start, even though they are back at full health.
- **After (planned):** The rebuild's per-round state starts fresh each round, which removes this. Record it in KNOWN_ISSUES.
- **Decision note:** Each round starts from fresh state.
- **Checker's note:** Display only. A fresh per-round state in the rebuild removes it.
- **Evidence:** state.mmR2Dead is created at app.js:420 and never reset by resetRunState (999-1017) or startRound (1019-1034). Test t4: on re-entering mm_r2 the overlay was lion_swordsman_both_dead.png while both had 90 HP.

### ARN-10 · Rules panel is cut off on laptop-sized screens
**Fixed by the new design** · other

- **Before:** On a typical laptop screen, the bottom of the rules panel (the list of approaches and the Easy/Standard/Hard DCs) is hidden and can't be scrolled to. The DCs still appear in the turn panel's dropdown.
- **After (planned):** Let the dock scroll in the rebuilt layout (a layout change, not a rule change). Ask Harry for his laptop's screen size.
- **Decision note:** Covered by the laptop/TV layout requirement.
- **Evidence:** styles.css:180 sets the dock lane height to max calc(100vh - 92px - 220px) with overflow hidden (185); #dockBody has overflow hidden, 'no scrolling in dock' (307-308). Run t8.js: at 1366x768 the rules body was 302px against 478px of content, with approaches and DCs clipped. At 1280x720 the Win/Lose card was clipped too; nothing was clipped at 1920x950. Screenshot v8_rules_1366x768.png. The turn panel's controls were not clipped at any size tested.

### ARN-11 · Pass or fail is read from the tick symbol, and choices can be changed after rolling
**Later, Harry's call** · other · listed in the handover

- **Before:** Resolve Turn works out pass or fail by looking for the green tick on screen, and it reads the approach and difficulty as they are when you click Resolve, not when you rolled. A player can roll at Easy, then switch to Hard Animal Handling and claim the Beast-Pen double success. The skill check can also be re-rolled freely.
- **After:** Kept as it is in the rebuild.
- **Decision note:** A6. The roll is stored as data behind the scenes either way.
- **Checker's note:** The rules module will need the roll stored as data anyway (a behind-the-scenes change). Locking the roll is Harry's call.
- **Evidence:** app.js:1738-1740 (tick check and dropdowns read at resolve time); mem.skill stored at 1572 but never used. Test t3: Bram rolled Nature at Easy (DC 16), switched to Hard plus Animal Handling, and the log said 'Bram mastered the beast line (Hard): +2 successes'.

### ARN-12 · 'All opponents down' overrides a win or loss on the same turn
**Later, Harry's call** · other · listed in the handover

- **Before:** If the last enemy falls on the same turn the party hits its failure limit (or is wiped out), the tool doesn't declare defeat. It just says the round 'can end now' and leaves it to the DM. Reaching the success target also beats a loss from overtime on the same turn.
- **After:** Kept as it is in the rebuild.
- **Decision note:** A2
- **Checker's note:** Not re-run at runtime, but the code order is clear. It is a rules question for Harry.
- **Evidence:** app.js:1784-1798. Test t3: failures 3/3 with both duelists at 0 gave 'Opponents defeated. Round can end now.' and no Defeat. In r5, overtime pushed failures to 2/2 while successes reached 12, which was scored as a win (+50,000).

### ARN-13 · Lion Totems can be won without breaking a single totem
**Later, Harry's call** · other · listed in the handover

- **Before:** The round text says you win by shattering the three totems, but reaching 8 successes also wins. Breaking all three totems doesn't end the round by itself; the DM still has to press End Round.
- **After:** Kept as it is in the rebuild.
- **Decision note:** A1
- **Checker's note:** Rules question for Harry.
- **Evidence:** arenas.json:228, 238-240 vs app.js:1765, 1790. Test t4: 8 successes with all totems at 45 HP gave 'Round Cleared' and +8000 gold; three totems down gave only a status message.

### ARN-14 · A cancelled turn still counts
**Later, Harry's call** · other

- **Before:** Opening Play Turn and then pressing Cancel (or opening View Rules or Add Player mid-turn) still uses up a turn and moves on to the next player. The skipped player loses their go and overtime arrives a turn early.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** The double-click form of this is a separate new bug (applies_twice).
- **Evidence:** app.js:1411 and 1437 advance turn and turnIndex before anything is rolled; Cancel just hides the dock (1546). Test t2: Bram's turn was cancelled, the next turn went to Cael, and overtime damage started at turn 7 after only 6 real turns.

### ARN-15 · Leaving the arena leaves the enemy picture and the Lion's Mark badge on screen
**Later, Harry's call** · other

- **Before:** After 'Leave Arena', the last enemy picture and the Lion's Mark name can stay over the arena even though no round is running.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** If a 5.2 s restore timer is still pending, it hides the layer later. The HUD stays either way.
- **Evidence:** The Leave Arena handler (app.js:1285-1293) calls resetRunState (999-1017), which never refreshes the scene or the HUD. Test t4 screenshot t4_after_leave.png: the Lion Knight and the 'Cael' mark were still showing after 'Run ended'.

### ARN-16 · Missed attacks show no picture in four rounds
**Later, Harry's call** · other

- **Before:** In the Duelist rounds (until a duelist falls), the Wyvern Rite and the Lion's Mark, a missed attack plays the failure sound but shows no failure picture. The code looks for a data entry that doesn't exist.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** The four rounds are r1 and mm_r1 (before a duelist falls), r5 and mm_r3.
- **Evidence:** getFailOverlaySrc returns overlays.pc_fail (app.js:494, 504), but no round has that key (script check). showOverlay ignores an empty source (746). Test t3: the r1 and r5 overlays stayed on standard while wyvern_fail.mp3 and crowd_fail.mp3 played.

### ARN-17 · Middlemount Opening Bout shows both duelists on a failure after one has fallen
**Later, Harry's call** · other

- **Before:** In Middlemount Round 1, once a duelist is down, a failed skill check still shows the 'both duelists' failure picture. Swyth Round 1 correctly shows the one remaining.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Checked by reading the code only.
- **Evidence:** The r1-only branch at app.js:1172 (mm_r1 drops to the generic path at 1181). Test t4: after Duelist 1 fell in mm_r1, a skill failure showed arena_duelists_fail.png.

### ARN-18 · Damage with a bonus becomes a tiny number
**Later, Harry's call** · other

- **Before:** Typing damage like '2d8+3' isn't understood. The tool quietly deals 2 damage (the first digit).
- **After:** Kept as it is in the rebuild.
- **Decision note:** A7
- **Evidence:** app.js:1641-1645 (/^\d+d\d+$/ test, then parseInt). Test t4: '2d8+3' gave 'Damage applied: 2'.

### ARN-19 · Defeat message always names the Swyth trials
**Later, Harry's call** · other

- **Before:** Losing at Middlemount still says 'The Salt-Ring Trials end here.'
- **After:** Kept as it is in the rebuild.
- **Decision note:** A8
- **Evidence:** app.js:1254; test t4 mm_r3 defeat subtitle

### ARN-20 · Round list doesn't follow 'Proceed to Next Round'
**Later, Harry's call** · other

- **Before:** After moving to the next round, the Round dropdown still shows the old round. Reloading before the first turn of the new round sends you back a round.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Fixed as soon as the first Play Turn saves (1711).
- **Evidence:** startRound (app.js:1019-1051) neither refreshes the dropdowns nor saves. Test t6: state r4 with the dropdown showing r1; after reload roundId was r1.

### ARN-21 · Breaking the last totem with the side-panel buttons doesn't topple the guardians
**Later, Harry's call** · other

- **Before:** The 'last totem falls, guardians withdraw' rule only works through the turn dock's Apply button, not when the DM lowers a totem's HP with the Opponents panel buttons.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** The survey said this wasn't runtime-tested; it now is.
- **Evidence:** The rule exists only at app.js:1670-1686; the enemy card handler (939-995) has none. Found by reading the code; not tested at runtime.

### ARN-22 · Round progress is lost on reload
**Later, Harry's call** · other · listed in the handover

- **Before:** Refreshing the page mid-round keeps the party's HP and gold but forgets the round: score, turn, enemies, Lion's Mark and Beast-Pen bonuses. Entering again restarts the round with the party still hurt.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Not a regression. The old tool never saved it.
- **Evidence:** app.js:199-206; test t3 before and after reload

### ARN-23 · Lion's Mark round is lost on the first turn if two players are already down
**Later, Harry's call** · other

- **Before:** HP carries over between rounds. If two players reach 0 HP in the Lion Totems round, the Lion's Mark round ends in Defeat after its very first turn, even when that turn is a success.
- **After:** Kept as it is in the rebuild.
- **Decision note:** A3
- **Evidence:** defeatByTwoDown counts every player at 0 HP (app.js:1771-1772), and startRound never heals (1019-1051). Run t7.js: with Cael and Dara set to 0 before mm_r3, the first turn was a success (1/10) and the Defeat dock appeared (screenshot v7_mm_r3_pre_down_defeat.png).

### ARN-24 · An unreadable portrait makes Add silently do nothing
**Later, Harry's call** · other

- **Before:** If you pick a picture the browser can't open (for example an iPhone HEIC photo), clicking Add does nothing and shows no message. The player isn't added.
- **After:** Kept as it is in the rebuild.
- **Evidence:** Image decode failure rejects (app.js:179-184), and the submit handler has no error handling (1823-1834). Run t9.js with a fake .png: pageerror 'Uncaught (in promise) #<Event>', the player was not stored, the form stayed open and no dialog appeared.

### ARN-25 · Footer gold doesn't update after a win
**Later, Harry's call** · other

- **Before:** After a round is won, the gold counter under the arena still shows the old total until the next turn or reset. The results panel shows the right figure.
- **After:** Kept as it is in the rebuild.
- **Evidence:** resolveTurnFromDock refreshes the stats (1781) before endRound adds the prize (1246); endRound never calls renderHeaderStats. Run t10.js: footer gold 0, results panel 'Total gold' 500, stored totalGold 500.

### ARN-26 · Removing an opponent with Remove doesn't update the death pictures in Middlemount
**Later, Harry's call** · other

- **Before:** In Middlemount Round 1 and the Lion Totems round, using Remove on an opponent leaves its picture standing, as if it were still alive. Swyth Round 1 and the Beast-Pen handle Remove correctly.
- **After:** Kept as it is in the rebuild.
- **Evidence:** The card handler records deaths on Remove only for r1/r4 (app.js:944-945, 984-989). mm_r1/mm_r2 pictures are worked out from the HP of enemies still in the list (343-357, 433-434, 444-447). Run t10.js: mm_r1 after removing Duelist 1 still showed arena_duelists_standard.png (r1 showed defeated_1). mm_r2 after removing Totem 1 and Swordsman 1 still showed both standard overlays.

### ARN-27 · Changing the Arena or Round list, or pressing Enter The Arena, wipes a round in progress without asking
**Later, Harry's call** · other

- **Before:** Mid-round, touching the Arena or Round dropdown resets the whole round (score, turn, opponents) with no 'are you sure?'. Pressing Enter The Arena again restarts the round from scratch. Damage the party has taken stays.
- **After:** Kept as it is in the rebuild.
- **Evidence:** The select change handlers call resetRunState directly (app.js:1872-1889). enterArenaBtn calls startRound unconditionally (1891-1895), which zeroes the score and respawns enemies (1025-1042). Found by reading the code.


## The Heartwood Ritual
Old repo: `_legacy/tellurian-ritual-engine` (file:line references point there).

### RIT-01 · Reset Ritual crashes and leaves the old ritual on screen
**Must fix** · breaks the tool

- **Before:** Pressing Reset Ritual in the DM Dock clears the ritual behind the scenes, but the screen keeps showing the old rounds, pips and 'Seal set' text until you click something else, and the 'Ritual reset.' message never appears.
- **After (planned):** Rebuild reset as 'create a fresh ritual state, stop the finale timers, then redraw'. Clear armed assists and restore the heartbeat state at the same time.
- **Checker's note:** The state really is reset; only the screen update and the 'Ritual reset.' toast are lost, because the error is thrown before renderAll (1318). It still counts as breaking the tool, because the DM sees the Reset button apparently do nothing. Rebuild Reset as a fresh state plus a redraw.
- **Evidence:** ritual.js:1316 sets logEl.innerHTML where logEl is null (the #log element doesn't exist), so an error is thrown before toastMsg/renderAll (1317-1318). Test: pageerror 'Cannot set properties of null (setting innerHTML)'; the screen still showed p3/s1 and 'Dormant' after reset, then zeros after the next click.

### RIT-02 · Silence stone buttons are off-screen on common laptop screens
**Must fix** · breaks the tool

- **Before:** On a 1366x768 or 1536x864 laptop screen, or 1280x720, the Silence stone's Attempt and Assist buttons sit below the bottom of the window and the page won't scroll, so you can't click them.
- **After (planned):** Lay out the rebuilt stage (with the suite's top bar) so all three stones' buttons fit and work at 1366x768. Check with Playwright at 1366x768 and 1536x864.
- **Checker's note:** The DM Dock has no Silence Attempt, so zooming out (Ctrl -) is the only workaround. The rebuilt layout, with the suite top bar on top, must fit at 1366x768 in a normal window. Ask Harry what his screen size is.
- **Evidence:** styles.css:51 body overflow:hidden; styles.css:182 arena height; styles.css:292 .stone--bottom bottom:-24px. test5: Silence button centre off-screen at 1366x768 (bottom 794 > 768), 1536x864 and 1280x720; fine at 1440x900 and 1920x1080.

### RIT-03 · Stone crack pictures never show when opened as a file
**Must fix** · won't work double-clicked / offline

- **Before:** The cracks that should spread over a stone as it takes stress don't appear when you double-click the page, because the tool looks for the pictures in the wrong folder.
- **After (planned):** Remove the GitHub Pages path helper and use relative paths.
- **Checker's note:** This happens on every double-click, internet or not. It is a file-path problem rather than an internet one. styles.css:30-32 already defines --img-crack-1..3 relative to the stylesheet, and those would work from file://, but nothing uses them.
- **Evidence:** ritual.js:37-47 withBase and 515-517; test: url("/home/assets/img/cracks_1.png") ERR_FILE_NOT_FOUND

### RIT-04 · Wyvern and ending cinematics need the internet
**Must fix** · won't work double-clicked / offline · listed in the handover

- **Before:** The Wyvern video and all three ending videos are downloaded from GitHub while you play. With no Wi-Fi they don't play at all; the screen just skips them.
- **After (planned):** Bundle the four videos locally (two from the release; the other two are already identical files in the repo) and point to them relatively. Keep the missing-video fallback.
- **Checker's note:** from_handover is correct. Bundle the files locally: 2 are byte-identical to files already in the repo (md5 c06f1501 and dd080aaa); true_seal and strained_binding exist only in the release.
- **Evidence:** ritual.js:31-34; test: every cinematic request failed and the overlay closed via the error handler (ritual.js:327-338)

### RIT-05 · Fonts need the internet
**Must fix** · won't work double-clicked / offline

- **Before:** The engraved Cinzel headings and old-style body font come from Google, so offline the tool falls back to a plain serif.
- **After (planned):** Bundle both fonts locally with their licences.
- **Checker's note:** The page falls back to Georgia or the default serif, so it doesn't break, but the tool depends on Google Fonts to look right.
- **Evidence:** styles.css:3; test: request to fonts.googleapis.com failed

### RIT-06 · The Husk's 50% chance is rolled several times per click, and threats can appear from screen refreshes
**Must fix** · applies something twice · listed in the handover

- **Before:** The coin-flip for a Husk is supposed to be one 50% chance, but it's re-flipped every time the screen redraws, sometimes 4 times for one click (about a 94% chance). Even harmless DM Dock clicks like +Progress then -Progress or stepping a round back can summon a Husk, Buckbear or Wyvern.
- **After (planned):** Move the threat and ending checks into one explicit step that runs once per game action (or at a moment Harry chooses), store the result, and keep redraws display-only. Needs Harry to confirm when the roll should happen.
- **Decision note:** R2 decides when the one roll happens (no default).
- **Checker's note:** One 50% chance is applied up to 4 times in one action, so it fits the 'applies twice' category, and the handover asks for it to be fixed. Fixing it will make Husks appear noticeably less often, which changes the game balance, so Harry must say when the one roll should happen before it is built.
- **Evidence:** ritual.js:679 Math.random() < 0.5 inside updatePulse (558), called by renderAll (554) from 13 places (887, 893, 902, 909, 932, 954, 973, 988, 1007, 1022, 1027, 1318, 1387). test F: 4 rolls from one Veinwood Thrum, 2 from a ±Progress pair, 1 from ◀, and a Husk spawned from a dock +Progress.

### RIT-07 · Double-clicking Next Round skips a round
**Must fix** · applies something twice

- **Before:** A quick double-click on Next Round (or pressing N twice) advances two rounds, and any Husk or Buckbear gets to hurt the stones twice.
- **After (planned):** Ignore repeat clicks and key presses on Next Round for a moment (or until the round change has finished).
- **Checker's note:** The guard needs to cover the mouse, the N key and Enter/Space on a focused button. Double-clicking at round 7 with no threat would jump straight to the finale.
- **Evidence:** ritual.js:935-1023 has no guard, and a normal advance shows no banner to catch the second click (1020-1022). test K: a double-click went from round 1 to 3; N N went from 3 to 5.

### RIT-08 · The same Heartwood event can be applied again
**Must fix** · applies something twice · listed in the handover

- **Before:** Nothing stops Apply Event being pressed again for the same event in the same round, so its stress lands twice. A very fast double-click is currently caught by the full-screen banner, but a second press a few seconds later applies it again.
- **After (planned):** At minimum, add explicit double-click protection that doesn't rely on the banner. Whether an event may be applied only once per round is Harry's call.
- **Decision note:** Accidental double presses only; R3 decides whether an event may be applied again later in the round.
- **Checker's note:** Only the accidental double press (mouse or keyboard) is a fix-now item. Whether an event may be applied once per round is a rule for Harry to decide. Keep the guard even if the rebuilt banner stops catching clicks.
- **Evidence:** ritual.js:926-933 has no 'already applied' check. test K: a double-click added +1 stress only (the second click landed on the banner); a click after the banner cleared added another +1. test E: Veinwood Thrum applied twice.

### RIT-09 · Clicking Enable Sound twice plays two heartbeats
**Must fix** · applies something twice

- **Before:** If you press Enable Sound again (it still looks clickable), a second heartbeat starts on top of the first, and the first can't be stopped.
- **After (planned):** Make the button do nothing once sound is on (or a true on/off switch if Harry wants one).
- **Decision note:** R8 decides on/off switch vs enable-only.
- **Checker's note:** Also, the button already says 'Sound Enabled' before play() is tried (178-180 run before 184), so if play() fails it still claims sound is on.
- **Evidence:** ritual.js:155-191 creates new Audio objects every click; test C: 12 Audio objects and 2 looping heartbeats playing

### RIT-10 · Reset doesn't clear armed assists, finale timers or the paused heartbeat
**Fixed by the new design** · other

- **Before:** An assist armed before Reset still applies in the new ritual (e.g. an extra stress on the next failed Weight roll). After a True Seal the heartbeat stays silent after Reset until Enable Sound is pressed again.
- **After (planned):** Covered by the Reset rebuild (fresh state, clear timers).
- **Decision note:** Reset is rebuilt as a fresh ritual state that also clears assists and timers.
- **Checker's note:** The Reset fix covers this. The finale timers can't really fire after a Reset, because the seal overlay (z-index 200) covers the Dock until its 5.2 s timer ends.
- **Evidence:** ritual.js:1282-1319 never touches state.assistPending, the finaleSlowdown interval (758-765) or the seal timeout (778-781). test J: a failed Weight after reset gave +2 stress.

### RIT-11 · Silence Assist slot overrides the slot typed in the attempt
**Later, Harry's call** · other · listed in the handover

- **Before:** If a Silence Assist is armed, whatever slot you type in the attempt box is silently ignored and the assist's slot is used, even though the code comment says the DM can override it. The assist preview also always shows the DC for slot 0.
- **After:** Kept as it is in the rebuild.
- **Decision note:** R6
- **Checker's note:** The handover flags this too (from_handover true). It is a rule to confirm with Harry, not something to fix now.
- **Evidence:** ritual.js:1232-1239 (preset wins); 1036 and 1082-1083 (preview reads a box just reset to 0). test D: assist slot 0 plus typed slot 9 with roll 9 failed at DC 12.

### RIT-12 · An empty roll counts as a roll of 0
**Later, Harry's call** · other

- **Before:** If you press Apply without typing a number, it counts as a roll of 0 and the stone takes a failure, instead of asking for a number.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** This is Harry's call. It combines with the new 'Enter on Cancel' bug.
- **Evidence:** ritual.js:1176-1180: Number('') is 0, so the 'Enter a numeric roll result' check never fires. test2: an empty Weight attempt gave +1 stress; letters typed into the number box did the same for Memory.

### RIT-13 · The status line still says 'Binding in progress' after a seal or collapse
**Later, Harry's call** · other

- **Before:** When the ritual seals or all stones crack, the Pulse box keeps saying 'Steady / Binding in progress' until something else is clicked.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** A display-only fix, as the survey says.
- **Evidence:** ritual.js:577-591 writes the labels before the phase changes at 596-634, with no redraw afterwards. test I: t+6 s after the seal still showed 'Steady / Binding in progress'.

### RIT-14 · A second cinematic triggered while one is showing is dropped for good
**Later, Harry's call** · other

- **Before:** If an ending is triggered while another video (e.g. the Wyvern's) is still on screen, the ending video is skipped and will never play.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** This can happen from one ordinary event click, so flag it prominently to Harry as a later decision. It also happens if N is pressed during the Wyvern video.
- **Evidence:** ritual.js:238-241 ignores the new video if the overlay is open, but the 'shown' flag was already set (604-606, 626-628, 968-970, 983-985). test4 allCracked: the collapse right after the Wyvern appeared never requested fractured_containment.mp4.

### RIT-15 · The heartbeat gets permanently quieter after the first cinematic
**Later, Harry's call** · other

- **Before:** The heartbeat starts at 90% volume, but after any cinematic it comes back at 55%.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Cosmetic.
- **Evidence:** ritual.js:163 (0.90) vs 304 (0.55)

### RIT-16 · The narrative log is never shown
**Later, Harry's call** · other

- **Before:** The tool writes a story log (e.g. 'Glyph Fracture', 'Strained Binding'), but the log panel was removed, so nobody sees it.
- **After:** Kept as it is in the rebuild.
- **Decision note:** R10
- **Checker's note:** A question for Harry.
- **Evidence:** ritual.js:697-698 returns early; no #log element in index.html

### RIT-17 · The threat panel still works after the ritual has ended
**Later, Harry's call** · other

- **Before:** After an ending, a leftover threat can still be struck, and beating the Wyvern then still changes the stones.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Harry's call.
- **Evidence:** ritual.js:806-815 has no phase check; test4 wyvernAtRound8 left the Wyvern panel on screen after Strained Binding

### RIT-18 · Cracked stones don't look permanently cracked
**Later, Harry's call** · other

- **Before:** The crack picture depends on the stress number, so if a cracked stone's stress is lowered (Wyvern reward, Reprieve, DM Dock) it looks less cracked even though it's dead. Locked stones show no cracks at all.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Harry's call.
- **Evidence:** ritual.js:513-526 (image by stress, hidden when locked); there is no visual for the cracked flag

### RIT-19 · The P key plays the True Seal ending at any time
**Later, Harry's call** · other

- **Before:** A leftover test shortcut: pressing P plays the victory cinematic whenever you like.
- **After:** Kept as it is in the rebuild.
- **Decision note:** R7 (default: remove P)
- **Checker's note:** It does not set pendingFinalSeal, so no seal overlay follows. Ask Harry.
- **Evidence:** ritual.js:1380-1383 'TEMP TEST'; test K confirmed

### RIT-20 · Shortcut keys still work while a cinematic or banner covers the screen
**Later, Harry's call** · other

- **Before:** While a full-screen video is playing, pressing N still moves to the next round and E still rolls a new event behind the video. Pressing N during the Wyvern video shatters the ritual, and the ending video for that is then lost.
- **After:** Kept as it is in the rebuild.
- **Decision note:** R7
- **Evidence:** ritual.js:1368-1384: the window keydown listener only checks whether the modal is open. t2 T7: with the cinematic overlay open, N took the round from 1 to 2 and E changed the event from Root Surge to False Calm, and the overlay stayed open.

### RIT-21 · Important banners are replaced by a later banner in the same click
**Later, Harry's call** · other

- **Before:** When one action causes several things at once, only the last banner stays on screen. A stone cracking from an event or a failed Silence roll shows the event or 'Silence Frays' banner instead of 'GLYPH FRACTURE'. When an event collapses the ritual, 'RITUAL COLLAPSE' is replaced by the event banner. The Wyvern's arrival text plays unseen behind its 47-second video.
- **After:** Kept as it is in the rebuild.
- **Evidence:** t3 T16: a failed Silence attempt at stress 3 ends on the banner 'Silence Frays' (stress 4, cracked), and Echo of What Was at Memory stress 3 ends on the banner 'Echo of What Was'. t2 T6: after the collapse, the banner showing was 'Veinwood Thrum'. Code: applyEvent calls showBanner after ev.apply() (929-930), applyModal Silence at 1246-1261, and spawnThreat at 791-797 shows the banner under the z-index 9999 video.

### RIT-22 · Pressing Enter with Cancel selected applies the roll
**Later, Harry's call** · other

- **Before:** In the roll window, if the Cancel button is selected and you press Enter, the roll is applied instead of cancelled.
- **After:** Kept as it is in the rebuild.
- **Evidence:** ritual.js:1371-1373: Enter always calls applyModal. t2 T11: with roll 1 typed, Cancel focused and Enter pressed, weight stress went to 1 and the modal closed.

### RIT-23 · A beaten Buckbear comes straight back on the next click
**Later, Harry's call** · other

- **Before:** From round 6 onwards, if no stone is locked, beating the Buckbear doesn't help for long. The very next button press, even a harmless DM Dock one, summons a fresh Buckbear at full health.
- **After:** Kept as it is in the rebuild.
- **Evidence:** ritual.js:684-686 runs in updatePulse on every redraw. t2 T8: a Buckbear appeared at round 6, two Heavy Blows beat it (the panel was hidden), then a dock -Progress click on a stone at 0 brought a new Rootbound Buckbear.

### RIT-24 · No way to skip or close a cinematic
**Later, Harry's call** · other

- **Before:** Once a video starts, the DM can't stop it. The Wyvern video lasts 48 seconds and the endings 58. If a video never finishes loading, the screen stays black for good.
- **After:** Kept as it is in the rebuild.
- **Evidence:** The overlay closes only on the video's ended or error events (ritual.js:310-339), and there is no close button (index.html:323-333, z-index 9999). In t2 T6 and T7, with the request left hanging, the overlay stayed open until the test forced the video's 'ended' event.

### RIT-25 · The time-out endings show no message if their video doesn't play
**Later, Harry's call** · other

- **Before:** At round 8, Strained Binding and Fractured Containment show only a 2-second pop-up line and then the video. If the video is missing (as it is now without internet), the table sees no ending at all. Only the True Seal has a fallback screen.
- **After:** Kept as it is in the rebuild.
- **Evidence:** ritual.js:958-989 has no showBanner in either time-out branch, only toastMsg. By contrast, a True Seal video error still triggers the Final Seal overlay (315-338). The handover's proposed gate (master-handover.md:376) asks for 'correct media fallback' for all three endings.

### RIT-26 · The unused cinematics/player.html can't find its video
**No longer relevant** · other

- **Before:** An old leftover video page points to the wrong folder when opened as a file. The tool doesn't use it.
- **After:** Kept as it is in the rebuild.
- **Decision note:** Not ported; the films play inside the Ritual page.
- **Checker's note:** Leave it out of the rebuild.
- **Evidence:** player.html:50-59; test: file:///home/assets/video/ritual_collapse.mp4 not found


## Pelagosi Puzzle Trials
Old repo: `_legacy/pelagosi_marker_rune_puzzle` (file:line references point there).

### PEL-01 · Switching puzzles leaves the other puzzle running in the background
**Must fix** · breaks the tool · listed in the handover

- **Before:** If you change puzzle while one is playing or finishing, the old one keeps going out of sight. Its sounds still play, it overwrites the Status panel, and its 'success' window can pop up on top of the other puzzle. A memory restart in the background also switches off the Tidal chamber's glow.
- **After (planned):** Give each puzzle its own list of pending timers and a stop() that clears them, pauses sounds and bumps its run token. Call stop() for both puzzles on puzzle switch and on tool close (this is also the suite's clean-shutdown rule).
- **Checker's note:** Worse outcomes of the same cause are listed as new bugs: an empty Round 1 that starts itself (T3), and puzzles starting themselves after switching back (T2, J). resetTidalToIdle also strips the Memory classes stage-solved and round-awake-1/2 (1004), so the coupling goes both ways.
- **Evidence:** setActivePuzzle only resets the newly chosen mode (app.js:360-364). Test F: switching to Tidal mid-sequence left the status reading 'Round 1, Reply' and played 2 rune-place sounds after the switch. Test G: 'The Marker Sinks' modal opened over the Tidal stage (screenshot 11). Test N: 'The Chamber Opens' opened over the memory stage (screenshot 23). Test O: the memory restart removed the body class tidal-started (resetMemoryVisualState, app.js:544).
- **Phase 3:** Fixed. Each puzzle now has its own set of timers. Changing puzzle stops both puzzles first (their timers are cancelled, their sounds stop and any open pop-up closes), then starts the chosen one fresh. The two puzzles' resets still clear each other's glow, as before, but a puzzle you've switched away from is now stopped, so this can no longer happen out of sight. Test: switching puzzle mid-sequence plays no more rune sounds and the Status panel isn't overwritten.

### PEL-02 · Reset during the Memory ending still shows the success window
**Must fix** · breaks the tool · listed in the handover

- **Before:** If you press Reset while the Marker's ending is playing, a new trial starts, but a few seconds later the ending text, cavern sound and 'The Marker Sinks' window appear on top of the new trial anyway.
- **After (planned):** Track the ending timers and clear them in the reset.
- **Checker's note:** BEGIN then START TRIAL during the ending does the same, because startMemoryTrial (650-653) cancels nothing.
- **Evidence:** Anonymous timeouts at app.js:726-745 are never cancelled. Test H: after reset, successModal was visible while memoryState.phase was 'showing' and the status read 'Something shifts below' (screenshot 12).
- **Phase 3:** Fixed. Reset cancels the ending's timers. Test: Reset during the ending gives no success window, ending text or cavern sound afterwards.

### PEL-03 · Reset in the pause between Memory rounds skips Round I
**Must fix** · breaks the tool · listed in the handover

- **Before:** If you press Reset in the 1.9-second pause after a round is won, the trial restarts, but the old 'go to next round' instruction still fires. The players jump straight to the 4-rune round.
- **After (planned):** Track this timer and cancel it on reset, or check the run token before advancing.
- **Checker's note:** If the player switches puzzles and back instead of pressing Reset, the same timer starts an EMPTY round (see new bug).
- **Evidence:** app.js:685-687 calls startRound(roundIndex+1) with no check. Test D: straight after reset the round was 0; 2.5 s later it was round index 1 and the label read 'Round 2 of 3'.
- **Phase 3:** Fixed. Reset cancels the pause between rounds. Test: after Reset in the pause, the trial stays on round I.

### PEL-04 · Reset during a Memory failure surge restarts the trial twice
**Must fix** · applies something twice · listed in the handover

- **Before:** Pressing Reset while the 'sea rejects the order' surge is showing starts a new sequence. Then the old surge timer restarts it again with a different sequence, so players may see a rune from a sequence that is then thrown away.
- **After (planned):** Track and clear the failure timer on reset.
- **Checker's note:** Reset (the survey's test) and BEGIN then START both trigger it. The DC 12 consequence text is not shown twice; the restart itself is what happens twice.
- **Evidence:** app.js:707-711 is never cancelled. Test E: the sequence after reset was [remains, anchor, life, depth, remains] and 1.8 s later it was [remains, life, remains, depth, life]; runToken went up by 2.
- **Phase 3:** Fixed. Reset cancels the surge's restart. Test: Reset during the surge starts one new sequence, and it isn't replaced a moment later.

### PEL-05 · Reset during a Tidal surge unlocks the puzzle by itself
**Must fix** · breaks the tool · listed in the handover

- **Before:** If you press Reset while the chamber is surging, the puzzle goes back to 'press BEGIN', but two seconds later it switches itself back on, with the pillars clickable and the status 'The chamber resets', without anyone pressing BEGIN.
- **After (planned):** Track the surge timer and clear it in resetTidalToIdle, or check the tidal run token inside the callback.
- **Checker's note:** Switching puzzle away and back during the surge has the same effect (runtime J).
- **Evidence:** app.js:1101-1107 is never cancelled; tidalState.runToken is never checked. Test K: right after reset phase was idle and locked; 2.2 s later phase was 'outer', unlocked, rune buttons enabled, started=false (screenshot 21).
- **Phase 3:** Fixed. Reset cancels the surge's timer. Test: after Reset during the surge, the pillars stay locked and the puzzle waits for BEGIN.

### PEL-06 · Reset during the Tidal ending still opens the success window
**Must fix** · breaks the tool · listed in the handover

- **Before:** If you press Reset while the Tidal chamber is opening, the puzzle goes back to idle, but the cavern sound, the 'Stone unlocks' text and 'The Chamber Opens' window still appear.
- **After (planned):** Track the ending timers and clear them on reset, switch and close.
- **Checker's note:** BEGIN then START SEQUENCE during the ending gives the same result (runtime T5).
- **Evidence:** app.js:1193-1207 timers are never cancelled. Test L: after reset phase was idle, tidalSuccessModal was visible, and the status read 'Behind the northern arch…' (screenshot 22).
- **Phase 3:** Fixed. Reset cancels the ending's timers. Test: Reset during the chamber opening gives no "The Chamber Opens" window, "Stone unlocks" text or cavern sound afterwards.

### PEL-07 · A double-click on CHECK ALIGNMENT counts as two checks
**Must fix** · applies something twice

- **Before:** A quick double-click on the Tidal check button counts twice. On a wrong layout pressure jumps two steps (e.g. straight to Rising). On a correct layout the first click opens the basin and the second instantly 'attunes' it with the default Anchor, which is always wrong, so pressure rises and the table is told about a consequence nobody chose.
- **After (planned):** Ignore a second click on CHECK/ATTUNE while the event banner from the previous check is showing (about 1.7-1.9 s), or within about 0.4 s. Confirm with Harry that this counts as protection, not a rule change.
- **Checker's note:** Worse than the survey says: from Rising, a double-click fires the damaging surge. The fix counts as click protection, not a rule change.
- **Evidence:** checkTidalAlignment has no lock between clicks (app.js:1132-1175). run4: a double-click on the wrong layout gave pressure 2 and attempts 2. Test M: a double-click on the correct layout gave phase basin, pressure 1, attempts 2 and the event 'THE BASIN RIPPLES'.
- **Phase 3:** Fixed with the suite's double-click protection: a second click on CHECK ALIGNMENT or ATTUNE BASIN within 0.6 seconds is ignored. Deliberate checks a second apart count as before. Tests: a double click on a wrong layout raises the pressure one step and counts one attempt; on the right layout it opens the basin and nothing more.

### PEL-08 · Fonts missing offline
**Must fix** · won't work double-clicked / offline

- **Before:** Without internet the special rune-style heading font and the elegant body font don't load, so everything shows in a plain default font.
- **After (planned):** Bundle the fonts locally, with their licences.
- **Checker's note:** Bundle both fonts (SIL OFL) locally.
- **Evidence:** index.html:10; runtime font request failed; screenshots 01 and 16.
- **Phase 3:** Fixed. Uncial Antiqua (headings) and Cormorant Garamond (text) are bundled with the suite, so they show with the internet off. Test: the headings use the bundled Uncial Antiqua, and nothing is requested from the internet.

### PEL-09 · Switching away and back during the Memory round pause starts an empty round
**Must fix** · breaks the tool

- **Before:** Say you win a Memory round, switch to the Tidal puzzle during the short pause, then switch back. The Memory puzzle then starts a 'Round 1' by itself without showing any runes. The rune buttons unlock, and any rune you press counts as wrong, so the table is told to make the DC 12 save for a sequence nobody saw.
- **After (planned):** Same fix as the switching bug: one list of pending timers per puzzle, cleared on switch, reset, start and tool close. Also check the run token inside the timer before starting a round.
- **Evidence:** The stale timer at app.js:685-687 calls startRound(roundIndex+1) after resetMemoryToIdle has set roundIndex to -1 and masterSequence to [] (565-570). getRoundSequence then returns [] (420-423), so playRoundSequence goes straight to the reply step (592-620). Runtime T3: 2.8 s after switching back, phase was 'input', started false, seq [], 5 buttons enabled, 0 reply slots, label 'Round 1 of 3'. Clicking Anchor gave phase 'failed' and stage 'The sea rejects the order'. Screenshots v03-empty-round-after-switch.png and v03b-empty-round-click-fails.png.
- **Phase 3:** Fixed. Leaving a puzzle cancels its timers and bumps its run token. Test: switching away and back in the pause leaves the Memory trial waiting for BEGIN.

### PEL-10 · Switching away and back during a surge makes the puzzle start by itself
**Must fix** · breaks the tool

- **Before:** If you switch puzzle while a surge is playing (the Memory 'sea rejects the order' or the Tidal chamber surge) and then switch back, the puzzle you returned to starts itself about two seconds later. Nobody has pressed BEGIN.
- **After (planned):** Clear each puzzle's pending timers and bump its run token whenever it is left, reset or restarted.
- **Evidence:** Memory: the stale timer at app.js:707-711 calls resetTrialAndRestart. Runtime T2: right after switching back, phase idle and started false; 2 s later phase 'showing', started true, stage 'Round 1, Observe' (screenshot v02-memory-autostarts-after-switch.png). Tidal: the stale timer at app.js:1101-1107. Runtime J: right after switching back, phase idle and locked; 2 s later phase outer, unlocked, stage 'The chamber resets'.
- **Phase 3:** Fixed, as PEL-09. Tests: switching away and back during either surge leaves that puzzle waiting for BEGIN.

### PEL-11 · Starting again from the rules window during an ending or surge has the same leftovers as Reset
**Must fix** · breaks the tool

- **Before:** Pressing BEGIN and then START while an ending or a surge is still playing causes the same trouble as Reset. The Tidal 'The Chamber Opens' window pops up over a puzzle you have just restarted, and the Memory trial restarts twice with two different sequences.
- **After (planned):** Call the same 'stop this puzzle' routine at the start of startMemoryTrial, startTidalSequence, Reset, puzzle switch and tool close.
- **Evidence:** BEGIN is never disabled (1214-1220). startTidalSequence (1019-1030) and startMemoryTrial (650-653) cancel no pending timers. Runtime T5: 0.5 s into the Tidal ending, BEGIN then START SEQUENCE gave phase outer, unlocked, attempts 0; 3.5 s later tidalSuccessModal was visible and stage read 'Stone unlocks' (screenshot v05-tidal-modal-over-restarted.png). Runtime T6: in Memory the sequence changed after 1.7 s and runToken went from 5 to 7.
- **Phase 3:** Fixed. START TRIAL and START SEQUENCE now cancel the puzzle's leftover timers first, just as Reset does, so the Memory trial restarts only once (the same fix as PEL-04). Tests: BEGIN then START during either ending gives no window over the restarted puzzle.

### PEL-12 · Doesn't fit a laptop screen and ignores reduced motion
**Fixed by the new design** · other

- **Before:** On a 1366x768 laptop you have to scroll down to reach the Memory rune buttons and the Tidal check button. The flashes, shakes and drifting glows also ignore the computer's 'reduce motion' setting.
- **After (planned):** Handle this in the rebuild's layout and design system (the suite requires reduced-motion support). Not a rules change.
- **Decision note:** Covered by the laptop layout requirement and the reduced-motion rule.
- **Checker's note:** The problem is wider than the survey says. Handle it in the rebuild's layout; it is not a rule change.
- **Evidence:** run2: inputButtonsInView all false at 1366x768, and checkTidalButton is below the fold. styles.css:185-191 and 305-307 (min-height 48rem). No prefers-reduced-motion rule in styles.css.
- **Phase 3:** Fixed. The layout is now three columns: the puzzle choice, inscription and rune meanings on the left, the stage and its controls in the middle, and the status and notes on the right. On your laptop (1707 × 930), in full screen and on the TV, the rune buttons, BEGIN, Reset, CHECK ALIGNMENT and Shuffle are all in view with no scrolling. The Tidal chamber keeps its 3:2 shape, so the pillars sit on their plinths at every size. With reduce motion on, the shakes, tremors and screen flashes are gentler and the drifting light is slower. The rune flashes keep their exact timings because they're part of the puzzle.

### PEL-13 · A double-click on a Memory rune counts as two answers
**Later, Harry's call** · other

- **Before:** Double-clicking a rune button enters it twice. Because the Marker never shows the same rune twice in a row, this always fails the trial.
- **After:** Kept as it is in the rebuild.
- **Decision note:** P3
- **Checker's note:** 'Always fails' is wrong: the last rune of a round is safe. Only one DC 12 consequence is given, so this is not 'applies twice'. Leave it as is, and ask Harry, as the survey says.
- **Evidence:** handleRuneInput has no debounce (app.js:748-775) and there are no back-to-back repeats (app.js:412). run4: a double-click on the correct first rune gave input [depth, depth] and phase 'failed'.
- **Phase 3:** Kept, as Harry asked (P3). A test checks a double-clicked rune still counts twice.

### PEL-14 · Five extra sound effects are missing
**Later, Harry's call** · other

- **Before:** The Tidal puzzle tries to play five sounds that were never added: water stirring, pressure rising, current reversing, tidal surge and basin waking. They are silent and log 'file not found' errors.
- **After:** Kept as it is in the rebuild.
- **Decision note:** P2
- **Checker's note:** No change to behaviour needed. Those moments stay silent.
- **Evidence:** app.js:261-267; runtime requestfailed ERR_FILE_NOT_FOUND for all five.
- **Phase 3:** Kept silent, as Harry asked (P2), but each sound now has a ready-made slot. The suite doesn't ask for the missing files, so there are no "file not found" errors. When Harry supplies them, they go in `tools/pelagosi/assets/audio/` with the names listed in `ADD-THE-FIVE-SOUNDS-HERE.txt`, and are switched on in `tools/pelagosi/data/pelagosi-data.js`.

### PEL-15 · Some sounds restart on top of themselves
**Later, Harry's call** · other

- **Before:** At the end of the Memory trial the 'solve' chime plays twice, restarting 0.12 s later. At a Tidal surge the 'fail' sound plays and then restarts. This is cosmetic.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Cosmetic only. Harry's call.
- **Evidence:** app.js:658 and 726; app.js:1158 and 1098. The test B audio log ends puzzle-solve, puzzle-solve, cavern-open.
- **Phase 3:** Kept. The solve chime still plays twice at the end of the Memory trial, and the fail sound restarts at a Tidal surge.

### PEL-16 · BEGIN in the middle of a Memory sequence hides the sequence
**Later, Harry's call** · other

- **Before:** Pressing BEGIN while runes are flashing opens the rules window over the Marker, but the sequence keeps playing behind the blur, so players can miss it.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Faithful behaviour. Leave it.
- **Evidence:** app.js:1214-1220 only opens the modal. run2: the rules were open while phase stayed 'showing'.
- **Phase 3:** Kept. A test checks that the sequence carries on behind the rules window.

### PEL-17 · Basin box overlaps the pillar tiles
**Later, Harry's call** · other

- **Before:** When the Central Basin appears, its box and the event banner sit over the inner edges of the pillar tiles, partly covering their labels.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Cosmetic. In the same state, the disabled pillar tiles are dimmed to 42% opacity (styles.css:618-625), which makes them hard to read.
- **Evidence:** Screenshot 18 at 1600x1000; basin selector and pillar positions at styles.css:809-813 and index.html:171-201.
- **Phase 3:** Kept. The basin box and pillar tiles have the same proportions as before, so the overlap and the dimmed tiles look as they did.

### PEL-18 · Pressure carries into the basin, and Reset works differently in each puzzle
**Later, Harry's call** · other · added in phase 3 to record Harry's answer P4

- **Before:** In the Tidal Sequence, any pressure built up while aligning the pillars is still there when the basin step starts, so one wrong ATTUNE BASIN can reach the Surge sooner. Reset CURRENT PUZZLE starts a new Memory trial straight away, but puts the Tidal Sequence back to "press BEGIN".
- **After:** Kept as it is (P4).
- **Evidence:** A wrong basin name calls increaseTidalPressure on the same pressure the pillar checks built up, and unlocking the basin doesn't reset it (app.js:1080-1081, 1163-1175). Reset calls resetTrialAndRestart for Memory but resetTidalToIdle for Tidal (app.js:1240-1247). Tests: tests/e2e/phase3.test.js "a wrong check's pressure carries into the basin step" and "RESET SEQUENCE puts it back to the start".
- **Phase 3:** Kept.
