# The Ironbow Bastion Manager: the days-and-map overhaul (plan, version 1)

*8 October 2026. Version 2: Harry's answers built in (8 October). **Builds 1 and 2 are built** (8 October; see "Build 1 as built" and "Build 2 as built" in section 7). Build 3 waits for Harry's go-ahead.*

## Harry's brief, in short

1. **No more Bastion turns.** The Bastion follows the Explorer's day-by-day clock, tracking every day that passes, and can be opened at any time from the Explorer (as well as from the home screen).
2. **Facility orders take in-game days**, not turns. I pick a sensible number of days for every order first; Harry revises.
3. **The Mercenary Brigade goes** (its code kept aside for later). Form Clan stays.
4. **A crest for the Bastion at any time.** It hovers over the top-right corner of the Bastion map; clicking it opens the Party Identity panel (Form Clan, no Brigade). Forming a Clan can keep that crest or make a new one.
5. **A new screen built around a large Bastion map:** a top bar inside the map panel (day, editable treasury with a coin icon, active facilities, pending orders, each with a hover list), and a bottom bar with a collapsible facility grid in the middle (artwork tiles; hover for name, level and pending orders; click for the facility's panel; empty slots locked until the party's level allows; an available slot highlights with "click to build a new facility" and opens a build panel with a larger grid of facilities, hover for what it does and how long it takes, click to confirm "Construct X?", then an hourglass on the tile until it's done). Buttons either side of the grid open the Warehouse, Management, the log, Bastion Events, Clan Influence, Favour of the Gods (without Political Capital, which lives in Clan Influence) and Banner & War Council (locked until the requirements are met). The Hall of Emissaries' tile opens the Hall's own panel.
6. **Aesthetic reference:** the two Heroes-of-Might-and-Magic-style town screenshots: a painted town as the hero of the page, gold-framed tooltip cards, a resource strip, and a bottom bar of square slots. Taken as inspiration only; the Scarlett Isles look (near-black, burgundy, antique gold, Cinzel) stays.

The code mapping behind this plan (ten readers over the Bastion's 15,000 lines, the Explorer's clock, the Crest Creator and the tests) is summarised in the appendix.

**This is a rules change, asked for by Harry.** CLAUDE.md's "faithful rebuild" rule and the handover's "preserve implemented behaviour" are set aside for the Bastion by this brief; every rule that changes is recorded in `docs/KNOWN_ISSUES.md` with a before-and-after line, as always. The handover itself proposed this design for later (section 12): *"Use one in-game day service for travel and acknowledged Bastion turns… Do not auto-run a Bastion turn again when reloading that day"*, and (section 14) *"Link Explorer's weekly prompt to an acknowledged Bastion advancement with an idempotency key."* The plan keeps both safeguards: each day is processed exactly once, and a reload never re-runs it.

## At a glance

- **One clock.** The Explorer's day is the campaign's only clock. The Bastion reads it (every two seconds while open, and the moment it opens), passes the days that have gone by, and never changes it. Its old "Advance Bastion Turn" button goes.
- **Days for orders; every 7 days for income and war.** Facility orders and building work count in days and complete on their day. Things that used to happen "each turn" now happen **every 7 days, counted from when each one started**: a trade agreement sends a shipment every 7 days from the day it was signed; a Clan at war rolls to attack every 7 days of the war. Every old length that isn't an order stays what it was at **7 days per turn**, so the balance of agreements, wars, repairs and recovery doesn't change.
- **"The Ironbow sends word…"** A pop-up whenever a day brings news from the Bastion: building finished, orders complete, a trade agreement ending, or something that needs the DM (a roll, an army ready to march, an attack). It appears in the Explorer at Make Camp and in the Bastion when it's open.
- **One campaign save.** The Explorer and the Bastion export and import together, as one file, from either tool.
- **Nothing is applied twice, nothing is lost.** A day is processed step by step and saved after each step, as a turn is now. If a roll is cancelled or Edge is closed mid-way, the Bastion picks up where it was.
- **A fresh Bastion to start.** Harry is happy for his current test Bastion to be replaced, so the first open of the new version sets the old one aside (kept, not deleted) and starts a new Bastion on the Explorer's day.
- **The Brigade is archived**, not deleted: its code and tests move to `tools/bastion/archive/`, loaded by nothing.
- **The crest** can be made at any time, in the Clan Crest Creator (sent straight to the Bastion from there, no download-and-upload) or uploaded, and shows over the map.
- **Three builds, three pull requests:** time and the campaign save first (so Harry can playtest the day counts on the screen he knows), then the new screen, then the identity and crest work.

## 1. Time: days instead of turns

### 1.1 Where the day comes from

- The Explorer's `travel.day` is the clock. Make Camp moves it on by one. Reset Travel puts it back to Day 1.
- The Bastion keeps `state.day`: the last day it has processed. On opening, and every 2 seconds while open (the DM doc's method: `TSI.store.fresh('tsi.explorer.save')`, plus a read whenever this window saves or comes back into view), it compares the Explorer's day with its own:
  - **Explorer ahead:** the days in between pass, one at a time (section 1.3).
  - **Explorer behind (Reset Travel):** nothing rewinds. The Bastion re-anchors to the new day and every due day moves with it (an order due in 4 days is still due in 4 days), exactly as the Explorer shifts its own effects and threads. A log line says so.
  - **No Explorer save yet:** the Bastion sits on Day 1 and nothing passes. The top bar says "Day 1 · the Explorer sets the day".
- The Bastion only ever **reads** the Explorer's save. It never writes it, so two windows can't overwrite each other.
- The Bastion's own top bar shows the day. The Bastion has **no button of its own to pass a day** (question 1 asks whether Harry wants one for sessions without the Explorer).

### 1.2 What changes length, and what runs every 7 days

| | Was | Becomes |
|---|---|---|
| Facility orders | 1 turn, all of them | **days per order** (section 2) |
| Building a facility | 3 / 4 / 5 / 5 turns by required level 5 / 9 / 13 / 17 | **21 / 28 / 35 / 35 days** |
| Hall of Emissaries actions | 1 turn | days per action (section 2) |
| Trade Agreement | 4 turns ± the roll tier (the 1 / 3 / 6 turn choice was offered but ignored, B5) | **the weeks chosen when planning it: 1, 3 or 6 weeks** (shown in weeks), ± the roll tier's 2 / 1 / 0 / −1 / −2 weeks, at least 1 week. The choice now counts. |
| Delegations, summits, writs, consortiums | 2 / 3 / 4 / 5 turns, ± the roll tier | **14 / 21 / 28 / 35 days**, ± 14 / 7 / 0 / −7 / −14 days |
| Contract income (agreements, writs, consortiums) | paid each turn | **a shipment every 7 days from the day it was signed**, the same amount; the last shipment comes on its final day. The Hall shows "X days remaining (Y shipments)". |
| A consortium's sea route | settled once a turn, high-risk ones with a d20 | **every 7 days from the day it opened** (same rolls) |
| A consortium's sea route's life | 5 turns | **35 days** |
| Hall cooldown after a bad failure | 2 turns | **14 days** |
| Trade Network investments | 1 turn | Stability 7 days, Yield 7 days, Routing Doctrine 1 day |
| Watchtower Patrol | Advantage "this turn" | the order takes 1 day; the Advantage then **covers the next 7 days** |
| A queued War Action | musters next turn | **musters 3 days after it's queued** |
| The attack roll while at war | a d6 per Clan, each turn | a d6 **every 7 days of the war**, counted from the day it was declared (so the odds per week are unchanged); at most one attack waiting at a time |
| Peace after quiet | 6 turns without a battle | **42 days** without a battle |
| Cancelling a War Action refunds its cost | if cancelled the same turn, before that turn's attack roll | if cancelled **the same day it was queued**, before any attack roll since |
| Under Repair after a lost defence | 2 turns, the turn of the loss included | **14 days**, the day of the loss included |
| Wounded Lieutenants and beasts | separated 1 turn, recovered 1, wounded 2, badly wounded 3 | **7 / 7 / 14 / 21 days** |
| Automatic Bastion event | every 4th turn | **every 28 days** (Days 29, 57, 85…) |
| The last event on screen | cleared each turn | stays until the next event is rolled |
| The Bastion's turn | "Advance Bastion Turn (+7 days)" | gone: no turns, no weeks; each thing keeps its own 7-day count |

The principle: **only facility orders get new, hand-picked lengths** (Harry's instruction), and the Trade Agreement takes the weeks chosen for it. Everything else keeps its old length at 7 days per turn, so nothing Harry has already agreed about the war, trade or diplomacy changes its balance. He can shorten any of these afterwards; each is one number in a data file.

### 1.3 What happens when a day passes

For each day, in this order (saved after every step, so a closed window never loses or repeats anything):

1. **Start of day:** repairs that end today end; wounded Lieutenants and beasts due back today come back; building work due today completes ("The Smithy is now built and active.").
2. **Shipments and routes due today:** each contract whose 7-day mark falls today sends its shipment (its gold into the treasury); each sea route whose 7-day mark falls today settles (a d20 for a high-risk route, as now). Then records whose last day is today end (a sea route whose consortium has ended expires).
3. **Orders due today** complete, one by one, each asking for its roll where it needs one (Hall actions, War Actions that become Military Actions), with the same pop-ups as today.
4. **War:** each Clan whose war reaches a 7-day mark today rolls its d6 (a 1 brings "Sound the horns!"; none while an attack is still waiting).
5. **Every 28th day** (Days 29, 57…): the automatic Bastion event.
6. **Word from the Ironbow:** everything that happened, and anything waiting for the DM, goes into one "The Ironbow sends word…" pop-up (section 1.4), and into the log ("Day 12: the Barracks recruited 3 defenders.") only on days when something happened.

When several days pass at once (the Explorer made camp four times while the Bastion was closed), they are processed in sequence in one sitting, with one pop-up per thing that needs the DM. A cancelled roll leaves that order **due** (it shows a "Resolve" button in its facility panel and in the pending-orders list, and comes up again the next time a day passes). The old "Finish Bastion Turn N" resume survives as "Finish Day N" if Edge is closed mid-way.

Patrol's Advantage, the attack roll and the Military Action keep their current order within a day, so a Patrol that completes on the day of an attack roll still counts for it.

### 1.4 "The Ironbow sends word…" (Harry's answer 9)

There's **no weekly reminder** any more. Instead, a pop-up arrives whenever a day brings news from the Bastion, titled **"The Ironbow sends word…"**, with one short line per item:

- **Finished:** "The Smithy is built." · "Barracks: Recruit Defenders is complete." · "Dock: Charter Berth (Longship) is complete."
- **Ended:** "Your Trade Agreement with Clan Karr has ended (its last shipment arrived)." · the same for writs, consortiums, delegations and summits.
- **Waiting for you:** "Hall of Emissaries: Secure Trade Agreement (Clan Karr) needs your roll." · "The sea route to Karr needs a roll." · "Your army is ready to march on Bacca (Raid)." · "Clan Bacca is attacking the Ironbow!" · "Repairs: the Barracks is working again."

Where it appears:

- **In the Explorer, at Make Camp**, after the campfire event and the weather, whenever the new day brings anything. The Explorer reads the Bastion's save to know what's due (it never changes it), so it can say *what* finished; the results (how many defenders, which roll) come from the Bastion when it processes the day. Its buttons: **Open the Bastion ↗** and **Close**.
- **In the Bastion, when it's open** (or the next time it opens), as it processes the day, with the results filled in: "Barracks: 3 defenders recruited." Anything needing a roll then follows as its own pop-up, as now.
- Several days at once (camp made four times with the Bastion closed): one pop-up, the lines grouped under "Day 9", "Day 10"…

The Explorer also gets an **Open the Bastion ↗** button in its Travel panel, under Make Camp. It opens the Bastion in a new window (ready for the TV); if the Bastion is already open in another window it says so instead of opening a second one.

### 1.5 The DM doc

The two turn tiles become **Orders pending** (how many, and "next completes Day N") and **Next word from the Ironbow** (the next day something finishes or ends, "Day N, in N days"). "Party level", "Where the party is" and the standings are unchanged.

### 1.6 Existing saves: a fresh Bastion (Harry's answer)

Harry's current Bastion is the one saved in Edge on his laptop (the browser keeps one set of saves for every copy of the suite opened from that computer). He's happy for it to be replaced so he can play the new system through from the start. So there's **no turn-to-day conversion**:

- The first time the new version opens, a Bastion saved in turns is **set aside, not deleted** (kept in the browser as a "damaged saves set aside" copy, which Back up everything includes), with a notice saying so, and a **new Bastion** starts on the Explorer's current day.
- The Explorer's save is kept as it is (it already counts in days). Reset Travel gives a clean Day 1 if wanted.
- A Bastion-only file exported before the change is refused on import with a plain message ("This file is from before the Bastion counted in days, so it can't be imported. Nothing was changed."). A whole-suite backup from before is restored as normal, and its old Bastion is set aside the same way when the Bastion next opens.
- An old save that had formed a **Mercenary Brigade** goes the same way (set aside), so there's nothing to convert.

### 1.6a One campaign save (Harry's answer)

The Explorer and the Bastion share **one save**, as far as Harry is concerned:

- **Export** in either tool (the top bar's Export, the Explorer's Export Save, the Bastion's Download Save) downloads **one campaign file** holding both: the Explorer (heroes, map, day, journey, gold, effects, threads, its uploaded map) and the Bastion (everything, its crest and its War Table settings).
- **Import** in either tool replaces **both together**, after checking both halves and asking first (with the usual offer to download a copy of what's there now). If either half is damaged, nothing is changed.
- An Explorer-only file from before the change imports into the Explorer alone, saying the Bastion is left as it is.
- Back up everything and Restore already include both, unchanged.
- Each tool's own Reset stays its own: Reset (Bastion) clears the Bastion; Reset Travel puts the Explorer's day back to 1.
- **Behind the scenes it stays two records**, one per tool, on purpose: with the Explorer on the laptop and the Bastion on the TV, each window writes only its own half, so neither can overwrite the other's changes. The "one save" is the file and the import, which always carry both. (The shared backup code gets a "campaign" group: the Explorer and the Bastion export and import as one.)

### 1.7 Two windows, and the rules that stop double-counting

- With the Explorer on the laptop and the Bastion on the TV, the Bastion notices a new day within about 2 seconds and runs the day's pop-ups in its own window.
- Every guard that stopped a route paying twice or an attack rolling twice within a turn is re-keyed on the **day**: each contract and route records the last day it paid (`lastShipmentDay`), each war the next day it rolls (`next`; the plan said `lastAttackDay`), the Bastion the last automatic-event day, and `dayInProgress {day, stage, skipped}` replaces `turnInProgress`.
- All of this lives in plain rules functions (`R.passDay`, `R.catchUp`, `R.shiftDays`, `R.shipmentsLeft`, and a shared `TSI.campaign.ironbowNews(bastionSave, fromDay, toDay)` that both tools use to write "The Ironbow sends word…"), tested on `tests/rules.html` with fixed dice.

## 2. Days for every order (my first proposal; Harry revises)

The number is how many days after you issue the order it completes (the gold is still taken when you issue it). "Was" is the old rule: one Bastion turn, 7 days.

### The five starting facilities

| Facility | Order | Days | Why |
|---|---|---|---|
| Workshop | Craft (an item from your Artisan Tools) | **3** | mundane goods, a few days at the bench |
| Workshop | Craft Magic Item | **10** | the 2024 rules give uncommon items about ten days |
| Barracks | Recruit Defenders (1d4) | **5** | word goes round the villages, recruits arrive |
| Watchtower | Patrol | **1** (then Advantage for 7 days) | a patrol is set the next morning and rides the week |
| Dock | Charter Berth (a vessel) | **7** | a hull is found, crewed and brought round |
| Armoury | Arm Defenders | **3** | fitting out the men you have |

### Facilities you build

| Facility (level) | Order | Days |
|---|---|---|
| Arcane Study (5) | Craft Common | **5** |
| Arcane Study (5) | Craft Uncommon | **10** |
| Garden (5) | Harvest | **7** |
| Smithy (5) | Craft (weapons and armour) | **5** |
| Library (5) | Research | **5** |
| Hall of Emissaries (5) | Secure Trade Agreement | **7** to negotiate; the agreement then runs the 1, 3 or 6 weeks chosen |
| Hall of Emissaries (5) | Host Delegation | **5** |
| Hall of Emissaries (5) | Inter-Clan Summit | **14** (two Clans must travel) |
| Hall of Emissaries (5) | Secure Writ of Authority | **10** |
| Hall of Emissaries (5) | Trade Consortium | **14** |
| Hall of Emissaries (5) | Upgrade Hall | **14** |
| Shrine of Telluria / Aurush / Pelagos (8) | Craft (a charm) | **5** |
| Shrine of Telluria / Aurush / Pelagos (8) | Pray | **1** |
| Gaming Hall (9) | Trade | **7** (a week's takings) |
| Laboratory (9) | Craft (poisons and potions) | **5** |
| Greenhouse (9) | Harvest | **10** (rarer plants) |
| Menagerie (13) | Recruit Beast | **10** |
| War Room (17) | Recruit (a Lieutenant or a regiment) | **7** |

### Other orders

| Order | Days |
|---|---|
| Trade Network: Stability Investment | **7** |
| Trade Network: Yield Investment | **7** |
| Trade Network: Routing Doctrine Change | **1** |
| A War Action (the army musters, then the Military Action begins) | **3** |

Each number is one field (`days`) on the order in `tools/bastion/data/facilities-data.js` (and `bastion-data.js` for the Trade Network and the war), so changing one is a one-line edit. The facility panels will show "Takes N days" beside each order, and the pending list "Due Day N (in N days)".

## 3. The Mercenary Brigade goes (archived)

- **Removed from the screen and rules:** Form Mercenary Brigade, its requirements line ("Merc requirements: Level 7+, 3+ defenders"), the "Brigade: name" label, the Trusted Clients box and its 0–100 scores, the Trusted Clients shifts after a battle and their War Report line, and the words "Clan or Brigade" wherever they appear ("Only a Clan can commit Lieutenants and Regiments."; "Clan only").
- **Kept aside:** all of it moves, as working code with its tests, to `tools/bastion/archive/mercenary-brigade.js` and `tests/archive/mercenary-brigade.test.js`, loaded by nothing, with a note at the top saying how to put it back. The old single-roll war that the screen no longer uses (`R.warCommit`, `R.queueWarAction`, `R.warPlan`, `R.resolveWar`) goes into the archive with it. A save's `trustedClientsByClan` scores still load harmlessly (ignored), so putting the Brigade back later loses nothing.
- **Unchanged:** an Unsworn party can still send defenders and beasts to war, as now; Form Clan's requirements (level 9, total support 360, three Clans at 55) are as they are.
- **Saves:** section 1.6.

## 4. The crest, at any time

- **Where it lives:** as now, `tsi.bastion.crest` ({ dataUrl, key, name }), plus the Crest Creator's design (its 25 settings) when the crest came from there, so it can be re-edited later. It belongs to the Bastion, not the Clan: forming a Clan doesn't change it, and it's shown whether the party is Unsworn or a Clan.
- **Three ways to set it,** from the Party Identity panel (and from the crest badge's empty state):
  1. **Create in the Clan Crest Creator ↗** opens the Creator in a new window. The Creator gets a new button beside Download PNG: **Use for the Bastion**. It sends the crest to the Bastion through the suite's hand-off (a new `crest` kind of `TSI.handoff`, like the fight hand-off: a 512-pixel picture plus the design). A Bastion window hears it within a moment and asks "Use this crest for the Bastion?"; if the Bastion isn't open it asks when next opened. No downloading and uploading. This is allowed from a double-clicked file because the Creator draws only its own path data, never a bundled picture (its Download PNG already proves it offline).
  2. **Upload a picture** (PNG, JPG, WebP or GIF, as now).
  3. **Remove**.
- **The badge:** top-right corner of the Bastion map, about 112 pixels, in the gold frame with its soft glow, above the facility overlays. With no crest it shows a faint empty shield and "Add a crest". Clicking it (or pressing Enter on it) opens the Party Identity panel. Its spoken name is "Crest of the Ironbow" until a Clan is formed, then "Crest of <Clan name>".
- **The Party Identity panel** (a pop-up over the map): the crest with its three buttons; the status pill (Unsworn, or "Clan: name" with chief and motto); **Form Clan** with the requirements line; Clan Honour (only once a Clan). Form Clan's pop-up keeps a crest box, pre-filled: "Keep this crest / Create a new one ↗ / Upload…".
- **The War Table** gets the crest on your tokens whether or not a Clan is formed (army name "Your forces" until then).

## 5. The new screen

### 5.1 Shape and sizes

```
Suite top bar (56 px)
Tool header (slim): The Ironbow · Party Level · Compendium · Reset · Download / Import Save
┌─ Bastion Map panel (fills the rest of the window) ───────────────────────────────┐
│ Day 12 · [coin] 1,250 gp (editable) · Facilities 7 · Orders 3            [crest] │
│                                                                                  │
│                         the painting, with the building overlays                 │
│                                                                                  │
│ (Warehouse)(Management)   ▲ ■■■■■ ■■ □□ 🔒🔒 ▼   (Clan Influence)(Favour)(War 🔒)  │
│ (Day Log)(Events)              facility grid                                      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Laptop (1707 × 930):** 874 px below the suite bar; the header takes about 48, leaving ~826 for the map panel; inside it the top bar is 44 and the bottom bar 128 when the grid is open (56 collapsed), so the painting shows at roughly **945 × 630**, against about 700 × 470 today.
- **TV (1920 × 1080):** the painting shows at roughly **1170 × 780**, slightly larger than the painting itself (1152 × 768), so it will soften a touch at 100% scale. Question 7 asks whether Harry can supply the painting (and the eight building overlays) at double size.
- The painting is **fitted, never cropped**, so the building overlays keep lining up (they are full-frame pictures the same size as the map).
- No sideways scrolling at either size; the panel sizes are measured, not guessed, so nothing hides under the bars. The page no longer scrolls: everything else is a pop-up over the map.

### 5.2 The top bar (inside the map panel)

- **Day N.** From the Explorer; "Day 1 · the Explorer sets the day" until the Explorer has saved.
- **Treasury:** a small stack-of-coins icon and the amount, editable in place (saves when you finish typing or leave the box, instead of on every keystroke). The Management panel no longer has a treasury box (question 12).
- **Facilities N:** the number built. Hover: each one, with "building, N days left" for those under construction.
- **Orders N:** pending orders. Hover: each order with "due Day N (in N days)", or "due: roll needed" for one waiting for the DM.
- **At War** tags appear beside Clan names wherever they're shown, as now.

### 5.3 The bottom bar and the facility grid

- **Centre: the facility grid**, collapsible with ▲/▼ (its open/closed state remembered). Eleven tiles in one row: the five starting facilities, then six slots. Each tile is a square of the facility's artwork with a gold hairline frame:
  - **Built:** the art. Hover: name, "Level 1" (the Hall shows its real level, 1–3), and its pending orders with days left. Click: the facility's panel.
  - **Building:** the art dimmed with an **hourglass**. Hover: name and "N days of construction left". Not clickable.
  - **Under Repair:** the art dimmed with a hammer; hover says until which day.
  - **Empty, available** (the party's level allows another build): a dark tile that lights up on hover with "Click to build a new facility". Click: the build panel.
  - **Empty, locked:** a dark tile with a padlock; hover: "Unlocks at party level 9" (9 / 13 / 17). Not clickable.
  - Slots by party level are as now: 2 at level 5, 4 at 9, 5 at 13, 6 at 17. A facility kept above the limit after lowering the level stays, marked as now.
- **Left buttons:** Warehouse · Management · Day Log · Bastion Events.
- **Right buttons:** Clan Influence · Favour of the Gods · Banner & War Council (with a padlock until unlocked; hover says what's needed).
- Buttons are square icon buttons with a short label beneath (two rows of two each side), outlined gold, the filled crimson kept for the one main action in whichever panel is open. Keyboard: Tab reaches every tile and button; Enter opens; Escape closes a panel.

### 5.4 The panels that open from the grid

- **Facility panel** (pop-up): the large artwork, name, level, status (Active / Building / Under Repair until Day N), the facility's pending orders with "due Day N" and Cancel (and **Resolve** when one is waiting for a roll), then the order rows exactly as today's cards: label, cost, the dropdown, Issue Order, notes, with "Takes N days" shown on each. The Workshop's panel also holds the **Artisan Tools** six-set chooser (it feeds the Workshop's Craft list; question 11).
- **Build panel**: a larger grid of every facility that isn't built, with artwork and name; locked ones dimmed with "Locked: level 9". Hover: what it does (its orders) and "Takes N days to build". Click: "Construct the Smithy? It takes 21 days." Yes / No. On Yes the small grid shows it with the hourglass. "Clear extra builds" moves into this panel's footer.
- **The Hall of Emissaries' tile** opens the Diplomacy & Trade panel as it is today (level badge, Upgrade, Routes, Resolve, Council Ledger; the records; the Hall's actions; the Ironbow Trade Network), as a pop-up.

### 5.5 Where everything else goes

| Today | In the new screen |
|---|---|
| Favour of The Gods (left column) | **Favour of the Gods** panel: the three bars, Claim, "Shrine blessings add 1d20%". No Political Capital. |
| Political Capital (left column) + Diplomatic Assets (Favour Tokens) | **Clan Influence** panel: the seven Clans' trackers (PC, Honour/Respect, support) with the Political Capital bars and Honour Change buttons, and Favour Tokens. |
| Party Identity (top of the identity card) | **Party Identity** panel, from the crest badge (section 4). |
| Turn Log | **Day Log** panel (entries stamped with the day). |
| Bastion Event card + Roll Bastion Event button | **Bastion Events** panel: Roll Bastion Event, the last event, and when the next automatic one is due. |
| Management (defenders, treasury, military) | **Management** panel: defenders and beasts, military. The treasury moves to the top bar. |
| Warehouse + Artisan Tools | **Warehouse** panel (Artisan Tools moves into the Workshop's facility panel). |
| Banner & War Council | **Banner & War Council** panel, with its lock. |
| Diplomacy & Trade | opened from the Hall's tile. |
| Facilities (slots, pending orders, carousel) | the grid, the build panel, the facility panels and the top bar's Orders count. |
| Compendium, Party Level, Reset, Download/Import Save | the slim tool header. |

Every panel opens as the suite's pop-up (keyboard focus kept inside, Escape closes, the War Table still opens over everything).

### 5.6 The Banner & War Council lock

Today the panel is always open, and an Unsworn party can send defenders and beasts to war. The brief wants it locked "until the appropriate level / facilities". The options are in question 6; the default is the one that changes nothing about when war is possible: **it unlocks once the Bastion has something that can fight** (a defender from the Barracks, a beast from the Menagerie, or a regiment from the War Room). The padlock's hover: "Recruit defenders at the Barracks to raise your banner."

### 5.7 Tooltips

One shared tooltip card for the whole suite (`shared/js/tooltip.js`), styled like the reference's cards (dark card, gold title line, body text, a cost or days line), shown on hover and on keyboard focus, never covering what it describes. The Bastion's existing tooltip helpers become this.

## 6. What stays exactly as it is

- Every order's cost and outcome; the Hall's DCs, tiers and Political Capital swings; route DCs and payouts; the Council Ledger; the war's battles, rewards, casualties and recovery (only their clocks change); Favour; Form Clan's requirements; the Compendium; Export, Import, Reset and the whole-suite backup.
- The kept behaviours Harry decided earlier (B2–B24) stay as decided, including B7 (Gaming Hall gold, War Room upkeep and the Craft Magic Item level limit stay as notes only) and B5 (the Trade Agreement duration choice stays ignored, unless Harry takes question 10's option to drop it).
- The facility overlays on the map (eight of them) and the ones kept hidden (B12).

## 7. Build order

Each is one session and one pull request, tested from a double-clicked `index.html` on the laptop and TV sizes, with Harry's tickbox list.

### Build 1: days and the campaign save (the rules change, on the screen Harry knows)

- `shared/js/campaign-rules.js`: `ironbowNews(bastionSave, fromDay, toDay)` (the lines for "The Ironbow sends word…", read-only, used by both tools) and the DM doc's new tiles; the weekly `isBastionDay` reminder retired.
- `shared/js/backup-rules.js`, `backup.js`, `shared/data/tools.js`: the "campaign" save group (the Explorer and the Bastion export and import together).
- `tools/bastion/rules.js` and `war-campaign-rules.js`: `state.day`, the day engine (`passDay`, `catchUp` with `dayInProgress`), due days everywhere a turn number was, shipments every 7 days, `shiftDays`, the save marker (`v: 2`) and setting an old turn-based save aside.
- `tools/bastion/data/facilities-data.js` and `bastion-data.js`: `days` on every order; durations in days; the data comments reworded.
- `tools/bastion/tool.js`: reads the Explorer's day live; the Advance button becomes the day pill and a "Days passed" review; every "turn" string reworded; "Resolve" on a due order; the log stamped with days.
- The Explorer: the Open the Bastion ↗ button; the weekly reminder removed; "The Ironbow sends word…" at Make Camp. The Bastion: the same pop-up as it processes days. The DM doc's two tiles.
- The Trade Agreement's Duration choice in weeks (1 / 3 / 6), honoured; "X days remaining (Y shipments)" in the Hall.
- The campaign save: export and import of the Explorer and the Bastion together from either tool; the old turn-based Bastion set aside on first open.
- Tests: about 71 of the Bastion's 420 rules tests set or assert turn numbers (25 in `bastion.test.js`, 46 in `bastion-campaign.test.js`; the three war-table, battle and AI files have none) and are rewritten for days; about 39 of `phase9.test.js`'s 105 click-through checks, 5 shared tests (`campaign.test.js`, `explorer.test.js`) and 4 DM doc checks likewise. New tests cover the day engine, shipments and attack rolls every 7 days, catching up several days at once, Reset Travel, an old save set aside, the campaign file both ways, "The Ironbow sends word…" in both tools, and the two-window link (the Explorer makes camp, the Bastion's day moves within 2 seconds). The side-by-side 12-turn run against the old Bastion is **retired**: the rules now deliberately differ, as the war's already do (recorded in KNOWN_ISSUES).
- Docs: KNOWN_ISSUES (a new BAS entry for the day clock with every changed rule, and the retired comparison), PROGRESS, `docs/WAR-RULES.md` re-issued in days (peace, repairs, recovery, the attack roll, the cancel window), and `guide.html` in the same pull request (its click-through test fails if the guide names a button that no longer exists).

### Build 1 as built (8 October 2026)

Built as planned above, with these differences (the code wins; each is also in KNOWN_ISSUES BAS-60 to BAS-63, SUI-23, SUI-24 and EXP-36):

- **The function names:** the day engine is `R.startDay` → sea routes (`R.routesDueToday`, settled by the screen with their rolls) → `R.finishRoutes` → due orders (`R.dueOrders`) → `R.rollWarAttack` → `R.finishDay`, with `R.clockAction` (`anchor`, `pass`, `shift` or `none`), `R.anchor`, `R.shiftDays` and `R.upcoming`. There's no single `R.passDay` or `R.catchUp`: the screen (`passDays`, `runDay` in `tool.js`) runs each step and saves after it, so a step that needs a roll can wait for the DM.
- **Within a day,** the start of the day (`R.startDay`) does the repairs, recovery, wars ending, building, contract shipments and records ending (each record's last shipment comes on its final day, then it ends); sea routes settle next, and a route still sails on its own last day (it lasts through its `expiresDay`), unless its consortium ended that morning, which closes the route first, as it did with turns; then orders complete. `R.finishRoutes` only moves the day on to its orders.
- **Wars** keep the next day they roll (`wars[clan].next`, 7 days on from the last roll) rather than the last day they rolled; the effect is the same.
- **No "Days passed" review and no day pill as a button:** the bar shows the day as plain text ("Day N", or "Passing Day N…"), and "The Ironbow sends word…" is the review. The old Advance button stays only as **Finish Day N**, shown when a day was left part-way; the Bastion also finishes that day by itself when it next sees the Explorer's day.
- **The Explorer saves as soon as it first opens** (it used to save only after the first change), so a Bastion opened beside a brand-new Explorer reads Day 1 rather than Day 2.
- **Setting aside two saves in the same second** used to keep only the second; each now gets its own name (SUI-24).
- **A campaign Import** refuses while the other tool is open in another window, since that window would save over what was imported.
- **Tests:** 810 rules tests; `phase9.test.js` 107 checks; the new two-window test is `tests/e2e/bastion-days.test.js` (15 checks).

### Build 2: the screen

- The map-centred layout, the top bar, the bottom bar, the facility grid, the build panel, the facility panels, the panel buttons and pop-ups, the War Council lock, the shared tooltip, the laptop and TV fit.
- `tests/e2e/phase9.test.js` reworked around the new screen (keeping the data-test names where the thing is the same; nearly every layout check changes), plus a new `bastion-screen.test.js` for the grid, build flow, tooltips and bars.
- `tsi.bastion.ui` (remembered panel states) gets new ids; stale ones are discarded on load, and `ui.warNoticed` is kept so the war's "conditions stand" pop-up doesn't repeat. The War Table is still opened with the page's new bars made inert beneath it.

### Build 2 as built (8 October 2026)

Built as planned in section 5, with these differences (the code wins; also in KNOWN_ISSUES BAS-64, BAS-65 and SUI-25):

- **Panels are the suite's pop-ups,** one at a time. Each panel's contents are built once (the old cards' contents, unchanged) and kept up to date whether or not they're showing, so no rule or data-test name changed inside them.
- **An Orders panel,** from the top bar's Orders count: all the pending orders together (War Actions have no facility panel of their own). Each facility's panel also lists its own.
- **The Facilities count opens Construction,** so Clear extra builds can be reached when every slot is full. Construction fills the slot clicked, or the first free one.
- **The badge** (section 4's corner) opens Party Identity as it is today: it shows the crest once a Clan or Brigade has one, else a faint shield, with the name or "Unsworn". Build 3 brings the crest at any time and the reworked panel.
- **Tiles are 92 pixels** (they shrink if there are more than eleven, as an over-capacity import could give); the bottom bar is 128 pixels tall, 64 folded. The painting fits the space left (`fitMap`).
- **The War Council lock** (`R.warCouncilOpen`): open with a defender, beast or War Room unit, or while a war, a waiting War Action or a Military Action exists.
- **The shared tooltip** sits above or below what it describes (beside it when neither fits); its layer moved above pop-ups. Esc hides a keyboard tooltip before it closes a panel; Esc in the War Room's list closes the list, not the panel.
- **Tests:** `tests/e2e/bastion-screen.test.js` (35 checks) is new; `phase9.test.js` reaches every control through its panel (`TSI.bastion.debug.reveal`); 812 rules tests.

### Build 3: identity and the crest

- The Brigade archived; the crest any time; the Crest Creator's "Use for the Bastion"; the crest badge and the Party Identity panel; Form Clan's crest choice; tests and the guide.

(Build 2 and 3 could swap if Harry would rather see the crest first; the crest badge needs the new map panel, so they're ordered this way.)

### Build 3 as built (8 October 2026)

Built as planned in sections 3 and 4, with these differences and details (the code wins; also in KNOWN_ISSUES BAS-66, BAS-67, CRS-16 and SUI-26):

- **The archive is a plug-in.** `tools/bastion/archive/mercenary-brigade.js`, loaded after `war-campaign-rules.js`, puts back on `TSI.bastion.rules` everything that was removed: `canFormMerc`, the Brigade's label and requirements, a saved Brigade loading as one, a Brigade's `fullWar`, the Trusted Clients amounts on `warRewards`, and the old single roll (`warCommit`, `queueWarAction`, `warPlan`, `resolveWar`, `removeBeasts`). The Trusted Clients changing after a battle also need three lines back in `war-campaign-rules.js`, listed in its header. The Brigade's screen parts are kept there in a comment. Its ten tests passed with it loaded.
- **Data moved:** `identityRules.mercMinLevel` and `mercMinDefenders`, and `war.dc` (read only by the single roll), went from `bastion-data.js` into the archive.
- **Saves:** `trustedClientsByClan` stays in the state and every save, unread. A days save with a Brigade (possible from Builds 1 and 2) loads as Unsworn; `R.formerBrigade` lets the screen log the Brigade's name and say so once.
- **The live tests that used `R.queueWarAction`** only to make an old-style war order now build that order themselves (`oldWarOrder`), so the Military Action's old-order path is still tested.
- **The hand-off:** `TSI.handoff` kind `crest` (`tsi.suite.handoff-crest`), `{ id, at, name, dataUrl, design }`. The Bastion checks it as it opens, on the browser's storage event, and every 2 seconds, and asks only when nothing else is going on (no day being passed, no War Table). Either answer clears it. `R.crestFromHandoff` accepts only a PNG of up to about 3 MB and keeps only the design's plain settings.
- **The crest record** gains an optional `design` (`R.isCrest` checks it's a set of settings).
- **Form Clan's crest box:** Keep this crest appears once another has been picked; a crest uploaded there is used only on Confirm Founding. Founding without picking one keeps the Bastion's crest (before, it removed it).
- **The badge's label:** "Add a crest" with no crest; under a crest, the Clan's name or "Unsworn".
- **Tests:** rules tests for the archive, the old Brigade save, Clan-only war, the crest record and the hand-off; `phase9.test.js`'s crest section rewritten ("The crest, at any time (Build 3)") with two windows; `phase2.test.js` gains "Use for the Bastion"; `bastion-screen.test.js`'s badge check.
- **Not built (later):** re-editing the Bastion's crest in the Creator from its saved design.

## 8. Harry's answers (8 October 2026)

1. **A clock in the Bastion too?** No (default): Make Camp in the Explorer is the only way a day passes.
2. **A week's end?** Superseded by answer 9: there's no shared week's end; each thing runs every 7 days from its own start.
3. **The order days in section 2:** as proposed, for now; Harry will revise after playing.
4. **Everything else at 7 days per old turn:** yes (default).
5. **An old Brigade save:** moot; the old Bastion is set aside (section 1.6).
6. **When does Banner & War Council unlock?** Default: once you have anything that can fight (a defender, beast or regiment).
7. **A bigger map painting?** Default: use what we have.
8. **The Bastion keeps its own copy of the crest's design:** yes (default).
9. **The weekly reminder is dropped.** Instead: "The Ironbow sends word…" pop-ups for building and orders complete, agreements ending, and anything needing the DM (section 1.4).
10. **The Trade Agreement's duration choice stays**, shown in weeks (1, 3 or 6), and now counts; shipments arrive every 7 days; the Hall shows "X days remaining (Y shipments)"; an agreement's end is in the notifications. My reading, for Harry to correct: the roll's tier still adds or takes off weeks (+2 to −2, at least 1 week), as it did with turns.
11. **Artisan Tools into the Workshop's panel:** yes (default).
12. **The treasury in the top bar only:** yes (default).
13. **"Day Log":** yes (default).
14. **Harry's save:** a fresh Bastion; the old one is set aside, not deleted.
15. **New: one campaign save** across the Explorer and the Bastion (section 1.6a).

## 9. Decided for you (easy to change later)

- A day's events are processed at the moment the Bastion notices the new day (on opening, or within 2 seconds while open), in the Bastion's own window.
- A cancelled roll leaves the order due, with a Resolve button; nothing is lost.
- The log records only days on which something happened.
- Patrol's Advantage covers 7 days from the day the order completes.
- The last Bastion event stays on screen until the next is rolled.
- Founding a Clan records the day ("Founded on Day N") instead of a turn number.
- Tile order in the grid: the five starting facilities first (Workshop, Barracks, Watchtower, Dock, Armoury), then the slots in the order they were built.
- The Hall of Emissaries counts as a built facility in the Facilities number and sits in the grid like any other.
- The "Already open" warning still stops two Bastion windows; the Explorer and the Bastion together never warn.

## Appendix: what the code mapping found (for the sessions that build this)

- **The turn counter** `state.turn` (starts at 1) is read in about 130 places across `rules.js`, `war-campaign-rules.js` and `tool.js`, and in 131 test references over 8 test files. Every clocked thing stores a turn number: `pendingOrders[].issuedTurn/completeTurn`, `builtExtras[].remaining`, diplomacy records' `turnsLeft` and `incomePerTurn`, `diplomacy.cooldowns`, routes' `expiresTurn`, `tradeNetwork.lastResolvedTurn` and `settled.turn`, `repairs[id]`, `warRecovery[].untilTurn`, `wars[clan].since/last`, `militaryActions[].turn`, `warMissions` `createdTurn/seenTurn`, `organization.foundedAtTurn`, disputes' `createdTurn/disruptedTurn`, `turnInProgress`. Two dead fields (`tradeNetwork.recruitmentBoostTurns`, `arbitration.lastSpawnTurn`) are never read and can go.
- **Advance Bastion Turn** (`tool.js runTurn`, `rules.js startTurn/tickTurn/finishTurn`) runs: turn + 1 → recovery, wars, repairs, diplomacy income and countdowns → trade routes (dice) → construction, clear the event, clear Patrol → due orders (dice) → the attack roll → the 4th-turn event. `turnInProgress {turn, stage, skipped, attackRolled}` makes it resumable.
- **No order has its own duration today**: every order completes next turn (`completeTurn = turn + 1`); the Hall's five actions carry `special.durationTurns` (4/2/3/4/5) for how long their *records* last.
- **The War Council has no lock**; identity only matters for Lieutenants and regiments (`fullWar`), Clan Honour (a Clan) and Trusted Clients (a Brigade). The Brigade's code is in `rules.js` (canFormMerc, requirementsHint, orgLabel, the phase-1 resolveWar), `war-campaign-rules.js` (the TRUSTED table, warRewards, applyRewards, rewardLines) and `tool.js` (the form, the trust box, the strings), with tests in `bastion.test.js`, `bastion-campaign.test.js` and `phase9.test.js`.
- **The crest** (`tsi.bastion.crest`) is only shown, and can only be uploaded, once a Clan or Brigade exists (`tool.js` 732, 839, 847). The Crest Creator draws pure path data into SVG and makes its PNG from its own SVG on a canvas, which works from a double-clicked file; `TSI.handoff` knows only the kinds `fight` and `result`, so a `crest` kind needs adding in `shared/js/store-rules.js spaceNames` (suite and test spaces) and `shared/js/handoff.js`.
- **The screen** is one scrolling page drawn by `renderAll()` after every change; the map is a 1152 × 768 `<img>` with full-frame overlay PNGs (`object-fit: contain`), nothing on it clickable; one shared tooltip (`bindTip`, `bindFocusTip`) already exists; four cards remember their collapsed state in `tsi.bastion.ui`.
- **The Explorer's clock**: `travel.day`, advanced in `rules.js makeCamp`, reset in `resetTravel` (which shifts effects and threads with `journey.js shiftDays`); the weekly `bastionPrompt` is queued by `isBastionDay`; the Explorer already reads the Bastion's party level live (`store.fresh`), and the DM doc shows the pattern for following two saves at once.
