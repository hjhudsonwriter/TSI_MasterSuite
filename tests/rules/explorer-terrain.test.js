/* Scarlett Isles Explorer: terrain painted on the hexes (29 October 2026). */
(function () {
  var R = TSI.explorer.rules;
  var D = window.TSI_DATA.explorer;
  function dice(list) { var i = 0; return function () { var v = list[i % list.length]; i++; return v; }; }

  /* A map with the hex size locked, the party on hex (10, 6), nothing painted. */
  function mapState() {
    var s = R.defaultState(D);
    R.loadPreset(s, D, 'midland_province');
    s.grid.locked = true; R.rememberGrid(s);
    var b = R.board(4 / 3);
    s.tokens.forEach(function (t) { var p = R.axialToPixel(s.grid, 10, 6); R.place(b, t, p.x, p.y); });
    return { s: s, b: b };
  }
  function plan(m, dq, dr, snap, rand) {
    m.s.snap.enabled = !!snap;
    if (!m.keepEvent) m.s.travel.travelEventDay = m.s.travel.day;
    var d = R.startDrag(m.s, m.b, m.s.tokens.map(function (t) { return t.id; }), m.s.tokens[0].id);
    var p = R.axialToPixel(m.s.grid, 10 + dq, 6 + dr);
    return R.walkPlan(m.s, m.b, d, p, rand || dice([0.99]));
  }

  test('the terrain list: Harry\'s kinds, costs and two that cannot be crossed', function (t) {
    var cost = {};
    R.terrainKinds().forEach(function (k) { cost[k.id] = k.cost; });
    t.same(cost, { road: 0.5, forest: 2, hills: 2, marsh: 3, mountain_trails: 2, mountain_climb: 3, mountains: null, water: null });
  });

  test('painting needs a map and a locked hex size; open land wipes a hex', function (t) {
    var s = R.defaultState(D);
    t.equal(R.paintHexes(s, [{ q: 1, r: 1 }], 'forest'), 0, 'no map, no painting');
    R.loadPreset(s, D, 'midland_province');
    t.equal(R.paintHexes(s, [{ q: 1, r: 1 }], 'forest'), 0, 'unlocked grid, no painting');
    s.grid.locked = true;
    t.equal(R.paintHexes(s, [{ q: 1, r: 1 }, { q: 2, r: 1 }], 'forest'), 2);
    t.equal(R.paintHexes(s, [{ q: 1, r: 1 }], 'forest'), 0, 'same again changes nothing');
    t.equal(R.paintHexes(s, [{ q: 1, r: 1 }], 'sparkles'), 0, 'unknown kind refused');
    t.equal(R.terrainAt(s, 1, 1), 'forest');
    t.equal(R.paintHexes(s, [{ q: 1, r: 1 }], 'open'), 1);
    t.equal(R.terrainAt(s, 1, 1), 'open');
    t.equal(R.terrainCount(s), 1);
    R.clearTerrain(s);
    t.equal(R.terrainCount(s), 0);
  });

  test('each map has its own painting, and it survives a save', function (t) {
    var m = mapState();
    R.paintHexes(m.s, [{ q: 3, r: 3 }], 'marsh');
    R.loadPreset(m.s, D, 'the_east_isle');
    t.equal(R.terrainAt(m.s, 3, 3), 'open', 'another map is untouched');
    R.loadPreset(m.s, D, 'midland_province');
    t.equal(R.terrainAt(m.s, 3, 3), 'marsh');
    var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(m.s))), D);
    t.equal(R.terrainAt(back, 3, 3), 'marsh');
    var bad = JSON.parse(JSON.stringify(R.toSave(m.s)));
    bad.terrainByMap = { 'preset:midland_province': { '3,3': 'marsh', 'x,y': 'forest', '4,4': 7, '5,5': 'open' }, junk: { '1,1': 'forest' } };
    var s2 = R.fromSave(bad, D);
    t.equal(R.terrainCount(s2), 1, 'only the good hex is kept');
  });

  test('what a hex costs: 6 open, half on a road, double in forest, triple in marsh, nothing for mountains', function (t) {
    var m = mapState();
    R.paintHexes(m.s, [{ q: 1, r: 0 }], 'road'); R.paintHexes(m.s, [{ q: 2, r: 0 }], 'forest');
    R.paintHexes(m.s, [{ q: 3, r: 0 }], 'marsh'); R.paintHexes(m.s, [{ q: 4, r: 0 }], 'mountains');
    t.equal(R.hexMiles(m.s, 0, 0), 6);
    t.equal(R.hexMiles(m.s, 1, 0), 3);
    t.equal(R.hexMiles(m.s, 2, 0), 12);
    t.equal(R.hexMiles(m.s, 3, 0), 18);
    t.equal(R.hexMiles(m.s, 4, 0), Infinity);
  });

  test('a walk across forest costs double, across a road half; with nothing painted it is the old 6 a hex', function (t) {
    var m = mapState();
    var p0 = plan(m, 3, 0, true);
    t.ok(p0.ok); t.equal(p0.miles, 18);
    R.paintHexes(m.s, [{ q: 11, r: 6 }, { q: 12, r: 6 }], 'forest');
    var p1 = plan(m, 3, 0, true);
    t.equal(p1.miles, 12 + 12 + 6);
    R.paintHexes(m.s, [{ q: 11, r: 6 }, { q: 12, r: 6 }, { q: 13, r: 6 }], 'road');
    t.equal(plan(m, 3, 0, true).miles, 9);
  });

  test('impassable ground in the way stops the walk before anyone moves; Free Move ignores it', function (t) {
    var m = mapState();
    R.paintHexes(m.s, [{ q: 12, r: 6 }], 'water');
    var p = plan(m, 3, 0, true);
    t.equal(p.ok, false); t.equal(p.reason, 'blocked'); t.equal(p.at.kind, 'water');
    t.equal(plan(m, 1, 0, true).ok, true, 'before the water is fine');
    m.s.freeMove = true;
    t.equal(plan(m, 3, 0, true).ok, true, 'Free Move crosses anything, at 6 a hex');
    t.equal(plan(m, 3, 0, true).miles, 18);
  });

  test('the day\'s limit counts the terrain: 30 miles of marsh is only 10 hexes of road... and 1 hex of mountain climb is 18', function (t) {
    var m = mapState();
    R.paintHexes(m.s, [{ q: 11, r: 6 }, { q: 12, r: 6 }], 'mountain_climb');
    t.equal(plan(m, 1, 0, true).miles, 18);
    t.equal(plan(m, 2, 0, true).ok, false, '36 miles is over the limit');
    t.equal(plan(m, 2, 0, true).reason, 'tooFar');
  });

  test('a dragged move is charged the terrain too, and refused over impassable ground', function (t) {
    var m = mapState();
    R.paintHexes(m.s, [{ q: 11, r: 6 }], 'hills');
    m.s.snap.enabled = true;
    var d = R.startDrag(m.s, m.b, m.s.tokens.map(function (t2) { return t2.id; }), m.s.tokens[0].id);
    R.snapTo(m.s, m.b, d, { q: 12, r: 6 });
    var res = R.finishMove(m.s, D, null, d, m.b, dice([0.99]));
    t.equal(res.result, 'moved'); t.equal(res.miles, 18);
    t.equal(m.s.tokens[0].milesUsed, 18);
    var m2 = mapState();
    R.paintHexes(m2.s, [{ q: 11, r: 6 }], 'mountains');
    m2.s.snap.enabled = true;
    var d2 = R.startDrag(m2.s, m2.b, m2.s.tokens.map(function (t2) { return t2.id; }), m2.s.tokens[0].id);
    R.snapTo(m2.s, m2.b, d2, { q: 12, r: 6 });
    var r2 = R.finishMove(m2.s, D, null, d2, m2.b, dice([0.99]));
    t.equal(r2.result, 'blocked');
    t.equal(m2.s.tokens[0].milesUsed, 0, 'nothing charged');
  });

  test('the travel event falls on the hex where the cost adds up to it', function (t) {
    var m = mapState();
    R.paintHexes(m.s, [{ q: 11, r: 6 }, { q: 12, r: 6 }], 'forest');
    m.s.travel.nextTravelEventAtMiles = 20;
    m.keepEvent = true; m.s.travel.travelEventDay = 0;
    var p = plan(m, 3, 0, true);
    t.equal(p.cutAt, 2, '12 + 12 = 24 reaches 20 on the second hex');
    t.equal(p.miles, 24);
  });

  test('the reach follows the costs: forest shrinks it, a road stretches it, water and mountains cut it', function (t) {
    var m = mapState();
    var ids = m.s.tokens.map(function (x) { return x.id; });
    var plain = R.reachFor(m.s, m.b, ids, ids[0]);
    t.equal(plain.n, 5); t.ok(!plain.cells, 'no terrain: the plain circle, as before');
    R.paintHexes(m.s, [{ q: 11, r: 6 }], 'forest');
    var r1 = R.reachFor(m.s, m.b, ids, ids[0]);
    function has(r, q, rr) { return r.cells.some(function (c) { return c.q === q && c.r === rr; }); }
    t.ok(has(r1, 11, 6), 'the forest hex itself: 12 miles, within 30');
    t.ok(!has(r1, 15, 6), 'five hexes through forest would be 12 + 24 = 36');
    t.ok(has(r1, 14, 6), '12 + 18 = 30');
    R.paintHexes(m.s, [{ q: 11, r: 6 }, { q: 12, r: 6 }, { q: 13, r: 6 }, { q: 14, r: 6 }, { q: 15, r: 6 }, { q: 16, r: 6 }], 'road');
    var r2 = R.reachFor(m.s, m.b, ids, ids[0]);
    t.ok(has(r2, 16, 6), 'six road hexes are 18 miles');
    t.ok(has(r2, 18, 6), 'two open hexes after the road: 18 + 12 = 30');
    t.ok(!has(r2, 19, 6), 'one more would be 36');
    R.paintHexes(m.s, [{ q: 12, r: 6 }], 'water');
    var r3 = R.reachFor(m.s, m.b, ids, ids[0]);
    t.ok(!has(r3, 12, 6) && !has(r3, 13, 6), 'nothing at or behind the water along that line');
  });

  test('the reach target says blocked, too far, or the miles', function (t) {
    var m = mapState();
    var ids = m.s.tokens.map(function (x) { return x.id; });
    R.paintHexes(m.s, [{ q: 11, r: 6 }], 'forest'); R.paintHexes(m.s, [{ q: 10, r: 7 }], 'mountains');
    var reach = R.reachFor(m.s, m.b, ids, ids[0]);
    var a = R.reachTarget(reach, { q: 11, r: 6 }, m.s);
    t.equal(a.inReach, true); t.equal(a.miles, 12);
    var b = R.reachTarget(reach, { q: 10, r: 7 }, m.s);
    t.equal(b.inReach, false); t.equal(b.blocked, true);
    var c = R.reachTarget(reach, { q: 18, r: 6 }, m.s);
    t.equal(c.inReach, false); t.equal(c.blocked, false);
  });
}());
