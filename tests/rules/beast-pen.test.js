/* The Beast Pen and day-by-day bonding (Strip Back Overhaul, steps S14 and S15, 22 October 2026; Harry's decisions in
   docs/STRIP-BACK-PLAN.md, the design in docs/strip-back/G-beastpit-bonding.md): the building and its data, one beast of
   each kind, Acclimatise With Beast, taking a beast out on the road and back, the Bonding Days counted by R.startDay,
   the milestones the DM confirms, the saved fields and Reset Travel, and the conversion that turns the Wyvern Roost,
   Griffin Tower and Dire Wolf Den into the one Pen (step rehomeBeasts). The code is tools/bastion/creature-rules.js,
   rules.js and strip-back-rules.js. */
(function () {
  var BR = TSI.bastion.rules;
  var Bg = TSI.bridge;
  var T = window.TSI_DATA;
  var CR = T.bastionCreatures;
  var FIX = window.TSI_FIXTURES || {};
  var canon = BR.stripBackCanon;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var PEN = 'beast_pen';

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function reload(b, data) { return BR.fromSave(copy(BR.toSave(b)), data || bdata); }
  /* A Bastion on a day that has read the Explorer's day, at party level 9, with the given facilities built. */
  function bastion(day, built) {
    var b = BR.defaultState(bdata);
    b.day = day || 10;
    b.anchored = true;
    b.bridge.fresh = false;
    b.partyLevel = 9;
    b.treasuryGP = 300;
    b.builtExtras = (built || []).map(function (id) { return { facId: id, status: 'built' }; });
    BR.ensureLevels(b, bdata);
    return b;
  }
  function withPen(day) { return bastion(day, [PEN]); }
  function exWith(list, day) { return { travel: { day: day || 10 }, journey: { outbox: list } }; }
  function gid(n) { return 'grant' + n + '-0a0b0c0d:dm:0'; }
  function grantMsg(over) {
    return Object.assign({
      id: gid(1), type: 'creature', day: 5, at: '2026-10-14T10:00:00.000Z',
      from: { code: 'DM', title: 'DM award', step: 'dm' }, species: 'griffin', name: 'Swiftwing', text: 'Griffin for the Ironbow (Swiftwing).'
    }, over || {});
  }
  function grant(b, n, species, name) {
    BR.applyInbox(b, bdata, exWith([grantMsg({ id: gid(n), species: species, name: name === undefined ? '' : name })], b.day), 1000);
    return BR.creatureIdFor(gid(n));
  }
  function issueHouse(b, idx) { return BR.issueOrder(b, bdata, PEN, 'house_beast', idx || 0, dice([0.3])); }
  function lastOrder(b) { return b.pendingOrders[b.pendingOrders.length - 1]; }
  function complete(b, o) {
    var lines = BR.completeSimpleOrder(b, bdata, o, dice([0.5]));
    BR.removeOrder(b, o.id);
    return lines;
  }
  /* A beast granted and housed at the Pen. */
  function housed(b, n, species, name) {
    var id = grant(b, n, species, name);
    var fac = BR.facility(bdata, PEN);
    var idx = BR.fnOptions(b, bdata, fac, fac.functions[0]).map(function (o) { return o.creatureId; }).indexOf(id);
    var r = issueHouse(b, idx);
    if (!r.ok) throw new Error(r.message);
    complete(b, lastOrder(b));
    return id;
  }
  /* A housed beast with a handler, acclimatised (Bond 1 by the roll). */
  function acclimatised(b, n, species, name, handler) {
    var id = housed(b, n, species, name);
    var h = BR.assignHandler(b, bdata, id, handler || 'Mira', '');
    if (!h.ok) throw new Error(h.message);
    var r = BR.acclimatise(b, bdata, id, 22, { rand: dice([0.5]) });
    if (!r.ok) throw new Error(r.message);
    return id;
  }
  function passDay(b) { BR.startDay(b, bdata, 0); BR.finishDay(b); }
  function passDays(b, n) { for (var i = 0; i < n; i++) passDay(b); }
  function dev(b, id) { return BR.creatureById(b, id).development; }
  function names(list) { return list.map(function (c) { return BR.creatureName(bdata, c); }); }

  /* ---------------------------------------------------------------- */
  group('Beast Pen: the building and its data (Harry, 22 October 2026)');

  test('one building replaces the three: party level 5, a construction slot, 21 days, one level, two orders; the old three are gone', function (t) {
    var f = BR.facility(bdata, PEN);
    t.same([f.name, f.requiredLevel, f.singleLevel, f.inDevelopment, f.plot, typeof f.description], ['Beast Pen', 5, true, undefined, undefined, 'string']);
    t.same(f.functions.map(function (fn) { return [fn.id, fn.label]; }), [['house_beast', 'House Beast Here'], ['acclimatise', 'Acclimatise With Beast']]);
    var house = f.functions[0];
    t.same([house.days, house.costGP, house.costText, house.housesSpecies, house.options], [CR.houseDays, 0, '0', '*', []], 'House Beast Here: 3 days, no gold, any kind');
    t.same([f.functions[1].acclimatise, f.functions[1].instant, f.functions[1].costGP], [true, true, 0], 'Acclimatise With Beast is a roll at once, not an order with days');
    ['wyvern_roost', 'griffin_tower', 'dire_wolf_den'].forEach(function (id) { t.equal(BR.facility(bdata, id), null, id + ' is gone from the catalogue'); });
    t.equal(bdata.facilities.length, 15, 'fifteen facilities: the Pen replaced three, and the war game\'s five (S06) are gone');
    t.equal(BR.isPlotFacility(bdata, PEN), false, 'it takes a construction slot');
    t.equal(BR.buildDaysForRequiredLevel(5, bdata), 21);
    var b = bastion(10);
    b.partyLevel = 4;
    t.equal(BR.startBuild(b, bdata, 0, PEN).message, 'Locked. Beast Pen requires party level 5.');
    b.partyLevel = 5;
    t.same(BR.startBuild(b, bdata, 0, PEN, 'slot').log, ['Construction Started', 'Beast Pen is under construction (21 days: ready on Day 31).']);
    t.same(b.creatures, [], 'building it never creates a beast');
    b.day = 31;
    t.same(BR.completeConstruction(b), [PEN]);
    t.same(b.creatures, [], 'nor does finishing it');
    t.equal(BR.compendiumIndex(bdata.facilities, bdata.tools).items.length, 250, 'its orders add nothing to the Compendium');
  });

  test('one level only: no Upgrade, no unlock lines, and the facility panel says so', function (t) {
    var b = withPen();
    var c = BR.upgradeCheck(b, bdata, PEN);
    t.same([c.ok, c.top, c.single, c.message], [false, true, true, 'The Beast Pen has one level only.']);
    t.same(BR.issueUpgrade(b, bdata, PEN, dice([0.3])).ok, false);
    t.same(b.pendingOrders, []);
    t.equal(BR.getFacilityLevel(b, PEN), 1);
    var label = BR.mapLabels(b, bdata).filter(function (l) { return l.fac === PEN; })[0];
    t.equal(label.single, true, 'its map label says "One level"');
  });

  test('its pictures: the card shows the Menagerie\'s painting, the map its overlay and label, and Harry\'s picture spans the top of the panel', function (t) {
    var B = T.bastion;
    t.equal(B.facilityImages[PEN], 'menagerie.png');
    t.equal(B.panelImages[PEN], 'beast_pen.jpg');
    t.same(B.map.overlays.filter(function (o) { return o.fac === PEN; }), [{ fac: PEN, pic: 'map/overlays/wyvern_roost.png' }], 'the Menagerie never had a map picture, so the map reuses the Wyvern Roost\'s building');
    t.same(B.mapLabels[PEN], { x: 2081, y: 326 });
    ['wyvern_roost', 'griffin_tower', 'dire_wolf_den'].forEach(function (id) {
      t.equal(B.mapLabels[id], undefined, id + ' has no map label');
      t.equal(B.facilityTileCrops[id], undefined, id + ' has no tile crop');
      t.equal(B.levelEffects[id], undefined, id + ' has no level effects');
      t.equal(B.map.overlays.some(function (o) { return o.fac === id; }), false, id + ' is not on the map');
    });
  });

  /* ---------------------------------------------------------------- */
  group('Beast Pen: House Beast Here keeps one beast of each kind');

  test('the order lists the beasts waiting (a named one with its kind), the order keeps the beast chosen, and it is housed once', function (t) {
    var b = withPen();
    var fac = BR.facility(bdata, PEN);
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[0]), []);
    t.equal(issueHouse(b).message, 'No beast is waiting for a home. The DM grants one in the Explorer.');
    var g = grant(b, 1, 'griffin', 'Swiftwing');
    var w = grant(b, 2, 'wyvern', '');
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[0]), [{ label: 'Swiftwing (Griffin)', creatureId: g }, { label: 'Wyvern (granted Day 5)', creatureId: w }]);
    var gp = b.treasuryGP;
    var r = issueHouse(b, 0);
    t.same(r, { ok: true, log: ['Order Issued', 'Beast Pen: House Beast Here (Swiftwing) (3 days: due Day 13).'] });
    var o = lastOrder(b);
    t.same([o.facId, o.fnId, o.chosen, o.optionLabel, o.label, o.costGP, o.dueDay, b.treasuryGP], [PEN, 'house_beast', { label: 'Swiftwing', creatureId: g }, 'Swiftwing', 'Beast Pen: House Beast Here (Swiftwing)', 0, 13, gp]);
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[0]).map(function (x) { return x.label; }), ['Wyvern (granted Day 5)'], 'the griffin is held by the order');
    t.equal(BR.penStatus(b, bdata, BR.creatureById(b, g)).line, 'Being housed at the Beast Pen: ready on Day 13.');
    b.day = 13;
    t.same(complete(b, o), [['Order Completed', 'Beast Pen: House Beast Here (Swiftwing) → Swiftwing has a home at the Beast Pen. Acclimatise it with its handler (Acclimatise With Beast) before it can go out on the road.']]);
    var c = BR.creatureById(b, g);
    t.same([c.status, c.home, c.housedDay, c.grantedDay], ['housed', PEN, 13, 5]);
    t.same(BR.completeSimpleOrder(b, bdata, o, dice([0.5])), [['Creatures', 'Beast Pen: House Beast Here (Swiftwing): Swiftwing already has a home at the Beast Pen, so nothing changed.']], 'a replay changes nothing');
    t.equal(BR.penStatus(b, bdata, c).line, 'At the Beast Pen. Not acclimatised yet');
  });

  test('one of each kind: a second of a kind waits, even beside a pending order for that kind; another kind is fine; several orders can run at once', function (t) {
    var b = withPen();
    var g1 = grant(b, 1, 'griffin', 'Swiftwing');
    var g2 = grant(b, 2, 'griffin', 'Talon');
    var w = grant(b, 3, 'wyvern', 'Ash');
    t.equal(issueHouse(b, 0).ok, true, 'Swiftwing');
    var again = BR.issueOrder(b, bdata, PEN, 'house_beast', 0, dice([0.3]));
    t.equal(again.ok, false, 'the options now are Talon and Ash: index 0 is Talon, whose kind is full');
    t.equal(again.message, 'The Beast Pen keeps one griffin at a time: one is being housed (ready on Day 13).');
    t.equal(BR.issueOrder(b, bdata, PEN, 'house_beast', 1, dice([0.3])).ok, true, 'a wyvern can be housed at the same time');
    t.equal(b.pendingOrders.length, 2, 'two House orders at once');
    t.same(BR.penRoom(b, bdata, 'griffin'), { species: 'griffin', perKind: 1, housed: [], pending: [b.pendingOrders[0]], free: 0, over: 0 });
    b.pendingOrders.forEach(function (o) { complete(b, o); });
    t.same(names(BR.penHoused(b)), ['Swiftwing', 'Ash']);
    var why = BR.housingBlocker(b, bdata, BR.facility(bdata, PEN), BR.fn(BR.facility(bdata, PEN), 'house_beast'), g2);
    t.equal(why, 'The Beast Pen keeps one griffin at a time: Swiftwing lives here.');
    t.equal(issueHouse(b, 0).message, why, 'the order says the same');
    var room = BR.penSummary(b, bdata);
    t.same(room.map(function (k) { return [k.species, k.housed.length, k.waiting.length, k.free]; }), [['wyvern', 1, 0, 0], ['griffin', 1, 1, 0], ['dire_wolf', 0, 0, 1], ['buckbear', 0, 0, 1], ['fellcat', 0, 0, 1]]);
    t.equal(BR.creatureById(b, g2).status, 'waiting', 'Talon keeps waiting: nothing is ever sent away');
    t.equal(BR.creatureById(b, g1).status, 'housed');
  });

  test('every one of the five kinds can be housed, one each, and a beast waiting is never released by the limit', function (t) {
    var b = withPen();
    ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat'].forEach(function (k, i) { housed(b, i + 1, k, 'B' + k); });
    t.same(BR.penHoused(b).map(function (c) { return c.species; }), ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat']);
    t.same(BR.penSummary(b, bdata).map(function (k) { return k.free; }), [0, 0, 0, 0, 0]);
    grant(b, 9, 'fellcat', 'Second');
    t.equal(issueHouse(b, 0).ok, false);
    t.equal(BR.creatures(b).length, 6);
  });

  test('beasts already housed stay: two of a kind (an older save) all stay and only block a third; nothing is evicted by a reload', function (t) {
    var b = withPen();
    [1, 2].forEach(function (n) {
      b.creatures.push({ id: 'old' + n, species: 'griffin', owner: '', name: 'G' + n, status: 'housed', home: PEN, grantedDay: 1, housedDay: 2, msgId: '' });
    });
    var room = BR.penRoom(b, bdata, 'griffin');
    t.same([room.housed.length, room.free, room.over], [2, 0, 1]);
    var back = reload(b);
    t.same(names(BR.penHoused(back)), ['G1', 'G2'], 'both stay after a reload');
    grant(b, 3, 'griffin', 'Third');
    t.equal(issueHouse(b, 0).message, 'The Beast Pen keeps one griffin at a time: G1 lives here.');
    t.equal(BR.penSummary(b, bdata).filter(function (k) { return k.species === 'griffin'; })[0].over, 1);
    t.same(BR.penDemolishBlocker(b, bdata, PEN), 'The Beast Pen can\'t be demolished while 2 beasts live in it: there is nowhere else for them to go.');
  });

  test('refused while the Pen isn\'t built, is being built or is Under Repair; a creature gone by completion changes nothing', function (t) {
    var b = bastion(10);
    grant(b, 1, 'griffin', 'Swiftwing');
    t.equal(issueHouse(b).message, 'The Beast Pen isn\'t built yet.');
    b.builtExtras = [{ facId: PEN, status: 'building', startDay: 1, readyDay: 22 }];
    t.equal(issueHouse(b).message, 'The Beast Pen isn\'t built yet.', 'nor while it\'s being built');
    b = withPen();
    grant(b, 1, 'griffin', 'Swiftwing');
    b.repairs = { beast_pen: 12 };
    t.equal(issueHouse(b).message, 'The Beast Pen is Under Repair until Day 12.');
    b.repairs = {};
    t.equal(issueHouse(b).ok, true);
    var o = lastOrder(b);
    b.creatures = [];
    t.same(complete(b, o), [['Creatures', 'Beast Pen: House Beast Here (Swiftwing): that beast isn\'t held any more, so nothing changed.']]);
    t.same(b.creatures, []);
  });

  test('Cancel gives nothing back and the beast keeps waiting; renaming a waiting beast changes its order\'s label', function (t) {
    var b = withPen();
    var id = grant(b, 1, 'griffin', 'Swiftwing');
    issueHouse(b);
    var o = lastOrder(b);
    BR.renameCreature(b, bdata, id, 'Stormcrest');
    t.ok(/\(Stormcrest\)/.test(o.label) && o.optionLabel === 'Stormcrest', o.label);
    var gp = b.treasuryGP;
    BR.cancelOrder(b, o.id, bdata, 0);
    t.same([b.treasuryGP, BR.creatureById(b, id).status, b.pendingOrders], [gp, 'waiting', []]);
    t.equal(issueHouse(b).ok, true, 'given again');
  });

  test('nothing makes Elara\'s wyvern now: a new Bastion has no beast, and no order offers her; an order that was already waiting still records her, once, if there is room', function (t) {
    var b = withPen();
    t.same(b.creatures, []);
    var fac = BR.facility(bdata, PEN);
    t.equal(fac.functions.filter(function (fn) { return fn.housesCreature; }).length, 0, 'no order houses a story beast');
    /* An order moved from the Roost: House Elara's Wyvern. */
    var order = { id: 'e1', facId: PEN, fnId: 'house_beast', chosen: { creatureId: 'elara_wyvern' }, optionLabel: 'Elara\'s wyvern', notes: '', label: 'Beast Pen: House Beast Here (Elara\'s wyvern)', costGP: 0, issuedDay: 10, dueDay: 13 };
    b.pendingOrders.push(order);
    b.day = 13;
    var lines = BR.completeSimpleOrder(b, bdata, order, dice([0.5]));
    t.same(lines, [['Order Completed', 'Beast Pen: House Beast Here (Elara\'s wyvern) → Elara\'s wyvern lives at the Ironbow now, at the Beast Pen (Elara\'s).']]);
    t.same([b.creatures[0].id, b.creatures[0].home, b.creatures[0].development.bond.level, b.creatures[0].development.handlerId], ['elara_wyvern', PEN, 1, 'elara'], 'she keeps her Bond 1 and her handler');
    t.same(BR.completeSimpleOrder(b, bdata, order, dice([0.5])), [['Creatures', 'Beast Pen: House Beast Here (Elara\'s wyvern): Elara\'s wyvern already has a home at the Beast Pen, so nothing changed.']], 'once');
    /* With a wyvern already housed, there is no room. */
    var c = withPen();
    housed(c, 1, 'wyvern', 'Ash');
    c.pendingOrders.push(copy(order));
    var again = BR.completeSimpleOrder(c, bdata, c.pendingOrders[0], dice([0.5]));
    t.same(again, [['Creatures', 'Beast Pen: House Beast Here (Elara\'s wyvern): the Beast Pen keeps one wyvern and Ash lives here, so nothing changed.']]);
    t.equal(c.creatures.length, 1);
  });

  test('a House order from before (up to three side by side) never overfills the Pen: the beast keeps waiting and the log says so', function (t) {
    var b = withPen();
    var a = grant(b, 1, 'wyvern', 'Ash');
    var s2 = grant(b, 2, 'wyvern', 'Skyrender');
    [a, s2].forEach(function (id, i) {
      b.pendingOrders.push({ id: 'o' + i, facId: PEN, fnId: 'house_beast', chosen: { label: 'x', creatureId: id }, optionLabel: 'x', notes: '', label: 'Beast Pen: House Beast Here (x)', costGP: 0, issuedDay: 10, dueDay: 13 });
    });
    t.same(complete(b, b.pendingOrders[0])[0][0], 'Order Completed');
    var second = complete(b, b.pendingOrders[0]);
    t.same(second, [['Creatures', 'Beast Pen: House Beast Here (x): the Beast Pen keeps one wyvern and Ash lives here, so Skyrender keeps waiting for a home.']]);
    t.same([BR.creatureById(b, a).status, BR.creatureById(b, s2).status], ['housed', 'waiting']);
  });

  test('Demolish: refused while any beast lives in the Pen (and while it is being built with beasts in it); allowed when it is empty, cancelling a waiting order', function (t) {
    var b = withPen();
    housed(b, 1, 'griffin', 'Swiftwing');
    var res = BR.demolishFacility(b, bdata, PEN);
    t.same([res.ok, res.message], [false, 'The Beast Pen can\'t be demolished while a beast lives in it: there is nowhere else for it to go.']);
    t.equal(BR.builtFacilityIds(b, bdata).indexOf(PEN) !== -1, true, 'still standing');
    var c = withPen();
    grant(c, 1, 'griffin', 'Swiftwing');
    issueHouse(c);
    var ok = BR.demolishFacility(c, bdata, PEN);
    t.same([ok.ok, ok.cancelled.length, c.pendingOrders.length, c.creatures[0].status], [true, 1, 0, 'waiting'], 'the order is cancelled and the griffin keeps waiting');
  });

  /* ---------------------------------------------------------------- */
  group('Beast Pen: Acclimatise With Beast (Harry, 22 October 2026)');

  test('it lists every housed beast still at Bond 0 with its handler, and says why one can\'t be rolled for', function (t) {
    var b = withPen();
    var g = housed(b, 1, 'griffin', 'Swiftwing');
    var w = housed(b, 2, 'wyvern', 'Ash');
    BR.assignHandler(b, bdata, w, 'Mira', '');
    grant(b, 3, 'dire_wolf', '');
    var fac = BR.facility(bdata, PEN);
    var opts = BR.fnOptions(b, bdata, fac, fac.functions[1]);
    t.same(opts.map(function (o) { return [o.label, o.creatureId, o.blocked]; }), [
      ['Swiftwing (Griffin): needs a handler', g, 'needs a handler'],
      ['Ash (Wyvern), handler Mira', w, '']
    ], 'only housed beasts at Bond 0; the one still waiting for a home is not listed');
    t.equal(BR.acclimatiseBlocker(b, bdata, g, {}), 'Swiftwing has no handler yet. Assign one first.');
    t.equal(BR.acclimatiseBlocker(b, bdata, w, {}), '');
    t.equal(BR.acclimatiseBlocker(b, bdata, BR.creatureIdFor(gid(3)), {}), 'Dire Wolf (granted Day 5) has no home at the Beast Pen yet.');
    t.equal(BR.acclimatiseBlocker(b, bdata, 'nobody', {}), 'That beast isn\'t at the Ironbow any more.');
    b.builtExtras = [];
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[1]), [], 'nothing to list with no Pen standing');
    t.equal(BR.acclimatiseBlocker(b, bdata, w, {}), 'The Beast Pen isn\'t built yet.');
  });

  test('it is an instant roll, never an order: Issue Order refuses it and nothing is added', function (t) {
    var b = withPen();
    var id = housed(b, 1, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, id, 'Mira', '');
    var r = BR.issueOrder(b, bdata, PEN, 'acclimatise', 0, dice([0.3]));
    t.equal(r.ok, false);
    t.ok(/rolled at the table/.test(r.message), r.message);
    t.same(b.pendingOrders, []);
  });

  test('a pass (the DC is 20 for every kind) makes Bond 1 at once, writes one public Chronicle line and the first meeting is rolled in the same step', function (t) {
    var b = withPen(12);
    var id = housed(b, 1, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, id, 'Mira', '');
    var r = BR.acclimatise(b, bdata, id, 20, { rand: dice([0.5, 0.1, 0.4, 0.7]) });
    t.same([r.ok, r.pass, r.total, r.dc, r.skill], [true, true, 20, 20, 'Animal Handling']);
    t.same(r.log, ['Creatures', 'Swiftwing and Mira passed acclimatisation (Animal Handling 20 against DC 20): Bond 1 on Day 12. Swiftwing can now go out on the road with Mira.']);
    var d = dev(b, id);
    t.same([d.bond.level, d.bond.ready], [1, null]);
    t.same(d.chronicle.map(function (e) { return [e.cat, e.text, e.private === true]; }), [
      ['handler', 'Mira assigned as handler.', false],
      ['bond', 'Acclimatised with Mira on Day 12 (rolled 20 against DC 20). Bond 1 (Acclimatised).', false]
    ]);
    t.same(d.acclimatise, { tries: 1, retryDay: null, last: { day: 12, total: 20, dc: 20, pass: true } });
    t.ok(r.introduced && r.introduced.ok && r.introduced.initiated, 'the first meeting was rolled in the same step: ' + JSON.stringify(r.introduced));
    t.equal(typeof d.initiation.regional, 'string');
    var fac = BR.facility(bdata, PEN);
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[1]), [], 'it leaves the dropdown');
    t.equal(BR.acclimatiseBlocker(b, bdata, id, {}), 'Swiftwing is already acclimatised (Bond 1).');
    t.equal(BR.acclimatise(b, bdata, id, 25, {}).ok, false, 'never twice');
    t.equal(dev(b, id).bond.level, 1);
  });

  test('a fail locks that beast for 3 days: a fail on Day 10 blocks Days 11 and 12, Day 13 is allowed; another beast is not locked; the DM-only note stays private', function (t) {
    var b = withPen(10);
    var g = housed(b, 1, 'griffin', 'Swiftwing');
    var w = housed(b, 2, 'wyvern', 'Ash');
    BR.assignHandler(b, bdata, g, 'Mira', '');
    BR.assignHandler(b, bdata, w, 'Kaelen', '');
    var r = BR.acclimatise(b, bdata, g, 19, {});
    t.same([r.ok, r.pass, r.retryDay], [true, false, 13]);
    t.same(r.log, ['Creatures', 'Swiftwing and Mira failed acclimatisation (Animal Handling 19 against DC 20). Swiftwing can try again on Day 13.']);
    t.same([dev(b, g).bond.level, dev(b, g).acclimatise], [0, { tries: 1, retryDay: 13, last: { day: 10, total: 19, dc: 20, pass: false } }]);
    var note = dev(b, g).chronicle[dev(b, g).chronicle.length - 1];
    t.same([note.cat, note.private, note.text], ['bond', true, 'Acclimatisation failed on Day 10: rolled 19 against DC 20. It can try again on Day 13.']);
    [10, 11, 12].forEach(function (day) {
      b.day = day;
      t.equal(BR.acclimatise(b, bdata, g, 30, {}).message, 'Swiftwing can try again on Day 13.', 'Day ' + day);
    });
    t.same(BR.fnOptions(b, bdata, BR.facility(bdata, PEN), BR.facility(bdata, PEN).functions[1]).map(function (o) { return o.label; }), ['Swiftwing (Griffin), handler Mira: tries again on Day 13', 'Ash (Wyvern), handler Kaelen']);
    b.day = 10;
    t.equal(BR.acclimatise(b, bdata, w, 20, {}).pass, true, 'Ash is not locked by Swiftwing\'s fail');
    b.day = 13;
    var again = BR.acclimatise(b, bdata, g, 20, {});
    t.same([again.ok, again.pass, dev(b, g).bond.level, dev(b, g).acclimatise.tries], [true, true, 1, 2], 'Day 13 is allowed');
  });

  test('the handler\'s total must be a whole number from 1 to 60; anything else changes nothing', function (t) {
    var b = withPen(10);
    var id = housed(b, 1, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, id, 'Mira', '');
    var before = canon(b);
    ['', 'abc', 0, -3, 61, 1000, 12.5, '12.5', NaN, null, undefined, {}, [], '1e1', 'Infinity', '  '].forEach(function (v) {
      var r = BR.acclimatise(b, bdata, id, v, {});
      t.equal(r.ok, false, JSON.stringify(v) + ' is refused');
      t.equal(r.message, 'Type the handler\'s total as a whole number from 1 to 60.');
    });
    t.equal(canon(b), before, 'nothing changed');
    t.equal(BR.acclimatiseTotal('20'), 20, 'typed text is read');
    t.equal(BR.acclimatiseTotal(' 7 '), 7);
    t.equal(BR.acclimatiseTotal(60), 60);
    t.equal(BR.acclimatiseTotal(1), 1);
    t.equal(BR.acclimatise(b, bdata, id, '21', {}).pass, true, 'text from the box works');
  });

  test('the DC is one number in the data and a kind can have its own', function (t) {
    t.same([BR.acclimatiseDC(bdata, 'wyvern'), BR.acclimatiseDC(bdata, 'buckbear'), BR.acclimatiseData(bdata, 'fellcat').retryDays], [20, 20, 3]);
    var custom = Object.assign({}, bdata, { creatures: copy(CR) });
    custom.creatures.species.wyvern.acclimatiseDC = 15;
    custom.creatures.acclimatise.dc = 18;
    t.same([BR.acclimatiseDC(custom, 'wyvern'), BR.acclimatiseDC(custom, 'griffin')], [15, 18]);
    var b = withPen(10);
    var id = housed(b, 1, 'wyvern', 'Ash');
    BR.assignHandler(b, bdata, id, 'Mira', '');
    var r = BR.acclimatise(b, custom, id, 15, {});
    t.same([r.pass, r.dc], [true, 15]);
  });

  test('not while a day is being passed, or while the Bastion is behind the Explorer', function (t) {
    var b = withPen(10);
    var id = housed(b, 1, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, id, 'Mira', '');
    t.equal(BR.acclimatise(b, bdata, id, 22, { explorerDay: 12 }).message, 'The Bastion is catching up with the Explorer\'s day. Wait a moment.');
    t.equal(BR.acclimatise(b, bdata, id, 22, { explorerDay: 10 }).pass, true, 'level with the Explorer is fine');
    var c = withPen(10);
    var cid = housed(c, 1, 'griffin', 'Swiftwing');
    BR.assignHandler(c, bdata, cid, 'Mira', '');
    c.dayInProgress = { day: 10, stage: 'trade', skipped: [], attackRolled: false, news: [] };
    t.equal(BR.acclimatise(c, bdata, cid, 22, {}).message, 'A day is being passed. Wait for it to finish.');
    t.equal(dev(c, cid).bond.level, 0);
  });

  test('Reset Travel moves the day it may try again and the day of its last try, so the lock keeps its length', function (t) {
    var b = withPen(10);
    var id = housed(b, 1, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, id, 'Mira', '');
    BR.acclimatise(b, bdata, id, 5, {});
    BR.shiftDays(b, -5);
    t.same([b.day, dev(b, id).acclimatise.retryDay, dev(b, id).acclimatise.last.day], [5, 8, 5]);
    b.day = 7;
    t.equal(BR.acclimatise(b, bdata, id, 30, {}).message, 'Swiftwing can try again on Day 8.', 'still locked on Day 7');
    b.day = 8;
    t.equal(BR.acclimatise(b, bdata, id, 30, {}).pass, true, 'allowed on Day 8: three days after the fail, as before the reset');
  });

  test('a beast already at Bond 1 or more (Elara\'s wyvern, or one brought there by the old programmes) is acclimatised and is not offered', function (t) {
    var b = withPen();
    b.creatures.push({ id: 'elara_wyvern', species: 'wyvern', owner: 'elara', name: '', status: 'housed', home: PEN, grantedDay: 1, housedDay: 2, msgId: '', development: BR.newDevelopment({ id: 'elara_wyvern' }, 2) });
    var fac = BR.facility(bdata, PEN);
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[1]), []);
    t.equal(BR.acclimatiseBlocker(b, bdata, 'elara_wyvern', {}), 'Elara\'s wyvern is already acclimatised (Bond 1).');
  });

  /* ---------------------------------------------------------------- */
  group('Beast Pen: out on the road and back (Harry, 22 October 2026)');

  test('take out: the beast must be housed, acclimatised, have a handler and the Pen must stand; each refusal says why and changes nothing', function (t) {
    var b = withPen(10);
    var w = grant(b, 1, 'wyvern', 'Ash');
    t.equal(BR.takeOut(b, bdata, w, {}).message, 'Ash has no home at the Beast Pen yet.');
    var id = housed(b, 2, 'griffin', 'Swiftwing');
    t.equal(BR.takeOut(b, bdata, id, {}).message, 'Swiftwing must pass Acclimatise With Beast first.');
    BR.assignHandler(b, bdata, id, 'Mira', '');
    t.equal(BR.takeOut(b, bdata, id, {}).message, 'Swiftwing must pass Acclimatise With Beast first.', 'a handler is not enough');
    BR.acclimatise(b, bdata, id, 20, {});
    var before = canon(b);
    t.equal(BR.takeOut(b, bdata, id, { explorerDay: 13 }).message, 'The Bastion is catching up with the Explorer\'s day. Wait a moment.');
    b.dayInProgress = { day: 10, stage: 'trade', skipped: [], attackRolled: false, news: [] };
    t.equal(BR.takeOut(b, bdata, id, {}).message, 'A day is being passed. Wait for it to finish.');
    b.dayInProgress = null;
    t.equal(canon(b), before, 'nothing changed by any refusal');
    var open = b.builtExtras;
    b.builtExtras = [];
    t.equal(BR.takeOut(b, bdata, id, {}).message, 'The Beast Pen must stand before Swiftwing can go out.');
    b.builtExtras = open;
    t.equal(BR.takeOut(b, bdata, 'nobody', {}).message, 'That beast isn\'t at the Ironbow any more.');
  });

  test('take out and return are the only two buttons: a second press does nothing; the labels are At the Beast Pen and Away from the Ironbow; the lines are in the Chronicle', function (t) {
    var b = withPen(10);
    var id = acclimatised(b, 1, 'griffin', 'Swiftwing');
    t.equal(BR.penStatus(b, bdata, BR.creatureById(b, id)).line, 'At the Beast Pen');
    var out = BR.takeOut(b, bdata, id, {});
    t.same(out, { ok: true, name: 'Swiftwing', log: ['Creatures', 'Swiftwing is away from the Ironbow with Mira (Day 10). Each day that passes now is a Bonding Day.'] });
    t.same(dev(b, id).bonding, { away: true, awaySince: 10, lastTick: 10, days: 0 });
    t.same(BR.penStatus(b, bdata, BR.creatureById(b, id)), { kind: 'away', line: 'Away from the Ironbow since Day 10' });
    var snap = canon(b);
    t.same(BR.takeOut(b, bdata, id, {}), { ok: false, message: 'Swiftwing is already away from the Ironbow.' });
    t.equal(canon(b), snap, 'a second press changes nothing');
    b.day = 14;
    var back = BR.returnToPit(b, bdata, id, {});
    t.same(back.log, ['Creatures', 'Swiftwing is back at the Beast Pen on Day 14 after 4 days on the road (0 Bonding Days in all).']);
    t.same(BR.returnToPit(b, bdata, id, {}), { ok: false, message: 'Swiftwing is already at the Beast Pen.' });
    var last = dev(b, id).chronicle.slice(-2).map(function (e) { return [e.cat, e.text, e.private === true]; });
    t.same(last, [['travel', 'Taken out on the road with Mira on Day 10.', false], ['travel', 'Returned to the Beast Pen on Day 14 after 4 days on the road.', false]]);
    t.same(dev(b, id).bonding, { away: false, awaySince: null, lastTick: null, days: 0 });
  });

  test('assigning a handler: refused while the beast is away; a change needs a reason, starts a new pairing (its own Bonding Days and its own try at acclimatising) unless the DM credits the old bond', function (t) {
    var b = withPen(10);
    var id = acclimatised(b, 1, 'griffin', 'Swiftwing');
    BR.takeOut(b, bdata, id, {});
    t.equal(BR.assignHandler(b, bdata, id, 'Kaelen', 'because').message, 'Return Swiftwing to the Beast Pen first.');
    passDays(b, 3);
    BR.returnToPit(b, bdata, id, {});
    t.equal(dev(b, id).bonding.days, 3);
    t.equal(BR.assignHandler(b, bdata, id, 'Kaelen', '').message, 'Say why the handler is changing.');
    t.equal(BR.assignHandler(b, bdata, id, 'Mira', 'x').message, 'Mira is already Swiftwing\'s handler.');
    var r = BR.assignHandler(b, bdata, id, 'Kaelen', 'Mira left the party', false);
    t.same(r.log, ['Creatures', 'Swiftwing\'s handler is now Kaelen (Bond 0: a new pairing).']);
    t.same([dev(b, id).bond.level, dev(b, id).bonding, dev(b, id).acclimatise, dev(b, id).handlerHistory.length], [0, undefined, undefined, 1], 'a new pairing: Bond 0, no Bonding Days, a clean slate for acclimatising');
    t.same(BR.takeOut(b, bdata, id, {}).message, 'Swiftwing must pass Acclimatise With Beast first.');
    var c = withPen(10);
    var cid = acclimatised(c, 1, 'griffin', 'Swiftwing');
    BR.takeOut(c, bdata, cid, {});
    passDays(c, 4);
    BR.returnToPit(c, bdata, cid, {});
    BR.assignHandler(c, bdata, cid, 'Kaelen', 'a new player', true);
    t.same([dev(c, cid).bond.level, dev(c, cid).bonding], [1, undefined], 'the credited bond is kept, the Bonding Days start again');
  });

  /* ---------------------------------------------------------------- */
  group('Bonding Days: counted once for each day that passes (R.startDay)');

  test('a day passing credits exactly one Bonding Day to each beast that is away, and none while it is at the Pen', function (t) {
    var b = withPen(10);
    var out = acclimatised(b, 1, 'griffin', 'Swiftwing', 'Mira');
    var home = acclimatised(b, 2, 'wyvern', 'Ash', 'Kaelen');
    BR.takeOut(b, bdata, out, {});
    passDay(b);
    t.same([b.day, dev(b, out).bonding.days, dev(b, out).bonding.lastTick, dev(b, home).bonding], [11, 1, 11, undefined]);
    passDays(b, 4);
    t.same([b.day, dev(b, out).bonding.days, dev(b, home).bonding], [15, 5, undefined]);
    var snap = BR.bondProgress(b, bdata, BR.creatureById(b, out));
    t.same([snap.days, snap.away, snap.since, snap.ready, snap.pill.n, snap.pill.days, snap.pill.need], [5, true, 10, null, 2, 5, 10]);
  });

  test('the same day asked twice credits one day; take out and return on one day credit none; returning part-way keeps the days and counts the return day', function (t) {
    var b = withPen(10);
    var id = acclimatised(b, 1, 'griffin', 'Swiftwing');
    BR.takeOut(b, bdata, id, {});
    BR.returnToPit(b, bdata, id, {});
    t.equal(dev(b, id).bonding.days, 0, 'out and back the same day: no days');
    BR.takeOut(b, bdata, id, {});
    BR.startDay(b, bdata, 0);
    var days = dev(b, id).bonding.days;
    /* A second tick for the same day (a test, a future second call site) is a no-op. */
    BR.tickBonding(b, bdata, 0);
    BR.tickBonding(b, bdata, 0);
    t.same([days, dev(b, id).bonding.days], [1, 1]);
    BR.finishDay(b);
    passDays(b, 3);
    t.equal(dev(b, id).bonding.days, 4, 'Days 11, 12, 13, 14');
    BR.returnToPit(b, bdata, id, {});
    passDays(b, 3);
    t.equal(dev(b, id).bonding.days, 4, 'nothing counted at the Pen');
    t.same(dev(b, id).bonding, { away: false, awaySince: null, lastTick: null, days: 4 });
    BR.takeOut(b, bdata, id, {});
    passDays(b, 2);
    t.equal(dev(b, id).bonding.days, 6, 'the days add up over trips');
  });

  test('a closed Bastion: the Explorer makes camp 5 times, and on opening the days pass one at a time and are credited exactly once; a window closed half-way loses and repeats nothing', function (t) {
    var b = withPen(10);
    var id = acclimatised(b, 1, 'griffin', 'Swiftwing');
    BR.takeOut(b, bdata, id, {});
    var action = BR.clockAction(b, 15);
    t.same(action, { kind: 'pass', days: 5 });
    passDay(b); passDay(b);
    /* Closed after two days: what was saved is loaded again. */
    var back = reload(b);
    t.same([back.day, dev(back, id).bonding.days], [12, 2], 'saved with the day');
    action = BR.clockAction(back, 15);
    t.same(action, { kind: 'pass', days: 3 });
    passDays(back, action.days);
    t.same([back.day, dev(back, id).bonding.days, dev(back, id).bonding.lastTick], [15, 5, 15], 'five days in all, none twice');
    t.same(BR.clockAction(back, 15), { kind: 'none' });
    /* A day left part-way (a cancelled roll) is resumed, never started again: startDay is not run twice for it. */
    var half = withPen(10);
    var hid = acclimatised(half, 1, 'griffin', 'Swiftwing');
    BR.takeOut(half, bdata, hid, {});
    BR.startDay(half, bdata, 0);
    var mid = reload(half);
    t.same([mid.day, !!mid.dayInProgress, dev(mid, hid).bonding.days], [11, true, 1]);
    t.same(BR.clockAction(mid, 11), { kind: 'pass', days: 0 }, 'resumed, not restarted');
    BR.finishDay(mid);
    t.same(BR.clockAction(mid, 11), { kind: 'none' });
    t.equal(dev(mid, hid).bonding.days, 1);
  });

  test('Reset Travel: the days are neither lost nor doubled, and the next camp credits exactly one day (the guard moves with it)', function (t) {
    var b = withPen(10);
    var id = acclimatised(b, 1, 'griffin', 'Swiftwing');
    BR.takeOut(b, bdata, id, {});
    passDays(b, 17);
    t.same([b.day, dev(b, id).bonding.days, dev(b, id).bonding.lastTick], [27, 17, 27]);
    var act = BR.clockAction(b, 1);
    t.same(act, { kind: 'shift', by: -26 });
    BR.shiftDays(b, act.by);
    t.same([b.day, dev(b, id).bonding.days, dev(b, id).bonding.awaySince, dev(b, id).bonding.lastTick], [1, 17, -16, 1], 'moved by the same amount; the days are kept');
    passDay(b);
    t.same([b.day, dev(b, id).bonding.days], [2, 18], 'the first day after a reset credits one day (a guard that did not move would credit none)');
    passDay(b);
    t.equal(dev(b, id).bonding.days, 19);
    /* The first read of the Explorer's day moves everything too. */
    var c = withPen(10);
    var cid = acclimatised(c, 1, 'griffin', 'Swiftwing');
    BR.takeOut(c, bdata, cid, {});
    c.anchored = false;
    BR.anchor(c, 30);
    t.same([c.day, dev(c, cid).bonding.awaySince, dev(c, cid).bonding.lastTick, dev(c, cid).bonding.days], [30, 30, 30, 0]);
    passDay(c);
    t.equal(dev(c, cid).bonding.days, 1);
  });

  test('the levels: Bond 2 at 10 total days, 3 at 20, 4 at 30, 5 at 50; a milestone is said once, in the Day Log and "The Ironbow sends word"', function (t) {
    var b = withPen(10);
    var id = acclimatised(b, 1, 'griffin', 'Swiftwing');
    BR.takeOut(b, bdata, id, {});
    passDays(b, 9);
    t.same([dev(b, id).bonding.days, dev(b, id).bond.ready], [9, null], '9 days: not yet');
    BR.startDay(b, bdata, 0);
    t.same([dev(b, id).bonding.days, dev(b, id).bond.ready], [10, 2], 'the 10th day makes Bond 2 ready');
    var said = b.log.filter(function (l) { return /Bond 2 \(Trusting\) is ready/.test(l.body); });
    t.equal(said.length, 1);
    t.equal(said[0].body, 'Swiftwing and Mira have spent 10 days together: Bond 2 (Trusting) is ready. Run a scene at the table, then confirm it in the Beast Pen.');
    t.same(b.dayInProgress.news, [said[0].body], 'and in the Ironbow\'s word');
    BR.finishDay(b);
    passDays(b, 3);
    t.equal(b.log.filter(function (l) { return /is ready/.test(l.body); }).length, 1, 'never said again while it waits');
    t.equal(dev(b, id).bond.ready, 2);
    var thresholds = [];
    var c = withPen(10);
    var cid = acclimatised(c, 1, 'wyvern', 'Ash');
    BR.takeOut(c, bdata, cid, {});
    for (var day = 1; day <= 60; day++) {
      passDay(c);
      var d = dev(c, cid);
      if (d.bond.ready) {
        thresholds.push([d.bonding.days, d.bond.ready]);
        var r = BR.confirmBond(c, bdata, cid, 'The scene at the table');
        if (!r.ok) throw new Error(r.message);
      }
    }
    t.same(thresholds, [[10, 2], [20, 3], [30, 4], [50, 5]]);
    t.same([dev(c, cid).bond.level, dev(c, cid).bonding.days], [5, 60], 'Bond 5: only the days still count');
    t.same(BR.bondProgress(c, bdata, BR.creatureById(c, cid)).pill, null, 'no pill is left to fill');
  });

  test('days are never lost while a milestone waits: the counter keeps counting, a confirmation raises exactly ONE level, and if the next total is already met another scene is asked for', function (t) {
    var b = withPen(10);
    var id = acclimatised(b, 1, 'griffin', 'Swiftwing');
    BR.takeOut(b, bdata, id, {});
    passDays(b, 25);
    t.same([dev(b, id).bonding.days, dev(b, id).bond.level, dev(b, id).bond.ready], [25, 1, 2], '25 days at Bond 1: Bond 2 is waiting');
    t.same(BR.bondProgress(b, bdata, BR.creatureById(b, id)).pill, { n: 2, days: 10, need: 10, fraction: 1, full: true }, 'its pill is full');
    var cannot = BR.confirmBond(b, bdata, id, 'x');
    t.equal(cannot.message, 'Say what happened at the table (the scene that earned it).');
    var first = BR.confirmBond(b, bdata, id, 'The first scene');
    t.same([first.ok, first.level, first.readyNext], [true, 2, 3], 'Bond 2 only; Bond 3 is ready too (25 days is over 20)');
    t.same(first.log, ['Creatures', 'Swiftwing is now Bond 2: Trusting. The first scene Bond 3 (Bonded) is ready too: it needs its own scene.']);
    t.same([dev(b, id).bond.level, dev(b, id).bond.ready, dev(b, id).bonding.days], [2, 3, 25], 'no level skipped, no day lost');
    var second = BR.confirmBond(b, bdata, id, 'The second scene');
    t.same([second.level, second.readyNext, dev(b, id).bond.ready], [3, null, null], 'one scene for each level');
    t.same(BR.bondProgress(b, bdata, BR.creatureById(b, id)).pill, { n: 4, days: 5, need: 10, fraction: 0.5, full: false }, 'pill 4 is half full: 25 days is 5 past 20 of the 10 it needs');
    t.equal(BR.confirmBond(b, bdata, id, 'a third time').message, 'No bond milestone is ready for Swiftwing: it needs more days on the road with its handler.');
    t.equal(dev(b, id).bond.level, 3);
  });

  test('the pills: pill 1 is full once the roll passes; pills 2 to 5 fill between the totals', function (t) {
    var b = withPen(10);
    var id = acclimatised(b, 1, 'griffin', 'Swiftwing');
    var c = BR.creatureById(b, id);
    var p = BR.bondProgress(b, bdata, c);
    t.same([p.level, p.next, p.days, p.pill], [1, 2, 0, { n: 2, days: 0, need: 10, fraction: 0, full: false }]);
    BR.takeOut(b, bdata, id, {});
    passDays(b, 4);
    t.same(BR.bondProgress(b, bdata, c).pill, { n: 2, days: 4, need: 10, fraction: 0.4, full: false });
    var h = BR.devView(b, c);
    t.equal(BR.bondProgress(b, bdata, { id: 'x', species: 'griffin', development: Object.assign({}, h, { bond: { level: 0, ready: null } }) }).pill, null, 'Bond 0 has no filling pill');
    /* Fractions in each band, from the data. */
    var table = [[2, 10, 0], [2, 15, 0.5], [3, 25, 0.5], [3, 29, 0.9], [4, 40, 0.5], [4, 50, 1]];
    table.forEach(function (row) {
      var fake = { id: 'x', species: 'griffin', status: 'housed', development: { bond: { level: row[0], ready: null }, bonding: { away: false, awaySince: null, lastTick: null, days: row[1] } } };
      var q = BR.bondProgress(b, bdata, fake);
      t.equal(q.pill.fraction, row[2], 'Bond ' + row[0] + ' with ' + row[1] + ' days');
    });
  });

  test('a beast already at a level (an older save) counts as having that level\'s days, so it carries on towards the next', function (t) {
    var b = withPen(10);
    var id = housed(b, 1, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, id, 'Mira', '');
    dev(b, id).bond.level = 3;
    var c = BR.creatureById(b, id);
    t.same([BR.bondingDays(bdata, c), BR.bondProgress(b, bdata, c).pill], [20, { n: 4, days: 0, need: 10, fraction: 0, full: false }]);
    BR.takeOut(b, bdata, id, {});
    t.equal(dev(b, id).bonding.days, 20, 'taking it out writes the floor');
    passDays(b, 10);
    t.same([dev(b, id).bonding.days, dev(b, id).bond.ready], [30, 4], 'Bond 4 after 10 more days: 30 in all');
  });

  /* ---------------------------------------------------------------- */
  group('Beast Pen: what is saved');

  test('Bonding Days and the acclimatisation record are kept, repaired and never invented: an older save is byte for byte the same, loading twice gives the same save', function (t) {
    var plain = BR.cleanDevelopment(BR.newDevelopment({ id: 'x' }, 3));
    t.same(Object.keys(plain), ['version', 'handlerId', 'bond', 'temperament', 'training', 'harness', 'firstFlight', 'handlerHistory', 'seq', 'chronicle'], 'nothing new unless it is used');
    var b = withPen(10);
    var id = acclimatised(b, 1, 'griffin', 'Swiftwing');
    BR.takeOut(b, bdata, id, {});
    passDays(b, 3);
    var d = dev(b, id);
    t.same(Object.keys(d.bonding), ['away', 'awaySince', 'lastTick', 'days']);
    t.same(Object.keys(d.acclimatise), ['tries', 'retryDay', 'last']);
    var once = reload(b);
    t.same(Object.keys(dev(once, id)).slice(-3), ['initiation', 'bonding', 'acclimatise'], 'in a fixed order, after what was there');
    t.same(dev(once, id).bonding, { away: true, awaySince: 10, lastTick: 13, days: 3 });
    t.equal(JSON.stringify(BR.toSave(reload(once))), JSON.stringify(BR.toSave(once)), 'the same JSON twice');
    t.same(dev(once, id).acclimatise, dev(b, id).acclimatise);
  });

  test('the cleaner repairs damaged values and refuses a beast that cannot be away', function (t) {
    var base = BR.newDevelopment({ id: 'x' }, 3);
    function clean(extra, level) {
      var d = copy(base);
      d.bond.level = level === undefined ? 2 : level;
      Object.keys(extra).forEach(function (k) { d[k] = extra[k]; });
      return BR.cleanDevelopment(d);
    }
    t.same(clean({ bonding: { away: true, awaySince: '12', lastTick: 13.9, days: '7' } }).bonding, { away: true, awaySince: 12, lastTick: 13, days: 7 }, 'numbers in text and fractions are repaired');
    t.same(clean({ bonding: { away: 'yes', awaySince: 12, lastTick: 12, days: 4 } }).bonding, { away: false, awaySince: null, lastTick: null, days: 4 }, 'away only when it is exactly true');
    t.same(clean({ bonding: { away: true, awaySince: 1, lastTick: 1, days: 4 } }, 0).bonding, { away: false, awaySince: null, lastTick: null, days: 4 }, 'a beast at Bond 0 is never away');
    t.same(clean({ bonding: { away: true, awaySince: 'x', lastTick: null, days: -5 } }).bonding, { away: true, awaySince: null, lastTick: null, days: 0 }, 'no day, no negative days');
    t.equal(clean({ bonding: { away: false, days: 0 } }).bonding, undefined, 'nothing to keep, nothing kept');
    t.equal(clean({ bonding: 'nope' }).bonding, undefined);
    t.same(clean({ bonding: { away: true, awaySince: -4, lastTick: 0, days: 1e9 } }).bonding, { away: true, awaySince: -4, lastTick: 0, days: 100000 }, 'a day before Day 1 after a Reset Travel is kept; the count is capped');
    t.same(clean({ acclimatise: { tries: 2, retryDay: '13', last: { day: 10, total: 19, dc: 20, pass: false } } }).acclimatise, { tries: 2, retryDay: 13, last: { day: 10, total: 19, dc: 20, pass: false } });
    t.equal(clean({ acclimatise: { tries: 0, retryDay: 13 } }).acclimatise, undefined, 'no tries, nothing kept');
    t.same(clean({ acclimatise: { tries: 1, retryDay: null, last: 'x' } }).acclimatise, { tries: 1, retryDay: null, last: null });
    t.equal(clean({ acclimatise: { tries: 'many' } }).acclimatise, undefined);
    var list = BR.cleanCreatures([
      { id: 'w1', species: 'griffin', status: 'waiting', home: '', name: 'Waiting', development: Object.assign(copy(base), { bonding: { away: true, awaySince: 3, lastTick: 4, days: 6 }, bond: { level: 2, ready: null } }) },
      { id: 'h1', species: 'griffin', status: 'housed', home: PEN, name: 'Housed', development: Object.assign(copy(base), { bonding: { away: true, awaySince: 3, lastTick: 4, days: 6 }, bond: { level: 2, ready: null } }) }
    ], 10);
    t.same([list[0].development.bonding, list[1].development.bonding.away], [{ away: false, awaySince: null, lastTick: null, days: 6 }, true], 'a beast that is not housed cannot be out on the road; its days stay');
  });

  test('the DM-only Chronicle notes and the development record survive a save, a reload, an export and an import', function (t) {
    var b = withPen(10);
    var id = acclimatised(b, 1, 'griffin', 'Swiftwing');
    BR.addChronicleNote(b, bdata, id, 'A secret from the DM', true);
    BR.addChronicleNote(b, bdata, id, 'A scene everyone saw', false);
    BR.setTemperament(b, bdata, id, { dominant: 'Bold', attachment: 'Warm', trigger: 'Thunder' });
    BR.takeOut(b, bdata, id, {});
    passDays(b, 2);
    var back = reload(b);
    t.equal(canon(dev(back, id)), canon(dev(b, id)), 'everything in its development comes back as it was');
    var notes = dev(back, id).chronicle.filter(function (e) { return e.cat === 'note'; });
    t.same(notes.map(function (e) { return [e.text, e.private === true]; }), [['A secret from the DM', true], ['A scene everyone saw', false]]);
    var BK = TSI.backupRules;
    var file = BK.parse(JSON.stringify(BK.makeCampaignBackup([
      TSI.storeRules.makeRecord('tsi.explorer.save', exWith([], 12), new Date()),
      TSI.storeRules.makeRecord('tsi.bastion.state', BR.toSave(back), new Date())
    ], new Date(), 'suite')));
    t.ok(file.ok);
    t.equal(BR.importProblem(file.backup.records), null);
    var restored = BR.fromSave(file.backup.records[1].value, bdata);
    t.same(dev(restored, id).bonding, dev(b, id).bonding, 'the Bonding Days come through an export and an import');
  });

  test('old training, harness and first-flight records stay in a beast\'s saved development, hidden, and the save is the same twice', function (t) {
    var b = withPen(10);
    var id = housed(b, 1, 'griffin', 'Swiftwing');
    var d = BR.ensureDev(b, BR.creatureById(b, id));
    d.training = { grf_keeper_routine: { day: 5 } };
    d.harness = { fitted: true, paidGP: 150, fittedDay: 6 };
    d.firstFlight = { approved: true, day: 9, handlerId: 'mira' };
    var back = reload(b);
    t.same([dev(back, id).training, dev(back, id).harness, dev(back, id).firstFlight], [d.training, d.harness, d.firstFlight]);
    t.equal(JSON.stringify(BR.toSave(reload(back))), JSON.stringify(BR.toSave(back)));
  });

  /* ---------------------------------------------------------------- */
  group('Beast Pen: the conversion (step rehomeBeasts)');

  var data = bdata;
  function convert(raw) {
    var res = BR.migrateToV4(raw, data);
    res.problems = BR.stripBackAudit(res.before, res.save, res.report, data);
    return res;
  }
  /* A plain version 3 Bastion on Day 12 with the given buildings (ids), built unless it says 'building'. */
  function v3(fn) {
    var s = copy(BR.toSave(BR.defaultState(data)));
    s.v = 3;
    s.day = 12;
    s.anchored = true;
    s.treasuryGP = 400;
    s.partyLevel = 13;
    if (fn) fn(s);
    return s;
  }
  function old(id, extra) { return Object.assign({ facId: id, status: 'built' }, extra || {}); }
  function creature(id, species, name, status, home, bond, extra) {
    var c = { id: id, species: species, owner: '', name: name, status: status, home: home, grantedDay: 1, housedDay: status === 'housed' ? 3 : null, msgId: '' };
    if (bond !== null && bond !== undefined) { c.development = BR.newDevelopment({ id: id }, 3); c.development.bond.level = bond; if (bond) c.development.handlerId = 'mira'; }
    return Object.assign(c, extra || {});
  }
  /* A report's lines without the one every version 3 Bastion gets since the war game went (S06): the Barracks, Armoury and Watchtower are gone. */
  function noWar(res) { return res.report.lines.filter(function (l) { return !/^Places that are gone\. Barracks, Armoury and Watchtower are gone with the war game\.$/.test(l); }); }
  function order(id, facId, fnId, extra) {
    return Object.assign({ id: id, facId: facId, fnId: fnId, chosen: null, optionLabel: null, notes: '', label: facId + ': ' + fnId, costGP: 0, issuedDay: 10, dueDay: 15 }, extra || {});
  }

  test('the heavy Bastion: the three buildings become one Pen, the House order moves, the harness is refunded and the audit is clean; converting again changes nothing', function (t) {
    var raw = FIX['bastion-v3-heavy'];
    var before = canon(raw);
    var res = convert(raw);
    t.equal(canon(raw), before, 'the fixture itself is untouched');
    t.same(res.problems, [], 'the audit');
    var s = res.save;
    t.same(s.builtExtras.filter(function (e) { return e && /^(beast_pen|wyvern_roost|griffin_tower|dire_wolf_den)$/.test(e.facId); }), [{ facId: PEN, status: 'built' }], 'one Pen, in the slot of the first built one (the Roost\'s)');
    t.equal(s.builtExtras[7].facId, PEN);
    t.same([s.builtExtras[8], s.builtExtras[9]], ['', ''], 'the Tower\'s and the Den\'s slots are free');
    t.same(['wyvern_roost', 'griffin_tower', 'dire_wolf_den', PEN].map(function (id) { return s.facilityLevels[id]; }), [undefined, undefined, undefined, 1], 'one level');
    t.same(s.archivedFacilities.filter(function (a) { return /^(wyvern_roost|griffin_tower|dire_wolf_den)$/.test(a.facId); }).map(function (a) { return [a.facId, a.name, a.status]; }), [['wyvern_roost', 'Wyvern Roost', 'built'], ['griffin_tower', 'Griffin Tower', 'building'], ['dire_wolf_den', 'Dire Wolf Den', 'built']]);
    t.same(s.creatures.map(function (c) { return [c.id, c.status, c.home]; }), [['elara_wyvern', 'housed', PEN], ['cr-hv-griffin-swiftwing', 'housed', PEN], ['cr-hv-wolf-ashfang', 'housed', PEN], ['cr-hv-wyvern-skyrender', 'waiting', '']], 'every housed beast lives at the Pen; nobody is released');
    t.same(res.before.creatures.map(function (c) { return c.development; }), s.creatures.map(function (c) { return c.development; }), 'their records are exactly as they were (no bond credited, nothing rolled)');
    var moved = s.pendingOrders.filter(function (o) { return o.facId === PEN; });
    t.same(moved.map(function (o) { return [o.id, o.fnId, o.label, o.optionLabel, o.dueDay, o.issuedDay, o.costGP]; }), [['hv-27', 'house_beast', 'Beast Pen: House Beast Here (Skyrender)', 'Skyrender', 41, 38, 0]], 'the House order moved, keeping its id, its due day and what it houses');
    t.same(moved[0].chosen, { label: 'Skyrender', creatureId: 'cr-hv-wyvern-skyrender' });
    t.equal(s.pendingOrders.some(function (o) { return o.id === 'hv-28'; }), false, 'the Riding Harness order is cancelled');
    var refund = res.report.gold.items.filter(function (i) { return /Riding Harness/.test(i.label); })[0];
    t.same([refund.gp, refund.kind], [150, 'refund']);
    t.equal(s.treasuryGP, 2000 + 1645, 'the 150 gp is back in the treasury, with the 1,495 the war game\'s cancelled orders cost (its own tests are in strip-back.test.js)');
    t.same(res.report.cancelled.filter(function (c) { return c.id === 'hv-28'; }).map(function (c) { return [c.gp, /training and riding are gone/.test(c.why)]; }), [[150, true]]);
    t.same(res.report.moved.filter(function (m) { return m.id === 'hv-27'; }).map(function (m) { return m.to; }), ['the Beast Pen']);
    var lines = s.migration.v4.lines.join('\n');
    t.ok(/The Wyvern Roost, Griffin Tower and Dire Wolf Den have become one Beast Pen\. It keeps one beast of each kind: a wyvern, a griffin, a dire wolf, a buckbear and a fellcat\. The other slots are free\./.test(lines), lines);
    t.ok(/All 4 of your beasts are still here/.test(lines));
    t.ok(/A beast at Bond 1 or more counts as acclimatised: Elara's wyvern, Swiftwing and Ashfang\./.test(lines));
    t.ok(/What Swiftwing and Ashfang had learned stays in their records, out of sight\./.test(lines));
    t.ok(/The House order for Skyrender carries on, but the Beast Pen already holds a wyvern, so Skyrender will keep waiting for a home when it completes\./.test(lines));
    t.equal(/wyvern_roost|griffin_tower|dire_wolf_den|beast_pen|undefined|  /.test(lines), false, 'plain English: no ids, no double spaces');
    t.equal(BR.needsStripBack(s, data), false);
    t.equal(canon(BR.migrateToV4(s, data).save), canon(s), 'converting again changes nothing');
    var loaded = BR.fromSave(copy(raw), data);
    t.same(BR.fromSave(BR.toSave(loaded), data), loaded, 'loading twice gives the same Bastion');
    t.equal(loaded.facilityLevels[PEN], 1);
  });

  test('the moved House order still completes after the conversion: the wyvern keeps waiting because the Pen already holds Elara\'s, and a griffin order would house', function (t) {
    var res = convert(FIX['bastion-v3-heavy']);
    var b = BR.fromSave(copy(res.save), data);
    var o = b.pendingOrders.filter(function (x) { return x.id === 'hv-27'; })[0];
    b.day = 41;
    var lines = BR.completeSimpleOrder(b, data, o, dice([0.5]));
    t.same(lines, [['Creatures', 'Beast Pen: House Beast Here (Skyrender): the Beast Pen keeps one wyvern and Elara\'s wyvern lives here, so Skyrender keeps waiting for a home.']]);
    t.equal(BR.creatureById(b, 'cr-hv-wyvern-skyrender').status, 'waiting');
    /* One that fits: the same order for a kind that is not housed. */
    var c = BR.fromSave(copy(res.save), data);
    c.creatures.push({ id: 'g9', species: 'buckbear', owner: '', name: 'Bramble', status: 'waiting', home: '', grantedDay: 30, housedDay: null, msgId: '' });
    var fit = order('f1', PEN, 'house_beast', { chosen: { label: 'Bramble', creatureId: 'g9' }, optionLabel: 'Bramble', label: 'Beast Pen: House Beast Here (Bramble)', dueDay: 41 });
    c.pendingOrders.push(fit);
    c.day = 41;
    t.equal(BR.completeSimpleOrder(c, data, fit, dice([0.5]))[0][0], 'Order Completed');
    t.same([BR.creatureById(c, 'g9').status, BR.creatureById(c, 'g9').home], ['housed', PEN]);
  });

  test('which slot becomes the Pen: a built one before one being built; of two built, the first; of several being built, the one ready first; the rest are freed', function (t) {
    function slots(list) {
      var res = convert(v3(function (s) { s.builtExtras = list; s.facilityLevels = { wyvern_roost: 2, griffin_tower: 3, dire_wolf_den: 4 }; }));
      t.same(res.problems, [], 'the audit');
      return res;
    }
    var a = slots(['library_scriptorium', old('wyvern_roost', { status: 'building', startDay: 5, readyDay: 26 }), old('griffin_tower'), old('dire_wolf_den')]);
    t.same(a.save.builtExtras.map(function (e) { return e && (e.facId || e); }), ['library_scriptorium', '', PEN, ''], 'the built Tower');
    var b = slots([old('dire_wolf_den'), old('griffin_tower'), old('wyvern_roost')]);
    t.same(b.save.builtExtras.map(function (e) { return e && (e.facId || e); }), [PEN, '', ''], 'the first built one');
    var c = slots([old('wyvern_roost', { status: 'building', startDay: 5, readyDay: 40 }), old('griffin_tower', { status: 'building', startDay: 6, readyDay: 28 }), old('dire_wolf_den', { status: 'building', startDay: 7, readyDay: 50 })]);
    t.same(c.save.builtExtras, ['', { facId: PEN, status: 'building', startDay: 6, readyDay: 28 }, ''], 'the one ready first, still being built');
    t.ok(/It is still being built \(ready on Day 28\)\./.test(c.save.migration.v4.lines.join(' ')));
    t.equal(c.save.facilityLevels[PEN], 1);
    t.same(['wyvern_roost', 'griffin_tower', 'dire_wolf_den'].filter(function (id) { return id in c.save.facilityLevels; }), []);
    var one = convert(v3(function (s) { s.builtExtras = [old('griffin_tower')]; s.facilityLevels = { griffin_tower: 3 }; }));
    var oneLine = noWar(one)[0];
    t.ok(/^Places that joined others\. The Griffin Tower has become the Beast Pen\./.test(oneLine), oneLine);
    t.equal(/other slot/.test(oneLine), false, 'nothing else to free');
  });

  test('beasts but no building left standing (it was demolished and they stayed): the Pen is built free in the first empty slot and the report says so; beasts that only wait need no Pen', function (t) {
    var res = convert(v3(function (s) {
      s.builtExtras = ['library_scriptorium', '', old('arcane_laboratory')];
      s.creatures = [creature('c1', 'griffin', 'Swiftwing', 'housed', 'griffin_tower', 2), creature('c2', 'dire_wolf', 'Ashfang', 'waiting', '', null)];
    }));
    t.same(res.problems, []);
    t.same(res.save.builtExtras.map(function (e) { return e && (e.facId || e); }), ['library_scriptorium', PEN, 'arcane_laboratory'], 'in the first empty slot, built');
    t.equal(res.save.facilityLevels[PEN], 1);
    t.same(res.save.creatures.map(function (c) { return [c.id, c.status, c.home]; }), [['c1', 'housed', PEN], ['c2', 'waiting', '']]);
    t.ok(/Your beasts had no building left standing, so the Beast Pen was built for you, free, in an empty slot/.test(res.save.migration.v4.lines.join(' ')));
    t.equal(res.save.archivedFacilities.some(function (a) { return a.facId === PEN; }), false);
    var full = convert(v3(function (s) {
      s.builtExtras = ['library_scriptorium', old('arcane_laboratory')];
      s.creatures = [creature('c1', 'griffin', 'Swiftwing', 'housed', 'griffin_tower', 1)];
    }));
    t.same(full.problems, []);
    t.same(full.save.builtExtras.map(function (e) { return e && (e.facId || e); }), ['library_scriptorium', 'arcane_laboratory', PEN], 'with no empty slot it stands beyond them (the Bastion keeps what it has)');
    var waiting = convert(v3(function (s) { s.creatures = [creature('c2', 'dire_wolf', 'Ashfang', 'waiting', '', null)]; }));
    t.same(waiting.problems, []);
    t.equal(BR.builtFacilityIds(waiting.save, data).indexOf(PEN), -1, 'a beast that only waits needs nothing built');
    t.same(noWar(waiting), [], 'nothing to say: it still waits');
    var none = convert(v3());
    t.same(noWar(none), [], 'no beasts and no old buildings: nothing to say');
    t.equal(BR.builtFacilityIds(none.save, data).indexOf(PEN), -1);
  });

  test('over the limit: two of one kind housed all stay, the report says which kind and that no more can be housed; a House order that cannot fit says it will keep waiting', function (t) {
    var res = convert(v3(function (s) {
      s.builtExtras = [old('griffin_tower')];
      s.creatures = [creature('g1', 'griffin', 'Swiftwing', 'housed', 'griffin_tower', 1), creature('g2', 'griffin', 'Talon', 'housed', 'griffin_tower', 0), creature('g3', 'griffin', 'Ash', 'waiting', '', null)];
      s.pendingOrders = [order('h1', 'griffin_tower', 'house_griffin', { chosen: { label: 'Ash', creatureId: 'g3' }, optionLabel: 'Ash', label: 'Griffin Tower: House a Griffin (Ash)', dueDay: 14 })];
    }));
    t.same(res.problems, []);
    t.same(res.save.creatures.map(function (c) { return [c.id, c.status, c.home]; }), [['g1', 'housed', PEN], ['g2', 'housed', PEN], ['g3', 'waiting', '']], 'everybody stays');
    var lines = res.save.migration.v4.lines.join('\n');
    t.ok(/The Beast Pen keeps one griffin, and 2 griffins live there\. They all stay: nothing is sent away\. No more griffins can be housed\./.test(lines), lines);
    t.ok(/The House order for Ash carries on, but the Beast Pen already holds a griffin, so Ash will keep waiting for a home when it completes\./.test(lines), lines);
    t.ok(/Talon still needs the Acclimatise With Beast roll at the Beast Pen before it can bond\./.test(lines), 'a Bond 0 beast must roll: ' + lines);
    t.ok(/A beast at Bond 1 or more counts as acclimatised: Swiftwing\./.test(lines));
  });

  test('orders: every House order moves keeping its id, cost, goods and due day; training and Upgrade orders are cancelled with everything given back; Elara\'s order moves too', function (t) {
    var res = convert(v3(function (s) {
      s.builtExtras = [old('wyvern_roost'), old('griffin_tower'), old('dire_wolf_den')];
      s.creatures = [creature('g1', 'griffin', 'Swiftwing', 'waiting', '', null), creature('w1', 'wyvern', 'Ash', 'waiting', '', null), creature('d1', 'dire_wolf', 'Ashfang', 'housed', 'dire_wolf_den', 1)];
      s.pendingOrders = [
        order('e', 'wyvern_roost', 'house_elara_wyvern', { chosen: { creatureId: 'elara_wyvern' }, label: 'Wyvern Roost: House Elara\'s Wyvern', dueDay: 14 }),
        order('w', 'wyvern_roost', 'house_wyvern', { chosen: { label: 'Ash', creatureId: 'w1' }, optionLabel: 'Ash', label: 'Wyvern Roost: House a Wyvern (Ash)', dueDay: 15 }),
        order('g', 'griffin_tower', 'house_griffin', { chosen: { label: 'Swiftwing', creatureId: 'g1' }, optionLabel: 'Swiftwing', label: 'Griffin Tower: House a Griffin (Swiftwing)', dueDay: 16, issuedDay: 13 }),
        order('t1', 'dire_wolf_den', 'dwf_riding_harness', { chosen: { label: 'Ashfang', trainCreatureId: 'd1' }, label: 'Dire Wolf Den: Commission Riding Harness (Ashfang)', costGP: 150, dueDay: 19 }),
        order('t2', 'griffin_tower', 'grf_keeper_routine', { chosen: { label: 'Swiftwing', trainCreatureId: 'g1' }, label: 'Griffin Tower: Establish Keeper\'s Routine (Swiftwing)', dueDay: 20 }),
        order('u1', 'wyvern_roost', 'upgrade', { meta: { kind: 'upgrade', toLevel: 2 }, label: 'Wyvern Roost: Upgrade to Level 2', dueDay: 21 })
      ];
    }));
    t.same(res.problems, []);
    t.same(res.save.pendingOrders.map(function (o) { return [o.id, o.facId, o.fnId, o.label, o.dueDay, o.issuedDay]; }), [
      ['e', PEN, 'house_beast', 'Beast Pen: House Beast Here (Elara\'s wyvern)', 14, 10],
      ['w', PEN, 'house_beast', 'Beast Pen: House Beast Here (Ash)', 15, 10],
      ['g', PEN, 'house_beast', 'Beast Pen: House Beast Here (Swiftwing)', 16, 13]
    ]);
    t.same(res.save.pendingOrders[0].chosen, { creatureId: 'elara_wyvern' }, 'what it houses is kept');
    t.same(res.report.cancelled.map(function (c) { return [c.id, c.gp]; }), [['t1', 150], ['t2', 0], ['u1', 0]]);
    t.equal(res.save.treasuryGP, 550, '150 gp back');
    t.same(res.report.cancelled.map(function (c) { return /nothing to upgrade/.test(c.why); }), [false, false, true]);
    /* Everything it moves still completes on its day. */
    var b = BR.fromSave(copy(res.save), data);
    b.day = 14;
    var e = b.pendingOrders[0];
    t.equal(BR.completeSimpleOrder(b, data, e, dice([0.5]))[0][0], 'Order Completed', 'Elara\'s order records her (a wyvern waits, but none is housed yet)');
  });

  test('a beast that is Bond 1 or more is acclimatised, Bond 0 must roll; a bond waiting for the DM\'s scene still waits; nothing is credited and nothing rolled', function (t) {
    var ready = creature('r1', 'griffin', 'Swiftwing', 'housed', 'griffin_tower', 2);
    ready.development.bond.ready = 3;
    var res = convert(v3(function (s) {
      s.builtExtras = [old('griffin_tower')];
      s.creatures = [ready, creature('r2', 'dire_wolf', 'Ashfang', 'housed', 'griffin_tower', 0)];
    }));
    t.same(res.problems, []);
    t.same(res.save.creatures.map(function (c) { return [c.development.bond.level, c.development.bond.ready, c.development.bonding, c.development.acclimatise, c.development.initiation]; }), [[2, 3, undefined, undefined, undefined], [0, null, undefined, undefined, undefined]]);
    var lines = res.save.migration.v4.lines.join('\n');
    t.ok(/Swiftwing's Bond 3 milestone was waiting for your scene, and still is: confirm it in the Beast Pen\./.test(lines));
    t.ok(/Ashfang still needs the Acclimatise With Beast roll/.test(lines));
    var again = BR.migrateToV4(copy(res.before), data);
    t.equal(canon(again.save), canon(res.save), 'no dice: the same every time');
  });

  test('a version 4 save that an older copy of the suite overwrote (a Roost in a slot, a beast at the old home) is converted again, with the Bastion\'s "tidied again" notice, and nothing is lost', function (t) {
    var once = convert(v3(function (s) {
      s.builtExtras = [old('griffin_tower')];
      s.creatures = [creature('g1', 'griffin', 'Swiftwing', 'housed', 'griffin_tower', 1)];
    })).save;
    var dirty = copy(once);
    dirty.builtExtras = dirty.builtExtras.concat([old('wyvern_roost')]);
    dirty.facilityLevels.wyvern_roost = 2;
    dirty.creatures[0].home = 'griffin_tower';
    var steps = BR.stripBackLeftovers(dirty, data).map(function (l) { return l.step; });
    t.ok(steps.indexOf('rehomeBeasts') !== -1 && steps.every(function (x) { return x === 'rehomeBeasts' || x === 'sweepFacilities'; }), JSON.stringify(steps));
    var res = convert(dirty);
    t.same(res.problems, []);
    t.equal(res.report.again, true);
    t.same(res.save.builtExtras.map(function (e) { return e && (e.facId || e); }), [PEN, ''], 'the Pen that was already there stays; the Roost\'s slot is free');
    t.equal(res.save.creatures[0].home, PEN);
    t.equal(BR.needsStripBack(res.save, data), false);
  });

  test('every earlier fixture still converts safely: the two that had the three buildings (and no beasts) get their one Pen', function (t) {
    ['bastion-pr7-sample', 'bastion-pr8a-sample'].forEach(function (name) {
      var res = convert(FIX[name]);
      t.same(res.problems, [], name);
      var ids = res.save.builtExtras.filter(Boolean).map(function (e) { return e.facId; });
      t.same(ids.filter(function (id) { return /^(beast_pen|wyvern_roost|griffin_tower|dire_wolf_den)$/.test(id); }), [PEN], name + ': one Pen, no old building');
      t.same(res.save.creatures, [], name + ': no beasts, none made');
      t.ok(/have become one Beast Pen/.test(res.save.migration.v4.lines.join(' ')), name);
    });
    ['bastion-before-overhaul', 'bastion-pr3-sample', 'bastion-pr5-sample', 'bastion-pr6-sample', 'bastion-pr8b-sample'].forEach(function (name) {
      var res = convert(FIX[name]);
      t.equal(res.save.migration.v4.lines.join(' ').indexOf('Beast Pen'), -1, name + ' has nothing to say about the Pen');
      t.equal(BR.builtFacilityIds(res.save, data).indexOf(PEN), -1, name + ' gets no Pen');
    });
  });

  test('a damaged field in the beast parts is ignored, not refused', function (t) {
    ['x', 5, null, [1], {}].forEach(function (v) {
      var res = convert(v3(function (s) { s.creatures = v; s.builtExtras = [old('wyvern_roost')]; s.facilityLevels = { wyvern_roost: v }; s.repairs = { griffin_tower: v }; }));
      t.same(res.problems, [], JSON.stringify(v));
      t.equal(res.save.v, 4);
    });
    var odd = convert(v3(function (s) { s.pendingOrders = ['junk', null, order('o1', 'wyvern_roost', 'house_wyvern', { chosen: 'x' })]; s.builtExtras = [old('wyvern_roost')]; }));
    t.same(odd.problems, [], 'an order with no creature is cancelled, not a problem');
    t.equal(odd.report.cancelled.filter(function (c) { return c.id === 'o1'; }).length, 1);
  });
}());
