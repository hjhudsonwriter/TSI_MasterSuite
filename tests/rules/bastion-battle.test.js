/* The Ironbow Bastion Manager's war battle: tools/bastion/war-battle-rules.js */
(function () {
  var BR = TSI.bastion.battleRules;
  var W = window.TSI_DATA.bastionWar;

  /* ---------- Helpers ---------- */
  /* A regiment's spec, as the Bastion builds them (no profile: the engine fills it). */
  function U(id, type, extra) {
    var a = W.archetypes[type];
    return Object.assign({ id: id, kind: 'formation', type: type, name: a.name, label: a.name + ' ' + id.replace(/\D/g, ''), personnel: a.size, size: a.size, variant: null, source: { key: id } }, extra || {});
  }
  function Beast(id, name, extra) {
    return Object.assign({ id: id, kind: 'beast', type: 'beast', name: name, label: name, source: { beast: name } }, extra || {});
  }
  var CLEAR = { weather: 'clear', moraleMod: 0, luckMod: 0 };
  /* A battle with no map: 22 × 12, strip rows 5 and 6, the enemy in rows 0–4, you in rows 7–11. */
  function make(player, enemy, opts) {
    var o = opts || {};
    return BR.createBattle({
      player: { units: player || [], leaders: o.leaders || [], defenders: o.defenders || null },
      enemy: { units: enemy || [], leaders: o.captains || [] },
      objective: o.objective || 'skirmish',
      conditions: Object.assign({}, CLEAR, o.conditions || {}),
      cols: o.cols
    }, o.board === undefined ? null : o.board);
  }
  /* Straight into the battle with units exactly where a test wants them;
     any unit not listed is off the board. Your turn unless opts.turn. */
  function fight(battle, where, opts) {
    BR.beginDeployment(battle, null);
    BR.startBattle(battle);
    battle.units.forEach(function (u) { u.pos = null; });
    Object.keys(where).forEach(function (id) {
      BR.unitById(battle, id).pos = { c: where[id][0], r: where[id][1] };
    });
    battle.turnSide = (opts && opts.turn) || 'player';
    return battle;
  }
  /* rand() that rolls this d20 every time. */
  function d20(v) { return function () { return (v - 1) / 20 + 0.001; }; }
  function noDice() { throw new Error('no dice should be rolled here'); }
  /* A seeded rand() (mulberry32), for the whole-battle tests. */
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
  function cells(list, code) {
    var m = {};
    list.forEach(function (k) { m[k] = code; });
    return m;
  }
  function has(reach, c, r) { return !!reach[c + ',' + r]; }
  function at(c, r) { return { c: c, r: r }; }
  function act(t, battle, unitId, id, extra, terrain, rand) {
    var res = BR.resolveOrder(battle, Object.assign({ unitId: unitId, id: id }, extra || {}), terrain || null, rand || d20(10));
    t.ok(res.ok, unitId + ' ' + id + ' should be allowed: ' + res.why);
    return res;
  }
  function kinds(res) { return res.events.map(function (e) { return e.kind; }); }
  function why(battle, unitId, orderId, terrain) {
    return BR.legalOrders(battle, unitId, terrain || null).filter(function (o) { return o.id === orderId; })[0];
  }
  function snapshot(battle) { return JSON.stringify(battle); }
  /* Everyone left to act this round Holds, until the round (or battle) ends. */
  function holdRound(t, battle) {
    var round = battle.round;
    var guard = 0;
    while (battle.phase === 'battle' && battle.round === round && guard++ < 100) {
      var u = BR.activeUnits(battle, battle.turnSide)[0];
      act(t, battle, u.id, 'hold');
    }
  }

  /* ---------- The board ---------- */
  group('War battle: the board');

  test('the grid\'s depth follows the map\'s shape, kept between 10 and 30 rows; no map is 12', function (t) {
    t.equal(BR.gridFor({ w: 1600, h: 900 }).rows, 12);
    t.equal(BR.gridFor({ w: 1600, h: 1600 }).rows, 22);
    t.equal(BR.gridFor({ w: 1600, h: 4000 }).rows, 30, 'very tall maps are capped');
    t.equal(BR.gridFor({ w: 1600, h: 200 }).rows, 10, 'very wide maps get at least 10');
    t.equal(BR.gridFor(null).rows, 12);
    t.equal(BR.gridFor({ w: 0, h: 0 }).rows, 12, 'a board with no size counts as no map');
    t.equal(BR.gridFor({ w: 1200, h: 900 }, 20).rows, 15, '20 across, 4:3');
  });

  test('the grid is 22 squares across unless 20 to 24 is chosen', function (t) {
    t.equal(BR.gridFor(null).cols, 22);
    t.equal(BR.gridFor(null, 20).cols, 20);
    t.equal(BR.gridFor(null, 23).cols, 23);
    t.equal(BR.gridFor(null, 30).cols, 24);
    t.equal(BR.gridFor(null, 10).cols, 20);
    t.equal(BR.gridFor(null, 'nonsense').cols, 22);
  });

  test('the no-deployment strip is the middle 2 rows when even, the middle 3 when odd', function (t) {
    t.same(BR.stripRows(12), [5, 6]);
    t.same(BR.stripRows(10), [4, 5]);
    t.same(BR.stripRows(11), [4, 5, 6]);
    t.same(BR.stripRows(13), [5, 6, 7]);
    t.same(BR.gridFor({ w: 1200, h: 900 }, 20).strip, [6, 7, 8], '15 rows');
  });

  test('zones: the enemy above the strip, you below it; each side\'s baseline is its own edge', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')]);
    t.equal(b.cols, 22);
    t.equal(b.rows, 12);
    t.same(b.strip, [5, 6]);
    t.equal(BR.zoneOf(b, 4), 'enemy');
    t.equal(BR.zoneOf(b, 5), 'strip');
    t.equal(BR.zoneOf(b, 6), 'strip');
    t.equal(BR.zoneOf(b, 7), 'player');
    t.same(BR.zoneRows(b, 'player'), [7, 8, 9, 10, 11], 'front to back');
    t.same(BR.zoneRows(b, 'enemy'), [4, 3, 2, 1, 0], 'front to back');
    t.equal(BR.baseline(b, 'player'), 11);
    t.equal(BR.baseline(b, 'enemy'), 0);
    var odd = make([], [], { board: { w: 1200, h: 900 }, cols: 20 });
    t.equal(BR.zoneOf(odd, 5), 'enemy');
    t.equal(BR.zoneOf(odd, 8), 'strip');
    t.equal(BR.zoneOf(odd, 9), 'player');
  });

  test('distance counts diagonal steps as one; all eight neighbours are adjacent', function (t) {
    t.equal(BR.dist(at(0, 0), at(3, 2)), 3);
    t.equal(BR.dist(at(5, 5), at(5, 5)), 0);
    var n = 0;
    for (var dc = -1; dc <= 1; dc++) for (var dr = -1; dr <= 1; dr++) if (BR.adjacent(at(5, 5), at(5 + dc, 5 + dr))) n++;
    t.equal(n, 8);
    t.ok(!BR.adjacent(at(5, 5), at(7, 5)));
  });

  /* ---------- Creating a battle ---------- */
  group('War battle: creating it');

  test('every unit is filled in from its spec', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'archers')]);
    var u = BR.unitById(b, 'p1');
    t.equal(u.side, 'player');
    t.equal(u.kind, 'formation');
    t.equal(u.type, 'line');
    t.equal(u.name, 'Line Infantry');
    t.equal(u.label, 'Line Infantry 1');
    t.equal(u.short, 'LI1');
    t.equal(u.personnel, 100);
    t.equal(u.size, 100);
    t.same(u.profile, { cohesion: 5, attack: 4, defence: 13, move: 3, resolve: 1, bv: 5 });
    t.same(u.traits, []);
    t.equal(u.cohesionMax, 5);
    t.equal(u.cohesion, 5);
    t.equal(u.status, 'steady');
    t.same([u.pos, u.startPos, u.support, u.leaderId, u.carrying], [null, null, null, null, null]);
    t.same([u.activated, u.holding, u.heldFast, u.everHalf], [false, false, false, false]);
    t.same(u.source, { key: 'p1' });
    var e = BR.unitById(b, 'e1');
    t.equal(e.side, 'enemy');
    t.same(e.profile, { cohesion: 4, attack: 1, rangedAttack: 4, range: 6, defence: 11, move: 3, resolve: 0, bv: 5 });
  });

  test('a spec\'s own profile is used as given (its traits\' changes are already in it)', function (t) {
    var b = make([U('p1', 'line', { personnel: 60, profile: { cohesion: 3, attack: 4, defence: 13, move: 3, resolve: 1, bv: 3 } })], []);
    var u = BR.unitById(b, 'p1');
    t.equal(u.cohesionMax, 3);
    t.equal(u.cohesion, 3);
    t.equal(u.personnel, 60);
    t.equal(u.profile.bv, 3);
  });

  test('without a profile: the archetype\'s numbers with the variant\'s trait (Armoured, Fleet, Steady)', function (t) {
    var b = make([], [
      U('e1', 'heavy', { name: 'Molten Ironclads', variant: { id: 'molten_ironclads', name: 'Molten Ironclads', trait: 'armoured' } }),
      U('e2', 'light_cav', { name: 'Slade Outriders', variant: { id: 'slade_outriders', name: 'Slade Outriders', trait: 'fleet' } }),
      U('e3', 'heavy', { name: 'Bacca Stoneguard', variant: { id: 'bacca_stoneguard', name: 'Bacca Stoneguard', trait: 'steady' } })
    ]);
    t.equal(BR.unitById(b, 'e1').profile.defence, 16, 'Armoured: 15 + 1');
    t.same(BR.unitById(b, 'e1').traits, ['armoured']);
    t.equal(BR.unitById(b, 'e2').profile.move, 6, 'Fleet: 5 + 1');
    t.same(BR.unitById(b, 'e2').traits, ['charge', 'fleet']);
    t.equal(BR.unitById(b, 'e3').profile.resolve, 3, 'Steady: 2 + 1');
  });

  test('beasts take their profile and trait from the data; one beast is one of one', function (t) {
    var b = make([Beast('p1', 'Owlbear'), Beast('p2', 'Unknown Thing')], []);
    var o = BR.unitById(b, 'p1');
    t.equal(o.kind, 'beast');
    t.same(o.profile, { cohesion: 7, attack: 6, defence: 13, move: 4, resolve: 2, bv: 10 });
    t.same(o.traits, ['terror']);
    t.same([o.personnel, o.size], [1, 1]);
    t.same(BR.unitById(b, 'p2').traits, ['charge'], 'a beast with no profile uses the default');
  });

  test('75 or more defenders fight as a detachment: the Levy profile, scaled by headcount', function (t) {
    var full = BR.formDefenders(150, true, ['r1']);
    t.equal(full.detachments.length, 1);
    t.equal(full.support.length, 0, '75+ never support');
    var d = full.detachments[0];
    t.same([d.kind, d.type, d.personnel, d.size], ['detachment', 'defenders', 150, 150]);
    t.same(d.profile, { cohesion: 4, attack: 2, defence: 11, move: 3, resolve: 0, bv: 3 });
    var half = BR.formDefenders(75, true, []).detachments[0];
    t.equal(half.profile.cohesion, 2, '4 × 75/150');
    t.equal(half.profile.bv, 1.5);
    t.equal(half.label, 'Bastion Defenders');
    t.equal(half.short, 'BD');
  });

  test('more than 150 defenders split as evenly as possible into detachments of at most 150', function (t) {
    t.same(BR.formDefenders(160, true, []).detachments.map(function (d) { return d.personnel; }), [80, 80]);
    t.same(BR.formDefenders(301, true, []).detachments.map(function (d) { return d.personnel; }), [101, 100, 100]);
    var two = BR.formDefenders(300, true, []).detachments;
    t.same(two.map(function (d) { return d.label; }), ['Bastion Defenders 1', 'Bastion Defenders 2']);
    t.same(two.map(function (d) { return d.id; }), ['def-1', 'def-2']);
  });

  test('fewer than 75 support regiments in order: +1 Cohesion per 5 armed, at most +2 (10 defenders) each', function (t) {
    var f = BR.formDefenders(13, true, ['r1', 'r2', 'r3']);
    t.same(f.support, [{ hostId: 'r1', count: 10, armed: true, bonus: 2 }, { hostId: 'r2', count: 3, armed: true, bonus: 0 }]);
    t.equal(f.detachments.length, 0);
    t.same(BR.formDefenders(20, true, ['r1', 'r2']).support.map(function (s) { return s.bonus; }), [2, 2]);
  });

  test('unarmed defenders: −2 Attack, and support at +1 per 10, at most +1', function (t) {
    var f = BR.formDefenders(25, false, ['r1', 'r2']);
    t.same(f.support, [{ hostId: 'r1', count: 10, armed: false, bonus: 1 }, { hostId: 'r2', count: 10, armed: false, bonus: 1 }]);
    t.equal(f.detachments.length, 1, 'the 5 left over form a small detachment');
    t.equal(f.detachments[0].personnel, 5);
    t.equal(f.detachments[0].profile.attack, 0, 'Levy +2, unarmed −2');
    t.equal(f.detachments[0].armed, false);
    t.equal(BR.formDefenders(100, false, []).detachments[0].profile.attack, 0);
  });

  test('defenders with no regiment to support form one small detachment (Cohesion at least 1, Battle Value at least ½)', function (t) {
    var f = BR.formDefenders(10, true, []);
    t.equal(f.support.length, 0);
    t.equal(f.detachments.length, 1);
    t.equal(f.detachments[0].profile.cohesion, 1);
    t.equal(f.detachments[0].profile.bv, 0.5);
    t.same(BR.formDefenders(0, true, ['r1']), { detachments: [], support: [] });
  });

  test('a detachment\'s Battle Value is rounded to the nearest half', function (t) {
    t.equal(BR.defenderSpec(100, true).profile.bv, 2);
    t.equal(BR.defenderSpec(50, true).profile.bv, 1);
    t.equal(BR.defenderSpec(60, true).profile.bv, 1, '1.2 → 1');
    t.equal(BR.defenderSpec(65, true).profile.bv, 1.5, '1.3 → 1.5');
    t.equal(BR.defenderSpec(120, true).profile.cohesion, 3, '4 × 0.8 = 3.2 → 3');
  });

  test('createBattle: support adds to its regiment\'s Cohesion; detachments join your army', function (t) {
    var b = make([U('p1', 'line'), U('p2', 'levy'), Beast('p3', 'Ape')], [], { defenders: { count: 12, armed: true, source: { from: 'bastion' } } });
    var p1 = BR.unitById(b, 'p1');
    t.same(p1.support, { count: 10, armed: true, bonus: 2 });
    t.equal(p1.cohesionMax, 7);
    t.equal(p1.cohesion, 7);
    t.same(BR.unitById(b, 'p2').support, { count: 2, armed: true, bonus: 0 });
    t.equal(BR.unitById(b, 'p3').support, null, 'beasts are never supported');
    t.equal(BR.unitBV(p1), 6, 'support adds ½ Battle Value per point');
    var big = make([U('p1', 'line')], [], { defenders: { count: 100, armed: true, source: { from: 'bastion' } } });
    var det = BR.unitById(big, 'def-1');
    t.same([det.side, det.kind, det.personnel, det.armed], ['player', 'detachment', 100, true]);
    t.same(det.source, { from: 'bastion', defenders: true });
    t.equal(BR.unitById(big, 'p1').support, null);
  });

  test('objectives: the raid\'s three supply markers sit one row above the enemy zone\'s bottom row, at about 20%, 50% and 80%', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' });
    t.equal(b.objective.id, 'raid');
    t.same(b.objective.markers, [
      { id: 'm1', c: 4, r: 3, state: 'field', carrier: null },
      { id: 'm2', c: 11, r: 3, state: 'field', carrier: null },
      { id: 'm3', c: 17, r: 3, state: 'field', carrier: null }
    ]);
    t.equal(b.objective.zone, null);
    t.same(b.objective.held, { player: 0, enemy: 0 });
    t.equal(b.objective.extracted, 0);
    var square = make([], [], { objective: 'raid', board: { w: 1600, h: 1600 } });
    t.same(square.objective.markers.map(function (m) { return m.r; }), [8, 8, 8], '22 rows: strip 10–11, markers on row 8');
  });

  test('objectives: your 4 × 2 supply depot is centred in your zone; the 4 × 2 outpost in the enemy\'s', function (t) {
    t.same(make([], [], { objective: 'defend' }).objective.zone, { c0: 9, r0: 8, c1: 12, r1: 9, owner: 'player' });
    t.same(make([], [], { objective: 'seize_outpost' }).objective.zone, { c0: 9, r0: 1, c1: 12, r1: 2, owner: 'enemy' });
    var sk = make([], [], { objective: 'skirmish' }).objective;
    t.same([sk.markers, sk.zone], [[], null]);
    t.equal(make([], [], { objective: 'nonsense' }).objective.id, 'skirmish', 'an unknown objective is a skirmish');
  });

  test('starting Battle Value counts leaders; Luck +1 gives you the first move, otherwise the enemy goes first', function (t) {
    var opts = { leaders: [{ id: 'lt-1', name: 'Lieutenant 1' }], captains: [{ id: 'c1', name: 'Captain Varn' }] };
    var b = make([U('p1', 'line'), U('p2', 'archers')], [U('e1', 'heavy')], opts);
    t.same(b.startBV, { player: 12, enemy: 9 });
    t.same([b.v, b.phase, b.round, b.maxRounds, b.started, b.result], [2, 'setup', 1, 6, false, null]);
    t.same(b.conditions, CLEAR);
    t.equal(b.firstSide, 'enemy');
    t.equal(b.turnSide, 'enemy');
    t.equal(make([], [], { conditions: { luckMod: 1 } }).firstSide, 'player');
    t.equal(make([], [], { conditions: { luckMod: -1 } }).firstSide, 'enemy');
    t.same(b.leaders[0], { id: 'lt-1', side: 'player', name: 'Lieutenant 1', hostId: null, autoRallyLeft: 1, bv: 2, source: {} });
    t.same([b.leaders[1].side, b.leaders[1].name], ['enemy', 'Captain Varn']);
    t.equal(make([], [], { conditions: { weather: 'hurricane' } }).conditions.weather, 'clear', 'unknown weather is a clear day');
  });

  /* ---------- Deployment ---------- */
  group('War battle: deployment');

  test('both armies deploy inside their own zones, never on the strip, impassable ground or a supply marker, one unit to a square', function (t) {
    var player = [U('p1', 'line'), U('p2', 'line'), U('p3', 'line'), U('p4', 'line'), U('p5', 'archers'), U('p6', 'archers'), U('p7', 'light_cav'), U('p8', 'light_cav'), Beast('p9', 'Ape'), Beast('p10', 'Crocodile')];
    var enemy = [U('e1', 'line'), U('e2', 'line'), U('e3', 'line'), U('e4', 'levy'), U('e5', 'levy'), U('e6', 'archers'), U('e7', 'archers'), U('e8', 'shock_cav'), Beast('e9', 'Dire Wolf')];
    var b = make(player, enemy, { objective: 'raid', defenders: { count: 100, armed: true } });
    var terrain = paint(b, Object.assign(cells(['9,7', '10,7', '11,7', '12,7'], 'x'), cells(['10,4', '11,4'], 'k'), cells(['13,7', '13,8'], 'w')));
    BR.beginDeployment(b, terrain);
    t.equal(b.phase, 'deploy');
    var seen = {};
    var markers = {};
    b.objective.markers.forEach(function (m) { markers[m.c + ',' + m.r] = true; });
    b.units.forEach(function (u) {
      t.ok(u.pos, u.id + ' is placed');
      var k = u.pos.c + ',' + u.pos.r;
      t.equal(BR.zoneOf(b, u.pos.r), u.side, u.id + ' is in its own zone');
      t.ok(!BR.terrainAt(terrain, u.pos.c, u.pos.r).impassable, u.id + ' is not on water or a cliff');
      t.ok(!seen[k], u.id + ' has a square of its own');
      t.ok(!markers[k], u.id + ' is not on a supply marker');
      t.same(u.startPos, u.pos);
      seen[k] = true;
    });
    t.equal(b.units.length, 20, 'and the defenders\' detachment');
  });

  test('your infantry form the front row just below the strip, archers behind them, cavalry and beasts on the flanks', function (t) {
    var b = make([U('p1', 'line'), U('p2', 'heavy'), U('p3', 'levy'), U('p4', 'archers'), U('p5', 'archers'), U('p6', 'light_cav'), U('p7', 'shock_cav'), Beast('p8', 'Panther')], [U('e1', 'line')]);
    BR.beginDeployment(b, null);
    var inf = ['p1', 'p2', 'p3'].map(function (id) { return BR.unitById(b, id).pos; });
    inf.forEach(function (p) { t.equal(p.r, 7, 'infantry on the front row'); });
    var lo = Math.min.apply(null, inf.map(function (p) { return p.c; }));
    var hi = Math.max.apply(null, inf.map(function (p) { return p.c; }));
    t.equal(hi - lo, 2, 'side by side');
    t.ok(lo >= 9 && hi <= 12, 'in the centre');
    ['p4', 'p5'].forEach(function (id) { t.equal(BR.unitById(b, id).pos.r, 8, id + ' behind the infantry'); });
    var flanks = ['p6', 'p7', 'p8'].map(function (id) { return BR.unitById(b, id).pos; });
    flanks.forEach(function (p) { t.ok(p.c < lo || p.c > hi, 'on a flank'); });
    t.ok(flanks.some(function (p) { return p.c < lo; }) && flanks.some(function (p) { return p.c > hi; }), 'on both flanks');
  });

  test('the enemy: infantry nearest the strip, archers behind, cavalry together on one flank', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line'), U('e3', 'levy'), U('e4', 'archers'), U('e5', 'light_cav'), U('e6', 'light_cav'), Beast('e7', 'Dire Wolf')]);
    BR.beginDeployment(b, null);
    var inf = ['e1', 'e2', 'e3'].map(function (id) { return BR.unitById(b, id).pos; });
    inf.forEach(function (p) { t.equal(p.r, 4, 'infantry nearest the strip'); });
    t.equal(BR.unitById(b, 'e4').pos.r, 3, 'archers behind');
    var lo = Math.min.apply(null, inf.map(function (p) { return p.c; }));
    var hi = Math.max.apply(null, inf.map(function (p) { return p.c; }));
    var cav = ['e5', 'e6'].map(function (id) { return BR.unitById(b, id).pos.c; });
    var left = cav.every(function (c) { return c < lo; });
    var right = cav.every(function (c) { return c > hi; });
    t.ok(left || right, 'both cavalry on the same flank');
    var wolf = BR.unitById(b, 'e7').pos.c;
    t.ok(left ? wolf > hi : wolf < lo, 'the beast takes the other flank');
  });

  test('the enemy cavalry go to the flank with more room', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'light_cav')]);
    var marks = {};
    for (var c = 0; c < 10; c++) { marks[c + ',4'] = 'x'; marks[c + ',3'] = 'x'; }
    BR.beginDeployment(b, paint(b, marks));
    t.ok(BR.unitById(b, 'e2').pos.c > BR.unitById(b, 'e1').pos.c, 'the left is water, so the right');
  });

  test('the enemy keeps a reserve near its objective: just behind the supply markers, or inside the outpost', function (t) {
    var raid = make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line'), U('e3', 'line'), U('e4', 'line'), U('e5', 'archers'), Beast('e6', 'Dire Wolf')], { objective: 'raid' });
    BR.beginDeployment(raid, null);
    t.same(BR.unitById(raid, 'e6').pos, at(11, 2), 'the beast guards the middle marker');
    t.same(BR.unitById(raid, 'e4').pos, at(4, 2), 'the last infantry unit guards the next');
    ['e1', 'e2', 'e3'].forEach(function (id) { t.equal(BR.unitById(raid, id).pos.r, 4, id + ' holds the line'); });
    var seize = make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line'), U('e3', 'archers')], { objective: 'seize_outpost' });
    BR.beginDeployment(seize, null);
    t.ok(BR.inZone(seize.objective.zone, BR.unitById(seize, 'e2').pos), 'a unit starts in the outpost');
    var lone = make([U('p1', 'line')], [U('e1', 'heavy')], { objective: 'seize_outpost' });
    BR.beginDeployment(lone, null);
    t.ok(BR.inZone(lone.objective.zone, BR.unitById(lone, 'e1').pos), 'even a lone unit holds the outpost');
  });

  test('supply markers painted over with deep water move to the nearest squares your troops can reach on foot', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' });
    var river = {};
    for (var c = 0; c < b.cols; c++) river[c + ',3'] = c === 7 ? 'f' : 'x';
    var tt = paint(b, river);
    BR.beginDeployment(b, tt);
    t.same(b.objective.markers.map(function (m) { return [m.c, m.r]; }), [[4, 2], [11, 2], [17, 2]], 'the next row back (across the ford), the same columns');
    b.objective.markers.forEach(function (m) {
      t.equal(BR.zoneOf(b, m.r), 'enemy', m.id + ' stays in the enemy\'s zone');
      t.equal(BR.moveCost(b, BR.unitById(b, 'p1'), m, tt), 1, m.id + ' can be walked onto');
      t.same([m.state, m.carrier], ['field', null]);
    });
    t.same(BR.objectiveProblems(b, tt), []);
    BR.beginDeployment(b, null);
    t.same(b.objective.markers.map(function (m) { return [m.c, m.r]; }), [[4, 3], [11, 3], [17, 3]], 'with no painting they go back where they were laid out');
  });

  test('a supply marker walled in by cliffs moves out to where your troops can reach it and carry it home', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' });
    var ring = {};
    for (var c = 10; c <= 12; c++) for (var r = 2; r <= 4; r++) if (c !== 11 || r !== 3) ring[c + ',' + r] = 'k';
    var tt = paint(b, ring);
    BR.beginDeployment(b, tt);
    t.same(b.objective.markers.map(function (m) { return [m.c, m.r]; }), [[4, 3], [9, 3], [17, 3]], 'the middle one moves just outside the ring, on its own row');
    t.same(BR.objectiveProblems(b, tt), []);
  });

  test('the outpost or your depot painted over with water moves to the nearest place where every square can be stood on', function (t) {
    var seize = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' });
    var lake = {};
    for (var c = 9; c <= 12; c++) for (var r = 1; r <= 2; r++) lake[c + ',' + r] = 'x';
    var tt = paint(seize, lake);
    BR.beginDeployment(seize, tt);
    var z = seize.objective.zone;
    t.same(z, { c0: 9, r0: 3, c1: 12, r1: 4, owner: 'enemy' }, 'just in front of the lake, in the same columns');
    t.equal(BR.zoneCells(z).filter(function (q) { return isFinite(BR.moveCost(seize, BR.unitById(seize, 'p1'), q, tt)); }).length, 8, 'your Line Infantry can stand on every square of it');
    t.ok(BR.inZone(z, BR.unitById(seize, 'e1').pos), 'the enemy\'s reserve deploys in the outpost where it now is');
    t.same(BR.objectiveProblems(seize, tt), []);
    var defend = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'defend' });
    var pond = paint(defend, { '10,9': 'x' });
    BR.beginDeployment(defend, pond);
    t.same(defend.objective.zone, { c0: 9, r0: 7, c1: 12, r1: 8, owner: 'player' }, 'one row nearer the strip, clear of the pond');
    BR.beginDeployment(defend, null);
    t.same(defend.objective.zone, { c0: 9, r0: 8, c1: 12, r1: 9, owner: 'player' }, 'with no painting it goes back where it was laid out');
  });

  test('objectiveProblems: says when deep water or cliffs leave the objective out of reach on foot', function (t) {
    function across(b, r) {
      var m = {};
      for (var c = 0; c < b.cols; c++) m[c + ',' + r] = 'x';
      return paint(b, m);
    }
    var raid = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' });
    t.same(BR.objectiveProblems(raid, null), [], 'nothing painted: all is well');
    var river = across(raid, 5);
    BR.beginDeployment(raid, river);
    t.same(BR.objectiveProblems(raid, river), ['Only 0 of the supply markers can be reached from your starting edge on foot, and the raid needs 2: deep water or cliffs are in the way.']);
    t.ok(raid.objective.markers.every(function (m) { return !BR.terrainAt(river, m.c, m.r).impassable; }), 'the markers still sit on ground that can be stood on');
    t.same(BR.objectiveProblems(raid, across(raid, 11)), ['Your starting edge is all deep water or cliff, so no supply marker can be brought home (except by a unit that can fly or swim).']);
    var seize = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' });
    BR.beginDeployment(seize, across(seize, 5));
    t.same(BR.objectiveProblems(seize, across(seize, 5)), ['Your troops can\'t reach any square of the outpost on foot, so it can\'t be seized: deep water or cliffs are in the way.']);
    var defend = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'defend' });
    t.same(BR.objectiveProblems(defend, across(defend, 6)), ['The enemy can\'t reach any square of your supply depot on foot: deep water or cliffs are in the way.']);
    t.same(BR.objectiveProblems(make([], []), across(raid, 5)), [], 'a skirmish has nothing to reach');
  });

  test('objectiveProblems: a river zig-zagging corner to corner across the board cuts it off just the same', function (t) {
    var raid = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' });
    var m = {};
    for (var c = 0; c < raid.cols; c++) m[c + ',' + (5 + c % 2)] = 'x';
    var zigzag = paint(raid, m);
    BR.beginDeployment(raid, zigzag);
    t.same(BR.objectiveProblems(raid, zigzag), ['Only 0 of the supply markers can be reached from your starting edge on foot, and the raid needs 2: deep water or cliffs are in the way.']);
  });

  test('the DM may move a supply marker while deploying: anywhere on the enemy\'s ground that can be stood on, free of units and other supplies', function (t) {
    /* Harry asked (3 October 2026) to move the supplies, outposts and depots as the enemy's units can be moved. */
    var b = make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line')], { objective: 'raid' });
    t.equal(BR.canMoveObjective(b, { marker: 'm1' }, at(2, 1), null), false, 'not before deploying');
    BR.beginDeployment(b, null);
    t.ok(BR.moveObjective(b, { marker: 'm1' }, at(2, 1), null));
    t.same([b.objective.markers[0].c, b.objective.markers[0].r, b.objective.dmPlaced], [2, 1, true]);
    t.equal(BR.canMoveObjective(b, { marker: 'm1' }, at(2, 10), null), false, 'not on your ground');
    t.equal(BR.canMoveObjective(b, { marker: 'm1' }, at(2, 5), null), false, 'not on the strip');
    t.equal(BR.canMoveObjective(b, { marker: 'm1' }, at(30, 1), null), false, 'not off the board');
    var e1 = BR.unitById(b, 'e1').pos;
    t.equal(BR.canMoveObjective(b, { marker: 'm1' }, e1, null), false, 'not on a unit');
    var m2 = b.objective.markers[1];
    t.equal(BR.canMoveObjective(b, { marker: 'm1' }, at(m2.c, m2.r), null), false, 'not on other supplies');
    var water = paint(b, { '3,1': 'x' });
    t.equal(BR.canMoveObjective(b, { marker: 'm1' }, at(3, 1), water), false, 'not on deep water');
    t.equal(BR.canMoveObjective(b, { marker: 'nope' }, at(3, 1), null), false, 'no such marker');
    t.equal(BR.canMoveObjective(b, { zone: true }, at(3, 1), null), false, 'a raid has no zone');
    BR.startBattle(b);
    t.equal(BR.moveObjective(b, { marker: 'm1' }, at(4, 1), null), false, 'not once the battle has started');
  });

  test('a repaint while deploying keeps the DM\'s placement (unless the new painting rules it out); a fresh deployment lays the objective out again', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' });
    BR.beginDeployment(b, null);
    var laidOut = { c: b.objective.markers[0].c, r: b.objective.markers[0].r };
    BR.moveObjective(b, { marker: 'm1' }, at(2, 1), null);
    t.ok(BR.fitObjective(b, paint(b, { '9,9': 'c' })));
    t.same([b.objective.markers[0].c, b.objective.markers[0].r], [2, 1], 'kept where the DM put it');
    BR.fitObjective(b, paint(b, { '2,1': 'x' }));
    var m = b.objective.markers[0];
    t.ok(!(m.c === 2 && m.r === 1), 'moved off the new deep water');
    t.equal(BR.dist(m, at(2, 1)), 1, 'to the nearest square');
    BR.beginDeployment(b, null);
    t.same([b.objective.markers[0].c, b.objective.markers[0].r, b.objective.dmPlaced], [laidOut.c, laidOut.r, undefined], 'laid out afresh');
  });

  test('a repaint while deploying leaves what the DM placed exactly where it was put, even out of reach on foot (and the warning stays); supplies the DM didn\'t move are still fitted', function (t) {
    /* Review (3 October 2026): any repaint used to move a DM-placed marker,
       depot or outpost that troops on foot couldn't reach, and the warning
       went with it. */
    function ring(marks, cc, rr, code) {
      for (var c = cc - 1; c <= cc + 1; c++) for (var r = rr - 1; r <= rr + 1; r++) if ((c !== cc || r !== rr) && r >= 0) marks[c + ',' + r] = code;
      return marks;
    }
    var b = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' });
    BR.beginDeployment(b, null);
    var marks = ring(ring({}, 8, 1, 'k'), 14, 1, 'k');
    var tt = paint(b, marks);
    t.ok(BR.fitObjective(b, tt));
    t.ok(BR.moveObjective(b, { marker: 'm1' }, at(8, 1), tt), 'm1 into one ring of cliffs');
    t.ok(BR.moveObjective(b, { marker: 'm2' }, at(14, 1), tt), 'm2 into the other');
    var warn = ['Only 1 of the supply markers can be reached from your starting edge on foot, and the raid needs 2: deep water or cliffs are in the way.'];
    t.same(BR.objectiveProblems(b, tt), warn);
    var m3 = { c: b.objective.markers[2].c, r: b.objective.markers[2].r };
    marks['0,11'] = 'w';
    ring(marks, m3.c, m3.r, 'k');
    tt = paint(b, marks);
    t.ok(BR.fitObjective(b, tt));
    t.same(b.objective.markers.slice(0, 2).map(function (m) { return [m.c, m.r]; }), [[8, 1], [14, 1]], 'the DM\'s two stay put');
    var m = b.objective.markers[2];
    t.ok(!(m.c === m3.c && m.r === m3.r) && !BR.terrainAt(tt, m.c, m.r).impassable, 'the one the DM didn\'t move is fitted out of its new ring');
    t.same(BR.objectiveProblems(b, tt), warn, 'and the warning stays');
    marks['8,1'] = 'x';
    tt = paint(b, marks);
    BR.fitObjective(b, tt);
    t.ok(!(b.objective.markers[0].c === 8 && b.objective.markers[0].r === 1) && !BR.terrainAt(tt, b.objective.markers[0].c, b.objective.markers[0].r).impassable, 'painted over with deep water: it moves');
    t.same([b.objective.markers[1].c, b.objective.markers[1].r], [14, 1]);

    /* The depot: partly on deep water is fine, and it stays. */
    var d = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'defend' });
    BR.beginDeployment(d, null);
    var dm = {};
    for (var c = 0; c <= 2; c++) for (var r = 9; r <= 10; r++) dm[c + ',' + r] = 'x';
    var dt = paint(d, dm);
    BR.fitObjective(d, dt);
    t.ok(BR.moveObjective(d, { zone: true }, at(1, 9), dt));
    var placed = JSON.stringify(d.objective.zone);
    dm['20,0'] = 'w';
    dt = paint(d, dm);
    BR.fitObjective(d, dt);
    t.equal(JSON.stringify(d.objective.zone), placed, 'kept, although half of it is deep water');
    BR.zoneCells(d.objective.zone).forEach(function (q) { dm[q.c + ',' + q.r] = 'x'; });
    dt = paint(d, dm);
    BR.fitObjective(d, dt);
    t.ok(BR.zoneCells(d.objective.zone).some(function (q) { return !BR.terrainAt(dt, q.c, q.r).impassable; }), 'all of it under water: it moves to ground that can be stood on');

    /* The outpost: walled off by cliffs, where the DM put it. */
    var s = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' });
    BR.beginDeployment(s, null);
    var sm = { '5,0': 'k', '5,1': 'k' };
    for (c = 0; c <= 5; c++) sm[c + ',2'] = 'k';
    var st = paint(s, sm);
    BR.fitObjective(s, st);
    t.ok(BR.moveObjective(s, { zone: true }, at(0, 0), st));
    var cut = ['Your troops can\'t reach any square of the outpost on foot, so it can\'t be seized: deep water or cliffs are in the way.'];
    t.same(BR.objectiveProblems(s, st), cut);
    sm['21,11'] = 'w';
    st = paint(s, sm);
    BR.fitObjective(s, st);
    t.same([s.objective.zone.c0, s.objective.zone.r0], [0, 0], 'kept where the DM put it');
    t.same(BR.objectiveProblems(s, st), cut, 'and the warning stays');
  });

  test('the DM may move your supply depot or the outpost as a block: it keeps its size, stays on its owner\'s ground, and needs a square to stand on', function (t) {
    var d = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'defend' });
    BR.beginDeployment(d, null);
    var z = d.objective.zone;
    var w = z.c1 - z.c0, h = z.r1 - z.r0;
    t.ok(BR.moveObjective(d, { zone: true }, at(3, z.r0), null));
    t.same(d.objective.zone, { c0: 3, r0: z.r0, c1: 3 + w, r1: z.r0 + h, owner: 'player' });
    t.equal(BR.canMoveObjective(d, { zone: true }, at(3, 1), null), false, 'not on the enemy\'s ground');
    t.equal(BR.canMoveObjective(d, { zone: true }, at(3, d.strip[d.strip.length - 1]), null), false, 'not on the strip');
    t.equal(BR.canMoveObjective(d, { zone: true }, at(d.cols - w, z.r0), null), false, 'not off the board');
    t.ok(BR.canMoveObjective(d, { zone: true }, at(d.cols - w - 1, d.rows - 1 - h), null), 'right up to the edges');
    var marks = {};
    for (var r = 7; r <= 8; r++) for (var c = 10; c <= 10 + w; c++) marks[c + ',' + r] = 'x';
    var lake = paint(d, marks);
    t.equal(BR.canMoveObjective(d, { zone: true }, at(10, 7), lake), false, 'not all deep water');
    t.ok(BR.canMoveObjective(d, { zone: true }, at(9, 7), lake), 'partly is fine');
    var p1 = BR.unitById(d, 'p1').pos;
    t.ok(BR.canMoveObjective(d, { zone: true }, p1, null), 'units may be inside it');
    var s = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' });
    BR.beginDeployment(s, null);
    t.ok(BR.moveObjective(s, { zone: true }, at(0, 0), null));
    t.same([s.objective.zone.c0, s.objective.zone.r0, s.objective.zone.owner], [0, 0, 'enemy']);
    t.equal(BR.canMoveObjective(s, { zone: true }, at(0, 8), null), false, 'the outpost stays on the enemy\'s ground');
  });

  test('fitObjective: after a repaint while deploying, the objective moves off the new water, avoiding units; units stay put', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line')], { objective: 'raid' });
    BR.beginDeployment(b, null);
    t.ok(BR.deployMove(b, 'e1', at(10, 3), null, { dm: true }), 'the DM puts an enemy unit next to the middle marker');
    var before = JSON.stringify(b.units.map(function (u) { return u.pos; }));
    var tt = paint(b, { '11,3': 'x' });
    t.ok(BR.fitObjective(b, tt));
    t.same(b.objective.markers.map(function (m) { return [m.c, m.r]; }), [[4, 3], [12, 3], [17, 3]], 'not onto the unit\'s square');
    t.equal(JSON.stringify(b.units.map(function (u) { return u.pos; })), before, 'no unit has moved');
    t.equal(b.phase, 'deploy');
    BR.startBattle(b);
    t.equal(BR.fitObjective(b, null), false, 'not once the battle has begun');
    t.same(b.objective.markers[1], { id: 'm2', c: 12, r: 3, state: 'field', carrier: null });
  });

  test('leaders join the strongest formation without a leader: never a beast, one to a formation', function (t) {
    var b = make([U('p1', 'line'), U('p2', 'heavy'), Beast('p3', 'Owlbear')], [U('e1', 'levy'), U('e2', 'line')], {
      leaders: [{ id: 'lt-1' }, { id: 'lt-2' }, { id: 'lt-3' }], captains: [{ id: 'c1' }]
    });
    BR.beginDeployment(b, null);
    t.equal(BR.leaderById(b, 'lt-1').hostId, 'p2', 'Heavy Infantry (7) first');
    t.equal(BR.leaderById(b, 'lt-2').hostId, 'p1');
    t.equal(BR.leaderById(b, 'lt-3').hostId, null, 'no formation left for the third');
    t.equal(BR.unitById(b, 'p3').leaderId, null, 'never the Owlbear');
    t.equal(BR.unitById(b, 'p2').leaderId, 'lt-1');
    t.equal(BR.leaderById(b, 'c1').hostId, 'e2');
    t.equal(BR.leaderById(b, 'lt-1').name, 'Lieutenant 1');
    t.equal(BR.leaderById(b, 'c1').name, 'Captain 1');
  });

  test('a defenders\' detachment can take a leader', function (t) {
    var b = make([Beast('p1', 'Ape')], [], { leaders: [{ id: 'lt-1' }], defenders: { count: 90, armed: true } });
    BR.beginDeployment(b, null);
    t.equal(BR.leaderById(b, 'lt-1').hostId, 'def-1');
  });

  test('moving a unit while deploying: your zone only, never the strip, impassable ground or someone else\'s square', function (t) {
    var b = make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')]);
    var terrain = paint(b, { '3,9': 'x' });
    t.ok(!BR.canDeploy(b, 'p1', at(3, 10), terrain), 'not before deployment begins');
    BR.beginDeployment(b, terrain);
    t.ok(BR.canDeploy(b, 'p1', at(3, 10), terrain));
    t.ok(!BR.canDeploy(b, 'p1', at(3, 9), terrain), 'deep water');
    t.ok(!BR.canDeploy(b, 'p1', at(3, 6), terrain), 'the strip');
    t.ok(!BR.canDeploy(b, 'p1', at(3, 3), terrain), 'the enemy zone');
    t.ok(!BR.canDeploy(b, 'p1', BR.unitById(b, 'p2').pos, terrain), 'p2\'s square');
    t.ok(BR.canDeploy(b, 'p1', BR.unitById(b, 'p1').pos, terrain), 'its own square');
    t.ok(!BR.canDeploy(b, 'p1', at(22, 9), terrain), 'off the board');
    t.ok(!BR.canDeploy(b, 'e1', at(3, 2), terrain), 'not an enemy unit');
    t.ok(BR.deployMove(b, 'p1', at(3, 10), terrain));
    t.same(BR.unitById(b, 'p1').pos, at(3, 10));
    t.same(BR.unitById(b, 'p1').startPos, at(3, 10));
    t.ok(!BR.deployMove(b, 'p2', at(3, 10), terrain), 'now taken');
    BR.startBattle(b);
    t.ok(!BR.deployMove(b, 'p1', at(4, 10), terrain), 'not once the battle has started');
  });

  test('the DM can move enemy units, within the enemy zone', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')]);
    BR.beginDeployment(b, null);
    t.ok(!BR.deployMove(b, 'e1', at(3, 2), null));
    t.ok(BR.canDeploy(b, 'e1', at(3, 2), null, { dm: true }));
    t.ok(!BR.canDeploy(b, 'e1', at(3, 9), null, { dm: true }), 'not into your zone');
    t.ok(BR.deployMove(b, 'e1', at(3, 2), null, { dm: true }));
    t.same(BR.unitById(b, 'e1').pos, at(3, 2));
  });

  test('attachLeader: while deploying, same side, never a beast, one leader to a formation', function (t) {
    var b = make([U('p1', 'line'), U('p2', 'line'), Beast('p3', 'Ape')], [U('e1', 'line')], { leaders: [{ id: 'lt-1' }, { id: 'lt-2' }], captains: [{ id: 'c1' }] });
    t.ok(!BR.attachLeader(b, 'lt-1', 'p1'), 'not before deployment');
    BR.beginDeployment(b, null);
    t.same([BR.unitById(b, 'p1').leaderId, BR.unitById(b, 'p2').leaderId], ['lt-1', 'lt-2']);
    t.ok(!BR.attachLeader(b, 'lt-1', 'p3'), 'a beast');
    t.ok(!BR.attachLeader(b, 'lt-1', 'p2'), 'p2 already has a leader');
    t.ok(!BR.attachLeader(b, 'lt-1', 'e1'), 'the other side');
    t.ok(!BR.attachLeader(b, 'c1', 'p1'), 'a Captain with your forces');
    t.ok(BR.attachLeader(b, 'lt-2', null), 'taking a leader off');
    t.equal(BR.unitById(b, 'p2').leaderId, null);
    t.ok(BR.attachLeader(b, 'lt-1', 'p2'));
    t.same([BR.unitById(b, 'p1').leaderId, BR.unitById(b, 'p2').leaderId, BR.leaderById(b, 'lt-1').hostId], [null, 'lt-1', 'p2']);
    BR.startBattle(b);
    t.ok(!BR.attachLeader(b, 'lt-2', 'p1'), 'not once the battle has started');
  });

  test('Start Battle: round 1, the first side\'s turn, "Battle begins" in the log; Battle Value fixed from the units on the board', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')], { leaders: [{ id: 'lt-1' }, { id: 'lt-2' }] });
    t.same(b.startBV, { player: 9, enemy: 5 });
    BR.startBattle(b);
    t.equal(b.phase, 'setup', 'nothing happens before deployment');
    BR.beginDeployment(b, null);
    BR.startBattle(b);
    t.same([b.phase, b.round, b.turnSide, b.started], ['battle', 1, 'enemy', false]);
    t.equal(b.log[0].text, 'Battle begins. Round 1: the enemy acts first.');
    t.same(b.startBV, { player: 7, enemy: 5 }, 'the second Lieutenant had no formation to lead');
    t.ok(BR.legalOrders(b, 'e1', null)[0].ok);
  });

  test('setBoard before the battle: a new shape lays the grid and objective out again', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' });
    BR.beginDeployment(b, null);
    t.ok(BR.setBoard(b, { w: 1600, h: 1600 }, 24));
    t.same([b.cols, b.rows, b.phase], [24, 24, 'setup']);
    t.equal(BR.unitById(b, 'p1').pos, null);
    t.equal(b.objective.markers[0].r, 9);
    BR.beginDeployment(b, null);
    BR.startBattle(b);
    t.ok(!BR.setBoard(b, null), 'not once the battle has started');
  });

  /* ---------- Movement ---------- */
  group('War battle: movement');

  test('Advance reaches up to Move squares on open ground, including where the unit stands', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 9], e1: [10, 0] });
    var reach = BR.reachable(b, 'p1', 'advance', null);
    t.equal(Object.keys(reach).length, 42, 'columns 7–13, rows 6–11');
    t.same(reach['10,9'], { cost: 0, path: [at(10, 9)] });
    t.ok(has(reach, 13, 6));
    t.ok(!has(reach, 14, 9));
    t.equal(reach['10,6'].cost, 3);
  });

  test('March reaches up to twice Move, but not its own square', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 9], e1: [10, 0] });
    var reach = BR.reachable(b, 'p1', 'march', null);
    t.equal(Object.keys(reach).length, 116);
    t.ok(!has(reach, 10, 9));
    t.ok(has(reach, 10, 3));
    t.ok(has(reach, 4, 3));
    t.ok(!has(reach, 10, 2));
  });

  test('difficult ground costs 2 to enter', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 9], e1: [10, 0] });
    var marks = {};
    for (var c = 0; c < 22; c++) marks[c + ',8'] = 'w';
    var terrain = paint(b, marks);
    var reach = BR.reachable(b, 'p1', 'advance', terrain);
    t.equal(reach['10,8'].cost, 2);
    t.equal(reach['10,7'].cost, 3);
    t.ok(has(reach, 9, 7));
    t.ok(!has(reach, 10, 6), '2 + 1 + 1 is more than Move 3');
    t.equal(BR.moveCost(b, BR.unitById(b, 'p1'), at(10, 8), terrain), 2);
    t.equal(BR.moveCost(b, BR.unitById(b, 'p1'), at(10, 10), terrain), 1);
  });

  test('Woodland, Wader and Cragsure units cross their own ground at normal cost; Climbers cross woods and rubble', function (t) {
    var b = make([
      U('p1', 'line', { variant: { id: 'blackstone_wardens', name: 'Blackstone Wardens', trait: 'woodland' } }),
      U('p2', 'line', { variant: { id: 'rowthorn_riverwardens', name: 'Rowthorn Riverwardens', trait: 'wader' } }),
      U('p3', 'levy', { variant: { id: 'bacca_cragmen', name: 'Bacca Cragmen', trait: 'cragsure' } }),
      Beast('p4', 'Ape'),
      U('p5', 'line')
    ], []);
    var terrain = paint(b, { '1,1': 'w', '2,1': 'd', '3,1': 'b', '4,1': 'r' });
    function costs(id) {
      var u = BR.unitById(b, id);
      return [1, 2, 3, 4].map(function (c) { return BR.moveCost(b, u, at(c, 1), terrain); });
    }
    t.same(costs('p1'), [1, 1, 2, 2], 'Woodland: woods and dense woods');
    t.same(costs('p2'), [2, 2, 1, 2], 'Wader: bog');
    t.same(costs('p3'), [2, 2, 2, 1], 'Cragsure: rubble');
    t.same(costs('p4'), [1, 1, 2, 1], 'Climber: woods, dense woods and rubble');
    t.same(costs('p5'), [2, 2, 2, 2], 'no trait');
  });

  test('deep water and cliffs can\'t be entered; a swimmer can cross and stand in water', function (t) {
    var b = fight(make([U('p1', 'line'), Beast('p2', 'Crocodile')], [U('e1', 'line')]), { p1: [4, 9], p2: [10, 9], e1: [10, 0] });
    var terrain = paint(b, { '4,8': 'x', '10,8': 'x', '11,8': 'k' });
    t.equal(BR.moveCost(b, BR.unitById(b, 'p1'), at(4, 8), terrain), Infinity);
    t.ok(!has(BR.reachable(b, 'p1', 'advance', terrain), 4, 8));
    t.equal(BR.moveCost(b, BR.unitById(b, 'p2'), at(10, 8), terrain), 1);
    t.equal(BR.moveCost(b, BR.unitById(b, 'p2'), at(11, 8), terrain), Infinity, 'not a cliff');
    var croc = BR.reachable(b, 'p2', 'advance', terrain);
    t.ok(has(croc, 10, 8), 'it can stop in the water');
    t.ok(!has(croc, 11, 8));
  });

  /* A river or cliff painted on a slant: one diagonal drag of the Terrain
     brush paints squares that touch only at their corners (here every
     square with c + r = 16, from 16,0 down to 5,11). */
  function slant(battle, code) {
    var m = {};
    for (var c = 0; c < battle.cols; c++) if (16 - c >= 0 && 16 - c < battle.rows) m[c + ',' + (16 - c)] = code;
    return paint(battle, m);
  }
  function beyond(reach) { return Object.keys(reach).filter(function (k) { var p = k.split(',').map(Number); return p[0] + p[1] > 16; }); }
  /* Does a path squeeze diagonally between two squares this unit can't enter? */
  function squeezes(b, u, path, terrain) {
    for (var i = 1; i < path.length; i++) {
      var p = path[i - 1];
      var q = path[i];
      if (p.c !== q.c && p.r !== q.r && BR.moveCost(b, u, at(q.c, p.r), terrain) === Infinity && BR.moveCost(b, u, at(p.c, q.r), terrain) === Infinity) return true;
    }
    return false;
  }

  test('a river or cliff painted on a slant can\'t be crossed by stepping between its corners', function (t) {
    ['x', 'k'].forEach(function (code) {
      var what = code === 'x' ? 'deep water' : 'a cliff';
      var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [8, 7], e1: [0, 0] });
      var tt = slant(b, code);
      t.same(beyond(BR.reachable(b, 'p1', 'advance', tt)), [], what + ': Advance stays on its own bank');
      t.same(beyond(BR.reachable(b, 'p1', 'march', tt)), [], what + ': March stays on its own bank');
      var res = BR.resolveOrder(b, { unitId: 'p1', id: 'advance', dest: at(9, 8) }, tt, d20(10));
      t.ok(!res.ok, what + ': the move across the corner is refused');
      t.same(BR.unitById(b, 'p1').pos, at(8, 7), what + ': it stays put');
      t.ok(has(BR.reachable(b, 'p1', 'advance', tt), 7, 6), what + ': it can still move along its own bank');
    });
    var animals = fight(make([Beast('p1', 'Crocodile'), Beast('p2', 'Giant Vulture')], [U('e1', 'line')]), { p1: [8, 7], p2: [4, 9], e1: [0, 0] });
    var water = slant(animals, 'x');
    t.ok(has(BR.reachable(animals, 'p1', 'advance', water), 9, 8), 'a swimmer crosses the river');
    t.ok(beyond(BR.reachable(animals, 'p2', 'advance', slant(animals, 'k'))).length > 0, 'a flyer crosses the cliff');
  });

  test('one square of water at a corner doesn\'t stop a diagonal step; two that touch at the corner do', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [8, 7], e1: [0, 0] });
    var one = paint(b, { '9,7': 'x' });
    var reach = BR.reachable(b, 'p1', 'advance', one);
    t.same(reach['9,8'].path, [at(8, 7), at(9, 8)], 'past one square of water');
    t.equal(reach['9,8'].cost, 1);
    var two = paint(b, { '9,7': 'x', '8,8': 'k' });
    var round = BR.reachable(b, 'p1', 'advance', two);
    t.equal(round['9,8'].cost, 3, 'between water and a cliff it has to go round');
    t.ok(!squeezes(b, BR.unitById(b, 'p1'), round['9,8'].path, two), JSON.stringify(round['9,8'].path));
    /* The straight line is as cheap as the way round only because of the
       woods on it: the way round must still be the path given. */
    var tie = paint(b, { '9,7': 'x', '8,8': 'x', '9,8': 'w', '10,9': 'w' });
    var march = BR.reachable(b, 'p1', 'march', tie);
    t.equal(march['11,10'].cost, 5);
    t.ok(!squeezes(b, BR.unitById(b, 'p1'), march['11,10'].path, tie), JSON.stringify(march['11,10'].path));
  });

  test('Flight crosses water, cliffs and enemy units, ignores zones of control, and ends on an empty square', function (t) {
    var b = fight(make([Beast('p1', 'Giant Vulture'), U('p2', 'line')], [U('e1', 'line')]), { p1: [10, 10], p2: [3, 10], e1: [10, 7] });
    var marks = {};
    for (var c = 0; c < 22; c++) marks[c + ',8'] = 'k';
    marks['10,6'] = 'x';
    var terrain = paint(b, marks);
    var fly = BR.reachable(b, 'p1', 'advance', terrain);
    t.ok(has(fly, 10, 4), 'over the cliffs, the enemy and the water');
    t.same(fly['10,4'].path, [at(10, 10), at(10, 9), at(10, 8), at(10, 7), at(10, 6), at(10, 5), at(10, 4)]);
    t.ok(!has(fly, 10, 7), 'never on the enemy');
    t.ok(has(fly, 10, 6), 'it may stop over water');
    var walk = BR.reachable(b, 'p2', 'march', terrain);
    t.ok(Object.keys(walk).every(function (k) { return walk[k].path[walk[k].path.length - 1].r > 8; }), 'a unit on foot can\'t cross the cliffs');
  });

  test('a unit may pass through its own side\'s units but not stop on them', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')]), { p1: [10, 9], p2: [10, 8], e1: [10, 0] });
    var marks = {};
    for (var c = 0; c < 22; c++) if (c !== 10) marks[c + ',8'] = 'k';
    var reach = BR.reachable(b, 'p1', 'advance', paint(b, marks));
    t.ok(!has(reach, 10, 8), 'not on p2');
    t.equal(reach['10,7'].cost, 2, 'through p2');
    t.ok(has(reach, 10, 6));
  });

  test('a unit never moves onto or through an enemy\'s square', function (t) {
    var b = fight(make([U('p1', 'light_cav')], [U('e1', 'line')]), { p1: [10, 10], e1: [10, 8] });
    t.ok(!has(BR.reachable(b, 'p1', 'advance', null), 10, 8));
    t.ok(!has(BR.reachable(b, 'p1', 'march', null), 10, 8));
  });

  test('zone of control: entering a square next to an enemy ends the move there', function (t) {
    var marks = {};
    for (var r = 3; r <= 9; r++) { marks['9,' + r] = 'k'; if (r !== 7) marks['11,' + r] = 'k'; }
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 10], e1: [11, 7] });
    var terrain = paint(b, marks);
    var reach = BR.reachable(b, 'p1', 'march', terrain);
    t.ok(has(reach, 10, 8), 'it can move up next to the enemy');
    t.ok(!has(reach, 10, 7), 'but no further');
    t.ok(!has(reach, 10, 5));
    BR.unitById(b, 'e1').pos = null;
    t.ok(has(BR.reachable(b, 'p1', 'march', terrain), 10, 4), 'with the enemy gone, the corridor is open');
  });

  test('snowstorm: every unit moves 1 less (at least 1) unless it is Hardy', function (t) {
    var b = make([U('p1', 'line'), U('p2', 'line', { variant: { id: 'karr_shieldbearers', name: 'Karr Shieldbearers', trait: 'hardy' } }), U('p3', 'heavy'), U('p4', 'line', { profile: { move: 1 } })], [], { conditions: { weather: 'white_blizzard' } });
    t.equal(BR.effectiveMove(b, BR.unitById(b, 'p1')), 2);
    t.equal(BR.effectiveMove(b, BR.unitById(b, 'p2')), 3, 'Hardy');
    t.equal(BR.effectiveMove(b, BR.unitById(b, 'p3')), 1);
    t.equal(BR.effectiveMove(b, BR.unitById(b, 'p4')), 1, 'never below 1');
    var clear = make([U('p1', 'line')], []);
    t.equal(BR.effectiveMove(clear, BR.unitById(clear, 'p1')), 3);
  });

  test('Fleet: +1 Move, already in the printed profile', function (t) {
    var b = fight(make([U('p1', 'light_cav', { variant: { id: 'slade_outriders', name: 'Slade Outriders', trait: 'fleet' } })], [U('e1', 'line')]), { p1: [10, 10], e1: [0, 0] });
    var u = BR.unitById(b, 'p1');
    t.equal(u.profile.move, 6);
    t.equal(BR.effectiveMove(b, u), 6, 'not added twice');
    t.ok(has(BR.reachable(b, 'p1', 'advance', null), 10, 4));
    t.ok(!has(BR.reachable(b, 'p1', 'advance', null), 10, 3));
  });

  test('an engaged unit can\'t move with Advance or March (it can still attack)', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 8], e1: [10, 7] });
    t.ok(BR.isEngaged(b, BR.unitById(b, 'p1')));
    t.same(BR.reachable(b, 'p1', 'advance', null), {});
    t.same(BR.reachable(b, 'p1', 'march', null), {});
    var march = why(b, 'p1', 'march');
    t.ok(!march.ok);
    t.ok(/engaged/.test(march.why), march.why);
    t.ok(why(b, 'p1', 'advance').ok, 'Advance & Attack, without moving');
    var res = BR.resolveOrder(b, { unitId: 'p1', id: 'advance', dest: at(10, 9) }, null, d20(10));
    t.ok(!res.ok && /Disengage/.test(res.why), res.why);
  });

  test('a unit held fast by a grapple can\'t March or Disengage', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')]), { p1: [10, 8], p2: [3, 10], e1: [10, 7] });
    BR.unitById(b, 'p1').heldFast = true;
    BR.unitById(b, 'p2').heldFast = true;
    t.same(BR.reachable(b, 'p1', 'disengage', null), {});
    t.ok(/held fast/.test(why(b, 'p1', 'disengage').why));
    t.same(BR.reachable(b, 'p2', 'march', null), {});
    t.ok(/held fast/.test(why(b, 'p2', 'march').why));
    t.ok(Object.keys(BR.reachable(b, 'p2', 'advance', null)).length > 1, 'it can still Advance');
  });

  test('Disengage: up to half Move, rounded up, to a square clear of every enemy; only when engaged', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')]), { p1: [10, 8], p2: [3, 10], e1: [10, 7] });
    var reach = BR.reachable(b, 'p1', 'disengage', null);
    t.ok(has(reach, 10, 10), '2 squares back');
    t.ok(has(reach, 10, 9));
    t.ok(!has(reach, 10, 11), 'Move 3 halves to 2');
    t.ok(!has(reach, 9, 8), 'still next to the enemy');
    t.ok(Object.keys(reach).every(function (k) { var p = reach[k].path[reach[k].path.length - 1]; return BR.dist(p, at(10, 7)) > 1; }));
    t.same(BR.reachable(b, 'p2', 'disengage', null), {}, 'p2 isn\'t engaged');
    t.ok(/isn't in melee/.test(why(b, 'p2', 'disengage').why));
  });

  test('the path given is the cheapest, and a straight line when one is as cheap', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 9], e1: [10, 0] });
    var reach = BR.reachable(b, 'p1', 'advance', null);
    t.same(reach['7,9'].path, [at(10, 9), at(9, 9), at(8, 9), at(7, 9)]);
    t.same(reach['13,6'].path, [at(10, 9), at(11, 8), at(12, 7), at(13, 6)]);
    t.same(reach['10,6'].path, [at(10, 9), at(10, 8), at(10, 7), at(10, 6)]);
  });

  /* ---------- Orders and attacks ---------- */
  group('War battle: orders and attacks');

  test('legal orders say why not', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')]), { p1: [10, 10], p2: [3, 10], e1: [10, 1] });
    var list = BR.legalOrders(b, 'p1', null);
    t.same(list.map(function (o) { return o.id; }), ['advance', 'march', 'hold', 'rally', 'disengage', 'interact']);
    t.same(list.map(function (o) { return o.ok; }), [true, true, true, false, false, false]);
    t.equal(why(b, 'p1', 'rally').why, 'Only a Shaken unit needs to Rally.');
    t.equal(why(b, 'p1', 'interact').why, 'Interact is only used to collect supply markers in a Raid.');
    t.equal(why(b, 'e1', 'hold').why, 'It\'s your turn: the enemy can\'t act now.');
    BR.unitById(b, 'p1').activated = true;
    t.equal(why(b, 'p1', 'hold').why, 'Line Infantry 1 has already acted this round.');
    BR.unitById(b, 'p2').status = 'shaken';
    t.ok(why(b, 'p2', 'rally').ok);
    b.turnSide = 'enemy';
    t.equal(why(b, 'p2', 'hold').why, 'It\'s the enemy\'s turn.');
    t.ok(BR.legalOrders(null, 'p1', null).every(function (o) { return !o.ok; }));
  });

  test('Interact: only for your units, standing on a supply marker, not already carrying one', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [11, 3], p2: [3, 10], e1: [20, 0] });
    t.ok(why(b, 'p1', 'interact').ok);
    t.equal(why(b, 'p2', 'interact').why, 'Stand on a supply marker to collect it.');
    BR.unitById(b, 'p1').carrying = 'm1';
    t.equal(why(b, 'p1', 'interact').why, 'It\'s already carrying a supply marker.');
    b.turnSide = 'enemy';
    BR.unitById(b, 'e1').pos = at(4, 3);
    t.equal(why(b, 'e1', 'interact').why, 'Only your forces collect supply markers.');
  });

  test('melee: any enemy next to the square the unit attacks from', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line')]), { p1: [10, 8], e1: [10, 7], e2: [12, 8] });
    t.same(BR.attackOptions(b, 'p1', at(10, 8), null, null), [{ targetId: 'e1', kind: 'melee', charge: false }]);
    t.same(BR.attackOptions(b, 'p1', at(11, 8), [at(10, 8), at(11, 8)], null).map(function (o) { return o.targetId; }), ['e1', 'e2']);
  });

  test('ranged: archers shoot up to 6 squares, in line of sight', function (t) {
    var b = fight(make([U('p1', 'archers')], [U('e1', 'line'), U('e2', 'line')]), { p1: [10, 10], e1: [10, 4], e2: [3, 3] });
    t.same(BR.attackOptions(b, 'p1', at(10, 10), null, null), [{ targetId: 'e1', kind: 'ranged', charge: false }]);
    var line = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 10], e1: [10, 6] });
    t.same(BR.attackOptions(line, 'p1', at(10, 10), null, null), [], 'only archers shoot');
  });

  test('line of sight: dense woods and ridges in between block it; cover, units and the end squares don\'t', function (t) {
    var b = make([], []);
    t.ok(BR.lineOfSight(b, null, at(10, 10), at(10, 4)));
    t.ok(!BR.lineOfSight(b, paint(b, { '10,7': 'd' }), at(10, 10), at(10, 4)), 'dense woods');
    t.ok(!BR.lineOfSight(b, paint(b, { '10,7': 'g' }), at(10, 10), at(10, 4)), 'a ridge');
    t.ok(BR.lineOfSight(b, paint(b, { '10,7': 'w' }), at(10, 10), at(10, 4)), 'ordinary woods');
    t.ok(BR.lineOfSight(b, paint(b, { '10,7': 'c' }), at(10, 10), at(10, 4)), 'cover');
    t.ok(BR.lineOfSight(b, paint(b, { '10,4': 'd', '10,10': 'g' }), at(10, 10), at(10, 4)), 'the shooter\'s and target\'s own squares');
    t.ok(!BR.lineOfSight(b, paint(b, { '12,7': 'd' }), at(10, 10), at(14, 4)), 'on a slant');
    var f = fight(make([U('p1', 'archers')], [U('e1', 'line'), U('e2', 'line')]), { p1: [10, 10], e1: [10, 4], e2: [10, 7] });
    t.same(BR.attackOptions(f, 'p1', at(10, 10), null, null).map(function (o) { return o.targetId; }), ['e1', 'e2'], 'units don\'t block');
    t.same(BR.attackOptions(f, 'p1', at(10, 10), null, paint(f, { '10,6': 'd' })).map(function (o) { return o.targetId; }), ['e2']);
  });

  test('line of sight works both ways: the same squares lie between two squares whichever end the line starts from', function (t) {
    var b = make([], []);
    var n = b.cols * b.rows;
    var oneWay = 0;
    var wrongEnds = 0;
    function sq(i) { return at(i % b.cols, Math.floor(i / b.cols)); }
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var there = BR.lineCells(sq(i), sq(j));
        var back = BR.lineCells(sq(j), sq(i)).reverse();
        if (JSON.stringify(there) !== JSON.stringify(back)) oneWay += 1;
        if (JSON.stringify([there[0], there[there.length - 1]]) !== JSON.stringify([sq(i), sq(j)])) wrongEnds += 1;
      }
    }
    t.equal(oneWay, 0, 'every pair of squares on a 22 × 12 board');
    t.equal(wrongEnds, 0, 'the line still runs from the first square to the second');
    /* Two archer units with a square of dense woods or a ridge near the
       line between them: either both can shoot or neither can. */
    function shots(marks) {
      var f = fight(make([U('p1', 'archers')], [U('e1', 'archers')]), { p1: [9, 7], e1: [10, 3] });
      var tt = paint(f, marks);
      return [BR.attackOptions(f, 'p1', null, null, tt).length > 0, BR.attackOptions(f, 'e1', null, null, tt).length > 0,
        BR.lineOfSight(f, tt, at(9, 7), at(10, 3)), BR.lineOfSight(f, tt, at(10, 3), at(9, 7))];
    }
    t.same(shots({ '10,5': 'd' }), [true, true, true, true], 'dense woods beside the line: both can shoot');
    t.same(shots({ '9,5': 'd' }), [false, false, false, false], 'dense woods on the line: neither can');
    t.same(shots({ '10,5': 'g' }), [true, true, true, true], 'a ridge beside the line');
    t.same(shots({ '9,5': 'g' }), [false, false, false, false], 'a ridge on the line');
  });

  test('line of sight can\'t slip between the corners of dense woods or a ridge painted on a slant', function (t) {
    ['d', 'g'].forEach(function (code) {
      var what = code === 'd' ? 'dense woods' : 'a ridge';
      var f = fight(make([U('p1', 'archers')], [U('e1', 'archers')]), { p1: [11, 10], e1: [7, 6] });
      var tt = slant(f, code);
      t.ok(!BR.lineOfSight(f, tt, at(11, 10), at(7, 6)), what + ': the shooter can\'t see through');
      t.ok(!BR.lineOfSight(f, tt, at(7, 6), at(11, 10)), what + ': nor can the target see back');
      t.same(BR.attackOptions(f, 'p1', null, null, tt), [], what + ': no shot offered');
      t.same(BR.attackOptions(f, 'e1', null, null, tt), [], what + ': nor back');
      t.ok(BR.lineOfSight(f, tt, at(11, 10), at(15, 6)), what + ': along its own side of the line it still sees');
    });
    var b = make([], []);
    t.ok(BR.lineOfSight(b, paint(b, { '9,7': 'd' }), at(11, 10), at(7, 6)), 'one square beside the corner doesn\'t block');
    t.ok(BR.lineOfSight(b, paint(b, { '9,7': 'd', '8,8': 'w' }), at(11, 10), at(7, 6)), 'nor does it with ordinary woods at the other corner');
    t.ok(!BR.lineOfSight(b, paint(b, { '9,7': 'd', '8,8': 'g' }), at(11, 10), at(7, 6)), 'dense woods and a ridge touching at the corner block');
  });

  test('no shooting into a melee', function (t) {
    var b = fight(make([U('p1', 'archers'), U('p2', 'line')], [U('e1', 'line')]), { p1: [10, 10], p2: [10, 6], e1: [10, 5] });
    t.same(BR.attackOptions(b, 'p1', at(10, 10), null, null), []);
  });

  test('archers next to an enemy fight it in melee and can\'t shoot anyone', function (t) {
    var b = fight(make([U('p1', 'archers')], [U('e1', 'line'), U('e2', 'line')]), { p1: [10, 8], e1: [10, 7], e2: [10, 3] });
    t.same(BR.attackOptions(b, 'p1', at(10, 8), null, null), [{ targetId: 'e1', kind: 'melee', charge: false }]);
    t.equal(BR.previewAttack(b, 'p1', at(10, 8), null, 'e1', null).attack, 1, 'the melee Attack, +1');
  });

  test('Charge: 2 or more squares in a straight line through open ground, into melee', function (t) {
    var b = fight(make([U('p1', 'light_cav')], [U('e1', 'line')]), { p1: [10, 11], e1: [10, 7] });
    var reach = BR.reachable(b, 'p1', 'advance', null);
    t.same(reach['10,8'].path, [at(10, 11), at(10, 10), at(10, 9), at(10, 8)]);
    t.same(BR.attackOptions(b, 'p1', at(10, 8), reach['10,8'].path, null), [{ targetId: 'e1', kind: 'melee', charge: true }]);
    var pv = BR.previewAttack(b, 'p1', at(10, 8), reach['10,8'].path, 'e1', null);
    t.same(pv.mods, [{ label: 'Charge', value: 2 }]);
    t.equal(pv.needs, 13 - 4 - 2);
    t.ok(BR.attackOptions(b, 'p1', at(10, 8), [at(10, 10), at(10, 9), at(10, 8)], null)[0].charge, 'a path given without its starting square');
  });

  test('no Charge: a bent path, one step, difficult ground, Shaken, engaged at the start, or a Holding or Braced target', function (t) {
    var b = fight(make([U('p1', 'light_cav')], [U('e1', 'line'), U('e2', 'line', { variant: { id: 'farmer_pikes', name: 'Farmer Pikes', trait: 'braced' } })]), { p1: [10, 11], e1: [10, 7], e2: [15, 7] });
    var straight = [at(10, 11), at(10, 10), at(10, 9), at(10, 8)];
    function charge(path, terrain, target) {
      var o = BR.attackOptions(b, 'p1', path[path.length - 1], path, terrain || null).filter(function (x) { return x.targetId === (target || 'e1'); })[0];
      return o ? o.charge : null;
    }
    t.equal(charge(straight), true);
    t.equal(charge([at(10, 11), at(9, 10), at(9, 9), at(10, 8)]), false, 'bent');
    BR.unitById(b, 'p1').pos = at(10, 9);
    t.equal(charge([at(10, 9), at(10, 8)]), false, 'one step');
    BR.unitById(b, 'p1').pos = at(10, 11);
    t.equal(charge(straight, paint(b, { '10,9': 'w' })), false, 'through woods');
    t.equal(charge(straight, paint(b, { '10,11': 'w' })), true, 'starting in woods is fine');
    BR.unitById(b, 'p1').status = 'shaken';
    t.equal(charge(straight), false, 'Shaken');
    BR.unitById(b, 'p1').status = 'steady';
    BR.unitById(b, 'e1').holding = true;
    t.equal(charge(straight), false, 'the target is Holding');
    BR.unitById(b, 'e1').holding = false;
    t.equal(charge([at(10, 11), at(11, 10), at(12, 9), at(13, 8), at(14, 7)], null, 'e2'), false, 'Farmer Pikes are Braced');
    BR.unitById(b, 'e2').pos = at(11, 11);
    t.equal(charge(straight), false, 'engaged when its activation began');
  });

  test('Strong Charge is +3', function (t) {
    var b = fight(make([U('p1', 'shock_cav')], [U('e1', 'line')]), { p1: [10, 11], e1: [10, 7] });
    var path = [at(10, 11), at(10, 10), at(10, 9), at(10, 8)];
    t.same(BR.previewAttack(b, 'p1', at(10, 8), path, 'e1', null).mods, [{ label: 'Strong Charge', value: 3 }]);
  });

  test('Luck counts only for your side', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { conditions: { luckMod: 1 } }), { p1: [10, 8], e1: [10, 7] });
    t.same(BR.previewAttack(b, 'p1', at(10, 8), null, 'e1', null).mods, [{ label: 'Luck', value: 1 }]);
    t.same(BR.previewAttack(b, 'e1', at(10, 7), null, 'p1', null).mods, []);
    var bad = fight(make([U('p1', 'line')], [U('e1', 'line')], { conditions: { luckMod: -1 } }), { p1: [10, 8], e1: [10, 7] });
    t.same(BR.previewAttack(bad, 'p1', at(10, 8), null, 'e1', null).mods, [{ label: 'Luck', value: -1 }]);
  });

  test('a Shaken attacker is at −2', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 8], e1: [10, 7] });
    BR.unitById(b, 'p1').status = 'shaken';
    var pv = BR.previewAttack(b, 'p1', at(10, 8), null, 'e1', null);
    t.same(pv.mods, [{ label: 'Shaken', value: -2 }]);
    t.equal(pv.modTotal, -2);
    t.equal(pv.needs, 11);
  });

  test('Surround +2: another of your units fighting the target with at least 90° between the two attackers', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')]), { p1: [10, 7], p2: [11, 6], e1: [10, 6] });
    t.same(BR.previewAttack(b, 'p1', at(10, 7), null, 'e1', null).mods, [{ label: 'Surround', value: 2 }], '90°');
    BR.unitById(b, 'p2').pos = at(11, 5);
    t.same(BR.previewAttack(b, 'p1', at(10, 7), null, 'e1', null).mods, [{ label: 'Surround', value: 2 }], '135°');
    BR.unitById(b, 'p2').pos = at(10, 5);
    t.same(BR.previewAttack(b, 'p1', at(10, 7), null, 'e1', null).mods, [{ label: 'Surround', value: 2 }], 'opposite sides');
    BR.unitById(b, 'p2').pos = at(11, 7);
    t.same(BR.previewAttack(b, 'p1', at(10, 7), null, 'e1', null).mods, [], '45° is not enough');
    BR.unitById(b, 'p2').pos = at(12, 6);
    t.same(BR.previewAttack(b, 'p1', at(10, 7), null, 'e1', null).mods, [], 'the other unit must be fighting the target');
  });

  test('Pack: +2 whenever another of your units is fighting the target, from any angle', function (t) {
    var b = fight(make([Beast('p1', 'Dire Wolf'), U('p2', 'line')], [U('e1', 'line')]), { p1: [10, 7], p2: [11, 7], e1: [10, 6] });
    t.same(BR.previewAttack(b, 'p1', at(10, 7), null, 'e1', null).mods, [{ label: 'Pack', value: 2 }]);
    BR.unitById(b, 'p2').pos = null;
    t.same(BR.previewAttack(b, 'p1', at(10, 7), null, 'e1', null).mods, [], 'alone, no bonus');
  });

  test('surrounding is never worth more than +2', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line'), U('p3', 'line'), U('p4', 'line')], [U('e1', 'line')]), { p1: [10, 7], p2: [11, 6], p3: [9, 6], p4: [10, 5], e1: [10, 6] });
    var pv = BR.previewAttack(b, 'p1', at(10, 7), null, 'e1', null);
    t.same(pv.mods, [{ label: 'Surround', value: 2 }]);
    t.equal(pv.modTotal, 2);
  });

  test('Rainstorm: ranged attacks −2, not melee, and not for Hardy units', function (t) {
    var rain = { conditions: { weather: 'cold_rain' } };
    var b = fight(make([U('p1', 'archers'), U('p2', 'archers', { traits: ['hardy'] }), U('p3', 'line')], [U('e1', 'line'), U('e2', 'line')], rain), { p1: [10, 10], p2: [8, 10], p3: [15, 8], e1: [10, 5], e2: [15, 7] });
    t.same(BR.previewAttack(b, 'p1', at(10, 10), null, 'e1', null).mods, [{ label: 'Rainstorm', value: -2 }]);
    t.same(BR.previewAttack(b, 'p2', at(8, 10), null, 'e1', null).mods, [], 'Hardy');
    t.same(BR.previewAttack(b, 'p3', at(15, 8), null, 'e2', null).mods, [], 'melee');
  });

  test('situational modifiers together stay within −4 to +4; the printed Attack isn\'t counted in that', function (t) {
    var b = fight(make([U('p1', 'shock_cav'), U('p2', 'line')], [U('e1', 'line')], { conditions: { luckMod: 1 } }), { p1: [10, 11], p2: [11, 7], e1: [10, 7] });
    var pv = BR.previewAttack(b, 'p1', at(10, 8), [at(10, 11), at(10, 10), at(10, 9), at(10, 8)], 'e1', null);
    t.same(pv.mods, [{ label: 'Luck', value: 1 }, { label: 'Strong Charge', value: 3 }, { label: 'Surround', value: 2 }]);
    t.same([pv.attack, pv.modRaw, pv.modTotal, pv.capped, pv.needs], [5, 6, 4, true, 13 - 5 - 4]);
    var low = fight(make([U('p1', 'archers')], [U('e1', 'line')], { conditions: { luckMod: -1, weather: 'cold_rain' } }), { p1: [10, 10], e1: [10, 5] });
    BR.unitById(low, 'p1').status = 'shaken';
    var pl = BR.previewAttack(low, 'p1', at(10, 10), null, 'e1', null);
    t.same([pl.attack, pl.modRaw, pl.modTotal, pl.capped], [4, -5, -4, true]);
  });

  test('Hold +2 Defence; Cover +2 Defence against ranged attacks only', function (t) {
    var b = fight(make([U('p1', 'archers'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'line')]), { p1: [10, 10], p2: [15, 8], e1: [10, 5], e2: [15, 7] });
    var terrain = paint(b, { '10,5': 'c', '15,7': 'c' });
    BR.unitById(b, 'e1').holding = true;
    BR.unitById(b, 'e2').holding = true;
    var ranged = BR.previewAttack(b, 'p1', at(10, 10), null, 'e1', terrain);
    t.equal(ranged.defence, 17);
    t.same(ranged.defenceMods, [{ label: 'Hold', value: 2 }, { label: 'Cover', value: 2 }]);
    var melee = BR.previewAttack(b, 'p2', at(15, 8), null, 'e2', terrain);
    t.equal(melee.defence, 15, 'Cover doesn\'t help in melee');
    t.same(melee.defenceMods, [{ label: 'Hold', value: 2 }]);
  });

  test('Harry\'s example: Line Infantry +4, Luck +1, d20 13 against Defence 13 makes 18, a margin of 5: 2 Cohesion', function (t) {
    var b = fight(make([U('p2', 'line')], [U('e1', 'line', { label: 'Bacca Stoneguard' })], { conditions: { luckMod: 1 } }), { p2: [10, 8], e1: [10, 7] });
    var pv = BR.previewAttack(b, 'p2', at(10, 8), null, 'e1', null);
    t.same([pv.kind, pv.attack, pv.modTotal, pv.defence, pv.needs], ['melee', 4, 1, 13, 8]);
    t.equal(BR.damageFor(13, 18, 13), 2);
    var res = act(t, b, 'p2', 'advance', { targetId: 'e1', d20: 13 });
    t.equal(res.events[0].text, 'Line Infantry 2 attacks Bacca Stoneguard: 13 + 4 + 1 = 18 vs 13 → 2 Cohesion (3 left)');
    t.same([res.events[0].calc.d20, res.events[0].calc.total, res.events[0].calc.damage], [13, 18, 2]);
    t.equal(BR.unitById(b, 'e1').cohesion, 3);
    t.same(b.log[b.log.length - 1], { round: 1, side: 'player', text: 'Line Infantry 2 attacks Bacca Stoneguard: 13 + 4 + 1 = 18 vs 13 → 2 Cohesion (3 left)', kind: 'attack' });
  });

  test('damage by margin: 0–4 → 1, 5–9 → 2, 10 or more → 3; short of Defence → 0', function (t) {
    t.equal(BR.damageFor(10, 12, 13), 0);
    t.equal(BR.damageFor(10, 13, 13), 1);
    t.equal(BR.damageFor(10, 17, 13), 1);
    t.equal(BR.damageFor(10, 18, 13), 2);
    t.equal(BR.damageFor(10, 22, 13), 2);
    t.equal(BR.damageFor(10, 23, 13), 3);
    t.equal(BR.damageFor(10, 40, 13), 3, 'never more than 3');
  });

  test('a natural 1 always misses; a natural 20 always inflicts 3', function (t) {
    t.equal(BR.damageFor(1, 30, 13), 0);
    t.equal(BR.damageFor(20, 5, 30), 3);
    var b = fight(make([U('p1', 'line')], [U('e1', 'heavy')]), { p1: [10, 8], e1: [10, 7] });
    var res = act(t, b, 'p1', 'advance', { targetId: 'e1', d20: 20 }, null, d20(20));
    t.equal(res.events[0].text, 'Line Infantry 1 attacks Heavy Infantry 1: 20 + 4 = 24 vs 15 → natural 20: 3 Cohesion (3 left)');
    var b2 = fight(make([U('p1', 'line')], [U('e1', 'levy')]), { p1: [10, 8], e1: [10, 7] });
    t.equal(act(t, b2, 'p1', 'advance', { targetId: 'e1', d20: 1 }).events[0].text, 'Line Infantry 1 attacks Levy Infantry 1: 1 + 4 = 5 vs 11 → natural 1: a miss');
  });

  /* ---------- Resolving orders ---------- */
  group('War battle: resolving orders');

  test('refused: the wrong side, a unit that has acted, an illegal square or target — and nothing changes', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')]), { p1: [10, 10], p2: [3, 10], e1: [10, 1] });
    var before = snapshot(b);
    function refused(order, pattern) {
      var res = BR.resolveOrder(b, order, null, d20(10));
      t.ok(!res.ok, JSON.stringify(order) + ' should be refused');
      if (pattern) t.ok(pattern.test(res.why), res.why);
      t.equal(snapshot(b), before, 'nothing changed');
    }
    refused({ unitId: 'e1', id: 'hold' }, /your turn/);
    refused({ unitId: 'p1', id: 'march', dest: at(10, 0) }, /can't reach/);
    refused({ unitId: 'p1', id: 'march', dest: at(10, 6), targetId: 'e1' }, /can't attack/);
    refused({ unitId: 'p1', id: 'advance', targetId: 'e1' }, /can't be attacked/);
    refused({ unitId: 'p1', id: 'advance', dest: at(10, 3) }, /can't reach/);
    refused({ unitId: 'p1', id: 'march' }, /Choose a square/);
    refused({ unitId: 'p1', id: 'hold', dest: at(10, 9) }, /doesn't move/);
    refused({ unitId: 'p1', id: 'charge' }, /six orders/);
    refused({ unitId: 'p1', id: 'rally' }, /Shaken/);
    refused({ unitId: 'p9', id: 'hold' }, /no such unit/);
    refused({ unitId: 'p1', id: 'hold', dest: 'nowhere' }, /square/);
    t.ok(!BR.resolveOrder(b, { unitId: 'p1', id: 'hold' }, null, null).ok, 'no dice');
    BR.unitById(b, 'p1').activated = true;
    before = snapshot(b);
    refused({ unitId: 'p1', id: 'hold' }, /already acted/);
  });

  test('Advance & Attack: moves, then attacks; the unit has acted, the battle has started and the turn passes', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 10], e1: [10, 7] });
    var res = act(t, b, 'p1', 'advance', { dest: at(10, 8), targetId: 'e1', d20: 10 });
    t.same(kinds(res), ['move', 'attack']);
    t.equal(res.events[0].text, 'Line Infantry 1 advances 2 squares.');
    t.same(BR.unitById(b, 'p1').pos, at(10, 8));
    t.equal(BR.unitById(b, 'e1').cohesion, 4, '10 + 4 = 14 vs 13');
    t.ok(BR.unitById(b, 'p1').activated);
    t.ok(b.started);
    t.equal(b.turnSide, 'enemy');
    t.equal(res.result, null);
  });

  test('Advance with no move and no target stands its ground', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 10], e1: [10, 1] });
    var res = act(t, b, 'p1', 'advance', { dest: at(10, 10) });
    t.same(kinds(res), ['advance']);
    t.same(BR.unitById(b, 'p1').pos, at(10, 10));
  });

  test('March moves up to twice Move and can\'t attack', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 11], e1: [10, 0] });
    var res = act(t, b, 'p1', 'march', { dest: at(10, 5) });
    t.equal(res.events[0].text, 'Line Infantry 1 marches 6 squares.');
    t.same(BR.unitById(b, 'p1').pos, at(10, 5));
  });

  test('Disengage falls back out of melee', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 8], e1: [10, 7] });
    var res = act(t, b, 'p1', 'disengage', { dest: at(10, 10) });
    t.equal(res.events[0].text, 'Line Infantry 1 disengages, falling back 2 squares.');
    t.ok(!BR.isEngaged(b, BR.unitById(b, 'p1')));
  });

  test('the first damage that leaves a unit at or below half its Cohesion: a Resolve check; failing it, the unit is Shaken', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 8], e1: [10, 7] });
    BR.unitById(b, 'e1').cohesion = 3;
    var res = act(t, b, 'p1', 'advance', { targetId: 'e1', d20: 10, moraleD20: 2 });
    t.same(kinds(res), ['attack', 'shaken']);
    t.equal(res.events[1].text, 'Line Infantry 1 is Shaken: 2 + 1 = 3 vs DC 10.');
    var e = BR.unitById(b, 'e1');
    t.same([e.cohesion, e.status, e.everHalf], [2, 'shaken', true]);
    t.ok(e.pos, 'still on the field');
  });

  test('passing the check keeps it Steady; damage that leaves more than half needs no check', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'line')]), { p1: [10, 8], p2: [3, 8], e1: [10, 7], e2: [3, 7] });
    BR.unitById(b, 'e1').cohesion = 3;
    var res = act(t, b, 'p1', 'advance', { targetId: 'e1', d20: 10, moraleD20: 15 });
    t.same(kinds(res), ['attack', 'morale']);
    t.equal(res.events[1].text, 'Line Infantry 1 holds its nerve: 15 + 1 = 16 vs DC 10.');
    t.equal(BR.unitById(b, 'e1').status, 'steady');
    b.turnSide = 'player';
    t.same(kinds(act(t, b, 'p2', 'advance', { targetId: 'e2', d20: 10 }, null, noDice)), ['attack'], '5 → 4 is above half');
  });

  test('a Shaken unit damaged again checks again; failing, it Routs and leaves the board', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 8], e1: [10, 7] });
    var e = BR.unitById(b, 'e1');
    e.cohesion = 2;
    e.status = 'shaken';
    e.everHalf = true;
    var res = act(t, b, 'p1', 'advance', { targetId: 'e1', d20: 10, moraleD20: 3 });
    t.same(kinds(res), ['attack', 'routed']);
    t.same([e.status, e.pos, e.cohesion], ['routed', null, 1]);
  });

  test('a rallied unit below half only checks again when it is damaged again (and then a failure Shakes it, not Routs it)', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 8], e1: [10, 7] }, { turn: 'enemy' });
    var e = BR.unitById(b, 'e1');
    e.cohesion = 2;
    e.status = 'shaken';
    var res = act(t, b, 'e1', 'rally', { d20: 18 });
    t.equal(res.events[0].text, 'Line Infantry 1 rallies: 18 + 1 = 19 vs DC 10. It is Steady again.');
    t.equal(e.status, 'steady');
    act(t, b, 'p1', 'hold');
    t.equal(b.round, 2);
    t.equal(e.status, 'steady', 'no new check at the round end');
    b.turnSide = 'player';
    res = act(t, b, 'p1', 'advance', { targetId: 'e1', d20: 10, moraleD20: 2 });
    t.same(kinds(res), ['attack', 'shaken']);
    t.same([e.status, e.cohesion], ['shaken', 1]);
  });

  test('losing all its Cohesion: Defeated at once, with no check, and off the board', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line'), U('e2', 'line')]), { p1: [10, 8], e1: [10, 7], e2: [0, 0] });
    BR.unitById(b, 'e1').cohesion = 1;
    var res = act(t, b, 'p1', 'advance', { targetId: 'e1', d20: 10 }, null, noDice);
    t.same(kinds(res), ['attack', 'defeated']);
    var e = BR.unitById(b, 'e1');
    t.same([e.status, e.pos, e.cohesion], ['defeated', null, 0]);
  });

  test('Terror: −2 on the Resolve check that follows its damage', function (t) {
    var b = fight(make([Beast('p1', 'Owlbear')], [U('e1', 'line')]), { p1: [10, 8], e1: [10, 7] });
    BR.unitById(b, 'e1').cohesion = 3;
    var res = act(t, b, 'p1', 'advance', { targetId: 'e1', d20: 10, moraleD20: 12 });
    t.same(res.events[1].calc.mods, [{ label: 'Resolve', value: 1 }, { label: 'Terror', value: -2 }]);
    t.equal(res.events[1].calc.total, 11);
    t.equal(res.events[1].text, 'Line Infantry 1 holds its nerve: 12 + 1 − 2 = 11 vs DC 10.');
  });

  test('the Resolve check: Resolve, your opening Morale, the leader\'s +2, Heatwave −1 unless Hardy', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line', { traits: ['hardy'] })], [U('e1', 'line')], {
      conditions: { moraleMod: 2, weather: 'sun_heatwave' }, leaders: [{ id: 'lt-1', name: 'Lieutenant Ashe' }], captains: [{ id: 'c1', name: 'Captain Varn' }]
    }), { p1: [10, 8], p2: [3, 8], e1: [10, 7] });
    t.equal(BR.unitById(b, 'p1').leaderId, 'lt-1');
    var chk = BR.resolveCheck(b, BR.unitById(b, 'p1'), noDice, 0, 10);
    t.same(chk.mods, [{ label: 'Resolve', value: 1 }, { label: 'Morale', value: 2 }, { label: 'Lieutenant Ashe', value: 2 }, { label: 'Heatwave', value: -1 }]);
    t.same([chk.d20, chk.total, chk.dc, chk.pass], [10, 14, 10, true]);
    t.same(BR.resolveCheck(b, BR.unitById(b, 'p2'), noDice, 0, 5).mods, [{ label: 'Resolve', value: 1 }, { label: 'Morale', value: 2 }], 'Hardy, and no leader');
    t.same(BR.resolveCheck(b, BR.unitById(b, 'e1'), noDice, -2, 5).mods, [{ label: 'Resolve', value: 1 }, { label: 'Captain Varn', value: 2 }, { label: 'Heatwave', value: -1 }, { label: 'Terror', value: -2 }], 'Morale is yours only');
    t.equal(BR.resolveCheck(b, BR.unitById(b, 'p2'), d20(6), 0).d20, 6, 'rolled when not typed');
    var steady = make([], [U('e1', 'heavy', { variant: { id: 'bacca_stoneguard', name: 'Bacca Stoneguard', trait: 'steady' } })]);
    t.same(BR.resolveCheck(steady, BR.unitById(steady, 'e1'), noDice, 0, 5).mods, [{ label: 'Resolve', value: 3 }], 'Steady\'s +1 is in the profile, not added again');
  });

  test('Grapple: a unit it damages in melee is held fast until its next activation', function (t) {
    var b = fight(make([Beast('p1', 'Constrictor Snake')], [U('e1', 'line')]), { p1: [10, 8], e1: [10, 7] });
    var res = act(t, b, 'p1', 'advance', { targetId: 'e1', d20: 12 });
    t.same(kinds(res), ['attack', 'grapple']);
    var e = BR.unitById(b, 'e1');
    t.ok(e.heldFast);
    t.ok(/held fast/.test(why(b, 'e1', 'disengage').why));
    act(t, b, 'e1', 'hold');
    t.ok(!e.heldFast, 'free again after its activation');
    var miss = fight(make([Beast('p1', 'Constrictor Snake')], [U('e1', 'line')]), { p1: [10, 8], e1: [10, 7] });
    act(t, miss, 'p1', 'advance', { targetId: 'e1', d20: 2 });
    t.ok(!BR.unitById(miss, 'e1').heldFast, 'only when it does damage');
  });

  test('Hold: +2 Defence and no Charge against it until the unit\'s next activation', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'light_cav')]), { p1: [10, 8], e1: [10, 4] });
    var res = act(t, b, 'p1', 'hold');
    t.equal(res.events[0].text, 'Line Infantry 1 holds: +2 Defence until its next activation, and no Charge bonus against it.');
    var p = BR.unitById(b, 'p1');
    t.ok(p.holding);
    var path = [at(10, 4), at(10, 5), at(10, 6), at(10, 7)];
    var pv = BR.previewAttack(b, 'e1', at(10, 7), path, 'p1', null);
    t.same([pv.defence, pv.charge], [15, false]);
    act(t, b, 'e1', 'hold');
    t.equal(b.round, 2);
    t.ok(p.holding, 'it lasts over the round end');
    act(t, b, 'p1', 'advance', { dest: at(10, 9) });
    t.ok(!p.holding, 'gone when it next acts');
  });

  test('Rally: a Resolve check, or the leader\'s sure Rally once a battle', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { leaders: [{ id: 'lt-1', name: 'Lieutenant Ashe' }] }), { p1: [10, 10], e1: [10, 1] });
    var p = BR.unitById(b, 'p1');
    p.status = 'shaken';
    var res = act(t, b, 'p1', 'rally', { useLeaderRally: true }, null, noDice);
    t.equal(res.events[0].text, 'Lieutenant Ashe rallies Line Infantry 1: no roll needed (once a battle). It is Steady again.');
    t.equal(p.status, 'steady');
    t.equal(BR.leaderById(b, 'lt-1').autoRallyLeft, 0);
    act(t, b, 'e1', 'hold');
    p.status = 'shaken';
    b.turnSide = 'player';
    var again = BR.resolveOrder(b, { unitId: 'p1', id: 'rally', useLeaderRally: true }, null, d20(10));
    t.ok(!again.ok && /sure Rally/.test(again.why), again.why);
    res = act(t, b, 'p1', 'rally', { d20: 4 });
    t.equal(res.events[0].text, 'Line Infantry 1 fails to rally: 4 + 1 + 2 = 7 vs DC 10. It stays Shaken.');
    t.equal(p.status, 'shaken');
  });

  test('Interact picks up a supply marker; carried to your baseline, it is extracted', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [11, 3], p2: [3, 10], e1: [20, 0] });
    var res = act(t, b, 'p1', 'interact');
    t.same(kinds(res), ['interact']);
    var p = BR.unitById(b, 'p1');
    var m = b.objective.markers[1];
    t.same([p.carrying, m.state, m.carrier], ['m2', 'carried', 'p1']);
    t.same(BR.legalOrders(b, 'p2', null).filter(function (o) { return o.id === 'interact'; })[0].ok, false);
    act(t, b, 'e1', 'hold');
    act(t, b, 'p2', 'hold');
    t.equal(b.round, 2);
    b.turnSide = 'player';
    act(t, b, 'p1', 'march', { dest: at(11, 9) });
    t.same([m.c, m.r, m.state], [11, 9, 'carried'], 'the marker goes with it');
    act(t, b, 'e1', 'hold');
    act(t, b, 'p2', 'hold');
    b.turnSide = 'player';
    res = act(t, b, 'p1', 'advance', { dest: at(11, 11) });
    t.same(kinds(res), ['move', 'extract']);
    t.equal(res.events[1].text, 'Line Infantry 1 brings a supply marker home (1 of the 2 needed).');
    t.same([p.carrying, m.state, m.carrier, m.c, m.r, b.objective.extracted], [null, 'extracted', null, 11, 11, 1]);
  });

  test('a carrier that Routs or is Defeated drops its marker where it stood', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [11, 5], p2: [3, 10], e1: [11, 4] }, { turn: 'enemy' });
    var p = BR.unitById(b, 'p1');
    var m = b.objective.markers[1];
    p.carrying = 'm2';
    m.state = 'carried';
    m.carrier = 'p1';
    m.c = 11;
    m.r = 5;
    p.cohesion = 1;
    var res = act(t, b, 'e1', 'advance', { targetId: 'p1', d20: 12 });
    t.same(kinds(res), ['attack', 'defeated', 'drop']);
    t.same([m.state, m.carrier, m.c, m.r, p.carrying, p.pos], ['field', null, 11, 5, null, null]);
  });

  test('every event goes into the log with its round and side', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 10], e1: [10, 7] });
    var n = b.log.length;
    act(t, b, 'p1', 'advance', { dest: at(10, 8), targetId: 'e1', d20: 15 });
    t.same(b.log.slice(n).map(function (l) { return [l.round, l.side, l.kind]; }), [[1, 'player', 'move'], [1, 'player', 'attack']]);
    t.equal(b.log[n + 1].text, 'Line Infantry 1 attacks Line Infantry 1: 15 + 4 = 19 vs 13 → 2 Cohesion (3 left)');
  });

  test('a morale check is filed under the side of the unit taking it, with its Resolve shown even at +0', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'levy')]), { p1: [10, 8], e1: [10, 7] });
    BR.unitById(b, 'e1').cohesion = 3;
    var res = act(t, b, 'p1', 'advance', { targetId: 'e1', d20: 10, moraleD20: 4 });
    t.same(res.events.map(function (e) { return e.side; }), ['player', 'enemy']);
    t.same(b.log.slice(-2).map(function (l) { return l.side; }), ['player', 'enemy']);
    t.equal(res.events[1].text, 'Levy Infantry 1 is Shaken: 4 + 0 = 4 vs DC 10.');
  });

  /* ---------- Turns and rounds ---------- */
  group('War battle: turns and rounds');

  test('the two sides take turns, one activation each', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'line')]), { p1: [2, 10], p2: [18, 10], e1: [2, 1], e2: [18, 1] });
    var seen = [];
    ['p1', 'e1', 'p2', 'e2'].forEach(function (id) {
      seen.push(b.turnSide);
      act(t, b, id, 'hold');
    });
    t.same(seen, ['player', 'enemy', 'player', 'enemy']);
    t.equal(b.round, 2);
  });

  test('a side with no one left to act lets the other carry on', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line'), U('p3', 'line')], [U('e1', 'line')]), { p1: [2, 10], p2: [10, 10], p3: [18, 10], e1: [2, 1] });
    act(t, b, 'p1', 'hold');
    t.equal(b.turnSide, 'enemy');
    act(t, b, 'e1', 'hold');
    t.equal(b.turnSide, 'player');
    act(t, b, 'p2', 'hold');
    t.equal(b.turnSide, 'player', 'the enemy has no one left this round');
    act(t, b, 'p3', 'hold');
    t.equal(b.round, 2);
  });

  test('the round ends when nobody can act: activations reset and the other side goes first', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [2, 10], e1: [2, 1] });
    t.equal(b.firstSide, 'enemy');
    act(t, b, 'p1', 'hold');
    act(t, b, 'e1', 'hold');
    t.same([b.round, b.firstSide, b.turnSide], [2, 'player', 'player']);
    t.ok(b.units.every(function (u) { return !u.activated; }));
    t.ok(b.log.some(function (l) { return l.text === 'Round 1 ends.'; }));
    t.equal(b.log[b.log.length - 1].text, 'Round 2 begins: your forces act first.');
    act(t, b, 'p1', 'hold');
    act(t, b, 'e1', 'hold');
    t.same([b.round, b.firstSide, b.turnSide], [3, 'enemy', 'enemy']);
  });

  test('the log keeps the newest 300 lines', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [2, 10], e1: [2, 1] });
    for (var i = 0; i < 299; i++) b.log.push({ round: 1, side: null, text: 'old ' + i, kind: 'note' });
    act(t, b, 'p1', 'hold');
    t.equal(b.log.length, 300);
    t.equal(b.log[b.log.length - 1].kind, 'hold');
    t.ok(!b.log.some(function (l) { return l.text === 'Battle begins. Round 1: the enemy acts first.'; }), 'the oldest went first');
  });

  test('if nobody on either side can act, the rounds run out to a result', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')]);
    BR.beginDeployment(b, null);
    b.units.forEach(function (u) { u.pos = null; });
    BR.startBattle(b);
    t.same([b.phase, b.result.round, b.result.outcome], ['over', 6, 'draw']);
  });

  test('the battle ends after round 6', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [2, 10], e1: [2, 1] });
    for (var i = 0; i < 10 && b.phase === 'battle'; i++) holdRound(t, b);
    t.equal(b.phase, 'over');
    t.same([b.round, b.result.round, b.result.outcome], [6, 6, 'draw']);
    t.ok(b.log.some(function (l) { return l.text === 'Round 6 ends.'; }));
    t.ok(!b.log.some(function (l) { return /Round 7/.test(l.text); }));
    t.ok(!BR.resolveOrder(b, { unitId: 'p1', id: 'hold' }, null, d20(10)).ok, 'nothing more can be ordered');
  });

  /* ---------- Objectives and results ---------- */
  group('War battle: objectives and results');

  test('raid: the second supply marker home is an immediate victory', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [4, 10], e1: [20, 0] });
    b.objective.extracted = 1;
    b.objective.markers[0].state = 'extracted';
    var m = b.objective.markers[1];
    m.state = 'carried';
    m.carrier = 'p1';
    BR.unitById(b, 'p1').carrying = 'm2';
    var res = act(t, b, 'p1', 'advance', { dest: at(4, 11) });
    t.equal(res.result.outcome, 'victory');
    t.same([b.phase, b.result.extracted, b.result.round], ['over', 2, 1]);
    t.equal(b.result.reason, 'You brought 2 supply markers home.');
  });

  test('raid: fewer than two home by the end of round 6 is a defeat', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [4, 10], e1: [20, 0] });
    b.objective.extracted = 1;
    for (var i = 0; i < 10 && b.phase === 'battle'; i++) holdRound(t, b);
    t.equal(b.result.outcome, 'defeat');
    t.equal(b.result.extracted, 1);
    t.equal(b.result.reason, 'The last round ended with 1 of the 2 supply markers needed brought home.');
  });

  test('seize: a Steady unit in the outpost, with no enemy inside, at two round ends in a row wins', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' }), { p1: [10, 1], e1: [0, 4] });
    holdRound(t, b);
    t.same([b.objective.held.player, b.phase], [1, 'battle']);
    t.ok(b.log.some(function (l) { return l.text === 'Round 1 ends. You hold the outpost (1 round end in a row).'; }));
    holdRound(t, b);
    t.equal(b.result.outcome, 'victory');
    t.equal(b.result.round, 2);
    t.equal(b.result.reason, 'You held the outpost at 2 round ends in a row.');
  });

  test('seize: an interrupted hold starts counting again; Shaken units and enemies in the outpost stop control', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' }), { p1: [10, 1], e1: [0, 4] });
    holdRound(t, b);
    BR.unitById(b, 'p1').pos = at(5, 9);
    holdRound(t, b);
    t.equal(b.objective.held.player, 0);
    BR.unitById(b, 'p1').pos = at(10, 1);
    holdRound(t, b);
    t.same([b.objective.held.player, b.phase], [1, 'battle']);
    var p = BR.unitById(b, 'p1');
    var e = BR.unitById(b, 'e1');
    p.status = 'shaken';
    t.equal(BR.zoneControl(b), null, 'a Shaken unit alone doesn\'t hold it');
    p.status = 'steady';
    e.pos = at(12, 2);
    e.status = 'shaken';
    t.equal(BR.zoneControl(b), null, 'any enemy fighting unit inside contests it');
    e.pos = at(0, 4);
    t.equal(BR.zoneControl(b), 'player');
  });

  test('defend: the enemy holding your supply depot at two round ends in a row is a defeat', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'defend' }), { p1: [0, 11], e1: [10, 8] });
    holdRound(t, b);
    t.same([b.objective.held.enemy, b.phase], [1, 'battle']);
    holdRound(t, b);
    t.equal(b.result.outcome, 'defeat');
    t.equal(b.result.reason, 'The enemy held your supply depot at 2 round ends in a row.');
  });

  test('defend: otherwise victory at the end, with your army unbroken', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'defend' }), { p1: [0, 11], e1: [20, 0] });
    for (var i = 0; i < 10 && b.phase === 'battle'; i++) holdRound(t, b);
    t.equal(b.result.outcome, 'victory');
    t.equal(b.result.round, 6);
  });

  test('skirmish: at the end, the side that lost the smaller share wins; equal shares draw', function (t) {
    function ending(lostPlayer, lostEnemy) {
      var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'line'), U('e3', 'levy')]), { p1: [2, 10], p2: [6, 10], e1: [2, 1], e2: [6, 1], e3: [10, 1] });
      lostPlayer.concat(lostEnemy).forEach(function (id) { var u = BR.unitById(b, id); u.status = 'routed'; u.pos = null; });
      b.round = 6;
      BR.endRound(b);
      return b.result;
    }
    var win = ending([], ['e3']);
    t.equal(win.outcome, 'victory');
    t.same(win.lostPct, { player: 0, enemy: 23.1 });
    t.equal(ending(['p1'], ['e3']).outcome, 'defeat', '50% against 23%');
    t.equal(ending(['p1'], ['e1']).outcome, 'defeat', '50% against 38.5%');
    t.equal(ending(['p1'], ['e1', 'e3']).outcome, 'victory', '50% against 61.5%: the enemy broke');
    var even = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'line')]), { p1: [2, 10], p2: [6, 10], e1: [2, 1], e2: [6, 1] });
    ['p1', 'e1'].forEach(function (id) { var u = BR.unitById(even, id); u.status = 'defeated'; u.pos = null; });
    even.round = 6;
    BR.endRound(even);
    t.equal(even.result.outcome, 'draw');
    t.same(even.result.lostPct, { player: 50, enemy: 50 });
  });

  test('skirmish: the shares compared are the percentages the War Report shows, so 32.9% against 32.9% is a draw', function (t) {
    function half(id, type, bv) { return U(id, type, { personnel: W.archetypes[type].size / 2, profile: Object.assign({}, W.archetypes[type], { bv: bv }) }); }
    var player = [U('p1', 'heavy'), U('p2', 'line'), U('p3', 'shock_cav'), U('p4', 'light_cav'), U('p5', 'archers'), U('p6', 'levy'), half('p7', 'line', 2.5)];
    var enemy = [U('e1', 'shock_cav'), U('e2', 'line'), U('e3', 'heavy'), U('e4', 'light_cav'), U('e5', 'archers'), U('e6', 'line'), U('e7', 'levy'), half('e8', 'levy', 0.5)];
    var where = {};
    player.forEach(function (u, i) { where[u.id] = [2 + 2 * i, 10]; });
    enemy.forEach(function (u, i) { where[u.id] = [2 + 2 * i, 1]; });
    var b = fight(make(player, enemy), where);
    t.same(b.startBV, { player: 36.5, enemy: 39.5 });
    ['p1', 'p2', 'e1', 'e2'].forEach(function (id) { var u = BR.unitById(b, id); u.status = 'routed'; u.pos = null; });
    t.ok(BR.armyLoss(b, 'player').share < BR.armyLoss(b, 'enemy').share, '12 of 36.5 is a hair less than 13 of 39.5');
    var r = BR.endBattleEarly(b);
    t.equal(r.outcome, 'draw');
    t.same(r.lostPct, { player: 32.9, enemy: 32.9 });
    t.equal(r.reason, 'Both armies lost the same share of their strength. You lost 32.9% of your Battle Value; the enemy lost 32.9%.');
  });

  test('your army breaks at 60% of its starting Battle Value lost: a defeat at once', function (t) {
    var b = fight(make([U('p1', 'levy'), U('p2', 'levy'), U('p3', 'levy'), U('p4', 'levy'), U('p5', 'levy')], [U('e1', 'line')]), { p1: [2, 10], p2: [4, 10], p3: [10, 8], p4: [14, 10], p5: [18, 10], e1: [10, 7] }, { turn: 'enemy' });
    ['p1', 'p2'].forEach(function (id) { var u = BR.unitById(b, id); u.status = 'defeated'; u.pos = null; });
    t.same(BR.armyLoss(b, 'player'), { startBV: 15, lostBV: 6, pct: 40, broken: false, share: 0.4 });
    BR.unitById(b, 'p3').cohesion = 1;
    var res = act(t, b, 'e1', 'advance', { targetId: 'p3', d20: 12 });
    t.equal(res.result.outcome, 'defeat');
    t.ok(b.result.broken.player);
    t.equal(b.result.lostPct.player, 60);
    t.equal(b.result.reason, 'Your army broke: 60% of its Battle Value was Routed or Defeated, and it withdrew.');
  });

  test('breaking the enemy army wins at once, whatever the objective: what is left of it flees the field', function (t) {
    /* Harry (4 October 2026): he destroyed every enemy unit in a Seize Outpost and still lost, for not holding the outpost twice. */
    var sk = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [10, 8], e1: [10, 7] });
    BR.unitById(sk, 'e1').cohesion = 1;
    t.equal(act(t, sk, 'p1', 'advance', { targetId: 'e1', d20: 12 }).result.outcome, 'victory');
    t.ok(sk.result.broken.enemy);
    var raid = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'line'), U('e3', 'line'), U('e4', 'line'), U('e5', 'line')], { objective: 'raid' }), { p1: [10, 8], p2: [3, 10], e1: [1, 0], e2: [3, 0], e3: [10, 7], e4: [15, 1], e5: [19, 1] });
    ['e1', 'e2'].forEach(function (id) { var u = BR.unitById(raid, id); u.status = 'defeated'; u.pos = null; });
    BR.unitById(raid, 'e3').cohesion = 1;
    var res = act(t, raid, 'p1', 'advance', { targetId: 'e3', d20: 12 });
    t.equal(res.result.outcome, 'victory', 'a raid is won with no supplies carried off yet');
    t.equal(raid.objective.extracted, 0);
    t.ok(/fled the field, leaving the supplies to you\./.test(raid.result.reason), raid.result.reason);
    t.same(['e4', 'e5'].map(function (id) { var u = BR.unitById(raid, id); return [u.pos, u.withdrawn, u.status]; }), [[null, true, 'steady'], [null, true, 'steady']], 'the rest fled');
    var so = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'line')], { objective: 'seize_outpost' }), { p1: [10, 6], p2: [3, 10], e1: [10, 5], e2: [20, 0] });
    var e2 = BR.unitById(so, 'e2'); e2.status = 'defeated'; e2.pos = null;
    BR.unitById(so, 'e1').cohesion = 1;
    t.equal(act(t, so, 'p1', 'advance', { targetId: 'e1', d20: 12 }).result.outcome, 'victory', 'the outpost needn\'t be held first');
    t.equal(so.objective.held.player, 0);
    t.ok(/leaving the outpost to you\./.test(so.result.reason), so.result.reason);
    var d = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'defend' }), { p1: [10, 8], e1: [10, 7] });
    BR.unitById(d, 'e1').cohesion = 1;
    t.equal(act(t, d, 'p1', 'advance', { targetId: 'e1', d20: 12 }).result.outcome, 'victory');
    t.ok(d.result.broken.enemy);
  });

  test('your own army breaking first still loses, whatever the objective', function (t) {
    ['raid', 'seize_outpost', 'defend', 'skirmish'].forEach(function (id) {
      var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line'), U('e2', 'line')], { objective: id }), { p1: [10, 8], p2: [3, 10], e1: [10, 7], e2: [20, 0] }, { turn: 'enemy' });
      var p2 = BR.unitById(b, 'p2'); p2.status = 'defeated'; p2.pos = null;
      BR.unitById(b, 'p1').cohesion = 1;
      t.equal(act(t, b, 'e1', 'advance', { targetId: 'p1', d20: 12 }).result.outcome, 'defeat', id);
    });
  });

  test('a raid already won by two markers home stays a victory even if your army breaks', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [4, 10], e1: [20, 0] });
    b.objective.extracted = 2;
    var p = BR.unitById(b, 'p1');
    p.status = 'routed';
    p.pos = null;
    t.equal(BR.checkResult(b).outcome, 'victory');
    t.ok(b.result.broken.player);
  });

  test('armyLoss: leaders and supporting defenders count with their formation', function (t) {
    var b = fight(make([U('p1', 'line'), U('p2', 'line')], [U('e1', 'line')], { leaders: [{ id: 'lt-1' }], defenders: { count: 10, armed: true } }), { p1: [2, 10], p2: [6, 10], e1: [2, 1] });
    t.equal(BR.unitById(b, 'p1').leaderId, 'lt-1', 'p1 has the support, so it is the strongest');
    t.equal(b.startBV.player, 13, '5 + 1 support + 2 leader + 5');
    var p = BR.unitById(b, 'p1');
    p.status = 'defeated';
    p.pos = null;
    var loss = BR.armyLoss(b, 'player');
    t.same([loss.lostBV, loss.pct, loss.broken], [8, 61.5, true]);
  });

  test('Withdraw ends the battle as a withdrawal, once it is under way', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')]);
    BR.beginDeployment(b, null);
    t.equal(BR.withdraw(b), null, 'while deploying, it\'s Call off instead');
    BR.startBattle(b);
    var r = BR.withdraw(b);
    t.same([r.outcome, r.reason, b.phase], ['withdrawal', 'You withdrew from the field.', 'over']);
    t.equal(BR.withdraw(b), null, 'only once');
  });

  test('endBattleEarly plays the remaining round ends out with nobody moving', function (t) {
    var b = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'seize_outpost' }), { p1: [10, 1] });
    t.ok(BR.canEndEarly(b), 'the enemy has gone');
    var r = BR.endBattleEarly(b);
    t.same([r.outcome, r.round], ['victory', 2]);
    var raid = fight(make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid' }), { p1: [4, 10] });
    t.same([BR.endBattleEarly(raid).outcome, raid.result.round], ['defeat', 6]);
    var both = fight(make([U('p1', 'line')], [U('e1', 'line')]), { p1: [4, 10], e1: [4, 1] });
    t.ok(!BR.canEndEarly(both));
  });

  /* ---------- Stat blocks and terrain ---------- */
  group('War battle: stat blocks and terrain');

  function row(block, k) { return block.rows.filter(function (r) { return r.key === k; })[0]; }

  test('stat block: archers show "+4 ranged / +1 melee"', function (t) {
    var s = BR.statBlock('archers');
    t.equal(s.title, 'Archers');
    t.equal(row(s, 'attack').value, '+4 ranged / +1 melee');
    t.ok(/Range|reach 6/.test(row(s, 'attack').text));
    t.equal(s.distinction, 'Range 6.');
    t.same(s.rows.map(function (r) { return r.name; }), ['Cohesion', 'Attack', 'Defence', 'Move', 'Resolve', 'Battle Value']);
  });

  test('stat block: signed Attack and Resolve, and the traits with their rule text', function (t) {
    var s = BR.statBlock(W.archetypes.light_cav, W);
    t.same(s.rows.map(function (r) { return r.value; }), ['4', '+4', '12', '5', '+1', '6']);
    t.same(s.traits, [{ id: 'charge', name: 'Charge', text: W.traits.charge.text }]);
    t.equal(row(BR.statBlock('levy'), 'resolve').value, '+0');
    t.equal(BR.statBlock('shock_cav').traits[0].name, 'Strong Charge');
    t.equal(row(BR.statBlock('defenders'), 'attack').value, '+2');
  });

  test('stat block of a unit on the field: current Cohesion, support and its traits', function (t) {
    var b = make([U('p1', 'line', { variant: { id: 'farmer_pikes', name: 'Farmer Pikes', trait: 'braced' } })], [], { defenders: { count: 10, armed: true } });
    var u = BR.unitById(b, 'p1');
    u.cohesion = 5;
    var s = BR.statBlock(u);
    t.equal(s.title, 'Line Infantry 1');
    t.equal(row(s, 'cohesion').value, '5 / 7');
    t.ok(s.notes.indexOf('Supported by 10 Bastion Defenders: +2 Cohesion, +1 Battle Value.') !== -1, s.notes.join(' | '));
    t.equal(row(s, 'bv').value, '6', 'its Battle Value counts the support, as the army\'s total does');
    t.same(s.traits.map(function (x) { return x.name; }), ['Braced']);
    t.equal(s.distinction, W.archetypes.line.distinction);
    var bv = make([U('p1', 'line')], [], { defenders: { count: 100, armed: false } });
    t.ok(BR.statBlock(BR.unitById(bv, 'def-1')).notes[0].indexOf('unarmed') !== -1);
    t.equal(row(BR.statBlock(BR.unitById(bv, 'def-1')), 'attack').value, '+0');
  });

  test('the stat blocks\' Battle Values add up to the army\'s, support included', function (t) {
    var b = make([U('p1', 'levy'), U('p2', 'line'), U('p3', 'line'), Beast('p4', 'Owlbear')], [], { defenders: { count: 20, armed: true } });
    var levy = BR.statBlock(BR.unitById(b, 'p1'));
    t.same([row(levy, 'cohesion').value, row(levy, 'bv').value], ['6 / 6', '4'], 'Levy with +2 support');
    var sum = b.units.filter(function (u) { return u.side === 'player'; }).reduce(function (s, u) { return s + Number(row(BR.statBlock(u), 'bv').value); }, 0);
    t.equal(sum, b.startBV.player);
    t.equal(row(BR.statBlock('levy'), 'bv').value, '3', 'the profile on its own is unchanged');
  });

  test('stat blocks for beasts and Lieutenants; unknown names have none', function (t) {
    var o = BR.statBlock('Owlbear');
    t.equal(o.title, 'Owlbear');
    t.equal(row(o, 'attack').value, '+6');
    t.same(o.traits.map(function (x) { return x.id; }), ['terror']);
    t.equal(o.distinction, W.beasts.Owlbear.distinction);
    var l = BR.statBlock('lieutenant');
    t.equal(l.title, 'Lieutenant');
    t.same(l.rows.map(function (r) { return [r.key, r.value]; }), [['bv', '2']]);
    t.equal(l.distinction, W.lieutenant.text);
    t.equal(BR.statBlock('nonsense'), null);
  });

  test('terrainForGrid resamples a saved painting square by square; no painting is open ground', function (t) {
    t.same(BR.terrainForGrid({ cols: 2, rows: 2, cells: 'wx.k' }, 4, 4), { cols: 4, rows: 4, cells: 'wwxxwwxx..kk..kk' });
    t.same(BR.terrainForGrid({ cols: 4, rows: 2, cells: 'wwxx..kk' }, 2, 2), { cols: 2, rows: 2, cells: 'wx.k' });
    t.same(BR.terrainForGrid(null, 3, 2), { cols: 3, rows: 2, cells: '......' });
    t.same(BR.terrainForGrid({ cols: 2, rows: 1, cells: 'Z?' }, 2, 1).cells, '..', 'unknown codes are open ground');
    var b = make([], []);
    var fitted = BR.fitTerrain(b, { cols: 11, rows: 6, cells: 'w' + new Array(66).join('.') });
    t.same([fitted.cols, fitted.rows, fitted.cells.length], [22, 12, 264]);
    t.equal(BR.terrainAt(fitted, 1, 1).id, 'woods', 'one painted square becomes two by two');
    t.equal(BR.terrainAt(fitted, 2, 2).id, 'open');
  });

  test('terrainAt: the terrain by its code; open ground with no painting or outside it', function (t) {
    var p = { cols: 3, rows: 1, cells: '.dc' };
    t.equal(BR.terrainAt(p, 1, 0).id, 'dense');
    t.equal(BR.terrainAt(p, 2, 0).id, 'cover');
    t.equal(BR.terrainAt(p, 3, 0).id, 'open');
    t.equal(BR.terrainAt(p, 0, -1).id, 'open');
    t.equal(BR.terrainAt(null, 4, 4).id, 'open');
  });

  /* ---------- A whole battle ---------- */
  group('War battle: a whole battle');

  /* A simple, fixed way of playing both sides: attack what's in reach,
     rally when Shaken, otherwise move as near the enemy as possible. */
  function pickOrder(battle, u, terrain) {
    var here = BR.attackOptions(battle, u.id, u.pos, null, terrain);
    if (here.length) return { unitId: u.id, id: 'advance', targetId: here[0].targetId };
    if (u.status === 'shaken') return { unitId: u.id, id: 'rally' };
    var foes = BR.enemiesOf(battle, u.side);
    var reach = BR.reachable(battle, u.id, 'advance', terrain);
    var best = null;
    var bestD = Infinity;
    Object.keys(reach).forEach(function (k) {
      var p = reach[k].path[reach[k].path.length - 1];
      var d = Math.min.apply(null, foes.map(function (f) { return BR.dist(p, f.pos); }));
      if (d < bestD) { bestD = d; best = k; }
    });
    if (!best || Object.keys(reach).length < 2) return { unitId: u.id, id: 'hold' };
    var dest = reach[best].path[reach[best].path.length - 1];
    var opts = BR.attackOptions(battle, u.id, dest, reach[best].path, terrain);
    return { unitId: u.id, id: 'advance', dest: dest, targetId: opts.length ? opts[0].targetId : null };
  }
  function wholeBattle(roundTrip) {
    var rand = seeded(20261002);
    var battle = make(
      [U('p1', 'line'), U('p2', 'heavy'), U('p3', 'archers'), U('p4', 'light_cav'), Beast('p5', 'Dire Wolf')],
      [U('e1', 'line'), U('e2', 'levy'), U('e3', 'levy'), U('e4', 'archers'), U('e5', 'shock_cav')],
      { objective: 'skirmish', leaders: [{ id: 'lt-1' }], captains: [{ id: 'c1' }], conditions: { moraleMod: 2, luckMod: 1 }, board: { w: 1600, h: 900 } });
    var terrain = BR.terrainForGrid({ cols: 11, rows: 6, cells: '.....w.........c.g...r...........d..w..........b.....c.........' }, battle.cols, battle.rows);
    function trip() { if (roundTrip) battle = JSON.parse(JSON.stringify(battle)); }
    BR.beginDeployment(battle, terrain);
    trip();
    BR.startBattle(battle);
    var steps = 0;
    while (battle.phase === 'battle' && steps < 300) {
      trip();
      var u = BR.activeUnits(battle, battle.turnSide)[0];
      var res = BR.resolveOrder(battle, pickOrder(battle, u, terrain), terrain, rand);
      if (!res.ok) throw new Error('refused: ' + res.why);
      steps++;
    }
    return { battle: battle, steps: steps };
  }

  test('a scripted skirmish runs from createBattle to a result', function (t) {
    var run = wholeBattle(false);
    var b = run.battle;
    t.equal(b.phase, 'over');
    t.ok(b.result && ['victory', 'defeat', 'draw'].indexOf(b.result.outcome) !== -1, JSON.stringify(b.result));
    t.ok(run.steps > 5 && run.steps < 300, run.steps + ' activations');
    t.ok(b.log.some(function (l) { return / attacks | charges /.test(l.text); }), 'there was fighting');
    t.ok(b.log.length <= 300);
    t.ok(b.started);
  });

  test('saved and reloaded as JSON at every step, the battle plays out exactly the same', function (t) {
    var a = wholeBattle(false);
    var b = wholeBattle(true);
    t.equal(a.steps, b.steps);
    t.same(b.battle.result, a.battle.result);
    t.equal(JSON.stringify(b.battle), JSON.stringify(a.battle));
  });

  test('a scripted raid: two supply markers collected, carried home and extracted for a victory', function (t) {
    var b = make([U('p1', 'light_cav'), U('p2', 'light_cav'), U('p3', 'line')], [U('e1', 'levy')], { objective: 'raid' });
    BR.beginDeployment(b, null);
    BR.unitById(b, 'e1').pos = at(0, 0);
    BR.startBattle(b);
    var goal = { p1: 'm1', p2: 'm3' };
    var guard = 0;
    while (b.phase === 'battle' && guard++ < 100) {
      var u = BR.activeUnits(b, b.turnSide)[0];
      var order = { unitId: u.id, id: 'hold' };
      if (u.side === 'player' && goal[u.id]) {
        var reach = BR.reachable(b, u.id, 'march', null);
        var keys = Object.keys(reach);
        if (u.carrying && keys.length) {
          keys.sort(function (x, y) { return reach[y].path[reach[y].path.length - 1].r - reach[x].path[reach[x].path.length - 1].r; });
          order = { unitId: u.id, id: 'march', dest: reach[keys[0]].path[reach[keys[0]].path.length - 1] };
        } else if (!u.carrying && BR.fieldMarkerAt(b, u.pos)) {
          order = { unitId: u.id, id: 'interact' };
        } else if (!u.carrying) {
          var m = b.objective.markers.filter(function (x) { return x.id === goal[u.id]; })[0];
          var near = keys.map(function (k) { return reach[k].path[reach[k].path.length - 1]; }).sort(function (x, y) { return BR.dist(x, m) - BR.dist(y, m); })[0];
          if (near) order = { unitId: u.id, id: 'march', dest: near };
        }
      }
      var res = BR.resolveOrder(b, order, null, d20(10));
      t.ok(res.ok, JSON.stringify(order) + ': ' + res.why);
    }
    t.equal(b.result.outcome, 'victory');
    t.equal(b.result.extracted, 2);
    t.same(b.objective.markers.map(function (m) { return m.state; }), ['extracted', 'field', 'extracted']);
    t.ok(b.result.round <= 4, 'round ' + b.result.round);
  });

  test('the battle is plain data at every phase', function (t) {
    var b = make([U('p1', 'line')], [U('e1', 'line')], { objective: 'raid', leaders: [{ id: 'lt-1' }] });
    [function () {}, function () { BR.beginDeployment(b, null); }, function () { BR.startBattle(b); }, function () { BR.withdraw(b); }].forEach(function (step, i) {
      step();
      t.equal(JSON.stringify(JSON.parse(JSON.stringify(b))), JSON.stringify(b), 'step ' + i);
    });
  });
}());
