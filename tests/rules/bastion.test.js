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

  test('18 facilities, 12 tool tables (9 can be artisan tools), 11 events, 7 clans, 265 compendium items', function (t) {
    t.equal(data.facilities.length, 18);
    t.equal(Object.keys(data.tools).length, 12);
    t.equal(R.toolTableNames(data.tools).length, 9);
    t.equal(data.events.eventTable.length, 11);
    t.same(T.bastion.clans.map(function (c) { return c.name; }), ['Blackstone', 'Bacca', 'Farmer', 'Slade', 'Molten', 'Rowthorn', 'Karr']);
    t.equal(R.compendiumIndex(data.facilities, data.tools).items.length, 265);
    t.equal(Object.keys(T.bastionCompendium.items).length, 265);
  });

  test('every facility has a picture, and the eight overlays belong to real facilities', function (t) {
    data.facilities.forEach(function (f) { t.ok(T.bastion.facilityImages[f.id], f.id + ' picture'); });
    T.bastion.overlays.forEach(function (id) { t.ok(R.facility(data, id), id); });
    t.equal(T.bastion.overlays.length, 8);
  });

  test('the starting Bastion: five facilities, turn 1, level 7, 0 gp, unsworn', function (t) {
    var s = fresh();
    t.same(R.builtFacilityIds(s, data), ['barracks', 'armoury', 'watchtower', 'workshop', 'dock']);
    t.equal(s.turn, 1);
    t.equal(s.partyLevel, 7);
    t.equal(s.treasuryGP, 0);
    t.equal(s.organization.type, 'unsworn');
    t.equal(s.clanHonor, 40);
    t.equal(s.trustedClientsByClan.karr, 50);
    t.equal(s.artisanTools.length, 6);
    t.equal(s.turnInProgress, null);
  });

  group('Bastion: construction');

  test('construction slots by party level: 0 / 2 / 4 / 5 / 6', function (t) {
    t.same([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(R.constructionSlotsForLevel), [0, 0, 2, 2, 4, 4, 5, 5, 6, 6]);
  });

  test('build times by the facility\'s level: 3 / 4 / 5 turns', function (t) {
    t.same([0, 5, 8, 9, 13, 17].map(R.buildTurnsForRequiredLevel), [0, 3, 3, 4, 5, 5]);
  });

  test('building: locked by level, no duplicates, then ticks down to built', function (t) {
    var s = fresh();
    s.partyLevel = 9;
    R.slotRows(s, 9);
    t.equal(R.startBuild(s, data, 0, 'menagerie').message, 'Locked. Menagerie requires party level 13.');
    var res = R.startBuild(s, data, 0, 'library');
    t.ok(res.ok);
    t.same(res.log, ['Construction Started', 'Library is under construction (3 turns).']);
    t.equal(R.startBuild(s, data, 1, 'library').message, 'That facility is already built or under construction.');
    t.equal(R.startBuild(s, data, 1, 'barracks').message, 'That facility is already built or under construction.');
    t.same(R.tickConstruction(s), []);
    t.same(R.tickConstruction(s), []);
    t.same(R.tickConstruction(s), ['library']);
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

  test('an order charges its gold once and completes next turn', function (t) {
    var s = fresh();
    s.treasuryGP = 500;
    var o = order(s, 'dock', 'charter_berth', 1);
    t.equal(s.treasuryGP, 300, 'Longship 200gp');
    t.equal(o.label, 'Dock: Charter Berth (Longship)');
    t.equal(o.completeTurn, 2);
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
    s.diplomacy.summits.push({ title: 'Inter-Clan Summit', turnsLeft: 2, costReductionPct: 25 });
    order(s, 'hall_of_emissaries', 'secure_trade_agreement', 0, { targetClan: '' });
    t.equal(s.treasuryGP, 1000 - 187);
  });

  test('orders complete on their turn or any later one (BAS-13)', function (t) {
    var s = fresh();
    s.pendingOrders = [{ id: 'a', completeTurn: 2 }, { id: 'b', completeTurn: 4 }, { id: 'c', completeTurn: 3 }];
    s.turn = 3;
    t.same(R.dueOrders(s).map(function (o) { return o.id; }), ['a', 'c']);
    t.same(R.dueOrders(s, ['a']).map(function (o) { return o.id; }), ['c'], 'skipped this turn');
  });

  group('Bastion: completing orders');

  test('Barracks: 1d4 defenders; Watchtower: patrol; Armoury: armed', function (t) {
    var s = fresh();
    var o = { facId: 'barracks', fnId: 'recruit_defenders', label: 'Barracks: Recruit Defenders' };
    t.same(R.completeSimpleOrder(s, data, o, dice([0.99])), [['Order Completed', 'Barracks: Recruit Defenders → Recruited 4 defenders.']]);
    t.equal(s.defenders.count, 4);
    R.completeSimpleOrder(s, data, { facId: 'watchtower', fnId: 'patrol', label: 'x' }, dice([0.1]));
    t.ok(s.defenders.patrolAdvantage);
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
    R.setCooldown(s, 'host_delegation', 2);
    t.equal(R.emissaryPlan(s, data, hd).blocked, 2);
  });

  test('a Trade Agreement: income, duration and Political Capital by tier', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.treasuryGP = 5000;
    var o = order(s, 'hall_of_emissaries', 'secure_trade_agreement', 0, { targetClan: 'Clan Blackstone' });
    var p = R.emissaryPlan(s, data, o);
    var res = R.applyEmissary(s, data, o, p, { main: roll(12, 14) }, dice([0.5, 0, 0]));
    t.equal(res.tier, 'success');
    t.same(s.diplomacy.agreements.map(function (a) { return [a.title, a.clan, a.turnsLeft, a.incomePerTurn]; }), [['Trade Agreement', 'Clan Blackstone', 4, 100]]);
    t.equal(s.politicalCapital.blackstone, 8);
    t.equal(s.warehouse[0].item, 'Trade Agreement Contract');
    t.equal(res.summary, 'Terms are acceptable. The contract is sealed.');
    t.same(res.changes, ['Political Capital: +8 (Clan Blackstone)', 'New record: Trade Agreement (4 turns)', 'Income: +100 gp/turn']);
    t.equal(res.log[0], 'Order Resolved');
  });

  test('a bad failure: no deal, −20 Political Capital, 2-turn cooldown', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.treasuryGP = 5000;
    var o = order(s, 'hall_of_emissaries', 'secure_trade_agreement', 0, { targetClan: 'Clan Blackstone' });
    var res = R.applyEmissary(s, data, o, R.emissaryPlan(s, data, o), { main: roll(5, 7) }, dice([0.5]));
    t.equal(res.tier, 'bad_failure');
    t.equal(s.diplomacy.agreements.length, 0);
    t.equal(s.politicalCapital.blackstone, -20);
    t.equal(R.cooldownLeft(s, 'trade_agreement'), 2);
    t.equal(res.summary, 'Negotiations sour. Ink never touches parchment.');
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
    t.equal(s.diplomacy.delegations[0].turnsLeft, 4, 'the first roll still sets the length (2 + 2)');
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
    t.same([s.diplomacy.summits[0].costReductionPct, s.diplomacy.summits[0].turnsLeft], [30, 4]);
    t.equal(s.warehouse[0].item, 'Summit Charter');
  });

  test('a Trade Consortium opens the network and a route for its clan', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.facilityLevels.hall_of_emissaries = 3;
    s.treasuryGP = 1000;
    var o = order(s, 'hall_of_emissaries', 'trade_consortium', 1, { targetClan: 'Karr' });
    t.equal(o.label, 'Hall of Emissaries: Trade Consortium (Karr)');
    R.applyEmissary(s, data, o, R.emissaryPlan(s, data, o), { main: roll(15, 21) }, dice([0.5]));
    t.ok(s.tradeNetwork.active);
    var r = s.tradeNetwork.routes[0];
    t.same([r.clan, r.commodity, r.risk, r.expiresTurn, r.status], ['Karr', 'Wool & Furs', 'high', 6, 'active']);
    t.equal(r.yieldGP, s.diplomacy.consortiums[0].incomePerTurn);
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

  group('Bastion: Advance Bastion Turn');

  test('the steps in the old order: turn and income, construction and resets, then the finish', function (t) {
    var s = built(fresh(), []);
    s.builtExtras = [{ facId: 'library', status: 'building', remaining: 1 }];
    s.diplomacy.agreements = [{ title: 'Trade Agreement', clan: 'Clan Karr', turnsLeft: 1, incomePerTurn: 100 }];
    s.lastEvent = { name: 'Guest' };
    s.defenders.patrolAdvantage = true;
    R.startTurn(s, 1);
    t.equal(s.turn, 2);
    t.equal(s.treasuryGP, 100);
    t.equal(s.diplomacy.agreements.length, 0, 'the agreement ran out');
    t.same(s.turnInProgress, { turn: 2, stage: 'trade', skipped: [] });
    R.tickTurn(s, data, 1);
    t.equal(s.turnInProgress.stage, 'orders');
    t.equal(s.lastEvent, null);
    t.equal(s.defenders.patrolAdvantage, false);
    t.equal(s.log[0].body, 'Library is now built and active.');
    R.finishTurn(s, data.events, dice([0.5]), 1);
    t.equal(s.turnInProgress, null);
    t.same(titles(s), ['Turn Advanced', 'Construction Complete', 'Diplomacy']);
    t.equal(s.lastEvent, null, 'no event on turn 2');
  });

  test('every 4th turn rolls a Bastion event', function (t) {
    var s = fresh();
    s.turn = 3;
    R.startTurn(s);
    R.tickTurn(s, data);
    R.finishTurn(s, data.events, dice([0.995]));
    t.equal(s.lastEvent.name, 'Treasure');
    t.equal(s.log[1].body, 'Auto event (Turn 4) → Rolled 100 → Treasure');
  });

  test('a skipped order stays pending and comes up next turn', function (t) {
    var s = fresh();
    s.pendingOrders = [{ id: 'w', facId: 'war_council', completeTurn: 2, meta: { kind: 'war_action' } }];
    R.startTurn(s);
    t.equal(R.dueOrders(s, s.turnInProgress.skipped).length, 1);
    R.skipOrder(s, 'w');
    t.equal(R.dueOrders(s, s.turnInProgress.skipped).length, 0);
    R.finishTurn(s, data.events, dice([0.1]));
    R.startTurn(s);
    t.equal(R.dueOrders(s, s.turnInProgress.skipped).length, 1);
  });

  test('which way each order completes', function (t) {
    t.equal(R.orderKind(data, { facId: 'trade_network' }), 'network');
    t.equal(R.orderKind(data, { facId: 'war_council' }), 'war');
    t.equal(R.orderKind(data, { facId: 'hall_of_emissaries', fnId: 'host_delegation' }), 'emissary');
    t.equal(R.orderKind(data, { facId: 'hall_of_emissaries', fnId: 'upgrade_hall' }), 'simple');
    t.equal(R.orderKind(data, { facId: 'nowhere', fnId: 'x' }), 'none');
  });

  test('diplomacy each turn: contracts count down, routes expire with their consortium, cooldowns tick', function (t) {
    var s = fresh();
    s.diplomacy.consortiums = [{ clan: 'Karr', turnsLeft: 1, incomePerTurn: 50 }];
    s.tradeNetwork.routes = [{ id: 'r', clan: 'Karr', status: 'active', expiresTurn: 9 }];
    s.diplomacy.cooldowns = { summit: 2 };
    var logs = R.tickDiplomacy(s);
    t.same(logs, [['Diplomacy', 'Contract income received: +50 gp.']]);
    t.equal(s.tradeNetwork.routes[0].status, 'expired');
    t.same(s.diplomacy.cooldowns, { summit: 1 });
  });

  group('Bastion: trade routes');

  function network(routes) {
    var s = fresh();
    s.turn = 5;
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

  test('each route pays at most once a turn, even after a cancelled roll (BAS-05, BAS-11)', function (t) {
    var s = network([{ id: 'a', clan: 'Blackstone', risk: 'low', yieldGP: 100, status: 'active' }, { id: 'b', clan: 'Karr', risk: 'high', yieldGP: 200, status: 'active' }]);
    t.ok(R.routesDueThisTurn(s));
    t.equal(R.routeNeedsRoll(s, s.tradeNetwork.routes[0]), false);
    t.equal(R.routeNeedsRoll(s, s.tradeNetwork.routes[1]), true);
    var out = R.settleRoute(s, data, s.tradeNetwork.routes[0], null, dice([0.1]));
    t.equal(out.gained, 100);
    /* The Karr roll is cancelled here: nothing more happens. Resolving again only offers Karr. */
    t.same(R.routesToSettle(s).map(function (r) { return r.id; }), ['b']);
    R.settleRoute(s, data, s.tradeNetwork.routes[1], roll(15, 15), dice([0.1]));
    t.equal(s.treasuryGP, 300);
    t.same(R.routesToSettle(s), []);
    R.finishRoutes(s);
    t.equal(R.routesDueThisTurn(s), false);
    s.turn = 6;
    t.equal(R.routesToSettle(s).length, 2, 'next turn they pay again');
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
    t.same([d.a, d.b, d.meta.routeClan, d.meta.commodity, d.meta.disruptedTurn, d.meta.stabilityAtFiling], ['Karr', 'Ironbow Trade Consortium', 'Karr', 'Wool & Furs', 5, 65]);
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
    t.equal(o.completeTurn, 2);
    var plan = R.warPlan(s, data, o);
    t.same([plan.dc, plan.mod, plan.title], [14, 4, 'War Turn: RAID vs Bacca']);
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

  test('the beast lost in a war is one that marched: the War Table\'s last-named, never one left at home', function (t) {
    var s = fresh();
    s.defenders.count = 3;
    s.defenderBeasts = [{ name: 'Giant Vulture', qty: 5 }, { name: 'Ape', qty: 2 }];
    t.same(R.militaryForces(s, data, { defenders: 0, beasts: 5, lieutenants: 0, regiments: 0 }).map(function (f) { return f.label; }).slice(-1), ['Giant Vulture 5']);
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
    s.organization = { type: 'clan', name: 'Clan Ironbow', chief: '', motto: '', foundedAtTurn: 1 };
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
    t.same([b.ma.step, b.ma.objective, b.ma.targetName, b.ma.turn], ['weather', 'raid', 'Bacca', 1]);
    t.same(b.ma.commit, { defenders: 6, beasts: 3, lieutenants: 1, regiments: 2 });
    t.same(b.ma.deployment, { started: false, locked: false, positions: {} });
    t.equal(b.s.log[0].body, 'RAID vs Bacca: your forces muster for battle. The Military Action is ready to begin.');
    t.equal(R.militaryCommitLine(b.ma.commit), '6 defenders, 3 beasts, 1 Lieutenant, 2 Regiments');
  });

  test('one token per Regiment, one block of defenders, one per Lieutenant and one per beast, named from the Menagerie', function (t) {
    var b = begun();
    t.same(b.ma.forces, [
      { id: 'reg-1', kind: 'regiment', label: 'Regiment 1', sub: '100 soldiers' },
      { id: 'reg-2', kind: 'regiment', label: 'Regiment 2', sub: '100 soldiers' },
      { id: 'def', kind: 'defenders', label: 'Bastion Defenders', count: 6 },
      { id: 'lt-1', kind: 'lieutenant', label: 'Lieutenant 1', short: 'L1' },
      { id: 'beast-1', kind: 'beast', label: 'Giant Vulture 1', short: 'GV1' },
      { id: 'beast-2', kind: 'beast', label: 'Giant Vulture 2', short: 'GV2' },
      { id: 'beast-3', kind: 'beast', label: 'Giant Vulture 3', short: 'GV3' }
    ]);
    var s = fresh();
    s.defenderBeasts = [{ name: 'Ape', qty: 1 }, { name: 'Giant Vulture', qty: 2 }];
    t.same(R.militaryForces(s, data, { defenders: 0, beasts: 2, lieutenants: 0, regiments: 0 }).map(function (f) { return f.label; }), ['Ape', 'Giant Vulture']);
    t.same([R.forceInitials('Giant Vulture'), R.forceInitials('ape'), R.forceInitials('Dire Wolf Alpha'), R.forceInitials('')], ['GV', 'Ap', 'DA', '?']);
    s.defenderBeasts = [{ name: 'Giant Vulture', qty: 11 }];
    t.same(R.militaryForces(s, data, { defenders: 0, beasts: 11, lieutenants: 0, regiments: 0 }).map(function (f) { return f.short; }).slice(8), ['GV9', 'G10', 'G11'], 'each one can be told apart on the War Table');
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

  test('deployment is saved only while deploying; unknown tokens are dropped; Start Battle moves on to the battle', function (t) {
    var b = begun();
    t.equal(R.militaryDeploy(b.s, b.ma.id, { started: true, positions: {} }), false, 'not before the rolls');
    b = rolled(15, 15, 15);
    t.ok(R.militaryDeploy(b.s, b.ma.id, { started: true, locked: false, positions: { 'reg-1': { x: 0.5, y: 0.7 }, 'ghost': { x: 0.5, y: 0.5 }, 'def': { x: 2, y: -1 }, 'lt-1': { x: 'a', y: 0.6 } } }));
    t.same(b.ma.deployment, { started: true, locked: false, positions: { 'reg-1': { x: 0.5, y: 0.7 }, 'def': { x: 1, y: 0 } } });
    t.equal(R.militaryStatus(b.ma), 'Deploying on the War Table.');
    R.militaryDeploy(b.s, b.ma.id, { started: false, locked: true, positions: {} });
    t.equal(b.ma.step, 'deploy', 'it can\'t be locked before deployment began');
    R.militaryDeploy(b.s, b.ma.id, { started: true, locked: true, positions: { 'reg-1': { x: 0.4, y: 0.8 } } });
    t.same([b.ma.step, b.ma.deployment.locked], ['resolve', true]);
    t.equal(R.militaryDeploy(b.s, b.ma.id, { started: true, locked: false, positions: {} }), false, 'locked stays locked');
  });

  test('after Start Battle the war\'s single roll settles it, with Luck on the roll and the three rolls in the war log, once', function (t) {
    var b = rolled(5, 18, 9, 0.5);
    t.equal(R.finishMilitaryAction(b.s, data, b.ma.id, roll(13, 13), dice([0.3]), 0), null, 'not before Start Battle');
    R.militaryDeploy(b.s, b.ma.id, { started: true, locked: true, positions: { 'reg-1': { x: 0.5, y: 0.6 }, 'def': { x: 0.5, y: 0.8 } } });
    var plan = R.militaryPlan(b.s, data, b.ma);
    t.same([plan.dc, plan.mod, plan.luck], [14, 3 + 2 + 1 - 1, -1], 'defenders +3, beasts +2, Lieutenant and Regiments +1, Luck −1');
    var line = R.finishMilitaryAction(b.s, data, b.ma.id, roll(8, 8 + plan.mod), dice([0.3]), 0);
    t.same(line, ['War Turn Resolved', 'Failure: RAID vs Bacca']);
    t.same(b.s.militaryActions, []);
    var w = b.s.warLog[0];
    t.ok(/Roll: d20 8 \+ mod 5 = 13 vs DC 14/.test(w.details), w.details);
    t.ok(/Weather: Cold Downpour \(d20 5 vs DC 12\)/.test(w.details), w.details);
    t.ok(/Morale: High \(d20 18 vs DC 14\)/.test(w.details), w.details);
    t.ok(/Luck: −1 to the roll \(d20 9 vs DC 10\)/.test(w.details), w.details);
    t.ok(/Deployment: 2 of 7 units placed on the War Table/.test(w.details), w.details);
    t.equal(b.s.warLog.length, 1);
    t.equal(R.finishMilitaryAction(b.s, data, b.ma.id, roll(20, 20), dice([0.3]), 0), null, 'only once');
    t.equal(b.s.warLog.length, 1);
  });

  test('calling it off wins and loses nothing', function (t) {
    var b = rolled(15, 15, 15);
    var before = [b.s.treasuryGP, b.s.defenders.count, JSON.stringify(b.s.defenderBeasts), b.s.warLog.length];
    t.ok(R.callOffMilitaryAction(b.s, b.ma.id, 0));
    t.same(b.s.militaryActions, []);
    t.same([b.s.treasuryGP, b.s.defenders.count, JSON.stringify(b.s.defenderBeasts), b.s.warLog.length], before);
    t.equal(b.s.log[0].body, 'RAID vs Bacca: the Military Action was called off. Nothing was won or lost.');
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
    t.equal(out.kept + out.stubbed, 265);
    t.equal(out.kept, 62);
    t.equal(out.file.version, 1);
    t.equal(T.bastion.compendiumCards.length, 36);
    t.same(T.bastion.compendiumCards.filter(function (n) { return idx.items.indexOf(n) === -1; }), [], 'every card belongs to an item');
    t.ok(out.file.items['Bag of Holding'].summary);
  });

  group('Bastion: saving');

  test('a save and reload keeps identity, war log, diplomacy and a turn in progress (BAS-01)', function (t) {
    var s = built(fresh(), ['hall_of_emissaries']);
    s.organization = { type: 'clan', name: 'Clan Ironbow', chief: 'Harry', motto: 'Root and Steel', foundedAtTurn: 3 };
    s.clanHonor = 70;
    s.honourRespectByClan.karr = -3;
    s.trustedClientsByClan.slade = 20;
    s.warLog = [{ id: 'w', title: 'Success: RAID vs Bacca' }];
    s.diplomacy.agreements = [{ title: 'Trade Agreement', clan: 'Clan Karr', turnsLeft: 3, incomePerTurn: 90 }];
    s.diplomacy.tokens = 2;
    s.diplomacy.cooldowns = { summit: 1 };
    s.tradeNetwork.settled = { turn: 1, ids: ['r'] };
    s.turnInProgress = { turn: 1, stage: 'orders', skipped: ['x'] };
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
    t.same(back, s);
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
    R.militaryDeploy(s, ma.id, { started: true, locked: false, positions: { def: { x: 0.25, y: 0.75 }, 'beast-5': { x: 0.9, y: 0.95 } } });
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
    t.same(back, s);
    t.equal(back.militaryActions[0].forces.length, 6);
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
    var back = R.fromSave(save, data);
    t.same(back.militaryActions.map(function (m) { return [m.id, m.step]; }), [['b', 'morale'], ['c', 'deploy']]);
    t.same(back.militaryActions[0].forces.map(function (f) { return f.id; }), ['def'], 'an unknown kind of token is dropped');
    t.ok(R.saveProblem(Object.assign(R.toSave(s), { militaryActions: 'x' })));
  });

  test('another tool\'s file or a damaged one is refused (BAS-14)', function (t) {
    t.ok(R.isSave(R.toSave(fresh())));
    t.ok(R.saveProblem({ players: [], prizeTotal: 300 }));
    t.ok(R.saveProblem({ treasuryGP: 1, partyLevel: 1, turn: 1, builtExtras: 'x', pendingOrders: [] }));
    t.ok(R.importProblem([{ key: 'tsi.bastion.state', value: { heroes: [] } }]));
    t.ok(R.importProblem([{ key: 'tsi.bastion.ui', value: 'x' }]));
    t.equal(R.importProblem([{ key: 'tsi.bastion.state', value: R.toSave(fresh()) }, { key: 'tsi.bastion.ui', value: { collapsed: {} } }]), null);
  });

  test('a negative treasury comes back as 0 (B17, kept); an unknown turn step resumes at the orders', function (t) {
    var s = fresh();
    s.treasuryGP = -40;
    s.turnInProgress = { turn: 2, stage: 'nonsense' };
    var back = R.fromSave(R.toSave(s), data);
    t.equal(back.treasuryGP, 0);
    t.same(back.turnInProgress, { turn: 2, stage: 'orders', skipped: [] });
  });
}());
