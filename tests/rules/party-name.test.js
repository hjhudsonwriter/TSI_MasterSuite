/* The Party Name, and no more founding a Clan (step S07 of the Strip Back
   Overhaul, Harry, 22 October 2026): R.cleanPartyName and R.partyNameNote
   (tools/bastion/rules.js), the new partyName field in a save, and the
   'identity' step of the conversion (tools/bastion/strip-back-rules.js) that
   turns a founded Clan's name into the Party Name, once, and drops the Clan,
   its Honour and the Trusted Clients scores.
   The design: docs/strip-back/C-identity-crest.md; what was built:
   docs/strip-back/S07-built.md. The screen is checked in
   tests/e2e/party-name.test.js. */
(function () {
  var R = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var FIX = window.TSI_FIXTURES || {};
  var canon = R.stripBackCanon;

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  /* A plain version 3 Bastion on Day 12, edited by fn (as in strip-back.test.js: it still has the three starting war facilities). */
  function v3(fn) {
    var s = clone(R.toSave(R.defaultState(data)));
    s.v = 3;
    s.builtFacilities = ['barracks', 'armoury', 'watchtower', 'workshop', 'dock'];
    s.facilityLevels = Object.assign({ barracks: 1, armoury: 1, watchtower: 1 }, s.facilityLevels);
    s.day = 12;
    s.anchored = true;
    s.treasuryGP = 400;
    s.partyLevel = 13;
    /* What every version 3 Bastion held (and it had no Party Name). */
    delete s.partyName;
    s.organization = { type: 'unsworn', name: '', chief: '', motto: '', foundedAtDay: null };
    s.clanHonor = 40;
    s.trustedClientsByClan = { blackstone: 50, bacca: 50, farmer: 50, slade: 50, molten: 50, rowthorn: 50, karr: 50 };
    if (fn) fn(s);
    return s;
  }
  function founded(extra) {
    return v3(function (s) {
      s.organization = { type: 'clan', name: 'Clan Ironbow', chief: 'Harry', motto: 'Root and Steel', foundedAtDay: 3 };
      s.clanHonor = 70;
      if (extra) extra(s);
    });
  }
  function convert(raw) {
    var res = R.migrateToV4(raw, data);
    res.problems = R.stripBackAudit(res.before, res.save, res.report, data);
    return res;
  }
  function party(res) {
    return res.report.lines.filter(function (l) { return /^Your Party\. /.test(l); });
  }
  function jargon(text) {
    var bad = [];
    if (/undefined|null|NaN|\[object|Infinity/.test(text)) bad.push('a code word');
    if (/\b[a-z]+_[a-z_]+\b/.test(text)) bad.push('an id with an underscore');
    if (/\b(partyName|organization|clanHonor|trustedClientsByClan)\b/.test(text)) bad.push('a field name');
    if (/  /.test(text)) bad.push('a double space');
    return bad;
  }
  function has(s, keys) { return keys.filter(function (k) { return k in s; }); }
  var DROPPED = ['organization', 'clanHonor', 'trustedClientsByClan'];

  group('Party Name: tidying a name (S07)');

  test('a Party Name is tidied the way the suite tidies words: trimmed, one space between words, no angle brackets or hidden characters', function (t) {
    t.equal(R.PARTY_NAME_MAX, 40);
    t.equal(R.cleanPartyName('  The   Ironbow \t Company  '), 'The Ironbow Company');
    t.equal(R.cleanPartyName('A<b>C</b>D'), 'A b C /b D');
    t.equal(R.cleanPartyName('<script>alert(1)</script>'), 'script alert(1) /script');
    t.equal(R.cleanPartyName('Line\none\u0000two\u0007three'), 'Line one two three', 'a line break is a space; control characters are gone');
    t.equal(R.cleanPartyName('rtl‮trick​!'), 'rtl trick !', 'direction-changing and zero-width characters are gone');
    t.equal(R.cleanPartyName(''), '');
    t.equal(R.cleanPartyName('   '), '');
    t.equal(R.cleanPartyName('<>'), '', 'only brackets is no name');
  });

  test('anything that is not text is no name', function (t) {
    [undefined, null, 0, 12, true, false, {}, [], ['a'], { name: 'x' }, function () { return 'x'; }].forEach(function (v) {
      t.equal(R.cleanPartyName(v), '', 'not text: ' + typeof v);
    });
  });

  test('at most 40 letters: 40 stay, 41 are cut, a space where it is cut is not kept, a picture letter is never cut in half', function (t) {
    var forty = new Array(41).join('a');
    t.equal(R.cleanPartyName(forty), forty);
    t.equal(R.cleanPartyName(forty + 'b'), forty, '41 letters give 40');
    t.equal(R.cleanPartyName(new Array(500).join('x')).length, 40);
    var cut = 'ab cd '.repeat(10);
    t.ok(R.cleanPartyName(cut).length <= 40);
    t.equal(R.cleanPartyName(cut), R.cleanPartyName(cut).trim(), 'no space left on the end');
    var emoji = '🐉';
    var edge = new Array(40).join('a') + emoji;
    var out = R.cleanPartyName(edge);
    t.equal(out, new Array(40).join('a'), 'the dragon would not fit whole, so it is left off, not cut in half');
    t.ok(!/[\uD800-\uDBFF]$/.test(out), 'no half letter at the end');
    t.equal(R.cleanPartyName(new Array(39).join('a') + emoji), new Array(39).join('a') + emoji, 'one that fits whole stays');
  });

  test('tidying is stable: a tidied name tidies to itself, whatever went in', function (t) {
    ['  x  ', 'A<b>C', 'tab\tand\nline', new Array(80).join('ab '), '🐉 dragon', 'Clan Ironbow', 'The Ironbow Company'].forEach(function (v) {
      var once = R.cleanPartyName(v);
      t.equal(R.cleanPartyName(once), once, JSON.stringify(v));
    });
  });

  test('the note for the screen says something only when tidying changed more than spaces, in UK English', function (t) {
    t.equal(R.partyNameNote('The Ironbow Company'), '');
    t.equal(R.partyNameNote('  The   Ironbow  '), '', 'spaces alone are not worth a note');
    t.equal(R.partyNameNote(''), '');
    t.equal(R.partyNameNote(5), '');
    t.equal(R.partyNameNote('A<b>C'), 'Angle brackets (< and >) can\'t be used in a name, so they were taken out.');
    t.equal(R.partyNameNote(new Array(60).join('a')), 'A Party Name can have at most 40 letters, so the rest was left off.');
    t.equal(R.partyNameNote('a\u0000b'), 'Some hidden characters were taken out of the name.');
    ['A<b>C', new Array(60).join('a'), 'a\u0000b'].forEach(function (v) {
      var note = R.partyNameNote(v);
      t.ok(!/\b(color|honor|neighbor|organize|gray)\b/i.test(note), 'UK spelling: ' + note);
      t.same(jargon(note), [], note);
    });
  });

  group('Party Name: in the save (S07)');

  test('a new Bastion has no Party Name, and none of the Clan fields', function (t) {
    var s = R.defaultState(data);
    t.equal(s.partyName, '');
    t.same(has(s, DROPPED), []);
    t.equal(s.v, 4);
  });

  test('the Party Name survives a save and a reload, and is tidied again when it loads', function (t) {
    var s = R.defaultState(data);
    s.partyName = 'The Ironbow Company';
    s.day = 9;
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
    t.equal(back.partyName, 'The Ironbow Company');
    t.same(back, s);
    var dirty = R.toSave(s);
    dirty.partyName = '  Too   <b>much</b>  ' + new Array(60).join('z');
    var cleaned = R.fromSave(dirty, data).partyName;
    t.equal(cleaned, R.cleanPartyName(dirty.partyName));
    t.ok(cleaned.length <= 40 && !/[<>]/.test(cleaned));
    [5, null, {}, ['x'], true].forEach(function (v) {
      var d = R.toSave(s);
      d.partyName = v;
      t.equal(R.fromSave(d, data).partyName, '', 'not text loads as no name: ' + JSON.stringify(v));
    });
    var none = R.toSave(s);
    delete none.partyName;
    t.equal(R.fromSave(none, data).partyName, '', 'a save with no Party Name loads with none');
  });

  test('the fields of a Clan are not loaded: a version 4 save that holds only the empty values the old Bastion wrote loads quietly, with no notice', function (t) {
    var raw = R.toSave(R.defaultState(data));
    raw.organization = { type: 'unsworn', name: '', chief: '', motto: '', foundedAtDay: null };
    raw.clanHonor = 40;
    raw.trustedClientsByClan = { blackstone: 50, bacca: 50, farmer: 50, slade: 50, molten: 50, rowthorn: 50, karr: 50 };
    t.equal(R.needsStripBack(raw, data), false, 'nothing to say, so nothing to convert');
    t.same(R.stripBackLeftovers(raw, data), []);
    var s = R.fromSave(raw, data);
    t.same(has(s, DROPPED), []);
    t.same(s, R.defaultState(data));
  });

  test('an import is no longer refused for a damaged organization record, which nothing reads now', function (t) {
    var raw = R.toSave(R.defaultState(data));
    raw.organization = 'not a record';
    t.equal(R.saveProblem(raw), null);
    t.equal(R.importProblem([{ key: 'tsi.bastion.state', value: raw }]), null);
    t.same(has(R.fromSave(raw, data), DROPPED), []);
  });

  test('Reset Travel (shifting every day) still works with no Clan in the save', function (t) {
    var s = R.defaultState(data);
    s.day = 20;
    s.partyName = 'The Ironbow Company';
    R.shiftDays(s, -5);
    t.equal(s.day, 15);
    t.equal(s.partyName, 'The Ironbow Company', 'a name has no day to shift');
  });

  group('Party Name: a Bastion that had founded a Clan (S07)');

  test('the Clan\'s name becomes the Party Name; the Clan, its Honour and the Trusted Clients scores go; the audit is clean', function (t) {
    var raw = founded();
    var before = JSON.stringify(raw);
    var res = convert(raw);
    t.equal(JSON.stringify(raw), before, 'the save it was given is untouched');
    t.same(res.problems, []);
    t.equal(res.save.partyName, 'Clan Ironbow');
    t.same(has(res.save, DROPPED), []);
    t.equal(res.save.v, 4);
    t.same(res.report.removed.identity, { kind: 'Clan', name: 'Clan Ironbow', chief: 'Harry', motto: 'Root and Steel', honour: 70, seeded: 'Clan Ironbow' });
    var rest = clone(res.save);
    ['migration', 'archivedFacilities', 'partyName', 'v', 'builtFacilities', 'facilityLevels', 'repairs'].forEach(function (k) { delete rest[k]; });
    var orig = clone(raw);
    DROPPED.concat(['migration', 'v', 'builtFacilities', 'facilityLevels', 'archivedFacilities', 'repairs']).forEach(function (k) { delete orig[k]; });
    Object.keys(orig).concat(Object.keys(rest)).forEach(function (k, i, all) {
      if (all.indexOf(k) === i) t.equal(canon(rest[k]), canon(orig[k]), k + ' is exactly as it was');
    });
  });

  test('the report says it in plain English: the name is kept, the chief, the motto and the Clan Honour are not, and the copy has everything', function (t) {
    var res = convert(founded());
    var lines = party(res);
    t.equal(lines.length, 1);
    t.equal(lines[0], 'Your Party. A party can no longer found a Clan, so yours, “Clan Ironbow”, is not one any more. Its name is now your Party Name, and shows above your crest. Its chief (Harry), its motto (“Root and Steel”) and its Clan Honour (70) are not kept in the Bastion, but the copy of your Bastion that was set aside has everything. Your crest stays as it is.');
    t.same(jargon(lines[0]), []);
    t.ok(/^The party's Clan is no longer kept|the party's Clan is no longer kept/.test(res.save.migration.v4.summary), res.save.migration.v4.summary);
    t.equal(res.save.migration.v4.changed, true);
  });

  test('a Clan with no chief or motto says only what it had', function (t) {
    var res = convert(v3(function (s) { s.organization = { type: 'clan', name: 'The Ironbow', chief: '', motto: '', foundedAtDay: 3 }; s.clanHonor = 40; }));
    t.same(res.problems, []);
    t.equal(res.save.partyName, 'The Ironbow');
    var line = party(res)[0];
    t.ok(/Its Clan Honour \(40\) is not kept in the Bastion/.test(line), line);
    t.ok(!/chief|motto/.test(line), line);
    var bare = convert(v3(function (s) { s.organization = { type: 'clan', name: 'The Ironbow', chief: '', motto: '', foundedAtDay: 3 }; delete s.clanHonor; }));
    t.ok(/Nothing else of it is kept in the Bastion; the copy of your Bastion that was set aside has everything\./.test(party(bare)[0]), party(bare)[0]);
  });

  test('a Clan with no name leaves the Party Name empty, and says so', function (t) {
    var res = convert(v3(function (s) { s.organization = { type: 'clan', name: '   ', chief: 'Harry', motto: '', foundedAtDay: 3 }; }));
    t.same(res.problems, []);
    t.equal(res.save.partyName, undefined, 'nothing is made up');
    t.equal(R.fromSave(res.save, data).partyName, '');
    t.ok(/It had no name, so your Party Name is empty\./.test(party(res)[0]), party(res)[0]);
  });

  test('a name that is too long, or has angle brackets, is tidied, and the report says so', function (t) {
    var long = convert(founded(function (s) { s.organization.name = 'The Honourable Company of the Ironbow Bastion and Its Friends'; }));
    t.same(long.problems, []);
    t.ok(long.save.partyName.length <= 40 && long.save.partyName.length > 20, long.save.partyName);
    t.ok(/\(tidied to fit: at most 40 letters, no angle brackets\)/.test(party(long)[0]), party(long)[0]);
    t.ok(/“The Honourable Company of the Ironbow Bastion and Its Friends”/.test(party(long)[0]), 'the whole old name is in the report');
    var tags = convert(founded(function (s) { s.organization.name = '<b>Ironbow</b>'; }));
    t.equal(tags.save.partyName, 'b Ironbow /b');
    t.ok(/tidied to fit/.test(party(tags)[0]));
  });

  test('a Party Name that is already there is never replaced by the Clan\'s name', function (t) {
    var res = convert(founded(function (s) { s.partyName = 'The Company'; }));
    t.same(res.problems, []);
    t.equal(res.save.partyName, 'The Company');
    t.ok(/Your Party Name, “The Company”, stays as it is\./.test(party(res)[0]), party(res)[0]);
    t.equal(res.report.removed.identity.seeded, '');
  });

  test('once only: converting the result again changes nothing, and clearing the name afterwards is never undone', function (t) {
    var res = convert(founded());
    t.equal(R.needsStripBack(res.save, data), false);
    t.same(R.stripBackLeftovers(res.save, data), []);
    t.equal(canon(R.migrateToV4(res.save, data).save), canon(res.save), 'converting again changes nothing');
    var cleared = R.fromSave(clone(res.save), data);
    cleared.partyName = '';
    var back = R.fromSave(clone(R.toSave(cleared)), data);
    t.equal(back.partyName, '', 'cleared stays cleared: the Clan is not there to seed it again');
    t.same(has(back, DROPPED), []);
    /* every step run again on the converted save does nothing (the audit's guarantee 7) */
    R.stripBackSteps.forEach(function (st) {
      if (st.id === 'finish') return;
      var probe = clone(res.save);
      st.run(probe, data, R.stripBackNewReport(probe, data));
      t.equal(canon(probe), canon(res.save), st.id + ' leaves it alone');
    });
  });

  test('an older copy of the suite that founded a Clan after the conversion is tidied again, with a short notice; a name already chosen stays', function (t) {
    var res = convert(founded());
    var read = clone(res.save);
    read.migration.v4.shown = true;
    read.organization = { type: 'clan', name: 'Clan Later', chief: 'Wren', motto: '', foundedAtDay: 14 };
    read.clanHonor = 55;
    t.equal(R.needsStripBack(read, data), true);
    t.same(R.stripBackLeftovers(read, data), [{ step: 'identity', what: 'a founded Clan' }, { step: 'identity', what: 'the party\'s Clan Honour' }]);
    var again = convert(read);
    t.same(again.problems, []);
    t.equal(again.save.partyName, 'Clan Ironbow', 'the Party Name it had is kept');
    t.same(has(again.save, DROPPED), []);
    t.equal(again.save.migration.v4.again, true);
    t.ok(/Your Party Name, “Clan Ironbow”, stays as it is/.test(party(again)[0]), party(again)[0]);
    var cleared = clone(read);
    cleared.partyName = '';
    t.equal(convert(cleared).save.partyName, 'Clan Later', 'with no name, the Clan\'s name is used (the only way to keep a name that would otherwise be lost)');
  });

  test('a Mercenary Brigade from the first two builds: its name becomes the Party Name too, and the report says it was a Brigade', function (t) {
    var res = convert(v3(function (s) { s.organization = { type: 'merc', name: 'The Ironbow Freeblades', chief: '', motto: '', foundedAtDay: 4 }; s.trustedClientsByClan.bacca = 12; }));
    t.same(res.problems, []);
    t.equal(res.save.partyName, 'The Ironbow Freeblades');
    var lines = party(res);
    t.equal(lines.length, 1);
    t.ok(/^Your Party\. The Bastion no longer has Mercenary Brigades, so yours, “The Ironbow Freeblades”, is gone\. Its name is now your Party Name/.test(lines[0]), lines[0]);
    t.ok(/Trusted Clients scores of the old Mercenary Brigade are not kept/.test(lines[0]), lines[0]);
    t.same(jargon(lines[0]), []);
  });

  test('a party that never founded a Clan hears nothing about it: the empty values are dropped quietly', function (t) {
    var res = convert(v3());
    t.same(res.problems, []);
    t.same(party(res), []);
    t.same(has(res.save, DROPPED), []);
    t.equal(res.save.partyName, undefined);
    t.equal(res.report.removed.identity, undefined);
    t.equal(R.fromSave(res.save, data).partyName, '');
  });

  test('Clan Honour or Trusted Clients scores that were changed are said, even with no Clan', function (t) {
    var honour = convert(v3(function (s) { s.clanHonor = 55; }));
    t.same(honour.problems, []);
    t.equal(party(honour).length, 1);
    t.ok(/The party's Clan Honour \(55\) is not kept, because a party can no longer found a Clan/.test(party(honour)[0]), party(honour)[0]);
    var trusted = convert(v3(function (s) { s.trustedClientsByClan.slade = 20; }));
    t.same(trusted.problems, []);
    t.ok(/Trusted Clients scores of the old Mercenary Brigade are not kept/.test(party(trusted)[0]), party(trusted)[0]);
    t.equal(trusted.save.partyName, undefined);
  });

  test('the seven Clans\' Honour/Respect and Political Capital, the crest and the rest of the Bastion are not touched', function (t) {
    var raw = founded(function (s) {
      s.honourRespectByClan.karr = -3;
      s.honourRespectByClan.bacca = 4;
      s.politicalCapital.slade = 31;
      s.politicalCapital.molten = -12;
      s.diplomaticRecords = { next: 3, list: [{ id: 1, status: 'confirmed', clan: 'karr', title: 'A truce', day: 5 }] };
    });
    var res = convert(raw);
    t.same(res.problems, []);
    ['honourRespectByClan', 'politicalCapital', 'diplomaticRecords', 'bridge', 'dmEdits', 'word', 'greatRites', 'research'].forEach(function (k) {
      t.equal(canon(res.save[k]), canon(raw[k]), k);
    });
    t.equal(res.save.treasuryGP, raw.treasuryGP, 'not a penny moves: a Clan cost nothing to give back');
    t.equal(res.report.gold.refunded, 0);
  });

  test('loading a version 3 Bastion with a Clan, with no screen in between (the Beast Handler on the laptop), gives the same Party Name', function (t) {
    var s = R.fromSave(founded(), data);
    t.equal(s.partyName, 'Clan Ironbow');
    t.same(has(s, DROPPED), []);
    t.equal(s.v, 4);
  });

  test('a version 2 Bastion that had founded a Clan goes through both conversions and comes out with the same Party Name', function (t) {
    var raw = founded(function (s) { s.v = 2; });
    var res = convert(raw);
    t.same(res.problems, []);
    t.equal(res.save.v, 4);
    t.equal(res.save.partyName, 'Clan Ironbow');
    t.same(has(res.save, DROPPED), []);
  });

  test('the heavy fixture (a Bastion that had founded Clan Ironbow, with a chief, a motto and Clan Honour 55) converts clean', function (t) {
    var heavy = FIX['bastion-v3-heavy'];
    t.ok(heavy && heavy.organization && heavy.organization.type === 'clan', 'the fixture has a founded Clan');
    var res = convert(heavy);
    t.same(res.problems, [], 'the audit: guarantees 1 to 7');
    t.equal(res.save.partyName, 'Clan Ironbow');
    t.same(has(res.save, DROPPED), []);
    t.equal(R.needsStripBack(res.save, data), false);
    t.equal(canon(R.migrateToV4(res.save, data).save), canon(res.save), 'idempotent');
    var lines = party(res);
    t.equal(lines.length, 1);
    t.ok(/Its chief \(Harry\), its motto \(“Root and Steel”\) and its Clan Honour \(55\) are not kept/.test(lines[0]), lines[0]);
    res.report.lines.forEach(function (l) { t.same(jargon(l), [], l.slice(0, 60)); });
    var loaded = R.fromSave(clone(res.save), data);
    t.equal(loaded.partyName, 'Clan Ironbow');
    t.same(loaded, R.fromSave(clone(heavy), data), 'loading the old save or the converted one gives the same Bastion');
  });

  test('the Party Name is in the Bastion\'s save only: Back up everything and Export carry it, and the Beast Handler\'s snapshot never does', function (t) {
    var s = R.defaultState(data);
    s.partyName = 'SECRETPARTYNAME';
    var raw = JSON.stringify(R.toSave(s));
    t.ok(raw.indexOf('SECRETPARTYNAME') !== -1, 'it is saved with the Bastion');
    t.equal(R.importProblem([{ key: 'tsi.bastion.state', value: R.toSave(s) }]), null, 'and imported with it');
    t.equal(R.fromSave(JSON.parse(raw), data).partyName, 'SECRETPARTYNAME');
  });
}());
