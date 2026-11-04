/* The table log (shared/js/tablelog-rules.js): what the players were shown, kept for the recap. */
(function () {
  var L = TSI.tablelogRules;
  var S = TSI.storeRules;

  group('Table log');

  test('an entry is cleaned and a bad one is dropped', function (t) {
    t.same(L.cleanEntry({ kind: 'card', day: 3.7, at: 5, ref: 'act1/letter', label: 'Letter', image: 'a.png', secret: 'DM NOTE' }), { day: 3, at: 5, kind: 'card', ref: 'act1/letter', label: 'Letter', image: 'a.png' });
    t.equal(L.cleanEntry({ kind: 'nope' }), null);
    t.equal(L.cleanEntry(null), null);
    t.ok(Object.keys(L.cleanEntry({ kind: 'note' })).sort().join() === 'at,day,image,kind,label,ref', 'only the six fields are ever kept (no DM notes)');
  });

  test('add keeps order, drops a repeat within a moment, and keeps camps', function (t) {
    var l = L.add([], { kind: 'card', ref: 'x', label: 'X', at: 1000 });
    l = L.add(l, { kind: 'card', ref: 'x', label: 'X', at: 1500 });
    t.equal(l.length, 1, 'the same card twice at once is one entry');
    l = L.add(l, { kind: 'card', ref: 'y', label: 'Y', at: 9000 });
    l = L.add(l, { kind: 'camp', day: 4, at: 9100 });
    l = L.add(l, { kind: 'camp', day: 5, at: 9200 });
    t.same(l.map(function (e) { return e.kind + (e.ref ? ':' + e.ref : ''); }), ['card:x', 'card:y', 'camp', 'camp']);
  });

  test('it keeps only the last 500', function (t) {
    var l = [];
    for (var i = 0; i < 520; i++) l = L.add(l, { kind: 'note', ref: 'n' + i, at: i * 10000 });
    t.equal(l.length, 500);
    t.equal(l[0].ref, 'n20');
    t.equal(l[499].ref, 'n519');
  });

  test('since the last session starts after the newest End session marker', function (t) {
    var l = [];
    l = L.add(l, { kind: 'card', ref: 'a', at: 1 });
    l = L.add(l, { kind: 'session-end', at: 2 });
    l = L.add(l, { kind: 'card', ref: 'b', at: 100000 });
    l = L.add(l, { kind: 'cast', ref: 'c', at: 200000 });
    t.same(L.sinceLastSession(l).map(function (e) { return e.ref; }), ['b', 'c']);
    t.same(L.sinceLastSession(L.add(l, { kind: 'session-end', at: 300000 })), []);
    t.same(L.sinceLastSession([]), []);
  });

  test('it is saved under tsi.tablelog, so Back up everything and Restore hold it', function (t) {
    var key = 'tsi.tablelog.' + L.KEY_NAME;
    t.equal(S.toolOf(key), 'tablelog');
    t.ok(S.RESERVED_TOOLS.indexOf('tablelog') !== -1);
    t.ok(S.SUITE_FAMILIES.tablelog);
    t.same(L.clean(L.pack([{ kind: 'card', at: 1 }, { kind: 'bad' }])), [{ day: null, at: 1, kind: 'card', ref: '', label: '', image: '' }]);
  });

  test('the cue hand-off has its own name, apart from the test page\'s', function (t) {
    var real = S.spaceNames('suite'), fake = S.spaceNames('test');
    t.equal(real.handoffCue, 'tsi.suite.handoff-cue');
    t.ok(real.handoffCue !== fake.handoffCue);
  });
}());
