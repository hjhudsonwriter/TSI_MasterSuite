/* Scarlett Isles: Beast Handler — the profile tables (Harry's content, 21 October 2026).

   A creature's profile is three short lines in the player's own words, which
   the Beast Handler can roll for fun (a suggestion, never saved until the
   player confirms it) and one cosmetic Regional Variety:
   - Dominant Temperament: one d12 table, the same for every kind of beast.
   - Attachment Cue and Instinctive Trigger: one d8 table each for the
     Wyvern, the Griffin, the Dire Wolf, the Buckbear and the Fellcat. The
     Buckbear and Fellcat d8 tables are DRAFT (22 October 2026): Harry had
     not written them yet, so they are marked `draft: true` for him to
     approve or replace.
   - Regional Variety: every variety Harry has written for each kind (26 October 2026
     spec). Only those marked `rollable: true` can come up at a beast's first
     meeting (two or three for each kind); the rest are on record but nothing
     assigns them for now. The DM can no longer type a variety by hand.
   Rules Harry set: none of this changes a stat, an attack, a resistance,
   training speed or bond progress; a bond of 0 can have a temperament; a
   description never overrides something the DM has established.
   An Instinctive Trigger is a narrative trait, never a saving throw or a
   penalty. The varieties are Scarlett Isles homebrew, not official D&D
   subspecies.

   Spelling is Harry's, exactly. Add a kind or a row here and nothing else
   needs to change. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.beastProfile = {
  version: 1,
  /* The longest a temperament line may be (the Bastion's own limit, R.cleanDevelopment). */
  textMax: 120,
  /* The longest a Regional Variety may be, in letters. */
  regionalMax: 60,

  /* ---------- Dominant Temperament: d12, the same for all three ---------- */
  dominant: {
    dice: 12,
    entries: [
      { roll: 1, label: 'Proud', note: 'Expects respect and dislikes being hurried' },
      { roll: 2, label: 'Territorial', note: 'Protective of its preferred space' },
      { roll: 3, label: 'Watchful', note: 'Constantly observes its surroundings' },
      { roll: 4, label: 'Curious', note: 'Investigates unfamiliar objects and people' },
      { roll: 5, label: 'Independent', note: 'Prefers choosing when to cooperate' },
      { roll: 6, label: 'Protective', note: 'Positions itself between danger and familiar companions' },
      { roll: 7, label: 'Stubborn', note: 'Resists unfamiliar routines' },
      { roll: 8, label: 'Patient', note: 'Calm and deliberate in its movements' },
      { roll: 9, label: 'Excitable', note: 'Reacts energetically to new situations' },
      { roll: 10, label: 'Wary', note: 'Slow to accept unfamiliar people' },
      { roll: 11, label: 'Playful', note: 'Initiates interactions and testing games' },
      { roll: 12, label: 'Fiercely Loyal', note: 'Shows strong attachment to familiar individuals' }
    ]
  },

  /* ---------- By kind of beast ---------- */
  species: {
    wyvern: {
      /* A small, recognisable behaviour that tells the handler it trusts them. */
      attachment: {
        dice: 8,
        entries: [
          { roll: 1, label: 'Low, contented rumble' },
          { roll: 2, label: 'Lowers its head' },
          { roll: 3, label: 'Relaxes its tail' },
          { roll: 4, label: 'Offers its neck for touch' },
          { roll: 5, label: 'Shields handler with wing' },
          { roll: 6, label: 'Taps claw against perch' },
          { roll: 7, label: 'Recognises handler\'s footsteps' },
          { roll: 8, label: 'Circles back without prompting' }
        ]
      },
      /* Something that makes training or an encounter interesting: a narrative trait. */
      trigger: {
        dice: 8,
        entries: [
          { roll: 1, label: 'Unexpected restraint' },
          { roll: 2, label: 'Stranger approaching food' },
          { roll: 3, label: 'Loud metallic ringing' },
          { roll: 4, label: 'Unexpected neck contact' },
          { roll: 5, label: 'Crowded enclosure' },
          { roll: 6, label: 'Thick smoke' },
          { roll: 7, label: 'Movement above its head' },
          { roll: 8, label: 'Rival wyvern nearby' }
        ]
      },
      regional: [
        { id: 'widowspine', name: 'Widowspine', area: 'The Black Straits', where: 'Storm-lashed sea stacks, coastal cliffs and narrow sea passages', appearance: 'Dark slate-to-blue-black scales, pale stone-grey breast, serrated ivory-white neck spines, hooked salt-worn horns, broad ragged silver-grey wing membranes and a long tail ending in a black recurved venom barb.' },
        { id: 'bleakhook', name: 'Bleakhook', area: 'North Isle', where: 'Bleakharbour and the exposed northern coastline of Clan Karr', appearance: 'Broad-chested with icy steel-blue and frost-grey scales, a white throat and underbelly, forward-hooked horns, dark blue-grey wings with pale streaking and powerful cliff-gripping hindlegs.' },
        { id: 'ironcrown', name: 'Ironcrown', rollable: true, area: 'Midland Province', where: 'The Fangs, Middlemount and rugged highland ridges', appearance: 'Massive, heavily armoured wyvern with iron-grey and stone-grey scales, a thick uneven crown of horns, copper-ochre plates around the head and shoulders, broad pale-grey chest, powerful hindquarters and enormous earth-brown wings.' },
        { id: 'bloodcrest', name: 'Bloodcrest', rollable: true, area: 'East Isle', where: 'Red-cliff coastline, sea caves and approaches around Eastlake', appearance: 'Rich crimson and burnt-rust scales, ivory-pale chest, black-tipped crown spines and horns, wide wine-red wing membranes, hooked dark tail stinger and luminous amber-gold eyes.' },
        { id: 'shadowmount', name: 'Shadowmount', area: 'Western Province', where: 't and high approaches to Aurushi lands', appearance: 'Black-charcoal scales with subtle bronze-gold markings, pale ash-grey throat, broad weathered grey wing membranes, long swept-back dark horns and an angular, long-winged silhouette.' },
        { id: 'flamescale', name: 'Flamescale', area: 'Western Province (North)', where: 'The Whip peninsula, hidden coastal dens and red sea cliffs', appearance: 'Intense scarlet-to-crimson scales, black crest and horn tips, broad ivory breast, wide wine-red wings warmed by orange sunlight, powerful hindlegs, black claws and a long thorn-edged tail with a dark hooked barb.' },
        { id: 'leafwing', name: 'Leafwing', rollable: true, area: 'Northern Province (East)', where: 'The Stretch, rolling green hills, ridgelands and river-cut gullies', appearance: 'Olive and moss-green scales, pale cream throat and belly, slender horns, layered leaf-like neck spines, lichen-like markings, broad translucent yellow-green wing membranes with dark vein-like ribs and a long curved venomous tail.' },
        { id: 'razortail', name: 'Razortail', area: 'North Isle', where: 'Icepoint, northern frozen headlands and wind-battered sea cliffs', appearance: 'Angular charcoal-to-slate-black scales, pale frost-grey throat and underside, long swept-back ivory-grey horns, broad silver-grey wing membranes, wiry hindlegs and an exceptionally long saw-edged tail ending in a recurved barb.' }
      ]
    },

    griffin: {
      attachment: {
        dice: 8,
        entries: [
          { roll: 1, label: 'Quiet welcoming chirp' },
          { roll: 2, label: 'Folds wings close' },
          { roll: 3, label: 'Grooms feathers nearby' },
          { roll: 4, label: 'Presents a loose feather' },
          { roll: 5, label: 'Brief beak-to-hand nudge' },
          { roll: 6, label: 'Spreads a wing overhead' },
          { roll: 7, label: 'Waits at its favourite perch' },
          { roll: 8, label: 'Answers handler\'s voice' }
        ]
      },
      trigger: {
        dice: 8,
        entries: [
          { roll: 1, label: 'Confined spaces' },
          { roll: 2, label: 'Unfamiliar horses' },
          { roll: 3, label: 'Rough handling of wings' },
          { roll: 4, label: 'Shrill whistles' },
          { roll: 5, label: 'Sudden flapping banners' },
          { roll: 6, label: 'Another flyer approaching' },
          { roll: 7, label: 'Bright sudden flashes' },
          { roll: 8, label: 'Crowded nesting places' }
        ]
      },
      regional: [
        { id: 'dawnmantle', name: 'Dawnmantle', rollable: true, area: 'Western Province', where: 'Sunlit western highlands and approaches to the House of the Sun', appearance: 'Ivory-white eagle head, brilliant amber-gold neck and wing feathers, magnificent golden throat mantle, tawny lion body, dark copper-coloured talons and bright amber eyes.' },
        { id: 'thunderwing', name: 'Thunderwing', area: 'Midland Province', where: 'The Fangs and their exposed storm-beaten ridgelines', appearance: 'Massive steel-grey wings with black tips, silver-white eagle head, thick layered breast plumage, ash-grey lion hindquarters, powerful black foretalons and fierce golden eyes.' },
        { id: 'silvershroud', name: 'Silvershroud', rollable: true, area: 'East Isle', where: 'Mist-covered shores and approaches of Eastlake near Swyth', appearance: 'Elegant pale-silver and white eagle head, ivory breast, lean cream lion body, long slate-grey to black outer wing feathers, dark-edged flight plumage and a black-tufted tail.' },
        { id: 'galeclaw', name: 'Galeclaw', area: 'Northern Province', where: 'Northwatch Beacon and the rugged northern coastline', appearance: 'Dark chestnut eagle head, silver-grey and ivory throat feathers, extraordinarily long black-tipped wings with pale bands, chestnut lion body, curling dark-tipped tail and golden eyes.' },
        { id: 'embermantle', name: 'Embermantle', area: 'Western Province', where: 'Redport and the western coastal cliffs', appearance: 'Copper-and-black eagle head, fiery orange-russet feather mantle, rich bronze wings darkening to black at the tips, deep tawny lion body and a thick copper-brown tail.' },
        { id: 'gloamquill', name: 'Gloamquill', area: 'Northern Province', where: '(proposed) and ancient crags above Nightwood', appearance: 'Charcoal-black eagle head with green-bronze feather iridescence, broad black-brown wings streaked with muted olive and gold, rich mahogany lion body and brilliant amber eyes.', proposed: true },
        { id: 'wrecktalon', name: 'Wrecktalon', area: 'Bolt Isle', where: 'Salt-scoured (proposed) coves and isolated cliff aeries', appearance: 'Salt-weathered white-and-smoke eagle head, dark hooked beak, slate-black wings with rusty-copper feather tips, sandy-umber lion body, weathered tawny shoulders and a ragged black tail tuft.', proposed: true },
        { id: 'frostcrown', name: 'Frostcrown', area: 'North Isle', where: 'Icepoint\'s (proposed) northern pinnacles', appearance: 'Massive ivory-white eagle head with a stiff feather crown, dark slate-blue outer flight feathers, dense silver-grey shoulder plumage, heavy ash-fawn lion body, pale foretalons and yellow-gold eyes.', proposed: true }
      ]
    },

    dire_wolf: {
      attachment: {
        dice: 8,
        entries: [
          { roll: 1, label: 'Gentle tail movement' },
          { roll: 2, label: 'Leans against handler' },
          { roll: 3, label: 'Brings a favourite object' },
          { roll: 4, label: 'Sits close beside handler' },
          { roll: 5, label: 'Low greeting howl' },
          { roll: 6, label: 'Relaxes its ears' },
          { roll: 7, label: 'Follows familiar footsteps' },
          { roll: 8, label: 'Keeps watch while handler sleeps' }
        ]
      },
      trigger: {
        dice: 8,
        entries: [
          { roll: 1, label: 'Restrictive chains' },
          { roll: 2, label: 'Sudden fire' },
          { roll: 3, label: 'Raised voices' },
          { roll: 4, label: 'Strange predator scents' },
          { roll: 5, label: 'Strangers near handler' },
          { roll: 6, label: 'Separation from pack' },
          { roll: 7, label: 'Thunderstorms' },
          { roll: 8, label: 'Being trapped indoors' }
        ]
      },
      regional: [
        { id: 'nightfang', name: 'Nightfang', area: 'Northern Province', where: 'Wolf roads and deep woodland', appearance: 'Immense almost-black wolf with silver-grey mottling along its shoulders and muzzle, olive-green highlights in forest light, broad paws, tall ears and pale amber to moss-green eyes.' },
        { id: 'icepelt', name: 'Icepelt', area: 'North Isle', where: 'Bleaker\'s Bay, Wolf northern coastal uplands', appearance: 'Huge, heavily furred wolf with a silver-white winter mane and chest, slate-grey to dark-grey back, dense protective shoulder fur, massive paws and piercing ice-blue eyes.' },
        { id: 'slatejaw', name: 'Slatejaw', rollable: true, area: 'Midland Province', where: 'Wolf uplands and foothills of the Fangs', appearance: 'Thickset mountain wolf with a granite-grey face, silver-grey throat and breast, broad paws, a powerful dark muzzle, richly rust-brown flanks and shoulder markings, and amber eyes.' },
        { id: 'reedshadow', name: 'Reedshadow', area: 'Midland Province', where: 'The River Rook, wet riverbanks, reedbeds and low-lying ruins', appearance: 'Large dark riverland wolf with charcoal-to-umber fur, muted olive-green markings along a shaggy shoulder coat, pale grey muzzle, amber-gold eyes and broad paws that blend into wet, moss-covered terrain.' },
        { id: 'hollowhowl', name: 'Hollowhowl', area: 'Western Province', where: 'Wolf secluded passes and rocky valleys', appearance: 'Tall smoke-brown wolf with a ragged black neck mane, pale silver-grey muzzle and brows, mottled slate-grey markings across its chest and legs, powerful paws and golden eyes.' },
        { id: 'sunmane', name: 'Sunmane', area: 'Southern and Western Wolf mountains, hidden valleys and rocky escarpments', where: '', appearance: 'Tall, regal golden wolf with a honey-amber coat, a long burnished copper-red neck and shoulder mantle, cream-white chest, upright ears, elegant muzzle, bright amber eyes, strong pale legs and a full russet tail.' },
        { id: 'blacktide', name: 'Blacktide', rollable: true, area: 'The Black Straits (South) Wolf rocks, wreck beaches, smugglers\' coves and pirate havens', where: '', appearance: 'Powerful wolf with tangled wet charcoal-black upper fur, pale grey-cream face, chest and legs, broad coastal paws, vivid sea-green eyes and a heavy dark tail.' }
      ]
    },

    /* The Buckbear and the Fellcat joined the Beast Pen on 22 October 2026. The five
       varieties of each are Harry's words. The two d8 tables of each are a DRAFT
       written for him to approve or replace (draft: true). */
    buckbear: {
      draft: true,
      attachment: {
        dice: 8, draft: true,
        entries: [
          { roll: 1, label: 'Low, contented huff' },
          { roll: 2, label: 'Lowers its antlers' },
          { roll: 3, label: 'Leans its weight against handler' },
          { roll: 4, label: 'Rubs its cheek on handler\'s arm' },
          { roll: 5, label: 'Shields handler with its bulk' },
          { roll: 6, label: 'Scrapes the ground softly' },
          { roll: 7, label: 'Recognises handler\'s footsteps' },
          { roll: 8, label: 'Settles down close beside handler' }
        ]
      },
      trigger: {
        dice: 8, draft: true,
        entries: [
          { roll: 1, label: 'Unexpected restraint' },
          { roll: 2, label: 'Strangers near its food' },
          { roll: 3, label: 'Sudden fire' },
          { roll: 4, label: 'Blaring horns' },
          { roll: 5, label: 'Hands on its antlers' },
          { roll: 6, label: 'Crowded enclosure' },
          { roll: 7, label: 'Rival buckbear scent' },
          { roll: 8, label: 'Unsteady ground underfoot' }
        ]
      },
      regional: [
        { id: 'broadcrown', name: 'Broadcrown', rollable: true, area: 'Northern Province (Clan Blackstone)', where: 'The old-growth forests around Nightwood', appearance: 'The largest variety; a shaggy, dark-brown coat with tawny-gold tips, heaviest in a ruff around the neck and shoulders; tall, wide pale antlers with many upturned points, forming a crown; amber eyes and long, pale claws; usually found among moss, ferns and forest streams.' },
        { id: 'shovelhorn', name: 'Shovelhorn', rollable: true, area: 'North Isle (Clan Karr)', where: 'The frozen country around Coldpass', appearance: 'Stocky and heavily built; a thick double coat from cream to smoke-grey; small, rounded ears; broad, flat antlers like a moose\'s, which it uses to scrape snow off food.' },
        { id: 'cragbuck', name: 'Cragbuck', area: 'Midland Province (Clan Bacca)', where: 'The slopes of The Fangs', appearance: 'Lean and long-legged; a slate-grey coat with silver flecks; short antlers with few points, swept back close to the skull so they don\'t catch on rock; a sure-footed climber.' },
        { id: 'fenwallow', name: 'Fenwallow', area: 'Eastern Province (Clan Slade)', where: 'The marshes and waterways', appearance: 'Low and heavy; an oily, dark-brown coat that sheds water and is usually caked in mud; wide, splayed paws for bog ground; short, forward-curving antlers often hung with reeds; a strong swimmer.' },
        { id: 'saltcoat', name: 'Saltcoat', area: 'East Isle (Clan Rowthorn)', where: 'The coast and forest edges', appearance: 'The smallest variety; a russet-red coat bleached paler at the tips by salt and sun; narrow antlers with a slight forward hook; forages rock pools and the tideline for shellfish and fish.' }
      ]
    },

    fellcat: {
      draft: true,
      attachment: {
        dice: 8, draft: true,
        entries: [
          { roll: 1, label: 'Slow, trusting blink' },
          { roll: 2, label: 'Low, rumbling purr' },
          { roll: 3, label: 'Head-butts handler\'s hand' },
          { roll: 4, label: 'Leaves a small catch nearby' },
          { roll: 5, label: 'Grooms close to handler' },
          { roll: 6, label: 'Curls its tail around handler' },
          { roll: 7, label: 'Keeps watch from a high ledge' },
          { roll: 8, label: 'Appears silently at handler\'s side' }
        ]
      },
      trigger: {
        dice: 8, draft: true,
        entries: [
          { roll: 1, label: 'Being grabbed from behind' },
          { roll: 2, label: 'Sudden bright light' },
          { roll: 3, label: 'Loud metallic clanging' },
          { roll: 4, label: 'Rival fellcat scent' },
          { roll: 5, label: 'Being cornered' },
          { roll: 6, label: 'Soaking wet fur' },
          { roll: 7, label: 'Strangers reaching for its ears' },
          { roll: 8, label: 'Crowds and shouting' }
        ]
      },
      regional: [
        { id: 'mistveil', name: 'Mistveil', area: 'North Isle (Clan Karr)', where: 'The coast and fog banks of Bleaker\'s Bay', appearance: 'A thick silver coat with faint smoke-grey rosettes; tufted ears and oversized paws; pale grey-green eyes; fur that holds a damp sheen from the sea air. Camouflage: sea mist.' },
        { id: 'whiteout', name: 'Whiteout', area: 'Icepoint', where: 'Icepoint', appearance: 'The palest and heaviest variety; an almost pure white coat with barely visible markings; the deepest fur, with fur-covered paw pads; a long, thick tail it wraps over its face when resting; ice-blue eyes. Camouflage: snow.' },
        { id: 'lichenback', name: 'Lichenback', rollable: true, area: 'The northern highlands', where: 'The northern highlands', appearance: 'Leaner, built for rock rather than snow; a grey coat mottled grey-green like lichen, turning frost-white in winter; the longest ear tufts and a shorter tail; hard, scarred paw pads. Camouflage: frost-covered stone.' },
        { id: 'tawnyfell', name: 'Tawnyfell', area: 'Midland Province (Clan Bacca)', where: 'The scree and lower slopes of The Fangs', appearance: 'A shorter coat, smoke-brown to tawny-grey; longer legs; hunts at dusk below the snowline. Camouflage: scree and twilight.' },
        { id: 'smokecoat', name: 'Smokecoat', rollable: true, area: 'Western Province (Clan Farmer)', where: 'The high gorges of the Shadow Mountains', appearance: 'The smallest and rarest variety; a charcoal-grey coat with near-black rosettes; hunts at night. Camouflage: darkness and shadowed rock.' }
      ]
    }
  }
};
