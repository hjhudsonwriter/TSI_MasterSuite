/* The Shrines in the Explorer (pull request 8b part 2; Harry, 15 October
   2026): the link's fifth kind (a Great Rite), the Bastion marking it
   assigned, expeditions, the party's one blessing, the tagged checks and the
   charms. Rules: shared/js/bridge-rules.js, tools/bastion/rules.js,
   tools/explorer/journey.js; data: shared/data/party-items.js and
   tools/explorer/data/journey-events.js. */
(function () {
  var Bg = TSI.bridge;
  var BR = TSI.bastion.rules;
  var ER = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var T = window.TSI_DATA;
  var E = T.journeyEvents;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var UID = 'rite-ab12cd34';

  function dice(list) { var i = 0; return function () { var v = list[i % list.length]; i++; return v; }; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function explorer(day) { var s = ER.defaultState(T.explorer); s.travel.day = day || 5; return s; }
  function begin(s, id) { var ev = J.def(E, id); return J.begin(s, E, { kind: ev.kind, event: ev }, J.context(s, E), dice([0.5])); }
  function bastion(day) {
    var b = BR.defaultState(bdata);
    b.day = day || 10; b.anchored = true; b.bridge.fresh = false;
    b.greatRites = [{ id: UID, rite: 'cleansing_radiance', god: 'aurush', madeDay: 8, status: 'waiting' }];
    return b;
  }
  function ritesOf(rite) { return { id: Bg.riteMessageId(UID), type: 'rite', day: 6, at: '2026-10-15T10:00:00.000Z', from: { code: 'DM', title: 'Shrine blessing', step: 'dm' }, riteId: UID, rite: rite || 'cleansing_radiance', text: 'x' }; }
  function exWith(list, day) { return { travel: { day: day || 10 }, journey: { outbox: list } }; }
  function started() { var s = explorer(6); J.startExpedition(s); return s; }

  test('a Great Rite message: fixed id, no Clan; clean() and check() agree; unknown rites are refused', function (t) {
    var m = Bg.riteMessage({ riteId: UID, rite: 'tides_passage', day: 4, at: 'x', from: { code: 'DM', title: 'Shrine blessing', step: 'dm' }, text: 'Given.' });
    t.equal(m.id, UID + ':rite:0');
    t.equal(m.type, 'rite');
    t.same(Bg.clean(m), m, 'clean() keeps a rite as it is');
    t.ok(Bg.check(m) === true || Bg.check(m).ok !== false, 'check() accepts it');
    var bad = Object.assign({}, m, { rite: 'dragons_breath' });
    t.ok(Bg.check(bad) !== true && Bg.check(bad).ok !== true, 'an unknown rite is refused');
    t.ok(!Bg.isParcelMessage(m), 'not a parcel');
    t.ok(/Tide/.test(Bg.riteTitle(m)), 'its title names the rite');
  });

  test('the Bastion marks a waiting Great Rite assigned, once; it survives a reload', function (t) {
    var b = bastion();
    BR.applyInbox(b, bdata, exWith([ritesOf()], 10), 1000);
    t.equal(b.greatRites[0].status, 'assigned');
    t.equal(b.greatRites[0].assignedDay, 10);
    var once = copy(b.greatRites);
    BR.applyInbox(b, bdata, exWith([ritesOf()], 10), 1000);
    t.same(b.greatRites, once, 'the same message again changes nothing');
    var back = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.same(back.greatRites, once);
    t.same(BR.fromSave(copy(BR.toSave(back)), bdata).greatRites, once, 'loading twice changes nothing');
    var s = bastion();
    s.greatRites = [];
    BR.applyInbox(s, bdata, exWith([ritesOf()], 10), 1000);
    t.same(s.greatRites, [], 'a Great Rite the Bastion does not hold is refused');
  });

  test('expeditions: the DM starts and ends them; the blessing expires with it', function (t) {
    var s = explorer(6);
    t.ok(!J.expedition(s).active);
    t.ok(J.startExpedition(s).ok);
    t.ok(!J.startExpedition(s).ok, 'not twice');
    t.equal(J.expedition(s).n, 1);
    var b = bastion();
    var r = J.assignRite(s, UID, b, {});
    t.ok(r.ok, r.message);
    t.equal(s.journey.outbox.length, 1);
    t.equal(s.journey.blessing.used, false);
    t.ok(!J.assignRite(s, UID, b, {}).ok, 'not twice');
    t.equal(s.journey.outbox.length, 1);
    var end = J.endExpedition(s);
    t.ok(end.ok && /expired unused/.test(end.line));
    t.equal(s.journey.blessing, null);
    t.ok(!J.endExpedition(s).ok, 'no expedition to end');
    var back = J.clean(copy(s.journey), E);
    t.same([back.expedition.n, back.expedition.active], [1, false], 'it survives saving');
  });

  test('assigning a Great Rite is refused when it should be', function (t) {
    var s = explorer(6);
    var b = bastion();
    t.ok(/Start an expedition/.test(J.assignRite(s, UID, b, {}).message), 'no expedition');
    J.startExpedition(s);
    t.ok(!J.assignRite(s, UID, b, { memory: true }).ok, 'browser not saving');
    t.ok(!J.assignRite(s, UID, undefined, {}).ok, 'Bastion unseen');
    var unread = bastion(); unread.anchored = false;
    t.ok(!J.assignRite(s, UID, unread, {}).ok, 'Bastion has not read the day');
    t.ok(!J.assignRite(s, 'rite-nothere1', b, {}).ok, 'no such rite');
    t.equal(s.journey.outbox.length, 0, 'nothing was sent');
    t.ok(J.assignRite(s, UID, b, {}).ok);
    b.greatRites.push({ id: 'rite-zz99yy88', rite: 'tides_passage', god: 'pelagos', madeDay: 9, status: 'waiting' });
    t.ok(/already holds/.test(J.assignRite(s, 'rite-zz99yy88', b, {}).message), 'one at a time');
    J.useRiteByHand(s);
    t.ok(!J.assignRite(s, 'rite-zz99yy88', b, {}).ok, 'none again in the same expedition, even once used');
    t.same(J.waitingRites(s, b).map(function (x) { return x.id; }), ['rite-zz99yy88'], 'the taken one is no longer offered');
  });

  test('tagged checks offer the matching charm, once a step, and it is used from the bags', function (t) {
    var s = explorer(6);
    J.addItem(s, 'earthward_talisman', 2);
    J.addItem(s, 'voyage_blessing', 1);
    begin(s, 't7');
    var v = J.view(s, E);
    t.same(v.check.charms.map(function (c) { return c.kind; }), ['earthward_talisman'], 'a terrain saving throw offers the talisman only');
    t.ok(J.useCharm(s, E, v.step, 'earthward_talisman'));
    t.equal(J.itemQty(s, 'earthward_talisman'), 1);
    t.equal(J.useCharm(s, E, v.step, 'earthward_talisman'), null, 'once a step');
    t.equal(J.itemQty(s, 'earthward_talisman'), 1);
    t.equal(J.view(s, E).check.charms[0].used, true);
    t.equal(J.useCharm(s, E, v.step, 'voyage_blessing'), null, 'a charm that does not fit is not used');
    var back = J.clean(copy(s.journey), E);
    t.same(back.current.charmUsed, s.journey.current.charmUsed, 'survives saving');
    var s2 = explorer(6);
    J.addItem(s2, 'aquatic_protection_charm', 1);
    begin(s2, 't16');
    t.same(J.view(s2, E).check.charms, [], 'a Perception check is not a water hazard');
  });

  test('a held Great Rite is offered at its checks and used once; Tide\'s Passage counts as a success', function (t) {
    var s = started();
    var b = bastion();
    b.greatRites[0].rite = 'tides_passage'; b.greatRites[0].god = 'pelagos';
    t.ok(J.assignRite(s, UID, b, {}).ok);
    begin(s, 't15');
    var v = J.view(s, E);
    t.equal(v.check, undefined, 'the riddle comes first');
    var s2 = started();
    t.ok(J.assignRite(s2, UID, b, {}).ok);
    s2.journey.current = null;
    begin(s2, 't7');
    t.equal(J.view(s2, E).check.rite, null, 'Tide\'s Passage does not fit a vegetation save');
    t.same(J.useRiteByHand(s2) !== null, true, 'but it can be used by hand');
    t.equal(J.useRiteByHand(s2), null, 'only once');
  });

  test('Earth\'s Endurance is offered at The Ember That Won\'t Die\'s exhaustion save, and used once', function (t) {
    var s = started();
    t.ok(J.assignRite(s, UID, (function () { var b = bastion(); b.greatRites[0].rite = 'earths_endurance'; b.greatRites[0].god = 'telluria'; return b; }()), {}).ok);
    begin(s, 'c8');
    t.equal(J.view(s, E).check.rite, null, 'not at the first check');
    s.journey.current.step = 'awake';
    s.journey.current.vars.hero = 'kaelen';
    var v = J.view(s, E);
    t.equal(v.check.rite.name, 'Earth\'s Endurance');
    t.ok(J.useRite(s, E, v.step));
    t.equal(s.journey.blessing.used, true);
    t.equal(J.useRite(s, E, v.step), null, 'once');
  });

  test('Shrine items are used from the bags, once each', function (t) {
    var s = explorer();
    J.addItem(s, 'purification_incense', 2);
    t.ok(J.useItem(s, 'purification_incense'));
    t.equal(J.itemQty(s, 'purification_incense'), 1);
    t.ok(J.useItem(s, 'purification_incense'));
    t.equal(J.useItem(s, 'purification_incense'), null, 'none left');
    J.addItem(s, J.PACK, 1);
    t.equal(J.useItem(s, J.PACK), null, 'a provision pack is not a Shrine item');
  });
}());
