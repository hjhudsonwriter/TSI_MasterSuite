/* Wyvern Roost: bonding, training and the Chronicle (P1 and P2 of "Wyvern
   Roost: Bonding, Training & Rider Mastery"; Harry's approvals of 20 October
   2026): the development record and its save safety, Elara's one-time Bond 1,
   the six Level 1 to 3 training orders, the DM's bond confirmation, handler
   changes, training places, the recovery pause and the Defend Bastion
   bonuses (tools/bastion/rules.js, creature-rules.js, data/creatures-data.js,
   data/facilities-data.js). */
(function () {
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };

  /* A different number each time, so every order gets its own id (a constant would give them all the same one). */
  var seed = 0;
  function rnd() { seed += 0.0137; return seed % 1 || 0.5; }
  function dice() { return rnd; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function reload(b) { return BR.fromSave(copy(BR.toSave(b)), bdata); }
  /* A Bastion with a Roost at a level, Elara's wyvern housed, and a day. */
  function roost(level, day) {
    var b = BR.defaultState(bdata);
    b.day = day || 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 300;
    b.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }];
    BR.ensureLevels(b, bdata);
    b.facilityLevels.wyvern_roost = level || 1;
    var r = BR.issueOrder(b, bdata, 'wyvern_roost', 'house_elara_wyvern', 0, dice([0.3]));
    if (!r.ok) throw new Error(r.message);
    complete(b, last(b));
    return b;
  }
  function last(b) { return b.pendingOrders[b.pendingOrders.length - 1]; }
  function complete(b, o) { var l = BR.completeSimpleOrder(b, bdata, o, dice([0.5])); BR.removeOrder(b, o.id); return l; }
  function train(b, fn, idx) { return BR.issueOrder(b, bdata, 'wyvern_roost', fn, idx || 0, dice([0.3])); }
  /* Run an order to its due day and complete it. */
  function finish(b, fn, idx) {
    var r = train(b, fn, idx);
    if (!r.ok) throw new Error(r.message);
    var o = last(b);
    b.day = o.dueDay;
    return complete(b, o);
  }
  /* A granted wyvern, housed (there must be room). */
  function grantAndHouse(b, n) {
    var id = 'grant' + n + '-0a0b0c0d:dm:0';
    BR.applyInbox(b, bdata, { travel: { day: b.day }, journey: { outbox: [{ id: id, type: 'creature', day: b.day, at: '2026-10-20T10:00:00.000Z', from: { code: 'DM', title: 'DM', step: 'dm' }, species: 'wyvern', name: 'Skye' + n, text: 'A wyvern' }] } }, 1000);
    var r = BR.issueOrder(b, bdata, 'wyvern_roost', 'house_wyvern', 0, dice([0.3]));
    if (!r.ok) throw new Error(r.message);
    complete(b, last(b));
    return BR.creatureById(b, BR.creatureIdFor(id));
  }
  var E = 'elara_wyvern';
  function dev(b, id) { return BR.creatureById(b, id || E).development; }

  group('Wyvern Roost: bonding and training (20 October 2026)');

  test('Elara\'s wyvern is credited Bond 1 once, with her handler and one Chronicle line; a granted wyvern starts at Bond 0 with no handler', function (t) {
    var b = roost(1);
    var d = dev(b);
    t.same([d.bond.level, d.bond.ready, d.handlerId, d.chronicle.length, d.chronicle[0].text], [1, null, 'elara', 1, 'Existing relationship credited; Bond 1 per campaign decision.']);
    var s = grantAndHouse(b, 1);
    t.equal(s.development, undefined, 'nothing is made for it until the DM works with it');
    t.same(BR.devView(b, s).bond, { level: 0, ready: null });
    t.equal(BR.devView(b, s).handlerId, '');
    t.equal(dev(b).bond.level, 1, 'it never takes Elara\'s bond');
  });

  test('a save made before this existed, with Elara housed, is credited Bond 1 exactly once and keeps everything else', function (t) {
    var b = roost(1);
    var old = copy(BR.toSave(b));
    delete old.creatures[0].development;
    var once = BR.fromSave(copy(old), bdata);
    t.same([once.creatures[0].development.bond.level, once.creatures[0].development.chronicle.length], [1, 1]);
    var twice = reload(once);
    t.same(twice.creatures[0].development, once.creatures[0].development, 'loading again changes nothing');
    t.same([twice.creatures[0].id, twice.creatures[0].owner, twice.creatures[0].home], [E, 'elara', 'wyvern_roost']);
  });

  test('a higher bond the DM confirmed is never replaced by the migration', function (t) {
    var b = roost(1);
    dev(b).bond.level = 3;
    var back = reload(b);
    t.equal(back.creatures[0].development.bond.level, 3);
    t.equal(back.creatures[0].development.chronicle.length, 1, 'no second credit line');
  });

  test('everything survives a save, a reload, an export and an import: handler, temperament, training, bond, Chronicle, handler history', function (t) {
    var b = roost(1);
    finish(b, 'wyr_keeper_routine');
    BR.confirmBond(b, bdata, E, 'Elara stood her ground at the arena gate.');
    BR.setTemperament(b, bdata, E, { dominant: 'Proud', attachment: 'Warm sun', trigger: 'Drums' });
    BR.addChronicleNote(b, bdata, E, 'Slept on the tower.');
    var before = copy(dev(b));
    var back = reload(b);
    t.same(dev(back), before);
    var viaJson = BR.fromSave(JSON.parse(JSON.stringify(BR.toSave(back))), bdata);
    t.same(dev(viaJson), before, 'export and import');
    t.same(Object.keys(dev(back)), Object.keys(before), 'fields in a fixed order');
    t.same(JSON.stringify(BR.toSave(reload(back))), JSON.stringify(BR.toSave(back)), 'the same JSON twice');
  });

  test('the six orders: Level 1 to 3, free, with the approved days; each names one housed wyvern', function (t) {
    var f = BR.facility(bdata, 'wyvern_roost');
    var rows = f.functions.filter(function (x) { return x.trains && x.requiredFacilityLevel <= 3; }).map(function (x) { return [x.id, x.days, x.requiredFacilityLevel, x.costGP]; });
    t.same(rows, [['wyr_safe_acclimatisation', 5, 1, 0], ['wyr_keeper_routine', 7, 1, 0], ['wyr_signal_recall', 7, 2, 0], ['wyr_defence_drills', 7, 2, 0], ['wyr_open_sky_return', 10, 3, 0], ['wyr_aerial_sentinel', 7, 3, 0]]);
    t.same(f.functions.filter(function (x) { return !x.trains; }).map(function (x) { return x.id; }), ['house_elara_wyvern', 'house_wyvern'], 'the House orders are unchanged');
  });

  test('Elara\'s Bond 1 is pre-credited: Establish Keeper\'s Routine can start at once, Safe Acclimatisation is refused', function (t) {
    var b = roost(1);
    t.ok(/already Bond 1/.test(train(b, 'wyr_safe_acclimatisation').message), train(b, 'wyr_safe_acclimatisation').message);
    var r = train(b, 'wyr_keeper_routine');
    t.equal(r.ok, true, r.message);
    t.same([last(b).dueDay - last(b).issuedDay, last(b).label, b.treasuryGP], [7, 'Wyvern Roost: Establish Keeper\'s Routine (Elara\'s wyvern)', 300]);
  });

  test('completing a bond programme makes the milestone READY, never raises the bond; the DM confirms exactly one level with a reason and one Chronicle line', function (t) {
    var b = roost(1);
    var lines = finish(b, 'wyr_keeper_routine');
    t.ok(/Bond 2 \(Trusting\) milestone is ready/.test(lines[0][1]), lines[0][1]);
    t.same([dev(b).bond.level, dev(b).bond.ready], [1, 2], 'ready, not raised');
    t.equal(dev(b).chronicle.length, 2);
    t.equal(BR.confirmBond(b, bdata, E, '').ok, false, 'a reason is required');
    t.equal(BR.confirmBond(b, bdata, E, 'ok').ok, false, 'a real reason');
    var r = BR.confirmBond(b, bdata, E, 'She answered Elara\'s whistle among the arena crowds.');
    t.same([r.ok, r.level, dev(b).bond.level, dev(b).bond.ready, dev(b).chronicle.length], [true, 2, 2, null, 3]);
    t.equal(BR.confirmBond(b, bdata, E, 'again please').ok, false, 'nothing more is ready');
    t.equal(dev(b).chronicle.length, 3, 'exactly one line');
  });

  test('no skipping: a pending milestone blocks the next bond programme, a level needs the one before, and Bond 2 is not prepared twice', function (t) {
    var b = roost(3);
    finish(b, 'wyr_keeper_routine');
    t.ok(/milestone .* is waiting for you to confirm it/.test(train(b, 'wyr_signal_recall').message), train(b, 'wyr_signal_recall').message);
    t.ok(/Needs Bond 3 \(Bonded\); Elara's wyvern is Bond 1/.test(train(b, 'wyr_open_sky_return').message) || /waiting for you to confirm/.test(train(b, 'wyr_open_sky_return').message));
    BR.confirmBond(b, bdata, E, 'A good scene happened.');
    t.ok(/Needs Bond 3 \(Bonded\); Elara's wyvern is Bond 2/.test(train(b, 'wyr_open_sky_return').message), train(b, 'wyr_open_sky_return').message);
    t.ok(/already completed/.test(train(b, 'wyr_keeper_routine').message), 'a programme is once for each wyvern');
    t.equal(train(b, 'wyr_signal_recall').ok, true);
  });

  test('every refusal says the exact reason and changes nothing: level, housing, handler, bond, one programme at a time', function (t) {
    var b = roost(1);
    var snap = JSON.stringify(BR.toSave(b));
    t.equal(train(b, 'wyr_signal_recall').message, 'Needs the Wyvern Roost at Level 2 (it\'s Level 1).');
    t.equal(train(b, 'wyr_aerial_sentinel').message, 'Needs the Wyvern Roost at Level 3 (it\'s Level 1).');
    t.equal(JSON.stringify(BR.toSave(b)), snap, 'nothing changed');
    var g = grantAndHouse(b, 1);
    var gi = BR.fnOptions(b, bdata, BR.facility(bdata, 'wyvern_roost'), BR.fn(BR.facility(bdata, 'wyvern_roost'), 'wyr_safe_acclimatisation')).map(function (o) { return o.trainCreatureId; }).indexOf(g.id);
    t.ok(/has no handler yet/.test(train(b, 'wyr_safe_acclimatisation', gi).message), train(b, 'wyr_safe_acclimatisation', gi).message);
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    t.equal(train(b, 'wyr_safe_acclimatisation', gi).ok, true);
    t.ok(/already in a programme/.test(train(b, 'wyr_safe_acclimatisation', gi).message), 'one programme at a time');
    t.equal(BR.trainingBlocker(b, bdata, BR.facility(bdata, 'wyvern_roost'), BR.fn(BR.facility(bdata, 'wyvern_roost'), 'wyr_keeper_routine'), null), 'Choose a wyvern.');
  });

  test('training places by Roost level (1, 1, 2, 2, 3); two wyverns can train the same programme; awaiting a milestone holds no place; the House orders use none', function (t) {
    var b = roost(1);
    t.same([1, 2, 3, 4, 5].map(function (l) { b.facilityLevels.wyvern_roost = l; return BR.trainingPlaces(b, bdata, 'wyvern_roost').cap; }), [1, 1, 2, 2, 3]);
    b.facilityLevels.wyvern_roost = 1;
    var g = grantAndHouse(b, 1);
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    t.equal(train(b, 'wyr_keeper_routine').ok, true, 'Elara\'s takes the one place');
    t.ok(/All 1 training place is taken/.test(train(b, 'wyr_safe_acclimatisation', 1).message), train(b, 'wyr_safe_acclimatisation', 1).message);
    b.day = last(b).dueDay;
    complete(b, last(b));
    t.same([dev(b).bond.ready, BR.trainingPlaces(b, bdata, 'wyvern_roost').used], [2, 0], 'a pending milestone holds no place');
    t.equal(train(b, 'wyr_safe_acclimatisation', 1).ok, true, 'the place is free for the other wyvern');
    b.facilityLevels.wyvern_roost = 2;
    var h = BR.facility(bdata, 'wyvern_roost');
    var third = grantAndHouse(b, 2);
    t.equal(BR.trainingPlaces(b, bdata, 'wyvern_roost').used, 1, 'housing never used a place');
    t.ok(third.id !== g.id);
  });

  test('a day replayed, a reload, or a second completion credits a programme once', function (t) {
    var b = roost(1);
    train(b, 'wyr_keeper_routine');
    var o = last(b);
    b.day = o.dueDay;
    var again = copy(o);
    complete(b, o);
    var r = reload(b);
    t.same([r.creatures[0].development.bond.ready, Object.keys(r.creatures[0].development.training)], [2, ['wyr_keeper_routine']]);
    var replay = BR.completeSimpleOrder(r, bdata, again, dice([0.5]));
    t.ok(/nothing changed/.test(replay[0][1]), replay[0][1]);
    t.same([r.creatures[0].development.chronicle.length, r.creatures[0].development.bond.level], [2, 1]);
  });

  test('a recovering wyvern pauses its programme: every recovering day moves it on one day, once a day, and nothing is credited meanwhile', function (t) {
    var b = roost(2);
    dev(b).bond.level = 2;
    train(b, 'wyr_defence_drills');
    var o = last(b);
    t.equal(o.dueDay, 17);
    b.warRecovery = [{ id: 'r1', kind: 'creature', name: 'Elara\'s wyvern', status: 'wounded', untilDay: 14, creatureId: E }];
    b.day = 11;
    t.equal(BR.tickTraining(b, bdata), 1);
    t.equal(BR.tickTraining(b, bdata), 0, 'not twice on one day');
    t.equal(o.dueDay, 18);
    t.equal(BR.trainingStatus(b, bdata, BR.creatureById(b, E)).kind, 'paused');
    b.day = 12; BR.tickTraining(b, bdata);
    b.day = 13; BR.tickTraining(b, bdata);
    b.day = 14; BR.tickTraining(b, bdata);
    t.equal(o.dueDay, 21, 'four recovering days, four days added');
    b.warRecovery = [];
    t.equal(BR.trainingStatus(b, bdata, BR.creatureById(b, E)).kind, 'training');
    t.same(BR.dueOrders(Object.assign(b, { day: 20 })).length, 0, 'not due while it was hurt');
    b.day = 15; BR.tickTraining(b, bdata);
    t.equal(o.dueDay, 21, 'fit again: no more pushing');
    t.equal(Object.keys(dev(b).training).length, 0, 'nothing credited yet');
  });

  test('Territorial Defence Drills and Aerial Sentinel add +1 Resolve / +1 Defence to that wyvern only; Battle Value stays 11; the species and other wyverns are unchanged', function (t) {
    var b = roost(3);
    BR.confirmBond(b, bdata, E, 'x');
    dev(b).bond.level = 3;
    var base = BR.creatureWar(bdata, BR.creatureById(b, E));
    t.same([base.resolve, base.defence, base.bv, base.attack], [2, 13, 11, 6]);
    finish(b, 'wyr_defence_drills');
    var w1 = BR.creatureWar(bdata, BR.creatureById(b, E));
    t.same([w1.resolve, w1.defence, w1.bv, w1.attack], [3, 13, 11, 6]);
    finish(b, 'wyr_aerial_sentinel');
    var w2 = BR.creatureWar(bdata, BR.creatureById(b, E));
    t.same([w2.resolve, w2.defence, w2.bv, w2.trained], [3, 14, 11, ['+1 Resolve', '+1 Defence']]);
    var g = grantAndHouse(b, 1);
    t.same([BR.creatureWar(bdata, g).resolve, BR.creatureWar(bdata, g).defence], [2, 13], 'another wyvern is unchanged');
    t.equal(T.bastionCreatures.species.wyvern.war.resolve, 2, 'the species data is unchanged');
    t.ok(/trained: \+1 Resolve, \+1 Defence/.test(BR.creatureWarLine(bdata, BR.creatureById(b, E))));
    t.equal(reload(b).creatures[0].development.training.wyr_defence_drills.day > 0, true, 'kept through a reload');
  });

  test('assigning and changing a handler: the first keeps the bond; a change needs a reason, keeps the history, restarts at Bond 0 unless the DM credits it', function (t) {
    var b = roost(1);
    var g = grantAndHouse(b, 1);
    t.equal(BR.assignHandler(b, bdata, g.id, '', '').ok, false);
    t.equal(BR.assignHandler(b, bdata, g.id, 'Mira', '').ok, true);
    t.same([BR.creatureDev(g).handlerId, BR.creatureDev(g).bond.level], ['Mira', 0]);
    t.equal(BR.assignHandler(b, bdata, g.id, 'Mira', '').ok, false, 'already the handler');
    BR.creatureDev(g).bond.level = 2;
    t.equal(BR.assignHandler(b, bdata, g.id, 'Tomas', '').ok, false, 'a change needs a reason');
    var r = BR.assignHandler(b, bdata, g.id, 'Tomas', 'Mira left the Ironbow.');
    t.equal(r.ok, true, r.message);
    t.same([BR.creatureDev(g).handlerId, BR.creatureDev(g).bond.level, BR.creatureDev(g).handlerHistory.length, BR.creatureDev(g).handlerHistory[0].bond], ['Tomas', 0, 1, 2]);
    var c = BR.creatureDev(g);
    c.bond.level = 2;
    BR.assignHandler(b, bdata, g.id, 'Mira', 'Mira came back.', true);
    t.same([c.bond.level, c.handlerHistory.length], [2, 2], 'credited when the DM chooses');
    t.ok(c.chronicle.length >= 3);
  });

  test('temperament and notes are the DM\'s own words, kept, trimmed and never invented', function (t) {
    var b = roost(1);
    t.same(BR.devView(b, BR.creatureById(b, E)).temperament, { dominant: '', attachment: '', trigger: '' });
    BR.setTemperament(b, bdata, E, { dominant: '  Proud   and  wary ', attachment: 'x'.repeat(200), trigger: 'Drums' });
    t.same([dev(b).temperament.dominant, dev(b).temperament.attachment.length, dev(b).temperament.trigger], ['Proud and wary', 120, 'Drums']);
    t.equal(BR.addChronicleNote(b, bdata, E, '').ok, false);
    t.equal(BR.addChronicleNote(b, bdata, E, 'The wyvern watched the harbour.').ok, true);
    t.equal(dev(b).chronicle[dev(b).chronicle.length - 1].cat, 'note');
  });

  test('renaming keeps the identity and the development, and a waiting programme\'s label follows the new name', function (t) {
    var b = roost(1);
    train(b, 'wyr_keeper_routine');
    BR.renameCreature(b, bdata, E, 'Ember');
    t.equal(last(b).label, 'Wyvern Roost: Establish Keeper\'s Routine (Ember)');
    t.same([BR.creatureById(b, E).id, dev(b).bond.level], [E, 1]);
  });

  test('Under Repair, demolish and rebuild never erase a wyvern\'s bond, training or Chronicle; orders wait as every order does', function (t) {
    var b = roost(1);
    finish(b, 'wyr_keeper_routine');
    b.builtExtras = [];
    var back = reload(b);
    t.same([back.creatures[0].development.bond.ready, back.creatures[0].development.chronicle.length, back.creatures[0].home], [2, 2, 'wyvern_roost']);
    var again = roost(1);
    again.repairs = { wyvern_roost: again.day + 5 };
    var r = train(again, 'wyr_keeper_routine');
    t.equal(r.ok, false, 'no new programme while it is Under Repair');
  });

  test('the cleaner keeps a development whole, repairs nonsense, and drops a milestone that does not follow the bond', function (t) {
    var d = BR.cleanDevelopment({ handlerId: 'Mira', bond: { level: 2, ready: 5 }, training: { wyr_keeper_routine: { day: 4 }, 'Bad Key': { day: 1 } }, chronicle: [{ id: 'a', day: 3, cat: 'bond', text: 'x' }, { id: 'a', text: 'dup' }, { id: 'b' }, 7], harness: { fitted: true, paidGP: 150, fittedDay: 9 }, firstFlight: { approved: false, day: 3 } });
    t.same([d.bond, Object.keys(d.training), d.chronicle.length, d.harness, d.firstFlight], [{ level: 2, ready: null }, ['wyr_keeper_routine'], 1, { fitted: true, paidGP: 150, fittedDay: 9 }, { approved: false, day: null, handlerId: null }]);
    t.same(BR.cleanDevelopment(BR.cleanDevelopment(d)), BR.cleanDevelopment(d), 'safe to run twice');
    t.equal(BR.cleanDevelopment({ bond: { level: 9, ready: 1 } }).bond.level, 5, 'the level stays within 0 to 5');
  });

  test('the capacity, the House orders and Defend Bastion housing are unchanged: 2, 3, 4, 5, 6 places with Elara\'s wyvern taking one', function (t) {
    var b = roost(1);
    t.same([1, 2, 3, 4, 5].map(function (l) { b.facilityLevels.wyvern_roost = l; return BR.creatureRoom(b, bdata, 'wyvern_roost').capacity; }), [2, 3, 4, 5, 6]);
    b.facilityLevels.wyvern_roost = 1;
    t.equal(BR.creatureRoom(b, bdata, 'wyvern_roost').housed, 1);
    t.equal(BR.fightingCreatures(b, bdata).length, 1);
  });

  group('Wyvern Roost: riding preparation (phase 3, 20 October 2026)');

  /* Elara's wyvern at a Level 5 Roost, Bond 4, party level 13, with 400 gp. */
  function rider() {
    var b = roost(5);
    b.partyLevel = 13;
    b.treasuryGP = 400;
    dev(b).bond.level = 4;
    return b;
  }

  test('the six orders: Levels 4 and 5, the approved days, the harness the only one with a cost (150 gp)', function (t) {
    var f = BR.facility(bdata, 'wyvern_roost');
    var rows = f.functions.filter(function (x) { return x.trains && x.requiredFacilityLevel >= 4; }).map(function (x) { return [x.id, x.days, x.requiredFacilityLevel, x.costGP]; });
    t.same(rows, [['wyr_riding_harness', 7, 4, 150], ['wyr_ascent_landing', 14, 4, 0], ['wyr_emergency_recall', 7, 4, 0], ['wyr_riders_pact', 14, 5, 0], ['wyr_elite_defence', 10, 5, 0], ['wyr_combat_signals', 14, 5, 0]]);
  });

  test('the harness: 150 gp once, taken when the order starts; too little gold refuses without a change; a second is refused; it stays through a reload and an upgrade', function (t) {
    var b = rider();
    b.treasuryGP = 149;
    var snap = JSON.stringify(BR.toSave(b));
    t.equal(train(b, 'wyr_riding_harness').message, 'Needs 150 gp; the treasury has 149 gp.');
    t.equal(JSON.stringify(BR.toSave(b)), snap, 'nothing changed');
    b.treasuryGP = 400;
    var r = train(b, 'wyr_riding_harness');
    t.equal(r.ok, true, r.message);
    t.same([b.treasuryGP, last(b).costGP, last(b).dueDay - last(b).issuedDay], [250, 150, 7]);
    t.ok(/already in a programme/.test(train(b, 'wyr_riding_harness').message), 'a pending harness can\'t be duplicated');
    b.day = last(b).dueDay;
    complete(b, last(b));
    t.same(dev(b).harness, { fitted: true, paidGP: 150, fittedDay: b.day });
    t.ok(/already completed Commission Riding Harness/.test(train(b, 'wyr_riding_harness').message), 'no second harness');
    t.equal(b.treasuryGP, 250, 'charged exactly once');
    b.facilityLevels.wyvern_roost = 4;
    t.same(reload(b).creatures[0].development.harness, dev(b).harness, 'kept through a reload and an upgrade');
  });

  test('a cancelled harness order is not refunded (the screen warns first)', function (t) {
    var b = rider();
    train(b, 'wyr_riding_harness');
    BR.cancelOrder(b, last(b).id, bdata);
    t.same([b.treasuryGP, dev(b).harness.fitted, b.pendingOrders.length], [250, false, 0]);
  });

  test('the flight programmes follow in order: Ascent & Landing needs the harness, Emergency Recall needs Ascent & Landing; each says what is missing', function (t) {
    var b = rider();
    t.equal(train(b, 'wyr_ascent_landing').message, 'Needs a fitted riding harness: Commission Riding Harness first.');
    t.equal(train(b, 'wyr_emergency_recall').message, 'Needs Controlled Ascent & Landing first.');
    finish(b, 'wyr_riding_harness');
    t.equal(train(b, 'wyr_emergency_recall').message, 'Needs Controlled Ascent & Landing first.');
    var a = finish(b, 'wyr_ascent_landing');
    t.ok(/not permission to mount yet/.test(a[0][1]), a[0][1]);
    finish(b, 'wyr_emergency_recall');
    t.same(Object.keys(dev(b).training).filter(function (k) { return /harness|ascent|recall/.test(k); }).sort(), ['wyr_ascent_landing', 'wyr_emergency_recall', 'wyr_riding_harness']);
    t.equal(dev(b).bond.ready, null, 'none of them moves the bond');
  });

  test('first flight: every check must hold (party level 13 included), and even then it waits for the DM; "rideable" is never said', function (t) {
    var b = rider();
    finish(b, 'wyr_riding_harness'); finish(b, 'wyr_ascent_landing'); finish(b, 'wyr_emergency_recall');
    var c = BR.creatureById(b, E);
    t.equal(BR.firstFlightReady(b, bdata, c), true);
    t.equal(BR.ridingLine(b, bdata, c), 'First flight ready, awaiting the DM\'s milestone.');
    b.partyLevel = 12;
    t.equal(BR.firstFlightReady(b, bdata, c), false, 'blocked at party level 12 with a Level 5 Roost and Bond 4');
    t.ok(/Party level 13 or higher \(it's 12\)/.test(BR.confirmFirstFlight(b, bdata, E, 'The sky was clear.').message));
    b.partyLevel = 13;
    t.equal(BR.confirmFirstFlight(b, bdata, E, '').ok, false, 'a reason is required');
    b.warRecovery = [{ id: 'r1', kind: 'creature', status: 'wounded', untilDay: 99, creatureId: E }];
    t.ok(/Not wounded or defending/.test(BR.confirmFirstFlight(b, bdata, E, 'The sky was clear.').message), 'not while wounded');
    b.warRecovery = [];
    b.facilityLevels.wyvern_roost = 3;
    t.equal(BR.firstFlightReady(b, bdata, c), false, 'the Roost must be Level 4 or more');
    b.facilityLevels.wyvern_roost = 5;
    var r = BR.confirmFirstFlight(b, bdata, E, 'Elara and the wyvern crossed the bay at dawn.');
    t.equal(r.ok, true, r.message);
    t.same([dev(b).firstFlight.approved, dev(b).firstFlight.handlerId, dev(b).firstFlight.day], [true, 'elara', b.day]);
    t.ok(/Mounted Flight Qualified/.test(BR.ridingLine(b, bdata, c)) && !/rideable/i.test(BR.ridingLine(b, bdata, c)));
    t.equal(BR.confirmFirstFlight(b, bdata, E, 'again please').ok, false, 'once');
    t.equal(reload(b).creatures[0].development.firstFlight.approved, true, 'kept through a reload');
  });

  test('the Rider\'s Pact needs the first flight (no circle: Bond 4 is enough for the flight); it makes Bond 5 READY, never raises it', function (t) {
    var b = rider();
    t.ok(/first mounted flight confirmed by the DM/.test(train(b, 'wyr_riders_pact').message), train(b, 'wyr_riders_pact').message);
    finish(b, 'wyr_riding_harness'); finish(b, 'wyr_ascent_landing'); finish(b, 'wyr_emergency_recall');
    BR.confirmFirstFlight(b, bdata, E, 'They flew.');
    var lines = finish(b, 'wyr_riders_pact');
    t.ok(/Bond 5 \(Legendary Partnership\) milestone is ready/.test(lines[0][1]), lines[0][1]);
    t.same([dev(b).bond.level, dev(b).bond.ready], [4, 5]);
    BR.confirmBond(b, bdata, E, 'Elara and her wyvern stood together against the storm.');
    t.same([dev(b).bond.level, dev(b).bond.ready], [5, null]);
    t.ok(/Elite Aerial Defence and Aerial Combat Signals/.test(BR.nextStepLine(b, bdata, BR.creatureById(b, E))));
  });

  test('Elite Aerial Defence needs Aerial Sentinel and gives +1 Attack; Aerial Combat Signals needs Bond 5 and the flight and adds nothing in battle', function (t) {
    var b = rider();
    t.equal(train(b, 'wyr_elite_defence').message, 'Needs Aerial Sentinel Training first.');
    finish(b, 'wyr_aerial_sentinel');
    var before = BR.creatureWar(bdata, BR.creatureById(b, E));
    finish(b, 'wyr_elite_defence');
    var after = BR.creatureWar(bdata, BR.creatureById(b, E));
    t.same([after.attack - (before.attack || 0), after.bv], [1, 11]);
    t.ok(/Needs Bond 5/.test(train(b, 'wyr_combat_signals').message), train(b, 'wyr_combat_signals').message);
    dev(b).bond.level = 5;
    t.ok(/first mounted flight confirmed/.test(train(b, 'wyr_combat_signals').message));
    dev(b).firstFlight = { approved: true, day: 1, handlerId: 'elara' };
    var w0 = JSON.stringify(BR.creatureWar(bdata, BR.creatureById(b, E)));
    finish(b, 'wyr_combat_signals');
    t.equal(JSON.stringify(BR.creatureWar(bdata, BR.creatureById(b, E))), w0, 'no new combat effect');
  });

  test('a new handler needs their own first flight; the old record stays in the Chronicle; a granted wyvern never inherits Elara\'s harness or flight', function (t) {
    var b = rider();
    finish(b, 'wyr_riding_harness'); finish(b, 'wyr_ascent_landing'); finish(b, 'wyr_emergency_recall');
    BR.confirmFirstFlight(b, bdata, E, 'They flew.');
    BR.assignHandler(b, bdata, E, 'Mira', 'Elara gave her up.');
    t.same([dev(b).firstFlight, dev(b).harness.fitted, dev(b).bond.level], [{ approved: false, day: null, handlerId: null }, true, 0]);
    t.ok(dev(b).chronicle.some(function (e) { return /first flight was confirmed for the earlier pairing/.test(e.text); }));
    b.facilityLevels.wyvern_roost = 5;
    var g = grantAndHouse(b, 1);
    t.same([BR.devView(b, g).harness.fitted, BR.devView(b, g).firstFlight.approved, BR.devView(b, g).bond.level], [false, false, 0]);
  });

  test('no mounted-flight, riding or expedition control exists: the profile says so and the orders only record', function (t) {
    var b = rider();
    var c = BR.creatureById(b, E);
    t.ok(/Not ready for a first flight yet/.test(BR.ridingLine(b, bdata, c)));
    t.ok(/Riding movement and mounted combat are not part of the Bastion yet/.test((function () { dev(b).firstFlight = { approved: true, day: 2, handlerId: 'elara' }; return BR.ridingLine(b, bdata, c); }())));
  });
}());
