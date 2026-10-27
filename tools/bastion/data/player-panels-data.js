/* The Bastion's Player View: the simple, illustrated panel the players see when the DM opens a facility
   (Harry, 26 October 2026; docs/PLAYER-VIEW-PLAN.md). One entry per facility. The Party Quarters has no panel.

   id       the facility's id (facilities-data.js)
   title    the name in the header (left)
   tagline  the short line in the header (right)
   art      a picture in tools/bastion/assets/player-panels/ (for example 'workshop.png'), or { levels: { 1: 'a.jpg', 2: 'b.jpg' } }
            for one picture per facility level (a level with none uses the nearest lower level's). Leave it null until
            Harry's picture arrives: the panel then shows the facility's existing painting (bastion-data.js panelImages,
            facilityImages, then the building cut from the map). Pictures fill the picture area (cropped to fit)
   ledger   { levels: { 1: 'file.jpg' }, hotspot: { 1: { x, y, w, h } } }: a book on the room picture that opens full size
   bare     true: only the title and the picture (the Party Quarters)
   art.states  { 'cells-000' ... 'cells-111' }: a picture for a state of the facility (the Prison Tower's cells)
   focus    where the crop keeps in view, { x: 50, y: 50 } by default: percent across and down the picture
   blurb    one or two lines under the picture
   widgets  the small things shown under the picture:
              'level'    "Level 3" (or "One level")
              'orders'   "Orders pending" with the names of the pending orders, or "None"
              'staff'    the Workshop's five staff, those not yet open greyed
              'beasts'   the Beast Pen's housed beasts: name, kind and handler
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
  /* The Beast Pen shows no level, orders or blurb: only the beasts housed there (name, kind and handler). */
  { id: 'beast_pen', title: 'Beast Pen', tagline: 'Something stirs in the stalls...', art: 'beast_pen.jpg', focus: { x: 50, y: 50 },
    blurb: '', widgets: ['beasts'] },
  /* The Prison Tower's picture follows which cells are in use: art.states has a key 'cells-NNN' for each picture (one digit
     a cell, left to right: 1 is in use, 0 is empty). The picture is chosen by tools/bastion/player-view-art.js: the exact
     one, else the best that shows only cells really in use, else 'cells-000'. 'cells-011' is not painted yet. */
  { id: 'prison_tower', title: 'Prison Tower', tagline: 'Stone walls keep their secrets...',
    art: { states: {
      'cells-000': 'prison_tower-empty.jpg', 'cells-100': 'prison_tower-occupied-1.jpg', 'cells-010': 'prison_tower-cells-010.jpg',
      'cells-001': 'prison_tower-cells-001.jpg', 'cells-110': 'prison_tower-cells-110.jpg', 'cells-101': 'prison_tower-cells-101.jpg',
      'cells-111': 'prison_tower-cells-111.jpg' } }, focus: { x: 50, y: 50 },
    blurb: 'Lock up captives here, and question them if you dare.', widgets: ['level', 'orders'] },
  { id: 'herbal_gardens', title: 'Herbal Gardens', tagline: 'Green things grow where care is given...', art: null,
    blurb: 'Gather herbs and brew remedies.', widgets: ['level', 'orders'] },
  /* The Fishery & Smokehouse: a picture per level (Level 5's is awaited: it shows Level 4's meanwhile) and a LEDGER: the
     open book on the table at the right. ledger.hotspot is where it sits on the room picture, in percent of the picture
     (x, y, width, height), per level; clicking it (or the DM's "Show ledger to players") opens ledger.levels[level] over
     the panel. Any facility can get a ledger the same way. */
  { id: 'fishery_smokehouse', title: 'Fishery & Smokehouse', tagline: 'The catch comes in with every tide...',
    art: { levels: { 1: 'fishery-level-1.jpg', 2: 'fishery-level-2.jpg', 3: 'fishery-level-3.jpg', 4: 'fishery-level-4.jpg' /* 5: awaited */ } },
    focus: { x: 50, y: 55 },
    ledger: {
      levels: { 1: 'fishery-ledger-1.jpg', 2: 'fishery-ledger-2.jpg', 3: 'fishery-ledger-3.jpg', 4: 'fishery-ledger-4.jpg', 5: 'fishery-ledger-5.jpg' },
      hotspot: { 1: { x: 70, y: 55, w: 18, h: 15 }, 2: { x: 70, y: 55, w: 18, h: 15 }, 3: { x: 70, y: 55, w: 18, h: 15 }, 4: { x: 70, y: 55, w: 19, h: 16 } }
    },
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
