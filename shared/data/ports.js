/* The Scarlett Isles: D&D Tool Suite — the ports where the Ironbow can hold
   a Port Charter (pull request 5 of the facilities overhaul; Harry, 14
   October 2026: "Timberport and Goldport"); Harry added eight more on 19
   October 2026: the other genuine port towns of the Scarlett Isles, and the
   River Rook as Clan Bacca's river port, since Midland Province has no
   harbour town.

   A Port Charter lets the Bastion's ships sell cargo at that port. The DM
   grants one in the Explorer, the Explorer link carries it to the Bastion,
   and the Dock registers it (shared/js/bridge-rules.js,
   tools/bastion/rules.js).

   Each port is keyed by its Explorer pin's id, and its label is spelt
   exactly as the pin's (tools/explorer/data/explorer-data.js):
   - pin: the Explorer pin whose town picture shows the harbour box;
   - mapId: the Explorer map that pin is on;
   - region: the region the port is in (shared/data/regions.js), which
     gives its Clan. The Clan is never written here twice.
   The Bastion's sailing days, risk and costs for each port are in
   tools/bastion/data/commerce-data.js.

   To add a port later: add it here with its pin, map and region, then give
   it a route in commerce-data.js. Nothing else needs changing. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.ports = {
  timberport: { label: 'Timberport', pin: 'timberport', mapId: 'northern_province_west', region: 'northern_province' },
  goldport: { label: 'Goldport', pin: 'goldport', mapId: 'southern_province_west', region: 'southern_province' },
  port_brawdlyn: { label: 'Port Brawdlyn', pin: 'port_brawdlyn', mapId: 'the_east_isle', region: 'the_east_isle' },
  steelport: { label: 'Steelport', pin: 'steelport', mapId: 'eastern_province_south', region: 'eastern_province' },
  moltenport: { label: 'Moltenport', pin: 'moltenport', mapId: 'southern_province_east', region: 'southern_province' },
  leatherport: { label: 'Leatherport', pin: 'leatherport', mapId: 'the_north_isle', region: 'the_north_isle' },
  bleakharbour: { label: 'Bleakharbour', pin: 'bleakharbour', mapId: 'the_north_isle', region: 'the_north_isle' },
  alderbridge: { label: 'Alderbridge', pin: 'alderbridge', mapId: 'northern_province_east', region: 'northern_province' },
  redport: { label: 'Redport', pin: 'redport', mapId: 'western_province_south', region: 'western_province' },
  river_rook: { label: 'The River Rook', pin: 'river_rook', mapId: 'midland_province', region: 'midland_province' }
};
