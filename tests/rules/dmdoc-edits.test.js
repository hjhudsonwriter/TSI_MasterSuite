/* Scores set by hand in the DM doc (Harry, 19 October 2026): the DM doc's
   list of edits (shared/js/dmdoc-rules.js) and the Bastion applying each
   once (tools/bastion/rules.js). */
(function () {
  var D = TSI.dmDocRules;
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents };
  function bastion() { var s = BR.defaultState(bdata); s.day = 14; return s; }
  function edit(kind, key, value, at) { return D.makeEdit(kind, key, value, at || 1000, function () { return 0.5; }, 14).edit; }

  group('DM doc: setting scores by hand');

  test('only whole numbers inside each score\'s own limits, for a real Clan or god', function (t) {
    t.equal(D.checkEdit('pc', 'blackstone', '12').value, 12);
    t.equal(D.checkEdit('pc', 'blackstone', -100).ok, true);
    t.equal(D.checkEdit('pc', 'blackstone', 101).ok, false);
    t.equal(D.checkEdit('hr', 'farmer', 5).ok, true);
    t.equal(D.checkEdit('hr', 'farmer', 6).ok, false);
    t.equal(D.checkEdit('favour', 'telluria', 100).ok, true);
    t.equal(D.checkEdit('favour', 'telluria', -1).ok, false);
    ['', 'x', '1.5', null].forEach(function (v) { t.equal(D.checkEdit('pc', 'blackstone', v).ok, false, String(v)); });
    t.equal(D.checkEdit('pc', 'nobody', 1).ok, false, 'not a Clan');
    t.equal(D.checkEdit('pc', 'telluria', 1).ok, false, 'a god is not a Clan');
    t.equal(D.checkEdit('favour', 'blackstone', 1).ok, false, 'a Clan is not a god');
    t.equal(D.checkEdit('gold', 'blackstone', 1).ok, false, 'not a score');
  });

  test('the list is tidied: bad and repeated ones dropped, oldest first, the newest 100 kept', function (t) {
    var a = edit('pc', 'bacca', 3, 5);
    var b = edit('hr', 'bacca', 1, 2);
    var list = D.cleanEdits([a, b, a, { id: 'x' }, null, Object.assign({}, b, { id: 'y', value: 99 })]);
    t.same(list.map(function (e) { return e.at; }), [2, 5]);
    var many = [];
    for (var i = 0; i < 130; i++) many.push(Object.assign({}, a, { id: 'e' + i, at: i }));
    var kept = D.cleanEdits(many);
    t.same([kept.length, kept[0].at, kept[99].at], [100, 30, 129]);
    t.same(D.addEdit(null, a).length, 1);
  });

  test('the Bastion sets the score once, logs what it was and is, and keeps a receipt', function (t) {
    var s = bastion();
    s.politicalCapital.blackstone = 20;
    var e = edit('pc', 'blackstone', -35);
    var r = BR.applyDmEdits(s, [e], 5000);
    t.same([r.changed, r.refused, s.politicalCapital.blackstone], [true, 0, -35]);
    t.equal(s.log.length, 1);
    t.ok(/Political Capital for Clan Blackstone set by the DM: 20 to -35\./.test(s.log[0].body), s.log[0].body);
    t.same([s.dmEdits.done[e.id].r, s.dmEdits.done[e.id].was, s.dmEdits.done[e.id].now, s.dmEdits.done[e.id].day], ['applied', 20, -35, 14]);
    var again = BR.applyDmEdits(s, [e], 9000);
    t.same([again.changed, s.log.length, s.politicalCapital.blackstone], [false, 1, -35], 'a second look changes nothing');
    s.politicalCapital.blackstone = 7;
    BR.applyDmEdits(s, [e], 9500);
    t.equal(s.politicalCapital.blackstone, 7, 'and a later change in the Bastion is not overwritten by an old edit');
  });

  test('Honour/Respect and Favour are set too, in the order they were made, and a bad one is refused for good', function (t) {
    var s = bastion();
    var e1 = edit('favour', 'aurush', 40, 1);
    var e2 = edit('favour', 'aurush', 55, 2);
    var e3 = edit('hr', 'karr', -3, 3);
    var bad = { id: 'bad1', kind: 'hr', key: 'karr', value: 9, at: 4 };
    var r = BR.applyDmEdits(s, [e3, bad, e2, e1], 100);
    t.same([s.favour.aurush, s.honourRespectByClan.karr], [55, -3], 'the later edit wins');
    t.same([r.refused, s.dmEdits.done.bad1.r], [1, 'refused']);
    t.ok(/goes from -5 to 5/.test(s.dmEdits.done.bad1.why), s.dmEdits.done.bad1.why);
    t.equal(r.lines.length, 3);
    t.equal(BR.applyDmEdits(s, [bad], 200).changed, false, 'refused for good');
  });

  test('the receipts survive saving and reloading, and an old save without them still loads', function (t) {
    var s = bastion();
    var e = edit('hr', 'slade', 2);
    BR.applyDmEdits(s, [e], 1);
    var back = BR.fromSave(JSON.parse(JSON.stringify(BR.toSave(s))), bdata);
    t.equal(back.dmEdits.done[e.id].now, 2);
    var old = JSON.parse(JSON.stringify(BR.toSave(bastion())));
    delete old.dmEdits;
    t.same(BR.fromSave(old, bdata).dmEdits, { done: {} });
  });

  test('where an edit stands, for the DM doc: waiting, applied or refused', function (t) {
    var s = bastion();
    var e = edit('pc', 'molten', 9);
    t.equal(D.editStatus(e, s).state, 'waiting');
    BR.applyDmEdits(s, [e], 1);
    t.equal(D.editStatus(e, s).state, 'applied');
    t.equal(D.editStatus(e, null).state, 'waiting');
    t.equal(D.editText(e), 'Political Capital, Clan Molten: set to +9');
  });
}());
