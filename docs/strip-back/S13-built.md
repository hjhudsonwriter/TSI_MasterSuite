# S13 built: the Beast Handler app, part 1 (read-only, three tabs, the Bastion rolls the first meeting)

Step S13 of the Strip Back Overhaul (design: `docs/strip-back/H-handler-app.md`; decisions: `docs/STRIP-BACK-PLAN.md`; cross-cutting: `J-cross-cutting.md` row S13). Branch `lane-b`. It works against the **old three beast buildings** (Wyvern Roost, Griffin Tower, Dire Wolf Den); the Beast Pen, bonding days and the Bond-page counter are S14 and S15, QR and the online link are S17.

## What was built

### The Bastion rolls the first meeting once (decision O1)

- **`development.initiation { regional, rolls: { dominant, attachment, trigger }, day }`**, kept by `R.cleanDevelopment` (`tools/bastion/rules.js`; header comment updated). `regional` is the variety's id (`bloodcrest`), `rolls` are the die numbers (0 where the DM had already written that line and it matches no table row).
- **`R.rollInitiation(s, data, creatureId, rand)`** in `tools/beasthandler/bastion-link.js` (beside `R.setProfile`, which it uses). The variety comes from `TSI_DATA.beastInitiation` (`data/initiation-data.js`, already in the Bastion manifest): mode `fixed` names one per kind; mode `random` is an even pick; a fixed id that is not one of the kind's real varieties falls back to an even pick. The three personality lines are genuinely random (`Pf.rollTable`: d12, d8, d8); the order of the dice is variety (random mode only), dominant, attachment, trigger. It is **set once**, **fills blanks only**, never touches bond, stats, harness or the Chronicle, writes through `R.setProfile` (change note + Day Log line) and adds one Day Log line ending "(staged: fixed until further notice)" for the variety. A beast with an `initiation`, or with a Regional Variety already, is **treated as introduced** and left completely alone.
- **`R.sweepInitiation(s, data, rand)`**: rolls for every beast at Bond 1 or more with no `initiation` and no `regional`, once. The Bastion runs it **when it opens** (not while a conversion report is waiting to be read: then right after "I've read this") and **after each `R.startDay`**. `P.build` never rolls (tested). S14 will call `R.rollInitiation` directly in the same step that sets Bond 1 on acclimatisation.
- Elara's wyvern (Bond 1, no variety) is therefore introduced as a Bloodcrest the first time the Bastion opens.

### Snapshot version 2 (read-only)

`P.VERSION = 2`. Removed: `orders`, `training`, `rev`, `receipts`, the per-building order work, `P.pendingAt`, `P.isPlayerOrder`, `P.busyLabel`. New: `creatures[id].available` (true from Bond 1), `initiation` (own beast only, `{ regional, rolls }`, null until the Bastion has rolled it), and `available` on every directory line. A Bond 0 beast of the viewer's own is `{ id, name, species, facility, handler, available:false, bond }` and nothing else. Every field is listed with the reason a player may see it in `tests/rules/beasthandler-projection.test.js` ("every field of the snapshot, and the reason…"); a field with no reason fails. One directory entry per existing building is kept. Old v1 snapshots on phones are discarded by `P.check` (phone.js `usable()`).

### The request protocol, deleted

- `bastion-link.js`: `R.beastProcess`, `beastProcessQueue`, `beastProcessCode`, `beastReceiptsFor`, `beastRecent`, `BEAST_TYPES`, receipts, floor and the `accept` switch are gone. `R.cleanBeast` now keeps only `{ campaignId, handlers }` and **loads an old save quietly** (tested, including the heavy fixture).
- `codes.js`: the BHC1 half and `MAX_AGE_MS` are gone (pairing BHP1 and snapshot BHS1 kept).
- `dm-panel.js`: "Take requests from handlers", the paste-a-request box and "Latest requests" are gone; add handler, pairing code, snapshot code and take back stay.
- `tools/bastion/tool.js` (small, local edits): `checkBeast`, `trimBeastQueue`, `beastBusy`, its interval call, `debug.beast` and the "From the Beast Handler:" notice are gone; added `checkInitiation()` (sweep after the report is read), the open-time sweep (one line) and the sweep after `R.startDay` (one line), and one line that deletes the old `tsi.beasthandler.queue` key.
- `tools/beasthandler/tool.js` (laptop copy): the queue, drafts, `canSubmit/outbox/submit` and `validateImport` are gone; it saves nothing (`saves: false` in `shared/data/tools.js`, so no Export/Import buttons). "Seen" is kept in `sessionStorage` (`tsi.beasthandler.seen`), like "Viewing as". It clears the old queue key and old draft note when it opens. `TSI.beasthandler.debug` (refresh, view) is for the tests.
- `phone.js`: the outbox, request codes, copy/show-code pop-ups and Forget are gone; the old `.outbox` and `.draft` keys are cleared when the page loads. New `tsi.beasthandler.phone.seen`, cleared on Unlink.
- `beastPlayerOrders` data deleted.

### The conversion step

`tools/bastion/strip-back-rules.js`: one new step `dropBeastRequests`, **above** `sweepFacilities`: it drops `s.beast.done`, `.accept`, `.floor` and says nothing in the report. Its `detect` is deliberately conservative (receipts present, a limit above 0, or the switch off) so the empty shape older builds wrote does not make a version 4 save "convert again" with a notice; `R.cleanBeast` drops that quietly on load. Tests: the registry, the fixtures (the "S01 changes nothing" test now allows exactly this removal), the heavy fixture, a damaged `beast` value, idempotence, the audit.

### Screens

- **Three tabs** along the bottom, in the order **Profile, Bond, Chronicle**; Bond is the landing tab (`ui.tab = 'bond'`, `data-screen="creature-bond"`); test ids `bh-tab-profile`, `bh-tab-bond`, `bh-tab-chronicle` (`bh-tab-orders` deleted). The back button is always "All beasts".
- **Bond**: name, handler line, hero picture, subspecies chip, "Current rapport" card with the five pills, kind line. No training line, no requests line, no waiting or "no picture for…" notices.
- **Profile**: read-only (no "Edit or roll this profile", no inputs, no waiting marks).
- **Chronicle**: unchanged.
- **Home**: a beast that is not acclimatised is a plain line with a "Not acclimatised yet" chip (mine or not); only an acclimatised beast of the viewer's own is a button.
- **The reveal** (`intro.js`, rewritten; the curtain, `TSI_BH_SPEED` and reduced-motion handling are as before). Panel 1 "It's time to meet <Name>…" (lead line now "Two quick rolls, then you will see <Name> for the first time."). Panel 2: the kind's subspecies as medallions (number badge and name only) in a **freshly shuffled order each visit**, one primary button "Roll for subspecies", a die chip (d5 or d6) that tumbles and settles on the landing medallion's **place in this run's shuffle**, a gold marker (the lit medallion) that hops with decelerating gaps, then the name, home and look fade in, then Continue. Panel 3: three cards (Dominant Temperament d12, Attachment Cue d8, Instinctive Trigger d8), each Roll and "Roll all three"; each die settles on the **Bastion's real stored number** (about 1.2 s), then the line and note appear; locked once rolled; then "Continue" starts the curtain "Welcome to the Ironbow, <Name>!". The path maths is plain functions in `model.js` (`M.revealPlan`, `M.shuffle`, `M.personalityCards`, `M.needsMeeting`) with rules tests.
- **Redraws never cut a roll**: `meet.busy()` makes the view hold a redraw while anything is playing, and `meet.onIdle` redraws once it has finished (tested at real speed with a snapshot change in the middle, for the subspecies roll and for the personality dice). A redraw after the roll rebuilds the same panel from the reveal's own state.
- **Once per device per beast**: marked seen when the final Continue is pressed (start of the curtain). Phone: `tsi.beasthandler.phone.seen` (localStorage). Laptop: `sessionStorage`, plus **Skip for now** (laptop only; a phone has none). Closing the page part-way sends nothing and replays from the start.
- Reduced motion: no hopping and no tumbling (a 150 ms pause, then the answer with a short fade).
- CSS: the order, pending, confirm, edit, request, chip and refusal rules are gone; reveal rules added (medallions, die, personality cards). Fits the phone (390), laptop (1707×930, ratio 1.5) and TV (1920×1080) with no sideways scroll and 44 px targets (tested).

### Docs

`docs/PHONE-PAGE.md` rewritten for the read-only app (QR and the live link say "to come"), `guide.html` (Beast Handler section and the Wyvern Roost paragraph; bold labels match the code), header comments in every file touched, `tests/e2e/README.md`, a "superseded in part" note at the top of `docs/specs/beast-handler-proposal.md`. Not edited (as instructed): `docs/KNOWN_ISSUES.md`, `docs/PROGRESS.md`; the drafts are in `docs/strip-back/S13-known-issues-draft.md`.

## Tests

- Rules: `beasthandler-initiation.test.js` (new, 18 tests), `beasthandler-projection.test.js` (orders and building-lock tests deleted, v2 and leak tests added), `beasthandler-link.test.js` (the ~27 request/receipt tests deleted, the keep-list adapted, old-record loading added), `beasthandler-codes.test.js` (BHC1 tests deleted), `beasthandler-model.test.js` (request/queue/draft tests deleted; reveal plan, shuffle, cards and `needsMeeting` added), `beasthandler-tables.test.js`, `strip-back.test.js`.
- E2E: `beasthandler-write.test.js` deleted; `beasthandler-meet.test.js` rewritten as the reveal; `beasthandler.test.js`, `beasthandler-phone.test.js` adapted; `beasthandler-bond.test.js` new; `creatures.test.js` changed on purpose (reopening the Bastion now introduces Elara's wyvern once; the check allows exactly that and checks a second reload changes nothing).
- `tests/fixtures/make-heavy.js` now writes the Beast Handler record in its **old** shape on purpose (so the heavy fixture is still "a Bastion from before the app became read-only"). The generated `bastion-v3-heavy.json` / `bastion-fixtures.js` were **not** regenerated (regenerating also picks up unrelated S04 facility-data changes), so they still hold `beast.done`, `accept`, `floor`.

## Decisions I made without asking

1. **Home of the roll**: `bastion-link.js` (needs the profile tables and `R.setProfile`); only the `initiation` field is in `rules.js`.
2. **A beast that already has a variety gets no `initiation`** (treated as introduced); a DM-written personality line keeps its text and its die number is the matching row or 0 (the card then shows "✦" instead of a number). A kind with no varieties is left alone (`ok: false`).
3. **Laps**: the brief's "one to two laps" cannot hold together with 3.5 to 4.5 seconds and gaps of about 90 to 420 ms on five or six medallions. I kept the times and the gaps (they are the visible part) and let the lap count follow: about **2.5 to 4 circuits**. The start is random, there is always one near miss (either runs past and steps back, or stops short and steps on), and the last rest is 480 to 760 ms.
4. **The "marker"** is the lit medallion (a class moved from medallion to medallion), not a separate moving element; each medallion shows a number badge so the die's number means something.
5. **Panel 2 has Back before the roll only**; panel 3 has no Back (nothing can be rolled twice).
6. **Skip for now on the laptop goes straight to the beast's real page** with its picture (the Bastion already holds the variety), so "Subspecies not chosen yet" no longer appears after a skip. A beast with no variety at all shows the chip "Subspecies not known yet" (was "not chosen yet", which a player can no longer do).
7. **Seen is marked when the last Continue is pressed**, not at the end of the curtain, so a page closed during the curtain does not replay it.
8. **Laptop "seen" is in sessionStorage**, so the laptop copy saves nothing (`saves: false`, no Export/Import buttons for this tool) and a reload in the same tab stays seen.
9. **The sweep waits** while the version 4 report is unread (the Bastion otherwise changes beasts under a report that describes it as converted); it runs straight after "I've read this".
10. **`dropBeastRequests` is quiet** (no report line) and conservative in `detect`.
11. **`P.build` keeps `facility { id, name, level }`** in the detail and per-building directory entries (they carry the Home cards and the kind line) until the Beast Pen replaces the three buildings.
12. The DM box now says in one sentence what the app does and that a beast shows from Bond 1.
13. The old `tsi.beasthandler.queue` key is removed by both the Bastion (on open) and the laptop copy.

## Left for later steps

- **S14 (Beast Pen and bonding)**: re-point `P.homes` and the directory at the Pit (one `beast_pen` entry, `place`, five kinds including Buckbear and Fellcat, which cannot be housed yet: the reveal test patches the kinds in for the page), call `R.rollInitiation` in the same step as Bond 1 on acclimatisation, then `development.bonding`.
- **S15 (Bond page)**: the Bonding Days counter, filling pills with `role="progressbar"`, the "ready" state, "Wyvern · Beast Pit" line.
- **S17**: QR pairing, phone URL, relay; the phone-page copy and `docs/PHONE-PAGE.md` already say "to come".
- The S03 draft d8 tables (Buckbear, Fellcat) are still DRAFT; the reveal shows whatever the Bastion rolled from them.
- `docs/KNOWN_ISSUES.md` and `docs/PROGRESS.md` entries (drafted separately), `docs/ASSETS.md` unchanged (no new pictures).

## Not tested

Firefox; Edge itself (Chromium only); a real phone or iPhone (the phone page was tested in a 390 px emulated window, offline, from a file); the real-speed reveal on a slow machine (it was timed on a busy 4-CPU machine and passed).
