/* Scarlett Isles: Beast Handler — rolling and checking a profile (BH-2a, tools/beasthandler/profile-rules.js),
   with Harry's rules of 21 October 2026. */
(function () {
  var Pf = TSI.beasthandler.profile;
  var T = window.TSI_DATA.beastProfile;

  /* A dice that gives the answers in turn (each 0 up to, not including, 1). */
  function seq() { var a = Array.prototype.slice.call(arguments), i = 0; return function () { return a[i++ % a.length]; }; }

  group('Beast Handler: rolling and checking a profile (BH-2a, 21 October 2026)');

  test('one die picks one row: d12 for the temperament and d8 for the others, from the first row to the last', function (t) {
    t.equal(Pf.rollTable(T.dominant, function () { return 0; }).label, 'Proud');
    t.equal(Pf.rollTable(T.dominant, function () { return 0.999999; }).label, 'Fiercely Loyal');
    t.equal(Pf.rollTable(T.dominant, function () { return 6 / 12 + 0.001; }).label, 'Stubborn', 'a 7');
    t.equal(Pf.rollTable(T.species.wyvern.attachment, function () { return 0; }).label, 'Low, contented rumble');
    t.equal(Pf.rollTable(T.species.dire_wolf.trigger, function () { return 0.999; }).label, 'Being trapped indoors');
    t.equal(Pf.rollTable(null, Math.random), null);
  });

  test('every face of every die gives its own row (d12 once each, each d8 once each)', function (t) {
    var seen = {};
    for (var i = 0; i < 12; i++) seen[Pf.rollTable(T.dominant, function () { return i / 12 + 0.01; }).label] = true;
    t.equal(Object.keys(seen).length, 12);
    ['wyvern', 'griffin', 'dire_wolf'].forEach(function (k) {
      ['attachment', 'trigger'].forEach(function (w) {
        var got = {};
        for (var j = 0; j < 8; j++) got[Pf.rollTable(T.species[k][w], function () { return j / 8 + 0.01; }).label] = true;
        t.equal(Object.keys(got).length, 8, k + ' ' + w);
      });
    });
  });

  test('a suggested profile is words and the dice that made them, never saved, for each kind of beast', function (t) {
    var s = Pf.suggest('wyvern', seq(0.5, 0.0, 0.99));
    t.same([s.dominant, s.attachment, s.trigger], ['Stubborn', 'Low, contented rumble', 'Rival wyvern nearby']);
    t.same(s.rolls, { dominant: 7, attachment: 1, trigger: 8 });
    t.same(Object.keys(s).sort(), ['attachment', 'dominant', 'rolls', 'trigger'], 'no bond, stat or ability in a roll');
    var g = Pf.suggest('griffin', seq(0.2, 0.2, 0.2));
    t.same([g.dominant, g.attachment, g.trigger], ['Watchful', 'Folds wings close', 'Unfamiliar horses']);
    t.equal(Pf.suggest('unicorn', Math.random), null);
    var one = Pf.suggestOne('dire_wolf', 'trigger', seq(0.0));
    t.same(one, { text: 'Restrictive chains', roll: 1 });
    /* A subspecies rolls as an even pick among that kind's own five (Harry, 21 October 2026). */
    t.same(Pf.suggestOne('dire_wolf', 'regional', seq(0.0)), { text: 'Nightfang', roll: 1, of: 5 });
    t.same(Pf.suggestOne('dire_wolf', 'regional', seq(0.999)), { text: 'Hollowhowl', roll: 5, of: 5 });
    t.same(Pf.suggestOne('griffin', 'regional', seq(0.45)), { text: 'Silvershroud', roll: 3, of: 5 }, 'a griffin rolls a griffin variety');
    t.equal(Pf.suggestOne('unicorn', 'regional', Math.random), null);
  });

  test('the listed options for a kind are its own tables (and the varieties of its own kind only)', function (t) {
    var o = Pf.options('griffin');
    t.equal(o.dominant.length, 12);
    t.equal(o.attachment.length, 8);
    t.equal(o.trigger.length, 8);
    t.same(o.regional, ['Dawnmantle', 'Thunderwing', 'Silvershroud', 'Galeclaw', 'Embermantle']);
    t.same(Pf.options('nothing'), { dominant: Pf.options('x').dominant, attachment: [], trigger: [], regional: [] });
  });

  test('saving cleans the words: spaces tidied, markup and direction tricks removed, Unicode kept', function (t) {
    t.equal(Pf.clean('  Lowers   its\thead \n'), 'Lowers its head');
    t.equal(Pf.clean('<script>alert(1)</script>Calm'), 'script alert(1) /script Calm');
    t.equal(Pf.clean('Wärm‮evil‬ Ångström 龍🐉'), 'Wärm evil Ångström 龍🐉');
    t.equal(Pf.clean(null), '');
    t.equal(Pf.clean('abcdef', 3), 'abc');
    var c = Pf.check({ dominant: '  Proud ', attachment: 'Lowers its head', trigger: 'Loud <b>metallic</b> ringing', regional: 'Widowspine' });
    t.same(c.clean, { dominant: 'Proud', attachment: 'Lowers its head', trigger: 'Loud b metallic /b ringing', regional: 'Widowspine' });
    t.equal(c.ok, true);
  });

  test('saving checks length (120 for the three lines, 60 for the variety), only what is given, and nothing else', function (t) {
    var long = new Array(122).join('x');
    var c = Pf.check({ dominant: long });
    t.equal(c.ok, false);
    t.ok(/Dominant Temperament can be at most 120 letters \(it is 121\)/.test(c.problems[0]), c.problems[0]);
    t.equal(Pf.check({ regional: new Array(62).join('y') }).ok, false);
    t.equal(Pf.check({ regional: new Array(61).join('y') }).ok, true);
    t.same(Pf.check({ trigger: '' }).clean, { trigger: '' }, 'an empty line clears it');
    t.equal(Pf.check({}).ok, false);
    t.equal(Pf.check(null).ok, false);
    t.equal(Pf.check({ dominant: 7 }).ok, false);
    ['bond', 'name', 'handler', 'species', 'chronicle', 'stats'].forEach(function (k) {
      var o = { dominant: 'Proud' }; o[k] = 1;
      var r = Pf.check(o);
      t.equal(r.ok, false, k + ' is not something a handler can change');
      t.equal(r.clean[k], undefined);
    });
  });

  test('"changed" lists only the lines that really differ', function (t) {
    t.same(Pf.changed({ dominant: 'Proud', attachment: '', trigger: '', regional: '' }, { dominant: 'Proud', attachment: 'Folds wings close' }), ['attachment']);
    t.same(Pf.changed({}, { dominant: '' }), []);
    t.same(Pf.changed({ regional: 'X' }, { regional: '' }), ['regional']);
  });
}());
