/* Clan Crest Creator — content.
   Every choice in the drop-downs, the palettes, the random-name lists and the
   mottos, copied from the old tool (clan-crest-creator/app.js). The shapes
   themselves are drawn by tools/crest/draw.js.

   Spelling (Harry's answer K3, 25 September 2026): "Scarlett" with two t's
   where it means the Scarlett Isles ("of the Scarlett Isles", the motto
   "In Scarlett We Stand"); "Scarlet" with one t where it's the colour (the
   "Scarlet" name word and the "Scarlet & Gold" palette). */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.crest = {
  shields: [
    { id: 'heater', name: 'Heater (classic)' },
    { id: 'round', name: 'Round' },
    { id: 'kite', name: 'Kite' },
    { id: 'spanish', name: 'Spanish' },
    { id: 'gothic', name: 'Gothic' },
    { id: 'badge', name: 'Badge (oval)' }
  ],

  borders: [
    { id: 'plain', name: 'Plain' },
    { id: 'double', name: 'Double line' },
    { id: 'notched', name: 'Notched' },
    { id: 'rope', name: 'Rope' },
    { id: 'beaded', name: 'Beaded' }
  ],

  patterns: [
    { id: 'solid', name: 'Solid' },
    { id: 'perFess', name: 'Per fess (horizontal split)' },
    { id: 'perPale', name: 'Per pale (vertical split)' },
    { id: 'perBend', name: 'Per bend (diagonal)' },
    { id: 'quarterly', name: 'Quarterly' },
    { id: 'chevron', name: 'Chevron' },
    { id: 'stripes', name: 'Stripes' },
    { id: 'cross', name: 'Cross' }
  ],

  textures: [
    { id: 'none', name: 'None' },
    { id: 'grain', name: 'Grain' },
    { id: 'speckle', name: 'Speckle' },
    { id: 'etch', name: 'Etched' }
  ],

  /* a: main field colour, b: metal (borders, sigil, second field), c: shield base, ink: unused by the old tool */
  palettes: [
    { id: 'scarletGold', name: 'Scarlet & Gold', a: '#7a1111', b: '#d8b25b', c: '#151010', ink: '#0b0a0a' },
    { id: 'midnightGold', name: 'Midnight & Gold', a: '#0d1b2a', b: '#d8b25b', c: '#0b0a0a', ink: '#0b0a0a' },
    { id: 'forestGold', name: 'Forest & Gold', a: '#12311e', b: '#d8b25b', c: '#0b0a0a', ink: '#0b0a0a' },
    { id: 'seaSilver', name: 'Sea & Silver', a: '#0f3a52', b: '#d6dce2', c: '#081018', ink: '#071017' },
    { id: 'emberAsh', name: 'Ember & Ash', a: '#5a130a', b: '#f07c3a', c: '#1a0f0b', ink: '#120907' },
    { id: 'royal', name: 'Royal', a: '#1a2a6a', b: '#f2e0b5', c: '#1a0f18', ink: '#0c0a0f' },
    { id: 'stone', name: 'Stone', a: '#2a2a2a', b: '#bdb5a6', c: '#0f0f0f', ink: '#0b0b0b' },
    { id: 'sunset', name: 'Sunset', a: '#4a0f2c', b: '#f2a33a', c: '#0f0a0d', ink: '#0b0a0a' },
    { id: 'verdant', name: 'Verdant', a: '#0c3b2e', b: '#f6d88a', c: '#0b0a0a', ink: '#0b0a0a' },
    { id: 'ice', name: 'Ice', a: '#0f2540', b: '#bfe2ff', c: '#07121f', ink: '#05101a' },
    { id: 'bloodBone', name: 'Blood & Bone', a: '#5d0b0b', b: '#efe3cf', c: '#1a0c0c', ink: '#0b0a0a' },
    { id: 'dawn', name: 'Dawn', a: '#2b1b4f', b: '#ffcf7a', c: '#140b20', ink: '#0b0a0a' }
  ],

  sigils: [
    { id: 'sword', name: 'Sword' },
    { id: 'twinSwords', name: 'Twin Swords' },
    { id: 'crown', name: 'Crown' },
    { id: 'tree', name: 'Tree' },
    { id: 'wave', name: 'Wave' },
    { id: 'mountain', name: 'Mountain' },
    { id: 'moon', name: 'Moon' },
    { id: 'sun', name: 'Sun' },
    { id: 'eye', name: 'All-seeing Eye' },
    { id: 'anchor', name: 'Anchor' },
    { id: 'book', name: 'Tome' },
    { id: 'rune', name: 'Runic Knot' },
    { id: 'stag', name: 'Stag' },
    { id: 'flame', name: 'Flame' },
    { id: 'shield', name: 'Mini Shield' },
    { id: 'compass', name: 'Compass Rose' }
  ],

  iconStyles: [
    { id: 'solid', name: 'Solid' },
    { id: 'outline', name: 'Outline' },
    { id: 'twoTone', name: 'Two-tone' }
  ],

  banners: [
    { id: 'none', name: 'None' },
    { id: 'ribbon', name: 'Ribbon' },
    { id: 'plaque', name: 'Plaque' },
    { id: 'scroll', name: 'Scroll' }
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

  /* The crest it starts with, and Reset goes back to. With no motto, the ribbon isn't drawn. */
  defaults: {
    clanName: 'Blackstone Wardens',
    shieldShape: 'heater',
    borderStyle: 'double',
    borderWidth: 12,
    patternType: 'quarterly',
    palette: 'scarletGold',
    texture: 'grain',
    sigilType: 'stag',
    sigilScale: 105,
    sigilFillMode: 'twoTone',
    bannerStyle: 'ribbon',
    bannerText: ''
  },

  /* Slider ranges, and the narrower ranges Random Crest picks from. */
  limits: {
    borderWidth: { min: 4, max: 22, randomMin: 7, randomMax: 18 },
    sigilScale: { min: 50, max: 140, randomMin: 80, randomMax: 130 },
    clanNameLength: 40,
    mottoLength: 26
  }
};
