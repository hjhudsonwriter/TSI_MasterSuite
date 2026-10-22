# S14 and S15 known-issues draft (for the lead to renumber into docs/KNOWN_ISSUES.md)

Not added to `docs/KNOWN_ISSUES.md` itself, to avoid merge clashes. Numbers are placeholders (BP-S14-a, b, ...). Each entry is a deliberate change or a thing left alone, with a one-line before and after.

### BP-S14-a · One Beast Pen replaces the Wyvern Roost, Griffin Tower and Dire Wolf Den
**Changed, Harry's request** · behaviour

- **Before:** three buildings (each with levels, upgrade rows, room that grew with the level), each housing one kind of beast, with a list of training programmes.
- **After:** one building, `beast_pen`: party level 5, a construction slot, 21 days, **one level only** (no Upgrade row), housing **one beast of each of five kinds** (wyvern, griffin, dire wolf, buckbear, fellcat). Only two orders: House Beast Here and Acclimatise With Beast. A beast already housed when the limit arrived stays; the limit only blocks housing a new one. Demolishing the Pen is refused while any beast lives in it.

### BP-S14-b · The training programmes, riding harness, first flight, Rider's Pact and Controlled Ascent are removed
**Changed, Harry's request** · behaviour

- **Before:** each old building had a list of free programmes and riding preparation orders (the 150 gp harness, first flight, Rider's Pact), and a Riding line in each beast's block.
- **After:** none of it exists on screen. What an old save had recorded for a beast (programmes done, harness, flight, riding) stays in the saved beast's `development` out of sight, so nothing is lost; no new order can add to it.

### BP-S14-c · Bonding is by days on the road, not by orders
**Changed, Harry's request** · behaviour

- **Before:** the DM issued training orders; finishing one made the next bond milestone ready.
- **After:** a beast at Bond 1 or more, taken out on the road ("Away from the Ironbow"), earns one **Bonding Day** for each day the Explorer passes (Bond 2 at 10 days in all, 3 at 20, 4 at 30, 5 at 50; numbers in `creatures-data.js` as `bondTotals`). Days are totals, never lost, keep counting while a milestone waits, and one level rises per scene. The DM still confirms each level with a reason, as before.

### BP-S14-d · Acclimatise With Beast is typed at the table, DC 20 for every kind
**Changed, Harry's request** · behaviour

- **Before:** acclimatising was a free training order (Safe Acclimatisation, 5 days) at the old building.
- **After:** the handler rolls Animal Handling at the table and the DM types the total. 20 or more passes (Bond 1, the beast leaves the list and its first meeting is rolled for the Beast Handler); a lower total locks that beast for 3 in-game days (a fail on Day 10 blocks Days 11 and 12; Day 13 is allowed). The DC and the 3 days are in `creatures-data.js` (a per-kind DC is possible later). The roll is instant, so it is not a pending order; the order has "days: 1" in its data only to satisfy the rule that every order has days.

### BP-S14-e · Take a beast out on the road and return it: refused mid-day and while the Bastion is behind
**Changed, my judgement call** · behaviour

- **Before:** nothing like it.
- **After:** both buttons ("Take (name) on the road", "Return (name) to the Beast Pen") are switched off, with a reason, while the Bastion is behind the Explorer's day or a day is part-way through, so the day the trip starts or ends can never be miscounted. The day a beast goes out is not counted; each day after it is.

### BP-S14-f · A beast already at a bond level counts as having that level's days
**Changed, my judgement call** · behaviour

- **Before:** a beast brought to Bond 3 by the old orders had no days at all.
- **After:** the effective Bonding Days are the larger of what was counted and the total for the beast's level (Bond 3 counts as 20), so the pill for the next level starts at its own beginning and a migrated beast is not sent back to zero.

### BP-S14-g · Elara's wyvern is no longer given to a new Bastion
**Changed, Harry's request** · behaviour

- **Before:** a new Bastion held a "House Elara's Wyvern" order for her wyvern.
- **After:** a new Bastion starts with no beast. An existing save that already has her wyvern keeps it (as Bond 1, and the old Elara order, if still pending, moves to the Pen as a House order that completes only if no wyvern is housed yet).

### BP-S14-h · The old buildings' orders after the conversion
**Changed, Harry's request** · behaviour

- **Before:** House orders were pending at the Roost, Tower or Den; training, upgrade and riding orders ran there.
- **After:** the conversion step `rehomeBeasts` moves each House order to the Pen (same cost, inputs and due day; the label becomes "Beast Pen: House Beast Here (name)"), cancels training and upgrade orders with a refund through the shared refund helper, frees any extra built slot, releases no creature, and gives a free Pen only if beasts are already housed and no old building stands. It rolls no dice and writes plain-English lines under "joined", "beasts" and "orders". A House order that would break the one-of-each limit keeps that beast waiting, and the report line says so.

### BP-S14-i · Buckbear and Fellcat can be granted in the Explorer
**Changed, Harry's request** · behaviour

- **Before:** the Grant a creature dialog offered a wyvern, a griffin or a dire wolf.
- **After:** it offers five kinds and says the Pen keeps one of each. The fallback list in `shared/js/bridge-rules.js` was extended, with a test that it equals the Bastion's own data.

### BP-S14-j · The Pen's map overlay and tile reuse existing pictures
**Left alone, by design** · visual

- **Before:** the Roost, Tower and Den each had their own building on the map and a tile picture.
- **After:** the Pen's panel carries Harry's `beast_pen.jpg` across the top; its tile uses the Menagerie's painting (`menagerie.png`) and its place on the map is the Wyvern Roost's building overlay. All those files stay where they are (the Menagerie facility itself is not touched here). Harry may want a new tile and overlay later.

### BP-S14-k · `R.creatureStatus` and the war lines for beasts are left in place
**Left alone, by design** · code

- **Before / After:** unchanged. The beasts' fighting stats, "Creatures defend the Ironbow" and the War Table lines belong to the war code, which another step removes. The Pen's screens no longer use `R.creatureStatus`; whoever removes the war code can delete it.

### BP-S14-l · Reset Travel can show a trip as starting "before Day 1"
**Left alone, judgement call** · visual

- **Before:** n/a (new field).
- **After:** the day a beast went out moves back with everything else when Reset Travel moves the Bastion back; if that makes it earlier than Day 1 the panel says "out on the road since before Day 1" (the Bonding Days are untouched and the next camp counts normally). The same happens to old orders' issue days.

### BP-S14-m · The Bastion window does not pause part-way through a catch-up
**Left alone, by design** · behaviour

- **Before / After:** when the Bastion has several days to catch up it passes them in one quick run, so a window closed or reloaded "part-way" in practice leaves the last saved day, and the next open continues from there. The tests prove each day is credited once from a save left at Day 19 with the Explorer on Day 25, and after reloads at six moments around a day passing.

### BP-S15-a · Beast Handler: the Bond page shows Bonding Days and pills that fill
**Changed, Harry's request** · behaviour

- **Before:** five pills, full up to the bond level.
- **After:** a Bonding Days counter and a line (*On the road with (handler) since Day N* or *Resting at the Beast Pen: bonding is paused*); the next pill fills as the days pass; a full pill reads "Ready: waiting for a moment with your DM" with a soft pulse (none under reduced motion); each pill is a progress bar for a screen reader ("Bond 3, Bonded: 7 of 10 days"); a new snapshot changes the numbers in place without redrawing, so a roll or greeting is never cut.

### BP-S15-b · The snapshot gains a `bonding` block and a `place`; its version stays 2
**Changed, Harry's request** · behaviour

- **Before:** the snapshot listed buildings and, for an acclimatised beast of the handler's own, a detail block.
- **After:** one facility entry (Beast Pen, level 1), a `place` ("pen" or "away") on each creature and its detail, and a `bonding` block (away, since, days, next pill, ready) for the handler's own acclimatised beast only. A Bond 0 beast still sends no detail. An older snapshot has no counter until a new one is pasted; nothing breaks. Every new field has a leak test with a reason.

### BP-S15-c · The Beast Handler (players) box moved from Management into the Pen's panel
**Changed, Harry's request** · visual

- **Before:** the pairing and snapshot controls sat in Management with the creatures list.
- **After:** both the list of creatures and the box are in the Beast Pen's panel; Management no longer has a creatures list or the box.

### BP-S15-d · Test and tool notes
**Left alone** · tests

- `tests/e2e/phase8.test.js`: "Compared with the old Explorer" needs the `_legacy/` scratch folder and always fails in a clean worktree (known; unchanged by this step).
- `tests/e2e/war-room.test.js` (line about `griffin_tower`) and any other test that opens a war screen belong to the war-removal step; they are left as they were.
