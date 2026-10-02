/* The Ironbow Bastion Manager: the fixed numbers, names and wording that
   were written into the old tool's app.js (line numbers point there). The
   facilities, tool tables, events and compendium are in their own files. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.bastion = {
  /* The five facilities every Bastion starts with (226). */
  startingBuilt: ['barracks', 'armoury', 'watchtower', 'workshop', 'dock'],

  /* Each facility's picture in assets/facilities/ (284-311). */
  facilityImages: {
    barracks: 'barracks.png',
    armoury: 'armoury.png',
    watchtower: 'watchtower.png',
    workshop: 'workshop.png',
    dock: 'docks.png',
    arcane_study: 'arcane_study.png',
    library: 'library.png',
    smithy: 'smithy.png',
    garden: 'garden.png',
    menagerie: 'menagerie.png',
    laboratory: 'laboratory.png',
    war_room: 'war_room.png',
    gaming_hall: 'gambling_hall.png',
    greenhouse: 'greenhouse.png',
    shrine_telluria: 'shrine_of_telluria.png',
    shrine_aurush: 'shrine_of_aurush.png',
    shrine_pelagos: 'shrine_of_pelagos.png',
    hall_of_emissaries: 'hall_of_emissaries.png'
  },

  /* A built facility shows on the Bastion map if assets/overlays/<id>_overlay.png
     exists (1256-1277). These eight do. The Gaming Hall and the three shrines
     have overlay art under other names, so they stay hidden, as before (B12);
     that art is in assets/extras/. */
  overlays: ['arcane_study', 'garden', 'greenhouse', 'hall_of_emissaries', 'laboratory', 'library', 'smithy', 'war_room'],

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

  /* Party identity (4947-4954). */
  identityRules: {
    clanMinLevel: 9,
    mercMinLevel: 7,
    clanSupportTotalMin: 360,
    clanSupportPerClanMin: 55,
    clanSupportClanCountMin: 3,
    mercMinDefenders: 3
  },

  /* Hall of Emissaries: the DC for each action (908-915). */
  hallDC: { trade_agreement: 14, host_delegation: 13, summit: 12, arbitration: 15, consortium: 16 },
  /* What a roll tier does to a Hall action (960-964): turns added, income
     multiplier, Political Capital. A natural 1 has no row, so it counts as a
     plain success with no change (B20, kept). */
  hallTiers: {
    critical_success: { turnsAdj: 2, incomeMult: 1.35, pcDelta: 25 },
    great_success: { turnsAdj: 1, incomeMult: 1.20, pcDelta: 15 },
    success: { turnsAdj: 0, incomeMult: 1.00, pcDelta: 8 },
    failure: { turnsAdj: -1, incomeMult: 0.75, pcDelta: -10 },
    bad_failure: { turnsAdj: -2, incomeMult: 0, pcDelta: -20, cooldown: 2 }
  },
  /* Hosting a delegation (1011-1097). */
  delegation: { diplomacyDC: 13, insightDC: 12, toneMod: { conciliatory: 2, assertive: 0, opportunistic: -2 } },
  /* Trade Network investments (710-817). */
  networkUpgrades: {
    stability: { costGP: 75, label: 'Ironbow Trade Network: Stability Investment' },
    yield: { costGP: 90, label: 'Ironbow Trade Network: Yield Investment' },
    toggle_high_risk: { costGP: 0, label: 'Ironbow Trade Network: Routing Doctrine Change' }
  },
  /* The Council Ledger (2884-3051). */
  councilDC: 13,

  /* War (5285-5339): DC, and gold and target Political Capital on success / failure. */
  war: {
    dc: { raid: 14, skirmish: 13, defend: 12, seize_outpost: 15 },
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
    trade_agreement: ['Creates a timed Trade Agreement with a clan.', 'On resolution: a d20 vs DC determines income/turn, duration tilt, and Political Capital change.', 'Income is paid automatically each Bastion Turn while active.'],
    host_delegation: ['Host a clan delegation at the Hall.', 'On resolution: two rolls (Diplomacy + Insight).', 'Strong outcomes can grant a Favour Token and boost Political Capital.'],
    summit: ['Convene an inter-clan summit to reduce costs on Hall actions.', 'On resolution: sets a % discount for future Hall actions for a limited time.', 'Also shifts Political Capital for both clans.'],
    arbitration: ['Secures a Writ of Authority from the capital.', 'Effect: +2 to Council Verdict rolls for the next 3 rulings.', 'Use Council Ledger to judge disputes created by disrupted routes.'],
    consortium: ['Creates a Trade Consortium contract and activates the Ironbow Trade Network.', 'On resolution: opens a route for the chosen clan (with risk + yield).', 'Routes can later be resolved each turn for income, disruption, and disputes.'],
    other: ['A diplomatic action issued from the Hall.', 'Resolves next Bastion Turn.', 'Outcome is determined by your roll and applies Political Capital changes.']
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
