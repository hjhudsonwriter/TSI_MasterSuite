# Pull request 8: Military and diplomacy, the plan so far

This file is for Harry and his planning assistant. It records Harry's answers of 15 October 2026, sorted into four kinds:
- **Keep:** what works today and must not change.
- **Agreed:** design principles Harry has agreed.
- **Proposed:** ideas not yet approved.
- **To decide:** questions still open.

Nothing marked Proposed or To decide gets built until Harry approves the details. When a question is answered, write the answer under it and say "go".

**Status (15 October 2026):** 8a is built and merged (#30) (the creature guards and the War Room's regiments, training, Recouping and Musters). 8b, the Shrines: S2, S9 and S10 answered (below); ready to build on Harry's go-ahead.

**Split, at Harry's request** (decisions of 15 October 2026 below):
- **8a:** the two creature guards, plus the War Room.
- **8b:** the Hall of Emissaries and the three Shrines.
- The research trees for the War Room, Hall and Shrines come later, once Harry approves each complete tree.

---

## 0. Already decided and ready to build (8a)

**Creature guards** (Harry, 15 October 2026: "both"):
- Grant a creature… in the Explorer asks "Are you sure?" before sending.
- A creature still waiting for a home gets a **Release** button. It asks first, then removes the creature from the register. Its receipt stays, so it never comes back by itself.
- A creature already housed has no Release button. This matches the rule "once housed, it guards for good".

**Decided (Harry, 15 October 2026):** G1, no. A housed creature has no Release button.

---

## 1. War Room (8a)

### Keep
- The six regiment types: Levy Infantry, Line Infantry, Heavy Infantry, Archers, Light Cavalry and Shock Cavalry. Also Lieutenants.
- Everything about them stays exactly as it is: their stat blocks, sizes, Battle Values and War Table rules (`war-units-data.js` and `war-battle-rules.js` are protected).
- The 7-day Recruit order, and everything can still be recruited at Level 1.
- Replenishing a depleted regiment before adding a new one.

### Agreed
- Two systems. **Research** unlocks training programmes, doctrines and abilities. **Drill orders** apply that training to *one chosen regiment*.
- Research never improves every regiment of a type at once.
- Every regiment keeps its own training record. The record survives saving, loading, the War Table, battles, casualties and replenishment.
- Each regiment can have **one specialist doctrine** at first.
- The facility's levels:

  | Level | What it unlocks |
  |---|---|
  | 1 | Recruitment, as today |
  | 2 | Training orders for individual regiments |
  | 3 | Better coordinated recruitment and replenishment |
  | 4 | Specialist formation training, through research |
  | 5 | Advanced training and larger coordinated musters |

- If the numbers aren't approved yet, build the per-regiment record and the order framework first, and switch on the battle bonuses later.

### Proposed (not approved)
Four research branches:
- **Infantry Doctrine:** Basic Drill, Defensive Formations, Veteran Discipline (+1 Resolve suggested), Advanced Infantry Tactics.
- **Archery Doctrine:** Archery Training, Marksman Drills, Veteran Bowmen, Advanced Missile Tactics.
- **Cavalry Doctrine:** Mounted Training, Charge Coordination, Cavalry Manoeuvres, Elite Cavalry Tactics.
- **Military Command & Logistics:** Recruitment Administration, Supply Organisation, Officer Training, Grand Strategy.

Example of a specialist variant: Veteran Line Infantry, +1 Resolve, for one regiment only.

### What the code does today (it matters for the decisions below)
- Identical regiments are stored together as **one row with a count**, for example "Line Infantry ×2". Only a depleted regiment gets its own row.
- So per-regiment training first needs **each regiment stored as its own record**. That change alters no stats and no battle results. It only changes how regiments are listed.

### Decided (Harry, 15 October 2026): this is what 8a builds
The full proposal is in `docs/specs/war-room-training.txt`. Harry approved its numbers as written.
- **W1, names:** each regiment is numbered automatically ("Line Infantry I", "Line Infantry II"), and the DM can rename it.
- **W2:** Lieutenants have no training record.
- **W3:** a regiment destroyed in battle loses its training with it.
- **Training (War Room Level 2):** Regular → **Trained** → **Veteran**. The steps go in order, and each applies to one chosen regiment.

  | Step | Days | Gold | Effect on the War Table |
  |---|---|---|---|
  | Trained | 7 | 25 gp × the unit's base Battle Value | +1 Resolve, +0.5 Battle Value |
  | Veteran | 14 more | 50 gp × base Battle Value | keeps Trained's, plus +1 Cohesion and +0.5 Battle Value |

  - Training never changes Attack, Defence, Move, range or Charge.
  - The base profiles in `war-units-data.js` stay unchanged; the bonus is added to each trained regiment only.
- **Drill slots:**
  - Level 2: 1; Levels 3–4: 2; Level 5: 3.
  - One regiment takes one drill at a time.
  - The gold is paid once, when the drill starts.
  - A regiment that is drilling stays at the Ironbow. It can't go on a War Action, but it still defends the Ironbow if it's attacked.
- **Recouping:** a surviving regiment that has lost soldiers gets a **Recouping** tag and refills gradually. How long depends on the share it has lost:

  | Soldiers lost | Time to refill |
  |---|---|
  | Up to 20% | 3 days |
  | Up to 40% | 7 days |
  | Up to 60% | 10 days |
  | More than 60% | 14 days |

  - It can't train until it's back to full strength.
  - Training survives casualties and refilling.
  - A Recruit order of the same type still refills it at once, clearing Recouping.
- **Coordinated Muster** (Level 3) raises or refills 2 formations in 7 days, and **Grand Muster** (Level 5) raises or refills 3 in 7 days. Recruitment costs are unchanged.
- **Not in 8a:**
  - Grand War Exercises waits for the Command & Logistics research.
  - Upkeep stays uncharged, as today (B7).
  - The research tree and specialist doctrines (Level 4) wait for Harry's approved tree (W11, W12).

---

## 2. Hall of Emissaries: redesign later, nothing new in pull request 8

**Harry (15 October 2026):** the Level 4 Preferred Supplier Contract and the Level 5 Major Commercial Accord are **withdrawn**. The Hall will be redesigned in its own future phase, as a diplomatic and political facility. The plan is in `docs/specs/hall-of-emissaries-redesign.txt`.

For now:
- **No new Hall orders.** The Hall can still be upgraded to Level 5; Levels 4 and 5 add no orders yet.
- **Keep everything that works:** every Level 1–3 order, Port Charter registration, the old Trade Agreements, the Trade Consortium and the Trade Network. These are only retired later, through a separately planned change that keeps saves safe.
- **No Commercial Treaties panel.**

---

## 3. The Shrines (8b)

### Keep
- Craft (two charms, 5 days) and Pray (three prayers, 1 day) at every Shrine.
- **Divine Favour**, 0–100% for each god. Today only a Blessing prayer fills it.

### Agreed
- Levels unlock orders. Research unlocks enhancements.
- Blessings become tracked consumables or charges, or effects applied automatically, using Divine Favour. Nothing is described as automatic unless the code actually does it.
- Consumables go into the Warehouse and can be sent to the party by the Courier Exchange.
- Pelagos' shipment blessing uses the existing voyage risk. It doesn't get a separate calculation.
- Suggested: one major Shrine blessing active per expedition.

### Harry's specification (15 October 2026), for 8b
- **Divine Favour costs:**

  | Level | Favour from that Shrine's god |
  |---|---|
  | 1 (existing actions) | unchanged |
  | 2 | 0 |
  | 3 | 5 |
  | 4 | 10 |
  | 5 (Great Rites) | 25 |

  - The Favour is taken once, when the order starts.
  - Every cost and quantity is kept in a data file.
- **The orders:**

  | | Telluria | Aurush | Pelagos |
  |---|---|---|---|
  | **Level 2** (3 days) | **Earthward Talisman:** +2 to one saving throw against a nonmagical natural-terrain hazard | **Blessed Lantern:** fuel-free light, 20 ft bright plus 20 ft dim, three days of use | **Bless Voyage:** +2 to one navigation or maritime hazard check |
  | **Level 3** (4 days) | **Rootguard Salve**, 2 doses: advantage on one save against being Restrained by nonmagical vegetation | **Purification Incense**, 2 portions: advantage on one save against nonmagical poison or disease | **Aquatic Protection Charm:** advantage on one Athletics check (swimming, currents, nonmagical water hazard) |
  | **Level 4** (5 days) | **Bless Bastion Foundations:** 1 charge that prevents one eligible environmental Under Repair event (not damage from a military defeat) | **Consecrate Expedition Supplies:** 3 portions, each removing Poisoned from one creature | **Bless Commercial Shipment:** 1 charge, −10 percentage points on one commodity voyage's failure chance, used when the ship sets out |
  | **Level 5** (7 days) | **Great Rite: Earth's Endurance:** prevents one level of Exhaustion from a failed travel or environmental save | **Great Rite: Cleansing Radiance:** removes Poisoned or Frightened from up to two party members | **Great Rite: Tide's Passage:** turns one failed water-related navigation or environmental check into a success |

- **Major Expedition Blessing:**
  - Only the three Great Rites count, and the party may hold one at a time.
  - Its charge is used once.
  - The DM starts and ends an expedition; unused charges expire at the end.
  - A finished Great Rite waits at the Ironbow until the DM assigns it.
- **Physical items** go into the Warehouse, and travel by courier only if the Courier Exchange carries that kind of item.
- **Charges and uses:**
  - Charges have a Use action in the Travel bags where possible.
  - Inside the Explorer, an effect applies when the DM selects it.
  - Outside it, the screen shows short instructions and the DM marks the item used.
  - Using a charge counts once, whatever is reloaded or imported.
  - Nothing is added to character sheets.

### What the code can hook into today, and the gaps to settle before 8b
- **Voyage risk** (pull request 5) can take the −10 percentage points directly, so Bless Commercial Shipment is ready to build.
- **The Bastion's d100 events:** Bless Bastion Foundations needs a list of which events are "environmental Under Repair" events.
- **The Explorer's events** have skill checks with DCs, but none are labelled as a natural-terrain hazard, a maritime hazard, vegetation, or poison/disease. Several also aren't saving throws. Each event needs a label before a charm can apply to it. **S2:** I list the events and Harry ticks them.
- **The Explorer has no conditions** (Poisoned, Frightened, Exhaustion) **and no expeditions**: there's no "start" or "end". These parts would be "the DM marks it used", plus a new Start/End expedition button. **S9:** confirm.
- **The Courier Exchange carries only packs and charts.** **S10:** may it carry the Shrine items too?
- The specification above is Harry's Shrine implementation document, pasted into his message of 15 October 2026.
- **S8:** the Shrine research trees, later.

### Decided (Harry, 15 October 2026), for 8b
- **S2, tags:** the events' data says which kind of hazard each check is:
  - **natural-terrain saving throws** (Earthward Talisman, Earth's Endurance): Rootfall, The Drowned Bell and The Ember That Won't Die;
  - **being Restrained by vegetation** (Rootguard Salve): Rootfall;
  - **water and navigation** (Bless Voyage, Aquatic Protection Charm, Tide's Passage): The Tide Causeway, The Drowned Bell and False Lights at Bleakharbour;
  - **poison or disease** (Purification Incense): no event yet.

  A tagged check offers the matching charm. Every other check, and checks outside the Explorer, use "the DM marks it used". The tags are data, so they're easy to change.
- **S9, expeditions:** the Explorer gets **Start expedition** and **End expedition**.
  - A Great Rite waits at the Ironbow until the DM assigns it during an expedition.
  - The party holds one Major Expedition Blessing at a time; it is used once and expires when the expedition ends.
  - Conditions stay the DM's to apply: Use… records the charge once and shows a short reminder of what it does.
- **S10, the courier:** the Courier Exchange carries the Shrine's physical items (talismans, salves, lanterns, incense, charms and cleansing portions), each counting as 1 item, and they arrive in the Travel bags with their charges. Bless Bastion Foundations and Bless Commercial Shipment stay at the Ironbow, and Great Rites are assigned, not posted.
