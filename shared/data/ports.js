/* The Scarlett Isles: D&D Tool Suite — the ports where the Ironbow can hold
   a Port Charter (pull request 5 of the facilities overhaul; Harry, 14
   October 2026: "Timberport and Goldport").

   A Port Charter lets the Bastion's ships sell cargo at that port. The DM
   grants one in the Explorer, the Explorer link carries it to the Bastion,
   and the Hall of Emissaries registers it (shared/js/bridge-rules.js,
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
  goldport: { label: 'Goldport', pin: 'goldport', mapId: 'southern_province_west', region: 'southern_province' }
};
