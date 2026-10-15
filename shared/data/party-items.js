/* The Scarlett Isles: D&D Tool Suite — what the party can carry in the
   Explorer's Travel bags (pull request 4 of the facilities overhaul, Harry's
   answers of 13 October 2026). They reach the bags two ways: the Bastion's
   Courier Exchange sends them from the Warehouse to a town, where the DM
   collects them (pull request 6), and the DM adds what the party gets from
   the story with "+ Add" in the Explorer. The ids match the Bastion's goods
   (tools/bastion/data/goods-data.js), which is how a parcel's goods become
   bag items.

   - name, plural: as the bags show them;
   - use: what the item does, one of a fixed list the Explorer knows:
       'extraHex' (an Overland chart: "Use a chart today" gives one more
       6-mile hex until Make Camp, at most one a day, never on a day an event
       cut short) or 'exhaustionAdvantage' (an Expedition Provision Pack:
       advantage on one exhaustion save, at C8's vigil or the White Blizzard;
       the DM still rolls);
   - usesEach: how many uses one item gives (each chart lasts 3 days of use);
   - unit, units: what the bags count (days of use, or packs);
   - text: a plain line for the Add pop-up.
   A save holds only the id and the count, never these words. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.partyItems = {
  overland_chart: {
    name: 'Overland chart',
    plural: 'Overland charts',
    use: 'extraHex',
    usesEach: 3,
    unit: 'day of use',
    units: 'days of use',
    text: 'Each chart gives 3 days of use. On a day you use one, the party can travel one more 6-mile hex before Make Camp.'
  },
  expedition_provision_pack: {
    name: 'Expedition Provision Pack',
    plural: 'Expedition Provision Packs',
    use: 'exhaustionAdvantage',
    usesEach: 1,
    unit: 'pack',
    units: 'packs',
    text: 'Advantage on one exhaustion save: C8\'s vigil, or the White Blizzard (one pack covers the whole party). You still roll at the table.'
  },
  /* The Shrines' items (pull request 8b, Harry's Shrine specification of 15
     October 2026). use 'shrine': the DM applies it at the table. */
  earthward_talisman: {
    name: "Earthward Talisman",
    plural: "Earthward Talismans",
    use: 'shrine',
    usesEach: 1,
    unit: "talisman",
    units: "talismans",
    text: "+2 to one saving throw against a nonmagical natural-terrain hazard (from the Shrine of Telluria)."
  },
  rootguard_salve: {
    name: "Rootguard Salve",
    plural: "doses of Rootguard Salve",
    use: 'shrine',
    usesEach: 1,
    unit: "dose",
    units: "doses",
    text: "Advantage on one saving throw against being Restrained by nonmagical vegetation (from the Shrine of Telluria)."
  },
  blessed_lantern: {
    name: "Blessed Lantern",
    plural: "Blessed Lanterns",
    use: 'shrine',
    usesEach: 3,
    unit: "day of light",
    units: "days of light",
    text: "Fuel-free light: bright light 20 ft and dim light another 20 ft. Each lantern gives three days of light (from the Shrine of Aurush)."
  },
  purification_incense: {
    name: "Purification Incense",
    plural: "portions of Purification Incense",
    use: 'shrine',
    usesEach: 1,
    unit: "portion",
    units: "portions",
    text: "Advantage on one saving throw against nonmagical poison or disease (from the Shrine of Aurush)."
  },
  cleansing_portion: {
    name: "Cleansing Portion",
    plural: "Cleansing Portions",
    use: 'shrine',
    usesEach: 1,
    unit: "portion",
    units: "portions",
    text: "Removes the ordinary Poisoned condition from one creature. It heals no hit points and cures no disease or curse (from the Shrine of Aurush)."
  },
  voyage_blessing: {
    name: "Voyage Blessing",
    plural: "Voyage Blessings",
    use: 'shrine',
    usesEach: 1,
    unit: "blessing",
    units: "blessings",
    text: "+2 to one navigation or maritime hazard check during an expedition (from the Shrine of Pelagos)."
  },
  aquatic_protection_charm: {
    name: "Aquatic Protection Charm",
    plural: "Aquatic Protection Charms",
    use: 'shrine',
    usesEach: 1,
    unit: "charm",
    units: "charms",
    text: "Advantage on one Athletics check involving swimming, currents or a nonmagical water hazard (from the Shrine of Pelagos)."
  }
};
