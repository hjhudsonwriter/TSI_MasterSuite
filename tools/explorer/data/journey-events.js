/* Scarlett Isles Explorer — the travel and campfire events (Harry's new events,
   from "Scarlett Isles Explorer: New Travel & Campfire Events (Draft)", 6 October 2026).
   They replace the 601 old events in events-data.js, which are switched off
   (no longer loaded) but kept.

   Harry's choices (6 October 2026): every recommendation in the draft's
   "Decisions for Harry", except T9 The Husk in the Furrows, which is written
   here but switched off (off: true): no Rootbound creature before the
   Heartwood finale. T17 The Second Marker was removed at Harry's request
   (7 October 2026), so there are 16 travel events.

   How an event is written (the rules are in journey.js):
   - kind: 'travel' (drawn on the road), 'camp' (drawn at Make Camp),
     'follow' (brought back by a thread), 'dm' (never drawn: listed under
     "DM events" in the Main Campaign list, to queue by hand) or 'night' (set
     up by another event's tonight outcome for that night's camp). None of
     the events uses 'dm' or 'night' at present.
   - where: { any: true } | { gods: [...] } | { provinces: [...] } | { maps: [...] }.
     gods and provinces follow the Region list; maps need that map loaded.
   - steps: start is the first. A step shows text (and a verse), applies its
     apply list once when it's reached, then offers ONE of: check, choices,
     next, fight, contest, puzzle, pick, branch, or end: true.
   - check: { skill, dc, who: 'one' | 'same' | 'group' | 'each', ... }.
     'one' lets the DM pick the hero; 'same' is the hero picked before.
     'each' asks the DM to tick who failed (among: 'failed' = only those who
     failed the last 'each' check), then goes to anyFail / noneFail (or next).
     pace: 'stealth' | 'perception' shows the travel-pace reminder.
   - fight: { suggest, encounter, won, fled }. suggest is the line the DM
     reads; encounter names the fight in data/fights-data.js, which the
     "Set up this fight" button hands to the Combat Tracker.
   - Outcomes (apply): gold (a number, or { stake: n } for n × the stake),
     miles (6-mile steps, today), loseDay, effect, inspiration, thread,
     threadRename, threadClose, dm (a note for another tool, never applied
     automatically), note, tonight.
   - Effects last: days: N, camp (until the next Make Camp), night (no long
     rest: until the Make Camp after tonight's), used, or dm (until removed).
   - Text can use {clan}, {chief}, {temple}, {hero}, {failed}, {succeeded}
     and {stake}. {clan} and {chief} come from the Region (see regions below). */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.journeyEvents = {
  settings: {
    /* Once a day on the road, a 30% chance of a travel event; never two days running. */
    travelChance: 0.30,
    /* At Make Camp, a 25% chance of a campfire event, skipped after a travel or weather event that day. */
    campChance: 0.25
  },

  /* The Explorer's own copy of each province's clan, chief and temple (from
     the Notice Board's quest data), so events can say "a rider in {clan}
     colours". isle: Pelagos' isles, for follow-ups that need an isle map. */
  regions: {
    northern_province: { god: 'telluria', clan: 'Blackstone', chief: 'Boris Blackstone', temple: 'Temple of Telluria' },
    midland_province: { god: 'telluria', clan: 'Bacca', chief: 'Ario Bacca', temple: 'Temple of Telluria' },
    eastern_province: { god: 'telluria', clan: 'Slade', chief: 'Harlan Slade', temple: 'Temple of Telluria' },
    southern_province: { god: 'aurush', clan: 'Molten', chief: 'Callum Molten', temple: 'Temple of Aurush' },
    western_province: { god: 'aurush', clan: 'Farmer', chief: 'Logan Farmer', temple: 'Temple of Aurush' },
    the_north_isle: { god: 'pelagos', clan: 'Karr', chief: 'Helga Karr', temple: 'Temple of Pelagos', isle: true },
    the_east_isle: { god: 'pelagos', clan: 'Rowthorn', chief: 'Doran Rowthorn', temple: 'Temple of Pelagos', isle: true }
  },

  events: [
    /* ================= Travel events: anywhere ================= */
    {
      id: 't1', code: 'T1', kind: 'travel', title: 'The Wardens\' Toll', where: { any: true },
      line: 'Insight, then Intimidation, Stealth or Persuasion',
      steps: {
        start: {
          text: 'A rope spans the road. Two men in mismatched Warden tabards demand 50 gold for "road upkeep".',
          check: { skill: 'Wisdom (Insight)', dc: 14, who: 'one', success: 'spotted', failure: 'genuine' }
        },
        spotted: {
          text: 'The tabards are stolen: one has a bolt hole and old blood at the collar.',
          apply: [{ effect: { name: 'Toll-Wise', text: 'advantage on Insight against road-thieves', who: 'hero', days: 7 } }],
          choices: [
            { label: 'Call their bluff: Charisma (Intimidation), DC 15', go: 'bluff' },
            { label: 'Follow them home: group Dexterity (Stealth), DC 15', go: 'follow' }
          ]
        },
        bluff: {
          text: 'You call their bluff.',
          check: { skill: 'Charisma (Intimidation)', dc: 15, who: 'one', success: 'bluffWon', failure: 'bluffLost' }
        },
        bluffWon: { text: 'They flee and drop their takings.', apply: [{ gold: 120 }], end: true },
        bluffLost: { text: 'They escape with their takings.', end: true },
        follow: {
          text: 'You let them go, then follow at a distance.',
          check: { skill: 'Dexterity (Stealth)', dc: 15, who: 'group', pace: 'stealth', success: 'captive', failure: 'scatter' }
        },
        captive: {
          text: 'A real Warden lies bound in their camp.',
          apply: [{ thread: { name: 'The Captive Warden', note: 'A real Warden lay bound in the false toll-men\'s camp.' } }],
          end: true
        },
        scatter: { text: 'They spot you and scatter.', apply: [{ miles: -6 }], end: true },
        genuine: {
          text: 'They seem genuine enough.',
          choices: [
            { label: 'Pay: −50 gold', go: 'pay' },
            { label: 'Refuse: Charisma (Persuasion), DC 15', go: 'refuse' },
            { label: 'Detour: −12 miles today', go: 'detour' }
          ]
        },
        pay: { text: 'You pay their "road upkeep".', apply: [{ gold: -50 }], end: true },
        refuse: {
          text: 'You refuse to pay.',
          check: { skill: 'Charisma (Persuasion)', dc: 15, who: 'one', success: 'through', failure: 'grudge' }
        },
        through: { text: 'They let you through.', end: true },
        grudge: {
          text: 'They let you pass, but they won\'t forget it.',
          apply: [{ thread: { name: 'The Toll-Men\'s Grudge', note: 'The toll-men want their 50 gold, and more. They may come back within 3 days.', follow: { event: 'f1', scope: 'same-map', from: 1, to: 3 } } }],
          end: true
        },
        detour: { text: 'You take the long way round.', apply: [{ miles: -12 }], end: true }
      }
    },

    {
      id: 't2', code: 'T2', kind: 'travel', title: 'The Ambush Sign', where: { any: true },
      line: 'Survival, then Stealth or Perception · may lead to a fight',
      steps: {
        start: {
          text: 'Fresh cuts in the bark of a roadside oak, the sap still wet. A crude mark, and an arrow pointing up the road.',
          check: { skill: 'Wisdom (Survival)', dc: 13, who: 'one', success: 'read', failure: 'unread' }
        },
        read: {
          text: 'It\'s a signal to friends ahead: travellers coming, take them at the ford.',
          choices: [
            { label: 'Turn the ambush: group Dexterity (Stealth), DC 15, to circle behind them', go: 'turn' },
            { label: 'Go round: −6 miles today', go: 'round' }
          ]
        },
        turn: {
          text: 'You circle behind the ambushers.',
          check: { skill: 'Dexterity (Stealth)', dc: 15, who: 'group', pace: 'stealth', success: 'turned', failure: 'heard' }
        },
        turned: {
          text: 'They throw down their weapons. Their cache is yours.',
          apply: [{ gold: 150 }],
          pick: { prompt: 'Who planned it? They gain Inspiration.', go: 'planner' }
        },
        planner: { text: 'The plan worked.', apply: [{ inspiration: 'hero' }], end: true },
        heard: {
          text: 'They hear you coming, but nobody is surprised.',
          fight: { suggest: 'Levels 7–10: a bandit captain, 2 veterans and 8 bandits. Levels 11–16: add 2 more veterans and a gladiator.', encounter: 't2', won: 'won', fled: 'fled' }
        },
        round: { text: 'You go round the ford.', apply: [{ miles: -6 }], end: true },
        unread: {
          text: 'You walk on to the ford.',
          check: { skill: 'Wisdom (Perception)', dc: 15, who: 'each', pace: 'perception', whoText: 'Every hero rolls. Tick who failed: they are surprised in the first round.', next: 'sprung' }
        },
        sprung: {
          text: 'The ambush springs.',
          apply: [{ note: { any: 'Surprised in the first round: {failed}.', none: 'Nobody is surprised.' } }],
          fight: { suggest: 'Levels 7–10: a bandit captain, 2 veterans and 8 bandits. Levels 11–16: add 2 more veterans and a gladiator.', encounter: 't2', won: 'won', fled: 'fled' }
        },
        won: { text: 'The ambushers are beaten, and their cache is yours.', apply: [{ gold: 150 }], end: true },
        fled: { text: 'You get away.', end: true }
      }
    },

    {
      id: 't3', code: 'T3', kind: 'travel', title: 'The Overturned Wagon', where: { any: true },
      line: 'Athletics, Medicine, Investigation',
      steps: {
        start: {
          text: 'A merchant\'s wagon lies on its side in the ditch, the ox dead in its traces. Underneath, a man is shouting for help.',
          check: { skill: 'Strength (Athletics)', dc: 16, who: 'one', success: 'freed', failure: 'snapped' }
        },
        freed: { text: 'He\'s out, bruised but whole.', next: 'ox' },
        snapped: {
          text: 'The wagon shifts and his leg snaps.',
          check: { skill: 'Wisdom (Medicine)', dc: 13, who: 'one', success: 'set', failure: 'carried' }
        },
        set: { text: 'You set the leg. He can walk, slowly.', next: 'ox' },
        carried: { text: 'The leg won\'t set. He must be carried.', apply: [{ miles: -12 }], next: 'ox' },
        ox: {
          text: 'Anyone may look over the dead ox.',
          choices: [
            { label: 'Look over the ox: Intelligence (Investigation), DC 14', go: 'oxCheck' },
            { label: 'Leave it', go: 'offer' }
          ]
        },
        oxCheck: {
          text: 'You look over the ox.',
          check: { skill: 'Intelligence (Investigation)', dc: 14, who: 'one', success: 'bolt', failure: 'nothing' }
        },
        bolt: {
          text: 'A crossbow bolt is buried in its neck. This was no accident.',
          apply: [{ thread: { name: 'Who Wrecked the Wagon?', note: 'A crossbow bolt in the dead ox: someone wrecked the merchant\'s wagon on purpose.' } }],
          next: 'offer'
        },
        nothing: { text: 'Nothing out of the ordinary.', next: 'offer' },
        offer: {
          text: 'He makes you an offer.',
          choices: [
            { label: 'Escort him to the next town: −12 miles today, +200 gold', go: 'escort' },
            { label: 'Take a purse for your trouble: +75 gold', go: 'purse' }
          ]
        },
        escort: { text: 'You see him safely to the next town, and he pays you well.', apply: [{ miles: -12 }, { gold: 200 }], end: true },
        purse: { text: 'He presses a purse into your hands.', apply: [{ gold: 75 }], end: true }
      }
    },

    {
      id: 't4', code: 'T4', kind: 'travel', title: 'The Knight-Errant\'s Challenge', where: { any: true },
      line: 'a best-of-three contest, or Persuasion',
      steps: {
        start: {
          text: 'A knight in {clan} colours sits her horse across a narrow bridge. "None cross without a bout to first blood, for the honour of Clan {clan}."',
          choices: [
            { label: 'Accept: one hero, best of three', go: 'bout' },
            { label: 'Decline: Charisma (Persuasion), DC 15, to do it gracefully', go: 'decline' }
          ]
        },
        bout: {
          text: 'A bout to first blood.',
          contest: { opponent: 'The knight', bonus: 7, heroRoll: 'Strength (Athletics) or Dexterity (Acrobatics)', need: 2, win: 'won', lose: 'lost' }
        },
        won: {
          text: 'First blood is yours. She hands over her purse with a bow.',
          apply: [{ gold: 200 }, { inspiration: 'hero' }, { dm: 'Notice Board: consider +1 clan honour with Clan {clan}.' }],
          end: true
        },
        lost: {
          text: 'She draws first blood, and the wager is hers.',
          apply: [{ gold: -100 }, { effect: { name: 'Humbled', text: 'disadvantage on Charisma checks with Clan {clan}', who: 'hero', days: 7 } }],
          end: true
        },
        decline: {
          text: 'You decline the bout.',
          check: { skill: 'Charisma (Persuasion)', dc: 15, who: 'one', success: 'nod', failure: 'sneer' }
        },
        nod: { text: 'She lets you pass with a nod.', end: true },
        sneer: { text: 'She lets you pass with a sneer.', apply: [{ dm: 'Notice Board: consider −1 clan honour with Clan {clan}.' }], end: true }
      }
    },

    {
      id: 't5', code: 'T5', kind: 'travel', title: 'The Ferry Puzzle',
      /* "Any map with a river": the maps with a river drawn on them. */
      where: { maps: ['midland_province', 'northern_province_east', 'northern_province_west', 'southern_province_west'] },
      line: 'puzzle, with an Intelligence check for a hint',
      dmNote: 'It\'s a very old puzzle, so a player may know it. That\'s fine for a light moment.',
      steps: {
        start: {
          text: 'A farmer stands at a narrow river with his hound, his goat and a sack of seed-corn. His little boat carries him and one thing more. Left alone, the hound will savage the goat, and the goat will eat the seed. He\'s been stuck since dawn.',
          puzzle: {
            kind: 'puzzle',
            prompt: 'The players solve it aloud.',
            hint: { skill: 'Intelligence', dc: 13, text: 'Nothing says a passenger can\'t come back the way it went.' },
            answer: 'Goat over, come back; hound over, bring the goat back; seed over, come back; goat over.',
            solved: 'solved', giveUp: 'gaveUp'
          }
        },
        solved: {
          text: 'He shows you a hidden ford.',
          apply: [{ miles: 6 }],
          pick: { prompt: 'Who solved it? They gain Inspiration.', go: 'solver' }
        },
        solver: { text: 'Across the hidden ford.', apply: [{ inspiration: 'hero' }], end: true },
        gaveUp: { text: 'You spend the morning helping him the slow way.', apply: [{ miles: -6 }], end: true }
      }
    },

    {
      id: 't6', code: 'T6', kind: 'travel', title: 'The Dying Messenger', where: { any: true },
      line: 'Medicine, then Sleight of Hand',
      steps: {
        start: {
          text: 'A horse stands riderless in the road. Ten yards on, its rider lies in the grass in {clan} colours, a bolt in his back and a sealed letter in his fist.',
          extra: { eastern_province: 'He wears Clan Slade\'s white stallion on teal.' },
          check: { skill: 'Wisdom (Medicine)', dc: 15, who: 'one', success: 'lives', failure: 'dies' }
        },
        lives: { text: 'He lives long enough to say "Take it to Chief {chief}."', next: 'letter' },
        dies: { text: 'He dies. The seal is Clan {clan}\'s.', next: 'letter' },
        letter: {
          text: 'The sealed letter is in your hands.',
          choices: [
            { label: 'Deliver it sealed', go: 'deliver' },
            { label: 'Read it first: Dexterity (Sleight of Hand), DC 15, to lift the wax unbroken', go: 'read' }
          ]
        },
        deliver: {
          text: 'You ride on with the letter, its seal unbroken.',
          apply: [{ thread: { name: 'The Sealed Dispatch', note: 'Deliver the sealed letter to Chief {chief} of Clan {clan}.', resolve: { gold: 250, dm: 'Notice Board: consider +1 clan honour with Clan {clan}.' } } }],
          end: true
        },
        read: {
          text: 'You work at the wax.',
          check: { skill: 'Dexterity (Sleight of Hand)', dc: 15, who: 'one', success: 'lifted', failure: 'cracked' }
        },
        lifted: {
          text: 'The wax lifts unbroken. DM: decide what the letter says (a plot hook). You can still deliver it.',
          apply: [{ thread: { name: 'The Sealed Dispatch', note: 'Deliver the letter to Chief {chief} of Clan {clan}. You read it, but the seal looks unbroken.', resolve: { gold: 250, dm: 'Notice Board: consider +1 clan honour with Clan {clan}.' } } }],
          end: true
        },
        cracked: {
          text: 'The seal cracks. The thread still opens, but delivering it will bring suspicion, not thanks.',
          apply: [{ thread: { name: 'The Sealed Dispatch', note: 'Deliver the letter to Chief {chief} of Clan {clan}. Its seal is cracked.', resolve: { gold: 0, dm: 'Notice Board: consider −1 clan honour with Clan {clan}.' } } }],
          end: true
        }
      }
    },

    /* ================= Travel events: Telluria's lands ================= */
    {
      id: 't7', code: 'T7', kind: 'travel', title: 'Rootfall', where: { gods: ['telluria'] },
      line: 'Dexterity saves, Athletics, Religion · a blessing or a curse',
      steps: {
        start: {
          text: 'The road gives way. Earth and stones pour into a hollow below, held up by roots as thick as a man.',
          check: { skill: 'Dexterity saving throw', dc: 14, who: 'each', whoText: 'Every hero makes the save. Tick who failed: they fall 20 feet into the hollow (2d6 bludgeoning).', anyFail: 'climb', noneFail: 'below' }
        },
        climb: {
          text: '{failed} fell 20 feet into the hollow (2d6 bludgeoning) and must climb out.',
          check: { skill: 'Strength (Athletics)', dc: 13, who: 'each', among: 'failed', whoText: 'Each hero who fell rolls. Tick who failed the climb.', anyFail: 'slow', noneFail: 'below' }
        },
        slow: { text: 'Hauling them out takes time.', apply: [{ miles: -6 }], next: 'below' },
        below: {
          text: 'Below, the roots are carved with old marks around a stone bowl of coins.',
          check: { skill: 'Intelligence (Religion)', dc: 14, who: 'one', success: 'shrine', failure: 'marks' }
        },
        shrine: {
          text: 'It\'s a forgotten shrine of Telluria, and the coins are offerings.',
          choices: [
            { label: 'Leave an offering: −50 gold', go: 'offer' },
            { label: 'Take the coins: +150 gold', go: 'take' },
            { label: 'Leave it be', go: 'leave' }
          ]
        },
        marks: {
          text: 'Old marks and a bowl of coins. You can\'t tell what they mean.',
          choices: [
            { label: 'Leave an offering: −50 gold', go: 'offer' },
            { label: 'Take the coins: +150 gold', go: 'take' },
            { label: 'Leave it be', go: 'leave' }
          ]
        },
        offer: {
          text: 'You leave an offering among the roots.',
          apply: [{ gold: -50 }, { effect: { name: 'Telluria\'s Footing', text: 'advantage on saves against being knocked prone or restrained', who: 'party', days: 3 } }],
          end: true
        },
        take: {
          text: 'You take the coins.',
          apply: [{ gold: 150 }, { effect: { name: 'Root-Cursed', text: 'disadvantage on Wisdom (Survival) checks on Telluria\'s maps', who: 'party', days: 7 } }],
          end: true
        },
        leave: { text: 'Nothing gained, nothing lost.', end: true }
      }
    },

    {
      id: 't8', code: 'T8', kind: 'travel', title: 'The Waystone Riddle', where: { gods: ['telluria'] },
      line: 'riddle, with a Nature check for a hint',
      steps: {
        start: {
          text: 'A mossy waystone stands where three tracks meet. A verse is cut into its face, and beneath it is a hollow sealed with a disc of stone.',
          verse: ['I grip the hill but have no hand,', 'I drink the rain beneath the land.', 'The oak stands tall for all to see,', 'yet it would fall if not for me.'],
          puzzle: {
            kind: 'riddle', tries: 2,
            hint: { skill: 'Intelligence (Nature)', dc: 13, text: 'Look down, not up.' },
            wrongText: 'The stone hums. One more try.',
            answer: 'Roots (or a root).',
            solved: 'right', wrong: 'wrong'
          }
        },
        right: {
          text: 'The disc rolls aside.',
          apply: [{ gold: 100 }, { dm: 'A potion of greater healing lies with the gold.' }],
          end: true
        },
        wrong: {
          text: 'Roots burst up around the party\'s feet.',
          check: { skill: 'Strength saving throw', dc: 13, who: 'each', anyFail: 'cut', noneFail: 'shut' }
        },
        cut: { text: 'Cutting them free takes time, and the hollow stays shut.', apply: [{ miles: -6 }], end: true },
        shut: { text: 'You pull free, but the hollow stays shut.', end: true }
      }
    },

    {
      /* Switched off (Harry, 6 October 2026): no Rootbound creature before the Heartwood finale. */
      id: 't9', code: 'T9', kind: 'travel', off: true, title: 'The Husk in the Furrows', where: { gods: ['telluria'] },
      line: 'Nature or Arcana, then Survival · may lead to a fight',
      steps: {
        start: {
          text: 'A farmer waves you down at the edge of his field. "It\'s my scarecrow. It wasn\'t facing this way this morning." Roots have grown up through its straw, and they are still moving.',
          check: { skill: 'Intelligence (Nature) or Intelligence (Arcana)', dc: 15, who: 'one', success: 'known', failure: 'unknown' }
        },
        known: {
          text: 'This is the sickness that makes Rootbound creatures, and it hasn\'t finished growing.',
          choices: [
            { label: 'Destroy it now: fight', go: 'destroy' },
            { label: 'Trace the roots: Wisdom (Survival), DC 16', go: 'trace' }
          ]
        },
        unknown: {
          text: 'Roots in a scarecrow, still moving. You don\'t know what it means.',
          choices: [
            { label: 'Destroy it now: fight', go: 'destroy' },
            { label: 'Trace the roots: Wisdom (Survival), DC 16', go: 'trace' }
          ]
        },
        destroy: { text: 'The Husk lurches out of the furrows.', fight: { suggest: 'One Rootbound Husk (35 HP, as in the Heartwood Ritual).', encounter: 't9', won: 'thanks', fled: 'fled' } },
        thanks: { text: 'The farmer presses all he has on you.', apply: [{ gold: 60 }], end: true },
        trace: {
          text: 'You follow the roots.',
          check: { skill: 'Wisdom (Survival)', dc: 16, who: 'one', success: 'deep', failure: 'cold' }
        },
        deep: {
          text: 'The roots run deep and far.',
          apply: [{ thread: { name: 'The Spreading Rot', note: 'The roots run deep and far. DM: decide where they lead.' } }],
          end: true
        },
        cold: {
          text: 'The trail goes cold, and the Husk is waiting when you return.',
          apply: [{ miles: -6 }],
          fight: { suggest: 'One Rootbound Husk (35 HP, as in the Heartwood Ritual).', encounter: 't9', won: 'coldWon', fled: 'fled' }
        },
        coldWon: { text: 'The Husk is destroyed.', end: true },
        fled: { text: 'You get away.', end: true }
      }
    },

    {
      id: 't10', code: 'T10', kind: 'travel', title: 'The Muster Checkpoint', where: { maps: ['eastern_province_north'] },
      line: 'Persuasion or Deception, Insight',
      steps: {
        start: {
          text: 'Riders in teal block the road, a white stallion on every shield. Their captain eyes your weapons. "Strangers, armed, on Clan Slade\'s road. Who sent you?"',
          choices: [
            { label: 'First, read the captain (optional): Wisdom (Insight), DC 14', go: 'insight' },
            { label: 'The truth: Charisma (Persuasion), DC 15', go: 'truth' },
            { label: 'A cover story: Charisma (Deception), DC 14 (easier, but riskier)', go: 'cover' }
          ]
        },
        insight: {
          text: 'You watch the captain closely.',
          check: { skill: 'Wisdom (Insight)', dc: 14, who: 'one', success: 'frightened', failure: 'unreadable' }
        },
        frightened: {
          text: 'The captain is frightened, not hostile.',
          choices: [
            { label: 'The truth: Charisma (Persuasion), DC 15', go: 'truth' },
            { label: 'A cover story: Charisma (Deception), DC 14 (easier, but riskier)', go: 'cover' }
          ]
        },
        unreadable: {
          text: 'You can\'t read the captain.',
          choices: [
            { label: 'The truth: Charisma (Persuasion), DC 15', go: 'truth' },
            { label: 'A cover story: Charisma (Deception), DC 14 (easier, but riskier)', go: 'cover' }
          ]
        },
        truth: {
          text: 'You tell the truth.',
          check: { skill: 'Charisma (Persuasion)', dc: 15, who: 'one', success: 'news', failure: 'held' }
        },
        cover: {
          text: 'You spin a cover story.',
          check: { skill: 'Charisma (Deception)', dc: 14, who: 'one', success: 'news', failure: 'held', failBy5: 'caught' }
        },
        news: {
          text: 'The captain relaxes and shares the news.',
          apply: [{ thread: { name: 'Slade\'s Worry', note: 'The checkpoint captain is frightened. DM: decide what Chief Harlan Slade fears.' } }],
          end: true
        },
        held: {
          text: 'You\'re held for questioning until dusk, unless you pay a 100 gold "fine" to go now.',
          choices: [
            { label: 'Wait until dusk: lose the rest of today\'s miles', go: 'dusk' },
            { label: 'Pay the fine: −100 gold', go: 'fine' }
          ]
        },
        dusk: { text: 'They let you go at dusk.', apply: [{ loseDay: true }], end: true },
        fine: { text: 'You pay, and they wave you on.', apply: [{ gold: -100 }], end: true },
        caught: {
          text: 'Caught in a lie. You\'re held overnight, with no long rest.',
          apply: [{ effect: { name: 'No long rest', text: 'no benefit from tonight\'s long rest', who: 'party', night: true } }, { loseDay: true }, { dm: 'Notice Board: consider −1 clan honour with Clan Slade.' }],
          end: true
        }
      }
    },

    /* ================= Travel events: Aurush's lands ================= */
    {
      id: 't11', code: 'T11', kind: 'travel', title: 'The Light Coin', where: { maps: ['southern_province_west'] },
      line: 'puzzle, then Insight',
      steps: {
        start: {
          text: 'A money-changer has set his scales on a barrel by the road. Nine gold coins sit in front of him, and one is a forgery, a touch lighter than the rest. "Find it in two weighings and I\'ll pay you a hundred gold. Need three, and you pay me fifty."',
          puzzle: {
            kind: 'puzzle',
            prompt: 'The players solve it aloud. Nine real coins or tokens on the table make it fun.',
            hint: { skill: 'Intelligence', dc: 14, text: 'Weigh three against three.' },
            answer: 'Weigh three against three. If they balance, the fake is in the last three; if not, it\'s in the lighter three. Then weigh one coin of that three against another. The lighter one is fake; if they balance, it\'s the third.',
            solved: 'paid', giveUp: 'pay'
          }
        },
        paid: { text: 'He pays up, a little sourly.', apply: [{ gold: 100 }], next: 'strongbox' },
        pay: { text: 'You pay him his fifty.', apply: [{ gold: -50 }], next: 'strongbox' },
        strongbox: {
          text: 'He settles up from his strongbox.',
          choices: [
            { label: 'Watch him: Wisdom (Insight), DC 15', go: 'watch' },
            { label: 'Walk on', go: 'walk' }
          ]
        },
        watch: {
          text: 'You watch him closely.',
          check: { skill: 'Wisdom (Insight)', dc: 15, who: 'one', success: 'falseGold', failure: 'nothingOdd' }
        },
        falseGold: {
          text: 'He keeps glancing at his own strongbox, and its coins are light too. Someone is flooding the province with false gold.',
          apply: [{ thread: { name: 'False Gold', note: 'Light coins in the money-changer\'s strongbox: someone is flooding the Southern Province with false gold.' } }],
          end: true
        },
        nothingOdd: { text: 'Nothing odd that you can see.', end: true },
        walk: { text: 'You walk on.', end: true }
      }
    },

    {
      id: 't12', code: 'T12', kind: 'travel', title: 'The Sunburst Shrine', where: { provinces: ['southern_province', 'western_province'] },
      line: 'riddle, with a Religion check for a hint · a blessing',
      steps: {
        start: {
          text: 'A wayside shrine stands on a rise, a bronze sunburst above its altar. The priest of the Temple of Aurush who keeps it smiles. "Answer truly, and take the blessing."',
          verse: ['No thief can take me, no chest can hold,', 'I\'m spent each evening, yet always gold.', 'I\'m born each morning and die each night,', 'and all your shadows are made from my light.'],
          puzzle: {
            kind: 'riddle', tries: 1,
            hint: { skill: 'Intelligence (Religion)', dc: 13, text: 'Look above the altar.' },
            answer: 'The sun.',
            solved: 'blessed', wrong: 'wrong'
          }
        },
        blessed: {
          text: 'The priest raises a hand in blessing.',
          apply: [{ effect: { name: 'Aurush\'s Warmth', text: '10 temporary hit points each, and advantage on saves against being frightened', who: 'party', camp: true } }],
          end: true
        },
        wrong: {
          text: '"Come back when you know Aurush better."',
          choices: [
            { label: 'Make an offering for the blessing anyway: −50 gold', go: 'offering' },
            { label: 'Walk on', go: 'walk' }
          ]
        },
        offering: {
          text: 'You make an offering, and the priest blesses you.',
          apply: [{ gold: -50 }, { effect: { name: 'Aurush\'s Warmth', text: '10 temporary hit points each, and advantage on saves against being frightened', who: 'party', camp: true } }],
          end: true
        },
        walk: { text: 'You walk on.', end: true }
      }
    },

    {
      id: 't13', code: 'T13', kind: 'travel', title: 'Lights Below Redport', where: { maps: ['western_province_south'] },
      line: 'Perception, then a choice · may lead to a fight',
      steps: {
        start: {
          text: 'From the cliff path you see a lantern blinking out at sea. Down in the cove, men are hauling crates up the shingle by the light of a shuttered lamp.',
          check: { skill: 'Wisdom (Perception)', dc: 14, who: 'one', success: 'mark', failure: 'crates' }
        },
        mark: {
          text: 'The crates are stamped with Clan Farmer\'s own mark. Someone inside the clan is in on it.',
          choices: [
            { label: 'Report it', go: 'reportMark' },
            { label: 'Demand a cut: Charisma (Intimidation), DC 16', go: 'cut' },
            { label: 'Raid the cove: group Dexterity (Stealth), DC 15, to get down unseen', go: 'raid' },
            { label: 'Walk on', go: 'walk' }
          ]
        },
        crates: {
          text: 'You see crates, nothing more.',
          choices: [
            { label: 'Report it', go: 'report' },
            { label: 'Demand a cut: Charisma (Intimidation), DC 16', go: 'cut' },
            { label: 'Raid the cove: group Dexterity (Stealth), DC 15, to get down unseen', go: 'raid' },
            { label: 'Walk on', go: 'walk' }
          ]
        },
        reportMark: {
          text: 'You\'ll report what you saw.',
          apply: [{ thread: { name: 'The Redport Cove', note: 'Smugglers in the cove below Redport, with crates under Clan Farmer\'s own mark. DM: decide who the smugglers name.', resolve: { gold: 200, dm: 'Notice Board: consider +1 clan honour with Clan Farmer.' } } }],
          end: true
        },
        report: {
          text: 'You\'ll report what you saw.',
          apply: [{ thread: { name: 'The Redport Cove', note: 'Smugglers in the cove below Redport.', resolve: { gold: 200, dm: 'Notice Board: consider +1 clan honour with Clan Farmer.' } } }],
          end: true
        },
        cut: {
          text: 'You walk down and demand a cut.',
          check: { skill: 'Charisma (Intimidation)', dc: 16, who: 'one', success: 'quiet', failure: 'cutFight' }
        },
        quiet: {
          text: 'They pay you to keep quiet.',
          apply: [{ gold: 250 }, { dm: 'If this ever comes out: −1 clan honour with Clan Farmer.' }],
          end: true
        },
        cutFight: {
          text: 'They reach for their weapons.',
          fight: { suggest: 'Levels 7–10: a bandit captain, 4 thugs and 6 bandits. Levels 11–16: add 2 veterans.', encounter: 't13', won: 'cutWon', fled: 'fled' }
        },
        cutWon: { text: 'The smugglers are beaten.', end: true },
        raid: {
          text: 'You creep down the cliff path.',
          check: { skill: 'Dexterity (Stealth)', dc: 15, who: 'group', pace: 'stealth', success: 'surrender', failure: 'raidFight' }
        },
        surrender: { text: 'They surrender. The contraband is yours.', apply: [{ gold: 300 }], end: true },
        raidFight: {
          text: 'They see you coming.',
          fight: { suggest: 'Levels 7–10: a bandit captain, 4 thugs and 6 bandits. Levels 11–16: add 2 veterans.', encounter: 't13', won: 'raidWon', fled: 'fled' }
        },
        raidWon: { text: 'The smugglers are beaten. The contraband is yours.', apply: [{ gold: 300 }], end: true },
        fled: { text: 'You get away.', end: true },
        walk: { text: 'You walk on.', end: true }
      }
    },

    {
      id: 't14', code: 'T14', kind: 'travel', title: 'The Prospector\'s Claim', where: { provinces: ['southern_province'] },
      line: 'Nature, then a gamble that pays off a week later',
      /* When the event fires, the tool secretly decides whether the vein is genuine (1 in 2) or the sample was salted. */
      secret: { key: 'vein', chance: 0.5, yes: 'genuine', no: 'salted' },
      steps: {
        start: {
          text: 'A sunburnt prospector hails you from a dry gully, waving a lump of rock threaded with gold. "Rich vein, but I need coin for tools. A hundred gold buys a quarter-share."',
          check: { skill: 'Intelligence (Nature)', dc: 15, who: 'one', success: 'known', failure: 'unknown' }
        },
        known: {
          textIf: { key: 'vein', genuine: 'The vein is genuine: that gold grew in the rock.', salted: 'The sample was salted: the gold was pressed into the rock by hand.' },
          choices: [
            { label: 'Buy the share: −100 gold', go: 'buy' },
            { label: 'Walk on', go: 'walk' }
          ]
        },
        unknown: {
          text: 'You can\'t tell whether the vein is genuine.',
          choices: [
            { label: 'Buy the share: −100 gold', go: 'buy' },
            { label: 'Walk on', go: 'walk' }
          ]
        },
        buy: {
          text: 'You buy a quarter-share. He promises word within the week.',
          apply: [{ gold: -100 }, { thread: { name: 'The Prospector\'s Claim', note: 'A quarter-share in a gold vein. Word should come in 7 days.', follow: { event: 'f2', scope: 'any', from: 7, to: 7 }, keep: ['vein'] } }],
          end: true
        },
        walk: { text: 'You walk on.', end: true }
      }
    },

    /* ================= Travel events: Pelagos' isles ================= */
    {
      id: 't15', code: 'T15', kind: 'travel', title: 'The Tide Causeway', where: { provinces: ['the_north_isle', 'the_east_isle'] },
      line: 'riddle, then group Athletics',
      steps: {
        start: {
          text: 'A causeway of black stones runs between two headlands, slick with weed. The tide is out but already turning. On a weathered post at the near end, someone has carved a verse.',
          verse: ['Twice each day I climb the stair,', 'and twice I leave it washed and bare.', 'I steal the sand and give it back;', 'the moon alone can turn my track.'],
          puzzle: { kind: 'riddle', tries: 1, answer: 'The tide.', solved: 'notches', wrong: 'blank' }
        },
        notches: {
          text: 'The post\'s other face shows the safe hours, cut as notches. The crossing check has advantage.',
          choices: [
            { label: 'Cross now: group Strength (Athletics), DC 15, with advantage', go: 'cross', set: { adv: true } },
            { label: 'Go the long way', go: 'long' }
          ]
        },
        blank: {
          text: 'The verse keeps its secret.',
          choices: [
            { label: 'Cross now: group Strength (Athletics), DC 15', go: 'cross' },
            { label: 'Go the long way', go: 'long' }
          ]
        },
        cross: {
          text: 'You start across the causeway.',
          check: { skill: 'Strength (Athletics)', dc: 15, who: 'group', advIf: 'adv', advText: 'With advantage: the notches show the safe hours.', success: 'across', failure: 'caught' }
        },
        across: { text: 'Across in time, saving the long way round.', apply: [{ miles: 12 }], end: true },
        caught: {
          text: 'The sea catches you halfway.',
          apply: [{ gold: -100, why: 'lost to the water' }, { effect: { name: 'Sea-Chilled', text: 'disadvantage on Constitution saves', who: 'party', camp: true } }],
          end: true
        },
        long: { text: 'You go the long way. No change.', end: true }
      }
    },

    {
      id: 't16', code: 'T16', kind: 'travel', title: 'The Drowned Bell', where: { maps: ['the_east_isle'] },
      line: 'Perception, Athletics, a Constitution save',
      steps: {
        start: {
          text: 'At low tide a bell rings beneath the water, slow and steady. The fishermen on the strand won\'t put out. "It rang like that the night the Maren went down."',
          check: { skill: 'Wisdom (Perception)', dc: 14, who: 'one', success: 'mast', failure: 'lost' }
        },
        lost: { text: 'You can\'t find where it rings from.', end: true },
        mast: {
          text: 'A mast shows just under the surface, the bell still in its rigging, swinging with the current.',
          choices: [
            { label: 'Dive the wreck: one hero, Strength (Athletics), DC 15, then a Constitution save, DC 14', go: 'dive' },
            { label: 'Leave it', go: 'leave' }
          ]
        },
        dive: {
          text: 'One hero dives for the wreck.',
          check: { skill: 'Strength (Athletics)', dc: 15, who: 'one', success: 'reach', failure: 'driven' }
        },
        reach: {
          text: '{hero} reaches the wreck. The cold bites.',
          check: { skill: 'Constitution saving throw', dc: 14, who: 'same', success: 'strongbox', failure: 'chilled' }
        },
        strongbox: {
          text: 'The captain\'s strongbox, and the ship\'s log.',
          apply: [{ gold: 200 }, { thread: { name: 'The Maren\'s Last Voyage', note: 'The ship\'s log of the Maren. DM: decide why she sank.' } }],
          end: true
        },
        chilled: {
          text: 'The cold drives the breath out of {hero}, who comes up empty-handed.',
          apply: [{ effect: { name: 'Sea-Chilled', text: 'disadvantage on Strength and Dexterity checks', who: 'hero', camp: true } }],
          end: true
        },
        driven: { text: 'The current drives {hero} back. Nothing gained.', end: true },
        leave: { text: 'The fishermen nod, as if you\'ve done the wise thing.', end: true }
      }
    },

    {
      id: 't18', code: 'T18', kind: 'travel', title: 'The Salt-Ring Recruiter', where: { maps: ['the_east_isle'] },
      line: 'Athletics, or Intimidation or Performance · a hook into the Arenas',
      steps: {
        start: {
          text: 'A broad, scarred woman has a ship\'s anchor chained to a post by the road. "The Salt-Ring wants fighters. Lift that chest-high and there\'s a place for you in the Trials, and a purse for the trying."',
          choices: [
            { label: 'Lift it: one hero, Strength (Athletics), DC 17, no Help', go: 'lift' },
            { label: 'Talk your way in: Charisma (Intimidation) or Charisma (Performance), DC 16', go: 'talk' }
          ]
        },
        lift: {
          text: 'One hero takes hold of the anchor.',
          check: { skill: 'Strength (Athletics)', dc: 17, who: 'one', help: false, success: 'lifted', failure: 'strained' }
        },
        lifted: {
          text: 'Chest-high. She grins and pays up.',
          apply: [{ gold: 100 }, { inspiration: 'hero' }, { dm: 'Arenas: the party is invited to the Salt-Ring Trials.' }],
          end: true
        },
        strained: {
          text: '{hero} strains something.',
          apply: [{ effect: { name: 'Strained', text: 'disadvantage on Strength checks', who: 'hero', camp: true } }],
          end: true
        },
        talk: {
          text: 'You try to talk your way in.',
          check: { skill: 'Charisma (Intimidation) or Charisma (Performance)', dc: 16, who: 'one', success: 'invited', failure: 'laughed' }
        },
        invited: { text: 'You have your invitation, but no purse.', apply: [{ dm: 'Arenas: the party is invited to the Salt-Ring Trials.' }], end: true },
        laughed: { text: 'She laughs you down the road.', end: true }
      }
    },

    /* ================= Campfire events ================= */
    {
      id: 'c1', code: 'C1', kind: 'camp', title: 'A Stranger at the Fire', where: { any: true },
      line: 'Insight, then Perception on watch',
      steps: {
        start: {
          text: 'A woman in a travel-stained cloak steps into the firelight, hands open. "I\'ve walked since noon. Might I share your fire till morning?"',
          check: { skill: 'Wisdom (Insight)', dc: 15, who: 'one', success: 'frightened', failure: 'weary' }
        },
        frightened: {
          text: 'She\'s frightened, and never lets go of her satchel.',
          choices: [
            { label: 'Welcome her', go: 'watchEasy' },
            { label: 'Turn her away', go: 'away' }
          ]
        },
        weary: {
          text: 'She seems weary, nothing more.',
          choices: [
            { label: 'Welcome her', go: 'watchHard' },
            { label: 'Turn her away', go: 'away' }
          ]
        },
        watchEasy: {
          text: 'She shares your fire. The hero on last watch keeps an eye on her.',
          check: { skill: 'Wisdom (Perception)', dc: 13, who: 'one', success: 'packs', failure: 'gone' }
        },
        watchHard: {
          text: 'She shares your fire. The hero on last watch keeps an eye on her.',
          check: { skill: 'Wisdom (Perception)', dc: 16, who: 'one', success: 'packs', failure: 'gone' }
        },
        packs: {
          text: 'You catch her going through your packs. Cornered, she confesses: she\'s fled a Clan {clan} household with her master\'s letters.',
          choices: [
            { label: 'Let her go with the letters', go: 'letGo' },
            { label: 'Take the letters', go: 'takeLetters' }
          ]
        },
        letGo: {
          text: 'She slips away into the dark with the letters.',
          apply: [{ thread: { name: 'The Runaway\'s Letters', note: 'A runaway from a Clan {clan} household, carrying her master\'s letters.' } }],
          end: true
        },
        takeLetters: {
          text: 'You keep the letters. She runs.',
          apply: [{ thread: { name: 'The Runaway\'s Letters', note: 'You hold the letters a runaway took from her master\'s Clan {clan} household.' } }],
          end: true
        },
        gone: { text: 'She\'s gone by dawn, and so is 100 gold.', apply: [{ gold: -100 }], end: true },
        away: { text: 'She goes into the dark without a word.', end: true }
      }
    },

    {
      id: 'c2', code: 'C2', kind: 'camp', title: 'Bones by Firelight', where: { any: true },
      line: 'a game of chance, Insight, Sleight of Hand · gold won or lost',
      steps: {
        start: {
          text: 'Drovers at the next fire call across. "Fancy a game of bones? We play for gold."',
          choices: [
            { label: 'Play for 50 gold', go: 'stake', set: { stake: 50 } },
            { label: 'Play for 100 gold', go: 'stake', set: { stake: 100 } },
            { label: 'Play for 200 gold', go: 'stake', set: { stake: 200 } }
          ]
        },
        stake: {
          text: 'One hero sits down to play for {stake} gold.',
          choices: [
            { label: 'Watch the drovers first: Wisdom (Insight), DC 15', go: 'insight' },
            { label: 'Just play', go: 'game' }
          ]
        },
        insight: {
          text: 'You watch the drovers\' hands.',
          check: { skill: 'Wisdom (Insight)', dc: 15, who: 'one', success: 'palming', failure: 'game' }
        },
        palming: {
          text: 'One drover is palming the dice.',
          choices: [
            { label: 'Call it out: Charisma (Intimidation), DC 14', go: 'callOut' },
            { label: 'Cheat them back: Dexterity (Sleight of Hand), DC 15', go: 'cheat' },
            { label: 'Play on', go: 'game' }
          ]
        },
        callOut: {
          text: 'You call it out.',
          check: { skill: 'Charisma (Intimidation)', dc: 14, who: 'one', success: 'peace', failure: 'brawl' }
        },
        peace: { text: 'They pay double your stake to keep the peace.', apply: [{ gold: { stake: 2 } }], end: true },
        brawl: { text: 'A brawl breaks up the game. No gold changes hands.', end: true },
        cheat: {
          text: 'You try to cheat them back.',
          check: { skill: 'Dexterity (Sleight of Hand)', dc: 15, who: 'one', success: 'quick', failure: 'game', failBy5: 'busted' }
        },
        quick: { text: 'Your hands are quicker than theirs: the hero plays with advantage.', set: { adv: true }, next: 'game' },
        busted: { text: 'Caught! You lose your stake at once.', apply: [{ gold: { stake: -1 } }], end: true },
        game: {
          text: 'Best of three, for {stake} gold.',
          contest: { opponent: 'The drovers', bonus: 5, heroRoll: 'd20 + Wisdom modifier (+ proficiency with a dice set)', advIf: 'adv', need: 2, win: 'won', lose: 'lost' }
        },
        won: { text: 'The pot is yours.', apply: [{ gold: { stake: 1 } }], end: true },
        lost: { text: 'The drovers take the pot.', apply: [{ gold: { stake: -1 } }], end: true }
      }
    },

    {
      id: 'c3', code: 'C3', kind: 'camp', title: 'The Bard\'s Wager', where: { any: true },
      line: 'Performance, with a real tale told at the table',
      steps: {
        start: {
          text: 'A bard with a battered lute shares your fire and soon makes a challenge. "A tale for a tale. Best story takes the pot." She drops 50 gold on the blanket.',
          next: 'tale'
        },
        tale: {
          text: 'One player tells a real story at the table, a minute or two. If the table enjoys it, the DM gives advantage.',
          check: { skill: 'Charisma (Performance)', dc: 15, who: 'one', success: 'won', failure: 'lost' }
        },
        won: {
          text: 'The pot is yours, and she trades you a rumour.',
          apply: [{ gold: 50 }, { inspiration: 'hero' }, { thread: { name: 'The Bard\'s Rumour', note: 'A rumour from the bard at the campfire. DM: write the rumour.' } }],
          end: true
        },
        lost: {
          text: 'She takes your matching stake, and shares the rumour anyway, out of kindness.',
          apply: [{ gold: -50 }, { thread: { name: 'The Bard\'s Rumour', note: 'A rumour from the bard at the campfire. DM: write the rumour.' } }],
          end: true
        }
      }
    },

    {
      id: 'c4', code: 'C4', kind: 'camp', title: 'The Deserter', where: { any: true },
      line: 'Insight, then Deception · a hard choice',
      steps: {
        start: {
          text: 'A young soldier stumbles out of the dark and falls by your fire. His tabard is Clan {clan}\'s, torn where the badge was ripped away. "Please. They\'ll hang me."',
          check: { skill: 'Wisdom (Insight)', dc: 15, who: 'one', success: 'honest', failure: 'unsure' }
        },
        honest: {
          text: 'He\'s telling the truth as he sees it. DM: decide what he ran from.',
          choices: [
            { label: 'Shelter him', go: 'shelter' },
            { label: 'Hand him over: +100 gold', go: 'hand' },
            { label: 'Send him on before dawn', go: 'send' }
          ]
        },
        unsure: {
          text: 'You can\'t tell whether he\'s telling the truth.',
          choices: [
            { label: 'Shelter him', go: 'shelter' },
            { label: 'Hand him over: +100 gold', go: 'hand' },
            { label: 'Send him on before dawn', go: 'send' }
          ]
        },
        shelter: {
          text: 'His hunters arrive before dawn.',
          check: { skill: 'Charisma (Deception)', dc: 15, who: 'one', success: 'hidden', failure: 'dragged' }
        },
        hidden: {
          text: 'They ride on.',
          apply: [{ thread: { name: 'The Deserter\'s Debt', note: 'A Clan {clan} deserter owes you his life.' } }],
          end: true
        },
        dragged: { text: 'They drag him out.', apply: [{ dm: 'Notice Board: consider −1 clan honour with Clan {clan}.' }], end: true },
        hand: {
          text: 'The hunters pay his bounty.',
          apply: [{ gold: 100 }, { dm: 'Notice Board: consider +1 clan honour with Clan {clan}.' }],
          end: true
        },
        send: { text: 'He goes before dawn. Nothing gained, nothing lost.', end: true }
      }
    },

    {
      id: 'c5', code: 'C5', kind: 'camp', title: 'The Heartbeat in the Earth', where: { gods: ['telluria'] },
      line: 'Wisdom saves, Survival · a vision or a lost night',
      steps: {
        start: {
          text: 'Lying on the bare ground, you hear it before you feel it: a slow, deep beat coming up through the soil. Like a heart. Very large, and very far down.',
          choices: [
            { label: 'Listen: Wisdom save, DC 15', go: 'listen' },
            { label: 'Move camp: group Wisdom (Survival), DC 13', go: 'move' },
            { label: 'Ignore it: Wisdom save, DC 12', go: 'ignore' }
          ]
        },
        listen: {
          text: 'You lie still and listen.',
          check: { skill: 'Wisdom saving throw', dc: 15, who: 'each', whoText: 'Each hero who listens makes the save. Tick who failed.', next: 'listened' }
        },
        listened: {
          text: 'Those who held on see a vision of roots, green light and something bound (DM: describe it). The beat follows the others into sleep.',
          apply: [
            { effect: { name: 'Rooted', text: 'advantage on Wisdom saves', who: 'succeeded', days: 3 } },
            { effect: { name: 'No long rest', text: 'no benefit from tonight\'s long rest', who: 'failed', night: true } }
          ],
          end: true
        },
        move: {
          text: 'You look for a new spot in the dark.',
          check: { skill: 'Wisdom (Survival)', dc: 13, who: 'group', success: 'slept', failure: 'blunder' }
        },
        slept: { text: 'You find a new spot and sleep well.', end: true },
        blunder: { text: 'You blunder about half the night and start late.', apply: [{ miles: -6 }], end: true },
        ignore: {
          text: 'You try to ignore it.',
          check: { skill: 'Wisdom saving throw', dc: 12, who: 'each', next: 'ignored' }
        },
        ignored: {
          text: 'Morning comes.',
          apply: [{ effect: { name: 'Slept Badly', text: 'disadvantage on Wisdom checks', who: 'failed', camp: true } }],
          end: true
        }
      }
    },

    {
      id: 'c6', code: 'C6', kind: 'camp', title: 'Wolf-Song', where: { maps: ['northern_province_east'] },
      line: 'Animal Handling, then Survival or Intimidation · may lead to a fight',
      steps: {
        start: {
          text: 'Eyes in the treeline. A dozen wolves circle just outside the firelight, thin as rakes and far too bold. A white-muzzled old one sits and stares at you.',
          check: { skill: 'Wisdom (Animal Handling)', dc: 15, who: 'one', success: 'starving', failure: 'wild' }
        },
        starving: {
          text: 'They\'re starving, driven from their hunting grounds by something bigger.',
          apply: [{ thread: { name: 'What Drove the Wolves Out', note: 'Something bigger drove the wolves from their hunting grounds near Wolfhaven.' } }],
          choices: [
            { label: 'Hunt for them: Wisdom (Survival), DC 15', go: 'hunt' },
            { label: 'Drive them off: Charisma (Intimidation), DC 14, with fire and noise', go: 'drive' }
          ]
        },
        wild: {
          text: 'You can\'t tell what they want.',
          choices: [
            { label: 'Hunt for them: Wisdom (Survival), DC 15', go: 'hunt' },
            { label: 'Drive them off: Charisma (Intimidation), DC 14, with fire and noise', go: 'drive' }
          ]
        },
        hunt: {
          text: 'You go hunting in the dark.',
          check: { skill: 'Wisdom (Survival)', dc: 15, who: 'one', success: 'fed', failure: 'pack' }
        },
        fed: {
          text: 'You bring back a deer and the pack melts away. Later, they shadow you.',
          apply: [{ effect: { name: 'Wolf-Friend', text: 'advantage on Perception checks to spot danger on this map', who: 'party', days: 7 } }],
          end: true
        },
        drive: {
          text: 'Fire and noise.',
          check: { skill: 'Charisma (Intimidation)', dc: 14, who: 'one', success: 'scatter', failure: 'pack' }
        },
        scatter: { text: 'They scatter.', end: true },
        pack: {
          text: 'The pack loses patience.',
          fight: { suggest: 'Levels 7–10: 12 wolves and the old one as a dire wolf. Levels 11–16: add 2 winter wolves.', encounter: 'c6', won: 'beaten', fled: 'fled' }
        },
        beaten: { text: 'The pack is broken.', end: true },
        fled: { text: 'You get away from the pack.', end: true }
      }
    },

    {
      id: 'c7', code: 'C7', kind: 'camp', title: 'The Forester\'s Riddle', where: { gods: ['telluria'] },
      line: 'riddle for a stake, with a Nature check for a hint',
      steps: {
        start: {
          text: 'An old forester with an axe across her knees shares your fire. After supper she holds up a carved wooden charm. "One riddle. Answer it and this is yours. Miss, and I\'ll have fifty gold for my trouble."',
          verse: ['I wear a cap but have no head,', 'I sleep the winter in a muddy bed.', 'I\'m smaller than your thumb today,', 'but I\'ll outlive you, come what may.'],
          puzzle: {
            kind: 'riddle', tries: 1,
            hint: { skill: 'Intelligence (Nature)', dc: 13, text: 'Look up at the tree you\'re sleeping under.' },
            answer: 'An acorn.',
            solved: 'charm', wrong: 'pay'
          }
        },
        charm: {
          text: 'She hands over the charm.',
          apply: [{ effect: { name: 'Forester\'s Knot', text: 'once, a hero may reroll a failed Survival or Nature check', who: 'party', used: true } }],
          end: true
        },
        pay: { text: 'She grins and tells you the answer.', apply: [{ gold: -50 }], end: true }
      }
    },

    {
      id: 'c8', code: 'C8', kind: 'camp', title: 'The Ember That Won\'t Die', where: { provinces: ['southern_province', 'western_province'] },
      line: 'Religion, a Constitution save · a sign from Aurush',
      steps: {
        start: {
          text: 'Long after you bank the fire, one ember keeps burning. Then it flares into the shape of a sunburst, hanging in the air above the ashes.',
          check: { skill: 'Intelligence (Religion)', dc: 14, who: 'one', success: 'sign', failure: 'unknown' }
        },
        sign: {
          text: 'It\'s a sign of Aurush, asking for a vigil until dawn.',
          choices: [
            { label: 'Keep the vigil: one hero stays awake all night', go: 'vigil' },
            { label: 'Douse it', go: 'douse' }
          ]
        },
        unknown: {
          text: 'You don\'t know what it wants.',
          choices: [
            { label: 'Keep the vigil: one hero stays awake all night', go: 'vigil' },
            { label: 'Douse it', go: 'douse' }
          ]
        },
        vigil: { text: 'One hero keeps the vigil.', pick: { prompt: 'Who keeps the vigil?', go: 'awake' } },
        awake: {
          text: '{hero} stays awake all night.',
          apply: [{ effect: { name: 'No long rest', text: 'no benefit from tonight\'s long rest', who: 'hero', night: true } }],
          check: { skill: 'Constitution saving throw', dc: 13, who: 'same', success: 'dawn', failure: 'worn' }
        },
        dawn: {
          text: 'At dawn the sunburst fades, and its warmth stays with you.',
          apply: [{ effect: { name: 'Aurush\'s Dawn', text: 'advantage on initiative rolls', who: 'party', days: 3 } }],
          end: true
        },
        worn: {
          text: 'At dawn the sunburst fades, and its warmth stays with you. The night has worn {hero} down.',
          apply: [
            { effect: { name: 'Exhaustion', text: '1 level of Exhaustion', who: 'hero', camp: true } },
            { effect: { name: 'Aurush\'s Dawn', text: 'advantage on initiative rolls', who: 'party', days: 3 } }
          ],
          end: true
        },
        douse: { text: 'It gutters out with a hiss. Nothing gained.', end: true }
      }
    },

    {
      id: 'c9', code: 'C9', kind: 'camp', title: 'The Debt Collector', where: { maps: ['southern_province_west'] },
      line: 'Investigation, then Persuasion or Intimidation',
      steps: {
        start: {
          text: 'A thin man in good boots walks into your camp with two large friends and a sheet of paper. "Two hundred gold, owed by you, signed in your names. Pay now, or my friends will help you find it."',
          check: { skill: 'Intelligence (Investigation)', dc: 15, who: 'one', success: 'forged', failure: 'real' }
        },
        forged: {
          text: 'It\'s forged. The signatures are wrong and the seal is cheap wax. Someone is borrowing in your names.',
          apply: [{ thread: { name: 'The Forged Debt', note: 'Someone is borrowing gold in the party\'s names.' } }],
          choices: [
            { label: 'Pay: −200 gold', go: 'pay' },
            { label: 'Argue: Charisma (Persuasion), DC 12, now you\'ve found the forgery', go: 'argueEasy' },
            { label: 'Throw them out: Charisma (Intimidation), DC 14', go: 'out' }
          ]
        },
        real: {
          text: 'It looks real enough.',
          choices: [
            { label: 'Pay: −200 gold', go: 'pay' },
            { label: 'Argue: Charisma (Persuasion), DC 15', go: 'argue' },
            { label: 'Throw them out: Charisma (Intimidation), DC 14', go: 'out' }
          ]
        },
        pay: { text: 'You pay.', apply: [{ gold: -200 }], end: true },
        argueEasy: {
          text: 'You argue, the forgery in your hand.',
          check: { skill: 'Charisma (Persuasion)', dc: 12, who: 'one', success: 'embarrassed', failure: 'promise' }
        },
        argue: {
          text: 'You argue.',
          check: { skill: 'Charisma (Persuasion)', dc: 15, who: 'one', success: 'embarrassed', failure: 'promise' }
        },
        embarrassed: { text: 'He leaves, embarrassed.', end: true },
        promise: {
          text: 'He leaves, promising you\'ll hear from him.',
          apply: [{ thread: { name: 'The Forged Debt', note: 'Someone is borrowing gold in the party\'s names, and the collector promised you\'d hear from him.' } }],
          end: true
        },
        out: {
          text: 'You tell them to get out.',
          check: { skill: 'Charisma (Intimidation)', dc: 14, who: 'one', success: 'gone', failure: 'brawl' }
        },
        gone: { text: 'They go.', end: true },
        brawl: {
          text: 'His friends step forward.',
          fight: { suggest: 'Levels 7–10: the collector (a spy) and his two friends (ogres). Levels 11–16: make the friends 2 hill giants.', encounter: 'c9', won: 'beaten', fled: 'fled' }
        },
        beaten: { text: 'They limp off into the dark.', end: true },
        fled: { text: 'You get away.', end: true }
      }
    },

    {
      id: 'c10', code: 'C10', kind: 'camp', title: 'The Beacons', where: { provinces: ['western_province'] },
      line: 'History, then a hard choice · a lost night\'s rest',
      steps: {
        start: {
          text: 'Just after dark, a beacon flares on the next hill. Then another beyond it, and another: a chain of fire running toward the coast.',
          check: { skill: 'Intelligence (History)', dc: 14, who: 'one', success: 'raid', failure: 'warning' }
        },
        raid: {
          text: 'It\'s Clan Farmer\'s raid warning. Raiders have landed near Redport or Westreach.',
          choices: [
            { label: 'Ride through the night: no long rest for anyone, then a fight at dawn', go: 'ride' },
            { label: 'Stay and keep watch: group Wisdom (Perception), DC 14', go: 'watch' }
          ]
        },
        warning: {
          text: 'You know it\'s a warning, not what of.',
          choices: [
            { label: 'Ride through the night: no long rest for anyone, then a fight at dawn', go: 'ride' },
            { label: 'Stay and keep watch: group Wisdom (Perception), DC 14', go: 'watch' }
          ]
        },
        ride: {
          text: 'You ride through the night, and meet the raiders at dawn.',
          apply: [{ effect: { name: 'No long rest', text: 'no benefit from tonight\'s long rest', who: 'party', night: true } }],
          fight: { suggest: 'Levels 7–10: a raider chief (a gladiator), 4 berserkers and 8 bandits. Levels 11–16: add 2 veterans.', encounter: 'c10ride', won: 'rideWon', fled: 'fled' }
        },
        rideWon: {
          text: 'The raiders are beaten.',
          apply: [{ gold: 300 }, { dm: 'Notice Board: consider +1 clan honour with Clan Farmer.' }],
          end: true
        },
        watch: {
          text: 'You douse the fire and keep watch.',
          check: { skill: 'Wisdom (Perception)', dc: 14, who: 'group', success: 'passed', failure: 'stumble' }
        },
        passed: { text: 'A raiding band passes close in the dark and never sees you.', end: true },
        stumble: {
          text: 'A raiding band stumbles on your camp.',
          fight: { suggest: 'Levels 7–10: a raider chief (a gladiator), 4 berserkers and 8 bandits. Levels 11–16: add 2 veterans.', encounter: 'c10camp', won: 'beatenOff', fled: 'fled' }
        },
        beatenOff: { text: 'You drive them off.', end: true },
        fled: { text: 'You get away.', end: true }
      }
    },

    {
      id: 'c11', code: 'C11', kind: 'camp', title: 'The Tide Ring', where: { provinces: ['the_north_isle', 'the_east_isle'] },
      line: 'Religion · a gift from the sea (camped near the shore)',
      steps: {
        start: {
          text: 'In the night the tide comes in higher than it should, and stops in a perfect ring around your camp. When it draws back, it leaves something on the sand: a pearl the size of a hen\'s egg.',
          check: { skill: 'Intelligence (Religion)', dc: 15, who: 'one', success: 'gift', failure: 'pearl' }
        },
        gift: {
          text: 'You know this is a gift from Pelagos, and the sea expects something back.',
          choices: [
            { label: 'Keep the pearl: +250 gold', go: 'keep' },
            { label: 'Return it', go: 'return' },
            { label: 'Pay the sea and keep it: −100 gold, +250 gold', go: 'pay' }
          ]
        },
        pearl: {
          text: 'It\'s just a pearl, as far as you know.',
          choices: [
            { label: 'Keep the pearl: +250 gold', go: 'keep' },
            { label: 'Return it', go: 'return' },
            { label: 'Pay the sea and keep it: −100 gold, +250 gold', go: 'pay' }
          ]
        },
        keep: {
          text: 'You keep the pearl.',
          apply: [{ gold: 250 }, { effect: { name: 'The Sea Remembers', text: 'disadvantage on swimming checks and on saves against the sea\'s hazards on the isles', who: 'party', days: 14 } }],
          end: true
        },
        'return': {
          text: 'You give the pearl back to the waves.',
          apply: [{ effect: { name: 'Pelagos\' Favour', text: 'advantage on swimming checks and on saves against drowning', who: 'party', days: 14 } }],
          end: true
        },
        pay: {
          text: 'You throw 100 gold into the waves and keep the pearl. No curse.',
          apply: [{ gold: -100, why: 'into the waves' }, { gold: 250, why: 'the pearl' }],
          end: true
        }
      }
    },

    {
      id: 'c12', code: 'C12', kind: 'camp', title: 'False Lights at Bleakharbour', where: { maps: ['the_north_isle'] },
      line: 'Perception, then Athletics or Stealth · may lead to a fight',
      steps: {
        start: {
          text: 'On the rocks below your camp, someone swings lanterns in a slow rhythm, the way a harbour light moves. Out in the dark, a ship\'s lamps are turning toward them.',
          check: { skill: 'Wisdom (Perception)', dc: 14, who: 'one', success: 'wreckers', failure: 'signals' }
        },
        wreckers: {
          text: 'There is no harbour there. These are wreckers, luring the ship onto the rocks.',
          choices: [
            { label: 'Warn the ship: one hero races to the headland with a torch, Strength (Athletics), DC 15', go: 'warn' },
            { label: 'Stop the wreckers: group Dexterity (Stealth), DC 15, to reach them unseen', go: 'stop' },
            { label: 'Leave it', go: 'leave' }
          ]
        },
        signals: {
          text: 'It looks like fishermen signalling.',
          choices: [
            { label: 'Warn the ship: one hero races to the headland with a torch, Strength (Athletics), DC 15', go: 'warn' },
            { label: 'Stop the wreckers: group Dexterity (Stealth), DC 15, to reach them unseen', go: 'stop' },
            { label: 'Leave it', go: 'leave' }
          ]
        },
        warn: {
          text: 'One hero races to the headland with a torch.',
          check: { skill: 'Strength (Athletics)', dc: 15, who: 'one', success: 'turned', failure: 'late' }
        },
        turned: {
          text: 'The ship turns in time.',
          apply: [{ thread: { name: 'The Captain\'s Thanks', note: 'You saved a ship from the wreckers at Bleakharbour. Her captain may come looking for you in 2 to 5 days.', follow: { event: 'f3', scope: 'isles', from: 2, to: 5 } } }],
          end: true
        },
        late: { text: 'Too late.', end: true },
        stop: {
          text: 'You creep down to the rocks.',
          check: { skill: 'Dexterity (Stealth)', dc: 15, who: 'group', success: 'surrender', failure: 'fight' }
        },
        surrender: {
          text: 'They surrender. The ship is saved.',
          apply: [
            { thread: { name: 'The Captain\'s Thanks', note: 'You saved a ship from the wreckers at Bleakharbour. Her captain may come looking for you in 2 to 5 days.', follow: { event: 'f3', scope: 'isles', from: 2, to: 5 } } },
            { dm: 'Notice Board: consider +1 clan honour with Clan Karr.' }
          ],
          end: true
        },
        fight: {
          text: 'They see you coming.',
          fight: { suggest: 'Levels 7–10: a bandit captain and 8 bandits. Levels 11–16: add 4 thugs.', encounter: 'c12', won: 'saved', fled: 'fled' }
        },
        saved: {
          text: 'The wreckers are beaten. The ship is saved.',
          apply: [
            { thread: { name: 'The Captain\'s Thanks', note: 'You saved a ship from the wreckers at Bleakharbour. Her captain may come looking for you in 2 to 5 days.', follow: { event: 'f3', scope: 'isles', from: 2, to: 5 } } },
            { dm: 'Notice Board: consider +1 clan honour with Clan Karr.' }
          ],
          end: true
        },
        fled: { text: 'You get away, and the lights swing on.', end: true },
        leave: { text: 'Before dawn you hear a hull break on the rocks.', end: true }
      }
    },

    /* ================= Follow-ups ================= */
    {
      id: 'f1', code: 'F1', kind: 'follow', title: 'The Toll-Men Return', where: { any: true },
      line: 'from T1 · Perception, then a fight or a payment',
      steps: {
        start: {
          text: 'The toll-men are back, with six friends, and this time they\'ve chosen the ground.',
          check: { skill: 'Wisdom (Perception)', dc: 15, who: 'each', pace: 'perception', whoText: 'Every hero rolls. Tick who failed: they are surprised in the first round.', next: 'choose' }
        },
        choose: {
          text: 'They close in.',
          apply: [{ note: { any: 'Surprised in the first round: {failed}.', none: 'Nobody is surprised.' } }],
          choices: [
            { label: 'Fight', go: 'fight' },
            { label: 'Pay them off: −100 gold', go: 'pay' }
          ]
        },
        fight: {
          text: 'Weapons out.',
          fight: { suggest: 'Levels 7–10: the 2 toll-men (thugs) and 6 bandits. Levels 11–16: add 2 veterans.', encounter: 'f1', won: 'won', fled: 'fled' }
        },
        won: { text: 'Their whole takings are yours.', apply: [{ gold: 200 }, { threadClose: true }], end: true },
        fled: { text: 'You get away. They won\'t try again.', apply: [{ threadClose: true }], end: true },
        pay: { text: 'You pay them off.', apply: [{ gold: -100 }, { threadClose: true }], end: true }
      }
    },

    {
      id: 'f2', code: 'F2', kind: 'follow', title: 'The Prospector\'s Claim', where: { any: true },
      line: 'from T14 · Investigation if the claim was false',
      steps: {
        start: { branch: { key: 'vein', genuine: 'rider', salted: 'vanished' } },
        rider: { text: 'A rider finds you with your share of the vein.', apply: [{ gold: 400 }, { threadClose: true }], end: true },
        vanished: {
          text: 'Word reaches you that the prospector has vanished.',
          check: { skill: 'Intelligence (Investigation)', dc: 14, who: 'one', whoText: 'One hero studies the deed he gave you. Another hero can Help for advantage.', success: 'trail', failure: 'gone' }
        },
        trail: {
          text: 'The same name is on a dozen other deeds, and he\'s working the trick in the next town.',
          apply: [{ threadRename: { name: 'The Prospector\'s Trail', note: 'The prospector\'s name is on a dozen other deeds: he\'s working the trick in the next town.' } }],
          end: true
        },
        gone: { text: 'The money\'s gone.', apply: [{ threadClose: true }], end: true }
      }
    },

    {
      id: 'f3', code: 'F3', kind: 'follow', title: 'The Captain\'s Thanks', where: { any: true },
      line: 'from C12 · Insight',
      steps: {
        start: {
          text: 'A ship\'s boy runs up the road after you, out of breath. His captain wants to thank the people who saved her ship.',
          apply: [{ gold: 250 }],
          check: { skill: 'Wisdom (Insight)', dc: 14, who: 'one', success: 'cargo', failure: 'thanks' }
        },
        cargo: {
          text: 'She\'s frightened as well as grateful. Her cargo, not her ship, was the wreckers\' real target.',
          apply: [{ threadRename: { name: 'The Captain\'s Cargo', note: 'The wreckers were after the captain\'s cargo, not her ship. DM: decide what she carries.' } }],
          end: true
        },
        thanks: { text: 'She thanks you warmly, and that\'s the end of it.', apply: [{ threadClose: true }], end: true }
      }
    }
  ]
};
