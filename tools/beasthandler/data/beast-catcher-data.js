/* The Beast-Catcher's Guide (6 November 2026, Harry: his document "Beast-Catcher's Guide", 3 pages, in full). It is the seventh tab of the
   Compendium of Beasts, and its "Best-fit loadouts" table puts three tools at the foot of each beast's own page.
     kit        the Beast-Catcher's Kit: { id (its good and Travel-bag id), single, name, crafted, what, kinds }
     items      the ten tools that lower the capture DC: { id (the good's id, the same in the Warehouse and the Travel bags), single (used up when the creature is granted), name, crafted (the Workshop staff member who crafts it), what, kinds (the
                beast kinds it suits, by id), note (optional, in brackets) }. The names are the same as the Workshop's lists in tools-data.js ("Scent Lure", Harry, 6 November 2026).
     loadouts   for each kind id, its three best-fit item ids, in the guide's order
     plural     how each kind is named in "to capture and subdue ..." on its page
     how        "How it plays": a lead line, then a label and a line each
   The capture rules are built (Harry's rulings, 10 November 2026): the Explorer's Grant a creature has a Settle check, and the Beast Pen uses the
   Settle DCs (see perItem above). Where the guide and Harry's rulings differ, the text below follows the rulings. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.beastCatcher = {
  /* The capture rules built on this (Harry, 10 November 2026): perItem is how much each best-fit item lowers the Settle DC. The Settle DC
     before items is each kind's acclimatiseDC in tools/bastion/data/creatures-data.js (15, or 17 for the griffin and wyvern); a beast
     that fails the Settle comes to the Bastion Wary and is acclimatised against acclimatise.waryDC (20). The Kit and the items marked
     single are used up when the creature is granted; the rest stay in the Travel bags. */
  perItem: 2,
  title: 'Beast-Catcher’s Guide',
  date: '6 November 2026',
  intro: 'A party cannot attempt to subdue and capture a beast without the Beast-Catcher’s Kit, and the kit is used up on each attempt.',
  kitHeading: 'Required: the Beast-Catcher’s Kit',
  kit: {
    id: 'beast_catchers_kit', single: true,
    name: 'Beast-Catcher’s Kit', crafted: 'Workshop · Handyman',
    what: 'A weighted capture net, binding ropes and a handler’s whip in one roll. The net restrains a Large or smaller beast (DC 10 Strength to escape). The ropes and whip handle the tie-down and control.',
    kinds: ['fellcat', 'dire_wolf', 'buckbear', 'griffin', 'sabrecat', 'wyvern']
  },
  oddsHeading: 'Improve the odds',
  oddsIntro: 'Ten craftable items lower the final capture DC, but only when they suit the beast being caught.',
  items: [
    { id: 'beast_collar_lead', name: 'Beast-Collar & Lead', crafted: 'Workshop · Smith', what: 'A fitted collar and lead for a calm beast. It makes handling and leading it home easier.', kinds: ['fellcat', 'dire_wolf', 'griffin'] },
    { id: 'beast_chain_rig', name: 'Beast-Chain Rig', crafted: 'Workshop · Smith', what: 'A forge-chain harness for the strongest beasts. If the beast wakes early, it needs DC 20 Strength to break free.', kinds: ['buckbear', 'sabrecat', 'wyvern'] },
    { id: 'stillroot_salve', single: true, name: 'Stillroot Salve', crafted: 'Workshop · Alchemist', what: 'A Tellurian calming salve that lowers aggression without sedating the beast.', kinds: ['fellcat', 'griffin', 'buckbear'] },
    { id: 'dreamroot_salve', single: true, name: 'Dreamroot Salve', crafted: 'Workshop · Alchemist', what: 'A sedative salve that works only on a beast at or below half HP. A failed dose only poisons it, and an overdose can kill a smaller beast.', kinds: ['buckbear', 'sabrecat', 'wyvern'] },
    { id: 'beast_salve', single: true, name: 'Beast Salve', crafted: 'Workshop · Alchemist', what: 'Stabilises and heals the captive on the way home, so a hard fight does not cost the party the beast.', kinds: ['fellcat', 'dire_wolf', 'buckbear', 'griffin', 'sabrecat', 'wyvern'], note: 'heals the captive; does not lower the DC' },
    { id: 'scent_lure', single: true, name: 'Scent Lure', crafted: 'Workshop · Alchemist', what: 'Draws the beast onto ground the party chooses. Advantage on the approach or ambush.', kinds: ['fellcat', 'dire_wolf', 'griffin'] },
    { id: 'falconers_hood_jesses', name: 'Falconer’s Hood & Jesses', crafted: 'Workshop · Artisan', what: 'Calms a raptor-type beast and controls its head and talons.', kinds: ['griffin'] },
    { id: 'jaw_strap_tail_sheath', name: 'Jaw-Strap & Tail Sheath', crafted: 'Workshop · Artisan', what: 'Binds the jaws and caps the stinger. The only safe way to handle a wyvern.', kinds: ['wyvern'] },
    { id: 'handlers_gauntlets', name: 'Handler’s Gauntlets', crafted: 'Workshop · Artisan', what: 'Heavy forearm guards for grappling and fitting gear. Advantage on the grapple and tie-down.', kinds: ['buckbear', 'sabrecat'] },
    { id: 'beast_muzzle', name: 'Beast Muzzle', crafted: 'Workshop · Artisan', what: 'Stops the bite while the party works.', kinds: ['fellcat', 'dire_wolf', 'sabrecat'] }
  ],
  loadoutsHeading: 'Best-fit loadouts',
  loadoutsIntro: 'Each beast has three best-fit items, and only those three lower its capture DC. Any other item can still be crafted but does nothing for that beast.',
  loadouts: {
    fellcat: ['stillroot_salve', 'scent_lure', 'beast_muzzle'],
    dire_wolf: ['scent_lure', 'beast_collar_lead', 'beast_muzzle'],
    buckbear: ['beast_chain_rig', 'handlers_gauntlets', 'stillroot_salve'],
    griffin: ['falconers_hood_jesses', 'scent_lure', 'beast_collar_lead'],
    sabrecat: ['beast_chain_rig', 'handlers_gauntlets', 'dreamroot_salve'],
    wyvern: ['jaw_strap_tail_sheath', 'beast_chain_rig', 'dreamroot_salve']
  },
  plural: { fellcat: 'Fellcats', dire_wolf: 'Dire Wolves', buckbear: 'Buckbears', griffin: 'Griffins', sabrecat: 'Sabrecats', wyvern: 'Wyverns' },
  howHeading: 'How it plays',
  howIntro: 'A capture runs in two beats, with a short carry home between them. The Explorer\'s Grant a creature makes the Settle check, and the Beast Pen asks for the acclimatise roll.',
  how: [
    { label: 'Subdue', text: 'The kit lets the party attempt a non-lethal capture. They reduce the beast to 0 HP or net it. The beast wakes after about 1d4 hours.' },
    { label: 'Settle', text: 'An Animal Handling check, made when the DM grants the creature in the Explorer, with a Beast-Catcher’s Kit from the Travel bags (no kit, no grant). The base DC is 15 for Fellcat, Dire Wolf, Buckbear and Sabrecat, and 17 for Griffin and Wyvern. Each best-fit item the party carries gives −2, so a fully kitted party faces DC 9 or 11.' },
    { label: 'Failure', text: 'The beast is still captured but arrives Wary: at the Beast Pen it needs DC 20 to acclimatise, instead of its own 15 or 17.' },
    { label: 'Reuse', text: 'The kit, salves and Scent Lure are used up when the creature is granted. The Chain Rig, Collar & Lead, Hood & Jesses, Tail Sheath, Gauntlets and Muzzle are reusable.' },
    { label: 'The carry home', text: 'There is no crate or cage item. The trip to the Beast Pen is narrative, or a short Explorer journey, and the Collar & Lead or Chain Rig covers it.' }
  ]
};
