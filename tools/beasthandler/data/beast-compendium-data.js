/* The Compendium of Beasts (5 November 2026, Harry): one page for each kind of beast the Beast Pen keeps, opened by the small book
   button in the Beast Pen's panel (the DM's view and the Player View).
   Each page:
     id      the kind's id (the same as in tools/bastion/data/creatures-data.js and tools/beasthandler/data/profile-tables.js)
     name    the title on the tab and the page
     image   the engraving (2000 x 1500 with a see-through background), or '' when there is not one yet (the page says the picture
             is still to come)
     lines   the general description, a paragraph each. These describe the KIND in general, not any one region's variety.
   The Regional Varieties listed under each title are read from profile-tables.js, so the list is always the same as the one the
   Beast Handler uses. The wording below was written by Claude for Harry to review: change it freely. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.beastCompendium = {
  folder: 'tools/beasthandler/assets/compendium/',
  kinds: [
    {
      id: 'buckbear', name: 'Buckbear', image: 'buckbear.webp',
      lines: [
        'The buckbear is a bear grown heavy with shaggy fur and crowned with a great rack of antlers, which it sheds each winter and regrows every spring, a little wider than before. The antlers are not for hunting. They are for display, for clearing brush and for settling quarrels between rivals without bloodshed.',
        'Buckbears are slow, deliberate animals. They graze and forage far more than they hunt, and they are rarely dangerous until something threatens their young, their territory or their winter store. A frightened buckbear charges antlers first, and few things stand against that.',
        'They are patient, steady creatures once trust is won. A bonded buckbear will carry loads, break trail through deep snow and plant itself between its handler and a threat, and it forgets neither kindness nor insult.'
      ]
    },
    {
      id: 'dire_wolf', name: 'Dire Wolf', image: 'dire-wolf.webp',
      lines: [
        'The dire wolf is a wolf in the way a storm is rain: larger, heavier and far harder to turn aside. It stands as high as a man’s chest at the shoulder, with a deep ruff, a long muzzle full of teeth built for breaking bone, and pale, watchful eyes.',
        'Dire wolves live and hunt in packs, and the pack is everything to them. They are clever, patient hunters that circle, test and wear down their prey, and they remember faces, voices and the scent of those who have wronged them.',
        'A dire wolf that accepts a handler treats them as a member of the pack, with all the loyalty and all the expectations that brings. It will guard, scout and run down quarry without being asked, but it will not be ordered about like a hound.'
      ]
    },
    {
      id: 'fellcat', name: 'Fellcat', image: 'fellcat.webp',
      lines: [
        'The fellcat is a long-legged wild cat of cold, high and broken country, with tufted ears, a short bobbed tail and broad padded paws that carry it over snow and scree without a sound. Its coat is thick, finely marked and made for hiding.',
        'It is a solitary ambush hunter. A fellcat will lie motionless for hours, then cross twenty paces in a single bound. It is rarely seen and almost never heard, and it prefers to leave a stranger’s camp without ever having been noticed.',
        'Fellcats are wary of crowds and loud places, and they bond slowly, one person at a time. Once a fellcat has chosen someone it is a fine scout and a silent companion, and it will wait for hours at their side.'
      ]
    },
    {
      id: 'griffin', name: 'Griffin', image: 'griffin.webp',
      lines: [
        'The griffin has the head, wings and forelegs of a great eagle and the hindquarters and tail of a lion. It is proud, fast and fierce, and its keen eyes will mark a rabbit moving in the grass from a mile above it.',
        'Griffins nest on high, hard-to-reach ledges and pair for life. They hunt from the air, strike from above and carry their kills back to the nest, and they defend their territory and their mate against anything that comes near.',
        'They are not easily tamed, and a griffin raised in captivity is still a wild creature at heart. Those who earn one’s trust, usually from the egg and with patience, gain a mount of great loyalty and speed, but a griffin that is slighted does not forgive.'
      ]
    },
    {
      id: 'sabrecat', name: 'Sabrecat', image: 'sabrecat.webp',
      lines: [
        'The sabrecat is a heavy, thick-limbed cat, striped for hiding in grass and shadow, and named for the two long, curved fangs that hang below its jaw. It is built for strength rather than speed, and it hunts large and dangerous prey.',
        'It waits and stalks rather than chases. A sabrecat creeps close, pounces and drives its fangs deep into its quarry, then retreats and lets the wound do the rest. It marks and defends a wide hunting ground, and it does not tolerate rivals.',
        'Sabrecats are proud and slow to trust, but they are not cruel. A bonded sabrecat guards its handler’s camp with a terrifying calm, and the sight of one at rest in the firelight is enough to keep most intruders away.'
      ]
    },
    {
      id: 'wyvern', name: 'Wyvern', image: 'wyvern.webp',
      lines: [
        'The wyvern is a winged dragonkin that walks on two legs, with the forelimbs folded into its leathery wings. It has a long, narrow neck, a crested and horned head, a lashing tail ending in a venomous barb, and scales that shade to match the stone it perches on.',
        'It is a cunning predator that nests on cliffs, ridges and the high places of the world. It glides for hours on the wind, then drops on its prey in a hard, steep dive, and it will use the barb at the end of its tail as readily as its talons.',
        'Wyverns are intelligent, territorial and short-tempered, and they respect strength and nerve more than kindness. A bonded wyvern becomes a fierce and swift companion, and a dangerous one to anyone who would harm its handler.'
      ]
    }
  ]
};
