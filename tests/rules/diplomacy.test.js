/* The Hall's Diplomatic Records (pull request 9; Harry, 18 October 2026):
   tools/bastion/diplomacy-rules.js and its parts of tools/bastion/rules.js
   (the save, Reset Travel). */
(function () {
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };

  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function reload(b) { return BR.fromSave(copy(BR.toSave(b)), bdata); }
  function bastion(day) {
    var b = BR.defaultState(bdata);
    b.day = day || 10;
    b.anchored = true;
    return b;
  }
  function fields(over) {
    return Object.assign({
      title: 'The Karr envoy storms out', clans: ['karr', 'slade'], day: 9,
      situation: 'A Karr envoy walked out of the summit.', decision: 'The party let him go.', outcome: 'Karr is offended.', notes: '',
      consequences: []
    }, over || {});
  }
  function made(b, over) {
    var res = BR.createDipRecord(b, bdata, fields(over));
    if (!res.ok) throw new Error(res.message);
    return res.record;
  }

  test('a new record is a draft with a stable id; what the DM typed is tidied; nothing changes in the game', function (t) {
    var b = bastion();
    var hrBefore = copy(b.honourRespectByClan), pcBefore = copy(b.politicalCapital);
    var r = made(b, { title: '  The   Karr envoy  storms out ', clans: ['slade', 'karr', 'nobody'] });
    t.same([r.id, r.status, r.title, r.clans, r.day], ['dr-0001', 'draft', 'The Karr envoy storms out', ['slade', 'karr'], 9]);
    t.equal(made(b, { title: 'Second' }).id, 'dr-0002');
    t.same([b.honourRespectByClan, b.politicalCapital], [hrBefore, pcBefore], 'a draft changes no score');
    t.ok(/Recorded as a draft/.test(r.history[0].text));
    t.equal(BR.createDipRecord(b, bdata, fields({ title: '   ' })).ok, false, 'a title is needed');
    t.equal(BR.createDipRecord(b, bdata, fields({ day: 'soon' })).ok, false, 'the day must be a whole number');
    t.equal(BR.diplomaticRecords(b).length, 2, 'a refused record is not kept');
  });

  test('consequences are checked: a Clan and a non-zero change for scores, days for a restriction, a description for the rest; nothing is preset', function (t) {
    var b = bastion();
    function bad(c, re) {
      var res = BR.createDipRecord(b, bdata, fields({ consequences: [c] }));
      t.ok(!res.ok && re.test(res.message), JSON.stringify(c) + ' → ' + res.message);
    }
    bad({ kind: 'hr', clan: '', amount: -1 }, /choose the Clan/);
    bad({ kind: 'hr', clan: 'karr', amount: 0 }, /not 0/);
    bad({ kind: 'hr', clan: 'karr', amount: 6 }, /from −5 to \+5/);
    bad({ kind: 'pc', clan: 'karr', amount: 101 }, /from −100 to \+100/);
    bad({ kind: 'restriction', clan: 'karr', text: 'No new trade' }, /how many days/);
    bad({ kind: 'restriction', clan: 'karr', days: 0, text: 'x' }, /whole number from 1/);
    bad({ kind: 'restriction', clan: 'karr', days: 28, text: '' }, /say what it is/);
    bad({ kind: 'privilege', text: '' }, /say what it is/);
    bad({ kind: 'dragon', text: 'x' }, /what kind/);
    t.equal(BR.createDipRecord(b, bdata, fields({ consequences: [{ kind: 'privilege', text: 'Free passage', days: '' }] })).ok, true, 'a privilege may have no end');
    t.equal(BR.createDipRecord(b, bdata, fields({ consequences: Array.apply(null, { length: 13 }).map(function () { return { kind: 'hook', text: 'a' }; }) })).ok, false, 'at most 12');
  });

  test('a draft can be edited and dismissed; a confirmed record cannot be edited or dismissed', function (t) {
    var b = bastion();
    var r = made(b);
    t.ok(BR.updateDipRecord(b, bdata, r.id, fields({ title: 'Renamed', consequences: [{ kind: 'hook', text: 'Find the envoy' }] })).ok);
    t.same([r.title, r.consequences.length, r.consequences[0].id, r.consequences[0].status], ['Renamed', 1, 'dr-0001:c1', 'pending']);
    t.equal(BR.updateDipRecord(b, bdata, r.id, fields({ title: '' })).ok, false, 'a bad edit changes nothing');
    t.equal(r.title, 'Renamed');
    t.ok(BR.confirmDipRecord(b, bdata, r.id).ok);
    t.equal(BR.updateDipRecord(b, bdata, r.id, fields()).ok, false);
    t.equal(BR.dismissDipRecord(b, r.id).ok, false);
    var d = made(b, { title: 'To drop', consequences: [{ kind: 'hr', clan: 'karr', amount: -2 }] });
    var hr = b.honourRespectByClan.karr;
    t.ok(BR.dismissDipRecord(b, d.id).ok);
    t.same([d.status, b.honourRespectByClan.karr], ['dismissed', hr], 'dismissing applies nothing');
    t.equal(BR.confirmDipRecord(b, bdata, d.id).ok, false, 'a dismissed record cannot be confirmed');
  });

  test('confirming applies Honour & Respect and Political Capital exactly once, within their limits', function (t) {
    var b = bastion();
    b.honourRespectByClan.karr = -4;
    b.politicalCapital.karr = 95;
    var r = made(b, { consequences: [
      { kind: 'hr', clan: 'karr', amount: -3, text: 'He stormed out' },
      { kind: 'pc', clan: 'karr', amount: 20 },
      { kind: 'hr', clan: 'slade', amount: 1 }
    ] });
    var res = BR.confirmDipRecord(b, bdata, r.id);
    t.ok(res.ok, res.message);
    t.same([b.honourRespectByClan.karr, b.politicalCapital.karr, b.honourRespectByClan.slade], [-5, 100, 1], 'held at the limits');
    t.same([r.consequences[0].was, r.consequences[0].now, r.consequences[1].was, r.consequences[1].now], [-4, -5, 95, 100], 'what really happened is recorded');
    t.equal(r.status, 'confirmed');
    var again = BR.confirmDipRecord(b, bdata, r.id);
    t.equal(again.ok, false);
    t.same([b.honourRespectByClan.karr, b.politicalCapital.karr, b.honourRespectByClan.slade], [-5, 100, 1], 'a second confirm changes nothing');
    t.equal(b.log[0].title, 'Diplomatic Records');
    t.equal(b.log.filter(function (l) { return l.title === 'Diplomatic Records'; }).length, 1);
  });

  test('a restriction is DM-tracked: it counts its days from confirmation, expires by itself, and can be ended early', function (t) {
    var b = bastion(10);
    var r = made(b, { consequences: [
      { kind: 'restriction', clan: 'karr', days: 28, text: 'No NEW diplomatic or trade action' },
      { kind: 'favour', clan: 'slade', text: 'Owes a favour' },
      { kind: 'hook', text: 'Find the envoy' }
    ] });
    BR.confirmDipRecord(b, bdata, r.id);
    var c = r.consequences;
    t.same([c[0].status, c[0].until, c[1].until, c[2].until], ['active', 38, null, null]);
    t.equal(BR.dipConsequenceState(b, c[0]), 'active');
    b.day = 38;
    t.equal(BR.dipConsequenceState(b, c[0]), 'active', 'its last day still counts');
    b.day = 39;
    t.equal(BR.dipConsequenceState(b, c[0]), 'expired');
    t.same(BR.clanRelations(b, bdata).filter(function (x) { return x.key === 'karr'; })[0].restrictions, [], 'an expired restriction is not listed');
    b.day = 20;
    var end = BR.endDipConsequence(b, bdata, r.id, c[0].id);
    t.ok(end.ok, end.message);
    t.same([c[0].status, c[0].endedDay], ['ended', 20]);
    t.equal(BR.endDipConsequence(b, bdata, r.id, c[0].id).ok, false, 'not twice');
    var s2 = made(b, { consequences: [{ kind: 'hr', clan: 'karr', amount: 1 }] });
    BR.confirmDipRecord(b, bdata, s2.id);
    t.equal(BR.endDipConsequence(b, bdata, s2.id, s2.consequences[0].id).ok, false, 'a change to a score cannot be ended');
  });

  test('the Clan Relations summary: the seven Clans\' own scores, and what is still running', function (t) {
    var b = bastion(10);
    b.honourRespectByClan.slade = 2;
    b.politicalCapital.slade = -15;
    var r = made(b, { consequences: [
      { kind: 'restriction', clan: 'karr', days: 10, text: 'Embargo' },
      { kind: 'privilege', clan: 'slade', text: 'Free passage', days: 5 },
      { kind: 'obligation', clan: 'slade', text: 'Return the stolen banner' },
      { kind: 'hook', text: 'A general hook' }
    ] });
    t.equal(BR.clanRelations(b, bdata).filter(function (x) { return x.restrictions.length; }).length, 0, 'a draft shows nothing');
    BR.confirmDipRecord(b, bdata, r.id);
    var rows = BR.clanRelations(b, bdata);
    t.equal(rows.length, 7);
    var karr = rows.filter(function (x) { return x.key === 'karr'; })[0];
    var slade = rows.filter(function (x) { return x.key === 'slade'; })[0];
    t.same([slade.hr, slade.pc, karr.restrictions.length, slade.privileges.length, slade.obligations.length], [2, -15, 1, 1, 1]);
    t.same(karr.restrictions[0].until, 20);
    t.equal(BR.dipUnattached(b).length, 1, 'a hook that names no Clan is listed on its own');
  });

  test('notes can be added to any record and change nothing else', function (t) {
    var b = bastion();
    var r = made(b);
    var before = copy(b.honourRespectByClan);
    t.ok(BR.addDipNote(b, r.id, '  The players returned to it  ').ok);
    t.equal(r.history[r.history.length - 1].text, 'Note: The players returned to it');
    t.equal(BR.addDipNote(b, r.id, '   ').ok, false);
    t.equal(BR.addDipNote(b, 'dr-9999', 'x').ok, false);
    t.same(b.honourRespectByClan, before);
  });

  test('saving and loading: the ledger comes back as it was, loading twice changes nothing, and a confirmed record is never applied again', function (t) {
    var b = bastion(10);
    var r = made(b, { consequences: [{ kind: 'hr', clan: 'karr', amount: -1 }, { kind: 'restriction', clan: 'karr', days: 5, text: 'Embargo' }] });
    BR.confirmDipRecord(b, bdata, r.id);
    made(b, { title: 'Another draft' });
    var back = reload(b);
    t.same(back.diplomaticRecords, b.diplomaticRecords);
    t.same(reload(back).diplomaticRecords, back.diplomaticRecords, 'loading twice changes nothing');
    t.equal(back.honourRespectByClan.karr, b.honourRespectByClan.karr);
    var tampered = copy(BR.toSave(b));
    tampered.diplomaticRecords.list[0].consequences[0].status = 'pending';
    var again = BR.fromSave(tampered, bdata);
    t.same([again.diplomaticRecords.list[0].consequences[0].status, again.honourRespectByClan.karr], ['applied', b.honourRespectByClan.karr], 'a damaged consequence is not re-applied');
    var nextId = BR.createDipRecord(back, bdata, fields({ title: 'After reload' })).record.id;
    t.equal(nextId, 'dr-0003', 'ids carry on after a reload');
    var old = copy(BR.toSave(bastion()));
    delete old.diplomaticRecords;
    t.same(BR.fromSave(old, bdata).diplomaticRecords, { next: 1, list: [] }, 'a save from before has an empty ledger');
    t.same(BR.fromSave({ diplomaticRecords: { next: 'x', list: [{ id: 5 }, 'y', { id: 'dr-0007', title: 'Odd', status: 'strange', consequences: [{ kind: 'nope' }] }] } }, bdata).diplomaticRecords.list.map(function (x) { return [x.id, x.status, x.consequences.length]; }), [['dr-0007', 'draft', 0]], 'damaged records are tidied, not trusted');
  });

  test('Clear Diplomacy Records does not touch the ledger, and Reset Travel moves its days', function (t) {
    var b = bastion(20);
    var r = made(b, { day: 18, consequences: [{ kind: 'restriction', clan: 'karr', days: 10, text: 'Embargo' }] });
    BR.confirmDipRecord(b, bdata, r.id);
    b.diplomacy = BR.defaultDiplomacy();
    t.equal(BR.diplomaticRecords(b).length, 1, 'the old Clear leaves the ledger');
    BR.shiftDays(b, -15);
    t.same([b.day, r.day, r.confirmedDay, r.consequences[0].until, r.consequences[0].appliedDay], [5, 3, 5, 15, 5]);
  });
}());
