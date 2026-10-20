/* Session Safety and Clarity (Harry, 18 October 2026): the backup reminder's
   rules (shared/js/backup-rules.js), what each upgrade unlocks and the
   research stages that cannot be reached (tools/bastion/rules.js). */
(function () {
  var B = TSI.backupRules;
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var DAY = 86400000;
  var now = Date.UTC(2026, 9, 18, 12, 0, 0);

  group('Session safety: the backup reminder');

  test('how long ago the last backup was, in words', function (t) {
    t.equal(B.backupAgeText(null, now), 'never');
    t.equal(B.backupAgeText(0, now), 'never');
    t.equal(B.backupAgeText(now - 3600000, now), 'today');
    t.equal(B.backupAgeText(now - DAY, now), 'yesterday');
    t.equal(B.backupAgeText(now - 5 * DAY - 1000, now), '5 days ago');
    t.equal(B.backupAgeDays(now + DAY, now), 0, 'a clock set back never gives a negative age');
  });

  test('the reminder is due only when there is a campaign and no backup in the last week', function (t) {
    t.equal(B.backupDue(null, now, false), false, 'nothing saved, nothing to lose');
    t.equal(B.backupDue(null, now, true), true, 'saved but never backed up');
    t.equal(B.backupDue(now - 7 * DAY, now, true), false, 'seven days is still fine');
    t.equal(B.backupDue(now - 8 * DAY, now, true), true);
    t.equal(B.backupDue(now - DAY, now, true), false);
  });

  test('the stamp is kept apart from the saves, so a backup never holds it', function (t) {
    var S = TSI.storeRules;
    var names = S.spaceNames('suite');
    t.equal(names.lastBackup, 'tsi.suite.last-backup');
    t.equal(S.spaceNames('test').lastBackup, 'tsi.test:last-backup');
    t.equal(S.fromLocalKey(names.lastBackup, 'suite'), null, 'not a saved record');
    t.equal(S.fromLocalKey(S.spaceNames('test').lastBackup, 'test'), null);
  });

  group('Session safety: what each upgrade unlocks');

  test('orders and effects are listed by level; a level with neither unlocks nothing yet', function (t) {
    t.same(BR.levelUnlocks(bdata, 'library_scriptorium', 2), ['Prepare Overland Travel Charts']);
    t.same(BR.levelUnlocks(bdata, 'library_scriptorium', 3), []);
    t.same(BR.levelUnlocks(bdata, 'workshop', 2), []);
    t.same(BR.levelUnlocks(bdata, 'dock', 2), ['Cargo ships: 2 lots on 1 ship']);
    t.same(BR.levelUnlocks(bdata, 'dock', 5), ['Cargo ships: 5 lots a ship, 2 ships at sea at once']);
    t.same(BR.levelUnlocks(bdata, 'war_room', 3), ['Coordinated Muster', '2 drill places']);
    t.same(BR.levelUnlocks(bdata, 'hall_of_emissaries', 2), ['Inter-Clan Summit', 'Diplomacy rolls +4 (from +2)']);
    t.same(BR.levelUnlocks(bdata, 'hall_of_emissaries', 4), []);
    t.same(BR.levelUnlocks(bdata, 'griffin_tower', 3), ['Room for one more griffin']);
    t.same(BR.levelUnlocks(bdata, 'shrine_pelagos', 5), ['Great Rite of Pelagos']);
    t.same(BR.levelUnlocks(bdata, 'herbal_gardens', 2), ['Cultivate Specialist Plants', 'One more research token']);
    t.same(BR.levelUnlocks(bdata, 'nothing_here', 2), []);
    t.same(BR.levelUnlocks(bdata, 'dock', 1), [], 'Level 1 is where it starts');
  });

  test('the Upgrade row: the next level, and when it unlocks nothing, which later level it is needed for', function (t) {
    var w = BR.levelUnlockSummary(bdata, 'workshop', 1);
    t.same([w.toLevel, w.unlocks, w.later], [2, [], null], 'the Workshop gives nothing at any level');
    var lib = BR.levelUnlockSummary(bdata, 'library_scriptorium', 2);
    t.same([lib.toLevel, lib.unlocks, lib.later], [3, [], null]);
    var courier = BR.levelUnlockSummary(bdata, 'courier_exchange', 2);
    t.same([courier.unlocks, courier.later], [[], null], 'Courier Levels 3 to 5 are still to come');
    t.equal(BR.levelUnlockSummary(bdata, 'dock', 5), null, 'nothing above the top');
    var hallTop = BR.levelUnlockSummary(bdata, 'hall_of_emissaries', 3);
    t.same(hallTop.unlocks, [], 'Hall Level 4 unlocks nothing yet');
  });

  test('an upgrade that unlocks nothing but leads to a level that does is never disabled and says so', function (t) {
    /* A built facility upgrades whatever the next level gives. */
    var s = BR.defaultState(bdata);
    s.partyLevel = 9;
    s.builtExtras = [{ facId: 'hall_of_emissaries', status: 'built' }];
    BR.ensureLevels(s, bdata);
    t.equal(BR.upgradeCheck(s, bdata, 'workshop').ok, true, 'the Workshop still upgrades');
    /* a synthetic case: Level 3 gives nothing, Level 4 gives something */
    var fake = JSON.parse(JSON.stringify(bdata.facilities));
    var lib = fake.filter(function (f) { return f.id === 'library_scriptorium'; })[0];
    lib.functions.push({ id: 'later_order', label: 'A later order', requiredFacilityLevel: 4 });
    var d2 = Object.assign({}, bdata, { facilities: fake });
    var u = BR.levelUnlockSummary(d2, 'library_scriptorium', 2);
    t.same([u.toLevel, u.unlocks, u.later && u.later.level, u.later && u.later.unlocks], [3, [], 4, ['A later order']]);
  });

  group('Session safety: research that does not work yet');

  test('a choice that is not built cannot be chosen, and costs nothing', function (t) {
    var s = BR.defaultState(bdata);
    s.partyLevel = 9;
    s.treasuryGP = 5000;
    s.builtPlots = [{ facId: 'herbal_gardens', status: 'built' }];
    BR.ensureLevels(s, bdata);
    s.facilityLevels.herbal_gardens = 5;
    var tokens = BR.researchTokens(s, bdata, 'herbal_gardens');
    var gold = s.treasuryGP;
    var res = BR.startResearch(s, bdata, 'herbal_gardens', 'commercial', 'dried_herb_packaging', Math.random);
    t.equal(res.ok, false);
    t.ok(/^Not available yet: it needs /.test(res.message) && /Nothing was spent\.$/.test(res.message), res.message);
    t.same([s.treasuryGP, BR.researchTokens(s, bdata, 'herbal_gardens'), s.pendingOrders.length], [gold, tokens, 0], 'no gold, no token, no order');
  });

  test('a stage that no earlier choice can open is "unreachable", not "after Stage II"', function (t) {
    var s = BR.defaultState(bdata);
    s.partyLevel = 9;
    s.treasuryGP = 5000;
    s.builtPlots = [{ facId: 'herbal_gardens', status: 'built' }];
    BR.ensureLevels(s, bdata);
    s.facilityLevels.herbal_gardens = 5;
    t.equal(BR.researchChoiceState(s, bdata, 'herbal_gardens', 'botanical', 'exotic_flora_conservatory'), 'unreachable');
    var res = BR.researchCheck(s, bdata, 'herbal_gardens', 'botanical', 'exotic_flora_conservatory');
    t.ok(!res.ok && /^Not reachable yet/.test(res.message) && /Nothing was spent\.$/.test(res.message), res.message);
    t.equal(BR.researchChoiceState(s, bdata, 'herbal_gardens', 'agricultural', 'bountiful_harvests'), 'locked', 'a stage that can still be reached says "after Stage II"');
    var tree = BR.researchTree(bdata, 'herbal_gardens');
    t.equal(BR.researchStageReachable(tree, 'agricultural', 2, []), true);
    t.equal(BR.researchStageReachable(tree, 'botanical', 2, []), false);
    t.equal(BR.researchStageReachable(tree, 'botanical', 1, []), true);
  });

  group('Hand to the party (pull request B)');
  function hw() {
    var s = BR.defaultState(bdata);
    s.day = 12;
    s.warehouse = [{ id: 'a', item: 'Rope', qty: 5, gp: '', notes: '' }, { id: 'g', goodId: 'sawn_lumber', item: 'Sawn Lumber', qty: 3, gp: '', notes: '' }];
    return s;
  }
  test('handing over takes only that many, once, and the Day Log says who, when, and that the DM records it', function (t) {
    var s = hw();
    var row = s.warehouse[0];
    var r = BR.handToParty(s, row, '2', '  Borin  ', 1000);
    t.equal(r.ok, true);
    t.equal(row.qty, 3, 'five less two');
    t.equal(s.log.length, 1, 'one entry');
    t.ok(/Handed to the party: 2 \u00d7 Rope \(to Borin\) on Day 12/.test(s.log[0].body), s.log[0].body);
    t.ok(/records it on the character's D&D sheet/.test(s.log[0].body), s.log[0].body);
    t.equal(s.log[0].day, 12);
    t.equal(s.warehouse[1].qty, 3, 'other rows untouched');
  });
  test('handing over all of it removes the row; no recipient is fine', function (t) {
    var s = hw();
    var r = BR.handToParty(s, s.warehouse[0], 5, '');
    t.equal(r.ok, true);
    t.same(s.warehouse.map(function (w) { return w.item; }), ['Sawn Lumber']);
    t.ok(!/\(to /.test(s.log[0].body), s.log[0].body);
  });
  test('too many, zero, fractions, text, goods the Ironbow makes and rows already gone change nothing', function (t) {
    var s = hw();
    var row = s.warehouse[0];
    ['6', 0, '0', -1, '1.5', 'x', ''].forEach(function (q) {
      t.equal(BR.handToParty(s, row, q, 'Borin').ok, false, 'refused: ' + q);
    });
    t.equal(BR.handToParty(s, s.warehouse[1], 1, 'Borin').ok, false, 'a good goes by the Courier Exchange');
    t.equal(row.qty, 5);
    t.equal(s.log.length, 0);
    BR.handToParty(s, row, 5, '');
    t.equal(BR.handToParty(s, row, 1, '').ok, false, 'a second go on a removed row');
    t.equal(s.log.length, 1, 'logged once');
  });

  group('Warehouse sort (19 October 2026)');
  test('grouped view: supplies, ingredients, trade goods, then general items, each in the order added; the saved order is never changed', function (t) {
    var rows = [
      { id: 'a', item: 'Rope', qty: 2 },
      { id: 'b', goodId: 'raw_timber', item: 'Raw Timber', qty: 1 },
      { id: 'c', goodId: 'expedition_provision_pack', item: 'Expedition Provision Pack', qty: 3 },
      { id: 'd', item: 'Potion of Healing', qty: 1 },
      { id: 'e', goodId: 'restorative_herbs', item: 'Restorative Herbs', qty: 10 },
      { id: 'f', goodId: 'earthward_talisman', item: 'Earthward Talisman', qty: 1 }
    ];
    var before = JSON.stringify(rows);
    var v = BR.warehouseView(bdata, rows, 'grouped');
    t.same(v.items.map(function (x) { return x.row.id; }), ['c', 'f', 'e', 'b', 'a', 'd'], 'supplies (pack, talisman), ingredient, trade good, then the two general items');
    t.same(v.items.map(function (x) { return x.index; }), [2, 5, 4, 1, 0, 3], 'each keeps its place in the saved list');
    t.same(v.groups, [{ id: 'supply', label: 'Supplies', count: 2 }, { id: 'ingredient', label: 'Ingredients', count: 1 }, { id: 'cargo', label: 'Trade goods', count: 1 }, { id: 'general', label: 'General items', count: 2 }]);
    t.equal(JSON.stringify(rows), before, 'the saved rows are untouched');
    t.same(BR.warehouseView(bdata, rows, 'entered').items.map(function (x) { return x.row.id; }), ['a', 'b', 'c', 'd', 'e', 'f'], 'as entered');
    t.same(BR.warehouseView(bdata, rows).groups, [], 'no headings unless grouped');
    t.same(BR.warehouseView(bdata, [], 'grouped'), { items: [], groups: [] });
  });
  test('the sort choice is remembered with the panels, and anything else is dropped', function (t) {
    t.equal(BR.cleanUi({ whSort: 'grouped' }).whSort, 'grouped');
    t.equal(BR.cleanUi({ whSort: 'zigzag' }).whSort, undefined);
    t.equal(BR.cleanUi({ gridOpen: false }).whSort, undefined);
  });

  group('Warehouse: trade goods that run out leave the list (19 October 2026)');
  test('only trade goods with none left vanish; supplies, ingredients and typed rows stay', function (t) {
    var s = BR.defaultState(bdata);
    s.warehouse = [
      { id: 'a', item: 'Rope', qty: 0 },
      { id: 'b', goodId: 'raw_timber', item: 'Raw Timber', qty: 0 },
      { id: 'c', goodId: 'sawn_lumber', item: 'Sawn Lumber', qty: 2 },
      { id: 'd', goodId: 'expedition_provision_pack', item: 'Expedition Provision Pack', qty: 0 },
      { id: 'e', goodId: 'restorative_herbs', item: 'Restorative Herbs', qty: 0 }
    ];
    t.equal(BR.pruneEmptyCargo(s, bdata), true);
    t.same(s.warehouse.map(function (w) { return w.id; }), ['a', 'c', 'd', 'e'], 'the empty Raw Timber line went; the rest stayed');
    t.equal(BR.pruneEmptyCargo(s, bdata), false, 'nothing more to remove');
  });
  test('using the last of a trade good takes its line away once the Warehouse is tidied, and making more brings a line back', function (t) {
    var s = BR.defaultState(bdata);
    s.warehouse = [];
    BR.addGoods(s, bdata, 'raw_timber', 2, '', function () { return 0.5; });
    t.equal(BR.takeGoods(s, bdata, [{ good: 'raw_timber', qty: 2 }]).length, 1);
    BR.pruneEmptyCargo(s, bdata);
    t.same(s.warehouse.filter(function (w) { return w.goodId; }), [], 'no line for what is not there');
    BR.addGoods(s, bdata, 'raw_timber', 1, '', function () { return 0.5; });
    t.same(s.warehouse.filter(function (w) { return w.goodId; }).map(function (w) { return [w.goodId, w.qty]; }), [['raw_timber', 1]]);
  });
}());
