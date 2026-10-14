/* The Scarlett Isles: D&D Tool Suite — what the party can carry in the
   Explorer's Party bags (pull request 4 of the facilities overhaul, Harry's
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
  }
};
