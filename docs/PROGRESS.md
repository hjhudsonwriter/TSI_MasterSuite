# Progress

## Where things stand

**Phase 9 (The Ironbow Bastion Manager) is built and tested: 9a to 9c together, in one session, as Harry chose.** That completes the faithful rebuild: all eight tools open from their cards. **Next is the short how-to guide** (a later phase), with Harry's go-ahead, and any upgrades Harry asks for after trying the rebuilt tools.

Double-click `index.html` to open the suite. The plan is in `docs/PLAN.md`, the bug list in `docs/KNOWN_ISSUES.md`, and the notes for building each tool in `docs/BUILDING-A-TOOL.md`.

## Done

### Phase 9: The Ironbow Bastion Manager (28 September 2026)
- **Rebuilt as it was:**
  - **The top bar:** Party Level, Compendium, Roll Bastion Event, Advance Bastion Turn (+7 days), Reset, Download Save and Import Save. It stays in view as the page scrolls.
  - **Favour of The Gods, Political Capital and Diplomatic Assets** on the left, as the old fixed panel was, with Claim and Honour Change at the ends of the bars.
  - **Turn Log, Bastion Map and Bastion Event:** the map shows each built facility that has overlay art; an automatic d100 event every 4th turn.
  - **Party Identity & Clan Influence:** Form Clan (level 9, total support 360, 3 clans at 55) and Form Mercenary Brigade (level 7, 3 defenders), Honour/Respect, Clan Honour and Trusted Clients.
  - **Management:** defenders (+1 and −1), Menagerie beasts, the treasury and the military list.
  - **Banner & War Council:** war actions against a clan, resolved next turn at their DC, and the war log with View.
  - **Diplomacy & Trade:** the five record lists and the Hall of Emissaries (Trade Agreement, Host Delegation, Inter-Clan Summit, Secure Writ of Authority, Trade Consortium, and free upgrades), each with its planning box, your d20 and the result box; the Ironbow Trade Network with Invest: Stability, Invest: Yield and High-Risk Routing; Routes (the Sea Trade Routes map with its glowing routes), Resolve and the Council Ledger.
  - **Warehouse and Artisan Tools**, and **Facilities:** construction slots (0 / 2 / 4 / 5 / 6 by level, 3 to 5 turns to build), pending orders, and the carousel of facility cards with their orders.
  - **The Compendium:** 265 items, search, details, the 36 card pictures, the Roll20 link and Export Compendium JSON.
  - It saves the whole Bastion and which panels are closed. Both are in Download Save, the top bar's Export and "Back up everything".
- **Your answers:** B2 as you chose (the delegation's own two rolls set Political Capital); the defaults for the rest. B11: Treasure (99–00) can now come up.
- **Fixed (they broke the tool, lost data or applied something twice):**
  - Reopening or importing keeps party identity, the war log and all diplomacy (BAS-01).
  - Advance Bastion Turn runs as saved steps: a cancelled roll keeps its order (it comes up again next turn), and closing the window mid-turn loses nothing; it reopens ready to finish (BAS-02, BAS-13).
  - A double click, Enter or Space can't run a turn twice, and a click outside a dice box can't cancel it (BAS-03, BAS-10, BAS-12).
  - Lowering the party level keeps every building, marked "Over capacity" (BAS-04, B8).
  - Each trade route pays once a turn, even after a cancelled roll or Enter (BAS-05, BAS-11).
  - Host Delegation changes Political Capital once (BAS-06, B2).
  - A double click queues one war action (BAS-15).
  - Importing another tool's file, or a damaged one, is refused (BAS-14).
  - It works double-clicked and offline, with every picture and the fonts (BAS-07 to BAS-09).
  - The panels' ▾ buttons work and are remembered (BAS-16).
  - Warehouse and Artisan Tools edits save themselves (BAS-17).
- **Kept as they were** (KNOWN_ISSUES BAS-19 to BAS-35), including: Hall upgrades are free (B4); a consortium pays both its contract and its route (B3); the Trade Agreement's Duration list is ignored (B5); the Writ's +2 is never granted (B6); cancelling an order keeps the gold (B9); beasts are counted by row (B10); a natural 1 on a Hall action still signs the deal (B20); an expired route never reopens (B21); the four mismatched overlays and 19 cards stay hidden (B12, B15).
- **Small changes:**
  - **Layout:** the old page was 1754 wide, so it scrolled sideways on your laptop (BAS-36). The Favour panel now sits beside the rest and sticks as you scroll, and everything fits the laptop and the TV.
  - **Wording:** the TEST-mode sentence in the Form Clan and Brigade boxes is gone; the Pending Orders hint names Advance Bastion Turn; the map tip says it saves in your browser (BAS-38).
  - **Pictures:** the Warehouse and Artisan Tools panels each show their own faint picture (they had been shifted along; BAS-39).
  - **Redrawing:** a facility's list keeps your choice and the carousel stays where it was after each order; a war report shows its lines as written (BAS-40).
  - **Pop-ups:** the suite's own pop-ups, with the painted hall behind the Hall's, as before. Clicking outside one does nothing.
  - **Unreachable code** (the old Arbitration Authority pop-up and a few more) is left out (BAS-37).
- **Checked against the old tool:** with the same dice, the old Bastion and the rebuild ran the same 12-turn campaign (building, orders, crafting, research, prayer, a Trade Agreement, Hall upgrades, a summit, a consortium, a route lost at sea, a Council verdict, a raid, a beast and Bastion events). The saved Bastion matched at all 19 steps: gold, buildings, orders, warehouse, diplomacy, routes, disputes, the war log and every Turn Log line. A Host Delegation then differed only by the old double Political Capital (B2).
- **Structure:** `tools/bastion/rules.js` (the rules), `tool.js` (the screen), `bastion.css`, and `data/` (`bastion-data.js` for the numbers and wording that were in the old code; `facilities-data.js`, `tools-data.js`, `events-data.js` and `compendium-data.js`, word for word from the old JSON files).
- **Tests:**
  - `tests/rules.html`: 301 rules tests (54 new).
  - `tests/e2e/phase9.test.js`: 63 checks.
  - The earlier click-throughs (phases 1 to 8) still pass.
  - **Not tested here:** Edge itself; the real TV, including dragging the window between the laptop and the TV. These are on Harry's checklist.

### Phase 8: Scarlett Isles Explorer (28 September 2026)
- **Rebuilt as it was:**
  - **Maps:** the ten province maps (Load), uploading your own map (up to 4 MB), Clear map, Fullscreen and Hide UI (or H).
  - **The hex grid:** on/off, Hex − / +, the four nudges, opacity and the size readout; Snap; Pick Marker XY.
  - **The heroes:** Kaelen, Umbrys, Magnus, Elara and Charles; click, Ctrl + click and box select; Group and Ungroup; Token − / + and the mouse wheel.
  - **Travel:** 6 miles a hex for every hero in the move, 30 a day, moves over 30 refused, Free Move, the pace and effects, each hero's miles, Reset Travel.
  - **Map changes:** each map sets its event region, and moving between linked maps puts the party at the entry point in formation (the three one-way links kept, E11).
  - **Fog of war:** two hexes round the hero whose miles show, kept per map; Reset Fog; town pins appear once uncovered.
  - **Town pins:** the 15 with a town map show and open it; the 18 without stay hidden (E10).
  - **Events:** a travel event once a day at a random 6–24 miles; a campfire event at Make Camp; choices, steps and results from the old events file, word for word (279 travel and 322 campfire events).
  - **Weather:** after a 3-day wait, a 45% chance at camp; you roll at the table and type the result; the looping video covers the map for that day.
  - **Main campaign events:** The Tide Remembers and The Turning Tide, played at once by Queue (E5), with all 11 pictures.
  - **The weekly Bastion prompt** on days 8, 15, 22 and so on.
  - It saves the whole journey (map, grid, snap, Free Move, day, weather, fog, heroes and their miles) and the uploaded map. Both are in Export Save, the top bar's Export and "Back up everything".
- **Your answers:** all the defaults (E1–E16). E4: camp shows the campfire (or main) event, then the weather, then the Bastion prompt.
- **Fixed (they broke the tool, lost data or applied something twice):**
  - Make Camp's pop-ups follow one another instead of replacing each other, so no event or weather is lost (EXP-01).
  - Enter or Space after Make Camp, or a double click, can't camp twice or make the event vanish (EXP-02, EXP-14).
  - Heroes' miles survive reopening (EXP-03).
  - Pins, grid, fog and heroes are tied to the map picture, so a hex covers the same ground on the laptop and the TV, in a window or full screen, and a one-hex move always costs 6 miles (EXP-04, EXP-10, EXP-11).
  - A big uploaded map can't stop the saving (EXP-05); a damaged file can't lock the Explorer (EXP-12); Import asks first (EXP-09).
  - It works double-clicked and offline: maps, pins, events, pictures, videos and fonts (EXP-06 to EXP-08).
  - Messages stay inside full screen (EXP-15), and H only works in the Explorer, never while typing (EXP-13).
  - A double click on an event's choice counts once (EXP-29, found while rebuilding).
- **The 33 pins (E16):** converted once. Checked against the towns drawn on the maps, they were placed in the Explorer's **full-screen** view on the laptop, not a maximised window, so they were converted that way. Two hidden pins (Port Brawdlyn, Fork Farm) fit the windowed view better and were converted that way. `tests/pin-check.html` shows every map with all 33 pins for Harry to check.
- **Kept as they were** (KNOWN_ISSUES EXP-16 to EXP-28), including: event gold isn't saved and resets weekly (E1); the Fog of War button reads Off after reopening; the Region list doesn't follow the loaded map; closing the weather without rolling still starts the 3-day wait (E8); an empty roll box counts as 0; Reset Fog doesn't ask (E14).
- **Small changes:**
  - **Layout:** the map fills the middle, with the controls on the left and the travel panel on the right, so a 4:3 map gets the laptop's whole height; the same in full screen. Hide UI now also works outside full screen.
  - **Header:** the suite's top bar replaces the old logo and title; the empty "Tips: ..." line is gone.
  - **Heroes** stay on the map picture itself, so they can't be parked in the dark bands beside a 4:3 map.
  - **Weather:** yesterday's weather video goes as soon as you make camp (before, it stayed until the next click on the map).
  - **Pick Marker XY** now gives positions on the map picture (the form the pins use), and no longer starts a selection box.
  - **The weather pop-up** puts the keyboard focus on its heading, so an Enter meant for the last pop-up can't resolve the weather by accident.
- **Checked against the old tool:** with the same dice, the old Explorer and the rebuild made the same journey (the North Isle, a group, ten days of moves, a refused move, Free Move, ten camps with travel and campfire events, two weather rolls, the day-8 Bastion prompt, both main events and Reset Travel). They showed the same travel panel, the same saved journey and the same pop-ups, pictures and results at each of 60 steps.
- **Structure:**
  - `tools/explorer/rules.js` (rules and map geometry), `tool.js` (the screen), `explorer.css`, and `data/` (`explorer-data.js` for maps, pins, entry points, main events, weather and heroes; `events-data.js` for the events).
  - The shared pop-ups and notices now open inside full screen.
- **Tests:**
  - `tests/rules.html`: 247 rules tests (42 new).
  - `tests/e2e/phase8.test.js`: 63 checks.
  - The earlier click-throughs (phases 1 to 7) still pass.
  - **Not tested here:** Edge itself; the weather videos playing (the test browser can't play MP4s); the real TV, including dragging the window between the laptop and the TV. These are on Harry's checklist.

### Phase 7: Combat Tracker & VTT Battlemap (28 September 2026)
- **Rebuilt as it was:**
  - **Storage:** the combatant library (PC, NPC and Monster, HP, initiative bonus, picture and stat-block links); Shift + click to edit; Add Selected with copies (Goblin, Goblin a…); saved encounters (Save, Load, Duplicate, Delete); campaign files (Import and Export Campaign JSON); and Import PDF.
  - **The board and inspector:** Auto-roll Initiative, Begin, Pause and End; the target, Damage / Healing, conditions with turns, Complete Turn and Add Condition; the Open Stat Block link; Round & Momentum.
  - **The Battlemap window**, which you can drag to the TV:
    - the map picture, zoom and pan (Space + drag, Ctrl + wheel), and token size;
    - dragging tokens, with Ctrl + click and Ctrl + drag to select several, and Shift + click to take one off the map;
    - the grid, with snap, size and nudge, and the ruler;
    - fog of war (on/off, cover, reveal, reset, range, monsters under or above);
    - Hide monsters, and fullscreen with its side buttons;
    - the highlight on whoever's turn it is.
  - It saves the library, the encounter, the saved encounters, the Battlemap settings and the map picture.
- **Your answers:**
  - C6: the line-of-sight cone is left out (it never worked).
  - C2: healing a creature above 0 HP clears DEFEATED; PCs at 0 are still skipped.
  - C3: Pause/Begin still starts again from round 1, but now says so.
  - C11: the fog clears as soon as you let go of a player's token.
  - The rest are the defaults: NPCs never take turns (C1), adding combatants resets to round 1 (C4), initiative is auto-roll only (C5), no way to bring back a token taken off the map (C7), Hide Monsters hides them all (C8), maps up to 4 MB (C9), and Reset leaves the map (C10).
- **Fixed (they broke the tool, lost data or applied something twice):**
  - Complete Turn checks every box first. A wrong Turns number, or damage that isn't a number, changes nothing and doesn't move the turn on (ENC-01, ENC-28).
  - Tokens, the grid and the fog are measured on the map picture. They stay on their squares when the window is resized, zoomed, made fullscreen or moved to the TV (ENC-03).
  - Maps up to 4 MB are kept, and a full storage warns you (ENC-04, ENC-05).
  - There's only one desk: the Battlemap has no "Back to Tracker" link, and it sends its changes to the desk to be saved (ENC-06).
  - A bad campaign file or a damaged save can't break the tracker; nameless entries are skipped, and a damaged save is kept aside (ENC-07, ENC-08).
  - PDF import and the fonts work offline (ENC-09, ENC-10).
  - "Monsters: Above fog" works (ENC-12).
  - Double clicks on Complete Turn, Add Selected and Save Current Encounter count once (ENC-13).
- **Kept as they were** (KNOWN_ISSUES ENC-14 to ENC-26):
  - Pause/Begin starting again from round 1.
  - Hidden monsters are hidden from you too.
  - The Battlemap's Hide monsters label catches up only with the next change to the fight.
  - Fog squares ignore the grid nudge.
  - Adding combatants mid-fight resets the round.
- **Layout:**
  - The desk's three panels fit your laptop and the TV, with every main button in view; long lists scroll inside their panel.
  - The Battlemap window's map fills everything below its controls, and fills the screen in fullscreen. In fullscreen, the side buttons sit to the left, clear of the ruler.
- **Checked against the old tool:**
  - With the same dice, the old tracker and the rebuild played the same fight (building the library and encounter, initiative, turn after turn of damage, healing and conditions until the monsters fell, Pause, Begin, End, Save and Load, and a library edit) and showed the same desk at each of 42 steps.
  - Both give the same campaign file.
  - Both Battlemaps show the same tokens, the same turn highlight and the same hidden monsters.
- **Structure:**
  - `tools/encounter/rules.js` (rules and map geometry), `tool.js` (the desk), `battlemap.js` (the Battlemap window), `encounter.css` and `battlemap.css`.
  - PDF.js 3.11.174 is in `shared/lib/pdfjs/`, with its licence.
  - The one unused picture is in `tools/encounter/assets/extras/`.
- **Tests:**
  - `tests/rules.html`: 205 rules tests (34 new).
  - `tests/e2e/phase7.test.js`: 78 checks.
  - The earlier click-throughs (phases 1 to 6) still pass.
  - The shared test helper now keeps a picture load the page itself cancelled (a redraw before the picture had loaded) apart from a missing file. One of the Pelagosi checks had failed once on such a load; missing files are still caught.
  - **Not tested here:** Edge itself; the real TV, including dragging the Battlemap between the laptop (sharper screen) and the TV; and pictures or stat blocks from the web. These are on Harry's checklist.

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
**The short how-to guide for Harry** (a later phase in CLAUDE.md), with Harry's go-ahead. After trying the rebuilt tools, Harry can also ask for upgrades; sections 12 to 15 of the handover hold the ideas it proposed.

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
- **Combat Tracker (phase 7):** answered (C1–C11).
- **Explorer (phase 8):** answered (E1–E16: all the defaults).
  - E16: the pins turned out to have been placed in the Explorer's full-screen view, not a maximised window, and were converted that way. Please double-click `tests/pin-check.html` and check all 33 sit on their towns; tell the next session about any that don't.
  - Kept behaviours you're likely to notice: the Fog of War button reads Off after reopening (EXP-19); the Region list doesn't follow the loaded map (EXP-20); and pressing Resolve with an empty roll box counts as a roll of 0 (EXP-28). Say if you'd like any changed.
- **Bastion (phase 9):** answered (B2: the delegation's own two rolls set Political Capital; the defaults for the rest).
  - Kept behaviours you're likely to notice: Hall upgrades cost nothing (BAS-22); a consortium pays its income twice a turn, once as a contract and once as a route (BAS-24); "Cleared warehouse." appears twice in the Turn Log (BAS-31); and a Host Delegation's result box has an empty line where its summary should be (BAS-34). Say if you'd like any changed.
  - Advance Bastion Turn has no "Are you sure?" step, as before; a double click now counts once. Say if you'd like one.

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
- **Two-way player windows and map positions:** see the Battlemap note in `docs/BUILDING-A-TOOL.md` section 5. The Explorer uses the same idea with its own board (1440 units wide, so its old sizes are screen pixels on the TV in full screen).
- **Fullscreen in tests:** headless Chromium supports `requestFullscreen()`, so `phase7.test.js` and `phase8.test.js` check the fullscreen layouts. The Escape key doesn't leave full screen there: call `document.exitFullscreen()` instead.
- **Pop-ups and full screen:** shared pop-ups and notices open inside whatever is in full screen, and move there if full screen starts while one is open (`shared/js/modal.js`, `core.js`).
- **The Bastion's comparison with the old tool:** the old tool builds its file paths from the first folder in the address, so `phase9.test.js` serves `_legacy/` and opens `/bastion_manager/index.html`. It saves some changes only on its next save, so the test nudges the treasury box before reading its save. `TSI.bastion.debug.change(fn)` sets up a check by changing the Bastion directly.
- **Sound in tests:** the test browser can load the sounds but nobody hears them. The Pelagosi test records which sounds start and when; hearing them is on Harry's checklist.
