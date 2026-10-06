/* Scarlett Isles Explorer — setting up a fight in the Combat Tracker
   (7 October 2026, Harry's answers: a battle map for each region, the party
   level from the Bastion, SRD stats closest to each event's enemies, and the
   Combat Tracker reports back when every enemy is down).

   A fight step in journey-events.js names its encounter here
   (fight: { encounter: 't2', ... }). The Explorer's "Set up this fight"
   button builds it (fights.js) and hands it to the Combat Tracker, which
   loads the monsters, the battle map, the grid and the starting places.

   - bands: which group of enemies, by the party's level. Harry's events give
     a group for levels 7–10 and a bigger one for 11–16; a party below 7 gets
     the first and above 16 the second.
   - monsters: the numbers from each creature's stat block in the System
     Reference Document 5.1 (SRD), © Wizards of the Coast, CC BY 4.0 (see
     licences/README.md): Armour Class, hit points, and the initiative
     bonus (its Dexterity modifier). link: the stat block on D&D Beyond
     (needs internet).
   - maps: Harry's battle maps (7 October 2026), in
     tools/encounter/assets/battlemaps/. Each kind of place (setting) comes
     in four looks, named <setting>-<look>.png:
       green: lush summer;
       warm: dry and amber (ford, camp) or autumn (cove, road);
       cold: rocky heather (ford, camp) or snow (cove, road);
       misty: dark, with fog.
     looks says which look each region uses. To change a region's look,
     change its word there; to use another picture, save it over one with
     the same name. Every map is a grid of cols x rows squares (5 ft each;
     24 x 18 suits these pictures, where a tent is 2 squares). party and
     foes are where the tokens start: the grid corners (column, row) they
     spread out from, the enemies shared round the foes corners in turn.
     avoid lists areas no token starts in, as [first column, first row, last
     column, last row] of grid corners (the river, the sea, the fire, tents,
     crates, the fallen tree).
   - encounters: for each fight, its map setting and its two groups. coast,
     if given, is the setting used instead when the party is within 2 hexes
     of the sea (data/terrain-data.js; Harry, 7 October 2026: road fights
     near the sea are fought in a cove). Each
     group entry is [monster, how many] or [monster, how many, name], where
     name is what the event calls that creature (it keeps the stat block of
     the monster). foes, if given, replaces the map's foes corners for this
     fight. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.fights = {
  bands: [
    { id: 'low', label: 'Levels 7–10', upTo: 10 },
    { id: 'high', label: 'Levels 11–16', upTo: 99 }
  ],

  /* The level used when the Bastion has never been saved (the Bastion's own starting level). */
  defaultLevel: 7,

  monsters: {
    bandit: { name: 'Bandit', ac: 12, hp: 11, init: 1, link: 'https://www.dndbeyond.com/monsters?filter-search=Bandit' },
    bandit_captain: { name: 'Bandit Captain', ac: 15, hp: 65, init: 3, link: 'https://www.dndbeyond.com/monsters?filter-search=Bandit%20Captain' },
    berserker: { name: 'Berserker', ac: 13, hp: 67, init: 1, link: 'https://www.dndbeyond.com/monsters?filter-search=Berserker' },
    dire_wolf: { name: 'Dire Wolf', ac: 14, hp: 37, init: 2, link: 'https://www.dndbeyond.com/monsters?filter-search=Dire%20Wolf' },
    gladiator: { name: 'Gladiator', ac: 16, hp: 112, init: 2, link: 'https://www.dndbeyond.com/monsters?filter-search=Gladiator' },
    hill_giant: { name: 'Hill Giant', ac: 13, hp: 105, init: -1, link: 'https://www.dndbeyond.com/monsters?filter-search=Hill%20Giant' },
    ogre: { name: 'Ogre', ac: 11, hp: 59, init: -1, link: 'https://www.dndbeyond.com/monsters?filter-search=Ogre' },
    spy: { name: 'Spy', ac: 12, hp: 27, init: 2, link: 'https://www.dndbeyond.com/monsters?filter-search=Spy' },
    thug: { name: 'Thug', ac: 11, hp: 32, init: 0, link: 'https://www.dndbeyond.com/monsters?filter-search=Thug' },
    veteran: { name: 'Veteran', ac: 17, hp: 58, init: 1, link: 'https://www.dndbeyond.com/monsters?filter-search=Veteran' },
    winter_wolf: { name: 'Winter Wolf', ac: 13, hp: 75, init: 1, link: 'https://www.dndbeyond.com/monsters?filter-search=Winter%20Wolf' },
    wolf: { name: 'Wolf', ac: 13, hp: 11, init: 2, link: 'https://www.dndbeyond.com/monsters?filter-search=Wolf' },
    /* Not in the SRD: the Heartwood Ritual's Husk (35 hit points there; the Ritual gives no Armour Class or initiative). Only T9 uses it, and T9 is switched off. */
    rootbound_husk: { name: 'Rootbound Husk', ac: null, hp: 35, init: 0, link: '' }
  },

  maps: {
    folder: 'tools/encounter/assets/battlemaps/',
    /* Which look each region uses (Harry's maps, matched to the Explorer's
       province maps): Telluria's green lands; Aurush's warm south and west;
       the North Isle's snow and bare rock; the East Isle's mist (Greymyr). */
    looks: {
      northern_province: 'green',
      midland_province: 'green',
      eastern_province: 'green',
      southern_province: 'warm',
      western_province: 'warm',
      the_north_isle: 'cold',
      the_east_isle: 'misty'
    },
    settings: {
      /* A river across the middle, with a shallow ford of stepping stones where the road crosses; scrub and woods on both banks. */
      ford: { title: 'The ford', cols: 24, rows: 18, party: [[12, 15]], foes: [[13, 3], [5, 3], [19, 3], [4, 13], [20, 13]], avoid: [[0, 7, 24, 10]] },
      /* A road from west to east, a fallen tree across it ahead, scrub and boulders either side. */
      road: { title: 'The road', cols: 24, rows: 18, party: [[5, 10]], foes: [[19, 8], [11, 4], [10, 14]], avoid: [[16, 7, 16, 8]] },
      /* The party's camp in a clearing: the fire, two tents, logs and bedrolls, a path in from the south. */
      camp: { title: 'The camp', cols: 24, rows: 18, party: [[12, 11]], foes: [[12, 2], [3, 6], [21, 6]], avoid: [[12, 8, 13, 9], [9, 6, 10, 7], [15, 6, 16, 7], [11, 8, 11, 8], [14, 8, 14, 8]] },
      /* A shingle beach under a grassy bank, a path down at the west end, crates and a boat drawn up, the sea below. */
      cove: { title: 'The cove', cols: 24, rows: 18, party: [[5, 7]], foes: [[13, 7], [17, 10], [10, 9], [20, 8]], avoid: [[0, 11, 24, 17], [13, 8, 16, 8], [13, 9, 13, 9], [11, 9, 11, 9]] }
    }
  },

  encounters: {
    /* T2 The Ambush Sign: "Levels 7–10: a bandit captain, 2 veterans and 8 bandits. Levels 11–16: add 2 more veterans and a gladiator." */
    t2: {
      map: 'ford',
      low: [['bandit_captain', 1], ['veteran', 2], ['bandit', 8]],
      high: [['bandit_captain', 1], ['gladiator', 1], ['veteran', 4], ['bandit', 8]]
    },
    /* T13 Lights Below Redport: "Levels 7–10: a bandit captain, 4 thugs and 6 bandits. Levels 11–16: add 2 veterans." The smugglers by their crates in the cove. */
    t13: {
      map: 'cove',
      low: [['bandit_captain', 1], ['thug', 4], ['bandit', 6]],
      high: [['bandit_captain', 1], ['veteran', 2], ['thug', 4], ['bandit', 6]]
    },
    /* C6 Wolf-Song: "Levels 7–10: 12 wolves and the old one as a dire wolf. Levels 11–16: add 2 winter wolves." The pack circles the camp. */
    c6: {
      map: 'camp',
      foes: [[12, 1], [4, 3], [20, 3], [3, 13], [21, 13], [8, 16], [16, 16]],
      low: [['dire_wolf', 1, 'Old Wolf'], ['wolf', 12]],
      high: [['dire_wolf', 1, 'Old Wolf'], ['winter_wolf', 2], ['wolf', 12]]
    },
    /* C9 The Debt Collector: "Levels 7–10: the collector (a spy) and his two friends (ogres). Levels 11–16: make the friends 2 hill giants." They're already in the camp. */
    c9: {
      map: 'camp',
      foes: [[12, 5]],
      low: [['spy', 1, 'Debt Collector'], ['ogre', 2]],
      high: [['spy', 1, 'Debt Collector'], ['hill_giant', 2]]
    },
    /* C10 The Beacons, riding through the night: "Levels 7–10: a raider chief (a gladiator), 4 berserkers and 8 bandits. Levels 11–16: add 2 veterans." Met at dawn on the road. */
    c10ride: {
      map: 'road',
      coast: 'cove',
      low: [['gladiator', 1, 'Raider Chief'], ['berserker', 4], ['bandit', 8]],
      high: [['gladiator', 1, 'Raider Chief'], ['veteran', 2], ['berserker', 4], ['bandit', 8]]
    },
    /* C10 The Beacons, keeping watch: the same raiders stumble on the camp, from the west (the coast). */
    c10camp: {
      map: 'camp',
      foes: [[3, 8], [4, 13], [4, 3]],
      low: [['gladiator', 1, 'Raider Chief'], ['berserker', 4], ['bandit', 8]],
      high: [['gladiator', 1, 'Raider Chief'], ['veteran', 2], ['berserker', 4], ['bandit', 8]]
    },
    /* C12 False Lights at Bleakharbour: "Levels 7–10: a bandit captain and 8 bandits. Levels 11–16: add 4 thugs." On the shore below the camp. */
    c12: {
      map: 'cove',
      low: [['bandit_captain', 1], ['bandit', 8]],
      high: [['bandit_captain', 1], ['thug', 4], ['bandit', 8]]
    },
    /* F1 The Toll-Men Return: "Levels 7–10: the 2 toll-men (thugs) and 6 bandits. Levels 11–16: add 2 veterans." */
    f1: {
      map: 'road',
      coast: 'cove',
      low: [['thug', 2, 'Toll-man'], ['bandit', 6]],
      high: [['thug', 2, 'Toll-man'], ['veteran', 2], ['bandit', 6]]
    },
    /* T9 The Husk in the Furrows (switched off): "One Rootbound Husk (35 HP, as in the Heartwood Ritual)." */
    t9: {
      map: 'road',
      low: [['rootbound_husk', 1]],
      high: [['rootbound_husk', 1]]
    }
  }
};
