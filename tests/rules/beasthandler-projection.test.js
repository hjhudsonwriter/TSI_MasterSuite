/* Scarlett Isles: Beast Handler — the player's view of the Bastion (BH-1a,
   tools/beasthandler/projection.js) and the DM-only Chronicle note it relies on
   (Harry's approvals of 21 October 2026, D1 to D8). */
(function () {
  var BR = TSI.bastion.rules;
  var P = TSI.beasthandler.projection;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };

  var seed = 0;
  function rnd() { seed += 0.0137; return seed % 1 || 0.5; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function last(b) { return b.pendingOrders[b.pendingOrders.length - 1]; }
  function complete(b, o) { var l = BR.completeSimpleOrder(b, bdata, o, rnd); BR.removeOrder(b, o.id); return l; }
  var grantN = 0;

  /* A Bastion with the Roost, the Tower and the Den standing (at the levels given). */
  function world(levels) {
    var lv = levels || {};
    var b = BR.defaultState(bdata);
    b.day = 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 400;
    b.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }, { facId: 'griffin_tower', status: 'built' }, { facId: 'dire_wolf_den', status: 'built' }];
    BR.ensureLevels(b, bdata);
    b.facilityLevels.wyvern_roost = lv.roost || 3;
    b.facilityLevels.griffin_tower = lv.tower || 2;
    b.facilityLevels.dire_wolf_den = lv.den || 2;
    return b;
  }
  function houseElara(b) {
    var r = BR.issueOrder(b, bdata, 'wyvern_roost', 'house_elara_wyvern', 0, rnd);
    if (!r.ok) throw new Error(r.message);
    complete(b, last(b));
    return BR.creatureById(b, 'elara_wyvern');
  }
  /* The DM grants a creature in the Explorer; the Bastion holds it waiting. */
  function grant(b, species, name) {
    grantN++;
    var gid = 'bh' + grantN + '-0a0b0c0d:dm:0';
    BR.applyInbox(b, bdata, { travel: { day: b.day }, journey: { outbox: [{ id: gid, type: 'creature', day: b.day, at: '2026-10-21T10:00:00.000Z', from: { code: 'DM', title: 'DM', step: 'dm' }, species: species, name: name, text: 'Granted' }] } }, 1000);
    return BR.creatureById(b, BR.creatureIdFor(gid));
  }
  var HOUSE = { wyvern: ['wyvern_roost', 'house_wyvern'], griffin: ['griffin_tower', 'house_griffin'], dire_wolf: ['dire_wolf_den', 'house_dire_wolf'] };
  function housed(b, species, name) {
    var c = grant(b, species, name);
    var h = HOUSE[species];
    var opts = BR.housingOptions(b, bdata, species);
    var idx = 0;
    opts.forEach(function (o, i) { if (o.creatureId === c.id) idx = i; });
    var r = BR.issueOrder(b, bdata, h[0], h[1], idx, rnd);
    if (!r.ok) throw new Error(r.message);
    complete(b, last(b));
    return c;
  }
  function snap(b, who) { return P.build(b, bdata, who); }
  function fac(s, id) { return s.facilities.filter(function (f) { return f.id === id; })[0]; }
  function dirNames(s) { return s.facilities.map(function (f) { return f.name + ': ' + f.creatures.map(function (c) { return c.name; }).join(', '); }); }
  function train(b, fac, fn, idx) { return BR.issueOrder(b, bdata, fac, fn, idx || 0, rnd); }

  group('Beast Handler: the snapshot (BH-1a, 21 October 2026)');

  test('Elara\'s wyvern loads with her name, handler Elara, Bond 1 (Acclimatised) and her credited Chronicle line', function (t) {
    var b = world();
    var c = houseElara(b);
    var s = snap(b, 'elara');
    t.equal(P.check(s), '');
    t.same(Object.keys(s.creatures), ['elara_wyvern']);
    var d = s.creatures.elara_wyvern;
    t.equal(d.name, 'Elara\'s wyvern');
    t.equal(d.handler.name, 'Elara');
    t.same([d.bond.level, d.bond.name, d.bond.max], [1, 'Acclimatised', 5]);
    t.same(d.chronicle.map(function (e) { return [e.id, e.cat, e.text, e.by]; }), [['ch-credit', 'bond', 'Existing relationship credited; Bond 1 per campaign decision.', 'DM']]);
    t.same([d.species.id, d.species.name, d.facility.id, d.facility.level], ['wyvern', 'Wyvern', 'wyvern_roost', 3]);
    t.equal(c.development.bond.level, 1, 'her Bastion record is untouched');
  });

  test('a temperament the DM wrote is carried across word for word', function (t) {
    var b = world();
    var c = houseElara(b);
    BR.setTemperament(b, bdata, c.id, { dominant: 'Proud', attachment: 'Lowers its head', trigger: 'Loud metallic ringing' });
    var p = snap(b, 'elara').creatures.elara_wyvern.profile;
    t.same(p, { regional: '', dominant: 'Proud', attachment: 'Lowers its head', trigger: 'Loud metallic ringing' });
  });

  test('housed griffins and dire wolves appear in their own buildings; waiting and unhoused creatures do not', function (t) {
    var b = world();
    houseElara(b);
    housed(b, 'griffin', 'Swiftwing');
    housed(b, 'dire_wolf', 'Ashfang');
    grant(b, 'griffin', 'Waiting Gryph');
    grant(b, 'dire_wolf', 'Waiting Wolf');
    var s = snap(b, '');
    t.same(dirNames(s), ['Wyvern Roost: Elara\'s wyvern', 'Griffin Tower: Swiftwing', 'Dire Wolf Den: Ashfang']);
    t.ok(JSON.stringify(s).indexOf('Waiting') === -1, 'nobody waiting is listed');
  });

  test('a building that is not built is not listed, and its creatures are not shown', function (t) {
    var b = world();
    houseElara(b);
    housed(b, 'dire_wolf', 'Ashfang');
    b.builtExtras = b.builtExtras.filter(function (x) { return x.facId !== 'dire_wolf_den'; });
    t.same(dirNames(snap(b, '')), ['Wyvern Roost: Elara\'s wyvern', 'Griffin Tower: '], 'the Tower stands but is empty; the Den is gone');
    b.builtExtras = [];
    t.same(snap(b, '').facilities, []);
  });

  test('a new creature with no handler or bond history shows in the directory with no bond; its detail is Bond 0 and nothing is stored', function (t) {
    var b = world();
    var g = housed(b, 'griffin', 'Swiftwing');
    var dir = fac(snap(b, ''), 'griffin_tower').creatures[0];
    t.same([dir.name, dir.handlerName, dir.bond, dir.mine], ['Swiftwing', '', null, false]);
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    var after = snap(b, 'Mira');
    t.same(fac(after, 'griffin_tower').creatures[0].bond, { level: 0, name: 'Unfamiliar' });
    t.same(after.creatures[g.id].bond, { level: 0, name: 'Unfamiliar', max: 5 });
    var d2 = snap(world(), 'nobody');
    t.same([d2.facilities.map(function (f) { return f.creatures.length; }), d2.creatures, d2.handler.hasCreatures], [[0, 0, 0], {}, false], 'three standing, empty buildings; nothing of one\'s own');
  });

  test('two creatures in one building stay separate by id, each with their own detail', function (t) {
    var b = world({ roost: 3 });
    var e = houseElara(b);
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    var m = snap(b, 'mira');
    t.same(Object.keys(m.creatures), [w.id]);
    t.equal(fac(m, 'wyvern_roost').creatures.length, 2);
    t.same(fac(m, 'wyvern_roost').creatures.map(function (c) { return [c.id, c.mine]; }), [['elara_wyvern', false], [w.id, true]]);
    var el = snap(b, 'Elara');
    t.same(Object.keys(el.creatures), ['elara_wyvern']);
    t.ok(e.id !== w.id);
  });

  test('renaming a beast in the Bastion changes the snapshot; changing the handler moves the access', function (t) {
    var b = world();
    var g = housed(b, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    t.equal(snap(b, 'Mira').creatures[g.id].name, 'Swiftwing');
    BR.renameCreature(b, bdata, g.id, 'Skyspear', 11);
    t.equal(snap(b, 'Mira').creatures[g.id].name, 'Skyspear');
    t.equal(fac(snap(b, 'Mira'), 'griffin_tower').creatures[0].name, 'Skyspear');
    var r = BR.assignHandler(b, bdata, g.id, 'Joss', 'Mira has left the party');
    t.equal(r.ok, true, r.message);
    t.same(Object.keys(snap(b, 'Mira').creatures), [], 'Mira can no longer see its detail');
    t.same(Object.keys(snap(b, 'Joss').creatures), [g.id]);
    t.equal(fac(snap(b, 'Mira'), 'griffin_tower').creatures[0].handlerName, 'Joss', 'the directory shows who has it now');
  });

  test('handler names match without regard to capitals or spacing, and never when empty', function (t) {
    t.equal(P.sameHandler('Mira', ' mira '), true);
    t.equal(P.sameHandler('Mi  ra', 'mi ra'), true);
    t.equal(P.sameHandler('', ''), false);
    t.equal(P.sameHandler('Mira', 'Joss'), false);
    var b = world();
    var g = housed(b, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    t.same(Object.keys(snap(b, '  MIRA ').creatures), [g.id]);
    t.same(P.handlers(b, bdata), [{ id: 'Mira', name: 'Mira', count: 1 }]);
  });

  group('Beast Handler: what a player never sees (BH-1a)');

  test('another player\'s creature is a directory line and nothing more: no profile, Chronicle or orders', function (t) {
    var b = world();
    var e = houseElara(b);
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    BR.addChronicleNote(b, bdata, e.id, 'OTHERPLAYERNOTE the cave at dusk');
    var m = snap(b, 'Mira');
    t.ok(JSON.stringify(m).indexOf('OTHERPLAYERNOTE') === -1, 'Elara\'s Chronicle is not in Mira\'s snapshot');
    t.ok(JSON.stringify(m).indexOf('Existing relationship credited') === -1);
    var line = fac(m, 'wyvern_roost').creatures[0];
    t.same(Object.keys(line).sort(), ['bond', 'handlerName', 'id', 'mine', 'name', 'species']);
    t.same([line.name, line.handlerName, line.mine, line.bond.level], ['Elara\'s wyvern', 'Elara', false, 1]);
  });

  test('the snapshot holds nothing but the agreed fields: no treasury, log, notes, other buildings or raw save', function (t) {
    var b = world();
    var e = houseElara(b);
    b.treasuryGP = 7654321;
    BR.log(b, 'Secret', 'SECRETLOGLINE', 10);
    b.organization.name = 'SECRETCLANNAME';
    b.dmEdits = { done: { SECRETEDIT: true } };
    b.warehouse = [{ id: 'SECRETWAREHOUSE', qty: 3 }];
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    var m = snap(b, 'Mira');
    var raw = JSON.stringify(m);
    ['7654321', 'SECRETLOGLINE', 'SECRETCLANNAME', 'SECRETEDIT', 'SECRETWAREHOUSE', 'treasury', 'pendingOrders', 'warRecovery', 'msgId', 'grantedDay', 'housedDay', 'handlerHistory', 'development'].forEach(function (needle) {
      t.ok(raw.indexOf(needle) === -1, 'no "' + needle + '" in the snapshot');
    });
    t.same(Object.keys(m).sort(), ['asOfDay', 'asOfLabel', 'creatures', 'facilities', 'handler', 'kind', 'version']);
    t.same(Object.keys(m.creatures[w.id]).sort(), ['artKey', 'bond', 'chronicle', 'facility', 'handler', 'id', 'name', 'orders', 'profile', 'species', 'training']);
    t.ok(e.id);
  });

  test('DM-only Chronicle notes never reach the snapshot; ordinary notes, ids and order do, exactly', function (t) {
    var b = world();
    var e = houseElara(b);
    BR.addChronicleNote(b, bdata, e.id, 'First public memory');
    var r = BR.addChronicleNote(b, bdata, e.id, 'SECRET-DM-NOTE the keystone', true);
    t.equal(r.ok, true);
    t.ok(/\(DM only\)/.test(r.log[1]));
    BR.addChronicleNote(b, bdata, e.id, 'Second public memory');
    var dev = e.development;
    t.same(dev.chronicle.map(function (x) { return !!x.private; }), [false, false, true, false], 'the note is flagged in the Bastion');
    var ch = snap(b, 'elara').creatures.elara_wyvern.chronicle;
    t.same(ch.map(function (x) { return x.id; }), ['ch-credit', 'ch-1', 'ch-3']);
    t.same(ch.map(function (x) { return x.text; }), ['Existing relationship credited; Bond 1 per campaign decision.', 'First public memory', 'Second public memory']);
    t.ok(JSON.stringify(snap(b, 'elara')).indexOf('SECRET-DM-NOTE') === -1);
    t.equal(ch[0].dayLabel, 'Day 10');
  });

  test('the DM-only flag survives a save and reload, and older notes and saves are unchanged', function (t) {
    var b = world();
    var e = houseElara(b);
    BR.addChronicleNote(b, bdata, e.id, 'An ordinary note');
    BR.addChronicleNote(b, bdata, e.id, 'A private note', true);
    var before = copy(BR.toSave(b));
    var again = BR.fromSave(copy(before), bdata);
    var ch = BR.creatureById(again, 'elara_wyvern').development.chronicle;
    t.same(ch.map(function (x) { return x.private === true; }), [false, false, true]);
    t.equal(Object.prototype.hasOwnProperty.call(ch[1], 'private'), false, 'an ordinary note carries no flag');
    t.same(copy(BR.toSave(again)).creatures, before.creatures, 'saving again changes nothing');
    var clean = BR.cleanDevelopment({ chronicle: [{ id: 'a', day: 2, cat: 'note', text: 'x', by: 'DM', link: '', private: 'yes' }] });
    t.equal(clean.chronicle[0].private, undefined, 'only a real true counts');
  });

  test('building a snapshot changes nothing in the save, and gives a creature no development it did not have', function (t) {
    var b = world();
    houseElara(b);
    var g = housed(b, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    var other = housed(b, 'dire_wolf', 'Ashfang');
    var before = JSON.stringify(b);
    snap(b, 'Mira'); snap(b, 'Elara'); snap(b, ''); P.handlers(b, bdata);
    t.equal(JSON.stringify(b), before);
    t.equal(other.development, undefined);
  });

  test('the snapshot is plain data: it survives JSON, and is the same after the Bastion saves and loads', function (t) {
    var b = world();
    houseElara(b);
    var g = housed(b, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    var s1 = snap(b, 'Mira');
    t.same(copy(s1), s1);
    var b2 = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.same(snap(b2, 'Mira'), s1);
  });

  test('P.check accepts a snapshot and refuses anything else', function (t) {
    var s = snap(world(), '');
    t.equal(P.check(s), '');
    t.ok(P.check(null) !== '');
    t.ok(P.check({ kind: 'something.else', version: 1, facilities: [], creatures: {} }) !== '');
    t.ok(P.check({ kind: P.KIND, version: 2, facilities: [], creatures: {} }) !== '');
    t.ok(P.check({ kind: P.KIND, version: 1, facilities: {}, creatures: {} }) !== '');
    t.ok(P.check({ kind: P.KIND, version: 1, facilities: [] }) !== '');
  });

  group('Beast Handler: orders and the pending-order lock (BH-1a)');

  test('a Bond 0 wyvern at Level 3 is offered only what the Bastion would accept: Safe Acclimatisation, free, with its ready day', function (t) {
    var b = world({ roost: 3 });
    var e = houseElara(b);
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    var o = snap(b, 'Mira').creatures[w.id].orders;
    t.equal(o.status, 'available');
    t.same(o.available.map(function (x) { return x.fnId; }), ['wyr_safe_acclimatisation']);
    var a = o.available[0];
    t.same([a.label, a.days, a.daysText, a.readyDay, a.readyLabel, a.level, a.costGP, a.costText], ['Safe Acclimatisation', 5, '5 days', 15, 'Day 15', 1, 0, 'Free']);
    t.ok(/Bond 1 \(Acclimatised\) is ready for the DM to confirm/.test(a.consequence), a.consequence);
    t.equal(BR.trainingBlocker(b, bdata, BR.facility(bdata, 'wyvern_roost'), BR.fn(BR.facility(bdata, 'wyvern_roost'), 'wyr_safe_acclimatisation'), w), '', 'the Bastion agrees');
    t.ok(e.id);
  });

  test('a creature with no handler belongs to nobody\'s companion', function (t) {
    var b = world();
    var g = housed(b, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    BR.ensureDev(b, g).handlerId = '';
    t.same(Object.keys(snap(b, 'Mira').creatures), []);
  });

  test('orders appear as the building and the bond allow, never above the building\'s level', function (t) {
    var b = world({ roost: 1 });
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    var dev = BR.ensureDev(b, w);
    dev.bond.level = 2;
    function ids() { return snap(b, 'Mira').creatures[w.id].orders.available.map(function (x) { return x.fnId; }); }
    t.same(ids(), [], 'Level 1 offers nothing at Bond 2 (Safe Acclimatisation and the Keeper\'s Routine are for lower bonds)');
    b.facilityLevels.wyvern_roost = 2;
    var lvl2 = ids();
    t.ok(lvl2.indexOf('wyr_signal_recall') !== -1 && lvl2.indexOf('wyr_defence_drills') !== -1, 'Level 2 opens Signal & Recall and Territorial Defence Drills');
    t.ok(lvl2.indexOf('wyr_open_sky_return') === -1 && lvl2.indexOf('wyr_aerial_sentinel') === -1, 'Level 3 programmes are still hidden');
    b.facilityLevels.wyvern_roost = 3;
    var lvl3 = ids();
    t.ok(lvl3.indexOf('wyr_aerial_sentinel') === -1, 'Aerial Sentinel needs Bond 3');
    dev.bond.level = 3;
    t.ok(ids().indexOf('wyr_aerial_sentinel') !== -1 && ids().indexOf('wyr_open_sky_return') !== -1);
  });

  test('the riding harness (150 gp), House orders and the first flight are never offered, even when the Bastion would allow them', function (t) {
    var b = world({ roost: 5 });
    b.treasuryGP = 5000;
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    BR.ensureDev(b, w).bond.level = 4;
    var fac = BR.facility(bdata, 'wyvern_roost');
    t.equal(BR.trainingBlocker(b, bdata, fac, BR.fn(fac, 'wyr_riding_harness'), w), '', 'the Bastion itself would accept the harness');
    var offered = snap(b, 'Mira').creatures[w.id].orders.available.map(function (x) { return x.fnId; });
    t.equal(offered.indexOf('wyr_riding_harness'), -1);
    t.ok(offered.every(function (id) { return !/^house_/.test(id); }));
    t.ok(offered.length > 0 && offered.every(function (id) { return Number(BR.fn(fac, id).costGP) === 0; }));
  });

  test('griffins and dire wolves are offered their own programmes now (the brief\'s "no training yet" is out of date)', function (t) {
    var b = world();
    var g = housed(b, 'griffin', 'Swiftwing');
    var wf = housed(b, 'dire_wolf', 'Ashfang');
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    BR.assignHandler(b, bdata, wf.id, 'Joss', '');
    t.same(snap(b, 'Mira').creatures[g.id].orders.available.map(function (x) { return x.fnId; }), ['grf_safe_acclimatisation']);
    t.same(snap(b, 'Joss').creatures[wf.id].orders.available.map(function (x) { return x.fnId; }), ['dwf_safe_acclimatisation']);
    t.equal(snap(b, 'Joss').creatures[wf.id].orders.available[0].label, 'Safe Acclimatisation');
  });

  test('while any order is pending at the building, nothing new is offered: the pending order and its day are shown instead', function (t) {
    var b = world({ roost: 3 });
    var e = houseElara(b);
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    var r = train(b, 'wyvern_roost', 'wyr_safe_acclimatisation', 1);
    t.equal(r.ok, true, r.message);
    var pend = last(b);
    var mira = snap(b, 'Mira').creatures[w.id].orders;
    t.equal(mira.status, 'busy');
    t.same(mira.available, []);
    t.same([mira.busy.label, mira.busy.dueDay, mira.busy.dueLabel, mira.busy.forThisCreature], [pend.label, 15, 'Day 15', true]);
    t.ok(/is busy: .*ready on Day 15\./.test(mira.note), mira.note);
    var elara = snap(b, 'Elara').creatures.elara_wyvern.orders;
    t.equal(elara.status, 'busy', 'a different player\'s creature is locked out too (the whole building)');
    t.equal(elara.busy.forThisCreature, false);
    t.ok(!!BR.trainingOptions(b, bdata, BR.facility(bdata, 'wyvern_roost'), BR.fn(BR.facility(bdata, 'wyvern_roost'), 'wyr_safe_acclimatisation')).length);
  });

  test('the DM\'s own training places are untouched: the Bastion still takes a second programme at Level 3 while the phone is locked', function (t) {
    var b = world({ roost: 3 });
    var e = houseElara(b);
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    train(b, 'wyvern_roost', 'wyr_safe_acclimatisation', 1);
    t.equal(BR.trainingPlaces(b, bdata, 'wyvern_roost').free, 1, 'one of the two places is free');
    BR.ensureDev(b, e).bond.level = 1;
    var second = train(b, 'wyvern_roost', 'wyr_keeper_routine', 0);
    t.equal(second.ok, true, second.message);
    t.equal(BR.trainingOrders(b).length, 2, 'both programmes are running');
    t.equal(snap(b, 'Mira').creatures[w.id].orders.status, 'busy');
  });

  test('an order pending at some other building never blocks this one', function (t) {
    var b = world({ roost: 3, tower: 2, den: 2 });
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    var g = housed(b, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, g.id, 'Joss', '');
    var r = train(b, 'griffin_tower', 'grf_safe_acclimatisation', 0);
    t.equal(r.ok, true, r.message);
    t.equal(snap(b, 'Joss').creatures[g.id].orders.status, 'busy');
    var m = snap(b, 'Mira').creatures[w.id].orders;
    t.equal(m.status, 'available', 'the Roost is free');
    var grant2 = grant(b, 'dire_wolf', 'Waiting Wolf');
    t.ok(grant2);
    b.pendingOrders.push({ id: 'x1', facId: 'library_scriptorium', fnId: 'research', chosen: null, optionLabel: '', notes: '', label: 'Library: Research', costGP: 0, issuedDay: 10, dueDay: 14 });
    t.equal(snap(b, 'Mira').creatures[w.id].orders.status, 'available', 'a Library order does not matter');
  });

  test('a House order or an Upgrade pending at the building also holds the phone back (the whole building)', function (t) {
    var b = world({ roost: 3 });
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    grant(b, 'wyvern', 'Second Wing');
    var r = BR.issueOrder(b, bdata, 'wyvern_roost', 'house_wyvern', 0, rnd);
    t.equal(r.ok, true, r.message);
    var o = snap(b, 'Mira').creatures[w.id].orders;
    t.equal(o.status, 'busy');
    t.ok(/House a Wyvern/.test(o.busy.label), o.busy.label);
  });

  test('the earliest-due pending order is the one shown; when it completes the building is free again', function (t) {
    var b = world({ roost: 3 });
    var e = houseElara(b);
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    b.pendingOrders.push({ id: 'late', facId: 'wyvern_roost', fnId: 'x', chosen: null, optionLabel: '', notes: '', label: 'Wyvern Roost: Late', costGP: 0, issuedDay: 10, dueDay: 30 });
    b.pendingOrders.push({ id: 'soon', facId: 'wyvern_roost', fnId: 'x', chosen: null, optionLabel: '', notes: '', label: 'Wyvern Roost: Soon', costGP: 0, issuedDay: 10, dueDay: 12 });
    t.equal(snap(b, 'Mira').creatures[w.id].orders.busy.label, 'Wyvern Roost: Soon');
    BR.removeOrder(b, 'soon'); BR.removeOrder(b, 'late');
    t.equal(snap(b, 'Mira').creatures[w.id].orders.status, 'available');
    t.ok(e.id);
  });

  test('a building Under Repair offers nothing and says so', function (t) {
    var b = world({ roost: 3 });
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    b.repairs = { wyvern_roost: 14 };
    var o = snap(b, 'Mira').creatures[w.id].orders;
    t.equal(o.status, 'repair');
    t.equal(o.note, 'The Wyvern Roost is Under Repair until Day 14.');
    t.same(o.available, []);
  });

  test('the creature\'s own current training is shown with its due day, and "paused" while it recovers', function (t) {
    var b = world({ roost: 3 });
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    t.equal(snap(b, 'Mira').creatures[w.id].training, null);
    train(b, 'wyvern_roost', 'wyr_safe_acclimatisation', 0);
    t.same(snap(b, 'Mira').creatures[w.id].training, { label: 'Safe Acclimatisation', dueDay: 15, dueLabel: 'Day 15', paused: false });
    b.warRecovery = [{ kind: 'creature', creatureId: w.id, status: 'wounded', untilDay: 20 }];
    t.equal(snap(b, 'Mira').creatures[w.id].training.paused, true);
  });

  test('nothing is claimed as started: a snapshot has no "accepted" or "completed" state of its own', function (t) {
    var b = world({ roost: 3 });
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    var o = snap(b, 'Mira').creatures[w.id].orders;
    t.ok(['available', 'busy', 'none', 'repair'].indexOf(o.status) !== -1);
    t.equal(JSON.stringify(snap(b, 'Mira')).indexOf('"accepted"'), -1);
  });
}());
