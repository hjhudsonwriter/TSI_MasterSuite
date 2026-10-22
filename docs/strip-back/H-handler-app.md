# AREA H: the Beast Handler app (phone page, laptop copy, DM's box)

Analysis only. Repo `/home/user/TSI_MasterSuite`, branch `claude/gallant-ramanujan-klwz70` at `76c1276` (main `4f1db26` plus Harry's three new pictures, already filed but not wired in). Read on 22 October 2026. Nothing in the repo was changed.

Reading guide: sections 1 to 2 say what exists and what the handover asks; 3 lists what is deleted; 4 is the protocol and the roll decision (the heart of this area); 5 is "exactly once"; 6 is the phone link (QR / relay); 7 is the contract with the Bastion side (areas A, F, G); 8 to 10 are files, tests, docs; 11 is contradictions and assumptions; 12 is the questions for Harry.

---

## 0. Short version (plain English)

* The app today is a player's companion with **four things it can do**: show a beast (picture, bond, profile, Chronicle), let the player **type or roll** profile lines, let the player **ask for a free training order**, and walk a new beast through a first-meeting sequence in which the player **types, taps or rolls** a subspecies and a personality. Everything the player asks for is a signed "request" that the DM's Bastion checks and applies once. All of that machinery exists because players could *change* things.
* Harry's handover turns it into a **visual aid and bonding tracker**. If the player can no longer type a variety or a personality, and there are no orders, the app has **nothing left to ask the Bastion for**. My recommendation: **the Bastion does the roll** (once per beast, stored, never repeated) and **the phone only plays the reveal**. The phone then sends **nothing at all**: the protocol becomes read-only (Bastion to phone). That deletes the request code (BHC1), receipts, the outbox, the confirm screen, the queue, the waiting/refused overlays and about two thirds of the code in `bastion-link.js`, `view.js`, `intro.js`, `phone.js`, `tool.js` and `dm-panel.js`.
* A read-only app has **no cheating surface**: a player who edits their phone can only change what their own screen shows. Letting the phone roll instead would bring back every integrity problem in section 4.4 (forged results, re-rolls, "roll-shopping").
* The "illusion of chance" is a **staged reveal**: a numbered die (d5, or d6 if Dire Wolf gets a sixth variety) and a row of variety medallions in a freshly shuffled order, a marker that hops with a different path every time and lands on the variety the Bastion decided (Bloodcrest, Dawnmantle, Blacktide, Broadcrown, Lichenback). The personality dice (d12, d8, d8) are **really random** and rolled by the Bastion; the phone animates to the numbers it was given.
* New screen shape: a bottom bar of **Profile / Bond / Chronicle**. "Bond" is the old main hero page plus a **Bonding Days** counter, and pills 2 to 5 fill in proportion to days out. Pill 1 (Acclimatised) is already full, because Bond 1 comes from the Pit's DC roll, not from days. When a pill is full the Bastion sets the existing `bond.ready` flag (the DM-confirm machinery already exists: `R.confirmBond`), tells the DM, and after the DM confirms the next pill starts.
* **Automatic updating is impossible without something on the internet in the middle.** The proposal doc (`docs/specs/beast-handler-proposal.md` section 3) already said so. Options and a recommendation are in section 6. This needs Harry's explicit decision because it conflicts with `CLAUDE.md` ground rule 2.
* Five questions genuinely need Harry (section 12): how many days per pill, whether Blacktide is a sixth Dire Wolf variety (and its text), the missing Buckbear/Fellcat tables, whether to build the online link, and the carry-over rule while a full pill waits for the DM.

---

## 1. The app today (verified in code)

### 1.1 Files (all under `tools/beasthandler/` unless stated)

| File | Lines | Role | Survives? |
|---|---|---|---|
| `view.js` | 629 | All screens, shared by phone and laptop through a "host" object | Rewritten in large part |
| `intro.js` | 324 | The first-meeting sequence (3 panels, then the curtain "Welcome to the Ironbow, Name!") | Panels rewritten; the curtain (`close`, 252-311) kept |
| `model.js` | 216 | Words and shapes for the screens (bond pills, requests, queue, regional matching) | About half deleted |
| `profile-rules.js` | 121 | `TSI.beasthandler.profile` (Pf): rolling tables, cleaning, checking text | Kept and extended (the Bastion rolls with it) |
| `projection.js` | 294 | `TSI.beasthandler.projection` (P): Bastion save to a read-only snapshot for one handler | Kept, orders removed, version 2 |
| `codes.js` | 118 | Pairing (BHP1), snapshot (BHS1) and request (BHC1) codes, signed with `shared/js/hmac.js` | BHC1 half deleted |
| `bastion-link.js` | 363 | Adds `R.beast*` to `TSI.bastion.rules`: handler registry, pairing, receipts, `R.beastProcess` | About 60% deleted |
| `dm-panel.js` | 174 | The DM's "Beast Handler (players)" box in the Bastion's Management panel | Request half deleted; QR / link added |
| `tool.js` | 180 | The laptop host: reads `tsi.bastion.state` every 3 s, keeps the request queue | Queue deleted |
| `phone.js` | 316 | The phone host: link, snapshot, outbox, codes | Outbox/request half deleted |
| `beasthandler.html` (repo root) | 56 | The phone page; loads only companion files plus `shared/js/{core,lifecycle,modal,hmac}.js` | Script list changes |
| `beasthandler.css` (537), `phone.css` (39), `dm-panel.css` (16) | | Look | Orders/requests/edit/meeting CSS deleted; pill fill, Bonding Days, roll reveal added |
| `data/profile-tables.js` | 237 | Harry's d12, d8, d8 tables and 15 varieties; also `beastPlayerOrders` | Two kinds and Blacktide added; orders block deleted |
| `data/art-map.js` | 53 | Variety id to picture file | Three new species/variants |
| `assets/` | | 15 portraits + extras; the three new pictures are already in `buckbear/`, `dire-wolf/`, `fellcat/` (commit `76c1276`) | Wire in |

Also touching the app: `shared/data/tools.js` (Beast Handler entry lines 182-228: `saves: true`, desc line 188, file list 194-227; the Bastion entry lists the Beast files at lines 106-115 and `dm-panel.css` at 82), `tests/rules.html` (lines 103-110, 141-148), `guide.html` (lines 238, 293-305), `docs/PHONE-PAGE.md`.

### 1.2 Screens and flow today (`view.js`)

* Host contract (header, 16-25): `snapshot, problem, syncLine, syncOk, handlerChoices/viewing/setViewing (laptop), canSubmit, outbox(all?), drafts, submit, afterSubmit, extraHome, extraFoot`. After the overhaul `canSubmit, outbox, drafts, submit, afterSubmit` all go.
* `ui = { screen: 'home'|'creature', creatureId, tab: 'main'|'profile'|'orders'|'chronicle', orderFn, edit, said, fadeNext, skipMeet }` (line 43).
* Home (`renderHome` 251-264): title, "Viewing as" picker (laptop only, 205-219), one card per building with its level pill and a row per beast (`facilityCard` 239-249, `creatureRow` 221-237). Another handler's beast is a plain line (`data-mine="no"`).
* Beast "main" page (`renderMain` 287-300): name, "Handler: X", hero picture (`hero` 90-124, 4:5 frame, `object-fit: cover`, `object-position: 50% 28%`, tap = harmless glow), subspecies chip, "Current rapport" card with heart, bond line, "Stage n of 5" and **five pills** (`bondBar` 135-153, pill states `done`/`current`/`todo`), training line, "n requests are waiting" line, kind line, and the bottom nav `nav(d)` (267-276) with **Profile / Orders / Chronicle**. There is **no Bond tab today**: the main page is reached by "Back".
* Profile (`renderProfile` 442): read-only lines (`renderProfileRead` 323-355) with "waiting" marks from pending requests, an "About <variety>" box, and a panel "Edit or roll this profile" opening `renderProfileEdit` (357-440: typed fields with datalists, a Roll button per line, "Roll all three", Save sends `profile.set`).
* Orders (`renderOrders` 447-491, `renderConfirm` 494-507): free training only, a "check before you send" screen, the building lock and pending-order display.
* Chronicle (`renderChronicle` 510-527): read-only, DM-only notes already removed by `projection.js chronicleOf` (185-193).
* First meeting (`intro.js`, wired at `view.js` 544-575): triggers when `M.needsMeeting` (no subspecies saved or asked for) on the main tab. Panel 1 "It's time to meet <Name>…"; Panel 2 "which subspecies" (typed, five tap chips, or Roll = an even pick of the species' varieties, `Pf.suggestOne` 65-80); Panel 3 personality (three typed/rolled lines, "Roll all three"); Save sends **one** `profile.set` request, then the curtain (`close` 252-311): fade to black, "Welcome to the Ironbow, <Name>!", black, fade in on the hero page. Waiting/refused handling is large (draft kept across reloads, refusal brings the sequence back with choices put back).
* Test hook: `window.TSI_BH_SPEED` scales every wait (`intro.js` 30); reduced motion shortens fades (`reduced()` 32).

### 1.3 Protocol today (what crosses between phone and Bastion)

* **Pairing BHP1** (`codes.js` 72-83): `{ v:1, campaign, handler, name, secret }`, base64url, pasted by the player once. The secret stays in `s.beast.handlers[].secret` on the DM's laptop and in the phone's `localStorage` (`tsi.beasthandler.phone.pairing`).
* **Snapshot BHS1** (`codes.js` 86-100, built by `R.beastSnapshotCode` `bastion-link.js` 351-362): `P.build` output (version 1, `projection.js` 242-285) signed with HMAC-SHA256 (`shared/js/hmac.js`; the browser's own crypto is unavailable from a double-clicked file). Contents: `campaign`, `asOfDay`, `handler`, `receipts`, `facilities[]` (a building per species with its beasts as directory lines) and `creatures{}` (detail for the handler's own beasts only: `facility`, `handler`, `bond`, `training`, `profile{regional,dominant,attachment,trigger}`, `chronicle` (latest 40, DM-only filtered, ids renumbered), `orders{status, available[], busy, note}`, `rev`, `artKey`). `snap.madeAt` makes an older snapshot refusable on the phone (`phone.js takeSnapshot` 126-142).
* **Request BHC1** (`codes.js` 102-117): `{ v:1, id, campaign, handler, creature, fac, type, view, label, payload, at }`; `type` is `profile.set` or `order.request`. Applied by `R.beastProcess` (`bastion-link.js` 249-318): refused or applied, each with a receipt in `s.beast.done[id]`. Arrives either from the laptop copy via the queue key `tsi.beasthandler.queue` (read by the Bastion every 2 s: `tools/bastion/tool.js` `checkBeast` 4784-4795, interval line 4797) or as a pasted code (`R.beastProcessCode` 337-347 from `dm-panel.js onPaste` 104-129).
* Saved Bastion record: `s.beast = { campaignId, accept, handlers:[{id,name,secret,since}], done:{id: receipt}, floor }` (`R.cleanBeast` 66-111, kept by `R.toSave` `rules.js` 438-439; `tool.js` 109 makes the campaign id on first open).

---

## 2. Handover against the code (requirement by requirement)

| # | Handover says | Today | What changes |
|---|---|---|---|
| H1 | "Remove the ability to manually input regional varieties and personality traits - the player must roll, and they get what they are given." | Typed boxes + datalists + chips in `intro.js` (108-127, 146-249) and `view.js` `renderProfileEdit` (357-440); DM can also type in the Bastion's Temperament dialog (`tools/bastion/tool.js` `onTemperament` 577-611, `R.setTemperament` `creature-rules.js` 671-683). | Player side: all typed input deleted; reveal only. DM side: keep the DM's Temperament dialog as an override (assumption A3). |
| H2 | "Feign the idea of choice… fix the app so these varieties are always landed on": Wyvern Bloodcrest, Griffin Dawnmantle, Dire Wolf Blacktide, Buckbear Broadcrown, Fellcat Lichenback. "Present the illusion of chance." | `Pf.suggestOne(species,'regional')` is already an even pick (a d5) over the species' list. | New `Pf.initiate()` with a `fixed` mode (data-driven, one word to switch back to `random`); staged reveal on the phone (section 2.2). |
| H3 | "Visual aid and bonding tracker, with no orders panel." | `renderOrders`, `renderConfirm`, building lock, order projection, `order.request`. | Deleted (section 3). |
| H4 | Bottom bar "Profile / Bond / Chronicle". | Bottom bar "Profile / Orders / Chronicle" (`view.js nav` 267-276, CSS 394-420); the hero page has no tab. | Three tabs; Bond is the landing tab and sits in the middle (section 2.3). |
| H5 | "Bonding: new name for the main hero page… keep as is, but add a 'Bonding Days' counter… keep the 1-5 bonding pills aesthetically, but each pill should slowly fill up as the counter increases…" | `bondBar` pills are all-or-nothing (`done`/`current`/`todo`). | Counter + proportional fill (section 2.3). |
| H6 | "Once a pill is full, a notification is produced in the Bastion prompting the DM… Once that has been confirmed by the DM, it moves on to the next level's pill." | `R.confirmBond` (`creature-rules.js` 685-697) already requires a scene reason, raises exactly one level and writes a Chronicle line; `bond.ready` is only ever set by `R.completeTraining` (608-611). | Bastion side sets `bond.ready` from days instead of from a training order (section 7). The app only displays it. |
| H7 | "Profile: this screen is already built. Chronicle: already built, keep it." | Profile includes the editor and "waiting" marks. | **Conflict with H1**: Profile stays but becomes read-only (section 11, item 1). Chronicle unchanged. |
| H8 | App "becomes available" after the Pit's acclimatisation roll passes (Bond 1). | Beasts appear in the directory as soon as housed; detail as soon as a handler is named. | Detail only at Bond 1 or more; a Bond 0 beast is a line "Not acclimatised yet" (assumption A4). |
| H9 | Five beast types: Wyvern, Griffin, Dire Wolf, Buckbear, Fellcat; Pit holds one of each. | Three kinds; one building per kind (`P.homes` 68-79, home ids `wyvern_roost` etc.). | Species list and art map grow; `P.homes` re-pointed at the Pit (area A already flags: with the three buildings gone the app shows **no beasts at all** unless `species.*.home` is re-pointed). |
| H10 | New pictures + Buckbear and Fellcat variety text. | Three pictures filed in the repo, not wired. | Section 2.4. |
| H11 | "Automatically updating link… QR code… small simple backend if it would help." | Pasted pairing + snapshot codes; offline. | Section 6. |

### 2.1 Removing manual input (what "the player rolls" means in code)

Nothing the player types or taps reaches the Bastion any more. The player presses Roll; the dice play; the **answer was already decided and stored by the Bastion**. The app's job is to draw that answer. The three profile lines the player used to type (`dominant`, `attachment`, `trigger`) and the Regional Variety (`regional`) stay exactly where they are in the Bastion save (`development.temperament.*`, `development.regional`), so the Bastion's own panels, the DM's Temperament dialog, the profile change log (`development.profileLog`) and old saves are untouched.

### 2.2 The fixed variety and the illusion of chance (design)

**Rule (data, one place).** A new data file, `tools/beasthandler/data/initiation-data.js` (loaded by the Bastion, not by `beasthandler.html`, so the phone page's own scripts do not spell out the answer; the repo is public so this is only casual-spoiler protection):

```
window.TSI_DATA.beastInitiation = {
  regional: { mode: 'fixed',   /* 'random' later = an even pick, exactly as today (Pf.suggestOne) */
              fixed: { wyvern: 'bloodcrest', griffin: 'dawnmantle', dire_wolf: 'blacktide', buckbear: 'broadcrown', fellcat: 'lichenback' } },
  personality: { mode: 'random' }   /* d12 dominant, d8 attachment, d8 trigger: genuinely random */
};
```

The fixed mapping applies **only to the initiation roll**. A beast that already has a Regional Variety keeps it, and the DM can still type any variety afterwards (so existing saves and test fixtures with Widowspine, Embermantle etc. are unaffected).

**On screen (Panel 2, "Which one is <Name>?"; the existing words `M.meetingText` 141-149 are reused).**

1. Show the species' varieties as medallions (name only) in a **freshly shuffled order each visit**. Region and appearance stay hidden until the roll lands (they are the existing `info.area/where/appearance`).
2. One primary button, "Roll for subspecies". No text box, no tap-to-pick, no second roll (the button is gone after the roll).
3. On press: a die chip "d5" (or "d6") tumbles through numbers; a gold marker hops across the medallions for about 3.5 to 4.5 seconds with **decelerating gaps** (about 90 ms growing to about 420 ms), a random start, one to two laps, and one near miss (stops one beside, then steps onto the result). Path and duration differ every time; only the destination is fixed. The number the die settles on is the landing medallion's **position in this run's shuffled order**, so the same variety shows different numbers on different runs.
4. After landing: the variety's name, region and appearance fade in (existing `renderProfileRead` "About" text), then "Continue".
5. Reduced motion (`reduced()` in `intro.js` 32): no hopping; result shown with a short fade. Tests keep using `TSI_BH_SPEED`.

**Known limit** (to tell Harry, not a bug): every wyvern will land on Bloodcrest. The Pit holds one of each type, so a table normally sees each only once; a beast released and re-granted would land on the same variety again. That is what "until further notice" means.

**Panel 3 (personality).** Three cards: Dominant Temperament (d12), Attachment Cue (d8), Instinctive Trigger (d8), each with a Roll button ("Roll all three" kept). The die tumbles about 1.2 s and settles on **the Bastion's real roll number**; the line and its note (d12 rows already have a `note`) appear. Locked after rolling. Buckbear and Fellcat have no d8 tables yet (section 2.4).

**Honest logging for the DM.** The Bastion's Day Log line says "(staged: fixed until further notice)" so Harry can see later that the variety was not a chance outcome.

### 2.3 Bottom bar, Bond page, Bonding Days, pills

* `nav` becomes three tabs in the order **Profile, Bond, Chronicle**. `ui.tab` values `profile | bond | chronicle`; default `bond` (the old `'main'`). The back button is always "All beasts" (no "Back to main" any more: `topBar` 278-285 simplifies). `data-screen` becomes `creature-bond` (CSS only uses the prefix `creature`, line 445, so nothing breaks). Test ids: `bh-tab-profile`, new `bh-tab-bond`, `bh-tab-chronicle`; `bh-tab-orders` is deleted. The bar already is a 3-column sticky grid (`beasthandler.css` 394-420), no layout change needed.
* The Bond page keeps: name, handler line, hero picture, subspecies chip, "Current rapport" card. It loses: training line, "requests are waiting" line, waiting/unknown-picture notices tied to requests (`hero` 120-121), and "Wyvern · Wyvern Roost, Level 3" (becomes "Wyvern · Beast Pit"; no level pill if the Pit has no levels, per Q10 in area A).
* **Bonding Days counter**: a stat tile in the rapport card, "Bonding Days: 12", with one line under it: "On the road with Mira since Day 31" or "Resting at the Beast Pit: bonding is paused" (the counter keeps showing the total). Source: snapshot `bonding.days`.
* **Pills** (`M.bondPills` 25-34 changes to take the bonding block): for bond level L, pills 1..L are full (`done`, with the pill for L marked `current` as today); pill L+1 is `filling` with width `pill / need` (or `ready` = full with a soft pulse and the words "Ready: waiting for a moment with your DM"); later pills are `todo`. At Bond 5 all five are full. **Pill 1 is full from the acclimatisation pass**, because Bond 1 comes from the Pit's DC roll, not from days (ambiguity, section 11 item 2). The pill bar is an 8 px track (`.tsi-bh-pill__bar` 305); add an inner fill element with a width transition (honours `--tsi-signature-slowdown`; none under reduced motion).
* Accessibility: the filling pill gets `role="progressbar"` with `aria-valuenow/min/max` and a text label "Bond 3, Bonded: 7 of 10 days"; the list currently is one `role="img"` (`view.js` 146) and must change.
* Implementation gotcha: on the phone a relay push calls `view.refresh()`, which does `TSI.clear(shell)` and redraws (`view.js` 586-619). A redraw would (a) cut a roll animation in half and (b) make a pill "jump" instead of fill. The reveal must keep its own state and skip redraws while animating, and the pill width should be updated in place when a new snapshot raises it.

### 2.4 The two new beast kinds and the new pictures

Needed in `data/profile-tables.js` (`window.TSI_DATA.beastProfile.species`): add `buckbear` and `fellcat`, each with five varieties (`id, name, area, where, appearance`) from Harry's message (`scratchpad/pdf/new-varieties.txt`), and add Blacktide to `dire_wolf`.

| Kind | Varieties (ids lower-case) | Picture today |
|---|---|---|
| Buckbear | broadcrown, shovelhorn, cragbuck, fenwallow, saltcoat | broadcrown only (`assets/buckbear/broadcrown.webp`, 1024x1536) |
| Fellcat | mistveil, whiteout, lichenback, tawnyfell, smokecoat | lichenback only (`assets/fellcat/lichenback.webp`, 720x1280, the lowest resolution of the set) |
| Dire Wolf | nightfang, icepelt, slatejaw, reedshadow, hollowhowl, **blacktide** | blacktide (`assets/dire-wolf/blacktide.webp`, 941x1672) |

`data/art-map.js`: add species `buckbear` (label "Buckbear") and `fellcat` (label "Fellcat") with `variants: { broadcrown: {src:'buckbear/broadcrown.webp'} }` and `{ lichenback: {src:'fellcat/lichenback.webp'} }`; add `blacktide: {src:'dire-wolf/blacktide.webp'}` under `dire_wolf`. Note the species id is `dire_wolf` but the folder is `dire-wolf`. The varieties with no picture show the existing honest blank frame (`hero` 94-108 handles `src: ''`). The hero frame is 4:5 with `object-fit: cover`, so the three new aspect ratios crop sensibly (checked by eye: Broadcrown's antlers and Lichenback's ear tufts stay inside the 28% offset).

Gaps that block a complete build (questions Q3 and Q4):
* **Blacktide has no region or appearance text** (Harry's message: "only its picture"). The picture shows a black-and-tan wolf on a storm-lashed rocky shore with a wrecked ship and a red banner with a white tree sigil; I have not invented where it lives.
* **Buckbear and Fellcat have no d8 Attachment Cue or d8 Instinctive Trigger tables.** `Pf.rollTable` returns `null` for a missing table (`profile-rules.js` 43-48), so a roll would silently give blank lines. The d12 Dominant Temperament table is shared and works.
* Blacktide makes six Dire Wolf varieties; the roll becomes a d6 and `tests/rules/beasthandler-tables.test.js` (lines 21-33, 49-67) and `beasthandler-model.test.js` (120-132) hard-code "five" and "one picture for each of five". If Harry says Blacktide *replaces* one of the five, those numbers stay at five.
* The Beast Pit (area A/G) must add `buckbear` and `fellcat` to `creatures-data.js` `species` and `grantable`, otherwise `P.homes` (68-79) never lists them and the Explorer cannot grant them.

---

## 3. What existing code is removed (precise)

### `view.js`
* Host members `canSubmit, outbox, drafts, submit, afterSubmit` and the header comment 16-25.
* `outbox()/outboxAll()` 53-55; `pendingFor/effective` 72-74 (the "waiting overlay"); the `pic.waiting`, `pic.unknown` notices in `hero` 120-121 and the `waiting` line in `renderMain` 288/296.
* `trainingLine` 155-158; `requestsBlock` 160-173; `saidLine` 174; `submit` 176-202 and the `submitting` flag.
* `renderProfileRead` waiting marks and the "Edit or roll this profile" panel (323-355); `renderProfileEdit` 357-440; `startEdit/profileValues` 316-321; `ui.edit`/`keepDraft` logic in `go` 62-65 and `fixRoute` 68-70.
* `renderOrders` 447-491, `renderConfirm` 494-507, `ui.orderFn`, the `orders` tab.
* The `meet` wiring 544-575 (draft, submit, refused, blocked, canSkip, skip) is replaced by a much smaller one.
* `topBar` back logic 278-285.

### `intro.js`
* `fresh()` 45-61, `follow()` 64-71 (draft/original/suggested/refused/restored/holding state), `field()` 108-127 (typed input + Roll), `panelSubspecies` 146-187 (typing, datalists, chips, unknown-name warning), `panelPersonality` 190-249 (typed lines, `Save` sending `profile.set`, draft saving), `trouble/cleaned` helpers. Keep: `speed/ms/reduced` 30-32, `panelMeet` (without the refusal text and Skip rules), `dots`, **`close` 252-311 (the curtain), unchanged**, `render` 314-319.

### `model.js`
Delete `confirmLines` 86-98, `pendingProfile` 110-118, `effectiveProfile` 119-125 (or reduce to a plain reader), `needsMeeting` 126-130 (replace), `regionalWaiting` 131-134, `refusedProfile` 135-139, all of "Requests" 158-190 (`requestRows`, `requestLine`, `waitingOrderAt`), the queue 192-212 (`cleanQueue`, `QUEUE_MAX`). Rewrite `homeMessage` 68-76 (it names the Roost, Tower and Den), `emptyBuilding` 76, `bondPills` 25-34, `rapportLine`. Keep `regionalInfo` 36-58 (the loose-name matcher is still useful for a DM-typed variety), `artFor`, `catLabel`, `syncLine`, `possessive`, `speciesNoun`, `meetingText`, `handlerChoices`, `title`.

### `projection.js`
Delete `isPlayerOrder` 54-66 and `orderRule` 55-58, `pendingAt` 81-90 (exported as `P.pendingAt`), `consequenceOf` 121-129, `busyLabel` 131-141, `ordersFor` 143-182, `trainingOf` 195-202, `viewRev` 204-209 (it fingerprints orders and exists only to detect a stale request), the `orders`, `training`, `rev` and `receipts` fields of the snapshot, and the per-building loop in `P.build` 247-270. Rewrite `P.homes` 68-79 and `housedIn` 92-99 for the Pit. Keep `safeKey`, `handlerKey`, `sameHandler`, `handlers` 104-118, `chronicleOf` 185-193 (DM-only filter and renumbering are leak protection), and the principle "never put anything in a snapshot without a test".

### `codes.js`
Delete (or keep behind option O2 in 4.3) `encodeCommand/peekCommand/verifyCommand` 102-117, the `cmd: 'BHC1'` tag, and `MAX_AGE_MS` 34 (also used by `phone.js` 71 and `bastion-link.js`). Keep pairing and snapshot signing.

### `bastion-link.js`
Delete `TYPES`/`R.BEAST_TYPES` 57-58, `RECEIPTS_MAX/FUTURE_MS`, `R.beastReceiptsFor` 174-195, `R.beastRecent` 199-208, `forPlayer` 239-244, `R.beastProcess` 249-318, `R.beastProcessQueue` 322-333, `R.beastProcessCode` 337-347, and the `done`, `accept` and `floor` parts of `R.cleanBeast` 66-111 (the cleaner must still **accept** an old save that has them and quietly drop them). Keep `R.beastState`, `R.beastCampaignId`, `R.beastRegistry` 124-138, `entryFor`, `R.beastSecret`, `R.beastPair` 153-162, `R.beastRevoke` 163-169, `R.beastSnapshotCode` 351-362 (plus new `phoneUrl`), and `R.setProfile` 214-234 (the DM's Temperament dialog and the new initiation both use it: keeps `profileLog` and the Day Log line, never touches bond, stats or Chronicle).

### `dm-panel.js`
Delete the "Take requests from handlers" tick box (136-141), `onPaste` 104-129, the "Latest requests" list (154, 163-168) and the sentence at 156 ("Players ask for things…"). Keep add-handler, pairing, take-back, snapshot. Add the QR / link (section 6). `tools/bastion/tool.js` loses `checkBeast` and `trimBeastQueue` (4765-4797, interval at 4797, `debug.beast` 5604, call at 5679) and the `R.beastProcessQueue` notice "From the Beast Handler: …".

### `tool.js` (laptop host)
Delete `QUEUE_KEY`, `STALE_MS`, `changeQueue`, `prune`, `labelFor`, `host.canSubmit/outbox/submit/drafts`, and `validateImport` (171-178, it only checks the queue). The tool then **saves nothing of its own** except an optional tiny "seen" map (see 4.5). `saves: true` in `tools.js` line 187 becomes `false` unless that map is stored via `ctx.store` (then keep `true`). Old key `tsi.beasthandler.queue` in people's browsers and backups: ignore on load and delete it (`TSI.store.remove`, `store.js` 400) so a stale queue can never be read by anything.

### `phone.js`
Delete the outbox (`KEY.outbox`, 29/53/58/60-74), `host.canSubmit/drafts/outbox/submit/afterSubmit` (158-185), `onForget` 216-223, the "Requests to send to the DM" section of `homeExtras` 228-241, `showCode` 102-115 and `copy` 80-93 (only the request outbox used them; the DM's box has its own copies in `dm-panel.js`). Keep link, snapshot paste, unlink, age ticker. `usable()` (46-51) already forgets a stored snapshot of another version, which is how version 2 retires every old cached snapshot.

### CSS
`beasthandler.css`: delete `.tsi-bh-order*` (345-364, 189), `.tsi-bh-pending*`, `.tsi-bh-confirm`, `.tsi-bh-requests*`/`.tsi-bh-request*` (467-473), `.tsi-bh-edit*` (458-466), the meeting field/chip rules (487-495, 501-508 as needed). Keep hero, pills (extend), nav, curtain (512-537), picker, cards. `phone.css`: delete `.tsi-bhp-sendlist/.tsi-bhp-send*` (about lines 31-35).

### Data
`profile-tables.js`: delete `beastPlayerOrders` (last block) and its test (`beasthandler-tables.test.js` line 94). No other data is deleted: the d12/d8 tables and the 15 existing varieties stay.

### What does NOT go
The hero page, the harmless tap-greeting, the Chronicle page, DM-only note filtering, pairing, snapshot signing, the curtain sequence, "Viewing as" on the laptop, the 44 px rule, reduced-motion handling, the `TSI_BH_SPEED` hook.

---

## 4. Protocol v2, and who rolls

### 4.1 What the app still needs from the Bastion (read-only snapshot, `P.VERSION = 2`)

```
snapshot v2 = {
  kind, version: 2, campaign, asOfDay, asOfLabel, madeAt,
  handler: { id, name, hasCreatures } | null,
  facilities: [ { id: 'beast_pit', name: 'Beast Pit', creatures: [ directory line ] } ],   /* one entry; keeps the Home cards working */
  creatures: { <id>: {                                       /* the handler's OWN beasts only */
      id, name, species{id,name}, handler{name},
      available: true|false,                                 /* false at Bond 0: nothing below is sent */
      bond: { level, name, max: 5 },
      place: 'pit' | 'away',                                 /* "At the Beast Pit" / "Away from the Ironbow" */
      bonding: { days, pill, need, ready },                  /* days = Bonding Days; pill/need = progress to the next level; ready = level awaiting the DM, or null; null block at Bond 5 */
      initiation: { regional: <variety id>, rolls: { dominant, attachment, trigger } } | null,   /* what the Bastion rolled; null until Bond 1 */
      profile: { regional, dominant, attachment, trigger },
      chronicle: [ ... ], chroniclePartial?,
      artKey
  } }
}
```
Removed from v1: `receipts`, every creature's `orders`, `training`, `rev`, `facility.level`/`detail.facility` (unless the Pit has levels). The directory line for another handler's beast keeps name, species, handler name and bond, and gains `place`.

Names for `bonding` follow area G's prototype (`scratchpad/analysis/g-bonding-prototype.js`: `{ away, awaySince, lastTick, days, pill, need }`); the app needs only `place, days, pill, need, ready` and does not care whether the Bastion derives or ticks them.

Every field above needs a leak test saying why a player may see it (`tests/rules/beasthandler-projection.test.js` 176-195 is the model). `initiation.rolls` and `profile` for a beast the handler does not own are **never** sent.

### 4.2 Pairing (BHP1) and snapshot signing (BHS1)

Unchanged in shape. Existing paired phones keep working: the pairing secret and campaign id do not change; their cached v1 snapshot is discarded by `usable()` (`phone.js` 46-52, `P.check` 288-293) and the player simply needs a v2 snapshot. If the link in section 6 is built, the pairing code gains the QR/URL form and (relay) a mailbox key derived from the secret.

### 4.3 Who rolls: options

| Option | What happens | Phone sends | Verdict |
|---|---|---|---|
| **O1 (recommended)** Bastion rolls once, at the moment acclimatisation passes (Bond 0 to 1) | `R.rollInitiation(s, data, id, rand)` stores `development.initiation` (set once) and fills any blank profile lines in the same step. The snapshot carries the result. The phone plays the reveal whenever the player runs it. | **Nothing.** The protocol is read-only. | Simplest, strongest. Works with the offline code swap and with any live link. Best exactly-once story. |
| O2 Bastion rolls when the player taps Roll | The phone sends one tiny `initiation.begin` request (no payload); the Bastion rolls and returns the result in the next snapshot; the animation runs until it arrives. | One command type (receipts, floor, age limit all survive for it). | Only worth it with a live link (otherwise "Roll" means: paste a code to the DM and wait). Gives the player a real sense of agency; costs the whole request machinery for one message. Upgrade path if wanted. |
| O3 Phone rolls and sends the numbers | The phone's RNG decides; the Bastion validates ranges and first-write-wins. | `initiation.set` with results | **Not recommended** (4.4). |
| O4 Player rolls real dice at the table, DM types the numbers | No app involvement | n/a | Possible, but Harry asked for an on-screen roll and a fixed variety. |

**Decision: O1.** The Bastion is already "the only place anything is decided" (`bastion-link.js` header; `profile-rules.js` header: "a roll never changes a bond, a stat…"). The reveal is theatre over a stored, Bastion-made result. The phone keeps one **local** flag per beast (`seen`) so the sequence plays once per device; it is not sent anywhere (4.5).

When the roll happens in the Bastion:
* On acclimatisation success (area G's `R.acclimatise…`), in the **same step** that sets bond level 1, so it cannot be applied twice or skipped.
* One-off sweep for beasts already at Bond 1 or more with no `initiation` and no `regional` (Elara's wyvern is credited Bond 1 and has no variety; any beast in an old save with Bond above 0): run when the Bastion opens or at the next day tick, in the Bastion, never inside `P.build` (a snapshot build must not change the save: the test at `beasthandler-projection.test.js` 239 pins that).
* Beasts that already have a `regional` are marked as introduced and **never replay** the sequence (this is today's behaviour: `needsMeeting` is false once a subspecies exists).
* Lines the DM already wrote are **kept**; the roll fills blanks only (this is today's "lines already written for the beast are shown and kept"). If the DM typed a variety before the roll, the fixed mapping does not overwrite it (assumption A3).

### 4.4 Game-integrity risks of letting the phone roll (the reason for O1)

| # | Risk | How it happens today's design would allow it | Under O1 | Under O3 (phone rolls) |
|---|---|---|---|---|
| R1 | **Forged result** | The secret is in the phone's `localStorage` and the signing code is plain JS (`hmac.js`, `codes.js`): anyone can sign any payload. | Nothing to forge: no phone message exists. | Possible; a signature proves "someone with the secret", not "honest dice". |
| R2 | **Re-rolling** | Unlink, relink (pairing codes are not single-use), clear site data, open a private window, use a second phone: each starts a fresh roll. | The result is stored in the Bastion; every device sees the same one. | Possible without limit. |
| R3 | **Roll-shopping** | Generate many signed requests offline, send only the best; first-write-wins accepts whichever arrives first. | n/a | Possible. |
| R4 | **Console cheating** | `Math.random = () => 0.99` in the browser console. | n/a (phone does not decide). | Possible, no code forging needed. |
| R5 | **Replay / stale command** | A saved request resent after the DM changed or reset the beast. | n/a | Needs `initiated` one-way flag plus receipts, and still lets an old, better roll win if it was sent first. |
| R6 | **Phone shows A, Bastion stores B** | The DM edits the line while the player is mid-sequence; today's `follow()`/draft code exists only to manage this. | The phone draws what the snapshot says; no divergence. | Needs the whole waiting/refused overlay machinery to stay. |
| R7 | **DM overwritten** | A late phone roll replacing lines the DM wrote. | The roll fills blanks only. | Must be guarded explicitly. |
| R8 | **Fixed variety exposed or ignored** | The mapping would have to ship in phone code; a modified phone could pick another variety; the Bastion would have to override it anyway. | Mapping lives in a Bastion-only file. | Phone roll for the variety would be cosmetic; the Bastion has to enforce. |
| R9 | **Liveness** | With the offline code swap a phone roll means pasting a code to the DM and waiting for a snapshot back. | No round trip: result arrives with any snapshot. | Round trip needed. |
| R10 | **Spoiler** (low) | n/a | The result is in the snapshot before the reveal (base64 JSON, not encrypted). A curious player can decode their own snapshot and see their beast's lines early. No gameplay advantage (they cannot change it). Accept and document. | Same. |

The cheat surface under O1 is **empty**: a read-only app cannot be used to alter the game.

### 4.5 The "seen" flag

* Phone: `tsi.beasthandler.phone.seen` (map of creature id to `true`) in `localStorage`, cleared on Unlink (add to `write(...,null)` list at `phone.js` 209).
* Laptop copy: a small saved record `tsi.beasthandler.seen` through `ctx.store` (keeps the DM's "viewing as" preview from marking the player's phone as seen; they are different devices). If Harry prefers no saved key, use `sessionStorage` (replays on reload; the laptop already has "Skip for now").
* The meeting is shown when: `detail.available && detail.initiation && !seen[id]`. Closing the page part-way sends nothing and replays from the start (today's behaviour, `beasthandler-meet.test.js` 227).

---

## 5. Exactly-once rules that must survive

These are the rules whose tests exist today or must exist after; each is "must still hold".

| # | Rule | Where it lives now / will live | Proven by |
|---|---|---|---|
| E1 | **A bond level rises only when the DM confirms, exactly one level, with a scene reason and one Chronicle line.** A second press (double click, second window, reload) does nothing. | `R.confirmBond` `creature-rules.js` 685-697 (`bond.ready === level+1`, ready cleared on success; `R.cleanDevelopment` also rejects `ready !== level+1`, `rules.js` 697-700) | `wyvern-bonding` rules/e2e (migrate to Pit) |
| E2 | **Each in-game day is counted once per beast, only while it is away.** Survives a reload mid-day (`dayInProgress`), the Bastion catching up several days after being closed, a second window (blocked by `toollock`), Export/Import, and **Reset Travel** (`R.shiftDays` `rules.js` 3309: every day marker must be moved with it, as `awaySince`/`lastTick` in area G's prototype are). | Bastion (area G): tick in `R.startDay` (3237-3256) or derive from `awaySince` | New rules test; G's prototype already shows the failure when `lastTick` is not shifted |
| E3 | **The "pill full" notice appears once per milestone.** It must not repeat after a reload or an import, and the DM's Beast Pit keeps showing "Confirm bond milestone…" until handled. | Bastion: notify only on the transition `ready: null to level+1`, plus the existing `bond.ready` flag | New test |
| E4 | **The initiation roll happens once per beast.** Not on reload, resend, second window, snapshot build, DM edit, handler change or import of an older backup. | `development.initiation` set-once; `R.cleanDevelopment` must keep it (an unknown field is dropped on every reload: `rules.js` header comment at lines 656-670) | New rules test (incl. save/load round trip) |
| E5 | **Acclimatisation passes once** (Bond 0 to 1 only); a failed attempt starts the 3-day wait once and the wait moves with Reset Travel. | Bastion (area G) | G's tests |
| E6 | **Snapshot ordering:** a snapshot older than the one held is refused; a snapshot for another campaign or handler is refused; the Bonding Days shown never go backwards because of a stale paste. | `phone.js takeSnapshot` 126-142 (`madeAt`, `campaign`, `handler` checks) | `beasthandler-phone.test.js` 96, 179, 249 (keep) |
| E7 | **Take out / Return are idempotent**: pressing "take out" on a beast already away, or "return" on one at the Pit, changes nothing; return banks the days so none are lost or doubled. | Bastion (area G) | New test |
| E8 | **A handler change ends the old pairing's bonding days** (new pairing starts at Bond 0 unless the DM credits the old bond, as `R.assignHandler` 643-670 does today; with a credited bond keep the days). The beast's profile and initiation belong to the beast and stay. | `R.assignHandler` | Extend `wyvern-bonding` test 130 |
| E9 | **Pairing secret hygiene:** the secret never appears in a snapshot or the Day Log; "Take back code" stops a phone's snapshots verifying. (Under a read-only app a leaked secret lets someone read that handler's snapshot, nothing more.) | `bastion-link.js` 150-169, `beasthandler-link.test.js` 326, `beasthandler-phone.test.js` 78, 268 | Keep |
| E10 | **If O2 is chosen later:** receipts (`s.beast.done`), `floor`, the 30-day age limit, campaign id and handler checks all return for the one command type. Until then they are deleted, but `R.cleanBeast` must still load old saves that contain them. | `bastion-link.js` | Keep a load test with an old `beast` block |
| E11 | **Chronicle stays DM-filtered:** `private: true` notes never reach the snapshot; ids are renumbered so a gap cannot reveal a hidden note. | `projection.js chronicleOf` 185-193, `R.isPrivateNote` | `beasthandler-projection.test.js` 196, 214 (keep) |
| E12 | **The snapshot build changes nothing in the save** and never creates a `development`. | `P.build` | `beasthandler-projection.test.js` 239 (keep) |

---

## 6. The link: QR codes and an automatically updating link

This is shared with whoever owns "phone link / hosting"; I give what the **app** needs and my recommendation.

### 6.1 Facts that constrain it (verified)
* The phone page must be on a **web address**; an iPhone cannot open it from a file (`docs/PHONE-PAGE.md` 41-45, KNOWN_ISSUES BH-03). The repo is public (`gh api repos/hjhudsonwriter/TSI_MasterSuite`: `private: false`); whether GitHub Pages is switched on could not be read from here (the proxy refuses the Pages endpoint), and the sandbox cannot reach github.io.
* "Automatically updating" needs a middle-man. The Bastion lives in a laptop browser and writes only to that browser's storage; the phone cannot read it. No offline mechanism (BroadcastChannel, localStorage) crosses devices. WebRTC still needs a signalling server. (Proposal doc section 3 reached the same conclusion on 21 October.)
* `CLAUDE.md` ground rule 2: no online service except Matt's Knightly Treasures link; "Don't export, migrate or change Matt's database". Harry's handover now asks to reconsider **for this link only**, so ground rule 2 needs an explicit, recorded amendment before any code is written. The Firebase library is already bundled (`tools/quests/lib/firebase/`, licence in `licences/firebase-Apache-2.0.txt`), and the Notice Board's link already runs from a double-clicked file, but it must never be reused: the relay would be a **new project Harry owns**.
* Never commit keys: Firebase web settings are a public identifier, not a password, but `CLAUDE.md` allows them only for Matt's link in `tools/quests/shop-link.js`; a second config file (for example `tools/beasthandler/relay-config.js`) needs Harry's explicit allowance.

### 6.2 QR for pairing (works with or without a relay)
The DM's box shows, per handler, a QR containing `<phone page address>#pair=BHP1.…`; the player scans with the phone camera, Safari opens the page, the page reads `location.hash`, stores the pairing, and removes the fragment with `history.replaceState` (so the secret is not left in the address bar). That removes "paste the pairing code".
* Needs a bundled QR encoder (for example the MIT-licensed `qrcode-generator`, about 20 KB) as a plain `<script>`, with its licence in `licences/`, and a one-off "Phone page address" setting (stored as `s.beast.phoneUrl`).
* The pairing code is about 150 to 250 characters, comfortably one QR.
* Caveats I cannot test here: a QR on the DM's screen is visible to the whole table (show one at a time; the modal should say "show only to <name>"; low risk because a read-only app cannot change anything); an iPhone keeps a Home Screen page's storage apart from Safari's (`PHONE-PAGE.md` 53-59), so the player must scan **inside the same place they will use the app**, probably Safari rather than the Home Screen icon.

### 6.3 Options for the daily updates
1. **No online service ("scan to refresh").** v2 snapshots are small without orders and the directory. A snapshot without the Chronicle (or with its latest few entries) plus its signature may fit in one QR (version 40-L holds about 2.9 KB of binary). The DM would show a QR at the start of a session and players scan it. Not automatic, but no account and no rule change. The existing BHS1 paste code stays as the fallback.
2. **A small relay (automatic).** The Bastion writes the **same signed snapshot string** to a mailbox; the phone listens and applies it with the existing `takeSnapshot` checks (signature, `madeAt`, campaign, handler). Because the signature already protects authenticity, the relay can be dumb and open, with unguessable mailbox paths (for example `bh/<campaignId>/<first 16 hex of sha256(secret)>`) and a size/prefix validation rule. Best fit: **Firebase Realtime Database** (no sign-in needed, small JSON, free Spark plan; the SDK is already in the repo, or the plain REST/EventSource interface can be used so the phone page stays small). Supabase works but needs tables and row rules and is heavier for a non-developer. I cannot verify current Firebase plans or console steps from here; a spike (as the proposal doc said) comes first and the step-by-step guide must be checked against the live console.
   * Bastion side: push when the handler's snapshot content changes (compare a hash), throttled, and once at open. Offline or failing: skip quietly, as the Knightly Treasures link does.
   * Phone side: stream updates; show "As of Day N, updated 3 minutes ago" (the `syncLine` machinery exists, `phone.js` 151-157).
   * Freshness depends on the **Bastion window being open**: it is the only thing that passes days (it catches up when reopened, `R.clockAction`). The Explorer cannot push bonding because it does not hold beast state.
   * Test with a stand-in relay, as `tests/e2e/phase4.test.js` does for the shop link (`TSI.quests.shopLink.standIn`); nothing in the test run may reach a real database.
3. Third-party no-account relays (ntfy.sh and similar) are not recommended: they cache messages for hours, not a durable "latest state".

Recommendation: build 6.2 (QR pairing) and the v2 snapshot first because both are needed whatever Harry chooses; build 6.3 option 2 behind a config switch only if Harry approves the rule change and creates the account (question Q5). The relay itself is a **separate, later step in the same PR** with its own guide in plain English.

---

## 7. Contract with the Bastion side (areas A, F, G; what the app depends on)

These are not mine to build, but the app cannot work without them. Names are proposals, aligned with G's prototype.

* **Facility id** `beast_pit` (area A). `species.*.home` in `creatures-data.js` re-pointed at it for all five kinds; add `buckbear` and `fellcat` to `species` and `grantable` (the Explorer's Grant a creature dialog reads `grantable`, `creatures-data.js` line 92).
* **Creature data** (kept by `R.cleanDevelopment`, `rules.js` 697-745): `development.initiation { regional, rolls{dominant,attachment,trigger}, day }` (set once) and `development.bonding { away, awaySince, lastTick, days, pill, need }` (G's names). Bond stays `development.bond { level, ready }`. `R.shiftDays` must move `awaySince/lastTick` (and any retry-wait day) with Reset Travel.
* **Functions** (pure, in `creature-rules.js` or a new `bonding-rules.js`): `R.bondingView(s, data, c)`, `R.takeOut / R.returnToPit`, `R.tickBonding` called from `R.startDay`, `R.rollInitiation`, and the existing `R.confirmBond`. `R.completeTraining`'s `bond.ready` assignment (608-611) and `R.nextStepLine` (709-735) become obsolete with the orders.
* **Data**: days per pill in `creatures-data.js` `development` (for example `bondDays: { 2: 7, 3: 10, 4: 14, 5: 21 }`); the old programmes took 7, 7, 10 and 14 days for Bonds 2 to 5 (`facilities-data.js` `wyr_*` ids), G's prototype uses 7, 10, 14, 21. The app reads `need` from the snapshot, so changing the numbers is a one-line data edit.
* **DM notification** when a pill fills: `R.addWord` ("The Ironbow sends word…") and a `notice(...)` toast (`tools/bastion/tool.js` 150, pattern at 4684), plus the beast's "Confirm bond milestone…" button (`wyvernProfile` 684-720) staying visible until confirmed.
* **Beast Pit panel** carries the DM's Beast Handler box (the Management panel's fate is area A's Q5). `dm-panel.js` only needs a host object with `state(), data, done(), life` as today.
* The manifest in `shared/data/tools.js` for the Beast Handler (lines 194-227) loads the whole Bastion data and rules chain, **including the war files** (`war-room-data.js`, `regiment-rules.js`, `war-table-rules.js`, `war-battle-rules.js`, `war-ai.js`, `war-campaign-rules.js`). Whatever area B decides about the war files, this list must follow (B found that `tool.js` needs them but the Beast Handler does not open them).

---

## 8. Files to create, change, delete

**New:** `tools/beasthandler/data/initiation-data.js`; `tools/beasthandler/qr.js` + `licences/qrcode-<licence>.txt` (if QR approved); `tools/beasthandler/relay.js` + `relay-config.js` + a plain-English setup guide (only if the relay is approved); tests listed in section 9.

**Changed (mine):** `view.js`, `intro.js`, `model.js`, `projection.js`, `profile-rules.js` (add `Pf.initiate`, `Pf.rollDie`), `codes.js`, `bastion-link.js`, `dm-panel.js`, `tool.js`, `phone.js`, `beasthandler.css`, `phone.css`, `dm-panel.css`, `data/profile-tables.js`, `data/art-map.js`, `beasthandler.html` (script list, no `codes` change unless BHC1 stays), `shared/data/tools.js` (desc line 188 "wyvern, griffin or dire wolf", `saves`, file lists for both the Beast Handler and Bastion entries), `tests/rules.html` (script lists).

**Changed (Bastion side, owned elsewhere):** `tools/bastion/tool.js` (remove `checkBeast`, mount the box, Temperament dialog `opts` for new kinds), `creature-rules.js`, `rules.js` (cleaner, `shiftDays`, `startDay`), `data/creatures-data.js`, `data/facilities-data.js`, `shared/js/bridge-rules.js` (grantable kinds, via the Explorer analyst).

**Deleted:** `beastPlayerOrders` data block; `tests/e2e/beasthandler-write.test.js` (all of it is about requests); the request/order/queue parts of the other tests.

---

## 9. Tests

### Rules tests (`tests/rules/`, run in `tests/rules.html`; today 101 tests across six Beast Handler files, of about 1,285 total)
* `beasthandler-codes.test.js` (6): keep tests 9, 18, 25, 35; delete the two BHC1 tests (48, 62) unless O2.
* `beasthandler-link.test.js` (34): **keep/adapt** 58 (campaign id), 296 (DM can edit Regional Variety), 310 (change notes survive saving; drop receipts/handlers-cap parts), 326 (pairing), 348 (snapshot code), 451 (built-in names harmless), 583 (madeAt; wording). **Delete** the other 27 (71 to 284 and 368 to 564 are about applying requests, receipts, building lock, forged/other-handler requests, forgetting receipts, cancelled/ended orders).
* `beasthandler-projection.test.js` (28): **keep/adapt** 61, 76, 84, 96, 106, 119, 133, 148, 162, 176, 196, 214, 239, 251, 262, 289, 443; **delete** 274 to 432 (orders, building lock, Under Repair, training line, harness never offered). Add: version 2, Bond 0 beast sends no detail, `bonding`/`initiation`/`place` fields and their leak rule, one Pit entry, five species, no `orders/training/receipts/rev`.
* `beasthandler-model.test.js` (18): delete `confirmLines` (68), requests (84, 101), queue (108), needsMeeting/regionalWaiting/refused/pending (153 to 189); rewrite bond pills (9, 134), home messages (53), artFor/variety pictures (38, 120).
* `beasthandler-profile.test.js` (7): keep dice and tables tests; delete the text-check tests that only served typed input (60, 71, 90) **or keep** them because the Bastion's DM edits still use `Pf.check`.
* `beasthandler-tables.test.js` (8): update counts (five kinds, 26 or 25 varieties, Buckbear/Fellcat tables), delete the player-orders test (94).
* **New** `beasthandler-initiation.test.js`: fixed variety per kind; `mode: 'random'` gives an even pick across all faces; d12/d8/d8 each face reachable with a seeded RNG; set-once (a second call changes nothing); DM-written lines kept; never touches bond, stats, Chronicle; snapshot build never rolls; survives save/load; beast with `regional` already set is "introduced"; missing d8 tables are skipped cleanly.
* **New** (Bastion rules, area G owns, but the app's numbers depend on it) `beast-bonding-days.test.js`: days only while away; return banks; no double count on repeated day passes; Reset Travel shift; catch-up days; pill fill and `ready` set once; confirm moves one level; freeze versus carry-over per Q2; Bond 5 stops; handler change; save round trip.
* Dependent tests that **break** because the Bastion side changes (listed for the orchestrator): `tests/rules/beast-bonding.test.js`, `wyvern-bonding.test.js`, `creatures.test.js` (they house creatures through `wyvern_roost`, `house_griffin` etc.; `beasthandler-link.test.js` `world()`/`housed()` helpers at lines 29-55 do the same).

### Click-throughs (`tests/e2e/`, Playwright, `file://`)
* `beasthandler.test.js` (15 checks): keep Home (75, adapt to one Pit card), Viewing as (89, 137), Chronicle (128), no-handler (187), Bastion unchanged (195), sizes (208), reduced motion (266), never-saved Bastion (282), no internet (292). Rewrite the main screen (100: three tabs, Bond landing, counter, pills), Profile (117: read-only, no "Edit"). **Delete** the three Orders checks (146, 163, 179).
* `beasthandler-write.test.js` (14 checks): **delete entirely** (rolling suggests, Save/Send waiting, exactly one order, double press, Bastion switched off, refused request). Replace by a short "the app sends nothing" check inside the new bond test.
* `beasthandler-meet.test.js` (about 30 checks, 841 lines): **rewrite** as the reveal sequence. Keep: curtain order and real-speed timing (160), slow/never-loading picture (517), keyboard focus ring (555), reduced motion (567), black screen removed if the tool closes (592), laptop fit (616), phone fit and 44 px (672), picture-file-missing (419), closing mid-way sends nothing (227). Delete: every typed/tap/Roll-suggestion check, request/waiting/refused/skip-after-refusal/draft checks (92 to 140, 190 to 215, 243 to 400, 428 to 516, 707 to 831 except the final no-internet check). Add: the staged roll lands on the fixed variety for all five kinds; the path and displayed number differ between runs; no re-roll; one roll per beast; replay never happens once seen; personality numbers match the Bastion's stored rolls.
* `beasthandler-phone.test.js` (18 checks): keep 71 (loads no DM tool), 78 (pairing code made, secret not in log), 86, 96, 111, 179, 249, 268, 294 (390 px layout, adapt to Bond/pills), 360 (Add handler), 378 (damaged stored snapshot only), 407 (no internet). **Delete** 118, 135, 158, 194, 217 (request codes), 378's forget-request half, 394 (queue). Add QR/URL pairing and, if built, the relay with a stand-in.
* New `beasthandler-bond.test.js`: the Bond page at several states (Bond 1 pill 2 at 0%, 50%, full "ready", confirmed, Bond 5), counter while away and at the Pit, an in-place fill when a new snapshot arrives, tab bar order, a push during the reveal does not cut the animation.
* Dependent e2e that breaks with the Bastion changes: `beast-bonding.test.js`, `wyvern-bonding.test.js`, `creatures.test.js` (32 checks), `phase1.test.js` (card list line 22 only if the card text changes), `guide.test.js` (see docs).

---

## 10. Docs that change

* `docs/PHONE-PAGE.md` (92 lines): rewrite. Remove "The three codes" request row, "Meeting a beast for the first time", "The normal round trip", "If a request was never sent", "What a phone can never do" bullets about ordering, and the "Not done: QR codes… live link…" line (these are now the plan). Add QR pairing, the file list (`assets/buckbear/`, `fellcat/`, new data file, no `codes` request half) and, if built, the relay steps. The "files a phone needs" list changes (`codes.js` still needed; `profile-rules.js` still needed for the table labels; the three new picture folders).
* `docs/specs/beast-handler-proposal.md`: add a "superseded by the strip-back overhaul" note at the top; do not rewrite its history. Sections 5 to 8 (orders, D2 to D5) are obsolete.
* `guide.html`: line 238 (Wyvern Roost paragraph that talks about the companion and DM-only notes) and the whole Beast Handler section (293-305, id `beasthandler`). `tests/e2e/guide.test.js` checks every bold label in the guide against the tool's code, so every bold name (Viewing as, Pairing code…, Snapshot code…, Take back code, Paste a request code…, Take requests from handlers, Profile, Orders, Chronicle, Edit or roll this profile, Roll all three, Save profile, Send request, Continue, Skip for now, Save and continue, Latest requests) must be rewritten or removed with the code.
* `docs/PROGRESS.md` (entries at lines 11-40 and the architecture paragraph at 1112, which says "Never let a request type do more than `profile.set`…"), `docs/KNOWN_ISSUES.md` (BH-01 to BH-05 are history: add BH-06 onwards recording removed behaviours with one-line before/after: request codes, orders, typed varieties, "Edit or roll", the fixed variety "until further notice", Pill 1 reading, anything left alone), `docs/ASSETS.md` (record the three new pictures, old/new locations, sizes, whether used), `tests/e2e/README.md` (lines 44 and 64 to 67 describe the old Beast Handler tests), `licences/README.md` (QR library), `docs/BASTION-EXPLORER-REFERENCE.md` (no Beast Handler text today, but creature and facility sections change under A/F/G).
* `CLAUDE.md`: ground rule 2 amendment **only if** Harry approves the relay; wording to be Harry's.

---

## 11. Contradictions, ambiguities and assumptions

### Contradictions / ambiguities in the handover
1. **"Profile: this screen is already built" versus "remove the ability to manually input… varieties and personality traits."** The built Profile page includes the editor ("Edit or roll this profile", typed fields, Save). Read literally, keeping the Profile as built keeps the typing. I resolve it by keeping Profile and making it **read-only**.
2. **"Keep the 1-5 bonding pills… each pill should slowly fill up" versus Bond 1 coming from the acclimatisation DC roll, not from days.** Day-by-day bonding "begins" only after Bond 1. So pill 1 cannot fill by days. I treat pill 1 as full once the roll passes and pills 2 to 5 as the four that fill. (Folded into Q1.)
3. **"The Beast Handler App and the initiation sequence becomes available" at the same moment as the beast's subspecies and personality are given**, yet "the player must roll" suggests a player action. Resolved as a staged reveal over a Bastion-made result (O1).
4. **"Illusion of chance" applies to the variety; personality is real.** The handover fixes only the regional variety. I keep the three personality rolls genuinely random.
5. **Elara's wyvern** is credited Bond 1 with no acclimatisation roll and no variety (`R.newDevelopment` `rules.js` 680-695). Under the handover it should presumably get the initiation straight away (a Bloodcrest). Needs the Pit owner to confirm (area G).
6. **Existing saves with beasts at Bond 0 or in training** have no home after the three buildings go (area A section 7 handles the migration); pending training orders disappear. Their `development.training` records are kept as history but nothing reads them.
7. **Bastion fields the war used** (`R.creatureWar`, trainingBonus) stop mattering if the war goes; not mine.
8. **"Orders and other functionality transferred"** is silent about riding: harness, Controlled Ascent, first flight, Rider's Pact have no home once the buildings go. The app never showed them; the DM's Riding line and first-flight confirm (`creature-rules.js` 743-798, `tool.js` `onConfirmFlight`) become unreachable. Area G/A decide whether to delete them.
9. **`CLAUDE.md` conflicts:** ground rule 2 (no online services) versus the handover's relay request; "never commit keys" versus a second Firebase config; "no fetch of local files" is not an issue (the relay would fetch an https address, not a local file). Nothing is online until Harry's say-so and the recorded amendment.
10. **PHONE-PAGE.md says QR/live link/hosting were "not part of the plan you approved"** (line 91): they now are.

### Assumptions I made (reverse any you disagree with)
* A1. O1: the Bastion rolls once at acclimatisation (or in a one-off sweep for older beasts); the phone is read-only.
* A2. Personality is real RNG in the Bastion; only the variety is staged.
* A3. The DM keeps the Temperament dialog (`tool.js` 577-611) and can still type any variety or line; the roll fills blanks only and never overwrites DM-written lines.
* A4. A Bond 0 beast appears in the app as a name line "Not acclimatised yet" with no detail, no profile and no Chronicle.
* A5. The laptop copy stays (same-device route at the table, "Viewing as"); its meeting has "Skip for now" for the DM; a phone has no skip.
* A6. Other handlers' beasts stay a directory line (Harry's D4 of 21 October).
* A7. The old `tsi.beasthandler.queue` key and the old `s.beast.done/accept/floor` are ignored and cleaned; no migration is needed because nothing in them can matter after the change.
* A8. Chronicle and Profile pages keep their current look.

---

## 12. Questions that genuinely belong to Harry

(Also written in the structured summary. Each has a default he can approve.)

* **Q1. How many days to fill each pill (Bond 2, 3, 4, 5), and is pill 1 full from the acclimatisation roll?** The handover says "X days" and never gives it. Default: pill 1 full on passing the roll; 7, 10, 14 and 21 days for pills 2 to 5 (52 in all), as in the Beast Pit prototype; the old training orders took 7, 7, 10 and 14 (38). One line of data to change later.
* **Q2. While a full pill waits for the DM, do the days that pass count towards the next pill?** Default: no (literal reading: the pill sits full, the next one starts when the DM confirms; Bonding Days still counts every day).
* **Q3. Is Blacktide a sixth Dire Wolf variety (so a d6), or does it replace one of the five? And its region and appearance text?** Default: a sixth, shown with the picture and no region text until Harry writes it.
* **Q4. Buckbear and Fellcat: the d8 Attachment Cue and d8 Instinctive Trigger tables.** Default: I draft eight of each in the style of the wyvern, griffin and wolf tables, clearly marked DRAFT in the data file, for him to approve or replace; until approved those two lines reveal as "still to be discovered".
* **Q5. Build the online link for the phone app?** A small relay (a free Firebase Realtime Database that Harry owns, used by this app only) is the only way to get day-by-day updates without pasting. It needs an account, a recorded amendment to ground rule 2, and a second public config file. Default: yes for QR pairing now (no account), and the relay behind an off-by-default switch with a step-by-step guide, built in the same PR once he has made the account.

---

## 13. Risks (summary)

1. Deleting the request protocol is a large, mostly mechanical change touching six tool files and four test files; the leak tests (`beasthandler-projection.test.js`) are the safety net and must be adapted, not dropped.
2. A relay-pushed refresh redraws the whole shell and would cut the reveal and make pills jump (2.3).
3. Old data: saves containing `s.beast.done/accept/floor`, the `tsi.beasthandler.queue` key, phones with cached v1 snapshots (discarded by version check) and old backups must all load cleanly.
4. Bonding Days correctness depends on area G's exactly-once design (Reset Travel, catch-up days, import); the app displays whatever the Bastion sends and cannot repair a wrong count.
5. Unverifiable here: iPhone behaviour (QR scan opening Safari versus the Home Screen app's separate storage), GitHub Pages being on, Firebase's current free plan and console steps.
6. The staged variety will be noticed if the same kind is ever granted twice; documented as "until further notice".
7. The three new pictures differ in size (Lichenback 720x1280 is the smallest); on a 2x phone the hero frame may look soft.
8. `tests/e2e/guide.test.js` fails on any bold label that no longer exists; every guide edit and code edit must land together.

---

## 14. Suggested build order for the Beast Handler part of the big PR

1. Data first: `profile-tables.js` (two kinds, Blacktide, five-variety lists; blocked on Q3 and Q4 for the text), `art-map.js`, `initiation-data.js`, `profile-rules.js` (`Pf.initiate`), with the new rules tests. Nothing visible changes yet.
2. Bastion contract (with areas A and G): `beast_pit` home, `development.initiation` and `development.bonding` in `R.cleanDevelopment`, `R.rollInitiation`, bonding view. Agree the snapshot field names in section 4.1 before either side builds.
3. Projection v2 and its leak tests; delete orders, training, receipts from the snapshot; version bump; one Pit entry.
4. Delete the request protocol in one commit: `bastion-link.js`, `codes.js` BHC1 half, `dm-panel.js`, `tool.js` queue, `phone.js` outbox, `checkBeast` in the Bastion, and the tests that only covered it (so the suite stays green commit by commit).
5. Screens: three-tab bar and Bond page (counter, filling pills, in-place update, accessibility), read-only Profile, Home for the Pit.
6. The reveal (`intro.js`): staged variety roll, personality dice, kept curtain; "seen" flag; laptop Skip.
7. QR pairing and the DM's link box (if approved), then the relay behind a switch (only after Harry's account and the amended ground rule).
8. Docs, guide, README of the tests, KNOWN_ISSUES entries, ASSETS entry for the three pictures; Harry's tickbox list (what to click: link a phone by QR, run the reveal for each of the five kinds, take a beast out, pass days, watch the pill fill, confirm the milestone, return it to the Pit, change handler).
