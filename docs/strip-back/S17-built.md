# S17 built: linking a phone by QR code, and the optional online link (built, switched off)

Step S17 of the Strip Back Overhaul (design: `docs/strip-back/I-link-research.md`, with `H-handler-app.md` sections 6 and 7; Harry's decision: `docs/STRIP-BACK-PLAN.md` decision 5). Branch `link`, worktree `wt-link`, made from `main`. Nothing was pushed.

**Harry's decision (22 October 2026):** QR pairing now, no account. The online link is **built but off**. Harry will make a free account and approve the change to CLAUDE.md ground rule 2 himself before it is switched on. So CLAUDE.md is **unchanged**, nothing goes online in any default state or any test, the settings file ships empty, and no key is committed.

## What was built

### 1. QR pairing

- **`tools/beasthandler/lib/qrcode.js`**: `qrcode-generator` 2.0.4 (MIT), unchanged, from the npm registry (tarball sha1 `e8b3f309…` matches the research; file SHA-256 `79ec86f8…`). Licence text in `licences/qrcode-generator-MIT.txt`, a row and a paragraph in `licences/README.md`. Only the Bastion page loads it.
- **`tools/beasthandler/qr.js`**: `BH.qr.matrix(text)` and `BH.qr.svg(text)`. Medium error correction, four squares of white margin, drawn as one SVG path (never a canvas, built with DOM calls, not `innerHTML`).
- **The link**: `<phone page address>#L1.<campaign>.<secret>.<name>`, 100 to 130 letters, a 45 to 49 square code. Built and read by `C.encodeLink` / `C.decodeLink` in `codes.js` (the reader also accepts a pasted BHP1 code, `pair=BHP1…`, a whole address, and chat-app junk), validated strictly (secret and campaign letters, name as URL-safe UTF-8 letters, at most 1000 letters, anything else is "damaged"). The pairing it gives is exactly the one `C.decodePairing` gives. The error messages never repeat what they were given.
- **The DM's box** (`dm-panel.js`, in the Beast Pen's panel): per handler **Show QR to (name)** (makes the pairing the first time, shows the same one every time after, never rotates) opening a window with the QR code, **Show this only to (name).**, the plain link as selectable text with **Copy link**, the iPhone Home Screen tip and a line about **Take back code**. **Phone page address** setting (shown as text, changed with **Change address…** in a small window, because a text box in the panel itself would take the keyboard focus and scroll the Beast Pen's panel to the bottom every time it opened; `s.beast.phoneUrl`, default `https://hjhudsonwriter.github.io/TSI_MasterSuite/beasthandler.html`, https only, a ? or # part is taken off, the standard address is stored as nothing). **Take back code** and **Add a handler…** are in the main list. The old Pairing code / New pairing code / Snapshot code buttons moved into **Offline backup** (a `<details>` that is shut by default and stays open or shut across redraws).
- **The phone page** (`beasthandler.html` + `phone.js`): reads `location.hash` when it opens and on `hashchange` (a link that arrives while the page is already showing), stores the pairing exactly as a pasted code is stored, then removes the fragment with `history.replaceState` straight away (also for a damaged one). A confirmation ("Linked. This phone now shows Mira's beasts.") or a plain-English error is shown on the first-run screen, or in a pop-up if the beasts are already showing. A phone linked to someone else asks **Replace the link?** (Keep what I have / Replace the link; replacing a different handler or Bastion clears the old snapshot); the same link again says it is already linked. **Copy my link** (home screen) copies this page's address plus the link. The link screen puts the QR way first, has a shut **Using an iPhone Home Screen icon?** help and a shut **Offline backup** (paste a pairing code, a pairing code in a link, or a whole link; update from a snapshot code). The Home Screen storage limit is said on the link screen and in the DM's QR window.

### 2. The optional online link (OFF by default)

- **`relay-config.js`**: ships `window.TSI_DATA.beastRelay = { databaseURL: '' }` with a long header saying it is Harry's own Firebase project's public address (not a password), that nothing may look like a key, and what the on-switch is. The only place the address lives.
- **`link-rules.js`** (`BH.link`): the pure rules: phone-address and database-address validators, `buildLink`, `contentKey` (SHA-256 of the snapshot with `madeAt` left out), `shouldPublish` (once at the start, then on a change, never twice in 10 s, not before a failure's wait is over), `backoffMs` (5 s, 15 s, 60 s, then 5 min), `accept` (one decision for every way a snapshot arrives: signature, version, same Bastion save, same handler, never older; equal is "same") and the words.
- **`seal.js`** (`BH.seal`): channel = base64url(SHA-256("tsi-link-v1/chan/" + secret)), key = SHA-256("tsi-link-v1/key/" + secret); `seal` / `open` with WebCrypto AES-256-GCM, a fresh random 12-byte iv, the place as additional authenticated data (a copy moved to another place won't open). If `crypto.subtle` is missing it is unavailable and the link stays off: it never sends anything unscrambled. The plaintext is the existing signed `BHS1.` snapshot code, so the phone applies the very same checks as for a pasted snapshot. **Checked: `crypto.subtle` and AES-GCM work from `file://` in Chromium** (the rules page and the Bastion and phone pages in the click-through tests are all double-clickable files); Edge is Chromium. `shared/js/hmac.js` is still what the suite signs with.
- **`relay.js`** (`BH.relay`): the one place with `fetch()` (remote https only, never a local file; commented so nobody "fixes" it), plain REST (no Google library, so the existing "no Firebase library outside the Notice Board" tests are untouched): `PUT …/tsi/state/<chan>.json?print=silent`, `GET …/t.json` (a few letters), `GET …/<chan>.json`, `DELETE`, each with `credentials: 'omit'`, no referrer, no caching and an 8 s timeout, every failure turned into a quiet answer. `R.create(life)` returns `null` unless the settings hold a valid Firebase Realtime Database address (or the made-up test one) and the browser is not automated, so **asking for a post box makes no request**. The test page (`TSI.space === 'test'`) always gets `R.memory(R.standIn)`, an in-memory stand-in that applies the real database's shape rules (the shop link's pattern). An automated browser (`navigator.webdriver`) may only use `tsi-test-relay.invalid`. `R.selfTest` runs the four "Test the link" checks (send, read back and unscramble, a stranger can't list, a stranger can't write the wrong shape) and leaves nothing behind.
- **`publisher.js`** (Bastion side; created by the DM box at Bastion start with a 3 s timer in the Bastion's life): dormant unless `s.beast.onlineLink === true` **and** the settings hold an address; then one handler's snapshot per look (once at open or on a new pairing, then only on a change, throttled, backing off quietly, skipping while the browser says it is offline, stopping on close); a taken-back or replaced code deletes that handler's old copy; **Send to phones now** forces a send; the status line is `L.statusLine`. A switch that is on with no address does nothing.
- **`puller.js`** (phone side): dormant unless the settings hold an address and the phone is linked; then every 20 s while the page is showing (plus on return to the page, on `online`, on **Check now**) it asks for the copy's time and fetches the whole copy only if that moved, unscrambles it, runs `L.accept`, and gives a newer valid snapshot to the page. Older copies are ignored; unreadable ones say so quietly; offline keeps what is held. The line reads **As of Day N, updated 3 minutes ago**.
- **The switch and its words** (`s.beast.onlineLink`, kept only when true so a Bastion that never used it saves exactly what it did): in the DM's box **Online link: off (not set up).** with **How to set it up** (`guide.html#beasthandler-online`); once the address is set, **Switch on** (asks first), then **Test the link**, **Send to phones now** and **Switch off**.

### 3. Docs

`docs/ONLINE-LINK-SETUP.md` (new): Harry's plain-English, step-by-step guide (free Firebase project, locked-mode Realtime Database, the tested rules from the research's Appendix A word for word, the address into `relay-config.js`, the exact wording of the CLAUDE.md ground rule 2 change for him to approve (**not applied**), switching on, **Test the link**, linking a player, turning it off, deleting the project, troubleshooting), with every step that could not be verified here marked **Not yet tested against the real Google console** and what he should see. `docs/PHONE-PAGE.md` (QR steps, the iPhone Home Screen route, the file list for the phone, an online link section), the Beast Handler section of `guide.html` (bold labels match the code, `guide.test.js` green), `tests/e2e/README.md`, `licences/README.md`. Not edited, as instructed: `CLAUDE.md`, `docs/KNOWN_ISSUES.md`, `docs/PROGRESS.md`; the drafts are in `S17-known-issues-draft.md`.

## Tests

- Rules (`node tests/run-rules.js`): **1442 passing** (was 1408). New `beasthandler-linking.test.js` (address building and parsing, malformed and oversized fragments, the secret never in the Day Log, the snapshot or an error message, the settings ship empty, the QR matrix, `L.accept` with rollback refused, the publish and back-off rules) and `beasthandler-relay.test.js` (the place and key checked against the browser's own SHA-256, AES-GCM round trip from a file and every kind of tamper refused, the stand-in's rules, the real transport against a fake `fetch` (exact requests, no cookies, timeout, refusals), the sender dormant with a request spy, sends once then only on change, never twice in 10 s, back-off, offline, taking a code back, too-big, Test the link, the phone receiver (older refused, other key refused, other handler refused), the phone side dormant, closing stops everything).
- E2E, one at a time, from double-clicked files: **`beasthandler-link.test.js` (new, 35 checks)**: the QR picture read back by jsQR (`tests/vendor/jsQR.js`, Apache 2.0, tests only, licence in `licences/`) holds exactly the link, at 390 px, 1707 x 930 (ratio 1.5) and 1920 x 1080 (ratio 1); the phone page linking from a link, keeping it, a damaged one, a different one asking first, pasted links, Copy my link, the phone page at 390, 360 and 320 px, and opened on the laptop and TV windows, with 44 px targets; **a request spy** (fetch, XMLHttpRequest, EventSource, WebSocket, beacon) and the browser's own request log are empty on every page while the switch is off or no address is set, and the test page uses the stand-in even when set up and on; and the whole online link in two separate browsers sharing only a made-up database answered by the test with the real rules (everything else stopped and counted): Switch on, Test the link, the phone showing the beasts by itself, a change arriving, offline and back, an older copy refused, Switch off, Take back code removing the copy.
- Changed on purpose: `beasthandler-phone.test.js` and `beasthandler-meet.test.js` open the Offline backup before using codes, and the "Add a handler with a name that is already paired" check now expects the existing QR to be shown and nothing swapped.
- The results of every gate are in the final report at the bottom of this file.

## Decisions I made myself

1. **The link carries the Bastion's save id** (`L1.<campaign>.<secret>.<name>`, not the research's `L1.<secret>.<name>`), so the phone keeps its strict "this snapshot is for this Bastion save" check and `takeSnapshot` did not have to adopt an id from the first snapshot. The code is still 45 to 49 squares.
2. **The name in the link is the handler's name as UTF-8 URL-safe letters** (accents and spaces survive); if the handler's id is not simply the lower-cased name the id is carried, so the phone always matches the right handler.
3. **Polling, not streaming.** A 13-byte time request every 20 s plus a whole fetch only when it moves. A live stream could not be tested against the real service; polling is easy to test and cheap.
4. **No `Show QR` rotation.** Showing the QR again never changes the secret (a new secret is **Take back code** then **Show QR to…**, or **New pairing code…** in Offline backup). **Add a handler…** therefore no longer asks before swapping.
5. **The test page always uses a stand-in, and an automated browser can only reach `tsi-test-relay.invalid`**, so a test run cannot reach a real database even after Harry fills in his address.
6. **The switch is required for "Test the link"**: nothing at all is sent before Harry has pressed Switch on.
7. **The phone's only on-switch is the address in `relay-config.js`** (plus being linked); the Bastion's is the address plus `s.beast.onlineLink`. The phone page can't see the Bastion's switch.
8. **The standard phone page address is stored as nothing**, so it follows the standard if that is ever changed.
9. **A phone that is linked and has the same link opened again says so; "Keep what I have" is silent.**
10. **The QR window's link is selectable text**, not a text box (the shared pop-up focuses the first text box, which scrolled the picture away on a phone-sized screen), and the window is `min(560px, 100%)` wide so it fits a 390 px screen (the shared pop-up is 2 px wider than its margins there).
11. **Publisher and receiver live in their own files** (`publisher.js`, `puller.js`) rather than in `dm-panel.js` / `phone.js`; `tools/bastion/tool.js` was not touched (the DM box's `create(host)` starts the sender).
12. **The research's Appendix A rules are given to Harry word for word**, including the unused `inbox` half, because 23 of 23 checks passed on exactly that text.
13. **The self-test needs the real database's answers only as `refused` or not**: a 401 or 403 counts as refused.

## Merge notes for the lead

- `shared/data/tools.js`: the Bastion entry gets one block between `codes.js` and `bastion-link.js` (seven files) and the Beast Handler entry gets `link-rules.js`; both sit away from the war-file lines.
- `tests/rules.html`: seven script lines after `codes.js` and two test lines after `beasthandler-initiation.test.js`.
- `licences/README.md`: one table row for `qrcode.js`, one for `jsQR.js`, one paragraph.
- The phone page now needs `beasthandler.html`'s new scripts (`link-rules.js`, `seal.js`, `relay-config.js`, `relay.js`, `puller.js`); the list for publishing only the phone page is in `docs/PHONE-PAGE.md`.
- CLAUDE.md still says nothing about the online link on purpose.
- **The QR code points at the GitHub Pages address, which only holds this phone page once this is merged to `main` and Pages publishes it.**

## Where I stopped

Nothing is left over: the QR link, the Offline backup, the dormant online link, its tests and its docs are finished, committed and tested. Not started (other steps): the DM doc, Day Log state removal, art and map, the guide and docs sweep. Not done and not allowed yet: amending CLAUDE.md, creating the real Firebase project, filling in the address, switching it on.

## Not verified here

The real Google Firebase console and each step marked so in the guide; a real database accepting requests from a double-clicked file and from the GitHub Pages address (the research's local emulator allowed both); a real phone camera and iPhone Safari's Home Screen behaviour; GitHub Pages serving the new phone page; Firefox; Edge itself (Chromium was run).

## Gate results (all on the finished code, one at a time, from double-clicked files, Chromium)

| Gate | Result |
|---|---|
| Rules page (`node tests/run-rules.js`) | 1442 tests passed (1408 before this step) |
| `beasthandler.test.js` | 15 of 15 |
| `beasthandler-meet.test.js` | 34 of 34 |
| `beasthandler-phone.test.js` | 15 of 15 |
| `beasthandler-bond.test.js` | 12 of 12 |
| `beasthandler-sweep.test.js` | 17 of 17 |
| `beast-pen.test.js` | 24 of 24 |
| `beasthandler-link.test.js` (new) | 35 of 35 |
| `guide.test.js` | 21 of 21 |
| `creatures.test.js` (the Beast Pen's panel fits the laptop; it caught a text box in the panel taking the focus and scrolling it to the bottom, since fixed) | 23 of 23 |
| `bastion-screen.test.js` | 55 of 55 |
| `phase1.test.js` | 129 of 129 |
| `phase4.test.js` (the Knightly Treasures link is unaffected; its "no Firebase outside the Notice Board" checks hold because the online link uses plain web requests, not Google's library) | 57 of 57 (the old-tool comparison is skipped: `_legacy/` is missing in a worktree) |
