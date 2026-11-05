/* Cue tags in the session text (shared/js/cue-rules.js), and the data they point at. */
(function () {
  var C = TSI.cueRules, CR = TSI.cueRules;
  var DATA = {
    decks: window.TSI_DATA.decks,
    cast: window.TSI_DATA.cast,
    fights: Object.keys(window.TSI_DATA.fights.encounters),
    puzzles: ['tidal', 'marker'],
    sounds: Object.keys(window.TSI_DATA.explorerSfx.sounds)
  };
  function one(tag) { return C.resolveCue(C.parseCues(tag)[0], DATA); }

  group('Cue tags: reading the text');

  test('every kind of tag is found, in order, with where it sits (the text is never changed)', function (t) {
    var text = 'Scene 1.1 {card: act1/outside} then {Cast:dren-marr} and { hide } {camp}';
    var c = C.parseCues(text);
    t.same(c.map(function (x) { return x.kind; }), ['card', 'cast', 'hide', 'camp']);
    t.same(c.map(function (x) { return x.arg; }), ['act1/outside', 'dren-marr', '', '']);
    t.equal(text.slice(c[0].start, c[0].end), '{card: act1/outside}');
    t.equal(c[2].raw, '{ hide }');
  });

  test('spaces after the colon and capitals do not matter', function (t) {
    t.same(C.parseCues('{CARD :  Act1/Letter }').map(function (x) { return [x.kind, x.arg, x.problem]; }), [['card', 'Act1/Letter', '']]);
  });

  test('text without tags, and plain prose in brackets, gives a problem, never a throw', function (t) {
    t.same(C.parseCues('nothing here'), []);
    t.equal(C.parseCues('{wibble: x}')[0].problem.indexOf('unknown tag'), 0);
    t.ok(C.parseCues('{card}')[0].problem.indexOf('needs something') !== -1);
    t.same(C.parseCues(null), []);
  });

  group('Cue tags: checking them against the data');

  test('a card works with or without absent_tide_ and in any capitals', function (t) {
    var a = one('{card: act1/letter}'), b = one('{card: ABSENT_TIDE_act1/Letter}');
    t.ok(a.ok && b.ok, JSON.stringify([a, b]));
    t.equal(a.deck, 'absent_tide_act1');
    t.equal(a.step, 'letter');
  });

  test('a misspelt card says what is wrong and offers the right one', function (t) {
    var r = one('{card: act1/leter}');
    t.equal(r.ok, false);
    t.equal(r.problem, 'no card act1/leter: did you mean act1/letter?');
    t.equal(r.suggestion, 'act1/letter');
    t.ok(/did you mean act4/.test(one('{card: act44/writ}').problem) || /no deck act44/.test(one('{card: act44/writ}').problem));
    t.equal(one('{card: act1}').ok, false);
  });

  test('cast, deck, fight, puzzle and sound are checked too', function (t) {
    t.equal(one('{cast: dren-marr}').ok, true);
    t.equal(one('{cast: maerys-vell}').label, 'Maerys Vell');
    t.ok(/did you mean dren-marr/.test(one('{cast: dren-mar}').problem));
    t.equal(one('{deck: act2}').deck, 'absent_tide_act2');
    t.equal(one('{fight: t2}').ok, true);
    t.equal(one('{fight: zzzzzz}').ok, false);
    t.equal(one('{puzzle: tidal}').ok, true);
    t.equal(one('{puzzle: marker}').ok, true);
    t.ok(/did you mean tidal/.test(one('{puzzle: tidel}').problem));
    t.equal(one('{sound: rain}').ok, true);
    t.equal(one('{sound: nope}').ok, false);
  });

  test('hide, camp and recap need nothing (the recap plays the latest, or the one named)', function (t) {
    t.equal(one('{hide}').ok, true);
    t.equal(one('{camp}').ok, true);
    var recap = one('{recap}');
    t.ok(recap.ok && !recap.soon && recap.label === 'Recap' && recap.arg === '');
    t.equal(one('{recap: recap-2026-11-05-213015}').arg, 'recap-2026-11-05-213015');
  });

  test('{clue: id} awards a prepared clue; {clue: other words} pins those words', function (t) {
    var data = Object.assign({}, DATA, CR.catalogue(window.TSI_DATA, window.TSI_DATA.evidenceSeed.prepared));
    var a = CR.resolveCue(CR.parseCues('{clue: warm-tea}')[0], data), b = CR.resolveCue(CR.parseCues('{clue: a wet letter}')[0], data);
    t.ok(a.ok && a.isId && a.label === 'Clue: The warm tea', JSON.stringify(a));
    t.ok(b.ok && !b.isId && b.label === 'Pin: a wet letter');
    t.equal(CR.resolveCue(CR.parseCues('{clue}')[0], data).ok, false);
  });

  test('every card in the shipped decks, and every cast member, resolves', function (t) {
    DATA.decks.forEach(function (d) {
      d.steps.forEach(function (s) {
        var r = one('{card: ' + C.shortDeckId(d.id) + '/' + s.id + '}');
        t.ok(r.ok, d.id + '/' + s.id);
      });
    });
    DATA.cast.forEach(function (c) { t.ok(one('{cast: ' + c.id + '}').ok, c.id); });
  });

  group('Cue tags: the find box');

  test('a scene number matches the start of a line before a mention in the middle of one', function (t) {
    var text = 'See 4.4 later.\nScene 1.1 intro\n4.4 The liaison office\n4.45 other';
    var m = C.findMatches(text, '4.4');
    t.equal(m[0], text.indexOf('4.4 The'), 'the heading comes first');
    t.ok(m.indexOf(text.indexOf('See 4.4') + 4) !== -1, 'the mention is still found');
    t.equal(m.indexOf(text.indexOf('4.45')) > 0, true, '4.45 is found after, as a plain match');
    t.same(C.findMatches(text, ''), []);
    t.same(C.findMatches(text, 'LIAISON'), [text.indexOf('liaison') > -1 ? text.toLowerCase().indexOf('liaison') : -1]);
  });
}());
