/* Reset the Explorer to Day 1, blank (Harry, 26 October 2026): what the Explorer clears and keeps
   (tools/explorer/rules.js R.resetToDayOne), and what the Bastion drops of the Explorer's deliveries and keeps
   (tools/bastion/rules.js R.clearExplorerDeliveries). */
(function () {
  var ER = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var ED = T.explorer;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  function copy(v) { return JSON.parse(JSON.stringify(v)); }

  group('Reset to Day 1: the Explorer');

  function busyExplorer() {
    var s = ER.defaultState(ED);
    ER.loadPreset(s, ED, 'the_east_isle');
    s.travel.day = 9;
    s.travel.provinceId = 'eastern_province';
    s.travel.extraMiles = 6;
    s.travel.dayLost = true;
    s.travel.activeWeather = { kind: Object.keys(ED.weatherVideos)[0], day: 9 };
    s.travel.forcedMainEvent = { id: 'x', dueDay: 12 };
    s.tokens.forEach(function (t) { t.milesUsed = 18; });
    s.tokens[0].groupId = 'g1';
    s.tokens[0].x = 0.4;
    s.freeMove = true;
    s.grid.r = 50; s.grid.opacity = 0.7;
    s.fog.enabled = true;
    ER.reveal(s, { q: 5, r: 5 }, 2);
    s.journey.gold = 80;
    s.journey.log = ['something happened'];
    s.journey.effects = [{ id: 'e', name: 'A boon', day: 3, untilDay: null }];
    s.journey.threads = [{ id: 't', name: 'A thread', day: 3 }];
    s.journey.outbox = [{ id: 'm1', type: 'standing', day: 3 }];
    s.journey.inventory = [{ id: 'i', kind: J.CHART, qty: 2 }];
    s.journey.current = { id: 'zz', kind: 'camp' };
    s.journey.tonight = { event: 'c1' };
    return s;
  }

  test('day, miles, weather, chart, Free Move and any pending event go back to the start', function (t) {
    var s = busyExplorer();
    ER.resetToDayOne(s, function () { return 0.5; });
    t.same([s.travel.day, s.travel.extraMiles, s.travel.dayLost, s.travel.activeWeather, s.travel.forcedMainEvent, s.freeMove], [1, 0, false, null, null, false]);
    t.same(s.tokens.map(function (x) { return x.milesUsed; }), s.tokens.map(function () { return 0; }));
    t.equal(ER.dayLimit(s), 30);
    t.equal(s.journey.current, null);
    t.equal(s.journey.tonight, null);
  });

  test('threads, effects, gold, log, bags and the messages for the Bastion are all blank', function (t) {
    var s = busyExplorer();
    ER.resetToDayOne(s, function () { return 0.5; });
    t.same(s.journey, J.empty());
  });

  test('the map, its grid, the fog, the region and the heroes (names, places, groups) stay', function (t) {
    var s = busyExplorer();
    var names = s.tokens.map(function (x) { return x.name; });
    var fog = copy(s.fog);
    ER.resetToDayOne(s, function () { return 0.5; });
    t.equal(s.mapPresetId, 'the_east_isle');
    t.same([s.grid.r, s.grid.opacity], [50, 0.7]);
    t.same(s.fog, fog);
    t.equal(s.travel.provinceId, 'eastern_province');
    t.same(s.tokens.map(function (x) { return x.name; }), names);
    t.same([s.tokens[0].x, s.tokens[0].groupId], [0.4, 'g1']);
  });

  test('a resetId is made, saved and read back, and the reset survives a reload', function (t) {
    var s = busyExplorer();
    ER.resetToDayOne(s, function () { return 0.5; });
    t.ok(/^[A-Za-z0-9]+$/.test(s.resetId));
    var back = ER.fromSave(copy(ER.toSave(s)), ED, T.journeyEvents);
    t.equal(back.resetId, s.resetId);
    t.equal(back.travel.day, 1);
    t.same(back.journey.outbox, []);
  });

  test('a new reset makes a new id; a plain save has none', function (t) {
    var s = ER.defaultState(ED);
    t.equal(ER.toSave(s).resetId, '');
    ER.resetToDayOne(s, function () { return 0.2; });
    var a = s.resetId;
    ER.resetToDayOne(s, function () { return 0.7; });
    t.ok(a !== s.resetId);
  });

  group('Reset to Day 1: the Bastion drops what the Explorer delivered');

  function bastion() {
    var b = BR.defaultState(bdata);
    b.day = 12; b.anchored = true; b.partyLevel = 9; b.treasuryGP = 321;
    b.warehouse = [{ name: 'Rope', qty: 4 }];
    b.pendingOrders = [{ id: 'o1', facId: 'workshop', label: 'Workshop: craft', issuedDay: 10, dueDay: 14 }];
    b.honourRespectByClan.slade = 5;
    b.bridge = { fresh: false, done: {
      a1: { r: 'applied', day: 3, at: 1, clan: 'slade', hr: 1, was: 4, now: 5, text: 'Honour', why: '' },
      a2: { r: 'skipped', day: 3, at: 1, clan: '', hr: 0, was: 0, now: 0, text: '', why: 'Sent before this Bastion started.' }
    }, resetSeen: '' };
    b.creatures = [
      { id: 'elara_wyvern', species: 'wyvern', owner: 'elara', name: '', status: 'housed', home: 'beast_pen', grantedDay: 1, housedDay: 1, msgId: '' },
      { id: 'cr-a', species: 'griffin', owner: '', name: 'Waiting', status: 'waiting', home: '', grantedDay: 5, housedDay: null, msgId: 'm-a:dm:0' },
      { id: 'cr-b', species: 'griffin', owner: '', name: 'Housed', status: 'housed', home: 'beast_pen', grantedDay: 5, housedDay: 6, msgId: 'm-b:dm:0' }
    ];
    b.portCharters = [
      { id: 'c-earned', port: 'goldport', clan: 'molten', status: 'earned', registeredDay: null, terms: {}, from: {}, text: '' },
      { id: 'c-reg', port: 'timberport', clan: 'farmer', status: 'registered', registeredDay: 8, terms: {}, from: {}, text: '' },
      { id: 'c-busy', port: 'ironport', clan: 'blackstone', status: 'earned', registeredDay: null, terms: {}, from: {}, text: '' }
    ];
    b.pendingOrders.push({ id: 'o2', facId: 'dock', fnId: 'register_port_charter', label: 'Dock: Register', issuedDay: 11, dueDay: 20, chosen: { charterId: 'c-busy' } });
    b.greatRites = [{ id: 'r1', rite: 'earths_endurance', god: 'telluria', madeDay: 4, status: 'assigned', assignedDay: 6 }];
    return b;
  }

  test('the receipts and the memory of seen messages go, once', function (t) {
    var b = bastion();
    var out = BR.clearExplorerDeliveries(b, 'reset1');
    t.equal(out.receipts, 2);
    t.same(b.bridge.done, {});
    t.equal(b.bridge.resetSeen, 'reset1');
    t.equal(BR.clearExplorerDeliveries(b, 'reset1'), null, 'the same reset again does nothing');
    t.equal(BR.clearExplorerDeliveries(b, ''), null, 'no id, no change');
  });

  test('creatures still waiting for a home (granted by the Explorer) go; housed ones and Elara\'s wyvern stay', function (t) {
    var b = bastion();
    var out = BR.clearExplorerDeliveries(b, 'r');
    t.equal(out.creatures, 1);
    t.same(b.creatures.map(function (c) { return c.id; }), ['elara_wyvern', 'cr-b']);
  });

  test('Port Charters only held go; registered ones, and one with a Register order running, stay', function (t) {
    var b = bastion();
    var out = BR.clearExplorerDeliveries(b, 'r');
    t.equal(out.charters, 1);
    t.same(b.portCharters.map(function (c) { return c.id; }), ['c-reg', 'c-busy']);
  });

  test('buildings, orders, treasury, Warehouse, scores, day and Great Rites are untouched', function (t) {
    var b = bastion();
    var before = copy(b);
    BR.clearExplorerDeliveries(b, 'r');
    ['treasuryGP', 'warehouse', 'pendingOrders', 'honourRespectByClan', 'day', 'builtExtras', 'builtPlots', 'greatRites', 'facilityLevels'].forEach(function (k) {
      t.same(b[k], before[k], k + ' is untouched');
    });
  });

  test('the resetSeen memory survives a save and reload, so a reload does not clear again', function (t) {
    var b = bastion();
    BR.clearExplorerDeliveries(b, 'r9');
    var back = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.equal(back.bridge.resetSeen, 'r9');
    t.equal(BR.clearExplorerDeliveries(back, 'r9'), null);
  });

  test('a Bastion that has just started from nothing stays fresh, so it still skips what was sent before it', function (t) {
    var b = bastion();
    b.bridge = { fresh: true, done: {} };
    BR.clearExplorerDeliveries(b, 'r');
    t.equal(b.bridge.fresh, true);
  });

  test('after the clear, a fresh Day 1 message applies as normal (nothing is skipped as old)', function (t) {
    var b = bastion();
    BR.clearExplorerDeliveries(b, 'r');
    var msg = { id: 'abc123-1a2b3c4d:won:2', type: 'standing', day: 12, at: '2026-10-26T10:00:00.000Z', from: { code: 'T4', title: 'x', step: 'won' }, clan: 'slade', hr: 1, text: 'Honour/Respect +1 with Clan Slade.' };
    var res = BR.applyInbox(b, bdata, { travel: { day: 12 }, journey: { outbox: [msg] } }, 1000);
    t.equal(res.skipped, 0);
    t.equal(b.bridge.done['abc123-1a2b3c4d:won:2'].r, 'applied', JSON.stringify(b.bridge.done['abc123-1a2b3c4d:won:2']));
  });
}());
