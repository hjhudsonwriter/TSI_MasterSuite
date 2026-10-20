# Griffin Tower and Dire Wolf Den: bonding, training and Chronicle (PROPOSAL)

Draft for Harry's approval, 21 October 2026. **Nothing here is built.** Every number, name and rule below is a proposal until Harry approves it; where the Wyvern Roost spec already decided something, this proposal reuses it and says so. Anything about the animals themselves (temperament, lore, whether they can be ridden) is left to Harry.

## 1. What already exists (kept as it is)

- **Griffin Tower** and **Dire Wolf Den**: built from party level 5; each has one Level 1 House order (3 days, no gold). **Room: one creature per level** (1 at Level 1 up to 5 at Level 5). The DM grants griffins and dire wolves in the Explorer; each is a named creature that must be housed.
- **War numbers** (fixed, Defend Bastion only, never killed or captured, at worst badly wounded for 21 days):
  - Griffin: Cohesion 5, Attack +5, Defence 12, Move 6, Resolve +1, Battle Value 8, Flight.
  - Dire wolf: Cohesion 5, Attack +5, Defence 12, Move 5, Resolve +1, Battle Value 7, Pack.
- **Separate, untouched:** the Menagerie and its counted beasts.
- **Already built for the Wyvern Roost and reusable as-is:** the development record on each creature (kept through save, reload, export and import), the bond ladder 0–5 with the DM confirming every bond step, handlers, the Chronicle, training places, programmes that pause while a creature recovers, per-creature Defend Bastion bonuses (Battle Value unchanged), and the profile on the building's panel.

## 2. The big design question for you

The Roost's programmes lead towards **riding** (harness, flight, first flight). Do griffins and/or dire wolves have a riding future in your campaign?

- **Recommended: no riding programmes for either, for now.** Bonding, training and defence only. If riding is wanted later it gets its own specification, as it did for wyverns. The data is built so adding it later is additive.
- Option: add a griffin riding track later (a harness and first flight like the wyvern). Needs your rules.
- Dire wolves: I assume ground pack animals with no mounted track. Tell me if not.

## 3. Shared rules (copied from the Wyvern Roost, approved on 20 October 2026)

1. **Bond 0–5, one handler.** A granted creature starts at Bond 0 with no handler; the DM assigns one. Changing handler needs a reason, keeps the history and restarts at Bond 0 unless you credit the old bond.
2. **A programme finishing only makes the next bond milestone ready.** You confirm it after a scene at the table, with a reason, and the bond rises by exactly one level. Nothing lowers a bond by itself.
3. **Every programme is free, once per creature, one at a time per creature,** and each creature has one programme at a time.
4. **Defend Bastion bonuses are per creature,** from its own learned programmes only (Battle Value stays as it is). No bond gives a stat bonus.
5. **Recovery pauses a programme** without losing days.
6. **Chronicle, temperament notes (your own words), and "Add a note…"** on each housed creature's profile. No care meters, feeding or random events.
7. Housing a creature never uses a training place.

## 4. Proposed names for the bond steps

The ladder is the same number of steps; I suggest the names stay the same for both animals so the DM only learns one system (Unfamiliar, Acclimatised, Trusting, Bonded, Devoted, Legendary Partnership). **Question:** do you want different names for the wolves (for example a pack-flavoured ladder)? Recommended: keep one ladder.

## 5. Proposed programmes

Days copy the matching Roost programmes. "Level" is the building's level. All free.

### Griffin Tower

| Level | Programme | Days | Needs | Result |
|---|---|---:|---|---|
| 1 | Safe Acclimatisation | 5 | handler, Bond 0 | Bond 1 milestone ready |
| 1 | Establish Keeper's Routine | 7 | Bond 1 | Bond 2 milestone ready |
| 2 | Signal & Recall Training | 7 | Bond 2 | Bond 3 milestone ready |
| 2 | Territorial Defence Drills | 7 | Bond 2 | +1 Resolve |
| 3 | Open-Sky Return Training | 10 | Bond 3 | Bond 4 milestone ready |
| 3 | Aerial Sentinel Training | 7 | Bond 3 | +1 Defence |
| 4 | Diving Strike Drills | 10 | Bond 4 and Aerial Sentinel | +1 Attack |
| 5 | (nothing new proposed) | | | Bond 5 and the Level 5 room only |

Bond 5 for a griffin: the Roost's Rider's Pact needs a first flight. With no riding, **Bond 5 needs a different gate.** Proposal: a Level 4 programme **The Eyrie Oath** (14 days, Bond 4) that makes the Bond 5 milestone ready, with the scene entirely yours. Alternative: stop griffins at Bond 4. See question 3.

### Dire Wolf Den

| Level | Programme | Days | Needs | Result |
|---|---|---:|---|---|
| 1 | Safe Acclimatisation | 5 | handler, Bond 0 | Bond 1 milestone ready |
| 1 | Establish Keeper's Routine | 7 | Bond 1 | Bond 2 milestone ready |
| 2 | Heel & Recall Training | 7 | Bond 2 | Bond 3 milestone ready |
| 2 | Den Defence Drills | 7 | Bond 2 | +1 Resolve |
| 3 | Roaming Return Training | 10 | Bond 3 | Bond 4 milestone ready |
| 3 | Pack Sentinel Training | 7 | Bond 3 | +1 Defence |
| 4 | Pack Hunt Drills | 10 | Bond 4 and Pack Sentinel | +1 Attack |
| 4 | The Pack Oath | 14 | Bond 4 | Bond 5 milestone ready |
| 5 | (nothing new proposed) | | | the Level 5 room only |

**Training places** (proposed, same as the Roost): 1, 1, 2, 2, 3 by building level. (The room is only 1 to 5 creatures, so Level 1 and 2 each have one creature and one place.)

## 6. Existing creatures and saves

- A griffin or dire wolf already granted and housed keeps everything it has and starts at **Bond 0** with no handler; nothing is credited or changed on load. (Only Elara's wyvern has the Bond 1 credit, by your decision.)
- Their development record is made only when you first work with them; saves of anyone else are unchanged.
- No orders or rules of the House orders, room, War Table, Menagerie or grants change.

## 7. What the build would involve (one pull request, after approval)

The Roost's code is currently written for wyverns only (the species and the building's name are fixed in the checks and messages). The build would:
1. Make the training orders data-driven per species and building (each programme names its species and building), so the Roost behaves exactly as today.
2. Add the griffin and dire wolf programmes above to their buildings, with the same exact "why not" messages.
3. Show the same profile (handler, bond, programmes, temperament, Chronicle) on both panels. No riding line for them unless you choose riding.
4. Add per-creature bonuses to the data (programme id → stat).
5. Tests for both animals plus the Roost regression suite; guide and docs.

## 8. Questions for you (recommended answer first)

1. **Riding:** none for griffins or wolves for now? *(Recommended: none.)*
2. **Bond names:** one shared ladder? *(Recommended: yes.)*
3. **Griffin Bond 5 gate:** a Level 4 programme (The Eyrie Oath, 14 days), or stop griffins at Bond 4? *(Recommended: The Eyrie Oath, exactly mirroring The Pack Oath.)*
4. **Programme names and days** above: approve, or give your own names/days?
5. **Defend Bastion bonuses** as in the tables (+1 Resolve, +1 Defence, +1 Attack, Battle Value unchanged)?
6. **Training places** 1, 1, 2, 2, 3 for both buildings?
7. **Handlers:** are any current griffins or wolves already bonded to a player character (to be credited like Elara's wyvern)? *(Recommended: none unless you tell me.)*
8. **Dire wolf Level 5 and griffin Level 5:** nothing new at Level 5 (only room)? Or do you want a Level 5 capstone programme for each?
