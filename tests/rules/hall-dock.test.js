/* The Dock takes the Port Charter system and the Routes map (step S08), and the Hall of Emissaries
   is stripped to a single-level read-only facility (step S09) of the Strip Back Overhaul (Harry,
   22 October 2026). Rules only: tools/bastion/strip-back-rules.js (the conversion steps
   moveCharterOrders, windDownHall), tools/bastion/commerce-rules.js (the Routes
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
  /* A version 3 Bastion always has the Barracks, Armoury and Watchtower, which the war game's step says are gone: that line is
     not the Hall's, so a test about what the Hall says leaves it out. */
  function hallSays(res) { return res.report.lines.filter(function (l) { return !/^Places that are gone\. /.test(l); }); }
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

  test('the Dock\'s protection list reads only the data: just the Blessing of Pelagos (a held Convoy or Approaches is dropped by the war step, dropWarFacilities)', function (t) {
    var b = R.defaultState(data);
    t.same(R.protectionStatus(b, data).map(function (p) { return p.id; }), ['pelagos_blessing']);
    var res = convert(v3(function (s) { s.tradeNetwork.protections = { commercial_convoy: { charges: 1 }, pelagos_blessing: { charges: 2 } }; }));
    t.same(res.problems, []);
    t.same(res.save.tradeNetwork.protections, { pelagos_blessing: { charges: 2 } }, 'the Blessing stays exactly');
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

  /* ================================================================================================ */
  group('The Hall of Emissaries is stripped (S09): what is left of it');

  test('the Hall has no orders and one level: no Upgrade, no actions, no level effects; its tile and panel name still stand', function (t) {
    var hall = R.facility(data, HALL);
    t.same([hall.functions, hall.singleLevel, hall.name, hall.requiredLevel], [[], true, 'Hall of Emissaries', 5]);
    var s = R.defaultState(data);
    s.builtExtras = [{ facId: HALL, status: 'built' }];
    R.ensureLevels(s, data);
    t.same(R.upgradeCheck(s, data, HALL), { ok: false, top: true, single: true, message: 'The Hall of Emissaries has one level only.' });
    t.equal(R.issueUpgrade(s, data, HALL, dice([0.3])).ok, false, 'an Upgrade can\'t be ordered');
    t.equal(s.pendingOrders.length, 0);
    t.equal(T.bastion.levelEffects.hall_of_emissaries, undefined, 'no "Diplomacy rolls +4" line');
    t.same(R.levelUnlocks(data, HALL, 3), []);
  });

  test('the Hall\'s rules are gone: actions, rolls, contracts, routes, the Council Ledger, the Trade Network', function (t) {
    ['isEmissary', 'emissaryPlan', 'applyEmissary', 'hallBaseDays', 'withSummitDiscount', 'cooldownLeft', 'setCooldown', 'diplomacyModForHall', 'clanReactionLine',
      'issueOrderWithMeta', 'tickDiplomacy', 'passiveIncome', 'nextShipmentDay', 'shipmentsLeft', 'daysLeft', 'routeDC', 'routePayout', 'routeOutcomeFromTier', 'liveRoutes',
      'markSettled', 'routeNeedsRoll', 'settleRoute', 'routesToSettle', 'routesDueToday', 'enqueueDispute', 'councilBonus', 'rule', 'issueNetworkUpgrade', 'completeNetworkUpgrade',
      'upgradeHall', 'tierFromRoll', 'formatTier'].forEach(function (name) { t.equal(typeof R[name], 'undefined', name + ' is gone'); });
    ['hallDC', 'hallTiers', 'tradeAgreementWeeks', 'delegation', 'networkUpgrades', 'councilDC', 'reactions', 'hallTips', 'hallClanOrder', 'clanTrade', 'consortiumName'].forEach(function (k) {
      t.equal(T.bastion[k], undefined, 'the data for ' + k + ' is gone');
    });
    t.equal(typeof R.clanRelations, 'function', 'Clan Relations stays');
    t.equal(typeof R.createDipRecord, 'function', 'and so does the Diplomatic Events ledger');
  });

  test('a new Bastion holds no contracts, routes or disputes, and no Trade Network fields; only Favour Tokens (for the Clan Influence panel until it goes) and the empty history', function (t) {
    var s = R.defaultState(data);
    t.same(s.diplomacy, { tokens: 0 });
    t.same(s.legacyDiplomacy, { records: [] });
    t.equal('arbitration' in s, false);
    t.same(Object.keys(s.tradeNetwork), ['portCharters', 'voyages', 'schedules', 'cargoSales', 'protections', 'marketLedger', 'parcels']);
    t.same(R.fromSave(clone(R.toSave(s)), data), s, 'loads as it is');
  });

  test('a day passes without the Hall: no shipment is paid, nothing is logged, no roll is asked for', function (t) {
    var b = R.defaultState(data);
    b.day = 10;
    b.treasuryGP = 100;
    R.startDay(b, data, 0);
    t.same([b.day, b.treasuryGP, b.log.length, b.dayInProgress.stage], [11, 100, 0, 'trade']);
    R.finishRoutes(b);
    t.equal(b.dayInProgress.stage, 'orders');
  });

  test('loading drops what an older Bastion kept for the Hall (a dispute queue, sea-route settings, contracts) and keeps the Diplomatic Events, scores and Port Charters', function (t) {
    var b = R.defaultState(data);
    var raw = clone(R.toSave(b));
    raw.arbitration = { queue: [] };
    raw.tradeNetwork.stability = 75;
    raw.tradeNetwork.strategy = 'balanced';
    raw.tradeNetwork.active = false;
    raw.tradeNetwork.routes = [];
    raw.diplomacy = { agreements: [], delegations: [], summits: [], arbitrations: [], consortiums: [], rep: 0, cooldowns: {}, tokens: 0 };
    raw.politicalCapital.karr = 30;
    raw.honourRespectByClan.karr = 2;
    var back = R.fromSave(raw, data);
    t.equal('arbitration' in back, false);
    t.same(back.diplomacy, { tokens: 0 });
    t.same(Object.keys(back.tradeNetwork), ['portCharters', 'voyages', 'schedules', 'cargoSales', 'protections', 'marketLedger', 'parcels']);
    t.same([back.politicalCapital.karr, back.honourRespectByClan.karr], [30, 2]);
    t.equal(R.saveProblem(raw), null, 'an old export with those fields still imports');
  });

  /* ================================================================================================ */
  group('The Hall is stripped (S09): its orders end, with their gold handed back');

  var FIVE = [['host_delegation', 'Host Delegation', 150], ['inter_clan_summit', 'Inter-Clan Summit', 450], ['arbitration_authority', 'Secure Writ of Authority', 600], ['trade_consortium', 'Trade Consortium', 900], ['secure_trade_agreement', 'Secure Trade Agreement', 250]];
  function hallOrders() {
    var list = FIVE.map(function (f, i) {
      return { id: 'h' + i, facId: HALL, fnId: f[0], chosen: { label: 'Clan Karr' }, optionLabel: 'Clan Karr', notes: '', label: 'Hall of Emissaries: ' + f[1] + ' (Clan Karr)', costGP: f[2], issuedDay: 10, dueDay: 14, meta: { targetClan: 'Karr' } };
    });
    list.push({ id: 'hu', facId: HALL, fnId: 'upgrade', chosen: null, optionLabel: null, notes: '', label: 'Hall of Emissaries: Upgrade to Level 3', costGP: 0, issuedDay: 10, dueDay: 24, meta: { kind: 'upgrade', toLevel: 3 } });
    list.push({ id: 'n1', facId: 'trade_network', fnId: 'upgrade', chosen: null, optionLabel: null, label: 'Ironbow Trade Network: Stability Investment', costGP: 75, issuedDay: 10, dueDay: 17, meta: { kind: 'stability' } });
    list.push({ id: 'n2', facId: 'trade_network', fnId: 'upgrade', chosen: null, optionLabel: null, label: 'Ironbow Trade Network: Yield Investment', costGP: 90, issuedDay: 10, dueDay: 17, meta: { kind: 'yield' } });
    return list;
  }

  test('every Hall order and Trade Network investment is cancelled and its gold comes back, itemised; the treasury rises by exactly that', function (t) {
    var raw = v3(function (s) {
      s.builtExtras = [{ facId: HALL, status: 'built' }];
      s.facilityLevels[HALL] = 2;
      s.pendingOrders = hallOrders();
    });
    var res = convert(raw);
    t.same(res.problems, [], 'the audit is clean');
    var back = 150 + 450 + 600 + 900 + 250 + 75 + 90;
    t.equal(back, 2515);
    t.equal(res.save.treasuryGP, 400 + 2515);
    t.same([res.report.gold.refunded, res.report.gold.settlement], [2515, 0]);
    t.same(res.report.gold.items.map(function (i) { return [i.label, i.gp, i.kind]; }), [
      ['Hall of Emissaries: Host Delegation (Clan Karr)', 150, 'refund'], ['Hall of Emissaries: Inter-Clan Summit (Clan Karr)', 450, 'refund'], ['Hall of Emissaries: Secure Writ of Authority (Clan Karr)', 600, 'refund'],
      ['Hall of Emissaries: Trade Consortium (Clan Karr)', 900, 'refund'], ['Hall of Emissaries: Secure Trade Agreement (Clan Karr)', 250, 'refund'],
      ['Ironbow Trade Network: Stability Investment', 75, 'refund'], ['Ironbow Trade Network: Yield Investment', 90, 'refund']]);
    t.equal(res.save.pendingOrders.length, 0);
    t.equal(res.report.cancelled.length, 8);
    t.equal(res.report.cancelled.filter(function (c) { return /one level only/.test(c.why); }).length, 1, 'the Upgrade is cancelled for having nothing to upgrade to (free)');
    t.equal(res.report.cancelled.filter(function (c) { return /Trade Network is gone/.test(c.why); }).length, 2);
    t.equal(res.report.cancelled.filter(function (c) { return /no orders any more/.test(c.why); }).length, 5);
    t.equal(res.save.facilityLevels[HALL], 1, 'one level');
  });

  test('the box says it plainly: the gold, each order by name, the Hall\'s new shape; nothing a person cannot read', function (t) {
    var res = convert(v3(function (s) {
      s.builtExtras = [{ facId: HALL, status: 'built' }];
      s.facilityLevels[HALL] = 3;
      s.pendingOrders = hallOrders().slice(0, 2);
    }));
    var text = res.report.lines.join('\n');
    res.report.lines.forEach(function (l) { t.same(jargon(l), [], l); });
    t.ok(/^Gold\. 600 gp went back into the treasury \(on Day 12 it went from 400 gp to 1,000 gp\): Hall of Emissaries: Host Delegation \(Clan Karr\), 150 gp; Hall of Emissaries: Inter-Clan Summit \(Clan Karr\), 450 gp\./m.test(text), text);
    t.ok(/2 orders were cancelled: Hall of Emissaries: Host Delegation \(Clan Karr\) \(the Hall of Emissaries has no orders any more\); /.test(text), text);
    t.ok(/The Hall of Emissaries has one level only now, so its Level 3 ended\./.test(text), text);
    t.ok(/The Hall of Emissaries now has no orders and one level\. It shows each Clan's Honour\/Respect and Political Capital, which change only through Change a score in the DM doc or a confirmed Diplomatic Event, and it keeps your Diplomatic Events\./.test(text), text);
    t.ok(!/Earlier agreements/.test(text), 'no history to mention when there was none');
  });

  test('it is idempotent: converting the result again changes nothing; a Hall with nothing in it leaves no trace', function (t) {
    var res = convert(v3(function (s) { s.builtExtras = [{ facId: HALL, status: 'built' }]; s.pendingOrders = hallOrders(); }));
    t.equal(R.needsStripBack(res.save, data), false);
    t.equal(canon(R.migrateToV4(res.save, data).save), canon(res.save));
    var again = R.migrateToV4(res.save, data);
    t.equal(again.report.lines.length, 0);
    var quiet = convert(v3(function (s) { s.builtExtras = [{ facId: HALL, status: 'built' }]; s.facilityLevels[HALL] = 1; }));
    t.same(hallSays(quiet), [], 'a plain Hall: nothing to say');
    t.equal(quiet.save.legacyDiplomacy.records.length, 0);
  });

  test('a Hall that is not built and never held anything: nothing is said, even with an old level on record', function (t) {
    var res = convert(v3(function (s) { s.facilityLevels[HALL] = 4; }));
    t.same(res.problems, []);
    t.same(hallSays(res), []);
    t.equal(res.save.facilityLevels[HALL], 1);
  });

  /* ================================================================================================ */
  group('The Hall is stripped (S09): running contracts and routes are paid out once, then end');

  /* Day 12, a Trade Agreement (Clan Karr, 90 gp, last shipment Day 37 of 40 days?): see each figure in its test. */
  function contracts() {
    return {
      agreements: [{ id: 'a1', title: 'Trade Agreement', clan: 'Clan Karr', startDay: 5, endDay: 33, income: 90, lastShipmentDay: 12 }],
      delegations: [{ id: 'd1', title: 'Hosted Delegation (assertive)', clan: 'Clan Molten', startDay: 9, endDay: 23 }],
      summits: [{ id: 's1', title: 'Inter-Clan Summit', pair: 'Blackstone/Karr', startDay: 10, endDay: 31, costReductionPct: 25 }],
      arbitrations: [{ id: 'w1', title: 'Secure Writ of Authority', clan: 'Slade', startDay: 7, endDay: 35, income: 120, lastShipmentDay: 7 }],
      consortiums: [{ id: 'c1', title: 'Form Trade Consortium', clan: 'Karr', startDay: 8, endDay: 43, income: 110, lastShipmentDay: 8 }],
      rep: 0, cooldowns: { summit: 20 }, tokens: 2
    };
  }
  function withContracts(extra) {
    return v3(function (s) {
      s.builtExtras = [{ facId: HALL, status: 'built' }];
      s.diplomacy = contracts();
      s.arbitration = { queue: [{ id: 'q1', a: 'Karr', b: 'Ironbow Trade Consortium', reason: 'Tariffs.', createdDay: 11, meta: { kind: 'trade' } }] };
      s.tradeNetwork.active = true;
      s.tradeNetwork.stability = 70;
      s.tradeNetwork.yieldBonusPct = 10;
      s.tradeNetwork.routes = [{ id: 'r1', clan: 'Karr', commodity: 'Wool & Furs', risk: 'high', openedDay: 8, expiresDay: 43, nextDay: 15, yieldGP: 160, status: 'active' }];
      if (extra) extra(s);
    });
  }

  test('a contract is paid its income for every shipment still to come: a Trade Agreement 90 gp × 3 (Days 19, 26 and 33), a Writ 120 gp × 4, a Consortium 110 gp × 5', function (t) {
    var res = convert(withContracts());
    t.same(res.problems, []);
    var item = function (label) { return res.report.gold.items.filter(function (i) { return i.label === label; })[0]; };
    t.same([item('Trade Agreement with Clan Karr').gp, item('Trade Agreement with Clan Karr').kind], [270, 'settlement']);
    t.equal(item('Secure Writ of Authority with Clan Slade').gp, 480, 'Days 14, 21, 28 and 35');
    t.equal(item('Form Trade Consortium with Clan Karr').gp, 550, 'Days 15, 22, 29, 36 and 43');
  });

  test('a live sea route is paid its expected yield for every sailing still to come before it would have ended (no dice), with the yield upgrade', function (t) {
    var res = convert(withContracts());
    var route = res.report.gold.items.filter(function (i) { return /^Sea route to Clan Karr/.test(i.label); })[0];
    /* Sails on Days 15, 22, 29, 36 and 43 (the Consortium's last day is 43, so Day 43's sailing never comes): 4 sailings of floor(160 × 1.10) = 176 gp. */
    t.same([route.label, route.gp, route.kind], ['Sea route to Clan Karr (Wool & Furs)', 4 * 176, 'settlement']);
    t.equal(res.report.gold.settlement, 270 + 480 + 550 + 704);
    t.equal(res.save.treasuryGP, 400 + 270 + 480 + 550 + 704, 'the treasury rises by exactly the itemised settlement');
    t.equal(res.save.treasuryGP - res.before.treasuryGP, res.report.gold.settlement + res.report.gold.refunded, 'I1');
  });

  test('High-Risk Routing counts +20% of the yield; a route that was disrupted, expired or whose Consortium has ended is owed nothing, and says why', function (t) {
    var res = convert(withContracts(function (s) {
      s.tradeNetwork.highRiskRouting = true;
      s.tradeNetwork.routes = [
        { id: 'r1', clan: 'Karr', commodity: 'Wool & Furs', risk: 'high', openedDay: 8, expiresDay: 43, nextDay: 15, yieldGP: 160, status: 'active' },
        { id: 'r2', clan: 'Molten', commodity: 'Precious Metals', risk: 'high', openedDay: 8, expiresDay: 43, nextDay: 15, yieldGP: 200, status: 'disrupted' },
        { id: 'r3', clan: 'Farmer', commodity: 'Livestock', risk: 'high', openedDay: 8, expiresDay: 43, nextDay: 15, yieldGP: 200, status: 'expired' },
        { id: 'r4', clan: 'Rowthorn', commodity: 'Maritime', risk: 'low', openedDay: 8, expiresDay: 43, nextDay: 15, yieldGP: 200, status: 'active' }
      ];
    }));
    t.same(res.problems, []);
    var gp = function (name) { return res.report.gold.items.filter(function (i) { return i.label.indexOf(name) === 0; }).map(function (i) { return i.gp; }); };
    t.same(gp('Sea route to Clan Karr'), [4 * Math.floor(160 * 1.3)], '+10% and +20%');
    t.same(gp('Sea route to Clan Molten'), [], 'disrupted: nothing');
    t.same(gp('Sea route to Clan Farmer'), []);
    t.same(gp('Sea route to Clan Rowthorn'), [], 'no Consortium of its own: it would have expired');
    var said = res.report.lines.join('\n');
    t.ok(/Your sea route to Clan Molten ended \(it was disrupted, so it paid nothing\); nothing was owed\./.test(said), said);
    t.ok(/Your sea route to Clan Farmer ended \(it had already ended\); nothing was owed\./.test(said), said);
    t.ok(/Your sea route to Clan Rowthorn ended \(its Trade Consortium had ended\); nothing was owed\./.test(said), said);
  });

  test('a route\'s sailings stop the day before its Consortium ends, and at its own last day if that is sooner; sailings overdue are all owed', function (t) {
    var one = function (consEnd, expires, next) {
      var res = convert(v3(function (s) {
        s.diplomacy = { agreements: [], delegations: [], summits: [], arbitrations: [], consortiums: [{ id: 'c', title: 'Form Trade Consortium', clan: 'Karr', startDay: 1, endDay: consEnd, income: 0, lastShipmentDay: consEnd }], rep: 0, cooldowns: {}, tokens: 0 };
        s.tradeNetwork.routes = [{ id: 'r', clan: 'Karr', commodity: 'Wool', risk: 'low', openedDay: 1, expiresDay: expires, nextDay: next, yieldGP: 100, status: 'active' }];
      }));
      return res.report.gold.settlement / 100;
    };
    t.equal(one(43, 60, 15), 4, 'the Consortium ends Day 43: Days 15, 22, 29, 36');
    t.equal(one(60, 43, 15), 5, 'the route ends Day 43: Days 15, 22, 29, 36 and 43');
    t.equal(one(60, 60, 12), 7, 'overdue: Day 12 is the first, then 19... up to 54 (Day 61 is past it)');
    t.equal(one(15, 60, 15), 0, 'the Consortium ends the day the first sailing is due, so none comes');
    t.equal(one(60, 11, 12), 0, 'the route has already ended');
  });

  test('delegations, summits (and their discount), cooldowns, Favour Tokens and disputes simply end, each said in a sentence; nothing is paid for them', function (t) {
    var res = convert(withContracts());
    t.same(res.save.diplomacy, { tokens: 0 });
    t.equal('arbitration' in res.save, false);
    ['active', 'strategy', 'stability', 'routes', 'highRiskRouting', 'yieldBonusPct'].forEach(function (k) { t.equal(k in res.save.tradeNetwork, false, k + ' is gone from the trade network'); });
    var said = res.report.lines.join('\n');
    t.ok(/Your delegation \(Clan Molten\) ended\. It had no gold left to pay\./.test(said), said);
    t.ok(/Your Inter-Clan Summit \(Blackstone\/Karr\) ended, and so did the 25% discount it gave\. It had no gold left to pay\./.test(said), said);
    t.ok(/The waiting time on a diplomatic action ended with the actions themselves\./.test(said), said);
    t.ok(/2 Favour Tokens were never spent on anything, and they ended\./.test(said), said);
    t.ok(/1 dispute was waiting for the Council Ledger, which is gone, so it was closed without a ruling\./.test(said), said);
    res.report.lines.forEach(function (l) { t.same(jargon(l), [], l); });
  });

  test('Favour Tokens alone: a version 3 save loses them with a line; a version 4 save that still has a few is left alone (nothing can earn them, and the Clan Influence panel only shows the count)', function (t) {
    var res = convert(v3(function (s) { s.diplomacy = { agreements: [], delegations: [], summits: [], arbitrations: [], consortiums: [], rep: 0, cooldowns: {}, tokens: 3 }; }));
    t.same(res.problems, []);
    t.same(res.save.diplomacy, { tokens: 0 });
    t.ok(/3 Favour Tokens were never spent on anything, and they ended\./.test(res.report.lines.join(' ')), res.report.lines.join(' | '));
    var four = clone(res.save);
    four.diplomacy.tokens = 2;
    t.equal(R.needsStripBack(four, data), false);
    t.equal(R.fromSave(clone(four), data).diplomacy.tokens, 2);
  });

  test('what they were is kept as read-only history: one line each, with its days and what it was paid', function (t) {
    var res = convert(withContracts());
    var recs = res.save.legacyDiplomacy.records;
    t.same(recs.map(function (r) { return [r.kind, r.endedDay, r.paid]; }), [['Trade Agreement', 12, 270], ['Secure Writ of Authority', 12, 480], ['Trade Consortium', 12, 550], ['Sea route', 12, 704], ['Hosted Delegation', 12, 0], ['Inter-Clan Summit', 12, 0]]);
    t.equal(R.legacyDiplomacyLine(recs[0]), 'Trade Agreement with Clan Karr · Day 5 to Day 33 · ended Day 12 · paid out in full, 270 gp');
    t.equal(R.legacyDiplomacyLine(recs[5]), 'Inter-Clan Summit (Blackstone/Karr) · Day 10 to Day 31 · ended Day 12 · it had given a 25% discount');
    t.equal(R.legacyDiplomacyLine(recs[3]), 'Sea route to Clan Karr · Day 8 to Day 43 · ended Day 12 · paid out in full, 704 gp');
    t.same(R.fromSave(clone(res.save), data).legacyDiplomacy, res.save.legacyDiplomacy, 'it reloads as it is');
    var said = res.report.lines.join('\n');
    t.ok(/What your agreements and routes were is kept there, to read and not to change, under Earlier agreements\./.test(said), said);
  });

  test('never touched: Port Charters, ships at sea, standing shipments, sales, the ledger, parcels, the Blessing of Pelagos, Political Capital, Honour/Respect, the Diplomatic Events and the Warehouse\'s contract rows', function (t) {
    var raw = withContracts(function (s) {
      s.tradeNetwork.portCharters = [charter('c-gold', 'goldport', 'molten', 'registered')];
      s.tradeNetwork.protections = { pelagos_blessing: { charges: 1 } };
      s.politicalCapital.karr = 40;
      s.honourRespectByClan.slade = -2;
      s.warehouse = [{ id: 'w1', item: 'Trade Agreement Contract', qty: 1, gp: '', notes: 'Hall of Emissaries' }];
      s.diplomaticRecords = R.cleanDiplomaticRecords({ next: 2, list: [{ id: 'dr-0001', title: 'Talks', clans: ['karr'], day: 9, situation: 'x', decision: 'y', outcome: 'z', notes: '', status: 'confirmed', createdDay: 9, confirmedDay: 10, history: [], consequences: [] }] }, 12, data);
    });
    var res = convert(raw);
    t.same(res.problems, [], 'I6 holds');
    ['portCharters', 'voyages', 'schedules', 'cargoSales', 'marketLedger', 'parcels'].forEach(function (k) { t.equal(canon(res.save.tradeNetwork[k]), canon(raw.tradeNetwork[k]), k); });
    t.same(res.save.tradeNetwork.protections, { pelagos_blessing: { charges: 1 } });
    t.same([res.save.politicalCapital.karr, res.save.honourRespectByClan.slade], [40, -2]);
    t.equal(canon(res.save.diplomaticRecords), canon(raw.diplomaticRecords));
    t.same(res.save.warehouse, raw.warehouse);
  });

  test('the Hall\'s money is paid exactly once: converting the converted save again, or loading it twice, pays nothing more', function (t) {
    var res = convert(withContracts());
    var gold = res.save.treasuryGP;
    var again = R.migrateToV4(res.save, data);
    t.equal(again.save.treasuryGP, gold);
    var loaded = R.fromSave(clone(res.save), data);
    t.equal(loaded.treasuryGP, gold);
    t.equal(R.fromSave(clone(R.toSave(loaded)), data).treasuryGP, gold);
    t.equal(loaded.legacyDiplomacy.records.length, 6, 'the history is not doubled');
    /* The same version 3 file converted twice (two imports) pays from each file's own state, once each. */
    t.equal(convert(withContracts()).save.treasuryGP, gold);
  });

  test('a version 4 Bastion that an older copy of the suite put contracts back into is found, paid out again once, and its history added to', function (t) {
    var res = convert(withContracts());
    var dirty = clone(res.save);
    dirty.diplomacy.agreements = [{ id: 'a9', title: 'Trade Agreement', clan: 'Clan Slade', startDay: 12, endDay: 26, income: 50, lastShipmentDay: 12 }];
    dirty.diplomacy.tokens = 0;
    t.same(R.stripBackLeftovers(dirty, data), [{ step: 'windDownHall', what: 'a contract' }]);
    var again = convert(dirty);
    t.same(again.problems, []);
    t.equal(again.save.treasuryGP, dirty.treasuryGP + 100, '2 shipments of 50 gp (Days 19 and 26)');
    t.equal(again.save.legacyDiplomacy.records.length, 7);
    t.same(again.save.diplomacy, { tokens: 0 });
  });

  test('the heavy fixture: its refunds and settlement are itemised and equal the treasury rise, the audit is clean, a second run changes nothing, and the box reads well', function (t) {
    var raw = FIX['bastion-v3-heavy'];
    var res = convert(raw);
    t.same(res.problems, []);
    var hall = res.report.gold.items.filter(function (i) { return /^(Hall of Emissaries|Ironbow Trade Network|Trade Agreement|Form Trade Consortium|Sea route)/.test(i.label); });
    var label = function (id) { return raw.pendingOrders.filter(function (o) { return o.id === id; })[0].label; };
    t.same(hall.map(function (i) { return [i.label, i.gp, i.kind]; }), [
      [label('hv-24'), 150, 'refund'], [label('hv-25'), 900, 'refund'], [label('hv-26'), 75, 'refund'],
      ['Trade Agreement with Clan Karr', 180, 'settlement'], ['Trade Agreement with Clan Slade', 210, 'settlement'], ['Form Trade Consortium with Clan Blackstone', 440, 'settlement']]);
    var itemised = res.report.gold.items.reduce(function (n, i) { return n + i.gp; }, 0);
    t.equal(res.save.treasuryGP, raw.treasuryGP + itemised, 'every pound is itemised, and the treasury rose by exactly that');
    t.equal(R.needsStripBack(res.save, data), false);
    t.equal(canon(R.migrateToV4(res.save, data).save), canon(res.save), 'a second run changes nothing');
    var routeLine = res.report.lines.join('\n').match(/Your sea route to [^.]*\./g) || [];
    t.equal(routeLine.length, 2, 'the two routes, whose Consortiums are not in this save, say they ended with nothing owed');
    res.report.lines.forEach(function (l) { t.same(jargon(l), [], l); });
    t.same(res.save.legacyDiplomacy.records.map(function (r) { return r.kind; }), ['Trade Agreement', 'Trade Agreement', 'Trade Consortium', 'Sea route', 'Sea route', 'Hosted Delegation']);
    t.same(res.save.diplomacy, { tokens: 0 });
    t.equal(res.save.facilityLevels[HALL], 1, 'its Level 3 is one level now');
  });

  /* ================================================================================================ */
  group('The Hall is stripped (S09): the forecast and the DM doc do not promise what is gone');

  test('a version 3 save\'s forecast leaves out the Hall\'s actions and the Trade Network\'s investments (cancelled at opening) but still shows Register Port Charter (moved to the Dock)', function (t) {
    var C = TSI.campaign;
    var b = clone(R.toSave(R.defaultState(data)));
    b.v = 3;
    b.day = 10;
    b.anchored = true;
    b.pendingOrders = hallOrders().concat([registerOrder('reg', 'c-gold', 'Goldport', { dueDay: 12 })]);
    t.equal(C.cancelledByConversion({ facId: HALL, fnId: 'host_delegation' }), true);
    t.equal(C.cancelledByConversion({ facId: HALL, fnId: 'upgrade', meta: { kind: 'upgrade' } }), true);
    t.equal(C.cancelledByConversion({ facId: 'trade_network', fnId: 'upgrade' }), true);
    t.equal(C.cancelledByConversion({ facId: HALL, fnId: 'register_port_charter' }), false, 'moved, not cancelled');
    t.equal(C.cancelledByConversion({ facId: 'dock', fnId: 'register_port_charter' }), false);
    var lines = C.bastionComing(b).map(function (x) { return x.line; });
    t.same(lines, ['Hall of Emissaries: Register Port Charter (Goldport) is complete.']);
    var four = clone(b);
    four.v = 4;
    t.equal(C.bastionComing(four).length, 9, 'a converted save is never filtered (it holds none of them)');
  });

  test('the forecast never says a contract ends, a route needs a roll, or the Hall needs a roll', function (t) {
    var b = clone(R.toSave(R.defaultState(data)));
    b.day = 10;
    b.anchored = true;
    b.diplomacy = contracts();
    b.tradeNetwork.active = true;
    b.tradeNetwork.routes = [{ id: 'r', clan: 'Karr', risk: 'high', status: 'active', nextDay: 12, expiresDay: 40 }];
    t.same(TSI.campaign.bastionComing(b), []);
  });
}());
