/* The Prison Tower (Harry, 26 October 2026): three cells, a prisoner locked up by hand for 7, 14, 21 or 28 days (the sentence
   counts from the lock-up day), interrogation, early release with a reason, release when the sentence ends (once, even when
   many days pass at once or the days are moved by Reset Travel). The data is in tools/bastion/data/facilities-data.js, the
   rules in tools/bastion/prison-rules.js. */
(function () {
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var ID = 'prison_tower';

  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function reload(b) { return BR.fromSave(copy(BR.toSave(b)), data); }
  /* A Bastion on Day 10 at party level 9 with the Prison Tower built. */
  function bastion(built) {
    var b = BR.defaultState(data);
    b.day = 10;
    b.anchored = true;
    b.bridge.fresh = false;
    b.partyLevel = 9;
    b.builtExtras = built === false ? [] : [{ facId: ID, status: 'built' }];
    BR.ensureLevels(b, data);
    return b;
  }
  function lock(b, i, over) {
    return BR.prisonLockUp(b, data, i, Object.assign({ name: 'Garrick Vane', thread: 'The Smugglers of Bolt Isle', days: 7, conditions: '' }, over || {}));
  }
  /* Pass n days the way the Bastion's screen does: one day at a time. */
  function pass(b, n) {
    var said = [];
    for (var i = 0; i < n; i++) {
      BR.startDay(b, data, 0);
      said = said.concat((b.dayInProgress && b.dayInProgress.news) || []);
      BR.finishDay(b);
    }
    return said;
  }

  group('Prison Tower: the building and its data');

  test('a facility of its own: party level 9, a construction slot, 21 days, one level, no orders, three cells', function (t) {
    var f = BR.facility(data, ID);
    t.same([f.name, f.requiredLevel, f.singleLevel, f.inDevelopment, f.plot, f.functions.length], ['Prison Tower', 9, true, undefined, undefined, 0]);
    t.equal(BR.isPlotFacility(data, ID), false, 'it takes a construction slot');
    t.equal(BR.buildDaysForFacility(f, data), 21, '21 days, as Harry asked (a level 9 building otherwise takes 28)');
    t.equal(BR.prisonCellCount(data), 3);
    t.same(BR.prisonSentences(data), [7, 14, 21, 28]);
    t.equal(data.bastion.startingBuilt.indexOf(ID), -1, 'not a starting facility');
    t.equal(BR.upgradeCheck(bastion(), data, ID).ok, false, 'no Upgrade');
  });

  test('built from a slot at party level 9 (never below), and its map art is in the data', function (t) {
    var b = bastion(false);
    b.partyLevel = 8;
    t.equal(BR.startBuild(b, data, 0, ID).message, 'Locked. Prison Tower requires party level 9.');
    b.partyLevel = 9;
    t.equal(BR.startBuild(b, data, 0, ID, 'slot').ok, true);
    t.equal(b.builtExtras[0].readyDay, 31);
    t.equal(BR.prisonBlocker(b, data), 'The Prison Tower isn\'t built yet.', 'not while it is being built');
    t.same(T.bastion.map.overlays.filter(function (o) { return o.fac === ID; }).map(function (o) { return o.pic; }), ['map/overlays/prison_tower.png']);
    t.same(T.bastion.mapLabels[ID], { x: 953, y: 281 });
    t.same(T.bastion.facilityTileCrops[ID], { pic: 'map/overlays/prison_tower.png', x: 791, y: 261, w: 325, h: 231 });
  });

  group('Prison Tower: locking up');

  test('a new Bastion has three empty cells; an old save with none loads with three empty cells', function (t) {
    t.same(BR.defaultState(data).prison, { cells: [null, null, null], freed: [] });
    var old = copy(BR.toSave(bastion()));
    delete old.prison;
    t.same(BR.fromSave(old, data).prison, { cells: [null, null, null], freed: [] });
    t.equal(BR.fromSave(old, data).v, 4, 'still version 4');
  });

  test('a name, a thread or quest and one of the four sentences are required; the conditions are optional', function (t) {
    var b = bastion();
    var before = copy(b.prison);
    t.equal(lock(b, 0, { name: '  ' }).message, 'Type the prisoner\'s name.');
    t.equal(lock(b, 0, { thread: '' }).message, 'Type the thread or quest the prisoner is tied to.');
    [0, 3, 8, 15, 30, '', null, 'x'].forEach(function (d) { t.equal(lock(b, 0, { days: d }).ok, false, 'a sentence of ' + d + ' is refused'); });
    t.equal(lock(b, 3).message, 'There is no such cell.');
    t.equal(lock(b, -1).ok, false);
    t.same(b.prison, before, 'nothing changed');
    [7, 14, 21, 28].forEach(function (d, i) {
      var r = lock(bastion(), 0, { days: d });
      t.equal(r.ok, true, d + ' days');
    });
    var ok = lock(b, 1, { days: '14', conditions: ' Bring the ledger ' });
    t.equal(ok.ok, true, 'a sentence typed as text is fine');
    t.same(b.prison.cells[1], { name: 'Garrick Vane', thread: 'The Smugglers of Bolt Isle', days: 14, conditions: 'Bring the ledger', lockedDay: 10, endDay: 24, notes: [] });
  });

  test('the sentence counts from the lock-up day: a 7-day sentence on Day 10 ends on Day 17, and so for 14, 21 and 28', function (t) {
    t.equal(BR.prisonEndDay(10, 7), 17);
    [[7, 17], [14, 24], [21, 31], [28, 38]].forEach(function (p) {
      var b = bastion();
      lock(b, 0, { days: p[0] });
      t.equal(b.prison.cells[0].endDay, p[1], p[0] + ' days');
    });
  });

  test('a full cell is refused, the other cells still work, and nothing can be done before the Tower is built', function (t) {
    var b = bastion();
    t.equal(lock(b, 0).ok, true);
    t.equal(lock(b, 0, { name: 'Someone Else' }).message, 'That cell already holds Garrick Vane.');
    t.equal(lock(b, 2, { name: 'Mira' }).ok, true);
    t.same(BR.prisonHeld(b, data).map(function (h) { return h.index; }), [0, 2]);
    var n = bastion(false);
    t.equal(lock(n, 0).message, 'The Prison Tower isn\'t built yet.');
  });

  test('a long name or thread is cut to its limit, and the save keeps what was typed after a reload', function (t) {
    var b = bastion();
    lock(b, 0, { name: new Array(200).join('a'), thread: new Array(300).join('b') });
    t.equal(b.prison.cells[0].name.length, BR.PRISON_NAME_MAX);
    t.equal(b.prison.cells[0].thread.length, BR.PRISON_THREAD_MAX);
    var back = reload(b);
    t.same(back.prison, b.prison);
  });

  test('a damaged save is tidied: bad cells become empty, a missing end day is the lock-up day plus the sentence', function (t) {
    var p = BR.cleanPrison({ cells: [{ name: 'Ok', thread: 't', days: 14, lockedDay: 5 }, 7, { name: '' }, null, { name: 'Fourth' }], freed: [3, { name: 'Gone', day: 2 }] }, 10, data);
    t.equal(p.cells.length, 5, 'a cell with someone in it past the third is kept, never dropped');
    t.equal(p.cells[0].endDay, 19);
    t.equal(p.cells[1], null);
    t.equal(p.cells[2], null);
    t.equal(p.freed.length, 1);
    t.same(BR.cleanPrison(null, 10, data).cells, [null, null, null]);
    t.same(BR.cleanPrison({ cells: [null, null, null, null, null] }, 10, data).cells, [null, null, null], 'empty cells beyond the third are dropped');
  });

  group('Prison Tower: interrogating and releasing');

  test('interrogate: a failed check says "holds their tongue" and keeps nothing; a pass says "starts talking" and the DM writes what was found', function (t) {
    var b = bastion();
    lock(b, 0);
    var fail = BR.prisonInterrogate(b, data, 0, false);
    t.same([fail.ok, fail.passed, fail.line], [true, false, 'Garrick Vane holds their tongue.']);
    t.same(b.prison.cells[0].notes, [], 'nothing saved');
    var pass1 = BR.prisonInterrogate(b, data, 0, true);
    t.same([pass1.ok, pass1.passed, pass1.line], [true, true, 'Garrick Vane starts talking.']);
    t.equal(BR.prisonAddNote(b, data, 0, '   ').message, 'Write what was discovered.');
    t.equal(BR.prisonAddNote(b, data, 0, ' The ledger is under the lighthouse. ').ok, true);
    b.day = 12;
    t.equal(BR.prisonAddNote(b, data, 0, 'He fears the Harbourmaster.').ok, true, 'more can be added by interrogating again');
    t.same(b.prison.cells[0].notes, [{ day: 10, text: 'The ledger is under the lighthouse.' }, { day: 12, text: 'He fears the Harbourmaster.' }]);
    t.same(reload(b).prison.cells[0].notes, b.prison.cells[0].notes, 'kept in the save');
    t.equal(BR.prisonInterrogate(b, data, 1, true).message, 'That cell is empty.');
    t.equal(BR.prisonAddNote(b, data, 1, 'x').message, 'That cell is empty.');
  });

  test('release needs a reason typed by the DM, then frees the cell; a refused release changes nothing', function (t) {
    var b = bastion();
    lock(b, 0);
    var before = copy(b.prison);
    ['', '  ', 'x', null, undefined].forEach(function (r) { t.equal(BR.prisonRelease(b, data, 0, r).message, 'Say why the party released them.'); });
    t.same(b.prison, before);
    var r = BR.prisonRelease(b, data, 0, ' They told us everything. ');
    t.same([r.ok, r.name, r.reason, r.line], [true, 'Garrick Vane', 'They told us everything.', 'Garrick Vane is released early: They told us everything.']);
    t.equal(b.prison.cells[0], null, 'the cell is free');
    t.equal(b.prison.freed.length, 1);
    t.same([b.prison.freed[0].early, b.prison.freed[0].reason, b.prison.freed[0].day], [true, 'They told us everything.', 10]);
    t.equal(BR.prisonRelease(b, data, 0, 'Again, please').message, 'That cell is empty.');
    t.equal(lock(b, 0, { name: 'Next' }).ok, true, 'the cell can be used again');
  });

  group('Prison Tower: sentences ending');

  test('a prisoner is released on the day the sentence ends, with the Ironbow\'s word, and never twice', function (t) {
    var b = bastion();
    lock(b, 0, { days: 7 });
    var said = pass(b, 6);
    t.same(said, [], 'Day 16: still held');
    t.equal(b.prison.cells[0].name, 'Garrick Vane');
    said = pass(b, 1);
    t.equal(b.day, 17);
    t.same(said, ['Garrick Vane is released from the Prison Tower: their sentence is served.']);
    t.equal(b.prison.cells[0], null);
    t.same(b.prison.freed.map(function (f) { return [f.name, f.early, f.day]; }), [['Garrick Vane', false, 17]]);
    t.same(pass(b, 5), [], 'no second word');
    t.equal(BR.tickPrison(b, data).length, 0, 'asked again for the same day, nothing happens');
    t.equal(b.prison.freed.length, 1);
  });

  test('catch-up: many days at once release each prisoner once, on their own day, each with its own word', function (t) {
    var b = bastion();
    lock(b, 0, { days: 7, name: 'A' });
    lock(b, 1, { days: 14, name: 'B' });
    lock(b, 2, { days: 28, name: 'C' });
    var words = [];
    for (var i = 0; i < 20; i++) {
      BR.startDay(b, data, 0);
      words.push([b.day, (b.dayInProgress.news || []).slice()]);
      BR.finishDay(b);
    }
    var told = words.filter(function (w) { return w[1].length; });
    t.same(told.map(function (w) { return [w[0], w[1].length, /^(A|B)/.exec(w[1][0])[1]]; }), [[17, 1, 'A'], [24, 1, 'B']]);
    t.same(b.prison.cells.map(function (c) { return c && c.name; }), [null, null, 'C']);
    t.same(b.word.map(function (w) { return w.day; }), [17, 24], 'the word is kept for the pop-up, one line each');
    /* a long jump taken in one go still releases the lot, once */
    var c = bastion();
    lock(c, 0, { days: 7, name: 'A' });
    lock(c, 1, { days: 21, name: 'B' });
    c.day = 9;
    var n = 0;
    for (var d = 0; d < 40; d++) { BR.startDay(c, data, 0); n += (c.dayInProgress.news || []).length; BR.finishDay(c); }
    t.equal(n, 2, 'two words in all');
  });

  test('Under Repair: sentences keep counting and end on their day, but nothing can be done in the panel; demolishing waits for the prisoners', function (t) {
    var b = bastion();
    lock(b, 0, { days: 7 });
    b.repairs[ID] = 15;
    var why = 'The Prison Tower is Under Repair until Day 15. The prisoners are safe and their sentences keep counting.';
    t.equal(BR.prisonBlocker(b, data), why);
    t.equal(lock(b, 1).message, why);
    t.equal(BR.prisonInterrogate(b, data, 0, true).message, why);
    t.equal(BR.prisonRelease(b, data, 0, 'No more use').message, why);
    t.equal(BR.prisonAddNote(b, data, 0, 'x').message, why);
    t.equal(BR.demolishFacility(b, data, ID).ok, false, 'not while someone is held');
    t.ok(/holds 1 prisoner/.test(BR.demolishFacility(b, data, ID).message));
    var said = pass(b, 7);
    t.equal(said.length, 1, 'released on Day 17 although the Tower was under repair until Day 15 or later');
    t.equal(BR.demolishFacility(b, data, ID).ok, true, 'with no one held it can be demolished');
  });

  test('Reset Travel moves every prison day with the Bastion, so the sentence has the same days left; nothing is released or lost', function (t) {
    var b = bastion();
    lock(b, 0, { days: 14 });
    BR.prisonAddNote(b, data, 0, 'A secret.');
    BR.shiftDays(b, -6);
    t.equal(b.day, 4);
    var c = b.prison.cells[0];
    t.same([c.lockedDay, c.endDay, c.notes[0].day], [4, 18, 4]);
    t.equal(BR.prisonDaysLeft(b, c), 14);
    t.same(pass(b, 13), []);
    t.equal(pass(b, 1).length, 1, 'released on Day 18');
    var f = bastion();
    lock(f, 0, { days: 7 });
    BR.prisonRelease(f, data, 0, 'Done with them');
    BR.shiftDays(f, 5);
    t.equal(f.prison.freed[0].day, 15);
  });

  test('the Explorer is told of the release before the day: the saved Bastion lists it for the day it ends', function (t) {
    var C = TSI.campaign;
    var b = bastion();
    lock(b, 0, { days: 7 });
    var coming = C.bastionComing(BR.toSave(b)).filter(function (x) { return x.kind === 'prison'; });
    t.same(coming, [{ day: 17, kind: 'prison', line: 'Garrick Vane is released from the Prison Tower: their sentence is served.' }]);
    var news = C.ironbowNews(BR.toSave(b), 10, 17);
    t.same(news, [{ day: 17, lines: ['Garrick Vane is released from the Prison Tower: their sentence is served.'] }]);
    t.same(C.ironbowNews(BR.toSave(b), 10, 16), [], 'not before the day');
    BR.prisonRelease(b, data, 0, 'Enough');
    t.equal(C.bastionComing(BR.toSave(b)).filter(function (x) { return x.kind === 'prison'; }).length, 0, 'released early: nothing coming');
  });
}());
