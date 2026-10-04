# The war mini-game: how a war works

This is the rulebook for the Ironbow Bastion Manager's wars, as built in phase 2 (October 2026). Every number here is a **starting value to test at the table**, not a claim that it's balanced. They all live in one file, `tools/bastion/data/war-units-data.js`, so any of them can be changed in one place.

## 1. Raising an army

### The War Room's units
The War Room's **Recruit** list has seven choices. Hover over one to see its stat block.

| Unit | Soldiers | Cohesion | Attack | Defence | Move | Resolve | Battle Value | Distinction |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Levy Infantry | 150 | 4 | +2 | 11 | 3 | +0 | 3 | Cheap, vulnerable to pressure. |
| Line Infantry | 100 | 5 | +4 | 13 | 3 | +1 | 5 | Reliable general-purpose troops. |
| Heavy Infantry | 50 | 6 | +4 | 15 | 2 | +2 | 7 | Durable, slow. |
| Archers | 50 | 4 | +4 ranged / +1 melee | 11 | 3 | +0 | 5 | Range 6. |
| Light Cavalry | 50 | 4 | +4 | 12 | 5 | +1 | 6 | Fast and able to Charge. |
| Shock Cavalry | 25 | 5 | +5 | 14 | 4 | +1 | 8 | Strong Charge, expensive. |
| Lieutenant | 1 | – | – | – | – | – | 2 | Leads one formation (see below). |

What the stats mean:

| Stat | Meaning |
|---|---|
| **Cohesion** | How much battlefield punishment the formation can withstand. |
| **Attack** | Added to its attack roll. |
| **Defence** | The number an attacker must meet. |
| **Move** | Its normal movement allowance, in squares. |
| **Resolve** | Added to checks against becoming shaken or routing. |
| **Battle Value** | Its approximate contribution to army strength and enemy-generation budgets. |

Regiments recruited before phase 2 ("Regiment (100)") fight as **Line Infantry**.

### Lieutenants
Each Lieutenant leads one formation: a regiment or a Bastion Defender detachment, never a beast. It's attached during deployment and stays with that formation all battle; its red disc sits beside the formation.
- The formation gains **+2 Resolve**.
- **Once per battle**, the Lieutenant makes the formation's Rally succeed automatically.
- It has no activation or attack of its own.
- Battle Value 2.

Enemy **Captains** work the same way.

### Beasts
Only the beasts you commit take the field, and each fights as its own unit with its own profile and one defining trait.

| Beast | Cohesion | Attack | Defence | Move | Resolve | Battle Value | Trait |
|---|---:|---:|---:|---:|---:|---:|---|
| Jackal | 2 | +2 | 11 | 5 | −1 | 2 | Pack |
| Hyena | 3 | +3 | 11 | 5 | +0 | 3 | Pack |
| Constrictor Snake | 4 | +3 | 12 | 3 | +1 | 4 | Grapple |
| Panther | 3 | +4 | 12 | 5 | +0 | 4 | Charge |
| Ape | 4 | +4 | 12 | 4 | +0 | 4 | Climber |
| Black Bear | 5 | +4 | 11 | 4 | +1 | 5 | Climber |
| Crocodile | 5 | +4 | 12 | 3 | +1 | 5 | Swimmer |
| Giant Vulture | 4 | +4 | 11 | 6 | +0 | 5 | Flight |
| Dire Wolf | 5 | +5 | 12 | 5 | +1 | 7 | Pack |
| Lion | 5 | +5 | 12 | 5 | +1 | 7 | Charge |
| Tiger | 5 | +5 | 12 | 5 | +1 | 7 | Charge |
| Brown Bear | 6 | +5 | 12 | 4 | +1 | 7 | Grapple |
| Owlbear | 7 | +6 | 13 | 4 | +2 | 10 | Terror |

The traits:
- **Charge:** see Charging, below.
- **Flight:** flies over terrain, water, cliffs and other units. It must still end on an empty square, and enemies it passes don't stop it.
- **Terror:** a unit it damages makes the Resolve check caused by that damage at −2. Later checks and Rally aren't affected.
- **Pack:** gets the +2 surround bonus whenever another friendly unit is also fighting its target, from any direction.
- **Grapple:** a unit it damages in melee can't March or Disengage on its next activation.
- **Climber:** woods, rubble and dense woods cost it no extra movement.
- **Swimmer:** can cross and stand in deep water.

### The Bastion Defenders
Defenders are individual people, while a Levy Infantry regiment is 150 soldiers. So defenders are counted by headcount and never become as strong as a regiment just because their counter looks the same.
- **Armed defenders fight with the Levy Infantry profile.** A detachment of 150 has full strength: Cohesion 4 and Battle Value 3. A smaller detachment has 4 × (headcount ÷ 150) Cohesion, rounded, and at least 1.
- **75 or more** (half a regiment) form a detachment of their own.
- **Fewer than 75 join your regiments as support:** +1 Cohesion for every 5 armed defenders, up to +2 (10 defenders) per regiment. Each point of support also adds ½ to the regiment's Battle Value (+1 for 10 armed defenders).
- Any defenders left over, once every regiment has its support, form one small detachment. That way an army of defenders and beasts still has someone to fight.
- **Unarmed defenders** fight the same way at −2 Attack. They give support at only +1 per 10, up to +1.
- Defenders' casualties are counted separately from the regiments they support.

## 2. Choosing a war

In the Banner & War Council panel you choose:
- the **target clan**;
- the **objective**: Raid, Skirmish, Defend Bastion or Seize Outpost;
- the **enemy force** you're going after: a small local force, an established local force or a major force;
- the forces you commit.

**The enemy's strength comes from the mission, never from your army or your level.** Recruiting another regiment can't make another enemy regiment appear.

| Enemy force | Base Battle Value |
|---|---:|
| Small local force | 18 |
| Established local force | 28 |
| Major force | 40 |

That base is multiplied by the objective (Raid ×0.85, Skirmish ×1.0, Defend ×1.1, Seize Outpost ×1.2). It's then multiplied by one saved variation roll (d6): 1–2 makes the force smaller (×0.85), 3–4 as expected (×1.0), and 5–6 larger (×1.15).

**The enemy army is drawn up and saved as soon as you pick the mission,** before you commit anything. Changing your committed troops never changes it. The panel shows an intelligence estimate next to your own army's Battle Value, for example "Estimated enemy: 23–33 Battle Value; about 3 to 5 formations; archers reported." beside "Your army: 31 Battle Value" (an established local force, Skirmish). The Battle Value range runs from a "smaller" variation roll (×0.85) to a "larger" one (×1.15), widened by a point or so on each side, because a clan's army can come out slightly over or under its budget; the real army is always inside it. The formation count is the real number of formations, give or take one. That's guidance, not a win chance.

### The clans' armies
Each clan's army is built from its own mix of troops:
- a sensible infantry core: at least half the Battle Value of its units (Captains not counted);
- limits on archers, cavalry and specialists;
- the clan's own variant units: a normal unit with one distinctive trait;
- Captains: one from a budget of 14, a second from 26 and a third from 38;
- beasts only where they fit the clan.

| Clan | Battlefield emphasis | Variant units |
|---|---|---|
| Blackstone | Wardens, forest-capable infantry and bow troops; woodland manoeuvre. | Blackstone Wardens (Line Infantry, Woodland: woods cost no extra) |
| Bacca | Durable infantry and mountain specialists; difficult-ground endurance. | Bacca Stoneguard (Heavy Infantry, Steady: +1 Resolve); Bacca Cragmen (Levy Infantry, Cragsure: rubble costs no extra) |
| Rowthorn | Waterway specialists and mobile troops; crossings and wet terrain. | Rowthorn Riverwardens (Line Infantry, Wader: bog costs no extra) |
| Karr | Hardy infantry and raiders; cold-weather resilience. | Karr Shieldbearers (Line Infantry, Hardy: ignores the weather's penalties); may field a Dire Wolf |
| Farmer | Disciplined formations and command support. | Farmer Pikes (Line Infantry, Braced: never charged at a bonus); one extra Captain |
| Molten | Well-equipped troops and specialist hired forces. | Molten Ironclads (Heavy Infantry, Armoured: +1 Defence); may hire a Brown Bear or an Owlbear |
| Slade | Scouts, skirmishers and tactical redeployment. | Slade Outriders (Light Cavalry, Fleet: +1 Move) |

These are proposed directions, for you to change. Enemy units use the same sizes as yours. Slade's colours (a white stallion on teal) are the only established ones, so the other clans are shown in a neutral enemy style. Every enemy token carries a small pennant, and every enemy unit's name starts with its clan's ("Bacca Line Infantry 2"), so the log always says whose unit it is.

## 3. Before the battle

The opening rolls are Weather (DC 12), Morale (DC 12, plus 4 in a snowstorm, 2 in a rainstorm, 3 in a heatwave) and Luck (DC 10). They now matter all battle:

| Roll | Effect in battle |
|---|---|
| **Weather** | Snowstorm: every unit moves 1 less (at least 1). Rainstorm: ranged attacks −2. Heatwave: Resolve checks −1. Both armies are affected; the Hardy trait ignores it. |
| **Morale** | High: +2 on your units' Resolve checks all battle. Low: −2. |
| **Luck** | +1 or −1 on all your attack rolls. It also decides who acts first in round 1: you if Luck passed, the enemy if not. |

**Call off** is still there until the first unit acts. Calling off keeps the mission's enemy army and opening rolls, so you can't reroll bad weather by calling off and trying again.

## 4. The battlefield

- **Squares:** the battle grid's squares are battlefield units, each one regiment's frontage across, not D&D's five-foot squares. Every formation, detachment and beast fills exactly one square.
- **Size:** the board is 22 squares across by default (choose 20 to 24 before deployment begins); its depth follows the map's shape, from 10 to 30 squares. A taller or wider picture has its edges trimmed evenly to fit, and the War Table says how much ("Edges hidden").
- **Fixed scale:** Zoom, Fit, panning, the grid lines, Snap and token size are only for display. They never change movement or range. The scale is fixed once deployment begins.
- **Deployment:** each army deploys in its own half. A no-deployment strip across the middle (2 or 3 rows) stops the armies starting in contact.
- **Distance** counts diagonal steps the same as straight ones.

### Terrain
A painted map is just a picture: the War Table can't tell a river from a road. So each map gets its own terrain, painted square by square with the **Terrain** button. The War Table warns you when a map has none yet; until then, everything counts as open ground. The painting is saved with the map, one for each battlefield width, and can be changed freely until Start Battle. During a battle, **DM: pause** lets you repaint that battle's own ground; the map's saved painting isn't changed.

| Terrain | Rule |
|---|---|
| Open ground | Normal movement. |
| Woods, bog or rubble | Movement through it costs double; no Charge. |
| Dense woods | Costs double, no Charge, and blocks ranged line of sight through it. |
| Ridge | Blocks ranged line of sight through it. |
| Cover | +2 Defence against ranged attacks. |
| Deep water | Impassable unless the unit can swim or fly. |
| Sheer cliff | Impassable unless the unit can fly. |
| Bridge or ford | A route across water: normal movement. |

## 5. Deployment

**Begin Deployment** sets both armies out:
- **Yours:** infantry in front, archers behind, cavalry and beasts on the flanks.
- **The enemy's:** placed by role, protecting its objective.

Then:
- **Your units:** drag them anywhere on your own half.
- **Lieutenants:** choose which formation each leads.
- **The enemy:** you don't normally place it, but **DM: adjust enemy** lets you move it within its own half.
- **The objective:** in a Raid, Defend Bastion or Seize Outpost battle the same button is **DM: adjust enemy & supplies**, **& depot** or **& outpost**, and lets you drag the objective too:
  - a supply marker anywhere on the enemy's half, on a square troops can stand on, with no unit or other marker on it (the squares light up while you drag);
  - your supply depot or the outpost as a whole block, kept the same size, wholly on its owner's half (your depot on yours, the outpost on the enemy's), with at least one square troops can stand on. Units may stand inside it.

  A drop that isn't allowed says why. Repainting terrain while deploying keeps what you moved exactly where you put it, even where troops on foot can't reach it (the War Table then warns you), unless the new painting puts a supply marker you moved on deep water or a cliff, or leaves the depot or outpost with no square troops can stand on; then it moves to the nearest place that works. Supplies you haven't moved are still fitted to the new painting.
- **Start Battle** locks everything in. **The battle briefing** then appears: how this battle is won and lost, today's conditions, and the rules in brief. The **Rules & objective** button at the top of the War Table shows it again at any time.

## 6. The battle

**Rounds.** The battle lasts six rounds, and the objective and the deadline stay on screen throughout. In each round every unit acts once. The two sides take turns, one unit at a time, and the side that starts swaps each round. When one side has nobody left to act, the other finishes its units.

### Orders
Select one of your units, choose an order, drag the unit (or click a square) to propose its move, pick a target, then **Confirm**. Nobody can drag units freely once the battle has started.

**Attacking:** with one of your units selected, click any enemy (or drop your unit on it) to set up Advance & Attack on it. A unit fighting hand to hand can't be dragged anywhere, but letting go of it on an enemy next to it still sets up the attack. Click the chosen target again to un-pick it, so the unit only moves. It doesn't matter whether that enemy has already acted or been attacked this round. Your unit attacks from where it stands if it can, which is always the case when the enemy is already next to it. Otherwise it moves to the best square in reach first, which the table shows before you confirm:
- a square it can shoot from, for archers;
- then one that gives a Charge;
- then the shortest, most direct move.

If the enemy can't be attacked this activation, the table says why: too far away; your unit is already fighting another enemy (Disengage first, unless it's held fast or has no clear square to fall back to, when it can only fight the enemies next to it); or, for archers that could otherwise shoot it, it is in melee with one of your units, since archers never shoot into a melee.

| Order | What happens |
|---|---|
| **Advance & Attack** | Move up to normal allowance, then make one legal melee or ranged attack. Moving is optional. |
| **March** | Move up to twice normal allowance; cannot attack. Cannot begin while engaged. |
| **Hold** | Remain stationary; gain +2 Defence until the start of the unit's next activation. |
| **Rally** | Remain stationary and make a Resolve check to remove Shaken. Cannot attack. |
| **Disengage** | Leave melee at up to half movement, rounded up; cannot attack. |
| **Interact** | Remain at an objective and perform its scenario action instead of attacking. |

When you select a unit, the squares it can reach are lit: brightly for Advance & Attack, fainter beyond for March. Drag the unit, or click a lit square, to propose the move.

### Movement
- **Enemies:** a move can't pass through an enemy unit or impassable terrain.
- **Contact:** a unit stops when it moves next to an enemy.
- **Friends:** it can pass through friendly units, but must end on an empty square.
- **Corners:** a move can't squeeze diagonally between two deep-water or cliff squares that touch at their corners, so a river painted on a slant still stops it.
- **Melee:** begins when opposing units touch, side or corner. A unit in melee can't make a ranged attack.
- **Engaged units** can't move with Advance & Attack or March; they Disengage instead.

### Ranged attacks
- **Range:** archers shoot up to 6 squares.
- **Line of sight:** they need a clear line (dense woods and ridges block it, including two that touch at their corners).
- **Restrictions:** they can't shoot while in melee, or into an existing melee.

### Charging
Charge belongs to cavalry and some beasts. It's a bonus on Advance & Attack, not an order of its own. To get it, the unit must:
- move at least 2 squares in a straight line through open ground into melee;
- not be Shaken or already engaged at the start.

It then gains +2 on that melee attack (+3 for Shock Cavalry's Strong Charge). A unit that's Holding, or a Braced unit, cancels the charge bonus.

### Attacks
One roll, no damage dice:

**d20 + Attack + modifiers against Defence**

| Result | Cohesion lost |
|---|---:|
| Below Defence | 0 |
| Meets Defence, or exceeds it by 1–4 | 1 |
| Exceeds Defence by 5–9 | 2 |
| Exceeds Defence by 10 or more | 3 |

- **Natural rolls:** a natural 1 always misses. A natural 20 inflicts 3.
- **Modifier cap:** the situational modifiers together stay within −4 to +4: Luck, Shaken −2, Charge, surrounding and weather. The unit's printed Attack isn't counted in that limit.
- **Surrounding:** +2 melee Attack when another friendly fighting unit also engages the target from a direction at least 90° away. It doesn't stack with more attackers.
- **Example:** Line Infantry (Attack +4) with good Luck (+1) rolls 13 against Defence 13. That's 13 + 4 + 1 = 18, a margin of 5, so 2 Cohesion lost.
- **Your rolls:** leave the d20 box blank and the War Table rolls for you, or type the roll you made at the table. The calculation is shown briefly, applied, and the battle moves on.

### Morale: Steady → Shaken → Routed
- **The check:** d20 + Resolve + the opening Morale modifier + an attached Lieutenant's +2, against DC 10.
- **Falling to half:** when a unit first falls to half its starting Cohesion or below, it checks. A failure makes it **Shaken**: −2 Attack and no Charge, though it can still move, hold, fight or try to rally.
- **Damaged again while Shaken:** it checks again. A failure means it **Routs** and leaves the battlefield. Routing isn't death.
- **Rally:** uses the same check. Success removes Shaken but restores no Cohesion. A rallied unit doesn't keep re-testing just for being below half; only fresh damage makes it check.
- **Zero Cohesion:** the unit is **Defeated** at once, with no check.

### How the enemy plays
The War Table plays the enemy, one unit each time you press **Enemy acts**. It plays to its objective first:
- **Raid:** guards stand beside the supply markers (never on them), and the rest go after your carriers. Once your carriers could win the raid, every enemy unit chases them.
- **Defend Bastion:** it marches on your supply depot.
- **Seize Outpost:** it keeps two units in the outpost and goes after your archers if they shoot into it.
- **Everywhere:** it closes in by stages rather than standing off, walks round rivers and cliffs to a ford or gap, and fights what it touches. Its archers look for a clear shot and never walk into melee.

It only knows what you could see on the board; it never peeks at your dice.

## 7. Winning

| Objective | How you win |
|---|---|
| **Skirmish** | Break the opposing army. At the end of round 6, the side that has lost the smaller share of its starting Battle Value wins; equal shares are a draw. |
| **Raid** | Collect and carry off two of the three supply markers through your own starting edge (the bottom row) by the end of round 6, or break the enemy army. Collecting one takes Interact; a unit carries one at a time, and drops it if it routs or falls. |
| **Defend Bastion** | Don't let the enemy hold your supply depot at two round ends in a row, and keep your army unbroken through round 6, or break the enemy army first. |
| **Seize Outpost** | Hold the outpost with a Steady unit, and no enemy unit in it, at two round ends in a row before the end of round 6, or break the enemy army. |

**Holding a zone:** a side controls a zone when it has a Steady fighting unit inside and the other side has no fighting unit inside. Lieutenants and support groups can't hold a zone alone.

**Breaking:** an army breaks when 60% of its starting Battle Value has Routed or been Defeated, counted from the starting roster, not from the tokens left.
- **Breaking the enemy wins at once, whatever the objective** (Harry's ruling, 4 October 2026). What's left of the enemy flees the field. In a Raid that leaves the supplies to you, and the raid pays its full gold. In Seize Outpost it leaves the outpost to you.
- If your own army breaks first, you lose at once, whatever the objective.

**Withdraw** replaces Call off once the battle has begun. It shows the likely consequences first. The battle then ends as a withdrawal and the real losses are counted.

## 8. After the battle

**The result decides everything.** There's no final d20 that can overturn it.

### Losses
Permanent losses, as a share of the soldiers present at the start (rounded to the nearest):

| Unit's final state | Losses |
|---|---:|
| Above half Cohesion | 0% |
| Half Cohesion or below, still fighting | 10% |
| Routed | 25% |
| Defeated, and your army holds the field (victory or draw) | 40% |
| Defeated, and your army loses or withdraws | 60% |

A regiment that loses soldiers stays in the Military panel as **Depleted**, fighting at reduced strength until replacements arrive. Recruiting the same unit type in the War Room brings a Depleted regiment back to full strength first. A regiment is removed only when no soldiers are left.

### Lieutenants and beasts
They aren't counted in percentages. When a beast, or a Lieutenant's formation, is Defeated, roll a d6:

| d6 | Result |
|---|---|
| 1 | Killed. |
| 2 | Captured if the enemy holds the field; otherwise badly wounded (unavailable for three Bastion turns). |
| 3–4 | Wounded: unavailable for two Bastion turns. |
| 5–6 | Recovered: unavailable for one Bastion turn. |

A **Routed** one is just separated for a turn. Units that are recovering show in the Military and Menagerie lists and can't be committed until they return.

### Rewards
The rewards follow the objective, the losses follow the battle, and the Bastion's existing amounts stay the baseline:

| Objective | Victory | Defeat |
|---|---|---|
| Raid | +75 gp, −10 Political Capital | −50 gp, +8 Political Capital |
| Skirmish | +40 gp, −6 | −30 gp, +6 |
| Defend Bastion | +0 gp, +6 | −25 gp, −8 |
| Seize Outpost | +60 gp, −12 | −60 gp, +10 |

- **Who's affected:** Political Capital changes with the target clan. A Clan's Honour goes +6 on a victory and −8 on a defeat. A Brigade's Trusted Clients change as before.
- **A raid's gold:** a won raid pays in full, whether the supplies came home or the enemy broke and fled. Otherwise the gold follows the supplies actually carried off: half for one; with none, it's the defeat's −50.
- **A draw** changes nothing.
- **A withdrawal** counts as a defeat for gold and Political Capital, but costs only −4 Clan Honour. In a Raid, the gold still follows the supplies already carried off: with one home, a withdrawal pays +38 gp (half the victory's gold), and the −50 gp applies only if none were. (Two home wins the raid at once, so there's nothing to withdraw from.)
- **A raid won with heavy losses** is still a won raid with heavy losses.

The **War Report** records:
- the objective and the opening rolls;
- both armies at the start and the end;
- the important moments and why the battle ended;
- every loss, every recovery time and every change to gold, Political Capital and Honour.

All of this is applied exactly once. A battle can be closed and reopened at any point and carries on where it was.
