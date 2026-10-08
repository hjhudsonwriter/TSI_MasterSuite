# The Ironbow Bastion Manager: the days-and-map overhaul (plan, version 1)

*8 October 2026. Written for Harry to review before anything is built. Nothing in this plan is built yet.*

## Harry's brief, in short

1. **No more Bastion turns.** The Bastion follows the Explorer's day-by-day clock, tracking every day that passes, and can be opened at any time from the Explorer (as well as from the home screen).
2. **Facility orders take in-game days**, not turns. I pick a sensible number of days for every order first; Harry revises.
3. **The Mercenary Brigade goes** (its code kept aside for later). Form Clan stays.
4. **A crest for the Bastion at any time.** It hovers over the top-right corner of the Bastion map; clicking it opens the Party Identity panel (Form Clan, no Brigade). Forming a Clan can keep that crest or make a new one.
5. **A new screen built around a large Bastion map:** a top bar inside the map panel (day, editable treasury with a coin icon, active facilities, pending orders, each with a hover list), and a bottom bar with a collapsible facility grid in the middle (artwork tiles; hover for name, level and pending orders; click for the facility's panel; empty slots locked until the party's level allows; an available slot highlights with "click to build a new facility" and opens a build panel with a larger grid of facilities, hover for what it does and how long it takes, click to confirm "Construct X?", then an hourglass on the tile until it's done). Buttons either side of the grid open the Warehouse, Management, the log, Bastion Events, Clan Influence, Favour of the Gods (without Political Capital, which lives in Clan Influence) and Banner & War Council (locked until the requirements are met). The Hall of Emissaries' tile opens the Hall's own panel.
6. **Aesthetic reference:** the two Heroes-of-Might-and-Magic-style town screenshots: a painted town as the hero of the page, gold-framed tooltip cards, a resource strip, and a bottom bar of square slots. Taken as inspiration only; the Scarlett Isles look (near-black, burgundy, antique gold, Cinzel) stays.

The code mapping behind this plan (ten readers over the Bastion's 15,000 lines, the Explorer's clock, the Crest Creator and the tests) is summarised in the appendix.

## At a glance

- **One clock.** The Explorer's day is the campaign's only clock. The Bastion reads it (every two seconds while open, and the moment it opens), passes the days that have gone by, and never changes it. Its old "Advance Bastion Turn" button goes.
- **Days for orders; a week's end for the economy and the war.** Facility orders and building work count in days and complete on their day. Everything that used to happen "each turn" (contract income, trade routes, the attack roll while at war, the automatic Bastion event every fourth turn) happens at **the week's end: the Make Camp that starts Day 8, 15, 22…**, the same rhythm the Explorer already reminds you about. Every old length that isn't an order stays what it was, counted as **7 days per turn**, so the balance of agreements, wars, repairs and recovery doesn't change.
- **Nothing is applied twice, nothing is lost.** A day is processed step by step and saved after each step, as a turn is now. If a roll is cancelled or Edge is closed mid-way, the Bastion picks up where it was.
- **Existing saves carry on.** On first open, the Bastion takes the Explorer's current day as its own and converts everything in progress at 7 days per turn, so an order with one turn left is due in 7 days. Old backup files still import.
- **The Brigade is archived**, not deleted: its code and tests move to `tools/bastion/archive/`, loaded by nothing.
- **The crest** can be made at any time, in the Clan Crest Creator (sent straight to the Bastion from there, no download-and-upload) or uploaded, and shows over the map.
- **Three builds, three pull requests:** time first (so Harry can playtest the day counts on the screen he knows), then the new screen, then the identity and crest work.

## 1. Time: days instead of turns

### 1.1 Where the day comes from

- The Explorer's `travel.day` is the clock. Make Camp moves it on by one. Reset Travel puts it back to Day 1.
- The Bastion keeps `state.day`: the last day it has processed. On opening, and every 2 seconds while open (the DM doc's method: `TSI.store.fresh('tsi.explorer.save')`, plus a read whenever this window saves or comes back into view), it compares the Explorer's day with its own:
  - **Explorer ahead:** the days in between pass, one at a time (section 1.3).
  - **Explorer behind (Reset Travel):** nothing rewinds. The Bastion re-anchors to the new day and every due day moves with it (an order due in 4 days is still due in 4 days), exactly as the Explorer shifts its own effects and threads. A log line says so.
  - **No Explorer save yet:** the Bastion sits on Day 1 and nothing passes. The top bar says "Day 1 · the Explorer sets the day".
- The Bastion only ever **reads** the Explorer's save. It never writes it, so two windows can't overwrite each other.
- The Bastion's own top bar shows the day. The Bastion has **no button of its own to pass a day** (question 1 asks whether Harry wants one for sessions without the Explorer).

### 1.2 What's daily and what's weekly

| | Was | Becomes |
|---|---|---|
| Facility orders | 1 turn, all of them | **days per order** (section 2) |
| Building a facility | 3 / 4 / 5 / 5 turns by required level 5 / 9 / 13 / 17 | **21 / 28 / 35 / 35 days** |
| Hall of Emissaries actions | 1 turn | days per action (section 2) |
| Agreements, delegations, summits, writs, consortiums | 4 / 2 / 3 / 4 / 5 turns, ± the roll tier's 2 / 1 / 0 / −1 / −2 | **28 / 14 / 21 / 28 / 35 days**, ± 14 / 7 / 0 / −7 / −14 |
| Contract income | paid each turn | **paid at each week's end** (the same amount) |
| Trade routes | settled once a turn, high-risk ones with a d20 | **settled at each week's end** (same rolls) |
| A consortium's sea route | lasts 5 turns | **35 days** |
| Hall cooldown after a bad failure | 2 turns | **14 days** |
| Trade Network investments | 1 turn | Stability 7 days, Yield 7 days, Routing Doctrine 1 day |
| Watchtower Patrol | Advantage "this turn" | the order takes 1 day; the Advantage then **covers the next 7 days** |
| A queued War Action | musters next turn | **musters 3 days after it's queued** |
| The attack roll while at war | a d6 per Clan, each turn | a d6 per Clan **at each week's end** (so the odds per week are unchanged) |
| Peace after quiet | 6 turns without a battle | **42 days** without a battle |
| Cancelling a War Action refunds its cost | if cancelled the same turn, before that turn's attack roll | if cancelled **the same day it was queued**, and before the next week's end |
| Under Repair after a lost defence | 2 turns, the turn of the loss included | **14 days**, the day of the loss included |
| Wounded Lieutenants and beasts | separated 1 turn, recovered 1, wounded 2, badly wounded 3 | **7 / 7 / 14 / 21 days** |
| Automatic Bastion event | every 4th turn | at the end of **every 4th week** (Days 29, 57, 85…) |
| The last event on screen | cleared each turn | stays until the next event is rolled |
| The Bastion's week | "Advance Bastion Turn (+7 days)" | the Make Camp that starts Day 8, 15, 22… (the Explorer's existing `TSI.campaign.isBastionDay`) |

The principle: **only facility orders get new, hand-picked lengths** (Harry's instruction). Everything else keeps its old length at 7 days per turn, so nothing Harry has already agreed about the war, trade or diplomacy changes its balance. He can shorten any of these afterwards; each is one number in a data file.

### 1.3 What happens when a day passes

For each day, in this order (saved after every step, so a closed window never loses or repeats anything):

1. **Start of day:** repairs that end today end; wounded Lieutenants and beasts due back today come back; building work due today completes ("The Smithy is now built and active."); diplomacy records that end today end (and a sea route whose consortium has ended expires).
2. **Week's end** (only on Days 8, 15, 22…): contract income is paid; trade routes settle (a d20 for each high-risk route, as now); the attack roll (a d6 per Clan at war; a 1 brings "Sound the horns!", at most one attack per week, none while a defence is still waiting); every 4th week the automatic Bastion event.
3. **Orders due today** complete, one by one, each asking for its roll where it needs one (Hall actions, War Actions that become Military Actions), with the same pop-ups as today.
4. **Done:** the log gets one line per day only when something happened ("Day 12: the Barracks recruited 3 defenders.").

When several days pass at once (the Explorer made camp four times while the Bastion was closed), they are processed in sequence in one sitting, with one pop-up per thing that needs the DM. A cancelled roll leaves that order **due** (it shows a "Resolve" button in its facility panel and in the pending-orders list, and comes up again the next time a day passes). The old "Finish Bastion Turn N" resume survives as "Finish Day N" if Edge is closed mid-way.

Patrol's Advantage, the attack roll and the Military Action keep their current order within a day, so a Patrol that completes on a week's end still counts for that week's attack.

### 1.4 The Explorer's side

- A new **Open the Bastion ↗** button in the Explorer's Travel panel, under Make Camp. It opens the Bastion in a new window (ready for the TV); if the Bastion is already open in another window it says so instead of opening a second one (the "Already open" guard).
- The weekly reminder at Make Camp on Days 8, 15, 22… stays, reworded: **"Week's end at the Ironbow"**, "Contract income, trade routes and any war settle at the Ironbow this week. Open the Bastion to see what happened.", with its Open button.
- After any Make Camp, if the Bastion's save shows an order or a building finishing on the new day, the Travel panel's notice line says so ("The Ironbow: 2 orders complete today.") without a pop-up. The Explorer only reads the Bastion's save for this.

### 1.5 The DM doc

The two turn tiles become: **Orders pending** (how many; "next completes Day N") and **Week's end** ("in N days, Day N, at Make Camp"). The Bastion's day is the Explorer's, so no extra day tile. "Party level", "Where the party is" and the standings are unchanged.

### 1.6 Existing saves (Harry's table save included)

On the first open after the update:

- `state.day` becomes the Explorer's current day (or 1 if the Explorer has never saved).
- Everything in progress keeps the time it had left, at **7 days per turn**: an order with 1 turn left is due in 7 days; building with 2 turns left needs 14 days; an agreement with 3 turns left ends in 21 days; a cooldown of 2 turns ends in 14 days; repairs and recovery likewise; a war's "since" and "last" days are counted back from today at 7 days per turn.
- The Turn Log's old entries stay as they are (they're history); new entries say "Day N".
- Old backup files import the same way. The save's shape gets a version number so this conversion runs once.
- An old save that had formed a **Mercenary Brigade** becomes Unsworn, its name kept in the save (`organization.formerBrigade`) and its crest kept, with a log line explaining (question 5 offers the alternative: treat it as a Clan).

### 1.7 Two windows, and the rules that stop double-counting

- With the Explorer on the laptop and the Bastion on the TV, the Bastion notices a new day within about 2 seconds and runs the day's pop-ups in its own window.
- Every guard that stopped a route paying twice or an attack rolling twice within a turn is re-keyed on the **day** (and, for weekly things, on the **week number** = floor((day − 1) / 7)): `tradeNetwork.lastSettledWeek`, `state.lastAttackWeek`, `state.lastAutoEventWeek`, `dayInProgress {day, stage, skipped, attackRolled}` in place of `turnInProgress`.
- All of this lives in plain rules functions (`R.passDay`, `R.weekEnd`, `R.catchUp`, `R.shiftDays`, `R.migrateTurnsToDays`), tested on `tests/rules.html` with fixed dice.

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
| Hall of Emissaries (5) | Secure Trade Agreement | **7** |
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
- **Kept aside:** all of it moves, as working code with its tests, to `tools/bastion/archive/mercenary-brigade.js` and `tests/archive/mercenary-brigade.test.js`, loaded by nothing, with a note at the top saying how to put it back. The old single-roll war that the screen no longer uses (`R.warCommit`, `R.queueWarAction`, `R.warPlan`, `R.resolveWar`) goes into the archive with it.
- **Unchanged:** an Unsworn party can still send defenders and beasts to war, as now; Form Clan's requirements (level 9, total support 360, three Clans at 55) are as they are.
- **Saves:** section 1.6.

## 4. The crest, at any time

- **Where it lives:** as now, `tsi.bastion.crest` ({ dataUrl, key, name }), plus the Crest Creator's design (its 25 settings) when the crest came from there, so it can be re-edited later. It belongs to the Bastion, not the Clan: forming a Clan doesn't change it, and it's shown whether the party is Unsworn or a Clan.
- **Three ways to set it,** from the Party Identity panel (and from the crest badge's empty state):
  1. **Create in the Clan Crest Creator ↗** opens the Creator in a new window. The Creator gets a new button beside Download PNG: **Use for the Bastion**. It sends the crest to the Bastion through the suite's hand-off (a new `crest` kind of `TSI.handoff`, like the fight hand-off: a 512-pixel picture plus the design). A Bastion window hears it within a moment and asks "Use this crest for the Bastion?"; if the Bastion isn't open it asks when next opened. No downloading and uploading. This is allowed from a double-clicked file because the Creator draws only its own path data, never a bundled picture (its Download PNG already proves it offline).
  2. **Upload a picture** (PNG, JPG, WebP or GIF, as now).
  3. **Remove**.
- **The badge:** top-right corner of the Bastion map, about 112 pixels, in the gold frame with its soft glow, above the facility overlays. With no crest it shows a faint empty shield and "Add a crest". Clicking it (or pressing Enter on it) opens the Party Identity panel.
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

### Build 1: days (the rules change, on the screen Harry knows)

- `shared/js/campaign-rules.js`: `weekOf(day)`, `isWeekEnd(day)` (the existing `isBastionDay`), `nextWeekEnd(day)`.
- `tools/bastion/rules.js` and `war-campaign-rules.js`: `state.day`, the day engine (`passDay`, `weekEnd`, `catchUp` with `dayInProgress`), due days everywhere a turn number was, `shiftDays`, `migrateTurnsToDays`, the save version.
- `tools/bastion/data/facilities-data.js` and `bastion-data.js`: `days` on every order; durations in days; the data comments reworded.
- `tools/bastion/tool.js`: reads the Explorer's day live; the Advance button becomes the day pill and a "Days passed" review; every "turn" string reworded; "Resolve" on a due order; the log stamped with days.
- The Explorer: the Open the Bastion ↗ button, the reworded weekly reminder, the "orders complete today" notice line. The DM doc's two tiles.
- Tests: the Bastion's rules tests rewritten for days (about 130 turn references across the rules and click-through tests); new tests for the day engine, the week's end, catching up several days, Reset Travel, migration and the two-window link; `tests/e2e/phase9.test.js` updated. The side-by-side run against the old Bastion is **retired** (the new Bastion deliberately differs; recorded in KNOWN_ISSUES).
- Docs: KNOWN_ISSUES (a new BAS entry for the day clock, and the retired comparison), PROGRESS, WAR-RULES.md's turn wording, the guide.

### Build 2: the screen

- The map-centred layout, the top bar, the bottom bar, the facility grid, the build panel, the facility panels, the panel buttons and pop-ups, the War Council lock, the shared tooltip, the laptop and TV fit.
- `tests/e2e/phase9.test.js` reworked around the new screen (keeping the data-test names where the thing is the same), plus a new `bastion-screen.test.js` for the grid, build flow, tooltips and bars.

### Build 3: identity and the crest

- The Brigade archived; the crest any time; the Crest Creator's "Use for the Bastion"; the crest badge and the Party Identity panel; Form Clan's crest choice; tests and the guide.

(Build 2 and 3 could swap if Harry would rather see the crest first; the crest badge needs the new map panel, so they're ordered this way.)

## 8. Questions for Harry

Each has a default so the build can start on "use the defaults".

1. **A clock in the Bastion too?** Default: **no**; Make Camp in the Explorer is the only way a day passes. (Alternative: a "Pass a day" button in the Bastion for sessions with no travel; it would then move the Explorer's day too, which breaks the one-tool-writes-its-own-save rule, so I'd rather not.)
2. **The week's end on Days 8, 15, 22…** for income, routes, the attack roll and the automatic event. Default: **yes**. (Alternative: pay income daily at a seventh; I'd advise against: seven times the dice for high-risk routes.)
3. **The order days in section 2.** Default: as proposed; tell me which to change.
4. **Everything else at 7 days per old turn** (building 21–35 days, agreements 14–35, cooldown 14, repairs 14, recovery 7–21, peace 42, the muster 3). Default: **yes**. Say if building should be quicker.
5. **An old save that formed a Mercenary Brigade** becomes Unsworn (name and crest kept). Default: **yes**. (Alternative: it becomes a Clan of the same name.)
6. **When does the Banner & War Council unlock?** Default: **(a) once you have anything that can fight** (a defender, beast or regiment), which is when war is possible today. Alternatives: (b) once a Clan is formed (level 9; this would end Unsworn wars), (c) once the War Room is built (level 17).
7. **A bigger map painting?** On the TV the painting will show slightly larger than it is. If Harry can export `bastion_artwork.png` and the eight overlays at 2304 × 1536 they'd stay crisp. Default: use what we have.
8. **The crest and the Creator's remembered design.** The Bastion keeps its own copy (so experimenting in the Creator later doesn't change the Bastion's crest until you press Use for the Bastion again). Default: **yes**.
9. **The Explorer's reminder** becomes "Week's end at the Ironbow" on Days 8, 15, 22…, plus a one-line notice after any Make Camp when orders complete that day. Default: **yes**.
10. **Small kept quirks worth deciding now,** since the code they sit in is being rewritten: drop the Trade Agreement duration choice that has never done anything (B5)? Default: **drop it**. Everything else in B2–B24 stays.
11. **Artisan Tools** move into the Workshop's panel (they only feed Workshop Craft). Default: **yes**.
12. **The treasury** is edited in the top bar only; the Management panel keeps defenders, beasts and military. Default: **yes**.
13. **The log's name:** "Day Log" (the brief says "turn log"). Default: **Day Log**.

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
