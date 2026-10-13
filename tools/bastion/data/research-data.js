/* The Ironbow Bastion Manager — research trees (the facilities overhaul's
   pull request 2, 13 October 2026).

   Harry's rules: a facility's research opens at Level 2. It earns one
   research token for each level it reaches (Levels 2, 3, 4 and 5: four in
   all). Each tree has four branches; each branch has three stages; each
   stage offers two choices, and only one can be taken. A stage opens once
   the stage before it on that branch is done. Stage I takes 7 days, Stage
   II 14 and Stage III 21; each stage also costs gold (the branch's "costs").
   One research project runs at a time at a facility. A choice can be undone
   for its token back (the stages above it on that branch go too).

   Each choice's "effects" are from a fixed list the Bastion's rules know
   (tools/bastion/rules.js, "Research"); nothing in a save is ever run:
   - faster: the facility's orders "fns" take "days" fewer days, never
     fewer than "min" (the biggest saving applies, not the total);
   - yield: the batches "keys" of order "fn" produce "pct"% more, rounded
     up (the biggest applies);
   - batch: the batch "key" of order "fn" starts at "qty" instead;
   - output: the item "key" of order "fn" comes "count" at a time.
   A choice with "needs" can't be researched yet: what it does needs a part
   of the Bastion still to be built (the "needs" table says which).

   The Herbal Gardens tree is Harry's first attempt, from the planning AI's
   document (13 October 2026; not canon), costs included. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.bastionResearch = {
  stageDays: [7, 14, 21],
  needs: {
    goods: 'the goods catalogue (pull request 3)',
    explorer: 'the Explorer link, which tracks each hero\'s conditions (pull request 4)',
    trade: 'trade in goods (pull requests 3 and 5)'
  },
  trees: {
    herbal_gardens: {
      intro: 'The Herbal Gardens grows and prepares botanical products; the Arcane Laboratory specialises in chemical and magical manufacturing.',
      branches: [
        {
          id: 'agricultural',
          name: 'Agricultural Development',
          focus: 'Harvest yields, agricultural efficiency and production speed.',
          costs: [150, 350, 750],
          stages: [
            {
              name: 'Improved Cultivation',
              choices: [
                {
                  id: 'fertile_soil', name: 'Fertile Soil',
                  text: 'Standard food and common-herb harvests produce 25% more goods.',
                  example: 'A 100-ration harvest produces 125 rations.',
                  now: 'Harvest\'s Rations and Antitoxin.',
                  effects: [{ type: 'yield', fn: 'harvest', keys: ['rations', 'antitoxin'], pct: 25 }]
                },
                {
                  id: 'efficient_planting', name: 'Efficient Planting',
                  text: 'Basic harvesting orders complete 1 day sooner, to a minimum of 2 days.',
                  example: 'A 7-day harvest takes 6 days.',
                  now: 'Harvest.',
                  effects: [{ type: 'faster', fns: ['harvest'], days: 1, min: 2 }]
                }
              ]
            },
            {
              name: 'Advanced Agriculture',
              choices: [
                {
                  id: 'intensive_cultivation', name: 'Intensive Cultivation',
                  text: 'Common harvests produce 50% more goods, and specialist plant cultivation produces one additional botanical ingredient per order.',
                  example: '100 rations become 150, or 2 units of a specialist plant become 3.',
                  now: 'Harvest\'s Rations and Antitoxin; the specialist plants come with the goods catalogue (pull request 3).',
                  effects: [{ type: 'yield', fn: 'harvest', keys: ['rations', 'antitoxin'], pct: 50 }]
                },
                {
                  id: 'crop_rotation', name: 'Crop Rotation',
                  text: 'All Herbal Gardens harvesting and cultivation orders complete 2 days sooner, to a minimum of 2 days.',
                  example: 'A 10-day cultivation order takes 8 days.',
                  now: 'Harvest and Greenhouse Harvest.',
                  effects: [{ type: 'faster', fns: ['harvest', 'cultivate'], days: 2, min: 2 }]
                }
              ]
            },
            {
              name: 'Agricultural Mastery',
              choices: [
                {
                  id: 'bountiful_harvests', name: 'Bountiful Harvests',
                  text: 'Common harvests produce 100% more goods, and specialist plant cultivation produces 50% more ingredients, rounded up.',
                  example: 'A 100-ration harvest becomes 200, while 2 uncommon botanical ingredients become 3.',
                  now: 'Harvest\'s Rations and Antitoxin; the specialist plants come with the goods catalogue (pull request 3).',
                  effects: [{ type: 'yield', fn: 'harvest', keys: ['rations', 'antitoxin'], pct: 100 }]
                },
                {
                  id: 'perpetual_growing_cycle', name: 'Perpetual Growing Cycle',
                  text: 'All standard Herbal Gardens production orders complete 3 days sooner, to a minimum of 2 days.',
                  example: 'A 7-day order takes 4 days; a 10-day order takes 7.',
                  now: 'Harvest and Greenhouse Harvest.',
                  effects: [{ type: 'faster', fns: ['harvest', 'cultivate'], days: 3, min: 2 }]
                }
              ]
            }
          ]
        },
        {
          id: 'medicine',
          name: 'Herbal Medicine',
          focus: 'Improved healing supplies, protection from conditions and restorative treatment.',
          costs: [200, 450, 950],
          stages: [
            {
              name: 'Apothecary\'s Craft',
              choices: [
                {
                  id: 'healing_herb_refinement', name: 'Healing Herb Refinement',
                  text: 'Orders producing ordinary Potions of Healing produce 2 potions instead of 1, at the normal cost. Greater and more powerful potions are not affected.',
                  now: 'Harvest\'s Potion of Healing.',
                  effects: [{ type: 'output', fn: 'harvest', key: 'potion_of_healing', count: 2 }]
                },
                {
                  id: 'improved_antitoxins', name: 'Improved Antitoxins',
                  text: 'Antitoxin production yields 4 vials instead of 2.',
                  now: 'Harvest\'s Antitoxin.',
                  effects: [{ type: 'batch', fn: 'harvest', key: 'antitoxin', qty: 4 }]
                }
              ]
            },
            {
              name: 'Restorative Medicine',
              choices: [
                {
                  id: 'concentrated_restoratives', name: 'Concentrated Restoratives',
                  text: 'Greater Potion of Healing production produces 2 potions instead of 1.',
                  now: 'Greenhouse Harvest\'s Greater Potion of Healing.',
                  effects: [{ type: 'output', fn: 'cultivate', key: 'greater_potion_of_healing', count: 2 }]
                },
                {
                  id: 'fortifying_draughts', name: 'Fortifying Draughts',
                  text: 'Unlocks an Advanced Remedies recipe producing 2 Fortifying Draughts per order. A draught grants +2 to one Constitution saving throw against travel exhaustion or severe weather, used up when it applies.',
                  needs: 'explorer'
                }
              ]
            },
            {
              name: 'Master Herbalism',
              choices: [
                {
                  id: 'master_healers_treatment', name: 'Master Healer\'s Treatment',
                  text: 'Unlocks a treatment order for a character at Ironbow: over 3 days, clear one supported nonmagical disease, recover from a qualifying injury, or remove one level of Exhaustion. Doesn\'t remove curses, permanent disabilities or conditions needing a magical cure.',
                  needs: 'explorer'
                },
                {
                  id: 'emergency_restoration', name: 'Emergency Restoration',
                  text: 'Unlocks a remedy that cancels one new level of Exhaustion from a failed travel or weather check in the Explorer. 2 per order; at most one use per character every 7 days.',
                  needs: 'explorer'
                }
              ]
            }
          ]
        },
        {
          id: 'botanical',
          name: 'Botanical Research',
          focus: 'Rare flora, specialist ingredients, experimental plant products and unusual extracts, especially for the Arcane Laboratory.',
          costs: [200, 500, 1100],
          stages: [
            {
              name: '',
              choices: [
                {
                  id: 'specialist_seedbeds', name: 'Specialist Seedbeds',
                  text: 'Every Cultivate Specialist Plants order produces 1 additional uncommon botanical ingredient.',
                  needs: 'goods'
                },
                {
                  id: 'botanical_extraction', name: 'Botanical Extraction',
                  text: 'Unlocks Prepare Botanical Extracts: turn 1 uncommon botanical ingredient into 2 Herbal Reagents, usable in place of standard herbal reagents in eligible Arcane Laboratory recipes.',
                  needs: 'goods'
                }
              ]
            },
            {
              name: '',
              choices: [
                {
                  id: 'rare_cultivar_development', name: 'Rare Cultivar Development',
                  text: 'Every second specialist cultivation order also produces 1 Rare Cultivar, a higher-grade ingredient for advanced restorative or alchemical recipes.',
                  needs: 'goods'
                },
                {
                  id: 'environmental_adaptation_extracts', name: 'Environmental Adaptation Extracts',
                  text: 'Unlocks Heatward and Frostward extracts, 2 per order. Each gives +2 to one matching weather Constitution save in the Explorer, then is used up.',
                  needs: 'explorer'
                }
              ]
            },
            {
              name: '',
              choices: [
                {
                  id: 'exotic_flora_conservatory', name: 'Exotic Flora Conservatory',
                  text: 'Unlocks Cultivate Exotic Flora: 2 Exotic Botanical Catalysts per order, needed by high-tier alchemical recipes, or sold as premium trade goods.',
                  needs: 'goods'
                },
                {
                  id: 'universal_purifier', name: 'Universal Purifier',
                  text: 'Unlocks Broad-Spectrum Antidote, 2 doses per order. A dose removes the ordinary Poisoned condition, but doesn\'t reverse poison damage or cure magical afflictions.',
                  needs: 'explorer'
                }
              ]
            }
          ]
        },
        {
          id: 'commercial',
          name: 'Commercial Cultivation',
          focus: 'Botanical trade goods, shipment quantities, pricing and Clan commercial influence.',
          costs: [250, 600, 1300],
          stages: [
            {
              name: '',
              choices: [
                {
                  id: 'dried_herb_packaging', name: 'Dried Herb Packaging',
                  text: 'Turn one common-herb harvest into 1 Small Dried-Herb Cargo Lot (base value 90 gp), for trade routes.',
                  needs: 'trade'
                },
                {
                  id: 'seedling_merchants', name: 'Seedling Merchants',
                  text: 'Unlocks Prepare Seedling Consignment: turn one common-herb harvest into 1 Small Medicinal-Seedling Cargo Lot (base value 110 gp), with its own Clan demand.',
                  needs: 'trade'
                }
              ]
            },
            {
              name: '',
              choices: [
                {
                  id: 'bulk_cultivation', name: 'Bulk Cultivation',
                  text: 'Harvest Commercial Medicinal Crops (Level 4) produces 2 cargo lots instead of 1.',
                  needs: 'trade'
                },
                {
                  id: 'premium_botanical_grading', name: 'Premium Botanical Grading',
                  text: 'Herbal Gardens botanical goods sell for 20% more (on their base value), once the cargo has arrived.',
                  needs: 'trade'
                }
              ]
            },
            {
              name: '',
              choices: [
                {
                  id: 'commercial_plantation', name: 'Commercial Plantation',
                  text: 'Commercial medicinal crop orders produce 2 more cargo lots (up to 4 with Bulk Cultivation). Shipments still need stock and route capacity.',
                  needs: 'trade'
                },
                {
                  id: 'herbalist_guild_contracts', name: 'Herbalist Guild Contracts',
                  text: 'Botanical cargo sells for 30% more instead. Three successful botanical shipments to the same Clan give +1 Honour/Respect with it, once per Clan.',
                  needs: 'trade'
                }
              ]
            }
          ]
        }
      ]
    }
  }
};
