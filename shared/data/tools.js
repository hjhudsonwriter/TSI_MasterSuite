/* The Scarlett Isles: D&D Tool Suite — the list of tools and home-screen groups.
   This is content, so it lives in a data file. When a tool is rebuilt in its
   phase, set built: true and list the files the shell must load for it
   (paths relative to the suite's top folder). art (optional) is a painted
   picture shown behind the tool, as on the home screen.

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
    built: false,
    saves: true,
    desc: 'Manage facilities, turns, events, treasury and staff for your bastion.',
    files: { css: [], js: [] }
  },
  {
    id: 'explorer',
    name: 'Scarlett Isles Explorer',
    group: 'world',
    phase: '8',
    built: false,
    saves: true,
    desc: 'Explore the Isles. Maps, regions, and the world’s moving parts.',
    files: { css: [], js: [] }
  },
  {
    id: 'crest',
    name: 'Clan Crest Creator',
    group: 'players',
    phase: '2',
    built: true,
    saves: false,
    desc: 'Forge your heraldry. Pick parts, roll random, then download a transparent PNG.',
    art: 'shared/art/hero.png',
    files: {
      css: ['tools/crest/crest.css'],
      js: [
        'tools/crest/data/crest-data.js',
        'tools/crest/data/motto-font.js',
        'tools/crest/rules.js',
        'tools/crest/draw.js',
        'tools/crest/tool.js'
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
