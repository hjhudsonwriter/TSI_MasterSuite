/* The Scarlett Isles Explorer: which clan's shield each town shows on its banner (guide 6A, 4 November 2026).

   Each town shows the clan that rules its province (Harry's table, 4 November 2026; he left the "Change to" column as it
   was, so these are the defaults): Western = Farmer, Eastern = Slade, Midland = Bacca, Northern = Blackstone,
   Southern = Molten, North Isle = Karr, East Isle = Rowthorn. The key is the town pin's id (data/explorer-data.js);
   null is a plain nameplate with no shield. The DM can change any town in play (Ruled by, saved as tsi.explorer.townclans),
   and that wins over this file.

   Two pins in the Explorer's data are not in Harry's table of 33, so they have no clan and get a plain nameplate: Leatherport
   (North Isle) and The River Rook (Midland). Redport is listed twice on the Western Province (south) map; one id, one clan. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.townClans = {
  /* The East Isle */
  swyth: 'rowthorn', greymyr: 'rowthorn', port_brawdlyn: 'rowthorn',
  /* The North Isle (Leatherport is not in the table) */
  leatherport: null, bleakhold: 'karr', bleakharbour: 'karr', coldpass: 'karr',
  /* Midland Province (The River Rook is not in the table) */
  river_rook: null, middlemount: 'bacca', pearlsmore: 'bacca', midacre: 'bacca', colver: 'bacca', standish: 'bacca',
  /* Eastern Province, north and south */
  wyre: 'slade', slades_muster: 'slade', randock_farm: 'slade', moorcastle: 'slade', steelport: 'slade', alum_rest: 'slade', bretan: 'slade',
  /* Northern Province, east and west */
  alderbridge: 'blackstone', wolfhaven: 'blackstone', sodden: 'blackstone', nightwood: 'blackstone', lokken: 'blackstone', timberport: 'blackstone',
  /* Southern Province, east and west */
  moltenport: 'molten', cassmead: 'molten', lowland_farm: 'molten', fork_farm: 'molten', goldport: 'molten', city_of_coin: 'molten',
  /* Western Province (south) */
  westreach: 'farmer', shadowhall: 'farmer', redport: 'farmer'
};
