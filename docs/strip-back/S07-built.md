# S07 built: the Party Name, and no more founding a Clan

Step S07 of the Strip Back Overhaul (`docs/STRIP-BACK-PLAN.md`, Harry's decision 13; design in `docs/strip-back/C-identity-crest.md` and `J-cross-cutting.md` row S07). Branch `party`, made from main after S06 and merged again with main after the QR link (S17). Nothing else of the overhaul was touched.

## What Harry gets

- **The party can no longer found a Clan.** Form Clan, its requirements line, its pop-up, the Clan Honour box, the "Unsworn" and "Clan: name" labels and the Mercenary Brigade start-up line are gone.
- **The crest is there from the very first day**, with no level, gold or support gate (a test sets level 1 and 0 gp and uses it).
- **Click the crest badge** (top right of the Bastion picture) and a **small panel** (540 px, was 760) opens: **Party Name (optional)** (a box of up to 40 letters), **Create in the Clan Crest Creator ↗** (the Creator opens in its own window; "Use for the Bastion" there still asks here), **Upload a picture…** and **Remove**. Create is the one filled (crimson) button while there is no crest and an outlined one once there is.
- **The Party Name shows above the crest only**: on the badge, and above the large crest in the panel. Not in the Day Log, Management, the DM doc, the Warehouse or the tiles (a test looks in each). The Creator's own "Clan/Party Name" field is not copied into it (phase2 checks).
- **Saving**: the name is saved on Enter, on leaving the box, and when the panel is closed with Escape (never on each key). A redraw while typing never wipes what is typed. Emptying the box clears the name. It survives a reload, Download Save / Import (which asks first), Back up everything, and Reset clears it.
- **A Bastion that already founded a Clan**: that Clan's NAME becomes the Party Name (once, and only if the Party Name is empty), the crest stays, and `organization`, `clanHonor` and `trustedClientsByClan` are dropped from the live save. The box that says what changed has a new paragraph (heading **Your Party**), for example for the heavy fixture: "A party can no longer found a Clan, so yours, “Clan Ironbow”, is not one any more. Its name is now your Party Name, and shows above your crest. Its chief (Harry), its motto (“Root and Steel”) and its Clan Honour (55) are not kept in the Bastion, but the copy of your Bastion that was set aside has everything. Your crest stays as it is." The seven world Clans' Honour/Respect and Political Capital are not touched.

## Code

- `tools/bastion/rules.js`: `R.PARTY_NAME_MAX` (40), `R.cleanPartyName` (the suite's `words()` tidier: angle brackets, control and direction-changing characters become spaces, one space between words, trimmed, 40 letters, never half an emoji; anything that is not text is no name) and `R.partyNameNote` (the short UK English note the panel shows when tidying changed more than spaces). New saved field `partyName` (default `''`), copied by `R.fromSave` (the loader only copies known fields). Removed: `organization`, `clanHonor`, `trustedClientsByClan` from the default state and the loader, `R.canFormClan`, `R.totalSupport`, `R.clansAtSupport`, `R.orgLabel`, `R.requirementsHint`, `R.formerBrigade`, the `organization` line of `R.shiftDays`, and `organization` from the "must be a record" list of `R.saveProblem` (an old backup is never refused for a field nothing reads). `data.bastion.identityRules` is gone from `bastion-data.js`.
- `tools/bastion/strip-back-rules.js`: **registry step `identity`** (a clearly marked block after `dropBeastRequests`, above `sweepFacilities`; it ends with the entry in `R.stripBackSteps`), plus one line in `summaryOf`. Pure (no storage, clock or dice), idempotent, audit-clean (I1 to I7). `detect` finds a founded Clan, a Mercenary Brigade, a changed Clan Honour (not 40) or changed Trusted Clients scores (not 50). A save that only holds the empty values every old Bastion wrote says nothing and is simply not loaded any more. A Mercenary Brigade from the first two builds is handled the same way (its name becomes the Party Name too; the report says it was a Brigade). A Party Name already there is never replaced. Clearing the name later is never undone (the Clan is gone, so nothing can seed it again).
- `tools/bastion/tool.js`: `crestField`, `onFormClan`, the Form Clan pop-up, `orgPill`, the Clan Honour box and the Brigade start-up Day Log line and notice are removed; `crestName()` is "Crest of <Party Name>" (or "Crest of the Ironbow"); the identity card and `renderIdentity` are rebuilt; the badge has a name line above the crest and no label under it (the empty shield keeps "Add a crest"); `title` carries the full name; the map's labels are placed again when the badge changes size. The Reset text names the Party Name.
- `tools/bastion/bastion.css`: new badge layout and `tsi-bas-panel--identity`; the Form Clan crest box, `.tsi-bas-honour`, `.tsi-bas-req` and the status-pill rule are deleted.
- Kept on purpose: **`R.supportForClanKey`** and its test. The Clan Influence panel still shows the "support" number until step S10 removes that panel; S10 should delete the function and the `Bastion: Clan support` test group with it.
- `guide.html`: the badge and Party Identity paragraphs rewritten; the Form Clan paragraph removed.
- Docs: `docs/BASTION-EXPLORER-REFERENCE.md` 5.9 rewritten; a note at the top of section 4 of `docs/BASTION-OVERHAUL.md`; `tests/e2e/README.md`.

## Badge room (re-measured on the final code, file://, no internet)

Painting scale k and the badge's size (width x height) in pixels, with the gap from the badge's bottom to the Hall's picture (the Hall's box starts at y 376 on the 3000 x 1250 painting; the old badge was 112 x 109 with gaps of 68, 113 and 4):

| Window | k | no name | name of 1 line | name of 2 lines (40 letters) |
|---|---|---|---|---|
| Laptop 1707 x 930 (ratio 1.5) | 0.50 | 112 x 90, gap 86 | 112 x 106, gap 71 | 236 x 119, gap 58 |
| Laptop full 1707 x 1067 | 0.56 | 112 x 91, gap 107 | 112 x 107, gap 91 | 236 x 119, gap 78 |
| TV 1920 x 1080 (ratio 1) | 0.62 | 112 x 91, gap 131 | 112 x 107, gap 115 | 236 x 119, gap 102 |
| Small 1280 x 720 (ratio 1.5) | 0.33 | 112 x 71, gap 42 | 112 x 87, gap 27 | 236 x 99, gap 14 |

(All with a crest.) With **no crest** and a 2-line name on the small window the badge is 236 x 109 and the gap is 4 px, the same as the old badge's worst case. How: the crest on the badge is `clamp(56px, k x 150px, 76px)`, so it is full size (76) from the laptop up and 56 px only on the smallest window; the name is 11 px capitals, two lines at most, and the badge widens (up to 236 px, 70% of the painting at most) so 40 letters fit in two lines. A pathological 40 capital W's is clamped with an ellipsis (the full name is the badge's tooltip and is in the panel). The badge is never over the Hall, never leaves the painting, and every map label stays clear of it (`tests/e2e/bastion-screen.test.js`, all four sizes, with and without a crest, names of 0, 7, 37 and 40 letters). The panel is 540 px wide, about 500 px high, and fits all four windows (checked).

## Tests

- Rules page (`tests/rules/party-name.test.js`, new, 26 tests): tidying, the 40-letter cap, emoji, non-text, notes in UK English, the saved field and reload, a Reset-Travel shift, conversion of a founded Clan (name moves, fields dropped, audit clean, idempotent, wording), a Clan with no name, a too-long and a bracketed name, a name already chosen, an older copy that founded a Clan after the conversion, a Brigade, the empty values saying nothing, a changed Clan Honour or Trusted Clients, the seven Clans' scores untouched, a version 2 Bastion, the heavy fixture, and the name staying out of the Beast Handler's snapshot (also `beasthandler-projection.test.js`, which now plants `SECRETPARTYNAME`).
- Deleted: the three identity rules tests that tested founding (`forming a Clan`, `requirements line`, `Brigade in a save from Builds 1 and 2`); the `support` test stays (see above) and now also checks that the removed functions and data are gone. Updated: the starting-Bastion test, the save-and-reload test (`bastion.test.js`), the registry order and the "changes nothing in any fixture" tests (`strip-back.test.js`).
- Click-throughs: `tests/e2e/party-name.test.js` (new, 26 checks: the panel, saving, 40 letters, tidying, clearing, no Form Clan anywhere, the Creator's window and upload, Remove, an old Clan becoming the Party Name once, a Bastion that never founded one saying nothing); `phase9` (the identity and crest sections rewritten, three Form Clan checks deleted); `bastion-screen` (the badge states and the clearance at four sizes, with and without a crest and with names of 0, 7, 37 and 40 letters, and the panel fitting at all four sizes); `phase2` (taking a crest does not take the Creator's name field as the Party Name); `migration-v4` (the box has 10 paragraphs now).
- The heavy fixture generator (`tests/fixtures/make-heavy.js`) deletes `partyName` (a version 3 save had none; the new default state has one) and the fixtures were regenerated: the content is the same, only the key order differs.

## Decisions made without asking

- **Removed, not archived**: Form Clan's code is not kept in `tools/bastion/archive/` (C suggested it). The git history is the fallback (commit `b337232` has it), as for the war game.
- **A Mercenary Brigade's name also seeds the Party Name** (it is practically impossible: it lived for hours on 8 October), with its own wording in the report.
- **A badge label for "Add a crest" stays** under the empty shield, with the Party Name above the shield when there is one.
- **Escape in the Party Name box saves what was typed** and then closes the panel (otherwise typing a name and pressing Escape would silently lose it).
- **Old Clan fields that hold only the empty defaults** (no Clan, 40, fifty each) are dropped without a report line and without a "tidied again" notice.
- **The Creator is left alone**: still "Clan Crest Creator", still a "Clan/Party Name" field, which is not copied into the Party Name.
- **Panel width 540 px** and the badge widening to at most 236 px for a long name; the crest on the badge is 56 px on the smallest window only.
- **The panel shows the name above its large crest as well** (the same look as the badge), as C suggested.

## Results (final code, after the merge with main)

Main (including the QR link, S17) was merged into this branch before the last run; the merge had no conflicts. The heavy fixture generator needed one line (it starts from the new default state, which now has a `partyName`), and the fixtures were regenerated (same content, different key order). Gates, run one at a time with the Chromium on a shared, busy machine:

- Rules page (`node tests/run-rules.js`): all 1,073 tests passed (1,016 before; 26 new in `party-name.test.js`, three removed).
- `node tests/static-check.js`: passed (6 pages, 9 tool manifests, 159 files named, 120 source files scanned).
- `party-name` 26, `phase9` 80, `phase2` 71, `bastion-screen` 55, `bastion-days` 16, `migration-v4` 35, `session-safety` 6, `beast-pen` 24, `guide` 21, `phase1` 129: every check passed.
- `dmdoc`: 49 of 50 in the chain run (the one failure, "a real Restore in one window reaches the DM doc open in another", timed out at 8 s while the machine was at load average 11); re-run alone it passed all 50.
- The first run of `party-name` timed out opening the first page for the same reason (load average 11); it passed all 26 on the next run.
- Not run: `phase8` (needs `_legacy`, known), and the other click-throughs (the lead runs the full set after merging).
- Badge room re-measured on the final code at all four sizes: the table above.

## Where I stopped

Everything in the brief is done and committed on branch `party` (not pushed). Not done, deliberately: renaming the Crest Creator or its "Clan/Party Name" field; showing the Party Name anywhere else (DM doc, Beast Handler, Creator); archiving the Form Clan code (git has it).
