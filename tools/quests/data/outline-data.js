/* Notice Board Quest Generator: the word lists for quest outlines.
   Copied word for word from the old tool (scarlett-isles-quest-generator/app.js,
   buildOutlineFromQuest). The order of each list matters: a quest's outline is
   picked from these lists by its id, so reordering a list changes the outlines
   of quests accepted from then on.

   {placeholders} in the beats are filled in from the quest:
   {contact} the quest's NPC, {settlement}, {province}, {faction}.

   Two known wording quirks are kept as they were (KNOWN_ISSUES): the
   "Root-Woken" and "Vein-touched" enemies and "roots" (QST-19, Harry's
   answer N5), and the mismatched quote marks ‘…' (QST-24). */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.questOutlines = {
  encounterTypes: ['Combat', 'Chase', 'Standoff', 'Ambush'],

  enemies: {
    Investigation: ['Root-Woken Scouts', 'Vein-touched Wolves', 'Smuggler Cutthroats', 'Warden Renegades'],
    Intrigue: ['Blackmail Crew', 'Counterfeit Ring', 'Temple Agents', 'Dockside Enforcers'],
    Escort: ['Road Ambushers', 'Raiders', 'Saboteur Cell', 'Beast in the Brush'],
    Retrieval: ['Lockhouse Thieves', 'Relic-Hunters', 'Tomb-Robbers', 'False Priests'],
    Diplomacy: ['Hotheaded Duelists', 'Toll-Gang Lieutenants', 'Rival Delegates (armed)', 'Mob of Agitators'],
    Exploration: ['Boundary Wardens', 'Reef Predators', 'Cave Stalkers', 'Lost Patrol (hostile from fear)'],
    Military: ['Bandit Toll-Fort', 'Zealot Vanguard', 'Warband Scouts', 'Corrupted Brutes'],
    Bounty: ['Wanted Lieutenant', 'Smuggler Captain', 'Deserter Sergeant', 'Fence\'s Bodyguards'],
    Trade: ['Tariff Forgers', 'Registry Saboteurs', 'Warehouse Breakers', 'Rival Brokers']
  },
  /* Used when a quest type has no list above (only the one Rescue quest: QST-18). */
  unknownEnemy: ['Unknown Threat'],

  twists: [
    'The ‘villain\' is being coerced by someone higher up.',
    'The obvious suspect is a planted distraction.',
    'The target isn\'t malicious, just terrified and cornered.',
    'A faction witness arrives mid-scene and complicates everything.'
  ],

  checks: {
    Investigation: [
      { skill: 'Investigation', dc: 13, win: 'Find the key clue that points to the real location.' },
      { skill: 'Perception', dc: 12, win: 'Spot the detail everyone else missed.' },
      { skill: 'Insight', dc: 12, win: 'Clock who\'s lying or withholding.' }
    ],
    Intrigue: [
      { skill: 'Insight', dc: 13, win: 'Read the room and identify leverage.' },
      { skill: 'Deception or Persuasion', dc: 14, win: 'Get access without raising alarms.' },
      { skill: 'Stealth', dc: 13, win: 'Tail the suspect unseen.' }
    ],
    Escort: [
      { skill: 'Survival', dc: 13, win: 'Choose the safe route and avoid the worst ground.' },
      { skill: 'Perception', dc: 12, win: 'Spot the ambush early.' },
      { skill: 'Animal Handling or Intimidation', dc: 13, win: 'Break enemy morale or calm mounts.' }
    ],
    Retrieval: [
      { skill: 'Investigation', dc: 13, win: 'Locate the item\'s last known trail.' },
      { skill: 'Thieves\' Tools or Sleight of Hand', dc: 14, win: 'Bypass a lock, seal, or ward.' },
      { skill: 'Arcana or Religion', dc: 13, win: 'Identify the magical ‘catch\' on the item.' }
    ],
    Diplomacy: [
      { skill: 'Persuasion', dc: 14, win: 'Get both sides to agree to terms.' },
      { skill: 'Insight', dc: 12, win: 'Identify what each side actually wants.' },
      { skill: 'Intimidation', dc: 13, win: 'Stop a fight from starting (briefly).' }
    ],
    Exploration: [
      { skill: 'Survival', dc: 13, win: 'Navigate hazards without losing time.' },
      { skill: 'Nature', dc: 13, win: 'Understand what the environment is ‘doing\'.' },
      { skill: 'Perception', dc: 12, win: 'Notice the danger before it\'s on you.' }
    ],
    Military: [
      { skill: 'Stealth', dc: 13, win: 'Approach unseen and choose your angle.' },
      { skill: 'Athletics', dc: 13, win: 'Force entry or reposition fast.' },
      { skill: 'Intimidation', dc: 14, win: 'Make the leader surrender instead of die.' }
    ],
    Bounty: [
      { skill: 'Investigation', dc: 13, win: 'Confirm the target\'s hideout.' },
      { skill: 'Perception', dc: 12, win: 'Spot escape routes and traps.' },
      { skill: 'Athletics or Acrobatics', dc: 13, win: 'Catch them when they bolt.' }
    ],
    Trade: [
      { skill: 'Investigation', dc: 13, win: 'Trace the paperwork or registry change.' },
      { skill: 'Persuasion', dc: 12, win: 'Get cooperation from a reluctant official.' },
      { skill: 'Insight', dc: 13, win: 'Identify who profits and why.' }
    ]
  },
  /* Used when a quest type has no list above (QST-18). */
  fallbackChecks: [
    { skill: 'Investigation', dc: 13, win: 'Find the thread that ties it together.' }
  ],

  /* Used when a quest has no description. */
  fallbackPremise: 'A notice calls for help.',
  fallbackContact: 'the contact',

  beats: [
    'Briefing: Meet {contact} in {settlement}. Get the real constraint (time, secrecy, or politics).',
    'Lead 1: Follow the first clue through {province} rumours, records, or witnesses.',
    'Pressure: A complication hits (a rival faction, a lie exposed, or the trail goes cold).',
    'Lead 2: Identify the true location of the confrontation (warehouse, grove, dock, road choke-point).',
    'Confrontation: Resolve the main obstacle, then decide what you report back to {faction}.',
    'Aftermath: The outcome shifts local tension in {settlement} (favour gained, heat earned, or a new hook revealed).'
  ],

  complications: [
    'A witness demands protection and won\'t talk otherwise.',
    'A faction messenger arrives with an ultimatum.',
    'The environment turns hostile (fog, roots, tide, tremor).',
    'The party is offered a bribe to walk away.'
  ],

  resolutions: [
    'Return proof to the poster and claim the reward cleanly.',
    'Deliver the truth quietly, but take a side-effect (a rival now knows you).',
    'Solve it publicly to set an example, risking political backlash.'
  ]
};

/* The words on the screen, as the old tool had them. */
window.TSI_DATA.questBoard = {
  title: 'Scarlett Isles Notice Board',
  sub: 'Select province, set honour + party level, then pin fresh hooks.',
  emptyTitle: 'No notices yet.',
  emptyText: ['Hit ', 'Generate', ' and the board will start whispering work your way.'],
  outlineHint: 'Accept a quest, then click it to view an outline here.',
  noAccepted: 'No accepted quests yet.',
  starOn: 'Primary quest for shop',
  starOff: 'Set as primary quest',
  levels: { min: 7, max: 16, start: 7 },
  count: { min: 1, max: 6, start: 3 },
  honour: { min: -3, max: 3, start: 0 },
  /* Every bounty shows for party levels 7 to 10, whatever its own level (QST-16, QST-17: Harry's answers N1 and N2). */
  bountyLevels: { min: 7, max: 10 },
  /* The old pop-out window's size. */
  popoutFeatures: 'popup,width=1100,height=800'
};
