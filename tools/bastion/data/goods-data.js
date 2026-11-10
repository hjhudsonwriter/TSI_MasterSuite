/* The Ironbow Bastion Manager — the goods catalogue (the facilities
   overhaul's pull request 3, 13 October 2026).

   From Harry's facility guide ("Ironbow Facilities: Recommended Decisions",
   13 October 2026). Every good has a stable id (saves keep the id, so a
   name can change here without breaking anything), a display name, what
   one counts as, and (for trade goods) a base value per lot, before Clan
   demand, shipping and tariffs. Goods sit in the Warehouse as rows with a
   "goodId", beside the free rows typed by hand. Cargo turns into gold when
   a Dock ship sells it at a port with a Port Charter (pull request 5,
   commerce-data.js).

   kind:
   - cargo: a trade good, counted in lots ("lot" says what one lot holds),
     with its kind (cat: fish, timber, stone, cloth or herbal), for
     grouping on screen (a Clan's demand is set good by good, by id, in
     commerce-data.js);
   - ingredient: a crafting ingredient, counted in portions (one batch from
     the Herbal Gardens is "batch" portions);
   - supply: a supply for the party, counted in packs (or in its own
     "unit", such as charts), with a line on what one is. Supplies never
     sail with the Dock; the Courier Exchange can send them to the party
     (courier-data.js says which).
   Edit the numbers here to rebalance: nothing else needs changing. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.bastionGoods = {
  goods: [
    { id: 'fresh_fish', name: 'Fresh Fish', kind: 'cargo', cat: 'fish', lot: '100 fish', gp: 80 },
    { id: 'preserved_fish', name: 'Preserved Fish', kind: 'cargo', cat: 'fish', lot: '50 ration-equivalents', gp: 150 },
    { id: 'premium_seafood', name: 'Premium Seafood', kind: 'cargo', cat: 'fish', lot: '50 premium seafood units', gp: 220 },
    { id: 'raw_timber', name: 'Raw Timber', kind: 'cargo', cat: 'timber', lot: '20 logs', gp: 100 },
    { id: 'sawn_lumber', name: 'Sawn Lumber', kind: 'cargo', cat: 'timber', lot: '100 processed planks', gp: 160 },
    { id: 'construction_timber', name: 'Construction Timber', kind: 'cargo', cat: 'timber', lot: '20 prepared structural beams', gp: 200 },
    { id: 'premium_hardwood', name: 'Premium Hardwood', kind: 'cargo', cat: 'timber', lot: '20 premium timber pieces', gp: 260 },
    { id: 'raw_stone', name: 'Raw Stone', kind: 'cargo', cat: 'stone', lot: '1 tonne of quarried stone', gp: 90 },
    { id: 'dressed_stone', name: 'Dressed Stone', kind: 'cargo', cat: 'stone', lot: '1 tonne of worked masonry', gp: 150 },
    { id: 'structural_masonry', name: 'Structural Masonry', kind: 'cargo', cat: 'stone', lot: '1 set of prepared construction components', gp: 190 },
    { id: 'decorative_stonework', name: 'Decorative Stonework', kind: 'cargo', cat: 'stone', lot: '1 collection of finished architectural pieces', gp: 250 },
    { id: 'ordinary_textiles', name: 'Ordinary Textiles', kind: 'cargo', cat: 'cloth', lot: '100 yards of cloth', gp: 100 },
    { id: 'sailcloth', name: 'Sailcloth', kind: 'cargo', cat: 'cloth', lot: '100 yards of heavy sailcloth', gp: 180 },
    { id: 'specialist_garments', name: 'Specialist Garments', kind: 'cargo', cat: 'cloth', lot: '10 finished garments', gp: 220 },
    { id: 'medicinal_herbs', name: 'Medicinal Herbs', kind: 'cargo', cat: 'herbal', lot: '50 portions', gp: 140 },
    { id: 'refined_botanical_reagents', name: 'Refined Botanical Reagents', kind: 'cargo', cat: 'herbal', lot: '25 prepared reagent portions', gp: 200 },
    { id: 'rare_botanical_extracts', name: 'Rare Botanical Extracts', kind: 'cargo', cat: 'herbal', lot: '10 concentrated extracts', gp: 300 },

    { id: 'restorative_herbs', name: 'Restorative Herbs', kind: 'ingredient', batch: 10, use: 'Medical supply recipes and future restorative crafting.' },
    { id: 'antivenom_roots', name: 'Antivenom Roots', kind: 'ingredient', batch: 10, use: 'Antitoxin and specialised antidote recipes.' },
    { id: 'toxic_blossoms', name: 'Toxic Blossoms', kind: 'ingredient', batch: 10, use: 'Poison preparation and alchemical crafting.' },
    { id: 'alchemical_flowers', name: 'Alchemical Flowers', kind: 'ingredient', batch: 10, use: 'Advanced ingredients for the Workshop\'s Alchemist and botanical extracts.' },

    { id: 'expedition_provision_pack', name: 'Expedition Provision Pack', kind: 'supply', pack: '10 character-days of rations (a party of five for two days)' },
    /* Pull request 6 (Harry, 14 October 2026): named as the Explorer's
       Travel bags name it (shared/data/party-items.js). The DM adds charts
       by hand for now ("+ Add supplies"). */
    { id: 'overland_chart', name: 'Overland chart', kind: 'supply', unit: 'chart', what: '3 days of use each in the Travel bags' },
    /* Pull request 8b (Harry's Shrine specification, 15 October 2026): what
       the three Shrines make at Levels 2 to 4, for the party. The Courier
       Exchange can send them (courier-data.js), and the Travel bags hold
       them (shared/data/party-items.js, the same ids). */
    { id: 'earthward_talisman', name: 'Earthward Talisman', kind: 'supply', unit: 'talisman', what: '+2 to one saving throw against a nonmagical natural-terrain hazard' },
    { id: 'rootguard_salve', name: 'Rootguard Salve', plural: 'doses of Rootguard Salve', kind: 'supply', unit: 'dose', what: 'advantage on one saving throw against being Restrained by nonmagical vegetation' },
    { id: 'blessed_lantern', name: 'Blessed Lantern', kind: 'supply', unit: 'lantern', what: 'fuel-free light: 20 ft bright, 20 ft dim, for three days' },
    { id: 'purification_incense', name: 'Purification Incense', plural: 'portions of Purification Incense', kind: 'supply', unit: 'portion', what: 'advantage on one saving throw against nonmagical poison or disease' },
    { id: 'cleansing_portion', name: 'Cleansing Portion', kind: 'supply', unit: 'portion', what: 'removes the ordinary Poisoned condition from one creature' },
    { id: 'voyage_blessing', name: 'Voyage Blessing', kind: 'supply', unit: 'blessing', what: '+2 to one navigation or maritime hazard check' },
    { id: 'aquatic_protection_charm', name: 'Aquatic Protection Charm', kind: 'supply', unit: 'charm', what: 'advantage on one Athletics check (swimming, currents or a nonmagical water hazard)' },
    /* The Beast-Catcher's Kit and its ten tools (Harry, 10 November 2026). The Workshop crafts them into the Warehouse as counted goods (the
       craft order's item has the same name, and craft: true marks it); the Courier can send them; the Travel bags hold them
       (shared/data/party-items.js, the same ids); and the Explorer's Grant a creature uses them (tools/beasthandler/data/beast-catcher-data.js
       says which tool suits which beast). */
    { id: 'beast_catchers_kit', name: 'Beast-Catcher’s Kit', plural: 'Beast-Catcher’s Kits', kind: 'supply', unit: 'kit', what: 'a weighted net, ropes and a whip: needed to settle a captured beast (used up when it is granted)', craft: true },
    { id: 'beast_collar_lead', name: 'Beast-Collar & Lead', plural: 'Beast-Collars & Leads', kind: 'supply', unit: 'collar and lead', what: 'lowers the Settle DC by 2 for a Fellcat, Dire Wolf or Griffin; reusable', craft: true },
    { id: 'beast_chain_rig', name: 'Beast-Chain Rig', plural: 'Beast-Chain Rigs', kind: 'supply', unit: 'rig', what: 'lowers the Settle DC by 2 for a Buckbear, Sabrecat or Wyvern; reusable', craft: true },
    { id: 'stillroot_salve', name: 'Stillroot Salve', plural: 'doses of Stillroot Salve', kind: 'supply', unit: 'dose', what: 'lowers the Settle DC by 2 for a Fellcat, Griffin or Buckbear; used up', craft: true },
    { id: 'dreamroot_salve', name: 'Dreamroot Salve', plural: 'doses of Dreamroot Salve', kind: 'supply', unit: 'dose', what: 'lowers the Settle DC by 2 for a Buckbear, Sabrecat or Wyvern; used up', craft: true },
    { id: 'beast_salve', name: 'Beast Salve', plural: 'doses of Beast Salve', kind: 'supply', unit: 'dose', what: 'stabilises and heals the captive on the way home; used up', craft: true },
    { id: 'scent_lure', name: 'Scent Lure', plural: 'doses of Scent Lure', kind: 'supply', unit: 'dose', what: 'lowers the Settle DC by 2 for a Fellcat, Dire Wolf or Griffin; used up', craft: true },
    { id: 'falconers_hood_jesses', name: 'Falconer’s Hood & Jesses', plural: 'sets of Falconer’s Hood & Jesses', kind: 'supply', unit: 'set', what: 'lowers the Settle DC by 2 for a Griffin; reusable', craft: true },
    { id: 'jaw_strap_tail_sheath', name: 'Jaw-Strap & Tail Sheath', plural: 'sets of Jaw-Strap & Tail Sheath', kind: 'supply', unit: 'set', what: 'lowers the Settle DC by 2 for a Wyvern; reusable', craft: true },
    { id: 'handlers_gauntlets', name: 'Handler’s Gauntlets', plural: 'pairs of Handler’s Gauntlets', kind: 'supply', unit: 'pair', what: 'lowers the Settle DC by 2 for a Buckbear or Sabrecat; reusable', craft: true },
    { id: 'beast_muzzle', name: 'Beast Muzzle', plural: 'Beast Muzzles', kind: 'supply', unit: 'muzzle', what: 'lowers the Settle DC by 2 for a Fellcat, Dire Wolf or Sabrecat; reusable', craft: true }
  ]
};
