# Progress

## Where things stand

**The rebuild is complete, the short how-to guide is written, and the first upgrades are done: the Clan Crest Creator has been reworked at Harry's request, its sigils redone from real heraldic artwork, and it now remembers your last design. The Bastion now takes a crest for your Clan or Brigade, counts beasts properly, and has phase 2 of the war mini-game: full battles on the War Table against an enemy that plays to its objective, with the result (losses, recovery and rewards) applied to the Bastion exactly once. The rules, as built, are in `docs/WAR-RULES.md`. On 6 October 2026 the Explorer's travel and campfire events were replaced with Harry's new ones, any tool can be opened in a new window from Switch tool, and the DM doc opens as a floating panel. On 7 October the Explorer's fights started setting themselves up in the Combat Tracker (monsters, Harry's own battle maps and the grid, with the tracker reporting back when every enemy is down), the ford only near rivers and the cove near the sea. The DM doc now shows where the campaign stands: the party's level and heroes, the day, the Bastion's orders and its next word, the Clan's and the god's standing where the party is, the party's gold, and the Explorer's Active Effects and Threads. On 8 October the Bastion overhaul began (plan: `docs/BASTION-OVERHAUL.md`): **Build 1** is done. The Bastion has no turns any more: it follows the Explorer's day, orders take days, "The Ironbow sends word…" brings its news to both tools, and the Explorer and the Bastion save as one campaign. **Build 2** followed the same day: the Bastion's new screen, with the map filling the window, a facility grid along the bottom and every panel opening over the map. Build 3 (identity and the crest) waits for Harry's go-ahead.** All eight tools open from their cards, and `guide.html` (linked at the foot of the home screen) explains them. What comes next is up to Harry: after trying the tools at the table, he can ask for more upgrades, fixes to kept behaviours, or the joined-up ideas in sections 12 to 15 of the handover.

Double-click `index.html` to open the suite. The plan is in `docs/PLAN.md`, the bug list in `docs/KNOWN_ISSUES.md`, and the notes for building each tool in `docs/BUILDING-A-TOOL.md`.

## Done

### The Bastion's new screen: the overhaul's Build 2 (8 October 2026)
Harry said go for Build 2 (plan: `docs/BASTION-OVERHAUL.md` section 5). Every rule is as it was; only the screen changed (KNOWN_ISSUES BAS-64).
- **The map fills the window,** under a slim header (Party Level, Compendium, Reset, the saves). It never scrolls, and shows the painting at about 940 × 627 on the laptop and 1165 × 777 on the TV (about 700 × 470 before).
- **The top bar:**
  - the day, with Finish Day for a day left part-way;
  - the treasury with a coin (type, then Enter);
  - the Facilities and Orders counts, each with a hover list. Clicking one opens Construction or all the pending orders.
- **The Party Identity badge** sits in the map's top-right corner (the crest, or a faint shield) and opens Party Identity. Build 3 reworks the crest itself.
- **The facility grid,** along the bottom: the five starting facilities, then six construction slots.
  - **Built:** hover shows its level and orders; click opens its panel.
  - **Being built:** an hourglass and the days left.
  - **Under Repair:** a hammer.
  - **Free slot:** opens Construction.
  - **Locked slot:** a padlock and the level it opens at.
  - **Folding:** ▼ folds the grid away to show more of the map, and it stays folded after reopening.
- **Construction:** every facility not yet built, with its painting. Locked ones are dimmed. Hover shows what it does and its days. It asks "Construct the Smithy? It takes 21 days." first.
- **Each facility's panel:** its painting, level and status, the orders pending there (Cancel, Resolve), then its orders with their days. The Workshop's holds the Artisan Tools, and the Hall's tile opens Diplomacy & Trade.
- **The bottom bar's buttons:** Warehouse, Management, Day Log and Events on the left; Clan Influence, Favour and the War Council on the right. Each opens its panel over the map; Esc or Close closes it.
- **Clan Influence** puts each Clan on one row: Political Capital, Honour/Respect, support. The Favour Tokens sit below.
- **The War Council** is locked until the Bastion has something that can fight (Harry's answer 6), and stays open while a war is going on.
- **One tooltip card for the suite** (`shared/js/tooltip.js`): beside what it describes, never over it, and above the panels (SUI-25).
- **Fixed while building** (none reached Harry): Esc in the War Room's unit list or on a stat-block tooltip closed the whole panel; an over-capacity facility still being built had no mark; the Hall's panel was too narrow (BAS-65).
- **The guide** is rewritten for the new screen.
- **Tests:**
  - `tests/rules.html` runs 812 rules tests, all passing (2 new: the War Council lock, and what the screen remembers).
  - New: `tests/e2e/bastion-screen.test.js` (35 checks) clicks through the new screen on the laptop, in full screen, on the TV and in a small window.
  - `tests/e2e/phase9.test.js` now reaches every control through its panel, by pressing that panel's own tile or button. Its checks of the old screen (the slot lists, the carousel, the side column) are rewritten for the grid and the panels.
  - The two-window test (`bastion-days.test.js`) gives its orders through the Barracks' panel.
  - Screenshots in every test pause animations: the test browser has no graphics card and draws the trade map's glowing routes very slowly.
  - All passing: the Bastion (107), the new screen (35), the two windows (15), phase 1 (125), the Explorer (81), the DM doc (11), fights (15), the War Table (145) and the guide (20).

### The Bastion counts in days: the overhaul's Build 1 (8 October 2026)
Harry asked for the Bastion to drop its turns and follow the Explorer's day (plan v2, with his answers, in `docs/BASTION-OVERHAUL.md`). Build 1 changes the rules and the saving, on the Bastion screen Harry already knows; the new screen is Build 2.
- **One clock: the Explorer's day.** Each Make Camp passes that day at the Bastion, even when it's open in another window (it notices within about 2 seconds). The Bastion never changes the Explorer's day, and has no button of its own to move time on. If it's opened after several days of travel, it passes each day in turn. Reset Travel moves every Bastion day back with the Explorer's.
- **Orders take days.** Each order's card says "Takes N days" (the days proposed in the plan's section 2, for Harry to revise after playing); the pending list says "Due Day N (in N days)". Building takes 21 to 35 days.
- **Every 7 days from its own start:** trade shipments, sea routes and each war's attack roll. Everything else that was in turns keeps its length at 7 days a turn: wars end after 42 quiet days, repairs last 14 days, wounded Lieutenants and beasts are back after 7 to 21 days, and the Bastion event comes every 28 days (Days 29, 57…). A War Action musters 3 days after it's queued. Every changed rule is listed in KNOWN_ISSUES BAS-60, and the war rulebook (`docs/WAR-RULES.md`) is reissued in days.
- **Trade Agreements in weeks:** the Duration choice (1, 3 or 6 weeks) now counts, with a shipment every 7 days; the Hall shows "X days remaining (Y shipments)".
- **"The Ironbow sends word…"** replaces the weekly reminder. It comes whenever a day brings news (building or an order finished, an agreement ending, a roll needed, an army ready to march, a repair done, a wounded Lieutenant back): at Make Camp in the Explorer, and in the Bastion as it passes the day. The **Day Log** (was the Turn Log) keeps it all.
- **A cancelled roll** leaves the order "Due now: waiting for your roll" with a **Resolve** button. **Finish Day** shows only if a day was left part-way (Edge closed mid-roll); the Bastion also finishes it by itself.
- **The Explorer** has **Open the Bastion ↗** under Make Camp (it says so if the Bastion is already open elsewhere), and saves as soon as it first opens, so the Bastion can read Day 1.
- **One campaign save:** Export in either tool downloads one `tsi-campaign-…json` file with both; Import in either tool checks both halves, asks first, and replaces both. It won't run while the other tool is open in another window (SUI-23).
- **The DM doc:** the two turn tiles become **Orders pending** and **Next word from the Ironbow**.
- **Your old Bastion** (saved in turns) is set aside the first time the new version opens: kept, not deleted, as Harry agreed, and a new Bastion starts on the Explorer's day. A Bastion-only file from before is refused on import (BAS-61).
- **Bugs found and fixed while building** (none reached Harry): the Explorer didn't save Day 1 until something changed, so the Bastion missed the first camp (BAS-62); two saves set aside in the same second kept only the second (SUI-24).
- **Left alone:** three rulebook Bastion events still say "your next Bastion turn" (BAS-63; Harry's call).
- **The guide** (`guide.html`) is rewritten for days: the Bastion section, the Explorer's Make Camp and Export/Import, the DM doc and backups.
- **Tests:**
  - `tests/rules.html` runs 810 rules tests, all passing: the Bastion's and the war's tests rewritten for days, plus the day engine, shipments and attack rolls every 7 days, catching up several days, Reset Travel, an old save set aside, the campaign file and "The Ironbow sends word…".
  - `tests/e2e/phase9.test.js` (107 checks), reworked for days; its side-by-side run against the old Bastion is retired, because the rules now deliberately differ.
  - New: `tests/e2e/bastion-days.test.js` (15 checks): the Explorer and the Bastion in two windows, making camp, the word in both, the campaign file both ways, and Reset Travel.
  - Also passing, re-run because shared saving code changed: phase 1 (125), the Crest (68), Pelagosi (58), the Notice Board (64), the Ritual (53), the Arenas (79), the Combat Tracker (78), the Explorer (81), the DM doc (11), fights (15), the War Table (145) and the guide (20).
  - **A test fix, not a tool fix:** one Pelagosi check failed here and on main. The Surge locks the pillars for 1.9 seconds, and the screenshot taken just after it now takes about 2.5 seconds, so the check found the lock already lifted. The check now reads the lock before the screenshot; Pelagosi itself is unchanged.

### The party's gold and the Threads in the DM doc (7 October 2026)
Harry asked for the Explorer's Threads and gold to be added to the DM doc (KNOWN_ISSUES SUI-22).
- **Two more tiles**, making six:
  - **Party gold:** the Explorer's event gold, the same number as its Gold: line. It can go below 0 (T14's −100), and shows 0 once you clear it in the Explorer.
  - **Threads:** how many are open, and the next follow-up due (for example "open · next follow-up due Day 15").
- **A Threads list**, under Active effects:
  - each thread's name and note, the day it opened, the event it came from and any follow-up due, worded as in the Explorer's own list;
  - what resolving it gives, for example "When resolved: +250 gold · DM note: Notice Board: consider +1 clan honour with Clan Blackstone.", as the Explorer's "are you sure?" says.

  A thread goes when you resolve it in the Explorer. A follow-up that didn't come (the party had moved on) stops counting as due, as in the Explorer.
- **Taller:** it first opens 800 pixels tall (was 680), so everything shows on the laptop until the lists get long; then it scrolls. Once moved or resized it keeps your size, so if you'd already dragged it aside, drag its corner down to see more.
- **Shared wording:** when a follow-up is due, and what resolving a thread gives, now come from `shared/js/campaign-rules.js`, which the Explorer and the DM doc both use.
- **Tests:**
  - `tests/rules.html` runs 798 rules tests, all passing (3 new, and the damaged-save test extended): the gold, every thread's wording against the Explorer's, the next follow-up, resolving, a follow-up that didn't come, and odd saves.
  - `tests/e2e/dmdoc.test.js` (11 checks, all passing; 1 new) plays C6, T6 (deliver the letter sealed) and T14 (buy the share), then resolves the Sealed Dispatch and clears the gold in the Explorer, checking the DM doc follows every step.
  - The earlier click-throughs still pass: phase 1 (125), phase 8 (81) and fights (15).

### The DM doc's contents (7 October 2026)
Harry asked for the DM doc to show, neatly and easy to read: the party's level, the heroes' names, the days passed, the Bastion turns completed, the days until the next Bastion turn, the Explorer's Active Effects (appearing and going exactly as the Explorer's do), and the Clan's and the god's territory the party is in, with the Clan's Honour/Respect and Political Capital and the god's Favour from the Bastion (KNOWN_ISSUES SUI-22).
- **Four tiles at the top:** Party level (from the Bastion), Day (with days passed), Bastion turns (completed), and Next Bastion turn (in how many days, and which day, at Make Camp).
- **Heroes:** the Explorer's hero tokens, by name.
- **Where the party is:** the Explorer's Region; the Clan's territory and chief, with Political Capital and Honour/Respect as numbers and bars; the god's lands, with Favour as a percentage and a bar in the god's colour.
- **Active effects:** each one with who has it, what it does, when it ends and the event that gave it, worded as in the Explorer.
- **Always up to date:** while open it re-reads both saves every 2 seconds, so a change in another window (the Bastion on one screen, the Explorer on the other) shows by itself. Closed, it reads nothing. It never changes either tool's saves.
- **Before a tool has saved,** it says so ("Bastion not saved yet", "Explorer not started", "Open the Explorer to see where the party is") rather than showing made-up numbers.
- **Bigger:** it first opens 680 pixels tall (was 520), so everything shows without scrolling on the laptop and the TV; it can still be dragged and resized.
- **One list of regions:** each region's Clan, chief and god now live in `shared/data/regions.js`, read by both the Explorer's events and the DM doc. How an effect's end is worded, and the days the Bastion reminder comes, are shared too (`shared/js/campaign-rules.js`), so the DM doc and the Explorer can't disagree.
- **Tests:**
  - `tests/rules.html` runs 795 rules tests, all passing, 11 of them new (`tests/rules/campaign.test.js`): the regions match the Explorer's and the Bastion's, every number from fresh and changed saves, odd values kept within the Bastion's limits, the next Bastion turn matching the day the Explorer really prompts, and effects going when the Explorer removes them.
  - `tests/e2e/dmdoc.test.js` (10 checks, all passing) clicks through it offline: empty, then the Bastion's numbers, the Explorer's Region and heroes, a Region change, an event's effect staying from Day 1 to 7 and going on Day 8 (with the next Bastion turn moving to Day 15), a change in another window, no reading while closed, and the laptop and the TV.
  - The earlier click-throughs still pass: phase 1 (125), phase 7 (78), phase 8 (81), fights (15) and the guide (20). The fights test now waits for the Explorer to finish saving after Done before it reloads the page; it was reloading within a few milliseconds and bringing the event back (a test timing problem only: leaving a tool in the suite always waits for the save).

### Harry's battle maps in place (7 October 2026)
Harry made 16 battle maps (a ford, a camp, a cove and a road, each in four looks) and asked for them to replace the stand-ins, matched to the provinces they suit.
- **Matched by look:**
  - **green:** the Northern, Midland and Eastern Provinces (Telluria's lands);
  - **warm** (dry amber, or autumn): the Southern and Western Provinces (Aurush's);
  - **cold** (rocky heather, or snow): the North Isle;
  - **misty:** the East Isle.

  Each region's look is one word in `tools/explorer/data/fights-data.js` (`looks`), so it's easy to change.
- **The grid:** 24 × 18 squares of 5 ft, which suits the art (a tent is 2 squares, the road about 2½, the river about 3½). The starting places were set on each layout, keeping everyone out of the river, the sea, the fire, the tents, the crates and the fallen tree. Tokens start two squares apart wherever there's room.
- **C12 at Bleakharbour** is now fought in the snowy cove (Harry made no rocks map). T13 at Redport uses the autumn cove.
- **The files:** Harry uploaded them to the top of `main`. This branch moves them, renamed and otherwise unchanged, into `tools/encounter/assets/battlemaps/`, and deletes the 23 stand-ins and the script that drew them (`docs/ASSETS.md`).
- **Tests:** 784 rules tests, all passing; `tests/e2e/fights.test.js` 15 checks, all passing (the Battlemap shows the warm ford at 1448 × 1086).

### Rivers and coast on the Explorer's maps (7 October 2026, after Harry's test)
Harry tested the fight set-up ("everything seemed to work well") and asked that river and coastal battle maps only turn up at rivers and on the coast. He chose: T2 only near a river, and road fights near the sea in the cove (KNOWN_ISSUES EXP-35).
- **The marks:** each of the 10 Explorer maps now has its rivers and coast marked (`tools/explorer/data/terrain-data.js`, made once from the map pictures by `docs/dev/make-terrain.py`). "Near" is within 2 hexes (12 miles): every port town is near the sea; Alderbridge and Fork Farm are by a river.
- **T2 The Ambush Sign** comes up only when the party is near a river: parts of Midland, Northern Province (East and West) and Southern Province (West). It never comes up on an uploaded map.
- **Near the sea**, F1's and C10's road fights are fought on the cove map, and the fight step says so. Camp fights stay in camp; T13 and C12 keep their maps.
- **Tests:** 783 rules tests, all passing (5 new); `tests/e2e/fights.test.js` 15 checks and `tests/e2e/phase8.test.js` 81 checks, all passing.
- **Harry's 16 battle maps** came next (see above).

### Explorer fights set up in the Combat Tracker (7 October 2026)
Harry asked whether an Explorer fight could load a map and its monsters into the Combat Tracker by itself, and chose: a battle map for each region, the party level read from the Bastion, the SRD monsters closest to each event's enemies, and the tracker reporting back (KNOWN_ISSUES EXP-34).
- **In the Explorer:** every fight step shows the fight ready to set up:
  - the party level (from the Bastion's saved level, read again at the moment in case the Bastion changed it in another window; level 7 if it never saved one) and the group it picks, levels 7–10 or 11–16, as the event suggests;
  - each monster with its Armour Class and hit points;
  - the battle map, for that kind of place and the Region;
  - who's surprised, in the two ambushes (T2 and F1).
- **Set up this fight in the Combat Tracker ↗** opens the tracker in a new window, ready to drag to the TV, and the fight waits there. If the tracker is already open in another window, the fight goes to it instead.
- **In the Combat Tracker:** a pop-up offers the fight; **Load the fight**:
  - adds the monsters to the library (once, with their initiative bonus and a D&D Beyond stat-block link) and to the encounter, in place of any monsters already there;
  - keeps the PCs and NPCs (with none in the encounter, the library's PCs join);
  - marks the surprised heroes Surprised for their first turn;
  - sets the battle map, a matching 5-foot grid with Snap on, and everyone's starting places (two squares apart, so the names don't overlap).

  After **Not now**, **Load the Explorer's fight** at the top of the tracker offers it again. Auto-roll Initiative uses the stat blocks' bonuses.
- **Reporting back:** when every monster is down, the tracker says "Fight won." and the Explorer's event window says "The Combat Tracker reports: every enemy is down", with **Won** as the main button. The DM still clicks Won or Fled.
- **The data:** `tools/explorer/data/fights-data.js` holds each fight's two groups (from the events' suggested enemies), the SRD numbers, and the battle maps with their grids and starting places. How it's written is explained at the top of the file.
- **The battle maps were stand-ins at first** (replaced by Harry's own the same day, see above): 23 simple top-down maps drawn by code:
  - a ford, a road and a camp for each of the 7 regions, coloured to match the Explorer's province maps;
  - the cove below Redport (T13) and the rocks below Bleakharbour (C12).

  Each was 1800 × 1200 pixels, 30 × 20 squares.
- **Tests:**
  - `tests/rules.html` runs 778 rules tests, all passing, 25 of them new (`tests/rules/fights.test.js`): every fight's data, every map picture, every fight in every region accepted by the tracker, loading, surprise, the report and the starting places.
  - `tests/e2e/fights.test.js` (14 checks, all passing) clicks through the whole thing in two windows, offline: the level changed in another window, Set up, Load the fight, the Battlemap, beating every enemy, the report, Won, a tracker already open, Not now, a reload part-way and a restored backup.
  - The earlier click-throughs still pass: phase 1 (125), phase 7 (78), phase 8 (81) and the guide (20).

### After Harry's test: The Second Marker removed, and the Bastion from the weekly reminder (7 October 2026)
Harry tested the 6 October build ("all tests passed and everything seems to be working fine") and asked for two changes.
- **T17 The Second Marker is removed** from the Explorer's events (and its night fight with it), so the Main Campaign list has no DM events now. There are 16 travel events. An old save with it in progress, or set for tonight, simply drops it on loading; a thread it already opened stays in the Threads list for the DM.
- **The weekly Bastion reminder** (days 8, 15, 22…) has **Open the Bastion Manager in a new window ↗**, which opens the Bastion beside the Explorer (for the TV or the laptop). The reminder stays up until it's closed, as before.
- **Tests:** `tests/rules.html` runs 753 rules tests, all passing; `tests/e2e/phase8.test.js` has 81 checks, all passing, including the new button opening the Bastion in its own window.
- **Harry's question** about the Explorer setting up fights in the Combat Tracker and Battlemap (a map and monsters ready to go) was answered in the session and built the same day (see above).

### The Explorer's new events, a new-window option, and the DM doc (6 October 2026)
Harry asked for three things, and answered four questions (the DM doc as a floating panel; every recommendation in his events document except T9; event gold as a saved running total; follow-ups guaranteed on their last day). Mid-build he added a fourth: remove rations from the Explorer completely.
- **Open a tool in a new window** (KNOWN_ISSUES SUI-20):
  - Inside a tool, every other tool in **Switch tool** has a **↗** that opens it in its own Edge window, sized to the screen, ready to drag to the TV.
  - There's none for the tool already open, for Home, or on the home screen's menu, as those would set off the "Already open" warning.
  - Two different tools in two windows don't warn.
- **The DM doc** (SUI-21):
  - **DM doc** in the top bar, on every screen, opens a floating panel over the tool. It can be dragged by its title bar, resized from its corner and closed with ✕, and the tool underneath keeps working.
  - Its place and size are saved (and included in Back up everything).
  - Whether it's open is remembered per window: it reopens after a tool switch, but never pops up by itself in a window on the TV.
  - The contents are a placeholder, as asked.
- **The Explorer's new travel and campfire events** (KNOWN_ISSUES EXP-30 to EXP-33), from Harry's document "Scarlett Isles Explorer: New Travel & Campfire Events (Draft)". Harry chose every recommendation in its "Decisions for Harry", except T9.
  - **The events:**
    - 17 travel events, 12 campfire events and 3 follow-ups, written into one data file, `tools/explorer/data/journey-events.js`. How an event is written is explained at the top of that file.
    - T9 The Husk in the Furrows is written but switched off: no Rootbound creature before the Heartwood finale. Turning it on means deleting `off: true`.
    - T17 The Second Marker was built as a DM-only event, then removed at Harry's request the next day (see 7 October).
    - The old 601 events are switched off: no longer loaded, but kept in `data/events-data.js`.
  - **How often:**
    - **Travel:** once a day on the road, at a random 6 to 24 miles (as before), there's a 30% chance of a travel event, never two days running.
    - **Make Camp:** the weather is exactly as before. Then there's a 25% chance of a campfire event, skipped after a travel event or weather that day.
    - **Drawn like cards:** nothing repeats until a map's pool is used up.
    - **Follow-ups:** a follow-up that's due takes the next travel event. On the last day of its window it happens whatever the roll, at that night's camp if the road didn't bring it (Harry's choice). On the wrong map, it's dropped and its thread stays.
  - **The event window:**
    - one step at a time;
    - the check and its DC, who rolls, and Success, Failure or Fail by 5 or more;
    - ticking who failed a check every hero makes;
    - choices, fights (with a suggested enemy group, Won or Fled, and the Combat Tracker in a new window), best-of-three contests (the opponent's roll is shown), riddles and puzzles (one hint, and a DM's peek at riddle answers);
    - a summary of what changed;
    - the travel-pace reminder on the checks it applies to.

    **Skip this event** works before anything has happened. **Keep it for later** and **Back to the event** handle a pause. An event part-way through comes back after closing Edge or switching tool, and nothing applies twice.
  - **The travel panel:**
    - **Gold:** the party's event gold is now saved, a running total with **Clear** (Harry's choice, EXP-32).
    - **Active Effects:** who has what, and when it ends; ✕ removes one.
    - **Threads:** story hooks; **Resolve** pays any reward a thread promised.
    - **Roll an event now.**
    - **Miles:** events can change today's 30 miles (shown as /24, /36 and so on).
  - **Rations are gone** (EXP-31): every mention and every piece of code. Slow pace reads "+Stealth".
- **Tests:**
  - `tests/rules.html`: the new `explorer-journey.test.js` checks that every event's steps link up, plus pools, chances, follow-ups, each kind of step, effects, threads, gold, skipping, saving and Reset Travel.
  - `tests/e2e/phase8.test.js`: rewritten for the new events, with a new section that plays each kind of step on screen at the laptop, full-screen and TV sizes.
  - **Compared with the old Explorer:** the side-by-side run now covers what the events didn't change (days, miles, pace, the panel, groups, Free Move, refused moves, main events, Reset Travel). The old tool's own events are closed unanswered.
- **Checked:**
  - **Against Harry's document:** a check of all 33 events found 3 small slips, now fixed: C10 now covers the whole Western Province, C3 allows Help, and T9 no longer pays for a second fight.
  - **A bug hunt** found 7 problems, all fixed and each with a test. The worst: a damaged event-in-progress record could jam the Explorer.
- **Tests:**
  - `tests/rules.html`: 753 rules tests, all passing.
  - `tests/e2e/phase8.test.js`: 80 checks, all passing.
  - `tests/e2e/phase1.test.js`: 125 checks, all passing, including the new window and the DM doc at both screen sizes.
  - Every other click-through (phases 2–7 and 9, the guide and the War Table) passes.

### Wars, the Defend Bastion event, weather films and a fairer victory rule (4 October 2026)
Harry asked for six things, and answered four rule questions (all the recommended options).
- **The archers rule stays as it is** (archers never shoot into a melee).
- **Victory** (KNOWN_ISSUES BAS-55): Harry destroyed every enemy unit in a Seize Outpost and still lost, for not holding the outpost twice. Now breaking the enemy army (60% of its Battle Value routed or defeated) wins at once, whatever the objective. A raid won that way pays its full gold.
- **Being at war** (BAS-56):
  - **Declaring war:** Queue War Action asks first, then declares (or renews) war. It costs Honour & Respect and Political Capital with that Clan at once, by army size: −3 and −30 (under 20 Battle Value), −4 and −40 (20–39), −5 and −50 (40+).
  - **At War tags:** an **At War** tag shows beside the Clan's name across the Bastion, including in lists, the log and pop-ups (not on the War Table).
  - **The Wars box** in the War Council shows each war, with **Make peace** for the DM.
  - **Peace on its own:** after 6 Bastion turns without a battle between you.
  - **Cancelling:** a War Action cancelled on the turn it was queued gives its cost back.
- **The Defend Bastion event** (BAS-57):
  - **No longer a War Action.** While at war, each Advance Bastion Turn rolls a d6 per Clan at war; on a 1 that Clan attacks.
  - **The pop-up:** "Sound the horns! Clan … warships are approaching! Defend the Ironbow!", with crossed swords. **Defend the Ironbow** leads to the three rolls, then the War Table on Harry's coast map, its terrain already painted (sea, pier, rocky shore and outcrops). **Later** waits in the War Council.
  - **Losing (or withdrawing):** 5–50% of the treasury (1d10 × 5%), and 1d4 random facilities **Under Repair** for 2 Bastion turns, this one included. They take no orders, and orders already running there wait. Cards, the map and the order list say so.
- **Weather films** (BAS-58): the Explorer's snow, rain and heat films loop over the War Table's battlefield, under the tokens. The **Weather: On / Off** button turns them off and on.
- **Tests:**
  - `tests/rules.html` runs 695 rules tests, all passing.
  - `tests/e2e/phase9.test.js` has 107 checks, all passing, including a forced attack, a lost defence, repairs, peace and the legacy comparison.
  - `tests/e2e/war-table.test.js` has 145 checks, all passing, including the weather layer and the coast map at all three screen sizes.
  - The guide's check and phase 1 pass.
- **Checked:** a final review in three areas, with each finding re-checked by a sceptic. It found 9 problems, all fixed (BAS-59), for example repairs lasting a turn too long and a war's cost being charged twice after Cancel.

### The War Table: attacking, moving the objective, the battle briefing (3 October 2026)
Harry tested phase 2 ("almost everything seems to be working perfectly") and asked for three changes.
- **Attacking any enemy** (KNOWN_ISSUES BAS-51): Harry couldn't attack an enemy that had moved next to his unit, or one it had already been fighting. The battle rules allowed it; the screen didn't make it possible. Clicking an enemy only showed its card, and a unit already in contact has no lit squares to drag to, which was the other way to set an attack up. Now, with one of your units selected, clicking any enemy (or dropping your unit on it) sets up Advance & Attack on it:
  - from where it stands when it can;
  - otherwise from the best square in reach (a shot for archers, then a Charge, then the most direct move), shown before you confirm.

  If it can't attack that enemy this activation, the table says why. Clicking an enemy with none of yours selected still shows its card.
- **The DM moving the objective** (BAS-52): while deploying, the DM's button is now **DM: adjust enemy & supplies** (or **& depot**, **& outpost**). It lets you drag the supply markers anywhere on the enemy's half, and your supply depot or the outpost as a block on its owner's half. The button turns crimson while it's on. A drop that isn't allowed says why, and a repaint keeps your placement.
- **The battle briefing** (BAS-53): after **Start Battle**, a pop-up sets out how this battle is won and lost, today's conditions and the rules in brief, built from the battle's own numbers. It fits the laptop and the TV without scrolling. The **Rules & objective** button at the top of the War Table shows it again at any time: in setup, while deploying or in battle.
- **Tests:**
  - `tests/rules.html` runs 657 rules tests, all passing. New ones cover: where a clicked enemy is attacked from; the reasons when it can't be; moving the objective, why a square is refused, and a repaint keeping the DM's placement; the button's label; and the briefing for every objective.
  - `tests/e2e/war-table.test.js` has 122 checks, all passing. 31 are new and cover all three changes and the problems found while checking them (KNOWN_ISSUES BAS-54), including the briefing's fit at 1707 × 930, 1707 × 1067 and 1920 × 1080.
  - `tests/e2e/phase9.test.js` checks the briefing in a whole war.

### The Bastion: the war mini-game, phase 2 (2 October 2026)
Harry sent the full phase 2 brief and asked for it to be built without stopping to ask, taking the recommended decision wherever there was a choice. The whole rulebook, as built, is in **`docs/WAR-RULES.md`**; every number is in one file, `tools/bastion/data/war-units-data.js`, so any of them can be changed in one place.
- **The War Room** (BAS-44): the Recruit list is Harry's seven units (Lieutenant, Archers 50, Levy Infantry 150, Line Infantry 100, Heavy Infantry 50, Light Cavalry 50, Shock Cavalry 25). Hovering over one, or reaching it with Tab, shows its stat block: Cohesion, Attack, Defence, Move, Resolve, Battle Value and Distinction, with Harry's meanings. Recruiting a unit type brings a Depleted regiment of that type back to full strength first. Old "Regiment (100)" rows fight as Line Infantry.
- **The War Turn form** (BAS-46): pick the target, the objective and the enemy force (small, established or major). The enemy army is drawn up and saved the moment the mission is picked, from the mission alone (18 / 28 / 40 Battle Value × the objective × one saved d6 variation), so changing what you commit never changes it. An intelligence estimate sits beside your own army's Battle Value. Each unit type, beast, Lieutenant and defender can only be committed once across every queued war and Military Action.
- **The battle on the War Table** (BAS-45):
  - **Setup:** choose 20 to 24 squares across; upload a battle map or use the plain board; paint its terrain square by square (BAS-48: woods, bog, rubble, dense woods, ridge, cover, deep water, cliff, bridge or ford). Terrain is saved per map, and per width.
  - **Deployment:** Begin Deployment sets both armies out, with a no-deployment strip between them. Drag your units on your own half, attach each Lieutenant to a formation, and **DM: adjust enemy** moves the enemy within its half. Start Battle locks it in.
  - **Fighting:** six rounds, one unit at a time, sides alternating. Select a unit to see where it can go; choose one of the six orders (Advance & Attack, March, Hold, Rally, Disengage, Interact), drag or click to propose the move, pick a target and see the odds, leave the d20 blank or type your own roll, and **Confirm**. **Enemy acts** plays the enemy's next unit. The battle log, a Forces tab, the objective line and the deadline stay on screen.
  - **The enemy plays to its objective:** guards stand beside supply markers, it marches on your depot or holds its outpost, closes in rather than standing off, and its archers shoot rather than walk into melee.
  - **Weather, Morale and Luck now matter all battle:** a snowstorm slows everyone, rain spoils archery, a heatwave weakens Resolve; Morale is ±2 on your Resolve checks; Luck is ±1 on your attacks and decides who acts first.
  - **DM: pause** lets you change the map or the terrain mid-battle without moving anyone or changing the scale. **Call off** works until the first unit acts (and keeps the enemy and the rolls); after that **Withdraw** shows the likely cost first.
- **After the battle** (BAS-47): the result decides everything; the old single d20 is gone. Losses follow each unit's final state (0%, 10%, 25%, 40% or 60%). A regiment that loses soldiers stays as **Depleted** and fights at reduced strength. A Defeated beast or Lieutenant rolls a d6 (killed, captured or badly wounded, wounded, or recovered), and the Military and Menagerie lists show who is away and for how long. Rewards follow the objective and the result. The **War Report** shows the opening rolls, both armies at the start and end, the key moments and every change to the Bastion. All of it is applied exactly once, and a battle can be closed and reopened at any point.
- **Harry's decisions, as he chose them:** unit sizes exactly as in his War Room list, for both sides; Call off and the War Table extras (Snap, Zoom, Fit, panning) kept; arrow keys pan the view, and move a unit only while proposing a legal move; the map can be changed before combat, and during battle only through DM: pause; token size is for display only; "you" in the Morale stories when no Lieutenant marches; your crest on your army's banner and your formations.
- **Smaller changes:** war names read "Raid vs Bacca" instead of "RAID vs Bacca", in the log and on screen. The Compendium's War Room entries now take their numbers from `war-units-data.js`, so they always match the battle.
- **Tests:** `tests/rules.html` runs 645 rules tests, all passing (new: the battle engine, the enemy's play, the War Table's helpers and the campaign side). `tests/e2e/phase9.test.js` has 89 checks, all passing, including whole wars from the War Room to the War Report on the laptop and the TV, and the side-by-side run with the old Bastion. The new `tests/e2e/war-table.test.js` clicks through the War Table on its own: 91 checks, all passing, at both screen sizes. Every earlier phase's click-through and the guide's still pass.
- **Checked:** a final review of the whole phase by six reviewers (rules, the Bastion side and saving, the War Table in use, the enemy's play, the docs, and regressions), each finding re-checked by a sceptic. 23 of 27 were confirmed; all are fixed (KNOWN_ISSUES BAS-50) or kept and listed (BAS-49).

### The Bastion: crests, beasts and the Military Action, phase 1 (2 October 2026)
Harry asked for three things in the Ironbow Bastion Manager.
- **A crest for your Clan or Brigade** (KNOWN_ISSUES BAS-42):
  - Form Clan and Form Mercenary Brigade have a **Crest (optional)** box. **Open the Clan Crest Creator ↗** opens the Crest in a new tab: design the crest, press Download PNG, come back and press **Upload crest…**.
  - The crest then shows, in a gold frame, beside the Clan's or Brigade's name in Party Identity. **Change crest…** and **Remove crest** sit under the name, and a Clan or Brigade founded before this can **Add crest…** there.
  - The picture is shrunk to 512 pixels a side when it's uploaded (the Crest's 2048-pixel PNG becomes about 50 KB), and its see-through background is kept. It's saved as `tsi.bastion.crest`, so Download Save and "Back up everything" include it, and Reset clears it.
  - The "Already open" warning no longer appears just because the Crest is open in another tab (SUI-06): it now warns only when the same tool, or the home screen, is open in two tabs, because only then can one overwrite the other's saves.
- **Beasts counted properly** (BAS-25, now fixed): five Giant Vultures are five beasts, so all five can be committed to a war. A lost war still costs one beast, and now it costs exactly one (×5 becomes ×4), not the whole row, and it's always one that marched: the last one named on the War Table, never one left at home. The war's modifier is unchanged: it still counts at most 2 beasts.
- **The war mini-game, phase 1** (BAS-41), using Harry's answers:
  - When a queued war comes due on Advance Bastion Turn, a pop-up offers **Begin Military Action** or **Later**. Later leaves it in a new **Military Actions** box at the top of the Banner & War Council panel, where Begin (or Continue) picks it up any time. **Call off** ends it with nothing won or lost; Harry didn't ask for this, so it's one of the questions below.
  - **Weather Conditions**, DC 12: pass for a clear day; fail and a Snowstorm, Rainstorm or Heatwave is picked at random, with the Explorer's weather film playing in the pop-up.
  - **Morale**, DC 12, plus 4 in a snowstorm, 2 in a rainstorm or 3 in a heatwave. Each weather has its own pass and fail story, using Harry's two examples for the snowstorm. The stories name "your Lieutenants" when Lieutenants march, and "you" (the party) when none do.
  - **Luck**, DC 10: pass +1, fail −1, with Harry's own words for a fail: "Something strange is in the air today, perhaps the Gods do not look kindly upon this needless bloodshed… (−1 modifier on all attack rolls)".
  - Then the **War Table** opens full screen inside the Bastion (the suite's top bar stays, so Home still works):
    - **Upload battle map** (up to about 4 MB), or use the plain board. The map is kept for next time.
    - The grid can be turned on and off, resized, and snapped to. Forces can be made bigger or smaller, and the view zoomed. **Full screen** puts the table on the whole screen, on the laptop or the TV.
    - The header shows the weather, morale and luck. The side panel lists your forces: each Regiment, all the committed defenders in one block, each Lieutenant and each beast, named from the Menagerie ("Giant Vulture 1"…).
    - **Begin Deployment** sets them out in a battle line on your ground, the bottom half. Lieutenants and beasts are round tokens like the Explorer's heroes; Regiments are larger rectangles; the defenders are one rectangle showing how many (×12). Drag them anywhere on your half; they stop at the midline. Arrow keys move a selected one too.
    - **Start Battle** asks first, then locks the deployment, with "The enemy will take the field here in the next build" over the enemy's half. If the battle roll is cancelled, **Roll for the battle** on the locked table offers it again.
    - Snap, Grid on/off, Zoom and Fit, panning when zoomed in, arrow keys and Clear map weren't asked for; they're the usual battlemap controls, and Harry can ask for any of them to go.
  - As Harry chose, the battle is then settled by the war's old single roll, with Luck's +1 or −1 added, and the War Report and war log also list the weather, morale, luck and deployment. Weather and Morale don't change the result yet; that's the next phase.
  - Every step is saved as it happens, so a cancelled roll, closing the War Table or closing Edge loses nothing, and nothing can be applied twice. Reopening the Bastion shows a notice when a Military Action is waiting. For a moment after each of its pop-ups opens, the buttons ignore the mouse, so a double click can't carry on into the next roll.
  - **Not built yet, as Harry asked:** enemy forces and their deployment, what the rolls do to the fighting, and the combat itself.
- **Harry's test (2 October 2026):** everything worked, except that the Lieutenants and Regiments boxes wouldn't take a number (BAS-43). It couldn't be made to fail here, but a box that was switched off (an Unsworn party can't commit them) looked just like a working one. Now a switched-off box is greyed out and says "Clan or Brigade only"; every box says how many are available; the arrows stop there; and a number is only checked once it's typed, never rewritten mid-typing.
- **Tests:** `tests/rules.html` runs 371 rules tests, all passing (new: beasts by number and one beast lost; the Military Action's forces, each roll at its own step and only once, the storms and their Morale DCs, the stories, Luck on the battle roll, the war log's notes, Call off, saving part-way, damaged saves; crest and War Table saves; the War Table's board, clamping to your ground, snapping and battle lines; the tab warning's rule). `tests/e2e/phase9.test.js` has 77 checks, all passing, including the whole Military Action from Advance Bastion Turn to the War Report, the War Table on the laptop and the TV, uploading a map and a crest, Reset and backups. The side-by-side run with the old Bastion still matches step for step, apart from the war's extra log lines and Luck's +1 on its roll. `tests/e2e/phase1.test.js` has 73 checks, all passing, including the new tab-warning checks.

### The Crest remembers your last design (1 October 2026)
Harry asked for the Crest to remember his last design (it saved nothing, as the old tool didn't).
- **Saved as you go:** every change is saved: the name, every choice, colour and slider, and the motto. Closing the Crest, going Home or closing Edge keeps it, and it comes back next time.
- **Like the other tools that save:** Export and Import in the top bar, a "Saved ✓" status, and it's included in "Back up everything" and Restore. Import asks before replacing the design, and refuses a damaged file or another tool's file.
- **One design:** it keeps your last design only. Random Crest and Reset replace it, without asking, as before. Export keeps a copy as a file if you want to come back to one.
- **Safe loading:** a saved choice that no longer exists (such as the old Kraken sigil) goes back to its default and the rest is kept; a save that isn't a design at all is set aside, never deleted, and the Crest starts fresh (KNOWN_ISSUES CRS-15).
- **Tests:** `tests/rules.html` runs 325 rules tests, all passing (4 new: a design comes back exactly, unknown or out-of-range settings fall back, non-designs are refused, damaged imports are refused). `tests/e2e/phase2.test.js` has 68 checks, all passing (13 new: saving as you go, reopening, Home and back, Export, Import refusing a damaged or another tool's file, asking first, replacing, Back up everything, Reset, an old sigil, and a damaged save). The guide's Crest and saving sections are updated.

### The Crest's sigils, redone from real heraldic art (29 September 2026)
Harry liked the rework but found the sigils still not professional enough, and chose Option 1: find professional, free-to-use heraldic artwork and plug it in, keeping the colours changeable.
- **All 20 sigils replaced** with drawings from real heraldry books, traced into outlines the Crest can recolour. Most come from A. C. Fox-Davies' *A Complete Guide to Heraldry* (1909), so they share one engraved style. The lion is Inductiveload's tracing after Jiří Louda, the unicorn is John Vinycomb's (1906), the fleur-de-lis is Jérôme de Bara's, and the crown is a public-domain coronet. All are public domain, and each is credited in the data file, `licences/README.md` and `docs/ASSETS.md`.
- **The colours still change.** Each sigil has four layers: its body in the sigil colour, its accent parts, white eyes and teeth, and its linework in the line colour. The linework turns a lighter shade on a dark sigil, as heralds paint a black beast.
- **Accent parts on 18 of the 20**, marked by hand, following heraldry's custom of colouring claws, tongue and so on separately:
  - the lion's claws and tongue;
  - the eagle's beak, tongue and talons;
  - the stag's antlers and hooves;
  - the boar's tusk, mouth and hooves;
  - the wolf's and bear's tongues;
  - the unicorn's horn and hooves;
  - the dragon's wing;
  - the griffin's beak and fore-talons;
  - the raven's beak and legs;
  - the dolphin's fins;
  - the fleur-de-lis's band;
  - the crown's jewels and cap;
  - the tower's gate;
  - the swords' hilts;
  - the rose's seeds and barbs;
  - the anchor's stock;
  - the oak's trunk and roots.

  The Sun and Crescent are one colour.
- **Changes to the list:**
  - **Kraken → Dolphin.** No free heraldic kraken drawing exists. The heraldic dolphin is the traditional sea beast, fanged and finned.
  - **Castle → Tower**, a single battlemented tower with its gate.
  - The stag, boar, wolf and unicorn are now **whole beasts** rather than heads.
  - The names now use heraldry's terms: Stag Trippant, Boar Passant, Wolf Passant, Dragon Segreant, Griffin Segreant and Bear Passant.
- **How they were made (for future sessions):**
  - Wikimedia's file server refused downloads from the sandbox, so each drawing was fetched as a large picture from Commons' own renderer, then traced with potrace.
  - The data is outlines only: nothing loads from the internet, and no picture files were added.
  - The tools and each sigil's settings are in `tools/crest/dev/`, which the suite doesn't load. Rebuilding from the same pictures gives an identical file.
  - `tools/crest/sigil-kit.js`, the kit that drew the first sigils, is removed.
- **Size and speed:** `data/sigils.js` is 0.9 MB. Changing a colour or sigil redraws in about 50 ms.
- **Tests:**
  - `tests/rules.html` runs 321 rules tests, all passing. New checks: every sigil's layers are plain outline data, every sigil has a credit, a public-domain licence and a Commons link, and the accent colour reaches the picture.
  - `tests/e2e/phase2.test.js` passes all 55 checks, including PNG downloads and every tab on the laptop and the TV.

### The Clan Crest Creator rework (29 September 2026)
Harry asked for a complete rework: the old tool's shields, colours and sigils were never up to standard. Everything visual was started again; the clan name, random names, mottos, Random Crest, Reset and the transparent 2048 × 2048 PNG download work as before.
- **17 real shield shapes**, chosen after comparing other shield creators (Heraldicon, DrawShield) and heraldry references on shield shapes by country and period: Heater, Norman, Kite, Iberian, Old French, Modern French, English, Bohemian, Swiss, German (the Tartsche, with its lance notch), Italian (the "horse's head"), Polish, Renaissance, Pavise, Lozenge, Oval and Round. The outlines are Heraldicon's public-domain ones, copied exactly and credited (`licences/README.md`). Each has a tooltip saying what it is.
- **20 new sigils**, drawn for the suite in a traditional heraldic style (one colour with dark outlines and inner lines, and an accent colour for claws, tongues, horns and gems). *Replaced the same day by traced heraldic artwork (see above).*
  - **Beasts:** Lion Rampant, Eagle Displayed, Dragon, Griffin, Bear, Raven, Kraken, and the heads of a Stag, Boar, Wolf and Unicorn.
  - **Emblems:** Fleur-de-lis, Crown, Castle, Crossed Swords, Rose, Sun in Splendour, Crescent Moon, Anchor and Oak Tree.
  - **Size:** at 100% a sigil now fills the largest space inside the rim, centred on the shield's balance point. The slider runs from 40% to 150% (the old maximum was far too small). There's also Up or down, Facing (left or right) and Relief (raised or flat).
- **Colours:** 63 named colours in eight families (the heraldic tinctures Or, Argent, Gules, Azure, Vert, Purpure and Sable with their shades, the stains Tenné, Sanguine and Murrey, blacks and greys, and the three gods' colours), plus **Any colour** for your own. Nine colour slots: field, second field colour, band, sigil, claws/tongue/gems, sigil lines, rim, motto ribbon and lettering. **20 colour schemes** set them all at once and keep heraldry's rule of tincture (the old tool had 12 palettes of three colours).
- **The field:** 14 divisions (Plain, Per pale, Per fess, Per bend, Per bend sinister, Per chevron, Quarterly, Per saltire, Gyronny, Paly, Barry, Bendy, Chequy, Lozengy) and 12 bands (None, Chief, Fess, Pale, Bend, Bend sinister, Chevron, Cross, Saltire, Pall, Pile, Bordure).
- **The finish:** a bevelled metal rim (None, Fine, Plain, Double, Studded or Rope, any width, any metal), light (Flat, Soft sheen or Enamel gloss), texture (None, Parchment, Grain, Brushed metal or Linen), and a soft shadow.
- **The motto:** a curved ribbon with folded swallowtail ends, a scroll with rolled ends, or a framed plaque; the lettering shrinks so any motto up to 30 letters fits.
- **The controls:** five tabs (Shield, Field, Sigil, Colours, Motto) with picture tiles instead of drop-down lists, and a colour palette on every colour button. Everything fits the laptop and the TV on every tab.
- **Fixed on the way:** a pasted hidden character in the motto no longer stops the download (CRS-10). The Round shield's stray line (CRS-04) and the Etched texture (CRS-08) are gone with the old shapes and textures.
- **Tests:** `tests/rules.html` now runs 319 rules tests, all passing, including every sigil fitting inside every shield's rim (340 pairs). `tests/e2e/phase2.test.js` has 55 checks, all passing: every tile, chip, slider, the colour palette and schemes, Random Crest, Reset, PNG downloads, and every tab on the laptop and the TV. The guide's Crest section is updated, and its test and phase 1's still pass.

### The how-to guide (28 September 2026)
- **`guide.html`**, beside `index.html`, linked as **How-to guide** at the foot of the home screen. It's a plain page in the suite's look, works with no internet, and prints black on white (Ctrl + P).
- **What it covers:**
  - opening the suite, the home screen and the top bar;
  - your two screens (moving windows to the TV, F11, the players' windows, the Explorer's full screen);
  - saving and backups;
  - each of the eight tools at the table, in a few lines, with a link that opens it;
  - what to do if something goes wrong;
  - how to get changes made.
- **Found while writing it:** in Edge's engine, every copy of the suite on a computer shares **one set of saves**, wherever its folder is (checked in the test browser, the same engine). Moving or renaming the folder keeps the saves, but a new version downloaded to try out opens the real saves too. The guide and the README tell Harry to back up first.
- **Tests:** `tests/e2e/guide.test.js`, 20 checks. It opens the guide from the home screen at every screen size with the internet off, prints it, and follows every link. It also checks every button or label the guide names in bold really exists in its tool. The shell's click-through (phase 1) still passes.

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
  - A second tab with the same tool, or the home screen, shows an "Already open" warning.
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
**Harry tries the Bastion's new screen** (Build 2) on the laptop and the TV: the grid, building from a slot, a facility's panel, the panels along the bottom, and the War Council's lock. Then says what to change: the tile size, the panel buttons' names or order, what the top bar shows. **Build 3 (identity and the crest)** starts when Harry says go: the Brigade archived, a crest at any time from the Crest Creator, and the badge and Party Identity reworked.

**Harry tries the Bastion in days at the table** (Build 1), with the Explorer on the laptop and the Bastion on the TV: make camp, watch the days pass and the Ironbow's word arrive, and play an order, a trade agreement and a war through. Then say: which order lengths to change (each is one number in `tools/bastion/data/facilities-data.js`), and anything about the word pop-ups. **Build 2, the new map-centred screen,** starts when Harry says go; Build 3 (identity and the crest) follows.

**Harry tries the DM doc at the table**, with the Explorer and the Bastion open (in one window or two), then says what to change: what it shows, the order, the wording, or anything to add (for example the Bastion's treasury).

**Harry tries an Explorer fight at the table**, with the tracker's Battlemap on the TV, then says what to change. The likely things are the enemy groups or their names (in `tools/explorer/data/fights-data.js`), the starting places, and the choices listed under Open questions. **Battle maps:** Harry's 16 are in. Say if a region should use a different look (one word each in `looks`), or if a starting place sits badly on a map; more maps per place, or a rocks map for Bleakharbour, can be fitted the same way.

**Harry tries the new Explorer events at the table**, then says what to change: how often they come (30% and 25%), any DC or amount (all in `tools/explorer/data/journey-events.js`), and the choices listed under Open questions. His document suggests about 25 more map-specific events, written in the same style, once he's happy with it.

**Harry tries a war at the table.** Play a battle or two of each objective (Raid, Skirmish, Defend Bastion, Seize Outpost) on the laptop and the TV, then say what to change: any number in `tools/bastion/data/war-units-data.js` (unit stats, enemy budgets, losses, recovery, rewards), the clans' armies, the beasts' profiles, or how the enemy plays. Harry has said fuller terrain rules could be a phase 3; nothing else is planned until he decides. The kept behaviours he's most likely to want changed are listed under Open questions below, and each tool's full list is in `docs/KNOWN_ISSUES.md`.

## Open questions for Harry

Each tool's questions are needed before that tool's phase. The full wording and defaults are in `docs/PLAN.md` section 6.

- **Clan Crest Creator (phase 2, reworked 29 September 2026):** answered (K1–K4).
  - **Sigils: answered (29 September 2026).** Harry reviewed the traced sigils and wants all twenty kept exactly as they are: the same sigils, the Dolphin in place of the Kraken, the Tower in place of the Castle, and the same accent parts. Don't swap, add or recolour any without his say-so.
  - **Remembering the design: answered (1 October 2026).** Harry asked for it to remember his last design; done (see Done).
- **Pelagosi Puzzle Trials (phase 3):** answered (P1–P4).
  - When you have the five Tidal sounds, give them to a session and ask it to add the Pelagosi sounds.
- **Notice Board (phase 4):** answered (N1–N5).
- **Heartwood Ritual (phase 5):** answered (R1–R10).
- **Arenas (phase 6):** answered (A1–A9).
  - Three kept behaviours you're likely to notice at the table: a cancelled turn still uses up that player's go (ARN-14); the gold under the arena catches up only after the next change (ARN-25); and changing the Arena or Round list mid-round restarts it without asking (ARN-27). Say if you'd like any changed.
- **Combat Tracker (phase 7):** answered (C1–C11).
- **The Explorer's new events (6 October 2026): choices made for you, to change if you like:**
  - **The Ferry Puzzle (T5)** comes only on the four maps with a river drawn on them: Midland, Northern (East), Northern (West) and Southern (West).
  - **The Region list** chooses the province's events, and the clan, chief and temple in their words. Events tied to one map also need that map loaded, and an uploaded map gets the Region's events.
  - **Fights:** each one suggests an enemy group for levels 7 to 16, from the 5e basic monsters (now also set up in the Combat Tracker: see the next item).
  - C5 Listen: every hero listens; anyone not ticked as failed gains Rooted.
  - C12: fleeing the wreckers' fight means the ship isn't saved (no thread, no Karr honour note).
  - C8: the Exhaustion lasts until the next Make Camp (a long rest removes a level).
  - C3: the rumour thread opens even when the tale fails ("she shares the rumour anyway"); Inspiration goes to the hero who rolled.
  - T8: after a second wrong answer the hollow stays shut, even if everyone passes the Strength save.
  - Sea-Chilled names two different banes (T15: Constitution saves; T16: Strength and Dexterity checks), as in the document.
  - C2: a plain failure to cheat means a normal game, no advantage.
  - C11 "camped near the shore" and the "near Redport / Wolfhaven / Slade's Muster" events aren't checked by the tool: they can come up anywhere on their map.
  - Fights the document gives no reward for (T13 after a failed "Demand a cut", C9, C10 keep watch) pay nothing extra; Fled gives nothing.
  - The bane names Strained (T18) and Slept Badly (C5) are mine; the document didn't name them.
  - **"Roll an event now":** a campfire event drawn while the party is on the road waits for tonight's camp. A travel event drawn by hand counts as that day's travel event.
  - **Follow-up windows:** F1 is days 1 to 3 after T1, F2 is exactly 7 days after T14, and F3 is days 2 to 5 after C12. If something else takes the camp on a follow-up's last day, it waits one more day.
  - **The old "Funnel" tag** was the old events' type label: a Funnel event offered several choices that narrowed to one outcome, and an Instant one had a single Continue. The new events show their skills line instead (for example "Insight, then Intimidation, Stealth or Persuasion").
  - **Lore marked ⚑ in your document** is built as written: the Wardens as road-keepers (T1), what each god's blessing does, and the heartbeat vision (C5, described by the DM). T9 waits, switched off, until Rootbound creatures can appear before the finale.
- **Explorer fights in the Combat Tracker (7 October 2026): choices made for you, to change if you like:**
  - **Names:** where an event names someone, the token does too, with the closest SRD stat block: the Debt Collector (a Spy, C9), the Old Wolf (a Dire Wolf, C6), the Raider Chief (a Gladiator, C10) and the two Toll-men (Thugs, F1). The rest use the SRD names (Bandit, Veteran and so on).
  - **The Rootbound Husk** (T9, switched off) has the Heartwood Ritual's 35 hit points, and no Armour Class or initiative bonus, because the Ritual gives none.
  - **Which map:** T2 at the ford; F1, and C10's ride through the night, on the road (or in the cove, near the sea: Harry's choice); C6, C9 and C10's keeping watch at the camp; T13 and C12 in the cove; T9 on the road.
  - **Which look:** the Northern Province uses the green look with Midland and the East (Telluria's lands); the misty look, with its dark pines, could suit Nightwood's country instead. The East Isle is misty (Greymyr); the North Isle cold.
  - **Rivers and coast:** "near" is 2 hexes (12 miles), chosen so every port town counts as coastal; T2 uses the position of the hero who just moved (or the selected hero, for Roll an event now).
  - **Where they start:** the pack circles the camp in C6; the debt collector and his friends are already by the fire in C9; the raiders come from the west in C10's keeping watch; the T2 ambushers wait across the ford and in the woods on both banks.
  - **Loading a fight** replaces only the monsters: the PCs and NPCs stay, with their hit points, and everyone's initiative is cleared.
  - **Surprised heroes** are matched to the tracker's PCs by name. "Kaelen" finds "Kaelen" or "Kaelen Ashford"; a hero with no PC of that name is listed so you can mark them by hand.
  - **The report** comes when every monster in the encounter is down, including any you added yourself, and only once.
  - **Snap:** loading a fight turns the grid and Snap on, and sets tokens to one square wide. Tokens sit on grid corners, as Snap puts them.
- **The DM doc (6 October 2026):**
  - **Where it first opens:** near the top right, where it covers some of a tool's buttons until moved.
  - **Full screen:** it isn't shown inside a tool's own full-screen view, such as the Explorer's map on the TV.
  - **Its contents (7 October 2026): choices made for you, to change if you like:**
    - **Orders pending** and **Next word from the Ironbow** (8 October 2026) replace the two Bastion turn tiles. The next word is the next day the Bastion has news due (an order, building, an agreement ending, a repair, a recovery, a sea route's roll, a war's attack roll or the Bastion event), as the Explorer will show it at camp.
    - **Party level** is 7, the Bastion's starting level, until the Bastion has saved; the tile says "Bastion not saved yet".
    - **Where the party is** follows the Explorer's Region list, as the events do, not the loaded map.
    - **Where it first opens:** near the top right, where in the Explorer it covers Make Camp until it's dragged aside (it remembers where you put it). Say if it should first open somewhere else, such as the bottom left.
    - It only reads the two tools' saves and never writes them, so no guard against two windows saving over each other is needed.
    - **Gold and Threads (added the same day):** the gold is the Explorer's event gold only (not the Bastion's treasury). "Next follow-up" is the one whose window ends soonest, the order the Explorer brings them in. Each thread also shows what resolving it gives, which the Explorer's own list keeps for its "are you sure?".
- **Explorer (phase 8):** answered (E1–E16: all the defaults).
  - E16: the pins turned out to have been placed in the Explorer's full-screen view, not a maximised window, and were converted that way. Please double-click `tests/pin-check.html` and check all 33 sit on their towns; tell the next session about any that don't.
  - Kept behaviours you're likely to notice: the Fog of War button reads Off after reopening (EXP-19); the Region list doesn't follow the loaded map (EXP-20); and pressing Resolve with an empty roll box counts as a roll of 0 (EXP-28). Say if you'd like any changed.
- **Bastion (phase 9):** answered (B2: the delegation's own two rolls set Political Capital; the defaults for the rest).
  - Kept behaviours you're likely to notice: Hall upgrades cost nothing (BAS-22); a consortium pays its income twice every 7 days, once as a contract and once as a route (BAS-24); "Cleared warehouse." appears twice in the Day Log (BAS-31); and a Host Delegation's result box has an empty line where its summary should be (BAS-34). Say if you'd like any changed.
  - **The new screen, Build 2 (8 October 2026): choices made for you, to change if you like:**
    - **An Orders panel:** the plan put pending orders in each facility's panel; they're there, and clicking the top bar's Orders count also opens them all together (War Actions too, which have no facility).
    - **Clicking the Facilities count** opens Construction, so Clear extra builds can be reached even when every slot is full.
    - **The badge** shows "Party Identity", your Clan's or Brigade's name, and its crest. Build 3 changes what it shows.
    - **The panels** open one at a time. Esc or Close closes them, and the focus goes back to the tile or button that opened them.
    - **The tiles** are 92 pixels square on both screens; the painting gets the rest of the room.
    - **The War Council** stays unlocked while a war, a waiting War Action or an attack is going on, even if every soldier has gone, so an attack can always be fought.
  - **The days overhaul, Build 1 (8 October 2026): choices made for you, to change if you like:**
    - **Order lengths** are the plan's first proposal (section 2 of `docs/BASTION-OVERHAUL.md`), as you said; change any after playing.
    - **Trade Agreement weeks:** the roll's tier still adds or takes off weeks (+2 to −2, at least 1 week), as it did with turns. Say if the weeks chosen should be exact.
    - **Three rulebook events** still say "can't be used on your next Bastion turn" (BAS-63). Say if they should read "for the next 7 days", and whether the Bastion should then block that facility's orders.
    - **Finish Day** only shows when a day was left part-way; the Bastion otherwise passes days by itself.
    - **An Explorer-only file** saved before the change still imports, into the Explorer alone; a Bastion-only one is refused.
    - **The Watchtower's Patrol** covers an attack on the day it completes and the 7 days after.
  - **The war mini-game, phase 2: built (2 October 2026).** Harry sent the full brief and asked for the recommended choice wherever there was one, so each of these was decided that way and is open to change. Where each lives in `docs/WAR-RULES.md`:
    - The enemy's size comes from the mission alone (section 2); it deploys itself in its own half, and DM: adjust enemy can move it (section 5).
    - Weather, Morale and Luck in battle (section 3): a snowstorm −1 Move, a rainstorm −2 on ranged attacks, a heatwave −1 on Resolve checks; Morale ±2 on your Resolve checks; Luck ±1 on your attacks and who acts first. The opening rolls themselves stay plain d20s; say if Lieutenants should add to Morale.
    - Call off until the first unit acts, then Withdraw (sections 3 and 7). The War Table's extra controls are kept; arrow keys pan, and move a unit only while you're proposing a legal move.
    - "You" in the Morale stories when no Lieutenant marches: kept. Your crest is on your army's banner and your formations.
  - **Archers and melee: answered (4 October 2026).** Keep it as it is: archers never shoot while in melee, or into a melee.
  - **Wars and the Defend Bastion event (4 October 2026): choices made for you, to change if you like:**
    - The attacking army's size is rolled on a d6: 1–2 a small local force, 3–5 established, 6 major.
    - Winning a defence uses the usual Defend Bastion rewards, including +6 Political Capital with the attacking Clan, which may read oddly.
    - Every force that's free defends. Forces held by a waiting War Action don't. Only one attack can wait at a time.
    - A War Action cancelled on the day it was queued gives its cost back; later, the cost stays.
    - The Watchtower's Patrol gives the defenders Advantage, as its card says. The War Table only reminds you: roll two d20s at the table and type in the higher.
    - The At War tag also appears inside headings and story text, such as "Sound the horns! Clan Bacca [At War] warships…". Say if you'd like fewer places.
    - Nobody has yet seen the weather films play on the War Table (the test browser can't play them). Say whether they're too strong or too faint on the TV.
  - **Worth a look before playing much:**
    - **Defenders:** Harry's brief set unit sizes at 150 for Levy Infantry, so the brief's "20 per regiment" headcount was scaled up: 75 or more defenders form a detachment, fewer support a regiment (+1 Cohesion per 5, up to +2). Two choices went beyond the brief: defenders left over once every regiment has its support form one small detachment, however few (so an Unsworn party with only defenders and beasts can still fight); and **unarmed defenders fight at −2 Attack**, where the brief said they should give support rather than fight as ordinary infantry. Say if either should change.
    - **The clans' armies and variant units, and the beasts' profiles and traits,** are proposals (sections 1 and 2). Only Slade's colours (a white stallion on teal) are established; say if any clan should fight differently or have its own colours.
    - **Every number is a starting value:** the enemy budgets (18 / 28 / 40), the objective multipliers, the losses table (0 / 10 / 25 / 40 / 60%), the recovery d6 and the rewards.
    - **Rivers on a slant:** units on opposite banks whose squares touch at a corner are still in melee (BAS-49). Say if a river should keep them apart.
    - **Raid guards:** until your carriers could win the raid, each supply marker keeps a guard beside it and only the spare enemy units chase your carriers.
  - Kept behaviours from phase 2 you may notice are in `docs/KNOWN_ISSUES.md` BAS-49: one battle-map picture shared by all battles, guards sometimes in front of a marker and sometimes behind, a battlefield width with no painting of its own, the small letters on tokens, and a very quick second Confirm being ignored.

## Notes for future sessions
- **Explorer fights → Combat Tracker (7 October 2026).**
  - **The data:** fights are in `tools/explorer/data/fights-data.js`; a fight step names one with `encounter` (and `surprise: 'failed'` for an ambush). `tools/explorer/fights.js` builds the hand-off; `tools/encounter/rules.js` (`handoffProblem`, `loadHandoff`, `handoffWon`, `startPositions`, `handoffVtt`) loads it.
  - **How the windows talk:** each window has its own copy of the saves, read when it opens, so the two windows talk through `TSI.handoff` (`shared/js/handoff.js`): small messages in the browser's shared storage, heard by the other window at once. `TSI.store.fresh(key)` reads another tool's save as it is now.
  - **The battle maps:** Harry's art, named `<setting>-<look>.png` (`ford`, `camp`, `cove`, `road` × `green`, `warm`, `cold`, `misty`). The starting places and avoid areas in the data file are set for these layouts on a 24 × 18 grid; a new picture with a different layout needs them set again. The Battlemap accepts a saved map path only inside `tools/encounter/assets/battlemaps/` (`isBundledMap`).
  - **Tests:** `tests/rules/fights.test.js` and `tests/e2e/fights.test.js`.
  - **Rivers and coast:** `tools/explorer/data/terrain-data.js` is made by `docs/dev/make-terrain.py` (Python with Pillow, NumPy and SciPy). If a map picture changes, or a mark is wrong, add a correction to the script's FIXES and run it again. An event can ask for `near: 'river'` or `near: 'coast'` in its `where`, and a fight for a `coast` setting.
- **The Clan Crest Creator (reworked).** Shield outlines are in `tools/crest/data/shields.js`, exactly as Heraldicon drew them in their own units; `geometry.js` scales them into the picture, finds each shape's balance point, and fits a sigil inside the rim. Sigils are in `tools/crest/data/sigils.js`: public-domain heraldic drawings traced into four layers of outlines (body, accent, white, lines), 1000 units on their longer side. They're made by the scripts in `tools/crest/dev/` (see its README); to change or add one, edit its settings in `sigils.tsv` and rebuild, rather than editing the data file by hand. The rules tests check every sigil fits every shield. Colours and schemes are in `data/crest-data.js`; the tests check every scheme uses named colours and keeps the rule of tincture.
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
- **The Bastion's war (phase 2):** `docs/WAR-RULES.md` is the rulebook and `tools/bastion/data/war-units-data.js` holds every number; change numbers there, not in code. The code is in layers, each with its own tests in `tests/rules/`:
  - `war-battle-rules.js` (`TSI.bastion.battleRules`): the battle itself, as pure functions on a plain saved battle object (squares `{c, r}`, row 0 the enemy's edge).
  - `war-ai.js` (`TSI.bastion.warAI`): the enemy's choices; pure and repeatable, never `Math.random`.
  - `war-campaign-rules.js`, adding to `TSI.bastion.rules`: forces, commitments, missions (drawn with seeded dice, so the side-by-side run with the old Bastion stays in step), the Military Action, and everything after the battle (`finishBattle`, applied once).
  - `war-table-rules.js` and `war-table.js` (`TSI.bastion.warTable.open(options)`; the header comment lists its options): the War Table screen. It owns the saves `tsi.bastion.warMap`, `tsi.bastion.warTable` and `tsi.bastion.warTerrain`; the battle itself is saved in its Military Action through `onChange`, and carries its own ground (`battle.ground`) so other battles' maps and terrain can't change it.
  - `tests/e2e/war-table.test.js` clicks through the War Table on its own (`tests/war-table.html`); `phase9.test.js` plays whole wars through the Bastion, and its `answerAll` answers the War Table too.
- **The Bastion's day engine (8 October 2026).** `state.day` is the last day the Bastion passed; `anchored` says it has read the Explorer's day. `R.clockAction(state, explorerDay)` says what to do (`anchor`, `pass`, `shift` after Reset Travel, or `none`); a day runs `R.startDay` → sea routes → `R.finishRoutes` → due orders → `R.rollWarAttack` → `R.finishDay`, saved after each step in `state.dayInProgress`, so a closed window resumes rather than repeats. Every clocked thing stores a day (`dueDay`, `readyDay`, `endDay`, `nextDay`, `untilDay`…); `R.shiftDays` moves them all. The lengths are in `tools/bastion/data/bastion-data.js` `time`, each order's `days` in `facilities-data.js`, and the war's in `war-units-data.js`. `TSI.campaign.ironbowNews` (`shared/js/campaign-rules.js`) writes "The Ironbow sends word…" for the Explorer from the Bastion's save, read-only. In tests, `TSI.bastion.debug.clock()` makes the Bastion read the Explorer's day at once, and `phase9.test.js`'s `days(page, n)` passes days by writing the Explorer's save. The side-by-side comparison with the old Bastion is retired (BAS-61). `TSI.bastion.debug.change(fn)` sets up a check by changing the Bastion directly.
- **The Bastion's screen (Build 2).** Every panel's contents are built once and kept up to date by `renderAll`, open or not; `openPanel(id, spec)` shows one in a pop-up (spec `render` for those built on opening: a facility's, Construction, Orders). Tests reach a control through its panel with `TSI.bastion.debug.reveal(dataTest)`, which presses that panel's own button (phase9's `panels(page)` does this before every click or read). Pop-up helpers in tests look for `.tsi-modal:not(.tsi-bas-panel)`, since a panel is a pop-up too. The shared tooltip is `TSI.tooltip` (`bind`, `bindFocus`, `show`, `hide`).
- **The campaign save:** `shared/js/backup-rules.js` `CAMPAIGN` lists the Explorer and the Bastion; their Export and Import go through `TSI.backup` as one file, and each tool's rules register their import check in `TSI.importChecks`. They stay two records in the browser, one per tool, so two windows never save over each other.
- **Keep the guide up to date:** when a tool's buttons or labels change, update `guide.html` too. `tests/e2e/guide.test.js` fails if the guide names a button that no longer exists.
- **Harry's saves and test copies:** every copy of the suite on Harry's laptop shares one set of saves in Edge. A branch he downloads to test opens his real saves, so each pull request's checklist should start with "Back up everything first".
- **Sound in tests:** the test browser can load the sounds but nobody hears them. The Pelagosi test records which sounds start and when; hearing them is on Harry's checklist.
