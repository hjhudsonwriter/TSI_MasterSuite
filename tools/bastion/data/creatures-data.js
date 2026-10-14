/* The Ironbow Bastion Manager — the creatures (pull request 7 of the
   facilities overhaul; Harry's answers, 14 October 2026).

   Three buildings house real, named animals: the Wyvern Roost, the Griffin
   Tower and the Dire Wolf Den. Building one never creates an animal.
   - Elara's wyvern already exists in the story. The Roost's Level 1 order,
     House Elara's Wyvern, records her wyvern at the Ironbow, once ever. It
     is never a new animal.
   - A griffin or a dire wolf comes only when the DM grants one in the
     Explorer (Grant a creature…, beside Port Charter…). The Bastion then
     holds it, waiting for a home, until the Griffin Tower's or the Dire Wolf
     Den's Level 1 order houses it.
   Every creature housed at the Ironbow fights when the Ironbow is attacked
   (Defend Bastion battles only). It is never sent on a War Action, and it is
   never killed or captured: at worst it is badly wounded for 21 days.

   The Menagerie is separate and unchanged: its beasts are counted by kind,
   need party level 13 and fight as before. Nothing moves between the two.

   Care, training, bonding, riding, mounted flight, a companion on the
   Explorer and breeding all wait until Harry has set their rules. There is
   no upkeep. The courier never carries a creature, and none appears in the
   Party bags.

   Every number here is provisional: edit it here, and nothing else needs to
   change. The rules are in tools/bastion/creature-rules.js (housing) and
   tools/bastion/war-campaign-rules.js (the War Table). */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.bastionCreatures = {
  /* Harry's values are provisional until he has tried them at the table. */
  provisional: true,

  /* ---------- The kinds of creature ----------
     name / plural: as the panels show them ("the griffin", "2 griffins" in
     a sentence);
     home: the facility that houses this kind (its id in facilities-data.js);
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
      plural: 'Wyverns',
      home: 'wyvern_roost',
      war: { cohesion: 7, attack: 6, defence: 13, move: 6, resolve: 2, bv: 11, trait: 'flight', distinction: 'A winged hunter that strikes from above wherever the line is weakest.' },
      defendOnly: true,
      worstResult: 'badly_wounded',
      woundedDays: 21
    },
    /* Harry (Q5): Cohesion 5, Attack +5, Defence 12, Move 6, Resolve +1,
       Flight, Battle Value 8. */
    griffin: {
      name: 'Griffin',
      plural: 'Griffins',
      home: 'griffin_tower',
      war: { cohesion: 5, attack: 5, defence: 12, move: 6, resolve: 1, bv: 8, trait: 'flight', distinction: 'A proud flier that dives on the enemy\'s flanks.' },
      defendOnly: true,
      worstResult: 'badly_wounded',
      woundedDays: 21
    },
    /* Harry (Q5): the War Table's Dire Wolf (war-units-data.js), copied here
       so the War Table's own file stays as it is. */
    dire_wolf: {
      name: 'Dire Wolf',
      plural: 'Dire Wolves',
      home: 'dire_wolf_den',
      war: { cohesion: 5, attack: 5, defence: 12, move: 5, resolve: 1, bv: 7, trait: 'pack', distinction: 'A hunter that brings down the isolated.' },
      defendOnly: true,
      worstResult: 'badly_wounded',
      woundedDays: 21
    }
  },

  /* What the DM can grant in the Explorer. The wyvern is never granted:
     Elara's is the only one, and the Roost houses it. */
  grantable: ['griffin', 'dire_wolf'],

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

  /* Room at the Griffin Tower and the Dire Wolf Den: how many creatures each
     level of the building houses (Harry, Q6: one per level, so a Level 1
     building houses 1 and a Level 5 one houses 5). The Roost houses only
     Elara's wyvern. */
  room: { griffin_tower: 1, dire_wolf_den: 1 },

  /* The House orders' days (keep these the same as the orders in
     facilities-data.js: house_elara_wyvern, house_griffin, house_dire_wolf). */
  houseDays: 3,

  /* A name typed for a granted creature: at most this many letters. */
  nameMax: 40,

  /* The panels' "Coming later" line. */
  comingLater: 'Care, training, bonding, riding and breeding come later, once their rules are set.'
};
