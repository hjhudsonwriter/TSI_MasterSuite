/* The Courier Exchange (pull request 6 of the facilities overhaul; Harry's
   answers, 14 October 2026): the data (shared/data/courier-points.js,
   tools/bastion/data/courier-data.js), the Bastion's parcels
   (tools/bastion/courier-rules.js), the link's third kind
   (shared/js/bridge-rules.js) and the Explorer collecting a parcel
   (tools/explorer/journey.js). */
(function () {
  var Bg = TSI.bridge;
  var BR = TSI.bastion.rules;
  var ER = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var T = window.TSI_DATA;
  var ED = T.explorer;
  var E = T.journeyEvents;
  var CD = T.bastionCourier;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier };
  var PACK = 'expedition_provision_pack';
  var CHART = 'overland_chart';
  var KEYS = ['id', 'point', 'goods', 'items', 'departDay', 'readyDay', 'status', 'arrivedDay', 'collectedDay', 'collectId', 'recalledDay', 'returnDay', 'feeGP'];

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function reload(b, data) { return BR.fromSave(copy(BR.toSave(b)), data || bdata); }
  function withCourier(over) {
    var d = Object.assign({}, bdata);
    d.courier = Object.assign(copy(CD), over);
    return d;
  }
  /* A Bastion on a day, with the Courier Exchange built on a plot at a
     level (0: not built), 300 gp, and 6 packs and 2 charts in the Warehouse. */
  function bastion(day, level) {
    var b = BR.defaultState(bdata);
    b.day = day || 10;
    b.anchored = true;
    b.bridge.fresh = false;
    b.partyLevel = 9;
    b.treasuryGP = 300;
    if (level) {
      b.builtPlots = [{ facId: 'courier_exchange', status: 'built' }, ''];
      BR.ensureLevels(b, bdata);
      b.facilityLevels.courier_exchange = level;
    }
    BR.addGoods(b, bdata, PACK, 6, 'Test');
    BR.addGoods(b, bdata, CHART, 2, 'Test');
    return b;
  }
  function packs(n) { return [{ goodId: PACK, qty: n }]; }
  function send(b, point, picks) { return BR.sendParcel(b, bdata, point || 'slades_muster', picks || packs(3), dice([0.37])); }
  /* A Bastion whose parcel (3 packs to Slade’s Muster, sent Day 10) is waiting there. */
  function waiting() {
    var b = bastion(10, 1);
    var p = send(b).parcel;
    b.day = 12;
    BR.settleParcels(b, bdata);
    return { b: b, p: p };
  }
  function explorer(day) {
    var s = ER.defaultState(ED);
    s.travel.day = day || 12;
    return s;
  }
  function pickup(p, over) {
    return Object.assign({
      id: p.id + ':collect:0', type: 'parcel_collected', day: 12, at: '2026-10-14T10:00:00.000Z',
      from: { code: 'DM', title: 'Courier post', step: 'pin' }, clan: 'slade', point: p.point, parcel: p.id,
      goods: copy(p.goods), text: 'Parcel collected at Slade’s Muster: 3 Expedition Provision Packs.'
    }, over || {});
  }
  function exWith(list, day) { return { travel: { day: day || 12 }, journey: { outbox: list } }; }
  function standingMsg(over) {
    return Object.assign({ id: 'abc123-1a2b3c4d:won:2', type: 'standing', day: 3, at: '2026-10-13T10:00:00.000Z', from: { code: 'T4', title: 'The Knight-Errant\'s Challenge', step: 'won' }, clan: 'slade', hr: 1, text: 'Honour/Respect +1 with Clan Slade.' }, over || {});
  }
  function charterMsg(over) {
    return Object.assign({ id: 'chartr-0a0b0c0d:dm:0', type: 'charter', day: 3, at: '2026-10-14T10:00:00.000Z', from: { code: 'DM', title: 'DM award', step: 'dm' }, clan: 'molten', port: 'goldport', text: 'For clearing the harbour of wreckers.' }, over || {});
  }
  function qty(b, id) { return BR.goodsQty(b, id); }
  /* Every line of "The Ironbow sends word…" between two days, as "day line". */
  function news(b, from, to) {
    var w = TSI.campaign.ironbowNews(copy(BR.toSave(b)), from, to);
    return [].concat.apply([], w.map(function (x) { return x.lines.map(function (l) { return x.day + ' ' + l; }); }));
  }

  /* ---------------------------------------------------------------- */
  group('Courier Exchange: the data (Harry, 14 October 2026)');

  test('the eight towns: Harry\'s levels, days and fees, each spelt as its Explorer pin, on its map, with its region\'s Clan', function (t) {
    var want = [
      ['slades_muster', 'Slade’s Muster', 'eastern_province_north', 'eastern_province', 1, 2, 5, 'slade'],
      ['moorcastle', 'Moorcastle', 'eastern_province_south', 'eastern_province', 2, 4, 10, 'slade'],
      ['bretan', 'Bretan', 'eastern_province_south', 'eastern_province', 2, 5, 10, 'slade'],
      ['middlemount', 'Middlemount', 'midland_province', 'midland_province', 2, 6, 20, 'bacca'],
      ['timberport', 'Timberport', 'northern_province_west', 'northern_province', 2, 7, 20, 'blackstone'],
      ['goldport', 'Goldport', 'southern_province_west', 'southern_province', 2, 7, 20, 'molten'],
      ['swyth', 'Swyth', 'the_east_isle', 'the_east_isle', 2, 10, 30, 'rowthorn'],
      ['bleakharbour', 'Bleakharbour', 'the_north_isle', 'the_north_isle', 2, 12, 30, 'karr']
    ];
    t.same(Object.keys(T.courierPoints), want.map(function (w) { return w[0]; }), 'the shared list');
    t.same(Object.keys(CD.points), want.map(function (w) { return w[0]; }), 'the Bastion\'s numbers');
    t.same(BR.courierPointList(bdata).map(function (p) { return [p.id, p.label, p.mapId, p.region, p.level, p.days, p.feeGP, p.clan]; }), want);
    want.forEach(function (w) {
      var g = T.courierPoints[w[0]];
      t.equal(g.pin, w[0], w[0] + ': keyed by its pin');
      var pin = (ED.markersByMapId[g.mapId] || []).filter(function (m) { return m.id === g.pin; })[0];
      t.ok(pin, w[0] + ' is a pin on ' + g.mapId);
      t.equal(pin.label, g.label, w[0] + ': spelt as the pin');
      t.ok(pin.submapImage, w[0] + ' has a town picture to click');
      t.equal(ED.maps.filter(function (m) { return m.id === g.mapId; })[0].province, g.region, w[0] + ': the map\'s region');
      t.same([Bg.isPoint(w[0]), Bg.pointLabel(w[0]), Bg.pointClan(w[0]), Bg.pointAtPin(w[0])], [true, w[1], w[7], w[0]]);
      t.equal(Object.keys(g).sort().join(), 'label,mapId,pin,region', w[0] + ': no Clan written twice');
    });
    t.equal(T.courierPoints.slades_muster.label.indexOf('’'), 5, 'Slade’s Muster has its curly apostrophe');
    t.same([Bg.isPoint('wyre'), Bg.pointClan('wyre'), Bg.pointAtPin('wyre')], [false, '', '']);
  });

  test('room by level: 1 parcel of up to 5 items, then 2 of up to 10; Levels 3 to 5 use Level 2\'s room; the rest of the numbers', function (t) {
    t.same(CD.levels, { 1: { name: 'Dispatch Local Parcel', onRoad: 1, maxItems: 5 }, 2: { name: 'Regional Expedition Delivery', onRoad: 2, maxItems: 10 } });
    t.same([0, 1, 2, 3, 4, 5].map(function (lv) { var sp = BR.courierSpec(bastion(10, lv), bdata); return [sp.built, sp.level, sp.onRoad, sp.maxItems]; }),
      [[false, 0, 0, 0], [true, 1, 1, 5], [true, 2, 2, 10], [true, 3, 2, 10], [true, 4, 2, 10], [true, 5, 2, 10]]);
    t.same([CD.minDays, CD.keptClosed, CD.provisional], [1, 30, true]);
    t.same(CD.later.map(function (l) { return [l.level, l.name]; }), [[3, 'Collect Expedition Cargo'], [4, 'Priority Courier'], [5, 'Express Cargo Exchange']]);
    t.equal(BR.courierPoint(withCourier({ points: { slades_muster: { level: 1, days: 0, feeGP: 5 } } }), 'slades_muster').days, 1, 'never an instant delivery');
  });

  test('what a parcel carries: packs and charts, 1 item each, each a Bastion good and a Travel bags kind; never a trade good', function (t) {
    t.same(Object.keys(CD.items), ['expedition_provision_pack', 'overland_chart', 'earthward_talisman', 'rootguard_salve', 'blessed_lantern', 'purification_incense', 'cleansing_portion', 'voyage_blessing', 'aquatic_protection_charm', 'restorative_herbs', 'antivenom_roots', 'toxic_blossoms', 'alchemical_flowers'], 'and the Shrines\' items since pull request 8b, and the four herbs and roots since 20 October 2026');
    Object.keys(CD.items).forEach(function (id) { t.equal(CD.items[id].size, 1); });
    t.same(CD.manualAdd, [PACK, CHART]);
    Object.keys(CD.items).forEach(function (id) {
      var g = BR.good(bdata, id);
      t.ok(g && g.kind !== 'cargo', id + ' is a Warehouse good, not a trade good');
      t.ok(T.partyItems[id], id + ' is a Travel bags kind');
      t.equal(g.name, T.partyItems[id].name, id + ': the same name in both tools');
    });
    t.same(BR.courierGoods(bdata).slice(0, 2).map(function (g) { return [g.goodId, g.name, g.size]; }), [[PACK, 'Expedition Provision Pack', 1], [CHART, 'Overland chart', 1]]);
    t.equal(BR.courierGoods(bdata).length, 13);
    BR.goodsList(bdata).filter(function (g) { return g.kind === 'cargo'; }).forEach(function (g) {
      t.ok(BR.courierGoodBlocker(bdata, g.id), g.id + ' never goes by courier');
    });
    var listed = withCourier({ items: { raw_timber: { size: 1 }, restorative_herbs: { size: 1 }, expedition_provision_pack: { size: 2 } } });
    t.ok(/bulk cargo/.test(BR.courierGoodBlocker(listed, 'raw_timber')), 'a trade good is refused even if listed');
    var held = T.partyItems.restorative_herbs;
    delete T.partyItems.restorative_herbs;
    try { t.ok(/can't go in the Travel bags/.test(BR.courierGoodBlocker(listed, 'restorative_herbs')), 'so is a good the bags can\'t hold'); } finally { T.partyItems.restorative_herbs = held; }
    t.ok(/doesn't go by courier/.test(BR.courierGoodBlocker(withCourier({ items: {} }), 'restorative_herbs')));
    t.equal(BR.parcelItems(listed, packs(3)), 6, 'size counts');
    t.equal(BR.goodShipBlocker(bdata, CHART, null), 'Overland chart isn\'t a trade good (ingredients and supplies don\'t sail).', 'a chart never sails with the Dock');
  });

  test('the Courier Exchange: built on a Development Plot from party level 9, in 21 days; no longer in development', function (t) {
    var f = BR.facility(bdata, 'courier_exchange');
    t.same([f.requiredLevel, f.plot, f.inDevelopment, f.functions], [5, true, undefined, []]);
    t.ok(/parcels of supplies/.test(f.description));
    var b = bastion(10, 0);
    b.partyLevel = 8;
    t.equal(BR.plotRows(b, 8, bdata).rows.length, 0, 'no plot before party level 9');
    b.partyLevel = 9;
    BR.plotRows(b, 9, bdata);
    var r = BR.startBuild(b, bdata, 0, 'courier_exchange', 'plot');
    t.equal(r.ok, true, r.message);
    t.same([b.builtPlots[0].status, b.builtPlots[0].readyDay], ['building', 31], '21 days');
    t.equal(BR.startBuild(b, bdata, 0, 'courier_exchange', 'slot').ok, false, 'never in a construction slot');
  });

  /* ---------------------------------------------------------------- */
  group('Courier Exchange: sending a parcel');

  test('Send: the goods and the fee leave once, and the parcel is recorded, its fields in a fixed order', function (t) {
    var b = bastion(10, 1);
    var r = send(b);
    t.equal(r.ok, true, r.message);
    var p = r.parcel;
    t.same(Object.keys(p), KEYS);
    t.same([p.point, p.goods, p.items, p.departDay, p.readyDay, p.status, p.arrivedDay, p.collectedDay, p.collectId, p.recalledDay, p.returnDay, p.feeGP],
      ['slades_muster', [{ goodId: PACK, qty: 3 }], 3, 10, 12, 'in_transit', null, null, null, null, null, 5]);
    t.ok(Bg.UID_PATTERN.test(p.id) && Bg.ID_PATTERN.test(Bg.collectId(p.id)), p.id);
    t.same([qty(b, PACK), qty(b, CHART), b.treasuryGP], [3, 2, 295]);
    t.same(r.log, ['Courier', 'A parcel left for Slade’s Muster: 3 Expedition Provision Packs, from the Warehouse (fee 5 gp from the treasury). It reaches Slade’s Muster on Day 12 and waits there until the party collects it.']);
    t.same(BR.parcels(b), [p]);
    t.equal(b.tradeNetwork.voyages.length, 0, 'nothing to do with the Dock');
  });

  test('every refusal changes nothing, with a plain reason', function (t) {
    function refused(b, point, picks, re, label) {
      var before = copy(BR.toSave(b));
      var why = BR.parcelProblem(b, bdata, point, picks);
      var r = BR.sendParcel(b, bdata, point, picks, dice([0.3]));
      t.equal(r.ok, false, label);
      t.equal(r.message, why, label + ': the same reason as the check');
      t.ok(re.test(r.message), label + ': ' + r.message);
      t.same(copy(BR.toSave(b)), before, label + ': nothing changed');
    }
    refused(bastion(10, 0), 'slades_muster', packs(1), /^The Courier Exchange isn't built\.$/, 'not built');
    var rep = bastion(10, 1);
    rep.repairs = { courier_exchange: 12 };
    refused(rep, 'slades_muster', packs(1), /^The Courier Exchange is Under Repair until Day 12\.$/, 'Under Repair');
    var full = bastion(10, 1);
    send(full);
    refused(full, 'slades_muster', packs(1), /^A parcel is already travelling: the first place is free on Day 12\.$/, 'at capacity');
    refused(bastion(10, 1), 'slades_muster', packs(6), /^That's 6 items: a parcel from a Level 1 Courier Exchange holds up to 5 items\.$/, 'too many items');
    refused(bastion(10, 1), 'slades_muster', [{ goodId: CHART, qty: 3 }], /^Needs 3 Overland charts in the Warehouse; it has 2 charts\.$/, 'too few goods');
    var poor = bastion(10, 2);
    poor.treasuryGP = 4;
    refused(poor, 'moorcastle', packs(1), /^Sending a parcel to Moorcastle costs 10 gp; the treasury has 4 gp\.$/, 'too little gold');
    refused(bastion(10, 1), 'nowhere', packs(1), /^Choose a town the courier knows\.$/, 'unknown town');
    refused(bastion(10, 1), 'moorcastle', packs(1), /^Moorcastle needs the Courier Exchange at Level 2 \(it's Level 1\)\.$/, 'a town above the level');
    var timber = bastion(10, 1);
    BR.addGoods(timber, bdata, 'raw_timber', 2, 'Test');
    refused(timber, 'slades_muster', [{ goodId: 'raw_timber', qty: 1 }], /doesn't go by courier/, 'a good not listed');
    refused(bastion(10, 1), 'slades_muster', [], /^Choose at least 1 item to send\.$/, 'nothing chosen');
    refused(bastion(10, 1), 'slades_muster', packs(0), /^Choose at least 1 item to send\.$/, 'zero items');
    var empty = bastion(10, 1);
    empty.warehouse = [];
    refused(empty, 'slades_muster', packs(1), /^The Warehouse has nothing the courier carries \(Expedition Provision Packs, Overland charts and the Shrines' items\)\.$/, 'nothing to send');
  });

  test('Level 1 reaches only Slade’s Muster; Level 2 reaches all eight, two travelling at once, up to 10 items each', function (t) {
    t.same(BR.courierPoints(bastion(10, 1), bdata).map(function (p) { return p.id; }), ['slades_muster']);
    t.equal(BR.courierStatusLine(bastion(10, 1), bdata), 'Level 1: 1 parcel travelling at a time, up to 5 items each. Reaches: Slade’s Muster.');
    var b = bastion(10, 2);
    t.equal(BR.courierPoints(b, bdata).length, 8);
    t.equal(BR.courierStatusLine(b, bdata), 'Level 2: 2 parcels travelling at a time, up to 10 items each. Reaches: Slade’s Muster, Moorcastle, Bretan, Middlemount, Timberport, Goldport, Swyth, Bleakharbour.');
    BR.addGoods(b, bdata, PACK, 6, 'Test');
    t.ok(/^That's 11 items/.test(BR.parcelProblem(b, bdata, 'goldport', [{ goodId: PACK, qty: 9 }, { goodId: CHART, qty: 2 }])));
    var r = BR.sendParcel(b, bdata, 'goldport', [{ goodId: PACK, qty: 8 }, { goodId: CHART, qty: 2 }], dice([0.3]));
    t.equal(r.ok, true, r.message);
    t.same([r.parcel.items, r.parcel.readyDay, r.parcel.feeGP, b.treasuryGP], [10, 17, 20, 280]);
    t.equal(send(b, 'bleakharbour', packs(1)).parcel.readyDay, 22, 'Bleakharbour: 12 days');
    t.ok(/^All 2 travelling places are taken: the first place is free on Day 17\.$/.test(send(b, 'bretan', packs(1)).message));
    t.equal(BR.parcelSummary(bastion(10, 1), bdata, 'slades_muster', packs(3)), '3 items of 5 · fee 5 gp · leaves today, reaches Slade’s Muster on Day 12 and waits there until the party collects it.');
  });

  test('a parcel waiting at its town doesn\'t take a travelling place; two sent in the same moment never share an id', function (t) {
    var w = waiting();
    t.equal(w.p.status, 'ready');
    t.equal(BR.parcelBlocker(w.b, bdata), '');
    var again = send(w.b);
    t.equal(again.ok, true, again.message);
    t.ok(again.parcel.id !== w.p.id, 'a new id');
    var b = bastion(10, 2);
    var a = BR.sendParcel(b, bdata, 'moorcastle', packs(1), dice([0.5])).parcel;
    var c = BR.sendParcel(b, bdata, 'bretan', packs(1), dice([0.5])).parcel;
    t.ok(a.id !== c.id, a.id + ' / ' + c.id);
    t.ok(Bg.UID_PATTERN.test(c.id));
  });

  test('a new parcel never takes an id with a pickup receipt or a pickup already sent', function (t) {
    var b = bastion(10, 2);
    var real = BR.uid;
    var ids = [];
    try {
      BR.uid = function () { return 'fixedid1'; };
      b.bridge.done['fixedid1:collect:0'] = { r: 'refused' };
      ids.push(BR.sendParcel(b, bdata, 'moorcastle', packs(1), dice([0.5])).parcel.id);
      ids.push(BR.sendParcel(b, bdata, 'bretan', packs(1), dice([0.5]), exWith([{ id: 'fixedid1-3:collect:0', type: 'parcel_collected', day: 1 }])).parcel.id);
    } finally { BR.uid = real; }
    t.same(ids, ['fixedid1-2', 'fixedid1-4']);
  });

  /* ---------------------------------------------------------------- */
  group('Courier Exchange: arriving, and waiting for the party');

  test('nothing before its day; on it the parcel waits at its town, once (settled twice, with a reload between)', function (t) {
    var b = bastion(10, 1);
    var p = send(b).parcel;
    b.day = 11;
    t.equal(BR.settleParcels(b, bdata).changed, false);
    t.equal(p.status, 'in_transit');
    b.day = 12;
    var r = BR.settleParcels(b, bdata);
    t.same([p.status, p.arrivedDay], ['ready', 12]);
    t.same(r.log, [['Courier', 'A parcel from the Ironbow has reached Slade’s Muster: 3 Expedition Provision Packs. It waits there until the party collects it.']]);
    t.same(r.word, ['A parcel is waiting at Slade’s Muster for the party to collect.']);
    var back = reload(b);
    var again = BR.settleParcels(back, bdata);
    t.same([again.changed, again.log, BR.parcels(back)[0].status, BR.parcels(back)[0].arrivedDay], [false, [], 'ready', 12]);
    t.same([qty(back, PACK), back.treasuryGP], [3, 295], 'nothing given back or taken again');
  });

  test('a waiting parcel waits however long it takes: only the pickup closes it', function (t) {
    var w = waiting();
    w.b.day = 400;
    t.equal(BR.settleParcels(w.b, bdata).changed, false);
    var back = reload(w.b);
    t.same([BR.parcels(back)[0].status, qty(back, PACK)], ['ready', 3]);
    t.ok(/has already reached Slade’s Muster/.test(BR.recallParcel(back, bdata, w.p.id).message), 'it can\'t be recalled');
    t.equal(BR.parcelState(BR.parcels(back)[0]), 'Waiting at Slade’s Muster since Day 12, for the party to collect');
  });

  /* ---------------------------------------------------------------- */
  group('Courier Exchange: the Bastion records the pickup once');

  test('the pickup closes the parcel once, with its receipt in the same state; again, after a reload or from a campaign file, nothing more', function (t) {
    var w = waiting();
    var b = w.b;
    var hr = copy(b.honourRespectByClan);
    var pc = copy(b.politicalCapital);
    var m = pickup(w.p);
    b.dayInProgress = { day: 12, stage: 'trade', skipped: [], attackRolled: false, news: [] };
    var r = BR.applyInbox(b, bdata, exWith([m]), 1000);
    t.same([r.parcels, r.applied, r.charters, r.refused], [['Collected at Slade’s Muster: 3 Expedition Provision Packs (from the Explorer).'], [], [], 0]);
    t.same(b.dayInProgress.news, ['From the Explorer: Parcel collected at Slade’s Muster: 3 Expedition Provision Packs.'], 'in "The Ironbow sends word…" when a day is passing');
    var p = BR.parcels(b)[0];
    t.same([p.status, p.collectedDay, p.collectId], ['collected', 12, m.id]);
    t.same(b.bridge.done[m.id], { r: 'applied', day: 12, at: 1000, clan: 'slade', hr: 0, was: 0, now: 0, text: m.text, why: '', type: 'parcel_collected', parcel: w.p.id, point: 'slades_muster', held: false });
    t.equal(b.log[0].body, 'Parcel collected at Slade’s Muster (DM, Day 12): 3 Expedition Provision Packs. The parcel is closed.');
    t.same([b.honourRespectByClan, b.politicalCapital], [hr, pc], 'never Honour/Respect');
    t.equal(BR.applyInbox(b, bdata, exWith([m]), 2000).changed, false, 'a second look changes nothing');
    var back = reload(b);
    t.same(back.bridge.done[m.id], b.bridge.done[m.id], 'the receipt reloads, kind and all');
    t.equal(BR.applyInbox(back, bdata, exWith([m]), 3000).changed, false, 'nor after a reload');
    var BK = TSI.backupRules;
    var file = BK.parse(JSON.stringify(BK.makeCampaignBackup([
      TSI.storeRules.makeRecord('tsi.explorer.save', exWith([m]), new Date()),
      TSI.storeRules.makeRecord('tsi.bastion.state', BR.toSave(back), new Date())
    ], new Date(), 'suite')));
    t.ok(file.ok);
    t.same(file.backup.records.map(function (x) { return x.key; }), ['tsi.explorer.save', 'tsi.bastion.state'], 'no new storage keys');
    var restored = BR.fromSave(file.backup.records[1].value, bdata);
    t.equal(BR.importProblem(file.backup.records), null, 'the campaign file imports');
    t.same(BR.toSave(restored).tradeNetwork.parcels, BR.toSave(back).tradeNetwork.parcels);
    t.equal(BR.applyInbox(restored, bdata, exWith([m]), 4000).changed, false, 'nor from a campaign file');
    t.same([qty(restored, PACK), restored.treasuryGP], [3, 295]);
  });

  test('no record of the parcel: refused, nothing changes, and the Explorer says what to do', function (t) {
    var w = waiting();
    var m = pickup({ id: 'zzzzzz00000', point: 'slades_muster', goods: packs(3) });
    var before = copy(BR.toSave(w.b).tradeNetwork);
    var r = BR.applyInbox(w.b, bdata, exWith([m]), 1000);
    t.equal(r.refused, 1);
    t.same(BR.toSave(w.b).tradeNetwork, before);
    var rec = w.b.bridge.done[m.id];
    t.same([rec.r, rec.type, rec.parcel, rec.why], ['refused', 'parcel_collected', 'zzzzzz00000', 'The Bastion has no record of this parcel (a save from another moment?). Nothing changed. Check both the Warehouse and the Travel bags.']);
    t.equal(Bg.statusOf(m, copy(BR.toSave(w.b))).line, 'Refused: The Bastion has no record of this parcel (a save from another moment?). Nothing changed. Check both the Warehouse and the Travel bags. The items stay in the Travel bags; take them out with ✕ if they shouldn\'t be there.');
  });

  test('already recorded as collected: applied, nothing changes, and the Explorer says so', function (t) {
    var w = waiting();
    var m = pickup(w.p);
    BR.applyInbox(w.b, bdata, exWith([m]), 1000);
    delete w.b.bridge.done[m.id];
    var before = copy(BR.toSave(w.b).tradeNetwork);
    var r = BR.applyInbox(w.b, bdata, exWith([m]), 2000);
    t.same([r.parcels, r.refused], [[], 0]);
    t.same(BR.toSave(w.b).tradeNetwork, before);
    t.same([w.b.bridge.done[m.id].r, w.b.bridge.done[m.id].held], ['applied', true]);
    t.equal(Bg.statusOf(m, copy(BR.toSave(w.b))).line, 'Applied on Day 12: the Bastion had already recorded the parcel at Slade’s Muster as collected, so nothing changed.');
  });

  test('a recalled parcel\'s pickup is refused: its goods go home once, never to both places', function (t) {
    var b = bastion(10, 1);
    var p = send(b).parcel;
    b.day = 11;
    BR.recallParcel(b, bdata, p.id);
    var m = pickup(p, { day: 11 });
    var r = BR.applyInbox(b, bdata, exWith([m], 11), 1000);
    t.equal(r.refused, 1);
    t.equal(b.bridge.done[m.id].why, 'That parcel was recalled; its items were already on their way back to the Warehouse.');
    t.equal(BR.parcels(b)[0].status, 'returning');
    b.day = 12;
    BR.settleParcels(b, bdata);
    t.same([BR.parcels(b)[0].status, qty(b, PACK)], ['returned', 6]);
  });

  test('a town that differs from the parcel\'s, or isn\'t known, or a Clan that isn\'t, still closes the parcel (noted)', function (t) {
    var w = waiting();
    var m = pickup(w.p, { point: 'bretan' });
    t.equal(Bg.check(m), '');
    BR.applyInbox(w.b, bdata, exWith([m]), 1000);
    t.same([BR.parcels(w.b)[0].status, w.b.bridge.done[m.id].point], ['collected', 'slades_muster']);
    t.ok(/The Explorer named Bretan, but the parcel was sent to Slade’s Muster\./.test(w.b.log[0].body), w.b.log[0].body);
    var x = waiting();
    var odd = pickup(x.p, { point: 'atlantis', clan: 'ironbow', extra: 'kept by a newer copy' });
    t.equal(Bg.check(odd), '', 'town, Clan and other fields are only for showing');
    BR.applyInbox(x.b, bdata, exWith([odd]), 1000);
    t.equal(BR.parcels(x.b)[0].status, 'collected');
  });

  test('a pickup an older Explorer reshaped (hr: 0, no town or parcel) closes the parcel once, without Honour/Respect', function (t) {
    var w = waiting();
    var full = pickup(w.p);
    var old = { id: full.id, type: 'parcel_collected', day: 12, at: full.at, from: full.from, clan: 'slade', hr: 0, text: full.text };
    t.equal(Bg.check(old), '');
    var hr = copy(w.b.honourRespectByClan);
    var r = BR.applyInbox(w.b, bdata, exWith([old]), 1000);
    t.same([r.parcels.length, r.applied, BR.parcels(w.b)[0].status], [1, [], 'collected']);
    t.same(w.b.honourRespectByClan, hr);
    t.equal(BR.applyInbox(reload(w.b), bdata, exWith([old, full]), 2000).changed, false, 'the full copy of the same pickup changes nothing');
    var y = waiting();
    var p5 = Bg.clean(pickup(y.p));
    delete p5.goods;
    BR.applyInbox(y.b, bdata, exWith([p5]), 1000);
    t.equal(BR.parcels(y.b)[0].status, 'collected', 'a pull request 5 Explorer\'s copy (goods dropped) too');
  });

  test('still on the road in this Bastion (a save from an earlier moment): closed, so it never arrives or comes home as well', function (t) {
    var b = bastion(10, 1);
    var p = send(b).parcel;
    b.day = 11;
    var r = BR.applyInbox(b, bdata, exWith([pickup(p, { day: 11 })], 11), 1000);
    t.equal(r.parcels.length, 1);
    t.same([p.status, p.collectedDay, p.arrivedDay], ['collected', 11, null]);
    t.ok(/hadn't recorded its arrival yet/.test(b.log[0].body));
    b.day = 20;
    t.equal(BR.settleParcels(b, bdata).changed, false);
    t.same([p.status, qty(b, PACK)], ['collected', 3]);
    t.ok(/can't be recalled|already been collected/.test(BR.recallParcel(b, bdata, p.id).message));
  });

  test('a copy without the courier rules leaves the pickup waiting, with no receipt; a damaged one is refused', function (t) {
    var w = waiting();
    var m = pickup(w.p);
    var keep = BR.collectParcel;
    try {
      delete BR.collectParcel;
      var r = BR.applyInbox(w.b, bdata, exWith([m, standingMsg()]), 1000);
      t.equal(Object.prototype.hasOwnProperty.call(w.b.bridge.done, m.id), false);
      t.equal(r.applied.length, 1, 'the changes after it still apply');
    } finally { BR.collectParcel = keep; }
    t.equal(Bg.statusOf(m, copy(BR.toSave(w.b))).kind, 'waiting');
    t.equal(BR.applyInbox(w.b, bdata, exWith([m, standingMsg()]), 2000).parcels.length, 1, 'then a copy with them applies it');
    var bad = pickup(w.p, { id: 'ab:collect:0' });
    t.equal(Bg.check(bad), 'Its id is damaged.');
    t.equal(Bg.check(pickup(w.p, { parcel: 'somethingelse' })), 'It names a different parcel from its id.');
    t.equal(Bg.check(pickup(w.p, { id: w.p.id + ':dm:0' })), 'Its id isn\'t a parcel pickup\'s.');
    var x = waiting();
    var res = BR.applyInbox(x.b, bdata, exWith([pickup(x.p, { parcel: 'somethingelse' })]), 1000);
    t.equal(res.refused, 1);
    t.same([BR.parcels(x.b)[0].status, x.b.bridge.done[x.p.id + ':collect:0'].type], ['ready', 'parcel_collected']);
  });

  test('a Bastion starting from nothing skips a pickup sent before it, and counts it apart from Honour/Respect and Charters', function (t) {
    var b = BR.defaultState(bdata);
    BR.anchor(b, 12);
    var m = pickup({ id: 'qqqqqq11111', point: 'slades_muster', goods: packs(3) });
    var r = BR.applyInbox(b, bdata, exWith([m, standingMsg(), charterMsg()]), 1000);
    t.equal(r.skipped, 3);
    t.same(b.log.map(function (l) { return l.body; }), [
      '1 parcel pickup, collected before this Bastion started, was skipped, so nothing counts twice. Clan Influence lists it; the items stay in the Travel bags.',
      '1 Port Charter, sent before this Bastion started, was skipped, so nothing counts twice. Clan Influence lists it: grant it again in the Explorer if it should count.',
      '1 change to Honour/Respect, sent before this Bastion started, was skipped, so nothing counts twice. Clan Influence lists it, to type in by hand if it should count.'
    ]);
    t.same([b.bridge.done[m.id].r, b.bridge.done[m.id].type, b.bridge.done[m.id].parcel], ['skipped', 'parcel_collected', 'qqqqqq11111']);
    t.equal(Bg.statusOf(m, copy(BR.toSave(b))).line, 'Skipped: collected before this Bastion started.');
    var two = BR.defaultState(bdata);
    BR.anchor(two, 12);
    BR.applyInbox(two, bdata, exWith([m, pickup({ id: 'qqqqqq22222', point: 'goldport', goods: [] })]), 1000);
    t.same(two.log.map(function (l) { return l.body; }), ['2 parcel pickups, collected before this Bastion started, were skipped, so nothing counts twice. Clan Influence lists them; the items stay in the Travel bags.']);
  });

  /* ---------------------------------------------------------------- */
  group('Courier Exchange: recalling a parcel (Harry, 14 October 2026)');

  test('sent Day 10, recalled Day 12: home Day 14; its goods back once; the fee isn\'t refunded', function (t) {
    var b = bastion(10, 2);
    var p = send(b, 'bretan').parcel;
    t.same([p.readyDay, b.treasuryGP], [15, 290]);
    b.day = 12;
    t.equal(BR.parcelRecallDay(b, p), 14);
    var r = BR.recallParcel(b, bdata, p.id);
    t.equal(r.ok, true, r.message);
    t.same([p.status, p.recalledDay, p.returnDay], ['returning', 12, 14]);
    t.same(r.log, ['Courier', 'The parcel bound for Bretan was recalled and turned back for the Ironbow. It is home on Day 14, and its contents (3 Expedition Provision Packs) go back into the Warehouse then. The 10 gp fee isn\'t refunded.']);
    t.equal(BR.parcelState(p), 'Recalled on the way to Bretan: back at the Ironbow on Day 14');
    b.day = 13;
    t.equal(BR.settleParcels(b, bdata).changed, false);
    b.day = 15;
    t.equal(BR.settleParcels(b, bdata).log.length, 1, 'never reaches Bretan');
    t.same([p.status, qty(b, PACK), b.treasuryGP], ['returned', 6, 290]);
    var back = reload(b);
    BR.settleParcels(back, bdata);
    t.same([qty(back, PACK), BR.parcels(back)[0].status], [6, 'returned'], 'never twice');
  });

  test('the word when it\'s home; recalled the day it was sent, it\'s home the next day; Bleakharbour 6 days out, 6 back', function (t) {
    var b = bastion(10, 1);
    var p = send(b).parcel;
    BR.recallParcel(b, bdata, p.id);
    t.same([p.recalledDay, p.returnDay], [10, 11]);
    b.day = 11;
    var r = BR.settleParcels(b, bdata);
    t.same(r.word, ['The recalled parcel is back at the Ironbow; its contents (3 Expedition Provision Packs) are back in the Warehouse.']);
    var c = bastion(10, 2);
    var q = send(c, 'bleakharbour').parcel;
    c.day = 16;
    BR.recallParcel(c, bdata, q.id);
    t.same([q.readyDay, q.returnDay], [22, 22]);
  });

  test('not on or after its arrival day, nor twice, nor once it has arrived or been collected', function (t) {
    var b = bastion(10, 1);
    var p = send(b).parcel;
    b.day = 12;
    var before = copy(BR.toSave(b));
    t.equal(BR.recallParcel(b, bdata, p.id).message, 'That parcel reaches Slade’s Muster today: it can\'t be recalled now.');
    t.same(copy(BR.toSave(b)), before);
    b.day = 13;
    t.ok(/today/.test(BR.parcelRecallBlocker(b, p)), 'after its day, before the Bastion settled it');
    BR.settleParcels(b, bdata);
    t.ok(/already reached Slade’s Muster/.test(BR.recallParcel(b, bdata, p.id).message));
    var c = bastion(10, 1);
    var q = send(c).parcel;
    BR.recallParcel(c, bdata, q.id);
    t.ok(/already been recalled/.test(BR.recallParcel(c, bdata, q.id).message));
    t.ok(/isn't on the road/.test(BR.recallParcel(c, bdata, 'nope').message));
  });

  test('a recalled parcel holds its travelling place until it\'s home; the Explorer can\'t collect it', function (t) {
    var b = bastion(10, 1);
    var p = send(b).parcel;
    b.day = 11;
    BR.recallParcel(b, bdata, p.id);
    t.equal(BR.parcelBlocker(b, bdata), 'A parcel is already travelling: the first place is free on Day 12.');
    var c = J.collectParcel(explorer(11), p.id, 'slades_muster', copy(BR.toSave(b)), {});
    t.same([c.ok, c.message], [false, 'That parcel was recalled to the Ironbow: it can\'t be collected.']);
    b.day = 12;
    BR.settleParcels(b, bdata);
    t.equal(BR.parcelBlocker(b, bdata), '');
  });

  /* ---------------------------------------------------------------- */
  group('Courier Exchange: Under Repair and Demolish');

  test('Under Repair: no new parcels; those already out arrive and can be collected; a recall is still allowed', function (t) {
    var b = bastion(10, 2);
    var a = send(b, 'slades_muster').parcel;
    var c = send(b, 'bretan').parcel;
    b.repairs = { courier_exchange: 20 };
    b.day = 12;
    t.ok(/Under Repair until Day 20/.test(BR.parcelBlocker(b, bdata)));
    t.equal(BR.recallParcel(b, bdata, c.id).ok, true, 'recalled while Under Repair');
    BR.settleParcels(b, bdata);
    t.equal(a.status, 'ready');
    t.equal(J.collectParcel(explorer(12), a.id, 'slades_muster', copy(BR.toSave(b)), {}).ok, true);
    BR.applyInbox(b, bdata, exWith([pickup(a)]), 1000);
    t.equal(a.status, 'collected');
    b.day = 14;
    BR.settleParcels(b, bdata);
    t.same([c.status, qty(b, PACK)], ['returned', 3]);
  });

  test('Demolish: parcels already sent still arrive, can be collected, and recalled ones come home, but none can be recalled after; the question says so', function (t) {
    var b = bastion(10, 2);
    var a = send(b, 'bretan').parcel;
    var c = send(b, 'moorcastle').parcel;
    b.day = 11;
    BR.recallParcel(b, bdata, c.id);
    t.equal(BR.courierDemolishNote(b), 'The 2 parcels already sent carry on: they still arrive and can be collected (and recalled ones still come home), but they can no longer be recalled.');
    t.equal(BR.demolishFacility(b, bdata, 'courier_exchange').ok, true);
    var no = BR.recallParcel(b, bdata, a.id);
    t.same([no.ok, no.message, a.status], [false, 'The Courier Exchange has been demolished, so the parcel can\'t be recalled; it still reaches Bretan and can be collected there.', 'in_transit']);
    t.equal(BR.courierSpec(b, bdata).built, false);
    t.equal(BR.parcelBlocker(b, bdata), 'The Courier Exchange isn\'t built.');
    b.day = 12;
    BR.settleParcels(b, bdata);
    t.same([c.status, qty(b, PACK)], ['returned', 3]);
    b.day = 15;
    BR.settleParcels(b, bdata);
    t.equal(a.status, 'ready');
    /* Rebuilt at Level 1, which doesn't reach Bretan: collecting never asks. */
    b.builtPlots = [{ facId: 'courier_exchange', status: 'built' }, ''];
    BR.ensureLevels(b, bdata);
    t.equal(J.collectParcel(explorer(15), a.id, 'bretan', copy(BR.toSave(b)), {}).ok, true);
    BR.applyInbox(b, bdata, exWith([pickup(a, { day: 15, point: 'bretan' })], 15), 1000);
    t.equal(a.status, 'collected');
    t.equal(BR.courierDemolishNote(b), '');
    var one = waiting();
    t.equal(BR.courierDemolishNote(one.b), 'The parcel already sent carries on: it still arrives and can be collected (or, if it was recalled, still comes home), but it can no longer be recalled.');
  });

  /* ---------------------------------------------------------------- */
  group('Courier Exchange: saves, Reset Travel and the forecast');

  /* A Bastion with a parcel in every state. */
  function everyState() {
    var b = bastion(10, 2);
    BR.addGoods(b, bdata, PACK, 20, 'Test');
    var col = send(b, 'slades_muster', packs(1)).parcel;
    var ret = send(b, 'moorcastle', packs(1)).parcel;
    BR.recallParcel(b, bdata, ret.id);
    b.day = 11;
    BR.settleParcels(b, bdata);
    var rdy = send(b, 'slades_muster', packs(2)).parcel;
    b.day = 12;
    BR.settleParcels(b, bdata);
    BR.applyInbox(b, bdata, exWith([pickup(col)]), 1000);
    var back = send(b, 'goldport', [{ goodId: CHART, qty: 1 }]).parcel;
    b.day = 13;
    BR.settleParcels(b, bdata);
    b.day = 14;
    BR.settleParcels(b, bdata);
    BR.recallParcel(b, bdata, back.id);
    var road = send(b, 'swyth', packs(1)).parcel;
    return { b: b, col: col, ret: ret, rdy: rdy, back: back, road: road };
  }

  test('loading twice gives the same save, field order and all; parcels in every state', function (t) {
    var x = everyState();
    t.same(BR.parcels(x.b).map(function (p) { return p.status; }), ['collected', 'returned', 'ready', 'returning', 'in_transit']);
    BR.parcels(x.b).forEach(function (p) { t.same(Object.keys(p), KEYS, p.status); });
    var once = reload(x.b);
    t.equal(JSON.stringify(BR.toSave(once).tradeNetwork.parcels), JSON.stringify(BR.toSave(x.b).tradeNetwork.parcels), 'loading changes nothing');
    t.equal(JSON.stringify(BR.toSave(reload(once))), JSON.stringify(BR.toSave(once)), 'the same JSON twice');
  });

  test('a Bastion saved before pull request 6 loads with no parcels, the same twice', function (t) {
    var s = copy(BR.toSave(bastion(10, 1)));
    delete s.tradeNetwork.parcels;
    var b = BR.fromSave(s, bdata);
    t.same(b.tradeNetwork.parcels, []);
    t.same(Object.keys(b.tradeNetwork), Object.keys(BR.defaultTradeNetwork()));
    t.equal(JSON.stringify(BR.toSave(reload(b))), JSON.stringify(BR.toSave(b)));
    var older = copy(s);
    older.tradeNetwork = { active: true, strategy: 'balanced', stability: 75, routes: [] };
    t.same(BR.fromSave(older, bdata).tradeNetwork.parcels, [], 'from before pull request 5 too');
    t.equal(BR.saveProblem(s), null);
  });

  test('the cleaner never drops a parcel still out (unknown goods kept), tidies damaged fields, and trims closed ones oldest first', function (t) {
    var list = [
      { id: 'aaaaaa1', point: 'slades_muster', goods: [{ goodId: 'potion_of_flying', qty: 2 }], items: 2, departDay: 3, readyDay: 5, status: 'ready', arrivedDay: 5, feeGP: 5 },
      { id: 'aaaaaa2', point: 'goldport', goods: packs(1), departDay: 3, readyDay: 3, status: 'lost?', arrivedDay: 9 },
      { point: 'bretan', goods: packs(2), departDay: 4, readyDay: 9, status: 'in_transit' },
      { goods: packs(2), status: 'collected', collectId: 'x:collect:0' },
      { id: 'aaaaaa3', goods: [], status: 'in_transit' },
      { id: 'aaaaaa4', point: 'moorcastle', goods: packs(1), departDay: 4, readyDay: 8, status: 'returning', recalledDay: 2 },
      'junk', null
    ];
    var out = BR.cleanParcels(list, 10, 30);
    t.same(out.map(function (p) { return [p.id, p.point, p.status]; }), [['aaaaaa1', 'slades_muster', 'ready'], ['aaaaaa2', 'goldport', 'ready'], ['parcel-2', 'bretan', 'in_transit'], ['aaaaaa4', 'moorcastle', 'returning']]);
    t.same(out[0].goods, [{ goodId: 'potion_of_flying', qty: 2 }], 'goods the data doesn\'t know are kept');
    t.same([out[1].readyDay, out[1].arrivedDay, out[1].items], [4, 9, 1], 'never an instant delivery; the arrival kept');
    t.same([out[3].recalledDay, out[3].returnDay], [4, 5], 'recalled no earlier than it left; home at least a day later');
    t.same(BR.cleanParcels(out, 10, 30), out, 'the same twice');
    var many = [];
    for (var i = 0; i < 33; i++) many.push({ id: 'closed' + (100 + i), point: 'slades_muster', goods: packs(1), departDay: i, readyDay: i + 2, status: i % 2 ? 'collected' : 'returned', collectId: i % 2 ? 'closed' + (100 + i) + ':collect:0' : null, recalledDay: i % 2 ? null : i, returnDay: i % 2 ? null : i + 1 });
    many.splice(5, 0, { id: 'openone1', point: 'slades_muster', goods: packs(1), departDay: 1, readyDay: 3, status: 'ready' });
    var trimmed = BR.cleanParcels(many, 50, 30);
    t.equal(trimmed.length, 31);
    t.same([trimmed[0].id, trimmed[2].id], ['closed103', 'openone1'], 'the three oldest closed ones go; the open one stays');
  });

  test('Reset Travel moves every parcel\'s days', function (t) {
    var x = everyState();
    var before = copy(BR.parcels(x.b));
    BR.shiftDays(x.b, -5);
    var fields = ['departDay', 'readyDay', 'arrivedDay', 'collectedDay', 'recalledDay', 'returnDay'];
    BR.parcels(x.b).forEach(function (p, i) {
      fields.forEach(function (k) {
        t.equal(p[k], before[i][k] === null ? null : before[i][k] - 5, p.status + ' ' + k);
      });
    });
    t.equal(x.b.day, 9);
    var road = BR.parcels(x.b)[4];
    t.equal(road.readyDay - x.b.day, before[4].readyDay - 14, 'still due in as many days');
  });

  test('the forecast: when a parcel is due at its town, and when a recalled one is due home; never "arrived" or "collected"', function (t) {
    var x = everyState();
    var lines = news(x.b, 14, 30);
    t.ok(lines.indexOf('24 A parcel from the Ironbow is due at Swyth.') !== -1, lines.join(' | '));
    t.ok(lines.indexOf('16 A recalled parcel is due back at the Ironbow.') !== -1, lines.join(' | '));
    t.equal(lines.filter(function (l) { return /parcel/i.test(l); }).length, 2, 'nothing for waiting or closed parcels');
    t.ok(!lines.some(function (l) { return /arrived|collected/i.test(l); }));
    var sm = bastion(10, 1);
    send(sm);
    t.ok(news(sm, 10, 14).indexOf('12 A parcel from the Ironbow is due at Slade’s Muster.') !== -1);
  });

  /* ---------------------------------------------------------------- */
  group('Courier Exchange: + Add supplies in the Warehouse (DM)');

  test('adds once into the good\'s row, logged, with no gold; only the listed supplies, 1 to 99 at a time', function (t) {
    var b = bastion(10, 0);
    var rows = b.warehouse.length;
    var r = BR.addSupplies(b, bdata, CHART, 3);
    t.same(r, { ok: true, log: ['Warehouse', 'Added by hand (DM): 3 Overland charts.'] });
    t.same([qty(b, CHART), b.warehouse.length, b.treasuryGP], [5, rows, 300], 'merged into the chart row; no gold');
    t.same(BR.addSupplies(b, bdata, PACK, '2').log, ['Warehouse', 'Added by hand (DM): 2 Expedition Provision Packs.']);
    t.equal(qty(reload(b), CHART), 5, 'a reload adds nothing');
    var before = copy(BR.toSave(b));
    [['raw_timber', 1], [CHART, 0], [CHART, 100], [CHART, 2.5], [CHART, 'x'], [CHART, -1], ['nothing', 1]].forEach(function (c) {
      t.equal(BR.addSupplies(b, bdata, c[0], c[1]).ok, false, c.join(' '));
    });
    t.same(copy(BR.toSave(b)), before, 'refusals change nothing');
    t.same(BR.manualAddGoods(bdata), [{ goodId: PACK, name: 'Expedition Provision Pack' }, { goodId: CHART, name: 'Overland chart' }]);
    var bad = withCourier({ manualAdd: ['raw_timber', CHART, CHART, 'nothing'] });
    t.same(BR.manualAddGoods(bad).map(function (g) { return g.goodId; }), [CHART], 'never a trade good, even if listed');
    t.equal(BR.addSupplies(b, bad, 'raw_timber', 1).ok, false);
    var none = BR.defaultState(bdata);
    BR.addSupplies(none, bdata, CHART, 1);
    t.same([none.warehouse.length, none.warehouse[0].goodId, none.warehouse[0].item, none.warehouse[0].qty], [1, CHART, 'Overland chart', 1], 'a new row when there\'s none');
  });

  /* ---------------------------------------------------------------- */
  group('Courier Exchange: the link\'s third kind (shared/js/bridge-rules.js)');

  test('a pickup message: its fixed id, its town\'s Clan, its fields in order; clean() keeps them', function (t) {
    var m = Bg.parcelMessage({ parcel: 'abcdef123', point: 'slades_muster', day: 12, at: 'x', from: { code: 'DM', title: 'Courier post', step: 'pin' }, goods: [{ goodId: PACK, qty: 3 }, { goodId: '', qty: 1 }], text: 'Parcel.' });
    t.same(m, { id: 'abcdef123:collect:0', type: 'parcel_collected', day: 12, at: 'x', from: { code: 'DM', title: 'Courier post', step: 'pin' }, clan: 'slade', point: 'slades_muster', parcel: 'abcdef123', goods: [{ goodId: PACK, qty: 3 }], text: 'Parcel.' });
    t.same(Object.keys(m), Bg.PARCEL_FIELDS);
    t.same(Bg.clean(Object.assign({ extra: 1 }, m)), m);
    t.same([Bg.collectId('abcdef123'), Bg.parcelIdOf('abcdef123:collect:0'), Bg.parcelIdOf('abcdef123:dm:0'), Bg.parcelIdOf(':collect:0')], ['abcdef123:collect:0', 'abcdef123', '', '']);
    t.ok(Bg.TYPES.indexOf('parcel_collected') !== -1);
    t.equal(Bg.waitsForNewer(m), false, 'this copy knows it');
    t.equal(Bg.check(m), '');
  });

  test('statusOf(): read from the message, never the receipt\'s kind (an older Bastion\'s receipt has none)', function (t) {
    var m = Bg.parcelMessage({ parcel: 'abcdef123', point: 'slades_muster', day: 12 });
    var b = { anchored: true, day: 11, bridge: { done: {} } };
    t.same(Bg.statusOf(m, b), { kind: 'waiting', line: 'Waiting for the Bastion to reach Day 12.' });
    b.bridge.done[m.id] = { r: 'applied', day: 12 };
    t.equal(Bg.statusOf(m, b).line, 'Applied on Day 12: the Bastion recorded the parcel at Slade’s Muster as collected.');
    b.bridge.done[m.id] = { r: 'skipped' };
    t.equal(Bg.statusOf(m, b).line, 'Skipped: collected before this Bastion started.');
    b.bridge.done[m.id] = { r: 'refused', why: 'Its id is damaged' };
    t.equal(Bg.statusOf(m, b).line, 'Refused: Its id is damaged. The items stay in the Travel bags; take them out with ✕ if they shouldn\'t be there.');
    var old = { id: m.id, type: 'parcel_collected', day: 12, clan: 'slade', hr: 0 };
    b.bridge.done[m.id] = { r: 'applied', day: 13, hr: 0, was: 0, now: 0 };
    t.equal(Bg.statusOf(old, b).line, 'Applied on Day 13: the Bastion recorded the parcel at Unknown town as collected.', 'never "Honour/Respect was already at +0"');
    t.ok(!/Honour/.test(Bg.statusOf(old, b).line));
  });

  test('parcels() and parcelView(): on the road, due, waiting, returning, collected and back home, in plain words', function (t) {
    var x = everyState();
    var save = copy(BR.toSave(x.b));
    var list = Bg.parcels(save);
    t.same(list.map(function (p) { return p.status; }), ['collected', 'returned', 'ready', 'returning', 'in_transit']);
    var ex = ER.toSave(explorer(14));
    t.same(list.map(function (p) { return Bg.parcelView(p, ex); }), [
      { kind: 'collected', line: 'Collected at Slade’s Muster on Day 12.', goods: '1 Expedition Provision Pack' },
      { kind: 'returned', line: 'Recalled: back at the Ironbow on Day 11.', goods: '1 Expedition Provision Pack' },
      { kind: 'waiting', line: 'Waiting at Slade’s Muster since Day 13: collect it from the town picture at Slade’s Muster.', goods: '2 Expedition Provision Packs' },
      { kind: 'returning', line: 'Recalled: on its way back to the Ironbow (home on Day 16). It can\'t be collected.', goods: '1 Overland chart (3 days of use)' },
      { kind: 'on_road', line: 'On the road: due at Swyth on Day 24.', goods: '1 Expedition Provision Pack' }
    ]);
    t.same(Bg.parcelView(list[4], ER.toSave(explorer(24))), { kind: 'due', line: 'It reached Swyth on Day 24, but the Bastion hasn\'t recorded that yet. Open the Bastion (it catches up to today\'s day), and the parcel can then be collected here.', goods: '1 Expedition Provision Pack' });
    var e = explorer(14);
    t.equal(J.collectParcel(e, list[2].id, 'slades_muster', save, {}).ok, true);
    t.same(Bg.parcelView(list[2], ER.toSave(e)).kind, 'collected', 'collected as soon as the Explorer has sent the pickup, whatever the Bastion says');
    t.same(Bg.parcels(null), []);
    t.same(Bg.parcels({ tradeNetwork: { parcels: [{ id: 'x' }, 'junk', { id: 'abcdefg', point: 'bretan', status: 'ready', goods: 'bad' }] } }).map(function (p) { return [p.id, p.goods]; }), [['abcdefg', []]]);
  });

  test('parcelsShown(): what the Explorer lists: every open parcel, waiting ones first, and closed ones only on their day or the day after', function (t) {
    var x = everyState();
    var save = copy(BR.toSave(x.b));
    function ids(list) { return list.map(function (r) { return r.parcel.id; }); }
    function kinds(list) { return list.map(function (r) { return r.view.kind; }); }
    var day14 = Bg.parcelsShown(save, ER.toSave(explorer(14)));
    t.same(ids(day14), [x.rdy.id, x.road.id, x.back.id], 'collected on Day 12 and home on Day 11: gone by Day 14');
    t.same(kinds(day14), ['waiting', 'on_road', 'returning']);
    t.same(day14[0].view, Bg.parcelView(Bg.parcels(save)[2], ER.toSave(explorer(14))), 'the same words as parcelView');
    t.same(ids(Bg.parcelsShown(save, ER.toSave(explorer(13)))), [x.rdy.id, x.road.id, x.back.id, x.col.id], 'collected yesterday: still shown');
    t.same(ids(Bg.parcelsShown(save, ER.toSave(explorer(12)))), [x.rdy.id, x.road.id, x.back.id, x.col.id, x.ret.id]);
    t.same(ids(Bg.parcelsShown(save, ER.toSave(explorer(13)), 'slades_muster')), [x.rdy.id, x.col.id], 'one town\'s courier post');
    t.same(Bg.parcelsShown(save, ER.toSave(explorer(13)), 'bleakharbour'), []);
    t.same(kinds(Bg.parcelsShown(save, ER.toSave(explorer(24)))), ['waiting', 'due', 'returning'], 'due once the Explorer reaches the day');
    var e = explorer(14);
    t.equal(J.collectParcel(e, x.rdy.id, 'slades_muster', save, {}).ok, true);
    var after = Bg.parcelsShown(save, ER.toSave(e));
    t.same([ids(after), kinds(after)], [[x.road.id, x.back.id, x.rdy.id], ['on_road', 'returning', 'collected']], 'collected in the Explorer: shown as collected before the Bastion knows');
    t.same([Bg.parcelsShown(null, ER.toSave(e)), Bg.parcelsShown(undefined, null)], [[], []]);
  });

  /* ---------------------------------------------------------------- */
  group('Courier Exchange: the Explorer collects a parcel (journey.js)');

  /* A Bastion save with a parcel of 3 packs and 1 chart waiting at Slade’s Muster. */
  function readySave() {
    var b = bastion(10, 1);
    var p = BR.sendParcel(b, bdata, 'slades_muster', [{ goodId: PACK, qty: 3 }, { goodId: CHART, qty: 1 }], dice([0.37])).parcel;
    b.day = 12;
    BR.settleParcels(b, bdata);
    return { b: b, p: p, save: copy(BR.toSave(b)) };
  }

  test('Collect: every item into the Travel bags and one pickup message with the parcel\'s fixed id, together', function (t) {
    var r = readySave();
    var s = explorer(12);
    J.addItem(s, PACK, 1);
    var res = J.collectParcel(s, r.p.id, 'slades_muster', r.save, {});
    t.equal(res.ok, true, res.message);
    t.same([J.itemQty(s, PACK), J.itemQty(s, CHART)], [4, 3], 'packs one by one; a chart is 3 days of use');
    t.equal(s.journey.outbox.length, 1);
    var m = s.journey.outbox[0];
    t.same([m.id, m.type, m.day, m.clan, m.point, m.parcel, m.goods, m.from.title, m.text],
      [r.p.id + ':collect:0', 'parcel_collected', 12, 'slade', 'slades_muster', r.p.id, [{ goodId: PACK, qty: 3 }, { goodId: CHART, qty: 1 }], 'Courier post', 'Parcel collected at Slade’s Muster: 3 Expedition Provision Packs, 1 Overland chart (3 days of use).']);
    t.equal(Bg.check(m), '');
    t.equal(res.id, m.id);
    t.equal(s.journey.log[0], 'Day 12 · Collected the parcel at Slade’s Muster: 3 Expedition Provision Packs, 1 Overland chart (3 days of use). Sent to the Bastion.');
    var back = ER.fromSave(copy(ER.toSave(s)), ED, E);
    t.same(back.journey.outbox, s.journey.outbox, 'the message reloads as it is');
    t.same(back.journey.inventory, s.journey.inventory);
  });

  test('a second Collect is refused, even after a reload, and changes nothing', function (t) {
    var r = readySave();
    var s = explorer(12);
    J.collectParcel(s, r.p.id, 'slades_muster', r.save, {});
    var back = ER.fromSave(copy(ER.toSave(s)), ED, E);
    var before = copy(ER.toSave(back));
    var again = J.collectParcel(back, r.p.id, 'slades_muster', r.save, {});
    t.same([again.ok, again.message], [false, 'This parcel has already been collected (Day 12).']);
    t.same(copy(ER.toSave(back)), before);
  });

  test('refused without changing anything: not saving, no Bastion, wrong town, not arrived, recalled, collected, unknown or too many items', function (t) {
    var r = readySave();
    function refused(save, id, point, opts, re, label, setup) {
      var s = explorer(12);
      if (setup) setup(s);
      var before = copy(ER.toSave(s));
      var res = J.collectParcel(s, id, point, save, opts || {});
      t.equal(res.ok, false, label);
      t.ok(re.test(res.message), label + ': ' + res.message);
      t.same(copy(ER.toSave(s)), before, label + ': nothing changed');
    }
    refused(r.save, r.p.id, 'slades_muster', { memory: true }, /^This browser isn't saving, so the Bastion can't see the pickup/, 'memory only');
    refused(null, r.p.id, 'slades_muster', {}, /^Waiting for the Bastion: it hasn't saved anything yet\.$/, 'no Bastion save');
    var loose = copy(r.save);
    loose.anchored = false;
    refused(loose, r.p.id, 'slades_muster', {}, /^Waiting for the Bastion: open it once/, 'not anchored');
    refused(r.save, 'nonesuch1', 'slades_muster', {}, /^The Bastion has no record of this parcel\.$/, 'unknown parcel');
    refused(r.save, r.p.id, 'bretan', {}, /^This parcel waits at Slade’s Muster, not at Bretan\.$/, 'another town');
    var b = bastion(10, 1);
    var road = send(b).parcel;
    refused(copy(BR.toSave(b)), road.id, 'slades_muster', {}, /^The Bastion hasn't recorded this parcel's arrival yet \(it's due at Slade’s Muster on Day 12\)\.$/, 'on the road, or due');
    var col = copy(r.save);
    col.tradeNetwork.parcels[0].status = 'collected';
    refused(col, r.p.id, 'slades_muster', {}, /already recorded this parcel as collected/, 'collected');
    var odd = copy(r.save);
    odd.tradeNetwork.parcels[0].goods = [{ goodId: PACK, qty: 2 }, { goodId: 'potion_of_healing', qty: 1 }];
    refused(odd, r.p.id, 'slades_muster', {}, /^This copy of the Explorer can't carry potion of healing, so the parcel waits at Slade’s Muster\.$/, 'an unknown kind: nothing added, not even the packs');
    var none = copy(r.save);
    none.tradeNetwork.parcels[0].goods = [{ goodId: PACK, qty: 0 }];
    refused(none, r.p.id, 'slades_muster', {}, /^The Bastion's record of this parcel lists nothing in it\.$/, 'a count of 0 (the link drops it, so the parcel holds nothing)');
    refused(r.save, r.p.id, 'slades_muster', {}, /can't hold that many Overland charts/, 'the bags are full', function (s) {
      s.journey.inventory = [{ id: 'i-x', kind: CHART, qty: 9998 }];
    });
    var bad = copy(r.save);
    bad.tradeNetwork.parcels[0].id = 'Bad Id!';
    refused(bad, 'Bad Id!', 'slades_muster', {}, /record is damaged/, 'a damaged id');
  });

  test('room raised in the data (a review fix): a parcel of 120 packs is sent and collected in full, never stuck at its town', function (t) {
    var levels = copy(CD.levels);
    levels['2'].maxItems = 150;
    var d = withCourier({ levels: levels });
    var b = bastion(10, 2);
    BR.addGoods(b, d, PACK, 114, 'Test');
    var res = BR.sendParcel(b, d, 'slades_muster', packs(120), dice([0.37]));
    t.equal(res.ok, true, res.message);
    b.day = 12;
    BR.settleParcels(b, d);
    var s = explorer(12);
    var got = J.collectParcel(s, res.parcel.id, 'slades_muster', copy(BR.toSave(b)), {});
    t.equal(got.ok, true, got.message);
    t.equal(J.itemQty(s, PACK), 120, 'all 120 in the Travel bags');
    t.equal(ER.toSave(s).journey.outbox.length, 1, 'one pickup message');
  });

  test('the whole way: sent, arrived, collected, recorded; the goods are only ever in one place, whatever is reloaded', function (t) {
    var b = bastion(10, 1);
    var start = qty(b, PACK);
    var p = send(b).parcel;
    var s = explorer(10);
    function total() { return qty(b, PACK) + J.itemQty(s, PACK) + BR.openParcels(b).reduce(function (n, x) { return n + x.goods[0].qty; }, 0); }
    t.equal(total(), start, 'sent');
    t.equal(Bg.parcelView(Bg.parcels(copy(BR.toSave(b)))[0], ER.toSave(s)).kind, 'on_road');
    s.travel.day = 12;
    t.equal(Bg.parcelView(Bg.parcels(copy(BR.toSave(b)))[0], ER.toSave(s)).kind, 'due', 'the Explorer is there first');
    b = reload(b);
    b.day = 12;
    BR.settleParcels(b, bdata);
    t.equal(total(), start, 'arrived');
    t.equal(J.collectParcel(s, p.id, 'slades_muster', copy(BR.toSave(b)), {}).ok, true);
    s = ER.fromSave(copy(ER.toSave(s)), ED, E);
    t.equal(qty(b, PACK) + J.itemQty(s, PACK), start, 'collected: in the bags, and the parcel waits for the Bastion to close it');
    BR.applyInbox(b, bdata, ER.toSave(s), 1000);
    b = reload(b);
    BR.applyInbox(b, bdata, ER.toSave(s), 2000);
    t.same([qty(b, PACK) + J.itemQty(s, PACK), BR.openParcels(b).length, Bg.statusOf(s.journey.outbox[0], copy(BR.toSave(b))).kind], [start, 0, 'applied']);
    J.shiftDays(s, -11);
    t.equal(s.journey.outbox[0].day, 1, 'Reset Travel moves the pickup\'s day with the Explorer');
  });

  /* ---------- More things by parcel (Harry, 20 October 2026) ---------- */
  test('the four herbs and roots go by parcel, one portion each, and the bags know them', function (t) {
    ['restorative_herbs', 'antivenom_roots', 'toxic_blossoms', 'alchemical_flowers'].forEach(function (id) {
      t.equal(BR.courierGoodBlocker(bdata, id), '', id + ' can go');
      t.ok(J.itemInfo(id) && J.itemInfo(id).use === 'dm', id + ' is counted in the bags, the DM handles it');
    });
    var b = bastion(10, 2);
    BR.addGoods(b, bdata, 'restorative_herbs', 4, 'Test');
    var r = BR.sendParcel(b, bdata, 'slades_muster', [{ goodId: 'restorative_herbs', qty: 4 }], dice([0.37]));
    t.equal(r.ok, true, r.message);
    t.equal(BR.goodsQty(b, 'restorative_herbs'), 0, 'deducted once');
    b.day = 12;
    BR.settleParcels(b, bdata);
    var s = explorer(12);
    t.equal(J.collectParcel(s, r.parcel.id, 'slades_muster', copy(BR.toSave(b)), {}).ok, true);
    t.equal(J.itemQty(s, 'restorative_herbs'), 4);
    t.ok(/4 portions of Restorative Herbs/.test(Bg.parcelGoodsText(r.parcel.goods)));
  });

  function typedRow(b, name, qty) {
    var row = { id: 'row' + (b.warehouse.length + 1) + 'abcdef', item: name, qty: qty, gp: '', notes: '' };
    b.warehouse.push(row);
    return row;
  }

  test('a row typed into the Warehouse can go by parcel: deducted once, kept by name, and collected into the bags once', function (t) {
    var b = bastion(10, 2);
    var row = typedRow(b, 'Potion of Healing', 5);
    var id = 'free:' + row.id;
    t.ok(BR.courierStock(b, bdata).some(function (g) { return g.goodId === id && g.have === 5 && g.name === 'Potion of Healing'; }), 'listed with its count');
    var r = BR.sendParcel(b, bdata, 'slades_muster', [{ goodId: id, qty: 3 }], dice([0.37]));
    t.equal(r.ok, true, r.message);
    t.equal(row.qty, 2, 'the row is counted down once');
    t.same(r.parcel.goods, [{ goodId: id, qty: 3, name: 'Potion of Healing' }]);
    t.equal(BR.parcelGoodsText(bdata, r.parcel.goods), '3 × Potion of Healing');
    row.item = 'Renamed later';
    b = reload(b);
    t.same(BR.parcels(b)[0].goods, [{ goodId: id, qty: 3, name: 'Potion of Healing' }], 'the parcel keeps the name it was sent with, through a reload');
    b.day = 12;
    BR.settleParcels(b, bdata);
    var s = explorer(12);
    var p = BR.parcels(b)[0];
    var c = J.collectParcel(s, p.id, 'slades_muster', copy(BR.toSave(b)), {});
    t.equal(c.ok, true, c.message);
    t.equal(J.itemQty(s, id), 3);
    s = ER.fromSave(copy(ER.toSave(s)), ED, E);
    t.equal(J.itemQty(s, id), 3, 'the bags keep the item, and its name, through a reload');
    t.equal(J.itemInfo(id).name, 'Potion of Healing');
    t.equal(J.collectParcel(s, p.id, 'slades_muster', copy(BR.toSave(b)), {}).ok, false, 'a second pickup is refused');
    BR.applyInbox(b, bdata, ER.toSave(s), 1000);
    BR.applyInbox(b, bdata, ER.toSave(s), 2000);
    t.equal(row.qty, 2, 'nothing came back to the Warehouse');
    t.equal(J.itemQty(s, id), 3);
  });

  test('two typed rows with the same name stay apart, and too many is refused', function (t) {
    var b = bastion(10, 2);
    var a = typedRow(b, 'Rope', 2);
    var c = typedRow(b, 'Rope', 4);
    var r = BR.sendParcel(b, bdata, 'slades_muster', [{ goodId: 'free:' + a.id, qty: 1 }, { goodId: 'free:' + c.id, qty: 2 }], dice([0.37]));
    t.equal(r.ok, true, r.message);
    t.same([a.qty, c.qty], [1, 2]);
    var no = BR.sendParcel(b, bdata, 'moorcastle', [{ goodId: 'free:' + a.id, qty: 5 }], dice([0.5]));
    t.equal(no.ok, false);
    t.same([a.qty, b.treasuryGP], [1, 300 - 5], 'a refusal changes nothing');
    t.equal(BR.sendParcel(b, bdata, 'moorcastle', [{ goodId: 'free:nothere', qty: 1 }], dice([0.5])).ok, false, 'a row that isn\'t there');
    t.equal(BR.parcelItems(bdata, r.parcel.goods), 3, 'one item per count');
  });

  test('a recalled typed parcel returns to its own row once, or makes the row again if it was deleted', function (t) {
    var b = bastion(10, 2);
    var row = typedRow(b, 'Letter of Passage', 2);
    var id = 'free:' + row.id;
    var p = BR.sendParcel(b, bdata, 'moorcastle', [{ goodId: id, qty: 2 }], dice([0.37])).parcel;
    b.day = 11;
    t.equal(BR.recallParcel(b, bdata, p.id).ok, true);
    b.warehouse = b.warehouse.filter(function (w) { return w !== row; });
    b.day = 20;
    BR.settleParcels(b, bdata);
    BR.settleParcels(b, bdata);
    var back = b.warehouse.filter(function (w) { return w.id === row.id; });
    t.same(back.map(function (w) { return [w.item, w.qty]; }), [['Letter of Passage', 2]], 'back once, under the same id and name');
    var again = bastion(10, 2);
    var r2 = typedRow(again, 'Map case', 1);
    var p2 = BR.sendParcel(again, bdata, 'moorcastle', [{ goodId: 'free:' + r2.id, qty: 1 }], dice([0.37])).parcel;
    again.day = 11;
    BR.recallParcel(again, bdata, p2.id);
    again.day = 20;
    BR.settleParcels(again, bdata);
    t.equal(r2.qty, 1, 'added back to the row that is still there');
  });

  test('typed rows can be turned off in the data, and are never trade goods or the other kinds', function (t) {
    var d = withCourier({ freeItems: false });
    var b = bastion(10, 2);
    var row = typedRow(b, 'Potion', 1);
    t.same(BR.courierFreeRows(b, d), []);
    t.equal(BR.sendParcel(b, d, 'slades_muster', [{ goodId: 'free:' + row.id, qty: 1 }], dice([0.37])).ok, false);
    BR.addGoods(b, bdata, 'raw_timber', 2, 'Test');
    t.ok(!BR.courierStock(b, bdata).some(function (g) { return g.goodId === 'raw_timber'; }), 'trade goods are not offered');
    t.ok(!BR.courierFreeRows(b, bdata).some(function (g) { return !/^free:/.test(g.goodId); }), 'only typed rows are offered as typed');
  });

}());
