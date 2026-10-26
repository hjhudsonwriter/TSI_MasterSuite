/* Scarlett Isles: Beast Handler — which picture goes with which kind of beast.

   Harry's painted portraits are matched to the Regional Varieties: all
   fifteen of the first three kinds are in (21 October 2026; each file was
   named for its variety), and so is Blacktide, the sixth Dire Wolf (22 October 2026). A
   beast with no Regional Variety, or one whose name matches no variety here,
   shows an empty frame (Harry, 21 October 2026: the picture stays blank until a
   subspecies has been chosen), so nothing is faked. The two wyverns in assets/extras/wyvern/ (mossy green, volcanic
   copper) belong to no variety and are kept, unused.

   To add a picture: put the file in tools/beasthandler/assets/ and set src
   to its name, e.g. src: 'wyvern-widowspine.png'. A variant is picked by
   the Regional Variety's id (profile-tables.js); "default" is used when a
   creature has none, or none has its own picture yet. Changing a picture
   never changes anything about a creature's game. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.beastArt = {
  version: 1,
  species: {
    wyvern: {
      label: 'Wyvern', alt: 'A wyvern', default: { src: '' },
      variants: {
        widowspine: { src: 'wyvern/widowspine.webp' },
        bleakhook: { src: 'wyvern/bleakhook.webp' },
        ironcrown: { src: 'wyvern/ironcrown.webp' },
        leafwing: { src: 'wyvern/leafwing.webp' },
        bloodcrest: { src: 'wyvern/bloodcrest.webp' },
        shadowmount: { src: 'wyvern/shadowmount.webp' }
      }
    },
    griffin: {
      label: 'Griffin', alt: 'A griffin', default: { src: '' },
      variants: {
        dawnmantle: { src: 'griffin/dawnmantle.webp' },
        thunderwing: { src: 'griffin/thunderwing.webp' },
        silvershroud: { src: 'griffin/silvershroud.webp' },
        galeclaw: { src: 'griffin/galeclaw.webp' },
        embermantle: { src: 'griffin/embermantle.webp' }
      }
    },
    dire_wolf: {
      label: 'Dire Wolf', alt: 'A dire wolf', default: { src: '' },
      /* Harry named each picture; Hollowhowl and Slatejaw are his newer paintings (21 October 2026). */
      variants: {
        nightfang: { src: 'dire-wolf/nightfang.webp' },
        icepelt: { src: 'dire-wolf/icepelt.webp' },
        slatejaw: { src: 'dire-wolf/slatejaw.webp' },
        reedshadow: { src: 'dire-wolf/reedshadow.webp' },
        hollowhowl: { src: 'dire-wolf/hollowhowl.webp' },
        blacktide: { src: 'dire-wolf/blacktide.webp' }
      }
    },
    /* 22 October 2026: Harry's first paintings for the two new kinds. The other
       eight varieties have no picture yet, and show the honest blank frame. */
    buckbear: {
      label: 'Buckbear', alt: 'A buckbear', default: { src: '' },
      variants: {
        broadcrown: { src: 'buckbear/broadcrown.webp' },
        shovelhorn: { src: 'buckbear/shovelhorn.webp' }
      }
    },
    fellcat: {
      label: 'Fellcat', alt: 'A fellcat', default: { src: '' },
      variants: {
        lichenback: { src: 'fellcat/lichenback.webp' },
        smokecoat: { src: 'fellcat/smokecoat.webp' }
      }
    }
  }
};
