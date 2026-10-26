# S04 built: production facilities, one self-contained order per level

What was built (branch `s04-dev-facilities`):

- **Data** (`tools/bastion/data/facilities-data.js`): `"levelOrders": "replace"` on the Timber Yard & Sawmill, Fishery & Smokehouse, Stone Quarry & Masonworks and Weavers' Hall (explicit, not inferred). The 14 recipe `inputs` of those four are removed (every Level 2 to 4 processing order and the four Level 5 bulk processing orders). Order ids, labels, days, gold and outputs are untouched; nothing was deleted or renumbered, so a pending order still finds its order by id and completes. The header comment gains a `levelOrders` note.
- **Rules** (`tools/bastion/rules.js`):
  - `R.fnAvailable` hides an order of a `replace` facility whose `requiredFacilityLevel` (default 1) is not the facility's level: `{ ok: false, hidden: true, message: 'That order belongs to Level N.' }`. `R.issueOrder` refuses it through its existing path.
  - New plain functions: `R.replacesLevelOrders`, `R.levelOrderLabels`, `R.joinNames`, `R.levelReplacement` (the "replaces A with B" words, made from the data), `R.upgradeReplaceNotice` (the question before an upgrade).
  - `R.levelUnlocks` returns one "Replaces ..." line for these four; `R.levelUnlockSummary` gains `replaces`.
- **Screen** (`tools/bastion/tool.js`): the Upgrade row reads "Level 2 replaces Harvest Timber with Saw Lumber."; `onUpgrade` asks first (existing confirm modal) for the four; the build tooltip adds "one order at a time: each level replaces the last". The facility panel shows only the current level's order(s) because the existing `hidden` filter now applies.
- **Guide** (`guide.html`): the Stone/Weavers, Goods and Upgrade paragraphs (and the Fishery pack line) rewritten to match.
- **Tests:** `tests/rules/dev-facilities.test.js` (new, in `tests/rules.html`); `tests/rules/bastion.test.js` and `tests/e2e/bastion-screen.test.js` rewritten where the new behaviour changes the old expectations.
- **Known issues:** `BAS-S04` in `docs/KNOWN_ISSUES.md` (temporary id; rename to the next free BAS number on merge).

Decisions made without asking:

- Wording uses each order's real label, so the Level 5 line reads "replaces Harvest Premium Hardwood with Major Timber Harvest and Bulk Lumber Processing" (the data's label is "Harvest Premium Hardwood", not "Premium Hardwood").
- A hidden order message is "That order belongs to Level N." for both a replaced order and one from a level not reached (it replaces "Needs Level N." for these four only).
- Descriptions: none of the four facilities' orders had a "Uses ..." line in its notes (the "Uses:" line on screen is generated from `inputs`, so it disappears with them); nothing else to reword.
- The confirmation says the old order stops being startable "once the upgrade finishes" (it stays on offer while the upgrade is still running).
- Not touched: `docs/PROGRESS.md` (left for the docs steps to avoid merge clashes), the Dock's "no trade goods" sentence, the Compendium, courier and commerce data (checked: they refer to goods, not to these orders; `R.compendiumIndex` skips production orders).
