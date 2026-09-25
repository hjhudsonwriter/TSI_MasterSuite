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

Each phase adds its own `phaseN.test.js`. `helpers.js` holds the shared pieces: screen sizes, a record of any internet requests or missing files, and helpers for downloads, file pickers, pop-ups and notices.

## What the tests use

- `tests/harness.html` is a copy of `index.html` that adds a pretend **Demo tool** (`tests/fixtures/`). It tests saving, Export and Import, shutting a tool down, player windows and error handling before any real tool exists. It has its own saved data (the browser database `tsi.test`, set by `data-tsi-space="test"` on its `<html>`) and its own backups, so nothing it does can reach the real suite's saves or backups, and neither will load the other's backup files. The top bar says "Test page".
- Buttons ignore a second click within 350 ms (double-click protection), so the helpers pause briefly before clicking the same button again.
- Don't use Playwright's request interception with player windows: it stops their stylesheets loading.
