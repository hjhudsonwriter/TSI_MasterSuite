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

  test('the five sounds still to come are switched off until Harry supplies them (P2)', function (t) {
    ['waterStir', 'pressureRise', 'currentReverse', 'tidalSurge', 'basinWake'].forEach(function (k) {
      t.equal(D.sounds[k].ready, false, k);
    });
    ['runePlace', 'runeClick', 'puzzleFail', 'puzzleSolve', 'cavernOpen'].forEach(function (k) {
      t.equal(D.sounds[k].ready, true, k);
    });
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
    t.equal(R.turn(0, 6), 1);
    t.equal(R.turn(5, 6), 0);
    t.equal(R.turn(3, 4), 0);
  });

  test('Shuffle Pillars never lands on the solution', function (t) {
    /* These dice would give the solution first, so it must roll again. */
    var solvedDice = [0 / 6, 1 / 4, 1 / 6, 2 / 4, 2 / 6, 3 / 4, 3 / 6, 0 / 4].map(function (v) { return v + 0.001; });
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
}());
