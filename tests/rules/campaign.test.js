/* The campaign at a glance (shared/js/campaign-rules.js): what the DM doc
   shows from the Explorer's and the Bastion's saves (7 October 2026). */
(function () {
  var C = TSI.campaign;
  var REG = window.TSI_DATA.regions;
  var ER = TSI.explorer.rules;
  var ED = window.TSI_DATA.explorer;
  var EE = window.TSI_DATA.journeyEvents;
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools };

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function explorer(region) {
    var s = ER.defaultState(ED);
    if (region) s.travel.provinceId = region;
    return s;
  }
  function bastion() { return BR.defaultState(bdata); }
  function sum(ex, ba) { return C.summary(ex, ba, REG); }

  group('DM doc: the campaign at a glance');

  test('the seven regions are the Explorer\'s seven, with the Bastion\'s Clans and gods', function (t) {
    t.same(Object.keys(REG), ED.provinces.map(function (p) { return p.id; }), 'the same regions, in the same order');
    ED.provinces.forEach(function (p) { t.equal(REG[p.id].label, p.label, p.id); });
    var clans = T.bastion.clans.map(function (c) { return c.key; }).sort();
    t.same(Object.keys(REG).map(function (id) { return REG[id].clanKey; }).sort(), clans, 'one region for each of the Bastion\'s seven Clans');
    var gods = T.bastion.gods.map(function (g) { return g.key; });
    Object.keys(REG).forEach(function (id) {
      var r = REG[id];
      t.equal(T.bastion.clans.filter(function (c) { return c.key === r.clanKey; })[0].name, r.clan, id + ': the Clan\'s name as the Bastion spells it');
      t.ok(gods.indexOf(r.god) >= 0, id + ': a god the Bastion keeps Favour for');
      t.equal(T.bastion.gods.filter(function (g) { return g.key === r.god; })[0].name, r.godName, id + ': the god\'s name as the Bastion spells it');
    });
  });

  test('nothing saved yet: level 7 (the Bastion\'s starting level), no day, no region', function (t) {
    var s = sum(null, null);
    t.same([s.explorerSaved, s.bastionSaved], [false, false]);
    t.same(s.level, { value: 7, fromBastion: false });
    t.same([s.heroes, s.day, s.daysPassed, s.orders, s.nextWord], [[], null, null, null, null]);
    t.same([s.region, s.clan, s.god, s.effects], [null, null, null, []]);
    t.same([s.partyEffects, s.rite], [[], null]);
    t.same(s.expedition, { n: 0, state: 'none', startedDay: null, endedDay: null, daysRunning: null }, 'no Explorer, no expedition');
  });

  test('a fresh Explorer and Bastion: Day 1, five heroes, no orders yet, the Northern Province', function (t) {
    var s = sum(explorer(), bastion());
    t.same(s.heroes.map(function (h) { return h.name; }), ['Kaelen', 'Umbrys', 'Magnus', 'Elara', 'Charles']);
    t.same(s.heroes.map(function (h) { return h.id; }), ['kaelen', 'umbrys', 'magnus', 'elara', 'charles'], 'each hero carries the Explorer\'s id');
    t.same(s.heroes.map(function (h) { return h.effects.length; }), [0, 0, 0, 0, 0]);
    t.same([s.partyEffects, s.rite, s.expedition.state], [[], null, 'none']);
    t.same([s.day, s.daysPassed], [1, 0]);
    t.same([s.orders, s.nextWord], [{ count: 0, next: null, list: [] }, null], 'a Bastion that hasn\'t read the Explorer\'s day yet has no word to send');
    t.same(s.level, { value: 7, fromBastion: true });
    t.same(s.region, { id: 'northern_province', label: 'Northern Province' });
    t.same(s.clan, { name: 'Blackstone', chief: 'Boris Blackstone', politicalCapital: 0, honourRespect: 0 });
    t.same(s.god, { key: 'telluria', name: 'Telluria', favour: 0 });
  });

  /* A Bastion on Day 10 (following the Explorer) with a little of everything coming. */
  function busy() {
    var b = bastion();
    b.day = 10;
    b.anchored = true;
    b.builtExtras = [{ facId: 'arcane_laboratory', status: 'building', startDay: 1, readyDay: 22 }, { facId: 'shrine_aurush', status: 'built' }];
    b.pendingOrders = [
      { id: 'a', facId: 'barracks', fnId: 'recruit_defenders', label: 'Barracks: Recruit Defenders', issuedDay: 9, dueDay: 14 },
      { id: 'h', facId: 'hall_of_emissaries', fnId: 'secure_trade_agreement', label: 'Hall of Emissaries: Secure Trade Agreement (Clan Karr)', issuedDay: 10, dueDay: 17 },
      { id: 'w', facId: 'war_council', fnId: 'war_action', label: 'War Action', issuedDay: 10, dueDay: 13, meta: { kind: 'war_action', objective: 'raid', targetName: 'Bacca' } },
      { id: 'd', facId: 'dock', fnId: 'charter_berth', label: 'Dock: Charter Berth (Longship)', issuedDay: 8, dueDay: 15 }
    ];
    b.repairs = { dock: 16 };
    b.diplomacy.agreements = [{ title: 'Trade Agreement', clan: 'Clan Karr', startDay: 5, endDay: 26, income: 90, lastShipmentDay: 5 }];
    b.diplomacy.delegations = [{ title: 'Hosted Delegation (assertive)', clan: 'Clan Slade', startDay: 9, endDay: 23 }];
    b.tradeNetwork.active = true;
    b.tradeNetwork.routes = [{ id: 'r', clan: 'Karr', risk: 'high', status: 'active', nextDay: 12, expiresDay: 40 }, { id: 's', clan: 'Farmer', risk: 'low', status: 'active', nextDay: 12, expiresDay: 40 }];
    b.warRecovery = [{ id: 'x', kind: 'beast', name: 'Ape', status: 'wounded', untilDay: 11 }];
    b.wars = { bacca: { since: 6, last: 10, next: 13 } };
    return b;
  }

  test('orders pending and the next word from the Ironbow, after the Explorer\'s day', function (t) {
    var e = explorer();
    e.travel.day = 10;
    var s = sum(e, busy());
    t.same(s.orders, { count: 4, next: { day: 13, label: 'War Action', inDays: 3 }, list: [
      { day: 13, label: 'War Action', inDays: 3 },
      { day: 14, label: 'Barracks: Recruit Defenders', inDays: 4 },
      { day: 15, label: 'Dock: Charter Berth (Longship)', inDays: 5 },
      { day: 17, label: 'Hall of Emissaries: Secure Trade Agreement (Clan Karr)', inDays: 7 }
    ] });
    t.same(s.nextWord, { day: 11, inDays: 1, lines: ['The Ape is fit to fight again.'] });
    e.travel.day = 11;
    t.same(sum(e, busy()).nextWord.day, 12, 'the Bastion\'s day 11 is still to come, but the DM doc looks after the Explorer\'s day');
    var old = { treasuryGP: 5, partyLevel: 9, turn: 4, builtExtras: [], pendingOrders: [{ completeTurn: 5 }], defenders: {}, warehouse: [] };
    s = sum(e, old);
    t.same([s.orders, s.nextWord, s.level.value], [null, null, 9], 'a Bastion saved in turns has neither (it\'s set aside when the Bastion opens)');
  });

  test('a Bastion saved by the Strip Back Overhaul (version 4) is read like version 2 and 3 (a version missed here would blank the DM doc\'s orders and the word from the Ironbow without any error)', function (t) {
    var e = explorer();
    e.travel.day = 10;
    [2, 3, 4].forEach(function (v) {
      var b = busy();
      b.v = v;
      var s = sum(e, b);
      t.ok(s.orders && s.orders.count > 0, 'version ' + v + ': its orders are shown');
      t.ok(s.nextWord, 'version ' + v + ': it has a next word');
      t.ok(C.ironbowNews(b, 10, 17).length > 0, 'version ' + v + ': "The Ironbow sends word…"');
    });
    var future = busy();
    future.v = 5;
    t.same([sum(e, future).orders, sum(e, future).nextWord, C.ironbowNews(future, 10, 17)], [null, null, []], 'a version this page has never heard of is not guessed at');
    t.equal(sum(e, bastion()).orders.count, 0, 'a new Bastion (version 4)');
  });

  test('the 13 retired facilities: a version 3 Bastion read before it is converted does not forecast the orders the conversion will CANCEL, but still forecasts the ones it only MOVES; a converted (version 4) one is never filtered', function (t) {
    t.same(C.RETIRED_FACILITIES, {
      barracks: 'cancel', armoury: 'cancel', watchtower: 'cancel', war_room: 'cancel', menagerie: 'cancel',
      library_scriptorium: 'move', arcane_laboratory: 'move',
      shrine_telluria: 'move', shrine_aurush: 'move', shrine_pelagos: 'move',
      wyvern_roost: 'move', griffin_tower: 'move', dire_wolf_den: 'move'
    });
    Object.keys(C.RETIRED_FACILITIES).forEach(function (id) { t.ok(!!T.bastion.stripBack.facilities[id], id + ' is in the Bastion\'s own list too'); });
    t.equal(Object.keys(C.RETIRED_FACILITIES).length, 13);
    var e = explorer();
    e.travel.day = 10;
    function order(id, facId, fnId, label, dueDay, extra) {
      return Object.assign({ id: id, facId: facId, fnId: fnId, label: label, issuedDay: 9, dueDay: dueDay }, extra || {});
    }
    function withOrders(v) {
      var b = bastion();
      b.v = v;
      b.day = 10;
      b.anchored = true;
      b.pendingOrders = [
        /* Cancelled by the conversion. */
        order('a', 'barracks', 'recruit_defenders', 'Barracks: Recruit Defenders', 14),
        order('m', 'menagerie', 'recruit_beast', 'Menagerie: Recruit Beast (Tiger)', 15),
        order('u', 'library_scriptorium', 'upgrade', 'Library & Scriptorium: Upgrade to Level 3', 20, { meta: { kind: 'upgrade', toLevel: 3 } }),
        order('h', 'shrine_pelagos', 'pray', 'Shrine of Pelagos: Pray (Pelagos\'s Tidings)', 11, { chosen: { label: 'Pelagos\'s Tidings', special: { type: 'oracle_hint', god: 'pelagos' } } }),
        order('c', 'shrine_aurush', 'prepare_purification_incense', 'Shrine of Aurush: Prepare Purification Incense', 12),
        order('t', 'dire_wolf_den', 'dwf_riding_harness', 'Dire Wolf Den: Riding Harness (Ashfang)', 17),
        /* Only moved by the conversion: still forecast. */
        order('r', 'library_scriptorium', 'research', 'Library & Scriptorium: Research (Geographical Scriptures)', 18),
        order('l', 'arcane_laboratory', 'alchemy', 'Arcane Laboratory: Alchemy (Antitoxin)', 19),
        order('f', 'shrine_telluria', 'pray', 'Shrine of Telluria: Pray (Telluria\'s Blessing)', 12, { chosen: { label: 'Telluria\'s Blessing', special: { type: 'favour_blessing', god: 'telluria' } } }),
        order('b', 'shrine_pelagos', 'bless_voyage', 'Shrine of Pelagos: Bless Voyage', 13),
        order('w2', 'wyvern_roost', 'house_wyvern', 'Wyvern Roost: House a Wyvern (Skyrender)', 14),
        /* Never retired. */
        order('d', 'dock', 'charter_berth', 'Dock: Charter Berth (Longship)', 16),
        order('w', 'workshop', 'craft', 'Workshop: Craft (Dagger)', 13)
      ];
      return b;
    }
    var cancelled = ['a', 'm', 'u', 'h', 'c', 't'];
    var kept = ['r', 'l', 'f', 'b', 'w2', 'd', 'w'];
    cancelled.forEach(function (id) { t.equal(C.cancelledByConversion(withOrders(3).pendingOrders.filter(function (o) { return o.id === id; })[0]), true, id + ' is cancelled'); });
    kept.forEach(function (id) { t.equal(C.cancelledByConversion(withOrders(3).pendingOrders.filter(function (o) { return o.id === id; })[0]), false, id + ' is kept or moved'); });
    var old = withOrders(3);
    var s3 = sum(e, old);
    t.equal(s3.orders.count, kept.length, 'only what will survive');
    t.equal(s3.orders.next.label, 'Shrine of Telluria: Pray (Telluria\'s Blessing)', 'the Favour prayer moves to the Temple, so it is still due on Day 12');
    var news = JSON.stringify([s3, C.ironbowNews(old, 10, 30)]);
    ['Barracks', 'Menagerie', 'Pelagos\'s Tidings', 'Purification', 'Riding Harness', 'Upgrade to Level 3'].forEach(function (name) { t.ok(news.indexOf(name) === -1, name + ' is never named'); });
    ['Research (Geographical Scriptures)', 'Alchemy (Antitoxin)', 'Bless Voyage', 'House a Wyvern', 'Charter Berth', 'Craft (Dagger)', 'Pray (Telluria'].forEach(function (name) { t.ok(news.indexOf(name) !== -1, name + ' is still forecast'); });
    t.equal(sum(e, withOrders(2)).orders.count, kept.length, 'a version 2 Bastion is also converted when it opens, so it is read the same way');
    var converted = withOrders(4);
    t.equal(sum(e, converted).orders.count, 13, 'version 4: nothing is left out');
    t.ok(/Barracks: Recruit Defenders is complete/.test(JSON.stringify(C.ironbowNews(converted, 10, 20))), 'its Barracks order is still forecast');
    var before = JSON.stringify(old);
    C.ironbowNews(old, 10, 20);
    t.equal(JSON.stringify(old), before, 'the save is only read');
    t.equal(C.cancelledByConversion(null), false);
    t.equal(C.cancelledByConversion({ facId: 'toString', fnId: 'x' }), false, 'a name that is not a facility');
    t.equal(C.cancelledByConversion(order('x', 'war_room', 'recruit', 'War Room: Recruit (Archers (50))', 14)), true, 'every War Room order ends');
    t.equal(C.cancelledByConversion(order('x', 'wyvern_roost', 'house_elara_wyvern', 'Wyvern Roost: House Elara\'s Wyvern', 14)), false);
  });

  test('the three beast buildings are ONE Beast Pen to a version 3 Bastion read before it is converted: one construction (the one ready first), no repair of a building that is going, none at all of a version 4', function (t) {
    function save(v, extra) {
      var b = bastion();
      b.v = v;
      b.day = 10;
      b.anchored = true;
      Object.keys(extra).forEach(function (k) { b[k] = extra[k]; });
      return b;
    }
    function lines(b) { return C.bastionComing(b).map(function (x) { return x.day + ' ' + x.line; }); }
    function building(id, ready) { return { facId: id, status: 'building', startDay: 1, readyDay: ready }; }
    var three = save(3, { builtExtras: [building('wyvern_roost', 26), building('griffin_tower', 22), building('dire_wolf_den', 30)] });
    t.same(lines(three), ['22 The Beast Pen is built.'], 'one Pen, on the day of the one ready first');
    t.equal(JSON.stringify(C.bastionComing(three)).match(/is built/g).length, 1);
    t.same(lines(save(2, { builtExtras: [building('wyvern_roost', 26), building('dire_wolf_den', 30)] })), ['26 The Beast Pen is built.'], 'a version 2 Bastion is converted too');
    t.same(lines(save(3, { builtExtras: ['wyvern_roost', building('griffin_tower', 22)] })), [], 'one of them already built: that one is the Pen, the others\' construction ends');
    t.same(lines(save(3, { builtExtras: [{ facId: 'dire_wolf_den', status: 'built' }, building('griffin_tower', 22)] })), []);
    t.same(lines(save(3, { builtExtras: [building('griffin_tower', 22), { facId: 'beast_pen', status: 'building', startDay: 2, readyDay: 40 }] })), ['40 The Beast Pen is built.'], 'a Pen already in a slot is the Pen');
    t.same(lines(save(3, { builtExtras: ['', building('wyvern_roost', 26)], builtPlots: [building('griffin_tower', 19)] })), ['19 The Beast Pen is built.'], 'slots and plots alike');
    t.same(lines(save(3, { builtExtras: [building('wyvern_roost', 'soon')] })), [], 'a damaged day is never guessed');
    t.same(lines(save(3, { builtExtras: [building('herbal_gardens', 15), building('wyvern_roost', 26)] })), ['15 The Herbal Gardens is built.', '26 The Beast Pen is built.'], 'other buildings are named as before');
    /* Repairs of the buildings that are going are not forecast; repairs of anything else are, and orders are not held back by them. */
    var repairs = save(3, { repairs: { griffin_tower: 18, wyvern_roost: 12, workshop: 14 }, pendingOrders: [{ id: 'h', facId: 'griffin_tower', fnId: 'house_griffin', label: 'Griffin Tower: House a Griffin (Swiftwing)', issuedDay: 9, dueDay: 15 }] });
    t.same(lines(repairs), ['15 Griffin Tower: House a Griffin (Swiftwing) is complete.', '15 Repairs: the Workshop is working again.'], 'the order is due on its own day (the Tower\'s repair goes with the Tower); the Workshop\'s repair is still forecast');
    /* A converted Bastion (version 4) is never filtered: it says what it holds, by its own names. */
    var v4 = save(4, { repairs: { griffin_tower: 18 }, builtExtras: [building('beast_pen', 31), building('griffin_tower', 22)] });
    t.same(lines(v4), ['19 Repairs: the Griffin Tower is working again.', '22 The Griffin Tower is built.', '31 The Beast Pen is built.']);
    var before = JSON.stringify(three);
    C.bastionComing(three);
    t.equal(JSON.stringify(three), before, 'the save is only read');
  });

  test('"The Ironbow sends word…": an upgrade (step 1b) is complete on its day, the Hall\'s too (no roll)', function (t) {
    var b = bastion();
    b.day = 10;
    b.anchored = true;
    b.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }];
    b.pendingOrders = [
      { id: 'u', facId: 'hall_of_emissaries', fnId: 'upgrade', label: 'Hall of Emissaries: Upgrade to Level 2', costGP: 0, issuedDay: 10, dueDay: 17, meta: { kind: 'upgrade', toLevel: 2 } },
      { id: 'v', facId: 'barracks', fnId: 'upgrade', label: 'Barracks: Upgrade to Level 3', costGP: 0, issuedDay: 10, dueDay: 24, meta: { kind: 'upgrade', toLevel: 3 } }
    ];
    t.same(C.ironbowNews(b, 10, 24).filter(function (w) { return w.day === 17 || w.day === 24; }), [
      { day: 17, lines: ['Hall of Emissaries: Upgrade to Level 2 is complete.'] },
      { day: 24, lines: ['Barracks: Upgrade to Level 3 is complete.'] }
    ]);
  });

  test('"The Ironbow sends word…": what the Bastion has coming, day by day, read from its save', function (t) {
    var b = busy();
    var before = JSON.stringify(b);
    t.same(C.ironbowNews(b, 10, 17), [
      { day: 11, lines: ['The Ape is fit to fight again.'] },
      { day: 12, lines: ['The sea route to Karr needs a roll.'] },
      { day: 13, lines: ['Your army is ready to march on Bacca (Raid).', 'Clan Bacca may attack: the Bastion rolls to see.'] },
      { day: 14, lines: ['Barracks: Recruit Defenders is complete.'] },
      { day: 17, lines: ['Hall of Emissaries: Secure Trade Agreement (Clan Karr) needs your roll.', 'Dock: Charter Berth (Longship) is complete.', 'Repairs: the Dock is working again.'] }
    ], 'the Dock\'s order waits for its repairs; the low-risk route pays without a roll');
    t.same(C.ironbowNews(b, 17, 29), [
      { day: 22, lines: ['The Arcane Laboratory is built.'] },
      { day: 23, lines: ['Your delegation from Clan Slade has ended.'] },
      { day: 26, lines: ['Your Trade Agreement with Clan Karr has ended (its last shipment arrived).'] }
    ]);
    t.same(C.ironbowNews(b, 28, 100), [], 'no Bastion event is due on Day 29, or any day (S05)');
    t.equal(JSON.stringify(C.bastionComing(b)).indexOf('event'), -1, 'the forecast never mentions one');
    t.equal('BASTION_EVENT_EVERY' in C, false);
    t.same(C.ironbowNews(b, 13, 13), []);
    t.equal(JSON.stringify(b), before, 'the save isn\'t changed');
    var ahead = busy();
    ahead.day = 20;
    t.same(C.ironbowNews(ahead, 2, 3), [], 'Reset Travel: the Bastion is ahead, and will move its days rather than pass them');
    var loose = busy();
    loose.anchored = false;
    t.same(C.ironbowNews(loose, 10, 30), [], 'not following the Explorer yet');
    t.same(C.ironbowNews(null, 10, 11), []);
  });

  test('the word the Explorer sends at Make Camp comes on the days the Bastion itself has news', function (t) {
    var b = busy();
    b.wars = {};
    b.tradeNetwork.routes = [];
    b.pendingOrders = b.pendingOrders.filter(function (o) { return o.facId !== 'hall_of_emissaries' && o.facId !== 'war_council'; });
    var predicted = C.ironbowNews(b, 10, 30).map(function (w) { return w.day; });
    for (var d = 11; d <= 30; d++) {
      BR.startDay(b, bdata, 0);
      BR.finishRoutes(b);
      BR.dueOrders(b, b.dayInProgress.skipped).forEach(function (o) {
        BR.completeSimpleOrder(b, bdata, o, dice([0.5])).forEach(function (l) { BR.addWord(b, l[1]); });
        BR.removeOrder(b, o.id);
      });
      BR.finishDay(b);
    }
    t.same(b.word.map(function (w) { return w.day; }), predicted);
    t.same(b.word.filter(function (w) { return w.day === 22; })[0].lines, ['The Arcane Laboratory is built.']);
  });

  test('the party level is the Bastion\'s', function (t) {
    var b = bastion();
    b.partyLevel = 12;
    t.same(sum(explorer(), b).level, { value: 12, fromBastion: true });
  });

  test('each region shows its own Clan, chief and god, with that Clan\'s and god\'s standing', function (t) {
    var b = bastion();
    b.politicalCapital.molten = -35; b.honourRespectByClan.molten = -2; b.favour.aurush = 80;
    b.politicalCapital.karr = 50; b.honourRespectByClan.karr = 4; b.favour.pelagos = 15;
    var south = sum(explorer('southern_province'), b);
    t.same(south.clan, { name: 'Molten', chief: 'Callum Molten', politicalCapital: -35, honourRespect: -2 });
    t.same(south.god, { key: 'aurush', name: 'Aurush', favour: 80 });
    var isle = sum(explorer('the_north_isle'), b);
    t.same(isle.clan, { name: 'Karr', chief: 'Helga Karr', politicalCapital: 50, honourRespect: 4 });
    t.same(isle.god, { key: 'pelagos', name: 'Pelagos', favour: 15 });
    t.same(sum(explorer('midland_province'), b).clan.politicalCapital, 0, 'another Clan\'s standing is its own');
  });

  test('the Explorer saved but not the Bastion: the Clan and god show, their standing doesn\'t', function (t) {
    var s = sum(explorer('the_east_isle'), null);
    t.same(s.clan, { name: 'Rowthorn', chief: 'Doran Rowthorn', politicalCapital: null, honourRespect: null });
    t.same(s.god, { key: 'pelagos', name: 'Pelagos', favour: null });
  });

  test('Orders Pending lists up to five orders, the one completing next first; the count is all of them', function (t) {
    var b = bastion();
    b.day = 5; b.anchored = true;
    [30, 12, 9, 21, 15, 18, 7].forEach(function (d, i) { b.pendingOrders.push({ id: 'o' + i, facId: 'dock', fnId: 'x', label: 'Order ' + d, issuedDay: 1, dueDay: d }); });
    b.pendingOrders.push({ id: 'turns', completeTurn: 3, label: 'No day' });
    var e = explorer();
    e.travel.day = 6;
    var o = sum(e, b).orders;
    t.equal(o.count, 7, 'the order with no day is not counted');
    t.same(o.list.map(function (x) { return x.day; }), [7, 9, 12, 15, 18], 'five, soonest first');
    t.same(o.list[0], { day: 7, label: 'Order 7', inDays: 1 });
    t.same(o.next, o.list[0], 'next is the first on the list');
    b.pendingOrders = [{ id: 'z', facId: 'dock', fnId: 'x', label: '', issuedDay: 1, dueDay: 8 }];
    t.same(sum(e, b).orders.list, [{ day: 8, label: 'An order', inDays: 2 }], 'an order with no name still shows');
  });

  test('each hero\'s effects are listed with that hero (by id); the party\'s own, and any that fit nobody, are the party\'s', function (t) {
    var s = explorer();
    s.travel.day = 3;
    s.journey.effects.push({ id: 'e1', name: 'Wolf-Friend', text: 'Advantage on Perception.', who: null, whoName: 'The party', from: 'C6', day: 1, until: 'days', untilDay: 8 });
    s.journey.effects.push({ id: 'e2', name: 'Warm', text: '', who: 'elara', whoName: 'Elara', from: 'T12', day: 1, until: 'camp', untilDay: 4 });
    s.journey.effects.push({ id: 'e3', name: 'Frostbitten', text: 'Slower.', who: 'umbrys', whoName: 'Umbrys', from: 'T3', day: 2, until: 'dm', untilDay: null });
    s.journey.effects.push({ id: 'e4', name: 'Frostbitten', text: 'Slower.', who: 'magnus', whoName: 'Magnus', from: 'T3', day: 2, until: 'dm', untilDay: null });
    s.journey.effects.push({ id: 'e5', name: 'Cursed Boots', text: '', who: 'gone_hero', whoName: 'Old Bob', from: 'X1', day: 1, until: 'used', untilDay: null });
    s.journey.effects.push({ id: 'e6', name: 'Second Wind', text: '', who: 'elara', whoName: 'Elara', from: 'X2', day: 1, until: 'used', untilDay: null });
    var r = sum(s, null);
    var byHero = {};
    r.heroes.forEach(function (h) { byHero[h.id] = h.effects.map(function (x) { return x.name; }); });
    t.same(byHero, { kaelen: [], umbrys: ['Frostbitten'], magnus: ['Frostbitten'], elara: ['Warm', 'Second Wind'], charles: [] }, 'the same effect on two heroes shows under each');
    t.same(r.partyEffects.map(function (x) { return [x.name, x.who]; }), [['Wolf-Friend', 'The party'], ['Cursed Boots', 'Old Bob']], 'the party\'s own, and an orphan with the name it was saved under');
    t.equal(r.effects.length, 6, 'effects still lists them all');
    t.same(r.heroes[3].effects[0], { id: 'e2', name: 'Warm', who: 'Elara', text: '', until: 'until Make Camp', from: 'T12' }, 'the same line as the full list');
    var renamed = JSON.parse(JSON.stringify(s));
    renamed.tokens[3].name = 'Elara Vane';
    t.same(sum(renamed, null).heroes[3].effects.map(function (x) { return x.name; }), ['Warm', 'Second Wind'], 'a renamed hero keeps their effects');
    var noTokens = JSON.parse(JSON.stringify(s));
    noTokens.tokens = [];
    var nt = sum(noTokens, null);
    t.same([nt.heroes.length, nt.partyEffects.length], [0, 6], 'with no heroes read, every effect is still shown');
  });

  test('the Great Rite the party holds shows as one line, ready or used', function (t) {
    var s = explorer();
    t.equal(sum(s, null).rite, null);
    s.journey.blessing = { id: 'rite-ab12cd34', rite: 'earths_endurance', expedition: 1, used: false };
    t.same(sum(s, null).rite, { name: 'Earth\'s Endurance', used: false });
    s.journey.blessing.used = true;
    t.same(sum(s, null).rite, { name: 'Earth\'s Endurance', used: true });
    s.journey.blessing.rite = 'unknown_rite';
    t.same(sum(s, null).rite, { name: 'A Great Rite', used: true }, 'a rite this copy doesn\'t know still shows');
    s.journey.blessing = { id: 'x' };
    t.equal(sum(s, null).rite, null, 'a damaged one is not shown');
    t.equal(sum(s, null).effects.length, 0, 'it is never one of the Active Effects');
  });

  test('the expedition: none yet, under way with its days running, ended with the days it ran', function (t) {
    var J = TSI.explorer.journey;
    var s = explorer();
    s.travel.day = 4;
    t.same(sum(s, null).expedition, { n: 0, state: 'none', startedDay: null, endedDay: null, daysRunning: null });
    J.startExpedition(s);
    t.same(sum(s, null).expedition, { n: 1, state: 'active', startedDay: 4, endedDay: null, daysRunning: 0 }, 'began today');
    s.travel.day = 7;
    t.same(sum(s, null).expedition, { n: 1, state: 'active', startedDay: 4, endedDay: null, daysRunning: 3 }, 'began Day 4, now Day 7: running 3 days');
    s.travel.day = 2;
    t.equal(sum(s, null).expedition.daysRunning, 0, 'Reset Travel can put today before the start; never below 0');
    s.travel.day = 9;
    J.endExpedition(s);
    t.same(sum(s, null).expedition, { n: 1, state: 'ended', startedDay: 4, endedDay: 9, daysRunning: null }, 'ended: Day 4 to Day 9');
    s.travel.day = 30;
    t.same([sum(s, null).expedition.startedDay, sum(s, null).expedition.endedDay], [4, 9], 'it stays until the next one starts, whatever the day');
    J.startExpedition(s);
    t.same(sum(s, null).expedition, { n: 2, state: 'active', startedDay: 30, endedDay: null, daysRunning: 0 }, 'the next one replaces it');
  });

  test('an expedition that ended in an older save: its end day comes from the log, or is left unknown', function (t) {
    var J = TSI.explorer.journey;
    var s = explorer();
    s.travel.day = 4;
    J.startExpedition(s);
    s.travel.day = 9;
    J.endExpedition(s);
    delete s.journey.expedition.endedDay;                 /* as an older save has it: no v 2, no end day */
    delete s.journey.expedition.v;
    t.same(sum(s, null).expedition, { n: 1, state: 'ended', startedDay: 4, endedDay: 9, daysRunning: null }, 'read from "Expedition 1 ended on Day 9."');
    s.journey.log = [];
    t.same(sum(s, null).expedition, { n: 1, state: 'ended', startedDay: 4, endedDay: null, daysRunning: null }, 'no log line: unknown, never guessed');
    s.journey.expedition = { n: 2, active: true, startedDay: 0 };
    t.same(sum(s, null).expedition, { n: 2, state: 'active', startedDay: null, endedDay: null, daysRunning: null }, 'a start day of 0 in an older record was "not known"');
    s.journey.expedition = { v: 2, n: 2, active: true, startedDay: 0 };
    t.same(sum(s, null).expedition, { n: 2, state: 'active', startedDay: 0, endedDay: null, daysRunning: 9 }, 'but in a v 2 record 0 is a real day (Reset Travel can make it so)');
    s.journey.expedition = 'junk';
    t.equal(sum(s, null).expedition.state, 'none', 'a damaged record is no expedition');
  });

  test('after Reset Travel the expedition line still makes sense: the days moved, 0 and below allowed', function (t) {
    var J = TSI.explorer.journey;
    var s = explorer();
    s.travel.day = 4;
    J.startExpedition(s);
    s.travel.day = 10;
    t.same(sum(s, null).expedition, { n: 1, state: 'active', startedDay: 4, endedDay: null, daysRunning: 6 });
    ER.resetTravel(s);
    t.same(sum(s, null).expedition, { n: 1, state: 'active', startedDay: -5, endedDay: null, daysRunning: 6 }, 'Day 4 is now Day -5, and it has still been running 6 days');
    s.travel.day = 3;
    t.equal(sum(s, null).expedition.daysRunning, 8, 'and it goes on counting');
    var e = explorer();
    e.travel.day = 4;
    J.startExpedition(e);
    e.travel.day = 9;
    J.endExpedition(e);
    e.travel.day = 10;
    ER.resetTravel(e);
    t.same(sum(e, null).expedition, { n: 1, state: 'ended', startedDay: -5, endedDay: 0, daysRunning: null }, 'ended: -5 to 0, both real days');
  });

  test('a damaged save never stops the summary, whatever names it uses: constructor, __proto__, toString', function (t) {
    var bad = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];
    bad.forEach(function (name) {
      var s = explorer();
      s.travel.provinceId = name;
      s.journey.effects.push({ id: 'e1', name: 'Odd', text: '', who: name, whoName: name, from: 'X', day: 1, until: 'dm', untilDay: null });
      s.journey.blessing = { id: 'x', rite: name, expedition: 1, used: false };
      s.journey.expedition = { n: 1, active: true, startedDay: 2, who: name };
      var b = bastion();
      b.diplomaticRecords = { next: 1, list: [{ id: 'd', title: 'Odd', status: 'confirmed', consequences: [{ id: 'c', kind: name, clan: '', text: 'x' }] }] };
      var r;
      try { r = sum(s, b); } catch (err) { t.ok(false, name + ' threw: ' + err.message); return; }
      t.ok(r.effects.length === 1 && r.partyEffects.length === 1, name + ': the effect is shown, with the party\'s (it fits no hero)');
      t.same(r.rite, { name: 'A Great Rite', used: false }, name + ': not one of the rites, so it is just "a Great Rite" (not the function of that name)');
      t.equal(r.region, null, name + ': not a region');
      t.same(r.trackedAnywhere, [], name + ': not an agreement kind');
      t.same(r.heroes.map(function (h) { return h.effects.length; }), [0, 0, 0, 0, 0], name + ': no hero was given it');
    });
    var tok = explorer();
    tok.tokens[0].id = '__proto__';
    tok.journey.effects.push({ id: 'e2', name: 'Fine', text: '', who: '__proto__', whoName: 'Kaelen', from: 'X', day: 1, until: 'dm', untilDay: null });
    t.equal(sum(tok, null).heroes[0].effects.length, 1, 'a hero whose id is a plain name like that still gets their own');
  });

  test('odd values are kept within the Bastion\'s own limits', function (t) {
    var b = bastion();
    b.politicalCapital.blackstone = 400; b.honourRespectByClan.blackstone = -9; b.favour.telluria = 'lots';
    b.partyLevel = 99;
    var s = sum(explorer(), b);
    t.same([s.clan.politicalCapital, s.clan.honourRespect, s.god.favour], [100, -5, 0]);
    t.equal(s.level.value, 20);
    var e = explorer();
    e.travel.provinceId = 'atlantis';
    t.same([sum(e, b).region, sum(e, b).clan], [null, null], 'an unknown region shows nothing rather than the wrong Clan');
  });

  test('Active Effects show exactly as the Explorer\'s list shows them, and go when the Explorer removes them', function (t) {
    var s = explorer();
    s.journey.effects.push({ id: 'a', name: 'Wolf-Friend', text: 'Advantage on Perception.', who: null, whoName: 'The party', from: 'C6', day: 1, until: 'days', untilDay: 8 });
    s.journey.effects.push({ id: 'b', name: 'Warm', text: '', who: 'elara', whoName: 'Elara', from: 'T12', day: 1, until: 'camp', untilDay: 2 });
    s.journey.effects.push({ id: 'c', name: 'Knot', text: 'Use it once.', who: null, whoName: '', from: 'C7', day: 1, until: 'used', untilDay: null });
    var e = sum(s, null).effects;
    t.same(e.map(function (x) { return [x.name, x.who, x.until, x.from]; }), [
      ['Wolf-Friend', 'The party', 'ends Day 8', 'C6'],
      ['Warm', 'Elara', 'until Make Camp', 'T12'],
      ['Knot', 'The party', 'until used', 'C7']
    ]);
    s.journey.effects.forEach(function (x) { t.equal(C.untilText(x, 1), TSI.explorer.journey.untilText(x, 1), 'the Explorer says the same for ' + x.name); });
    ER.makeCamp(s, ED, EE, dice([0.99]));
    t.same(sum(s, null).effects.map(function (x) { return x.name; }), ['Wolf-Friend', 'Knot'], 'Warm goes at Make Camp, with the Explorer');
    for (var d = 2; d < 8; d++) ER.makeCamp(s, ED, EE, dice([0.99]));
    t.equal(s.travel.day, 8);
    t.same(sum(s, null).effects.map(function (x) { return x.name; }), ['Knot'], 'Wolf-Friend goes on Day 8');
  });

  test('the party\'s gold: the Explorer\'s running total, 0 on a fresh journey, nothing before it has saved', function (t) {
    var s = explorer();
    t.equal(sum(s, null).gold, 0);
    s.journey.gold = -100;
    t.equal(sum(s, null).gold, -100, 'it can go below 0, as the Explorer\'s does');
    TSI.explorer.journey.clearGold(s);
    t.equal(sum(s, null).gold, 0, 'cleared in the Explorer');
    t.equal(sum(null, bastion()).gold, null);
  });

  test('Threads show as the Explorer\'s list shows them, with what resolving each gives', function (t) {
    var J = TSI.explorer.journey;
    var s = explorer();
    s.travel.day = 8;
    s.journey.threads.push({ id: 't1', name: 'What Drove the Wolves Out', note: 'Something bigger.', from: 'C6', day: 1, resolve: null, follow: null, data: {} });
    s.journey.threads.push({ id: 't2', name: 'The Sealed Dispatch', note: 'Deliver it.', from: 'T6', day: 8, resolve: { gold: 250, dm: 'Notice Board: consider +1 clan honour with Clan Blackstone.' }, follow: null, data: {} });
    s.journey.threads.push({ id: 't3', name: 'The Prospector\'s Claim', note: 'A quarter-share.', from: 'T14', day: 8, resolve: null, follow: { event: 'f2', scope: 'any', mapKey: '', from: 15, to: 15 }, data: {} });
    s.journey.threads.push({ id: 't4', name: 'The Captain\'s Thanks', note: 'She may come.', from: 'C12', day: 9, resolve: { gold: 0, dm: '' }, follow: { event: 'f3', scope: 'isles', mapKey: '', from: 11, to: 14 }, data: {} });
    var th = sum(s, null).threads;
    t.same(th.map(function (x) { return [x.name, x.day, x.from, x.due, x.reward]; }), [
      ['What Drove the Wolves Out', 1, 'C6', '', []],
      ['The Sealed Dispatch', 8, 'T6', '', ['+250 gold', 'DM note: Notice Board: consider +1 clan honour with Clan Blackstone.']],
      ['The Prospector\'s Claim', 8, 'T14', 'Follow-up due Day 15', []],
      ['The Captain\'s Thanks', 9, 'C12', 'Follow-up due Days 11–14', []]
    ]);
    s.journey.threads.forEach(function (x, i) {
      t.equal(th[i].due, J.threadDueText(x), 'the Explorer says the same for ' + x.name);
      t.same(th[i].reward, J.resolveLines(x).filter(function (l) { return !/follow-up/.test(l); }), 'what resolving gives, as the Explorer\'s "are you sure?" says');
    });
    t.same(sum(s, null).nextFollowUp, { name: 'The Captain\'s Thanks', from: 11, to: 14, text: 'Follow-up due Days 11–14' }, 'the soonest-ending follow-up comes first, as the Explorer brings them');
    J.resolveThread(s, 't2');
    t.same(sum(s, null).threads.map(function (x) { return x.name; }), ['What Drove the Wolves Out', 'The Prospector\'s Claim', 'The Captain\'s Thanks'], 'a resolved thread goes');
    t.equal(sum(s, null).gold, 250, 'and its gold is added');
    J.resolveThread(s, 't4');
    t.equal(sum(s, null).nextFollowUp.name, 'The Prospector\'s Claim', 'then the next one');
    s.journey.threads = [];
    t.same([sum(s, null).threads, sum(s, null).nextFollowUp], [[], null]);
  });

  test('a follow-up that didn\'t come is no longer counted as due', function (t) {
    var s = explorer();
    s.journey.threads.push({ id: 't3', name: 'The Prospector\'s Claim', note: 'A quarter-share.', from: 'T14', day: 1, resolve: null, follow: { event: 'f2', scope: 'any', mapKey: '', from: 2, to: 2 }, data: {} });
    t.equal(sum(s, null).nextFollowUp.text, 'Follow-up due Day 2');
    s.travel.day = 3;
    TSI.explorer.journey.newDay(s);
    var th = sum(s, null).threads;
    t.same([th.length, th[0].due, sum(s, null).nextFollowUp], [1, '', null], 'the thread stays, its follow-up gone, as in the Explorer');
    t.ok(/didn't come/.test(th[0].note), th[0].note);
  });

  test('a damaged Explorer save doesn\'t stop the summary', function (t) {
    var s = sum({ tokens: 'x', travel: null, journey: { gold: 'lots', effects: [null, { text: 'no name' }], threads: [7, { note: 'no name' }, { name: 'Odd', follow: { from: 'x' }, resolve: 'y' }] } }, 'junk');
    t.same([s.heroes, s.day, s.bastionSaved, s.effects, s.partyEffects, s.gold], [[], 1, false, [], [], 0]);
    t.same([s.rite, s.expedition.state], [null, 'none']);
    t.same(s.threads.map(function (x) { return [x.name, x.due, x.reward]; }), [['Odd', '', []]]);
    t.equal(s.nextFollowUp, null);
    t.equal(s.region.id, 'northern_province', 'the Explorer\'s own first region');
  });

  test('the DM doc lists the Hall\'s DM-tracked agreements for the Clan where the party is, with their end day', function (t) {
    var ba = bastion();
    ba.day = 10;
    ba.diplomaticRecords = { next: 3, list: [{
      id: 'd1', title: 'Pact of the Pass', status: 'confirmed', consequences: [
        { id: 'c1', kind: 'restriction', clan: 'blackstone', text: 'No Blackstone iron to the Ironbow', until: 16 },
        { id: 'c2', kind: 'obligation', clan: 'blackstone', text: 'Return the chief\'s banner' },
        { id: 'c3', kind: 'hr', clan: 'blackstone', amount: 1, status: 'applied' },
        { id: 'c4', kind: 'privilege', clan: 'bacca', text: 'Free passage', until: 30 },
        { id: 'c5', kind: 'restriction', clan: 'blackstone', text: 'Old embargo', until: 5 },
        { id: 'c6', kind: 'hook', clan: '', text: 'A rumour with no Clan' },
        { id: 'c7', kind: 'obligation', clan: 'blackstone', text: 'Ended early', status: 'ended' }
      ]
    }, { id: 'd2', title: 'Unconfirmed', status: 'draft', consequences: [{ id: 'c8', kind: 'restriction', clan: 'blackstone', text: 'Not yet', until: 20 }] }] };
    var ex = explorer('northern_province');
    ex.travel.day = 10;
    var s = sum(ex, ba);
    t.same(s.clanTracked.map(function (x) { return [x.kind, x.text, x.when]; }), [
      ['restriction', 'No Blackstone iron to the Ironbow', 'until Day 16 (6 days left)'],
      ['obligation', 'Return the chief\'s banner', 'no end day']
    ], 'only this Clan\'s, confirmed, still running, soonest end first; scores, ended and expired ones left out');
    t.same(s.trackedAnywhere.map(function (x) { return x.text; }), ['A rumour with no Clan'], 'agreements that name no Clan');
    t.same(sum(explorer('midland_province'), ba).clanTracked.map(function (x) { return x.text; }), ['Free passage'], 'another Region shows its own Clan\'s');
    t.same(sum(ex, null).clanTracked, [], 'no Bastion save, nothing to list');
  });
}());
