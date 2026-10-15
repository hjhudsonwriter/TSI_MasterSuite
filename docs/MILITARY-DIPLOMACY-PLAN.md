# Pull request 8: Military and diplomacy, the plan so far

This file is for Harry and his planning assistant. It records Harry's answers of 15 October 2026, sorted into four kinds:
- **Keep:** what works today and must not change.
- **Agreed:** design principles Harry has agreed.
- **Proposed:** ideas not yet approved.
- **To decide:** questions still open.

Nothing marked Proposed or To decide gets built until Harry approves the details. When a question is answered, write the answer under it and say "go".

**Split, at Harry's request:**
- **8a:** the two creature guards, plus the War Room.
- **8b:** the Hall of Emissaries and the three Shrines.
- The research trees for the War Room, Hall and Shrines come later, once Harry approves each complete tree.

---

## 0. Already decided and ready to build (8a)

**Creature guards** (Harry, 15 October 2026: "both"):
- Grant a creature… in the Explorer asks "Are you sure?" before sending.
- A creature still waiting for a home gets a **Release** button. It asks first, then removes the creature from the register. Its receipt stays, so it never comes back by itself.
- A creature already housed has no Release button. This matches the rule "once housed, it guards for good".

**To decide:**
- **G1.** Should a housed creature also be releasable? The suggestion is no, because nothing in the brief asks for it.

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

### To decide

**Regiment records (needed even for a framework-only 8a):**
- **W1.** How is each regiment named? (a) Numbered automatically: "Line Infantry I", "Line Infantry II". (b) The DM can rename one, for example "The Ironbow Guard". (c) Both (suggested).
- **W2.** Do Lieutenants get training records? The suggestion is no: they are officers, not formations.
- **W3.** If a regiment is destroyed in battle, its training is lost with it. Confirm?

**Training (Level 2):**
- **W4.** What are the training steps (tiers) and their names? For example, Untrained → Drilled → Veteran.
- **W5.** For each step, per regiment type:
  - the days and gold it takes;
  - its exact effect on the War Table (which stats change);
  - the Battle Value change.
- **W6.** Can two regiments train at once? Or one at a time per War Room, or per level?
- **W7.** Can a depleted regiment train? Does a regiment in training still fight if the Ironbow is attacked?
- **W8.** If a regiment has lost more than half its soldiers, does it keep its training when it's replenished? (Your rule says casualties must not erase it. Confirm this holds even for heavy losses.)

**Levels 3 and 5:**
- **W9.** Level 3, "better coordinated recruitment and replenishment": exactly what changes? For example, a shorter Recruit order, recruiting two regiments in one order, or a cheaper or faster refill.
- **W10.** Level 5, "larger coordinated musters": exactly what? For example, one order raising several regiments at once. How many, and how many days?

**Research (Level 4), later:**
- **W11.** The complete War Room tree in the Herbal Gardens shape: 4 branches × 3 stages, 2 choices per stage, with days, gold and exact effects.
- **W12.** How does a researched doctrine reach a regiment? Is it its own Drill order (days and gold?), or part of the Level 2 training?

**Suggestion for 8a, to keep it small:** build the creature guards and separate regiment records (W1–W3) now. That changes no battle results. Training goes live once W4–W8 are answered.

---

## 2. Hall of Emissaries (8b)

### Keep
- All the Level 1–3 orders and diplomacy: Secure Trade Agreement, Host Delegation, Register Port Charter, Secure Writ of Authority, Trade Consortium, plus summits, arbitration, Political Capital and Clan relations.
- The diplomacy modifier stays capped at **+6**, including at Levels 4 and 5.

### Agreed
- Levels unlock ordinary orders. Research unlocks extra abilities.
- Contract improvements are stored with each agreement and applied automatically.

### Proposed (not approved)
- **Level 4, Negotiate Preferred Supplier Contract (7 days):** improve the terms of an existing agreement, such as the sale price, tariff, cargo allowance or contract length.
- **Level 5, Negotiate Major Commercial Accord (10 days):** a major agreement with a Clan.
- Research directions: Trade Policy, Diplomatic Influence, Negotiation Efficiency, Contract Management and Political Leverage.

### To decide
- **H1.** Which agreements can Level 4 improve? Trade Agreements, Trade Consortium shares, the Dock's trade with a Clan, or Port Charter voyages?
- **H2.** How is the negotiation settled? For example, a d20 plus the existing diplomacy modifier against a DC. Which DC? Does it need Honour/Respect or Political Capital?
- **H3.** What does it cost (gold or Political Capital), and what happens on a failure?
- **H4.** Which single term improves, and by how much? Can the same agreement be improved more than once?
- **H5.** Level 5, Major Commercial Accord: who can sign it, what it gives, what it costs, how it's settled, and how long it lasts.
- **H6.** The complete Hall research tree (later).

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

### Proposed (not approved)

| | Telluria | Aurush | Pelagos |
|---|---|---|---|
| Level 2 (3 days) | Earthward Talisman: −1 DC on the next natural-terrain hazard save | Blessed Lanterns (light sources) | Bless Voyage: −1 DC on the next maritime hazard check |
| Level 3 (4 days) | Rootguard Salve (2 doses): against plant restraints and hazards | Purification Incense (2): against poison and disease | Aquatic Protection Charm: a water-travel or swimming benefit |
| Level 4 (5 days) | Bless Bastion Foundations: one charge against a Bastion environmental-damage event | Consecrate Expedition Supplies (3 improved consumables) | Bless Commercial Shipment: spends Favour to cut a voyage's failure chance by **10 percentage points** |
| Level 5 (7 days) | Great Rite of Telluria | Great Rite of Aurush | Great Rite of Pelagos |

### What the code can hook into today
- **The Explorer's events** have skill checks with DCs, for example Wisdom (Survival) DC 14. They are **not tagged** as "natural-terrain hazard", "maritime hazard", "plant restraint" or "poison/disease". A charm can only apply automatically once each event says which kind it is.
- **The Bastion's events:** the Bastion has a d100 event table. "Environmental-damage event" needs a list of which of those events count.
- **Voyage risk** (Port Charter voyages, pull request 5) can take a percentage cut directly. This is the one Level 4 effect that is ready to build, once its Favour cost is set.

### To decide
- **S1.** The Divine Favour cost of each order that spends Favour (Level 4 Pelagos, all three Level 5 Rites, and any others).
- **S2.** Which Explorer events count as "natural-terrain hazard", "maritime hazard", "plant restraint" and "poison/disease"? (Suggestion: I list the events and you tick them.)
- **S3.** The exact rule for each Level 2–3 item: what it does, how many uses, how long it lasts, and its gold cost if any. Examples:
  - Blessed Lanterns: what do they do in play?
  - Aquatic Protection Charm: what is its benefit?
- **S4.** Which Bastion events count as "environmental damage" for Bless Bastion Foundations, and what the charge does: prevents the event, or halves its damage?
- **S5.** What Consecrate Expedition Supplies makes, exactly. Is it improved Incense?
- **S6.** What each Great Rite does, for how long, and how many uses.
- **S7.** Is "one major blessing per expedition" a rule? Which items count as major? What counts as an expedition: from leaving the Ironbow to coming back?
- **S8.** The complete Shrine research trees (later).

**Suggestion for 8b:** once S1 is answered, Pelagos' Level 4 Bless Commercial Shipment is ready to build. Everything else in 8b waits for H1–H5 and S2–S7.
