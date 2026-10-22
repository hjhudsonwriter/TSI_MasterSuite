# AREA F: the merged Temple, the reduced Hall of Emissaries and the enlarged Dock

Analysis only. Nothing in the repo was changed. Code read at branch `claude/gallant-ramanujan-klwz70` (main at 4f1db26, plus the picture-filing commit 76c1276). A scratch Playwright probe (`.../analysis/f/probe-f.js`, run from file:// at 1707 x 930, offline) confirmed the current screens; its screenshots are `dock-now.png`, `hall-now.png`, `shrine-now.png`, `routes-now.png` in `.../analysis/f/`.

Sibling reports read for overlap: `A-facilities.md` (facility side of the Temple, Barracks/Watchtower protections, migration frame). Where I agree I say so; where I go further (blessing consumption, Hall and Dock, Routes map) it is new.

---------------------------------------------------------------------
## 0. The short version

1. **The code has no "Temple of X".** The three facilities are `shrine_telluria`, `shrine_aurush`, `shrine_pelagos`, named "Shrine of X" (facilities-data.js 2434-2810). "Temple of Telluria" etc. exist only as world scenery text in `shared/data/regions.js` (the `temple:` field) and the Notice Board's "Temple Honour". Harry's "Temple" = the Shrines. A new facility called `temple` / "Temple" should be used; the world "Temple of ..." strings must not be touched.
2. **None of the three gods has exactly three "blessings".** Each Shrine has: Craft (2 charms), Pray (3 prayers, only one of which adds Favour), and four level orders (L2, L3, L4, L5). So each god has four candidate blessings, and Harry's Pelagos example silently skips the L3 one. Telluria's L4 candidate (Bless Bastion Foundations) cannot be ordered at all today ("waiting"). This is the biggest content decision in the Temple.
3. **"Pray" is a 1-day order today, not an instant roll.** Only the third prayer ("X's Blessing", special `favour_blessing`) adds 1d20 % to the god's bar (rules.js 2626-2630). The other two prayers (hint on d10 4-7; long rest on d6 5-6) and the six Craft charms are not mentioned in the handover.
4. **Today's Favour costs are 0 / 5 / 10 / 25 % (L2 / L3 / L4 / L5). The handover makes every blessing cost the whole bar (100 %).** That is a rule change, not a copy. A full bar takes about 10 prayers (1d20 averages 10.5), so a Great Rite goes from roughly 2-3 prayers to roughly 10.
5. **The Hall does much less than the handover implies it keeps.** After the cut it shows two things that already exist: the seven Clans' Honour/Respect and Political Capital ("Clan Relations") and the DM-written "Diplomatic Records" ledger. There is **no feature called "Diplomatic Events"** today (Harry's own Hall handover lists a procedurally offered event library as "not built, not approved"). I read "Diplomatic Events" as the Diplomatic Records ledger (its button is "Record an event..."). Needs a one-line confirmation.
6. **Almost every Political Capital source dies with the Hall and the war.** What is left: Diplomatic Records consequences the DM types in, the DM doc's "Change a score", and (for Honour/Respect only) Explorer events through the link. The "Honour Change" reset at +-100 lives in the Clan Influence panel, which is being removed.
7. **"Routes" has no cargo content today.** The Routes map shows only the *old* Consortium sea routes and old Trade Agreements, keyed by Clan. Those can no longer be created once the Consortium is gone. For the map to show "active trade routes" in the Dock it must be re-pointed at Port Charters and ships at sea (the Port Charter already carries a Clan, and the map art is one overlay per Clan). Needs Harry's yes.
8. **The Dock panel is already too long.** With 3 charters and nothing at sea its body is 1025 px tall in a 740 px window (scrolls). Adding Register Port Charter, charter terms (amend/reset/history), the Routes map and a sales ledger needs tabs or sub-sections.
9. **Hidden dependency:** the Dock's voyage-risk protections include the Barracks' Convoy and Watchtower's Approaches (both facilities are being removed). Only the Pelagos blessing has a new home (the Temple). See 5.7.
10. **Migration is the hard part.** Saves hold: built Shrines (up to three slot entries), Shrine pending orders (some already paid in Favour), a held Blessing of Pelagos, Great Rites, Hall pending orders (some paid in gold), running contracts and sea routes paying gold every 7 days, a dispute queue, Favour Tokens, Port Charters and charter terms histories. `tradeNetwork` holds BOTH the old Consortium data and the new commodity data, so it cannot simply be cleared.

---------------------------------------------------------------------
## 1. The three Shrines today (what the handover calls Temples)

### 1.1 Where it lives

| Thing | File and lines |
|---|---|
| Facility data, three blocks | `tools/bastion/data/facilities-data.js` Telluria 2434-2555, Aurush 2556-2688, Pelagos 2689-2810 |
| Each is `requiredLevel: 8` (build 21 days), a construction slot (not a plot) | same; build days `R.buildDaysForRequiredLevel` rules.js 1182 |
| God id from facility id | `R.shrineGod` rules.js 624: regex `^shrine_(telluria|aurush|pelagos)$`. **A facility called `temple` returns `''`.** |
| God names | `R.GOD_NAMES` rules.js 625; `B.gods` bastion-data.js 352-357 |
| Favour state | `s.favour = { telluria, aurush, pelagos }` 0-100: defaultState rules.js 126; `fromSave` 374 (`numMap` clamp); `saveProblem` 1045 lists `favour` as a map |
| Add Favour | `R.addFavourPercent` rules.js 2314 (clamped to 100) |
| Pay Favour | `R.favourBlocker` rules.js 627-633 (refuses, with words); spend in `R.issueOrder` 1932-1948 (`s.favour[R.shrineGod(fac.id)] -= favour`, recorded on the order as `o.favourCost`) |
| Complete prayers | `R.completeSimpleOrder` rules.js 2624-2640 |
| Complete Pelagos Blessing | rules.js 2674-2681 (`fn.protectionCharge`) |
| Complete Great Rite | rules.js 2682-2687 (`fn.greatRite`; id `'rite-' + order.id`, so a rite can never be made twice for one order) |
| Great Rite names / god | `R.RITE_NAMES`, `RITES` map rules.js 597-598, `R.cleanGreatRites` 599-611, `R.assignGreatRite` 613-622 |
| Favour bars + Claim UI | tool.js 779-811 (`godIcon`, `GOD_PATHS` 50-54, `favourRows`, `favourCard`), redrawn in `renderSide` 880-907; bottom-bar button `openFavour` 5421, `panelButton('favour'...)` 5451; `openerFor` map 5634; CSS `.tsi-bas-god-icon--*` bastion.css 795-797 |
| Shrine panel extras | `shrineSection(facId)` tool.js 4105-4122 (Favour line, "Blessings of Pelagos held for the Dock: n", Great Rites list), added at 3849 |
| Issue-button wording for Favour | tool.js 3415-3421 ("Not enough Favour"), cost line 3443 (" · 5% Favour") |
| Tile art, map overlay, label | `B.facilityImages` bastion-data.js 25-27; map overlays 166-168; `mapLabels` 81-83 (x,y: aurush 1275,532; telluria 2252,722; pelagos 2668,840) |

### 1.2 What each Shrine offers (exact ids)

Every Shrine has six functions. Level gate is `requiredFacilityLevel`; Favour is `favourCost`.

| God | Function id | Label | Level | Days | Favour | What it does today |
|---|---|---|---|---|---|---|
| all | `craft` | Craft | 1 | 5 | 0 | Two charms into the Warehouse as plain rows (notes only appear on the option; BAS-35 says the effects are never shown) |
| all | `pray` | Pray | 1 | 1 | 0 | Three options, below |
| Telluria | `prepare_earthward_talisman` | Prepare Earthward Talisman | 2 | 3 | 0 | 1 `earthward_talisman` into the Warehouse (production order) |
| Telluria | `prepare_rootguard_salve` | Prepare Rootguard Salve | 3 | 4 | 5 | 2 doses `rootguard_salve` |
| Telluria | `bless_bastion_foundations` | Bless Bastion Foundations | 4 | 5 | 10 | **Not available**: `waiting` text, refused by `R.fnAvailable` 1839 (no Bastion event damages a facility by natural causes; Harry 18 Oct: stays unavailable, nothing invented) |
| Telluria | `great_rite_telluria` | Great Rite of Telluria | 5 | 7 | 25 | `greatRite: earths_endurance` waits at the Ironbow |
| Aurush | `prepare_blessed_lantern` | Prepare Blessed Lantern | 2 | 3 | 0 | 1 `blessed_lantern` |
| Aurush | `prepare_purification_incense` | Prepare Purification Incense | 3 | 4 | 5 | 2 portions `purification_incense` |
| Aurush | `consecrate_expedition_supplies` | Consecrate Expedition Supplies | 4 | 5 | 10 | 3 `cleansing_portion` |
| Aurush | `great_rite_aurush` | Great Rite of Aurush | 5 | 7 | 25 | `greatRite: cleansing_radiance` |
| Pelagos | `bless_voyage` | Bless Voyage | 2 | 3 | 0 | 1 `voyage_blessing` |
| Pelagos | `prepare_aquatic_protection_charm` | Prepare Aquatic Protection Charm | 3 | 4 | 5 | 1 `aquatic_protection_charm` |
| Pelagos | `bless_commercial_shipment` | Bless Commercial Shipment | 4 | 5 | 10 | `protectionCharge: pelagos_blessing`: +1 charge kept in `tradeNetwork.protections.pelagos_blessing`; the next cargo ship takes it (-10 percentage points of voyage risk) |
| Pelagos | `great_rite_pelagos` | Great Rite of Pelagos | 5 | 7 | 25 | `greatRite: tides_passage` |

The three **Pray** options (each Shrine), all 1 day, 0 gp:

| Option | Special | Result |
|---|---|---|
| Telluria's Guidance / Aurush's Insight / Pelagos's Tidings | `oracle_hint` | 1d10; on 4-7 "A hint is granted (DM decides the hint)" |
| Telluria's Embrace / Aurush's Radiance / Pelagos's Deep Rest | `blessing_rest` | 1d6; on 5-6 "Long Rest effects granted" |
| **Telluria's / Aurush's / Pelagos's Blessing** | `favour_blessing` | **1d20, added as that many % to the god's bar (cap 100)**; log "Rolled 1d20 = N. Added +N% to TELLURIA favour." |

The handover's "Pray to X ... increasing the favour of the gods by a generated dice roll" is the third row only.

### 1.3 The Favour of the Gods panel and its state

* Three bars 0-100 % (`state.favour`). At 100 % a **Claim** button appears (tool.js 794-798) and just sets the bar back to 0 with a Day Log line. Nothing else ever happened on Claim.
* "Shrine blessings add 1d20% to their god. At 100%, Claim it and the bar starts again from 0%." is the panel's whole logic. The panel is opened from the bottom bar's right-hand "Favour" button.
* Other readers of `favour`: the DM doc's god meter (`shared/js/campaign-rules.js` 286-293, `dmdoc.js` 364: the Favour of the Explorer Region's god) and the DM doc's "Change a score" edit kind `favour` (0-100, `dmdoc-rules.js` 105-118, applied in `R.applyDmEdits` rules.js 504-509). **Both keep working unchanged** as long as `state.favour` stays. Removing the panel does not need to remove the number; the Temple needs it.
* `Favour Tokens` (`diplomacy.tokens`, 0-999, shown in Clan Influence tool.js 862-905) are a different thing: earned only by a Host Delegation with two successes (rules.js 2482/2489), and **nothing ever spends them**. They vanish with Host Delegation.

### 1.4 What consumes each blessing (the chain, and what must survive)

| Blessing | Where it goes | Who uses it later |
|---|---|---|
| Earthward Talisman, Rootguard Salve, Blessed Lantern, Purification Incense, Cleansing Portion, Voyage Blessing, Aquatic Protection Charm | Warehouse goods (goods-data.js 56-65, kind `supply`) | Courier Exchange can carry all seven, each counting as 1 item (courier-data.js 40-46; `courier-rules.js` 291-293 text "and the Shrines' items"); they land in the Explorer's Travel bags (`shared/data/party-items.js` 42-109, `use: 'shrine'`); "Use..." counts a use; a tagged check offers the charm (`offer.tag`: terrain, vegetation, water) |
| Blessing of Pelagos (Bless Commercial Shipment) | `tradeNetwork.protections.pelagos_blessing.charges` | `R.voyageProtections` commerce-rules.js 248-255 reads it when a ship sails; `consumes: true` uses it up; -10 points, never below 0 (`R.voyageChance` 258) |
| Great Rites (Earth's Endurance, Cleansing Radiance, Tide's Passage) | `state.greatRites[]` `{ id, rite, god, madeDay, status: 'waiting' }` | Explorer "Start expedition" then "Give ..." (tools/explorer/journey.js 1139-1300): sends a `rite` message over the link, the Bastion marks it `assigned` once (`R.assignGreatRite`, applyInbox). One held at a time, expires when the expedition ends. `shared/data/party-items.js` 119-125 `TSI_DATA.shrineRites` (names, effects) |
| Bless Bastion Foundations | nothing; refused | no event to apply it to |
| Craft charms (Tellurian Root/Stone, Aurush Sun/Ember, Pelagos Tide/Current) | plain Warehouse rows; effects only in option notes | no code; not in the Courier list; hand-handled |

**Durations:** Craft 5 d, Pray 1 d, L2 3 d, L3 4 d, L4 5 d, L5 7 d (data `days`, one place to change).
**Effects on commerce / courier / war / explorer:**
* commerce: Pelagos blessing only (-10 voyage risk).
* courier: seven Shrine items are carried by the Courier.
* explorer: items in the Travel bags + Great Rites on expeditions.
* war: **none.** The Shrines have no war hook (no depend on Barracks, War Room etc.). Good: no Shrine blessing depends on a removed facility *except* Bless Bastion Foundations, which depends on an event system that does not exist.

Nothing the Shrines do depends on the Barracks, Armoury, Watchtower, War Room, Library, Arcane Laboratory, Menagerie or the beast buildings. Their only external coupling is the Dock (Pelagos), Courier, Explorer and DM doc.

---------------------------------------------------------------------
## 2. The new single Temple (from the handover) and how it maps onto the code

### 2.1 What the handover asks for
A single facility "Temple". Its panel is split into thirds, one per god (Telluria / Aurush / Pelagos). Each third: the god's name, the Favour bar, **Pray to X** (same as today's blessings prayer: +1d20 %), and **Receive Blessing** with a dropdown of 3 blessings, greyed out until that god's bar is full; choosing one spends the **whole bar**, then the bar resets.

### 2.2 Suggested data model (rules apart from screens, content in a data file)

* Facility `temple` (name "The Temple" or "Temple"), construction slot, party level 8 (inherit, build 21 days; A-facilities Q10 asks the same).
* Per god, in `facilities-data.js`:
  * `pray_telluria`, `pray_aurush`, `pray_pelagos`: separate functions (1 day, `special: { type: 'favour_blessing', god }`). **They must be three functions, not one with three options**, because `pendingSame(s, facId, fnId)` (rules.js 1808) refuses a second order of the same facility and function. Today three Shrines can pray at once; one function would stop that.
  * `receive_blessing_<god>`: one function per god, with `god` on the function and three options. Each option carries what it makes: `outputs` (Warehouse goods), `protectionCharge` (Pelagos blessing) or `greatRite`, and its own `days` (today's 3 / 5 / 7). `favourCost: 100`.
* **`R.shrineGod` must become data-driven** (read `fn.god`). If it is left as the regex, `R.favourBlocker` returns `''` for `temple`, the order is issued for free, and `R.issueOrder` executes `s.favour[''] -= 100`, creating a junk `favour['']` key (A-facilities §7 found the same). Call sites: rules.js 627-633, 1936, 1948, 2685; tool.js 4106.
* "Greyed out until full": `R.favourBlocker` already refuses with words ("Needs 100% of Pelagos's Favour; the Ironbow has 60%."). The existing button text "Not enough Favour" (tool.js 3421) is the same idea.
* The screen needs its own panel section (like `shrineSection`, the Dock's `cargoSection` and the Courier's), not the generic `fnRow` list. Reusable: `godIcon`/`GOD_PATHS` (tool.js 50-54, 779-789), `.tsi-bas-meter` bar CSS, god colours `--tsi-telluria/aurush/pelagos`.
* New rules functions (plain, testable): e.g. `R.templeBlessings(data, god)`, `R.canReceiveBlessing(s, data, god)`, `R.issueBlessing(s, data, god, idx, rand)`. Reuse `completeProduction`, the `protectionCharge` branch and the `greatRite` branch of `completeSimpleOrder` unchanged.

### 2.3 Exact blessings as they exist today, per god, with flags

Harry's example (Pelagos): Voyage Blessing, Bless Commercial Shipment, Great Rite of Pelagos. That is L2, L4, L5; the L3 Aquatic Protection Charm is not named.

| God | Candidates today (level) | Matches the "3" in the example? | Flags |
|---|---|---|---|
| Pelagos | Voyage Blessing (2), Aquatic Protection Charm (3), Bless Commercial Shipment (4), Great Rite (5) | Yes for L2/L4/L5 | **Four candidates, the example names three.** |
| Telluria | Earthward Talisman (2), Rootguard Salve (3), **Bless Bastion Foundations (4, unavailable)**, Great Rite (5) | Following the same L2/L4/L5 pattern would pick an order that *cannot be issued* | Harry (18 Oct) said it stays unavailable, nothing invented. It cannot be one of three live blessings unless something replaces it. |
| Aurush | Blessed Lantern (2), Purification Incense (3), Consecrate Expedition Supplies (4), Great Rite (5) | L2/L4/L5 works | Four candidates. |

No god depends on a removed facility (war, Barracks...). The only dead one is Bless Bastion Foundations. **Proposed default (same as A-facilities Q1):** Pelagos as in the example; Aurush Blessed Lantern, Consecrate Expedition Supplies, Great Rite of Aurush; Telluria Earthward Talisman, Rootguard Salve, Great Rite of Telluria. That drops Aquatic Protection Charm, Purification Incense, Bless Bastion Foundations, the six Craft charms and the hint/long-rest prayers. The items already made stay valid (keep the seven goods in goods-data.js, courier-data.js and party-items.js; otherwise Warehouse rows and Travel-bag stock lose their names).

### 2.4 Rule changes hidden in "spend the full bar"

* Cost goes from 0 / 5 / 10 / 25 % to 100 % for every blessing. Pace: expect ~10 prayers per blessing (1d20, mean 10.5). Three gods can pray in parallel (one 1-day Pray each). Worth a KNOWN_ISSUES "Deliberate change" line.
* **Instant or timed?** The handover does not say. The engine today only has orders (days). Two consistent readings: (a) Receive Blessing issues an order with the blessing's existing days (3 / 5 / 7), bar spent when the order starts (exactly how `favourCost` works today); (b) instant: the item/charge/rite appears at once. Default proposed: (a).
* **Cancel:** today Cancel never returns Favour or gold (B9 / BAS-96). Under (a) with a full bar spent, a mistaken Cancel loses a whole bar (~10 days of prayer). Default proposed: keep "no refund" for gold but refund the bar on Cancel of a Receive Blessing? That is a rule choice for Harry; keeping BAS-96's rule as-is is the faithful default, and it should be said on the button ("The whole bar is spent now and is not given back").
* A bar that reaches 100 % by a Pray stops at 100 (clamp). Praying at 100 % wastes the roll; consider disabling Pray at 100 % (my suggestion; not in the handover).
* The old **Claim** button disappears with the panel; Receive Blessing is the new reset.

### 2.5 Levels / upgrades
The generic Upgrade order exists for every facility (tool.js 3216-3234 `upgradeRow`; `R.upgradeCheck` rules.js 1478; days 7/14/21/28, 0 gp; `R.MAX_LEVEL = 5`). The handover only says "standalone single-level" for the **Hall**. For the Temple it says nothing, and the old level gates (L2-L5) were the unlock path for the four orders. Default (matches A-facilities Q2/Q10 leaning): **Temple is also single-level, all three blessings always available**, since the handover puts all three in one dropdown from the start. This needs a new `singleLevel: true` flag read by `R.upgradeCheck`, `R.levelUnlockSummary` and `upgradeRow` (also used by the Hall).

### 2.6 Map, tile, naming
* Three shrine paintings and overlays exist (`facilities/shrine_of_*.png`, `map/overlays/shrine_of_*.png`). `R.mapOverlays` (rules.js 1270) groups by picture, so one `temple` can list all three overlays and three labels; a single built Temple would draw all three buildings (A-facilities Q9). `B.mapLabels` is keyed by facility id (one label per facility), so three labels would need a small change or a single "Temple" label.
* Text: `party-items.js` "(from the Shrine of Telluria)" etc. (lines 51-108) should read "Temple"; `shared/js/campaign-rules.js` 46-47 (`shrine` word rule) can go; `FACILITY_NAMES` already makes "Temple" from `temple`. Explorer's `from.title: 'Shrine blessing'` (journey.js 1217) is message text only.
* **Do not rename:** the Explorer's roadside shrines (`roadside_shrine_*` events), `use: 'shrine'` (a code keyword), `shared/data/regions.js` `temple: 'Temple of ...'` (used by Explorer events as `{temple}` and by the Notice Board's Temple Honour).

### 2.7 Temple migration (from saves that have Shrines)
(See also section 6.) Per save field:

| Saved thing | Rule proposed |
|---|---|
| `builtExtras[]` entries `shrine_*` (0-3, built or building) | keep one `temple` entry in the first shrine's slot (built if any built; else the one ready soonest), free the other slots; same pattern as `R.migrateToV3` rules.js 256-275 |
| `facilityLevels.shrine_*` | delete (Temple single-level), or `temple = max` if the Temple keeps levels |
| `favour { telluria, aurush, pelagos }` | untouched; bars keep their values. (Optional: a god at >= 100 % can receive a blessing right away.) |
| `greatRites[]` | untouched (keyed by `rite`, not facility); the Temple's panel lists them as `shrineSection` does |
| `tradeNetwork.protections.pelagos_blessing` | untouched; the data row's `facId` text changes to `temple` (the `facId` and `order` fields in commerce-data.js are documentation only: `commerce-rules.js` never reads them) |
| pending Shrine orders (some already paid in Favour: `o.favourCost`) | carry over what survives: `pray` option 3 becomes `pray_<god>`; a surviving recipe (e.g. `great_rite_*`, `bless_commercial_shipment`) becomes the god's Receive Blessing option with its due day kept; **a dropped recipe (Craft, Guidance/Embrace prayers, Aquatic charm, Salve, Foundations...) is cancelled and its `favourCost` is added back to the bar** (cap 100); no gold was ever charged by Shrines (all `costGP: 0`). Say so in the Day Log and on first open. |
| Warehouse rows from Craft / items | untouched |

---------------------------------------------------------------------
## 3. The Hall of Emissaries

### 3.1 What it is today

* Facility `hall_of_emissaries`, `requiredLevel: 5`, a construction slot (data 1621-1807). Its own panel (not a generic facility panel): `openFacility` special-cases it, tool.js 3810 -> `dipCard` 2457-2482 (`data-test` panel `panel-diplomacy`, tile `tile-hall_of_emissaries`).
* **Levels:** generic Upgrade up to 5 (the Hall also has its own `hallUpgradePill` tool.js 2451, 2521-2523, and a retired `upgrade_hall` function). Diplomacy roll modifier `R.diplomacyModForHall` rules.js 2359: L1 +2, L2 +4, L3-5 +6 (+ `diplomacy.rep`, always 0). `levelEffects.hall_of_emissaries` bastion-data.js 124.
* **Functions** (data order): `upgrade_hall` (retired, hidden), `register_port_charter` (L1, 3 days, 0 gp, `portCharter: true`), `secure_trade_agreement` (**already retired**: `retiredNote`, hidden by `R.fnAvailable` 1842; running ones finish), `host_delegation` (L1, 5 d, 150 gp), `inter_clan_summit` (L2, 14 d, 450 gp), `arbitration_authority` = Secure Writ of Authority (L3, 10 d, 600 gp), `trade_consortium` (L3, 14 d, 900 gp). Each emissary action: planning box (`planHall` tool.js 4615), then 1-3 typed d20 rolls (`R.emissaryPlan` 2379, `R.applyEmissary` 2420-2555), result pop-up.
* **Panels inside it:** record boxes (Delegations, Summits, Arbitration, Consortiums, Trade Agreements), "Active passive income", **Clan Relations** (tool.js 2571-2589, rules `R.clanRelations` diplomacy-rules.js ~360-380), **Diplomatic Records** ledger (2590-2782; rules diplomacy-rules.js whole file), **Ironbow Trade Network** section (2784-2823: stability, expected income, yield, High-Risk Routing, invest pills `onNetworkUpgrade` 4607, route rows) and **Port Charters** box with terms (2826-2912), pills **Routes** (5107), **Resolve** (5046-5103), **Council Ledger** (5143-5240), footer **Clear Diplomacy Records** (2914) and Demolish.
* Day engine hooks: `R.tickDiplomacy` rules.js 2784-2823 (pays contracts weekly into the treasury, ends records, expires routes, clears cooldowns; called from `R.startDay` 3254); `resolveRoutes(true)` in `runDay` tool.js 4837-4839 (asks a typed d20 for a high-risk route; `R.routesToSettle` 3260 returns nothing unless `tradeNetwork.active`).
* Saved: `diplomacy { agreements, delegations, summits, arbitrations, consortiums, rep, cooldowns, tokens }`, `arbitration { queue }`, `tradeNetwork { active, strategy, stability, routes, highRiskRouting, yieldBonusPct }` (the legacy half), `diplomaticRecords { next, list }`, `politicalCapital`, `honourRespectByClan`.

### 3.2 What the handover removes, and the code that goes with it

| Handover says | Code that goes |
|---|---|
| Port Charter functionality leaves | `register_port_charter` function (moves to Dock), `portChartersBox` + `charterTermsBlock` + `onTerms` (tool.js 2826-2912), `hallTips.port_charter` |
| Routes panel leaves | pill + `onRoutesMap` (tool.js 5107-5141, art `ui/clan_trading_locations.png` + 7 `ui/<clan>_trade_route.png`) |
| Host Delegation, Secure Writ, Inter Clan Summit, Trade Consortium: all gone | four functions; `planHall` (4615-4656); `R.isEmissary`, `R.emissaryPlan`, `R.applyEmissary`, `R.hallBaseDays`, `R.withSummitDiscount`, `R.cooldownLeft/setCooldown`, `R.diplomacyModForHall`; `emissaryResult` modal; the `emissary` branch of `completeOrder` (4962-4995) and `R.orderKind` 'emissary'; `data.bastion.hallDC`, `hallTiers`, `tradeAgreementWeeks`, `delegation`, `reactions`, `hallClanOrder`, `hallTips`; art `ui/trade_signing.png`, `wax_stamp.png` (keep files, ASSETS.md says keep all art) |
| Remove all upgrade functionality (single-level) | `hallUpgradePill`, `levelEffects.hall_of_emissaries`, the retired `upgrade_hall`, `data.bastion.levels` use for the Hall; needs a `singleLevel` flag for the generic `upgradeRow` |
| Remove Resolve and Council Ledger | `resolveRoutes` (5046), `onResolveRoutes`, `openLedger`, `ruleDispute` (5143-5240), `R.rule`, `R.enqueueDispute`, `R.councilBonus`, `data.bastion.councilDC`, `arbitration` state, `trade_disputes.png` |
| (implied) Trade Agreements / Writs / Consortiums / Network | `R.tickDiplomacy` payouts, `R.passiveIncome`, `R.routeDC/routePayout/settleRoute/liveRoutes`, `R.completeNetworkUpgrade`, `R.issueNetworkUpgrade`, `networkUpgrades`, `tradeNetworkSection` (minus the Port Charters box), "Clear Diplomacy Records" |

Also touched: `shared/js/campaign-rules.js` `bastionComing` lines 95 (Hall "needs your roll"), 105-112 (contracts ending), 124-131 (route needing a roll) and the DM doc forecast become dead for new saves; the demolish text tool.js 4562 ("your agreements, contracts and sea routes carry on").

### 3.3 What remains, in the handover's words, and where it lives today

* **Clan Honour/Respect** = the seven Clans' `honourRespectByClan` (-5..+5) shown as "H&R" in Clan Relations. (NOT the party Clan's own `clanHonor` 0-100, which is the Party Identity panel's number and goes with Form a Clan.)
* **Clan Political Capital** = `politicalCapital` (-100..+100 per Clan), shown as "PC" in the same rows.
* **Diplomatic Events** = (my reading) the **Diplomatic Records** ledger: a DM-written record with title, Clans, day, situation, decision, outcome, notes and typed consequences; draft then confirmed; confirmed H&R and PC consequences are applied once with before/after (diplomacy-rules.js 297-305). Restrictions, privileges, favours owed, obligations and quest hooks are DM-tracked, never enforced. Stays unchanged (rules in `diplomacy-rules.js`, tests `tests/rules/diplomacy.test.js`, `tests/e2e/hall-records.test.js`). The Hall's own "Clear Diplomacy Records" never touched this ledger.
* **No other event system exists.** The d100 Bastion Events table (events-data.js) has no diplomatic entries and its panel is also being removed.

### 3.4 Political Capital and Honour/Respect: sources and sinks after the cut

| Source / sink today | After the overhaul |
|---|---|
| Hall action rolls: Trade Agreement, Writ, Consortium +25/+15/+8/-10/-20 (rules.js 2447-2449); Summit both Clans (2443-2446); Host Delegation +15/+8/0/-12 (2479-2487) | **gone** with the actions |
| Council Ledger +6/+2/-4, deadlock -2 (rules.js 2973-2987) | **gone** |
| Declaring / renewing war -30/-40/-50 and HR -3/-4/-5 (war-campaign-rules.js 1085-1091, 1185-1201; war-units-data.js 310-312); undo on cancel; battle results (1758) | **gone** with the War Room, War Council and war (other analyst's area) |
| Diplomatic Records consequences `hr` / `pc` (diplomacy-rules.js 297-305) | **stays**: the main way the Bastion changes PC/HR |
| DM doc "Change a score" (`dmdoc-rules.js` 105-118, `R.applyDmEdits` 489-531) | **stays** (the new DM doc has a "Change A Score" line) |
| Explorer events changing HR by +-1 over the link (`R.adjustStanding` 783, `R.applyInbox` 975) | **stays** (HR only; the Explorer never changes PC) |
| Clan Influence: HR typed box (tool.js 834-850), "Honour Change" reset at +-100 (828-832) | **panel removed** (Clan Influence). The only way to zero a +-100 PC then is the DM doc or a Diplomatic Record. Nothing else in the code needs the reset |
| Favour Tokens (`diplomacy.tokens`) | **gone**, never spent anyway |
| "Support" per Clan = round((PC+100)/2 + HR*4) (`R.supportForClanKey` 2998) | only used by Clan Influence and Form Clan (`R.canFormClan` 3009); both removed (identity analyst's area). Dead code after |

### 3.5 Hall: behaviour to preserve vs conflicts

* Harry (18 Oct, docs/MILITARY-DIPLOMACY-PLAN.md section 4): "Everything the Hall does today, and its saved data, stays until the separate Hall overhaul." and the Hall redesign handover (docs/specs/hall-of-emissaries-redesign.txt): "Do not erase historical contracts or income; migration policy must be approved before code." **The strip-back handover is that separate Hall overhaul and overrides this**, but it gives no migration policy for running contracts, routes, disputes or tokens. See 3.6 and 6.
* The Hall redesign document also says the Port Charter registration "possibility of immediate DM activation" is *not approved*. The new handover moves it without simplifying, so keep the 3-day order (see 5.2).

### 3.6 Legacy running data (decision needed; proposal)

A live save may hold: Trade Agreements (retired but still paying), Writs, Consortiums (each paying gp every 7 days through `R.tickDiplomacy` straight into the treasury), sea routes (`tradeNetwork.routes`; a high-risk or every-route-with-High-Risk-Routing sailing asks the DM for a typed d20 inside the day: `resolveRoutes(true)`), disputes in `arbitration.queue`, a Summit discount, delegations, cooldowns, Favour Tokens.

Without the Resolve pill and Council Ledger, an old route that rolls a bad failure files a dispute nobody can judge, and a high-risk sailing still demands a d20 in the daily flow. So "leave it all running with no screens" is not clean. Two workable policies:

1. **Stop at migration (recommended default):** keep the records as history (read-only list in the save, e.g. `legacyDiplomacy`), set each contract/route as ended on the migration day, stop all weekly payments, clear `arbitration.queue` and cooldowns, zero the Summit discount, set `tradeNetwork.active = false`, write one Day Log line with what ended and the gold the contracts would still have paid; **never touch** `portCharters, voyages, schedules, cargoSales, protections, marketLedger, parcels`. No gold taken back.
2. **Grandfather to natural end:** keep `R.tickDiplomacy` paying, keep `resolveRoutes` in the day flow, and keep a minimal screen for disputes. Keeps income and faithful to the older "do not erase" wording, but keeps ~300 lines of rules and UI alive purely for old saves.

---------------------------------------------------------------------
## 4. Hall pending orders at migration

Pending orders with `facId: 'hall_of_emissaries'` can be: `register_port_charter` (free, 3 d; moves to the Dock with its id and due day), `host_delegation`/`inter_clan_summit`/`arbitration_authority`/`trade_consortium`/`secure_trade_agreement` (gold already paid, rolls still to come, `kind` 'emissary'), `upgrade_hall` or `fnId 'upgrade'` (0 gp). After removal, `R.orderKind` returns `'none'` for an order whose function no longer exists, and `completeOrder` drops it quietly (tool.js 5004-5013), losing the gold. Proposed: register orders move to the Dock; paid emissary orders are cancelled **and their gold refunded** (a deliberate departure from B9 "Cancel keeps the gold", because the player did not cancel), upgrade orders are cancelled (free), each with a Day Log line.

---------------------------------------------------------------------
## 5. The Dock (the enlarged Dock)

### 5.1 What the Dock is today
* Facility `dock`, a starting facility (stays built; `startingBuilt` will become `['workshop','dock']` per A-facilities), `requiredLevel: 5`, generic facility panel (`panel-fac-dock`, tile `tile-dock`) with its function list then `cargoSection()` appended (tool.js 3845, 3885-3936). The panel is 1180 x 856 with a 740 px body.
* **Functions:** only `charter_berth` (7 days; Keelboat 100, Longship 200, Sloop 400, Cutter 500, Brig 750, Warship 900, Galley 1000, Galleon 1250 gp). It drops a vessel row into the Warehouse (rules.js 2707-2710); the vessel does not affect cargo (cargo room comes from the Dock's level). Plus generic Upgrade (levels 1-5).
* **Cargo section ("Cargo and Port Charters")**: description by level; **Ship cargo...** (primary, `data-test=ship-cargo`) with `cargoPicker` (live quote, demand tier per good, saturation, fees) and `R.dispatchCargo` (commerce-rules.js 457-510); Port Charters list with state and terms; "Voyage protection" list (`R.protectionStatus` commerce-rules.js 777); Ships at sea with **Recall ship...** (`R.recallVoyage` 548); Standing shipments (Dock L4+; `R.setSchedule` 511, `R.stopSchedule` 528); Recent sales (last 5).
* **Dock levels** (commerce-data.js 162-168): L1 no cargo; L2 2 lots/1 ship; L3 3/1; L4 4/1 + standing shipments; L5 5/2. Shown in `levelEffects.dock` bastion-data.js.
* **Rules, all in `tools/bastion/commerce-rules.js` (966 lines)** plus data `commerce-data.js` (routes per port, risks 5/10/20/30 %, demand matrix, saturation 28 days, `salesKept` 30) and `shared/data/ports.js` (ten ports, each with its Clan from `regions.js`).
* **Day engine:** `R.settleVoyages` (commerce-rules.js 587) is called in the day's `trade` stage (tool.js 4843); ships arrive, roll risk (1-100, bot-rolled), sell or turn back, come home; standing shipments sail.
* **Forecast:** `shared/js/campaign-rules.js` `bastionComing` 136-147 lists ship arrivals, returns and standing-shipment days for the DM doc ("Next word from the Ironbow"); never prices.
* **Sales ledger / demand matrix:** `tradeNetwork.marketLedger` (rolling 56 days, used for saturation) and `cargoSales` (last 30 receipts, shown 5 in the Dock). The demand matrix is data; the Ship cargo quote shows each good's tier. There is no separate demand-matrix screen.

### 5.2 Port Charters: the whole chain today, and how it moves

| Step | Today | In the new Dock |
|---|---|---|
| Granted | Explorer "Port Charter..." button or a port's harbour box (tools/explorer/tool.js ~1440-1490, `charterDialog`); dialog text says "...then a Register Port Charter order at the Hall of Emissaries (Level 2, 3 days) registers it" (**already wrong: the order is Level 1**) | Change the text to the Dock |
| Carried | bridge message `type: 'charter'`, id `...:dm:0`/`:pin:0` (`shared/js/bridge-rules.js` header, `B.portStatus` 563-590, whose text says "register it at the Hall of Emissaries" and checks `fnId === 'register_port_charter'`) | Keep the fnId; change the two strings |
| Held | `R.addCharter` commerce-rules.js 210, status `earned`, one per port; notice "From the Explorer: ..." tool.js 4674 and a row in Clan Influence's "Changes from the Explorer" (tool.js 909-947) | Notice stays. **The Clan Influence list is the only place Explorer receipts (Refused/Skipped with the reason) are visible; removing the panel loses that. Needs a home (suggest: charter receipts under the Dock's Port Charters, Honour/Respect receipts in the Hall)** |
| Registered | Hall pending order `register_port_charter`, 3 days, 0 gp, one at a time (`R.registerBusy` 190), option list = `R.registrableCharters` via `R.fnOptions` rules.js 1785; completes in `R.completeSimpleOrder` rules.js 2607 -> `R.completeCharterRegistration` commerce-rules.js 232 | Move the function object to the Dock's data; `fn.portCharter` branch already works for any facility. No rule change. Keeps `requiredFacilityLevel: 1` so a Level 1 Dock can register (but not ship) |
| Terms | `terms` per charter plus history (`R.amendCharterTerms`, `R.resetCharterTerms`, `R.termsPreview` commerce-rules.js 713-752; UI tool.js 2843-2912) | Move the block (Amend terms..., Reset..., history, estimate) into the Dock; the Dock's charter line currently says "(negotiated, set in the Hall)" tool.js 3896 |
| Shipping | Dock "Ship cargo..." only to registered charters | unchanged |
| Hall gate on the Dock | **Only the registration step.** The Hall never gated cargo otherwise. The Trade Consortium and Trade Agreement never fed the Dock (separate `legacy_abstract` vs `commodity_backed` modes, commerce-rules.js header). Hall level never mattered for registration (L1) | The Dock needs no replacement gate; registration becomes a Dock order |

Strings that say "Hall" and need changing: commerce-rules.js header (lines 5-8), `R.charterState` 200-205, tool.js 2839/3896/3926, bridge-rules.js 26/568/572, ports.js 10, tools/explorer/tool.js 1461, `hallTips.port_charter`, `fnRow` messages tool.js 3411/3420, rules.js 1916 (`There's no Port Charter to register: the DM grants one in the Explorer.` is fine), guide.html 208-219, docs.

### 5.3 The Routes map: what it really is
`onRoutesMap` tool.js 5107-5141 draws `ui/clan_trading_locations.png` ("Clan Trade Hubs / The Scarlett Isles", with a Clan legend of coloured pins) and, for each Clan with a *live Consortium route* or a *running Trade Agreement*, a glowing overlay `B.routeOverlays[clan]` (`bastion-data.js` 204-212; seven files `ui/<clan>_trade_route.png`). Trade Agreements find no art (BAS-27, kept) because the Clan is saved as "Clan Karr" vs the key "karr". It lists each route (Clan, commodity, risk, gp per sailing). So today:

* it knows only Clans, not ports or ships;
* it is fed only by the Consortium (`tradeNetwork.routes`);
* once the Consortium is removed, **it can never show anything** in a new game.

To make "displays the Scarlett Isles map and active trade routes" true in the Dock, the natural feed is **Port Charters**: each charter has `clan` (from the port's region) and a status; ships at sea (`voyages`, with `port`, `clan`, `stage`, `arriveDay`, `returnDay`) say which Clan's route is active right now. Proposed: glow a Clan's overlay when the Ironbow holds a *registered* charter at one of that Clan's ports (steady), brighter or pulsing while a ship is at sea to that Clan; list rows by port (Goldport, Clan Molten: registered, ship 3 days out...). Ten ports share seven overlays (Timberport and Alderbridge are both Blackstone; Goldport and Moltenport both Molten; Leatherport and Bleakharbour both Karr), so two ports of one Clan light the same line. If Harry wants port-level pins, new art is needed (the base map already shows port names, e.g. Timberport, Leatherport, Alderbridge, Bleakharbour).
The glow is `.tsi-bas-trademap__route` in bastion.css 1356-1375 (pulse animation timed by `--tsi-signature-slowdown`; the Rowthorn overlay is deliberately static with a different blend). Re-check it respects the reduced-motion setting when it moves into the Dock.

### 5.4 Layout: how it fits
Measured at 1707 x 930 (the laptop in a maximised Edge): Dock body 1025 px of content in 740 px (scrolls) with only 3 charters and no ships. The new Dock will add: Register Port Charter (a function row), the charters list with terms/estimate/history per charter (the Hall's block is ~100-150 px a charter), the Routes button/map, protections list, plus the existing Orders pending, Charter Berth, Ship cargo, ships, standing shipments and sales. Recommendation: keep the one primary button per panel (Ship cargo..., crimson) in view at the top; split the rest into tabs or collapsible sections ("Orders", "Cargo", "Port Charters", "Routes"). The Hall panel is already 2470 px tall in a 732 px body, so after the cut the Hall will be shorter than today. TV test (1920 x 1080) also needed; selectors that tests use for the Dock panel (`dock-cargo`, `ship-cargo`, `dock-charter-<port>`, `dock-protections`, `voyages`, `schedules`, `sales`) should be kept.

### 5.5 Things in the Dock that stay as they are (no change needed)
Ship cargo..., quote, risk roll, sale, turn-back, Recall ship, standing shipments, market saturation, sales ledger, Fresh Fish rule, Port list and routes in commerce-data.js, the DM doc forecast lines for cargo.

### 5.6 Dock Level and "enlarged"
The handover does not give the Dock new levels or new orders; "enlarged" is panel content. Keep the generic Upgrade and `levelEffects.dock`. If Harry wants the Dock to unlock Port Charter features by level, that is new design (default: none, everything charter-related available at any level).

### 5.7 Voyage protections (cross-area, with A-facilities §3.2)
`commerce-data.js` 151-155 lists three: `commercial_convoy` (Barracks' Guard Commercial Convoy), `maritime_approaches` (Watchtower's Protect Maritime Approaches), `pelagos_blessing` (Temple). The first two lose their facility and the handover says nothing. Their Dock lines read "none ready" forever if left `available: true` (and e2e `charter-terms.test.js` asserts three lines). Default: remove both data rows; any `tradeNetwork.protections.commercial_convoy` charge or `maritime_approaches` window in a save is cleaned at migration (tell the DM on first open that a prepared Convoy or running Approaches ended). `R.cleanProtections` (commerce-rules.js 924) keeps unknown keys harmlessly, so leaving them is safe but the Dock stops reading them. The Temple's Pelagos blessing remains the only protection.

---------------------------------------------------------------------
## 6. Save migration plan for area F (field by field)

The save is `v: 3` (rules.js 207, `R.migrateToV3` 227-328 only runs for `v === 2`; `isOldSave` 1055 and `tool.js` 91, `campaign-rules.js` `inDaysSave` 52 know only v 2/3). A new step (`R.migrateToV4` or a `stripBack` table plus function, run from `R.fromSave` once, idempotent, report lines in `s.migration.v4` as v3 does) must:

| Field | Change |
|---|---|
| `builtExtras` | shrines -> one `temple`; `hall_of_emissaries` unchanged (single-level); ghost-tile risk: A-facilities §0 notes removed facilities left in slots become tiles with no panel; the same would happen to `shrine_*` if not mapped |
| `facilityLevels` | drop `shrine_*`; `hall_of_emissaries` level irrelevant (reset to 1); `dock` kept |
| `pendingOrders` | see 2.7 (Shrine orders) and section 4 (Hall orders); idempotent: orders already converted stay |
| `favour` | keep |
| `greatRites` | keep |
| `tradeNetwork.portCharters`, `voyages`, `schedules`, `cargoSales`, `marketLedger`, `parcels` | **keep exactly** (statuses, `terms`, `termsLog`, `registeredDay`) |
| `tradeNetwork.protections` | keep `pelagos_blessing`; drop `commercial_convoy`, `maritime_approaches` |
| `tradeNetwork.active, strategy, stability, routes, highRiskRouting, yieldBonusPct` | per section 3.6 policy |
| `diplomacy.agreements, arbitrations, consortiums, summits, delegations, cooldowns, tokens, rep` | per 3.6 (archive or leave inert) |
| `arbitration.queue` | clear (policy 1) |
| `politicalCapital`, `honourRespectByClan` | keep; no rewrite |
| `diplomaticRecords` | keep untouched |
| warehouse rows "... Contract", "Summit Charter" | keep (history) |

Safety: run on the raw save before `fromSave` tidies it (as v3 does), log a plain-English report, write once, make the second run a no-op, and test with the fixtures below. `saveProblem` (rules.js 1035) lists the map names to keep accepting; do not delete `arbitration`, `diplomacy` from its list in a way that makes an older export refuse to import (Import must still accept an old backup).

Fixtures that exercise this exactly: `tests/fixtures/bastion-pr8b-sample.json` (three Shrines at L5, Favour 60 %), `bastion-pr5-sample.json` (Hall + Dock L2, charters), `bastion-pr3-sample.json` (Library, Arcane Lab, Shrine of Aurush), `bastion-before-overhaul.json` (v2, Hall data). Hand-made additions needed: a pending Shrine order with `favourCost`, a pending Hall paid action, a live Consortium route with a dispute, a held Convoy charge and Approaches window, charters with `termsLog`, a ship at sea, a held Blessing of Pelagos.

---------------------------------------------------------------------
## 7. Tests and docs that mention this area (to update)

**Rules tests (`tests/rules/`, run on `tests/rules.html`, manifest must list any new file; plain script tags):**
* `bastion.test.js`: ~36 shrine mentions (lines 76, 85-90, 186, 195, 332-344 prayers, 1438-1441, 1779-1830 Shrines L2-L5 and Great Rite). Title pins "22 facilities, 270 compendium items" (line 40; the 9 prayer labels and 6 charms leave the Compendium: A-facilities §3.5).
* `commerce.test.js`: Register Port Charter (388-455: "the slot the Trade Agreement had", Hall Under Repair), Dock cannot ship reasons (456), Blessing of Pelagos (472), protections (857; "all three protections are available" line 138), standing shipments; Hall level 2 in setup.
* `diplomacy.test.js` (Records; stays), `bastion-campaign.test.js` (war PC), `campaign.test.js` (forecast route/contract lines, `Shrine` name rule), `dmdoc-edits.test.js` (favour/pc/hr edits; stays), `shrines-explorer.test.js` (Great Rites; stays but reads `shrine_telluria` in places), `courier.test.js`, `session-safety.test.js`, `bridge.test.js` (charter message text).

**E2E click-throughs (`tests/e2e/`, file://, laptop 1707x930 and TV 1920x1080):**
* `shrines.test.js` (285 lines; whole Shrine L2-L5 flow, selectors `tile-shrine_*`, `shrine-favour-<god>`, `issue-shrine_<god>__...`): rewrite as a Temple test.
* `hall-records.test.js` (202; opens `tile-hall_of_emissaries` then `panel-diplomacy [data-test=hall]`; asserts "6 - 1 Hall orders"; `clear-diplomacy`): keep the records parts, drop the orders assertion.
* `charter-terms.test.js` (135): the Hall's terms box moves to the Dock; the three-protections assertion changes.
* `commerce.test.js` (581): Hall registration -> Dock; Hall level 2 in setup; "the Hall's Port Charters box".
* `phase9.test.js` (2855 lines): Hall actions (`planHall`, Secure Trade Agreement legacy order 207), `ALL_EXTRAS` includes the three shrines and Hall, five starting facilities (288), Dock Charter Berth (496-541).
* `bastion-screen.test.js` (969): `open-influence`, `open-favour` hit tests (118-123), build-shrine_telluria (487-489), label sets.
* `shrines-explorer.test.js`, `courier.test.js` (open-influence 385), `dmdoc.test.js` (Hall's tracked agreements 177; stays), `bridge.test.js`, `guide.test.js` (checks every bold label named in guide.html exists in its tool: guide lines 195-274 name Hall, Port Charters, Shrines, Favour, Clan Influence).
* README `tests/e2e/README.md` lists these.

**Docs:** `docs/BASTION-EXPLORER-REFERENCE.md` §5.3 (Shrine and Hall rows 867-871, 877-880 prayers), §5.7 Favour (995-999), §5.8 Hall and trade (1025-1185), §6; `docs/FACILITIES-OVERHAUL-PLAN.md` (Dock levels line 30, Shrines), `docs/MILITARY-DIPLOMACY-PLAN.md` §2-4, `docs/specs/hall-of-emissaries-redesign.txt`, `docs/PROGRESS.md`, `docs/KNOWN_ISSUES.md` (BAS-83/84 Charters, BAS-95/96 Shrines, BAS-98 Hall records, BAS-27 routes, BAS-05/11 route settling, B3/B6/B20/B21 Hall bugs) add a "Deliberate change" entry for each removal and the cost change, `docs/ASSETS.md` (Shrine and Hall art, route art stays), `docs/BASTION-MAP-ART.md`, `docs/PHONE-PAGE.md` no, `guide.html` 195-274.

---------------------------------------------------------------------
## 8. Contradictions, ambiguities and conflicts with CLAUDE.md or existing behaviour

1. **"Temple" vs "Shrine"** (0.1). Plain naming fix; do not touch the world "Temple of ..." strings.
2. **"Three blessings" vs four candidates** per god, and one unavailable (Bless Bastion Foundations) (2.3).
3. **"Pray exactly the same as the blessings prayer"**: only one of three prayers adds Favour; the other two prayers and Craft are undefined (1.2).
4. **Full bar vs partial costs**: a balance change (2.4).
5. **Receive Blessing timing** (instant vs days) is unspecified (2.4).
6. **Hall: "Diplomatic Events"** names something that is not a feature today (3.3).
7. **Hall "Clan Honour/Respect"** could be misread as the party Clan's own Honour; the handover also removes Party Identity (3.3).
8. **Routes** is fed by a system that is being deleted (5.3).
9. **Hall's earlier "do not erase" guardrails** (docs) vs the handover's "all gone" with no migration policy (3.5).
10. **"Remove all upgrade functionality"** of the Hall conflicts with the generic Upgrade every facility has; needs a `singleLevel` flag, and the handover is silent for the Temple (2.5).
11. **The Clan Influence panel is the only place Explorer receipts show** (5.2); the handover removes it without a replacement.
12. **Voyage protections** (5.7) and **Favour Tokens** (1.3) are left without an owner.
13. **CLAUDE.md "faithful rebuild"** is superseded by Harry's explicit instructions for these changes. Rules that still bite: plain `<script>` tags (any new migration/Temple file goes in the manifests `shared/data/tools.js`, `tests/rules.html`), nothing loaded from the network, `tsi.` storage keys, content in data files, rules apart from screens, clean shutdown through `life`, Harry-readable report lines, record every removal in KNOWN_ISSUES.
14. **Existing wording bug found on the way:** the Explorer dialog says Register is "Level 2" (it is Level 1, tool.js 1461); fix with the move.
15. **Firebase / phone link** not involved in this area.

---------------------------------------------------------------------
## 9. Risks

* A silent `favour['']` or free blessings if `R.shrineGod` is not made data-driven (2.2).
* Ghost tiles / lost orders if the Shrine and Hall slots are not migrated (A-facilities §0).
* Gold or Favour lost on migration if cancelled orders are not refunded.
* Clearing `tradeNetwork` wholesale would delete Port Charters, ships at sea and sales (the commodity data lives inside the legacy object).
* Dead data left behind (`hallDC`, `reactions`...) is harmless but its tests will fail until adjusted.
* The Dock panel becoming unusably tall on the laptop.
* An old Bastion open in another window after the migration (the repo already warns "Older copies, SUI-19: back up first"; an older copy drops unknown fields). Add the same note.
* The long e2e files (`phase9.test.js`, 2855 lines) are mostly Hall-action driven; expect large test rewriting.

---------------------------------------------------------------------
## 10. Suggested build order for this area
1. Data first: `temple` facility (3 Pray functions, 3 Receive Blessing functions with 3 options each, `singleLevel`), Hall stripped to no functions and `singleLevel`, `register_port_charter` moved to the Dock, protections table reduced, string changes.
2. Rules: data-driven god, full-bar blessing issue, migration step with report, `upgradeCheck` single-level.
3. Screens: Temple panel (thirds), Hall panel (Clan Relations + Diplomatic Records), Dock sections (tabs) with Port Charters, terms, Routes map.
4. Remove Favour, Clan Influence, Council Ledger, Resolve and the Hall action code last (after the screens that replace their receipts exist).
5. Tests and docs; run the guide test last.
