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

  test('Restore refuses an old Beast Handler file by saying there is nothing to load (the tool has no Import button now), not by pointing to a button that is not there', function (t) {
    var backup = B.makeToolBackup('beasthandler', 'Scarlett Isles: Beast Handler', [rec('tsi.beasthandler.queue', { items: [] })], when);
    var named = function (id) { return id === 'beasthandler' ? 'Scarlett Isles: Beast Handler' : names(id); };
    var reason = B.checkForSuite(backup, named);
    t.ok(!/use Import/.test(reason), reason);
    t.ok(/^This is an old backup of just the Beast Handler\. The Beast Handler no longer keeps anything of its own/.test(reason), reason);
    t.ok(/nothing in this file to load/.test(reason) && /no Import button any more/.test(reason) && /ignore the file/.test(reason), reason);
    t.ok(/whole-suite backup or a campaign file/.test(reason), 'and says where the beasts really are: ' + reason);
    t.equal(B.checkForSuite(B.makeToolBackup('quests', 'Notice Board Quest Generator', [rec('tsi.quests.accepted', 1)], when), names), 'This is a backup of just the Notice Board Quest Generator. To load it, open the Notice Board Quest Generator and use Import.', 'every other tool\'s message is as it was');
    t.equal(B.checkForSuite(B.makeCampaignBackup([], when), names).indexOf('use Import') > 0, true, 'the campaign file still says to use Import (the Explorer and the Bastion have one)');
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

  /* ---------- Named backups and the browser's protection (2 November 2026) ---------- */
  test('a backup\'s name is tidied: one line, no angle brackets or control characters, at most 60 letters', function (t) {
    t.equal(B.cleanLabel('  Session 7,   end '), 'Session 7, end');
    t.equal(B.cleanLabel('a<b>c\n\td'), 'a b c d');
    t.equal(B.cleanLabel(null), '');
    t.equal(B.cleanLabel(new Array(100).join('x')).length, 60);
  });

  test('the name goes into the file name as lower-case words joined by hyphens, and nothing changes without one', function (t) {
    var when = new Date(2026, 10, 2, 22, 40);
    t.equal(B.fileName('suite', null, when, 'suite', 'Session 7, end'), 'tsi-backup-everything-2026-11-02-2240-session-7-end.json');
    t.equal(B.fileName('suite', null, when, 'suite', ''), 'tsi-backup-everything-2026-11-02-2240.json');
    t.equal(B.fileName('campaign', null, when, 'suite', 'Before the siege!'), 'tsi-campaign-2026-11-02-2240-before-the-siege.json');
    t.equal(B.fileName('tool', 'quests', when, 'test', '../../etc'), 'tsi-test-quests-2026-11-02-2240-etc.json');
    t.equal(B.labelSlug('??'), '');
  });

  test('all three kinds of backup keep the name, only if there is one, and a file read back keeps a tidy one', function (t) {
    var rec = [{ key: 'tsi.quests.accepted', value: [], savedAt: '2026-11-02T10:00:00.000Z' }];
    var s = B.makeSuiteBackup(rec, new Date(), 'suite', 'Session 7, end');
    t.equal(s.label, 'Session 7, end');
    t.equal(B.makeSuiteBackup(rec, new Date(), 'suite').label, undefined);
    t.equal(B.makeCampaignBackup(rec, new Date(), 'suite', 'x').label, 'x');
    t.equal(B.makeToolBackup('quests', 'Notice Board', rec, new Date(), 'suite', 'y').label, 'y');
    var back = B.parse(JSON.stringify(s));
    t.ok(back.ok); t.equal(back.backup.label, 'Session 7, end');
    var messy = JSON.parse(JSON.stringify(s)); messy.label = '  <b>hi</b>  ';
    t.equal(B.parse(JSON.stringify(messy)).backup.label, 'b hi /b');
    var blank = JSON.parse(JSON.stringify(s)); blank.label = '   ';
    t.equal(B.parse(JSON.stringify(blank)).backup.label, undefined);
  });

  test('the home screen says whether the browser has promised to keep the saves', function (t) {
    var S = TSI.storeRules;
    t.equal(S.protectionLine({ supported: false, persisted: false }), null);
    t.equal(S.protectionLine(null), null);
    t.equal(S.protectionLine({ supported: true, persisted: true }).ok, true);
    var no = S.protectionLine({ supported: true, persisted: false });
    t.equal(no.ok, false);
    t.ok(/not protected/.test(no.text) && /backups/.test(no.text));
  });

  test('the name suggested when a session ends is the date', function (t) {
    t.equal(B.sessionEndLabel(new Date(2026, 10, 2, 22, 40)), 'Session end 2 Nov 2026');
    t.equal(B.sessionEndLabel(new Date(2027, 0, 15)), 'Session end 15 Jan 2027');
    t.equal(B.labelSlug(B.sessionEndLabel(new Date(2026, 10, 2))), 'session-end-2-nov-2026');
  });

  test('a backup\'s saved items are grouped for "restore only some", the Explorer and Bastion as one', function (t) {
    var recs = [rec('tsi.quests.accepted', []), rec('tsi.bastion.state', {}), rec('tsi.explorer.save', {}), rec('tsi.explorer.prefs', {}), rec('tsi.dmdoc.layout', {})];
    var backup = B.makeSuiteBackup(recs, when, 'suite');
    var g = B.restoreGroups(backup, names);
    t.same(g.map(function (x) { return x.id + ':' + x.count; }), ['quests:1', 'campaign:3', 'dmdoc:1']);
    t.same(g[1].tools, ['explorer', 'bastion']);
    t.equal(g[2].label, 'DM doc');
  });

  test('choosing every part restores everything as before; choosing some touches only those tools; none is refused', function (t) {
    var recs = [rec('tsi.quests.accepted', []), rec('tsi.bastion.state', {}), rec('tsi.explorer.save', {}), rec('tsi.dmdoc.layout', {})];
    var backup = B.makeSuiteBackup(recs, when, 'suite');
    var g = B.restoreGroups(backup, names);
    var all = B.restorePlan(backup, g, ['quests', 'campaign', 'dmdoc']);
    t.same(all.scope, { all: true });
    t.equal(all.records.length, 4);
    var some = B.restorePlan(backup, g, ['quests', 'dmdoc']);
    t.same(some.scope, { tools: ['quests', 'dmdoc'] });
    t.same(some.records.map(function (r) { return r.key; }), ['tsi.quests.accepted', 'tsi.dmdoc.layout']);
    t.equal(some.campaign, false);
    var camp = B.restorePlan(backup, g, ['campaign']);
    t.same(camp.scope.tools, ['explorer', 'bastion']);
    t.equal(camp.campaign, true);
    t.equal(camp.records.length, 2);
    t.equal(B.restorePlan(backup, g, []), null);
  });
}());