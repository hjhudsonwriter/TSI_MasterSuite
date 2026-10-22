/* The four production Development Plot facilities, one order at a time (the
   Strip Back Overhaul's step S04; Harry's decisions, 22 October 2026):
   the Timber Yard & Sawmill, Fishery & Smokehouse, Stone Quarry & Masonworks
   and Weavers' Hall carry "levelOrders": "replace" in facilities-data.js.
   Each level offers only its own order(s) (two at Level 5, still one running
   at a time), an upgrade replaces the last level's order, and orders are
   self-contained: none takes goods out of the Warehouse. The Herbal Gardens
   and the Courier Exchange are exactly as they were.
   (tools/bastion/rules.js: R.fnAvailable, R.levelReplacement, R.levelUnlocks,
   R.levelUnlockSummary, R.upgradeReplaceNotice.) */
(function () {
  var R = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce };

  /* The orders of each of the four, level by level, as they are in the data (order ids, days, outputs). */
  var FOUR = {
    timber_sawmill: {
      name: 'Timber Yard & Sawmill',
      levels: {
        1: [['harvest_timber', 'Harvest Timber', 4, 'raw_timber', 1]],
        2: [['saw_lumber', 'Saw Lumber', 4, 'sawn_lumber', 1]],
        3: [['prepare_construction_timber', 'Prepare Construction Timber', 5, 'construction_timber', 1]],
        4: [['harvest_premium_hardwood', 'Harvest Premium Hardwood', 7, 'premium_hardwood', 1]],
        5: [['major_timber_harvest', 'Major Timber Harvest', 9, 'raw_timber', 3], ['bulk_lumber_processing', 'Bulk Lumber Processing', 8, 'sawn_lumber', 3]]
      }
    },
    fishery_smokehouse: {
      name: 'Fishery & Smokehouse',
      levels: {
        1: [['catch_fresh_fish', 'Catch Fresh Fish', 3, 'fresh_fish', 1]],
        2: [['smoke_salt_catch', 'Smoke / Salt Catch', 3, 'preserved_fish', 1]],
        3: [['prepare_expedition_provisions', 'Prepare Expedition Provisions', 4, 'expedition_provision_pack', 5]],
        4: [['catch_premium_seafood', 'Catch Premium Seafood', 6, 'premium_seafood', 1]],
        5: [['commercial_fishing_fleet', 'Organise Commercial Fishing Fleet', 8, 'fresh_fish', 3], ['bulk_smokehouse_production', 'Bulk Smokehouse Production', 7, 'preserved_fish', 3]]
      }
    },
    stone_masonworks: {
      name: 'Stone Quarry & Masonworks',
      levels: {
        1: [['extract_raw_stone', 'Extract Raw Stone', 4, 'raw_stone', 1]],
        2: [['produce_dressed_stone', 'Produce Dressed Stone', 4, 'dressed_stone', 1]],
        3: [['produce_structural_masonry', 'Produce Structural Masonry', 5, 'structural_masonry', 1]],
        4: [['produce_decorative_stonework', 'Produce Decorative Stonework', 7, 'decorative_stonework', 1]],
        5: [['bulk_raw_stone_extraction', 'Bulk Raw Stone Extraction', 9, 'raw_stone', 3], ['bulk_stone_processing', 'Bulk Stone Processing', 8, 'dressed_stone', 3]]
      }
    },
    weavers_hall: {
      name: 'Weavers\' Hall',
      levels: {
        1: [['produce_ordinary_textiles', 'Produce Ordinary Textiles', 4, 'ordinary_textiles', 1]],
        2: [['produce_sailcloth', 'Produce Sailcloth', 4, 'sailcloth', 1]],
        3: [['produce_specialist_garments', 'Produce Specialist Garments', 5, 'specialist_garments', 1]],
        4: [['improved_specialist_garment_production', 'Improved Specialist Garment Production', 7, 'specialist_garments', 2]],
        5: [['bulk_textile_production', 'Bulk Textile Production', 9, 'ordinary_textiles', 3], ['bulk_sailcloth_production', 'Bulk Sailcloth Production', 8, 'sailcloth', 3]]
      }
    }
  };
  var IDS = Object.keys(FOUR);

  /* Order ids come from the dice, so give each order its own. */
  var counter = 0;
  function rand() { counter++; return 0.001 + (counter * 0.00731) % 0.99; }
  function names(list) { return list.map(function (x) { return x[0]; }); }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  /* A Bastion with the facility on a Development Plot at the level, an empty Warehouse and nothing pending. */
  function yard(id, level) {
    var s = R.defaultState(data);
    s.day = 10;
    s.partyLevel = 9;
    s.builtExtras = [];
    s.builtPlots = [{ facId: id, status: 'built' }];
    R.ensureLevels(s, data);
    s.facilityLevels[id] = level;
    s.warehouse = [];
    s.pendingOrders = [];
    return s;
  }
  /* The ids of the orders the panel lists (everything not hidden), in order. */
  function listed(s, id) {
    var fac = R.facility(data, id);
    return fac.functions.filter(function (fn) { return !R.fnAvailable(s, fac, fn).hidden; }).map(function (fn) { return fn.id; });
  }
  function issue(s, id, fnId, opt) { return R.issueOrder(s, data, id, fnId, opt || 0, rand); }
  /* An order runs to its day and completes (as the real days do). */
  function finish(s, o) {
    var out = R.completeSimpleOrder(s, data, o, rand);
    R.removeOrder(s, o.id);
    return out;
  }
  function pendingOf(s, fnId) { return s.pendingOrders.filter(function (o) { return o.fnId === fnId; })[0]; }
  function goods(s) { return s.warehouse.filter(function (w) { return w.goodId; }).map(function (w) { return [w.goodId, w.qty]; }); }

  group('Development facilities: one order at a time, each level replacing the last (S04)');

  test('the four carry the explicit flag, nothing was deleted or renumbered, and no order takes goods; gold is still nothing', function (t) {
    IDS.forEach(function (id) {
      var f = R.facility(data, id);
      t.equal(f.levelOrders, 'replace', id + ' carries levelOrders');
      t.same([f.plot, f.productionLimit, f.requiredLevel], [true, 1, 5], id);
      var expected = [];
      [1, 2, 3, 4, 5].forEach(function (l) { FOUR[id].levels[l].forEach(function (o) { expected.push([o[0], o[1], o[2], l]); }); });
      t.same(f.functions.map(function (fn) { return [fn.id, fn.label, fn.days, fn.requiredFacilityLevel]; }), expected, id + ': the same six orders, ids and days');
      f.functions.forEach(function (fn) {
        t.equal(fn.costGP, 0, fn.id + ' costs no gold');
        t.equal(fn.options.length, 1, fn.id + ' has one recipe');
        t.equal(fn.options[0].inputs, undefined, fn.id + ' uses nothing from the Warehouse');
        t.ok(!('needsResearch' in fn.options[0]), fn.id);
      });
    });
    /* Every order makes what it always made. */
    IDS.forEach(function (id) {
      [1, 2, 3, 4, 5].forEach(function (l) {
        FOUR[id].levels[l].forEach(function (o) {
          var fn = R.fn(R.facility(data, id), o[0]);
          t.same(fn.options[0].outputs, [{ good: o[3], qty: o[4] }], o[0]);
        });
      });
    });
  });

  test('each of the four shows only its current level\'s order(s) at Levels 1 to 5, and says why the others are hidden', function (t) {
    IDS.forEach(function (id) {
      [1, 2, 3, 4, 5].forEach(function (l) {
        var s = yard(id, l);
        t.same(listed(s, id), names(FOUR[id].levels[l]), id + ' at Level ' + l);
        var fac = R.facility(data, id);
        fac.functions.forEach(function (fn) {
          var a = R.fnAvailable(s, fac, fn);
          if (names(FOUR[id].levels[l]).indexOf(fn.id) !== -1) t.same(a, { ok: true }, fn.id + ' is on offer at Level ' + l);
          else t.same(a, { ok: false, hidden: true, message: 'That order belongs to Level ' + fn.requiredFacilityLevel + '.' }, fn.id + ' is hidden at Level ' + l);
        });
      });
    });
  });

  test('a replaced order cannot be issued, nor one from a level not reached yet: the message says so and nothing happens', function (t) {
    IDS.forEach(function (id) {
      var fac = R.facility(data, id);
      [1, 2, 3, 4, 5].forEach(function (l) {
        var s = yard(id, l);
        var gp = s.treasuryGP;
        fac.functions.forEach(function (fn) {
          if (fn.requiredFacilityLevel === l) return;
          var r = issue(s, id, fn.id);
          t.same(r, { ok: false, message: 'That order belongs to Level ' + fn.requiredFacilityLevel + '.' }, id + ' ' + fn.id + ' at Level ' + l);
        });
        t.same([s.pendingOrders.length, s.treasuryGP, s.warehouse.length], [0, gp, 0], id + ': nothing was issued');
      });
    });
  });

  test('every order can be issued with an EMPTY Warehouse at its level, takes nothing, and makes its goods when it completes', function (t) {
    IDS.forEach(function (id) {
      [1, 2, 3, 4, 5].forEach(function (l) {
        FOUR[id].levels[l].forEach(function (o) {
          var s = yard(id, l);
          var fn = R.fn(R.facility(data, id), o[0]);
          t.equal(R.recipeBlocker(s, data, R.facility(data, id), fn, fn.options[0]), null, o[0] + ': no goods are needed');
          var r = issue(s, id, o[0]);
          t.equal(r.ok, true, id + ' ' + o[0] + ': ' + r.message);
          t.same(r.log, ['Order Issued', FOUR[id].name + ': ' + o[1] + ' (' + o[2] + ' days: due Day ' + (10 + o[2]) + ').'], 'no "Taken from the Warehouse" part');
          t.equal(s.pendingOrders[0].inputs, undefined, o[0] + ' holds nothing');
          t.equal(s.warehouse.length, 0, o[0] + ' left the Warehouse alone');
          finish(s, s.pendingOrders[0]);
          t.same(goods(s), [[o[3], o[4]]], o[0] + ' made ' + o[4] + ' of ' + o[3]);
        });
      });
    });
  });

  test('goods already in the Warehouse are left alone: nothing is used up by any order', function (t) {
    IDS.forEach(function (id) {
      var s = yard(id, 5);
      R.goodsList(data).filter(function (g) { return g.kind === 'cargo'; }).forEach(function (g) { R.addGoods(s, data, g.id, 4, '', rand); });
      var before = goods(s);
      var o = FOUR[id].levels[5][1];
      t.equal(issue(s, id, o[0]).ok, true, o[0]);
      t.same(goods(s), before, o[0] + ' used none of it');
    });
  });

  test('an order pending across an upgrade completes once, its goods arrive once, and it still counts toward the one-at-a-time limit', function (t) {
    IDS.forEach(function (id) {
      var fac = R.facility(data, id);
      var first = FOUR[id].levels[1][0];
      var second = FOUR[id].levels[2][0];
      var s = yard(id, 1);
      t.equal(issue(s, id, first[0]).ok, true);
      t.equal(R.issueUpgrade(s, data, id, rand).ok, true, id + ': an upgrade may be ordered while an order is pending');
      /* the upgrade completes first (as it can on the real days) */
      finish(s, pendingOf(s, 'upgrade'));
      t.equal(R.getFacilityLevel(s, id), 2);
      var pending = pendingOf(s, first[0]);
      t.ok(pending, id + ': the Level 1 order is still pending');
      t.ok(R.fn(fac, pending.fnId), id + ': the engine still finds it by its id');
      t.equal(R.orderKind(data, pending), 'simple', 'a known kind of order, not one that is dropped');
      t.same(listed(s, id), [second[0]], 'the panel shows only Level 2\'s order');
      var busy = issue(s, id, second[0]);
      t.same(busy, { ok: false, message: 'The ' + FOUR[id].name + ' is busy: one production order at a time (' + FOUR[id].name + ': ' + first[1] + ', due on Day ' + pending.dueDay + ').' }, id + ': it still counts');
      var out = finish(s, pending);
      t.same(out, [['Order Completed', FOUR[id].name + ': ' + first[1] + ' → Added to Warehouse: ' + R.goodsAmountText(data, first[3], first[4]) + '.']], id + ': completes normally');
      t.same(goods(s), [[first[3], first[4]]], id + ': its goods arrived, once');
      t.same(R.dueOrders(s, []), [], 'nothing is left to complete a second time');
      t.equal(s.pendingOrders.length, 0);
      t.equal(issue(s, id, second[0]).ok, true, id + ': Level 2\'s order can start now');
      t.same(goods(s), [[first[3], first[4]]], id + ': and takes nothing');
    });
  });

  test('Cancel after the upgrade gives nothing extra back (no goods were held) and frees the slot for the new level\'s order', function (t) {
    IDS.forEach(function (id) {
      var first = FOUR[id].levels[1][0];
      var second = FOUR[id].levels[2][0];
      var s = yard(id, 1);
      issue(s, id, first[0]);
      s.facilityLevels[id] = 2;
      var before = JSON.stringify(s.warehouse);
      t.equal(issue(s, id, second[0]).ok, false, id + ' is busy');
      t.same(R.cancelOrder(s, s.pendingOrders[0].id, data, 10), ['Orders', 'Cancelled an order.'], id + ': nothing came back');
      t.equal(JSON.stringify(s.warehouse), before, id + ': the Warehouse is as it was');
      t.equal(issue(s, id, second[0]).ok, true, id + ': the slot is free');
    });
  });

  test('Level 5 offers two orders, but only one can run at a time; the second starts when the first is done', function (t) {
    IDS.forEach(function (id) {
      var a = FOUR[id].levels[5][0];
      var b = FOUR[id].levels[5][1];
      var s = yard(id, 5);
      t.same(listed(s, id), [a[0], b[0]], id + ' lists both');
      t.equal(issue(s, id, a[0]).ok, true);
      var r = issue(s, id, b[0]);
      t.equal(r.ok, false, id + ': the second is refused');
      t.ok(/is busy: one production order at a time/.test(r.message), r.message);
      t.equal(s.pendingOrders.length, 1);
      finish(s, s.pendingOrders[0]);
      t.equal(issue(s, id, b[0]).ok, true, id + ': the second starts once the first is done');
    });
  });

  group('Development facilities: the words (S04)');

  test('each upgrade says what it replaces, made from the data: Level 2 replaces Harvest Timber with Saw Lumber; Level 5 replaces Premium Hardwood with both Level 5 orders', function (t) {
    t.same(R.levelUnlocks(data, 'timber_sawmill', 2), ['Replaces Harvest Timber with Saw Lumber']);
    t.equal(R.levelReplacement(data, 'timber_sawmill', 5).text, 'replaces Harvest Premium Hardwood with Major Timber Harvest and Bulk Lumber Processing');
    IDS.forEach(function (id) {
      [2, 3, 4, 5].forEach(function (l) {
        var from = names(FOUR[id].levels[l - 1]).length;
        var want = 'replaces ' + FOUR[id].levels[l - 1].map(function (o) { return o[1]; }).join(' and ') + ' with ' + FOUR[id].levels[l].map(function (o) { return o[1]; }).join(' and ');
        t.ok(from > 0);
        var u = R.levelUnlockSummary(data, id, l - 1);
        t.same([u.toLevel, u.replaces && u.replaces.text, u.unlocks, u.later], [l, want, [want.charAt(0).toUpperCase() + want.slice(1)], null], id + ' to Level ' + l);
        t.same(R.levelUnlocks(data, id, l), [want.charAt(0).toUpperCase() + want.slice(1)]);
      });
      t.same(R.levelUnlocks(data, id, 1), [], 'Level 1 is where it starts');
      t.equal(R.levelUnlockSummary(data, id, 5), null, 'nothing above the top');
    });
    t.equal(R.joinNames(['A']), 'A');
    t.equal(R.joinNames(['A', 'B']), 'A and B');
    t.equal(R.joinNames(['A', 'B', 'C']), 'A, B and C');
    /* generated, not hard-coded: rename an order and the words follow */
    var other = copy(T.bastionFacilities);
    other.filter(function (f) { return f.id === 'timber_sawmill'; })[0].functions[1].label = 'Plane Planks';
    var d2 = Object.assign({}, data, { facilities: other });
    t.equal(R.levelReplacement(d2, 'timber_sawmill', 2).text, 'replaces Harvest Timber with Plane Planks');
    t.equal(R.levelReplacement(d2, 'timber_sawmill', 3).text, 'replaces Plane Planks with Prepare Construction Timber');
  });

  test('the question before an upgrade says what is replaced and that the old order can no longer be started (a running one finishes); other facilities ask nothing new', function (t) {
    var s = yard('timber_sawmill', 1);
    t.equal(R.upgradeReplaceNotice(s, data, 'timber_sawmill'),
      'Upgrade the Timber Yard & Sawmill to Level 2? Level 2 replaces Harvest Timber with Saw Lumber. Once the upgrade finishes, Harvest Timber can no longer be started; an order already running will still finish.');
    s.facilityLevels.timber_sawmill = 4;
    t.equal(R.upgradeReplaceNotice(s, data, 'timber_sawmill'),
      'Upgrade the Timber Yard & Sawmill to Level 5? Level 5 replaces Harvest Premium Hardwood with Major Timber Harvest and Bulk Lumber Processing. Once the upgrade finishes, Harvest Premium Hardwood can no longer be started; an order already running will still finish.');
    IDS.forEach(function (id) { t.ok(/^Upgrade the .+ to Level 2\? Level 2 replaces /.test(R.upgradeReplaceNotice(yard(id, 1), data, id)), id); });
    s.facilityLevels.timber_sawmill = 5;
    t.equal(R.upgradeReplaceNotice(s, data, 'timber_sawmill'), null, 'Level 5 is the top');
    var up = yard('timber_sawmill', 1);
    R.issueUpgrade(up, data, 'timber_sawmill', rand);
    t.equal(R.upgradeReplaceNotice(up, data, 'timber_sawmill'), null, 'already upgrading: nothing to ask');
    t.equal(R.upgradeReplaceNotice(yard('timber_sawmill', 1), data, 'nowhere'), null);
  });

  group('Development facilities: what did not change (S04)');

  test('the Herbal Gardens still lists every order at every level, locked until its level, with its goods and research as before', function (t) {
    var f = R.facility(data, 'herbal_gardens');
    t.equal(f.levelOrders, undefined);
    var all = f.functions.map(function (fn) { return fn.id; });
    t.same(all, ['harvest', 'cultivate', 'cultivate_specialist', 'field_medical_supplies', 'commercial_medicinal_crops', 'major_botanical_production']);
    [1, 2, 3, 4, 5].forEach(function (l) {
      var s = yard('herbal_gardens', l);
      t.same(listed(s, 'herbal_gardens'), all, 'all six at Level ' + l);
      f.functions.forEach(function (fn) {
        var a = R.fnAvailable(s, f, fn);
        var need = fn.requiredFacilityLevel || 1;
        if (need > l) t.same(a, { ok: false, message: 'Needs Level ' + need + '.' }, fn.id + ' locked at Level ' + l);
        else t.same(a, { ok: true }, fn.id + ' open at Level ' + l + ' (party level 9)');
      });
    });
    t.equal(R.issueOrder(yard('herbal_gardens', 1), data, 'herbal_gardens', 'cultivate_specialist', 0, rand).message, 'Needs Level 2.', 'not "belongs to"');
    t.same(R.levelUnlocks(data, 'herbal_gardens', 2), ['Cultivate Specialist Plants', 'One more research token']);
    t.same(R.levelUnlocks(data, 'herbal_gardens', 3), ['Prepare Field Medical Supplies', 'One more research token']);
    t.equal(R.levelReplacement(data, 'herbal_gardens', 2), null);
    t.equal(R.levelUnlockSummary(data, 'herbal_gardens', 1).replaces, null);
    t.equal(R.upgradeReplaceNotice(yard('herbal_gardens', 1), data, 'herbal_gardens'), null, 'no question before its upgrade');
    /* its recipes still use goods, held by the order */
    var s = yard('herbal_gardens', 3);
    R.addGoods(s, data, 'restorative_herbs', 10, '', rand);
    t.equal(R.issueOrder(s, data, 'herbal_gardens', 'field_medical_supplies', 1, rand).ok, true);
    t.same(s.pendingOrders[0].inputs, [{ goodId: 'restorative_herbs', name: 'Restorative Herbs', qty: 10 }]);
    t.equal(R.goodsQty(s, 'restorative_herbs'), 0);
    t.equal(R.facility(data, 'herbal_gardens').functions[3].options[0].inputs.length, 2, 'the recipes\' goods are still listed');
  });

  test('the Courier Exchange has no orders and no "replaces" words; the other facilities\' level text is unchanged', function (t) {
    var c = R.facility(data, 'courier_exchange');
    t.same([c.levelOrders, c.functions.length], [undefined, 0]);
    var s = R.defaultState(data);
    t.equal(R.levelReplacement(data, 'courier_exchange', 2), null);
    t.same(R.levelUnlocks(data, 'courier_exchange', 2), ['Regional deliveries: 2 parcels on the road at once, 10 items a parcel']);
    t.equal(R.upgradeReplaceNotice(s, data, 'courier_exchange'), null);
    t.same(R.levelUnlocks(data, 'library_scriptorium', 2), ['Prepare Overland Travel Charts']);
    t.same(R.levelUnlocks(data, 'dock', 2), ['Cargo ships: 2 lots on 1 ship']);
    t.same(data.facilities.filter(function (f) { return f.levelOrders; }).map(function (f) { return f.id; }).sort(), IDS.slice().sort(), 'exactly the four carry the flag');
  });

  group('Development facilities: saves (S04)');

  test('a save needs no change: a Timber Yard saved at Level 3 shows only Prepare Construction Timber, and loading twice gives the same save', function (t) {
    var s = yard('timber_sawmill', 3);
    s.warehouse = [{ id: 'w1', goodId: 'raw_timber', item: 'Raw Timber', qty: 2, gp: '', notes: '' }];
    var save = copy(R.toSave(s));
    t.equal(Object.keys(save).indexOf('levelOrders'), -1, 'no new field in the save');
    var once = R.fromSave(copy(save), data);
    var twice = R.fromSave(copy(R.toSave(once)), data);
    t.same(twice, once, 'loading twice changes nothing');
    t.equal(R.getFacilityLevel(twice, 'timber_sawmill'), 3);
    t.same(listed(twice, 'timber_sawmill'), ['prepare_construction_timber']);
    t.equal(issue(twice, 'timber_sawmill', 'saw_lumber').message, 'That order belongs to Level 2.');
    t.equal(issue(twice, 'timber_sawmill', 'prepare_construction_timber').ok, true);
    t.same(goods(twice).filter(function (g) { return g[0] === 'raw_timber'; }), [['raw_timber', 2]], 'the stockpile is left alone');
  });

  test('an order issued before this change that still holds goods completes as it did, and Cancel still gives the goods back once', function (t) {
    /* The old Saw Lumber held 1 Raw Timber from the Warehouse. */
    var s = yard('timber_sawmill', 2);
    var old = { id: 'old1', facId: 'timber_sawmill', fnId: 'saw_lumber', chosen: copy(R.fn(R.facility(data, 'timber_sawmill'), 'saw_lumber').options[0]), optionLabel: 'Sawn Lumber (1 lot)', notes: '', label: 'Timber Yard & Sawmill: Saw Lumber', costGP: 0, issuedDay: 6, dueDay: 10, inputs: [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 1 }] };
    s.pendingOrders = [old];
    var back = R.fromSave(copy(R.toSave(s)), data);
    t.same(back.pendingOrders[0].inputs, [{ goodId: 'raw_timber', name: 'Raw Timber', qty: 1 }], 'the held goods survive a save');
    t.equal(R.dueOrders(back, []).length, 1);
    var cancel = copy(back);
    t.same(R.cancelOrder(cancel, 'old1', data, 10), ['Orders', 'Cancelled Timber Yard & Sawmill: Saw Lumber. 1 lot of Raw Timber went back to the Warehouse.']);
    t.same(R.cancelOrder(cancel, 'old1', data, 10), ['Orders', 'Cancelled an order.']);
    t.equal(R.goodsQty(cancel, 'raw_timber'), 1);
    finish(back, back.pendingOrders[0]);
    t.same(goods(back), [['sawn_lumber', 1]], 'it makes its Sawn Lumber, and its Raw Timber is not given back');
  });

  test('a Bastion that had a Level 2 Timber Yard with an old pending Level 1 order: the order completes although it is no longer offered', function (t) {
    var s = yard('timber_sawmill', 2);
    s.pendingOrders = [{ id: 'old2', facId: 'timber_sawmill', fnId: 'harvest_timber', chosen: copy(R.fn(R.facility(data, 'timber_sawmill'), 'harvest_timber').options[0]), optionLabel: 'Raw Timber (1 lot)', notes: '', label: 'Timber Yard & Sawmill: Harvest Timber', costGP: 0, issuedDay: 7, dueDay: 11 }];
    t.equal(R.orderKind(data, s.pendingOrders[0]), R.orderKind(data, { facId: 'timber_sawmill', fnId: 'saw_lumber', chosen: s.pendingOrders[0].chosen }), 'still a known order');
    var out = finish(s, s.pendingOrders[0]);
    t.same(out, [['Order Completed', 'Timber Yard & Sawmill: Harvest Timber → Added to Warehouse: 1 lot of Raw Timber.']]);
    t.same(goods(s), [['raw_timber', 1]]);
  });
}());
