/* Pelagosi Puzzle Trials: tools/pelagosi/data/pelagosi-data.js and rules.js */
(function () {
  var D = window.TSI_DATA.pelagosi;
  var R = TSI.pelagosi.rules;

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  /* A layout from runes and directions, e.g. layout('flow right', 'echo down', ...) in clockwise order. */
  function layout(tl, tr, br, bl) {
    var out = {};
    [['topLeft', tl], ['topRight', tr], ['bottomRight', br], ['bottomLeft', bl]].forEach(function (pair) {
      var parts = pair[1].split(' ');
      out[pair[0]] = { runeIndex: D.tidal.runes.indexOf(parts[0]), directionIndex: D.tidal.directions.indexOf(parts[1]) };
    });
    return out;
  }
  var SOLVED = layout('flow right', 'echo down', 'depth left', 'stone up');

  group('Pelagosi: content');

  test('the Memory rounds are 3, 4 and 5 runes at the old speeds', function (t) {
    t.same(D.memory.rounds, [{ length: 3, flash: 950, gap: 260 }, { length: 4, flash: 700, gap: 220 }, { length: 5, flash: 520, gap: 180 }]);
    t.same(D.memory.runes, ['anchor', 'tide', 'depth', 'life', 'remains']);
  });

  test('the Tidal solution is Flow →, Echo ↓, Depth ←, Stone ↑, and the basin answer is Current', function (t) {
    t.same(D.tidal.solution, {
      topLeft: { rune: 'flow', direction: 'right' }, topRight: { rune: 'echo', direction: 'down' },
      bottomRight: { rune: 'depth', direction: 'left' }, bottomLeft: { rune: 'stone', direction: 'up' }
    });
    t.equal(D.tidal.basinSolution, 'current');
    t.equal(D.tidal.runes[D.tidal.basinStartIndex], 'anchor', 'the basin starts on Anchor');
  });

  test('the pressure levels and their saves are unchanged', function (t) {
    t.same(D.tidal.pressure.map(function (p) { return p.label; }), ['Calm', 'Stirring', 'Rising', 'Reversing', 'Surge']);
    t.ok(/DC 13 STR/.test(D.tidal.pressure[3].effect));
    t.ok(/DC 14 DEX save or take 2d6 bludgeoning/.test(D.tidal.pressure[4].effect));
    t.ok(/DC 12 Dexterity save/.test(D.memory.failure.text));
    t.equal(D.tidal.maxPressure, 4);
  });

  test('sounds: the five old WAVs are ready; every new .mp3 is off until its file is in the audio folder', function (t) {
    var fs = typeof require === 'function' ? require('fs') : null;
    ['runePlace', 'runeClick', 'puzzleFail', 'puzzleSolve', 'cavernOpen'].forEach(function (k) {
      t.equal(D.sounds[k].ready, true, k);
      t.ok(/\.wav$/.test(D.sounds[k].file), k);
    });
    ['chamberBed', 'waterStir', 'pressureRise', 'currentReverse', 'tidalSurge', 'basinWake', 'anchorRelease',
      'knock1', 'knock2', 'knock3', 'waterBackward', 'absenceVoid', 'inscriptionReveal', 'tideToll'].forEach(function (k) {
      t.ok(/\.mp3$/.test(D.sounds[k].file), k + ' is an mp3');
      if (fs) t.equal(D.sounds[k].ready, fs.existsSync(require('path').join(__dirname, '../../tools/pelagosi/assets/audio', D.sounds[k].file)), k + ' ready matches the folder');
    });
    t.equal(D.sounds.chamberBed.volume, 0.35);
    t.equal(D.sounds.chamberBed.loop, true);
    t.ok(!D.sounds.waterFlow, 'water-flow is only a source file');
    D.tidal.pressure.slice(1).forEach(function (p, i) { t.equal(p.sound, ['waterStir', 'pressureRise', 'currentReverse', 'tidalSurge'][i]); });
  });

  group('Pelagosi: The Marker Remembers');

  test('the sequence never shows the same rune twice in a row', function (t) {
    for (var i = 0; i < 300; i++) {
      var s = R.buildMasterSequence();
      t.equal(s.length, 5);
      for (var j = 1; j < s.length; j++) t.ok(s[j] !== s[j - 1], s.join());
    }
  });

  test('the sequence is built as the old tool built it', function (t) {
    /* 0 picks the first allowed rune each time: anchor, then tide (anchor excluded), then anchor… */
    t.same(R.buildMasterSequence(dice([0])), ['anchor', 'tide', 'anchor', 'tide', 'anchor']);
    t.same(R.buildMasterSequence(dice([0.99])), ['remains', 'life', 'remains', 'life', 'remains']);
  });

  test('each round shows the start of the same sequence', function (t) {
    var master = ['depth', 'life', 'anchor', 'tide', 'remains'];
    t.same(R.roundSequence(master, -1), []);
    t.same(R.roundSequence(master, 0), ['depth', 'life', 'anchor']);
    t.same(R.roundSequence(master, 1), ['depth', 'life', 'anchor', 'tide']);
    t.same(R.roundSequence(master, 2), master);
  });

  test('a reply is judged rune by rune', function (t) {
    var seq = ['depth', 'life', 'anchor'];
    t.equal(R.judgeReply(seq, ['depth']), 'more');
    t.equal(R.judgeReply(seq, ['depth', 'life']), 'more');
    t.equal(R.judgeReply(seq, ['depth', 'life', 'anchor']), 'complete');
    t.equal(R.judgeReply(seq, ['life']), 'wrong');
    t.equal(R.judgeReply(seq, ['depth', 'depth']), 'wrong', 'a double-click on the first rune fails, as before (P3: kept)');
  });

  group('Pelagosi: The Tidal Sequence');

  test('the starting disorder is Current ↑, Anchor ←, Depth ↓, Echo →', function (t) {
    t.same(R.startPillars(), layout('current up', 'anchor left', 'depth down', 'echo right'));
    t.ok(!R.isOuterSolved(R.startPillars()));
  });

  test('the solution unlocks the basin; anything else doesn\'t', function (t) {
    t.ok(R.isOuterSolved(SOLVED));
    t.ok(!R.isOuterSolved(layout('flow right', 'echo down', 'depth left', 'stone right')));
    t.ok(!R.isOuterSolved(layout('echo right', 'flow down', 'depth left', 'stone up')));
  });

  test('counting what\'s right: whole pillars and single settings', function (t) {
    var start = R.startPillars();
    /* start: Current ↑ (both wrong), Anchor ← (both wrong), Depth ↓ (rune right), Echo → (both wrong) */
    t.equal(R.correctCount(start), 1);
    t.equal(R.completePillarCount(start), 0);
    t.equal(R.correctCount(SOLVED), 8);
    t.equal(R.completePillarCount(SOLVED), 4);
    var half = layout('flow right', 'echo down', 'depth down', 'echo right');
    t.equal(R.completePillarCount(half), 2);
    t.equal(R.correctCount(half), 5);
  });

  test('pressure rises one step per wrong check, up to Surge', function (t) {
    t.equal(R.nextPressure(0), 1);
    t.equal(R.nextPressure(3), 4);
    t.equal(R.nextPressure(4), 4);
  });

  test('the hints grow with the pressure, as before', function (t) {
    var start = R.startPillars();
    t.equal(R.feedbackMode(1), 'none');
    t.equal(R.feedbackMode(2), 'complete');
    t.equal(R.feedbackMode(3), 'partial');
    t.equal(R.feedbackMode(4), 'partial');
    t.equal(R.outerClue(start, 1), 'The current fails to close.');
    t.equal(R.outerClue(start, 2), '0 of 4 pillars are fully aligned.');
    t.equal(R.outerClue(start, 3), '1 of 8 rune-or-direction alignments are correct.');
  });

  test('turning a rune or arrow goes round in order', function (t) {
    t.equal(R.turn(0, 9), 1);
    t.equal(R.turn(8, 9), 0);
    t.equal(R.turn(3, 4), 0);
  });

  test('Shuffle Pillars never lands on the solution', function (t) {
    /* These dice would give the solution first, so it must roll again. */
    var solvedDice = [0 / 9, 1 / 4, 1 / 9, 2 / 4, 2 / 9, 3 / 4, 3 / 9, 0 / 4].map(function (v) { return v + 0.001; });
    var shuffled = R.shuffledPillars(dice(solvedDice.concat([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])));
    t.ok(!R.isOuterSolved(shuffled));
    for (var i = 0; i < 200; i++) t.ok(!R.isOuterSolved(R.shuffledPillars()));
  });

  test('only Current wakes the basin', function (t) {
    D.tidal.runes.forEach(function (rune, i) { t.equal(R.isBasinCorrect(i), rune === 'current', rune); });
  });

  test('labels read as in the old tool', function (t) {
    t.equal(R.label('topLeft'), 'Top Left');
    t.equal(R.label('current'), 'Current');
  });

  group('Pelagosi: The Absent Tide rules');

  var T = D.tidal;
  function state(over) {
    var s = { pillars: R.startPillars(), basinRuneIndex: 5, pressure: 0, lines: ['cut', 'cut', 'cut', 'cut', 'cut'], attempts: 0, phase: 'outer', solved: false };
    Object.keys(over || {}).forEach(function (k) { s[k] = over[k]; });
    return s;
  }

  test('nine runes: the first six keep their order, the start and solution are unchanged', function (t) {
    t.same(T.runes, ['flow', 'echo', 'depth', 'stone', 'current', 'anchor', 'life', 'remains', 'tide']);
    t.equal(T.basinStartIndex, 5);
    t.equal(T.maxPressure, 4);
    t.equal(Object.keys(T.runeMeanings).length, 9);
    T.runes.forEach(function (r) { t.ok(T.runeMeanings[r], r); });
  });

  test('cycleRune wraps both ways round nine', function (t) {
    t.equal(R.cycleRune(8, 1, 9), 0);
    t.equal(R.cycleRune(0, -1, 9), 8);
    t.equal(R.cycleRune(3, 1, 9), 4);
    t.equal(R.cycleRune(3, -12, 9), 0);
  });

  test('setLineLevel stays between cut and whole and ignores bad input', function (t) {
    var l = ['cut', 'cut', 'cut'];
    t.same(R.setLineLevel(l, 1, 'whole'), ['cut', 'whole', 'cut']);
    t.same(l, ['cut', 'cut', 'cut'], 'the original is not changed');
    t.same(R.setLineLevel(l, 1, 'fragment'), ['cut', 'fragment', 'cut']);
    t.same(R.setLineLevel(l, 1, 'burning'), l);
    t.same(R.setLineLevel(l, 7, 'whole'), l);
    t.same(R.setLineLevel(l, -1, 'whole'), l);
    t.same(R.setLineLevel(l, 1.5, 'whole'), l);
    t.equal(R.setLineLevel(null, 0, 'whole'), null);
  });

  test('raiseLine lifts the lowest line that is not whole, one level', function (t) {
    t.same(R.raiseLine(['cut', 'cut']), ['fragment', 'cut']);
    t.same(R.raiseLine(['fragment', 'cut']), ['whole', 'cut']);
    t.same(R.raiseLine(['whole', 'cut', 'cut']), ['whole', 'fragment', 'cut']);
    var done = ['whole', 'whole'];
    t.equal(R.raiseLine(done), done, 'the same array when all are whole');
  });

  test('wallLineText: cut is one block per letter, fragment as authored, whole in full', function (t) {
    var B = '▒';
    var line = T.wall.lines[0];
    t.equal(R.wallLineText(line, 'whole'), 'Flow follows memory.');
    t.equal(R.wallLineText(line, 'fragment'), line.fragment);
    t.equal(R.wallLineText(line, 'cut'), B + B + B + B + ' ' + B + B + B + B + B + B + B + ' ' + B + B + B + B + B + B + '.');
    T.wall.lines.forEach(function (ln) {
      var cut = R.wallLineText(ln, 'cut');
      t.equal(cut.length, ln.whole.length, 'same length as the whole line: ' + ln.id);
      t.ok(!/[A-Za-z]/.test(cut), 'no letters leak: ' + ln.id);
    });
    t.equal(R.wallLineText(T.wall.lines[4], 'cut').split('.').length, 3, 'punctuation kept');
  });

  test('five readings map to the five wall lines', function (t) {
    t.same(T.readings.map(function (r) { return r.line; }), [1, 2, 3, 4, 5]);
    t.equal(T.wall.lines.length, 5);
    t.same(T.readings.slice(0, 4).map(function (r) { return r.pillar; }), T.pillarOrder);
  });

  test('canAskChamber: yes at 0 to 2, no at 3 and 4', function (t) {
    [0, 1, 2].forEach(function (p) { t.ok(R.canAskChamber(p, T), 'p' + p); });
    [3, 4].forEach(function (p) { t.ok(!R.canAskChamber(p, T), 'p' + p); });
  });

  test('askChamber raises pressure one step and reveals a line, then falls back to the clue', function (t) {
    var r = R.askChamber(state({ pressure: 1 }), T);
    t.equal(r.pressure, 2);
    t.same(r.lines, ['fragment', 'cut', 'cut', 'cut', 'cut']);
    t.same(r.revealed, { kind: 'line', index: 0 });
    var all = state({ pressure: 1, lines: ['whole', 'whole', 'whole', 'whole', 'whole'] });
    var c = R.askChamber(all, T);
    t.equal(c.pressure, 2);
    t.equal(c.revealed.kind, 'clue');
    t.equal(c.revealed.text, R.outerClue(all.pillars, 2));
    var no = R.askChamber(state({ pressure: 3 }), T);
    t.equal(no.pressure, 3);
    t.equal(no.revealed, null);
    t.equal(R.askChamber(state({ pressure: 2 }), T).pressure, 3, 'from 2 it reaches Reversing, never a surge');
  });

  test('tideReturns: off by default, rises after the interval, never above the cap', function (t) {
    t.ok(!R.tideReturns(999999, T, 0), 'off by default');
    var on = Object.create(T);
    on.timerOn = true;
    t.ok(!R.tideReturns(89999, on, 0));
    t.ok(R.tideReturns(90000, on, 0));
    t.ok(R.tideReturns(90000, on, 2));
    t.ok(!R.tideReturns(999999, on, 3), 'cap 3');
    t.ok(!R.tideReturns(999999, on, 4));
    t.equal(T.timer.cap, 3);
    t.equal(T.timer.seconds, 90);
    t.equal(T.timer.enabledByDefault, false);
  });

  test('basinOutcome: Current confirms, Anchor holds, anything else is wrong', function (t) {
    t.equal(R.basinOutcome('current', T), 'confirm');
    t.equal(R.basinOutcome('anchor', T), 'hold');
    ['flow', 'echo', 'depth', 'stone', 'life', 'remains', 'tide'].forEach(function (r) { t.equal(R.basinOutcome(r, T), 'wrong', r); });
  });

  test('misreadOutcome never causes a surge', function (t) {
    [0, 1, 2].forEach(function (p) { t.equal(R.misreadOutcome(p, T).raise, true, 'p' + p); });
    [3, 4].forEach(function (p) { t.equal(R.misreadOutcome(p, T).raise, false, 'p' + p); });
    t.equal(R.misreadOutcome(3, T).text, 'The chamber hears the wrong word.');
    var off = Object.create(T);
    off.misreadCostsPressure = false;
    t.equal(R.misreadOutcome(0, off).raise, false);
  });

  test('finaleCues: sorted, exactly three knocks with uneven gaps, ends on end', function (t) {
    var cues = R.finaleCues(T);
    t.ok(cues.every(function (c, i) { return i === 0 || cues[i - 1].at <= c.at; }));
    var knocks = cues.filter(function (c) { return c.type === 'knock'; });
    t.equal(knocks.length, 3);
    t.same(knocks.map(function (k) { return k.sound; }), ['knock1', 'knock2', 'knock3']);
    t.ok(knocks[1].at - knocks[0].at !== knocks[2].at - knocks[1].at, 'uneven gaps');
    t.equal(cues[cues.length - 1].type, 'end');
    var shuffled = { finale: { cues: [{ at: 5, type: 'end' }, { at: 1, type: 'duck' }] } };
    t.same(R.finaleCues(shuffled).map(function (c) { return c.type; }), ['duck', 'end']);
  });

  test('finaleEndOptions: solve offers Replay and Reset; anyway adds Return to the puzzle', function (t) {
    t.same(R.finaleEndOptions('solve'), ['replay', 'reset']);
    t.same(R.finaleEndOptions('anyway'), ['replay', 'return', 'reset']);
    t.equal(T.finale.noAutoFocus, true);
    R.finaleEndOptions('solve').push('x');
    t.same(R.finaleEndOptions('solve'), ['replay', 'reset'], 'a copy each time');
  });

  test('snapshotPuzzle / restorePuzzle round trip, with deep copies', function (t) {
    var live = state({ pressure: 2, attempts: 3, phase: 'basin', solved: false, basinRuneIndex: 4, lines: ['whole', 'fragment', 'cut', 'cut', 'cut'] });
    live.pillars.topLeft = { runeIndex: 7, directionIndex: 2 };
    var snap = R.snapshotPuzzle(live);
    live.pillars.topLeft.runeIndex = 0;
    live.lines[0] = 'cut';
    live.pressure = 4;
    live.phase = 'solved';
    live.solved = true;
    t.equal(snap.pillars.topLeft.runeIndex, 7, 'later changes do not alter the snapshot');
    t.equal(snap.lines[0], 'whole');
    t.equal(snap.pressure, 2);
    var back = R.restorePuzzle(snap);
    t.same(back, snap);
    t.ok(back !== snap && back.pillars !== snap.pillars && back.lines !== snap.lines && back.pillars.topLeft !== snap.pillars.topLeft, 'never the same object');
    back.pillars.topLeft.runeIndex = 1;
    back.lines[1] = 'cut';
    t.equal(snap.pillars.topLeft.runeIndex, 7, 'changing the restored copy leaves the snapshot alone');
    t.equal(snap.lines[1], 'fragment');
    t.same(Object.keys(snap).sort(), ['attempts', 'basinRuneIndex', 'lines', 'phase', 'pillars', 'pressure', 'solved']);
    t.equal(back.attempts, 3);
    t.equal(back.phase, 'basin');
    t.equal(back.solved, false);
  });

  test('the rewritten texts no longer reveal the inscription or the old ending', function (t) {
    t.equal(T.text.startClue, 'The wall is scarred. Something has been cut away here.');
    t.equal(T.text.basinClue, 'Something is set in the basin that does not belong to the Current.');
    t.ok(!/Flow follows|Memory seeks|Depth breaks/.test(T.text.startClue + T.text.basinClue));
    t.equal(T.text.solvedClue, 'The basin has taken the Current.');
    t.equal(T.text.solvedDescription, 'The chamber is waiting.');
    t.equal(T.success.title, 'The Anchor Lifts');
    t.ok(!/Middlemount|northern arch/.test(JSON.stringify(T.text) + JSON.stringify(T.success)));
  });

  test('stage mode and data guardrails', function (t) {
    t.same(T.stageMode, { hides: ['readings', 'console', 'extras'], keeps: ['wall', 'stage', 'pillars', 'basin', 'pips', 'pressureMeter'], enterKeyChecks: true, key: 'S' });
    t.equal(T.finale.reducedMotionShake, false);
    t.equal(T.hint.maxPressureToAsk, 2);
    var text = JSON.stringify(T.wall) + JSON.stringify(T.basin) + JSON.stringify(T.finale) + JSON.stringify(T.readings);
    t.ok(!/[\uD800-\uDBFF]/.test(text), 'no emoji in the new data');
    t.ok(!/knocks? (are|is|come from|were)|who (made|cut)/i.test(text), 'nothing says what the knocks are');
  });

  group('Pelagosi: the players\' window (playerSnapshot)');

  function freshState() {
    return {
      lines: D.tidal.wall.lines.map(function () { return 'cut'; }),
      started: true, solved: false, locked: false, phase: 'outer', attempts: 0, pressure: 0,
      feedbackActive: false, feedbackMode: 'none', basinRuneIndex: D.tidal.basinStartIndex,
      pillars: R.startPillars()
    };
  }

  test('a fresh puzzle sends nothing of the answer, the wall or the hints', function (t) {
    var json = JSON.stringify(R.playerSnapshot(freshState(), D.tidal, { chalkOn: true, veil: 'off' }));
    ['Flow follows memory', 'Memory seeks depth', 'Depth breaks upon stone', 'Stone returns the current', 'Anchor holds the water', 'Held water cannot speak',
     'solution', 'basinSolution', 'Remove the Anchor', 'readings', 'hint', 'effect', 'DC 1', 'Maerys', 'Fragment', 'Echo Memory'].forEach(function (word) {
      t.ok(json.toLowerCase().indexOf(word.toLowerCase()) < 0, 'the snapshot must not contain "' + word + '"');
    });
    t.ok(json.indexOf(JSON.stringify(D.tidal.solution)) < 0);
    D.tidal.wall.lines.forEach(function (line) { t.ok(json.indexOf(line.whole) < 0, line.whole); });
  });

  test('the wall is sent at the level shown: blocks for cut, the fragment text for fragment, the whole line only when read', function (t) {
    var s = freshState();
    s.lines = ['whole', 'fragment', 'cut', 'cut', 'cut'];
    var snap = R.playerSnapshot(s, D.tidal, {});
    t.equal(snap.wall[0].text, 'Flow follows memory.');
    t.equal(snap.wall[1].text, D.tidal.wall.lines[1].fragment);
    t.ok(/^[\u2592 .,]+$/.test(snap.wall[2].text), 'a cut line is only blocks');
    t.ok(JSON.stringify(snap).indexOf('Depth breaks upon stone') < 0);
    t.ok(JSON.stringify(snap).indexOf('Memory seeks depth') < 0);
  });

  test('the board is sent as drawn: each pillar\'s rune and arrow, the pressure word, the chalk spots', function (t) {
    var s = freshState();
    s.pressure = 2;
    var snap = R.playerSnapshot(s, D.tidal, { chalkOn: false, veil: 'dim' });
    t.same(snap.view.pressure, { level: 2, label: D.tidal.pressure[2].label });
    t.same(Object.keys(snap.view.pillars), D.tidal.pillarOrder);
    t.equal(snap.view.pillars.topLeft.rune, D.tidal.runes[s.pillars.topLeft.runeIndex]);
    t.equal(snap.chalkOn, false);
    t.equal(snap.veil, 'dim');
    t.equal(snap.layout.chalk.length, 2);
    t.ok(snap.view.flags.indexOf('tidal-pressure-2') >= 0 && snap.view.flags.indexOf('tidal-started') >= 0);
  });

  test('right and wrong marks on the pillars only show after a check', function (t) {
    var s = freshState();
    s.pillars = SOLVED;
    var quiet = R.playerSnapshot(s, D.tidal, {});
    t.ok(D.tidal.pillarOrder.every(function (id) { return !quiet.view.pillars[id].runeOk && !quiet.view.pillars[id].complete; }), 'no marks before a check');
    s.feedbackActive = true; s.feedbackMode = 'partial';
    var checked = R.playerSnapshot(s, D.tidal, {});
    t.ok(D.tidal.pillarOrder.every(function (id) { return checked.view.pillars[id].complete; }));
  });

  test('the basin shows nothing until the outer ring is right', function (t) {
    var s = freshState();
    t.equal(R.playerSnapshot(s, D.tidal, {}).view.basin.visible, false);
    s.phase = 'basin';
    t.equal(R.playerSnapshot(s, D.tidal, {}).view.basin.visible, true);
    t.equal(R.playerSnapshot(s, D.tidal, {}).view.basin.ok, false, 'no green before a check');
  });

  test('the hidden chamber cutaway is in the players\' snapshot only while the DM shows it, with just its picture and clip', function (t) {
    var fresh = JSON.stringify(R.playerSnapshot(freshState(), D.tidal, { chalkOn: true, veil: 'off' }));
    t.ok(fresh.toLowerCase().indexOf('hidden-chamber') < 0, 'nothing of it before it is shown');
    t.equal(R.playerSnapshot(freshState(), D.tidal, {}).cutaway, null);
    var on = R.playerSnapshot(freshState(), D.tidal, { cutaway: { image: 'a/hidden-chamber.png', video: 'a/hidden-chamber.mp4', secret: 'ZZSECRET' } });
    t.same(on.cutaway, { image: 'a/hidden-chamber.png', video: 'a/hidden-chamber.mp4' });
    t.ok(JSON.stringify(on).indexOf('ZZSECRET') < 0);
    t.equal(R.playerSnapshot(freshState(), D.tidal, { cutaway: { image: '' } }).cutaway, null);
  });
}());
