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
   the Fishery & Smokehouse and Timber Yard & Sawmill buildable, and five since pull
   request 6 (14 October 2026) made the Courier Exchange buildable. Old saves are
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
   Fishery & Smokehouse and Timber Yard & Sawmill do. */
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
            "inputs": [
              {
                "good": "fresh_fish",
                "qty": 1
              }
            ],
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
            "inputs": [
              {
                "good": "preserved_fish",
                "qty": 1
              }
            ],
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
            "inputs": [
              {
                "good": "fresh_fish",
                "qty": 3
              }
            ],
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
            "inputs": [
              {
                "good": "raw_timber",
                "qty": 1
              }
            ],
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
            "inputs": [
              {
                "good": "sawn_lumber",
                "qty": 1
              }
            ],
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
            "inputs": [
              {
                "good": "raw_timber",
                "qty": 3
              }
            ],
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
    "requiredLevel": null,
    "plot": true,
    "inDevelopment": true,
    "functions": []
  },
  {
    "name": "Weavers' Hall",
    "id": "weavers_hall",
    "requiredLevel": null,
    "plot": true,
    "inDevelopment": true,
    "functions": []
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
      },
      {
        "id": "register_port_charter",
        "label": "Register Port Charter",
        "days": 3,
        "costGP": 0,
        "costText": "0",
        "requiredFacilityLevel": 2,
        "portCharter": true,
        "options": [],
        "notes": "Registers a Port Charter the DM granted in the Explorer, so the Dock can ship cargo to that port. No gold and no roll."
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
    "name": "Wyvern Roost",
    "id": "wyvern_roost",
    "requiredLevel": null,
    "inDevelopment": true,
    "functions": []
  },
  {
    "name": "Griffin Tower",
    "id": "griffin_tower",
    "requiredLevel": null,
    "inDevelopment": true,
    "functions": []
  },
  {
    "name": "Dire Wolf Den",
    "id": "dire_wolf_den",
    "requiredLevel": null,
    "inDevelopment": true,
    "functions": []
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
      }
    ]
  }
];
