/* Pelagosi Puzzle Trials — rules (plain functions, tested in tests/rules.html).
   The Memory sequence and the Tidal checks, worked out exactly as the old
   tool did (pelagosi_marker_rune_puzzle/app.js). Random choices take an
   optional random-number function so tests can give them fixed "dice". */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var pel = TSI.pelagosi = TSI.pelagosi || {};

  function data() { return window.TSI_DATA.pelagosi; }
  var LEVELS = ['cut', 'fragment', 'whole'];

  var rules = {
    /* ---------- The Marker Remembers ---------- */

    /* Five runes, never the same one twice in a row. Each round shows the first 3, 4 or 5. */
    buildMasterSequence: function (rng, maxLength) {
      var runes = data().memory.runes;
      var rounds = data().memory.rounds;
      var length = maxLength || rounds[rounds.length - 1].length;
      var sequence = [];
      while (sequence.length < length) {
        var previous = sequence[sequence.length - 1] || null;
        var pool = runes.filter(function (r) { return r !== previous; });
        sequence.push(pool[Math.floor((rng || Math.random)() * pool.length)]);
      }
      return sequence;
    },

    roundSequence: function (master, roundIndex) {
      if (roundIndex < 0) return [];
      return master.slice(0, data().memory.rounds[roundIndex].length);
    },

    /* The reply so far against the round's sequence: 'wrong', 'more' (right so far) or 'complete'. */
    judgeReply: function (sequence, reply) {
      var i = reply.length - 1;
      if (i < 0) return 'more';
      if (reply[i] !== sequence[i]) return 'wrong';
      return reply.length === sequence.length ? 'complete' : 'more';
    },

    /* ---------- The Tidal Sequence ---------- */

    startPillars: function () {
      return JSON.parse(JSON.stringify(data().tidal.start));
    },

    runeOf: function (pillar) { return data().tidal.runes[pillar.runeIndex]; },
    directionOf: function (pillar) { return data().tidal.directions[pillar.directionIndex]; },

    /* For one pillar: is its rune right, its direction right, both? */
    pillarCheck: function (id, pillar) {
      var want = data().tidal.solution[id];
      var rune = rules.runeOf(pillar) === want.rune;
      var direction = rules.directionOf(pillar) === want.direction;
      return { rune: rune, direction: direction, complete: rune && direction };
    },

    isOuterSolved: function (pillars) {
      return data().tidal.pillarOrder.every(function (id) { return rules.pillarCheck(id, pillars[id]).complete; });
    },

    /* How many of the 8 rune-or-direction settings are right. */
    correctCount: function (pillars) {
      return data().tidal.pillarOrder.reduce(function (total, id) {
        var c = rules.pillarCheck(id, pillars[id]);
        return total + (c.rune ? 1 : 0) + (c.direction ? 1 : 0);
      }, 0);
    },

    /* How many of the 4 pillars are fully right. */
    completePillarCount: function (pillars) {
      return data().tidal.pillarOrder.reduce(function (total, id) {
        return total + (rules.pillarCheck(id, pillars[id]).complete ? 1 : 0);
      }, 0);
    },

    isBasinCorrect: function (basinIndex) {
      return data().tidal.runes[basinIndex] === data().tidal.basinSolution;
    },

    nextPressure: function (pressure) {
      return Math.min(data().tidal.maxPressure, pressure + 1);
    },

    /* How much a wrong outer check reveals, by the pressure it will reach:
       Stirring shows nothing, Rising shows whole pillars, Reversing and Surge show each setting. */
    feedbackMode: function (nextPressure) {
      return nextPressure <= 1 ? 'none' : nextPressure === 2 ? 'complete' : 'partial';
    },

    /* The hint added to a wrong outer check's message. */
    outerClue: function (pillars, nextPressure) {
      if (nextPressure === 2) return rules.completePillarCount(pillars) + ' of 4 pillars are fully aligned.';
      if (nextPressure >= 3) return rules.correctCount(pillars) + ' of 8 rune-or-direction alignments are correct.';
      return 'The current fails to close.';
    },

    turn: function (index, length) { return (index + 1) % length; },

    /* Shuffle Pillars: any layout except the solution. */
    shuffledPillars: function (rng) {
      var t = data().tidal;
      var pillars;
      do {
        pillars = {};
        t.pillarOrder.forEach(function (id) {
          pillars[id] = {
            runeIndex: Math.floor((rng || Math.random)() * t.runes.length),
            directionIndex: Math.floor((rng || Math.random)() * t.directions.length)
          };
        });
      } while (rules.isOuterSolved(pillars));
      return pillars;
    },

    /* ---------- The Tidal Sequence, v2 (The Absent Tide) ---------- */

    /* Step a rune index round a ring of `count`, either way. */
    cycleRune: function (index, step, count) {
      return (((index + step) % count) + count) % count;
    },

    /* Wall line levels run cut < fragment < whole. */
    setLineLevel: function (levels, i, level) {
      var order = LEVELS;
      if (!Array.isArray(levels)) return levels;
      if (order.indexOf(level) < 0 || !(i >= 0 && i < levels.length) || Math.floor(i) !== i) return levels.slice();
      var out = levels.slice();
      out[i] = level;
      return out;
    },

    /* Raise the lowest line that is not yet whole by one level. Returns the same array when all are whole. */
    raiseLine: function (levels) {
      for (var i = 0; i < levels.length; i++) {
        var at = LEVELS.indexOf(levels[i]);
        if (at < 2) {
          var out = levels.slice();
          out[i] = LEVELS[at < 0 ? 1 : at + 1];
          return out;
        }
      }
      return levels;
    },

    /* The text to show for a wall line: cut = one block per letter (spaces and punctuation kept),
       fragment = the authored fragment, whole = the whole line. */
    wallLineText: function (line, level) {
      if (level === 'whole') return line.whole;
      if (level === 'fragment') return line.fragment;
      return line.whole.replace(/[A-Za-z0-9À-ɏ]/g, '▒');
    },

    canAskChamber: function (pressure, cfg) {
      return pressure <= cfg.hint.maxPressureToAsk;
    },

    /* Ask the Chamber: pressure up one step, one thing revealed. `state` is { pressure, lines, pillars };
       returns a new state plus what was revealed ('line' with its index, or 'clue' with the outer clue).
       If it can't be asked, the state is returned unchanged with revealed null. */
    askChamber: function (state, cfg) {
      if (!rules.canAskChamber(state.pressure, cfg)) return { pressure: state.pressure, lines: state.lines, revealed: null };
      var pressure = rules.nextPressure(state.pressure);
      var lines = rules.raiseLine(state.lines);
      if (lines !== state.lines) {
        var index = 0;
        while (lines[index] === state.lines[index]) index++;
        return { pressure: pressure, lines: lines, revealed: { kind: 'line', index: index } };
      }
      return { pressure: pressure, lines: lines, revealed: { kind: 'clue', text: rules.outerClue(state.pillars, pressure) } };
    },

    /* The optional timer: true when the tide should rise a step. Never above cfg.timer.cap. */
    tideReturns: function (elapsedMs, cfg, pressure) {
      var t = cfg.timer;
      var on = cfg.timerOn === undefined ? t && t.enabledByDefault : cfg.timerOn;
      if (!t || !on) return false;
      return pressure < t.cap && elapsedMs >= t.seconds * 1000;
    },

    /* What attuning the basin does: 'confirm' (Current), 'hold' (Anchor) or 'wrong'. */
    basinOutcome: function (runeId, cfg) {
      if (runeId === cfg.basinSolution) return 'confirm';
      if (runeId === 'anchor') return 'hold';
      return 'wrong';
    },

    /* A Misread never causes a surge: pressure rises only while below the limit (Reversing is 3, so below 3). */
    misreadOutcome: function (pressure, cfg) {
      var raise = !!cfg.misreadCostsPressure && pressure < cfg.misreadMaxPressure;
      return { raise: raise, text: cfg.misreadText };
    },

    /* The finale's cues, earliest first. */
    finaleCues: function (cfg) {
      return cfg.finale.cues.slice().sort(function (a, b) { return a.at - b.at; });
    },

    /* The ordered end buttons by how the finale began: 'solve' or 'anyway'. */
    finaleEndOptions: function (source) {
      var list = data().tidal.finale.endButtons[source === 'anyway' ? 'anyway' : 'solve'];
      return list.slice();
    },

    /* Capture / restore the puzzle for 'Play the Absence anyway' then 'Return to the puzzle'.
       Only these fields; both directions copy, so nothing is shared with the live state. */
    snapshotPuzzle: function (state) {
      var pillars = {};
      Object.keys(state.pillars).forEach(function (id) {
        pillars[id] = { runeIndex: state.pillars[id].runeIndex, directionIndex: state.pillars[id].directionIndex };
      });
      return {
        pillars: pillars,
        basinRuneIndex: state.basinRuneIndex,
        pressure: state.pressure,
        lines: state.lines.slice(),
        attempts: state.attempts,
        phase: state.phase,
        solved: !!state.solved
      };
    },

    restorePuzzle: function (snapshot) {
      return rules.snapshotPuzzle(snapshot);
    },

    /* 'topLeft' → 'Top Left', 'current' → 'Current' (the old tool's labels). */
    label: function (id) {
      return id.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); }).trim();
    }
  };

  pel.rules = rules;
}());
