# AREA C: Form a Clan / Party Identity overhaul

Analysis only. Nothing in the repo was changed. Branch `claude/gallant-ramanujan-klwz70`, HEAD `76c1276` (on top of main `4f1db26`).
Scratch files (a badge measuring script and two screenshots of today's Party Identity panel) are in the same `analysis/` folder.

## 0. The short version

- What Harry asks, in four sentences: (1) a party can no longer formally found a Clan; (2) the crest badge stays top-right of the Bastion picture; (3) the party can make and apply a crest from the very first day, with no gate; (4) an optional "Party Name" box whose text shows above the crest.
- **The crest is already available from the very start.** Since Build 3 (8 October 2026, BAS-67) the crest belongs to the Bastion, not to a Clan: `tsi.bastion.crest`, settable at any time from the Party Identity panel (badge, then "Create in the Clan Crest Creator", "Upload a picture", "Remove"). Founding a Clan has never been needed. So the real work is removing Form Clan and everything that only exists for it, then adding the Party Name.
- Size: small to medium. Rules: about 60 lines come out of `tools/bastion/rules.js`, about 20 go in. Screen: `renderIdentity`, `onFormClan`, `crestField` and the Form Clan CSS come out, a Party Name box and a re-laid-out badge go in. Data: one object (`identityRules`) goes. The bulk of the effort is **tests and docs** (about 100 test lines assert Form Clan, Clan Honour or `organization.type`), and most of the "clan" test lines are really war tests that vanish with the War Council (another area).
- **The party's own Clan is read by nothing outside the war code and the Party Identity panel.** Clan Relations, Diplomatic Records, Explorer standing outcomes, the Hall's Honour/Respect and Political Capital, the DM doc, the Notice Board and the Beast Handler never read `organization` or `clanHonor`. So there is nothing in Diplomatic Records or Clan Relations to migrate (section 5).
- The one real layout risk is the **badge height**: today it is 112 x 109 px; on the 1280 x 720 test window the gap under it to the Hall's picture is only **4 px** (section 7).

## 1. Current code map (what exists today)

### 1.1 Rules and data (plain functions)

`tools/bastion/rules.js` (namespace `TSI.bastion.rules`, called `R`):

| What | Where | Notes |
|---|---|---|
| Default state: `organization: { type: 'unsworn', name: '', chief: '', motto: '', foundedAtDay: null }` and `clanHonor: 40` | lines 146-149 | In `R.defaultState`. Comment says "'unsworn' or 'clan' (the Mercenary Brigade was archived ...)". |
| Load: `R.fromSave` copies `organization` (type forced to `'clan'` or `'unsworn'`; a `'merc'` type is skipped so it loads as Unsworn) and `clanHonor` (clamped 0-100) | lines 397-409 | `R.fromSave` is at line 350. It is the one place every load and every import goes through. |
| `R.saveProblem` lists `organization` among the "must be an object" records | line 1045 | A save with `organization` as a string or number is refused on import. |
| `R.isCrest(v)` | 1075 | `{ dataUrl (data:image/...), key, name?, design? }`. |
| `R.crestFromHandoff(h)` | 1084 | Turns the Creator's hand-off into a crest record (PNG only, at most 3 000 000 characters, copies the Creator's `design` settings if they are plain strings, booleans or numbers). Name becomes "<clanName> (Crest Creator).png". |
| `R.formerBrigade(saved)` | 1100 | Returns `{ name }` for a Builds 1-2 save whose `organization.type === 'merc'`, else null. |
| `R.hashText` | 1106 | Fingerprint used for the crest `key`. Also used by war code (keep). |
| `R.importProblem` | 1143 | Checks `tsi.bastion.state`, `.ui`, `.crest`, `.warMap`, `.warTable`, `.warTerrain` on Import. |
| **Identity block** | 2997-3027 | `R.supportForClanKey` (support = (PC+100)/2 + HR*4), `R.totalSupport`, `R.clansAtSupport`, `R.canFormClan`, `R.orgLabel` ("Clan: name" or "Unsworn"), `R.requirementsHint`. |
| `R.shiftDays` shifts `organization.foundedAtDay` | line 3330 | Reset Travel moves days. Goes with the field. |
| `CLAN_KEYS` | line 192 | The seven Clans: blackstone, bacca, farmer, slade, molten, rowthorn, karr. Unchanged. |

`tools/bastion/data/bastion-data.js` lines 215-222: `identityRules { clanMinLevel: 9, clanSupportTotalMin: 360, clanSupportPerClanMin: 55, clanSupportClanCountMin: 3 }`. Only `R.canFormClan` and `R.requirementsHint` read it.

War code that reads the party's Clan (all of it leaves with the War Council, which is another area's job, but note the link):
- `tools/bastion/war-campaign-rules.js:564` `fullWar: !!(organization.type === 'clan')` in `R.warForces`; used at 572, 589, 603 (`R.warAvailable`, `R.warCommit2`), and in `R.clanOnlyCut` (1607) and `R.musterShortfall` (call at 1449). This is why an Unsworn party "can't commit Lieutenants and regiments".
- `war-campaign-rules.js:1739-1742`: war rewards give Clan Honour only when `organization.type === 'clan'`; `applyRewards` (1763-1765), `previewRewards` (1772) and `rewardLines` (1793, the "Clan Honour: ..." line) change `clanHonor`. Values are in `tools/bastion/data/war-units-data.js:294` `rewards: { withdrawalHonour: -4, victoryHonour: 6, defeatHonour: -8 }`.
- `tools/bastion/tool.js` war parts: 1574 (`fieldUnit` builds a fake `organization: { type: 'clan' }`), 1803-1855 (War Council form: "Clan only" text, "Unsworn war is limited to defenders and beasts."), 2351-2360 (`openWarTable`: `armyName` = Clan name or "Your forces"; `crest` handed to the War Table), 4957 (`R.clanOnlyCut`).
- `tools/bastion/war-table.js` lines 14, 193, 479, 1511, 1901-1917: the crest drawn on the player tokens and the battle side panel.

**If the War Council and War Table go (as the handover says), every one of those readers disappears.** The War Table crest is then not a "keep" item at all.

`tools/bastion/archive/mercenary-brigade.js` (loaded by nothing) refers to `identityRules`, `R.orgLabel`, `R.requirementsHint`, `R.canFormMerc`, `fullWar`; its header's "how to put it back" instructions become wrong once Form Clan is removed (and already wrong once the war goes). Its tests are `tests/archive/mercenary-brigade.test.js`.

### 1.2 Screen code, `tools/bastion/tool.js`

| What | Lines | Notes |
|---|---|---|
| Start-up: `var formerBrigade = saved ? R.formerBrigade(saved) : null;` with a Day Log line ("Identity", "... A Clan can be founded in Party Identity ...") | 97-104 | Wording will be false after the change. |
| The crest section | 1053-1141 | `CREST_MAX = 512`, `CREST_FILE_LIMIT = 25 MB`, `var crest = load('crest', R.isCrest, ...)` (1067), `readDataUrl`, `loadImage`, `shrinkPicture`, `pickCrest` (1105), `crestWatchers` (1128), `saveCrest` (1129; stores `tsi.bastion.crest`, removes the key when null), `showCrest` (1136), `crestName()` (1145: "Crest of <Clan name>" else "Crest of the Ironbow"). |
| `openCreator(status)` | 1156-1167 | Opens the Crest Creator with `TSI.shell.openWindow('crest')`, refuses if `TSI.tabGuard.isOpenElsewhere('crest')`, debounces 1.5 s, writes its message into the panel's status line (a corner notice would hide under the panel's backdrop). |
| `onUploadCrest`, `onRemoveCrest` | 1173-1190 | Remove asks first. |
| The Creator hand-off: `checkCrestOffer` (1198), `offerCrest` (1245), `TSI.handoff.listen(life, 'crest', ...)` (1267), `refreshCrest` (1274) | 1198-1285 | "Use this crest for the Bastion?" at once, or on opening; no day passes while it is asked (`turnRunning || militaryRunning || warTableOpen` gate at 1199). Polled every 2 s at 4797; also called at the end of start-up (5680). The offer's text mentions the War Table (1255): "...and on your tokens on the War Table". |
| `crestField()` (the Form Clan pop-up's crest box) | 1289-1331 | Only used by Form Clan. Leaves. |
| **Party Identity card** `idCard = card('identity', 'Party Identity')` | 1342-1386 | Pieces: `orgPill` (`data-test=org`), `orgMeta` (chief, motto, "Founded on Day N"), `crestImg`/`crestEmpty`/`crestFrame` (`data-test=crest`, `crest-empty`), `crestStatus` (`crest-status`), three buttons `crest-create`, `crest-add`, `crest-delete`, `formClanBtn` (`form-clan`, the one primary button), `reqHint` (`requirements`), `formBox` (`form-box`), `honourInput` (`clan-honour`) and `honourBox` (`honour-box`, hidden until a Clan). |
| `renderIdentity()` | 1388-1412 | Sets pill text, chief/motto, "You may found a Clan once enough of the Clans support you." / "You are a political entity. Clan Honour unlocks future war and territory systems.", crest, Remove visibility, Form Clan enabled state, Clan Honour box. |
| `onFormClan` | 1415-1446 | The pop-up (Clan Name required, Chief, Motto, crest box, "Confirm Founding"), then `state.organization = { type: 'clan', ... foundedAtDay }`, log "Founded Clan: <name> (Chief: <chief>).", saves any newly chosen crest. |
| Badge: `badgeImg`, `badgeShield`, `badgeLabel` ("Add a crest"), `badge` (`data-test=identity-badge`, a `<button>`), `openIdentity()`, `renderBadge()` | 5381-5397 | Label under the crest = crest set ? (Clan name or "Unsworn") : "Add a crest". `aria-label` = crestName() + (no crest ? ": no crest yet" : "") + ". Open Party Identity." |
| `renderAll()` calls `renderIdentity(); renderBadge();` | 5555-5556 | |
| Test-only opener map (`openerFor`) lists `[idCard, 'identity-badge']` | 5634 | |
| Notice for a former Brigade | 5670-5674 | "...the party is Unsworn again." |
| Reset | 5328-5335 | Clears `['state','crest','warMap','warTable','warTerrain']`; the confirm text names "the crest". |
| `setValue(input, value)` | 336 | Sets a box's value only when it is not focused; the pattern to reuse for the Party Name box so a redraw never wipes what is being typed. |

Styles `tools/bastion/bastion.css`: badge 190-224 (`.tsi-bas-badge`, `--empty`, `__img` 76 px, `__empty`, `__label` 2-line clamp, 11 px capitals); notices placement 227-245 (keeps notices clear of the badge); identity panel 639-667 (`.tsi-bas-identity*`, `.tsi-bas-crest*`, `.tsi-bas-honour`); the crest offer 668-671; **Form Clan crest box 672-698** (`.tsi-bas-modal--found`, `.tsi-bas-crest-pick*`); `.tsi-bas-status-pill` is shared with `.tsi-bas-turn-pill` (626); `.tsi-bas-req` 851. Remove `--found`, `crest-pick*`, `.tsi-bas-honour`, `.tsi-bas-req` once nothing uses them.

### 1.3 The Clan Crest Creator (`tools/crest/`)

- Tool id `crest`, name "Clan Crest Creator", group `players` (`shared/data/tools.js:159-178`). Saves its design as `tsi.crest.design`.
- It already has a **"Clan/Party Name" field** (`tools/crest/tool.js:264-277`, placeholder "Type your Clan/Party name...", max 40 characters by `data.crest.limits.clanNameLength`, state key `clanName`, input id `tsi-crest-field-clan-name`, a visible 🎲 Name button for random names). **That name is not drawn on the crest** (`draw.js` draws only the motto ribbon); it only names the downloaded file ("Saved as: <name>.png") and rides along in the hand-off.
- "Use for the Bastion" (`tool.js:475-516`, `sendToBastion`): draws a 512 x 512 PNG (SVG only, so file:// is allowed), writes `TSI.handoff.write('crest', { id, at, name: clanName, dataUrl, design })` (key `tsi.suite.handoff-crest`, `shared/js/handoff.js`, names in `shared/js/store-rules.js:45-56`). Tells the user "Crest sent to the Bastion", with an "Open the Bastion" button if it is shut.
- So the Creator needs **no code change** for this handover (see question about renaming wording).

### 1.4 What reads the party's Clan outside the Bastion

Searched `shared/`, `tools/explorer/`, `tools/beasthandler/`, `tools/quests/`, `index.html`, `player.html`, `beasthandler.html` for `organization`, `clanHonor`, `crest`, `Unsworn`, `identity`:
- **Explorer** (`tools/explorer/*`, `shared/js/bridge-rules.js`): no reads. Its standing outcomes change only the seven Clans' Honour/Respect through messages the Bastion applies (`R.adjustStanding`, `bridge.done` receipts). The Explorer's "DM note: Notice Board: consider +1 clan honour with Clan X" lines (`tools/explorer/data/journey-events.js` 302, 311, 316, 604, 609, 618) are reminders for the Notice Board's own Clan Honour filter and never touch the Bastion.
- **DM doc** (`shared/js/dmdoc.js`, `dmdoc-rules.js`, `campaign-rules.js`): shows the region's Clan, its PC and HR (`sum.clan`), never the party's Clan or crest.
- **Notice Board** (`tools/quests/rules.js:41-52`, `tool.js:128`): a separate "Clan Honour" dropdown (-3 to +3, `data-test=clan-honour`). Same words, different thing. Unaffected.
- **Beast Handler phone projection**: `tests/rules/beasthandler-projection.test.js:181` plants `b.organization.name = 'SECRETCLANNAME'` and proves it never reaches the phone. The new Party Name should stay out of the projection unless Harry says otherwise (and that test line should become `b.partyName = 'SECRETPARTYNAME'`).
- **Shell / home** (`shared/js/shell.js`, `index.html`): the suite crest in the top bar is the logo, not the party's.

## 2. Three meanings of "Clan Honour" (do not mix them up)

| Name in the UI | Field | Range | What it is | Fate |
|---|---|---|---|---|
| Clan Honour (0-100) box, Party Identity | `state.clanHonor` (default 40) | 0-100 | The party's **own** honour once it has founded a Clan. Changes only from war results (+6 victory, -8 defeat, -4 withdrawal) and by typing. | No home any more: its only editor is in the Clan-only box, its only changes are war rewards. Leave inert in saves. |
| Honour/Respect (HR) per Clan | `honourRespectByClan[clanKey]` | -5 to +5 | Each of the seven Clans' regard for the party. Set by the DM, changed by Explorer events and Diplomatic Records. | **Stays.** This is what the handover means by the Hall's "Clan Honour/Respect" (Harry's own Hall spec, `docs/specs/hall-of-emissaries-redesign.txt` line 130, calls it "Clan Honour & Respect"). |
| Clan Honour dropdown, Notice Board | the Notice Board's filter | -3 to +3 | Which quests are shown. | Unaffected. |

## 3. What the handover asks, line by line, and what it means in code

1. **"Remove the ability for parties to formally found their own Clan (party identity)."**
   - Remove: Form Clan button and pop-up (`onFormClan`, `formClanBtn`, `formBox`, `reqHint`, `crestField`, `.tsi-bas-modal--found`), the "Unsworn / Clan: name" pill and its meta (chief, motto, founded day), the Clan Honour box (`honourBox`, `honourInput`), `R.canFormClan`, `R.totalSupport`, `R.clansAtSupport`, `R.requirementsHint`, `R.orgLabel`, `data.bastion.identityRules`, the "Founded Clan" Day Log line, the Mercenary-Brigade start-up line that says "A Clan can be founded in Party Identity".
   - Stop reading: `organization` and `clanHonor` everywhere (war code goes with the War Council).
   - The word "Unsworn" disappears from the screen (the badge label, the pill, the war hints). There is no "Clan" status to be unsworn from.
   - Recommended method, following the repo's own Brigade precedent: **archive, don't delete**: move the Form Clan rules (and `identityRules`) to `tools/bastion/archive/form-clan.js` with its tests in `tests/archive/form-clan.test.js` (loaded by nothing, with a "how to put it back" header), so a later change of mind costs nothing. Git history is the fallback.
2. **"Keep the crest in the top right corner of the bastion image panel."** Keep `badge`, `renderBadge`, `.tsi-bas-badge` and its placement rules. The badge image is `76 x 76`; position `top: 12px; right: 12px` inside `.tsi-bas-map`'s stage. See section 7 for the geometry the tests enforce.
3. **"Automatically allow parties to create their own crest ... from the very start of the game and apply it here."** Already true (see section 0). Needed: take away every wording that says a crest belongs to "the Clan" (`crestName()`, panel text, guide.html), drop the "(and on your tokens on the War Table)" sentence from the offer pop-up (1255), and make "Create in the Crest Creator" the panel's one main (filled) action while there is no crest, because Form Clan, the current filled button, is gone ("one clear main action per panel").
4. **"Create an optional 'Party Name' editor where the party can enter a collective name for themselves that will be displayed above their crest once selected."** New: one text box in the Party Identity panel; the name is drawn above the crest on the badge and (suggested) above the large crest in the panel.

## 4. Proposed design (my recommendations; the "questions" list says which need Harry)

### 4.1 Saved fields

| Field | Today | After | Notes |
|---|---|---|---|
| `tsi.bastion.crest` (`{ dataUrl, key, name, design? }`) | kept | **kept as it is** | Same key, same shape, same checks (`R.isCrest`, `importProblem`), same Reset behaviour. |
| `tsi.bastion.state.partyName` | none | **new**, string, default `''` | Trimmed, inner spaces collapsed, control characters removed, at most 40 characters (same as the Creator's name field). Anything that is not a string loads as `''`. Lives in the state (not in a separate key) because it is tiny, so Reset, Download Save, Import, Back up everything and the one-campaign file all carry it with no extra code. Saved on Enter or on leaving the box (like the treasury and Honour/Respect boxes), never on each key. |
| `state.organization` (`type, name, chief, motto, foundedAtDay`) | read and written | **stop writing; keep inert if present in a loaded save** (like `trustedClientsByClan`, which "nothing reads, but is kept so nothing is lost") | If a save comes in with a formed Clan, its chief, motto and founding day stay in the file untouched. New saves need not contain it. If removed from `defaultState`, `R.saveProblem`'s `maps` list (line 1045) can drop `'organization'`, and `R.shiftDays` (3330) can drop its line. |
| `state.clanHonor` | read, written, shown | **stop using; keep inert** | Nothing shows or changes it. |
| `honourRespectByClan`, `politicalCapital`, `diplomacy`, `diplomaticRecords` | | **unchanged** | See section 5. |
| `trustedClientsByClan` | kept inert | unchanged | Already archived. |
| Save version | `v: 3` | `v: 3` stays unless the strip-back as a whole bumps it | The identity step is tiny and idempotent, so it can sit inside `R.fromSave` (works for load and import) and does not need its own version. If the facilities strip-back adds a v4 migration (likely, for the 13 removed facilities), call the identity step from there so one report covers everything. |

### 4.2 Migration of a save that already founded a Clan

Real risk is low: a Clan needs party level 9, total support 360 and three Clans at 55; the code default level is 7, the readiness report (`docs/LEVEL-9-10-READINESS.md`) treats 9 as still ahead, and all seven sample files in `tests/fixtures/*.json` are Unsworn. But the migration must still be safe ("never lose saved data").

In `R.fromSave` (line 350), after the `organization` block (397-409):
- `partyName`: if the save has a string `partyName`, clean and use it. Otherwise, if `organization.type === 'clan'` and its `name` is non-blank, **seed `partyName` from the Clan's name** (so the name Harry typed is not lost, and it shows above the crest). Otherwise `''`. Because the first load saves `partyName` (even as `''`), the seeding happens once; clearing the box later is never undone.
- Keep `organization` and `clanHonor` as loaded (inert). `type: 'merc'` still loads as unsworn (existing rule), with no name.
- A pure helper `R.formerClan(saved)` (like `R.formerBrigade`, line 1100) returns `{ name, chief, motto, foundedAtDay, honour }` when the save had a formed Clan and no `partyName` yet, else null. The Bastion then writes **one Day Log line** ("Identity: the Clan <name> is no longer a formal Clan: Clans can't be founded now. <name> is kept as the Party Name. Its chief (<chief>), motto and clan honour (<n>) are kept in the save.") and **one notice**, exactly as `formerBrigade` does (`tool.js` 97-104 and 5670-5674), and the start-up `save()` condition (5666) gets `|| formerClan`.
- The existing Brigade handling (`R.formerBrigade`, the notice, `bastion.test.js:831-845`, `bastion-campaign.test.js:1174-1176`) should be **retired or reworded**: its text promises "A Clan can be founded in Party Identity" and "Only a Clan can send Lieutenants". A Builds 1-2 save with `type: 'merc'` is practically impossible now (it lived for hours on 8 October). Simplest: fold it into `formerClan` (any non-unsworn organization), or delete it and let a `'merc'` save load as no name.
- The strip-back will probably set aside a copy of the pre-migration save (the v2 to v3 migration did: `tool.js:63-69`, `TSI.store.quarantine`). The identity step can rely on that for anyone who wants the exact old values.

### 4.3 The Party Identity panel (after)

Keep the name "Party Identity" and its opener (the badge). Contents, top to bottom:
1. Large crest frame (168 px) with the **Party Name** above it, or "No crest yet".
2. **Party Name (optional)** text box, 40-character limit, hint "Shown above your crest. Leave it blank for none." Saved on Enter or leaving the box, using `setValue()` so a redraw while typing never clobbers it. A small "Clear" is not needed (empty box = no name).
3. The crest buttons: **Create in the Clan Crest Creator ↗** (the filled crimson main action while there is no crest, outlined once there is one), **Upload a picture...** / **Upload another...**, **Remove** (asks first, as now).
4. Status line (`crest-status`) as now.
5. Close.
Everything about Clans (pill, requirements, Form Clan, Honour box) is gone. The panel gets shorter, so it fits all four test sizes more easily.

### 4.4 The badge (after)

- Still a `<button>` (`data-test=identity-badge`), still top-right, still opens Party Identity (keyboard Enter works).
- Layout: **Party Name above the crest** (clamped to 2 lines, the same 11 px capitals as today's label), crest 76 px below it. The bottom label ("Unsworn" / Clan name) is removed, so the badge is **no taller than today** (see 7). With no crest, the dashed shield and "Add a crest" stay as now; with no name, nothing is drawn above the crest.
- Spoken name (`aria-label`): "Crest of <Party Name>. Open Party Identity." or, with no name, "Crest of the Ironbow. Open Party Identity." (unchanged), plus ": no crest yet" while empty. The full name goes in the `title` tooltip so a clamped name can still be read.
- `crestName()` (1145) becomes: `'Crest of ' + (state.partyName || 'the Ironbow')`.

## 5. What happens to Clan Relations and Diplomatic Records

**Nothing needs to change, and nothing needs migrating.** Checked:
- `R.clanRelations(s, data)` (`tools/bastion/diplomacy-rules.js:364-387`) lists the **seven canonical Clans** (`data.bastion.clans`, `bastion-data.js:181-188`), each with `honourRespectByClan[key]` and `politicalCapital[key]` plus running restrictions, privileges and obligations. The party is never a row.
- Diplomatic Records name Clans by key (`dipClanName`, `diplomacy-rules.js:55-67`); a record without a Clan shows as "The Ironbow" (line 269, fixed text, never the Clan's name). They affect HR and PC only through `R.adjustStanding` and `s.politicalCapital`.
- `tools/bastion/tool.js` 2555-2640 draws the Clan Relations box and the ledger; neither reads `organization`.
- Explorer standing outcomes (`bridge-rules.js`) write only to a Clan's HR.

Cross-area, for whoever owns the Hall (not my change): the handover keeps "Clan Honour/Respect, Clan Political Capital, Diplomatic Events" in the Hall. Today's **Clan Relations** box already shows exactly H&R and PC per Clan, and **Diplomatic Records** is "Diplomatic Events". But the *editable* HR and PC rows, the "Honour Change" button at PC +-100, the derived **Support** number, the "Changes from the Explorer" list and Favour Tokens are all in the **Clan Influence** panel, which the handover deletes. The DM doc already has a "set a Clan's PC/HR/Favour by hand" dialog (`dmdoc.js:221-283`, applied by the Bastion once through `dmEdits`), so a way to set HR and PC survives. If Support is not wanted in the Hall, `R.supportForClanKey` (rules.js 2998) has no reader left after Form Clan goes; and `tests/e2e/bastion-screen.test.js:845-856` and `phase9.test.js:861-885` that test Clan Influence need rewriting.

## 6. Tests and docs that mention these things

### 6.1 Rules tests (`tests/rules.html` runs them in a browser)
- `tests/rules/bastion.test.js`: 142-143 (default `organization.type === 'unsworn'`, `clanHonor === 40`); group "Bastion: identity" 794-830 (support formula 797-803, `canFormClan` 805-815, requirements line and `identityRules` keys and `orgLabel` 817-828); Brigade-load test 830-845; `warAvailable` with `organization.type` 855-858; `atWar()` helper 879; `migrateToV3` keeps `organization` 1415 and 1421; save-and-reload keeps identity 1922-1923.
- `tests/rules/bastion-campaign.test.js`: war tests that set `organization` or read `clanHonor` (lines 34, 256, 298, 357, 932, 1031, 1044, 1056, 1073-1076, 1085, 1095, 1174-1176, 1408, 1747, 1794-1805, 1835, 1854, 1900, 1942). **All war**; they go or change with the war removal.
- `tests/rules/bridge.test.js:713` and `tests/rules/creatures.test.js:715` set `organization = clan` so creatures can be committed to war; war only.
- `tests/rules/beasthandler-projection.test.js:181`: see 1.4.
- `tests/rules/crest.test.js`: the Crest Creator's own rules; unaffected.
- **New rules tests to add** (suggested): `partyName` cleaning (trim, collapse spaces, 40-character cap, non-string becomes `''`); load of a Clan-founded save seeds `partyName` once and keeps `organization` and `clanHonor` untouched; clearing the name is not undone on the next load; a save with no `partyName` loads `''`; `R.formerClan` returns null the second time; the name never appears in the Beast Handler snapshot; `crestName`-style helper (if moved into rules).
- `tests/fixtures/bastion-*-sample.json` (7 files, all `organization.type: 'unsworn'`): still load fine; add one `bastion-clan-formed.json` for the migration test. (These sample files will be regenerated by the strip-back anyway.)
- `tests/archive/`: add `form-clan.test.js` if the code is archived; `mercenary-brigade.test.js` already cannot run once the war rules go (another area decides).

### 6.2 Click-through tests (`tests/e2e/`, Playwright, file://)
- `phase9.test.js`:
  - 856-935, section "Party identity and the War Council": "Form Clan needs level 9, 360 support and 3 clans at 55" (861), "Honour/Respect edits change support at once" (873; Clan Influence), "founding a Clan" (880-896), "a crest can be added later... beside the name" (898-935; compares the crest to the `org` pill, so it needs a new anchor).
  - 1402-1409 "identity ... survive reopening" (asserts `organization`, `clanHonor`, `text 'org' === 'Clan: Clan Ironbow'`).
  - 1409-1690 section "The crest, at any time (Build 3)": the Creator window opens (1453), the offer pop-up (1472), "sent again and used" (1486-1500; asserts the badge label `'Unsworn'`), "a crest sent while the Bastion is shut" (1503), "a crest that isn't a picture is never offered; a second Bastion window waits" (1532), "a refused file is explained; a picture can be uploaded" (1570), **"Form Clan keeps the Bastion's crest..." (1582), "a crest from the Creator accepted while Form Clan is open..." (1604), "founding the Clan with no new crest keeps the Bastion's..." (1624)** (all three go), "Download Save includes the crest..." (1641; asserts `organization.type`), "the War Table still has the crest" (1656; goes with the war).
  - 1805, 1866, 1908: set `organization` to a Clan to unlock war boxes (war).
  - Kept intact in spirit: the hand-off tests (Creator to Bastion, shut-Bastion, bad picture, second window, upload, remove, no day passes while the question is open). They only need new assertions for the badge label and `aria-label`, and the "Unsworn"/"Clan" lines replaced.
- `tests/e2e/bastion-screen.test.js`: 65 and 68-130 (badge in `MAIN`; "the crest badge clear of the Hall" and "inside the painting" at four sizes; labels and notices clear of the badge); 864-945 ("The Banner & War Council lock, and the crest badge"): layout of Party Identity and Form Clan at four sizes (889-912), and the badge states (918-942: "Add a crest", then 'Unsworn', then 'Clan Ironbow', with their `aria-label`s). Needs rewriting around the Party Name.
- `tests/e2e/phase2.test.js:633-700`: "Use for the Bastion" from the Creator (sends 512 x 512 PNG, shut-Bastion notice, opens the Bastion and asks, checks `c.design.clanName`). Unchanged unless the Creator is renamed.
- `tests/e2e/creatures.test.js:575-576`: sets a Clan and `clanHonor` for war; war only.
- `tests/e2e/phase4.test.js` `clan-honour` (98, 163-165) is the **Notice Board's** dropdown. Unrelated; only the data-test name clashes with the Bastion's `clan-honour` box, which goes.
- `tests/e2e/README.md` lines 26, 33, 38 describe these tests; update the wording.
- **New e2e checks to add** (suggested): the Party Name box saves on Enter and on blur, survives reopening and a reload, is cleared by emptying the box, caps at 40 characters, is not overwritten by a redraw while typing; the name shows above the crest on the badge at laptop, laptop full-screen, TV and the small window with the badge still clear of the Hall; a long name is clamped to two lines and the full text is in the tooltip; no "Clan", "Unsworn", "Form Clan" or "Found a Clan" text anywhere in Party Identity; a Clan-founded save imports, the notice shows once, and the name is seeded; Download Save and Reset include and clear the name.

### 6.3 Docs and guide to update
- `guide.html` lines 195 (list of bottom-bar buttons, "opens Party Identity"), 248 (badge and crest; says "Unsworn or a Clan" and "your tokens on the War Table"), 249 (the whole Form Clan paragraph; delete).
- `docs/BASTION-EXPLORER-REFERENCE.md`: glossary 8, 20, 49 (Clan Honour), 55 (Unsworn), 56 (Crest "on the War Table"); 170 (`organization.foundedAtDay`); 798-801 (badge); 816; 828; 843 ("Form Clan needs level 9"); **5.9 "Identity and the crest" 1187-1215**; 1230, 1281, 1392-1402 (war outcomes by Clan); 1473 and 1478 (save contents); 1751-1752 (rules table); 1859; 1940.
- `docs/BASTION-OVERHAUL.md` section 4 (lines 183-200, "The crest, at any time": the Party Identity panel and Form Clan bullets) and 3 (Brigade); `docs/BASTION-MAP-ART.md` 16, 87, 119, 147 (badge geometry; unchanged but re-check after new art); `docs/WAR-RULES.md` Clan Honour (2 lines); `docs/FACILITIES-OVERHAUL-PLAN.md` 200 and Clan Honour mentions; `docs/PLAN.md:207`.
- `docs/KNOWN_ISSUES.md`: BAS-01 (1350-1357, identity survives reload), BAS-66, BAS-67 (2036-2047), BAS-68 and others mention Form Clan. Add a new entry (next free number after BAS-98 is BAS-99, but the other areas will also need numbers, so allocate together), "Deliberate change (Harry, 22 October 2026): Form Clan removed, Party Name added", with one-line before/after, saves note and what was archived.
- `docs/PROGRESS.md` (1,060 lines; new "Done" entry and the open questions).
- `tests/e2e/README.md` (above).

## 7. Badge geometry the tests enforce (measured, laptop and TV)

Measured with a headless browser on file:// (script `analysis/c-badge-measure.js`):

| Window | Badge (w x h) | Gap from the badge's bottom to the Hall's picture (`y 376` on the 3000 x 1250 painting) |
|---|---|---|
| Laptop 1707 x 930 (ratio 1.5) | 112 x 109 | **68 px** |
| TV 1920 x 1080 | 112 x 109 | **113 px** |
| Small 1280 x 720 (ratio 1.5) | 112 x 109 | **4 px** |

`tests/e2e/bastion-screen.test.js:80-88` fails if the badge overlaps the Hall's box (`x 2595-2943, y 376-649`), if it leaves the painting, or if a facility label overlaps it. So **the new badge must not be taller than today's**: putting the name above the crest and removing the label below it keeps it the same height. A third line of text or a bigger crest would break the small-window check (and eat the laptop's 68 px margin). Also, the 12 px inset from the top is fixed because the painting's top edge is the limit.

Cross-area risk: the strip-back removes many facilities and adds a Temple and a Beast Pit; if Harry sends new map art or overlays, the Hall's box and the badge clearance (`docs/BASTION-MAP-ART.md` section 4) must be re-measured. The Hall stays as one building, so its overlay should not move.

## 8. Contradictions, ambiguities and conflicts spotted

1. **"(party identity)" in "found their own Clan (party identity)"**: read as "the Clan is what the party identity was". The heading "Form a Clan / Party Identity Overhaul" keeps the panel; only Form Clan goes. If Harry actually wanted the whole Party Identity panel replaced by something else, the Party Name and crest controls need a different home (the badge being the only opener).
2. **"once selected"** (name above the crest "once selected"): ambiguous between "once the crest is chosen" and "once the name is chosen". Default chosen: show the name whenever it is set, even before a crest exists, above the dashed shield.
3. **"create ... and apply it here"**: the Crest Creator is a separate tool opened in a new window, which sends the crest back with "Use for the Bastion". "Apply it here" may mean inside the Bastion panel. Embedding a Creator (five tabs, 20 sigils, 17 shields) in the Bastion would be a large change and is not described; default is the existing hand-off.
4. **Handover keeps "Clan Honour/Respect" in the Hall but deletes the Clan Influence panel that edits it** (see section 5). Not an identity issue, but the Hall owner must give HR and PC a visible home; the DM doc's score editor already writes them.
5. **"Remove ... no more war games VTT"** removes the only other consumer of the crest (the War Table tokens). The handover does not say so, but it makes "the War Table crest" disappear from my scope entirely.
6. **CLAUDE.md "faithful rebuild" rules** (don't remove features) are superseded here by Harry's explicit instruction; fine. The old `docs/BASTION-OVERHAUL.md` section 4 and BAS-67 describe a design that is now being reversed in part (crest at any time stays; the Clan goes). The docs need a note, not just deletion, so the history reads sensibly.
7. **Name clash**: `data-test="clan-honour"` is used by both the Notice Board's dropdown and the Bastion's Clan Honour box. Removing the Bastion's removes the clash.
8. **Wording left behind**: the Creator still says "Clan/Party Name" (placeholder `tool.js:269`, hidden label 428) and the tool is called "Clan Crest Creator" in the tool list, the top bar, the home card, the guide, and many tests (`phase1.test.js:21`, `phase2.test.js:89-90`, `core.test.js:8`). The handover does not ask for a rename; leave it unless Harry says.

## 9. Work list for the build (suggested order)

1. Rules: add `R.cleanPartyName`, `partyName: ''` in `defaultState`, load and seed in `R.fromSave`, `R.formerClan`; remove `canFormClan`, `totalSupport`, `clansAtSupport`, `requirementsHint`, `orgLabel` (archive them), `identityRules`; drop `organization`/`clanHonor` from defaults and from `shiftDays`/`saveProblem` (or keep inert). Keep `R.isCrest`, `R.crestFromHandoff`, `R.hashText`.
2. Screen: rebuild `idCard` and `renderIdentity` (Party Name box, crest, three buttons), delete `onFormClan`, `crestField`, the `formerBrigade` bits (or reword), update `crestName()`, `renderBadge()` (name above, no bottom label), the crest offer's text (1255), the Reset message (5328).
3. CSS: badge layout; delete `--found`, `crest-pick*`, `.tsi-bas-honour`, `.tsi-bas-req`; keep `.tsi-bas-status-pill` only if the turn pill needs it (it shares the rule).
4. Tests as in section 6, with the war-only lines going with the war removal.
5. Docs and guide as in 6.3; KNOWN_ISSUES entry; PROGRESS.
6. Re-run the badge-clearance measurements at all four sizes.

## 10. Questions for Harry (also returned in the structured output)

1. Where do you want to reach the crest and Party Name editor? Proposed: click the crest badge (as now), which opens a smaller Party Identity panel.
2. Is the existing "make the crest in the Crest Creator window, press Use for the Bastion, then confirm here" flow what you meant by "create and apply it here", or do you want a crest designer built inside the Bastion panel?
3. Show the Party Name even before a crest exists?
4. A party that already founded a Clan: carry its name over as the Party Name? (keeps chief, motto and honour hidden in the save)
5. Should the Party Name show anywhere else (DM doc Party panel, Beast Handler phone, the Crest Creator prefilled)?
6. Rename the "Clan Crest Creator" tool and its "Clan/Party Name" field now that Clans can't be founded?

Defaults that I settled myself (no question needed): badge stays clickable; 40-character limit; saved inside the Bastion's state; Form Clan code archived rather than deleted; the Hall's "Clan Honour/Respect" is the seven Clans' Honour/Respect (not the party's own Clan Honour); Diplomatic Records and Clan Relations need no migration.
