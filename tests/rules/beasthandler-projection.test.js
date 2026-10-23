/* Scarlett Isles: Beast Handler — the player's view of the Bastion (BH-1a,
   tools/beasthandler/projection.js) and the DM-only Chronicle note it relies on
   (Harry's approvals of 21 October 2026, D1 to D8). Version 2 (22 October 2026): read-only, so no orders, training,
   receipts or request fingerprints; a Bond 0 beast has no detail; the first meeting the Bastion rolled is carried to
   its own handler only. Every field is listed with the reason a player may see it, and a field with no reason fails. */
(function () {
  var BR = TSI.bastion.rules;
  var P = TSI.beasthandler.projection;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var PEN = 'beast_pen';

  var seed = 0;
  function rnd() { seed += 0.0137; return seed % 1 || 0.5; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function last(b) { return b.pendingOrders[b.pendingOrders.length - 1]; }
  function complete(b, o) { var l = BR.completeSimpleOrder(b, bdata, o, rnd); BR.removeOrder(b, o.id); return l; }
  var grantN = 0;

  /* A Bastion with the Beast Pen standing (one level only). */
  function world() {
    var b = BR.defaultState(bdata);
    b.day = 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 400;
    b.builtExtras = [{ facId: PEN, status: 'built' }];
    BR.ensureLevels(b, bdata);
    return b;
  }
  /* Elara's wyvern, as an older save holds her: housed at the Pen with her handler and Bond 1 (nothing makes her any more). */
  function houseElara(b) {
    b.creatures.push({ id: 'elara_wyvern', species: 'wyvern', owner: 'elara', name: '', status: 'housed', home: PEN, grantedDay: 1, housedDay: b.day, msgId: '', development: BR.newDevelopment({ id: 'elara_wyvern' }, b.day) });
    return BR.creatureById(b, 'elara_wyvern');
  }
  /* The DM grants a creature in the Explorer; the Bastion holds it waiting. */
  function grant(b, species, name) {
    grantN++;
    var gid = 'bh' + grantN + '-0a0b0c0d:dm:0';
    BR.applyInbox(b, bdata, { travel: { day: b.day }, journey: { outbox: [{ id: gid, type: 'creature', day: b.day, at: '2026-10-21T10:00:00.000Z', from: { code: 'DM', title: 'DM', step: 'dm' }, species: species, name: name, text: 'Granted' }] } }, 1000);
    return BR.creatureById(b, BR.creatureIdFor(gid));
  }
  function housed(b, species, name) {
    var c = grant(b, species, name);
    var opts = BR.housingOptions(b, bdata, '*');
    var idx = 0;
    opts.forEach(function (o, i) { if (o.creatureId === c.id) idx = i; });
    var r = BR.issueOrder(b, bdata, PEN, 'house_beast', idx, rnd);
    if (!r.ok) throw new Error(r.message);
    complete(b, last(b));
    return c;
  }
  function snap(b, who) { return P.build(b, bdata, who); }
  /* The one facility entry: the Beast Pen. */
  function pen(s) { return s.facilities[0]; }
  function dirNames(s) { return s.facilities.map(function (f) { return f.name + ': ' + f.creatures.map(function (c) { return c.name; }).join(', '); }); }

  group('Beast Handler: the snapshot (BH-1a, 21 October 2026; one Beast Pen since 22 October 2026)');

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
    t.same(d.chronicle.map(function (e) { return [e.id, e.cat, e.text, e.by]; }), [['e1', 'bond', 'Existing relationship credited; Bond 1 per campaign decision.', 'DM']]);
    t.same([d.species.id, d.species.name, d.place], ['wyvern', 'Wyvern', 'pen']);
    t.equal(c.development.bond.level, 1, 'her Bastion record is untouched');
  });

  test('a temperament the DM wrote is carried across word for word', function (t) {
    var b = world();
    var c = houseElara(b);
    BR.setTemperament(b, bdata, c.id, { dominant: 'Proud', attachment: 'Lowers its head', trigger: 'Loud metallic ringing' });
    var p = snap(b, 'elara').creatures.elara_wyvern.profile;
    t.same(p, { regional: '', dominant: 'Proud', attachment: 'Lowers its head', trigger: 'Loud metallic ringing' });
  });

  test('every housed beast appears in the one Beast Pen, of every kind; waiting and unhoused creatures do not', function (t) {
    var b = world();
    houseElara(b);
    housed(b, 'griffin', 'Swiftwing');
    housed(b, 'dire_wolf', 'Ashfang');
    housed(b, 'buckbear', 'Bramble');
    housed(b, 'fellcat', 'Lichen');
    grant(b, 'griffin', 'Waiting Gryph');
    grant(b, 'dire_wolf', 'Waiting Wolf');
    var s = snap(b, '');
    t.same(dirNames(s), ['Beast Pen: Elara\'s wyvern, Swiftwing, Ashfang, Bramble, Lichen']);
    t.same(s.facilities.map(function (f) { return [f.id, f.level]; }), [[PEN, 1]], 'one entry, one level');
    t.same(pen(s).creatures.map(function (c) { return c.species.id; }), ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat']);
    t.ok(JSON.stringify(s).indexOf('Waiting') === -1, 'nobody waiting is listed');
  });

  test('a Pen that is not built is not listed, and its beasts are not shown', function (t) {
    var b = world();
    houseElara(b);
    housed(b, 'dire_wolf', 'Ashfang');
    t.same(dirNames(snap(b, '')), ['Beast Pen: Elara\'s wyvern, Ashfang']);
    b.builtExtras = [];
    t.same(snap(b, '').facilities, []);
    b.builtExtras = [{ facId: PEN, status: 'building', startDay: 1, readyDay: 22 }];
    t.same(snap(b, '').facilities, [], 'nor while it is being built');
  });

  test('a new creature with no handler or bond history shows in the directory with no bond; its detail is Bond 0 and nothing is stored', function (t) {
    var b = world();
    var g = housed(b, 'griffin', 'Swiftwing');
    var dir = pen(snap(b, '')).creatures[0];
    t.same([dir.name, dir.handlerName, dir.bond, dir.mine, dir.available, dir.place], ['Swiftwing', '', null, false, false, 'pen']);
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    var after = snap(b, 'Mira');
    t.same(pen(after).creatures[0].bond, { level: 0, name: 'Unfamiliar' });
    t.same(after.creatures[g.id].bond, { level: 0, name: 'Unfamiliar', max: 5 });
    var d2 = snap(world(), 'nobody');
    t.same([d2.facilities.map(function (f) { return f.creatures.length; }), d2.creatures, d2.handler.hasCreatures], [[0], {}, false], 'one standing, empty Pen; nothing of one\'s own');
  });

  test('two creatures in the Pen stay separate by id, each with their own detail', function (t) {
    var b = world();
    var e = houseElara(b);
    var w = housed(b, 'griffin', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    var m = snap(b, 'mira');
    t.same(Object.keys(m.creatures), [w.id]);
    t.equal(pen(m).creatures.length, 2);
    t.same(pen(m).creatures.map(function (c) { return [c.id, c.mine]; }), [['elara_wyvern', false], [w.id, true]]);
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
    t.equal(pen(snap(b, 'Mira')).creatures[0].name, 'Skyspear');
    var r = BR.assignHandler(b, bdata, g.id, 'Joss', 'Mira has left the party');
    t.equal(r.ok, true, r.message);
    t.same(Object.keys(snap(b, 'Mira').creatures), [], 'Mira can no longer see its detail');
    t.same(Object.keys(snap(b, 'Joss').creatures), [g.id]);
    t.equal(pen(snap(b, 'Mira')).creatures[0].handlerName, 'Joss', 'the directory shows who has it now');
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

  test('another player\'s creature is a directory line and nothing more: no profile, Chronicle, first meeting or bonding', function (t) {
    var b = world();
    var e = houseElara(b);
    var w = housed(b, 'griffin', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    BR.addChronicleNote(b, bdata, e.id, 'OTHERPLAYERNOTE the cave at dusk');
    BR.takeOut(b, bdata, e.id, {});
    var m = snap(b, 'Mira');
    t.ok(JSON.stringify(m).indexOf('OTHERPLAYERNOTE') === -1, 'Elara\'s Chronicle is not in Mira\'s snapshot');
    t.ok(JSON.stringify(m).indexOf('Existing relationship credited') === -1);
    var line = pen(m).creatures[0];
    t.same(Object.keys(line).sort(), ['available', 'bond', 'handlerName', 'id', 'mine', 'name', 'place', 'species']);
    t.same([line.name, line.handlerName, line.mine, line.bond.level, line.place], ['Elara\'s wyvern', 'Elara', false, 1, 'away']);
    ['bonding', 'awaySince', 'initiation', 'profile', 'lastTick', 'pill'].forEach(function (needle) { t.equal(JSON.stringify(m).indexOf(needle), -1, 'no ' + needle + ' of another handler\'s beast'); });
  });

  test('the snapshot holds nothing but the agreed fields: no treasury, log, notes, other buildings or raw save', function (t) {
    var b = world();
    var e = houseElara(b);
    b.treasuryGP = 7654321;
    BR.log(b, 'Secret', 'SECRETLOGLINE', 10);
    b.partyName = 'SECRETPARTYNAME';
    b.dmEdits = { done: { SECRETEDIT: true } };
    b.warehouse = [{ id: 'SECRETWAREHOUSE', qty: 3 }];
    var w = housed(b, 'griffin', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    var m = snap(b, 'Mira');
    var raw = JSON.stringify(m);
    ['7654321', 'SECRETLOGLINE', 'SECRETPARTYNAME', 'SECRETEDIT', 'SECRETWAREHOUSE', 'treasury', 'pendingOrders', 'warRecovery', 'msgId', 'grantedDay', 'housedDay', 'handlerHistory', 'development', 'retryDay', 'acclimatise', 'tries'].forEach(function (needle) {
      t.ok(raw.indexOf(needle) === -1, 'no "' + needle + '" in the snapshot');
    });
    t.same(Object.keys(m).sort(), ['asOfDay', 'asOfLabel', 'campaign', 'creatures', 'facilities', 'handler', 'kind', 'version']);
    t.same(Object.keys(m.creatures[w.id]).sort(), ['available', 'bond', 'handler', 'id', 'name', 'species'], 'a Bond 0 beast: no more than this (no place, no bonding)');
    t.ok(e.id);
  });

  test('the DM doc\'s Quest text (tsi.dmdoc.quest) never reaches the snapshot, even if it were copied into the Bastion\'s save', function (t) {
    var b = world();
    var w = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, w.id, 'Mira', '');
    var before = JSON.stringify(snap(b, 'Mira'));
    var secret = 'SECRET-QUEST-TEXT the keystone is under the Ironbow';
    var q = TSI.dmDocRules.makeQuest(secret, 5);
    b.dmdocQuest = q;                   /* as if it had been copied into the Bastion's save by mistake */
    b.notes = secret;
    b['tsi.dmdoc.quest'] = q;
    var after = JSON.stringify(snap(b, 'Mira'));
    t.equal(after, before, 'the snapshot is the same with the Quest text there');
    ['SECRET-QUEST', 'keystone', 'dmdoc', 'quest'].forEach(function (needle) {
      t.ok(after.toLowerCase().indexOf(needle.toLowerCase()) === -1, 'no "' + needle + '" in the snapshot');
    });
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
    t.same(ch.map(function (x) { return x.id; }), ['e1', 'e2', 'e3'], 'numbered afresh: no gap shows where the hidden note was');
    t.ok(ch.every(function (x) { return x.link === undefined; }), 'no Bastion-internal link goes out');
    t.same(ch.map(function (x) { return x.text; }), ['Existing relationship credited; Bond 1 per campaign decision.', 'First public memory', 'Second public memory']);
    t.ok(JSON.stringify(snap(b, 'elara')).indexOf('SECRET-DM-NOTE') === -1);
    t.equal(ch[0].dayLabel, 'Day 10');
  });

  test('a failed acclimatisation\'s DM-only note and a taken-out line: the failed try never reaches the snapshot, the public lines do', function (t) {
    var b = world();
    var c = housed(b, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, c.id, 'Mira', '');
    BR.acclimatise(b, bdata, c.id, 8, {});
    t.equal(JSON.stringify(snap(b, 'Mira')).indexOf('Acclimatisation failed'), -1, 'nothing at Bond 0 is sent at all');
    BR.rollInitiation(b, bdata, c.id, rnd);
    b.day = 14;
    BR.acclimatise(b, bdata, c.id, 25, {});
    BR.takeOut(b, bdata, c.id, {});
    var ch = snap(b, 'Mira').creatures[c.id].chronicle.map(function (x) { return [x.cat, x.text]; });
    t.same(ch.map(function (x) { return x[0]; }), ['handler', 'bond', 'travel']);
    t.ok(/Acclimatised with Mira on Day 14 \(rolled 25 against DC 20\)/.test(ch[1][1]));
    t.equal(JSON.stringify(snap(b, 'Mira')).indexOf('failed'), -1, 'the DM-only failed try stays in the Bastion');
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
    /* The flag fails closed: any plausible way of writing "yes" keeps the note hidden; a real false or nothing leaves it public. */
    [true, 1, 'yes', 'true', 'TRUE', ' 1 ', 'private'].forEach(function (v) {
      var c = BR.cleanDevelopment({ chronicle: [{ id: 'a', day: 2, cat: 'note', text: 'x', by: 'DM', link: '', private: v }] });
      t.equal(c.chronicle[0].private, true, 'private: ' + JSON.stringify(v) + ' stays hidden');
    });
    [false, 0, 'false', '', null, undefined, 'no'].forEach(function (v) {
      var c = BR.cleanDevelopment({ chronicle: [{ id: 'a', day: 2, cat: 'note', text: 'x', by: 'DM', link: '', private: v }] });
      t.equal(c.chronicle[0].private, undefined, 'private: ' + JSON.stringify(v) + ' is an ordinary note');
    });
    var raw = BR.fromSave(copy(BR.toSave(b)), bdata);
    BR.creatureById(raw, 'elara_wyvern').development.chronicle[1].private = 'yes';
    t.equal(snap(raw, 'elara').creatures.elara_wyvern.chronicle.some(function (x) { return x.text === 'An ordinary note'; }), false, 'the snapshot hides it too, whatever way the flag is written');
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

  test('P.check accepts a version 2 snapshot and refuses anything else, including every version 1 snapshot an old phone kept', function (t) {
    var s = snap(world(), '');
    t.equal(P.VERSION, 2);
    t.equal(P.check(s), '');
    t.ok(P.check(null) !== '');
    t.ok(P.check({ kind: 'something.else', version: 2, facilities: [], creatures: {} }) !== '');
    t.ok(/different version/.test(P.check({ kind: P.KIND, version: 1, facilities: [], creatures: {} })), 'version 1 is retired');
    t.ok(P.check({ kind: P.KIND, version: 3, facilities: [], creatures: {} }) !== '');
    t.ok(P.check({ kind: P.KIND, version: 2, facilities: {}, creatures: {} }) !== '');
    t.ok(P.check({ kind: P.KIND, version: 2, facilities: [] }) !== '');
  });

  group('Beast Handler: the read-only snapshot, version 2 (22 October 2026)');

  /* The beast that has passed acclimatisation (Bond 1), housed and handled by Mira. */
  function mira(b, species, name, bond) {
    var c = housed(b, species || 'wyvern', name || 'Stormwing');
    BR.assignHandler(b, bdata, c.id, 'Mira', '');
    BR.ensureDev(b, c).bond.level = bond === undefined ? 1 : bond;
    return c;
  }

  test('a creature with no handler belongs to nobody\'s companion', function (t) {
    var b = world();
    var g = housed(b, 'griffin', 'Swiftwing');
    BR.assignHandler(b, bdata, g.id, 'Mira', '');
    BR.ensureDev(b, g).handlerId = '';
    t.same(Object.keys(snap(b, 'Mira').creatures), []);
  });

  test('every field of the snapshot, and the reason a player may see it (a field with no reason fails)', function (t) {
    var b = world();
    var c = mira(b, 'wyvern', 'Stormwing', 2);
    BR.sweepInitiation(b, bdata, rnd);
    BR.addChronicleNote(b, bdata, c.id, 'A public note.');
    BR.setTemperament(b, bdata, c.id, { dominant: 'Proud', attachment: 'Lowers its head', trigger: 'Thick smoke' });
    BR.takeOut(b, bdata, c.id, {});
    var s = snap(b, 'Mira');
    var TOP = {
      kind: 'names the file, so a phone can tell a snapshot from anything else',
      version: 'lets a phone retire a snapshot from another version',
      campaign: 'the Bastion\'s own random id: a phone only takes a snapshot for the Bastion it was paired with',
      asOfDay: 'the in-game day, already on every screen of the Explorer',
      asOfLabel: 'the same day, as words',
      handler: 'the viewer\'s own name and whether they have a beast',
      facilities: 'the directory: the Beast Pen and who lives in it (public in the Ironbow)',
      creatures: 'the detail of the viewer\'s OWN beasts only'
    };
    t.same(Object.keys(s).sort(), Object.keys(TOP).sort());
    var DIR = {
      id: 'an id the phone needs to open its own beast', name: 'seen by everyone at the Ironbow', species: 'a beast\'s kind is plain to see',
      handlerName: 'who looks after it is public', bond: 'the bond is on every directory line (Harry, 21 October 2026)',
      available: 'whether it has passed acclimatisation: the line says "Not acclimatised yet" otherwise', mine: 'whether the viewer is its handler',
      place: 'whether it is at the Beast Pen or out on the road with its handler: the whole party sees who has taken a beast out'
    };
    t.same(Object.keys(pen(s).creatures[0]).sort(), Object.keys(DIR).sort());
    t.same(Object.keys(pen(s)).sort(), ['creatures', 'id', 'level', 'name'], 'the Pen: its name and level (one) are public');
    var DETAIL = {
      id: 'its own id', name: 'its own name', species: 'its own kind', handler: 'its own handler\'s name',
      available: 'true from Bond 1', bond: 'its own bond',
      place: 'whether it is at the Beast Pen or away from the Ironbow: its own handler took it out',
      bonding: 'its own Bonding Days and how far its next pill has filled, which is what the Bond page shows its handler',
      initiation: 'the first meeting the Bastion rolled for THIS handler\'s beast, for the reveal; null until it has one',
      profile: 'its own Regional Variety and personality lines, the DM\'s or rolled words, for its own handler',
      chronicle: 'its own record, without the DM-only notes', artKey: 'which kind\'s picture to use'
    };
    t.same(Object.keys(s.creatures[c.id]).sort(), Object.keys(DETAIL).sort());
    var BONDING = {
      away: 'whether it is out on the road (the same as place)', awaySince: 'the day its handler took it out', awaySinceLabel: 'that day, as words',
      days: 'its Bonding Days: the counter on the Bond page', pill: 'the pill filling now: its number, the days into it, the days it needs, the fraction and whether it is full; null at Bond 5',
      ready: 'the level waiting for the DM\'s scene, or null: it is the "Ready" state of the pill'
    };
    t.same(Object.keys(s.creatures[c.id].bonding).sort(), Object.keys(BONDING).sort());
    t.same(Object.keys(s.creatures[c.id].bonding.pill).sort(), ['days', 'fraction', 'full', 'n', 'need']);
    Object.keys(DETAIL).forEach(function (k) { t.ok(DETAIL[k].length > 5, 'a reason for ' + k); });
    Object.keys(BONDING).forEach(function (k) { t.ok(BONDING[k].length > 5, 'a reason for bonding.' + k); });
    Object.keys(TOP).concat(Object.keys(DIR)).forEach(function (k) { t.ok((TOP[k] || DIR[k]).length > 5, 'a reason for ' + k); });
    t.same(Object.keys(s.creatures[c.id].initiation).sort(), ['regional', 'rolls']);
    t.same(Object.keys(s.creatures[c.id].initiation.rolls).sort(), ['attachment', 'dominant', 'trigger']);
    t.equal(JSON.stringify(s).indexOf('lastTick'), -1, 'the guard that stops a day being counted twice stays in the Bastion');
  });

  test('place and bonding: at the Pen, then away, with the pill filling from the Bonding Days; Bond 5 has no pill; a beast at Bond 0 sends none of it', function (t) {
    var b = world();
    var c = mira(b, 'griffin', 'Swiftwing', 1);
    var at = snap(b, 'Mira').creatures[c.id];
    t.same([at.place, at.bonding], ['pen', { away: false, awaySince: null, awaySinceLabel: '', days: 0, pill: { n: 2, days: 0, need: 10, fraction: 0, full: false }, ready: null }]);
    t.equal(pen(snap(b, 'Mira')).creatures[0].place, 'pen');
    BR.takeOut(b, bdata, c.id, {});
    for (var i = 0; i < 4; i++) { BR.startDay(b, bdata, 0); BR.finishDay(b); }
    var away = snap(b, 'Mira').creatures[c.id];
    t.same([away.place, away.bonding], ['away', { away: true, awaySince: 10, awaySinceLabel: 'Day 10', days: 4, pill: { n: 2, days: 4, need: 10, fraction: 0.4, full: false }, ready: null }]);
    t.equal(pen(snap(b, 'Mira')).creatures[0].place, 'away');
    for (i = 0; i < 6; i++) { BR.startDay(b, bdata, 0); BR.finishDay(b); }
    var ready = snap(b, 'Mira').creatures[c.id].bonding;
    t.same([ready.days, ready.ready, ready.pill.full, ready.pill.fraction], [10, 2, true, 1], 'full and waiting for the DM');
    BR.confirmBond(b, bdata, c.id, 'The scene');
    t.same(snap(b, 'Mira').creatures[c.id].bonding.pill, { n: 3, days: 0, need: 10, fraction: 0, full: false }, 'the next pill starts');
    BR.ensureDev(b, BR.creatureById(b, c.id)).bond.level = 5;
    t.equal(snap(b, 'Mira').creatures[c.id].bonding.pill, null, 'Bond 5: no pill left');
    BR.ensureDev(b, BR.creatureById(b, c.id)).bond.level = 0;
    BR.ensureDev(b, BR.creatureById(b, c.id)).bonding.away = false;
    var zero = snap(b, 'Mira').creatures[c.id];
    t.same(Object.keys(zero).sort(), ['available', 'bond', 'handler', 'id', 'name', 'species'], 'Bond 0: no place, no bonding');
  });

  test('version 2 holds no orders, training, receipts or request fingerprint, anywhere', function (t) {
    var b = world();
    var c = mira(b, 'wyvern', 'Stormwing', 1);
    b.beast = BR.beastState(b);
    var s = snap(b, 'Mira');
    var raw = JSON.stringify(s);
    ['"orders"', '"training"', '"receipts"', '"rev"', 'trainCreatureId', 'costGP', 'readyLabel', 'fnId', '"facility"'].forEach(function (needle) { t.equal(raw.indexOf(needle), -1, 'no ' + needle); });
    t.equal(s.receipts, undefined);
    t.equal(s.creatures[c.id].orders, undefined);
    t.equal(s.creatures[c.id].training, undefined);
    t.equal(s.creatures[c.id].rev, undefined);
    t.equal(P.pendingAt, undefined);
    t.equal(P.isPlayerOrder, undefined);
    t.equal(P.busyLabel, undefined);
    t.equal(P.homes, undefined, 'one Pen: no list of buildings for each kind');
    t.equal(window.TSI_DATA.beastPlayerOrders, undefined, 'and the data that said which orders a player may ask for is gone');
  });

  test('a Bond 0 beast is "not available": its own handler gets its name, kind, handler and bond, and nothing else; the directory line says so', function (t) {
    var b = world();
    var c = mira(b, 'griffin', 'Swiftwing', 0);
    BR.setTemperament(b, bdata, c.id, { dominant: 'SECRETDOM', regional: 'SECRETREGION' });
    BR.addChronicleNote(b, bdata, c.id, 'SECRETCHRONICLE');
    BR.ensureDev(b, c).initiation = { regional: 'dawnmantle', rolls: { dominant: 3, attachment: 4, trigger: 5 }, day: 9 };
    var s = snap(b, 'Mira');
    var d = s.creatures[c.id];
    t.equal(d.available, false);
    t.same(Object.keys(d).sort(), ['available', 'bond', 'handler', 'id', 'name', 'species']);
    ['SECRETDOM', 'SECRETREGION', 'SECRETCHRONICLE', 'dawnmantle', 'rolls'].forEach(function (n) { t.equal(JSON.stringify(s).indexOf(n), -1, 'no ' + n + ' before acclimatisation'); });
    t.same(pen(s).creatures[0].available, false);
    t.same(pen(s).creatures[0].bond, { level: 0, name: 'Unfamiliar' });
    BR.ensureDev(b, c).bond.level = 1;
    var s2 = snap(b, 'Mira');
    t.equal(s2.creatures[c.id].available, true);
    t.equal(s2.creatures[c.id].profile.dominant, 'SECRETDOM', 'from Bond 1 the detail is sent');
    t.equal(pen(s2).creatures[0].available, true);
  });

  test('the first meeting is null until the Bastion has rolled it, and is the stored result afterwards: its variety\'s id and the three die numbers, nothing else', function (t) {
    var b = world();
    var c = mira(b, 'dire_wolf', 'Ashfang', 1);
    t.equal(snap(b, 'Mira').creatures[c.id].initiation, null);
    BR.rollInitiation(b, bdata, c.id, function () { return 0.5; });
    var ini = snap(b, 'Mira').creatures[c.id].initiation;
    t.same(ini, { regional: 'blacktide', rolls: { dominant: 7, attachment: 5, trigger: 5 } });
    t.equal(snap(b, 'Mira').creatures[c.id].profile.regional, 'Blacktide');
    t.equal(JSON.stringify(ini).indexOf('day'), -1, 'the day it was made is the Bastion\'s business');
  });

  test('another handler\'s beast never gets its first meeting, profile, Chronicle or bonding; the directory line shows only that it has been acclimatised and where it is', function (t) {
    var b = world();
    var theirs = housed(b, 'wyvern', 'Stormwing');
    BR.assignHandler(b, bdata, theirs.id, 'Joss', '');
    BR.ensureDev(b, theirs).bond.level = 3;
    BR.rollInitiation(b, bdata, theirs.id, function () { return 0.2; });
    BR.addChronicleNote(b, bdata, theirs.id, 'JOSSNOTE');
    BR.takeOut(b, bdata, theirs.id, {});
    var mine = mira(b, 'griffin', 'Swiftwing', 1);
    var s = snap(b, 'Mira');
    t.same(Object.keys(s.creatures), [mine.id]);
    var raw = JSON.stringify(s);
    ['JOSSNOTE', 'bloodcrest', 'Bloodcrest', 'rolls', '"away":true', '"awaySinceLabel":"Day'].forEach(function (n) { t.equal(raw.indexOf(n), -1, 'no ' + n + ' in Mira\'s snapshot of Joss\'s beast'); });
    var line = pen(s).creatures[0];
    t.same([line.available, line.mine, line.bond.level, line.place], [true, false, 3, 'away']);
    t.ok(Object.keys(snap(b, '').creatures).length === 0 && JSON.stringify(snap(b, '')).indexOf('rolls') === -1, 'nor does a viewer with no handler');
  });

  test('one directory entry, the Beast Pen, whatever the kinds: five kinds are named by their data', function (t) {
    var b = world();
    mira(b, 'wyvern', 'Stormwing', 1);
    var s = snap(b, 'Mira');
    t.same(s.facilities.map(function (f) { return f.id; }), [PEN]);
    t.same(bdata.creatures.grantable, ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat']);
  });
}());
