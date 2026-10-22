/* The Ironbow Bastion Manager: the 22 facilities, their functions, options, costs and specials.
   A word-for-word copy of the old tool's data/facilities.json, stored as a script so it
   loads from a double-clicked file. Edit it here.
   One change since: the War Room's Recruit list is the war mini-game's units (phase 2,
   Harry's decision of 2 October 2026), in the order and with the labels of
   war-units-data.js (TSI_DATA.bastionWar.warRoom); keep the two the same.
   And since the days overhaul (Harry, 8 October 2026): every order has "days", how
   many in-game days after it's issued it completes (docs/BASTION-OVERHAUL.md
   section 2), and the Hall's records last "durationDays" (they lasted
   "durationTurns" Bastion turns, at 7 days a turn). The two notes that said "turn"
   now say 7 days. Change any number here; nothing else needs to change.
   And since the facilities overhaul (Harry, 13 October 2026; docs/FACILITIES-OVERHAUL-PLAN.md):
   22 facilities. The Smithy joined the Workshop (its order kept, as "smithing", only for
   Bastions that had one: "onlyIfLegacy"); the Arcane Study and Laboratory are the Arcane
   Laboratory (the Laboratory's Craft is "alchemy"); the Garden and Greenhouse are Herbal
   Gardens (the Greenhouse's Harvest is "cultivate"); the Library is the Library &
   Scriptorium. An order's "requiredPartyLevel" keeps its old building's party level.
   The Gaming Hall is gone. The new facilities still "inDevelopment" are listed, not yet
   buildable, until each gets its orders: six since pull request 3 (13 October 2026) made
   the Fishery & Smokehouse and Timber Yard & Sawmill buildable, five since pull
   request 6 (14 October 2026) made the Courier Exchange buildable, and two since pull
   request 7 (14 October 2026) opened the three creature buildings. Old saves are
   converted once (R.migrateToV3).
   Pull request 3 (Harry's facility guide) added, all safe to change:
   - "plot": true: built on a Development Plot, not in a construction slot;
   - "productionLimit": 1: one production order at a time at that facility;
   - an order's "production": true, and "requiredFacilityLevel" (the facility's level it
     needs, 1 to 5);
   - a production order's options, each a recipe: "inputs" and "outputs" list goods by
     their id in goods-data.js with a "qty" ({ "good": "raw_timber", "qty": 1 }), or an
     ordinary item by name ({ "item": "Healer's Kit", "qty": 2 }); a recipe can have its
     own "days"; "needsResearch" is the id of the research choice it waits for
     (research-data.js); "key" lets research find it.
   Pull request 6 (Harry, 14 October 2026): the Courier Exchange has no orders
   ("functions": []): its parcels are sent from its own section of the panel, as the
   Dock's cargo is, with the numbers in courier-data.js and the rules in
   courier-rules.js. "requiredLevel": 5 makes it take 21 days to build, as the
   Fishery & Smokehouse and Timber Yard & Sawmill do.
   Harry, 14 October 2026: the Library & Scriptorium's Level 2 order Prepare
   Overland Travel Charts makes 1 Overland chart in 4 days, with no gold and no
   ingredients, into the Warehouse as the Fishery's packs go. "productionLimit": 1
   keeps it to one chart order at a time; the scripture Research order beside it is
   unchanged and isn't a production order, so it runs alongside.
   The Stone Quarry & Masonworks and the Weavers' Hall opened on 19 October 2026 (Harry's
   answers): Level 5, a Development Plot, "productionLimit": 1 and six orders each, in the
   Timber Yard's pattern, no gold. Stone: Extract Raw Stone (L1, 4 days), Produce Dressed
   Stone (L2, 4, uses 1 Raw Stone), Produce Structural Masonry (L3, 5, uses 1 Dressed
   Stone), Produce Decorative Stonework (L4, 7, uses 1 Dressed Stone), Bulk Raw Stone
   Extraction (L5, 9, 3 Raw Stone) and Bulk Stone Processing (L5, 8, 3 Raw to 3 Dressed).
   Weavers: Produce Ordinary Textiles (L1, 4), Produce Sailcloth (L2, 4, uses 1 Ordinary
   Textiles), Produce Specialist Garments (L3, 5, uses 1 Ordinary Textiles), Improved
   Specialist Garment Production (L4, 7, 2 Ordinary Textiles to 2 Specialist Garments),
   Bulk Textile Production (L5, 9, 3 Ordinary Textiles) and Bulk Sailcloth Production
   (L5, 8, 3 Ordinary Textiles to 3 Sailcloth). Those ingredients were dropped in the
   Strip Back Overhaul (see "levelOrders" below): the orders above are as they were at
   19 October 2026 apart from what they use.
   The Strip Back Overhaul (Harry, 22 October 2026, step S04): the four production
   facilities built to the Timber Yard's pattern (timber_sawmill, fishery_smokehouse,
   stone_masonworks, weavers_hall) carry "levelOrders": "replace". Each level offers only
   its own order(s): the ones whose "requiredFacilityLevel" is the facility's level (two
   at Level 5, still one running at a time: "productionLimit": 1), and an upgrade REPLACES
   the last level's order (R.fnAvailable hides the others, "That order belongs to Level
   N."). Orders are self-contained: none lists "inputs", so every level works with an
   empty Warehouse. Nothing is ever deleted or renumbered: an order issued at Level N
   that is still pending when the upgrade completes finishes as usual, because the
   engine finds it by its id. Without the flag (the Herbal Gardens, the Courier
   Exchange) every order stays listed at every level, locked until its level.
   Pull request 7 (Harry, 14 October 2026) opened the Wyvern Roost, the Griffin Tower and the
   Dire Wolf Den. The Strip Back Overhaul (Harry, 22 October 2026, step S14) replaced all three
   with ONE building, the Beast Pen: it takes a construction slot, needs party level 5 and takes
   21 days to build ("requiredLevel": 5), has one level only ("singleLevel": true: no Upgrade
   row) and holds one beast of each kind (creatures-data.js, "pen"). It has two orders, and
   both are about a creature (creatures-data.js; the rules are in creature-rules.js):
   - "housesSpecies": "*" (House Beast Here, 3 days, no gold): a beast the DM granted in the
     Explorer, waiting for a home. The order's list is built when it is shown, from the beasts
     waiting, and the order keeps the chosen beast's id. ("housesCreature", the id of a creature
     that already exists in the story, is only kept for an order issued before the change: Elara's
     wyvern is no longer housed by the Bastion.)
   - "acclimatise": true (Acclimatise With Beast): not an order with days but an instant roll,
     typed by the DM at the table ("instant": true; its "days" is only there so every order
     has one). Its DC and lock are in creatures-data.js ("acclimatise").
   Training, harnesses, first flight and the three old buildings' other orders are gone; the
   conversion (R.migrateToV4, strip-back-rules.js, step rehomeBeasts) moves a House order to
   House Beast Here and cancels the rest. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.bastionFacilities = [
  {
    "name": "Workshop",
    "id": "workshop",
    "requiredLevel": 5,
    "functions": [
      {
        "id": "craft",
        "label": "Craft",
        "days": 3,
        "options": [],
        "costGP": 0,
        "costText": "0",
        "notes": "Outputs/dropdowns for the Craft function will be populated based on the selected toolsets added to the workshop facility (see TOOLS_TABLES sheet):\nSmith’s Tools\nTinker’s Tools\nAlchemist’s Supplies\nWeaver’s Tools\nLeatherworker’s Tools\nCarpenter’s Tools\nMason’s Tools\nGlassblower’s Tools\nCobbler’s Tools\nThieves’ Tools\nBrewer’s Supplies\nCalligrapher’s Supplies"
      },
      {
        "id": "craft_magic_item",
        "label": "Craft Magic Item",
        "days": 10,
        "options": [
          {
            "label": "Bead of Nourishment"
          },
          {
            "label": "Bead of Refreshment"
          },
          {
            "label": "Charlatan's Die"
          },
          {
            "label": "Bag of Holding"
          },
          {
            "label": "Boots of Striding and Springing"
          },
          {
            "label": "Boots of the Winterlands"
          },
          {
            "label": "Gloves of Swimming and Climbing"
          },
          {
            "label": "Gloves of Thievery"
          },
          {
            "label": "Potion of Healing (greater)"
          },
          {
            "label": "Potion of Water Breathing"
          },
          {
            "label": "Ring of Jumping"
          },
          {
            "label": "Ring of Swimming"
          },
          {
            "label": "Ring of Warmth"
          },
          {
            "label": "Rope of Climbing"
          },
          {
            "label": "Stone of Good Luck"
          },
          {
            "label": "Shield of Expression"
          },
          {
            "label": "Walloping Ammunition"
          },
          {
            "label": "Saddle of the Cavalier"
          },
          {
            "label": "Sentinel Shield"
          },
          {
            "label": "Shield, +1"
          },
          {
            "label": "Sword of Vengeance"
          },
          {
            "label": "Wraps of Unarmed Power, +1"
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": "This function (Craft Magic Item) is not available until the players reach Level 9."
      },
      {
        "id": "smithing",
        "label": "Smithing",
        "days": 5,
        "options": [
          {
            "label": "Battleaxe"
          },
          {
            "label": "Handaxe"
          },
          {
            "label": "Greataxe"
          },
          {
            "label": "Warhammer"
          },
          {
            "label": "War pick"
          },
          {
            "label": "Longsword"
          },
          {
            "label": "Shortsword"
          },
          {
            "label": "Greatsword"
          },
          {
            "label": "Scimitar"
          },
          {
            "label": "Rapier"
          },
          {
            "label": "Dagger"
          },
          {
            "label": "Spear"
          },
          {
            "label": "Trident"
          },
          {
            "label": "Mace"
          },
          {
            "label": "Morningstar"
          },
          {
            "label": "Flail"
          },
          {
            "label": "Halberd"
          },
          {
            "label": "Glaive"
          },
          {
            "label": "Pike"
          },
          {
            "label": "Lance"
          },
          {
            "label": "Chain shirt"
          },
          {
            "label": "Scale mail"
          },
          {
            "label": "Chain mail"
          },
          {
            "label": "Plate armor"
          },
          {
            "label": "Ring mail"
          },
          {
            "label": "Half plate"
          },
          {
            "label": "Manacles"
          },
          {
            "label": "Caltrops"
          },
          {
            "label": "Grappling hook"
          }
        ],
        "costGP": null,
        "costText": null,
        "notes": "The old Smithy's order, kept for Bastions that had a Smithy before it joined the Workshop (13 October 2026). Craft with Smith's Tools makes the same items in 3 days.",
        "onlyIfLegacy": "smithy"
      }
    ]
  },
  {
    "name": "Barracks",
    "id": "barracks",
    "requiredLevel": 5,
    "functions": [
      {
        "id": "recruit_defenders",
        "label": "Recruit Defenders",
        "days": 5,
        "options": [],
        "costGP": 0,
        "costText": "0",
        "notes": "1d4 defenders recruited and added to Bastion Defenders Panel"
      },
      {
        "id": "guard_commercial_convoy",
        "label": "Guard Commercial Convoy",
        "days": 3,
        "options": [],
        "costGP": 0,
        "costText": "0",
        "requiredFacilityLevel": 2,
        "protectionCharge": "commercial_convoy",
        "protectionMax": 1,
        "notes": "Prepares one Commercial Convoy from the Bastion's available personnel (no soldiers, defenders or regiments are used up): the next ship the Dock sends with cargo takes it, and its chance of trouble at sea is 5 points lower. One is kept at a time; another can be ordered once it has been used."
      }
    ]
  },
  {
    "name": "Watchtower",
    "id": "watchtower",
    "requiredLevel": 5,
    "functions": [
      {
        "id": "patrol",
        "label": "Patrol",
        "days": 1,
        "options": [],
        "costGP": 0,
        "costText": "0",
        "notes": "Gives Advantage on all rolls for Bastion Defenders if the Bastion is attacked during the next 7 days"
      },
      {
        "id": "protect_maritime_approaches",
        "label": "Protect Maritime Approaches",
        "days": 2,
        "options": [],
        "costGP": 0,
        "costText": "0",
        "requiredFacilityLevel": 2,
        "protectionWindow": "maritime_approaches",
        "windowDays": 7,
        "notes": "Protects the sea lanes for 7 days (the day it completes is Day 1): every ship the Dock sends with cargo in that time has its chance of trouble at sea 5 points lower. Not used up, and not extended: the next order can be issued once it ends. Separate from Patrol."
      }
    ]
  },
  {
    "name": "Dock",
    "id": "dock",
    "requiredLevel": 5,
    "functions": [
      {
        "id": "charter_berth",
        "label": "Charter Berth",
        "days": 7,
        "options": [
          {
            "label": "Keelboat",
            "costGP": 100,
            "costText": "100GP"
          },
          {
            "label": "Longship",
            "costGP": 200,
            "costText": "200GP"
          },
          {
            "label": "Sloop",
            "costGP": 400,
            "costText": "400GP"
          },
          {
            "label": "Cutter",
            "costGP": 500,
            "costText": "500GP"
          },
          {
            "label": "Brig",
            "costGP": 750,
            "costText": "750GP"
          },
          {
            "label": "Warship",
            "costGP": 900,
            "costText": "900 GP"
          },
          {
            "label": "Galley",
            "costGP": 1000,
            "costText": "1000GP"
          },
          {
            "label": "Galleon",
            "costGP": 1250,
            "costText": "1250GP"
          }
        ],
        "costGP": null,
        "costText": "100GP\n200GP\n400GP\n500GP\n750GP\n900 GP\n1000GP\n1250GP",
        "notes": null
      },
      {
        "id": "register_port_charter",
        "label": "Register Port Charter",
        "days": 3,
        "costGP": 0,
        "costText": "0",
        "requiredFacilityLevel": 1,
        "portCharter": true,
        "options": [],
        "notes": "Registers a Port Charter the DM granted in the Explorer, so the Dock can ship cargo to that port. No gold and no roll."
      }
    ]
  },
  {
    "name": "Armoury",
    "id": "armoury",
    "requiredLevel": 5,
    "functions": [
      {
        "id": "arm_defenders",
        "label": "Arm Defenders",
        "days": 3,
        "options": [],
        "costGP": null,
        "costText": "100GP + (current bastion defenders x 100GP)",
        "notes": "Once action completed, Bastion Defenders Panel shows 'Armed'"
      }
    ]
  },
  {
    "name": "War Room",
    "id": "war_room",
    "requiredLevel": 17,
    "functions": [
      {
        "id": "recruit",
        "label": "Recruit",
        "days": 7,
        "options": [
          {
            "label": "Lieutenant (1)"
          },
          {
            "label": "Archers (50)"
          },
          {
            "label": "Levy Infantry (150)"
          },
          {
            "label": "Line Infantry (100)"
          },
          {
            "label": "Heavy Infantry (50)"
          },
          {
            "label": "Light Cavalry (50)"
          },
          {
            "label": "Shock Cavalry (25)"
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": "No cost to recruit, but each soldier costs 1 gp every 7 days. Hover over a choice to see its stat block. Lieutenants and units join the Military panel when the order completes; a unit of a type that came home depleted brings that regiment back to full strength first."
      },
      {
        "id": "drill",
        "label": "Drill a Regiment",
        "days": 7,
        "costGP": 0,
        "costText": "25 gp × Battle Value (Trained), 50 gp × (Veteran)",
        "requiredFacilityLevel": 2,
        "drill": true,
        "notes": "Choose one regiment at full strength. Trained (7 days): +1 Resolve and +0.5 Battle Value. Veteran (14 more days): +1 Cohesion and +0.5 Battle Value more. The gold is paid when the drill starts. A regiment drilling stays at the Ironbow: it can't go on a War Action, but it defends the Ironbow if it's attacked."
      },
      {
        "id": "coordinated_muster",
        "label": "Coordinated Muster",
        "days": 7,
        "costGP": 0,
        "costText": "0",
        "requiredFacilityLevel": 3,
        "muster": 2,
        "notes": "Raises two formations in one order, in any mix (a regiment of a kind that came home depleted is refilled first, as Recruit does)."
      },
      {
        "id": "grand_muster",
        "label": "Grand Muster",
        "days": 7,
        "costGP": 0,
        "costText": "0",
        "requiredFacilityLevel": 5,
        "muster": 3,
        "notes": "Raises three formations in one order, in any mix (a regiment of a kind that came home depleted is refilled first, as Recruit does)."
      }
    ]
  },
  {
    "name": "Arcane Laboratory",
    "id": "arcane_laboratory",
    "requiredLevel": 5,
    "mergedFrom": [
      "arcane_study",
      "laboratory"
    ],
    "functions": [
      {
        "id": "craft_common",
        "label": "Craft Common",
        "days": 5,
        "options": [
          {
            "label": "Bead of Nourishment"
          },
          {
            "label": "Bead of Refreshment"
          },
          {
            "label": "Lock of Trickery"
          },
          {
            "label": "Mystery Key"
          },
          {
            "label": "Potion of Climbing"
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null
      },
      {
        "id": "craft_uncommon",
        "label": "Craft Uncommon",
        "days": 10,
        "options": [
          {
            "label": "Bag of Holding"
          },
          {
            "label": "Cap of Water Breathing"
          },
          {
            "label": "Circlet of Blasting"
          },
          {
            "label": "Cloak of Protection"
          },
          {
            "label": "Gem of Brightness"
          },
          {
            "label": "Hat of Disguise"
          },
          {
            "label": "Potion of Poison"
          },
          {
            "label": "Potion of Resistance"
          },
          {
            "label": "Potion of Water Breathing"
          },
          {
            "label": "Saddle of the Cavalier"
          },
          {
            "label": "Sending Stones"
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null
      },
      {
        "id": "alchemy",
        "label": "Alchemy",
        "days": 5,
        "options": [
          {
            "label": "Burnt Othur Fumes (Poison)"
          },
          {
            "label": "Essence of Ether (Poison)"
          },
          {
            "label": "Torpor (Poison)"
          },
          {
            "label": "Acid vial"
          },
          {
            "label": "Alchemist’s fire"
          },
          {
            "label": "Basic poison"
          },
          {
            "label": "Antitoxin"
          },
          {
            "label": "Firebomb (reskinned alchemist’s fire)"
          },
          {
            "label": "Frost vial (cold variant)"
          },
          {
            "label": "Sticky bomb (glue grenade)"
          },
          {
            "label": "Potion of healing (common)"
          },
          {
            "label": "Potion of greater healing (base item)"
          },
          {
            "label": "Potion of superior healing (base item)"
          },
          {
            "label": "Potion of supreme healing (base item)"
          },
          {
            "label": "Potion of climbing (base item)"
          },
          {
            "label": "Potion of water breathing (base item)"
          },
          {
            "label": "Potion of resistance (base item)"
          },
          {
            "label": "Darkvision draught (base item)"
          },
          {
            "label": "Stoneskin varnish (base item)"
          },
          {
            "label": "Vitality tonic (base item)"
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredPartyLevel": 9
      }
    ]
  },
  {
    "name": "Library & Scriptorium",
    "id": "library_scriptorium",
    "requiredLevel": 5,
    "productionLimit": 1,
    "functions": [
      {
        "id": "research",
        "label": "Research",
        "days": 5,
        "options": [
          {
            "label": "Geographical Scriptures"
          },
          {
            "label": "Religious Scriptures"
          },
          {
            "label": "Combat Scriptures"
          },
          {
            "label": "Political scriptures"
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null
      },
      {
        "id": "prepare_overland_travel_charts",
        "label": "Prepare Overland Travel Charts",
        "days": 4,
        "costGP": 0,
        "costText": "0",
        "notes": "Each Overland chart gives 3 days of use in the Travel bags: one more 6-mile hex on a day it's used. The Courier Exchange can send it to the party.",
        "requiredFacilityLevel": 2,
        "production": true,
        "options": [
          {
            "label": "1 Overland chart",
            "outputs": [
              {
                "good": "overland_chart",
                "qty": 1
              }
            ]
          }
        ]
      }
    ],
    "mergedFrom": [
      "library"
    ]
  },
  {
    "name": "Herbal Gardens",
    "id": "herbal_gardens",
    "requiredLevel": 5,
    "plot": true,
    "mergedFrom": [
      "garden",
      "greenhouse"
    ],
    "functions": [
      {
        "id": "harvest",
        "label": "Harvest",
        "days": 7,
        "options": [
          {
            "label": "Antitoxin (2 vials)",
            "key": "antitoxin",
            "batch": {
              "name": "Antitoxin",
              "qty": 2,
              "unit": "vials"
            }
          },
          {
            "label": "Rations (100)",
            "key": "rations",
            "batch": {
              "name": "Rations",
              "qty": 100,
              "unit": ""
            }
          },
          {
            "label": "Healer's Kit"
          },
          {
            "label": "Potion of Healing",
            "key": "potion_of_healing"
          },
          {
            "label": "Basic Poison"
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null
      },
      {
        "id": "cultivate",
        "label": "Greenhouse Harvest",
        "days": 10,
        "options": [
          {
            "label": "Greater Potion of Healing",
            "key": "greater_potion_of_healing"
          },
          {
            "label": "Truth Serum"
          },
          {
            "label": "Assassin's Blood"
          },
          {
            "label": "Pale Tincture"
          },
          {
            "label": "Malice"
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredPartyLevel": 9
      },
      {
        "id": "cultivate_specialist",
        "label": "Cultivate Specialist Plants",
        "days": 4,
        "costGP": 0,
        "costText": "0",
        "notes": "Crafting ingredients for the Herbal Gardens' own recipes (and, later, the Arcane Laboratory's).",
        "requiredFacilityLevel": 2,
        "production": true,
        "options": [
          {
            "label": "Restorative Herbs (10 portions)",
            "key": "restorative_herbs",
            "outputs": [
              {
                "good": "restorative_herbs",
                "qty": 10
              }
            ]
          },
          {
            "label": "Antivenom Roots (10 portions)",
            "key": "antivenom_roots",
            "outputs": [
              {
                "good": "antivenom_roots",
                "qty": 10
              }
            ]
          },
          {
            "label": "Toxic Blossoms (10 portions)",
            "key": "toxic_blossoms",
            "outputs": [
              {
                "good": "toxic_blossoms",
                "qty": 10
              }
            ]
          },
          {
            "label": "Alchemical Flowers (10 portions)",
            "key": "alchemical_flowers",
            "outputs": [
              {
                "good": "alchemical_flowers",
                "qty": 10
              }
            ]
          }
        ]
      },
      {
        "id": "field_medical_supplies",
        "label": "Prepare Field Medical Supplies",
        "days": 7,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 3,
        "production": true,
        "options": [
          {
            "label": "2 Healer's Kits + 4 Antitoxin vials",
            "key": "kits_and_antitoxin",
            "days": 6,
            "inputs": [
              {
                "good": "restorative_herbs",
                "qty": 5
              },
              {
                "good": "antivenom_roots",
                "qty": 5
              }
            ],
            "outputs": [
              {
                "item": "Healer's Kit",
                "qty": 2
              },
              {
                "item": "Antitoxin (2 vials)",
                "qty": 2
              }
            ]
          },
          {
            "label": "2 Potions of Healing",
            "key": "field_potions",
            "days": 7,
            "inputs": [
              {
                "good": "restorative_herbs",
                "qty": 10
              }
            ],
            "outputs": [
              {
                "item": "Potion of Healing",
                "qty": 2
              }
            ]
          },
          {
            "label": "2 doses of Basic Poison",
            "key": "field_poison",
            "days": 7,
            "inputs": [
              {
                "good": "toxic_blossoms",
                "qty": 10
              }
            ],
            "outputs": [
              {
                "item": "Basic Poison",
                "qty": 2
              }
            ]
          }
        ]
      },
      {
        "id": "commercial_medicinal_crops",
        "label": "Harvest Commercial Medicinal Crops",
        "days": 6,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 4,
        "production": true,
        "options": [
          {
            "label": "Medicinal Herbs (1 lot)",
            "key": "medicinal_herbs",
            "days": 6,
            "outputs": [
              {
                "good": "medicinal_herbs",
                "qty": 1
              }
            ]
          },
          {
            "label": "Refined Botanical Reagents (1 lot)",
            "key": "refined_botanical_reagents",
            "days": 7,
            "inputs": [
              {
                "good": "alchemical_flowers",
                "qty": 10
              }
            ],
            "outputs": [
              {
                "good": "refined_botanical_reagents",
                "qty": 1
              }
            ],
            "needsResearch": "botanical_extraction"
          }
        ]
      },
      {
        "id": "major_botanical_production",
        "label": "Major Botanical Production",
        "days": 8,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 5,
        "production": true,
        "options": [
          {
            "label": "Major Medicinal Harvest: Medicinal Herbs (3 lots)",
            "key": "major_medicinal_harvest",
            "days": 8,
            "outputs": [
              {
                "good": "medicinal_herbs",
                "qty": 3
              }
            ]
          },
          {
            "label": "Advanced Ingredient Cultivation: Restorative Herbs (30 portions)",
            "key": "advanced_restorative_herbs",
            "days": 8,
            "outputs": [
              {
                "good": "restorative_herbs",
                "qty": 30
              }
            ]
          },
          {
            "label": "Advanced Ingredient Cultivation: Antivenom Roots (30 portions)",
            "key": "advanced_antivenom_roots",
            "days": 8,
            "outputs": [
              {
                "good": "antivenom_roots",
                "qty": 30
              }
            ]
          },
          {
            "label": "Advanced Ingredient Cultivation: Toxic Blossoms (30 portions)",
            "key": "advanced_toxic_blossoms",
            "days": 8,
            "outputs": [
              {
                "good": "toxic_blossoms",
                "qty": 30
              }
            ]
          },
          {
            "label": "Advanced Ingredient Cultivation: Alchemical Flowers (30 portions)",
            "key": "advanced_alchemical_flowers",
            "days": 8,
            "outputs": [
              {
                "good": "alchemical_flowers",
                "qty": 30
              }
            ]
          },
          {
            "label": "Rare Botanical Extraction: Rare Botanical Extracts (1 lot)",
            "key": "rare_botanical_extraction",
            "days": 10,
            "inputs": [
              {
                "good": "alchemical_flowers",
                "qty": 20
              }
            ],
            "outputs": [
              {
                "good": "rare_botanical_extracts",
                "qty": 1
              }
            ],
            "needsResearch": "exotic_flora_conservatory"
          }
        ]
      }
    ]
  },
  {
    "name": "Fishery & Smokehouse",
    "id": "fishery_smokehouse",
    "requiredLevel": 5,
    "plot": true,
    "productionLimit": 1,
    "levelOrders": "replace",
    "functions": [
      {
        "id": "catch_fresh_fish",
        "label": "Catch Fresh Fish",
        "days": 3,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 1,
        "production": true,
        "options": [
          {
            "label": "Fresh Fish (1 lot)",
            "outputs": [
              {
                "good": "fresh_fish",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "smoke_salt_catch",
        "label": "Smoke / Salt Catch",
        "days": 3,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 2,
        "production": true,
        "options": [
          {
            "label": "Preserved Fish (1 lot)",
            "outputs": [
              {
                "good": "preserved_fish",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "prepare_expedition_provisions",
        "label": "Prepare Expedition Provisions",
        "days": 4,
        "costGP": 0,
        "costText": "0",
        "notes": "One pack is 10 character-days of rations: a party of five for two days.",
        "requiredFacilityLevel": 3,
        "production": true,
        "options": [
          {
            "label": "5 Expedition Provision Packs",
            "outputs": [
              {
                "good": "expedition_provision_pack",
                "qty": 5
              }
            ]
          }
        ]
      },
      {
        "id": "catch_premium_seafood",
        "label": "Catch Premium Seafood",
        "days": 6,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 4,
        "production": true,
        "options": [
          {
            "label": "Premium Seafood (1 lot)",
            "outputs": [
              {
                "good": "premium_seafood",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "commercial_fishing_fleet",
        "label": "Organise Commercial Fishing Fleet",
        "days": 8,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 5,
        "production": true,
        "options": [
          {
            "label": "Fresh Fish (3 lots)",
            "outputs": [
              {
                "good": "fresh_fish",
                "qty": 3
              }
            ]
          }
        ]
      },
      {
        "id": "bulk_smokehouse_production",
        "label": "Bulk Smokehouse Production",
        "days": 7,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 5,
        "production": true,
        "options": [
          {
            "label": "Preserved Fish (3 lots)",
            "outputs": [
              {
                "good": "preserved_fish",
                "qty": 3
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Timber Yard & Sawmill",
    "id": "timber_sawmill",
    "requiredLevel": 5,
    "plot": true,
    "productionLimit": 1,
    "levelOrders": "replace",
    "functions": [
      {
        "id": "harvest_timber",
        "label": "Harvest Timber",
        "days": 4,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 1,
        "production": true,
        "options": [
          {
            "label": "Raw Timber (1 lot)",
            "outputs": [
              {
                "good": "raw_timber",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "saw_lumber",
        "label": "Saw Lumber",
        "days": 4,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 2,
        "production": true,
        "options": [
          {
            "label": "Sawn Lumber (1 lot)",
            "outputs": [
              {
                "good": "sawn_lumber",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "prepare_construction_timber",
        "label": "Prepare Construction Timber",
        "days": 5,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 3,
        "production": true,
        "options": [
          {
            "label": "Construction Timber (1 lot)",
            "outputs": [
              {
                "good": "construction_timber",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "harvest_premium_hardwood",
        "label": "Harvest Premium Hardwood",
        "days": 7,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 4,
        "production": true,
        "options": [
          {
            "label": "Premium Hardwood (1 lot)",
            "outputs": [
              {
                "good": "premium_hardwood",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "major_timber_harvest",
        "label": "Major Timber Harvest",
        "days": 9,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 5,
        "production": true,
        "options": [
          {
            "label": "Raw Timber (3 lots)",
            "outputs": [
              {
                "good": "raw_timber",
                "qty": 3
              }
            ]
          }
        ]
      },
      {
        "id": "bulk_lumber_processing",
        "label": "Bulk Lumber Processing",
        "days": 8,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 5,
        "production": true,
        "options": [
          {
            "label": "Sawn Lumber (3 lots)",
            "outputs": [
              {
                "good": "sawn_lumber",
                "qty": 3
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Stone Quarry & Masonworks",
    "id": "stone_masonworks",
    "requiredLevel": 5,
    "plot": true,
    "productionLimit": 1,
    "levelOrders": "replace",
    "functions": [
      {
        "id": "extract_raw_stone",
        "label": "Extract Raw Stone",
        "days": 4,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 1,
        "production": true,
        "options": [
          {
            "label": "Raw Stone (1 lot)",
            "outputs": [
              {
                "good": "raw_stone",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "produce_dressed_stone",
        "label": "Produce Dressed Stone",
        "days": 4,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 2,
        "production": true,
        "options": [
          {
            "label": "Dressed Stone (1 lot)",
            "outputs": [
              {
                "good": "dressed_stone",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "produce_structural_masonry",
        "label": "Produce Structural Masonry",
        "days": 5,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 3,
        "production": true,
        "options": [
          {
            "label": "Structural Masonry (1 lot)",
            "outputs": [
              {
                "good": "structural_masonry",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "produce_decorative_stonework",
        "label": "Produce Decorative Stonework",
        "days": 7,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 4,
        "production": true,
        "options": [
          {
            "label": "Decorative Stonework (1 lot)",
            "outputs": [
              {
                "good": "decorative_stonework",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "bulk_raw_stone_extraction",
        "label": "Bulk Raw Stone Extraction",
        "days": 9,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 5,
        "production": true,
        "options": [
          {
            "label": "Raw Stone (3 lots)",
            "outputs": [
              {
                "good": "raw_stone",
                "qty": 3
              }
            ]
          }
        ]
      },
      {
        "id": "bulk_stone_processing",
        "label": "Bulk Stone Processing",
        "days": 8,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 5,
        "production": true,
        "options": [
          {
            "label": "Dressed Stone (3 lots)",
            "outputs": [
              {
                "good": "dressed_stone",
                "qty": 3
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Weavers' Hall",
    "id": "weavers_hall",
    "requiredLevel": 5,
    "plot": true,
    "productionLimit": 1,
    "levelOrders": "replace",
    "functions": [
      {
        "id": "produce_ordinary_textiles",
        "label": "Produce Ordinary Textiles",
        "days": 4,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 1,
        "production": true,
        "options": [
          {
            "label": "Ordinary Textiles (1 lot)",
            "outputs": [
              {
                "good": "ordinary_textiles",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "produce_sailcloth",
        "label": "Produce Sailcloth",
        "days": 4,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 2,
        "production": true,
        "options": [
          {
            "label": "Sailcloth (1 lot)",
            "outputs": [
              {
                "good": "sailcloth",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "produce_specialist_garments",
        "label": "Produce Specialist Garments",
        "days": 5,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 3,
        "production": true,
        "options": [
          {
            "label": "Specialist Garments (1 lot)",
            "outputs": [
              {
                "good": "specialist_garments",
                "qty": 1
              }
            ]
          }
        ]
      },
      {
        "id": "improved_specialist_garment_production",
        "label": "Improved Specialist Garment Production",
        "days": 7,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 4,
        "production": true,
        "options": [
          {
            "label": "Specialist Garments (2 lots)",
            "outputs": [
              {
                "good": "specialist_garments",
                "qty": 2
              }
            ]
          }
        ]
      },
      {
        "id": "bulk_textile_production",
        "label": "Bulk Textile Production",
        "days": 9,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 5,
        "production": true,
        "options": [
          {
            "label": "Ordinary Textiles (3 lots)",
            "outputs": [
              {
                "good": "ordinary_textiles",
                "qty": 3
              }
            ]
          }
        ]
      },
      {
        "id": "bulk_sailcloth_production",
        "label": "Bulk Sailcloth Production",
        "days": 8,
        "costGP": 0,
        "costText": "0",
        "notes": null,
        "requiredFacilityLevel": 5,
        "production": true,
        "options": [
          {
            "label": "Sailcloth (3 lots)",
            "outputs": [
              {
                "good": "sailcloth",
                "qty": 3
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Courier Exchange",
    "id": "courier_exchange",
    "requiredLevel": 5,
    "plot": true,
    "description": "Sends parcels of supplies from the Warehouse to a town, where they wait until the party collects them.",
    "functions": []
  },
  {
    "name": "Hall of Emissaries",
    "id": "hall_of_emissaries",
    "requiredLevel": 5,
    "threshold": "Political / Trade",
    "description": "A neutral hall for delegations, contracts, arbitration and inter-clan diplomacy.",
    "functions": [
      {
        "id": "upgrade_hall",
        "retired": true,
        "label": "Upgrade Hall (Level Up)",
        "days": 14,
        "costGP": 0,
        "special": {
          "type": "upgrade_facility",
          "maxLevel": 3,
          "costByNextLevel": {
            "2": 600,
            "3": 1200
          }
        }
      },
      {
        "id": "secure_trade_agreement",
        "label": "Secure Trade Agreement",
        "retiredNote": "The Secure Trade Agreement is retired; Port Charters replace it.",
        "days": 7,
        "costGP": 250,
        "requiredFacilityLevel": 1,
        "options": [
          {
            "label": "Clan Blackstone",
            "value": "Blackstone"
          },
          {
            "label": "Clan Rowthorn",
            "value": "Rowthorn"
          },
          {
            "label": "Clan Karr",
            "value": "Karr"
          },
          {
            "label": "Clan Farmer",
            "value": "Farmer"
          },
          {
            "label": "Clan Slade",
            "value": "Slade"
          },
          {
            "label": "Clan Bacca",
            "value": "Bacca"
          },
          {
            "label": "Clan Molten",
            "value": "Molten"
          }
        ],
        "special": {
          "type": "emissary_action",
          "kind": "trade_agreement",
          "durationDays": 21,
          "incomeMin": 60,
          "incomeMax": 140
        }
      },
      {
        "id": "host_delegation",
        "label": "Host Delegation",
        "days": 5,
        "costGP": 150,
        "requiredFacilityLevel": 1,
        "options": [
          {
            "label": "Clan Blackstone",
            "value": "Blackstone"
          },
          {
            "label": "Clan Rowthorn",
            "value": "Rowthorn"
          },
          {
            "label": "Clan Karr",
            "value": "Karr"
          },
          {
            "label": "Clan Farmer",
            "value": "Farmer"
          },
          {
            "label": "Clan Slade",
            "value": "Slade"
          },
          {
            "label": "Clan Bacca",
            "value": "Bacca"
          },
          {
            "label": "Clan Molten",
            "value": "Molten"
          }
        ],
        "special": {
          "type": "emissary_action",
          "kind": "host_delegation",
          "durationDays": 14,
          "oneTimeTreasuryMin": 80,
          "oneTimeTreasuryMax": 220
        }
      },
      {
        "id": "inter_clan_summit",
        "label": "Inter-Clan Summit",
        "days": 14,
        "costGP": 450,
        "requiredFacilityLevel": 2,
        "options": [
          {
            "label": "Blackstone + Rowthorn",
            "value": "Blackstone/Rowthorn"
          },
          {
            "label": "Blackstone + Karr",
            "value": "Blackstone/Karr"
          },
          {
            "label": "Rowthorn + Karr",
            "value": "Rowthorn/Karr"
          },
          {
            "label": "Farmer + Slade",
            "value": "Farmer/Slade"
          },
          {
            "label": "Bacca + Molten",
            "value": "Bacca/Molten"
          }
        ],
        "special": {
          "type": "emissary_action",
          "kind": "summit",
          "durationDays": 21,
          "costReductionPct": 25
        }
      },
      {
        "id": "arbitration_authority",
        "label": "Secure Writ of Authority",
        "days": 10,
        "costGP": 600,
        "requiredFacilityLevel": 3,
        "special": {
          "type": "emissary_action",
          "kind": "arbitration",
          "durationDays": 28,
          "incomeMin": 90,
          "incomeMax": 190
        }
      },
      {
        "id": "trade_consortium",
        "label": "Trade Consortium",
        "days": 14,
        "costGP": 900,
        "requiredFacilityLevel": 3,
        "special": {
          "type": "emissary_action",
          "kind": "consortium",
          "durationDays": 35,
          "incomeMin": 140,
          "incomeMax": 260
        }
      }
    ]
  },
  {
    "name": "Menagerie",
    "id": "menagerie",
    "requiredLevel": 13,
    "functions": [
      {
        "id": "recruit_beast",
        "label": "Recruit Beast",
        "days": 10,
        "options": [
          {
            "label": "Ape",
            "costGP": 500,
            "costText": "500 GP"
          },
          {
            "label": "Black Bear",
            "costGP": 500,
            "costText": "500 GP"
          },
          {
            "label": "Brown Bear",
            "costGP": 1000,
            "costText": "1,000 GP"
          },
          {
            "label": "Constrictor Snake",
            "costGP": 250,
            "costText": "250 GP"
          },
          {
            "label": "Crocodile",
            "costGP": 500,
            "costText": "500 GP"
          },
          {
            "label": "Dire Wolf",
            "costGP": 1000,
            "costText": "1,000 GP"
          },
          {
            "label": "Giant Vulture",
            "costGP": 1000,
            "costText": "1,000 GP"
          },
          {
            "label": "Hyena",
            "costGP": 50,
            "costText": "50 GP"
          },
          {
            "label": "Jackal",
            "costGP": 50,
            "costText": "50 GP"
          },
          {
            "label": "Lion",
            "costGP": 1000,
            "costText": "1,000 GP"
          },
          {
            "label": "Owlbear",
            "costGP": 3500,
            "costText": "3,500 GP"
          },
          {
            "label": "Panther",
            "costGP": 250,
            "costText": "250 GP"
          },
          {
            "label": "Tiger",
            "costGP": 1000,
            "costText": "1,000 GP"
          }
        ],
        "costGP": null,
        "costText": "500 GP\n500 GP\n1,000 GP\n250 GP\n500 GP\n1,000 GP\n1,000 GP\n50 GP\n50 GP\n1,000 GP\n3,500 GP\n250 GP\n1,000 GP",
        "notes": "Recruited Beasts are listed in the Bastion Defenders Panel"
      }
    ]
  },
  {
    "name": "Beast Pen",
    "id": "beast_pen",
    "requiredLevel": 5,
    "singleLevel": true,
    "description": "Home to the party's beasts: one wyvern, one griffin, one dire wolf, one buckbear and one fellcat. A beast that has been acclimatised can go out on the road with its handler, and bonds with them day by day.",
    "functions": [
      {
        "id": "house_beast",
        "label": "House Beast Here",
        "days": 3,
        "costGP": 0,
        "costText": "0",
        "housesSpecies": "*",
        "options": [],
        "notes": "Gives a home to a beast the DM granted in the Explorer. The Beast Pen keeps one beast of each kind (wyvern, griffin, dire wolf, buckbear and fellcat). Housing a beast never makes one: the DM grants it. No gold and no roll."
      },
      {
        "id": "acclimatise",
        "label": "Acclimatise With Beast",
        "days": 1,
        "instant": true,
        "costGP": 0,
        "costText": "0",
        "acclimatise": true,
        "options": [],
        "notes": "A beast housed here must be acclimatised with its handler before it can bond. The handler rolls Animal Handling at the table; you type their total. A pass makes it Bond 1 and it leaves this list. A fail locks that beast for 3 days. The DC is in the data (creatures-data.js), 20 for every kind. It happens at once, with no days."
      }
    ]
  },
  {
    "name": "Shrine of Telluria",
    "id": "shrine_telluria",
    "requiredLevel": 8,
    "functions": [
      {
        "id": "craft",
        "label": "Craft",
        "days": 5,
        "options": [
          {
            "label": "Tellurian Root Charm",
            "notes": "Advantage on CON saving throws once per short rest. Value = 100gp."
          },
          {
            "label": "Tellurian Stone Charm",
            "notes": "Advantage on WIS saving throws once per short rest when on natural ground (earth, rock, etc). Value = 120gp."
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null
      },
      {
        "id": "pray",
        "label": "Pray",
        "days": 1,
        "options": [
          {
            "label": "Telluria's Guidance",
            "special": {
              "type": "oracle_hint",
              "god": "telluria"
            }
          },
          {
            "label": "Telluria's Embrace",
            "special": {
              "type": "blessing_rest",
              "god": "telluria"
            }
          },
          {
            "label": "Telluria's Blessing",
            "special": {
              "type": "favour_blessing",
              "god": "telluria"
            }
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null
      },
      {
        "id": "prepare_earthward_talisman",
        "label": "Prepare Earthward Talisman",
        "days": 3,
        "costGP": 0,
        "costText": "0",
        "requiredFacilityLevel": 2,
        "favourCost": 0,
        "production": true,
        "options": [
          {
            "label": "1 Earthward Talisman",
            "outputs": [
              {
                "good": "earthward_talisman",
                "qty": 1
              }
            ]
          }
        ],
        "notes": "One talisman, into the Warehouse: +2 to one saving throw against a nonmagical natural-terrain hazard. The Courier Exchange can send it to the party."
      },
      {
        "id": "prepare_rootguard_salve",
        "label": "Prepare Rootguard Salve",
        "days": 4,
        "costGP": 0,
        "costText": "5% Favour",
        "requiredFacilityLevel": 3,
        "favourCost": 5,
        "production": true,
        "options": [
          {
            "label": "2 doses of Rootguard Salve",
            "outputs": [
              {
                "good": "rootguard_salve",
                "qty": 2
              }
            ]
          }
        ],
        "notes": "Two doses, into the Warehouse: each gives advantage on one saving throw against being Restrained by nonmagical vegetation. Takes 5% of Telluria's Favour when it starts."
      },
      {
        "id": "bless_bastion_foundations",
        "label": "Bless Bastion Foundations",
        "days": 5,
        "costGP": 0,
        "costText": "10% Favour",
        "requiredFacilityLevel": 4,
        "favourCost": 10,
        "waiting": "Not available yet: no Bastion event damages a facility by natural causes yet (an attack's damage never counts). This order opens once one exists.",
        "notes": "One charge, kept at the Ironbow: it prevents one facility going Under Repair from an environmental cause. It never prevents damage from a military defeat."
      },
      {
        "id": "great_rite_telluria",
        "label": "Great Rite of Telluria",
        "days": 7,
        "costGP": 0,
        "costText": "25% Favour",
        "requiredFacilityLevel": 5,
        "favourCost": 25,
        "greatRite": "earths_endurance",
        "notes": "Earth's Endurance: one Major Expedition Blessing. It waits at the Ironbow until the DM gives it to the party on an expedition; then it prevents one level of Exhaustion from a failed travel or environmental saving throw, once."
      }
    ]
  },
  {
    "name": "Shrine of Aurush",
    "id": "shrine_aurush",
    "requiredLevel": 8,
    "functions": [
      {
        "id": "craft",
        "label": "Craft",
        "days": 5,
        "options": [
          {
            "label": "Aurush Sun Charm",
            "notes": "Advantage on DEX saving throws once per short rest while in bright light. Value = 100gp."
          },
          {
            "label": "Aurush Ember Charm",
            "notes": "Advantage on CHA saving throws once per short rest against fear or charm. Value = 120gp."
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null
      },
      {
        "id": "pray",
        "label": "Pray",
        "days": 1,
        "options": [
          {
            "label": "Aurush's Insight",
            "special": {
              "type": "oracle_hint",
              "god": "aurush"
            }
          },
          {
            "label": "Aurush's Radiance",
            "special": {
              "type": "blessing_rest",
              "god": "aurush"
            }
          },
          {
            "label": "Aurush's Blessing",
            "special": {
              "type": "favour_blessing",
              "god": "aurush"
            }
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null
      },
      {
        "id": "prepare_blessed_lantern",
        "label": "Prepare Blessed Lantern",
        "days": 3,
        "costGP": 0,
        "costText": "0",
        "requiredFacilityLevel": 2,
        "favourCost": 0,
        "production": true,
        "options": [
          {
            "label": "1 Blessed Lantern",
            "outputs": [
              {
                "good": "blessed_lantern",
                "qty": 1
              }
            ]
          }
        ],
        "notes": "One lantern, into the Warehouse: fuel-free light, 20 ft bright and 20 ft dim, for three days. The Courier Exchange can send it to the party."
      },
      {
        "id": "prepare_purification_incense",
        "label": "Prepare Purification Incense",
        "days": 4,
        "costGP": 0,
        "costText": "5% Favour",
        "requiredFacilityLevel": 3,
        "favourCost": 5,
        "production": true,
        "options": [
          {
            "label": "2 portions of Purification Incense",
            "outputs": [
              {
                "good": "purification_incense",
                "qty": 2
              }
            ]
          }
        ],
        "notes": "Two portions, into the Warehouse: each gives advantage on one saving throw against nonmagical poison or disease. Takes 5% of Aurush's Favour when it starts."
      },
      {
        "id": "consecrate_expedition_supplies",
        "label": "Consecrate Expedition Supplies",
        "days": 5,
        "costGP": 0,
        "costText": "10% Favour",
        "requiredFacilityLevel": 4,
        "favourCost": 10,
        "production": true,
        "options": [
          {
            "label": "3 Cleansing Portions",
            "outputs": [
              {
                "good": "cleansing_portion",
                "qty": 3
              }
            ]
          }
        ],
        "notes": "Three Cleansing Portions, into the Warehouse: each removes the ordinary Poisoned condition from one creature (no hit points, and no disease or curse cured). Takes 10% of Aurush's Favour when it starts."
      },
      {
        "id": "great_rite_aurush",
        "label": "Great Rite of Aurush",
        "days": 7,
        "costGP": 0,
        "costText": "25% Favour",
        "requiredFacilityLevel": 5,
        "favourCost": 25,
        "greatRite": "cleansing_radiance",
        "notes": "Cleansing Radiance: one Major Expedition Blessing. It waits at the Ironbow until the DM gives it to the party on an expedition; then it removes Poisoned or Frightened from up to two party members present, once."
      }
    ]
  },
  {
    "name": "Shrine of Pelagos",
    "id": "shrine_pelagos",
    "requiredLevel": 8,
    "functions": [
      {
        "id": "craft",
        "label": "Craft",
        "days": 5,
        "options": [
          {
            "label": "Pelagos Tide Charm",
            "notes": "Advantage on STR saving throws once per short rest while wet or near open water. Value = 100gp."
          },
          {
            "label": "Pelagos Current Charm",
            "notes": "Advantage on INT saving throws once per short rest to resist disorientation/illusion. Value = 120gp."
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null
      },
      {
        "id": "pray",
        "label": "Pray",
        "days": 1,
        "options": [
          {
            "label": "Pelagos's Tidings",
            "special": {
              "type": "oracle_hint",
              "god": "pelagos"
            }
          },
          {
            "label": "Pelagos's Deep Rest",
            "special": {
              "type": "blessing_rest",
              "god": "pelagos"
            }
          },
          {
            "label": "Pelagos's Blessing",
            "special": {
              "type": "favour_blessing",
              "god": "pelagos"
            }
          }
        ],
        "costGP": 0,
        "costText": "0",
        "notes": null
      },
      {
        "id": "bless_voyage",
        "label": "Bless Voyage",
        "days": 3,
        "costGP": 0,
        "costText": "0",
        "requiredFacilityLevel": 2,
        "favourCost": 0,
        "production": true,
        "options": [
          {
            "label": "1 Voyage Blessing",
            "outputs": [
              {
                "good": "voyage_blessing",
                "qty": 1
              }
            ]
          }
        ],
        "notes": "One blessing, into the Warehouse: +2 to one navigation or maritime hazard check during an expedition. The Courier Exchange can send it to the party."
      },
      {
        "id": "prepare_aquatic_protection_charm",
        "label": "Prepare Aquatic Protection Charm",
        "days": 4,
        "costGP": 0,
        "costText": "5% Favour",
        "requiredFacilityLevel": 3,
        "favourCost": 5,
        "production": true,
        "options": [
          {
            "label": "1 Aquatic Protection Charm",
            "outputs": [
              {
                "good": "aquatic_protection_charm",
                "qty": 1
              }
            ]
          }
        ],
        "notes": "One charm, into the Warehouse: advantage on one Athletics check involving swimming, currents or a nonmagical water hazard. Takes 5% of Pelagos' Favour when it starts."
      },
      {
        "id": "bless_commercial_shipment",
        "label": "Bless Commercial Shipment",
        "days": 5,
        "costGP": 0,
        "costText": "10% Favour",
        "requiredFacilityLevel": 4,
        "favourCost": 10,
        "protectionCharge": "pelagos_blessing",
        "notes": "One Blessing of Pelagos, kept at the Ironbow: the next ship the Dock sends with cargo takes it, and its chance of trouble at sea is 10 points lower. Takes 10% of Pelagos' Favour when it starts."
      },
      {
        "id": "great_rite_pelagos",
        "label": "Great Rite of Pelagos",
        "days": 7,
        "costGP": 0,
        "costText": "25% Favour",
        "requiredFacilityLevel": 5,
        "favourCost": 25,
        "greatRite": "tides_passage",
        "notes": "Tide's Passage: one Major Expedition Blessing. It waits at the Ironbow until the DM gives it to the party on an expedition; then it turns one failed water-related navigation or environmental check into a success, once."
      }
    ]
  }
];
