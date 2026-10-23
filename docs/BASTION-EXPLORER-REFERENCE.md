# The Ironbow Bastion and the Scarlett Isles Explorer: how they work and how they connect

> **What this document is.** A reference for an AI helping Harry Hudson plan future features and better links between these two tools. Harry is the campaign's author and designer, not a developer.
>
> **How current it is.** It describes the code as it stands on **12 October 2026** (branch `claude/gallant-ramanujan-klwz70`). Since Build 3 (8 October) the code has changed in one place: the fix SUI-29 to `shared/js/store.js` (§3.2). Harry's new Bastion map art is in the repo too (`bastion-new-art/`), but nothing in the code uses it yet (§11). This is after Builds 1–3 of the Bastion overhaul:
> - the Bastion counts in **days**, not turns, and follows the Explorer's day;
> - its screen is centred on the map;
> - it has a crest and a Party Identity panel;
> - the Mercenary Brigade is archived.
>
> **Ground rules for the text.** Everything here is fact; nothing is a proposal. Where the project's own docs disagree with the code, this document follows the code and lists the difference in Appendix B. File and line references are there for a later reader with repo access; the document makes sense without them.

---

## 1. What this is

*The Scarlett Isles: D&D Tool Suite* is a set of eight browser tools for Harry's Dungeons & Dragons 5th edition campaign. It runs offline: you open it by double-clicking `index.html`. Two of the tools carry the campaign from session to session:

- **The Scarlett Isles Explorer** is the party on the road. It has hex maps of the Isles, hero tokens the DM drags across them, a daily mile limit, weather, travel and campfire events, and fights that are sent to the Combat Tracker.
- **The Ironbow Bastion Manager** is the party's island stronghold, the Ironbow. It has facilities that take orders, a treasury and warehouse, Clan politics, sea trade, a party identity and crest, and wars fought on its own War Table.

The Explorer owns the campaign's only clock: its day counter, which **Make Camp** moves on by one. The Bastion follows that day and plays out each new day itself. Apart from the day, the two tools pass very little between them. This document describes each tool, then sets out exactly what passes between them.

### Glossary

| Term | Meaning here |
|---|---|
| Suite | All the tools behind one home screen (`index.html`). Each tool opens as `index.html?tool=<id>`, one tool per page. |
| Explorer | The Scarlett Isles Explorer (`?tool=explorer`). |
| Bastion, the Ironbow | The Ironbow Bastion Manager (`?tool=bastion`). In the story, "the Ironbow" is the Bastion's name. |
| DM | The Dungeon Master: Harry, running the tools at the table. |
| Day | The Explorer's `travel.day`, the campaign's only clock. It starts at 1. |
| Make Camp | The Explorer's main button. It ends the travel day, and the day goes up by 1. |
| Reset Travel | An Explorer button that puts the day back to 1. |
| Anchor | The first time the Bastion reads the Explorer's day, it jumps to that day without playing any of the days in between. |
| Pass a day | The Bastion's day engine plays one day in full: shipments, sea routes, orders, the war attack roll and the event. |
| Part-way day | A day the Bastion started but didn't finish. It is saved, and carries on when the Bastion next runs. |
| Facility | A building in the Bastion. There are 18 kinds: 5 starting facilities, always built, and 13 that can be built. |
| Construction slot | A space for one buildable facility. A Bastion has 0 to 6, depending on party level. |
| Function, order | A function is one of a facility's actions, for example Barracks: Recruit Defenders. Issuing it creates an order, which takes a set number of days and completes on its due day. |
| Treasury | The Bastion's gold (`treasuryGP`). |
| Party gold | The Explorer's running total of gold won from events (`journey.gold`). It is separate from the treasury. |
| Party level | 1 to 20. It can only be set in the Bastion; the Explorer reads it for fights. |
| Clan | One of the seven ruling families: Blackstone, Bacca, Farmer, Slade, Molten, Rowthorn, Karr. The party can also found its own Clan. |
| Region | One of the Explorer's seven areas: Northern Province, Midland Province, Eastern Province, Southern Province, Western Province, The North Isle, The East Isle. Each has a Clan, a chief and a god. |
| Political Capital (PC) | The Bastion's standing with each Clan, from −100 to +100. |
| Honour/Respect (HR) | A second per-Clan score, from −5 to +5. The DM sets it; declaring war also costs some (given back if that War Action is cancelled on the day it was queued). |
| Support | Worked out for each Clan from PC and HR, 0 to 100. |
| Clan Honour | The party's own honour once it has founded a Clan, 0 to 100. It starts at 40. |
| Favour of the Gods | Three bars from 0 to 100%, one each for Telluria, Aurush and Pelagos. |
| Hall of Emissaries | The diplomacy facility: trade deals, delegations, summits, writs and consortiums. |
| Contract | A Trade Agreement, Writ of Authority or Trade Consortium record. Each pays a shipment of gold every 7 days. |
| Trade Network, sea route | Opened by a Trade Consortium. Each route sails every 7 days. |
| Council Ledger, dispute | Where disputes from catastrophic route losses wait for the DM's ruling. |
| Unsworn | The party's identity before it founds a Clan. |
| Crest | The party's picture, shown on the Bastion's badge and on the War Table. |
| War Action | A war order the DM queues in the War Council. It musters 3 days later. |
| Military Action | A War Action that has mustered, or a Clan's attack. It has three opening rolls, then a battle on the War Table. |
| War Table | The Bastion's full-screen battle board. |
| Defend Bastion | The battle that follows when a Clan at war attacks the Ironbow. |
| Under Repair | A facility put out of action for 14 days after a lost Defend Bastion. |
| Battle Value (BV) | A unit's or army's fighting worth. |
| "The Ironbow sends word…" | The title of two separate pop-ups: a forecast in the Explorer at Make Camp, and the actual results in the Bastion. |
| Active Effect, Thread, Follow-up | Explorer reminders. An Active Effect is a lasting condition; a Thread is an open story hook; a Follow-up is an event that a Thread brings back later. |
| Travel (T), Campfire (C) and Follow-up (F) events | The Explorer's random journey events, known by their codes (T1, C4, F2 and so on). |
| Hand-off | A message between tools, kept in the browser's `localStorage`. There are three: a fight sent from the Explorer to the Combat Tracker (`tsi.suite.handoff`), the Combat Tracker's report back to the Explorer when every enemy is down (`tsi.suite.handback`, `{ id, result: 'won', at }`), and a crest sent from the Clan Crest Creator to the Bastion (`tsi.suite.handoff-crest`). |
| DM doc | A floating panel that summarises the campaign from both saves. |
| Campaign save | One JSON file holding the Explorer's and the Bastion's saves together. |
| Tab guard | A small regular signal from each open window that lets the suite tell which tools are open in other windows. |
| Store | The suite's saving layer: the browser's built-in database (IndexedDB) named `tsi.suite`. |

---

## 2. The two tools at a glance

| | Scarlett Isles Explorer | The Ironbow Bastion Manager |
|---|---|---|
| Home-screen group | **World** | **DM Tool** |
| Home card text | "Explore the Isles. Maps, regions, and the world's moving parts." | "Manage facilities, orders, events, treasury and staff for your bastion, day by day with the Explorer." |
| What it models | The party travelling the Isles | The party's island stronghold, the Ironbow |
| The clock | **Owns** the day. Make Camp adds 1; Reset Travel sets it back to 1. | **Follows** the Explorer's day. It has no button that moves time on. |
| Main button | **Make Camp** (crimson) | None in normal play. **Finish Day N** (crimson) appears only when a day was left part-way. |
| What it saves | `tsi.explorer.save`, `tsi.explorer.mapImage` | `tsi.bastion.state`, `.ui`, `.crest`, `.warMap`, `.warTable`, `.warTerrain` |
| What it reads from the other | At Make Camp: the Bastion's whole state, for the forecast. In fights: the party level. | The Explorer's `travel.day`; nothing else in play (its Export reads the Explorer's whole save, for the campaign file) |
| Does it write the other's save? | Never, except a campaign Import | Never, except a campaign Import |
| Usual screen | The laptop (1707 × 930 CSS px inside maximised Edge) | The TV (1920 × 1080) |

### The play loop at the table

1. **Open the Explorer.** The DM opens it on the laptop, from the home screen. The first time it opens, it saves Day 1 so the Bastion can read it.
2. **Open the Bastion.** The DM presses **Open the Bastion ↗** in the Explorer's Travel panel. The Bastion opens in its own window, sized to the screen the Explorer is on, and the DM drags it to the TV. The Bastion reads the Explorer's day. The very first time, it **anchors** to it; after that, it passes in turn any days the Explorer moved on while the Bastion was shut (§3.5).
3. **Travel.** During the day, the DM drags the heroes:
   - each hex costs 6 miles, and the daily limit is 30;
   - once a day, after enough miles, there may be a travel event;
   - the event plays in the Explorer's event window;
   - fights are set up in the Combat Tracker.
4. **Give orders at the Bastion** (any time). The DM may build, issue orders, run Hall actions, invest in trade or queue War Actions. Costs come out of the treasury at once. Each one completes on a later day.
5. **Make Camp.** On the laptop, Make Camp moves the day on by 1. The Explorer then shows, one after another:
   - the night's event, if any;
   - the weather, if any;
   - its forecast, "The Ironbow sends word…", only if the Bastion's save has something due on the new day.
6. **The Bastion catches up.** Within about 2 seconds, the Bastion on the TV notices the new day and passes it. On the TV it asks for any rolls: sea routes, Hall actions, a muster, an attack. It then shows its own "The Ironbow sends word…" with the results, if anything happened.
7. **Repeat.** There is one in-game clock: the Explorer's day.

---

## 3. The shared clock

### 3.1 Where the day lives, and what changes it

- **Where it lives:** the day is `travel.day` inside `tsi.explorer.save`. It starts at 1 (`R.defaultTravel`, `tools/explorer/rules.js` 48–63).
- **Only five things change it:**
  1. **Make Camp:** day + 1 (`R.makeCamp`).
  2. **Reset Travel:** the day goes back to 1 (`R.resetTravel`).
  3. **Import** of a campaign file or an older Explorer-only file.
  4. **Restore** of a whole-suite backup, from the home screen.
  5. **A damaged Explorer save.** It is set aside, and the Explorer starts fresh at Day 1 and saves it at once (`tools/explorer/tool.js` 40–49 and 1562). The Bastion then reads Day 1 as a Reset Travel and shifts its days back (`R.clockAction`, `tools/bastion/rules.js` 1688).
- **These don't change the day:**
  - Free Move;
  - miles walked;
  - an event's "lose the day" outcome (it only lowers today's mile limit);
  - Roll an event now;
  - Queue, the main campaign event button;
  - Clear, which resets party gold.
- **Make Camp is blocked while an Explorer event is open:** "Finish or end the event in progress before you make camp."
- **What the Bastion keeps:** its own `state.day` (the last day it has passed) and `state.anchored` (whether it has read the Explorer's day yet). A Bastion save that counts in days has `v: 2`.

### 3.2 How the Bastion reads the day

`checkClock`, in `tools/bastion/tool.js` 2884–2914.

- **What it reads.** It reads `tsi.explorer.save` → `travel.day` with `TSI.store.fresh`, normally straight from the browser database, so it sees what another window has saved. If the value is 1 or more, that whole number is the Explorer's day; otherwise there is no Explorer day.
- **The page's own saves don't get in the way** (`shared/js/store.js` `fresh`). `fresh` falls back to the page's own copy only while that page is itself still saving a change to the same key, or makes one while it reads (its own copy is then the newer one). The Bastion never saves the Explorer's key, so it always gets the Explorer's day as last saved. If the browser database can't be read, `fresh` uses the value it last read. *History:* until 12 October 2026, **any** save of the page's own made `fresh` return the copy read when the page opened. The Bastion could then take an old day for a Reset Travel, shift every day back and pass them all again, so things fell due early and an automatic event could be rolled twice (SUI-29 in `docs/KNOWN_ISSUES.md`, fixed). The same function serves every cross-window read: the Explorer's Make Camp read of the Bastion's save (explorer `tool.js` 759), its party-level re-read (1126), the DM doc (`shared/js/dmdoc.js` 273), and the Bastion's re-read of its own crest when another Bastion window has answered the crest question (`tools/bastion/tool.js` 915).
- **When it reads:**
  - when the Bastion opens;
  - **every 2 seconds** while it is open;
  - whenever its window comes back into view.
- **When it waits.** It reads but does nothing while:
  - days are being passed by **Finish Day N**, or an order or the Hall's routes are being resolved with **Resolve**;
  - a Military Action's rolls or the War Table are running;
  - the "A crest from the Crest Creator" question is open.
- **A run the clock check started.** While a run that the clock check started is going on (its rolls and its "The Ironbow sends word…"), the Bastion doesn't read the Explorer's day at all (`clockBusy` stays set until the run ends, tool.js 2886–2887, 2904, 2911). A day the Explorer adds meanwhile is passed in a separate run, about 2 seconds after that word pop-up is closed. That run has its own "The Ironbow sends word…" if anything happened.
- **A run started by Finish Day N.** The clock check keeps reading (and does nothing else), so that run picks up a newer Explorer day in the same run. During a **Resolve**, which passes no days, the new day is passed by the first check after the Resolve ends.
- **It never writes to the Explorer's save.**
- **Hidden windows.** Edge slows the timers of a hidden or minimised window, so a hidden Bastion notices the new day later. It checks at once when the window is shown again.

What the Bastion does with the day (`R.clockAction`, `tools/bastion/rules.js` 1682–1690):

| Situation | What the Bastion does |
|---|---|
| There is no Explorer save, or its day is below 1 | Nothing. While the Bastion is not anchored, its top bar reads "Day 1 · the Explorer sets the day". |
| The Bastion has never read a day (`anchored: false`) | **Anchor** (`R.anchor`). It moves every stored day by the difference (`R.shiftDays`), sets its day to the Explorer's, sets `anchored = true` and saves. **No days are passed.** |
| A day is part-way | Finish that day first, then carry on. |
| The Explorer is ahead | **Pass** each new day in turn (`passDays`). |
| The Explorer is behind (after a Reset Travel) | **Shift**: `R.shiftDays(by)` moves every stored day back by the same amount, so something due in 4 days is still due in 4 days. It writes the Day Log line (title **Days**) "The Explorer's day went back (Reset Travel): the Bastion moves from Day X to Day Y, and everything due keeps its days." |
| Same day | Nothing, apart from redrawing the day status. |

**What `R.shiftDays` moves** (rules.js 1696–1718):
- the day, `lastEventDay` and `defenders.patrolUntil`;
- each order's issued day, due day and `meta.declared.day`;
- each build's start day and ready day;
- every diplomacy record's start, end and last-shipment days, and every cooldown;
- every route's opened, expiry, next and last-settled days;
- every dispute's created day and disrupted day;
- repairs;
- each war's `since`, `last` and `next`;
- `warRecovery` end days;
- Military Action days;
- mission created and seen days;
- `organization.foundedAtDay`.

The Day Log and `state.word` are history, so they are not moved. Stored days can become 0 or negative; these are shown as "before Day 1".

### 3.3 Passing one day in the Bastion

`passDays` (tool.js 2918–2938) can't run twice at once. Until the Bastion reaches the Explorer's day, it loops: start the day, run it, repeat. Each step is saved as it finishes, in `state.dayInProgress = { day, stage, skipped, attackRolled, news }`. So closing the window, or cancelling a roll, never loses or repeats anything.

1. **Start the day** (`R.startDay`, rules.js 1624–1644):
   1. The day goes up by 1. `dayInProgress` starts at stage `trade`.
   2. Lieutenants and beasts whose recovery has ended are fit again (`R.tickRecovery`).
   3. Any war with **42** quiet days ends, unless something involving that Clan is still waiting (`R.tickWars`).
   4. Repairs whose last day has passed finish: "Repairs: the X is working again." (`R.tickRepairs`).
   5. Steps 2 to 4 go into the Day Log, and also become lines in "The Ironbow sends word…".
   6. Buildings due today are finished (`R.completeConstruction`): "The X is built."
   7. Diplomacy is brought up to date (`R.tickDiplomacy`):
      - each contract whose shipment day has come pays its income ("Contract shipments arrived: +N gp.", in the log only);
      - records whose end day has come end, with a line in the word;
      - routes whose Consortium has ended, or whose 35 days are up, expire;
      - cooldowns that have run out are cleared.
2. **Stage `trade`:** sea routes due today sail.
   - This only happens if the Trade Network is active.
   - Low and medium-risk routes pay automatically.
   - High-risk routes ask for a d20, and so does every route while High-Risk Routing is on.
   - A **Trade Routes Resolved** pop-up follows, and the word line "Trade routes sailed: +N gp."
   - Then the stage becomes `orders`.
3. **Stage `orders`:** orders whose due day is today or earlier complete one at a time, in the order they were issued.
   - Orders skipped today after a cancelled roll are left out.
   - So are orders at a facility Under Repair; they wait until it works again.
4. **War attack roll** (`R.rollWarAttack`), once a day:
   - Each Clan at war whose 7-day attack day has come rolls a d6, unless an attack is already waiting.
   - The first 1 attacks.
5. **Finish the day** (`R.finishDay`, 1663–1676):
   - On an event day (Days 29, 57, 85 and so on), the automatic d100 Bastion event is rolled.
   - The day's news moves into `state.word`.
   - `dayInProgress` is cleared and the Bastion saves.

After the last day, **one** pop-up titled "The Ironbow sends word…" lists every line from every day passed, if any day brought news. Days with no news are left out, and the day headings show only when more than one day had news.

### 3.4 What counts from its own start

(`B.time` in `bastion-data.js` 126–132, and the war data.)

| What | Interval | Counted from |
|---|---|---|
| Contract shipments (Trade Agreement, Writ, Consortium) | Every 7 days | The day it was signed. The last shipment comes on its end day. |
| Sea-route sailings | Every 7 days | The day the route opened. A route lives 35 days. |
| A Clan at war rolls to attack | Every 7 days | The day war was declared |
| Watchtower Patrol | Lasts 7 days | The day the Patrol order completes |
| War Action muster | 3 days | The day it was queued |
| Hall action cooldown after a Bad Failure | 14 days | The day it resolved |
| Under Repair after a lost Defend Bastion | 14 days, the day of the loss included | The day of the loss |
| A war ends by itself | After 42 quiet days | Its last war activity |
| Automatic Bastion event | Every **28** days | Day 1: Days 29, 57, 85 and so on |
| Building a facility | 21, 28 or 35 days | The day it was started |
| Each order | Its own days (see §5.3) | The day it was issued |

### 3.5 Catching up, part-way days and Finish Day

- **Catching up.** Every missed day is passed in turn, each with its own pop-ups in order. At the end, one "The Ironbow sends word…" covers them all.
  - If the Bastion was shut while the Explorer moved on, all of this happens when the Bastion is next opened.
  - If the Bastion is open in another window, it happens within about 2 seconds of Make Camp.
- **A part-way day.** If the window closes during a pop-up, the next time the Bastion opens it shows "Day N was left part-way through. It carries on now; nothing has been lost."
  - The clock carries on by itself.
  - The crimson **Finish Day N** button in the top bar does the same by hand. It shows only while a day is part-way and nothing else is running.
- **What stops anything happening twice:**
  - each route's next sailing day moves on as it settles;
  - each order is removed once done;
  - `attackRolled` stops a second attack roll on the same day;
  - `lastEventDay` stops a second automatic event.
- **No button moves time on.** The Bastion has no "advance" button.
- **Roll Bastion Event.** The **Roll Bastion Event** button in the Events panel rolls an event on the spot. It changes neither the day nor `lastEventDay`.

### 3.6 What the Bastion asks the DM while passing days

| Prompt | When |
|---|---|
| A d20 box for each route | A high-risk route sails, or any route sails while High-Risk Routing is on |
| A d20 box (three for Host Delegation) | A Hall diplomacy action falls due |
| "Your forces muster for battle", with **Later / Begin Military Action** | A War Action falls due. Beginning leads to the Weather, Morale and Luck d20s, then the War Table. |
| "Sound the horns!", with **Later / Defend the Ironbow** (or **See the War Report** if nobody is free to defend) | A Clan at war rolls a 1 |
| Result pop-ups with Continue | Trade Routes Resolved, Order Resolved, a Trade Network investment sealed |
| "The Ironbow sends word…", with Close | Once, at the end |

Everything else rolls by itself with no prompt: simple orders' dice (1d4, 1d10, 1d6, 1d20), building, shipments and the d100 event.

**Cancelling a roll box changes nothing.** The order, or the route, stays due:
- it can be finished with **Resolve** (Pending Orders, or the Hall's Resolve pill for routes);
- otherwise it comes up again on the next day passed.

### 3.7 Reset Travel on both sides

**In the Explorer** (`R.resetTravel`, rules.js 737–743):
- It first asks: "Reset travel back to Day 1 and clear miles for ALL heroes? Active Effects and Threads stay, counted from the new Day 1."
- It sets the day to 1, every hero's miles to 0 and `milesAdjust` to 0.
- It moves the days of effects, threads, follow-up windows, the last travel-event day, the rolled day and the event in progress by the same amount (`J.shiftDays`).
- It does **not** move:
  - `lastWeatherDay` (so there is no weather until the new count reaches the day of the last weather + 3; EXP-21, kept);
  - `travelEventDay` or `nextTravelEventAtMiles`;
  - gold, the lists of events already used, or tonight's set-up event.

**In the Bastion**, at its next read:
- It shifts every stored day by the same amount (§3.2).
- If the Explorer reset and then made camp before the Bastion next read the day, the Bastion shifts straight to the Explorer's current day. **It does not pass the days in between.**
- The automatic event keeps to absolute Days 29, 57… of the new count.

### 3.8 Where the day shows

**In the Bastion's top bar:**
- "Day 12" normally;
- "Day 1 · the Explorer sets the day" until it is anchored;
- "Day 12 · Day 14 in the Explorer" while it is behind;
- "Passing Day 13…" while it is passing a day.

**Elsewhere in the Bastion:**
- The header's subtitle reads "Bastion Manager • day by day with the Explorer".
- The Orders panel says: "Each order completes on its day, as the Explorer's days pass. One waiting for a roll you cancelled shows Resolve."
- The Events panel says: "The next automatic event: Day N (every 28 days)."

**In the Explorer:** only its own "Day N", in the Travel panel. It never shows the Bastion's day.

---

## 4. The Scarlett Isles Explorer

### 4.1 The screen

The Explorer has three columns: the left panel (252 px), the map, and the travel panel (292 px). A 4:3 map gets the full height.

**Top bar** (shared by every tool):
- the suite title, which goes Home;
- › **Scarlett Isles Explorer**;
- a save status: "Saved ✓", "Not saved", "Saved (small storage)" or "Not saving";
- **Export**, **Import**, **DM doc** and **Switch tool ▾**.

**Left panel, "Map controls"** (intro: "Upload a map, align a hex grid, and drag your heroes around."):
- **Map:** a list of maps (the first item is "(choose)"), **Load**, **Upload map**, **Clear map**.
- **View:** **Fullscreen**, **Hide UI**.
- **Hex grid:**
  - **Hex Grid: On/Off**, **Hex −**, **Hex +**;
  - arrows **◀ ▲ ▼ ▶** to move the grid;
  - a **Grid opacity** slider;
  - a readout: "Hex: r=38px (≈ 66px wide)".
- **Fog and snap:** **Fog of War: Off/On**, **Reset Fog**, **Snap: Off/On**, **Pick Marker XY: Off/On**.
- **Heroes:** **Token −**, **Token +**, **Group**, **Ungroup**.
- **Region:** a list of the seven regions.
- **Journey:** **Export Save**, **Import Save**.

**The map**, in layers from bottom to top:
1. the map picture;
2. the weather video;
3. the hex-grid canvas;
4. town pins;
5. the fog canvas;
6. hero tokens;
7. the selection box;
8. a floating **Show UI** button, while the UI is hidden.

**Right panel, "Travel"**, from top to bottom:
- **Day N**;
- "Miles (selected): used/limit • Remaining: n";
- **Mode** (the pace) and **Pace effects**;
- **Gold: n**, with a **Clear** button;
- a notice line;
- one pill per hero, showing the initial and used/limit (click a pill to make that hero the focus hero);
- **Make Camp**, the only crimson button;
- **Open the Bastion ↗**;
- **Free Move: OFF/ON** and **Reset Travel**;
- **Roll an event now**, which reads **Back to the event** while an event is waiting;
- **Main campaign:** "Force Main Campaign Event…", with **Queue**;
- **Active Effects**;
- **Threads**.

### 4.2 Maps and the board

**The ten preset maps.** Each is a 2048 × 1536 (4:3) picture in `tools/explorer/assets/maps/<id>.jpg`.

| Map | Region it sets | God | Town pins shown | River marks | Coast marks |
|---|---|---|---|---|---|
| Eastern Province (North) | Eastern Province | Telluria | 1 | no | yes |
| Eastern Province (South) | Eastern Province | Telluria | 2 | no | yes |
| Midland Province | Midland Province | Telluria | 1 | yes | no |
| Northern Province (East) | Northern Province | Telluria | 2 | yes | yes |
| Northern Province (West) | Northern Province | Telluria | 2 | yes | yes |
| Southern Province (East) | Southern Province | Aurush | 0 | no | yes |
| Southern Province (West) | Southern Province | Aurush | 2 | yes | yes |
| The East Isle | The East Isle | Pelagos | 2 | no (a lake) | yes |
| The North Isle | The North Isle | Pelagos | 3 | no | yes |
| Western Province (South) | Western Province | Aurush | 0 | no | yes |

**Loading a map** (choose it, then **Load**):
- It sets the map, drops any uploaded picture, and sets the event region (`travel.provinceId`) to the map's province.
- The Region list on screen does **not** update until the Explorer is reopened (EXP-20, kept).
- If the party arrives from a linked map, it is placed at that map's entry point, keeping its formation, and fog clears around the focus hero.
- The notice reads "Map loaded: <map id> • Events: <region id>", with " • Spawn applied" added after a linked-map move.

**Linked maps.** There are 17 entry points between neighbouring maps; three of the links go one way only (E11). Loading a map with no link from the current one keeps each hero at the same fractional position on the new picture.

**Uploaded maps:**
- **Upload map** takes an image up to 4 MiB. It is stored as `tsi.explorer.mapImage`.
- On an uploaded map:
  - there are no town pins;
  - nothing counts as near a river or the coast;
  - events limited to particular maps never come up;
  - the event region is whatever the Region list says.
- **Clear map** asks "Clear the uploaded map? (Tokens/grid will remain.)". With no map, the board is 16:9.

**Town pins:**
- There are 33 pins in the data. Only those with a town map are shown: **15 shown, 18 hidden**.
- Clicking a pin opens a "Location" pop-up with the town map.
- With fog on, a pin only shows once its hex is uncovered.
- **Pick Marker XY** copies a click's fractional x,y, for editing the data files.

**The board:**
- It is 1440 units wide, and as tall as the picture's shape needs. Heroes and pins are stored as fractions of the picture, so the same hex covers the same ground on the laptop and on the TV.
- It is fitted whole and centred in the map area.
- It redraws when the window is resized, or moves between screens with different pixel ratios (1.5 on the laptop, 1 on the TV).

**Hex grid.** Hexes are pointy-topped, with one grid setting for all maps.
- **Hex − / Hex +** change the radius by 2 units (10 to 220, default 38).
- The arrows move the grid by 2 units.
- Opacity runs from 0 to 1 (default 0.35); **0 counts as 0.35** (EXP-26).
- Every hex costs **6 miles**, whatever its size.

**Heroes.** There are five: **Kaelen, Umbrys, Magnus, Elara, Charles** (tokens K, U, M, E, C), fixed in the data.
- **Click** a hero to select it (or its group) and drag. That hero becomes the **focus hero**: its miles are shown, and fog clears around it.
- **Ctrl + click** adds a hero to the selection, or removes it.
- **Drag on empty map** draws a selection box.
- **Group** needs 2 or more heroes selected. **Ungroup** splits a group.
- Only grouped heroes move together.
- **Token − / +**, or the mouse wheel over a token, changes the size by 2 (24 to 140; the default is 46).

**Snap: On:**
- puts every hero in the centre of its hex;
- moves a dragged group by the same number of hexes as the grabbed hero;
- clusters heroes who share a hex.

**Fog of War:**
- It is black at 86%.
- It clears a **2-hex radius** around the focus hero, and is kept per map.
- **Reset Fog** clears this map's uncovered ground straight away, without asking (EXP-27).
- After reopening with fog on, the button reads "Fog of War: Off", so the first press turns fog off (EXP-19).

### 4.3 Movement, miles and pace

**When a drag is let go** (`R.finishMove`):
- The grabbed hero's hex distance × 6 is the miles for the move.
- **Every hero in the drag is charged that same amount.**
- If any of them would go over today's limit, nobody moves and nobody is charged: "Too far. One or more heroes would exceed <limit> miles. Make Camp to reset."
- If the grabbed hero has reached the limit: "<initial> has reached <limit> miles. Make Camp to reset."

**Today's limit** is **30 + `milesAdjust`**, never below 0.
- Event outcomes change `milesAdjust`.
- A "lose the day" outcome sets the limit to the most miles any hero has already walked today.
- `milesAdjust` goes back to 0 at Make Camp.
- A hero at the limit can't be dragged, and their pill is dimmed.

**Pace** follows the focus hero's miles today:

| Miles today | Mode | Pace effects |
|---|---|---|
| 0 | — | — |
| up to 18 | Slow (≤18 miles) | +Stealth |
| up to 24 | Normal (≤24 miles) | No effects |
| over 24 | Fast (≤30 miles) | −5 Passive Perception |

During an event's checks, pace adds reminders: "Slow pace: advantage on Stealth checks." and "Fast pace: −5 to Perception checks to spot danger."

**Free Move: ON:**
- moves heroes without charging miles and without the travel roll;
- lets tired heroes be dragged;
- still clears fog;
- is saved.

### 4.4 Weather

**When.** Weather is only rolled at Make Camp:
- there is a **45%** chance, once **3** days have passed since the last weather;
- the earliest possible weather is the first camp (Day 2);
- a weather night stops that night's campfire roll.

| Weather | Roll | Results | Film over the map |
|---|---|---|---|
| White Blizzard | Group DC 13 Constitution Save | 13 or more: no effect. Failure: each character gains 1 level of Exhaustion. | `blizzard_overlay.mp4` |
| Black Storm | DC 14 Save (choose Wisdom or Dexterity) | 14 or more: Gain Inspiration (for the next day). Failure: Rattled (no Reactions or Opportunity Attacks in the next day's first combat encounter). | `storm_overlay.mp4` |
| Cold Downpour | DC 12 Survival Check | 17 or more: Great Success, Dry Cache (roll on a minor loot table). 12 or more: no effect. Failure: Soggy Gear (Disadvantage on Initiative rolls for the next day). | `rain_overlay.mp4` |
| Sun & Heatwave | DC 13 Check/Save (choose Athletics or Constitution Save) | 13 or more: no effect. Failure: Lethargy (limit travel to 2 hexes, 12 miles, today). | `sun_heat_overlay.mp4` |

**The weather pop-up:**
- Title "Weather • <Region> • —".
- The DM types the final roll into "Roll (d20):" and presses **Resolve**. Resolving saves which weather it is, as `travel.activeWeather` (`{kind, day}`), so its film can play; the roll and its result are not saved.
- A muted, looping film then plays over the map for the rest of that day.
- An empty box counts as 0, which fails (EXP-28).
- Closing without rolling skips the weather, but the 3-day wait is still used up (EXP-22).

**The effects are text for the table only.** The tool applies none of them; for example, Lethargy does not change the mile limit.

### 4.5 Travel and campfire events

**The road roll** (`J.travelRoll`):
- Once a day, after a real move (not Free Move) in which the grabbed hero's miles today reach that day's random threshold of **6 to 24 miles**, the tool rolls. In order:
  1. If it has already rolled today, or the DM already drew a travel event today: nothing.
  2. A follow-up on the **last day** of its window that fits here happens, whatever the dice.
  3. If a travel event happened yesterday: nothing. There are never two days running.
  4. **30%** chance, otherwise nothing.
  5. A follow-up that is due takes the place of a travel event; otherwise a travel event is drawn.
- No roll is made while an event is waiting.

**The campfire roll:**
- Made at Make Camp, with a **25%** chance.
- Skipped if there was weather tonight, or if a travel or follow-up event happened that day.

**Who can come up.** Each event has a `where`:
- any;
- particular maps (that map must be loaded);
- particular provinces (the Region);
- particular gods (the Region's god).

T2 also needs a river nearby (within 2 hexes, 12 miles). T9 is switched off.

**Drawing like cards.** Travel and campfire events each have a "used" list shared across maps. Nothing repeats until every event that could come up here has been used.

**Roll an event now:**
- It offers **Cancel / Campfire event / Travel event**, ignoring the chances and the once-a-day and two-days-running rules.
- **Travel event:** a due follow-up comes first, otherwise a fresh draw. It counts as today's travel event, so it stops:
  - another road roll today;
  - tomorrow's road roll;
  - tonight's campfire roll.
- **Campfire event:**
  - if any hero has moved today, it is set for tonight's camp: "<code> <title> will come at tonight's camp.";
  - if any hero has moved today and tonight's camp already has an event set up, it is refused: "Tonight's camp already has an event waiting." (`tools/explorer/tool.js` 1079);
  - if nobody has moved today, it begins at once.
- If nothing fits: "There are no campfire events for this map and region." (or "travel events").

**Skip this event:**
- Allowed only for travel or campfire events, and only before anything has changed.
- The event goes back into its pool, and for a travel event the day no longer counts as having had one.
- The day's road roll stays used.

**There are 17 travel events** (T1–T16 and T18; there is no T17), of which T9 is off. **There are 12 campfire events and 3 follow-ups.**

| Code | Title | Where | Possible results (summary) |
|---|---|---|---|
| T1 | The Wardens' Toll | any | Toll-Wise (7 days); +120 / −50 gold; −6 or −12 miles; threads The Captive Warden, The Toll-Men's Grudge (→ F1) |
| T2 | The Ambush Sign | any, near a river | +150; Inspiration; −6 miles; fight t2 (ford) |
| T3 | The Overturned Wagon | any | −12 miles; +200 or +75; thread Who Wrecked the Wagon? |
| T4 | The Knight-Errant's Challenge | any | contest (won: +200, Inspiration, DM note +1 clan honour; lost: −100, Humbled (7 days)); or decline, where a failed Persuasion gives DM note −1 honour |
| T5 | The Ferry Puzzle | Midland, Northern (East/West), Southern (West) maps | +6 or −6 miles; Inspiration |
| T6 | The Dying Messenger | any | thread The Sealed Dispatch (resolving gives +250 and +1 honour, or 0 and −1) |
| T7 | Rootfall | Telluria's lands | −6 miles; −50 and Telluria's Footing (3 days); or +150 and Root-Cursed (7 days) |
| T8 | The Waystone Riddle | Telluria's lands | +100 with a DM note (potion); or −6 miles |
| T9 (off) | The Husk in the Furrows | Telluria's lands | fight t9; +60; −6; thread The Spreading Rot |
| T10 | The Muster Checkpoint | Eastern Province (North) map | thread Slade's Worry; lose the day or −100; No long rest; DM note −1 honour with Clan Slade |
| T11 | The Light Coin | Southern Province (West) map | +100 or −50; thread False Gold |
| T12 | The Sunburst Shrine | Southern and Western Provinces | Aurush's Warmth (until Make Camp); −50 |
| T13 | Lights Below Redport | Western Province (South) map | thread The Redport Cove (+200, +1 honour Clan Farmer); +250; +300; fight t13 (cove) |
| T14 | The Prospector's Claim | Southern Province | −100; thread → F2 on day +7 (a secret roll: genuine vein or salted) |
| T15 | The Tide Causeway | The North Isle, The East Isle | +12 miles; or −100 and Sea-Chilled |
| T16 | The Drowned Bell | The East Isle map | +200 and thread The Maren's Last Voyage; or Sea-Chilled |
| T18 | The Salt-Ring Recruiter | The East Isle map | +100, Inspiration, DM note "Arenas: the party is invited to the Salt-Ring Trials."; Strained |
| C1 | A Stranger at the Fire | any | thread The Runaway's Letters; −100 |
| C2 | Bones by Firelight | any | stake of 50, 100 or 200: +2×, +1× or −1× the stake |
| C3 | The Bard's Wager | any | +50 and Inspiration, or −50; thread The Bard's Rumour |
| C4 | The Deserter | any | thread The Deserter's Debt; +100; DM notes ±1 honour |
| C5 | The Heartbeat in the Earth | Telluria's lands | Rooted (3 days); No long rest; −6 miles; Slept Badly |
| C6 | Wolf-Song | Northern Province (East) map | thread What Drove the Wolves Out; Wolf-Friend (7 days); fight c6 |
| C7 | The Forester's Riddle | Telluria's lands | Forester's Knot (until used); or −50 |
| C8 | The Ember That Won't Die | Southern and Western Provinces | No long rest; Aurush's Dawn (3 days); Exhaustion |
| C9 | The Debt Collector | Southern Province (West) map | thread The Forged Debt; −200; fight c9 |
| C10 | The Beacons | Western Province | No long rest and fight c10ride; +300 and +1 honour Clan Farmer; or fight c10camp |
| C11 | The Tide Ring | The North Isle, The East Isle | +250 and The Sea Remembers (14 days); Pelagos' Favour (14 days); or −100 then +250 |
| C12 | False Lights at Bleakharbour | The North Isle map | thread The Captain's Thanks (→ F3); DM note +1 honour Clan Karr; fight c12 |
| F1 | The Toll-Men Return | T1's grudge; days +1 to +3; same map | fight f1 (+200), Fled, or pay −100; the thread closes |
| F2 | The Prospector's Claim | T14; day +7; any map | genuine: +400; salted: Investigation 14, then the thread continues or closes |
| F3 | The Captain's Thanks | C12; days +2 to +5; isles only | +250; Insight 14, then the thread continues or closes |

**Check kinds:**
- **one:** the DM picks who rolls, and another hero can Help for advantage (except T18's lift, which allows no Help).
- **group:** every hero rolls, and the party succeeds if half or more succeed.
- **each:** the DM ticks who failed.
- **same:** the hero chosen earlier rolls.

### 4.6 The event window and outcomes

**Title bar:** "<kind> • <Region> • <code>". The kinds are Travel event, Campfire event, Follow-up, DM event and At camp.

**Body:**
- the event title and its one-line summary;
- the step text, with {clan}, {chief}, {temple}, {hero}, {failed}, {succeeded} and {stake} filled in;
- the controls for the step;
- a changes box: "So far", "What changed" or "Nothing changed.".

**Step types:**
- **Check:** Success / Failure, plus "Fail by 5 or more" on T10 and C2.
- **Every hero:** tick boxes for who failed.
- **Choices**.
- **Continue**.
- **Fight**: §4.9.
- **Contest:** best of 3 against an opponent the tool rolls for.
- **Puzzle or riddle:** an optional hint check (**Hint: Success** / **Hint: Failure**). A puzzle has **Solved** / **Give up**. A riddle has **Right answer** / **Wrong answer** / **Show the answer (DM)**, with 1 or 2 tries (`tools/explorer/tool.js` 1356–1386).
- **Pick a hero**.
- **End:** **Done**.

**Safety:**
- Every change is applied and saved when its step is reached, so nothing applies twice.
- Clicks in the first 350 ms after the buttons change are ignored.
- An event left part-way, after a reload or tool switch, reopens at the same step.
- Close or Esc asks "Close the event?", with:
  - **Back to the event**;
  - **Keep it for later** (the event waits; **Back to the event** in the Travel panel reopens it);
  - **End it now** (what has happened so far stays).

**Outcomes** (`J.applyOutcome`):

| Outcome | Effect |
|---|---|
| gold | Added to the Explorer's party gold. It can go below 0. **It never touches the Bastion's treasury.** |
| miles | Changes `milesAdjust`, which raises or lowers today's limit (or the new day's, if it happens at camp). |
| loseDay | Today's limit becomes the most miles any hero has already walked. |
| effect, inspiration | Adds an Active Effect. Inspiration is "Inspiration: to spend at the table". |
| thread / threadRename / threadClose | Opens, renames or closes a Thread. |
| dm | **A note only.** For example "Notice Board: consider +1 clan honour with Clan {clan}", the Arenas invitation, a potion. It is never applied to another tool. |
| note | Text, for example who is surprised. |

**Regions** fill in {clan}, {chief} and {temple} (`shared/data/regions.js`):

| Region | Clan | Chief | God | Temple |
|---|---|---|---|---|
| Northern Province | Blackstone | Boris Blackstone | Telluria | Temple of Telluria |
| Midland Province | Bacca | Ario Bacca | Telluria | Temple of Telluria |
| Eastern Province | Slade | Harlan Slade | Telluria | Temple of Telluria |
| Southern Province | Molten | Callum Molten | Aurush | Temple of Aurush |
| Western Province | Farmer | Logan Farmer | Aurush | Temple of Aurush |
| The North Isle | Karr | Helga Karr | Pelagos | Temple of Pelagos |
| The East Isle | Rowthorn | Doran Rowthorn | Pelagos | Temple of Pelagos |

### 4.7 Active Effects, Threads and follow-ups

**Active Effects:**
- Each shows its name · who, its text, when it ends and "from <code>".
- **✕** removes one, after asking.
- **When they end:**
  - `days: N`: "ends Day X";
  - `camp`: at the next Make Camp;
  - `night`: the Make Camp after tonight's if gained on the road, the next Make Camp if gained at camp;
  - `used` and `dm`: never by themselves.
- They are **reminders only**; the tool applies none of their rules.

**Threads:**
- Each shows its name, its note, "Day N · from <code>", and any "Follow-up due Day X" or "Follow-up due Days X–Y".
- **Resolve** asks first, then:
  - adds any reward gold to the party gold;
  - removes the thread;
  - logs it.

**Follow-ups:**
- **Scope:** `same-map`, `isles` or `any`.
- **Inside its window,** a due follow-up takes the next successful travel roll.
- **On the window's last day,** it happens regardless: on the road, or at that night's camp.
- **If something else takes the night,** it waits one more day. This includes tonight's set-up campfire event (`J.campOverride` → `J.postponeFollow`, `journey.js` 266–298).
- **If the window passes,** the follow-up is dropped and the thread gains "(Its follow-up didn't come: you'd moved on.)".

### 4.8 Party gold

- **Gold: N** is a saved running total of event gold.
- Make Camp never resets it.
- **Clear** asks "Set the party's event gold (N) back to 0? Do this once you've moved it onto the players' sheets."
- **It is separate from the Bastion's treasury.**

### 4.9 Fights (Explorer → Combat Tracker)

**Party level:**
- It is the **Bastion's saved `partyLevel`**, kept between 1 and 20.
- If the Bastion has not saved, it is 7, shown as "(the Bastion hasn't saved a level yet)".
- It is read when the Explorer opens, then again (at most every 3 seconds) whenever a fight step is drawn.

**Enemy band:**
- level 10 or below: "Levels 7–10";
- level 11 or above: "Levels 11–16".

**The fight step shows:**
- the suggested enemies, with AC and HP;
- "Party level N (from the Bastion): the Levels 7–10 group.";
- the battle map;
- who is surprised.

**Battle maps:**
- They are `tools/encounter/assets/battlemaps/<setting>-<look>.png`, each with a 24 × 18 grid.
- The settings are ford, road, camp and cove.
- The look follows the region:
  - green: Northern, Midland, Eastern;
  - warm: Southern, Western;
  - cold: The North Isle;
  - misty: The East Isle.
- Near the sea, F1 and C10's ride use the cove instead of the road.

**Encounters:**
- t2: Bandit Captain, 2 Veteran, 8 Bandit.
- t13: Bandit Captain, 4 Thug, 6 Bandit.
- c6: Old Wolf (a Dire Wolf), 12 Wolf.
- c9: Debt Collector (a Spy), 2 Ogre.
- c10ride and c10camp: Raider Chief (a Gladiator), 4 Berserker, 8 Bandit.
- c12: Bandit Captain, 8 Bandit.
- f1: 2 Toll-man (a Thug), 6 Bandit.

The 11–16 band adds stronger units (for c9 it swaps the 2 Ogres for 2 Hill Giants instead).

**Setting up the fight.** **Set up this fight in the Combat Tracker ↗** (it reads **Send it again ↗** once sent):
1. It writes the fight to `localStorage` key `tsi.suite.handoff`: the monsters, the map, starting corners, areas to avoid, the surprised heroes, the level and the band.
2. It opens the Combat Tracker in a new window. If the Tracker is already open, it says "Fight sent."

**In the Tracker:**
- It offers **Load the fight**.
- When every monster from the fight is down, it writes `tsi.suite.handback` `{ id, result: 'won', at }`.
- The Explorer then shows "The Combat Tracker reports: every enemy is down. Click Won to carry on."
- **The DM still clicks Won or Fled.**

**The Bastion's War Table is not involved.**

### 4.10 Main campaign events

The **Force Main Campaign Event…** list holds:
- **The Tide Remembers - Prologue**: 3 illustrated steps, ending with Maerys Vell's letter;
- **The Turning Tide**: 8 steps, pictures only.

**Queue** plays the chosen event at once and shows "Main Campaign event triggered." Main events have no outcomes.

### 4.11 Full screen, Hide UI and keys

- **Fullscreen** puts all three columns into full screen, for the TV.
- **Hide UI**, or the **H** key, leaves only the map, with a floating **Show UI** button.
- **Esc** closes pop-ups with their safe answer.
- **Enter** in the weather box resolves the weather.
- Make Camp ignores a repeat press within 350 ms, or while it is still running.

### 4.12 What the Explorer keeps (`tsi.explorer.save`, version 1)

It is written after every change (about 120 ms later), and once as soon as the Explorer first opens.

| Part | Contents |
|---|---|
| map | `freeMove`, `mapPresetId`, `mapUploadKey`, `mapAspect`, `snap.enabled` |
| `travel` | `day`, `provinceId`, `travelEventDay`, `nextTravelEventAtMiles`, `lastWeatherDay`, `activeWeather {kind, day}`, `weatherEventDay`, `milesAdjust`, `forcedMainEvent`, `forcedMainEventFired` (and an unused `milesUsed`) |
| `grid` | `enabled`, `r`, `offsetX`, `offsetY`, `opacity` |
| `fog` | `enabled`, `revealedByMapKey { key: { "q,r": true } }` |
| `tokens` | For each hero: `id`, `name`, `initial`, `x`, `y`, `size`, `groupId`, `milesUsed` |
| `journey` | `gold`, `effects`, `threads`, `used.travel`, `used.camp`, `lastTravelDay`, `rolledDay`, `tonight`, `current` (the event in progress), `log` (up to 100 lines, saved but not shown anywhere), `seq` |

**Other keys:**
- `tsi.explorer.mapImage` holds an uploaded map.
- The selection, focus hero, Pick mode and Hide UI are not saved.

**Damaged saves:** a damaged save is set aside as `tsi.quarantine.explorer.save.<stamp>`, and the Explorer starts fresh at Day 1 and saves it at once. A Bastion that has already passed later days then reads Day 1 as a Reset Travel and shifts its days back (§3.1).

### 4.13 The flow of a session, step by step

1. **Open the Explorer.**
   - If this is its first ever opening, it saves Day 1.
   - An event left open last time reopens at its step.
2. **Load a map:** choose it, then **Load**. Set the **Region** if needed; on an uploaded map, it is the Region list that decides events.
3. **Line up the grid** with Hex −/+ and the arrows. Optionally turn on Fog and Snap.
4. **Optionally press Open the Bastion ↗** (§6.3).
5. **Travel.** Drag the heroes, and miles are charged.
   - Once the day's threshold is reached, the road roll may start a travel event or follow-up.
   - The DM plays it in the event window.
   - A fight step can send the fight to the Combat Tracker.
6. **Optionally use Roll an event now** for a travel or campfire event.
7. **Make Camp.** The exact sequence (`tools/explorer/tool.js` `makeCamp` 751–770, `rules.js` `R.makeCamp` 677–732):
   1. **Double-press guard.** A second click, Enter or Space within 350 ms, or while camping is still running, is ignored.
   2. **Event in progress?** If one is waiting, it stops here, says "Finish or end the event in progress before you make camp." and reopens the event. The day does not move.
   3. **It reads the Bastion's save** as last saved (`TSI.store.fresh('tsi.bastion.state')`), even if the Bastion is open in another window. It only reads it.
   4. **`R.makeCamp`:**
      1. Works out the event context: the Region, the loaded map, and what is near the middle of the party.
      2. Fixes the night's event, if there is one:
         - a main event left due by an **old save** (it pushes any follow-up due tonight back a day);
         - otherwise tonight's set-up campfire event (it too pushes a follow-up on its last day back a day);
         - otherwise a follow-up on the last day of its window.
      3. **Day + 1.** Any active weather film is cleared.
      4. **Weather:** if at least 3 days have passed since the last weather, and a random roll is under 0.45, one of the 4 weathers is picked at random. `lastWeatherDay` becomes the new day.
      5. **New day:**
         - every hero's miles go to 0, and `milesAdjust` to 0;
         - Active Effects that have run out are removed;
         - follow-ups whose window has passed are dropped.
      6. **The night's event:** the fixed one from step 2, otherwise the campfire roll (25%, skipped after weather or after that day's travel event). The event begins, and its first step's outcomes are applied and saved.
      7. **The Bastion's news:** `TSI.campaign.ironbowNews(bastionSave, dayBefore, newDay)` lists what the Bastion has due on the new day (§6.2). If there is anything, it is queued last.
      8. **Next road-roll distance:** 6 to 24 miles. `travelEventDay` is reset.
   5. **It saves** (`tsi.explorer.save`): the page's copy changes at once and the browser database about 120 ms later. From then the Bastion can see the new day.
   6. It clears the notice, then refreshes the Travel panel and the weather film.
   7. **The pop-ups follow in turn:**
      1. the night's event;
      2. the weather pop-up;
      3. **"The Ironbow sends word…"**, with **Open the Bastion ↗** and **Close** (Close is the main button).
8. Repeat from step 5 for each new day.
9. **Export Save** downloads the campaign file, covering both tools (§5.13 and §6.3).

---

## 5. The Ironbow Bastion Manager

### 5.1 The screen

**The page never scrolls.** It has a slim header; the **Bastion Map** fills the rest. Every panel opens as a pop-up over the map, only one at a time. Each panel has **Close** and also closes with Esc. All panels are kept up to date by `renderAll`, whether they are open or not.

**Header** (tool.js 482–501):
- the wordmark "The Ironbow" and the subtitle "Bastion Manager • day by day with the Explorer";
- **Party Level**, a list from 1 to 20;
- **Compendium**;
- **Reset**;
- **Download Save (JSON)** and **Import Save (JSON)**.

**Top bar over the map:**
- **Day status** (§3.8), and **Finish Day N** when a day is part-way.
- **Treasury:** a coin icon, a number box and "gp". It saves on Enter or when you leave the box. A typed value is kept at 0 or more (a failed Host Delegation can take the treasury below 0: §5.7).
- **Facilities count:**
  - it counts every built facility, including the starting five;
  - clicking it opens Construction;
  - hovering lists each facility, with "(Under Repair until Day N)" or "X: building, N days left".
- **Orders count:**
  - clicking it opens Pending Orders;
  - it glows gold while an order is waiting for a roll;
  - hovering lists the orders.
- **"Under Repair: X (working again on Day N)"**, only while something is Under Repair.

**The map:**
- One base painting with up to eight building overlays. It is fitted at 3:2 and never cropped.
- Built buildings appear; buildings Under Repair are darkened.
- It has no hotspots or labels.

**Crest badge** (top right of the map area):
- It shows the crest, or a faint shield with "Add a crest".
- Its label is the Clan's name, or "Unsworn", once a crest is set; with no crest it reads "Add a crest".
- It opens **Party Identity**.

**Bottom bar:**
- **Left:** **Warehouse**, **Management**, **Day Log**, **Events**.
- **Centre:** the facility grid (5 starting tiles, then 6 slot tiles), with a ▼/▲ toggle to fold it away. Whether it is open is remembered in `tsi.bastion.ui.gridOpen`.
- **Right:** **Clan Influence**, **Favour**, **War Council**.
  - War Council shows a padlock until there is something to fight with or about (§5.10).
  - It glows crimson while a Military Action is waiting.

**Panels:**

| Panel | Opened from |
|---|---|
| Warehouse, Management, Day Log, Bastion Events | The bottom bar's left buttons |
| Clan Influence, Favour of the Gods, Banner & War Council | The bottom bar's right buttons |
| Party Identity | The crest badge |
| Construction | An empty slot tile, or the Facilities count |
| Pending Orders | The Orders count |
| *A facility's own panel* (for example "Barracks") | That facility's tile |
| Hall of Emissaries · Diplomacy & Trade | The Hall's tile (the only way in) |
| Artisan Tools | Inside the Workshop's panel |
| Compendium | The header (a pop-up) |

**Notices when the Bastion opens:**
- an old save was set aside: "A new Bastion, in days.";
- a day was left part-way;
- a Military Action or an attack is waiting;
- a Mercenary Brigade from an older save is now Unsworn.

### 5.2 Party level, slots and unlocks

- **Range:** 1 to 20. A new Bastion starts at **7**.
- **It is set only here.** The Explorer's fights, the Combat Tracker hand-off and the DM doc all read it.
- **Construction slots** (`R.constructionSlotsForLevel`):

| Party level | 1–4 | 5–8 | 9–12 | 13–16 | 17–20 |
|---|---|---|---|---|---|
| Slots | 0 | 2 | 4 | 5 | 6 |

- Slot tiles 1 to 6 open at levels 5, 5, 9, 9, 13 and 17.
- **Locked facilities.** A facility can only be built once the party reaches its required level. Until then its Construction tile is dimmed, reads "Locked: level N" (hover: "Unlocks at party level N.") and can't be clicked (tool.js 2716–2729).
- **Lowering the level keeps every building.** Buildings beyond the new limit show as over capacity (a "!" on the tile), but keep working.
- **Form Clan** needs level 9 or more.

### 5.3 Facilities and their orders

The five **starting facilities** are always built and can't be cleared: **Barracks, Armoury, Watchtower, Workshop, Dock**. The grid shows them in the order Workshop, Barracks, Watchtower, Dock, Armoury.

**Build time depends on the facility's required level**, not on the party's level:
- 21 days at levels 5 to 8 (this includes the level-8 Shrines);
- 28 days at levels 9 to 12;
- 35 days at levels 13 and above.

| Facility (id) | Req. level | Build | Order: days, cost | Choices | When it completes |
|---|---|---|---|---|---|
| **Workshop** (`workshop`) | 5 | start | **Craft**: 3 days, 0 gp | Every item in the Artisan Tools tables chosen, A–Z | 1 of the item to the warehouse (note "Workshop") |
| | | | **Craft Magic Item**: 10 days, 0 gp | Bead of Nourishment, Bead of Refreshment, Charlatan's Die, Bag of Holding, Boots of Striding and Springing, Boots of the Winterlands, Gloves of Swimming and Climbing, Gloves of Thievery, Potion of Healing (greater), Potion of Water Breathing, Ring of Jumping, Ring of Swimming, Ring of Warmth, Rope of Climbing, Stone of Good Luck, Shield of Expression, Walloping Ammunition, Saddle of the Cavalier, Sentinel Shield, Shield, +1, Sword of Vengeance, Wraps of Unarmed Power, +1 | Warehouse. The note "not available until the players reach Level 9" is shown but not enforced. |
| **Barracks** (`barracks`) | 5 | start | **Recruit Defenders**: 5 days, 0 gp | — | Rolls 1d4 itself: "Recruited N defenders." |
| **Watchtower** (`watchtower`) | 5 | start | **Patrol**: 1 day, 0 gp | — | Patrol active until the completion day + 7 |
| **Dock** (`dock`) | 5 | start | **Charter Berth**: 7 days | Keelboat 100 gp, Longship 200, Sloop 400, Cutter 500, Brig 750, Warship 900, Galley 1000, Galleon 1250 | The vessel to the warehouse (note "Dock") |
| **Armoury** (`armoury`) | 5 | start | **Arm Defenders**: 3 days, **100 + 100 × defenders** gp | — | All defenders count as "Armed" (if there are any) |
| **Arcane Study** (`arcane_study`) | 5 | 21 days | **Craft Common**: 5 days, 0 gp | Bead of Nourishment, Bead of Refreshment, Lock of Trickery, Mystery Key, Potion of Climbing | Warehouse |
| | | | **Craft Uncommon**: 10 days, 0 gp | Bag of Holding, Cap of Water Breathing, Circlet of Blasting, Cloak of Protection, Gem of Brightness, Hat of Disguise, Potion of Poison, Potion of Resistance, Potion of Water Breathing, Saddle of the Cavalier, Sending Stones | Warehouse |
| **Garden** (`garden`) | 5 | 21 days | **Harvest**: 7 days, 0 gp | Antitoxin (2 vials), Rations (100), Healer's Kit, Potion of Healing, Basic Poison | Warehouse |
| **Smithy** (`smithy`) | 5 | 21 days | **Craft**: 5 days, 0 gp | Battleaxe, Handaxe, Greataxe, Warhammer, War pick, Longsword, Shortsword, Greatsword, Scimitar, Rapier, Dagger, Spear, Trident, Mace, Morningstar, Flail, Halberd, Glaive, Pike, Lance, Chain shirt, Scale mail, Chain mail, Plate armor, Ring mail, Half plate, Manacles, Caltrops, Grappling hook | Warehouse |
| **Library** (`library`) | 5 | 21 days | **Research**: 5 days, 0 gp | Geographical Scriptures, Religious Scriptures, Combat Scriptures, Political scriptures | Warehouse (note "Library"). No research notes are added (B16). |
| **Hall of Emissaries** (`hall_of_emissaries`) | 5 | 21 days | **Upgrade Hall (Level Up)**: 14 days, 0 gp; plus five diplomatic actions (§5.8) | — | Hall level +1, up to 3. The data's 600 / 1200 gp is not charged (B4). |
| **Shrine of Telluria** (`shrine_telluria`) | 8 | 21 days | **Craft**: 5 days, 0 gp; **Pray**: 1 day, 0 gp | Craft: Tellurian Root Charm, Tellurian Stone Charm. Pray: Telluria's Guidance, Telluria's Embrace, Telluria's Blessing | Charm to the warehouse. Prayers: see below. |
| **Shrine of Aurush** (`shrine_aurush`) | 8 | 21 days | **Craft**: 5 days; **Pray**: 1 day | Aurush Sun Charm, Aurush Ember Charm; Aurush's Insight, Aurush's Radiance, Aurush's Blessing | As above |
| **Shrine of Pelagos** (`shrine_pelagos`) | 8 | 21 days | **Craft**: 5 days; **Pray**: 1 day | Pelagos Tide Charm, Pelagos Current Charm; Pelagos's Tidings, Pelagos's Deep Rest, Pelagos's Blessing | As above |
| **Gaming Hall** (`gaming_hall`) | 9 | 28 days | **Trade**: 7 days, 0 gp | — | Only "→ Completed." Its d100 gold table is not applied (B7). |
| **Laboratory** (`laboratory`) | 9 | 28 days | **Craft**: 5 days, 0 gp | Burnt Othur Fumes (Poison), Essence of Ether (Poison), Torpor (Poison), Acid vial, Alchemist's fire, Basic poison, Antitoxin, Firebomb (reskinned alchemist's fire), Frost vial (cold variant), Sticky bomb (glue grenade), Potion of healing (common), Potion of greater healing (base item), Potion of superior healing (base item), Potion of supreme healing (base item), Potion of climbing (base item), Potion of water breathing (base item), Potion of resistance (base item), Darkvision draught (base item), Stoneskin varnish (base item), Vitality tonic (base item) | Warehouse |
| **Greenhouse** (`greenhouse`) | 9 | 28 days | **Harvest**: 10 days, 0 gp | Greater Potion of Healing, Truth Serum, Assassin's Blood, Pale Tincture, Malice | Warehouse |
| **Menagerie** (`menagerie`) | 13 | 35 days | **Recruit Beast**: 10 days | Ape 500 gp, Black Bear 500, Brown Bear 1000, Constrictor Snake 250, Crocodile 500, Dire Wolf 1000, Giant Vulture 1000, Hyena 50, Jackal 50, Lion 1000, Owlbear 3500, Panther 250, Tiger 1000 | Added to Menagerie Beasts (a beast of the same name adds 1 to its count) |
| **War Room** (`war_room`) | 17 | 35 days | **Recruit**: 7 days, 0 gp | Lieutenant (1), Archers (50), Levy Infantry (150), Line Infantry (100), Heavy Infantry (50), Light Cavalry (50), Shock Cavalry (25) | A depleted regiment of that type is brought back to full strength first; otherwise the unit is added. The upkeep note ("each soldier costs 1 gp every 7 days") is not applied (B7). |

**The prayers** (every Shrine has one of each kind; the dice are rolled automatically):
- **Guidance / Insight / Tidings:** 1d10. On a 4 to 7: "A hint is granted (DM decides the hint)."
- **Embrace / Radiance / Deep Rest:** 1d6. On a 5 or 6: "Long Rest effects granted."
- **Blessing:** 1d20, added as that many per cent to the god's favour bar, up to 100.

**The Armed flag stays on.** Arm Defenders sets `defenders.armed` only if there are defenders at that moment (`rules.js` 1077–1079). After that, defenders added later (Recruit Defenders or **+1 Defender**) count as Armed with no new Arm Defenders order, and the flag also stays on after war casualties take the count to 0 (`war-campaign-rules.js` 1871). The flag is cleared only when the **-1** button takes the count to 0 (`tool.js` 1117–1119), or when an Arm Defenders order completes while there are no defenders, which sets it to off (`rules.js` 1078). This is BAS-31's checker's note, kept.

**Facility levels.** Every built facility is level 1; levels run from 1 to 3. **Only the Hall of Emissaries levels up.**

### 5.4 Construction

**Starting a build** (`R.startBuild`):
- It is refused if:
  - the slot is taken;
  - the party's level is too low;
  - the facility is already built or being built.
- Otherwise it stores `{ facId, status: 'building', startDay, readyDay }` and logs **Construction Started**: "X is under construction (N days: ready on Day D)."

**Finishing a build:**
- This happens only while a day is being passed. On its ready day it becomes `built`.
- The log reads **Construction Complete**, "X is now built and active.", and the word line is "The X is built."

**The Construction panel:**
- The heading reads "Party level N: X construction slots, Y in use (Z over capacity)."
- There is one tile per facility that isn't a starting facility and isn't built or being built:
  - with its painting and its build time;
  - or dimmed, with "Locked: level N", and not clickable.
- Clicking a tile asks "Construct the X? It takes N days." (**Cancel / Construct**).
- The footer reads "Facilities unlock at party levels 5 / 9 / 13 / 17." The three Shrines actually need level 8.
- **Clear extra builds** asks first, then empties every slot. Orders pending at those facilities are not removed, and they still complete.

**The facility grid has 11 tiles:**
- **Built:** the painting, a count of pending orders, a hammer if Under Repair, and "!" if over capacity. Clicking opens its panel.
- **Being built:** an hourglass and days left. Not clickable.
- **Empty and free:** a plus sign. Clicking opens Construction for that slot.
- **Locked:** a padlock.

### 5.5 Orders

**The facility panel:**
- its painting, "Level N", and a status line;
- the orders pending here, with **Resolve** and **Cancel**;
- one card per function: name, cost, "Takes N days", a list of choices, **Issue Order** and notes.
  - **Issue Order** reads **Under Repair** or **Cooldown: N days** when it can't be used.

**Issuing an order** (`R.issueOrder`). It is refused, in this order:
1. if the facility is Under Repair;
2. if **the same facility and function is already pending**: "That order is already pending.";
3. if there isn't enough gold: "Not enough gp. Need Xgp, you have Ygp."

So different functions at the same facility can run together, but each function only once at a time.

**Cost**, the first that applies:
1. Arm Defenders' formula;
2. the chosen option's cost;
3. the function's cost;
4. the first number in its cost text;
5. otherwise 0.

An active Inter-Clan Summit discounts Hall actions.

**The gold comes off at once.** The order is saved as `{ id, facId, fnId, chosen, optionLabel, notes, label: "Facility: Function (Choice)", costGP, issuedDay, dueDay: day + days }`. The log reads **Order Issued**.

**Pending Orders panel:**
- Each order shows "Due Day N (in N days / tomorrow / today)", or "Due now: waiting for your roll".
- "• waiting: the X is Under Repair until Day N" is added where that applies.
- **Resolve** (crimson) shows only on an order waiting for a roll. It is resolved outside a day, so it adds nothing to the word.
- **Cancel** removes the order. **The gold spent is never given back** (B9). A War Action costs no gold. Cancelling one on the day it was queued, with no attack roll since, gives back the Honour/Respect and Political Capital that declaring war cost (§5.10).

**How orders complete:**

| Kind | Orders | What happens |
|---|---|---|
| `simple` | Every order except the Hall's diplomacy, investments and War Actions | Any dice roll themselves; the result goes in the log and the word; there is no pop-up. An order with a choice that isn't a beast, unit or prayer adds 1 of that item to the warehouse. |
| `emissary` | Hall diplomatic actions | If that action is cooling down: removed, and the gold is lost. Otherwise d20 box(es), then an **Order Resolved** pop-up. |
| `network` | Trade Network investments | Applied, then a "… Sealed" or "Routing Doctrine Issued" pop-up |
| `war` | War Actions | Becomes a Military Action, with its muster pop-up |
| `none` | An order whose facility or function no longer exists | Removed quietly |

**The d20 box:**
- It reads "Enter your d20 result" (1 to 20, defaulting to 10), with "Modifier: +N • DC N".
- **Roll 1d20** fills it in. Then **Cancel** or **Continue**.

**Roll tiers** (`R.tierFromRoll`):
- a natural 20 is a Critical Success, and a natural 1 a Critical Failure (no screen ever says "Critical Failure": it is shown as "Bad Failure", and for Hall actions it has its own effect, §5.8);
- DC + 5 or more is a Great Success;
- the DC or more is a Success;
- DC − 5 or less is a Bad Failure;
- anything else is a Failure.

### 5.6 The day engine

See §3.2 to §3.6. The order within each day is:

1. start the day (recovery, wars, repairs, building, contracts and records);
2. sea routes;
3. orders due;
4. the war attack roll;
5. the automatic event and the day's word.

### 5.7 Warehouse, Artisan Tools, Management, Favour, Compendium, Treasury, Day Log

**Warehouse:**
- Its columns are Item / Qty / GP / Notes / Action. Each is editable and saves as you type.
- Buttons: **Add Item** (crimson), **Save Warehouse**, **Clear**.
- When an order adds an item, a row with the same name (ignoring capitals) goes up by 1, and the order's note is added after " \| " unless that row's notes already contain it. Otherwise a new row is added.

**Artisan Tools** (inside the Workshop):
- Six lists, "Set 1" to "Set 6", each choosing one of 9 tables:
  - Smith's Tools (30 items), Alchemist's Supplies (17), Weaver's Tools (19), Leatherworker's Tools (27), Carpenter's Tools (21), Mason's Tools (17), Glassblower's Tools (7), Brewer's Supplies (13) and Calligrapher's Supplies (12).
- The Workshop's Craft list is every item from the chosen tables, A–Z. With none chosen, the list is empty.

**Management** (`renderManagement`, tool.js 1240–1246):
- **Bastion Defenders:** the count, the status ("None recruited", "Armed" or "Unarmed"), and **+1 Defender** / **-1**. The Armed flag stays on as described in §5.3.
- **Menagerie Beasts:** rows with **Remove**, and a stat block on hover.
- **Military:** War Room units, including "Depleted: X/Y" rows, with **Remove** and **Clear**.
- The Watchtower's Patrol has no status here or anywhere else on screen. Only the order's own line, "Patrol active until Day N." (in the Day Log and "The Ironbow sends word…"), says when it ends. If a Clan attacks while it is active and defenders stand, the attack pop-up and the Military Actions list say so (§5.10).

**Favour of the Gods:**
- Three bars from 0 to 100%: Telluria, Aurush, Pelagos.
- Only a Shrine's Blessing prayer fills them (+1d20%).
- At 100%, **Claim** sets the bar back to 0.
- The DM doc shows the favour of the god of the Explorer's Region.

**Compendium:**
- **270 items**, A–Z, with a search box.
- Each has pills, a summary (68 of them are filled in), a card picture (36 of them), and "Craftable at:".
- **Open on Roll20** works online only.
- **Export Compendium JSON** downloads `compendium_items.json`.

**Treasury:**
- A whole number, starting at 0. Typing and every other change keep it at 0 or more, except a failed Host Delegation's −50 gp, which can take it below 0 until the Bastion is next opened, when it reads as 0 (`rules.js` 941–944 and 202; BAS-31 / B17, kept). A negative treasury can pay for nothing.
- **Taken out automatically:**
  - order and investment costs;
  - a failed delegation's −50 gp;
  - war losses.
- **Added automatically:**
  - contract shipments;
  - route sailings;
  - delegation gold;
  - war rewards.
- **Not automated:** Gaming Hall gold, War Room upkeep and event gold.

**Day Log:**
- Newest first, never trimmed; the latest 80 are shown.
- Each entry shows its title, "Day N · YYYY-MM-DD HH:MM" and its text.
- **Clear log** empties it.

### 5.8 The Hall, trade and Clan influence

**Clans.** The display order is Blackstone, Bacca, Farmer, Slade, Molten, Rowthorn, Karr; the keys are the same names in lower case. Each Clan trades:

| Clan | Commodity | Risk |
|---|---|---|
| Blackstone | Timber | low |
| Bacca | Weapons | medium |
| Slade | Steel | medium |
| Rowthorn | Maritime | low |
| Karr | Wool & Furs | high |
| Molten | Precious Metals | high |
| Farmer | Livestock | high |

**Standing, per Clan:**
- **Political Capital** (−100 to +100, starting at 0).
- **Honour/Respect** (−5 to +5, starting at 0).
- **Support** = clamp(round((PC + 100) / 2 + HR × 4), 0, 100). Neutral is 50 per Clan, 350 in total.
- Also kept but with no use today:
  - `diplomacy.rep` (always 0, since nothing changes it; it is, however, already added to the Hall's Diplomacy modifier, kept between −5 and +5);
  - `trustedClientsByClan` (from the archived Brigade; never read).

**What changes Political Capital:**

| Source | Change |
|---|---|
| Hall roll for Trade Agreement, Writ or Consortium | +25 / +15 / +8 / −10 / −20 by tier, to the target Clan |
| Inter-Clan Summit | The same amounts, to **both** Clans in the pair |
| Host Delegation (its own two rolls) | +15, +8, 0 or −12 |
| Council Ledger ruling | +6 / +2 / −4 for the route's Clan; −2 on a deadlock |
| Declaring or renewing war | −30 / −40 / −50 by the army's BV (also Honour/Respect −3 / −4 / −5) |
| Cancelling a War Action on the day it was queued, with no attack roll since | The declaration's PC (and Honour/Respect) cost is given back (`R.undoWarDeclaration`, war-campaign-rules.js 967–1003) |
| Battle result against that Clan | Raid −10 / +8 · Skirmish −6 / +6 · Seize Outpost −12 / +10 · Defend Bastion +6 / −8 (win / lose) |
| The **Honour Change** button | Resets that Clan's PC to 0. It is shown only at ±100. |

**Honour/Respect** is changed only by the DM typing it in, by declaring or renewing war, and by cancelling a War Action on the day it was queued, which gives the declaration's cost back.

**Clan Influence panel:**
- One row per Clan: a PC bar centred on zero, Honour Change (at ±100), an Honour/Respect box, and "Support **N**/100".
- **Favour Tokens:** "Earned from strong delegations. Spend later to influence negotiations." The only source is a Host Delegation with 2 successes. **Nothing spends them.**

**The Hall of Emissaries:**
- Party level 5; it takes 21 days to build. Its tile opens **Hall of Emissaries · Diplomacy & Trade**.
- **Level 1 to 3** (L1 / L2 / L3).
- The **Upgrade** pill issues Upgrade Hall: 14 days, 0 gp, one at a time.
- **Diplomacy modifier** on every Hall roll: L1 **+2**, L2 **+4**, L3 **+6**.

**The Hall panel's layout** (`tool.js` 2063–2195):
- **Its head:** "Hall of Emissaries", the level badge (L1–L3), the **Upgrade** pill, then **Routes**, **Resolve** and **Council Ledger** (or **Council Ledger (n)**, highlighted, while disputes wait).
- **Above the records:** "Active passive income: +N gp a week (each contract sends a shipment every 7 days)." (the sum of every Trade Agreement, Writ and Consortium's per-shipment income), or, with none, "No active contracts. Use the Hall of Emissaries to create agreements, summits and charters."
- **Record boxes** (`recordBox`, `renderDiplomacy`): **Trade Agreements**, **Delegations**, **Summits**, **Arbitration** and **Consortiums**. Each row shows the record's title and a line such as "Clan Karr • 21 days remaining (3 shipments) • +90 gp a shipment"; a delegation or summit shows just its days. An empty box reads "None.".
- **The Hall's own column:** its painting, one row per diplomatic action, and the **Ironbow Trade Network** section (`tradeNetworkSection`):
  - "Consortium status: Active/Inactive • Disrupted: n • Disputes awaiting judgement: n";
  - four stats: **Market Stability** (n%), **Expected Income / Week** (n gp: one sailing of every route that isn't disrupted), **Yield Upgrades** (+n%) and **High-Risk Routing** (Enabled / Disabled);
  - the three investment pills (below);
  - one row per route that hasn't expired: "<Clan> (<commodity>)" and "Risk: … • Status: … • Est. yield: N gp • Next sails: Day N", or "No routes recorded yet.".
- **Footer:** **Clear Diplomacy Records**.

| Action | Hall level | Cost | Order days | Record lasts | Income / one-off | DC |
|---|---|---|---|---|---|---|
| **Secure Trade Agreement** | 1 | 250 gp | 7 | 1, 3 or 6 weeks chosen (default 3) | 60–140 gp a shipment | 14 |
| **Host Delegation** | 1 | 150 gp | 5 | 14 days | one-off 80–220 gp | 13 (plus Diplomacy 13, Insight 12) |
| **Inter-Clan Summit** | 2 | 450 gp | 14 | 21 days | a discount on Hall actions | 12 |
| **Secure Writ of Authority** | 3 | 600 gp | 10 | 28 days | 90–190 gp a shipment | 15 |
| **Trade Consortium** | 3 | 900 gp | 14 | 35 days | 140–260 gp a shipment, and opens a sea route | 16 |

**Targets:**
- Trade Agreement and Host Delegation choose from "Clan Blackstone, Clan Rowthorn, Clan Karr, Clan Farmer, Clan Slade, Clan Bacca, Clan Molten".
- The Summit chooses a pair: Blackstone + Rowthorn, Blackstone + Karr, Rowthorn + Karr, Farmer + Slade, Bacca + Molten.
- The Writ and the Consortium choose from Blackstone, Karr, Bacca, Farmer, Molten, Slade, Rowthorn.

**Issuing a Hall action.** A planning box opens:
- **Select target**;
- for a Trade Agreement, **Duration** ("1 week (1 shipment)", "3 weeks (3 shipments)", "6 weeks (6 shipments)");
- for a Host Delegation, **Tone** ("Conciliatory (safer)", "Assertive (balanced)", "Opportunistic (higher risk)").

Its buttons are **Cancel**, plus **Negotiate**, **Receive Delegation** or **Proceed**.

**Tiers for Hall actions:**

| Tier | Days added to the record | Income × | PC | Cooldown |
|---|---|---|---|---|
| Critical Success | +14 | 1.35 | +25 | — |
| Great Success | +7 | 1.20 | +15 | — |
| Success | 0 | 1.00 | +8 | — |
| Failure | −7 | 0.75 | −10 | — |
| Bad Failure | −14 | 0: no deal | −20 | 14 days on that action |
| Natural 1 | counts as 0 / ×1 / +0, no cooldown: the deal is signed in full, but the pop-up says "Bad Failure" (B20) | | | |

**Records and contracts:**
- A record lasts at least 7 days and at most 365.
- A contract sends `ceil(days / 7)` shipments.
- Contracts add a "… Contract" item to the warehouse; a Summit adds "Summit Charter".

**Host Delegation:**
- The main roll only sets the delegation's length and any cooldown.
- Then Diplomacy (Hall modifier + tone modifier of +2 / 0 / −2, DC 13) and Insight (DC 12):

| Result | PC | Favour Token | Gold |
|---|---|---|---|
| 2 successes | +15 | +1 | + the one-off |
| 1 success | +8 | — | + the one-off |
| 0 successes, but a roll within 2 of its DC | 0 | — | + the one-off |
| 0 successes otherwise | −12 | — | **−50 gp** (no floor: the treasury can go below 0, §5.7) |

- The one-off is 80–220 gp: ×0.85 if Conciliatory, ×1.15 if Opportunistic.

**Inter-Clan Summit:**
- On a Bad Failure there is no record.
- Otherwise its discount is 35% / 30% / 25% / 20% / 25% (Critical / Great / Success / Failure / natural 1), for 14 to 35 days.
- The discount applies to every Hall diplomatic action issued while it runs, but not to Upgrade or to investments.

**Secure Writ of Authority:** its promised "+2 to Council Verdict rolls" is never granted (B6).

**Trade Consortium:**
- It also sets the Trade Network active; it never goes inactive again.
- It opens a sea route for the target Clan, **unless a route with that Clan exists in any status, including expired** (B21).
- A Consortium pays twice: its contract shipment and its route's sailing (B3).

**Sea routes:**
- A route is `{ clan, commodity, risk, openedDay, expiresDay: +35, nextDay: +7, yieldGP: the Consortium's per-shipment income, status }`.
- It expires at a day's start if its Consortium record has gone, or the day is past `expiresDay`.
- **Each sailing:**
  - A disrupted route pays nothing.
  - Low and medium-risk routes pay automatically.
  - High-risk routes, and every route while High-Risk Routing is on, need a d20 against:

    `R.routeDC` = 12 + stability modifier (≥85: −2, ≥70: −1, ≥50: 0, ≥35: +1, below: +2) + risk modifier (high +3, medium +1) + 2 with High-Risk Routing, kept between 6 and 20.

    The roll modifier is 0.
  - **The results:**
    - Critical or Great Success: pays ×1.2;
    - Success: pays;
    - Failure: the route is **Disrupted**, with no dispute filed;
    - Bad Failure or a natural 1: Disrupted, Market Stability −10 (high risk) or −6, and a **dispute** is filed.
- **Payout** = floor(yieldGP × (100 + yield bonus % + 20 if High-Risk Routing) / 100).
- **Sailings per Consortium result:** Critical Success 5, Great Success 5, Success 4, Failure 3.

**Trade Network investments** (pills in the Hall; one at a time; they need an active network):

| Pill | Cost | Days | Effect |
|---|---|---|---|
| Invest: Stability | 75 gp | 7 | Market Stability +8 (to a maximum of 100; it starts at 75) |
| Invest: Yield | 90 gp | 7 | Yield bonus +5% (to a maximum of 200) |
| Enable / Disable High-Risk Routing | 0 gp | 1 | Switches it. When on: every route rolls, DC +2, payout +20%. |

**The Hall panel's other pills:**
- **Routes** opens the **Sea Trade Routes** map: one glowing overlay per live route. Trade Agreements never glow (BAS-27).
- **Resolve** settles routes that are due.
- **Council Ledger (n)** opens the disputes.

**Council Ledger:**
- Each dispute offers **Rule for <Clan>**, **Split Claims** or **Rule for Ironbow Trade Consortium**.
- A "Council Verdict" d20 follows: modifier 0, **DC 13**.
- **Pass:**
  - the route is restored to Active;
  - PC +6 / +2 / −4 and Market Stability −1 / +2 / +4 respectively.
- **Fail (deadlock):** PC −2 and Stability −2, and the dispute stays.
- A ruling costs no gold and no days.

**Clear Diplomacy Records** (after a confirmation) resets the diplomacy records, cooldowns and tokens. It does not change routes, the Ledger or PC directly, but with every Consortium record gone, every sea route expires at the next day's start (and, because of B21, those Clans' routes can't be reopened).

### 5.9 Identity and the crest

**Identity (changed on 22 October 2026, Strip Back step S07; before it, a party could found a Clan, and `organization`, `clanHonor` and the Form Clan screen described here earlier were removed, with the conversion in `tools/bastion/strip-back-rules.js` step `identity`; commit `b337232` has the old code):**
- A party can no longer found a Clan. The Bastion saves an optional **`partyName`** (text, at most 40 letters, default empty; tidied by `R.cleanPartyName`: one space between words, no angle brackets or hidden characters).
- **The Party Identity panel** (a small panel, opened by clicking the crest badge) holds:
  - **Party Name (optional)**: saved on Enter, on leaving the box or on Escape, never on each key;
  - the large crest, with the Party Name above it when there is one;
  - **Create in the Clan Crest Creator ↗** (the one main button while there is no crest), **Upload a picture…** (**Upload another…**) and **Remove**.
- The Party Name shows only above the crest (on the badge and in this panel). The crest and the name are there from the first day: there is no level, gold or support gate.
- **A Bastion that had founded a Clan:** its name becomes the Party Name, once, if the Party Name is empty; `organization`, `clanHonor` and `trustedClientsByClan` are dropped from the live save (the copy set aside holds them), and the report's "Your Party" paragraph says the chief, motto and Clan Honour are not kept. The seven Clans' Honour/Respect and Political Capital are not touched.
- The badge shows the Party Name (two lines at most, the full name as its tooltip) above the crest, and "Add a crest" under the empty shield while there is no crest. Its spoken name is "Crest of <Party Name>" ("Crest of the Ironbow" with no name).

**The crest:**
- It is saved apart from the state as `tsi.bastion.crest { dataUrl, key, name, design? }`, at 512 px or less on its longest side.
- It is shown on:
  - the map badge;
  - Party Identity;
  - (the Form Clan box and the War Table's tokens were removed with founding a Clan and the war game, 22 October 2026).
- **Ways to set it:**
  - **Create in the Clan Crest Creator ↗** opens the Creator in a new window.
  - The Creator's **Use for the Bastion** writes a 512 × 512 PNG and its design to the hand-off `tsi.suite.handoff-crest`. The Bastion then asks "Use this crest for the Bastion?" (**No / Use this crest**) as it opens, within 2 seconds, or at once if it is already open. While this question is open, no days pass.
  - **Upload a picture…** takes PNG, JPG, WebP or GIF up to 25 MB, shrunk to 512 px.
  - **Remove** clears it.
- The saved `design` is not read by anything yet.
- **The crest does not appear in the Explorer.**

### 5.10 War

**Forces:**
- Defenders: from the Barracks (+1d4 per order); the Armoury arms all of them at once (and the Armed flag then stays on: §5.3).
- Beasts: from the Menagerie.
- Lieutenants and regiments: from the War Room. An Unsworn party can recruit them, but only a Clan can commit them.

**Unit profiles** (soldiers, Cohesion, Attack, Defence, Move, Resolve, BV):

| Unit | Soldiers | Cohesion | Attack | Defence | Move | Resolve | BV | Notes |
|---|---|---|---|---|---|---|---|---|
| Levy Infantry | 150 | 4 | +2 | 11 | 3 | +0 | 3 | |
| Line Infantry | 100 | 5 | +4 | 13 | 3 | +1 | 5 | |
| Heavy Infantry | 50 | 6 | +4 | 15 | 2 | +2 | 7 | |
| Archers | 50 | 4 | +4 ranged, +1 melee | 11 | 3 | +0 | 5 | range 6 |
| Light Cavalry | 50 | 4 | +4 | 12 | 5 | +1 | 6 | Charge |
| Shock Cavalry | 25 | 5 | +5 | 14 | 4 | +1 | 8 | Strong Charge |
| Lieutenant | | | | | | | 2 | +2 Resolve to the formation it leads; one sure Rally per battle |

There are 13 beast profiles (for example Owlbear: Cohesion 7, Attack +6, Defence 13, Move 4, Resolve +2, BV 10, Terror).

**How defenders fight on the War Table** (`war-units-data.js` `defenders`; `R.defenderPlan`, war-campaign-rules.js 606–637):
- Armed defenders form **Bastion Defender detachments** with the Levy Infantry profile, full strength at 150 (a smaller detachment has Cohesion and BV scaled to its headcount, Cohesion at least 1).
- **75 or more** defenders make detachments of up to 150, split evenly.
- **Fewer than 75** support the committed regiments instead: +1 Cohesion per 5 armed defenders, at most +2 (10 defenders) per regiment. Any left over form one small detachment, so an army of defenders and beasts still fights.
- **Unarmed defenders** fight the same way at −2 Attack, and support at +1 Cohesion per 10, at most +1.

**Banner & War Council.** The panel opens once there is any defender, beast, War Room unit, war, War Action or Military Action. Before that: "Recruit defenders at the Barracks to raise your banner (or take in a beast at the Menagerie, or a unit at the War Room)." It shows:
- **Military Actions** (waiting or under way);
- **Wars** (each with **Make peace**);
- the **War Action** form;
- the **War Log** (the 20 newest reports, each with **View**).

**The Military Actions box** (`renderMilitary`, tool.js 1667–1695). Each row shows:
- its name, for example "Seize Outpost vs Bacca";
- "Committed: …", or for an attack "Clan X attacked your Bastion on Day N. Defending it: …" (or "nobody");
- a status line, for example "Ready to begin. First: the Weather Conditions roll.", "Weather rolled. Next: the Morale roll.", "Battle under way: round 3 of 6." or "The battle is over. Next: the War Report." (`R.militaryStatus`);
- the Patrol line, if it applies (below), and chips for the enemy force and the Weather, Morale and Luck so far;
- **Call off** (only before the battle's first activation, never in a defence) and the main button: **Begin Military Action**, **Defend the Ironbow**, **Continue** (once the rolls have started) or **See the War Report** (an attack nobody could defend).

While any Military Action waits, **Queue War Action** stops being crimson: the waiting action is the panel's main action.

**The Wars box** (`renderWars`, tool.js 1700–1720). Each war reads "Clan X", then "Since Day N · peace after N more quiet days · their next attack roll: Day N" (or "peace on the next day, once nothing between you is waiting"). While **Make peace** isn't allowed (something involving that Clan is still waiting), its button is greyed out and the reason is shown under the war's line.

**The War Action form:**
- **Target Clan** (any of the seven);
- **Objective:** Raid, Skirmish or Seize Outpost;
- **Enemy force:** Small local force, Established local force (the default) or Major force;
- **Forces to commit**, with availability notes;
- an **Intelligence** estimate, for example "Estimated enemy: 23–33 Battle Value; about 3 to 5 formations; archers reported.";
- "Your army: N Battle Value";
- the cost line;
- **Queue War Action**.

**Who can be committed** (`R.warCommit2`, war-campaign-rules.js 521–546; tool.js 1453–1462):
- Each Lieutenant leads one formation (a regiment or a defender detachment), so the Lieutenants committed are capped at the number of those formations.
- The form's hint reads "Available: N defenders, N Lieutenants, N regiments, N beasts." then "Everything can be committed." or, while Unsworn, "Unsworn war is limited to defenders and beasts."
- If more Lieutenants are typed than can lead, it adds "Each Lieutenant leads one regiment or defender detachment, so only N of them can march with these forces." (or "none of them").

**The enemy army:**
- It is drawn up once per target, objective and size, with seeded dice, and kept until a battle closes that mission. At most 12 missions are kept.
- **Its budget** = round(force base × objective × variation):
  - force base: Small 18, Established 28, Major 40;
  - objective: Raid ×0.85, Skirmish ×1.0, Defend ×1.1, Seize Outpost ×1.2;
  - variation, a saved d6: ×0.85 (1–2), ×1.0 (3–4), ×1.15 (5–6).
- **Captains:** one at a budget of 14, two at 26, three at 38; Farmer gets one more. Each costs 2.
- **Clan variants**, fielded 75% of the time:
  - Blackstone Wardens;
  - Bacca Stoneguard and Bacca Cragmen;
  - Rowthorn Riverwardens;
  - Karr Shieldbearers;
  - Farmer Pikes;
  - Molten Ironclads;
  - Slade Outriders.
- **Beasts:** Karr's Dire Wolf (from a budget of 28); Molten's Owlbear (28) and Brown Bear (20).

**What declaring war costs.** It is charged at once when the War Action is queued, against that Clan:

| Army BV | Honour/Respect | Political Capital |
|---|---|---|
| up to 19½ | −3 | −30 |
| 20 to 39½ | −4 | −40 |
| 40 or more | −5 | −50 |

The confirmation is "Declare war on Clan X?" (**Cancel / Declare war**) or, when already at war, "Renew the war on Clan X?" (**Cancel / Renew the war**).

**Once queued:**
- The War Action is a pending order: `facId: 'war_council'`, due on the day it was queued + **3**. It costs no gold.
- A new war is recorded as `wars[clan] = { since: day, last: day, next: day + 7 }`. Renewing one keeps `since` and `next`, and sets `last` to today (`R.declareWar`, war-campaign-rules.js 1089–1093).
- **Cancelling on the same day,** with no attack roll since, gives back the Honour/Respect and Political Capital the declaration cost (and removes the war if this order started it). Any later cancel gives back nothing.

**Muster** (on the due day, during that day's orders):
- The order becomes a Military Action.
- The commitment is checked again against what is free now. If nothing that fights is left, the order lapses.
- The word line is "Your army is ready to march on X (Raid)."
- The pop-up offers **Later / Begin Military Action**. A waiting Military Action has no time limit.

**The Military Action's opening rolls:**

| Roll | DC | Pass | Fail |
|---|---|---|---|
| Weather | 12 | Clear Day | A random storm: White Blizzard (Snowstorm, Morale DC +4), Cold Downpour (Rainstorm, +2) or Sun & Heatwave (Heatwave, +3). The Explorer's film plays. |
| Morale | 12 + the storm's increase | High (+2 Resolve) | Low (−2) |
| Luck | 10 | +1 to attacks | −1 to attacks |

**The weather in battle** (both armies; `war-units-data.js` `weather`; war-battle-rules.js 1160, 1409, 1451), on top of the Explorer's film:
- **Snowstorm:** every unit moves 1 less (at least 1).
- **Rainstorm:** ranged attacks −2.
- **Heatwave:** Resolve checks −1.
- Units with the **Hardy** trait (for example Karr Shieldbearers) ignore all three.

**Call off** is allowed until the first unit acts, but never in a Defend Bastion. Nothing is won or lost, the rolls made so far are kept for the next attempt, and the war's cost is not refunded.

**The War Table** (a full-screen battle board):
- **Board:**
  - 22 squares across by default (20 to 24); 10 to 30 deep, from the battle map's shape (12 with no map);
  - a no-deployment strip in the middle;
  - painted terrain: Woods, Bog or marsh, Rubble or rocky ground, Dense woods, Ridge, Cover, Deep water, Sheer cliff, Bridge or ford. The DM can paint it, then press **Done painting**.
- **Deployment:**
  - **Begin Deployment** sets out both armies automatically.
  - The DM can rearrange their own side, and adjust the enemy and the objectives.
  - **Start Battle** locks it in.
- **6 rounds.** Units act one at a time, the sides alternating. The player starts round 1 if Luck passed.
- **Playing it** (`war-table.js` 481–491): the DM sets each of their own unit's orders and presses **Confirm** (or **Cancel**), and presses **Enemy acts** for each enemy activation. At the end, the War Report opens by itself after a moment (**Continue to the War Report** opens it straight away).
- **Orders:** Advance & Attack, March, Hold, Rally, Disengage, Interact (Raid).
- **Attack:** d20 + Attack + modifiers against Defence. It removes 0 to 3 Cohesion. The situational modifiers together stay within −4 to +4:
  - Luck +1 / −1;
  - **Charge** +2 (Light Cavalry and some beasts) or **Strong Charge** +3 (Shock Cavalry);
  - surrounding the target +2;
  - Shaken −2 Attack;
  - Rainstorm −2 on ranged attacks.
- **Defence modifiers:** **Hold** +2 Defence until the unit's next activation; **Cover** +2 Defence against ranged attacks.
- **Morale check:** d20 + Resolve ≥ 10 at half Cohesion or below. A failure makes a Steady unit Shaken; a Shaken unit that fails Routs. Cohesion 0 means Defeated.
- **The enemy AI** is fair and has no randomness.
- **An army breaks** at 60% of its starting BV lost.
- **Objectives:**
  - **Raid:** carry 2 of 3 supply markers home.
  - **Seize Outpost:** hold it at 2 round ends in a row.
  - **Defend:** don't let the enemy hold your depot at 2 round ends in a row.
  - **Skirmish:** the smaller share of BV lost wins. A draw is possible only in a Skirmish.
- **Withdraw** first shows what it would cost if confirmed now (`R.withdrawPreview`, war-campaign-rules.js 1742–1758): the battle counts as lost (in a defence, as losing the defence), with its gold, PC, repairs, soldiers lost, d6 rolls and separations.
- **End the battle** is only for when one side has nothing left on the field: the remaining rounds are played out with nobody moving.
- The battle is saved after every change. **Close** keeps it; **Continue** reopens it.

**Results:**
- **Soldier losses:**
  - 0% for a Steady unit above half Cohesion;
  - 10% at half Cohesion or below, or Shaken;
  - 25% if Routed;
  - 40% if Defeated while your side holds the field;
  - 60% if Defeated while your side lost or withdrew.
- Regiments that lose soldiers become **Depleted**.
- **Routed Lieutenants and beasts** are separated for 7 days.
- **Defeated Lieutenants and beasts** roll a d6:
  - 1: killed;
  - 2: captured on a loss, otherwise badly wounded for 21 days;
  - 3–4: wounded for 14 days;
  - 5–6: recovering for 7 days.
- **Gold and PC:**

| Objective | Victory | Defeat or withdrawal |
|---|---|---|
| Raid | +75 gp; PC −10 | −50 gp (+38 gp if one marker got home); PC +8 |
| Skirmish | +40 gp; −6 | −30 gp; +6 |
| Seize Outpost | +60 gp; −12 | −60 gp; +10 |
| Defend Bastion | +0 gp; +6 | treasury loss and repairs (below); −8 |

- **Clan Honour** (Clan only): +6 for a victory, −8 for a defeat, −4 for a withdrawal. A lost Defend Bastion always counts −8.
- **A draw** changes no gold, Political Capital or Clan Honour. Casualties (counted as a held field), Depleted regiments, separations and the d6 for Defeated Lieutenants and beasts still apply, and it counts as war activity.
- A **War Report** opens, and is kept in the War Log.

**Wars and attacks:**
- **A war ends by itself** after **42** days with no war activity involving that Clan. War activity is queueing, mustering, a battle or an attack.
- **Make peace** ends a war at once. It refunds nothing, and is refused while anything involving that Clan is waiting.
- **The attack roll:** every 7 days of the war, each Clan due rolls a d6; the first 1 attacks. Only one attack waits at a time.
- **An attack:**
  - its force size is d6 (1–2 small, 3–5 established, 6 major);
  - everything free defends (for an Unsworn party, defenders and beasts only);
  - the word line and pop-up read "Sound the horns! Clan X warships are approaching! Defend the Ironbow!", with **Later / Defend the Ironbow**;
  - the battle uses the preset map "The Ironbow coast".
- **If nobody is free to defend,** the battle is lost without being fought.
- **The Watchtower's Patrol** has no status in Management or anywhere else on screen, apart from the order's completion line "… → Patrol active until Day N." in the Day Log (and in that day's word). It is active while today is on or before `patrolUntil`. If a Clan attacks on such a day and defenders stand, the attack pop-up and the Military Actions list say "The Watchtower's patrol saw them coming: your Bastion Defenders have Advantage on all their rolls in this battle (roll two d20s and keep the higher)." (`R.patrolLine`, war-campaign-rules.js 1275–1279). The War Table doesn't roll it.
- **Losing a Defend Bastion** (or withdrawing from one; `applyDefenceLoss`, war-campaign-rules.js 1706–1730):
  - the treasury loses d10 × 5%;
  - **d4 random built facilities go Under Repair** until day + 13 (14 days, the day of the loss included);
  - pending orders at those facilities that were due before the day after repairs end have their due day moved to that day;
  - while Under Repair, a facility takes no new orders and its pending orders wait.
- **"At War" tags** (tool.js 140–243: `tagWars`, `tagAll` and a `MutationObserver`). While the party is at war with a Clan, a small **At War** tag follows that Clan's name across the Bastion's page and every pop-up and notice it opens, and list choices read, for example, "Bacca (At War)". The tags aren't on the War Table, in the suite's top bar or in boxes you type in, and they go when peace comes.

**War data saved in `tsi.bastion.state`:** `military`, `defenderBeasts`, `defenders`, `militaryActions`, `warMissions`, `warMissionSeq`, `warRecovery`, `wars`, `repairs`, `warLog`.

### 5.11 Bastion events

**The d100 table:**

| d100 | Event |
|---|---|
| 01–50 | All Is Well |
| 51–55 | Attack |
| 56–58 | Criminal Hireling |
| 59–63 | Extraordinary Opportunity |
| 64–72 | Friendly Visitors |
| 73–76 | Guest |
| 77–79 | Lost Hirelings |
| 80–83 | Magical Discovery |
| 84–91 | Refugees |
| 92–98 | Request for Aid |
| 99–00 | Treasure |

- Each event has its rulebook description lines. Attack, Criminal Hireling and Lost Hirelings say the facility "can't be used for the next 7 days" (commit `7531f33`, BAS-63).
- **Events are text for the DM only.** Nothing in them changes the Bastion's numbers.
- **Automatic events** come every **28 days from Day 1** (Days 29, 57, 85…), once each. The log reads "Auto event (Day N) → Rolled R → Name", and the word line "Bastion event: Name (rolled R)."
- **Roll Bastion Event** (crimson) in the **Bastion Events** panel rolls one on demand. It adds nothing to the word.
- **The panel shows** (`renderTop`, tool.js 640–681):
  - "The next automatic event: Day N (every 28 days).";
  - before any event, "Click **Roll Bastion Event** to generate a 1d100 event.";
  - afterwards, the last event's name, "Roll: R · Day N", up to its first 12 description lines, and the note "DM note: Some events reference tables from the DMG / Bastion rules. Add your own roll results into the warehouse or log."

### 5.12 "The Ironbow sends word…" in the Bastion

- Lines are collected only while a day is being passed. Anything the DM does by hand, such as Resolve, adds nothing.
- **What adds a line:**
  - recovery, wars ending and repairs;
  - "The X is built.";
  - records ending;
  - "Trade routes sailed: +N gp." or "The sea route to X needs a roll (press Resolve in the Hall).";
  - each simple order's result;
  - Hall tiers, or "needs your roll (press Resolve on it)." / "blocked (the Hall is cooling down).";
  - network orders that are complete;
  - armies mustering;
  - "Sound the horns!…";
  - the automatic event.
- Contract shipment gold is logged, but is not a word line.
- The pop-up shows once, after all the days are passed, under day headings if there is more than one day. **Close** clears the lines it showed.

### 5.13 Bastion saves

| Key | What it holds |
|---|---|
| `tsi.bastion.state` | The whole Bastion (`v: 2`), saved after every change |
| `tsi.bastion.ui` | `{ gridOpen, warNoticed }` |
| `tsi.bastion.crest` | The crest |
| `tsi.bastion.warMap`, `.warTable`, `.warTerrain` | The War Table's uploaded map, its settings and the painted terrain |
| `tsi.quarantine.bastion.state.<stamp>` | A save set aside: from the turns era, or damaged |

**The main state fields:**
- **Core:** `treasuryGP`, `partyLevel`, `builtFacilities`, `builtExtras`, `facilityLevels`, `pendingOrders`, `defenders`, `defenderBeasts`, `military`, `warehouse`, `artisanTools`, `favour`.
- **Days:** `day`, `anchored`, `lastEvent`, `lastEventDay`, `log`, `dayInProgress`, `word`.
- **Political:** `politicalCapital`, `honourRespectByClan`, `clanHonor`, `organization`, `diplomacy`, `tradeNetwork`, `arbitration`, `trustedClientsByClan`.
- **War:** the fields in §5.10.

**Loading:**
- A save from before the days overhaul is set aside, not converted.
- A Mercenary Brigade from Builds 1 or 2 loads as Unsworn.
- A treasury below 0 loads as 0.

**Download Save (JSON)** makes the campaign file (§6.3).

**Import Save (JSON)** refuses:
- turns-era files;
- damaged files;
- a campaign file while the Explorer is open elsewhere.

**Reset:**
- It asks first, then removes `state`, `crest`, `warMap`, `warTable` and `warTerrain`, and reloads.
- `ui` and the Explorer are untouched.
- The fresh Bastion anchors to the Explorer's current day.

---

## 6. How they connect

### 6.1 Explorer → Bastion

| What flows | How | When |
|---|---|---|
| **The day** (`travel.day`) | The Bastion reads `tsi.explorer.save` with `TSI.store.fresh`, straight from the browser database (§3.2). It is the **only** part of the Explorer's save the Bastion uses. (Its **Download Save (JSON)** also reads every `tsi.explorer.*` record, as last saved, to copy it into the campaign file, and its Import checks the Explorer's half of a campaign file with the Explorer's rules. Neither changes the Bastion.) | When the Bastion opens, every 2 s, and when its window is shown again. Make Camp saves (to the browser database about 120 ms later), so a Bastion open in another window passes the new day within about 2 s. |
| **Reset Travel** (the day goes back) | The same read. `R.clockAction` returns `shift`, and `R.shiftDays` moves every stored Bastion day back by the same amount. | The next read after the reset |
| **Opening the Bastion** | **Open the Bastion ↗** in the Travel panel, and in the Explorer's word pop-up, calls `TSI.shell.openWindow('bastion')`. If the Bastion is already open elsewhere (tab guard): "The Bastion Manager is already open in another window. It follows the Explorer's day by itself." A second press within 1.5 s is ignored. | When the DM presses it |
| **A campaign Import made from the Explorer** | Replaces both tools' saves (§6.3) | When the DM imports |
| *Nothing else* | Explorer events, gold, effects, threads, heroes, location, weather and fights never change the Bastion's save. "Clan honour" DM notes point to the Notice Board and are never applied. | — |

### 6.2 Bastion → Explorer

| What flows | How | When |
|---|---|---|
| **The forecast, "The Ironbow sends word…"** | At Make Camp the Explorer reads `tsi.bastion.state` (read only, as last saved) and runs `TSI.campaign.ironbowNews(bastion, dayBefore, newDay)` → `bastionComing` (`shared/js/campaign-rules.js` 53–131). It lists only items falling on the new day. | Once per Make Camp, as the last pop-up |
| **Party level** | `F.partyLevel` reads `partyLevel` from the Bastion's save, kept between 1 and 20, or 7 with "(the Bastion hasn't saved a level yet)". It sets the fight band and goes to the Combat Tracker in the hand-off. | When the Explorer opens, and whenever a fight step is drawn (at most every 3 s) |
| **"Is the Bastion open?"** | The tab guard's regular signal in `localStorage` key `tsi.suite.tabs` | When **Open the Bastion ↗** is pressed, or on a campaign Import |
| **A campaign Import made from the Bastion** | Replaces both tools' saves | When the DM imports |

**When the forecast is empty.** `ironbowNews` returns nothing if:
- there is no Bastion save;
- the save isn't in days (`v: 2`);
- the Bastion isn't anchored;
- the Bastion's saved day is past the day before camp (it is ahead, after a Reset Travel);
- nothing falls on the new day.

**What the forecast can say** (`bastionComing`):

| Kind | Line | Taken from |
|---|---|---|
| built | "The {Facility} is built." | A build's `readyDay` |
| war | "Your army is ready to march on {target} (Raid / Skirmish / Seize Outpost)." | A War Action's `dueDay` |
| roll | "{label} needs your roll." | Any Hall of Emissaries order except Upgrade Hall |
| order | "{label} is complete." | Every other pending order |
| ended | "Your {Trade Agreement / Secure Writ of Authority / Form Trade Consortium} with {Clan} has ended (its last shipment arrived)."; "Your delegation from {Clan} has ended."; "Your Inter-Clan Summit ({pair}) has ended." | Diplomacy `endDay` |
| repairs | "Repairs: the {Facility} is working again." | The repair's last day + 1 |
| recovery | "{name} has found the way back to the Bastion." / "The {beast} is fit to fight again." / "{name} is fit for duty again." | `warRecovery` |
| route | "The sea route to {Clan} needs a roll." | Active routes on `nextDay`, if high risk or High-Risk Routing is on (and `nextDay` ≤ `expiresDay`) |
| attack | "Clan {X} may attack: the Bastion rolls to see." | A war's `next` |
| event | "A Bastion event is due." | The next 28-day mark after the Bastion's saved day |

**How it is shown and worked out:**
- An order at a facility Under Repair is forecast for the day after its repairs end (`campaign-rules.js` 66–67). A lost Defend Bastion has already moved such orders' due days there (§5.10).
- Facility names are built from their ids ("shrine_aurush" → "Shrine of Aurush"); the Explorer page loads the Bastion's rules but not its data files (`shared/data/tools.js` 123–125).
- The pop-up ends with "The Bastion works these out, with any rolls, when it next sees the day." Its buttons are **Open the Bastion ↗** (which closes the pop-up, then opens the Bastion) and **Close**.

### 6.3 Shared pieces

**Two windows, one tool in each.**
- The suite opens one tool per page load. Two tools at once means two browser windows, each opened by `TSI.shell.openWindow(id)` with `noopener,popup` and sized to the current screen.
- **Saves are shared through the browser database:**
  - all windows use the IndexedDB database `tsi.suite`;
  - each page keeps a copy in memory, and writes about 120 ms after a change, or at once when hidden or closed;
  - to see another window's changes, a page calls `TSI.store.fresh(key)`. Only while that page is itself still saving a change to the same key does `fresh` return the page's own (newer) copy; if the database can't be read, it returns the value it last read (§3.2);
  - if IndexedDB fails, `localStorage` is used instead; if that fails too, saves are kept in memory only, and windows can't see each other's changes.
- **Hand-offs between tools use `localStorage`.** A window that is already open hears them through the browser's `storage` event. The Explorer and the Bastion exchange **no** hand-offs or messages with each other: only saves.
- The `postMessage` channel is used only by player-view windows (the battlemap and the notice board), not between these two tools.

**The campaign save.**
- `CAMPAIGN: ['explorer', 'bastion']` (`shared/js/backup-rules.js` 35).
- **Export.** Each of these downloads one file, `tsi-campaign-YYYY-MM-DD-HHMM.json`:
  - the top bar's **Export**;
  - the Explorer's **Export Save**;
  - the Bastion's **Download Save (JSON)**.

  The file is `{ format: 'tsi-backup', version: 1, kind: 'campaign', tools: ['explorer','bastion'], … records }`. It holds every `tsi.explorer.*` and `tsi.bastion.*` record. The other tool's records are read fresh (as last saved).
- **Import:**
  - It is refused if the other tool is open in another window: "… Close it first: a campaign file replaces the Explorer and the Bastion together. Nothing was changed."
  - Each tool's page loads the other's rules only to check the other half of the file first: the Bastion page loads `tools/explorer/rules.js` and `journey.js`, and the Explorer page loads `tools/bastion/rules.js` (`shared/data/tools.js` 93–96 and 123–125).
  - A pop-up shows what the file holds, with a ticked box "First, download a copy of the campaign as it is now", and **Cancel / Import**.
  - Import replaces both tools' keys (any key the file lacks is cleared), then reloads.
  - An older Explorer-only file replaces only the Explorer; a Bastion-only file replaces only the Bastion.
- **The home screen:**
  - **Back up everything** and **Restore** cover every save in the suite's store: every tool's `tsi.*` records, the DM doc's layout and any saves set aside. The hand-offs and the tab guard's signals in `localStorage`, and the DM doc's open flag in `sessionStorage`, are not saves and are not included.
  - A campaign file can't be restored there: "…open the Scarlett Isles Explorer or The Ironbow Bastion Manager and use Import."

**The DM doc** (`shared/js/dmdoc.js`, `TSI.campaign.summary`):
- A floating panel, opened from **DM doc** in the top bar of any window, including the Explorer's and the Bastion's.
- Whether it is open is remembered per window, in `sessionStorage` `tsi.suite.dmdoc-open` (`dmdoc.js` 22–25, 35–36). Its position and size are saved as `tsi.dmdoc.layout`, so they are in Back up everything and Restore. Its size and placement rules are in `shared/js/dmdoc-rules.js`.
- While open, it reads both saves fresh: every 2 s when visible, after its own window saves, and when shown again. It never writes either save.
- **What it shows:**

| Tile | Explorer | Bastion |
|---|---|---|
| Party level | — | `partyLevel`, or 7 with "Bastion not saved yet" |
| Day ("N days passed") | `travel.day` | — |
| Orders pending ("next completes Day N") | the day as "today" | `pendingOrders` (only a save in days) |
| Next word from the Ironbow | "today" | the first `bastionComing` items after today |
| Party gold | `journey.gold` | — |
| Threads, Active Effects, next follow-up, heroes | `journey`, `tokens` | — |
| **Where the party is** | Region (`travel.provinceId`, defaulting to Northern Province) → Clan, chief, god (`regions.js`) | That Clan's **Political Capital** and **Honour/Respect**, and that god's **Favour**. Without a Bastion save: "Open the Bastion to see the Clan's and the god's standing." |

- **"Where the party is" is the only place where the Explorer's location and the Bastion's standings appear together.**

**Regions data** (`shared/data/regions.js`):
- It links each Region to its Clan, `clanKey`, chief, god and temple, and says whether it is an isle (table in §4.6).
- The Explorer uses it to fill in event text and decide the god's lands; the DM doc uses it.
- **The Bastion doesn't read it.** Its own Clan and god keys (`CLAN_KEYS` in `tools/bastion/rules.js` 192, and the `clans` and `gods` lists in `bastion-data.js` 39–47 and 211–215) use the same names, which is what lets the DM doc match them.

**The tab guard** (`shared/js/tabguard.js`):
- Each open window writes `{ at, tool, hidden?, closing? }` to `tsi.suite.tabs` every 2 s.
- A heartbeat counts for 7 s from a visible window, 90 s from a hidden one.
- It warns when the same tool is open twice, or the home screen and a tool are open together. **It never warns about the Explorer in one window and the Bastion in another.**
- `isOpenElsewhere(tool)` is used by:
  - Open the Bastion ↗;
  - the campaign Import refusal;
  - the fight hand-off;
  - the Crest Creator buttons.

**Shared files and functions:**
- The Bastion's Military Action and War Table use the Explorer's films `tools/explorer/assets/overlays/blizzard_overlay.mp4`, `rain_overlay.mp4` and `sun_heat_overlay.mp4`. The weather itself is never shared: the Bastion rolls its own.
- `TSI.campaign.untilText`, `threadDueText` and `rewardLines` are shared by the Explorer and the DM doc. **The Bastion uses no `TSI.campaign` function.**

### 6.4 Timeline: one Make Camp with both tools open in two windows

The Explorer is on the laptop, the Bastion on the TV. Both are anchored on Day 12.

1. **On the laptop, the DM presses Make Camp.**
2. The Explorer checks for an open event, then reads `tsi.bastion.state` as the Bastion last saved it.
3. `R.makeCamp` runs:
   - it fixes the night's event, if any;
   - the day becomes **13**, and the weather may be rolled;
   - miles and expired effects are cleared;
   - the campfire roll is made;
   - `ironbowNews(bastion, 12, 13)` lists what falls due on Day 13;
   - the next road-roll distance is set.
4. **The Explorer saves `tsi.explorer.save`:** its own copy at once, the browser database about 120 ms later.
5. **The laptop shows**, one after another: the night's event, the weather pop-up, then the forecast "The Ironbow sends word…".
6. **On the TV, within about 2 seconds,** the Bastion's 2-second check reads Day 13. `clockAction` says pass 1 day. (If a crest question, a Military Action or the War Table is open, it waits until that is done.)
7. `R.startDay` → Day 13:
   - recovery, quiet wars, repairs, building;
   - contract shipments and records ending.
   The Bastion saves.
8. **Stage `trade`:** routes due on Day 13 sail. d20 boxes appear on the TV for high-risk routes (for every route while High-Risk Routing is on; a disrupted route asks nothing), then "Trade Routes Resolved".
9. **Stage `orders`:** each due order completes, in turn:
   - simple orders silently;
   - Hall actions with d20 boxes and "Order Resolved";
   - investments with their pop-up;
   - a War Action with "Your forces muster for battle" (**Later / Begin Military Action**).
10. **The attack roll:** a d6 for each Clan due. On a 1: "Sound the horns!" (**Later / Defend the Ironbow**).
11. **`R.finishDay`:** on Days 29, 57… the automatic event. The news moves into `state.word`, and the Bastion saves.
12. **The TV shows "The Ironbow sends word…"** with Day 13's actual results.
13. **The laptop and the TV prompt separately.** Neither blocks the other. If the DM makes camp again while the TV is still busy, the Bastion doesn't see Day 14 until Day 13's "The Ironbow sends word…" is closed. About 2 seconds later it passes Day 14 in a new run, with its own prompts and its own word pop-up.

### 6.5 Timeline: with the Bastion shut

1. **Each Make Camp,** the Explorer still reads the Bastion's last save and shows a forecast for the new day.
   - Because the shut Bastion never moves its own "next" days on, repeating things are forecast only for their next occurrence after the Bastion's saved day: route sailings, attack rolls and the 28-day event.
   - If the Bastion has never been opened (no save, or not anchored), there is no forecast.
2. Nothing happens at the Bastion while it is shut.
3. **When the Bastion is next opened** (from Open the Bastion ↗, the home screen or Switch tool):
   - it reads the Explorer's day at once;
   - if it is anchored and behind, it passes **every** missed day in order, each with its own prompts on the Bastion's screen;
   - then one "The Ironbow sends word…" covers them all, under day headings;
   - if it was never anchored, it anchors and passes nothing.
4. **A day left part-way** carries on, with the notice "Day N was left part-way through…".
5. **If the Explorer reset in the meantime and its day is still below the Bastion's,** the Bastion shifts its days back to it instead (§3.7). If the Explorer has since gone past the Bastion's old day, nothing is shifted: the Bastion passes the days from its old day, as in step 3.

### 6.6 The two "word" pop-ups compared

| | In the Explorer (laptop) | In the Bastion (TV) |
|---|---|---|
| What it is | A **forecast** from the Bastion's last save | The **results** of the days just passed |
| When | At Make Camp, as the last pop-up | After the Bastion has passed every new day |
| Simple orders | "X is complete." | The result, for example "… → Recruited 3 defenders." |
| Hall actions | "X needs your roll." | "X: Great Success." (or blocked, or still needs a roll) |
| Leaves out | Shipment gold; normal-risk route income; roll results; the event's name; wars ending after 42 quiet days; Patrol ending | Contract shipment gold; the results of any battle fought while the day was being passed (a Military Action begun from its muster pop-up, or a Defend Bastion); each route's own result (only the total gold); Patrol ending. All but Patrol ending are in the Day Log, and battle results are also in the War Log. |
| Buttons | **Open the Bastion ↗**, **Close** | **Close** |

The forecast can also disagree with the result. For example, a high-risk route on a Consortium signed on a plain Success is forecast to "need a roll" on day +35, but the Bastion expires that route on that day and asks nothing.

---

## 7. What is not connected today

These are facts about the current code:

- **Gold.** The Explorer's party gold and the Bastion's treasury are separate. Nothing moves gold between them in either direction.
- **Time from the Bastion's side.** The Bastion can't move the Explorer's day. It has no day button, and its Reset doesn't touch the Explorer. The Bastion has no button to open the Explorer, apart from the suite's Switch tool menu.
- **Party level.** It can't be set in the Explorer. It shows there only in a fight step's text and in the DM doc's "Party level" tile (the DM doc opens from the Explorer's top bar too).
- **Heroes and forces.** The Explorer's five heroes are unknown to the Bastion. The Bastion's defenders, Lieutenants, regiments and beasts never appear in the Explorer.
- **Location:**
  - the Explorer's map, Region and hero positions don't affect the Bastion;
  - there is no Ironbow pin or location on the Explorer's maps;
  - a war with a Clan changes nothing about travel in that Clan's Region.
- **Standings.** No Explorer event or Thread changes Political Capital, Honour/Respect, Clan Honour, Favour of the Gods, Favour Tokens, facilities, orders, the warehouse or the treasury. Clan-honour DM notes refer to the Notice Board's own filter. "Pelagos' Favour" in the Explorer is an Active Effect, not the Bastion's favour bar.
- **Events and effects:**
  - Explorer Active Effects, Threads and events don't affect the Bastion;
  - Bastion events, wars, attacks, repairs and Military Actions create no Explorer events, effects or threads;
  - Bastion events change no numbers even inside the Bastion.
- **Weather.** Each tool rolls its own. Only the film files are shared.
- **Combat.** Explorer fights use the Combat Tracker; Bastion battles use the War Table. The two are not linked, and Combat Tracker results go only to the Explorer.
- **The crest** doesn't appear in the Explorer.
- **Results.** The Bastion's results never reach the Explorer. The Explorer shows only its own forecast.
- **The Explorer's journey log** is saved but not shown anywhere, and the Bastion doesn't read it.

---

## 8. Key numbers

| Area | What | Value |
|---|---|---|
| Sync | The Bastion reads the Explorer's day | On opening, every 2000 ms, and when its window is shown (not during a run the clock check started) |
| Sync | Store write delay | 120 ms after a change, or at once when hidden or closed |
| Sync | `TSI.store.fresh` returns the page's own copy | Only while that page is still saving a change to the same key (if the database can't be read, the value last read) |
| Sync | Tab guard | Heartbeat every 2 s; counts 7 s (visible) or 90 s (hidden) |
| Sync | DM doc refresh | Every 2 s while open and visible |
| Sync | Explorer re-reads the party level | At most every 3 s, when a fight step is drawn |
| Sync | Double-press guards | Make Camp 350 ms; event buttons 350 ms; Open the Bastion ↗ 1500 ms; open the Crest Creator 1.5 s |
| Explorer | Miles per hex | 6 |
| Explorer | Daily mile limit | 30 + `milesAdjust` (minimum 0) |
| Explorer | Pace bands | Slow ≤18, Normal ≤24, Fast ≤30 |
| Explorer | Road-roll threshold | 6–24 miles (random each day) |
| Explorer | Travel event chance | 30%; never two days running |
| Explorer | Campfire event chance | 25%; skipped after weather or a travel event that day |
| Explorer | Weather | 45% once 3 days have passed since the last |
| Explorer | Fog radius | 2 hexes |
| Explorer | "Near" a river or coast | Within 2 hexes (12 miles) |
| Explorer | Hex radius | Default 38; 10 to 220; steps of 2 |
| Explorer | Token size | Default 46; 24 to 140 |
| Explorer | Board width | 1440 units |
| Explorer | Uploaded map limit | 4 MiB |
| Explorer | Maps / pins | 10 maps at 2048 × 1536; 33 pins, 15 shown |
| Explorer | Events | 17 travel (16 live), 12 campfire, 3 follow-ups |
| Explorer | Fight bands | Levels 7–10 (level ≤10), Levels 11–16 (≥11); 7 with no Bastion save |
| Explorer | Journey log | 100 lines |
| Bastion | Party level | 1–20; starts at 7 |
| Bastion | Construction slots | 0 / 2 / 4 / 5 / 6 at levels 1–4 / 5–8 / 9–12 / 13–16 / 17–20 |
| Bastion | Build time | 21 days (required level 5–8), 28 (9–12), 35 (13+) |
| Bastion | Facilities | 5 starting, 13 buildable |
| Bastion | Recruit Defenders | 5 days, +1d4 |
| Bastion | Arm Defenders | 3 days, 100 + 100 × defenders gp |
| Bastion | Patrol | 1-day order; lasts 7 days |
| Bastion | Craft / Harvest / Research | 3–10 days (see §5.3) |
| Bastion | Charter Berth | 7 days, 100–1250 gp |
| Bastion | Recruit Beast | 10 days, 50–3500 gp |
| Bastion | War Room Recruit | 7 days, 0 gp |
| Bastion | Prayers | 1 day: 1d10 (4–7 hint), 1d6 (5–6 Long Rest), +1d20% favour |
| Bastion | Automatic event | Every 28 days from Day 1 (29, 57, 85…); d100 |
| Hall | Levels and roll modifier | 1–3; +2 / +4 / +6 |
| Hall | Upgrade Hall | 14 days, 0 gp |
| Hall | Actions (cost, order days, DC) | Trade Agreement 250 gp, 7 days, DC 14; Host Delegation 150, 5, DC 13 (+ Diplomacy 13, Insight 12); Summit 450, 14, DC 12; Writ 600, 10, DC 15; Consortium 900, 14, DC 16 |
| Hall | Record lengths | Trade Agreement 7/21/42 days base; Delegation 14; Summit 21; Writ 28; Consortium 35; ±14/7/0 by tier; minimum 7, maximum 365 |
| Hall | Income per shipment | 60–140 / 90–190 / 140–260 gp × tier (1.35 / 1.2 / 1 / 0.75 / 0) |
| Hall | Delegation | One-off 80–220 gp (×0.85 / ×1.15 by tone); total failure −50 gp (no floor) |
| Hall | Summit discount | 35 / 30 / 25 / 20% (natural 1: 25%) |
| Hall | Bad Failure cooldown | 14 days on that action |
| Trade | Shipments, sailings | Every 7 days from each one's start |
| Trade | Route life | 35 days |
| Trade | Route DC | 12 + modifiers, kept to 6–20; High-Risk Routing +2 DC and +20% payout |
| Trade | Market Stability | Starts at 75; +8 per Stability Investment; −10 (high-risk route) / −6 (any other route) on a catastrophe |
| Trade | Investments | Stability 75 gp / 7 days; Yield 90 gp / 7 days (+5%); Routing 0 gp / 1 day |
| Trade | Council Verdict | DC 13, modifier 0 |
| Politics | Political Capital, Honour/Respect, Support | −100…+100; −5…+5; 0…100 (neutral 50) |
| Politics | Form Clan | Level 9+, total support 360+, 3 Clans at 55+ |
| Politics | Clan Honour | 0–100, starts at 40; +6 / −8 / −4 after battles |
| War | Declaring war | HR −3 / −4 / −5 and PC −30 / −40 / −50 at army BV ≤19½ / 20–39½ / 40+; given back if cancelled the same day with no attack roll since |
| War | Muster | 3 days after queueing |
| War | Attack roll | Every 7 days of a war; d6, a 1 attacks |
| War | War ends by itself | 42 quiet days |
| War | Opening rolls | Weather DC 12; Morale DC 12 (+4 / +2 / +3 in storms); Luck DC 10 |
| War | Weather in battle | Snowstorm Move −1; Rainstorm ranged −2; Heatwave Resolve −1; Hardy ignores them |
| War | Attack modifiers | Luck ±1; Charge +2 / Strong Charge +3; surround +2; Shaken −2; within ±4 in all |
| War | Defence modifiers | Hold +2; Cover +2 against ranged |
| War | Defenders in battle | Detachments of up to 150 from 75 armed; fewer support at +1 Cohesion per 5 (max +2 per regiment); unarmed −2 Attack, +1 per 10 (max +1) |
| War | Enemy budget | Base 18 / 28 / 40 × objective (0.85 / 1.0 / 1.1 / 1.2) × variation (0.85 / 1.0 / 1.15) |
| War | Battle | 6 rounds; 22 squares across (20–24); 10–30 deep; breaks at 60% BV lost |
| War | Losses | 0 / 10 / 25 / 40 / 60% of soldiers |
| War | Injuries | Separated 7 days; wounded 14; badly wounded 21 |
| War | Lost Defend Bastion | d10 × 5% of the treasury; d4 facilities Under Repair for 14 days |
| War | Kept | 12 missions; War Log shows 20 reports |
| Crest | Size | 512 px on its longest side; upload up to 25 MB; hand-off PNG up to 3,000,000 characters |
| Bastion | Day Log shown | The latest 80 entries |
| Bastion | Compendium | 270 items; 68 summaries; 36 card pictures |

---

## 9. The rules any new feature must respect

From the project's `CLAUDE.md`, which overrides the original handover (except item 7, which comes from `docs/PLAN.md` and the code):

1. **It runs by double-clicking `index.html`, with no internet.**
   - No server, no install.
   - Nothing loads from the internet automatically: no CDNs, no Google Fonts. Fonts, libraries and media are bundled locally, with their licences in `licences/`.
   - Links to websites (Roll20, stat blocks, the Knightly Treasures shop) are fine; they only work online.
2. **No ES modules and no `fetch()` of local files.**
   - No `import` and no `<script type="module">`.
   - Code loads with plain `<script>` tags.
   - Content data is stored as `.js` files that assign to `window.TSI_DATA`.
   - No service workers.
3. **Canvases:** never read pixels from, or export, a canvas that has had a bundled image drawn on it. Pictures the user uploads are fine.
4. **Avoid build steps.** Files should stay directly editable.
5. **No online services,** except the Notice Board's ★ link to Matt Owen's Knightly Treasures shop. No other tool goes online. No logins, analytics or paid APIs. No committed keys or passwords, except the Knightly Treasures Firebase web settings (a public identifier), kept only in `tools/quests/shop-link.js`.
6. **Saves stay in the browser:**
   - autosave locally;
   - **every storage key starts with `tsi.`**;
   - every tool that saves has **Export and Import** buttons using a JSON file;
   - the home screen has **Back up everything** and **Restore**;
   - **Import always asks before replacing anything.**
7. **One tool per page load** (`index.html?tool=<id>`). *This comes from `docs/PLAN.md` ("One tool per page load", line 359; IndexedDB saves, line 398) and `shared/js/shell.js` 4–8, not from `CLAUDE.md`, whose own rule here is only: player-view windows use `postMessage`; no local `fetch` or ES modules.* Using two tools at once means two windows:
   - they share saves through the browser's storage (IndexedDB `tsi.suite`, with `TSI.store.fresh` to read another window's latest save);
   - they send one-off messages as hand-offs in `localStorage`;
   - `postMessage` is used only for player-view windows a tool opened itself (the battlemap and the notice board).
8. **Edge comes first** (Chrome behaves the same). Problems in Firefox are noted in `docs/KNOWN_ISSUES.md`.
9. **Screens:**
   - The laptop is 2560 × 1600 at 150%: about **1707 × 930** inside maximised Edge, at pixel ratio 1.5.
   - The TV is **1920 × 1080** at pixel ratio 1.
   - Every tool must fit the laptop with no sideways scrolling and its main controls in view.
   - The Explorer and the Bastion must also work on the TV, including when their window is moved between the screens.
10. **Code organisation:**
    - each tool lives in its own folder, with a namespace (`window.TSI.bastion`, `window.TSI.explorer`) and prefixed CSS classes (`tsi-bas-`, `tsi-exp-`);
    - shared pieces live in `shared/`;
    - game rules are plain, testable functions, kept apart from screen code;
    - content lives in data files;
    - **clean shutdown:** a closing tool stops its timers, sounds, videos and listeners.
11. **Look and feel:**
    - one shared set of design tokens;
    - Cinzel-style capitals for headings, labels and buttons, and sentence case for body text;
    - **one main (crimson) action per panel**;
    - readable contrast, and motion that respects the reduced-motion setting;
    - the same top bar in every tool;
    - keep each tool's signature art: the Bastion's map and facility overlays, and the Explorer's maps.
12. **Language:**
    - plain-English wording on screen;
    - UK English throughout;
    - every Scarlett Isles name (gods, Clans, provinces, places, NPCs, items) spelt exactly as in the source.
13. **Way of working:**
    - Ask Harry rather than guess on game rules, lore or what a tool should do. Features are built when Harry asks for them.
    - Work on a branch, with small commits, one tool or chunk per session.
    - Test from `file://` in a headless browser at both screen sizes.
    - Before finishing:
      - update `docs/PROGRESS.md` and `docs/KNOWN_ISSUES.md` (every bug fixed or left, with a one-line before and after);
      - open a pull request;
      - give Harry a tickbox checklist for testing.
    - Never edit `_reference/`, and never commit `_legacy/`.
14. **The current phase is a faithful rebuild.** Each tool is rebuilt as it was: same content, rules, features and flows. No new features or rule changes unless Harry asks; the handover's sections 12–15 are proposals, not current behaviour.
15. **Bugs.** Fix a bug only if it breaks the tool, loses saved data, or applies something twice (for example a reward or damage counted twice). Record every fix, and every bug left alone, in `docs/KNOWN_ISSUES.md` with a one-line before and after.
16. **Art.** Bring every image, sound and video across from the old repos, including ones the old tools never used. Store byte-for-byte duplicates once, put unused files in the tool's `assets/extras/`, and list every file's old and new location in `docs/ASSETS.md`.

---

## 10. Where things live

| Path | What it holds |
|---|---|
| `index.html` | The home screen, and the page every tool loads into (`?tool=<id>`) |
| `shared/data/tools.js` | The tool list, groups and each tool's script files. The Bastion page also loads `tools/explorer/rules.js` and `journey.js`, and the Explorer page loads `tools/bastion/rules.js` (not the Bastion's data files), only for checking campaign imports (93–96, 123–125). |
| `shared/data/regions.js` | Regions → Clan, chief, god, temple |
| `shared/js/store.js`, `store-rules.js` | Saving (IndexedDB `tsi.suite`, `TSI.store.fresh` at 319–348) and the suite's key names (`spaceNames`) |
| `shared/js/backup.js`, `backup-rules.js` | Export, Import and the campaign file |
| `shared/js/campaign-rules.js` | `bastionComing`, `ironbowNews`, `summary` (the DM doc), `untilText` |
| `shared/js/dmdoc.js` | The DM doc panel. Its layout is saved as `tsi.dmdoc.layout` (in Back up everything); whether it is open is kept per window in `sessionStorage` `tsi.suite.dmdoc-open`. |
| `shared/js/dmdoc-rules.js` | The DM doc's size and placement rules (it stays inside the window, below the top bar) |
| `shared/js/tabguard.js` | "Already open" and `isOpenElsewhere` |
| `shared/js/handoff.js` | Hand-offs: fight (`tsi.suite.handoff`), result (`tsi.suite.handback`) and crest (`tsi.suite.handoff-crest`) |
| `shared/js/shell.js` | Top bar, tool loading, `openWindow` |
| `tools/explorer/tool.js` | The Explorer screen: Make Camp (751–770), Open the Bastion ↗ (892–902), word pop-up (907–922), fights (1113–1243) |
| `tools/explorer/rules.js` | Map, grid, fog, movement, `R.makeCamp` (677–732), `R.resetTravel`, save format |
| `tools/explorer/journey.js` | Event engine: rolls, steps, outcomes, effects, threads, follow-ups |
| `tools/explorer/fights.js` | Fight hand-off builder, `partyLevel` |
| `tools/explorer/data/` | `explorer-data.js` (maps, pins, weather, heroes, main events), `journey-events.js`, `fights-data.js`, `terrain-data.js`; also `events-data.js`, the 601 old travel and campfire events, kept but switched off and not loaded (`shared/data/tools.js` 115–116) |
| `tools/bastion/tool.js` | The Bastion screen: `checkClock` (2884–2914), `passDays` / `runDay` (2918–2970), `showWord`, `completeOrder` (3015–3092), the map (621–670, 3549–3567), "At War" tags (140–243), panels, War Council, crest |
| `tools/bastion/rules.js` | Core rules: state, saves, orders, the Hall, trade, identity, `CLAN_KEYS` (192), `R.startDay` (1624), `R.finishDay` (1663), `R.clockAction` (1682), `R.shiftDays` (1696), `R.anchor` (1721) |
| `tools/bastion/war-campaign-rules.js` | Wars, missions, muster, attack roll, Defend Bastion, results, recovery |
| `tools/bastion/war-battle-rules.js`, `war-ai.js`, `war-table.js`, `war-table-rules.js` | The battle engine, the enemy AI and the War Table |
| `tools/bastion/data/` | `bastion-data.js` (timings, Clans, gods, Hall numbers, map overlays list), `facilities-data.js`, `events-data.js`, `tools-data.js`, `compendium-data.js`, `war-units-data.js` |
| `tools/bastion/archive/mercenary-brigade.js` | The archived Brigade (not loaded) |
| `bastion-new-art/` | Harry's new Bastion base painting and 15 overlays (12 October 2026), kept as uploaded; nothing in the code uses them yet (see `docs/BASTION-MAP-ART.md` §4) |
| `docs/` | `PROGRESS.md`, `PLAN.md` (decisions C1–C12, E1–E16, B1–B24; B1, B14 and C12 settled by answers 9 and 10), `BASTION-OVERHAUL.md`, `WAR-RULES.md`, `KNOWN_ISSUES.md`, `ASSETS.md`, `BASTION-MAP-ART.md`, `BUILDING-A-TOOL.md`, and `dev/make-terrain.py` (makes `terrain-data.js`) |
| `guide.html` | Harry's how-to guide |
| `tests/rules.html`, `tests/e2e/` | Rules tests (`explorer*.test.js`, `bastion.test.js`, `campaign.test.js`) and click-throughs (`bastion-days.test.js`, `phase8.test.js`, `dmdoc.test.js`) |

---

## 11. Coming next: decided by Harry, not built yet

These are Harry's stated plans as of 12 October 2026. **Nothing here is in the code yet.** Ask Harry for the details before planning around them.

**The Bastion's facilities will change in the next build.** Harry has said that some of today's 18 facilities will be merged into others, some will be removed, and some new ones added. He has not yet said which are merged or removed, or what the new ones do (their orders, days, costs and levels).

**The seven new facilities** (named by Harry's new map art):
- Wyvern Roost
- Griffin Tower
- Dire Wolf Den
- Weavers and Sailmakers Hall
- Stone Quarry and Masonworks
- Fishery and Smokehouse
- Timber Yard and Sawmill

The art's notes say the Wyvern Roost shows a resting brown wyvern standing for the occupied roost ("no specific appearance for Elara's wyvern was supplied"; Elara is one of the Explorer's five heroes), and that the Griffin Tower and Dire Wolf Den are shown unoccupied.

**Harry's new Bastion map art** (`bastion-new-art/`, details in `docs/BASTION-MAP-ART.md` §4):
- A new base painting: a wide, low-angle view of the Bastion from the sea, **3000 × 1250** (a 2.4 : 1 shape, against today's 3:2). It includes the starting buildings.
- **15 overlays**, each a see-through PNG the same size as the painting, so they work the way today's overlays do (§5.1):
  - 8 for facilities the Bastion has today: Library, Laboratory, Greenhouse, War Room, Hall of Emissaries, and the Shrines of Aurush, Telluria and Pelagos (today the Shrines never show on the map: B12);
  - 7 for the new facilities above.
- No two overlays overlap, so the order they're drawn in doesn't matter.
- There are no new overlays for the Arcane Study, Garden or Smithy (which show on today's map), nor for the Menagerie or Gaming Hall (which never did). Harry will say whether those are merged, removed or painted later.
- When the art goes in, the map's fitting (`MAP_RATIO` in `fitMap`, `tools/bastion/tool.js`) changes to the new shape, and the crest badge will sit over the sky in the painting's top-right corner.

**Facility tile pictures.** Each facility also has a square painting in `tools/bastion/assets/facilities/` (1024 × 1024), shown in the facility grid and panels. The new facilities don't have one yet.

---

## Appendix A: behaviours kept from the old tools (on purpose)

**Explorer:**
- EXP-19: the Fog button reads "Off" after reopening with fog on.
- EXP-20: the Region list doesn't follow a loaded map.
- EXP-21: Reset Travel leaves the weather wait alone.
- EXP-22: weather can be closed without rolling.
- EXP-23: line breaks in some texts run together.
- EXP-25: a refused "Too far" drag keeps the fog it uncovered.
- EXP-26: grid opacity 0 counts as 0.35.
- EXP-27: Reset Fog doesn't ask first.
- EXP-28: an empty weather roll counts as 0.
- E11: three map links go one way only.

**Bastion:**
- B3: a Consortium pays twice.
- B4: Upgrade Hall's price isn't charged.
- B6: the Writ's Council bonus is never granted.
- B7: Gaming Hall gold, War Room upkeep and the Level 9 note are not enforced.
- B9: Cancel gives no refund.
- B12: Gaming Hall and Shrine map overlays are hidden.
- B16: no research notes.
- B20: a natural 1 on a Hall roll signs the deal in full.
- B21: an expired route can't be reopened.
- BAS-27: Trade Agreements never glow on the routes map.
- BAS-29: the Arbitration log shows "[object Object]".
- BAS-31: Clear warehouse logs twice; a failed delegation can take the treasury below 0 until the Bastion is reopened (B17); the Armed flag stays on (§5.3).
- BAS-34: a delegation has an empty summary line.

## Appendix B: where the docs and the code differ (the code is described above)

1. `PLAN.md` B5 and `BASTION-OVERHAUL.md` say the Trade Agreement's duration is ignored. In the code, the 1 / 3 / 6 weeks chosen count.
2. The Construction footer says "levels 5 / 9 / 13 / 17", but the Shrines unlock at **8**.
3. The Workshop's Craft note lists Tinker's, Cobbler's and Thieves' Tools, which don't exist in the tool tables.
4. The 28-day event interval is written twice: `campaign-rules.js` `BASTION_EVENT_EVERY` and `bastion-data.js` `time.eventEvery`.
5. `guide.html` line 219 says the word stays up after **Open the Bastion ↗**. In the code, the pop-up closes, then the Bastion opens.
6. `BASTION-OVERHAUL.md` §1.1 says the Bastion also reads the day "whenever this window saves". It reads on opening, every 2 s, and when shown; reading after saving is the DM doc.
7. `BASTION-OVERHAUL.md` §1.4 and §1.7 name `R.passDay` / `R.catchUp` and use the line "Clan Bacca is attacking the Ironbow!". Neither function exists, and the real lines are in §6.2 and §5.10 above.
8. Code comments in `tools/explorer/tool.js` line 5 and `rules.js` line 645 still mention "the weekly Bastion prompt", which has been removed (EXP-36).
9. `WAR-RULES.md` says every free force defends the Bastion. In the code, an Unsworn party defends with defenders and beasts only, and only a Clan's Clan Honour changes.
10. `WAR-RULES.md` says a unit checks morale "when it first falls to half". In the code it checks after every hit that leaves it at or below half.
11. `R.upcoming` (`rules.js` 1731) is defined but unused.
