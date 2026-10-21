/* Scarlett Isles: Beast Handler — which picture goes with which kind of beast.

   Harry is having three painted designs made for each of the Wyvern, the
   Griffin and the Dire Wolf, and a hero portrait for each named creature
   (BH-4). Until a picture is added here the companion draws a gold
   medallion with the beast's name, so nothing is missing and nothing is
   faked.

   To add a picture: put the file in tools/beasthandler/assets/ and set src
   to its name, e.g. src: 'wyvern-widowspine.png'. A variant is picked by
   the Regional Variety's id (profile-tables.js); "default" is used when a
   creature has none, or none has its own picture yet. Changing a picture
   never changes anything about a creature's game. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.beastArt = {
  version: 1,
  species: {
    wyvern: { label: 'Wyvern', alt: 'A wyvern', default: { src: '' }, variants: {} },
    griffin: { label: 'Griffin', alt: 'A griffin', default: { src: '' }, variants: {} },
    dire_wolf: { label: 'Dire Wolf', alt: 'A dire wolf', default: { src: '' }, variants: {} }
  }
};
