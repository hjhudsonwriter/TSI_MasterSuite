/* The Ironbow Bastion Manager — the war mini-game's numbers (phase 2).
   Harry's rules of 2 October 2026: the War Room's units and their stat
   blocks, the orders, attacks and morale, Lieutenants, beasts, the Bastion
   Defenders, enemy forces by mission, objectives, casualties, recovery and
   rewards. Everything here is a starting value to test at the table, not a
   claim that it's balanced: change a number here and the game follows.
   Rules that use these numbers are in war-battle-rules.js (the battle),
   war-ai.js (the enemy's choices) and war-campaign-rules.js (the Bastion's
   side: missions, armies, casualties and rewards). */
(function () {
  'use strict';
  var D = window.TSI_DATA = window.TSI_DATA || {};

  D.bastionWar = {
    /* ---------- The battlefield ----------
       Distances are in battlefield units: one standard regiment's frontage,
       one square of the battle grid. Every formation and beast fills one
       square. The board is 22 squares across by default (20 to 24 can be
       chosen before deployment begins); its depth follows the map's shape. */
    scale: { cols: 22, minCols: 20, maxCols: 24, minRows: 10, maxRows: 30, noMapRows: 12 },
    rounds: 6,
    /* An army withdraws when this share of its starting Battle Value is Routed or Defeated. */
    breakPct: 60,

    /* ---------- The stat block ---------- */
    stats: [
      { key: 'cohesion', name: 'Cohesion', text: 'How much battlefield punishment the formation can withstand.' },
      { key: 'attack', name: 'Attack', text: 'Added to its attack roll.' },
      { key: 'defence', name: 'Defence', text: 'The number an attacker must meet.' },
      { key: 'move', name: 'Move', text: 'Its normal movement allowance.' },
      { key: 'resolve', name: 'Resolve', text: 'Added to checks against becoming shaken or routing.' },
      { key: 'bv', name: 'Battle Value', text: 'Its approximate contribution to army strength and enemy-generation budgets.' }
    ],

    /* ---------- The War Room's units (Harry's table) ----------
       size: soldiers in a full-strength unit (the War Room's own numbers;
       enemy units are the same sizes). rangedAttack and range only for
       archers, whose printed Attack is +4 ranged / +1 melee. */
    archetypes: {
      levy: { id: 'levy', name: 'Levy Infantry', size: 150, role: 'infantry', cohesion: 4, attack: 2, defence: 11, move: 3, resolve: 0, bv: 3, distinction: 'Cheap, vulnerable to pressure.', traits: [] },
      line: { id: 'line', name: 'Line Infantry', size: 100, role: 'infantry', cohesion: 5, attack: 4, defence: 13, move: 3, resolve: 1, bv: 5, distinction: 'Reliable general-purpose troops.', traits: [] },
      heavy: { id: 'heavy', name: 'Heavy Infantry', size: 50, role: 'infantry', cohesion: 6, attack: 4, defence: 15, move: 2, resolve: 2, bv: 7, distinction: 'Durable, slow.', traits: [] },
      archers: { id: 'archers', name: 'Archers', size: 50, role: 'ranged', cohesion: 4, attack: 1, rangedAttack: 4, range: 6, defence: 11, move: 3, resolve: 0, bv: 5, distinction: 'Range 6.', traits: [] },
      light_cav: { id: 'light_cav', name: 'Light Cavalry', size: 50, role: 'cavalry', cohesion: 4, attack: 4, defence: 12, move: 5, resolve: 1, bv: 6, distinction: 'Fast and able to Charge.', traits: ['charge'] },
      shock_cav: { id: 'shock_cav', name: 'Shock Cavalry', size: 25, role: 'cavalry', cohesion: 5, attack: 5, defence: 14, move: 4, resolve: 1, bv: 8, distinction: 'Strong Charge, expensive.', traits: ['strong_charge'] }
    },
    /* The War Room's Recruit list, in Harry's order. */
    warRoom: [
      { label: 'Lieutenant (1)', kind: 'lieutenant' },
      { label: 'Archers (50)', type: 'archers' },
      { label: 'Levy Infantry (150)', type: 'levy' },
      { label: 'Line Infantry (100)', type: 'line' },
      { label: 'Heavy Infantry (50)', type: 'heavy' },
      { label: 'Light Cavalry (50)', type: 'light_cav' },
      { label: 'Shock Cavalry (25)', type: 'shock_cav' }
    ],
    /* Regiments recruited before phase 2 ("Regiment (100)") fight as Line Infantry. */
    legacyRegiment: { label: 'Regiment (100)', type: 'line' },

    /* ---------- Leaders ----------
       A Lieutenant leads one formation (a regiment or a defender
       detachment, never a beast). The enemy's Captains work the same way. */
    lieutenant: {
      name: 'Lieutenant', bv: 2, resolveBonus: 2, autoRallies: 1,
      text: 'Leads one formation: +2 Resolve to it, and once per battle makes its Rally succeed. No activation or attack of its own; stays with the same formation all battle.'
    },
    captain: { name: 'Captain', bv: 2, resolveBonus: 2, autoRallies: 1 },

    /* ---------- The Bastion Defenders ----------
       Defenders are individual people; a Levy Infantry regiment is 150.
       - Armed defenders fight as Bastion Defender detachments with the Levy
         profile, at full strength with 150. Smaller detachments are weaker:
         Cohesion 4 × (headcount ÷ 150), rounded, at least 1; Battle Value
         likewise.
       - 75 or more (half a regiment) make a detachment of their own. Fewer
         than that join friendly regiments as support instead: +1 Cohesion
         per 5 armed defenders, at most +2 (10 defenders) per regiment. Any
         left over when every regiment has its support form one small
         detachment (so an army of defenders and beasts still fights).
       - Unarmed defenders fight the same way at −2 Attack, and give
         support at +1 per 10, at most +1. */
    defenders: { profile: 'levy', fullSize: 150, detachmentMin: 75, supportPer: 5, supportMax: 2, unarmedAttack: -2, unarmedSupportPer: 10, unarmedSupportMax: 1, supportBvPerPoint: 0.5 },

    /* ---------- Traits ---------- */
    traits: {
      charge: { name: 'Charge', bonus: 2, text: 'Advance & Attack: move at least 2 in a straight line through open ground into melee for +2 on that attack. Not while Shaken or already engaged, not through difficult terrain, and not against a unit that is Holding.' },
      strong_charge: { name: 'Strong Charge', bonus: 3, charge: true, text: 'As Charge, but +3 on that attack.' },
      flight: { name: 'Flight', text: 'Flies over terrain, water, cliffs and other units (it still ends on an empty square); not held up by enemies it passes.' },
      terror: { name: 'Terror', checkMod: -2, text: 'A unit it damages makes the Resolve check caused by that damage at −2 (not later checks or Rally).' },
      pack: { name: 'Pack', text: 'Gains the +2 surround bonus whenever another friendly unit is also fighting its target, from any direction.' },
      grapple: { name: 'Grapple', text: 'A unit it damages in melee can\'t March or Disengage on its next activation.' },
      climber: { name: 'Climber', ignores: ['woods', 'rubble', 'dense'], text: 'Woods, rubble and dense woods cost it no extra movement.' },
      swimmer: { name: 'Swimmer', text: 'Can cross and stand in deep water.' },
      woodland: { name: 'Woodland', ignores: ['woods', 'dense'], text: 'Woods and dense woods cost it no extra movement.' },
      wader: { name: 'Wader', ignores: ['bog'], text: 'Bog and marsh cost it no extra movement.' },
      cragsure: { name: 'Cragsure', ignores: ['rubble'], text: 'Rubble and rocky ground cost it no extra movement.' },
      steady: { name: 'Steady', resolve: 1, text: '+1 Resolve.' },
      hardy: { name: 'Hardy', text: 'Ignores the weather\'s penalties.' },
      braced: { name: 'Braced', text: 'Attackers never gain a Charge bonus against it, even when it isn\'t Holding.' },
      armoured: { name: 'Armoured', defence: 1, text: '+1 Defence.' },
      fleet: { name: 'Fleet', move: 1, text: '+1 Move.' }
    },

    /* ---------- Beasts ----------
       Only beasts committed to the action take the field, each with its own
       profile and one defining trait. Provisional: a medium war beast is
       about Cohesion 5, Attack +5, Defence 12, Move 4, Resolve +1, Battle
       Value 7; weaker and stronger creatures sit either side of it. */
    beasts: {
      'Jackal': { cohesion: 2, attack: 2, defence: 11, move: 5, resolve: -1, bv: 2, trait: 'pack', distinction: 'Small and quick; dangerous only in numbers.' },
      'Hyena': { cohesion: 3, attack: 3, defence: 11, move: 5, resolve: 0, bv: 3, trait: 'pack', distinction: 'A scavenger that finishes what others start.' },
      'Constrictor Snake': { cohesion: 4, attack: 3, defence: 12, move: 3, resolve: 1, bv: 4, trait: 'grapple', distinction: 'Slow, but holds fast whatever it seizes.' },
      'Panther': { cohesion: 3, attack: 4, defence: 12, move: 5, resolve: 0, bv: 4, trait: 'charge', distinction: 'A pouncing ambusher.' },
      'Ape': { cohesion: 4, attack: 4, defence: 12, move: 4, resolve: 0, bv: 4, trait: 'climber', distinction: 'Strong and agile over broken ground.' },
      'Black Bear': { cohesion: 5, attack: 4, defence: 11, move: 4, resolve: 1, bv: 5, trait: 'climber', distinction: 'Tough, and at home among the trees.' },
      'Crocodile': { cohesion: 5, attack: 4, defence: 12, move: 3, resolve: 1, bv: 5, trait: 'swimmer', distinction: 'Armoured hide; strikes from the water.' },
      'Giant Vulture': { cohesion: 4, attack: 4, defence: 11, move: 6, resolve: 0, bv: 5, trait: 'flight', distinction: 'Flies over the line to strike where it\'s weak.' },
      'Dire Wolf': { cohesion: 5, attack: 5, defence: 12, move: 5, resolve: 1, bv: 7, trait: 'pack', distinction: 'A hunter that brings down the isolated.' },
      'Lion': { cohesion: 5, attack: 5, defence: 12, move: 5, resolve: 1, bv: 7, trait: 'charge', distinction: 'A pouncing predator.' },
      'Tiger': { cohesion: 5, attack: 5, defence: 12, move: 5, resolve: 1, bv: 7, trait: 'charge', distinction: 'A pouncing predator.' },
      'Brown Bear': { cohesion: 6, attack: 5, defence: 12, move: 4, resolve: 1, bv: 7, trait: 'grapple', distinction: 'Heavy and hard to shake off.' },
      'Owlbear': { cohesion: 7, attack: 6, defence: 13, move: 4, resolve: 2, bv: 10, trait: 'terror', distinction: 'A monster that breaks nerve as well as bone.' }
    },
    /* A beast with no profile above (from an imported save, say). */
    beastDefault: { cohesion: 5, attack: 5, defence: 12, move: 4, resolve: 1, bv: 7, trait: 'charge', distinction: 'A war beast.' },

    /* ---------- Orders ---------- */
    orders: [
      { id: 'advance', name: 'Advance & Attack', text: 'Move up to normal allowance, then make one legal melee or ranged attack. Moving is optional.' },
      { id: 'march', name: 'March', text: 'Move up to twice normal allowance; cannot attack. Cannot begin while engaged.' },
      { id: 'hold', name: 'Hold', text: 'Remain stationary; gain +2 Defence until the start of the unit\'s next activation.' },
      { id: 'rally', name: 'Rally', text: 'Remain stationary and make a Resolve check to remove Shaken. Cannot attack.' },
      { id: 'disengage', name: 'Disengage', text: 'Leave melee at up to half movement, rounded up; cannot attack.' },
      { id: 'interact', name: 'Interact', text: 'Remain at an objective and perform its scenario action instead of attacking.' }
    ],

    /* ---------- Attacks ----------
       d20 + Attack + modifiers against Defence. Situational modifiers
       (Luck, Shaken, Charge, surrounding, weather) together stay within
       −4 to +4; the printed Attack isn't counted in that limit. Margin is
       the total minus Defence. A natural 1 always misses; a natural 20
       inflicts 3. */
    attack: {
      modCap: 4,
      bands: [{ margin: 0, damage: 1 }, { margin: 5, damage: 2 }, { margin: 10, damage: 3 }],
      maxDamage: 3, nat20Damage: 3,
      surroundBonus: 2, surroundAngle: 90,
      holdDefence: 2, coverDefence: 2, shakenAttack: -2
    },

    /* ---------- Morale in battle ----------
       Steady → Shaken → Routed. Check: d20 + Resolve + opening Morale
       modifier + attached leader's bonus (+2), against DC 10. */
    morale: { dc: 10, highMod: 2, lowMod: -2 },
    luck: { passMod: 1, failMod: -1 },

    /* ---------- Weather in battle (both armies) ----------
       overlay: the Explorer's weather film, looped over the War Table's
       battlefield while that weather holds (display only). */
    weather: {
      clear: { text: 'No effect.' },
      white_blizzard: { moveMod: -1, text: 'Snowstorm: every unit moves 1 less (at least 1).', overlay: 'tools/explorer/assets/overlays/blizzard_overlay.mp4' },
      cold_rain: { rangedMod: -2, text: 'Rainstorm: ranged attacks −2.', overlay: 'tools/explorer/assets/overlays/rain_overlay.mp4' },
      sun_heatwave: { resolveMod: -1, text: 'Heatwave: Resolve checks −1.', overlay: 'tools/explorer/assets/overlays/sun_heat_overlay.mp4' }
    },

    /* ---------- Terrain (painted on the map, square by square) ----------
       cost: movement points to enter. difficult: no Charge through it.
       blocksSight: ranged attacks can't shoot through it. cover: +2 Defence
       against ranged attacks for a unit standing in it. impassable: can't
       be entered (Flight crosses both; Swimmer crosses water). */
    terrain: [
      { code: '.', id: 'open', name: 'Open ground', cost: 1, colour: 'rgba(0,0,0,0)', text: 'Normal movement.' },
      { code: 'w', id: 'woods', name: 'Woods', cost: 2, difficult: true, colour: 'rgba(46,110,52,.45)', text: 'Movement through it costs double; no Charge.' },
      { code: 'b', id: 'bog', name: 'Bog or marsh', cost: 2, difficult: true, colour: 'rgba(92,96,52,.5)', text: 'Movement through it costs double; no Charge.' },
      { code: 'r', id: 'rubble', name: 'Rubble or rocky ground', cost: 2, difficult: true, colour: 'rgba(120,104,88,.5)', text: 'Movement through it costs double; no Charge.' },
      { code: 'd', id: 'dense', name: 'Dense woods', cost: 2, difficult: true, blocksSight: true, colour: 'rgba(22,70,30,.6)', text: 'Costs double, no Charge, and blocks ranged line of sight through it.' },
      { code: 'g', id: 'ridge', name: 'Ridge', cost: 1, blocksSight: true, colour: 'rgba(150,120,70,.45)', text: 'Blocks ranged line of sight through it.' },
      { code: 'c', id: 'cover', name: 'Cover', cost: 1, cover: true, colour: 'rgba(170,150,110,.45)', text: '+2 Defence against ranged attacks.' },
      { code: 'x', id: 'water', name: 'Deep water', cost: 1, impassable: true, water: true, colour: 'rgba(40,90,160,.55)', text: 'Impassable unless the unit can swim or fly.' },
      { code: 'k', id: 'cliff', name: 'Sheer cliff', cost: 1, impassable: true, colour: 'rgba(60,50,45,.7)', text: 'Impassable unless the unit can fly.' },
      { code: 'f', id: 'crossing', name: 'Bridge or ford', cost: 1, colour: 'rgba(200,170,90,.55)', text: 'A route across water: normal movement.' }
    ],

    /* ---------- Missions: objectives, enemy strength, victory ---------- */
    objectives: {
      raid: { name: 'Raid', mult: 0.85, markers: 3, need: 2, markerCols: [0.2, 0.5, 0.8], rule: 'Secure and extract two of three supply markers through your starting edge by the end of round 6. Collecting a marker takes Interact. Breaking the enemy army wins at once.' },
      skirmish: { name: 'Skirmish', mult: 1.0, rule: 'Break the opposing army. At the end of round 6, the side that has lost the smaller share of its starting Battle Value wins; equal shares are a draw.' },
      /* Not a War Action you can queue (warAction: false): it comes as the
         Defend Bastion event, when a Clan you're at war with attacks (wars, defence below). */
      defend: { name: 'Defend Bastion', warAction: false, mult: 1.1, zone: { w: 4, h: 2 }, holdRounds: 2, rule: 'Stop the enemy holding your supply depot at two round ends in a row, and keep your army unbroken through round 6. Breaking the enemy army wins at once.' },
      seize_outpost: { name: 'Seize Outpost', mult: 1.2, zone: { w: 4, h: 2 }, holdRounds: 2, rule: 'Hold the outpost with a Steady unit, with no enemy unit in it, at two round ends in a row before the end of round 6. Breaking the enemy army wins at once.' }
    },
    tiers: [
      { id: 'small', name: 'Small local force', bv: 18 },
      { id: 'established', name: 'Established local force', bv: 28 },
      { id: 'major', name: 'Major force', bv: 40 }
    ],
    /* The one saved variation roll (d6). */
    variation: [{ upTo: 2, mult: 0.85, text: 'smaller than usual' }, { upTo: 4, mult: 1.0, text: 'as expected' }, { upTo: 6, mult: 1.15, text: 'larger than usual' }],
    /* Enemy Captains: one from this budget, another at each step up. */
    captains: { first: 14, second: 26, third: 38 },

    /* ---------- The seven clans' armies ----------
       Composition weights (a higher weight is picked more often), caps on
       specialists, the clan's variant units (an archetype with one
       distinctive trait) and beasts it may field. Proposed directions for
       Harry to review; colours are only given where they're established. */
    clans: {
      blackstone: {
        emphasis: 'Wardens, forest-capable infantry and bow troops; woodland manoeuvre.',
        weights: { levy: 1, line: 3, heavy: 1, archers: 3, light_cav: 1, shock_cav: 0 },
        caps: { archers: 0.5, cavalry: 1, shock_cav: 0, beasts: 0 },
        variants: [{ id: 'blackstone_wardens', name: 'Blackstone Wardens', base: 'line', trait: 'woodland' }],
        beasts: [], style: null
      },
      bacca: {
        emphasis: 'Durable infantry and mountain specialists; difficult-ground endurance.',
        weights: { levy: 2, line: 2, heavy: 3, archers: 1, light_cav: 1, shock_cav: 0 },
        caps: { archers: 0.3, cavalry: 1, shock_cav: 0, beasts: 0 },
        variants: [
          { id: 'bacca_stoneguard', name: 'Bacca Stoneguard', base: 'heavy', trait: 'steady' },
          { id: 'bacca_cragmen', name: 'Bacca Cragmen', base: 'levy', trait: 'cragsure' }
        ],
        beasts: [], style: null
      },
      rowthorn: {
        emphasis: 'Waterway specialists and mobile troops; crossings and wet terrain.',
        weights: { levy: 1, line: 3, heavy: 1, archers: 2, light_cav: 3, shock_cav: 0 },
        caps: { archers: 0.4, cavalry: 3, shock_cav: 0, beasts: 0 },
        variants: [{ id: 'rowthorn_riverwardens', name: 'Rowthorn Riverwardens', base: 'line', trait: 'wader' }],
        beasts: [], style: null
      },
      karr: {
        emphasis: 'Hardy infantry and raiders; cold-weather resilience.',
        weights: { levy: 2, line: 3, heavy: 1, archers: 1, light_cav: 3, shock_cav: 0 },
        caps: { archers: 0.3, cavalry: 3, shock_cav: 0, beasts: 1 },
        variants: [{ id: 'karr_shieldbearers', name: 'Karr Shieldbearers', base: 'line', trait: 'hardy' }],
        beasts: [{ name: 'Dire Wolf', minBudget: 28 }], style: null
      },
      farmer: {
        emphasis: 'Disciplined formations and command support.',
        weights: { levy: 2, line: 3, heavy: 1, archers: 2, light_cav: 1, shock_cav: 1 },
        caps: { archers: 0.4, cavalry: 2, shock_cav: 1, beasts: 0 },
        variants: [{ id: 'farmer_pikes', name: 'Farmer Pikes', base: 'line', trait: 'braced' }],
        extraCaptain: true,
        beasts: [], style: null
      },
      molten: {
        emphasis: 'Well-equipped troops and access to specialist hired forces.',
        weights: { levy: 1, line: 2, heavy: 3, archers: 2, light_cav: 1, shock_cav: 2 },
        caps: { archers: 0.4, cavalry: 2, shock_cav: 1, beasts: 1 },
        variants: [{ id: 'molten_ironclads', name: 'Molten Ironclads', base: 'heavy', trait: 'armoured' }],
        beasts: [{ name: 'Owlbear', minBudget: 28, hired: true }, { name: 'Brown Bear', minBudget: 20, hired: true }], style: null
      },
      slade: {
        emphasis: 'Scouts, skirmishers and tactical redeployment.',
        weights: { levy: 1, line: 2, heavy: 1, archers: 3, light_cav: 3, shock_cav: 0 },
        caps: { archers: 0.5, cavalry: 3, shock_cav: 0, beasts: 0 },
        variants: [{ id: 'slade_outriders', name: 'Slade Outriders', base: 'light_cav', trait: 'fleet' }],
        beasts: [],
        /* Slade's white rampant stallion on teal is established (Harry, 2 October 2026). */
        style: { fill: '#1c6f78', ink: '#ffffff' }
      }
    },
    /* Every enemy army: at least this share of its units' Battle Value
       (not counting Captains) in infantry. */
    coreShare: 0.5,
    /* Enemy units without an established clan colour. */
    enemyStyle: { fill: '#2b2f36', ink: '#e7e2d6' },

    /* ---------- After the battle ----------
       Permanent personnel losses by each unit's final state, as a share of
       the soldiers present at the start (rounded to the nearest). */
    casualties: { steady: 0, halfOrBelow: 10, routed: 25, defeatedHeld: 40, defeatedLost: 60 },
    /* Lieutenants and beasts aren't counted in percentages: one d6 when
       their formation (or the beast itself) is Defeated. A Routed one is
       separated for 7 days. (These were Bastion turns: 2, 1, 3 and 1; since
       the days overhaul, 8 October 2026, they're the same at 7 days a turn.) */
    recovery: [
      { from: 1, to: 1, result: 'killed', text: 'Killed.' },
      { from: 2, to: 2, result: 'captured', text: 'Captured if the enemy holds the field; otherwise badly wounded.' },
      { from: 3, to: 4, result: 'wounded', days: 14, text: 'Wounded: unavailable for 14 days.' },
      { from: 5, to: 6, result: 'recovered', days: 7, text: 'Recovered: unavailable for 7 days.' }
    ],
    badlyWoundedDays: 21,
    separatedDays: 7,

    /* Rewards: the Bastion's existing amounts (bastion-data.js war.outcomes)
       stay the baseline. A raid's gold follows the supplies extracted, even
       on a defeat or withdrawal (one home: half the victory's gold); a
       draw changes nothing; a withdrawal otherwise counts as a defeat for
       gold and Political Capital, but costs only half the Clan Honour. */
    rewards: { withdrawalHonour: -4, victoryHonour: 6, defeatHonour: -8 },

    /* ---------- Being at war with a Clan (Harry, 4 October 2026) ----------
       Queueing a War Action against a Clan declares war on it (or renews the
       war) and costs Honour & Respect and Political Capital with that Clan
       at once, by the Battle Value of the army committed: the first row
       whose maxBV the army is within (null: no limit). A war ends by itself
       after quietDays days with no War Action or Defend Bastion battle
       between you, or when the DM presses Make peace. While at war, each
       Clan rolls attackDie every attackEvery days of the war, counted from
       the day it was declared: a 1 means it attacks your Bastion (one
       attack waiting at a time). (These were 6 quiet Bastion turns and a
       roll each turn; since the days overhaul, 8 October 2026, the same at
       7 days a turn.) */
    wars: {
      penalties: [
        { maxBV: 19, honourRespect: -3, politicalCapital: -30 },
        { maxBV: 39, honourRespect: -4, politicalCapital: -40 },
        { maxBV: null, honourRespect: -5, politicalCapital: -50 }
      ],
      quietDays: 42,
      attackDie: 6,
      attackEvery: 7
    },

    /* ---------- The Defend Bastion event ----------
       A Clan at war attacks: every force free at the Bastion defends it
       (defenders, Lieutenants, regiments and beasts not committed elsewhere
       or recovering), on the coast map below, against an army drawn up from
       that Clan's roster for the objective 'defend', its size rolled on
       tierDie (d6). Losing (or withdrawing) costs treasuryLoss (1d10 × 5%:
       5% to 50% of the treasury, rounded down, in place of the usual gold)
       and puts repairs.die (1d4) built facilities, chosen at random, Under
       Repair for repairs.days days, the day of the loss included (2 Bastion
       turns before the days overhaul): no orders, and any already running
       there wait. Winning uses the usual Defend Bastion rewards. */
    defence: {
      tierDie: [{ upTo: 2, tier: 'small' }, { upTo: 5, tier: 'established' }, { upTo: 6, tier: 'major' }],
      treasuryLoss: { die: 10, pctPerPip: 5 },
      repairs: { die: 4, days: 14 },
      map: 'defend_coast',
      title: 'Sound the horns!',
      text: 'Sound the horns! Clan {clan} warships are approaching! Defend the Ironbow!'
    },

    /* ---------- Battle maps that come with the suite ----------
       src: the picture (shown with an <img>, never read into a canvas);
       w, h: its size in pixels; cells: its painted terrain at cols × rows,
       row by row (codes as in terrain above). The Defend Bastion event
       opens on defend_coast: Harry's coast with the Ironbow's pier. */
    presetMaps: {
      defend_coast: {
        name: 'The Ironbow coast',
        src: 'tools/bastion/assets/war/defend-bastion-coast.jpg',
        w: 1254, h: 1254, cols: 22, rows: 22,
        cells:
          'xxxxxxxxxxxxxffxxxxxxx' +
          'rrrrrxxxxxxxxfxxxxxxxr' +
          'rrrrrrxxxxxxrfrrxxxrrr' +
          '...rr..rrrrrr.rrrxrrrr' +
          '.........rrr..........' +
          '.........rrr..........' +
          '......................' +
          'rrrrr.................' +
          'rrrrrr............rrrr' +
          'rrrrrr...........rrrrr' +
          'rrrrrr..........rrrrrr' +
          'rrrr........rr..rrrrrr' +
          '...................rr.' +
          '......................' +
          '......................' +
          '....rrr...............' +
          '.....rr...............' +
          '......................' +
          '......................' +
          '......................' +
          '......................' +
          '......................'
      }
    }
  };
}());
