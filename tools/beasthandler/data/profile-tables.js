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
   - Regional Variety: five for each kind (six for the Dire Wolf, which has
     Blacktide as well), picked or typed. The first meeting rolls it for the
     Bastion, which fixes the answer for each kind (data/initiation-data.js).
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
        { id: 'widowspine', name: 'Widowspine', area: 'The Black Straits', where: 'Sea stacks, storm-lashed cliffs and narrow coastal passages', appearance: 'Near-black, wet-slate scales; long ivory-white spines; narrow, ragged silver-edged wings; and an elongated, backward-curving black tail barb. Older specimens develop salt-crusted horns.' },
        { id: 'bleakhook', name: 'Bleakhook', area: 'North Isle', where: 'Bleakharbour and the exposed northern coastline of Clan Karr', appearance: 'Broad-chested, with steel-blue and frost-grey scales, a white throat and underbelly, forward-hooked horns, and dark blue wing membranes streaked with pale markings.' },
        { id: 'ironcrown', name: 'Ironcrown', area: 'Midland Province', where: 'The Fangs, Middlemount and the surrounding rugged highlands', appearance: 'Muscular and heavily armoured, with iron-grey scales, a broad chest, thick uneven crown-horns, powerful hindquarters and wide wings. Older specimens develop copper and ochre markings.' },
        { id: 'bloodcrest', name: 'Bloodcrest', area: 'East Isle', where: 'The red-cliff coastline, sea caves and approaches around Eastlake', appearance: 'Deep crimson to burnt-rust scales, a pale bone-coloured chest, black-tipped crown spines, translucent wine-red wing membranes, a recurved dark stinger and brilliant golden eyes.' },
        { id: 'shadowmount', name: 'Shadowmount', area: 'Western Province', where: 'Shadow Mountains and the high, exposed approaches to the Aurushi lands', appearance: 'Charcoal-black scales, pale ash-grey wing membranes, long swept-back horns and muted bronze-gold markings around the head, chest and wings. Exceptionally long wings and an angular silhouette.' }
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
        { id: 'dawnmantle', name: 'Dawnmantle', area: 'Western Province', where: 'Sunlit western highlands and the approaches to the House of the Sun', appearance: 'Ivory-white eagle head, brilliant golden neck and wing feathers, a tawny lion body, an impressive golden throat mantle, pale gold beak and dark copper-coloured talons.' },
        { id: 'thunderwing', name: 'Thunderwing', area: 'Midland Province', where: 'The Fangs and their exposed ridgelines', appearance: 'Broad-winged, with dark steel-grey feathers, a silver-white eagle head, charcoal wing tips, ash-grey leonine hindquarters, black foretalons and thick protective breast plumage.' },
        { id: 'silvershroud', name: 'Silvershroud', area: 'East Isle', where: 'The shores and mist-covered approaches of Eastlake, near Swyth', appearance: 'Slender and elegant, with pale silver plumage, a white eagle head, a lean cream-coloured lion body, dark slate-edged wing feathers and a distinctive black tail tuft.' },
        { id: 'galeclaw', name: 'Galeclaw', area: 'Northern Province', where: 'Northwatch Beacon and the rugged northern coastline', appearance: 'Dark brown eagle head, silver-grey neck and shoulder feathers, chestnut lion hindquarters, extraordinarily long black-tipped wings, pale wing markings and sharp golden eyes.' },
        { id: 'embermantle', name: 'Embermantle', area: 'Western Province', where: 'Redport and the western coastal cliffs', appearance: 'Dark copper-and-black eagle head, thick fiery-russet feather mantle, deep tawny lion body and bronze wings that darken to black at the edges.' }
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
        { id: 'nightfang', name: 'Nightfang', area: 'Northern Province', where: 'Nightwood, its old forest roads and deeper woodland', appearance: 'Long, almost-black fur with silver guard hairs, pale golden eyes, a narrow muzzle, unusually tall ears and broad paws. Older animals develop a distinctive grey mantle.' },
        { id: 'icepelt', name: 'Icepelt', area: 'North Isle', where: 'Bleaker\'s Bay, Bleakharbour and the northern coastal uplands', appearance: 'Huge and thickset, with dense white-grey fur, a dark slate ridge down the spine, black lower legs, exceptionally thick shoulder fur and pale blue or amber eyes.' },
        { id: 'slatejaw', name: 'Slatejaw', area: 'Midland Province', where: 'Middlemount, rocky uplands and the foothills of the Fangs', appearance: 'Stocky, with dense granite-grey fur, a powerful neck, broad paws and a dark muzzle. Rust and earth-brown markings cover the shoulders and haunches.' },
        { id: 'reedshadow', name: 'Reedshadow', area: 'Midland Province', where: 'The River Rook and its surrounding riverbanks and low-lying ground', appearance: 'Lean and long-legged, with rich umber fur, dark olive-brown guard hairs, a pale underside, shorter fur around the legs and distinctive dark markings around the eyes.' },
        { id: 'hollowhowl', name: 'Hollowhowl', area: 'Western Province', where: 'The Shadow Mountains, secluded passes and rocky mountain valleys', appearance: 'Dark smoke-brown fur, a long black mane around the neck and shoulders, silver-grey markings along the muzzle and brows, and mottled stone-coloured patches.' },
        { id: 'blacktide', name: 'Blacktide', area: 'The Black Straits (South) and Bolt Isle', where: 'Surf-cut rocks, wreck beaches, smugglers\' coves and pirate havens', appearance: 'Powerful wolf with tangled wet charcoal-black upper fur, pale grey-cream face, chest and legs, broad coastal paws, vivid sea-green eyes and a heavy dark tail.' }
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
        { id: 'broadcrown', name: 'Broadcrown', area: 'Northern Province (Clan Blackstone)', where: 'The old-growth forests around Nightwood', appearance: 'The largest variety; a shaggy, dark-brown coat with tawny-gold tips, heaviest in a ruff around the neck and shoulders; tall, wide pale antlers with many upturned points, forming a crown; amber eyes and long, pale claws; usually found among moss, ferns and forest streams.' },
        { id: 'shovelhorn', name: 'Shovelhorn', area: 'North Isle (Clan Karr)', where: 'The frozen country around Coldpass', appearance: 'Stocky and heavily built; a thick double coat from cream to smoke-grey; small, rounded ears; broad, flat antlers like a moose\'s, which it uses to scrape snow off food.' },
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
        { id: 'lichenback', name: 'Lichenback', area: 'The northern highlands', where: 'The northern highlands', appearance: 'Leaner, built for rock rather than snow; a grey coat mottled grey-green like lichen, turning frost-white in winter; the longest ear tufts and a shorter tail; hard, scarred paw pads. Camouflage: frost-covered stone.' },
        { id: 'tawnyfell', name: 'Tawnyfell', area: 'Midland Province (Clan Bacca)', where: 'The scree and lower slopes of The Fangs', appearance: 'A shorter coat, smoke-brown to tawny-grey; longer legs; hunts at dusk below the snowline. Camouflage: scree and twilight.' },
        { id: 'smokecoat', name: 'Smokecoat', area: 'Western Province (Clan Farmer)', where: 'The high gorges of the Shadow Mountains', appearance: 'The smallest and rarest variety; a charcoal-grey coat with near-black rosettes; hunts at night. Camouflage: darkness and shadowed rock.' }
      ]
    }
  }
};

/* Which orders a player may ask for from the phone (Harry, 21 October 2026,
   D5: free training only; the DM keeps anything that costs gold, and every
   milestone). The rule: a training programme (trains) that costs no gold.
   The riding harness (150 gp) is therefore the DM's; so are the House
   orders, bond confirmation, handler changes and the first flight. Put an
   order's id in denyIds to take it off the list. */
window.TSI_DATA.beastPlayerOrders = {
  version: 1,
  rule: 'free_training',
  denyIds: []
};
