# Known issues

Every bug found in the eight old tools during planning, and what the rebuild will do about each one. CLAUDE.md's rule: **only fix a bug if it breaks the tool, loses saved data, or applies something twice.** Everything else stays exactly as it was, and is listed here for Harry to decide on later.

**Status: all nine phases are built: 1 (the shell), 2 (Clan Crest Creator), 3 (Pelagosi Puzzle Trials), 4 (Notice Board), 5 (The Heartwood Ritual), 6 (Arenas of The Scarlett Isles), 7 (Combat Tracker & VTT Battlemap), 8 (Scarlett Isles Explorer) and 9 (The Ironbow Bastion Manager).** The shell's share of the suite-wide (SUI) fixes is in place and tested, and each entry has a **Phase 1** line saying what's done. Every Clan Crest Creator entry has a **Phase 2** line, every Pelagosi entry a **Phase 3** line, every Notice Board entry a **Phase 4** line, every Heartwood Ritual entry a **Phase 5** line, every Arenas entry a **Phase 6** line, every Combat Tracker entry a **Phase 7** line, every Explorer entry a **Phase 8** line and every Bastion entry a **Phase 9** line, saying whether it was fixed, changed or kept. Each tool's session updates its own entries as it goes: it marks each one fixed, or confirms it was left alone, and adds anything new it finds.

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
| Suite-wide (SUI) | 10 | 11 | 14 | 1 | 0 |
| Combat Tracker & VTT Battlemap (ENC) | 13 | 0 | 0 | 15 | 0 |
| Notice Board Quest Generator (QST) | 7 | 5 | 1 | 11 | 2 |
| Scarlett Isles Explorer (EXP) | 12 | 5 | 15 | 13 | 0 |
| The Ironbow Bastion Manager (BAS) | 23 | 2 | 47 | 25 | 1 |
| Clan Crest Creator (CRS) | 0 | 4 | 6 | 3 | 3 |
| Arenas of The Scarlett Isles (ARN) | 8 | 2 | 0 | 17 | 0 |
| The Heartwood Ritual (RIT) | 9 | 1 | 0 | 15 | 1 |
| Pelagosi Puzzle Trials (PEL) | 11 | 1 | 0 | 6 | 0 |
| Strip Back Overhaul (BAS-SB), 80 entries, see the section at the end | counted in the entries | | | | |

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
- **2 October 2026:** The warning now only appears when the two tabs could really overwrite each other: both have the **same tool** open, or either is on the **home screen** (whose Restore and Back up everything cover every tool). Two different tools, such as the Bastion in one tab and the Clan Crest Creator in another (which the Bastion's new crest link opens), don't warn, because each tool only saves its own records. The warning names what the other tab has open, for example "The Ironbow Bastion Manager is also open in another tab or window…". Tested in `tests/e2e/phase1.test.js`.

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


### SUI-19 · Every copy of the suite on a computer shares one set of saves
**Later, Harry's call** · found while writing the how-to guide (not an old-tool bug: it's how Edge and Chrome treat double-clicked pages)

- **Before:** Edge keeps the saves of every double-clicked page together, whatever folder it's in. So a new version downloaded to test opens with the saves from the copy used at the table, and anything done while testing changes those same saves.
- **After:** Kept, and explained in the how-to guide ("Saving and backups") and the README: back up everything after each session and before trying a new version. The only way round it would be to tie saves to the folder's location, which would lose them whenever the folder is moved or renamed, so it isn't recommended.
- **Evidence:** a probe in the test browser (Chromium, the engine inside Edge), 28 September 2026: two copies of `index.html` in different folders read and wrote the same `tsi.` saves. `guide.html#saving`.

### SUI-20 · Open a tool in a new window
**Deliberate change** (Harry's request, 6 October 2026) · other

- **Before:** Switch tool always replaced the tool on screen, so only one tool could be open at a time unless Harry opened a second tab himself.
- **After:**
  - **The button:** inside a tool, every other tool in the Switch tool menu has a ↗ button that opens it in a separate Edge window, sized to the screen, so it can be dragged to the TV. The ↗ buttons can be reached with the arrow keys.
  - **Where it isn't:** there's no ↗ for the tool already open, for Home, or on the home screen's own menu. Each of those would set off the "Already open" warning, because the same tool, or the home screen, open twice could overwrite saves.
  - **Two tools, no warning:** two different tools in two windows don't warn, because each saves only its own data.
  - **For the events:** the Explorer's event window uses the same opener for **Set up this fight in the Combat Tracker ↗** (EXP-34).
- **Evidence:** `shared/js/shell.js` (`TSI.shell.openWindow`, the menu rows), `shared/components.css`; tests in `tests/e2e/phase1.test.js`.

### SUI-21 · The DM doc: a floating panel for the DM's eyes only
**Deliberate change** (Harry's request, 6 October 2026) · other

- **Before:** There was nowhere to keep campaign notes.
- **After:**
  - **The panel:** **DM doc** in the top bar, on every screen, opens a floating panel over the tool. Drag it by its title bar (or move it with the arrow keys), resize it from the bottom-right corner, and close it with ✕. The tool underneath keeps working.
  - **Remembered:** its place and size are saved under `tsi.dmdoc.` and included in Back up everything.
  - **Open or closed:** whether it's open is remembered per window, so it reopens after a tool switch in the same window but never pops up by itself in another window (such as one on the TV).
  - **On screen:** it's kept within the window on the laptop and the TV, and isn't shown inside a tool's own full-screen view.
  - **Contents:** a placeholder at first; since 7 October 2026 it shows where the campaign stands (SUI-22).
- **Evidence:** `shared/js/dmdoc.js`, `shared/js/dmdoc-rules.js`, `shared/js/store-rules.js`, `shared/js/backup-rules.js`, `shared/tokens.css`, `shared/components.css`; tests in `tests/rules/dmdoc.test.js` and `tests/e2e/phase1.test.js`.

### SUI-22 · The DM doc shows where the campaign stands
**Deliberate change** (Harry's request, 7 October 2026) · other

- **Before:** The DM doc was an empty panel, and nothing in the suite showed the Explorer's and the Bastion's numbers side by side.
- **After:** the DM doc reads the Explorer's and the Bastion's saves and shows, laid out in six tiles and four short sections:
  - **Party level:** the level set in the Bastion (7, the Bastion's starting level, until the Bastion has saved).
  - **Day:** the Explorer's day, and how many days have passed (Day 1 is 0 days passed).
  - **Bastion turns:** how many the Bastion has completed (its turn counter starts at 1, so one less than the turn it's on).
  - **Next Bastion turn:** how many days until the Explorer's weekly Bastion reminder, which comes at the Make Camp that starts Day 8, 15, 22 and so on.
  - **Heroes:** the names of the Explorer's hero tokens.
  - **Where the party is:** the Explorer's Region, its Clan and chief with the Clan's Political Capital (−100 to +100) and Honour/Respect (−5 to +5), and its god with that god's Favour (0–100%), all from the Bastion. Each is drawn as a bar as well as a number; a negative standing fills left of the centre, in crimson.
  - **Active effects:** each of the Explorer's Active Effects, with who has it, what it does, when it ends and which event gave it, worded exactly as the Explorer's own list. They appear and go when the Explorer adds and removes them: most end at Make Camp, and any you remove in the Explorer goes too.
  - **Party gold and Threads** (added the same day, at Harry's request): two more tiles, **Party gold** (the Explorer's event gold, the same number as its Gold: line, which can go below 0, and 0 once cleared) and **Threads** (how many are open, and the next follow-up due); and a **Threads** list under Active effects, worded as the Explorer's own list (the day, the event and any follow-up), plus what resolving each one gives (its gold and its note for the DM, as the Explorer's "are you sure?" says). A thread goes when it's resolved in the Explorer; a follow-up that didn't come stops counting as due, as in the Explorer.
- **How it stays up to date:** while it's open it reads both saves every 2 seconds, and straight away when the window comes back into view or this window saves, so a change made in another window (the Bastion on one screen, the Explorer on the other) shows by itself. When it's closed it reads nothing. It only reads: it never changes either tool's saves, so two windows can't save over each other through it.
- **One shared list of regions:** the seven regions' Clan, chief and god now live in one file, `shared/data/regions.js`, which the Explorer's events and the DM doc both read. The Explorer's wording of when an effect ends, when a thread's follow-up is due and what resolving a thread gives, and the days its Bastion reminder comes, moved to `shared/js/campaign-rules.js` so the DM doc and the Explorer can never disagree. Nothing the Explorer does changed.
- **Its first size:** 440 × 800 (680 before the gold and Threads), so everything shows on the laptop until the lists get long; then it scrolls. Once it has been moved or resized, it keeps that place and size, so a DM doc already dragged aside stays 680 tall until its corner is dragged down.
- **Evidence:** `shared/js/campaign-rules.js`, `shared/data/regions.js`, `shared/js/dmdoc.js`, `shared/js/dmdoc-rules.js` (first height 800), `shared/components.css`, `tools/explorer/journey.js`, `tools/explorer/rules.js`, `tools/explorer/data/journey-events.js`; tests in `tests/rules/campaign.test.js`, `tests/rules/dmdoc.test.js`, `tests/e2e/dmdoc.test.js` and `tests/e2e/phase1.test.js`.

### SUI-23 · The Explorer and the Bastion save as one campaign; the DM doc counts days, not Bastion turns
**Deliberate change** (Harry's answers, 8 October 2026; the Bastion's days overhaul, BAS-60) · other

- **Before:** The Explorer and the Bastion each exported and imported their own file. The DM doc showed "Bastion turns" (how many were done) and "Next Bastion turn" (days until the Explorer's weekly reminder).
- **After:**
  - **One campaign file:** Export in either tool (the top bar's Export, or the Explorer's Export Save) downloads one file, named `tsi-campaign-` and the date, holding both the Explorer and the Bastion. Import in either tool checks both halves, asks first (offering a copy of what's there now), and replaces both together; if either half is damaged, nothing changes. It won't run while the other tool is open in another window, because that window would save over what was imported.
  - **Older files:** an Explorer-only file from before imports into the Explorer alone, saying the Bastion is left as it is. A Bastion-only file from before is refused (BAS-61). Back up everything and Restore are unchanged.
  - **Behind the scenes** it's still two records, one per tool, so the Explorer on the laptop and the Bastion on the TV each write only their own half and can't overwrite each other.
  - **The DM doc:** the two turn tiles become **Orders pending** (how many, and the day the next completes) and **Next word from the Ironbow** (the next day the Bastion will have news, and what it will say). The rest of SUI-22 is unchanged.
- **Evidence:** `shared/js/backup-rules.js` (`CAMPAIGN`, `makeCampaignBackup`, `checkForTool`), `shared/js/backup.js`, `shared/js/store.js` (`replace` with `tools`), `shared/js/campaign-rules.js` (`bastionComing`, `ironbowNews`), `shared/js/dmdoc.js`; tests in `tests/rules/backup-rules.test.js`, `tests/rules/campaign.test.js`, `tests/e2e/dmdoc.test.js`, `tests/e2e/phase8.test.js` and `tests/e2e/bastion-days.test.js`.

### SUI-24 · Two saves set aside in the same second: the second replaced the first
**Must fix** (found while building the days overhaul, 8 October 2026; fixed) · loses saved data

- **Before:** A save that couldn't be read (or, now, a Bastion saved in turns) was set aside under a name made from the time to the second. A second save set aside within the same second got the same name and replaced the first, so the first was lost. It never reached Harry: it showed up in a test that sets aside two Bastions quickly.
- **After:** each copy set aside gets its own name (`…-2`, `…-3` and so on when the second is already taken), so every one is kept.
- **Evidence:** `shared/js/store.js` (`quarantine`); the check in `tests/e2e/phase9.test.js` ("a Bastion saved in Bastion turns is set aside").

### SUI-25 · One tooltip card for the whole suite
**Deliberate change** (the Bastion overhaul's Build 2, 8 October 2026) · other

- **Before:** Each tool drew its own tooltips; the Bastion's followed the mouse and could sit over what it described.
- **After:** `shared/js/tooltip.js` gives the suite one tooltip card: a dark card with a gold title line, the text, and a line at the foot (a cost, or how many days something takes). It shows on hover and on keyboard focus, sits beside what it describes (above it for things low on the screen) rather than over it, and shows above pop-ups, so it works inside panels. Esc hides a keyboard tooltip first; a second Esc then does what it usually does (closes a pop-up). The Bastion is the first tool to use it; the War Table keeps its own.
- **Evidence:** `shared/js/tooltip.js`, `shared/components.css` (`.tsi-tip`), `shared/tokens.css` (`--tsi-z-tooltip`, now above pop-ups); tests in `tests/e2e/bastion-screen.test.js` and `tests/e2e/phase9.test.js`.

### SUI-26 · The Crest Creator can pass a crest to the Bastion
**Deliberate change** (the Bastion overhaul's Build 3, 8 October 2026) · other

- **Before:** The suite's hand-off between tools (`TSI.handoff`) carried only the Explorer's fight to the Combat Tracker and its result back.
- **After:** It has a third kind, `crest`: the Crest Creator's "Use for the Bastion" writes a 512-pixel PNG of the crest and the Creator's design to the browser's small shared storage (`tsi.suite.handoff-crest`; the test page keeps its own, `tsi.test:handoff-crest`). A Bastion window hears it at once; a Bastion opened later reads it as it starts. Only the latest is kept, it isn't a save (so it's not in backups), and it's cleared once the Bastion has asked about it. Nothing goes online.
- **Evidence:** `shared/js/handoff.js`, `shared/js/store-rules.js` (`spaceNames`); tests in `tests/rules/store-rules.test.js`, `tests/e2e/phase2.test.js` and `tests/e2e/phase9.test.js`.

### SUI-27 · A window hidden for 5 minutes could stop counting as open
**Must fix** (found by the Build 3 review, 8 October 2026; fixed) · loses saved data

- **Before:** Each open window writes a heartbeat every 2 seconds, and another window counted it as open only if the last one was under 7 seconds old. After 5 minutes hidden (minimised, or covered by another window, such as the Crest Creator opened over the Bastion), Edge runs a window's timers only about once a minute, so the hidden window soon looked closed. The "Already open" warning could then miss a second copy of the same tool (which can overwrite the first one's saves), and the Crest Creator could offer to open a second Bastion.
- **After:** A hidden window says so in its heartbeat as soon as it's hidden, and counts as open for 90 seconds after its last one; shown again, it beats at once. A window that closes or reloads still says so at once and then stops beating (the browser reports it hidden just after it says it's going), so it never lingers and a reload keeps its id.
- **The cost:** a hidden window that crashes (rather than closing) counts as open for up to 90 seconds, not 7: a heartbeat can't tell a crashed window from a slowed one. Reloaded, it keeps its id, so it never warns about itself; and the campaign Import's "close it first" now adds "If you've only just closed it, wait a minute and try again."
- **Evidence:** `shared/js/tabguard.js` (`fresh`, `HIDDEN_STALE_MS`, the `visibilitychange` beat); tests in `tests/e2e/phase1.test.js` ("a hidden window's heartbeat counts for longer").

### SUI-28 · A pop-up whose first box was hidden left the focus behind it
**Must fix** (found by hands-on testing of Build 3, 8 October 2026; fixed) · other

- **Before:** A pop-up put the focus in its first box, even a hidden one, where it can't go: the focus then stayed behind the pop-up, on whatever opened it. The Bastion's Party Identity for a party that isn't a Clan was one (Clan Honour is hidden until there's a Clan). One Tab got into the pop-up.
- **After:** The focus goes to the first box that can be seen, else to the first button, as before.
- **Evidence:** `shared/js/modal.js` (`open`); tests in `tests/e2e/bastion-screen.test.js`.

### SUI-29 · The Bastion could take its own save for a Reset Travel and pass days twice
**Must fix** (found while fact-checking the Bastion and Explorer reference, 12 October 2026; fixed) · applies something twice

- **Before:** A tool reading another tool's save "as saved right now" (`TSI.store.fresh`) was given its own copy from when the page opened whenever it was writing *any* save of its own. The Bastion saves after almost every change, and it reads the Explorer's day every 2 seconds, so now and then the two met. It then saw the day it opened on (say Day 1, while the Explorer was on Day 7), took that for a Reset Travel, moved every day back, wrote "The Explorer's day went back (Reset Travel)…" in the Day Log, and passed the days again 2 seconds later. Orders, building, shipments and sea routes then fell due early by the size of that false step, and an automatic Bastion event in those days was rolled a second time. The Explorer's "The Ironbow sends word…" forecast and the DM doc read the same way, so they could show an old copy too.
- **After:** Only a change of that same save, still being written by this page (or made while it was being read), means the page's own copy is used (it's newer than the saved one). Any other save being written makes no difference. And if the browser ever can't be read, the value last read is used, not the one from when the page opened. What's read is kept apart from the page's own copies, so a "Back up everything" from the home screen still holds one moment's copies (an independent review found that letting reads replace them could pair the Explorer's newest save with an older uploaded map).
- **Evidence:** `shared/js/store.js` (`fresh`, `inflightKeys`, `lastRead`); the Bastion's clock is `checkClock` in `tools/bastion/tool.js`. Test: `tests/e2e/bastion-days.test.js` ("the Bastion saving a change of its own never makes it misread the Explorer's day"), which fails on the old code (the Bastion read Day 1 while on Day 7) and passes now.

### SUI-30 · The Explorer and the Bastion run in one window each
**Deliberate change** (the facilities overhaul, pull request 4: the formal acceptance test in `docs/FACILITIES-OVERHAUL-PLAN.md` section 0; 13 October 2026) · applies something twice

- **Before:** The same tool could run in two windows. The "Already open" warning said so, but both kept running and saving. Once the Explorer sends Honour/Respect changes to the Bastion (BAS-81), two Bastion windows could each apply one, or one could save over the other's receipt.
- **After:**
  - **One window each.** The Explorer and the Bastion (marked `single: true` in `shared/data/tools.js`) now each run in one window at a time, using the browser's own locks (Web Locks), which work from a double-clicked file. The first window to open the tool holds it until that page closes, reloads or switches tool. A second window (a second double-click, Switch tool's ↗, a duplicated tab) runs none of the tool: it says "… is open in another window", may sit behind the TV's window, and opens the tool by itself about a second after the first window lets go, from the newest save.
  - **No false warning.** A waiting window can't save, so neither it nor any other tab shows "Already open" about it. The warning still works for every other tool, and for the home screen.
  - **Import and Restore wait.** A campaign Import, and the home screen's Restore, are refused while the Explorer or the Bastion is open in another window, which would save over them ("Close it first"). They check again after you press Import or Restore, in case one opened meanwhile. A waiting window has no Export or Import of its own (its copy would be out of date).
  - **No gaps** (review fixes): a window asking for the tool, in the second its files take to load, neither shows nor sets off "Already open"; and a waiting window keeps the tool from the moment the first one lets go until it reloads, so nothing can slip in between.
- **Not checked here:**
  - **Firefox** isn't installed in the test sandbox. A browser without Web Locks works as before (both windows open, with the "Already open" warning).
  - Whether **Edge's sleeping tabs** keep the lock isn't verified. Chromium doesn't put a tab holding a lock to sleep, so a minimised Bastion should keep it. Harry's checklist tries it.
- **Evidence:** `shared/js/toollock.js`, `shared/js/shell.js` (`takeLock`, `showWaiting`, `openTool`), `shared/js/tabguard.js` (`markWaiting`), `shared/js/backup.js` (`openElsewhere`), `shared/js/store-rules.js` (`spaceNames().lock`: the test page has its own lock names); tests in `tests/rules/store-rules.test.js`, `tests/e2e/bridge.test.js`, `tests/e2e/phase1.test.js` and `tests/e2e/phase9.test.js`.

### SUI-31 · Back up everything and Restore from a home screen opened earlier missed newer saves
**Must fix** (found by the review of pull request 4, 13 October 2026; fixed) · loses saved data

- **Before:** A page keeps its own copy of the saves from when it opened. A home screen left open while you played in a tool window then backed up that old copy: "Back up everything", and Restore's "First, download a backup of what's saved now", missed everything saved since. Restore also thought "nothing is saved yet" if nothing had been when the home screen opened (so it offered no copy first), and cleared only the saves it knew about, so one made since could survive a Restore. Pull request 4 makes this flow likelier: Restore now asks you to close the Explorer and the Bastion first.
- **After:** Back up everything reads every save fresh from the browser, in one go, so the file holds one moment's copies, the newest. Restore and Import decide what's saved now from a fresh read, and clear every save in scope that the file doesn't hold, including ones made in other windows.
- **Evidence:** `shared/js/store.js` (`freshAll`, `replace`), `shared/js/backup.js` (`backupEverything`, `confirmRestore`, `confirmImport`); tests in `tests/e2e/bridge.test.js` ("Back up everything from a home screen opened earlier").

### SUI-32 · The Explorer link carries Port Charters, and waits for kinds of message it doesn't know
**Deliberate change** (the facilities overhaul, pull request 5; Harry's answers, 14 October 2026) · applies something twice

- **Before (pull request 4):** the link carried one kind of message, a change of 1 in a Clan's Honour/Respect. A message of any other kind was refused for good, with a receipt.
- **After:**
  - **A second kind: the Port Charter** the DM grants in the Explorer (EXP-39), with its port and that port's Clan. The Bastion holds it once, with its receipt in the same save (BAS-84). The ports are in one shared list, `shared/data/ports.js`, which the Explorer, the link and the Bastion all read.
  - **A kind this copy doesn't know** (say, from a newer copy of the suite) waits, with no receipt, instead of being refused for good, so it is never counted twice. The Explorer's Sent to the Bastion calls it "A change from a newer copy of the suite" and says it's waiting for a newer copy of the Bastion. When the Explorer saves, it keeps the message's plain fields (text, numbers, true/false and who sent it), but not lists or records inside it. A Bastion starting from nothing skips it like everything else sent before it started, and the Day Log says "a message from a newer copy of the suite" (not Honour/Respect). A damaged message is still refused.
  - **Unchanged:** Honour/Respect messages and their receipts are exactly as in pull request 4, byte for byte.
- **Older copies (SUI-19):** a pull request 4 copy opening these saves pays nothing and counts nothing twice, but (checked by the review, 14 October 2026):
  - it refuses a waiting Port Charter (grant it again from this copy);
  - it keeps the Bastion's Charters, ships at sea and sales as they are, without using them;
  - a **Register Port Charter order** falling due while it's open is dropped with no message: the Charter is still held, so issue the order again (it's free);
  - it strips the port from Charter messages and receipts: the Explorer's Sent list may then say "Unknown port". Clan Influence still names the port, from the Charter itself.

  Back up before trying another copy.
- **Evidence:** `shared/js/bridge-rules.js` (`charterMessage`, `check`, `clean`, `waitsForNewer`, `statusOf`, `portStatus`), `shared/data/ports.js`; tests in `tests/rules/commerce.test.js`.

### SUI-33 · The Explorer link's third kind: a parcel collected
**Deliberate change** (the facilities overhaul, pull request 6, the Courier Exchange; Harry's answers, 14 October 2026) · applies something twice

- **Before:** the link carried Honour/Respect changes and Port Charters, both from the Explorer to the Bastion. Nothing travelled the other way.
- **After:**
  - **Parcels go the other way without either tool writing the other's save.** The Bastion keeps its parcels in its own save; the Explorer reads them (it already read the Bastion's save every 2 seconds, and now does so even when it has sent nothing). When the DM collects a parcel, the Explorer puts the items in the Travel bags **and** adds a "parcel collected" message to its list, in one save. The Bastion reads that message, closes the parcel once and keeps a receipt in the same save.
  - **Once only, whatever is reloaded:** the message's id is fixed for each parcel (its id followed by `:collect:0`), so a second Collect (a double click, a reload, a second window, a replay) is refused, and the Bastion's receipt means it closes the parcel once.
  - **The Bastion's own record decides.** The message's town and Clan are only shown; a pickup is refused only if the Bastion has no record of that parcel, or it was recalled. A Bastion starting from nothing skips pickups sent before it started, with their own line in the Day Log.
  - The towns are in one shared list, `shared/data/courier-points.js`, which both tools read.
- **Older copies (SUI-19):** nothing is paid, sent or counted twice, but:
  - a pull request 5 copy of the Bastion keeps the parcels without settling them: they don't arrive or come home while it's open, and its Reset Travel doesn't move their days. It holds a pickup as "from a newer copy" and waits;
  - a pull request 4 copy refuses a pickup for good, so the parcel stays "waiting" in the Bastion while its items are in the Travel bags;
  - a pull request 5 copy of the Explorer keeps a pickup message but drops its list of goods (only the wording on screen changes).

  Back up before trying another copy.
- **Evidence:** `shared/js/bridge-rules.js` (`parcelMessage`, `collectId`, `parcelIdOf`, `check`, `clean`, `statusOf`, `parcels`, `parcelView`), `shared/data/courier-points.js`, `tools/bastion/rules.js` (`applyInbox`, `cleanBridge`); tests in `tests/rules/courier.test.js`.

### SUI-34 · The Explorer link's fourth kind: a creature the DM grants
**Deliberate change** (the facilities overhaul, pull request 7, the creatures; Harry's answers, 14 October 2026) · applies something twice

- **Before:** the link carried Honour/Respect changes, Port Charters and parcel pickups.
- **After:**
  - **A griffin or a dire wolf the DM grants** in the Explorer (EXP-42) travels to the Bastion as a new kind of message, with its kind and its name. The Bastion holds it once, waiting for a home, with its receipt in the same save (BAS-90). It needs no Clan.
  - A copy of either tool that doesn't know this kind waits for it, with no receipt, as before; a Bastion starting from nothing skips grants sent before it started, with their own line in the Day Log.
- **Older copies (SUI-19): back up before trying another copy.**
  - **A pull request 6 (or older) copy of the Bastion deletes the creatures** the next time it saves (the list of creatures is new, so it doesn't know to keep it), but keeps the grants' receipts, so they never come back: grant the griffins and dire wolves again, and give House Elara's Wyvern again. It also drops House orders and the Library's chart order when they fall due, making nothing.
  - A pull request 4 copy refuses creature grants for good.
  - A pull request 6 copy of the Explorer keeps creature grants as they are and waits.
- **Evidence:** `shared/js/bridge-rules.js` (`creatureMessage`, `check`, `clean`, `statusOf`, `creatureTitle`), `tools/bastion/rules.js` (`applyInbox`, `cleanBridge`, `cleanCreatures`); tests in `tests/rules/creatures.test.js`.


### SUI-35 · Every War Room regiment saved as its own record
**Deliberate change** (pull request 8a; Harry's War Room proposal, approved 15 October 2026) · loses saved data

- **Before:** identical regiments were saved together as one row with a count ("Line Infantry ×2"); only a depleted one had its own row.
- **After:**
  - On loading, each regiment becomes its own record, with an id, a number ("Line Infantry II"), an optional name, a grade (Regular, Trained, Veteran) and, if under strength, its Recouping.
  - Lieutenants stay a count, as Harry asked (W2).
  - Loading twice gives the same save, and nobody is lost.
  - A Military Action already under way from an older save still works: its regiments without an id take the first full ones of their kind.
- **Older copies (SUI-19): back up before trying another copy.** A pull request 7 (or older) copy of the Bastion reads the records as separate rows. It keeps every soldier, but it loses the grades, names and Recouping, and it drops drill and Muster orders when they fall due.
- **Evidence:** `tools/bastion/regiment-rules.js` (`cleanRegiments`), `tools/bastion/war-campaign-rules.js` (`cleanMilitary`, `regimentsOf`, `warForces`); tests in `tests/rules/bastion-campaign.test.js`.

### SUI-36 · The Explorer link's fifth kind: a Great Rite given to the party
**Deliberate change** (pull request 8b part 2; Harry's Shrine specification, 15 October 2026) · other

- **Before:** the link carried four kinds of change (standing, Port Charter, parcel collected, creature).
- **After:** a fifth, `rite`: the Explorer tells the Bastion that a waiting Great Rite went with the party.
  - Its id is fixed by the rite (`<rite id>:rite:0`), so it can only be sent, and applied, once.
  - The Bastion marks that Great Rite "assigned" and writes a receipt. A rite it doesn't hold is refused; a repeat changes nothing.
  - Loading twice gives the same save.
- **Older copies (SUI-19): back up before trying another copy.** An older Bastion waits for kinds it doesn't know and keeps them, but it drops `greatRites` from its save. An older Explorer drops Shrine items from the Travel bags and its expedition record.
- **Evidence:** `shared/js/bridge-rules.js` (`riteMessage`, `check`, `statusOf`), `tools/bastion/rules.js` (`assignGreatRite`, `applyInbox`); `tests/rules/shrines-explorer.test.js`.

## Combat Tracker & VTT Battlemap
Old repo: `_legacy/scarlettisles-encounter-tracker` (file:line references point there).

### ENC-01 · Complete Turn keeps going after an error
**Must fix** · applies something twice · listed in the handover

- **Before:** If you type damage plus a condition with Turns set to 0 or less, the damage is applied and you get 'Turns must be 1 or more'. The condition is skipped, but the turn still moves on. When you fix the number and press Complete Turn again, the turn moves on a second time, so the next creature loses its turn. A creature knocked to 0 HP this way is also not marked DEFEATED.
- **After (planned):** Check every input first. If anything is invalid, change nothing, show the message and don't advance. Keep this in the separated rules file.
- **Checker's note:** Nuance: the DEFEATED mark is applied on the retry if the same target is still selected. The 'Damage must be a number' branch cannot be reached in Chromium: bad text in the number box reads as empty and is silently ignored (t11).
- **Evidence:** app.js:309-312 returns before the defeated check at 327; app.js:914-942 carries on regardless. The damage-not-a-number branch (292-295) behaves the same but is rarely reachable. test2.js: Aria 30→25, turn went Aria→Goblin a; the retry went Goblin a→Borin; Goblin a at 0/7 with no DEFEATED.
- **Phase 7:** Fixed. Complete Turn and Add Condition check every box before anything changes. If one is wrong, the message shows, nothing changes (no damage, no condition, no turn) and what was typed stays in the boxes. Test.

### ENC-02 · Healed creatures stay DEFEATED and never get another turn
**Must fix** · breaks the tool · listed in the handover

- **Before:** Once anyone hits 0 HP they are marked DEFEATED. Healing them later raises their HP but they keep the DEFEATED badge and are skipped forever, and a healed monster stays off the map. You can't fix it mid-fight without pausing, removing and re-adding them, which loses their place.
- **After (planned):** Clear the defeated mark when healing takes HP above 0. The exact policy, including PCs at 0 HP, needs Harry's answer.
- **Decision note:** C2 sets the exact rule (default: clear DEFEATED when healed above 0; PCs at 0 still skipped).
- **Checker's note:** Needs Harry's policy on when the mark clears, and whether PCs at 0 HP get turns for death saves.
- **Evidence:** app.js:327 sets defeated; nothing clears it. app.js:232 skips defeated; vtt.js:652 hides defeated monsters. test2.js: Borin 0→10 HP still [DEF]; the next 6 turns went Goblin→Aria→Goblin→Aria→Goblin→Aria.
- **Phase 7:** Fixed as Harry chose (C2). Healing a creature above 0 HP clears DEFEATED, so it gets its turns back, and a healed monster comes back onto the Battlemap. PCs at 0 HP are still skipped. Tests.

### ENC-03 · Tokens slide off their map squares when you zoom, resize or go fullscreen
**Must fix** · breaks the tool

- **Before:** Token positions are stored relative to the window, not the map picture. Zooming makes every token land on a different part of the map. Resizing the window or going fullscreen shifts them too, for example after placing tokens and then putting the window fullscreen on the TV. Revealed fog follows the same wrong positions.
- **After (planned):** Store token and fog positions in map-picture coordinates that don't change with zoom or window size. The handover's acceptance check requires alignment after resize, fullscreen, zoom and reload.
- **Checker's note:** Ctrl+wheel zoom hides the problem until the next redraw, then tokens jump (t3). The handover's acceptance check requires alignment.
- **Evidence:** vtt.js:476-493 divides by zoom; vtt.css:74-82 fits the map picture separately. test4.js: token at (0.839, 0.801) of the map moved to (0.805, 0.801) at 1100px wide, (0.934, 0.813) at 1500x700, (0.800, 0.788) fullscreen, and (0.567, 0.565) at zoom 1.45. Snap also uses the on-screen token size (vtt.js:851), so it lands off-grid while zoomed.
- **Phase 7:** Fixed. Everything on the Battlemap (tokens, the grid, fog squares and the ruler) is measured on the map picture instead of the window. A token stays on the same spot of the map when the window is resized, zoomed, made fullscreen or moved to the TV, and after reopening. The grid, fog and ruler are redrawn sharply when the window changes screen. Tests at several window sizes and zooms; moving between Harry's two screens is on his checklist.

### ENC-04 · Maps near 4 MB silently fail to save or show
**Must fix** · breaks the tool

- **Before:** The limit says about 4 MB, but maps from roughly 3.8 MB upwards don't fit in the browser's small storage. Nothing appears and there is no message.
- **After (planned):** Store the map picture in IndexedDB (tested from file://) and show a clear message if saving ever fails.
- **Decision note:** C9. Map pictures move to the browser's built-in database.
- **Checker's note:** The real ceiling is about 3.93 MB with otherwise empty storage. After a failure, the file picker keeps the same file, so choosing it again does nothing.
- **Evidence:** vtt.js:519-535 and 150 (no try/catch). test3.js: a 4,072,528-byte PNG gave pageerror 'Setting the value of encounterTracker.vtt.mapImage exceeded the quota'; the map was not stored or shown. Storage limit measured at 5,242,880 characters, shared by all file:// pages.
- **Phase 7:** Fixed. The map picture is saved in the browser's database, so maps up to the old 4 MB limit are kept (a 3.95 MB map in the test). Over 4 MB, the old message still shows. Tests.

### ENC-05 · When browser storage is full, changes silently don't save
**Must fix** · loses saved data

- **Before:** If the shared browser storage is nearly full (a big map could do it, and in the suite all eight tools share it), adding or changing anything fails with no message. The change is lost on reload.
- **After (planned):** The shared save system catches failures and warns. Big items go to IndexedDB.
- **Checker's note:** A 3.6 MB map alone leaves only about 435K characters for every file:// page, so all eight suite tools would share what is left.
- **Evidence:** app.js:127-133 and vtt.js:227-229 have no try/catch. test7.js: with storage nearly full, Add to Library threw 'exceeded the quota'; the entry was not shown and was gone after reload.
- **Phase 7:** Fixed by the suite's saving: a failed save shows "Not saved" and a warning, and nothing on screen is lost. Test with a storage that pretends to be full.

### ENC-06 · Two tracker windows overwrite each other's saves
**Must fix** · loses saved data

- **Before:** The battlemap window has a 'Back to Tracker' link that opens a second tracker inside it. With two trackers open, whichever saves last wipes out what the other added.
- **After (planned):** Remove the link from the map window. In the suite, have one saver per tool and warn if the suite is open twice.
- **Checker's note:** Clicking Battlemap in the popup's tracker then turns the popup back into vtt.html, because it is the named window.
- **Evidence:** vtt.html:22. app.js saves its whole in-memory copy (127-133) and never listens for changes. test5.js: one entry added in each window; only 'FromWindowB' survived.
- **Phase 7:** Fixed. The Battlemap window has no "Back to Tracker" link, and a second click on Battlemap brings the same window forward. All saving happens on the desk. Tests.

### ENC-07 · A bad import file breaks the whole tracker until Reset
**Must fix** · breaks the tool

- **Before:** Importing a JSON file with a combatant that has no name is accepted and saved. The tracker then shows nothing, even after reloading, until you press Reset and lose everything.
- **After (planned):** Check each imported entry and skip or reject bad ones with a message.
- **Checker's note:** The 'Campaign imported.' alert at 1029 never appears because render throws first. A nameless entry only crashes when another entry of the same type exists (comparator 426).
- **Evidence:** app.js:1003-1025 accepts entries without a name; app.js:426 a.name.localeCompare throws. test2.js: pageerror 'Cannot read properties of undefined (reading 'localeCompare')'; library and board empty after reload.
- **Phase 7:** Fixed. A campaign file's entries with no name or type are skipped, and the message says how many. A save or backup holding a nameless combatant is refused or set aside. Tests.

### ENC-08 · A damaged save is silently deleted
**Must fix** · loses saved data

- **Before:** If the saved data is ever damaged, the tracker quietly deletes all of it and starts empty. The battlemap likewise resets and overwrites its settings.
- **After (planned):** Keep a copy of an unreadable save and tell the user, rather than deleting it.
- **Checker's note:** The old tool itself never writes bad JSON, so the trigger is outside it (hand edits, another page writing the key). It is still worth guarding in the shared save layer.
- **Evidence:** app.js:96-99; vtt.js:220-222. test7.js: a corrupted save left the key deleted (null).
- **Phase 7:** Fixed by the suite's saving: a save that can't be read is set aside and kept, never deleted. Test.

### ENC-09 · PDF import needs the internet
**Must fix** · won't work double-clicked / offline

- **Before:** The PDF reader is fetched from the web, so without Wi-Fi 'Import PDF' just says 'pdf.js failed to load.'
- **After (planned):** Bundle PDF.js 3.11.174 locally with its licence.
- **Checker's note:** The name guess picks up the next capitalised word, as the survey says.
- **Evidence:** index.html:264-270; test2.js alert. test_pdf.js: with PDF.js bundled locally it works from a double-clicked file ('Imported: Goblin Boss Small (HP 21)').
- **Phase 7:** Fixed. PDF.js 3.11.174 is in the suite folder (`shared/lib/pdfjs/`) and loads only when a PDF is imported. Test: "Imported: Goblin Boss Small (HP 21)" with the internet off.

### ENC-10 · Fancy heading fonts need the internet
**Must fix** · won't work double-clicked / offline

- **Before:** The Cinzel fonts come from Google, so offline the headings and buttons fall back to a plain serif.
- **After (planned):** Bundle the fonts in the shared design tokens.
- **Evidence:** styles.css:7; test1.js request failed; computed font falls back to Georgia.
- **Phase 7:** Fixed. The fonts come from the suite folder. Test.

### ENC-11 · Offline cache and install button don't work from a file
**Must fix** · won't work double-clicked / offline

- **Before:** The 'install as app' and offline cache only worked on the website. From a file they just log an error.
- **After (planned):** Remove them. They aren't needed from a local folder.
- **Checker's note:** Not really a blocker: it only logs a warning. It is simply removed.
- **Evidence:** app.js:1090-1114; sw.js; test1.js warning 'The URL protocol of the current origin ('null') is not supported'.
- **Phase 7:** Fixed. The install button, offline cache and web manifest aren't carried across.

### ENC-12 · 'Monsters: Above fog' does nothing
**Must fix** · breaks the tool

- **Before:** The battlemap has a button to show monsters on top of the fog of war. Pressing it changes the label, but the monsters stay hidden under the fog exactly as before.
- **After (planned):** In the rebuild, put above-fog monster tokens in a layer above the fog canvas. This is a feature the handover requires; if Harry prefers a strict rebuild, record it as 'other'.
- **Evidence:** vtt.js:664-667 gives monster tokens z-index 30, but they sit inside #tokenLayer (z-index 10, a stacking context: a layer its contents cannot rise above; vtt.css:92-96), and the fog canvas at z-index 20 is its sibling (vtt.css:98-103, vtt.js:345). t6.js pixel at the goblin: [14,4,5] with Under and [14,4,5] with Above, against [141,49,56] with the fog revealed. shots/t6_monsters_above_fog.png
- **Phase 7:** Fixed. With "Monsters: Above fog", monster tokens are drawn in a layer above the fog. Test.

### ENC-13 · Double-clicking action buttons does the action twice
**Must fix** · applies something twice

- **Before:** A quick double-click on Complete Turn moves on two turns, so a creature silently loses its go. Double-clicking Add Selected adds everyone twice (including a second copy of each PC), and double-clicking Save Current Encounter saves two templates.
- **After (planned):** Ignore a second click that arrives within a moment of the first on these action buttons. This changes no rules. It is user-triggered, so confirm with Harry that he counts it as a bug.
- **Evidence:** No guard in app.js:914-942, 788-829 or 944-973. t1.js B: dblclick went from Borin's turn to Goblin a in round 2, skipping Aria. t10.js: roster [Aria, Goblin, Aria a, Goblin a]; 2 templates saved ('Encounter 1', 'Encounter 2')
- **Phase 7:** Fixed. Complete Turn, Add Selected and Save Current Encounter count a double click once. Tests.

### ENC-14 · Resuming after Pause restarts the fight at round 1
**Later, Harry's call** · other · listed in the handover

- **Before:** The screen says 'Paused. Resume by pressing Begin.' Pressing Begin actually re-sorts everyone, goes back to round 1 and jumps to the top of the order, so you lose your place.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C3
- **Checker's note:** The handover also says not to present this as a true resume. It could be argued to lose saved data (the round and turn position), so it's Harry's call: change the wording or preserve round and turn.
- **Evidence:** app.js:869-891 and 347. test2.js: round 5 on Goblin's turn became round 1 on Aria's turn.
- **Phase 7:** Kept (C3), with the wording fixed: Paused now says "Pressing Begin starts again from round 1, in initiative order." Test.

### ENC-15 · LOS cone overlays do nothing
**Later, Harry's call** · other

- **Before:** Clicking 'Add LOS Cone' makes nothing appear and saves nothing. A cone that somehow exists can't be moved or cleared.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C6 (fix it or leave it out; no default). Added minutes before the last commit, so an unfinished extension.
- **Checker's note:** This was an unfinished extension added minutes before the snapshot (a674db3, cee8e6a on 2026-02-24). Handover s.2 says keep incomplete extensions out of scope. Ask Harry to drop it or finish it; it is not a core break.
- **Evidence:** vtt.js:61-66 edits a fresh copy read from storage; vtt.js:227-229 saveVttState() ignores what it is given and saves the in-memory state instead; vtt.js:571-577 re-reads storage. test3.js: 0 cones in page and storage after Add; an injected cone didn't move, and 'Clear overlays' left it in place.
- **Phase 7:** Left out, as Harry chose (C6): the Add LOS Cone, Remove overlay and Clear overlays buttons are gone.

### ENC-16 · Removed map tokens can't be brought back
**Later, Harry's call** · other

- **Before:** Shift+clicking a token removes it from the map, for example for a monster that flees. There is no button to put it back for that encounter.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C7
- **Evidence:** vtt.js:796-802; 'removed' is never cleared anywhere. test3.js: Orc removed; no restore control.
- **Phase 7:** Kept (C7). Test.

### ENC-17 · Single-token hiding is half-removed
**Later, Harry's call** · other

- **Before:** The map still checks for individually hidden tokens, but no button sets them any more. Only 'hide all monsters' works.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C8
- **Evidence:** vtt.js:674 reads vttState.hidden; nothing writes it except Reveal clearing it (app.js:141, 182). Setter removed in the January 2026 history.
- **Phase 7:** Kept (C8).

### ENC-18 · Hide/Reveal Monsters buttons are wired twice
**Later, Harry's call** · other

- **Before:** Each click saves twice and refreshes the map twice. It is harmless because the result is the same.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Harmless because the result is the same.
- **Evidence:** app.js:136-142 and 177-183
- **Phase 7:** No longer happens: each button is wired once. Nothing looks any different.

### ENC-19 · Map's 'Hide monsters' label goes out of step
**Later, Harry's call** · other

- **Before:** After hiding monsters from the tracker, the map's own button still says 'Hide monsters'.
- **After:** Kept as it is in the rebuild.
- **Evidence:** vtt.js:1359-1368 does not update the label (only 1190-1197, 1481-1483 do). test3.js.
- **Phase 7:** Kept. Test.

### ENC-20 · Fullscreen side buttons don't work while the ruler is on
**Later, Harry's call** · other

- **Before:** In fullscreen with the ruler switched on, clicking Grid and other side buttons starts a measurement instead.
- **After:** Kept as it is in the rebuild.
- **Evidence:** vtt.js:917-929 ignores only #btnMeasure. test6.js: fsBtnGrid click with the ruler on made no change.
- **Phase 7:** Kept.

### ENC-21 · Space bar blocked on map buttons and can get stuck
**Later, Harry's call** · other

- **Before:** Space can't press a focused button on the map window, and if the window loses focus while Space is held, clicks keep panning. If this code shared a page with text boxes, you couldn't type spaces.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** The stuck-after-losing-focus part is from reading the code (no blur reset), not tested.
- **Evidence:** vtt.js:906-915. test3.js: Space on a focused Grid button did nothing, Enter worked.
- **Phase 7:** Kept on the Battlemap. Space still doesn't press a focused Battlemap button. The desk has no Space shortcut, so typing spaces in its boxes works. Test.

### ENC-22 · Explored fog squares ignore the grid nudge and change with grid size
**Later, Harry's call** · other

- **Before:** Revealed squares don't line up with a nudged grid, and changing the grid size moves the revealed areas.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** From reading the code, not run.
- **Evidence:** vtt.js:407-411 draws cells without offX/offY; cells are stored as grid numbers (vtt.js:772-778).
- **Phase 7:** Kept.

### ENC-23 · Editing a combatant whose name ends in a single letter mangles copies
**Later, Harry's call** · other

- **Before:** Renaming 'Captain K' to 'Captain J' would make the encounter copy 'Captain J K', because the tool thinks ' K' is a copy letter. Copy letters after 'z' become symbols, and removing then re-adding copies can repeat a name. Found by reading the code, not tested.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Now tested, not only read. The suffix-after-z and repeat-after-remove parts are from reading the code (801-803).
- **Evidence:** app.js:749-752, 801-803
- **Phase 7:** Kept. Rules test.

### ENC-24 · Reset doesn't clear the battlemap
**Later, Harry's call** · other

- **Before:** The Reset button wipes the library and encounter but leaves the map picture and battlemap settings.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C10
- **Evidence:** app.js:1084-1088; test2.js: the mapImage key remained after Reset.
- **Phase 7:** Kept (C10). Test: Reset clears the library and encounter and keeps the map.

### ENC-25 · Fog doesn't lift when you drag a PC until you click somewhere else
**Later, Harry's call** · other

- **Before:** When you drag a player's token into a dark area, the darkness doesn't clear around them. It only updates after you click empty map or press a fog button, so the players watching can be left looking at a dark map.
- **After:** Kept as it is in the rebuild.
- **Decision note:** C11 (default: clear the fog when you let go of a token)
- **Evidence:** vtt.js:842-891 (drag move and release) saves positions and explored cells but never calls drawFog. t3.js: drawFog count unchanged through drag and drop; fog alpha 230 at the dropped PC, 2 after a click on empty map
- **Phase 7:** Fixed as Harry chose (C11). The fog clears around a player's token as soon as it's let go. Test.

### ENC-26 · Adding combatants mid-fight stops the fight and resets it to round 1
**Later, Harry's call** · other

- **Before:** If you add reinforcements with Add Selected during a running fight, the fight drops back to 'Ready', the round goes back to 1, Complete Turn greys out, and pressing Begin restarts from the top of the order. You lose your place in the fight.
- **After:** Fixed (19 October 2026, Harry's request, M6). While a fight is running or paused, Add Selected leaves the fight running with the same round, turn and order. New arrivals wait at the end of the list, skipped, until they have an initiative: type one in their row and press Enter, or press **Roll for new arrivals** (d20 plus bonus, for the arrivals only). Each is slotted in after anyone with the same number, and the turn marker stays on whoever is acting. Before a fight starts, Add Selected still goes back to Ready as before (C4 kept for that case).
- **Decision note:** C4
- **Evidence:** app.js:788-829 always sets status 'ready', turnIndex 0 and round 1, and nothing disables Add Selected while running (352-358). t1.js C: 'running round=2 turn=Goblin a' became 'ready round=1 turn=Aria'; Complete Turn disabled; after Begin, round 1 and Aria's turn
- **Phase 7:** Kept (C4); changed 19 October 2026 for a fight in progress (tests: `tests/rules/encounter.test.js`, `tests/e2e/reinforcements.test.js`).

### ENC-27 · Tokens with long names snap and reveal fog off-centre
**Later, Harry's call** · other

- **Before:** When a character's name label is wider than their token picture, snapping puts the picture beside the grid corner instead of on it, and the fog circle is centred to one side of the token.
- **After:** Kept as it is in the rebuild.
- **Evidence:** vtt.js:862-869 (snap) and 428-434 (fog circle) assume the picture's centre is at left + picture width/2, but the token box is as wide as its label (vtt.css:106-113). t6.js: 'Lady Seraphine of the Crimson Vale' ended 16.4px off the intersection (token box 228.8px wide, picture 56px); a short name ('Aria') was exactly on it
- **Phase 7:** Fixed as a side effect of ENC-03. Tokens are now placed by their picture's centre, so a long name no longer pulls snapping or the fog circle off-centre.

### ENC-28 · Mistyped damage is silently ignored while the turn still moves on
**Later, Harry's call** · other

- **Before:** If you mistype the damage (for example '5-'), the tool treats it as no damage, gives no warning, and still ends the turn.
- **After:** Kept as it is in the rebuild.
- **Decision note:** May be covered by the Complete Turn "check every input first" fix.
- **Evidence:** The damage box is type=number (index.html:232), so Chromium reports '' for bad text and app.js:290 skips it. t11.js: typing '5-' gave value '' and the turn advanced Aria→Goblin with no damage and no dialog
- **Phase 7:** Fixed by the ENC-01 check. Damage the browser can't read as a number shows "Damage must be a number." and changes nothing. Test.


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
- **Phase 8:** Fixed. Make Camp's pop-ups now wait their turn: the campfire event (or a due main event), then any weather, then the Bastion prompt (E4), one after another. Each outcome applies only when its own button is pressed. Tests, including day 8 with weather, and a side-by-side run with the old tool.

### EXP-02 · Enter or Space repeats Make Camp behind the pop-up
**Must fix** · applies something twice

- **Before:** After clicking Make Camp the keyboard focus stays on that button behind the pop-up. Pressing Enter or Space (a natural way to 'continue') makes camp again, skipping days, resetting miles and replacing the event.
- **After (planned):** The shared modal moves focus into the pop-up and blocks the page behind it until it closes.
- **Checker's note:** The shared modal should move focus into the pop-up and trap it there.
- **Evidence:** misc_test.js: activeElement = explorerMakeCamp; day 2, then after Enter and Space, day 4.
- **Phase 8:** Fixed by the suite's pop-ups: the keyboard focus moves into the pop-up and the page behind can't be reached, and Make Camp ignores a second press within a moment. Test: Enter and Space after Make Camp leave the day as it was.

### EXP-03 · Heroes' miles forgotten after a reload
**Must fix** · loses saved data

- **Before:** Each hero's miles for the day are saved, but when the page is reopened they are all set back to 0/30, and the next save overwrites the real numbers. The party can then walk more than 30 miles in a day.
- **After (planned):** Restore milesUsed when loading, and when importing old saves.
- **Checker's note:** Import is affected in the same way, because it also goes through this load path after its reload (1329-1333).
- **Evidence:** app.js:1213-1225 merges x, y, size, groupId and axial but not milesUsed. flow_test: pills K12/U6/M6 before reload, all 0 after; the next save wrote 0s.
- **Phase 8:** Fixed. Each hero's miles are saved and come back when the Explorer reopens or a backup is imported. Tests.

### EXP-04 · With Snap on, changing map leaves the party drawn in the old spot
**Must fix** · breaks the tool

- **Before:** Moving to a connected map is meant to place the party at that map's entry point. With Snap on, the tokens stay where they were on screen while the tool thinks they are at the entry point, so fog opens in one place and the tokens sit in another, and the next drag jumps.
- **After (planned):** After a spawn, recalculate each token's hex from its new position.
- **Checker's note:** Borderline breaks_tool. It is the same root cause as the new 'Snap on + fullscreen/resize mis-charges miles' bug, so fix them together.
- **Evidence:** applyPartySpawnWithFormation (app.js:152-169) changes x/y but keeps the old t.axial, and renderTokens draws from axial when snap is on (1855-1906). transition_test.js snap_true: kaelen saved x 0.688, drawn x 0.119.
- **Phase 8:** Fixed. A hero's hex is always worked out from where the hero is, never kept separately, so after arriving on a linked map with Snap on the heroes are drawn exactly where the tool thinks they are. Tests.

### EXP-05 · Uploading a large map stops all saving
**Must fix** · loses saved data

- **Before:** A map picture just under the 4 MB limit is too big for the browser's save space once converted. The tool errors, the map does not appear, and nothing done after that is saved until the page is reopened. In the suite all eight tools share that space.
- **After (planned):** Keep the uploaded picture in IndexedDB (tsi.explorer.uploadedMap), wrap every save in try/catch and show a plain 'couldn't save' warning.
- **Checker's note:** The numbers need correcting: the quota is about 5.24M characters, and a 3.9 MB file fits when the Explorer is alone (see corrections).
- **Evidence:** 4 MB checked on file size (app.js:2120), but base64 is about 1.33x. explorerSave (441-443) has no try/catch. env_test: a 4.1 MB file gave an uncaught QuotaExceededError, the map was not shown, the Hex Grid button stopped responding and nothing saved. Chromium file:// budget is about 4.98M characters, shared by all file:// pages.
- **Phase 8:** Fixed. An uploaded map is kept separately in the browser's database, so it can't crowd out the journey, and a failed save shows a warning with nothing on screen lost. The old 4 MB limit and its message are kept. Tests, including a storage that pretends to be full.

### EXP-06 · Pictures, videos and data paths assume the old website address
**Must fix** · won't work double-clicked / offline

- **Before:** The tool works out file locations as if it were on the old GitHub website. Opened from a folder, it looks in the wrong place, so no maps, pins, main-event pictures or weather videos appear.
- **After (planned):** Use plain relative paths.
- **Checker's note:** logo.png (536) and hero.png (CSS) use plain relative paths and do load.
- **Evidence:** app.js:6-20 withBase. file:// test: file:///home/assets/maps/the_north_isle.jpg ERR_FILE_NOT_FOUND.
- **Phase 8:** Fixed. Plain relative paths. Test: all 10 maps, 15 town maps and 11 main-event pictures load from a double-clicked file with the internet off.

### EXP-07 · Events and pins are downloaded in a way browsers block from a file
**Must fix** · won't work double-clicked / offline

- **Before:** Opened by double-click, the travel and campfire events and the location pins never load, so Make Camp and travel show nothing.
- **After (planned):** Turn the JSON files into script data files loaded with <script>.
- **Evidence:** app.js:188, 269 fetch(); console 'URL scheme "file" is not supported'.
- **Phase 8:** Fixed. The events, pins and the rest are script data files in `tools/explorer/data/`. The events file is word for word (279 travel and 322 campfire events). Tests.

### EXP-08 · Fonts need the internet
**Must fix** · won't work double-clicked / offline

- **Before:** Without Wi-Fi the special fantasy fonts don't load and the tool falls back to a plain font.
- **After (planned):** Bundle the fonts locally.
- **Evidence:** index.html:8-10; ERR_CERT_AUTHORITY_INVALID; document.fonts empty.
- **Phase 8:** Fixed. The fonts come from the suite folder, including IM Fell English SC for the Explorer's buttons. Test.

### EXP-09 · Import replaces the journey without asking
**Must fix** · other

- **Before:** Choosing a backup file instantly overwrites the current journey and reloads, with no 'are you sure?'.
- **After (planned):** Required by the suite rules anyway: ask first, then load in place without reloading.
- **Decision note:** CLAUDE.md: safe imports always ask first.
- **Checker's note:** The suite rules require a confirm anyway. See the new bug: a malformed but shape-passing file permanently breaks the tool.
- **Evidence:** app.js:1315-1334; flow_test: 0 dialogs, day jumped to 42.
- **Phase 8:** Fixed. Import (the Explorer's Import Save, or the top bar's Import) shows what's in the file and asks first, offering to download the current journey; Cancel changes nothing. The page then reloads with the imported journey. Tests.

### EXP-10 · Map pins, grid, fog and tokens shift with window size
**Must fix** · other

- **Before:** Everything on the map is placed relative to the box around the map, not the map picture itself. On a smaller or wider screen, pins drift away from their towns and a 6-mile hex covers a different amount of land.
- **After (planned):** Harry's call. Keep as is unless he wants everything pinned to the picture (would need a one-off conversion of positions).
- **Decision note:** Moved from later because the Explorer must work on both the 16:10 laptop and the 16:9 TV (answer 4). Positions tie to the map picture; the 33 marker positions are converted once and Harry checks them (E16).
- **Checker's note:** In fullscreen the pins sit in the same place on any 16:9 screen. The drift shows up in windowed mode and between windowed and fullscreen.
- **Evidence:** aspect_test.js: Coldpass pin at 0.718 of map width (1400x1100) vs 0.832 (1280x720); hexes across the map 16.1 vs 10.5.
- **Phase 8:** Fixed. Pins, the hex grid, fog and heroes are placed on the map picture, so they stay put at any window size, in full screen and on the TV. The hex size is now in map units: 38 is 38 screen pixels when a map fills the TV in full screen, as before, and it scales with the map everywhere else. The 33 pins and 17 entry points were converted once. Checking them against the towns drawn on the maps showed they were placed in the Explorer's **full-screen** view on the laptop (1707 × 1067), not a maximised window as E16 assumed, so that's how they were converted. Port Brawdlyn and Fork Farm (both hidden) fit the windowed view better, so those two were converted that way. The old numbers are kept beside the new ones in `tools/explorer/data/explorer-data.js`. `tests/pin-check.html` shows all 33 for Harry's check (E16). Tests at the laptop (window and full screen), the TV (window and full screen) and a small window: nothing moved. A side effect: heroes stay on the map picture itself, so they can't be parked in the dark bands beside a 4:3 map.

### EXP-11 · With Snap on, going fullscreen (or any window resize) makes moves cost the wrong miles
**Must fix** · breaks the tool

- **Before:** If Snap is on and the map area changes size, for example when Harry presses Fullscreen for the TV, the heroes are still drawn where they were, but the tool now thinks they are somewhere else. The next time a hero is dragged one hex, the tool charges for the distance from that invisible spot. In the test, a one-hex move cost 18 miles instead of 6, and the same happens after reopening the browser at a different window size.
- **After (planned):** When Snap is on, work out each hero's hex from the saved position (after any resize, fullscreen change, load or map change, or on every draw). The same change fixes the map-transition bug.
- **Evidence:** t_snap_fs2.js at 1366x768, then fullscreen 1368x770. Snap on: drawn top-left [735,377] vs saved position [837,524] px; a visible one-hex drag took Kaelen from 6 to 24 miles. Snap off: drawn [867,504] and saved [868,505] agree; the same drag went from 6 to 12. Code: renderTokens draws from pixel-based t.axial (1855-1906), while drag start and cost use x/y (2597-2615, 2762-2768). The resize handler (2245-2247) never re-syncs, and load restores the old axial (1222-1224).
- **Phase 8:** Fixed with EXP-04 and EXP-10. Test: with Snap on, a one-hex drag in full screen costs 6 miles.

### EXP-12 · A slightly wrong backup file can lock up the Explorer for good
**Must fix** · breaks the tool

- **Before:** Import only checks that the file has 'grid', 'tokens' and 'travel'. A hand-edited or damaged backup that passes that check but has an empty entry in the heroes list is saved, and after that the Explorer crashes every time it opens. No buttons work until the browser's stored data is cleared. From a double-clicked file, clearing that data would also wipe every other tool's saves.
- **After (planned):** The suite's safe import must check every hero entry (and the other fields) before replacing anything. Loading must survive a bad save by falling back to defaults and keeping a copy of the bad data.
- **Evidence:** t_import.js with bad_save.json {"grid":{},"tokens":[null],"travel":{}}: 0 dialogs, reload, pageerror "Cannot read properties of null (reading 'id')", Hex Grid button dead. After a second reload: 2 page errors and the bad save still stored. Code: looksLikeExplorerSave 1289-1296, explorerSave(obj) at 1329, crash at 1212.
- **Phase 8:** Fixed. Every hero entry and the other parts of a file are checked before anything is replaced: a damaged file is refused with a message and nothing changes. A damaged save is set aside (kept, never deleted) and the Explorer starts fresh. Tests.

### EXP-13 · H key hides the controls everywhere
**Fixed by the new design** · other

- **Before:** Pressing H anywhere toggles Hide UI. Outside fullscreen it only changes the button label, and in the suite it could fire while another tool is open.
- **After (planned):** Scope to the Explorer while it's open, and ignore when typing.
- **Decision note:** Shortcuts only work in their own tool and never while typing.
- **Checker's note:** The uiHidden class also stays set after leaving fullscreen, so the button still reads 'Show UI'.
- **Evidence:** app.js:2236-2241 window keydown.
- **Phase 8:** Fixed by the new design. H works only while the Explorer is open, never while typing or while a pop-up is open, and not with Ctrl or Alt held (so Ctrl + H still opens Edge's history). Hide UI now also works outside full screen, where the old button changed its label but did nothing. Tests.

### EXP-14 · Double-clicking Make Camp makes the night's event vanish
**Fixed by the new design** · other

- **Before:** The first click opens the campfire event. The second click lands on the dark background behind the pop-up, and clicking that background closes the pop-up, so the event disappears before anyone reads it. The day only advances once.
- **After (planned):** In the shared modal, don't close event pop-ups on a backdrop click (or ignore clicks for a moment after opening). Harry's call.
- **Decision note:** The shared pop-up takes focus and can't be clicked through by accident.
- **Evidence:** t_camp.js: dblclick on Make Camp took the saved day from 4 to 5 and left the pop-up closed. Code: backdrop click closes the modal (1166). The Make Camp button sits under the full-screen backdrop (styles.css .evModal_backdrop inset:0).
- **Phase 8:** Fixed by the new design. The shared pop-up ignores clicks outside it, and Make Camp ignores a second click within a moment. Test: a double click camps once and the event stays up.

### EXP-15 · Browser pop-up messages throw the TV view out of fullscreen
**Fixed by the new design** · other

- **Before:** The Explorer uses the browser's own small message boxes (such as 'Enter a valid roll number', 'Select 2+ tokens first', the Pick Marker XY copy box and the reset confirmations). When one appears in fullscreen, the browser leaves fullscreen, so the players' view drops back to the normal window.
- **After (planned):** Using the suite's own in-page messages and confirm boxes, inside the Explorer's fullscreen frame, fixes this.
- **Decision note:** The suite's own in-page pop-ups stay inside the fullscreen view.
- **Evidence:** t_fs_alert.js: fullscreenElement 'explorerFsWrap' before an alert and null after it. Built-in pop-ups at app.js:529, 788, 1095, 2122, 2143, 2158, 2192, 2203, 2306, 2319, 2431. The test used headless Chromium; confirm by hand in Chrome and Edge.
- **Phase 8:** Fixed by the new design. All messages, confirmations and the Pick Marker XY box are the suite's own pop-ups, and pop-ups and notices now open inside full screen. Test.

### EXP-16 · Event gold tally and log are not saved and reset weekly
**Later, Harry's call** · other · listed in the handover

- **Before:** The Gold figure from travel events disappears on reload and isn't in the backup file. It is also zeroed every 7th day. The event note log is kept in memory but never shown.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E1
- **Checker's note:** The original never saved this, so it is not 'loses saved data' under the policy.
- **Evidence:** saveNow 1239-1251 and buildSavePayload 1255-1268 omit trackers; 2397 resets gold; 864 writes the log, which nothing displays. flow_test goldAfterReload 0.
- **Phase 8:** Kept (E1). Event gold shows while the Explorer is open, resets weekly and on reopening, and isn't saved or backed up.
- **New events (6 October 2026):** changed at Harry's request (EXP-32): the party's event gold is now saved, backed up and kept as a running total until the DM presses Clear.

### EXP-17 · Rations are only mentioned, never counted
**Later, Harry's call** · other · listed in the handover

- **Before:** Events say 'you gain 2 rations' but there is no ration total anywhere.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E2
- **Evidence:** app.js:870 notice only; no ration store; CSS styles a missing #explorerRations.
- **Phase 8:** Kept (E2).
- **New events (6 October 2026):** gone (EXP-31). Rations are removed from the Explorer entirely, as Harry asked.

### EXP-18 · Gold display doesn't update straight after an outcome
**Later, Harry's call** · other

- **Before:** After an event gives or takes gold, the Gold number stays the same until you next move a token.
- **After:** Kept as it is in the rebuild.
- **Evidence:** applyOutcome (847-877) never refreshes the HUD; flow_test: notice '-10 gold' while #explorerGold showed 0.
- **Phase 8:** Kept. Test (the side-by-side run shows the same Gold figure as the old tool at every step).

### EXP-19 · Fog button shows Off after reopening when fog is on
**Later, Harry's call** · other

- **Before:** After a reload the Fog of War button says Off even though fog is showing, so the first click appears to do nothing.
- **After:** Fixed (18 October 2026, session safety): the button now follows the saved fog when the Explorer opens. It was misleading only; fog itself worked.
- **Evidence:** updateFogToggleUI (1579) is not called at start-up; misc_test: saved enabled=true, label 'Fog of War: Off'.
- **Phase 8:** Kept. Test: after reopening with fog on, the button reads "Fog of War: Off".

### EXP-20 · Region dropdown doesn't follow the loaded map
**Later, Harry's call** · other

- **Before:** Loading North Isle switches the events to North Isle, but the Region box still says Northern Province.
- **After:** Warned about, not changed (19 October 2026, Harry chose option B). When the Region isn't the loaded map's own province, a short note under the Region box says so and that events, and any Honour/Respect they change, follow the Region. The Region still decides the Clan exactly as before; an uploaded map shows no warning.
- **Evidence:** provinceSel set only at 2053; flow_test: dropdown northern_province, state the_north_isle.
- **Phase 8:** Kept.

### EXP-21 · Reset Travel leaves the weather wait behind
**Later, Harry's call** · other

- **Before:** After Reset Travel back to Day 1, weather can't happen again until the old day number plus 3 (e.g. day 14), and the day's travel event can be blocked.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E9
- **Checker's note:** travelEventDay blocks the day-1 travel event only when the reset happens on day 1 after that day's event.
- **Evidence:** app.js:2430-2442; misc_test: lastWeatherDay stayed 11; no weather on days 2-5 even when forced.
- **Phase 8:** Kept (E9). Rules test.

### EXP-22 · Weather can be closed without rolling
**Later, Harry's call** · other

- **Before:** The weather pop-up has two Close buttons. Closing it skips the weather (no video, no effect) but still uses up the 3-day wait.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E8
- **Evidence:** openWeatherModal 1034-1134 passes choices [], so renderStep adds a Close (922-931); lastWeatherDay is set at 2384 before resolving.
- **Phase 8:** Kept (E8). Test.

### EXP-23 · Line breaks in event text are lost
**Later, Harry's call** · other

- **Before:** Maerys Vell's letter and the weather 'ROLL:' line run together as one paragraph instead of the layout Harry wrote.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E12
- **Checker's note:** This also affects the weather 'EFFECT:' line built with \n\n at 1114.
- **Evidence:** .evModal_desc has no white-space rule (styles.css:635-642, 823-827, 928-931); screenshot http_07_main_event_letter.png.
- **Phase 8:** Kept (E12).

### EXP-24 · 146 events have a second part that can never be reached
**Later, Harry's call** · other

- **Before:** Many events contain a written second scene, but no button leads to it, so players never see it.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E3
- **Evidence:** analyse2.py: 146 events with an unreachable 'step2' (e.g. Bridge Out, Roadside Peddler).
- **Phase 8:** Kept (E3). The text is still in the events file.
- **New events (6 October 2026):** no longer seen: the old events are switched off (EXP-30). Every step of the new events can be reached; the rules tests check it.

### EXP-25 · A refused 'Too far' move still uncovers the fog and the pins
**Later, Harry's call** · other

- **Before:** While a hero is being dragged, the fog clears along the way. If the move is then refused for going over 30 miles, the hero snaps back but the uncovered land and any town pins there stay revealed, and are saved at the next save. On a TV that can show players places they never reached.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E13
- **Evidence:** t_transition_fog.js with fog on: 19 revealed hexes before and 90 after a refused drag. Pins went from 0 to 3. Kaelen's miles stayed at 0 with notice 'Too far...'. Code: reveals happen during the drag (2709-2712, 2740-2750), while the refusal branch (2793-2818) restores positions and hexes but not the fog store. The next saveNow writes it.
- **Phase 8:** Kept (E13).

### EXP-26 · Grid opacity slider at 0 still shows the grid
**Later, Harry's call** · other

- **Before:** Dragging the grid opacity all the way down to 0 brings the grid back at its default strength instead of hiding it.
- **After:** Kept as it is in the rebuild.
- **Evidence:** app.js:1755 uses 'Number(state.grid.opacity) || 0.35', so 0 becomes 0.35. t_opacity.js: slider 0.05 gave max alpha 29, slider 0 gave max alpha 166 (drawn at 35%).
- **Phase 8:** Kept. Rules test.

### EXP-27 · Reset Fog wipes a map's explored area with no 'are you sure?'
**Later, Harry's call** · other

- **Before:** One click on Reset Fog permanently clears everything the party has uncovered on that map, and it saves straight away. Clear map and Reset Travel both ask first.
- **After:** Kept as it is in the rebuild.
- **Decision note:** E14
- **Evidence:** app.js:1637-1655: no confirm, and saveNow runs via updateFogFromFocus or directly. Compare the confirms at 2143 and 2431.
- **Phase 8:** Kept (E14). Test.

### EXP-28 · An empty weather roll counts as a roll of 0
**Later, Harry's call** · other · found in phase 8

- **Before:** Pressing Resolve with nothing typed in the weather roll box resolves the weather as a roll of 0, which is always a failure. The "Enter a valid roll number." message can never appear, because the box only takes numbers: a typed letter just leaves it empty.
- **After:** Kept as it is in the rebuild. The rebuild puts the keyboard focus on the pop-up's heading rather than the roll box, so an Enter press meant for the previous pop-up can't resolve the weather before anyone has rolled.
- **Evidence:** app.js:1077 (type="number") and 1093-1097: `Number('')` is 0. Phase 8 test: typing "e" leaves the box empty, and Resolve gives the Failure result.
- **Phase 8:** Kept. Test.

### EXP-29 · A quick double click on an event choice can also pick the next step's choice
**Fixed by the new design** · other · found in phase 8

- **Before:** An event's choice buttons are rebuilt in the same place for each step, so the second click of a double click can land on the next step's first button, skipping a scene or picking an outcome no one chose.
- **After:** Clicks in the first moment after an event's buttons change are ignored, so a double click counts once.
- **Evidence:** app.js:918-983 (the choices are cleared and rebuilt on every step). Found while rebuilding, from the code.
- **Phase 8:** Fixed. Test: a double click on Continue moves on one step only.

### EXP-30 · Harry's new travel and campfire events replace the old 601
**Deliberate change** (Harry's request and his events document, 6 October 2026) · other

- **Before:** Every day on the road brought a travel event and every night a campfire event (about ten moments in five days), picked at random from 601 short events, most with a choice and a small outcome in gold or rations.
- **After:**
  - **The events:** 17 travel events, 12 campfire events and 3 follow-ups, each with at least one roll, a choice and a consequence that outlasts the pop-up.
    - T9 The Husk in the Furrows is written but switched off: no Rootbound creature before the Heartwood finale.
    - T17 The Second Marker was first built as a DM-only event, then removed at Harry's request (7 October 2026), leaving 16 travel events.
  - **How often:** once a day on the road, a 30% chance of a travel event, never two days running. At Make Camp, the weather is exactly as before, then a 25% chance of a campfire event, skipped after a travel or weather event that day. Events are drawn like cards: nothing repeats until a map's pool is used up.
  - **The event window:** one step at a time. It shows the check and its DC; the players roll and the DM clicks Success or Failure (or Fail by 5 or more). Then come choices, fights (run in the Combat Tracker, then Won or Fled), contests, riddles and puzzles, and a summary of what changed.
  - **What an event can change:** gold, today's miles, Active Effects, Threads, and DM notes for other tools (never applied automatically).
  - **The DM's controls:** Roll an event now and Skip this event.
  - **The old events:** switched off (no longer loaded), not deleted.
- **Evidence:** `tools/explorer/data/journey-events.js` (the events), `tools/explorer/journey.js` (the rules), `tools/explorer/tool.js` (the window and the travel panel); tests in `tests/rules/explorer-journey.test.js` and `tests/e2e/phase8.test.js`.

### EXP-31 · Rations removed
**Deliberate change** (Harry's request, 6 October 2026) · other

- **Before:** Old events said "you gain 1 rations" in their text and in the notice line, and Slow pace said "good foraging", but nothing counted rations (EXP-17).
- **After:** Every mention and every piece of code for rations is gone from the Explorer. Slow pace reads "+Stealth". The old events file, which is switched off, still has its original wording.
- **Evidence:** `tools/explorer/rules.js` (`travelMode`, `applyOutcome`), `data/explorer-data.js` (the Bastion prompt); the click-through checks no "ration" or "forag" text appears.

### EXP-32 · The party's event gold is saved, as a running total
**Deliberate change** (Harry's choice, 6 October 2026) · other

- **Before:** The Gold line was forgotten on reload and went back to 0 every 7 days (EXP-16).
- **After:** It goes up and down as events pay and cost. It's saved with the journey, in Export and in Back up everything, and stays until the DM presses Clear (which asks first).
- **Evidence:** `tools/explorer/journey.js` (`clearGold`), `rules.js` (`makeCamp` no longer resets it).

### EXP-33 · An old event's outcome didn't belong to its choice
**Fixed by the new design** · other · found by Harry's events document

- **Before:** In the old events, Bandit Sign offered only Continue, yet its outcome said "You wait, then strike first" and paid 90 gold each.
- **After:** The old events are switched off. In the new ones, every outcome belongs to the choice and roll that led to it, and every step can be reached; the rules tests walk every path.
- **Evidence:** `tests/rules/explorer-journey.test.js` ("every event's steps link up").

### EXP-34 · Fights are set up in the Combat Tracker, which reports back
**Deliberate change** (Harry's request and answers, 7 October 2026) · other

- **Before:** A fight in an event showed a line of suggested enemies and a button to open the Combat Tracker. The DM then built the fight by hand: the monsters, their HP, a map and the grid.
- **After:**
  - **In the Explorer:** the fight step shows the fight ready to go:
    - the party level, read from the Bastion's saved level (Harry's choice; level 7 if the Bastion hasn't saved one), and the group it picks (levels 7–10 or 11–16, from the event's suggestion);
    - the monsters, with SRD stat-block numbers (Harry's choice: the closest SRD creatures to each event's enemies);
    - the battle map for that kind of place and region (Harry's choice: a version per region);
    - who is surprised, in the two ambushes (T2 and F1).
  - **Set up this fight in the Combat Tracker ↗** hands the fight over and opens the tracker in a new window. If the tracker is already open in another window, the fight goes there instead.
  - **In the Combat Tracker:** a pop-up offers the fight. **Load the fight**:
    - puts the monsters in the library (once, with their initiative bonus and stat-block link) and in the encounter, in place of any monsters already there;
    - keeps the PCs and NPCs (with no PCs in the encounter, the library's PCs join);
    - marks the surprised heroes Surprised for their first turn;
    - puts the battle map, a matching grid with Snap on, and everyone's starting places on the Battlemap.

    After **Not now**, **Load the Explorer's fight** at the top offers it again.
  - **Reporting back:** when every monster in the encounter is down, the tracker tells the Explorer (Harry's choice). The event window then says so and makes **Won** the main button. The DM still clicks Won or Fled.
  - **Tidying up:** Won, Fled, Skip or ending the event clears the hand-off. So does opening the Explorer when the waiting fight isn't from the event that's on now (after restoring a backup, say).
- **The battle maps** are Harry's 16 (7 October 2026): a ford, a camp, a cove and a road, each in four looks (green, warm, cold and misty), on a 24 × 18 grid; each region uses one look (see `docs/ASSETS.md`). They replaced 23 stand-ins drawn by code the day before.
  - T9 (switched off) uses the road map.
  - C10's ride through the night meets the raiders on the road; keeping watch, they find the camp.
  - C12 at Bleakharbour is fought in the (snowy) cove.
- **How the windows talk:** each Explorer and tracker window runs separately, so the fight and the report are passed through the browser's small shared storage (`tsi.suite.handoff` and `tsi.suite.handback`). They aren't saves, so they aren't in backups.
- **Not tested:** Firefox (as SUI-20), and Edge itself; both windows were tested in Chromium from a double-clicked `index.html`.
- **Evidence:**
  - `tools/explorer/data/fights-data.js`, `tools/explorer/fights.js`, the fight steps in `data/journey-events.js` (`encounter`, `surprise`), `tools/explorer/tool.js`;
  - `tools/encounter/rules.js` (`loadHandoff`, `handoffWon`, `startPositions`, `handoffVtt`, `isBundledMap`), `tools/encounter/tool.js`, `tools/encounter/battlemap.js`;
  - `shared/js/handoff.js`, `TSI.store.fresh` and `TSI.tabGuard.isOpenElsewhere`;
  - tests: `tests/rules/fights.test.js`, `tests/e2e/fights.test.js`.

### EXP-35 · The ford only near a river, and the cove near the sea
**Deliberate change** (Harry's choice, 7 October 2026) · other

- **Before:** T2 The Ambush Sign ("take them at the ford") could come up anywhere, so its ford battle map could appear far from any river.
- **After:**
  - **The marks:** where the rivers and the coast are on each of the Explorer's 10 maps is now marked, in `tools/explorer/data/terrain-data.js`. A script (`docs/dev/make-terrain.py`) found them once, from the map pictures' colours, with two corrections checked by eye: Midland has rivers and no coast, and the River Split's mouth on Southern Province (West).
  - **"Near"** means within 2 hexes (12 miles). That counts every port town as near the sea (their pins sit up to 1.7 hexes from open water), and Alderbridge and Fork Farm as by a river.
  - **T2** is now drawn only when the hero who has just moved (or, for Roll an event now, the selected hero) is near a river. That limits it to stretches of Midland, Northern Province (East and West) and Southern Province (West), and never on an uploaded map, which has no marks.
  - **Road fights near the sea** (F1 The Toll-Men Return, and C10's dawn fight) are fought on the cove map. The fight step then says "(the party is near the sea)". Camp fights stay at the camp, and T13 and C12 keep their own maps.
  - **What was near** is saved with the event, so it doesn't change if the event is kept for later.
- **Evidence:** `tools/explorer/journey.js` (`nearAt`, `partyPos`, `context`, `eligible`), `tools/explorer/fights.js` (`settingFor`), `data/fights-data.js` (`coast`), `data/journey-events.js` (T2's `near: 'river'`), `rules.js` (`finishMove`); tests in `tests/rules/fights.test.js`, `tests/rules/explorer-journey.test.js` and `tests/e2e/fights.test.js`.

### EXP-36 · The Bastion's day follows the Explorer's: "The Ironbow sends word…" replaces the weekly reminder
**Deliberate change** (Harry's answers, 8 October 2026; the Bastion's days overhaul, BAS-60) · other

- **Before:** Make Camp ended with a Bastion reminder on Days 8, 15, 22 and so on, with "Open the Bastion Manager in a new window ↗". Export Save and Import Save carried only the journey.
- **After:**
  - **Make Camp passes the day at the Bastion,** even when it's open in another window: it notices within about 2 seconds. The Explorer only writes its own day; it never changes the Bastion's save.
  - **"The Ironbow sends word…"** comes at Make Camp, after the campfire event and the weather, whenever the new day brings news from the Bastion: building finished, an order complete, an agreement ending, a roll needed, an army ready to march, a Clan at war rolling to attack, the Bastion event, a repair done or a wounded Lieutenant back. The Explorer reads the Bastion's save to know what's due; the results (how many defenders, which roll) come from the Bastion when it passes the day. Its buttons are **Open the Bastion ↗** and **Close**. The weekly reminder is gone.
  - **Open the Bastion ↗** sits under Make Camp in the Travel panel. It opens the Bastion in a new window, or says it's already open in another window.
  - **The Explorer saves as soon as it first opens,** so the Bastion can read Day 1 straight away (BAS-62).
  - **Export Save and Import Save** carry the whole campaign: the Explorer and the Bastion together (SUI-23).
  - Reset Travel moves the Bastion's days back with the Explorer's (BAS-60).
- **Evidence:** `tools/explorer/rules.js` (`makeCamp` with the Bastion's save), `tools/explorer/tool.js` (`openBastion`, `openWord`), `shared/js/campaign-rules.js` (`ironbowNews`); tests in `tests/rules/explorer.test.js`, `tests/rules/campaign.test.js`, `tests/e2e/phase8.test.js` and `tests/e2e/bastion-days.test.js`.

### EXP-37 · Eight event moments change a Clan's Honour/Respect in the Bastion
**Deliberate change** (Harry's answer, 13 October 2026: "the 8 on-the-spot ones") · other

- **Before:** Eight event steps only showed a reminder: "DM note: Notice Board: consider ±1 clan honour with Clan …". Nothing changed by itself.
- **After:** Each of the eight sends a change of 1 in that Clan's Honour/Respect to the Bastion, which applies it once (BAS-81). The reminder is gone, so the change can't also be made by hand, and the event's list says "Sent to the Bastion: Honour/Respect +1 with Clan …" instead. The eight:

  | Event | Step | Change | Clan |
  |---|---|---|---|
  | T4 The Knight-Errant's Challenge | won the bout | +1 | the Region's |
  | T4 | declined, with a sneer | −1 | the Region's |
  | T10 The Muster Checkpoint | caught lying | −1 | Slade |
  | C4 The Deserter | dragged out | −1 | the Region's |
  | C4 | handed over | +1 | the Region's |
  | C10 The Beacons | the raiders beaten at dawn | +1 | Farmer |
  | C12 False Lights at Bleakharbour | the wreckers surrender | +1 | Karr |
  | C12 | the wreckers beaten | +1 | Karr |

  "The Region's" Clan is the one for the Region chosen when the event began. Story text is unchanged. T6's three and T13's two Thread rewards, and T13's "If this ever comes out" note, stay reminders, as Harry chose.
- **What a change does today:** it moves that Clan's support by 4 (which counts towards Form Clan), and the DM doc shows it. Hall rolls don't read Honour/Respect yet.
- **Evidence:** `tools/explorer/data/journey-events.js` (`standing` outcomes), `tools/explorer/journey.js` (`sendStanding`, `outbox`), `shared/js/bridge-rules.js`; tests in `tests/rules/bridge.test.js`, `tests/rules/explorer-journey.test.js` and `tests/e2e/bridge.test.js`.

### EXP-38 · Travel bags: Overland charts and Expedition Provision Packs
**Deliberate change** (Harry's answers, 13 October 2026) · other

- **Before:** The party carried nothing the Explorer knew about. Every day was 30 miles, less or more only by events.
- **After:**
  - **Travel bags** in the Travel panel. The DM adds charts and packs with **+ Add**; ✕ takes a row out (it asks first). Sending them from the Bastion's Warehouse waits for the Courier Exchange (pull request 6).
  - **Overland charts:** each gives 3 days of use, and the bags show the days left. **Use a chart today** adds one 6-mile hex (36 miles) until Make Camp. It works at most once a day, and is refused on a day an event has said the rest of the day's miles are lost, and with Free Move on.
  - **Expedition Provision Packs:** at C8's vigil save and the White Blizzard's group save, **Use a pack** uses one for advantage on that save, once per save (one covers the whole party in the Blizzard). The DM still rolls and decides the result.
- **Kept as it is:**
  - Pace: over 24 miles still reads **Fast (≤30 miles)**, even at 36.
  - The day's travel roll: it counts against the day's limit without a chart, and only for a move that began inside it, so a chart never makes a travel event more likely.
  - On a shortcut day (+12 miles), a chart makes 48.
- **Evidence:** `shared/data/party-items.js`; `tools/explorer/journey.js` (`addItem`, `removeItem`, `takeItem`, `usePack`, `usePackAtWeather`, `dayLimit`, `baseLimit`); `tools/explorer/rules.js` (`chartProblem`, `useChart`, `finishMove`, `makeCamp`, `resetTravel`); the `exhaustion` tags in `data/journey-events.js` (C8) and `data/explorer-data.js` (the White Blizzard). Tests in `tests/rules/bridge.test.js` and `tests/e2e/bridge.test.js`.

### EXP-39 · The DM grants a Port Charter
**Deliberate change** (Harry's answers, 14 October 2026: "Timberport and Goldport"; "DM grants; 3-day Hall order registers") · other

- **Before:** nothing in the Explorer could give the Bastion a right to trade at a port.
- **After:**
  - **Port Charter…** beside Sent to the Bastion opens a list of the ports (Timberport, Clan Blackstone; Goldport, Clan Molten), each with the Ironbow's Charter there: not held, on its way, held, being registered or registered. Choose a port, add what it's for if you like, and press **Grant**.
  - **The harbour box:** Timberport's and Goldport's town pictures (their pins) show the same, with **Grant the Port Charter…**.
  - A port can't be granted while its Charter is on its way or held (the Bastion's save is read fresh first, and again after you press Grant). After a refusal or a skip it can be granted again.
  - The message's id is a new random id from the browser's crypto, never the dice, so the seeded tests replay exactly. **Sent to the Bastion** lists it as "Port Charter: Goldport", Waiting then Applied.
- **Not in this pull request:** a harbourmaster's roll or negotiation, events that grant a Charter, and the hidden port pins (Steelport, Moltenport, Redport, Port Brawdlyn).
- **The review's fixes (14 October 2026):** a double-click on the harbour box's Grant no longer brings up the red "Something went wrong" bar, and an open harbour box follows the Bastion (it changes from "waiting" to "Held" by itself).
- **Evidence:** `tools/explorer/journey.js` (`grantCharter`), `tools/explorer/tool.js` (`charterDialog`, `harbourBox`, `openPlace`, `renderSent`); tests in `tests/rules/commerce.test.js` and `tests/e2e/commerce.test.js`.

### EXP-40 · A two-line notice in the Travel panel ran over the hero pills
**Deliberate change** (found while building pull request 5; fixed) · other

- **Before:** the notice under Gold had a fixed smallest height inside the scrolling Travel panel, so a notice long enough to need two lines (such as "Sent to the Bastion: Port Charter for Timberport (Clan Blackstone).", or "Map loaded: … • Events: …") was squeezed to one line and its second line ran over the heroes' miles pills.
- **After:** the notice keeps its full height and pushes the pills down.
- **Evidence:** `tools/explorer/explorer.css` (`.tsi-exp-notice`, `flex-shrink: 0`).

### EXP-41 · Parcels from the Ironbow: From the Ironbow and the courier post
**Deliberate change** (pull request 6, the Courier Exchange; Harry's answers, 14 October 2026) · applies something twice

- **Before:** the Travel bags only filled with + Add.
- **After:**
  - **From the Ironbow**, under the Travel bags, lists each parcel the Bastion's Courier Exchange has sent: on the road and due at its town, due (the Bastion hasn't caught up to its arrival day yet, so the Explorer waits for it rather than guessing), waiting, recalled and coming home, or collected.
  - **The courier post** under each of the eight collection towns' pictures (Slade’s Muster, Moorcastle, Bretan, Middlemount, Timberport, Goldport, Swyth and Bleakharbour; beside the harbour box at Timberport and Goldport) lists the parcels for that town.
  - **Collect…** asks first: "Only collect it when the party is at Slade’s Muster." Opening a town's picture never counts as the party being there (Harry). **The party is here: collect** reads the Bastion's save again, checks everything (the Bastion recorded the arrival, the parcel is at this town, not already collected, every item is something the bags hold, and there's room), and only then puts every item into the Travel bags and sends the pickup, in one save. A chart is 3 days of use, as before.
  - Collect is refused, changing nothing, when the browser isn't saving (it would be lost), when the Bastion hasn't saved or recorded the arrival, or when the parcel was recalled.
  - **Sent to the Bastion** lists it as "Parcel collected: Slade’s Muster". **+ Add** stays, for what the party gets from the story.
- **Known limits:** saves from different moments (an old single-tool file) can leave a pickup the Bastion has no record of: it's refused with a plain reason, and the DM takes the items out with ✕. With three or more parcels waiting at Timberport or Goldport, the town picture scrolls a little on the laptop.
- **The review's fix (14 October 2026):** a parcel holding more than 99 of one supply (only possible if the room in `courier-data.js` is raised) is now collected in full; before, it would have waited at its town for good.
- **Evidence:** `tools/explorer/journey.js` (`collectParcel`), `tools/explorer/tool.js` (`readBastion`, `renderBags`, `courierBox`, `openPlace`, `renderSent`); tests in `tests/rules/courier.test.js` and `tests/e2e/courier.test.js`.

### EXP-42 · Grant a creature
**Deliberate change** (pull request 7; Harry's answer, 14 October 2026: "the DM grants a griffin or a dire wolf in the Explorer, like a Port Charter") · applies something twice

- **Before:** nothing in the Explorer could give the Ironbow a creature.
- **After:** **Grant a creature…**, beside Port Charter… under Sent to the Bastion, asks which (Griffin or Dire Wolf), its name (optional, up to 40 letters) and what it's for, then **Grant** sends it once (a double click opens one pop-up; a browser that isn't saving refuses, so nothing is lost). Sent to the Bastion lists it as "Creature: Griffin (its name)", Waiting then Applied; once the Bastion has housed it, the line says it lives at the Ironbow now. Nothing goes into the Travel bags, and the Explorer shows no companion.
- **Not undoable:** a grant sent by mistake can't be taken back; the creature waits at the Bastion for good (BAS-91).
- **Evidence:** `tools/explorer/journey.js` (`grantCreature`), `tools/explorer/tool.js` (`creatureDialog`, `renderSent`); tests in `tests/rules/creatures.test.js` and `tests/e2e/creatures.test.js`.


### EXP-43 · Grant a creature asks first
**Deliberate change** (Harry, 15 October 2026: "both") · applies something twice

- **Before:** pressing Grant sent the creature straight away.
- **After:**
  - Grant asks "Grant a griffin (its name) to the Ironbow? …" first. Cancel sends nothing, and a double click sends it once.
  - Once the Bastion has released a creature (BAS-93), its line in Sent to the Bastion says so.
- **Evidence:** `tools/explorer/tool.js` (`creatureDialog`), `shared/js/bridge-rules.js` (`statusOf`); tests in `tests/e2e/creatures.test.js` and `tests/e2e/war-room.test.js`.


### EXP-44 · "Party bags" renamed "Travel bags"
**Deliberate change** (Harry, 15 October 2026) · other

- **Before:** the Explorer's bag of supplies, and every line about it (the Courier Exchange, the Fishery's packs, the guide), said "Party bags".
- **After:** it says "Travel bags" everywhere. Nothing in the save changes.
- **Evidence:** the words only (`tools/explorer/tool.js`, `shared/data/party-items.js`, `shared/js/bridge-rules.js`, the Bastion's data and screens, `guide.html`).

### EXP-45 · The Shrines in the Explorer: expeditions, Great Rites, charms and Use…
**Deliberate change** (pull request 8b part 2; Harry's answers S2, S9, S10, 15 October 2026) · other

- **Before:** the Explorer had no expeditions, and the Shrines' items weren't in the game.
- **After:**
  - **Start expedition / End expedition** (Travel bags box). Make Camp and resting don't start one. Ending one takes back the party's Great Rite, used or not.
  - **Great Rites** that the Bastion holds show as "waiting at the Ironbow". **Give to the party** (during an expedition) asks first, tells the Bastion once, and the party holds that one Great Rite. They can't hold a second, nor be given another in the same expedition.
  - **Charms at tagged checks.** The tagged checks are Rootfall, The Tide Causeway, The Drowned Bell, The Ember That Won't Die and False Lights at Bleakharbour. A matching charm in the bags is offered there, once a step. The DM still rolls. Earth's Endurance is offered at an exhaustion save; Tide's Passage at a water check, where it counts as a success.
  - **Use…** on a Shrine item in the Travel bags asks first, then counts one use and shows what to do. Conditions (Poisoned, Frightened, Exhaustion) stay the DM's to apply.
  - Nothing is added to a hero's sheet.
- **Choices made for Harry:**
  - One Great Rite per expedition, even after it's used.
  - Cleansing Radiance has no check to attach to, so it's used by hand.
- **Evidence:** `tools/explorer/journey.js` ("The Shrines' items, expeditions and Great Rites"), `tools/explorer/tool.js`, `tools/explorer/data/journey-events.js` (`tags`), `shared/data/party-items.js` (`offer`, `shrineRites`); `tests/rules/shrines-explorer.test.js`, `tests/e2e/shrines-explorer.test.js`.

## The Ironbow Bastion Manager
Old repo: `_legacy/bastion_manager` (file:line references point there).

**The days overhaul (8 October 2026):** the Bastion no longer has turns. It follows the Explorer's day, and every length below that was counted in Bastion turns now counts in days, at 7 days a turn unless BAS-60 says otherwise (for example BAS-56's 6 quiet turns are now 42 days, and BAS-57's 2 turns of repairs are now 14 days). See BAS-60 to BAS-63.

### BAS-01 · Reloading or importing wipes party identity, war log and all diplomacy
**Must fix** · loses saved data

- **Before:** Every time the page is reopened or a backup is imported, the tool forgets whether the party formed a Clan or Mercenary Brigade (and its name), Clan Honour, the Honour/Respect and Trusted Clients numbers, the war log, and every trade agreement, delegation, summit, writ and consortium, plus Favour Tokens and cooldowns. Losing a consortium also makes its trade route expire on the next turn.
- **After (planned):** Restore every saved field (with safe defaults) in the new loader; add a round-trip test (save, reload, compare).
- **Checker's note:** saveState writes the whole state (4911-4913), so exports made before a reload do contain these fields. A loader that restores every field will recover them from such files. Combined with the new 'route never reopens' bug, a reload kills those clans' trade routes for good.
- **Evidence:** loadState copies only some fields (app.js:4841-4902); organization, clanHonor, honourRespectByClan, trustedClientsByClan, warLog and diplomacy are left out. Runtime: B2 agreements [] after reload; B3 'org type unsworn, warLog 0' and route expired with no income next turn; B5 identity lost after Download, Reset, Import.
- **Phase 9:** Fixed. Reopening or importing restores everything: party identity, Clan Honour, Honour/Respect, Trusted Clients, the war log and all diplomacy, with Favour Tokens and cooldowns. Tests: a save-and-reload round trip in the rules tests, and reopening in the click-through.

### BAS-02 · Advance Turn loses orders if a dice roll is cancelled (or the page is reloaded mid-turn)
**Must fix** · loses saved data · listed in the handover

- **Before:** When the turn advances, the tool takes all due orders off the list before asking for dice rolls. If you cancel a Hall roll (Cancel, the X, Escape, or clicking outside the box), the tool hits an error part-way. The turn has already moved on, the remaining orders vanish, and the gold paid for them is gone. Reloading during the rolls loses them the same way.
- **After (planned):** Make Advance Turn a resumable step list saved in state (e.g. state.turnInProgress): mark each order done only after its result is applied. A cancelled roll keeps the order pending, or re-asks on resume. Keep the exact rule order.
- **Checker's note:** This affects all 5 Hall actions, not only Delegation. A reload during the start-of-turn trade roll strands orders instead of losing them (new bug).
- **Evidence:** app.js:585-590 removes the due orders first; rollD20Manual returns null on cancel (1678) and roll.d20 then crashes (935). Host Delegation checks the wrong variable, if(!roll) instead of r1/r2 (1029, 1031). ensureDiplomacyState saves mid-turn (1549). Runtime B2: 'Cannot read properties of null (reading d20)', turn 2 to 3, Barracks order gone, defenders unchanged, pending [].
- **Phase 9:** Fixed. Advance Bastion Turn now runs as saved steps, in the old order: the turn number and diplomacy, the trade routes, construction and the one-turn resets, each due order, then the automatic event. An order leaves the list only once its result is applied. A cancelled roll leaves its order pending, the Turn Log says so, and it comes up again next turn. Closing the window mid-turn reopens with the button reading "Finish Bastion Turn N". Tests: a cancelled roll, then the next turn; reopening during a roll.

### BAS-03 · Double-clicking Advance Turn can cancel a roll and lose orders
**Must fix** · loses saved data

- **Before:** If a Hall or war order is due, the second click of a double-click lands on the dark area behind the dice box. That counts as Cancel and triggers the order loss above.
- **After (planned):** Disable Advance Turn while a turn is resolving; don't let backdrop clicks cancel roll boxes; rely on the resumable turn above.
- **Checker's note:** Also: with no roll due, a double-click runs two full turns, and Enter or Space re-triggers Advance behind an open box (new bugs). One fix covers all three: a 'turn in progress' guard.
- **Evidence:** The backdrop click cancels (app.js:1727). The Advance button is never disabled while the turn resolves (560-604). Runtime B4 dblclick: turn 1 to 2, both orders gone, pageerror.
- **Phase 9:** Fixed. Clicking outside a pop-up does nothing (the suite's pop-ups), and Advance is switched off while a turn is running. Test.

### BAS-04 · Lowering the Party Level deletes built facilities
**Must fix** · loses saved data

- **Before:** Picking a lower level, even by mistake, permanently deletes any built or half-built facilities in slots above the new limit. Picking the higher level again does not bring them back.
- **After (planned):** Never trim saved slots when the level drops; show extra slots as 'over capacity' (ask Harry how they should behave).
- **Decision note:** B8 decides how over-capacity buildings behave (default: kept and marked "over capacity").
- **Checker's note:** A Hall under construction is lost the same way.
- **Evidence:** renderFacilities trims builtExtras to the slot count (app.js:4333-4334) and the next save keeps the trimmed list. Runtime B1: level 9 with 4 builds, then level 5 and a treasury edit left 2, back to level 9 still showed 2 plus 2 empty slots.
- **Phase 9:** Fixed (B8). Lowering the level keeps every building, and they keep working. Any beyond the new number of slots are marked "Over capacity", and nothing new can be built until there's room. Empty slots past the limit are hidden. Tests.

### BAS-05 · Cancelled trade-route roll lets routes pay out again
**Must fix** · applies something twice

- **Before:** If a high-risk route's roll is cancelled, the routes already paid that turn can be paid again by pressing Resolve (or by the next attempt). Gold is added two or three times in one turn.
- **After (planned):** Record each route's result for the turn as it is applied; skip routes already resolved this turn; resume only the unresolved ones.
- **Checker's note:** A double-click on Resolve (second click on the backdrop = cancel) and Enter pressed while the box is open (new bug) trigger the same double pay.
- **Evidence:** lastResolvedTurn is only set at the end (app.js:2571); the cancel path returns early (2520-2525) after earlier routes were already paid (2497-2506). Runtime B4: treasury 10000, 10100, 10200, 10300 from three Resolve clicks in one turn.
- **Phase 9:** Fixed. Each route is recorded as settled the moment it pays (or is disrupted), so Resolve after a cancelled roll only offers the routes still waiting. Test: 100 + 200 gp, not 100 + 100 + 200.

### BAS-06 · Host Delegation applies Political Capital twice
**Must fix** · applies something twice

- **Before:** A Host Delegation changes the target clan's Political Capital twice: once from a first general roll and again from the Diplomacy and Insight rolls. That makes three dice prompts, and a great result gives +30 instead of +15.
- **After (planned):** Confirm with Harry which roll set is intended, then apply PC once. Don't change it without an answer.
- **Decision note:** Only changed once Harry answers B2 (which roll set is the rule).
- **Checker's note:** Needs Harry to choose which roll set is the real rule. The delegation's summary text is also lost (new bug).
- **Evidence:** The outer tier PC change (app.js:958-977) applies to every kind, and the delegation block applies its own again (1045-1067). Runtime B2: 'Political Capital: +15 (Clan Rowthorn)' listed twice; rowthorn = 30.
- **Phase 9:** Fixed (B2). Political Capital now changes once, by the Diplomacy (DC 13) and Insight (DC 12) rolls: +15 and a Favour Token for two successes, +8 for one, 0 for a near miss, −12 for two misses. All three dice boxes stay, and the first roll still sets the rest (the 2-turn cooldown on a bad failure, and how long the delegation lasts). Tests; the side-by-side run shows the old tool adding the first roll's change on top.

### BAS-07 · The tool does not start from a double-clicked file
**Must fix** · won't work double-clicked / offline

- **Before:** Opened straight from a folder, the tool shows an error box and no buttons work, because it loads its data in a way browsers block for local files and builds wrong file paths.
- **After (planned):** Data as .js files loaded with script tags; relative paths; everything wired inside the tool's namespace.
- **Checker's note:** withBase builds file:///home/... from the first path segment (app.js:10-14).
- **Evidence:** fetch of 4 JSON files (app.js:333-340) plus withBase (10-14). Runtime A: 'URL scheme file not supported', alert 'App error during init'.
- **Phase 9:** Fixed. The data is in script files and every path is relative, so it opens from a double-clicked index.html. Test.

### BAS-08 · Facility pictures and map overlays missing from a double-clicked file
**Must fix** · won't work double-clicked / offline

- **Before:** Even with the data fixed, the facility pictures and the building overlays on the map would not show from a local file.
- **After (planned):** Relative asset paths from the tool folder.
- **Checker's note:** Verified by reading the code, not re-run. CSS backgrounds and trade/ledger art use relative paths and would load.
- **Evidence:** withBase makes /home/assets/... paths (app.js:1269, 2180, 4453). Runtime C: ERR_FILE_NOT_FOUND for every facility picture and overlay.
- **Phase 9:** Fixed. Every facility picture, the eight map overlays, the panel pictures, and the Hall and trade art load from a double-clicked file with no internet. Test.

### BAS-09 · Fonts need the internet
**Must fix** · won't work double-clicked / offline

- **Before:** Without Wi-Fi the tool loses its Cinzel and Uncial lettering and falls back to a plain system font.
- **After (planned):** Bundle the fonts locally through the shared design tokens (with licences).
- **Evidence:** styles.css:2 @import Google Fonts; runtime: blocked, fallback font in screenshots
- **Phase 9:** Fixed by the suite's bundled fonts (phase 1). Test: nothing reaches for the internet.

### BAS-10 · Pressing Enter or Space while a dice box is open runs Advance Turn a second time
**Must fix** · applies something twice

- **Before:** After you click Advance Bastion Turn, the button behind the dice box stays selected. If you press Enter or Space to 'confirm' the box, the tool quietly starts another whole turn underneath it. The turn counter jumps by two, building work counts down twice, contract income is paid twice, and 'Turn Advanced' is logged twice.
- **After (planned):** While a turn is resolving, ignore Advance (disable the button and keep a turn-in-progress flag). Move focus into each box and trap it there. Handle this inside the resumable-turn design.
- **Evidence:** The boxes never move keyboard focus (openSIModalChoice app.js:1693-1750). Advance has no in-progress guard (560-604). Runtime t_enter.js A: document.activeElement = advanceTurnBtn; after Enter the turn went 2 to 3 while the first box was still open, Library construction went 3 to 1, and the log shows 'Turn Advanced: 3' twice. Test C: Space does the same with a war roll box.
- **Phase 9:** Fixed. Advance is switched off while a turn runs, and the keyboard focus moves into each dice box and stays there. Test: Enter and Space while a dice box is open don't start another turn.

### BAS-11 · Pressing Enter while a trade-route dice box is open pays every route twice
**Must fix** · applies something twice

- **Before:** The same focus problem on the Resolve button: pressing Enter while the route roll box is open resolves the trade routes a second time in the same turn, and all the gold is paid twice.
- **After (planned):** Busy guard on Resolve, plus recording each route as resolved for the turn as soon as it pays (same fix as the cancel double-pay).
- **Evidence:** Resolve keeps focus (runtime t_more.js D: activeElement = btnResolveTradeRoutes; two stacked 'Resolve Route: Karr' boxes). Runtime t_resolve.js: one resolve 10000 to 10220; with one Enter press 10000 to 10440. lastResolvedTurn is only set at the end (2571).
- **Phase 9:** Fixed, with BAS-05: Resolve can't start again while it's running, and the focus is inside the dice box. Test: Enter during a route roll.

### BAS-12 · Double-clicking Advance Turn runs two whole turns
**Must fix** · applies something twice

- **Before:** If nothing needs a dice roll, a double-click on Advance Bastion Turn moves the Bastion on two turns (14 days) at once. Building work and income tick twice, and there is no warning.
- **After (planned):** Ignore repeat clicks while a turn is being resolved and for a short moment after. Ask Harry whether he also wants a confirm step.
- **Evidence:** Runtime t_enter.js B: dblclick gave turn 1 to 3, Library remaining 3 to 1, two 'Turn Advanced' log lines. No guard exists (app.js:560-604).
- **Phase 9:** Fixed. A second click within a moment, or while a turn is running, is ignored. No confirm step was added, as that would be a new feature; Harry can ask for one. Test: a double click advances one turn.

### BAS-13 · Orders can get stuck in Pending forever after a skipped turn
**Must fix** · loses saved data · listed in the handover

- **Before:** An order only completes on exactly the turn it was due. If the page is reloaded while the start-of-turn trade roll box is open (or a turn is skipped by the Enter problem above), that turn's orders never complete. They sit in Pending Orders showing an old turn, and the gold paid for them is gone.
- **After (planned):** Complete every order whose due turn is at or before the current turn (<=), inside the resumable Advance transaction. Keep resolution order unchanged.
- **Evidence:** Due check is o.completeTurn === state.turn (app.js:585-586). turn+1 is saved by tickDiplomacyOnAdvanceTurn before the trade box (562-576, 2385). Runtime t_more.js H: reload during the Karr route roll, then two Advances; at turn 5 the Barracks order still says 'Completes on Turn 3' and defenders are unchanged.
- **Phase 9:** Fixed. Orders due this turn or any earlier one complete. Test.

### BAS-14 · Importing the wrong JSON file silently wipes the Bastion
**Must fix** · loses saved data

- **Before:** Import accepts any JSON file. If you pick another tool's save (easy once eight tools all export JSON), the tool says 'Import this save?', then loads a blank starting Bastion (0 gold, turn 1, empty warehouse). Your real save is gone.
- **After (planned):** Check that the file is a Bastion save (tool id / schema version / expected fields) and refuse or warn clearly. Show what will be replaced before confirming. Keep a one-step undo backup of the current save.
- **Evidence:** app.js:637-659 writes the parsed file straight to storage, with no check that it is a Bastion save. loadState fills defaults (4841-4907). Runtime t_import.js: treasury 4321, turn 9, warehouse [Longship] became 0, 1, ['New Item'] after importing {"players":[...],"prizeTotal":300}.
- **Phase 9:** Fixed. Import checks the file first: another tool's file, or a Bastion save with a damaged part, is refused and nothing changes. It shows what's in the file, asks before replacing and offers a copy of the current data first. A damaged save in the browser is set aside, not deleted. Tests.

### BAS-15 · Double-clicking Queue War Action queues two wars
**Must fix** · applies something twice

- **Before:** Queue War Action has no cost and no duplicate check, so a double-click queues two identical war actions. Next turn both are rolled, and gold, Political Capital and casualties are applied twice.
- **After (planned):** Ignore rapid repeat clicks. Ask Harry whether more than one war action per turn is allowed at all.
- **Decision note:** B22 decides whether more than one war per turn is allowed at all.
- **Evidence:** The handler has no guard (app.js:472-507). queueWarAction pushes every time (5262-5275). Runtime t_more.js G: pending = ['War Action@2','War Action@2'] after one dblclick.
- **Phase 9:** Fixed. A double click queues one war action. More than one a turn is still allowed (B22). Test.

### BAS-16 · Diplomacy panel collapse arrow does nothing
**Fixed by the new design** · other

- **Before:** The ▾ button on the Diplomacy & Trade panel opens and closes in the same click, so it never collapses.
- **After (planned):** Bind once in the rebuild.
- **Decision note:** Panels use the shared collapse control, bound once.
- **Evidence:** makeCardCollapsibleById runs twice for diplomacyPanel (app.js:158 and 2083) and binds two listeners. Runtime B6: collapsed false after one click.
- **Phase 9:** Fixed. Each panel's ▾ button works, and a closed panel stays closed after reopening (saved in `tsi.bastion.ui`). Test.
- **Build 2 (8 October 2026):** the panels now open as pop-ups over the map, so they have no ▾; the facility grid's ▼ folds it away, and that's remembered instead (BAS-64).

### BAS-17 · Unsaved Warehouse and Artisan Tools edits vanish
**Deliberate change** · other

- **Before:** Typing in the Warehouse, or picking Artisan Tools, is lost if you click anything else (such as +1 Defender or changing the gold) before pressing Save, even though the map says the tool saves automatically.
- **After (planned):** CLAUDE.md's autosave rule covers this: save warehouse and tool edits as they are made. Record it as behaviour changed by the autosave rule.
- **Decision note:** CLAUDE.md autosave rule: edits save as they are made.
- **Checker's note:** The CLAUDE.md autosave rule removes this by design. Record it as a deliberate behaviour change.
- **Evidence:** render() rebuilds both from saved state (app.js:1290-1292, 1380-1404, 3424-3451). Runtime B5: edit reverted to 'Rope'; artisan pick reverted to ''.
- **Phase 9:** Changed as planned. Warehouse boxes save as you type, and Artisan Tools as you pick. Save Warehouse and Save still log as before. Tests.

### BAS-18 · Treasure event can never be rolled
**Deliberate change** · other (Harry's answer B11)

- **Before:** Rolls of 99 or 100 show 'Unknown' instead of the Treasure event, so Treasure never happens.
- **After:** Fixed at Harry's request (B11).
- **Decision note:** B11. Recommended fix (a one-character reading slip in Harry's own table); only with Harry's OK.
- **Checker's note:** One-character content fix, but it doesn't break, lose or double anything, so it is Harry's call.
- **Evidence:** resolveEvent reads '99-00' as 99 to 0 (app.js:4728-4736). Runtime B1: roll 99 and roll 100 both show 'Unknown, No description text found'.
- **Phase 9:** Fixed at Harry's request (B11): rolls of 99 and 100 now give Treasure. Tests.

### BAS-19 · Four facility overlays never appear on the map
**Later, Harry's call** · other

- **Before:** Overlay art exists for the Gaming Hall and all three shrines, but the tool looks for different file names, so those buildings never appear on the Bastion map.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B12
- **Evidence:** app.js:1269 builds '<facId>_overlay.png'; the files are gambling_hall_overlay.png and shrine_of_{telluria,aurush,pelagos}_overlay.png. media.py shows exists=False; runtime 404s.
- **Phase 9:** Kept (B12). The four overlays are in `tools/bastion/assets/extras/`.
- **13 October 2026 (Harry's new map, decision D10):** the three Shrines now show on the map once built, with Harry's new Shrine paintings. The Gaming Hall still has none (it is being retired). See BAS-69.
- **Facilities overhaul 1a (13 October 2026):** the Gaming Hall has left the Bastion (BAS-71), so nothing is left of this.

### BAS-20 · Clicking a compendium card picture throws an error
**Later, Harry's call** · other

- **Before:** Clicking an item's card picture in the Compendium does nothing (the enlarge feature was never written).
- **After:** Kept as it is in the rebuild.
- **Evidence:** openImageViewer is called at app.js:4312 but defined nowhere. Runtime B5 pageerror 'openImageViewer is not defined'.
- **Phase 9:** Kept: clicking a card picture still does nothing, now without an error.

### BAS-21 · Trade Agreement duration choice ignored
**Later, Harry's call** · other

- **Before:** The 1/3/6-turn duration picked when planning a Trade Agreement has no effect; it always lasts 4 turns plus or minus the roll.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B5
- **Evidence:** meta.durationTurns is set (app.js:1998) but resolution uses fn.special.durationTurns (905, 979). Runtime B2: picked 6, got 5 turns.
- **Phase 9:** Kept (B5): the Duration list is still offered and still ignored. Test (rules).

### BAS-22 · Hall upgrades are free
**Later, Harry's call** · other

- **Before:** Upgrading the Hall of Emissaries costs nothing, although the data lists 600gp and 1,200gp.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B4
- **Checker's note:** An upgrade can still be ordered at L3, for nothing.
- **Evidence:** upgrade_hall costGP 0 and costByNextLevel unused (app.js:1215-1220, 3306). Runtime B3: 20000 to 20000.
- **Phase 9:** Kept (B4): upgrades are free. Test.
- **Facilities overhaul 1b (13 October 2026):** still free (D8: no gold for now), but the Hall now uses every facility's **Upgrade** order, which can't be ordered at the top level or twice at once (BAS-73).

### BAS-23 · Writ of Authority bonus never granted
**Later, Harry's call** · other

- **Before:** The Writ's help text says +2 on the next 3 council verdicts, but nothing ever gives that bonus.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B6
- **Evidence:** authorityBonusTurns is never set above 0 (app.js:2895, 2929; tooltip 3581-3587)
- **Phase 9:** Kept (B6). Test.

### BAS-24 · Consortium pays twice each turn
**Later, Harry's call** · other

- **Before:** One Trade Consortium pays its contract income and its trade route payout every turn, the same amount twice. This may or may not be intended.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B3. If Harry says one income was intended, this becomes an "applies twice" fix.
- **Checker's note:** The behaviour is real. Whether it is a bug depends on Harry: if he says one income was intended, it becomes an applies-twice fix.
- **Evidence:** route yieldGP = consortium perTurn (app.js:1144); tickDiplomacy pays incomePerTurn (2336-2341) and routes pay routePayout (2497-2506). Runtime B4: +174 contract and +174 route.
- **Phase 9:** Kept (B3). The side-by-side run shows the same two incomes as the old tool.

### BAS-25 · Beasts counted by row, not number
**Deliberate change** (fixed at Harry's request, 2 October 2026; was *Later, Harry's call*) · applies something twice

- **Before:** Two of the same beast show as 'x2' but count as one beast for war, and a single beast casualty removes the whole pair. Harry found it with five Giant Vultures: Beasts Committed would only go up to 1.
- **After:** Beasts are counted by number: five Giant Vultures are five beasts, and all five can be committed. A lost war still costs one beast, and now it's one beast (the vultures go from ×5 to ×4), not the whole row. It's always one that marched: the committed beasts are the first in the Menagerie's list, as the War Table names them, and the last of those is lost. The war's modifier is unchanged: it still counts at most 2 beasts.
- **Decision note:** B10. The checker notes the casualty part removes more beasts than it should.
- **Checker's note:** The casualty part is damage counted twice. The availability undercount is 'other'. The handover warns against counting rows.
- **Evidence:** app.js:476 and 5211 use .length; 5359-5363 splices a row. Runtime B6: 'Owlbear x2', war hint '1 beasts'.
- **Phase 9:** Kept at first (B10). **Fixed 2 October 2026** at Harry's request: `R.beastQty` and `R.removeBeasts` in `tools/bastion/rules.js`; tests in `tests/rules/bastion.test.js` ("five Giant Vultures are five beasts…") and `tests/e2e/phase9.test.js`. In the side-by-side run with the old Bastion, the only beast in that campaign is a single one, so nothing else changes.
- **Since Build 3 (8 October 2026):** the single roll that lost one beast, and `R.removeBeasts`, are archived with it (BAS-66; their tests are in `tests/archive/mercenary-brigade.test.js`). `R.beastQty` is unchanged; battles on the War Table take their losses by name.

### BAS-26 · Library scripture notes never attach
**Later, Harry's call** · other

- **Before:** Research scriptures should carry advantage notes (e.g. 'Adv. on Survival checks'), but the names don't match, so the warehouse just says 'Library'.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B16
- **Checker's note:** The six shrine charm notes are hidden too (new item).
- **Evidence:** Map keys 'Geographical', 'War' and so on (app.js:3290-3303) vs options 'Geographical Scriptures' and so on. Runtime B3: warehouse notes 'Library'.
- **Phase 9:** Kept (B16). Test.

### BAS-27 · Trade Agreement routes never glow on the Sea Trade Routes map
**Later, Harry's call** · other

- **Before:** The trade map is meant to show routes for Trade Agreements too, but the clan is stored as 'Clan Blackstone', so no route overlay is found.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Verified by reading the code only.
- **Evidence:** tradeRouteOverlayFileForClan compares lowercased 'clan blackstone' (app.js:2617-2629, 2652-2658)
- **Phase 9:** Kept: Trade Agreement clans are listed under "Showing routes for" only if they have route art, as before.

### BAS-28 · Cancelling a pending order doesn't refund gold
**Later, Harry's call** · other

- **Before:** Cancelling a queued order keeps the gold already paid.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B9
- **Checker's note:** Design question for Harry.
- **Evidence:** app.js:3236-3244. Runtime B6: 1000, 600 after issue, 600 after cancel.
- **Phase 9:** Kept (B9). Test.

### BAS-29 · Arbitration log shows '[object Object]'
**Later, Harry's call** · other

- **Before:** The Turn Log line for a council verdict prints '[object Object]' instead of the dice number.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** The popup itself shows roll.d20 correctly (3014).
- **Evidence:** app.js:2953-2954 uses ${roll} (an object). Runtime B4 log.
- **Phase 9:** Kept. Test.

### BAS-30 · Compendium card pictures and local descriptions mostly hidden
**Later, Harry's call** · other

- **Before:** 19 of the 55 item cards and 35 hand-written item descriptions (20 not stored anywhere else) never show, because of name mismatches and unused code.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B15
- **Evidence:** app.js:3904-3906 (exact names), 3665-3878 (no callers); data analysis: 36 of 55 cards matched
- **Phase 9:** Kept (B15). The 36 matching cards show; the other 19 are in `tools/bastion/assets/extras/compendium_cards/`. The hand-written descriptions are kept, unused, in `tools/bastion/data/bastion-data.js`, so nothing Harry wrote is lost. The Export button's online lookup is dropped: it keeps the filled-in entries and writes the rest as stubs with a Roll20 link. Test.

### BAS-31 · Minor: duplicate Clear Warehouse handler; missing seal sound; broken HTML nesting; treasury can go negative then snap to 0 on reload
**Later, Harry's call** · other

- **Before:** Small tidy-ups. 'Cleared warehouse' is logged twice. The seal sound file does not exist. The page has mismatched sections. A failed delegation can push gold below zero, and the next reload quietly resets it to 0.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B17 covers whether the treasury may go negative.
- **Checker's note:** Also: once defenders drop to 0 through war casualties, the armed flag stays true, so later recruits show 'Armed' without paying (5354-5357, 263-266).
- **Evidence:** app.js:530 and 1485; 3055; index.html:186-188, 497-499; app.js:1086 vs 4843
- **Phase 9:** Kept where it still applies: "Cleared warehouse." is still logged twice, the treasury can still go below 0 and comes back as 0 on reopening (B17), and the armed flag stays on after war casualties. The seal sound was never played (its file never existed), and the page structure is new.

### BAS-32 · A Trade Consortium can never reopen a route that has expired
**Later, Harry's call** · breaks the tool

- **Before:** When a consortium's trade route ends, it stays on the list marked 'expired'. Signing a new consortium with the same clan later pays contract income but never opens a new route, so that clan's trade route is dead for good. Because a reload already wipes consortiums and expires their routes, one reload permanently kills trade with those clans.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B21. Less urgent once the reload wipe (above) is fixed.
- **Evidence:** The existence check ignores status: routes.some(r => clan matches) (app.js:1135-1136). Expired routes are never removed (2360-2369, 2375-2381). Runtime t_reopen.js: with an expired Blackstone route, a Great Success consortium gave '+260 gp/turn' but no 'Route opened' line; the route stayed 'expired' and the next Advance paid only contract income.
- **Phase 9:** Kept (B21). Test.

### BAS-33 · A natural 1 on a Hall action counts as a success
**Later, Harry's call** · other

- **Before:** If you roll a 1 on a Hall of Emissaries action, the result box says 'Bad Failure', but the deal is still signed at full income with no Political Capital loss and no cooldown. That is better than rolling a 2, which fails with -20 Political Capital and a 2-turn cooldown.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B20
- **Evidence:** tierFromRoll returns 'critical_failure' (app.js:1862). The tier table has no branch for it (958-962), so it keeps turnsAdj 0, income ×1 and PC 0. formatTier prints 'Bad Failure' (1875). Runtime t_more.js E: roll 1 gave a 'Trade Agreement (4 turns) +69 gp/turn', PC +0, no cooldown. E2: roll 2 gave no deal, PC -20, cooldown 2.
- **Phase 9:** Kept (B20). Test.

### BAS-34 · Host Delegation result box loses its summary line
**Later, Harry's call** · other

- **Before:** After a Host Delegation, the result box has an empty line where the outcome text should be (for example 'The delegation leaves impressed. Promises become leverage.'). The text is written but never shown or logged.
- **After:** Kept as it is in the rebuild.
- **Evidence:** Inner 'let summary' (app.js:1043) shadows the outer one (941), which stays ''. Runtime t_more.js F: the first .siResSummary is empty, and the log body ends with a blank summary.
- **Phase 9:** Kept: the empty line still shows. Test.

### BAS-35 · Shrine charm effects are never shown
**Later, Harry's call** · other

- **Before:** The six shrine charms each have written effects in the data (for example Tellurian Root Charm: 'Advantage on CON saving throws once per short rest. Value = 100gp.'). The tool never shows this text, and crafted charms go to the warehouse with only the shrine's name as the note.
- **After:** Kept as it is in the rebuild.
- **Decision note:** B23
- **Evidence:** The option notes are in facilities.json (shrine craft options). The generic warehouse path uses order notes only (app.js:1244-1246). issueOrder sets notes only for the Library (3284-3303). renderFunction shows fn.notes, not option notes (4542). The compendium entries for the charms are empty.
- **Phase 9:** Kept hidden (B23).

### BAS-36 · The page needs sideways scrolling on the laptop
**Fixed by the new design** · other · found in phase 9

- **Before:** On Harry's laptop (1707 wide) the page is 1754 wide, because the fixed Favour panel and the three columns beside it don't fit, so it scrolls sideways.
- **After:** The Favour panel sits in the layout (it still sticks while the page scrolls), and the columns fit the laptop and the TV.
- **Evidence:** index.html:35 and 142; styles.css:46 and 158 (a 340 px panel plus 340 + 680 + 340 px columns). Phase 9 screenshot of the old tool at 1707 × 930: page width 1754.
- **Phase 9:** Fixed. Test at the laptop, full screen, the TV and a small window.
- **Build 2 (8 October 2026):** the page no longer scrolls at all; the map fills the window (BAS-64).

### BAS-37 · Code that could never run is left out
**No longer relevant** · other · found in phase 9

- **Before:** The old app.js has parts nothing can reach: the Arbitration Authority pop-up (its button, `#btnArbitration`, doesn't exist), a route highlighter that reads canvas pixels (never called), an older way of running a facility's function straight away (never called), an animated dice roll (never called), an SVG route drawing (never called, and its data is missing), automatic Compendium descriptions (never called), a Reset Identity button that's always hidden, and a reputation adjuster (never called).
- **After:** Not carried across, so nothing changes on screen. The Arbitration Authority pop-up's wording is still in the old repo if Harry wants it later.
- **Evidence:** app.js:2071-2073 and 3066, 5632, 4560, 1607, 1796, 4144 and 1852 (where each starts); index.html:211.
- **Phase 9:** Left out.

### BAS-38 · Wording that no longer fits
**Deliberate change** · other · found in phase 9

- **Before:** The Form Clan and Brigade boxes say "Save is in TEST mode right now." The Pending Orders hint says to click "Take Bastion Turn", a button that doesn't exist. The map tip says the tool saves in "local storage" and that "Each player can have their own copy".
- **After:** "This is persistent." stays; the TEST-mode sentence goes, as the suite has one save (answer 9). The hint names Advance Bastion Turn. The tip reads "This tool saves automatically in your browser." (the suite's own storage; B18).
- **Evidence:** app.js:405 and 445; index.html:480 and 168.
- **Phase 9:** Changed.

### BAS-39 · The Warehouse and Artisan Tools panels show the wrong faint pictures
**Deliberate change** · other · found in phase 9

- **Before:** The Diplomacy & Trade panel is slipped into the same row as the Warehouse and Artisan Tools, which shifts the picture rules along: the Warehouse shows the artisan tools picture and Artisan Tools shows none.
- **After:** Each shows its own picture, as the styles intended.
- **Evidence:** app.js:2062 inserts the panel before the Warehouse; styles.css:701-706 pick the pictures by position.
- **Phase 9:** Changed.

### BAS-40 · Redrawing resets the facility lists and the carousel
**Deliberate change** · other · found in phase 9

- **Before:** After any change (issuing an order, say), every facility's list jumps back to its first choice and the carousel scrolls back to the start. A war report runs its lines together.
- **After:** The lists keep your choice, the carousel stays where it was, and a war report shows its lines as written.
- **Evidence:** app.js:4444-4497 rebuild everything on each render; 5139 puts the report's line breaks in an ordinary box.
- **Phase 9:** Changed.
- **Build 2 (8 October 2026):** the carousel is gone; each facility opens in its own panel from its tile, and its lists still keep your choice (BAS-64).

### BAS-41 · A war action was settled by one roll
**Deliberate change** (Harry's request, 2 October 2026) · other

*Phase 2 (2 October 2026, later): the single roll is gone. The battle on the War Table now decides the result (BAS-45); the rest of this entry describes phase 1.*

- **Before:** A queued war action resolved on the next Advance Bastion Turn with a single d20 roll against its DC, and that was all.
- **After:** When the war comes due, a pop-up offers **Begin Military Action** or **Later** (Later leaves it waiting in the Banner & War Council panel, where Begin or Continue picks it up any time). Then three rolls, each a plain d20 with its own story:
  - **Weather Conditions**, DC 12. Pass: a clear day. Fail: a Snowstorm, Rainstorm or Heatwave, picked at random, with the Explorer's weather film.
  - **Morale**, DC 12, plus 4 in a snowstorm, 2 in a rainstorm or 3 in a heatwave.
  - **Luck**, DC 10. Pass: +1, fail: −1.

  Then the **War Table** opens full screen inside the Bastion: upload a battle map (or use the plain board), Begin Deployment, drag the forces about on your own ground (the bottom half), and Start Battle to lock them in. Until enemy forces and combat are built (Harry's next phase), the battle is then settled by the old single roll, with Luck's +1 or −1 added, and the war log also notes the weather, morale, luck and deployment. Weather and Morale don't change the result yet.
- **Added beyond the request, for Harry to keep or drop:** **Call off** in the War Council, which ends a Military Action with nothing won or lost (otherwise a war, once due, could never be ended without fighting it); and, on the War Table, Snap, Grid on/off, Zoom and Fit, panning when zoomed in, arrow-key nudging and Clear map, the usual battlemap controls (the Combat Tracker's battlemap has the same kind).
- **Saving:** every step is saved as it happens (`militaryActions` in the Bastion's save; the War Table's map and settings as `tsi.bastion.warMap` and `tsi.bastion.warTable`), so a cancelled roll, a closed War Table or a closed window loses nothing and nothing is applied twice. The war order is removed in the same step that creates the Military Action, so it can't come due twice.
- **Evidence:** `tools/bastion/rules.js` (the Military Action section), `tools/bastion/war-table-rules.js`, `tools/bastion/war-table.js`, `tools/bastion/tool.js`; tests in `tests/rules/bastion.test.js`, `tests/rules/bastion-war-table.test.js` and `tests/e2e/phase9.test.js`. The side-by-side run with the old Bastion still matches, apart from the war log's extra lines and Luck's +1 on that raid's roll.

### BAS-42 · No way to show the Clan's or Brigade's crest
**Deliberate change** (Harry's request, 2 October 2026) · other

- **Before:** The Bastion had no crest. Form Clan asked for the Clan's name, Chief and motto; Form Mercenary Brigade for its name.
- **After:** Both pop-ups have a **Crest (optional)** box: a link that opens the Clan Crest Creator in a new tab, and **Upload crest…** for the PNG it downloads. The crest shows beside the Clan's or Brigade's name in Party Identity, with **Change crest…** and **Remove crest** (which asks first); a Clan or Brigade founded earlier can **Add crest…** there. The picture is shrunk to 512 pixels a side and saved as `tsi.bastion.crest`, so it's in Download Save and "Back up everything"; Reset clears it with the rest of the Bastion.
- **Evidence:** `tools/bastion/tool.js` (the crest section), `R.isCrest` in `tools/bastion/rules.js`; tests in `tests/rules/bastion.test.js` and `tests/e2e/phase9.test.js`.
- **Since Build 3 (8 October 2026):** the crest belongs to the Bastion and can be set at any time, Unsworn or a Clan (BAS-67).

### BAS-43 · The Lieutenants and Regiments boxes won't take a number, with no sign why
**Must fix** (Harry's report, 2 October 2026; fixed) · breaks the tool

- **Before:** Harry had Lieutenants and Regiments available but the War Turn boxes wouldn't take any. The boxes are switched off for an Unsworn party (only a Clan or Mercenary Brigade can commit them, as in the old tool), but a switched-off box looked exactly like a working one, and the only clue was the end of the small line under the panel. The old tool looked the same. Each box also rewrote its number on every key press. That never failed in the test browser, but it could fight with your typing.
- **After:** A switched-off box is greyed out, says "Clan or Brigade only" underneath, and explains why when you hover over it. Every box shows how many are available ("3 available", or "None yet: recruit in the War Room"). The arrows stop at that number, and a number is only checked once you've finished typing it (or when you press Queue War Action). The rule itself is unchanged.
- **Evidence:** Could not be reproduced in the test browser: a Clan with Lieutenants and Regiments could commit them by typing, the arrow keys and Backspace, before, during and after a Military Action, on the laptop and the TV size. `tools/bastion/tool.js` (`showWarAvailable`), `tools/bastion/bastion.css`; tests in `tests/e2e/phase9.test.js`.
- **Since Build 3 (8 October 2026):** the switched-off boxes say "Clan only", as only a Clan can commit them now (BAS-66).


### BAS-44 · The War Room recruited only Lieutenants and generic regiments
**Deliberate change** (Harry's request, 2 October 2026; war mini-game phase 2) · other

- **Before:** The War Room's Recruit list had "Lieutenant (1)" and "Regiment (100)". Regiments had no stats.
- **After:** The list is Lieutenant (1), Archers (50), Levy Infantry (150), Line Infantry (100), Heavy Infantry (50), Light Cavalry (50) and Shock Cavalry (25). Each has a stat block (Cohesion, Attack, Defence, Move, Resolve, Battle Value and its distinction) shown when you hover over it in the list, in the Military panel and on the War Table. Regiments recruited before this fight as Line Infantry. The six new names join the Compendium's list, as the War Room's options always have.
- **Evidence:** `tools/bastion/data/war-units-data.js` (the numbers), `data/facilities-data.js`, `tool.js`; `docs/WAR-RULES.md` section 1.

### BAS-45 · The war is fought as a battle on the War Table
**Deliberate change** (Harry's request, 2 October 2026; war mini-game phase 2) · other

- **Before:** After Start Battle, the war was settled by the War Turn's single d20 roll with Luck added (phase 1, BAS-41).
- **After:** The battle is played out on the War Table and its result decides everything:
  - **The battlefield:** squares one regiment wide; a no-deployment strip across the middle; the enemy army deployed automatically.
  - **Turns:** six rounds of alternating activations, with the orders Advance & Attack, March, Hold, Rally, Disengage and Interact.
  - **Fighting:** Charge, surrounding, and ranged attacks with line of sight; one-roll attacks that cost Cohesion; Steady → Shaken → Routed.
  - **Leaders and beasts:** Lieutenants lead formations; beasts fight with their own profiles and traits.
  - **Winning:** each objective has its own victory rule, and an army breaks at 60% losses. Withdraw replaces Call off once the battle has begun.
  - **The opening rolls now matter in battle:** the Weather's effects, Morale's ±2 on Resolve checks, and Luck's ±1 on your attacks (Luck also decides who goes first).
  - **Rolls:** the enemy is played by the War Table. Your rolls can be typed or left to the table.

  The full rules are in `docs/WAR-RULES.md`.
- **Evidence:** `tools/bastion/war-battle-rules.js`, `war-ai.js`, `war-table.js`; tests in `tests/rules/bastion-battle.test.js`, `bastion-war-ai.test.js` and `tests/e2e/phase9.test.js`.

### BAS-46 · The enemy's strength now comes from the mission
**Deliberate change** (Harry's request, 2 October 2026; war mini-game phase 2) · other

- **Before:** There was no enemy army: the War Turn's DC stood in for it.
- **After:** You choose the enemy force you go after: a small local force (18 Battle Value), an established one (28) or a major force (40).
  - **Its size:** that base is multiplied by the objective and by one saved variation roll.
  - **Its make-up:** the army is drawn from the target clan's own mix of troops and variant units.
  - **When it's fixed:** it's drawn up and saved as soon as you pick the mission, before you commit anything. Changing your commitment never redraws it, and it's never scaled to your level or your army.
  - **What you see:** an intelligence estimate, with your own army's Battle Value beside it.
  - **The clans:** their armies are proposed directions; only Slade's colours are established.
- **Evidence:** `tools/bastion/war-campaign-rules.js` (`generateEnemy`, `ensureMission`, `missionEstimate`); `docs/WAR-RULES.md` section 2.

### BAS-47 · A war now leaves lasting losses: depleted regiments and recovery
**Deliberate change** (Harry's request, 2 October 2026; war mini-game phase 2) · other

- **Before:** A lost war cost a third of the committed defenders and one beast; nothing else was ever lost.
- **After:**
  - **Personnel losses** follow each unit's final state in the battle: 0%, 10%, 25%, 40% or 60% of the soldiers present at the start.
  - **Depleted regiments** stay in the Military panel and fight at reduced strength until recruiting the same unit type in the War Room tops them up. A regiment is removed only when no soldiers are left.
  - **Lieutenants and beasts:** when one is Defeated, roll a d6 (killed, captured or badly wounded, wounded, or recovered). A Routed one is separated for a turn. They return by themselves on later Bastion turns.
  - **Rewards** keep the existing amounts and follow the objective: a raid's gold follows the supplies carried off; a draw changes nothing; a withdrawal costs only half the Clan Honour.
  - **The War Report** records everything, and it's all applied once.
- **Evidence:** `tools/bastion/war-campaign-rules.js` (`finishBattle`, `tickRecovery`, `recruitUnit`); `docs/WAR-RULES.md` section 8.

### BAS-48 · Battle maps get painted terrain rules
**Deliberate change** (Harry's request, 2 October 2026; war mini-game phase 2) · other

- **Before:** An uploaded battle map was only a picture.
- **After:** Each map can be given terrain square by square with the War Table's Terrain button. The types are woods, bog, rubble, dense woods, ridges, cover, deep water, cliffs and crossings, each with its rule. The War Table warns when a map has no terrain yet rather than guessing from its colours; until it's painted, everything counts as open ground. The painting is saved with the map (one painting per map and battlefield width) and can be changed freely until Start Battle. During a battle, that battle's own terrain can be changed only through DM: pause, and that doesn't change the map's saved painting.
- **Evidence:** `tools/bastion/war-table.js` (painting), `war-battle-rules.js` (the rules); `docs/WAR-RULES.md` section 4.

### BAS-49 · Small things in the war battles, kept for now
**Later, Harry's call** (found while checking war mini-game phase 2, 2 October 2026) · other

Nothing here breaks a battle, loses data or applies anything twice, so each is kept as built. Say if you'd like any changed.
- **Guards beside supply markers:** in a Raid, an enemy guard stands on a square next to its supply marker. Which square depends on the enemy's tie-breaks, so it's sometimes in front of the marker and sometimes behind it.
- **One battle-map picture:** all battles share one uploaded picture. If it's replaced, a battle that was set out on the old picture plays on the plain board, with its own terrain, until that picture is uploaded again.
- **A width with no painting of its own:** the War Table redraws the nearest width's painting square by square and warns you to check fords, bridges and narrow paths. Painting at that width saves a separate painting.
- **Small token letters:** the S (Shaken), H (Holding), G (Held fast), L (Lieutenant) and C (Captain) badges are smaller than the suite's usual 12px text. Hovering over S, H or G says what it means; hovering over L or C shows the leader's name.
- **A quick second Confirm:** a second press of Confirm within about a third of a second is ignored, like every double click in the suite, so one press never counts twice.
- **Badges on units one behind the other:** side by side, a unit's badges never overlap its neighbour's. One square behind, a Shaken or Holding unit's top-right badge can partly cover the "+2" support badge of the unit in front, and an enemy Captain's disc can touch the pennant of the enemy below it. Keeping every badge inside its own square would cover the Cohesion bar or the name instead.
- **Fighting across a river's corner:** a river painted on a slant can't be crossed between its corners, but two units on opposite banks whose squares touch at a corner are still in melee, as "touching, side or corner" says. Say if a river should keep them apart.
- **Evidence:** `tools/bastion/war-ai.js` (placing guards), `war-table.js` and `war-table.css` (the map picture, terrain, badges), `war-battle-rules.js` (melee contact), `shared/js` (the double-click guard).

### BAS-50 · Problems found while checking war phase 2, fixed before release
**Must fix** (found while checking war mini-game phase 2, 2 October 2026; fixed) · breaks the tool

None of these reached Harry: they were found by the checks on the new code and fixed in the same pull request. The one that touches existing saves is the first.
- **War orders queued before phase 2 that shared forces:** phase 1 let two waiting war orders commit the same defenders. The first one queued lost its defenders and Lieutenants to the later one, and could lapse altogether → the first queued keeps its forces, later ones get what's left, and the muster pop-up and the log say when an order musters with less than it committed.
- **A saved enemy army redrawn while browsing:** looking through other targets and objectives could throw away a mission picked on an earlier turn and draw a new enemy with a fresh variation roll → a mission is kept by when it was last shown, so the one on screen is never redrawn.
- **Rivers and cliffs painted on a slant:** units stepped diagonally between two water or cliff squares that touch at a corner, and archers shot between two dense-woods or ridge squares the same way → neither gets through.
- **The enemy stuck at a river or cliff:** it stood on the bank all battle instead of walking round to a ford or gap → it walks round.
- **Enemy archers behind a ridge:** in range but with no clear shot, they held all battle → they move to a square with a clear shot.
- **A Raid guard ignoring the winning carrier:** a guard held by its marker while your carrier walked home with the winning supplies → every enemy unit goes after a carrier that would win the raid.
- **The enemy standing off:** in some Skirmishes the enemy held every activation and never attacked → it closes in by stages and attacks.
- **Enemy archers walking into melee** → they never move next to your units, and shoot instead.
- **Raid guards standing on their supply markers**, so the markers couldn't be collected → guards stand beside them.
- **Terrain lost:** bringing a map back mid-battle overwrote its saved painting, and changing the battlefield width wiped a one-square ford → each battle keeps its own ground, and each map keeps one painting per width.
- **Same names on both sides:** the log said things like "Line Infantry 2 attacks Line Infantry 2" → every enemy unit's name starts with its clan's ("Bacca Line Infantry 2").
- **Equal losses shown for a won or lost Skirmish:** the War Report rounded both armies' losses to whole percents → one decimal place, as the battle decided it.
- **A depleted regiment's stat block showed full strength** → it shows the strength it will actually fight at.
- **The Compendium's War Room units had copied numbers** that could drift from the battle's → they're read from `war-units-data.js`.
- **The War Table:** a selected unit showed no movement area; tokens could be left part-way along a move; the log stopped updating after 300 lines; the log was pushed out of view on the laptop; an uploaded map taller or wider than the board was cropped without a word; the depot's name and some badges were hidden under tokens; dragging onto an enemy gave a misleading message; Enter in the d20 box did nothing → all fixed. The War Table now says when a map's edges are hidden ("Edges hidden").
- **Pop-ups over the War Table:** "The conditions are unchanged" could appear again and again, and a "Bastion Turn left part-way" notice could sit over the table → each appears once, and notices close when the table opens.
- **Evidence:** `tools/bastion/war-battle-rules.js`, `war-ai.js`, `war-campaign-rules.js`, `war-table.js`, `war-table-rules.js`, `war-table.css`, `tool.js`; each fix has a test in `tests/rules/` or `tests/e2e/phase9.test.js` that fails on the code before it.

### BAS-51 · Couldn't attack an enemy your unit was already fighting
**Must fix** (Harry's report, 3 October 2026; fixed) · breaks the tool

- **Before:** With one of your units selected, clicking an enemy only showed that enemy's card. To attack, you had to press Advance & Attack first, or drag your unit to a lit square next to the enemy, which set the order up for you. A unit already in contact with the enemy has no lit squares to drag to. So an enemy that had moved next to it, or that it had already been fighting, seemed impossible to attack. The battle rules themselves never stopped it.
- **After:** With one of your units selected, clicking any enemy (or dropping your unit on it) sets up Advance & Attack on it, whether or not that enemy has acted or been attacked this round. It attacks from where it stands when it can; otherwise from the best square in reach (a shot for archers, then a Charge, then the most direct move), shown before you confirm. When it can't attack that enemy this activation, the table says why. For archers, one reason is the brief's rule that archers never shoot into a melee.
- **Evidence:** reproduced in the test browser (an engaged Line Infantry, then a click on the adjacent enemy that had acted: its card showed, and no attack was set up). `tools/bastion/war-table.js` (`attackEnemy`), `war-table-rules.js` (`attackFrom`, `noAttackText`); tests in `tests/rules/bastion-war-table.test.js` and `tests/e2e/war-table.test.js`.

### BAS-52 · The DM can move the supplies, the depot and the outpost while deploying
**Deliberate change** (Harry's request, 3 October 2026) · other

- **Before:** The supply markers (Raid), your supply depot (Defend Bastion) and the outpost (Seize Outpost) were placed by the War Table and couldn't be moved; only the enemy's units could, with DM: adjust enemy.
- **After:** While deploying, that button is **DM: adjust enemy & supplies** (or **& depot**, **& outpost**) and also lets you drag the objective:
  - a supply marker anywhere on the enemy's half, on a square troops can stand on, with no unit or other marker on it;
  - the depot or outpost as a block of the same size, wholly on its owner's half, with at least one square troops can stand on.

  A refused drop says why. A repaint while deploying keeps them where they were put, unless the new painting rules a square out.
- **Evidence:** `tools/bastion/war-battle-rules.js` (`canMoveObjective`, `moveObjective`), `war-table-rules.js` (`objectiveMoveRefusal`), `war-table.js`; `docs/WAR-RULES.md` section 5.

### BAS-53 · A battle briefing when the battle starts, and a Rules & objective button
**Deliberate change** (Harry's request, 3 October 2026) · other

- **Before:** The objective showed only as one line above the battlefield, and the rules were only in `docs/WAR-RULES.md`.
- **After:** After Start Battle, a briefing appears. Its sections:
  - How you win;
  - How you lose;
  - Today's conditions (the weather's effect, Morale and Luck);
  - Turns;
  - The six orders;
  - Fighting;
  - Morale.

  Every number comes from the data file. It fits the laptop and the TV without scrolling. The **Rules & objective** button at the top of the War Table shows it again at any time: before deployment, while deploying, or during the battle. Reopening a saved battle doesn't show it again.
- **Evidence:** `tools/bastion/war-table-rules.js` (`briefing`), `war-table.js` (`showBriefing`), `war-table.css`.

### BAS-54 · Problems found while checking Harry's three War Table changes, fixed before release
**Must fix** (found while checking BAS-51 to BAS-53, 3 October 2026; fixed) · other

None of these reached Harry: they were found by the checks on the new code and fixed in the same pull request.
- **Dropping a unit that can't move on the enemy it's fighting:** a unit held fast, boxed in, or with Advance & Attack already chosen was refused ("Disengage first … Choose an order instead") → letting go of it on an enemy sets up the attack, as a click does.
- **"Disengage first" for a unit that can't Disengage:** a unit held fast by a Grapple, or with no clear square to fall back to, was told to Disengage → it's told it can only fight the enemies next to it this activation.
- **Archers out of range blamed on the melee:** archers far out of range of an enemy that was fighting one of your units were told they "can't shoot into a melee" → the melee is only the reason when they could otherwise shoot; otherwise the table says it's out of reach.
- **Messages left over after the attack changed:** switching target named the old target, and Cancel, Esc, DM: pause, a good drop after a refused one, or a refusal followed by a good attack left the old message up for 6 seconds → the hint always matches what's on the table.
- **A second click on the chosen target** no longer un-picked it (it did before) → it un-picks it again, so the unit can advance without attacking.
- **The DM's objective moved by an unrelated repaint:** supplies, a depot or an outpost the DM placed out of reach on foot (or partly on deep water) were moved by any repaint, and the warning vanished → they stay where they were put unless the new painting rules their own square out, and the warning stays.
- **The DM buttons didn't light up:** DM: adjust enemy (and DM: pause) looked the same on and off → filled crimson while on.
- **The depot or outpost grabbed by its name label** jumped a row → it moves exactly with the pointer.
- **The briefing:** "Charge" said cavalry only (beasts with Charge charge too); the weather line didn't say Hardy units ignore it; once the enemy had withdrawn it named the enemy as acting first; and a briefing opened just as the battle ended was left on screen over the Bastion → all fixed.
- **Evidence:** `tools/bastion/war-table.js`, `war-table-rules.js`, `war-battle-rules.js`, `war-table.css`; each fix has a test in `tests/rules/bastion-war-table.test.js`, `tests/rules/bastion-battle.test.js` or `tests/e2e/war-table.test.js` that fails on the code before it.

### BAS-55 · Destroying the enemy army didn't win a Seize Outpost or a Raid
**Deliberate change** (Harry's report and ruling, 4 October 2026) · other

- **Before:** When the enemy army broke (60% of its Battle Value routed or defeated), what was left of it withdrew, but in a Seize Outpost you still had to hold the outpost at two round ends in a row, and in a Raid you still had to carry two supplies home, before round 6 ran out. Harry destroyed every enemy unit in a Seize Outpost and still lost.
- **After:** Breaking the enemy army wins at once, whatever the objective. What's left of it flees the field. A raid won that way pays its full gold. The objective lines, the briefing and the rulebook say so.
- **Evidence:** `tools/bastion/war-battle-rules.js` (`checkResult`), `war-campaign-rules.js` (`warRewards`); tests in `tests/rules/bastion-battle.test.js`.

### BAS-56 · Being at war with a Clan: a serious cost, an At War tag, and peace
**Deliberate change** (Harry's request, 4 October 2026) · other

- **Before:** Queueing a War Action cost nothing until the battle, and nothing showed that you were at war.
- **After:**
  - **Declaring war:** Queue War Action declares war on the target Clan, or renews it, and asks first. It costs Honour & Respect and Political Capital with that Clan at once, by the size of the army committed: −3 and −30 under 20 Battle Value, −4 and −40 from 20, −5 and −50 from 40.
  - **At War tags:** an **At War** tag shows beside the Clan's name wherever it appears in the Bastion.
  - **Peace:** the war ends after 6 Bastion turns with no battle between you, or with **Make peace** in the new Wars box.
  - **Cancelling:** cancelling a War Action on the turn it was queued gives the cost back.
  - **Defend Bastion** is no longer offered as a War Action (see BAS-57).
- **Evidence:** `tools/bastion/war-campaign-rules.js` (`declareWar`, `warsList`, `makePeace`, `tickWars`, `undoWarDeclaration`), `rules.js`, `tool.js`; `docs/WAR-RULES.md` "Being at war".

### BAS-57 · The Defend Bastion event, with Harry's coast map, and facilities Under Repair
**Deliberate change** (Harry's request, 4 October 2026) · other

- **Before:** Defend Bastion was a War Action you chose to queue.
- **After:**
  - **The attack:** while you're at war, every Advance Bastion Turn rolls a d6 for each Clan at war. On a 1 (at most one attack at a time), "Sound the horns! Clan … warships are approaching! Defend the Ironbow!" appears with crossed swords.
  - **The battle:** every free force defends, on Harry's coast map with its terrain painted. The battle can be put off with Later, but not called off.
  - **Losing or withdrawing:** you lose 1d10 × 5% of the treasury, and 1d4 random facilities are **Under Repair** for 2 Bastion turns (this one included). While under repair they take no orders, and orders already running there wait.
  - **Undefended:** if nobody is free to defend, the attack succeeds at once.
- **Evidence:** `tools/bastion/war-campaign-rules.js` (`rollWarAttack`, `beginDefence`, `finishUndefended`, `finishBattle`), `rules.js` (repairs), `tool.js`, `war-table.js` (`presetMap`); the map is `tools/bastion/assets/war/defend-bastion-coast.jpg`.

### BAS-58 · Weather films over the War Table
**Deliberate change** (Harry's request, 4 October 2026) · other

- **Before:** The battle's weather showed only as a word in the War Table's header.
- **After:** In a snowstorm, rainstorm or heatwave, the Explorer's matching weather film loops over the battlefield, under the tokens. It's for show only. **Weather: On / Off** turns it off and on (remembered), and it starts off when Windows' reduced-motion setting is on.
- **Evidence:** `tools/bastion/war-table.js`, `war-table.css`; the films are the Explorer's `tools/explorer/assets/overlays/*.mp4`. The test browser can't play MP4 files, so only the film's element was checked; seeing it play is on Harry's checklist.

### BAS-59 · Problems found while checking the war changes of 4 October, fixed before release
**Must fix** (found while checking BAS-55 to BAS-58, 4 October 2026; fixed) · breaks the tool

None of these reached Harry.
- **Repairs lasted 3 turns, not 2** → a facility lost on turn 5 works again on turn 7.
- **A second Clan's attack while the first waited took the Bastion with no battle** (the army was counted as busy with the first) → no new attack is rolled while one is waiting.
- **Cancelling a War Action and queueing it again charged the war's cost twice** → cancelling on the turn it was queued gives the cost back.
- **Opening the coast map changed the DM's saved battlefield width** → the width he chose is kept.
- **The undefended attack's pop-up gave a false reason** → it says nobody is free to defend.
- **Smaller things:** the Watchtower's Patrol was forgotten in a defence (now a reminder in the pop-up and the War Council); the At War tag flickered in the cost line; "Clan MOLTEN" in capitals had no tag; the rulebook's Defend Bastion rewards were out of date → all fixed.
- **Evidence:** the files above; each fix has a test in `tests/rules/` or `tests/e2e/`.

### BAS-60 · The Bastion counts in days, following the Explorer's day
**Deliberate change** (Harry's brief and answers, 8 October 2026; plan in `docs/BASTION-OVERHAUL.md`) · other

- **Before:** **Advance Bastion Turn (+7 days)** moved the Bastion on a week at a time. Every order completed the next turn, and everything else counted in turns.
- **After:** there are no turns. The Explorer's day is the campaign's only clock. The Bastion reads it when it opens and every 2 seconds while open, passes each new day in turn, and never changes it. A day passes in this order, saved after each step so a closed window never loses or repeats anything: repairs and recoveries due end, and building due completes; contracts send their shipments and sea routes settle; orders due complete (asking for rolls where they need them); a Clan at war rolls to attack; every 28th day brings the Bastion event; then "The Ironbow sends word…" lists the day's news, which the **Day Log** (was the Turn Log) keeps. Each rule that changed:
  - **Facility orders:** each takes its own number of days (shown on its card as "Takes N days"); the pending list says "Due Day N (in N days)".
  - **Building a facility:** 21 / 28 / 35 / 35 days at required levels 5 / 9 / 13 / 17 (was 3 / 4 / 5 / 5 turns).
  - **A cancelled roll** leaves the order "Due now: waiting for your roll", with a **Resolve** button; it was "waits until next turn".
  - **Finish Day** (was Finish Bastion Turn) shows only when a day was left part-way, for example by closing Edge mid-roll; the Bastion also finishes it by itself when it next opens.
  - **Trade Agreement:** its Duration choice (1, 3 or 6 weeks) now counts (it was ignored: BAS-21), ± the roll's tier in weeks (+2 to −2, at least 1 week). It sends a shipment every 7 days from the day it was signed, the last on its final day. The Hall shows "X days remaining (Y shipments)".
  - **Delegations, summits, writs and consortiums:** 14 / 21 / 28 / 35 days ± 14 / 7 / 0 / −7 / −14 days (was 2–5 turns ± turns). Writs and consortiums pay every 7 days from their start.
  - **Sea routes:** settle every 7 days from the day each opened (the Hall's **Resolve** settles those due), and last 35 days (was 5 turns).
  - **Hall cooldown** after a bad failure: 14 days (was 2 turns). **Trade Network investments:** Stability and Yield 7 days, Routing Doctrine 1 day.
  - **Watchtower Patrol:** Advantage for the 7 days after it completes (was "this turn").
  - **A War Action** musters 3 days after it's queued (was next turn). Cancelling it **the same day** gives its cost back (was the same turn).
  - **Wars:** a d6 for each Clan at war every 7 days of that war, counted from the day it was declared (was every turn for every war); a war ends after **42 days** without a battle (was 6 turns).
  - **Repairs** after a lost defence: **14 days**, the day of the loss included (was 2 turns). **Wounded Lieutenants and beasts:** back after 7 / 7 / 14 / 21 days (was 1 / 1 / 2 / 3 turns), logged on the day.
  - **The Bastion event:** every 28 days, on Days 29, 57, 85… (was every 4th turn). The last event stays on screen until the next.
  - **Reset Travel** in the Explorer moves every Bastion day back with it, so an order due in 4 days is still due in 4 days.
  - **Founding a Clan** saves the day it was founded instead of the turn (it isn't shown anywhere yet, as before).
- **Evidence:** `tools/bastion/rules.js` (the day engine: `startDay`, `finishRoutes`, `finishDay`, `clockAction`, `shiftDays`, `anchor`, `upcoming`), `tools/bastion/war-campaign-rules.js` (`attackEvery`, `rollWarAttack`, repairs and recovery in days), `tools/bastion/data/bastion-data.js` (`time`), `data/facilities-data.js` (each order's `days`), `data/war-units-data.js` (`quietDays`, `attackEvery`, repairs), `tools/bastion/tool.js`; the rules in days are in `docs/WAR-RULES.md`; tests in `tests/rules/bastion.test.js`, `tests/rules/bastion-campaign.test.js`, `tests/e2e/phase9.test.js` and `tests/e2e/bastion-days.test.js`.

### BAS-61 · A Bastion saved in turns is set aside, and the side-by-side check against the old Bastion is retired
**Deliberate change** (Harry's answer 14, 8 October 2026) · other

- **Before:** The rebuilt Bastion kept the old Bastion's save format, and its click-through test played the same 12-turn campaign in the old Bastion and the rebuild with the same dice, comparing the saves at every step.
- **After:**
  - **Harry's Bastion saved in turns** is set aside the first time the new version opens (kept in the browser, not deleted, and included in Back up everything), with a notice saying so. A new Bastion starts on the Explorer's day. There's no turn-to-day conversion.
  - **A Bastion-only file exported before the change** is refused on import: "This file is from before the Bastion counted in days, so it can't be imported. Nothing was changed." A whole-suite backup from before restores as normal, and its old Bastion is set aside the same way when the Bastion next opens.
  - **The side-by-side run** against the old Bastion is retired, because the rules now deliberately differ (as the war's already did). The two-window test (`tests/e2e/bastion-days.test.js`) and the day-by-day checks in `phase9.test.js` take its place.
- **Evidence:** `tools/bastion/rules.js` (`isOldSave`, `saveProblem`, `importProblem`), `tools/bastion/tool.js`, `shared/js/store.js` (`quarantine`); tests in `tests/rules/bastion.test.js` and `tests/e2e/phase9.test.js`.

### BAS-62 · Problems found while building the days overhaul, fixed before release
**Must fix** (found while building, 8 October 2026; fixed) · breaks the tool

None of these reached Harry.
- **The first camp's day wasn't passed at the Bastion** when the Explorer had never saved (a brand-new Explorer saves only when something changes, so the Bastion first saw it on Day 2 and started counting from there) → the Explorer saves as soon as it first opens.
- **Two Bastions set aside in the same second** kept only the second → SUI-24.
- **Evidence:** `tools/explorer/tool.js`, `shared/js/store.js`; tests in `tests/e2e/bastion-days.test.js` and `tests/e2e/phase9.test.js`.

### BAS-63 · Three Bastion events still said "your next Bastion turn"
**Deliberate change** (Harry's answer, 8 October 2026; was *Later, Harry's call*) · other

- **Before:** Three of the rulebook's Bastion events (a special facility shutting down, a hireling with a criminal past, and hirelings leaving) said the facility "can't be used on your next Bastion turn", though the Bastion counts in days since the overhaul.
- **After:** they say the facility "can't be used for the next 7 days". It's the events' text only: the Bastion still doesn't stop that facility's orders by itself (still Harry's call, if he wants it to).
- **Evidence:** `tools/bastion/data/events-data.js` lines 68, 71 and 90.

### BAS-64 · The Bastion's new screen: the map fills the window, and everything else opens over it
**Deliberate change** (Harry's brief, 8 October 2026; the overhaul's Build 2, `docs/BASTION-OVERHAUL.md` section 5) · other

- **Before:** One long page that scrolled: the Favour of the Gods column on the left, then the Day Log, the map and the Bastion Event, then Party Identity, Management, the War Council, Diplomacy & Trade, the Warehouse and Artisan Tools, and the Facilities card with its construction slots, pending orders and a carousel of facility cards.
- **After:**
  - **A slim header:** the wordmark, Party Level, Compendium, Reset and the save buttons.
  - **The map fills the rest of the window** and never scrolls: about 940 × 627 on the laptop and 1165 × 777 on the TV (it was about 700 × 470). It's fitted, never cropped, so the building overlays line up.
  - **The top bar:** the day (with Finish Day for a day left part-way); the treasury with a coin, saved when you press Enter or leave the box (not on every key); Facilities and Orders counts, each with a hover list. Clicking Facilities opens Construction, and clicking Orders opens all the pending orders. Anything Under Repair is listed here too.
  - **The Party Identity badge,** top right of the map: the crest once a Clan or Brigade has one, otherwise a faint shield. It opens the Party Identity panel. Build 3 reworks the crest itself.
  - **The bottom bar:** the facility grid, between Warehouse, Management, Day Log and Events on the left and Clan Influence, Favour and the War Council on the right. The grid folds away with ▼ to show more of the map, and stays folded after reopening. This replaces the old panels' ▾ arrows (BAS-16).
  - **The grid:** the five starting facilities (Workshop, Barracks, Watchtower, Dock, Armoury), then the six construction slots. Each kind of tile behaves differently:
    - **Built:** opens its panel; hover shows its level and the orders pending there, and a small number counts them.
    - **Being built:** an hourglass and the days left; not clickable.
    - **Under Repair:** dimmed, with a hammer.
    - **Free slot:** opens Construction.
    - **Locked slot:** a padlock, with the level it opens at.
    - **Over capacity:** marked with "!".
  - **Construction:** every facility not built or being built, with its painting. Locked ones are dimmed. Hover shows what it does and how many days it takes. Choosing one asks "Construct the Smithy? It takes 21 days." Clear extra builds is at its foot.
  - **A facility's panel:** its painting, level and status, the orders pending there (with Cancel and Resolve), then its orders with their days. The Workshop's panel holds the Artisan Tools. The Hall of Emissaries' tile opens Diplomacy & Trade.
  - **The other panels:**
    - **Warehouse.**
    - **Management:** defenders, beasts and military; no treasury.
    - **Day Log.**
    - **Bastion Events:** Roll Bastion Event, the last event and when the next is due.
    - **Clan Influence:** one row per Clan with its Political Capital bar (and Honour Change), its Honour/Respect and its support, then the Favour Tokens. These were split between the left column and Party Identity.
    - **Favour of the Gods.**
    - **Banner & War Council.**

    Each opens as a pop-up over the map: one at a time, and Esc or Close closes it. Every panel's contents are as before.
  - **The War Council is locked** until the Bastion has something that can fight: a defender, a beast or a War Room unit (Harry's answer 6). It stays open while any part of a war is going on, so an attack can always be fought. The padlock's tooltip says how to unlock it.
  - **The War Table** still opens over everything; an open panel closes first.
  - **What the screen remembers** (`tsi.bastion.ui`): whether the grid is folded, and the war pop-ups already seen. The old panels' open-or-closed settings are dropped.
- **Evidence:** `tools/bastion/tool.js` (panels: `openPanel`, `openFacility`, `openBuild`, `renderGrid`, `renderCounts`, `fitMap`), `tools/bastion/bastion.css`, `tools/bastion/rules.js` (`cleanUi`), `tools/bastion/war-campaign-rules.js` (`warCouncilOpen`); tests in `tests/e2e/bastion-screen.test.js` (new), `tests/e2e/phase9.test.js`, `tests/rules/bastion.test.js` and `tests/rules/bastion-campaign.test.js`.

### BAS-65 · Problems found while building the new screen, fixed before release
**Must fix** (found while building, 8 October 2026; fixed) · breaks the tool

None of these reached Harry.
- **Esc in the War Room's unit list closed the whole War Room panel**, not just the list → Esc closes the list first.
- **Esc on a box showing its stat block (a War Action's forces) closed the War Council** → Esc hides the tooltip first (SUI-25).
- **A facility still being built that was over capacity** (after lowering the party level) had no "over capacity" mark → it has one.
- **The Hall of Emissaries' panel opened narrower than intended** → full width.
- **Evidence:** `tools/bastion/tool.js`, `shared/js/tooltip.js`, `tools/bastion/bastion.css`; tests in `tests/e2e/phase9.test.js`.

### BAS-66 · The Mercenary Brigade and the old single-roll war are archived
**Deliberate change** (Harry's brief, 8 October 2026; the overhaul's Build 3, `docs/BASTION-OVERHAUL.md` section 3) · other

- **Before:** Party Identity offered Form Clan and Form Mercenary Brigade (level 7, 3 defenders). A Brigade had Trusted Clients (0 to 100 for each Clan), changed after every battle and listed in the War Report, and could commit Lieutenants and regiments like a Clan. The rules still held the war's old single roll (`R.warCommit`, `R.queueWarAction`, `R.warPlan`, `R.resolveWar`, `R.removeBeasts`), which nothing had used since the War Table came.
- **After:**
  - The party is Unsworn or a Clan. Only a Clan commits Lieutenants and regiments; the War Council's boxes say "Clan only" and "Only a Clan can commit Lieutenants and Regiments.". The requirements line is the Clan's alone. Battles no longer change Trusted Clients, and the War Report has no Trusted Clients line.
  - **Kept aside, not deleted:** all of it, as working code, in `tools/bastion/archive/mercenary-brigade.js`, with its ten tests in `tests/archive/mercenary-brigade.test.js`. Both are loaded by nothing; the note at the top says how to put them back. They were run once with the archive loaded, and all ten passed.
  - **Saves:** every save still carries the Trusted Clients scores (unread), so putting the Brigade back loses nothing. A Brigade saved in Builds 1 or 2 loads as Unsworn; the Bastion says so once as it opens, and the Day Log keeps the Brigade's name. A War Action it was still waiting on keeps its defenders and beasts; its Lieutenants and regiments stay home when it musters, and the log says only a Clan can send them (an order with nothing else lapses, saying so).
  - **Data:** the Brigade's level 7 and 3 defenders, and the single roll's DCs, moved from `bastion-data.js` to the archive.
- **Evidence:** `tools/bastion/rules.js` (`fromSave`, `R.formerBrigade`, `orgLabel`, `requirementsHint`), `tools/bastion/war-campaign-rules.js` (`warForces` fullWar, `warRewards`, `applyRewards`, `rewardLines`), `tools/bastion/data/bastion-data.js`, `tools/bastion/tool.js`; tests in `tests/rules/bastion.test.js`, `tests/rules/bastion-campaign.test.js`, `tests/e2e/phase9.test.js`.

### BAS-67 · The crest belongs to the Bastion, at any time; Party Identity reworked
**Deliberate change** (Harry's brief, 8 October 2026; the overhaul's Build 3, `docs/BASTION-OVERHAUL.md` section 4) · other

- **Before:** Only a Clan or Brigade could have a crest, chosen in Form Clan or Form Mercenary Brigade (or added afterwards), by downloading the PNG from the Crest Creator and uploading it. Founding without choosing one removed any crest. The War Table showed the crest only for a Clan or Brigade. The badge showed "Party Identity" or the name.
- **After:**
  - **The crest is the Bastion's,** Unsworn or a Clan, and forming a Clan keeps it. Party Identity shows it large, with **Create in the Clan Crest Creator ↗** (opens the Creator in a new window, or says it's already open), **Upload a picture…** and **Remove** (which asks first).
  - **From the Creator:** its new Use for the Bastion button sends the crest (SUI-26, CRS-16). The Bastion asks "Use this crest for the Bastion?", showing it: at once if it's open (once no day is being passed and the War Table is shut), or as it next opens. Either answer clears it, so it's asked once. A crest from the Creator keeps the Creator's design with it (as `design` inside the crest record, `tsi.bastion.crest`), so it can be re-edited later.
  - **The badge:** the crest, or a faint dashed shield and "Add a crest". Under the crest: the Clan's name, or "Unsworn". Its spoken name is "Crest of the Ironbow", then "Crest of <Clan>".
  - **Party Identity:** the status pill (Unsworn, or "Clan: name" with the chief, the motto and the day it was founded), Found a Clan with its requirements (until there's a Clan), and Clan Honour (only for a Clan).
  - **Form Clan's crest box** shows the Bastion's crest: **Create a new one ↗**, **Upload…** (used only when the founding is confirmed), and **Keep this crest** to go back to it. Cancel changes nothing.
  - **The War Table** has the crest on your tokens whether or not a Clan is formed; the army is "Your forces" until there's a Clan.
- **Evidence:** `tools/bastion/tool.js` (the crest and Party Identity sections, `renderBadge`, the War Table's options), `tools/bastion/bastion.css`, `R.isCrest` and `R.crestFromHandoff` in `tools/bastion/rules.js`; tests in `tests/rules/bastion.test.js`, `tests/e2e/phase9.test.js` ("The crest, at any time"), `tests/e2e/bastion-screen.test.js` and `tests/e2e/phase2.test.js`.

### BAS-68 · Problems found while building Build 3, fixed before release
**Must fix** (found by the review and the tests, 8 October 2026; fixed) · breaks the tool

None of these reached Harry.
- **The Bastion closed while asking about a sent crest** threw the crest away → it's kept, and asked about next time.
- **"Create in the Clan Crest Creator ↗" seemed to do nothing** when the Creator was already open: its message was a corner notice, hidden under the pop-up's dark backdrop → the message shows inside Party Identity, or the Form Clan box.
- **In Form Clan, a picture uploaded first overrode a crest from the Creator accepted afterwards** → the crest just accepted replaces the upload.
- **Days passed underneath the crest question** (opening the Bastion after several camps), so a roll or even the War Table could open under it → no day passes while it's open; they pass once it's answered.
- **A former Brigade's waiting War Action** with Lieutenants or regiments lapsed, saying "nothing committed to it is still free to march", which wasn't why → the log and the muster say only a Clan can send them (and the Bastion says so as it opens).
- **Form Clan's "Create a new one ↗"** shared its test name with Party Identity's button → its own name (`crest-new`).
- **After Remove, Keep this crest or founding a Clan,** the button that had the focus disappeared and the focus dropped out of the panel → it stays in the panel (Upload, or Clan Honour).
- **The one-time "Mercenary Brigade … is no more" notice** stayed until dismissed, over the Clan Influence, Favour and War Council buttons → it goes after 20 seconds (the Day Log keeps it).
- **Every Bastion notice** (since Build 2's screen) sat in the bottom-right corner, over those same buttons (and, raised, over the DM doc's corner on the TV) → on the Bastion's screen they sit on the left, just above the bottom bar, clear of its buttons, the crest badge and the DM doc. The War Table places them as before.
- **With two Bastion windows,** after one took a crest the other closed its question but kept showing the old crest → it reads the crest just saved.
- **A crest sent that wasn't really a picture** (only possible by hand) would be offered and saved, showing as a broken picture → it's dropped unless it loads as a picture.
- **With two Bastion windows** (which "Already open" warns about), answering the crest question in one left it open in the other, which could still take the crest → the other window's question closes. A newer crest sent while it's asking takes its place.
- **Evidence:** `tools/bastion/tool.js` (`checkCrestOffer`, `openCreator`, `crestField`, `checkClock`, `onRemoveCrest`, `onFormClan`), `tools/bastion/war-campaign-rules.js` (`R.clanOnlyCut`, `beginMilitaryAction`, `musterShortfall`); tests in `tests/e2e/phase9.test.js`, `tests/e2e/bastion-screen.test.js` and `tests/rules/bastion-campaign.test.js`.

### BAS-69 · The Bastion map is Harry's new painting
**Deliberate change** (Harry, 13 October 2026: the first step of the facilities overhaul, decisions D9 and D10) · other

- **Before:** The map was the old 1152 × 768 painting (3:2) with eight overlays, matched to facilities by file name. The Shrines never showed (BAS-19).
- **After:** Harry's new 3000 × 1250 painting (2.4 : 1), fitted whole into the map area on every screen. Which facility shows which overlay is a table in `bastion-data.js` (`map`):
  - the Library, War Room, Hall of Emissaries and three Shrines show their own;
  - the Laboratory and the Arcane Study share the Laboratory painting, and the Garden and the Greenhouse share the Greenhouse painting, since each pair will merge (each shared picture is drawn once, darkened if either is Under Repair);
  - the Smithy, Gaming Hall and Menagerie have no picture.

  The seven pictures for the new facilities are in place for when those facilities exist. *Since the facilities overhaul's first step (BAS-71), each merged facility has its own picture (the Arcane Laboratory the Laboratory's, the Herbal Gardens the Greenhouse's), so nothing shares one.* Overlays are now drawn in the table's order, not build-slot order (no two overlap). The crest badge sits over the painting's sky, clear of the Hall of Emissaries, on every screen size; since 13 October (Harry's check in Edge) it sits inside the painting's own frame, so it never meets the edge of the map panel. The old map and overlays are in `tools/bastion/assets/extras/old-map/`.
- **Evidence:** `tools/bastion/data/bastion-data.js` (`map`), `tools/bastion/rules.js` (`R.mapOverlays`), `tools/bastion/tool.js` (the map and `fitMap`); tests in `tests/rules/bastion.test.js`, `tests/e2e/bastion-screen.test.js` and `tests/e2e/phase9.test.js`.

### BAS-70 · Facilities can be demolished, and building stopped
**Deliberate change** (Harry, 13 October 2026) · other

- **Before:** A built facility could only be removed with **Clear extra builds**, which emptied every slot at once (and left their pending orders running). A facility being built couldn't be stopped.
- **After:** Each facility in a construction slot has **Demolish…** at the foot of its panel (the Hall's is beside **Clear Diplomacy Records**). It asks first, then frees the slot, cancels the orders pending there (no gold back, as with Cancel: B9), and drops its level and any repairs. What it already made stays (the Warehouse, defenders, beasts, War Room units), and the Hall's agreements, contracts and routes carry on. Clicking a facility still being built offers to stop building it. The five starting facilities can't be demolished. **Clear extra builds** is unchanged.
- **Evidence:** `tools/bastion/rules.js` (`R.demolishFacility`), `tools/bastion/tool.js` (`onDemolish`, the facility panel, the Hall's footer, the building tile); tests in `tests/rules/bastion.test.js` and `tests/e2e/bastion-screen.test.js`.

### BAS-71 · The facilities overhaul, step 1: 22 facilities, three merges, the Gaming Hall gone
**Deliberate change** (Harry, 13 October 2026: the facilities overhaul handover V4, decisions D1 to D4) · other

- **Before:** 18 facilities. The Arcane Study and Laboratory, the Garden and Greenhouse, and the Library were separate; the Smithy and Gaming Hall could be built.
- **After:** 22 facilities.
  - **Merged:** the Arcane Study and Laboratory are the **Arcane Laboratory** (level 5; the Laboratory's Craft is now its **Alchemy**, which needs party level 9). The Garden and Greenhouse are the **Herbal Gardens** (level 5; the Greenhouse's Harvest is now **Greenhouse Harvest**, which needs party level 9). The Library is the **Library & Scriptorium**. Their orders, options and days are unchanged.
  - **The Smithy joined the Workshop:** a Bastion that had a Smithy built keeps its Craft list as the Workshop's **Smithing**; a new Bastion doesn't have it.
  - **The Gaming Hall is gone** (D2).
  - **Eight new facilities** are listed in Construction as **In development** and can't be built yet: Fishery & Smokehouse, Timber Yard & Sawmill, Stone Quarry & Masonworks, Weavers' Hall, Courier Exchange, Wyvern Roost, Griffin Tower and Dire Wolf Den (D4: listed, not hidden). Each becomes buildable in its own later step. Their tiles show their building cut from Harry's map painting; the Courier Exchange had no art yet, so its tile showed its name. *Since 13 October 2026 it has Harry's own picture and map overlay (`bastion-new-art/3-courier-exchange`).*
  - **No facility takes 28 days to build now:** build time still follows the facility's level (21 / 28 / 35 days), and the two level-9 facilities (Laboratory, Greenhouse) merged into level-5 ones. Their level-9 orders still need party level 9.
  - The old pictures of the Arcane Study, Garden, Smithy and Gaming Hall moved to `tools/bastion/assets/extras/facilities/`.
- **Evidence:** `tools/bastion/data/facilities-data.js`, `tools/bastion/data/bastion-data.js` (`facilityImages`, `facilityTileCrops`, `retiredFacilities`, `map`), `tools/bastion/rules.js` (`R.startBuild`, `R.fnAvailable`, `R.issueOrder`), `tools/bastion/tool.js` (`facArt`, the Construction panel, the facility panel), `shared/js/campaign-rules.js` (`FACILITY_NAMES`); tests in `tests/rules/bastion.test.js`, `tests/e2e/bastion-screen.test.js` and `tests/e2e/phase9.test.js`.

### BAS-72 · A Bastion saved before the overhaul is converted once, with a copy kept
**Deliberate change** (Harry, 13 October 2026: D5, and the planning review's "strict migration") · saving

- **Before:** A Bastion save (v 2) names the old facilities. Loaded as it was, a facility the Bastion no longer knows would vanish, and so would its repairs and its pending orders, silently.
- **After:** The first time the Bastion opens a v 2 save (from the browser, or from an imported file), it:
  - sets an untouched copy aside first (in **Back up everything**, under "set aside");
  - converts it, before anything tidies it: each old facility moves to its new one, keeping its slot, building work and days, pending orders (their costs and due days kept; a Laboratory Craft becomes Alchemy, a Greenhouse Harvest becomes Greenhouse Harvest, a Smithy Craft becomes the Workshop's Smithing), level (the higher of a merged pair) and repairs (the later of a pair);
  - if both halves of a merge were built, keeps one (the built one, else the first to be ready) and frees the other slot;
  - frees the Smithy's slot (its order joins the Workshop) and the Gaming Hall's (its pending Trade order, which cost nothing, is cancelled; the Gaming Hall is recorded in the save's `archivedFacilities`);
  - says what changed, once, in a notice and a **Facilities** entry in the Day Log, and saves it as v 3.
  Opening it again changes nothing. A Smithy or Laboratory under repair doesn't pass its repairs to the Workshop (a starting facility). The Explorer's DM doc and "The Ironbow sends word…" read both v 2 and v 3 saves.
- **Evidence:** `tools/bastion/rules.js` (`R.migrateToV3`, `R.fromSave`, `R.isOldSave`), `tools/bastion/tool.js` (opening the Bastion: the set-aside copy and the notice), `shared/js/campaign-rules.js` (`inDaysSave`); tests in `tests/rules/bastion.test.js` and `tests/e2e/phase9.test.js`.

### BAS-73 · The facilities overhaul, step 1b: every facility has Levels 1 to 5
**Deliberate change** (Harry, 13 October 2026: decisions D6 to D8) · other

- **Before:** Only the Hall of Emissaries had levels (1 to 3), raised by its own **Upgrade Hall** order (14 days each, free). Every other facility sat at Level 1.
- **After:**
  - **Levels:** every facility goes from Level 1 to 5. Its panel shows "Level N of 5", and an **Upgrade** box comes first among its orders.
  - **The Upgrade order:** an ordinary pending order (it shows under "Orders pending here", can be cancelled, and is cancelled if the facility is demolished). It takes **7 / 14 / 21 / 28 days** to reach Level 2 / 3 / 4 / 5, and **no gold** for now (D8); both are one table in `bastion-data.js` (`levels`).
  - **Limits:** one upgrade at a time per facility, none at Level 5, none while Under Repair (D6), and an upgrade already running waits for repairs like any order. It doesn't stop the facility's other orders.
  - **The Hall** uses the same Upgrade (its **Upgrade** button beside the level badge). So reaching Level 2 now takes 7 days, not 14, and Level 3 takes 14. Its roll bonus stays +2 / +4 / +6, and +6 at Levels 4 and 5 (D7); its Level 2 and 3 actions unlock as before. An **Upgrade Hall** already ordered in a save still completes. The old order can't be given again.
  - **What a level does:** nothing yet, apart from the Hall's existing bonus and actions. New orders unlocked by levels come with each facility's own later step.
  - "The Ironbow sends word…" says when an upgrade is complete, the Hall's included (no roll needed).
- **Evidence:** `tools/bastion/data/bastion-data.js` (`levels`), `tools/bastion/rules.js` (`R.getFacilityLevel`, `R.upgradeCheck`, `R.issueUpgrade`, `R.completeUpgrade`, `R.upgradeHall`, `R.fnAvailable`, `R.orderKind`, `R.completeSimpleOrder`), `tools/bastion/tool.js` (`upgradeRow`, `onUpgrade`, the Hall's Upgrade button), `shared/js/campaign-rules.js`; tests in `tests/rules/bastion.test.js`, `tests/rules/campaign.test.js`, `tests/e2e/bastion-screen.test.js` and `tests/e2e/phase9.test.js`.

### BAS-74 · The facilities overhaul, pull request 2: research, with the Herbal Gardens tree first
**Deliberate change** (Harry, 13 October 2026: his research rules, and the Herbal Gardens document as a first attempt) · other

- **Before:** Facilities had no research.
- **After:**
  - **The rules (Harry's):**
    - research opens at Level 2;
    - a facility earns one research token for each level from 2 to 5 (four in all);
    - a tree has four branches of three stages, with two choices at each stage, and only one can be taken;
    - a stage opens once the stage before it on its branch is done;
    - Stage I takes 7 days, Stage II 14 and Stage III 21, and each costs that branch's gold (the document's prices: Agricultural 150 / 350 / 750 gp, Herbal Medicine 200 / 450 / 950, Botanical 200 / 500 / 1,100, Commercial 250 / 600 / 1,300);
    - one project runs at a time at a facility, and only tokens gate the stages (no level gates).
  - **A project is an ordinary pending order:** it takes a token while it runs, waits under repair, and Cancel or Demolish stops it.
  - **Undo:** undoing a researched stage frees its token, and the stages above it on that branch go too. Neither Cancel nor Undo gives the gold back (B9).
  - **The Herbal Gardens tree** holds all 24 choices from the document. The 9 that work with today's orders can be researched:
    - faster orders: the biggest saving applies, never under 2 days;
    - bigger Rations and Antitoxin batches: the biggest yield applies, rounded up;
    - 4 antitoxin vials;
    - Potions of Healing and Greater Potions of Healing two at a time.
  - **The other 15 say "Coming later"** and what they wait for: the goods catalogue (PR 3), the Explorer link's hero conditions (PR 4), or trade in goods (PRs 3 and 5).
  - **Combining bonuses:** Agricultural yields and Improved Antitoxins combine. Antitoxin starts at 4 vials, then grows by the biggest yield, so it's 8 vials with Bountiful Harvests.
  - **On screen:** the facility panel has a **Research** box after **Upgrade**, showing its tokens and any project running. **Open Research** shows the four branches side by side; hover over a choice for its full text, example and what it works on now.
  - **What waits:** the Herbal Gardens' five level orders (Harvest Common Herbs & Provisions … Advanced Botanical Production) come with the goods catalogue (PR 3), as Harry chose. Today's Harvest and Greenhouse Harvest are unchanged until then. *Since pull request 3: the level orders are in, and 12 choices can be researched (BAS-77).*
- **Evidence:** `tools/bastion/data/research-data.js`, `tools/bastion/data/facilities-data.js` (the Herbal Gardens items' `key` and `batch`), `tools/bastion/rules.js` (Research: `R.researchTokens`, `R.researchCheck`, `R.startResearch`, `R.completeResearch`, `R.undoResearch`, `R.orderDaysAt`, `R.researchOutput`, `R.cleanResearch`), `tools/bastion/tool.js` (`researchRow`, `renderResearch`, `onResearch`, `onUndoResearch`); tests in `tests/rules/bastion.test.js` and `tests/e2e/bastion-screen.test.js`.

### BAS-75 · The facilities overhaul, pull request 3: Development Plots
**Deliberate change** (Harry's facility guide, "Ironbow Facilities: Recommended Decisions", 13 October 2026) · other

- **Before:** Every facility the party built went in one of the six construction slots (2 / 4 / 5 / 6 at party levels 5 / 9 / 13 / 17).
- **After:**
  - **Development Plots,** a second set of building spaces only for the six production facilities: the Herbal Gardens, Fishery & Smokehouse, Timber Yard & Sawmill, Stone Quarry & Masonworks, Weavers' Hall and Courier Exchange. There are **none at party levels 1 to 8, 2 at 9 to 12, 4 at 13 to 16 and 6 at 17 to 20** (one table in `bastion-data.js`, `developmentPlots`). The other facilities still use the construction slots, which are unchanged.
  - **The grid** shows the plots in their own row, below the starting facilities and the slots (see BAS-78). An empty plot has a sprout; a locked one says the party level it opens at. Opening Construction from a plot lists the production facilities first; each is marked with a sprout and says "Plots open at party level 9" or "No free plot" when it can't be built.
  - **A production facility can only be built on a plot,** and any other facility only in a slot. Each takes 21 days to build, like the Herbal Gardens.
  - **An Herbal Gardens already in a construction slot** (built before plots existed) moves to the first free plot as soon as there is one, keeping its level, its orders, its research and any building work. It is never removed for lack of room. When the Bastion opens, a notice and a **Development Plots** entry in the Day Log say so; when the party level rises, a **Development Plots** entry; when a plot is freed by Demolish or Stop building, that entry says so. Harry's sample file (party level 13) shows this.
  - **Lowering the party level** keeps every facility on a plot working, marked over capacity, as slots already do (BAS-04).
  - **Demolish** and **Stop building** say "its plot is freed". **Clear extra builds** in Construction now clears the plots too.
  - The Explorer's DM doc and "The Ironbow sends word…" see buildings on plots finishing.
- **Note for Harry:** the Herbal Gardens can no longer be built below party level 9, because there are no plots before then. One already built stays where it is until a plot opens.
- **Evidence:** `tools/bastion/data/bastion-data.js` (`developmentPlots`), `tools/bastion/data/facilities-data.js` (`plot: true`), `tools/bastion/rules.js` (`R.plotsForLevel`, `R.plotRows`, `R.startBuild`, `R.settlePlots`, `R.facilityPlace`, `R.demolishFacility`, `tidyPlots`), `tools/bastion/tool.js` (`plotTile`, `renderGrid`, `renderBuild`), `shared/js/campaign-rules.js` (`bastionComing`); tests in `tests/rules/bastion.test.js`, `tests/e2e/bastion-screen.test.js` and `tests/e2e/phase9.test.js`.

### BAS-76 · Pull request 3: goods in the Warehouse, and the Timber Yard and Fishery working
**Deliberate change** (Harry's facility guide, 13 October 2026) · other

- **Before:** The Warehouse only held rows typed by hand or added by name. The Timber Yard & Sawmill and the Fishery & Smokehouse were listed "In development".
- **After:**
  - **A goods catalogue** (`tools/bastion/data/goods-data.js`): the guide's 17 trade goods, counted in **lots** with a base value per lot (for example Raw Timber, 1 lot = 20 logs, 100 gp); four crafting ingredients counted in **portions**; and the Expedition Provision Pack, counted in **packs** (10 character-days of rations, a party of five for two days). Edit the numbers there to rebalance.
  - **Goods in the Warehouse:** a good has its own row, which shows its name, what one lot holds, its count, its value (the base value; it isn't gold until trade comes in a later pull request) and notes. Only the count and the notes can be changed by hand. A good that's used up keeps its row, at 0, until the DM removes it (so an order never leaves the Warehouse empty, which would bring back the "New Item" row an empty Warehouse shows; found by the review). Rows typed by hand work exactly as before and are never merged with goods.
  - **The Timber Yard & Sawmill and the Fishery & Smokehouse can be built,** and each has the guide's six orders, opened by its level (Level 1 to 5): for example Harvest Timber (4 days, 1 lot of Raw Timber), Saw Lumber (Level 2: 1 lot of Raw Timber becomes 1 lot of Sawn Lumber), up to the Level 5 bulk orders that make three lots; and Catch Fresh Fish (3 days) through Prepare Expedition Provisions (Level 3: 1 lot of Preserved Fish becomes 5 packs). Every number is in `facilities-data.js`.
  - **One production order at a time** at each of these two facilities (an Upgrade or research project can still run beside it). The order's button says "Can't order yet" with the reason underneath.
  - **What an order uses is taken from the Warehouse when the order begins** and held by the order, so it can't be used twice. Each order shows "Uses" (with what the Warehouse has) and "Makes". The Orders panel shows what a pending order is holding. **Cancel or Demolish gives the goods back,** once; a finished order uses them up. If an order's facility or order no longer exists when it falls due, its goods go back and the Day Log says so.
  - The Compendium still lists 270 items: goods and recipes aren't Compendium items.
- **Evidence:** `tools/bastion/data/goods-data.js`, `tools/bastion/data/facilities-data.js`, `tools/bastion/rules.js` (Goods: `R.addGoods`, `R.takeGoods`, `R.returnGoods`, `R.inputsShort`, `R.recipeBlocker`, `R.completeProduction`, `R.cleanWarehouse`, `R.cancelOrder`, `R.issueOrder`), `tools/bastion/tool.js` (`fnRow`, `goodsRow`, `pendingRow`); tests in `tests/rules/bastion.test.js` and `tests/e2e/bastion-screen.test.js`.

### BAS-77 · Pull request 3: the Herbal Gardens' Level 2 to 5 orders, and the research they open
**Deliberate change** (Harry's facility guide and his answers, 13 October 2026) · other

- **Before:** The Herbal Gardens had only Harvest and Greenhouse Harvest. 9 of its 24 research choices could be researched.
- **After:**
  - **Harvest and Greenhouse Harvest are unchanged** (their ten products, days and party level 9 gate).
  - **Four new orders, opened by the Gardens' level:**
    - Level 2, **Cultivate Specialist Plants** (4 days): 10 portions of Restorative Herbs, Antivenom Roots, Toxic Blossoms or Alchemical Flowers.
    - Level 3, **Prepare Field Medical Supplies:** 2 Healer's Kits and 2 Antitoxins (2 vials each) from 5 portions each of Restorative Herbs and Antivenom Roots (6 days); 2 Potions of Healing from 10 Restorative Herbs (7 days); or 2 doses of Basic Poison from 10 Toxic Blossoms (7 days). Each recipe has its own days.
    - Level 4, **Harvest Commercial Medicinal Crops** (6 days): 1 lot of Medicinal Herbs, or (7 days, with **Botanical Extraction** researched) 1 lot of Refined Botanical Reagents from 10 Alchemical Flowers.
    - Level 5, **Major Botanical Production** (8 days): 3 lots of Medicinal Herbs, 30 portions of one ingredient, or (10 days, with **Exotic Flora Conservatory** researched) 1 lot of Rare Botanical Extracts from 20 Alchemical Flowers.
  - **Research, by Harry's answers:**
    - Intensive Cultivation adds 5 portions to Cultivate Specialist Plants; Bountiful Harvests adds 50%. Only the bigger applies, and **Specialist Seedbeds** adds 5 more on top.
    - The faster-order choices apply to the new orders as their wording says: Efficient Planting to the Harvest only; Crop Rotation to the cultivating and crop orders; the Perpetual Growing Cycle to all six. Each is taken from a recipe's own days, never below 2.
    - **Specialist Seedbeds, Botanical Extraction and Exotic Flora Conservatory can now be researched,** so 12 of the 24 can be, and 12 still say "Coming later".
  - A recipe that waits for research says "(needs …)" in its list and why it can't be ordered.
- **Evidence:** `tools/bastion/data/facilities-data.js` (Herbal Gardens), `tools/bastion/data/research-data.js`, `tools/bastion/rules.js` (`R.orderDaysAt`, `R.goodsOutputQty`, `R.recipeBlocker`, `R.researched`); tests in `tests/rules/bastion.test.js` and `tests/e2e/bastion-screen.test.js`.

### BAS-78 · Pull request 3: the map's haze and labels, and the facilities in two rows
**Deliberate change** (Harry, 13 October 2026, with his reference screenshot) · other

- **Before:** The painting always looked the same, with no names on it. The facility tiles sat in one row of large squares.
- **After:**
  - **While the facilities grid is open,** the painting takes on a soft, warm haze, and each built facility (the starting five included) has a small label above it with its name and level. Labels stay inside the painting, clear of the crest badge and of each other, on the laptop, in full screen, on the TV and in a small window. A facility being built has no label until it's finished. **Folding the grid away (▼) removes the haze and labels,** so the painting looks exactly as before. The haze is drawn with styles only, and its fade is instant with reduced motion.
  - **The tiles are smaller, in two rows** (Harry's request during this pull request): the five starting facilities and the six construction slots above, the six Development Plots below, so all 17 fit without scrolling. They sit in a tray that rises a little over the sea at the foot of the painting (never above about 1150 of the painting's 1250 pixels, well below the dock and its boat). Folding the grid works as before.
- **Questions for Harry:** which painted building is which starting facility was a best guess (and the stone barn by the jetty has no label); the Menagerie has no place on the painting, so it has no label. Both are one table in `bastion-data.js` (`mapLabels`). *Since 13 October 2026 the Courier Exchange has Harry's own overlay and picture, and a label place above its building (once it can be built). With the Shrine of Aurush built too, the two labels would meet, so the Courier Exchange's moves down onto its own roof: still beside its building and readable.*
- **Evidence:** `tools/bastion/data/bastion-data.js` (`mapLabels`), `tools/bastion/rules.js` (`R.mapLabels`), `tools/bastion/tool.js` (`renderTop`, `placeLabels`, `fitMap`, `renderGrid`, the tray), `tools/bastion/bastion.css` (the haze, labels and tray); tests in `tests/rules/bastion.test.js`, `tests/e2e/bastion-screen.test.js` and `tests/e2e/phase9.test.js`.

### BAS-79 · Exotic Flora Conservatory can't be reached yet
**Later, Harry's call** · other

- **Before (since pull request 3):** Exotic Flora Conservatory is Stage III of the Botanical Research branch. A stage opens only once the stage before it on the branch is done, and both Stage II choices there (Rare Cultivar Development and Environmental Adaptation Extracts) still say "Coming later" (they wait for the Arcane Laboratory's recipes and the Explorer link). So Exotic Flora Conservatory shows as locked, and Rare Botanical Extraction can't be ordered yet.
- **After:** Unchanged until Harry decides: open Stage III anyway while Stage II is "coming", or wait for those pull requests.
- **Evidence:** `tools/bastion/data/research-data.js` (the Botanical branch), `tools/bastion/rules.js` (`R.researchChoiceState`); the rules test "a recipe that needs research waits for it".

### BAS-80 · Folded grid: two bottom-bar button names are slightly cut off
**Later, Harry's call** · other

- **Before:** With the grid folded, the bottom bar is one row of 46-pixel-high buttons, and "Clan Influence" and "War Council" wrap to two lines, so the bottom of their second line is slightly cut off on the laptop.
- **After:** Unchanged (it was already like this before pull request 3, and the buttons work). It can be tidied in the final polish.
- **Evidence:** `tools/bastion/bastion.css` (`.tsi-bas-stage.is-grid-closed .tsi-bas-pbtns`); checked against the merged #22 at 1707 × 930.

### BAS-81 · The Bastion applies each change from the Explorer once, and lists them
**Deliberate change** (the facilities overhaul, pull request 4; Harry's answers, 13 October 2026) · applies something twice

- **Before:** Nothing passed from the Explorer to the Bastion except the day.
- **After:**
  - **Applied once.** The Bastion reads the Explorer's save every 2 seconds, as it does for the day. It applies each change from an Explorer event (EXP-37) once, and keeps a receipt in its own save, written together with the change itself. So a saved Bastion has both or neither, and no reload, Import, Restore, Reset Travel or second window can count it twice (SUI-30).
  - **When.** A change waits until the Bastion has reached the day it happened. With the Bastion open, that's within a few seconds, with a notice. If the Bastion was shut, a change from the day it was shut on applies as soon as it opens again, with a notice; one from a later day applies as the Bastion passes that day, before that day's orders, and goes in "The Ironbow sends word…". Reset Travel moves waiting changes back with the days. Honour/Respect stays within −5 to +5; at the limit, the change is recorded with no effect.
  - **A Bastion that starts from nothing** (a first open, or after Reset) skips every change sent before it, and lists them as skipped, rather than adding them on top of values typed in by hand. Changes after that apply as normal. (A Bastion opened before the Explorer has ever saved has nothing to skip, so it simply applies everything that comes later: a review fix.)
  - **Clan Influence** has **Changes from the Explorer**, the latest ten: applied (with before and after), skipped or refused (with why). The Day Log keeps every one too, and clearing the Day Log doesn't clear this list.
  - **The Honour/Respect box** now adds what's typed as a difference from what it showed, rather than writing over the value, so a change arriving while the DM types isn't lost (the Warehouse's goods counts work the same way). A box that only has the focus (Clan Influence puts it in the first box when it opens) follows the save as usual.
- **Evidence:** `tools/bastion/rules.js` (`R.applyInbox`, `R.adjustStanding`, `R.cleanBridge`, `R.bridgeHistory`, `bridge` in `R.defaultState` and `R.fromSave`), `tools/bastion/tool.js` (`settleInbox` in `checkClock` and `passDays`, `renderBridge`, the Honour/Respect box); tests in `tests/rules/bridge.test.js` and `tests/e2e/bridge.test.js`.

### BAS-82 · The Explorer link's limits
**Later, Harry's call** (pull request 4, 13 October 2026) · other

- **An old Explorer-only file:** importing an Explorer file from before the campaign save (October 2026) replaces only the Explorer. Its changes already applied stay in the Bastion, and replaying an event from it sends a new one. Campaign files carry both tools, so they're safe.
- **No undo:** a change from the Explorer can't be taken back with a button. The DM edits the Clan's Honour/Respect box instead.
- **Different storage:** if one tool can save only in the small fallback storage and the other in the main one, they can't see each other, and changes stay **Waiting** (never applied twice). This only happens if Edge refuses the main save space.
- **Evidence:** `shared/js/backup.js` (an Explorer-only file), `shared/js/bridge-rules.js` (`statusOf`).

### BAS-83 · Cargo: the Dock ships real goods, which sell once on arrival
**Deliberate change** (the facilities overhaul, pull request 5; Harry's answers, 14 October 2026) · applies something twice

- **Before:** goods in the Warehouse had a base value but never became gold. The only trade was the Hall's (Trade Agreements and the Consortium's sea routes), which pays a fixed income.
- **After:**
  - **The Dock's Cargo and Port Charters** section (its panel): at Level 2 one ship carries 2 lots, at 3 three, at 4 four, and at 5 two ships carry 5 lots each; Level 1 can't send cargo. The Charter Berth order is unchanged.
  - **Ship cargo…** sends real Warehouse lots to a port with a registered Port Charter (BAS-84). It shows a quote first. The lots leave the Warehouse when the ship sails, all or nothing, and a refused sailing changes nothing. Fresh Fish sails only on a voyage of 2 days or less (BAS-86). Not while the Dock is Under Repair.
  - **At sea:** 7 days to the port and 7 home (per port, in data). The ship can't sail again until it's back.
  - **On arrival** the Bastion rolls the voyage's risk itself (1 to 100 against Low 5, Medium 10 or High 20; Timberport Low, Goldport High). Above the chance, the cargo sells: each lot's base value × the buying Clan's demand × the Charter's price factor, less the shipping fee and tariff, rounded down and never below 0, paid into the treasury once, with an itemised receipt. At or below it, nothing sells, and the cargo comes home with the ship and goes back into the Warehouse when it docks. Nothing is lost.
  - **Once only:** the ships are settled in each day's trade step, after the old sea routes and before the orders, and saved in the same write as that step moving on; each voyage moves on in the same change as its gold or goods, and a voyage with a receipt is never paid again. So a closed window, a reload, a cancelled route roll or a campaign file can't pay twice or return goods twice.
  - **Standing shipments** (Dock Level 4): the same cargo every 7 days, starting the next day, whenever a ship, the goods and the room are there; otherwise it waits (said once for each reason) and sails the first day it can.
  - **Where it shows:** the Day Log, "The Ironbow sends word…", the Dock's Recent sales (the last 5; the save keeps 30) and the Hall's Port Charters box. The Explorer's word and the DM doc say when a ship arrives or is home, never what it sells for.
  - **Kept apart from the old trade:** the Hall's agreements, sea routes, Market Stability, investments, Expected Income / Week and the Council Ledger are unchanged; cargo never enters the old route list (`legacy_abstract`), and the new risk applies only to cargo voyages (`commodity_backed`).
  - **Every number** is in `tools/bastion/data/commerce-data.js`.
- **The review's fixes (14 October 2026):**
  - two standing shipments sharing one ship take turns (before, the second never sailed);
  - two ships sailing in the same moment can never share an id (a receipt with the same id would have counted the second as already sold);
  - Ship cargo… sits at the top of the section, in view as the panel opens on the laptop;
  - Ship cargo… is off, saying why, when the only trade goods are Fresh Fish;
  - in the Ship cargo and Standing shipment pop-ups, the main button is off while the rules would refuse the cargo (none chosen, too many for the ship, or more than the Warehouse holds), with the reason beside the lot count, and the pop-up follows the Bastion if a day passes underneath it;
  - setting up a standing shipment for a port that has one starts from its cargo.
- **Evidence:** `tools/bastion/commerce-rules.js` (`dispatchCargo`, `settleVoyages`, `cargoQuote`, `setSchedule`, the cleaners and `shiftCommerce`), `tools/bastion/tool.js` (`runDay`'s trade step, `cargoSection`, `cargoPicker`), `shared/js/campaign-rules.js` (`bastionComing`); tests in `tests/rules/commerce.test.js` and `tests/e2e/commerce.test.js`.

### BAS-84 · Port Charters at the Bastion and the Hall's Register Port Charter
**Deliberate change** (pull request 5; Harry's answer: "DM grants; 3-day Hall order registers") · applies something twice

- **Before:** there were no Port Charters.
- **After:**
  - **Held once.** A Port Charter from the Explorer (EXP-39, SUI-32) is applied once, like a change of Honour/Respect: it becomes **earned**, with its receipt saved in the same write. One per port: a second for a port already held changes nothing and says so. A notice says so, the Day Log keeps it, and **Changes from the Explorer** in Clan Influence lists it. A Bastion that starts from nothing skips Charters sent before it, as it does other changes (pull request 4's rule, kept), and lists them; the DM can grant again.
  - **Registered once.** The Hall of Emissaries' **Register Port Charter** (Level 2; 3 days; no gold; no roll) picks from the earned Charters. One runs at a time: with a second Charter waiting, its button says "One at a time" and why (whose is being registered, and when it's ready). When it completes, the Charter is **registered** and the Dock can ship there; a second registration changes nothing. Cancel, or demolishing the Hall, leaves it earned. Nothing goes into the Warehouse.
  - The Hall's trade area has a **Port Charters** box with each Charter's state and its ships at sea. It says cargo isn't in Expected Income / Week, which still counts the old sea routes only.
  - The forecast says "Register Port Charter (…) is complete", never "needs your roll".
  - A Port Charter the Bastion refuses gives a notice titled "From the Explorer." (not "Honour/Respect.").
- **Evidence:** `tools/bastion/rules.js` (`R.applyInbox`, `R.cleanBridge`, `R.fnOptions`, `R.issueOrder`, `R.completeSimpleOrder`), `tools/bastion/commerce-rules.js` (`addCharter`, `completeCharterRegistration`, `cleanPortCharters`), `tools/bastion/data/facilities-data.js` (`register_port_charter`), `tools/bastion/tool.js` (`portChartersBox`, `renderBridge`, `tellSettled`); tests as BAS-83.

### BAS-85 · Commodity trade's limits and open choices
**Later, Harry's call** (pull request 5, 14 October 2026) · other

- **Clan demand:** Harry's table is in (BAS-86). **Market saturation** (a good selling for less after many lots at one port in 28 days) is now on (SUI-43).
- **Fresh Fish** sails only on a voyage of 2 days or less (BAS-86), so with today's two 7-day routes it never sails. There's no spoiling at sea.
- **Recall ship…** (BAS-86) can call a ship back on its way out; once it has reached the port, it can't. An Import of a backup still undoes other mistakes.
- **Protections** (the Barracks' convoy, the Watchtower's approaches, the Shrine of Pelagos' blessing) are built in but not available until their orders exist.
- **Concessions:** a Charter can carry a negotiated price factor, fee or tariff, but nothing sets one yet (negotiation comes later).
- **Not yet:** political benefits from sales, more ports, cargo routes on the Sea Trade Routes map, and the Stone Quarry's and Weavers' Hall's goods (seven goods have no facility making them yet).
- **Evidence:** `tools/bastion/data/commerce-data.js`.

### BAS-86 · Harry's follow-up: the demand table, Fresh Fish on short voyages, a record of every sale, and Recall ship
**Deliberate change** (Harry's answers to pull request 5's open choices, 14 October 2026) · applies something twice

- **Before:** every Clan paid Normal (×1.00) for everything; Fresh Fish never sailed; nothing recorded sales by port and good; a ship at sea couldn't be called back.
- **After:**
  - **Demand, good by good:** each Clan has three goods it highly seeks (×1.25) and three it wants moderately (×1.10), exactly as Harry's approved table, in `commerce-data.js` (`demand`). Everything else is Normal; nothing starts Oversupplied. Kinds of goods no longer count: only a good's own entry does.
  - **Fresh Fish** sails only on a voyage of 2 days or less (`maxDaysAtSea`), judged on the voyage's actual days to the port. Today's routes are 7 days, so it stays at home, and both the Dock and the Ship cargo dialog say why. Preserved Fish and Premium Seafood sail as before.
  - **A record of every sale** (`tradeNetwork.marketLedger`: day, port, good, lots and the sale it came from), written in the same change as the sale, so once only, and kept 56 days. It's for market saturation later (rolling 28 days; lots 1–4 at the Clan's demand, 5–8 one tier lower, 9–12 two lower, 13 on Oversupplied); `saturation.active` is false and no price uses it yet.
  - **Recall ship…** under the Dock's Ships at sea, on a ship still on its way out (asks first). It turns for home at once: the way back takes as many days as it has sailed (at least 1). Nothing is sold, there's no risk roll and no gold; its cargo goes back into the Warehouse when it docks, once, and the ship can sail again then. On or after its arrival day it can't be recalled. A standing shipment carries on, and still first sails the day after it's set up. A recalled ship survives reloads, Reset Travel and campaign files, and the Explorer's word never says it reaches the port.
  - **Unchanged:** the risks (Timberport Low 5 in 100, Goldport High 20 in 100, per route in data), one roll per voyage, the protections (none available yet), and the old trade.
- **The review's fixes (14 October 2026):** four reviewers (once-only, the rules against Harry's answers, the screens, the tests), each checked by a skeptic; nothing was found that sells, pays or returns cargo twice. Fixed:
  - the Recall ship question said "Its standing shipment carries on" even after that shipment had been stopped;
  - a note in `goods-data.js` still said a Clan's demand follows a good's kind;
  - the guide's Fresh Fish sentence hinted it spoils and pointed to the dialog when the reason shows beside Ship cargo….
- **Left alone (minor):** if the party makes camp in the Explorer while the Recall ship question is open in the Bastion, the ship's way home is worked out from the day you confirm, not the day the question showed; the Dock and the Day Log then show the right day. Research's question works the same way.
- **Evidence:** `tools/bastion/data/commerce-data.js` (`demand`, `saturation`, `maxDaysAtSea`), `tools/bastion/commerce-rules.js` (`demandFor`, `goodShipBlocker`, `recallBlocker`, `recallVoyage`, `marketLedger`, `trimLedger`, `lotsSold`, `cleanLedger`, `cleanVoyages`, `settleVoyages`), `tools/bastion/tool.js` (`cargoSection`, `onRecall`, `stuckReason`); tests in `tests/rules/commerce.test.js` and `tests/e2e/commerce.test.js`.

### BAS-87 · The Courier Exchange: parcels of supplies to a town, + Add supplies, and Recall parcel
**Deliberate change** (the facilities overhaul, pull request 6; Harry's answers, 14 October 2026) · applies something twice

- **Before:** the Courier Exchange was listed as "In development" and couldn't be built. The Warehouse had no Overland charts, and nothing could send anything to the party.
- **After:**
  - **Building it:** on a Development Plot (from party level 9), in 21 days; Levels 2 to 5 as every facility (7, 14, 21 and 28 days, no gold). Harry's art was already in place. Levels 3 to 5 show "Coming later" (Collect Expedition Cargo, Priority Courier, Express Cargo Exchange); there's no research yet.
  - **What it carries:** Expedition Provision Packs and Overland charts (a new Warehouse supply, named as in the Explorer). Which goods it carries, and how many "items" each counts as, are data (`courier-data.js` `items`), so other ordinary Warehouse goods can follow without changing how delivery works. Bulk cargo, ships, coin and creatures never go.
  - **Towns, days and fees** (Harry's): Level 1: Slade’s Muster, 2 days, 5 gp. Level 2 adds Moorcastle (4 days, 10 gp), Bretan (5, 10), Middlemount (6, 20), Timberport (7, 20), Goldport (7, 20), Swyth (10, 30) and Bleakharbour (12, 30). It uses none of the Dock's ships, room, routes or Port Charters.
  - **Room:** Level 1, one parcel travelling at a time, up to 5 items; Level 2, two at a time, up to 10 items each. A recalled parcel coming home still takes a travelling place; a parcel waiting at its town doesn't.
  - **Send a parcel…** (the panel's main button) takes the items from the Warehouse and the fee from the treasury, once, in one change with the new parcel; every check comes first, and a refused parcel changes nothing (with the reason shown: room, items, stock, gold — "Sending a parcel to Moorcastle costs 10 gp; the treasury has 4 gp." — or Under Repair). The pop-up follows the Bastion if a day passes while it's open.
  - **Arrival:** on its day (in the day's trade step, in the same save), the parcel waits at its town until it's collected, with no time limit. Nothing goes wrong on the road. The Day Log and "The Ironbow sends word…" say so; the Explorer's word and the DM doc say beforehand when a parcel is due.
  - **Recall parcel…** (asks first) on a parcel still travelling: it turns back at once, can't be delivered any more, and is home after as many days as it had travelled (at least 1), when its items go back into the Warehouse, once. No refund, and the way back is free. Not on or after its arrival day.
  - **The pickup:** when the Explorer collects it (EXP-41, SUI-33), the Bastion closes the parcel once and shows a notice; Clan Influence's Changes from the Explorer lists "Parcel collected: …".
  - **+ Add supplies** in the Warehouse: the DM puts packs or charts in by hand, 1 to 99 at a time, logged, making no gold, and once per click (a double click adds once). A temporary provision until the Ironbow makes charts (the Library's Prepare Overland Travel Charts order comes later); packs also come from the Fishery & Smokehouse.
  - **Under Repair** stops new parcels only; parcels already sent carry on, and can still be recalled. **Demolish:** parcels already sent still arrive and can be collected (and recalled ones come home), and the question says so.
  - **Once only:** the parcels are in the Bastion's save (`tradeNetwork.parcels`), always in the same order of fields, moved by Reset Travel and carried by the campaign file and Back up everything; loading a save twice gives the same save.
- **The review's fixes (14 October 2026):** the Overland chart's Warehouse line was cut off ("…"); Clan Influence now knows a pickup by its id even if an older copy stripped its receipt.
- **Evidence:** `tools/bastion/courier-rules.js`, `tools/bastion/data/courier-data.js`, `shared/data/courier-points.js`, `tools/bastion/data/goods-data.js` (`overland_chart`), `tools/bastion/data/facilities-data.js` (`courier_exchange`), `tools/bastion/rules.js` (`defaultTradeNetwork`, `applyInbox`, `fromSave`, `shiftDays`), `tools/bastion/tool.js` (`courierSection`, `parcelPicker`, `onSendParcel`, `onRecallParcel`, `onAddSupplies`, `runDay`'s trade step), `shared/js/campaign-rules.js` (`bastionComing`); tests in `tests/rules/courier.test.js` and `tests/e2e/courier.test.js`.

### BAS-88 · The Courier Exchange's limits and choices made for Harry
**Later, Harry's call** (pull request 6, 14 October 2026) · other

- **Choice made for Harry:** once the Courier Exchange is demolished, a parcel still on its way **can't be recalled** (Recall parcel… is in its panel). It carries on, arrives and can be collected, as he decided. **Harry (15 October 2026): keep it so.**
- **Not yet (Harry's later steps):** Level 3 (return trips from the party), Level 4 (Priority Courier), Level 5 (Express Cargo Exchange), research (room, fees, days, more towns), more goods (potions, equipment, herbs), the Library's Prepare Overland Travel Charts order, and moving gold between the party's purse and the treasury.
- **The Bastion must catch up:** the Explorer only lets the DM collect a parcel once the Bastion has recorded its arrival. If the Bastion is shut, the Explorer shows the parcel as "due" and waits.
- **Saves from different moments** (an old single-tool file, or a hand edit): a pickup the Bastion has no record of is refused with a plain reason; check both the Warehouse and the Travel bags. A campaign file or Back up everything always pairs both tools from one moment.
- **Different storage:** if one tool can save only in the small fallback storage and the other in the main one, the Explorer can't see the parcels, so they wait and are never doubled (as BAS-82).
- **Damaged records:** a parcel record with no id or town is dropped only if it's closed or holds nothing; otherwise it's kept, so its items are never lost.
- **A day passing while a question is open:** if the party makes camp in the Explorer while Recall parcel…'s question is open, the parcel's way home is worked out from the day you confirm (the Dock's Recall ship and Research's question work the same way).
- **Evidence:** `tools/bastion/courier-rules.js` (`parcelRecallBlocker`, `cleanParcels`, `courierDemolishNote`), `tools/explorer/journey.js` (`collectParcel`).

### BAS-89 · The Library & Scriptorium's Prepare Overland Travel Charts
**Deliberate change** (Harry's answer, 14 October 2026) · other

- **Before:** nothing at the Ironbow made Overland charts; they could only be added by hand (+ Add supplies, BAS-87).
- **After:** the Library & Scriptorium's order **Prepare Overland Travel Charts** needs the Library at Level 2 and makes **1 Overland chart in 4 days**, with no gold and no ingredients, straight into the Warehouse, as the Fishery's packs go. One chart order runs at a time; the scripture **Research** order is unchanged (its four choices, 5 days, no gold) and can run beside it. + Add supplies stays for charts.
- **Evidence:** `tools/bastion/data/facilities-data.js` (`library_scriptorium`: `prepare_overland_travel_charts`, `productionLimit: 1`); tests in `tests/rules/bastion.test.js` and `tests/e2e/creatures.test.js`.

### BAS-90 · The creatures: Elara's wyvern, griffins and dire wolves
**Deliberate change** (the facilities overhaul, pull request 7; Harry's answers, 14 October 2026) · applies something twice

- **Before:** the Wyvern Roost, Griffin Tower and Dire Wolf Den were "In development", and Elara's wyvern lived at the Ironbow in the story only.
- **After:**
  - **The buildings** can be built, each in a construction slot (from party level 5, 21 days, no gold), with Harry's art. Building one never creates an animal.
  - **A register of creatures** in the Bastion's save, each recorded once, never copied, and kept apart from the Menagerie (which is unchanged).
  - **The Wyvern Roost's House Elara's Wyvern** (3 days, no gold, once ever) records Elara's own wyvern. It's shown as "Elara's wyvern" until Harry gives its name (`creatures-data.js`).
  - **Griffins and dire wolves** come only when the DM grants one in the Explorer (EXP-42, SUI-34). The Bastion holds it, waiting for a home (a notice says so, and Clan Influence's Changes from the Explorer lists it), until the **Griffin Tower's House a Griffin** or the **Dire Wolf Den's House a Dire Wolf** (choose which; 3 days, no gold, one at a time) houses it. **One creature per level** of the building; one that has no room waits.
  - **Panels:** each building's **Creatures** section shows the room (taken and free), those living there, those waiting, and what's coming later; hover over a creature for its stats. **Management** lists every creature, with no Remove.
  - **On the War Table** (WAR-RULES): creatures defend the Ironbow only (Defend Bastion), each as its own unit under its own name: Elara's wyvern Cohesion 7, Attack +6, Defence 13, Move 6, Resolve +2, Flight, Battle Value 11; a griffin 5, +5, 12, 6, +1, Flight, 8; a dire wolf the War Table's Dire Wolf (7, Pack). They're never sent on a War Action, never open the War Council lock by themselves, and are **never killed or captured**: at worst badly wounded for 21 days. An unnamed one's token is its kind's, numbered (Gr1, Wo1).
  - **Demolish** leaves creatures already housed at the Ironbow, still guarding it; a House order waiting there is cancelled and its creature waits again. Rebuilding gives them a home again (never twice).
  - **Once only:** each grant has a receipt saved with the creature; House orders hold their creature; loading a save twice gives the same save; Reset Travel, the campaign file and Back up everything carry it all.
- **The review's fixes (15 October 2026):** the room line says what's taken and free and suggests upgrading only when full; unnamed creatures' War Table tokens no longer carry the day number; the Explorer stops saying "house it" once a creature is housed; the data file says which two numbers must match a number kept elsewhere.
- **Evidence:** `tools/bastion/data/creatures-data.js`, `tools/bastion/creature-rules.js`, `tools/bastion/data/facilities-data.js` (`wyvern_roost`, `griffin_tower`, `dire_wolf_den`), `tools/bastion/rules.js` (`defaultState`, `cleanCreatures`, `applyInbox`, `fnOptions`, `issueOrder`, `completeSimpleOrder`, `shiftDays`), `tools/bastion/war-campaign-rules.js` (`warForces`, `beginDefence`, `playerSide`, recovery), `tools/bastion/tool.js` (the creature panels, Management, notices, Clan Influence, Demolish), `tools/bastion/war-table.js`, `shared/js/campaign-rules.js`; tests in `tests/rules/creatures.test.js` and `tests/e2e/creatures.test.js`.

### BAS-91 · The creatures' limits and choices made for Harry
**Later, Harry's call** (pull request 7, 15 October 2026) · other

- **A grant sent by mistake:** this was the case until pull request 8a (see BAS-93 and EXP-43). The creature waited for good, and once housed it guards for good; only an Import of a backup undid it. **Harry (15 October 2026): both.** Grant will ask first, and a waiting creature will get a Release button; not built yet (the next Bastion pull request).
- **An older copy of the Bastion deletes the creatures** (SUI-34): back up before trying another copy.
- **Not yet (Harry's later steps):** the wyvern's name; care, training, bonding, riding, mounted flight, a companion on the Explorer, breeding; Roost upgrades (they unlock nothing yet; the Tower's and Den's add room); research; moving a Menagerie Dire Wolf into the Den.
- **A creature can't be made to lose on purpose** at the table: the d6 after a defeat only matters if one is Defeated in a battle.
- **Evidence:** `tools/bastion/creature-rules.js`, `tools/explorer/journey.js` (`grantCreature`).


### BAS-92 · The War Room: regiments, training, Recouping and Musters
**Deliberate change** (pull request 8a; Harry's proposal, `docs/specs/war-room-training.txt`, approved as written on 15 October 2026, plus his Recouping rule) · applies something twice

- **Before:** the War Room only recruited; identical regiments were one counted row; a regiment that came home under strength stayed "Depleted" until a Recruit of its kind refilled it.
- **After:**
  - **Regiments:** each is its own record (SUI-35), numbered by kind. **Rename…** (in the War Room's Regiments list and in Management) gives it a name, up to 40 letters; an empty name gives its number back.
  - **Drill a Regiment** (War Room Level 2): one regiment at full strength steps up a grade.

    | Grade | Days | Gold | War Table effect |
    |---|---|---|---|
    | Trained | 7 | 25 gp × base Battle Value | +1 Resolve, +0.5 Battle Value |
    | Veteran | 14 more | 50 gp × base Battle Value | adds +1 Cohesion, +0.5 Battle Value |

    - The gold is paid once, when the drill starts. A double click drills once.
    - Drill places: 1 at Level 2, 2 at Levels 3–4, 3 at Level 5. One drill per regiment.
    - The bonus goes on that regiment's own stat block only. `war-units-data.js` and the battle rules are unchanged.
  - **A regiment drilling** stays home from War Actions, but defends the Ironbow if it's attacked. Its drill waits a day for each day it's Recouping or away at a battle. If it's lost, the drill ends with no gold back.
  - **Recouping** (Harry): a regiment that comes home under strength refills by itself, a share each day. It takes 3 days if up to 20% were lost, 7 days up to 40%, 10 days up to 60%, and 14 days for more. It doesn't refill while away at a battle, and can't drill until full. Training survives casualties. A Recruit of its kind still refills it at once, keeping its name and grade.
  - **Coordinated Muster** (Level 3) raises two formations in one 7-day order; **Grand Muster** (Level 5) raises three. Each formation is raised as Recruit raises one, at no cost.
  - The War Table shows a regiment's own name and grade on its stat block; its line-up puts the best trained first.
- **Evidence:** `tools/bastion/data/war-room-data.js`, `tools/bastion/regiment-rules.js`, `tools/bastion/data/facilities-data.js` (`war_room`: `drill`, `coordinated_muster`, `grand_muster`), `tools/bastion/war-campaign-rules.js` (`warForces`, `playerSide`, `applyRegimentLoss`, `recruitUnit`, `buildSpec`), `tools/bastion/rules.js` (`fnOptions`, `issueOrder`, `completeSimpleOrder`), `tools/bastion/tool.js` (the Regiments list, Rename…, the day's step), `tools/bastion/war-table.js`; tests in `tests/rules/bastion-campaign.test.js` and `tests/e2e/war-room.test.js`.

### BAS-93 · Release a creature still waiting for a home
**Deliberate change** (Harry, 15 October 2026: "both"; G1: a housed creature can't be released) · loses saved data

- **Before:** a creature granted by mistake waited at the Ironbow for good (BAS-91).
- **After:**
  - A griffin or dire wolf still waiting, with no House order for it, has **Release…** in its building's panel and in Management. It asks first, then leaves the register, with a line in the Day Log.
  - Its grant's receipt stays, so it never comes back by itself.
  - A creature being housed, or housed, or Elara's wyvern, can't be released.
- **Evidence:** `tools/bastion/creature-rules.js` (`releaseBlocker`, `releaseCreature`), `tools/bastion/tool.js` (`creatureRow`, `onRelease`); tests in `tests/e2e/war-room.test.js`.

### BAS-94 · The War Room: choices made for Harry, and what waits
**Later, Harry's call** (pull request 8a, 15 October 2026) · other

- **Choices made for Harry:**
  - **A War Action still takes regiments by number per kind,** not by name. The best trained go first, then the healthiest. Say if the DM should pick particular regiments.
  - **Drill gold is never given back:** not on Cancel (as every order) and not if the regiment is lost.
  - **Defeated regiments come home under strength,** as before: they Recoup rather than vanish. Only a regiment with nobody left is removed (W3).
  - **A released creature** shows in the Explorer as "released" once the Bastion is read. An older copy that deleted creatures (SUI-34) would show the same line.
- **Not yet (Harry's later steps):**
  - specialist doctrines and the War Room research tree (Level 4);
  - Grand War Exercises (kept for the Command & Logistics research);
  - upkeep (stays uncharged, B7).
- **Evidence:** `tools/bastion/regiment-rules.js`, `tools/bastion/war-campaign-rules.js` (`warForces`).


### BAS-95 · The Shrines at Levels 2 to 5 (the Bastion's half)
**Deliberate change** (pull request 8b, part 1; Harry's Shrine specification and his answers S2, S9 and S10, 15 October 2026) · applies something twice

- **Before:** each Shrine had only Craft and Pray, and its upgrades unlocked nothing.
- **After:**
  - **Orders,** with Craft and Pray unchanged:

    | Level (days) | Telluria | Aurush | Pelagos |
    |---|---|---|---|
    | 2 (3) | Earthward Talisman | Blessed Lantern | Bless Voyage |
    | 3 (4) | Rootguard Salve, 2 doses | Purification Incense, 2 portions | Aquatic Protection Charm |
    | 4 (5) | Bless Bastion Foundations (not yet available) | Consecrate Expedition Supplies, 3 Cleansing Portions | Bless Commercial Shipment |
    | 5 (7) | Great Rite: Earth's Endurance | Great Rite: Cleansing Radiance | Great Rite: Tide's Passage |

  - **Favour:** Level 2 orders cost none; Level 3 costs 5%, Level 4 10% and Level 5 25% of that Shrine's god's Favour. It is taken once, when the order starts, and is refused, with the reason, if there isn't enough. Cancel gives none back, as with gold.
  - **Items** go into the Warehouse. The Courier Exchange carries them (S10), each counting as 1 item, and they reach the Travel bags with their description.
  - **Bless Commercial Shipment** switches on the Dock's Blessing of Pelagos: one is held for each order, and the next ship sent with cargo takes it, so its chance of trouble at sea is 10 points lower.
  - **A Great Rite** waits at the Ironbow, once (`greatRites` in the save), until the DM gives it to the party (part 2).
- **Evidence:** `tools/bastion/data/facilities-data.js` (the Shrines), `tools/bastion/data/goods-data.js`, `tools/bastion/data/courier-data.js`, `tools/bastion/data/commerce-data.js` (`pelagos_blessing`), `shared/data/party-items.js`, `tools/bastion/rules.js` (`favourBlocker`, `issueOrder`, `completeSimpleOrder`, `cleanGreatRites`), `tools/bastion/tool.js` (`shrineSection`); tests in `tests/rules/bastion.test.js`, `tests/rules/commerce.test.js` and `tests/e2e/shrines.test.js`.

### BAS-96 · The Shrines: what waits, and choices made for Harry
**Later, Harry's call** (pull request 8b, part 1, 15 October 2026) · other

- **Bless Bastion Foundations isn't available yet.**
  - No Bastion event sends a facility Under Repair from a natural cause: only an attack does, and that never counts.
  - The order is listed and says why.
  - **Decided (Harry, 18 October 2026):** no natural-damage events are added to make it useful, and no frequencies, damage or targets are invented. It stays unavailable. It may later be replaced by an effect that works with existing Bastion, Explorer or campaign play.
- **The Explorer's half is built (part 2):** see EXP-45 and SUI-36.
- **Choices made for Harry:**
  - The Blessing of Pelagos goes to the very next cargo ship, with no choosing.
  - Favour is never given back on Cancel.
- **Evidence:** `tools/bastion/data/facilities-data.js` (`bless_bastion_foundations`: `waiting`), `tools/bastion/commerce-rules.js` (`voyageProtections`, `dispatchCargo`).

### BAS-97 · Rename… on every creature at the Ironbow
**Deliberate change** (pull request 9; Harry, 18 October 2026) · other

- **Before:** a creature's name was fixed when the DM granted it. Elara's wyvern could only be called "Elara's wyvern", and Harry doesn't know its name yet.
- **After:** every creature in a Wyvern Roost, Griffin Tower or Dire Wolf Den panel has **Rename…**, waiting or housed.
  - Up to 40 letters. An empty name gives the usual name back ("Elara's wyvern", or "Griffin (granted Day 5)").
  - A House order still waiting for that creature follows the new name.
  - The new name shows in the panels, Management, the War Table and the Day Log. It is saved, and loading twice gives the same save.
  - It changes no stat, and nothing is sent back to the Explorer.
- **Older copies (SUI-19):** an older Bastion keeps the creature but reads the name it knew; it won't lose anyone. Back up first anyway.
- **Evidence:** `tools/bastion/creature-rules.js` (`renameCreature`), `tools/bastion/tool.js` (`onRenameCreature`); `tests/rules/creatures.test.js`, `tests/e2e/creatures.test.js`.

### BAS-98 · The Hall's Clan Relations and Diplomatic Records
**Deliberate change** (pull request 9; Harry's Hall handover and decisions, 18 October 2026) · other

- **Before:** the Hall kept only its agreements, delegations, summits, writs, consortiums and routes. It had no record of campaign decisions, and no summary of where each Clan stood.
- **After:** inside the Hall, beside its orders (which are untouched):
  - **Clan Relations:** the seven Clans with the Bastion's own Honour & Respect and Political Capital (no second reputation system), and the restrictions, privileges and obligations still running.
  - **Diplomatic Records:** a DM-written ledger. A record has a title, Clans, an in-game day (the shared Explorer day), situation, decision, outcome, notes and consequences. It is a draft until the DM confirms it; a draft can be edited or dismissed; a confirmed record can only take notes, and a lasting consequence can be ended early. Each record has a stable id (`dr-0001`) and a history.
  - **Honour & Respect and Political Capital** changes are applied once, on Confirm, within their limits (−5..+5 and −100..+100), and the score before and after is recorded.
  - **Restrictions, privileges, favours, obligations and quest hooks** are DM-tracked: recorded, shown and counted in days, never enforced. The screen says so.
  - **Nothing is invented:** no preset effects, numbers, durations, events or frequencies. The DM types each one.
- **Kept untouched, as Harry asked:** all six Hall orders, the old Trade Agreements and their income, the Trade Consortium, Port Charter registration, the Dock and the legacy Trade Network. No legacy notices.
- **Not built (waiting for Harry's approval):** offered or generated events, the ~20 drafted events, new Level 4–5 orders, DCs, costs and durations, the commodity-backed Consortium, retiring the old Trade Agreements, and any Hall research (withdrawn).
- **Older copies (SUI-19): back up before trying another copy.** An older Bastion drops `diplomaticRecords` from its save, losing the ledger.
- **Evidence:** `tools/bastion/diplomacy-rules.js`, `tools/bastion/rules.js` (save, Reset Travel), `tools/bastion/tool.js` (the Hall's two new sections); `tests/rules/diplomacy.test.js`, `tests/e2e/hall-records.test.js`.

### BAS-S04 · Production facilities: one order at a time, each level replacing the last, no goods needed
**Deliberate change** (Strip Back Overhaul, step S04; Harry's STRIP BACK handover and his answer "orders are self-contained", 22 October 2026) · other

*(Temporary id: another step may be adding BAS entries at the same time. Rename to the next free BAS number when the branches are merged.)*

- **Before:** the Timber Yard & Sawmill, Fishery & Smokehouse, Stone Quarry & Masonworks and Weavers' Hall listed all six of their orders, with the ones above the facility's level locked ("Needs Level 2."). Levels added orders. Most orders from Level 2 up used goods an earlier order made (Raw Timber, then Sawn Lumber, and so on).
- **After:**
  - Each level shows **only its own order** (two at Level 5, still one running at a time). Upgrading **replaces** the last level's order: the Upgrade row says "Level 2 replaces Harvest Timber with Saw Lumber.", and its button asks first. A replaced order (or one from a level not reached) is refused with "That order belongs to Level N."
  - **Orders are self-contained:** the 14 orders that used goods (every Level 2 to 4 processing order, and the Level 5 bulk processing orders) no longer take anything from the Warehouse. Days, gold (none) and what each order makes are exactly as before, so a Level 2 Timber Yard works with an empty Warehouse. Goods already in the Warehouse are left alone.
  - An order issued before the upgrade and still running when it finishes completes normally and still counts as the one running; Cancel frees the slot.
  - The Herbal Gardens and the Courier Exchange are unchanged (every order listed at every level, locked until its level; the Herbal Gardens' recipes still use goods).
- **Side effect to know about:** with no inputs, Bulk Lumber Processing, Bulk Smokehouse Production, Bulk Stone Processing and Bulk Sailcloth Production now make three lots of Sawn Lumber, Preserved Fish, Dressed Stone and Sailcloth from nothing, so processed goods cost no raw goods. Harry chose this; if it makes the Dock too generous, the numbers are in `facilities-data.js`.
- **Older copies and saves:** no save change, no migration (levels already live in `facilityLevels`). A Timber Yard saved at Level 3 simply shows only Prepare Construction Timber from now on. An order an older copy issued that is holding goods still completes, and Cancel still gives the goods back once. An older Bastion (before this change) does not know the flag and lists every order again.
- **Evidence:** `tools/bastion/data/facilities-data.js` (`levelOrders`), `tools/bastion/rules.js` (`R.fnAvailable`, `R.levelReplacement`, `R.upgradeReplaceNotice`), `tools/bastion/tool.js` (`unlockLine`, `onUpgrade`); `tests/rules/dev-facilities.test.js`, `tests/rules/bastion.test.js`, `tests/e2e/bastion-screen.test.js`.

## Clan Crest Creator
Old repo: `_legacy/clan-crest-creator` (file:line references point there).

**Sigils redone (29 September 2026):** the twenty sigils were replaced with traced public-domain heraldic drawings (see `docs/PROGRESS.md`). No new bugs were found, and none of the entries below changed: the drawing still numbers every hidden part (CRS-01), and the PNG, the controls and the layout on the laptop and the TV all pass their tests as before.

### CRS-01 · Fixed internal ids in the crest drawing
**Fixed by the new design** · other · listed in the handover

- **Before:** The crest's hidden drawing parts use fixed names such as 'shadow'. In one combined suite, two crests on screen (or another tool using the same names) could borrow each other's shadow or shape cut-out and draw wrongly. Not a problem in the old stand-alone tool.
- **After (planned):** Must do as part of the rebuild (CLAUDE.md namespacing): prefix every id with a unique tsi-crest-… prefix. Does not change how the crest looks.
- **Decision note:** Every SVG id gets a tsi-crest- prefix (namespacing rule).
- **Checker's note:** A rebuild requirement (namespacing), not a legacy bug. The bigger clash risk is the HTML control ids; see new_bugs.
- **Evidence:** app.js:296-299, 318, 324, 330, 335, 399, 404. No clashes found in the other seven legacy tools (grep).
- **Phase 2:** Fixed. The drawing's hidden part names now start `tsi-crest-svg-` (clip, texture, gloss, shadow, stripes). The tests check every id on the page is unique.
- **Crest rework (29 September 2026):** Still fixed. The new drawing numbers every hidden part too (`tsi-crest-svg-clip-12`), so the preview, the picture tiles and the PNG never share a name. The tests check it.

### CRS-02 · Crest's control ids clash with the Heartwood Ritual's
**Fixed by the new design** · breaks the tool

- **Before:** Two of the crest's on-screen controls use the same hidden names as controls in the Heartwood Ritual: its Reset button and its motto box. If both tools' pages are ever in the suite at once and not renamed, the crest could wire itself to the Ritual's 'Reset Ritual' button, or the Ritual to the crest's. Pressing one tool's button would then act in the other.
- **After (planned):** Must do as part of the rebuild (CLAUDE.md namespacing): prefix every crest element id (e.g. tsi-crest-reset), or look elements up inside the crest's own root element rather than the whole page. The handover's section 13 warns about generic DOM ids in general but does not name this clash.
- **Decision note:** Namespacing rule: ids prefixed and looked up inside the tool.
- **Evidence:** The crest looks up elements by id with getElementById (app.js:4, 115, 130): 'btnReset' and 'bannerText'. The Ritual uses the same ids: tellurian-ritual-engine/index.html:194 (id="bannerText"), :294 (id="btnReset"), ritual.js:108, 139. getElementById returns the first match in the page.
- **Phase 2:** Fixed. The Crest's controls are built inside its own screen and never looked up across the page, and their ids start `tsi-crest-field-`. While building, the tests caught a new clash of the same kind (the Texture drop-down and the drawing's texture layer shared a name, which darkened every crest). It was fixed before release by the two prefixes above.
- **Crest rework (29 September 2026):** Still fixed. The new controls keep the `tsi-crest-field-` prefix and are built inside the Crest.

### CRS-03 · Crest stylesheet restyles every element on the page, not just the crest
**Fixed by the new design** · breaks the tool

- **Before:** The crest's style file doesn't only style its own parts. It also sets the look of every page body, label, dropdown, text box and slider. Loaded into the shared suite unchanged, it would change fonts, colours and sizes in the other tools too.
- **After (planned):** Must do in the rebuild: scope every rule under a crest root class (e.g. .tsi-crest label), give the classes a crest- prefix, and take body and page-wide styling from the shared design tokens.
- **Decision note:** Namespacing rule: styles prefixed and scoped to the tool.
- **Evidence:** styles.css:13-21 (*, html, body with background #080707 and a system font), 150-153 (label), 155-167 (select, input[type=text]), 169-171 (input[type=range]). The classes are also generic (.btn, .panel, .grid, .row, .block, .preview, .bg, .topbar, .wrap, .hint); .btn is also used by the Ritual.
- **Phase 2:** Fixed. Every rule in `tools/crest/crest.css` is scoped under `.tsi-tool--crest` and every class starts `tsi-crest-`. The page-wide styles come from the shared tokens. A test reads the stylesheet and checks it.
- **Crest rework (29 September 2026):** Still fixed. The new styles are scoped and prefixed the same way; the test still reads the stylesheet.

### CRS-04 · Round shield has a line through the middle and a stick hanging below
**No longer relevant** (removed by the Crest rework; was *Later, Harry's call*) · other

- **Before:** Choosing the Round shield draws a gold line straight down the centre of the shield and a thin 'handle' poking out below it, so it looks like a paddle rather than a round shield. It also appears in the downloaded PNG.
- **After:** Kept as it is in the rebuild.
- **Decision note:** K1
- **Checker's note:** Cosmetic, and in the PNG too. Keep it for the faithful rebuild and ask Harry.
- **Evidence:** shieldPathRound app.js:686-693 draws the circle, then a curve from the top down to y+h-40 and closes back to the top, so the border stroke traces a vertical line. Screenshot 05_round_sun_solid.png and 06_contact_sheet.png (round).
- **Phase 2:** Kept as it is (Harry's answer K1). The Round shield is drawn exactly as before.
- **Crest rework (29 September 2026):** Gone. Harry asked for new shield shapes; the new Round shield is a clean circle.

### CRS-05 · Downloaded PNG uses a different font for the motto than the preview
**Deliberate change** (Harry's answer K4; was *Later, Harry's call*) · other

- **Before:** The motto on screen is in a plain modern font, but the saved picture uses an old-fashioned newspaper-style font instead, because the picture can't see the page's fonts. What you see is not quite what you get.
- **After:** The motto uses the suite's Cinzel font in both the preview and the PNG (see Phase 2).
- **Decision note:** K4 (default: the suite font, embedded so preview and PNG match)
- **Checker's note:** Not a fix-now bug. It is a rebuild decision, because the new suite font would change the preview anyway.
- **Evidence:** No font-family on banner text (app.js:581-583, 595-597, 617-619). Preview font = system sans (styles.css:17); export crop 07b_export_banner_zoom.png shows serif 'HOLD FAST'.
- **Phase 2:** Changed (Harry's answer K4). The motto is now set in the suite's Cinzel font in the preview **and** the PNG. The font file is packed inside the downloaded picture (`tools/crest/data/motto-font.js`, the unchanged Cinzel file as base64), so what you see is what you get. A test checks the PNG really uses it.
- **Crest rework (29 September 2026):** Kept: the motto is still in Cinzel, packed into the PNG.

### CRS-06 · Long mottos spill off the banner and get cut off
**Deliberate change** (Crest rework; was *Later, Harry's call*) · other · listed in the handover

- **Before:** A long motto runs past the ends of the ribbon/plaque/scroll. With 26 wide letters it runs off both edges of the picture and is cut off in the PNG. Even the built-in motto 'In Scarlet We Stand' pokes slightly past the ribbon.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Harry's call later. Not from the handover, which lists it only as a test case.
- **Evidence:** renderBanner fixed font-size 34 and banner width 464 (app.js:572-624). Playwright bbox: 26 W's = x -10, width 1,045 in a 1,024 image; 'In Scarlet We Stand' ribbon = 269-756 vs banner 280-744. Screenshots 03_longbanner_*.png.
- **Phase 2:** Kept as it is. Long mottos still run past the banner.
- **Crest rework (29 September 2026):** Changed. The new ribbon, scroll and plaque are wider, and the lettering shrinks to fit, so even a 30-letter motto (the new limit, up from 26) stays on the banner.

### CRS-07 · Random names have no space between the two words
**Later, Harry's call** · other

- **Before:** Random names come out as 'StormOath' or 'EmberCircle of the Salt Coast' with a capital in the middle and no space, while the starting name is 'Blackstone Wardens'. The file name then becomes e.g. 'EmberCircle_of_the_Salt_Coast.png'.
- **After:** Kept as it is in the rebuild.
- **Decision note:** K2
- **Checker's note:** Faithful: keep it and ask Harry.
- **Evidence:** app.js:15 `${a}${b}${c}`; Playwright random samples 'StormOath', 'EmberCircle of the Salt Coast', 'ScarletKindred'.
- **Phase 2:** Kept as it is (Harry's answer K2): "StormOath", no space.
- **Crest rework (29 September 2026):** Kept: the random name lists and "StormOath" style are unchanged.

### CRS-08 · 'Etched' texture only darkens the shield
**No longer relevant** (removed by the Crest rework; was *Later, Harry's call*) · other

- **Before:** Choosing the 'Etched' texture just makes the whole shield a bit darker; no visible etching pattern appears.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Cosmetic. Keep it.
- **Evidence:** renderTexture etch (app.js:456-464) displaces a plain black rectangle at 25% opacity, so only its edges move. Contact sheet 06_contact_sheet.png, texture row.
- **Phase 2:** Kept as it is.
- **Crest rework (29 September 2026):** Gone. The textures were replaced (Parchment, Grain, Brushed metal, Linen), and each shows its own pattern.

### CRS-09 · Error message tells the user to open the developer console
**Later, Harry's call** · other

- **Before:** If a download fails, the pop-up says 'Open console for details', which means nothing to a non-developer.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Later: use a plain-English message.
- **Evidence:** app.js:210-213
- **Phase 2:** Kept the old wording ("Download failed. Open console for details."), now shown in the suite's own pop-up with the technical details underneath, instead of a browser alert.
- **Crest rework (29 September 2026):** Kept: the same message, if a download ever fails.

### CRS-10 · An invisible control character in the motto makes the download fail
**Deliberate change** (fixed by the Crest rework; was *Later, Harry's call*) · other

- **Before:** If a hidden control character gets into the motto box (only possible by pasting, not by typing), the preview still shows the crest but Download fails with the 'Open console' message. Ordinary typing, including emoji, '&', '<' and quotes, works fine.
- **After:** Kept as it is in the rebuild.
- **Evidence:** Motto set to 'Hold\u0001Fast': the preview renders 'HOLD\u0001FAST', and Download gives no file plus alert 'Download failed. Open console for details.' (run1.out ctrlChar). XMLSerializer outputs the character raw, so the SVG image is not valid XML and img.onerror fires (app.js:633-645). Tab, emoji and '&' all exported OK.
- **Phase 2:** Kept as it is. A hidden control character pasted into the motto still makes Download fail, with the message above.
- **Crest rework (29 September 2026):** Fixed as part of the new motto drawing: hidden control characters are left out, so the download works. Before: pasting one stopped the download. After: it downloads, without the hidden character.

### CRS-11 · Double-clicking Download saves two copies
**Later, Harry's call** · other

- **Before:** Clicking Download twice quickly saves two identical pictures, e.g. a second copy named 'Blackstone_Wardens (1).png'. Nothing is lost or counted twice; it just leaves an extra file.
- **After:** Kept as it is in the rebuild.
- **Evidence:** page.dblclick('#btnDownload') produced 2 download events, both 'Blackstone_Wardens.png' (run1.out doubleClickDownloads). The handler has no busy flag (app.js:201-214).
- **Phase 2:** Kept as it is: a double click still saves two copies. The tests check this still happens, so it isn't changed by accident.
- **Crest rework (29 September 2026):** Kept: a double click still saves two copies. The tests check it.

### CRS-12 · Some clan names give a wrong or odd file name
**Checked: not a bug** · other

- **Before:** The 'Saved as' hint can differ from the real saved file: a name of '...' shows '....png' but saves as 'png.png'. In the test browser, any name with an accent, curly apostrophe or emoji (e.g. 'Café Oath', 'Tide’s Oath') saved as 'download' with no .png ending. This last part may be a quirk of the test browser and is not confirmed in normal Chrome.
- **After:** Kept as it is in the rebuild.
- **Decision note:** Refuted by the checker: the "download" file names came from the test machine's language setting. Only the "..." name mismatch remains (trivial).
- **Evidence:** safeFileName app.js:278-285 only strips / \ : * ? " < > | and spaces. Playwright run2.js/run3.js/run4.js (a plain test link with 'Café Oath.png' also became 'download', so possibly headless-only).
- **Phase 2:** Kept as it is: the same file-name clean-up as the old tool.
- **Crest rework (29 September 2026):** Kept: the same file-name clean-up.

### CRS-13 · "Scarlet" with one t where it means the Scarlett Isles
**Deliberate change** (Harry's answer K3, 25 September 2026)

- **Before:** The random place "of the Scarlet Isles" and the random motto "In Scarlet We Stand" spelled the Isles with one t.
- **After:** Both have two t's: "of the Scarlett Isles" and "In Scarlett We Stand". Harry decided the motto means the Isles. Where "Scarlet" is the colour, it keeps one t: the "Scarlet" first word in random names (like Black, Iron and Ember) and the "Scarlet & Gold" palette.
- **Evidence:** app.js:7, 9, 55, 258. The tests check the spellings.
- **Crest rework (29 September 2026):** Kept: the name lists and mottos keep these spellings.

### CRS-14 · Download, Random Crest and Reset are below the fold on the laptop
**Fixed by the new design** · layout (SUI-10)

- **Before:** In a maximised window on Harry's laptop (1707 × 930), the Download button was half off the bottom of the screen, and Random Crest and Reset were fully below it. The page was 1,042 px tall.
- **After:** The four control groups sit two by two beside the preview. Every control, the preview and Download are in view at 1707 × 930, in full screen and on the TV, with no sideways scroll. The preview crest grows with the window's height.
- **Evidence:** Measured in the planning and phase 2 sessions; tests/e2e/phase2.test.js "Fits the laptop and the TV".
- **Crest rework (29 September 2026):** Still fixed. The new tabbed controls, the crest and Download all fit the laptop (in a window and full screen) and the TV, on every tab, with no sideways scroll. Switching tabs doesn't move anything.

### CRS-15 · The Crest forgets your design when you leave it
**Deliberate change** (Harry's request, 1 October 2026) · other

- **Before:** The Crest saved nothing, as in the old tool. Going Home, switching tool or closing the window lost the design, without asking.
- **After:** The design is saved as you go and comes back next time. The Crest now has Export and Import in the top bar and is included in "Back up everything", like the tools that always saved. It keeps one design: Random Crest and Reset replace it, without asking, as before. A saved design is checked when it loads: a choice that no longer exists (such as the old Kraken sigil) goes back to its default and the rest is kept, and a save that isn't a design at all is set aside, never deleted.
- **Evidence:** `tools/crest/tool.js` (saving), `tools/crest/rules.js` `cleanDesign` and `importProblem`; tests in `tests/rules/crest.test.js` ("remembering your design") and `tests/e2e/phase2.test.js` ("Remembering your design").

### CRS-16 · Use for the Bastion
**Deliberate change** (the Bastion overhaul's Build 3, 8 October 2026) · other

- **Before:** To use a crest in the Bastion, you downloaded the PNG, went to the Bastion and uploaded it.
- **After:** **Use for the Bastion**, beside Download PNG, sends a 512 × 512 see-through PNG of the crest and its design straight to the Bastion (SUI-26), which asks whether to use it. A notice says whether the Bastion's window asks now or when it next opens, with an Open the Bastion ↗ button when it's shut. It's drawn from the crest's own drawing, never a bundled picture, so it works from a double-clicked file, as Download PNG does.
- **Evidence:** `tools/crest/tool.js` (`sendToBastion`, `svgToPngData`), `tools/crest/crest.css`; tests in `tests/e2e/phase2.test.js` ("Use for the Bastion").

## Arenas of The Scarlett Isles
Old repo: `_legacy/arenas-of-the-scarlett-isles` (file:line references point there).

### ARN-01 · Tool won't start when index.html is double-clicked
**Must fix** · won't work double-clicked / offline

- **Before:** The arena list is loaded in a way browsers block for files on your laptop. Opening the old page from a folder shows the layout but nothing works: the Arena and Round lists are empty and the buttons do nothing.
- **After (planned):** Store the arena data as a .js data file loaded with a normal script tag (window.TSI_DATA.arenas). No values change.
- **Checker's note:** load() runs before the fetch (1856), so an old save is never damaged even when the tool fails to start.
- **Evidence:** app.js:1858 fetch('data/arenas.json'). Test t1: 'Fetch API cannot load file:///…/data/arenas.json. URL scheme "file" is not supported.', pageerror 'Failed to fetch', 0 dropdown options.
- **Phase 6:** Fixed. The arenas load from `tools/arenas/data/arenas-data.js` with a plain script tag, word for word the same as the old `arenas.json`. Test: from a double-clicked file with the internet off, the Arena and Round lists fill and Enter The Arena works.

### ARN-02 · Apply can deal one hit's damage again and again
**Must fix** · applies something twice · listed in the handover

- **Before:** After one successful attack, every extra click on Apply rolls and deals the damage again, with the hit picture and sounds each time. Re-rolling the attack also allows another Apply.
- **After (planned):** Keep the turn's attack result as data and refuse a second Apply once damage has been applied. Ask Harry whether re-rolling the attack should also be locked after damage is applied.
- **Decision note:** A5 decides once per turn or once per attack roll (default: once per turn).
- **Checker's note:** After the target dies, the DM can switch to another living target in the dropdown and Apply the same hit again.
- **Evidence:** app.js:1617-1653: damageApplied is set at 1652 but never checked; 1587 clears it on each attack roll. Test t2: 3 clicks with damage 10 took Arena Duelist 1 from 45 to 15 HP, and the hit sound played 3 times.
- **Phase 6:** Fixed (Harry's answer A5: once per turn). A turn's damage is applied once. A second Apply, even after re-rolling the attack, says "Damage has already been applied this turn." and changes nothing. Test.

### ARN-03 · Round prize can be paid more than once
**Must fix** · applies something twice · listed in the handover

- **Before:** After a round is won and the prize paid, pressing End Round then 'Count as Win' pays the prize again. It works every time, including after closing the results panel.
- **After (planned):** Record that the round is finished and the prize paid, and pay the prize at most once per round. After a result, turn off End Round, Forfeit and Play Turn until the next round starts or Leave Arena is pressed.
- **Checker's note:** After a Defeat, End Round → Count as Win also pays the prize. The same 'round finished' flag covers this.
- **Evidence:** endRound adds reward_gp on every call (app.js:1244-1248); the End Round button has no 'already finished' check (1949-1969). Test t2: gold went from 500 to 1000 on a round already cleared.
- **Phase 6:** Fixed. A round's result is recorded once. The prize is paid once and saved, and Play Turn, End Round and Forfeit turn off until the next round starts or Leave Arena is pressed. This also covers the checker's case (Count as Win after a Defeat). Test.

### ARN-04 · The round keeps running after it has been won or lost
**Must fix** · applies something twice

- **Before:** When a round ends, the tool doesn't mark it as over. Play Turn still works, overtime keeps hurting players, and reaching the target again pays the prize again.
- **After (planned):** Use the same 'round finished' flag as the prize fix.
- **Checker's note:** Forfeit after a win still shows a Defeat dock, and the crowd loop keeps playing until Leave Arena.
- **Evidence:** endRound never sets runActive = false (app.js:1240-1296); openTurnDock only checks runActive (1396). Test t2: after 'Round Cleared', Play Turn plus Resolve raised gold from 1000 to 1500 and applied overtime damage.
- **Phase 6:** Fixed, with ARN-03. After a result, Play Turn is off, so no more turns, overtime or prizes, and Forfeit is off, so a win can't be followed by a Defeat panel. The crowd keeps playing until Leave Arena, as before. Test.

### ARN-05 · When storage is full, every portrait is erased and a 'not added' player comes back
**Must fix** · loses saved data

- **Before:** If the laptop's browser storage is full, adding a player with a picture says 'Storage is full… Try a smaller image' and appears not to add them. Behind the scenes the tool saves anyway without anyone's pictures. After a reload that player is back, and every player's portrait is gone. Any later save while storage is tight also quietly strips all portraits. All double-clicked pages share one storage area, so another tool filling it (for example the Battlemap's saved maps) can trigger this.
- **After (planned):** Save through the shared save module. If storage is full, keep the last good save exactly as it was, tell Harry clearly, and keep memory and storage in step. Never drop portraits silently.
- **Checker's note:** The chosen fix is right: keep the last good save, keep memory and storage in step, and tell Harry.
- **Evidence:** app.js:211-219 (strips all images and saves), 1839-1846 (only memory is rolled back). Test t5: with storage filled, adding 'Cael' with a portrait showed the alert; memory held [Runa(portrait), Bram(portrait)] while storage and the reloaded page held [Runa, Bram, Cael] with no portraits. Origin check: location.origin 'file://' is shared by other file pages.
- **Phase 6:** Fixed. The party saves through the suite's shared saving, which never strips portraits. If the browser's storage is full, a warning bar says so and offers Export. The player stays on screen with their portrait, and the save catches up on the next change. Test with a storage that pretends to be full.

### ARN-06 · Fonts come from the internet
**Must fix** · won't work double-clicked / offline

- **Before:** The Lion's Mark lettering uses fonts downloaded from Google. With no Wi-Fi it falls back to a plain serif.
- **After (planned):** Use the suite's locally bundled Cinzel and IM Fell English SC.
- **Checker's note:** Nothing breaks. Only the Lion's Mark lettering (styles.css:532, 594) falls back to Georgia. It is still a CLAUDE.md 'no online resources' item.
- **Evidence:** index.html:8-10; test: requestfailed fonts.googleapis.com ERR_CERT_AUTHORITY_INVALID
- **Phase 6:** Fixed. The Lion's Mark lettering uses the suite's bundled Cinzel. Test: the fonts load with the internet off.

### ARN-07 · Double-clicking Play Turn uses up two turns and skips a player
**Must fix** · applies something twice

- **Before:** If you double-click Play Turn, or click it again while a turn is already open, the tool counts two turns. The player whose turn it should have been is skipped, and overtime arrives a turn early. In the Lion's Mark round it can also re-pick the mark and blow the horn again.
- **After (planned):** Ignore Play Turn while a turn is already open. Whether a cancelled turn should count stays Harry's call.
- **Evidence:** openTurnDock adds to the turn counter and the rotation on every call, with no check for a turn already open (app.js:1411, 1437, 1422-1433). Run t2.js: the turn counter went 1→3 after one double-click, and the active player shown was Cael (Bram skipped).
- **Phase 6:** Fixed. While a turn panel is open, Play Turn does nothing, and a double click counts once. Test: a double click and then another click give turn 1, for the first player.

### ARN-08 · Double-clicking Add with a portrait adds the player twice
**Must fix** · applies something twice

- **Before:** When you add a player with a picture, a quick double-click on Add creates two copies of that player, each with the portrait. Both are saved.
- **After (planned):** Turn off the Add button while the portrait is being processed. Accept only one submit per open form.
- **Evidence:** The submit handler is async and waits while the portrait is shrunk (app.js:1833), before it adds the player (1837) and closes the form (1849), so a second submit gets through. Run t4.js: stored players ['Runa:4391','Runa:4391'] after one double-click. Without a portrait, no duplicate appeared.
- **Phase 6:** Fixed. Add turns off while the portrait is being shrunk, and each form adds one player. Test: two submits in a row add one player.

### ARN-09 · Replaying Lion Totems shows the swordsmen already dead
**Fixed by the new design** · other

- **Before:** If you play the Lion Totems round again in the same session, the picture shows both swordsmen dead from the start, even though they are back at full health.
- **After (planned):** The rebuild's per-round state starts fresh each round, which removes this. Record it in KNOWN_ISSUES.
- **Decision note:** Each round starts from fresh state.
- **Checker's note:** Display only. A fresh per-round state in the rebuild removes it.
- **Evidence:** state.mmR2Dead is created at app.js:420 and never reset by resetRunState (999-1017) or startRound (1019-1034). Test t4: on re-entering mm_r2 the overlay was lion_swordsman_both_dead.png while both had 90 HP.
- **Phase 6:** Fixed. Every round starts with fresh tracking of who has fallen. Test: replaying the Lion Totems shows both swordsmen standing.

### ARN-10 · Rules panel is cut off on laptop-sized screens
**Fixed by the new design** · other

- **Before:** On a typical laptop screen, the bottom of the rules panel (the list of approaches and the Easy/Standard/Hard DCs) is hidden and can't be scrolled to. The DCs still appear in the turn panel's dropdown.
- **After (planned):** Let the dock scroll in the rebuilt layout (a layout change, not a rule change). Ask Harry for his laptop's screen size.
- **Decision note:** Covered by the laptop/TV layout requirement.
- **Evidence:** styles.css:180 sets the dock lane height to max calc(100vh - 92px - 220px) with overflow hidden (185); #dockBody has overflow hidden, 'no scrolling in dock' (307-308). Run t8.js: at 1366x768 the rules body was 302px against 478px of content, with approaches and DCs clipped. At 1280x720 the Win/Lose card was clipped too; nothing was clipped at 1920x950. Screenshot v8_rules_1366x768.png. The turn panel's controls were not clipped at any size tested.
- **Phase 6:** Fixed. The turn panel has its own column beside the arena picture and scrolls if it must. The Round Console sits under the picture, so Play Turn is always in view. On the laptop (in a window and full screen) and the TV, the rules panel shows everything down to the DCs, and the whole turn panel, Play Turn and the top controls are in view with no sideways scroll. In a window narrower than about 1400 px, the party moves under the picture and the page scrolls down. Tests at four sizes.

### ARN-11 · Pass or fail is read from the tick symbol, and choices can be changed after rolling
**Later, Harry's call** · other · listed in the handover

- **Before:** Resolve Turn works out pass or fail by looking for the green tick on screen, and it reads the approach and difficulty as they are when you click Resolve, not when you rolled. A player can roll at Easy, then switch to Hard Animal Handling and claim the Beast-Pen double success. The skill check can also be re-rolled freely.
- **After:** Kept as it is in the rebuild.
- **Decision note:** A6. The roll is stored as data behind the scenes either way.
- **Checker's note:** The rules module will need the roll stored as data anyway (a behind-the-scenes change). Locking the roll is Harry's call.
- **Evidence:** app.js:1738-1740 (tick check and dropdowns read at resolve time); mem.skill stored at 1572 but never used. Test t3: Bram rolled Nature at Easy (DC 16), switched to Hard plus Animal Handling, and the log said 'Bram mastered the beast line (Hard): +2 successes'.
- **Phase 6:** Kept (A6). The roll is now kept as data behind the scenes, but, as before, the approach and difficulty are read when Resolve Turn is pressed, and the skill check can be re-rolled.

### ARN-12 · 'All opponents down' overrides a win or loss on the same turn
**Later, Harry's call** · other · listed in the handover

- **Before:** If the last enemy falls on the same turn the party hits its failure limit (or is wiped out), the tool doesn't declare defeat. It just says the round 'can end now' and leaves it to the DM. Reaching the success target also beats a loss from overtime on the same turn.
- **After:** Kept as it is in the rebuild.
- **Decision note:** A2
- **Checker's note:** Not re-run at runtime, but the code order is clear. It is a rules question for Harry.
- **Evidence:** app.js:1784-1798. Test t3: failures 3/3 with both duelists at 0 gave 'Opponents defeated. Round can end now.' and no Defeat. In r5, overtime pushed failures to 2/2 while successes reached 12, which was scored as a win (+50,000).
- **Phase 6:** Kept (A2). Rules test.

### ARN-13 · Lion Totems can be won without breaking a single totem
**Later, Harry's call** · other · listed in the handover

- **Before:** The round text says you win by shattering the three totems, but reaching 8 successes also wins. Breaking all three totems doesn't end the round by itself; the DM still has to press End Round.
- **After:** Kept as it is in the rebuild.
- **Decision note:** A1
- **Checker's note:** Rules question for Harry.
- **Evidence:** arenas.json:228, 238-240 vs app.js:1765, 1790. Test t4: 8 successes with all totems at 45 HP gave 'Round Cleared' and +8000 gold; three totems down gave only a status message.
- **Phase 6:** Kept (A1). Test: breaking all three totems says the round can end now; End Round then counts the win.

### ARN-14 · A cancelled turn still counts
**Later, Harry's call** · other

- **Before:** Opening Play Turn and then pressing Cancel (or opening View Rules or Add Player mid-turn) still uses up a turn and moves on to the next player. The skipped player loses their go and overtime arrives a turn early.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** The double-click form of this is a separate new bug (applies_twice).
- **Evidence:** app.js:1411 and 1437 advance turn and turnIndex before anything is rolled; Cancel just hides the dock (1546). Test t2: Bram's turn was cancelled, the next turn went to Cael, and overtime damage started at turn 7 after only 6 real turns.
- **Phase 6:** Kept. Test: a cancelled turn moves on to the next player.

### ARN-15 · Leaving the arena leaves the enemy picture and the Lion's Mark badge on screen
**Later, Harry's call** · other

- **Before:** After 'Leave Arena', the last enemy picture and the Lion's Mark name can stay over the arena even though no round is running.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** If a 5.2 s restore timer is still pending, it hides the layer later. The HUD stays either way.
- **Evidence:** The Leave Arena handler (app.js:1285-1293) calls resetRunState (999-1017), which never refreshes the scene or the HUD. Test t4 screenshot t4_after_leave.png: the Lion Knight and the 'Cael' mark were still showing after 'Run ended'.
- **Phase 6:** Kept. Test: after Leave Arena, the last picture and the Lion's Mark stay on screen.

### ARN-16 · Missed attacks show no picture in four rounds
**Later, Harry's call** · other

- **Before:** In the Duelist rounds (until a duelist falls), the Wyvern Rite and the Lion's Mark, a missed attack plays the failure sound but shows no failure picture. The code looks for a data entry that doesn't exist.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** The four rounds are r1 and mm_r1 (before a duelist falls), r5 and mm_r3.
- **Evidence:** getFailOverlaySrc returns overlays.pc_fail (app.js:494, 504), but no round has that key (script check). showOverlay ignores an empty source (746). Test t3: the r1 and r5 overlays stayed on standard while wyvern_fail.mp3 and crowd_fail.mp3 played.
- **Phase 6:** Kept. Test: a missed attack in the Arena Duelists round plays the sounds and shows no picture.

### ARN-17 · Middlemount Opening Bout shows both duelists on a failure after one has fallen
**Later, Harry's call** · other

- **Before:** In Middlemount Round 1, once a duelist is down, a failed skill check still shows the 'both duelists' failure picture. Swyth Round 1 correctly shows the one remaining.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Checked by reading the code only.
- **Evidence:** The r1-only branch at app.js:1172 (mm_r1 drops to the generic path at 1181). Test t4: after Duelist 1 fell in mm_r1, a skill failure showed arena_duelists_fail.png.
- **Phase 6:** Kept.

### ARN-18 · Damage with a bonus becomes a tiny number
**Later, Harry's call** · other

- **Before:** Typing damage like '2d8+3' isn't understood. The tool quietly deals 2 damage (the first digit).
- **After:** Kept as it is in the rebuild.
- **Decision note:** A7
- **Evidence:** app.js:1641-1645 (/^\d+d\d+$/ test, then parseInt). Test t4: '2d8+3' gave 'Damage applied: 2'.
- **Phase 6:** Kept (A7). Rules test: "2d8+3" deals 2.

### ARN-19 · Defeat message always names the Swyth trials
**Later, Harry's call** · other

- **Before:** Losing at Middlemount still says 'The Salt-Ring Trials end here.'
- **After:** Kept as it is in the rebuild.
- **Decision note:** A8
- **Evidence:** app.js:1254; test t4 mm_r3 defeat subtitle
- **Phase 6:** Kept (A8). Test: a Middlemount defeat says "The Salt-Ring Trials end here."

### ARN-20 · Round list doesn't follow 'Proceed to Next Round'
**Later, Harry's call** · other

- **Before:** After moving to the next round, the Round dropdown still shows the old round. Reloading before the first turn of the new round sends you back a round.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Fixed as soon as the first Play Turn saves (1711).
- **Evidence:** startRound (app.js:1019-1051) neither refreshes the dropdowns nor saves. Test t6: state r4 with the dropdown showing r1; after reload roundId was r1.
- **Phase 6:** Kept. Test.

### ARN-21 · Breaking the last totem with the side-panel buttons doesn't topple the guardians
**Later, Harry's call** · other

- **Before:** The 'last totem falls, guardians withdraw' rule only works through the turn dock's Apply button, not when the DM lowers a totem's HP with the Opponents panel buttons.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** The survey said this wasn't runtime-tested; it now is.
- **Evidence:** The rule exists only at app.js:1670-1686; the enemy card handler (939-995) has none. Found by reading the code; not tested at runtime.
- **Phase 6:** Kept.

### ARN-22 · Round progress is lost on reload
**Later, Harry's call** · other · listed in the handover

- **Before:** Refreshing the page mid-round keeps the party's HP and gold but forgets the round: score, turn, enemies, Lion's Mark and Beast-Pen bonuses. Entering again restarts the round with the party still hurt.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Not a regression. The old tool never saved it.
- **Evidence:** app.js:199-206; test t3 before and after reload
- **Phase 6:** Kept. Only the party, gold and chosen arena and round are saved, as before.

### ARN-23 · Lion's Mark round is lost on the first turn if two players are already down
**Later, Harry's call** · other

- **Before:** HP carries over between rounds. If two players reach 0 HP in the Lion Totems round, the Lion's Mark round ends in Defeat after its very first turn, even when that turn is a success.
- **After:** Kept as it is in the rebuild.
- **Decision note:** A3
- **Evidence:** defeatByTwoDown counts every player at 0 HP (app.js:1771-1772), and startRound never heals (1019-1051). Run t7.js: with Cael and Dara set to 0 before mm_r3, the first turn was a success (1/10) and the Defeat dock appeared (screenshot v7_mm_r3_pre_down_defeat.png).
- **Phase 6:** Kept (A3). Rules test.

### ARN-24 · An unreadable portrait makes Add silently do nothing
**Later, Harry's call** · other

- **Before:** If you pick a picture the browser can't open (for example an iPhone HEIC photo), clicking Add does nothing and shows no message. The player isn't added.
- **After:** Kept as it is in the rebuild.
- **Evidence:** Image decode failure rejects (app.js:179-184), and the submit handler has no error handling (1823-1834). Run t9.js with a fake .png: pageerror 'Uncaught (in promise) #<Event>', the player was not stored, the form stayed open and no dialog appeared.
- **Phase 6:** Kept. The failed picture no longer causes a hidden error, but Add still does nothing visible and the form stays open. Test.

### ARN-25 · Footer gold doesn't update after a win
**Later, Harry's call** · other

- **Before:** After a round is won, the gold counter under the arena still shows the old total until the next turn or reset. The results panel shows the right figure.
- **After:** Kept as it is in the rebuild.
- **Evidence:** resolveTurnFromDock refreshes the stats (1781) before endRound adds the prize (1246); endRound never calls renderHeaderStats. Run t10.js: footer gold 0, results panel 'Total gold' 500, stored totalGold 500.
- **Phase 6:** Kept. Test: after a win the footer still shows the old gold until the next change.

### ARN-26 · Removing an opponent with Remove doesn't update the death pictures in Middlemount
**Later, Harry's call** · other

- **Before:** In Middlemount Round 1 and the Lion Totems round, using Remove on an opponent leaves its picture standing, as if it were still alive. Swyth Round 1 and the Beast-Pen handle Remove correctly.
- **After:** Kept as it is in the rebuild.
- **Evidence:** The card handler records deaths on Remove only for r1/r4 (app.js:944-945, 984-989). mm_r1/mm_r2 pictures are worked out from the HP of enemies still in the list (343-357, 433-434, 444-447). Run t10.js: mm_r1 after removing Duelist 1 still showed arena_duelists_standard.png (r1 showed defeated_1). mm_r2 after removing Totem 1 and Swordsman 1 still showed both standard overlays.
- **Phase 6:** Kept.

### ARN-27 · Changing the Arena or Round list, or pressing Enter The Arena, wipes a round in progress without asking
**Later, Harry's call** · other

- **Before:** Mid-round, touching the Arena or Round dropdown resets the whole round (score, turn, opponents) with no 'are you sure?'. Pressing Enter The Arena again restarts the round from scratch. Damage the party has taken stays.
- **After:** Kept as it is in the rebuild.
- **Evidence:** The select change handlers call resetRunState directly (app.js:1872-1889). enterArenaBtn calls startRound unconditionally (1891-1895), which zeroes the score and respawns enemies (1025-1042). Found by reading the code.
- **Phase 6:** Kept. Leaving the tool mid-round now asks first (Harry's answer 7), but changing the lists or pressing Enter The Arena still restarts the round without asking, as before.

## The Heartwood Ritual
Old repo: `_legacy/tellurian-ritual-engine` (file:line references point there).

### RIT-01 · Reset Ritual crashes and leaves the old ritual on screen
**Must fix** · breaks the tool

- **Before:** Pressing Reset Ritual in the DM Dock clears the ritual behind the scenes, but the screen keeps showing the old rounds, pips and 'Seal set' text until you click something else, and the 'Ritual reset.' message never appears.
- **After (planned):** Rebuild reset as 'create a fresh ritual state, stop the finale timers, then redraw'. Clear armed assists and restore the heartbeat state at the same time.
- **Checker's note:** The state really is reset; only the screen update and the 'Ritual reset.' toast are lost, because the error is thrown before renderAll (1318). It still counts as breaking the tool, because the DM sees the Reset button apparently do nothing. Rebuild Reset as a fresh state plus a redraw.
- **Evidence:** ritual.js:1316 sets logEl.innerHTML where logEl is null (the #log element doesn't exist), so an error is thrown before toastMsg/renderAll (1317-1318). Test: pageerror 'Cannot set properties of null (setting innerHTML)'; the screen still showed p3/s1 and 'Dormant' after reset, then zeros after the next click.
- **Phase 5:** Fixed. Reset starts a completely fresh ritual and redraws the screen: the round, pips, stones, threat, event and Pulse go back to the start, any film or Final Seal screen closes, and "Ritual reset." shows. Test.

### RIT-02 · Silence stone buttons are off-screen on common laptop screens
**Must fix** · breaks the tool

- **Before:** On a 1366x768 or 1536x864 laptop screen, or 1280x720, the Silence stone's Attempt and Assist buttons sit below the bottom of the window and the page won't scroll, so you can't click them.
- **After (planned):** Lay out the rebuilt stage (with the suite's top bar) so all three stones' buttons fit and work at 1366x768. Check with Playwright at 1366x768 and 1536x864.
- **Checker's note:** The DM Dock has no Silence Attempt, so zooming out (Ctrl -) is the only workaround. The rebuilt layout, with the suite top bar on top, must fit at 1366x768 in a normal window. Ask Harry what his screen size is.
- **Evidence:** styles.css:51 body overflow:hidden; styles.css:182 arena height; styles.css:292 .stone--bottom bottom:-24px. test5: Silence button centre off-screen at 1366x768 (bottom 794 > 768), 1536x864 and 1280x720; fine at 1440x900 and 1920x1080.
- **Phase 5:** Fixed. The arena is drawn at the old tool's size and scaled to fit the window, keeping its shape: about 91% on the laptop, full size on the TV. Every stone's Attempt and Assist and the main buttons are in view on the laptop, full screen, the TV and a 1280 × 720 window. Tests at all four sizes.

### RIT-03 · Stone crack pictures never show when opened as a file
**Must fix** · won't work double-clicked / offline

- **Before:** The cracks that should spread over a stone as it takes stress don't appear when you double-click the page, because the tool looks for the pictures in the wrong folder.
- **After (planned):** Remove the GitHub Pages path helper and use relative paths.
- **Checker's note:** This happens on every double-click, internet or not. It is a file-path problem rather than an internet one. styles.css:30-32 already defines --img-crack-1..3 relative to the stylesheet, and those would work from file://, but nothing uses them.
- **Evidence:** ritual.js:37-47 withBase and 515-517; test: url("/home/assets/img/cracks_1.png") ERR_FILE_NOT_FOUND
- **Phase 5:** Fixed. The crack pictures come from the Ritual's own folder. Test: the first cracks show after a failed roll.

### RIT-04 · Wyvern and ending cinematics need the internet
**Must fix** · won't work double-clicked / offline · listed in the handover

- **Before:** The Wyvern video and all three ending videos are downloaded from GitHub while you play. With no Wi-Fi they don't play at all; the screen just skips them.
- **After (planned):** Bundle the four videos locally (two from the release; the other two are already identical files in the repo) and point to them relatively. Keep the missing-video fallback.
- **Checker's note:** from_handover is correct. Bundle the files locally: 2 are byte-identical to files already in the repo (md5 c06f1501 and dd080aaa); true_seal and strained_binding exist only in the release.
- **Evidence:** ritual.js:31-34; test: every cinematic request failed and the overlay closed via the error handler (ritual.js:327-338)
- **Phase 5:** Fixed. The four films are in `tools/ritual/assets/video/` and play inside the page with no internet. If a film can't play it closes, as before, and a waiting Final Seal still follows. The test browser can't play MP4 films, so playing them is on Harry's Edge checklist.

### RIT-05 · Fonts need the internet
**Must fix** · won't work double-clicked / offline

- **Before:** The engraved Cinzel headings and old-style body font come from Google, so offline the tool falls back to a plain serif.
- **After (planned):** Bundle both fonts locally with their licences.
- **Checker's note:** The page falls back to Georgia or the default serif, so it doesn't break, but the tool depends on Google Fonts to look right.
- **Evidence:** styles.css:3; test: request to fonts.googleapis.com failed
- **Phase 5:** Fixed. Cinzel and IM Fell English come from the suite folder. Test.

### RIT-06 · The Husk's 50% chance is rolled several times per click, and threats can appear from screen refreshes
**Must fix** · applies something twice · listed in the handover

- **Before:** The coin-flip for a Husk is supposed to be one 50% chance, but it's re-flipped every time the screen redraws, sometimes 4 times for one click (about a 94% chance). Even harmless DM Dock clicks like +Progress then -Progress or stepping a round back can summon a Husk, Buckbear or Wyvern.
- **After (planned):** Move the threat and ending checks into one explicit step that runs once per game action (or at a moment Harry chooses), store the result, and keep redraws display-only. Needs Harry to confirm when the roll should happen.
- **Decision note:** R2 decides when the one roll happens (no default).
- **Checker's note:** One 50% chance is applied up to 4 times in one action, so it fits the 'applies twice' category, and the handover asks for it to be fixed. Fixing it will make Husks appear noticeably less often, which changes the game balance, so Harry must say when the one roll should happen before it is built.
- **Evidence:** ritual.js:679 Math.random() < 0.5 inside updatePulse (558), called by renderAll (554) from 13 places (887, 893, 902, 909, 932, 954, 973, 988, 1007, 1022, 1027, 1318, 1387). test F: 4 rolls from one Veinwood Thrum, 2 from a ±Progress pair, 1 from ◀, and a Husk spawned from a dock +Progress.
- **Phase 5:** Fixed as Harry chose (R2): the Husk's 50% roll and the Buckbear and Wyvern checks happen once, when Next Round moves the round on. Stress piling up, Dock clicks and stepping a round back never summon anything. Husks will appear less often than before, which is what R2 means. Tests, including one where the old tool summons a Husk from a Dock click and the rebuild doesn't.

### RIT-07 · Double-clicking Next Round skips a round
**Must fix** · applies something twice

- **Before:** A quick double-click on Next Round (or pressing N twice) advances two rounds, and any Husk or Buckbear gets to hurt the stones twice.
- **After (planned):** Ignore repeat clicks and key presses on Next Round for a moment (or until the round change has finished).
- **Checker's note:** The guard needs to cover the mouse, the N key and Enter/Space on a focused button. Double-clicking at round 7 with no threat would jump straight to the finale.
- **Evidence:** ritual.js:935-1023 has no guard, and a normal advance shows no banner to catch the second click (1020-1022). test K: a double-click went from round 1 to 3; N N went from 3 to 5.
- **Phase 5:** Fixed. Next Round (its button, the Dock's, N, or Enter or Space on the button) ignores a second press within 0.6 seconds, and holding N down counts once. Tests.

### RIT-08 · The same Heartwood event can be applied again
**Must fix** · applies something twice · listed in the handover

- **Before:** Nothing stops Apply Event being pressed again for the same event in the same round, so its stress lands twice. A very fast double-click is currently caught by the full-screen banner, but a second press a few seconds later applies it again.
- **After (planned):** At minimum, add explicit double-click protection that doesn't rely on the banner. Whether an event may be applied only once per round is Harry's call.
- **Decision note:** Accidental double presses only; R3 decides whether an event may be applied again later in the round.
- **Checker's note:** Only the accidental double press (mouse or keyboard) is a fix-now item. Whether an event may be applied once per round is a rule for Harry to decide. Keep the guard even if the rebuilt banner stops catching clicks.
- **Evidence:** ritual.js:926-933 has no 'already applied' check. test K: a double-click added +1 stress only (the second click landed on the banner); a click after the banner cleared added another +1. test E: Veinwood Thrum applied twice.
- **Phase 5:** Fixed. Apply Event ignores a second press within 0.6 seconds, by mouse or keyboard; applying the same event again later still works (R3). Tests.

### RIT-09 · Clicking Enable Sound twice plays two heartbeats
**Must fix** · applies something twice

- **Before:** If you press Enable Sound again (it still looks clickable), a second heartbeat starts on top of the first, and the first can't be stopped.
- **After (planned):** Make the button do nothing once sound is on (or a true on/off switch if Harry wants one).
- **Decision note:** R8 decides on/off switch vs enable-only.
- **Checker's note:** Also, the button already says 'Sound Enabled' before play() is tried (178-180 run before 184), so if play() fails it still claims sound is on.
- **Evidence:** ritual.js:155-191 creates new Audio objects every click; test C: 12 Audio objects and 2 looping heartbeats playing
- **Phase 5:** Fixed (R8: Enable Sound only, no off switch). Once sound is on, Enable Sound does nothing more, so there's only ever one heartbeat. If the browser refuses sound, the button stays ready to try again. Test.

### RIT-10 · Reset doesn't clear armed assists, finale timers or the paused heartbeat
**Fixed by the new design** · other

- **Before:** An assist armed before Reset still applies in the new ritual (e.g. an extra stress on the next failed Weight roll). After a True Seal the heartbeat stays silent after Reset until Enable Sound is pressed again.
- **After (planned):** Covered by the Reset rebuild (fresh state, clear timers).
- **Decision note:** Reset is rebuilt as a fresh ritual state that also clears assists and timers.
- **Checker's note:** The Reset fix covers this. The finale timers can't really fire after a Reset, because the seal overlay (z-index 200) covers the Dock until its 5.2 s timer ends.
- **Evidence:** ritual.js:1282-1319 never touches state.assistPending, the finaleSlowdown interval (758-765) or the seal timeout (778-781). test J: a failed Weight after reset gave +2 stress.
- **Phase 5:** Fixed. Reset clears armed Assists and the Final Seal's timers and screen, closes any film, and brings the heartbeat back. Tests.

### RIT-11 · Silence Assist slot overrides the slot typed in the attempt
**Later, Harry's call** · other · listed in the handover

- **Before:** If a Silence Assist is armed, whatever slot you type in the attempt box is silently ignored and the assist's slot is used, even though the code comment says the DM can override it. The assist preview also always shows the DC for slot 0.
- **After:** Kept as it is in the rebuild.
- **Decision note:** R6
- **Checker's note:** The handover flags this too (from_handover true). It is a rule to confirm with Harry, not something to fix now.
- **Evidence:** ritual.js:1232-1239 (preset wins); 1036 and 1082-1083 (preview reads a box just reset to 0). test D: assist slot 0 plus typed slot 9 with roll 9 failed at DC 12.
- **Phase 5:** Kept (R6). Test: the Assist's slot beats the one typed, and its preview shows slot 0.

### RIT-12 · An empty roll counts as a roll of 0
**Later, Harry's call** · other

- **Before:** If you press Apply without typing a number, it counts as a roll of 0 and the stone takes a failure, instead of asking for a number.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** This is Harry's call. It combines with the new 'Enter on Cancel' bug.
- **Evidence:** ritual.js:1176-1180: Number('') is 0, so the 'Enter a numeric roll result' check never fires. test2: an empty Weight attempt gave +1 stress; letters typed into the number box did the same for Memory.
- **Phase 5:** Kept. Rules test.

### RIT-13 · The status line still says 'Binding in progress' after a seal or collapse
**Later, Harry's call** · other

- **Before:** When the ritual seals or all stones crack, the Pulse box keeps saying 'Steady / Binding in progress' until something else is clicked.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** A display-only fix, as the survey says.
- **Evidence:** ritual.js:577-591 writes the labels before the phase changes at 596-634, with no redraw afterwards. test I: t+6 s after the seal still showed 'Steady / Binding in progress'.
- **Phase 5:** Kept. Test.

### RIT-14 · A second cinematic triggered while one is showing is dropped for good
**Later, Harry's call** · other

- **Before:** If an ending is triggered while another video (e.g. the Wyvern's) is still on screen, the ending video is skipped and will never play.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** This can happen from one ordinary event click, so flag it prominently to Harry as a later decision. It also happens if N is pressed during the Wyvern video.
- **Evidence:** ritual.js:238-241 ignores the new video if the overlay is open, but the 'shown' flag was already set (604-606, 626-628, 968-970, 983-985). test4 allCracked: the collapse right after the Wyvern appeared never requested fractured_containment.mp4.
- **Phase 5:** Kept. Test.

### RIT-15 · The heartbeat gets permanently quieter after the first cinematic
**Later, Harry's call** · other

- **Before:** The heartbeat starts at 90% volume, but after any cinematic it comes back at 55%.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Cosmetic.
- **Evidence:** ritual.js:163 (0.90) vs 304 (0.55)
- **Phase 5:** Kept. Test.

### RIT-16 · The narrative log is never shown
**Later, Harry's call** · other

- **Before:** The tool writes a story log (e.g. 'Glyph Fracture', 'Strained Binding'), but the log panel was removed, so nobody sees it.
- **After:** Kept as it is in the rebuild.
- **Decision note:** R10
- **Checker's note:** A question for Harry.
- **Evidence:** ritual.js:697-698 returns early; no #log element in index.html
- **Phase 5:** Kept (R10: no log panel). The log's lines weren't carried across, since nothing showed them.

### RIT-17 · The threat panel still works after the ritual has ended
**Later, Harry's call** · other

- **Before:** After an ending, a leftover threat can still be struck, and beating the Wyvern then still changes the stones.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Harry's call.
- **Evidence:** ritual.js:806-815 has no phase check; test4 wyvernAtRound8 left the Wyvern panel on screen after Strained Binding
- **Phase 5:** Kept.

### RIT-18 · Cracked stones don't look permanently cracked
**Later, Harry's call** · other

- **Before:** The crack picture depends on the stress number, so if a cracked stone's stress is lowered (Wyvern reward, Reprieve, DM Dock) it looks less cracked even though it's dead. Locked stones show no cracks at all.
- **After:** Kept as it is in the rebuild.
- **Checker's note:** Harry's call.
- **Evidence:** ritual.js:513-526 (image by stress, hidden when locked); there is no visual for the cracked flag
- **Phase 5:** Kept.

### RIT-19 · The P key plays the True Seal ending at any time
**Later, Harry's call** · other

- **Before:** A leftover test shortcut: pressing P plays the victory cinematic whenever you like.
- **After:** Kept as it is in the rebuild.
- **Decision note:** R7 (default: remove P)
- **Checker's note:** It does not set pendingFinalSeal, so no seal overlay follows. Ask Harry.
- **Evidence:** ritual.js:1380-1383 'TEMP TEST'; test K confirmed
- **Phase 5:** Changed as Harry chose (R7): the P key is gone. Test.

### RIT-20 · Shortcut keys still work while a cinematic or banner covers the screen
**Later, Harry's call** · other

- **Before:** While a full-screen video is playing, pressing N still moves to the next round and E still rolls a new event behind the video. Pressing N during the Wyvern video shatters the ritual, and the ending video for that is then lost.
- **After:** Kept as it is in the rebuild.
- **Decision note:** R7
- **Evidence:** ritual.js:1368-1384: the window keydown listener only checks whether the modal is open. t2 T7: with the cinematic overlay open, N took the round from 1 to 2 and E changed the event from Root Surge to False Calm, and the overlay stayed open.
- **Phase 5:** Kept (R7: the `, N and E keys stay, and still work behind a film). Test. As in every tool, keys are now ignored while typing in a box (SUI-04), so ` no longer opens the Dock while you type a roll.

### RIT-21 · Important banners are replaced by a later banner in the same click
**Later, Harry's call** · other

- **Before:** When one action causes several things at once, only the last banner stays on screen. A stone cracking from an event or a failed Silence roll shows the event or 'Silence Frays' banner instead of 'GLYPH FRACTURE'. When an event collapses the ritual, 'RITUAL COLLAPSE' is replaced by the event banner. The Wyvern's arrival text plays unseen behind its 47-second video.
- **After:** Kept as it is in the rebuild.
- **Evidence:** t3 T16: a failed Silence attempt at stress 3 ends on the banner 'Silence Frays' (stress 4, cracked), and Echo of What Was at Memory stress 3 ends on the banner 'Echo of What Was'. t2 T6: after the collapse, the banner showing was 'Veinwood Thrum'. Code: applyEvent calls showBanner after ev.apply() (929-930), applyModal Silence at 1246-1261, and spawnThreat at 791-797 shows the banner under the z-index 9999 video.
- **Phase 5:** Kept. Rules test.

### RIT-22 · Pressing Enter with Cancel selected applies the roll
**Later, Harry's call** · other

- **Before:** In the roll window, if the Cancel button is selected and you press Enter, the roll is applied instead of cancelled.
- **After:** Kept as it is in the rebuild.
- **Evidence:** ritual.js:1371-1373: Enter always calls applyModal. t2 T11: with roll 1 typed, Cancel focused and Enter pressed, weight stress went to 1 and the modal closed.
- **Phase 5:** Kept. Test.

### RIT-23 · A beaten Buckbear comes straight back on the next click
**Later, Harry's call** · other

- **Before:** From round 6 onwards, if no stone is locked, beating the Buckbear doesn't help for long. The very next button press, even a harmless DM Dock one, summons a fresh Buckbear at full health.
- **After:** Kept as it is in the rebuild.
- **Evidence:** ritual.js:684-686 runs in updatePulse on every redraw. t2 T8: a Buckbear appeared at round 6, two Heavy Blows beat it (the panel was hidden), then a dock -Progress click on a stone at 0 brought a new Rootbound Buckbear.
- **Phase 5:** Changed by Harry's answer R2: a beaten Buckbear no longer comes straight back on the next click. From round 6 with no stone locked, a new one comes at the next Next Round instead. Rules test.

### RIT-24 · No way to skip or close a cinematic
**Later, Harry's call** · other

- **Before:** Once a video starts, the DM can't stop it. The Wyvern video lasts 48 seconds and the endings 58. If a video never finishes loading, the screen stays black for good.
- **After:** Kept as it is in the rebuild.
- **Evidence:** The overlay closes only on the video's ended or error events (ritual.js:310-339), and there is no close button (index.html:323-333, z-index 9999). In t2 T6 and T7, with the request left hanging, the overlay stayed open until the test forced the video's 'ended' event.
- **Phase 5:** Kept.

### RIT-25 · The time-out endings show no message if their video doesn't play
**Later, Harry's call** · other

- **Before:** At round 8, Strained Binding and Fractured Containment show only a 2-second pop-up line and then the video. If the video is missing (as it is now without internet), the table sees no ending at all. Only the True Seal has a fallback screen.
- **After:** Kept as it is in the rebuild.
- **Evidence:** ritual.js:958-989 has no showBanner in either time-out branch, only toastMsg. By contrast, a True Seal video error still triggers the Final Seal overlay (315-338). The handover's proposed gate (master-handover.md:376) asks for 'correct media fallback' for all three endings.
- **Phase 5:** Kept.

### RIT-26 · The unused cinematics/player.html can't find its video
**No longer relevant** · other

- **Before:** An old leftover video page points to the wrong folder when opened as a file. The tool doesn't use it.
- **After:** Kept as it is in the rebuild.
- **Decision note:** Not ported; the films play inside the Ritual page.
- **Checker's note:** Leave it out of the rebuild.
- **Evidence:** player.html:50-59; test: file:///home/assets/video/ritual_collapse.mp4 not found
- **Phase 5:** Not ported. Nor were the old page's unused film window (an iframe) and its hidden early copy of the Wyvern film, which only helped it start sooner over the internet.

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


### PEL-19 · The Tidal Sequence v2, phase 1: data and rules only (27 October 2026)
**Added, Harry's request** · other · numbered PEL-19 because PEL-12 is already taken by the laptop-fit entry

- **Before:** six runes per pillar; the wall inscription and old ending texts in the data; five Tidal sounds named as `.wav`; no rules for readings, hints, the tide timer, the Anchor dilemma, the finale or returning to the puzzle.
- **After:** nine runes (Life, Remains and Tide added after the first six); wall lines, readings, hint, timer, basin, finale cues, end buttons and Stage Mode settings are in the data file; the new rules are plain functions with tests. The Tidal screen itself is unchanged: its click-to-cycle covers all nine runes, and Shuffle can now use all nine.
- **Live-screen differences:** the start clue and basin clue no longer print the inscription; the success pop-up now reads "The Anchor Lifts" (no door-opening wording about Middlemount's mechanism or the northern arch in the data). `tool.js` still prints its own old status line when the puzzle is solved; phase 3 replaces it. The only code change is that `play()` multiplies a sound's own `volume` into the main volume (a sound with none plays exactly as before, so Memory is unaffected).
- **Harry's decisions (they override the handover):** (1) new sounds use the handover's `.mp3` names, all `ready: false` until the files are in `assets/audio/`; the five old WAVs stay `.wav`; the reversed files are made offline and `water-flow.mp3` is only a source. (2) A Misread never causes a surge: it raises pressure only below 3, otherwise it only shows "The chamber hears the wrong word." (3) "Play the Absence anyway" can return to the puzzle: `snapshotPuzzle` and `restorePuzzle` keep pillars, basin rune, pressure, wall lines, attempts, phase and solved; after a normal solve the end offers Replay and Reset, after "anyway" Replay, Return to the puzzle and Reset, with no automatic focus. (4) Stage Mode hides the Readings panel, the console and the DM extras, and keeps the wall, stage, pillars, basin, pips and pressure meter (key S).
- **Tests:** `tests/rules/pelagosi.test.js`.


### SUI-37 · Session safety and clarity (18 October 2026)
**Fixed, Harry's request** · usability

- **Before:** the Bastion's Clear buttons (Military, Warehouse, Artisan tools, Day Log) and a Warehouse goods row's Remove acted at once. Reset in the Bastion and the Combat Tracker asked once, with no copy offered. Nothing told Harry how long ago he last backed up. Facilities showed "Upgrade" without saying what it unlocks. Research choices that cannot be used yet said "Coming" and could look as though they cost something.
- **After:** each Clear and Remove asks first and says what will be lost (an empty list or a blank row is cleared without asking). Reset offers "download a copy first", ticked by default. The home screen shows "Last backed up: …" (the Explorer and Bastion Exports and Back up everything count), and opening a tool after 7 days without one gives a gentle reminder. Each upgrade row says what the next level unlocks (data only: `levelEffects` in `bastion-data.js`; no rule changed, and no upgrade is blocked). Research choices that are not operational say "Not available yet: it needs …" and cost no token and no gold, as before. Reset Travel's question now explains that the Bastion's calendar moves back with the Explorer's day.
- **Tests:** `tests/rules/session-safety.test.js`, `tests/e2e/session-safety.test.js`, phase9 (Clear asks).


### SUI-38 · Player-facing integration: tracked agreements and Hand to the party (19 October 2026)
**Added, Harry's request** · usability

- **Before:** the Hall's DM-tracked restrictions, privileges, favours, obligations and quest hooks were visible only inside the Bastion. A typed Warehouse row could only be edited or removed, so giving the party an item meant editing the count by hand with no record.
- **After:** the DM doc lists the open agreements for the Region's Clan (and those naming no Clan), with their end day, labelled as yours to run at the table; scores the Bastion applies itself are not listed. On a typed Warehouse row, **Hand to the party** asks how many and who, deducts only that many once (the row goes at 0), and the Day Log records item, quantity, recipient, day and that the DM must write it on the D&D sheet. Goods the Ironbow makes cannot be handed over there (the Courier Exchange is the route), and no Explorer inventory was added.
- **Not changed:** how the Region decides the Clan (see the Region investigation); expiry is shown, not enforced.
- **Tests:** `tests/rules/campaign.test.js`, `tests/rules/session-safety.test.js`, `tests/e2e/dmdoc.test.js`, `tests/e2e/phase9.test.js`.


### SUI-39 · DM doc: Pop out window and scores set by hand (19 October 2026)
**Added, Harry's request** · usability

- **Before:** the DM doc only floated inside the window that opened it, and Political Capital, Honour/Respect and Favour could be changed only inside the Bastion.
- **After:** **Pop out** opens the DM doc in a window of its own (`index.html?dmdoc=1`) to drag onto another screen; it reads the same saves, and the floating one closes. **Change a score…** sets a Clan's Political Capital (−100 to 100) or Honour/Respect (−5 to 5), or a god's Favour (0 to 100%). The DM doc only adds to its own list (`tsi.dmdoc.edits`, in Back up everything); the open Bastion applies each edit once, writes a receipt in its own save (`dmEdits.done`) with the change, and logs what the score was and became. The list shows Waiting, Applied or Refused. The Bastion never has to be told to look: it checks every 2 seconds and when it opens.
- **Why not write the Bastion directly:** the Bastion is single-window and owns these scores; writing its save from another window could overwrite it. A score is set to the number typed, so an old edit is never re-applied after a later change (its receipt stops that).
- **Limits to know:** an edit waits while the Bastion is shut. Restoring only an older Bastion backup (not the whole suite) can re-apply a newer DM edit that the older save has no receipt for. The pop-out window does not take part in the "Already open" warning, because it only reads saves and adds to its own list.
- **Tests:** `tests/rules/dmdoc-edits.test.js`, `tests/e2e/dmdoc-edit.test.js`.


### SUI-40 · Stone Quarry & Masonworks and Weavers' Hall opened (19 October 2026)
**Added, Harry's request** · missing functionality

- **Before:** both were "in development" stubs with no orders and could not be built; their seven trade goods were in the Clan demand table but nothing made them.
- **After:** both are Level 5 Development Plot facilities with six production orders each, in the Timber Yard's pattern (Harry's list of names and days): no gold, one production order at a time, ingredients taken from the Warehouse when an order is issued, output added as counted lots, shipped from the Dock as before. The map overlays and tiles already existed. Trade cargo only: nothing goes to the party, and no research, gold costs or Explorer rules were added. Harry plans R&D later (for example expedition clothing); none is designed, and Specialist Garments cargo stays separate from any future wearable item.
- **Confirmed by Harry, 20 October 2026 (all four points):** which good feeds which was not in the list, so I used the Timber Yard's chain: Dressed Stone from Raw Stone; Structural Masonry and Decorative Stonework from Dressed Stone; Sailcloth and Specialist Garments from Ordinary Textiles; the bulk processing orders 3 to 3; Improved Specialist Garment Production makes 2 lots from 2 in 7 days (more per day than the 5-day single batch). All in `tools/bastion/data/facilities-data.js`.
- **Tests:** `tests/rules/bastion.test.js` (the new group), `tests/e2e/bastion-screen.test.js`.


### SUI-41 · Wyverns can be granted, and the Warehouse can be sorted (19 October 2026)
**Added, Harry's request** · missing functionality

- **Wyverns:** before, only Elara's own wyvern existed and the DM could not grant another. Now **Grant a creature…** in the Explorer offers a wyvern too, and the Wyvern Roost has a second order, **House a Wyvern** (3 days, no gold, no roll), that gives a granted wyvern a home exactly as the Griffin Tower and Dire Wolf Den do. Room (Harry's numbers): Level 1: 2, Level 2: 3, Level 3: 4, Level 4: 5, Level 5: 6, that is one per level plus one more (`room` and `roomBase` in `creatures-data.js`, so they can change there). Elara's wyvern is one of the places. A granted wyvern with no room waits for a home as before. Building or upgrading the Roost never makes a wyvern. Defend Bastion behaviour, the wyvern's profile and the 21-day recovery are unchanged, and so are the Griffin Tower's and Dire Wolf Den's rooms (one per level).
- **Warehouse sort:** **Sort** in the Warehouse (beside Add Item): *As entered* (as before) or *Grouped*: supplies (packs, charts, Shrine items), ingredients, trade goods, then general items (rows typed by hand), each with a heading and a count. It only changes what is shown; the saved order is untouched, and the choice is remembered with the panels.
- **Tests:** `tests/rules/creatures.test.js`, `tests/rules/session-safety.test.js`, `tests/e2e/creatures.test.js`, `tests/e2e/phase9.test.js`.


### SUI-42 · Eight more Port Charter ports, the River Rook, and empty trade goods leave the Warehouse (19 October 2026)
**Added, Harry's request** · missing functionality

- **Ports:** the DM can now grant a Charter for ten ports. New: Port Brawdlyn (Clan Rowthorn), Steelport (Slade), Moltenport (Molten), Leatherport and Bleakharbour (Karr), Alderbridge (Blackstone), Redport (Farmer), and **The River Rook** (Clan Bacca's river port: Midland Province has no harbour). It works exactly like Timberport and Goldport (the Port Charter… button, the harbour box in the pin's panel, registration at the Hall, the Dock's shipping, Clan demand, Recall).
- **Pins:** Steelport, Moltenport and Port Brawdlyn already had pins (hidden, no town picture); Redport, Leatherport and The River Rook have new pins, placed from Harry's screenshots (Redport at the docks, Leatherport at its dockside buildings, the River Rook on the river's east bank by the road bridge east of Colver): drag-check them on the maps and tell me if one is off. A port pin now shows without a picture (`show: true`) and opens a plain panel with its harbour box; Harry's pictures will follow.
- **Sailing days and risk (my proposal, for Harry to confirm; all in `commerce-data.js`):** Timberport and Goldport unchanged (7 days, Low and High). Then Port Brawdlyn 2 (Low), Steelport 3 (Low), Moltenport 4 (Medium), The River Rook 4 (Medium), Leatherport 5 (Medium), Bleakharbour 6 (High), Alderbridge 7 (High) and Redport 9, the only voyage longer than Timberport's and Goldport's, at a new **Very high** risk of 30 in 100. The way back takes as long as the way out. Port Brawdlyn's 2 days means Fresh Fish (2 days or less) can now sail there.
- **Warehouse:** a trade good with none left no longer keeps a 0 line. It goes when the last is used or shipped, or when its count is set to 0 and left. Supplies, ingredients and rows typed by hand keep their lines. A good made or returned later brings its line back.
- **Not changed:** Courier towns and their days, protections and concessions. Market saturation came next (SUI-43).
- **Tests:** `tests/rules/commerce.test.js`, `tests/rules/explorer.test.js`, `tests/rules/session-safety.test.js`, `tests/e2e/commerce.test.js`.

### SUI-43 · Market saturation switched on (19 October 2026)
**Added, Harry's request (rule approved 14 October)** · missing functionality

- **The rule:** within a rolling 28 days, at each port and for each good, lots 1–4 sell at the buying Clan's demand, lots 5–8 one tier lower, lots 9–12 two lower, and lot 13 onwards Oversupplied (×1.25 / ×1.10 / ×1.00 / ×0.75). A cargo that crosses a boundary is priced lot by lot. A good already Normal drops to Oversupplied at lot 5.
- **What counts:** only sales already recorded in the sales ledger (kept 56 days) when the ship arrives. The Dock's price preview counts the same recorded sales, not other ships still at sea; two ships arriving the same day are settled one after the other, so the second sees the first.
- **The sale log** shows a "(market saturation)" breakdown when any lot sold below the Clan's demand. Sales are still paid once.
- **Switch off:** `saturation.active: false` in `commerce-data.js`. Numbers (28 days, 4 lots) are there too.
- **Tests:** `tests/rules/commerce.test.js` (tier boundaries, 28-day window, port and good kept apart, straddling cargo, reload).
- **Still to ask Harry:** what "the remaining Charter customisations" are (my guess: concessions and protections).

### SUI-44 · More things go by parcel (20 October 2026)
**Added, Harry's request** · missing functionality

- **Herbs and roots:** Restorative Herbs, Antivenom Roots, Toxic Blossoms and Alchemical Flowers can go by Courier, one portion = one item (so a parcel's room is unchanged). The Travel bags just count them ("portions of …"); the DM handles any effect.
- **Typed Warehouse rows:** any row you typed by hand (no catalogue good) can be sent. The parcel keeps its own identity (`free:<row id>`) and the name it was sent with, so two rows with the same name stay apart and a rename or delete later changes nothing. Each count = 1 item. The Send dialog lists them under "Typed into the Warehouse". The empty Warehouse's placeholder "New Item" row isn't offered.
- **Once only:** dispatch takes the count off the row once; collection puts it in the Travel bags once (a second pickup is refused, as before); a recalled parcel returns it once, to the same row, or a new row with the same id and name if the row was deleted.
- **Travel bags:** show the exact name and count; no Use button (the DM handles it). Saved with the Explorer, kept through reloads and backups.
- **Still excluded:** trade lots, currency, ships and living creatures. Courier levels, room, days and fees unchanged. `freeItems: false` in `courier-data.js` switches typed items off.
- **Test-only fix:** the Explorer pin test (`phase8.test.js`) now waits for the town picture to load before checking its width (it failed on a slow machine).
- **Tests:** `tests/rules/courier.test.js`, `tests/e2e/parcels-more.test.js`.

### SUI-45 · The courier post's "Due" wording (20 October 2026)
**Fixed, Harry's report** · confusing wording

- **Before:** a parcel past its due day showed "Due at Slade’s Muster: the Bastion records its arrival when it reaches Day 140" with no Collect button, even on Day 144.
- **Why:** the Explorer can only collect a parcel the Bastion has recorded as arrived, and the Bastion catches up only when it is opened. Nothing was lost.
- **After:** it says "It reached Slade’s Muster on Day 140, but the Bastion hasn't recorded that yet. Open the Bastion (it catches up to today's day), and the parcel can then be collected here." The rule is unchanged; whether to let the Explorer collect an unrecorded parcel is left to Harry.

### SUI-46 · Negotiated Charter terms, and the Barracks and Watchtower protections (20 October 2026)
**Added, Harry's specification** · missing functionality, and one pricing fix

- **Terms (Hall):** each Charter, earned or registered, shows its price multiplier, shipping fee per lot and tariff (standard ×1.00 / 0 gp / 0%), with a worked estimate (4 lots of the Clan's top good through the real pricing engine, saturation included, labelled as an estimate). **Amend terms…** and **Reset to standard terms…** need a reason. Limits: ×0.50–×2.00, 0–50 gp a lot, 0–50% (whole gp and whole per cent). Worse-than-standard terms are allowed if the DM sets them. Nothing is automatic: no preset rewards, no rolls, no Honour/Respect/Political Capital change, no expiry. Each change is kept for good on the Charter (`termsLog`: day, old terms, new terms, reason) and logged in the Day Log. The Dock only shows the terms and uses them in its preview.
- **Pricing fix:** a sale used the Charter's terms at arrival, so changing terms while a ship was at sea would have repriced it. Every ship now saves its full effective terms at departure (`voyage.terms`, including inherited defaults) and settles on those. Ships saved before this (outbound, no terms) get their current effective terms once on load, and before any amendment. Standing shipments lock the terms in effect at each departure. Receipts and gold are paid once, as before.
- **Guard Commercial Convoy (Barracks Level 2, 3 days, no gold or Favour):** prepares 1 Convoy charge (never more than 1 held; ordering again is refused while one is ready or pending). The next commodity voyage to sail uses it up exactly once, −5 points. No soldiers, defenders or regiments are used.
- **Protect Maritime Approaches (Watchtower Level 2, 2 days, no gold or Favour):** active for 7 inclusive days, the completion day being Day 1 (ends on day + 6); every voyage dispatched in that time is −5 points; it isn't used up, can't be extended or stacked, and a new order is refused until it has ended. Ships already at sea, and any dispatched earlier that day, get nothing retroactively (the day's trade stage runs before orders). Patrol is unchanged.
- **Together:** Convoy −5, Approaches −5 and the Blessing of Pelagos −10 add up, never below 0%; the chance is recorded on the voyage at dispatch, so a later expiry changes nothing. A failed voyage still sells nothing and brings the cargo home. Standing shipments follow the same rules. The Dock lists each protection's state; the Barracks and Watchtower order cards say why a second order is refused.
- **Not changed:** the Explorer's Charter granting, the Hall's 3-day registration, Clan demand, saturation, ports, courier, the Trade Consortium and legacy trade agreements.
- **Tests:** `tests/rules/commerce.test.js`, `tests/e2e/charter-terms.test.js`.

### SUI-47 · The Hall's Secure Trade Agreement is retired and Register Port Charter takes its place (20 October 2026)
**Changed, Harry's approved policy and follow-up** · retirement of a legacy feature

- **Gone from the Hall:** the Secure Trade Agreement order is hidden (not shown, not selectable) and refused by both ways in (`issueOrder` and the Hall's `issueOrderWithMeta`); nothing is paid. The order's definition stays in the data only so an order issued and paid before this change can still resolve; none can be issued now.
- **Running agreements** finish under their original terms and pay each shipment once, as before, and show in the Hall's records box (with days and shipments left) until they end, when they simply end as they always did. No renewals. **No archive, no "Expired / Archived" list, no retirement note** (Harry asked for none; an archive an earlier build of this branch made is dropped on load).
- **Register Port Charter** now sits in the Level 1 slot the Trade Agreement had: first of the Hall's orders, `requiredFacilityLevel` 1 (was 2). Still 3 days, no gold, no roll, one at a time; the Explorer's Charter granting and the Charter log line (which names the level only when it is above 1) are unchanged.
- **Not touched:** the Trade Consortium and its routes, delegations, summits, arbitration, Port Charters, Diplomatic Records and Clan Relations.
- **Test changes:** the rules tests' order helper lifts the retirement note for tests that need an agreement; `phase9.test.js` puts the order in as an older save would; Register Port Charter's level tests now expect Level 1.
- **Tests:** `tests/rules/bastion.test.js`, `tests/rules/commerce.test.js`, `tests/rules/session-safety.test.js`, `tests/e2e/charter-terms.test.js`, `tests/e2e/phase9.test.js`.

### SUI-48 · Wyvern Roost: bonding and training, phases 1 and 2 (20 October 2026)
**Added, Harry's approved design ("Wyvern Roost: Bonding, Training & Rider Mastery", all six proposals approved 20 October 2026)** · missing functionality

- **Save safety:** a creature record used to keep only nine fixed fields, so anything new would have been dropped on every reload. Each creature can now carry a `development` record (handler, bond 0–5 and any ready milestone, temperament notes, learned programmes with their day, harness and first-flight fields kept ready for later, handler history and the Chronicle). The cleaner keeps it whole (and repairs nonsense, including a milestone that doesn't follow the bond); it is added to a creature only when it matters, so other creatures' saves are unchanged. Tests cover save, reload, export/import and loading twice.
- **Elara's wyvern:** Bond 1 and handler `elara` with one Chronicle line, credited once, whether newly housed or already housed in an older save; a bond the DM confirmed later is never replaced.
- **Orders (Wyvern Roost, all free, one-time for each wyvern, one named housed wyvern each):** Safe Acclimatisation 5 days (L1), Establish Keeper's Routine 7 (L1), Signal & Recall Training 7 (L2), Territorial Defence Drills 7 (L2), Open-Sky Return Training 10 (L3), Aerial Sentinel Training 7 (L3). Every refusal names the exact reason (Roost level, housing, handler, bond, a milestone waiting for you, programme already done, one programme at a time, places full). The House orders are unchanged and use no training place.
- **Bond:** finishing a bond programme only makes the next milestone ready. **Confirm bond milestone…** needs a reason and raises the bond by exactly one level with one Chronicle line. The next bond programme can't start while a milestone is waiting. Handlers: the first assignment keeps the bond; a change needs a reason, keeps the history and restarts at Bond 0 unless the DM credits the old bond.
- **Training places:** 1, 1, 2, 2, 3 by Roost level; a milestone waiting for confirmation holds none.
- **Defend Bastion:** Defence Drills +1 Resolve and Aerial Sentinel +1 Defence for that wyvern only; **Battle Value stays 11** (my choice for the open question; tell me if it should change). No bond gives a stat bonus.
- **Recovery:** a recovering wyvern's programme pauses: each recovering day moves its due day on by one (once a day), so no days are lost and nothing is credited meanwhile. Under Repair uses the Bastion's usual waiting orders.
- **Screen:** each housed wyvern shows a profile (handler, bond, next step, programme, learned list, temperament, riding "not available yet", Chronicle with notes). The panel's "Coming later" line now says riding, mounted flight and breeding.
- **Not built (phase 3 onwards, and the separate rider specification):** the 150 GP harness, Level 4–5 programmes, Rider's Pact, first-flight checks, deployment, mounted combat, cavalry, breeding. The handover's "waive a pending milestone" is not built: a ready milestone waits until you confirm it.
- **Tests:** `tests/rules/wyvern-bonding.test.js` (new), `tests/rules/creatures.test.js`, `tests/e2e/wyvern-bonding.test.js` (new).

### SUI-49 · Wyvern Roost: riding preparation, phase 3 (20 October 2026)
**Added, Harry's approved design (all twelve training durations and the 150 gp harness were approved on 20 October 2026)** · missing functionality

- **Six more orders (Wyvern Roost, one named housed wyvern each, once each):** Commission Riding Harness 7 days (L4, **150 gp**, Bond 4), Controlled Ascent & Landing 14 (L4, Bond 4 and a fitted harness), Emergency Recall Training 7 (L4, Bond 4 and Ascent & Landing), The Rider's Pact 14 (L5, Bond 4 and the first flight confirmed; makes the Bond 5 milestone ready, never raises it), Elite Aerial Defence 10 (L5, Bond 4 and Aerial Sentinel; +1 Attack, Battle Value stays 11), Aerial Combat Signals 14 (L5, Bond 5 and the first flight; records a prerequisite only).
- **Harness:** 150 gp is taken once, when the order starts, with the usual check first (too little gold refuses without a change). A pending harness can't be duplicated (one programme at a time) and a fitted one can't be bought again. It is fitted when the order completes and stays with that wyvern through reload, import and upgrades. Cancelling is not refunded (as before), and the Cancel button now asks first for a paid training order.
- **First flight:** a Riding line on each wyvern ticks off what's needed: party level 13 or more, housed at a standing Level 4+ Roost, Bond 4 and a handler, the harness, both flight programmes, not wounded or defending. When all hold it says "First flight ready, awaiting the DM's milestone", and **Confirm first flight…** (needs a reason) records the handler, day and a Chronicle line: "Mounted Flight Qualified", which is story permission for a DM-run flight only. Nothing says "rideable"; there is no riding movement, speed, feat, combat action or Explorer travel. A change of handler clears the flight for the new pairing (recorded in the Chronicle); the harness and learned programmes stay.
- **No circle:** Bond 4 plus the Level 4 preparation allows the first flight; the first flight is then needed for the Rider's Pact; Bond 5 is not a first-flight requirement.
- **Judgement call (not in the handover's list):** the "Confirm first flight" button is the DM milestone the handover calls for ("record firstFlightApproved with handler, day and chronicle note"); without it the Pact could never be started.
- **Not built:** deployment to the Explorer, rider mechanics, mounted combat, cavalry, breeding, any new combat action; the separate rider specification is still needed.
- **Tests:** `tests/rules/wyvern-bonding.test.js`, `tests/rules/creatures.test.js`, `tests/e2e/wyvern-bonding.test.js`.

### SUI-50 · Griffin Tower and Dire Wolf Den: bonding, training and riding preparation (21 October 2026)
**Added, Harry's approved proposal (all eight points approved as recommended, with riding added for both)** · missing functionality

- **Same system as the Wyvern Roost,** now data-driven by species and building: the creature development record, bond 0–5 with the DM confirming every step, handlers, Chronicle, temperament notes, training places (1, 1, 2, 2, 3), the recovery pause and per-creature Defend Bastion bonuses (Battle Value unchanged: griffin 8, dire wolf 7). The Roost behaves exactly as before.
- **Twelve free programmes in each building** (once per creature): Level 1 Safe Acclimatisation 5 days and Establish Keeper's Routine 7; Level 2 a recall programme 7 (Signal & Recall / Heel & Recall) and Defence Drills 7 (+1 Resolve); Level 3 a return programme 10 (Open-Sky Return / Roaming Return) and a sentinel programme 7 (Aerial Sentinel / Pack Sentinel, +1 Defence); Level 4 Commission Riding Harness 7 (**150 gp** once), Controlled Ascent & Landing (griffin) or Steady Gait & Halt (wolf) 14, and Emergency Recall 7; Level 5 The Rider's Pact (griffin) or The Rider's Oath (wolf) 14, Diving Strike Drills or Pack Hunt Drills 10 (+1 Attack), and Aerial Combat Signals or Mounted Pack Signals 14.
- **Riding (preparation only):** the harness, the first mounted flight (a griffin's) or ride (a wolf's) at party level 13 or more, and the Rider's Pact/Oath making Bond 5 ready, exactly mirroring the wyvern. **The riding details for griffins and wolves (the 150 gp harness, 13, the days, the programme names after the proposal's, and the wolf's "Steady Gait & Halt", "Rider's Oath" and "Mounted Pack Signals") are my copy of the wyvern's numbers, not separately approved: change them in `facilities-data.js` / `creatures-data.js` if wanted.** It records story permission only: no riding movement, combat action or Explorer travel.
- **Instead of the proposal's "Eyrie/Pack Oath":** with riding added, Bond 5 comes from the Rider's Pact/Oath after the first flight/ride, as for the wyvern.
- **Existing creatures:** a granted griffin or dire wolf starts at Bond 0, with no handler and no development record until the DM works with it. Elara's wyvern is still the only creature credited a bond.
- **Not changed:** House orders, room (one per level), War Table numbers, grants, the Menagerie.
- **Tests:** `tests/rules/beast-bonding.test.js` (new, both animals), `tests/rules/wyvern-bonding.test.js`, `tests/e2e/beast-bonding.test.js` (new).

### SUI-51 · Chronicle notes can be marked DM only (21 October 2026)
**Added, Harry's decision D6 for the Beast Handler** · missing functionality

- **Add a note…** in a creature's Chronicle has a **DM only** tick box. A ticked note is saved with `private: true` (`R.addChronicle`, `R.addChronicleNote`), kept by `R.cleanDevelopment`, marked "(DM only)" in the Bastion's own Chronicle list, and never put in the player's Beast Handler snapshot.
- **Older saves are unchanged:** the flag is written only when set, so existing Chronicles read back exactly as before.
- **Not flagged:** the automatic entries (training done, bond confirmed, handler changed, first flight) stay visible to the player. They include the reason the DM typed when confirming a bond or changing a handler, Harry (21 October 2026) decided they stay visible to the player.
- **Tests:** `tests/rules/beasthandler-projection.test.js`, and the Chronicle check in `tests/e2e/wyvern-bonding.test.js`.

### BH-01 · Scarlett Isles: Beast Handler, first step (BH-1: Harry's tables, the player's snapshot, read-only screens) (21 October 2026)
**Added, Harry's approval of the proposal (D1 to D8 as recommended)** · new tool

- **What it is:** a Players tool that reads the Bastion saved on this laptop and shows a handler their beasts: Home (buildings, levels, who lives where), a creature's main screen (portrait, handler, Bond 0 to 5), Profile, Orders and Chronicle. It saves nothing of its own. Everything that would ask the Bastion to do something (Roll or edit, Send request) is shown but switched off until BH-2.
- **What a player sees** is built by `tools/beasthandler/projection.js`: a snapshot of the handler's own creatures, plus a plain directory line for everyone else's. It never holds the treasury, the Day Log, DM notes, other buildings or any raw part of the save (leak tests in `tests/rules/beasthandler-projection.test.js`).
- **Orders** follow D3 and D5: free training only (a programme that costs no gold), only what the Bastion's own rules would accept now at the building's current level, and **while any order is pending at the building** (training, housing or an upgrade) nothing new is offered; the pending order and its ready day are shown. Other buildings never block. The DM's own training places are untouched.
- **Handler matching** is by name, ignoring capitals and spacing, until the handler list of BH-2c.
- **Harry's profile tables** are saved as `tools/beasthandler/data/profile-tables.js`, word for word (the d12 temperaments, the d8 attachment cues and instinctive triggers for each beast, and fifteen regional varieties). They are only data in this step: nothing rolls them yet. "Tidecliff Wyvern" in his worked example is not one of the fifteen, so it was treated as an example only.
- **Judgement calls:** (1) the "Viewing as" box is for the DM's laptop only; a phone page will not have it. (2) The portrait is a gold medallion until Harry's art arrives (`data/art-map.js` is where a picture goes). (3) The lock reads "any order at the building", including a House order or an Upgrade; if Harry wants training orders only, it is one line in `ordersFor`.
- **Changed outside the tool:** the home screen's cards are now five across (`shared/shell.css`), because nine tools made three rows at four across and pushed the footer buttons off the laptop screen.
- **Left alone (not a fault of the tool):** the suite's shared top bar is wider than a phone's screen, so opening the companion inside the suite on a phone would zoom out. The phone page of BH-3 gets its own slim bar. The companion's own content fits a 390 px phone with nothing sideways (tested).
- **Tests:** `tests/rules/beasthandler-tables.test.js`, `-projection.test.js`, `-model.test.js`; `tests/e2e/beasthandler.test.js` (phone, laptop and TV sizes; no internet).

### SUI-52 · Bastion: Regional Variety, a profile change log, and the Beast Handler's box in Management (21 October 2026)
**Added, Harry's decisions D1 to D8 for the Beast Handler** · missing functionality

- **Regional Variety** is saved on each creature's development record (`development.regional`, written only when set, so older saves read back exactly as before). The Bastion's temperament box has a Regional Variety field that suggests Harry's fifteen names (any other name can be typed).
- **A profile change log** (`development.profileLog`, the latest 40) records who changed a profile line and when. It is for transparency and is deliberately **not** put in the Chronicle (Harry's rule). The Day Log says so too.
- **A Beast Handler (players) box in Management** (`tools/beasthandler/dm-panel.js`): a handler list, a pairing code and a snapshot code for each phone, "Take back code", "Paste a request code…", a switch to stop taking requests, and the latest requests with how each went.
- **Requests from the companion on this laptop** are read every two seconds by the Bastion's window (`checkBeast`) and applied by `R.beastProcess` (`tools/beasthandler/bastion-link.js`). Every request is checked again against the live save and done **once**: a receipt is saved in the same save (`s.beast.done`), so a refresh, a retry, a second window or a pasted code used twice can never do anything twice. The Bastion stays the only thing that changes its save.
- **What a request can ask for:** a profile line (temperament, attachment cue, instinctive trigger, Regional Variety) or a **free** training order. Never a bond, name, handler, milestone, Chronicle line, build or purchase, and never anything that costs gold.
- **Saves and backups:** the handler list, each handler's secret and the receipts live in the Bastion save (`s.beast`), so they travel with Export, Import and "Back up everything". They are added only the first time they are needed.
- **Tests:** `tests/rules/beasthandler-link.test.js` (applied once, refused with reasons, per-handler checks, no leaks), `-profile.test.js`, `-codes.test.js`, `hmac.test.js`; `tests/e2e/beasthandler-write.test.js`.

### BH-02 · Scarlett Isles: Beast Handler, writing back and the phone page (BH-2a, BH-2b, BH-2c, BH-3a, and the Dire Wolf portraits) (21 October 2026)
**Added, Harry's approval of D1 to D8** · new functionality

- **What it does now:** the companion's write buttons are switched on. **Roll** only *suggests* (values marked "not saved yet", nothing reaches the Bastion); **Save** asks the Bastion and shows *waiting*, then the Bastion's answer; **Send request** on a free training order does the same. A button never says "started" before the Bastion's receipt.
- **The phone:** `beasthandler.html` is a separate page that loads only the companion's own files, never any DM tool. The DM and the player swap three kinds of signed text instead of talking over the internet: a pairing code, a snapshot code and a request code (`docs/PHONE-PAGE.md`). Signing uses a small SHA-256/HMAC written in plain JavaScript (`shared/js/hmac.js`), because the browser's own signing tool is unavailable on a file opened by double-click.
- **Portraits:** all fifteen of Harry's painted pictures are shown by Regional Variety (five wolves, five wyverns, five griffins; he named each file). Hollowhowl and Slatejaw are his newer wolf paintings (21 October 2026). A beast with no Regional Variety shows its species' gold medallion. Two early wyvern pictures that belong to no variety (mossy green, volcanic copper) are kept unused in `assets/extras/`. Every picture is listed in `docs/ASSETS.md`.
- **Judgement calls**
  - **Pending-order lock:** a handler cannot request a training order at a building while a **training programme** is pending there (any handler's). The companion shows that programme and its ready day. A House order or an Upgrade pending at the building does **not** hold anyone back (Harry, 21 October 2026: training only); the Bastion's own rules still decide whether a programme can start.
  - **The Bastion does not check "what the player saw".** A request carries the version of the screen it was made from, but the Bastion doesn't refuse on it. An order is fully re-checked against the live save. A profile change is **last writer wins**: if the DM changed a line after the snapshot was made, the player's request replaces it. It is logged in the profile change log.
  - **Refusal wording:** reasons are written for the player and don't name other players or the Bastion's money. A busy building says only "The Wyvern Roost is busy (something is under way at the Wyvern Roost), ready on Day N", and names a training programme only when it is that player's own beast's.
  - **Chronicle:** DM-only notes are never sent. The automatic entries are, and they include the reason the DM typed when confirming a bond or changing a handler (see SUI-51).
  - **Directory:** other players' beasts appear only as a line (name, handler's name, bond) when "Viewing as" is on a handler. The DM's own laptop defaults to the directory only.
- **Left alone**
  - **Restoring an older Bastion backup forgets which codes were handled.** A request code a player still has, from after the backup point, could be pasted and applied again. Only that one code, and only once more (the receipt is saved again). On the laptop's own queue it cannot happen: the Bastion takes each answered request out of the queue.
  - **The secret for each phone is stored in the Bastion save and so in every backup.** Anyone who gets a backup file could make a request that looks like it came from that player. They still could only ask for the same two things, and the Bastion re-checks everything. Press **Take back code** to retire one.
  - **The shared top bar** is wider than a phone. The phone page has its own slim bar; opening the full suite on a phone still zooms out.
  - **Long codes:** a snapshot code is several thousand letters. It is meant to be pasted or sent as a file; there are no QR codes. The Chronicle in a snapshot is cut to the latest 40 entries; the phone says how many were left out.
  - **No live relay.** A phone only learns the answer when the DM sends a fresh snapshot (the Result box after applying a request already holds one).
  - **A pairing code is not one-time and does not expire** (the proposal said it would be; Harry, 21 October 2026: fine as it is). It works on any number of phones until you press **Take back code**. It is signed and per handler, so it only ever lets that handler ask for the same two things; but treat it as a password and send it privately.
  - **A phone keeps its last snapshot after a code is taken back or a beast changes handler.** Nothing offline can reach into a phone to wipe it. The phone can't make a request the Bastion will accept any more, but the player can still read what they were last sent (their own beasts only). Unlink on the phone clears it.
  - **A handler is identified by name** (capitals and spacing ignored), not by a separate id (decision D8 asked for an id; the handler list kept name matching). Re-spelling a handler's name on a beast leaves their paired phone pointing at the old name, and a new player with the same name would be matched to the same beasts. Harry (21 October 2026): names are fine.
  - **The directory shows more than the proposal's section 4:** for other players' beasts it lists the handler's name and bond as well as the beast's name (only when Viewing as a handler; the phone shows it too). Brief screen A listed them; say if you would rather it were the beast and building only.
  - **Firefox:** not checked.
- **Found by a second, deeper review (four independent readers, each finding then challenged) and fixed in the same pull request:** a cancelled order was still called "Completed" if it was cancelled after the day it first promised (a recovering wyvern's programme moves later); the DM's paste dialog read ": refused…" with no name for a request refused before the beast was named; the Bastion's Temperament box could put back a line a handler had just changed (it now sends only the lines the DM changed); the small round portrait stretched tall on a painted-art Dire Wolf on the laptop; the phone redrew itself every minute, closing anything open (only the "got N minutes ago" words change now); the wrong-code message now says to unlink and link again; Copy said "Copied" even when copying failed; pop-up buttons on the phone were under 44 px; an older snapshot pasted after a newer one replaced it (the Bastion stamps each snapshot code with the time it was made and the phone refuses an older one); the phone said a request was "submitted" when it had only been made on the phone and not yet sent; moving between a beast's sections threw away a half-typed profile; focus wasn't placed on the new screen's heading; code boxes had no accessible names; two companion windows could write over each other's queued requests (every write now re-reads the queue first); answered requests stayed in the queue when the companion was closed, so importing an older same-campaign Bastion save could make the Bastion do them again (the Bastion now takes answered requests out of the queue once its receipt is saved); and the companion dropped an unanswered request after 7 days although the Bastion accepts them for 30 (now 30). A third, smaller check of those fixes found two more, also fixed: with the profile editor kept open across sections, a line the player never touched could put back a line the DM had changed in the meantime (untouched lines now follow the Bastion, and only lines the player changed from where the draft began are sent); and sending an order threw away a half-typed profile (only sending the profile does now).
- **Found by an independent review and fixed in the same pull request:** an order the DM cancelled showed to the player as "Completed" (now "No longer scheduled: it was cancelled"); forgetting old receipts after 1000 of them could let a very old signed request be done again (the Bastion now remembers the time of the newest forgotten receipt and refuses anything made before it, and a request dated more than two days ahead); **Add a handler** with an already-paired name swapped their code without asking (it now asks); a damaged saved snapshot could blank the phone page (it is now forgotten, and the page always opens); a stray invisible character from a chat app, or a broken character, could stop a pasted code reading or throw (they are ignored or refused in plain words); a refusal named a beast that wasn't the requester's (it no longer does); and a phone's request that was never sent blocked new ones for up to 30 days (there is now **Forget it** beside each unsent request).
- **Tests:** `tests/e2e/beasthandler-write.test.js` (laptop, whole round trip), `tests/e2e/beasthandler-phone.test.js` (pairing, snapshot, request, apply once, forged and wrong-handler codes, a revoked code, a 390 px phone), and the rules files named under SUI-52.

### BH-03 · The phone page can't be opened from a file on an iPhone (21 October 2026)
**Found by Harry testing on an iPhone** · limitation of the phone, not of the page

- **What happened:** opening `beasthandler.html` from the Files app shows only the page title (the preview doesn't load the page's styles or scripts), and typing the file's address into Safari says "Safari cannot open the page because it is a local file." The earlier note in `docs/PHONE-PAGE.md` ("phones don't always open local files nicely") was too gentle: an iPhone never will, so sending the files or a zip does not work for players.
- **What I checked:** served from a web address (including inside a sub-folder, as GitHub Pages does), the page works: the whole phone round trip passes (`TSI_PHONE_URL=… node tests/e2e/beasthandler-phone.test.js`, 18 checks, Chromium on a 390 px phone window). Not tested: Safari itself, a real iPhone, GitHub Pages itself (the sandbox can't reach github.io).
- **What changed:** the page has the Home Screen tags and a small crest icon (`tools/beasthandler/assets/phone-icon-180.png`); a `.nojekyll` file in the main folder so GitHub publishes the files exactly as they are; `docs/PHONE-PAGE.md` now says plainly that the page needs a web address, how to switch on GitHub Pages, and what players do on an iPhone.
- **Left for Harry:** where to host it (GitHub Pages recommended). Publishing from this repository publishes the whole suite at that address; saves stay in each visitor's own browser, and the phone page loads no DM tool.
- **Things to know on an iPhone:** a page added to the Home Screen keeps its saved link separately from Safari (add it first, then pair); Safari may clear a page's saved link after about a week of not using it (paste the pairing code again). Without a service worker (not allowed in this project) the page needs a connection each time it is opened; once open, the code swap needs none.

### BH-04 · The Beast Handler's building lock now counts training programmes only (21 October 2026)
**Changed, Harry's answer after testing** · behaviour change

- **Before:** while *any* order (training, housing or an upgrade) was pending at a building, the companion offered no new order there, and the Bastion refused one.
- **After:** only a pending **training programme** at the building does that. Housing a second beast or upgrading the building no longer holds a handler back; the Bastion's own rules (level, bond, a free training place, Under Repair) still decide whether a programme can start, and it still never costs gold.
- **Wording:** another handler's programme now reads "A training programme is under way at the Wyvern Roost" (it never names the beast or the programme); the refusal reads "The Wyvern Roost is busy (a training programme is under way at the Wyvern Roost), ready on Day N."
- **Tests:** `tests/rules/beasthandler-projection.test.js` (a House order no longer locks), `tests/rules/beasthandler-link.test.js` (a House order does not refuse a request; a training programme does).
- **Also decided (no change needed):** the reasons a DM types for a bond or handler change stay visible; pairing codes may stay non-expiring and work on any number of phones; handlers are matched by name.

### BH-05 · Beast Handler: charcoal-and-gold look, the beast's page, the first meeting, fades, and "the picture didn't appear" (21 October 2026)
**Changed, Harry's request** · look and flow; the only rules-side change is that the Regional Variety line in the Profile editor can now be rolled too

- **Before:** crimson-and-gold panels shared with the rest of the suite; a small round medallion (or painted picture) with a bond bar; Profile, Orders and Chronicle as buttons under it; a beast with no subspecies simply showed its species medallion; screens changed instantly.
- **After:** the colours of Harry's Stitch mock-ups (charcoal page and cards, gold headings and main buttons) inside the Beast Handler only; the picture is the centrepiece with the subspecies name under it, a *Current rapport* card with five bond pills, and a bottom bar for Profile, Orders and Chronicle; the picture is **blank until a subspecies is chosen**; a first-meeting sequence; and a soft fade between screens (off when reduced motion is set).
- **Harry's report (picture not appearing after the subspecies was set and saved):** I could not make it fail in Chromium, so I could not prove one cause. What I found, and did about each:
  1. *The Bastion had not answered yet.* A request is only answered when the Bastion's window is open on the laptop, or, from a phone, when the DM applies the code and sends a new snapshot. Until then the snapshot truly had no subspecies, so the page had nothing to draw. The page now shows the subspecies asked for, and its picture, straight away, marked as waiting; the mark goes when the answer arrives.
  2. *The picture frame could have had no height in some browsers (Safari especially).* The old frame took its height from its parent in a way Safari can treat as "nothing". The new frame on a phone keeps its own shape (a fixed 4-to-5 box), and on a laptop is sized from the window's height. Tested in Chromium only; Safari and a real iPhone are not checked.
  3. *The name did not match exactly.* The picture is found by the subspecies name. Capitals, spaces, hyphens, a leading "the", words in brackets and a leading or trailing "Wyvern", "Griffin" or "Dire Wolf" no longer stop it, and a name that mentions exactly one of the five now means that one ("Bleakhook of the north"). A name that matches none (say "Moonlit Rift") still has no picture, but the page now says so under the empty frame and the Profile editor says so as you type.
  4. *The picture files weren't on the web host.* A phone page copied by hand needs the `assets/wyvern/` and `assets/griffin/` folders as well as the wolves' (`docs/PHONE-PAGE.md` listed only the wolves and has been corrected). If a picture file can't be loaded, the frame now says so instead of showing a broken image. GitHub Pages of the whole repository is unaffected.
  5. *A request made on a phone before this update* has no stored copy of what was asked, so the page could not show it while waiting. It now reads it back from its own request code.
  6. *A stale copy of the page.* After a new version is published, a phone or browser may keep showing the old page; reload it (on a laptop Ctrl+F5, on a phone close and reopen the page) if something looks unchanged.
  Tests: `beasthandler-write` and `beasthandler-phone` check the picture appears right after saving; `beasthandler-meet` checks the waiting state, the answer, a refusal and the unmatched-name note.
- **Found by an independent review (six readers, each finding then challenged by two sceptics) and fixed in the same pull request:**
  - *High:* the first meeting started with empty personality lines and sent all four lines, so a beast whose Dominant Temperament, Attachment Cue and Instinctive Trigger the DM had already written (but whose subspecies was blank) had them replaced. The meeting now shows the lines already written, keeps them unless changed, and sends only the subspecies and any line the player changed.
  - A refused first-meeting request silently restarted the meeting with nothing said and the choices lost; a phone player could not get out. The meeting now says why it was refused, puts the choices back, and, only after a refusal, a phone player gets **Skip for now**.
  - On the DM's laptop another handler's waiting request for the same beast (the DM may have handed it on) was laid over the beast shown to the new handler. Only the viewed handler's own requests count now.
  - Clearing the subspecies showed as already done with no "waiting" mark; it now shows as waiting.
  - The reveal could lift on an empty frame on a slow connection; the picture is now fetched as soon as the subspecies is chosen and the curtain waits for it (at most about three seconds).
  - The panel blanked at once instead of fading to black; it now stays, untouchable, until the black is complete. Under reduced motion the "Welcome" words were on screen for 0.6 seconds; they now keep their full time and only the fades are dropped.
  - Keyboard and screen-reader users: focus goes to each new panel's heading, Enter moves on, the welcome words are announced, nothing behind the black can be reached, and a line one letter too long now says why Save is off.
  - Looks: the keyboard focus ring on the picture was clipped away and the bottom bar's was too faint (both now plain gold, drawn inside); bond pill names were 9 px and cut off ("ACCLIMAT…") and the bond headline broke inside a word on small phones; a long one-word beast name ran off the black screen; held sideways a phone showed the picture as a thumbnail; text showed through the bottom bar; the shared pop-up was wider than a phone's screen (now fitted, and in the Beast Handler's palette).
  - Smaller: the meeting's date and the stale "gold medallion" sentences in the art map and `docs/ASSETS.md` were corrected.
- **A second review of those fixes (four readers, each finding challenged by two sceptics) found 13 more, all fixed in the same pull request:**
  - After a refusal the saved choices could put an old copy of a line back over the DM's newer edit; the choices are now kept with the lines the player saw, and a line the player left alone follows the Bastion as it is now. The same goes for a line the DM changes while the panels are open.
  - "Your choices are put back" was only true while the page stayed open: the choices are now kept across a reload (on a laptop in that window only; on a phone in its own storage until the Bastion holds the subspecies), and when they were not kept the note says "Please choose again".
  - On the laptop the page for the viewed handler hid another handler's waiting order at the same building, so a second order could be offered; a building with an order waiting still takes no second one.
  - Looks and keyboard: the ring on the picture was painted underneath it (now a gold ring over it with a dark line inside); a control reached by keyboard could sit under the sticky bars (room is left now); a building's "Level N" tag wrapped on 320 px phones; the code boxes on the phone page were 12 px, which makes iPhone Safari zoom in (now 16 px); "Skip for now" dropped keyboard focus.
  - Tests: a check that the curtain really waits for a slow picture (and gives up on one that never arrives), which the first version lacked.
- **Judgement calls (say if any should change):**
  - The meeting runs whenever a beast has no subspecies (no separate "has met" flag). A beast with personality lines but no subspecies gets it too (the lines are kept, see above). Closing the page part-way starts it again with nothing saved.
  - On the DM's laptop there is **Skip for now** (the page opens with an empty frame and "Subspecies not chosen yet"); a player's phone has none until the Bastion has refused a choice.
  - A player may keep a subspecies name of their own, but is told there will be no picture for it.
  - The subspecies **Roll** picks evenly among the five (the d12/d8 tables for the three personality lines are unchanged). The Profile editor's Regional Variety line now has a Roll button too.
  - One request is sent at the end (the subspecies plus any personality line written or changed), not four; the Bastion still checks it once.
  - The picture is shown straight away after the last Save, marked "Waiting for the Bastion to confirm" (on a phone: "Not confirmed yet: send your request code to the DM"). It is only a display; the Bastion's answer is what counts.
  - The gold-filled main button is a Beast Handler style; the rest of the suite keeps its crimson main buttons.
- **Not done / not checked:** Safari and a real iPhone (as before); Firefox; any sound with the cinematic.
- **Tests:** `tests/e2e/beasthandler-meet.test.js` (the whole sequence on the laptop and a phone, a refusal, a beast with written lines, keyboard use); `beasthandler.test.js`, `beasthandler-write.test.js` and `beasthandler-phone.test.js` updated; `tests/rules/beasthandler-model.test.js` and `beasthandler-profile.test.js` (bond pills, possessive names, pending overlay, waiting and refused requests, the meeting's words, name matching, the subspecies roll).

---

## Strip Back Overhaul (steps S01 to S17, 22 to 25 October 2026)

These entries come from each step's draft in `docs/strip-back/*-known-issues-draft.md`, renumbered BAS-SB-01 to BAS-SB-80. Each has a Before and an After. Step S12 and S10 are short lists.

**Internal Day Log data: removed (S18, 26 October 2026).** See BAS-SB-83. The Bastion no longer writes or keeps a Day Log; a save that still holds one keeps it untouched as `legacyLog`, only for the old text-file button.

### BAS-SB-01 · The Explorer's deliveries and refusals get a home in Management, and a refusal tells you why in a notice (Strip Back Overhaul, S02)
**Deliberate change** (Harry's STRIP BACK handover: Clan Influence and the Day Log go; replacement before removal, J 8) · usability

- **Before:** what the Explorer link delivered was listed only in Clan Influence's "Changes from the Explorer" (the newest ten, no way to see more). A change the Bastion could not use was explained only there ("Clan Influence says why"), and that notice was shown only when no other change was applied at the same moment (the two shared one notice id, so the later one replaced the earlier). A change skipped because it was sent before the Bastion started was told only in the Day Log. An order finished with Resolve (a Shrine's prayer roll, a craft) was told only in the Day Log.
- **After:**
  - Management has a **"Changes from the Explorer"** box: every change the Explorer link delivered, newest first (the newest ten, "Show all" for the rest), each with what it was, the day, the Explorer's own words and, for a refused or skipped one, the reason (always one) and what to do about a skipped one. It reads the same receipts as the old list (`state.bridge.done`), so nothing was added to the save. The Clan Influence panel and its list are untouched until S10.
  - A change the Bastion cannot use has its **own warning notice with the reason** ("Not used."), separate from any applied notice. More than three refusals show the first three and count the rest.
  - Changes **skipped** because they were sent before the Bastion started are told in a notice ("Skipped.") with the reason and what to do.
  - An order finished with **Resolve** says what it did in a notice ("Order resolved."), as well as in the Day Log. An order completed as a day passes still goes into "The Ironbow sends word…" only.
  - The applied notices say "Changes from the Explorer, in Management, lists it." (they used to name Clan Influence).
- **Wording changes:** a skipped Honour/Respect change now says "Use Change a score in the DM doc if it should count." where the old list said "Type it in above if it should count." (the typed box goes with Clan Influence).
- **Left alone:** the Day Log lines written by `R.applyInbox` still say "Clan Influence lists it" (their text is asserted by tests; the Day Log goes in S18); the Explorer's own "Sent to the Bastion" line for a skipped Honour/Respect change still ends "Type it in by hand if it should count." (`shared/js/bridge-rules.js`); reword in S10 if wanted.
- **Evidence:** `tools/bastion/rules.js` (`R.bridgeChange`, `R.bridgeChanges`, `R.settledNotices`, `R.resolveNotice`, `R.applyInbox`'s new `refusals` and `skips`), `tools/bastion/tool.js` (Management box, `tellSettled`, `tellResolved`), `tools/bastion/bastion.css`; `tests/rules/bridge.test.js` (18 tests), `tests/e2e/bridge.test.js`, `commerce.test.js`, `courier.test.js`, `creatures.test.js`.

### BAS-SB-02 · Bastion Events removed (Strip Back Overhaul, S05)
**Deliberate change** (Harry's STRIP BACK handover: remove the Events panel and its functionality) · other

- **Before:** the Bastion had an Events panel (a bottom-bar button, **Roll Bastion Event**, and the last event with its description) and rolled a d100 event by itself every 28 days (Days 29, 57, 85…), logging "Auto event" and adding "Bastion event: X (rolled N)." to "The Ironbow sends word…". The DM doc's "Next word from the Ironbow" and the Explorer's "The Ironbow sends word…" announced "A Bastion event is due." every 28 days. An event was only text for the DM: nothing in it changed the Bastion's numbers.
- **After:** all of that is gone: the panel and its button (the left side of the bottom bar is Warehouse, Management, Day Log), the roll, the automatic event, `events-data.js`, `R.rollEvent` / `resolveEvent` / `isEventDay` / `nextEventDay`, `BASTION_EVENT_EVERY`, `time.eventEvery`, the forecast line and the event CSS. `R.finishDay` now only keeps the day's news. The Bastion's save holds no `lastEvent` or `lastEventDay`.
- **Migration** (`dropEvents`, first in `R.stripBackSteps`): drops `lastEvent`, `lastEventDay` and any pending-event record. A save that never rolled one leaves no trace and nothing is said. One that did gets one line in "The Bastion has changed" under "Bastion events": "The Bastion no longer has events, so the last one it rolled (Friendly Visitors, Day 29) is not kept. It was only a note for you; nothing in it changed the Bastion's numbers." Old "Bastion event: …" lines already in "The Ironbow sends word…" are kept (history). Nothing is refunded (an event never cost or gave anything).
- **Side effect to know about:** the DM doc's "Next word from the Ironbow" now reads "nothing due" (or "Bastion not saved yet") when nothing is coming, where it used to always show the next event day. With the Bastion saved and nothing pending, the Explorer's Make Camp no longer shows "The Ironbow sends word…" on Day 29.
- **Left alone:** the war game's own **Defend Bastion** event (`war-campaign-rules.js`, the War Council and the War Table), which shares no code with Bastion Events and goes with the war removal; the shrines' text "no Bastion event damages a facility by natural causes yet" (still true; goes with the shrines in S11).
- **Evidence:** `tools/bastion/rules.js`, `tools/bastion/tool.js`, `tools/bastion/strip-back-rules.js` (`dropEvents`), `shared/js/campaign-rules.js`, `shared/data/tools.js`, `tests/rules.html`; `tests/rules/strip-back.test.js` (10 tests), `bastion.test.js`, `campaign.test.js`, `explorer.test.js`; `tests/e2e/phase9.test.js`, `bastion-screen.test.js`, `dmdoc.test.js`.

### BAS-SB-03 · The war game is removed (Strip Back Overhaul, S06)
**Deliberate change** · other

- **Before:** the Bastion had a War Council and War Table (regiments, Lieutenants, a battle engine, enemy armies, campaign wars against Clans, Military Actions, a Defend Bastion event, defenders and an armoury, a war log) and the Compendium listed the units.
- **After:** all of it is gone from the screen, the rules, the data, the forecast, the DM doc, the Compendium (21 entries) and the guide; the war pictures are in `tools/bastion/assets/extras/`, the old documents in `docs/archive/` with a "removed 22 October 2026" banner.
- **Evidence:** `tools/bastion/` (war files deleted), `tools/bastion/rules.js`, `shared/js/campaign-rules.js`, `guide.html`; `tests/static-check.js`.

### BAS-SB-04 · Barracks, Armoury, Watchtower, War Room and Menagerie are removed
**Deliberate change** · other

- **Before:** the Bastion had 20 facilities and started with five built (Workshop, Dock, Barracks, Armoury, Watchtower).
- **After:** 15 facilities, and it starts with two built (Workshop, Dock). In an existing Bastion the five go to "gone facilities" (`archivedFacilities`), with their slots freed and their levels removed.
- **Evidence:** `tools/bastion/data/facilities-data.js`, `bastion-data.js` (`startingBuilt`), `strip-back-rules.js` (`dropWarFacilities`); `tests/rules/bastion.test.js`, `strip-back.test.js`.

### BAS-SB-05 · Orders of the removed facilities, and War Actions, are cancelled when a saved Bastion is converted
**Deliberate change** · data

- **Before:** a pending Drill, Arm Defenders, Recruit Beast or build order of a war facility, or a War Action, would have kept running.
- **After:** the conversion cancels each one and gives back the gold it cost (the report lists them); a War Action cost no gold, so nothing is refunded, and the Honour/Respect and Political Capital it took are not given back (the report points at Change a score in the DM doc).
- **Evidence:** `strip-back-rules.js` (`settleWarOrders`); `tests/rules/strip-back.test.js`, `tests/e2e/migration-v4.test.js`.

### BAS-SB-06 · The army, the wars, the Menagerie's beasts and the war log are dropped when a saved Bastion is converted
**Deliberate change** · data

- **Before:** a version 3 save kept `defenders`, `defenderBeasts`, `military`, `militaryActions`, `warMissions`, `warRecovery`, `wars`, `warLog` and the day's attack roll.
- **After:** they are deleted and said in plain English (the beasts with what they cost, so a purchase made is not refunded; the Clans named as at war; regiments and the Lieutenant). Nothing is dropped silently, and the converted file passes the audit (I1 to I7). A re-run on a version 4 save tidies again with a short notice.
- **Evidence:** `strip-back-rules.js` (`dropWar`); `tests/rules/strip-back.test.js`, `tests/e2e/migration-v4.test.js`.

### BAS-SB-07 · Facilities Under Repair are cleared when a version 3 Bastion is converted
**Deliberate change** · data

- **Before:** a facility Under Repair after a lost battle stayed under repair for its days.
- **After:** only a lost battle in the war game ever caused a repair, so a first conversion clears them (the facilities work again, said in the report). The Under Repair machinery stays for later steps (an empty `repairs`), and a re-run on a version 4 save never clears repairs.
- **Evidence:** `strip-back-rules.js` (`dropWar`); `tests/rules/bastion.test.js` (repairs).

### BAS-SB-08 · The Commercial Convoy and the Maritime Approaches protections are gone from the Dock
**Deliberate change** · other

- **Before:** the Barracks and the Watchtower gave the Dock two voyage protections (Guard Commercial Convoy, Protected Maritime Approaches) beside the Blessing of Pelagos.
- **After:** the Dock offers only the Blessing of Pelagos. A saved Convoy or Approaches is dropped on conversion and said (a held Convoy was a charge for the next ship, not gold). The generic charge-and-window rules stay (the Blessing uses them); `R.protectionBusy` is removed.
- **Evidence:** `tools/bastion/data/commerce-data.js`, `commerce-rules.js`, `strip-back-rules.js` (`dropWarFacilities`); `tests/rules/commerce.test.js`, `tests/e2e/charter-terms.test.js`.

### BAS-SB-09 · The War Table's saves are set aside after the conversion, and Reset no longer lists them
**Deliberate change** · data

- **Before:** the War Table kept its settings and map in `tsi.bastion.warTable` and its map keys; Reset listed them and a backup checked them.
- **After:** they are ignored by import checks, set aside (not deleted) by the Bastion's start-up only after the conversion has passed its check and the converted Bastion has been saved, and left out of Reset.
- **Evidence:** `tools/bastion/tool.js` (`sweepOrphans`), `rules.js` (`importProblem`); `tests/rules/bastion.test.js`, `tests/e2e/migration-v4.test.js`, `bastion-screen.test.js`.

### BAS-SB-10 · Left alone (not bugs I fixed; to know about)
- A version 3 save's report always says the Barracks, Armoury and Watchtower are gone (they were starting facilities), so the short "nothing to convert" box cannot be reached by a real version 3 save.
- `tests/rules/bastion.test.js` still has an old "never touched" test for the version 2 to 3 conversion that uses a War Room and wars as sample data; it tests that older conversion, which is unchanged, and passes.
- The heavy fixture (`tests/fixtures/bastion-v3-heavy.json`) was regenerated: the key order of war fields differs; harmless.
- The shared disk filled up while this step ran (other lanes' worktrees). It is an environment problem, not a code one; it truncated one rules run, which was re-run in full.

### BAS-SB-11 · A party can no longer found a Clan; it has a Party Name instead (Strip Back Overhaul, S07)
**Deliberate change** · other

- **Before:** at party level 9, with a total support of 360 and three Clans at 55, the party could press Form Clan and become "Clan: <name>" with a chief, a motto and Clan Honour; until then it was "Unsworn". The Party Identity panel was a 760 px panel with the status pill, the requirements line, Form Clan and the crest buttons.
- **After:** no Form Clan, requirements, Clan Honour, "Unsworn" or "Clan: name" anywhere. The crest badge opens a small (540 px) Party Identity panel: Party Name (optional, 40 letters), Create in the Clan Crest Creator, Upload, Remove. The name shows above the crest (badge and panel) and nowhere else. The crest works from the first day, with no gate.
- **Evidence:** `tools/bastion/tool.js` (identity card, badge), `tools/bastion/rules.js` (`R.cleanPartyName`), `tools/bastion/bastion.css`; `tests/e2e/party-name.test.js`, `tests/rules/party-name.test.js`, `tests/e2e/bastion-screen.test.js`, `phase9.test.js`.

### BAS-SB-12 · A Bastion that had founded a Clan keeps the Clan's name as its Party Name; the rest of the Clan is dropped when it is converted
**Deliberate change** · data

- **Before:** a version 3 save held `organization` (type, name, chief, motto, founding day), `clanHonor` and `trustedClientsByClan` (the archived Brigade's scores).
- **After:** the conversion (step `identity`) puts the Clan's name in `partyName` once (only if the Party Name is empty), deletes the three fields from the live save and says so in the box that says what changed ("Your Party": the chief, motto and Clan Honour are not kept; the set-aside copy has everything). The crest stays. The seven Clans' Honour/Respect and Political Capital are untouched. Pure, idempotent, audit-clean; a save with only the empty defaults hears nothing.
- **Evidence:** `tools/bastion/strip-back-rules.js` (`detectIdentity`, `dropIdentity`); `tests/rules/party-name.test.js`, `tests/e2e/party-name.test.js`, `tests/e2e/migration-v4.test.js`.

### BAS-SB-13 · A Mercenary Brigade's name (Builds 1 and 2, 8 October 2026) also becomes the Party Name
**Deliberate change** · data

- **Before:** such a save loaded as Unsworn with a Day Log line naming the Brigade.
- **After:** the same conversion step keeps the Brigade's name as the Party Name and says it was a Brigade. The Day Log line and the corner notice are gone (the Day Log is going, and the report says it once).
- **Evidence:** `strip-back-rules.js` (`dropIdentity`); `tests/rules/party-name.test.js`.

### BAS-SB-14 · Taking a crest from the Creator does not take its "Clan/Party Name" field
**Left alone** · other

- **Before and after:** the Creator's name field names the downloaded file and rides along in the hand-off; the Bastion uses it only in the crest's file name ("<name> (Crest Creator).png"). It is not copied into the Party Name; the Party Name is typed in the Bastion. The tool is still called "Clan Crest Creator" and the field "Clan/Party Name" (Harry: for now).
- **Evidence:** `tests/e2e/phase2.test.js`; `tools/crest/tool.js` (untouched).

### BAS-SB-15 · A very long name with no spaces is cut with "…" on the badge
**Left alone** · other

- **Before:** a long Clan name was clamped to two lines under the crest.
- **After:** the Party Name takes two lines at most above the crest, and the badge widens (up to 236 px) so a normal 40-letter name shows whole. A 40-letter name of wide capitals with no spaces is cut with an ellipsis on the badge; the full name is the badge's tooltip and is in the panel. Leading and repeated spaces count towards the box's 40-character stop (the saved name is tidied afterwards).
- **Evidence:** `tools/bastion/bastion.css` (`.tsi-bas-badge__name`); `tests/e2e/bastion-screen.test.js`.

### BAS-SB-16 · The Clan Influence panel still shows "support" until it goes
**Left alone** · other

- **Before and after:** `R.supportForClanKey` (the number beside each Clan in the Clan Influence panel) is kept, because that panel is removed by step S10, which should delete the function and its test group ("Bastion: Clan support") with it. The functions only founding a Clan used (`totalSupport`, `clansAtSupport`, `canFormClan`, the 360/55/3 numbers) are gone.
- **Evidence:** `tools/bastion/rules.js`, `tests/rules/bastion.test.js`, `tests/e2e/phase9.test.js` (Honour/Respect check).

### BAS-SB-17 · The Dock takes the Port Charter system (BAS-104)
**Changed, Harry's request** · behaviour

- **Before:** Register Port Charter was an order at the Hall of Emissaries; the Port Charters box with each Charter's terms (Amend, Reset, history) was in the Hall's panel; the Dock only listed the Charters.
- **After:** Register Port Charter is a 3-day, no-gold, no-roll order at the **Dock** (any Dock level, as it was any Hall level); the Charters, their terms and history are in the Dock's **Port Charters** tab. The Hall has no Port Charter code or text left. Nothing about a Charter's rules, price, terms or ships changed.

### BAS-SB-18 · The Dock panel has four tabs
**Changed, to fit the laptop** · layout

- **Before:** one long panel (about 1,025 px of content in a 740 px body on the laptop with three Charters and no ships), with the orders first and the cargo section underneath.
- **After:** tabs **Cargo** (opens here; Ship cargo… in view), **Orders** (Upgrade, Charter Berth, Register Port Charter), **Port Charters**, **Routes**. The selectors tests use (`ship-cargo`, `dock-cargo`, `dock-charter-<port>`, `dock-protections`, `voyages`, `schedules`, `sales`) are the same; the order buttons are under Orders.

### BAS-SB-19 · The Routes map now shows Port Charters and ships, and it moved to the Dock (BAS-27, BAS-05, BAS-11 become history)
**Changed, Harry's request** · behaviour

- **Before:** the Hall's Routes pill opened a pop-up map that glowed a Clan only for a running Trade Consortium route or Trade Agreement (and a Trade Agreement found no art, BAS-27, because its Clan was saved as "Clan Karr"); in a new game it could never show anything once the Consortium went.
- **After:** the Dock's Routes tab glows each Clan with a **registered** Port Charter (steady) and brighter while a ship is at sea to it; an earned Charter lights nothing but is listed. The map is Clan-level (seven lanes for ten ports); there are no port pins or ship pictures (new art would be needed). It stops pulsing with "reduce motion".

### BAS-SB-20 · Explorer dialog's wrong "Level 2" text fixed
**Fixed (wording)** · text

- **Before:** the Explorer's Port Charter dialog said a "Register Port Charter order at the Hall of Emissaries (Level 2, 3 days)" registers it; the order was always Level 1.
- **After:** "a Register Port Charter order at the Dock (3 days) registers it." The same change in the Explorer's harbour box line, the Bastion's notice and log line, the Dock's blocked-shipping messages and `shared/data/ports.js`.

### BAS-SB-21 · Voyage protections from the Barracks and Watchtower are gone (BAS-111)
**Changed, Harry's request** · behaviour

- **Before:** the Dock listed three protections (Commercial Convoy −5, Protected Maritime Approaches −5, Blessing of Pelagos −10); `commerce.test.js` and `charter-terms` asserted three.
- **After:** the data lists only the Blessing of Pelagos, so the Dock's list reads only it. A held Convoy charge or Approaches window in an old save is dropped when the Bastion is converted, by the war removal's own step (with a line; free to prepare, so nothing is owed); the Blessing is never touched. (The Barracks and Watchtower, and `R.protectionBusy`, went with the war game in step S06.)

### BAS-SB-22 · The Hall of Emissaries is one level with no orders (BAS-103)
**Changed, Harry's request** · behaviour

- **Before:** five orders (Host Delegation, Inter-Clan Summit, Secure Writ of Authority, Trade Consortium, the retired Secure Trade Agreement), an Upgrade to Level 5 that raised a diplomacy-roll bonus, Routes, Resolve, a Council Ledger, an Ironbow Trade Network section (stability, income, yield, High-Risk Routing, investments), a Clear Diplomacy Records button, and automatic weekly payments.
- **After:** `functions: []`, `singleLevel: true`. The panel shows the Clans' Honour/Respect and Political Capital to read only, **Diplomatic Events** (the old Diplomatic Records ledger) and the read-only Earlier agreements and routes. Honour/Respect and Political Capital change only through Change a score in the DM doc or a confirmed Diplomatic Event. No diplomatic incident happens by itself.

### BAS-SB-23 · Hall rules removed: B2, B3, B6, B20, B21, BAS-05, BAS-11, BAS-29, BAS-34 become history
**Changed, Harry's request** · behaviour

- **Before:** these entries describe rules in `R.emissaryPlan`, `R.applyEmissary`, `R.settleRoute`, `R.rule`, `R.tickDiplomacy` and friends (a natural 1 signing a deal, Host Delegation's two rolls, a Writ bonus never granted, a route paying once a sailing, the "[object Object]" in the verdict log, an outcome text never shown, a consortium not reopening an expired route).
- **After:** the code and its data (`hallDC`, `hallTiers`, `delegation`, `networkUpgrades`, `councilDC`, `reactions`, `hallTips`…) are deleted. Add "removed in the Strip Back Overhaul" to those entries.

### BAS-SB-24 · Running contracts and sea routes are paid out once, then end (decision 4.4 of the plan; BAS-83 history)
**Changed, Harry's request ("stop at migration, stay as read-only history"); final settlement is the recommended policy** · migration

- **Before:** each contract paid its income every 7 days into the treasury; each live route paid its yield every 7 days (a d20 for a high-risk one, a dispute for a bad failure).
- **After:** when an old Bastion is converted, the remaining income is paid **once**, from the save, with no dice (a contract: `income × shipments still to come`; a route: its expected yield for each sailing still to come until it, or its Trade Consortium, would have ended; a disrupted, expired or Consortium-less route is owed nothing), every amount itemised in "The Bastion has changed", then each is ended and kept as one line of read-only history. A second conversion or a reload pays nothing more.

### BAS-SB-25 · Hall orders waiting at conversion are cancelled with their gold back
**Changed, deliberate departure from "Cancel keeps the gold" (B9)** · migration

- **Before:** an order the DM had paid for and not yet seen resolve (150 / 450 / 600 / 900 / 250 gp for the five actions; Stability 75 gp and Yield 90 gp for the Trade Network) would have completed to nothing and lost the gold.
- **After:** each is cancelled by name with `costGP` returned, the treasury rising by exactly the itemised sum (audit I1). An Upgrade at the Hall is cancelled (free). The Register Port Charter order moves to the Dock instead (BP-S08-a).

### BAS-SB-26 · Delegations, Summits, cooldowns, Favour Tokens and disputes end
**Changed, Harry's request** · migration

- **Before:** a delegation and Summit lasted their days (the Summit cut Hall action prices 25%), a bad failure set a 14-day cooldown, Host Delegation could award Favour Tokens (never spent on anything), and a disastrous sailing filed a dispute for the Council Ledger.
- **After:** all end at conversion with a sentence each; no gold is owed for any of them (a disputed route's ruling can no longer restore it). The Clan Influence panel's Favour Tokens pill reads 0 until S10 removes it.

### BAS-SB-27 · Four phase9 checks about a day paused on a dice box were deleted
**Left alone, coverage lost** · test

- **Before:** `phase9` paused a day on the Hall's typed d20 (a Secure Trade Agreement order) to check Enter and Space cannot start anything else (BAS-10), a cancelled roll keeps the order due with Resolve (BAS-02, BAS-13), and closing the window mid-day loses nothing (BAS-02).
- **After:** deleted, because the Hall's actions were the only orders that asked for a typed d20 inside a day (the War Council's War Actions were the other, and the war removal took them out). The rules for a skipped order (`R.skipOrder`) and the Resolve button, and the dice box (`rollD20`), remain in the code with no user; the lead may want to remove them in the clean-up step.

### BAS-SB-28 · Left alone: Favour Tokens pill, `state.diplomacy`
**Left alone, for S10** · cleanup

- `state.diplomacy` is `{ tokens }` and the Clan Influence panel still shows the Favour Tokens count (always 0 after conversion). S10 can delete both. `R.supportForClanKey` (Support) is untouched (Clan Influence and Form Clan).

### BAS-SB-29 · Clan Influence and the Day Log leave the bottom bar (Strip Back Overhaul, S10)

- **Changed on purpose.** Before: Clan Influence and Day Log opened from the bottom bar. After: both gone; Political Capital and Honour/Respect are read in the Hall's Clan Relations and changed only by Change a score in the DM doc.
- **Fixed.** Before: "Management" was clipped to "MANAGEMEN" on the bottom-bar button at 1920 x 1080. After: the panel buttons are wider.
- **Left alone.** `state.log` is still written and still saved (it grows without limit) until step S18; nothing shows it. The old-Day-Log text file reads the live save's log, so S18 must move that to the set-aside copy.
- **Left alone.** Rule functions still return `{ log: [...] }` pairs; the screen writes them to `state.log` only.
- **Left alone.** Beast Handler link code (`bastion-link.js`) comments still mention "the Day Log"; S18 sweeps them.

### BAS-SB-30 · One Temple replaces the Shrine of Telluria, the Shrine of Aurush and the Shrine of Pelagos
**Changed, Harry's request** · behaviour

- **Before:** three buildings (party level 8, a slot each, levels 1 to 5, Craft, Pray and four blessing orders each).
- **After:** one building, `temple`: party level 8, a construction slot, 21 days, one level only (no Upgrade row). Its panel is split into thirds, one for each god. The world text "Temple of ..." (regions, Explorer events, the Notice Board) is not touched.

### BAS-SB-31 · Pray to (god) is instant and adds a d50, not a 1-day order with a 1d20
**Changed, Harry's request** · behaviour

- **Before:** Pray was a 1-day order; its third option rolled 1d20 and added that many percent to the bar.
- **After:** a button in each god's third; the Bastion rolls a d50 (1 to 50 percent), adds it to the bar at once (the bar stops at 100) and shows the roll. Praying at a full bar adds nothing and says so (my judgement call: the button is not disabled, since Harry did not say it should be).

### BAS-SB-32 · Receive Blessing: three blessings a god, only on a full bar, instant, the whole bar spent
**Changed, Harry's request** · behaviour

- **Before:** four blessing orders a god at Levels 2 to 5, each taking days and 0, 5, 10 or 25 percent of the bar when it started; Cancel never gave the Favour back.
- **After:** a dropdown of three (Pelagos: Voyage Blessing, Bless Commercial Shipment, Great Rite of Pelagos; Aurush: Blessed Lantern, Consecrate Expedition Supplies, Great Rite of Aurush; Telluria: Earthward Talisman, Rootguard Salve, Great Rite of Telluria), greyed out until the bar is 100. It happens at once, spends the whole bar and makes no order (so there is nothing to cancel). A full bar now takes about 4 prayers (a d50 averages 25.5), against about 10 with the old 1d20 (10.5), so blessings come faster; the numbers (`prayDie`, `full`) are in the Temple's data.
- **Judgement call:** pressing Receive Blessing asks first ("the whole bar is spent"), because a mis-click costs a whole bar and the dropdown starts on its first blessing.

### BAS-SB-33 · Craft charms, the hint and long-rest prayers, Purification Incense, the Aquatic Protection Charm and Bless Bastion Foundations are gone
**Changed, Harry's request** · behaviour

- **Before:** six charms (Craft), two prayers that rolled a hint or a long rest, and three more blessing orders (one of them, Bless Bastion Foundations, listed but never available).
- **After:** none of them exist. Their goods (Purification Incense, Aquatic Protection Charm and the rest) stay in the catalogue, the Courier and the Travel bags so anything already made keeps its name. The Compendium loses their 15 names (270 items become 255).

### BAS-SB-34 · The Favour of the Gods panel, its button and Claim are removed
**Changed, Harry's request** · behaviour

- **Before:** a bottom-bar Favour button opened three bars with a Claim button at 100 that only reset the bar.
- **After:** the bars are in the Temple; Receive Blessing is what resets a bar. The saved `favour` map is unchanged; the DM doc's "Where the party is" god card and Change A Score for Favour work as before.

### BAS-SB-35 · Converting a saved Bastion: the Shrines become one Temple
**Changed, Harry's request** · data

- **Before:** a saved Bastion had up to three Shrine slots, their levels and pending orders.
- **After:** the first built Shrine's slot (else the one ready first) is the Temple; the rest are free; its level is 1. The nine orders the Temple still gives move to it (id, due day and what they cost kept) and complete on their due days. Everything else (Craft, every Pray, Incense, the Aquatic Charm, Bless Bastion Foundations, Upgrades) is cancelled with Favour (up to 100, overflow said), goods and gold given back, and reported in plain English. A pending Favour prayer is cancelled too: its roll is not made (it cost nothing). Held Blessings of Pelagos, Great Rites and Favour are kept exactly.

### BAS-SB-36 · Left alone: the generic `favourCost` machinery
**Not fixed, my judgement call** · code

- **Before:** `R.issueOrder`, `R.favourBlocker` and the facility rows take a Favour cost from a god's bar when an order starts.
- **After:** the same code stays, but no function in the data has a `favourCost` any more, so it is never used. It is left in so as not to widen the merge with the other lanes; a later step can delete it.

### BAS-SB-37 · Left alone: the word rule that turns `shrine_aurush` into "Shrine of Aurush"
**Not fixed, my judgement call** · code

- **Before/After:** `shared/js/campaign-rules.js` still names a retired Shrine id in words; the Explorer and the DM doc read a version 3 save before the Bastion converts it, and its orders still say "Shrine of ...". It can go once no version 3 save can be read.

### BAS-SB-38 · No Temple is built for free when only orders are found
**Changed, my judgement call** · data

- **Before/After:** if an old save holds a Shrine order but no Shrine standing, the order moves to the Temple (it completes on its day; Favour, Great Rites and held blessings never need a building) but no Temple appears. (The Beast Pen step builds a free Pen only when beasts would otherwise be invisible; nothing is invisible here.)

### BAS-SB-39 · The Workshop staff (Strip Back Overhaul, S12)

| Id | What | Before / after | Left alone or fixed |
|---|---|---|---|
| WS-a | **Handyman's list is a PLACEHOLDER** (Harry will supply it) | Before: the DM picked up to six tool tables. After: the Handyman crafts from the six tables nobody else claims (103 items, 3 days), marked PLACEHOLDER in the data, on his card and here. | Placeholder, by decision |
| WS-b | **Artisan's extras are a placeholder**: "Extra options: to come" | After: a card with no orders; `artisanExtras` on every craft order is the hook (empty). | Placeholder, by decision |
| WS-c | **Smithing retired** | Before: a 5-day, 29-item order for Bastions that had a Smithy. After: hidden; the Smith crafts the 30 items of Smith's Tools in 3 days. A Smithing order already pending still finishes. | Deliberate |
| WS-d | **Library & Scriptorium and Arcane Laboratory removed** | Their jobs are the Scholar's and Alchemist's; pending orders move with their ids and days; upgrades there are cancelled (free); slots freed. | Deliberate |
| WS-e | **QUESTION FOR HARRY: charts and Research now need the Workshop at Level 3.** | Before: Overland charts needed the Library at Level 2 (7 days of upgrading). After: the Scholar opens at Workshop Level 3 (7 + 14 days of upgrading, 21 in all). The Workshop's own level is NOT raised for a Bastion that had a Library, so such a Bastion cannot prepare charts until the Workshop is upgraded. The conversion report says so. Should a Bastion that had a Library at Level 2 get the Workshop raised to Level 3 once, as a goodwill step? (Not done: it would give free levels.) Likewise the Alchemist needs Level 4 for orders the Laboratory gave from the start (Craft Common and Uncommon had no level need; Alchemy needed party level 9). | Question |
| WS-f | **Alchemy's party-level-9 gate dropped** (Harry's E Q5 default) | Before: Alchemy needed party level 9. After: only Workshop Level 4. | Deliberate |
| WS-g | **Duplicate potions left out of the Alchemist's lists** | Potion of Climbing (Craft Common), Potion of Resistance and Potion of Water Breathing (Craft Uncommon) are offered once, at 3 days, by Alchemist's Supplies. An order already pending for one still finishes. | Deliberate |
| WS-h | **Several jobs at one staff member after conversion** | A Bastion that had a Library chart order and a Research order running at once keeps both (they finish as before); new orders wait until the Scholar is free. | Left alone |
| WS-i | **BAS-26 (scripture notes never attach) moves with Research** | The benefit text still does not attach. | Left alone |
| WS-j | **The Library and Laboratory buildings are no longer drawn on the map**; their paintings and map overlays are in `assets/extras/`. | Could be drawn when the Workshop reaches Level 3 and 4 if Harry likes. | Left alone |
| WS-k | `bastion-screen` ended with a "The Bastion has changed" box over the last check (Favour Tokens the Hall's wind-down still finds in a save an earlier check left); the test now presses "I've read this". | Test only. | Fixed in the test |
| WS-l | Rope of Climbing is in Craft Magic Item but in no reference table (harmless, as before). | | Left alone |

### BAS-SB-40 · The app no longer sends anything (Strip Back Overhaul, S13)
**Changed, Harry's request** · behaviour

- **Before:** a player could ask the Bastion to change a profile line or start a free training order; the request travelled as a signed `BHC1.` code (phone) or through the `tsi.beasthandler.queue` key (laptop), the Bastion kept a receipt for each in `s.beast.done`, and the DM had a "Take requests from handlers" switch, a "Paste a request code…" button and a "Latest requests" list.
- **After:** the app is read-only and sends nothing. The request code, the receipts, the queue, the switch, the paste box, the list, the Orders tab, the waiting overlays, "Edit or roll this profile" and the "From the Beast Handler:" notice are gone. A saved Bastion that still holds the old record (`accept`, `done`, `floor`) loads quietly and the version 4 conversion drops it (step `dropBeastRequests`); the old queue key and a phone's old outbox and draft keys are deleted when the Bastion, the laptop copy or the phone page opens.

### BAS-SB-41 · The Bastion rolls a beast's first meeting, once
**Changed, Harry's request** · behaviour

- **Before:** the player typed, tapped or rolled a subspecies and three personality lines on the phone, and the phone sent them as a request.
- **After:** at Bond 1 the Bastion rolls the subspecies (fixed per kind, `data/initiation-data.js`) and the three personality lines (d12, d8, d8, genuinely random) once, keeps them in `development.initiation`, fills blank lines only, and writes a Day Log line ("first meeting prepared… staged: fixed until further notice"). Beasts already at Bond 1 or more with no variety are rolled for once, when the Bastion opens or a day passes (Elara's wyvern becomes a Bloodcrest). A beast that already has a variety is never rolled for.

### BAS-SB-42 · The first meeting is a reveal of what the Bastion decided
**Changed, Harry's request** · behaviour

- **Before:** panel 2 and 3 were typed fields, five tap chips and Roll buttons that only suggested a line.
- **After:** panel 2 is shuffled medallions, one "Roll for subspecies" button, a die and a hopping marker that lands on the Bastion's answer; panel 3 is three cards whose dice settle on the Bastion's real numbers. Once per device per beast (phone: `tsi.beasthandler.phone.seen`; laptop: session only), no skip on a phone, "Skip for now" on the laptop.

### BAS-SB-43 · Subspecies at the first meeting: random among the rollable ones (changed 26 October 2026)
**Left alone, by design** · content

- Before: every wyvern met as a Bloodcrest, griffin as Dawnmantle, dire wolf as Blacktide, Buckbear as Broadcrown, Fellcat as Lichenback, "fixed until further notice". After (Harry, 26 October 2026): the first meeting is an even pick among the varieties marked `rollable: true` in `tools/beasthandler/data/profile-tables.js`: Wyvern Leafwing, Ironcrown, Bloodcrest; Griffin Dawnmantle, Silvershroud; Dire Wolf Slatejaw, Blacktide; Buckbear Broadcrown, Shovelhorn; Fellcat Lichenback, Smokecoat. The other varieties are stored in the tables (33 in all: Wyvern 8, Griffin 8, Dire Wolf 7, Buckbear 5, Fellcat 5) but never come up by chance. `mode: 'fixed'` in `tools/beasthandler/data/initiation-data.js` still works. The Day Log says "rolled d2/d3 n" in random mode and "staged" only in fixed mode.
- The tables come from Harry's PDF BEAST_INFO_TABLES of 26 October 2026. Some new varieties (Leafwing, Flamescale, Razortail, Sunmane, Gloamquill, Wrecktalon, Frostcrown, Smokecoat, Shovelhorn and the other Buckbear and Fellcat ones) have no picture file yet: the page shows the plain frame (no broken image) until the picture is added.

### BAS-SB-81 · No variety can be typed by hand any more (26 October 2026)
**Fixed by request** · content

- Before: the DM could type a Regional Variety in the Bastion's Temperament editor. After: that box is gone; the Bastion's first-meeting roll is the only thing that gives a beast a variety. A variety already stored on an old save stays and still shows (the reveal gives it a medallion even if it is not a rollable one). The rules function `setTemperament` can still accept a `regional` value, but nothing in the screens calls it that way.

### BAS-SB-44 · The reveal's marker goes round about three times, not "one to two" (left alone)
**Left alone, judgement call** · visual

- The brief's lap count cannot be had together with 3.5 to 4.5 seconds and gaps of about 90 to 420 ms on five or six medallions. The times and gaps are kept; the marker goes round about 2.5 to 4 times.

### BAS-SB-45 · Tabs and pages
**Changed, Harry's request** · behaviour

- **Before:** bottom bar Profile, Orders, Chronicle; the picture page was reached by "Back"; Profile had an editor.
- **After:** Profile, Bond, Chronicle; Bond is the page a beast opens on; Profile is read-only; "Back" is always "All beasts". A beast that is not acclimatised (Bond 0) is a line "Not acclimatised yet" with no detail, on the phone and on the laptop. After "Skip for now" on the laptop the page shows the real subspecies and picture (the Bastion already holds it); "Subspecies not chosen yet" is now "Subspecies not known yet".

### BAS-SB-46 · Snapshot version 2 (phones must be given a new snapshot once)
**Changed** · compatibility

- **Before:** snapshot version 1 held orders, training, receipts and a request fingerprint for each beast.
- **After:** version 2 holds none of those, shows a Bond 0 beast as a name only, and carries `available` and the first meeting to the beast's own handler. A phone holding a version 1 snapshot forgets it and asks for a new one (its link is kept).

### BAS-SB-47 · Beast Handler laptop copy saves nothing
**Changed** · behaviour

- **Before:** the laptop copy saved a queue of requests, so it had Export and Import buttons.
- **After:** it saves nothing (`saves: false`), so no Export and Import for this tool. Which first meetings were shown is remembered for the window's session only. An old backup that holds `tsi.beasthandler.queue` still restores; nothing reads it and it is cleared the next time the Bastion or the Beast Handler opens.

### BAS-SB-48 · Not done, left for the next steps
**Left alone** · scope

- Buckbear and Fellcat cannot be housed or shown (no building until the Beast Pen); the reveal's five-kinds test patches the two kinds into the page. The Bonding Days counter and filling pills are S15; QR pairing and the online link are S17. The Buckbear and Fellcat d8 tables are still DRAFT.
- `tests/fixtures/bastion-v3-heavy.json` and `bastion-fixtures.js` were not regenerated (they still hold the old request record, which is what the new conversion step is tested on); `make-heavy.js` writes that old shape on purpose.
- Firefox, Edge itself and a real phone were not tested.

### BAS-SB-49 · One Beast Pen replaces the Wyvern Roost, Griffin Tower and Dire Wolf Den
**Changed, Harry's request** · behaviour

- **Before:** three buildings (each with levels, upgrade rows, room that grew with the level), each housing one kind of beast, with a list of training programmes.
- **After:** one building, `beast_pen`: party level 5, a construction slot, 21 days, **one level only** (no Upgrade row), housing **one beast of each of five kinds** (wyvern, griffin, dire wolf, buckbear, fellcat). Only two orders: House Beast Here and Acclimatise With Beast. A beast already housed when the limit arrived stays; the limit only blocks housing a new one. Demolishing the Pen is refused while any beast lives in it.

### BAS-SB-50 · The training programmes, riding harness, first flight, Rider's Pact and Controlled Ascent are removed
**Changed, Harry's request** · behaviour

- **Before:** each old building had a list of free programmes and riding preparation orders (the 150 gp harness, first flight, Rider's Pact), and a Riding line in each beast's block.
- **After:** none of it exists on screen. What an old save had recorded for a beast (programmes done, harness, flight, riding) stays in the saved beast's `development` out of sight, so nothing is lost; no new order can add to it.

### BAS-SB-51 · Bonding is by days on the road, not by orders
**Changed, Harry's request** · behaviour

- **Before:** the DM issued training orders; finishing one made the next bond milestone ready.
- **After:** a beast at Bond 1 or more, taken out on the road ("Away from the Ironbow"), earns one **Bonding Day** for each day the Explorer passes (Bond 2 at 10 days in all, 3 at 20, 4 at 30, 5 at 50; numbers in `creatures-data.js` as `bondTotals`). Days are totals, never lost, keep counting while a milestone waits, and one level rises per scene. The DM still confirms each level with a reason, as before.

### BAS-SB-52 · Acclimatise With Beast is typed at the table, DC 20 for every kind
**Changed, Harry's request** · behaviour

- **Before:** acclimatising was a free training order (Safe Acclimatisation, 5 days) at the old building.
- **After:** the handler rolls Animal Handling at the table and the DM types the total. 20 or more passes (Bond 1, the beast leaves the list and its first meeting is rolled for the Beast Handler); a lower total locks that beast for 3 in-game days (a fail on Day 10 blocks Days 11 and 12; Day 13 is allowed). The DC and the 3 days are in `creatures-data.js` (a per-kind DC is possible later). The roll is instant, so it is not a pending order; the order has "days: 1" in its data only to satisfy the rule that every order has days.

### BAS-SB-53 · Take a beast out on the road and return it: refused mid-day and while the Bastion is behind
**Changed, my judgement call** · behaviour

- **Before:** nothing like it.
- **After:** both buttons ("Take (name) on the road", "Return (name) to the Beast Pen") are switched off, with a reason, while the Bastion is behind the Explorer's day or a day is part-way through, so the day the trip starts or ends can never be miscounted. The day a beast goes out is not counted; each day after it is.

### BAS-SB-54 · A beast already at a bond level counts as having that level's days
**Changed, my judgement call** · behaviour

- **Before:** a beast brought to Bond 3 by the old orders had no days at all.
- **After:** the effective Bonding Days are the larger of what was counted and the total for the beast's level (Bond 3 counts as 20), so the pill for the next level starts at its own beginning and a migrated beast is not sent back to zero.

### BAS-SB-55 · Elara's wyvern is no longer given to a new Bastion
**Changed, Harry's request** · behaviour

- **Before:** a new Bastion held a "House Elara's Wyvern" order for her wyvern.
- **After:** a new Bastion starts with no beast. An existing save that already has her wyvern keeps it (as Bond 1, and the old Elara order, if still pending, moves to the Pen as a House order that completes only if no wyvern is housed yet).

### BAS-SB-56 · The old buildings' orders after the conversion
**Changed, Harry's request** · behaviour

- **Before:** House orders were pending at the Roost, Tower or Den; training, upgrade and riding orders ran there.
- **After:** the conversion step `rehomeBeasts` moves each House order to the Pen (same cost, inputs and due day; the label becomes "Beast Pen: House Beast Here (name)"), cancels training and upgrade orders with a refund through the shared refund helper, frees any extra built slot, releases no creature, and gives a free Pen only if beasts are already housed and no old building stands. It rolls no dice and writes plain-English lines under "joined", "beasts" and "orders". A House order that would break the one-of-each limit keeps that beast waiting, and the report line says so.

### BAS-SB-57 · Buckbear and Fellcat can be granted in the Explorer
**Changed, Harry's request** · behaviour

- **Before:** the Grant a creature dialog offered a wyvern, a griffin or a dire wolf.
- **After:** it offers five kinds and says the Pen keeps one of each. The fallback list in `shared/js/bridge-rules.js` was extended, with a test that it equals the Bastion's own data.

### BAS-SB-58 · The Pen's map overlay and tile reuse existing pictures
**Left alone, by design** · visual

- **Before:** the Roost, Tower and Den each had their own building on the map and a tile picture.
- **After:** the Pen's panel carries Harry's `beast_pen.jpg` across the top; its tile uses the Menagerie's painting (`menagerie.png`) and its place on the map is the Wyvern Roost's building overlay. All those files stay where they are (the Menagerie facility itself is not touched here). Harry may want a new tile and overlay later.

### BAS-SB-59 · `R.creatureStatus` and the war lines for beasts are left in place
**Left alone, by design** · code

- **Before / After:** unchanged. The beasts' fighting stats, "Creatures defend the Ironbow" and the War Table lines belong to the war code, which another step removes. The Pen's screens no longer use `R.creatureStatus`; whoever removes the war code can delete it.

### BAS-SB-60 · Reset Travel can show a trip as starting "before Day 1"
**Left alone, judgement call** · visual

- **Before:** n/a (new field).
- **After:** the day a beast went out moves back with everything else when Reset Travel moves the Bastion back; if that makes it earlier than Day 1 the panel says "out on the road since before Day 1" (the Bonding Days are untouched and the next camp counts normally). The same happens to old orders' issue days.

### BAS-SB-61 · The Bastion window does not pause part-way through a catch-up
**Left alone, by design** · behaviour

- **Before / After:** when the Bastion has several days to catch up it passes them in one quick run, so a window closed or reloaded "part-way" in practice leaves the last saved day, and the next open continues from there. The tests prove each day is credited once from a save left at Day 19 with the Explorer on Day 25, and after reloads at six moments around a day passing.

### BAS-SB-62 · Beast Handler: the Bond page shows Bonding Days and pills that fill
**Changed, Harry's request** · behaviour

- **Before:** five pills, full up to the bond level.
- **After:** a Bonding Days counter and a line (*On the road with (handler) since Day N* or *Resting at the Beast Pen: bonding is paused*); the next pill fills as the days pass; a full pill reads "Ready: waiting for a moment with your DM" with a soft pulse (none under reduced motion); each pill is a progress bar for a screen reader ("Bond 3, Bonded: 7 of 10 days"); a new snapshot changes the numbers in place without redrawing, so a roll or greeting is never cut.

### BAS-SB-63 · The snapshot gains a `bonding` block and a `place`; its version stays 2
**Changed, Harry's request** · behaviour

- **Before:** the snapshot listed buildings and, for an acclimatised beast of the handler's own, a detail block.
- **After:** one facility entry (Beast Pen, level 1), a `place` ("pen" or "away") on each creature and its detail, and a `bonding` block (away, since, days, next pill, ready) for the handler's own acclimatised beast only. A Bond 0 beast still sends no detail. An older snapshot has no counter until a new one is pasted; nothing breaks. Every new field has a leak test with a reason.

### BAS-SB-64 · The Beast Handler (players) box moved from Management into the Pen's panel
**Changed, Harry's request** · visual

- **Before:** the pairing and snapshot controls sat in Management with the creatures list.
- **After:** both the list of creatures and the box are in the Beast Pen's panel; Management no longer has a creatures list or the box.

### BAS-SB-65 · Test and tool notes
**Left alone** · tests

- `tests/e2e/phase8.test.js`: "Compared with the old Explorer" needs the `_legacy/` scratch folder and always fails in a clean worktree (known; unchanged by this step).
- `tests/e2e/war-room.test.js` (line about `griffin_tower`) and any other test that opens a war screen belong to the war-removal step; they are left as they were.

### BAS-SB-66 · DM doc overhaul: four panels, a Quest box, imports, one pop-out (Strip Back Overhaul, S16)
**Changed, Harry's request** · usability

- **Before:** the DM doc was one narrow column (440 by 800) of six tiles and flat sections; the pop-out opened portrait (520 by 900) and a second click opened a second window; there was nowhere to keep session text.
- **After:** four panels in a 2 by 2 grid. **Party** (level, event gold, effects for the whole party, a held Great Rite as one line, and each hero with that hero's own effects beside their name), **Bastion** (orders pending, up to five listed, next first; next word from the Ironbow, every line), **Explorer** (day, expedition line, where the party is with the Clan's Political Capital and Honour/Respect, the god's Favour and the Hall's agreements, Change a score, Threads), **Quest** (a plain text box, saved as you type). The floating panel first opens 1040 by 640 (it fits the laptop and the TV) and stacks into one column below about 760 pixels wide; each panel scrolls on its own. Pop out opens landscape (1100 by 760), and only one pop-out can be open at a time (it holds a Web Lock, `tsi.suite.lock.dmdoc`, like the tools do).
- **New saved data:** `tsi.dmdoc.quest` = `{ text, at }`, up to 200,000 characters (it is in the existing DM doc family, so Back up everything and Restore already carry it, with no change). `tsi.dmdoc.layout` now carries `v: 2`; a layout saved by the old single column is ignored once, so it reopens at the new size.
- **Explorer:** the expedition record is now `{ v: 2, n, active, startedDay, endedDay }`. `endedDay` is set when the DM presses End expedition and cleared when the next starts (null = none or unknown). **Reset Travel moves both days with every other day** (`J.shiftDays`), so they can be 0 or below afterwards; the DM doc writes them with a minus sign and adds "(Reset Travel moved the days)". A record without `v: 2` is an older one, where 0 meant "not known": on load (and in the DM doc) an expedition that had already ended gets its end day from the journey log's "Expedition N ended on Day D." line once, while that line is still there, and keeps it from then on; otherwise it stays unknown (the DM doc says "Expedition ended - began Day N"). A day is never guessed. An expedition record saved by the first S16 build (no `v`) and already moved by a Reset Travel before this fix keeps its old numbers (not recoverable).
- **Quest import:** `shared/js/doc-text.js` reads .docx (a small zip reader plus the browser's own `DecompressionStream('deflate-raw')`; no library), PDF (the bundled PDF.js, loaded only when a PDF is chosen, each text item's end-of-line flag kept, a blank line between pages) and .txt / .md. A box that already has text asks Replace, Add to the end or Cancel. Plain messages for a scanned PDF, an old .doc, a password-protected file, a damaged zip, a file over 20 MB and text over the box's limit (the import is refused whole; nothing is cut).
- **Never shared:** nothing but `shared/js/dmdoc.js` and `shared/js/dmdoc-rules.js` mention the Quest key (checked by `tests/e2e/dmdoc.test.js`); the Beast Handler snapshot is built from an allow-list and is tested not to carry it (`tests/rules/beasthandler-projection.test.js`). The Beast Handler phone page loads no DM doc script.
- **Reworded:** the Change-a-score dialog, the DM doc's own help line and the Bastion's notice ("From the DM doc: ... ") no longer promise a Day Log. `R.applyDmEdits` still writes its Day Log line (the Bastion's Day Log is removed in a later step, and `tests/e2e/dmdoc-edit.test.js` still asserts that line; it goes with that step).
- **Left alone:** `bastionComing` (it still announces the war, the Hall's removed orders, the removed Host Delegation / Secure Writ / Summit / Consortium endings, war recovery and the 28-day Bastion event); the Bastion-removal steps prune their own branches. `summary` keeps `effects` (all of them) as well as the new `heroes[].effects` and `partyEffects`.
- **Judgement calls (say if any should change):**
  - The Expedition line sits right under Day (the handover lists it last): it is one short line, and the Explorer panel is the one that scrolls.
  - An active expedition that began today reads "Expedition: began today (Day 4)"; otherwise "Expedition: began Day 4 · running 3 days". Ended: "Expedition ended - Day 4 to Day 9" (a plain hyphen, as Harry wrote it).
  - The panel lists the last three score changes (the dialog and the Bastion's receipts keep all of them).
  - Last typed wins between two windows: a window with unsaved typing keeps it (and says so) and its next save replaces the other copy.
- **Quest box and other windows (after review):** the saved text is taken whenever it differs from what this window last saved or loaded and no typing is unsaved, even with the caret in the box (the caret stays); with unsaved typing the typing is kept and a note says so. A Restore (older `at`, or no Quest text) reaches an open DM doc window by a `storage` event on `tsi.suite.replaced` (written by `TSI.store.replace`), and in any case when the window is focused, comes back into view or the box is clicked out of. The Quest key is therefore read on open, window focus, tab visible, blur and after a Restore elsewhere, never on the timer.
- **Last-moments safety net:** typing is copied to `localStorage` (`tsi.suite.dmdoc-quest-draft`, not a save, so no backup holds it) about 0.15 s after each key and in full on `pagehide`; if the browser has not finished the IndexedDB write, the copy is put back at the next DM doc open when it is newer than the saved text. A copy another open window is still writing is left alone for 5 seconds. With no small storage (memory mode) there is no safety net and the panel says "Not saved".
- **Text files:** a text file that is not valid UTF-8 (Word's plain-text save, ANSI) is read as Windows-1252 and the success message says so; UTF-16 files are read from their byte-order mark.
- **Word files:** unpacking is stopped once the text passes 20 MB, whatever size the zip declares ("too big to read"). **PDFs:** reading stops once the text is known to be longer than the box; it says "more than 200,000 characters" and imports nothing (never a cut-off text). Tidying imported text is linear (a 200,000-space run is instant) and done once; a vertical tab or form feed is a line break.
- **Orders:** an order whose day has passed reads "Was due Day 7, 2 days ago" (the Bastion's panel text, not "today").
- **Damaged saves:** names such as `constructor`, `__proto__` or `toString` in an effect, rite, Region, agreement kind or score kind no longer break the summary (own-property lookups; a hero lookup uses a null-prototype object). Not touched: `bastionComing`'s own lookups (`FACILITY_NAMES`, `OBJECTIVES`), which the Bastion-removal steps prune; a name like `constructor` there prints oddly but cannot throw.
- **Keys typed in the Quest box:** the Heartwood Ritual's roll window ignored the typing-in-a-box rule, so Enter applied and Esc closed an open roll while typing in the Quest box; it now only reacts to typing inside its own roll window. Audited every `keydown`/`keyup` handler in `tools/` and `shared/js`: the Bastion's and Crest's Escape handlers for their open pickers now ignore typing elsewhere; the Combat Tracker, War Table, Explorer and `life.onKey` ones already did.
- **Limits to know:**
  - **Restore from a backup made before this change** has no `tsi.dmdoc.quest`, so Restore empties the Quest box (it deletes saved items the backup does not hold). The guide says so. Save as text file first if the notes matter.
  - A browser without Web Locks (untested in Firefox) allows more than one pop-out window, as before; the Quest text then follows "last typed wins".
  - If the browser is saving nowhere (memory mode) the Quest panel says plainly that the text will be lost when the window closes, and shows "Not saved".
  - Text boxes, headers, footers, footnotes, comments and pictures in a Word file are not read; a PDF of pictures (a scan) has no text. The PDF reader (1.5 MB) stays loaded in that window after the first PDF, as it does in the Combat Tracker.
  - A second click on Pop out within a few seconds of the first (while the new window is still starting) is told "already open", not ignored.
- **Tests:** `tests/rules/dmdoc.test.js`, `doc-text.test.js`, `campaign.test.js`, `shrines-explorer.test.js`, `beasthandler-projection.test.js`; `tests/e2e/dmdoc.test.js`, `dmdoc-edit.test.js`, `dmdoc-fixtures.js` (a .docx made with Node's `zlib.deflateRawSync`, a hand-written PDF), `phase1.test.js` (new default size, saved layout version), `guide.test.js`.
- **Not checked:** Firefox (Web Locks, `DecompressionStream`, container queries are all in current Firefox but were not run here); Edge itself (Chromium was used); a real second screen.

### BAS-SB-67 · A phone is linked by scanning a QR code, not by pasting a code
**Changed, Harry's request** · behaviour

- **Before:** the DM pressed Pairing code…, sent the BHP1 text, and the player pasted it into the phone page.
- **After:** the DM presses **Show QR to (name)**, the player scans it with the phone camera and the page links itself. The pairing code (BHP1) and the snapshot code (BHS1) still work, tucked into a shut **Offline backup** box in the DM's box and on the phone page. A phone linked the old way keeps working (the QR link carries the same secret).

### BAS-SB-68 · The online link is built and switched off; the suite's rule about going online is NOT changed
**Left alone, awaiting Harry** · policy

- **Before:** nothing online except the Notice Board's Knightly Treasures link (CLAUDE.md ground rule 2).
- **After:** an optional online link exists (a small scrambled post box that Harry would own, in a Firebase Realtime Database) but is dormant: `tools/beasthandler/relay-config.js` ships with an empty address and the Bastion's switch (`s.beast.onlineLink`) is off. While either is missing, no request of any kind is made by the Bastion or the phone page (tested with a request spy). CLAUDE.md is unchanged. The exact wording Harry would approve is in `docs/ONLINE-LINK-SETUP.md` step 5.

### BAS-SB-69 · The settings file holds an address only, never a key
**Left alone** · policy

- **Before:** the only Firebase settings in the repo are Matt's, in `tools/quests/shop-link.js`.
- **After:** `tools/beasthandler/relay-config.js` is meant to hold one value, the post box's web address (a public identifier, not a password). The link talks to the database with plain web requests, not Google's library, so no key is needed and none is allowed (the guide tells Harry not to paste the console's `apiKey` block). The address validator accepts only an https Firebase Realtime Database address.

### BAS-SB-70 · The online link only runs while the Bastion window is open
**Left alone** · limitation

- **Before:** n/a.
- **After:** the Bastion is the only place days pass, so it is the only sender; with it closed, phones show the last copy they got. If another window hides the Bastion, Edge slows its timers (about a minute), so an update can be up to a minute late. The phone says "As of Day N, updated 3 minutes ago" so players can see how fresh it is.

### BAS-SB-71 · The phone refuses a snapshot older than the one it holds; a laptop clock set back would stop updates
**Left alone** · limitation

- **Before:** the same rule already protected pasted snapshots.
- **After:** each online copy is stamped with the Bastion's clock (kept increasing within a session). If the laptop's clock were moved back by hours or days, new copies would look older than what a phone holds and be refused until the clock catches up, or the player presses Unlink and links again. Unlikely at a table; noted.

### BAS-SB-72 · An iPhone Home Screen icon keeps its saved link apart from Safari's
**Left alone** · limitation (documented)

- **Before:** the same limit applied to pasted pairing codes.
- **After:** scanning links Safari, not an icon added earlier. The phone page has **Copy my link** (in Safari) and the icon's link screen accepts a pasted link under Offline backup; the help text on the link screen and in the QR window says so. Not tried on a real iPhone.

### BAS-SB-73 · A backup file holds every handler's secret, so it can open their online copy
**Left alone** · limitation (existing risk, now slightly larger)

- **Before:** a "Back up everything" file already held each handler's pairing secret (anyone with it could sign a snapshot for that player).
- **After:** the online channel and key are worked out from the same secret, so whoever holds a backup could also read that handler's scrambled copy. The setup guide tells Harry not to share backups.

### BAS-SB-74 · The post box's rules let anyone who knows a secret-named place overwrite or delete that place
**Left alone** · by design (tested rules from the research, unchanged)

- **Before:** n/a.
- **After:** a stranger can't list or read the post box and can't make the Bastion do anything, but whoever knows a handler's place name (which can't be worked back to the secret) could overwrite or delete that copy; the worst case is a blank or stale page on that phone until the next send (a changed copy is checked and refused on the phone). The rules' unused `inbox` half is kept so they stay exactly the ones that were tested.

### BAS-SB-75 · Phones look every 20 seconds; there is no live push
**Changed, my judgement call** · behaviour

- **Before:** the research proposed a live stream with polling as the fallback.
- **After:** polling only: a 13-byte "time of latest update" request every 20 seconds while the page is showing (plus on return to the page, on coming back online, and on **Check now**); the whole copy is fetched only when that time changes. A live stream could not be tested against the real service from here.

### BAS-SB-76 · Automated browsers can use only the made-up test address
**Changed, my judgement call** · safety

- **Before:** n/a.
- **After:** `relay.js` refuses any database address except `tsi-test-relay.invalid` when `navigator.webdriver` is true (Playwright and Selenium set it), and the test page (`TSI.space === 'test'`) always gets an in-memory stand-in. So a test run can't reach a real database even if Harry has filled in a real address.

### BAS-SB-77 · "Add a handler…" no longer asks before swapping a code
**Changed, my judgement call** · behaviour

- **Before:** typing the name of an already-paired handler asked "the old one stops working. Make a new code?" and made a new pairing code.
- **After:** it shows that handler's QR code again and changes nothing, so there is nothing to ask. A new secret is made only by **Take back code** then **Show QR to…**, or by **New pairing code…** under Offline backup (which still asks first).

### BAS-SB-78 · The QR window's link is plain text, not a text box
**Changed, my judgement call** · behaviour

- **Before:** (new window) the link first went in a read-only text box.
- **After:** plain text that selects with one click, because the shared pop-up gives keyboard focus to the first text box, which scrolled the QR picture out of sight on a phone-sized screen.

### BAS-SB-79 · The QR link carries the Bastion's save id as well as the secret
**Changed, my judgement call** · format

- **Before:** the research proposed `L1.<secret>.<name>` and the phone taking the save id from its first snapshot.
- **After:** `L1.<campaign>.<secret>.<name>`: 16 more letters (the QR is still a small 45 to 49 squares wide) so the phone keeps the strict "this snapshot is for this Bastion save" check it has always had. The name is carried as URL-safe letters of its UTF-8 so accents and spaces survive.

### BAS-SB-80 · Not tested here
**Left alone** · test gaps

- The real Google Firebase console and every step of `docs/ONLINE-LINK-SETUP.md` marked so; a real database accepting requests from a double-clicked file and from the GitHub Pages address (CORS); a real phone camera (including iPhone Safari and Home Screen behaviour); GitHub Pages serving the new phone page (the QR code points at the address in the Phone page address box, which is only right once this is merged and Pages publishes `main`); Firefox (WebCrypto and `history.replaceState` from a file). Edge itself was not run; Chromium was.

### BAS-SB-82 · New variety pictures, the Camouflage lines removed, and the post box's address added (26 October 2026)
**Changed, Harry's request** · content

- **Pictures:** Harry's new Leafwing, Ironcrown, Bloodcrest (wyverns), Shovelhorn (Buckbear) and Smokecoat (Fellcat) are in `tools/beasthandler/assets/`. The old Ironcrown and Bloodcrest pictures are kept in `assets/extras/wyvern-previous/`. A variety with no picture yet still shows the plain frame.
- **Text:** the "Camouflage: …" lines at the end of the Fellcat descriptions are removed so the tables match Harry's PDF exactly.
- **Online link:** Harry approved the change to ground rule 2 on 26 October 2026, so `CLAUDE.md` now has the four edits from docs/ONLINE-LINK-SETUP.md, Step 5, and `tools/beasthandler/relay-config.js` ships with the post box's address and `enabled: true`. The laptop still sends nothing until the DM presses Switch on in the Bastion. Tests pin the old first-meeting answers with `window.TSI_TEST_FIXED_INITIATION`, and the link tests use their own settings.

### BAS-SB-83 · The Day Log data is gone (step S18, 26 October 2026)
**Changed, Harry's request** · saves, wording

- **Before:** the Day Log screen was gone but the Bastion still wrote an internal log (`state.log`, about 77 places across the Bastion and Beast Handler code) into every save, where it kept growing and nothing showed it. Some notices and test names still said "Day Log".
- **After:** nothing writes a log any more: `R.log`, `log()`, `logAll()` and `state.log` are deleted, and so is the "Facilities" entry the facilities conversion used to add. Nothing in the game ever read the log back, so no rule changed. The Ironbow's word, notices and receipts are untouched.
- **Old saves:** a save that still holds a log loads fine. The log is kept exactly as it was under the new name `legacyLog` (never added to, never trimmed), so the conversion box's "Save the old Day Log as a text file" button still works for a Bastion converted earlier. A new or already-clean Bastion has no `legacyLog` and the button does not appear.
- **Left alone:** the rules functions still return their `[title, body]` line (`res.log`) because some screens show it in a notice or a message; it is just no longer stored. The old saved fixtures in `tests/fixtures/` keep their `log` on purpose, as examples of old saves.

### BAS-SB-84 · New Bastion map: the start painting is the base, and the buildings have new designs (26 October 2026)
**Changed, Harry's request** · visual

- **Before:** the base painting held the Workshop and Dock; each other building came from an overlay, placed on the old map (the Temple had three small overlays, the Beast Pen borrowed the Wyvern Roost).
- **After:** the base is Harry's `NEW_Bastion_Start.png` (the Workshop, the Dock and the Party Quarters are painted in, so a new Bastion begins with exactly those). The Party Quarters is picture only: no panel, no label. The nine other buildings use Harry's new overlays (the Temple one, the Beast Pen its own), and their labels and tile crops were re-measured from the new pictures. The Dock, Workshop and Party Quarters overlays, the Prison Tower (no facility yet), the empty map and the reference images are kept in `tools/bastion/assets/extras/map-2026-10-26/`; the old overlays and base are in `extras/map-previous/`.
- **Left alone:** the Workshop and Dock are in the base painting, so they cannot be darkened for Under Repair (as before).

### BAS-SB-85 · Tap a beast's picture to play its clip once (Beast Handler, 26 October 2026)
**Changed, Harry's request** · behaviour

- **Before:** a tap on the picture only gave a short glow.
- **After:** on the Bond page, tapping the picture (finger, mouse, or Space/Enter) plays that variety's short video over it once, with no sound, then the still returns. (It first played while held, as a loop; changed the same day because a long press on a phone picture opens the browser's own menu and stops it.) A variety with no video keeps the glow. Eleven loops are in (Wyvern: Ironcrown, Leafwing, Bloodcrest; Dire Wolf: Blacktide, Slatejaw; Griffin: Dawnmantle, Silvershroud; Buckbear: Broadcrown, Shovelhorn; Fellcat: Lichenback, Smokecoat), re-encoded here from Harry's originals (H.264, no sound, about 0.4 to 2 MB each) and named for their variety in `tools/beasthandler/assets/<kind>/`. The originals were not committed. A video is added by naming it in `tools/beasthandler/data/art-map.js` (`video:`).
- **Not tested here:** a real phone (the test browser plays them; the iPhone and Edge were not tried). The page loads each beast's clip when its Bond page opens, so it may take a moment on a slow connection.

### BAS-SB-86 · Every subspecies gets a medallion at the first meeting (Beast Handler, 26 October 2026)

- Before: the "Roll for subspecies" panel showed only the varieties marked `rollable: true` (2 or 3 medallions). After (Harry): it shows all of the kind's varieties (Wyvern 8, Griffin 8, Dire Wolf 7, Buckbear 5, Fellcat 5) for the look of a wider choice, and the die is the same size as the number of medallions (d8, d7, d5). The answer is unchanged: `R.initiationVariety` still picks only a rollable one, and the marker's path still takes 3.5 to 4.5 seconds. Medallions carry no pictures, so a variety without one breaks nothing; the panel is tested from 320 px to the TV.

### BAS-SB-87 · At most six construction slots and six Development Plots (26 October 2026; the slot cap replaced by BAS-SB-91)

- Before: the slot rules gave 0 / 2 / 4 / 5 / 6 slots and 0 / 2 / 4 / 6 plots by party level, but nothing held them to six if a data table said more. After (Harry): `R.MAX_SLOTS` and `R.MAX_PLOTS` (both 6) cap `R.constructionSlotsForLevel` and `R.plotsForLevel`, and a test checks every party level from 1 to 20. The top row of the bottom bar still shows 8 tiles: the two starting facilities (Workshop, Dock) are not construction slots, plus the six slots. Left as it is; ask Harry if he wants the two starting tiles moved. A Bastion that already holds more than six buildings (an old save) keeps them all, marked over capacity, as before.

### BAS-SB-88 · Prison Tower: a new facility (26 October 2026)

- Before: no way to hold captured people in the Bastion. After (Harry): the Prison Tower (`prison_tower`), party level 9, a construction slot, 21 days (a new per-facility `buildDays` in `facilities-data.js`, because the level table gives 28 days at level 9), one level, three cells, no gold. Rules in `tools/bastion/prison-rules.js`; saved as `prison` (additive, Bastion save stays version 4; an older save loads with three empty cells). Its picture is cut from the map overlay, with no painting banner.

### BAS-SB-89 · Prison Tower: when a sentence ends, and how the Explorer is told (26 October 2026)

- Before: n/a. After: a prisoner is released on the day `lock-up day + sentence` is reached, by `R.startDay`, once (the cell is emptied), with a line in "The Ironbow sends word…"; the Explorer already reads the saved Bastion for this kind of news (`TSI.campaign.bastionComing`, kind `prison`), so it says the same line before the day. Catch-up over many days frees each prisoner on their own day; Reset Travel moves every prison day with `R.shiftDays`. No new channel.

### BAS-SB-90 · Prison Tower: Under Repair, demolishing and the record of who left (26 October 2026)

- Before: n/a. After: Under Repair, sentences keep counting and end on their day, but Lock up, Interrogate and Release are greyed out until the repair ends (a repair can only come from old war saves). The Tower cannot be demolished while a cell is in use. Everyone who leaves (served or released early with the reason typed) is kept in the save's `prison.freed` (last 30), not shown anywhere yet; the notes on a freed prisoner go with that record. Left as is: a notice for a failed or passed interrogation shows in the Bastion's own window (notices do not cross windows); only the sentence ending reaches the Explorer.

### BAS-SB-91 · Construction slots capped at four, and a Party Quarters tile (it became clickable in BAS-SB-102) (26 October 2026)

- Before: up to six construction slots (0 / 2 / 4 / 5 / 6 by party level) and two starting tiles. After (Harry: "workshop, dock, party quarters = 3, then 4 slots extra for Temple, Hall, Prison Tower, Beast Pen"): `R.MAX_SLOTS` is 4 (0 below party level 5, 2 at 5, 4 from 9); Development Plots stay at 6. The top row is three starting tiles plus four slots (7). The third starting tile, the Party Quarters, is a picture only (`startTiles` in `bastion-data.js`, cut from `map/party_quarters.png`): no panel, no map label, not counted as a facility, nothing in the save; its tooltip says "Party Quarters". An old save holding more than four buildings in slots keeps them all, marked over capacity.

### BAS-SB-92 · The Bastion's Player View (26 October 2026; phases P1 to P3 of docs/PLAYER-VIEW-PLAN.md)

- Before: the Bastion had no view for the players. After: **Open Player View** opens a view-only window (the same second-window system as the Battlemap) showing the map, numbers, crest, facility tray and simple illustrated facility panels, fed only by `R.playerSnapshot` (`tools/bastion/player-view-rules.js`); it writes nothing, and `tests/rules/player-view.test.js` and `tests/e2e/player-view-bastion.test.js` prove nothing DM-only is sent. Same laptop only (two windows).

### BAS-SB-93 · The Player View's map labels are not nudged apart (26 October 2026)

- Left alone: the DM's map nudges labels clear of each other and of the crest (`placeLabels`); the Player View places them at their exact spots. After Harry's art or a crowded Bastion, a label may touch another or the crest on the TV. Not a bug that loses anything; to be tuned on Harry's screen.

### BAS-SB-94 · Facility panel pictures are the existing paintings for now (26 October 2026)

- Before: no picture for the players. After: each panel uses the facility's existing painting (the Temple its three shrines side by side; the Prison Tower and other cut-from-the-map buildings their cropped building) until Harry's 4:3 pictures are named in `player-panels-data.js` (`art`). The picture is shown whole (never cropped), so a non-4:3 painting has dark margins.

### BAS-SB-95 · The Explorer's Player View (26 October 2026; phase P4 of docs/PLAYER-VIEW-PLAN.md)

- Before: the Explorer's Player View was a "Waiting for the DM..." stub. After: **Open Player View** (in the Explorer's View box) opens a view-only window with the map filling it under one slim row (Day, Daily Travel, Gold), fed only by `R.playerSnapshot` (`tools/explorer/player-view-rules.js`). The hex grid and fog are drawn by one shared function (`tools/explorer/draw.js`) used by both the DM's map and the players'. It writes nothing; `tests/rules/player-view-explorer.test.js` and `tests/e2e/player-view-explorer.test.js` prove nothing DM-only is sent. Same laptop only.

### BAS-SB-96 · The Explorer has no pan or zoom, so there is nothing to copy (26 October 2026)

- Left alone: the brief asked the players' map to copy the DM's pan and zoom, but the DM's Explorer always shows the whole map fitted and centred (it has no pan or zoom). The players' window therefore shows the same whole map, fitted into its own shape, so a TV and the laptop show the same region; the tests check each hero sits at the same fraction of the picture in both windows, in any window shape. If a zoom is ever added to the Explorer, the snapshot will need a view field.

### BAS-SB-97 · Daily Travel on the TV is the furthest any hero has gone (26 October 2026)

- Left alone: the Explorer counts miles per hero (the DM's panel shows one hero at a time). The heroes normally move together, so the TV shows the highest count of any hero out of today's limit (a chart's extra miles included). If one hero is dragged alone, the TV shows that hero's miles.

### BAS-SB-98 · The players' map shows the fog and the weather video too (26 October 2026)

- Left alone: Harry said players see everything on the map, so the fog of war is drawn on the TV exactly as on the DM's map (dark, with the uncovered hexes cut out), and so is the day's weather video. A town pin hidden by fog on the DM's map is hidden on the TV too.

### BAS-SB-99 · The players' pin card shows what the DM's card shows (26 October 2026)

- Left alone: a town pin's data has no DM-only note field (only name, picture and description, and the description is empty today), so the players' card shows exactly those three; the Port Charter and Courier boxes on the DM's card are not sent. If a secret field is ever added to the pins, `R.playerSnapshot` copies fields one by one, so it will not be sent until named there.

### BAS-SB-100 · Night and campfire fades on the players' map (26 October 2026)

- Before: nothing on the TV when the DM made camp. After: Make Camp fades the players' map out and in once (about 1.5 s, 0.6 s hold, 1.5 s); a campfire event holds it very dark (92%) until the DM closes it. Only a campfire (camp or night) event holds it, not weather or Ironbow pop-ups. Released if the DM window closes or the link goes quiet.

### BAS-SB-101 · The Workshop's Player View pictures: one per level, filling the panel (26 October 2026)

- Before: the Workshop's panel showed its single painting, whole, with dark margins. After: Harry's five 16:9 pictures (`player-panels/workshop-level-1.jpg` to `-5.jpg`) are chosen by the Workshop's current level and fade in when it upgrades while the panel is open (no fade with reduced motion); all panel pictures now fill the picture area, cropped to fit around a `focus` point set in `player-panels-data.js` (Workshop: centre, 62% down). A level with no picture uses the nearest lower one. **Level 3's picture was missing, and is now in** (`workshop-level-3.jpg`, 26 October 2026: resolved; the fall-back to the nearest lower level stays for any level without a picture). His second 4-person picture is kept unused in `assets/extras/player-panels/`.

### BAS-SB-102 · The Party Quarters tile opens a small panel, and the players see its picture (26 October 2026)

- Before (BAS-SB-91): the Party Quarters tile was only a picture, not clickable, with no panel. After (Harry): clicking it opens a minimal DM panel (the name and "Your party's own rooms. Nothing to manage here yet.") and the Player View shows a bare panel: only "Party Quarters" in the header and `party_quarters.jpg` filling the rest (data flag `bare: true`). It is still not a facility: no level, orders, map label or save change; the snapshot's focus accepts the id `party_quarters` explicitly and no other non-facility.

### BAS-SB-103 · The Beast Pen's Player View panel lists the housed beasts (26 October 2026)

- Before: the Pen's panel for the players would have shown a level and orders. After (Harry): its painting (a copy of `facilities/beast_pen.jpg`, as `player-panels/beast_pen.jpg`), the tagline "Something stirs in the stalls..." and one line per beast housed there: name, kind (Wyvern, Griffin, Dire Wolf, Buckbear, Fellcat; not the variety) and handler, or "no handler yet"; "No beasts housed yet." when none. Nothing else about a beast is sent (no bond, temperament, notes, chronicle or where it is). A beast out on the road still lists. At most 8 are listed, then "and N more".

### BAS-SB-109 · The Prison Tower's Player View has a picture for seven of the eight cell combinations (27 October 2026)

- Before: two pictures (empty, and a prisoner in the left cell only). After (Harry's pictures): one for each of empty, left, middle, right, left and middle, left and right, and all three (`prison_tower-cells-NNN.jpg`; the digits are left, middle, right, 1 when in use). The choice is plain code in `tools/bastion/player-view-art.js`: the exact picture, else the best one that shows only cells really in use (most cells, ties to the leftmost), else empty. Tests in `tests/rules/player-view.test.js` and `tests/e2e/player-view-bastion.test.js`.
- Left alone: middle and right together (`cells-011`) is awaited from Harry; until it arrives the middle-only picture shows, so the players never see a prisoner who is not there. To add it, put the file in `tools/bastion/assets/player-panels/` and add one line to `player-panels-data.js`.

### BAS-SB-104 · The Explorer's and the Bastion's Player View windows stay open (26 October 2026)

- Before: a Player View window closed when its tool closed (switching tool, Home), so the DM had to reopen it every time. After (Harry): both stay open with their last picture, can be open together, and the tool finds its window again by itself (no click) when it is opened again or the DM's page is reloaded, because the window keeps saying "hello" to the window that opened it. Anything held (the night fade, the campfire dim, an open town card) is let go when the DM's tool goes quiet. **Open Player View** with the window open just brings it forward. If the DM's browser window is closed for good, the player window closes itself after about 30 seconds. The Battlemap's and the Notice Board's windows still close with their tool.
- Limits (not fixable from our side): the link relies on the browser keeping `window.opener` for a window opened by `window.open`. If the player window loses it (the DM's window was closed and reopened, or the browser severed the link), the window cannot be re-linked by itself; press **Open Player View**, which finds a window of the same name and brings it forward (browsers allow that only inside a click), and if that fails, close the player window and open it again. Tested in Chromium opened from files; Edge is not available here, so this is on Harry's checklist (Edge may ask to allow pop-ups once).

### BAS-SB-101 · The Explorer now zooms and pans, and the Player View copies it (26 October 2026)

- Before: the Explorer always showed the whole map (BAS-SB-96). After: wheel or trackpad zoom at the pointer, drag to pan, +, - and 0 keys, and **−**, **+**, **Fit** buttons in the map's bottom-left corner (not in the View box: there was no room for them there without making the side column scroll) (1x to 6x; the map cannot leave the area; nothing about it is saved). BAS-SB-96 is replaced: the Player View shows the same region of the map as the DM (sent as fractions of the map, `view` in the snapshot), fitted into its own window and centred, so a TV and a laptop show the same part; at 1x it is the whole map exactly as before.
- Judgement call: while zoomed in, a left-drag on empty map pans, so the selection box needs **Shift** + drag then (at 1x it is a plain drag as always). A hero's drag, pins and plain clicks are unchanged. If the players' window is a different shape, it shows the DM's region fully plus a little more map (or dark bands) on the longer side.

### BAS-SB-102 · Reset to Day 1 now blanks the Explorer (26 October 2026)

- Before: Reset Travel kept effects, threads, gold, bags and the messages for the Bastion (the Bastion marked old ones skipped). After: **Reset to Day 1** asks first, keeps a safety copy, then clears the day and miles, weather, any event in progress, effects, threads, journey log, event gold, Travel bags, expedition and the Bastion messages, and Free Move. It keeps the map and grid, the fog already uncovered, the region, the heroes (names, places, groups, sizes) and the pins. The Players' dim and pin states clear with it.
- Judgement calls (kept on the safe side): the fog already uncovered is kept (it is map state, not a journey record); the Explorer's region setting is kept; heroes keep their places on the map (only their miles reset); the Travel bags and gold are cleared to the Explorer's starting values (Harry did not tick them). `R.resetTravel` (days only) stays in the rules for the tests; the button uses `R.resetToDayOne`.

### BAS-SB-103 · The Bastion drops what the Explorer delivered after a reset (26 October 2026)

- The Explorer saves a new `resetId`; each Bastion acts on an id once (`R.clearExplorerDeliveries`), after a safety copy of its own save, as soon as it reads the Explorer (at once if open, else when next opened). Dropped: every receipt (the "Changes from the Explorer" list and the memory of seen messages), creatures the Explorer granted that still wait for a home, and Port Charters only held (not registered, no Register order running).
- Kept (safe side): buildings and orders, treasury, Warehouse, housed beasts (and Elara's wyvern), registered Port Charters, ships and shipments, **Great Rites (even ones given to the party)**, **parcels (a collected parcel stays closed; no parcel flows from the Explorer into the Warehouse, so none is dropped)**, and every Honour/Respect score a change already made (a change already applied stays applied; only its receipt goes). A Bastion that has just been Reset stays "fresh", so it still skips what was sent before it.

### BAS-SB-105 · The Prison Tower's Player View picture follows its cells (26 October 2026)

- Before: no picture for the Prison Tower's panel. After (Harry): the panel shows the three-empty-cells picture, and the left-cell-occupied picture whenever any one or more cells hold a prisoner, fading between them live (no fade with reduced motion). The Player View is sent only which cells are in use (three true/false answers): never a name, thread, sentence or note. Left alone: one occupied picture stands for every combination until Harry supplies more (`art.states['cells-101']` and so on in `player-panels-data.js`, falling back to `occupied`, then `empty`), so with only the right cell occupied the picture still shows the left cell's prisoner.

### BAS-SB-106 · The Fishery & Smokehouse's Player View pictures and ledger (27 October 2026)

- Before: no picture for the Fishery's panel. After (Harry's nine pictures): the room picture follows the Fishery's level (Levels 1 to 4; **Level 5's room picture is awaited**, so Level 5 shows Level 4's), and the open ledger on the table is a glowing, clickable hotspot (Enter or Space too; a soft pulse, none with reduced motion) that opens that level's ledger picture over the panel, Level 5's included; a click or Escape closes it. The Fishery's DM panel has **Show ledger to players** / **Hide ledger from players**; the snapshot carries only one true/false for it (only ever true with a facility open); an upgrade or another facility closes it. The data shape (`ledger: { levels, hotspot }` in `player-panels-data.js`) lets other facilities have ledgers later; the DM button only appears for those. The hotspot rectangles (70 to 88 percent across, 55 to 70 down) were set by eye from the four room pictures. The nine 2752-pixel originals were shrunk to 2400 pixels (JPEG quality 84) and the root copies removed (they stay in git history).

### BAS-SB-107 · The Routes map: a route for each port, and a moving ship (27 October 2026)

- Before: the Dock's Routes map lit one lane for each Clan (seven pictures for ten ports), and a ship at sea only made its lane glow brighter. After (Harry's ten new pictures): each port has its own route, lit while its Port Charter is **registered** (earned, being registered, removed or gone: not shown), brighter while a ship is at sea to it; the side text says "Glowing now: Goldport (a ship at sea)". A round ship badge sails along the route by the day (Ironbow, out by the outward days, rests at the port the day it sells, home by the return days, then gone; a recalled ship turns round where it was; a ship that turned back leaves from the port's approaches, because the record keeps no other day). It is display only. Rules: `R.routesMap`, `R.shipProgress`, `R.pointOnPath` (`tools/bastion/commerce-rules.js`); roads in `routePaths` (`bastion-data.js`), traced by `tests/tools/trace-routes.py` and checked by eye.
- Retired Clan route pictures (moved to `tools/bastion/assets/extras/ui/`, not deleted): blackstone, bacca, farmer, slade, molten, rowthorn and karr `_trade_route.png`.
- Left alone: Harry's pictures are 747 x 998, half the size he expected (same shape, so they fit). A ship to a port whose Charter is no longer registered is still drawn on that port's road, but the route itself is not lit. The Alderbridge road has a small wiggle near Alderbridge itself (traced from the dashes); it does not matter at badge size.

### BAS-SB-108 · The Player View shows the Dock's trade routes (27 October 2026)

- Before: opening the Dock showed the players only the Dock's painting, whichever tab the DM was on. After (Harry's request): with the Routes tab open, the players' window shows the map (full width, scrolls up and down: wheel, arrow keys, Page Up/Down, drag), the registered Charters' routes, the moving ship badges and a text strip ("Active Port Charters", "Journeys": the first four, then "and N more"). Any other Dock tab, or closing the panel, goes back. The snapshot adds only `focusView` and `routes` (ports, Charter labels, ship places and the journey lines), proved by `tests/rules/player-view.test.js` and `tests/e2e/player-view-routes.test.js`.
- Left alone: the DM's own scroll place on the map is not mirrored (optional); the players' scroll is theirs and is kept while the view stays open.

### BAS-SB-104 · The Scarlett Isles map panel on the Explorer's Player View (27 October 2026)

- Before: the players' window showed only the live map. After: a small map icon in its top row opens a scrollable panel with the picture of the Scarlett Isles (`tools/explorer/assets/scarlett-isles-map.jpg`, 747 x 998, the same scrolling as the Bastion's Trade Routes view); the DM's **Show Scarlett Isles map to players** button opens and closes it too (snapshot flag `atlas`, nothing else new is sent). The picture is the players' window's own file, never sent.
- Judgement calls: the DM's button is on the map's bottom-left corner beside the zoom buttons, not next to Open Player View (no room in the View box without making the side column scroll); the flag is not saved, so a fresh Explorer starts with it off; the panel closes itself if the window loses the suite for good.

### BAS-SB-110 · The Temple's Player View: clickable shrines and altar (27 October 2026)

- Before: the Temple's panel showed the three shrine paintings side by side with the three favour bars always on top. After (Harry's request): one picture of the hall (`player-panels/temple.jpg`) with four glowing zones. Clicking a shrine (Telluria left, Aurush back, Pelagos right) opens a small card with that god's name and Favour bar and percentage (green, orange, blue as before); clicking the offering table opens **Blessings**: the Great Rites held (each with its god, "waiting at the Ironbow" or "with the party") and any Blessing of Pelagos kept for the Dock's next ship, else "No blessings are active." One card at a time; the same zone again, a click elsewhere or Escape closes it; it updates live. In the Temple's DM panel, **Show to players:** (Telluria, Aurush, Pelagos, Altar, Hide) mirrors one card value; a player's own click opens locally and the DM's next change overrides; closing or changing the panel closes it. The snapshot adds only `facilities.temple.blessings` (god, rite name, where), `facilities.temple.held` and `card`; no prayers, rolls or order details (proved in `tests/rules/player-view.test.js`, `tests/e2e/player-view-bastion.test.js`).
- Judgement calls: Goods blessings happen at once, so they never appear as active. The zones are percent rectangles in `player-panels-data.js` (`hotspots`), set by eye on the 1600 x 893 picture; a Great Rite the party has used or let expire stays listed only while the Bastion's record still holds it.

### BAS-SB-111 · Explorer map jumps: the East Isle link moved to the south map, one missing link added, and every jump now spawns the party (26 October 2026)
**Fixed, Harry's request** · behaviour

- **Before:** the East Isle entry was listed under Eastern Province (North), but the "To The East Isle" arrow is on the SOUTH map, so going from the south map to the isle left the heroes where they were; there was no entry for going from Southern Province (East) back to Eastern Province (South); and a jump between maps that are not neighbours had no entry at all, so the heroes kept their old position on the new map (often the far side).
- **After:** the isle entry is under Eastern Province (South); Southern Province (East) to Eastern Province (South) arrives beside that map's "To Southern Province" arrow; and a jump with no entry of its own uses the first entry point the destination map already has. The party's formation is kept as before.

### BAS-SB-111 · The Hall of Emissaries' Player View: clickable table and coat of arms (27 October 2026)

- Before: the Hall's panel showed the Hall's painting with only the title, level and orders. After (Harry's request): a picture of the council hall (`player-panels/hall_of_emissaries.jpg`) with two glowing zones. The negotiation table opens **Diplomatic events**: the CONFIRMED records, newest first (latest six, then "and N more", scrollable), each as "Day N: title (Clans)" with the lasting effects still in force beneath; "No diplomatic events yet." when there are none. The coat of arms opens **Clans and factions**: the seven Clans' Honour/Respect (-5 to +5, with a small scale) and Political Capital. The DM panel has **Show to players:** (Table, Coat of arms, Hide); same one-card, local-click and close rules as the Temple (BAS-SB-110). The snapshot adds only `events`, `more` and `clans` on the Hall and the single `card` value (`tests/rules/player-view.test.js`, `tests/e2e/player-view-bastion.test.js`).
- Judgement calls (safe side): drafts and dismissed records, notes, situation, decision, outcome, ids and histories are never sent. Effects shown are only restrictions or embargoes, privileges and favours owed that are still active; unresolved obligations and quest hooks are left out because they can give away plot, and score changes (Honour/Respect, Political Capital) are not repeated under an event because the coat of arms shows the scores. The title, effect text and "until Day N" are the DM's own typed words, so the DM should not put secrets in a confirmed record's title or effect text. Clan names are shown as the Hall shows them ("Clan Slade").
