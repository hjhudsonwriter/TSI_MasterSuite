/* The Temple (Strip Back Overhaul, step S11, 22 October 2026; Harry's decisions in docs/STRIP-BACK-PLAN.md, the design in
   docs/strip-back/F-temple-hall-dock.md): the three Shrines became ONE building with a Favour bar for each god, an instant
   Pray (a d50 added to the bar, which stops at 100) and an instant Receive Blessing (only when the bar is full: it spends
   the whole bar). The data is in tools/bastion/data/facilities-data.js, the rules in tools/bastion/temple-rules.js and
   rules.js, and the conversion of an old Bastion's Shrines in tools/bastion/strip-back-rules.js (step shrinesToTemple). */
(function () {
  var BR = TSI.bastion.rules;
  var Bg = TSI.bridge;
  var T = window.TSI_DATA;
  var FIX = window.TSI_FIXTURES || {};
  var canon = BR.stripBackCanon;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var TEMPLE = 'temple';
  var GODS = ['telluria', 'aurush', 'pelagos'];
  /* Harry's nine blessings, three for each god, in the dropdown's order (docs/STRIP-BACK-PLAN.md, decision 2). */
  var BLESSINGS = {
    telluria: [['prepare_earthward_talisman', 'Earthward Talisman'], ['prepare_rootguard_salve', 'Rootguard Salve'], ['great_rite_telluria', 'Great Rite of Telluria']],
    aurush: [['prepare_blessed_lantern', 'Blessed Lantern'], ['consecrate_expedition_supplies', 'Consecrate Expedition Supplies'], ['great_rite_aurush', 'Great Rite of Aurush']],
    pelagos: [['bless_voyage', 'Voyage Blessing'], ['bless_commercial_shipment', 'Bless Commercial Shipment'], ['great_rite_pelagos', 'Great Rite of Pelagos']]
  };

  /* Dice that come up in the given order (numbers from 0 up to 1). */
  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function reload(b) { return BR.fromSave(copy(BR.toSave(b)), data); }
  /* A Bastion on Day 10 at party level 9 with the Temple built. */
  function bastion(built) {
    var b = BR.defaultState(data);
    b.day = 10;
    b.anchored = true;
    b.bridge.fresh = false;
    b.partyLevel = 9;
    b.treasuryGP = 300;
    b.builtExtras = built === false ? [] : [{ facId: TEMPLE, status: 'built' }];
    BR.ensureLevels(b, data);
    return b;
  }
  /* The roll a die gives for a wanted result 1..sides (the middle of its slice of 0..1). */
  function rollOf(n, sides) { return (n - 0.5) / sides; }

  /* ---------------------------------------------------------------- */
  group('Temple: the building and its data (Harry, 22 October 2026)');

  test('one building replaces the three Shrines: party level 8, a construction slot, 21 days, one level; the Shrines are gone from the catalogue', function (t) {
    var f = BR.facility(data, TEMPLE);
    t.same([f.name, f.requiredLevel, f.singleLevel, f.inDevelopment, f.plot, typeof f.description], ['Temple', 8, true, undefined, undefined, 'string']);
    ['shrine_telluria', 'shrine_aurush', 'shrine_pelagos'].forEach(function (id) { t.equal(BR.facility(data, id), null, id + ' is gone'); });
    t.equal(BR.isPlotFacility(data, TEMPLE), false, 'it takes a construction slot');
    t.equal(BR.buildDaysForRequiredLevel(8, data), 21);
    var b = bastion(false);
    b.partyLevel = 7;
    t.equal(BR.startBuild(b, data, 0, TEMPLE).message, 'Locked. Temple requires party level 8.');
    b.partyLevel = 8;
    t.same(BR.startBuild(b, data, 0, TEMPLE, 'slot').log, ['Construction Started', 'Temple is under construction (21 days: ready on Day 31).']);
    t.equal(BR.templeBuilt(b, data), false, 'not while it is being built');
    b.day = 31;
    t.same(BR.completeConstruction(b), [TEMPLE]);
    t.equal(BR.templeBuilt(b, data), true);
  });

  test('one level only: no Upgrade, and the facility says so', function (t) {
    var b = bastion();
    var c = BR.upgradeCheck(b, data, TEMPLE);
    t.same([c.ok, c.top, c.single, c.message], [false, true, true, 'The Temple has one level only.']);
    t.same(BR.issueUpgrade(b, data, TEMPLE, dice([0.3])).ok, false);
    t.same(b.pendingOrders, []);
    t.same(BR.mapLabels(b, data).filter(function (l) { return l.fac === TEMPLE; }).map(function (l) { return [l.name, l.single]; }), [['Temple', true], ['Temple', true], ['Temple', true]], 'labelled at each of its three buildings on the map');
  });

  test('the gods, the die and the number that fills a bar are in the data; three blessings for each god, in Harry\'s order and words', function (t) {
    t.same(BR.templeGods(data).map(function (g) { return [g.id, g.name]; }), [['telluria', 'Telluria'], ['aurush', 'Aurush'], ['pelagos', 'Pelagos']]);
    t.same([BR.templeFull(data), BR.templePrayDie(data)], [100, 50]);
    GODS.forEach(function (god) {
      t.same(BR.templeBlessings(data, god).map(function (b) { return [b.id, b.label]; }), BLESSINGS[god], BR.GOD_NAMES[god] + ': exactly three blessings');
    });
    t.same(BR.templeBlessings(data, 'pelagos').map(function (b) { return b.kind; }), ['goods', 'charge', 'rite']);
    var f = BR.facility(data, TEMPLE);
    t.equal(f.functions.length, 9, 'nine in all');
    t.same(f.functions.filter(function (fn) { return fn.id === 'craft' || fn.id === 'pray' || fn.special; }), [], 'no Craft charms, no hint or long-rest prayers');
    t.same(f.functions.map(function (fn) { return fn.favourCost; }).filter(Boolean), [], 'no part-bar costs: a blessing always spends the whole bar');
  });

  test('the Compendium holds no Temple blessing or old Shrine charm or prayer (production and rite blessings are not items)', function (t) {
    var items = BR.compendiumIndex(data.facilities, data.tools).items;
    ['Tellurian Root Charm', 'Aurush Sun Charm', 'Pelagos Tide Charm', "Telluria's Guidance", "Pelagos's Deep Rest", 'Voyage Blessing', 'Great Rite of Pelagos'].forEach(function (name) {
      t.equal(items.indexOf(name), -1, name + ' is not in the Compendium');
    });
  });

  test('R.shrineGod reads the god from the data: a Temple function names its own; the Temple itself has none; a retired Shrine is found only through the Strip Back table; never a made-up god', function (t) {
    var f = BR.facility(data, TEMPLE);
    t.same(f.functions.map(function (fn) { return BR.shrineGod(TEMPLE, fn); }), ['telluria', 'telluria', 'telluria', 'aurush', 'aurush', 'aurush', 'pelagos', 'pelagos', 'pelagos']);
    t.equal(BR.shrineGod(TEMPLE), '', 'the Temple is not one god\'s');
    t.equal(BR.shrineGod('shrine_aurush'), '', 'a retired id means nothing without the table');
    t.equal(BR.shrineGod('shrine_aurush', null, data), 'aurush', 'the table in bastion-data.js says which god a retired Shrine served');
    t.equal(BR.shrineGod('hall_of_emissaries', { god: 'dragons' }, data), '', 'a god the data does not know is no god');
    /* A Favour cost on the Temple no longer creates favour[''] or is charged free. */
    var b = bastion();
    var fake = { id: 'x', label: 'x', favourCost: 10, days: 1 };
    t.equal(BR.favourBlocker(b, f, fake), '', 'no god: nothing to charge');
    t.equal(BR.favourBlocker(b, f, Object.assign({}, fake, { god: 'aurush' })), 'Needs 10% of Aurush\'s Favour; the Ironbow has 0%.');
  });

  test('a blessing is never an order with days: the generic Issue Order refuses it and changes nothing', function (t) {
    var b = bastion();
    b.favour.pelagos = 100;
    var before = canon(b);
    var r = BR.issueOrder(b, data, TEMPLE, 'great_rite_pelagos', 0, dice([0.3]));
    t.equal(r.ok, false);
    t.ok(/received at the Temple itself/.test(r.message), r.message);
    t.equal(canon(b), before, 'nothing changed: not the bar, not the orders');
  });

  /* ---------------------------------------------------------------- */
  group('Temple: Pray to (god) is instant and adds a d50 to the bar');

  test('a d50: 1 to 50 is added to that god\'s bar by the Bastion\'s own roll; no order, nothing else changes', function (t) {
    var b = bastion();
    b.favour = { telluria: 10, aurush: 20, pelagos: 30 };
    var r = BR.templePray(b, data, 'aurush', dice([rollOf(23, 50)]));
    t.same([r.ok, r.roll, r.die, r.before, r.after, r.added, r.over], [true, 23, 50, 20, 43, 23, 0]);
    t.same(b.favour, { telluria: 10, aurush: 43, pelagos: 30 }, 'only Aurush\'s bar moved');
    t.same(b.pendingOrders, [], 'instant: no order');
    t.equal(r.text, 'Rolled a d50: 23. Aurush\'s bar goes from 20% to 43% (+23%).');
    t.same(r.log, ['Prayer', 'Prayed to Aurush. Rolled a d50: 23. Aurush\'s bar goes from 20% to 43% (+23%).']);
    t.equal('' in b.favour, false, 'no favour[""]');
  });

  test('every whole number from 1 to 50 can come up, and none outside it', function (t) {
    var seen = {};
    for (var n = 1; n <= 50; n++) {
      var b = bastion();
      var r = BR.templePray(b, data, 'telluria', dice([rollOf(n, 50)]));
      t.equal(r.roll, n);
      t.equal(b.favour.telluria, n, 'from an empty bar, the bar is the roll');
      seen[r.roll] = true;
    }
    t.equal(Object.keys(seen).length, 50);
    var lo = BR.templePray(bastion(), data, 'pelagos', dice([0]));
    var hi = BR.templePray(bastion(), data, 'pelagos', dice([0.999999]));
    t.same([lo.roll, hi.roll], [1, 50], 'the extremes of the generator');
    for (var k = 0; k < 400; k++) {
      var rr = BR.templePray(bastion(), data, 'pelagos', Math.random).roll;
      if (rr < 1 || rr > 50 || Math.floor(rr) !== rr) { t.ok(false, 'out of range: ' + rr); break; }
    }
  });

  test('the bar stops at 100 and the result says how much of the roll did not fit; a full bar takes nothing and says so', function (t) {
    var b = bastion();
    b.favour.pelagos = 80;
    var r = BR.templePray(b, data, 'pelagos', dice([rollOf(38, 50)]));
    t.same([r.after, r.added, r.over], [100, 20, 18]);
    t.equal(b.favour.pelagos, 100);
    t.equal(r.text, 'Rolled a d50: 38. Pelagos\'s bar goes from 80% to 100% (it stops at 100%, so 18% of the roll did not fit).');
    var again = BR.templePray(b, data, 'pelagos', dice([rollOf(5, 50)]));
    t.same([again.ok, again.roll, again.added, b.favour.pelagos], [true, 5, 0, 100]);
    t.equal(again.text, 'Rolled a d50: 5. Pelagos\'s bar was already full (100%), so nothing was added. Receive a blessing to start it again.');
    var exact = bastion();
    exact.favour.aurush = 50;
    t.same([BR.templePray(exact, data, 'aurush', dice([rollOf(50, 50)])).over, exact.favour.aurush], [0, 100], 'exactly to 100: nothing over');
  });

  test('refusals change nothing: the Temple not built (or still being built); a god it does not have', function (t) {
    var none = bastion(false);
    var before = canon(none);
    var r = BR.templePray(none, data, 'aurush', dice([0.5]));
    t.same([r.ok, r.message], [false, 'The Temple isn\'t built yet.']);
    var building = bastion(false);
    building.builtExtras = [{ facId: TEMPLE, status: 'building', startDay: 8, readyDay: 29 }];
    t.equal(BR.templePray(building, data, 'aurush', dice([0.5])).ok, false, 'not while it is being built');
    t.equal(canon(none), before);
    var b = bastion();
    var bad = BR.templePray(b, data, 'dragons', dice([0.5]));
    t.same([bad.ok, bad.message, b.favour], [false, 'That isn\'t one of the Temple\'s gods.', { telluria: 0, aurush: 0, pelagos: 0 }]);
  });

  test('the DM doc\'s Change a Score still sets a god\'s Favour (0 to 100), and a Pray then adds to it', function (t) {
    var b = bastion();
    var r = BR.applyDmEdits(b, [{ id: 'e-temple-1', kind: 'favour', key: 'pelagos', value: 64, at: 1 }], 1000);
    t.same([r.changed, r.refused, b.favour.pelagos], [true, 0, 64]);
    t.equal(BR.applyDmEdits(b, [{ id: 'e-temple-2', kind: 'favour', key: 'pelagos', value: 101, at: 2 }], 1000).refused, 1, 'over 100 is refused');
    t.equal(b.favour.pelagos, 64);
    BR.templePray(b, data, 'pelagos', dice([rollOf(10, 50)]));
    t.equal(b.favour.pelagos, 74);
  });

  /* ---------------------------------------------------------------- */
  group('Temple: Receive Blessing is instant, needs a full bar and spends all of it');

  function full(b, god) { b.favour[god] = 100; return b; }

  test('not until the bar is full: the refusal says how full it is, and nothing changes', function (t) {
    var b = bastion();
    b.favour.pelagos = 99;
    var before = canon(b);
    var r = BR.templeReceive(b, data, 'pelagos', 'bless_voyage', dice([0.3]));
    t.same([r.ok, r.message], [false, 'Pelagos\'s bar is at 99%. It must be full (100%) before a blessing can be received.']);
    t.equal(canon(b), before, 'not the bar, not the Warehouse, not the orders');
    t.equal(BR.templeReceiveBlocker(b, data, 'pelagos', 'bless_voyage'), r.message);
    b.favour.pelagos = 100;
    t.equal(BR.templeReceiveBlocker(b, data, 'pelagos', 'bless_voyage'), '', 'at 100 it can be');
  });

  test('every one of the nine: the whole bar goes to 0, the other gods\' bars stay, and the blessing takes effect at once (no order)', function (t) {
    GODS.forEach(function (god) {
      BLESSINGS[god].forEach(function (pair) {
        var b = bastion();
        b.favour = { telluria: 31, aurush: 62, pelagos: 93 };
        b.favour[god] = 100;
        var others = copy(b.favour);
        delete others[god];
        var r = BR.templeReceive(b, data, god, pair[0], dice([0.3]));
        t.equal(r.ok, true, god + ': ' + pair[1] + (r.message ? ' (' + r.message + ')' : ''));
        t.equal(b.favour[god], 0, pair[1] + ': the bar resets');
        GODS.filter(function (g) { return g !== god; }).forEach(function (g) { t.equal(b.favour[g], others[g], pair[1] + ': ' + g + '\'s bar is untouched'); });
        t.same([b.pendingOrders, r.spent, r.label, r.name], [[], 100, pair[1], BR.GOD_NAMES[god]], pair[1] + ': instant');
        t.equal('' in b.favour, false);
      });
    });
  });

  test('goods blessings go into the Warehouse straight away, by their id', function (t) {
    var want = {
      prepare_earthward_talisman: ['earthward_talisman', 1], prepare_rootguard_salve: ['rootguard_salve', 2],
      prepare_blessed_lantern: ['blessed_lantern', 1], consecrate_expedition_supplies: ['cleansing_portion', 3], bless_voyage: ['voyage_blessing', 1]
    };
    Object.keys(want).forEach(function (fnId) {
      var god = fnId === 'bless_voyage' ? 'pelagos' : /rootguard|earthward/.test(fnId) ? 'telluria' : 'aurush';
      var b = full(bastion(), god);
      var r = BR.templeReceive(b, data, god, fnId, dice([0.3]));
      t.equal(BR.goodsQty(b, want[fnId][0]), want[fnId][1], fnId);
      t.ok(/^Pelagos|^Telluria|^Aurush/.test(r.text) && / was spent and is back at 0%\. /.test(r.text) && /Added to the Warehouse: /.test(r.text), r.text);
    });
    var b = full(bastion(), 'telluria');
    var r = BR.templeReceive(b, data, 'telluria', 'prepare_rootguard_salve', dice([0.3]));
    t.equal(r.text, 'Telluria\'s bar (100%) was spent and is back at 0%. Rootguard Salve: Added to the Warehouse: 2 doses of Rootguard Salve.');
    t.same(r.log, ['Blessing', 'Received Rootguard Salve from Telluria. ' + r.text]);
    var c = full(b, 'telluria');
    BR.templeReceive(c, data, 'telluria', 'prepare_rootguard_salve', dice([0.3]));
    t.equal(BR.goodsQty(c, 'rootguard_salve'), 4, 'a second time adds to the same row');
  });

  test('Bless Commercial Shipment keeps one Blessing of Pelagos for the Dock\'s next ship: it is read when a ship sails, and used up', function (t) {
    var b = full(bastion(), 'pelagos');
    var r = BR.templeReceive(b, data, 'pelagos', 'bless_commercial_shipment', dice([0.3]));
    t.same(b.tradeNetwork.protections.pelagos_blessing, { charges: 1 });
    t.equal(r.text, 'Pelagos\'s bar (100%) was spent and is back at 0%. Bless Commercial Shipment: A Blessing of Pelagos waits for the next ship the Dock sends with cargo (1 held): its chance of trouble at sea is lower.');
    t.equal(BR.templeView(b, data).gods[2].held, 1);
    t.equal(BR.protectionStatus(b, data).filter(function (p) { return p.id === 'pelagos_blessing'; })[0].state, 'ready');
    var again = full(b, 'pelagos');
    BR.templeReceive(again, data, 'pelagos', 'bless_commercial_shipment', dice([0.3]));
    t.equal(again.tradeNetwork.protections.pelagos_blessing.charges, 2, 'two held after two');
    var ships = BR.voyageProtections(again, data, 'goldport');
    t.same(ships.map(function (p) { return [p.id, p.cut]; }).filter(function (p) { return p[0] === 'pelagos_blessing'; }), [['pelagos_blessing', 10]], 'the Dock reads it: 10 points off');
  });

  test('a Great Rite is made at once and waits at the Ironbow; it can be given to the party in the Explorer; two are told apart', function (t) {
    var b = full(bastion(), 'telluria');
    b.day = 14;
    var r = BR.templeReceive(b, data, 'telluria', 'great_rite_telluria', dice([0.3]));
    t.equal(b.greatRites.length, 1);
    var g = b.greatRites[0];
    t.same([g.rite, g.god, g.madeDay, g.status], ['earths_endurance', 'telluria', 14, 'waiting']);
    t.ok(/^rite-[a-z0-9]+$/.test(g.id) && Bg.UID_PATTERN.test(g.id), 'a good id for the Explorer link: ' + g.id);
    t.equal(r.text, 'Telluria\'s bar (100%) was spent and is back at 0%. Great Rite of Telluria: Earth\'s Endurance waits at the Ironbow until the DM gives it to the party on an expedition, in the Explorer.');
    /* The Explorer's message marks it as with the party, once. */
    var msg = { id: Bg.riteMessageId(g.id), rite: 'earths_endurance' };
    t.same(BR.assignGreatRite(b, msg), { r: 'applied', held: false, rite: 'earths_endurance', riteId: g.id });
    t.equal(b.greatRites[0].status, 'assigned');
    /* A second one with the very same dice gets its own id. */
    full(b, 'telluria');
    BR.templeReceive(b, data, 'telluria', 'great_rite_telluria', dice([0.3]));
    t.equal(b.greatRites.length, 2);
    t.ok(b.greatRites[0].id !== b.greatRites[1].id, 'different ids');
    t.same(reload(b).greatRites, BR.cleanGreatRites(b.greatRites), 'a reload keeps them');
  });

  test('refusals change nothing: the Temple not built; another god\'s blessing; a blessing that does not exist; an unknown god', function (t) {
    var none = full(bastion(false), 'pelagos');
    var before = canon(none);
    t.same([BR.templeReceive(none, data, 'pelagos', 'bless_voyage', dice([0.3])).message], ['The Temple isn\'t built yet.']);
    t.equal(canon(none), before);
    var b = full(bastion(), 'pelagos');
    before = canon(b);
    t.equal(BR.templeReceive(b, data, 'pelagos', 'great_rite_aurush', dice([0.3])).message, 'That isn\'t one of Pelagos\'s blessings.');
    t.equal(BR.templeReceive(b, data, 'pelagos', 'prepare_aquatic_protection_charm', dice([0.3])).message, 'That isn\'t one of Pelagos\'s blessings.', 'the dropped Aquatic Protection Charm');
    t.equal(BR.templeReceive(b, data, 'pelagos', 'pray', dice([0.3])).ok, false);
    t.equal(BR.templeReceive(b, data, 'dragons', 'bless_voyage', dice([0.3])).message, 'That isn\'t one of the Temple\'s gods.');
    t.equal(canon(b), before);
  });

  test('the state survives a save and a reload exactly: the bars, a held Blessing, the Great Rites and the Warehouse; loading twice changes nothing', function (t) {
    var b = bastion();
    b.favour = { telluria: 100, aurush: 55, pelagos: 100 };
    BR.templeReceive(b, data, 'telluria', 'great_rite_telluria', dice([0.3]));
    BR.templeReceive(b, data, 'pelagos', 'bless_commercial_shipment', dice([0.3]));
    BR.templePray(b, data, 'aurush', dice([rollOf(7, 50)]));
    var back = reload(b);
    t.same([back.favour, back.greatRites, back.tradeNetwork.protections, back.warehouse], [b.favour, b.greatRites, b.tradeNetwork.protections, b.warehouse]);
    t.equal(canon(reload(back)), canon(back));
    t.same(back.favour, { telluria: 0, aurush: 62, pelagos: 0 });
  });

  test('the Temple\'s view: each god\'s bar, whether it is full, its three blessings, its Great Rites and the Blessings held', function (t) {
    var b = bastion();
    b.favour = { telluria: 0, aurush: 100, pelagos: 40 };
    var v = BR.templeView(b, data);
    t.same([v.built, v.full, v.die], [true, 100, 50]);
    t.same(v.gods.map(function (g) { return [g.id, g.bar, g.isFull, g.blessings.length, g.rites.length, g.held]; }), [['telluria', 0, false, 3, 0, 0], ['aurush', 100, true, 3, 0, 0], ['pelagos', 40, false, 3, 0, 0]]);
    t.same(v.gods.map(function (g) { return g.art; }), ['shrine_of_telluria.png', 'shrine_of_aurush.png', 'shrine_of_pelagos.png'], 'the three Shrine paintings, one for each god');
    t.equal(BR.templeView(bastion(false), data).built, false);
  });

  /* ---------------------------------------------------------------- */
  group('Temple: the conversion of an old Bastion\'s Shrines (step shrinesToTemple)');

  function convert(raw) {
    var res = BR.migrateToV4(raw, data);
    res.problems = BR.stripBackAudit(res.before, res.save, res.report, data);
    return res;
  }
  /* A plain version 3 Bastion on Day 12. */
  function v3(fn) {
    var s = copy(BR.toSave(BR.defaultState(data)));
    s.v = 3;
    s.day = 12;
    s.anchored = true;
    s.treasuryGP = 400;
    s.partyLevel = 13;
    if (fn) fn(s);
    return s;
  }
  /* A report's lines without the one every version 3 Bastion gets since the war game went (S06): the Barracks, Armoury and Watchtower are gone. */
  function noWar(res) { return res.report.lines.filter(function (l) { return !/^Places that are gone\. Barracks, Armoury and Watchtower are gone with the war game\.$/.test(l); }); }
  function joinedLine(res) { return res.save.migration.v4.lines.filter(function (l) { return /^Places that joined others\. /.test(l); })[0] || ''; }
  function shrine(god, extra) { return Object.assign({ facId: 'shrine_' + god, status: 'built' }, extra || {}); }
  function order(id, facId, fnId, extra) {
    return Object.assign({ id: id, facId: facId, fnId: fnId, chosen: null, optionLabel: null, notes: '', label: facId + ': ' + fnId, costGP: 0, issuedDay: 10, dueDay: 15 }, extra || {});
  }
  /* An old Shrine order for one of the nine blessings, as the Bastion saved it. */
  function oldBlessing(id, god, fnId, extra) {
    var fn = BR.fn(BR.facility(data, TEMPLE), fnId);
    var opt = fn.options && fn.options[0] ? copy(fn.options[0]) : null;
    return order(id, 'shrine_' + god, fnId, Object.assign({ chosen: opt, optionLabel: opt ? opt.label : null, label: 'Shrine of ' + BR.GOD_NAMES[god] + ': ' + fn.label, favourCost: 10 }, extra || {}));
  }

  test('the heavy Bastion: the Shrines become one Temple, the salve and the Great Rite move, the prayers and the charm are cancelled with their Favour and goods, and the audit is clean', function (t) {
    var raw = FIX['bastion-v3-heavy'];
    var before = canon(raw);
    var res = convert(raw);
    t.equal(canon(raw), before, 'the fixture itself is untouched');
    t.same(res.problems, [], 'the audit');
    var s = res.save;
    t.same(s.builtExtras.filter(function (e) { return e && /^(temple|shrine_)/.test(e.facId); }), [{ facId: TEMPLE, status: 'built' }], 'one Temple, built');
    t.equal(s.builtExtras[4].facId, TEMPLE, 'in the slot of the first built Shrine (Telluria\'s)');
    t.same([s.builtExtras[5], s.builtExtras[6]], ['', ''], 'the Shrine being built and the other built one are freed');
    t.same(['shrine_telluria', 'shrine_aurush', 'shrine_pelagos', TEMPLE].map(function (id) { return s.facilityLevels[id]; }), [undefined, undefined, undefined, 1], 'one level, whatever the highest Shrine was');
    t.same(s.archivedFacilities.filter(function (a) { return /^shrine_/.test(a.facId); }).map(function (a) { return [a.facId, a.name, a.status]; }), [['shrine_telluria', 'Shrine of Telluria', 'built'], ['shrine_aurush', 'Shrine of Aurush', 'building'], ['shrine_pelagos', 'Shrine of Pelagos', 'built']]);
    /* Favour stays; what the cancelled order used goes back (5% of Pelagos's bar). */
    t.same(res.before.favour, { telluria: 70, aurush: 95, pelagos: 40 });
    t.same(s.favour, { telluria: 70, aurush: 95, pelagos: 45 }, 'only the Aquatic Protection Charm\'s 5% went back; the moved orders keep what they already took');
    t.same(res.save.greatRites, res.before.greatRites, 'the Great Rite held is kept');
    t.same(s.tradeNetwork.protections, { pelagos_blessing: { charges: 1 } }, 'the held Blessing of Pelagos is kept');
    /* The orders. */
    var temple = s.pendingOrders.filter(function (o) { return o.facId === TEMPLE; });
    t.same(temple.map(function (o) { return [o.id, o.fnId, o.label, o.dueDay, o.issuedDay, o.costGP, o.favourCost]; }), [
      ['hv-20', 'prepare_rootguard_salve', 'Temple: Rootguard Salve', 42, 38, 0, 5],
      ['hv-22', 'great_rite_pelagos', 'Temple: Great Rite of Pelagos', 45, 38, 0, 25]
    ], 'the salve and the Great Rite moved, keeping their ids, due days and the Favour they had taken');
    t.same(temple[0].chosen, { label: '2 doses of Rootguard Salve', outputs: [{ good: 'rootguard_salve', qty: 2 }] }, 'what it makes is kept');
    t.same(res.report.moved.filter(function (m) { return /^hv-(20|22)$/.test(m.id); }).map(function (m) { return m.to; }), ['the Temple', 'the Temple']);
    t.same(s.pendingOrders.filter(function (o) { return /shrine/.test(o.facId); }), [], 'no order is left at a Shrine');
    var cancelled = res.report.cancelled.filter(function (c) { return /^hv-(17|18|19|21)$/.test(c.id); });
    t.same(cancelled.map(function (c) { return [c.id, c.gp, c.favour, c.god]; }), [['hv-17', 0, 0, ''], ['hv-18', 0, 0, ''], ['hv-19', 0, 0, ''], ['hv-21', 0, 5, 'pelagos']]);
    t.ok(/one level only/.test(cancelled[0].why) && /instant now/.test(cancelled[1].why) && /hint and long-rest prayers are gone/.test(cancelled[2].why) && /three blessings for each god/.test(cancelled[3].why), 'each says why: ' + cancelled.map(function (c) { return c.why; }).join(' | '));
    t.same(BR.goodsQty(s, 'alchemical_flowers') - BR.goodsQty(res.before, 'alchemical_flowers'), 3, 'the 3 Alchemical Flowers it held are back in the Warehouse');
    /* The words. */
    var lines = s.migration.v4.lines.join('\n');
    t.ok(/Places that joined others\. .*The Shrine of Telluria, the Shrine of Aurush and the Shrine of Pelagos have become one Temple\. Each god has a Favour bar there, a Pray button \(instant: it adds a d50 roll, 1 to 50 percent, to the bar\) and Receive Blessing, a list of three blessings that opens when the bar is full; a blessing happens at once and spends the whole bar\. The other slots are free\. Building work on the Shrine of Aurush stopped \(building costs no gold\)\./.test(lines), lines);
    t.ok(/Your Favour bars carry over as they are, and what you already hold is kept: one Great Rite \(Cleansing Radiance\) and one Blessing of Pelagos for the Dock\./.test(lines), lines);
    t.ok(/Pelagos: 5% went back to the bar \(on Day 40 it went from 40% to 45%\)\./.test(lines), lines);
    t.ok(/The Temple keeps three blessings for each god; the Craft charms, the hint and long-rest prayers, Purification Incense, the Aquatic Protection Charm and Bless Bastion Foundations are gone/.test(lines), lines);
    t.equal(/shrine_|temple\b|undefined|  /.test(lines), false, 'plain English: no ids, no double spaces');
    t.equal(BR.needsStripBack(s, data), false);
    t.equal(canon(BR.migrateToV4(s, data).save), canon(s), 'converting again changes nothing');
    var loaded = BR.fromSave(copy(raw), data);
    t.equal(canon(BR.fromSave(BR.toSave(loaded), data)), canon(loaded), 'loading twice gives the same Bastion');
    t.equal(loaded.facilityLevels[TEMPLE], 1);
  });

  test('the moved orders still complete on their due days: the salve into the Warehouse, the Great Rite waiting at the Ironbow with its god', function (t) {
    var res = convert(FIX['bastion-v3-heavy']);
    var b = BR.fromSave(copy(res.save), data);
    var salve = b.pendingOrders.filter(function (o) { return o.id === 'hv-20'; })[0];
    var rite = b.pendingOrders.filter(function (o) { return o.id === 'hv-22'; })[0];
    b.day = 45;
    t.same(BR.completeSimpleOrder(b, data, salve, dice([0.5])), [['Order Completed', 'Temple: Rootguard Salve → Added to Warehouse: 2 doses of Rootguard Salve.']]);
    t.equal(BR.goodsQty(b, 'rootguard_salve'), 2);
    t.same(BR.completeSimpleOrder(b, data, rite, dice([0.5])), [['Order Completed', 'Temple: Great Rite of Pelagos → Tide\'s Passage waits at the Ironbow until the DM gives it to the party on an expedition.']]);
    var made = b.greatRites.filter(function (g) { return g.id === 'rite-hv-22'; })[0];
    t.same([made.rite, made.god, made.madeDay, made.status], ['tides_passage', 'pelagos', 45, 'waiting'], 'its god is read from the Temple\'s data, not from a building');
    BR.completeSimpleOrder(b, data, rite, dice([0.5]));
    t.equal(b.greatRites.filter(function (g) { return g.id === 'rite-hv-22'; }).length, 1, 'once only, as before');
  });

  test('all nine blessings that carry on: an old order for each moves to the Temple (id, cost, Favour and due day kept) and completes with its effect', function (t) {
    GODS.forEach(function (god) {
      BLESSINGS[god].forEach(function (pair) {
        var res = convert(v3(function (s) {
          s.builtExtras = [shrine(god)];
          s.favour[god] = 30;
          s.pendingOrders = [oldBlessing('b1', god, pair[0], { dueDay: 17 })];
        }));
        t.same(res.problems, [], pair[1] + ': audit');
        var o = res.save.pendingOrders[0];
        t.same([o.id, o.facId, o.fnId, o.label, o.dueDay, o.favourCost], ['b1', TEMPLE, pair[0], 'Temple: ' + pair[1], 17, 10], pair[1]);
        t.equal(res.save.favour[god], 30, pair[1] + ': no Favour handed back for an order that carries on');
        var b = BR.fromSave(copy(res.save), data);
        b.day = 17;
        var out = BR.completeSimpleOrder(b, data, b.pendingOrders[0], dice([0.5]));
        t.equal(out[0][0], 'Order Completed', pair[1] + ': ' + (out[0][1] || ''));
        var fn = BR.fn(BR.facility(data, TEMPLE), pair[0]);
        if (fn.greatRite) t.same([b.greatRites[0].rite, b.greatRites[0].god], [fn.greatRite, god], pair[1]);
        else if (fn.protectionCharge) t.equal(b.tradeNetwork.protections.pelagos_blessing.charges, 1, pair[1]);
        else t.ok(fn.options[0].outputs.every(function (x) { return BR.goodsQty(b, x.good) === x.qty; }), pair[1] + ': goods');
      });
    });
  });

  test('every other Shrine order is cancelled with its Favour back on the right god\'s bar and its goods back in the Warehouse: Craft, all three prayers, Incense, the Aquatic Charm, Bless Bastion Foundations, Upgrade', function (t) {
    var res = convert(v3(function (s) {
      s.builtExtras = [shrine('telluria'), shrine('aurush'), shrine('pelagos')];
      s.favour = { telluria: 10, aurush: 20, pelagos: 30 };
      s.pendingOrders = [
        order('c1', 'shrine_telluria', 'craft', { chosen: { label: 'Tellurian Root Charm' }, optionLabel: 'Tellurian Root Charm', label: 'Shrine of Telluria: Craft (Tellurian Root Charm)' }),
        order('p1', 'shrine_aurush', 'pray', { chosen: { label: 'Aurush\'s Insight', special: { type: 'oracle_hint', god: 'aurush' } }, label: 'Shrine of Aurush: Pray (Aurush\'s Insight)' }),
        order('p2', 'shrine_aurush', 'pray', { chosen: { label: 'Aurush\'s Radiance', special: { type: 'blessing_rest', god: 'aurush' } }, label: 'Shrine of Aurush: Pray (Aurush\'s Radiance)' }),
        order('p3', 'shrine_pelagos', 'pray', { chosen: { label: 'Pelagos\'s Blessing', special: { type: 'favour_blessing', god: 'pelagos' } }, label: 'Shrine of Pelagos: Pray (Pelagos\'s Blessing)' }),
        order('i1', 'shrine_aurush', 'prepare_purification_incense', { favourCost: 5, inputs: [{ goodId: 'alchemical_flowers', name: 'Alchemical Flowers', qty: 2 }], label: 'Shrine of Aurush: Prepare Purification Incense' }),
        order('q1', 'shrine_pelagos', 'prepare_aquatic_protection_charm', { favourCost: 5, label: 'Shrine of Pelagos: Prepare Aquatic Protection Charm' }),
        order('f1', 'shrine_telluria', 'bless_bastion_foundations', { favourCost: 10, label: 'Shrine of Telluria: Bless Bastion Foundations' }),
        { id: 'u1', facId: 'shrine_aurush', fnId: 'upgrade', chosen: null, optionLabel: null, notes: '', label: 'Shrine of Aurush: Upgrade to Level 3', costGP: 0, issuedDay: 10, dueDay: 31, meta: { kind: 'upgrade', toLevel: 3 } }
      ];
    }));
    t.same(res.problems, [], 'the audit');
    t.same(res.save.pendingOrders, [], 'nothing is left');
    t.same(res.report.cancelled.map(function (c) { return [c.id, c.favour, c.god]; }), [['c1', 0, ''], ['p1', 0, ''], ['p2', 0, ''], ['p3', 0, ''], ['i1', 5, 'aurush'], ['q1', 5, 'pelagos'], ['f1', 10, 'telluria'], ['u1', 0, '']]);
    t.same(res.save.favour, { telluria: 20, aurush: 25, pelagos: 35 }, 'each god\'s own bar');
    t.equal(BR.goodsQty(res.save, 'alchemical_flowers'), 2);
    t.ok(/Craft/.test(res.report.cancelled[0].why) && /instant now/.test(res.report.cancelled[3].why), 'reasons');
    t.same(res.report.moved, []);
  });

  test('Favour comes back up to 100% and no further, and the overflow is said', function (t) {
    var res = convert(v3(function (s) {
      s.builtExtras = [shrine('pelagos')];
      s.favour.pelagos = 97;
      s.pendingOrders = [order('q1', 'shrine_pelagos', 'prepare_aquatic_protection_charm', { favourCost: 5, label: 'Shrine of Pelagos: Prepare Aquatic Protection Charm' })];
    }));
    t.same(res.problems, []);
    t.equal(res.save.favour.pelagos, 100);
    t.equal(res.report.favour.lost.pelagos, 2);
    t.ok(/Pelagos's bar was too full to take back 2% of what its orders had used\./.test(res.save.migration.v4.lines.join(' ')));
  });

  test('which slot becomes the Temple: a built Shrine before one being built; of two built, the first; of several being built, the one ready first; the rest are freed', function (t) {
    function slots(list) {
      var res = convert(v3(function (s) { s.builtExtras = list; s.facilityLevels = { shrine_telluria: 2, shrine_aurush: 3, shrine_pelagos: 5 }; }));
      t.same(res.problems, [], 'the audit');
      return res;
    }
    var a = slots(['hall_of_emissaries', shrine('telluria', { status: 'building', startDay: 5, readyDay: 26 }), shrine('aurush'), shrine('pelagos', { status: 'building', startDay: 6, readyDay: 27 })]);
    t.same(a.save.builtExtras.map(function (e) { return e && (e.facId || e); }), ['hall_of_emissaries', '', TEMPLE, ''], 'the built Aurush');
    t.ok(/Building work on the Shrine of Telluria and the Shrine of Pelagos stopped \(building costs no gold\)\./.test(a.save.migration.v4.lines.join(' ')));
    var b = slots([shrine('pelagos'), shrine('aurush'), shrine('telluria')]);
    t.same(b.save.builtExtras.map(function (e) { return e && (e.facId || e); }), [TEMPLE, '', ''], 'the first built one');
    var c = slots([shrine('telluria', { status: 'building', startDay: 5, readyDay: 40 }), shrine('aurush', { status: 'building', startDay: 6, readyDay: 28 }), shrine('pelagos', { status: 'building', startDay: 7, readyDay: 50 })]);
    t.same(c.save.builtExtras, ['', { facId: TEMPLE, status: 'building', startDay: 6, readyDay: 28 }, ''], 'the one ready first, still being built');
    t.ok(/It is still being built \(ready on Day 28\)\./.test(c.save.migration.v4.lines.join(' ')));
    t.equal(c.save.facilityLevels[TEMPLE], 1);
    t.same(['shrine_telluria', 'shrine_aurush', 'shrine_pelagos'].filter(function (id) { return id in c.save.facilityLevels; }), []);
    var one = convert(v3(function (s) { s.builtExtras = [shrine('aurush')]; s.facilityLevels = { shrine_aurush: 4 }; }));
    t.ok(/^Places that joined others\. The Shrine of Aurush has become the Temple\./.test(joinedLine(one)), joinedLine(one));
    t.equal(/other slot/.test(joinedLine(one)), false, 'nothing else to free');
  });

  test('a Bastion with no Shrine: nothing to convert, nothing said about the Temple; a Temple already built stays as it is', function (t) {
    var none = convert(v3());
    t.same(noWar(none), []);
    t.equal(none.save.builtExtras.some(function (e) { return e && e.facId === TEMPLE; }), false, 'no Temple is made from nothing');
    var have = convert(v3(function (s) { s.builtExtras = [{ facId: TEMPLE, status: 'built' }]; s.favour.aurush = 77; }));
    t.same(noWar(have), []);
    t.same(have.save.builtExtras, [{ facId: TEMPLE, status: 'built' }]);
    t.equal(have.save.favour.aurush, 77);
  });

  test('a version 4 save that an older copy of the suite overwrote (a Shrine in a slot, an order at it) is converted again, with the "tidied again" notice; the Temple and the Favour are kept', function (t) {
    var once = convert(v3(function (s) { s.builtExtras = [shrine('aurush')]; s.favour.aurush = 60; })).save;
    t.equal(BR.needsStripBack(once, data), false);
    var shown = copy(once);
    shown.migration.v4.shown = true;
    var dirty = copy(shown);
    dirty.builtExtras = dirty.builtExtras.concat([shrine('pelagos')]);
    dirty.facilityLevels.shrine_pelagos = 3;
    dirty.pendingOrders = [oldBlessing('b9', 'pelagos', 'bless_voyage', { dueDay: 20 })];
    t.ok(BR.stripBackLeftovers(dirty, data).some(function (x) { return x.step === 'shrinesToTemple'; }), 'the step finds it');
    var res = convert(dirty);
    t.same(res.problems, []);
    t.same(res.save.builtExtras.map(function (e) { return e && (e.facId || e); }), [TEMPLE, ''], 'the Temple stays; the Shrine\'s slot is freed');
    t.same(res.save.pendingOrders.map(function (o) { return [o.id, o.facId, o.fnId]; }), [['b9', TEMPLE, 'bless_voyage']]);
    t.equal(res.save.favour.aurush, 60);
    t.equal(res.save.migration.v4.again, true);
    t.equal(BR.stripBackHeadline(res.save.migration.v4), 'The Bastion has been tidied again.');
  });

  test('the forecast for a version 3 save agrees with the conversion: an order the Temple carries on is forecast, one that ends is not', function (t) {
    var C = TSI.campaign;
    var fn = BR.facility(data, TEMPLE).functions;
    var carried = fn.map(function (f) { return f.id; });
    ['shrine_telluria', 'shrine_aurush', 'shrine_pelagos'].forEach(function (sid) {
      var god = sid.replace('shrine_', '');
      ['craft', 'pray', 'prepare_purification_incense', 'prepare_aquatic_protection_charm', 'bless_bastion_foundations'].concat(carried).forEach(function (fnId) {
        var o = order('x', sid, fnId, { favourCost: 5 });
        var res = convert(v3(function (s) { s.builtExtras = [shrine(god)]; s.pendingOrders = [o]; }));
        var moved = res.save.pendingOrders.length === 1 && res.save.pendingOrders[0].facId === TEMPLE;
        t.equal(C.cancelledByConversion(o), !moved, sid + ' ' + fnId + (moved ? ' carries on' : ' ends'));
      });
    });
    t.equal(C.cancelledByConversion({ facId: 'shrine_aurush', fnId: 'upgrade', meta: { kind: 'upgrade' } }), true, 'an Upgrade ends');
    t.equal(C.cancelledByConversion({ facId: TEMPLE, fnId: 'bless_voyage' }), false, 'the Temple itself is not a retired place');
    t.equal(C.RETIRED_FACILITIES.shrine_pelagos, 'move');
  });
}());
