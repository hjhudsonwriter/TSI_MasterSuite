/* The Strip Back conversion (version 3 to 4): tools/bastion/strip-back-rules.js,
   R.fromSave's chain, the seven guarantees of R.stripBackAudit, and the
   fixtures (tests/fixtures; the heavy one is made by tests/fixtures/make-heavy.js).
   Harry's decisions of 22 October 2026: docs/STRIP-BACK-PLAN.md; the design:
   docs/strip-back/J-cross-cutting.md sections 0 to 4. */
(function () {
  var R = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures, warRoom: T.bastionWarRoom };
  var FIX = window.TSI_FIXTURES || {};
  var canon = R.stripBackCanon;

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
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
  /* An order at a facility this copy of the suite has never heard of. */
  function ghost(id, extra) {
    return Object.assign({ id: id, facId: 'old_mill', fnId: 'grind', chosen: null, optionLabel: null, notes: '', label: 'Old Mill: Grind Grain', costGP: 0, issuedDay: 10, dueDay: 15 }, extra || {});
  }
  function held(goodId, qty) { return { goodId: goodId, name: R.goodName(data, goodId), qty: qty }; }
  var ONE_OF = ['telluria', 'aurush', 'pelagos'];
  /* Text a person reads must not have these in it. */
  function jargon(text) {
    var bad = [];
    if (/undefined|null|NaN|\[object|Infinity/.test(text)) bad.push('a code word');
    if (/\b[a-z]+_[a-z_]+\b/.test(text)) bad.push('an id with an underscore');
    if (/\b(facId|fnId|pendingOrders|treasuryGP|builtExtras)\b/.test(text)) bad.push('a field name');
    if (/\b1 (orders|lots|places)\b/.test(text)) bad.push('a plural after 1');
    if (/\b[2-9] (order was|place was)\b/.test(text)) bad.push('a singular after a number');
    if (/  /.test(text)) bad.push('a double space');
    return bad;
  }

  group('Strip Back: the version 4 shell (S01)');

  test('a fresh Bastion is already version 4: nothing to convert, no notice', function (t) {
    var s = R.defaultState(data);
    t.equal(s.v, 4);
    t.equal(R.STATE_VERSION, 4);
    t.equal(s.migration, null);
    t.equal(R.needsStripBack(s, data), false);
    var res = R.migrateToV4(R.toSave(s), data);
    t.same(res.save, R.toSave(s), 'a clean version 4 save comes back as it is');
    t.same(res.report.lines, []);
    t.same(R.fromSave(R.toSave(s), data), s, 'and loads as it is');
  });

  test('what needs converting: anything below version 4, a version 4 with something the Bastion no longer has, and a save with no version', function (t) {
    t.equal(R.needsStripBack(v3(), data), true);
    t.equal(R.needsStripBack(v3(function (s) { s.v = 2; }), data), true);
    t.equal(R.needsStripBack(v3(function (s) { delete s.v; }), data), true);
    var clean = convert(v3()).save;
    t.equal(R.needsStripBack(clean, data), false);
    var dirty = clone(clean);
    dirty.pendingOrders.push(ghost('late'));
    t.equal(R.needsStripBack(dirty, data), true, 'an older copy of the suite saved over it');
    t.same(R.stripBackLeftovers(dirty, data), [{ step: 'sweepFacilities', what: 'an order: old_mill' }]);
    t.equal(R.needsStripBack(null, data), false);
    t.equal(R.needsStripBack('x', data), false);
  });

  test('a version 3 Bastion with nothing to convert becomes version 4 and says so in one line; nothing else changes', function (t) {
    var raw = v3(function (s) { s.pendingOrders = [{ id: 'o1', facId: 'workshop', fnId: 'craft', label: 'Workshop: Craft (Dagger)', costGP: 0, issuedDay: 10, dueDay: 15 }]; });
    var before = JSON.stringify(raw);
    var res = convert(raw);
    t.equal(JSON.stringify(raw), before, 'the save it was given is untouched');
    t.same(res.problems, []);
    t.equal(res.save.v, 4);
    t.same(res.report.lines, []);
    t.same(res.save.migration.v4, { day: 12, lines: [], summary: 'Nothing of yours changed.', changed: false, again: false, shown: false, gp: 0 });
    var rest = clone(res.save);
    delete rest.migration;
    rest.v = 3;
    var orig = clone(raw);
    delete orig.migration;
    t.same(rest, orig, 'every other field is exactly as it was');
    t.equal(R.stripBackHeadline(res.save.migration.v4), 'The Bastion has been updated; nothing of yours changed.');
  });

  test('the conversion is pure: the same save gives the same result every time, and it never touches the one it is given', function (t) {
    var raw = v3(function (s) {
      s.treasuryGP = 90;
      s.warehouse = [{ id: 'w1', goodId: 'raw_timber', item: 'Raw Timber', qty: 1, gp: '', notes: '' }];
      s.pendingOrders = [ghost('g1', { costGP: 40, inputs: [held('raw_timber', 2), held('sawn_lumber', 1)] })];
    });
    var before = canon(raw);
    var a = R.migrateToV4(raw, data);
    var b = R.migrateToV4(raw, data);
    t.equal(canon(raw), before);
    t.equal(canon(a.save), canon(b.save));
    t.equal(canon(a.report), canon(b.report));
    t.equal(canon(a.before), canon(raw), 'before is what it started from');
  });

  test('the registry: the steps run in order, the last one finishes, and a later step can be added above the catch-all', function (t) {
    t.same(R.stripBackSteps.map(function (st) { return st.id; }), ['dropEvents', 'dropBeastRequests', 'rehomeBeasts', 'sweepFacilities', 'finish']);
    var steps = R.stripBackSteps;
    var added = {
      id: 'example',
      detect: function (s) { return s.exampleLeftover ? ['an example'] : []; },
      run: function (s, d, report) {
        if (!s.exampleLeftover) return;
        delete s.exampleLeftover;
        R.stripBackSay(report, 'war', 'The example went away.');
      }
    };
    steps.splice(0, 0, added);
    try {
      var raw = v3(function (s) { s.exampleLeftover = true; });
      t.equal(R.needsStripBack(clone(convert(v3()).save), data), false, 'a clean save is not caught by it');
      var withLeft = clone(convert(v3()).save);
      withLeft.exampleLeftover = 1;
      t.equal(R.needsStripBack(withLeft, data), true, 'its own leftovers make a version 4 save convert again');
      var res = convert(raw);
      t.same(res.problems, []);
      t.equal('exampleLeftover' in res.save, false);
      t.same(res.save.migration.v4.lines, ['The army and the war. The example went away.'], 'its sentence is under its heading');
    } finally {
      steps.splice(0, 1);
    }
    t.same(R.stripBackSteps.map(function (st) { return st.id; }), ['dropEvents', 'dropBeastRequests', 'rehomeBeasts', 'sweepFacilities', 'finish']);
  });

  group('Strip Back: the catch-all (a facility the Bastion does not know)');

  test('a facility the catalogue does not know is freed from its slot, its plot, its level and its repairs, and recorded', function (t) {
    var raw = v3(function (s) {
      s.builtExtras = [{ facId: 'old_mill', status: 'built' }, { facId: 'war_room', status: 'built' }, { facId: 'sawpit', status: 'building', startDay: 8, readyDay: 29 }, ''];
      s.builtPlots = [{ facId: 'old_mill', status: 'built' }, ''];
      s.facilityLevels = Object.assign(s.facilityLevels, { old_mill: 3, sawpit: 1, war_room: 1 });
      s.repairs = { old_mill: 14, dock: 15 };
    });
    var res = convert(raw);
    t.same(res.problems, []);
    t.same(res.save.builtExtras, ['', { facId: 'war_room', status: 'built' }, '', ''], 'positions are kept; the known facility stays');
    t.same(res.save.builtPlots, ['', '']);
    t.same(['old_mill' in res.save.facilityLevels, 'sawpit' in res.save.facilityLevels, 'war_room' in res.save.facilityLevels], [false, false, true]);
    t.same(res.save.repairs, { dock: 15 });
    t.same(res.save.archivedFacilities.map(function (a) { return [a.facId, a.name, a.status, a.slot, a.day, a.plot === true]; }), [
      ['old_mill', 'Old Mill', 'built', 0, 12, false], ['sawpit', 'Sawpit', 'building', 2, 12, false], ['old_mill', 'Old Mill', 'built', 0, 12, true]
    ]);
    t.same(res.save.migration.v4.lines, ['Places that are gone. The Old Mill is no longer part of the Bastion; its slot is free. Building work on the Sawpit stopped, as it is no longer part of the Bastion; its slot is free.']);
    t.equal(R.needsStripBack(res.save, data), false);
  });

  test('its pending orders are cancelled and EVERYTHING they cost comes back, exactly once: gold, Favour and the goods they held', function (t) {
    var raw = v3(function (s) {
      s.treasuryGP = 400;
      s.favour = { telluria: 10, aurush: 50, pelagos: 99 };
      s.warehouse = [
        { id: 'w1', item: 'Rope (50 ft)', qty: 2, gp: '', notes: 'typed by hand' },
        { id: 'w2', goodId: 'raw_timber', item: 'Raw Timber', qty: 1, gp: '', notes: '' }
      ];
      s.pendingOrders = [
        { id: 'k', facId: 'workshop', fnId: 'craft', label: 'Workshop: Craft (Dagger)', costGP: 2, issuedDay: 10, dueDay: 13 },
        ghost('g1', { costGP: 120, favourCost: 10, favourGod: 'telluria', inputs: [held('raw_timber', 3), held('alchemical_flowers', 4)] }),
        ghost('g2', { label: 'Old Mill: Press Oil', costGP: 30, inputs: [held('raw_timber', 1)] })
      ];
    });
    var res = convert(raw);
    t.same(res.problems, []);
    t.same(res.save.pendingOrders.map(function (o) { return o.id; }), ['k'], 'the order at a facility that stays is kept');
    t.equal(res.save.treasuryGP, 550, '400 + 120 + 30');
    t.same([res.report.gold.refunded, res.report.gold.settlement, res.report.gold.was, res.report.gold.now], [150, 0, 400, 550]);
    t.same(res.report.gold.items, [{ label: 'Old Mill: Grind Grain', gp: 120, kind: 'refund' }, { label: 'Old Mill: Press Oil', gp: 30, kind: 'refund' }], 'every pound itemised');
    var rows = {};
    res.save.warehouse.forEach(function (w) { if (w.goodId) rows[w.goodId] = w.qty; });
    t.same(rows, { raw_timber: 5, alchemical_flowers: 4 }, '1 + 3 + 1 lots of Raw Timber; a new row for the flowers');
    t.same(res.save.warehouse.filter(function (w) { return !w.goodId; }), [raw.warehouse[0]], 'the row typed by hand is untouched');
    t.same(res.report.goods.map(function (g) { return [g.goodId, g.qty]; }), [['raw_timber', 4], ['alchemical_flowers', 4]]);
    t.equal(res.save.warehouse.filter(function (w) { return w.goodId === 'alchemical_flowers'; })[0].id, 'returned-alchemical_flowers', 'a row made by the conversion has a fixed id (never random)');
    t.same(res.save.favour, { telluria: 10, aurush: 50, pelagos: 99 }, 'a facility that is not a Shrine has no god to give Favour back to');
    t.equal(res.save.migration.v4.lines.length, 4);
    t.equal(res.save.migration.v4.lines[0], 'Gold. 150 gp went back into the treasury (on Day 12 it went from 400 gp to 550 gp): Old Mill: Grind Grain, 120 gp; Old Mill: Press Oil, 30 gp.');
    t.equal(res.save.migration.v4.lines[1], 'Goods. 4 lots of Raw Timber and 4 portions of Alchemical Flowers went back to the Warehouse.');
    t.equal(res.save.migration.v4.lines[2], 'Orders. 2 orders were cancelled: Old Mill: Grind Grain (the Old Mill is no longer part of the Bastion); Old Mill: Press Oil (the Old Mill is no longer part of the Bastion).');
    /* Converting it again changes nothing: no second refund. */
    var again = R.migrateToV4(res.save, data);
    t.equal(again.save.treasuryGP, 550);
    t.same(again.report.cancelled, []);
  });

  test('Favour comes back up to 100% and no further; what could not go back is said', function (t) {
    var shrineOrder = function (id, facId, fav) { return { id: id, facId: facId, fnId: 'prepare_aquatic_protection_charm', label: 'Shrine of Pelagos: Prepare Aquatic Protection Charm', costGP: 0, favourCost: fav, issuedDay: 10, dueDay: 14 }; };
    /* A Shrine the catalogue does not know, named as a Shrine is, so its god can be told. */
    var res = convert(v3(function (s) {
      s.favour = { telluria: 0, aurush: 0, pelagos: 95 };
      s.pendingOrders = [shrineOrder('f1', 'shrine_pelagos', 10), shrineOrder('f2', 'old_mill', 5)];
    }));
    t.same(res.problems, []);
    /* The real Shrine of Pelagos is still in the catalogue at this step, so only the Old Mill's order is cancelled. */
    t.same(res.save.pendingOrders.map(function (o) { return o.id; }), ['f1']);
    t.same(res.save.favour, { telluria: 0, aurush: 0, pelagos: 95 });
    t.ok(res.report.notes.some(function (n) { return /5% of a god's Favour/.test(n); }), 'an order that used Favour at a place with no god says it could not give it back');
    /* The cap, tested straight on the helper a later step uses. */
    var s = v3(function (x) { x.favour = { telluria: 0, aurush: 0, pelagos: 95 }; x.pendingOrders = [shrineOrder('f3', 'shrine_pelagos', 10)]; });
    var report = R.stripBackNewReport(s, data);
    R.stripBackCancel(s, data, report, s.pendingOrders[0], 'the Temple replaces the Shrines');
    t.equal(s.favour.pelagos, 100, 'capped at 100');
    t.same([report.favour.pelagos, report.favour.lost.pelagos], [5, 5]);
    t.same(report.cancelled.map(function (c) { return [c.id, c.god, c.favour, c.why]; }), [['f3', 'pelagos', 10, 'the Temple replaces the Shrines']]);
  });

  test('orders kept as they are: at a real facility, an upgrade, and the War Council\'s and Trade Network\'s own orders (their steps deal with them)', function (t) {
    var raw = v3(function (s) {
      s.pendingOrders = [
        { id: 'a', facId: 'workshop', fnId: 'upgrade', label: 'Workshop: Upgrade to Level 2', costGP: 0, issuedDay: 10, dueDay: 17, meta: { kind: 'upgrade', toLevel: 2 } },
        { id: 'b', facId: 'war_council', fnId: 'war_action', label: 'War Action', costGP: 0, issuedDay: 10, dueDay: 13, meta: { kind: 'war_action' } },
        { id: 'c', facId: 'trade_network', fnId: 'upgrade', label: 'Ironbow Trade Network: Stability Investment', costGP: 75, issuedDay: 10, dueDay: 17, meta: { kind: 'stability' } },
        'not an order'
      ];
    });
    var res = convert(raw);
    t.same(res.problems, []);
    t.same(res.save.pendingOrders, raw.pendingOrders);
    t.equal(res.save.treasuryGP, 400);
    t.same(R.STRIP_BACK_PSEUDO_FACILITIES, ['war_council', 'trade_network']);
  });

  test('goods an order held that cannot be read are said, and the rest still go back; an order with no id is still cancelled and refunded', function (t) {
    var res = convert(v3(function (s) {
      s.pendingOrders = [{ facId: 'old_mill', fnId: 'grind', label: 'Old Mill: Grind Grain', costGP: 25, issuedDay: 10, dueDay: 14, inputs: [held('raw_timber', 1), { goodId: 5 }, 'x'] }];
    }));
    t.same(res.problems, []);
    t.equal(res.save.treasuryGP, 425);
    t.same(res.save.pendingOrders, []);
    t.same(res.report.goods.map(function (g) { return [g.goodId, g.qty]; }), [['raw_timber', 1]]);
    t.ok(res.report.notes.some(function (n) { return /some goods that could not be read/.test(n); }));
    t.ok(/Also\. Old Mill: Grind Grain held some goods that could not be read/.test(res.save.migration.v4.lines[res.save.migration.v4.lines.length - 1]));
  });

  test('cancelling with a refund happens once: a second try finds no order and gives nothing', function (t) {
    var s = v3(function (x) { x.pendingOrders = [ghost('g1', { costGP: 60 })]; });
    var report = R.stripBackNewReport(s, data);
    var o = s.pendingOrders[0];
    t.equal(R.stripBackCancel(s, data, report, o, 'a reason'), true);
    t.equal(R.stripBackCancel(s, data, report, o, 'a reason'), false);
    t.equal(s.treasuryGP, 460);
    t.same([report.gold.refunded, report.cancelled.length], [60, 1]);
    /* A move keeps the order whole. */
    var s2 = v3(function (x) { x.pendingOrders = [{ id: 'm', facId: 'library_scriptorium', fnId: 'research', label: 'Library & Scriptorium: Research (Geographical Scriptures)', costGP: 0, issuedDay: 10, dueDay: 15, inputs: [held('raw_timber', 1)] }]; });
    var r2 = R.stripBackNewReport(s2, data);
    R.stripBackMoveOrder(r2, s2.pendingOrders[0], { facId: 'workshop', fnId: 'scholar_research' }, 'the Workshop\'s Scholar');
    t.same([s2.pendingOrders[0].id, s2.pendingOrders[0].dueDay, s2.pendingOrders[0].inputs.length, s2.pendingOrders[0].facId], ['m', 15, 1, 'workshop']);
    t.same(r2.moved, [{ id: 'm', label: 'Library & Scriptorium: Research (Geographical Scriptures)', to: 'the Workshop\'s Scholar' }]);
  });

  test('names are never raw ids: the catalogue, then the Strip Back table (the 13 going), then the older retired ones, then the id in words', function (t) {
    t.equal(R.stripBackName(data, 'workshop'), 'Workshop');
    t.equal(R.stripBackName(data, 'war_room'), 'War Room');
    t.equal(R.stripBackName(data, 'old_mill'), 'Old Mill');
    t.equal(R.stripBackName(data, 'smithy'), 'Smithy');
    t.equal(R.stripBackName(data, ''), 'A facility');
    var ids = ['menagerie', 'war_room', 'library_scriptorium', 'arcane_laboratory', 'armoury', 'watchtower', 'barracks', 'shrine_telluria', 'shrine_aurush', 'shrine_pelagos', 'wyvern_roost', 'griffin_tower', 'dire_wolf_den'];
    t.same(Object.keys(T.bastion.stripBack.facilities).sort(), ids.slice().sort(), 'the 13 facilities going');
    ids.forEach(function (id) {
      /* The three creature buildings are already out of the catalogue (S14): their names are the table's own. */
      var fac = R.facility(data, id);
      t.equal(T.bastion.stripBack.facilities[id], fac ? fac.name : { wyvern_roost: 'Wyvern Roost', griffin_tower: 'Griffin Tower', dire_wolf_den: 'Dire Wolf Den' }[id], id + ': spelt as the catalogue spells it');
    });
    t.equal(R.stripBackName(data, 'wyvern_roost'), 'Wyvern Roost', 'still named after its definition went');
    t.same(Object.keys(T.bastion.stripBack).sort(), ['facilities', 'menagerieValue', 'names', 'orders']);
    /* Still named when its definition has gone from the catalogue. */
    var gone = { bastion: T.bastion, facilities: T.bastionFacilities.filter(function (f) { return f.id !== 'war_room'; }) };
    t.equal(R.stripBackName(gone, 'war_room'), 'War Room');
  });

  group('Strip Back: the audit (the seven guarantees)');

  /* A conversion that refunds, to break in turn. */
  function good() {
    var raw = v3(function (s) {
      s.treasuryGP = 400;
      s.favour = { telluria: 10, aurush: 50, pelagos: 95 };
      s.warehouse = [{ id: 'w1', item: 'Rope (50 ft)', qty: 2, gp: '', notes: '' }, { id: 'w2', goodId: 'raw_timber', item: 'Raw Timber', qty: 1, gp: '', notes: '' }];
      s.pendingOrders = [
        { id: 'k', facId: 'workshop', fnId: 'craft', label: 'Workshop: Craft (Dagger)', costGP: 0, issuedDay: 10, dueDay: 13 },
        ghost('g1', { costGP: 120, inputs: [held('raw_timber', 3)] })
      ];
      s.creatures = [{ id: 'c1', species: 'griffin', owner: '', name: 'Swiftwing', status: 'housed', home: 'griffin_tower', grantedDay: 1, housedDay: 3, msgId: '', development: R.newDevelopment({ id: 'c1' }, 3) }];
      s.bridge = R.cleanBridge({ fresh: false, done: { 'm-1': { r: 'applied', day: 5, at: 1, clan: 'karr', hr: 1, was: 0, now: 1, text: 't', why: '' } } });
      s.dmEdits = { done: { 'e-1': { r: 'applied', at: 1, day: 3, kind: 'pc', key: 'karr', was: 0, now: 5, why: '' } } };
      s.greatRites = [{ id: 'r1', rite: 'tides_passage', god: 'pelagos', madeDay: 4, status: 'waiting' }];
      s.word = [{ day: 11, lines: ['x'] }];
      s.research = { herbal_gardens: { agricultural: ['fertile_soil'] } };
      s.tradeNetwork.portCharters = [{ id: 'ch1', port: 'goldport', clan: 'Slade', mode: 'commodity_backed', status: 'registered', earnedDay: 2, registeredDay: 4, terms: {}, from: { code: '', title: '' }, text: '' }];
      s.tradeNetwork.protections = { pelagos_blessing: { charges: 1 } };
    });
    return convert(raw);
  }
  function audit(res, mutate) {
    var after = clone(res.save);
    var report = clone(res.report);
    mutate(after, report);
    return R.stripBackAudit(res.before, after, report, data);
  }
  function caught(t, res, mutate, pattern, why) {
    var problems = audit(res, mutate);
    t.ok(problems.length > 0, why + ': nothing was caught');
    t.ok(problems.some(function (p) { return pattern.test(p); }), why + ': ' + JSON.stringify(problems));
  }

  test('a clean conversion passes every check', function (t) {
    var res = good();
    t.same(res.problems, []);
    t.equal(res.save.treasuryGP, 520);
    t.same(res.report.cancelled.length, 1);
  });

  test('I1, gold: a lower treasury, gold that is not itemised, or a refund that is not what the orders cost is caught', function (t) {
    var res = good();
    caught(t, res, function (a) { a.treasuryGP = 399; }, /treasury would go down/, 'lower than before');
    caught(t, res, function (a) { a.treasuryGP = 521; }, /treasury changes by/, 'a pound that is not reported');
    caught(t, res, function (a) { a.treasuryGP = 400; }, /treasury changes by 0 gp, but the report says 120/, 'a refund that was not paid');
    caught(t, res, function (a, r) { r.gold.items = []; }, /Not every pound is itemised/, 'no itemised lines');
    caught(t, res, function (a, r) { r.gold.items[0].gp = 100; }, /itemised/, 'a line that does not add up');
    caught(t, res, function (a, r) { r.gold.refunded = 119; a.treasuryGP = 519; r.gold.items[0].gp = 119; }, /not what the cancelled orders cost/, 'a refund smaller than the order cost');
    caught(t, res, function (a, r) { r.gold.refunded = -1; }, /whole number/, 'a negative amount');
  });

  test('I2, Warehouse: goods that go missing, goods that appear, and a row typed by hand that changes are caught', function (t) {
    var res = good();
    t.equal(res.save.warehouse.filter(function (w) { return w.goodId === 'raw_timber'; })[0].qty, 4);
    caught(t, res, function (a) { a.warehouse.forEach(function (w) { if (w.goodId === 'raw_timber') w.qty = 3; }); }, /raw timber would be 3, not 4/, 'a lot lost');
    caught(t, res, function (a) { a.warehouse.forEach(function (w) { if (w.goodId === 'raw_timber') w.qty = 5; }); }, /raw timber would be 5, not 4/, 'a lot made from nothing');
    caught(t, res, function (a) { a.warehouse.push({ id: 'x', goodId: 'sawn_lumber', item: 'Sawn Lumber', qty: 1, gp: '', notes: '' }); }, /sawn lumber/, 'another good appears');
    caught(t, res, function (a) { a.warehouse[0].qty = 1; }, /written by hand/, 'a typed row changes');
    caught(t, res, function (a, r) { r.goods[0].qty = 2; }, /not what the cancelled orders held/, 'the report says less than was held');
  });

  test('I3, Favour: lower, past 100%, or not what the orders used is caught; overflow is allowed only when the bar is full', function (t) {
    var shrine = v3(function (s) {
      s.favour = { telluria: 10, aurush: 50, pelagos: 95 };
      s.pendingOrders = [{ id: 'f1', facId: 'shrine_pelagos', fnId: 'prepare_aquatic_protection_charm', label: 'Shrine of Pelagos: Prepare Aquatic Protection Charm', costGP: 0, favourCost: 10, issuedDay: 10, dueDay: 14 }];
    });
    /* Cancel it by hand, as a later step will, then audit that result. */
    var after = clone(shrine);
    var report = R.stripBackNewReport(after, data);
    R.stripBackCancel(after, data, report, after.pendingOrders[0], 'a reason');
    after.v = 4;
    t.same(R.stripBackAudit(shrine, after, report, data).filter(function (p) { return !/converted again|version/.test(p); }), [], 'a refund with overflow passes');
    function only(mutate) { var a = clone(after), r = clone(report); mutate(a, r); return R.stripBackAudit(shrine, a, r, data).filter(function (p) { return !/converted again|version/.test(p); }); }
    t.ok(only(function (a) { a.favour.pelagos = 90; }).some(function (p) { return /Pelagos's Favour would go down/.test(p); }), 'lower');
    t.ok(only(function (a) { a.favour.aurush = 49; }).some(function (p) { return /Aurush's Favour would go down/.test(p); }), 'another god\'s bar');
    t.ok(only(function (a) { a.favour.pelagos = 105; }).some(function (p) { return /pass 100%/.test(p); }), 'past 100');
    t.ok(only(function (a) { a.favour.telluria = 12; }).some(function (p) { return /Telluria's Favour changes by 2%/.test(p); }), 'a bar that changes with no report');
    t.ok(only(function (a, r) { r.favour.lost.pelagos = 0; }).some(function (p) { return /not what the cancelled orders used/.test(p); }), 'overflow not reported');
    t.ok(only(function (a, r) { a.favour.pelagos = 97; r.favour.pelagos = 2; r.favour.lost.pelagos = 8; }).some(function (p) { return /held back although its bar is not full/.test(p); }), 'held back with room on the bar');
  });

  test('I4, orders: one that vanishes, one listed as cancelled that is still there, a new one, and a cancel with no reason are caught', function (t) {
    var res = good();
    t.same(res.save.pendingOrders.map(function (o) { return o.id; }), ['k']);
    caught(t, res, function (a) { a.pendingOrders = []; }, /not accounted for/, 'the kept order vanishes');
    caught(t, res, function (a) { a.pendingOrders.push(ghost('g1')); }, /not accounted for/, 'a cancelled order is still there');
    caught(t, res, function (a) { a.pendingOrders.push(ghost('brand-new')); }, /not accounted for/, 'an order that was never there');
    caught(t, res, function (a, r) { r.cancelled[0].why = ''; }, /without its name or its reason/, 'no reason');
    caught(t, res, function (a, r) { r.cancelled.push({ id: 'nope', label: 'X', why: 'y', gp: 0, favour: 0, god: '', goods: [] }); }, /no such order/, 'a cancel of an order that was never there');
    caught(t, res, function (a, r) { r.moved.push({ id: 'ghost', label: 'X', to: 'y' }); }, /listed as moved is not in the converted Bastion/, 'a move to nowhere');
    /* A moved order passes when it is still there. */
    var moved = clone(res);
    moved.report.moved = [{ id: 'k', label: 'Workshop: Craft (Dagger)', to: 'the Workshop' }];
    moved.save.pendingOrders[0].fnId = 'smithing';
    t.same(R.stripBackAudit(moved.before, moved.save, moved.report, data), []);
  });

  test('I5, creatures: the same animals and the same development; only a home may change', function (t) {
    var res = good();
    t.same(audit(res, function (a) { a.creatures[0].home = 'beast_pen'; }), [], 'a home may change');
    caught(t, res, function (a) { a.creatures = []; }, /number of creatures/, 'one released');
    caught(t, res, function (a) { a.creatures[0].development.bond.level = 2; }, /creature would change/, 'a bond raised');
    caught(t, res, function (a) { a.creatures[0].development.chronicle = []; a.creatures[0].development.seq = 9; }, /creature would change/, 'a Chronicle changed');
    caught(t, res, function (a) { a.creatures[0].status = 'waiting'; }, /creature would change/, 'a status changed');
    caught(t, res, function (a) { a.creatures[0].name = 'Other'; }, /creature would change/, 'a name changed');
    caught(t, res, function (a) { a.creatures.push({ id: 'new', species: 'griffin' }); }, /number of creatures/, 'one made up');
  });

  test('I6, the records that must never change: the Explorer link\'s receipts, the DM doc\'s edits, scores, Great Rites, research, word, Charters, the Blessing of Pelagos', function (t) {
    var res = good();
    caught(t, res, function (a) { delete a.bridge.done['m-1']; }, /bridge record would change/, 'a lost Explorer receipt (the one way a change could count twice)');
    caught(t, res, function (a) { a.dmEdits.done = {}; }, /dmEdits record/, 'a DM doc edit receipt lost');
    caught(t, res, function (a) { a.politicalCapital.karr = 1; }, /politicalCapital/, 'Political Capital');
    caught(t, res, function (a) { a.honourRespectByClan.karr = 1; }, /honourRespectByClan/, 'Honour and Respect');
    caught(t, res, function (a) { a.greatRites = []; }, /greatRites/, 'a Great Rite');
    caught(t, res, function (a) { a.research = {}; }, /research/, 'research');
    caught(t, res, function (a) { a.word = []; }, /word/, 'the word from the Ironbow');
    caught(t, res, function (a) { a.diplomaticRecords.next = 9; }, /diplomaticRecords/, 'the Diplomatic Records');
    caught(t, res, function (a) { a.tradeNetwork.portCharters = []; }, /portCharters/, 'a Port Charter');
    caught(t, res, function (a) { a.tradeNetwork.voyages = [{ id: 'v' }]; }, /voyages/, 'a ship');
    caught(t, res, function (a) { a.tradeNetwork.schedules = [{ id: 's' }]; }, /schedules/, 'a standing shipment');
    caught(t, res, function (a) { a.tradeNetwork.cargoSales = [{ id: 's' }]; }, /cargoSales/, 'a sale');
    caught(t, res, function (a) { a.tradeNetwork.marketLedger = [{ day: 1 }]; }, /marketLedger/, 'the ledger');
    caught(t, res, function (a) { a.tradeNetwork.parcels = [{ id: 'p' }]; }, /parcels/, 'a parcel');
    caught(t, res, function (a) { a.tradeNetwork.protections.pelagos_blessing = { charges: 0 }; }, /Pelagos blessing/, 'the Blessing of Pelagos');
    t.same(audit(res, function (a) { a.tradeNetwork.active = true; a.tradeNetwork.stability = 10; }), [], 'the rest of the trade network (the Hall\'s old money) is not on the list: a later step winds it down');
  });

  test('I7, converting again changes nothing: a conversion that would leave something to convert, or would change again, is caught', function (t) {
    var res = good();
    caught(t, res, function (a) { a.pendingOrders.push(ghost('g1')); a.treasuryGP = 400; }, /converted again|not accounted/, 'something left behind');
    caught(t, res, function (a) { a.v = 3; }, /version 4|converted again/, 'not marked version 4');
    var tripped = clone(R.stripBackSteps);
    R.stripBackSteps.splice(0, 0, { id: 'restless', detect: function () { return []; }, run: function (s) { s.restless = (s.restless || 0) + 1; } });
    try {
      var bad = convert(v3());
      t.ok(bad.problems.some(function (p) { return /steps again would change/.test(p); }), JSON.stringify(bad.problems));
    } finally {
      R.stripBackSteps.splice(0, 1);
    }
    t.equal(R.stripBackSteps.length, tripped.length);
    t.same(R.stripBackAudit(null, null, null), ['The converted Bastion could not be compared with the one it started from.']);
  });

  group('Strip Back: the audit compares every order with what it was');

  /* A Bastion with one order that stays (paid in gold, Favour and goods) and one that is cancelled. */
  function keptRes() {
    return convert(v3(function (s) {
      s.warehouse = [{ id: 'w2', goodId: 'raw_timber', item: 'Raw Timber', qty: 1, gp: '', notes: '' }];
      s.pendingOrders = [
        { id: 'k', facId: 'workshop', fnId: 'craft', chosen: { label: 'Dagger', craftItem: 'Dagger' }, optionLabel: 'Dagger', notes: '', label: 'Workshop: Craft (Dagger)', costGP: 25, favourCost: 5, inputs: [held('raw_timber', 2)], issuedDay: 10, dueDay: 13, meta: { note: 'x' } },
        ghost('g1', { costGP: 120, inputs: [held('raw_timber', 3)] })
      ];
    }));
  }

  test('a KEPT order must come across exactly: zeroed goods, a dropped Favour cost, a changed due or issue day or gold cost, and any change the report does not mention are all caught', function (t) {
    var res = keptRes();
    t.same(res.problems, [], 'unchanged, it passes');
    t.same(res.save.pendingOrders.map(function (o) { return o.id; }), ['k']);
    caught(t, res, function (a) { a.pendingOrders[0].inputs = []; }, /"Workshop: Craft \(Dagger\)" would have its goods held changed/, 'its held goods zeroed');
    caught(t, res, function (a) { a.pendingOrders[0].inputs[0].qty = 1; }, /goods held changed/, 'a lot fewer held');
    caught(t, res, function (a) { delete a.pendingOrders[0].inputs; }, /goods held changed/, 'its held goods dropped');
    caught(t, res, function (a) { delete a.pendingOrders[0].favourCost; }, /would have its Favour cost changed/, 'its Favour cost dropped');
    caught(t, res, function (a) { a.pendingOrders[0].favourCost = 0; }, /Favour cost changed/, 'its Favour cost zeroed');
    caught(t, res, function (a) { a.pendingOrders[0].dueDay = 14; }, /would have its due day changed/, 'its due day moved on');
    caught(t, res, function (a) { a.pendingOrders[0].issuedDay = 9; }, /would have its issue day changed/, 'its issue day changed');
    caught(t, res, function (a) { a.pendingOrders[0].costGP = 0; }, /would have its gold cost changed/, 'its gold cost zeroed');
    caught(t, res, function (a) { a.pendingOrders[0].label = 'Workshop: Craft (Sword)'; }, /would be changed, but the report does not say it moved/, 'a new name with no report entry');
    caught(t, res, function (a) { a.pendingOrders[0].facId = 'dock'; }, /does not say it moved/, 'a new place with no report entry');
    caught(t, res, function (a) { a.pendingOrders[0].chosen = { label: 'Sword' }; }, /does not say it moved/, 'a different choice with no report entry');
    caught(t, res, function (a) { a.pendingOrders[0].meta = { note: 'y' }; }, /does not say it moved/, 'its notes in meta changed');
    caught(t, res, function (a) { a.pendingOrders[0].extra = 1; }, /does not say it moved/, 'a field added');
  });

  test('two orders that share an id can\'t be told apart, but together they must come across exactly', function (t) {
    var res = convert(v3(function (s) {
      s.pendingOrders = [
        { id: 'twin', facId: 'workshop', fnId: 'craft', label: 'Workshop: Craft (Dagger)', costGP: 25, favourCost: 5, issuedDay: 10, dueDay: 13, inputs: [held('raw_timber', 2)] },
        { id: 'twin', facId: 'workshop', fnId: 'craft', label: 'Workshop: Craft (Dagger)', costGP: 25, favourCost: 5, issuedDay: 10, dueDay: 14, inputs: [held('raw_timber', 1)] }
      ];
    }));
    t.same(res.problems, [], 'unchanged, they pass');
    caught(t, res, function (a) { a.pendingOrders[1].inputs = []; }, /Orders that share the id "twin" would be changed/, 'one of them has its held goods zeroed');
    caught(t, res, function (a) { a.pendingOrders[0].dueDay = 20; }, /share the id "twin"/, 'one has a new due day');
    var swapped = audit(res, function (a) { a.pendingOrders.reverse(); });
    t.same(swapped, [], 'only the order they are listed in changed: that is not a loss');
  });

  /* The Bastion before and after a step MOVES the order 'k' to the Workshop's Smithing, as a later step will. */
  function movedPair(patch) {
    var before = keptRes().before;
    var after = clone(before);
    after.v = 4;
    var report = R.stripBackNewReport(after, data);
    var o = after.pendingOrders.filter(function (x) { return x.id === 'k'; })[0];
    R.stripBackMoveOrder(report, o, patch || { fnId: 'smithing', label: 'Workshop: Smithing (Dagger)' }, 'the Workshop\'s Smithing');
    after.pendingOrders = after.pendingOrders.filter(function (x) { return x.id === 'k'; });
    var g = before.pendingOrders.filter(function (x) { return x.id === 'g1'; })[0];
    /* The other order is cancelled, so its refund is recorded the usual way. */
    var spare = clone(before);
    var rep2 = R.stripBackNewReport(spare, data);
    R.stripBackCancel(spare, data, rep2, spare.pendingOrders.filter(function (x) { return x.id === 'g1'; })[0], 'a reason');
    spare.pendingOrders = spare.pendingOrders.filter(function (x) { return x.id !== 'g1'; });
    after.treasuryGP = spare.treasuryGP;
    after.warehouse = spare.warehouse;
    rep2.moved = report.moved;
    rep2.day = report.day;
    return { before: before, after: after, report: rep2 };
  }
  function movedAudit(pair, mutate) {
    var after = clone(pair.after), report = clone(pair.report);
    if (mutate) mutate(after, report);
    return R.stripBackAudit(pair.before, after, report, data);
  }

  test('a MOVED order passes when only its place and name changed, and is caught if anything paid, anything else, or the report entry is missing', function (t) {
    var pair = movedPair();
    t.same(movedAudit(pair), [], 'a move of its place and name only');
    t.same(pair.report.moved, [{ id: 'k', label: 'Workshop: Craft (Dagger)', to: 'the Workshop\'s Smithing' }]);
    function caughtMoved(mutate, pattern, why) {
      var problems = movedAudit(pair, mutate);
      t.ok(problems.some(function (p) { return pattern.test(p); }), why + ': ' + JSON.stringify(problems));
    }
    caughtMoved(function (a) { a.pendingOrders[0].costGP = 0; }, /gold cost changed/, 'moved, and its gold cost zeroed');
    caughtMoved(function (a) { a.pendingOrders[0].favourCost = 1; }, /Favour cost changed/, 'moved, and its Favour cost changed');
    caughtMoved(function (a) { a.pendingOrders[0].inputs = []; }, /goods held changed/, 'moved, and its held goods zeroed');
    caughtMoved(function (a) { a.pendingOrders[0].dueDay = 20; }, /due day changed/, 'moved, and its due day changed');
    caughtMoved(function (a) { a.pendingOrders[0].issuedDay = 1; }, /issue day changed/, 'moved, and its issue day changed');
    caughtMoved(function (a) { a.pendingOrders[0].meta = { note: 'z' }; }, /more than its place and name would change/, 'moved, and its meta changed');
    caughtMoved(function (a) { a.pendingOrders[0].extra = true; }, /more than its place and name/, 'moved, and a field added');
    caughtMoved(function (a, r) { r.moved = []; }, /does not say it moved/, 'the report forgets to say it moved');
  });

  test('a move may change only an order\'s place and name: its id, cost, Favour, held goods, days and meta are refused, and nothing is applied', function (t) {
    t.same(R.STRIP_BACK_MOVE_KEYS, ['facId', 'fnId', 'label', 'optionLabel', 'chosen', 'notes']);
    ['id', 'costGP', 'favourCost', 'inputs', 'issuedDay', 'dueDay', 'meta', 'extra'].forEach(function (k) {
      var o = { id: 'k', facId: 'library_scriptorium', fnId: 'research', label: 'Library & Scriptorium: Research (Geographical Scriptures)', costGP: 5, favourCost: 0, inputs: [held('raw_timber', 1)], issuedDay: 9, dueDay: 14, meta: { a: 1 } };
      var before = canon(o);
      var report = R.stripBackNewReport({}, data);
      var patch = { facId: 'workshop' };
      patch[k] = k === 'id' ? 'other' : 0;
      t.throws(function () { R.stripBackMoveOrder(report, o, patch, 'the Workshop'); }, 'refused: ' + k);
      t.equal(canon(o), before, k + ': nothing was applied, not even the allowed part');
      t.same(report.moved, [], k + ': nothing recorded');
    });
    var o = { id: 'k', facId: 'library_scriptorium', fnId: 'research', label: 'L: R', chosen: { label: 'a' }, optionLabel: 'a', notes: '', costGP: 5, issuedDay: 9, dueDay: 14 };
    var report = R.stripBackNewReport({}, data);
    R.stripBackMoveOrder(report, o, { facId: 'workshop', fnId: 'scholar', label: 'Workshop: Scholar', chosen: { label: 'b' }, optionLabel: 'b', notes: 'moved' }, 'the Workshop');
    t.same([o.facId, o.fnId, o.label, o.chosen, o.optionLabel, o.notes, o.costGP, o.dueDay], ['workshop', 'scholar', 'Workshop: Scholar', { label: 'b' }, 'b', 'moved', 5, 14], 'place and name change; what was paid does not');
    t.throws(function () { R.stripBackMoveOrder(report, { facId: 'a', fnId: 'b', label: 'x' }, { facId: 'c' }, 'y'); }, 'an order with no id can\'t be moved');
  });

  test('a CANCELLED order is checked against the order it was: an under-refund of gold, goods or Favour fails, and so does Favour that simply vanishes', function (t) {
    var res = good();
    t.same(res.problems, []);
    /* Everything below is made CONSISTENT with itself (the report, the treasury and the Warehouse agree), so only the
       comparison with the original order can see it. */
    caught(t, res, function (a, r) {
      r.cancelled[0].gp = 100; r.gold.refunded = 100; r.gold.items[0].gp = 100; a.treasuryGP = 500;
    }, /"Old Mill: Grind Grain" cost 120 gp, but 100 gp is handed back for it/, 'gold under-refunded, consistently');
    caught(t, res, function (a, r) {
      r.cancelled[0].gp = 0; r.gold.refunded = 0; r.gold.items = []; a.treasuryGP = 400;
    }, /cost 120 gp, but 0 gp is handed back/, 'gold not refunded at all, consistently');
    caught(t, res, function (a, r) {
      r.cancelled[0].goods[0].qty = 2; r.goods[0].qty = 2;
      a.warehouse.forEach(function (w) { if (w.goodId === 'raw_timber') w.qty = 3; });
    }, /"Old Mill: Grind Grain" held goods that are not all put back in the Warehouse/, 'goods under-returned, consistently');
    caught(t, res, function (a, r) {
      r.cancelled[0].goods = []; r.goods = [];
      a.warehouse.forEach(function (w) { if (w.goodId === 'raw_timber') w.qty = 1; });
    }, /held goods that are not all put back/, 'goods not returned at all, consistently');
    /* Favour: a Shrine order cancelled by hand, as a later step does. */
    var shrine = v3(function (s) {
      s.favour = { telluria: 10, aurush: 50, pelagos: 40 };
      s.pendingOrders = [{ id: 'f1', facId: 'shrine_pelagos', fnId: 'prepare_aquatic_protection_charm', label: 'Shrine of Pelagos: Prepare Aquatic Protection Charm', costGP: 0, favourCost: 10, issuedDay: 10, dueDay: 14 }];
    });
    var after = clone(shrine);
    var report = R.stripBackNewReport(after, data);
    R.stripBackCancel(after, data, report, after.pendingOrders[0], 'the Temple replaces the Shrines');
    after.v = 4;
    function favourProblems(mutate) {
      var a = clone(after), r = clone(report);
      mutate(a, r);
      return R.stripBackAudit(shrine, a, r, data).filter(function (p) { return /Favour/.test(p); });
    }
    t.same(favourProblems(function () {}), [], 'the whole 10% handed back passes');
    t.equal(after.favour.pelagos, 50);
    t.ok(favourProblems(function (a, r) { r.cancelled[0].favour = 5; r.favour.pelagos = 5; a.favour.pelagos = 45; }).some(function (p) { return /used 10% of a god's Favour, but 5% is handed back/.test(p); }), 'only half handed back, consistently');
    t.ok(favourProblems(function (a, r) { r.cancelled[0].favour = 0; r.cancelled[0].god = ''; r.favour.pelagos = 0; a.favour.pelagos = 40; }).some(function (p) { return /used 10% of a god's Favour, but 0% is handed back/.test(p); }), 'the Favour simply vanishes, consistently');
    t.same(report.cancelled[0].favourUnplaced, 0, 'with a Shrine\'s god the helper never leaves any unplaced');
    /* An order at a place with no god: the helper says the Favour could not be given back. */
    var nogod = v3(function (s) { s.pendingOrders = [ghost('g9', { favourCost: 10, costGP: 0 })]; });
    var res2 = convert(nogod);
    t.same(res2.problems, []);
    t.same([res2.report.cancelled[0].favour, res2.report.cancelled[0].favourUnplaced], [0, 10]);
    var hidden = clone(res2);
    hidden.report.cancelled[0].favourUnplaced = 0;
    t.ok(R.stripBackAudit(hidden.before, hidden.save, hidden.report, data).some(function (p) { return /used 10% of a god's Favour, but 0% is handed back/.test(p); }), 'Favour dropped with no mention fails');
  });

  group('Strip Back: a report nobody has read yet is never lost');

  test('converting again before "I\'ve read this": the earlier lines are kept, the new ones added after them, and it does not blame an older copy of the suite', function (t) {
    var first = convert(v3(function (s) {
      s.treasuryGP = 400;
      s.pendingOrders = [ghost('g1', { costGP: 120, inputs: [held('raw_timber', 3)] })];
    }));
    t.same(first.problems, []);
    var firstLines = first.save.migration.v4.lines.slice();
    t.equal(first.save.migration.v4.shown, false);
    t.equal(first.save.migration.v4.gp, 120);
    /* Before it is read, something saves another order at an unknown facility over it. */
    var dirty = clone(first.save);
    dirty.pendingOrders.push(ghost('g2', { label: 'Sawpit: Cut Planks', facId: 'sawpit', costGP: 45 }));
    var second = convert(dirty);
    t.same(second.problems, []);
    var m = second.save.migration.v4;
    t.equal(m.shown, false, 'still to be read');
    t.same(m.lines.slice(0, firstLines.length), firstLines, 'the earlier lines are kept exactly, in order');
    t.equal(m.lines[firstLines.length], 'More was found on Day 12 and put right the same way.');
    t.ok(m.lines.slice(firstLines.length + 1).some(function (l) { return /^Gold\. 45 gp went back into the treasury \(on Day 12 it went from 520 gp to 565 gp\): Sawpit: Cut Planks, 45 gp\.$/.test(l); }), JSON.stringify(m.lines));
    t.ok(m.lines.some(function (l) { return /^Gold\. 120 gp went back into the treasury \(on Day 12 it went from 400 gp to 520 gp\): Old Mill: Grind Grain, 120 gp\.$/.test(l); }), 'the first conversion\'s gold is still itemised');
    t.equal(m.gp, 165, 'the gold handed back adds up');
    t.equal(m.again, false, 'an older copy is NOT blamed: the first report was never read');
    t.equal(m.changed, true);
    t.equal(m.summary, '120 gp went back into the treasury; 1 order was cancelled; goods went back to the Warehouse; then, on Day 12: 45 gp went back into the treasury; 1 order was cancelled.');
    t.equal(R.stripBackHeadline(m), 'The Bastion has changed. Here is exactly what happened to yours.');
    t.equal(second.save.treasuryGP, 565);
    /* A third time with nothing to say leaves the unread report exactly as it was. */
    var quiet = clone(second.save);
    quiet.facilityLevels.old_mill = 2;
    var third = convert(quiet);
    t.same(third.problems, []);
    t.equal(R.needsStripBack(quiet, data), true);
    t.same(third.save.migration.v4, m, 'a leftover with nothing to say changes nothing in the unread report');
  });

  test('"an older copy of the suite had saved over it" is said only when the earlier report HAD been read and something then reappeared', function (t) {
    var first = convert(v3(function (s) { s.pendingOrders = [ghost('g1', { costGP: 120 })]; })).save;
    var read = clone(first);
    read.migration.v4.shown = true;
    read.pendingOrders.push(ghost('late', { costGP: 45 }));
    var again = convert(read);
    t.same(again.problems, []);
    t.same([again.save.migration.v4.again, again.save.migration.v4.shown], [true, false]);
    t.equal(R.stripBackHeadline(again.save.migration.v4), 'The Bastion has been tidied again.');
    t.ok(/An older copy of the suite had saved over your Bastion/.test(R.stripBackText(again.save.migration.v4)));
    t.same(again.save.migration.v4.lines, [
      'Gold. 45 gp went back into the treasury (on Day 12 it went from 520 gp to 565 gp): Old Mill: Grind Grain, 45 gp.',
      'Orders. One order was cancelled: Old Mill: Grind Grain (the Old Mill is no longer part of the Bastion).'
    ], 'the new conversion\'s lines only: the read report is not repeated');
    var unread = clone(first);
    unread.pendingOrders.push(ghost('late', { costGP: 45 }));
    var merged = convert(unread);
    t.equal(merged.save.migration.v4.again, false);
    t.ok(R.stripBackText(merged.save.migration.v4).indexOf('An older copy of the suite') === -1, 'not blamed');
    /* A version 4 save with no report at all, and a leftover: not blamed either. */
    var none = convert(clone(first));
    t.same(none.report.lines, [], 'a clean version 4 save needs nothing');
    var noReport = clone(first);
    delete noReport.migration;
    noReport.pendingOrders.push(ghost('late', { costGP: 45 }));
    var res = convert(noReport);
    t.equal(res.save.migration.v4.again, false, 'nothing was ever reported, so there is no "older copy" to blame');
    t.equal(R.stripBackHeadline(res.save.migration.v4), 'The Bastion has changed. Here is exactly what happened to yours.');
    /* An unread report that said nothing, then something found: the new lines stand alone. */
    var quiet = convert(v3()).save;
    quiet.pendingOrders.push(ghost('late', { costGP: 45 }));
    var fromQuiet = convert(quiet);
    t.same(fromQuiet.save.migration.v4.lines, ['Gold. 45 gp went back into the treasury (on Day 12 it went from 400 gp to 445 gp): Old Mill: Grind Grain, 45 gp.', 'Orders. One order was cancelled: Old Mill: Grind Grain (the Old Mill is no longer part of the Bastion).']);
    t.equal(fromQuiet.save.migration.v4.changed, true);
    t.ok(!/More was found/.test(fromQuiet.save.migration.v4.lines.join(' ')), 'nothing earlier to add to');
  });

  group('Strip Back: what is stored still reads true later');

  test('the stored lines say what happened ON THAT DAY, so reading them again after play is still true: no "it is now"', function (t) {
    var steps = R.stripBackSteps;
    /* A Shrine order cancelled by a step, as a later step will, so Favour is in the report too. */
    steps.splice(0, 0, {
      id: 'tmpshrine', detect: function () { return []; },
      run: function (s, d, report) { (s.pendingOrders || []).slice().forEach(function (o) { if (o.facId === 'shrine_pelagos') R.stripBackCancel(s, d, report, o, 'the Temple replaces the Shrines'); }); }
    });
    var res;
    try {
      res = convert(v3(function (s) {
        s.treasuryGP = 400;
        s.favour = { telluria: 10, aurush: 50, pelagos: 95 };
        s.pendingOrders = [{ id: 'f1', facId: 'shrine_pelagos', fnId: 'prepare_aquatic_protection_charm', label: 'Shrine of Pelagos: Prepare Aquatic Protection Charm', costGP: 30, favourCost: 10, issuedDay: 10, dueDay: 14 }];
      }));
    } finally {
      steps.splice(0, 1);
    }
    t.same(res.problems, []);
    var m = res.save.migration.v4;
    t.equal(m.lines[0], 'Gold. 30 gp went back into the treasury (on Day 12 it went from 400 gp to 430 gp): Shrine of Pelagos: Prepare Aquatic Protection Charm, 30 gp.');
    t.equal(m.lines[1], 'Favour. Pelagos: 5% went back to the bar (on Day 12 it went from 95% to 100%). Pelagos\'s bar was too full to take back 5% of what its orders had used.');
    var before = JSON.stringify(m);
    /* Play goes on: the treasury and the bar move. The stored words must not change meaning. */
    var played = clone(res.save);
    played.treasuryGP = 9999;
    played.favour.pelagos = 12;
    t.equal(JSON.stringify(played.migration.v4), before, 'the report is not touched by play');
    var text = R.stripBackText(played.migration.v4);
    t.ok(text.indexOf('on Day 12 it went from 400 gp to 430 gp') !== -1);
    m.lines.forEach(function (l) {
      t.ok(!/\bnow\b/i.test(l), 'no "now" in: ' + l);
      t.ok(!/\bit is\b|\bis at\b|\bis now\b/.test(l), 'no present-tense claim about a balance in: ' + l);
    });
    t.ok(!/\bnow\b/i.test(text.replace(/\bno longer\b/g, '')), 'nor in the text file');
  });


  group('Strip Back: the fixtures');

  test('the fixtures are all here: the seven earlier Bastions and the heavy one', function (t) {
    t.same(Object.keys(FIX).sort(), ['bastion-before-overhaul', 'bastion-pr3-sample', 'bastion-pr5-sample', 'bastion-pr6-sample', 'bastion-pr7-sample', 'bastion-pr8a-sample', 'bastion-pr8b-sample', 'bastion-v3-heavy']);
    t.equal(FIX['bastion-before-overhaul'].v, 2);
    t.equal(FIX['bastion-pr8b-sample'].v, 3);
    t.equal(FIX['bastion-v3-heavy'].v, 3);
  });

  test('every fixture converts safely and idempotently: the audit is clean, it is version 4, converting or loading again changes nothing', function (t) {
    Object.keys(FIX).forEach(function (name) {
      var raw = FIX[name];
      var before = canon(raw);
      var res = convert(raw);
      t.equal(canon(raw), before, name + ': the fixture itself is untouched');
      t.same(res.problems, [], name + ': the audit');
      t.equal(res.save.v, 4, name);
      t.equal(R.needsStripBack(res.save, data), false, name + ': nothing left to convert');
      t.equal(canon(R.migrateToV4(res.save, data).save), canon(res.save), name + ': converting again changes nothing');
      var loaded = R.fromSave(clone(raw), data);
      t.equal(loaded.v, 4, name + ': loads as version 4');
      var again = R.fromSave(R.toSave(loaded), data);
      t.same(again, loaded, name + ': loading twice gives the same Bastion');
      t.equal(loaded.treasuryGP >= clampTreasury(raw), true, name + ': the treasury is never lower');
    });
    function clampTreasury(s) { return Math.max(0, parseInt(s.treasuryGP, 10) || 0); }
  });

  test('so far the conversion changes nothing in any fixture except its version, the Bastion\'s event record (S05) and the Beast Handler\'s old request record (S13): the heavy Bastion keeps its 28 orders, 4 beasts and 200 log lines', function (t) {
    Object.keys(FIX).forEach(function (name) {
      if (name === 'bastion-before-overhaul') return;
      var res = convert(FIX[name]);
      /* The heavy one had an event to drop and the three creature buildings (S14); two earlier ones had the three buildings. */
      t.equal(res.report.lines.filter(function (l) { return !/^Places that joined others\. /.test(l) && !/^Beasts\. /.test(l) && !/^Gold\. /.test(l) && !/^Orders\. /.test(l); }).length, name === 'bastion-v3-heavy' ? 1 : 0, name + ': only the heavy one had an event to drop');
      var a = clone(res.save), b = clone(FIX[name]);
      delete a.migration; delete b.migration;
      delete b.lastEvent; delete b.lastEventDay;
      a.v = 3;
      /* Changed by the Beast Pen (S14): the slots, levels, orders and creatures' homes of the three creature buildings. They are checked in tests/rules/beast-pen.test.js. */
      if (res.report.archived.some(function (x) { return /^(wyvern_roost|griffin_tower|dire_wolf_den)$/.test(x.facId); })) {
        ['builtExtras', 'builtPlots', 'facilityLevels', 'archivedFacilities', 'creatures', 'pendingOrders', 'treasuryGP'].forEach(function (k) { delete a[k]; delete b[k]; });
      }
      /* Removed so far (S13): the Beast Handler's old request record. */
      if (b.beast) { delete b.beast.done; delete b.beast.accept; delete b.beast.floor; }
      t.equal(canon(a), canon(b), name + ': every other field exactly as it was');
    });
    var heavy = R.fromSave(clone(FIX['bastion-v3-heavy']), data);
    t.equal(heavy.v, 4);
    t.equal(heavy.pendingOrders.length, 27, '28, less the Riding Harness (cancelled and refunded)');
    t.equal(heavy.creatures.length, 4);
    t.equal(heavy.log.length, 200);
    t.equal(heavy.treasuryGP, 2150, '2,000 and the 150 gp harness back');
    t.same(heavy.builtExtras.filter(Boolean).map(function (e) { return e.facId; }), ['menagerie', 'war_room', 'library_scriptorium', 'arcane_laboratory', 'shrine_telluria', 'shrine_aurush', 'shrine_pelagos', 'beast_pen', 'hall_of_emissaries']);
    t.equal(heavy.migration.v4.changed, true, 'its event record was dropped, and it says so');
    t.equal('lastEvent' in heavy || 'lastEventDay' in heavy, false);
  });

  test('the heavy fixture has something in every part the overhaul touches', function (t) {
    var h = FIX['bastion-v3-heavy'];
    var facs = {};
    h.pendingOrders.forEach(function (o) { facs[o.facId] = true; });
    ['workshop', 'dock', 'herbal_gardens', 'timber_sawmill', 'barracks', 'watchtower', 'armoury', 'war_room', 'war_council', 'menagerie', 'library_scriptorium', 'arcane_laboratory', 'shrine_telluria', 'shrine_pelagos', 'hall_of_emissaries', 'trade_network', 'wyvern_roost', 'dire_wolf_den'].forEach(function (id) {
      t.ok(facs[id], 'a pending order at ' + id);
    });
    t.ok(h.pendingOrders.some(function (o) { return o.meta && o.meta.kind === 'upgrade'; }), 'an upgrade');
    t.ok(h.pendingOrders.some(function (o) { return o.costGP > 0 && o.favourCost > 0 || o.inputs; }), 'orders with gold, Favour and goods');
    t.ok(h.pendingOrders.filter(function (o) { return o.favourCost; }).length >= 3 && h.pendingOrders.filter(function (o) { return o.inputs; }).length >= 3);
    t.equal(h.creatures.length, 4);
    t.same(h.creatures.map(function (c) { return c.development ? c.development.bond.level : -1; }), [1, 2, 3, -1], 'bonds 1, 2 and 3, and one waiting with none');
    t.same([h.diplomacy.agreements.length, h.diplomacy.consortiums.length, h.tradeNetwork.routes.length, h.arbitration.queue.length, h.diplomacy.tokens], [2, 1, 2, 1, 2]);
    t.same(Object.keys(h.wars), ['bacca']);
    t.equal(h.military.length, 5, 'four regiments and a Lieutenants row');
    t.equal(h.defenderBeasts.length, 2);
    t.same([h.defenders.count, h.defenders.armed], [6, true]);
    t.equal(h.artisanTools.filter(Boolean).length, 6);
    t.same([h.organization.type, h.organization.name], ['clan', 'Clan Ironbow']);
    t.equal(h.log.length, 200);
    t.equal(h.greatRites.length, 1);
    t.same(h.tradeNetwork.protections, { pelagos_blessing: { charges: 1 } });
    t.ok(h.tradeNetwork.portCharters.some(function (c) { return c.termsLog && c.termsLog.length; }), 'a Charter with a terms history');
    t.equal(h.tradeNetwork.voyages.length, 1);
    t.equal(h.tradeNetwork.schedules.length, 1);
    t.equal(h.tradeNetwork.parcels.length, 2);
    t.ok(R.facility(data, 'war_room'), 'the facilities it uses are in the catalogue today');
  });

  test('a version 2 fixture goes through version 3 and then version 4 in one go, and the report holds both lists', function (t) {
    var raw = FIX['bastion-before-overhaul'];
    var before = canon(raw);
    var res = convert(raw);
    t.equal(canon(raw), before);
    t.same(res.problems, []);
    t.equal(res.save.v, 4);
    t.ok(res.report.v3Lines.length >= 3, 'the facilities change\'s lines are kept: ' + res.report.v3Lines.length);
    t.same(res.save.migration.v3.lines, res.report.v3Lines, 'version 3\'s own notice is kept as it was');
    t.equal(res.save.migration.v3.shown, false);
    t.equal(res.save.migration.v4.shown, false);
    t.ok(/^Facilities \(the change of 13 October 2026\)\. The Smithy joined the Workshop/.test(res.save.migration.v4.lines[0]), res.save.migration.v4.lines[0]);
    t.equal(res.save.migration.v4.changed, true);
    t.equal(R.stripBackHeadline(res.save.migration.v4), 'The Bastion has changed. Here is exactly what happened to yours.');
    t.same(res.save.pendingOrders.map(function (o) { return o.fnId; }).sort(), ['alchemy', 'smithing'], 'orders followed their facilities');
    t.equal(res.save.treasuryGP, 400);
    t.equal(R.fromSave(clone(raw), data).v, 4);
    t.equal(R.migrateToV3(res.save, data).save.v, 4, 'version 3\'s conversion leaves a version 4 save alone');
  });

  group('Strip Back: the Beast Handler\'s old requests (S13, 22 October 2026)');

  test('the old request record (receipts, the switch and the limit) is dropped; the campaign id and the handlers\' pairing codes stay, and it says nothing in the report', function (t) {
    var raw = v3(function (s) {
      s.beast = {
        campaignId: 'AbCdEfGh12345678', accept: false, floor: 1760000000000,
        handlers: [{ id: 'mira', name: 'Mira', secret: 'abcdefghijkmnpqrstuvwxyz', since: 4 }],
        done: { 'cmd-1-abcdef12': { r: 'applied', why: '', day: 4, at: 1760000000001, type: 'profile.set', handler: 'mira', who: 'Mira', creature: 'x', label: 'x', orderId: '', dueDay: null } }
      };
    });
    var res = convert(raw);
    t.same(res.problems, [], 'the audit');
    t.same(Object.keys(res.save.beast).sort(), ['campaignId', 'handlers']);
    t.equal(res.save.beast.campaignId, 'AbCdEfGh12345678');
    t.equal(res.save.beast.handlers[0].secret, 'abcdefghijkmnpqrstuvwxyz');
    t.same(res.report.lines, [], 'nothing for Harry to read about it');
    t.equal(res.save.migration.v4.changed, false);
    t.equal(R.needsStripBack(res.save, data), false);
    t.equal(canon(R.migrateToV4(res.save, data).save), canon(res.save), 'converting again changes nothing');
    t.ok(raw.beast.done, 'the save it was given is untouched');
  });

  test('a save with no Beast Handler record, or a damaged one, is not a problem', function (t) {
    t.same(convert(v3()).problems, []);
    ['x', 5, [1], null].forEach(function (v) {
      var res = convert(v3(function (s) { s.beast = v; }));
      t.same(res.problems, [], 'beast: ' + JSON.stringify(v));
      t.equal(res.save.v, 4);
    });
    var odd = convert(v3(function (s) { s.beast = { done: 'nope', floor: 'x', accept: 3, campaignId: 'AbCdEfGh12345678' }; }));
    t.same(Object.keys(odd.save.beast), ['campaignId']);
  });

  test('a version 4 save that still holds receipts, a raised limit or a switched-off switch is cleaned again; the empty shape older builds wrote is not worth a notice and loads quietly', function (t) {
    var once = convert(v3()).save;
    once.migration.v4.shown = true;
    [{ done: { 'cmd-1-abcdef12': { r: 'applied' } } }, { floor: 5 }, { accept: false }].forEach(function (extra) {
      var dirty = clone(once);
      dirty.beast = Object.assign({ campaignId: 'AbCdEfGh12345678', handlers: [] }, extra);
      t.equal(R.needsStripBack(dirty, data), true, JSON.stringify(Object.keys(extra)));
      t.equal(R.stripBackLeftovers(dirty, data)[0].step, 'dropBeastRequests');
      var res = convert(dirty);
      t.same(res.problems, []);
      t.same(Object.keys(res.save.beast).sort(), ['campaignId', 'handlers']);
    });
    var empty = clone(once);
    empty.beast = { campaignId: 'AbCdEfGh12345678', accept: true, handlers: [], done: {}, floor: 0 };
    t.equal(R.needsStripBack(empty, data), false, 'no notice for an empty shape');
    var loaded = R.fromSave(clone(empty), data);
    t.same(Object.keys(loaded.beast).sort(), ['campaignId', 'handlers'], 'but it loads without the three');
  });

  test('the heavy Bastion\'s old record (a receipt, two handlers with codes) converts: the audit is clean, and it loads with the handlers and without the receipt', function (t) {
    var h = FIX['bastion-v3-heavy'];
    t.ok(h.beast && h.beast.done && Object.keys(h.beast.done).length === 1 && h.beast.accept === true, 'the fixture has the old shape');
    var res = convert(h);
    t.same(res.problems, []);
    t.same(Object.keys(res.save.beast).sort(), ['campaignId', 'handlers']);
    t.same(res.save.beast.handlers.map(function (x) { return x.id; }), ['kaelen', 'umbrys']);
    var loaded = R.fromSave(clone(h), data);
    t.same(Object.keys(loaded.beast).sort(), ['campaignId', 'handlers']);
    t.equal(loaded.beast.campaignId, 'HvCampaign2610');
    t.same(R.fromSave(R.toSave(loaded), data), loaded, 'and loading again gives the same Bastion');
  });

  group('Strip Back: other ways a save can arrive');

  test('a version 4 save that an older copy of the suite overwrote (it holds something the Bastion no longer has) is cleaned again, with a short notice', function (t) {
    var once = convert(v3()).save;
    once.migration.v4.shown = true;
    var dirty = clone(once);
    dirty.builtExtras = [{ facId: 'old_mill', status: 'built' }];
    dirty.pendingOrders = [ghost('late', { costGP: 45 })];
    var res = convert(dirty);
    t.same(res.problems, []);
    t.equal(res.save.treasuryGP, 445);
    t.same(res.save.builtExtras, ['']);
    t.same([res.report.again, res.save.migration.v4.again, res.save.migration.v4.shown], [true, true, false], 'to be read again');
    t.equal(R.stripBackHeadline(res.save.migration.v4), 'The Bastion has been tidied again.');
    t.ok(/An older copy of the suite had saved over your Bastion/.test(R.stripBackText(res.save.migration.v4)));
    t.equal(R.needsStripBack(res.save, data), false);
  });

  test('a damaged value in a list the overhaul will drop is ignored, never refused or fatal; the three War Table saves are no longer checked on Import', function (t) {
    var raw = v3(function (s) { s.military = 'x'; s.warLog = 5; s.wars = [1]; s.defenderBeasts = { a: 1 }; s.militaryActions = 'no'; });
    var res = convert(raw);
    t.same(res.problems, []);
    t.equal(res.save.v, 4);
    t.equal(R.fromSave(clone(raw), data).v, 4, 'it loads');
    t.equal(R.importProblem([{ key: 'tsi.bastion.warMap', value: 'not a map' }, { key: 'tsi.bastion.warTable', value: 7 }, { key: 'tsi.bastion.warTerrain', value: [1] }]), null, 'an old backup is never refused for them');
    t.ok(/Bastion isn't in the right form/.test(R.importProblem([{ key: 'tsi.bastion.state', value: { treasuryGP: 1, partyLevel: 2, day: 3, builtExtras: 'x' } }])), 'the Bastion itself is still checked');
    t.equal(R.importProblem([{ key: 'tsi.bastion.state', value: convert(v3()).save }]), null, 'a version 4 save imports');
    t.same(R.STRIP_BACK_ORPHAN_KEYS, ['warMap', 'warTable', 'warTerrain']);
    t.same(R.stripBackOrphans(function (name) { return name === 'warTable' || name === 'crest'; }), ['warTable']);
    t.same(R.stripBackOrphans(function () { return false; }), []);
  });

  test('a save in turns is still "old", and a version 4 save is never mistaken for one', function (t) {
    t.equal(R.isOldSave({ turn: 4, treasuryGP: 1 }), true);
    t.equal(R.isOldSave({ v: 4, treasuryGP: 1, turn: 4 }), false);
    t.equal(R.isOldSave(convert(v3()).save), false);
  });

  test('a save with no version, a version below 2, or odd numbers still converts safely', function (t) {
    var raw = v3(function (s) { delete s.v; s.treasuryGP = '250'; s.favour = { telluria: 'x', aurush: 120, pelagos: -4 }; s.pendingOrders = [ghost('g1', { costGP: '15' })]; });
    var res = convert(raw);
    t.same(res.problems, []);
    t.equal(res.save.v, 4);
    t.equal(res.save.treasuryGP, 265);
    var loaded = R.fromSave(clone(raw), data);
    t.same([loaded.treasuryGP, loaded.favour.aurush, loaded.favour.pelagos], [265, 100, 0]);
  });

  group('Strip Back: what Harry reads');

  test('every line is plain English: no code words, no ids, plurals right, sentence case, and every cancelled order named by its saved label', function (t) {
    var raw = v3(function (s) {
      s.builtExtras = [{ facId: 'old_mill', status: 'built' }, { facId: 'sawpit', status: 'building', startDay: 8, readyDay: 29 }];
      s.builtPlots = [{ facId: 'old_mill', status: 'built' }];
      s.treasuryGP = 1200;
      s.warehouse = [{ id: 'w1', goodId: 'raw_timber', item: 'Raw Timber', qty: 1, gp: '', notes: '' }];
      s.pendingOrders = [
        ghost('g1', { costGP: 1000, inputs: [held('raw_timber', 1)] }),
        ghost('g2', { label: 'Sawpit: Cut Planks', facId: 'sawpit', costGP: 5, inputs: [held('alchemical_flowers', 1), held('restorative_herbs', 2), held('fresh_fish', 1)] }),
        ghost('g3', { label: 'Old Mill: Press Oil' })
      ];
    });
    var res = convert(raw);
    t.same(res.problems, []);
    var lines = res.save.migration.v4.lines;
    t.ok(lines.length >= 4);
    lines.forEach(function (line) {
      t.same(jargon(line), [], line);
      t.ok(/^[A-Z]/.test(line), 'starts with a capital: ' + line);
      t.ok(/\.$/.test(line), 'ends with a full stop: ' + line);
    });
    t.ok(/^Gold\. 1,005 gp went back into the treasury \(on Day 12 it went from 1,200 gp to 2,205 gp\)/.test(lines[0]), lines[0]);
    t.ok(/Old Mill: Grind Grain, 1,000 gp; Sawpit: Cut Planks, 5 gp/.test(lines[0]), lines[0]);
    var orders = lines.filter(function (l) { return /^Orders\./.test(l); })[0];
    t.ok(/^Orders\. 3 orders were cancelled: Old Mill: Grind Grain \(the Old Mill is no longer part of the Bastion\); Sawpit: Cut Planks \(the Sawpit is no longer part of the Bastion\); Old Mill: Press Oil \(the Old Mill is no longer part of the Bastion\)\.$/.test(orders), orders);
    t.equal(lines[1], 'Goods. 1 lot of Raw Timber, 1 portion of Alchemical Flowers, 2 portions of Restorative Herbs and 1 lot of Fresh Fish went back to the Warehouse.');
    /* One order, one lot: the singular. */
    var one = convert(v3(function (s) { s.pendingOrders = [ghost('g1', { costGP: 50, inputs: [held('raw_timber', 1)] })]; }));
    var ol = one.save.migration.v4.lines;
    t.ok(ol.some(function (l) { return /^Orders\. One order was cancelled: /.test(l); }), JSON.stringify(ol));
    t.ok(ol.some(function (l) { return /^Goods\. 1 lot of Raw Timber went back to the Warehouse\.$/.test(l); }), JSON.stringify(ol));
    ol.forEach(function (l) { t.same(jargon(l), [], l); });
    R.STRIP_BACK_HEADINGS.forEach(function (h) { t.same(jargon(h.title), [], h.title); });
  });

  test('the text file: the headline, the day, each paragraph and the note about the copy', function (t) {
    var res = convert(v3(function (s) { s.pendingOrders = [ghost('g1', { costGP: 50 })]; }));
    var text = R.stripBackText(res.save.migration.v4);
    var lines = text.split('\n');
    t.equal(lines[0], 'The Bastion has changed. Here is exactly what happened to yours.');
    t.ok(text.indexOf('Converted on Day 12 of the campaign.') !== -1);
    t.ok(text.indexOf('Gold. 50 gp went back into the treasury') !== -1);
    t.ok(text.indexOf('Orders. One order was cancelled: Old Mill: Grind Grain (the Old Mill is no longer part of the Bastion).') !== -1);
    t.ok(text.indexOf('"Back up everything"') !== -1);
    t.ok(/\n$/.test(text));
    t.same(jargon(text), []);
    var quiet = R.stripBackText(convert(v3()).save.migration.v4);
    t.ok(quiet.indexOf('The Bastion has been updated; nothing of yours changed.') === 0);
    t.equal(R.stripBackText(null), '');
    t.equal(R.stripBackHeadline(null), '');
    t.ok(R.stripBackSay, 'a later step can add a sentence under a heading');
    var report = R.stripBackNewReport({}, data);
    R.stripBackSay(report, 'gone', 'The Armoury is gone.');
    R.stripBackSay(report, 'no-such-heading', 'Something else.');
    t.same([report.said.gone, report.notes], [['The Armoury is gone.'], ['Something else.']]);
  });
  group('Strip Back: Bastion events are gone (S05)');

  /* The Bastion's event record as the Bastion saved it. */
  function oldEvent(over) { return Object.assign({ roll: 66, name: 'Friendly Visitors', lines: ['Friendly visitors arrive at the Bastion.'], at: 1760000000000, day: 29 }, over || {}); }
  var EVENT_LINE = 'Bastion events. The Bastion no longer has events, so the last one it rolled (Friendly Visitors, Day 29) is not kept. It was only a note for you; nothing in it changed the Bastion\'s numbers.';

  test('a Bastion that had rolled an event: the record and the day of the last automatic one go, one plain sentence says so, the audit is clean', function (t) {
    var raw = v3(function (s) { s.lastEvent = oldEvent(); s.lastEventDay = 29; s.day = 30; });
    var before = canon(raw);
    var res = convert(raw);
    t.equal(canon(raw), before, 'the save it was given is untouched');
    t.same(res.problems, []);
    t.equal('lastEvent' in res.save || 'lastEventDay' in res.save, false);
    t.same(res.save.migration.v4.lines, [EVENT_LINE]);
    t.same(res.report.removed.events, { name: 'Friendly Visitors', day: 29 });
    t.equal(res.save.migration.v4.changed, true);
    t.equal(res.save.migration.v4.summary, 'the Bastion\'s event record was dropped.');
    t.same(jargon(res.save.migration.v4.lines[0]), []);
    var rest = clone(res.save);
    delete rest.migration;
    rest.v = 3;
    var orig = clone(raw);
    delete orig.migration;
    delete orig.lastEvent; delete orig.lastEventDay;
    t.equal(canon(rest), canon(orig), 'nothing else changed: no gold, goods, orders or Favour moved');
  });

  test('a Bastion that never had an event leaves no trace: no sentence, no event fields, and it is the same save as one that never had the fields', function (t) {
    var withNone = v3(function (s) { s.lastEvent = null; s.lastEventDay = 0; });
    var without = v3(function (s) { delete s.lastEvent; delete s.lastEventDay; });
    var a = convert(withNone), b = convert(without);
    t.same(a.problems, []);
    t.same(a.report.lines, []);
    t.equal('lastEvent' in a.save || 'lastEventDay' in a.save, false, 'the empty fields are not carried over');
    t.equal(canon(a.save), canon(b.save), 'the same save either way');
    t.equal(canon(a.report), canon(b.report), 'and the same report');
    t.equal(a.save.migration.v4.summary, 'Nothing of yours changed.');
    t.equal(a.save.migration.v4.changed, false);
    t.same(R.stripBackLeftovers(withNone, data), [], 'empty fields are not a leftover');
  });

  test('the day of an event with no record, an event waiting, and one in the day being passed are all dropped, and said once', function (t) {
    var onlyDay = convert(v3(function (s) { s.lastEvent = null; s.lastEventDay = -3; }));
    t.same(onlyDay.problems, []);
    t.same(onlyDay.save.migration.v4.lines, ['Bastion events. The Bastion no longer has events, so its record of them is not kept. It was only a note for you; nothing in it changed the Bastion\'s numbers.']);
    var waiting = convert(v3(function (s) {
      s.pendingEvent = { name: 'Guest' };
      s.dayInProgress = { day: 12, stage: 'orders', skipped: [], attackRolled: false, news: ['The Smithy is built.'], event: { name: 'Guest' }, pendingEvent: { name: 'Guest' } };
    }));
    t.same(waiting.problems, []);
    t.equal('pendingEvent' in waiting.save, false);
    t.same(Object.keys(waiting.save.dayInProgress).sort(), ['attackRolled', 'day', 'news', 'skipped', 'stage'], 'the day in progress keeps everything else');
    t.same(waiting.save.dayInProgress.news, ['The Smithy is built.']);
    t.equal(waiting.save.migration.v4.lines.length, 1);
    t.equal(R.fromSave(clone(onlyDay.save), data).dayInProgress, null);
  });

  test('an event with no name is called by its id in words; a damaged record is dropped without a throw', function (t) {
    t.same(convert(v3(function (s) { s.lastEvent = { id: 'storm', day: 28 }; })).save.migration.v4.lines,
      ['Bastion events. The Bastion no longer has events, so the last one it rolled (Storm, Day 28) is not kept. It was only a note for you; nothing in it changed the Bastion\'s numbers.']);
    t.same(convert(v3(function (s) { s.lastEvent = {}; })).save.migration.v4.lines,
      ['Bastion events. The Bastion no longer has events, so the last one it rolled is not kept. It was only a note for you; nothing in it changed the Bastion\'s numbers.']);
    var junk = convert(v3(function (s) { s.lastEvent = 'x'; s.lastEventDay = 'soon'; }));
    t.same(junk.problems, []);
    t.equal(junk.save.migration.v4.lines.length, 1);
    t.equal('lastEvent' in junk.save, false);
    var noDay = convert(v3(function (s) { s.lastEvent = oldEvent({ day: 0 }); }));
    t.equal(noDay.save.migration.v4.lines[0], 'Bastion events. The Bastion no longer has events, so the last one it rolled (Friendly Visitors) is not kept. It was only a note for you; nothing in it changed the Bastion\'s numbers.', 'a day before Day 1 is not named');
  });

  test('what an earlier event put in "The Ironbow sends word" is history: it is kept exactly, and the audit proves it', function (t) {
    var raw = v3(function (s) {
      s.lastEvent = oldEvent();
      s.lastEventDay = 29;
      s.word = [{ day: 29, lines: ['Bastion event: Friendly Visitors (rolled 66).', 'The Library & Scriptorium is built.'] }];
    });
    var res = convert(raw);
    t.same(res.problems, []);
    t.same(res.save.word, raw.word);
    var tampered = clone(res.save);
    tampered.word = [];
    t.ok(R.stripBackAudit(res.before, tampered, res.report, data).length > 0, 'losing it would be caught');
  });

  test('the heavy fixture: its event goes once, in plain words, with the audit clean; converting again or loading twice changes nothing', function (t) {
    var raw = FIX['bastion-v3-heavy'];
    t.same([raw.lastEvent.name, raw.lastEventDay], ['Friendly Visitors', 29], 'it has an event to drop');
    var res = convert(raw);
    t.same(res.problems, []);
    t.equal(res.save.migration.v4.lines.filter(function (l) { return /^Bastion events\./.test(l); }).length, 1);
    t.ok(res.save.migration.v4.lines.indexOf(EVENT_LINE) !== -1, 'its sentence is in the report');
    t.equal('lastEvent' in res.save || 'lastEventDay' in res.save, false);
    t.same(R.stripBackLeftovers(res.save, data), []);
    t.equal(canon(R.migrateToV4(res.save, data).save), canon(res.save), 'idempotent');
    var loaded = R.fromSave(clone(raw), data);
    t.equal('lastEvent' in loaded || 'lastEventDay' in loaded, false);
    t.same(R.fromSave(R.toSave(loaded), data), loaded, 'loading twice gives the same Bastion');
    t.equal(loaded.log.length, 200, 'the Day Log is untouched (its own step is later)');
    t.equal(loaded.word.length, raw.word.length, 'and so is the Ironbow\'s word');
  });

  test('every other fixture has no event record, so no step line, and nothing named "event" is in its report', function (t) {
    Object.keys(FIX).forEach(function (name) {
      if (name === 'bastion-v3-heavy') return;
      var res = convert(FIX[name]);
      t.equal(res.save.migration.v4.lines.filter(function (l) { return /^Bastion events\./.test(l); }).length, 0, name);
      t.equal('lastEvent' in res.save || 'lastEventDay' in res.save, false, name + ': the empty fields are dropped');
    });
  });

  test('a version 4 save that an older copy of the suite put an event back into is found, cleaned again and told in the short notice', function (t) {
    var once = convert(v3()).save;
    once.migration.v4.shown = true;
    var dirty = clone(once);
    dirty.lastEvent = oldEvent({ day: 57 });
    dirty.lastEventDay = 57;
    t.equal(R.needsStripBack(dirty, data), true);
    t.same(R.stripBackLeftovers(dirty, data).map(function (x) { return x.step; }), ['dropEvents', 'dropEvents']);
    var res = convert(dirty);
    t.same(res.problems, []);
    t.same([res.report.again, res.save.migration.v4.again, res.save.migration.v4.shown], [true, true, false]);
    t.equal(R.stripBackHeadline(res.save.migration.v4), 'The Bastion has been tidied again.');
    t.ok(/Friendly Visitors, Day 57/.test(R.stripBackText(res.save.migration.v4)));
    t.equal(R.needsStripBack(res.save, data), false);
    var empty = clone(once);
    empty.lastEvent = null;
    empty.lastEventDay = 0;
    t.equal(R.needsStripBack(empty, data), false, 'empty event fields alone do not make a notice');
  });

  test('the step runs before the catch-all and the other steps are not disturbed: an event record and a ghost order convert together', function (t) {
    var raw = v3(function (s) { s.lastEvent = oldEvent(); s.lastEventDay = 29; s.treasuryGP = 90; s.pendingOrders = [ghost('g1', { costGP: 40 })]; });
    var res = convert(raw);
    t.same(res.problems, []);
    t.equal(res.save.treasuryGP, 130);
    t.same(res.save.pendingOrders, []);
    t.equal(res.save.migration.v4.lines.length, 3);
    t.ok(/^Gold\. /.test(res.save.migration.v4.lines[0]));
    t.ok(/^Orders\. /.test(res.save.migration.v4.lines[1]));
    t.ok(/^Bastion events\. /.test(res.save.migration.v4.lines[2]), 'in the order of the headings');
  });

  test('the Bastion\'s own pieces are gone: no event data, no event rules, no 28-day setting, no event forecast', function (t) {
    t.equal(window.TSI_DATA.bastionEvents, undefined, 'events-data.js is no longer loaded');
    ['rollEvent', 'resolveEvent', 'isEventDay', 'nextEventDay'].forEach(function (name) { t.equal(typeof R[name], 'undefined', name); });
    t.equal(T.bastion.time.eventEvery, undefined);
    t.equal('eventEvery' in R.time(data), false);
    t.equal('BASTION_EVENT_EVERY' in TSI.campaign, false);
    var d = R.defaultState(data);
    t.equal('lastEvent' in d || 'lastEventDay' in d, false);
    t.equal('lastEvent' in R.toSave(d) || 'lastEventDay' in R.toSave(d), false);
  });
}());
