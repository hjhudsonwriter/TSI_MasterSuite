/* The Ironbow Bastion Manager: the war's campaign rules (war-campaign-rules.js):
   the Military list, what can be committed, missions and their enemy armies,
   the Military Action's battle line-up, and everything after the battle.
   Battles here are built by hand in the battle rules' saved shape, so these
   tests don't depend on the battle rules themselves. */
(function () {
  var R = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var W = T.bastionWar;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents };

  /* Dice that come up in the given order (numbers from 0 up to 1). */
  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  /* A d6 that comes up as n. */
  function d6(n) { return (n - 1) / 6 + 0.01; }
  function roll(d20) { return { d20: d20, total: d20 }; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function fresh() { return R.defaultState(data); }

  /* A Clan on turn 3 with two Lieutenants, two Line Infantry, one Line
     Infantry at 62, one Archers, 30 armed defenders, two Giant Vultures
     and an Ape. */
  function army() {
    var s = fresh();
    s.organization = { type: 'clan', name: 'Clan Ironbow', chief: '', motto: '', foundedAtTurn: 1 };
    s.turn = 3;
    s.treasuryGP = 100;
    s.defenders = { count: 30, armed: true, patrolAdvantage: false };
    s.defenderBeasts = [{ name: 'Giant Vulture', qty: 2, source: 'Menagerie' }, { name: 'Ape', qty: 1, source: 'Menagerie' }];
    s.military = [
      { name: 'Lieutenant (1)', qty: 2, source: 'War Room' },
      { name: 'Line Infantry (100)', qty: 2, source: 'War Room' },
      { id: 'reg-a', name: 'Line Infantry (100)', qty: 1, strength: 62, source: 'War Room', depleted: true },
      { name: 'Archers (50)', qty: 1, source: 'War Room' }
    ];
    return s;
  }
  var ALL = { defenders: 30, lieutenants: 2, units: { line: 3, archers: 1 }, beasts: { 'Giant Vulture': 2, Ape: 1 } };
  function queue(s, objective, commit, tier, target) {
    return R.queueWarAction2(s, data, { targetKey: target || 'bacca', objective: objective || 'raid', tier: tier || 'small', commit: commit || ALL });
  }
  /* Queued, begun and the three rolls made (all passed unless told otherwise). */
  function ready(objective, opts) {
    opts = opts || {};
    var s = opts.s || army();
    var order = queue(s, objective, opts.commit);
    var ma = R.beginMilitaryAction(s, data, order, dice([0.5]), 0);
    R.militaryRoll(s, data, ma.id, 'weather', roll(opts.weather || 15), dice([0]));
    R.militaryRoll(s, data, ma.id, 'morale', roll(opts.morale || 15), dice([0]));
    R.militaryRoll(s, data, ma.id, 'luck', roll(opts.luck || 12), dice([0]));
    return { s: s, ma: ma };
  }

  /* A finished battle in the battle rules' saved shape (contract section 3),
     from the action's line-up. set: { unitId: { status, cohesion, support } };
     hosts: { leaderId: unitId }. */
  function battleFrom(ma, outcome, opts) {
    opts = opts || {};
    var spec = ma.spec;
    function unit(u, side) {
      var x = copy(u);
      x.side = side;
      x.support = null;
      x.leaderId = null;
      x.cohesionMax = u.profile.cohesion;
      x.cohesion = u.profile.cohesion;
      x.status = 'steady';
      x.pos = null;
      x.startPos = null;
      x.activated = false;
      x.holding = false;
      x.carrying = null;
      x.heldFast = false;
      x.everHalf = false;
      return x;
    }
    var units = spec.player.units.map(function (u) { return unit(u, 'player'); });
    if (opts.detachment) {
      units.push(unit({ id: 'p-def-1', kind: 'detachment', type: 'defenders', name: 'Bastion Defenders', label: 'Bastion Defenders', short: 'BD',
        personnel: opts.detachment, size: 150, profile: { cohesion: 2, attack: 2, defence: 11, move: 3, resolve: 0, bv: 1.5 }, traits: [], variant: null, source: { defenders: true } }, 'player'));
    }
    spec.enemy.units.forEach(function (u) { units.push(unit(u, 'enemy')); });
    Object.keys(opts.set || {}).forEach(function (id) {
      units.forEach(function (u) { if (u.id === id) Object.assign(u, opts.set[id]); });
    });
    var hosts = opts.hosts || {};
    var leaders = spec.player.leaders.map(function (l) {
      return { id: l.id, side: 'player', name: l.name, hostId: hosts[l.id] || null, autoRallyLeft: 1, bv: 2, source: l.source };
    }).concat(spec.enemy.leaders.map(function (l) {
      return { id: l.id, side: 'enemy', name: l.name, hostId: 'e1', autoRallyLeft: 1, bv: 2, source: null };
    }));
    var extracted = opts.extracted || 0;
    return {
      v: 2, phase: 'over', cols: 22, rows: 14, strip: [6, 7],
      objective: { id: ma.objective, markers: [], zone: null, held: { player: 0, enemy: 0 }, extracted: extracted },
      conditions: spec.conditions, round: opts.round || 6, maxRounds: 6, firstSide: 'player', turnSide: 'player', started: true,
      units: units, leaders: leaders, log: opts.log || [], startBV: { player: 39, enemy: 17 },
      result: { outcome: outcome, reason: opts.reason || 'The battle is decided', round: opts.round || 6, lostPct: { player: 20, enemy: 70 }, extracted: extracted, broken: { player: false, enemy: true } }
    };
  }
  /* The standard casualties for the army above: Line Infantry 2 at half
     Cohesion, Line Infantry 3 (the one at 62) Routed, the Archers Defeated,
     the first Giant Vulture Defeated, the second Routed; Lieutenant 1 with
     Line Infantry 3, Lieutenant 2 with the Archers; 10 defenders supporting
     each Line Infantry. */
  function hurtOpts(extra) {
    return Object.assign({
      set: {
        'p-line-1': { support: { count: 10, armed: true, bonus: 2 } },
        'p-line-2': { cohesion: 2, support: { count: 10, armed: true, bonus: 2 } },
        'p-line-3': { status: 'routed', support: { count: 10, armed: true, bonus: 2 } },
        'p-archers-1': { status: 'defeated', cohesion: 0 },
        'p-beast-1': { status: 'defeated', cohesion: 0 },
        'p-beast-2': { status: 'routed' }
      },
      hosts: { 'lt-1': 'p-line-3', 'lt-2': 'p-archers-1' }
    }, extra || {});
  }

  group('Bastion war campaign: the Military list');

  test('unit types from War Room labels, names and ids; old Regiments are Line Infantry', function (t) {
    t.same(['Archers (50)', 'Levy Infantry (150)', 'Line Infantry (100)', 'Heavy Infantry (50)', 'Light Cavalry (50)', 'Shock Cavalry (25)'].map(function (n) { return R.unitTypeOf(n); }),
      ['archers', 'levy', 'line', 'heavy', 'light_cav', 'shock_cav']);
    t.same([R.unitTypeOf('Regiment (100)'), R.unitTypeOf('line infantry'), R.unitTypeOf('light_cav'), R.unitTypeOf('Lieutenant (1)'), R.unitTypeOf('Giant Vulture'), R.unitTypeOf('')],
      ['line', 'line', 'light_cav', 'lieutenant', null, null]);
  });

  test('a War Room recruit with no depleted regiment is added and counted as before', function (t) {
    var s = army();
    t.equal(R.recruitUnit(s, data, 'Heavy Infantry (50)'), 'Recruited: Heavy Infantry (50).');
    t.equal(R.recruitUnit(s, data, 'Lieutenant (1)'), 'Recruited: Lieutenant (1).');
    t.same(s.military[s.military.length - 1], { name: 'Heavy Infantry (50)', qty: 1, source: 'War Room' });
    t.equal(s.military[0].qty, 3);
    t.same(R.completeSimpleOrder(s, data, { facId: 'war_room', fnId: 'recruit', optionLabel: 'Heavy Infantry (50)', label: 'War Room: Recruit (Heavy Infantry (50))' }, dice([0.1])),
      [['Order Completed', 'War Room: Recruit (Heavy Infantry (50)) → Recruited: Heavy Infantry (50).']]);
    t.equal(s.military[s.military.length - 1].qty, 2);
  });

  test('replacements bring the weakest depleted regiment of that type back to full strength first', function (t) {
    var s = army();
    s.military.push({ id: 'reg-b', name: 'Line Infantry (100)', qty: 1, strength: 30, source: 'War Room', depleted: true });
    var line = R.completeSimpleOrder(s, data, { facId: 'war_room', fnId: 'recruit', optionLabel: 'Line Infantry (100)', label: 'War Room: Recruit (Line Infantry (100))' }, dice([0.1]));
    t.same(line, [['Order Completed', 'War Room: Recruit (Line Infantry (100)) → Replacements bring Line Infantry back to 100.']]);
    t.same(s.military.map(function (r) { return [r.name, r.qty, r.strength || null]; }),
      [['Lieutenant (1)', 2, null], ['Line Infantry (100)', 3, null], ['Line Infantry (100)', 1, 62], ['Archers (50)', 1, null]], 'the one at 30 is whole again');
    t.equal(R.recruitUnit(s, data, 'Archers (50)'), 'Recruited: Archers (50).', 'another type is simply recruited');
    t.equal(R.recruitUnit(s, data, 'Line Infantry (100)'), 'Replacements bring Line Infantry back to 100.');
    t.equal(s.military.filter(function (r) { return r.depleted; }).length, 0);
    t.equal(s.military[1].qty, 4);
  });

  test('an old "Regiment (100)" under strength is topped up by a Line Infantry recruit, and stays a Regiment', function (t) {
    var s = fresh();
    s.military = [{ name: 'Regiment (100)', qty: 1, source: 'War Room' }, { id: 'old', name: 'Regiment (100)', qty: 1, strength: 40, source: 'War Room', depleted: true }];
    t.equal(R.recruitUnit(s, data, 'Line Infantry (100)'), 'Replacements bring Line Infantry back to 100.');
    t.same(s.military, [{ name: 'Regiment (100)', qty: 2, source: 'War Room' }]);
  });

  test('a depleted regiment on the battlefield isn\'t topped up; adding by name never touches a depleted row', function (t) {
    var b = ready('raid');
    t.equal(R.recruitUnit(b.s, data, 'Line Infantry (100)'), 'Recruited: Line Infantry (100).', 'the one at 62 is marching');
    t.equal(b.s.military[2].strength, 62);
    var list = [{ id: 'x', name: 'Line Infantry (100)', qty: 1, strength: 20, depleted: true }];
    R.addToList(list, 'Line Infantry (100)', { source: 'War Room' });
    t.same(list[1], { name: 'Line Infantry (100)', qty: 1, source: 'War Room' });
    t.equal(list[0].qty, 1);
  });

  group('Bastion war campaign: what can be committed');

  test('everything free, by type and healthiest first, with the defenders, Lieutenants and beasts', function (t) {
    var f = R.warForces(army(), data);
    t.same(Object.keys(f.units), ['levy', 'line', 'heavy', 'archers', 'light_cav', 'shock_cav']);
    t.same(f.units.line, [
      { key: 'line-1', label: 'Line Infantry', personnel: 100, size: 100, depleted: false },
      { key: 'line-2', label: 'Line Infantry', personnel: 100, size: 100, depleted: false },
      { key: 'reg-a', label: 'Line Infantry (62 of 100)', personnel: 62, size: 100, depleted: true }
    ]);
    t.equal(f.units.archers.length, 1);
    t.same([f.defenders, f.lieutenants, f.beasts, f.fullWar], [{ count: 30, armed: true }, 2, { 'Giant Vulture': 2, Ape: 1 }, true]);
    t.same(R.warAvailable(army()), { defenders: 30, beasts: 3, lieutenants: 2, regiments: 4, fullWar: true }, 'phase 1\'s summary counts every unit type');
  });

  test('a waiting war order\'s commitment can\'t be committed again (it takes the healthiest)', function (t) {
    var s = army();
    queue(s, 'raid', { defenders: 20, lieutenants: 1, units: { line: 2 }, beasts: { 'Giant Vulture': 1 } });
    var f = R.warForces(s, data);
    t.same(f.units.line.map(function (u) { return u.key; }), ['reg-a'], 'only the one at 62 is left');
    t.same([f.defenders.count, f.lieutenants, f.beasts], [10, 1, { 'Giant Vulture': 1, Ape: 1 }]);
    t.same(R.warForces(s, data, { except: s.pendingOrders[0].id }).units.line.length, 3, 'leaving that order out');
  });

  test('a Military Action under way holds its own regiments, the depleted one by its row', function (t) {
    var s = army();
    queue(s, 'raid', { units: { line: 3 }, defenders: 5, beasts: { Ape: 1 } });
    R.beginMilitaryAction(s, data, s.pendingOrders[0], dice([0.5]), 0);
    var f = R.warForces(s, data);
    t.same(f.units.line, []);
    t.same([f.defenders.count, f.beasts], [25, { 'Giant Vulture': 2 }]);
    s.military.push({ id: 'reg-new', name: 'Line Infantry (100)', qty: 1, strength: 80, source: 'War Room', depleted: true });
    t.same(R.warForces(s, data).units.line.map(function (u) { return u.key; }), ['reg-new'], 'a new depleted one is free');
  });

  test('Lieutenants and beasts still recovering can\'t be committed', function (t) {
    var s = army();
    s.warRecovery = [
      { id: 'r1', kind: 'lieutenant', name: 'Lieutenant 1', status: 'wounded', untilTurn: 5 },
      { id: 'r2', kind: 'beast', name: 'Giant Vulture', status: 'recovered', untilTurn: 4 }
    ];
    var f = R.warForces(s, data);
    t.same([f.lieutenants, f.beasts], [1, { 'Giant Vulture': 1, Ape: 1 }]);
  });

  test('a phase 1 war order still waiting is read as Line Infantry and the first beasts in the list', function (t) {
    var s = army();
    R.queueWarAction(s, { objective: 'raid', targetKey: 'bacca', targetName: 'Bacca', commitDefenders: 4, commitBeasts: 2, commitLieutenants: 1, commitRegiments: 2 }, dice([0.3]));
    t.same(R.orderCommit(s, data, s.pendingOrders[0]), { defenders: 4, lieutenants: 1, units: { line: 2 }, beasts: { 'Giant Vulture': 2 } });
    var f = R.warForces(s, data);
    t.same([f.units.line.length, f.defenders.count, f.lieutenants, f.beasts], [1, 26, 1, { Ape: 1 }]);
  });

  test('phase 1 beast counts are filled from beasts nobody else holds, in list order', function (t) {
    var save = R.toSave(fresh());
    save.organization = { type: 'clan', name: 'Clan Ironbow', chief: '', motto: '', foundedAtTurn: 1 };
    save.turn = 6;
    save.defenderBeasts = [{ name: 'Giant Vulture', qty: 2, source: 'Menagerie' }, { name: 'Ape', qty: 1, source: 'Menagerie' }];
    save.militaryActions = [{ id: 'ma-a', orderId: 'a', turn: 6, objective: 'raid', targetKey: 'bacca', targetName: 'Bacca', commit: { defenders: 0, beasts: 2, lieutenants: 0, regiments: 0 }, forces: [], step: 'weather', weather: null, morale: null, luck: null }];
    save.pendingOrders = [{ id: 'b', facId: 'war_council', fnId: 'war_action', optionIdx: 0, label: 'War Action', completeTurn: 7,
      meta: { kind: 'war_action', objective: 'skirmish', targetKey: 'karr', targetName: 'Karr', commitDefenders: 0, commitBeasts: 1, commitLieutenants: 0, commitRegiments: 0 } }];
    var d = R.fromSave(JSON.parse(JSON.stringify(save)), data);
    t.same(d.militaryActions[0].commit.beasts, { 'Giant Vulture': 2 });
    t.same(R.orderCommit(d, data, d.pendingOrders[0]).beasts, { Ape: 1 }, 'the waiting order\'s beast is the one left: the Ape');
    t.same(R.warForces(d, data).beasts, {}, 'so the Ape isn\'t offered to a new order');
    var ma = R.beginMilitaryAction(d, data, d.pendingOrders[0], dice([0.5]), 0);
    t.same([ma.commit.beasts, ma.spec.player.units.map(function (u) { return u.name; })], [{ Ape: 1 }, ['Ape']], 'and it marches with the Ape');
  });

  test('two waiting orders keep the regiments they were estimated with, in the order they were queued', function (t) {
    function setUp() {
      var s = army();
      s.military = [{ name: 'Line Infantry (100)', qty: 1, source: 'War Room' }, { id: 'reg-a', name: 'Line Infantry (100)', qty: 1, strength: 30, source: 'War Room', depleted: true }];
      return s;
    }
    var one = { units: { line: 1 } };
    var s = setUp();
    t.equal(R.armyBV(s, data, one), 5, 'the War Council\'s estimate for the first order: the full one');
    var a = queue(s, 'raid', one);
    t.equal(R.armyBV(s, data, one), 1.5, 'and for the next order: the one at 30');
    var b = queue(s, 'skirmish', one, 'small', 'karr');
    t.same([R.armyBV(s, data, one, { except: a.id }), R.armyBV(s, data, one, { except: b.id })], [5, 1.5], 'each waiting order\'s own share');
    s.turn = 4;
    var maA = R.beginMilitaryAction(s, data, a, dice([0.5]), 0);
    var maB = R.beginMilitaryAction(s, data, b, dice([0.5]), 0);
    t.same([maA.spec.player.units[0].personnel, maB.spec.player.units[0].personnel], [100, 30]);
    var r = setUp();
    var a2 = queue(r, 'raid', one), b2 = queue(r, 'skirmish', one, 'small', 'karr');
    var second = R.beginMilitaryAction(r, data, b2, dice([0.5]), 0);
    var first = R.beginMilitaryAction(r, data, a2, dice([0.5]), 0);
    t.same([first.spec.player.units[0].personnel, second.spec.player.units[0].personnel], [100, 30], 'whichever begins first');
  });

  test('Lieutenants: never more than the formations and detachments they could lead, and never sent alone', function (t) {
    var s = army();
    t.equal(queue(s, 'defend', { lieutenants: 1 }), null, 'Lieutenants alone: refused');
    t.equal(s.pendingOrders.length, 0);
    var c = R.warCommit2(s, data, { lieutenants: 2, units: { line: 1 }, beasts: { 'Giant Vulture': 2 } });
    t.equal(c.lieutenants, 1, 'one regiment, one Lieutenant (never with a beast)');
    t.equal(R.armyBV(s, data, { lieutenants: 2, units: { line: 1 }, beasts: { 'Giant Vulture': 2 } }), 5 + 2 + 5 + 5, 'only the Lieutenant who can lead counts');
    t.equal(R.warCommit2(s, data, { lieutenants: 2, defenders: 30 }).lieutenants, 1, 'defenders with no regiment form one detachment');
    t.equal(R.warCommit2(s, data, { lieutenants: 2, units: { line: 1 }, defenders: 30 }).lieutenants, 2, '10 support the regiment and the other 20 form a detachment');
    t.equal(R.warCommit2(s, data, { lieutenants: 2, units: { line: 1 }, defenders: 10 }).lieutenants, 1, 'all 10 support the regiment');
    var o = queue(s, 'raid', { lieutenants: 2, units: { line: 1 } });
    t.equal(o.meta.commit.lieutenants, 1);
  });

  test('the boxes as typed are clamped to what\'s free; unknown units and beasts are dropped', function (t) {
    var s = army();
    t.same(R.warCommit2(s, data, { defenders: '99', lieutenants: '3', units: { line: '5', archers: '', heavy: 2, dragons: 4 }, beasts: { 'Giant Vulture': '1', Owlbear: 2 } }),
      { defenders: 30, lieutenants: 2, units: { line: 3 }, beasts: { 'Giant Vulture': 1 } });
    t.same(R.warCommit2(s, data, {}), { defenders: 0, lieutenants: 0, units: {}, beasts: {} });
  });

  test('the Unsworn send only defenders and beasts, as before', function (t) {
    var s = army();
    s.organization.type = 'unsworn';
    t.same(R.warCommit2(s, data, ALL), { defenders: 30, lieutenants: 0, units: {}, beasts: { 'Giant Vulture': 2, Ape: 1 } });
    t.equal(R.warForces(s, data).fullWar, false);
  });

  test('the defenders\' rules: 75 or more in detachments of at most 150, fewer as support, the rest in one small detachment', function (t) {
    t.same(R.defenderPlan(data, 30, true, 4), { detachments: [], support: [{ count: 10, bonus: 2 }, { count: 10, bonus: 2 }, { count: 10, bonus: 2 }], bv: 3 });
    t.same(R.defenderPlan(data, 160, true, 2), { detachments: [80, 80], support: [], bv: 3 }, 'split evenly');
    t.same(R.defenderPlan(data, 80, true, 3), { detachments: [80], support: [], bv: 1.5 });
    t.same(R.defenderPlan(data, 7, true, 1), { detachments: [], support: [{ count: 7, bonus: 1 }], bv: 0.5 });
    t.same(R.defenderPlan(data, 34, false, 3), { detachments: [4], support: [{ count: 10, bonus: 1 }, { count: 10, bonus: 1 }, { count: 10, bonus: 1 }], bv: 2 }, 'unarmed: +1 per 10, at most +1');
    t.same(R.defenderPlan(data, 3, true, 0), { detachments: [3], support: [], bv: 0.5 }, 'with no regiments they still fight');
  });

  test('the army\'s Battle Value: units (depleted ones scaled), Lieutenants 2, beasts by profile, defenders', function (t) {
    var s = army();
    t.equal(R.armyBV(s, data, ALL), 5 + 5 + 3 + 5 + 2 * 2 + 5 + 5 + 4 + 3, 'Line 5+5, Line at 62 → 3, Archers 5, two Lieutenants, two Vultures, an Ape, 30 defenders as support');
    t.equal(R.armyBV(s, data, { units: { line: 1 } }), 5);
    t.equal(R.armyBV(s, data, {}), 0);
    t.same([R.unitBV(data, 'line', 62), R.unitBV(data, 'heavy', 21), R.unitBV(data, 'levy', 1), R.unitBV(data, 'archers')], [3, 3, 0.5, 5]);
  });

  test('the battle line-up: one unit per regiment, the healthiest first, scaled when depleted', function (t) {
    var side = R.playerSide(army(), data, ALL);
    var line3 = side.units[2];
    t.same(side.units.map(function (u) { return [u.id, u.label, u.short, u.personnel]; }), [
      ['p-line-1', 'Line Infantry 1', 'LI1', 100], ['p-line-2', 'Line Infantry 2', 'LI2', 100], ['p-line-3', 'Line Infantry 3', 'LI3', 62],
      ['p-archers-1', 'Archers', 'AR', 50], ['p-beast-1', 'Giant Vulture 1', 'GV1', 1], ['p-beast-2', 'Giant Vulture 2', 'GV2', 1], ['p-beast-3', 'Ape', 'Ap', 1]
    ]);
    t.same(Object.keys(line3), ['id', 'kind', 'type', 'name', 'label', 'short', 'personnel', 'size', 'profile', 'traits', 'variant', 'source']);
    t.same(line3.profile, { cohesion: 3, attack: 4, defence: 13, move: 3, resolve: 1, bv: 3 }, 'Cohesion round(5 × 0.62) = 3; Battle Value 3.1 → 3');
    t.same(line3.source, { key: 'reg-a', type: 'line', rowId: 'reg-a' });
    t.same(side.units[0].source, { key: 'line-1', type: 'line' });
    t.same(side.units[3].profile, { cohesion: 4, attack: 1, rangedAttack: 4, range: 6, defence: 11, move: 3, resolve: 0, bv: 5 });
  });

  test('the battle line-up: beasts with their profile and trait, Lieutenants and the defenders', function (t) {
    var s = army();
    var side = R.playerSide(s, data, ALL);
    var gv = side.units[4];
    t.same([gv.kind, gv.type, gv.name, gv.traits, gv.profile, gv.source], ['beast', 'beast', 'Giant Vulture', ['flight'],
      { cohesion: 4, attack: 4, defence: 11, move: 6, resolve: 0, bv: 5 }, { key: 'beast-1', beast: 'Giant Vulture' }]);
    t.same(side.leaders, [{ id: 'lt-1', name: 'Lieutenant 1', source: { lieutenant: 1 } }, { id: 'lt-2', name: 'Lieutenant 2', source: { lieutenant: 2 } }]);
    t.same(side.defenders, { count: 30, armed: true, source: { defenders: true } });
    t.same(R.playerSide(s, data, { lieutenants: 1, units: { line: 1 } }).leaders, [{ id: 'lt-1', name: 'Lieutenant', source: { lieutenant: 1 } }]);
    t.same(R.playerSide(s, data, { lieutenants: 1 }).leaders, [], 'no formation to lead: no Lieutenant');
    s.defenderBeasts = [{ name: 'Black Bear', qty: 1 }, { name: 'Brown Bear', qty: 2 }, { name: 'Mystery Beast', qty: 1 }];
    var beasts = R.playerSide(s, data, { beasts: { 'Black Bear': 1, 'Brown Bear': 2, 'Mystery Beast': 1 } }).units;
    t.same(beasts.map(function (u) { return u.short; }), ['BlB', 'BrB1', 'BrB2', 'MB'], 'Black and Brown Bears can be told apart');
    t.same([beasts[3].profile.bv, beasts[3].traits], [W.beastDefault.bv, [W.beastDefault.trait]], 'an unknown beast uses the default profile');
  });

  group('Bastion war campaign: missions');

  test('the seeded dice: the same seed rolls the same, between 0 and 1', function (t) {
    var a = R.mulberry32(123), b = R.mulberry32(123), c = R.mulberry32(124);
    var ra = [], rb = [], rc = [];
    for (var i = 0; i < 50; i++) { ra.push(a()); rb.push(b()); rc.push(c()); }
    t.same(ra, rb);
    t.ok(JSON.stringify(ra) !== JSON.stringify(rc));
    t.ok(ra.every(function (x) { return x >= 0 && x < 1; }));
    t.equal(R.missionSeed('bacca|raid|small', 3, 0), R.missionSeed('bacca|raid|small', 3, 0));
  });

  test('an enemy army is the same for the same dice, and its budget follows the force, objective and variation roll', function (t) {
    var g1 = R.generateEnemy(data, 'bacca', 'seize_outpost', 'established', R.mulberry32(7));
    var g2 = R.generateEnemy(data, 'bacca', 'seize_outpost', 'established', R.mulberry32(7));
    t.same(g1, g2);
    for (var seed = 1; seed <= 30; seed++) {
      var g = R.generateEnemy(data, 'karr', 'defend', 'major', R.mulberry32(seed));
      var row = W.variation.filter(function (v, i) { return g.variation.roll <= v.upTo && (i === 0 || g.variation.roll > W.variation[i - 1].upTo); })[0];
      t.equal(g.variation.mult, row.mult);
      t.equal(g.budget, Math.round(40 * 1.1 * row.mult));
    }
    t.equal(R.generateEnemy(data, 'nowhere', 'raid', 'small', R.mulberry32(1)), null);
    t.equal(R.generateEnemy(data, 'bacca', 'picnic', 'small', R.mulberry32(1)), null);
    t.equal(R.generateEnemy(data, 'bacca', 'raid', 'huge', R.mulberry32(1)), null);
  });

  test('every clan, force and objective, many times: within budget, half infantry, inside the caps, sensibly named', function (t) {
    var problems = [];
    Object.keys(W.clans).forEach(function (key) {
      var clan = W.clans[key];
      W.tiers.forEach(function (tier) {
        Object.keys(W.objectives).forEach(function (obj) {
          for (var seed = 1; seed <= 25; seed++) {
            var g = R.generateEnemy(data, key, obj, tier.id, R.mulberry32(seed * 7919 + tier.bv));
            var units = g.enemy.units, where = key + '/' + tier.id + '/' + obj + '/' + seed + ': ';
            var total = R.enemyBV(data, g.enemy);
            if (total > g.budget + 1 || total < g.budget - 3) problems.push(where + 'Battle Value ' + total + ' for a budget of ' + g.budget);
            var unitBV = 0, infBV = 0, archers = 0, cav = 0, shock = 0, beasts = 0;
            units.forEach(function (u, i) {
              unitBV += u.profile.bv;
              if (u.id !== 'e' + (i + 1)) problems.push(where + 'id ' + u.id);
              if (u.kind === 'beast') {
                beasts += 1;
                var allowed = (clan.beasts || []).filter(function (b) { return b.name === u.name && g.budget >= b.minBudget; });
                if (!allowed.length) problems.push(where + 'beast ' + u.name);
                return;
              }
              var a = W.archetypes[u.type];
              if (u.personnel !== a.size || u.size !== a.size) problems.push(where + 'size ' + u.label);
              if (a.role === 'infantry') infBV += u.profile.bv;
              if (a.role === 'ranged') archers += 1;
              if (a.role === 'cavalry') cav += 1;
              if (u.type === 'shock_cav') shock += 1;
              if (u.variant && !clan.variants.some(function (v) { return v.id === u.variant.id && v.base === u.type && v.name === u.name; })) problems.push(where + 'variant ' + u.name);
              if (!u.variant && u.name !== a.name) problems.push(where + 'name ' + u.name);
            });
            if (!units.length || W.archetypes[units[0].type].role !== 'infantry') problems.push(where + 'no infantry core');
            if (infBV < W.coreShare * unitBV) problems.push(where + 'infantry ' + infBV + ' of ' + unitBV);
            if (archers > clan.caps.archers * units.length) problems.push(where + archers + ' archers');
            if (cav > clan.caps.cavalry || shock > clan.caps.shock_cav || beasts > clan.caps.beasts) problems.push(where + 'caps');
            var labels = units.map(function (u) { return u.label; });
            var shorts = units.map(function (u) { return u.short; });
            if (labels.some(function (l, i) { return labels.indexOf(l) !== i; }) || shorts.some(function (x, i) { return shorts.indexOf(x) !== i; })) problems.push(where + 'names repeat');
          }
        });
      });
    });
    t.same(problems.slice(0, 5), []);
  });

  test('clans field their variants most of the time, with the variant\'s name, trait and changed profile', function (t) {
    function count(key, tier, name) {
      var n = 0, plain = 0;
      for (var seed = 1; seed <= 60; seed++) {
        R.generateEnemy(data, key, 'skirmish', tier, R.mulberry32(seed)).enemy.units.forEach(function (u) {
          if (u.name === name) n += 1;
          else if (u.variant === null && W.clans[key].variants.some(function (v) { return v.base === u.type && v.name === name; })) plain += 1;
        });
      }
      return { variant: n, plain: plain };
    }
    var stone = count('bacca', 'major', 'Bacca Stoneguard');
    t.ok(stone.variant > stone.plain && stone.plain > 0, 'Stoneguard ' + stone.variant + ', plain Heavy Infantry ' + stone.plain);
    var found = {};
    for (var seed = 1; seed <= 80; seed++) {
      ['molten', 'slade', 'bacca'].forEach(function (key) {
        R.generateEnemy(data, key, 'seize_outpost', 'major', R.mulberry32(seed)).enemy.units.forEach(function (u) { if (u.variant) found[u.variant.id] = u; });
      });
    }
    t.same([found.molten_ironclads.profile.defence, found.molten_ironclads.traits, found.molten_ironclads.variant], [16, ['armoured'], { id: 'molten_ironclads', name: 'Molten Ironclads', trait: 'armoured' }]);
    t.same([found.slade_outriders.profile.move, found.slade_outriders.traits], [6, ['charge', 'fleet']], 'Fleet: +1 Move, keeping the Light Cavalry\'s Charge');
    t.same([found.bacca_stoneguard.profile.resolve, found.bacca_cragmen.traits], [3, ['cragsure']]);
  });

  test('Captains: one from a budget of 14, more at 26 and 38, one extra for Farmer; never more than the formations', function (t) {
    for (var seed = 1; seed <= 20; seed++) {
      ['bacca', 'farmer'].forEach(function (key) {
        W.tiers.forEach(function (tier) {
          var g = R.generateEnemy(data, key, 'raid', tier.id, R.mulberry32(seed));
          var want = (g.budget >= 14 ? 1 : 0) + (g.budget >= 26 ? 1 : 0) + (g.budget >= 38 ? 1 : 0) + (key === 'farmer' ? 1 : 0);
          var hosts = g.enemy.units.filter(function (u) { return u.kind !== 'beast'; }).length;
          t.equal(g.enemy.leaders.length, Math.min(want, hosts), key + ' ' + g.budget);
        });
      });
    }
    var one = R.generateEnemy(data, 'bacca', 'skirmish', 'small', R.mulberry32(5));
    t.same(one.enemy.leaders, one.budget >= 14 ? [{ id: 'c1', name: 'Bacca Captain' }] : []);
    var farmer = R.generateEnemy(data, 'farmer', 'skirmish', 'established', R.mulberry32(5));
    t.equal(farmer.enemy.leaders[1].name, 'Farmer Captain 2');
  });

  test('beasts only for the clans that have them, from their budget up', function (t) {
    var seen = { karrSmall: 0, karrMajor: 0, molten: {}, others: 0 };
    for (var seed = 1; seed <= 80; seed++) {
      var rng = function (k, o, tier) { return R.generateEnemy(data, k, o, tier, R.mulberry32(seed)).enemy.units.filter(function (u) { return u.kind === 'beast'; }); };
      seen.karrSmall += rng('karr', 'skirmish', 'small').length;
      seen.karrMajor += rng('karr', 'skirmish', 'major').length;
      rng('molten', 'skirmish', 'major').forEach(function (u) { seen.molten[u.name] = true; t.ok(u.source.hired, 'hired'); });
      ['blackstone', 'bacca', 'rowthorn', 'farmer', 'slade'].forEach(function (k) { seen.others += rng(k, 'seize_outpost', 'major').length; });
    }
    t.equal(seen.karrSmall, 0, 'a Dire Wolf needs a budget of 28');
    t.ok(seen.karrMajor > 0, 'but comes with a major force');
    t.ok(seen.molten.Owlbear && seen.molten['Brown Bear'], 'Molten hires both');
    t.equal(seen.others, 0);
  });

  test('a mission is drawn up once, from its own seeded dice, and saved', function (t) {
    var s = army();
    var m = R.ensureMission(s, data, 'bacca', 'raid', 'small');
    t.same(Object.keys(m), ['key', 'targetKey', 'targetName', 'objective', 'tier', 'variation', 'budget', 'enemy', 'conditions', 'createdTurn']);
    t.same([m.key, m.targetName, m.conditions, m.createdTurn, s.warMissionSeq], ['bacca|raid|small', 'Bacca', null, 3, 1]);
    var g = R.generateEnemy(data, 'bacca', 'raid', 'small', R.mulberry32(R.missionSeed('bacca|raid|small', 3, 0)));
    t.same(m.enemy, g.enemy);
    t.equal(m.budget, g.budget);
    t.equal(R.ensureMission(s, data, 'bacca', 'raid', 'small'), m, 'the second look finds the same one');
    t.equal(s.warMissionSeq, 1);
    t.equal(R.ensureMission(s, data, 'bacca', 'raid', 'nonsense'), null);
  });

  test('a mission never depends on the party\'s level or the army it faces', function (t) {
    var weak = fresh(), strong = army();
    weak.turn = 3;
    strong.partyLevel = 20;
    for (var i = 0; i < 10; i++) strong.military.push({ name: 'Shock Cavalry (25)', qty: 5, source: 'War Room' });
    t.same(R.ensureMission(weak, data, 'molten', 'skirmish', 'major'), R.ensureMission(strong, data, 'molten', 'skirmish', 'major'));
  });

  test('a mission seen on another turn, or after another one, is drawn afresh', function (t) {
    var differs = 0;
    ['bacca', 'karr', 'slade', 'molten'].forEach(function (k) {
      var a = fresh(), b = fresh();
      b.turn = 9;
      if (JSON.stringify(R.ensureMission(a, data, k, 'skirmish', 'established').enemy) !== JSON.stringify(R.ensureMission(b, data, k, 'skirmish', 'established').enemy)) differs += 1;
    });
    t.ok(differs >= 2, differs + ' of 4 differ');
  });

  test('at most 12 missions: the oldest without opening rolls goes; ones in use or with rolls stay', function (t) {
    var s = fresh();
    var first = R.ensureMission(s, data, 'bacca', 'raid', 'small');
    first.conditions = { weather: {}, morale: {}, luck: {} };
    var second = R.ensureMission(s, data, 'bacca', 'raid', 'established');
    s.pendingOrders.push({ id: 'w', facId: 'war_council', meta: { kind: 'war_action', missionKey: second.key } });
    s.turn = 2;
    var third = R.ensureMission(s, data, 'bacca', 'raid', 'major');
    s.turn = 3;
    Object.keys(W.clans).filter(function (k) { return k !== 'bacca'; }).forEach(function (k) { R.ensureMission(s, data, k, 'skirmish', 'small'); });
    t.equal(Object.keys(s.warMissions).length, 9);
    ['blackstone', 'karr', 'molten'].forEach(function (k) { R.ensureMission(s, data, k, 'defend', 'small'); });
    t.equal(Object.keys(s.warMissions).length, 12);
    R.ensureMission(s, data, 'slade', 'defend', 'small');
    t.equal(Object.keys(s.warMissions).length, 12);
    t.ok(s.warMissions[first.key] && s.warMissions[second.key], 'kept: one with rolls, one in use (both from turn 1)');
    t.ok(!s.warMissions[third.key], 'the oldest of the rest (turn 2) went');
    t.ok(s.warMissions['blackstone|skirmish|small'] && s.warMissions['slade|defend|small'], 'the turn 3 ones stay');
  });

  test('a mission seen this turn keeps its army, however many others are looked at', function (t) {
    var s = army();
    var m = R.ensureMission(s, data, 'molten', 'skirmish', 'major');
    var enemy = copy(m.enemy), variation = copy(m.variation);
    Object.keys(W.clans).forEach(function (k) {
      Object.keys(W.objectives).forEach(function (o) { R.ensureMission(s, data, k, o, 'small'); });
    });
    t.equal(Object.keys(s.warMissions).length, 29, 'more than 12 for now');
    var again = R.ensureMission(s, data, 'molten', 'skirmish', 'major');
    t.same([again.enemy, again.variation], [enemy, variation], 'no new army, no new variation roll');
    s.turn += 1;
    R.ensureMission(s, data, 'molten', 'raid', 'major');
    t.equal(Object.keys(s.warMissions).length, 12, 'on the next turn the oldest are let go');
    t.ok(s.warMissions['molten|raid|major']);
  });

  test('the intelligence estimate always contains the real army\'s Battle Value', function (t) {
    var outside = [], n = 0;
    Object.keys(W.clans).forEach(function (k) {
      Object.keys(W.objectives).forEach(function (o) {
        W.tiers.forEach(function (tier) {
          for (var seed = 1; seed <= 12; seed++) {
            var g = R.generateEnemy(data, k, o, tier.id, R.mulberry32(seed * 7919));
            var e = R.missionEstimate({ targetKey: k, objective: o, tier: tier.id, enemy: g.enemy }, data);
            var bv = R.enemyBV(data, g.enemy);
            n += 1;
            if (bv < e.bvLow || bv > e.bvHigh) outside.push(k + '|' + o + '|' + tier.id + ' #' + seed + ': ' + bv + ' not in ' + e.bvLow + '–' + e.bvHigh);
          }
        });
      });
    });
    t.same(outside, [], n + ' armies');
  });

  test('the intelligence estimate: a range of Battle Value and formations, and what was seen', function (t) {
    var m = { targetKey: 'karr', tier: 'established', objective: 'defend', enemy: { units: [{ kind: 'formation', type: 'line' }, { kind: 'formation', type: 'light_cav' }, { kind: 'formation', type: 'levy' }, { kind: 'beast', type: 'beast' }], leaders: [] } };
    t.same(R.missionEstimate(m, data), { bvLow: Math.round(28 * 1.1 * 0.85) - 1, bvHigh: Math.round(28 * 1.1 * 1.15) + 1, formationsLow: 3, formationsHigh: 5, notes: ['cavalry reported', 'beasts sighted'] },
      'the variation rolls\' budgets, widened by the 1 an army can come out over (overshoot) or under (Levy\'s 3 not fitting in 2)');
    t.equal(R.missionEstimateLine(m, data), 'Estimated enemy: 25–36 Battle Value; about 3 to 5 formations; cavalry reported, beasts sighted.');
    m.enemy.units = [{ kind: 'formation', type: 'archers' }];
    t.same(R.missionEstimate(m, data).notes, ['archers reported']);
    t.same([R.missionEstimate(m, data).formationsLow, R.missionEstimate(m, data).formationsHigh], [1, 2]);
  });

  group('Bastion war campaign: queueing and the Military Action');

  test('a war order carries its force, mission and commitment, and the old fields for older readers', function (t) {
    var s = army();
    var o = queue(s, 'raid', ALL);
    t.same([o.id, o.facId, o.fnId, o.completeTurn, o.label], ['war-3-1', 'war_council', 'war_action', 4, 'War Action']);
    t.same(o.meta, {
      kind: 'war_action', objective: 'raid', targetKey: 'bacca', targetName: 'Bacca', tier: 'small', missionKey: 'bacca|raid|small',
      commit: { defenders: 30, lieutenants: 2, units: { line: 3, archers: 1 }, beasts: { 'Giant Vulture': 2, Ape: 1 } },
      commitDefenders: 30, commitBeasts: 3, commitLieutenants: 2, commitRegiments: 4
    });
    t.ok(s.warMissions['bacca|raid|small'], 'its mission is drawn up');
    t.same(R.warOrderLine(o), ['War Action Queued', 'RAID vs Bacca (resolves next Bastion Turn).']);
    t.equal(R.orderKind(data, o), 'war');
  });

  test('a war order is refused for an unknown target, objective or force, or with nothing committed; a second can\'t reuse the first\'s troops', function (t) {
    var s = army();
    t.equal(R.queueWarAction2(s, data, { targetKey: 'nowhere', objective: 'raid', tier: 'small', commit: ALL }), null);
    t.equal(R.queueWarAction2(s, data, { targetKey: 'bacca', objective: 'feast', tier: 'small', commit: ALL }), null);
    t.equal(R.queueWarAction2(s, data, { targetKey: 'bacca', objective: 'raid', tier: 'giant', commit: ALL }), null);
    t.equal(R.queueWarAction2(s, data, { targetKey: 'bacca', objective: 'raid', tier: 'small', commit: {} }), null);
    t.equal(s.pendingOrders.length, 0);
    queue(s, 'raid', { units: { line: 2 }, defenders: 25 });
    var second = queue(s, 'skirmish', { units: { line: 3 }, defenders: 25 }, 'small', 'karr');
    t.same([second.id, second.meta.commit.units, second.meta.commit.defenders], ['war-3-2', { line: 1 }, 5]);
  });

  test('beginning a Military Action: its record and the battle\'s line-up', function (t) {
    var s = army();
    var o = queue(s, 'raid', ALL);
    var ma = R.beginMilitaryAction(s, data, o, dice([0.5]), 0);
    t.same(Object.keys(ma), ['id', 'orderId', 'turn', 'v', 'objective', 'targetKey', 'targetName', 'tier', 'missionKey', 'commit', 'step', 'weather', 'morale', 'luck', 'spec', 'battle']);
    t.same([ma.id, ma.v, ma.tier, ma.missionKey, ma.step], ['ma-war-3-1', 2, 'small', 'bacca|raid|small', 'weather']);
    t.same(Object.keys(ma.spec), ['player', 'enemy', 'objective', 'conditions']);
    t.same([ma.spec.objective, ma.spec.conditions, ma.spec.player.units.length, ma.spec.player.leaders.length, ma.spec.player.defenders.count], ['raid', null, 7, 2, 30]);
    t.same(ma.spec.enemy, s.warMissions[ma.missionKey].enemy);
    t.ok(ma.spec.enemy !== s.warMissions[ma.missionKey].enemy, 'a copy, not the mission itself');
    t.same([s.pendingOrders.length, s.militaryActions.length], [0, 1]);
  });

  test('beginning checks the commitment again: a beast that died since can\'t march', function (t) {
    var s = army();
    var o = queue(s, 'raid', ALL);
    s.defenderBeasts = [{ name: 'Giant Vulture', qty: 1 }];
    s.defenders.count = 12;
    var ma = R.beginMilitaryAction(s, data, o, dice([0.5]), 0);
    t.same(ma.commit, { defenders: 12, lieutenants: 2, units: { line: 3, archers: 1 }, beasts: { 'Giant Vulture': 1 } });
    t.equal(ma.spec.player.units.filter(function (u) { return u.kind === 'beast'; }).length, 1);
  });

  test('after the Luck roll the line-up gets its conditions; the rolls stay the action\'s own unless it\'s called off', function (t) {
    var b = ready('raid');
    t.same(b.ma.spec.conditions, { weather: 'clear', moraleMod: W.morale.highMod, luckMod: W.luck.passMod });
    t.equal(b.s.warMissions[b.ma.missionKey].conditions, null);
    var c = ready('skirmish', { weather: 3, morale: 4, luck: 2 });
    t.same([c.ma.weather.id, c.ma.spec.conditions.moraleMod, c.ma.spec.conditions.luckMod], ['white_blizzard', W.morale.lowMod, W.luck.failMod]);
    t.equal(c.ma.spec.conditions.weather, 'white_blizzard');
  });

  test('called off and tried again: the same enemy and the same opening rolls, straight to deployment', function (t) {
    var b = ready('raid', { weather: 5, morale: 18, luck: 4 });
    var enemy = copy(b.ma.spec.enemy);
    t.ok(R.callOffMilitaryAction(b.s, b.ma.id, 0));
    var again = R.beginMilitaryAction(b.s, data, queue(b.s, 'raid', ALL), dice([0.5]), 0);
    t.same([again.step, again.weather, again.morale, again.luck], ['deploy', b.ma.weather, b.ma.morale, b.ma.luck]);
    t.same(again.spec.enemy, enemy);
    t.same(again.spec.conditions, b.ma.spec.conditions);
    t.equal(b.s.log[0].body, 'RAID vs Bacca: the conditions are unchanged: White Blizzard, morale high, luck −1.');
    t.equal(R.militaryRoll(b.s, data, again.id, 'weather', roll(20), dice([0])), null, 'no rerolling');
  });

  test('called off after Weather and Morale: the next attempt keeps both and carries on at Luck', function (t) {
    var one = { units: { line: 1 } };
    var s = army();
    var ma = R.beginMilitaryAction(s, data, queue(s, 'raid', one), dice([0.5]), 0);
    R.militaryRoll(s, data, ma.id, 'weather', roll(3), dice([0]));
    R.militaryRoll(s, data, ma.id, 'morale', roll(2), dice([0]));
    t.ok(R.callOffMilitaryAction(s, ma.id, 0));
    t.same(s.warMissions[ma.missionKey].conditions, { weather: ma.weather, morale: ma.morale, luck: null });
    var again = R.beginMilitaryAction(s, data, queue(s, 'raid', one), dice([0.5]), 0);
    t.same([again.step, again.weather, again.morale, again.luck, again.spec.conditions], ['luck', ma.weather, ma.morale, null, null]);
    t.equal(s.log[0].body, 'RAID vs Bacca: the rolls already made are unchanged: White Blizzard, morale low. Next: the Luck roll.');
    t.equal(R.militaryRoll(s, data, again.id, 'weather', roll(18), dice([0])), null, 'no rerolling the Weather');
    R.militaryRoll(s, data, again.id, 'luck', roll(15), dice([0]));
    t.same([again.step, again.spec.conditions.weather, again.spec.conditions.moraleMod], ['deploy', 'white_blizzard', W.morale.lowMod]);
    t.ok(R.callOffMilitaryAction(s, again.id, 0));
    t.same(s.warMissions[ma.missionKey].conditions.luck, again.luck, 'called off again: the Luck roll is kept too');
    var none = army();
    var first = R.beginMilitaryAction(none, data, queue(none, 'raid', one), dice([0.5]), 0);
    t.ok(R.callOffMilitaryAction(none, first.id, 0));
    t.equal(none.warMissions[first.missionKey].conditions, null, 'called off before any roll: nothing to keep');
    t.equal(R.beginMilitaryAction(none, data, queue(none, 'raid', one), dice([0.5]), 0).step, 'weather');
  });

  test('a separate war against the same mission, begun while the first is under way, makes its own rolls', function (t) {
    var one = { units: { line: 1 } };
    var s = army();
    var a = R.beginMilitaryAction(s, data, queue(s, 'raid', one), dice([0.5]), 0);
    ['weather', 'morale', 'luck'].forEach(function (st) { R.militaryRoll(s, data, a.id, st, roll(2), dice([0])); });
    var b = R.beginMilitaryAction(s, data, queue(s, 'raid', one), dice([0.5]), 0);
    t.same([b.missionKey, b.step, b.weather], [a.missionKey, 'weather', null]);
    t.equal(s.log[0].body, 'RAID vs Bacca: your forces muster for battle. The Military Action is ready to begin.');
    R.militaryRoll(s, data, b.id, 'weather', roll(18), dice([0]));
    t.ok(R.callOffMilitaryAction(s, a.id, 0));
    t.ok(R.callOffMilitaryAction(s, b.id, 0));
    t.same(s.warMissions[a.missionKey].conditions, { weather: a.weather, morale: a.morale, luck: a.luck }, 'the first called off keeps its rolls; the other\'s Weather doesn\'t mix in');
    var c = R.beginMilitaryAction(s, data, queue(s, 'raid', one), dice([0.5]), 0);
    t.same([c.step, c.weather], ['deploy', a.weather]);
  });

  test('a war order with nothing left free to march lapses, with a line in the log', function (t) {
    var s = army();
    var o = queue(s, 'raid', { beasts: { Ape: 1 } });
    s.defenderBeasts = s.defenderBeasts.filter(function (r) { return r.name !== 'Ape'; });
    t.equal(R.beginMilitaryAction(s, data, o, dice([0.5]), 0), null);
    t.same([s.pendingOrders.length, s.militaryActions.length], [0, 0]);
    t.equal(s.log[0].body, 'RAID vs Bacca: nothing committed to it is still free to march, so the war order lapses.');
  });

  test('beginning the same war order twice gives the same Military Action, once', function (t) {
    var s = army();
    var o = queue(s, 'raid', { units: { line: 2 }, beasts: { Ape: 1 } });
    var ma = R.beginMilitaryAction(s, data, o, dice([0.5]), 0);
    t.equal(R.beginMilitaryAction(s, data, o, dice([0.5]), 0), ma);
    t.same(s.militaryActions.map(function (x) { return x.id; }), ['ma-war-3-1']);
    t.equal(R.beginMilitaryAction(s, data, { id: 'nowhere', meta: o.meta }, dice([0.5]), 0), null, 'an order that isn\'t waiting');
    t.equal(s.militaryActions.length, 1);
  });

  test('Call off is refused once the battle has a result, even if nobody acted', function (t) {
    var b = ready('raid');
    var battle = battleFrom(b.ma, 'defeat');
    battle.started = false;
    t.ok(R.militaryBattleSave(b.s, b.ma.id, battle));
    t.equal(R.canCallOff(b.ma), false);
    t.equal(R.callOffMilitaryAction(b.s, b.ma.id, 0), false);
    t.same([b.s.militaryActions.length, b.s.treasuryGP], [1, 100], 'the result still has to go through the War Report');
  });

  test('a saved result can\'t be overwritten by an earlier copy of the battle, or a different result', function (t) {
    var b = ready('raid');
    var midway = battleFrom(b.ma, null);
    midway.phase = 'battle';
    midway.result = null;
    midway.round = 1;
    var over = battleFrom(b.ma, 'defeat');
    t.ok(R.militaryBattleSave(b.s, b.ma.id, midway));
    t.ok(R.militaryBattleSave(b.s, b.ma.id, over));
    t.equal(R.militaryBattleSave(b.s, b.ma.id, midway), false, 'a late save from mid-battle');
    t.equal(R.militaryBattleSave(b.s, b.ma.id, battleFrom(b.ma, 'victory')), false, 'a different result');
    t.same([b.ma.battle.result.outcome, R.militaryStatus(b.ma)], ['defeat', 'The battle is over. Next: the War Report.']);
    t.ok(R.militaryBattleSave(b.s, b.ma.id, over), 'the same result can be saved again');
  });

  test('saving the battle: only while deploying or fighting, a copy, and then it\'s under way', function (t) {
    var s = army();
    var ma = R.beginMilitaryAction(s, data, queue(s, 'raid', ALL), dice([0.5]), 0);
    var battle = battleFrom(ma, 'victory');
    battle.phase = 'deploy';
    battle.result = null;
    battle.started = false;
    battle.round = 1;
    t.equal(R.militaryBattleSave(s, ma.id, battle), false, 'not before the rolls');
    var b = ready('raid');
    t.equal(R.militaryBattleSave(b.s, b.ma.id, { phase: 'deploy' }), false, 'not a battle');
    t.equal(R.militaryStatus(b.ma), 'Rolls done. Next: deploy your forces on the War Table.');
    t.ok(R.militaryBattleSave(b.s, b.ma.id, battle));
    battle.round = 99;
    t.same([b.ma.step, b.ma.battle.round], ['deploy', 1], 'a copy is kept');
    t.equal(R.militaryStatus(b.ma), 'Deploying on the War Table.');
    battle.phase = 'battle';
    battle.round = 3;
    battle.started = true;
    t.ok(R.militaryBattleSave(b.s, b.ma.id, battle));
    t.equal(b.ma.step, 'battle');
    t.equal(R.militaryStatus(b.ma), 'Battle under way: round 3 of 6.');
    battle.phase = 'deploy';
    t.equal(R.militaryBattleSave(b.s, b.ma.id, battle), false, 'no going back to deployment');
    battle.phase = 'over';
    battle.result = { outcome: 'victory', reason: 'x', round: 3 };
    t.ok(R.militaryBattleSave(b.s, b.ma.id, battle));
    t.equal(R.militaryStatus(b.ma), 'The battle is over. Next: the War Report.');
  });

  test('Call off is refused once the first unit has acted; before that it keeps the mission', function (t) {
    var b = ready('raid');
    var battle = battleFrom(b.ma, 'victory');
    battle.phase = 'battle';
    battle.result = null;
    battle.started = false;
    R.militaryBattleSave(b.s, b.ma.id, battle);
    t.ok(R.canCallOff(b.ma));
    battle.started = true;
    R.militaryBattleSave(b.s, b.ma.id, battle);
    t.equal(R.canCallOff(b.ma), false);
    t.equal(R.callOffMilitaryAction(b.s, b.ma.id, 0), false);
    t.equal(b.s.militaryActions.length, 1);
  });

  test('Withdraw\'s preview: the defeat\'s gold and Political Capital, −4 Honour, the losses and who needs a d6', function (t) {
    var b = ready('raid');
    var battle = battleFrom(b.ma, null, hurtOpts());
    battle.phase = 'battle';
    battle.result = null;
    var lines = R.withdrawPreview(b.s, data, b.ma, battle);
    t.same(lines, [
      'Your army leaves the field and the enemy holds it: the battle counts as lost.',
      'Treasury: −50 gp.',
      'Political Capital (Bacca): +8.',
      'Clan Honour: −4.',
      'Soldiers lost: 10 from Line Infantry 2, 16 from Line Infantry 3, 30 from Archers, 4 defenders.',
      'A d6 for each of Lieutenant 2 (with Archers), Giant Vulture 1: killed, captured, wounded or recovering.',
      'Separated for 1 turn: Lieutenant 1 (with Line Infantry 3), Giant Vulture 2.'
    ]);
    battle.objective.extracted = 1;
    t.equal(R.withdrawPreview(b.s, data, b.ma, battle)[1], 'Treasury: +38 gp.', 'a raid keeps the supplies already carried off');
    t.same([b.s.treasuryGP, b.s.militaryActions.length], [100, 1], 'nothing changes');
  });

  group('Bastion war campaign: after the battle');

  test('a raid won: the casualties by each unit\'s final state, rounded to the nearest', function (t) {
    var b = ready('raid');
    var res = R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'victory', hurtOpts({ extracted: 2 })), dice([d6(3), d6(5)]), 0);
    t.ok(res);
    var mil = b.s.military;
    t.same(mil.map(function (r) { return [r.name, r.qty, r.strength || null]; }), [
      ['Lieutenant (1)', 2, null],
      ['Line Infantry (100)', 1, null],
      ['Line Infantry (100)', 1, 46],
      ['Line Infantry (100)', 1, 90],
      ['Archers (50)', 1, 30]
    ], 'Line 2 at half: 10% → 90; the one at 62 Routed: 25% → 15.5 → 16 lost; the Archers Defeated but the field held: 40% → 30');
    t.equal(mil[2].id, 'reg-a');
    t.ok(mil[3].depleted && mil[4].depleted && /^reg-/.test(mil[3].id) && mil[3].id !== mil[4].id);
    t.same(Object.keys(mil[3]), ['id', 'name', 'qty', 'strength', 'source', 'depleted']);
    t.equal(b.s.defenders.count, 30 - (0 + 1 + 3), 'support: none with Line 1, 1 of 10 with Line 2, 2.5 → 3 with Line 3');
  });

  test('a raid won: Lieutenants and beasts with fixed dice, the rewards, the war log, and the action and mission gone', function (t) {
    var b = ready('raid');
    var key = b.ma.missionKey;
    var res = R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'victory', hurtOpts({ extracted: 2, round: 4, reason: 'Two supply markers were carried off.' })), dice([d6(3), d6(5)]), 7);
    t.same(b.s.warRecovery, [
      { id: b.s.warRecovery[0].id, kind: 'lieutenant', name: 'Lieutenant 1', status: 'separated', untilTurn: 4 },
      { id: b.s.warRecovery[1].id, kind: 'lieutenant', name: 'Lieutenant 2', status: 'wounded', untilTurn: 5 },
      { id: b.s.warRecovery[2].id, kind: 'beast', name: 'Giant Vulture', status: 'recovered', untilTurn: 4 },
      { id: b.s.warRecovery[3].id, kind: 'beast', name: 'Giant Vulture', status: 'separated', untilTurn: 4 }
    ]);
    t.same([b.s.treasuryGP, b.s.politicalCapital.bacca, b.s.clanHonor], [175, -10, 46]);
    t.same([b.s.militaryActions, b.s.warMissions[key]], [[], undefined]);
    t.same(res.lines, [
      'Victory in round 4 of 6: Two supply markers were carried off.',
      'Treasury: +75 gp (now 175 gp).',
      'Political Capital (Bacca): −10.',
      'Clan Honour: +6 (now 46).',
      'Supplies carried off: 2 of 2 needed.',
      'Soldiers lost: 10 from Line Infantry 2, 16 from Line Infantry 3, 20 from Archers, 4 defenders.',
      'Lieutenant 1 (with Line Infantry 3): separated from the army, back on turn 4.',
      'Lieutenant 2 (with Archers): wounded (d6 3), back on turn 5.',
      'Giant Vulture 1: recovering (d6 5), back on turn 4.',
      'Giant Vulture 2: separated from the army, back on turn 4.'
    ]);
    t.equal(b.s.warLog.length, 1);
    t.equal(b.s.warLog[0], res.report);
    t.same([res.report.title, res.report.subtitle, res.report.at], ['Victory: RAID vs Bacca', 'Committed: 30 defenders, 2 Lieutenants, Line Infantry ×3, Archers, Giant Vulture ×2, Ape', 7]);
    t.same([b.s.log[0].title, b.s.log[0].body], ['War Turn Resolved', 'Victory: RAID vs Bacca']);
    var f = R.warForces(b.s, data);
    t.same([f.lieutenants, f.beasts], [0, { Ape: 1 }], 'the hurt can\'t be committed until they\'re back');
  });

  test('the War Report says what happened, in plain English', function (t) {
    var b = ready('raid', { weather: 5, morale: 18, luck: 9 });
    var log = [{ round: 1, side: 'player', text: 'Battle begins' }, { round: 2, side: 'enemy', text: 'Archers is Defeated.' }, { round: 3, side: 'player', text: 'Line Infantry 1 extracts a supply marker.' }];
    var d = R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'victory', hurtOpts({ extracted: 2, round: 4, reason: 'Two supply markers were carried off.', log: log })), dice([d6(3), d6(5)]), 0).report.details;
    [
      'Objective: Raid. ' + W.objectives.raid.rule,
      'Opening rolls: Weather: White Blizzard (d20 5 vs DC 12); Morale: High (d20 18 vs DC 16); Luck: −1 (d20 9 vs DC 10).',
      'Result: Victory in round 4 of 6: Two supply markers were carried off.',
      'Battle Value lost: yours 20%, the enemy\'s 70%.',
      'Your forces (start → end):',
      '- Line Infantry 1: 100 soldiers → Steady, no losses.',
      '- Line Infantry 2: 100 soldiers → Steady at half Cohesion or below, 10 lost, 90 remain.',
      '- Line Infantry 3: 62 soldiers → Routed, 16 lost, 46 remain.',
      '- Defenders supporting Line Infantry 3: 10 → Routed, 3 lost.',
      '- Giant Vulture 1: Defeated, recovering (d6 5), back on turn 4.',
      '- Ape: Steady.',
      '- Lieutenant 2 (with Archers): Defeated, wounded (d6 3), back on turn 5.',
      'Enemy forces (start → end):',
      'Key moments:',
      '- Round 2: Archers is Defeated.',
      '- Round 3: Line Infantry 1 extracts a supply marker.',
      'Changes to the Bastion:',
      '- Treasury: +75 gp (now 175 gp).',
      '- Defenders: −4 (now 26, from 30).'
    ].forEach(function (line) { t.ok(d.indexOf(line) !== -1, 'missing: ' + line + '\n' + d); });
    t.ok(/^Enemy: Bacca, small local force \((smaller than usual|as expected|larger than usual)\), Battle Value 17\. Your army: Battle Value 39\.$/m.test(d), d);
    t.equal(d.indexOf('Battle begins'), -1, 'only the important moments');
  });

  test('applied once: a second finish, an unknown action or a battle with no result changes nothing', function (t) {
    var b = ready('raid');
    var battle = battleFrom(b.ma, 'victory', hurtOpts({ extracted: 2 }));
    var unfinished = copy(battle);
    unfinished.result = null;
    t.equal(R.finishBattle(b.s, data, b.ma.id, unfinished, dice([0.5]), 0), null);
    unfinished.result = { outcome: 'triumph' };
    t.equal(R.finishBattle(b.s, data, b.ma.id, unfinished, dice([0.5]), 0), null);
    t.equal(b.s.militaryActions.length, 1);
    t.ok(R.finishBattle(b.s, data, b.ma.id, battle, dice([0.5]), 0));
    var after = JSON.stringify(b.s);
    t.equal(R.finishBattle(b.s, data, b.ma.id, battle, dice([0.5]), 0), null);
    t.equal(R.finishBattle(b.s, data, 'nope', battle, dice([0.5]), 0), null);
    t.equal(JSON.stringify(b.s), after);
  });

  test('a mission still wanted by another war order is kept, without this battle\'s opening rolls', function (t) {
    var b = ready('raid', { commit: { units: { line: 1 } } });
    var next = queue(b.s, 'raid', { units: { line: 1 } });
    t.equal(next.meta.missionKey, b.ma.missionKey);
    R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'victory', { extracted: 2 }), dice([0.5]), 0);
    t.ok(b.s.warMissions[b.ma.missionKey], 'kept for the waiting order');
    t.equal(b.s.warMissions[b.ma.missionKey].conditions, null);
    var ma2 = R.beginMilitaryAction(b.s, data, next, dice([0.5]), 0);
    t.same([ma2.step, ma2.spec.enemy], ['weather', b.ma.spec.enemy], 'the same enemy, fresh opening rolls');
    R.finishBattle(b.s, data, ma2.id, battleFrom(ma2, 'draw', {}), dice([0.5]), 0);
    t.same(b.s.warMissions, {});
  });

  test('the battle saved on the action is used when none is passed', function (t) {
    var b = ready('skirmish');
    R.militaryBattleSave(b.s, b.ma.id, battleFrom(b.ma, 'draw'));
    var res = R.finishBattle(b.s, data, b.ma.id, null, dice([0.5]), 0);
    t.equal(res.report.title, 'Draw: SKIRMISH vs Bacca');
  });

  test('a skirmish lost: 60% for the Defeated, the defeat\'s gold and Political Capital; captured on a 2, killed on a 1', function (t) {
    var b = ready('skirmish');
    var res = R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'defeat', hurtOpts()), dice([d6(2), d6(1)]), 0);
    t.same([b.s.treasuryGP, b.s.politicalCapital.bacca, b.s.clanHonor], [70, 6, 32]);
    t.same(b.s.military.filter(function (r) { return /Archers/.test(r.name); }), [{ id: b.s.military[4].id, name: 'Archers (50)', qty: 1, strength: 20, source: 'War Room', depleted: true }], '60% of 50 lost');
    t.equal(b.s.military[0].qty, 1, 'Lieutenant 2 was captured');
    t.same(b.s.defenderBeasts, [{ name: 'Giant Vulture', qty: 1, source: 'Menagerie' }, { name: 'Ape', qty: 1, source: 'Menagerie' }], 'Giant Vulture 1 was killed');
    t.same(b.s.warRecovery.map(function (r) { return [r.name, r.status]; }), [['Lieutenant 1', 'separated'], ['Giant Vulture', 'separated']]);
    t.ok(res.lines.indexOf('Lieutenant 2 (with Archers): captured by the enemy (d6 2).') !== -1);
    t.ok(res.lines.indexOf('Giant Vulture 1: killed (d6 1).') !== -1);
    t.equal(res.report.title, 'Defeat: SKIRMISH vs Bacca');
  });

  test('a draw changes no gold or standing; the Defeated lose 40%, and a 2 is badly wounded, not captured', function (t) {
    var b = ready('skirmish');
    var res = R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'draw', hurtOpts()), dice([d6(2), d6(4)]), 0);
    t.same([b.s.treasuryGP, b.s.politicalCapital.bacca, b.s.clanHonor], [100, 0, 40]);
    t.equal(b.s.military[4].strength, 30);
    t.same(b.s.warRecovery.map(function (r) { return [r.name, r.status, r.untilTurn]; }), [
      ['Lieutenant 1', 'separated', 4], ['Lieutenant 2', 'badly_wounded', 3 + W.badlyWoundedTurns], ['Giant Vulture', 'wounded', 5], ['Giant Vulture', 'separated', 4]
    ]);
    t.equal(b.s.military[0].qty, 2);
    t.same(res.lines.slice(1, 4), ['Treasury: no change.', 'Political Capital (Bacca): no change.', 'Clan Honour: no change (now 40).']);
  });

  test('a withdrawal: the defeat\'s gold and Political Capital, −4 Honour, and losses as a lost field', function (t) {
    var b = ready('raid');
    var res = R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'withdrawal', hurtOpts({ round: 3 })), dice([d6(6), d6(6)]), 0);
    t.same([b.s.treasuryGP, b.s.politicalCapital.bacca, b.s.clanHonor], [50, 8, 36]);
    t.equal(b.s.military[4].strength, 20, 'Defeated with the field lost: 60%');
    t.equal(res.report.title, 'Withdrawal: RAID vs Bacca');
  });

  test('a raid\'s gold follows the supplies carried off: half for one, the defeat\'s for none', function (t) {
    var one = ready('raid');
    R.finishBattle(one.s, data, one.ma.id, battleFrom(one.ma, 'defeat', { extracted: 1 }), dice([0.5]), 0);
    t.same([one.s.treasuryGP, one.s.politicalCapital.bacca], [100 + Math.round(75 / 2), 8]);
    var none = ready('raid');
    R.finishBattle(none.s, data, none.ma.id, battleFrom(none.ma, 'defeat', {}), dice([0.5]), 0);
    t.equal(none.s.treasuryGP, 50);
  });

  test('every objective\'s amounts: Defend won, Seize Outpost lost', function (t) {
    var d = ready('defend');
    R.finishBattle(d.s, data, d.ma.id, battleFrom(d.ma, 'victory', {}), dice([0.5]), 0);
    t.same([d.s.treasuryGP, d.s.politicalCapital.bacca, d.s.clanHonor, d.s.warLog[0].title], [100, 6, 46, 'Victory: DEFEND vs Bacca']);
    var z = ready('seize_outpost');
    R.finishBattle(z.s, data, z.ma.id, battleFrom(z.ma, 'defeat', {}), dice([0.5]), 0);
    t.same([z.s.treasuryGP, z.s.politicalCapital.bacca, z.s.clanHonor], [40, 10, 32]);
    var k = ready('skirmish');
    R.finishBattle(k.s, data, k.ma.id, battleFrom(k.ma, 'victory', {}), dice([0.5]), 0);
    t.same([k.s.treasuryGP, k.s.politicalCapital.bacca, k.s.military.length], [140, -6, 4], 'nobody hurt: the list is unchanged');
  });

  test('when a limit is reached, the lines and the War Report give what actually changed', function (t) {
    var s = army();
    s.treasuryGP = 20;
    s.clanHonor = 3;
    s.politicalCapital.bacca = 97;
    var b = ready('seize_outpost', { s: s });
    var battle = battleFrom(b.ma, 'defeat', {});
    t.same(R.withdrawPreview(b.s, data, b.ma, battle).slice(1, 4), [
      'Treasury: −20 gp (−60 gp, but the treasury can\'t go below 0).',
      'Political Capital (Bacca): +3 (+10, but it can\'t go above 100).',
      'Clan Honour: −3 (−4, but it can\'t go below 0).'
    ]);
    var res = R.finishBattle(b.s, data, b.ma.id, battle, dice([0.5]), 0);
    t.same([b.s.treasuryGP, b.s.politicalCapital.bacca, b.s.clanHonor], [0, 100, 0]);
    t.same(res.lines.slice(1, 4), [
      'Treasury: −20 gp (−60 gp, but the treasury can\'t go below 0; now 0 gp).',
      'Political Capital (Bacca): +3 (+10, but it can\'t go above 100).',
      'Clan Honour: −3 (−8, but it can\'t go below 0; now 0).'
    ]);
    t.ok(res.report.details.indexOf('- Treasury: −20 gp (−60 gp, but the treasury can\'t go below 0; now 0 gp).') !== -1, res.report.details);
    var m = army();
    m.organization.type = 'merc';
    m.trustedClientsByClan.bacca = 3;
    m.trustedClientsByClan.karr = 100;
    var k = ready('skirmish', { s: m, commit: { defenders: 30 } });
    var lines = R.finishBattle(k.s, data, k.ma.id, battleFrom(k.ma, 'victory', {}), dice([0.5]), 0).lines;
    t.ok(lines.indexOf('Trusted Clients: Bacca −3 (−8, but it can\'t go below 0), every other clan +1 except Karr (already at 100).') !== -1, lines.join(' | '));
    t.same([k.s.trustedClientsByClan.bacca, k.s.trustedClientsByClan.karr, k.s.trustedClientsByClan.slade], [0, 100, 51]);
  });

  test('Key moments: chosen by the kind of each log entry, the most important kept, never Hold orders', function (t) {
    var b = ready('seize_outpost');
    var log = [
      { round: 1, side: null, text: 'Battle begins. Round 1: your forces act first.', kind: 'round' },
      { round: 1, side: 'player', text: 'Line Infantry 1 marches 4 squares.', kind: 'move' },
      { round: 1, side: 'enemy', text: 'Levy Infantry holds its nerve: 12 vs DC 10.', kind: 'morale' },
      { round: 2, side: null, text: 'Round 2 ends. You hold the outpost (1 round end in a row).', kind: 'round' },
      { round: 2, side: null, text: 'Round 3 begins: the enemy acts first.', kind: 'round' },
      { round: 3, side: 'enemy', text: 'Levy Infantry routs: 3 vs DC 10. It flees the field.', kind: 'routed' },
      { round: 3, side: null, text: 'Round 3 ends. Nobody holds the outpost.', kind: 'round' },
      { round: 3, side: null, text: 'Victory. You held the outpost at 2 round ends in a row.', kind: 'result' }
    ];
    var i;
    for (i = 0; i < 30; i++) log.splice(1, 0, { round: 1, side: 'enemy', text: 'Unit ' + i + ' holds: +2 Defence until its next activation, and no Charge bonus against it.', kind: 'hold' });
    for (i = 0; i < 25; i++) log.splice(1, 0, { round: 1, side: 'player', text: 'Unit ' + i + ' is Shaken: 4 vs DC 10.', kind: 'shaken' });
    var d = R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'victory', { log: log }), dice([0.5]), 0).report.details;
    var moments = d.split('Key moments:\n')[1].split('\n\n')[0].split('\n');
    t.equal(moments.length, 20, 'at most 20, the Shaken lines going first');
    t.same(moments.slice(-3), [
      '- Round 2: Round 2 ends. You hold the outpost (1 round end in a row).',
      '- Round 3: Levy Infantry routs: 3 vs DC 10. It flees the field.',
      '- Round 3: Victory. You held the outpost at 2 round ends in a row.'
    ], 'the rout, the outpost held and the result all kept, in the order they happened');
    ['holds: +2 Defence', 'holds its nerve', 'Battle begins', 'Round 3 begins', 'marches', 'Nobody holds'].forEach(function (x) { t.equal(d.indexOf(x), -1, x); });
  });

  test('enemy units that left the field with their broken army are reported as withdrawn, not Steady', function (t) {
    var b = ready('seize_outpost');
    var e = b.ma.spec.enemy.units;
    t.ok(e.length >= 3, e.length + ' enemy units');
    var set = {};
    set[e[0].id] = { status: 'defeated', cohesion: 0 };
    set[e[1].id] = { withdrawn: true };
    set[e[2].id] = { status: 'shaken', withdrawn: true };
    var d = R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'defeat', { set: set }), dice([0.5]), 0).report.details;
    ['- ' + e[0].label + ': Defeated.', '- ' + e[1].label + ': Withdrew with its army.', '- ' + e[2].label + ': Shaken, and withdrew with its army.'].forEach(function (line) {
      t.ok(d.indexOf(line) !== -1, 'missing: ' + line + '\n' + d);
    });
  });

  test('a regiment with nobody left is removed; a detachment\'s losses come off the defenders', function (t) {
    var s = army();
    s.military[2].strength = 1;
    var b = ready('raid', { s: s, commit: { units: { line: 3 }, defenders: 30 } });
    R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'defeat', {
      detachment: 25,
      set: { 'p-line-1': { status: 'defeated', cohesion: 0 }, 'p-line-3': { status: 'defeated', cohesion: 0 }, 'p-def-1': { status: 'defeated', cohesion: 0 } }
    }), dice([0.5]), 0);
    t.same(b.s.military.map(function (r) { return [r.name, r.qty, r.strength || null]; }), [
      ['Lieutenant (1)', 2, null], ['Line Infantry (100)', 1, null], ['Line Infantry (100)', 1, 40], ['Archers (50)', 1, null]
    ], 'Line Infantry 1: 60 lost; the one with a single soldier is gone');
    t.equal(b.s.defenders.count, 30 - 15, '60% of a detachment of 25');
  });

  test('the same battle gives the same depleted rows, with ids from a hash', function (t) {
    function run() {
      var b = ready('raid');
      R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'victory', hurtOpts({ extracted: 2 })), dice([d6(3), d6(5)]), 0);
      return b.s.military.filter(function (r) { return r.depleted; }).map(function (r) { return r.id; });
    }
    var a = run();
    t.same(a, run());
    t.ok(a.every(function (id) { return /^reg-[0-9a-f]+$/.test(id) || id === 'reg-a'; }), a.join(', '));
  });

  test('a Brigade\'s Trusted Clients change as before: the target down, everyone else up after a win', function (t) {
    var s = army();
    s.organization.type = 'merc';
    var b = ready('skirmish', { s: s, commit: { defenders: 30, beasts: { Ape: 1 } } });
    R.finishBattle(b.s, data, b.ma.id, battleFrom(b.ma, 'victory', {}), dice([0.5]), 0);
    t.same([b.s.trustedClientsByClan.bacca, b.s.trustedClientsByClan.karr, b.s.politicalCapital.bacca, b.s.clanHonor], [42, 51, -6, 40]);
    var c = ready('skirmish', { s: (function () { var x = army(); x.organization.type = 'merc'; return x; }()), commit: { defenders: 30 } });
    var res = R.finishBattle(c.s, data, c.ma.id, battleFrom(c.ma, 'withdrawal', {}), dice([0.5]), 0);
    t.same([c.s.trustedClientsByClan.bacca, c.s.trustedClientsByClan.slade], [46, 49]);
    t.ok(res.lines.indexOf('Trusted Clients: Bacca −4, every other clan −1.') !== -1, res.lines.join(' | '));
  });

  group('Bastion war campaign: recovery and saving');

  test('each Bastion turn, anyone whose recovery is over is fit again', function (t) {
    var s = army();
    s.turn = 4;
    s.warRecovery = [
      { id: 'a', kind: 'lieutenant', name: 'Lieutenant 1', status: 'wounded', untilTurn: 5 },
      { id: 'b', kind: 'beast', name: 'Giant Vulture', status: 'recovered', untilTurn: 5 },
      { id: 'c', kind: 'lieutenant', name: 'Lieutenant 2', status: 'separated', untilTurn: 4 },
      { id: 'd', kind: 'beast', name: 'Ape', status: 'badly_wounded', untilTurn: 7 }
    ];
    t.same(R.warForces(s, data).lieutenants, 0);
    R.startTurn(s, 0);
    t.same(s.warRecovery.map(function (r) { return r.id; }), ['d']);
    t.same(s.log.slice(0, 3).map(function (l) { return [l.title, l.body]; }), [
      ['War Recovery', 'Lieutenant 2 has found the way back to the Bastion.'],
      ['War Recovery', 'The Giant Vulture is fit to fight again.'],
      ['War Recovery', 'Lieutenant 1 is fit for duty again.']
    ]);
    t.same([R.warForces(s, data).lieutenants, R.warForces(s, data).beasts], [2, { 'Giant Vulture': 2 }]);
    t.same(R.tickRecovery(s, 0), [], 'nothing more this turn');
    t.equal(R.recoveryText(s.warRecovery[0]), 'Ape: badly wounded, back on turn 7.');
  });

  test('a save and reload keeps the missions, recovery, the mission counter, depleted regiments and a battle under way', function (t) {
    var b = ready('raid');
    var battle = battleFrom(b.ma, 'victory', hurtOpts());
    battle.phase = 'battle';
    battle.result = null;
    battle.round = 2;
    R.militaryBattleSave(b.s, b.ma.id, battle);
    R.ensureMission(b.s, data, 'slade', 'defend', 'major');
    b.s.warRecovery = [{ id: 'rec-1', kind: 'beast', name: 'Ape', status: 'wounded', untilTurn: 5 }];
    queue(b.s, 'skirmish', { defenders: 0, units: { archers: 0 }, beasts: {}, lieutenants: 0 }, 'small', 'karr');
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(b.s))), data);
    t.same(back, b.s);
    t.same([back.warMissionSeq, Object.keys(back.warMissions).length, back.militaryActions[0].step, back.militaryActions[0].battle.round], [2, 2, 'battle', 2]);
    t.same(R.fromSave(JSON.parse(JSON.stringify(back)), data), back, 'loading twice changes nothing');
  });

  test('damaged war records are tidied or dropped; damaged lists are refused', function (t) {
    var save = R.toSave(army());
    save.military.push(
      { name: 'Line Infantry (100)', qty: 3, strength: 150, depleted: true },
      { name: 'Archers (50)', strength: 0, depleted: true },
      { name: 'Heavy Infantry (50)', strength: '20', depleted: true },
      { id: 'reg-a', name: 'Line Infantry (100)', strength: 50, depleted: true },
      { name: 'Ape', strength: 3, depleted: true }
    );
    save.warRecovery = ['x', { kind: 'dragon', name: 'Smaug' }, { kind: 'beast', name: 'Ape', status: 'wounded', untilTurn: '6' }];
    save.warMissions = { 'a|b|c': { key: 'zzz', enemy: { units: [] } }, 'k|raid|small': { key: 'k|raid|small', enemy: { units: [], leaders: [] } } };
    save.warMissionSeq = '4';
    var back = R.fromSave(save, data);
    t.same(back.military.slice(4).map(function (r) { return [r.id || null, r.name, r.qty, r.strength || null]; }), [
      [null, 'Line Infantry (100)', 3, null],
      [back.military[5].id, 'Heavy Infantry (50)', 1, 20],
      ['reg-a-2', 'Line Infantry (100)', 1, 50],
      [null, 'Ape', 1, null]
    ], 'full strength becomes an ordinary row (keeping its count), nobody left is removed, ids are added and kept apart');
    t.ok(/^reg-/.test(back.military[5].id));
    t.same(back.warRecovery, [{ id: 'rec-0', kind: 'beast', name: 'Ape', status: 'wounded', untilTurn: 6 }]);
    t.same(Object.keys(back.warMissions), ['k|raid|small']);
    t.equal(back.warMissionSeq, 4);
    t.ok(R.saveProblem(Object.assign(R.toSave(army()), { warRecovery: 'x' })));
    t.ok(R.saveProblem(Object.assign(R.toSave(army()), { warMissions: [] })));
  });

  test('loading: a full regiment carrying its strength keeps its count; a depleted row counting several becomes that many', function (t) {
    var save = R.toSave(army());
    save.military = [
      { name: 'Line Infantry (100)', qty: 3, strength: 100, source: 'War Room' },
      { name: 'Archers (50)', qty: 2, strength: 50, depleted: false, source: 'War Room' },
      { id: 'reg-x', name: 'Heavy Infantry (50)', qty: 2, strength: 30, source: 'War Room', depleted: true },
      { name: 'Levy Infantry (150)', qty: 1, strength: null, source: 'War Room' }
    ];
    var back = R.fromSave(JSON.parse(JSON.stringify(save)), data);
    t.same(back.military, [
      { name: 'Line Infantry (100)', qty: 3, source: 'War Room' },
      { name: 'Archers (50)', qty: 2, source: 'War Room' },
      { id: 'reg-x', name: 'Heavy Infantry (50)', qty: 1, strength: 30, source: 'War Room', depleted: true },
      { id: 'reg-x-2', name: 'Heavy Infantry (50)', qty: 1, strength: 30, source: 'War Room', depleted: true },
      { name: 'Levy Infantry (150)', qty: 1, strength: null, source: 'War Room' }
    ]);
    t.equal(R.warAvailable(back, data).regiments, 3 + 2 + 2 + 1, 'nobody lost');
    t.same(R.fromSave(JSON.parse(JSON.stringify(R.toSave(back))), data).military, back.military, 'loading again changes nothing');
  });

  test('a phase 1 Military Action is upgraded: Line Infantry, a mission, a line-up, and no regiment used twice', function (t) {
    var save = R.toSave(army());
    var clear = { d20: 15, total: 15, dc: 12, pass: true, id: 'clear' };
    save.militaryActions = [
      { id: 'ma-1', orderId: '1', turn: 2, objective: 'skirmish', targetKey: 'karr', targetName: 'Karr', commit: { defenders: 10, beasts: 2, lieutenants: 1, regiments: 2 },
        forces: [{ id: 'reg-1', kind: 'regiment', label: 'Regiment 1' }], step: 'resolve', weather: clear, morale: { d20: 14, total: 14, dc: 12, pass: true }, luck: { d20: 3, total: 3, dc: 10, pass: false, mod: -1 },
        deployment: { started: true, locked: true, positions: { 'reg-1': { x: 0.5, y: 0.7 } } } },
      { id: 'ma-2', orderId: '2', turn: 2, objective: 'raid', targetKey: 'slade', targetName: 'Slade', commit: { defenders: 30, beasts: 1, lieutenants: 2, regiments: 2 }, forces: [], step: 'weather', weather: null, morale: null, luck: null }
    ];
    var back = R.fromSave(save, data);
    var a = back.militaryActions[0], b = back.militaryActions[1];
    t.same([a.v, a.tier, a.missionKey, a.step, a.forces, a.deployment], [2, 'established', 'karr|skirmish|established', 'deploy', undefined, undefined]);
    t.same(a.commit, { defenders: 10, lieutenants: 1, units: { line: 2 }, beasts: { 'Giant Vulture': 2 } });
    t.same(a.spec.player.units.map(function (u) { return u.label; }), ['Line Infantry 1', 'Line Infantry 2', 'Giant Vulture 1', 'Giant Vulture 2']);
    t.same(a.spec.conditions, { weather: 'clear', moraleMod: W.morale.highMod, luckMod: W.luck.failMod });
    t.equal(back.warMissions[a.missionKey].conditions, null, 'its opening rolls stay its own (it hasn\'t been called off)');
    t.same(b.commit, { defenders: 20, lieutenants: 1, units: { line: 1 }, beasts: { Ape: 1 } }, 'only what the first left over: its beast is the Ape, as both Vultures are taken');
    t.same(b.spec.player.units.map(function (u) { return u.personnel; }), [62, 1]);
    t.same([b.step, back.warMissionSeq], ['weather', 2]);
    t.same(R.fromSave(JSON.parse(JSON.stringify(back)), data), back);
  });

  test('a phase 1 war order still waiting becomes a Military Action against an established local force', function (t) {
    var s = army();
    R.queueWarAction(s, { objective: 'defend', targetKey: 'molten', targetName: 'Molten', commitDefenders: 5, commitBeasts: 1, commitLieutenants: 1, commitRegiments: 1 }, dice([0.3]));
    var ma = R.beginMilitaryAction(s, data, s.pendingOrders[0], dice([0.5]), 0);
    t.same([ma.tier, ma.missionKey, ma.commit], ['established', 'molten|defend|established', { defenders: 5, lieutenants: 1, units: { line: 1 }, beasts: { 'Giant Vulture': 1 } }]);
  });

  test('the War Table\'s painted terrain is checked on import', function (t) {
    var good = { none: { cols: 2, rows: 2, cells: '.w.x' }, 'map-abc': { cols: 22, rows: 12, cells: new Array(265).join('.') } };
    t.ok(R.isWarTerrain(good));
    t.ok(R.isWarTerrain({}));
    t.equal(R.importProblem([{ key: 'tsi.bastion.warTerrain', value: good }]), null);
    [
      { none: { cols: 2, rows: 2, cells: '.w.' } },
      { none: { cols: 2, rows: 2, cells: '.w.z' } },
      { none: { cols: 0, rows: 2, cells: '' } },
      { none: { cols: 2, rows: 1.5, cells: '...' } },
      { none: 'painted' },
      ['x'],
      'x'
    ].forEach(function (bad) {
      t.ok(/battle terrain/.test(R.importProblem([{ key: 'tsi.bastion.warTerrain', value: bad }]) || ''), JSON.stringify(bad));
    });
  });

  group('Bastion war campaign: stat blocks');

  test('a unit\'s profile by its War Room label, id, name or beast name', function (t) {
    var p = R.unitProfile(data, 'Archers (50)');
    t.same([p.name, p.attack, p.rangedAttack, p.range, p.bv, p.traits, p.distinction], ['Archers', 1, 4, 6, 5, [], 'Range 6.']);
    t.same(R.unitProfile(data, 'shock_cav').traits, ['strong_charge']);
    t.same(R.unitProfile(data, 'Regiment (100)').name, 'Line Infantry');
    t.same([R.unitProfile(data, 'giant vulture').name, R.unitProfile(data, 'Giant Vulture').traits], ['Giant Vulture', ['flight']]);
    t.same(R.unitProfile(data, 'Lieutenant (1)'), { kind: 'lieutenant', name: 'Lieutenant' });
    t.equal(R.unitProfile(data, 'Dragon'), null);
  });

  test('a Menagerie beast with no profile in the data file shows the default it fights with', function (t) {
    var p = R.unitProfile(data, 'Mystery Beast', { beast: true });
    t.same([p.name, p.kind, p.bv, p.traits, p.distinction], ['Mystery Beast', 'beast', W.beastDefault.bv, [W.beastDefault.trait], W.beastDefault.distinction]);
    var side = R.playerSide((function () { var s = army(); s.defenderBeasts = [{ name: 'Mystery Beast', qty: 1 }]; return s; }()), data, { beasts: { 'Mystery Beast': 1 } });
    ['cohesion', 'attack', 'defence', 'move', 'resolve', 'bv'].forEach(function (k) { t.equal(p[k], side.units[0].profile[k], k + ' as it fights'); });
    var b = R.unitStatBlock(data, 'Mystery Beast', { beast: true });
    t.equal(b.title, 'Mystery Beast');
    t.equal(b.rows.filter(function (r) { return r.key === 'bv'; })[0].value, String(W.beastDefault.bv));
    t.equal(R.unitStatBlock(data, 'Mystery Beast'), null, 'without { beast: true } an unknown name is still nothing');
    t.equal(R.unitStatBlock(data, 'Ape', { beast: true }).title, 'Ape');
  });

  test('the stat block: signed Attack and Resolve, archers\' two attacks, the traits and the distinction', function (t) {
    var b = R.formatStatBlock(R.unitProfile(data, 'Archers (50)'), data);
    t.same(b.rows.map(function (r) { return [r.key, r.value]; }), [['cohesion', '4'], ['attack', '+4 ranged / +1 melee'], ['defence', '11'], ['move', '3'], ['resolve', '+0'], ['bv', '5']]);
    t.equal(b.rows[0].text, W.stats[0].text);
    t.same([b.title, b.traits, b.distinction], ['Archers', [], 'Range 6.']);
    var j = R.formatStatBlock(R.unitProfile(data, 'Jackal'), data);
    t.equal(j.rows[4].value, '−1');
    t.equal(b.rows[1].text, W.stats[1].text + ' Ranged attacks reach 6 squares.');
    t.same(j.traits, [{ id: 'pack', name: 'Pack', text: W.traits.pack.text }]);
    t.same(R.formatStatBlock(R.unitProfile(data, 'Lieutenant (1)'), data), {
      title: 'Lieutenant',
      rows: [
        { key: 'resolve', name: 'Resolve', value: '+2', text: 'Added to the Resolve of the formation it leads.' },
        { key: 'bv', name: 'Battle Value', value: '2', text: W.stats[5].text }
      ],
      traits: [], distinction: W.lieutenant.text, notes: []
    });
    ['Line Infantry (100)', 'Archers (50)', 'Giant Vulture', 'Lieutenant (1)'].forEach(function (what) {
      var any = R.unitStatBlock(data, what);
      t.ok(any && any.title && Array.isArray(any.rows) && Array.isArray(any.traits) && typeof any.distinction === 'string', what + ': the same shape from the battle rules or here');
    });
    t.equal(R.unitStatBlock(data, 'Archers (50)').rows.filter(function (r) { return r.key === 'attack'; })[0].value, '+4 ranged / +1 melee');
    t.equal(R.unitStatBlock(data, 'Dragon'), null);
  });
}());
