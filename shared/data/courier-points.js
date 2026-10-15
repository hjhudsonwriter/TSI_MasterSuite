/* The Scarlett Isles: D&D Tool Suite — the towns where the party can
   collect a parcel from the Ironbow's Courier Exchange (pull request 6 of
   the facilities overhaul; Harry, 14 October 2026).

   The Bastion's Courier Exchange sends a parcel of supplies from its
   Warehouse to one of these towns. It waits there until the DM collects it
   in the Explorer, from that town's picture (its pin), and its contents go
   into the Travel bags. The Explorer link carries the pickup back to the
   Bastion (shared/js/bridge-rules.js, tools/bastion/courier-rules.js).

   Each town is keyed by its Explorer pin's id, and its label is spelt
   exactly as the pin's (tools/explorer/data/explorer-data.js), curly
   apostrophe and all:
   - pin: the Explorer pin whose town picture shows the courier post;
   - mapId: the Explorer map that pin is on;
   - region: the region the town is in (shared/data/regions.js), which
     gives its Clan. The Clan is never written here twice.
   Every town here has a town picture, so the DM can click it.
   The Bastion's numbers for each town (the Courier Exchange level it
   needs, the days a parcel takes and the fee) are in
   tools/bastion/data/courier-data.js.

   To add a town later: add it here with its pin, map and region, then give
   it its level, days and fee in courier-data.js. Nothing else needs
   changing. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.courierPoints = {
  slades_muster: { label: 'Slade’s Muster', pin: 'slades_muster', mapId: 'eastern_province_north', region: 'eastern_province' },
  moorcastle: { label: 'Moorcastle', pin: 'moorcastle', mapId: 'eastern_province_south', region: 'eastern_province' },
  bretan: { label: 'Bretan', pin: 'bretan', mapId: 'eastern_province_south', region: 'eastern_province' },
  middlemount: { label: 'Middlemount', pin: 'middlemount', mapId: 'midland_province', region: 'midland_province' },
  timberport: { label: 'Timberport', pin: 'timberport', mapId: 'northern_province_west', region: 'northern_province' },
  goldport: { label: 'Goldport', pin: 'goldport', mapId: 'southern_province_west', region: 'southern_province' },
  swyth: { label: 'Swyth', pin: 'swyth', mapId: 'the_east_isle', region: 'the_east_isle' },
  bleakharbour: { label: 'Bleakharbour', pin: 'bleakharbour', mapId: 'the_north_isle', region: 'the_north_isle' }
};
