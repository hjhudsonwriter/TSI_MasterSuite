/* Scarlett Isles: Beast Handler — the Bastion checks and applies each request once (BH-2b and BH-3a,
   tools/beasthandler/bastion-link.js), with Harry's decisions of 21 October 2026. */
(function () {
  var BR = TSI.bastion.rules;
  var P = TSI.beasthandler.projection;
  var C = TSI.beasthandler.codes;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };

  var seed = 0;
  function rnd() { seed += 0.0137; return seed % 1 || 0.5; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function last(b) { return b.pendingOrders[b.pendingOrders.length - 1]; }
  function complete(b, o) { var l = BR.completeSimpleOrder(b, bdata, o, rnd); BR.removeOrder(b, o.id); return l; }
  var grantN = 100;
  var NOW = 1760000000000;
  var cmdN = 0;

  function world(levels) {
    var lv = levels || {};
    var b = BR.defaultState(bdata);
    b.day = 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 400;
    b.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }, { facId: 'griffin_tower', status: 'built' }, { facId: 'dire_wolf_den', status: 'built' }];
    BR.ensureLevels(b, bdata);
    b.facilityLevels.wyvern_roost = lv.roost || 3;
    b.facilityLevels.griffin_tower = lv.tower || 2;
    b.facilityLevels.dire_wolf_den = lv.den || 2;
    BR.beastState(b);
    return b;
  }
  function grant(b, species, name) {
    grantN++;
    var gid = 'lk' + grantN + '-0a0b0c0d:dm:0';
    BR.applyInbox(b, bdata, { travel: { day: b.day }, journey: { outbox: [{ id: gid, type: 'creature', day: b.day, at: '2026-10-21T10:00:00.000Z', from: { code: 'DM', title: 'DM', step: 'dm' }, species: species, name: name, text: 'Granted' }] } }, 1000);
    return BR.creatureById(b, BR.creatureIdFor(gid));
  }
  var HOUSE = { wyvern: ['wyvern_roost', 'house_wyvern'], griffin: ['griffin_tower', 'house_griffin'], dire_wolf: ['dire_wolf_den', 'house_dire_wolf'] };
  function housed(b, species, name, handler) {
    var c = grant(b, species, name);
    var h = HOUSE[species];
    var idx = 0;
    BR.housingOptions(b, bdata, species).forEach(function (o, i) { if (o.creatureId === c.id) idx = i; });
    var r = BR.issueOrder(b, bdata, h[0], h[1], idx, rnd);
    if (!r.ok) throw new Error(r.message);
    complete(b, last(b));
    if (handler) BR.assignHandler(b, bdata, c.id, handler, '');
    return c;
  }
  function cmd(b, c, type, payload, extra) {
    cmdN++;
    return Object.assign({ v: 1, id: 'cmd-' + cmdN + '-abcdef12', campaign: BR.beastState(b).campaignId, handler: 'mira', creature: c.id, type: type, view: '', payload: payload, at: NOW }, extra || {});
  }
  function apply(b, cm, auth) { return BR.beastProcess(b, bdata, cm, auth || { via: 'local' }, NOW + 1000, rnd); }
  function snapOf(b, who) { return P.build(b, bdata, who); }

  group('Beast Handler: the Bastion applies each request once (BH-2b, 21 October 2026)');

  test('the Bastion makes its own campaign id once, keeps it through saving, and reading never makes one', function (t) {
    var b = BR.defaultState(bdata);
    t.equal(BR.beastCampaignId(b), '');
    t.equal(snapOf(b, '').campaign, '');
    var id = BR.beastState(b).campaignId;
    t.ok(/^[A-Za-z2-9]{16}$/.test(id));
    t.equal(BR.beastState(b).campaignId, id);
    var again = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.equal(again.beast.campaignId, id);
    t.equal(snapOf(again, '').campaign, id);
    t.equal(BR.fromSave(copy(BR.toSave(BR.defaultState(bdata))), bdata).beast, undefined, 'a Bastion that never used it gains nothing');
  });

  test('a profile change is applied once: the lines change, the Day Log and a change note say so, the Chronicle, bond and stats do not move', function (t) {
    var b = world();
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var chronBefore = JSON.stringify(c.development.chronicle);
    var bondBefore = JSON.stringify(c.development.bond);
    var warBefore = JSON.stringify(BR.creatureWar(bdata, c));
    var logBefore = b.log.length;
    var r = apply(b, cmd(b, c, 'profile.set', { dominant: 'Watchful', attachment: 'Lowers its head', trigger: 'Loud metallic ringing', regional: 'Widowspine' }));
    t.equal(r.ok, true, JSON.stringify(r));
    t.same([c.development.temperament.dominant, c.development.temperament.attachment, c.development.temperament.trigger, c.development.regional], ['Watchful', 'Lowers its head', 'Loud metallic ringing', 'Widowspine']);
    t.equal(JSON.stringify(c.development.chronicle), chronBefore, 'the Chronicle is untouched');
    t.equal(JSON.stringify(c.development.bond), bondBefore, 'the bond is untouched');
    t.equal(JSON.stringify(BR.creatureWar(bdata, c)), warBefore, 'the stats are untouched');
    t.equal(b.log.length, logBefore + 1);
    t.ok(/Stormwing's profile was changed by Mira: Dominant Temperament \(blank\) → "Watchful"/.test(b.log[0].body), JSON.stringify(b.log[0]));
    t.equal(c.development.profileLog.length, 1);
    t.same(c.development.profileLog[0].change.dominant, { from: '', to: 'Watchful' });
    t.equal(r.receipt.r, 'applied');
  });

  test('the same request twice (a retry, a refresh, a reconnect) does nothing the second time', function (t) {
    var b = world();
    var c = housed(b, 'griffin', 'Swiftwing', 'Mira');
    var cm = cmd(b, c, 'profile.set', { dominant: 'Proud' });
    t.equal(apply(b, cm).ok, true);
    var logLen = b.log.length;
    var snap = JSON.stringify(b);
    var second = apply(b, cm);
    t.same([second.ok, second.duplicate], [false, true]);
    t.equal(JSON.stringify(b), snap, 'nothing changed at all');
    t.equal(b.log.length, logLen);
    var again = BR.fromSave(copy(BR.toSave(b)), bdata);
    var third = BR.beastProcess(again, bdata, cm, { via: 'local' }, NOW + 5000, rnd);
    t.equal(third.duplicate, true, 'even after the Bastion is saved and reopened');
    var q = BR.beastProcessQueue(again, bdata, [cm, cm, cm], NOW + 5000, rnd);
    t.same([q.changed, q.applied, q.refused], [false, 0, 0]);
  });

  test('an order request makes exactly one order: free, with its ready day, and nothing from the treasury', function (t) {
    var b = world({ roost: 3 });
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var gold = b.treasuryGP;
    var r = apply(b, cmd(b, c, 'order.request', { fnId: 'wyr_safe_acclimatisation' }, { fac: 'wyvern_roost' }));
    t.equal(r.ok, true, JSON.stringify(r));
    t.equal(BR.trainingOrders(b).length, 1);
    var o = last(b);
    t.same([o.fnId, o.chosen.trainCreatureId, o.costGP, b.treasuryGP], ['wyr_safe_acclimatisation', c.id, 0, gold]);
    t.same([r.receipt.orderId, r.receipt.dueDay, r.receipt.type], [o.id, o.dueDay, 'order.request']);
    t.ok(/Asked for by Mira \(Beast Handler\)/.test(b.log[0].body), JSON.stringify(b.log[0]));
    t.equal(apply(b, cmd(b, c, 'order.request', { fnId: 'wyr_safe_acclimatisation' })).ok, false, 'a second, different request is refused: the building is busy');
    t.equal(BR.trainingOrders(b).length, 1);
  });

  test('the Bastion runs the order by its own rules: it completes on its due day and the next bond milestone is READY (never given)', function (t) {
    var b = world({ roost: 3 });
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    apply(b, cmd(b, c, 'order.request', { fnId: 'wyr_safe_acclimatisation' }));
    var o = last(b);
    b.day = o.dueDay;
    complete(b, o);
    t.same([c.development.bond.level, c.development.bond.ready], [0, 1]);
    var s = snapOf(b, 'Mira');
    t.equal(s.receipts[0].state, 'completed');
    t.equal(s.receipts[0].label, 'Stormwing: Safe Acclimatisation');
  });

  test('the receipt says "scheduled" while the order is pending, then "completed"', function (t) {
    var b = world({ roost: 3 });
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var r = apply(b, cmd(b, c, 'order.request', { fnId: 'wyr_safe_acclimatisation' }));
    var s = snapOf(b, 'Mira');
    t.same([s.receipts[0].state, s.receipts[0].dueDay], ['scheduled', r.receipt.dueDay]);
    BR.removeOrder(b, last(b).id);
    t.equal(snapOf(b, 'Mira').receipts[0].state, 'completed');
  });

  test('the whole-building lock: anything pending at the building refuses the request, with the order and its day', function (t) {
    var b = world({ roost: 3 });
    var e = housed(b, 'wyvern', 'Elarion', 'Joss');
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    BR.issueOrder(b, bdata, 'wyvern_roost', 'wyr_safe_acclimatisation', 0, rnd);
    var r = apply(b, cmd(b, c, 'order.request', { fnId: 'wyr_safe_acclimatisation' }));
    t.equal(r.ok, false);
    t.ok(/The Wyvern Roost is busy: Wyvern Roost: Safe Acclimatisation \(Elarion\), ready on Day \d+/.test(r.receipt.why), r.receipt.why);
    t.equal(BR.trainingOrders(b).length, 1);
    t.ok(e);
  });

  test('a pending order at another building never blocks this one', function (t) {
    var b = world({ roost: 3, tower: 2 });
    var w = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var g = housed(b, 'griffin', 'Swiftwing', 'Joss');
    BR.issueOrder(b, bdata, 'griffin_tower', 'grf_safe_acclimatisation', 0, rnd);
    b.pendingOrders.push({ id: 'lib1', facId: 'library_scriptorium', fnId: 'research', chosen: null, optionLabel: '', notes: '', label: 'Library: Research', costGP: 0, issuedDay: 10, dueDay: 14 });
    t.equal(apply(b, cmd(b, w, 'order.request', { fnId: 'wyr_safe_acclimatisation' })).ok, true);
    t.ok(g);
  });

  test('the DM\'s own training places are untouched: the DM can still start a second programme after a player\'s', function (t) {
    var b = world({ roost: 3 });
    var e = housed(b, 'wyvern', 'Elarion', 'Joss');
    var w = housed(b, 'wyvern', 'Stormwing', 'Mira');
    BR.ensureDev(b, e).bond.level = 1;
    apply(b, cmd(b, w, 'order.request', { fnId: 'wyr_safe_acclimatisation' }));
    var second = BR.issueOrder(b, bdata, 'wyvern_roost', 'wyr_keeper_routine', 0, rnd);
    t.equal(second.ok, true, second.message);
    t.equal(BR.trainingOrders(b).length, 2);
  });

  test('only free training: the 150 gp harness, House orders and anything else are refused even with gold and the right bond', function (t) {
    var b = world({ roost: 5 });
    b.treasuryGP = 5000;
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    BR.ensureDev(b, c).bond.level = 4;
    var gold = b.treasuryGP;
    ['wyr_riding_harness', 'house_wyvern', 'house_elara_wyvern', 'not_a_real_order', ''].forEach(function (fnId) {
      var r = apply(b, cmd(b, c, 'order.request', { fnId: fnId }));
      t.equal(r.ok, false, fnId);
      t.ok(/isn't an order a handler can ask for/.test(r.receipt.why), fnId + ': ' + r.receipt.why);
    });
    t.same([b.treasuryGP, BR.trainingOrders(b).length], [gold, 0]);
  });

  test('a request is refused, with a plain reason, when what the player saw has changed', function (t) {
    var b = world({ roost: 3 });
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    /* the DM gave the beast to someone else */
    var cm1 = cmd(b, c, 'profile.set', { dominant: 'Proud' });
    BR.assignHandler(b, bdata, c.id, 'Joss', 'Mira left the party');
    var r1 = apply(b, cm1);
    t.equal(r1.ok, false);
    t.ok(/isn't yours any more: the DM has given it another handler/.test(r1.receipt.why), r1.receipt.why);
    t.equal(c.development.temperament.dominant, '');
    /* the building was lowered */
    BR.assignHandler(b, bdata, c.id, 'Mira', 'back again');
    b.facilityLevels.wyvern_roost = 1;
    var cm2 = cmd(b, c, 'order.request', { fnId: 'wyr_signal_recall' });
    BR.ensureDev(b, c).bond.level = 2;
    var r2 = apply(b, cm2);
    t.equal(r2.ok, false);
    t.ok(/Needs the Wyvern Roost at Level 2/.test(r2.receipt.why), r2.receipt.why);
    /* the creature is no longer housed */
    var cm3 = cmd(b, c, 'profile.set', { dominant: 'Proud' });
    c.status = 'waiting'; c.home = '';
    t.ok(/isn't housed in a standing building/.test(apply(b, cm3).receipt.why));
    /* the building is gone */
    c.status = 'housed'; c.home = 'wyvern_roost';
    b.builtExtras = b.builtExtras.filter(function (x) { return x.facId !== 'wyvern_roost'; });
    t.ok(/isn't housed in a standing building/.test(apply(b, cmd(b, c, 'profile.set', { dominant: 'Proud' })).receipt.why));
  });

  test('a request that no longer qualifies fails cleanly: the bond, the programme already done, a milestone waiting', function (t) {
    var b = world({ roost: 3 });
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var r = apply(b, cmd(b, c, 'order.request', { fnId: 'wyr_keeper_routine' }));
    t.equal(r.ok, false);
    t.ok(/Needs Bond 1/.test(r.receipt.why), r.receipt.why);
    BR.ensureDev(b, c).bond.ready = 1;
    var r2 = apply(b, cmd(b, c, 'order.request', { fnId: 'wyr_safe_acclimatisation' }));
    t.equal(r2.ok, false);
    t.equal(r2.receipt.why, 'A bond milestone is waiting for the DM to confirm it first.', 'the DM\'s own wording is not shown to the player');
    t.equal(BR.trainingOrders(b).length, 0);
  });

  test('a request for another Bastion save, a stale one, a damaged one and an unknown kind are refused or ignored', function (t) {
    var b = world();
    var c = housed(b, 'griffin', 'Swiftwing', 'Mira');
    t.ok(/different Bastion save/.test(apply(b, cmd(b, c, 'profile.set', { dominant: 'Proud' }, { campaign: 'SOMEOTHERCAMPAIGN' })).receipt.why));
    t.ok(/different Bastion save/.test(apply(b, cmd(b, c, 'profile.set', { dominant: 'Proud' }, { campaign: '' })).receipt.why));
    t.ok(/too old/.test(apply(b, cmd(b, c, 'profile.set', { dominant: 'Proud' }, { at: NOW - 31 * 24 * 3600 * 1000 })).receipt.why));
    t.ok(/isn't one this Bastion understands/.test(apply(b, cmd(b, c, 'bond.confirm', { level: 5 })).receipt.why), 'a handler cannot confirm a bond');
    t.ok(/isn't one this Bastion understands/.test(apply(b, cmd(b, c, 'chronicle.add', { text: 'x' })).receipt.why), 'a handler cannot write the Chronicle');
    t.ok(/isn't one this Bastion understands/.test(apply(b, cmd(b, c, 'profile.set', 'not an object')).receipt.why));
    t.equal(apply(b, null).ignored, true);
    t.equal(apply(b, { id: 'x' }).ignored, true);
    t.equal(apply(b, { id: 'bad id with spaces!!' }).ignored, true);
    t.same([c.development.profileLog, c.development.chronicle.length, c.development.temperament.dominant], [undefined, 1, ''], 'nothing about the creature changed');
  });

  test('a handler can never change a bond, name, owner, species, stats or the Chronicle through a profile request', function (t) {
    var b = world();
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var before = JSON.stringify(b.creatures);
    ['bond', 'name', 'owner', 'species', 'handler', 'chronicle', 'war', 'training', 'status', 'home'].forEach(function (k) {
      var p = { dominant: 'Proud' }; p[k] = 'x';
      var r = apply(b, cmd(b, c, 'profile.set', p));
      t.equal(r.ok, false, k);
    });
    t.equal(JSON.stringify(b.creatures), before, 'not one thing changed');
  });

  test('another player\'s beast: Player A\'s request for Player B\'s beast is refused', function (t) {
    var b = world({ roost: 3 });
    var a = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var other = housed(b, 'wyvern', 'Ashwing', 'Joss');
    var r = apply(b, cmd(b, other, 'profile.set', { dominant: 'Proud' }, { handler: 'mira' }));
    t.equal(r.ok, false);
    t.ok(/isn't yours any more/.test(r.receipt.why));
    t.equal(other.development.temperament.dominant, '');
    t.ok(a);
  });

  test('a handler can be matched by name however it is typed; the DM can switch requests off, and they wait', function (t) {
    var b = world();
    var c = housed(b, 'griffin', 'Swiftwing', 'Mira');
    BR.beastState(b).accept = false;
    var cm = cmd(b, c, 'profile.set', { dominant: 'Proud' }, { handler: '  MIRA ' });
    var held = apply(b, cm);
    t.same([held.held, held.ok], [true, false]);
    t.equal(Object.keys(b.beast.done).length, 0, 'no receipt: it simply waits');
    b.beast.accept = true;
    t.equal(apply(b, cm).ok, true);
  });

  test('the DM can edit the Regional Variety too, and it survives a save; an empty one is cleared', function (t) {
    var b = world();
    var c = housed(b, 'dire_wolf', 'Ashfang', 'Joss');
    BR.setTemperament(b, bdata, c.id, { regional: '  Icepelt ' });
    t.equal(c.development.regional, 'Icepelt');
    var again = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.equal(BR.creatureById(again, c.id).development.regional, 'Icepelt');
    t.equal(snapOf(again, 'Joss').creatures[c.id].profile.regional, 'Icepelt');
    BR.setTemperament(b, bdata, c.id, { regional: '' });
    t.equal(c.development.regional, undefined);
    t.equal(BR.cleanDevelopment({ regional: '<b>x</b>' }).regional, 'b x /b', 'markup brackets are never kept');
    t.equal(BR.cleanDevelopment({ regional: '' }).regional, undefined, 'older saves are unchanged');
  });

  test('profile change notes survive saving and are capped; the receipts and handlers survive too', function (t) {
    var b = world();
    var c = housed(b, 'griffin', 'Swiftwing', 'Mira');
    for (var i = 0; i < 45; i++) apply(b, cmd(b, c, 'profile.set', { dominant: i % 2 ? 'Proud' : 'Wary' }));
    t.equal(c.development.profileLog.length, 40);
    var pair = BR.beastPair(b, bdata, 'Mira');
    t.equal(pair.ok, true);
    var again = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.equal(BR.creatureById(again, c.id).development.profileLog.length, 40);
    t.equal(Object.keys(again.beast.done).length, 45);
    t.equal(again.beast.handlers[0].secret, pair.pairing.secret);
    t.equal(BR.cleanBeast({ campaignId: 'short', handlers: [{ id: 'a', secret: 'tooshort' }], done: { 'x': { r: 'applied' } } }).campaignId, '');
  });

  group('Beast Handler: the code swap, from a phone (BH-3a, 21 October 2026)');

  test('pairing makes a secret for a handler; a new code replaces the old; taking it back stops it; the secret is never in a snapshot', function (t) {
    var b = world();
    var c = housed(b, 'griffin', 'Swiftwing', 'Mira');
    t.equal(BR.beastSecret(b, 'Mira'), '');
    var p1 = BR.beastPair(b, bdata, 'Mira');
    t.same([p1.ok, p1.handler, p1.name], [true, 'mira', 'Mira']);
    t.equal(p1.pairing.campaign, b.beast.campaignId);
    t.equal(BR.beastSecret(b, 'MIRA'), p1.pairing.secret);
    var p2 = BR.beastPair(b, bdata, 'mira');
    t.ok(p2.pairing.secret !== p1.pairing.secret);
    t.equal(b.beast.handlers.length, 1);
    t.equal(BR.beastRegistry(b, bdata)[0].paired, true);
    var raw = JSON.stringify(snapOf(b, 'Mira')) + BR.beastSnapshotCode(b, bdata, 'mira').code;
    t.equal(raw.indexOf(p2.pairing.secret), -1);
    t.ok(JSON.stringify(b.log).indexOf(p2.pairing.secret) === -1, 'nor in the Day Log');
    t.equal(BR.beastRevoke(b, 'Mira').ok, true);
    t.equal(BR.beastSecret(b, 'Mira'), '');
    t.equal(BR.beastRevoke(b, 'Mira').ok, false);
    t.equal(BR.beastPair(b, bdata, '   ').ok, false);
    t.ok(c);
  });

  test('a snapshot code opens with the pairing secret and holds the handler\'s own beasts, the campaign id, and a short Chronicle', function (t) {
    var b = world();
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    housed(b, 'wyvern', 'Ashwing', 'Joss');
    for (var i = 0; i < 60; i++) BR.addChronicleNote(b, bdata, c.id, 'A note number ' + i);
    var p = BR.beastPair(b, bdata, 'Mira');
    var res = BR.beastSnapshotCode(b, bdata, 'Mira');
    t.equal(res.ok, true);
    var d = C.decodeSnapshot(res.code, p.pairing.secret);
    t.equal(d.ok, true);
    t.equal(d.snapshot.campaign, b.beast.campaignId);
    t.same(Object.keys(d.snapshot.creatures), [c.id]);
    t.equal(d.snapshot.creatures[c.id].chronicle.length, 40);
    t.equal(d.snapshot.creatures[c.id].chroniclePartial, 21, '61 entries (60 notes and the handler line), 40 kept');
    t.equal(d.snapshot.creatures[c.id].chronicle[39].text, 'A note number 59', 'the latest are kept');
    t.equal(P.check(d.snapshot), '');
    t.equal(BR.beastSnapshotCode(b, bdata, 'Joss').ok, false, 'no code for an unpaired handler');
    t.equal(C.decodeSnapshot(res.code, 'someone-elses-secret-abcd').ok, false);
  });

  test('a signed request code from the phone is checked and applied once; pasting it again changes nothing', function (t) {
    var b = world({ roost: 3 });
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var p = BR.beastPair(b, bdata, 'Mira');
    var code = C.encodeCommand(cmd(b, c, 'order.request', { fnId: 'wyr_safe_acclimatisation' }, { fac: 'wyvern_roost' }), p.pairing.secret);
    var r = BR.beastProcessCode(b, bdata, code, NOW + 1000, rnd);
    t.equal(r.ok, true, JSON.stringify(r));
    t.equal(BR.trainingOrders(b).length, 1);
    var again = BR.beastProcessCode(b, bdata, code, NOW + 2000, rnd);
    t.same([again.ok, again.duplicate], [false, true]);
    t.equal(BR.trainingOrders(b).length, 1);
    var reopened = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.equal(BR.beastProcessCode(reopened, bdata, code, NOW + 3000, rnd).duplicate, true);
  });

  test('a request is ignored (no receipt, nothing done) when it is forged, changed, unsigned, from an unpaired or taken-back handler', function (t) {
    var b = world();
    var c = housed(b, 'griffin', 'Swiftwing', 'Mira');
    var p = BR.beastPair(b, bdata, 'Mira');
    var good = cmd(b, c, 'profile.set', { dominant: 'Proud' });
    var wrongKey = C.encodeCommand(good, 'abcdefghijkmnpqrstuvwxyz');
    var r1 = BR.beastProcessCode(b, bdata, wrongKey, NOW, rnd);
    t.same([r1.ok, r1.bad], [false, true]);
    var bits = C.encodeCommand(good, p.pairing.secret).split('.');
    var changed = bits[0] + '.' + TSI.hmac.b64uEncode(C.canonical(Object.assign({}, good, { payload: { dominant: 'Fiercely Loyal' } }))) + '.' + bits[2];
    t.equal(BR.beastProcessCode(b, bdata, changed, NOW, rnd).bad, true);
    t.equal(BR.beastProcessCode(b, bdata, 'BHC1.' + bits[1], NOW, rnd).bad, true, 'no signature');
    t.equal(BR.beastProcessCode(b, bdata, 'rubbish', NOW, rnd).bad, true);
    var other = cmd(b, c, 'profile.set', { dominant: 'Proud' }, { handler: 'joss' });
    t.ok(/no active pairing code/.test(BR.beastProcessCode(b, bdata, C.encodeCommand(other, p.pairing.secret), NOW, rnd).why), 'a handler with no code');
    BR.beastRevoke(b, 'Mira');
    t.ok(/no active pairing code/.test(BR.beastProcessCode(b, bdata, C.encodeCommand(good, p.pairing.secret), NOW, rnd).why), 'a taken-back code');
    t.equal(Object.keys(b.beast.done).length, 0, 'not one receipt: none of them was a real request');
    t.same([c.development.profileLog, c.development.temperament.dominant], [undefined, ''], 'nothing about the creature changed');
  });

  test('Player A cannot send an order for Player B\'s beast, even signed with A\'s own secret', function (t) {
    var b = world({ roost: 3 });
    var a = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var other = housed(b, 'wyvern', 'Ashwing', 'Joss');
    var pa = BR.beastPair(b, bdata, 'Mira');
    var pj = BR.beastPair(b, bdata, 'Joss');
    var forged = C.encodeCommand(cmd(b, other, 'order.request', { fnId: 'wyr_safe_acclimatisation' }, { handler: 'mira' }), pa.pairing.secret);
    var r = BR.beastProcessCode(b, bdata, forged, NOW, rnd);
    t.equal(r.ok, false);
    t.ok(/isn't yours any more/.test(r.receipt.why), r.receipt.why);
    /* and A cannot pretend to be Joss with A's secret */
    var pretend = C.encodeCommand(cmd(b, other, 'order.request', { fnId: 'wyr_safe_acclimatisation' }, { handler: 'joss' }), pa.pairing.secret);
    t.equal(BR.beastProcessCode(b, bdata, pretend, NOW, rnd).bad, true);
    t.equal(BR.trainingOrders(b).length, 0);
    t.ok(a && pj);
  });

  test('a receipt shows only to its own handler, and the DM sees every handler\'s latest', function (t) {
    var b = world({ roost: 3 });
    var a = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var o = housed(b, 'wyvern', 'Ashwing', 'Joss');
    apply(b, cmd(b, a, 'profile.set', { dominant: 'Proud' }));
    apply(b, cmd(b, o, 'profile.set', { dominant: 'Wary' }, { handler: 'joss' }), { via: 'local' });
    t.equal(snapOf(b, 'Mira').receipts.length, 1);
    t.equal(snapOf(b, 'Mira').receipts[0].label, 'Stormwing (profile)');
    t.equal(snapOf(b, 'Joss').receipts[0].label, 'Ashwing (profile)');
    t.equal(snapOf(b, '').receipts.length, 0);
    t.equal(BR.beastRecent(b, 5).length, 2);
    t.ok(JSON.stringify(snapOf(b, 'Mira')).indexOf('Ashwing (profile)') === -1);
  });

  test('requests from the companion on this laptop are applied in order, once, with a summary for the DM', function (t) {
    var b = world({ roost: 3 });
    var c = housed(b, 'wyvern', 'Stormwing', 'Mira');
    var c1 = cmd(b, c, 'profile.set', { dominant: 'Proud' }, { at: NOW + 10 });
    var c2 = cmd(b, c, 'order.request', { fnId: 'wyr_safe_acclimatisation' }, { at: NOW + 20 });
    var c3 = cmd(b, c, 'order.request', { fnId: 'wyr_safe_acclimatisation' }, { at: NOW + 30 });
    var q = BR.beastProcessQueue(b, bdata, [c3, c2, c1], NOW + 1000, rnd);
    t.same([q.changed, q.applied, q.refused], [true, 2, 1]);
    t.ok(q.lines.some(function (l) { return /refused/.test(l); }));
    t.equal(BR.trainingOrders(b).length, 1, 'oldest first: the profile, then the one order; the third is refused');
    t.same(BR.beastProcessQueue(b, bdata, [c3, c2, c1], NOW + 2000, rnd), { changed: false, lines: [], applied: 0, refused: 0 });
    t.same(BR.beastProcessQueue(b, bdata, 'nothing', NOW, rnd), { changed: false, lines: [], applied: 0, refused: 0 });
  });
}());
