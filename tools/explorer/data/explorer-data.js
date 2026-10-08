/* Scarlett Isles Explorer: maps, town pins, map-to-map entry points, the
   main campaign events, the weather table and the heroes.
   Everything here was inside the old tool's app.js or data/markers.json and is
   copied word for word, except the positions (see "Positions" below).

   Positions
   ---------
   Pins and entry points are fractions of the map picture: x 0 is the
   picture's left edge and 1 its right edge; y 0 is its top and 1 its bottom.
   (The old tool measured them across the whole map box, so they slid off
   their towns when the window changed shape: EXP-10.)

   The old numbers were converted once. They match the towns drawn on the maps
   when read as placed in the Explorer's full-screen view on Harry's laptop
   (1707 × 1067), so that's how they were converted. Two hidden pins, Port
   Brawdlyn and Fork Farm, land on their towns when read as placed in a
   maximised window instead (a 1200 × 670 map box), so those two were
   converted that way. The entry points were converted from the full-screen
   view, with the old 46px token's half-width added, because each one is where
   the party's centre lands.

   Pick Marker XY in the Explorer gives new positions in this same form. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.explorer = {
  /* The ten province maps (old MAP_PRESETS), in the old order. Every picture is
     2048 × 1536 (4:3). province is the event region the map uses. */
  maps: [
    { id: 'eastern_province_north', label: 'Eastern Province (North)', src: 'tools/explorer/assets/maps/eastern_province_north.jpg', aspect: 4 / 3, province: 'eastern_province' },
    { id: 'eastern_province_south', label: 'Eastern Province (South)', src: 'tools/explorer/assets/maps/eastern_province_south.jpg', aspect: 4 / 3, province: 'eastern_province' },
    { id: 'midland_province', label: 'Midland Province', src: 'tools/explorer/assets/maps/midland_province.jpg', aspect: 4 / 3, province: 'midland_province' },
    { id: 'northern_province_east', label: 'Northern Province (East)', src: 'tools/explorer/assets/maps/northern_province_east.jpg', aspect: 4 / 3, province: 'northern_province' },
    { id: 'northern_province_west', label: 'Northern Province (West)', src: 'tools/explorer/assets/maps/northern_province_west.jpg', aspect: 4 / 3, province: 'northern_province' },
    { id: 'southern_province_east', label: 'Southern Province (East)', src: 'tools/explorer/assets/maps/southern_province_east.jpg', aspect: 4 / 3, province: 'southern_province' },
    { id: 'southern_province_west', label: 'Southern Province (West)', src: 'tools/explorer/assets/maps/southern_province_west.jpg', aspect: 4 / 3, province: 'southern_province' },
    { id: 'the_east_isle', label: 'The East Isle', src: 'tools/explorer/assets/maps/the_east_isle.jpg', aspect: 4 / 3, province: 'the_east_isle' },
    { id: 'the_north_isle', label: 'The North Isle', src: 'tools/explorer/assets/maps/the_north_isle.jpg', aspect: 4 / 3, province: 'the_north_isle' },
    { id: 'western_province_south', label: 'Western Province (South)', src: 'tools/explorer/assets/maps/western_province_south.jpg', aspect: 4 / 3, province: 'western_province' }
  ],

  /* The seven event regions (old PROVINCES), in the Region list's order. */
  provinces: [
    { id: 'northern_province', label: 'Northern Province' },
    { id: 'midland_province', label: 'Midland Province' },
    { id: 'eastern_province', label: 'Eastern Province' },
    { id: 'southern_province', label: 'Southern Province' },
    { id: 'western_province', label: 'Western Province' },
    { id: 'the_north_isle', label: 'The North Isle' },
    { id: 'the_east_isle', label: 'The East Isle' }
  ],

  /* Where the party arrives when you load one map from another (old
     MAP_TRANSITION_SPAWNS): spawns[fromMap][toMap] is the party's centre on
     the new map. The party keeps its formation around that point. Old values
     (fractions of the full-screen map box, a token's top-left corner) are in
     the comments. Three links only go one way, as before (E11). */
  spawns: {
    eastern_province_north: {
      eastern_province_south: { x: 0.3651, y: 0.0494 },   /* old 0.3741, 0.0278 */
      the_east_isle: { x: 0.1399, y: 0.5148 }             /* old 0.1864, 0.4932 */
    },
    eastern_province_south: {
      eastern_province_north: { x: 0.2755, y: 0.9874 },   /* old 0.2994, 0.9658 */
      southern_province_east: { x: 0.9761, y: 0.8292 }    /* old 0.8833, 0.8076 */
    },
    the_east_isle: {
      eastern_province_south: { x: 0.9614, y: 0.3659 }    /* old 0.8710, 0.3443 */
    },
    southern_province_east: {
      southern_province_west: { x: 0.9154, y: 0.0412 },   /* old 0.8327, 0.0196 */
      midland_province: { x: 0.0955, y: 0.6977 }          /* old 0.1494, 0.6761 */
    },
    southern_province_west: {
      southern_province_east: { x: 0.0502, y: 0.3042 },   /* old 0.1117, 0.2826 */
      western_province_south: { x: 0.3562, y: 0.9915 }    /* old 0.3667, 0.9699 */
    },
    midland_province: {
      southern_province_east: { x: 0.2821, y: 0.0402 },   /* old 0.3049, 0.0186 */
      northern_province_west: { x: 0.8717, y: 0.9813 }    /* old 0.7963, 0.9597 */
    },
    northern_province_east: {
      northern_province_west: { x: 0.9644, y: 0.4902 },   /* old 0.8735, 0.4686 */
      the_north_isle: { x: 0.7391, y: 0.9998 }            /* old 0.6858, 0.9782 */
    },
    northern_province_west: {
      northern_province_east: { x: 0.0451, y: 0.4039 },   /* old 0.1074, 0.3823 */
      midland_province: { x: 0.1895, y: 0.0381 }          /* old 0.2278, 0.0165 */
    },
    the_north_isle: {
      northern_province_east: { x: 0.9191, y: 0.0854 }    /* old 0.8358, 0.0638 */
    },
    western_province_south: {
      southern_province_west: { x: 0.6339, y: 0.0443 }    /* old 0.5981, 0.0227 */
    }
  },

  /* Town pins (old data/markers.json), by map. A pin shows only if it has a
     town map (submapImage), as before (E10): 15 show and 18 stay hidden. x, y
     is the tip of the pin. Old values are in the comments. */
  markersByMapId: {
    the_east_isle: [
      { id: 'swyth', label: 'Swyth', x: 0.5091, y: 0.4578, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/swyth.png' },                  /* old 0.5076, 0.4578 */
      { id: 'greymyr', label: 'Greymyr', x: 0.5509, y: 0.1024, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/greymyr.png' },            /* old 0.5424, 0.1024 */
      { id: 'port_brawdlyn', label: 'Port Brawdlyn', x: 0.1858, y: 0.8997, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' }                                          /* old 0.2662, 0.8997 (windowed) */
    ],

    the_north_isle: [
      { id: 'bleakhold', label: 'The Bleakhold', x: 0.5082, y: 0.2629, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/the_bleakhold.png' }, /* old 0.5068, 0.2629 */
      { id: 'bleakharbour', label: 'Bleakharbour', x: 0.5865, y: 0.4634, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/bleakharbour.png' }, /* old 0.5721, 0.4634 */
      { id: 'coldpass', label: 'Coldpass', x: 0.7304, y: 0.6833, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/coldpass.png' }          /* old 0.692, 0.6833 */
    ],

    midland_province: [
      { id: 'middlemount', label: 'Middlemount', x: 0.5293, y: 0.188, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/middlemount.png' }, /* old 0.5244, 0.188 */
      { id: 'pearlsmore', label: 'Pearlsmore', x: 0.3088, y: 0.3648, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                            /* old 0.3407, 0.3648 */
      { id: 'midacre', label: 'Midacre', x: 0.1178, y: 0.0792, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                                  /* old 0.1815, 0.0792 */
      { id: 'colver', label: 'Colver', x: 0.5215, y: 0.6864, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                                    /* old 0.5179, 0.6864 */
      { id: 'standish', label: 'Standish', x: 0.9274, y: 0.3052, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' }                                                 /* old 0.8562, 0.3052 */
    ],

    eastern_province_north: [
      { id: 'wyre', label: 'Wyre', x: 0.5208, y: 0.5364, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                                        /* old 0.5173, 0.5364 */
      { id: 'slades_muster', label: 'Slade’s Muster', x: 0.8334, y: 0.8867, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/slades_muster.png' }, /* old 0.7778, 0.8867 */
      { id: 'randock_farm', label: 'Randock Farm', x: 0.5371, y: 0.1809, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' }                                        /* old 0.5309, 0.1809 */
    ],

    eastern_province_south: [
      { id: 'moorcastle', label: 'Moorcastle', x: 0.4762, y: 0.3227, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/moorcastle.png' }, /* old 0.4802, 0.3227 */
      { id: 'steelport', label: 'Steelport', x: 0.7208, y: 0.634, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                            /* old 0.684, 0.634 */
      { id: 'alum_rest', label: 'Alum Rest', x: 0.1459, y: 0.1367, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                           /* old 0.2049, 0.1367 */
      { id: 'bretan', label: 'Bretan', x: 0.36, y: 0.6576, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/bretan.png' }             /* old 0.3833, 0.6576 */
    ],

    southern_province_east: [
      { id: 'moltenport', label: 'Moltenport', x: 0.8533, y: 0.9021, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                         /* old 0.7944, 0.9021 */
      { id: 'cassmead', label: 'Cassmead', x: 0.0844, y: 0.2004, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                             /* old 0.1537, 0.2004 */
      { id: 'lowland_farm', label: 'Lowland Farm', x: 0.2785, y: 0.073, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' }                                       /* old 0.3154, 0.073 */
    ],

    northern_province_east: [
      { id: 'alderbridge', label: 'Alderbridge', x: 0.1146, y: 0.6246, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/alderbridge.png' }, /* old 0.1788, 0.6246 */
      { id: 'wolfhaven', label: 'Wolfhaven', x: 0.497, y: 0.2754, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/wolfhaven.png' },       /* old 0.4975, 0.2754 */
      { id: 'sodden', label: 'Sodden', x: 0.0874, y: 0.9299, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' }                                                       /* old 0.1562, 0.9299 */
    ],

    northern_province_west: [
      { id: 'nightwood', label: 'Nightwood', x: 0.4222, y: 0.372, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/nightwood.png' },      /* old 0.4352, 0.372 */
      { id: 'lokken', label: 'Lokken', x: 0.1252, y: 0.2662, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                                     /* old 0.1877, 0.2662 */
      { id: 'timberport', label: 'Timberport', x: 0.2163, y: 0.0648, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/timberport.png' }   /* old 0.2636, 0.0648 */
    ],

    southern_province_west: [
      { id: 'fork_farm', label: 'Fork Farm', x: 0.052, y: 0.7049, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                                /* old 0.1667, 0.7049 (windowed) */
      { id: 'goldport', label: 'Goldport', x: 0.6622, y: 0.6237, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/goldport.png' },          /* old 0.6352, 0.6237 */
      { id: 'city_of_coin', label: 'The City of Coin', x: 0.7563, y: 0.0915, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: 'tools/explorer/assets/submaps/the_city_of_coin.png' } /* old 0.7136, 0.0915 */
    ],

    western_province_south: [
      { id: 'westreach', label: 'Westreach', x: 0.423, y: 0.5775, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                               /* old 0.4358, 0.5775 */
      { id: 'shadowhall', label: 'Shadowhall', x: 0.4585, y: 0.0607, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' },                                            /* old 0.4654, 0.0607 */
      { id: 'redport', label: 'Redport', x: 0.1666, y: 0.4778, description: '', thumb: 'tools/explorer/assets/markers/marker_gold.png', submapImage: '' }                                                   /* old 0.2222, 0.4778 */
    ]
  },

  /* Main campaign events (old MAIN_EVENTS). The Queue button plays one at once
     (E5). Line breaks in the letter are as written (shown run together, E12). */
  mainEvents: [
    {
      id: 'tide_remembers_prologue',
      title: 'The Tide Remembers - Prologue',
      steps: [
        {
          id: 'start',
          image: 'tools/explorer/assets/main_events/tide_remembers_1.png',
          text: 'As you make your way through the Isles, a bird descends from the sky, swooping down towards your group.',
          choices: [{ label: 'Continue', next: 'step2' }]
        },
        {
          id: 'step2',
          image: 'tools/explorer/assets/main_events/tide_remembers_2.png',
          text: 'The bird slows its flight, wings flapping as it lands softly on Magnus\' outstretched arm. A roll of parchment is fastened to the birds leg. You carefully remove it, and the bird takes flight.',
          choices: [{ label: 'Continue', next: 'step3' }]
        },
        {
          id: 'step3',
          image: 'tools/explorer/assets/main_events/tide_remembers_3.png',
          text: 'You unroll the parchment, the message reads:\n\nFriends of the East...\nI will not ask you to act yet, but if you are as I remember you to be, you may want to stand witness to the turning of the tide.\nAnd believe me, the tide is turning.\nWill you go to it, or be carried by it?\n\n- Maerys Vell, The Voice of The Tide',
          choices: [{ label: 'Close' }]
        }
      ]
    },
    {
      id: 'turning_tide',
      title: 'The Turning Tide',
      steps: [
        { id: 'start', image: 'tools/explorer/assets/main_events/turning_tide_1.png', text: '', choices: [{ label: 'Continue', next: 't2' }] },
        { id: 't2', image: 'tools/explorer/assets/main_events/turning_tide_2.png', text: '', choices: [{ label: 'Continue', next: 't3' }] },
        { id: 't3', image: 'tools/explorer/assets/main_events/turning_tide_3.png', text: '', choices: [{ label: 'Continue', next: 't4' }] },
        { id: 't4', image: 'tools/explorer/assets/main_events/turning_tide_4.png', text: '', choices: [{ label: 'Continue', next: 't5' }] },
        { id: 't5', image: 'tools/explorer/assets/main_events/turning_tide_5.png', text: '', choices: [{ label: 'Continue', next: 't6' }] },
        { id: 't6', image: 'tools/explorer/assets/main_events/turning_tide_6.png', text: '', choices: [{ label: 'Continue', next: 't7' }] },
        { id: 't7', image: 'tools/explorer/assets/main_events/turning_tide_7.png', text: '', choices: [{ label: 'Continue', next: 't8' }] },
        { id: 't8', image: 'tools/explorer/assets/main_events/turning_tide_8.png', text: '', choices: [{ label: 'Close' }] }
      ]
    }
  ],

  /* Weather (old WEATHER_EVENTS). At camp, once the 3-day wait is over, there's
     a 45% chance of one of these. You roll at the table and type the result.
     results are checked top to bottom: the first whose min the roll reaches
     applies; the last one (no min) is the failure. The save choice is only a
     label, and the effects are text for the table (E7). */
  weatherRules: { cooldownDays: 3, chance: 0.45 },
  weather: [
    {
      id: 'white_blizzard',
      title: 'White Blizzard',
      kind: 'blizzard',
      intro: 'Snow comes suddenly, swallowing colour and distance. The world becomes a white corridor, and every breath feels borrowed.',
      mechanic: { label: 'Group DC 13 Constitution Save', dc: 13, options: null },
      results: [
        { min: 13, headline: 'Success', text: 'You keep blood moving and breath steady. The blizzard bites, but takes nothing.', effect: 'No effect.' },
        { headline: 'Failure', text: 'Cold seeps into joints and resolve. The day costs more than it should.', effect: 'Each character gains 1 level of Exhaustion.' }
      ]
    },
    {
      id: 'black_storm',
      title: 'Black Storm',
      kind: 'storm',
      intro: 'A storm front rolls over the Isles like a closing fist. Wind lashes the grass flat, and thunder prowls just beyond the hills.',
      mechanic: {
        label: 'DC 14 Save (choose one)',
        dc: 14,
        options: [
          { id: 'wis', label: 'Wisdom Save (hold your nerve)' },
          { id: 'dex', label: 'Dexterity Save (dodge debris/mud)' }
        ]
      },
      results: [
        { min: 14, headline: 'Success', text: 'You ride the chaos instead of being ridden by it. Adrenaline turns into focus.', effect: 'Gain Inspiration (for the next day).' },
        { headline: 'Failure', text: 'The thunder gets under your skin. Every snap of wind feels like an ambush.', effect: 'Rattled: no Reactions or Opportunity Attacks in the next day’s first combat encounter.' }
      ]
    },
    {
      id: 'cold_rain',
      title: 'Cold Downpour',
      kind: 'rain',
      intro: 'Rain needles through seams and straps. The road slicks, sounds carry oddly, and your pace becomes a negotiation.',
      mechanic: { label: 'DC 12 Survival Check', dc: 12, options: null },
      results: [
        { min: 17, headline: 'Great Success', text: 'You find a dry pocket of ground and a forgotten cache tucked beneath roots and stone.', effect: 'Dry Cache: roll on a minor loot table.' },
        { min: 12, headline: 'Success', text: 'You keep gear dry enough and spirits steady. Miserable, but manageable.', effect: 'No effect.' },
        { headline: 'Failure', text: 'Everything is damp. Bowstrings slacken, armour sticks, and boots feel like anchors.', effect: 'Soggy Gear: Disadvantage on Initiative rolls for the next day.' }
      ]
    },
    {
      id: 'sun_heatwave',
      title: 'Sun & Heatwave',
      kind: 'sun_heat',
      intro: 'The sun presses down like a weight. Water warms, tempers shorten, and the road shimmers ahead in wavering ribbons.',
      mechanic: {
        label: 'DC 13 Check/Save (choose one)',
        dc: 13,
        options: [
          { id: 'ath', label: 'Athletics (push through the heat)' },
          { id: 'con', label: 'Constitution Save (endure and pace yourself)' }
        ]
      },
      results: [
        { min: 13, headline: 'Success', text: 'You find shade and a cooler draft, maybe even a thin spring trickling through stone.', effect: 'No effect.' },
        { headline: 'Failure', text: 'The heat steals distance and sharpness. Every mile feels doubled.', effect: 'Lethargy: limit travel to 2 hexes (12 miles) today.' }
      ]
    }
  ],

  /* The looping video over the map for the rest of a weather day. */
  weatherVideos: {
    blizzard: 'tools/explorer/assets/overlays/blizzard_overlay.mp4',
    storm: 'tools/explorer/assets/overlays/storm_overlay.mp4',
    rain: 'tools/explorer/assets/overlays/rain_overlay.mp4',
    sun_heat: 'tools/explorer/assets/overlays/sun_heat_overlay.mp4'
  },

  /* The party (old HEROES). */
  heroes: [
    { id: 'kaelen', title: 'Kaelen' },
    { id: 'umbrys', title: 'Umbrys' },
    { id: 'magnus', title: 'Magnus' },
    { id: 'elara', title: 'Elara' },
    { id: 'charles', title: 'Charles' }
  ]
};
