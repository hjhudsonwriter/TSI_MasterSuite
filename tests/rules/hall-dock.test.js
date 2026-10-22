/* The Dock takes the Port Charter system and the Routes map (step S08), and the Hall of Emissaries
   is stripped to a single-level read-only facility (step S09) of the Strip Back Overhaul (Harry,
   22 October 2026). Rules only: tools/bastion/strip-back-rules.js (the conversion steps
   moveCharterOrders, endOldProtections, windDownHall), tools/bastion/commerce-rules.js (the Routes
   map) and tools/bastion/diplomacy-rules.js (the Diplomatic Events ledger, unchanged).
   The design: docs/strip-back/F-temple-hall-dock.md and docs/strip-back/J-cross-cutting.md 4.3, 4.4;
   what was built: docs/strip-back/S08-S09-built.md. The click-throughs are tests/e2e/dock.test.js and
   tests/e2e/hall-records.test.js. */
(function () {
  var R = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures, warRoom: T.bastionWarRoom };
  var FIX = window.TSI_FIXTURES || {};
  var canon = R.stripBackCanon;

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function dice(list) { var i = 0; return function () { var v = list[i % list.length]; i++; return v; }; }
  /* A plain version 3 Bastion on Day 12, edited by fn. */
  function v3(fn) {
    var s = clone(R.toSave(R.defaultState(data)));
    s.v = 3;
    s.day = 12;
    s.anchored = true;
    s.treasuryGP = 400;
    s.partyLevel = 13;
    if (fn) fn(s);
    return s;
  }
  function convert(raw) {
    var res = R.migrateToV4(raw, data);
    res.problems = R.stripBackAudit(res.before, res.save, res.report, data);
    return res;
  }
  /* Text a person reads must not have these in it. */
  function jargon(text) {
    var bad = [];
    if (/undefined|null|NaN|\[object|Infinity/.test(text)) bad.push('a code word');
    if (/\b[a-z]+_[a-z_]+\b/.test(text)) bad.push('an id with an underscore');
    if (/\b(facId|fnId|pendingOrders|treasuryGP|builtExtras|tradeNetwork)\b/.test(text)) bad.push('a field name');
    if (/\b1 (orders|lots|places|shipments)\b/.test(text)) bad.push('a plural after 1');
    if (/\b[2-9] (order was|place was)\b/.test(text)) bad.push('a singular after a number');
    if (/  /.test(text)) bad.push('a double space');
    return bad;
  }
  var HALL = 'hall_of_emissaries';
  function charter(id, port, clan, status, extra) {
    return Object.assign({ id: id, port: port, clan: clan, mode: 'commodity_backed', status: status, earnedDay: 3, registeredDay: status === 'registered' ? 6 : null, terms: {}, from: { code: 'DM', title: 'DM award' }, text: '' }, extra || {});
  }
  function registerOrder(id, charterId, port, extra) {
    return Object.assign({ id: id, facId: HALL, fnId: 'register_port_charter', chosen: { label: 'Port Charter: ' + port, charterId: charterId }, optionLabel: port, notes: '', label: 'Hall of Emissaries: Register Port Charter (' + port + ')', costGP: 0, issuedDay: 10, dueDay: 13 }, extra || {});
  }

  /* ================================================================================================ */
  group('The Dock takes the Port Charters (S08): their order');

  test('a Register Port Charter order at the Hall MOVES to the Dock: same id, due day, issue day, cost and Charter; only its place and name change', function (t) {
    var raw = v3(function (s) {
      s.tradeNetwork.portCharters = [charter('c-gold', 'goldport', 'molten', 'earned')];
      s.pendingOrders = [registerOrder('o-reg', 'c-gold', 'Goldport')];
    });
    var res = convert(raw);
    t.same(res.problems, [], 'the audit is clean');
    var o = res.save.pendingOrders[0];
    t.same([o.id, o.facId, o.fnId, o.label, o.optionLabel, o.costGP, o.issuedDay, o.dueDay, o.chosen.charterId], ['o-reg', 'dock', 'register_port_charter', 'Dock: Register Port Charter (Goldport)', 'Goldport', 0, 10, 13, 'c-gold']);
    t.same(res.report.moved, [{ id: 'o-reg', label: 'Hall of Emissaries: Register Port Charter (Goldport)', to: 'the Dock' }]);
    t.same(res.report.cancelled, []);
    t.same(res.save.tradeNetwork.portCharters, raw.tradeNetwork.portCharters, 'the Charter itself is untouched');
    t.equal(res.save.treasuryGP, 400, 'free: no gold moves');
  });

  test('it says so plainly: one line under Trade, and the move under Orders, with nothing a person cannot read', function (t) {
    var res = convert(v3(function (s) {
      s.tradeNetwork.portCharters = [charter('c-gold', 'goldport', 'molten', 'earned')];
      s.pendingOrders = [registerOrder('o-reg', 'c-gold', 'Goldport')];
    }));
    var trade = res.report.lines.filter(function (l) { return /^Trade\. /.test(l); });
    t.equal(trade.length, 1);
    t.equal(trade[0], 'Trade. Your Register Port Charter order carries on at the Dock, with the same due day. Port Charters, their terms and the Routes map all belong to the Dock now.');
    t.ok(res.report.lines.some(function (l) { return /^Orders\. One order moved with its place, keeping its due day: Hall of Emissaries: Register Port Charter \(Goldport\) \(now at the Dock\)\.$/.test(l); }), res.report.lines.join(' | '));
    res.report.lines.forEach(function (l) { t.same(jargon(l), [], l); });
    var two = convert(v3(function (s) {
      s.tradeNetwork.portCharters = [charter('c-gold', 'goldport', 'molten', 'earned'), charter('c-timb', 'timberport', 'blackstone', 'earned')];
      s.pendingOrders = [registerOrder('o-1', 'c-gold', 'Goldport'), registerOrder('o-2', 'c-timb', 'Timberport', { dueDay: 14 })];
    }));
    t.ok(two.report.lines.some(function (l) { return /^Trade\. Your 2 Register Port Charter orders carry on at the Dock, with the same due days\./.test(l); }));
    t.same(two.problems, []);
  });

  test('a moved order completes at the Dock on its own day: the Charter is registered, once, and nothing goes into the Warehouse', function (t) {
    var raw = v3(function (s) {
      s.tradeNetwork.portCharters = [charter('c-gold', 'goldport', 'molten', 'earned')];
      s.pendingOrders = [registerOrder('o-reg', 'c-gold', 'Goldport')];
    });
    var b = R.fromSave(raw, data);
    t.equal(R.orderKind(data, b.pendingOrders[0]), 'simple', 'no roll');
    b.day = 13;
    var o = b.pendingOrders[0];
    var lines = R.completeSimpleOrder(b, data, o, dice([0.5]));
    R.removeOrder(b, o.id);
    t.ok(/The Port Charter for .*Goldport.* is registered\./.test(lines[0][1]), lines[0][1]);
    var c = R.charterFor(b, 'goldport');
    t.same([c.status, c.registeredDay, b.warehouse.length], ['registered', 13, 0]);
    t.equal(R.charterState(b, c), 'Registered on Day 13');
  });

  test('a Register order that is moved when its Charter is already registered still ends harmlessly', function (t) {
    var raw = v3(function (s) {
      s.tradeNetwork.portCharters = [charter('c-gold', 'goldport', 'molten', 'registered')];
      s.pendingOrders = [registerOrder('o-reg', 'c-gold', 'Goldport')];
    });
    var b = R.fromSave(raw, data);
    b.day = 13;
    var again = R.completeSimpleOrder(b, data, b.pendingOrders[0], dice([0.5]));
    t.ok(/already registered on Day 6, so nothing changed/.test(again[0][1]), again[0][1]);
    t.equal(R.charterFor(b, 'goldport').registeredDay, 6);
  });

  test('an order with no id cannot be followed: it is cancelled, free, and said so', function (t) {
    var raw = v3(function (s) {
      s.tradeNetwork.portCharters = [charter('c-gold', 'goldport', 'molten', 'earned')];
      var o = registerOrder('x', 'c-gold', 'Goldport');
      delete o.id;
      s.pendingOrders = [o];
    });
    var res = convert(raw);
    t.same(res.problems, []);
    t.equal(res.save.pendingOrders.length, 0);
    t.equal(res.report.cancelled.length, 1);
    t.equal(res.report.cancelled[0].gp, 0);
  });

  test('it is idempotent: converting the result again changes nothing, and a Bastion with no such order leaves no trace', function (t) {
    var res = convert(v3(function (s) {
      s.tradeNetwork.portCharters = [charter('c-gold', 'goldport', 'molten', 'earned')];
      s.pendingOrders = [registerOrder('o-reg', 'c-gold', 'Goldport')];
    }));
    t.equal(R.needsStripBack(res.save, data), false);
    t.equal(canon(R.migrateToV4(res.save, data).save), canon(res.save));
    var clean = convert(v3());
    t.equal(clean.report.lines.filter(function (l) { return /^Trade\. /.test(l); }).length, 0, 'nothing to say about trade');
  });

  test('a version 4 Bastion that an older copy of the suite put a Hall Register order back into is found and moved again', function (t) {
    var res = convert(v3(function (s) {
      s.tradeNetwork.portCharters = [charter('c-gold', 'goldport', 'molten', 'earned')];
    }));
    var dirty = clone(res.save);
    dirty.pendingOrders.push(registerOrder('o-late', 'c-gold', 'Goldport'));
    t.same(R.stripBackLeftovers(dirty, data), [{ step: 'moveCharterOrders', what: 'a Register Port Charter order at the Hall of Emissaries' }]);
    var again = convert(dirty);
    t.same(again.problems, []);
    t.equal(again.save.pendingOrders[0].facId, 'dock');
  });

  test('the heavy fixture: its Hall Register order moves, the audit is clean, and the ship, charters and sales are exactly as they were', function (t) {
    var raw = FIX['bastion-v3-heavy'];
    var res = convert(raw);
    t.same(res.problems, []);
    var o = res.save.pendingOrders.filter(function (x) { return x.id === 'hv-23'; })[0];
    t.same([o.facId, o.fnId, o.label, o.dueDay], ['dock', 'register_port_charter', 'Dock: Register Port Charter (Timberport)', 41]);
    ['portCharters', 'voyages', 'schedules', 'cargoSales', 'marketLedger', 'parcels'].forEach(function (k) {
      t.equal(canon(res.save.tradeNetwork[k]), canon(raw.tradeNetwork[k]), k + ' is exactly as it was');
    });
    t.equal(canon(res.save.tradeNetwork.protections.pelagos_blessing), canon(raw.tradeNetwork.protections.pelagos_blessing), 'the held Blessing of Pelagos too');
  });

  /* ================================================================================================ */
  group('The Dock takes the Port Charters (S08): the Barracks\' Convoy and the Watchtower\'s Approaches are gone');

  test('a prepared Convoy and a running Approaches window end, with a line; nothing is owed; the Blessing of Pelagos stays exactly', function (t) {
    var raw = v3(function (s) {
      s.tradeNetwork.protections = { commercial_convoy: { charges: 1 }, maritime_approaches: { untilDay: 20 }, pelagos_blessing: { charges: 2 } };
    });
    var res = convert(raw);
    t.same(res.problems, []);
    t.same(res.save.tradeNetwork.protections, { pelagos_blessing: { charges: 2 } });
    t.equal(res.save.treasuryGP, 400);
    var line = res.report.lines.filter(function (l) { return /^Trade\. /.test(l); })[0];
    t.equal(line, 'Trade. The Barracks and the Watchtower are gone, so a prepared Commercial Convoy and a window of Protected Maritime Approaches ended with them. They cost no gold to prepare, so nothing is owed back. The Blessing of Pelagos still protects a ship.');
    t.same(jargon(line), []);
  });

  test('one alone is said alone; an empty or ended one goes quietly', function (t) {
    var one = convert(v3(function (s) { s.tradeNetwork.protections = { maritime_approaches: { untilDay: 12 } }; }));
    t.ok(/a window of Protected Maritime Approaches ended with it\./.test(one.report.lines.join(' ')), one.report.lines.join(' | '));
    var quiet = convert(v3(function (s) { s.tradeNetwork.protections = { commercial_convoy: { charges: 0 }, maritime_approaches: { untilDay: 5 } }; }));
    t.same(quiet.save.tradeNetwork.protections, {});
    t.equal(quiet.report.lines.length, 0, 'nothing worth a line');
    t.same(quiet.problems, []);
  });

  test('a version 4 Bastion holding a live Convoy is converted again and loses only the Convoy', function (t) {
    var res = convert(v3());
    var dirty = clone(res.save);
    dirty.tradeNetwork.protections = { commercial_convoy: { charges: 1 }, pelagos_blessing: { charges: 1 } };
    t.same(R.stripBackLeftovers(dirty, data), [{ step: 'endOldProtections', what: 'a prepared Commercial Convoy' }]);
    var again = convert(dirty);
    t.same(again.problems, []);
    t.same(again.save.tradeNetwork.protections, { pelagos_blessing: { charges: 1 } });
  });

  test('the Dock\'s protection list reads only the data: just the Blessing of Pelagos', function (t) {
    var b = R.defaultState(data);
    t.same(R.protectionStatus(b, data).map(function (p) { return p.id; }), ['pelagos_blessing']);
  });

  /* ================================================================================================ */
  group('The Dock takes the Routes map (S08): which Clans glow');

  function bastionWith(charters, voyages, orders) {
    var b = R.defaultState(data);
    b.day = 20;
    b.anchored = true;
    b.tradeNetwork.portCharters = charters || [];
    b.tradeNetwork.voyages = voyages || [];
    b.pendingOrders = orders || [];
    return b;
  }
  function ship(id, port, clan, charterId, stage, extra) {
    return Object.assign({ id: id, port: port, clan: clan, charterId: charterId, mode: 'commodity_backed', cargo: [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 1 }], departDay: 18, arriveDay: 25, returnDay: 32, stage: stage || 'outbound', risk: 'low', basePct: 5, protections: [], chance: 5, scheduleId: null, outcome: stage === 'returning' ? 'sold' : null, recalledDay: null, roll: null, terms: null }, extra || {});
  }

  test('with no Port Charter nothing glows, and the rows are empty', function (t) {
    var m = R.routesMap(bastionWith(), data);
    t.same([m.lanes, m.rows, m.ships], [[], [], 0]);
  });

  test('a REGISTERED Charter lights its Clan\'s lane, steadily; an earned one, or one being registered, lights nothing but is listed', function (t) {
    var b = bastionWith([charter('c-gold', 'goldport', 'molten', 'registered'), charter('c-timb', 'timberport', 'blackstone', 'earned'), charter('c-stee', 'steelport', 'slade', 'earned')],
      [], [registerOrder('o', 'c-stee', 'Steelport', { facId: 'dock' })]);
    var m = R.routesMap(b, data);
    t.same(m.lanes.map(function (l) { return [l.key, l.name, l.glow, l.ships, l.ports]; }), [['molten', 'Molten', 'registered', 0, ['Goldport']]]);
    t.equal(m.lanes[0].art, 'ui/molten_trade_route.png');
    t.same(m.rows.map(function (r) { return [r.port, r.clan, r.status]; }), [['goldport', 'molten', 'registered'], ['timberport', 'blackstone', 'earned'], ['steelport', 'slade', 'registering']]);
    t.equal(m.rows[2].stateText, 'Being registered at the Dock (ready Day 13)');
    t.equal(m.rows[1].stateText, 'Earned on Day 3: register it at the Dock');
  });

  test('two ports of one Clan light the same lane once (ten ports, seven lanes)', function (t) {
    var b = bastionWith([charter('c-gold', 'goldport', 'molten', 'registered'), charter('c-mol', 'moltenport', 'molten', 'registered'), charter('c-ste', 'steelport', 'slade', 'registered')]);
    var m = R.routesMap(b, data);
    t.same(m.lanes.map(function (l) { return [l.name, l.ports.length]; }), [['Slade', 1], ['Molten', 2]], 'in the Clans\' own order');
  });

  test('a ship at sea makes its Clan\'s lane glow brighter, outbound or on its way home, and even if its Charter is not registered now', function (t) {
    var b = bastionWith([charter('c-gold', 'goldport', 'molten', 'registered'), charter('c-timb', 'timberport', 'blackstone', 'registered')],
      [ship('v1', 'goldport', 'molten', 'c-gold', 'outbound'), ship('v2', 'steelport', 'slade', 'gone', 'returning')]);
    var m = R.routesMap(b, data);
    t.same(m.lanes.map(function (l) { return [l.name, l.glow, l.ships]; }), [['Blackstone', 'registered', 0], ['Slade', 'sea', 1], ['Molten', 'sea', 1]]);
    t.equal(m.ships, 2);
    var gold = m.rows.filter(function (r) { return r.port === 'goldport'; })[0];
    t.equal(gold.atSea, 1);
    t.ok(/^Sailing to Goldport: arrives Day 25, home Day 32$/.test(gold.ships[0]), gold.ships[0]);
  });

  test('the Clan comes from the Charter first (a ship\'s own record can be a name, or old)', function (t) {
    var b = bastionWith([charter('c-gold', 'goldport', 'molten', 'registered')], [ship('v1', 'goldport', 'Clan Karr', 'c-gold', 'outbound')]);
    t.same(R.routesMap(b, data).lanes.map(function (l) { return [l.key, l.glow]; }), [['molten', 'sea']]);
    var c = bastionWith([], [ship('v1', 'goldport', 'Clan Karr', '', 'outbound')]);
    t.same(R.routesMap(c, data).lanes.map(function (l) { return [l.key, l.glow]; }), [['karr', 'sea']], 'no Charter on record: the ship\'s own record, "Clan Karr" read as karr');
  });

  test('every Clan has a lane picture, and the map is only ever read (the Bastion is unchanged)', function (t) {
    T.bastion.clans.forEach(function (c) { t.equal(T.bastion.routeOverlays[c.key], 'ui/' + c.key + '_trade_route.png', c.key); });
    var b = bastionWith([charter('c-gold', 'goldport', 'molten', 'registered')], [ship('v1', 'goldport', 'molten', 'c-gold', 'outbound')]);
    var before = canon(b);
    R.routesMap(b, data);
    t.equal(canon(b), before);
  });

  test('the heavy fixture: Goldport\'s registered Charter and its ship at sea light Slade\'s lane, as that Charter says', function (t) {
    var b = R.fromSave(clone(FIX['bastion-v3-heavy']), data);
    var m = R.routesMap(b, data);
    t.same(m.lanes.map(function (l) { return [l.key, l.glow]; }), [['slade', 'sea']]);
    t.same(m.rows.map(function (r) { return [r.port, r.status]; }), [['timberport', 'registering'], ['goldport', 'registered']]);
  });
}());
