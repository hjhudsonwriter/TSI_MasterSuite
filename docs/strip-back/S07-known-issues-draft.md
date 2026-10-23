# S07 known-issues draft (for the lead to renumber into docs/KNOWN_ISSUES.md)

Not added to `docs/KNOWN_ISSUES.md` itself, to avoid merge clashes. Ids below are placeholders (BAS-S07a to BAS-S07f); rename to the next free BAS numbers when merged. All are deliberate changes from Harry's Strip Back brief (22 October 2026, decision 13). The last version that could found a Clan is commit `b337232` on main (the earlier restore point is `4f1db26`).

### BAS-S07a · A party can no longer found a Clan; it has a Party Name instead (Strip Back Overhaul, S07)
**Deliberate change** · other

- **Before:** at party level 9, with a total support of 360 and three Clans at 55, the party could press Form Clan and become "Clan: <name>" with a chief, a motto and Clan Honour; until then it was "Unsworn". The Party Identity panel was a 760 px panel with the status pill, the requirements line, Form Clan and the crest buttons.
- **After:** no Form Clan, requirements, Clan Honour, "Unsworn" or "Clan: name" anywhere. The crest badge opens a small (540 px) Party Identity panel: Party Name (optional, 40 letters), Create in the Clan Crest Creator, Upload, Remove. The name shows above the crest (badge and panel) and nowhere else. The crest works from the first day, with no gate.
- **Evidence:** `tools/bastion/tool.js` (identity card, badge), `tools/bastion/rules.js` (`R.cleanPartyName`), `tools/bastion/bastion.css`; `tests/e2e/party-name.test.js`, `tests/rules/party-name.test.js`, `tests/e2e/bastion-screen.test.js`, `phase9.test.js`.

### BAS-S07b · A Bastion that had founded a Clan keeps the Clan's name as its Party Name; the rest of the Clan is dropped when it is converted
**Deliberate change** · data

- **Before:** a version 3 save held `organization` (type, name, chief, motto, founding day), `clanHonor` and `trustedClientsByClan` (the archived Brigade's scores).
- **After:** the conversion (step `identity`) puts the Clan's name in `partyName` once (only if the Party Name is empty), deletes the three fields from the live save and says so in the box that says what changed ("Your Party": the chief, motto and Clan Honour are not kept; the set-aside copy has everything). The crest stays. The seven Clans' Honour/Respect and Political Capital are untouched. Pure, idempotent, audit-clean; a save with only the empty defaults hears nothing.
- **Evidence:** `tools/bastion/strip-back-rules.js` (`detectIdentity`, `dropIdentity`); `tests/rules/party-name.test.js`, `tests/e2e/party-name.test.js`, `tests/e2e/migration-v4.test.js`.

### BAS-S07c · A Mercenary Brigade's name (Builds 1 and 2, 8 October 2026) also becomes the Party Name
**Deliberate change** · data

- **Before:** such a save loaded as Unsworn with a Day Log line naming the Brigade.
- **After:** the same conversion step keeps the Brigade's name as the Party Name and says it was a Brigade. The Day Log line and the corner notice are gone (the Day Log is going, and the report says it once).
- **Evidence:** `strip-back-rules.js` (`dropIdentity`); `tests/rules/party-name.test.js`.

### BAS-S07d · Taking a crest from the Creator does not take its "Clan/Party Name" field
**Left alone** · other

- **Before and after:** the Creator's name field names the downloaded file and rides along in the hand-off; the Bastion uses it only in the crest's file name ("<name> (Crest Creator).png"). It is not copied into the Party Name; the Party Name is typed in the Bastion. The tool is still called "Clan Crest Creator" and the field "Clan/Party Name" (Harry: for now).
- **Evidence:** `tests/e2e/phase2.test.js`; `tools/crest/tool.js` (untouched).

### BAS-S07e · A very long name with no spaces is cut with "…" on the badge
**Left alone** · other

- **Before:** a long Clan name was clamped to two lines under the crest.
- **After:** the Party Name takes two lines at most above the crest, and the badge widens (up to 236 px) so a normal 40-letter name shows whole. A 40-letter name of wide capitals with no spaces is cut with an ellipsis on the badge; the full name is the badge's tooltip and is in the panel. Leading and repeated spaces count towards the box's 40-character stop (the saved name is tidied afterwards).
- **Evidence:** `tools/bastion/bastion.css` (`.tsi-bas-badge__name`); `tests/e2e/bastion-screen.test.js`.

### BAS-S07f · The Clan Influence panel still shows "support" until it goes
**Left alone** · other

- **Before and after:** `R.supportForClanKey` (the number beside each Clan in the Clan Influence panel) is kept, because that panel is removed by step S10, which should delete the function and its test group ("Bastion: Clan support") with it. The functions only founding a Clan used (`totalSupport`, `clansAtSupport`, `canFormClan`, the 360/55/3 numbers) are gone.
- **Evidence:** `tools/bastion/rules.js`, `tests/rules/bastion.test.js`, `tests/e2e/phase9.test.js` (Honour/Respect check).
