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
- `phase2.test.js`: the Clan Crest Creator
- `phase3.test.js`: the Pelagosi Puzzle Trials
- `phase4.test.js`: the Notice Board, including its players' window and the ★ → Knightly Treasures link. A stand-in plays Matt's database (the test pretends to be the database's web connection), so nothing is ever sent to the real shop.
- `phase5.test.js`: The Heartwood Ritual. The test browser can't play MP4 films, so a film ends the moment it starts, as it did in the old tool when a film couldn't load.
- `phase6.test.js`: the Arenas of The Scarlett Isles. It controls the page's clock, so the 5-second pictures can be moved on without waiting.
- `phase7.test.js`: the Combat Tracker and its Battlemap window. It opens the Battlemap as the real pop-up window, uploads a map, drags tokens, and checks they stay on the same spot of the map picture at different window sizes and zooms.
- `phase8.test.js`: the Scarlett Isles Explorer. It drags heroes by whole hexes, checks miles, fog, pins and camp pop-ups, checks pins and heroes stay on the same spot of the map picture on the laptop, the TV and in full screen, and makes the same journey with the same dice in the old Explorer (served from `_legacy/` by a tiny local web server, because the old tool loads its events with `fetch()`) and the rebuild. It also checks `tests/pin-check.html`.

When the old tool is in `_legacy/`, most of them also play the same moves in it and compare: the Crest's drawing, rolls and PNG (`_legacy/clan-crest-creator`); Pelagosi's sequences, counts and texts (`_legacy/pelagosi_marker_rune_puzzle`); the Notice Board's boards, outlines, accepted list and shop messages (`_legacy/scarlett-isles-quest-generator`); the Ritual's screen after every move (`_legacy/tellurian-ritual-engine`); the Arenas' whole game, round by round, with the same dice (`_legacy/arenas-of-the-scarlett-isles`); and the Combat Tracker's desk turn by turn, plus the tokens each Battlemap shows (`_legacy/scarlettisles-encounter-tracker`). Old tools that load files with `fetch()` are served by a tiny web server inside the test. Clone them from the links in the handover's section 16. Each test says it skipped that part when the old tool isn't there.

`helpers.js` holds the shared pieces: screen sizes, a record of any internet requests or missing files, and helpers for downloads, file pickers, pop-ups and notices.

## What the tests use

- `tests/harness.html` is a copy of `index.html` that adds a pretend **Demo tool** (`tests/fixtures/`). It tests saving, Export and Import, shutting a tool down, player windows and error handling before any real tool exists. It has its own saved data (the browser database `tsi.test`, set by `data-tsi-space="test"` on its `<html>`) and its own backups, so nothing it does can reach the real suite's saves or backups, and neither will load the other's backup files. The top bar says "Test page".
- Buttons ignore a second click within 350 ms (double-click protection), so the helpers pause briefly before clicking the same button again.
- Don't use Playwright's request interception with player windows: it stops their stylesheets loading.
