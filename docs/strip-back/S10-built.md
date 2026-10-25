# S10 built: the Clan Influence and Day Log panels are gone

Branch `panels` (backup ref `wip-panels`), from main at db85b56.

## What went

- The **Clan Influence** panel and its bottom-bar button: the Political Capital bars, the typed Honour/Respect box, the Honour Change button, the Support number (`R.supportForClanKey` and its test deleted), the Favour Tokens counter, and the in-panel Changes from the Explorer list (that list has lived in Management since S02; nothing was lost). The `.tsi-bas-influence*`, token-pill and PC-bar CSS went too.
- The **Day Log** panel, its button, Clear log, `logCard`, `logList`, the drawing code in `renderTop`, and the `.tsi-bas-log*` CSS.
- The unused `log` and `influence` bottom-bar icons.

## What stays (as planned)

- Political Capital and Honour/Respect stay as data. They show read-only in the Hall's Clan Relations and change only through the DM doc's Change a score, a confirmed Diplomatic Event, and the Explorer's standing messages (`R.applyInbox` and `R.adjustStanding` still write receipts).
- `R.bridgeHistory` stays: `R.bridgeChanges` (Management's list) uses it.
- `state.log`, `R.log`, `log()` and `logAll()` are still written. Nothing on screen shows them. Step S18 deletes them.
- `R.startDay` no longer read `s.log` (the war ticks went earlier), so passing days was not touched.

## Bottom bar

Warehouse and Management only, on the left; nothing on the right. The grid is now two columns (the tray sits to the right of the buttons). The panel buttons are 98 px wide (92 px under 1400 px) because "Management" was clipped at 1920 x 1080; checked in the screenshots at 1707 x 930, 1920 x 1080 and the small window.

## Decision 15: notices where the Day Log was the only word

Already covered by a notice or "The Ironbow sends word" (checked, nothing to add): a day's finished orders, voyages and parcels (`settleVoyages` and `settleParcels` return word lines), Explorer deliveries (`settledNotices`), a Resolve (`tellResolved`), a bond becoming ready and a creature grant (`addWord`, notices), DM-doc score edits.

New notices added in `tool.js`:
- Cancel on a pending order (what came back to the Warehouse): "Order cancelled."
- Demolish or Stop building (the refund and what was cancelled).
- Download save: "The campaign save ... was downloaded."
- Party Level change that moves a plot facility to a Development Plot.
- The Explorer's day going back (Reset Travel).
- Hand to the party (the line saying the DM records it on the D&D sheet).

Wording fixed: the facilities and plot notices no longer say "The Day Log says so too"; Warehouse "+ Add supplies" and "Hand to the party" help; the Shrine comment; rules.js and creature-rules.js comments and `applyInbox` skip lines ("Clan Influence lists it" now points to Change a score in the DM doc or to granting it again in the Explorer); `shared/js/bridge-rules.js` "Type it in by hand" now says "Use Change a score in the DM doc". `dmdoc.js` and the Explorer had no mention left.

## Conversion box

A second button, **Save the old Day Log as a text file**, sits beside "Save this as a text file". It is built from the live save's `log` when the box is shown: the newest 25 entries, newest first (`R.oldLogText`, pure, tested). It is hidden when the log is empty. No registry step (no state change). S18 must keep it working from the set-aside copy.

## Guide

`guide.html`: bottom bar sentence, the Clan Influence paragraph (now describes Clan Relations, read-only), and every "the Day Log says/keeps" sentence reworded. One deliberate mention remains: the conversion box can save the old Day Log.

## Tests

- Rules: the support test replaced by "R.supportForClanKey is gone"; new `oldLogText` test; two wording assertions (courier, creatures); 1132 pass.
- e2e rewritten: bastion-screen (bar has only Warehouse and Management, nothing on the right, no removed names on the page), phase9 (no typed box, no Support, no Honour Change), bridge (a second Explorer +1 lands once; no typed box), bastion-days, party-name; migration-v4 gets a check for the old-Day-Log download.
