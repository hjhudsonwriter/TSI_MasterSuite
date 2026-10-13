/* The Ironbow Bastion Manager — the goods catalogue (the facilities
   overhaul's pull request 3, 13 October 2026).

   From Harry's facility guide ("Ironbow Facilities: Recommended Decisions",
   13 October 2026). Every good has a stable id (saves keep the id, so a
   name can change here without breaking anything), a display name, what
   one counts as, and (for trade goods) a base value per lot, before Clan
   demand, shipping and tariffs. Goods sit in the Warehouse as rows with a
   "goodId", beside the free rows typed by hand. They don't turn into gold
   until a trade route sells them (a later pull request).

   kind:
   - cargo: a trade good, counted in lots ("lot" says what one lot holds);
   - ingredient: a crafting ingredient, counted in portions (one batch from
     the Herbal Gardens is "batch" portions);
   - supply: a supply for the party, counted in packs.
   Edit the numbers here to rebalance: nothing else needs changing. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.bastionGoods = {
  goods: [
    { id: 'fresh_fish', name: 'Fresh Fish', kind: 'cargo', lot: '100 fish', gp: 80 },
    { id: 'preserved_fish', name: 'Preserved Fish', kind: 'cargo', lot: '50 ration-equivalents', gp: 150 },
    { id: 'premium_seafood', name: 'Premium Seafood', kind: 'cargo', lot: '50 premium seafood units', gp: 220 },
    { id: 'raw_timber', name: 'Raw Timber', kind: 'cargo', lot: '20 logs', gp: 100 },
    { id: 'sawn_lumber', name: 'Sawn Lumber', kind: 'cargo', lot: '100 processed planks', gp: 160 },
    { id: 'construction_timber', name: 'Construction Timber', kind: 'cargo', lot: '20 prepared structural beams', gp: 200 },
    { id: 'premium_hardwood', name: 'Premium Hardwood', kind: 'cargo', lot: '20 premium timber pieces', gp: 260 },
    { id: 'raw_stone', name: 'Raw Stone', kind: 'cargo', lot: '1 tonne of quarried stone', gp: 90 },
    { id: 'dressed_stone', name: 'Dressed Stone', kind: 'cargo', lot: '1 tonne of worked masonry', gp: 150 },
    { id: 'structural_masonry', name: 'Structural Masonry', kind: 'cargo', lot: '1 set of prepared construction components', gp: 190 },
    { id: 'decorative_stonework', name: 'Decorative Stonework', kind: 'cargo', lot: '1 collection of finished architectural pieces', gp: 250 },
    { id: 'ordinary_textiles', name: 'Ordinary Textiles', kind: 'cargo', lot: '100 yards of cloth', gp: 100 },
    { id: 'sailcloth', name: 'Sailcloth', kind: 'cargo', lot: '100 yards of heavy sailcloth', gp: 180 },
    { id: 'specialist_garments', name: 'Specialist Garments', kind: 'cargo', lot: '10 finished garments', gp: 220 },
    { id: 'medicinal_herbs', name: 'Medicinal Herbs', kind: 'cargo', lot: '50 portions', gp: 140 },
    { id: 'refined_botanical_reagents', name: 'Refined Botanical Reagents', kind: 'cargo', lot: '25 prepared reagent portions', gp: 200 },
    { id: 'rare_botanical_extracts', name: 'Rare Botanical Extracts', kind: 'cargo', lot: '10 concentrated extracts', gp: 300 },

    { id: 'restorative_herbs', name: 'Restorative Herbs', kind: 'ingredient', batch: 10, use: 'Medical supply recipes and future restorative crafting.' },
    { id: 'antivenom_roots', name: 'Antivenom Roots', kind: 'ingredient', batch: 10, use: 'Antitoxin and specialised antidote recipes.' },
    { id: 'toxic_blossoms', name: 'Toxic Blossoms', kind: 'ingredient', batch: 10, use: 'Poison preparation and alchemical crafting.' },
    { id: 'alchemical_flowers', name: 'Alchemical Flowers', kind: 'ingredient', batch: 10, use: 'Advanced Arcane Laboratory ingredients and botanical extracts.' },

    { id: 'expedition_provision_pack', name: 'Expedition Provision Pack', kind: 'supply', pack: '10 character-days of rations (a party of five for two days)' }
  ]
};
