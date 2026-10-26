/* The Bastion's Player View: the simple, illustrated panel the players see when the DM opens a facility
   (Harry, 26 October 2026; docs/PLAYER-VIEW-PLAN.md). One entry per facility. The Party Quarters has no panel.

   id       the facility's id (facilities-data.js)
   title    the name in the header (left)
   tagline  the short line in the header (right)
   art      a picture in tools/bastion/assets/player-panels/ (for example 'workshop.png'), or { levels: { 1: 'a.jpg', 2: 'b.jpg' } }
            for one picture per facility level (a level with none uses the nearest lower level's). Leave it null until
            Harry's picture arrives: the panel then shows the facility's existing painting (bastion-data.js panelImages,
            facilityImages, then the building cut from the map). Pictures fill the picture area (cropped to fit)
   bare     true: only the title and the picture (the Party Quarters)
   focus    where the crop keeps in view, { x: 50, y: 50 } by default: percent across and down the picture
   blurb    one or two lines under the picture
   widgets  the small things shown under the picture:
              'level'    "Level 3" (or "One level")
              'orders'   "Orders pending" with the names of the pending orders, or "None"
              'staff'    the Workshop's five staff, those not yet open greyed
              'shrines'  the Temple's three gods with their favour bars (Telluria green, Aurush orange, Pelagos blue)
   These texts are Harry's to edit. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.bastionPlayerPanels = [
  { id: 'workshop', title: 'Workshop', tagline: 'Need something? Craft it here...',
    art: { levels: { 1: 'workshop-level-1.jpg', 2: 'workshop-level-2.jpg', 3: 'workshop-level-3.jpg', 4: 'workshop-level-4.jpg', 5: 'workshop-level-5.jpg' } },
    focus: { x: 50, y: 62 },
    blurb: 'Hand your plans to the staff and they will see them made.', widgets: ['level', 'orders', 'staff'] },
  /* The Party Quarters is not a facility (no level, orders or map label): its panel is only its name and picture. bare: true
     draws no tagline, no info strip and no blurb. */
  { id: 'party_quarters', title: 'Party Quarters', tagline: '', art: 'party_quarters.jpg', focus: { x: 50, y: 50 },
    blurb: '', widgets: [], bare: true },
  { id: 'temple', title: 'Temple', tagline: 'The Triarchy is always listening...', art: null,
    blurb: 'Say a prayer at a shrine and the gods may respond.', widgets: ['level', 'orders', 'shrines'] },
  { id: 'dock', title: 'Dock', tagline: 'Ships come and go with the tide...', art: 'dock.jpg', focus: { x: 50, y: 55 },
    blurb: 'Chart voyages and charter trade across the sea.', widgets: ['level', 'orders'] },
  { id: 'hall_of_emissaries', title: 'Hall of Emissaries', tagline: 'Every Clan has an ear in this room...', art: null,
    blurb: 'Meet envoys and learn where each Clan stands.', widgets: ['level', 'orders'] },
  { id: 'beast_pen', title: 'Beast Pen', tagline: 'Something stirs in the stalls...', art: null,
    blurb: 'House the beasts that follow your banner, and bond with them on the road.', widgets: ['level', 'orders'] },
  { id: 'prison_tower', title: 'Prison Tower', tagline: 'Stone walls keep their secrets...', art: null,
    blurb: 'Lock up captives here, and question them if you dare.', widgets: ['level', 'orders'] },
  { id: 'herbal_gardens', title: 'Herbal Gardens', tagline: 'Green things grow where care is given...', art: null,
    blurb: 'Gather herbs and brew remedies.', widgets: ['level', 'orders'] },
  { id: 'fishery_smokehouse', title: 'Fishery & Smokehouse', tagline: 'The catch comes in with every tide...', art: null,
    blurb: 'Bring in fish and smoked stores for the Ironbow.', widgets: ['level', 'orders'] },
  { id: 'timber_sawmill', title: 'Timber Yard & Sawmill', tagline: 'The saw sings from dawn to dusk...', art: null,
    blurb: 'Fell and mill timber for building and trade.', widgets: ['level', 'orders'] },
  { id: 'stone_masonworks', title: 'Stone Quarry & Masonworks', tagline: 'Stone is patient, and so are the masons...', art: null,
    blurb: 'Quarry and dress stone for the Ironbow\'s works.', widgets: ['level', 'orders'] },
  { id: 'weavers_hall', title: 'Weavers\' Hall', tagline: 'Looms clatter and sails take shape...', art: null,
    blurb: 'Weave cloth, rope and sails.', widgets: ['level', 'orders'] },
  { id: 'courier_exchange', title: 'Courier Exchange', tagline: 'Every letter finds its road...', art: 'courier_exchange.jpg', focus: { x: 50, y: 58 },
    blurb: 'Send parcels across the Isles and collect what arrives.', widgets: ['level', 'orders'] }
];
