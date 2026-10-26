# S11 known-issues draft (for the lead to renumber into docs/KNOWN_ISSUES.md)

Not added to `docs/KNOWN_ISSUES.md` itself, to avoid merge clashes. Numbers are placeholders (BP-S11-a, b, ...). Each entry is a deliberate change or a thing left alone, with a one-line before and after.

### BP-S11-a · One Temple replaces the Shrine of Telluria, the Shrine of Aurush and the Shrine of Pelagos
**Changed, Harry's request** · behaviour

- **Before:** three buildings (party level 8, a slot each, levels 1 to 5, Craft, Pray and four blessing orders each).
- **After:** one building, `temple`: party level 8, a construction slot, 21 days, one level only (no Upgrade row). Its panel is split into thirds, one for each god. The world text "Temple of ..." (regions, Explorer events, the Notice Board) is not touched.

### BP-S11-b · Pray to (god) is instant and adds a d50, not a 1-day order with a 1d20
**Changed, Harry's request** · behaviour

- **Before:** Pray was a 1-day order; its third option rolled 1d20 and added that many percent to the bar.
- **After:** a button in each god's third; the Bastion rolls a d50 (1 to 50 percent), adds it to the bar at once (the bar stops at 100) and shows the roll. Praying at a full bar adds nothing and says so (my judgement call: the button is not disabled, since Harry did not say it should be).

### BP-S11-c · Receive Blessing: three blessings a god, only on a full bar, instant, the whole bar spent
**Changed, Harry's request** · behaviour

- **Before:** four blessing orders a god at Levels 2 to 5, each taking days and 0, 5, 10 or 25 percent of the bar when it started; Cancel never gave the Favour back.
- **After:** a dropdown of three (Pelagos: Voyage Blessing, Bless Commercial Shipment, Great Rite of Pelagos; Aurush: Blessed Lantern, Consecrate Expedition Supplies, Great Rite of Aurush; Telluria: Earthward Talisman, Rootguard Salve, Great Rite of Telluria), greyed out until the bar is 100. It happens at once, spends the whole bar and makes no order (so there is nothing to cancel). A full bar now takes about 4 prayers (a d50 averages 25.5), against about 10 with the old 1d20 (10.5), so blessings come faster; the numbers (`prayDie`, `full`) are in the Temple's data.
- **Judgement call:** pressing Receive Blessing asks first ("the whole bar is spent"), because a mis-click costs a whole bar and the dropdown starts on its first blessing.

### BP-S11-d · Craft charms, the hint and long-rest prayers, Purification Incense, the Aquatic Protection Charm and Bless Bastion Foundations are gone
**Changed, Harry's request** · behaviour

- **Before:** six charms (Craft), two prayers that rolled a hint or a long rest, and three more blessing orders (one of them, Bless Bastion Foundations, listed but never available).
- **After:** none of them exist. Their goods (Purification Incense, Aquatic Protection Charm and the rest) stay in the catalogue, the Courier and the Travel bags so anything already made keeps its name. The Compendium loses their 15 names (270 items become 255).

### BP-S11-e · The Favour of the Gods panel, its button and Claim are removed
**Changed, Harry's request** · behaviour

- **Before:** a bottom-bar Favour button opened three bars with a Claim button at 100 that only reset the bar.
- **After:** the bars are in the Temple; Receive Blessing is what resets a bar. The saved `favour` map is unchanged; the DM doc's "Where the party is" god card and Change A Score for Favour work as before.

### BP-S11-f · Converting a saved Bastion: the Shrines become one Temple
**Changed, Harry's request** · data

- **Before:** a saved Bastion had up to three Shrine slots, their levels and pending orders.
- **After:** the first built Shrine's slot (else the one ready first) is the Temple; the rest are free; its level is 1. The nine orders the Temple still gives move to it (id, due day and what they cost kept) and complete on their due days. Everything else (Craft, every Pray, Incense, the Aquatic Charm, Bless Bastion Foundations, Upgrades) is cancelled with Favour (up to 100, overflow said), goods and gold given back, and reported in plain English. A pending Favour prayer is cancelled too: its roll is not made (it cost nothing). Held Blessings of Pelagos, Great Rites and Favour are kept exactly.

### BP-S11-g · Left alone: the generic `favourCost` machinery
**Not fixed, my judgement call** · code

- **Before:** `R.issueOrder`, `R.favourBlocker` and the facility rows take a Favour cost from a god's bar when an order starts.
- **After:** the same code stays, but no function in the data has a `favourCost` any more, so it is never used. It is left in so as not to widen the merge with the other lanes; a later step can delete it.

### BP-S11-h · Left alone: the word rule that turns `shrine_aurush` into "Shrine of Aurush"
**Not fixed, my judgement call** · code

- **Before/After:** `shared/js/campaign-rules.js` still names a retired Shrine id in words; the Explorer and the DM doc read a version 3 save before the Bastion converts it, and its orders still say "Shrine of ...". It can go once no version 3 save can be read.

### BP-S11-i · No Temple is built for free when only orders are found
**Changed, my judgement call** · data

- **Before/After:** if an old save holds a Shrine order but no Shrine standing, the order moves to the Temple (it completes on its day; Favour, Great Rites and held blessings never need a building) but no Temple appears. (The Beast Pen step builds a free Pen only when beasts would otherwise be invisible; nothing is invisible here.)
