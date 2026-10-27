/* The Scarlett Isles: D&D Tool Suite — the list of tools and home-screen groups.
   This is content, so it lives in a data file. When a tool is rebuilt in its
   phase, set built: true and list the files the shell must load for it
   (paths relative to the suite's top folder). art (optional) is a painted
   picture shown behind the tool, as on the home screen. single: true keeps
   the tool to one window at a time (shared/js/toollock.js).

   Card descriptions: the four the old hub page had are copied word for word
   (scarlett-isles-dnd/index.html). The others use each tool's own wording. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.groups = [
  { id: 'dm', label: 'DM Tool' },
  { id: 'world', label: 'World' },
  { id: 'players', label: 'Players' },
  { id: 'set', label: 'Set Pieces' }
];

window.TSI_DATA.tools = [
  {
    id: 'encounter',
    name: 'Combat Tracker & VTT Battlemap',
    group: 'dm',
    phase: '7',
    built: true,
    saves: true,
    desc: 'Run fights smoothly: initiative, notes, conditions and momentum.',
    /* The wide crest, faint behind the desk, as in the old tool. */
    art: 'shared/art/logo-crest-wide.png',
    files: {
      css: ['tools/encounter/encounter.css'],
      js: ['tools/encounter/rules.js', 'tools/encounter/tool.js']
    },
    /* The Battlemap: the map with its controls, which the DM drags to the TV. */
    playerViews: {
      battlemap: {
        css: ['tools/encounter/battlemap.css'],
        js: ['shared/js/modal.js', 'tools/encounter/rules.js', 'tools/encounter/battlemap.js']
      }
    }
  },
  {
    id: 'quests',
    name: 'Notice Board Quest Generator',
    group: 'dm',
    phase: '4',
    built: true,
    saves: true,
    desc: 'Generate quests fast, keep your hooks sharp, and your plots sharper.',
    files: {
      css: ['tools/quests/board.css', 'tools/quests/quests.css'],
      js: [
        'tools/quests/data/quests-data.js',
        'tools/quests/data/outline-data.js',
        'tools/quests/lib/firebase/firebase-app-compat.js',
        'tools/quests/lib/firebase/firebase-database-compat.js',
        'tools/quests/shop-link.js',
        'tools/quests/rules.js',
        'tools/quests/board.js',
        'tools/quests/tool.js'
      ]
    },
    /* The players' pop-out board. */
    playerViews: {
      noticeboard: {
        css: ['tools/quests/board.css', 'tools/quests/player.css'],
        js: ['tools/quests/data/outline-data.js', 'tools/quests/board.js', 'tools/quests/player.js']
      }
    }
  },
  {
    id: 'bastion',
    name: 'The Ironbow Bastion Manager',
    group: 'dm',
    phase: '9',
    built: true,
    saves: true,
    /* One window at a time (shared/js/toollock.js): it applies the Explorer's changes. */
    single: true,
    desc: 'Manage facilities, orders and the treasury for your bastion, day by day with the Explorer.',
    files: {
      css: ['tools/bastion/bastion.css', 'tools/beasthandler/dm-panel.css'],
      js: [
        'tools/bastion/data/bastion-data.js',
        'tools/bastion/data/facilities-data.js',
        'tools/bastion/data/tools-data.js',
        'tools/bastion/data/compendium-data.js',
        'tools/bastion/data/research-data.js',
        'tools/bastion/data/goods-data.js',
        'tools/bastion/data/commerce-data.js',
        'tools/bastion/data/courier-data.js',
        'tools/bastion/data/creatures-data.js',
        'tools/bastion/data/player-panels-data.js',
        'tools/bastion/rules.js',
        'tools/bastion/strip-back-rules.js',
        'tools/bastion/commerce-rules.js',
        'tools/bastion/courier-rules.js',
        'tools/bastion/creature-rules.js',
        /* The Temple (22 October 2026): Pray and Receive Blessing. */
        'tools/bastion/temple-rules.js',
        /* The Prison Tower (26 October 2026): cells, sentences, interrogation. */
        'tools/bastion/prison-rules.js',
        'tools/bastion/diplomacy-rules.js',
        /* The Beast Handler's link (21 October 2026): the Bastion checks and applies each request from a
           player's companion once, and the DM's panel makes the codes that link a phone. */
        'shared/js/hmac.js',
        'tools/beasthandler/data/profile-tables.js',
        'tools/beasthandler/data/initiation-data.js',
        'tools/beasthandler/projection.js',
        'tools/beasthandler/profile-rules.js',
        'tools/beasthandler/codes.js',
        /* The phone link (S17): the QR code maker and its drawing, the rules of the link, and the OPTIONAL online link
           (switched off, and it does nothing at all, until the DM switches it on and relay-config.js holds an address). */
        'tools/beasthandler/lib/qrcode.js',
        'tools/beasthandler/qr.js',
        'tools/beasthandler/link-rules.js',
        'tools/beasthandler/seal.js',
        'tools/beasthandler/relay-config.js',
        'tools/beasthandler/relay.js',
        'tools/beasthandler/publisher.js',
        'tools/beasthandler/bastion-link.js',
        'tools/beasthandler/dm-panel.js',
        /* The Explorer's rules, only to check its half of a campaign file
           on Import (the Explorer and the Bastion save as one campaign). */
        'tools/explorer/rules.js',
        'tools/explorer/journey.js',
        'tools/bastion/player-view-rules.js',
        'tools/bastion/tool.js'
      ]
    },
    /* The Player View (26 October 2026): the Bastion for the TV, view-only, fed by a snapshot of what players may see. */
    playerViews: {
      bastion: {
        css: ['tools/bastion/player-view.css'],
        js: [
          'tools/bastion/data/bastion-data.js',
          'tools/bastion/data/player-panels-data.js',
          'tools/bastion/player-view.js'
        ]
      }
    }
  },
  {
    id: 'explorer',
    name: 'Scarlett Isles Explorer',
    group: 'world',
    phase: '8',
    built: true,
    saves: true,
    /* One window at a time (shared/js/toollock.js): it sends changes to the Bastion. */
    single: true,
    desc: 'Explore the Isles. Maps, regions, and the world’s moving parts.',
    /* The painted hero art behind the Explorer, as in the old tool. */
    art: 'shared/art/hero.png',
    files: {
      css: ['tools/explorer/explorer.css'],
      js: [
        'tools/explorer/data/explorer-data.js',
        /* Harry's new travel and campfire events (6 October 2026). The old
           601 events in data/events-data.js are switched off: kept, not loaded. */
        'tools/explorer/data/journey-events.js',
        'tools/explorer/data/fights-data.js',
        'tools/explorer/data/terrain-data.js',
        /* The Bastion's creatures (pull request 7): the kinds the DM can
           grant in the Explorer, and their names. */
        'tools/bastion/data/creatures-data.js',
        'tools/explorer/rules.js',
        'tools/explorer/draw.js',
        'tools/explorer/player-view-rules.js',
        'tools/explorer/journey.js',
        'tools/explorer/fights.js',
        /* The Bastion's rules, only to check its half of a campaign file
           on Import (the Explorer and the Bastion save as one campaign). */
        'tools/bastion/rules.js',
        'tools/bastion/strip-back-rules.js',
        'tools/explorer/tool.js'
      ]
    },
    /* The Player View (26 October 2026): the map for the TV, view-only, drawn by the Explorer's own drawing code. */
    playerViews: {
      explorer: {
        css: ['tools/explorer/player-view.css'],
        js: ['tools/explorer/rules.js', 'tools/explorer/draw.js', 'tools/explorer/player-view.js']
      }
    }
  },
  {
    id: 'crest',
    name: 'Clan Crest Creator',
    group: 'players',
    phase: '2',
    built: true,
    saves: true,
    desc: 'Forge your heraldry. Pick parts, roll random, then download a transparent PNG.',
    art: 'shared/art/hero.png',
    files: {
      css: ['tools/crest/crest.css'],
      js: [
        'tools/crest/data/crest-data.js',
        'tools/crest/data/motto-font.js',
        'tools/crest/data/shields.js',
        'tools/crest/geometry.js',
        'tools/crest/data/sigils.js',
        'tools/crest/rules.js',
        'tools/crest/draw.js',
        'tools/crest/tool.js'
      ]
    }
  },
  {
    id: 'beasthandler',
    name: 'Scarlett Isles: Beast Handler',
    group: 'players',
    phase: 'BH-1',
    built: true,
    /* It reads the Bastion's save (shared/js/dmdoc.js does the same) and keeps nothing of its own: since 22 October 2026 it only looks, so there is no queue of requests to save. */
    saves: false,
    desc: 'The companions of Ironbow. See your wyvern, griffin, dire wolf, buckbear or fellcat: its bond, Bonding Days, profile and Chronicle. It only looks.',
    /* No painted art behind this tool: its look is plain charcoal and gold (Harry's mock-ups, 21 October 2026). */
    files: {
      css: ['tools/beasthandler/beasthandler.css'],
      js: [
        /* The Bastion's data and rules, read-only: the companion builds the player's view from the Bastion's own save, never its screens. */
        'tools/bastion/data/bastion-data.js',
        'tools/bastion/data/facilities-data.js',
        'tools/bastion/data/tools-data.js',
        'tools/bastion/data/research-data.js',
        'tools/bastion/data/goods-data.js',
        'tools/bastion/data/commerce-data.js',
        'tools/bastion/data/courier-data.js',
        'tools/bastion/data/creatures-data.js',
        'tools/bastion/rules.js',
        'tools/bastion/strip-back-rules.js',
        'tools/bastion/commerce-rules.js',
        'tools/bastion/courier-rules.js',
        'tools/bastion/creature-rules.js',
        'tools/bastion/diplomacy-rules.js',
        'shared/js/hmac.js',
        'tools/beasthandler/data/profile-tables.js',
        'tools/beasthandler/data/art-map.js',
        'tools/beasthandler/projection.js',
        'tools/beasthandler/profile-rules.js',
        'tools/beasthandler/codes.js',
        'tools/beasthandler/link-rules.js',
        'tools/beasthandler/bastion-link.js',
        'tools/beasthandler/model.js',
        'tools/beasthandler/intro.js',
        'tools/beasthandler/view.js',
        'tools/beasthandler/tool.js'
      ]
    }
  },
  {
    id: 'arenas',
    name: 'Arenas of The Scarlett Isles',
    group: 'set',
    phase: '6',
    built: true,
    saves: true,
    desc: 'Swyth: The Salt-Ring Trials and Middlemount: The Lion’s Crown.',
    files: {
      css: ['tools/arenas/arenas.css'],
      js: [
        'tools/arenas/data/arenas-data.js',
        'tools/arenas/rules.js',
        'tools/arenas/tool.js'
      ]
    }
  },
  {
    id: 'ritual',
    name: 'The Heartwood Ritual',
    group: 'set',
    phase: '5',
    built: true,
    saves: false,
    desc: 'The Lullaby of the Rootbound Heart. Tellurian Re-Binding Engine.',
    /* The roots picture; the Ritual lays its own root film and veil over it. */
    art: 'tools/ritual/assets/img/root-background.png',
    files: {
      css: ['tools/ritual/ritual.css'],
      js: [
        'tools/ritual/data/ritual-data.js',
        'tools/ritual/rules.js',
        'tools/ritual/tool.js'
      ]
    }
  },
  {
    id: 'pelagosi',
    name: 'Pelagosi Puzzle Trials',
    group: 'set',
    phase: '3',
    built: true,
    saves: false,
    desc: 'The Marker Remembers and The Tidal Sequence.',
    files: {
      css: ['tools/pelagosi/pelagosi.css'],
      js: [
        'tools/pelagosi/data/pelagosi-data.js',
        'tools/pelagosi/rules.js',
        'tools/pelagosi/tool.js'
      ]
    }
  }
];

/* Links to websites. They open in a new tab and only work online. */
window.TSI_DATA.links = {
  knightlyTreasures: {
    label: 'Knightly Treasures shop',
    url: 'https://mattjowen1991-hue.github.io/scarlett-isles-companion/',
    /* The old hub's own description of the shop (scarlett-isles-dnd/index.html). */
    desc: 'A companion trove of items and treasures for the campaign.'
  }
};
