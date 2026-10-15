/* The creatures (pull request 7 of the facilities overhaul; Harry's answers,
   14 October 2026): the data (tools/bastion/data/creatures-data.js and the
   three buildings in facilities-data.js), the Bastion's creature register
   and House orders (tools/bastion/rules.js, creature-rules.js), the link's
   fourth kind (shared/js/bridge-rules.js), the Explorer's Grant a creature
   (tools/explorer/journey.js), the War Table (war-campaign-rules.js) and the
   forecast (shared/js/campaign-rules.js). */
(function () {
  var Bg = TSI.bridge;
  var BR = TSI.bastion.rules;
  var ER = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var T = window.TSI_DATA;
  var ED = T.explorer;
  var E = T.journeyEvents;
  var CR = T.bastionCreatures;
  var W = T.bastionWar;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var KEYS = ['id', 'species', 'owner', 'name', 'status', 'home', 'grantedDay', 'housedDay', 'msgId'];
  var FAC = { wyvern_roost: 'house_elara_wyvern', griffin_tower: 'house_griffin', dire_wolf_den: 'house_dire_wolf' };

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
  function issue(b, facId, idx) { return BR.issueOrder(b, bdata, facId, FAC[facId], idx || 0, dice([0.3])); }
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
  /* Elara's wyvern housed at a built Roost. */
  function withWyvern(b) {
    if (BR.builtFacilityIds(b, bdata).indexOf('wyvern_roost') === -1) b.builtExtras.push({ facId: 'wyvern_roost', status: 'built' });
    BR.ensureLevels(b, bdata);
    var res = issue(b, 'wyvern_roost');
    if (!res.ok) throw new Error(res.message);
    complete(b, lastOrder(b));
    return b;
  }
  /* A griffin granted and housed at a built Griffin Tower. */
  function withGriffin(b, n, name) {
    if (BR.builtFacilityIds(b, bdata).indexOf('griffin_tower') === -1) b.builtExtras.push({ facId: 'griffin_tower', status: 'built' });
    BR.ensureLevels(b, bdata);
    withGrants(b, [grantMsg({ id: gid(n || 1), name: name === undefined ? 'Swiftwing' : name })]);
    var res = issue(b, 'griffin_tower');
    if (!res.ok) throw new Error(res.message);
    complete(b, lastOrder(b));
    return b;
  }
  /* A Clan at war with the Bastion attacks it on its day: the Defend
     Bastion action, with its three rolls made (all passed). */
  function defence(b, clan) {
    b.wars = b.wars || {};
    b.wars[clan || 'bacca'] = { since: b.day - 1, last: b.day - 1, next: b.day + 6 };
    var ma = BR.beginDefence(b, bdata, clan || 'bacca', dice([d6(1)]), 0);
    BR.militaryRoll(b, bdata, ma.id, 'weather', roll(15), dice([0]));
    BR.militaryRoll(b, bdata, ma.id, 'morale', roll(15), dice([0]));
    BR.militaryRoll(b, bdata, ma.id, 'luck', roll(12), dice([0]));
    return ma;
  }
  /* A finished battle in the battle rules' saved shape, from the action's
     line-up; set: { unitId: { status, cohesion } }. */
  function battleFrom(ma, outcome, set) {
    function unit(u, side) {
      var x = copy(u);
      x.side = side; x.support = null; x.leaderId = null;
      x.cohesionMax = u.profile.cohesion; x.cohesion = u.profile.cohesion; x.status = 'steady';
      x.pos = null; x.startPos = null; x.activated = false; x.holding = false; x.carrying = null; x.heldFast = false; x.everHalf = false;
      return x;
    }
    var units = ma.spec.player.units.map(function (u) { return unit(u, 'player'); });
    ma.spec.enemy.units.forEach(function (u) { units.push(unit(u, 'enemy')); });
    Object.keys(set || {}).forEach(function (id) { units.forEach(function (u) { if (u.id === id) Object.assign(u, set[id]); }); });
    return {
      v: 2, phase: 'over', cols: 22, rows: 14, strip: [6, 7],
      objective: { id: ma.objective, markers: [], zone: null, held: { player: 0, enemy: 0 }, extracted: 0 },
      conditions: ma.spec.conditions, round: 6, maxRounds: 6, firstSide: 'player', turnSide: 'player', started: true,
      units: units, leaders: [], log: [], startBV: { player: 20, enemy: 18 },
      result: { outcome: outcome, reason: 'The battle is decided', round: 6, lostPct: { player: 40, enemy: 20 }, extracted: 0, broken: { player: true, enemy: false } }
    };
  }
  function creatureUnits(ma) { return ma.spec.player.units.filter(function (u) { return u.source && u.source.creature; }); }

  /* ---------------------------------------------------------------- */
  group('Creatures: the data (Harry, 14 October 2026)');

  test('the three kinds: Harry\'s War Table numbers exactly; the dire wolf is the War Table\'s Dire Wolf; each defends only, and is at worst badly wounded for 21 days', function (t) {
    function nums(w) { return [w.cohesion, w.attack, w.defence, w.move, w.resolve, w.bv, w.trait]; }
    t.same(Object.keys(CR.species), ['wyvern', 'griffin', 'dire_wolf']);
    t.same(nums(CR.species.wyvern.war), [7, 6, 13, 6, 2, 11, 'flight'], 'the wyvern (Q3)');
    t.same(nums(CR.species.griffin.war), [5, 5, 12, 6, 1, 8, 'flight'], 'the griffin (Q5)');
    t.same(nums(CR.species.dire_wolf.war), [5, 5, 12, 5, 1, 7, 'pack'], 'the dire wolf (Q5)');
    t.same(nums(CR.species.dire_wolf.war), nums(W.beasts['Dire Wolf']), 'the same as the War Table\'s Dire Wolf');
    t.equal(CR.species.dire_wolf.war.distinction, W.beasts['Dire Wolf'].distinction);
    t.same(Object.keys(CR.species).map(function (k) { var sp = CR.species[k]; return [sp.name, sp.plural, sp.home, sp.defendOnly, sp.worstResult, sp.woundedDays, !!W.traits[sp.war.trait], !!sp.war.distinction]; }), [
      ['Wyvern', 'Wyverns', 'wyvern_roost', true, 'badly_wounded', 21, true, true],
      ['Griffin', 'Griffins', 'griffin_tower', true, 'badly_wounded', 21, true, true],
      ['Dire Wolf', 'Dire Wolves', 'dire_wolf_den', true, 'badly_wounded', 21, true, true]
    ]);
    t.same(CR.grantable, ['griffin', 'dire_wolf'], 'the wyvern is never granted');
    t.same(CR.unique, { elara_wyvern: { species: 'wyvern', owner: 'elara', ownerName: 'Elara', name: '', defaultName: 'Elara\'s wyvern' } });
    t.ok(ED.heroes.some(function (h) { return h.id === 'elara' && h.title === 'Elara'; }), 'her owner is the Explorer\'s hero Elara');
    t.same([CR.room, CR.houseDays, CR.nameMax, CR.provisional], [{ griffin_tower: 1, dire_wolf_den: 1 }, 3, 40, true]);
    t.ok(/Care, training, bonding, riding and breeding/.test(CR.comingLater));
    t.equal(W.beasts.Wyvern, undefined, 'the War Table\'s own file is unchanged: no wyvern or griffin in it');
    t.equal(W.beasts.Griffin, undefined);
  });

  test('the link knows the same kinds as the data, and its own copy (for a page without the data) matches', function (t) {
    t.same(Bg.grantable(), ['griffin', 'dire_wolf']);
    t.same([Bg.speciesName('griffin'), Bg.speciesName('dire_wolf'), Bg.speciesHomeName('griffin'), Bg.speciesHomeName('dire_wolf')], ['Griffin', 'Dire Wolf', 'Griffin Tower', 'Dire Wolf Den']);
    var keep = T.bastionCreatures;
    try {
      delete T.bastionCreatures;
      t.same(Bg.grantable(), ['griffin', 'dire_wolf'], 'without the data file');
      t.same([Bg.speciesName('griffin'), Bg.speciesName('dire_wolf'), Bg.speciesHomeName('griffin'), Bg.speciesHomeName('dire_wolf')], ['Griffin', 'Dire Wolf', 'Griffin Tower', 'Dire Wolf Den']);
    } finally { T.bastionCreatures = keep; }
    t.equal(Bg.isGrantable('wyvern'), false);
    t.equal(Bg.speciesName('phoenix'), 'Unknown creature');
  });

  test('the Wyvern Roost, Griffin Tower and Dire Wolf Den: buildable in a construction slot from party level 5, in 21 days, each with one Level 1 House order of 3 days and no gold', function (t) {
    ['wyvern_roost', 'griffin_tower', 'dire_wolf_den'].forEach(function (id) {
      var f = BR.facility(bdata, id);
      t.same([f.requiredLevel, f.inDevelopment, f.plot, typeof f.description], [5, undefined, undefined, 'string'], id);
      t.equal(f.functions.length, 1, id + ': one order');
      var fn = f.functions[0];
      t.same([fn.id, fn.days, fn.costGP, fn.costText, fn.requiredFacilityLevel, fn.options, fn.production], [FAC[id], CR.houseDays, 0, '0', undefined, [], undefined], id);
      t.equal(BR.isPlotFacility(bdata, id), false, id + ' takes a construction slot');
    });
    t.same(BR.facility(bdata, 'wyvern_roost').functions[0].label, 'House Elara\'s Wyvern');
    t.same(BR.facility(bdata, 'wyvern_roost').functions[0].housesCreature, 'elara_wyvern');
    t.same([BR.facility(bdata, 'griffin_tower').functions[0].label, BR.facility(bdata, 'griffin_tower').functions[0].housesSpecies], ['House a Griffin', 'griffin']);
    t.same([BR.facility(bdata, 'dire_wolf_den').functions[0].label, BR.facility(bdata, 'dire_wolf_den').functions[0].housesSpecies], ['House a Dire Wolf', 'dire_wolf']);
    t.equal(BR.buildDaysForRequiredLevel(5, bdata), 21);
    var b = bastion(10);
    b.partyLevel = 4;
    t.equal(BR.startBuild(b, bdata, 0, 'wyvern_roost').message, 'Locked. Wyvern Roost requires party level 5.');
    b.partyLevel = 5;
    t.equal(BR.startBuild(b, bdata, 0, 'griffin_tower', 'plot').message, 'The Griffin Tower is built in a construction slot, not on a Development Plot.');
    var r = BR.startBuild(b, bdata, 0, 'wyvern_roost', 'slot');
    t.same(r.log, ['Construction Started', 'Wyvern Roost is under construction (21 days: ready on Day 31).']);
    t.ok(BR.startBuild(b, bdata, 1, 'dire_wolf_den').ok);
    t.same(b.creatures, [], 'building one never creates an animal');
    b.day = 31;
    t.same(BR.completeConstruction(b), ['wyvern_roost', 'dire_wolf_den']);
    t.same(b.creatures, [], 'nor does finishing it');
    t.equal(BR.compendiumIndex(bdata.facilities, bdata.tools).items.length, 270, 'the House orders add nothing to the Compendium');
  });

  /* ---------------------------------------------------------------- */
  group('Creatures: House Elara\'s Wyvern');

  test('refused while the Roost isn\'t built or is Under Repair, and as a second order while one is pending', function (t) {
    var b = bastion(10);
    t.same(issue(b, 'wyvern_roost'), { ok: false, message: 'The Wyvern Roost isn\'t built yet.' });
    b.builtExtras = [{ facId: 'wyvern_roost', status: 'building', startDay: 1, readyDay: 22 }];
    t.equal(issue(b, 'wyvern_roost').message, 'The Wyvern Roost isn\'t built yet.', 'nor while it\'s being built');
    b = bastion(10, ['wyvern_roost']);
    b.repairs = { wyvern_roost: 12 };
    t.same(issue(b, 'wyvern_roost'), { ok: false, message: 'The Wyvern Roost is Under Repair until Day 12.' });
    b.repairs = {};
    var gp = b.treasuryGP;
    var r = issue(b, 'wyvern_roost');
    t.same(r, { ok: true, log: ['Order Issued', 'Wyvern Roost: House Elara\'s Wyvern (3 days: due Day 13).'] });
    var o = lastOrder(b);
    t.same([o.facId, o.fnId, o.chosen, o.optionLabel, o.label, o.costGP, o.dueDay], ['wyvern_roost', 'house_elara_wyvern', { creatureId: 'elara_wyvern' }, null, 'Wyvern Roost: House Elara\'s Wyvern', 0, 13]);
    t.equal(b.treasuryGP, gp, 'no gold');
    t.same(issue(b, 'wyvern_roost'), { ok: false, message: 'Elara\'s wyvern is already being housed at the Wyvern Roost: ready on Day 13.' });
    t.same(b.creatures, [], 'nothing until it completes');
  });

  test('completes once: her existing wyvern, owned by Elara, housed at the Roost; never a second, whatever is replayed or reloaded', function (t) {
    var b = bastion(10, ['wyvern_roost']);
    issue(b, 'wyvern_roost');
    var o = lastOrder(b);
    b.day = 13;
    t.same(BR.dueOrders(b).map(function (x) { return x.id; }), [o.id]);
    var lines = BR.completeSimpleOrder(b, bdata, o, dice([0.5]));
    t.same(lines, [['Order Completed', 'Wyvern Roost: House Elara\'s Wyvern → Elara\'s wyvern lives at the Ironbow now, at the Wyvern Roost (Elara\'s). It guards the Ironbow when it is attacked.']]);
    t.same(b.creatures, [{ id: 'elara_wyvern', species: 'wyvern', owner: 'elara', name: '', status: 'housed', home: 'wyvern_roost', grantedDay: 13, housedDay: 13, msgId: '' }]);
    t.same(Object.keys(b.creatures[0]), KEYS);
    t.same(BR.completeSimpleOrder(b, bdata, o, dice([0.5])), [['Creatures', 'Wyvern Roost: House Elara\'s Wyvern: Elara\'s wyvern already lives at the Ironbow, so nothing changed.']], 'a replay changes nothing');
    BR.removeOrder(b, o.id);
    t.equal(b.creatures.length, 1);
    t.same(issue(b, 'wyvern_roost'), { ok: false, message: 'Elara\'s wyvern already lives at the Ironbow.' });
    var back = reload(b);
    t.same(back.creatures, b.creatures);
    t.equal(issue(back, 'wyvern_roost').message, 'Elara\'s wyvern already lives at the Ironbow.', 'nor after a reload');
    t.same([BR.creatureName(bdata, b.creatures[0]), BR.creatureOwnerName(bdata, b.creatures[0])], ['Elara\'s wyvern', 'Elara']);
    var named = Object.assign({}, bdata, { creatures: copy(CR) });
    named.creatures.unique.elara_wyvern.name = 'Ember';
    t.equal(BR.creatureName(named, b.creatures[0]), 'Ember', 'the name Harry gives in the data shows everywhere');
  });

  test('Under Repair: the order waits; Cancel gives nothing back and it can be given again', function (t) {
    var b = bastion(10, ['wyvern_roost']);
    issue(b, 'wyvern_roost');
    var o = lastOrder(b);
    b.day = 13;
    b.repairs = { wyvern_roost: 14 };
    t.same(BR.dueOrders(b), [], 'it waits while the Roost is Under Repair');
    b.day = 15;
    t.same(BR.dueOrders(b).map(function (x) { return x.id; }), [o.id]);
    var gp = b.treasuryGP;
    t.same(BR.cancelOrder(b, o.id, bdata, 0), ['Orders', 'Cancelled an order.']);
    t.same([b.treasuryGP, b.creatures, b.pendingOrders], [gp, [], []]);
    t.ok(issue(b, 'wyvern_roost').ok, 'given again');
  });

  test('Demolish: the wyvern stays at the Ironbow, still guarding; the question says so; rebuilding houses nobody twice', function (t) {
    var b = withWyvern(bastion(10, ['griffin_tower']));
    t.equal(BR.creatureStatus(b, bdata, b.creatures[0]).line, 'Guarding the Ironbow.');
    t.equal(BR.creatureDemolishNote(b, bdata, 'wyvern_roost'), 'Elara\'s wyvern stays at the Ironbow, still guarding it; rebuilding the Wyvern Roost gives it a home again.');
    t.ok(BR.demolishFacility(b, bdata, 'wyvern_roost').ok);
    t.same([b.creatures.length, b.creatures[0].status, b.creatures[0].home], [1, 'housed', 'wyvern_roost']);
    t.equal(BR.creatureStatus(b, bdata, b.creatures[0]).line, 'Guarding the Ironbow (the Wyvern Roost isn\'t standing: rebuilding it gives it a home again).');
    t.same(BR.warForces(b, bdata).creatures, ['elara_wyvern'], 'it still defends the Ironbow');
    b.builtExtras.push({ facId: 'wyvern_roost', status: 'built' });
    BR.ensureLevels(b, bdata);
    t.equal(BR.creatureStatus(b, bdata, b.creatures[0]).line, 'Guarding the Ironbow.', 'home again');
    t.equal(issue(b, 'wyvern_roost').message, 'Elara\'s wyvern already lives at the Ironbow.');
    t.equal(b.creatures.length, 1);
    /* A House order still waiting is cancelled by Demolish. */
    var c = bastion(10, ['wyvern_roost']);
    issue(c, 'wyvern_roost');
    t.equal(BR.creatureDemolishNote(c, bdata, 'wyvern_roost'), 'Wyvern Roost: House Elara\'s Wyvern is cancelled.');
    var res = BR.demolishFacility(c, bdata, 'wyvern_roost');
    t.same([res.cancelled.length, c.pendingOrders, c.creatures], [1, [], []]);
    t.equal(BR.creatureDemolishNote(c, bdata, 'wyvern_roost'), '', 'nothing to say once it\'s gone');
  });

  /* ---------------------------------------------------------------- */
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
    t.equal(Bg.check(grantMsg({ species: 'wyvern' })), 'It names a creature the DM can\'t grant (wyvern).', 'never a wyvern');
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
    t.same(J.grantCreature(s, 'wyvern', { name: 'Swiftwing' }), { ok: false, message: 'The DM can grant a griffin or a dire wolf.' });
    t.same(J.grantCreature(s, 'phoenix', {}), { ok: false, message: 'The DM can grant a griffin or a dire wolf.' });
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
    t.same([r1.ok, r1.line], [true, 'Sent to the Bastion: a griffin (Swift wing) for the Ironbow, to be housed at the Griffin Tower.']);
    t.equal(r2.line, 'Sent to the Bastion: a dire wolf for the Ironbow, to be housed at the Dire Wolf Den.');
    var out = s.journey.outbox;
    t.equal(out.length, 2);
    t.equal(JSON.stringify(s.journey.inventory || []), bags, 'nothing goes into the Party bags');
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
    var notice = 'From the Explorer: a griffin (Swiftwing) for the Ironbow, waiting for a home at the Griffin Tower.';
    t.same([r.creatures, r.applied, r.charters, r.parcels, r.refused], [[notice], [], [], [], 0]);
    t.same(b.dayInProgress.news, [notice], 'in "The Ironbow sends word…" when a day is passing');
    t.same(b.creatures, [{ id: 'cr-grantx-0a0b0c0d-dm-0', species: 'griffin', owner: '', name: 'Swiftwing', status: 'waiting', home: '', grantedDay: 5, housedDay: null, msgId: m.id }]);
    t.equal(BR.creatureIdFor(m.id), 'cr-grantx-0a0b0c0d-dm-0');
    t.same(b.bridge.done[m.id], { r: 'applied', day: 10, at: 1000, clan: '', hr: 0, was: 0, now: 0, text: m.text, why: '', type: 'creature', species: 'griffin', name: 'Swiftwing', creatureId: 'cr-grantx-0a0b0c0d-dm-0', held: false });
    t.equal(b.log[0].body, 'Creature granted (DM, Day 5): a griffin (Swiftwing), waiting for a home at the Griffin Tower. Griffin for the Ironbow (Swiftwing).');
    t.same(b.honourRespectByClan, hr, 'never Honour/Respect');
    t.equal(BR.applyInbox(b, bdata, exWith([m]), 2000).changed, false, 'a second look changes nothing');
    t.equal(Bg.statusOf(m, copy(BR.toSave(b))).line, 'Applied on Day 10: the Bastion holds the griffin (Swiftwing); house it at the Griffin Tower.');
    var housedSave = copy(BR.toSave(b));
    housedSave.creatures[0].status = 'housed';
    housedSave.creatures[0].home = 'griffin_tower';
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
    t.same(r2.creatures, ['From the Explorer: a dire wolf for the Ironbow, waiting for a home at the Dire Wolf Den.']);
    t.equal(BR.creatureName(bdata, BR.creatureById(b, BR.creatureIdFor(wolf.id))), 'Dire Wolf (granted Day 5)');
    t.equal(Bg.statusOf(wolf, copy(BR.toSave(b))).line, 'Applied on Day 10: the Bastion holds the dire wolf; house it at the Dire Wolf Den.');
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
      '2 creature grants, sent before this Bastion started, were skipped, so nothing counts twice. Clan Influence lists them: grant them again in the Explorer if they should count.',
      '1 change to Honour/Respect, sent before this Bastion started, was skipped, so nothing counts twice. Clan Influence lists it, to type in by hand if it should count.'
    ]);
    t.same([b.bridge.done[m.id].r, b.bridge.done[m.id].type, b.bridge.done[m.id].species, b.bridge.done[m.id].name], ['skipped', 'creature', 'griffin', 'Swiftwing']);
    t.same(b.creatures, []);
    t.equal(Bg.statusOf(m, copy(BR.toSave(b))).line, 'Skipped: sent before this Bastion started. Grant it again if it should count.');
    t.equal(BR.creatureReceiptHead(bdata, b.bridge.done[m.id]), 'Skipped: creature granted, Griffin (Swiftwing)');
    var one = BR.defaultState(bdata);
    BR.anchor(one, 12);
    BR.applyInbox(one, bdata, exWith([m]), 1000);
    t.same(one.log.map(function (l) { return l.body; }), ['1 creature grant, sent before this Bastion started, was skipped, so nothing counts twice. Clan Influence lists it: grant it again in the Explorer if it should count.']);
  });

  test('a damaged grant is refused, with its receipt, and nothing is held', function (t) {
    var b = bastion(10);
    var m = grantMsg({ species: 'wyvern' });
    var r = BR.applyInbox(b, bdata, exWith([m]), 1000);
    t.same([r.refused, r.creatures, b.creatures], [1, [], []]);
    t.same([b.bridge.done[m.id].r, b.bridge.done[m.id].type, b.bridge.done[m.id].why], ['refused', 'creature', 'It names a creature the DM can\'t grant (wyvern).']);
    t.equal(Bg.statusOf(m, copy(BR.toSave(b))).line, 'Refused: It names a creature the DM can\'t grant (wyvern). Nothing changed.');
    t.equal(BR.creatureReceiptHead(bdata, b.bridge.done[m.id]), 'Refused: creature granted, Wyvern (Swiftwing)');
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
  group('Creatures: the Griffin Tower and the Dire Wolf Den');

  test('no griffin waiting: refused, and the list is empty', function (t) {
    var b = bastion(10, ['griffin_tower']);
    var fac = BR.facility(bdata, 'griffin_tower');
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[0]), []);
    t.same(issue(b, 'griffin_tower'), { ok: false, message: 'No griffin is waiting for a home. The DM grants one in the Explorer.' });
    withGrants(b, [grantMsg({ species: 'dire_wolf' })]);
    t.equal(issue(b, 'griffin_tower').message, 'No griffin is waiting for a home. The DM grants one in the Explorer.', 'a dire wolf isn\'t a griffin');
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[0]), []);
    var c = bastion(10);
    withGrants(c, [grantMsg()]);
    t.equal(issue(c, 'griffin_tower').message, 'The Griffin Tower isn\'t built yet.');
  });

  test('House a Griffin: the DM picks which waiting griffin; the order keeps it, and it can\'t be chosen again', function (t) {
    var b = bastion(10, ['griffin_tower']);
    b.facilityLevels.griffin_tower = 3;
    withGrants(b, [grantMsg({ id: gid(1), name: 'Swiftwing' }), grantMsg({ id: gid(2), name: 'Talon' }), grantMsg({ id: gid(3), name: '' })]);
    var fac = BR.facility(bdata, 'griffin_tower');
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[0]), [
      { label: 'Swiftwing', creatureId: BR.creatureIdFor(gid(1)) },
      { label: 'Talon', creatureId: BR.creatureIdFor(gid(2)) },
      { label: 'Griffin (granted Day 5)', creatureId: BR.creatureIdFor(gid(3)) }
    ]);
    var gp = b.treasuryGP;
    var r = issue(b, 'griffin_tower', 1);
    t.same(r, { ok: true, log: ['Order Issued', 'Griffin Tower: House a Griffin (Talon) (3 days: due Day 13).'] });
    var o = lastOrder(b);
    t.same([o.chosen, o.optionLabel, o.label, o.costGP, b.treasuryGP], [{ label: 'Talon', creatureId: BR.creatureIdFor(gid(2)) }, 'Talon', 'Griffin Tower: House a Griffin (Talon)', 0, gp]);
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[0]).map(function (x) { return x.label; }), ['Swiftwing', 'Griffin (granted Day 5)'], 'Talon is held by the order');
    t.equal(BR.creatureStatus(b, bdata, BR.creatureById(b, BR.creatureIdFor(gid(2)))).line, 'Being housed at the Griffin Tower: ready on Day 13.');
    t.equal(issue(b, 'griffin_tower').message, 'The Griffin Tower houses one griffin at a time: Talon is ready on Day 13.');
    t.same(BR.creatureRoom(b, bdata, 'griffin_tower'), { level: 3, perLevel: 1, capacity: 3, housed: 0, pending: 1, free: 2, over: 0 }, 'the pending order counts towards room');
    b.day = 13;
    t.same(complete(b, o), [['Order Completed', 'Griffin Tower: House a Griffin (Talon) → Talon has a home at the Griffin Tower. It guards the Ironbow when it is attacked.']]);
    var talon = BR.creatureById(b, BR.creatureIdFor(gid(2)));
    t.same([talon.status, talon.home, talon.housedDay, talon.grantedDay], ['housed', 'griffin_tower', 13, 5]);
    t.same(Object.keys(talon), KEYS);
    t.same(BR.completeSimpleOrder(b, bdata, o, dice([0.5])), [['Creatures', 'Griffin Tower: House a Griffin (Talon): Talon already has a home at the Griffin Tower, so nothing changed.']], 'completed once');
    t.ok(issue(b, 'griffin_tower', 1).ok, 'the unnamed one');
    t.equal(lastOrder(b).label, 'Griffin Tower: House a Griffin (granted Day 5)');
    t.same(BR.creatureRoom(b, bdata, 'griffin_tower'), { level: 3, perLevel: 1, capacity: 3, housed: 1, pending: 1, free: 1, over: 0 });
  });

  test('one per level: a Level 1 Tower houses 1, and a second waits for room until an Upgrade; at Level 5 it\'s full at 5', function (t) {
    var b = withGriffin(bastion(10), 1, 'Swiftwing');
    withGrants(b, [grantMsg({ id: gid(2), name: 'Talon' })]);
    t.same(BR.creatureRoom(b, bdata, 'griffin_tower'), { level: 1, perLevel: 1, capacity: 1, housed: 1, pending: 0, free: 0, over: 0 });
    t.same(issue(b, 'griffin_tower'), { ok: false, message: 'No room: a Level 1 Griffin Tower houses 1 griffin; upgrade it to house more.' });
    t.equal(BR.creatureStatus(b, bdata, BR.creatureById(b, BR.creatureIdFor(gid(2)))).line, 'Waiting for a home at the Griffin Tower.');
    var up = BR.issueUpgrade(b, bdata, 'griffin_tower', dice([0.3]));
    t.ok(up.ok, 'Upgrade works as at every facility');
    b.day = b.day + 7;
    BR.completeSimpleOrder(b, bdata, lastOrder(b), dice([0.5]));
    BR.removeOrder(b, lastOrder(b).id);
    t.equal(BR.getFacilityLevel(b, 'griffin_tower'), 2);
    t.ok(issue(b, 'griffin_tower').ok, 'room at Level 2');
    b.facilityLevels.griffin_tower = 5;
    b.creatures.push({ id: 'g3', species: 'griffin', owner: '', name: 'C', status: 'housed', home: 'griffin_tower', grantedDay: 5, housedDay: 6, msgId: '' });
    b.creatures.push({ id: 'g4', species: 'griffin', owner: '', name: 'D', status: 'housed', home: 'griffin_tower', grantedDay: 5, housedDay: 6, msgId: '' });
    b.creatures.push({ id: 'g5', species: 'griffin', owner: '', name: 'E', status: 'housed', home: 'griffin_tower', grantedDay: 5, housedDay: 6, msgId: '' });
    complete(b, lastOrder(b));
    withGrants(b, [grantMsg({ id: gid(6), name: 'F' })]);
    t.same(issue(b, 'griffin_tower').message, 'No room: a Level 5 Griffin Tower houses 5 griffins, its most.');
  });

  test('the Dire Wolf Den works the same way; a griffin is never housed there', function (t) {
    var b = bastion(10, ['dire_wolf_den', 'griffin_tower']);
    withGrants(b, [grantMsg({ id: gid(1), species: 'dire_wolf', name: 'Greymane' }), grantMsg({ id: gid(2), species: 'griffin', name: 'Swiftwing' })]);
    var fac = BR.facility(bdata, 'dire_wolf_den');
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[0]).map(function (x) { return x.label; }), ['Greymane']);
    t.same(issue(b, 'dire_wolf_den').log, ['Order Issued', 'Dire Wolf Den: House a Dire Wolf (Greymane) (3 days: due Day 13).']);
    var o = lastOrder(b);
    /* An order made by hand for the griffin (a damaged save) houses nobody. */
    var forced = copy(o);
    forced.id = 'forced';
    forced.chosen = { label: 'Swiftwing', creatureId: BR.creatureIdFor(gid(2)) };
    t.same(BR.completeSimpleOrder(b, bdata, forced, dice([0.5])), [['Creatures', 'Dire Wolf Den: House a Dire Wolf (Greymane): Swiftwing isn\'t a dire wolf, so nothing changed.']]);
    t.equal(BR.creatureById(b, BR.creatureIdFor(gid(2))).status, 'waiting');
    complete(b, o);
    t.same(BR.housedAt(b, 'dire_wolf_den').map(function (c) { return c.name; }), ['Greymane']);
    withGrants(b, [grantMsg({ id: gid(3), species: 'dire_wolf', name: 'Ash' })]);
    t.equal(issue(b, 'dire_wolf_den').message, 'No room: a Level 1 Dire Wolf Den houses 1 dire wolf; upgrade it to house more.');
    var at = BR.creaturesAt(b, bdata, 'dire_wolf_den');
    t.same([names(at.housed), names(at.waiting), at.room.capacity], [['Greymane'], ['Ash'], 1]);
    t.same(names(BR.creaturesAt(b, bdata, 'griffin_tower').waiting), ['Swiftwing']);
  });

  test('a creature gone by the time its order completes (a save from another moment): a line in the log, and nothing changes', function (t) {
    var b = bastion(10, ['griffin_tower']);
    withGrants(b, [grantMsg()]);
    issue(b, 'griffin_tower');
    var o = lastOrder(b);
    b.creatures = [];
    t.same(complete(b, o), [['Creatures', 'Griffin Tower: House a Griffin (Swiftwing): that griffin isn\'t held any more, so nothing changed.']]);
    t.same(b.creatures, []);
  });

  test('Under Repair waits; Cancel gives nothing back and the griffin keeps waiting', function (t) {
    var b = bastion(10, ['griffin_tower']);
    withGrants(b, [grantMsg()]);
    b.repairs = { griffin_tower: 11 };
    t.equal(issue(b, 'griffin_tower').message, 'The Griffin Tower is Under Repair until Day 11.');
    b.repairs = {};
    issue(b, 'griffin_tower');
    var o = lastOrder(b);
    b.repairs = { griffin_tower: 14 };
    b.day = 13;
    t.same(BR.dueOrders(b), [], 'it waits');
    var gp = b.treasuryGP;
    BR.cancelOrder(b, o.id, bdata, 0);
    t.same([b.treasuryGP, b.creatures[0].status, b.pendingOrders], [gp, 'waiting', []]);
    var fac = BR.facility(bdata, 'griffin_tower');
    t.same(BR.fnOptions(b, bdata, fac, fac.functions[0]).map(function (x) { return x.label; }), ['Swiftwing'], 'back on the list');
  });

  test('Demolish: housed griffins stay, still guarding; a waiting order is cancelled and its griffin keeps waiting; a rebuilt Level 1 Tower is over room, so new housing waits', function (t) {
    var b = withGriffin(bastion(10), 1, 'Swiftwing');
    b.facilityLevels.griffin_tower = 3;
    withGrants(b, [grantMsg({ id: gid(2), name: 'Talon' }), grantMsg({ id: gid(3), name: 'Ash' })]);
    complete(b, (issue(b, 'griffin_tower'), lastOrder(b)));
    issue(b, 'griffin_tower');
    t.equal(BR.creatureDemolishNote(b, bdata, 'griffin_tower'), 'The 2 creatures living here stay at the Ironbow, still guarding it; rebuilding the Griffin Tower gives them a home again. Griffin Tower: House a Griffin (Ash) is cancelled: Ash keeps waiting for a home.');
    var res = BR.demolishFacility(b, bdata, 'griffin_tower');
    t.same([res.ok, res.cancelled.length, b.pendingOrders.length], [true, 1, 0]);
    t.same(b.creatures.map(function (c) { return [c.name, c.status, c.home]; }), [['Swiftwing', 'housed', 'griffin_tower'], ['Talon', 'housed', 'griffin_tower'], ['Ash', 'waiting', '']]);
    t.same(BR.warForces(b, bdata).creatures.length, 2, 'both still defend the Ironbow');
    b.builtExtras.push({ facId: 'griffin_tower', status: 'built' });
    BR.ensureLevels(b, bdata);
    t.same(BR.creatureRoom(b, bdata, 'griffin_tower'), { level: 1, perLevel: 1, capacity: 1, housed: 2, pending: 0, free: 0, over: 1 }, 'rebuilt at Level 1: both stay');
    t.equal(issue(b, 'griffin_tower').message, 'No room: a Level 1 Griffin Tower houses 1 griffin; upgrade it to house more.');
    t.equal(b.creatures.length, 3, 'nobody added twice');
  });

  test('the Menagerie is unchanged: its beasts, R.beastQty and the War Council\'s lock never count a creature', function (t) {
    var b = bastion(10);
    t.equal(BR.warCouncilOpen(b), false);
    withWyvern(b);
    withGriffin(b, 1);
    t.same([BR.beastQty(b), b.defenderBeasts, BR.warCouncilOpen(b)], [0, [], false], 'creatures alone never open the lock');
    t.same(BR.warForces(b, bdata).beasts, {});
    b.defenderBeasts = [{ name: 'Dire Wolf', qty: 2, source: 'Menagerie' }];
    withGrants(b, [grantMsg({ id: gid(5), species: 'dire_wolf', name: 'Greymane' })]);
    t.same([BR.beastQty(b), BR.warForces(b, bdata).beasts, BR.warCouncilOpen(b)], [2, { 'Dire Wolf': 2 }, true]);
    var menagerie = BR.facility(bdata, 'menagerie');
    t.same([menagerie.requiredLevel, menagerie.functions.length, menagerie.functions[0].options.length], [13, 1, 13]);
  });

  /* ---------------------------------------------------------------- */
  group('Creatures: defending the Ironbow on the War Table');

  test('Defend Bastion: every housed creature defends, one unit each with its own name, profile and trait; a waiting one doesn\'t', function (t) {
    var b = withWyvern(bastion(10));
    withGriffin(b, 1, 'Swiftwing');
    withGrants(b, [grantMsg({ id: gid(2), species: 'dire_wolf', name: 'Greymane' })]);
    b.defenders = { count: 20, armed: true, patrolUntil: 0 };
    t.same(BR.warForces(b, bdata).creatures, ['elara_wyvern', BR.creatureIdFor(gid(1))]);
    var ma = defence(b);
    t.same(ma.commit, { defenders: 20, lieutenants: 0, units: {}, beasts: {}, creatures: ['elara_wyvern', BR.creatureIdFor(gid(1))] });
    t.equal(ma.undefended, false);
    var units = creatureUnits(ma);
    t.same(units.map(function (u) { return [u.id, u.kind, u.type, u.name, u.label, u.traits, u.profile]; }), [
      ['p-creature-1', 'beast', 'beast', 'Elara\'s wyvern', 'Elara\'s wyvern', ['flight'], { cohesion: 7, attack: 6, defence: 13, move: 6, resolve: 2, bv: 11 }],
      ['p-creature-2', 'beast', 'beast', 'Swiftwing', 'Swiftwing', ['flight'], { cohesion: 5, attack: 5, defence: 12, move: 6, resolve: 1, bv: 8 }]
    ]);
    t.same(units[0].source, { key: 'creature-elara_wyvern', creature: 'elara_wyvern', species: 'wyvern', beast: 'Elara\'s wyvern' });
    t.equal(BR.sideBV(bdata, { units: units }), 19);
    t.equal(b.log[0].body.indexOf('Defending it: 20 defenders, Elara\'s wyvern, Swiftwing.') !== -1, true, b.log[0].body);
    t.same(BR.warForces(b, bdata).creatures, [], 'the waiting defence holds them');
    /* A second Clan attacking while the first waits finds them held. */
    b.wars.karr = { since: 9, last: 9, next: 16 };
    var second = BR.beginDefence(b, bdata, 'karr', dice([d6(1)]), 0);
    t.equal(second.commit.creatures, undefined, 'a second waiting defence doesn\'t get the same creatures');
    t.equal(second.undefended, true);
    t.equal(BR.creatureStatus(b, bdata, b.creatures[0]).line, 'Defending the Ironbow against an attack.');
  });

  test('never sent on a War Action: the form never takes a creature, and the Military list is unchanged', function (t) {
    var b = withWyvern(bastion(10));
    b.organization = { type: 'clan', name: 'Clan Ironbow', chief: '', motto: '', foundedAtDay: 1 };
    b.defenders = { count: 20, armed: true, patrolUntil: 0 };
    t.same(BR.warCommit2(b, bdata, { defenders: 5, creatures: ['elara_wyvern'], beasts: { 'elara_wyvern': 1, 'Wyvern': 1 } }), { defenders: 5, lieutenants: 0, units: {}, beasts: {} });
    t.same(BR.warAvailable(b, bdata), { defenders: 20, beasts: 0, lieutenants: 0, regiments: 0, fullWar: true });
    var order = BR.queueWarAction2(b, bdata, { targetKey: 'bacca', objective: 'raid', tier: 'small', commit: { defenders: 5, creatures: ['elara_wyvern'] } });
    t.same(order.meta.commit.creatures, undefined, 'the War Action carries none');
    var ma = BR.beginMilitaryAction(b, bdata, order, dice([0.5]), 0);
    t.same([ma.commit.creatures, creatureUnits(ma)], [undefined, []]);
    t.same(BR.warForces(b, bdata).creatures, ['elara_wyvern'], 'it stays home, free to defend');
  });

  test('a defeat never kills or captures a creature: at worst badly wounded for 21 days; it stays on the register', function (t) {
    var b = withWyvern(bastion(10));
    withGriffin(b, 1, 'Swiftwing');
    withGrants(b, [grantMsg({ id: gid(2), species: 'dire_wolf', name: 'Greymane' })]);
    b.builtExtras.push({ facId: 'dire_wolf_den', status: 'built' });
    BR.ensureLevels(b, bdata);
    complete(b, (issue(b, 'dire_wolf_den'), lastOrder(b)));
    b.defenders = { count: 0, armed: false, patrolUntil: 0 };
    var ma = defence(b);
    t.equal(creatureUnits(ma).length, 3);
    var before = copy(b.creatures);
    var battle = battleFrom(ma, 'defeat', {
      'p-creature-1': { status: 'defeated', cohesion: 0 },
      'p-creature-2': { status: 'defeated', cohesion: 0 },
      'p-creature-3': { status: 'routed' }
    });
    /* d6 1 (killed) and 2 (captured: the enemy holds the field) for the two defeated; then the loss's d10 and d4. */
    var res = BR.finishBattle(b, bdata, ma.id, battle, dice([d6(1), d6(2), d10(1), d4(1), 0]), 0);
    t.same(b.creatures, before, 'nobody removed');
    t.same(b.warRecovery.map(function (r) { return [r.kind, r.name, r.status, r.untilDay, r.creatureId]; }), [
      ['creature', 'Elara\'s wyvern', 'badly_wounded', 31, 'elara_wyvern'],
      ['creature', 'Swiftwing', 'badly_wounded', 31, BR.creatureIdFor(gid(1))],
      ['creature', 'Greymane', 'separated', 17, BR.creatureIdFor(gid(2))]
    ]);
    t.same(Object.keys(b.warRecovery[0]), ['id', 'kind', 'name', 'status', 'untilDay', 'creatureId']);
    t.ok(res.lines.indexOf('Elara\'s wyvern: badly wounded (d6 1: a creature is never killed), back on Day 31.') !== -1, res.lines.join(' | '));
    t.ok(res.lines.indexOf('Swiftwing: badly wounded (d6 2: a creature is never captured), back on Day 31.') !== -1, res.lines.join(' | '));
    t.ok(res.lines.indexOf('Greymane: separated from the army, back on Day 17.') !== -1, res.lines.join(' | '));
    t.equal(res.report.subtitle, 'Defending the Bastion: Elara\'s wyvern, Swiftwing, Greymane');
    t.same([BR.beastQty(b), b.defenderBeasts], [0, []], 'the Menagerie untouched');
    t.same(BR.warForces(b, bdata).creatures, [], 'recovering, so not free');
    t.equal(BR.creatureStatus(b, bdata, b.creatures[0]).line, 'Badly wounded: fit again on Day 31.');
    t.equal(BR.creatureStatus(b, bdata, BR.creatureById(b, BR.creatureIdFor(gid(2)))).line, 'Separated from the army: fit again on Day 17.');
    /* The recovery records survive a reload, and Reset Travel moves them. */
    var back = reload(b);
    t.same(back.warRecovery, b.warRecovery);
    t.equal(JSON.stringify(BR.toSave(reload(back))), JSON.stringify(BR.toSave(back)), 'the same twice');
    BR.shiftDays(back, -5);
    t.same(back.warRecovery.map(function (r) { return r.untilDay; }), [26, 26, 12]);
    /* Back on its day, with its own words. */
    b.day = 16;
    BR.startDay(b, bdata, 0);
    t.equal(b.log[0].body, 'Greymane has found the way back to the Bastion.');
    b.day = 30;
    BR.startDay(b, bdata, 0);
    t.same(b.log.filter(function (l) { return l.title === 'War Recovery'; }).slice(0, 2).map(function (l) { return l.body; }).sort(), ['Elara\'s wyvern is fit to fight again.', 'Swiftwing is fit to fight again.']);
    t.same(BR.warForces(b, bdata).creatures.length, 3, 'all three free again');
  });

  test('a lesser d6: wounded or recovering as any beast; a won defence hurts nobody', function (t) {
    var b = withWyvern(bastion(10));
    var ma = defence(b);
    BR.finishBattle(b, bdata, ma.id, battleFrom(ma, 'defeat', { 'p-creature-1': { status: 'defeated', cohesion: 0 } }), dice([d6(4), d10(1), d4(1), 0]), 0);
    t.same(b.warRecovery.map(function (r) { return [r.status, r.untilDay]; }), [['wounded', 24]]);
    var c = withWyvern(bastion(10));
    var mc = defence(c);
    BR.finishBattle(c, bdata, mc.id, battleFrom(mc, 'victory', {}), dice([0.5]), 0);
    t.same([c.warRecovery, c.creatures.length], [[], 1]);
  });

  test('a Menagerie Dire Wolf and a granted dire wolf never share a count or a recovery', function (t) {
    var b = bastion(10, ['dire_wolf_den']);
    withGrants(b, [grantMsg({ id: gid(1), species: 'dire_wolf', name: 'Greymane' })]);
    complete(b, (issue(b, 'dire_wolf_den'), lastOrder(b)));
    b.defenderBeasts = [{ name: 'Dire Wolf', qty: 1, source: 'Menagerie' }];
    var ma = defence(b);
    t.same([ma.commit.beasts, ma.commit.creatures], [{ 'Dire Wolf': 1 }, [BR.creatureIdFor(gid(1))]]);
    var beast = ma.spec.player.units.filter(function (u) { return !u.source.creature; })[0];
    var wolf = creatureUnits(ma)[0];
    t.same([beast.name, wolf.name, beast.profile, wolf.profile], ['Dire Wolf', 'Greymane', wolf.profile, beast.profile], 'the same numbers, two different animals');
    /* The Menagerie's is killed (d6 1); the granted one, also on a 1, is badly wounded. */
    BR.finishBattle(b, bdata, ma.id, battleFrom(ma, 'defeat', { 'p-beast-1': { status: 'defeated' }, 'p-creature-1': { status: 'defeated' } }), dice([d6(1), d6(1), d10(1), d4(1), 0]), 0);
    t.same([b.defenderBeasts, b.creatures.length, b.warRecovery.map(function (r) { return [r.kind, r.name, r.status]; })], [[], 1, [['creature', 'Greymane', 'badly_wounded']]]);
  });

  test('a creature alone still defends (the Ironbow isn\'t undefended); the withdraw warning says it can\'t be killed', function (t) {
    var b = withWyvern(bastion(10));
    var ma = defence(b);
    t.same([ma.undefended, ma.commit.creatures, ma.commit.defenders], [false, ['elara_wyvern'], 0]);
    var pre = BR.withdrawPreview(b, bdata, ma.id, battleFrom(ma, 'withdrawal', { 'p-creature-1': { status: 'defeated' } }));
    t.ok(pre.indexOf('A d6 for Elara\'s wyvern: badly wounded, wounded or recovering (a creature is never killed or captured).') !== -1, pre.join(' | '));
  });

  test('a waiting defence keeps its creatures through a reload, the same JSON twice', function (t) {
    var b = withWyvern(bastion(10));
    var ma = defence(b);
    var back = reload(b);
    t.same(back.militaryActions[0].commit, ma.commit);
    t.same(creatureUnits(back.militaryActions[0]).length, 1);
    t.equal(JSON.stringify(BR.toSave(reload(back))), JSON.stringify(BR.toSave(back)));
    t.same(BR.warForces(back, bdata).creatures, [], 'still held');
    var noSpec = copy(BR.toSave(b));
    noSpec.militaryActions[0].spec = null;
    t.same(creatureUnits(BR.fromSave(noSpec, bdata).militaryActions[0]).map(function (u) { return u.name; }), ['Elara\'s wyvern'], 'a line-up rebuilt on loading has it too');
  });

  test('the stat block: its name, its kind\'s numbers and trait; and the War Table line', function (t) {
    var b = withWyvern(bastion(10));
    var block = BR.creatureStatBlock(b, bdata, 'elara_wyvern');
    t.equal(block.title, 'Elara\'s wyvern');
    t.same(block.rows.map(function (r) { return [r.key, r.value]; }), [['cohesion', '7'], ['attack', '+6'], ['defence', '13'], ['move', '6'], ['resolve', '+2'], ['bv', '11']]);
    t.same(block.traits.map(function (x) { return x.name; }), ['Flight']);
    t.equal(block.distinction, CR.species.wyvern.war.distinction);
    t.equal(BR.creatureWarLine(bdata, b.creatures[0]), 'Defends the Ironbow: Battle Value 11, Flight');
    t.equal(BR.creatureStatBlock(b, bdata, 'nobody'), null);
    var wolf = { id: 'w', species: 'dire_wolf', owner: '', name: 'Ash', status: 'housed', home: 'dire_wolf_den', grantedDay: 1, housedDay: 1, msgId: '' };
    t.equal(BR.creatureWarLine(bdata, wolf), 'Defends the Ironbow: Battle Value 7, Pack');
  });

  test('with no creature data at all, no creature fights (never the default beast)', function (t) {
    var b = withWyvern(bastion(10));
    var keep = T.bastionCreatures;
    var bare = Object.assign({}, bdata);
    delete bare.creatures;
    try {
      delete T.bastionCreatures;
      t.same(BR.warForces(b, bare).creatures, []);
      b.wars = { bacca: { since: 9, last: 9, next: 16 } };
      var ma = BR.beginDefence(b, bare, 'bacca', dice([d6(1)]), 0);
      t.same([ma.undefended, creatureUnits(ma)], [true, []]);
    } finally { T.bastionCreatures = keep; }
    t.equal(b.creatures.length, 1, 'still on the register');
  });

  /* ---------------------------------------------------------------- */
  group('Creatures: the save');

  test('a Bastion saved before pull request 7 loads with no creatures, the same twice', function (t) {
    var s = copy(BR.toSave(bastion(10, ['library_scriptorium'])));
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
    once.creatures.forEach(function (c) { t.same(Object.keys(c), KEYS, c.id); });
    t.equal(JSON.stringify(BR.toSave(reload(once))), JSON.stringify(BR.toSave(once)), 'the same JSON twice');
    var list = [
      { msgId: 'x', name: 'Out of order', status: 'waiting', grantedDay: 3, species: 'griffin', id: 'a1', owner: '', home: '', housedDay: null },
      { id: 'a1', species: 'dire_wolf', name: 'Second copy' },
      { id: 'p1', species: 'phoenix', name: 'Cinder', status: 'housed', home: 'phoenix_perch', grantedDay: 2, housedDay: 4 },
      { id: 'h1', species: 'griffin', home: 'griffin_tower', grantedDay: 1e9, housedDay: 'x' },
      { id: 'w1', species: 'griffin', status: 'lost?', name: new Array(60).join('n') },
      { species: 'griffin' }, { id: '' }, 'junk', null
    ];
    var out = BR.cleanCreatures(list, 10);
    t.same(out, [
      { id: 'a1', species: 'griffin', owner: '', name: 'Out of order', status: 'waiting', home: '', grantedDay: 3, housedDay: null, msgId: 'x' },
      { id: 'p1', species: 'phoenix', owner: '', name: 'Cinder', status: 'housed', home: 'phoenix_perch', grantedDay: 2, housedDay: 4, msgId: '' },
      { id: 'h1', species: 'griffin', owner: '', name: '', status: 'housed', home: 'griffin_tower', grantedDay: 100000, housedDay: 100000, msgId: '' },
      { id: 'w1', species: 'griffin', owner: '', name: new Array(41).join('n'), status: 'waiting', home: '', grantedDay: 10, housedDay: null, msgId: '' }
    ]);
    t.same(BR.cleanCreatures(out, 10), out, 'the same twice');
    t.same([BR.speciesName(bdata, 'phoenix'), BR.creatureName(bdata, { id: 'p2', species: 'phoenix', grantedDay: 4 })], ['Unknown creature', 'Unknown creature (granted Day 4)'], 'shown as unknown');
    t.equal(BR.creatureWar(bdata, out[1]), null, 'and it doesn\'t fight');
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

  test('Reset Travel moves when each was granted and housed, and their recovery', function (t) {
    var b = withWyvern(bastion(10));
    withGrants(b, [grantMsg({ id: gid(2), name: 'Talon' })]);
    b.warRecovery = [{ id: 'r1', kind: 'creature', name: 'Elara\'s wyvern', status: 'badly_wounded', untilDay: 30, creatureId: 'elara_wyvern' }];
    BR.shiftDays(b, -4);
    t.same(b.creatures.map(function (c) { return [c.grantedDay, c.housedDay]; }), [[6, 6], [1, null]], 'housed on Day 10, granted on Day 5');
    t.equal(b.warRecovery[0].untilDay, 26);
    t.same(Object.keys(b.creatures[1]), KEYS);
  });

  test('receipts keep a creature grant\'s fields when tidied, the same twice', function (t) {
    var src = { fresh: false, done: { 'g:dm:0': { held: 'yes', creatureId: 'cr-g', name: 'Swiftwing', species: 'griffin', type: 'creature', why: '', r: 'applied', day: 4, at: 5 } } };
    var once = BR.cleanBridge(src);
    t.same(once.done['g:dm:0'], { r: 'applied', day: 4, at: 5, clan: '', hr: 0, was: 0, now: 0, text: '', why: '', type: 'creature', species: 'griffin', name: 'Swiftwing', creatureId: 'cr-g', held: false });
    t.same(BR.cleanBridge(once), once);
  });

  test('a recovery record for a creature is kept by its id, even without its name; any other odd one goes as before', function (t) {
    var s = copy(BR.toSave(bastion(10)));
    s.warRecovery = [
      { id: 'r1', kind: 'creature', name: 'Swiftwing', status: 'wounded', untilDay: 20, creatureId: 'cr-x' },
      { id: 'r2', kind: 'creature', status: 'badly_wounded', untilDay: 30, creatureId: 'cr-y' },
      { id: 'r3', kind: 'creature', name: 'No id', untilDay: 30 },
      { id: 'r4', kind: 'beast', name: 'Ape', status: 'wounded', untilDay: 12 }
    ];
    var b = BR.fromSave(s, bdata);
    t.same(b.warRecovery, [
      { id: 'r1', kind: 'creature', name: 'Swiftwing', status: 'wounded', untilDay: 20, creatureId: 'cr-x' },
      { id: 'r2', kind: 'creature', name: 'A creature', status: 'badly_wounded', untilDay: 30, creatureId: 'cr-y' },
      { id: 'r4', kind: 'beast', name: 'Ape', status: 'wounded', untilDay: 12 }
    ]);
  });

  /* ---------------------------------------------------------------- */
  group('Creatures: the forecast and the DM doc');

  test('a House order "is complete" (never a roll); a creature\'s recovery "is fit to fight again"', function (t) {
    var b = bastion(10, ['griffin_tower', 'wyvern_roost']);
    withGrants(b, [grantMsg()]);
    issue(b, 'griffin_tower');
    issue(b, 'wyvern_roost');
    b.warRecovery = [{ id: 'r1', kind: 'creature', name: 'Greymane', status: 'badly_wounded', untilDay: 31, creatureId: 'cr-g' }, { id: 'r2', kind: 'creature', name: 'Talon', status: 'separated', untilDay: 17, creatureId: 'cr-t' }];
    var coming = TSI.campaign.bastionComing(copy(BR.toSave(b)));
    function has(day, kind, line) { return coming.some(function (x) { return x.day === day && x.kind === kind && x.line === line; }); }
    t.ok(has(13, 'order', 'Griffin Tower: House a Griffin (Swiftwing) is complete.'), JSON.stringify(coming));
    t.ok(has(13, 'order', 'Wyvern Roost: House Elara\'s Wyvern is complete.'));
    t.ok(has(31, 'recovery', 'Greymane is fit to fight again.'));
    t.ok(has(17, 'recovery', 'Talon has found the way back to the Bastion.'));
    t.equal(coming.filter(function (x) { return x.kind === 'roll'; }).length, 0);
  });
}());
