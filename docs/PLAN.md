# The Scarlett Isles: D&D Tool Suite — Plan

**Version 2, agreed with Harry on 25 September 2026.** Version 1 was the planning survey; version 2 adds Harry's answers.

This plan governs how the suite is built. CLAUDE.md's rules always win over it. Each session should read CLAUDE.md, then this plan, then the tool's section of `_reference/master-handover.md`, then `docs/PROGRESS.md` and the tool's entries in `docs/KNOWN_ISSUES.md`.

---

## At a glance

- **The survey.** All nine old repos were surveyed, then independently re-checked. They're cloned read-only into `_legacy/` (never committed), at exactly the commits the handover reviewed. The four Ritual films come from the `v1.1-ritual-endings` release. Every tool was opened from a double-clicked file in Chromium (the engine inside Edge), clicked through, and then re-checked by a second agent that tried to prove the first wrong.
- **What was found.** Half the old tools don't work at all when `index.html` is double-clicked: the Notice Board, Explorer, Bastion and Arenas. Seven lose their fonts offline, and the Ritual films and the Tracker's PDF import need the internet. All of it can be fixed without changing a single game rule.
- **Firebase.** Only the Notice Board used it, to tell Matt Owen's **Knightly Treasures** shop which quest is ★ starred. That one link is kept (Harry's choice). Everything else runs offline.
- **Structure.**
  - One `index.html`. Each tool opens as a fresh load of that page, so nothing can leak between tools.
  - Saves go in the browser's built-in database, with every name starting `tsi.`.
  - Tools that save have Export/Import; the home screen backs up and restores everything.
- **Build order.** The shell first, then small to large: Crest, Pelagosi, Notice Board, Ritual, Arenas, Combat Tracker, Explorer, Bastion.
- **Screens and browser.** Harry's laptop is 2560 × 1600 at 150% and the TV is 1920 × 1080 at 100%, as a second, extended screen. Harry uses Edge.

## What was checked, and what couldn't be

| | |
|---|---|
| Repos | 9 cloned read-only, all at the commits in handover section 16. (The handover calls them "tree SHAs", but they're commit IDs; it's the same code.) |
| Ritual films | `true_seal`, `strained_binding`, `fractured_containment`, `wyvern_emergency` (78 MB), downloaded from the release. |
| Harry's Word handover | Matches `_reference/master-handover.md`, apart from the owner's notes, which only the text copy has. |
| Not tested in the sandbox | **Edge itself:** the sandbox has Chromium, the same engine, so Edge checks are on Harry's lists. **Video playback:** the test browser can't play MP4s, though Edge can. **The live Firebase link:** the sandbox's network rules block `*.firebaseio.com` and `mattjowen1991-hue.github.io`. **The older `v1.0-ritual` release:** its files couldn't be listed; the current code doesn't use it. **DM-session-hub** (question B24). **Firefox:** not required. |

---

## A. Firebase and the Knightly Treasures link

**What Firebase is.** Google's online database service. Think of a shared spreadsheet on the internet that websites can write to and read from.

**What the old Notice Board did** (`_legacy/scarlett-isles-quest-generator/app.js:8-94`):
- **When:** as the Notice Board opened (if any quests were accepted), whenever a quest was accepted or removed, and whenever the gold ★ was turned on or off.
- **Where:** it wrote to `activeQuests` in the Firebase database `scarlett-isles-companion`.
- **What:** `{ primaryQuest: {id, title, quest_type, tags, province, settlement, difficulty} or null, updatedAt: <time> }`. The main quest is the ★ quest if it's still accepted, otherwise the first accepted quest, otherwise nothing.
- **Who reads it:** nothing in the Notice Board reads it back. The only reader is the **Knightly Treasures** shop (`https://mattjowen1991-hue.github.io/scarlett-isles-companion/`), which shows it as the active quest and switches its weekly stock to items matching the quest's tags and type. The shop's code (commit `75a40a1`, 11 Feb 2026) was still its latest in September 2026.
- **Who wrote it:** Matt Owen added the Firebase code and the whole ★ feature on 11 Feb 2026. The database belongs to his shop, which is why Harry never set up Firebase.
- **Offline:** it quietly skipped.

**How the suite does it (Harry's answer 11, Option A):**
- **Behaviour kept:**
  - The same message, at the same moments, to the same place, with the same fallback rule.
  - Offline, it skips without any error, and the Notice Board works fully.
  - The next time the Notice Board opens online, it sends the current main quest again, so the shop catches up, as before.
- **Library stored with the suite:** Firebase 9.22.0 (the version the old tool used, Apache 2.0 licence), in its "compat" plain-script form, lives in `tools/quests/lib/firebase/`. It loads only while the Notice Board is open.
- **Settings in one file:** Matt's database settings are a public identifier, not a password, and they're already public in the old repo. They live only in `tools/quests/shop-link.js`; CLAUDE.md allows this one exception.
- **Leaving right after a ★:** switching tools reloads the page, so the Notice Board's `stop()` waits up to about 2 seconds for a pending message to go out.
- **One tidy-up:** removing the ★ quest used to send the same message twice; the suite sends it once (KNOWN_ISSUES `QST-13`).
- **Links to the shop:** "Knightly Treasures shop ↗" in the home-screen footer, and "Open shop ↗" in the Notice Board's Accepted Quests panel. Both open in a new tab and need internet.
- **If Matt changes his database or its rules,** the ★ → shop link stops quietly. Nothing else is affected.

**Testing:**
- **Automated:** a stand-in database records what's sent, and when, against the old tool: on opening, on accept, on remove, with ★ on and off, when the ★ quest is removed, and offline.
- **Never write to the live database while testing.** Any write changes what Matt's shop shows.
- **Live link:** Harry checks it in Edge (phase 4 list). If the sandbox is allowed to reach `*.firebaseio.com` (environment settings → Network access), a read-only connection check can also be run from here.

---

## B. Where the handover and CLAUDE.md clash (CLAUDE.md wins)

| The handover says | What happens instead |
|---|---|
| Export and migrate the Firebase data, check the database rules, add a sync layer (sections 1, 5, 13, 14, 17) | Only the one-way ★ message is kept, exactly as before. No export, migration, rules changes or sync layer. |
| Host on GitHub Pages with deep links and deployment settings (sections 1, 14, 15, 16) | Runs by double-clicking `index.html`. No hosting. |
| Copy the service worker and web manifest; version the offline caches (sections 4, 15) | Both deleted. A local folder doesn't need them, and CLAUDE.md bans service workers. |
| The tracker and battlemap talk through shared browser storage (section 4) | `postMessage` between the windows. |
| TypeScript build and an apps/modules/packages layout (section 13) | Plain JavaScript with no build step, in the layout in section 2. |
| Migrate old saves before building (sections 1, 14) | **Dropped completely.** Harry doesn't need old saves (answer 9). |
| New joined-up features: a shared day counter, an Explorer→Bastion link, an audit log, Ritual/Arena save points, saved crest designs, reward transfers (sections 12–15) | Not built. These are proposals for after the rebuild. |
| Keep external reference links (section 7), against CLAUDE.md's "no remote links" | Clickable links (Roll20, stat blocks, the shop) are fine. They only work online, and nothing loads them automatically. |
| User and maintenance guides (sections 1, 15) | A short how-to guide for Harry, `guide.html`, built after the rebuild. Notes for future sessions build up in `docs/`. |

**CLAUDE.md vs the code:** the Ritual's cinematics play inside the Ritual page, not in a player window. The old `cinematics/player.html` is an unused leftover. CLAUDE.md now says so.

---

## 1. Inventory, tool by tool

- **Save names:** the old key → the new `tsi.` name.
- **Unused art:** files the old tools never used come across into the tool's `assets/extras/` (answer 10).
- **Sizes:** decimal MB.

### Combat Tracker & VTT Battlemap (`scarlettisles-encounter-tracker`)
- **Entry files:**
  - `index.html` + `app.js`: the DM desk.
  - `vtt.html` + `vtt.js`: the battlemap window.
  - `styles.css`, `vtt.css`.
  - `sw.js` and `manifest.webmanifest` are dropped.
- **Data:** none; the DM types everything in. Built-in settings: tokens 56 px, grid 70 px at 35%, fog radius 6 squares, 12,000 explored squares max, maps up to "4 MB".
- **Media:**
  - `logo.png`, the wide crest (3 MB), used as the header logo and a faint watermark. The suite keeps it as the watermark.
  - An unused rune-stone picture ("ChatGPT Image Dec 29, 2025…", 2 MB) → `extras/`.
  - No sound or video.
- **Saves:**
  - `encounterTracker.v1` → `tsi.encounter.tracker`
  - `encounterTracker.vtt.state` → `tsi.encounter.battlemap`
  - `encounterTracker.vtt.mapImage` → `tsi.encounter.mapImage`
- **Online:**
  - Google Fonts (Cinzel, Cinzel Decorative).
  - PDF.js from a CDN, replaced by a local copy of PDF.js 3.11.174 (tested: works offline from file://).
  - "Install as app" and the service worker are removed.
  - Portrait and stat-block links the DM types in stay as links.
- **Won't work double-clicked:** PDF import; fonts; maps over about 3.9 MB, which fail silently.
- **Player window:** the battlemap is both the DM's map controls and the players' view. It switches from shared storage to `postMessage`.
- **Main flows:**
  - **Library:** add, edit (Shift+click) and delete combatants.
  - **Encounter:** add selected combatants; repeats become "Goblin a", "Goblin b" with their own HP.
  - **Fight:** auto-roll initiative, then Begin. Pick a target, enter damage or healing plus a condition, then Complete Turn. The fight ends automatically when every monster is down.
  - **Templates:** save, load, duplicate and delete encounters.
  - **Import/export:** export and import the library (Campaign JSON), and import a creature from a PDF.
  - **Battlemap:** upload a map, zoom and pan, drag tokens, grid/nudge/snap, ruler, fog, hide monsters, fullscreen.
- **Where the handover is out of date:**
  - NPCs never take turns and always sort to the bottom.
  - There's no manual initiative entry.
  - The line-of-sight cones and "Monsters above fog" don't work.
  - Hidden monsters are hidden from the DM too.
  - Reset doesn't clear the map.

### Notice Board Quest Generator (`scarlett-isles-quest-generator`)
- **Entry files:** `index.html`, `app.js`, `styles.css`, `data/quests.json`. The old pop-out board is built on the fly.
- **Data:**
  - 180 quests with IDs 1–180, every field present: 85 bounties, 8 provinces, 10 types, 12 factions and 47 settlements; 67 are honour-gated.
  - Outline word lists inside the code: 36 enemy groups, 27 checks, 4 encounter types, 4 twists, 4 complications, 3 resolutions.
- **Media:** `assets/ui/noticeboard.png` (2.8 MB).
- **Saves:**
  - `si_noticeboard_accepted_v1` → `tsi.quests.accepted`
  - `si_noticeboard_outlines_v1` → `tsi.quests.outlines`
  - `si_primary_quest_id` → `tsi.quests.primaryId`
- **Online:** Google Fonts (Cinzel, Inter); Firebase, **kept only for the ★ → shop link** (section A).
- **Won't work double-clicked:** no quests load at all.
- **Player window:** the pop-out board. The old one goes stale after Clear, blanks when refreshed, and has dead buttons. It's rebuilt with `postMessage`.
- **Main flows:**
  - Set the filters: province, party level 7–16, clan and temple honour −3 to +3, faction, type.
  - Generate 1–6 notices, then Accept or Decline.
  - Read the outline of an accepted quest.
  - ★ the main quest, or remove a quest.
  - Pop out the board for players.
- **Where the handover is out of date:**
  - At levels 7–10 every board has **exactly** one bounty.
  - Five bounties show outside their level band.
  - The Rescue quest has no enemy list.
  - The bounty details aren't shown on the poster.

### Scarlett Isles Explorer (`scarlett-isles-explorer`)
- **Entry files:** `index.html`, `app.js` (2,916 lines), `styles.css`.
- **Data:**
  - `events.json`: 7 regions, 279 travel events and 322 campfire events (601 in all), with 1,071 steps and 2,123 choices.
  - `markers.json`: 33 markers on 10 maps. Only 15 show; 18 have no picture, and none has a description.
  - Inside the code: 10 maps, 17 map-to-map entry points, 2 main events (11 pictures), 4 weather events, and 5 heroes (Kaelen, Umbrys, Magnus, Elara, Charles).
  - An unused `events_BACKUP.json` differs only by an extra "Fresh Tracks (Late)" event (question E6).
- **Media:** about 102 MB of images (10 province maps, 15 settlement maps, 11 main-event pictures) and 25 MB of weather video.
- **Saves:** `scarlettIsles.explorer.v1` → `tsi.explorer.save`, with the uploaded map stored separately.
- **Online:** Google Fonts (Cinzel, IM Fell English SC, Cormorant Garamond).
- **Won't work double-clicked:**
  - Events and markers don't load.
  - Every map, picture and video points at the wrong folder.
  - Fonts are missing.
  - A big upload fills the storage.
- **Player view:** the same window, in fullscreen with Hide UI (the H key).
- **Main flows:**
  - Load a map and line up the hex grid.
  - **Travel:** drag heroes. Each hex costs 6 miles; each hero has 30 miles a day; one travel event per day at a random 6–24 mile mark.
  - Group heroes; Free Move.
  - **Make Camp:** the campfire event, then the next day, then weather (45% once 3 days have passed), then the Bastion prompt on days 8, 15, 22…
  - Main events.
  - Fog of war, with pins that open settlement pictures.
  - Upload your own map; export and import.
- **Where the handover is out of date:**
  - Queue plays a main event straight away.
  - 146 events have a second scene that nothing leads to.
  - Heroes' miles reset on reload.
  - Weather can first happen on day 2.
  - Each region's deity is stored but never shown.

### The Ironbow Bastion Manager (`bastion_manager`)
- **Entry files:** `index.html`, `app.js` (5,732 lines), `styles.css`. `build_compendium.py` is a developer-only script.
- **Data:**
  - `facilities.json`: 18 facilities, 28 functions, 158 options.
  - `tools_tables.json`: 12 tables, 202 rows; only the 9 "Tools/Supplies" tables can be chosen as artisan tools.
  - `events.json`: 11 d100 rows plus descriptions.
  - `compendium_items.json`: 265 items (62 complete, 203 name only).
  - 55 compendium cards, 36 of which show.
  - Rewards, durations, DCs and the war and diplomacy numbers are written into `app.js`.
- **Media:** 131 PNGs (135 MB) and 8 SVGs. The code reaches 80 PNGs (73 MB); everything else goes to `extras/`, with duplicates stored once. `wax_seal.mp3` is referenced but has never existed.
- **Saves:**
  - `ironbow_bastion_state_v1_TEST` → `tsi.bastion.state`
  - the four `si_collapse_*` keys → `tsi.bastion.ui`
- **Online:**
  - Google Fonts (Cinzel, Uncial Antiqua).
  - The free `dnd5eapi.co`, only for the "Export Compendium JSON" authoring button. Its online lookup is dropped (question B15).
  - Roll20 links.
- **Won't work double-clicked:** it doesn't start at all, and every picture points at the wrong folder.
- **Player view:** none.
- **Main flows:**
  - Party level, treasury and defenders.
  - Build in slots: 0/2/4/5/6 at levels below 5 / 5 / 9 / 13 / 17. Builds take 3, 4 or 5 turns.
  - Issue orders.
  - Advance Bastion Turn, in a fixed 9-step order.
  - Bastion events (an automatic d100 every 4th turn).
  - Hall of Emissaries: Trade Agreement, Host Delegation, Inter-Clan Summit, Writ of Authority, Trade Consortium, upgrades.
  - The trade network and the Sea Trade Routes map.
  - The Council Ledger.
  - Party identity: Clan or Mercenary.
  - The War Council.
  - Warehouse, artisan tools and Workshop craft.
  - Favour of The Gods and Political Capital.
  - Compendium.
  - Download or import a save; reset.
- **Where the handover is out of date:**
  - Identity, war and diplomacy don't reload.
  - Hall upgrades are free.
  - Low- and medium-risk trade routes never roll.
  - The Menagerie and the five starting buildings have no overlay art.
  - The page is 1,754 px wide.

### Clan Crest Creator (`clan-crest-creator`)
- **Entry files:** `index.html`, `app.js`, `styles.css`.
- **Data:** inside the code:
  - 6 shields, 5 borders, 8 patterns, 4 textures, 12 palettes.
  - 16 sigils, 3 icon styles, 4 banners.
  - Name lists of 15, 15 and 10, with a place added 55% of the time.
  - 6 mottos.
- **Media:** the shared `hero.png` and the wide crest `logo.png`.
- **Saves:** none.
- **Online:** none. It already works double-clicked; the 2048 × 2048 transparent PNG export was tested.
- **Main flows:**
  - Name the clan or pick a random name.
  - Choose the parts.
  - Random Crest or Reset.
  - Download PNG.
- **Where the handover is out of date:** the clan name only sets the file name; random names have no space; the PNG's motto uses a different font from the preview.

### Arenas of The Scarlett Isles (`arenas-of-the-scarlett-isles`)
- **Entry files:** `index.html`, `app.js`, `styles.css`, `data/arenas.json`.
- **Data:**
  - 2 arenas and 6 rounds (Swyth r1, r4, r5; Middlemount mm_r1–mm_r3). **Every number matches the handover table exactly.**
  - 32 skill approaches and 14 enemies.
  - The overlay and sound maps are inside the code.
- **Media:**
  - 52 PNGs (92 MB): 4 arena maps and 46 enemy overlays.
  - 19 MP3s.
  - Unused `tokens/ring.png` and `lions_totems_destroyed.mp3` → `extras/`.
- **Saves:** `tsi_arenas_state_v3_pov` (party with 96 px portraits, gold, arena and round) → `tsi.arenas.state`.
- **Online:** Google Fonts, for the Lion's Mark lettering only.
- **Won't work double-clicked:** it doesn't start.
- **Player view:** none; one screen.
- **Main flows:**
  - Add players; choose the arena and round.
  - Enter The Arena, then read the rules.
  - Play Turn: skill roll, optional attack roll and damage, then Resolve.
  - The round ends in a win (prize), a defeat, or with every enemy down, when the DM ends it.
  - Move on to the next round.
- **Where the handover is out of date:**
  - Turns rotate automatically.
  - The Beast-Pen +2 is once per player per round.
  - The last-totem rule only works through the Apply button.
  - The Lion's Mark changes once per rotation.
  - No part of a round is saved.

### The Heartwood Ritual (`tellurian-ritual-engine`)
- **Entry files:** `index.html`, `ritual.js`, `styles.css`. `cinematics/player.html` is an unused leftover and isn't ported.
- **Data:** inside the code:
  - 3 threats: Rootbound Husk 35 HP, Rootbound Buckbear 55, Rootbound Wyvern 120.
  - 6 events.
  - Memory targets by round, plus the banner and toast text.
- **Media:**
  - 11 PNGs and 6 MP3s.
  - Videos:
    - `root_loop.mp4` (the background).
    - The four films. `fractured_containment.mp4` is identical to the repo's `ritual_collapse.mp4` and `wyvern_emergency.mp4` to the repo's copy, so each is stored once.
    - `wyvern_emergency_optimized.mp4` → `extras/`.
  - About 116 MB in use.
- **Saves:** none.
- **Online:** Google Fonts (Cinzel, IM Fell English); all four films stream from GitHub.
- **Won't work double-clicked:** the crack pictures (wrong folder), the films, and the fonts.
- **Player view:** one screen, with full-screen banners and films shown inside the page.
- **Main flows:**
  - Enable Sound.
  - Roll or cycle an event, then Apply it.
  - Attempt or Assist on Weight, Memory and Silence (typing in the table rolls).
  - Threats: Strike (15) and Heavy Blow (30).
  - Next Round, up to round 8.
  - Endings: True Seal, Strained Binding or Fractured Containment, each with its film.
  - DM Dock overrides and Reset.
- **Where the handover is out of date:**
  - Sound can't be turned off.
  - The log panel was removed.
  - A live Wyvern is ignored at round 8.
  - Hidden keys exist (`` ` ``, N, E, and a leftover P that plays the True Seal film).

### Pelagosi Puzzle Trials (`pelagosi_marker_rune_puzzle`)
- **Entry files:** `index.html`, `app.js`, `styles.css`.
- **Data:** inside the code.
  - **The Marker Remembers:** 5 runes; rounds of 3, 4 and 5 runes at 950/260, 700/220 and 520/180 ms; 4 clue texts.
  - **The Tidal Sequence:** 6 runes, 4 directions, the solution (Flow →, Echo ↓, Depth ←, Stone ↑), the start layout and the basin answer (Current).
  - 5 pressure levels.
  - 4 unused wrong-answer messages.
- **Media:**
  - 12 PNGs (28 MB) and 5 WAVs.
  - `rune_ancient.png` and `socket-triangle.svg` → `extras/`.
  - Five more sounds are named in the code but never supplied.
- **Saves:** none.
- **Won't work double-clicked:** only the fonts.
- **Player view:** none.
- **Main flows:**
  - **Memory:** watch, repeat, 3 rounds, then the ending. A wrong rune causes a surge and a restart.
  - **Tidal:** turn the runes and arrows, then Check. Pressure and hints rise with each wrong answer; at 4, a surge resets the puzzle. Then the basin, then the ending.
- **Where the handover is out of date:** the keystone is restored in text only; timers are never cancelled, which causes most of the tool's bugs.

**Total folder:**
- 279 distinct media files, about 478 MB. Byte-for-byte duplicates (72 MB) are stored once.
- Plus fonts (3.7 MB), PDF.js (1.5 MB), the Firebase library (about 0.4 MB) and code and data (about 3 MB).
- **About 490 MB in all.** The largest single file is 30 MB.

---

## 2. Suite structure

### Folder layout
*(Updated after phase 1 to match what was built.)*
```
index.html            ← the only file Harry double-clicks
player.html           ← the page every player window uses (battlemap, notice board)
shared/
  tokens.css          ← colours, fonts, sizes, spacing, defined once
  components.css      ← buttons, cards, pills, panels, pop-ups, top bar, notices, form fields
  shell.css           ← the home screen and the frame tools sit in
  player.css          ← the player-window page
  fonts/              ← unmodified font files (SIL OFL)
  art/                ← hub logo, hero.png, the tools' wide crest logo (each stored once)
  data/tools.js       ← the eight tools, their groups, phases and files; the shop link
  js/                 ← core, lifecycle, modal, store-rules, store, backup-rules, backup,
                        player-link, player-page, tabguard, dmdoc-rules, dmdoc, shell
  lib/pdfjs/          ← PDF.js 3.11.174 (Combat Tracker only, phase 7)
tools/<tool>/
  tool.js             ← TSI.registerTool('<tool>', { start, stop }); its own code under window.TSI.<tool>
  rules.js            ← game rules as plain, testable functions
  view*.js            ← screen code
  <tool>.css          ← every class prefixed and scoped to the tool
  data/*.js           ← content, e.g. window.TSI_DATA.quests = …
  assets/             ← the tool's art, sounds, videos
  assets/extras/      ← art the old tool never used (kept for later versions)
tools/quests/shop-link.js   ← Matt's Firebase settings: the only copy (section A)
tools/quests/lib/firebase/  ← Firebase 9.22.0 compat library
tests/rules.html      ← double-click to run every rules test (tests in tests/rules/)
tests/harness.html    ← index.html plus a pretend Demo tool, for testing the shell
tests/fixtures/       ← the Demo tool
tests/e2e/            ← Playwright click-throughs for future sessions
licences/             ← font licences, PDF.js and Firebase (Apache 2.0), artwork notes
docs/                 ← PLAN, PROGRESS, KNOWN_ISSUES, ASSETS, BUILDING-A-TOOL
```
Every page Harry uses sits in the top folder and the fonts sit below it. The test pages in `tests/` are the exception; in Firefox they'd show fallback fonts, which doesn't matter for tests.

### Opening and closing tools
- **One tool per page load.** Opening a tool loads `index.html?tool=bastion`, which brings in only that tool's styles, data and code. Home and "Switch tool" reload the page the same way. A page load is the only thing *guaranteed* to stop every timer, sound, video and listener, which the old tools didn't manage (KNOWN_ISSUES `SUI-03`).
- **Each tool also has a proper `stop()`.** It saves, closes the tool's player windows, and waits briefly for a pending shop message. A shared lifecycle helper tracks timers and sounds, so resets inside a tool are clean too.
- **Keyboard shortcuts** only work in their own tool, and never while typing.
- **Errors** show a plain-English bar, not a silent failure.
- **Fullscreen:** Edge's own full-screen mode (F11) stays on across tool switches. A tool's Fullscreen button needs pressing again after a switch.
- **Leaving a tool that doesn't save** (the Ritual, Pelagosi, or an Arenas round in progress) asks first: "Leave? This will end the … in progress."

### Home screen
- **Title:** "The Scarlett Isles: D&D Tool Suite", with the old hub's logo. It sits over the painted `hero.png` and a dark vignette, with the tagline **"One doorway. Many wonders. Choose your tool."** The old "Campaign Toolkit" line is dropped because the name already says it.
- **Glass cards** with thin gold borders, grouped by pill tags:
  - **DM Tool:** Combat Tracker & VTT Battlemap · Notice Board Quest Generator · The Ironbow Bastion Manager
  - **World:** Scarlett Isles Explorer
  - **Players:** Clan Crest Creator
  - **Set Pieces:** Arenas of The Scarlett Isles · The Heartwood Ritual · Pelagosi Puzzle Trials
- **Unbuilt tools** show "Coming in phase N" and can't be opened.
- **Footer:** Back up everything · Restore · "Knightly Treasures shop ↗" (needs internet).
- **Top bar, the same in every tool:** crest (Home) · tool name · Switch tool · the tool's Export/Import (if it saves) · "Saved ✓" · DM doc (a floating, draggable panel for the DM's own notes; its place and size are saved as `tsi.dmdoc.layout`, so they're in Back up everything). Inside a tool, Switch tool's ↗ buttons open another tool in a new window (`TSI.shell.openWindow`).

### Screens
- **Laptop:** 2560 × 1600 at 150%, which gives about **1707 × 930** of page space in a maximised Edge window (1707 × 1067 in F11). Every tool fits with no sideways scrolling and its main controls in view.
- **TV:** 1920 × 1080 at 100%, an extended second screen. The **Explorer, Combat Tracker/Battlemap and Bastion** must also work there:
  - Layouts adapt when a window is dragged between screens.
  - Grids, fog and rulers redraw sharply when the pixel density changes (1.5 → 1).
  - Tokens, pins, fog and grid are tied to the **map picture**, not the window. The laptop is 16:10 and the TV 16:9.
- **Player windows** (battlemap, notice board) can go on the TV.
- **Test sizes:** every phase is tested at 1707 × 930 (pixel ratio 1.5) and 1920 × 1080 (pixel ratio 1).

### Player windows
- **Which:** the Combat Tracker's battlemap (which also holds the DM's map controls) and the Notice Board's pop-out board. Everything else stays single-screen, as before.
- **How they connect:**
  1. The tool opens `player.html?view=…` in a named window.
  2. The window says "ready".
  3. The tool sends the full picture, then an update after every change, including an empty board.
  4. On the battlemap, map changes go back to the main window, which does all the saving.
- **Checking messages:** pages opened from files have the origin "null", so messages are checked by `event.source` (the window they came from) and a `tsi` tag.
- **Tested from double-clicked files:** messages both ways, recovery after refreshing either window, and reconnecting after the main page reloads.
- **When the tool closes,** its player windows close too.

### Saving and backups
- **Where:** the browser's built-in database (IndexedDB), whose name and keys all start with `tsi.`, not the small shared storage the old tools used. That holds only about 5 million characters for every file on the laptop.
- **When:** each tool's saves load before it opens, and every change is written straight away (autosave).
- **When something goes wrong:**
  - A failed save shows a clear warning.
  - A damaged save is kept aside, not deleted.
  - A second tab shows a "suite already open" warning.
- **Per-tool Export/Import:** the Combat Tracker, Notice Board, Explorer, Bastion and Arenas. Files include uploaded maps and portraits.
  - Import checks the file and refuses another tool's file.
  - It shows what's inside, asks before replacing, and offers to download the current data first.
  - The tools' own buttons stay too, such as the Tracker's library-only Campaign JSON.
- **Whole suite:** "Back up everything" makes one dated file. "Restore" lists what's inside, asks, and replaces only the tools in the file.
- **Ritual and Pelagosi** save nothing, as before, so they have no backup buttons. (The Crest saved nothing at first too; since 1 October 2026 it remembers your last design, at Harry's request, with Export, Import and backups like the other tools.)
- **No import of old saves** (answer 9). The save formats are designed fresh, for example positions stored relative to the map picture.

### Assets
- **What comes across:** every image, sound and video from the old repos, into its tool's `assets/`. Anything the old tool never used goes in `assets/extras/`.
- **Duplicates:** byte-for-byte duplicates are stored once.
- **The list:** `docs/ASSETS.md` records every file: its old path, its new path, whether it's used, and its duplicates. Each tool's phase adds its own entries.

### Testing
- **Rules:** tested as plain functions in `tests/rules.html`, which Harry can double-click too.
- **Click-throughs:** Playwright opening `index.html` as a file, at both screen sizes.
- **Harry's Edge checklist:** everything the sandbox can't test (films, sound, the TV, the live shop link).

---

## 3. Design system

**Tokens, taken from the Bastion's and old hub's CSS:**

| Token | Value | From |
|---|---|---|
| Page background | `#050506` → `#0a0708`, with faint crimson and gold radial glows | Bastion |
| Burgundy panels | `#2a0f14`, `#1b0a0d`, `#3a1219`; panel fill `rgba(58,18,25,.92)→rgba(27,10,13,.92)` | Bastion |
| Text / muted | `#f5f1e8` / `#d2c7b8` | Bastion |
| Crimson | `#b1122a` / `#7a0c1b`; main-button gradient `135deg rgba(177,18,42,.98)→rgba(122,12,27,.88)` | Bastion |
| Antique gold | `#d6b25e` / `#a67c2f`; gold borders at 25–85% strength | Bastion |
| Gods | Telluria `#37c85f` · Aurush `#eb3737` · Pelagos `#3c91ff` | Bastion |
| Home cards | glass `rgba(8,6,5,.58)→rgba(10,7,6,.72)`, line `rgba(255,206,150,.18)`, radius 18 px, soft fire glow, 3 px lift on hover | Hub |
| Pill tags | text `rgba(255,255,255,.78)` on `rgba(255,150,90,.14)` | Hub |
| Art overlay | `hero.png` under a radial vignette from 12% to 76% black | Hub |
| Top bar | black 78% with blur and a 2 px gold rule | Bastion |
| Pop-up | burgundy `.96` over a 72% black backdrop | Bastion |

**Fonts** (SIL Open Font Licence, bundled unmodified):
- **Cinzel:** headings, labels and buttons.
- **Cormorant Garamond:** all body text, in sentence case.
- **Signature fonts:** Uncial Antiqua (Bastion wordmark, Pelagosi headings), IM Fell English (Ritual body text), IM Fell English SC (Explorer buttons, the Lion's Mark lettering).
- **Replaced:** Inter (Notice Board), Cinzel Decorative (Tracker) and the plain system fonts (Arenas, Crest).

**Components, defined once:**
- **Card:** thin gold border and soft glow.
- **Pill tag.**
- **Outlined gold button.**
- **Main button:** **one** filled crimson main action per panel.
- **Burgundy panel.**
- **Pop-up:** keyboard focus moves into it, and it can't be clicked through by accident.
- **Top bar.**
- **Form fields:** gold-bordered.
- **Focus ring:** **gold** everywhere.

**Rules:**
- **Body text:** sentence case. Capitals only for headings, labels and buttons.
- **No crimson text:** it fails contrast.
- **Reduce motion:** shared animations stop; signature animations **slow down** (heartbeat pulse, trade-route glow, Lion's Mark pulse, Pelagosi flashes).

**Each tool keeps its signature look inside its own stage.** Only the top bar, buttons, panels and pop-ups are shared.
- **Ritual:** the green Heartwood stage, stones, Final Seal and films.
- **Pelagosi:** the sea-blue chamber, runes, flashes and sounds.
- **Arenas:** the 16:9 POV scene with its exact overlay mapping per enemy, the crowd, and the Lion's Mark.
- **Bastion:** the map with facility overlays, the carousel, the Hall paintings and the glowing trade routes.
- **Explorer:** the painted maps, hex grid, crimson hero tokens, fog, weather videos and main-event art.
- **Notice Board:** the wooden board, tilted parchments and brass nails.
- **Combat Tracker:** the three-panel desk, gold turn pulse, fog and ruler, and the faint crest watermark.
- **Crest:** the SVG heraldry, drawn identically.

---

## 4. Build order

One phase per session, or one clearly defined chunk. The next phase starts only with Harry's go-ahead. Every session ends with:
- `docs/PROGRESS.md`, `docs/KNOWN_ISSUES.md` and `docs/ASSETS.md` updated
- a pull request
- Harry's Edge checklist

| Phase | Work | What it proves |
|---|---|---|
| 1 | **Shell:** home screen, top bar, tokens and components, fonts, saving/backups, player-window messaging, test page, shared art, shop link in the footer | – |
| 2 | Clan Crest Creator | opening and closing a tool; scoped styles |
| 3 | Pelagosi Puzzle Trials | timers and sounds stop cleanly |
| 4 | Notice Board Quest Generator | data files, saving, backup, first player window, the ★ → shop link |
| 5 | The Heartwood Ritual | video and audio; rolls happening at the right moment |
| 6 | Arenas of The Scarlett Isles | large media and portraits |
| 7a / 7b | Combat Tracker desk / Battlemap (laptop + TV) | two-way player window, PDF reader, large maps |
| 8a / 8b | Explorer maps and movement (laptop + TV) / events, camp and weather | large data files and video |
| 9a / 9b / 9c | Bastion core (laptop + TV) / Hall, trade and Council / identity, war and Compendium | the largest tool |
| After 9 | A short how-to guide for Harry (`guide.html`), with his go-ahead: done | the guide matches the tools (a test checks every name it gives) |
| First upgrade | **Clan Crest Creator rework** (Harry's request, 29 September 2026): 17 real shield shapes, 20 new sigils (then redone from traced public-domain heraldic art), 63 named colours and 20 schemes, divisions, bands, rims, finishes and new tabbed controls. Done | every sigil fits every shield; every tab fits the laptop and the TV |

**Phases 4, 5 and 6 were built together** (26 September 2026), at Harry's request to speed the build up: one session, one pull request and one combined checklist, grouped by tool. Each tool still has its own commits, tests and docs. For the last three tools Harry chose (28 September 2026) **one tool per go, each in a single session**: the Combat Tracker (7a and 7b together), then the Explorer (8a and 8b), then the Bastion (9a to 9c), each with its own pull request. Phases 7, 8 and 9 are done, which completes the rebuild.

### "Done when" lists (Harry checks these in Edge)

**Phase 1: Shell**
- [ ] With Wi-Fi off, double-clicking `index.html` shows **"The Scarlett Isles: D&D Tool Suite"** with the hub's logo, the painted art and "One doorway. Many wonders. Choose your tool."
- [ ] Headings are in the engraved-capitals font and body text in the elegant serif, with Wi-Fi still off.
- [ ] All eight tools appear under DM Tool, World, Players and Set Pieces. Each says which phase it's coming in, and can't be opened yet.
- [ ] "Switch tool" in the top bar lists all eight.
- [ ] "Back up everything" downloads a dated `.json` file.
- [ ] "Restore" with that file shows what's in it and asks first; Cancel changes nothing.
- [ ] "Restore" with any other file (e.g. a photo) says it isn't a backup and changes nothing.
- [ ] A second tab shows a "suite already open" warning.
- [ ] The home screen fits the laptop, in a normal window and in F11, and the TV when dragged there, with no sideways scroll.
- [ ] With Wi-Fi on, "Knightly Treasures shop ↗" in the footer opens the shop in a new tab.
- [ ] `tests/rules.html` shows every check passing.
- [ ] With Windows "Animation effects" off, the hover effects stop moving.

**Phase 2: Clan Crest Creator**
- [ ] The card opens the Crest Creator, and Home brings you back.
- [ ] It starts on "Blackstone Wardens": heater shield, double border, Scarlet & Gold quarterly with grain, two-tone stag, no banner.
- [ ] Every control works: 6 shapes, 5 borders, 8 patterns, 12 palettes, 4 textures, 16 sigils, 3 icon styles, 4 banners, and both sliders.
- [ ] A motto shows on the banner in capitals.
- [ ] Random Name, Random Crest and Reset work.
- [ ] Download PNG saves `<clan name>.png` at 2048 × 2048 with a see-through background. The same settings give the same crest as the old tool.
- [ ] It works with Wi-Fi off. `docs/ASSETS.md` lists the shared art.

**Phase 3: Pelagosi Puzzle Trials**
- [ ] **Memory:** three rounds of 3, 4 and 5 runes at the old speeds, with the buttons locked while the Marker flashes.
- [ ] **Memory:** a wrong rune causes a surge, shows the DC 12 Dexterity text, and restarts at round I.
- [ ] **Memory:** winning makes the Marker sink, plays the cavern sound and tremor, then opens "The Marker Sinks".
- [ ] **Tidal:** pressure rises Calm → Stirring → Rising → Reversing (DC 13 STR) → Surge (DC 14 DEX or 2d6), and a Surge resets the pillars.
- [ ] **Tidal:** Flow →, Echo ↓, Depth ←, Stone ↑ unlocks the basin, and Current attunes it ("The Chamber Opens").
- [ ] Reset, switching puzzle or going Home during any animation or ending: nothing pops up afterwards and no sound plays.
- [ ] A double click on Check Alignment counts once.
- [ ] The rune buttons and Check are in view on the laptop without scrolling.
- [ ] `rune_ancient.png` and `socket-triangle.svg` are in `assets/extras/`.

**Phase 4: Notice Board Quest Generator**
- [ ] With Wi-Fi off it says "Loaded 180".
- [ ] The filters change the Eligible count; Generate pins 1–6 notices; at levels 7–10 one of them is a BOUNTY poster.
- [ ] Accept files the quest under its province and shows its outline, which matches the old tool for the same quest.
- [ ] After ★-ing and removing quests, close and reopen the browser: the accepted quests, outlines and ★ are all still there.
- [ ] The players' window updates on Generate, Decline and Clear, and when the last notice goes; refreshing it brings the board back.
- [ ] Export, then Import (which asks first), restores the list and the ★. "Back up everything" includes the Notice Board.
- [ ] **Wi-Fi on:** ★ a quest, then open the shop. Its active quest is that quest, and the stock matches its tags.
- [ ] **Wi-Fi off:** ★ still works, with no error message.
- [ ] **Wi-Fi back on:** reopen the Notice Board and the shop catches up.
- [ ] "Open shop ↗" in the Accepted Quests panel opens the shop.

**Phase 5: The Heartwood Ritual**
- [ ] Enable Sound starts **one** heartbeat, however many times it's clicked.
- [ ] The stone rules are unchanged:
  - Weight: 12 + stress.
  - Memory targets: 6, 6, 7, 7, 7, 8, 8, 8.
  - Silence: max(8, 10 + stress − slot).
  - 3 progress locks a stone; 4 stress cracks it.
- [ ] A double click or double Enter on Next Round or Apply Event acts once.
- [ ] Threats appear only at the moment Harry chooses (R2), never from DM Dock buttons.
- [ ] With Wi-Fi off, in Edge, all four films play: Wyvern, True Seal (then the Final Seal overlay), Strained Binding and Fractured Containment.
- [ ] Reset Ritual clears the screen at once.
- [ ] The Silence buttons are in view on the laptop.
- [ ] Leaving mid-ritual asks first, then everything stops.

**Phase 6: Arenas of The Scarlett Isles**
- [ ] The party, portraits, HP, gold and chosen round survive closing the browser, and they're in backups.
- [ ] All six rounds show their own arena, overlays and sounds; the crowd starts on Enter The Arena.
- [ ] Apply deals a turn's damage **once**; the prize is paid **once** per round; after a win or defeat, Play Turn is off until the next round.
- [ ] Double clicks on Play Turn or Add count once.
- [ ] The Beast-Pen +2 is once per player; the totem pictures step 1, 2, 3 down; the Lion's Mark announcement, horn, HUD and damage work; overtime starts after the turn limit.
- [ ] Leaving mid-round asks first, and the crowd stops.

**Phase 7a: Combat Tracker desk**
- [ ] The library works: add, edit (Shift+click) and delete. Copies are named "Goblin a" and "Goblin b", each with its own HP.
- [ ] A full fight works: auto-roll, Begin, damage and healing, conditions with turns, Complete Turn, the round count and the automatic end.
- [ ] Bad input (e.g. Turns 0) changes nothing and the turn doesn't move.
- [ ] Double clicks count once.
- [ ] Healing from 0 HP follows Harry's answer to C2.
- [ ] Templates, Export/Import Campaign JSON and PDF import all work with Wi-Fi off.
- [ ] Everything survives reopening the browser.
- [ ] The desk fits the laptop, and the TV when dragged there.

**Phase 7b: Battlemap**
- [ ] The Battlemap button opens the map window, and every change in the tracker shows there at once.
- [ ] A 3.9 MB map uploads and is still there after reopening.
- [ ] Tokens stay on their squares after zooming, resizing, fullscreen, **and dragging the window from the laptop to the TV and back**.
- [ ] Grid, nudge and snap work; the ruler reads 25 ft for 3 × 4 squares; fog works; "Monsters above fog" works.
- [ ] Space never swallows spaces typed in the tracker.
- [ ] Refreshing the map window restores it.
- [ ] The map fills the TV in fullscreen at 1920 × 1080.

**Phase 8a: Explorer maps and movement**
- [ ] All ten maps load offline; the pins open their settlement pictures.
- [ ] A one-hex move charges each grouped hero 6 miles once; over 30 miles snaps back; Free Move is free.
- [ ] Moving to a linked map puts the party at the entry point, with Snap on too.
- [ ] **On the laptop and on the TV** (windowed and fullscreen), pins sit on their towns, one hex covers the same ground, and a one-hex move costs 6 miles. Harry checks all 33 pins once (E16).
- [ ] Fog, heroes' miles and an uploaded map survive reopening.
- [ ] H only works in the Explorer, and never while typing.

**Phase 8b: Explorer events, camp and weather**
- [ ] One travel event a day, at the 6–24 mile mark, with choices and outcomes.
- [ ] Make Camp shows the campfire event, then any weather, then the Bastion prompt (days 8, 15, 22…), **one after another, none lost**.
- [ ] Enter or Space after Make Camp doesn't camp again.
- [ ] The weather roll gives its result, and the looping weather video covers the map for the day, in Edge.
- [ ] The main events show all their pictures.
- [ ] Import asks first.

**Phase 9a: Bastion core**
- [ ] It opens offline with every picture and map overlay.
- [ ] Slots and build times are right at every level.
- [ ] Orders charge gold once, complete once, and land in the warehouse.
- [ ] Advance Turn can't run twice (double click, Enter or Space). A cancelled roll keeps the order pending, and closing mid-turn loses nothing.
- [ ] Lowering the party level keeps the buildings (per B8).
- [ ] Warehouse and artisan edits save themselves.
- [ ] Importing another tool's file is refused.
- [ ] It fits the laptop, and the TV when dragged there.
- [ ] The unused Bastion art is in `assets/extras/` and listed in `docs/ASSETS.md`.

**Phase 9b: Hall, trade and Council**
- [ ] Every Hall action goes through planning box, gold, d20 entry and result tier, and leaves a record with turns left.
- [ ] Routes pay once per turn, even after a cancelled roll or a press of Enter.
- [ ] The Sea Trade Routes map glows for each clan.
- [ ] Council Ledger rulings work.
- [ ] Everything survives reopening and import.

**Phase 9c: identity, war and Compendium**
- [ ] The Clan and Mercenary requirements are right on both sides of each limit.
- [ ] Identity survives reopening.
- [ ] War actions resolve the next turn at the right DCs; the war log's View works.
- [ ] The Compendium lists 265 items, and search works.

---

## 5. Bugs

`docs/KNOWN_ISSUES.md` holds every finding: 214 entries with stable IDs, evidence and a before/after.

**How they split:**

| Decision | How many |
|---|---|
| Must fix | 78 |
| Fixed by the new design | 27 |
| Deliberate change | 4 |
| Later, Harry's call | 101 |
| No longer relevant / not a bug | 4 |

**The rule** (CLAUDE.md): fix only what breaks a tool, loses saved data, applies something twice, or stops a tool working from a double-clicked file. Everything else is kept exactly as it was.

**Decisions that came from Harry's answers:**
- **Answer 4 (laptop + TV):** the Explorer's pins, grid, fog and tokens shifting with the window's size and shape became **must fix** (`EXP-10`). The 33 marker positions are converted once and Harry checks them (E16).
- **Answer 9 (no old saves):** problems that only affected old saves are no longer relevant.
- **Answer 11 (Option A):** the ★ → shop link is kept. The duplicate update on removing the ★ quest becomes a single update (`QST-13`).

---

## 6. Questions

### Answered by Harry (25 Sep 2026)

| # | Question | Answer |
|---|---|---|
| 1 | Suite name and logo | "The Scarlett Isles: D&D Tool Suite", with the hub's logo |
| 2 | Home-screen groups | DM Tool, World, Players, Set Pieces (as proposed) |
| 3 | Build order | Small to large (as proposed) |
| 4 | Screens | Laptop 2560 × 1600 at 150%. TV 1920 × 1080 at 100% as an extended screen; the Explorer, Combat Tracker/Battlemap and Bastion must work there |
| 5 | Fonts | Cinzel and Cormorant Garamond everywhere; IM Fell and Uncial Antiqua kept as signature fonts |
| 6 | Stage colours | Ritual green and Pelagosi sea-blue kept inside their stages |
| 7 | Leaving a tool | Player windows close; tools that don't save warn before leaving |
| 8 | Reduce motion | Signature animations slow down |
| 9 | Old saves | Edge only; no old saves needed, so the import phase is dropped |
| 10 | Art | Copy all of it, including unused files |
| 11 | Knightly Treasures | **Option A:** keep the ★ → shop link (online only, skips quietly offline) and add shop links |
| 12 | Web links | Clickable links that only work online are fine |
| 13 | Ritual films | Stay inside the Ritual page |
| 14 | Focus colour | Gold everywhere |

### Still to answer, before each tool's phase
Defaults are in brackets; "keep" means keep it as the old tool does it.

**Clan Crest Creator** *(answered by Harry, 25 September 2026; built in phase 2)*
- **K1** The Round shield's line and "handle": keep? **Keep as it is.**
- **K2** Random names: "StormOath", "Storm Oath" or "Stormoath"? **Keep as it is ("StormOath").**
- **K3** "Scarlet" with one t in the name lists: correct it? **Two t's where it means the Scarlett Isles, one where it's the colour.** So "of the Scarlett Isles" and the motto "In Scarlett We Stand" (Harry: the motto means the Isles). The "Scarlet" name word (the colour, like Black and Iron) and the "Scarlet & Gold" palette keep one t.
- **K4** Motto font in the PNG? **Agreed: the suite font (Cinzel), packed into the PNG so the preview matches.**

**Pelagosi Puzzle Trials** *(answered by Harry, 26 September 2026; built in phase 3)*
- **P1** Who clicks: Harry or the players? On a TV? **Harry clicks, on the laptop.** So it's laid out for the laptop first; it fits the TV too.
- **P2** Does Harry have the five missing sounds? **Yes, Harry will provide them.** Each has a ready-made slot and stays silent until its file is added (see `tools/pelagosi/assets/audio/ADD-THE-FIVE-SOUNDS-HERE.txt`).
- **P3** Should a double-clicked rune count once? **Keep it as it is:** it still counts twice.
- **P4** Pressure carrying into the basin, and Reset behaving differently in each mode? **Keep both as they are** (KNOWN_ISSUES PEL-18).

**Notice Board Quest Generator** *(answered by Harry, 26 September 2026: all the defaults; built in phase 4)*
- **N1** Exactly one bounty at levels 7–10? **Keep.**
- **N2** Bounties shown outside their level band (e.g. quest 77)? **Keep.**
- **N3** One Clan Honour and one Temple Honour value for all? **Keep.**
- **N4** Should the players' screen show only the notices, with no buttons? **Yes.**
- **N5** Root and Veinwood text in outlines and in 6 bounties: keep word for word until Harry sends replacements? **Keep.**

**The Heartwood Ritual** *(answered by Harry, 26 September 2026: R2 as below, the defaults for the rest; built in phase 5)*
- **R1** Home-screen name: "The Heartwood Ritual" or "The Lullaby of the Rootbound Heart"? **The Heartwood Ritual.**
- **R2** When should the Husk's 50% roll, and the Buckbear and Wyvern checks, happen: once per round advance, or once per player action? **Once per round: when Next Round is pressed.**
- **R3** One Heartwood event per round? **Allow repeats; block only accidental double presses.**
- **R4** Should failed attempts, Husks and Buckbears still crack locked stones? **Keep.**
- **R5** A live Wyvern is ignored at round 8: intended? **Keep.**
- **R6** Silence Assist slot vs a typed slot: which wins? **The Assist, as now.**
- **R7** Keep the `` ` ``, N and E keys? Remove the leftover P? **Keep the three; remove P.**
- **R8** Sound: an on/off switch, or enable only? **Enable only.**
- **R9** Strained Binding shows "Ritual collapse / Racing": change the wording? **Keep.**
- **R10** Bring back the log panel? **No.**

**Arenas of The Scarlett Isles** *(answered by Harry, 26 September 2026: all the defaults; built in phase 6)*
- **A1** Should the third totem breaking end the round as a win, and should 8 successes still win without breaking any? **Keep.**
- **A2** All opponents down: an automatic win? And when a win and a loss land on the same turn, which counts? **Keep.**
- **A3** Lion's Mark once per rotation; can the active player be marked; do players already at 0 HP count towards "two down"? **Keep.**
- **A4** DM picks who acts, or automatic rotation? **Rotation.**
- **A5** Apply damage once per turn, or once per attack roll? **Once per turn.**
- **A6** Lock a skill roll once rolled? **Unlocked.**
- **A7** Accept "2d8+3"? **Keep** (it still reads as 2).
- **A8** Middlemount defeat wording? **Keep.**
- **A9** Overtime hits a random player, even in the Lion's Mark round? **Keep.**

**Combat Tracker & VTT Battlemap** *(answered by Harry, 28 September 2026: C6 as below, the defaults for the rest)*
- **C1** NPCs never take turns? **Keep.**
- **C2** Healing from 0 HP: clear DEFEATED? Do PCs at 0 get turns? **Clear it when healed above 0; PCs at 0 still skipped.**
- **C3** Pause then Begin: carry on the round, or restart at round 1? **Keep; fix the wording.**
- **C4** Adding combatants mid-fight resets to round 1? **Keep.**
- **C5** Initiative by auto-roll only? **Keep.**
- **C6** Line-of-sight cones: fix them, or leave them out? **Leave it out** (the button never worked; it could come back later as an upgrade).
- **C7** A way to bring removed tokens back? **No.**
- **C8** Is hiding all monsters at once enough? **Yes.**
- **C9** Typical map size? **Up to 4 MB.**
- **C10** Should Reset also clear the map? **Keep.**
- **C11** Clear the fog as soon as a token is let go? **Yes.**

**Scarlett Isles Explorer** *(answered by Harry, 28 September 2026: all the defaults)*
- **E1** Save the event gold tally? **No, as now.**
- **E2** Rations as text only? **Keep.**
- **E3** The 146 unreachable second scenes? **Keep the text.**
- **E4** Camp-night order: campfire (or main event), then weather, then the Bastion prompt? **Yes.**
- **E5** Queue plays main events immediately? **Yes.**
- **E6** Is the current events set the one Harry wants, and was dropping "Fresh Tracks (Late)" deliberate? **Yes.**
- **E7** Weather save choices and Lethargy as text only? **Keep.**
- **E8** Closing weather without rolling still uses up the wait? **Keep.**
- **E9** Should Reset Travel clear the weather wait? **Keep.**
- **E10** Keep the 18 markers without pictures hidden? **Keep.**
- **E11** The three one-way map links? **Keep.**
- **E12** Show line breaks in event text? **Keep.**
- **E13** Should a refused move put the fog back? **Keep.**
- **E14** Should Reset Fog ask first? **Keep.**
- **E15** DM notes on the Result screen? **Later.**
- **E16** Once pins are tied to the map picture, check all 33 sit on their towns. Were they placed in a maximised Edge window on this laptop? **Yes.**
  - *Found in phase 8:* checked against the towns drawn on the maps, the pins were placed in the Explorer's **full-screen** view on the laptop (1707 × 1067), not a maximised window, so they were converted that way (two hidden pins fit the windowed view better and were converted that way). `tests/pin-check.html` shows all 33 for Harry's check.

**The Ironbow Bastion Manager** *(answered by Harry, 28 September 2026: B2 as below, the defaults for the rest; built in phase 9)*
- **B2** Host Delegation: one roll or three? Does Political Capital change once or twice? **The delegation's own two rolls count.** All three dice prompts stay; the Diplomacy (DC 13) and Insight (DC 12) rolls set Political Capital (+15 / +8 / 0 / −12) and the Favour Token. The first roll still sets the rest (such as the 2-turn cooldown on a bad failure) but no longer changes Political Capital.
- **B3** A consortium pays twice: intended? **Keep.**
- **B4** Hall upgrades: free, or 600 / 1,200 gp? **Free.**
- **B5** Honour the Trade Agreement duration choice? **Keep, ignored.**
- **B6** Grant the Writ of Authority +2? **Keep, not granted.**
- **B7** Gaming Hall gold, War Room upkeep, Craft Magic Item level limit? **Keep, not applied.**
- **B8** Lowering the level: what happens to buildings above the limit? **Kept, marked "over capacity".**
- **B9** Refund cancelled orders? **No refund.**
- **B10** Beasts counted by row? **Keep.** *(Changed 2 October 2026 at Harry's request: beasts are now counted by number; see KNOWN_ISSUES BAS-25.)*
- **B11** Fix the Treasure event so 99–00 can come up? **Yes.**
- **B12** Show the four overlays with mismatched names? **Keep hidden.**
- **B13** Which Bastion map is the real one? **The one in use.**
- **B15** Hidden compendium descriptions and cards; the Export button's online lookup? **Keep hidden; drop the lookup.**
- **B16** Library research notes? **Keep.**
- **B17** Can the treasury go below zero? **Keep.**
- **B18** Do players ever open their own copy? **No.**
- **B19** "Seize Outpost (placeholder)" label? **Keep.**
- **B20** A natural 1 on a Hall action counts as success: intended? **Keep.**
- **B21** Should a new consortium reopen an expired route? **Keep.**
- **B22** More than one war action per turn? **Keep.**
- **B23** Show the shrine charm effects? **Keep hidden.**
- **B24** Check the old DM-session-hub repo for anything the Bastion is missing? **Leave it out.**

*(B1 and B14 are settled by answers 9 and 10. C12 is settled by answer 10. N6 was dropped because the shop link is kept.)*

---

## Appendix: technical facts measured during planning

Measured in Chromium (the engine inside Edge) with pages opened as `file://`. Future sessions can rely on these, but should re-check anything they change.

- **Scripts and data:**
  - Plain `<script>` tags, including ones added at runtime, load from `file://`.
  - `fetch()` of local files is blocked ("URL scheme file is not supported").
  - `new Worker('x.js')` is blocked.
- **Storage:**
  - `localStorage` is **shared by every file:// page on the laptop**, whatever folder it's in, and holds about **5.24 million characters** in total.
  - **IndexedDB** works from `file://`, is also shared by every file:// page (hence the `tsi.` names), and stored 8 MB+ test items with hundreds of MB free.
- **Player windows:**
  - `window.open` works from `file://`.
  - A popup can't read its opener's page (SecurityError). `postMessage` works both ways with `event.origin === "null"`, so check `event.source`.
  - After the opener reloads, `window.opener` still reaches it, and `window.open('', name)` returns the existing named window. A 5 MB Blob posted between windows arrived intact.
- **Canvas:** drawing a bundled image then calling `toDataURL` throws SecurityError (a "tainted" canvas). The Crest's SVG-only export works; an SVG drawn to a canvas can't load outside fonts or images, but a font embedded as a `data:` URL works.
- **PDF.js 3.11.174 (legacy build):** works offline from `file://` when `pdf.min.js` and `pdf.worker.min.js` are both loaded with script tags. It runs on the main thread ("fake worker").
- **Downloads and uploads:** a Blob download via `<a download>` and FileReader uploads both work from `file://`.
- **Fonts:** bundled fonts load from a subfolder or a parent folder. In Firefox (not tested), fonts only load from the page's own folder or below, which is why every HTML page sits at the top level.
- **Test browser limits:**
  - Playwright's Chromium **can't play H.264/AAC MP4**, so video playback must be checked by hand in Edge.
  - The sandbox's language setting mangles non-ASCII download names; relaunch with `LANG=C.UTF-8` if that matters.
  - Don't use Playwright request interception when testing player windows: it stops their stylesheets loading.
- **Network from the sandbox:** npm and GitHub release downloads work; `*.firebaseio.com` and `*.github.io` are blocked by the environment's network settings.
