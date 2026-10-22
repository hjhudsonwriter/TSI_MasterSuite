# S02 and S05 built: replacement surfaces, and Bastion Events removed

Steps S02 and S05 of the Strip Back Overhaul (`docs/STRIP-BACK-PLAN.md`; design in `docs/strip-back/J-cross-cutting.md` sections 4 and 8.1, `B-panels-war.md` sections 2.2, 2.4, 2.5, 4 and 8). Branch `lane-a`, two commits (S02 first, then S05). Nothing here touches the war game, the Clan Influence panel or the Day Log panel: those are later steps.

## S02: replacement surfaces

**What was built**

- **Management has a "Changes from the Explorer" box** (above the Defenders and Military boxes; `data-test=explorer-changes`, rows `explorer-change` with `data-result` and `data-kind`). It lists every change the Explorer link has delivered, newest first: the newest ten, with a "Show all N" button (and "Show only the newest 10" to fold it again). Each row has what it was (for example "Clan Slade +1 (0 → +1)", "Port Charter: Goldport (Clan Molten)", "Parcel collected: Slade’s Muster", "Creature granted: Griffin (Swiftwing)", "Great Rite: Tide's Passage went with the party"), the day, the Explorer's own words and, for anything refused or skipped, the reason, plus what to do about a skipped one.
- **It reads the same receipts as the old Clan Influence list** (`state.bridge.done`, through `R.bridgeHistory`). The old panel and its list are untouched and still work; a later step (S10) deletes them. Nothing was added to the save.
- **Rules (plain functions, `tools/bastion/rules.js`, beside `R.bridgeHistory`):**
  - `R.bridgeChange(state, data, receipt)` and `R.bridgeChanges(state, data)`: one receipt said as `{ id, result, kind, head, day, dayText, text, why, tail }`. A skipped or refused receipt always has a reason (its own, or a plain one if an older copy left it empty). Pure: it never touches the save.
  - `R.settledNotices(result)`: the notices an applied Explorer message calls for, as data for `TSI.notify`.
  - `R.resolveNotice(lines, orderId)`: the notice for an order settled with Resolve.
  - `R.applyInbox` now also returns `refusals` (one sentence with its reason for each change it could not use) and `skips` (one sentence for each kind of change skipped because it was sent before the Bastion started). Nothing that read its old result is affected.
- **Notices (the Bastion's own `notice` helper, `TSI.notify`):**
  - A change the Bastion cannot use now has its own warning notice ("Not used.") that says why. Before, the notice said "Clan Influence says why" and was shown only when no other change was applied in the same moment (they shared one id, so the later notice replaced the earlier one). The refusal notice has its own id, so both can show. More than three refusals show the first three and count the rest.
  - Changes skipped because they were sent before the Bastion started are told in a notice ("Skipped.") with the reason and what to do; before, only the Day Log said so.
  - The applied notices now say "Changes from the Explorer, in Management, lists it." instead of "Clan Influence lists it." (the old panel is still there, and lists it too).
  - An order finished with Resolve (a Shrine's prayer roll, a craft, an order whose home has gone, a blocked Hall action) says what it did in a notice ("Order resolved."), as well as in the Day Log. Orders completed as a day passes still go into "The Ironbow sends word…" and get no extra notice.
- **E2E readers switched:** `tests/e2e/bridge.test.js` (`influenceRows` is now `changeRows`, reading the new list; the skipped row now expects the DM doc wording), `commerce.test.js`, `courier.test.js` and `creatures.test.js` (each opened Clan Influence and read `[data-test=bridge-row]`; they now open Management and read `[data-test=explorer-change]`). `hall-records` has no reader of the list. The Clan Influence checks in `bastion-screen.test.js` and `phase9.test.js` are about Political Capital, Honour/Respect and Favour Tokens, not deliveries, so they stay with the old panel.
- **New coverage:** 18 rules tests (`tests/rules/bridge.test.js`, last group) and three click-through checks in `tests/e2e/bridge.test.js`: a refused change (notice with its reason, a warning, no mention of Clan Influence, the row says Refused and why), the "Show all" button over ten rows, and Resolve giving a notice (and still writing the Day Log line).
- **Guide:** the two places that said "Changes from the Explorer in Clan Influence" now say Management, and Resolve is said to give a notice.

**Decisions made without asking**

- The list is **newest ten, "Show all" for the rest** (the old list was the newest ten with no way to see more).
- Wording of the tail for a skipped Honour/Respect change is "Use Change a score in the DM doc if it should count." (the old panel said "Type it in above", which points at the typed box that goes with Clan Influence). The tail is only for skipped changes, as before; a refused change has none.
- The Day Log lines that still say "Clan Influence lists it" (written by `R.applyInbox` in the fresh-start skip branch) were **not** reworded: their text is asserted by tests and the Day Log itself goes in S18.
- The Explorer's own "Sent to the Bastion" line for a skipped Honour/Respect change ends "Type it in by hand if it should count." (`shared/js/bridge-rules.js`). It is the Explorer's wording, and Change a score is also typed by hand, so I left it; reword it in S10 if Harry prefers.
- The old list's heading code in `tool.js` (`renderBridge`) was left as it is rather than made to use `R.bridgeChange`, so S10 can delete it whole.

## S05: Bastion Events removed

**Removed**

- The Events panel (`eventCard`, `eventBox`, `eventNext`, `openEvents`), its bottom-bar button (left side is now Warehouse, Management, Day Log), its icon, `onRollEvent`, the `renderTop` event block, the `openerFor` / `reveal` entry.
- `R.rollEvent`, `R.resolveEvent`, `R.isEventDay`, `R.nextEventDay`; the automatic block in `R.finishDay` (it is now `R.finishDay(state)`: it only keeps the day's news for "The Ironbow sends word…"; the old `data`, `events`, `rand` and `now` arguments are gone); `lastEvent` and `lastEventDay` from `R.defaultState`, `R.fromSave` and `R.shiftDays`; `R.time().eventEvery` and `bastion-data.js` `time.eventEvery` (and its comment).
- `tools/bastion/data/events-data.js` (deleted with `git rm`), its two lines in `shared/data/tools.js` (Bastion and Beast Handler manifests; the Explorer manifest never listed it) and its line in `tests/rules.html`; `events: D.bastionEvents` in the data object of `tool.js`, `tools/beasthandler/tool.js` and `strip-back-rules.js`; the same stale entry in 26 test files (mechanical).
- `BASTION_EVENT_EVERY` and the "A Bastion event is due." line of `TSI.campaign.bastionComing` (`shared/js/campaign-rules.js`). The DM doc's "Next word from the Ironbow" and the Explorer's "The Ironbow sends word…" no longer announce an event every 28 days.
- `.tsi-bas-event*` CSS (two blocks), and the guide's two mentions (the bottom-bar list and the "every 28 days a Bastion event is rolled" sentence).

**The migration step: `dropEvents`** (`tools/bastion/strip-back-rules.js`, first in `R.stripBackSteps`, above `sweepFacilities`; `finish` stays last):

- Drops `lastEvent`, `lastEventDay`, and (belt and braces) `pendingEvent`, `dayInProgress.event` and `dayInProgress.pendingEvent`. The current code never kept a pending event record or an event stage (the day flow has only the stages `trade` and `orders`), so the last three never occur in a real save; they are handled so a save from any copy comes out clean.
- A save that never rolled one leaves **no trace**: empty fields (`null` and `0`, which every version 3 save has) are not carried over and nothing is said; the output is identical to the same save without the fields. Only a record that really held an event (or the day of one) is a leftover, and gets one plain-English line under a new heading "Bastion events": "The Bastion no longer has events, so the last one it rolled (Friendly Visitors, Day 29) is not kept. It was only a note for you; nothing in it changed the Bastion's numbers." That line makes the report "changed", so the full box shows rather than the one-line version. The short summary gains "the Bastion's event record was dropped".
- `state.word` (the Ironbow's news, including an old "Bastion event: X (rolled N)." line) is never touched: that is history, and the audit's I6 checks it.
- Pure and idempotent; the audit is clean on every fixture. A version 4 save that an older copy of the suite put an event back into is found by `detect` and cleaned again with the short "tidied again" notice. `R.fromSave` drops the fields on every load.
- The heavy fixture's event is now in the real shape (`{ roll, name, lines, at, day }`, Day 29) and `make-heavy.js` ignores the two fields in its "loading drops nothing" check (they are dropped on purpose); `bastion-v3-heavy.json` and `bastion-fixtures.js` were regenerated (only those lines differ).

**Tests:** 10 new rules tests (`strip-back.test.js`, last group), the registry test now expects `['dropEvents', 'sweepFacilities', 'finish']`, the "S01 changes nothing" test now allows the event record and expects exactly one line for the heavy fixture. `bastion.test.js`: the d100-table test and the Compendium group's event test deleted, the automatic-event test replaced by "no Bastion event comes any more" (Days 29, 57, 85 pass like any other day; the four rules are gone; `finishDay` rolls nothing), the event content count and the `lastEventDay` save line removed. `campaign.test.js` and `explorer.test.js`: Day 29's forecast line removed (and a test that none is ever forecast). `bastion-campaign.test.js`: `finishDay` calls. E2E: `phase9` (Day 29 passes with no event and no Events button; the "Roll Bastion Event" check deleted; the layout list now uses the Day Log button), `bastion-screen` (the bottom bar has no Events button; the panel list), `dmdoc` ("Next word" after Day 8 reads "— nothing due"). `phase8` (Make Camp word) needed no change.

**Not touched / left on purpose**

- The war game's own "Defend Bastion" event (`war-campaign-rules.js`, `war-table.js`, the War Council panel, `tests/rules/bastion-campaign.test.js` group "the Defend Bastion event", `phase9` "Wars, the Defend Bastion event…"): it shares no code with Bastion Events (checked: nothing in it calls `rollEvent`, `lastEvent` or the table). It goes with the war removal.
- The shrines' data still says a blessing is "Not available yet: no Bastion event damages a facility by natural causes yet" (`facilities-data.js`, asserted by `shrines.test.js` and `bastion.test.js`). It is still true; it goes with the shrines in S11.
- `docs/BASTION-EXPLORER-REFERENCE.md`, `docs/PROGRESS.md`, `docs/KNOWN_ISSUES.md` (older entries), `docs/BASTION-OVERHAUL.md`: still describe Events as history; the docs steps (S20, S21) own them. `docs/KNOWN_ISSUES.md` and `docs/PROGRESS.md` were not edited (see `S02-S05-known-issues-draft.md`).
- The Day Log is untouched: `R.log` lines for `applyInbox` still say "Clan Influence lists it" (S18).

## Gates (each run on its own)

S02: rules page 1,384 pass; phase9 124; bastion-screen 55; bastion-days 16; dmdoc 41; bridge 33; phase1 128; guide 21; commerce 27; courier 27; creatures 32; phase8 77 of 78.
S05: rules page 1,393 pass; phase9 123; bastion-screen 55; bastion-days 16; dmdoc 41; bridge 33; phase1 128; guide 21; migration-v4 22 (after editing it: the heavy fixture now has an event to drop, so its "one line" box check uses a heavy Bastion with no event, and the box check expects the extra "Bastion events." line); phase8 77 of 78; also beasthandler 17, beasthandler-meet 30, wyvern-bonding 10, creatures 32, commerce 27, courier 27, session-safety 6, hall-records 10.

Three failures that are **not** from this work (each fails identically on the base commit b542153, run in a temporary worktree and removed):
- `phase8`: "Compared with the old Explorer" needs `_legacy/scarlett-isles-explorer`, which a worktree does not have.
- `beasthandler-write`: "all fifteen painted portraits load" (buckbear/broadcrown is 1024 wide, fellcat/lichenback 720 wide). Step S03's pictures.
- `dmdoc-edit`: "closing the pop-out straight after typing loses nothing" (the Quest text lacks "Last words."). Step S16's pop-out timing.

## Not run

Firefox, real Edge, a real second screen.
