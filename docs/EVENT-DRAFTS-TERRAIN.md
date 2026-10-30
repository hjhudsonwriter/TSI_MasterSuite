# Draft events for Marsh, Mountain climb and Mountain trails (29 October 2026)

**Entered into the Explorer on 30 October 2026** (EXP-TERRAIN-03 in KNOWN_ISSUES.md), with two extra Mountain trails events (T24, C16) added on request. This page is the original draft; the events themselves live in `tools/explorer/data/journey-events.js`.

What these are written to do:
- Fill the gaps from the terrain review: Marsh and Mountain climb have no events, and Mountain trails only the Prospector and the Beacons.
- Use only things the Explorer already knows how to do: skill checks with DCs, choices, gold, miles lost (a hex is 6), a day lost, effects, a thread, inspiration, and a suggested fight. Use the hazard tags the Shrine charms already respond to (terrain, vegetation, water, exhaustion).
- Work in any region (so they use {clan} and {chief} where a clan appears, and invent no new clan, god or place).
- Stay out of the campaign's open questions: nothing here touches the Grey Tide, the three knocks, the Sunheart, the Markers or Maerys Vell.
- Pitched at levels 7 to 16, like the others (DCs 13 to 15).

Codes follow on from the existing ones (T18 and C12 are the last used). "Chance" is not set per event; the day's roll decides when any event happens.

---

## Marsh

### T19 · The Sunken Causeway (travel · terrain: Marsh)
*Survival, then Athletics · a rescue or a haul*

**Read aloud.** Black water on both sides, and ahead a plank road gone soft with age, half under the mire. Every third plank is missing. Someone has driven fresh marker-poles in beside it, and a few have snapped.

- **Wisdom (Survival), DC 14, one hero:** read which planks will bear weight.
  - **Success:** the party crosses cleanly. A dry cache sits under a tarred sheet at the far end: **50 gold** in coin and a coil of good rope (DM's call; a minor item).
  - **Failure:** a plank gives way. Every hero makes a **Dexterity saving throw, DC 14** (terrain, vegetation). Anyone who fails sinks to the chest in mire. A **Strength (Athletics) check, DC 13** from another hero hauls them out. If nobody manages it, the party loses **12 miles** (two hexes) getting them free.
  - Anyone who ended up in the mire gains **Mire-Caked** (disadvantage on Dexterity checks until the next Make Camp).

### T20 · The Marsh Lights (travel · terrain: Marsh)
*Nature or Survival, then a choice · may lead to a fight*

**Read aloud.** Pale lights drift between the reeds, a few hundred yards off, slow as boats. They do not flicker like lanterns. They bob, wait, and move on, as if waiting for you to follow.

- **Intelligence (Nature) or Wisdom (Survival), DC 15, one hero:** are these marsh-gas lights, or a lure?
  - **Success:** it is marsh-gas, harmless. The old drovers' road runs alongside it; the party gains **6 miles** of easy going.
  - **Failure:** the hero cannot tell. The party chooses:
    - *Follow the lights:* they lead to a drowned waystone and a cache of 100 gold, but something in the water has been luring travellers to it. **Suggested fight:** levels 7 to 10, 3 bog-dwellers (a swamp predator of the DM's choosing, such as a **bog hag's drowners** or **4 crocodiles**); levels 11 to 16, add a **shambling mound**.
    - *Keep to the road:* the lights drift away. Nothing gained, nothing lost, but the detour costs **6 miles**.

### C13 · Fever in the Reeds (camp · terrain: Marsh)
*Constitution save, then a bargain with a reed-cutter*

**Read aloud.** The insects come at dusk and do not stop. By midnight your skin is hot and the reeds seem to lean in closer.

- Every hero makes a **Constitution saving throw, DC 13** (exhaustion, terrain). Those who fail gain **Marsh-Fever** (no benefit from tonight's long rest; they cannot gain inspiration tomorrow).
- A reed-cutter, awake at her own small fire, calls across: "Boil the water first. Next time." She will sell a **fever-bark remedy** for **50 gold** that clears the fever outright. A **Wisdom (Medicine) check, DC 14** works out the remedy without paying.

---

## Mountain climb

### T21 · The Cut Rope (travel · terrain: Mountain climb)
*Investigation, then a group Athletics check*

**Read aloud.** A fixed rope runs up the cliff face, its pegs bright in the grey rock: the climbers' way up. Its end lies coiled at your feet. Someone has cut it clean and left the cut end where you would find it.

- **Intelligence (Investigation), DC 14, one hero:** the cut is old, weathered, and made by a blade, not frayed.
  - **Success:** the party spots a second, hidden handhold line a short way left and climbs it with care. The climb costs no extra time.
  - **Failure:** the party climbs the cut rope's old line. A **group Strength (Athletics) check, DC 15** (terrain): if the group fails, someone falls from 20 feet (**2d6 bludgeoning**) and the party loses **12 miles** to the recovery.
- *DM note:* who cut it is left open. It may have been a rival climber, a local who does not want strangers on the face, or just a bad winter. Leave it for the table.

### T22 · Rockfall on the Face (travel · terrain: Mountain climb)
*Perception for the warning; Dexterity saves for the fall*

**Read aloud.** A pebble skips past your boot. Then another. High above, something small and loose gives a dry, clicking sound.

- **Wisdom (Perception), DC 14, the lead hero:** hear it coming.
  - **Success:** the party gets a warning shout and **advantage** on the saves below.
  - **Failure:** no warning.
- Every hero makes a **Dexterity saving throw, DC 15** (terrain). On a failure, **3d8 bludgeoning** (half if the climber braces under an overhang, DM's call). Anyone who fails loses their grip and slides for **6 miles' worth of height** (the party loses **6 miles**).
- *Optional choice if a hero has a rope or pitons:* anchor the party before the fall and take the save at advantage.

### C14 · The Cairn of Names (camp · terrain: Mountain climb)
*Constitution save for the thin air; a quiet choice*

**Read aloud.** There is a cairn at the ledge where you camp, taller than a man, built from thousands of flat stones. Scratched into the stones, in a hundred hands, are names.

- Every hero makes a **Constitution saving throw, DC 14** (exhaustion) against the thin air. Those who fail gain **Short of Breath** (disadvantage on the first Athletics or Acrobatics check tomorrow).
- A hero who adds their own name to the cairn gains **inspiration**: an old climbers' habit that the thin air makes feel important. (Anyone who adds a name from a past hero or a lost companion gains it twice, at the DM's call.)
- *DM note:* a name the party knows could be among them, if you want a small hook. Not required.

---

## Mountain trails

### T23 · The Shepherd's Warning (travel · terrain: Mountain trails)
*Survival, then a choice*

**Read aloud.** A shepherd is bringing her flock down the trail at a fast, uneasy walk. She stops when she sees you. "Not today," she says, and nods upslope at a white edge of cloud on the ridge. "That's coming down by dark."

- **Wisdom (Survival), DC 13, one hero:** judge how bad the weather will be.
  - **Success:** the party finds shelter in a stone shepherd's hut a short way on and loses no time. Gains **Dry and Rested** (advantage on the first Constitution saving throw tomorrow).
  - **Failure:** the weather catches them. The party chooses: *push on* (a **Constitution saving throw, DC 14**, exhaustion; those who fail gain a level of exhaustion that fades with the next long rest) or *turn back and wait it out* (the party loses **12 miles**).
- *Optional:* the shepherd will guide the party for **50 gold**, avoiding any failure above.

### C15 · Smoke on the Ridge (camp · terrain: Mountain trails)
*Perception, then History or Persuasion*

**Read aloud.** Across the valley, on the far ridge, a thin line of smoke rises. A minute later, a second answers it from further along. They look like signals, though there is no pattern you can read.

- **Wisdom (Perception), DC 14, one hero:** work out they are watch-fires, not a camp.
  - **Success:** the heroes recognise the fires as {clan} scouts keeping the ridge. They can send word, or stay quiet.
  - **Failure:** the party cannot tell. A scout reaches the camp by morning and is wary of them.
- A **Charisma (Persuasion), DC 14** check with the scout: on a success, gains a **thread** "What the Scouts Watched For": the scout mentions {chief} has had the ridge doubled for a week and will not say why. On a failure, the scout leaves them with only a warning to keep to the trails.
- *DM note:* a thread to follow, not an answer. What the clan is watching for is for you to decide when it matters.

---

## Questions for you
1. **Gold and items:** are 50 and 100 gold about right for these (the existing events use 50 to 250)? And are you happy for the Sunken Causeway to hand out a minor item, or should it stay gold only?
2. **The fights** in T20 are only suggestions. Do you want them wired into the Combat Tracker (I'd need names and numbers to add to `fights-data.js`), or left as a DM line?
3. **Exhaustion:** T23 uses a level of exhaustion as a penalty. Is that too harsh for a one-in-three roll?
4. **Mountain trails:** I have written one travel and one camp event. Do you want more here, since the Prospector and the Beacons already use that terrain?
5. **Regions:** should any of these be limited to a map or province (as most of the older ones are), or kept open to anywhere?
