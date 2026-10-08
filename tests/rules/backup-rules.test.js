/* Backup file rules: shared/js/backup-rules.js */
(function () {
  var B = TSI.backupRules;
  var R = TSI.storeRules;
  var when = new Date(2026, 8, 25, 14, 3, 0);
  function names(id) { return { quests: 'Notice Board Quest Generator', bastion: 'The Ironbow Bastion Manager', demo: 'Demo tool' }[id] || null; }
  function rec(key, value) { return R.makeRecord(key, value, when); }

  group('Backups: making files');

  test('a whole-suite backup reads back exactly', function (t) {
    var records = [rec('tsi.quests.accepted', [1, 2]), rec('tsi.bastion.state', { gold: 5 })];
    var backup = B.makeSuiteBackup(records, when);
    var parsed = B.parse(JSON.stringify(backup));
    t.ok(parsed.ok, parsed.reason);
    t.equal(parsed.backup.kind, 'suite');
    t.same(parsed.backup.records, records);
  });

  test('an empty suite can still be backed up', function (t) {
    var parsed = B.parse(JSON.stringify(B.makeSuiteBackup([], when)));
    t.ok(parsed.ok, parsed.reason);
    t.equal(B.summarise(parsed.backup, names).total, 0);
  });

  test('file names carry the date and time', function (t) {
    t.equal(B.fileName('suite', null, when), 'tsi-backup-everything-2026-09-25-1403.json');
    t.equal(B.fileName('tool', 'quests', when), 'tsi-quests-2026-09-25-1403.json');
  });

  group('Backups: refusing the wrong file');

  test('a file that isn\'t JSON is refused', function (t) {
    var r = B.parse('hello, this is a shopping list');
    t.ok(!r.ok);
    t.ok(/isn't a suite backup/.test(r.reason), r.reason);
  });

  test('some other JSON file is refused', function (t) {
    t.ok(!B.parse('{"a":1}').ok);
    t.ok(!B.parse('[1,2,3]').ok);
    t.ok(!B.parse('null').ok);
  });

  test('a backup from a newer suite is refused', function (t) {
    var backup = B.makeSuiteBackup([], when);
    backup.version = 99;
    t.ok(/newer version/.test(B.parse(JSON.stringify(backup)).reason));
  });

  test('a damaged backup is refused, saying which item', function (t) {
    var backup = B.makeSuiteBackup([rec('tsi.quests.accepted', 1), { key: 'tsi.quests.outlines' }], when);
    var r = B.parse(JSON.stringify(backup));
    t.ok(!r.ok);
    t.ok(/item 2/.test(r.reason), r.reason);
  });

  test('a backup holding the same item twice is refused', function (t) {
    var backup = B.makeSuiteBackup([rec('tsi.quests.accepted', 1), rec('tsi.quests.accepted', 2)], when);
    t.ok(!B.parse(JSON.stringify(backup)).ok);
  });

  test('a tool file that sneaks in another tool\'s data is refused', function (t) {
    var backup = B.makeToolBackup('quests', 'Notice Board', [rec('tsi.quests.accepted', 1), rec('tsi.bastion.state', 1)], when);
    t.ok(!B.parse(JSON.stringify(backup)).ok);
  });

  group('Backups: the right place for each file');

  test('Restore refuses a single tool\'s file and says where to use it', function (t) {
    var backup = B.makeToolBackup('quests', 'Notice Board Quest Generator', [rec('tsi.quests.accepted', 1)], when);
    var reason = B.checkForSuite(backup, names);
    t.equal(reason, 'This is a backup of just the Notice Board Quest Generator. To load it, open the Notice Board Quest Generator and use Import.');
    t.equal(B.checkForSuite(B.makeSuiteBackup([], when), names), null);
  });

  test('Import refuses a whole-suite backup', function (t) {
    var reason = B.checkForTool(B.makeSuiteBackup([], when), 'quests', names);
    t.ok(/whole-suite backup/.test(reason), reason);
  });

  test('Import refuses another tool\'s file', function (t) {
    var backup = B.makeToolBackup('quests', 'Notice Board Quest Generator', [], when);
    t.equal(B.checkForTool(backup, 'bastion', names), 'This file is from the Notice Board Quest Generator, not The Ironbow Bastion Manager. Nothing was changed.');
  });

  test('Import accepts the tool\'s own file', function (t) {
    var backup = B.makeToolBackup('quests', 'Notice Board Quest Generator', [rec('tsi.quests.accepted', 1)], when);
    t.equal(B.checkForTool(backup, 'quests', names), null);
  });

  group('Backups: what\'s in the file');

  test('the summary counts each tool\'s saved items', function (t) {
    var backup = B.makeSuiteBackup([
      rec('tsi.quests.accepted', 1), rec('tsi.quests.outlines', 2), rec('tsi.bastion.state', 3),
      rec('tsi.quarantine.bastion.state.20260925-140312', 4)
    ], when);
    var s = B.summarise(backup, names);
    t.equal(s.total, 4);
    t.same(s.lines, ['Notice Board Quest Generator: 2 saved items', 'The Ironbow Bastion Manager: 1 saved item', 'Damaged saves set aside: 1 saved item']);
  });

  group('Backups: the test page is kept apart');

  test('backups say where they came from, and old ones count as the real suite\'s', function (t) {
    t.equal(B.makeSuiteBackup([], when, 'test').space, 'test');
    t.equal(B.makeSuiteBackup([], when).space, 'suite');
    t.equal(B.makeToolBackup('demo', 'Demo tool', [], when, 'test').space, 'test');
    var old = B.makeSuiteBackup([], when);
    delete old.space;
    t.equal(B.parse(JSON.stringify(old)).backup.space, 'suite');
    var odd = B.makeSuiteBackup([], when);
    odd.space = 'elsewhere';
    t.ok(!B.parse(JSON.stringify(odd)).ok, 'an unknown place is refused');
  });

  test('test backups have their own file names', function (t) {
    t.equal(B.fileName('suite', null, when, 'test'), 'tsi-test-backup-everything-2026-09-25-1403.json');
    t.equal(B.fileName('tool', 'demo', when, 'test'), 'tsi-test-demo-2026-09-25-1403.json');
    t.equal(B.fileName('suite', null, when, 'suite'), 'tsi-backup-everything-2026-09-25-1403.json');
  });

  test('the real suite refuses test backups, and the test page refuses real ones', function (t) {
    var fromTest = B.makeSuiteBackup([], when, 'test');
    var fromReal = B.makeSuiteBackup([], when, 'suite');
    t.ok(/test page/.test(B.checkSpace(fromTest, 'suite')));
    t.ok(/real suite/.test(B.checkSpace(fromReal, 'test')));
    t.equal(B.checkSpace(fromReal, 'suite'), null);
    t.equal(B.checkSpace(fromTest, 'test'), null);
  });

  group('Backups: the campaign save (the Explorer and the Bastion together)');

  test('a campaign file holds both tools, reads back exactly and is named for the campaign', function (t) {
    var records = [rec('tsi.explorer.save', { tokens: [] }), rec('tsi.bastion.state', { day: 4 }), rec('tsi.bastion.crest', { dataUrl: 'data:image/png;base64,x', key: 'k' })];
    var backup = B.makeCampaignBackup(records, when);
    t.same([backup.kind, backup.tools], ['campaign', ['explorer', 'bastion']]);
    var parsed = B.parse(JSON.stringify(backup));
    t.ok(parsed.ok, parsed.reason);
    t.same(parsed.backup.records, records);
    t.equal(B.fileName('campaign', 'explorer', when), 'tsi-campaign-2026-09-25-1403.json');
    t.equal(B.fileName('campaign', 'bastion', when, 'test'), 'tsi-test-campaign-2026-09-25-1403.json');
    t.same([B.inCampaign('explorer'), B.inCampaign('bastion'), B.inCampaign('quests')], [true, true, false]);
  });

  test('a campaign file goes into the Explorer or the Bastion, not another tool or the home screen', function (t) {
    var backup = B.makeCampaignBackup([rec('tsi.explorer.save', 1)], when);
    t.equal(B.checkForTool(backup, 'explorer', names), null);
    t.equal(B.checkForTool(backup, 'bastion', names), null);
    t.ok(/campaign save \(the Explorer and the Bastion\), not the Notice Board Quest Generator file/.test(B.checkForTool(backup, 'quests', names)));
    t.ok(/open the Scarlett Isles Explorer or The Ironbow Bastion Manager and use Import/.test(B.checkForSuite(backup, names)));
    var mixed = B.makeCampaignBackup([rec('tsi.explorer.save', 1), rec('tsi.quests.accepted', [])], when);
    var r = B.parse(JSON.stringify(mixed));
    t.ok(!r.ok);
    t.ok(/mixes in another tool/.test(r.reason), r.reason);
  });

  test('an Explorer file from before the campaign save still goes into the Explorer, not the Bastion', function (t) {
    var old = B.makeToolBackup('explorer', 'Scarlett Isles Explorer', [rec('tsi.explorer.save', 1)], when);
    t.equal(B.checkForTool(old, 'explorer', names), null);
    t.ok(/not The Ironbow Bastion Manager/.test(B.checkForTool(old, 'bastion', names)));
  });

  test('test data in an older backup is left out of the real suite', function (t) {
    var backup = B.makeSuiteBackup([rec('tsi.demo.state', 1), rec('tsi.quests.accepted', 2)], when);
    var out = B.withoutTestData(backup, 'suite');
    t.equal(out.skipped, 1);
    t.same(out.backup.records.map(function (r) { return r.key; }), ['tsi.quests.accepted']);
    t.equal(backup.records.length, 2, 'the original is untouched');
    t.equal(B.withoutTestData(backup, 'test').skipped, 0, 'the test page keeps it');
  });
}());
