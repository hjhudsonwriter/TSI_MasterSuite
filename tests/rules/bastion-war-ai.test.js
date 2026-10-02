/* The Ironbow Bastion Manager's war battle, the enemy's commander: tools/bastion/war-ai.js */
(function () {
  var BR = TSI.bastion.battleRules;
  var AI = TSI.bastion.warAI;
  var W = window.TSI_DATA.bastionWar;

  /* ---------- Helpers ---------- */
  function U(id, type, extra) {
    var a = W.archetypes[type];
    return Object.assign({ id: id, kind: 'formation', type: type, name: a.name, label: a.name + ' ' + id.replace(/\D/g, ''), personnel: a.size, size: a.size, variant: null, source: { key: id } }, extra || {});
  }
  function Beast(id, name) {
    return { id: id, kind: 'beast', type: 'beast', name: name, label: name + ' ' + id.replace(/\D/g, ''), source: { beast: name } };
  }
  var CLEAR = { weather: 'clear', moraleMod: 0, luckMod: 0 };
  /* No map: 22 × 12, strip rows 5 and 6, the enemy in rows 0–4, you in rows 7–11.
     Raid markers at (4,3), (11,3), (17,3); the outpost c9–12, r1–2; your depot c9–12, r8–9. */
  function make(player, enemy, opts) {
    var o = opts || {};
    return BR.createBattle({
      player: { units: player || [], leaders: o.leaders || [] },
      enemy: { units: enemy || [], leaders: o.captains || [] },
      objective: o.objective || 'skirmish',
      conditions: Object.assign({}, CLEAR, o.conditions || {}),
      cols: o.cols
    }, o.board === undefined ? null : o.board);
  }
  /* Straight into the battle with units exactly where a test wants them;
     units not listed are off the board. The enemy's turn unless opts.turn. */
  function fight(battle, where, opts) {
    BR.beginDeployment(battle, null);
    BR.startBattle(battle);
    battle.units.forEach(function (u) { u.pos = null; });
    Object.keys(where).forEach(function (id) {
      BR.unitById(battle, id).pos = { c: where[id][0], r: where[id][1] };
    });
    battle.turnSide = (opts && opts.turn) || 'enemy';
    return battle;
  }
  function unit(b, id) { return BR.unitById(b, id); }
  function at(c, r) { return { c: c, r: r }; }
  function d20(v) { return function () { return (v - 1) / 20 + 0.001; }; }
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* A painting for this battle: marks { 'c,r': code }. */
  function paint(battle, marks) {
    var cells = '';
    for (var r = 0; r < battle.rows; r++) for (var c = 0; c < battle.cols; c++) cells += marks[c + ',' + r] || '.';
    return { cols: battle.cols, rows: battle.rows, cells: cells };
  }
  /* A raid marker carried by a unit. */
  function carry(b, unitId, markerId) {
    var u = unit(b, unitId);
    var m = b.objective.markers.filter(function (x) { return x.id === markerId; })[0];
    u.carrying = m.id;
    m.state = 'carried';
    m.carrier = u.id;
    m.c = u.pos.c;
    m.r = u.pos.r;
  }
  /* Carry the order out (it must be legal) and return the result. */
  function act(t, b, order, terrain, rand) {
    var res = BR.resolveOrder(b, order, terrain || null, rand || d20(10));
    t.ok(res.ok, 'the AI\'s order should be legal: ' + JSON.stringify(order) + ' → ' + res.why);
    return res;
  }
  function attackEvent(res) { return res.events.filter(function (e) { return e.kind === 'attack'; })[0]; }
  function snapshot(b) { return JSON.stringify(b); }
  /* How many of the other side's units could reach a square next activation
     (the AI's own cautious count: Move + 1). */
  function reachCount(b, side, cell) {
    return BR.enemiesOf(b, side).filter(function (o) { return BR.dist(o.pos, cell) <= BR.effectiveMove(b, o) + 1; }).length;
  }

  /* A random battle for the legality and whole-battle tests. */
  var TYPES = ['levy', 'line', 'heavy', 'archers', 'light_cav', 'shock_cav'];
  var BEASTS = Object.keys(W.beasts);
  var CODES = W.terrain.map(function (x) { return x.code; });
  function randomBattle(seed, objective, opts) {
    var rng = seeded(seed);
    var o = opts || {};
    function pick(list) { return list[Math.floor(rng() * list.length)]; }
    function army(side, n) {
      var out = [];
      for (var i = 0; i < n; i++) {
        var id = (side === 'player' ? 'p' : 'e') + (i + 1);
        out.push(rng() < 0.15 ? Beast(id, pick(BEASTS)) : U(id, pick(TYPES)));
      }
      return out;
    }
    var np = o.n || 3 + Math.floor(rng() * 6);
    var ne = o.n || 3 + Math.floor(rng() * 6);
    var board = o.board !== undefined ? o.board : (rng() < 0.3 ? null : { w: 1600, h: 900 + Math.floor(rng() * 1500) });
    var b = BR.createBattle({
      player: { units: army('player', np), leaders: [{ id: 'lt-1', name: 'Lieutenant Ash' }], defenders: rng() < 0.3 ? { count: 40 + Math.floor(rng() * 200), armed: rng() < 0.7 } : null },
      enemy: { units: army('enemy', ne), leaders: [{ id: 'c1', name: 'Captain Vex' }] },
      objective: objective,
      conditions: { weather: pick(Object.keys(W.weather)), moraleMod: pick([2, -2, 0]), luckMod: pick([1, -1, 0]) },
      cols: o.cols || 20 + Math.floor(rng() * 5)
    }, board);
    var terrain = null;
    if (o.terrain !== false && rng() < 0.7) {
      var cells = '';
      for (var i = 0; i < b.cols * b.rows; i++) cells += rng() < 0.75 ? '.' : pick(CODES);
      terrain = { cols: b.cols, rows: b.rows, cells: cells };
    }
    BR.beginDeployment(b, terrain);
    BR.startBattle(b);
    return { battle: b, terrain: terrain };
  }
  var OBJECTIVES = ['skirmish', 'raid', 'defend', 'seize_outpost'];

  /* ---------- When it acts ---------- */
  group('War AI: when it acts');

  test('the commander is there, with its functions', function (t) {
    ['chooseOrder', 'plans', 'planFor', 'expectedDamage', 'playOut'].forEach(function (f) {
      t.equal(typeof AI[f], 'function', f);
    });
  });

  test('no order before the battle, after it, or when it isn\'t that side\'s turn', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')]);
    t.equal(AI.chooseOrder(b, null), null, 'setup');
    BR.beginDeployment(b, null);
    t.equal(AI.chooseOrder(b, null), null, 'deploying');
    BR.startBattle(b);
    b.turnSide = 'player';
    t.equal(AI.chooseOrder(b, null), null, 'your turn: nothing for the enemy');
    t.equal(AI.chooseOrder(b, null, 'enemy'), null);
    t.ok(AI.chooseOrder(b, null, 'player'), 'your side can be played on your turn');
    b.turnSide = 'enemy';
    t.ok(AI.chooseOrder(b, null), 'the enemy\'s turn');
    BR.withdraw(b);
    t.equal(AI.chooseOrder(b, null), null, 'over');
    t.equal(AI.chooseOrder(null, null), null, 'no battle at all');
  });

  test('no order when the side has nobody left to act', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line')]), { p1: [10, 9], e1: [5, 1], e2: [15, 1] });
    unit(b, 'e1').activated = true;
    unit(b, 'e2').activated = true;
    t.equal(AI.chooseOrder(b, null), null);
    t.same(AI.plans(b, null, 'enemy'), []);
  });

  test('the enemy is the default side; the same judgement plays your side', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 9], e1: [10, 1] });
    var o = AI.chooseOrder(b, null);
    t.equal(o.unitId, 'e1');
    act(t, b, o);
    t.equal(b.turnSide, 'player');
    var p = AI.chooseOrder(b, null, 'player');
    t.equal(p.unitId, 'p1');
    act(t, b, p);
  });

  test('it only reads the battle: nothing changes when it chooses', function (t) {
    var r = randomBattle(11, 'raid');
    var before = snapshot(r.battle);
    AI.chooseOrder(r.battle, r.terrain);
    AI.plans(r.battle, r.terrain, r.battle.turnSide);
    AI.planFor(r.battle, BR.activeUnits(r.battle, r.battle.turnSide)[0].id, r.terrain);
    t.equal(snapshot(r.battle), before);
  });

  test('no dice and no randomness: the same battle, or a saved copy of it, always gets the same order', function (t) {
    OBJECTIVES.forEach(function (obj, i) {
      var r = randomBattle(100 + i, obj);
      var side = r.battle.turnSide;
      var a = JSON.stringify(AI.chooseOrder(r.battle, r.terrain, side));
      var copy = JSON.parse(JSON.stringify(r.battle));
      t.equal(JSON.stringify(AI.chooseOrder(r.battle, r.terrain, side)), a, obj + ': again');
      t.equal(JSON.stringify(AI.chooseOrder(copy, JSON.parse(JSON.stringify(r.terrain)), side)), a, obj + ': a saved copy');
    });
  });

  /* ---------- Rally and melee ---------- */
  group('War AI: rallying and melee');

  test('Shaken and not in melee: it Rallies', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 9], e1: [10, 2] });
    unit(b, 'e1').status = 'shaken';
    var o = AI.chooseOrder(b, null);
    t.same([o.unitId, o.id, o.rule, o.useLeaderRally], ['e1', 'rally', 'rally', undefined]);
    act(t, b, o, null, d20(15));
    t.equal(unit(b, 'e1').status, 'steady');
  });

  test('Rally uses the Captain\'s sure Rally while it has one, then rolls', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { captains: [{ id: 'c1', name: 'Captain Vex' }] }), { p1: [10, 9], e1: [10, 2] });
    t.equal(unit(b, 'e1').leaderId, 'c1');
    unit(b, 'e1').status = 'shaken';
    var o = AI.chooseOrder(b, null);
    t.equal(o.useLeaderRally, true);
    act(t, b, o, null, d20(1));
    t.equal(unit(b, 'e1').status, 'steady', 'the sure Rally needs no roll');
    t.equal(BR.leaderById(b, 'c1').autoRallyLeft, 0);
    var b2 = fight(make([U('p1', 'line')], [U('e1', 'line')], { captains: [{ id: 'c1', name: 'Captain Vex' }] }), { p1: [10, 9], e1: [10, 2] });
    BR.leaderById(b2, 'c1').autoRallyLeft = 0;
    unit(b2, 'e1').status = 'shaken';
    var o2 = AI.chooseOrder(b2, null);
    t.same([o2.id, o2.useLeaderRally], ['rally', undefined]);
  });

  test('Shaken but in melee: it fights rather than Rallies', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 5], e1: [10, 4] });
    unit(b, 'e1').status = 'shaken';
    var o = AI.chooseOrder(b, null);
    t.same([o.id, o.targetId, o.rule, o.dest], ['advance', 'p1', 'melee', undefined]);
    act(t, b, o);
  });

  test('in melee: a unit carrying a supply marker before anything else', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'levy')], [U('e1', 'line')], { objective: 'raid' }), { p1: [9, 5], p2: [11, 5], e1: [10, 4] });
    carry(b, 'p1', 'm2');
    unit(b, 'p2').status = 'shaken';
    unit(b, 'p2').cohesion = 1;
    t.equal(AI.chooseOrder(b, null).targetId, 'p1');
  });

  test('in melee: a Shaken unit before a lower Cohesion', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')]), { p1: [9, 5], p2: [11, 5], e1: [10, 4] });
    unit(b, 'p1').status = 'shaken';
    unit(b, 'p1').cohesion = 4;
    unit(b, 'p2').cohesion = 2;
    t.equal(AI.chooseOrder(b, null).targetId, 'p1');
  });

  test('in melee: the lowest Cohesion when nobody is Shaken', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')]), { p1: [9, 5], p2: [11, 5], e1: [10, 4] });
    unit(b, 'p1').cohesion = 4;
    unit(b, 'p2').cohesion = 2;
    t.equal(AI.chooseOrder(b, null).targetId, 'p2');
  });

  test('in melee, equal Cohesion: the target it can hurt most (lower Defence)', function (t) {
    var b = fight(make([U('p1', 'heavy'), U('p2', 'levy')], [U('e1', 'line')]), { p1: [9, 5], p2: [11, 5], e1: [10, 4] });
    unit(b, 'p1').cohesion = 3;
    unit(b, 'p2').cohesion = 3;
    var plan = AI.planFor(b, 'e1', null);
    t.equal(plan.order.targetId, 'p2');
    t.ok(plan.expected > 1, 'expected damage is recorded on the plan');
  });

  test('in melee it strikes from where it stands, even with a weaker unit a step away', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'levy')], [U('e1', 'line')]), { p1: [10, 5], p2: [13, 4], e1: [10, 4] });
    unit(b, 'p2').status = 'shaken';
    unit(b, 'p2').cohesion = 1;
    var o = AI.chooseOrder(b, null);
    t.same([o.targetId, o.dest], ['p1', undefined]);
  });

  test('expected damage: Line Infantry +4 against Defence 13 averages 1.05 Cohesion', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 5], e1: [10, 4] });
    var pv = BR.previewAttack(b, 'e1', at(10, 4), null, 'p1', null);
    /* faces 9–13: 1 each; 14–18: 2 each; 19: 3; 20: 3 → 21 / 20 */
    t.equal(AI.expectedDamage(pv), 1.05);
    t.equal(AI.expectedDamage(null), 0);
  });

  /* ---------- Archers ---------- */
  group('War AI: archers');

  test('archers shoot from where they stand when they have a target', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'archers')]), { p1: [10, 6], e1: [10, 1] });
    var o = AI.chooseOrder(b, null);
    t.same([o.id, o.targetId, o.dest, o.rule], ['advance', 'p1', undefined, 'shoot']);
    t.equal(attackEvent(act(t, b, o)).calc.kind, 'ranged');
  });

  test('nothing in range: archers step to a firing square, away from the enemy, and shoot', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'archers')]), { p1: [10, 9], e1: [10, 0] });
    var o = AI.chooseOrder(b, null);
    t.equal(o.rule, 'shoot');
    t.ok(o.dest, 'it moves');
    t.ok(BR.dist(o.dest, at(10, 9)) > 1, 'not next to the enemy');
    t.equal(reachCount(b, 'enemy', o.dest), 0, 'out of reach of the enemy\'s melee next turn');
    t.equal(attackEvent(act(t, b, o)).calc.kind, 'ranged');
  });

  test('archers never wade into melee by choice: with no shot, they Hold', function (t) {
    /* A ridge all round the target: it can only be fought from next to it. */
    var b = fight(make([U('p1', 'heavy')], [U('e1', 'archers')]), { p1: [10, 6], e1: [10, 3] });
    var marks = {};
    [[9, 5], [10, 5], [11, 5], [9, 6], [11, 6], [9, 7], [10, 7], [11, 7]].forEach(function (c) { marks[c[0] + ',' + c[1]] = 'g'; });
    var terrain = paint(b, marks);
    t.ok(BR.attackOptions(b, 'e1', at(10, 5), [at(10, 3), at(10, 4), at(10, 5)], terrain).some(function (x) { return x.kind === 'melee'; }), 'a melee attack is there for the taking');
    var o = AI.chooseOrder(b, terrain);
    t.same([o.id, o.targetId], ['hold', undefined]);
  });

  test('with no shot, archers close in only where no enemy melee can reach them next turn', function (t) {
    /* A ridge across row 6 blocks every shot across it (the archers can't reach it). */
    var marks = {};
    for (var c = 0; c < 22; c++) marks[c + ',6'] = 'g';
    var b = fight(make([U('p1', 'light_cav')], [U('e1', 'archers')]), { p1: [10, 9], e1: [10, 1] });
    var terrain = paint(b, marks);
    var o = AI.chooseOrder(b, terrain);
    t.equal(o.rule, 'approach');
    t.ok(BR.dist(o.dest, at(10, 9)) < 8, 'closer');
    t.equal(reachCount(b, 'enemy', o.dest), 0, 'still out of the cavalry\'s reach');
    /* One square nearer and every step closer is in the cavalry's reach: Hold. */
    var b2 = fight(make([U('p1', 'light_cav')], [U('e1', 'archers')]), { p1: [10, 9], e1: [10, 2] });
    t.same([AI.chooseOrder(b2, terrain).id, AI.chooseOrder(b2, terrain).rule], ['hold', 'hold']);
  });

  test('archers pick another target rather than shoot into a melee', function (t) {
    var b = fight(make([U('p1', 'levy'), U('p2', 'heavy')], [U('e1', 'archers'), U('e2', 'line')]), { p1: [8, 5], p2: [12, 5], e1: [10, 1], e2: [8, 4] });
    unit(b, 'p1').cohesion = 1;
    var plan = AI.planFor(b, 'e1', null);
    t.equal(plan.order.targetId, 'p2', 'the weaker Levy is fighting Line Infantry 2');
  });

  test('archers sent to keep the outpost shoot from where they stand rather than walk into melee', function (t) {
    /* The audit's case: your two units hold the outpost; the enemy's Line
       Infantry is gone; its Archers could shoot from where they stand. */
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'archers'), U('e3', 'levy')], { objective: 'seize_outpost' }),
      { p1: [10, 1], p2: [11, 2], e2: [10, 4], e3: [2, 4] });
    unit(b, 'e1').status = 'routed';
    unit(b, 'e1').pos = null;
    var p = AI.planFor(b, 'e2', null);
    t.equal(p.rule, 'shoot');
    t.ok(!(p.order.dest && BR.isEngaged(b, unit(b, 'e2'), p.order.dest)), 'not next to your units');
    t.equal(attackEvent(act(t, b, p.order)).calc.kind, 'ranged');
    /* Further off, with no square of the outpost free of contact: it never
       Marches into contact. */
    var b2 = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'archers'), U('e3', 'levy')], { objective: 'seize_outpost' }),
      { p1: [10, 1], p2: [11, 2], e2: [10, 8], e3: [2, 4] });
    unit(b2, 'e1').status = 'routed';
    unit(b2, 'e1').pos = null;
    var p2 = AI.planFor(b2, 'e2', null);
    t.ok(!(p2.order.dest && BR.isEngaged(b2, unit(b2, 'e2'), p2.order.dest)), 'not next to your units: ' + JSON.stringify(p2.order));
    t.ok(p2.order.id !== 'march' || !p2.order.targetId);
  });

  test('archers guarding a supply marker shoot whoever comes near it, and never walk into contact', function (t) {
    /* Three markers: the Line and Levy take the outer ones, so the Archers
       guard the middle one, where your Heavy Infantry stands next to it. */
    function battle() {
      return fight(make([U('p1', 'heavy')], [U('e1', 'line'), U('e2', 'archers'), U('e3', 'levy')], { objective: 'raid' }),
        { p1: [11, 4], e1: [4, 1], e2: [17, 0], e3: [20, 1] });
    }
    var b = battle();
    var g = AI.planFor(b, 'e2', null);
    t.same([g.rule, g.order.targetId], ['shoot', 'p1'], 'shot from a distance');
    t.ok(!(g.order.dest && BR.isEngaged(b, unit(b, 'e2'), g.order.dest)), 'not next to your unit');
    t.equal(attackEvent(act(t, b, g.order)).calc.kind, 'ranged');
    /* A ridge hides your unit: no shot, so the Archers go to their marker,
       only to a square next to it that isn't next to your unit. */
    var b2 = battle();
    var marks = {};
    for (var c = 8; c <= 15; c++) marks[c + ',3'] = 'g';
    var terrain = paint(b2, marks);
    var m = AI.planFor(b2, 'e2', terrain);
    t.equal(m.rule, 'guard');
    t.equal(BR.dist(m.order.dest, at(11, 3)), 1, 'next to the marker');
    t.ok(!BR.isEngaged(b2, unit(b2, 'e2'), m.order.dest), 'not next to your unit: ' + JSON.stringify(m.order.dest));
    act(t, b2, m.order, terrain);
  });

  /* ---------- Charges ---------- */
  group('War AI: charges');

  test('cavalry prefer a legal Charge to a weaker target they can\'t charge', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'levy')], [U('e1', 'light_cav')]), { p1: [10, 6], p2: [4, 3], e1: [10, 0] });
    unit(b, 'p2').cohesion = 2;
    unit(b, 'p2').holding = true; /* no Charge against a unit that is Holding */
    var o = AI.chooseOrder(b, null);
    t.same([o.targetId, o.rule], ['p1', 'charge']);
    var ev = attackEvent(act(t, b, o));
    t.equal(ev.calc.charge, true);
  });

  test('a Charge beast picks the straight-line square that makes the Charge', function (t) {
    var b = fight(make([U('p1', 'levy')], [Beast('e1', 'Lion')]), { p1: [8, 6], e1: [3, 1] });
    var o = AI.chooseOrder(b, null);
    t.equal(o.rule, 'charge');
    t.equal(attackEvent(act(t, b, o)).calc.charge, true);
  });

  test('Shock Cavalry\'s Strong Charge is taken when it can be', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'shock_cav')]), { p1: [12, 6], e1: [12, 1] });
    var o = AI.chooseOrder(b, null);
    var ev = attackEvent(act(t, b, o));
    t.equal(ev.calc.charge, true);
    t.ok(ev.calc.mods.some(function (m) { return m.label === 'Strong Charge' && m.value === 3; }));
  });

  /* ---------- Objectives ---------- */
  group('War AI: objectives');

  test('raid: it goes for the unit carrying a supply marker over a weaker one', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'levy')], [U('e1', 'line')], { objective: 'raid' }), { p1: [12, 5], p2: [8, 5], e1: [10, 2] });
    carry(b, 'p1', 'm2');
    unit(b, 'p2').cohesion = 1;
    var o = AI.chooseOrder(b, null);
    t.same([o.targetId, o.id], ['p1', 'advance']);
  });

  test('raid: a carrier out of reach is chased; the guards stand next to their markers, not on them', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line'), U('e3', 'line')], { objective: 'raid' }),
      { p1: [11, 8], e1: [10, 0], e2: [4, 1], e3: [17, 2] });
    carry(b, 'p1', 'm2');
    var chase = AI.planFor(b, 'e1', null);
    t.equal(chase.rule, 'intercept');
    t.ok(BR.dist(chase.order.dest, at(11, 8)) < BR.dist(at(10, 0), at(11, 8)), 'closer to the carrier');
    var g = AI.planFor(b, 'e2', null);
    t.equal(g.rule, 'guard');
    t.equal(BR.dist(g.order.dest, at(4, 3)), 1, 'next to its supply marker at (4,3)');
    t.equal(AI.planFor(b, 'e3', null).rule, 'hold-guard', 'already next to its marker: Hold');
    /* A guard standing on its marker steps off it (but stays next to it). */
    unit(b, 'e3').pos = at(17, 3);
    var off = AI.planFor(b, 'e3', null);
    t.equal(off.rule, 'guard');
    t.equal(BR.dist(off.order.dest, at(17, 3)), 1);
    act(t, b, off.order);
  });

  test('raid: one guard to each supply marker', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line')], { objective: 'raid' }), { p1: [10, 11], e1: [10, 1], e2: [11, 1] });
    var a = AI.planFor(b, 'e1', null);
    var c = AI.planFor(b, 'e2', null);
    t.equal(a.rule, 'guard');
    t.equal(BR.dist(a.order.dest, at(11, 3)), 1, 'equally near the middle marker: the first in the roster takes it');
    t.equal(c.rule, 'guard');
    t.equal(BR.dist(c.order.dest, at(17, 3)), 1, 'the other goes to the next nearest');
  });

  test('raid: a guarded marker can still be reached and picked up', function (t) {
    /* The guard holds next to the middle marker; your Line Infantry walks
       onto the marker (it stops there, next to the guard) and picks it up. */
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [11, 6], e1: [11, 2] }, { turn: 'player' });
    t.ok(BR.reachable(b, 'p1', 'advance', null)['11,3'], 'the marker square can be reached');
    act(t, b, { unitId: 'p1', id: 'advance', dest: at(11, 3) });
    var o = AI.chooseOrder(b, null);
    t.equal(o.unitId, 'e1');
    t.ok(!(o.dest && BR.dist(o.dest, at(11, 3)) === 0), 'the guard never steps onto the marker');
    act(t, b, o);
    b.units.forEach(function (u) { u.activated = false; });
    b.turnSide = 'player';
    t.ok(BR.legalOrders(b, 'p1', null).some(function (x) { return x.id === 'interact' && x.ok; }), 'Interact is open to your unit on the marker');
  });

  test('raid: the enemy never picks up a supply marker, and never ends a move on one', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [10, 11], e1: [11, 3] });
    var o = AI.chooseOrder(b, null);
    t.ok(o.id !== 'interact');
    t.equal(o.rule, 'guard', 'standing on the marker: it steps off');
    t.equal(BR.dist(o.dest, at(11, 3)), 1);
    /* Whole raids: no enemy unit ever finishes an activation on a supply marker. */
    var onMarker = 0;
    var enemyActs = 0;
    for (var seed = 1; seed <= 8; seed++) {
      var r = randomBattle(seed * 53, 'raid');
      var rand = seeded(seed);
      for (var step = 0; step < 200 && r.battle.phase === 'battle'; step++) {
        var side = r.battle.turnSide;
        var order = AI.chooseOrder(r.battle, r.terrain, side);
        var mover = unit(r.battle, order.unitId);
        var startOn = !!BR.fieldMarkerAt(r.battle, mover.pos);
        act(t, r.battle, order, r.terrain, rand);
        if (side === 'enemy') {
          enemyActs += 1;
          if (mover.pos && !startOn && BR.fieldMarkerAt(r.battle, mover.pos)) onMarker += 1;
        }
      }
    }
    t.ok(enemyActs > 50, enemyActs + ' enemy activations');
    t.equal(onMarker, 0, 'enemy activations ending on a supply marker');
  });

  test('defend: with nothing in reach, the enemy marches on your supply depot', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'defend' }), { p1: [0, 11], e1: [10, 1] });
    var z = b.objective.zone;
    t.same([z.c0, z.r0, z.c1, z.r1], [9, 8, 12, 9]);
    var o = AI.chooseOrder(b, null);
    t.same([o.id, o.rule], ['march', 'push']);
    t.equal(o.dest.r, 7, 'six squares on, next to the depot');
  });

  test('defend: inside your depot with nothing in reach it Holds; it attacks a unit blocking the depot first', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'defend' }), { p1: [0, 11], e1: [10, 8] });
    t.same([AI.chooseOrder(b, null).id, AI.chooseOrder(b, null).rule], ['hold', 'hold-zone']);
    var b2 = fight(make([U('p1', 'line'), U('p2', 'levy')], [U('e1', 'line')], { objective: 'defend' }), { p1: [10, 8], p2: [7, 7], e1: [10, 5] });
    unit(b2, 'p2').cohesion = 1;
    t.equal(AI.chooseOrder(b2, null).targetId, 'p1', 'the blocker in the depot, not the weaker unit outside it');
  });

  test('defend: it can reach the depot this activation, so it goes in', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'light_cav')], { objective: 'defend' }), { p1: [0, 11], e1: [10, 2] });
    var o = AI.chooseOrder(b, null);
    t.ok(BR.inZone(b.objective.zone, o.dest), 'it ends inside');
    act(t, b, o);
  });

  test('seize: the unit in the outpost Holds when nothing is in reach, and won\'t leave it to attack', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' }), { p1: [10, 9], e1: [10, 2] });
    var z = b.objective.zone;
    t.same([z.c0, z.r0, z.c1, z.r1], [9, 1, 12, 2]);
    t.same([AI.chooseOrder(b, null).id, AI.chooseOrder(b, null).rule], ['hold', 'hold-zone']);
    var b2 = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' }), { p1: [10, 5], e1: [10, 2] });
    t.ok(BR.attackOptions(b2, 'e1', at(10, 4), [at(10, 2), at(10, 3), at(10, 4)], null).length, 'it could attack by stepping out');
    t.equal(AI.chooseOrder(b2, null).rule, 'hold-zone');
  });

  test('seize: it strikes a unit that enters the outpost, staying inside', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' }), { p1: [12, 1], e1: [10, 2] });
    var o = AI.chooseOrder(b, null);
    t.equal(o.targetId, 'p1');
    t.ok(BR.inZone(b.objective.zone, o.dest), 'it attacks from inside');
  });

  test('seize: with no Steady unit in the outpost, the nearest Steady one moves in', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line'), U('e3', 'line')], { objective: 'seize_outpost' }),
      { p1: [10, 11], e1: [3, 4], e2: [11, 4], e3: [10, 3] });
    unit(b, 'e3').status = 'shaken';
    var p = AI.planFor(b, 'e2', null);
    t.equal(p.rule, 'keep');
    t.ok(BR.inZone(b.objective.zone, p.order.dest));
    t.equal(AI.planFor(b, 'e3', null).rule, 'rally', 'the Shaken one nearer still Rallies');
  });

  test('seize: an enemy closing on the outpost is met by the units outside it', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'heavy'), U('e3', 'line')], { objective: 'seize_outpost' }),
      { p1: [16, 6], e1: [10, 2], e2: [11, 2], e3: [13, 0] });
    t.same([AI.planFor(b, 'e1', null).rule, AI.planFor(b, 'e2', null).rule], ['hold-zone', 'hold-zone'], 'two stay inside');
    var p = AI.planFor(b, 'e3', null);
    t.equal(p.rule, 'strike');
    t.ok(BR.dist(p.order.dest, at(16, 6)) < BR.dist(at(13, 0), at(16, 6)));
    /* Far off, nobody is coming yet: the unit outside stays by the outpost. */
    unit(b, 'p1').pos = at(16, 11);
    t.equal(AI.planFor(b, 'e3', null).rule, 'hold');
  });

  test('seize: your archers shooting into the outpost are gone after by the units outside it', function (t) {
    /* The audit's case: two keepers inside, two Line Infantry by the
       outpost, your Archers six squares off shooting into it. */
    var b = fight(make([U('p1', 'archers'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'line'), U('e3', 'line'), U('e4', 'line')], { objective: 'seize_outpost' }),
      { p1: [10, 8], p2: [10, 11], e1: [10, 2], e2: [11, 2], e3: [8, 3], e4: [13, 3] });
    t.ok(BR.attackOptions(b, 'p1', at(10, 8), null, null).some(function (x) { return x.targetId === 'e1'; }), 'your archers can shoot into the outpost');
    ['e3', 'e4'].forEach(function (id) {
      var p = AI.planFor(b, id, null);
      t.equal(p.rule, 'strike', id);
      t.ok(BR.dist(p.order.dest, at(10, 8)) < BR.dist(unit(b, id).pos, at(10, 8)), id + ' closes on the archers');
    });
    t.same([AI.planFor(b, 'e1', null).rule, AI.planFor(b, 'e2', null).rule], ['hold-zone', 'hold-zone'], 'the keepers stay inside');
  });

  test('seize: archers keep the outpost only when nobody else can', function (t) {
    /* Nobody inside: a Steady Line Infantry is called in before Steady
       Archers that are nearer. */
    var b = fight(make([U('p1', 'line')], [U('e1', 'archers'), U('e2', 'line'), U('e3', 'levy')], { objective: 'seize_outpost' }),
      { p1: [10, 11], e1: [10, 3], e2: [4, 3], e3: [17, 4] });
    t.equal(AI.planFor(b, 'e2', null).rule, 'keep');
    t.equal(AI.planFor(b, 'e3', null).rule, 'keep', 'two keepers in an army of three');
    t.ok(AI.planFor(b, 'e1', null).rule !== 'keep', 'the archers have another job');
  });

  test('skirmish: focus on the weakest target in reach (Shaken first, then the lowest Cohesion)', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line'), U('p3', 'line')], [U('e1', 'line')]), { p1: [9, 6], p2: [12, 6], p3: [8, 6], e1: [10, 2] });
    unit(b, 'p2').cohesion = 2;
    unit(b, 'p3').status = 'shaken';
    unit(b, 'p3').cohesion = 4;
    t.equal(AI.chooseOrder(b, null).targetId, 'p3');
    unit(b, 'p3').status = 'steady';
    t.equal(AI.chooseOrder(b, null).targetId, 'p2');
  });

  test('skirmish: nothing in reach, it closes in on the nearest enemy', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 11], e1: [10, 0] });
    var o = AI.chooseOrder(b, null);
    t.equal(o.rule, 'approach');
    t.ok(BR.dist(o.dest, at(10, 11)) < 11);
    t.ok(BR.dist(o.dest, at(10, 11)) > 1, 'it doesn\'t walk into contact without attacking');
  });

  test('skirmish: it closes in by stages: to the edge of your reach first, then on in', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line'), U('p3', 'line')], [U('e1', 'light_cav')]), { p1: [10, 9], p2: [11, 9], p3: [12, 9], e1: [1, 0] });
    var o = AI.chooseOrder(b, null);
    t.equal(o.rule, 'approach');
    t.ok(BR.dist(o.dest, at(10, 9)) < BR.dist(at(1, 0), at(10, 9)), 'closer');
    t.equal(reachCount(b, 'enemy', o.dest), 0, 'still out of reach of all three');
    /* From there the cavalry's longer reach lets it Charge. */
    unit(b, 'e1').pos = { c: o.dest.c, r: o.dest.r };
    t.equal(AI.chooseOrder(b, null).rule, 'charge');
    /* Line Infantry at the edge of equal reach can't attack from there, but
       it doesn't wait either: it steps in (and doesn't March into contact,
       where it couldn't attack). */
    var b2 = fight(make([U('p1', 'line'), U('p2', 'line'), U('p3', 'line')], [U('e1', 'line')]), { p1: [10, 9], p2: [11, 9], p3: [12, 9], e1: [10, 1] });
    var s1 = AI.chooseOrder(b2, null);
    t.equal(s1.rule, 'approach');
    t.equal(reachCount(b2, 'enemy', s1.dest), 0, 'to the edge of their reach first');
    unit(b2, 'e1').pos = { c: s1.dest.c, r: s1.dest.r };
    var s2 = AI.chooseOrder(b2, null);
    t.equal(s2.rule, 'approach');
    t.ok(BR.dist(s2.dest, at(11, 9)) < BR.dist(s1.dest, at(11, 9)), 'then on in');
    t.ok(!(s2.id === 'march' && BR.isEngaged(b2, unit(b2, 'e1'), s2.dest)), 'not by Marching into contact');
    act(t, b2, s2);
  });

  test('skirmish: it never stands off while your archers shoot it (it advances and fights)', function (t) {
    /* The audit's case: two Line Infantry against your two Line Infantry
       with Archers behind them, your units hanging back. */
    var b = fight(make([U('p1', 'line'), U('p2', 'line'), U('p3', 'archers')], [U('e1', 'line'), U('e2', 'line')]),
      { p1: [9, 10], p2: [11, 10], p3: [10, 11], e1: [10, 5], e2: [12, 5] });
    AI.plans(b, null, 'enemy').forEach(function (p) {
      t.equal(p.rule, 'approach', p.unitId);
      t.ok(BR.dist(p.order.dest, at(10, 10)) < BR.dist(unit(b, p.unitId).pos, at(10, 10)), p.unitId + ' moves closer');
    });
    /* Played out: your archers shoot whenever they can, everyone else Holds. */
    var rand = seeded(2);
    var holds = 0;
    var attacks = 0;
    for (var step = 0; step < 200 && b.phase === 'battle'; step++) {
      var o;
      if (b.turnSide === 'enemy') {
        o = AI.chooseOrder(b, null);
        if (o.id === 'hold') holds += 1;
        if (o.targetId) attacks += 1;
      } else {
        var mine = BR.activeUnits(b, 'player');
        var archers = mine.filter(function (u) { return u.id === 'p3'; })[0];
        var shots = archers ? BR.attackOptions(b, 'p3', archers.pos, null, null) : [];
        o = shots.length ? { unitId: 'p3', id: 'advance', targetId: shots[0].targetId } : { unitId: mine[0].id, id: 'hold' };
      }
      act(t, b, o, null, rand);
    }
    t.equal(holds, 0, 'enemy Holds');
    t.ok(attacks >= 4, 'enemy attacks: ' + attacks);
    t.ok(b.result && b.result.lostPct.player > 0, 'your units were fought');
  });

  /* ---------- Which unit acts ---------- */
  group('War AI: which unit acts');

  test('a unit that can attack acts before one that can only move, whatever the roster order', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line')]), { p1: [10, 7], e1: [2, 0], e2: [10, 4] });
    t.equal(AI.chooseOrder(b, null).unitId, 'e2');
  });

  test('of the units that can attack, the one with the most expected damage first', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'levy')], [U('e1', 'levy'), U('e2', 'line')]), { p1: [4, 5], p2: [15, 5], e1: [4, 4], e2: [15, 4] });
    var plans = AI.plans(b, null, 'enemy');
    t.same(plans.map(function (p) { return p.unitId; }), ['e2', 'e1']);
    t.ok(plans[0].expected > plans[1].expected);
  });

  test('attackers, then Rallies, then units moving for the objective, then the rest; Holds last', function (t) {
    /* The outpost: e1 keeps it (nothing to do: Hold); e2 is called in to
       keep it with e1; e3 is in melee; e4 is Shaken; e5 goes to meet the
       enemy coming toward the outpost. */
    var b = fight(make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line'), U('e3', 'line'), U('e4', 'line'), U('e5', 'line')], { objective: 'seize_outpost' }),
      { p1: [15, 7], e1: [10, 1], e2: [3, 2], e3: [15, 6], e4: [5, 0], e5: [20, 4] });
    unit(b, 'e4').status = 'shaken';
    var plans = AI.plans(b, null, 'enemy');
    t.same(plans.map(function (p) { return p.unitId + ' ' + p.rule; }), ['e3 melee', 'e4 rally', 'e2 keep', 'e5 strike', 'e1 hold-zone']);
    t.same(plans.map(function (p) { return p.tier; }), [1, 2, 3, 4, 5]);
    t.equal(AI.chooseOrder(b, null).unitId, 'e3', 'chooseOrder gives the first plan');
  });

  test('of the units that can only move, the one nearest the enemy goes first', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line')]), { p1: [10, 11], e1: [2, 0], e2: [12, 1] });
    t.same(AI.plans(b, null, 'enemy').map(function (p) { return p.unitId + ' ' + p.rule; }), ['e2 approach', 'e1 approach']);
  });

  /* ---------- Your side (for whole-battle tests) ---------- */
  group('War AI: playing your side');

  test('raid, your side: a unit on a supply marker picks it up first', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [11, 3], p2: [4, 6], e1: [4, 5] }, { turn: 'player' });
    var o = AI.chooseOrder(b, null, 'player');
    t.same([o.unitId, o.id, o.rule], ['p1', 'interact', 'interact']);
    act(t, b, o);
    t.equal(unit(b, 'p1').carrying, 'm2');
  });

  test('raid, your side: a carrier marches for home, and Disengages first when caught', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [11, 3], e1: [2, 0] }, { turn: 'player' });
    carry(b, 'p1', 'm2');
    var o = AI.chooseOrder(b, null, 'player');
    t.same([o.id, o.rule, o.dest.r], ['march', 'carry', 9]);
    var b2 = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [11, 3], e1: [11, 2] }, { turn: 'player' });
    carry(b2, 'p1', 'm2');
    var o2 = AI.chooseOrder(b2, null, 'player');
    t.same([o2.id, o2.rule], ['disengage', 'carry-escape']);
    t.ok(o2.dest.r > 3, 'toward home');
    act(t, b2, o2);
  });

  test('your side holds your depot, and takes the outpost, by the same rules', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'defend' }), { p1: [10, 8], e1: [10, 0] }, { turn: 'player' });
    t.equal(AI.chooseOrder(b, null, 'player').rule, 'hold-zone');
    var b2 = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' }), { p1: [10, 10], e1: [0, 0] }, { turn: 'player' });
    var o = AI.chooseOrder(b2, null, 'player');
    t.equal(o.rule, 'push');
    t.equal(o.dest.r, 4, 'it marches toward the outpost');
  });

  /* ---------- Legality, speed and whole battles ---------- */
  group('War AI: legality, speed and whole battles');

  test('every plan for every unit is a legal order, across random battles, terrain and weather', function (t) {
    var checked = 0;
    for (var seed = 1; seed <= 24; seed++) {
      var r = randomBattle(seed * 31, OBJECTIVES[seed % 4]);
      var rand = seeded(seed);
      for (var step = 0; step < 60 && r.battle.phase === 'battle'; step++) {
        var plans = AI.plans(r.battle, r.terrain, r.battle.turnSide);
        t.ok(plans.length > 0, 'a plan whenever the battle is on');
        if (step % 3 === 0) {
          plans.forEach(function (p) {
            var copy = JSON.parse(JSON.stringify(r.battle));
            var res = BR.resolveOrder(copy, p.order, r.terrain, seeded(7));
            t.ok(res.ok, 'seed ' + seed + ' step ' + step + ': ' + JSON.stringify(p.order) + ' → ' + res.why);
            checked += 1;
          });
        }
        act(t, r.battle, plans[0].order, r.terrain, rand);
      }
    }
    t.ok(checked > 500, 'checked ' + checked + ' plans');
  });

  test('archers, whatever their job, never end a move next to an enemy and never choose melee', function (t) {
    var checked = 0;
    for (var seed = 1; seed <= 24; seed++) {
      var r = randomBattle(seed * 59 + 3, OBJECTIVES[seed % 4], { n: 6 });
      var rand = seeded(seed);
      for (var step = 0; step < 80 && r.battle.phase === 'battle'; step++) {
        var plans = AI.plans(r.battle, r.terrain, r.battle.turnSide);
        plans.forEach(function (p) {
          var u = unit(r.battle, p.unitId);
          if (u.type !== 'archers' || BR.isEngaged(r.battle, u)) return;
          checked += 1;
          var where = p.order.dest || u.pos;
          t.ok(!(p.order.dest && BR.isEngaged(r.battle, u, p.order.dest)), 'seed ' + seed + ': archers into contact ' + JSON.stringify(p.order));
          if (p.order.targetId) {
            var opts = BR.attackOptions(r.battle, u.id, where, null, r.terrain).filter(function (x) { return x.targetId === p.order.targetId; });
            t.ok(opts.length && opts[0].kind === 'ranged', 'seed ' + seed + ': a shot, not melee ' + JSON.stringify(p.order));
          }
        });
        act(t, r.battle, plans[0].order, r.terrain, rand);
      }
    }
    t.ok(checked > 150, 'checked ' + checked + ' archer plans');
  });

  test('whole battles, both sides played by the AI, end in a result for every objective', function (t) {
    var outcomes = {};
    OBJECTIVES.forEach(function (obj) {
      for (var seed = 1; seed <= 6; seed++) {
        var r = randomBattle(seed * 977 + obj.length, obj);
        var out = AI.playOut(r.battle, r.terrain, seeded(seed));
        t.same(out.refused, [], obj + ' seed ' + seed + ': no refused orders');
        t.ok(r.battle.result, obj + ' seed ' + seed + ': a result');
        t.equal(r.battle.phase, 'over');
        t.ok(r.battle.result.round <= r.battle.maxRounds, 'within the round limit');
        t.ok(out.steps <= r.battle.units.length * r.battle.maxRounds, 'one activation per unit per round at most');
        outcomes[obj + ':' + r.battle.result.outcome] = true;
      }
    });
    t.ok(Object.keys(outcomes).length >= 6, 'a spread of outcomes: ' + Object.keys(outcomes).join(', '));
  });

  test('playOut reports its steps and the result, and does nothing to a battle that is over', function (t) {
    var r = randomBattle(5, 'skirmish');
    var out = AI.playOut(r.battle, r.terrain, seeded(1));
    t.ok(out.steps > 0);
    t.same(out.result, r.battle.result);
    var again = AI.playOut(r.battle, r.terrain, seeded(1));
    t.equal(again.steps, 0);
  });

  test('speed: on a 24 × 30 board with 30 units, every choice takes well under 50 ms', function (t) {
    var P = [];
    var E = [];
    for (var i = 0; i < 15; i++) {
      P.push(U('p' + (i + 1), TYPES[i % 6]));
      E.push(i % 7 === 6 ? Beast('e' + (i + 1), 'Dire Wolf') : U('e' + (i + 1), TYPES[(i + 2) % 6]));
    }
    var b = BR.createBattle({ player: { units: P, leaders: [] }, enemy: { units: E, leaders: [] }, objective: 'skirmish', conditions: CLEAR, cols: 24 }, { w: 1000, h: 1300 });
    t.same([b.cols, b.rows, b.units.length], [24, 30, 30]);
    var rng = seeded(5);
    var codes = '.....wbrdgcf';
    var cells = '';
    for (var k = 0; k < b.cols * b.rows; k++) cells += codes.charAt(Math.floor(rng() * codes.length));
    var terrain = { cols: b.cols, rows: b.rows, cells: cells };
    BR.beginDeployment(b, terrain);
    BR.startBattle(b);
    AI.chooseOrder(b, terrain, b.turnSide); /* warm up */
    var times = [];
    var rand = seeded(9);
    var now = function () { return window.performance && window.performance.now ? window.performance.now() : Date.now(); };
    while (b.phase === 'battle' && times.length < 60) {
      var t0 = now();
      var o = AI.chooseOrder(b, terrain, b.turnSide);
      times.push(now() - t0);
      act(t, b, o, terrain, rand);
    }
    times.sort(function (x, y) { return x - y; });
    var median = times[times.length >> 1];
    var worst = times[times.length - 1];
    t.ok(median < 20, 'median ' + median.toFixed(1) + ' ms');
    t.ok(worst < 50, 'slowest ' + worst.toFixed(1) + ' ms');
  });
}());
