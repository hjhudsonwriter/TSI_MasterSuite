/* The Ironbow Bastion Manager: tools/bastion/rules.js and its data */
(function () {
  var R = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce };

  /* Dice that come up in the given order (numbers from 0 up to 1). */
  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function fresh() { return R.defaultState(data); }
  function built(s, ids) {
    s.builtExtras = ids.map(function (id) { return id ? { facId: id, status: 'built' } : ''; });
    R.ensureLevels(s, data);
    return s;
  }
  function order(s, facId, fnId, idx, meta) {
    var res = meta ? R.issueOrderWithMeta(s, data, facId, fnId, idx, meta, dice([0.3])) : R.issueOrder(s, data, facId, fnId, idx, dice([0.3]));
    if (!res.ok) throw new Error('order refused: ' + res.message);
    return s.pendingOrders[s.pendingOrders.length - 1];
  }
  function roll(d20, total) { return { d20: d20, total: total }; }
  function titles(s) { return s.log.map(function (l) { return l.title; }); }
  /* A war order as the old single-roll war queued it (R.queueWarAction,
     archived in Build 3: tools/bastion/archive/mercenary-brigade.js), as a
     save can still hold one. */
  function oldWarOrder(s, meta) {
    var days = R.time(data).musterDays;
    s.pendingOrders.push({ id: R.uid(dice([0.3])), facId: 'war_council', fnId: 'war_action', optionIdx: 0, label: 'War Action', issuedDay: s.day, dueDay: s.day + days, meta: Object.assign({}, meta, { kind: 'war_action' }) });
  }

  group('Bastion: content');

  test('22 facilities (the overhaul, 13 October 2026: 6 of them still in development once pull request 3 opened the Fishery and Timber Yard), 12 tool tables (9 can be artisan tools), 11 events, 7 clans, 270 compendium items (271 entries)', function (t) {
    t.equal(data.facilities.length, 22);
    t.same(data.facilities.filter(function (f) { return f.inDevelopment; }).map(function (f) { return f.id; }),
      ['stone_masonworks', 'weavers_hall', 'courier_exchange', 'wyvern_roost', 'griffin_tower', 'dire_wolf_den']);
    t.same(['smithy', 'arcane_study', 'laboratory', 'library', 'garden', 'greenhouse', 'gaming_hall'].filter(function (id) { return R.facility(data, id); }), [], 'the old ones are gone');
    t.equal(Object.keys(data.tools).length, 12);
    t.equal(R.toolTableNames(data.tools).length, 9);
    t.equal(data.events.eventTable.length, 11);
    t.same(T.bastion.clans.map(function (c) { return c.name; }), ['Blackstone', 'Bacca', 'Farmer', 'Slade', 'Molten', 'Rowthorn', 'Karr']);
    /* The old tool's 265, less Regiment (100), plus the six War Room units of the war's phase 2
       (the old Regiment (100) entry is kept in the data, but nothing lists it any more). */
    t.equal(R.compendiumIndex(data.facilities, data.tools).items.length, 270);
    t.equal(Object.keys(T.bastionCompendium.items).length, 271);
    /* The War Room's Recruit list is the war data's, in the same order. */
    var warRoom = R.facility(data, 'war_room').functions[0].options.map(function (o) { return o.label; });
    t.same(warRoom, T.bastionWar.warRoom.map(function (e) { return e.label; }));
  });

  test('every facility has a picture (a painted tile, or a crop of its map picture until Harry paints one), and the map overlays belong to real facilities', function (t) {
    data.facilities.forEach(function (f) {
      t.ok(T.bastion.facilityImages[f.id] || T.bastion.facilityTileCrops[f.id], f.id + ' picture');
    });
    t.equal(T.bastion.facilityImages.courier_exchange, 'courier_exchange.png', 'the Courier Exchange\'s own picture (Harry, 13 October 2026)');
    Object.keys(T.bastion.facilityTileCrops).forEach(function (id) {
      var c = T.bastion.facilityTileCrops[id];
      t.ok(R.facility(data, id), id);
      t.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= T.bastion.map.width && c.y + c.h <= T.bastion.map.height, id + ' crop inside the painting');
    });
    var m = T.bastion.map;
    t.equal(m.base, 'map/bastion_base.jpg');
    t.same([m.width, m.height], [3000, 1250], 'Harry\'s new painting, 12 October 2026');
    m.overlays.forEach(function (o) { t.ok(R.facility(data, o.fac), o.fac); t.ok(/^map\/overlays\/[a-z_]+\.png$/.test(o.pic), o.pic); });
    t.same(m.overlays.map(function (o) { return o.fac; }), ['library_scriptorium', 'arcane_laboratory', 'herbal_gardens', 'war_room', 'hall_of_emissaries', 'shrine_aurush', 'shrine_telluria', 'shrine_pelagos',
      'wyvern_roost', 'griffin_tower', 'dire_wolf_den', 'weavers_hall', 'stone_masonworks', 'fishery_smokehouse', 'timber_sawmill', 'courier_exchange']);
    t.equal(m.overlays.filter(function (o) { return o.fac === 'menagerie'; }).length, 0, 'no map picture for the Menagerie');
    t.ok(T.bastion.mapLabels.courier_exchange, 'the Courier Exchange has a place for its label');
  });

  test('the map overlays: one per built facility with a picture, a shared picture drawn once, darkened while Under Repair', function (t) {
    var s = fresh();
    t.same(R.mapOverlays(s, data), [], 'the starting five are in the base painting');
    s.builtExtras = ['shrine_pelagos', 'herbal_gardens', 'menagerie', 'library_scriptorium'].map(function (id) { return { facId: id, status: 'built' }; });
    s.builtExtras.push({ facId: 'war_room', status: 'building', startDay: 1, readyDay: 36 });
    t.same(R.mapOverlays(s, data).map(function (o) { return [o.pic, o.facs]; }), [
      ['map/overlays/library.png', ['library_scriptorium']],
      ['map/overlays/greenhouse.png', ['herbal_gardens']],
      ['map/overlays/shrine_of_pelagos.png', ['shrine_pelagos']]
    ], 'in the data\'s order; nothing for the Menagerie or a building still being built');
    s.repairs = { herbal_gardens: s.day + 3 };
    t.same(R.mapOverlays(s, data).filter(function (o) { return o.repair; }).map(function (o) { return o.facs; }), [['herbal_gardens']], 'darkened while Under Repair');
    /* No two facilities share a picture since the overhaul; the rule still draws a shared one once. */
    var two = { bastion: Object.assign({}, T.bastion, { map: { overlays: [{ fac: 'herbal_gardens', pic: 'p.png' }, { fac: 'library_scriptorium', pic: 'p.png' }] } }), facilities: data.facilities };
    var shared = R.mapOverlays(s, two);
    t.equal(shared.length, 1, 'a shared picture, drawn once');
    t.same(shared[0].facs, ['herbal_gardens', 'library_scriptorium']);
    t.equal(shared[0].repair, true, 'darkened while either is Under Repair');
  });

  test('demolishing a facility (Harry, 13 October 2026): slot freed, its orders cancelled with no refund, level and repairs gone; starting facilities refused', function (t) {
    var s = fresh();
    s.partyLevel = 9;
    s.treasuryGP = 100;
    s.builtExtras = [{ facId: 'library_scriptorium', status: 'built' }, { facId: 'herbal_gardens', status: 'building', startDay: 1, readyDay: 22 }, ''];
    s.facilityLevels.library_scriptorium = 1;
    s.repairs = { library_scriptorium: 5 };
    s.pendingOrders = [
      { id: 'a', facId: 'library_scriptorium', fnId: 'research', label: 'Library & Scriptorium: Research (Combat Scriptures)', costGP: 0, issuedDay: 1, dueDay: 6 },
      { id: 'b', facId: 'barracks', fnId: 'recruit_defenders', label: 'Barracks: Recruit Defenders', costGP: 0, issuedDay: 1, dueDay: 6 }
    ];
    s.warehouse = [{ name: 'Religious Scriptures', qty: 1, gp: '', notes: 'Library & Scriptorium' }];
    var r = R.demolishFacility(s, data, 'library_scriptorium');
    t.equal(r.ok, true);
    t.same(r.log, ['Facility Demolished', 'The Library & Scriptorium was demolished; its slot is free. Cancelled: Library & Scriptorium: Research (Combat Scriptures).']);
    t.same(s.builtExtras, ['', { facId: 'herbal_gardens', status: 'building', startDay: 1, readyDay: 22 }, '']);
    t.same(s.pendingOrders.map(function (o) { return o.id; }), ['b'], 'only the Library\'s order goes');
    t.equal(s.treasuryGP, 100, 'no refund (B9)');
    t.equal(s.facilityLevels.library_scriptorium, undefined);
    t.same(s.repairs, {});
    t.equal(s.warehouse.length, 1, 'what it made stays');
    var g = R.demolishFacility(s, data, 'herbal_gardens');
    t.same(g.log, ['Construction Stopped', 'Building work on the Herbal Gardens stopped; its slot is free.']);
    t.same(s.builtExtras, ['', '', '']);
    var b = R.demolishFacility(s, data, 'barracks');
    t.equal(b.ok, false);
    t.ok(/starting facilities/.test(b.message));
    t.equal(R.demolishFacility(s, data, 'library_scriptorium').ok, false, 'not built any more');
  });

  test('the starting Bastion: five facilities, Day 1 (not yet set by the Explorer), level 7, 0 gp, unsworn', function (t) {
    var s = fresh();
    t.same(R.builtFacilityIds(s, data), ['barracks', 'armoury', 'watchtower', 'workshop', 'dock']);
    t.equal(s.v, 3, 'a save in days, with the overhauled facilities (13 October 2026)');
    t.same([s.legacyFacilities, s.archivedFacilities, s.migration], [[], [], null]);
    t.equal(s.day, 1);
    t.equal(s.anchored, false);
    t.equal('turn' in s, false, 'no Bastion turn');
    t.equal(s.partyLevel, 7);
    t.equal(s.treasuryGP, 0);
    t.equal(s.organization.type, 'unsworn');
    t.equal(s.clanHonor, 40);
    t.equal(s.trustedClientsByClan.karr, 50);
    t.equal(s.artisanTools.length, 6);
    t.equal(s.dayInProgress, null);
    t.same(s.word, []);
  });

  group('Bastion: construction');

  test('construction slots by party level: 0 / 2 / 4 / 5 / 6', function (t) {
    t.same([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(R.constructionSlotsForLevel), [0, 0, 2, 2, 4, 4, 5, 5, 6, 6]);
  });

  test('build times by the facility\'s level: 21 / 28 / 35 days (3 / 4 / 5 turns at 7 days a turn)', function (t) {
    t.same([0, 5, 8, 9, 13, 17].map(function (l) { return R.buildDaysForRequiredLevel(l, data); }), [0, 21, 21, 28, 35, 35]);
  });

  test('building: locked by level, no duplicates, then built on its ready day', function (t) {
    var s = fresh();
    s.day = 10;
    s.partyLevel = 9;
    R.slotRows(s, 9);
    t.equal(R.startBuild(s, data, 0, 'menagerie').message, 'Locked. Menagerie requires party level 13.');
    var res = R.startBuild(s, data, 0, 'library_scriptorium');
    t.ok(res.ok);
    t.same(res.log, ['Construction Started', 'Library & Scriptorium is under construction (21 days: ready on Day 31).']);
    t.same(s.builtExtras[0], { facId: 'library_scriptorium', status: 'building', startDay: 10, readyDay: 31 });
    t.equal(R.startBuild(s, data, 1, 'library_scriptorium').message, 'That facility is already built or under construction.');
    t.equal(R.startBuild(s, data, 1, 'wyvern_roost').message, 'The Wyvern Roost is still in development: it can\'t be built yet.');
    t.equal(R.startBuild(s, data, 1, 'smithy').ok, false, 'the Smithy is gone');
    t.equal(R.startBuild(s, data, 1, 'barracks').message, 'That facility is already built or under construction.');
    t.equal(R.buildDaysLeft(s, s.builtExtras[0]), 21);
    s.day = 30;
    t.same(R.completeConstruction(s), [], 'Day 30: not yet');
    t.equal(R.buildDaysLeft(s, s.builtExtras[0]), 1);
    s.day = 31;
    t.same(R.completeConstruction(s), ['library_scriptorium']);
    t.same(s.builtExtras[0], { facId: 'library_scriptorium', status: 'built' });
    t.ok(R.builtFacilityIds(s, data).indexOf('library_scriptorium') !== -1);
  });

  test('lowering the level keeps every building, marking the extra ones over capacity (BAS-04, B8)', function (t) {
    var s = built(fresh(), ['library_scriptorium', 'arcane_laboratory', 'herbal_gardens', 'hall_of_emissaries', 'shrine_aurush']);
    var rows = R.slotRows(s, 13);
    t.equal(rows.over, 0);
    rows = R.slotRows(s, 9);
    t.equal(s.builtExtras.length, 5, 'nothing deleted');
    t.equal(rows.used, 5);
    t.equal(rows.over, 1);
    t.same(rows.rows.map(function (r) { return r.overCapacity; }), [false, false, false, false, true]);
    t.ok(rows.rows.every(function (r) { return !r.canBuild; }), 'no room to build');
    t.ok(R.builtFacilityIds(s, data).indexOf('shrine_aurush') !== -1, 'still built and working');
    rows = R.slotRows(s, 13);
    t.equal(rows.over, 0, 'back up: nothing over');
  });

  test('over capacity counts buildings, not slot positions', function (t) {
    var s = built(fresh(), ['library_scriptorium', '', 'arcane_laboratory', 'herbal_gardens', 'hall_of_emissaries']);
    var rows = R.slotRows(s, 9);
    t.equal(rows.used, 4);
    t.equal(rows.over, 0);
    t.ok(!rows.rows[1].canBuild, 'the empty slot can\'t be built in: all 4 are used');
    s = fresh();
    rows = R.slotRows(s, 5);
    t.equal(rows.rows.length, 2);
    t.ok(rows.rows.every(function (r) { return r.canBuild; }));
  });

  test('empty slots past the limit are dropped; built ones stay', function (t) {
    var s = built(fresh(), ['library_scriptorium', '', '', '', '']);
    R.slotRows(s, 5);
    t.equal(s.builtExtras.length, 2);
    t.same(s.builtExtras[0], { facId: 'library_scriptorium', status: 'built' });
  });

  group('Bastion: orders');

  test('an order charges its gold once and is due its days later (Dock: 7 days)', function (t) {
    var s = fresh();
    s.day = 4;
    s.treasuryGP = 500;
    var o = order(s, 'dock', 'charter_berth', 1);
    t.equal(s.treasuryGP, 300, 'Longship 200gp');
    t.equal(o.label, 'Dock: Charter Berth (Longship)');
    t.same([o.issuedDay, o.dueDay], [4, 11]);
    t.equal(s.pendingOrders.length, 1);
    var again = R.issueOrder(s, data, 'dock', 'charter_berth', 0, dice([0.3]));
    t.equal(again.message, 'That order is already pending.');
    t.equal(s.treasuryGP, 300);
  });

  test('not enough gold: refused, nothing changes', function (t) {
    var s = fresh();
    s.treasuryGP = 50;
    var res = R.issueOrder(s, data, 'dock', 'charter_berth', 0, dice([0.3]));
    t.equal(res.message, 'Not enough gp. Need 100gp, you have 50gp.');
    t.equal(s.pendingOrders.length, 0);
  });

  test('Arm Defenders costs 100 + 100 per defender', function (t) {
    var s = fresh();
    s.defenders.count = 3;
    var fac = R.facility(data, 'armoury');
    t.same(R.computeFnCost(s, fac, fac.functions[0], null), { costGP: 400, costText: '400gp (100 + defenders×100)' });
  });

  test('cancelling keeps the gold spent (B9, kept)', function (t) {
    var s = fresh();
    s.treasuryGP = 500;
    var o = order(s, 'dock', 'charter_berth', 0);
    t.same(R.cancelOrder(s, o.id), ['Orders', 'Cancelled an order.']);
    t.equal(s.pendingOrders.length, 0);
    t.equal(s.treasuryGP, 400);
  });

  test('Workshop Craft lists what the artisan tools make, sorted, and crafts the choice', function (t) {
    var s = fresh();
    s.artisanTools = ['Smith’s Tools', '', '', '', '', ''];
    var items = R.craftItems(s, data.tools);
    t.ok(items.length > 0);
    t.same(items, items.slice().sort(function (a, b) { return a.localeCompare(b); }));
    var o = order(s, 'workshop', 'craft', 0);
    t.equal(o.optionLabel, items[0]);
    var lines = R.completeSimpleOrder(s, data, o, dice([0.3]));
    t.same(lines, [['Order Completed', o.label + ' → Crafted: ' + items[0] + '.']]);
    t.equal(s.warehouse[0].item, items[0]);
    t.equal(s.warehouse[0].notes, 'Workshop');
  });

  test('an active summit cuts the price of Hall actions', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.treasuryGP = 1000;
    s.diplomacy.summits.push({ title: 'Inter-Clan Summit', startDay: 1, endDay: 15, costReductionPct: 25 });
    order(s, 'hall_of_emissaries', 'secure_trade_agreement', 0, { targetClan: '' });
    t.equal(s.treasuryGP, 1000 - 187);
  });

  test('orders complete on their day or any later one (BAS-13)', function (t) {
    var s = fresh();
    s.pendingOrders = [{ id: 'a', dueDay: 2 }, { id: 'b', dueDay: 4 }, { id: 'c', dueDay: 3 }];
    s.day = 3;
    t.same(R.dueOrders(s).map(function (o) { return o.id; }), ['a', 'c']);
    t.same(R.dueOrders(s, ['a']).map(function (o) { return o.id; }), ['c'], 'skipped today');
  });

  test('every order has its days: the five starting facilities, the Hall, the network and the war', function (t) {
    var days = function (facId, fnId) { return R.fn(R.facility(data, facId), fnId).days; };
    t.same([days('workshop', 'craft'), days('workshop', 'craft_magic_item'), days('barracks', 'recruit_defenders'), days('watchtower', 'patrol'), days('dock', 'charter_berth'), days('armoury', 'arm_defenders')], [3, 10, 5, 1, 7, 3]);
    t.same(['upgrade_hall', 'secure_trade_agreement', 'host_delegation', 'inter_clan_summit', 'arbitration_authority', 'trade_consortium'].map(function (f) { return days('hall_of_emissaries', f); }), [14, 7, 5, 14, 10, 14]);
    data.facilities.forEach(function (f) { f.functions.forEach(function (fn) { t.ok(fn.days >= 1, f.id + ' ' + fn.id + ' has days'); }); });
    t.same(['stability', 'yield', 'toggle_high_risk'].map(function (k) { return T.bastion.networkUpgrades[k].days; }), [7, 7, 1]);
    t.equal(R.time(data).musterDays, 3);
    var s = fresh();
    s.day = 9;
    s.treasuryGP = 500;
    s.tradeNetwork.active = true;
    R.issueNetworkUpgrade(s, data, 'toggle_high_risk', dice([0.3]));
    t.equal(s.pendingOrders[0].dueDay, 10);
  });

  group('Bastion: completing orders');

  test('Barracks: 1d4 defenders; Watchtower: patrol; Armoury: armed', function (t) {
    var s = fresh();
    var o = { facId: 'barracks', fnId: 'recruit_defenders', label: 'Barracks: Recruit Defenders' };
    t.same(R.completeSimpleOrder(s, data, o, dice([0.99])), [['Order Completed', 'Barracks: Recruit Defenders → Recruited 4 defenders.']]);
    t.equal(s.defenders.count, 4);
    s.day = 12;
    t.same(R.completeSimpleOrder(s, data, { facId: 'watchtower', fnId: 'patrol', label: 'x' }, dice([0.1])), [['Order Completed', 'x → Patrol active until Day 19.']]);
    t.ok(R.patrolActive(s));
    s.day = 19;
    t.ok(R.patrolActive(s), 'the 7th day after');
    s.day = 20;
    t.equal(R.patrolActive(s), false, 'over');
    R.completeSimpleOrder(s, data, { facId: 'armoury', fnId: 'arm_defenders', label: 'x' }, dice([0.1]));
    t.ok(s.defenders.armed);
  });

  test('War Room and Menagerie recruits go to Military and the beasts list, counted by name', function (t) {
    var s = fresh();
    R.completeSimpleOrder(s, data, { facId: 'war_room', fnId: 'recruit', optionLabel: 'Lieutenant (1)', label: 'x' }, dice([0.1]));
    R.completeSimpleOrder(s, data, { facId: 'war_room', fnId: 'recruit', optionLabel: 'Lieutenant (1)', label: 'x' }, dice([0.1]));
    t.same(s.military, [{ name: 'Lieutenant (1)', qty: 2, source: 'War Room' }]);
    t.equal(R.metaLine(s.military[0]), 'x2 • War Room');
    R.completeSimpleOrder(s, data, { facId: 'menagerie', fnId: 'recruit_beast', optionLabel: 'Ape', label: 'x' }, dice([0.1]));
    t.same(s.defenderBeasts, [{ name: 'Ape', qty: 1, source: 'Menagerie' }]);
  });

  test('shrine prayers: 1d20% favour, a 1d10 hint on 4–7, a 1d6 rest on 5–6', function (t) {
    var s = fresh();
    var pray = R.fn(R.facility(data, 'shrine_telluria'), 'pray');
    var lines = R.completeSimpleOrder(s, data, { facId: 'shrine_telluria', fnId: 'pray', chosen: pray.options[2], label: 'L' }, dice([0.5]));
    t.equal(s.favour.telluria, 11);
    t.same(lines, [['Order Completed', 'L → Rolled 1d20 = 11. Added +11% to TELLURIA favour.']]);
    t.same(R.completeSimpleOrder(s, data, { facId: 'shrine_telluria', fnId: 'pray', chosen: pray.options[0], label: 'L' }, dice([0.4])),
      [['Order Completed', 'L → Rolled 1d10 = 5. A hint is granted (DM decides the hint).']]);
    t.same(R.completeSimpleOrder(s, data, { facId: 'shrine_telluria', fnId: 'pray', chosen: pray.options[1], label: 'L' }, dice([0.1])),
      [['Order Completed', 'L → Rolled 1d6 = 1. No rest granted.']]);
    s.favour.telluria = 95;
    R.completeSimpleOrder(s, data, { facId: 'shrine_telluria', fnId: 'pray', chosen: pray.options[2], label: 'L' }, dice([0.99]));
    t.equal(s.favour.telluria, 100, 'favour stops at 100%');
  });

  test('other orders land in the warehouse; the same item adds to its count', function (t) {
    var s = fresh();
    R.completeSimpleOrder(s, data, { facId: 'herbal_gardens', fnId: 'harvest', optionLabel: 'Potion of Healing', label: 'G' }, dice([0.1]));
    R.completeSimpleOrder(s, data, { facId: 'herbal_gardens', fnId: 'harvest', optionLabel: 'potion of healing', label: 'G' }, dice([0.1]));
    t.equal(s.warehouse.length, 1);
    t.equal(s.warehouse[0].qty, 2);
    t.equal(s.warehouse[0].notes, 'Herbal Gardens');
    R.completeSimpleOrder(s, data, { facId: 'dock', fnId: 'charter_berth', optionLabel: 'Keelboat', label: 'D' }, dice([0.1]));
    t.equal(s.warehouse[1].item, 'Keelboat');
    t.equal(s.warehouse[1].notes, 'Dock');
  });

  test('Library research notes still don\'t attach (B16, kept)', function (t) {
    var s = fresh();
    s.treasuryGP = 100;
    var o = order(s, 'library_scriptorium', 'research', 0);
    t.equal(o.optionLabel, 'Geographical Scriptures');
    t.equal(o.notes, '');
    R.completeSimpleOrder(s, data, o, dice([0.1]));
    t.equal(s.warehouse[0].notes, 'Library & Scriptorium');
  });

  test('the Hall\'s old Upgrade Hall: can\'t be ordered since step 1b, but one already ordered completes, up to Level 5 (the bonus stays +6: D7)', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.treasuryGP = 100;
    t.same(R.issueOrder(s, data, 'hall_of_emissaries', 'upgrade_hall', 0, dice([0.3])), { ok: false, message: 'That order has been replaced by Upgrade.' });
    var fn = R.fn(R.facility(data, 'hall_of_emissaries'), 'upgrade_hall');
    t.same(R.upgradeHall(s, fn), ['Upgrade', 'Hall of Emissaries upgraded to Level 2.']);
    t.same(R.upgradeHall(s, fn), ['Upgrade', 'Hall of Emissaries upgraded to Level 3.']);
    t.equal(R.diplomacyModForHall(s), 6);
    t.same(R.upgradeHall(s, fn), ['Upgrade', 'Hall of Emissaries upgraded to Level 4.']);
    t.equal(R.diplomacyModForHall(s), 6, 'still +6 at Level 4 (D7)');
    t.same(R.upgradeHall(s, fn), ['Upgrade', 'Hall of Emissaries upgraded to Level 5.']);
    t.equal(R.diplomacyModForHall(s), 6, 'and at Level 5');
    t.same(R.upgradeHall(s, fn), ['Upgrade', 'Hall of Emissaries is already max level.']);
    t.equal(s.treasuryGP, 100);
  });

  test('warehouse rows: typed values tidied as before', function (t) {
    t.same(R.readWarehouseRow({ item: '  ', qty: 'x', gp: ' 5 ', notes: ' a ' }), { item: 'New Item', qty: 0, gp: '5', notes: 'a' });
    var s = fresh();
    R.ensureWarehouseRow(s, dice([0.3]));
    t.equal(s.warehouse[0].item, 'New Item');
    R.appendToWarehouse(s, 'Rope', 1, '', 'Dock', dice([0.3]));
    R.appendToWarehouse(s, 'rope', 2, '', 'Smithy', dice([0.3]));
    t.equal(s.warehouse[1].qty, 3);
    t.equal(s.warehouse[1].notes, 'Dock | Smithy');
  });

  group('Bastion: the Hall of Emissaries');

  test('tiers from a d20: natural 20 and 1, then by the total against the DC', function (t) {
    t.equal(R.tierFromRoll(20, 5, 14), 'critical_success');
    t.equal(R.tierFromRoll(1, 30, 14), 'critical_failure');
    t.equal(R.tierFromRoll(10, 19, 14), 'great_success');
    t.equal(R.tierFromRoll(10, 14, 14), 'success');
    t.equal(R.tierFromRoll(10, 13, 14), 'failure');
    t.equal(R.tierFromRoll(10, 9, 14), 'bad_failure');
    t.equal(R.formatTier('critical_failure'), 'Bad Failure');
  });

  test('planning: one roll for most actions, three for a delegation (B2); cooldowns block', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.treasuryGP = 5000;
    var ta = order(s, 'hall_of_emissaries', 'secure_trade_agreement', 1, { targetClan: 'Clan Rowthorn' });
    var p = R.emissaryPlan(s, data, ta);
    t.equal(p.rolls.length, 1);
    t.equal(p.dc, 14);
    t.equal(p.mod, 2);
    t.equal(p.opt, 'Clan Rowthorn');
    var hd = order(s, 'hall_of_emissaries', 'host_delegation', 0, { tone: 'conciliatory', targetClan: 'Clan Blackstone' });
    p = R.emissaryPlan(s, data, hd);
    t.same(p.rolls.map(function (r) { return [r.title, r.mod, r.dc]; }), [
      ['Host Delegation (Clan Blackstone)', 2, 13], ['Diplomacy Roll (conciliatory)', 4, 13], ['Insight Roll (conciliatory)', 2, 12]
    ]);
    R.setCooldown(s, 'host_delegation', 14);
    t.equal(R.emissaryPlan(s, data, hd).blocked, 14);
    s.day += 10;
    t.equal(R.emissaryPlan(s, data, hd).blocked, 4, 'days left');
  });

  test('a Trade Agreement: income per shipment, the weeks chosen and Political Capital by tier', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.day = 5;
    s.treasuryGP = 5000;
    var o = order(s, 'hall_of_emissaries', 'secure_trade_agreement', 0, { targetClan: 'Clan Blackstone', weeks: 6 });
    t.equal(o.dueDay, 12, '7 days to negotiate');
    s.day = 12;
    var p = R.emissaryPlan(s, data, o);
    var res = R.applyEmissary(s, data, o, p, { main: roll(12, 14) }, dice([0.5, 0, 0]));
    t.equal(res.tier, 'success');
    t.same(s.diplomacy.agreements.map(function (a) { return [a.title, a.clan, a.startDay, a.endDay, a.income, a.lastShipmentDay]; }), [['Trade Agreement', 'Clan Blackstone', 12, 54, 100, 12]]);
    t.equal(R.shipmentsLeft(s.diplomacy.agreements[0], 7), 6, 'six weeks, six shipments');
    t.equal(R.daysLeft(s, s.diplomacy.agreements[0]), 42);
    t.equal(s.politicalCapital.blackstone, 8);
    t.equal(s.warehouse[0].item, 'Trade Agreement Contract');
    t.equal(res.summary, 'Terms are acceptable. The contract is sealed.');
    t.same(res.changes, ['Political Capital: +8 (Clan Blackstone)', 'New record: Trade Agreement (42 days, 6 shipments, until Day 54)', 'Income: +100 gp a shipment, every 7 days']);
    t.equal(res.log[0], 'Order Resolved');
  });

  test('a Trade Agreement\'s weeks: 1, 3 or 6 as chosen (3 if not), the tier adds or takes a week or two, never under a week', function (t) {
    function weeksFor(weeks, d20, total) {
      var s = built(fresh(), ['hall_of_emissaries']);
      s.treasuryGP = 5000;
      var o = order(s, 'hall_of_emissaries', 'secure_trade_agreement', 0, { targetClan: 'Clan Karr', weeks: weeks });
      R.applyEmissary(s, data, o, R.emissaryPlan(s, data, o), { main: roll(d20, total) }, dice([0.5]));
      var a = s.diplomacy.agreements[0];
      return a ? (a.endDay - a.startDay) / 7 : 0;
    }
    t.same([weeksFor(1, 12, 14), weeksFor(3, 12, 14), weeksFor(6, 12, 14), weeksFor(undefined, 12, 14), weeksFor(4, 12, 14)], [1, 3, 6, 3, 3]);
    t.same([weeksFor(3, 20, 22), weeksFor(3, 15, 19), weeksFor(3, 10, 12), weeksFor(1, 10, 12)], [5, 4, 2, 1]);
  });

  test('contracts send a shipment every 7 days from the day signed, the last on the final day, then end with a word', function (t) {
    var s = fresh();
    s.day = 12;
    s.diplomacy.agreements = [{ id: 'a', title: 'Trade Agreement', clan: 'Clan Karr', startDay: 12, endDay: 33, income: 100, lastShipmentDay: 12 }];
    var paid = [];
    for (var d = 13; d <= 34; d++) {
      s.day = d;
      var before = s.treasuryGP;
      var out = R.tickDiplomacy(s, data);
      if (s.treasuryGP > before) paid.push(d);
      if (out.word.length) t.same([d, out.word], [33, ['Your Trade Agreement with Clan Karr has ended (its last shipment arrived).']]);
    }
    t.same(paid, [19, 26, 33]);
    t.equal(s.treasuryGP, 300);
    t.equal(s.diplomacy.agreements.length, 0);
  });

  test('a bad failure: no deal, −20 Political Capital, a 14-day cooldown', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.treasuryGP = 5000;
    var o = order(s, 'hall_of_emissaries', 'secure_trade_agreement', 0, { targetClan: 'Clan Blackstone' });
    var res = R.applyEmissary(s, data, o, R.emissaryPlan(s, data, o), { main: roll(5, 7) }, dice([0.5]));
    t.equal(res.tier, 'bad_failure');
    t.equal(s.diplomacy.agreements.length, 0);
    t.equal(s.politicalCapital.blackstone, -20);
    t.equal(R.cooldownLeft(s, 'trade_agreement'), 14);
    t.ok(res.changes.indexOf('Cooldown: 14 days') !== -1);
    t.equal(res.summary, 'Negotiations sour. Ink never touches parchment.');
    s.day += 14;
    R.tickDiplomacy(s, data);
    t.equal(R.cooldownLeft(s, 'trade_agreement'), 0, 'free again 14 days later');
    t.same(s.diplomacy.cooldowns, {});
  });

  test('a natural 1 still signs the deal with no Political Capital change (B20, kept)', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.treasuryGP = 5000;
    var o = order(s, 'hall_of_emissaries', 'secure_trade_agreement', 0, { targetClan: 'Clan Blackstone' });
    var res = R.applyEmissary(s, data, o, R.emissaryPlan(s, data, o), { main: roll(1, 3) }, dice([0.5]));
    t.equal(res.tier, 'critical_failure');
    t.equal(s.diplomacy.agreements.length, 1);
    t.equal(s.politicalCapital.blackstone, 0);
    t.equal(R.cooldownLeft(s, 'trade_agreement'), 0);
  });

  test('Host Delegation changes Political Capital once, by its Diplomacy and Insight rolls (B2)', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.treasuryGP = 1000;
    var o = order(s, 'hall_of_emissaries', 'host_delegation', 0, { tone: 'conciliatory', targetClan: 'Clan Blackstone' });
    var p = R.emissaryPlan(s, data, o);
    var before = s.treasuryGP;
    var res = R.applyEmissary(s, data, o, p, { main: roll(20, 22), r1: roll(12, 16), r2: roll(11, 13) }, dice([0]));
    t.equal(s.politicalCapital.blackstone, 15, 'not 15 + 25');
    t.equal(s.diplomacy.tokens, 1);
    t.equal(s.treasuryGP, before + 68, '80 gp × 0.85 (conciliatory)');
    var dl = s.diplomacy.delegations[0];
    t.equal(dl.endDay - dl.startDay, 28, 'the first roll still sets the length (14 + 14 days)');
    t.same(res.changes.filter(function (c) { return /Political Capital/.test(c); }), ['Political Capital: +15 (Clan Blackstone)']);
    t.equal(res.summary, '', 'its summary line stays empty (BAS-34, kept)');
  });

  test('Host Delegation: one success +8, a near miss 0, two misses −12 and a gold penalty', function (t) {
    function run(r1, r2) {
      var s = built(fresh(), ['hall_of_emissaries']);
      s.treasuryGP = 1000;
      var o = order(s, 'hall_of_emissaries', 'host_delegation', 2, { tone: 'assertive', targetClan: 'Clan Karr' });
      s.treasuryGP = 1000;
      R.applyEmissary(s, data, o, R.emissaryPlan(s, data, o), { main: roll(10, 12), r1: roll(r1, r1), r2: roll(r2, r2) }, dice([0]));
      return [s.politicalCapital.karr, s.treasuryGP, s.diplomacy.tokens];
    }
    t.same(run(13, 3), [8, 1080, 0]);
    t.same(run(11, 3), [0, 1080, 0]);
    t.same(run(5, 4), [-12, 950, 0]);
  });

  test('a Summit gives both clans Political Capital and a Hall discount', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.facilityLevels.hall_of_emissaries = 2;
    s.treasuryGP = 1000;
    var o = order(s, 'hall_of_emissaries', 'inter_clan_summit', 0, { targetClan: '' });
    t.equal(o.optionLabel, 'Blackstone + Rowthorn');
    var res = R.applyEmissary(s, data, o, R.emissaryPlan(s, data, o), { main: roll(15, 19) }, dice([0.2]));
    t.equal(res.tier, 'great_success');
    t.equal(s.politicalCapital.blackstone, 15);
    t.equal(s.politicalCapital.rowthorn, 15);
    t.same([s.diplomacy.summits[0].costReductionPct, s.diplomacy.summits[0].endDay - s.diplomacy.summits[0].startDay], [30, 28]);
    t.equal(s.warehouse[0].item, 'Summit Charter');
  });

  test('a Trade Consortium opens the network and a route for its clan', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.facilityLevels.hall_of_emissaries = 3;
    s.treasuryGP = 1000;
    var o = order(s, 'hall_of_emissaries', 'trade_consortium', 1, { targetClan: 'Karr' });
    t.equal(o.label, 'Hall of Emissaries: Trade Consortium (Karr)');
    s.day = 15;
    R.applyEmissary(s, data, o, R.emissaryPlan(s, data, o), { main: roll(15, 21) }, dice([0.5]));
    t.ok(s.tradeNetwork.active);
    var r = s.tradeNetwork.routes[0];
    t.same([r.clan, r.commodity, r.risk, r.openedDay, r.nextDay, r.expiresDay, r.status], ['Karr', 'Wool & Furs', 'high', 15, 22, 50, 'active']);
    t.equal(r.yieldGP, s.diplomacy.consortiums[0].income);
  });

  test('a new consortium doesn\'t reopen an expired route (B21, kept)', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.facilityLevels.hall_of_emissaries = 3;
    s.treasuryGP = 1000;
    s.tradeNetwork.routes = [{ id: 'old', clan: 'Karr', status: 'expired' }];
    var o = order(s, 'hall_of_emissaries', 'trade_consortium', 1, { targetClan: 'Karr' });
    R.applyEmissary(s, data, o, R.emissaryPlan(s, data, o), { main: roll(15, 21) }, dice([0.5]));
    t.equal(s.tradeNetwork.routes.length, 1);
    t.equal(s.diplomacy.consortiums.length, 1);
  });

  group('Bastion: passing a day');

  test('a day\'s steps: the day moves on, building and shipments, then the routes, the orders and the finish, with word from the Ironbow', function (t) {
    var s = built(fresh(), []);
    s.day = 20;
    s.builtExtras = [{ facId: 'library_scriptorium', status: 'building', startDay: 0, readyDay: 21 }];
    s.diplomacy.agreements = [{ title: 'Trade Agreement', clan: 'Clan Karr', startDay: 14, endDay: 21, income: 100, lastShipmentDay: 14 }];
    s.lastEvent = { name: 'Guest' };
    R.startDay(s, data, 1);
    t.equal(s.day, 21);
    t.equal(s.treasuryGP, 100, 'the last shipment');
    t.equal(s.diplomacy.agreements.length, 0, 'the agreement ran out');
    t.same([s.dayInProgress.day, s.dayInProgress.stage, s.dayInProgress.skipped, s.dayInProgress.attackRolled], [21, 'trade', [], false]);
    t.same(s.builtExtras[0], { facId: 'library_scriptorium', status: 'built' });
    R.finishRoutes(s);
    t.equal(s.dayInProgress.stage, 'orders');
    t.same(s.lastEvent, { name: 'Guest' }, 'the last event stays until the next');
    R.finishDay(s, data, data.events, dice([0.5]), 1);
    t.equal(s.dayInProgress, null);
    t.same(titles(s), ['Diplomacy', 'Diplomacy', 'Construction Complete']);
    t.ok(s.log.every(function (l) { return l.day === 21; }), 'each log line has its day');
    t.same(s.word, [{ day: 21, lines: ['The Library & Scriptorium is built.', 'Your Trade Agreement with Clan Karr has ended (its last shipment arrived).'] }]);
  });

  test('a quiet day adds no word', function (t) {
    var s = fresh();
    s.day = 3;
    R.startDay(s, data);
    R.finishRoutes(s);
    R.finishDay(s, data, data.events, dice([0.5]));
    t.equal(s.day, 4);
    t.same(s.word, []);
    t.same(s.log, []);
  });

  test('the automatic Bastion event comes every 28 days from Day 1 (Days 29, 57…), once', function (t) {
    t.same([1, 2, 28, 29, 30, 57, 85].map(function (d) { return R.isEventDay(data, d); }), [false, false, false, true, false, true, true]);
    t.same([1, 5, 29, 30, -3].map(function (d) { return R.nextEventDay(data, d); }), [29, 29, 57, 57, 29]);
    var s = fresh();
    s.day = 28;
    R.startDay(s, data);
    R.finishRoutes(s);
    R.finishDay(s, data, data.events, dice([0.995]));
    t.equal(s.lastEvent.name, 'Treasure');
    t.equal(s.lastEvent.day, 29);
    t.equal(s.lastEventDay, 29);
    t.equal(s.log[0].body, 'Auto event (Day 29) → Rolled 100 → Treasure');
    t.same(s.word[0].lines, ['Bastion event: Treasure (rolled 100).']);
    /* Finishing the same day again (a resumed day) can't roll it twice. */
    s.dayInProgress = { day: 29, stage: 'orders', skipped: [], attackRolled: true, news: [] };
    R.finishDay(s, data, data.events, dice([0.1]));
    t.equal(s.lastEvent.name, 'Treasure');
  });

  test('a skipped order stays due and comes up the next day', function (t) {
    var s = fresh();
    s.pendingOrders = [{ id: 'w', facId: 'war_council', dueDay: 2, meta: { kind: 'war_action' } }];
    R.startDay(s, data);
    t.equal(R.dueOrders(s, s.dayInProgress.skipped).length, 1);
    R.skipOrder(s, 'w');
    t.equal(R.dueOrders(s, s.dayInProgress.skipped).length, 0);
    t.equal(R.dueOrders(s).length, 1, 'still due (Resolve)');
    R.finishDay(s, data, data.events, dice([0.1]));
    R.startDay(s, data);
    t.equal(R.dueOrders(s, s.dayInProgress.skipped).length, 1);
  });

  test('the Explorer\'s day: first read moves the Bastion to it; ahead passes days; behind moves everything back', function (t) {
    var s = fresh();
    t.same(R.clockAction(s, null), { kind: 'none' });
    t.same(R.clockAction(s, 0), { kind: 'none' });
    t.equal(R.clockAction(s, 9).kind, 'anchor');
    s.pendingOrders = [{ id: 'o', issuedDay: 1, dueDay: 5 }];
    R.anchor(s, 9);
    t.same([s.day, s.anchored, s.pendingOrders[0].dueDay], [9, true, 13], 'nothing passed; the order still 4 days off');
    t.same(R.clockAction(s, 9), { kind: 'none' });
    t.same(R.clockAction(s, 12), { kind: 'pass', days: 3 });
    t.same(R.clockAction(s, 4), { kind: 'shift', by: -5 });
    s.dayInProgress = { day: 9, stage: 'orders', skipped: [], attackRolled: false, news: [] };
    t.same(R.clockAction(s, 4), { kind: 'pass', days: 0 }, 'a day part-way through is finished first');
  });

  test('moving the Bastion by days (Reset Travel): everything due keeps its distance; history stays', function (t) {
    var s = fresh();
    s.day = 30;
    s.anchored = true;
    s.pendingOrders = [{ id: 'o', issuedDay: 28, dueDay: 33 }];
    s.builtExtras = [{ facId: 'library_scriptorium', status: 'building', startDay: 20, readyDay: 41 }];
    s.diplomacy.agreements = [{ startDay: 26, endDay: 47, lastShipmentDay: 26, income: 10 }];
    s.diplomacy.cooldowns = { summit: 40 };
    s.tradeNetwork.routes = [{ id: 'r', openedDay: 25, nextDay: 32, expiresDay: 60, status: 'active' }];
    s.repairs = { barracks: 35 };
    s.wars = { bacca: { since: 20, last: 27, next: 34 } };
    s.warRecovery = [{ id: 'x', untilDay: 37 }];
    s.defenders.patrolUntil = 31;
    s.log = [{ title: 'x', body: 'y', day: 29 }];
    R.shiftDays(s, -29);
    t.equal(s.day, 1);
    t.same([s.pendingOrders[0].dueDay, s.builtExtras[0].readyDay, s.diplomacy.agreements[0].endDay, s.diplomacy.cooldowns.summit, s.tradeNetwork.routes[0].nextDay, s.repairs.barracks, s.wars.bacca.next, s.wars.bacca.since, s.warRecovery[0].untilDay, s.defenders.patrolUntil], [4, 12, 18, 11, 3, 6, 5, -9, 8, 2]);
    t.equal(R.cooldownLeft(s, 'summit'), 10);
    t.equal(s.log[0].day, 29, 'the log is history');
    t.equal(R.dayLabel(-9), 'before Day 1');
    t.equal(R.dayLabel(4), 'Day 4');
  });

  test('which way each order completes', function (t) {
    t.equal(R.orderKind(data, { facId: 'trade_network' }), 'network');
    t.equal(R.orderKind(data, { facId: 'war_council' }), 'war');
    t.equal(R.orderKind(data, { facId: 'hall_of_emissaries', fnId: 'host_delegation' }), 'emissary');
    t.equal(R.orderKind(data, { facId: 'hall_of_emissaries', fnId: 'upgrade_hall' }), 'simple');
    t.equal(R.orderKind(data, { facId: 'nowhere', fnId: 'x' }), 'none');
  });

  test('diplomacy each day: shipments, records ending, routes expiring with their consortium, cooldowns ending', function (t) {
    var s = fresh();
    s.day = 15;
    s.diplomacy.consortiums = [{ clan: 'Karr', title: 'Form Trade Consortium', startDay: 8, endDay: 15, income: 50, lastShipmentDay: 8 }];
    s.tradeNetwork.routes = [{ id: 'r', clan: 'Karr', status: 'active', expiresDay: 43 }];
    s.diplomacy.cooldowns = { summit: 17, consortium: 15 };
    var out = R.tickDiplomacy(s, data);
    t.same(out.logs, [['Diplomacy', 'Contract shipments arrived: +50 gp.'], ['Diplomacy', 'Your Form Trade Consortium with Karr has ended (its last shipment arrived).']]);
    t.equal(s.tradeNetwork.routes[0].status, 'expired');
    t.same(s.diplomacy.cooldowns, { summit: 17 });
    t.equal(R.passiveIncome(s), 0);
  });

  group('Bastion: trade routes');

  function network(routes) {
    var s = fresh();
    s.day = 5;
    s.tradeNetwork.active = true;
    s.tradeNetwork.routes = routes;
    return s;
  }

  test('route DCs and payouts', function (t) {
    var s = network([]);
    t.equal(R.routeDC(s, { risk: 'high' }), 14);
    t.equal(R.routeDC(s, { risk: 'low' }), 11);
    t.equal(R.routePayout(s, { yieldGP: 100 }, 'success'), 100);
    t.equal(R.routePayout(s, { yieldGP: 100 }, 'strong_success'), 120);
    s.tradeNetwork.highRiskRouting = true;
    s.tradeNetwork.yieldBonusPct = 5;
    t.equal(R.routeDC(s, { risk: 'high' }), 16);
    t.equal(R.routePayout(s, { yieldGP: 100 }, 'success'), 125);
    t.equal(R.routePayout(s, { yieldGP: 100, status: 'expired' }, 'success'), 0);
  });

  test('each route pays at most once each time it sails (every 7 days), even after a cancelled roll (BAS-05, BAS-11)', function (t) {
    var s = network([{ id: 'a', clan: 'Blackstone', risk: 'low', yieldGP: 100, status: 'active', nextDay: 5 }, { id: 'b', clan: 'Karr', risk: 'high', yieldGP: 200, status: 'active', nextDay: 5 }, { id: 'c', clan: 'Bacca', risk: 'low', yieldGP: 50, status: 'active', nextDay: 7 }]);
    t.ok(R.routesDueToday(s));
    t.equal(R.routeNeedsRoll(s, s.tradeNetwork.routes[0]), false);
    t.equal(R.routeNeedsRoll(s, s.tradeNetwork.routes[1]), true);
    var out = R.settleRoute(s, data, s.tradeNetwork.routes[0], null, dice([0.1]));
    t.equal(out.gained, 100);
    /* The Karr roll is cancelled here: nothing more happens. Resolving again only offers Karr. */
    t.same(R.routesToSettle(s).map(function (r) { return r.id; }), ['b']);
    R.settleRoute(s, data, s.tradeNetwork.routes[1], roll(15, 15), dice([0.1]));
    t.equal(s.treasuryGP, 300);
    t.same(R.routesToSettle(s), []);
    t.equal(R.routesDueToday(s), false);
    t.same(s.tradeNetwork.routes.map(function (r) { return r.nextDay; }), [12, 12, 7]);
    s.day = 7;
    t.same(R.routesToSettle(s).map(function (r) { return r.id; }), ['c'], 'each on its own 7-day count');
    s.day = 12;
    t.equal(R.routesToSettle(s).length, 3, 'a week on, they sail again');
  });

  test('a failed roll disrupts the route; a disaster also drops stability and files a dispute', function (t) {
    var s = network([{ id: 'b', clan: 'Karr', commodity: 'Wool & Furs', risk: 'high', yieldGP: 200, status: 'active' }]);
    var out = R.settleRoute(s, data, s.tradeNetwork.routes[0], roll(12, 12), dice([0.1]));
    t.equal(out.gained, 0);
    t.equal(s.tradeNetwork.routes[0].status, 'disrupted');
    t.equal(s.arbitration.queue.length, 0);
    s = network([{ id: 'b', clan: 'Karr', commodity: 'Wool & Furs', risk: 'high', yieldGP: 200, status: 'active' }]);
    out = R.settleRoute(s, data, s.tradeNetwork.routes[0], roll(5, 5), dice([0.1]));
    t.equal(out.line, 'Karr suffers a catastrophic loss at sea. Status: Disrupted. Market Stability falls by 10%.');
    t.equal(s.tradeNetwork.stability, 65);
    var d = s.arbitration.queue[0];
    t.same([d.a, d.b, d.meta.routeClan, d.meta.commodity, d.meta.disruptedDay, d.meta.stabilityAtFiling, d.createdDay], ['Karr', 'Ironbow Trade Consortium', 'Karr', 'Wool & Furs', 5, 65, 5]);
  });

  group('Bastion: the Council Ledger');

  function disputed() {
    var s = network([{ id: 'b', clan: 'Karr', risk: 'high', yieldGP: 200, status: 'disrupted' }]);
    R.enqueueDispute(s, data, 'Karr', 'Trade disruption and disputed tariffs.', { routeClan: 'Karr' }, dice([0.3]));
    return s;
  }

  test('a binding verdict clears the dispute and restores the route', function (t) {
    var s = disputed();
    var res = R.rule(s, data, s.arbitration.queue[0].id, 'S', roll(13, 13));
    t.ok(res.passed);
    t.equal(s.arbitration.queue.length, 0);
    t.equal(s.tradeNetwork.routes[0].status, 'active');
    t.equal(s.politicalCapital.karr, 2);
    t.equal(s.tradeNetwork.stability, 77);
    t.same(res.effects, ['Karr accepts a compromise (+2 Political Capital).', 'Market Stability +2%.', 'Karr route status: Restored (Active).']);
    t.equal(res.log[1], 'The seal is struck. The council has split the claims. (Roll [object Object] = 13 vs DC 13)', 'as before (BAS-29, kept)');
  });

  test('ruling for either side, and a deadlock', function (t) {
    var s = disputed();
    R.rule(s, data, s.arbitration.queue[0].id, 'A', roll(15, 15));
    t.same([s.politicalCapital.karr, s.tradeNetwork.stability], [6, 74]);
    s = disputed();
    R.rule(s, data, s.arbitration.queue[0].id, 'B', roll(15, 15));
    t.same([s.politicalCapital.karr, s.tradeNetwork.stability], [-4, 79]);
    s = disputed();
    var res = R.rule(s, data, s.arbitration.queue[0].id, 'A', roll(12, 12));
    t.ok(!res.passed);
    t.ok(res.stillThere);
    t.same([s.politicalCapital.karr, s.tradeNetwork.stability, s.tradeNetwork.routes[0].status], [-2, 73, 'disrupted']);
    t.ok(/Returned to docket/.test(s.arbitration.queue[0].reason));
    t.equal(R.councilBonus(s), 0, 'the Writ\'s +2 is never granted (B6, kept)');
  });

  group('Bastion: identity');

  test('support: (Political Capital + 100) ÷ 2 + Honour/Respect × 4', function (t) {
    var s = fresh();
    t.equal(R.supportForClanKey(s, 'karr'), 50);
    s.politicalCapital.karr = 10;
    s.honourRespectByClan.karr = 2;
    t.equal(R.supportForClanKey(s, 'karr'), 63);
    t.equal(R.totalSupport(fresh()), 350);
  });

  test('forming a Clan: level 9, total support 360 and 3 clans at 55, each on both sides of the line', function (t) {
    function clanState(level, pcs) {
      var s = fresh();
      s.partyLevel = level;
      Object.keys(pcs).forEach(function (k) { s.politicalCapital[k] = pcs[k]; });
      return R.canFormClan(s, data);
    }
    var three = { blackstone: 10, bacca: 10, farmer: 10, slade: -10 };
    t.same(clanState(9, three), { ok: true, lvlOk: true, totalOk: true, countOk: true });
    t.equal(clanState(8, three).lvlOk, false);
    t.equal(clanState(9, { blackstone: 10, bacca: 10, farmer: 10, slade: -12 }).totalOk, false, '359');
    t.equal(clanState(9, { blackstone: 10, bacca: 10, farmer: 8 }).countOk, false, 'only 2 clans at 55');
  });

  test('the requirements line is the Clan\'s alone: the Mercenary Brigade is archived (Build 3)', function (t) {
    var s = fresh();
    s.defenders.count = 3;
    t.equal(R.requirementsHint(s, data), 'Clan requirements: Level 9+ (NO), Total Support 360+ (NO), 3 clans at 55+ (NO).');
    t.equal(R.canFormMerc, undefined, 'no Form Mercenary Brigade');
    t.same(Object.keys(data.bastion.identityRules), ['clanMinLevel', 'clanSupportTotalMin', 'clanSupportPerClanMin', 'clanSupportClanCountMin']);
    s.organization = { type: 'clan', name: 'Clan Ironbow', chief: '', motto: '', foundedAtDay: 1 };
    t.equal(R.orgLabel(s), 'Clan: Clan Ironbow');
    t.equal(R.orgLabel(fresh()), 'Unsworn');
  });

  test('a Brigade in a save from Builds 1 and 2 loads as Unsworn, its name known for the Day Log; its Trusted Clients are kept', function (t) {
    var save = R.toSave(fresh());
    save.day = 9;
    save.organization = { type: 'merc', name: 'The Ironbow Freeblades', chief: '', motto: '', foundedAtDay: 4 };
    save.trustedClientsByClan.bacca = 12;
    t.equal(R.saveProblem(save), null, 'still a good save');
    t.same(R.formerBrigade(save), { name: 'The Ironbow Freeblades' });
    var back = R.fromSave(JSON.parse(JSON.stringify(save)), data);
    t.same(back.organization, { type: 'unsworn', name: '', chief: '', motto: '', foundedAtDay: null });
    t.equal(back.trustedClientsByClan.bacca, 12, 'kept, unread, so the archived Brigade could come back');
    t.equal(R.formerBrigade(R.toSave(back)), null, 'only once');
    save.organization.name = '  ';
    t.same(R.formerBrigade(save), { name: 'the Brigade' });
    t.equal(R.formerBrigade(R.toSave(fresh())), null);
    t.equal(R.formerBrigade(null), null);
  });

  group('Bastion: war');

  test('what can be committed; the unsworn only send defenders and beasts', function (t) {
    var s = fresh();
    s.defenders.count = 5;
    s.defenderBeasts = [{ name: 'Ape', qty: 2 }];
    s.military = [{ name: 'Lieutenant (1)', qty: 2 }, { name: 'Regiment (100)', qty: 1 }];
    t.same(R.warAvailable(s), { defenders: 5, beasts: 2, lieutenants: 2, regiments: 1, fullWar: false }, 'beasts counted by number, not by row (BAS-25 fixed)');
    s.organization.type = 'clan';
    t.equal(R.warAvailable(s).fullWar, true, 'a Clan sends everything');
    s.organization.type = 'merc';
    t.equal(R.warAvailable(s).fullWar, false, 'only a Clan (the Brigade is archived)');
  });

  test('the old single-roll war is archived: nothing on the rules calls it', function (t) {
    ['warCommit', 'queueWarAction', 'warPlan', 'resolveWar', 'removeBeasts'].forEach(function (k) { t.equal(R[k], undefined, k); });
    t.equal(data.bastion.war.dc, undefined, 'its DCs went with it');
  });

  test('five Giant Vultures are five beasts (BAS-25)', function (t) {
    var s = fresh();
    s.defenders.count = 3;
    s.defenderBeasts = [{ name: 'Ape', qty: 1 }, { name: 'Giant Vulture', qty: 5 }];
    t.equal(R.beastQty(s), 6);
    t.equal(R.warAvailable(s).beasts, 6);
  });

  group('Bastion: the Military Action');

  /* A Clan at war: 2 Regiments, 6 defenders, 1 Lieutenant and 3 of its 5 Giant Vultures. */
  function atWar(extra) {
    var s = fresh();
    s.organization = { type: 'clan', name: 'Clan Ironbow', chief: '', motto: '', foundedAtDay: 1 };
    s.treasuryGP = 100;
    s.defenders.count = 6;
    s.defenderBeasts = [{ name: 'Giant Vulture', qty: 5 }, { name: 'Ape', qty: 1 }];
    s.military = [{ name: 'Lieutenant (1)', qty: 1 }, { name: 'Regiment (100)', qty: 2 }];
    oldWarOrder(s, Object.assign({ objective: 'raid', targetKey: 'bacca', targetName: 'Bacca', commitDefenders: 6, commitBeasts: 3, commitLieutenants: 1, commitRegiments: 2 }, extra || {}));
    return s;
  }
  function begun(extra) {
    var s = atWar(extra);
    var ma = R.beginMilitaryAction(s, data, s.pendingOrders[0], dice([0.4]), 0);
    return { s: s, ma: ma };
  }
  function rolled(weatherD20, moraleD20, luckD20, stormRand) {
    var b = begun();
    R.militaryRoll(b.s, data, b.ma.id, 'weather', roll(weatherD20, weatherD20), dice([stormRand === undefined ? 0 : stormRand]));
    R.militaryRoll(b.s, data, b.ma.id, 'morale', roll(moraleD20, moraleD20), dice([0]));
    R.militaryRoll(b.s, data, b.ma.id, 'luck', roll(luckD20, luckD20), dice([0]));
    return b;
  }

  test('the war order becomes a Military Action at once, so it can\'t come due twice', function (t) {
    var b = begun();
    t.same(b.s.pendingOrders, []);
    t.equal(b.s.militaryActions.length, 1);
    t.same([b.ma.step, b.ma.objective, b.ma.targetName, b.ma.day, b.ma.v, b.ma.tier], ['weather', 'raid', 'Bacca', 1, 2, 'established'], 'a phase 1 order: an established local force');
    t.same(b.ma.commit, { defenders: 6, lieutenants: 1, units: { line: 2 }, beasts: { 'Giant Vulture': 3 } }, 'its Regiments are Line Infantry; its beasts the first in the list');
    t.equal(b.ma.battle, null);
    t.same(b.ma.spec.player.units.map(function (u) { return u.label; }), ['Line Infantry 1', 'Line Infantry 2', 'Giant Vulture 1', 'Giant Vulture 2', 'Giant Vulture 3']);
    t.equal(b.s.log[0].body, 'Raid vs Bacca: your forces muster for battle. The Military Action is ready to begin.');
    t.equal(R.militaryCommitLine(b.ma.commit), '6 defenders, 1 Lieutenant, Line Infantry ×2, Giant Vulture ×3');
    t.equal(R.militaryCommitLine({ defenders: 6, beasts: 3, lieutenants: 1, regiments: 2 }), '6 defenders, 1 Lieutenant, 3 beasts, 2 Regiments', 'phase 1\'s shape still reads');
  });

  test('short names: a name\'s initials', function (t) {
    t.same([R.forceInitials('Giant Vulture'), R.forceInitials('ape'), R.forceInitials('Dire Wolf Alpha'), R.forceInitials('')], ['GV', 'Ap', 'DA', '?']);
  });

  test('Weather: pass the DC 12 for a clear day; fail and a storm is drawn at random', function (t) {
    var b = begun();
    t.equal(R.militaryDC(data, b.ma, 'weather'), 12);
    var res = R.militaryRoll(b.s, data, b.ma.id, 'weather', roll(12, 12), dice([0.9]));
    t.same([b.ma.weather.id, b.ma.weather.pass, b.ma.step, res.headline, res.video], ['clear', true, 'morale', 'Clear Day', null]);
    t.equal(R.militaryDC(data, b.ma, 'morale'), 12, 'a clear day adds nothing to Morale');
    [[0, 'white_blizzard', 16], [0.4, 'cold_rain', 14], [0.9, 'sun_heatwave', 15]].forEach(function (c) {
      var x = begun();
      var r = R.militaryRoll(x.s, data, x.ma.id, 'weather', roll(11, 11), dice([c[0]]));
      t.same([x.ma.weather.id, x.ma.weather.pass, R.militaryDC(data, x.ma, 'morale')], [c[1], false, c[2]], c[1]);
      t.ok(/^tools\/explorer\/assets\/overlays\/.+\.mp4$/.test(r.video), 'the Explorer\'s weather film');
      t.ok(/Morale DC rises by \d/.test(r.text));
    });
  });

  test('each roll only counts at its own step, once', function (t) {
    var b = begun();
    t.equal(R.militaryRoll(b.s, data, b.ma.id, 'morale', roll(20, 20), dice([0])), null, 'not Morale before the Weather');
    t.ok(R.militaryRoll(b.s, data, b.ma.id, 'weather', roll(15, 15), dice([0])));
    t.equal(R.militaryRoll(b.s, data, b.ma.id, 'weather', roll(1, 1), dice([0])), null, 'a second Weather roll is ignored');
    t.equal(b.ma.weather.d20, 15);
    t.equal(R.militaryRoll(b.s, data, 'nope', 'morale', roll(15, 15), dice([0])), null);
    t.equal(R.militaryRoll(b.s, data, b.ma.id, 'morale', null, dice([0])), null, 'a cancelled roll changes nothing');
    t.equal(b.ma.step, 'morale');
  });

  test('Morale: the words fit the weather and who leads the march', function (t) {
    var b = rolled(5, 18, 15, 0);
    t.same([b.ma.weather.id, b.ma.morale.pass, b.ma.morale.dc], ['white_blizzard', true, 16]);
    t.equal(R.militaryResult(data, b.ma, 'morale').text, 'Despite the biting cold of the march, your Lieutenants keep your forces’ spirits high through encouraging words around warm campfires.');
    var c = rolled(5, 15, 15, 0);
    t.equal(c.ma.morale.pass, false, '15 misses the snowstorm\'s DC 16');
    t.equal(R.militaryResult(data, c.ma, 'morale').text, 'The morale of your forces is low after a long march to the field in biting cold and ankle-deep snow.');
    var d = begun({ commitLieutenants: 0 });
    R.militaryRoll(d.s, data, d.ma.id, 'weather', roll(4, 4), dice([0.5]));
    R.militaryRoll(d.s, data, d.ma.id, 'morale', roll(20, 20), dice([0]));
    t.ok(/^Soaked to the skin.+ You make a jest/.test(R.militaryResult(data, d.ma, 'morale').text), 'no Lieutenants: the party themselves');
  });

  test('Luck: DC 10; pass is +1, fail is −1, then it\'s time to deploy', function (t) {
    var b = rolled(15, 15, 10);
    t.same([b.ma.luck.mod, b.ma.step, R.militaryResult(data, b.ma, 'luck').headline], [1, 'deploy', 'Luck: +1']);
    var c = rolled(15, 15, 9);
    t.same([c.ma.luck.mod, R.militaryResult(data, c.ma, 'luck').headline], [-1, 'Luck: −1']);
    t.equal(R.militaryResult(data, c.ma, 'luck').text, 'Something strange is in the air today, perhaps the Gods do not look kindly upon this needless bloodshed… (−1 modifier on all attack rolls)', 'Harry\'s words');
    t.same(R.militarySummary(data, c.ma), [{ label: 'Weather', value: 'Clear Day' }, { label: 'Morale', value: 'High' }, { label: 'Luck', value: '−1' }]);
    t.equal(R.militaryStatus(c.ma), 'Rolls done. Next: deploy your forces on the War Table.');
  });

  test('Luck\'s modifier follows the war data file, so the Luck box, the summary and the battle agree', function (t) {
    var W = T.bastionWar;
    var data2 = Object.assign({}, data, { war: Object.assign({}, W, { luck: { passMod: 2, failMod: -3 } }) });
    function luckAt(d20) {
      var b = begun();
      R.militaryRoll(b.s, data2, b.ma.id, 'weather', roll(15, 15), dice([0]));
      R.militaryRoll(b.s, data2, b.ma.id, 'morale', roll(15, 15), dice([0]));
      R.militaryRoll(b.s, data2, b.ma.id, 'luck', roll(d20, d20), dice([0]));
      return b;
    }
    var up = luckAt(15), down = luckAt(2);
    t.same([up.ma.luck.mod, R.militaryResult(data2, up.ma, 'luck').headline, R.militarySummary(data2, up.ma)[2].value, up.ma.spec.conditions.luckMod], [2, 'Luck: +2', '+2', 2]);
    t.same([down.ma.luck.mod, R.militaryResult(data2, down.ma, 'luck').headline, down.ma.spec.conditions.luckMod], [-3, 'Luck: −3', -3]);
    t.equal(R.fromSave(JSON.parse(JSON.stringify(R.toSave(up.s))), data2).militaryActions[0].luck.mod, 2, 'and on loading a save');
    t.equal(R.luckMod(data, true), W.luck.passMod, 'the data file\'s own +1');
  });

  test('calling it off wins and loses nothing', function (t) {
    var b = rolled(15, 15, 15);
    var before = [b.s.treasuryGP, b.s.defenders.count, JSON.stringify(b.s.defenderBeasts), b.s.warLog.length];
    t.ok(R.callOffMilitaryAction(b.s, b.ma.id, 0));
    t.same(b.s.militaryActions, []);
    t.ok(b.s.warMissions[b.ma.missionKey].conditions, 'the mission and its opening rolls are kept');
    t.same([b.s.treasuryGP, b.s.defenders.count, JSON.stringify(b.s.defenderBeasts), b.s.warLog.length], before);
    t.equal(b.s.log[0].body, 'Raid vs Bacca: the Military Action was called off. Nothing was won or lost.');
    t.equal(R.callOffMilitaryAction(b.s, b.ma.id, 0), false);
  });

  group('Bastion: the crest and the War Table\'s saves');

  test('a crest is a picture record; anything else is refused on import', function (t) {
    var good = { dataUrl: 'data:image/webp;base64,AAAA', key: R.hashText('data:image/webp;base64,AAAA'), name: 'crest.png' };
    t.ok(R.isCrest(good));
    t.ok(!R.isCrest({ dataUrl: 'http://example.com/x.png', key: 'k' }));
    t.ok(!R.isCrest({ dataUrl: 'data:text/html,hi', key: 'k' }));
    t.ok(!R.isCrest('data:image/png;base64,AAAA'));
    t.equal(R.importProblem([{ key: 'tsi.bastion.crest', value: good }]), null);
    t.ok(/crest picture/.test(R.importProblem([{ key: 'tsi.bastion.crest', value: { dataUrl: 'x' } }])));
    t.ok(/battle map/.test(R.importProblem([{ key: 'tsi.bastion.warMap', value: { dataUrl: 'nope', key: 1 } }])));
    t.ok(/War Table settings/.test(R.importProblem([{ key: 'tsi.bastion.warTable', value: 'x' }])));
    t.equal(R.importProblem([{ key: 'tsi.bastion.warMap', value: good }, { key: 'tsi.bastion.warTable', value: {} }]), null);
    t.equal(R.hashText('abc'), R.hashText('abc'));
    t.ok(R.hashText('abc') !== R.hashText('abd'));
  });

  test('a crest may keep the Crest Creator\'s design with it (Build 3)', function (t) {
    var c = { dataUrl: 'data:image/png;base64,AAAA', key: 'k', name: 'x.png', design: { clanName: 'Ironbow', shield: 'heater' } };
    t.ok(R.isCrest(c));
    t.equal(R.importProblem([{ key: 'tsi.bastion.crest', value: c }]), null);
    c.design = 'heater';
    t.ok(!R.isCrest(c), 'a design is a set of settings');
  });

  test('a crest sent from the Crest Creator: a PNG and its design, kept as the Bastion\'s crest; anything else is refused', function (t) {
    var png = 'data:image/png;base64,iVBORw0KGgo=';
    var c = R.crestFromHandoff({ id: 'crest-1', at: 5, name: '  Clan Ironbow ', dataUrl: png, design: { clanName: 'Clan Ironbow', shield: 'heater', mottoOn: true, size: 3, bad: { x: 1 }, worse: [1], nan: NaN } });
    t.same(c, { dataUrl: png, key: R.hashText(png), name: 'Clan Ironbow (Crest Creator).png', design: { clanName: 'Clan Ironbow', shield: 'heater', mottoOn: true, size: 3 } });
    t.ok(R.isCrest(c));
    t.equal(R.crestFromHandoff({ dataUrl: png }).name, 'Crest (Crest Creator).png', 'no name');
    t.equal('design' in R.crestFromHandoff({ dataUrl: png }), false, 'no design: none kept');
    t.equal(R.crestFromHandoff({ dataUrl: 'data:image/jpeg;base64,AAAA' }), null, 'only the Creator\'s PNG');
    t.equal(R.crestFromHandoff({ dataUrl: 'data:image/png;base64,' + new Array(3000001).join('A') }), null, 'too big');
    t.equal(R.crestFromHandoff({ dataUrl: 'http://example.com/x.png' }), null);
    t.equal(R.crestFromHandoff(null), null);
    t.equal(R.crestFromHandoff('x'), null);
  });

  group('Bastion: events and the Compendium');

  test('the d100 table, with 99–00 now reaching Treasure (B11)', function (t) {
    var table = data.events.eventTable;
    t.same([1, 50, 51, 98, 99, 100].map(function (n) { return R.resolveEvent(n, table).name; }),
      ['All Is Well', 'All Is Well', 'Attack', 'Request for Aid', 'Treasure', 'Treasure']);
    var s = fresh();
    var ev = R.rollEvent(s, data.events, dice([0.3]), 0);
    t.same([ev.roll, ev.name], [31, 'All Is Well']);
    t.ok(s.lastEvent.lines.length > 0);
  });

  test('the Compendium index, its links, Roll20 and the offline export (B15)', function (t) {
    var idx = R.compendiumIndex(data.facilities, data.tools);
    t.ok(idx.links['Bag of Holding'].some(function (l) { return l.facName === 'Arcane Laboratory'; }));
    t.equal(R.roll20Url('Bag of Holding'), 'https://roll20.net/compendium/dnd5e/Bag%20of%20Holding');
    var out = R.compendiumExport(idx, T.bastionCompendium.items);
    t.equal(out.filled, 0);
    t.equal(out.kept + out.stubbed, 270);
    t.equal(out.kept, 68);
    t.equal(out.file.version, 1);
    t.equal(T.bastion.compendiumCards.length, 36);
    t.same(T.bastion.compendiumCards.filter(function (n) { return idx.items.indexOf(n) === -1; }), [], 'every card belongs to an item');
    t.ok(out.file.items['Bag of Holding'].summary);
  });

  group('Bastion: facility levels (step 1b, 13 October 2026)');

  test('every facility goes from Level 1 to 5; an upgrade takes 7 / 14 / 21 / 28 days to reach Level 2 / 3 / 4 / 5, and no gold (D8)', function (t) {
    t.same(T.bastion.levels, { max: 5, upgradeDays: { 2: 7, 3: 14, 4: 21, 5: 28 }, upgradeCostGP: 0 });
    t.same([2, 3, 4, 5].map(function (l) { return R.upgradeDays(data, l); }), [7, 14, 21, 28]);
    var s = fresh();
    s.day = 10;
    s.treasuryGP = 50;
    t.equal(R.getFacilityLevel(s, 'barracks'), 1);
    t.same(R.upgradeCheck(s, data, 'barracks'), { ok: true, toLevel: 2, days: 7, costGP: 0 });
    var r = R.issueUpgrade(s, data, 'barracks', dice([0.3]));
    t.equal(r.ok, true);
    t.same(r.log, ['Order Issued', 'Barracks: Upgrade to Level 2 (7 days: due Day 17).']);
    var o = s.pendingOrders[0];
    t.same([o.facId, o.fnId, o.label, o.costGP, o.issuedDay, o.dueDay, o.meta], ['barracks', 'upgrade', 'Barracks: Upgrade to Level 2', 0, 10, 17, { kind: 'upgrade', toLevel: 2 }]);
    t.equal(s.treasuryGP, 50, 'no gold');
    t.equal(R.orderKind(data, o), 'simple');
    t.ok(/already being upgraded: ready on Day 17/.test(R.issueUpgrade(s, data, 'barracks', dice([0.3])).message), 'one at a time');
    t.ok(R.issueOrder(s, data, 'barracks', 'recruit_defenders', 0, dice([0.3])).ok, 'its other orders carry on');
    t.same(R.completeSimpleOrder(s, data, o, dice([0.3])), [['Order Completed', 'Barracks: Upgrade to Level 2 → The Barracks is now Level 2.']]);
    t.equal(R.getFacilityLevel(s, 'barracks'), 2);
    R.removeOrder(s, o.id);
    s.facilityLevels.barracks = 4;
    t.same(R.upgradeCheck(s, data, 'barracks'), { ok: true, toLevel: 5, days: 28, costGP: 0 });
    s.facilityLevels.barracks = 5;
    t.same(R.upgradeCheck(s, data, 'barracks'), { ok: false, top: true, message: 'The Barracks is at its highest level (5).' });
    s.facilityLevels.barracks = 9;
    t.equal(R.getFacilityLevel(s, 'barracks'), 5, 'never above 5');
  });

  test('no upgrading while Under Repair (D6); an upgrade already running waits for the repairs, like any order; not for a facility that isn\'t built', function (t) {
    var s = fresh();
    s.day = 10;
    R.issueUpgrade(s, data, 'dock', dice([0.3]));
    s.repairs = { dock: 20, armoury: 12 };
    t.same(R.issueUpgrade(s, data, 'armoury', dice([0.3])), { ok: false, message: 'The Armoury is Under Repair until Day 12.' });
    s.day = 17;
    t.same(R.dueOrders(s).map(function (x) { return x.facId; }), [], 'the Dock\'s upgrade waits for its repairs');
    s.day = 21;
    t.same(R.dueOrders(s).map(function (x) { return x.facId; }), ['dock']);
    t.equal(R.upgradeCheck(s, data, 'library_scriptorium').message, 'The Library & Scriptorium isn\'t built yet.');
    s.builtExtras = [{ facId: 'library_scriptorium', status: 'building', startDay: 1, readyDay: 22 }];
    t.equal(R.upgradeCheck(s, data, 'library_scriptorium').ok, false, 'not while it\'s being built');
  });

  test('the Hall\'s Upgrade is the same order: Level 4 and 5 keep the +6 (D7); its Level 2 and 3 actions unlock as before', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    t.equal(R.diplomacyModForHall(s), 2);
    t.equal(R.issueUpgrade(s, data, 'hall_of_emissaries', dice([0.3])).ok, true);
    t.equal(s.pendingOrders[0].label, 'Hall of Emissaries: Upgrade to Level 2');
    R.completeSimpleOrder(s, data, s.pendingOrders[0], dice([0.3]));
    t.equal(R.diplomacyModForHall(s), 4);
    [3, 4, 5].forEach(function (l) { s.facilityLevels.hall_of_emissaries = l; t.equal(R.diplomacyModForHall(s), 6, 'Level ' + l); });
  });

  test('levels survive saving, demolishing drops one, and an upgrade order is an ordinary pending order (cancel, demolish, defence lost)', function (t) {
    var s = built(fresh(), ['library_scriptorium']);
    s.facilityLevels.library_scriptorium = 3;
    s.facilityLevels.watchtower = 5;
    R.issueUpgrade(s, data, 'library_scriptorium', dice([0.3]));
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
    t.same([back.facilityLevels.library_scriptorium, back.facilityLevels.watchtower, back.pendingOrders[0].meta], [3, 5, { kind: 'upgrade', toLevel: 4 }]);
    var d = R.demolishFacility(back, data, 'library_scriptorium');
    t.same(d.cancelled.map(function (o) { return o.label; }), ['Library & Scriptorium: Upgrade to Level 4']);
    t.equal(back.facilityLevels.library_scriptorium, undefined);
  });

  group('Bastion: research (pull request 2, 13 October 2026)');

  /* Herbal Gardens built, at a level, with gold. */
  function gardens(level, gp) {
    var s = built(fresh(), ['herbal_gardens']);
    s.day = 10;
    s.partyLevel = 9;
    s.facilityLevels.herbal_gardens = level;
    s.treasuryGP = gp === undefined ? 5000 : gp;
    return s;
  }
  /* Research a choice and let it complete. */
  function research(s, branch, choice) {
    var r = R.startResearch(s, data, 'herbal_gardens', branch, choice, dice([0.3]));
    if (!r.ok) throw new Error('research refused: ' + r.message);
    var o = R.researchRunning(s, 'herbal_gardens');
    R.completeSimpleOrder(s, data, o, dice([0.3]));
    R.removeOrder(s, o.id);
  }

  test('the Herbal Gardens tree: 4 branches of 3 stages of 2 choices; 12 can be researched now (pull request 3 added Specialist Seedbeds, Botanical Extraction and Exotic Flora Conservatory), 12 are "coming"; the document\'s gold', function (t) {
    var tree = R.researchTree(data, 'herbal_gardens');
    t.same(tree.branches.map(function (b) { return [b.name, b.stages.length, b.costs]; }), [
      ['Agricultural Development', 3, [150, 350, 750]], ['Herbal Medicine', 3, [200, 450, 950]], ['Botanical Research', 3, [200, 500, 1100]], ['Commercial Cultivation', 3, [250, 600, 1300]]]);
    var all = [];
    tree.branches.forEach(function (b) { b.stages.forEach(function (st) { t.equal(st.choices.length, 2); st.choices.forEach(function (c) { all.push(c); }); }); });
    t.equal(all.length, 24);
    t.same(all.filter(function (c) { return !c.needs; }).map(function (c) { return c.id; }), ['fertile_soil', 'efficient_planting', 'intensive_cultivation', 'crop_rotation', 'bountiful_harvests', 'perpetual_growing_cycle', 'healing_herb_refinement', 'improved_antitoxins', 'concentrated_restoratives',
      'specialist_seedbeds', 'botanical_extraction', 'exotic_flora_conservatory']);
    all.forEach(function (c) {
      if (c.needs) t.ok(T.bastionResearch.needs[c.needs], c.id + ' says what it waits for');
      else t.ok(c.effects && c.effects.length, c.id + ' has effects');
    });
    t.equal(R.researchTree(data, 'barracks'), null, 'only the Herbal Gardens has a tree so far');
  });

  test('tokens: none at Level 1; one per level from 2 (four at Level 5); a project running takes one', function (t) {
    t.same([1, 2, 3, 4, 5].map(function (l) { return R.researchTokens(gardens(l), data, 'herbal_gardens').total; }), [0, 1, 2, 3, 4]);
    var s = gardens(1);
    t.equal(R.researchCheck(s, data, 'herbal_gardens', 'agricultural', 'fertile_soil').message, 'Research opens at Level 2.');
    s = gardens(2);
    var r = R.startResearch(s, data, 'herbal_gardens', 'agricultural', 'fertile_soil', dice([0.3]));
    t.equal(r.ok, true);
    t.same(r.log, ['Research Started', 'Herbal Gardens: Research Fertile Soil (Agricultural Development, Stage I) (150gp, 7 days: ready on Day 17).']);
    t.equal(s.treasuryGP, 4850, '150 gp');
    var o = R.researchRunning(s, 'herbal_gardens');
    t.same([o.fnId, o.costGP, o.dueDay, o.meta], ['research', 150, 17, { kind: 'research', branch: 'agricultural', stage: 0, choice: 'fertile_soil', name: 'Fertile Soil' }]);
    t.same(R.researchTokens(s, data, 'herbal_gardens'), { total: 1, used: 1, free: 0 });
    t.equal(R.orderKind(data, o), 'simple');
    t.same(R.completeSimpleOrder(s, data, o, dice([0.3])), [['Research Complete', 'Herbal Gardens: Research Fertile Soil (Agricultural Development, Stage I) → Fertile Soil is researched.']]);
    R.removeOrder(s, o.id);
    t.same(s.research, { herbal_gardens: { agricultural: ['fertile_soil'] } });
    t.same(R.researchTokens(s, data, 'herbal_gardens'), { total: 1, used: 1, free: 0 });
    t.ok(/No research token free/.test(R.researchCheck(s, data, 'herbal_gardens', 'medicine', 'healing_herb_refinement').message));
  });

  test('one choice per stage; a stage opens once the one before is done; 7 / 14 / 21 days; one project at a time; not while Under Repair; the gold is needed', function (t) {
    var s = gardens(5);
    t.equal(R.researchChoiceState(s, data, 'herbal_gardens', 'agricultural', 'intensive_cultivation'), 'locked');
    t.ok(/stage before it/.test(R.researchCheck(s, data, 'herbal_gardens', 'agricultural', 'intensive_cultivation').message));
    R.startResearch(s, data, 'herbal_gardens', 'agricultural', 'efficient_planting', dice([0.3]));
    t.equal(R.researchChoiceState(s, data, 'herbal_gardens', 'agricultural', 'fertile_soil'), 'other', 'the other choice at a stage being researched');
    t.ok(/already researching Efficient Planting: ready on Day 17/.test(R.researchCheck(s, data, 'herbal_gardens', 'medicine', 'healing_herb_refinement').message), 'one at a time');
    var o = R.researchRunning(s, 'herbal_gardens');
    R.completeSimpleOrder(s, data, o, dice([0.3]));
    R.removeOrder(s, o.id);
    t.equal(R.researchChoiceState(s, data, 'herbal_gardens', 'agricultural', 'fertile_soil'), 'other');
    t.equal(R.researchChoiceState(s, data, 'herbal_gardens', 'agricultural', 'crop_rotation'), 'open');
    t.same(R.researchCheck(s, data, 'herbal_gardens', 'agricultural', 'crop_rotation'), { ok: true, stageIdx: 1, days: 14, costGP: 350 });
    research(s, 'agricultural', 'crop_rotation');
    t.same(R.researchCheck(s, data, 'herbal_gardens', 'agricultural', 'perpetual_growing_cycle'), { ok: true, stageIdx: 2, days: 21, costGP: 750 });
    t.equal(R.researchChoiceState(s, data, 'herbal_gardens', 'medicine', 'fortifying_draughts'), 'coming', '"coming" says more than "locked"');
    research(s, 'medicine', 'healing_herb_refinement');
    t.equal(R.researchChoiceState(s, data, 'herbal_gardens', 'medicine', 'fortifying_draughts'), 'coming');
    t.equal(R.researchCheck(s, data, 'herbal_gardens', 'medicine', 'fortifying_draughts').message, 'Coming with the Explorer link, which tracks each hero\'s conditions (pull request 4).');
    s.repairs = { herbal_gardens: 12 };
    t.equal(R.researchCheck(s, data, 'herbal_gardens', 'agricultural', 'perpetual_growing_cycle').message, 'The Herbal Gardens is Under Repair until Day 12.');
    s.repairs = {};
    s.treasuryGP = 100;
    t.equal(R.researchCheck(s, data, 'herbal_gardens', 'agricultural', 'perpetual_growing_cycle').message, 'Not enough gp. Need 750gp, you have 100gp.');
  });

  test('undo: a stage and those above it on its branch, their tokens free again, no gold back; not while a later stage is running', function (t) {
    var s = gardens(5);
    research(s, 'agricultural', 'fertile_soil');
    research(s, 'agricultural', 'crop_rotation');
    research(s, 'medicine', 'improved_antitoxins');
    var gp = s.treasuryGP;
    R.startResearch(s, data, 'herbal_gardens', 'agricultural', 'bountiful_harvests', dice([0.3]));
    t.equal(R.undoResearch(s, data, 'herbal_gardens', 'agricultural', 1).message, 'A later stage on this branch is being researched: cancel it first.');
    R.cancelOrder(s, R.researchRunning(s, 'herbal_gardens').id, data, 0);
    t.equal(s.treasuryGP, gp - 750, 'Cancel gives no gold back (B9)');
    t.same(R.researchTokens(s, data, 'herbal_gardens'), { total: 4, used: 3, free: 1 }, 'but its token is free');
    var u = R.undoResearch(s, data, 'herbal_gardens', 'agricultural', 0);
    t.same(u.log, ['Research Undone', 'Herbal Gardens: Fertile Soil, Crop Rotation are no longer researched; their tokens are free again.']);
    t.same(s.research.herbal_gardens, { medicine: ['improved_antitoxins'] });
    t.same(R.researchTokens(s, data, 'herbal_gardens'), { total: 4, used: 1, free: 3 });
    t.equal(R.undoResearch(s, data, 'herbal_gardens', 'agricultural', 0).ok, false, 'nothing left to undo there');
  });

  test('effects: faster orders (the biggest saving, never under 2 days); bigger batches (the biggest yield, rounded up); two potions at a time', function (t) {
    var s = gardens(5);
    var hg = R.facility(data, 'herbal_gardens');
    var harvest = R.fn(hg, 'harvest');
    var cultivate = R.fn(hg, 'cultivate');
    t.same([R.orderDaysAt(s, data, hg, harvest), R.orderDaysAt(s, data, hg, cultivate)], [7, 10]);
    research(s, 'agricultural', 'efficient_planting');
    t.same([R.orderDaysAt(s, data, hg, harvest), R.orderDaysAt(s, data, hg, cultivate)], [6, 10], 'Efficient Planting: Harvest only');
    research(s, 'agricultural', 'crop_rotation');
    t.same([R.orderDaysAt(s, data, hg, harvest), R.orderDaysAt(s, data, hg, cultivate)], [5, 8], 'Crop Rotation replaces it (2, not 3)');
    research(s, 'agricultural', 'perpetual_growing_cycle');
    t.same([R.orderDaysAt(s, data, hg, harvest), R.orderDaysAt(s, data, hg, cultivate)], [4, 7]);
    t.equal(R.orderDaysAt(s, data, hg, { id: 'harvest', days: 3 }), 2, 'never below 2 days');
    t.equal(R.orderDaysAt(s, data, hg, { id: 'harvest', days: 1 }), 1, 'an order already shorter stays as it is');
    var r = R.issueOrder(s, data, 'herbal_gardens', 'harvest', 1, dice([0.3]));
    t.equal(r.log[1], 'Herbal Gardens: Harvest (Rations (100)) (4 days: due Day 14).', 'a new order uses the shorter time');

    var y = gardens(5);
    function make(st, fnId, idx) {
      var f = R.fn(hg, fnId);
      var o = { facId: 'herbal_gardens', fnId: fnId, chosen: f.options[idx], optionLabel: f.options[idx].label, label: 'X' };
      return R.completeSimpleOrder(st, data, o, dice([0.3]))[0][1];
    }
    t.equal(make(y, 'harvest', 1), 'X → Added to Warehouse.', 'unchanged without research');
    t.same([y.warehouse[0].item, y.warehouse[0].qty], ['Rations (100)', 1]);
    research(y, 'agricultural', 'fertile_soil');
    t.equal(make(y, 'harvest', 1), 'X → Added to Warehouse: Rations (125).');
    research(y, 'agricultural', 'intensive_cultivation');
    t.equal(make(y, 'harvest', 1), 'X → Added to Warehouse: Rations (150).', 'the biggest yield, not 175%');
    t.equal(make(y, 'harvest', 0), 'X → Added to Warehouse: Antitoxin (3 vials).', '2 vials + 50%');
    research(y, 'medicine', 'improved_antitoxins');
    t.equal(make(y, 'harvest', 0), 'X → Added to Warehouse: Antitoxin (6 vials).', '4 vials + 50%');
    t.equal(make(y, 'harvest', 3), 'X → Added to Warehouse.', 'one Potion of Healing without Healing Herb Refinement');
    var z = gardens(5);
    research(z, 'medicine', 'healing_herb_refinement');
    t.equal(make(z, 'harvest', 3), 'X → Added to Warehouse: 2 × Potion of Healing.');
    t.same([z.warehouse[0].item, z.warehouse[0].qty], ['Potion of Healing', 2]);
    t.equal(make(z, 'cultivate', 0), 'X → Added to Warehouse.', 'Greater Potions are not affected');
    research(z, 'medicine', 'concentrated_restoratives');
    t.equal(make(z, 'cultivate', 0), 'X → Added to Warehouse: 2 × Greater Potion of Healing.');
    t.equal(make(z, 'harvest', 2), 'X → Added to Warehouse.', 'Healer\'s Kit unchanged');
  });

  test('research survives saving (only what the tree knows, stage by stage); demolishing the Herbal Gardens loses it', function (t) {
    var s = gardens(3);
    research(s, 'agricultural', 'fertile_soil');
    research(s, 'agricultural', 'crop_rotation');
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
    t.same(back.research, { herbal_gardens: { agricultural: ['fertile_soil', 'crop_rotation'] } });
    t.same(R.cleanResearch({ herbal_gardens: { agricultural: ['fertile_soil', 'nonsense', 'bountiful_harvests'], medicine: 'x', made_up: ['a'] }, barracks: { a: ['b'] } }, data),
      { herbal_gardens: { agricultural: ['fertile_soil'] } }, 'a damaged stage drops the stages above it');
    t.same(R.fromSave(Object.assign(JSON.parse(JSON.stringify(R.toSave(s))), { research: undefined }), data).research, {});
    R.demolishFacility(back, data, 'herbal_gardens');
    t.same(back.research, {});
  });

  group('Bastion: the facilities overhaul (v 2 to v 3, 13 October 2026)');

  /* A Bastion as it was saved before the overhaul (v 2), on Day 12. */
  function v2(fn) {
    var s = JSON.parse(JSON.stringify(R.toSave(fresh())));
    s.v = 2;
    s.day = 12;
    s.anchored = true;
    s.partyLevel = 13;
    delete s.legacyFacilities;
    delete s.archivedFacilities;
    delete s.migration;
    if (fn) fn(s);
    return s;
  }
  function slots(s) { return s.builtExtras.map(function (x) { return x ? x.facId + (x.status === 'building' ? ' (building)' : '') : ''; }); }

  test('each old facility moves to its new one, keeping its slot; Arcane Study and Laboratory become one Arcane Laboratory', function (t) {
    var raw = v2(function (s) {
      s.builtExtras = [{ facId: 'arcane_study', status: 'built' }, { facId: 'library', status: 'built' }, { facId: 'laboratory', status: 'built' }, { facId: 'garden', status: 'building', startDay: 2, readyDay: 23 }, ''];
      s.facilityLevels = Object.assign(s.facilityLevels, { arcane_study: 1, laboratory: 2, library: 1 });
      s.pendingOrders = [
        { id: 'a', facId: 'arcane_study', fnId: 'craft_common', label: 'Arcane Study: Craft Common Magic Item (Bag of Holding)', costGP: 50, issuedDay: 10, dueDay: 15 },
        { id: 'b', facId: 'laboratory', fnId: 'craft', label: 'Laboratory: Craft (Potion of Healing)', costGP: 25, issuedDay: 11, dueDay: 16 },
        { id: 'c', facId: 'library', fnId: 'research', label: 'Library: Research (Combat Scriptures)', costGP: 0, issuedDay: 12, dueDay: 19 }
      ];
    });
    var before = JSON.stringify(raw);
    var res = R.migrateToV3(raw, data);
    t.equal(JSON.stringify(raw), before, 'the save it was given is untouched (that copy is set aside)');
    var s = res.save;
    t.equal(s.v, 3);
    t.same(slots(s), ['arcane_laboratory', 'library_scriptorium', '', 'herbal_gardens (building)', '']);
    t.same(s.builtExtras[3], { facId: 'herbal_gardens', status: 'building', startDay: 2, readyDay: 23 }, 'building work keeps its days');
    t.same(s.pendingOrders.map(function (o) { return [o.id, o.facId, o.fnId, o.costGP, o.dueDay]; }), [
      ['a', 'arcane_laboratory', 'craft_common', 50, 15],
      ['b', 'arcane_laboratory', 'alchemy', 25, 16],
      ['c', 'library_scriptorium', 'research', 0, 19]
    ], 'orders follow their facility, keeping their costs and due days; the Laboratory\'s Craft is now Alchemy');
    t.equal(s.facilityLevels.arcane_laboratory, 2, 'the higher level of the two');
    t.equal(s.facilityLevels.library_scriptorium, 1);
    t.same(['arcane_study', 'laboratory', 'library'].filter(function (id) { return id in s.facilityLevels; }), []);
    t.same(res.lines, [
      'The Arcane Study and the Laboratory are now one Arcane Laboratory: the other slot is free.',
      'The Library is now the Library & Scriptorium.',
      'The Garden is now the Herbal Gardens (still being built).',
      '3 pending orders moved with their facilities, keeping their due days.'
    ]);
    t.same([s.log[0].title, s.log[0].day], ['Facilities', 12]);
    t.equal(s.log[0].body, 'The facilities overhaul (13 October 2026): ' + res.lines.join(' '));
    t.same(s.migration, { v3: { day: 12, lines: res.lines, shown: false } }, 'the notice is still to be shown');
    t.same([s.legacyFacilities, s.archivedFacilities], [[], []]);
  });

  test('a merge with one half built and one still building keeps the built one; two still building keep the first ready', function (t) {
    var s = R.migrateToV3(v2(function (b) {
      b.builtExtras = [{ facId: 'greenhouse', status: 'building', startDay: 5, readyDay: 33 }, { facId: 'garden', status: 'built' }];
    }), data).save;
    t.same(slots(s), ['', 'herbal_gardens']);
    t.equal(s.migration.v3.lines[0], 'The Greenhouse and the Garden are now one Herbal Gardens: the other slot is free, and building work on the Greenhouse stopped (building costs no gold).');
    s = R.migrateToV3(v2(function (b) {
      b.builtExtras = [{ facId: 'laboratory', status: 'building', startDay: 6, readyDay: 34 }, { facId: 'arcane_study', status: 'building', startDay: 8, readyDay: 29 }];
    }), data).save;
    t.same(s.builtExtras, ['', { facId: 'arcane_laboratory', status: 'building', startDay: 8, readyDay: 29 }]);
    t.equal(s.migration.v3.lines[0], 'The Laboratory and the Arcane Study are now one Arcane Laboratory (still being built): the other slot is free, and building work on the Laboratory stopped (building costs no gold).');
  });

  test('a Greenhouse order is now Herbal Gardens: Greenhouse Harvest; repairs on both halves: the later one', function (t) {
    var s = R.migrateToV3(v2(function (b) {
      b.builtExtras = [{ facId: 'garden', status: 'built' }, { facId: 'greenhouse', status: 'built' }];
      b.repairs = { garden: 14, greenhouse: 20, barracks: 13 };
      b.pendingOrders = [{ id: 'g', facId: 'greenhouse', fnId: 'harvest', label: 'Greenhouse: Harvest (Potion of Healing)', costGP: 0, issuedDay: 10, dueDay: 17 }];
    }), data).save;
    t.same(s.repairs, { barracks: 13, herbal_gardens: 20 });
    t.same([s.pendingOrders[0].facId, s.pendingOrders[0].fnId], ['herbal_gardens', 'cultivate']);
    var back = R.fromSave(s, data);
    t.same(back.repairs, { barracks: 13, herbal_gardens: 20 }, 'the repairs survive loading (an unknown facility\'s would be dropped)');
    t.same(back.pendingOrders.map(function (o) { return o.id; }), ['g'], 'and so does the order');
  });

  test('the Smithy joins the Workshop: its slot is freed and the Workshop keeps its Craft order (as Smithing); still being built, it just goes', function (t) {
    var res = R.migrateToV3(v2(function (b) {
      b.builtExtras = [{ facId: 'smithy', status: 'built' }, { facId: 'library', status: 'built' }];
      b.facilityLevels.smithy = 1;
      b.repairs = { smithy: 15 };
      b.pendingOrders = [{ id: 's', facId: 'smithy', fnId: 'craft', label: 'Smithy: Craft (Dagger)', costGP: 0, issuedDay: 11, dueDay: 16 }];
    }), data);
    var s = res.save;
    t.same(slots(s), ['', 'library_scriptorium']);
    t.same(s.legacyFacilities, ['smithy']);
    t.same([s.pendingOrders[0].facId, s.pendingOrders[0].fnId, s.pendingOrders[0].dueDay], ['workshop', 'smithing', 16]);
    t.equal('smithy' in s.facilityLevels, false);
    t.same(s.repairs, {}, 'the Workshop doesn\'t take on the Smithy\'s repairs');
    t.equal(res.lines[0], 'The Smithy joined the Workshop: its slot is free, and the Workshop keeps the Smithy\'s order.');
    var workshop = R.facility(data, 'workshop');
    var smithing = R.fn(workshop, 'smithing');
    t.equal(smithing.options.length, 29, 'the Smithy\'s 29 items');
    t.same(R.fnAvailable(R.fromSave(s, data), workshop, smithing), { ok: true });
    var building = R.migrateToV3(v2(function (b) { b.builtExtras = [{ facId: 'smithy', status: 'building', startDay: 4, readyDay: 25 }]; }), data);
    t.same([slots(building.save), building.save.legacyFacilities], [[''], []], 'no Smithing for a Smithy never finished');
    t.equal(building.lines[0], 'Building work on the Smithy stopped: it has joined the Workshop. Its slot is free.');
    t.same(R.fnAvailable(fresh(), workshop, smithing), { ok: false, hidden: true, message: 'That order isn\'t available here.' }, 'a new Bastion doesn\'t see Smithing');
  });

  test('the Gaming Hall goes (Harry, D2): built or building, its slot is freed, its Trade order cancelled, and it is recorded as archived', function (t) {
    var res = R.migrateToV3(v2(function (b) {
      b.builtExtras = [{ facId: 'gaming_hall', status: 'built' }, ''];
      b.facilityLevels.gaming_hall = 1;
      b.repairs = { gaming_hall: 20 };
      b.pendingOrders = [{ id: 'gh', facId: 'gaming_hall', fnId: 'trade', label: 'Gaming Hall: Trade', costGP: 0, issuedDay: 10, dueDay: 17 }, { id: 'k', facId: 'barracks', fnId: 'recruit_defenders', label: 'Barracks: Recruit Defenders', costGP: 0, issuedDay: 10, dueDay: 15 }];
    }), data);
    var s = res.save;
    t.same(slots(s), ['', '']);
    t.same(s.pendingOrders.map(function (o) { return o.id; }), ['k']);
    t.same(s.archivedFacilities, [{ facId: 'gaming_hall', name: 'Gaming Hall', status: 'built', slot: 0, day: 12 }]);
    t.same([s.facilityLevels.gaming_hall, s.repairs.gaming_hall], [undefined, undefined]);
    t.same(res.lines, ['The Gaming Hall is no longer part of the Bastion; its slot is free.', 'Cancelled, with the Gaming Hall: Gaming Hall: Trade (it cost nothing).']);
    var b2 = R.migrateToV3(v2(function (b) { b.builtExtras = [{ facId: 'gaming_hall', status: 'building', startDay: 3, readyDay: 31 }]; }), data);
    t.equal(b2.lines[0], 'Building work on the Gaming Hall stopped, as it is no longer part of the Bastion; its slot is free.');
    t.equal(b2.save.archivedFacilities[0].status, 'building');
  });

  test('never touched: the treasury, the Warehouse, the Hall at level 3 mid-upgrade and its records, routes, the War Room roster, wars, identity, a day left part-way, history', function (t) {
    var raw = v2(function (b) {
      b.treasuryGP = 777;
      b.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }, { facId: 'war_room', status: 'built' }, { facId: 'library', status: 'built' }];
      b.facilityLevels = Object.assign(b.facilityLevels, { hall_of_emissaries: 3, war_room: 1, library: 1 });
      b.pendingOrders = [{ id: 'u', facId: 'hall_of_emissaries', fnId: 'upgrade_hall', label: 'Hall of Emissaries: Upgrade Hall', costGP: 0, issuedDay: 10, dueDay: 17 }];
      b.warehouse = [{ item: 'Religious Scriptures', qty: 1, gp: '', notes: 'Library' }, { item: 'Dagger', qty: 2, gp: '', notes: 'Smithy' }];
      b.military = [{ name: 'Line Infantry', qty: 3, source: 'War Room' }, { name: 'Archers', qty: 2, source: 'War Room' }];
      b.diplomacy.agreements = [{ title: 'Trade Agreement', clan: 'Clan Karr', startDay: 5, endDay: 26, income: 90, lastShipmentDay: 12 }];
      b.tradeNetwork.routes = [{ id: 'r', clan: 'Karr', risk: 'low', status: 'active', nextDay: 14, expiresDay: 40 }];
      b.wars = { bacca: { since: 6, last: 10, next: 13 } };
      b.organization = { type: 'clan', name: 'Clan Ironbow', chief: 'Harry', motto: 'Root and Steel', foundedAtDay: 3 };
      b.dayInProgress = { day: 12, stage: 'orders', skipped: ['x'], attackRolled: true, news: ['The Smithy is built.'] };
      b.word = [{ day: 11, lines: ['Smithy: Craft (Dagger) is complete.'] }];
      b.log = [{ title: 'Order Completed', body: 'Smithy: Craft (Dagger)', day: 11 }];
    });
    var s = R.migrateToV3(raw, data).save;
    ['treasuryGP', 'warehouse', 'military', 'diplomacy', 'tradeNetwork', 'wars', 'organization', 'dayInProgress', 'word', 'warLog', 'militaryActions', 'warRecovery', 'defenders', 'defenderBeasts', 'favour', 'politicalCapital', 'crest'].forEach(function (k) {
      t.same(s[k], raw[k], k);
    });
    t.same([s.facilityLevels.hall_of_emissaries, s.facilityLevels.war_room], [3, 1]);
    t.same(s.pendingOrders, raw.pendingOrders, 'the Hall\'s upgrade carries on');
    t.same(s.log.slice(1), raw.log, 'the Day Log keeps its old names (history); the overhaul\'s entry goes on top');
    t.same(slots(s), ['hall_of_emissaries', 'war_room', 'library_scriptorium']);
  });

  test('converted once: loading again changes nothing, and a Bastion with nothing to convert has no notice', function (t) {
    var raw = v2(function (b) { b.builtExtras = [{ facId: 'library', status: 'built' }, { facId: 'gaming_hall', status: 'built' }]; });
    var once = R.fromSave(raw, data);
    t.equal(once.v, 3);
    var twice = R.fromSave(JSON.parse(JSON.stringify(R.toSave(once))), data);
    t.same(twice, once, 'a v 3 save is loaded as it is');
    t.same(R.migrateToV3(R.toSave(once), data), { save: R.toSave(once), lines: [] }, 'and isn\'t converted again');
    t.equal(once.log.filter(function (l) { return l.title === 'Facilities'; }).length, 1, 'one Day Log entry');
    var plain = R.fromSave(v2(function (b) { b.builtExtras = [{ facId: 'shrine_aurush', status: 'built' }]; }), data);
    t.same(plain.migration, { v3: { day: 12, lines: [], shown: true } }, 'nothing changed: no notice');
    t.equal(plain.log.filter(function (l) { return l.title === 'Facilities'; }).length, 0);
    t.same(slots(plain), ['shrine_aurush']);
  });

  test('new orders: Alchemy and Greenhouse Harvest need party level 9; a facility still in development can\'t be built; a plot facility can\'t go in a special slot', function (t) {
    var s = built(fresh(), ['arcane_laboratory', 'herbal_gardens']);
    s.treasuryGP = 1000;
    s.partyLevel = 8;
    var lab = R.facility(data, 'arcane_laboratory');
    t.same(R.fnAvailable(s, lab, R.fn(lab, 'alchemy')), { ok: false, message: 'Needs party level 9.' });
    t.same(R.issueOrder(s, data, 'arcane_laboratory', 'alchemy', 0, dice([0.3])), { ok: false, message: 'Needs party level 9.' });
    t.equal(R.issueOrder(s, data, 'herbal_gardens', 'cultivate', 0, dice([0.3])).message, 'Needs party level 9.');
    t.ok(R.issueOrder(s, data, 'arcane_laboratory', 'craft_common', 0, dice([0.3])).ok, 'the Arcane Study\'s orders need nothing more');
    t.ok(R.issueOrder(s, data, 'herbal_gardens', 'harvest', 0, dice([0.3])).ok);
    s.partyLevel = 9;
    t.ok(R.issueOrder(s, data, 'arcane_laboratory', 'alchemy', 0, dice([0.3])).ok);
    t.ok(R.issueOrder(s, data, 'herbal_gardens', 'cultivate', 0, dice([0.3])).ok);
    t.equal(R.issueOrder(s, data, 'workshop', 'smithing', 0, dice([0.3])).ok, false, 'no Smithing without the old Smithy');
    s.partyLevel = 20;
    R.slotRows(s, 20);
    ['stone_masonworks', 'weavers_hall', 'courier_exchange', 'wyvern_roost', 'griffin_tower', 'dire_wolf_den'].forEach(function (id) {
      var r = R.startBuild(s, data, 2, id, R.isPlotFacility(data, id) ? 'plot' : 'slot');
      t.equal(r.ok, false, id);
      t.ok(/still in development/.test(r.message), id + ': ' + r.message);
    });
    ['fishery_smokehouse', 'timber_sawmill'].forEach(function (id) {
      var r = R.startBuild(s, data, 2, id, 'slot');
      t.equal(r.ok, false, id + ' refused in a special slot');
      t.ok(R.startBuild(s, data, 0, id, 'plot').ok || R.startBuild(s, data, 1, id, 'plot').ok, id + ' builds on a Development Plot');
    });
  });

  group('Bastion: Development Plots (pull request 3, 13 October 2026)');

  /* A Bastion at a party level, with these facilities on plots (built). */
  function plots(level, ids, slots) {
    var s = built(fresh(), slots || []);
    s.day = 10;
    s.partyLevel = level;
    s.builtPlots = (ids || []).map(function (id) { return id ? { facId: id, status: 'built' } : ''; });
    R.ensureLevels(s, data);
    return s;
  }

  test('plots open at party level 9 (2), 13 (4) and 17 (6); the six economic facilities go on them', function (t) {
    t.same([1, 8, 9, 12, 13, 16, 17, 20].map(function (l) { return R.plotsForLevel(l, data); }), [0, 0, 2, 2, 4, 4, 6, 6]);
    t.same(data.facilities.filter(function (f) { return f.plot; }).map(function (f) { return f.id; }).sort(),
      ['courier_exchange', 'fishery_smokehouse', 'herbal_gardens', 'stone_masonworks', 'timber_sawmill', 'weavers_hall']);
    var rows = R.plotRows(plots(9), 9, data);
    t.same([rows.max, rows.used, rows.rows.length, rows.rows[0].kind, rows.rows[0].canBuild], [2, 0, 2, 'plot', true]);
    t.equal(R.plotRows(plots(8), 8, data).rows.length, 0, 'none before level 9');
  });

  test('a plot facility builds on a plot in 21 days, never in a special slot; a special facility never on a plot', function (t) {
    var s = plots(8);
    t.ok(/needs a free Development Plot: plots open at party level 9/.test(R.startBuild(s, data, 0, 'herbal_gardens', 'plot').message));
    s.partyLevel = 9;
    t.equal(R.startBuild(s, data, 0, 'herbal_gardens', 'slot').message, 'The Herbal Gardens is built on a Development Plot.');
    t.equal(R.startBuild(s, data, 0, 'war_room', 'plot').message, 'The War Room is built in a construction slot, not on a Development Plot.');
    var r = R.startBuild(s, data, 0, 'herbal_gardens', 'plot');
    t.same(r, { ok: true, log: ['Construction Started', 'Herbal Gardens is under construction (21 days: ready on Day 31).'] });
    t.same(s.builtPlots[0], { facId: 'herbal_gardens', status: 'building', startDay: 10, readyDay: 31 });
    t.same(s.builtExtras.filter(Boolean), [], 'no special slot used');
    t.ok(R.reservedFacilityIds(s, data).indexOf('herbal_gardens') !== -1);
    t.equal(R.startBuild(s, data, 1, 'herbal_gardens', 'plot').ok, false, 'only one');
    t.ok(R.startBuild(s, data, 1, 'timber_sawmill', 'plot').ok);
    t.equal(R.startBuild(s, data, 2, 'fishery_smokehouse', 'plot').ok, false, 'two plots at level 9');
    t.same(R.upcoming(s, data).map(function (u) { return [u.kind, u.id, u.day]; }), [['build', 'herbal_gardens', 31], ['build', 'timber_sawmill', 31]]);
    R.shiftDays(s, 5);
    t.equal(s.builtPlots[0].readyDay, 36, 'a plot\'s building moves with the day');
    s.day = 36;
    t.same(R.completeConstruction(s), ['herbal_gardens', 'timber_sawmill']);
    t.ok(R.builtFacilityIds(s, data).indexOf('timber_sawmill') !== -1);
  });

  test('an Herbal Gardens in a special slot moves to the first free plot, keeping its level, orders and research; with no plot free it stays', function (t) {
    var s = built(fresh(), ['war_room', 'herbal_gardens']);
    s.partyLevel = 8;
    s.facilityLevels.herbal_gardens = 3;
    s.research = { herbal_gardens: { agricultural: ['fertile_soil'] } };
    order(s, 'herbal_gardens', 'harvest', 0);
    t.same(R.settlePlots(s, data), [], 'no plots at level 8');
    t.equal(s.builtExtras[1].facId, 'herbal_gardens');
    s.partyLevel = 9;
    var moved = R.settlePlots(s, data);
    t.same(moved, [{ facId: 'herbal_gardens', fromSlot: 1, toPlot: 0 }]);
    t.equal(R.settleLine(data, moved), 'The Herbal Gardens moved to a Development Plot; its construction slot is free.');
    t.same([s.builtExtras[1], s.builtPlots[0]], ['', { facId: 'herbal_gardens', status: 'built' }]);
    t.equal(R.getFacilityLevel(s, 'herbal_gardens'), 3);
    t.same(s.research, { herbal_gardens: { agricultural: ['fertile_soil'] } });
    t.equal(s.pendingOrders.length, 1);
    t.ok(R.builtFacilityIds(s, data).indexOf('herbal_gardens') !== -1);
    t.same(R.settlePlots(s, data), [], 'only once');
    /* Plots full: it waits in its slot, and moves when one is freed. */
    var full = plots(9, ['timber_sawmill', 'fishery_smokehouse'], ['herbal_gardens']);
    t.same(R.settlePlots(full, data), []);
    var d = R.demolishFacility(full, data, 'timber_sawmill');
    t.equal(d.ok, true);
    t.same(d.moved, [{ facId: 'herbal_gardens', fromSlot: 0, toPlot: 0 }]);
    t.equal(d.log[1], 'The Timber Yard & Sawmill was demolished; its plot is free. The Herbal Gardens moved to a Development Plot; its construction slot is free.');
  });

  test('lowering the party level keeps the plots\' facilities (marked over capacity); a save puts a non-plot facility back in a slot', function (t) {
    var s = plots(13, ['herbal_gardens', 'timber_sawmill', 'fishery_smokehouse']);
    var rows = R.plotRows(s, 9, data);
    t.same([rows.max, rows.used, rows.over], [2, 3, 1]);
    t.same(rows.rows.map(function (r) { return r.overCapacity; }), [false, false, true]);
    t.ok(R.builtFacilityIds(s, data).indexOf('fishery_smokehouse') !== -1, 'still working');
    var save = R.toSave(plots(9, ['war_room', 'herbal_gardens']));
    var back = R.fromSave(JSON.parse(JSON.stringify(save)), data);
    t.same(back.builtPlots, ['', { facId: 'herbal_gardens', status: 'built' }]);
    t.ok(back.builtExtras.some(function (x) { return x && x.facId === 'war_room'; }), 'the War Room is kept, in a slot');
    var plain = plots(9, ['herbal_gardens']);
    t.same(R.fromSave(JSON.parse(JSON.stringify(R.toSave(plain))), data), plain, 'a save and reload keeps the plots');
  });

  test('the campaign summary sees a facility being built on a plot', function (t) {
    var s = plots(9);
    s.anchored = true;
    R.startBuild(s, data, 0, 'fishery_smokehouse', 'plot');
    var coming = TSI.campaign.bastionComing(JSON.parse(JSON.stringify(R.toSave(s))));
    t.ok(coming.some(function (c) { return c.kind === 'built' && c.day === 31 && /Fishery & Smokehouse is built/.test(c.line); }), JSON.stringify(coming));
  });

  group('Bastion: goods and production (pull request 3, 13 October 2026)');

  /* Every good named in the facilities' orders. */
  function goodsNamed() {
    var ids = [];
    data.facilities.forEach(function (f) {
      (f.functions || []).forEach(function (fn) {
        if (!fn.production) return;
        (fn.options || []).forEach(function (o) {
          (o.inputs || []).concat(o.outputs || []).forEach(function (x) { if (x.good && ids.indexOf(x.good) === -1) ids.push(x.good); });
        });
      });
    });
    return ids;
  }
  function stock(s, list) { list.forEach(function (x) { R.addGoods(s, data, x[0], x[1], '', dice([0.3])); }); return s; }
  /* An order runs to its day and completes. */
  function finish(s, o) {
    var out = R.completeSimpleOrder(s, data, o, dice([0.3]));
    R.removeOrder(s, o.id);
    return out;
  }

  test('the goods catalogue: 17 trade goods in lots, 4 ingredients in portions, 1 supply in packs; every good an order names is in it', function (t) {
    var g = R.goodsList(data);
    var kinds = {};
    g.forEach(function (x) { kinds[x.kind] = (kinds[x.kind] || 0) + 1; });
    t.same(kinds, { cargo: 17, ingredient: 4, supply: 1 });
    t.equal(g.map(function (x) { return x.id; }).filter(function (id, i, a) { return a.indexOf(id) !== i; }).length, 0, 'ids are unique');
    g.filter(function (x) { return x.kind === 'cargo'; }).forEach(function (x) { t.ok(typeof x.gp === 'number' && x.gp > 0 && x.lot, x.id); });
    goodsNamed().forEach(function (id) { t.ok(R.good(data, id), id + ' is in the catalogue'); });
    t.same([R.goodsAmountText(data, 'raw_timber', 1), R.goodsAmountText(data, 'raw_timber', 3), R.goodsAmountText(data, 'restorative_herbs', 10), R.goodsAmountText(data, 'expedition_provision_pack', 1), R.goodsAmountText(data, 'expedition_provision_pack', 5)],
      ['1 lot of Raw Timber', '3 lots of Raw Timber', '10 portions of Restorative Herbs', '1 Expedition Provision Pack', '5 Expedition Provision Packs']);
    t.same([R.goodsValue(data, 'raw_timber', 3), R.goodsValue(data, 'restorative_herbs', 10)], [300, null], 'the base value per lot; ingredients have none');
  });

  test('goods in the Warehouse: merged by id only (never with a typed row of the same name); taken all or nothing', function (t) {
    var s = fresh();
    s.warehouse = [{ id: 'free', item: 'Raw Timber', qty: 7, gp: '5', notes: 'typed by hand' }];
    R.addGoods(s, data, 'raw_timber', 1, 'Timber Yard', dice([0.3]));
    R.addGoods(s, data, 'raw_timber', 2, 'Timber Yard', dice([0.3]));
    t.equal(s.warehouse.length, 2);
    t.same([s.warehouse[1].goodId, s.warehouse[1].item, s.warehouse[1].qty, s.warehouse[1].gp], ['raw_timber', 'Raw Timber', 3, '']);
    t.equal(R.goodsQty(s, 'raw_timber'), 3, 'the typed row isn\'t counted');
    R.appendToWarehouse(s, 'Raw Timber', 1, '', 'x', dice([0.3]));
    t.same([s.warehouse[0].qty, s.warehouse[1].qty], [8, 3], 'a named item merges into the typed row, never the goods row');
    t.equal(R.takeGoods(s, data, [{ good: 'raw_timber', qty: 3 }, { good: 'sawn_lumber', qty: 1 }]), null, 'short of Sawn Lumber: nothing taken');
    t.equal(R.goodsQty(s, 'raw_timber'), 3);
    t.ok(R.inputsShort(s, data, [{ good: 'raw_timber', qty: 2 }, { good: 'raw_timber', qty: 2 }]), 'a good named twice is counted together');
    t.same(R.takeGoods(s, data, [{ good: 'raw_timber', qty: 3 }]), [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 3 }]);
    t.same(s.warehouse.map(function (w) { return [w.goodId || w.id, w.qty]; }), [['free', 8], ['raw_timber', 0]], 'a used-up goods row stays, at 0');
    var only = fresh();
    R.addGoods(only, data, 'raw_timber', 1, '', dice([0.3]));
    R.takeGoods(only, data, [{ good: 'raw_timber', qty: 1 }]);
    R.ensureWarehouseRow(only, dice([0.3]));
    t.same(only.warehouse.map(function (w) { return [w.item, w.qty]; }), [['Raw Timber', 0]], 'an order never empties the Warehouse, so no "New Item" row appears');
    t.equal(R.returnGoods(s, data, [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 3 }]), '3 lots of Raw Timber went back to the Warehouse.');
    t.equal(R.goodsQty(s, 'raw_timber'), 3);
    t.equal(s.warehouse.filter(function (w) { return w.goodId === 'raw_timber'; }).length, 1, 'into the same row');
  });

  test('a saved Warehouse: typed rows exactly as they were; goods rows tidied; an order\'s held goods kept', function (t) {
    var s = fresh();
    var typed = { id: 'a', item: 'Rope', qty: 2, gp: '1 gp', notes: '' };
    var save = R.toSave(s);
    save.warehouse = [typed, { id: 'b', goodId: 'raw_timber', item: 'Logs', qty: 2.6, gp: '9999', notes: 'x' }, 'nonsense'];
    save.pendingOrders = [{ id: 'o', facId: 'timber_sawmill', fnId: 'saw_lumber', label: 'Saw', issuedDay: 1, dueDay: 5, inputs: [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 1 }, { goodId: '', qty: 3 }, 'x'] }];
    var back = R.fromSave(save, data);
    t.same(back.warehouse[0], typed);
    t.same(back.warehouse[1], { id: 'b', goodId: 'raw_timber', item: 'Raw Timber', qty: 2, gp: '', notes: 'x' });
    t.equal(back.warehouse.length, 2);
    t.same(back.pendingOrders[0].inputs, [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 1 }]);
    t.same(R.readGoodsRow({ qty: '-4', notes: ' kept ' }), { qty: 0, notes: 'kept' });
  });

  test('the Timber Yard: orders open by its level; one production order at a time; inputs taken when it begins', function (t) {
    var s = plots(9, ['timber_sawmill']);
    t.equal(R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3])).message, 'Needs Level 2.');
    s.facilityLevels.timber_sawmill = 2;
    t.equal(R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3])).message, 'Needs 1 lot of Raw Timber in the Warehouse; it has 0 lots.');
    var r = R.issueOrder(s, data, 'timber_sawmill', 'harvest_timber', 0, dice([0.3]));
    t.same(r.log, ['Order Issued', 'Timber Yard & Sawmill: Harvest Timber (4 days: due Day 14).']);
    stock(s, [['raw_timber', 1]]);
    t.equal(R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3])).message, 'The Timber Yard & Sawmill is busy: one production order at a time (Timber Yard & Sawmill: Harvest Timber, due on Day 14).');
    t.equal(R.issueUpgrade(s, data, 'timber_sawmill', dice([0.3])).ok, true, 'an upgrade isn\'t a production order');
    var o = s.pendingOrders.filter(function (x) { return x.fnId === 'harvest_timber'; })[0];
    t.same(finish(s, o), [['Order Completed', 'Timber Yard & Sawmill: Harvest Timber → Added to Warehouse: 1 lot of Raw Timber.']]);
    t.equal(R.goodsQty(s, 'raw_timber'), 2);
    r = R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3]));
    t.same(r.log, ['Order Issued', 'Timber Yard & Sawmill: Saw Lumber (4 days: due Day 14). Taken from the Warehouse: 1 lot of Raw Timber.']);
    t.equal(R.goodsQty(s, 'raw_timber'), 1);
    o = s.pendingOrders.filter(function (x) { return x.fnId === 'saw_lumber'; })[0];
    t.same(o.inputs, [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 1 }]);
    finish(s, o);
    t.same([R.goodsQty(s, 'raw_timber'), R.goodsQty(s, 'sawn_lumber')], [1, 1], 'used up, never given back on completion');
  });

  test('cancelling gives held goods back once; demolishing gives them back; an order whose facility is gone gives them back', function (t) {
    var s = stock(plots(9, ['timber_sawmill']), [['raw_timber', 1]]);
    s.facilityLevels.timber_sawmill = 2;
    R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3]));
    var id = s.pendingOrders[0].id;
    t.same(R.cancelOrder(s, id, data, 10), ['Orders', 'Cancelled Timber Yard & Sawmill: Saw Lumber. 1 lot of Raw Timber went back to the Warehouse.']);
    t.same(R.cancelOrder(s, id, data, 10), ['Orders', 'Cancelled an order.'], 'a second Cancel gives nothing');
    t.equal(R.goodsQty(s, 'raw_timber'), 1);
    R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3]));
    var d = R.demolishFacility(s, data, 'timber_sawmill');
    t.equal(d.log[1], 'The Timber Yard & Sawmill was demolished; its plot is free. Cancelled: Timber Yard & Sawmill: Saw Lumber. 1 lot of Raw Timber went back to the Warehouse.');
    t.equal(R.goodsQty(s, 'raw_timber'), 1);
    var lost = { id: 'x', facId: 'old_mill', fnId: 'grind', label: 'Old Mill: Grind', inputs: [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 2 }], dueDay: 10 };
    t.equal(R.orderKind(data, lost), 'none');
    t.same(R.dropOrderGoods(s, data, lost), [['Orders', 'Old Mill: Grind couldn\'t be completed (its facility or order no longer exists). 2 lots of Raw Timber went back to the Warehouse.']]);
    t.equal(R.goodsQty(s, 'raw_timber'), 3);
    t.equal(R.dropOrderGoods(s, data, { id: 'y', facId: 'old_mill' }), null, 'nothing held, nothing said');
  });

  test('the Fishery: fish, smoked fish, provision packs; Level 5\'s bulk orders make three', function (t) {
    var s = plots(9, ['fishery_smokehouse']);
    s.facilityLevels.fishery_smokehouse = 5;
    finish(s, order(s, 'fishery_smokehouse', 'commercial_fishing_fleet', 0));
    t.equal(R.goodsQty(s, 'fresh_fish'), 3);
    var o = order(s, 'fishery_smokehouse', 'bulk_smokehouse_production', 0);
    t.equal(o.dueDay, 17, '7 days');
    finish(s, o);
    t.same([R.goodsQty(s, 'fresh_fish'), R.goodsQty(s, 'preserved_fish')], [0, 3]);
    finish(s, order(s, 'fishery_smokehouse', 'prepare_expedition_provisions', 0));
    t.same([R.goodsQty(s, 'preserved_fish'), R.goodsQty(s, 'expedition_provision_pack')], [2, 5]);
  });

  test('the Herbal Gardens\' new orders: Level 2 ingredients, Level 3 medical supplies with their own days, research yields and recipes', function (t) {
    var s = gardens(2);
    t.equal(R.issueOrder(s, data, 'herbal_gardens', 'field_medical_supplies', 0, dice([0.3])).message, 'Needs Level 3.');
    var o = order(s, 'herbal_gardens', 'cultivate_specialist', 0);
    t.same([o.dueDay, o.label], [14, 'Herbal Gardens: Cultivate Specialist Plants → Restorative Herbs (10 portions)']);
    t.same(finish(s, o), [['Order Completed', 'Herbal Gardens: Cultivate Specialist Plants → Restorative Herbs (10 portions) → Added to Warehouse: 10 portions of Restorative Herbs.']]);
    s.facilityLevels.herbal_gardens = 3;
    stock(s, [['antivenom_roots', 5]]);
    o = order(s, 'herbal_gardens', 'field_medical_supplies', 0);
    t.equal(o.dueDay, 16, 'Healer\'s Kits and Antitoxin: 6 days');
    t.same([R.goodsQty(s, 'restorative_herbs'), R.goodsQty(s, 'antivenom_roots')], [5, 0]);
    finish(s, o);
    t.same(s.warehouse.filter(function (w) { return !w.goodId; }).map(function (w) { return [w.item, w.qty]; }), [['Healer\'s Kit', 2], ['Antitoxin (2 vials)', 2]]);
    t.equal(R.issueOrder(s, data, 'herbal_gardens', 'field_medical_supplies', 1, dice([0.3])).message, 'Needs 10 portions of Restorative Herbs in the Warehouse; it has 5 portions.');
    stock(s, [['restorative_herbs', 5]]);
    t.equal(order(s, 'herbal_gardens', 'field_medical_supplies', 1).dueDay, 17, 'Potions of Healing: 7 days');
  });

  test('research on the new orders: +5 portions, +50% (the bigger applies), Specialist Seedbeds on top; Crop Rotation and the Perpetual Growing Cycle by their wording', function (t) {
    function made(s, key, base) {
      var fac = R.facility(data, 'herbal_gardens');
      return R.goodsOutputQty(s, data, fac, R.fn(fac, 'cultivate_specialist'), key, base || 10);
    }
    var s = gardens(5);
    t.equal(made(s, 'restorative_herbs'), 10);
    s.research = { herbal_gardens: { agricultural: ['fertile_soil', 'intensive_cultivation'] } };
    t.equal(made(s, 'toxic_blossoms'), 15, 'Intensive Cultivation: +5 portions');
    s.research = { herbal_gardens: { agricultural: ['fertile_soil', 'intensive_cultivation', 'bountiful_harvests'] } };
    t.equal(made(s, 'toxic_blossoms'), 15, 'Bountiful Harvests: +50%, not added to the +5');
    /* At a base where they differ, the bigger wins: +50% of 30 beats +5 (and +5 beats +50% of 4). */
    t.same([made(s, 'toxic_blossoms', 30), made(s, 'toxic_blossoms', 4)], [45, 9]);
    s.research = { herbal_gardens: { agricultural: ['fertile_soil', 'intensive_cultivation'] } };
    t.same([made(s, 'toxic_blossoms', 30), made(s, 'toxic_blossoms', 4)], [35, 9], 'Intensive Cultivation alone: +5');
    s.research = { herbal_gardens: { agricultural: ['fertile_soil', 'intensive_cultivation', 'bountiful_harvests'] } };
    s.research.herbal_gardens.botanical = ['specialist_seedbeds'];
    t.equal(made(s, 'toxic_blossoms'), 20, 'Specialist Seedbeds: +5 more');
    t.equal(made(s, 'toxic_blossoms', 30), 50, 'on top of the bigger yield');
    var fac = R.facility(data, 'herbal_gardens');
    var fms = R.fn(fac, 'field_medical_supplies');
    var cs = R.fn(fac, 'cultivate_specialist');
    s.research = { herbal_gardens: { agricultural: ['efficient_planting'] } };
    t.equal(R.orderDaysAt(s, data, fac, cs, cs.options[0]), 4, 'Efficient Planting: the Harvest only');
    s.research = { herbal_gardens: { agricultural: ['efficient_planting', 'crop_rotation'] } };
    t.same([R.orderDaysAt(s, data, fac, cs, cs.options[0]), R.orderDaysAt(s, data, fac, fms, fms.options[0])], [2, 6], 'Crop Rotation: cultivating, not medical supplies');
    s.research = { herbal_gardens: { agricultural: ['efficient_planting', 'crop_rotation', 'perpetual_growing_cycle'] } };
    t.same([R.orderDaysAt(s, data, fac, fms, fms.options[0]), R.orderDaysAt(s, data, fac, fms, fms.options[1]), R.orderDaysAt(s, data, fac, R.fn(fac, 'major_botanical_production'), null)], [3, 4, 5], 'the Perpetual Growing Cycle: all six, from each recipe\'s own days');
  });

  test('a recipe that needs research waits for it (Botanical Extraction, Exotic Flora Conservatory)', function (t) {
    var s = gardens(5);
    stock(s, [['alchemical_flowers', 20]]);
    t.equal(R.issueOrder(s, data, 'herbal_gardens', 'commercial_medicinal_crops', 1, dice([0.3])).message, 'Needs the research Botanical Extraction.');
    t.equal(R.issueOrder(s, data, 'herbal_gardens', 'major_botanical_production', 5, dice([0.3])).message, 'Needs the research Exotic Flora Conservatory.');
    s.research = { herbal_gardens: { botanical: ['botanical_extraction'] } };
    var o = order(s, 'herbal_gardens', 'commercial_medicinal_crops', 1);
    t.same([o.dueDay, R.goodsQty(s, 'alchemical_flowers')], [17, 10]);
    finish(s, o);
    t.equal(R.goodsQty(s, 'refined_botanical_reagents'), 1);
    t.equal(R.researchChoiceState(s, data, 'herbal_gardens', 'botanical', 'exotic_flora_conservatory'), 'locked', 'Stage III waits for a Stage II choice (both still "coming"): a question for Harry');
  });

  test('the map labels: one per built facility with a position, with its level; a plot facility is labelled; positions are on the painting', function (t) {
    var s = fresh();
    t.same(R.mapLabels(s, data).map(function (l) { return [l.fac, l.level]; }), [['workshop', 1], ['barracks', 1], ['watchtower', 1], ['dock', 1], ['armoury', 1]].sort(function (a, b) { return data.bastion.startingBuilt.indexOf(a[0]) - data.bastion.startingBuilt.indexOf(b[0]); }));
    s = plots(9, ['herbal_gardens'], ['menagerie', 'war_room']);
    s.builtExtras.push({ facId: 'library_scriptorium', status: 'building', startDay: 1, readyDay: 30 });
    s.facilityLevels.barracks = 3;
    var ids = R.mapLabels(s, data).map(function (l) { return l.fac; });
    t.ok(ids.indexOf('herbal_gardens') !== -1 && ids.indexOf('war_room') !== -1);
    t.equal(ids.indexOf('menagerie'), -1, 'no position for the Menagerie');
    t.equal(ids.indexOf('library_scriptorium'), -1, 'not while being built');
    t.equal(R.mapLabels(s, data).filter(function (l) { return l.fac === 'barracks'; })[0].level, 3);
    var at = data.bastion.mapLabels;
    Object.keys(at).forEach(function (id) {
      t.ok(R.facility(data, id), id);
      t.ok(at[id].x >= 0 && at[id].x <= data.bastion.map.width && at[id].y >= 0 && at[id].y <= data.bastion.map.height, id + ' on the painting');
    });
  });

  group('Bastion: saving');

  test('a save and reload keeps identity, war log, diplomacy, the day, a day in progress and word not yet shown (BAS-01)', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.day = 12;
    s.anchored = true;
    s.organization = { type: 'clan', name: 'Clan Ironbow', chief: 'Harry', motto: 'Root and Steel', foundedAtDay: 3 };
    s.clanHonor = 70;
    s.honourRespectByClan.karr = -3;
    s.trustedClientsByClan.slade = 20;
    s.warLog = [{ id: 'w', title: 'Success: Raid vs Bacca' }];
    s.diplomacy.agreements = [{ title: 'Trade Agreement', clan: 'Clan Karr', startDay: 5, endDay: 26, income: 90, lastShipmentDay: 12 }];
    s.diplomacy.tokens = 2;
    s.diplomacy.cooldowns = { summit: 15 };
    s.defenders.patrolUntil = 14;
    s.lastEventDay = -3;
    s.dayInProgress = { day: 12, stage: 'orders', skipped: ['x'], attackRolled: true, news: ['The Smithy is built.'] };
    s.word = [{ day: 11, lines: ['Barracks: Recruit Defenders → Recruited 2 defenders.'] }];
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
    t.same(back, s);
  });

  test('a Bastion saved in turns (before the days overhaul) is recognised, refused on import and never loaded', function (t) {
    var old = { treasuryGP: 100, partyLevel: 7, turn: 5, builtExtras: [], pendingOrders: [], defenders: { count: 0 }, warehouse: [], turnInProgress: null };
    t.ok(R.isOldSave(old));
    t.equal(R.isSave(old), false);
    t.equal(R.saveProblem(old), 'It was saved before the Bastion counted in days (in Bastion turns), so it can\'t be used.');
    t.equal(R.importProblem([{ key: 'tsi.bastion.state', value: old }]), 'This file is from before the Bastion counted in days, so it can\'t be imported. Nothing was changed.');
    t.equal(R.isOldSave(R.toSave(fresh())), false);
  });

  test('a Military Action part-way through survives a save and reload', function (t) {
    var s = fresh();
    s.defenders.count = 4;
    s.defenderBeasts = [{ name: 'Giant Vulture', qty: 5 }];
    oldWarOrder(s, { objective: 'defend', targetKey: 'karr', targetName: 'Karr', commitDefenders: 4, commitBeasts: 5, commitLieutenants: 0, commitRegiments: 0 });
    var ma = R.beginMilitaryAction(s, data, s.pendingOrders[0], dice([0.6]), 0);
    R.militaryRoll(s, data, ma.id, 'weather', roll(3, 3), dice([0.1]));
    R.militaryRoll(s, data, ma.id, 'morale', roll(17, 17), dice([0]));
    R.militaryRoll(s, data, ma.id, 'luck', roll(12, 12), dice([0]));
    t.ok(R.militaryBattleSave(s, ma.id, { v: 2, phase: 'deploy', round: 1, maxRounds: 6, started: false, units: [{ id: 'p-beast-1', side: 'player', pos: { c: 3, r: 9 } }], leaders: [], log: [] }));
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
    t.same(back, s);
    t.equal(back.militaryActions[0].spec.player.units.length, 5, 'five Giant Vultures');
    t.same(back.militaryActions[0].battle.units[0].pos, { c: 3, r: 9 });
    t.equal(back.warMissions[ma.missionKey].conditions, null, 'the rolls stay the action\'s own until it is called off');
    t.same(back.militaryActions[0].spec.conditions, { weather: 'white_blizzard', moraleMod: T.bastionWar.morale.highMod, luckMod: T.bastionWar.luck.passMod });
  });

  test('a damaged Military Action is dropped; one whose step is ahead of its rolls goes back', function (t) {
    var s = fresh();
    var save = R.toSave(s);
    save.militaryActions = [
      'nonsense',
      { id: 'a', step: 'flying', commit: {}, forces: [] },
      { id: 'b', step: 'deploy', commit: { defenders: 2 }, forces: [{ id: 'def', kind: 'defenders', label: 'Bastion Defenders', count: 2 }, { id: 'x', kind: 'dragon' }], weather: { d20: 14, total: 14, dc: 12, pass: true, id: 'clear' } },
      { id: 'c', step: 'resolve', commit: {}, forces: [], weather: { d20: 1, total: 1, dc: 12, pass: false, id: 'cold_rain' }, morale: { d20: 1, total: 1, dc: 14, pass: false }, luck: { d20: 1, total: 1, dc: 10, pass: false, mod: -1 }, deployment: { started: true, locked: false, positions: {} } }
    ];
    save.defenders = { count: 2, armed: false, patrolUntil: 0 };
    var back = R.fromSave(save, data);
    t.same(back.militaryActions.map(function (m) { return [m.id, m.step, m.v]; }), [['b', 'morale', 2], ['c', 'deploy', 2]], 'phase 1 actions are upgraded; one waiting for the single roll goes back to deployment');
    t.equal(back.militaryActions[0].forces, undefined, 'the old tokens and deployment are dropped');
    t.same(back.militaryActions[0].spec.player.defenders, { count: 2, armed: false, source: { defenders: true } });
    t.ok(R.saveProblem(Object.assign(R.toSave(s), { militaryActions: 'x' })));
  });

  test('another tool\'s file or a damaged one is refused (BAS-14)', function (t) {
    t.ok(R.isSave(R.toSave(fresh())));
    t.ok(R.saveProblem({ players: [], prizeTotal: 300 }));
    t.ok(R.saveProblem({ v: 2, treasuryGP: 1, partyLevel: 1, day: 1, builtExtras: 'x', pendingOrders: [] }));
    t.ok(R.saveProblem({ v: 2, treasuryGP: 1, partyLevel: 1, day: 'x', builtExtras: [], pendingOrders: [] }));
    t.ok(R.importProblem([{ key: 'tsi.bastion.state', value: { heroes: [] } }]));
    t.ok(R.importProblem([{ key: 'tsi.bastion.ui', value: 'x' }]));
    t.equal(R.importProblem([{ key: 'tsi.bastion.state', value: R.toSave(fresh()) }, { key: 'tsi.bastion.ui', value: { collapsed: {} } }]), null);
  });

  test('a negative treasury comes back as 0 (B17, kept); an unknown day step resumes at the orders', function (t) {
    var s = fresh();
    s.treasuryGP = -40;
    s.dayInProgress = { day: 2, stage: 'nonsense' };
    var back = R.fromSave(R.toSave(s), data);
    t.equal(back.treasuryGP, 0);
    t.same(back.dayInProgress, { day: 2, stage: 'orders', skipped: [], attackRolled: false, news: [] });
  });

  /* What the screen remembers (tsi.bastion.ui) since the new screen (Build 2). */
  test('the screen remembers only whether the grid is open and the war pop-ups seen; the old panels\' settings go', function (t) {
    t.same(R.cleanUi(null), { gridOpen: true });
    t.same(R.cleanUi({}), { gridOpen: true });
    t.same(R.cleanUi({ collapsed: { war: true, diplomacy: true } }), { gridOpen: true }, 'the old panels\' open-or-closed settings');
    t.same(R.cleanUi({ gridOpen: false, warNoticed: { 'ma-1': true }, junk: 3 }), { gridOpen: false, warNoticed: { 'ma-1': true } });
    t.same(R.cleanUi({ gridOpen: 'no', warNoticed: [1] }), { gridOpen: true }, 'nonsense is ignored');
  });
}());
