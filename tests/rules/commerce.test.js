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

  test('demand: four levels; every Clan is Normal for everything until Harry approves a table', function (t) {
    t.same(Object.keys(C.demandLevels).map(function (k) { return [k, C.demandLevels[k].label, C.demandLevels[k].mult]; }),
      [['high', 'Highly sought-after', 1.25], ['moderate', 'Moderate', 1.1], ['normal', 'Normal', 1], ['oversupplied', 'Oversupplied', 0.75]]);
    T.bastion.clans.forEach(function (c) {
      t.same(C.demand[c.key], {}, c.key + ' has no demand set');
      T.bastionGoods.goods.forEach(function (g) {
        if (g.kind === 'cargo') t.equal(BR.demandFor(bdata, c.key, g.id).mult, 1);
      });
    });
  });

  test('no fees or tariffs; 7 days out and 7 back; risks 5, 10 and 20 in 100', function (t) {
    t.equal(C.feePerLot, 0);
    t.equal(C.tariffPct, 0);
    t.same(C.tariffByClan, {});
    t.same([C.risks.low.pct, C.risks.medium.pct, C.risks.high.pct], [5, 10, 20]);
    Bg.ports().forEach(function (p) {
      var r = BR.portRoute(bdata, p);
      t.ok(r, p + ' has a route');
      t.same([r.outDays, r.backDays], [7, 7], p);
    });
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

  test('protections are built in but none is available; Fresh Fish stays on the local market', function (t) {
    t.same(C.protections.map(function (p) { return [p.facId, p.cut, p.consumes === true, p.available]; }),
      [['barracks', 5, false, false], ['watchtower', 5, false, false], ['shrine_pelagos', 10, true, false]]);
    t.same(BR.voyageProtections(bastion(1), bdata), []);
    t.ok(/local market/.test(BR.goodShipBlocker(bdata, 'fresh_fish', BR.portRoute(bdata, 'timberport'))));
    t.equal(BR.goodShipBlocker(bdata, 'preserved_fish', BR.portRoute(bdata, 'timberport')), '');
    t.ok(/isn't a trade good/.test(BR.goodShipBlocker(bdata, 'restorative_herbs', null)));
  });

  test('the ports: Timberport and Goldport, spelt as the Explorer\'s pins, with their regions\' Clans', function (t) {
    t.same(Bg.ports(), ['timberport', 'goldport']);
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
    t.ok(/port the Bastion doesn't know \(leatherport\)/.test(Bg.check(charterMsg({ port: 'leatherport' }))));
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
    t.ok(/isn't a port/.test(J.grantCharter(s, 'leatherport', {}, saved).message));
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
    t.ok(/Port Charter for Goldport \(Clan Molten\) \(DM, Day 3\): the Bastion now holds it\. Register it at the Hall of Emissaries \(Level 2\)/.test(b.log[0].body));
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
  group('Commodity trade: the Hall registers a Port Charter (3 days, Level 2)');

  test('Register Port Charter: Level 2, no gold, 3 days, the earned Charters to pick from', function (t) {
    var b = withHall(bastion(4), 1);
    var hall = BR.facility(bdata, 'hall_of_emissaries');
    var fn = BR.fn(hall, 'register_port_charter');
    t.same([fn.days, fn.costGP, fn.requiredFacilityLevel], [3, 0, 2]);
    t.equal(BR.isEmissary(hall, fn), false, 'no roll');
    t.same(BR.fnAvailable(b, hall, fn), { ok: false, message: 'Needs Level 2.' });
    b.facilityLevels.hall_of_emissaries = 2;
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
    t.ok(/already pending/.test(BR.issueOrder(b, bdata, 'hall_of_emissaries', 'register_port_charter', 0, dice([0.4])).message));
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
      [[{ goodId: 'fresh_fish', qty: 1 }], /local market/],
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
    v.cargoSales = null;
    v.tradeNetwork.cargoSales.push({ id: v.tradeNetwork.voyages[0].id, outcome: 'sold', net: 320 });
    v.day = 11;
    BR.settleVoyages(v, bdata, dice([0.5]));
    t.equal(v.treasuryGP, 0, 'a voyage with a receipt already is never paid again');
  });

  test('the price: demand by kind or by good, the Charter\'s price factor, fees and tariffs, rounded down', function (t) {
    var d = withCommerce({ demand: { molten: { timber: 'high', sawn_lumber: 'moderate', fish: 'oversupplied' } } });
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
    BR.settleVoyages(b, withCommerce({ demand: { molten: { timber: 'high' } } }), dice([0.5]));
    t.equal(b.treasuryGP, 400);
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
    t.same(BR.voyageProtections(bastion(7), d), [], 'the Watchtower\'s has run out by Day 7');
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
}());
