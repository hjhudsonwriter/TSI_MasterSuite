/* The Ironbow Bastion Manager: the creatures (pull request 7 of the
   facilities overhaul; Harry's answers, 14 October 2026; reworked in the Strip
   Back Overhaul, 22 October 2026).

   One building, the BEAST PEN, houses every real, named animal the Ironbow
   keeps: one beast of each kind (wyvern, griffin, dire wolf, buckbear and
   fellcat). It replaced the Wyvern Roost, the Griffin Tower and the Dire Wolf
   Den. Building the Pen never creates an animal:
   - The DM grants a beast in the Explorer (Grant a creature, beside Port
     Charter). The Bastion then holds it, waiting for a home, until the Pen's
     House Beast Here order gives it one. Elara's wyvern is no longer made by
     the Bastion: an old save that already has her keeps her (the unique entry
     below only gives her her name), and a new Bastion has no beast until the
     DM grants one.
   - A housed beast must pass Acclimatise With Beast before it can bond: its
     handler rolls Animal Handling at the table and the DM types the total
     against the DC below. A pass is Bond 1; a fail locks that beast for the
     days below.
   - From Bond 1 the beast can be taken out on the road with its handler. Each
     day it spends away from the Ironbow counts as a Bonding Day, and the
     totals below raise the next bond level: the DM confirms each one after a
     scene at the table.
   Every creature housed at the Ironbow fights when the Ironbow is attacked
   (Defend Bastion battles only), as it always has; that is kept until the War
   Table is removed.

   Training, harnesses, first flight and riding were removed with the three old
   buildings: a beast's record of them stays in its saved development, hidden.

   Every number here is provisional: edit it here, and nothing else needs to
   change, except the two marked below (houseDays and nameMax), which must
   match a number kept elsewhere. The rules are in tools/bastion/creature-rules.js
   (housing, acclimatising, bonding) and tools/bastion/war-campaign-rules.js (the
   War Table). */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.bastionCreatures = {
  /* Harry's values are provisional until he has tried them at the table. */
  provisional: true,

  /* ---------- The kinds of creature ----------
     name / plural: as the panels show them ("the griffin", "2 griffins" in
     a sentence);
     short: the War Table token for one with no name, numbered (Gr1, Gr2);
     a named creature's token comes from its name's initials;
     home: the facility that houses this kind (its id in facilities-data.js): the Beast Pen for every kind;
     acclimatiseDC (optional): this kind's own DC for Acclimatise With Beast, instead of acclimatise.dc below;
     war: how it fights on the War Table, in the same shape as a beast in
     war-units-data.js (Cohesion, Attack, Defence, Move, Resolve, Battle
     Value, its one trait and a line about it);
     defendOnly: it fights only when the Ironbow is attacked (Defend Bastion),
     never on a War Action;
     worstResult / woundedDays: after a defeat it is never killed or
     captured; a d6 that would kill or capture it leaves it badly wounded for
     this many days instead. */
  species: {
    /* Harry (Q3): the Owlbear's Cohesion, Attack, Defence and Resolve, the
       Giant Vulture's Flight and Move 6, and Battle Value 11 (the Owlbear's
       10, plus 1 for flying at Move 6). */
    wyvern: {
      name: 'Wyvern',
      short: 'Wy',
      plural: 'Wyverns',
      home: 'beast_pen',
      war: { cohesion: 7, attack: 6, defence: 13, move: 6, resolve: 2, bv: 11, trait: 'flight', distinction: 'A winged hunter that strikes from above wherever the line is weakest.' },
      defendOnly: true,
      worstResult: 'badly_wounded',
      woundedDays: 21
    },
    /* Harry (Q5): Cohesion 5, Attack +5, Defence 12, Move 6, Resolve +1,
       Flight, Battle Value 8. */
    griffin: {
      name: 'Griffin',
      short: 'Gr',
      plural: 'Griffins',
      home: 'beast_pen',
      war: { cohesion: 5, attack: 5, defence: 12, move: 6, resolve: 1, bv: 8, trait: 'flight', distinction: 'A proud flier that dives on the enemy\'s flanks.' },
      defendOnly: true,
      worstResult: 'badly_wounded',
      woundedDays: 21
    },
    /* Harry (Q5): the War Table's Dire Wolf (war-units-data.js), copied here
       so the War Table's own file stays as it is. */
    dire_wolf: {
      name: 'Dire Wolf',
      short: 'Wo',
      plural: 'Dire Wolves',
      home: 'beast_pen',
      war: { cohesion: 5, attack: 5, defence: 12, move: 5, resolve: 1, bv: 7, trait: 'pack', distinction: 'A hunter that brings down the isolated.' },
      defendOnly: true,
      worstResult: 'badly_wounded',
      woundedDays: 21
    },
    /* Buckbear and Fellcat (Harry, 22 October 2026): new kinds the DM can grant. They have no War Table
       profile yet, so they do not fight (the War Table is going). Their varieties, pictures and
       personality tables are in tools/beasthandler/data/. */
    buckbear: {
      name: 'Buckbear',
      plural: 'Buckbears',
      home: 'beast_pen'
    },
    fellcat: {
      name: 'Fellcat',
      plural: 'Fellcats',
      home: 'beast_pen'
    }
  },

  /* What the DM can grant in the Explorer, in the order its Grant a creature box lists them (Harry,
     22 October 2026: five kinds). Nothing ever makes a beast by itself. */
  grantable: ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat'],

  /* Creatures that already exist in the story, each recorded once. */
  unique: {
    elara_wyvern: {
      species: 'wyvern',
      /* The Explorer's hero 'elara' (tools/explorer/data/explorer-data.js). */
      owner: 'elara',
      ownerName: 'Elara',
      /* Harry will give the wyvern's name later: type it here (spelt exactly
         as he writes it), and every panel shows it. Until then it's
         "Elara's wyvern". */
      name: '',
      defaultName: 'Elara\'s wyvern'
    }
  },

  /* The Beast Pen (Harry, 22 October 2026): it keeps ONE beast of each kind, "until further notice". perKind is
     that number; it only blocks housing a NEW beast of a kind that is full (one already housed, or being
     housed). A save that already holds more of a kind keeps them all: nothing is ever sent away. */
  pen: { perKind: 1 },

  /* Acclimatise With Beast (Harry, 22 October 2026): the beast's handler rolls the skill at the table and the DM
     types their total. A total of dc or more passes (Bond 1); less locks that beast, and only that beast, for
     retryDays in-game days (a fail on Day 10 blocks Days 11 and 12; Day 13 is allowed). Any kind can have its own DC
     (species.<kind>.acclimatiseDC). */
  acclimatise: { dc: 20, skill: 'Animal Handling', retryDays: 3 },

  /* Bonding Days (Harry, 22 October 2026). A beast away from the Ironbow with its handler earns one Bonding Day for
     each day that passes. These are TOTALS: the level reached and the Bonding Days it needs altogether (Bond 2 at 10
     days, Bond 3 at 20, 4 at 30, 5 at 50). Days are never lost while a milestone waits for the DM's scene, and a
     level is never skipped: after one is confirmed, the next is prompted if its total is already met. A beast
     that is already at a level (an older save) counts as having that level's days. */
  bondTotals: { 2: 10, 3: 20, 4: 30, 5: 50 },

  /* The House orders' days, only for the Explorer's Grant a creature
     pop-up to say. The orders themselves take their "days" from
     facilities-data.js (the Beast Pen's house_beast): change that, and keep
     this the same. */
  houseDays: 3,

  /* A name typed for a granted creature: at most this many letters. Keep
     this the same as NAME_MAX in shared/js/bridge-rules.js, which the
     Explorer's Grant box and the link use. */
  nameMax: 40
};
