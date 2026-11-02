/* Snapshot rules: shared/js/snapshot-rules.js */
(function () {
  var S = TSI.snapshotRules;
  var ex = function (day) { return { travel: { day: day }, tokens: [] }; };
  var ba = function (day) { return { day: day, gold: 5 }; };

  group('Snapshots');

  test('what is worth keeping: something saved, and not the same as the latest', function (t) {
    var items = S.makeItems(ex(3), ba(3));
    t.equal(S.shouldKeep(null, items), true, 'the first');
    t.equal(S.shouldKeep({ items: S.makeItems(ex(3), ba(3)) }, items), false, 'the same again');
    t.equal(S.shouldKeep({ items: S.makeItems(ex(3), ba(3)) }, items, true), true, 'unless forced');
    t.equal(S.shouldKeep({ items: S.makeItems(ex(4), ba(3)) }, items), true, 'a change');
    t.equal(S.shouldKeep(null, S.makeItems(null, null)), false, 'nothing saved at all');
    t.equal(S.shouldKeep(null, S.makeItems(ex(1), undefined)), true, 'the Explorer alone is enough');
  });

  test('only the newest twelve are kept, newest first', function (t) {
    var list = [];
    for (var i = 1; i <= 15; i++) list.push({ id: 'a' + i, at: i * 1000, why: 'x', items: S.makeItems(ex(i), null) });
    var p = S.prune(list);
    t.equal(p.kept.length, 12);
    t.equal(p.kept[0].id, 'a15');
    t.equal(p.kept[11].id, 'a4');
    t.same(p.dropped.map(function (s) { return s.id; }).sort(), ['a1', 'a2', 'a3']);
    t.equal(S.prune([], 12).kept.length, 0);
  });

  test('a snapshot is described by the days it holds, and its reason is tidied', function (t) {
    t.equal(S.summary({ items: S.makeItems(ex(5), ba(4)) }), 'Explorer Day 5 · Bastion Day 4');
    t.equal(S.summary({ items: S.makeItems(ex(5), null) }), 'Explorer Day 5');
    t.equal(S.summary({ items: S.makeItems(null, null) }), '');
    t.equal(S.cleanWhy('  Make   Camp <b>(Day 5)</b> '), 'Make Camp b (Day 5) /b');
    t.equal(S.cleanWhy(new Array(200).join('x')).length, 80);
    var snap = S.makeSnapshot(S.makeItems(ex(1), null), '', 1000);
    t.equal(snap.why, 'Snapshot');
    t.equal(snap.at, 1000);
    t.ok(/^1000-/.test(snap.id));
  });

  test('going back swaps only the Explorer\'s journey and the Bastion\'s save, and leaves the other saved items alone', function (t) {
    var current = [
      { key: 'tsi.bastion.crest', value: { c: 1 }, savedAt: '2026-11-02T10:00:00.000Z' },
      { key: 'tsi.bastion.state', value: ba(9), savedAt: '2026-11-02T10:00:00.000Z' },
      { key: 'tsi.explorer.prefs', value: { sfxOn: false }, savedAt: '2026-11-02T10:00:00.000Z' },
      { key: 'tsi.explorer.save', value: ex(9), savedAt: '2026-11-02T10:00:00.000Z' }
    ];
    var out = S.rollbackRecords(current, { items: S.makeItems(ex(5), ba(4)) }, 5000);
    t.same(out.map(function (r) { return r.key; }), ['tsi.bastion.crest', 'tsi.bastion.state', 'tsi.explorer.prefs', 'tsi.explorer.save']);
    t.equal(out.filter(function (r) { return r.key === 'tsi.explorer.save'; })[0].value.travel.day, 5);
    t.equal(out.filter(function (r) { return r.key === 'tsi.bastion.state'; })[0].value.day, 4);
    t.equal(out.filter(function (r) { return r.key === 'tsi.explorer.prefs'; })[0].value.sfxOn, false);
    var noBastion = S.rollbackRecords(current, { items: S.makeItems(ex(5), null) });
    t.ok(noBastion.every(function (r) { return r.key !== 'tsi.bastion.state'; }), 'a Bastion the snapshot did not have is removed');
    t.equal(current.length, 4, 'the list passed in is untouched');
  });
}());
