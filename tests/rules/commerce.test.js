/* Commodity trade and Port Charters (pull request 5 of the facilities
   overhaul; Harry's answers, 14 October 2026): the data, the link's Port
   Charter message (shared/js/bridge-rules.js), the Bastion holding and the
   Hall registering a Charter, and cargo voyages (tools/bastion/commerce-rules.js). */
(function () {
  var Bg = TSI.bridge;
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var C = T.bastionCommerce;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce };

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function reload(b, data) { return BR.fromSave(copy(BR.toSave(b)), data || bdata); }
  /* The data with some commerce numbers changed. */
  function withCommerce(over) {
    var d = Object.assign({}, bdata);
    d.commerce = Object.assign(copy(C), over);
    return d;
  }
  /* A Bastion that has read the Explorer's day, with the Dock at a level. */
  function bastion(day, dockLevel) {
    var b = BR.defaultState(bdata);
    b.day = day || 1;
    b.anchored = true;
    b.bridge.fresh = false;
    b.facilityLevels.dock = dockLevel || 2;
    return b;
  }
  function withHall(b, level) {
    b.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }];
    BR.ensureLevels(b, bdata);
    b.facilityLevels.hall_of_emissaries = level || 2;
    return b;
  }
  function charterMsg(over) {
    return Object.assign({ id: 'chartr-0a0b0c0d:dm:0', type: 'charter', day: 3, at: '2026-10-14T10:00:00.000Z', from: { code: 'DM', title: 'DM award', step: 'dm' }, clan: 'molten', port: 'goldport', text: 'For clearing the harbour of wreckers.' }, over || {});
  }
  function standingMsg(over) {
    return Object.assign({ id: 'abc123-1a2b3c4d:won:2', type: 'standing', day: 3, at: '2026-10-13T10:00:00.000Z', from: { code: 'T4', title: 'The Knight-Errant\'s Challenge', step: 'won' }, clan: 'slade', hr: 1, text: 'Honour/Respect +1 with Clan Slade.' }, over || {});
  }
  function exWith(list) { return { travel: { day: 5 }, journey: { outbox: list } }; }
  /* A Bastion holding a registered Charter for a port. */
  function registered(b, port) {
    var p = port || 'goldport';
    BR.addCharter(b, charterMsg({ id: 'chartr-' + p.slice(0, 4) + '0000:dm:0', port: p, clan: Bg.portClan(p) }), b.day);
    var c = BR.charterFor(b, p);
    c.status = 'registered';
    c.registeredDay = b.day;
    return c;
  }
  function stock(b, id, qty) { BR.addGoods(b, bdata, id, qty, 'Test'); }

  /* ---------------------------------------------------------------- */
  group('Commodity trade: the data (Harry, 14 October 2026)');

  test('the 17 cargo goods\' base values are Harry\'s, each with a kind of goods', function (t) {
    var want = {
      fresh_fish: 80, preserved_fish: 150, premium_seafood: 220, raw_timber: 100, sawn_lumber: 160, construction_timber: 200, premium_hardwood: 260,
      raw_stone: 90, dressed_stone: 150, structural_masonry: 190, decorative_stonework: 250, ordinary_textiles: 100, sailcloth: 180, specialist_garments: 220,
      medicinal_herbs: 140, refined_botanical_reagents: 200, rare_botanical_extracts: 300
    };
    var cargo = T.bastionGoods.goods.filter(function (g) { return g.kind === 'cargo'; });
    t.equal(cargo.length, 17);
    cargo.forEach(function (g) {
      t.equal(g.gp, want[g.id], g.id);
      t.ok(C.categories[g.cat], g.id + ' has a kind of goods');
    });
    t.same(cargo.filter(function (g) { return g.cat === 'fish'; }).map(function (g) { return g.id; }), ['fresh_fish', 'preserved_fish', 'premium_seafood']);
    T.bastionGoods.goods.filter(function (g) { return g.kind !== 'cargo'; }).forEach(function (g) { t.equal(g.cat, undefined, g.id); });
  });

  test('demand: four levels, and Harry\'s approved matrix good by good (14 October 2026); nothing starts oversupplied', function (t) {
    t.same(Object.keys(C.demandLevels).map(function (k) { return [k, C.demandLevels[k].label, C.demandLevels[k].mult]; }),
      [['high', 'Highly sought-after', 1.25], ['moderate', 'Moderate', 1.1], ['normal', 'Normal', 1], ['oversupplied', 'Oversupplied', 0.75]]);
    var want = {
      blackstone: [['sawn_lumber', 'construction_timber', 'premium_hardwood'], ['dressed_stone', 'structural_masonry', 'medicinal_herbs']],
      rowthorn: [['preserved_fish', 'premium_seafood', 'sailcloth'], ['ordinary_textiles', 'specialist_garments', 'medicinal_herbs']],
      farmer: [['medicinal_herbs', 'refined_botanical_reagents', 'rare_botanical_extracts'], ['preserved_fish', 'sawn_lumber', 'ordinary_textiles']],
      karr: [['premium_seafood', 'sailcloth', 'medicinal_herbs'], ['preserved_fish', 'construction_timber', 'dressed_stone']],
      slade: [['ordinary_textiles', 'sailcloth', 'construction_timber'], ['sawn_lumber', 'dressed_stone', 'specialist_garments']],
      bacca: [['dressed_stone', 'structural_masonry', 'decorative_stonework'], ['raw_stone', 'construction_timber', 'premium_hardwood']],
      molten: [['medicinal_herbs', 'specialist_garments', 'rare_botanical_extracts'], ['premium_seafood', 'decorative_stonework', 'refined_botanical_reagents']]
    };
    t.same(Object.keys(want).sort(), T.bastion.clans.map(function (c) { return c.key; }).sort(), 'all seven Clans');
    Object.keys(want).forEach(function (clan) {
      T.bastionGoods.goods.forEach(function (g) {
        if (g.kind !== 'cargo') return;
        var mult = want[clan][0].indexOf(g.id) !== -1 ? 1.25 : want[clan][1].indexOf(g.id) !== -1 ? 1.1 : 1;
        t.equal(BR.demandFor(bdata, clan, g.id).mult, mult, clan + ' ' + g.id);
      });
      Object.keys(C.demand[clan]).forEach(function (id) { t.ok(BR.good(bdata, id) && BR.good(bdata, id).kind === 'cargo', clan + ': ' + id + ' is a trade good'); });
    });
    t.ok(!Object.keys(C.demand).some(function (k) { return Object.keys(C.demand[k]).some(function (id) { return C.demand[k][id] === 'oversupplied'; }); }), 'nothing oversupplied');
  });

  test('demand is set good by good: a kind of goods in the table doesn\'t count', function (t) {
    var d = withCommerce({ demand: { molten: { timber: 'high', sawn_lumber: 'moderate' } } });
    t.same([BR.demandFor(d, 'molten', 'raw_timber').mult, BR.demandFor(d, 'molten', 'sawn_lumber').mult], [1, 1.1]);
  });

  test('market saturation is on: 28 days, 4 lots a tier, records kept 56 days', function (t) {
    t.same(C.saturation, { active: true, windowDays: 28, lotsPerTier: 4, keepDays: 56 });
  });

  test('no fees or tariffs; Timberport and Goldport 7 days out and 7 back; the later ports sail longer for more risk; risks 5, 10, 20 and (Redport) 30 in 100', function (t) {
    t.equal(C.feePerLot, 0);
    t.equal(C.tariffPct, 0);
    t.same(C.tariffByClan, {});
    t.same([C.risks.low.pct, C.risks.medium.pct, C.risks.high.pct, C.risks.very_high.pct], [5, 10, 20, 30]);
    Bg.ports().forEach(function (p) {
      var r = BR.portRoute(bdata, p);
      t.ok(r, p + ' has a route');
      t.equal(r.outDays, r.backDays, p + ': the way back takes as long as the way out');
    });
    t.same(['timberport', 'goldport'].map(function (p) { var r = BR.portRoute(bdata, p); return [r.outDays, r.backDays]; }), [[7, 7], [7, 7]]);
    /* Harry's order, shortest to longest sailing (19 October 2026); Redport the only one longer than both of the first two. */
    var order = ['port_brawdlyn', 'steelport', 'moltenport', 'leatherport', 'bleakharbour', 'alderbridge', 'redport'];
    t.same(order.map(function (p) { return BR.portRoute(bdata, p).outDays; }), [2, 3, 4, 5, 6, 7, 9]);
    t.same(Bg.ports().filter(function (p) { return BR.portRoute(bdata, p).outDays > 7; }), ['redport'], 'only Redport is longer than Timberport and Goldport');
    t.same(order.map(function (p) { return BR.portRoute(bdata, p).pct; }), [5, 5, 10, 10, 20, 20, 30], 'risk rises with the days');
    t.same([BR.portRoute(bdata, 'river_rook').outDays, BR.portRoute(bdata, 'river_rook').pct], [4, 10], 'the River Rook, Clan Bacca\'s river port');
    t.same([BR.portRoute(bdata, 'timberport').pct, BR.portRoute(bdata, 'goldport').pct], [5, 20], 'Blackstone low, Molten high, as the old Clan trade');
    t.equal(BR.portRoute(bdata, 'nowhere'), null);
  });

  test('the Dock: Level 1 can\'t ship; 2/3/4/5 lots; two ships at Level 5; standing shipments from Level 4', function (t) {
    var rows = [1, 2, 3, 4, 5].map(function (lv) { var s = BR.dockSpec(bastion(1, lv), bdata); return [s.lots, s.ships, s.schedule]; });
    t.same(rows, [[0, 0, false], [2, 1, false], [3, 1, false], [4, 1, true], [5, 2, true]]);
    t.equal(BR.dockLevelFor(bdata, 'ship'), 2);
    t.equal(BR.dockLevelFor(bdata, 'schedule'), 4);
    t.same(BR.fn(BR.facility(bdata, 'dock'), 'charter_berth').options.length, 8, 'the Charter Berth is unchanged');
  });

  test('all three protections are available; Fresh Fish sails only on voyages of 2 days or less', function (t) {
    t.same(C.protections.map(function (p) { return [p.facId, p.cut, p.consumes === true, p.available]; }),
      [['barracks', 5, true, true], ['watchtower', 5, false, true], ['shrine_pelagos', 10, true, true]], 'all three are on: the Blessing (pull request 8b), then the Convoy and the Approaches (20 October 2026)');
    t.same(BR.voyageProtections(bastion(1), bdata), [], 'none held: none applies');
    t.equal(BR.goodShipBlocker(bdata, 'fresh_fish', BR.portRoute(bdata, 'timberport')), 'Fresh Fish only ships on a voyage of 2 days or less (it doesn\'t keep longer), and this one takes 7 days.');
    t.equal(BR.goodShipBlocker(bdata, 'fresh_fish', { outDays: 2 }), '', '2 days: it sails');
    t.equal(BR.goodShipBlocker(bdata, 'fresh_fish', { outDays: 1 }), '');
    t.ok(/2 days or less/.test(BR.goodShipBlocker(bdata, 'fresh_fish', { outDays: 3 })), '3 days: it doesn\'t');
    t.equal(BR.goodShipBlocker(bdata, 'premium_seafood', BR.portRoute(bdata, 'goldport')), '', 'Premium Seafood sails on a 7-day route');
    t.equal(BR.goodShipBlocker(bdata, 'preserved_fish', BR.portRoute(bdata, 'timberport')), '');
    t.ok(/isn't a trade good/.test(BR.goodShipBlocker(bdata, 'restorative_herbs', null)));
  });

  test('the ports: Timberport and Goldport, then the eight Harry added on 19 October 2026, spelt as the Explorer\'s pins, with their regions\' Clans (every Clan has one)', function (t) {
    t.same(Bg.ports(), ['timberport', 'goldport', 'port_brawdlyn', 'steelport', 'moltenport', 'leatherport', 'bleakharbour', 'alderbridge', 'redport', 'river_rook']);
    t.same(Bg.ports().map(function (id) { return Bg.portClan(id); }).sort().filter(function (c, i, a) { return a.indexOf(c) === i; }), ['bacca', 'blackstone', 'farmer', 'karr', 'molten', 'rowthorn', 'slade'], 'all seven Clans');
    Bg.ports().forEach(function (id) {
      var p = T.ports[id];
      var pin = (T.explorer.markersByMapId[p.mapId] || []).filter(function (m) { return m.id === p.pin; })[0];
      t.ok(pin, id + ' is a pin on ' + p.mapId);
      t.equal(pin.label, p.label, id + ' is spelt as its pin');
      t.ok(T.regions[p.region], id + '\'s region');
    });
    t.same([Bg.portLabel('timberport'), Bg.portClan('timberport'), Bg.portLabel('goldport'), Bg.portClan('goldport')], ['Timberport', 'blackstone', 'Goldport', 'molten']);
    t.equal(Bg.portClan('nowhere'), '');
    t.equal(Bg.isPort('nowhere'), false);
  });

  /* ---------------------------------------------------------------- */
  group('Commodity trade: the link\'s Port Charter message');

  test('charterMessage() takes the port\'s Clan; check() accepts it', function (t) {
    var m = Bg.charterMessage({ id: 'chartr-0a0b0c0d:dm:0', day: 4, at: 'x', from: { code: 'DM', title: 'DM award', step: 'dm' }, port: 'timberport', text: 'Well earned.' });
    t.same(m, { id: 'chartr-0a0b0c0d:dm:0', type: 'charter', day: 4, at: 'x', from: { code: 'DM', title: 'DM award', step: 'dm' }, clan: 'blackstone', port: 'timberport', text: 'Well earned.' });
    t.equal(Bg.check(m), '');
    t.equal(Bg.check(charterMsg({ day: -2 })), '', 'any whole day');
  });

  test('check() refuses a damaged Port Charter, with a plain reason', function (t) {
    t.ok(/which port/.test(Bg.check(charterMsg({ port: '' }))));
    t.ok(/port the Bastion doesn't know \(nowhere\)/.test(Bg.check(charterMsg({ port: 'nowhere' }))));
    t.ok(/isn't Goldport's/.test(Bg.check(charterMsg({ clan: 'slade' }))));
    t.ok(/doesn't know \(hr\)/.test(Bg.check(charterMsg({ hr: 1 }))), 'a Charter has no Honour/Respect');
    t.ok(/doesn't know \(port\)/.test(Bg.check(standingMsg({ port: 'goldport' }))), 'a standing message has no port');
    t.ok(/id is damaged/.test(Bg.check(charterMsg({ id: 'bad' }))));
    t.ok(/kind of change/.test(Bg.check(standingMsg({ type: 'gold' }))), 'an unknown kind is still refused by check()');
  });

  test('clean(): a standing message is exactly as before; a Charter keeps its port and has no hr', function (t) {
    t.same(Bg.clean(standingMsg({ extra: 1 })), { id: 'abc123-1a2b3c4d:won:2', type: 'standing', day: 3, at: '2026-10-13T10:00:00.000Z', from: { code: 'T4', title: 'The Knight-Errant\'s Challenge', step: 'won' }, clan: 'slade', hr: 1, text: 'Honour/Respect +1 with Clan Slade.' });
    t.same(Bg.clean(charterMsg({ hr: 3 })), { id: 'chartr-0a0b0c0d:dm:0', type: 'charter', day: 3, at: '2026-10-14T10:00:00.000Z', from: { code: 'DM', title: 'DM award', step: 'dm' }, clan: 'molten', port: 'goldport', text: 'For clearing the harbour of wreckers.' });
  });

  test('a newer copy\'s kind of message waits, and the Explorer keeps it as it is', function (t) {
    var m = { id: 'newer1-0a0b0c0d:dm:0', type: 'courier', day: 4, at: 'x', from: { code: 'DM', title: 'Courier', step: 'dm' }, gold: 50, note: 'A purse', ok: true, nested: { no: 1 } };
    t.equal(Bg.waitsForNewer(m), true);
    t.same(Bg.clean(m), { id: 'newer1-0a0b0c0d:dm:0', type: 'courier', day: 4, at: 'x', from: { code: 'DM', title: 'Courier', step: 'dm' }, gold: 50, note: 'A purse', ok: true });
    t.equal(Bg.waitsForNewer(standingMsg()), false);
    t.equal(Bg.waitsForNewer(charterMsg()), false);
    t.equal(Bg.waitsForNewer(standingMsg({ type: 'Bad Type!' })), false, 'a damaged kind is refused, not kept waiting');
    t.equal(Bg.waitsForNewer(standingMsg({ type: 'gold', id: 'bad' })), false);
  });

  test('statusOf(): a Port Charter held, already held, skipped or refused', function (t) {
    var m = charterMsg();
    var b = { anchored: true, day: 5, bridge: { done: {} } };
    t.equal(Bg.statusOf(m, b).kind, 'waiting');
    b.bridge.done[m.id] = { r: 'applied', day: 4, type: 'charter', port: 'goldport', held: false };
    t.equal(Bg.statusOf(m, b).line, 'Applied on Day 4: the Bastion holds the Port Charter for Goldport.');
    b.bridge.done[m.id].held = true;
    t.equal(Bg.statusOf(m, b).line, 'Applied on Day 4: the Bastion already held the Port Charter for Goldport, so nothing changed.');
    b.bridge.done[m.id] = { r: 'skipped' };
    t.ok(/Grant it again/.test(Bg.statusOf(m, b).line));
    b.bridge.done[m.id] = { r: 'refused', why: 'It names a port the Bastion doesn\'t know.' };
    t.equal(Bg.statusOf(m, b).kind, 'refused');
  });

  test('portStatus(): not held, waiting, held, being registered, registered; granted again after a refusal', function (t) {
    var m = charterMsg();
    var ex = exWith([m]);
    t.equal(Bg.portStatus('goldport', exWith([]), null).kind, 'none');
    t.same([Bg.portStatus('goldport', ex, null).kind, Bg.portStatus('goldport', ex, null).line], ['waiting', 'Sent on Day 3: waiting for the Bastion.']);
    t.equal(Bg.portStatus('timberport', ex, null).kind, 'none', 'another port');
    var b = bastion(4);
    BR.applyInbox(b, bdata, ex, 1000);
    var saved = copy(BR.toSave(b));
    t.same([Bg.portStatus('goldport', ex, saved).kind, Bg.portStatus('goldport', ex, saved).line], ['held', 'Held: register it at the Hall of Emissaries.']);
    withHall(b, 2);
    t.equal(BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4])).ok, true);
    t.ok(/being registered/.test(Bg.portStatus('goldport', ex, copy(BR.toSave(b))).line));
    BR.charterFor(b, 'goldport').status = 'registered';
    BR.charterFor(b, 'goldport').registeredDay = 7;
    t.ok(/^Registered on Day 7/.test(Bg.portStatus('goldport', ex, copy(BR.toSave(b))).line));
    var r = bastion(4);
    BR.applyInbox(r, bdata, exWith([charterMsg({ port: 'goldport', clan: 'slade' })]), 1000);
    t.equal(Bg.portStatus('goldport', exWith([charterMsg({ clan: 'slade' })]), copy(BR.toSave(r))).kind, 'none', 'refused: may grant again');
  });

  /* ---------------------------------------------------------------- */
  group('Commodity trade: the DM grants a Port Charter in the Explorer');

  var ER = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var ED = T.explorer;
  var E = T.journeyEvents;
  function explorer(day) {
    var s = ER.defaultState(ED);
    s.travel.day = day || 3;
    return s;
  }

  test('Grant: one message for the port, its Clan from the port, a random id (never the dice), and a log line', function (t) {
    var s = explorer(3);
    var real = Math.random;
    Math.random = function () { throw new Error('Math.random was used'); };
    var res;
    try { res = J.grantCharter(s, 'goldport', { text: '  Cleared   the wreckers ', where: 'dm' }, null); } finally { Math.random = real; }
    t.equal(res.ok, true);
    var m = s.journey.outbox[0];
    t.ok(Bg.ID_PATTERN.test(m.id) && /:dm:0$/.test(m.id), m.id);
    t.same([m.type, m.day, m.clan, m.port, m.from.code, m.from.title, m.from.step, m.text],
      ['charter', 3, 'molten', 'goldport', 'DM', 'DM award', 'dm', 'Port Charter for Goldport (Clan Molten): Cleared the wreckers']);
    t.equal(Bg.check(m), '');
    t.equal(s.journey.log[0], 'Day 3 · Sent to the Bastion: Port Charter for Goldport (Clan Molten).');
    var pin = J.grantCharter(s, 'timberport', { where: 'pin' }, null);
    t.ok(/:pin:0$/.test(pin.id));
    t.same([s.journey.outbox[1].from.title, s.journey.outbox[1].text], ['At the harbour', 'Port Charter for Timberport (Clan Blackstone).']);
  });

  test('Grant is refused while one is on its way or held; allowed again after a refusal or a skip', function (t) {
    var s = explorer(3);
    J.grantCharter(s, 'goldport', {}, null);
    t.ok(/waiting for the Bastion/.test(J.grantCharter(s, 'goldport', {}, null).message));
    t.equal(s.journey.outbox.length, 1);
    var b = bastion(4);
    BR.applyInbox(b, bdata, ER.toSave(s), 1000);
    var saved = copy(BR.toSave(b));
    t.ok(/Held: register it/.test(J.grantCharter(s, 'goldport', {}, saved).message));
    t.ok(/isn't a port/.test(J.grantCharter(s, 'nowhere', {}, saved).message));
    var b2 = BR.defaultState(bdata);
    BR.anchor(b2, 4);
    BR.applyInbox(b2, bdata, ER.toSave(s), 1000);
    t.equal(J.grantCharter(s, 'goldport', {}, copy(BR.toSave(b2))).ok, true, 'skipped by a Bastion started afresh: grant again');
  });

  test('a Port Charter message survives the Explorer\'s reload and Reset Travel', function (t) {
    var s = explorer(6);
    J.grantCharter(s, 'goldport', { text: 'x' }, null);
    var back = ER.fromSave(copy(ER.toSave(s)), ED, E);
    t.same(back.journey.outbox, s.journey.outbox);
    J.shiftDays(back, -4);
    t.equal(back.journey.outbox[0].day, 2);
  });

  /* ---------------------------------------------------------------- */
  group('Commodity trade: the Bastion holds a Port Charter once');

  test('a Port Charter from the Explorer is held once, earned, with its receipt in the same state', function (t) {
    var b = bastion(4);
    var r = BR.applyInbox(b, bdata, exWith([charterMsg()]), 1000);
    t.equal(r.charters.length, 1);
    t.same(r.applied, [], 'no Honour/Respect');
    var c = BR.charterFor(b, 'goldport');
    t.same([c.status, c.clan, c.mode, c.earnedDay, c.registeredDay], ['earned', 'molten', 'commodity_backed', 3, null]);
    t.same(b.bridge.done[charterMsg().id], { r: 'applied', day: 4, at: 1000, clan: 'molten', hr: 0, was: 0, now: 0, text: 'For clearing the harbour of wreckers.', why: '', type: 'charter', port: 'goldport', held: false });
    t.ok(/Port Charter for Goldport \(Clan Molten\) \(DM, Day 3\): the Bastion now holds it\. Register it at the Hall of Emissaries before the Dock ships cargo there/.test(b.log[0].body));
    t.equal(BR.applyInbox(b, bdata, exWith([charterMsg()]), 2000).changed, false, 'a second look changes nothing');
    t.same(b.honourRespectByClan, BR.defaultState(bdata).honourRespectByClan);
  });

  test('a second Charter for a port already held changes nothing, and says so', function (t) {
    var b = bastion(4);
    var second = charterMsg({ id: 'chartr-99999999:pin:0', from: { code: 'DM', title: 'At the harbour', step: 'pin' } });
    BR.applyInbox(b, bdata, exWith([charterMsg(), second]), 1000);
    t.equal(BR.portCharters(b).length, 1);
    t.equal(b.bridge.done[second.id].held, true);
    t.ok(/already holds it/.test(b.log[0].body));
  });

  test('a damaged Port Charter gets a refused receipt naming its port, and nothing is held', function (t) {
    var b = bastion(4);
    var bad = charterMsg({ port: 'goldport', clan: 'farmer' });
    var r = BR.applyInbox(b, bdata, exWith([bad]), 1000);
    t.equal(r.refused, 1);
    t.same(BR.portCharters(b), []);
    t.same([b.bridge.done[bad.id].r, b.bridge.done[bad.id].type, b.bridge.done[bad.id].port], ['refused', 'charter', 'goldport']);
  });

  test('a newer copy\'s message waits with no receipt, and the changes after it still apply', function (t) {
    var b = bastion(4);
    var newer = { id: 'newer1-0a0b0c0d:dm:0', type: 'courier', day: 2, at: 'x', from: { code: 'DM', title: 'Courier', step: 'dm' }, gold: 50 };
    var r = BR.applyInbox(b, bdata, exWith([newer, standingMsg()]), 1000);
    t.equal(r.applied.length, 1);
    t.equal(Object.prototype.hasOwnProperty.call(b.bridge.done, newer.id), false);
    t.equal(Bg.statusOf(newer, copy(BR.toSave(b))).kind, 'waiting');
  });

  test('a newer copy\'s message reads plainly in the Explorer, and a fresh Bastion skips it without calling it Honour/Respect', function (t) {
    var newer = { id: 'newer1-0a0b0c0d:dm:0', type: 'courier', day: 2, at: 'x', from: { code: 'DM', title: 'Courier', step: 'dm' }, gold: 50 };
    var b = bastion(4);
    t.same(Bg.statusOf(newer, copy(BR.toSave(b))), { kind: 'waiting', line: 'Waiting for a newer copy of the Bastion (this copy doesn\'t know this kind of change).' });
    b.bridge.done[newer.id] = { r: 'applied', day: 3 };
    t.equal(Bg.statusOf(newer, copy(BR.toSave(b))).line, 'Applied by a newer copy of the Bastion.');
    var f = BR.defaultState(bdata);
    BR.anchor(f, 5);
    BR.applyInbox(f, bdata, exWith([newer]), 1000);
    t.equal(f.bridge.done[newer.id].r, 'skipped');
    t.equal(f.log.length, 1);
    t.equal(f.log[0].body, '1 message from a newer copy of the suite, sent before this Bastion started, was skipped, so nothing counts twice.');
  });

  test('a Bastion starting from nothing skips a Port Charter sent before it, and lists it', function (t) {
    var b = BR.defaultState(bdata);
    BR.anchor(b, 5);
    var r = BR.applyInbox(b, bdata, exWith([charterMsg(), standingMsg()]), 1000);
    t.equal(r.skipped, 2);
    t.same(BR.portCharters(b), []);
    t.same([b.bridge.done[charterMsg().id].r, b.bridge.done[charterMsg().id].type], ['skipped', 'charter']);
    t.ok(/1 Port Charter, sent before this Bastion started, was skipped/.test(b.log[0].body));
    t.ok(/1 change to Honour\/Respect, sent before this Bastion started, was skipped/.test(b.log[1].body), 'the Honour/Respect line is as before');
  });

  test('receipts reload: a Port Charter\'s keeps its port; a pull request 4 receipt is exactly as before', function (t) {
    var b = bastion(4);
    BR.applyInbox(b, bdata, exWith([charterMsg(), standingMsg()]), 1000);
    var once = reload(b);
    var twice = reload(once);
    t.same(BR.toSave(twice).bridge, BR.toSave(once).bridge);
    t.same(Object.keys(once.bridge.done[standingMsg().id]), ['r', 'day', 'at', 'clan', 'hr', 'was', 'now', 'text', 'why']);
    t.same([once.bridge.done[charterMsg().id].type, once.bridge.done[charterMsg().id].port, once.bridge.done[charterMsg().id].held], ['charter', 'goldport', false]);
    t.same(BR.toSave(once).tradeNetwork.portCharters, BR.toSave(b).tradeNetwork.portCharters);
  });

  test('loading keeps one Charter per port (a registered one first), and is the same done twice', function (t) {
    var b = bastion(4);
    b.tradeNetwork.portCharters = [
      { id: 'a', port: 'goldport', clan: 'molten', status: 'earned', earnedDay: 2 },
      { id: 'b', port: 'goldport', clan: 'molten', status: 'registered', earnedDay: 3, registeredDay: 6 },
      { id: 'c', port: 'timberport', clan: 'blackstone', status: 'odd', earnedDay: 'x', text: new Array(300).join('y') },
      { port: 'nowhere' }, 'junk'
    ];
    var once = reload(b);
    t.same(once.tradeNetwork.portCharters.map(function (c) { return [c.id, c.status, c.earnedDay, c.registeredDay]; }), [['b', 'registered', 3, 6], ['c', 'earned', 1, null]]);
    t.equal(once.tradeNetwork.portCharters[1].text.length, 200);
    t.same(BR.toSave(reload(once)).tradeNetwork, BR.toSave(once).tradeNetwork);
  });

  /* ---------------------------------------------------------------- */
  group('Commodity trade: the Hall registers a Port Charter (3 days, Level 1)');

  test('Register Port Charter: Level 1 (the slot the Trade Agreement had), no gold, 3 days, the earned Charters to pick from', function (t) {
    var b = withHall(bastion(4), 1);
    var hall = BR.facility(bdata, 'hall_of_emissaries');
    var fn = BR.fn(hall, 'register_port_charter');
    t.same([fn.days, fn.costGP, fn.requiredFacilityLevel], [3, 0, 1]);
    t.equal(hall.functions.map(function (f) { return f.id; })[1], 'register_port_charter', 'listed first among the Hall\'s orders');
    t.equal(BR.isEmissary(hall, fn), false, 'no roll');
    t.same(BR.fnAvailable(b, hall, fn), { ok: true }, 'available from Level 1');
    t.same(BR.fnOptions(b, bdata, hall, fn), []);
    t.ok(/no Port Charter to register/.test(BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4])).message));
    BR.applyInbox(b, bdata, exWith([charterMsg()]), 1000);
    t.same(BR.fnOptions(b, bdata, hall, fn), [{ label: 'Port Charter: Goldport (Clan Molten)', charterId: charterMsg().id }]);
    var gp = b.treasuryGP;
    var res = BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4]));
    t.equal(res.ok, true);
    var o = b.pendingOrders[0];
    t.same([o.label, o.dueDay, o.costGP, o.chosen.charterId, b.treasuryGP], ['Hall of Emissaries: Register Port Charter (Goldport)', 7, 0, charterMsg().id, gp]);
    t.equal(BR.orderKind(bdata, o), 'simple');
    t.same(BR.fnOptions(b, bdata, hall, fn), [], 'not offered again while it\'s being registered');
    t.ok(/one Port Charter at a time: Goldport's is ready on Day 7/.test(BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4])).message));
  });

  test('on its day the Charter is registered, once, and nothing goes into the Warehouse', function (t) {
    var b = withHall(bastion(4), 2);
    BR.applyInbox(b, bdata, exWith([charterMsg()]), 1000);
    BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4]));
    var o = b.pendingOrders[0];
    var stale = copy(o);
    b.day = 7;
    var lines = BR.completeSimpleOrder(b, bdata, o, dice([0.5]));
    BR.removeOrder(b, o.id);
    t.ok(/The Port Charter for Goldport \(Clan Molten\) is registered\. The Dock can ship cargo there from Level 2\./.test(lines[0][1]));
    t.same([BR.charterFor(b, 'goldport').status, BR.charterFor(b, 'goldport').registeredDay], ['registered', 7]);
    t.same(b.warehouse, []);
    b.day = 9;
    var again = BR.completeSimpleOrder(b, bdata, stale, dice([0.5]));
    t.ok(/already registered on Day 7, so nothing changed/.test(again[0][1]), 'a second registration is refused');
    t.equal(BR.charterFor(b, 'goldport').registeredDay, 7);
  });

  test('two Charters: the Hall registers one at a time, and says so', function (t) {
    var b = withHall(bastion(4), 2);
    BR.applyInbox(b, bdata, exWith([charterMsg(), charterMsg({ id: 'chartr-timb0000:dm:0', port: 'timberport', clan: 'blackstone' })]), 1000);
    t.equal(BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4])).ok, true);
    t.equal(BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4])).message, 'The Hall registers one Port Charter at a time: Goldport\'s is ready on Day 7.');
    var o = b.pendingOrders[0];
    b.day = 7;
    BR.completeSimpleOrder(b, bdata, o, dice([0.5]));
    BR.removeOrder(b, o.id);
    t.equal(BR.registerBusy(b, bdata), '');
    t.equal(BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4])).ok, true, 'then Timberport');
    t.equal(b.pendingOrders[0].chosen.charterId, 'chartr-timb0000:dm:0');
  });

  test('Cancel, or the Hall Under Repair, leaves the Charter earned', function (t) {
    var b = withHall(bastion(4), 2);
    BR.applyInbox(b, bdata, exWith([charterMsg()]), 1000);
    BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4]));
    BR.cancelOrder(b, b.pendingOrders[0].id, bdata);
    t.equal(BR.charterFor(b, 'goldport').status, 'earned');
    t.equal(BR.registrableCharters(b).length, 1, 'it can be ordered again');
    b.repairs = { hall_of_emissaries: 6 };
    t.ok(/Under Repair/.test(BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4])).message));
  });

  /* ---------------------------------------------------------------- */
  group('Commodity trade: sending a ship');

  test('the Dock says why it can\'t send cargo: its level, repairs, no registered Charter, the ship at sea', function (t) {
    var b = bastion(4, 1);
    t.equal(BR.dispatchBlocker(b, bdata), 'The Dock needs Level 2 to send cargo (it\'s Level 1).');
    b.facilityLevels.dock = 2;
    t.ok(/No Port Charter is registered yet/.test(BR.dispatchBlocker(b, bdata)));
    var c = registered(b);
    t.equal(BR.dispatchBlocker(b, bdata), '');
    b.repairs = { dock: 6 };
    t.equal(BR.dispatchBlocker(b, bdata), 'The Dock is Under Repair until Day 6.');
    b.repairs = {};
    stock(b, 'sawn_lumber', 4);
    t.equal(BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'sawn_lumber', qty: 2 }], dice([0.3])).ok, true);
    t.equal(BR.dispatchBlocker(b, bdata), 'The ship is at sea: the first one home is back on Day 18.');
  });

  /* Pull request 8b: Bless Commercial Shipment. */
  test('a Blessing of Pelagos held: the next cargo ship takes it, 10 points off its risk; the one after sails without', function (t) {
    var b = bastion(10, 5);
    var c = registered(b);
    b.tradeNetwork.protections = { pelagos_blessing: { charges: 1 } };
    stock(b, 'sawn_lumber', 4);
    var pct = BR.portRoute(bdata, BR.charterById(b, c.id).port).pct;
    var v = BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'sawn_lumber', qty: 2 }], dice([0.3])).voyage;
    t.same([v.chance, v.protections.map(function (p) { return p.label; }), b.tradeNetwork.protections.pelagos_blessing.charges], [Math.max(0, pct - 10), ['Blessing of Pelagos'], 0]);
    var w = BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'sawn_lumber', qty: 2 }], dice([0.3])).voyage;
    t.same([w.chance, w.protections], [pct, []], 'used once');
  });

  test('a refused sailing changes nothing at all', function (t) {
    var b = bastion(4, 2);
    var c = registered(b);
    stock(b, 'sawn_lumber', 1);
    stock(b, 'fresh_fish', 5);
    stock(b, 'restorative_herbs', 10);
    var before = copy(BR.toSave(b));
    var tries = [
      [[{ goodId: 'sawn_lumber', qty: 2 }], /Needs 2 lots of Sawn Lumber in the Warehouse; it has 1 lot\./],
      [[{ goodId: 'sawn_lumber', qty: 1 }, { goodId: 'preserved_fish', qty: 2 }], /a Level 2 Dock carries 2 lots/],
      [[], /at least 1 lot/],
      [[{ goodId: 'sawn_lumber', qty: 0 }], /at least 1 lot/],
      [[{ goodId: 'fresh_fish', qty: 1 }], /only ships on a voyage of 2 days or less/],
      [[{ goodId: 'restorative_herbs', qty: 1 }], /isn't a trade good/]
    ];
    tries.forEach(function (x) {
      var r = BR.dispatchCargo(b, bdata, c.id, x[0], dice([0.3]));
      t.equal(r.ok, false);
      t.ok(x[1].test(r.message), r.message);
    });
    c.status = 'earned';
    t.ok(/registered yet/.test(BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'sawn_lumber', qty: 1 }], dice([0.3])).message));
    t.ok(/isn't registered yet/.test(BR.cargoBlocker(b, bdata, c, [{ goodId: 'sawn_lumber', qty: 1 }])));
    c.status = 'registered';
    t.same(copy(BR.toSave(b)), before);
  });

  test('a ship sails: the lots leave the Warehouse and the voyage holds them', function (t) {
    var b = bastion(4, 3);
    var c = registered(b);
    stock(b, 'sawn_lumber', 2);
    stock(b, 'raw_timber', 3);
    var res = BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'sawn_lumber', qty: 2 }, { goodId: 'raw_timber', qty: 1 }], dice([0.3]));
    t.equal(res.ok, true);
    t.same([BR.goodsQty(b, 'sawn_lumber'), BR.goodsQty(b, 'raw_timber')], [0, 2]);
    var v = BR.voyages(b)[0];
    t.same([v.port, v.clan, v.stage, v.departDay, v.arriveDay, v.returnDay, v.risk, v.chance, v.mode],
      ['goldport', 'molten', 'outbound', 4, 11, 18, 'high', 20, 'commodity_backed']);
    t.same(v.cargo, [{ goodId: 'sawn_lumber', name: 'Sawn Lumber', qty: 2 }, { goodId: 'raw_timber', name: 'Raw Timber', qty: 1 }]);
    t.ok(/Cargo for Goldport \(Clan Molten\) sailed: 2 lots of Sawn Lumber, 1 lot of Raw Timber, from the Warehouse\. It reaches Goldport on Day 11 and the ship is home on Day 18\. Voyage risk: High \(20%\)\./.test(res.log[1]));
  });

  test('Level 5: two ships at sea at once, never a third', function (t) {
    var b = bastion(4, 5);
    var g = registered(b, 'goldport');
    var tb = registered(b, 'timberport');
    stock(b, 'raw_stone', 10);
    t.equal(BR.dispatchCargo(b, bdata, g.id, [{ goodId: 'raw_stone', qty: 5 }], dice([0.3])).ok, true);
    t.equal(BR.dispatchCargo(b, bdata, tb.id, [{ goodId: 'raw_stone', qty: 4 }], dice([0.3])).ok, true);
    t.ok(/Every ship is at sea/.test(BR.dispatchCargo(b, bdata, g.id, [{ goodId: 'raw_stone', qty: 1 }], dice([0.3])).message));
    t.equal(BR.goodsQty(b, 'raw_stone'), 1);
  });

  /* ---------------------------------------------------------------- */
  group('Commodity trade: arriving, selling and coming home');

  function sailed(port, dockLevel) {
    var b = bastion(4, dockLevel || 2);
    var c = registered(b, port || 'goldport');
    stock(b, 'sawn_lumber', 2);
    BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'sawn_lumber', qty: 2 }], dice([0.3]));
    return b;
  }

  test('nothing happens before the ship arrives', function (t) {
    var b = sailed();
    b.day = 10;
    var r = BR.settleVoyages(b, bdata, dice([0.99]));
    t.equal(r.changed, false);
    t.equal(BR.voyages(b)[0].stage, 'outbound');
  });

  test('a safe arrival sells once at base × demand, into the treasury; the ship is home a week later', function (t) {
    var b = sailed();
    b.treasuryGP = 100;
    b.day = 11;
    var r = BR.settleVoyages(b, bdata, dice([0.5]));
    t.equal(b.treasuryGP, 100 + 320);
    var sale = BR.cargoSales(b)[0];
    t.same([sale.outcome, sale.roll, sale.chance, sale.gross, sale.fee, sale.tariff, sale.net], ['sold', 51, 20, 320, 0, 0, 320]);
    t.same(sale.lines, [{ goodId: 'sawn_lumber', name: 'Sawn Lumber', qty: 2, base: 160, cat: 'timber', demand: 'normal', demandLabel: 'Normal', mult: 1, gp: 320 }]);
    t.ok(/Cargo sold at Goldport \(Clan Molten\): 2 lots of Sawn Lumber × 160 gp × Normal ×1\.00 = 320 gp\. Shipping 0 gp · tariff 0 gp \(0%\) · 320 gp to the treasury\. Treasury \+320 gp\./.test(r.log[0][1]));
    t.same(r.word, ['Cargo sold at Goldport: +320 gp.']);
    t.equal(BR.voyages(b)[0].stage, 'returning');
    t.equal(BR.settleVoyages(b, bdata, dice([0.5])).changed, false, 'the same day again: nothing');
    t.equal(b.treasuryGP, 420);
    b.day = 18;
    var home = BR.settleVoyages(b, bdata, dice([0.5]));
    t.same(BR.voyages(b), []);
    t.equal(BR.goodsQty(b, 'sawn_lumber'), 0, 'sold goods never come back');
    t.same(home.word, ['The cargo ship is home from Goldport.']);
    t.equal(b.treasuryGP, 420);
    t.equal(BR.dispatchBlocker(b, bdata), '', 'it can sail again');
  });

  test('trouble at sea: nothing sold; the cargo comes home with the ship, once', function (t) {
    var b = sailed();
    b.day = 11;
    var r = BR.settleVoyages(b, bdata, dice([0.15]));
    t.equal(b.treasuryGP, 0);
    t.same([BR.cargoSales(b)[0].outcome, BR.cargoSales(b)[0].roll, BR.cargoSales(b)[0].net], ['turned_back', 16, 0]);
    t.ok(/turned back, and nothing was sold\. \(Voyage risk 20%: rolled 16\.\) It brings the cargo home on Day 18/.test(r.log[0][1]));
    t.equal(BR.goodsQty(b, 'sawn_lumber'), 0, 'still at sea');
    b.day = 17;
    BR.settleVoyages(b, bdata, dice([0.5]));
    t.equal(BR.goodsQty(b, 'sawn_lumber'), 0);
    b.day = 18;
    var home = BR.settleVoyages(b, bdata, dice([0.5]));
    t.equal(BR.goodsQty(b, 'sawn_lumber'), 2);
    t.ok(/back in the Warehouse/.test(home.word[0]));
    BR.settleVoyages(b, bdata, dice([0.5]));
    t.equal(BR.goodsQty(b, 'sawn_lumber'), 2, 'only once');
  });

  test('the roll: 1 to 100, safe above the chance; 5 in 100 for Timberport', function (t) {
    var b = sailed('timberport');
    b.day = 11;
    BR.settleVoyages(b, bdata, dice([0.05]));
    t.same([BR.cargoSales(b)[0].roll, BR.cargoSales(b)[0].outcome], [6, 'sold']);
    var b2 = sailed('timberport');
    b2.day = 11;
    BR.settleVoyages(b2, bdata, dice([0.04]));
    t.same([BR.cargoSales(b2)[0].roll, BR.cargoSales(b2)[0].outcome], [5, 'turned_back']);
  });

  test('a ship that turned back is never paid on a reload, and a sold one never brings its cargo home', function (t) {
    var b = sailed();
    b.day = 11;
    BR.settleVoyages(b, bdata, dice([0.5]));
    var r = reload(b);
    BR.settleVoyages(r, bdata, dice([0.5]));
    t.equal(r.treasuryGP, 320);
    r.tradeNetwork.voyages[0].outcome = 'odd';
    var r2 = reload(r);
    t.equal(r2.tradeNetwork.voyages[0].outcome, 'sold', 'its sale receipt says it sold');
    r2.day = 18;
    BR.settleVoyages(r2, bdata, dice([0.5]));
    t.equal(BR.goodsQty(r2, 'sawn_lumber'), 0);
    var v = sailed();
    v.tradeNetwork.cargoSales.push({ id: v.tradeNetwork.voyages[0].id, outcome: 'sold', net: 320 });
    v.day = 11;
    BR.settleVoyages(v, bdata, dice([0.5]));
    t.equal(v.treasuryGP, 0, 'a voyage with a receipt already is never paid again');
    var tb = sailed();
    tb.day = 11;
    BR.settleVoyages(tb, bdata, dice([0.05]));
    var tr = reload(tb);
    BR.settleVoyages(tr, bdata, dice([0.5]));
    t.same([tr.treasuryGP, tr.tradeNetwork.voyages[0].outcome], [0, 'turned_back'], 'turned back: a reload sells nothing');
    tr.day = 18;
    BR.settleVoyages(tr, bdata, dice([0.5]));
    var tr2 = reload(tr);
    BR.settleVoyages(tr2, bdata, dice([0.5]));
    t.same([tr2.treasuryGP, BR.goodsQty(tr2, 'sawn_lumber')], [0, 2], 'the cargo comes home once');
  });

  test('two ships sailing in the same moment never share an id, and both sell (Level 5)', function (t) {
    var b = bastion(4, 5);
    var g = registered(b, 'goldport');
    var tb = registered(b, 'timberport');
    stock(b, 'raw_stone', 4);
    BR.dispatchCargo(b, bdata, g.id, [{ goodId: 'raw_stone', qty: 2 }], dice([0.3]));
    BR.dispatchCargo(b, bdata, tb.id, [{ goodId: 'raw_stone', qty: 2 }], dice([0.3]));
    var ids = BR.voyages(b).map(function (v) { return v.id; });
    t.ok(ids[0] !== ids[1], ids.join(' / '));
    b.day = 11;
    BR.settleVoyages(b, bdata, dice([0.5]));
    t.same([b.treasuryGP, BR.cargoSales(b).length], [360, 2]);
  });

  test('the price: the Clan\'s demand for each good, the Charter\'s price factor, fees and tariffs, rounded down', function (t) {
    var d = withCommerce({ demand: { molten: { raw_timber: 'high', sawn_lumber: 'moderate', premium_seafood: 'oversupplied' } } });
    t.same([BR.demandFor(d, 'molten', 'raw_timber').mult, BR.demandFor(d, 'molten', 'sawn_lumber').mult, BR.demandFor(d, 'molten', 'premium_seafood').label, BR.demandFor(d, 'slade', 'raw_timber').mult], [1.25, 1.1, 'Oversupplied', 1]);
    var cargo = [{ goodId: 'raw_timber', qty: 3 }, { goodId: 'sawn_lumber', qty: 1 }];
    var q = BR.cargoQuote(d, { terms: {} }, 'goldport', 'molten', cargo);
    t.same(q.lines.map(function (l) { return l.gp; }), [375, 176]);
    t.same([q.gross, q.net], [551, 551]);
    var d2 = withCommerce({ feePerLot: 10, tariffPct: 5, tariffByClan: { molten: 10 } });
    var q2 = BR.cargoQuote(d2, { terms: {} }, 'goldport', 'molten', cargo);
    t.same([q2.gross, q2.fee, q2.tariff, q2.net], [460, 40, 46, 374]);
    var q3 = BR.cargoQuote(d2, { terms: { priceMult: 1.1, feePerLot: 0, tariffPct: 0 } }, 'goldport', 'molten', cargo);
    t.same([q3.gross, q3.fee, q3.tariff, q3.net], [506, 0, 0, 506], 'a negotiated concession wins');
    var d3 = withCommerce({ feePerLot: 1000 });
    t.equal(BR.cargoQuote(d3, null, 'goldport', 'molten', cargo).net, 0, 'never below 0');
    var d4 = withCommerce({ routes: { goldport: { outDays: 7, backDays: 7, risk: 'high', feePerLot: 5 }, timberport: C.routes.timberport } });
    t.equal(BR.cargoQuote(d4, null, 'goldport', 'molten', cargo).fee, 20, 'a route\'s own fee');
  });

  test('the price is worked out when the cargo arrives, not when it sails', function (t) {
    var b = sailed();
    b.day = 11;
    BR.settleVoyages(b, withCommerce({ demand: { molten: { sawn_lumber: 'high' } } }), dice([0.5]));
    t.equal(b.treasuryGP, 400);
  });

  test('with Harry\'s matrix: Medicinal Herbs sell at Goldport at ×1.25 (Molten), Dressed Stone at Timberport at ×1.10 (Blackstone)', function (t) {
    t.same(BR.cargoQuote(bdata, null, 'goldport', 'molten', [{ goodId: 'medicinal_herbs', qty: 2 }]).lines[0], { goodId: 'medicinal_herbs', name: 'Medicinal Herbs', qty: 2, base: 140, cat: 'herbal', demand: 'high', demandLabel: 'Highly sought-after', mult: 1.25, gp: 350 });
    t.equal(BR.cargoQuote(bdata, null, 'timberport', 'blackstone', [{ goodId: 'dressed_stone', qty: 3 }]).net, 495);
    t.equal(BR.cargoQuote(bdata, null, 'timberport', 'blackstone', [{ goodId: 'raw_stone', qty: 1 }]).net, 90, 'not listed: Normal');
  });

  /* ---------------------------------------------------------------- */
  group('Commodity trade: each sale recorded for market saturation (Harry, 14 October 2026)');

  test('a sale records each good\'s port, lots and day, once; a ship that turns back records nothing', function (t) {
    var b = bastion(4, 3);
    var c = registered(b);
    stock(b, 'sawn_lumber', 2);
    stock(b, 'raw_stone', 1);
    BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'sawn_lumber', qty: 2 }, { goodId: 'raw_stone', qty: 1 }], dice([0.3]));
    var id = BR.voyages(b)[0].id;
    b.day = 11;
    BR.settleVoyages(b, bdata, dice([0.5]));
    t.same(BR.marketLedger(b), [{ day: 11, port: 'goldport', goodId: 'sawn_lumber', qty: 2, saleId: id }, { day: 11, port: 'goldport', goodId: 'raw_stone', qty: 1, saleId: id }]);
    BR.settleVoyages(b, bdata, dice([0.5]));
    var r = reload(b);
    BR.settleVoyages(r, bdata, dice([0.5]));
    t.equal(BR.marketLedger(r).length, 2, 'once, through a reload');
    t.equal(BR.lotsSold(r, 'goldport', 'sawn_lumber', 11 - 28, 11), 2);
    var tb = sailed();
    tb.day = 11;
    BR.settleVoyages(tb, bdata, dice([0.05]));
    t.same(BR.marketLedger(tb), [], 'nothing sold, nothing recorded');
  });

  test('saturation is on: a port with 20 lots of a good sold this month pays the Oversupplied price', function (t) {
    var b = bastion(4, 2);
    var c = registered(b);
    b.tradeNetwork.marketLedger = [{ day: 2, port: 'goldport', goodId: 'medicinal_herbs', qty: 20, saleId: 'earlier' }];
    stock(b, 'medicinal_herbs', 2);
    BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'medicinal_herbs', qty: 2 }], dice([0.3]));
    b.day = 11;
    BR.settleVoyages(b, bdata, dice([0.5]));
    t.equal(b.treasuryGP, 210, '2 lots × 140 gp × Oversupplied 0.75');
    t.equal(BR.lotsSold(b, 'goldport', 'medicinal_herbs', 11 - 28, 11), 22, 'both recorded');
  });

  test('saturation tiers: lots 1-4 at demand, 5-8 one lower, 9-12 two lower, 13 on Oversupplied', function (t) {
    var tier = function (base, n) { return BR.saturationTier(bdata, base, n); };
    t.same([1, 4, 5, 8, 9, 12, 13, 40].map(function (n) { return tier('high', n); }),
      ['high', 'high', 'moderate', 'moderate', 'normal', 'normal', 'oversupplied', 'oversupplied']);
    t.same([4, 5, 8, 9, 13].map(function (n) { return tier('normal', n); }),
      ['normal', 'oversupplied', 'oversupplied', 'oversupplied', 'oversupplied']);
    t.same([1, 5, 9].map(function (n) { return tier('moderate', n); }), ['moderate', 'normal', 'oversupplied']);
  });

  test('saturation: sales older than 28 days are ignored, and ports and goods are counted apart', function (t) {
    var b = bastion(40, 2);
    b.tradeNetwork.marketLedger = [
      { day: 5, port: 'goldport', goodId: 'sawn_lumber', qty: 20, saleId: 'old' },
      { day: 30, port: 'timberport', goodId: 'sawn_lumber', qty: 20, saleId: 'other-port' },
      { day: 30, port: 'goldport', goodId: 'raw_stone', qty: 20, saleId: 'other-good' }
    ];
    var prior = BR.saturationPrior(b, bdata, 'goldport');
    t.equal(prior('sawn_lumber'), 0, 'day 5 is outside the window');
    t.equal(prior('medicinal_herbs'), 0);
    b.tradeNetwork.marketLedger.push({ day: 20, port: 'goldport', goodId: 'sawn_lumber', qty: 3, saleId: 'recent' });
    t.equal(BR.saturationPrior(b, bdata, 'goldport')('sawn_lumber'), 3, 'only the recent sale counts');
  });

  test('saturation: a cargo straddling a tier boundary is priced lot by lot, and the log says so', function (t) {
    var b = bastion(4, 2);
    var c = registered(b);
    b.tradeNetwork.marketLedger = [{ day: 2, port: 'goldport', goodId: 'medicinal_herbs', qty: 3, saleId: 'earlier' }];
    stock(b, 'medicinal_herbs', 2);
    BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'medicinal_herbs', qty: 2 }], dice([0.3]));
    b.day = 11;
    BR.settleVoyages(b, bdata, dice([0.5]));
    var first = Math.floor(140 * 1.25), second = Math.floor(140 * 1.10);
    t.ok(b.treasuryGP > 0 && b.treasuryGP <= first + second, 'lot 4 at one tier, lot 5 a tier lower');
    var text = JSON.stringify(BR.cargoSales(b));
    t.ok(/tiers/.test(text), 'the sale log keeps the tiers');
    var r = reload(b);
    t.same(BR.cargoSales(r), BR.cargoSales(b), 'the receipt survives a reload');
  });

  test('Fresh Fish on a 2-day route sails, sells at 80 gp a lot with demand, and is recorded', function (t) {
    var routes = copy(C.routes);
    routes.timberport.outDays = 2;
    routes.timberport.backDays = 2;
    var d = withCommerce({ routes: routes });
    var b = bastion(4, 2);
    var c = registered(b, 'timberport');
    BR.addGoods(b, d, 'fresh_fish', 2, 'Test');
    var res = BR.dispatchCargo(b, d, c.id, [{ goodId: 'fresh_fish', qty: 2 }], dice([0.3]));
    t.same([res.ok, res.voyage && res.voyage.arriveDay], [true, 6]);
    b.day = 6;
    BR.settleVoyages(b, d, dice([0.5]));
    t.equal(b.treasuryGP, 160, 'Clan Blackstone is Normal for Fresh Fish: 2 × 80 gp');
    t.same(BR.marketLedger(b).map(function (x) { return [x.port, x.goodId, x.qty, x.day]; }), [['timberport', 'fresh_fish', 2, 6]]);
    var b7 = bastion(4, 2);
    var c7 = registered(b7, 'timberport');
    stock(b7, 'fresh_fish', 2);
    var no = BR.dispatchCargo(b7, bdata, c7.id, [{ goodId: 'fresh_fish', qty: 2 }], dice([0.3]));
    t.same([no.ok, BR.goodsQty(b7, 'fresh_fish')], [false, 2], 'on the real 7-day route it stays in the Warehouse');
  });

  test('the record is kept for 56 days, moves with Reset Travel, and loads the same twice', function (t) {
    var b = sailed();
    b.tradeNetwork.marketLedger = [{ day: -60, port: 'goldport', goodId: 'raw_stone', qty: 3, saleId: 'old' }, { day: 2, port: 'timberport', goodId: 'sailcloth', qty: 1, saleId: 'x' }];
    b.day = 11;
    BR.settleVoyages(b, bdata, dice([0.5]));
    t.same(BR.marketLedger(b).map(function (x) { return x.saleId === 'old' ? 'old' : x.goodId; }), ['sailcloth', 'sawn_lumber'], 'the 56-day-old entry goes');
    BR.shiftDays(b, -5);
    t.same(BR.marketLedger(b).map(function (x) { return x.day; }), [-3, 6]);
    var once = reload(b);
    t.same(BR.toSave(reload(once)).tradeNetwork.marketLedger, BR.toSave(once).tradeNetwork.marketLedger);
  });

  /* ---------------------------------------------------------------- */
  group('Commodity trade: recalling a ship (Harry, 14 October 2026)');

  test('recalled 4 days out: it turns for home, nothing is sold, no roll, back 4 days later with its cargo, once', function (t) {
    var b = sailed();
    b.day = 8;
    var v = BR.voyages(b)[0];
    var res = BR.recallVoyage(b, bdata, v.id);
    t.equal(res.ok, true);
    t.same([v.stage, v.outcome, v.recalledDay, v.returnDay], ['returning', 'recalled', 8, 12]);
    t.ok(/recalled and turned for home; nothing was sold\. It is back on Day 12, and its cargo \(2 lots of Sawn Lumber\) goes back into the Warehouse then\./.test(res.log[1]));
    stock(b, 'raw_stone', 1);
    t.ok(/The ship is at sea: the first one home is back on Day 12/.test(BR.dispatchBlocker(b, bdata)), 'the Dock\'s one ship is busy until it\'s home');
    var calls = 0;
    var spy = function () { calls += 1; return 0.01; };
    for (var d = 9; d <= 12; d++) { b.day = d; BR.settleVoyages(b, bdata, spy); }
    t.equal(calls, 0, 'no risk roll');
    t.same([b.treasuryGP, BR.cargoSales(b).length, BR.marketLedger(b).length, BR.goodsQty(b, 'sawn_lumber'), BR.voyages(b).length], [0, 0, 0, 2, 0]);
    b.day = 13;
    BR.settleVoyages(b, bdata, spy);
    t.equal(BR.goodsQty(b, 'sawn_lumber'), 2, 'only once');
    t.equal(BR.dispatchBlocker(b, bdata), '', 'the ship can sail again');
  });

  test('recalled on its first day out it takes 1 day home; it can\'t be recalled twice, on its arrival day, or after it sold', function (t) {
    var b = sailed();
    var v = BR.voyages(b)[0];
    t.equal(BR.recallVoyage(b, bdata, v.id).voyage.returnDay, 5, 'at least 1 day');
    t.ok(/already been recalled/.test(BR.recallVoyage(b, bdata, v.id).message));
    var b2 = sailed();
    b2.day = 11;
    t.ok(/reaches Goldport today/.test(BR.recallVoyage(b2, bdata, BR.voyages(b2)[0].id).message));
    BR.settleVoyages(b2, bdata, dice([0.5]));
    t.ok(/already reached Goldport/.test(BR.recallVoyage(b2, bdata, BR.voyages(b2)[0].id).message));
    t.ok(/isn't at sea/.test(BR.recallVoyage(b2, bdata, 'nope').message));
  });

  test('a recall survives a reload and Reset Travel; its standing shipment carries on', function (t) {
    var b = bastion(4, 4);
    var c = registered(b);
    stock(b, 'raw_stone', 5);
    BR.setSchedule(b, bdata, c.id, [{ goodId: 'raw_stone', qty: 1 }], dice([0.3]));
    b.day = 5;
    BR.settleVoyages(b, bdata, dice([0.5]));
    var v = BR.voyages(b)[0];
    b.day = 8;
    BR.recallVoyage(b, bdata, v.id);
    var r = reload(b);
    var rv = r.tradeNetwork.voyages[0];
    t.same([rv.stage, rv.outcome, rv.recalledDay, rv.returnDay, BR.schedules(r).length], ['returning', 'recalled', 8, 11, 1]);
    BR.shiftDays(r, -2);
    t.same([rv.recalledDay, rv.returnDay], [6, 9]);
    r.day = 9;
    BR.settleVoyages(r, bdata, dice([0.5]));
    t.equal(BR.goodsQty(r, 'raw_stone'), 5, 'its 1 lot is back in the Warehouse');
    t.same([BR.voyages(r).length, BR.schedules(r)[0].nextDay], [0, 10], 'the ship is home; the standing shipment still sails next on Day 10');
    r.day = 10;
    BR.settleVoyages(r, bdata, dice([0.5]));
    t.same([BR.voyages(r).length, BR.goodsQty(r, 'raw_stone')], [1, 4], 'and on Day 10 it sails again');
    var news = TSI.campaign.ironbowNews(copy(BR.toSave(reload(b))), 8, 12).map(function (w) { return w.day + ' ' + w.lines.join(' / '); });
    t.ok(news.some(function (l) { return /^11 Your cargo ship is home from Goldport\./.test(l); }), news.join(' | '));
    t.ok(!news.some(function (l) { return /reaches Goldport/.test(l); }), 'a recalled ship never reaches the port');
  });

  test('protections: each cut comes off, never below 0; a blessing is used up by its voyage', function (t) {
    t.equal(BR.voyageChance(20, [{ cut: 5 }, { cut: 5 }, { cut: 10 }]), 0);
    t.equal(BR.voyageChance(5, [{ cut: 10 }]), 0);
    t.equal(BR.voyageChance(20, [{ cut: 5 }]), 15);
    t.equal(BR.voyageChance(10, []), 10);
    var prot = copy(C.protections).map(function (p) { p.available = true; return p; });
    var d = withCommerce({ protections: prot });
    var b = bastion(4, 2);
    var c = registered(b);
    stock(b, 'raw_stone', 4);
    t.same(BR.voyageProtections(b, d), [], 'available, but none ready in this Bastion');
    b.tradeNetwork.protections = { pelagos_blessing: { charges: 1 }, maritime_approaches: { untilDay: 6 } };
    BR.dispatchCargo(b, d, c.id, [{ goodId: 'raw_stone', qty: 1 }], dice([0.3]));
    var v = BR.voyages(b)[0];
    t.same([v.chance, v.protections.map(function (p) { return p.id; })], [5, ['maritime_approaches', 'pelagos_blessing']]);
    t.equal(b.tradeNetwork.protections.pelagos_blessing.charges, 0, 'the blessing is used');
    b.day = 6;
    t.same(BR.voyageProtections(b, d).map(function (p) { return p.id; }), ['maritime_approaches'], 'the Watchtower\'s still holds on Day 6; the blessing is gone');
    b.day = 7;
    t.same(BR.voyageProtections(b, d), [], 'the Watchtower\'s has run out by Day 7');
  });

  /* ---------------------------------------------------------------- */
  group('Commodity trade: standing shipments (Dock Level 4)');

  test('a standing shipment needs Dock Level 4, and a registered Charter', function (t) {
    var b = bastion(4, 3);
    var c = registered(b);
    t.equal(BR.setSchedule(b, bdata, c.id, [{ goodId: 'raw_stone', qty: 2 }], dice([0.3])).message, 'Standing shipments need the Dock at Level 4 (it\'s Level 3).');
    b.facilityLevels.dock = 4;
    var r = BR.setSchedule(b, bdata, c.id, [{ goodId: 'raw_stone', qty: 2 }], dice([0.3]));
    t.equal(r.ok, true);
    t.same([r.schedule.nextDay, r.schedule.every], [5, 7]);
    t.ok(/every 7 days, first on Day 5 if a ship and the goods are ready/.test(r.log[1]));
    t.ok(/carries 4 lots/.test(BR.setSchedule(b, bdata, c.id, [{ goodId: 'raw_stone', qty: 5 }], dice([0.3])).message));
    BR.setSchedule(b, bdata, c.id, [{ goodId: 'raw_stone', qty: 3 }], dice([0.3]));
    t.equal(BR.schedules(b).length, 1, 'one per Charter: changed, not added');
  });

  test('it sails when it can, then every 7 days; it waits (said once) for goods or the ship', function (t) {
    var b = bastion(4, 4);
    var c = registered(b);
    BR.setSchedule(b, bdata, c.id, [{ goodId: 'raw_stone', qty: 2 }], dice([0.3]));
    b.day = 5;
    var r = BR.settleVoyages(b, bdata, dice([0.5]));
    t.ok(/waits: Needs 2 lots of Raw Stone in the Warehouse; it has 0 lots\./.test(r.word[0]));
    b.day = 6;
    t.equal(BR.settleVoyages(b, bdata, dice([0.5])).changed, false, 'the same reason isn\'t said again');
    stock(b, 'raw_stone', 5);
    b.day = 7;
    var sail = BR.settleVoyages(b, bdata, dice([0.5]));
    t.ok(/Standing shipment: cargo sailed for Goldport \(arrives Day 14\)/.test(sail.word[0]));
    t.same([BR.voyages(b).length, BR.voyages(b)[0].scheduleId, BR.schedules(b)[0].nextDay, BR.goodsQty(b, 'raw_stone')], [1, BR.schedules(b)[0].id, 14, 3]);
    b.day = 14;
    var arrive = BR.settleVoyages(b, bdata, dice([0.5]));
    t.ok(/waits: The ship is at sea/.test(arrive.word[1]), 'it sold, but the ship isn\'t home until Day 21');
    b.day = 21;
    var home = BR.settleVoyages(b, bdata, dice([0.5]));
    t.same(home.word.slice(0, 2), ['The cargo ship is home from Goldport.', 'Standing shipment: cargo sailed for Goldport (arrives Day 28).'], 'home and away the same day');
    t.equal(BR.goodsQty(b, 'raw_stone'), 1);
  });

  test('two standing shipments sharing one ship take turns (a review fix)', function (t) {
    var b = bastion(4, 4);
    var tbr = registered(b, 'timberport');
    var gld = registered(b, 'goldport');
    stock(b, 'raw_stone', 50);
    BR.setSchedule(b, bdata, tbr.id, [{ goodId: 'raw_stone', qty: 1 }], dice([0.3]));
    BR.setSchedule(b, bdata, gld.id, [{ goodId: 'raw_stone', qty: 1 }], dice([0.7]));
    var sailed2 = [];
    for (var d = 5; d <= 61; d++) {
      b.day = d;
      var before = BR.voyages(b).map(function (v) { return v.id; });
      BR.settleVoyages(b, bdata, dice([0.5]));
      BR.voyages(b).forEach(function (v) { if (before.indexOf(v.id) === -1) sailed2.push(d + ' ' + v.port); });
    }
    t.same(sailed2, ['5 timberport', '19 goldport', '33 timberport', '47 goldport', '61 timberport']);
  });

  test('a Dock lowered below Level 4 makes it wait; Stop ends it', function (t) {
    var b = bastion(4, 4);
    var c = registered(b);
    stock(b, 'raw_stone', 5);
    var sc = BR.setSchedule(b, bdata, c.id, [{ goodId: 'raw_stone', qty: 2 }], dice([0.3])).schedule;
    b.facilityLevels.dock = 3;
    b.day = 5;
    t.ok(/need the Dock at Level 4/.test(BR.settleVoyages(b, bdata, dice([0.5])).word[0]));
    t.equal(BR.stopSchedule(b, bdata, sc.id).ok, true);
    t.equal(BR.stopSchedule(b, bdata, sc.id).ok, false);
    t.same(BR.schedules(b), []);
  });

  /* ---------------------------------------------------------------- */
  group('Commodity trade: saves, Reset Travel and the old trade');

  test('a Bastion saved before pull request 5 loads with no Charters, ships or sales; loading twice is the same', function (t) {
    var s = copy(BR.toSave(bastion(4)));
    s.tradeNetwork = { active: true, strategy: 'balanced', stability: 75, routes: [] };
    var b = BR.fromSave(s, bdata);
    t.same([b.tradeNetwork.portCharters, b.tradeNetwork.voyages, b.tradeNetwork.schedules, b.tradeNetwork.cargoSales, b.tradeNetwork.protections], [[], [], [], [], {}]);
    var full = sailed();
    full.day = 11;
    BR.settleVoyages(full, bdata, dice([0.5]));
    full.facilityLevels.dock = 4;
    BR.setSchedule(full, bdata, BR.portCharters(full)[0].id, [{ goodId: 'raw_stone', qty: 1 }], dice([0.3]));
    var once = reload(full);
    t.same(BR.toSave(reload(once)), BR.toSave(once));
    t.same(BR.toSave(once).tradeNetwork, BR.toSave(full).tradeNetwork);
  });

  test('Reset Travel moves the Charters, ships and standing shipments; sales are history', function (t) {
    var b = sailed();
    b.day = 11;
    BR.settleVoyages(b, bdata, dice([0.5]));
    b.facilityLevels.dock = 4;
    BR.setSchedule(b, bdata, BR.portCharters(b)[0].id, [{ goodId: 'raw_stone', qty: 1 }], dice([0.3]));
    b.tradeNetwork.protections = { maritime_approaches: { untilDay: 20 } };
    var sale = copy(BR.cargoSales(b));
    BR.shiftDays(b, -5);
    var c = BR.portCharters(b)[0];
    var v = BR.voyages(b)[0];
    t.same([c.earnedDay, c.registeredDay, v.departDay, v.arriveDay, v.returnDay, BR.schedules(b)[0].nextDay, b.tradeNetwork.protections.maritime_approaches.untilDay],
      [-2, -1, -1, 6, 13, 7, 15]);
    t.same(BR.cargoSales(b), sale);
  });

  test('the forecast says when a ship arrives and is home, and when a standing shipment sails; never gold', function (t) {
    var b = sailed();
    b.facilityLevels.dock = 4;
    BR.setSchedule(b, bdata, BR.portCharters(b)[0].id, [{ goodId: 'raw_stone', qty: 1 }], dice([0.3]));
    withHall(b, 2);
    BR.applyInbox(b, bdata, exWith([charterMsg({ id: 'chartr-timb0000:dm:0', port: 'timberport', clan: 'blackstone' })]), 1000);
    BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4]));
    var news = TSI.campaign.ironbowNews(copy(BR.toSave(b)), 4, 18);
    var lines = [].concat.apply([], news.map(function (w) { return w.lines.map(function (l) { return w.day + ' ' + l; }); }));
    t.ok(lines.indexOf('11 Your cargo ship reaches Goldport.') !== -1, lines.join(' | '));
    t.ok(lines.indexOf('18 Your cargo ship is home from Goldport.') !== -1);
    t.ok(lines.indexOf('5 A standing shipment to Goldport is due to sail, if a ship and the goods are ready.') !== -1);
    t.ok(lines.indexOf('7 Hall of Emissaries: Register Port Charter (Timberport) is complete.') !== -1, 'no roll for the Register order');
    t.ok(!lines.some(function (l) { return /gp|sold|turned back/.test(l); }), 'never what it sells for');
  });

  test('the old trade is untouched: routes, their income and Expected Income / Week', function (t) {
    var b = sailed();
    b.tradeNetwork.active = true;
    b.tradeNetwork.routes = [{ id: 'r1', clan: 'Molten', commodity: 'Precious Metals', risk: 'low', status: 'active', yieldGP: 100, openedDay: 4, nextDay: 11 }];
    var before = copy(b.tradeNetwork.routes);
    var income = BR.passiveIncome(b);
    b.day = 11;
    BR.settleVoyages(b, bdata, dice([0.5]));
    t.same(b.tradeNetwork.routes, before);
    t.equal(BR.passiveIncome(b), income);
    t.equal(BR.routesDueToday(b), true, 'the route still sails as before');
    t.equal(b.treasuryGP, 320, 'only the cargo was paid');
  });

  /* ---------- Negotiated Charter terms and the two protections (Harry, 20 October 2026) ---------- */
  group('Charter terms and commercial protections (20 October 2026)');

  var STD = { priceMult: 1, feePerLot: 0, tariffPct: 0 };
  function bw(b) {
    b.builtExtras = [{ facId: 'barracks', status: 'built' }, { facId: 'watchtower', status: 'built' }];
    BR.ensureLevels(b, bdata);
    b.facilityLevels.barracks = 2;
    b.facilityLevels.watchtower = 2;
    return b;
  }
  function ordered(b, fac, fn) {
    var r = BR.issueOrder(b, bdata, fac, fn, 0, dice([0.3]));
    if (!r.ok) throw new Error('refused: ' + r.message);
    return b.pendingOrders[b.pendingOrders.length - 1];
  }
  function finishOrder(b, o) { var out = BR.completeSimpleOrder(b, bdata, o, dice([0.3])); BR.removeOrder(b, o.id); return out; }
  /* Sends a ship; any earlier one is cleared first, so a test can send several (the Dock's own room is tested elsewhere). */
  function sail(b, c, qty, rolls) {
    b.tradeNetwork.voyages = [];
    stock(b, 'medicinal_herbs', qty || 2);
    var r = BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'medicinal_herbs', qty: qty || 2 }], dice(rolls || [0.3]));
    if (!r.ok) throw new Error(r.message);
    return r.voyage;
  }

  test('a Charter has standard terms (×1.00, 0 gp, 0%) until the DM amends them; the Charter and the Dock use them', function (t) {
    var b = bastion(4, 2);
    var c = registered(b);
    t.same(BR.effectiveTerms(bdata, c, c.port, c.clan), STD);
    t.equal(BR.isStandardTerms(bdata, c), true);
    t.equal(BR.termsText(STD), '×1.00 price · 0 gp shipping a lot · 0% tariff');
    t.equal(c.termsLog, undefined, 'no history on a Charter never amended');
  });

  test('the limits: price ×0.50 to ×2.00, fee 0 to 50 gp a lot, tariff 0 to 50%; typed values are checked', function (t) {
    function ok(p, f, tr) { return BR.checkTermsInput({ priceMult: p, feePerLot: f, tariffPct: tr }).ok; }
    t.equal(ok(0.5, 0, 0), true); t.equal(ok(2, 50, 50), true); t.equal(ok('1.25', '5', '10'), true);
    t.equal(ok(0.49, 0, 0), false); t.equal(ok(2.01, 0, 0), false); t.equal(ok(1, -1, 0), false); t.equal(ok(1, 51, 0), false);
    t.equal(ok(1, 0, 51), false); t.equal(ok(1, 0, -1), false); t.equal(ok(1, 2.5, 0), false); t.equal(ok(1, 0, 5.5), false);
    t.equal(ok('', 0, 0), false); t.equal(ok('abc', 0, 0), false); t.equal(ok(1.255, 0, 0), false);
    t.equal(ok(0.9, 5, 10), true, 'worse than standard is allowed when the DM sets it');
  });

  test('amending needs a reason, changes nothing on a refusal, and records the day, old terms, new terms and why', function (t) {
    var b = bastion(4, 2);
    var c = registered(b);
    var before = copy(BR.toSave(b));
    t.equal(BR.amendCharterTerms(b, bdata, c.id, { priceMult: 1.25, feePerLot: 0, tariffPct: 0 }, '').ok, false, 'no reason');
    t.equal(BR.amendCharterTerms(b, bdata, c.id, { priceMult: 3, feePerLot: 0, tariffPct: 0 }, 'a feast').ok, false, 'over the limit');
    t.equal(BR.amendCharterTerms(b, bdata, c.id, STD, 'nothing changes').ok, false, 'the same terms');
    t.same(copy(BR.toSave(b)), before, 'refusals changed nothing');
    var r = BR.amendCharterTerms(b, bdata, c.id, { priceMult: 1.25, feePerLot: 5, tariffPct: 10 }, '  The party saved   the harbour master\'s daughter. ');
    t.equal(r.ok, true, r.message);
    t.same(BR.effectiveTerms(bdata, c, c.port, c.clan), { priceMult: 1.25, feePerLot: 5, tariffPct: 10 });
    t.same(c.termsLog, [{ day: 4, kind: 'amend', before: STD, after: { priceMult: 1.25, feePerLot: 5, tariffPct: 10 }, why: 'The party saved the harbour master\'s daughter.' }]);
    t.ok(/Day 4/.test(r.log[1]) && /saved the harbour master/.test(r.log[1]) && /ships already at sea/i.test(r.log[1]));
    t.equal(b.treasuryGP, 0, 'no gold, Honour, Respect or Political Capital changes');
    b.day = 9;
    t.equal(BR.amendCharterTerms(b, bdata, c.id, { priceMult: 0.9, feePerLot: 0, tariffPct: 0 }, 'a bad harvest').ok, true);
    t.equal(c.termsLog.length, 2, 'the history only grows');
    var again = reload(b);
    t.same(BR.charterFor(again, c.port).termsLog, c.termsLog, 'kept through a reload');
    t.same(copy(BR.toSave(reload(again))), copy(BR.toSave(again)), 'loading twice changes nothing');
  });

  test('a Charter can be amended before it is registered, but still can\'t ship until it is', function (t) {
    var b = bastion(4, 2);
    BR.addCharter(b, charterMsg({}), b.day);
    var c = BR.charterFor(b, 'goldport');
    t.equal(c.status, 'earned');
    t.equal(BR.amendCharterTerms(b, bdata, c.id, { priceMult: 1.1, feePerLot: 0, tariffPct: 0 }, 'a gift').ok, true);
    stock(b, 'medicinal_herbs', 2);
    t.equal(BR.dispatchCargo(b, bdata, c.id, [{ goodId: 'medicinal_herbs', qty: 2 }], dice([0.3])).ok, false, 'shipping needs registration');
  });

  test('the price multiplier, fee and tariff change a sale; the worked estimate uses the same engine and says what it is', function (t) {
    var b = bastion(4, 2);
    var c = registered(b);
    var std = BR.cargoQuote(bdata, c, c.port, c.clan, [{ goodId: 'medicinal_herbs', qty: 2 }]);
    BR.amendCharterTerms(b, bdata, c.id, { priceMult: 1.5, feePerLot: 10, tariffPct: 10 }, 'a trade deal');
    var q = BR.cargoQuote(bdata, c, c.port, c.clan, [{ goodId: 'medicinal_herbs', qty: 2 }]);
    t.equal(std.gross, 350, '2 lots × 140 × ×1.25 (Molten)');
    t.same([q.gross, q.fee, q.tariff, q.net], [525, 20, 52, 453], '×1.5; 10 gp a lot; 10% of 525');
    var pv = BR.termsPreview(b, bdata, c);
    t.same([pv.lots, pv.standard.net, pv.current.net > pv.standard.net], [4, 700, true]);
    t.same(BR.cargoQuote(bdata, c, c.port, c.clan, [{ goodId: 'medicinal_herbs', qty: 2 }], null, STD).net, 350, 'locked standard terms');
  });

  test('reset needs a reason, removes the overrides and keeps the history; it makes no agreement', function (t) {
    var b = bastion(4, 2);
    var c = registered(b);
    t.equal(BR.resetCharterTerms(b, bdata, c.id, 'because').ok, false, 'already standard');
    BR.amendCharterTerms(b, bdata, c.id, { priceMult: 0.8, feePerLot: 3, tariffPct: 5 }, 'a feud');
    t.equal(BR.resetCharterTerms(b, bdata, c.id, '').ok, false, 'a reason is required');
    var r = BR.resetCharterTerms(b, bdata, c.id, 'the feud ended');
    t.equal(r.ok, true, r.message);
    t.same([c.terms, BR.isStandardTerms(bdata, c)], [{}, true]);
    t.same(c.termsLog.map(function (e) { return [e.kind, e.why]; }), [['amend', 'a feud'], ['reset', 'the feud ended']]);
    t.same(BR.portCharters(b).length, 1, 'no new agreement');
  });

  test('a ship keeps the terms it sailed with: the full terms are saved at departure, and survive a reload and a later amendment', function (t) {
    var b = bastion(4, 2);
    var c = registered(b);
    BR.amendCharterTerms(b, bdata, c.id, { priceMult: 1.5, feePerLot: 10, tariffPct: 10 }, 'a trade deal');
    var v = sail(b, c, 2);
    t.same(v.terms, { priceMult: 1.5, feePerLot: 10, tariffPct: 10 }, 'the whole terms, not a partial object');
    var other = bastion(4, 2);
    var c2 = registered(other);
    t.same(sail(other, c2, 2).terms, STD, 'standard terms are saved in full too');
    BR.amendCharterTerms(b, bdata, c.id, { priceMult: 0.5, feePerLot: 50, tariffPct: 50 }, 'a disaster');
    b = reload(b);
    t.same(BR.voyages(b)[0].terms, { priceMult: 1.5, feePerLot: 10, tariffPct: 10 }, 'still the departure terms');
    b.day = 11;
    BR.settleVoyages(b, bdata, dice([0.5]));
    t.equal(b.treasuryGP, 453, 'paid at the departure terms');
    var rec = BR.cargoSales(b)[0];
    t.same([rec.net, rec.fee, rec.tariff, rec.priceMult, rec.tariffPct], [453, 20, 52, 1.5, 10]);
    BR.settleVoyages(b, bdata, dice([0.5]));
    t.equal(b.treasuryGP, 453, 'never paid twice');
  });

  test('a standing shipment uses the terms in effect at each departure', function (t) {
    var b = bastion(4, 4);
    var c = registered(b);
    stock(b, 'medicinal_herbs', 4);
    var set = BR.setSchedule(b, bdata, c.id, [{ goodId: 'medicinal_herbs', qty: 2 }], dice([0.3]));
    t.equal(set.ok, true, set.message);
    BR.amendCharterTerms(b, bdata, c.id, { priceMult: 1.2, feePerLot: 0, tariffPct: 0 }, 'a favour');
    b.day = 5;
    BR.settleVoyages(b, bdata, dice([0.3]));
    var v = BR.voyages(b)[0];
    t.ok(v && v.scheduleId, 'it sailed');
    t.same(v.terms, { priceMult: 1.2, feePerLot: 0, tariffPct: 0 });
    BR.amendCharterTerms(b, bdata, c.id, { priceMult: 1.9, feePerLot: 0, tariffPct: 0 }, 'a later change');
    t.same(BR.voyages(b)[0].terms.priceMult, 1.2, 'a later change affects later sailings only');
  });

  test('an outbound ship saved before terms existed gets its current effective terms once, before any amendment can reprice it', function (t) {
    var b = bastion(4, 2);
    var c = registered(b);
    BR.amendCharterTerms(b, bdata, c.id, { priceMult: 1.4, feePerLot: 2, tariffPct: 0 }, 'old deal');
    var v = sail(b, c, 2);
    var old = copy(BR.toSave(b));
    delete old.tradeNetwork.voyages[0].terms;
    var loaded = BR.fromSave(copy(old), bdata);
    t.same(BR.voyages(loaded)[0].terms, { priceMult: 1.4, feePerLot: 2, tariffPct: 0 }, 'set on load');
    var legacy = BR.fromSave(copy(old), bdata);
    legacy.tradeNetwork.voyages[0].terms = null;
    var cc = BR.charterFor(legacy, 'goldport');
    BR.amendCharterTerms(legacy, bdata, cc.id, { priceMult: 2, feePerLot: 0, tariffPct: 0 }, 'a change');
    t.same(BR.voyages(legacy)[0].terms, { priceMult: 1.4, feePerLot: 2, tariffPct: 0 }, 'locked before the amendment took effect');
    t.same(copy(BR.toSave(BR.fromSave(copy(BR.toSave(loaded)), bdata))), copy(BR.toSave(loaded)), 'stable through reload');
    var home = bastion(4, 2);
    var ch = registered(home);
    var vh = sail(home, ch, 2);
    home.day = 11;
    BR.settleVoyages(home, bdata, dice([0.5]));
    t.equal(BR.voyages(home)[0].stage, 'returning');
    delete BR.voyages(home)[0].terms;
    t.same(BR.lockOutboundTerms(home, bdata), 0, 'a returning ship is left alone');
  });

  group('Commercial protections: Barracks and Watchtower (20 October 2026)');

  test('the Barracks and Watchtower orders: Level 2, 3 and 2 days, no gold or Favour', function (t) {
    var g = BR.fn(BR.facility(bdata, 'barracks'), 'guard_commercial_convoy');
    var w = BR.fn(BR.facility(bdata, 'watchtower'), 'protect_maritime_approaches');
    t.same([g.days, g.costGP, g.requiredFacilityLevel, g.favourCost, g.protectionCharge, g.protectionMax], [3, 0, 2, undefined, 'commercial_convoy', 1]);
    t.same([w.days, w.costGP, w.requiredFacilityLevel, w.favourCost, w.protectionWindow, w.windowDays], [2, 0, 2, undefined, 'maritime_approaches', 7]);
    var b = bw(bastion(4, 2));
    b.facilityLevels.barracks = 1;
    t.equal(BR.issueOrder(b, bdata, 'barracks', 'guard_commercial_convoy', 0, dice([0.3])).message, 'Needs Level 2.');
    b.facilityLevels.watchtower = 1;
    t.equal(BR.issueOrder(b, bdata, 'watchtower', 'protect_maritime_approaches', 0, dice([0.3])).message, 'Needs Level 2.');
    t.ok(BR.fn(BR.facility(bdata, 'watchtower'), 'patrol'), 'Patrol is unchanged');
  });

  test('Guard Commercial Convoy: 3 days, one charge, never more than one held, no defenders used; the next ship uses it up once', function (t) {
    var b = bw(bastion(4, 2));
    b.defenders = { count: 5, armed: true };
    var c = registered(b);
    var o = ordered(b, 'barracks', 'guard_commercial_convoy');
    t.equal(o.dueDay, 7, '3 days');
    t.equal(BR.issueOrder(b, bdata, 'barracks', 'guard_commercial_convoy', 0, dice([0.3])).message, 'That order is already pending.');
    t.same(finishOrder(b, o), [['Order Completed', 'Barracks: Guard Commercial Convoy → A Commercial Convoy is prepared for the next ship the Dock sends with cargo (1 held).']]);
    t.same(b.tradeNetwork.protections, { commercial_convoy: { charges: 1 } });
    t.equal(b.defenders.count, 5, 'no defenders deducted');
    var again = BR.issueOrder(b, bdata, 'barracks', 'guard_commercial_convoy', 0, dice([0.3]));
    t.same([again.ok, /already prepared/.test(again.message)], [false, true], 'no second order while one is ready');
    b = reload(b);
    t.equal(b.tradeNetwork.protections.commercial_convoy.charges, 1, 'kept through a save and day progression');
    c = BR.charterFor(b, 'goldport');
    var v = sail(b, c, 2);
    t.same([v.protections.map(function (p) { return [p.id, p.cut]; }), v.basePct, v.chance], [[['commercial_convoy', 5]], 20, 15]);
    t.equal(b.tradeNetwork.protections.commercial_convoy.charges, 0, 'used exactly once');
    var v2 = sail(b, c, 2);
    t.same([v2.protections, v2.chance], [[], 20], 'the next ship goes without it');
    t.equal(BR.issueOrder(b, bdata, 'barracks', 'guard_commercial_convoy', 0, dice([0.3])).ok, true, 'another can be ordered now it has been used');
  });

  test('Protect Maritime Approaches: 2 days, then 7 inclusive days with the completion day as Day 1; not used up, not extended, no retroactive cover', function (t) {
    var b = bw(bastion(4, 2));
    var c = registered(b);
    var early = sail(b, c, 2);
    var o = ordered(b, 'watchtower', 'protect_maritime_approaches');
    t.equal(o.dueDay, 6, '2 days');
    b.day = 6;
    var out = finishOrder(b, o);
    t.equal(b.tradeNetwork.protections.maritime_approaches.untilDay, 12, 'Day 6 is Day 1: it covers Days 6 to 12');
    t.ok(/active until Day 12/.test(out[0][1]), out[0][1]);
    t.same(early.protections, [], 'a ship already at sea gets nothing retroactively');
    var blocked = BR.issueOrder(b, bdata, 'watchtower', 'protect_maritime_approaches', 0, dice([0.3]));
    t.same([blocked.ok, /active until Day 12/.test(blocked.message)], [false, true], 'no overlapping order');
    var a = sail(b, c, 2);
    var a2 = sail(b, c, 2);
    t.same([a.chance, a2.chance, b.tradeNetwork.protections.maritime_approaches.untilDay], [15, 15, 12], 'every ship in the window, and it is not used up');
    b.day = 12;
    t.equal(sail(b, c, 2).chance, 15, 'the 7th day still covers');
    b.day = 13;
    t.equal(sail(b, c, 2).chance, 20, 'the 8th does not');
    t.equal(BR.issueOrder(b, bdata, 'watchtower', 'protect_maritime_approaches', 0, dice([0.3])).ok, true, 'the next order can be issued once it ends');
    var late = reload(b);
    t.same(BR.voyages(late)[BR.voyages(late).length - 1].chance, 20);
    t.equal(a.chance, 15, 'later expiry never changes a ship already under way');
  });

  test('the three protections combine (−5, −5 and −10) and never take the chance below 0; the Pelagos blessing is unchanged; a failed voyage still returns the cargo', function (t) {
    var b = bw(bastion(4, 2));
    var c = registered(b, 'timberport');
    b.tradeNetwork.protections = { commercial_convoy: { charges: 1 }, maritime_approaches: { untilDay: 20 }, pelagos_blessing: { charges: 2 } };
    var v = sail(b, c, 2);
    t.same([v.basePct, v.protections.map(function (p) { return p.cut; }), v.chance], [5, [5, 5, 10], 0], 'Timberport 5% − 20 points: never below 0');
    t.same(b.tradeNetwork.protections, { commercial_convoy: { charges: 0 }, maritime_approaches: { untilDay: 20 }, pelagos_blessing: { charges: 1 } }, 'the Convoy and one Blessing are used; the Approaches stay');
    var d = bw(bastion(4, 2));
    var g = registered(d, 'bleakharbour');
    d.tradeNetwork.protections = { commercial_convoy: { charges: 1 }, maritime_approaches: { untilDay: 20 }, pelagos_blessing: { charges: 1 } };
    t.same([sail(d, g, 2).chance], [0], 'Bleakharbour 20% − 20 = 0');
    var h = bw(bastion(4, 2));
    var gp = registered(h, 'goldport');
    sail(h, gp, 2, [0.3]);
    h.day = 11;
    BR.settleVoyages(h, bdata, dice([0.05]));
    t.same([BR.voyages(h)[0].outcome, h.treasuryGP], ['turned_back', 0], 'trouble at sea: nothing sold');
  });

  test('Standing shipments follow the same protection rules', function (t) {
    var b = bw(bastion(4, 4));
    var c = registered(b);
    stock(b, 'medicinal_herbs', 4);
    b.tradeNetwork.protections = { commercial_convoy: { charges: 1 }, maritime_approaches: { untilDay: 30 } };
    t.equal(BR.setSchedule(b, bdata, c.id, [{ goodId: 'medicinal_herbs', qty: 2 }], dice([0.3])).ok, true);
    b.day = 5;
    BR.settleVoyages(b, bdata, dice([0.3]));
    var v = BR.voyages(b)[0];
    t.same([v.scheduleId !== null, v.protections.map(function (p) { return p.id; }), v.chance], [true, ['commercial_convoy', 'maritime_approaches'], 10]);
    t.same(b.tradeNetwork.protections, { commercial_convoy: { charges: 0 }, maritime_approaches: { untilDay: 30 } });
  });

  test('protectionStatus describes each one for the Dock', function (t) {
    var b = bw(bastion(4, 2));
    var st = function () { return BR.protectionStatus(b, bdata).map(function (p) { return [p.id, p.state]; }); };
    t.same(st(), [['commercial_convoy', 'none'], ['maritime_approaches', 'none'], ['pelagos_blessing', 'none']]);
    b.tradeNetwork.protections = { commercial_convoy: { charges: 1 }, maritime_approaches: { untilDay: 9 } };
    t.same(st(), [['commercial_convoy', 'ready'], ['maritime_approaches', 'active'], ['pelagos_blessing', 'none']]);
    t.ok(/active until Day 9/.test(BR.protectionStatus(b, bdata)[1].text));
  });

}());
