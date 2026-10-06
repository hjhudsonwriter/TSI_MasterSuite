/* The Scarlett Isles: D&D Tool Suite — the seven regions (7 October 2026).
   Each province's or isle's name, Clan, chief, god and temple, shared by
   the Explorer's events (data/journey-events.js reads them as its regions,
   so events can say "a rider in {clan} colours") and the DM doc (which
   shows the Clan's and the god's standing from the Bastion). The Clans and
   chiefs are the Notice Board's (tools/quests/data/quests-data.js); the
   rules tests check they still match.
   - label: as the Explorer's Region list shows it;
   - clanKey: the Clan's key in the Bastion's saves (politicalCapital,
     honourRespectByClan);
   - god: the god's key in the Bastion's saves (favour);
   - isle: Pelagos' isles, for Explorer follow-ups that need an isle map. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.regions = {
  northern_province: { label: 'Northern Province', clan: 'Blackstone', clanKey: 'blackstone', chief: 'Boris Blackstone', god: 'telluria', godName: 'Telluria', temple: 'Temple of Telluria' },
  midland_province: { label: 'Midland Province', clan: 'Bacca', clanKey: 'bacca', chief: 'Ario Bacca', god: 'telluria', godName: 'Telluria', temple: 'Temple of Telluria' },
  eastern_province: { label: 'Eastern Province', clan: 'Slade', clanKey: 'slade', chief: 'Harlan Slade', god: 'telluria', godName: 'Telluria', temple: 'Temple of Telluria' },
  southern_province: { label: 'Southern Province', clan: 'Molten', clanKey: 'molten', chief: 'Callum Molten', god: 'aurush', godName: 'Aurush', temple: 'Temple of Aurush' },
  western_province: { label: 'Western Province', clan: 'Farmer', clanKey: 'farmer', chief: 'Logan Farmer', god: 'aurush', godName: 'Aurush', temple: 'Temple of Aurush' },
  the_north_isle: { label: 'The North Isle', clan: 'Karr', clanKey: 'karr', chief: 'Helga Karr', god: 'pelagos', godName: 'Pelagos', temple: 'Temple of Pelagos', isle: true },
  the_east_isle: { label: 'The East Isle', clan: 'Rowthorn', clanKey: 'rowthorn', chief: 'Doran Rowthorn', god: 'pelagos', godName: 'Pelagos', temple: 'Temple of Pelagos', isle: true }
};
