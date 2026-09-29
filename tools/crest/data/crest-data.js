/* Clan Crest Creator — choices, colours and word lists.
   The shield shapes are in data/shields.js and the sigils in data/sigils.js.

   Spelling (Harry's answer K3, 25 September 2026): "Scarlett" with two t's
   where it means the Scarlett Isles ("of the Scarlett Isles", the motto
   "In Scarlett We Stand"); "Scarlet" with one t where it's the colour. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.crest = {
  /* ---------- Colours ----------
     Named after heraldry's tinctures where there is one (Or, Argent, Gules,
     Azure, Vert, Purpure, Sable, and the "stains" Tenné, Sanguine and Murrey),
     with more shades of each for fantasy arms, and the three gods' colours. */
  colourGroups: [
    { name: 'Metals & whites', colours: [
      { id: 'gold', name: 'Gold (Or)', hex: '#d4a93c' },
      { id: 'paleGold', name: 'Pale Gold', hex: '#e8cc7a' },
      { id: 'oldGold', name: 'Old Gold', hex: '#a9842c' },
      { id: 'bronze', name: 'Bronze', hex: '#a8743a' },
      { id: 'copper', name: 'Copper', hex: '#b9653a' },
      { id: 'silver', name: 'Silver (Argent)', hex: '#d6dade' },
      { id: 'steel', name: 'Steel', hex: '#9aa3ad' },
      { id: 'pewter', name: 'Pewter', hex: '#7b8086' },
      { id: 'iron', name: 'Iron', hex: '#4a4f55' },
      { id: 'white', name: 'White', hex: '#f4f1ea' },
      { id: 'ivory', name: 'Ivory', hex: '#ece2c6' },
      { id: 'parchment', name: 'Parchment', hex: '#dfcca0' },
      { id: 'bone', name: 'Bone', hex: '#cfc2a4' }
    ] },
    { name: 'Reds', colours: [
      { id: 'gules', name: 'Gules (Red)', hex: '#b3161f' },
      { id: 'scarlet', name: 'Scarlet', hex: '#d0202a' },
      { id: 'crimson', name: 'Crimson', hex: '#9e0f28' },
      { id: 'bloodRed', name: 'Blood Red', hex: '#7a0a12' },
      { id: 'wine', name: 'Wine', hex: '#5e0f1c' },
      { id: 'madder', name: 'Madder Rose', hex: '#c0485a' },
      { id: 'coral', name: 'Coral', hex: '#d96850' },
      { id: 'sanguine', name: 'Sanguine', hex: '#8c2a1c' }
    ] },
    { name: 'Oranges & browns', colours: [
      { id: 'tenne', name: 'Tenné (Tawny Orange)', hex: '#c46a1c' },
      { id: 'amber', name: 'Amber', hex: '#e08a1e' },
      { id: 'saffron', name: 'Saffron', hex: '#f0b429' },
      { id: 'ochre', name: 'Ochre', hex: '#c29233' },
      { id: 'tawny', name: 'Tawny', hex: '#a45f2a' },
      { id: 'russet', name: 'Russet', hex: '#8e3b1e' },
      { id: 'chestnut', name: 'Chestnut', hex: '#6f3a20' },
      { id: 'umber', name: 'Umber', hex: '#553622' },
      { id: 'earth', name: 'Earth', hex: '#3a281c' }
    ] },
    { name: 'Greens', colours: [
      { id: 'vert', name: 'Vert (Green)', hex: '#1e7b3a' },
      { id: 'emerald', name: 'Emerald', hex: '#179659' },
      { id: 'jade', name: 'Jade', hex: '#2e8c7a' },
      { id: 'forest', name: 'Forest', hex: '#1f4d2b' },
      { id: 'pine', name: 'Pine', hex: '#13382b' },
      { id: 'moss', name: 'Moss', hex: '#5b7234' },
      { id: 'olive', name: 'Olive', hex: '#6b6b2a' },
      { id: 'sage', name: 'Sage', hex: '#8fa08a' }
    ] },
    { name: 'Blues', colours: [
      { id: 'azure', name: 'Azure (Blue)', hex: '#1f4fa8' },
      { id: 'royalBlue', name: 'Royal Blue', hex: '#2946b8' },
      { id: 'sapphire', name: 'Sapphire', hex: '#0f3f8c' },
      { id: 'navy', name: 'Navy', hex: '#13224a' },
      { id: 'midnight', name: 'Midnight', hex: '#0b1430' },
      { id: 'celeste', name: 'Bleu Céleste (Sky)', hex: '#6fa8dc' },
      { id: 'steelBlue', name: 'Steel Blue', hex: '#4a6f8f' },
      { id: 'teal', name: 'Teal', hex: '#1c6f78' }
    ] },
    { name: 'Purples', colours: [
      { id: 'purpure', name: 'Purpure (Purple)', hex: '#6b2d83' },
      { id: 'violet', name: 'Violet', hex: '#7f4ab3' },
      { id: 'amethyst', name: 'Amethyst', hex: '#9b6bc9' },
      { id: 'plum', name: 'Plum', hex: '#5a2248' },
      { id: 'murrey', name: 'Murrey (Mulberry)', hex: '#8b2252' },
      { id: 'lavender', name: 'Lavender', hex: '#b5a3d6' }
    ] },
    { name: 'Blacks & greys', colours: [
      { id: 'sable', name: 'Sable (Black)', hex: '#161314' },
      { id: 'ink', name: 'Ink', hex: '#1a1110' },
      { id: 'charcoal', name: 'Charcoal', hex: '#2e2b2a' },
      { id: 'slate', name: 'Slate', hex: '#4b5563' },
      { id: 'ash', name: 'Ash', hex: '#8c8a86' },
      { id: 'stone', name: 'Stone', hex: '#b8b0a0' }
    ] },
    { name: 'The Scarlett Isles', colours: [
      { id: 'scarlettCrimson', name: 'Scarlett Crimson', hex: '#b1122a' },
      { id: 'islesGold', name: 'Isles Gold', hex: '#d6b25e' },
      { id: 'telluria', name: 'Telluria Green', hex: '#37c85f' },
      { id: 'aurush', name: 'Aurush Red', hex: '#eb3737' },
      { id: 'pelagos', name: 'Pelagos Blue', hex: '#3c91ff' }
    ] }
  ],

  /* The colour slots on a crest, in the order the Colours tab lists them. */
  colourSlots: [
    { key: 'field1', name: 'Field' },
    { key: 'field2', name: 'Field, second colour' },
    { key: 'ordinaryColour', name: 'Band' },
    { key: 'sigilColour', name: 'Sigil' },
    { key: 'accentColour', name: 'Claws, tongue & gems' },
    { key: 'lineColour', name: 'Sigil lines' },
    { key: 'rimColour', name: 'Rim' },
    { key: 'ribbonColour', name: 'Motto ribbon' },
    { key: 'mottoColour', name: 'Motto lettering' }
  ],

  /* Ready-made colour schemes: every colour on the crest at once. Each keeps
     heraldry's rule of tincture (a metal on a colour, or a colour on a metal),
     so the sigil stands out. */
  schemes: [
    { id: 'scarlettGold', name: 'Scarlett & Gold', field1: '#b1122a', field2: '#d6b25e', ordinaryColour: '#d6b25e', sigilColour: '#d6b25e', accentColour: '#1f4fa8', lineColour: '#1a1110', rimColour: '#d4a93c', ribbonColour: '#7a0a12', mottoColour: '#e8cc7a' },
    { id: 'royal', name: 'Azure & Or', field1: '#1f4fa8', field2: '#d4a93c', ordinaryColour: '#d4a93c', sigilColour: '#d4a93c', accentColour: '#b3161f', lineColour: '#1a1110', rimColour: '#d4a93c', ribbonColour: '#13224a', mottoColour: '#e8cc7a' },
    { id: 'classic', name: 'Or & Gules', field1: '#d4a93c', field2: '#b3161f', ordinaryColour: '#b3161f', sigilColour: '#b3161f', accentColour: '#1f4fa8', lineColour: '#1a1110', rimColour: '#a9842c', ribbonColour: '#b3161f', mottoColour: '#f4f1ea' },
    { id: 'sableArgent', name: 'Sable & Argent', field1: '#161314', field2: '#d6dade', ordinaryColour: '#d6dade', sigilColour: '#d6dade', accentColour: '#b3161f', lineColour: '#1a1110', rimColour: '#9aa3ad', ribbonColour: '#2e2b2a', mottoColour: '#d6dade' },
    { id: 'argentAzure', name: 'Argent & Azure', field1: '#f4f1ea', field2: '#1f4fa8', ordinaryColour: '#1f4fa8', sigilColour: '#1f4fa8', accentColour: '#b3161f', lineColour: '#1a1110', rimColour: '#9aa3ad', ribbonColour: '#1f4fa8', mottoColour: '#f4f1ea' },
    { id: 'vertOr', name: 'Vert & Or', field1: '#1e7b3a', field2: '#d4a93c', ordinaryColour: '#d4a93c', sigilColour: '#d4a93c', accentColour: '#b3161f', lineColour: '#1a1110', rimColour: '#d4a93c', ribbonColour: '#1f4d2b', mottoColour: '#e8cc7a' },
    { id: 'purpureArgent', name: 'Purpure & Argent', field1: '#6b2d83', field2: '#d6dade', ordinaryColour: '#d6dade', sigilColour: '#d6dade', accentColour: '#d4a93c', lineColour: '#1a1110', rimColour: '#d6dade', ribbonColour: '#5a2248', mottoColour: '#f4f1ea' },
    { id: 'orSable', name: 'Or & Sable', field1: '#d4a93c', field2: '#161314', ordinaryColour: '#161314', sigilColour: '#161314', accentColour: '#b3161f', lineColour: '#1a1110', rimColour: '#a9842c', ribbonColour: '#161314', mottoColour: '#e8cc7a' },
    { id: 'midnight', name: 'Midnight & Gold', field1: '#0b1430', field2: '#d4a93c', ordinaryColour: '#d4a93c', sigilColour: '#e8cc7a', accentColour: '#b3161f', lineColour: '#1a1110', rimColour: '#d4a93c', ribbonColour: '#13224a', mottoColour: '#e8cc7a' },
    { id: 'bloodBone', name: 'Blood & Bone', field1: '#7a0a12', field2: '#ece2c6', ordinaryColour: '#ece2c6', sigilColour: '#ece2c6', accentColour: '#161314', lineColour: '#1a1110', rimColour: '#cfc2a4', ribbonColour: '#5e0f1c', mottoColour: '#ece2c6' },
    { id: 'heartwood', name: 'Heartwood (Telluria)', field1: '#1f4d2b', field2: '#5b7234', ordinaryColour: '#e8cc7a', sigilColour: '#e8cc7a', accentColour: '#37c85f', lineColour: '#1a1110', rimColour: '#a8743a', ribbonColour: '#1f4d2b', mottoColour: '#e8cc7a' },
    { id: 'sunfire', name: 'Sunfire (Aurush)', field1: '#eb3737', field2: '#e08a1e', ordinaryColour: '#d4a93c', sigilColour: '#e8cc7a', accentColour: '#161314', lineColour: '#1a1110', rimColour: '#d4a93c', ribbonColour: '#7a0a12', mottoColour: '#e8cc7a' },
    { id: 'deepTide', name: 'Deep Tide (Pelagos)', field1: '#13224a', field2: '#3c91ff', ordinaryColour: '#3c91ff', sigilColour: '#d6dade', accentColour: '#3c91ff', lineColour: '#1a1110', rimColour: '#9aa3ad', ribbonColour: '#13224a', mottoColour: '#d6dade' },
    { id: 'ironbow', name: 'Ironbow Steel', field1: '#2e2b2a', field2: '#4b5563', ordinaryColour: '#9aa3ad', sigilColour: '#d6dade', accentColour: '#b1122a', lineColour: '#1a1110', rimColour: '#7b8086', ribbonColour: '#2e2b2a', mottoColour: '#d6dade' },
    { id: 'emberAsh', name: 'Ember & Ash', field1: '#553622', field2: '#8c8a86', ordinaryColour: '#e08a1e', sigilColour: '#e08a1e', accentColour: '#f0b429', lineColour: '#1a1110', rimColour: '#b9653a', ribbonColour: '#3a281c', mottoColour: '#f0b429' },
    { id: 'frost', name: 'Frost', field1: '#4a6f8f', field2: '#f4f1ea', ordinaryColour: '#f4f1ea', sigilColour: '#f4f1ea', accentColour: '#1f4fa8', lineColour: '#1a1110', rimColour: '#d6dade', ribbonColour: '#13224a', mottoColour: '#f4f1ea' },
    { id: 'dawn', name: 'Dawn', field1: '#5a2248', field2: '#f0b429', ordinaryColour: '#f0b429', sigilColour: '#f0b429', accentColour: '#d96850', lineColour: '#1a1110', rimColour: '#d4a93c', ribbonColour: '#5a2248', mottoColour: '#f0b429' },
    { id: 'tenneOr', name: 'Tenné & Or', field1: '#c46a1c', field2: '#d4a93c', ordinaryColour: '#e8cc7a', sigilColour: '#e8cc7a', accentColour: '#161314', lineColour: '#1a1110', rimColour: '#a9842c', ribbonColour: '#8e3b1e', mottoColour: '#e8cc7a' },
    { id: 'murreyArgent', name: 'Murrey & Argent', field1: '#8b2252', field2: '#d6dade', ordinaryColour: '#d6dade', sigilColour: '#d6dade', accentColour: '#d4a93c', lineColour: '#1a1110', rimColour: '#d6dade', ribbonColour: '#5e0f1c', mottoColour: '#f4f1ea' },
    { id: 'stone', name: 'Weathered Stone', field1: '#b8b0a0', field2: '#8c8a86', ordinaryColour: '#4b5563', sigilColour: '#2e2b2a', accentColour: '#8e3b1e', lineColour: '#1a1110', rimColour: '#7b8086', ribbonColour: '#4b5563', mottoColour: '#ece2c6' }
  ],

  /* ---------- The field: how it's divided ---------- */
  divisions: [
    { id: 'plain', name: 'Plain' },
    { id: 'perPale', name: 'Per pale', note: 'Split down the middle.' },
    { id: 'perFess', name: 'Per fess', note: 'Split across the middle.' },
    { id: 'perBend', name: 'Per bend', note: 'Split corner to corner, from the top left.' },
    { id: 'perBendSinister', name: 'Per bend sinister', note: 'Split corner to corner, from the top right.' },
    { id: 'perChevron', name: 'Per chevron', note: 'Split by an upside-down V.' },
    { id: 'quarterly', name: 'Quarterly', note: 'Four quarters.' },
    { id: 'perSaltire', name: 'Per saltire', note: 'Four parts, split by an X.' },
    { id: 'gyronny', name: 'Gyronny', note: 'Eight wedges meeting in the middle.' },
    { id: 'paly', name: 'Paly', note: 'Upright stripes.' },
    { id: 'barry', name: 'Barry', note: 'Stripes across.' },
    { id: 'bendy', name: 'Bendy', note: 'Slanting stripes.' },
    { id: 'chequy', name: 'Chequy', note: 'Chequered, like a chessboard.' },
    { id: 'lozengy', name: 'Lozengy', note: 'Covered in diamonds.' }
  ],

  /* ---------- Bands laid over the field (heraldry's "ordinaries") ---------- */
  ordinaries: [
    { id: 'none', name: 'None' },
    { id: 'chief', name: 'Chief', note: 'A broad band across the top.' },
    { id: 'fess', name: 'Fess', note: 'A band across the middle.' },
    { id: 'pale', name: 'Pale', note: 'An upright band down the middle.' },
    { id: 'bend', name: 'Bend', note: 'A slanting band from the top left.' },
    { id: 'bendSinister', name: 'Bend sinister', note: 'A slanting band from the top right.' },
    { id: 'chevron', name: 'Chevron', note: 'An upside-down V.' },
    { id: 'cross', name: 'Cross' },
    { id: 'saltire', name: 'Saltire', note: 'An X-shaped cross.' },
    { id: 'pall', name: 'Pall', note: 'A Y-shaped band.' },
    { id: 'pile', name: 'Pile', note: 'A wedge from the top, narrowing downward.' },
    { id: 'bordure', name: 'Bordure', note: 'A border band inside the rim.' }
  ],

  /* ---------- Rim, finish and texture ---------- */
  rims: [
    { id: 'none', name: 'None' },
    { id: 'fine', name: 'Fine' },
    { id: 'plain', name: 'Plain' },
    { id: 'double', name: 'Double' },
    { id: 'studded', name: 'Studded' },
    { id: 'rope', name: 'Rope' }
  ],
  lightings: [
    { id: 'flat', name: 'Flat', note: 'Plain painted colours, as in a heraldry book.' },
    { id: 'soft', name: 'Soft sheen', note: 'Gentle light from the top left.' },
    { id: 'gloss', name: 'Enamel gloss', note: 'A glossy, enamelled shine.' }
  ],
  textures: [
    { id: 'none', name: 'None' },
    { id: 'parchment', name: 'Parchment' },
    { id: 'grain', name: 'Grain' },
    { id: 'brushed', name: 'Brushed metal' },
    { id: 'linen', name: 'Linen' }
  ],
  reliefs: [
    { id: 'raised', name: 'Raised', note: 'Lit and shadowed, standing off the shield.' },
    { id: 'flat', name: 'Flat', note: 'Painted flat on the shield.' }
  ],
  faces: [
    { id: 'left', name: 'Left' },
    { id: 'right', name: 'Right' }
  ],

  banners: [
    { id: 'none', name: 'None' },
    { id: 'ribbon', name: 'Ribbon' },
    { id: 'scroll', name: 'Scroll' },
    { id: 'plaque', name: 'Plaque' }
  ],

  /* Random names: a first word and a second word joined with no space
     ("StormOath", Harry's answer K2: keep), then a place 55% of the time. */
  names: {
    first: ['Black', 'Row', 'Storm', 'Iron', 'Ash', 'Dusk', 'Sun', 'Tide', 'Root', 'Ember', 'Wolf', 'Gale', 'Hollow', 'Stone', 'Scarlet'],
    second: ['Wardens', 'Blades', 'Hearth', 'Covenant', 'Sails', 'Crown', 'Thorn', 'Circle', 'Company', 'Pack', 'Vanguard', 'Oath', 'Knights', 'Kindred', 'Sentinels'],
    places: ['of Nightwood', 'of the Veinwood', 'of Telluria', 'of Aurush', 'of Pelagos', 'of the First Sun', 'of the Ironbow', 'of the Scarlett Isles', 'of the Salt Coast', 'of the Rootbound'],
    placeChance: 0.55
  },

  /* Random Crest adds one of these mottos 35% of the time. */
  mottos: ['Hold Fast', 'Steel & Salt', 'By Root and Oath', 'In Scarlett We Stand', 'No Quarter', 'The Isles Endure'],
  mottoChance: 0.35,

  /* The crest it starts with, and Reset goes back to. With no motto, no
     ribbon is drawn. */
  defaults: {
    clanName: 'Blackstone Wardens',
    shield: 'heater',
    division: 'plain',
    ordinary: 'none',
    sigil: 'lion',
    sigilSize: 100,
    sigilShift: 0,
    sigilFace: 'left',
    relief: 'raised',
    rim: 'plain',
    rimWidth: 24,
    lighting: 'soft',
    texture: 'parchment',
    banner: 'ribbon',
    motto: '',
    scheme: 'scarlettGold',
    field1: '#b1122a',
    field2: '#d6b25e',
    ordinaryColour: '#d6b25e',
    sigilColour: '#d6b25e',
    accentColour: '#1f4fa8',
    lineColour: '#1a1110',
    rimColour: '#d4a93c',
    ribbonColour: '#7a0a12',
    mottoColour: '#e8cc7a'
  },

  /* Slider ranges, and the narrower ranges Random Crest picks from. The
     sigil's size is a percentage of the largest size that fits inside the rim. */
  limits: {
    sigilSize: { min: 40, max: 150, randomMin: 85, randomMax: 105 },
    sigilShift: { min: -25, max: 25 },
    rimWidth: { min: 8, max: 44, randomMin: 14, randomMax: 30 },
    clanNameLength: 40,
    mottoLength: 30
  }
};
