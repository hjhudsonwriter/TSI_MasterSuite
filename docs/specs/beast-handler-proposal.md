# Beast Handler: audit and phased proposal (BH-0)

Status: **approved by Harry on 21 October 2026 (D1 to D8 as recommended; D9 does not apply). Building BH-1.**
Source brief: *BEAST_HANDLER Claude Code Handover* (20 pages). Section numbers below match the brief's section 19.

---

## 0. The short version

- Most of what the companion needs **already exists** in the Bastion: named creatures, handlers, bond, temperament, Chronicle, training orders, training places, first flight. The companion should *read* from these and *ask* the Bastion to act. It must not copy any rules.
- The hard part is not the screens. It is **how a phone talks to a Bastion that lives in a laptop's browser and works from a double-clicked file.** No version of "live" works without something on the internet in the middle. That conflicts with the current offline rule in `CLAUDE.md`, so it needs your explicit decision.
- I recommend building it in layers so you get value early and are never forced online:
  1. **Screens and rules first, same browser, read-only** (BH-1).
  2. **Safe commands and roll tables** (BH-2).
  3. **A zero-cost, offline "code swap" link** between phone and laptop (BH-3a), if you want phones before any hosting decision.
  4. **A live relay** (BH-3b) *only if you approve* a hosted service and a change to `CLAUDE.md`.
- Two points in the brief are out of date: Griffin Tower and Dire Wolf Den **now have** bonding, training and riding (merged in PRs #49–#51). See section 5.

---

## 1. Audit: what we can reuse (with file references)

| Need | Already in the repo | Notes |
|---|---|---|
| Tool registry and home card | `shared/data/tools.js` (groups `dm`, `world`, `players`, `set`) | Add one entry under **Players**. |
| Colours, fonts | `shared/tokens.css`, bundled Cinzel and Cormorant Garamond | Companion uses the brief's palette via tokens; no new fonts. |
| Named creatures, housing | `R.cleanCreatures`, creature records in `tools/bastion/rules.js`; `tools/bastion/creature-rules.js` | Stable creature `id` exists. |
| Facilities and levels | `tools/bastion/data/facilities-data.js` (`wyvern_roost`, `griffin_tower`, `dire_wolf_den`) | Constructed status and level come from facility state. |
| Handler | `creature.development.handlerId` (`R.assignHandler`) | **Free text today.** See conflict 6. |
| Bond | `development.bond {level, ready}`, `R.BOND_NAMES`, `R.confirmBond` | DM-confirmed only. Keep. |
| Temperament | `development.temperament {dominant, attachment, trigger}`, `R.setTemperament` | Reuse directly. The brief's three profile fields are these. |
| Chronicle | `development.chronicle[{id,day,cat,text,by,link}]`, `R.addChronicle`, `R.CHRONICLE_MAX` | Read-only in the companion. |
| Training orders and rules | `R.trainingOptions/trainingBlocker/issueTraining/completeTraining/tickTraining/trainingStatus`; `creatures-data.js` `development` config | Wyvern 14, Griffin 13, Wolf 13 functions. Final validation stays here. |
| First flight | `R.firstFlightChecks/confirmFirstFlight`, `firstFlightPartyLevel: 13` | DM action. Not player-issuable. |
| Exactly-once messages | `shared/js/bridge-rules.js` (once-only messages with receipts, single writer) | Pattern to copy for commands. |
| One window per tool | `shared/js/toollock.js` (Web Locks) | Only one Bastion window can process commands. |
| Same-browser hand-offs | `shared/js/handoff.js` | Same browser only. No phone. |
| DM to player window | `shared/js/player-link.js` (postMessage) | Same machine only. No phone. |
| Saves, backup, tab guard | `shared/js/store.js` (IndexedDB, `tsi.` keys), backup/restore | Companion data must survive these. |
| Tests | `tests/rules.html` + `tests/rules/*.test.js`; Playwright in `tests/e2e/` | Same pattern. |

**Not found, and needed:** a stable **handler identity table** (who "Elara's player" is, beyond a text name); a **Bastion state revision counter** for the brief's "expected revision" check; a **sanitised player projection**; the **d12 / d8 roll-table content** (only you can supply it).

**Firebase in the repo:** the only Firebase code is `tools/quests/shop-link.js` (Matt Owen's Knightly Treasures database). It **must not** be reused, extended or pointed at. Any live relay would be a *separate* project that you own.

---

## 2. Proposed folder structure and placement

```
tools/beasthandler/
  tool.js                 screens (Home, Creature, Profile, Orders, Chronicle)
  beasthandler.css        prefixed .bh- classes, uses shared tokens
  projection.js           PURE functions: Bastion state -> sanitised player snapshot
  commands.js             PURE functions: validate and apply a player command (runs in the Bastion)
  transport-local.js      same-browser transport (BH-1/2)
  transport-code.js       offline code-swap transport (BH-3a, if approved)
  transport-relay.js      live relay transport (BH-3b, only if approved)
  data/
    profile-tables.js     d12 temperaments, d8 cues, d8 triggers, regional varieties (content from Harry)
    art-map.js            species + chosen variant -> local image file
    player-orders.js      the allow-list of orders players may request
  assets/                 art, later animation layers
beasthandler.html         player-only entry page (see below)
tests/rules/beasthandler-*.test.js
tests/e2e/beasthandler-*.test.js
```

- **In the suite:** a card under **Players** in `shared/data/tools.js`, opening the tool inside the normal shell on the laptop.
- **For phones:** `beasthandler.html`, a separate page that loads **only** shared files and `tools/beasthandler/`. It does not load the Bastion, Explorer or any DM tool, so a shared link cannot reach them. This is how the brief's "shareable URL without the DM suite" is met.
- **Bastion side:** two small additions inside `tools/bastion/`: a Beast Handler panel (handler list, pairing, revoke, pending requests) and `commands.js` wired to the existing rules. No rewrite of the current UI.

---

## 3. Cross-device sync: options and costs

The wall: the Bastion runs from `file://` in one browser, its save lives in that browser, and a phone cannot reach it. Anything "live" needs a middle-man on the internet.

| Option | Live? | Cost | Setup | Offline Bastion kept? | Needs your approval for |
|---|---|---|---|---|---|
| **A. Same device only** (BH-1/2) | No (same browser) | £0 | None | Yes | Nothing. |
| **B. Code swap** (phone shows a snapshot code or QR; player's request is a short code the DM pastes or scans into the Bastion) | Near-live at the table | £0 | None. Player page can be a static file on GitHub Pages or sent to phones. | Yes, fully | Nothing, if the page is just a file. |
| **C. Managed relay** (Firebase or Supabase free tier; your own new project) | Yes | £0 at this scale, but needs an account, a card on some plans, and free tiers can pause or change | Account, rules, hosting the page on GitHub Pages | Yes, but sync only while the DM is online | A change to `CLAUDE.md` ground rule 2; hosting; account ownership. |
| **D. Peer-to-peer (WebRTC)** | Yes | £0 | Still needs a signalling server; flaky from `file://` | Yes | Same as C. Not recommended. |
| **E. Small server on the laptop** | Yes, same Wi-Fi only | £0 | Install and run a server; breaks "double-click, no install" | No | Not recommended. |

**Recommendation:** build A now, offer **B** as the first phone route, and treat **C** as optional later. B needs no accounts and no rule changes, and the table is where this is used anyway. C is the only route to true remote play.

**Things I have not verified, so BH-3b starts with a spike:** whether the Firebase/Supabase sign-in works from a page opened as `file://` (many sign-in methods need a real web address), and whether the Web Crypto features used for signing work from `file://` in Edge. I will not claim either until tested.

**Honest costs for C:** £0 in normal use at table scale, plus your time (setup steps I would write for you) and the risk that a free tier changes. Matt's database is not an option.

---

## 4. Permission model

Roles:

| Role | Can | Cannot |
|---|---|---|
| **DM** (the Bastion) | Everything it can today. Is the only writer of the Bastion save. | Nothing new. |
| **Handler** (player linked to a creature) | See own creatures in full; edit allowed profile fields; request allowed orders for **own** creatures; read own Chronicle. | Rename, change species, owner or handler, set bond, confirm bond or first flight, alter trained abilities, edit combat stats, edit Chronicle, spend on anything outside allow-listed orders. |
| **Other player** | See the directory entry (name, species, facility). | Open detail, edit, or order. Read-only detail only if you approve it (decision D4). |
| **Anonymous** | See a "not paired" screen. | Anything else. |

Pairing (works for B and C):
1. In the Bastion, the DM opens **Beast Handler**, picks a handler, and creates a **one-time pairing code** (expires in a set time, single use, revocable).
2. The player enters it on their phone. The phone then holds a **per-handler key**.
3. The key is tied to a **stable handler ID**, not a display name. Changing a creature's handler or revoking the key stops access at once.
4. **Enforcement in two places:** the relay (if any) filters what a handler can read; the **Bastion's command processor re-checks every command** against current state and handler. Hidden buttons are not security.
5. **Player payload contains only:** the projection fields in the brief's section 13. Never Treasury, DM notes, other facilities, or any raw save.

---

## 5. Conflicts between the brief and the current code

1. **Offline rule vs live sync.** `CLAUDE.md` forbids online services except the Knightly Treasures link. Option C needs an amendment. I will not make it without your yes.
2. **Griffin and Wolf training already exist.** The brief says to show "no handler training orders available" and treat them as a future phase. They now have 13 functions each (bonding, training, harness, first flight, riding). **Decision D2:** expose them, or hold them back for now.
3. **Pending-order lock vs Roost training places.** The Bastion allows several trainees at once (places 1/1/2/2/3 by level). The brief locks the *player* out of ordering if **any relevant order is pending at that facility**. I will implement this as a **companion-only rule** (`commands.js`), leaving the DM's multi-slot training untouched. Open question: does another player's creature in training lock *my* creature's orders (literal reading), or only my own? **Decision D3.**
4. **Money.** The bespoke riding harness costs 150 GP from the party Treasury. A player-issued request would spend shared gold. **Decision D5:** may a player request paid orders, or only free training (DM does the harness)?
5. **Which orders players may request.** Harness fitting and first flight are DM-confirmed milestones. I propose an allow-list file (`player-orders.js`) containing **standard training only** until you say otherwise.
6. **Handler is free text today.** It needs a stable handler list (new small registry in the Bastion save, additive, with a migration that maps existing names). No destructive schema change.
7. **No state revision counter.** I propose a small monotonic counter, bumped on each saved change, used for the stale-command check. Additive.
8. **Chronicle may contain DM-only text.** Entries are DM-authored and can include things you would not want a player to read. **Decision D6:** show everything, or add a per-entry "DM only" flag (small schema addition).
9. **Single Bastion window.** Only one Bastion window can process commands (Web Locks). If the Bastion is closed, requests stay queued and are shown as "awaiting Bastion". This matches the brief.
10. **Regional Variety** is new: one optional string under `development`. `R.cleanDevelopment` must be extended to keep it (tested with save, export, import, restore).
11. **Menagerie** stays out of scope, as the brief says.

---

## 6. Phased pull requests and acceptance tests

Each PR is independently testable and leaves the suite working from a double-click.

**BH-0 (this PR): proposal only.** Done when you approve or amend it.

**BH-1a: projection (rules only, no screens).**
- `projection.js` builds the sanitised snapshot for one handler, plus the directory view.
- Tests: Elara's wyvern loads with name, handler, Bond 1, temperament and Chronicle; Griffin and Wolf housed creatures appear; unbuilt facilities do not; waiting or unhoused creatures do not; two creatures in one facility stay separate by ID; renaming and re-handling in the Bastion change the snapshot; **leak test**: snapshot contains no Treasury, DM notes, other facilities or raw state.

**BH-1b: shell and read-only screens.**
- Card under Players; `beasthandler.html`; Home, Creature, Profile, Orders and Chronicle screens with placeholder art; all write buttons visibly disabled; sync indicator says "same device".
- Tests (Playwright, 390×844 and 1707×930): no sideways scroll; 44 px targets; reduced motion respected; empty states (no facility animals, no assigned beasts); Chronicle shows no edit controls; bond bar 0–5.

**BH-2a: profile data and roll tables.**
- `profile-tables.js` (content from you), `development.regional` kept by the cleaners, roll then confirm Save, reroll or edit, text cleaning (length, whitespace, no HTML or script).
- Tests: survives save, export, import, restore; no roll changes bond or stats; Elara's Bond 1 intact.

**BH-2b: command processor in the Bastion.**
- Command shape: command ID, campaign ID, handler ID, creature ID, facility ID, type, expected revision, validated payload. Types: `profile.set`, `order.request`.
- Exactly-once with receipts (same pattern as `bridge-rules.js`); stable accepted or rejected receipts with reasons; the companion-level pending-order lock.
- Tests: one command makes exactly one order; a duplicate, retry, refresh or reconnect adds nothing; stale handler, unhoused creature, changed level, conflicting pending order, ineligible creature and stale revision all fail cleanly; Player A cannot order for Player B's beast; gold moves only through existing rules; day advance completes the order normally; DM-side multi-slot training still passes its existing tests.

**BH-2c: write flows, local transport, DM panel.**
- Bastion Beast Handler panel (handler list, pairing code, revoke, pending requests). Companion shows the brief's states: available, submitted and waiting, accepted and scheduled, refused with reason, facility busy, offline, completed (on next snapshot).
- Tests: end-to-end same-browser flow; revoking or changing handler locks the phone view; button tap never shows "started" before a receipt.

**BH-3a: code-swap transport** (only if you choose option B).
- Snapshot code or QR out; request code in; pairing codes; tamper checks.
- Tests: tampered or replayed code rejected; request applied once; Bastion still fully offline.

**BH-3b: live relay** (only if you approve option C and amend `CLAUDE.md`).
- Starts with a short spike: sign-in from `file://`, free-tier limits, rules written and tested. Then deployment, snapshot publish, command queue, receipts.
- Tests: unauthenticated client cannot write; cross-handler writes refused by the service *and* the Bastion; no private data in payloads; offline Bastion unaffected.

**BH-4: art, animation, polish.**
- Your portraits and Stitch designs, `art-map.js`, CSS idle motion, pause when hidden, mobile performance, iOS Safari / Android Chrome / Edge checks.

**Compatibility checks on every PR:** the suite still opens from `file://`; old backups restore; the Explorer-Bastion bridge is untouched; no destructive migration; no network request from any existing tool.

---

## 7. Decisions I need from you

Nothing below is guessed. Defaults are my recommendation.

- **D1. Phone route.** A only (same device), A + B (code swap), or A + B + C (live relay)? *Recommend A + B now; revisit C later.*
- **D2. Griffin and Wolf.** Expose their existing training orders in the companion now, or hide them until later? *Recommend expose, same allow-list rules.*
- **D3. Pending-order lock scope.** Lock a player out if **anyone's** creature is training in that facility, or only **their own**? *Recommend as written (whole facility) unless it annoys players.*
- **D4. Other players' creatures.** Directory entry only, or also a read-only detail view? *Recommend directory only.*
- **D5. Paid orders.** May players request orders that spend gold (e.g. the 150 GP harness), or leave those to you? *Recommend free training only.*
- **D6. Chronicle visibility.** Show every entry, or add a "DM only" flag per entry? *Recommend the flag.*
- **D7. Roll-table content.** I need your d12 temperaments, d8 attachment cues and d8 triggers per species, plus regional varieties. I will not invent them.
- **D8. Handler list.** OK to add a small handler registry to the Bastion save, with existing handler names mapped across automatically?
- **D9. If you choose C:** you would create and own the hosted account, and I would amend `CLAUDE.md` ground rule 2 in a separate PR for you to approve first.

Deferred as you asked and not touched here: Explorer collecting parcels before the Bastion opens, Courier Levels 3–5, research trees, upkeep deductions, War Room doctrines, Grand War Exercises, the Hall's wider overhaul, Stone Quarry / Weavers' Hall R&D.


---

## 8. Decisions recorded (Harry, 21 October 2026)

| # | Decision |
|---|---|
| D1 | Phone route: **A + B** (same device now; the offline code swap later). No live relay. |
| D2 | Griffin and Dire Wolf training orders are shown in the companion, with the same rules as the Wyvern's. |
| D3 | The pending-order lock is for the **whole building**: while any order is pending there (**amended 21 October 2026: a pending training programme only; House orders and Upgrades no longer lock**), the phone offers no new order and shows the pending one and its due day. The DM's own training places are untouched. (Built to read "any order", including a House order or an Upgrade; say if you want training orders only.) |
| D4 | Other players' creatures: directory entry only. |
| D5 | Players may request **free training only**. The 150 gp harness, House orders, milestones and the first flight stay with the DM. |
| D6 | The Chronicle gets a **DM only** flag on notes. Built in BH-1a: the Bastion's Add a note box has a tick box, the flag is saved and kept by the save cleaner, and the player view leaves those notes out. |
| D7 | Harry supplied the d12 temperament table, the Wyvern / Griffin / Dire Wolf d8 attachment cue and instinctive trigger tables, and fifteen Regional Varieties. Saved as `tools/beasthandler/data/profile-tables.js`. "Tidecliff Wyvern" in his worked example is not one of the fifteen, so it is treated as an example only. |
| D8 | A small handler list in the Bastion save, with existing handler names mapped across (BH-2c). Until then a handler is matched by name, ignoring capitals and spacing. |
| D9 | Not needed (no live relay). `CLAUDE.md` stays as it is. |

Profile rules Harry set (for BH-2a): Roll shows a suggestion and saves nothing; the player can reroll, pick another option or type their own; Save asks the Bastion; later edits are logged for transparency but are **not** put into the Chronicle; a roll never changes bond, stats, training or abilities; Elara's wyvern can have its four lines chosen rather than rolled.

---

## 9. What was built (21 October 2026)

| Phase | State | Notes |
|---|---|---|
| BH-0 proposal | Approved | Harry's decisions are in section 8. |
| BH-1a projection | Done | `tools/beasthandler/projection.js`, with leak tests. |
| BH-1b read-only screens | Done | Home, a beast's main screen, Profile, Orders, Chronicle. |
| BH-2a profile data and rolls | Done | `profile-tables.js`, `profile-rules.js`; `development.regional` and a change log are kept by the save cleaners. |
| BH-2b command processor | Done | `bastion-link.js`; exactly-once receipts in `s.beast.done`. **Different from this proposal:** a request carries the revision of the screen it was made from, but the Bastion does not refuse on it. Orders are re-checked against the live save; a profile change is last writer wins and is logged. |
| BH-2c write flows and the DM's panel | Done | A box in the Bastion's Management panel; the companion's buttons are on. |
| BH-3a code-swap transport | Done | `beasthandler.html`, `codes.js`, `shared/js/hmac.js`. No QR codes: the codes are long, so they are pasted or sent as a file. |
| BH-3b live relay | Not wanted | Harry chose no relay (D1, D9). |
| BH-4 art and polish | Part done | All fifteen portraits (five Dire Wolves, five Wyverns, five Griffins) shown by Regional Variety. No animation yet. |

See `docs/PHONE-PAGE.md` for how the phone page works and which files a phone needs.

---

## 10. Decisions after testing (Harry, 21 October 2026)

- **Hosting the phone page:** publish the whole suite on GitHub Pages (an iPhone can't open a local file). Pages should publish `main`, folder `/ (root)`.
- **Building lock:** training programmes only (House orders and Upgrades no longer lock).
- **Reasons the DM types for a bond or handler change:** stay visible to players.
- **Pairing codes:** no expiry, any number of phones: fine as built.
- **Handlers:** matched by name: fine.
- **Griffin pictures** (confirmed): fiery russet and bronze = Embermantle; brown head and silver-grey shoulders = Galeclaw; pale silver and white = Silvershroud; steel-grey with lightning = Thunderwing; gold and ivory = Dawnmantle. Harry uploaded all fifteen pictures to the repository the same day (`WY_`, `GR_` and `DW_` files, each named for its variety); they are in use.

## 11. The new look and the first meeting (Harry, 22 October 2026)

Harry sent Google Stitch mock-ups and asked for: the Beast Handler's colours to follow them; the beast's page to follow the "Elara's Wyvern" mock-up (the picture as the centrepiece with no rune border, the subspecies name under it, bond pills, Profile / Orders / Chronicle at the bottom, the picture empty until a subspecies is chosen); a first-time cinematic when a player meets their beast (three panels, then a fade to black, "Welcome to the Ironbow", and the reveal); and soft fades between screens. All built; see BH-05 in `docs/KNOWN_ISSUES.md` for the judgement calls and `docs/PROGRESS.md` for the summary.
