/* The beast capture rules (Harry, 10 November 2026): the Settle check in the Explorer's Grant a creature (a Beast-Catcher's Kit from the
   Travel bags, the tools that suit the beast, the typed Animal Handling total), a Wary beast, the Beast Pen's acclimatise DCs (the Settle DC,
   or 20 for a Wary beast), and the Kit and its ten tools as counted goods: crafted by the Workshop, sent by the Courier, held in the Travel
   bags. The code is tools/explorer/journey.js (J.settleInfo, J.grantCreature), tools/bastion/creature-rules.js and rules.js. */
(function () {
  var BR = TSI.bastion.rules;
  var ER = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var Bg = TSI.bridge;
  var T = window.TSI_DATA;
  var ED = T.explorer;
  var G = T.beastCatcher;
  var KIT = G.kit.id;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var PEN = 'beast_pen';
  var KINDS = ['fellcat', 'dire_wolf', 'buckbear', 'griffin', 'sabrecat', 'wyvern'];

  function dice(list) { var i = 0; return function () { var v = list[i % list.length]; i++; return v; }; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function explorer(day) { var s = ER.defaultState(ED); s.travel.day = day || 5; return s; }
  function bastion(day, built) {
    var b = BR.defaultState(bdata);
    b.day = day || 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 300;
    b.builtExtras = (built || []).map(function (id) { return { facId: id, status: 'built' }; });
    BR.ensureLevels(b, bdata);
    return b;
  }
  /* The bags hold what the test puts in them: { id: count }. */
  function bags(s, list) { Object.keys(list).forEach(function (id) { J.addItem(s, id, list[id]); }); return s; }
  function qty(s, id) { return J.itemQty(s, id); }
  function ids(kind) { return G.loadouts[kind]; }
  function acclimatiseNow(b, msgId, total) {
    var c = BR.creatureById(b, BR.creatureIdFor(msgId));
    c.status = 'housed'; c.home = PEN; c.housedDay = b.day;
    BR.ensureDev(b, c);
    BR.assignHandler(b, bdata, c.id, 'Mira', '');
    return BR.acclimatise(b, bdata, c.id, total, { rand: dice([0.5]) });
  }

  group('Beast capture rules: the Settle check');

  test('each kind\'s Settle DC is its acclimatise DC: 15, or 17 for the griffin and wyvern; a failed Settle means DC 20 (Harry, 10 November 2026)', function (t) {
    t.same(KINDS.map(J.settleBaseDC), [15, 15, 15, 17, 15, 17]);
    t.same(KINDS.map(function (k) { return BR.acclimatiseDC(bdata, k); }), [15, 15, 15, 17, 15, 17], 'the Beast Pen uses the same numbers');
    t.equal(J.waryDC(), 20);
    t.equal(BR.waryDC(bdata), 20);
    t.equal(J.settleKitId(), 'beast_catchers_kit');
    t.equal(G.perItem, 2);
  });

  test('the tools offered are the beast\'s three best-fit ones; each tool in the bags and ticked lowers the DC by 2, so a full kit is DC 9 or 11', function (t) {
    KINDS.forEach(function (k) {
      var s = explorer();
      var all = {}; ids(k).forEach(function (id) { all[id] = 1; });
      all[KIT] = 1;
      bags(s, all);
      var none = J.settleInfo(s, k, []);
      t.same(none.items.map(function (x) { return x.id; }), ids(k), k + ': its three best-fit tools');
      t.same([none.dc, none.counted], [J.settleBaseDC(k), 0], k + ': no tools, the base DC');
      var full = J.settleInfo(s, k, ids(k));
      t.same([full.counted, full.dc], [3, J.settleBaseDC(k) - 6], k + ': three tools, 6 less');
      t.equal(full.dc, k === 'griffin' || k === 'wyvern' ? 11 : 9, k + ': DC 9 or 11 when fully kitted');
      t.equal(J.settleInfo(s, k, [ids(k)[0]]).dc, J.settleBaseDC(k) - 2, k + ': one tool, 2 less');
    });
    var s2 = bags(explorer(), { beast_salve: 1, stillroot_salve: 1 });
    var inf = J.settleInfo(s2, 'fellcat', ['stillroot_salve', 'beast_salve', 'beast_muzzle']);
    t.same([inf.counted, inf.dc], [1, 13], 'a tool not in the bags does not count, and the Beast Salve (not best-fit for any beast) is never offered');
    t.same(inf.items.map(function (x) { return [x.id, x.have, x.picked, x.counts]; }), [['stillroot_salve', 1, true, true], ['scent_lure', 0, false, false], ['beast_muzzle', 0, true, false]]);
    t.equal(J.settleInfo(s2, 'fellcat', ['stillroot_salve', 'stillroot_salve']).counted, 1, 'a tool is counted once');
  });

  test('the typed total: a whole number from 1 to 60; under the DC is Wary, meeting it is settled', function (t) {
    ['', 'x', 0, 61, 12.5, null, undefined, '1e1'].forEach(function (v) { t.equal(J.settleTotal(v), null, JSON.stringify(v)); });
    t.same([J.settleTotal(' 14 '), J.settleTotal(1), J.settleTotal(60)], [14, 1, 60]);
    t.same(J.settleOutcome(15, 14), { total: 14, dc: 15, wary: true });
    t.same(J.settleOutcome(15, 15), { total: 15, dc: 15, wary: false }, 'meeting the DC is a pass');
    t.same(J.settleOutcome(11, 30), { total: 30, dc: 11, wary: false });
    t.equal(J.settleOutcome(15, 'x'), null);
  });

  test('no kit, no grant; every problem is refused before anything changes', function (t) {
    var s = bags(explorer(), { stillroot_salve: 1 });
    var before = JSON.stringify(ER.toSave(s));
    var r = J.grantCreature(s, 'fellcat', { settle: { total: 20, items: [] } });
    t.same([r.ok, /no Beast-Catcher’s Kit in the Travel bags/.test(r.message)], [false, true], 'no kit');
    bags(s, { beast_catchers_kit: 1 });
    before = JSON.stringify(ER.toSave(s));
    t.equal(J.grantCreature(s, 'fellcat', { settle: { items: [] } }).message, 'Type the Animal Handling total for the Settle check: a whole number from 1 to 60.', 'no total');
    t.equal(J.grantCreature(s, 'fellcat', { settle: { total: 'x', items: [] } }).ok, false, 'a total that is not a number');
    t.equal(J.grantCreature(s, 'fellcat', { settle: null }).ok, false, 'no Settle at all');
    t.equal(J.grantCreature(s, 'fellcat', {}).ok, false, 'and none given');
    t.equal(J.grantCreature(s, 'fellcat', { settle: { total: 20, items: ['beast_chain_rig'] } }).message, 'Only the fellcat\'s three best-fit tools can be used for its Settle check.', 'a tool that does not suit the beast');
    t.equal(J.grantCreature(s, 'fellcat', { settle: { total: 20, items: ['scent_lure'] } }).message, 'There is no Scent Lure in the Travel bags.', 'a tool that is not in the bags');
    t.equal(JSON.stringify(ER.toSave(s)), before, 'nothing changed: the bags and the outbox are as they were');
    t.equal(s.journey.outbox.length, 0);
  });

  test('a grant uses up the Kit and the single-use tools that counted; reusable tools stay; the Wary mark follows the total', function (t) {
    var s = bags(explorer(8), { beast_catchers_kit: 2, stillroot_salve: 2, scent_lure: 1, beast_muzzle: 1 });
    var r = J.grantCreature(s, 'fellcat', { name: 'Bramble', settle: { total: 13, items: ['stillroot_salve', 'scent_lure', 'beast_muzzle'] } });
    t.equal(r.ok, true, r.message);
    t.same([r.dc, r.total, r.wary], [9, 13, false], 'DC 15, less 6 for three tools: 13 settles it');
    t.same([qty(s, KIT), qty(s, 'stillroot_salve'), qty(s, 'scent_lure'), qty(s, 'beast_muzzle')], [1, 1, 0, 1], 'the Kit, one Stillroot Salve and the Scent Lure are used up; the Muzzle (reusable) stays');
    t.same(r.used, ['Beast-Catcher’s Kit', 'Stillroot Salve', 'Scent Lure']);
    t.ok(/Settle check: 13 against DC 9 \(15, less 6 for 3 tools\): settled\. Used up: Beast-Catcher’s Kit, Stillroot Salve, Scent Lure\.$/.test(r.line), r.line);
    var m = s.journey.outbox[0];
    t.equal('wary' in m, false, 'a settled beast carries no Wary mark');
    t.equal(Bg.check(m), '');
    var w = J.grantCreature(s, 'fellcat', { name: 'Thorn', settle: { total: 14, items: ['stillroot_salve'] } });
    t.same([w.ok, w.dc, w.wary], [true, 13, false], 'DC 13 with one tool: 14 settles it');
    bags(s, { beast_catchers_kit: 1 });
    var u = J.grantCreature(s, 'fellcat', { name: 'Ash', settle: { total: 12, items: [] } });
    t.same([u.ok, u.dc, u.wary], [true, 15, true], 'no tools: DC 15, and 12 is under it');
    var m2 = s.journey.outbox[s.journey.outbox.length - 1];
    t.same([m2.wary, Bg.check(m2), Bg.clean(m2).wary], [true, '', true], 'the message says Wary');
    t.ok(/it comes Wary, and will need DC 20 to acclimatise\./.test(u.line), u.line);
    t.same(s.journey.log[0].indexOf('Day 8 · Sent to the Bastion: a fellcat (Ash)') === 0, true, 'and it is in the Day Log');
    t.equal(qty(s, KIT), 0, 'every kit is gone');
    t.equal(J.grantCreature(s, 'fellcat', { settle: { total: 20, items: [] } }).ok, false, 'so the next grant is refused');
  });

  group('Beast capture rules: at the Beast Pen');

  test('a Wary beast is held by the Bastion, said so, and acclimatised against DC 20; a settled beast keeps its own DC', function (t) {
    var b = bastion(10, [PEN]);
    var s = bags(explorer(10), { beast_catchers_kit: 2 });
    J.grantCreature(s, 'dire_wolf', { name: 'Ashfang', settle: { total: 10, items: [] } });        /* 10 under DC 15: Wary */
    J.grantCreature(s, 'dire_wolf', { name: 'Fang', settle: { total: 15, items: [] } });           /* settled */
    var msgs = s.journey.outbox;
    var res = BR.applyInbox(b, bdata, { travel: { day: 10 }, journey: { outbox: msgs } }, 1000);
    t.equal(res.creatures.length, 2);
    t.ok(/Ashfang\) \(Wary: it needs DC 20 to acclimatise\) for the Ironbow/.test(res.creatures[0]), res.creatures[0]);
    t.equal(/Wary/.test(res.creatures[1]), false, 'a settled beast is not called Wary');
    var wary = BR.creatureById(b, BR.creatureIdFor(msgs[0].id));
    var fine = BR.creatureById(b, BR.creatureIdFor(msgs[1].id));
    t.same([wary.wary, 'wary' in fine], [true, false]);
    t.same([BR.acclimatiseDC(bdata, 'dire_wolf', wary.wary === true), BR.acclimatiseDC(bdata, 'dire_wolf', fine.wary === true)], [20, 15]);
    var reloaded = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.same([BR.creatureById(reloaded, wary.id).wary, 'wary' in BR.creatureById(reloaded, fine.id)], [true, false], 'the mark survives a save and a load');
    /* The Wary beast fails a 19 and passes a 20; the settled one passes a 15. */
    var w = acclimatiseNow(b, msgs[0].id, 19);
    t.same([w.ok, w.pass, w.dc], [true, false, 20], 'a 19 is not enough for a Wary beast');
    t.ok(/against DC 20\)\./.test(w.log[1]), w.log[1]);
    b.day = 13;
    var w2 = BR.acclimatise(b, bdata, wary.id, 20, { rand: dice([0.5]) });
    t.same([w2.pass, w2.dc], [true, 20], 'a 20 passes');
    var f = acclimatiseNow(b, msgs[1].id, 15);
    t.same([f.pass, f.dc], [true, 15], 'the settled beast passes a 15');
  });

  test('the Beast Pen says what it will ask: Wary, and the DC for each kind', function (t) {
    var b = bastion(10, [PEN]);
    var s = bags(explorer(10), { beast_catchers_kit: 2 });
    J.grantCreature(s, 'griffin', { name: 'Skye', settle: { total: 9, items: [] } });
    J.grantCreature(s, 'griffin', { name: 'Gale', settle: { total: 25, items: [] } });
    BR.applyInbox(b, bdata, { travel: { day: 10 }, journey: { outbox: s.journey.outbox } }, 1000);
    var cs = BR.creatures(b);
    cs.forEach(function (c) { c.status = 'housed'; c.home = PEN; BR.ensureDev(b, c); BR.assignHandler(b, bdata, c.id, 'Mira', ''); });
    t.equal(BR.nextStepLine(b, bdata, cs[0]), 'Ready to acclimatise: Mira rolls Animal Handling against DC 20 (it is Wary).');
    t.equal(BR.nextStepLine(b, bdata, cs[1]), 'Ready to acclimatise: Mira rolls Animal Handling against DC 17.');
    t.equal(BR.acclimatiseDcText(bdata, 'griffin', true), 'DC 20 (Wary)');
    var fac = BR.facility(bdata, PEN);
    var opts = BR.fnOptions(b, bdata, fac, fac.functions[1]).map(function (o) { return o.label; });
    t.ok(/Skye \(Griffin\) · Wary/.test(opts[0]) && !/Wary/.test(opts[1]), opts.join(' | '));
    t.ok(/needs DC 20/.test(BR.acclimatiseNote(bdata)), 'the order\'s own note says so');
  });

  test('beasts granted before this change have no Wary mark, so they acclimatise at 15 or 17', function (t) {
    var b = bastion(10, [PEN]);
    var m = { id: 'old1-0a0b0c0d:dm:0', type: 'creature', day: 5, at: 'x', from: { code: 'DM', title: 'DM award', step: 'dm' }, species: 'wyvern', name: 'Ash', text: 'Wyvern for the Ironbow (Ash).' };
    BR.applyInbox(b, bdata, { travel: { day: 10 }, journey: { outbox: [m] } }, 1000);
    var c = BR.creatures(b)[0];
    t.equal('wary' in c, false);
    t.equal(BR.acclimatiseDC(bdata, c.species, c.wary === true), 17);
  });

  group('Beast capture rules: the Kit and tools as counted goods');

  test('the Kit and the ten tools are goods, Travel-bag items and courier items, with the same name and id everywhere', function (t) {
    var every = [G.kit].concat(G.items);
    t.equal(every.length, 11);
    every.forEach(function (it) {
      var g = BR.good(bdata, it.id);
      t.ok(g && g.kind === 'supply' && g.craft === true, it.id + ' is a supply good the Workshop crafts');
      t.equal(g.name, it.name, it.id + ': the same name as the guide');
      t.ok(T.partyItems[it.id] && T.partyItems[it.id].name === it.name && T.partyItems[it.id].use === 'dm', it.id + ' is a Travel bags item');
      t.equal(BR.courierGoodBlocker(bdata, it.id), '', it.id + ' goes by Courier');
      var inList = Object.keys(T.bastionTools).some(function (tb) { return T.bastionTools[tb].indexOf(it.name) !== -1; });
      t.ok(inList, it.id + ' is on a Workshop list (' + it.name + ')');
      var s = explorer();
      t.ok(J.addItem(s, it.id, 1), 'the DM can add it to the bags');
      t.equal(qty(s, it.id), 1);
    });
    G.items.forEach(function (it) { if (G.loadouts) t.ok(KINDS.some(function (k) { return ids(k).indexOf(it.id) !== -1; }) || it.id === 'beast_salve', it.id + ' is on a loadout (the Beast Salve only heals)'); });
    t.same(G.items.filter(function (i) { return i.single; }).map(function (i) { return i.id; }), ['stillroot_salve', 'dreamroot_salve', 'beast_salve', 'scent_lure'], 'the single-use tools, as the guide says');
  });

  test('a Workshop craft order makes a counted good for these items (and a typed row for everything else); the Courier can then send it', function (t) {
    var b = bastion(10);
    b.facilityLevels.workshop = 5;
    var fac = BR.facility(bdata, 'workshop');
    var craft = BR.fn(fac, 'craft');
    var idx = BR.fnOptions(b, bdata, fac, craft).map(function (o) { return o.label; }).indexOf('Beast-Catcher’s Kit');
    t.ok(idx >= 0, 'the Handyman crafts the Kit');
    var r = BR.issueOrder(b, bdata, 'workshop', 'craft', idx, dice([0.3]));
    t.equal(r.ok, true, r.message);
    var o = b.pendingOrders[b.pendingOrders.length - 1];
    var lines = BR.completeSimpleOrder(b, bdata, o, dice([0.5]));
    BR.removeOrder(b, o.id);
    t.ok(/Crafted: Beast-Catcher’s Kit \(counted in the Warehouse, so it can go by Courier\)\./.test(lines[0][1]), lines[0][1]);
    t.equal(BR.goodsQty(b, KIT), 1, 'one counted Kit in the Warehouse');
    t.equal(b.warehouse.filter(function (w) { return !w.goodId && /Kit/.test(w.item); }).length, 0, 'and no typed row');
    t.ok(BR.courierGoods(bdata).some(function (g) { return g.goodId === KIT; }), 'the Courier offers it');
    var smith = BR.fn(fac, 'craft_smith');
    var li = BR.fnOptions(b, bdata, fac, smith).map(function (x) { return x.label; }).indexOf('Longsword');
    var r2 = BR.issueOrder(b, bdata, 'workshop', 'craft_smith', li, dice([0.3]));
    t.equal(r2.ok, true, r2.message);
    var o2 = b.pendingOrders[b.pendingOrders.length - 1];
    BR.completeSimpleOrder(b, bdata, o2, dice([0.5]));
    t.ok(b.warehouse.some(function (w) { return !w.goodId && w.item === 'Longsword'; }), 'a Longsword is still a typed row');
    t.equal(BR.craftGoodId(bdata, 'Longsword'), '');
    t.equal(BR.craftGoodId(bdata, 'Beast Muzzle'), 'beast_muzzle');
  });

  test('a Kit and tools go from the Warehouse by Courier to a town, are collected into the Travel bags, and then pay for a grant: the whole route', function (t) {
    var b = bastion(10);
    b.builtPlots = [{ facId: 'courier_exchange', status: 'built' }, ''];
    BR.ensureLevels(b, bdata);
    b.facilityLevels.courier_exchange = 1;
    BR.addGoods(b, bdata, KIT, 2, 'Workshop');
    BR.addGoods(b, bdata, 'beast_muzzle', 1, 'Workshop');
    BR.addGoods(b, bdata, 'scent_lure', 1, 'Workshop');
    var sent = BR.sendParcel(b, bdata, 'slades_muster', [{ goodId: KIT, qty: 2 }, { goodId: 'beast_muzzle', qty: 1 }, { goodId: 'scent_lure', qty: 1 }], dice([0.37]));
    t.equal(sent.ok, true, sent.message);
    t.same([BR.goodsQty(b, KIT), BR.goodsQty(b, 'beast_muzzle')], [0, 0], 'they leave the Warehouse');
    t.equal(Bg.parcelGoodsText(sent.parcel.goods), '2 Beast-Catcher’s Kits, 1 Beast Muzzle, 1 Scent Lure', 'named as the bags name them');
    b.day = 12;
    BR.settleParcels(b, bdata);
    var ex = explorer(12);
    var c = J.collectParcel(ex, sent.parcel.id, 'slades_muster', copy(BR.toSave(b)), {});
    t.equal(c.ok, true, c.message);
    t.same([qty(ex, KIT), qty(ex, 'beast_muzzle'), qty(ex, 'scent_lure')], [2, 1, 1], 'collected into the Travel bags');
    var g = J.grantCreature(ex, 'dire_wolf', { name: 'Fang', settle: { total: 11, items: ['scent_lure', 'beast_muzzle'] } });
    t.same([g.ok, g.dc, g.wary], [true, 11, false], 'DC 15, less 4 for two tools: 11 is enough');
    t.same([qty(ex, KIT), qty(ex, 'beast_muzzle'), qty(ex, 'scent_lure')], [1, 1, 0], 'one Kit and the Lure used up; the Muzzle stays for the next hunt');
  });
}());
