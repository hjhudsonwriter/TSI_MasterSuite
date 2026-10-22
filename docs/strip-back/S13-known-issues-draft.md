# S13 known-issues draft (for the lead to renumber into docs/KNOWN_ISSUES.md)

Not added to `docs/KNOWN_ISSUES.md` itself, to avoid merge clashes. Numbers are placeholders (BH-S13-a, b, ...). Each line is a deliberate change or a thing left alone, one line before and after.

### BH-S13-a · The app no longer sends anything (Strip Back Overhaul, S13)
**Changed, Harry's request** · behaviour

- **Before:** a player could ask the Bastion to change a profile line or start a free training order; the request travelled as a signed `BHC1.` code (phone) or through the `tsi.beasthandler.queue` key (laptop), the Bastion kept a receipt for each in `s.beast.done`, and the DM had a "Take requests from handlers" switch, a "Paste a request code…" button and a "Latest requests" list.
- **After:** the app is read-only and sends nothing. The request code, the receipts, the queue, the switch, the paste box, the list, the Orders tab, the waiting overlays, "Edit or roll this profile" and the "From the Beast Handler:" notice are gone. A saved Bastion that still holds the old record (`accept`, `done`, `floor`) loads quietly and the version 4 conversion drops it (step `dropBeastRequests`); the old queue key and a phone's old outbox and draft keys are deleted when the Bastion, the laptop copy or the phone page opens.

### BH-S13-b · The Bastion rolls a beast's first meeting, once
**Changed, Harry's request** · behaviour

- **Before:** the player typed, tapped or rolled a subspecies and three personality lines on the phone, and the phone sent them as a request.
- **After:** at Bond 1 the Bastion rolls the subspecies (fixed per kind, `data/initiation-data.js`) and the three personality lines (d12, d8, d8, genuinely random) once, keeps them in `development.initiation`, fills blank lines only, and writes a Day Log line ("first meeting prepared… staged: fixed until further notice"). Beasts already at Bond 1 or more with no variety are rolled for once, when the Bastion opens or a day passes (Elara's wyvern becomes a Bloodcrest). A beast that already has a variety is never rolled for.

### BH-S13-c · The first meeting is a reveal of what the Bastion decided
**Changed, Harry's request** · behaviour

- **Before:** panel 2 and 3 were typed fields, five tap chips and Roll buttons that only suggested a line.
- **After:** panel 2 is shuffled medallions, one "Roll for subspecies" button, a die and a hopping marker that lands on the Bastion's answer; panel 3 is three cards whose dice settle on the Bastion's real numbers. Once per device per beast (phone: `tsi.beasthandler.phone.seen`; laptop: session only), no skip on a phone, "Skip for now" on the laptop.

### BH-S13-d · Fixed subspecies "until further notice" (left alone, to tell Harry)
**Left alone, by design** · content

- Every wyvern meets as a Bloodcrest, griffin as Dawnmantle, dire wolf as Blacktide, Buckbear as Broadcrown, Fellcat as Lichenback, however the dice look; a beast released and granted again would meet the same variety. Changing `mode` to `random` in `tools/beasthandler/data/initiation-data.js` gives chance back. The Day Log says "staged" so Harry can tell later that it was not a chance outcome.

### BH-S13-e · The reveal's marker goes round about three times, not "one to two" (left alone)
**Left alone, judgement call** · visual

- The brief's lap count cannot be had together with 3.5 to 4.5 seconds and gaps of about 90 to 420 ms on five or six medallions. The times and gaps are kept; the marker goes round about 2.5 to 4 times.

### BH-S13-f · Tabs and pages
**Changed, Harry's request** · behaviour

- **Before:** bottom bar Profile, Orders, Chronicle; the picture page was reached by "Back"; Profile had an editor.
- **After:** Profile, Bond, Chronicle; Bond is the page a beast opens on; Profile is read-only; "Back" is always "All beasts". A beast that is not acclimatised (Bond 0) is a line "Not acclimatised yet" with no detail, on the phone and on the laptop. After "Skip for now" on the laptop the page shows the real subspecies and picture (the Bastion already holds it); "Subspecies not chosen yet" is now "Subspecies not known yet".

### BH-S13-g · Snapshot version 2 (phones must be given a new snapshot once)
**Changed** · compatibility

- **Before:** snapshot version 1 held orders, training, receipts and a request fingerprint for each beast.
- **After:** version 2 holds none of those, shows a Bond 0 beast as a name only, and carries `available` and the first meeting to the beast's own handler. A phone holding a version 1 snapshot forgets it and asks for a new one (its link is kept).

### BH-S13-h · Beast Handler laptop copy saves nothing
**Changed** · behaviour

- **Before:** the laptop copy saved a queue of requests, so it had Export and Import buttons.
- **After:** it saves nothing (`saves: false`), so no Export and Import for this tool. Which first meetings were shown is remembered for the window's session only. An old backup that holds `tsi.beasthandler.queue` still restores; nothing reads it and it is cleared the next time the Bastion or the Beast Handler opens.

### BH-S13-i · Not done, left for the next steps
**Left alone** · scope

- Buckbear and Fellcat cannot be housed or shown (no building until the Beast Pen); the reveal's five-kinds test patches the two kinds into the page. The Bonding Days counter and filling pills are S15; QR pairing and the online link are S17. The Buckbear and Fellcat d8 tables are still DRAFT.
- `tests/fixtures/bastion-v3-heavy.json` and `bastion-fixtures.js` were not regenerated (they still hold the old request record, which is what the new conversion step is tested on); `make-heavy.js` writes that old shape on purpose.
- Firefox, Edge itself and a real phone were not tested.
