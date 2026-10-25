# S12 built: the Workshop's staff

Step S12 of the Strip Back Overhaul (`docs/STRIP-BACK-PLAN.md` decision 10; design in `docs/strip-back/E-workshop-dev.md`, `J-cross-cutting.md` 4.3 and 8.1). Branch `workshop` (backed up on `wip-workshop`). The Library & Scriptorium and the Arcane Laboratory are gone from the catalogue, the Artisan Tools card is gone, and the Workshop has five staff.

## Harry's decisions as built

- **Five staff open one by one**: Handyman (Workshop Level 1), Smith (2), Scholar (3), Alchemist (4), Artisan (5). They live in `facilities-data.js` (`workshop.staff`); every Workshop order names its staff member (`staff`) and the level that opens it (`requiredFacilityLevel`). The Workshop's own level is NOT raised by the change.
- **Handyman (PLACEHOLDER)**: `craft`, 3 days, items of the six tables nobody else claims (Weaver's, Leatherworker's, Carpenter's, Mason's, Glassblower's Tools, Brewer's Supplies; 103 distinct items). Marked `placeholder: true`, in the order's notes and on his card ("PLACEHOLDER: the Handyman's list is to be supplied...").
- **Smith**: `craft_smith`, Smith's Tools (30 items), 3 days. The old `smithing` (29 items, 5 days) is `retired: true`: hidden for everyone, but a pending one still finishes, and while one is pending the Smith is busy.
- **Scholar**: `craft_scholar` (Calligrapher's Supplies, 12 items, 3 days), `research` (4 scriptures, 5 days), `prepare_overland_travel_charts` (4 days, 1 `overland_chart`, no gold). The chart good and its readers (Explorer, Courier, bridge) are untouched.
- **Alchemist (33 items, no party-level gate)**: `craft_alchemist` (Alchemist's Supplies, 17, 3 days), `alchemy` (3 poisons, 5 days), `craft_common` (4, 5 days), `craft_uncommon` (9, 10 days). Potion of Climbing, Potion of Resistance and Potion of Water Breathing are not offered a second time.
- **Artisan**: no orders; his card says "Extra options: to come". The hook is `artisanExtras` on every craft order (items added at Workshop Level 5; empty).
- **One job at a time**: `R.staffBusy` refuses a second order for the same staff member ("The Smith is busy: Workshop: Smith - Longsword, due on Day 14."); the five work side by side; upgrades and Craft Magic Item do not count. The card's button says "Busy".
- **Craft Magic Item** (22 items, 10 days) has no staff member and no party level; it sits under the cards in a box labelled "Not a staff job". Dread Helm, Moon-Touched Sword and Smoldering Armor are Compendium-only ("Compendium only").
- **Order names** say who does the job: "Workshop: Smith - Longsword", "Workshop: Scholar - Research (Combat Scriptures)".

## What changed, by file

- `tools/bastion/data/facilities-data.js`: the Workshop block rewritten (staff, ten orders); the `arcane_laboratory` and `library_scriptorium` blocks deleted (the catalogue now holds 11 facilities).
- `tools/bastion/rules.js`: `R.staffOf`, `R.workshopStaff`, `R.staffOrders`, `R.craftItemsFor`, `R.staffBusy`, `R.orderLabel`; `R.fnOptions`, `R.issueOrder`, `R.completeSimpleOrder`, `R.fnAvailable` (retired), `R.levelUnlocks` (names the staff member a level opens), `R.compendiumIndex` (craft tables under their staff member; the unowned tables "Compendium only"). Removed: `R.toolTableNames`, `R.craftItems`, `artisanTools` and `legacyFacilities` from the default save and the loader. The version 3 step's `nameOf` falls back to the Strip Back names (so it can still say "Library & Scriptorium").
- `tools/bastion/strip-back-rules.js`: registry step `workshopStaff` (below), above `sweepFacilities`.
- `shared/js/campaign-rules.js`: the five orders that move are listed; any other order at the two places is forecast as cancelled; a Library or Laboratory being built is not forecast.
- `tools/bastion/tool.js`, `bastion.css`: the Artisan card removed; `staffCard` and `workshopSection` (five cards in a row, three on a medium screen, one on a phone; locked cards greyed with "Opens at Level N"); the Workshop's picture is smaller so everything fits.
- `tools/bastion/data/bastion-data.js`: tiles, overlays and map labels of the two places removed. Pictures moved (not deleted) to `tools/bastion/assets/extras/` (listed in `docs/ASSETS.md`).
- Wording: `research-data.js`, `goods-data.js` say "the Workshop's Alchemist". `guide.html` has a Workshop staff paragraph.
- Tests: `tests/rules/workshop-staff.test.js` (new, 20 tests), `tests/e2e/workshop.test.js` (new, 16 checks), the rules, `bastion-screen`, `phase9`, `creatures` tests updated; `tests/fixtures/make-heavy.js` writes the Library and Laboratory orders out as they were saved.

## The conversion: step `workshopStaff`

Pure, idempotent, audit-clean, plain-English lines. A save with a Library or Laboratory in a slot, level, repair or pending order, or with Artisan Tools chosen or retired buildings listed, is found (a version 4 save an older copy overwrote is converted again).

- **MOVE**: Research and Prepare Overland Travel Charts (Library), Craft Common, Craft Uncommon and Alchemy (Laboratory) go to the Workshop. Same id (the Workshop's orders have the same ids), due day, cost, issue day and chosen item; only the place and label change. They complete through the same code as before (a chart goes into the Warehouse, once).
- **CANCEL**: an Upgrade there (free) and any order the Workshop does not give.
- Slots freed (a building under way stops: building costs no gold), levels and repairs removed, both recorded in `archivedFacilities`. Research is not touched (the audit keeps it).
- `artisanTools` and `legacyFacilities` dropped; the report names the tables chosen and where each went ("Smith's Tools now belongs to the Smith (opens at Workshop Level 2)"), and says if a Library was at Level 2 that the Scholar opens at Workshop Level 3.

## Results

See the end of the build report given to the lead (every gate is listed there).
