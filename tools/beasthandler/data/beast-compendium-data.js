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
   Beast Handler uses. The wording below was first written by Claude and then reviewed and edited by Harry (5 November 2026): change it freely. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.beastCompendium = {
  folder: 'tools/beasthandler/assets/compendium/',
  kinds: [
    {
      id: 'buckbear', name: 'Buckbear', image: 'buckbear.webp', side: 'left',
      lines: [
        'A heavy, shaggy bear crowned with a great rack of antlers, which it sheds each winter and regrows every spring a little wider. The antlers are for display, for clearing brush and for settling territorial and mating challenges.',
        'Buckbears forage far more than they hunt and are rarely dangerous until their young, territory or winter store is threatened. Once trust is won, a bonded buckbear carries loads, breaks trail through deep snow and plants itself between its handler and danger.'
      ]
    },
    {
      id: 'dire_wolf', name: 'Dire Wolf', image: 'dire-wolf.webp', side: 'left',
      lines: [
        'A cousin of the common wolf: larger, heavier and far harder to turn aside, with a deep ruff, a long muzzle built for breaking bone and tearing flesh. Dire wolves live and hunt in packs, circling, testing and wearing down their prey.',
        'Fiercely clever, Dire Wolves never forget a face or a wrong. A dire wolf that accepts a handler treats them as one of the pack, with all the loyalty and expectation that brings: it will guard, scout and run down quarry unasked, but it will not be ordered about like a hound.'
      ]
    },
    {
      id: 'fellcat', name: 'Fellcat', image: 'fellcat.webp', side: 'right',
      lines: [
        'A long-legged wild cat of cold, high and broken country, with tufted ears, a bobbed tail and broad padded paws that cross snow and scree without a sound. A solitary ambush hunter, it will lie still for hours, then cross twenty paces in a single bound.',
        'Fellcats shun crowds and loud places and bond slowly, one person at a time. Once it has chosen someone, a fellcat is a fine silent scout and affectionate companion that will wait for hours at their side.'
      ]
    },
    {
      id: 'griffin', name: 'Griffin', image: 'griffin.webp', side: 'left',
      lines: [
        'The head, wings and forelegs of a great eagle on the body of a lion: proud, fast and fierce, with eyes that mark a rabbit in the grass from a mile up. Griffins nest on high, hard-to-reach ledges, pair for life and strike from above.',
        'They are never truly tame. Those who earn a griffin\u2019s trust must do so with great patience and dedication, but when they do, they gain a mount of the utmost loyalty and speed, but a griffin that is slighted does not forgive easily.'
      ]
    },
    {
      id: 'sabrecat', name: 'Sabrecat', image: 'sabrecat.webp', side: 'left',
      lines: [
        'A heavy, thick-limbed cat, striped and patterned for hiding in grass and shadow, named for the two deadly fangs that grow long below its jaw. Built for strength rather than speed, it stalks large prey, strikes once and lets the wound do the rest.',
        'Sabrecats mark and defend wide hunting grounds and are slower to trust than their Fellcat cousins, but not cruel. A bonded sabrecat guards its handler\u2019s camp with a terrifying calm, never hesitating to spring to their companion\u2019s aid with fang and claw.'
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

/* The Beast-Catcher's Guide (6 November 2026, Harry: his document "Beast-Catcher's Guide", 3 pages, in full). It is the seventh tab of the
   Compendium of Beasts, and its "Best-fit loadouts" table puts three tools at the foot of each beast's own page.
     kit        the Beast-Catcher's Kit: { name, crafted, what, kinds }
     items      the ten tools that lower the capture DC: { id, name, crafted (the Workshop staff member who crafts it), what, kinds (the
                beast kinds it suits, by id), note (optional, in brackets) }. The names are the guide's own ("Scent Lure"; the Workshop's
                list says "Beast Scent Lure": ask Harry which he wants).
     loadouts   for each kind id, its three best-fit item ids, in the guide's order
     plural     how each kind is named in "to capture and subdue ..." on its page
     how        "How it plays": a lead line, then a label and a line each
   These are proposed rules (as the guide says): nothing here changes what the Bastion or the Beast Handler do. */
window.TSI_DATA.beastCatcher = {
  title: 'Beast-Catcher’s Guide',
  date: '6 November 2026',
  intro: 'A party cannot attempt to subdue and capture a beast without the Beast-Catcher’s Kit, and the kit is used up on each attempt.',
  kitHeading: 'Required: the Beast-Catcher’s Kit',
  kit: {
    name: 'Beast-Catcher’s Kit', crafted: 'Workshop · Handyman',
    what: 'A weighted capture net, binding ropes and a handler’s whip in one roll. The net restrains a Large or smaller beast (DC 10 Strength to escape). The ropes and whip handle the tie-down and control.',
    kinds: ['fellcat', 'dire_wolf', 'buckbear', 'griffin', 'sabrecat', 'wyvern']
  },
  oddsHeading: 'Improve the odds',
  oddsIntro: 'Ten craftable items lower the final capture DC, but only when they suit the beast being caught.',
  items: [
    { id: 'collar_lead', name: 'Beast-Collar & Lead', crafted: 'Workshop · Smith', what: 'A fitted collar and lead for a calm beast. It makes handling and leading it home easier.', kinds: ['fellcat', 'dire_wolf', 'griffin'] },
    { id: 'chain_rig', name: 'Beast-Chain Rig', crafted: 'Workshop · Smith', what: 'A forge-chain harness for the strongest beasts. If the beast wakes early, it needs DC 20 Strength to break free.', kinds: ['buckbear', 'sabrecat', 'wyvern'] },
    { id: 'stillroot', name: 'Stillroot Salve', crafted: 'Workshop · Alchemist', what: 'A Tellurian calming salve that lowers aggression without sedating the beast.', kinds: ['fellcat', 'griffin', 'buckbear'] },
    { id: 'dreamroot', name: 'Dreamroot Salve', crafted: 'Workshop · Alchemist', what: 'A sedative salve that works only on a beast at or below half HP. A failed dose only poisons it, and an overdose can kill a smaller beast.', kinds: ['buckbear', 'sabrecat', 'wyvern'] },
    { id: 'beast_salve', name: 'Beast Salve', crafted: 'Workshop · Alchemist', what: 'Stabilises and heals the captive on the way home, so a hard fight does not cost the party the beast.', kinds: ['fellcat', 'dire_wolf', 'buckbear', 'griffin', 'sabrecat', 'wyvern'], note: 'heals the captive; does not lower the DC' },
    { id: 'scent_lure', name: 'Scent Lure', crafted: 'Workshop · Alchemist', what: 'Draws the beast onto ground the party chooses. Advantage on the approach or ambush.', kinds: ['fellcat', 'dire_wolf', 'griffin'] },
    { id: 'hood_jesses', name: 'Falconer’s Hood & Jesses', crafted: 'Workshop · Artisan', what: 'Calms a raptor-type beast and controls its head and talons.', kinds: ['griffin'] },
    { id: 'jaw_strap', name: 'Jaw-Strap & Tail Sheath', crafted: 'Workshop · Artisan', what: 'Binds the jaws and caps the stinger. The only safe way to handle a wyvern.', kinds: ['wyvern'] },
    { id: 'gauntlets', name: 'Handler’s Gauntlets', crafted: 'Workshop · Artisan', what: 'Heavy forearm guards for grappling and fitting gear. Advantage on the grapple and tie-down.', kinds: ['buckbear', 'sabrecat'] },
    { id: 'muzzle', name: 'Beast Muzzle', crafted: 'Workshop · Artisan', what: 'Stops the bite while the party works.', kinds: ['fellcat', 'dire_wolf', 'sabrecat'] }
  ],
  loadoutsHeading: 'Best-fit loadouts',
  loadoutsIntro: 'Each beast has three best-fit items, and only those three lower its capture DC. Any other item can still be crafted but does nothing for that beast.',
  loadouts: {
    fellcat: ['stillroot', 'scent_lure', 'muzzle'],
    dire_wolf: ['scent_lure', 'collar_lead', 'muzzle'],
    buckbear: ['chain_rig', 'gauntlets', 'stillroot'],
    griffin: ['hood_jesses', 'scent_lure', 'collar_lead'],
    sabrecat: ['chain_rig', 'gauntlets', 'dreamroot'],
    wyvern: ['jaw_strap', 'chain_rig', 'dreamroot']
  },
  plural: { fellcat: 'Fellcats', dire_wolf: 'Dire Wolves', buckbear: 'Buckbears', griffin: 'Griffins', sabrecat: 'Sabrecats', wyvern: 'Wyverns' },
  howHeading: 'How it plays',
  howIntro: 'These are proposed rules, not yet built into the tools. A capture runs in two beats, with a short carry home between them.',
  how: [
    { label: 'Subdue', text: 'The kit lets the party attempt a non-lethal capture. They reduce the beast to 0 HP or net it. The beast wakes after about 1d4 hours.' },
    { label: 'Settle', text: 'An Animal Handling check. The base DC is 15 for Fellcat, Dire Wolf, Buckbear and Sabrecat, and 17 for Griffin and Wyvern. Each best-fit item gives −2, so a fully kitted party faces DC 9 or 11.' },
    { label: 'Failure', text: 'The beast is still captured but arrives Wary, with fewer starting bond pills in the Beast Handler.' },
    { label: 'Reuse', text: 'The kit, salves and Scent Lure are single-use. The Chain Rig, Collar & Lead, Hood & Jesses, Tail Sheath, Gauntlets and Muzzle are reusable.' },
    { label: 'The carry home', text: 'There is no crate or cage item. The trip to the Beast Pen is narrative, or a short Explorer journey, and the Collar & Lead or Chain Rig covers it.' }
  ]
};
