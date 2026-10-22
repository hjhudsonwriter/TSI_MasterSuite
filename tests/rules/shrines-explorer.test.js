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

  test('expeditions remember the day they ended: set on End, cleared on Start, kept through a save', function (t) {
    var s = explorer(4);
    t.equal(J.expedition(s).endedDay, null, 'none yet');
    J.startExpedition(s);
    t.same([J.expedition(s).startedDay, J.expedition(s).endedDay], [4, null], 'under way: no end day');
    s.travel.day = 9;
    J.endExpedition(s);
    t.same(J.expedition(s), { n: 1, active: false, startedDay: 4, endedDay: 9 }, 'ended on Day 9');
    var back = J.clean(copy(s.journey), E);
    t.equal(back.expedition.endedDay, 9, 'it survives saving and loading');
    t.equal(J.clean(copy(back), E).expedition.endedDay, 9, 'and loading twice');
    s.travel.day = 12;
    J.startExpedition(s);
    t.same(J.expedition(s), { n: 2, active: true, startedDay: 12, endedDay: null }, 'the next one clears it');
    s.travel.day = 15;
    J.endExpedition(s);
    t.same([J.expedition(s).n, J.expedition(s).startedDay, J.expedition(s).endedDay], [2, 12, 15]);
    t.same(J.empty().expedition, { v: 2, n: 0, active: false, startedDay: 0, endedDay: null }, 'a new journey starts with none');
    var bad = copy(s.journey);
    bad.expedition.endedDay = 'soon';
    t.equal(J.clean(bad, E).expedition.endedDay, null, 'a damaged value becomes unknown');
  });

  test('an expedition that ended in an older save: the end day is read from the log once, then kept; never invented', function (t) {
    function older() {                                  /* a record as saved before the DM doc overhaul: no v, no end day */
      var s = explorer(4);
      J.startExpedition(s);
      s.travel.day = 9;
      J.endExpedition(s);
      delete s.journey.expedition.endedDay;
      delete s.journey.expedition.v;
      return s;
    }
    var s = older();
    t.equal(J.expedition(s).endedDay, 9, 'found in the "Expedition 1 ended on Day 9." line');
    var loaded = J.clean(copy(older().journey), E);
    t.same([loaded.expedition.v, loaded.expedition.endedDay], [2, 9], 'loading an old save reads it once and keeps it');
    var gone = older();
    gone.journey.log = [];
    t.equal(J.expedition(gone).endedDay, null, 'no log line: unknown, not guessed');
    t.equal(J.clean(copy(gone.journey), E).expedition.endedDay, null);
    var other = older();
    other.journey.expedition.n = 2;                      /* the log only speaks of expedition 1 */
    t.equal(J.expedition(other).endedDay, null, 'a line about another expedition is not used');
    var zero = older();
    zero.journey.expedition.endedDay = 0;                /* an older record's 0 meant "not known" */
    t.equal(J.clean(copy(zero.journey), E).expedition.endedDay, 9, 'so it is looked for in the log');
    t.equal(TSI.campaign.endedDayFromLog(['Day 9 · Expedition 2 ended on Day 9. Earth\'s Endurance expired unused.', 'Day 3 · Expedition 1 ended on Day 3.'], 1), 3, 'the right expedition, with a Great Rite note after it');
    t.equal(TSI.campaign.endedDayFromLog(null, 1), 0);
  });

  test('Reset Travel moves the expedition\'s days with every other day, to 0 and below if need be, and a save keeps them', function (t) {
    /* Started on Day 4, played to Day 10, then Reset Travel (the real rule). */
    var s = explorer(4);
    J.startExpedition(s);
    s.travel.day = 10;
    ER.resetTravel(s);
    t.equal(s.travel.day, 1);
    t.same(J.expedition(s), { n: 1, active: true, startedDay: -5, endedDay: null }, 'Day 4 is now Day -5: 6 days before the new Day 1');
    var back = J.clean(copy(s.journey), E);
    t.same(back.expedition, { v: 2, n: 1, active: true, startedDay: -5, endedDay: null }, 'a day below 0 survives saving and loading');
    t.same(J.clean(copy(back), E).expedition, back.expedition, 'and loading twice');
    var sum = TSI.campaign.summary({ travel: { day: 1 }, tokens: [], journey: back }, null, window.TSI_DATA.regions).expedition;
    t.same(sum, { n: 1, state: 'active', startedDay: -5, endedDay: null, daysRunning: 6 }, 'still 6 days running');

    /* Ended on Day 9, reset on Day 10: ended Day 0. */
    var e = explorer(4);
    J.startExpedition(e);
    e.travel.day = 9;
    J.endExpedition(e);
    e.travel.day = 10;
    ER.resetTravel(e);
    t.same(J.expedition(e), { n: 1, active: false, startedDay: -5, endedDay: 0 }, 'an end day of 0 is a real day');
    var eBack = J.clean(copy(e.journey), E);
    t.same([eBack.expedition.startedDay, eBack.expedition.endedDay], [-5, 0], 'kept through a save');
    t.same(TSI.campaign.summary({ travel: { day: 1 }, tokens: [], journey: eBack }, null, window.TSI_DATA.regions).expedition, { n: 1, state: 'ended', startedDay: -5, endedDay: 0, daysRunning: null });

    /* The next expedition after a reset counts from the new calendar. */
    ER.resetTravel(e);                                    /* already Day 1: nothing moves */
    t.same([J.expedition(e).startedDay, J.expedition(e).endedDay], [-5, 0]);
    e.travel.day = 3;
    J.startExpedition(e);
    t.same(J.expedition(e), { n: 2, active: true, startedDay: 3, endedDay: null });
  });

  test('Reset Travel on an expedition from an older save: the end day found in the log moves with the rest, not left behind', function (t) {
    var s = explorer(4);
    J.startExpedition(s);
    s.travel.day = 9;
    J.endExpedition(s);
    delete s.journey.expedition.endedDay;
    delete s.journey.expedition.v;
    s.travel.day = 10;
    ER.resetTravel(s);                                    /* straight on the older record, before any load */
    t.same(J.expedition(s), { n: 1, active: false, startedDay: -5, endedDay: 0 }, 'Day 9 became Day 0');
    var loaded = J.clean(copy(s.journey), E);
    t.same([loaded.expedition.startedDay, loaded.expedition.endedDay], [-5, 0], 'and a save keeps it');
    /* And the same through a load first, as the Explorer does. */
    var t2 = explorer(4);
    J.startExpedition(t2);
    t2.travel.day = 9;
    J.endExpedition(t2);
    var old = copy(t2.journey);
    delete old.expedition.endedDay;
    delete old.expedition.v;
    t2.journey = J.clean(old, E);
    t2.travel.day = 10;
    ER.resetTravel(t2);
    t.same([J.expedition(t2).startedDay, J.expedition(t2).endedDay], [-5, 0]);
    t.equal(TSI.campaign.summary({ travel: { day: 1 }, tokens: [], journey: t2.journey }, null, window.TSI_DATA.regions).expedition.endedDay, 0, 'the DM doc does not read the stale log line again');
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
