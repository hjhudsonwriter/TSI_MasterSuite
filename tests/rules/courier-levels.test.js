/* The Courier Exchange's Levels 3 to 5 (Harry, 10 November 2026): cargo sent home from a town (Level 3), Priority (Level 4) and the
   combined parcel with more places and room (Level 5). Rules: tools/bastion/courier-rules.js, shared/js/bridge-rules.js (cargo_return),
   tools/explorer/journey.js (J.sendCargo). */
(function () {
  var Bg = TSI.bridge;
  var BR = TSI.bastion.rules;
  var ER = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var T = window.TSI_DATA;
  var ED = T.explorer;
  var CD = T.bastionCourier;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier };
  var PACK = 'expedition_provision_pack';
  var CHART = 'overland_chart';

  function dice(list) { var i = 0; return function () { var v = list[i % list.length]; i++; return v; }; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function bastion(day, level) {
    var b = BR.defaultState(bdata);
    b.day = day || 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 300;
    if (level) {
      b.builtPlots = [{ facId: 'courier_exchange', status: 'built' }, ''];
      BR.ensureLevels(b, bdata);
      b.facilityLevels.courier_exchange = level;
    }
    BR.addGoods(b, bdata, PACK, 20, 'Test');
    BR.addGoods(b, bdata, CHART, 10, 'Test');
    return b;
  }
  function explorer(day) { var s = ER.defaultState(ED); s.travel.day = day || 12; return s; }
  function exWith(list, day) { return { travel: { day: day || 12 }, journey: { outbox: list } }; }
  /* The Bastion's save as the Explorer reads it: with its courier desk. */
  function saved(b) { var s = copy(BR.toSave(b)); s.courierDesk = BR.courierDesk(b, bdata); return s; }
  function bags(s, kind, n) { J.addItem(s, kind, n); return s; }
  function wh(b, id) { return BR.goodsQty(b, id); }

  group('Courier Exchange Levels 3 to 5: Priority and the fee rule (Harry, 10 November 2026)');

  test('Priority: half the days rounded up (never under 1), double the fee; a combined fee is the dearer plus half the other', function (t) {
    var p = BR.courierPoint(bdata, 'slades_muster');   /* 2 days, 5 gp */
    var far = BR.courierPoint(bdata, 'bleakharbour');  /* 12 days, 30 gp */
    t.same([BR.pointDays(bdata, p, false), BR.pointFee(bdata, p, false)], [2, 5]);
    t.same([BR.pointDays(bdata, p, true), BR.pointFee(bdata, p, true)], [1, 10]);
    t.same([BR.pointDays(bdata, far, true), BR.pointFee(bdata, far, true)], [6, 60]);
    var odd = { id: 'x', days: 5, feeGP: 7 };
    t.same([BR.pointDays(bdata, odd, true), BR.pointFee(bdata, odd, true)], [3, 14]);
    t.equal(BR.combinedFee(bdata, 5, 30), 30 + 3, 'the dearer, plus half the other (rounded up)');
    t.equal(BR.combinedFee(bdata, 20, 20), 30);
  });

  test('a Priority parcel out: the days and fee are the Priority ones, and only from Level 4', function (t) {
    var b3 = bastion(10, 3);
    t.ok(/Priority needs/.test(BR.parcelProblem(b3, bdata, 'moorcastle', [{ goodId: PACK, qty: 2 }], { priority: true })));
    var b = bastion(10, 4);
    var r = BR.sendParcel(b, bdata, 'moorcastle', [{ goodId: PACK, qty: 2 }], dice([0.37]), null, { priority: true });
    t.equal(r.ok, true);
    t.same([r.parcel.readyDay, r.parcel.feeGP, r.parcel.priority], [12, 20, true], 'moorcastle: 4 days to 2, 10 gp to 20 gp');
    t.equal(b.treasuryGP, 280);
    var plain = bastion(10, 4);
    var r2 = BR.sendParcel(plain, bdata, 'moorcastle', [{ goodId: PACK, qty: 2 }], dice([0.37]));
    t.same([r2.parcel.readyDay, r2.parcel.feeGP, r2.parcel.priority], [14, 10, undefined], 'without the tick, as before');
  });

  group('Courier Exchange Level 3: cargo sent home (Harry, 10 November 2026)');

  test('the Bastion takes cargo once: an inbound parcel, the fee from the treasury, a place used, then the goods in the Warehouse on arrival', function (t) {
    var b = bastion(12, 3);
    var m = Bg.cargoMessage({ id: 'cargo1-0a0b0c0d:return:0', day: 12, at: '2026-11-10T10:00:00.000Z', from: { code: 'DM', title: 'Courier post', step: 'pin' }, point: 'moorcastle', goods: [{ goodId: PACK, qty: 2 }], text: 'Cargo sent home.' });
    t.equal(Bg.check(m), '');
    var r = BR.applyInbox(b, bdata, exWith([m]), 1000);
    t.same([r.parcels.length, r.refused], [1, 0]);
    var p = BR.parcels(b)[0];
    t.same([p.status, p.direction, p.point, p.readyDay, p.feeGP, p.msgId], ['inbound', 'in', 'moorcastle', 16, 10, m.id]);
    t.equal(b.treasuryGP, 290);
    t.equal(wh(b, PACK), 20, 'nothing in the Warehouse yet');
    t.equal(BR.travelGroups(b).length, 1, 'a place is used');
    t.equal(BR.applyInbox(b, bdata, exWith([m]), 2000).changed, false, 'a second look changes nothing');
    t.equal(b.treasuryGP, 290, 'one fee only');
    b.day = 15; BR.settleParcels(b, bdata);
    t.equal(wh(b, PACK), 20, 'not yet');
    b.day = 16; BR.settleParcels(b, bdata);
    t.same([wh(b, PACK), BR.parcels(b)[0].status, BR.parcels(b)[0].arrivedDay], [22, 'delivered', 16]);
    b.day = 17; BR.settleParcels(b, bdata);
    t.equal(wh(b, PACK), 22, 'delivered once');
    t.equal(BR.travelGroups(b).length, 0, 'the place is free again');
  });

  test('Priority cargo home: half the days, double the fee; a damaged message is not taken; the fee never takes the treasury below 0', function (t) {
    var b = bastion(12, 4);
    var m = Bg.cargoMessage({ id: 'cargo2-0a0b0c0d:return:0', day: 12, at: 'x', from: { code: 'DM', title: 'Courier post', step: 'pin' }, point: 'bleakharbour', goods: [{ goodId: CHART, qty: 1 }], priority: true, text: '' });
    b.treasuryGP = 40;
    BR.applyInbox(b, bdata, exWith([m]), 1000);
    var p = BR.parcels(b)[0];
    t.same([p.readyDay, p.feeGP, p.priority], [18, 60, true]);
    t.equal(b.treasuryGP, 0, 'floored at 0');
    t.ok(Bg.check(Object.assign({}, m, { point: 'nowhere' })) !== '');
    t.ok(Bg.check(Object.assign({}, m, { goods: [] })) !== '');
    t.ok(Bg.check(Object.assign({}, m, { id: 'cargo2-0a0b0c0d:dm:0' })) !== '');
  });

  test('a recall can\'t reach cargo coming home; an older Explorer list ignores it; the forecast says it is due', function (t) {
    var b = bastion(12, 3);
    var m = Bg.cargoMessage({ id: 'cargo3-0a0b0c0d:return:0', day: 12, at: 'x', from: { code: 'DM', title: 'Courier post', step: 'pin' }, point: 'slades_muster', goods: [{ goodId: PACK, qty: 1 }], text: '' });
    BR.applyInbox(b, bdata, exWith([m]), 1000);
    var p = BR.parcels(b)[0];
    t.ok(BR.parcelRecallBlocker(b, p, bdata), 'no recall');
    t.same(Bg.parcels(saved(b)), [], 'the Explorer\'s parcel list leaves it out');
    var line = TSI.campaign.bastionComing(saved(b)).filter(function (x) { return x.kind === 'parcel'; }).map(function (x) { return x.day + ' ' + x.line; });
    t.same(line, ['14 Cargo sent home from Slade’s Muster is due at the Ironbow.']);
  });

  group('Courier Exchange Level 3: the Explorer sends cargo (Harry, 10 November 2026)');

  test('the Explorer reads the Bastion\'s courier desk: level, room, places, fees', function (t) {
    var d = BR.courierDesk(bastion(10, 3), bdata);
    t.same([d.built, d.level, d.returns, d.priority, d.onRoad, d.maxItems, d.treasuryGP], [true, 3, true, false, 3, 15, 300]);
    t.same(d.points.moorcastle, { days: 4, feeGP: 10 });
    t.same(BR.courierDesk(bastion(10, 0), bdata).built, false);
  });

  test('J.sendCargo: only whole items of what the courier carries, checked first, then bags and outbox change together', function (t) {
    var ex = explorer(12);
    bags(ex, PACK, 5);
    bags(ex, 'overland_chart', 1);   /* 3 uses: 1 whole item */
    var bs = saved(bastion(12, 3));
    t.same(J.cargoOptions(ex).map(function (o) { return [o.kind, o.items]; }), [[PACK, 5], [CHART, 1]]);
    t.ok(J.cargoProblem(ex, bs, 'moorcastle', [{ kind: PACK, qty: 6 }]) !== '', 'more than the bags hold');
    t.ok(J.cargoProblem(ex, bs, 'moorcastle', []) !== '', 'nothing chosen');
    t.ok(J.cargoProblem(ex, bs, 'moorcastle', [{ kind: PACK, qty: 2 }], { memory: true }) !== '', 'a browser that is not saving');
    t.equal(J.cargoProblem(ex, bs, 'moorcastle', [{ kind: PACK, qty: 2 }]), '');
    var before = copy(ex);
    t.equal(J.sendCargo(ex, bs, 'moorcastle', [{ kind: PACK, qty: 9 }]).ok, false);
    t.same(ex, before, 'a refusal changes nothing');
    var r = J.sendCargo(ex, bs, 'moorcastle', [{ kind: PACK, qty: 2 }, { kind: CHART, qty: 1 }]);
    t.equal(r.ok, true);
    t.same([J.itemQty(ex, PACK), J.itemQty(ex, CHART)], [3, 0], 'the items left the bags (a chart is 3 uses)');
    var m = ex.journey.outbox[ex.journey.outbox.length - 1];
    t.same([m.type, m.point, m.goods, m.priority], ['cargo_return', 'moorcastle', [{ goodId: PACK, qty: 2 }, { goodId: CHART, qty: 1 }], undefined]);
    t.equal(Bg.check(m), '');
    t.same(r.quote, { days: 4, feeGP: 10 });
  });

  test('J.sendCargo: level, places, room, treasury and Priority are all checked against the Bastion\'s save', function (t) {
    var ex = explorer(12);
    bags(ex, PACK, 30);
    var pick = function (n) { return [{ kind: PACK, qty: n }]; };
    t.ok(/Level 3/.test(J.cargoProblem(ex, saved(bastion(12, 2)), 'moorcastle', pick(1))), 'Level 2 can\'t');
    t.ok(/isn.t built/.test(J.cargoProblem(ex, saved(bastion(12, 0)), 'moorcastle', pick(1))));
    t.ok(/Level 4/.test(J.cargoProblem(ex, saved(bastion(12, 3)), 'moorcastle', pick(1), { priority: true })));
    t.equal(J.cargoProblem(ex, saved(bastion(12, 4)), 'moorcastle', pick(1), { priority: true }), '');
    t.ok(/holds up to 15/.test(J.cargoProblem(ex, saved(bastion(12, 3)), 'moorcastle', pick(16))));
    t.equal(J.cargoProblem(ex, saved(bastion(12, 3)), 'moorcastle', pick(15)), '');
    t.equal(J.cargoProblem(ex, saved(bastion(12, 5)), 'moorcastle', pick(30)), '', 'Level 5: 30 items');
    var poor = bastion(12, 3); poor.treasuryGP = 5;
    t.ok(/treasury/.test(J.cargoProblem(ex, saved(poor), 'moorcastle', pick(1))));
    var busy = bastion(12, 3);
    BR.sendParcel(busy, bdata, 'moorcastle', [{ goodId: PACK, qty: 1 }], dice([0.11]));
    BR.sendParcel(busy, bdata, 'moorcastle', [{ goodId: PACK, qty: 1 }], dice([0.22]));
    BR.sendParcel(busy, bdata, 'moorcastle', [{ goodId: PACK, qty: 1 }], dice([0.33]));
    t.ok(/travelling places are taken/.test(J.cargoProblem(ex, saved(busy), 'moorcastle', pick(1))), 'three places taken at Level 3');
    var oldSave = copy(BR.toSave(bastion(12, 3)));
    t.ok(/hasn.t saved its Courier Exchange/.test(J.cargoProblem(ex, oldSave, 'moorcastle', pick(1))), 'an older Bastion save without a desk');
  });

  test('end to end: the Explorer sends, the Bastion takes it once and the goods arrive in the Warehouse', function (t) {
    var ex = explorer(12);
    bags(ex, PACK, 4);
    var b = bastion(12, 4);
    var r = J.sendCargo(ex, saved(b), 'slades_muster', [{ kind: PACK, qty: 4 }], { priority: true });
    t.equal(r.ok, true);
    BR.applyInbox(b, bdata, ex.journey.outbox ? { travel: ex.travel, journey: { outbox: ex.journey.outbox } } : null, 1000);
    var p = BR.parcels(b)[0];
    t.same([p.status, p.readyDay, p.feeGP, p.priority], ['inbound', 13, 10, true]);
    b.day = 13; BR.settleParcels(b, bdata);
    t.equal(wh(b, PACK), 24);
    var status = Bg.statusOf(ex.journey.outbox[0], copy(BR.toSave(b)));
    t.equal(status.kind, 'applied');
    t.ok(/Delivered/.test(status.line), status.line);
  });

  group('Courier Exchange Level 5: the combined parcel (Harry, 10 November 2026)');

  var LEGS = [{ point: 'slades_muster', picks: [{ goodId: PACK, qty: 3 }] }, { point: 'bleakharbour', picks: [{ goodId: CHART, qty: 2 }] }];

  test('one parcel, two towns: each leg on its own days, one place, one fee, from Level 5 only', function (t) {
    t.ok(/Express Cargo Exchange/.test(BR.combinedProblem(bastion(10, 4), bdata, LEGS)), 'not at Level 4');
    var b = bastion(10, 5);
    t.equal(BR.combinedProblem(b, bdata, LEGS), '');
    var r = BR.sendCombined(b, bdata, LEGS, dice([0.37]));
    t.equal(r.ok, true);
    t.same(r.parcels.map(function (p) { return [p.point, p.readyDay, p.feeGP]; }), [['slades_muster', 12, 33], ['bleakharbour', 22, 0]], 'fee: 30 for the dearer + 3 (half of 5, rounded up)');
    t.equal(b.treasuryGP, 267);
    t.same([wh(b, PACK), wh(b, CHART)], [17, 8]);
    t.equal(r.parcels[0].combo, r.parcels[1].combo);
    t.equal(BR.travelGroups(b).length, 1, 'one place');
    b.day = 12; BR.settleParcels(b, bdata);
    t.equal(BR.travelGroups(b).length, 1, 'the place is held until the second leg arrives');
    t.same(BR.parcels(b).map(function (p) { return p.status; }), ['ready', 'in_transit']);
    b.day = 22; BR.settleParcels(b, bdata);
    t.equal(BR.travelGroups(b).length, 0);
  });

  test('a combined parcel shares the level\'s room, needs two different towns and something for each', function (t) {
    var b = bastion(10, 5);
    t.ok(/two different towns/.test(BR.combinedProblem(b, bdata, [LEGS[0], { point: 'slades_muster', picks: [{ goodId: CHART, qty: 1 }] }])));
    t.ok(/at least 1 item/.test(BR.combinedProblem(b, bdata, [LEGS[0], { point: 'moorcastle', picks: [] }])));
    t.ok(/holds up to 30/.test(BR.combinedProblem(b, bdata, [{ point: 'slades_muster', picks: [{ goodId: PACK, qty: 20 }] }, { point: 'moorcastle', picks: [{ goodId: CHART, qty: 11 }] }])));
    t.ok(BR.combinedProblem(b, bdata, [{ point: 'slades_muster', picks: [{ goodId: PACK, qty: 15 }] }, { point: 'moorcastle', picks: [{ goodId: PACK, qty: 10 }] }]) !== '', 'the Warehouse has only 20 packs');
  });

  test('Level 5 carries four parcels at once; a combined one counts as one', function (t) {
    var b = bastion(10, 5);
    BR.sendCombined(b, bdata, LEGS, dice([0.11]));
    ['moorcastle', 'bretan', 'middlemount'].forEach(function (pt, i) { BR.sendParcel(b, bdata, pt, [{ goodId: PACK, qty: 1 }], dice([0.2 + i / 10])); });
    t.equal(BR.travelGroups(b).length, 4);
    t.ok(/travelling places are taken/.test(BR.parcelProblem(b, bdata, 'moorcastle', [{ goodId: PACK, qty: 1 }])));
    t.ok(BR.parcelBlocker(b, bdata));
  });

  test('a combined parcel and cargo home survive a reload', function (t) {
    var b = bastion(10, 5);
    BR.sendCombined(b, bdata, LEGS, dice([0.37]), null, { priority: true });
    var back = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.same(BR.parcels(back).map(function (p) { return [p.combo !== undefined, p.priority]; }), [[true, true], [true, true]]);
    var m = Bg.cargoMessage({ id: 'cargo5-0a0b0c0d:return:0', day: 10, at: 'x', from: { code: 'DM', title: 'Courier post', step: 'pin' }, point: 'moorcastle', goods: [{ goodId: PACK, qty: 1 }], text: '' });
    BR.applyInbox(back, bdata, exWith([m], 10), 1000);
    var again = BR.fromSave(copy(BR.toSave(back)), bdata);
    t.same(BR.parcels(again).filter(function (p) { return p.status === 'inbound'; }).map(function (p) { return p.msgId; }), [m.id]);
    t.equal(BR.applyInbox(again, bdata, exWith([m], 10), 2000).changed, false);
  });

}());
