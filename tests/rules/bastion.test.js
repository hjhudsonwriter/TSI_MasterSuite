/* The Ironbow Bastion Manager: tools/bastion/rules.js and its data */
(function () {
  var R = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce };

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
    /* The Secure Trade Agreement is retired (20 October 2026), but a Bastion
       can still hold one issued earlier: tests that need one lift the note for this call. */
    var fnDef = R.fn(R.facility(data, facId), fnId);
    var note = fnDef && fnDef.retiredNote;
    if (note && fnId === 'secure_trade_agreement') delete fnDef.retiredNote;
    try {
      var res = meta ? R.issueOrderWithMeta(s, data, facId, fnId, idx, meta, dice([0.3])) : R.issueOrder(s, data, facId, fnId, idx, dice([0.3]));
      if (!res.ok) throw new Error('order refused: ' + res.message);
      return s.pendingOrders[s.pendingOrders.length - 1];
    } finally { if (note) fnDef.retiredNote = note; }
  }
  function roll(d20, total) { return { d20: d20, total: total }; }

  group('Bastion: content');

  test('the facilities: the war game\'s five and the three Shrines are gone (the Temple is one building), none is still in development; 12 tool tables, 7 clans, and a Compendium that lists what the facilities offer', function (t) {
    t.ok(data.facilities.length > 0 && data.facilities.every(function (f) { return f.id && f.name && Array.isArray(f.functions); }), 'every facility has an id, a name and a list of orders');
    t.equal(data.facilities.map(function (f) { return f.id; }).filter(function (id, i, a) { return a.indexOf(id) !== i; }).length, 0, 'ids are unique');
    t.same(['barracks', 'armoury', 'watchtower', 'war_room', 'menagerie'].filter(function (id) { return R.facility(data, id); }), [], 'the war game\'s five facilities are gone (S06)');
    t.same(['shrine_telluria', 'shrine_aurush', 'shrine_pelagos'].filter(function (id) { return R.facility(data, id); }), [], 'the three Shrines are gone (S11)');
    t.equal(R.facility(data, 'temple').name, 'Temple', 'the Temple is one building');
    /* Pull request 7 (Harry, 14 October 2026) opened the Wyvern Roost, Griffin
       Tower and Dire Wolf Den, so only these two are still in development. */
    /* The Stone Quarry & Masonworks and the Weavers' Hall opened on 19 October 2026: none is left. */
    t.same(data.facilities.filter(function (f) { return f.inDevelopment; }).map(function (f) { return f.id; }), []);
    t.same(['smithy', 'arcane_study', 'laboratory', 'library', 'garden', 'greenhouse', 'gaming_hall'].filter(function (id) { return R.facility(data, id); }), [], 'the old ones are gone');
    t.equal(Object.keys(data.tools).length, 12);
    t.equal(R.toolTableNames, undefined, 'the Artisan Tools picker is gone (step S12)');
    t.same(T.bastion.clans.map(function (c) { return c.name; }), ['Blackstone', 'Bacca', 'Farmer', 'Slade', 'Molten', 'Rowthorn', 'Karr']);
    /* The Compendium lists what the facilities offer, and nothing else: the entries match the index one for one (the war game's units
       and beasts went in S06; the Shrines' six Craft charms and nine prayers went with the Temple in S11). */
    var index = R.compendiumIndex(data.facilities, data.tools).items;
    t.equal(Object.keys(T.bastionCompendium.items).length, index.length, 'one entry for each item listed');
    t.same(Object.keys(T.bastionCompendium.items).filter(function (k) { return index.indexOf(k) === -1; }), [], 'no entry for anything the Compendium does not list');
    t.same(['Tellurian Root Charm', 'Aurush Sun Charm', 'Pelagos Tide Charm', 'Telluria\'s Guidance', 'Pelagos\'s Deep Rest'].filter(function (k) { return index.indexOf(k) !== -1 || k in T.bastionCompendium.items; }), [], 'none of the Shrines\' charms or prayers');
    t.equal(T.bastionWar, undefined, 'the war data file is gone');
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
    t.same(m.overlays.map(function (o) { return o.fac; }), ['herbal_gardens', 'hall_of_emissaries', 'temple',
      'beast_pen', 'prison_tower', 'weavers_hall', 'stone_masonworks', 'fishery_smokehouse', 'timber_sawmill', 'courier_exchange']);
    t.equal(m.overlays.filter(function (o) { return o.fac === 'menagerie' || o.fac === 'war_room'; }).length, 0, 'no map picture for the war game\'s facilities (the War Room\'s went to assets/extras)');
    t.ok(T.bastion.mapLabels.courier_exchange, 'the Courier Exchange has a place for its label');
    t.same(m.overlays.filter(function (o) { return o.fac === 'temple'; }).map(function (o) { return o.pic; }), ['map/overlays/temple.png'], 'the Temple draws its one new building (Harry\'s designs of 26 October 2026)');
    t.same(T.bastion.facilityImages.temple, ['shrine_of_telluria.png', 'shrine_of_aurush.png', 'shrine_of_pelagos.png'], 'and its tile shows the three Shrine paintings side by side');
    t.same([T.bastion.mapLabels.temple.x, T.bastion.mapLabels.temple.y, T.bastion.mapLabels.temple.also], [182, 150, undefined], 'one label, at the new building');
  });

  test('the map overlays: one per built facility with a picture, a shared picture drawn once, darkened while Under Repair', function (t) {
    var s = fresh();
    t.same(R.mapOverlays(s, data), [], 'the starting buildings (the Workshop, the Dock and the Party Quarters) are in the base painting');
    s.builtExtras = ['temple', 'herbal_gardens', 'beast_pen'].map(function (id) { return { facId: id, status: 'built' }; });
    s.builtExtras.push({ facId: 'hall_of_emissaries', status: 'building', startDay: 1, readyDay: 36 });
    t.same(R.mapOverlays(s, data).map(function (o) { return [o.pic, o.facs]; }), [
      ['map/overlays/herbal_gardens.png', ['herbal_gardens']],
      ['map/overlays/temple.png', ['temple']],
      ['map/overlays/beast_pen.png', ['beast_pen']]
    ], 'in the data\'s order; nothing for a building still being built');
    s.repairs = { herbal_gardens: s.day + 3 };
    t.same(R.mapOverlays(s, data).filter(function (o) { return o.repair; }).map(function (o) { return o.facs; }), [['herbal_gardens']], 'darkened while Under Repair');
    /* No two facilities share a picture since the overhaul; the rule still draws a shared one once. */
    var two = { bastion: Object.assign({}, T.bastion, { map: { overlays: [{ fac: 'herbal_gardens', pic: 'p.png' }, { fac: 'beast_pen', pic: 'p.png' }] } }), facilities: data.facilities };
    var shared = R.mapOverlays(s, two);
    t.equal(shared.length, 1, 'a shared picture, drawn once');
    t.same(shared[0].facs, ['herbal_gardens', 'beast_pen']);
    t.equal(shared[0].repair, true, 'darkened while either is Under Repair');
  });

  test('demolishing a facility (Harry, 13 October 2026): slot freed, its orders cancelled with no refund, level and repairs gone; starting facilities refused', function (t) {
    var s = fresh();
    s.partyLevel = 9;
    s.treasuryGP = 100;
    s.builtExtras = [{ facId: 'beast_pen', status: 'built' }, { facId: 'herbal_gardens', status: 'building', startDay: 1, readyDay: 22 }, ''];
    s.facilityLevels.beast_pen = 1;
    s.repairs = { beast_pen: 5 };
    s.pendingOrders = [
      { id: 'a', facId: 'beast_pen', fnId: 'house_beast', label: 'Beast Pen: House Beast Here (Brindle)', costGP: 0, issuedDay: 1, dueDay: 6 },
      { id: 'b', facId: 'dock', fnId: 'charter_berth', label: 'Dock: Charter a Vessel', costGP: 0, issuedDay: 1, dueDay: 6 }
    ];
    s.warehouse = [{ name: 'Religious Scriptures', qty: 1, gp: '', notes: 'Beast Pen' }];
    var r = R.demolishFacility(s, data, 'beast_pen');
    t.equal(r.ok, true);
    t.same(r.log, ['Facility Demolished', 'The Beast Pen was demolished; its slot is free. Cancelled: Beast Pen: House Beast Here (Brindle).']);
    t.same(s.builtExtras, ['', { facId: 'herbal_gardens', status: 'building', startDay: 1, readyDay: 22 }, '']);
    t.same(s.pendingOrders.map(function (o) { return o.id; }), ['b'], 'only the Beast Pen\'s order goes');
    t.equal(s.treasuryGP, 100, 'no refund (B9)');
    t.equal(s.facilityLevels.beast_pen, undefined);
    t.same(s.repairs, {});
    t.equal(s.warehouse.length, 1, 'what it made stays');
    var g = R.demolishFacility(s, data, 'herbal_gardens');
    t.same(g.log, ['Construction Stopped', 'Building work on the Herbal Gardens stopped; its slot is free.']);
    t.same(s.builtExtras, ['', '', '']);
    var b = R.demolishFacility(s, data, 'workshop');
    t.equal(b.ok, false);
    t.ok(/starting facilities/.test(b.message));
    t.equal(R.demolishFacility(s, data, 'beast_pen').ok, false, 'not built any more');
  });

  test('the starting Bastion: two facilities (the Workshop and the Dock), Day 1 (not yet set by the Explorer), level 7, 0 gp, no Party Name', function (t) {
    var s = fresh();
    t.same(R.builtFacilityIds(s, data), ['workshop', 'dock'], 'the Barracks, Armoury and Watchtower went with the war game (22 October 2026)');
    t.equal(s.v, 4, 'a save in days, with the overhauled facilities (13 October 2026) and stripped back (22 October 2026)');
    t.same([s.archivedFacilities, s.migration], [[], null]);
    t.same(['artisanTools', 'legacyFacilities'].filter(function (k) { return k in s; }), [], 'no Artisan Tools and no list of retired buildings (step S12)');
    t.equal(s.day, 1);
    t.equal(s.anchored, false);
    t.equal('turn' in s, false, 'no Bastion turn');
    t.equal(s.partyLevel, 7);
    t.equal(s.treasuryGP, 0);
    t.equal(s.partyName, '', 'no Party Name yet');
    t.same(['organization', 'clanHonor', 'trustedClientsByClan'].filter(function (k) { return k in s; }), [], 'a party can no longer found a Clan (22 October 2026): no Clan, no Clan Honour, no Trusted Clients');
    t.equal(s.dayInProgress, null);
    t.same(s.word, []);
  });

  group('Bastion: construction');

  test('the Party Quarters is a picture-only starting tile: not a facility, with its crop and overlay in the data (26 October 2026)', function (t) {
    t.equal(R.facility(data, 'party_quarters'), null);
    t.same(T.bastion.startTiles, [{ id: 'party_quarters', name: 'Party Quarters', pic: 'map/party_quarters.png', x: 1730, y: 205, w: 443, h: 309 }]);
    t.same(R.builtFacilityIds(R.defaultState(data), data), ['workshop', 'dock'], 'not counted among the facilities');
  });

  test('construction slots by party level: 0 / 2 / 4', function (t) {
    t.same([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(R.constructionSlotsForLevel), [0, 0, 2, 2, 4, 4, 4, 4, 4, 4]);
    for (var lv = 1; lv <= 20; lv++) {
      t.ok(R.constructionSlotsForLevel(lv) <= 4 && R.plotsForLevel(lv, data) <= 6, 'level ' + lv + ' never has more than four slots or six plots');
    }
    var big = JSON.parse(JSON.stringify(data));
    big.bastion.developmentPlots = [{ from: 1, plots: 9 }];
    t.equal(R.plotsForLevel(20, big), 6, 'a plot table that says more than six is held to six');
  });

  test('build times by the facility\'s level: 21 / 28 / 35 days (3 / 4 / 5 turns at 7 days a turn)', function (t) {
    t.same([0, 5, 8, 9, 13, 17].map(function (l) { return R.buildDaysForRequiredLevel(l, data); }), [0, 21, 21, 28, 35, 35]);
  });

  test('building: locked by level, no duplicates, then built on its ready day', function (t) {
    var s = fresh();
    s.day = 10;
    s.partyLevel = 7;
    R.slotRows(s, 7);
    t.equal(R.startBuild(s, data, 0, 'temple').message, 'Locked. Temple requires party level 8.');
    s.partyLevel = 9;
    R.slotRows(s, 9);
    var res = R.startBuild(s, data, 0, 'hall_of_emissaries');
    t.ok(res.ok);
    t.same(res.log, ['Construction Started', 'Hall of Emissaries is under construction (21 days: ready on Day 31).']);
    t.same(s.builtExtras[0], { facId: 'hall_of_emissaries', status: 'building', startDay: 10, readyDay: 31 });
    t.equal(R.startBuild(s, data, 1, 'hall_of_emissaries').message, 'That facility is already built or under construction.');
    /* The Wyvern Roost was the example until pull request 7 made it buildable. */
    t.equal(R.startBuild(s, data, 1, 'stone_masonworks', 'slot').ok, false, 'a Development Plot facility can\'t go in a special slot');
    t.equal(R.startBuild(s, data, 1, 'smithy').ok, false, 'the Smithy is gone');
    t.equal(R.startBuild(s, data, 1, 'workshop').message, 'That facility is already built or under construction.');
    t.equal(R.buildDaysLeft(s, s.builtExtras[0]), 21);
    s.day = 30;
    t.same(R.completeConstruction(s), [], 'Day 30: not yet');
    t.equal(R.buildDaysLeft(s, s.builtExtras[0]), 1);
    s.day = 31;
    t.same(R.completeConstruction(s), ['hall_of_emissaries']);
    t.same(s.builtExtras[0], { facId: 'hall_of_emissaries', status: 'built' });
    t.ok(R.builtFacilityIds(s, data).indexOf('hall_of_emissaries') !== -1);
  });

  test('lowering the level keeps every building, marking the extra ones over capacity (BAS-04, B8)', function (t) {
    var s = built(fresh(), ['beast_pen', 'courier_exchange', 'herbal_gardens', 'hall_of_emissaries', 'temple']);
    var rows = R.slotRows(s, 20);
    t.equal(rows.over, 1, 'five buildings in a four-slot Bastion (an old save): the fifth is over capacity');
    rows = R.slotRows(s, 9);
    t.equal(s.builtExtras.length, 5, 'nothing deleted');
    t.equal(rows.used, 5);
    t.equal(rows.over, 1);
    t.same(rows.rows.map(function (r) { return r.overCapacity; }), [false, false, false, false, true]);
    t.ok(rows.rows.every(function (r) { return !r.canBuild; }), 'no room to build');
    t.ok(R.builtFacilityIds(s, data).indexOf('temple') !== -1, 'still built and working');
    rows = R.slotRows(s, 5);
    t.equal(rows.over, 3, 'two slots at level 5: three over');
    rows = R.slotRows(s, 20);
    t.equal(rows.over, 1, 'back up: still one over (four slots at most)');
  });

  test('over capacity counts buildings, not slot positions', function (t) {
    var s = built(fresh(), ['beast_pen', '', 'courier_exchange', 'herbal_gardens', 'hall_of_emissaries']);
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
    var s = built(fresh(), ['beast_pen', '', '', '', '']);
    R.slotRows(s, 5);
    t.equal(s.builtExtras.length, 2);
    t.same(s.builtExtras[0], { facId: 'beast_pen', status: 'built' });
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

  test('cancelling keeps the gold spent (B9, kept)', function (t) {
    var s = fresh();
    s.treasuryGP = 500;
    var o = order(s, 'dock', 'charter_berth', 0);
    t.same(R.cancelOrder(s, o.id), ['Orders', 'Cancelled an order.']);
    t.equal(s.pendingOrders.length, 0);
    t.equal(s.treasuryGP, 400);
  });

  test('Workshop crafting: each staff member\'s list is made from fixed tool tables, sorted, and crafts the choice', function (t) {
    var s = fresh();
    s.facilityLevels.workshop = 2;
    var smith = R.fn(R.facility(data, 'workshop'), 'craft_smith');
    var items = R.craftItemsFor(data, smith, 2);
    t.ok(items.length > 0);
    t.same(items, items.slice().sort(function (a, b) { return a.localeCompare(b); }));
    t.equal(items.length, data.tools['Smith’s Tools'].length, 'the whole of Smith’s Tools');
    var o = order(s, 'workshop', 'craft_smith', 0);
    t.equal(o.optionLabel, items[0]);
    t.equal(o.label, 'Workshop: Smith - ' + items[0]);
    var lines = R.completeSimpleOrder(s, data, o, dice([0.3]));
    t.same(lines, [['Order Completed', o.label + ' → Crafted: ' + items[0] + '.']]);
    t.equal(s.warehouse[0].item, items[0]);
    t.equal(s.warehouse[0].notes, 'Workshop');
  });

  test('orders complete on their day or any later one (BAS-13)', function (t) {
    var s = fresh();
    s.pendingOrders = [{ id: 'a', dueDay: 2 }, { id: 'b', dueDay: 4 }, { id: 'c', dueDay: 3 }];
    s.day = 3;
    t.same(R.dueOrders(s).map(function (o) { return o.id; }), ['a', 'c']);
    t.same(R.dueOrders(s, ['a']).map(function (o) { return o.id; }), ['c'], 'skipped today');
  });

  test('every order has its days: the two starting facilities and the Dock\'s Register Port Charter; the Hall has none', function (t) {
    var days = function (facId, fnId) { return R.fn(R.facility(data, facId), fnId).days; };
    t.same([days('workshop', 'craft'), days('workshop', 'craft_magic_item'), days('dock', 'charter_berth')], [3, 10, 7]);
    t.equal(days('dock', 'register_port_charter'), 3);
    t.same(R.facility(data, 'hall_of_emissaries').functions, [], 'the Hall has no orders (step S09)');
    data.facilities.forEach(function (f) { f.functions.forEach(function (fn) { t.ok(fn.days >= 1, f.id + ' ' + fn.id + ' has days'); }); });
  });

  group('Bastion: completing orders');

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

  test('Scholar research notes still don\'t attach (B16, kept)', function (t) {
    var s = fresh();
    s.treasuryGP = 100;
    s.facilityLevels.workshop = 3;
    var o = order(s, 'workshop', 'research', 0);
    t.equal(o.optionLabel, 'Geographical Scriptures');
    t.equal(o.label, 'Workshop: Scholar - Research (Geographical Scriptures)');
    t.equal(o.notes, '');
    R.completeSimpleOrder(s, data, o, dice([0.1]));
    t.equal(s.warehouse[0].notes, 'Workshop');
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

  group('Bastion: passing a day');

  test('a day\'s steps: the day moves on and building is finished, then the trade, the orders and the finish, with word from the Ironbow', function (t) {
    var s = built(fresh(), []);
    s.day = 20;
    s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'building', startDay: 0, readyDay: 21 }];
    R.startDay(s, data, 1);
    t.equal(s.day, 21);
    t.equal(s.treasuryGP, 0, 'no contract pays a shipment: the Hall has none (step S09)');
    t.same([s.dayInProgress.day, s.dayInProgress.stage, s.dayInProgress.skipped], [21, 'trade', []]);
    t.equal('attackRolled' in s.dayInProgress, false, 'no attack roll any more (the war game is gone)');
    t.same(s.builtExtras[0], { facId: 'hall_of_emissaries', status: 'built' });
    R.finishRoutes(s);
    t.equal(s.dayInProgress.stage, 'orders');
    R.finishDay(s);
    t.equal(s.dayInProgress, null);
    t.equal(s.log, undefined, 'no Day Log is kept (S18)');
    t.same(s.word, [{ day: 21, lines: ['The Hall of Emissaries is built.'] }]);
  });

  test('a quiet day adds no word', function (t) {
    var s = fresh();
    s.day = 3;
    R.startDay(s, data);
    R.finishRoutes(s);
    R.finishDay(s);
    t.equal(s.day, 4);
    t.same(s.word, []);
    t.equal(s.log, undefined);
  });

  test('no Bastion event comes any more: Day 29, 57 and 85 pass like any other day, the state holds no event, and the event rules are gone (S05)', function (t) {
    ['rollEvent', 'resolveEvent', 'isEventDay', 'nextEventDay'].forEach(function (name) { t.equal(typeof R[name], 'undefined', name + ' is gone'); });
    t.equal('eventEvery' in R.time(data), false, 'no every-28-days setting');
    t.equal('lastEvent' in fresh() || 'lastEventDay' in fresh(), false, 'a new Bastion holds no event record');
    var s = fresh();
    [28, 56, 84].forEach(function (before) {
      s.day = before;
      R.startDay(s, data);
      R.finishRoutes(s);
      R.finishDay(s);
      t.equal(s.day, before + 1);
      t.equal(s.log, undefined, 'nothing logged on Day ' + s.day);
      t.same(s.word, [], 'no word on Day ' + s.day);
      t.equal('lastEvent' in s || 'lastEventDay' in s, false, 'no event record on Day ' + s.day);
    });
    s.day = 28;
    R.startDay(s, data);
    R.finishRoutes(s);
    var real = Math.random;
    var rolled = 0;
    Math.random = function () { rolled++; return real(); };
    try { R.finishDay(s); } finally { Math.random = real; }
    t.equal(rolled, 0, 'finishing a day rolls nothing');
  });

  test('a skipped order stays due and comes up the next day', function (t) {
    var s = fresh();
    s.pendingOrders = [{ id: 'w', facId: 'dock', fnId: 'charter_berth', label: 'Dock: Charter Berth', dueDay: 2 }];
    R.startDay(s, data);
    t.equal(R.dueOrders(s, s.dayInProgress.skipped).length, 1);
    R.skipOrder(s, 'w');
    t.equal(R.dueOrders(s, s.dayInProgress.skipped).length, 0);
    t.equal(R.dueOrders(s).length, 1, 'still due (Resolve)');
    R.finishDay(s);
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
    s.dayInProgress = { day: 9, stage: 'orders', skipped: [], news: [] };
    t.same(R.clockAction(s, 4), { kind: 'pass', days: 0 }, 'a day part-way through is finished first');
  });

  test('moving the Bastion by days (Reset Travel): everything due keeps its distance; history stays', function (t) {
    var s = fresh();
    s.day = 30;
    s.anchored = true;
    s.pendingOrders = [{ id: 'o', issuedDay: 28, dueDay: 33 }];
    s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'building', startDay: 20, readyDay: 41 }];
    s.legacyDiplomacy = { records: [{ kind: 'Trade Agreement', title: 'Trade Agreement', clan: 'Clan Karr', startDay: 26, endDay: 47, endedDay: 29, income: 10, shipments: 3, paid: 30, note: '' }] };
    s.repairs = { workshop: 35 };
    s.legacyLog = [{ title: 'x', body: 'y', day: 29 }];
    R.shiftDays(s, -29);
    t.equal(s.day, 1);
    t.same([s.pendingOrders[0].dueDay, s.builtExtras[0].readyDay, s.legacyDiplomacy.records[0].endDay, s.legacyDiplomacy.records[0].startDay, s.legacyDiplomacy.records[0].endedDay, s.repairs.workshop], [4, 12, 18, -3, 0, 6], 'the Hall\'s old agreements, kept as history, move with the days too');
    t.equal(s.legacyLog[0].day, 29, 'the old log is history');
    t.equal(R.dayLabel(-9), 'before Day 1');
    t.equal(R.dayLabel(4), 'Day 4');
  });

  test('which way each order completes', function (t) {
    t.equal(R.orderKind(data, { facId: 'war_council' }), 'none', 'the War Council is gone (S06)');
    t.equal(R.orderKind(data, { facId: 'dock', fnId: 'register_port_charter' }), 'simple');
    t.equal(R.orderKind(data, { facId: 'workshop', fnId: 'upgrade', meta: { kind: 'upgrade' } }), 'simple');
    t.equal(R.orderKind(data, { facId: 'nowhere', fnId: 'x' }), 'none');
    t.equal(R.orderKind(data, { facId: 'trade_network', fnId: 'upgrade' }), 'none', 'the Trade Network\'s investments and the Hall\'s actions are gone: such an order is cancelled when the Bastion is converted');
    t.equal(R.orderKind(data, { facId: 'hall_of_emissaries', fnId: 'host_delegation' }), 'none');
  });

  group('Bastion: Clan support is gone');

  test('support: the Clan Influence panel and its number went (S10)', function (t) {
    t.equal(R.supportForClanKey, undefined, 'R.supportForClanKey went with the Clan Influence panel');
    ['canFormClan', 'totalSupport', 'clansAtSupport', 'orgLabel', 'requirementsHint', 'formerBrigade', 'canFormMerc'].forEach(function (k) {
      t.equal(R[k], undefined, 'R.' + k + ' went with founding a Clan (22 October 2026)');
    });
    t.equal(data.bastion.identityRules, undefined, 'and so did its numbers');
  });

  test('the old Day Log as text: the newest 25 entries, newest first; nothing when empty (S10)', function (t) {
    var s = fresh();
    t.equal(R.oldLogText(s, 25), '');
    s.legacyLog = [];
    for (var i = 1; i <= 30; i++) s.legacyLog.unshift({ title: 'Entry ' + i, body: 'Body ' + i, at: 1000 * i, day: null });
    t.equal(R.log, undefined, 'R.log is gone (S18)');
    var text = R.oldLogText(s, 25);
    t.ok(text.indexOf('Entry 30') > -1 && text.indexOf('Entry 6') > -1, 'newest 25 are in');
    t.ok(text.indexOf('Entry 5\n') === -1 && text.indexOf('· Entry 5') === -1, 'older ones are left out');
    t.ok(text.indexOf('Entry 30') < text.indexOf('Entry 29'), 'newest first');
    t.ok(text.indexOf('the newest 25 of 30') > -1);
  });

  group('Bastion: the crest, and the War Table\'s saves (ignored since 22 October 2026)');

  test('a crest is a picture record; anything else is refused on import (the War Table\'s saves are not checked any more: Strip Back, 22 October 2026)', function (t) {
    var good = { dataUrl: 'data:image/webp;base64,AAAA', key: R.hashText('data:image/webp;base64,AAAA'), name: 'crest.png' };
    t.ok(R.isCrest(good));
    t.ok(!R.isCrest({ dataUrl: 'http://example.com/x.png', key: 'k' }));
    t.ok(!R.isCrest({ dataUrl: 'data:text/html,hi', key: 'k' }));
    t.ok(!R.isCrest('data:image/png;base64,AAAA'));
    t.equal(R.importProblem([{ key: 'tsi.bastion.crest', value: good }]), null);
    t.ok(/crest picture/.test(R.importProblem([{ key: 'tsi.bastion.crest', value: { dataUrl: 'x' } }])));
    t.equal(R.importProblem([{ key: 'tsi.bastion.warMap', value: { dataUrl: 'nope', key: 1 } }]), null, 'a damaged battle map is ignored, so an old backup is never refused for it');
    t.equal(R.importProblem([{ key: 'tsi.bastion.warTable', value: 'x' }]), null, 'and so are the War Table\'s settings');
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

  group('Bastion: the Compendium');

  test('the Compendium index, its links, Roll20 and the offline export (B15)', function (t) {
    var idx = R.compendiumIndex(data.facilities, data.tools);
    t.ok(idx.links['Bag of Holding'].some(function (l) { return l.facName === 'Workshop' && l.fnLabel === 'Craft Uncommon'; }), 'Bag of Holding is made by the Alchemist (Craft Uncommon)');
    t.ok(idx.links['Dread Helm'].every(function (l) { return l.fnLabel === 'Compendium only'; }), 'Dread Helm, Moon-Touched Sword and Smoldering Armor stay in the Compendium only');
    t.ok(idx.links['Longsword'].some(function (l) { return l.fnLabel === 'Craft (Smith)'; }), 'the Smith crafts a Longsword');
    t.equal(idx.items.indexOf('Potion of Climbing') !== -1 && idx.links['Potion of Climbing'].every(function (l) { return l.fnLabel !== 'Craft Common'; }), true, 'the duplicate potion is not offered twice by the Alchemist');
    t.equal(R.roll20Url('Bag of Holding'), 'https://roll20.net/compendium/dnd5e/Bag%20of%20Holding');
    var out = R.compendiumExport(idx, T.bastionCompendium.items);
    t.equal(out.filled, 0);
    t.equal(out.kept + out.stubbed, idx.items.length, 'every item is either kept or stubbed');
    t.equal(out.kept, idx.items.filter(function (k) { var e = T.bastionCompendium.items[k]; return e && String(e.summary || '').trim(); }).length, 'the kept ones are the items whose entry has a summary');
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
    s.treasuryGP = 150;
    t.equal(R.getFacilityLevel(s, 'workshop'), 1);
    t.same(R.upgradeCheck(s, data, 'workshop'), { ok: true, toLevel: 2, days: 7, costGP: 0 });
    var r = R.issueUpgrade(s, data, 'workshop', dice([0.3]));
    t.equal(r.ok, true);
    t.same(r.log, ['Order Issued', 'Workshop: Upgrade to Level 2 (7 days: due Day 17).']);
    var o = s.pendingOrders[0];
    t.same([o.facId, o.fnId, o.label, o.costGP, o.issuedDay, o.dueDay, o.meta], ['workshop', 'upgrade', 'Workshop: Upgrade to Level 2', 0, 10, 17, { kind: 'upgrade', toLevel: 2 }]);
    t.equal(s.treasuryGP, 150, 'no gold');
    t.equal(R.orderKind(data, o), 'simple');
    t.ok(/already being upgraded: ready on Day 17/.test(R.issueUpgrade(s, data, 'workshop', dice([0.3])).message), 'one at a time');
    t.ok(R.issueOrder(s, data, 'dock', 'charter_berth', 0, dice([0.3])).ok, 'its other orders carry on');
    t.same(R.completeSimpleOrder(s, data, o, dice([0.3])), [['Order Completed', 'Workshop: Upgrade to Level 2 → The Workshop is now Level 2.']]);
    t.equal(R.getFacilityLevel(s, 'workshop'), 2);
    R.removeOrder(s, o.id);
    s.facilityLevels.workshop = 4;
    t.same(R.upgradeCheck(s, data, 'workshop'), { ok: true, toLevel: 5, days: 28, costGP: 0 });
    s.facilityLevels.workshop = 5;
    t.same(R.upgradeCheck(s, data, 'workshop'), { ok: false, top: true, message: 'The Workshop is at its highest level (5).' });
    s.facilityLevels.workshop = 9;
    t.equal(R.getFacilityLevel(s, 'workshop'), 5, 'never above 5');
  });

  test('no upgrading while Under Repair (D6); an upgrade already running waits for the repairs, like any order; not for a facility that isn\'t built', function (t) {
    var s = fresh();
    s.day = 10;
    R.issueUpgrade(s, data, 'dock', dice([0.3]));
    s.repairs = { dock: 20, workshop: 12 };
    t.same(R.issueUpgrade(s, data, 'workshop', dice([0.3])), { ok: false, message: 'The Workshop is Under Repair until Day 12.' });
    s.day = 17;
    t.same(R.dueOrders(s).map(function (x) { return x.facId; }), [], 'the Dock\'s upgrade waits for its repairs');
    s.day = 21;
    t.same(R.dueOrders(s).map(function (x) { return x.facId; }), ['dock']);
    t.equal(R.upgradeCheck(s, data, 'beast_pen').message, 'The Beast Pen isn\'t built yet.');
    s.builtExtras = [{ facId: 'beast_pen', status: 'building', startDay: 1, readyDay: 22 }];
    t.equal(R.upgradeCheck(s, data, 'beast_pen').ok, false, 'not while it\'s being built');
  });

  test('levels survive saving, demolishing drops one, and an upgrade order is an ordinary pending order (cancel, demolish)', function (t) {
    var s = built(fresh(), ['timber_sawmill']);
    s.facilityLevels.timber_sawmill = 3;
    s.facilityLevels.workshop = 5;
    R.issueUpgrade(s, data, 'timber_sawmill', dice([0.3]));
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
    t.same([back.facilityLevels.timber_sawmill, back.facilityLevels.workshop, back.pendingOrders[0].meta], [3, 5, { kind: 'upgrade', toLevel: 4 }]);
    var d = R.demolishFacility(back, data, 'timber_sawmill');
    t.same(d.cancelled.map(function (o) { return o.label; }), ['Timber Yard & Sawmill: Upgrade to Level 4']);
    t.equal(back.facilityLevels.timber_sawmill, undefined);
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
    t.equal(R.researchTree(data, 'workshop'), null, 'only the Herbal Gardens has a tree so far');
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
    t.equal(R.researchCheck(s, data, 'herbal_gardens', 'medicine', 'fortifying_draughts').message, 'Not available yet: it needs the Explorer tracking each hero\'s conditions, which it does not do. Nothing was spent.');
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
    t.equal(s.log, undefined, 'no Day Log entry is written any more (S18)');
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
    t.same(back.repairs, {}, 'a version 3 Bastion\'s repairs are cleared when it is converted: only a lost battle in the war game ever caused one (S06)');
    t.same(back.pendingOrders.map(function (o) { return o.id; }), ['g'], 'the order stays');
    var v4 = R.toSave(back);
    v4.repairs = { herbal_gardens: 20, nowhere: 7 };
    t.same(R.fromSave(JSON.parse(JSON.stringify(v4)), data).repairs, { herbal_gardens: 20 }, 'a version 4 save keeps a repair of a real facility (an unknown facility\'s is dropped)');
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
    t.same(R.fnAvailable(R.fromSave(s, data), workshop, smithing), { ok: false, hidden: true, message: 'That order isn\'t given any more.' }, 'Smithing is retired (step S12): never offered, though a pending one still finishes');
    var building = R.migrateToV3(v2(function (b) { b.builtExtras = [{ facId: 'smithy', status: 'building', startDay: 4, readyDay: 25 }]; }), data);
    t.same([slots(building.save), building.save.legacyFacilities], [[''], []], 'no Smithing for a Smithy never finished');
    t.equal(building.lines[0], 'Building work on the Smithy stopped: it has joined the Workshop. Its slot is free.');
    t.same(R.fnAvailable(fresh(), workshop, smithing), { ok: false, hidden: true, message: 'That order isn\'t given any more.' }, 'a new Bastion doesn\'t see Smithing');
  });

  test('the Gaming Hall goes (Harry, D2): built or building, its slot is freed, its Trade order cancelled, and it is recorded as archived', function (t) {
    var res = R.migrateToV3(v2(function (b) {
      b.builtExtras = [{ facId: 'gaming_hall', status: 'built' }, ''];
      b.facilityLevels.gaming_hall = 1;
      b.repairs = { gaming_hall: 20 };
      b.pendingOrders = [{ id: 'gh', facId: 'gaming_hall', fnId: 'trade', label: 'Gaming Hall: Trade', costGP: 0, issuedDay: 10, dueDay: 17 }, { id: 'k', facId: 'dock', fnId: 'charter_berth', label: 'Dock: Charter Berth', costGP: 0, issuedDay: 10, dueDay: 15 }];
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
    t.same(s.log, raw.log, 'an old Day Log is left exactly as it was (history); no entry is added (S18)');
    t.same(slots(s), ['hall_of_emissaries', 'war_room', 'library_scriptorium']);
  });

  test('converted once: loading again changes nothing, and a Bastion with nothing to convert has no notice', function (t) {
    var raw = v2(function (b) { b.builtExtras = [{ facId: 'library', status: 'built' }, { facId: 'gaming_hall', status: 'built' }]; });
    var once = R.fromSave(raw, data);
    t.equal(once.v, 4, 'a version 2 save is now taken on to version 4 in one go (Strip Back, 22 October 2026)');
    var twice = R.fromSave(JSON.parse(JSON.stringify(R.toSave(once))), data);
    t.same(twice, once, 'a v 3 save is loaded as it is');
    t.same(R.migrateToV3(R.toSave(once), data), { save: R.toSave(once), lines: [] }, 'and isn\'t converted again');
    t.equal(once.log, undefined, 'no Day Log is kept in a loaded Bastion (S18)');
    var plain = R.fromSave(v2(function (b) { b.builtExtras = [{ facId: 'shrine_aurush', status: 'built' }]; }), data);
    t.same(plain.migration.v3, { day: 12, lines: [], shown: true }, 'nothing changed: no notice');
    t.same(slots(plain), ['temple'], 'a Shrine in a version 2 save is the Temple once the Strip Back conversion has run (22 October 2026)');
  });

  test('new orders: Greenhouse Harvest needs party level 9 (Alchemy has no party level since step S12, only the Alchemist\'s Workshop level); a plot facility can\'t go in a special slot', function (t) {
    var s = built(fresh(), ['herbal_gardens']);
    s.treasuryGP = 1000;
    s.partyLevel = 8;
    s.facilityLevels.workshop = 4;
    var ws = R.facility(data, 'workshop');
    t.same(R.fnAvailable(s, ws, R.fn(ws, 'alchemy')), { ok: true }, 'no party level gate on Alchemy');
    t.ok(R.issueOrder(s, data, 'workshop', 'alchemy', 0, dice([0.3])).ok);
    t.equal(R.issueOrder(s, data, 'herbal_gardens', 'cultivate', 0, dice([0.3])).message, 'Needs party level 9.');
    t.ok(R.issueOrder(s, data, 'herbal_gardens', 'harvest', 0, dice([0.3])).ok);
    s.partyLevel = 9;
    t.ok(R.issueOrder(s, data, 'herbal_gardens', 'cultivate', 0, dice([0.3])).ok);
    t.equal(R.issueOrder(s, data, 'workshop', 'smithing', 0, dice([0.3])).ok, false, 'no Smithing without the old Smithy');
    s.partyLevel = 20;
    R.slotRows(s, 20);
    /* The three creature buildings left this list in pull request 7 (creatures.test.js builds them). */
    /* The Stone Quarry and the Weavers' Hall left it too (19 October 2026): nothing is in development now. */
    t.same(data.facilities.filter(function (f) { return f.inDevelopment; }).map(function (f) { return f.id; }), []);
    ['fishery_smokehouse', 'timber_sawmill', 'courier_exchange'].forEach(function (id) {
      var r = R.startBuild(s, data, 2, id, 'slot');
      t.equal(r.ok, false, id + ' refused in a special slot');
      t.ok([0, 1, 2].some(function (i) { return R.startBuild(s, data, i, id, 'plot').ok; }), id + ' builds on a Development Plot');
    });
  });

  group('Bastion: the Stone Quarry and the Weavers\' Hall (19 October 2026)');
  function stoneStock(level, id, goods) {
    var s = plots(9, [id]);
    s.facilityLevels[id] = level;
    s.warehouse = [];
    s.pendingOrders = [];
    stock(s, goods);
    return s;
  }
  test('both are plain Timber Yard-style trade facilities: Level 5, a Development Plot, one production order at a time, no gold, each level replacing the last, no goods needed', function (t) {
    ['stone_masonworks', 'weavers_hall'].forEach(function (id) {
      var f = R.facility(data, id);
      t.same([f.requiredLevel, f.plot, f.productionLimit, f.levelOrders, !!f.inDevelopment], [5, true, 1, 'replace', false], id);
      t.same(f.functions.map(function (fn) { return [fn.days, fn.requiredFacilityLevel, fn.costGP]; }), [[4, 1, 0], [4, 2, 0], [5, 3, 0], [7, 4, 0], [9, 5, 0], [8, 5, 0]], id);
      f.functions.forEach(function (fn) {
        fn.options.forEach(function (o) {
          t.equal(o.inputs, undefined, id + ' ' + fn.id + ' takes nothing from the Warehouse (Strip Back Overhaul, S04: orders are self-contained)');
          o.outputs.forEach(function (x) { t.ok(T.bastionGoods.goods.some(function (g) { return g.id === x.good; }), id + ' makes a real good: ' + x.good); });
        });
      });
    });
    t.same(R.facility(data, 'stone_masonworks').functions.map(function (fn) { return fn.label; }),
      ['Extract Raw Stone', 'Produce Dressed Stone', 'Produce Structural Masonry', 'Produce Decorative Stonework', 'Bulk Raw Stone Extraction', 'Bulk Stone Processing']);
    t.same(R.facility(data, 'weavers_hall').functions.map(function (fn) { return fn.label; }),
      ['Produce Ordinary Textiles', 'Produce Sailcloth', 'Produce Specialist Garments', 'Improved Specialist Garment Production', 'Bulk Textile Production', 'Bulk Sailcloth Production']);
  });
  test('they build on a Development Plot, not a special slot, at party level 5', function (t) {
    var s = built(fresh(), []);
    s.partyLevel = 9; s.day = 10; R.ensureLevels(s, data);
    ['stone_masonworks', 'weavers_hall'].forEach(function (id) {
      t.equal(R.startBuild(s, data, 0, id, 'slot').ok, false, id + ' refused in a special slot');
    });
    t.ok(R.startBuild(s, data, 0, 'stone_masonworks', 'plot').ok);
  });
  test('every Stone order works on its own: with an empty Warehouse the Level 2 order starts and takes nothing; one production order at a time', function (t) {
    var s = stoneStock(2, 'stone_masonworks', []);
    var r = R.issueOrder(s, data, 'stone_masonworks', 'produce_dressed_stone', 0, dice([0.3]));
    t.equal(r.ok, true, r.message);
    t.same(r.log, ['Order Issued', 'Stone Quarry & Masonworks: Produce Dressed Stone (4 days: due Day 14).'], 'no "Taken from the Warehouse" part');
    t.equal(s.pendingOrders[0].inputs, undefined, 'it holds nothing');
    t.equal(s.warehouse.length, 0, 'the Warehouse was not touched');
    t.equal(R.issueOrder(s, data, 'stone_masonworks', 'produce_dressed_stone', 0, dice([0.3])).ok, false, 'one production order at a time');
    s = stoneStock(2, 'stone_masonworks', [['raw_stone', 2]]);
    t.equal(R.issueOrder(s, data, 'stone_masonworks', 'produce_dressed_stone', 0, dice([0.3])).ok, true);
    t.equal(R.goodsQty(s, 'raw_stone'), 2, 'goods already in the Warehouse are left alone, not used up');
  });
  test('a finished order puts real, counted goods in the Warehouse and uses nothing up (bulk processing: 3 dressed; improved garments: 2 garments)', function (t) {
    var s = stoneStock(5, 'stone_masonworks', []);
    t.equal(R.issueOrder(s, data, 'stone_masonworks', 'bulk_stone_processing', 0, dice([0.3])).ok, true, 'an empty Warehouse is enough');
    var o = s.pendingOrders[0];
    t.equal(o.dueDay, s.day + 8);
    finish(s, o);
    t.same([R.goodsQty(s, 'raw_stone'), R.goodsQty(s, 'dressed_stone')], [0, 3]);
    var w = stoneStock(4, 'weavers_hall', []);
    t.equal(R.issueOrder(w, data, 'weavers_hall', 'improved_specialist_garment_production', 0, dice([0.3])).ok, true);
    t.equal(w.pendingOrders[0].dueDay, w.day + 7);
    finish(w, w.pendingOrders[0]);
    t.same([R.goodsQty(w, 'ordinary_textiles'), R.goodsQty(w, 'specialist_garments')], [0, 2]);
  });
  test('upgrade levels replace the orders: Weavers\' Level 1 order is gone at Level 2, and the Level 2 order is refused until then', function (t) {
    var s = stoneStock(1, 'weavers_hall', []);
    t.equal(R.issueOrder(s, data, 'weavers_hall', 'produce_sailcloth', 0, dice([0.3])).message, 'That order belongs to Level 2.');
    s.facilityLevels.weavers_hall = 2;
    t.equal(R.issueOrder(s, data, 'weavers_hall', 'produce_ordinary_textiles', 0, dice([0.3])).message, 'That order belongs to Level 1.', 'Level 1\'s order is replaced');
    t.equal(R.issueOrder(s, data, 'weavers_hall', 'produce_sailcloth', 0, dice([0.3])).ok, true, 'with an empty Warehouse');
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
    t.equal(R.startBuild(s, data, 0, 'hall_of_emissaries', 'plot').message, 'The Hall of Emissaries is built in a construction slot, not on a Development Plot.');
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
    var s = built(fresh(), ['hall_of_emissaries', 'herbal_gardens']);
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
    var save = R.toSave(plots(9, ['hall_of_emissaries', 'herbal_gardens']));
    var back = R.fromSave(JSON.parse(JSON.stringify(save)), data);
    t.same(back.builtPlots, ['', { facId: 'herbal_gardens', status: 'built' }]);
    t.ok(back.builtExtras.some(function (x) { return x && x.facId === 'hall_of_emissaries'; }), 'the Hall of Emissaries is kept, in a slot');
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

  test('the goods catalogue: 17 trade goods in lots, 4 ingredients in portions, 2 supplies (packs, and since pull request 6 Overland charts); every good an order names is in it', function (t) {
    var g = R.goodsList(data);
    var kinds = {};
    g.forEach(function (x) { kinds[x.kind] = (kinds[x.kind] || 0) + 1; });
    t.same(kinds, { cargo: 17, ingredient: 4, supply: 9 }, 'since pull request 8b, the Shrines\' seven items too');
    t.same([R.goodsAmountText(data, 'overland_chart', 1), R.goodsAmountText(data, 'overland_chart', 3), R.goodsCountText(data, 'overland_chart', 2), R.goodsCountText(data, 'expedition_provision_pack', 2)],
      ['1 Overland chart', '3 Overland charts', '2 charts', '2 packs'], 'a chart is counted in charts');
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

  test('the Timber Yard: each level offers only its own order (it replaces the last); one production order at a time, even across an upgrade; nothing is taken from the Warehouse', function (t) {
    var s = plots(9, ['timber_sawmill']);
    t.equal(R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3])).message, 'That order belongs to Level 2.');
    var r = R.issueOrder(s, data, 'timber_sawmill', 'harvest_timber', 0, dice([0.3]));
    t.same(r.log, ['Order Issued', 'Timber Yard & Sawmill: Harvest Timber (4 days: due Day 14).']);
    t.equal(R.issueUpgrade(s, data, 'timber_sawmill', dice([0.7])).ok, true, 'an upgrade isn\'t a production order');
    var up = s.pendingOrders.filter(function (x) { return x.fnId === 'upgrade'; })[0];
    /* The upgrade completes while Harvest Timber is still pending: Level 2, so Harvest Timber is replaced... */
    finish(s, up);
    t.equal(R.getFacilityLevel(s, 'timber_sawmill'), 2);
    t.equal(R.issueOrder(s, data, 'timber_sawmill', 'harvest_timber', 0, dice([0.3])).message, 'That order belongs to Level 1.');
    /* ...but the order already running still counts, and still finishes. */
    t.equal(R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3])).message, 'The Timber Yard & Sawmill is busy: one production order at a time (Timber Yard & Sawmill: Harvest Timber, due on Day 14).');
    var o = s.pendingOrders.filter(function (x) { return x.fnId === 'harvest_timber'; })[0];
    t.same(finish(s, o), [['Order Completed', 'Timber Yard & Sawmill: Harvest Timber → Added to Warehouse: 1 lot of Raw Timber.']]);
    t.equal(R.goodsQty(s, 'raw_timber'), 1);
    r = R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3]));
    t.same(r.log, ['Order Issued', 'Timber Yard & Sawmill: Saw Lumber (4 days: due Day 14).'], 'no "Taken from the Warehouse"');
    o = s.pendingOrders.filter(function (x) { return x.fnId === 'saw_lumber'; })[0];
    t.equal(o.inputs, undefined);
    finish(s, o);
    t.same([R.goodsQty(s, 'raw_timber'), R.goodsQty(s, 'sawn_lumber')], [1, 1], 'the Raw Timber is left alone');
  });

  test('cancelling gives held goods back once; demolishing gives them back; an order whose facility is gone gives them back (the Herbal Gardens still uses goods)', function (t) {
    var s = stock(plots(9, ['herbal_gardens']), [['restorative_herbs', 10]]);
    s.facilityLevels.herbal_gardens = 3;
    var r = R.issueOrder(s, data, 'herbal_gardens', 'field_medical_supplies', 1, dice([0.3]));
    t.equal(r.ok, true, r.message);
    t.equal(R.goodsQty(s, 'restorative_herbs'), 0, 'taken when it begins');
    var id = s.pendingOrders[0].id;
    var back = R.cancelOrder(s, id, data, 10);
    t.equal(back[0], 'Orders');
    t.ok(/10 portions of Restorative Herbs went back to the Warehouse\.$/.test(back[1]), back[1]);
    t.same(R.cancelOrder(s, id, data, 10), ['Orders', 'Cancelled an order.'], 'a second Cancel gives nothing');
    t.equal(R.goodsQty(s, 'restorative_herbs'), 10);
    R.issueOrder(s, data, 'herbal_gardens', 'field_medical_supplies', 1, dice([0.3]));
    var d = R.demolishFacility(s, data, 'herbal_gardens');
    t.ok(/^The Herbal Gardens was demolished; its plot is free\. Cancelled: .*10 portions of Restorative Herbs went back to the Warehouse\.$/.test(d.log[1]), d.log[1]);
    t.equal(R.goodsQty(s, 'restorative_herbs'), 10);
    var lost = { id: 'x', facId: 'old_mill', fnId: 'grind', label: 'Old Mill: Grind', inputs: [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 2 }], dueDay: 10 };
    t.equal(R.orderKind(data, lost), 'none');
    t.same(R.dropOrderGoods(s, data, lost), [['Orders', 'Old Mill: Grind couldn\'t be completed (its facility or order no longer exists). 2 lots of Raw Timber went back to the Warehouse.']]);
    t.equal(R.goodsQty(s, 'raw_timber'), 2);
    t.equal(R.dropOrderGoods(s, data, { id: 'y', facId: 'old_mill' }), null, 'nothing held, nothing said');
  });

  test('the Timber Yard: Cancel after the upgrade gives nothing extra back (no goods were held) and frees the slot for the new level\'s order', function (t) {
    var s = plots(9, ['timber_sawmill']);
    order(s, 'timber_sawmill', 'harvest_timber', 0);
    s.facilityLevels.timber_sawmill = 2;
    var held = JSON.stringify(s.warehouse);
    t.equal(R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3])).ok, false, 'busy while Harvest Timber is pending');
    t.same(R.cancelOrder(s, s.pendingOrders[0].id, data, 10), ['Orders', 'Cancelled an order.'], 'nothing came back');
    t.equal(JSON.stringify(s.warehouse), held, 'the Warehouse is as it was');
    t.equal(R.issueOrder(s, data, 'timber_sawmill', 'saw_lumber', 0, dice([0.3])).ok, true, 'the slot is free');
  });

  test('the Fishery: each level\'s order on its own (fish, smoked fish, provision packs); Level 5\'s two bulk orders make three and use nothing', function (t) {
    var s = plots(9, ['fishery_smokehouse']);
    s.facilityLevels.fishery_smokehouse = 3;
    finish(s, order(s, 'fishery_smokehouse', 'prepare_expedition_provisions', 0));
    t.same([R.goodsQty(s, 'preserved_fish'), R.goodsQty(s, 'expedition_provision_pack')], [0, 5], 'five packs from an empty Warehouse');
    s.facilityLevels.fishery_smokehouse = 5;
    t.equal(R.issueOrder(s, data, 'fishery_smokehouse', 'prepare_expedition_provisions', 0, dice([0.3])).message, 'That order belongs to Level 3.');
    finish(s, order(s, 'fishery_smokehouse', 'commercial_fishing_fleet', 0));
    t.equal(R.goodsQty(s, 'fresh_fish'), 3);
    var o = order(s, 'fishery_smokehouse', 'bulk_smokehouse_production', 0);
    t.equal(o.dueDay, 17, '7 days');
    finish(s, o);
    t.same([R.goodsQty(s, 'fresh_fish'), R.goodsQty(s, 'preserved_fish')], [3, 3], 'the Fresh Fish is not used up');
  });

  test('the Scholar (Harry, 14 October 2026 for the Library; moved to the Workshop at Level 3 by step S12): Prepare Overland Travel Charts makes 1 Overland chart in 4 days, no gold; the Scholar does one job at a time, so Research waits', function (t) {
    var s = fresh();
    s.day = 10;
    t.equal(R.issueOrder(s, data, 'workshop', 'prepare_overland_travel_charts', 0, dice([0.3])).message, 'Needs Level 3.');
    s.facilityLevels.workshop = 3;
    var gp = s.treasuryGP;
    var o = order(s, 'workshop', 'prepare_overland_travel_charts', 0);
    t.same([o.dueDay, s.treasuryGP, o.label], [14, gp, 'Workshop: Scholar - Prepare Overland Travel Charts']);
    t.equal(R.issueOrder(s, data, 'workshop', 'prepare_overland_travel_charts', 0, dice([0.3])).ok, false, 'one chart order at a time');
    var busy = R.issueOrder(s, data, 'workshop', 'research', 0, dice([0.3]));
    t.same([busy.ok, busy.message], [false, 'The Scholar is busy: Workshop: Scholar - Prepare Overland Travel Charts, due on Day 14.'], 'one job at a time for each staff member');
    t.same(finish(s, o), [['Order Completed', 'Workshop: Scholar - Prepare Overland Travel Charts → Added to Warehouse: 1 Overland chart.']]);
    t.same([R.goodsQty(s, 'overland_chart'), s.treasuryGP], [1, gp], 'one chart, no gold');
    t.ok(order(s, 'workshop', 'research', 0), 'then the Scholar can research');
    t.same(R.fn(R.facility(data, 'workshop'), 'research').options.map(function (x) { return x.label; }),
      ['Geographical Scriptures', 'Religious Scriptures', 'Combat Scriptures', 'Political scriptures'], 'the scripture choices are unchanged');
  });

  /* Pull request 8b (Harry's Shrine specification, 15 October 2026), changed by the Strip Back Overhaul (22 October 2026): the Shrines are
     one Temple, whose blessings happen at once (tests/rules/temple.test.js). What stays here is an order carried over from a Shrine. */
  test('an order carried over from a Shrine completes at the Temple: a Great Rite waits at the Ironbow, once; a Blessing of Pelagos is held for the Dock; both survive a reload', function (t) {
    var s = plots(17, [], ['temple']);
    s.favour = { telluria: 0, aurush: 30, pelagos: 25 };
    function carried(id, fnId) {
      var fn = R.fn(R.facility(data, 'temple'), fnId);
      var o = { id: id, facId: 'temple', fnId: fnId, chosen: null, optionLabel: null, notes: '', label: 'Temple: ' + fn.label, costGP: 0, issuedDay: 10, dueDay: 17, favourCost: 25 };
      s.pendingOrders.push(o);
      return o;
    }
    var o = carried('o1', 'great_rite_aurush');
    t.same(R.completeSimpleOrder(s, data, o, dice([0.3])), [['Order Completed', 'Temple: Great Rite of Aurush → Cleansing Radiance waits at the Ironbow until the DM gives it to the party on an expedition.']]);
    R.completeSimpleOrder(s, data, o, dice([0.3]));
    t.same(s.greatRites, [{ id: 'rite-' + o.id, rite: 'cleansing_radiance', god: 'aurush', madeDay: 10, status: 'waiting' }], 'once, however often it completes');
    R.removeOrder(s, o.id);
    var b = carried('o2', 'bless_commercial_shipment');
    t.same(finish(s, b), [['Order Completed', 'Temple: Bless Commercial Shipment → A Blessing of Pelagos waits for the next ship the Dock sends with cargo (1 held).']]);
    t.same(s.tradeNetwork.protections, { pelagos_blessing: { charges: 1 } });
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
    t.same([back.greatRites, back.tradeNetwork.protections], [s.greatRites, s.tradeNetwork.protections]);
    t.same(R.fromSave(JSON.parse(JSON.stringify(R.toSave(back))), data).greatRites, back.greatRites, 'loading twice changes nothing');
    t.same(R.cleanGreatRites([{ id: 'x', rite: 'dragons_breath' }, 'y', { id: 'rite-1', rite: 'tides_passage', madeDay: 3 }, { id: 'rite-1', rite: 'tides_passage' }]), [{ id: 'rite-1', rite: 'tides_passage', god: 'pelagos', madeDay: 3, status: 'waiting' }]);
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
    t.equal(R.researchChoiceState(s, data, 'herbal_gardens', 'botanical', 'exotic_flora_conservatory'), 'unreachable', 'Stage III waits for a Stage II choice (both still "coming"): a question for Harry');
  });

  test('the map labels: one per built facility with a position, with its level; a plot facility is labelled; positions are on the painting', function (t) {
    var s = fresh();
    t.same(R.mapLabels(s, data).map(function (l) { return [l.fac, l.level]; }), [['workshop', 1], ['dock', 1]], 'the two starting facilities (the Barracks, Armoury and Watchtower went with the war game)');
    s = plots(9, ['herbal_gardens'], ['hall_of_emissaries', 'beast_pen']);
    s.builtExtras.push({ facId: 'temple', status: 'building', startDay: 1, readyDay: 30 });
    s.facilityLevels.workshop = 3;
    var ids = R.mapLabels(s, data).map(function (l) { return l.fac; });
    t.ok(ids.indexOf('herbal_gardens') !== -1 && ids.indexOf('hall_of_emissaries') !== -1);
    t.equal(ids.indexOf('temple'), -1, 'not while being built');
    t.equal(R.mapLabels(s, data).filter(function (l) { return l.fac === 'workshop'; })[0].level, 3);
    var at = data.bastion.mapLabels;
    Object.keys(at).forEach(function (id) {
      t.ok(R.facility(data, id), id);
      t.ok(at[id].x >= 0 && at[id].x <= data.bastion.map.width && at[id].y >= 0 && at[id].y <= data.bastion.map.height, id + ' on the painting');
    });
  });

  group('Bastion: saving');

  test('a save and reload keeps the Party Name, the Hall\'s old agreements as history, the day, a day in progress and word not yet shown (BAS-01)', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.day = 12;
    s.anchored = true;
    s.partyName = 'The Ironbow Company';
    s.honourRespectByClan.karr = -3;
    s.legacyDiplomacy = { records: [{ kind: 'Trade Agreement', title: 'Trade Agreement', clan: 'Clan Karr', startDay: 5, endDay: 26, endedDay: 12, income: 90, shipments: 2, paid: 180, note: '' }] };
    s.diplomacy.tokens = 2;
    s.dayInProgress = { day: 12, stage: 'orders', skipped: ['x'], news: ['The Smithy is built.'] };
    s.word = [{ day: 11, lines: ['Dock: Charter Berth → Added to Warehouse.'] }];
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

  test('the war game\'s fields in an old file are ignored, even damaged ones: they neither refuse the file nor survive loading (S06)', function (t) {
    var save = R.toSave(fresh());
    save.defenders = 'x';
    save.defenderBeasts = 7;
    save.military = { nonsense: true };
    save.militaryActions = 'x';
    save.warMissions = [1];
    save.warRecovery = 'y';
    save.wars = 3;
    save.warLog = 'z';
    save.repairs = 'broken';
    t.equal(R.saveProblem(save), null, 'still a good save');
    t.equal(R.importProblem([{ key: 'tsi.bastion.state', value: save }]), null, 'and it imports');
    var back = R.fromSave(JSON.parse(JSON.stringify(save)), data);
    ['defenders', 'defenderBeasts', 'military', 'militaryActions', 'warMissions', 'warMissionSeq', 'warRecovery', 'wars', 'warLog'].forEach(function (k) { t.equal(k in back, false, k + ' is not kept'); });
    t.same(back.repairs, {}, 'a damaged repairs list comes back empty');
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
    t.same(back.dayInProgress, { day: 2, stage: 'orders', skipped: [], news: [] });
  });

  /* What the screen remembers (tsi.bastion.ui) since the new screen (Build 2). */
  test('the screen remembers only whether the grid is open (and the Warehouse\'s Sort); the old panels\' settings and the war pop-ups seen go', function (t) {
    t.same(R.cleanUi(null), { gridOpen: true });
    t.same(R.cleanUi({}), { gridOpen: true });
    t.same(R.cleanUi({ collapsed: { war: true, diplomacy: true } }), { gridOpen: true }, 'the old panels\' open-or-closed settings');
    t.same(R.cleanUi({ gridOpen: false, warNoticed: { 'ma-1': true }, junk: 3 }), { gridOpen: false }, 'the war pop-ups seen went with the war (22 October 2026)');
    t.same(R.cleanUi({ gridOpen: 'no', warNoticed: [1] }), { gridOpen: true }, 'nonsense is ignored');
  });

}());
