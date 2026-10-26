# AREA D: DM Doc overhaul (analysis only)

Repo: /home/user/TSI_MasterSuite, branch claude/gallant-ramanujan-klwz70 (main at 4f1db26, plus one art commit 76c1276).
Nothing in the repo was edited. Scratch scripts and npm tarballs are under
`/tmp/claude-0/-home-user-TSI-MasterSuite/2e4b90a8-69de-58d9-bccc-879a8d4b21b4/scratchpad/analysis/` (`scripts/` and `npm/`).

## 0. Short version

- The DM doc already exists, already pops out into its own window, and already has "Change a score". Most of what Harry lists
  is a **re-layout of things that exist**: Party Level, Party Gold, Heroes, Orders Pending, Next Word From The Ironbow, Day,
  Where The Party Is, Change A Score and Threads are all in `shared/js/dmdoc.js` today as tiles and sections in one narrow
  scrolling column (440 x 800).
- Genuinely new: (1) a **2 x 2 panel layout**; (2) **effects split per hero and for the whole party**, which needs the hero's
  id added to the summary; (3) the **Expedition line**, which needs one new saved field in the Explorer (`endedDay`), because
  the Explorer knows when an expedition began but never records the day it ended; (4) the **Quest panel** (a saved
  text box plus optional PDF / Word import).
- Both imports are feasible offline from a double-clicked file. I proved it in Chromium (the engine Edge uses):
  - **PDF**: the PDF.js 3.11.174 copy already in `shared/lib/pdfjs/` works inside the DM doc's own window, with the internet
    off, 5 pages in about 0.15 to 0.5 s.
  - **DOCX**: a hand-written reader of about 120 lines, using the browser's built-in `DecompressionStream`, works from
    `file://`; two real Word files (100 KB and 115 KB) read in 20 to 28 ms. No new library is needed.
- The Quest text can be saved in the suite's normal store under `tsi.dmdoc.quest`, which Back up everything and Restore
  already cover with no change, and it survives the pop-out window being closed and reopened (proved, 672,000 characters).
- Three things in the handover collide with existing behaviour and need care: the Bastion's **Day Log** (being removed) is
  where "Change a score" currently records itself; **`bastionComing`** (which feeds "Next word from the Ironbow") has branches
  for the war, the Hall's removed orders and the removed creature buildings; and a **second click on Pop out opens a second
  window** (verified), which matters once the window holds typed text.

---

## 1. How the DM doc works today

### 1.1 Files

| File | What it does |
|---|---|
| `shared/js/dmdoc.js` (615 lines) | The whole screen: top-bar button, floating panel, drag/resize, pop-out, reading the saves, drawing the contents, the "Change a score" dialog. Namespace `TSI.dmDoc`. |
| `shared/js/dmdoc-rules.js` (176 lines) | Plain functions: window geometry (`clamp`, `defaultRect`, `move`, `resize`, `nudge`, `toSaved`, `fromSaved`; `DEFAULT_W 440`, `DEFAULT_H 800`, `MIN_W 280`, `MIN_H 200`, lines 21 to 29) and the score-edit list (`EDIT_KINDS` lines 115 to 119, `checkEdit`, `makeEdit`, `cleanEdits`, `addEdit`, `editStatus`, `editText`). Namespace `TSI.dmDocRules`. |
| `shared/js/campaign-rules.js` (336 lines) | `TSI.campaign.summary(explorerSave, bastionSave, regions)` (lines 240 to 334) works out everything shown. Also `bastionComing` (77 to 163), `ironbowNews` (169 to 180), `untilText`, `threadDueText`, `rewardLines`, `trackedConsequences` (216 to 238). Shared with the Explorer. |
| `shared/data/regions.js` | The seven regions: label, clan, clanKey, chief, god, godName, temple. |
| `shared/components.css` lines 517 to 746 | All DM doc styling (`.tsi-dmdoc*`). `--tsi-z-dmdoc: 695` in `shared/tokens.css:198`. |
| `shared/js/shell.js` | Top-bar button (line 326); the pop-out page start (lines 663 to 670: `?dmdoc=1` adds body class `tsi-page--dmdoc-window`, sets the title, calls `TSI.dmDoc.startDocked()` and returns, so there is no top bar, no tool and no "Already open" check); `dmDocUrl()` (71 to 74); `TSI.shell.dmDocUrl` export (701). |
| `shared/js/store-rules.js` | `RESERVED_TOOLS` includes `dmdoc` (line 20); `SUITE_FAMILIES.dmdoc = 'DM doc'` (line 24); `spaceNames().dmdocOpen` (`tsi.suite.dmdoc-open`, a per-window sessionStorage flag). |
| `index.html` lines 36 to 37; `tests/harness.html` lines 40 to 41; `tests/rules.html` line 47 | Script tags that load `dmdoc-rules.js` and `dmdoc.js`. Any new shared file for the DM doc must be added to all three lists. |

### 1.2 Saves the DM doc uses

| Key | Written by | Read by | Notes |
|---|---|---|---|
| `tsi.explorer.save` | Explorer | DM doc, every 2 s while open (`EXPLORER_KEY`, dmdoc.js:37) | `travel.day`, `travel.provinceId`, `tokens[]` (the five heroes), `journey.{gold, effects, threads, expedition, blessing}` |
| `tsi.bastion.state` | Bastion | DM doc (`BASTION_KEY`, dmdoc.js:38) | `partyLevel`, `pendingOrders`, `politicalCapital`, `honourRespectByClan`, `favour`, `diplomaticRecords`, `dmEdits.done` |
| `tsi.dmdoc.layout` | DM doc | DM doc | `{x,y,w,h}` of the floating panel (dmdoc.js:35, 72 to 76) |
| `tsi.dmdoc.edits` | DM doc | Bastion (`checkDmEdits`, `tools/bastion/tool.js:4749 to 4764`, every 2 s) | The list of "Change a score" requests, newest 100 (`EDITS_MAX`). The Bastion applies each once and writes a receipt in its own save (`dmEdits.done[id]`); `R.applyDmEdits` is `tools/bastion/rules.js:489 to 518`, `cleanDmEdits` 468 to 488. |
| sessionStorage `tsi.suite.dmdoc-open` | DM doc | DM doc | Whether the floating panel is open in this window; never opens by itself in another window. |

`TSI.store.fresh(key, fallback)` (shared/js/store.js:331 to 348) reads straight from IndexedDB (database `tsi.suite`), so
a DM doc in one window sees saves made by the Explorer or Bastion in another window. This is the live refresh.

### 1.3 Live refresh

- `refresh()` (dmdoc.js:400 to 417) reads the three keys, builds the summary, and compares `JSON.stringify([summary, last 6 edits])`
  with `shownKey`. Only if different does it call `render(sum)`.
- `startReading()` (418 to 423) = one immediate read plus `setInterval(… REFRESH_MS = 2000)` that skips when `document.hidden`. `close()` stops it.
  Also re-reads straight after the window's own store saves (`TSI.store.onStatus`, line 585) and on `visibilitychange`.
- **Important for the Quest box:** `render()` (333 to 397) does `TSI.clear(body); TSI.append(body, parts)`. It rebuilds the whole body
  every time the summary changes. Anything typed into a textarea that lives in `body` would be destroyed (focus, caret, selection).
  The Quest panel's DOM must be built once and kept; only the other three panels are redrawn.

### 1.4 The pop-out

- Button "Pop out" in the floating panel's bar (`popOut`, dmdoc.js:518 to 522): `window.open(TSI.shell.dmDocUrl(), 'tsi-dmdoc-window', 'noopener,popup,width=520,height=900')`, then closes the floating panel.
  `dmDocUrl()` = `index.html?dmdoc=1` (page name taken from `location.pathname`, so it also works on `harness.html`).
- The pop-out is a full separate page load of index.html. It runs the same shared scripts, builds the same panel with class
  `tsi-dmdoc--docked` (CSS: fills the window; no grip, no Pop out button; the close button calls `window.close()`),
  `startDocked()` (592 to 604) waits for `TSI.store.ready`, builds the panel and starts reading. It never loads a tool.
- It reads and writes the same IndexedDB as every other window (same origin on `file://`), so its edits list and anything else it saves are shared.
- **Verified here (scratch `scripts/popout-reuse.js`):** with `noopener` (as now), clicking Pop out a second time opens a **second**
  DM doc window (3 pages open). Without `noopener`, the named window is reused (2 pages). `noopener` is deliberate in this
  repo (shell.js:76 to 79: otherwise the browser copies the opener's sessionStorage, including its tab id and DM-doc-open flag).
  The tools use a Web Lock (`shared/js/toollock.js`) to keep one window per tool; the same trick would work for a single DM doc window.
- Floating mode and docked mode share every line of the contents; only the frame differs. `fit()` and `onWindowChange()` return early when `docked`.

### 1.5 What it shows today (dmdoc.js `render`, 333 to 397)

One column, top to bottom:
1. **Six tiles in a 2-wide grid** (338 to 345): Party level, Day, Orders pending, Next word from the Ironbow, Party gold, Threads (count and note).
2. **Heroes**: pills of names only (347 to 349).
3. **Where the party is** (351 to 369): the Region label; a Clan card (Political Capital meter, Honour/Respect meter, the Hall's DM-tracked agreements for that Clan); a god card (Favour meter); a note if the Bastion is unsaved; agreements naming no Clan.
4. **Change a score** (`editsSection`, 278 to 300): explanation, the "Change a score…" button, the last 6 requests with Waiting / Applied / Refused.
5. **Active effects** (372 to 380): every effect as "name · whoName", text, "ends Day N · from CODE".
6. **Threads** (382 to 391): name, note, "Day N · from CODE · Follow-up due…", "When resolved: …".

`data-test` hooks used by the tests: `dmdoc-panel, dmdoc-bar, dmdoc-grip, dmdoc-close, dmdoc-popout, dmdoc-body, dmdoc-level, dmdoc-day, dmdoc-orders, dmdoc-next-word, dmdoc-gold, dmdoc-threads-count, dmdoc-heroes (section), dmdoc-where, dmdoc-region, dmdoc-clan, dmdoc-god, dmdoc-pc, dmdoc-hr, dmdoc-favour, dmdoc-tracked, dmdoc-tracked-any, dmdoc-tracked-item, dmdoc-edits, dmdoc-edit, dmdoc-edit-kind, dmdoc-edit-who, dmdoc-edit-value, dmdoc-edit-now, dmdoc-edit-list, dmdoc-edit-item, dmdoc-effects, dmdoc-effect, dmdoc-threads, dmdoc-thread`, plus the top-bar `dm-doc`.

---

## 2. Line by line: the handover against the code

### 2.1 Top left: "Party" panel

| Handover element | Exists? | Where its data comes from | What must be built |
|---|---|---|---|
| Party Level | Yes. Tile at dmdoc.js:339. | `summary.level` (campaign-rules.js:246 to 248) = Bastion `partyLevel` clamped 1 to 20, **7 until the Bastion has saved** ("Bastion not saved yet"). | Move into the Party panel. No data change. |
| Party Gold | Yes. Tile at dmdoc.js:343. | `summary.gold` (campaign-rules.js:303 to 305) = Explorer `journey.gold`, the **events' running total** the DM clears with the Explorer's Clear button (`gold-clear`). Not the Bastion's `treasuryGP`. | Move. Keep the "from events, until cleared" note (it explains why it is not the treasury). |
| Party Effects | **Partly.** Section "Active effects" lists every effect (dmdoc.js:372 to 380). | `summary.effects` (campaign-rules.js:325 to 332), from `journey.effects`. Each effect saved as `{id, name, text, who, whoName, from, day, until, untilDay}` (`cleanEffect`, explorer/journey.js:87 to 93). `who` is a **hero token id** (kaelen, umbrys, magnus, elara, charles) or `null` for the whole party; `whoName` is the name at the time ("The party" when null). Party effects are created by `applyOutcome` (journey.js:543 to 555) via `targets()` (489 to 495) which returns `[null]` for spec.who `'party'`. | The summary currently exposes only `who: whoName`; it must also carry the id. Split: `who === null` goes to Party Effects. |
| Heroes, each name listed | Yes, names only (pills). | `summary.heroes` = `tokens[].name` (campaign-rules.js:249 to 251). The five heroes are fixed from `explorer-data.js:291 to 297`; the Explorer has no hero rename or add/remove. | Change `summary.heroes` from `['Kaelen', …]` to `[{id, name, effects[]}]`. Effects match by `e.who === token.id` (not by `whoName`, so a later rename can't orphan them). |
| Beside each hero, that hero's active effects | **No.** | Same `journey.effects`, filtered by `who`. | Draw each hero as a row: name, then compact effect chips (name plus "ends Day N" / "until used"), with the full text on hover or in a second line. |

Edge cases to handle in the summary:
- An effect whose `who` is an id that is not in `tokens` (a hero-targeted effect when `vars.hero` was missing makes `targets()` return `[null]`, so it becomes a *party* effect with `whoName` "The party"; a token id that no longer exists would be an orphan). Show orphans under Party Effects with their saved `whoName` so nothing silently disappears.
- The same effect name on several heroes (events with `who: 'failed'` give one effect per failed hero): that is correct, one chip under each.
- A Great Rite the party holds (`journey.blessing`, journey.js:1212) is **not** in `journey.effects`; it is a party-wide thing that ends with the expedition. See question 3.
- The Explorer's "Pace effects" line (`effectsEl`, tool.js:225) is a different thing (walking pace) and is not in `journey.effects`.

### 2.2 Top right: "Bastion" panel

| Element | Exists? | Source | Build |
|---|---|---|---|
| Orders Pending | Yes. Tile at dmdoc.js:341. | `summary.orders = {count, next:{day,label,inDays}}` from `pendingOrders` with a numeric `dueDay` (campaign-rules.js:260 to 268). Null for a Bastion saved in turns (not v 2 or 3) or not saved. | Move. Optional: list the orders (see question 4). |
| Next Word From The Ironbow | Yes. Tile at dmdoc.js:342. | `summary.nextWord = {day, inDays, lines[]}` from `bastionComing()` after today (campaign-rules.js:269 to 273). | Move. **`bastionComing` needs pruning** (see 3.3), otherwise it announces things that no longer exist. |

### 2.3 Bottom left: "Explorer" panel

| Element | Exists? | Source | Build |
|---|---|---|---|
| Day | Yes. Tile at dmdoc.js:340. | `summary.day`, `summary.daysPassed` = Explorer `travel.day` (campaign-rules.js:257 to 259). The campaign's only clock. | Move. |
| Where The Party Is | Yes. Section at dmdoc.js:351 to 369. | Region from the Explorer's **Region box** `travel.provinceId` (not the loaded map; there is a separate warning when they disagree, `R.regionMismatch`). Clan, chief, god from `shared/data/regions.js`. PC / HR / Favour / agreements from the Bastion. | Move. The handover says only "Where The Party Is"; whether the Clan and god standing cards stay under it is question 1. |
| Change A Score | Yes. `editsSection` dmdoc.js:278 to 300, `editDialog` 228 to 275. | See 3.2. Three scores: Political Capital (-100 to 100) and Honour/Respect (-5 to 5) per Clan, Favour (0 to 100) per god (`EDIT_KINDS`, dmdoc-rules.js:115 to 119). | Move into the Explorer panel; shrink the help text and the list of recent requests so it fits; reword anything that says "Day Log". |
| Threads | Yes. Tile 344 and section 382 to 391. | `summary.threads`, `nextFollowUp` (campaign-rules.js:307 to 323), from `journey.threads`. | Move. In a smaller panel show the name and the follow-up day, with details underneath. |
| Expedition | **Not in the DM doc. The concept exists in the Explorer.** | Explorer `journey.expedition = {n, active, startedDay}` (journey.js:58 default; cleaned at 199; accessors 1146 to 1151; `startExpedition` 1153 to 1162; `endExpedition` 1165 to 1178). Buttons in the Travel box, `expedition-start` / `expedition-end` (tool.js:199, 1209 to 1251). | See 2.5. |

### 2.4 Bottom right: "Quest" panel

Nothing exists. Not to be confused with the **Notice Board Quest Generator** (`tools/quests`, keys `tsi.quests.*`); the DM doc's Quest panel is only a text box for the DM's session notes. The code and the key should avoid the word "quests" alone (suggest `tsi.dmdoc.quest`, class prefix `tsi-dmdoc__quest`).

### 2.5 The "expedition" concept: what exists and what is missing

Searched: `grep -ri expedition`. 229 hits in 31 files, but only these matter for the DM doc:

- **Exists** (Explorer, pull request 8b, EXP-45, KNOWN_ISSUES.md:1330 to 1343): the DM presses **Start expedition** / **End expedition** (Travel bags box). Make Camp and resting never start or end one. Start: `n += 1; active = true; startedDay = today`, log line "Expedition N began on Day D." End: `active = false`, log "Expedition N ended on Day D." and takes back the party's Great Rite if any.
- A Great Rite can only be given *during* an expedition (`J.assignRite`, journey.js:1194 to 1223), one per expedition; unused rites expire at End.
- **Missing: the end day is not stored.** `J.endExpedition` only flips `active` to false and writes the end day into the 100-line `journey.log` as text. For "expedition ended - day X to day Y" the record needs `endedDay`:
  - add `endedDay: 0` to `J.empty` (journey.js:58) and to `exped()`'s default (1148);
  - read it in `J.clean` (199: the expedition is rebuilt field by field, so an unknown field would be dropped on every load);
  - return it from `J.expedition` (1151);
  - set it in `J.endExpedition` (`e.endedDay = day(state)`) and clear it in `J.startExpedition`.
  - This is backward compatible: `tests/rules/shrines-explorer.test.js` (lines 62, 65, 78) checks `.active` and `.n` individually, so extra fields do not break it. No save-version bump is needed (`R.SAVE_VERSION = 1`, explorer/rules.js:31; `J.clean` tolerates missing fields).
  - For an expedition that already ended in an existing save (no `endedDay`): either parse "Expedition N ended on Day D." out of `journey.log` (newest first, at most 100 lines), or show "expedition ended" with the start day only. Suggest parsing, falling back to "Day S to the day it ended" never being invented.
- **What the DM doc line should say** (Harry's wording):
  - Active: `Expedition: began Day 4 · running 3 days` (days running = today - startedDay, never below 0; "began today" for 0; Reset Travel can make it go backwards, clamp it).
  - Ended: `Expedition ended - Day 4 to Day 9` (until the next one starts, when it is replaced).
  - Never started (`n === 0`): `No expedition yet`. Explorer not saved yet: the usual "Explorer not started".
  - Counting convention is question 2.
- Summary shape to add in `campaign-rules.js`: `out.expedition = { n, state: 'none'|'active'|'ended', startedDay, endedDay|null, daysRunning|null }`, all read-only from `journey.expedition`.
- Tests that mention it: `tests/rules/shrines-explorer.test.js` (13 hits), `tests/e2e/shrines-explorer.test.js` (18 hits). Docs: KNOWN_ISSUES.md EXP-45 (1330 to 1343), PROGRESS.md lines 58 to 59, MILITARY-DIPLOMACY-PLAN.md S9.

### 2.6 What "Change A Score" means in the current code

It is the existing "Change a score…" button (SUI-39, 19 October 2026, KNOWN_ISSUES.md:3298 to 3305). It sets **a Clan's Political Capital or Honour/Respect, or a god's Favour** to a typed whole number. The DM doc never writes the Bastion's save: it appends a request to `tsi.dmdoc.edits`; the open Bastion applies each once (`R.applyDmEdits`), logs "Political Capital for Clan X set by the DM: 0 to 15." in its Day Log, writes a receipt, and shows a notice. The list shows Waiting / Applied (with day and "was N") / Refused (with reason).
No other "score" in the code is hand-editable. So the handover's "Change A Score" = move this feature; do not add new editable scores.

Things this feature touches that the overhaul changes:
- **Day Log is being removed.** `R.applyDmEdits` calls `R.log(s, 'DM doc', line, at)` (rules.js:510 to 511; `R.log` is rules.js:55, used all over the Bastion), the Bastion's notice says "The Day Log keeps it" (tool.js:4761), the dialog text says "its Day Log records what it was" (dmdoc.js:257, 280), `guide.html:120` says the same, and `tests/e2e/dmdoc-edit.test.js:57 to 58` asserts the log line. The receipt (`dmEdits.done`) does not depend on the log, so the feature keeps working if the panel goes; only wording and that test change. Whether `state.log` itself is deleted is for the Bastion analysts; the DM doc just must not promise a Day Log.
- **Favour** is being redone as a bar that fills and resets in the Temple. The Change-a-score range 0 to 100 and the `favour` map `{telluria, aurush, pelagos}` (rules.js:126, 374) stay valid as long as the Temple keeps that map. If the Temple changes the key or range, `EDIT_KINDS.favour`, `applyDmEdits` and `campaign-rules.js:286` change with it.
- **Clan Influence panel is being removed** but Political Capital and Honour/Respect stay as data (the Hall keeps them). The DM doc reads `politicalCapital` and `honourRespectByClan` directly, so it is unaffected. The Explorer-to-Bastion Honour/Respect messages currently say "Clan Influence lists them" (tool.js:4687, 4689): not DM-doc work but the same removal.

---

## 3. Data and code changes needed

### 3.1 `TSI.campaign.summary` (campaign-rules.js)

- `heroes` becomes `[{ id, name, effects: [{ id, name, text, until, from }] }]` (was an array of strings). Breaks `tests/rules/campaign.test.js` (lines 49 to 80 and the effects tests at 193 to 211) and `tests/e2e/dmdoc.test.js` (`heroes`, `effects`).
- Add `partyEffects` (same shape; `who === null` and orphans). Keep `effects` (all) so nothing else breaks.
- Add `expedition` (2.5).
- Optional: `orders.list` (question 4).
- Keep `region`, `clan`, `god`, `clanTracked`, `trackedAnywhere` as they are (question 1).

### 3.2 Quest text: save, size, backup, pop-out

- **Key:** `tsi.dmdoc.quest`. Matches the key pattern (verified: `^tsi\.[a-z][a-z0-9-]*(\.[A-Za-z0-9_-]+)+$`), is in the existing `dmdoc` family, so it is covered by Back up everything and Restore with **no change** (verified in a scratch run: `TSI.store.freshAll()` returned it). The backup summary lists it under "DM doc: N saved items".
- **Value:** `{ text, at }` (`at` = time of the last edit, used to tell which window's copy is newer).
- **Not in** the campaign file (`CAMPAIGN = ['explorer','bastion']`, backup-rules.js:35) or any tool's Export/Import, because the DM doc is not a tool. CLAUDE.md asks for per-tool Export/Import; the DM doc's other saves (layout, edits) already have none. Cheap addition: a "Save as text file" button using `TSI.download` (core.js:147).
- A Restore from a backup made before this change has no `tsi.dmdoc.quest`, so `TSI.store.replace({all:true})` deletes the Quest text (store.js:451 to 456). Worth one line in the guide.
- **Size:** IndexedDB has no practical limit (verified: 672,000 characters saved in about 130 ms and read back from another window). The risk is the fallback: if the browser database cannot open, the store falls back to localStorage, about 5 million characters for the whole suite (docs/PLAN.md:788). Suggest a cap of 200,000 characters (a very long session file is about 30 to 40k words), with a plain message when pasted or imported text is longer: `QUEST_MAX` in dmdoc-rules.js plus `cleanQuest(raw)`.
- **Saving:** debounce about 400 ms after typing (`TSI.store.set` itself groups writes after 120 ms but does a full JSON copy of the value each call, fine at 200 KB); commit immediately on `blur`, `pagehide`, and `visibilitychange` to hidden, so closing the pop-out mid-sentence loses nothing. `store.js` already flushes pending writes on pagehide (lines 491 to 494), but only writes that have been `set`.
- **Two windows editing:** possible because a second Pop out opens a second window (2.4), and the floating panel can be reopened while a pop-out exists. Rules:
  - last writer wins, but never overwrite the box while it has focus;
  - read the key only when the panel opens, on window focus and on `visibilitychange`, **not** in the 2-second loop (that would clone a 200 KB value every 2 s for nothing);
  - if the stored `at` is newer than this window's last-seen `at` and the box is not focused, show the newer text; if the box has unsaved typing, keep it and say so.
  - Better, remove the cause: allow one pop-out at a time with a Web Lock like `toollock.js`, or drop `noopener` for this one window so the named window is reused (see 1.4).
- **Never shared:** a session file contains the DM's secrets. Nothing may send the `tsi.dmdoc.*` family to players: the postMessage player windows, the Beast Handler phone link (the handover wants a new online link; that is another area, but its payload must be built from an allow-list, never "everything under tsi."), the Knightly Treasures link. Add a rules test that `tsi.dmdoc.quest` is excluded from any phone-link projection (see `tests/rules/beasthandler-projection.test.js`, which already tests that `dmEdits` secrets never leak).
- The box is a plain `<textarea>` (spellcheck on, `lang="en-GB"` from the page); text only goes in with `.value`, never `innerHTML`, so imported text cannot inject markup.

### 3.3 `bastionComing` and the removed Bastion features (feeds "Next word")

`TSI.campaign.bastionComing` (campaign-rules.js:77 to 163) is shared with the Explorer's "The Ironbow sends word…" (explorer/rules.js:787), so changes here change both tools and `tests/rules/campaign.test.js` (110 to 155), `creatures.test.js:936 to 954`, and the Explorer tests. Branches that the overhaul makes dead or wrong:

| Lines | Branch | Problem after the overhaul |
|---|---|---|
| 93 to 94 | `facId === 'war_council'` or `meta.kind === 'war_action'` | War Council and war games are removed. |
| 95 | `hall_of_emissaries` orders that are not upgrades or `register_port_charter` become "needs your roll" | The Hall has no orders and no upgrades any more; Register Port Charter moves to the Dock, so that exclusion would stop working and Dock charter orders (facId `dock`) are already "complete" lines. Probably delete the branch. |
| 104 to 113 | `diplomacy.agreements / arbitrations / consortiums / delegations / summits` "has ended" lines | Host Delegation, Secure Writ, Inter Clan Summit and Trade Consortium are removed. Old saves may still hold these records; announcing the end of something that can no longer be seen or resolved is noise. |
| 117 to 124 | `warRecovery` ("fit to fight again", "found the way back") | Wars, military and creature war-recovery go; beasts are no longer defenders. |
| 125 to 132 | `tradeNetwork.routes` "sea route needs a roll" | Routes panel moves to the Dock. Keep only if the Dock keeps rolling route risks (another analyst's call). |
| 153 to 157 | `wars` "may attack: the Bastion rolls" | Wars removed. |
| 37 to 43 | `FACILITY_NAMES` | Library & Scriptorium id removed; add names for the new Temple, Beast Pit, Workshop ids as they are decided. The fallback title-casing of the id still works for plain ids. |
| 84 to 86 | "The X is built." | Fine as is. |

`ironbowNews` and `summary.nextWord` need no code change. Keep reading old v 2 / v 3 saves safely (`inDaysSave`): a Bastion saved before the overhaul will still carry war and diplomacy arrays, which should simply be ignored.

New things the forecast could announce (optional, ask only if Harry wants them): a beast's bonding milestone (the handover says the Bastion shows a notification to start a DM event when a pill fills), the 3-day Acclimatise retry lock ending.

### 3.4 Layout and sizing

- Floating panel defaults `DEFAULT_W 440`, `DEFAULT_H 800` (dmdoc-rules.js:23 to 24) are for one column. A 2 x 2 layout wants roughly 1040 x 640 on the laptop (usable 1707 x 874 under the 56 px top bar) and on the TV (1920 x 1080). Tests pin the old defaults: `tests/rules/dmdoc.test.js:16 to 24` (440 x 800), `tests/e2e/phase1.test.js` (lines 438 to 720: geometry, drag, resize, minimum 280 x 200, bar grab positions, `Party level` text at line 522, z-index 695, focus return).
- The pop-out opens at `width=520,height=900` (dmdoc.js:520): portrait. Change to landscape, for example `width=1100,height=760`.
- **Old saved layouts:** anyone who has moved or resized the panel has `tsi.dmdoc.layout` = 440 wide saved. It would reopen as a narrow box. Add a version field to `toSaved` / `fromSaved` so an old shape is ignored once, or make the grid collapse to one column when the panel is narrower than about 760 px (container query on `.tsi-dmdoc`, supported in Edge/Chrome 105+, Firefox 110+; or a JS class set in `place()`). Do both: collapse is also the right answer for the minimum 280 px width.
- Grid: two columns, two rows, `grid-template-rows: auto minmax(0,1fr)`; each panel scrolls on its own (`overflow:auto`); the Quest textarea fills its panel (`flex:1`). Panel look = existing `tsi-panel` / card tokens (thin gold border, soft glow); headings in the display font, body text sentence case (CLAUDE.md look rules).
- `.tsi-dmdoc__meter` has a fixed `9.5em` label column (components.css:665) that will be tight in a half-width panel; check at 1707 and 1920.
- Existing CSS to retire or reuse: tiles (`__tiles`, `__tile*`), `__heroes` / `__hero` pills, `__sec`, `__h`. Reuse: `__card`, `__meter*`, `__effects` / `__effect*`, `__tracked*`, `__edit`, `__bar`, `__grip`, `--docked`.
- Keyboard: tools bind global shortcuts (Battlemap Space, War Table arrows, Bastion Escape). All of these check `TSI.keys.isTyping(e)`, element containment, or only react to Escape while their own picker is open, so typing in the floating panel's textarea should be safe; add one e2e check typing a space and arrow keys into the Quest box on top of the Combat Tracker and the Explorer.

### 3.5 Importing a session file (PDF or DOCX): feasibility, tested

All of this was run in headless Chromium from `file://`, offline (`context.setOffline(true)`), using real files; scripts in `scratchpad/analysis/scripts/`.

**PDF: use the PDF.js already in the repo.**
- Files: `shared/lib/pdfjs/pdf.min.js` (377,116 bytes) and `pdf.worker.min.js` (1,133,660 bytes), PDF.js **3.11.174**, "legacy" build, taken unchanged from npm `pdfjs-dist@3.11.174`.
- Licence: **Apache 2.0**, `licences/pdfjs-Apache-2.0.txt`, listed in `licences/README.md` ("PDF.js (phase 7)", SHA-256 `978fd1b2…aa6c` and `38cde531…96f2`). Mozilla notice is in the file headers. Attribution is already done; if the DM doc becomes a second user, change the README line "Only the Combat Tracker loads them" to name both.
- How the Combat Tracker uses it (`tools/encounter/tool.js:612 to 648`): `TSI.loadFiles({ js: ['shared/lib/pdfjs/pdf.min.js', 'shared/lib/pdfjs/pdf.worker.min.js'] })` loads both as plain script tags **only when a PDF is chosen** (so no cost otherwise; `tests/e2e/phase7.test.js:238` asserts `window.pdfjsLib` is undefined until then). Then `pdfjsLib.getDocument({ data: arrayBuffer })`, per page `getTextContent()`. Loading the worker file as a script makes PDF.js run its "fake worker" on the main thread, which is the only thing that works from a double-clicked file (docs/PLAN.md:795; console prints a harmless "Setting up fake worker" line). No `workerSrc` is set.
- The tracker joins text items with a space, **which loses line breaks**. The DM doc needs its own small extractor that uses each item's `hasEOL` flag (present in 3.11.174; 182 of 329 items in the handover PDF carry it) and puts a blank line between pages.
- **Proved in the DM doc's own window** (`scripts/pdf-in-popout.js`): in `index.html?dmdoc=1`, offline, `TSI.loadFiles` for the two scripts, a file chosen through a real file input, `file.arrayBuffer()`, then extraction. The 5-page strip-back handover returned 12,246 characters in 472 ms (about 150 ms once the scripts were cached), no page errors, no network requests.
- No canvas is used (text only), so the CLAUDE.md rule about tainted canvases does not apply.
- Limits to tell the user plainly: a scanned PDF (pictures of pages) has no text and returns an empty string ("this PDF has no text I can read; it may be a scan"); password-protected PDFs throw; very large PDFs take a second or two (show "Reading…" and block double-clicks with `TSI.oneAtATime`).
- Footprint: the two scripts stay loaded in that window until it closes (they cannot be unloaded) and add a `window.pdfjsLib` global. In the pop-out that is harmless. In the floating panel on top of a tool it adds 1.5 MB of parsed script to that page. Acceptable; alternatively offer Import only in the pop-out. Mention in the plan.

**DOCX: write a small reader; no library needed.**
- A .docx is a zip file; the text is in `word/document.xml`.
- Tested (`scripts/docx-test.js`): in `file://` Chromium, `typeof DecompressionStream === 'function'`, `isSecureContext === true`. The reader finds the zip's end record, walks the central directory, takes the entry's compressed bytes, and inflates them with `new DecompressionStream('deflate-raw')` through `new Response(new Blob([bytes]).stream().pipeThrough(ds))`. It then parses with `DOMParser` and walks `w:p` paragraphs (`w:t` text, `w:tab`, `w:br`), table rows / cells (joined with tabs), and treats paragraphs with `w:numPr` as bullets. Deleted tracked-change text (`w:delText`) is naturally skipped.
- Results: `0816e28a-Ironbow_War_Room_Training_and_Upgrades_Proposal.docx` (19 zip entries): 116 lines, 10,657 characters, 48 table cells, **20 ms**. `8a0bf7fd-Scarlett_Isles_Master_Suite_Handover_1.docx` (25 entries): 257 lines, 52,878 characters, **28 ms**. Output read correctly (headings, a table rendered as tab-separated rows).
- Browser support: `DecompressionStream` with `'deflate-raw'` is in Chrome / Edge 103+, Firefox 113+, Safari 16.4+. Edge at the table is far newer. If the constructor throws, show "This browser can't open Word files; paste the text instead" (the paste box always works).
- Not covered by the simple reader (fine for session notes; say so): headers and footers, footnotes, text boxes, comments, images, formatting. ZIP64 (files over 4 GB) and encrypted documents are not supported; an old binary `.doc` or a password-protected file is not a zip and gets a plain "that isn't a .docx" message. Keep the size sensible (reject files over about 20 MB before reading).
- Where to put it: a plain-function file such as `shared/js/doc-text.js` (zip walk and XML to text separated, so the XML part is testable without a browser zip), lazy-loaded with `TSI.loadFiles` only on first import, plus one more script tag in `index.html`, `tests/harness.html`, `tests/rules.html` if it is loaded eagerly.

**Alternatives considered (all fetched with `npm pack` and measured here):**

| Option | Size | Licence | Verdict |
|---|---|---|---|
| Hand-written reader + `DecompressionStream` | about 4 KB of code, 0 bytes of library | n/a | **Recommended.** Nothing to bundle, nothing to credit, runs offline, proved. |
| JSZip 3.10.2 (`dist/jszip.min.js`) | 97,781 bytes | MIT **or** GPL-3.0 (choose MIT) | Good fallback if a browser lacks `deflate-raw`. Needs a licence file in `licences/` and a README row. |
| fflate 0.8.3 (`umd/index.js`) | 33,044 bytes | MIT | Smallest library; the same. |
| mammoth 1.13.0 (`mammoth.browser.min.js`, includes its own zip reader) | 405,060 bytes | BSD-2-Clause | Converts to clean HTML / plain text with headings and lists. Overkill for a text box; bigger than the Beast Handler's whole script set. |
| pako 3.0.2 | about 2.5 MB unpacked | MIT AND Zlib | Not needed. |

CLAUDE.md compliance: no CDN, no ES modules, no `fetch()` of local files, no build step, no service worker; user-chosen files are read with `FileReader` / `file.arrayBuffer()` (allowed). The file picker helper `TSI.pickFile(accept)` (core.js:159 to 174) already exists and handles Cancel. "Safe imports: always asks before replacing anything" applies: if the box already has text, ask Replace / Add to the end / Cancel before importing.

Text clean-up after extraction (plain function, tested): strip a BOM and NUL / control characters, normalise `\r\n`, collapse runs of more than two blank lines, trim, enforce `QUEST_MAX`. Also accept `.txt` / `.md` with `FileReader.readAsText` for free (`TSI.readFileText`, core.js:176).

### 3.6 Pop-out window and persistence

- The pop-out is a normal page, so a text saved there is in the same IndexedDB as everything else. Verified: saved 672,000 characters from the pop-out page, `TSI.store.fresh` in the main window saw all of it, and a brand-new `?dmdoc=1` page opened after the first was closed had it from `TSI.store.get`.
- The pop-out does not run `TSI.tabGuard`, `toolLock` or any "Already open" check (shell.js:663 to 670) and does not call `TSI.store.onStatus(showSaveStatus)`; it has no top bar, so it has no "Saved ✓" indicator or storage warning. The Quest box needs its own small "Saved" / "Not saved" status text, and should report a failed save (`TSI.store.onStatus` gives `state 'failed'`, `reason`).
- Store-fallback modes: IndexedDB (normal), localStorage (5 MB shared), memory (nothing persists). In memory mode the Quest panel must say plainly that typed text will not survive closing the window (`TSI.store.mode === 'memory'`; the Explorer does the same for Great Rites, journey.js:1199).
- Closing the pop-out: `pagehide` flushes the store. Add the Quest commit to that path.

---

## 4. Tests, docs and other places that mention the DM doc

Rules tests (`tests/rules.html`, run through `tests/runner.js`):
- `tests/rules/dmdoc.test.js` (136 lines): pins `defaultRect` = 440 x 800 (line 19), geometry, `toSaved` / `fromSaved`, family key tests, backup summary "DM doc: 1 saved item". Update sizes; add Quest key / `cleanQuest` / size-cap / import-clean-up tests.
- `tests/rules/dmdoc-edits.test.js` (91 lines): `applyDmEdits`, receipts; asserts the Day Log line and count at lines 47 to 51 (`s.log`). Revisit only if `R.log` / `state.log` goes.
- `tests/rules/campaign.test.js` (295 lines): `summary` shapes. Needs the new `heroes`, `partyEffects`, `expedition`, pruned `bastionComing` cases (82 to 155).
- `tests/rules/shrines-explorer.test.js`: add `endedDay` set / cleared / survives save / old-save fallback.
- `tests/rules/creatures.test.js:936 to 954`: asserts `bastionComing` lines for House orders and creature recovery (both go).
- `tests/rules/beasthandler-projection.test.js:182`: model for a "Quest text never leaves" check.

End-to-end (`tests/e2e/`, Playwright, `H.newContext(browser, 'laptop' | 'tv')`):
- `dmdoc.test.js` (344 lines, 11 checks): rewrite the `doc()` reader and every assertion for the four panels; keep the scenario flow (empty, Bastion, Explorer, Region change, tracked agreements, effect appearing and going on Day 8, gold and Threads, change in another window, no reading while closed, laptop and TV fit). New checks: a hero effect appears beside the right hero and a party effect under Party Effects (use C6 for a party effect; find an event that targets one hero), Expedition active / days running / ended line, Quest typed, reloaded, survives a re-render, saved from the pop-out and seen in the floating panel, PDF import, DOCX import (build a small docx fixture in the test: a stored-method zip is enough, or compress with Node `zlib.deflateRawSync`), Replace / Add prompt, over-limit message, no network requests.
- `dmdoc-edit.test.js` (106 lines): Change a score and Pop out; change the Day Log assertions (lines 51 to 66); the pop-out size check; add "second Pop out does not open a second window" if that is fixed.
- `phase1.test.js` lines 438 to 720 (DM doc geometry, drag, resize, z-order, focus, open per window, reopen after switch): new default size and a version bump of the saved layout.
- `bastion-screen.test.js:113 to 135`: a Bastion notice must stay clear of the DM doc's left edge when it opens "on the right"; the wide default changes where it opens, so this check changes.
- `guide.test.js` / `guide.html:120`: the DM doc paragraph (long, lists every tile; rewrite for the four panels, the Quest box and imports; remove "Day Log").
- `tests/e2e/README.md` lines 34 and 41; `docs/PROGRESS.md`, `docs/KNOWN_ISSUES.md` (new SUI entry; SUI-21, 22, 23, 38, 39 entries describe the old layout), `docs/BASTION-EXPLORER-REFERENCE.md` lines 67, 1573 to 1608, 1703, 1847 to 1849, `docs/PLAN.md:375`, `licences/README.md` (PDF.js line, plus JSZip only if added).
- `tests/e2e/helpers.js` has the two screen sizes (laptop 1707 x 930 at 1.5, TV 1920 x 1080 at 1); both must show all four panels with no sideways scroll and the Quest box usable.

---

## 5. Build plan (suggested order)

1. Explorer: add `expedition.endedDay` (journey.js 58, 199, 1146 to 1178) plus tests.
2. `campaign-rules.js`: new `summary` fields; prune `bastionComing` in step with the Bastion work; tests.
3. `dmdoc-rules.js`: Quest rules (key, cap, clean-up, merge by `at`), new default size, versioned layout; tests.
4. `dmdoc.js`: split into per-panel builders (`partyPanel`, `bastionPanel`, `explorerPanel`, `questPanel`); the Quest panel built once and kept across `render()`; reuse `editDialog`; remove the six tiles and flat sections.
5. `components.css`: 2 x 2 grid, hero rows with effect chips, collapse to one column when narrow, Quest textarea filling its panel.
6. Import: PDF extractor with `hasEOL`, DOCX reader, `.txt` / `.md`; lazy loading; prompts; messages.
7. Pop-out: wider window; one at a time (lock) or named reuse.
8. Update the Bastion's "Day Log" wording where it mentions the DM doc (tool.js:4761), the dialog text, the guide.
9. Tests, docs, guide.

Size: DM doc rewrite about 600 lines of JS and 150 lines of CSS; the rules about 120; DOCX reader about 120; PDF wrapper about 50; test rewrites are the larger part (two e2e files and three rules files).

---

## 6. Contradictions, ambiguities and cross-area notes

1. **The "=== page 1 ===" line before "Top left panel" is not Harry's text.** It is a marker added by the PDF extraction (`scratchpad/pdf/extract.js` writes the marker at the *end* of each page). The DM doc layout starts at the top of PDF page 2. There is no instruction about multiple DM doc pages; it is one screen of four panels.
2. **"The DM Doc is now a pop out"**: it is both a floating panel and a pop-out today. The handover never says to remove the floating one. Keep both (question 6).
3. **Party Gold** is the same word as the existing tile (the Explorer's event gold), not the Bastion treasury. Kept as is. PROGRESS.md:971 offered Harry the Bastion's treasury as an addition and he has not asked for it.
4. **Day Log vs Change a score**: see 2.6. The handover's removal list does not mention that the DM doc's score edits and the DM-doc notice are written into the Day Log.
5. **Favour of the Gods panel removed, Favour kept in the Temple**: the DM doc's god card ("Favour 35%") and Change-a-score Favour stay valid only if the Temple keeps `state.favour = {telluria, aurush, pelagos}` in the 0 to 100 range. Flag to the Temple analyst.
6. **Great Rites and expeditions**: the new Temple's "Receive Blessing" list includes "Great Rite of Pelagos", but today a Great Rite only reaches the party when the DM gives it during an expedition, then it expires at End expedition. If the Temple's Receive Blessing replaces that flow, the expedition line stays a pure DM tracker, and `journey.blessing` / the Explorer's "waiting at the Ironbow" box need a decision elsewhere. The DM doc should not depend on the outcome except to show a held Great Rite (question 3).
7. **Removed Hall orders** change `bastionComing` (3.3), and therefore also the Explorer's "The Ironbow sends word…" text.
8. **Beast bonding notification**: the handover puts it in the Bastion ("a notification is produced in the Bastion prompting the DM"). Nothing says the DM doc shows it. If the DM works from the pop-out on another screen, they may never see a Bastion notification; showing "a bond is ready for sign-off" under Orders Pending is the obvious place. Not requested, so not planned.
9. **"Players can't see it"**: Harry says the pop-out is perfect because the players can't see it. The TV is the players' screen; the DM doc is meant for the laptop or another private screen. The layout must still work on both sizes (CLAUDE.md), but nothing about the DM doc may ever be put into a player-view window, the Beast Handler link, or the Knightly Treasures link (see 3.2).
10. **"Remove … Events"** from the Bastion interface is "Bastion Events" (the automatic event every 28 days). `BASTION_EVENT_EVERY = 28` and the "A Bastion event is due" line in `bastionComing` (campaign-rules.js:158 to 161, summary comment line 67) should go with it, otherwise the DM doc and the Explorer keep announcing an event that can no longer be rolled.

---

## 7. Questions for Harry

(Also returned in the structured summary.)

1. Under "Where The Party Is", keep the Clan's Political Capital and Honour/Respect, the god's Favour, and the open Hall agreements for that Clan? The handover lists only the place. Default: keep them (the DM needs the current numbers to know what Change A Score will change), in a compact form under the region name.
2. How should "days running" count? Default: today's day minus the start day (began Day 4, now Day 7 = "running 3 days"; "began today" on the same day), like the Explorer's "days passed". The ended line reads "Expedition ended - Day 4 to Day 9" and stays until the next expedition starts.
3. Show the Great Rite the party is holding as a Party Effect line? Default: yes, one line ("Earth's Endurance, ready" or "used"), because it is a party-wide effect that ends with the expedition. It is not in the Explorer's effects list today. (Depends on what the new Temple does with Great Rites.)
4. Under Orders Pending, add a short list of the orders (name and the day each completes, next first, up to 5)? Default: yes. The handover only says Orders Pending; today it shows the count and the next day.
5. Quest box behaviour: a single box (not one per session); when it already has text, Import asks Replace / Add to the end / Cancel; a "Clear" button that asks first; a "Save as text file" button; capped at 200,000 characters. Default: all of this. Say if you want several saved notes (one per session) instead.
6. Keep the floating in-page DM doc as well as the pop-out, and allow only one pop-out window at a time (a second click brings up a message instead of a second copy)? Default: yes to both. The pop-out would open wider (landscape) for the four panels.
