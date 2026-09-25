/* Saving rules: shared/js/store-rules.js */
(function () {
  var R = TSI.storeRules;

  group('Saving: names');

  test('accepts proper save names', function (t) {
    ['tsi.bastion.state', 'tsi.encounter.mapImage', 'tsi.quests.primaryId', 'tsi.quarantine.bastion.state.20260925-140312', 'tsi.demo-tool.a_b']
      .forEach(function (k) { t.ok(R.isValidKey(k), k + ' should be accepted'); });
  });

  test('refuses names that don\'t start with tsi. or are badly formed', function (t) {
    ['bastion.state', 'tsi.', 'tsi.bastion', 'tsi.bastion.', 'tsi.Bastion.state', 'other.tsi.bastion.state', 'tsi.bastion.my state', 'tsi..state', '', null, 42, 'tsi.bastion.' + new Array(200).join('x')]
      .forEach(function (k) { t.ok(!R.isValidKey(k), String(k).slice(0, 40) + ' should be refused'); });
  });

  test('works out which tool a save belongs to', function (t) {
    t.equal(R.toolOf('tsi.bastion.state'), 'bastion');
    t.equal(R.toolOf('tsi.quarantine.bastion.state.20260925-140312'), 'quarantine');
    t.equal(R.toolOf('nonsense'), null);
  });

  test('builds a tool\'s save name, and refuses a bad one', function (t) {
    t.equal(R.keyFor('quests', 'accepted'), 'tsi.quests.accepted');
    t.throws(function () { R.keyFor('Quests', 'accepted'); });
    t.throws(function () { R.keyFor('quests', 'has space'); });
  });

  group('Saving: records');

  test('a record holds the key, a plain copy of the value, and when it was saved', function (t) {
    var when = new Date(Date.UTC(2026, 8, 25, 13, 3, 0));
    var r = R.makeRecord('tsi.demo.state', { count: 3, skip: undefined, when: when }, when);
    t.same(r, { key: 'tsi.demo.state', value: { count: 3, when: '2026-09-25T13:03:00.000Z' }, savedAt: '2026-09-25T13:03:00.000Z' });
    t.ok(R.isRecord(r));
  });

  test('saving is a copy: changing the original afterwards doesn\'t change the record', function (t) {
    var original = { list: [1, 2] };
    var r = R.makeRecord('tsi.demo.state', original);
    original.list.push(3);
    t.same(r.value.list, [1, 2]);
  });

  test('refuses to save nothing, or a bad name', function (t) {
    t.throws(function () { R.makeRecord('tsi.demo.state', undefined); });
    t.throws(function () { R.makeRecord('demo.state', 1); });
  });

  test('spots damaged records', function (t) {
    t.ok(!R.isRecord(null));
    t.ok(!R.isRecord([]));
    t.ok(!R.isRecord({ key: 'tsi.demo.state', savedAt: '2026-09-25T13:03:00.000Z' }), 'no value');
    t.ok(!R.isRecord({ key: 'tsi.demo.state', value: 1, savedAt: 'yesterday-ish' }), 'bad date');
    t.ok(!R.isRecord({ key: 'demo', value: 1, savedAt: '2026-09-25T13:03:00.000Z' }), 'bad key');
    t.ok(R.isRecord({ key: 'tsi.demo.state', value: null, savedAt: '2026-09-25T13:03:00.000Z' }), 'null is a fine value');
  });

  group('Saving: damaged saves');

  test('a damaged save is set aside under a dated quarantine name', function (t) {
    var when = new Date(2026, 8, 25, 14, 3, 12);
    t.equal(R.quarantineKey('tsi.bastion.state', when), 'tsi.quarantine.bastion.state.20260925-140312');
    t.ok(R.isValidKey(R.quarantineKey('tsi.bastion.state', when)));
  });

  test('setting aside something already set aside doesn\'t nest the name', function (t) {
    var when = new Date(2026, 8, 25, 14, 3, 12);
    t.equal(R.quarantineKey('tsi.quarantine.bastion.state.20260101-000000', when), 'tsi.quarantine.bastion.state.20260101-000000.20260925-140312');
  });

  test('explains save failures in plain English', function (t) {
    t.equal(R.describeFailure({ name: 'QuotaExceededError' }), 'The browser\'s storage space for the suite is full.');
    t.ok(/refused/.test(R.describeFailure(new Error('x'))));
  });
}());
