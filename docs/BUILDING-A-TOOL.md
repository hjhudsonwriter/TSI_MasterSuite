# Building a tool into the suite

Notes for the sessions that rebuild each tool (phases 2–9). Read CLAUDE.md and `docs/PLAN.md` first. `tests/fixtures/demo-tool.js` is a small working example of everything below.

## 1. List it

In `shared/data/tools.js`, set the tool's `built: true` and list its files, relative to the suite's top folder:

```js
{ id: 'crest', ..., built: true, saves: false,
  files: { css: ['tools/crest/crest.css'], js: ['tools/crest/data/parts.js', 'tools/crest/rules.js', 'tools/crest/tool.js'] } }
```

The shell loads the styles, then the scripts in order, with plain tags. No modules, no `fetch()`. Content goes in `data/*.js` files that set `window.TSI_DATA.<something>`.

To show painted art behind the tool, as the home screen does, add `art: 'path/to/picture.png'` to the entry. The Crest uses `shared/art/hero.png`.

## 2. Register it

```js
(function () {
  'use strict';
  var TSI = window.TSI;
  var crest = TSI.crest = TSI.crest || {};   // the tool's own namespace for its code

  TSI.registerTool('crest', {
    start: function (ctx) { /* draw into ctx.root */ },
    stop: function (ctx) { /* optional: save, wait for something; may return a promise (up to 2.5 s) */ },
    validateImport: function (records) { /* optional: return a plain-English reason to refuse a file, or null */ }
  });
}());
```

`start` may return a promise. If `start` throws, the shell shows "… couldn't open" with the details, and a way home.

## 3. What `ctx` gives you

| | |
|---|---|
| `ctx.root` | The `<main>` element to draw into. It has the classes `tsi-tool tsi-tool--<id>`. |
| `ctx.life` | The lifecycle helper. Use it for **every** timer, animation frame, listener, key shortcut, sound and video: `life.setTimeout`, `life.setInterval`, `life.raf`, `life.wait(ms)`, `life.on(target, type, fn)`, `life.onKey(fn)`, `life.audio(src, {loop, volume})`, `life.track(videoEl)`, `life.onStop(fn)`. It stops them all when the tool closes, and shows the error bar if one of them throws. `life.onKey` skips key presses while typing in a text box or while a pop-up is open. |
| `ctx.life.group()` | A separate set of timers for one part of a tool, such as one puzzle or one animation: `g.setTimeout`, `g.clearTimeout`, `g.wait(ms)`, `g.raf`, `g.clear()`, `g.counts()`. `g.clear()` cancels only that group's timers, and a `g.wait` that was cleared never finishes, so an `async` sequence stops where it is. Clear the group whenever that part is reset, restarted or left. Closing the tool clears every group too. The Pelagosi Puzzle Trials use one group per puzzle. |
| `ctx.store` | This tool's saves: `get(name, fallback)`, `set(name, value)`, `remove(name)`, `has(name)`, `names()`, `savedAt(name)`. Names become `tsi.<tool>.<name>`. Reading is instant; writing saves a moment later. Values must be plain JSON (use data URLs for pictures). |
| `ctx.store.quarantine(name, reason)` | When a save can't be read: sets it aside (never deletes it), tells the user, and you start fresh. |
| `ctx.playerLink({ view, getState, onMessage, onStatus })` | A player window (see below). It closes when the tool closes. |
| `ctx.setLeaveCheck(fn)` | For tools that don't save: `fn` returns a message such as "This will end the ritual in progress." when leaving would lose something, or `null`. The shell asks before Home, Switch tool, or closing the tab. |
| `ctx.notify`, `ctx.modal` | Notices (`TSI.notify(text, { type: 'ok' | 'warn' | 'error', actions })`) and pop-ups (`TSI.modal.confirm`, `.alert`, `.open`). Use these instead of `alert()` and `confirm()`: they open inside whatever is in full screen, so the TV view shows them. A pop-up that changes as you go (the Explorer's events) can pass `className` and `onOpen({ dialog, title, body, foot, close })` to `TSI.modal.open`. |

The test page (`tests/harness.html`) keeps its saved data apart from the real suite (`TSI.space` is `'test'`, the database is `tsi.test`). Tools don't need to do anything about this.

Other shared helpers: `TSI.el(tag, attrs, children)` builds elements (text is always set as text, never HTML). `TSI.oneAtATime(fn)` makes a button ignore double clicks and held-down Enter. `TSI.the(name)` puts "the" before a name, unless it already starts with "The". Other helpers: `TSI.download`, `TSI.pickFile`, `TSI.readFileText`, `TSI.dates`, and `TSI.keys.isTyping`.

## 4. Saving and backups

- Tools with `saves: true` get **Export**, **Import** and a "Saved ✓" status in the top bar automatically, and are included in **Back up everything**. You don't write any of that.
- If a save fails, the shell shows the warning. Just keep calling `ctx.store.set`; it retries.
- Check what you load. If it doesn't make sense, call `ctx.store.quarantine` and start fresh. Never delete a save.
- **Long actions with several pop-ups** (such as the Bastion's Advance Bastion Turn, which can ask for many dice rolls): save where you've got to in the state itself (the Bastion's `turnInProgress`), and apply and save each step as soon as its answer is in. Then a cancelled pop-up or a closed window loses nothing, and the action can be finished later. After every `await` of a pop-up, check `ctx.life.alive`: when the tool closes, open pop-ups close as if cancelled, and nothing more should change.

## 5. Player windows

The tool side:

```js
var link = ctx.playerLink({ view: 'noticeboard', getState: function () { return {...}; }, onMessage: function (type, payload) {} });
button.onclick = function () { link.open(); };   // must be from a click
link.sync();                                      // after every change: sends getState()
```

The players' side is a view. Add it to the tool's entry in `tools.js`: `playerViews: { noticeboard: { css: [...], js: [...] } }`. Then register it:

```js
TSI.registerPlayerView('noticeboard', {
  title: 'Notice Board',
  mount: function (root, api) { /* api.send(type, payload) talks back */ },
  state: function (payload) { /* redraw everything */ },
  message: function (type, payload) { /* optional */ }
});
```

Refreshing either window and reloading the tool's page are handled. Messages are checked by which window sent them.

**A player window with its own controls (the Battlemap, phase 7).** The Combat Tracker's Battlemap is a view with DM controls that also goes on the TV. Its pattern:
- **The tool keeps every save.** The view sends each change back with `api.send('vtt', patch)` and the tool saves it (`onMessage`). So there's only one saver, and nothing is lost when the window closes.
- **The full picture goes over once.** `getState()` holds the big map picture, so `link.sync()` is used only when the window connects (the link does that itself). After that, the tool sends small messages with `link.send(type, payload)`.
- **A window name and size.** `ctx.playerLink({ view, name, features })` keeps the old tool's window name and size.
- **Views can load shared files.** A view can list `shared/js/modal.js` in its `js` to use pop-ups.
- **Tie positions to the map picture, not the window.** Use "board units" (`tools/encounter/rules.js`: `board`, `view`, `toScreen`, `toWorld`), so tokens, pins, the grid and fog stay put when the window is resized, zoomed, made fullscreen or moved between the laptop and the TV. Draw canvases in screen space and redraw them on resize and when the screen's sharpness changes (a `matchMedia('(resolution: …dppx)')` listener). The Explorer needs the same.

## 6. Styles

- Prefix every class with `tsi-<tool>-` (e.g. `tsi-crest-preview`) and scope rules under `.tsi-tool--<tool>`. Never restyle the shared `tsi-` components, `body` or bare elements.
- Use the tokens in `shared/tokens.css` (colours, fonts, sizes, spacing, radii, motion). Put anything a tool needs that isn't there in the tool's own CSS, named `--tsi-<tool>-…`.
- Use one crimson main button (`tsi-btn tsi-btn--primary`) per panel. All other buttons are outlined gold (`tsi-btn`).
- Body text is Cormorant Garamond in sentence case. Capitals only for headings, labels and buttons. Crimson is never used for text.
- Signature animations: multiply their length by `var(--tsi-signature-slowdown)`. It's 2.5 when "reduce motion" is on.
- Give ids two different prefixes: one for controls (e.g. `tsi-crest-field-…`) and one for parts of a drawing (e.g. `tsi-crest-svg-…`). In phase 2 a drop-down and an SVG filter shared an id, and every crest drew darker. `tests/e2e/phase2.test.js` checks every id on the page is unique; copy that check.
- Don't put a URL inside a CSS custom property: Chromium resolves it against the stylesheet that uses the property, not the one that sets it. Set background pictures directly on the element or in the tool's own CSS. For painted art behind a screen, see `.tsi-art` in `components.css`.
- It must fit 1707 × 930 (pixel ratio 1.5) with no sideways scroll and its main controls in view. Explorer, Combat Tracker and Bastion must also fit 1920 × 1080.

## 7. Tests

- Keep game rules in plain functions (`rules.js`) and add `tests/rules/<tool>.test.js`. Add it, and the files it tests, to `tests/rules.html`.
- Add `tests/e2e/phaseN.test.js` using `tests/e2e/helpers.js`. Open `index.html?tool=<id>` as `file://` at both sizes with the internet off, and click through the main flows.
- Check no internet requests are made (`context.log.net`) and no files are missing (`context.log.failed`).
- Buttons ignore a second click within 350 ms, so pause between repeated clicks in tests (the helpers do).
