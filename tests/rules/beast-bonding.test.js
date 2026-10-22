/* Griffin Tower and Dire Wolf Den: bonding, training and riding preparation
   (Harry's approvals of 21 October 2026, copying the Wyvern Roost's rules):
   the programmes in facilities-data.js, the same development record,
   bond, harness, first flight (or ride) and Defend Bastion bonuses
   (tools/bastion/creature-rules.js). The wyvern's own tests are in
   wyvern-bonding.test.js. */
(function () {
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };

  var seed = 0;
  function rnd() { seed += 0.0137; return seed % 1 || 0.5; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function reload(b) { return BR.fromSave(copy(BR.toSave(b)), bdata); }
  function last(b) { return b.pendingOrders[b.pendingOrders.length - 1]; }
  function complete(b, o) { var l = BR.completeSimpleOrder(b, bdata, o, rnd); BR.removeOrder(b, o.id); return l; }

  var KINDS = [
    { species: 'griffin', fac: 'griffin_tower', house: 'house_griffin', pre: 'grf', ride: 'flight', noun: 'griffin', base: { resolve: 1, defence: 12, attack: 5, bv: 8 },
      ids: { recall: 'signal_recall', ret: 'open_sky_return', sentinel: 'aerial_sentinel', ascent: 'ascent_landing', pact: 'riders_pact' } },
    { species: 'dire_wolf', fac: 'dire_wolf_den', house: 'house_dire_wolf', pre: 'dwf', ride: 'ride', noun: 'dire wolf', base: { resolve: 1, defence: 12, attack: 5, bv: 7 },
      ids: { recall: 'heel_recall', ret: 'roaming_return', sentinel: 'pack_sentinel', ascent: 'steady_gait', pact: 'riders_oath' } }
  ];

  KINDS.forEach(function (K) {
    function P(n) { return K.pre + '_' + n; }
    function id(role) { return P(K.ids[role]); }
    /* A Bastion with the building at a level and one granted, housed creature. */
    function house(level, grants) {
      var b = BR.defaultState(bdata);
      b.day = 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 400;
      b.builtExtras = [{ facId: K.fac, status: 'built' }];
      BR.ensureLevels(b, bdata);
      b.facilityLevels[K.fac] = level || 1;
      var out = [];
      for (var n = 1; n <= (grants || 1); n++) {
        var gid = K.pre + n + '-0a0b0c0d:dm:0';
        BR.applyInbox(b, bdata, { travel: { day: b.day }, journey: { outbox: [{ id: gid, type: 'creature', day: b.day, at: '2026-10-21T10:00:00.000Z', from: { code: 'DM', title: 'DM', step: 'dm' }, species: K.species, name: 'Beast' + n, text: 'Granted' }] } }, 1000);
        var r = BR.issueOrder(b, bdata, K.fac, K.house, 0, rnd);
        if (!r.ok) throw new Error(r.message);
        complete(b, last(b));
        out.push(BR.creatureById(b, BR.creatureIdFor(gid)));
      }
      b.beasts = out;
      return b;
    }
    function train(b, fn, idx) { return BR.issueOrder(b, bdata, K.fac, fn, idx || 0, rnd); }
    function finish(b, fn, idx) {
      var r = train(b, fn, idx);
      if (!r.ok) throw new Error(fn + ': ' + r.message);
      var o = last(b);
      b.day = o.dueDay;
      return complete(b, o);
    }
    function dev(c) { return c.development; }
    function ready(b, level) { var c = b.beasts[0]; BR.assignHandler(b, bdata, c.id, 'Mira', ''); BR.creatureDev(c).bond.level = level; return c; }

    group(K.noun.charAt(0).toUpperCase() + K.noun.slice(1) + ' bonding, training and riding (21 October 2026)');

    test(K.noun + ': twelve free programmes with the approved days and levels; only the harness costs (150 gp); the House order is unchanged', function (t) {
      var f = BR.facility(bdata, K.fac);
      var rows = f.functions.filter(function (x) { return x.trains; });
      t.same(rows.map(function (x) { return [x.days, x.requiredFacilityLevel, x.costGP]; }),
        [[5, 1, 0], [7, 1, 0], [7, 2, 0], [7, 2, 0], [10, 3, 0], [7, 3, 0], [7, 4, 150], [14, 4, 0], [7, 4, 0], [14, 5, 0], [10, 5, 0], [14, 5, 0]]);
      t.equal(rows.every(function (x) { return x.id.indexOf(K.pre + '_') === 0; }), true, 'its own programme ids');
      t.same(f.functions.filter(function (x) { return !x.trains; }).map(function (x) { return [x.id, x.days, x.costGP]; }), [[K.house, 3, 0]]);
    });

    test(K.noun + ': a granted ' + K.noun + ' starts at Bond 0 with no handler and no development; the room is one for each level, as before', function (t) {
      var b = house(1);
      var c = b.beasts[0];
      t.equal(c.development, undefined);
      t.same([BR.devView(b, c).bond.level, BR.devView(b, c).handlerId], [0, '']);
      t.same([1, 2, 3, 4, 5].map(function (l) { b.facilityLevels[K.fac] = l; return BR.creatureRoom(b, bdata, K.fac).capacity; }), [1, 2, 3, 4, 5]);
      t.same([1, 2, 3, 4, 5].map(function (l) { b.facilityLevels[K.fac] = l; return BR.trainingPlaces(b, bdata, K.fac).cap; }), [1, 1, 2, 2, 3]);
    });

    test(K.noun + ': Safe Acclimatisation needs a handler; finishing it makes Bond 1 READY (never raises it); the DM confirms with a reason', function (t) {
      var b = house(1);
      var c = b.beasts[0];
      t.ok(/has no handler yet/.test(train(b, P('safe_acclimatisation')).message), train(b, P('safe_acclimatisation')).message);
      t.equal(BR.assignHandler(b, bdata, c.id, 'Mira', '').ok, true);
      var r = train(b, P('safe_acclimatisation'));
      t.equal(r.ok, true, r.message);
      t.same([last(b).dueDay - last(b).issuedDay, b.treasuryGP], [5, 400]);
      b.day = last(b).dueDay;
      var lines = complete(b, last(b));
      t.ok(/Bond 1 \(Acclimatised\) milestone is ready/.test(lines[0][1]), lines[0][1]);
      t.same([dev(c).bond.level, dev(c).bond.ready], [0, 1]);
      t.equal(BR.confirmBond(b, bdata, c.id, '').ok, false);
      t.equal(BR.confirmBond(b, bdata, c.id, 'It took food from the handler\'s hand.').ok, true);
      t.same([dev(c).bond.level, dev(c).bond.ready], [1, null]);
    });

    test(K.noun + ': the riding preparation, step by step, with the exact reasons: harness 150 gp once, then the two programmes, then the first ' + K.ride + ' at party level 13', function (t) {
      var b = house(5);
      var c = ready(b, 4);
      b.partyLevel = 12;
      t.ok(/Needs a fitted riding harness/.test(train(b, id('ascent')).message), train(b, id('ascent')).message);
      b.treasuryGP = 149;
      t.equal(train(b, P('riding_harness')).message, 'Needs 150 gp; the treasury has 149 gp.');
      b.treasuryGP = 400;
      t.equal(train(b, P('riding_harness')).ok, true);
      t.same([b.treasuryGP, last(b).costGP], [250, 150]);
      b.day = last(b).dueDay;
      complete(b, last(b));
      t.same(dev(c).harness, { fitted: true, paidGP: 150, fittedDay: b.day });
      t.ok(/already completed/.test(train(b, P('riding_harness')).message), 'no second harness');
      finish(b, id('ascent'));
      finish(b, P('emergency_recall'));
      t.equal(BR.firstFlightReady(b, bdata, c), false, 'party level 12 is not enough');
      t.ok(/Party level 13 or higher \(it's 12\)/.test(BR.confirmFirstFlight(b, bdata, c.id, 'The sky was clear.').message));
      b.partyLevel = 13;
      t.equal(BR.ridingLine(b, bdata, c), 'First ' + K.ride + ' ready, awaiting the DM\'s milestone.');
      var r = BR.confirmFirstFlight(b, bdata, c.id, 'They went out together at dawn.');
      t.equal(r.ok, true, r.message);
      t.ok(/Mounted /.test(BR.ridingLine(b, bdata, c)) && /story permission/.test(BR.ridingLine(b, bdata, c)) && !/rideable/i.test(BR.ridingLine(b, bdata, c)));
      t.ok(new RegExp('first mounted ' + K.ride, 'i').test(dev(c).chronicle[dev(c).chronicle.length - 1].text));
    });

    test(K.noun + ': the Rider\'s pact needs the first ' + K.ride + ' and makes Bond 5 READY; Bond 5 then opens the signals programme', function (t) {
      var b = house(5);
      var c = ready(b, 4);
      b.partyLevel = 13;
      t.ok(new RegExp('first mounted ' + K.ride + ' confirmed by the DM').test(train(b, id('pact')).message), train(b, id('pact')).message);
      finish(b, P('riding_harness')); finish(b, id('ascent')); finish(b, P('emergency_recall'));
      BR.confirmFirstFlight(b, bdata, c.id, 'They went out.');
      var lines = finish(b, id('pact'));
      t.ok(/Bond 5 \(Legendary Partnership\) milestone is ready/.test(lines[0][1]), lines[0][1]);
      t.same([dev(c).bond.level, dev(c).bond.ready], [4, 5]);
      BR.confirmBond(b, bdata, c.id, 'A shared act of trust.');
      t.equal(dev(c).bond.level, 5);
      var w0 = JSON.stringify(BR.creatureWar(bdata, c));
      finish(b, P('combat_signals'));
      t.equal(JSON.stringify(BR.creatureWar(bdata, c)), w0, 'the signals add nothing in battle');
    });

    test(K.noun + ': the three disciplines give +1 Resolve, +1 Defence and +1 Attack to that one creature only; Battle Value stays ' + K.base.bv, function (t) {
      var b = house(5, 2);
      var c = ready(b, 4);
      var other = b.beasts[1];
      var w = BR.creatureWar(bdata, c);
      t.same([w.resolve, w.defence, w.attack, w.bv], [K.base.resolve, K.base.defence, K.base.attack, K.base.bv]);
      finish(b, P('defence_drills'));
      finish(b, id('sentinel'));
      finish(b, P('elite_defence'));
      var w2 = BR.creatureWar(bdata, c);
      t.same([w2.resolve, w2.defence, w2.attack, w2.bv, w2.trained.length], [K.base.resolve + 1, K.base.defence + 1, K.base.attack + 1, K.base.bv, 3]);
      var wo = BR.creatureWar(bdata, other);
      t.same([wo.resolve, wo.defence, wo.attack], [K.base.resolve, K.base.defence, K.base.attack], 'the other creature is unchanged');
      t.equal(T.bastionCreatures.species[K.species].war.resolve, K.base.resolve, 'the species data is unchanged');
    });

    test(K.noun + ': one programme at a time for each creature; two creatures share the building\'s places; each programme once; a handler change starts a new pairing', function (t) {
      var b = house(3, 2);
      var a = b.beasts[0], z = b.beasts[1];
      BR.assignHandler(b, bdata, a.id, 'Mira', ''); BR.assignHandler(b, bdata, z.id, 'Tomas', '');
      t.equal(train(b, P('safe_acclimatisation'), 0).ok, true);
      t.ok(/already in a programme/.test(train(b, P('keeper_routine'), 0).message));
      t.equal(train(b, P('safe_acclimatisation'), 1).ok, true, 'the other creature has its own place (Level 3: 2)');
      b.facilityLevels[K.fac] = 1;
      b.day = last(b).dueDay;
      var o = b.pendingOrders[0];
      b.day = Math.max(b.day, o.dueDay);
      complete(b, b.pendingOrders[0]);
      BR.creatureDev(a).bond.level = 3;
      BR.assignHandler(b, bdata, a.id, 'Joss', 'Mira left the Ironbow.');
      t.same([dev(a).handlerId, dev(a).bond.level, dev(a).handlerHistory.length], ['Joss', 0, 1]);
    });

    test(K.noun + ': everything survives a save, a reload, an export and an import, and loading twice changes nothing', function (t) {
      var b = house(5);
      var c = ready(b, 4);
      b.partyLevel = 13;
      finish(b, P('riding_harness')); finish(b, id('ascent')); finish(b, P('emergency_recall'));
      BR.confirmFirstFlight(b, bdata, c.id, 'They went out.');
      BR.setTemperament(b, bdata, c.id, { dominant: 'Bold', attachment: 'Warm', trigger: 'Thunder' });
      var before = copy(dev(c));
      var back = reload(b);
      var bc = BR.creatureById(back, c.id);
      t.same(dev(bc), before);
      t.same(BR.creatureById(BR.fromSave(JSON.parse(JSON.stringify(BR.toSave(back))), bdata), c.id).development, before, 'export and import');
      t.equal(JSON.stringify(BR.toSave(reload(back))), JSON.stringify(BR.toSave(back)), 'the same JSON twice');
    });

    test(K.noun + ': recovering from a battle pauses a programme without losing days', function (t) {
      var b = house(2);
      var c = ready(b, 2);
      train(b, P('defence_drills'));
      var o = last(b);
      var due = o.dueDay;
      b.warRecovery = [{ id: 'r1', kind: 'creature', status: 'wounded', untilDay: 99, creatureId: c.id }];
      b.day = 11; BR.tickTraining(b, bdata); BR.tickTraining(b, bdata);
      b.day = 12; BR.tickTraining(b, bdata);
      t.equal(o.dueDay, due + 2, 'two recovering days, two days added, once each');
      t.equal(BR.trainingStatus(b, bdata, c).kind, 'paused');
    });

    test(K.noun + ': the next step is always one plain line', function (t) {
      var b = house(1);
      var c = b.beasts[0];
      t.ok(/Assign a handler, then Safe Acclimatisation/.test(BR.nextStepLine(b, bdata, c)), BR.nextStepLine(b, bdata, c));
      BR.assignHandler(b, bdata, c.id, 'Mira', '');
      t.ok(/Safe Acclimatisation \(Level 1, 5 days\) prepares Bond 1/.test(BR.nextStepLine(b, bdata, c)));
      BR.creatureDev(c).bond.level = 4;
      t.ok(/Next for riding: Commission Riding Harness \(Level 4, 7 days, 150 gp\)/.test(BR.nextStepLine(b, bdata, c)), BR.nextStepLine(b, bdata, c));
    });
  });

  group('Griffins, dire wolves and wyverns stay separate (21 October 2026)');

  test('a wyvern programme can\'t be given to a griffin, and each building trains only its own kind', function (t) {
    var b = BR.defaultState(bdata);
    b.day = 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 400;
    b.builtExtras = [{ facId: 'griffin_tower', status: 'built' }, { facId: 'dire_wolf_den', status: 'built' }];
    BR.ensureLevels(b, bdata);
    var tower = BR.facility(bdata, 'griffin_tower');
    var den = BR.facility(bdata, 'dire_wolf_den');
    t.same([BR.fnSpecies(bdata, tower, tower.functions[1]), BR.fnSpecies(bdata, den, den.functions[1]), BR.fnSpecies(bdata, BR.facility(bdata, 'wyvern_roost'), BR.facility(bdata, 'wyvern_roost').functions[2])], ['griffin', 'dire_wolf', 'wyvern']);
    t.same([BR.rideNoun(bdata, 'wyvern'), BR.rideNoun(bdata, 'griffin'), BR.rideNoun(bdata, 'dire_wolf')], ['flight', 'flight', 'ride']);
    t.equal(BR.hasDevelopment(bdata, 'griffin') && BR.hasDevelopment(bdata, 'dire_wolf') && BR.hasDevelopment(bdata, 'wyvern'), true);
    t.equal(BR.hasDevelopment(bdata, 'phoenix'), false, 'a kind this copy doesn\'t know has none');
  });
}());
