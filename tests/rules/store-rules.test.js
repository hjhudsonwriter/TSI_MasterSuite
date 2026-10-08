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

  group('Saving: the test page is kept apart');

  test('the real suite and the test page use different databases and names', function (t) {
    var real = R.spaceNames('suite');
    var fake = R.spaceNames('test');
    t.equal(real.db, 'tsi.suite');
    t.equal(fake.db, 'tsi.test');
    ['db', 'local', 'tabs', 'tabId', 'flash', 'file', 'handoff', 'handback', 'handoffCrest'].forEach(function (k) { t.ok(real[k] !== fake[k], k + ' differs'); });
    t.same([real.handoffCrest, fake.handoffCrest], ['tsi.suite.handoff-crest', 'tsi.test:handoff-crest'], 'a crest sent from the Crest Creator to the Bastion');
    t.equal(R.fromLocalKey(real.handoffCrest, 'suite'), null, 'a hand-off isn\'t a save');
    t.equal(R.spaceNames('anything else').db, 'tsi.suite', 'anything unknown counts as the real suite');
  });

  test('the test page\'s small-storage names can never be read as real saves', function (t) {
    var stored = R.localKey('tsi.demo.state', 'test');
    t.equal(stored, 'tsi.test:tsi.demo.state');
    t.equal(R.fromLocalKey(stored, 'test'), 'tsi.demo.state');
    t.equal(R.fromLocalKey(stored, 'suite'), null, 'the real suite ignores it');
    t.equal(R.fromLocalKey('tsi.bastion.state', 'suite'), 'tsi.bastion.state');
    t.equal(R.fromLocalKey('tsi.bastion.state', 'test'), null, 'the test page ignores real saves');
    t.equal(R.fromLocalKey('tsi.suite.tabs', 'suite'), null, 'the shell\'s own bookkeeping isn\'t a save');
  });

  test('the Demo tool\'s data is test-only', function (t) {
    t.ok(R.isTestOnly('tsi.demo.state'));
    t.ok(!R.isTestOnly('tsi.crest.state'));
    t.ok(!R.isTestOnly('nonsense'));
  });

  group('Saving: two open tabs ("Already open")');

  test('reads which tool a tab says it has open', function (t) {
    t.equal(R.tabTool('bastion'), 'bastion');
    t.equal(R.tabTool(''), '', 'the home screen');
    t.equal(R.tabTool(null), '', 'null is the home screen too');
    t.equal(R.tabTool(undefined), null, 'an older heartbeat that doesn\'t say isn\'t known');
    ['Bastion', 'bas tion', 42, {}, true].forEach(function (v) { t.equal(R.tabTool(v), null, String(v) + ' isn\'t known'); });
  });

  test('two different tools don\'t clash; the same tool does', function (t) {
    t.equal(R.tabsClash('bastion', 'crest'), false, 'the Bastion and the Crest');
    t.equal(R.tabsClash('crest', 'bastion'), false, 'the other way round');
    t.equal(R.tabsClash('bastion', 'bastion'), true, 'the Bastion twice');
  });

  test('the home screen clashes with everything (Restore and Back up everything cover every tool)', function (t) {
    t.equal(R.tabsClash('', ''), true, 'two home screens');
    t.equal(R.tabsClash('', 'bastion'), true, 'home and the Bastion');
    t.equal(R.tabsClash('crest', ''), true, 'the Crest and home');
  });

  test('a tab whose tool isn\'t known clashes with everything, to be safe', function (t) {
    t.equal(R.tabsClash(null, 'crest'), true);
    t.equal(R.tabsClash('crest', null), true);
    t.equal(R.tabsClash(R.tabTool(undefined), R.tabTool('crest')), true);
    t.equal(R.tabsClash(undefined, 'crest'), true);
    t.equal(R.tabsClash(null, null), true);
  });
}());
