/* Scarlett Isles: Beast Handler — which picture goes with which kind of beast.

   Harry's painted portraits are matched to the Regional Varieties: the Dire
   Wolf's five are in (21 October 2026); the Wyverns' and Griffins' go in once
   he says which is which (the pictures are saved in assets/extras/). A beast
   with no Regional Variety, or one with no picture yet, shows its species'
   gold medallion (Harry's decision), so nothing is missing and nothing is
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
    dire_wolf: {
      label: 'Dire Wolf', alt: 'A dire wolf', default: { src: '' },
      /* Harry named each picture (21 October 2026). */
      variants: {
        nightfang: { src: 'dire-wolf/nightfang.webp' },
        icepelt: { src: 'dire-wolf/icepelt.webp' },
        slatejaw: { src: 'dire-wolf/slatejaw.webp' },
        reedshadow: { src: 'dire-wolf/reedshadow.webp' },
        hollowhowl: { src: 'dire-wolf/hollowhowl.webp' }
      }
    }
  }
};
