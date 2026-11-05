/* The Compendium of Beasts (5 November 2026, Harry): one page for each kind of beast the Beast Pen keeps, opened by the small book
   button in the Beast Pen's panel (the DM's view and the Player View).
   Each page:
     id      the kind's id (the same as in tools/bastion/data/creatures-data.js and tools/beasthandler/data/profile-tables.js)
     name    the title on the tab and the page
     image   the engraving (2000 x 1500 with a see-through background), or '' when there is not one yet (the page says the picture
             is still to come)
     side    which side of the page the writing sits on ('left' or 'right'): the empty side of the engraving, opposite the beast
     lines   the general description, a paragraph each. These describe the KIND in general, not any one region's variety.
   The Regional Varieties listed under each title are read from profile-tables.js, so the list is always the same as the one the
   Beast Handler uses. The wording below was written by Claude for Harry to review: change it freely. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.beastCompendium = {
  folder: 'tools/beasthandler/assets/compendium/',
  kinds: [
    {
      id: 'buckbear', name: 'Buckbear', image: 'buckbear.webp', side: 'left',
      lines: [
        'A heavy, shaggy bear crowned with a great rack of antlers, which it sheds each winter and regrows every spring a little wider. The antlers are for display, for clearing brush and for settling rivalries without bloodshed.',
        'Buckbears forage far more than they hunt and are rarely dangerous until their young, territory or winter store is threatened. Once trust is won, a bonded buckbear carries loads, breaks trail through deep snow and plants itself between its handler and danger.'
      ]
    },
    {
      id: 'dire_wolf', name: 'Dire Wolf', image: 'dire-wolf.webp', side: 'left',
      lines: [
        'A wolf in the way a storm is rain: larger, heavier and far harder to turn aside, with a deep ruff, a long muzzle built for breaking bone and pale, watchful eyes. Dire wolves live and hunt in packs, circling, testing and wearing down their prey.',
        'They are clever and never forget a face or a wrong. A dire wolf that accepts a handler treats them as one of the pack, with all the loyalty and expectation that brings: it will guard, scout and run down quarry unasked, but it will not be ordered about like a hound.'
      ]
    },
    {
      id: 'fellcat', name: 'Fellcat', image: 'fellcat.webp', side: 'right',
      lines: [
        'A long-legged wild cat of cold, high and broken country, with tufted ears, a bobbed tail and broad padded paws that cross snow and scree without a sound. A solitary ambush hunter, it will lie still for hours, then cross twenty paces in a single bound.',
        'Fellcats shun crowds and loud places and bond slowly, one person at a time. Once it has chosen someone, a fellcat is a fine silent scout that will wait for hours at their side.'
      ]
    },
    {
      id: 'griffin', name: 'Griffin', image: 'griffin.webp', side: 'left',
      lines: [
        'The head, wings and forelegs of a great eagle on the body of a lion: proud, fast and fierce, with eyes that mark a rabbit in the grass from a mile up. Griffins nest on high, hard-to-reach ledges, pair for life and strike from above.',
        'They are never truly tame. Those who earn a griffin\u2019s trust, usually from the egg and with great patience, gain a mount of loyalty and speed, but a griffin that is slighted does not forgive.'
      ]
    },
    {
      id: 'sabrecat', name: 'Sabrecat', image: 'sabrecat.webp', side: 'left',
      lines: [
        'A heavy, thick-limbed cat, striped for hiding in grass and shadow, named for the two long curved fangs below its jaw. Built for strength rather than speed, it stalks large prey, strikes once and lets the wound do the rest.',
        'Sabrecats mark and defend wide hunting grounds and are slow to trust, but not cruel. A bonded sabrecat guards its handler\u2019s camp with a terrifying calm.'
      ]
    },
    {
      id: 'wyvern', name: 'Wyvern', image: 'wyvern.webp', side: 'right',
      lines: [
        'A winged dragonkin that walks on two legs, with a long narrow neck, a crested and horned head, leathery wings and a lashing tail ending in a venomous barb. Its scales shade to match the stone it perches on, and it nests on cliffs, ridges and the high places of the world.',
        'Wyverns are cunning, territorial and short-tempered, and respect strength and nerve more than kindness. A bonded wyvern is a fierce and swift companion, and a dangerous one to anyone who would harm its handler.'
      ]
    }
  ]
};
