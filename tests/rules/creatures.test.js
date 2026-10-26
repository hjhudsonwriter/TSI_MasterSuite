/* The creatures (pull request 7 of the facilities overhaul; Harry's answers,
   14 October 2026; the Beast Pen replaced the three buildings on 22 October
   2026): the data (tools/bastion/data/creatures-data.js and the Beast Pen in
   facilities-data.js), the Bastion's creature register and House orders
   (tools/bastion/rules.js, creature-rules.js), the link's fourth kind
   (shared/js/bridge-rules.js), the Explorer's Grant a creature
   (tools/explorer/journey.js) and the forecast (shared/js/campaign-rules.js).
   The war game (the War Table, where creatures once defended the Ironbow) was
   removed on 22 October 2026; its tests went with it. The Pen itself (one beast of each
   kind, acclimatising, going out on the road, Bonding Days, the conversion) is
   in tests/rules/beast-pen.test.js. */
(function () {
  var Bg = TSI.bridge;
  var BR = TSI.bastion.rules;
  var ER = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var T = window.TSI_DATA;
  var ED = T.explorer;
  var E = T.journeyEvents;
  var CR = T.bastionCreatures;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var KEYS = ['id', 'species', 'owner', 'name', 'status', 'home', 'grantedDay', 'housedDay', 'msgId'];
  var PEN = 'beast_pen';

  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function d6(n) { return (n - 1) / 6 + 0.01; }
  function d10(n) { return (n - 1) / 10 + 0.01; }
  function d4(n) { return (n - 1) / 4 + 0.01; }
  function roll(d20) { return { d20: d20, total: d20 }; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function reload(b, data) { return BR.fromSave(copy(BR.toSave(b)), data || bdata); }
  /* A Bastion on a day that has read the Explorer's day, at party level 9,
     with 300 gp and the given facilities built in its construction slots. */
  function bastion(day, built) {
    var b = BR.defaultState(bdata);
    b.day = day || 10;
    b.anchored = true;
    b.bridge.fresh = false;
    b.partyLevel = 9;
    b.treasuryGP = 300;
    b.builtExtras = (built || []).map(function (id) { return { facId: id, status: 'built' }; });
    BR.ensureLevels(b, bdata);
    return b;
  }
  /* House Beast Here at the Beast Pen (the first argument is only there from before the Pen: every kind lives in it). */
  function issue(b, ignored, idx) { return BR.issueOrder(b, bdata, PEN, 'house_beast', idx || 0, dice([0.3])); }
  function lastOrder(b) { return b.pendingOrders[b.pendingOrders.length - 1]; }
  function complete(b, o) {
    var lines = BR.completeSimpleOrder(b, bdata, o, dice([0.5]));
    BR.removeOrder(b, o.id);
    return lines;
  }
  function explorer(day) {
    var s = ER.defaultState(ED);
    s.travel.day = day || 5;
    return s;
  }
  function exWith(list, day) { return { travel: { day: day || 10 }, journey: { outbox: list } }; }
  /* A creature message as the Explorer sends it. */
  function grantMsg(over) {
    return Object.assign({
      id: 'grantx-0a0b0c0d:dm:0', type: 'creature', day: 5, at: '2026-10-14T10:00:00.000Z',
      from: { code: 'DM', title: 'DM award', step: 'dm' }, species: 'griffin', name: 'Swiftwing', text: 'Griffin for the Ironbow (Swiftwing).'
    }, over || {});
  }
  function standingMsg(over) {
    return Object.assign({ id: 'abc123-1a2b3c4d:won:2', type: 'standing', day: 3, at: '2026-10-13T10:00:00.000Z', from: { code: 'T4', title: 'The Knight-Errant\'s Challenge', step: 'won' }, clan: 'slade', hr: 1, text: 'Honour/Respect +1 with Clan Slade.' }, over || {});
  }
  /* A Bastion holding the granted creatures (messages applied). */
  function withGrants(b, msgs) {
    BR.applyInbox(b, bdata, exWith(msgs, b.day), 1000);
    return b;
  }
  function gid(n) { return 'grant' + n + '-0a0b0c0d:dm:0'; }
  function names(list) { return list.map(function (c) { return BR.creatureName(bdata, c); }); }
  function pen(b) {
    if (BR.builtFacilityIds(b, bdata).indexOf(PEN) === -1) b.builtExtras.push({ facId: PEN, status: 'built' });
    BR.ensureLevels(b, bdata);
    return b;
  }
  /* Elara's wyvern, as an older save holds her: housed at the Beast Pen with her handler and Bond 1 (nothing makes her any more). */
  function withWyvern(b) {
    pen(b);
    b.creatures.push({ id: 'elara_wyvern', species: 'wyvern', owner: 'elara', name: '', status: 'housed', home: PEN, grantedDay: b.day, housedDay: b.day, msgId: '', development: BR.newDevelopment({ id: 'elara_wyvern' }, b.day) });
    return b;
  }
  /* A griffin granted and housed at the Beast Pen. */
  function withGriffin(b, n, name) {
    pen(b);
    withGrants(b, [grantMsg({ id: gid(n || 1), name: name === undefined ? 'Swiftwing' : name })]);
    var res = issue(b, PEN, 0);
    if (!res.ok) throw new Error(res.message);
    complete(b, lastOrder(b));
    return b;
  }

  /* ---------------------------------------------------------------- */
  group('Creatures: the data (Harry, 14 October 2026)');

  test('the five kinds: each has a name, a plural and lives at the Beast Pen; none has War Table numbers any more (S06)', function (t) {
    t.same(Object.keys(CR.species), ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat']);
    t.same(Object.keys(CR.species).map(function (k) { var sp = CR.species[k]; return [sp.name, sp.plural, sp.home]; }), [
      ['Wyvern', 'Wyverns', 'beast_pen'], ['Griffin', 'Griffins', 'beast_pen'], ['Dire Wolf', 'Dire Wolves', 'beast_pen'], ['Buckbear', 'Buckbears', 'beast_pen'], ['Fellcat', 'Fellcats', 'beast_pen']
    ]);
    t.same(Object.keys(CR.species).filter(function (k) { return Object.keys(CR.species[k]).some(function (f) { return ['war', 'short', 'defendOnly', 'worstResult', 'woundedDays'].indexOf(f) !== -1; }); }), [], 'no war profile, token letters, or wounded days');
    t.same(['creatureWar', 'fightingCreatures', 'creatureRecovery', 'creatureStatus', 'creatureWarLine'].filter(function (k) { return k in BR; }), [], 'and none of the rules for them');
    t.same(CR.grantable, ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat'], 'the DM can grant five kinds (Harry, 22 October 2026)');
    t.same(CR.unique, { elara_wyvern: { species: 'wyvern', owner: 'elara', ownerName: 'Elara', name: '', defaultName: 'Elara\'s wyvern' } });
    t.ok(ED.heroes.some(function (h) { return h.id === 'elara' && h.title === 'Elara'; }), 'her owner is the Explorer\'s hero Elara');
    t.same([CR.pen, CR.houseDays, CR.nameMax, CR.provisional], [{ perKind: 1 }, 3, 40, true]);
    t.same([CR.acclimatise, CR.bondTotals], [{ dc: 20, skill: 'Animal Handling', retryDays: 3 }, { 2: 10, 3: 20, 4: 30, 5: 50 }], 'the DC, the lock and the Bonding Day totals');
    t.same(['room', 'roomBase', 'development', 'comingLater'].filter(function (k) { return k in CR; }), [], 'room for each level, training, harnesses and riding are gone');
  });

  test('the link knows the same kinds as the data, and its own copy (for a page without the data) matches', function (t) {
    var KINDS = ['wyvern', 'griffin', 'dire_wolf', 'buckbear', 'fellcat'];
    var NAMES = ['Wyvern', 'Griffin', 'Dire Wolf', 'Buckbear', 'Fellcat'];
    t.same(Bg.grantable(), KINDS);
    t.same(KINDS.map(function (k) { return Bg.speciesName(k); }), NAMES);
    t.same(KINDS.map(function (k) { return Bg.speciesHomeName(k); }), ['Beast Pen', 'Beast Pen', 'Beast Pen', 'Beast Pen', 'Beast Pen']);
    var keep = T.bastionCreatures;
    try {
      delete T.bastionCreatures;
      t.same(Bg.grantable(), KINDS, 'without the data file');
      t.same(KINDS.map(function (k) { return Bg.speciesName(k); }), NAMES);
      t.same(KINDS.map(function (k) { return Bg.speciesHomeName(k); }), ['Beast Pen', 'Beast Pen', 'Beast Pen', 'Beast Pen', 'Beast Pen'], 'and its own copy matches the data');
    } finally { T.bastionCreatures = keep; }
    t.equal(Bg.isGrantable('wyvern'), true);
    t.equal(Bg.isGrantable('phoenix'), false);
    t.equal(Bg.speciesName('phoenix'), 'Unknown creature');
  });

  group('Creatures: granted in the Explorer (the link\'s fourth kind)');

  test('a creature message: its fields in order, no Clan; clean() keeps it; check() accepts it', function (t) {
    var m = Bg.creatureMessage({ id: 'grantx-0a0b0c0d:dm:0', day: 5, at: 'x', from: { code: 'DM', title: 'DM award', step: 'dm' }, species: 'griffin', name: 'Swiftwing', text: 'Griffin for the Ironbow (Swiftwing).', clan: 'slade' });
    t.same(Object.keys(m), Bg.CREATURE_FIELDS);
    t.same(Bg.CREATURE_FIELDS, ['id', 'type', 'day', 'at', 'from', 'species', 'name', 'text']);
    t.equal(m.type, 'creature');
    t.same(Bg.clean(m), m);
    t.same(Bg.clean(Object.assign({ hr: 2, clan: 'x' }, m)), m, 'clean() drops what a creature hasn\'t');
    t.equal(Bg.check(m), '');
    t.equal(Bg.check(grantMsg({ name: '' })), '', 'no name is fine');
    t.equal(Bg.check(grantMsg({ species: 'dire_wolf', day: -3 })), '', 'any day');
    t.equal(Bg.check(Object.assign({ clan: 'nobody' }, grantMsg())), '', 'it never asks for a Clan');
    t.equal(Bg.waitsForNewer(m), false);
    t.equal(Bg.isParcelMessage(grantMsg({ id: 'abcdef-12345678:collect:0' })), false, 'never read as a parcel pickup');
  });

  test('check() refuses a damaged one, with a plain reason', function (t) {
    t.equal(Bg.check(grantMsg({ id: 'bad' })), 'Its id is damaged.');
    t.equal(Bg.check(grantMsg({ species: 'wyvern' })), '', 'a wyvern can be granted now');
    t.equal(Bg.check(grantMsg({ species: 'phoenix' })), 'It names a creature the DM can\'t grant (phoenix).');
    t.equal(Bg.check(grantMsg({ species: 3 })), 'It names a creature the DM can\'t grant (none).');
    t.equal(Bg.check(grantMsg({ name: new Array(42).join('x') })), 'Its name is damaged.', '41 letters');
    t.equal(Bg.check(grantMsg({ name: new Array(41).join('x') })), '', '40 letters');
    t.equal(Bg.check(grantMsg({ name: 7 })), 'Its name is damaged.');
    var noName = grantMsg();
    delete noName.name;
    t.equal(Bg.check(noName), 'Its name is damaged.');
  });

  test('J.grantCreature: everything checked first, nothing changed when refused; then one message with a new random id', function (t) {
    var s = explorer(5);
    var before = JSON.stringify(ER.toSave(s));
    t.same(J.grantCreature(s, 'griffin', { name: 'Swiftwing', memory: true }), { ok: false, message: 'This browser isn\'t saving, so the Bastion can\'t see the grant. Nothing was sent.' });
    t.same(J.grantCreature(s, 'phoenix', { name: 'Swiftwing' }), { ok: false, message: 'The DM can grant a wyvern, a griffin, a dire wolf, a buckbear or a fellcat.' });
    t.same(J.grantCreature(s, 'phoenix', {}), { ok: false, message: 'The DM can grant a wyvern, a griffin, a dire wolf, a buckbear or a fellcat.' });
    t.same(J.grantCreature(s, 'griffin', { name: new Array(42).join('x') }), { ok: false, message: 'A name is at most 40 letters.' });
    t.equal(JSON.stringify(ER.toSave(s)), before, 'nothing changed');
    var bags = JSON.stringify(s.journey.inventory || []);
    var real = Math.random;
    var calls = 0;
    Math.random = function () { calls++; return real(); };
    var r1, r2;
    try {
      r1 = J.grantCreature(s, 'griffin', { name: '  Swift   wing ', text: 'For saving the eyrie' });
      r2 = J.grantCreature(s, 'dire_wolf', {});
    } finally { Math.random = real; }
    t.equal(calls, 0, 'the dice are never asked');
    t.same([r1.ok, r1.line], [true, 'Sent to the Bastion: a griffin (Swift wing) for the Ironbow, to be housed at the Beast Pen.']);
    t.equal(r2.line, 'Sent to the Bastion: a dire wolf for the Ironbow, to be housed at the Beast Pen.');
    var out = s.journey.outbox;
    t.equal(out.length, 2);
    t.equal(JSON.stringify(s.journey.inventory || []), bags, 'nothing goes into the Travel bags');
    t.ok(r1.id !== r2.id, 'two grants never share an id');
    t.ok(/^[a-z0-9]+-[0-9a-f]{8}:dm:0$/.test(r1.id), r1.id);
    t.same(Object.keys(out[0]), Bg.CREATURE_FIELDS);
    t.same([out[0].id, out[0].type, out[0].day, out[0].from, out[0].species, out[0].name, out[0].text], [r1.id, 'creature', 5, { code: 'DM', title: 'DM award', step: 'dm' }, 'griffin', 'Swift wing', 'Griffin for the Ironbow (Swift wing): For saving the eyrie.']);
    t.same([out[1].species, out[1].name, out[1].text], ['dire_wolf', '', 'Dire Wolf for the Ironbow.']);
    t.equal(Bg.check(out[0]), '');
    t.equal(Bg.check(out[1]), '');
    var back = ER.fromSave(copy(ER.toSave(s)), ED, E);
    t.same(back.journey.outbox, out, 'the Explorer keeps them as they are when it reloads');
  });

  test('Reset Travel in the Explorer moves a waiting grant\'s day (to before Day 1 too); it is still accepted and held once', function (t) {
    var s = explorer(12);
    J.grantCreature(s, 'griffin', { name: '' });
    s.travel.day = 14;
    ER.resetTravel(s);
    var m = s.journey.outbox[0];
    t.equal(m.day, -1);
    t.equal(Bg.check(m), '');
    var b = bastion(1);
    t.equal(BR.applyInbox(b, bdata, exWith([m], 1), 1000).creatures.length, 1);
    t.same([b.creatures[0].grantedDay, BR.creatureName(bdata, b.creatures[0])], [-1, 'Griffin (granted before Day 1)']);
    t.equal(BR.applyInbox(b, bdata, exWith([m], 1), 2000).changed, false);
  });

  test('the Bastion holds it once, waiting for a home, with its receipt in the same state; a reload or a campaign file adds nothing', function (t) {
    var b = bastion(10);
    var hr = copy(b.honourRespectByClan);
    var m = grantMsg();
    b.dayInProgress = { day: 10, stage: 'trade', skipped: [], attackRolled: false, news: [] };
    var r = BR.applyInbox(b, bdata, exWith([m]), 1000);
    var notice = 'From the Explorer: a griffin (Swiftwing) for the Ironbow, waiting for a home at the Beast Pen.';
    t.same([r.creatures, r.applied, r.charters, r.parcels, r.refused], [[notice], [], [], [], 0]);
    t.same(b.dayInProgress.news, [notice], 'in "The Ironbow sends word…" when a day is passing');
    t.same(b.creatures, [{ id: 'cr-grantx-0a0b0c0d-dm-0', species: 'griffin', owner: '', name: 'Swiftwing', status: 'waiting', home: '', grantedDay: 5, housedDay: null, msgId: m.id }]);
    t.equal(BR.creatureIdFor(m.id), 'cr-grantx-0a0b0c0d-dm-0');
    t.same(b.bridge.done[m.id], { r: 'applied', day: 10, at: 1000, clan: '', hr: 0, was: 0, now: 0, text: m.text, why: '', type: 'creature', species: 'griffin', name: 'Swiftwing', creatureId: 'cr-grantx-0a0b0c0d-dm-0', held: false });
    t.equal(b.log[0].body, 'Creature granted (DM, Day 5): a griffin (Swiftwing), waiting for a home at the Beast Pen. Griffin for the Ironbow (Swiftwing).');
    t.same(b.honourRespectByClan, hr, 'never Honour/Respect');
    t.equal(BR.applyInbox(b, bdata, exWith([m]), 2000).changed, false, 'a second look changes nothing');
    t.equal(Bg.statusOf(m, copy(BR.toSave(b))).line, 'Applied on Day 10: the Bastion holds the griffin (Swiftwing); house it at the Beast Pen.');
    var housedSave = copy(BR.toSave(b));
    housedSave.creatures[0].status = 'housed';
    housedSave.creatures[0].home = 'beast_pen';
    t.equal(Bg.statusOf(m, housedSave).line, 'Applied on Day 10: the Bastion holds the griffin (Swiftwing); it lives at the Ironbow now.', 'once housed, the Explorer stops saying "house it"');
    var back = reload(b);
    t.same(back.bridge.done[m.id], b.bridge.done[m.id], 'the receipt reloads, kind and all');
    t.same(Object.keys(back.bridge.done[m.id]).slice(9), ['type', 'species', 'name', 'creatureId', 'held']);
    t.equal(BR.applyInbox(back, bdata, exWith([m]), 3000).changed, false, 'nor after a reload');
    var BK = TSI.backupRules;
    var file = BK.parse(JSON.stringify(BK.makeCampaignBackup([
      TSI.storeRules.makeRecord('tsi.explorer.save', exWith([m]), new Date()),
      TSI.storeRules.makeRecord('tsi.bastion.state', BR.toSave(back), new Date())
    ], new Date(), 'suite')));
    t.ok(file.ok);
    t.equal(BR.importProblem(file.backup.records), null, 'the campaign file imports');
    var restored = BR.fromSave(file.backup.records[1].value, bdata);
    t.same(restored.creatures, back.creatures);
    t.equal(BR.applyInbox(restored, bdata, exWith([m]), 4000).changed, false, 'nor from a campaign file');
    t.equal(restored.creatures.length, 1);
    /* With no name: "a dire wolf". */
    var wolf = grantMsg({ id: gid(2), species: 'dire_wolf', name: '' });
    var r2 = BR.applyInbox(b, bdata, exWith([m, wolf]), 5000);
    t.same(r2.creatures, ['From the Explorer: a dire wolf for the Ironbow, waiting for a home at the Beast Pen.']);
    t.equal(BR.creatureName(bdata, BR.creatureById(b, BR.creatureIdFor(wolf.id))), 'Dire Wolf (granted Day 5)');
    t.equal(Bg.statusOf(wolf, copy(BR.toSave(b))).line, 'Applied on Day 10: the Bastion holds the dire wolf; house it at the Beast Pen.');
    t.equal(BR.creatureReceiptHead(bdata, b.bridge.done[m.id]), 'Creature granted: Griffin (Swiftwing)', 'Clan Influence\'s label');
    t.equal(BR.creatureReceiptHead(bdata, b.bridge.done[wolf.id]), 'Creature granted: Dire Wolf');
  });

  test('a record already made from the message (a receipt lost) is never made twice', function (t) {
    var b = bastion(10);
    var m = grantMsg();
    BR.applyInbox(b, bdata, exWith([m]), 1000);
    delete b.bridge.done[m.id];
    var r = BR.applyInbox(b, bdata, exWith([m]), 2000);
    t.same([r.creatures, b.creatures.length, b.bridge.done[m.id].held], [[], 1, true]);
    t.equal(b.log[0].body, 'Creature granted (DM, Day 5): the Bastion already holds a griffin (Swiftwing), so nothing changed. Griffin for the Ironbow (Swiftwing).');
    t.equal(Bg.statusOf(m, copy(BR.toSave(b))).line, 'Applied on Day 10: the Bastion already held the griffin (Swiftwing), so nothing changed.');
  });

  test('a copy without the creature rules leaves the grant waiting, with no receipt; an older copy (that doesn\'t know the kind) waits too', function (t) {
    var b = bastion(10);
    var m = grantMsg();
    var keep = BR.addCreatureGrant;
    try {
      delete BR.addCreatureGrant;
      var r = BR.applyInbox(b, bdata, exWith([m, standingMsg()]), 1000);
      t.equal(Object.prototype.hasOwnProperty.call(b.bridge.done, m.id), false);
      t.equal(r.applied.length, 1, 'the changes after it still apply');
      t.same(b.creatures, []);
    } finally { BR.addCreatureGrant = keep; }
    t.equal(Bg.statusOf(m, copy(BR.toSave(b))).kind, 'waiting');
    t.equal(BR.applyInbox(b, bdata, exWith([m, standingMsg()]), 2000).creatures.length, 1, 'then a copy with them applies it');
    /* An older copy of the suite: 'creature' isn't one of its kinds. */
    var types = Bg.TYPES;
    var c = bastion(10);
    try {
      Bg.TYPES = ['standing', 'charter', 'parcel_collected'];
      t.equal(Bg.waitsForNewer(m), true, 'an older copy keeps it waiting');
      t.equal(BR.applyInbox(c, bdata, exWith([m]), 1000).changed, false);
      t.equal(Bg.statusOf(m, copy(BR.toSave(c))).line, 'Waiting for a newer copy of the Bastion (this copy doesn\'t know this kind of change).');
      t.same(Bg.clean(m), m, 'and keeps its fields when it saves');
    } finally { Bg.TYPES = types; }
    t.same(c.bridge.done, {});
    t.equal(Bg.waitsForNewer({ id: 'newer1-0a0b0c0d:dm:0', type: 'courier', day: 4 }), true, 'a kind this copy doesn\'t know still waits');
  });

  test('a Bastion starting from nothing skips a grant sent before it, and counts it apart', function (t) {
    var b = BR.defaultState(bdata);
    BR.anchor(b, 12);
    var m = grantMsg();
    var r = BR.applyInbox(b, bdata, exWith([m, standingMsg(), grantMsg({ id: gid(2), species: 'dire_wolf' })]), 1000);
    t.equal(r.skipped, 3);
    t.same(b.log.map(function (l) { return l.body; }), [
      '2 creature grants, sent before this Bastion started, were skipped, so nothing counts twice. Grant them again in the Explorer if they should count.',
      '1 change to Honour/Respect, sent before this Bastion started, was skipped, so nothing counts twice. Use Change a score in the DM doc if it should count.'
    ]);
    t.same([b.bridge.done[m.id].r, b.bridge.done[m.id].type, b.bridge.done[m.id].species, b.bridge.done[m.id].name], ['skipped', 'creature', 'griffin', 'Swiftwing']);
    t.same(b.creatures, []);
    t.equal(Bg.statusOf(m, copy(BR.toSave(b))).line, 'Skipped: sent before this Bastion started. Grant it again if it should count.');
    t.equal(BR.creatureReceiptHead(bdata, b.bridge.done[m.id]), 'Skipped: creature granted, Griffin (Swiftwing)');
    var one = BR.defaultState(bdata);
    BR.anchor(one, 12);
    BR.applyInbox(one, bdata, exWith([m]), 1000);
    t.same(one.log.map(function (l) { return l.body; }), ['1 creature grant, sent before this Bastion started, was skipped, so nothing counts twice. Grant it again in the Explorer if it should count.']);
  });

  test('a damaged grant is refused, with its receipt, and nothing is held', function (t) {
    var b = bastion(10);
    var m = grantMsg({ species: 'phoenix' });
    var r = BR.applyInbox(b, bdata, exWith([m]), 1000);
    t.same([r.refused, r.creatures, b.creatures], [1, [], []]);
    t.same([b.bridge.done[m.id].r, b.bridge.done[m.id].type, b.bridge.done[m.id].why], ['refused', 'creature', 'It names a creature the DM can\'t grant (phoenix).']);
    t.equal(Bg.statusOf(m, copy(BR.toSave(b))).line, 'Refused: It names a creature the DM can\'t grant (phoenix). Nothing changed.');
  });

  test('a grant dated after the Bastion\'s day waits; a Bastion that hasn\'t read the Explorer\'s day does nothing', function (t) {
    var b = bastion(4);
    var m = grantMsg({ day: 5 });
    t.equal(BR.applyInbox(b, bdata, exWith([m]), 1000).changed, false);
    t.equal(Bg.statusOf(m, copy(BR.toSave(b))).line, 'Waiting for the Bastion to reach Day 5.');
    b.day = 5;
    t.equal(BR.applyInbox(b, bdata, exWith([m]), 1000).creatures.length, 1);
    var c = bastion(10);
    c.anchored = false;
    t.equal(BR.applyInbox(c, bdata, exWith([m]), 1000).changed, false);
  });

  /* ---------------------------------------------------------------- */
  group('Creatures: the Beast Pen');

  test('the Explorer grants any of the five kinds like any other creature: one message, a Day Log line, held once, waiting for the Beast Pen', function (t) {
    var s = explorer(5);
    var r = J.grantCreature(s, 'wyvern', { name: 'Stormtalon' });
    t.equal(r.ok, true, r.message);
    t.equal(r.line, 'Sent to the Bastion: a wyvern (Stormtalon) for the Ironbow, to be housed at the Beast Pen.');
    var m = s.journey.outbox[s.journey.outbox.length - 1];
    var b = bastion(10, ['beast_pen']);
    var res = BR.applyInbox(b, bdata, { travel: { day: 10 }, journey: { outbox: [m] } }, 1000);
    t.same([res.creatures.length, BR.creatures(b).length], [1, 1]);
    t.same([BR.creatures(b)[0].species, BR.creatures(b)[0].status], ['wyvern', 'waiting']);
    BR.applyInbox(b, bdata, { travel: { day: 10 }, journey: { outbox: [m] } }, 2000);
    t.equal(BR.creatures(b).length, 1, 'held once');
    ['buckbear', 'fellcat'].forEach(function (kind) {
      var r2 = J.grantCreature(s, kind, { name: 'Bramble' });
      t.equal(r2.ok, true, kind + ': ' + r2.message);
      t.equal(r2.line, 'Sent to the Bastion: ' + (/^[aeiou]/.test(kind) ? 'an ' : 'a ') + kind + ' (Bramble) for the Ironbow, to be housed at the Beast Pen.');
      var m2 = s.journey.outbox[s.journey.outbox.length - 1];
      t.equal(Bg.check(m2), '', kind + ' passes the link\'s check');
      BR.applyInbox(b, bdata, { travel: { day: 10 }, journey: { outbox: [m2] } }, 3000);
    });
    t.same(BR.creatures(b).map(function (c) { return [c.species, c.status]; }), [['wyvern', 'waiting'], ['buckbear', 'waiting'], ['fellcat', 'waiting']], 'the two new kinds are held too, waiting for a home');
  });

  /* ---------------------------------------------------------------- */
  group('Creatures: the save');

  test('a Bastion saved before pull request 7 loads with no creatures, the same twice', function (t) {
    var s = copy(BR.toSave(bastion(10, ['hall_of_emissaries'])));
    delete s.creatures;
    var b = BR.fromSave(s, bdata);
    t.same(b.creatures, []);
    t.same(Object.keys(BR.toSave(b)), Object.keys(BR.defaultState(bdata)), 'creatures in its place');
    t.equal(JSON.stringify(BR.toSave(reload(b))), JSON.stringify(BR.toSave(b)));
    t.equal(BR.saveProblem(s), null);
  });

  test('loading twice gives the same save, fields in a fixed order; duplicates collapse to the first; an unknown kind is kept', function (t) {
    var b = withWyvern(bastion(10));
    withGriffin(b, 1, 'Swiftwing');
    withGrants(b, [grantMsg({ id: gid(2), species: 'dire_wolf', name: '' })]);
    var once = reload(b);
    once.creatures.forEach(function (c) { t.same(Object.keys(c), c.id === 'elara_wyvern' ? KEYS.concat(['development']) : KEYS, c.id); });
    t.equal(JSON.stringify(BR.toSave(reload(once))), JSON.stringify(BR.toSave(once)), 'the same JSON twice');
    var list = [
      { msgId: 'x', name: 'Out of order', status: 'waiting', grantedDay: 3, species: 'griffin', id: 'a1', owner: '', home: '', housedDay: null },
      { id: 'a1', species: 'dire_wolf', name: 'Second copy' },
      { id: 'p1', species: 'phoenix', name: 'Cinder', status: 'housed', home: 'phoenix_perch', grantedDay: 2, housedDay: 4 },
      { id: 'h1', species: 'griffin', home: 'beast_pen', grantedDay: 1e9, housedDay: 'x' },
      { id: 'w1', species: 'griffin', status: 'lost?', name: new Array(60).join('n') },
      { species: 'griffin' }, { id: '' }, 'junk', null
    ];
    var out = BR.cleanCreatures(list, 10);
    t.same(out, [
      { id: 'a1', species: 'griffin', owner: '', name: 'Out of order', status: 'waiting', home: '', grantedDay: 3, housedDay: null, msgId: 'x' },
      { id: 'p1', species: 'phoenix', owner: '', name: 'Cinder', status: 'housed', home: 'phoenix_perch', grantedDay: 2, housedDay: 4, msgId: '' },
      { id: 'h1', species: 'griffin', owner: '', name: '', status: 'housed', home: 'beast_pen', grantedDay: 100000, housedDay: 100000, msgId: '' },
      { id: 'w1', species: 'griffin', owner: '', name: new Array(41).join('n'), status: 'waiting', home: '', grantedDay: 10, housedDay: null, msgId: '' }
    ]);
    t.same(BR.cleanCreatures(out, 10), out, 'the same twice');
    t.same([BR.speciesName(bdata, 'phoenix'), BR.creatureName(bdata, { id: 'p2', species: 'phoenix', grantedDay: 4 })], ['Unknown creature', 'Unknown creature (granted Day 4)'], 'shown as unknown');
    t.same(BR.cleanCreatures('nope', 10), []);
  });

  test('a damaged creatures list is refused on Import, here and from the Explorer', function (t) {
    var s = copy(BR.toSave(bastion(10)));
    s.creatures = { elara_wyvern: true };
    t.equal(BR.saveProblem(s), 'Its creatures list is damaged.');
    var records = [TSI.storeRules.makeRecord('tsi.bastion.state', s, new Date())];
    t.equal(BR.importProblem(records), 'This file\'s Bastion isn\'t in the right form, so it wasn\'t imported. Its creatures list is damaged. Nothing was changed.');
    t.equal(TSI.importChecks.bastion(records), BR.importProblem(records), 'the check the Explorer uses');
    s.creatures = [];
    t.equal(BR.saveProblem(s), null);
  });

  test('Reset Travel moves when each was granted and housed', function (t) {
    var b = withWyvern(bastion(10));
    withGrants(b, [grantMsg({ id: gid(2), name: 'Talon' })]);
    BR.shiftDays(b, -4);
    t.same(b.creatures.map(function (c) { return [c.grantedDay, c.housedDay]; }), [[6, 6], [1, null]], 'housed on Day 10, granted on Day 5');
    t.same(Object.keys(b.creatures[1]), KEYS);
  });

  test('receipts keep a creature grant\'s fields when tidied, the same twice', function (t) {
    var src = { fresh: false, done: { 'g:dm:0': { held: 'yes', creatureId: 'cr-g', name: 'Swiftwing', species: 'griffin', type: 'creature', why: '', r: 'applied', day: 4, at: 5 } } };
    var once = BR.cleanBridge(src);
    t.same(once.done['g:dm:0'], { r: 'applied', day: 4, at: 5, clan: '', hr: 0, was: 0, now: 0, text: '', why: '', type: 'creature', species: 'griffin', name: 'Swiftwing', creatureId: 'cr-g', held: false });
    t.same(BR.cleanBridge(once), once);
  });

  /* ---------------------------------------------------------------- */
  group('Creatures: the forecast and the DM doc');

  test('a House order "is complete" (never a roll)', function (t) {
    var b = bastion(10, ['beast_pen']);
    withGrants(b, [grantMsg(), grantMsg({ id: gid(2), species: 'wyvern', name: 'Stormtalon' })]);
    issue(b, PEN);
    issue(b, PEN);
    var coming = TSI.campaign.bastionComing(copy(BR.toSave(b)));
    function has(day, kind, line) { return coming.some(function (x) { return x.day === day && x.kind === kind && x.line === line; }); }
    t.ok(has(13, 'order', 'Beast Pen: House Beast Here (Swiftwing) is complete.'), JSON.stringify(coming));
    t.ok(has(13, 'order', 'Beast Pen: House Beast Here (Stormtalon) is complete.'));
    /* A version 3 save read before the conversion: the three old buildings' House orders still count (the conversion moves them), their training orders do not (it cancels them). */
    var old = copy(BR.toSave(b));
    old.v = 3;
    old.pendingOrders = [
      { id: 'h1', facId: 'wyvern_roost', fnId: 'house_wyvern', label: 'Wyvern Roost: House a Wyvern (Stormtalon)', dueDay: 13 },
      { id: 'h2', facId: 'griffin_tower', fnId: 'house_griffin', label: 'Griffin Tower: House a Griffin (Swiftwing)', dueDay: 14 },
      { id: 'h3', facId: 'dire_wolf_den', fnId: 'dwf_riding_harness', label: 'Dire Wolf Den: Commission Riding Harness (Ashfang)', dueDay: 15 }
    ];
    var oldComing = TSI.campaign.bastionComing(old).filter(function (x) { return x.kind === 'order'; }).map(function (x) { return x.line; });
    t.same(oldComing, ['Wyvern Roost: House a Wyvern (Stormtalon) is complete.', 'Griffin Tower: House a Griffin (Swiftwing) is complete.']);
    /* The forecast follows the conversion exactly: the four House orders are moved, every other order at the three buildings is cancelled. */
    [['wyvern_roost', 'house_elara_wyvern'], ['wyvern_roost', 'house_wyvern'], ['griffin_tower', 'house_griffin'], ['dire_wolf_den', 'house_dire_wolf']].forEach(function (p) {
      t.equal(TSI.campaign.cancelledByConversion({ id: 'x', facId: p[0], fnId: p[1] }), false, p[1] + ' is moved, not cancelled');
    });
    ['dwf_riding_harness', 'house_unknown', 'train_wyvern'].forEach(function (fnId) {
      t.equal(TSI.campaign.cancelledByConversion({ id: 'x', facId: 'wyvern_roost', fnId: fnId }), true, fnId + ' is cancelled');
    });
    t.equal(TSI.campaign.cancelledByConversion({ id: 'x', facId: 'griffin_tower', fnId: 'house_griffin', meta: { kind: 'upgrade' } }), true, 'an Upgrade order is cancelled');
    t.equal(coming.filter(function (x) { return x.kind === 'recovery'; }).length, 0, 'no creature is ever "fit to fight again": the war game is gone');
    t.equal(coming.filter(function (x) { return x.kind === 'roll'; }).length, 0);
  });

  test('renaming a creature (Harry, 18 October 2026): any creature, Elara\'s wyvern too; empty gives the usual name back; a waiting House order follows', function (t) {
    var b = withWyvern(bastion(10, ['beast_pen']));
    t.equal(BR.creatureName(bdata, BR.creatureById(b, 'elara_wyvern')), 'Elara\'s wyvern');
    var r = BR.renameCreature(b, bdata, 'elara_wyvern', '  Ashwing   the Bold ');
    t.same([r.ok, r.changed, BR.creatureName(bdata, BR.creatureById(b, 'elara_wyvern'))], [true, true, 'Ashwing the Bold']);
    t.same([BR.renameCreature(b, bdata, 'elara_wyvern', 'Ashwing the Bold').changed], [false], 'the same name changes nothing');
    BR.renameCreature(b, bdata, 'elara_wyvern', '');
    t.equal(BR.creatureName(bdata, BR.creatureById(b, 'elara_wyvern')), 'Elara\'s wyvern', 'empty gives the usual name back');
    t.equal(BR.renameCreature(b, bdata, 'cr-nothing', 'X').ok, false, 'a creature that isn\'t there is refused');
    var long = new Array(100).join('a');
    BR.renameCreature(b, bdata, 'elara_wyvern', long);
    t.equal(BR.creatureById(b, 'elara_wyvern').name.length, BR.creatureNameMax(bdata), 'cut to the longest name');
    BR.renameCreature(b, bdata, 'elara_wyvern', 'Ashwing');
    var g = bastion(10, ['beast_pen']);
    withGrants(g, [grantMsg({ id: gid(1), name: 'Swiftwing' })]);
    var res = issue(g, PEN);
    t.ok(res.ok, res.message);
    var o = lastOrder(g);
    t.ok(/Swiftwing/.test(o.label));
    BR.renameCreature(g, bdata, o.chosen.creatureId, 'Stormcrest');
    t.ok(/\(Stormcrest\)/.test(o.label) && o.optionLabel === 'Stormcrest', 'the waiting order follows: ' + o.label);
    complete(g, o);
    t.equal(BR.creatureName(bdata, BR.creatureById(g, o.chosen.creatureId)), 'Stormcrest');
    var back = reload(b);
    t.equal(BR.creatureName(bdata, BR.creatureById(back, 'elara_wyvern')), 'Ashwing');
    t.same(reload(back).creatures, back.creatures, 'loading twice changes nothing');
  });
}());
