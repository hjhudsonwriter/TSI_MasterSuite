/* The Ironbow Bastion Manager: tools/bastion/rules.js and its data */
(function () {
  var R = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents };

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

  group('Bastion: content');

  test('18 facilities, 12 tool tables (9 can be artisan tools), 11 events, 7 clans, 270 compendium items (271 entries)', function (t) {
    t.equal(data.facilities.length, 18);
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

  test('every facility has a picture, and the eight overlays belong to real facilities', function (t) {
    data.facilities.forEach(function (f) { t.ok(T.bastion.facilityImages[f.id], f.id + ' picture'); });
    T.bastion.overlays.forEach(function (id) { t.ok(R.facility(data, id), id); });
    t.equal(T.bastion.overlays.length, 8);
  });

  test('the starting Bastion: five facilities, Day 1 (not yet set by the Explorer), level 7, 0 gp, unsworn', function (t) {
    var s = fresh();
    t.same(R.builtFacilityIds(s, data), ['barracks', 'armoury', 'watchtower', 'workshop', 'dock']);
    t.equal(s.v, 2, 'a save in days');
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
    var res = R.startBuild(s, data, 0, 'library');
    t.ok(res.ok);
    t.same(res.log, ['Construction Started', 'Library is under construction (21 days: ready on Day 31).']);
    t.same(s.builtExtras[0], { facId: 'library', status: 'building', startDay: 10, readyDay: 31 });
    t.equal(R.startBuild(s, data, 1, 'library').message, 'That facility is already built or under construction.');
    t.equal(R.startBuild(s, data, 1, 'barracks').message, 'That facility is already built or under construction.');
    t.equal(R.buildDaysLeft(s, s.builtExtras[0]), 21);
    s.day = 30;
    t.same(R.completeConstruction(s), [], 'Day 30: not yet');
    t.equal(R.buildDaysLeft(s, s.builtExtras[0]), 1);
    s.day = 31;
    t.same(R.completeConstruction(s), ['library']);
    t.same(s.builtExtras[0], { facId: 'library', status: 'built' });
    t.ok(R.builtFacilityIds(s, data).indexOf('library') !== -1);
  });

  test('lowering the level keeps every building, marking the extra ones over capacity (BAS-04, B8)', function (t) {
    var s = built(fresh(), ['library', 'smithy', 'garden', 'laboratory', 'greenhouse']);
    var rows = R.slotRows(s, 13);
    t.equal(rows.over, 0);
    rows = R.slotRows(s, 9);
    t.equal(s.builtExtras.length, 5, 'nothing deleted');
    t.equal(rows.used, 5);
    t.equal(rows.over, 1);
    t.same(rows.rows.map(function (r) { return r.overCapacity; }), [false, false, false, false, true]);
    t.ok(rows.rows.every(function (r) { return !r.canBuild; }), 'no room to build');
    t.ok(R.builtFacilityIds(s, data).indexOf('greenhouse') !== -1, 'still built and working');
    rows = R.slotRows(s, 13);
    t.equal(rows.over, 0, 'back up: nothing over');
  });

  test('over capacity counts buildings, not slot positions', function (t) {
    var s = built(fresh(), ['library', '', 'smithy', 'garden', 'laboratory']);
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
    var s = built(fresh(), ['library', '', '', '', '']);
    R.slotRows(s, 5);
    t.equal(s.builtExtras.length, 2);
    t.same(s.builtExtras[0], { facId: 'library', status: 'built' });
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
    R.completeSimpleOrder(s, data, { facId: 'garden', fnId: 'harvest', optionLabel: 'Potion of Healing', label: 'G' }, dice([0.1]));
    R.completeSimpleOrder(s, data, { facId: 'garden', fnId: 'harvest', optionLabel: 'potion of healing', label: 'G' }, dice([0.1]));
    t.equal(s.warehouse.length, 1);
    t.equal(s.warehouse[0].qty, 2);
    t.equal(s.warehouse[0].notes, 'Garden');
    R.completeSimpleOrder(s, data, { facId: 'dock', fnId: 'charter_berth', optionLabel: 'Keelboat', label: 'D' }, dice([0.1]));
    t.equal(s.warehouse[1].item, 'Keelboat');
    t.equal(s.warehouse[1].notes, 'Dock');
  });

  test('Library research notes still don\'t attach (B16, kept)', function (t) {
    var s = fresh();
    s.treasuryGP = 100;
    var o = order(s, 'library', 'research', 0);
    t.equal(o.optionLabel, 'Geographical Scriptures');
    t.equal(o.notes, '');
    R.completeSimpleOrder(s, data, o, dice([0.1]));
    t.equal(s.warehouse[0].notes, 'Library');
  });

  test('Hall upgrades are free and stop at level 3 (B4, kept)', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.treasuryGP = 100;
    order(s, 'hall_of_emissaries', 'upgrade_hall', 0);
    t.equal(s.treasuryGP, 100);
    var fn = R.fn(R.facility(data, 'hall_of_emissaries'), 'upgrade_hall');
    t.same(R.upgradeHall(s, fn), ['Upgrade', 'Hall of Emissaries upgraded to Level 2.']);
    t.same(R.upgradeHall(s, fn), ['Upgrade', 'Hall of Emissaries upgraded to Level 3.']);
    t.same(R.upgradeHall(s, fn), ['Upgrade', 'Hall of Emissaries is already max level.']);
    t.equal(R.diplomacyModForHall(s), 6);
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
    s.builtExtras = [{ facId: 'library', status: 'building', startDay: 0, readyDay: 21 }];
    s.diplomacy.agreements = [{ title: 'Trade Agreement', clan: 'Clan Karr', startDay: 14, endDay: 21, income: 100, lastShipmentDay: 14 }];
    s.lastEvent = { name: 'Guest' };
    R.startDay(s, data, 1);
    t.equal(s.day, 21);
    t.equal(s.treasuryGP, 100, 'the last shipment');
    t.equal(s.diplomacy.agreements.length, 0, 'the agreement ran out');
    t.same([s.dayInProgress.day, s.dayInProgress.stage, s.dayInProgress.skipped, s.dayInProgress.attackRolled], [21, 'trade', [], false]);
    t.same(s.builtExtras[0], { facId: 'library', status: 'built' });
    R.finishRoutes(s);
    t.equal(s.dayInProgress.stage, 'orders');
    t.same(s.lastEvent, { name: 'Guest' }, 'the last event stays until the next');
    R.finishDay(s, data, data.events, dice([0.5]), 1);
    t.equal(s.dayInProgress, null);
    t.same(titles(s), ['Diplomacy', 'Diplomacy', 'Construction Complete']);
    t.ok(s.log.every(function (l) { return l.day === 21; }), 'each log line has its day');
    t.same(s.word, [{ day: 21, lines: ['The Library is built.', 'Your Trade Agreement with Clan Karr has ended (its last shipment arrived).'] }]);
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
    s.builtExtras = [{ facId: 'library', status: 'building', startDay: 20, readyDay: 41 }];
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

  test('forming a Mercenary Brigade: level 7 and 3 defenders', function (t) {
    var s = fresh();
    s.defenders.count = 3;
    t.ok(R.canFormMerc(s, data).ok);
    s.partyLevel = 6;
    t.equal(R.canFormMerc(s, data).lvlOk, false);
    s.partyLevel = 7;
    s.defenders.count = 2;
    t.equal(R.canFormMerc(s, data).defOk, false);
    t.equal(R.requirementsHint(s, data), 'Clan requirements: Level 9+ (NO), Total Support 360+ (NO), 3 clans at 55+ (NO).  Merc requirements: Level 7+ (OK), 3+ defenders (NO).');
  });

  group('Bastion: war');

  test('what can be committed; the unsworn only send defenders and beasts', function (t) {
    var s = fresh();
    s.defenders.count = 5;
    s.defenderBeasts = [{ name: 'Ape', qty: 2 }];
    s.military = [{ name: 'Lieutenant (1)', qty: 2 }, { name: 'Regiment (100)', qty: 1 }];
    t.same(R.warAvailable(s), { defenders: 5, beasts: 2, lieutenants: 2, regiments: 1, fullWar: false }, 'beasts counted by number, not by row (BAS-25 fixed)');
    t.same(R.warCommit(s, { defenders: '9', beasts: '3', lieutenants: '2', regiments: '1' }), { commitDefenders: 5, commitBeasts: 2, commitLieutenants: 0, commitRegiments: 0 });
    s.organization.type = 'clan';
    t.same(R.warCommit(s, { defenders: '', beasts: '0', lieutenants: '2', regiments: '5' }), { commitDefenders: 0, commitBeasts: 0, commitLieutenants: 2, commitRegiments: 1 });
  });

  test('a raid: DC 14, the modifier from what\'s committed, and the results', function (t) {
    var s = fresh();
    s.organization.type = 'clan';
    s.treasuryGP = 20;
    s.defenders.count = 4;
    s.defenderBeasts = [{ name: 'Ape', qty: 1 }];
    R.queueWarAction(s, { objective: 'raid', targetKey: 'bacca', targetName: 'Bacca', commitDefenders: 4, commitBeasts: 1, commitLieutenants: 2, commitRegiments: 1 }, dice([0.3]));
    var o = s.pendingOrders[0];
    t.equal(o.dueDay, 4, 'musters 3 days later');
    var plan = R.warPlan(s, data, o);
    t.same([plan.dc, plan.mod, plan.title], [14, 4, 'War Action: RAID vs Bacca']);
    R.resolveWar(s, data, plan, roll(5, 9), dice([0.3]), 0);
    t.same([s.treasuryGP, s.politicalCapital.bacca, s.defenders.count, s.defenderBeasts.length, s.clanHonor], [0, 8, 3, 0, 32]);
    t.equal(s.warLog[0].title, 'Failure: RAID vs Bacca');
    t.ok(/Casualties: defenders 1; beasts 1/.test(s.warLog[0].details));
  });

  test('a Brigade\'s war changes its clients\' trust', function (t) {
    var s = fresh();
    s.organization.type = 'merc';
    var plan = R.warPlan(s, data, { meta: { objective: 'defend', targetKey: 'karr', commitDefenders: 2 } });
    t.equal(plan.dc, 12);
    R.resolveWar(s, data, plan, roll(15, 16), dice([0.3]), 0);
    t.same([s.trustedClientsByClan.karr, s.trustedClientsByClan.bacca, s.politicalCapital.karr], [42, 51, 6]);
  });

  test('five Giant Vultures are five beasts, and a lost battle costs one of them, not all five (BAS-25)', function (t) {
    var s = fresh();
    s.defenders.count = 3;
    s.defenderBeasts = [{ name: 'Ape', qty: 1 }, { name: 'Giant Vulture', qty: 5 }];
    t.equal(R.beastQty(s), 6);
    t.equal(R.warAvailable(s).beasts, 6);
    t.equal(R.warCommit(s, { defenders: '0', beasts: '5' }).commitBeasts, 5);
    var plan = R.warPlan(s, data, { meta: { objective: 'raid', targetKey: 'bacca', commitDefenders: 3, commitBeasts: 5 } });
    t.equal(plan.mod, 1 + 2, 'the modifier still counts at most 2 beasts');
    R.resolveWar(s, data, plan, roll(2, 5), dice([0.3]), 0);
    t.same(s.defenderBeasts, [{ name: 'Ape', qty: 1 }, { name: 'Giant Vulture', qty: 4 }]);
    t.ok(/Casualties: defenders 1; beasts 1/.test(s.warLog[0].details));
  });

  test('losing beasts takes them one at a time from the end of the list', function (t) {
    var s = fresh();
    s.defenderBeasts = [{ name: 'Ape', qty: 2 }, { name: 'Giant Vulture', qty: 1 }, { name: 'Wolf' }];
    R.removeBeasts(s, 3);
    t.same(s.defenderBeasts, [{ name: 'Ape', qty: 1 }]);
    R.removeBeasts(s, 5);
    t.same(s.defenderBeasts, []);
  });

  test('the beast lost in a war roll is one that marched (the first in the list), never one left at home', function (t) {
    var s = fresh();
    s.defenders.count = 3;
    s.defenderBeasts = [{ name: 'Giant Vulture', qty: 5 }, { name: 'Ape', qty: 2 }];
    var plan = R.warPlan(s, data, { meta: { objective: 'raid', targetKey: 'bacca', commitDefenders: 3, commitBeasts: 5 } });
    R.resolveWar(s, data, plan, roll(1, 4), dice([0.3]), 0);
    t.same(s.defenderBeasts, [{ name: 'Giant Vulture', qty: 4 }, { name: 'Ape', qty: 2 }], 'the Apes stayed at home');
    s.defenderBeasts = [{ name: 'Giant Vulture', qty: 1 }, { name: 'Ape', qty: 2 }];
    R.removeBeasts(s, 1, 2);
    t.same(s.defenderBeasts, [{ name: 'Giant Vulture', qty: 1 }, { name: 'Ape', qty: 1 }]);
    R.removeBeasts(s, 1, 9);
    t.same(s.defenderBeasts, [{ name: 'Giant Vulture', qty: 1 }], 'more committed than are left: the last one goes');
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
    R.queueWarAction(s, Object.assign({ objective: 'raid', targetKey: 'bacca', targetName: 'Bacca', commitDefenders: 6, commitBeasts: 3, commitLieutenants: 1, commitRegiments: 2 }, extra || {}), dice([0.3]));
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
    t.ok(idx.links['Bag of Holding'].some(function (l) { return l.facName === 'Arcane Study'; }));
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
    R.queueWarAction(s, { objective: 'defend', targetKey: 'karr', targetName: 'Karr', commitDefenders: 4, commitBeasts: 5, commitLieutenants: 0, commitRegiments: 0 }, dice([0.3]));
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
