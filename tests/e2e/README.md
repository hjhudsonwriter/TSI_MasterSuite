# Click-through tests

These open the suite from its files (`file://`) in a headless Chromium browser (the engine inside Edge) and click through it, at Harry's screen sizes:

- the laptop in a maximised Edge window (1707 × 930, pixel ratio 1.5) and in full screen (1707 × 1067)
- the TV (1920 × 1080, pixel ratio 1)
- a smaller window (1280 × 720)

They're for the people building the suite. Harry doesn't need to run them; his checks are the tickbox lists in each pull request, and `tests/rules.html`, which he can double-click.

## Running them

Needs Node.js and Playwright with its Chromium browser.

```
node tests/e2e/phase1.test.js
```

If Playwright is installed globally, point Node at it, e.g. `NODE_PATH=$(npm root -g) node tests/e2e/phase1.test.js`. Screenshots go to the folder in `TSI_SHOTS` (or the system temp folder).

Each phase adds its own `phaseN.test.js`:

- `phase1.test.js`: the shell
- `phase2.test.js`: the Clan Crest Creator, reworked in September 2026. It clicks every shield shape, division, band and sigil tile, the rim, finish and motto choices, the sliders, the colour palette and colour schemes, Random Crest and Reset; downloads PNGs; and checks every tab on the laptop and the TV. (Before the rework it compared the drawing with the old tool; the new crest is deliberately different.)
- `phase3.test.js`: the Pelagosi Puzzle Trials
- `phase4.test.js`: the Notice Board, including its players' window and the ★ → Knightly Treasures link. A stand-in plays Matt's database (the test pretends to be the database's web connection), so nothing is ever sent to the real shop.
- `phase5.test.js`: The Heartwood Ritual. The test browser can't play MP4 films, so a film ends the moment it starts, as it did in the old tool when a film couldn't load.
- `phase6.test.js`: the Arenas of The Scarlett Isles. It controls the page's clock, so the 5-second pictures can be moved on without waiting.
- `phase7.test.js`: the Combat Tracker and its Battlemap window. It opens the Battlemap as the real pop-up window, uploads a map, drags tokens, and checks they stay on the same spot of the map picture at different window sizes and zooms.
- `phase8.test.js`: the Scarlett Isles Explorer. It drags heroes by whole hexes, checks miles, fog, pins and camp pop-ups, checks pins and heroes stay on the same spot of the map picture on the laptop, the TV and in full screen, and makes the same journey with the same dice in the old Explorer (served from `_legacy/` by a tiny local web server, because the old tool loads its events with `fetch()`) and the rebuild. It also checks `tests/pin-check.html`.
- `phase9.test.js`: The Ironbow Bastion Manager. It builds, orders and advances turns; cancels rolls and reopens the page mid-turn to check nothing is lost or counted twice; runs the Hall, trade routes, the Council Ledger, identity, war, the warehouse and the Compendium; and runs the same 12-turn campaign with the same dice in the old Bastion (served from `_legacy/`, opened at `/bastion_manager/`, because the old tool builds its paths from the first folder in the address) and the rebuild, comparing the saved Bastion at every step.
- `fights.test.js`: an Explorer fight set up in the Combat Tracker, across two windows. The Explorer sends a fight (with the party level read from the Bastion), the tracker opens and loads it, the Battlemap shows the map and tokens, beating every enemy reports back to the Explorer, and Won clears it. It also tries a tracker already open, Not now, a reload part-way and a restored backup, and checks the fight step fits the laptop, full screen and the TV.
- `dmdoc.test.js`: the DM doc's contents. It sets the Bastion's level, turns and standings, picks Regions in the Explorer, plays an event that gives an Active Effect and makes camp until it ends, changes the Bastion in a second window, and checks the DM doc shows each change by itself, reads nothing while closed, and fits the laptop and the TV.
- `war-table.test.js`: the Bastion's War Table on its own (the war mini-game's battle screen). It opens `tests/war-table.html`, a page with the real War Table files and a pretend Bastion behind them, and clicks through setup, terrain painting, deployment, a battle, DM: pause, the result and the layout on the laptop and the TV. Its test pictures are drawn by the browser when it starts. The whole war, from the War Room to the War Report, is in `phase9.test.js`.
- `guide.test.js`: the how-to guide (`guide.html`). It opens the guide from the home screen at every screen size, prints it, follows every link, and checks that every button or label the guide names in bold really exists in its tool (on screen or in the tool's code), so the guide can't quietly drift out of date.

When the old tool is in `_legacy/`, most of them also play the same moves in it and compare: Pelagosi's sequences, counts and texts (`_legacy/pelagosi_marker_rune_puzzle`); the Notice Board's boards, outlines, accepted list and shop messages (`_legacy/scarlett-isles-quest-generator`); the Ritual's screen after every move (`_legacy/tellurian-ritual-engine`); the Arenas' whole game, round by round, with the same dice (`_legacy/arenas-of-the-scarlett-isles`); the Combat Tracker's desk turn by turn, plus the tokens each Battlemap shows (`_legacy/scarlettisles-encounter-tracker`); the Explorer's journey (`_legacy/scarlett-isles-explorer`); and the Bastion's campaign (`_legacy/bastion_manager`). Old tools that load files with `fetch()` are served by a tiny web server inside the test. Clone them from the links in the handover's section 16. Each test says it skipped that part when the old tool isn't there.

`helpers.js` holds the shared pieces: screen sizes, a record of any internet requests or missing files, and helpers for downloads, file pickers, pop-ups and notices.

## What the tests use

- `tests/harness.html` is a copy of `index.html` that adds a pretend **Demo tool** (`tests/fixtures/`). It tests saving, Export and Import, shutting a tool down, player windows and error handling before any real tool exists. It has its own saved data (the browser database `tsi.test`, set by `data-tsi-space="test"` on its `<html>`) and its own backups, so nothing it does can reach the real suite's saves or backups, and neither will load the other's backup files. The top bar says "Test page".
- Buttons ignore a second click within 350 ms (double-click protection), so the helpers pause briefly before clicking the same button again.
- Don't use Playwright's request interception with player windows: it stops their stylesheets loading.
