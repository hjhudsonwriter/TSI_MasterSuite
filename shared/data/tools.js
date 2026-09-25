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
    built: false,
    saves: true,
    desc: 'Run fights smoothly: initiative, notes, conditions and momentum.',
    files: { css: [], js: [] }
  },
  {
    id: 'quests',
    name: 'Notice Board Quest Generator',
    group: 'dm',
    phase: '4',
    built: false,
    saves: true,
    desc: 'Generate quests fast, keep your hooks sharp, and your plots sharper.',
    files: { css: [], js: [] }
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
    built: false,
    saves: true,
    desc: 'Swyth: The Salt-Ring Trials and Middlemount: The Lion’s Crown.',
    files: { css: [], js: [] }
  },
  {
    id: 'ritual',
    name: 'The Heartwood Ritual',
    group: 'set',
    phase: '5',
    built: false,
    saves: false,
    desc: 'The Lullaby of the Rootbound Heart. Tellurian Re-Binding Engine.',
    files: { css: [], js: [] }
  },
  {
    id: 'pelagosi',
    name: 'Pelagosi Puzzle Trials',
    group: 'set',
    phase: '3',
    built: false,
    saves: false,
    desc: 'The Marker Remembers and The Tidal Sequence.',
    files: { css: [], js: [] }
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
