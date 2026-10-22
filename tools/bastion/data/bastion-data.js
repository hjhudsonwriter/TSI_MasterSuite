/* The Ironbow Bastion Manager: the fixed numbers, names and wording that
   were written into the old tool's app.js (line numbers point there). The
   facilities, tool tables, events and compendium are in their own files. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.bastion = {
  /* The five facilities every Bastion starts with (226). */
  startingBuilt: ['barracks', 'armoury', 'watchtower', 'workshop', 'dock'],

  /* Each facility's picture in assets/facilities/ (284-311). Since the
     facilities overhaul (13 October 2026) the merged facilities use the
     painting of the building whose map overlay they show; the Arcane Study's,
     Smithy's, Garden's and Gaming Hall's paintings are in assets/extras/. */
  facilityImages: {
    barracks: 'barracks.png',
    armoury: 'armoury.png',
    watchtower: 'watchtower.png',
    workshop: 'workshop.png',
    dock: 'docks.png',
    arcane_laboratory: 'laboratory.png',
    library_scriptorium: 'library.png',
    herbal_gardens: 'greenhouse.png',
    menagerie: 'menagerie.png',
    /* The Beast Pen's card shows the Menagerie's painting (Harry, 22 October 2026); the Pen's own picture,
       beast_pen.jpg, spans the top of its panel (panelImages below). The file stays where it is. */
    beast_pen: 'menagerie.png',
    war_room: 'war_room.png',
    shrine_telluria: 'shrine_of_telluria.png',
    shrine_aurush: 'shrine_of_aurush.png',
    shrine_pelagos: 'shrine_of_pelagos.png',
    hall_of_emissaries: 'hall_of_emissaries.png',
    /* Harry's own picture (13 October 2026; bastion-new-art/3-courier-exchange). */
    courier_exchange: 'courier_exchange.png'
  },
  /* A picture that spans the full width at the top of a facility's panel, above its details and orders (Harry,
     22 October 2026: the Beast Pen's), in assets/facilities/. */
  panelImages: {
    beast_pen: 'beast_pen.jpg'
  },
  /* The new facilities have no tile painting yet: their tile shows their
     building from Harry's map overlay, cut to this box of the 3000 x 1250
     painting (from bastion-new-art/2-second-upload/placements.json, with a
     little room round it). The Courier Exchange has its own picture
     (facilityImages, above). */
  facilityTileCrops: {
    /* The Beast Pen (S14) uses the Wyvern Roost's building until Harry paints its own: the Menagerie never
       had a map overlay to reuse (its card painting is in facilityImages). */
    beast_pen: { pic: 'map/overlays/wyvern_roost.png', x: 1934, y: 296, w: 295, h: 194 },
    weavers_hall: { pic: 'map/overlays/weavers_sailmakers_hall.png', x: 2668, y: 670, w: 331, h: 170 },
    stone_masonworks: { pic: 'map/overlays/stone_quarry_masonworks.png', x: 2004, y: 809, w: 380, h: 206 },
    fishery_smokehouse: { pic: 'map/overlays/fishery_smokehouse.png', x: 11, y: 714, w: 349, h: 252 },
    timber_sawmill: { pic: 'map/overlays/timber_yard_sawmill.png', x: 1648, y: 827, w: 380, h: 188 }
  },
  /* Development Plots (the facilities overhaul's pull request 3; Harry's
     facility guide, 13 October 2026): a second kind of construction slot,
     only for the six economic facilities marked "plot" in
     facilities-data.js (Herbal Gardens, Fishery & Smokehouse, Timber Yard &
     Sawmill, Stone Quarry & Masonworks, Weavers' Hall, Courier Exchange).
     The other optional facilities keep the construction slots (0 / 2 / 4 /
     5 / 6 by party level). Plots open by party level: "from" the level,
     "plots" in all. The five starting facilities use neither. */
  developmentPlots: [
    { from: 1, plots: 0 },
    { from: 9, plots: 2 },
    { from: 13, plots: 4 },
    { from: 17, plots: 6 }
  ],
  /* Where each facility's name and level label sits on the Bastion map,
     while the facility grid is open (Harry, 13 October 2026), in pixels on
     the 3000 x 1250 painting: the label's bottom centre. The sixteen
     overlays' points are the top centres of their painted areas
     (the placements.json files in bastion-new-art; the Courier Exchange's
     measured from its overlay). The five starting facilities are
     painted into the base: which building is which is our reading of the
     painting (the round tower is the Watchtower, the timber-framed hall
     beside it the Barracks, the open-sided shed the Workshop, the forge the
     Armoury, the jetty the Dock); move any of them here. */
  mapLabels: {
    watchtower: { x: 1760, y: 112 },
    barracks: { x: 1530, y: 250 },
    workshop: { x: 1030, y: 350 },
    armoury: { x: 2240, y: 470 },
    dock: { x: 1260, y: 760 },
    library_scriptorium: { x: 216, y: 261 },
    arcane_laboratory: { x: 633, y: 264 },
    herbal_gardens: { x: 228, y: 511 },
    war_room: { x: 1780, y: 585 },
    hall_of_emissaries: { x: 2769, y: 376 },
    shrine_aurush: { x: 1275, y: 532 },
    shrine_telluria: { x: 2252, y: 722 },
    shrine_pelagos: { x: 2668, y: 840 },
    beast_pen: { x: 2081, y: 326 },
    weavers_hall: { x: 2838, y: 690 },
    stone_masonworks: { x: 2194, y: 829 },
    fishery_smokehouse: { x: 185, y: 734 },
    timber_sawmill: { x: 1838, y: 847 },
    courier_exchange: { x: 1454, y: 547 }
  },
  /* Facility levels (the facilities overhaul's step 1b, 13 October 2026;
     Harry's decisions D6 to D8): every facility goes from Level 1 to 5. An
     upgrade is an order at that facility (a pending order, like any other)
     taking these days to reach each level, and costing no gold for now. It
     can't be ordered while the facility is Under Repair (D6). The Hall's
     roll bonus stays +6 at Levels 4 and 5 (D7). */
  levels: {
    max: 5,
    upgradeDays: { 2: 7, 3: 14, 4: 21, 5: 28 },
    upgradeCostGP: 0
  },
  /* What a level gives besides the orders it opens (an order's own
     requiredFacilityLevel in facilities-data.js is listed by itself).
     Shown under Upgrade (Harry, 18 October 2026) so the DM can see what a
     level does. A facility or level with no order and no line here
     unlocks nothing yet. Keep these true: they describe what the code
     does (commerce-data.js, courier-data.js, creatures-data.js,
     war-room-data.js, research-data.js). */
  levelEffects: {
    dock: {
      2: ['Cargo ships: 2 lots on 1 ship'],
      3: ['Cargo ships: 3 lots a ship'],
      4: ['Cargo ships: 4 lots a ship, and a standing shipment on a schedule'],
      5: ['Cargo ships: 5 lots a ship, 2 ships at sea at once']
    },
    courier_exchange: {
      2: ['Regional deliveries: 2 parcels on the road at once, 10 items a parcel']
    },
    war_room: { 2: ['1 drill place'], 3: ['2 drill places'], 5: ['3 drill places'] },
    hall_of_emissaries: { 2: ['Diplomacy rolls +4 (from +2)'], 3: ['Diplomacy rolls +6 (the most it gives)'] },
    herbal_gardens: { 2: ['One more research token'], 3: ['One more research token'], 4: ['One more research token'], 5: ['One more research token'] }
  },
  /* The facilities overhaul (13 October 2026): what each retired facility
     id became. A Bastion saved before it (v 2) is converted once
     (R.migrateToV3): built facilities, buildings under way, pending orders
     (their order ids by "fns"), levels and repairs move to the new id; a
     facility with "to" null is gone (the Gaming Hall). "legacy" keeps an old
     order for Bastions that had that building (the Smithy's, as "smithing"). */
  retiredFacilities: {
    smithy: { to: 'workshop', name: 'Smithy', fns: { craft: 'smithing' }, legacy: 'smithy' },
    arcane_study: { to: 'arcane_laboratory', name: 'Arcane Study', fns: {} },
    laboratory: { to: 'arcane_laboratory', name: 'Laboratory', fns: { craft: 'alchemy' } },
    library: { to: 'library_scriptorium', name: 'Library', fns: {} },
    garden: { to: 'herbal_gardens', name: 'Garden', fns: {} },
    greenhouse: { to: 'herbal_gardens', name: 'Greenhouse', fns: { harvest: 'cultivate' } },
    gaming_hall: { to: null, name: 'Gaming Hall', fns: {} }
  },
  /* The Strip Back Overhaul (Harry, 22 October 2026; docs/STRIP-BACK-PLAN.md):
     what the one conversion to version 4 (R.migrateToV4, strip-back-rules.js)
     needs to know AFTER the facilities and orders it deals with have been
     taken out of facilities-data.js, so its report can still name them in
     plain English. Names only for now; each later step fills in its own part.
     - facilities: the 13 facilities being retired, by id: their names as
       the Bastion has always shown them (the catalogue's own names until
       each is deleted). The Menagerie, War Room, Library & Scriptorium,
       Arcane Laboratory, Armoury, Watchtower and Barracks go or join the
       Workshop; the three Shrines become one Temple; the Wyvern Roost,
       Griffin Tower and Dire Wolf Den become one Beast Pen.
     - orders: what becomes of each retired order (kept, moved, cancelled)
       and the words for it (filled in by the steps that retire them);
     - names: other things the report names that the data will no longer hold;
     - menagerieValue: what each Menagerie beast cost, so the report can say
       "a Tiger, bought for 1,000 gp" (filled in with the Menagerie's removal).
     Keep every name spelled as above. A new facility never goes in here. */
  stripBack: {
    facilities: {
      menagerie: 'Menagerie',
      war_room: 'War Room',
      library_scriptorium: 'Library & Scriptorium',
      arcane_laboratory: 'Arcane Laboratory',
      armoury: 'Armoury',
      watchtower: 'Watchtower',
      barracks: 'Barracks',
      shrine_telluria: 'Shrine of Telluria',
      shrine_aurush: 'Shrine of Aurush',
      shrine_pelagos: 'Shrine of Pelagos',
      wyvern_roost: 'Wyvern Roost',
      griffin_tower: 'Griffin Tower',
      dire_wolf_den: 'Dire Wolf Den'
    },
    orders: {},
    names: {},
    menagerieValue: {}
  },

  /* The Bastion map (Harry's new painting, 12 October 2026; in use since
     13 October): one base painting, and a see-through overlay the same size
     for each built facility that has one, drawn in this order. Two
     facilities could share a picture (it's drawn once); since the
     facilities overhaul (13 October 2026) none do: the Arcane Laboratory
     uses the old Laboratory's picture and the Herbal Gardens the
     Greenhouse's. The Shrines are shown (D10, reversing B12). The Workshop
     and the other starting buildings are in the base painting; the
     Menagerie has no picture. The Courier Exchange's (Harry, 13 October
     2026) stands in the open square, where the cart is. The new facilities
     still in development (six since pull request 3 made the Fishery and
     Timber Yard buildable) have theirs listed already, so they appear as
     soon as they can be built. The originals are in bastion-new-art/. */
  map: {
    base: 'map/bastion_base.jpg',
    width: 3000,
    height: 1250,
    overlays: [
      { fac: 'library_scriptorium', pic: 'map/overlays/library.png' },
      { fac: 'arcane_laboratory', pic: 'map/overlays/laboratory.png' },
      { fac: 'herbal_gardens', pic: 'map/overlays/greenhouse.png' },
      { fac: 'war_room', pic: 'map/overlays/war_room.png' },
      { fac: 'hall_of_emissaries', pic: 'map/overlays/hall_of_emissaries.png' },
      { fac: 'shrine_aurush', pic: 'map/overlays/shrine_of_aurush.png' },
      { fac: 'shrine_telluria', pic: 'map/overlays/shrine_of_telluria.png' },
      { fac: 'shrine_pelagos', pic: 'map/overlays/shrine_of_pelagos.png' },
      { fac: 'beast_pen', pic: 'map/overlays/wyvern_roost.png' },
      { fac: 'weavers_hall', pic: 'map/overlays/weavers_sailmakers_hall.png' },
      { fac: 'stone_masonworks', pic: 'map/overlays/stone_quarry_masonworks.png' },
      { fac: 'fishery_smokehouse', pic: 'map/overlays/fishery_smokehouse.png' },
      { fac: 'timber_sawmill', pic: 'map/overlays/timber_yard_sawmill.png' },
      { fac: 'courier_exchange', pic: 'map/overlays/courier_exchange.png' }
    ]
  },

  /* The seven clans (4937-4945). */
  clans: [
    { key: 'blackstone', name: 'Blackstone' },
    { key: 'bacca', name: 'Bacca' },
    { key: 'farmer', name: 'Farmer' },
    { key: 'slade', name: 'Slade' },
    { key: 'molten', name: 'Molten' },
    { key: 'rowthorn', name: 'Rowthorn' },
    { key: 'karr', name: 'Karr' }
  ],
  /* The order the Hall's planning box lists clans when an action has no options (1914). */
  hallClanOrder: ['Blackstone', 'Karr', 'Bacca', 'Farmer', 'Molten', 'Slade', 'Rowthorn'],

  /* What each clan trades (1753-1761). */
  clanTrade: {
    blackstone: { name: 'Blackstone', commodity: 'Timber', risk: 'low' },
    bacca: { name: 'Bacca', commodity: 'Weapons', risk: 'medium' },
    slade: { name: 'Slade', commodity: 'Steel', risk: 'medium' },
    rowthorn: { name: 'Rowthorn', commodity: 'Maritime', risk: 'low' },
    karr: { name: 'Karr', commodity: 'Wool & Furs', risk: 'high' },
    molten: { name: 'Molten', commodity: 'Precious Metals', risk: 'high' },
    farmer: { name: 'Farmer', commodity: 'Livestock', risk: 'high' }
  },
  /* Each clan's glowing route on the Sea Trade Routes map (2617-2629). */
  routeOverlays: {
    blackstone: 'ui/blackstone_trade_route.png',
    karr: 'ui/karr_trade_route.png',
    bacca: 'ui/bacca_trade_route.png',
    farmer: 'ui/farmer_trade_route.png',
    molten: 'ui/molten_trade_route.png',
    slade: 'ui/slade_trade_route.png',
    rowthorn: 'ui/rowthorn_trade_route.png'
  },
  consortiumName: 'Ironbow Trade Consortium',

  /* Party identity (4947-4954): founding a Clan. (The Mercenary Brigade's
     level 7 and 3 defenders are in tools/bastion/archive/mercenary-brigade.js.) */
  identityRules: {
    clanMinLevel: 9,
    clanSupportTotalMin: 360,
    clanSupportPerClanMin: 55,
    clanSupportClanCountMin: 3
  },

  /* Hall of Emissaries: the DC for each action (908-915). */
  hallDC: { trade_agreement: 14, host_delegation: 13, summit: 12, arbitration: 15, consortium: 16 },
  /* What a roll tier does to a Hall action (960-964): days added to how
     long its record lasts, income multiplier, Political Capital, and the
     days the action is then cooling down. These were turns (+2 to −2, a
     2-turn cooldown); since the days overhaul (8 October 2026) they're the
     same at 7 days a turn. A natural 1 has no row, so it counts as a plain
     success with no change (B20, kept). */
  hallTiers: {
    critical_success: { daysAdj: 14, incomeMult: 1.35, pcDelta: 25 },
    great_success: { daysAdj: 7, incomeMult: 1.20, pcDelta: 15 },
    success: { daysAdj: 0, incomeMult: 1.00, pcDelta: 8 },
    failure: { daysAdj: -7, incomeMult: 0.75, pcDelta: -10 },
    bad_failure: { daysAdj: -14, incomeMult: 0, pcDelta: -20, cooldownDays: 14 }
  },
  /* A Trade Agreement runs for the weeks chosen when it's planned (Harry,
     8 October 2026), plus or minus the roll tier's days, and never less
     than one week. */
  tradeAgreementWeeks: [1, 3, 6],
  tradeAgreementDefaultWeeks: 3,
  /* Hosting a delegation (1011-1097). */
  delegation: { diplomacyDC: 13, insightDC: 12, toneMod: { conciliatory: 2, assertive: 0, opportunistic: -2 } },
  /* Trade Network investments (710-817). */
  networkUpgrades: {
    stability: { costGP: 75, days: 7, label: 'Ironbow Trade Network: Stability Investment' },
    yield: { costGP: 90, days: 7, label: 'Ironbow Trade Network: Yield Investment' },
    toggle_high_risk: { costGP: 0, days: 1, label: 'Ironbow Trade Network: Routing Doctrine Change' }
  },
  /* The Council Ledger (2884-3051). */
  councilDC: 13,

  /* ---------- Time (the days overhaul, Harry, 8 October 2026) ----------
     The Bastion follows the Explorer's day (docs/BASTION-OVERHAUL.md).
     Each order's own days are in facilities-data.js; these are the rest.
     - buildDays: building a facility, by its required level (the first row
       whose level it reaches): 21 / 28 / 35 / 35 days at levels 5 / 9 / 13
       / 17 (it was 3 / 4 / 5 / 5 turns).
     - every: contracts send a shipment, sea routes settle and a Clan at war
       rolls to attack, every this many days from when each began.
     - patrolDays: the Watchtower's Patrol gives Advantage for this many
       days after it completes (it was "this turn").
     - musterDays: a War Action musters this many days after it's queued. */
  time: {
    buildDays: [{ level: 17, days: 35 }, { level: 13, days: 35 }, { level: 9, days: 28 }, { level: 5, days: 21 }],
    every: 7,
    patrolDays: 7,
    musterDays: 3
  },

  /* War (5285-5339): gold and target Political Capital on success / failure.
     (The old single roll's DCs are in tools/bastion/archive/mercenary-brigade.js.) */
  war: {
    outcomes: {
      defend: { gp: [0, -25], pc: [6, -8] },
      raid: { gp: [75, -50], pc: [-10, 8] },
      skirmish: { gp: [40, -30], pc: [-6, 6] },
      seize_outpost: { gp: [60, -60], pc: [-12, 10] }
    },
    objectives: [
      { value: 'raid', label: 'Raid' },
      { value: 'skirmish', label: 'Skirmish' },
      { value: 'defend', label: 'Defend Bastion' },
      { value: 'seize_outpost', label: 'Seize Outpost (placeholder)' }
    ],

    /* The Military Action (Harry's request, 2 October 2026): three rolls
       before the battle, then the War Table. These change nothing yet
       except Luck, which adds its +1 or −1 to the war's roll; what weather
       and morale do in battle comes with the combat build.
       Weather: pass the DC for a clear day; fail it and the weather is one
       of the Explorer's storms, at random. Morale's DC rises with bad
       weather. {leaders} / {Leaders} become "your Lieutenants" (or
       "you", the party, when no Lieutenants march). */
    militaryAction: {
      dc: { weather: 12, morale: 12, luck: 10 },
      clear: {
        id: 'clear', title: 'Clear Day', moraleDc: 0,
        text: 'The sky holds clear and bright over the field. Banners hang still in the morning air, and every shout carries.'
      },
      /* The Explorer's weather events (tools/explorer/data/explorer-data.js),
         with their films. */
      storms: [
        {
          id: 'white_blizzard', title: 'White Blizzard', kind: 'Snowstorm', moraleDc: 4,
          video: 'tools/explorer/assets/overlays/blizzard_overlay.mp4',
          text: 'Snow comes suddenly, swallowing colour and distance. The world becomes a white corridor, and every breath feels borrowed.'
        },
        {
          id: 'cold_rain', title: 'Cold Downpour', kind: 'Rainstorm', moraleDc: 2,
          video: 'tools/explorer/assets/overlays/rain_overlay.mp4',
          text: 'Rain needles through seams and straps. The road slicks, sounds carry oddly, and your pace becomes a negotiation.'
        },
        {
          id: 'sun_heatwave', title: 'Sun & Heatwave', kind: 'Heatwave', moraleDc: 3,
          video: 'tools/explorer/assets/overlays/sun_heat_overlay.mp4',
          text: 'The sun presses down like a weight. Water warms, tempers shorten, and the road shimmers ahead in wavering ribbons.'
        }
      ],
      morale: {
        clear: {
          pass: 'The march is easy under a clear sky. Songs carry down the column, and {leaders} find the ranks eager for the fight.',
          fail: 'Even under a clear sky, doubt spreads through the ranks. Too many wonder whether this fight is worth the blood it will cost.'
        },
        white_blizzard: {
          pass: 'Despite the biting cold of the march, {leaders} keep your forces’ spirits high through encouraging words around warm campfires.',
          fail: 'The morale of your forces is low after a long march to the field in biting cold and ankle-deep snow.'
        },
        cold_rain: {
          pass: 'Soaked to the skin, your forces still grin at one another through the downpour. {Leaders} make a jest of every puddle, and the ranks hold together.',
          fail: 'Rain has found every seam and strap. Boots are heavy, tempers short, and the ranks reach the field sodden and sullen.'
        },
        sun_heatwave: {
          pass: 'The sun hammers the column, but {leaders} ration the water well and rest the ranks in the shade. They arrive hot, but hungry for the fight.',
          fail: 'The heat has drained the fight from your forces. They reach the field parched and slow, more eager for shade than for battle.'
        }
      },
      luck: {
        pass: 'Fortune smiles today. A hawk circles your banner three times before the march, and the ranks take it as a sign that the Gods ride with you. (+1 modifier on all attack rolls)',
        fail: 'Something strange is in the air today, perhaps the Gods do not look kindly upon this needless bloodshed… (−1 modifier on all attack rolls)'
      },
      /* The Bastion's regiments are "Regiment (100)". */
      regimentSize: 100
    }
  },

  /* The three gods on the Favour panel. */
  gods: [
    { key: 'telluria', name: 'Telluria' },
    { key: 'aurush', name: 'Aurush' },
    { key: 'pelagos', name: 'Pelagos' }
  ],

  /* Library research notes (3290-3301). The keys don't match the Library's
     option names ("Geographical Scriptures"…), so no note is ever added, as
     before (B16, kept). */
  scriptureNotes: {
    Geographical: 'Adv. on Survival checks once per long rest.',
    Lore: 'Adv. on Religion checks once per long rest.',
    History: 'Adv. on Religion checks once per long rest.',
    Politics: 'Adv. on 1 check when interacting with Clan members, once per long rest.',
    War: 'Adv. on Athletics checks once per long rest.',
    Combat: 'Adv. on Athletics checks once per long rest.',
    Religious: 'Adv. on Religion checks once per long rest.',
    Political: 'Adv. on 1 check when interacting with Clan members, once per long rest.'
  },

  /* A clan's reaction to a Hall action, picked at random (1877-1898). */
  reactions: {
    good: ['{clan} accepts with measured approval.', '{clan}\'s envoy nods once, and the room quietly shifts.', 'A seal is pressed. {clan} seems satisfied.'],
    mid: ['{clan} agrees, but their eyes keep counting.', '{clan} watches carefully. Nothing is free.', 'The ink dries. The court stays quiet.'],
    bad: ['{clan} withdraws behind polite smiles.', '{clan}\'s envoy leaves without finishing their wine.', 'A quiet insult lands like a thrown gauntlet. {clan} remembers.']
  },

  /* The Hall's hover notes (3552-3603). */
  hallTips: {
    trade_agreement: ['Creates a timed Trade Agreement with a clan, for 1, 3 or 6 weeks.', 'On resolution: a d20 vs DC determines the income per shipment, duration tilt, and Political Capital change.', 'A shipment arrives every 7 days while it runs, its gold paid automatically.'],
    host_delegation: ['Host a clan delegation at the Hall.', 'On resolution: two rolls (Diplomacy + Insight).', 'Strong outcomes can grant a Favour Token and boost Political Capital.'],
    summit: ['Convene an inter-clan summit to reduce costs on Hall actions.', 'On resolution: sets a % discount for future Hall actions for a limited time.', 'Also shifts Political Capital for both clans.'],
    arbitration: ['Secures a Writ of Authority from the capital.', 'Effect: +2 to Council Verdict rolls for the next 3 rulings.', 'Use Council Ledger to judge disputes created by disrupted routes.'],
    consortium: ['Creates a Trade Consortium contract and activates the Ironbow Trade Network.', 'On resolution: opens a route for the chosen clan (with risk + yield).', 'Each route sails every 7 days for income, disruption, and disputes.'],
    port_charter: ['Registers a Port Charter the DM granted in the Explorer.', 'Takes 3 days: no gold and no roll. One Charter at a time.', 'Once registered, the Dock (Level 2 or higher) can ship cargo to that port.'],
    other: ['A diplomatic action issued from the Hall.', 'Resolves when its days are up.', 'Outcome is determined by your roll and applies Political Capital changes.']
  },

  /* The Compendium's card pictures (assets/compendium_cards/<name>.png). A card
     shows only when its file name is exactly the item's name, as before, so
     these 36 show (B15); the other 19 are in assets/extras/compendium_cards/. */
  compendiumCards: [
    "Antitoxin",
    "Assassin's Blood",
    "Bag of Holding",
    "Basic Poison",
    "Bead of Nourishment",
    "Bead of Refreshment",
    "Boots of Striding and Springing",
    "Cap of Water Breathing",
    "Charlatan's Die",
    "Circlet of Blasting",
    "Cloak of Protection",
    "Dread Helm",
    "Gem of Brightness",
    "Hat of Disguise",
    "Keelboat",
    "Lock of Trickery",
    "Longship",
    "Moon-Touched Sword",
    "Mystery Key",
    "Potion of Climbing",
    "Potion of Healing",
    "Potion of Poison",
    "Potion of Resistance",
    "Potion of Water Breathing",
    "Ring of Jumping",
    "Ring of Swimming",
    "Ring of Warmth",
    "Rope of Climbing",
    "Saddle of the Cavalier",
    "Sending Stones",
    "Sentinel Shield",
    "Shield of Expression",
    "Smoldering Armor",
    "Sword of Vengeance",
    "Truth Serum",
    "Walloping Ammunition"
  ],

  /* Hand-written compendium descriptions (3665-3878). The old tool never
     showed them, and they stay hidden (B15, kept). They're here so nothing
     Harry wrote is lost. */
  hiddenCompendiumDetails: {
    "Bag of Holding": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "No",
      "summary": "A bag whose inside is much larger than the outside. Holds up to 500 lb / 64 cubic feet; retrieving an item takes an action. Overloading or tearing it destroys it and scatters contents into the Astral Plane.",
      "source": "https://dnd5e.wikidot.com/wondrous-items:bag-of-holding"
    },
    "Cloak of Protection": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "Yes",
      "summary": "While wearing it, you gain +1 to AC and +1 to saving throws.",
      "source": "https://dnd5e.wikidot.com/wondrous-items:cloak-of-protection"
    },
    "Ring of Warmth": {
      "type": "Ring (Uncommon)",
      "attunement": "Yes",
      "summary": "While wearing it, you have resistance to cold damage and are unharmed by extreme cold temperatures (as described in the item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items:ring-of-warmth"
    },
    "Sentinel Shield": {
      "type": "Armor (Shield) (Uncommon)",
      "attunement": "No",
      "summary": "While holding it, you have advantage on initiative rolls and Wisdom (Perception) checks.",
      "source": "https://dnd5e.wikidot.com/wondrous-items:sentinel-shield"
    },
    "Dread Helm": {
      "type": "Wondrous item (Common)",
      "attunement": "No",
      "summary": "While wearing it, your eyes glow red.",
      "source": "https://dnd5e.wikidot.com/wondrous-items:dread-helm"
    },
    "Moon-Touched Sword": {
      "type": "Weapon (any sword) (Common)",
      "attunement": "No",
      "summary": "In darkness, when unsheathed it sheds bright light in a 15-ft radius and dim light for an additional 15 ft.",
      "source": "https://dnd5e.wikidot.com/wondrous-items:moon-touched-sword"
    },
    "Shield of Expression": {
      "type": "Armor (Shield) (Common)",
      "attunement": "No",
      "summary": "While bearing it, you can use a bonus action to change the face on its front to a different expression.",
      "source": "https://roll20.net/compendium/dnd5e/Items%3AShield%20of%20Expression/"
    },
    "Wraps of Unarmed Power, +1": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "No",
      "summary": "While wearing them, you gain +1 to attack and damage rolls with unarmed strikes. (2024 rules text also allows choosing Force or normal type for the strike.)",
      "source": "https://roll20.net/compendium/dnd5e/Items%3AWraps%20of%20Unarmed%20Power%20%2B1?expansion=33335"
    },
    "Bead of Nourishment": {
      "type": "Wondrous item (Common)",
      "attunement": "No",
      "summary": "Consumable bead that provides nourishment (no food needed for the day).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Bead of Refreshment": {
      "type": "Wondrous item (Common)",
      "attunement": "No",
      "summary": "Consumable bead that provides drink/refreshment (no water needed for the day).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Boots of Striding and Springing": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "Yes",
      "summary": "Improves movement: prevents speed reduction from encumbrance and boosts jump distance (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Boots of the Winterlands": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "Yes",
      "summary": "Cold-weather mobility and survival benefits (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Cap of Water Breathing": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "No",
      "summary": "Wearer can breathe underwater (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Charlatan's Die": {
      "type": "Wondrous item (Common)",
      "attunement": "No",
      "summary": "A trick die that can be controlled to land on a chosen face (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Circlet of Blasting": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "No",
      "summary": "Lets the wearer cast Scorching Ray (limited uses, per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Gloves of Swimming and Climbing": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "No",
      "summary": "Grants a climbing speed and swimming speed (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Gloves of Thievery": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "No",
      "summary": "Boosts Sleight of Hand and lockpicking (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Hat of Disguise": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "Yes",
      "summary": "Lets you cast Disguise Self at will while wearing it.",
      "source": "https://dnd5e.wikidot.com/wondrous-items:hat-of-disguise"
    },
    "Lock of Trickery": {
      "type": "Wondrous item (Common)",
      "attunement": "No",
      "summary": "A lock with a magical trick property (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Mystery Key": {
      "type": "Wondrous item (Common)",
      "attunement": "No",
      "summary": "A key that can fit and open an unknown lock once, then becomes mundane (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Potion of Climbing": {
      "type": "Potion (Common)",
      "attunement": "No",
      "summary": "Grants a climbing speed for a limited duration (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Potion of Healing (greater)": {
      "type": "Potion (Uncommon)",
      "attunement": "No",
      "summary": "Heals more than a basic healing potion (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Potion of Poison": {
      "type": "Potion (Uncommon)",
      "attunement": "No",
      "summary": "A trapped/hostile potion that poisons the drinker (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Potion of Resistance": {
      "type": "Potion (Uncommon)",
      "attunement": "No",
      "summary": "Grants resistance to a specific damage type for a limited duration (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Potion of Water Breathing": {
      "type": "Potion (Uncommon)",
      "attunement": "No",
      "summary": "Lets the drinker breathe underwater for a limited duration (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Ring of Jumping": {
      "type": "Ring (Uncommon)",
      "attunement": "Yes",
      "summary": "Boosts jump distance (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Ring of Swimming": {
      "type": "Ring (Uncommon)",
      "attunement": "No",
      "summary": "Grants a swimming speed (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Rope of Climbing": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "No",
      "summary": "A rope that animates to climb, knot, and secure itself (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Saddle of the Cavalier": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "No",
      "summary": "Helps keep you mounted and resists being dismounted (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Sending Stones": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "No",
      "summary": "Paired stones that allow limited Sending-style communication between them (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Shield, +1": {
      "type": "Armor (Shield) (Uncommon)",
      "attunement": "No",
      "summary": "A shield with a +1 bonus to AC beyond a normal shield.",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Smoldering Armor": {
      "type": "Armor (Common)",
      "attunement": "No",
      "summary": "Armor that harmlessly emits smoke/embers for dramatic effect (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Stone of Good Luck": {
      "type": "Wondrous item (Uncommon)",
      "attunement": "Yes",
      "summary": "Also called a Luckstone. Grants a bonus to ability checks and saving throws (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Sword of Vengeance": {
      "type": "Weapon (Rare)",
      "attunement": "Yes",
      "summary": "A cursed sword that drives the wielder to pursue a foe when harmed (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    },
    "Walloping Ammunition": {
      "type": "Weapon (Ammunition) (Common)",
      "attunement": "No",
      "summary": "Ammunition that can knock a target prone on a hit (per item).",
      "source": "https://dnd5e.wikidot.com/wondrous-items"
    }
  }
};
