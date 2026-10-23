# S08 and S09 known-issues draft (for the lead to renumber into docs/KNOWN_ISSUES.md)

Not added to `docs/KNOWN_ISSUES.md` itself, to avoid merge clashes. Numbers are placeholders (BP-S08-a, ...). Each entry is a deliberate change or a thing left alone, with a one-line before and after. The reserved ids in `J-cross-cutting.md` 6.2 that these belong under: BAS-103 (the Hall), BAS-104 (the Dock), BAS-111 (voyage protections).

### BP-S08-a · The Dock takes the Port Charter system (BAS-104)
**Changed, Harry's request** · behaviour

- **Before:** Register Port Charter was an order at the Hall of Emissaries; the Port Charters box with each Charter's terms (Amend, Reset, history) was in the Hall's panel; the Dock only listed the Charters.
- **After:** Register Port Charter is a 3-day, no-gold, no-roll order at the **Dock** (any Dock level, as it was any Hall level); the Charters, their terms and history are in the Dock's **Port Charters** tab. The Hall has no Port Charter code or text left. Nothing about a Charter's rules, price, terms or ships changed.

### BP-S08-b · The Dock panel has four tabs
**Changed, to fit the laptop** · layout

- **Before:** one long panel (about 1,025 px of content in a 740 px body on the laptop with three Charters and no ships), with the orders first and the cargo section underneath.
- **After:** tabs **Cargo** (opens here; Ship cargo… in view), **Orders** (Upgrade, Charter Berth, Register Port Charter), **Port Charters**, **Routes**. The selectors tests use (`ship-cargo`, `dock-cargo`, `dock-charter-<port>`, `dock-protections`, `voyages`, `schedules`, `sales`) are the same; the order buttons are under Orders.

### BP-S08-c · The Routes map now shows Port Charters and ships, and it moved to the Dock (BAS-27, BAS-05, BAS-11 become history)
**Changed, Harry's request** · behaviour

- **Before:** the Hall's Routes pill opened a pop-up map that glowed a Clan only for a running Trade Consortium route or Trade Agreement (and a Trade Agreement found no art, BAS-27, because its Clan was saved as "Clan Karr"); in a new game it could never show anything once the Consortium went.
- **After:** the Dock's Routes tab glows each Clan with a **registered** Port Charter (steady) and brighter while a ship is at sea to it; an earned Charter lights nothing but is listed. The map is Clan-level (seven lanes for ten ports); there are no port pins or ship pictures (new art would be needed). It stops pulsing with "reduce motion".

### BP-S08-d · Explorer dialog's wrong "Level 2" text fixed
**Fixed (wording)** · text

- **Before:** the Explorer's Port Charter dialog said a "Register Port Charter order at the Hall of Emissaries (Level 2, 3 days)" registers it; the order was always Level 1.
- **After:** "a Register Port Charter order at the Dock (3 days) registers it." The same change in the Explorer's harbour box line, the Bastion's notice and log line, the Dock's blocked-shipping messages and `shared/data/ports.js`.

### BP-S08-e · Voyage protections from the Barracks and Watchtower are gone (BAS-111)
**Changed, Harry's request** · behaviour

- **Before:** the Dock listed three protections (Commercial Convoy −5, Protected Maritime Approaches −5, Blessing of Pelagos −10); `commerce.test.js` and `charter-terms` asserted three.
- **After:** the data lists only the Blessing of Pelagos, so the Dock's list reads only it. A held Convoy charge or Approaches window in an old save is dropped when the Bastion is converted, by the war removal's own step (with a line; free to prepare, so nothing is owed); the Blessing is never touched. (The Barracks and Watchtower, and `R.protectionBusy`, went with the war game in step S06.)

### BP-S09-a · The Hall of Emissaries is one level with no orders (BAS-103)
**Changed, Harry's request** · behaviour

- **Before:** five orders (Host Delegation, Inter-Clan Summit, Secure Writ of Authority, Trade Consortium, the retired Secure Trade Agreement), an Upgrade to Level 5 that raised a diplomacy-roll bonus, Routes, Resolve, a Council Ledger, an Ironbow Trade Network section (stability, income, yield, High-Risk Routing, investments), a Clear Diplomacy Records button, and automatic weekly payments.
- **After:** `functions: []`, `singleLevel: true`. The panel shows the Clans' Honour/Respect and Political Capital to read only, **Diplomatic Events** (the old Diplomatic Records ledger) and the read-only Earlier agreements and routes. Honour/Respect and Political Capital change only through Change a score in the DM doc or a confirmed Diplomatic Event. No diplomatic incident happens by itself.

### BP-S09-b · Hall rules removed: B2, B3, B6, B20, B21, BAS-05, BAS-11, BAS-29, BAS-34 become history
**Changed, Harry's request** · behaviour

- **Before:** these entries describe rules in `R.emissaryPlan`, `R.applyEmissary`, `R.settleRoute`, `R.rule`, `R.tickDiplomacy` and friends (a natural 1 signing a deal, Host Delegation's two rolls, a Writ bonus never granted, a route paying once a sailing, the "[object Object]" in the verdict log, an outcome text never shown, a consortium not reopening an expired route).
- **After:** the code and its data (`hallDC`, `hallTiers`, `delegation`, `networkUpgrades`, `councilDC`, `reactions`, `hallTips`…) are deleted. Add "removed in the Strip Back Overhaul" to those entries.

### BP-S09-c · Running contracts and sea routes are paid out once, then end (decision 4.4 of the plan; BAS-83 history)
**Changed, Harry's request ("stop at migration, stay as read-only history"); final settlement is the recommended policy** · migration

- **Before:** each contract paid its income every 7 days into the treasury; each live route paid its yield every 7 days (a d20 for a high-risk one, a dispute for a bad failure).
- **After:** when an old Bastion is converted, the remaining income is paid **once**, from the save, with no dice (a contract: `income × shipments still to come`; a route: its expected yield for each sailing still to come until it, or its Trade Consortium, would have ended; a disrupted, expired or Consortium-less route is owed nothing), every amount itemised in "The Bastion has changed", then each is ended and kept as one line of read-only history. A second conversion or a reload pays nothing more.

### BP-S09-d · Hall orders waiting at conversion are cancelled with their gold back
**Changed, deliberate departure from "Cancel keeps the gold" (B9)** · migration

- **Before:** an order the DM had paid for and not yet seen resolve (150 / 450 / 600 / 900 / 250 gp for the five actions; Stability 75 gp and Yield 90 gp for the Trade Network) would have completed to nothing and lost the gold.
- **After:** each is cancelled by name with `costGP` returned, the treasury rising by exactly the itemised sum (audit I1). An Upgrade at the Hall is cancelled (free). The Register Port Charter order moves to the Dock instead (BP-S08-a).

### BP-S09-e · Delegations, Summits, cooldowns, Favour Tokens and disputes end
**Changed, Harry's request** · migration

- **Before:** a delegation and Summit lasted their days (the Summit cut Hall action prices 25%), a bad failure set a 14-day cooldown, Host Delegation could award Favour Tokens (never spent on anything), and a disastrous sailing filed a dispute for the Council Ledger.
- **After:** all end at conversion with a sentence each; no gold is owed for any of them (a disputed route's ruling can no longer restore it). The Clan Influence panel's Favour Tokens pill reads 0 until S10 removes it.

### BP-S09-f · Four phase9 checks about a day paused on a dice box were deleted
**Left alone, coverage lost** · test

- **Before:** `phase9` paused a day on the Hall's typed d20 (a Secure Trade Agreement order) to check Enter and Space cannot start anything else (BAS-10), a cancelled roll keeps the order due with Resolve (BAS-02, BAS-13), and closing the window mid-day loses nothing (BAS-02).
- **After:** deleted, because the Hall's actions were the only orders that asked for a typed d20 inside a day (the War Council's War Actions were the other, and the war removal took them out). The rules for a skipped order (`R.skipOrder`) and the Resolve button, and the dice box (`rollD20`), remain in the code with no user; the lead may want to remove them in the clean-up step.

### BP-S09-g · Left alone: Favour Tokens pill, `state.diplomacy`
**Left alone, for S10** · cleanup

- `state.diplomacy` is `{ tokens }` and the Clan Influence panel still shows the Favour Tokens count (always 0 after conversion). S10 can delete both. `R.supportForClanKey` (Support) is untouched (Clan Influence and Form Clan).
