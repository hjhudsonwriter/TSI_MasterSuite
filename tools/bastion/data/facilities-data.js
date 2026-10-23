/* The Ironbow Bastion Manager: the 15 facilities, their functions, options, costs and specials.
   A copy of the old tool's data/facilities.json, stored as a script so it
   loads from a double-clicked file. Edit it here.
   The Strip Back Overhaul (Harry, 22 October 2026, step S06): the war game is gone, and
   with it five facilities: the Barracks, Armoury and Watchtower (starting facilities),
   the War Room and the Menagerie. Their blocks are deleted; a Bastion that had them is
   converted once (R.migrateToV4, strip-back-rules.js: their orders are cancelled with
   what they cost given back, the slots are freed). To see them again, check out commit
   4f1db26.
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
        "id": "register_port_charter",
        "label": "Register Port Charter",
        "days": 3,
        "costGP": 0,
        "costText": "0",
        "requiredFacilityLevel": 1,
        "portCharter": true,
        "options": [],
        "notes": "Registers a Port Charter the DM granted in the Explorer, so the Dock can ship cargo to that port. No gold and no roll."
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
        "notes": "A beast housed here must be acclimatised with its handler before it can bond. The handler rolls at the table; you type their total. A pass makes it Bond 1 and it leaves this list. A fail locks that beast for a few days. It happens at once, with no days."
      }
    ]
  },
  /* The Temple (the Strip Back Overhaul, Harry, 22 October 2026, step S11). The three Shrines (Telluria, Aurush
     and Pelagos) became ONE building. It takes a construction slot, needs party level 8 and takes 21 days to build
     ("requiredLevel": 8), and has one level only ("singleLevel": true: no Upgrade row). Its panel is split into
     thirds, one for each god, and nothing in it is an order with days:
     - Pray to (god) is instant: it adds a random whole number from 1 to "prayDie" (50) to that god's Favour bar,
       which stops at 100. The roll is the Bastion's own (temple-rules.js, R.templePray).
     - Receive Blessing is instant too, and only possible when the god's bar is full ("full": 100). It spends the
       WHOLE bar (the bar goes back to 0) and the chosen blessing happens at once (R.templeReceive).
     The three blessings for each god are the functions below that name the god ("god"), in the order the dropdown
     lists them. Goods blessings ("production": true, with an option listing "outputs") go into the Warehouse,
     "protectionCharge" keeps a Blessing of Pelagos for the Dock's next ship, and "greatRite" makes a Great Rite
     that waits at the Ironbow until the DM gives it to the party on an expedition in the Explorer.
     "days" on a blessing is only used by a pending order carried over from an old Shrine (the conversion, step
     shrinesToTemple in strip-back-rules.js, moves the Shrines' Bless, Prepare and Great Rite orders here, keeping
     their due days; their function ids are the same as the Shrines' were, so they complete as before).
     The Craft charms, the hint and long-rest prayers, Purification Incense, the Aquatic Protection Charm and Bless
     Bastion Foundations are gone. Their goods (and the Courier's and the Travel bags' names for them) stay, so
     anything already made keeps its name. */
  {
    "name": "Temple",
    "id": "temple",
    "requiredLevel": 8,
    "singleLevel": true,
    "description": "One Temple for the three gods. Each god has a Favour bar: Pray to the god adds to it, and once it is full the god gives a blessing, which spends the whole bar.",
    "temple": {
      "full": 100,
      "prayDie": 50,
      "gods": [
        { "id": "telluria", "name": "Telluria", "art": "shrine_of_telluria.png" },
        { "id": "aurush", "name": "Aurush", "art": "shrine_of_aurush.png" },
        { "id": "pelagos", "name": "Pelagos", "art": "shrine_of_pelagos.png" }
      ]
    },
    "functions": [
      {
        "id": "prepare_earthward_talisman",
        "label": "Earthward Talisman",
        "god": "telluria",
        "blessing": true,
        "instant": true,
        "days": 3,
        "costGP": 0,
        "costText": "The whole bar",
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
        "label": "Rootguard Salve",
        "god": "telluria",
        "blessing": true,
        "instant": true,
        "days": 4,
        "costGP": 0,
        "costText": "The whole bar",
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
        "notes": "Two doses, into the Warehouse: each gives advantage on one saving throw against being Restrained by nonmagical vegetation."
      },
      {
        "id": "great_rite_telluria",
        "label": "Great Rite of Telluria",
        "god": "telluria",
        "blessing": true,
        "instant": true,
        "days": 7,
        "costGP": 0,
        "costText": "The whole bar",
        "greatRite": "earths_endurance",
        "notes": "Earth's Endurance: one Major Expedition Blessing. It waits at the Ironbow until the DM gives it to the party on an expedition; then it prevents one level of Exhaustion from a failed travel or environmental saving throw, once."
      },
      {
        "id": "prepare_blessed_lantern",
        "label": "Blessed Lantern",
        "god": "aurush",
        "blessing": true,
        "instant": true,
        "days": 3,
        "costGP": 0,
        "costText": "The whole bar",
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
        "id": "consecrate_expedition_supplies",
        "label": "Consecrate Expedition Supplies",
        "god": "aurush",
        "blessing": true,
        "instant": true,
        "days": 5,
        "costGP": 0,
        "costText": "The whole bar",
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
        "notes": "Three Cleansing Portions, into the Warehouse: each removes the ordinary Poisoned condition from one creature (no hit points, and no disease or curse cured)."
      },
      {
        "id": "great_rite_aurush",
        "label": "Great Rite of Aurush",
        "god": "aurush",
        "blessing": true,
        "instant": true,
        "days": 7,
        "costGP": 0,
        "costText": "The whole bar",
        "greatRite": "cleansing_radiance",
        "notes": "Cleansing Radiance: one Major Expedition Blessing. It waits at the Ironbow until the DM gives it to the party on an expedition; then it removes Poisoned or Frightened from up to two party members present, once."
      },
      {
        "id": "bless_voyage",
        "label": "Voyage Blessing",
        "god": "pelagos",
        "blessing": true,
        "instant": true,
        "days": 3,
        "costGP": 0,
        "costText": "The whole bar",
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
        "id": "bless_commercial_shipment",
        "label": "Bless Commercial Shipment",
        "god": "pelagos",
        "blessing": true,
        "instant": true,
        "days": 5,
        "costGP": 0,
        "costText": "The whole bar",
        "protectionCharge": "pelagos_blessing",
        "notes": "One Blessing of Pelagos, kept at the Ironbow: the next ship the Dock sends with cargo takes it, and its chance of trouble at sea is 10 points lower."
      },
      {
        "id": "great_rite_pelagos",
        "label": "Great Rite of Pelagos",
        "god": "pelagos",
        "blessing": true,
        "instant": true,
        "days": 7,
        "costGP": 0,
        "costText": "The whole bar",
        "greatRite": "tides_passage",
        "notes": "Tide's Passage: one Major Expedition Blessing. It waits at the Ironbow until the DM gives it to the party on an expedition; then it turns one failed water-related navigation or environmental check into a success, once."
      }
    ]
  }
];
