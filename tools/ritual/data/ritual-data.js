/* The Heartwood Ritual: its content, word for word from the old tool
   (tellurian-ritual-engine: index.html and ritual.js). Game rules are in
   ../rules.js; this file only holds names, numbers, wording and media. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.ritual = {
  brand: {
    title: 'The Lullaby of the Rootbound Heart',
    subtitle: 'Tellurian Re-Binding Engine'
  },

  roundMax: 8,

  /* The three stones, in the order the old tool listed them. */
  stones: [
    { id: 'weight', name: 'Weight' },
    { id: 'memory', name: 'Memory' },
    { id: 'silence', name: 'Silence' }
  ],

  /* Heartwood events. effect: stress (listed stones +1, unless locked), none,
     or reprieve (the stone with most stress loses 1). */
  events: [
    { title: 'Root Surge', effect: 'stress', stones: ['weight'],
      hint: 'The Heartwood heaves. Ancient roots tear against the chamber walls, straining all that bears the Weight of the binding.' },
    { title: 'Echo of What Was', effect: 'stress', stones: ['memory'],
      hint: 'Old memories bleed into the stone. The past presses close, heavy with voices that refuse to be forgotten.' },
    { title: 'Arcane Backwash', effect: 'stress', stones: ['silence'],
      hint: 'Dormant magic recoils violently. The air sharpens, and silence fractures under the strain.' },
    { title: 'False Calm', effect: 'none',
      hint: 'The roots still. For a heartbeat, the chamber listens… and waits.' },
    { title: 'Veinwood Thrum', effect: 'stress', stones: ['weight', 'memory', 'silence'],
      hint: 'The Heartwood pulses like a living heart. All unbound stones tremble in answer.' },
    { title: 'Moment of Reprieve', effect: 'reprieve',
      hint: 'A breath passes through the roots. One stone is granted a fleeting mercy.' }
  ],

  threats: {
    husk: {
      id: 'husk', name: 'Rootbound Husk', tier: 1, maxHP: 35, hp: 35, damagePerRound: 6,
      consequence: 'If ignored, +1 Stress to a random stone.',
      narrate: 'The dead stir. Roots haul corpses upright, their limbs moving with borrowed intent.',
      image: 'husk.png'
    },
    buckbear: {
      id: 'buckbear', name: 'Rootbound Buckbear', tier: 2, maxHP: 55, hp: 55, damagePerRound: 10,
      consequence: 'If ignored, +1 Stress to ALL stones.',
      narrate: 'A massive, root-choked form lurches free. Antlers crack stone as it roars without lungs.',
      image: 'buckbear.png'
    },
    wyvern: {
      id: 'wyvern', name: 'Rootbound Wyvern', tier: 3, maxHP: 120, hp: 120, damagePerRound: 16,
      consequence: 'If ignored, ritual collapses next round.',
      narrate: 'Root, soil, and stone knit together into a colossal wyvern. The Heartwood’s final refusal takes shape.',
      image: 'wyvern.png'
    }
  },
  strikes: [
    { label: 'Strike Threat (15)', amount: 15, primary: true },
    { label: 'Heavy Blow (30)', amount: 30 }
  ],

  /* The roll window's explanations, as the old tool worded them.
     <b>, <i> and <br> are the only markup used. {dc}, {t}, {slot} are filled in. */
  modal: {
    weight: {
      assist: '<b>Weight (Assist)</b>: Help brace the chamber.<br>This does <b>not</b> enter a roll. It arms <b>Advantage</b> for the next Weight Attempt.<br>Next Attempt: player rolls with advantage at the table, you enter the final result vs <b>DC {dc}</b>.<br><i>If the advantaged attempt still fails, it causes +1 extra Stress.</i>',
      attempt: '<b>Weight (Attempt)</b>: Hold the chamber steady.<br>Enter the player’s check result vs <b>DC {dc}</b>.'
    },
    memory: {
      assist: '<b>Memory (Assist)</b>: Steady the rhythm.<br>Choose a <b>Target Adjust</b> (usually -1, 0, or +1). No roll is entered here.<br>Next Attempt: you enter the <b>2d6 total</b> vs Target <b>{t} + adjust</b>.',
      attempt: '<b>Memory (Attempt)</b>: Match the rhythm.<br>Enter the <b>2d6 total</b> vs target <b>{t}</b>.<br>Exact: +Progress and -Stress. ±1: +Progress. Miss by 2+: +Stress.'
    },
    silence: {
      assist: '<b>Silence (Assist)</b>: Dampening Ward.<br>Choose the <b>Slot</b> you will spend to smother the Heartwood’s magic.<br><b>No roll</b> is entered here. This just arms the next Attempt.<br><br>Next Silence Attempt uses:<br><b>DC = 10 + Stress − Slot</b> (min DC 8).<br>Current preview (with Slot {slot}): <b>DC {dc}</b>.',
      attempt: '<b>Silence (Attempt)</b>: Press the magic down.<br>Enter Arcana/Religion result vs:<br><b>DC = 10 + Stress − Slot</b> (min DC 8).<br>Choose Slot (0 if none).'
    },
    rollLabel: 'Roll Result',
    rollPlaceholder: 'Enter result',
    slotLabel: 'Slot Level',
    adjustLabel: 'Target Adjust (Assist)',
    adjustOptions: [{ value: '0', label: '0' }, { value: '-1', label: '-1' }, { value: '1', label: '+1' }],
    needNumber: 'Enter a numeric roll result.'
  },

  /* Sounds (assets/audio). The heartbeat loops; the rest play once. */
  sounds: {
    heartbeat: { file: 'heartbeat_loop.mp3', volume: 0.90 },
    progress: { file: 'sfx_progress.mp3', volume: 0.35 },
    stress: { file: 'sfx_stress.mp3', volume: 0.45 },
    lock: { file: 'sfx_lock.mp3', volume: 0.50 },
    interrupt: { file: 'sfx_interrupt.mp3', volume: 0.55 },
    seal: { file: 'sfx_seal.mp3', volume: 0.50 }
  },
  /* The heartbeat is quieter while a film plays, and comes back at 0.55 afterwards (KNOWN_ISSUES RIT-15, kept). */
  heartbeatDuringFilm: 0.15,
  heartbeatAfterFilm: 0.55,

  /* Films (assets/video). They play inside the Ritual's own page. */
  films: {
    WYVERN: 'wyvern_emergency.mp4',
    TRUE_SEAL: 'true_seal.mp4',
    STRAINED: 'strained_binding.mp4',
    FRACTURED: 'fractured_containment.mp4'
  },
  backgroundFilm: 'root_loop.mp4',
  filmGate: { title: 'Cinematic ready.', text: 'Click to play (browser blocked autoplay).', button: 'Play Cinematic' },

  seal: {
    kicker: 'THE FINAL SEAL',
    title: 'The Heartwood Sleeps',
    sub: 'Roots draw inward. Stone remembers. Silence holds.',
    finaleSub: 'Roots draw inward. The glyphs bite shut. The earth closes like a lid over a sleeping eye.',
    foot: 'Hold your breath. Let the earth close.',
    ms: 5200
  },

  dock: {
    title: 'DM Dock',
    sub: ['Overrides + quick control. (', '`', ' to toggle)'],
    note: 'Audio plays only after “Enable Sound”.'
  }
};
