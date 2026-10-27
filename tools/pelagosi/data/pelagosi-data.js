/* Pelagosi Puzzle Trials — content and rule values.
   Everything here is copied word for word from the old tool
   (pelagosi_marker_rune_puzzle/app.js and index.html): the two puzzles'
   texts, the Memory rounds and speeds, the Tidal solution, start layout and
   pressure levels. The screen (tool.js) and rules (rules.js) read it. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.pelagosi = {
  /* ---------- The two puzzles' side-panel texts ---------- */
  modes: {
    memory: {
      name: 'The Marker Remembers',
      eyebrow: 'Pelagosi Memory Trial',
      title: 'The Marker Remembers',
      hero: 'The runes do not sit still. Watch the sequence, hold it in memory, then answer the Marker in kind.',
      inscriptionTitle: 'Inscription',
      inscription: ['“What the sea takes, it names first.', 'What is named, it carries.', 'What is carried, it returns.”'],
      legend: [
        ['⚓', 'Anchor, that which holds'],
        ['☾', 'Tide, that which moves'],
        ['≈', 'Depth, that which waits below'],
        ['✦', 'Life, that which quickens'],
        ['⟡', 'Remains, that which endures']
      ],
      structureTitle: 'Trial Structure',
      structureItems: ['Round I, 3 runes', 'Round II, 4 runes', 'Round III, 5 runes'],
      structureCopy: 'The sequence is shown first. Once it fades, repeat it exactly from five possible rune choices.',
      clueTitle: 'Recovered Impression',
      notes: 'A failed reply unleashes a tidal surge. Any creature within 15 feet must make a DC 12 Dexterity save or be knocked prone and pushed 10 feet.'
    },
    tidal: {
      name: 'The Tidal Sequence',
      eyebrow: 'Pelagosi Flow Trial',
      title: 'The Tidal Sequence',
      hero: 'Four pillars surround the basin. Rotate their runes and currents until the chamber remembers how water should move.',
      inscriptionTitle: 'Wall Inscription',
      inscription: ['“Flow follows memory.', 'Memory seeks depth.', 'Depth breaks upon stone.', 'Stone returns the current.”'],
      legend: [
        ['💧', 'Flow, magic and arcana in motion'],
        ['🐚', 'Echo, memory of the sea'],
        ['≈', 'Depth, hidden truth below'],
        ['🪨', 'Stone, permanence and resistance'],
        ['🌀', 'Current, movement and destiny'],
        ['⚓', 'Anchor, restraint and stability']
      ],
      structureTitle: 'Sequence Rules',
      structureItems: ['Phase I, close the outer current', 'Phase II, wake the central basin', 'Pressure IV, the chamber surges'],
      structureCopy: 'First align the four pillars into Flow → Echo → Depth → Stone. Then name the central basin with the missing final principle.',
      clueTitle: 'Chamber Response',
      notes: 'Wrong checks increase Chamber Pressure. At maximum pressure the chamber surges, resets the Tidal Sequence, and the party faces an in-world consequence.'
    }
  },

  /* ---------- The Marker Remembers ---------- */
  memory: {
    runes: ['anchor', 'tide', 'depth', 'life', 'remains'],
    /* Runes shown per round, and how long each is shown (flash) with the gap after it, in milliseconds. */
    rounds: [
      { length: 3, flash: 950, gap: 260 },
      { length: 4, flash: 700, gap: 220 },
      { length: 5, flash: 520, gap: 180 }
    ],
    roundSuccess: [
      { title: 'ROUND I COMPLETE', text: 'THE MARKER STIRS' },
      { title: 'ROUND II COMPLETE', text: 'THE MEMORY DEEPENS' },
      { title: 'ROUND III COMPLETE', text: 'THE MARKER ACCEPTS THE RETURN' }
    ],
    clues: [
      'The Marker is cycling through something deliberate. It feels less like language than recall.',
      'The first pattern lands cleanly. This is a remembered order, not a random flicker.',
      'A stronger echo follows: the damage to the Marker was deliberate. Something was taken from it.',
      'The restored keystone reveals the truth: the Marker was not broken. The piece was removed deliberately, and its inner face bears an Aurushi sunburst.'
    ],
    idleDescription: 'Three remembered sequences. Each one grows longer and faster, with five possible runes to choose from.',
    rules: {
      eyebrow: 'Ritual Instructions',
      title: 'How the trial works',
      steps: [
        'The Marker will show a short sequence of runes, one after another.',
        'When the display ends, repeat that exact sequence using the five rune buttons below.',
        'There are three rounds. Each round is longer, and the runes appear for less time.',
        'A wrong reply triggers a sea-surge and resets the trial back to the first round.'
      ],
      footnote: 'Watch carefully. Remember the order. Answer the Marker exactly.',
      cancel: 'Not Yet',
      start: 'START TRIAL'
    },
    success: {
      eyebrow: 'Marker Response',
      title: 'The Marker Sinks',
      paragraphs: [
        'The restored keystone settles into place. Pale blue runes flare once across the stone, then the Marker sinks slowly beneath the sea as the tide stabilises around it.',
        'It was never broken. The piece was removed deliberately. On the inner face of the keystone, an etched sunburst marks Aurushi involvement.',
        'The sea closes slowly over the stone. The runes dim. For a moment the water is perfectly still. Then far below… something shifts.'
      ],
      again: 'RUN THE TRIAL AGAIN'
    },
    /* The ending, step by step: [milliseconds after solving, status heading, status text, caption]. */
    ending: [
      [900, 'The tide steadies', 'The Marker sinks slowly beneath the sea. The surrounding water calms and stabilises.', 'The tide stills.'],
      [2100, 'A deliberate removal', 'The Marker was never broken. On the inner face of the keystone, an etched sunburst reveals Aurushi involvement.', 'The truth rises with the silence.'],
      [3400, 'Something shifts below', 'The sea closes slowly over the stone. The runes dim. For a moment the water is perfectly still. Then far below… something shifts.', 'The sea is still.']
    ],
    endingModalAt: 4700,
    failure: {
      stage: 'The sea rejects the order',
      text: 'A tidal surge crashes inward. Any creature within 15 feet must make a DC 12 Dexterity save or be knocked prone and pushed 10 feet. The Marker resets.',
      caption: 'The sequence breaks apart.',
      banner: 'THE SEA REJECTS THE ORDER'
    }
  },

  /* ---------- The Tidal Sequence ---------- */
  tidal: {
    runes: ['flow', 'echo', 'depth', 'stone', 'current', 'anchor', 'life', 'remains', 'tide'], /* the first six keep their order; Life, Remains and Tide are decoys */
    directions: ['up', 'right', 'down', 'left'],
    directionSymbols: { up: '↑', right: '→', down: '↓', left: '←' },
    /* Clockwise around the basin. */
    pillarOrder: ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'],
    /* Where each pillar sits on the chamber picture (% across, % down), and its short name. */
    pillars: {
      topLeft: { x: 40, y: 52, short: 'TL', label: 'top-left' },
      topRight: { x: 60, y: 52, short: 'TR', label: 'top-right' },
      bottomLeft: { x: 40, y: 76, short: 'BL', label: 'bottom-left' },
      bottomRight: { x: 60, y: 76, short: 'BR', label: 'bottom-right' }
    },
    solution: {
      topLeft: { rune: 'flow', direction: 'right' },
      topRight: { rune: 'echo', direction: 'down' },
      bottomRight: { rune: 'depth', direction: 'left' },
      bottomLeft: { rune: 'stone', direction: 'up' }
    },
    /* The starting disorder: indexes into runes and directions. */
    start: {
      topLeft: { runeIndex: 4, directionIndex: 0 },     // Current, up
      topRight: { runeIndex: 5, directionIndex: 3 },    // Anchor, left
      bottomRight: { runeIndex: 2, directionIndex: 2 }, // Depth, down
      bottomLeft: { runeIndex: 1, directionIndex: 1 }   // Echo, right
    },
    basinSolution: 'current',
    basinStartIndex: 5, // Anchor, a tempting wrong answer.
    maxPressure: 4,
    pressure: [
      {
        label: 'Calm',
        effect: 'The chamber is listening. No pressure has built beneath the basin.',
        sound: null
      },
      {
        label: 'Stirring',
        title: 'THE BASIN RIPPLES',
        text: 'Water gathers between the floor stones. The sequence is not rejected outright, but the current fails to close.',
        status: 'The basin ripples. The room has heard you, but the current is incomplete.',
        effect: 'In-world: the basin bubbles and the chamber grows cold. No damage yet.',
        sound: 'waterStir'
      },
      {
        label: 'Rising',
        title: 'THE WATER RISES',
        text: 'A shallow sheet of water spreads across the chamber floor. The pillars grind as if turning somewhere below the stone.',
        status: 'Water rises over the floor. The sequence remains active, but the chamber is now resisting you.',
        effect: 'In-world: ankle-deep water spreads. Treat slick areas as difficult terrain if useful.',
        sound: 'pressureRise'
      },
      {
        label: 'Reversing',
        title: 'THE CURRENT REVERSES',
        text: 'The suspended streams overhead flow backward. Pressure tightens around the basin like a fist.',
        status: 'The overhead water reverses for a heartbeat. Another failure will trigger a full surge.',
        effect: 'In-world: DC 13 STR save near the basin or be pulled 10 feet toward it.',
        sound: 'currentReverse'
      },
      {
        label: 'Surge',
        title: 'THE CHAMBER SURGES',
        text: 'The basin spits the current back through every channel at once. The pillars slam back into disorder.',
        status: 'The chamber rejects the sequence. The pressure vents violently and the puzzle resets.',
        effect: 'In-world: DC 14 DEX save or take 2d6 bludgeoning damage and fall prone. The sequence resets.',
        sound: 'tidalSurge'
      }
    ],
    /* In the old tool but never shown (KNOWN_ISSUES: kept for later versions). */
    unusedAttemptCopy: [
      { title: 'THE BASIN RIPPLES', text: 'The water rises a finger-width, then falls. Some of the sequence is remembered, but the current is incomplete.', status: 'The basin ripples. Some elements are aligned, but the current still breaks before completing the loop.' },
      { title: 'STONE GRINDS BELOW', text: 'A hidden mechanism turns somewhere behind the walls. The room is listening more closely now.', status: 'The pillars grind beneath the floor. The chamber has accepted part of the pattern, but not the whole truth.' },
      { title: 'THE WATER REVERSES', text: 'The suspended streams overhead briefly flow backward. The pressure in the room tightens.', status: 'The water overhead reverses for a heartbeat. The wrong order is beginning to disturb the chamber.' },
      { title: 'THE CHAMBER REJECTS THE FLOW', text: 'A cold surge crosses the floor. The pillars remain active, but the basin refuses to open.', status: 'A cold surge washes across the stones. The puzzle remains active, but the room is now restless.' }
    ],
    rules: {
      eyebrow: 'Sequence Instructions',
      title: 'How the Tidal Sequence works',
      steps: [
        'Phase I: each outer pillar has a rune and a flow direction.',
        'Click a rune to cycle its symbol. Click the arrow beneath it to rotate its direction.',
        'The four arrows must form one closed clockwise current around the basin.',
        'The outer runes must follow the old order: Flow → Echo → Depth → Stone.',
        'When the outer current is correct, the central basin wakes. Choose the final principle that completes the sequence.',
        'Wrong checks increase Chamber Pressure. At maximum pressure, the chamber surges and resets the sequence.'
      ],
      footnote: 'Let each stone speak to the next. Let no current end. Stone returns the Current.',
      cancel: 'Not Yet',
      start: 'START SEQUENCE'
    },
    success: {
      eyebrow: 'Sequence Response',
      title: 'The Anchor Lifts',
      paragraphs: [
        'The Anchor slides free, and the basin shudders as if it had been holding its breath. Water gathers above it in a slow ring, climbing without a source.',
        'Beside the pedestal, a narrow door of wet stone stands open. Nothing else answers. The chamber waits.'
      ],
      again: 'RESET SEQUENCE'
    },
    text: {
      idleClue: 'The pillars are dormant. Each one carries a rune-face and a flow notch. The central basin is dark.',
      idleDescription: 'Press BEGIN to wake the chamber. Then restore the outer current before naming the basin.',
      startClue: 'The wall is scarred. Something has been cut away here.',
      startDescription: 'Phase I: create the clockwise current: top-left → top-right → bottom-right → bottom-left → top-left.',
      surgeClue: 'The surge vents through the chamber. The basin goes dark and the outer pillars return to their starting disorder.',
      surgeDescription: 'The Tidal Sequence has reset. Restore the outer current again before the chamber grows restless.',
      basinClue: 'Something is set in the basin that does not belong to the Current.',
      basinDescription: 'Phase II: click the central basin rune until it shows the final principle, then choose ATTUNE BASIN.',
      solvedClue: 'The basin has taken the Current.',
      solvedDescription: 'The chamber is waiting.',
      consoleDescription: 'Rotate each pillar rune and arrow. Create a closed clockwise current around the basin.',
      tip: 'Tip: click a rune to cycle its symbol. Click the arrow below it to rotate the flow direction.'
    },

    /* ---------- The Absent Tide (v2) data ---------- */
    /* Harry's Pelagosi rune table. Deep Mind has no icon, so it is left out. */
    runeMeanings: {
      life: ['Creatures', 'Growth'],
      current: ['Movement', 'Destiny'],
      flow: ['Magic', 'Arcana'],
      tide: ['Change', 'Inevitability'],
      anchor: ['Stability', 'Restraint'],
      depth: ['Unknown', 'Hidden truth'],
      remains: ['Death', 'Warning'],
      stone: ['Permanence'],
      echo: ['Memory', 'History']
    },
    /* The scarred wall. A line is shown 'cut' (one block per letter, worked out in code from
       whole), 'fragment' (the text below, as written) or 'whole'. cutLength is the old brief's
       length hint; the code uses wallLineText() and ignores it. */
    wall: {
      title: 'The Wall',
      lines: [
        { id: 1, whole: 'Flow follows memory.', fragment: 'Flow follows \u2592\u2592\u2592\u2592\u2592\u2592.', cutLength: 20 },
        { id: 2, whole: 'Memory seeks depth.', fragment: '\u2592\u2592\u2592\u2592\u2592\u2592 seeks depth.', cutLength: 19 },
        { id: 3, whole: 'Depth breaks upon stone.', fragment: 'Depth breaks upon \u2592\u2592\u2592\u2592\u2592.', cutLength: 23 },
        { id: 4, whole: 'Stone returns the current.', fragment: '\u2592\u2592\u2592\u2592\u2592 returns the \u2592\u2592\u2592\u2592\u2592\u2592\u2592.', cutLength: 25 },
        { id: 5, whole: 'The Anchor holds the water. Held water cannot speak.', fragment: 'The \u2592\u2592\u2592\u2592\u2592\u2592 holds the water. \u2592\u2592\u2592\u2592 \u2592\u2592\u2592\u2592\u2592 cannot \u2592\u2592\u2592\u2592\u2592.', cutLength: 40 }
      ]
    },
    /* One reading per player: which pillar, which wall line it teaches. */
    readings: [
      { id: 'tl', label: 'Pillar of the First Voice', pillar: 'topLeft', line: 1 },
      { id: 'tr', label: 'Pillar of Memory', pillar: 'topRight', line: 2 },
      { id: 'br', label: 'Pillar of the Deep', pillar: 'bottomRight', line: 3 },
      { id: 'bl', label: 'Pillar of Stone', pillar: 'bottomLeft', line: 4 },
      { id: 'basin', label: 'The Basin-keeper', pillar: null, line: 5 }
    ],
    /* A Misread raises pressure only while pressure is below this (never into a surge). */
    misreadCostsPressure: true,
    misreadMaxPressure: 3,
    misreadText: 'The chamber hears the wrong word.',
    hint: {
      maxPressureToAsk: 2,
      askedText: 'The chamber answers, and the water remembers that you asked.',
      refusedTip: 'The water will not answer now.'
    },
    timer: { enabledByDefault: false, seconds: 90, cap: 3 },
    basin: {
      confirmTitle: 'Remove the Anchor?',
      confirmBody: 'The Anchor has held this basin since before the Isles. Only the Current is asked of you. Do you take the Anchor out?',
      confirmYes: 'Take it out',
      confirmNo: 'Leave it',
      holdText: 'The basin is content to hold.'
    },
    /* The Absence: times in milliseconds from the press. Sounds are registry keys. The gaps
       between the knocks are uneven on purpose (2.6 s, then 3.5 s). */
    finale: {
      cues: [
        { at: 0, type: 'duck', sound: 'absenceVoid' },
        { at: 2600, type: 'silence' },
        { at: 6600, type: 'knock', sound: 'knock1' },
        { at: 9200, type: 'knock', sound: 'knock2' },
        { at: 12700, type: 'knock', sound: 'knock3' },
        { at: 15200, type: 'hold' },
        { at: 17200, type: 'reverse', sound: 'waterBackward' },
        { at: 24000, type: 'end' }
      ],
      endNote: 'End of session. Read the cliffhanger.',
      /* Buttons offered at the end, by how the finale began. */
      endButtons: {
        solve: ['replay', 'reset'],
        anyway: ['replay', 'return', 'reset']
      },
      noAutoFocus: true,
      reducedMotionShake: false
    },
    /* Stage Mode (key S) for the TV: what it hides and keeps. */
    stageMode: {
      hides: ['readings', 'console', 'extras'],
      keeps: ['wall', 'stage', 'pillars', 'basin', 'pips', 'pressureMeter'],
      enterKeyChecks: true,
      key: 'S'
    }
  },

  /* ---------- Sounds ----------
     ready: false means the file hasn't been supplied yet, so that moment stays
     silent and nothing tries to load it. Harry will provide the five Tidal
     sounds (answer P2): add each file to tools/pelagosi/assets/audio/ with
     this exact name, then set ready: true. */
  sounds: {
    runePlace: { file: 'rune-place.wav', ready: true },
    runeClick: { file: 'rune-click.wav', ready: true },
    puzzleFail: { file: 'puzzle-fail.wav', ready: true },
    puzzleSolve: { file: 'puzzle-solve.wav', ready: true },
    cavernOpen: { file: 'cavern-open.wav', ready: true },
    /* Tidal v2: .mp3 files Harry is making. ready becomes true only when the file is in assets/audio/. */
    chamberBed: { file: 'chamber-bed.mp3', ready: false, volume: 0.35, loop: true },
    waterStir: { file: 'water-stir.mp3', ready: false },
    pressureRise: { file: 'pressure-rise.mp3', ready: false },
    currentReverse: { file: 'current-reverse.mp3', ready: false },
    tidalSurge: { file: 'tidal-surge.mp3', ready: false },
    basinWake: { file: 'basin-wake.mp3', ready: false },
    anchorRelease: { file: 'anchor-release.mp3', ready: false },
    knock1: { file: 'knock-1.mp3', ready: false, volume: 1 },
    knock2: { file: 'knock-2.mp3', ready: false, volume: 1 },
    knock3: { file: 'knock-3.mp3', ready: false, volume: 1 },
    waterBackward: { file: 'water-backward.mp3', ready: false },
    absenceVoid: { file: 'absence-void.mp3', ready: false },
    inscriptionReveal: { file: 'inscription-reveal.mp3', ready: false },
    tideToll: { file: 'tide-return-toll.mp3', ready: false }
  },
  volume: 0.85
};
