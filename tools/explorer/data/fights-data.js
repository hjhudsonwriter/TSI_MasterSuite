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
   - maps: the battle-map pictures, in tools/encounter/assets/battlemaps/.
     A regional setting has one picture per region, named
     <setting>-<region>.jpg; the others have one picture (file). Every map
     is a grid of cols × rows squares (5 ft each). party and foes are where
     the tokens start: the grid corners (column, row) they spread out from,
     the enemies shared round the foes corners in turn. avoid: corners no
     token starts on (the campfire).
     The pictures are simple stand-ins drawn by code
     (docs/dev/make-battlemaps.py). To use your own picture instead, save it
     over the stand-in with the same name, and set cols and rows to its grid.
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
    /* Each region's part of a regional picture's name. */
    regions: {
      northern_province: 'northern',
      midland_province: 'midland',
      eastern_province: 'eastern',
      southern_province: 'southern',
      western_province: 'western',
      the_north_isle: 'north-isle',
      the_east_isle: 'east-isle'
    },
    settings: {
      /* A river across the middle, with a shallow ford where the road crosses; woods on the flanks. */
      ford: { title: 'The ford', regional: true, cols: 30, rows: 20, party: [[15, 17]], foes: [[15, 5], [8, 5], [22, 5], [5, 15], [25, 15]] },
      /* A road from west to east, a wooded rise to the north and a fallen tree ahead. */
      road: { title: 'The road', regional: true, cols: 30, rows: 20, party: [[6, 13]], foes: [[21, 8], [13, 4], [12, 16]] },
      /* A clearing with the party's camp: the fire, two tents and bedrolls, trees all round. */
      camp: { title: 'The camp', regional: true, cols: 30, rows: 20, party: [[15, 13]], foes: [[15, 3], [4, 7], [26, 7]], avoid: [[15, 10], [16, 10], [15, 11], [16, 11]] },
      /* T13: the cove below Redport. The cliff path comes down at the west end; the smugglers' crates and boat are on the shingle. */
      cove: { title: 'The cove', file: 'cove-western.jpg', cols: 30, rows: 20, party: [[7, 8]], foes: [[17, 9], [20, 11], [14, 11], [23, 12]] },
      /* C12: the rocks below Bleakharbour, the sea to the south-east and the wreckers' lanterns on the rocks. */
      rocks: { title: 'The rocks below Bleakharbour', file: 'rocks-north-isle.jpg', cols: 30, rows: 20, party: [[9, 6]], foes: [[17, 8], [13, 11], [20, 6]] }
    }
  },

  encounters: {
    /* T2 The Ambush Sign: "Levels 7–10: a bandit captain, 2 veterans and 8 bandits. Levels 11–16: add 2 more veterans and a gladiator." */
    t2: {
      map: 'ford',
      low: [['bandit_captain', 1], ['veteran', 2], ['bandit', 8]],
      high: [['bandit_captain', 1], ['gladiator', 1], ['veteran', 4], ['bandit', 8]]
    },
    /* T13 Lights Below Redport: "Levels 7–10: a bandit captain, 4 thugs and 6 bandits. Levels 11–16: add 2 veterans." */
    t13: {
      map: 'cove',
      low: [['bandit_captain', 1], ['thug', 4], ['bandit', 6]],
      high: [['bandit_captain', 1], ['veteran', 2], ['thug', 4], ['bandit', 6]]
    },
    /* C6 Wolf-Song: "Levels 7–10: 12 wolves and the old one as a dire wolf. Levels 11–16: add 2 winter wolves." The pack circles the camp. */
    c6: {
      map: 'camp',
      foes: [[15, 3], [5, 5], [25, 5], [4, 15], [26, 15], [10, 18], [20, 18]],
      low: [['dire_wolf', 1, 'Old Wolf'], ['wolf', 12]],
      high: [['dire_wolf', 1, 'Old Wolf'], ['winter_wolf', 2], ['wolf', 12]]
    },
    /* C9 The Debt Collector: "Levels 7–10: the collector (a spy) and his two friends (ogres). Levels 11–16: make the friends 2 hill giants." They're already in the camp. */
    c9: {
      map: 'camp',
      foes: [[15, 7]],
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
      foes: [[4, 8], [5, 14], [6, 3]],
      low: [['gladiator', 1, 'Raider Chief'], ['berserker', 4], ['bandit', 8]],
      high: [['gladiator', 1, 'Raider Chief'], ['veteran', 2], ['berserker', 4], ['bandit', 8]]
    },
    /* C12 False Lights at Bleakharbour: "Levels 7–10: a bandit captain and 8 bandits. Levels 11–16: add 4 thugs." */
    c12: {
      map: 'rocks',
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
