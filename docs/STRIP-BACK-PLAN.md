# The Strip Back Overhaul: plan and Harry's decisions

Written 22 October 2026. This is the working plan for one large pull request. It records what Harry asked for (`docs/strip-back/HANDOVER-text.txt`, his PDF), the decisions he made when asked, the small calls made on his behalf, and the order of work. The ten area reports behind it are in `docs/strip-back/` (A to J); read the one for the area you are building before you start.

**Names.** Harry now calls the beast building the **Beast Pen**. The reports say "Beast Pit" and `beast_pit`: read **Beast Pen** and use the id `beast_pen`. The shrines are called **Shrines** in the code and **Temple** (one merged facility) in the handover; the new facility is the **Temple**, id `temple`.

**Restore point.** The last version before the change is `main` at commit `4f1db26` (the merge of pull request #54). A git tag `before-strip-back` was made locally but the tag could not be pushed from the cloud session, so to bring the war game back use `git checkout 4f1db26`.

## 1. What is removed, moved and added

**Removed facilities (13):** Menagerie, War Room, Library & Scriptorium, Arcane Laboratory, Armoury, Watchtower, Barracks, the three Shrines (become one Temple), Wyvern Roost, Griffin Tower, Dire Wolf Den (become one Beast Pen).
**Removed panels:** Favour of the Gods (the bars move into the Temple), Clan Influence, War Council (and the whole war game), Day Log, Events.
**Moved:** Library and Arcane Laboratory content into the Workshop's Scholar and Alchemist; Port Charters and the Routes map from the Hall to the Dock.
**New or changed:** Party Name and no founding a Clan; DM doc in four panels with a Quest box; Workshop with five staff; four production facilities with one order per level; a Temple with Pray and Receive Blessing; a single-level Hall; a Beast Pen with day-by-day bonding; Buckbear and Fellcat beasts; a read-only Beast Handler app with Profile / Bond / Chronicle, QR linking and an optional online link (built, switched off).

## 2. Harry's decisions (22 October 2026)

1. **War game: delete it completely**, keeping the restore point above. Pictures go to `assets/extras/`; old docs stay as history with a "removed 22 October 2026" note.
2. **Temple:** one level, party level 8, 21 days, a construction slot. Each god has a bar, **Pray to (god)** which adds a **d50 percent** roll to the bar, and **Receive Blessing** (a dropdown of three, greyed out until the bar is full; it takes effect **instantly**, spends the whole bar, and the bar resets). The blessings: Pelagos: Voyage Blessing, Bless Commercial Shipment, Great Rite of Pelagos. Aurush: Blessed Lantern, Consecrate Expedition Supplies, Great Rite of Aurush. Telluria: Earthward Talisman, Rootguard Salve, Great Rite of Telluria. Great Rites still wait for the Explorer to assign them on an expedition. The charms, the hint prayers and the long-rest prayers are dropped.
3. **Acclimatise With Beast:** the handler rolls (Animal Handling) at the table and the DM types the total; **DC 20** for every kind (one number in the data, changeable per kind); instant; pass = Bond 1 and the beast leaves the dropdown; fail = that beast cannot try again for **3 in-game days**.
4. **Bond days (totals, carried over):** a beast out of the Bastion with its handler counts Bonding Days; **Bond 2 at 10, Bond 3 at 20, Bond 4 at 30, Bond 5 at 50 total days**. Days are never lost while a milestone waits for the DM's scene (a level is never skipped: a second prompt follows if the next is already reached). Pill 1 is full once the acclimatisation roll passes; pills 2 to 5 fill between the totals.
5. **Phone link:** QR pairing now (no account). The online link is built but **off by default**; Harry will make a free account (Firebase Realtime Database in a new project he owns) and approve the amendment to CLAUDE.md ground rule 2 before it is switched on. Until then nothing goes online and CLAUDE.md is unchanged. The old copy-and-paste codes stay as a hidden "Offline backup".
6. **Beast Pen:** needs party level 5, a construction slot and 21 days; one level only. **Elara's wyvern is not pre-populated**: the DM adds beasts by hand (the Explorer's grant). Beasts already housed in a save stay; the one-of-each-kind limit only blocks new ones. On the map the **Menagerie overlay** is reused. Harry's picture `beast_pen.jpg` spans the full width at the top of the Beast Pen's panel, with its details and orders underneath.
7. **Blacktide** is a sixth Dire Wolf variety (a d6 roll). Region: "The Black Straits (South) and Bolt Isle". Where: "Surf-cut rocks, wreck beaches, smugglers' coves and pirate havens". Appearance: "Powerful wolf with tangled wet charcoal-black upper fur, pale grey-cream face, chest and legs, broad coastal paws, vivid sea-green eyes and a heavy dark tail."
8. **Buckbear and Fellcat d8 tables** (Attachment Cue and Instinctive Trigger): drafted, clearly marked DRAFT, for Harry to approve or replace. Their five varieties each, with Harry's text (`docs/strip-back/NEW-BEASTS-text.txt`). Fixed variety "rolls": Wyvern Bloodcrest, Griffin Dawnmantle, Dire Wolf Blacktide, Buckbear Broadcrown, Fellcat Lichenback.
9. **Production facilities:** Timber Yard & Sawmill, Fishery & Smokehouse, Stone Quarry & Masonworks, Weavers' Hall get one order at a time, each level's order replacing the last. The Herbal Gardens is unchanged. **Orders are self-contained**: the goods inputs are dropped (gold, days and output stay as they are); Level 5 shows both its orders (replacing Level 4's), one running at a time.
10. **Workshop:** five staff open one by one (L1 Handyman, L2 Smith, L3 Scholar, L4 Alchemist, L5 Artisan). Handyman = the six unclaimed artisan tables (103 items, 3 days) as a marked PLACEHOLDER; Artisan = the hook for extra options, "Extra options: to come". Each staff member does one job at a time and all five work in parallel. Craft Magic Item stays a separate order. Alchemist = 33 items, no party-level gate. Dread Helm, Moon-Touched Sword and Smoldering Armor stay Compendium-only.
11. **Hall, Dock and the rest:** the Barracks' Commercial Convoy and Watchtower's Maritime Approaches disappear; Management's Defenders, Menagerie Beasts and Military lists go (Creatures and the Beast Handler box move into the Beast Pen); Honour/Respect and Political Capital change only through the DM doc's **Change A Score** (the Hall shows them read-only); automatic diplomatic incidents are dropped; existing Trade Agreements, Writs and Consortiums stop at migration and stay as read-only history; the Dock's Routes map glows for each Clan with a registered Port Charter; "Diplomatic Events" is the Diplomatic Records ledger; Register Port Charter stays a 3-day order, now at the Dock.
12. **Migration:** refund everything the change cancels (gold, Favour, goods) and tell Harry once in plain English on first open; the old save is kept as a copy; war records are dropped.
13. **Party identity:** click the crest badge to open a smaller panel with Party Name box (optional, 40 characters), Create in the Crest Creator, Upload, Remove; the Creator window and "Use for the Bastion" stay; the name shows whenever set, above the crest only; founding a Clan is removed (an old Clan's name becomes the Party Name); the tool stays "Clan Crest Creator" for now.
14. **DM doc:** the four-panel layout (Party, Bastion, Explorer, Quest) with the defaults listed in `D-dmdoc.md` section "Questions": Clan scores compact under Where The Party Is; expedition days = today minus start day and an "ended" line that stays until the next expedition; a held Great Rite as a line under Party Effects; up to five pending orders listed; Quest box text up to 200,000 characters, with PDF/Word import (Replace / Add to the end / Cancel), Clear asks first, Save as text file; floating DM doc kept as well as the pop-out, one pop-out at a time, opening wider.
15. **Beast Handler app:** Profile / Bond / Chronicle, read-only for players after the first meeting; no Orders; Bond has a Bonding Days counter and pills that fill; old links re-linked once by QR; Day Log messages that mattered become short notices.

## 3. Small calls made on Harry's behalf (say if any should change)

- **The initiation roll is made by the Bastion**, once, when acclimatisation passes (personality dice genuinely random; regional variety fixed). The phone only plays the reveal as a roll. This keeps the app read-only (no cheating surface) and matches "get what they are given" (`H-handler-app.md`, option O1).
- **Online service:** Firebase Realtime Database (the project already bundles the Firebase library), in a project Harry owns; a step-by-step jargon-free setup guide is part of the work. The link only carries encrypted, signed snapshots.
- A Beast Pen picture for the map is the Menagerie overlay (Harry's answer); the tile uses the Menagerie picture until Harry supplies one.
- The Temple's map and tile art reuse the three shrine paintings together.

## 4. Order of work

Follows `docs/strip-back/J-cross-cutting.md` section 8: steps S00 to S22, replacement before removal, one migration (`R.migrateToV4`) that grows with each step, the rules page and the named click-throughs green after every step, everything run after S06b, S11, S14 and S22. Each step is committed on its own.

| Step | What |
|---|---|
| S00 | Baseline, this plan, restore point |
| S01 | Version 4 shell, migration skeleton, safety audit, "The Bastion has changed" box |
| S02 | Replacement surfaces (Explorer changes list, notices) |
| S03 | Beast Handler data: Buckbear, Fellcat, Blacktide, fixed varieties |
| S04 | Production facilities: one self-contained order per level |
| S05 | Remove Bastion Events |
| S06a-c | Remove the war game, five facilities, leftovers |
| S07 | Party Name; no Form a Clan |
| S08 | The Dock takes Port Charters and the Routes map |
| S09 | The Hall stripped |
| S10 | Clan Influence and Day Log panels removed |
| S11 | The Temple |
| S12 | Workshop staff |
| S13 | Beast Handler app part 1 (read-only, three tabs, Bastion rolls initiation) |
| S14 | Beast Pen and bonding |
| S15 | Beast Handler app part 2 (Bond page) |
| S16 | DM doc |
| S17 | QR linking and the optional online link (off) |
| S18 | Day Log state removal and wording sweep |
| S19 | Art and map |
| S20-S21 | Guide, docs |
| S22 | Full regression, the pull request and Harry's checklist |
