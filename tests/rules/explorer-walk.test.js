/* Scarlett Isles Explorer: click to move, the party walks (tools/explorer/rules.js, R.walkPlan and friends; 29 October 2026). */
(function () {
  var R = TSI.explorer.rules;
  var D = window.TSI_DATA.explorer;
  var E = window.TSI_DATA.journeyEvents;

  function dice(list) { var i = 0; return function () { var v = list[i % list.length]; i++; return v; }; }
  function board43() { return R.board(4 / 3); }
  function putOnHex(s, board, id, q, r) { var p = R.axialToPixel(s.grid, q, r); R.place(board, R.token(s, id), p.x, p.y); }
  /* A fresh state with every hero on hex (0,0)+k so they sit in the middle of the board. */
  function party() {
    var s = R.defaultState(D);
    var b = board43();
    s.tokens.forEach(function (t, i) { putOnHex(s, b, t.id, 10, 6); });
    return { s: s, b: b };
  }
  function centreOf(s, b, q, r) { return R.axialToPixel(s.grid, q, r); }
  function plan(p, qr, rand) {
    var id = p.s.tokens[0].id;
    var drag = R.startDrag(p.s, p.b, [id], id);
    var d = centreOf(p.s, p.b, qr[0], qr[1]);
    return { drag: drag, plan: R.walkPlan(p.s, p.b, drag, d, rand || dice([0.99])) };
  }

  group('Explorer: click to move, the walk');

  test('a straight line of hexes has the start, the end, and one step between each', function (t) {
    var a = { q: 2, r: 3 }, b = { q: 8, r: -1 };
    var line = R.hexLine(a, b);
    t.equal(line.length, R.hexDistance(a, b) + 1);
    t.same(line[0], a);
    t.same(line[line.length - 1], b);
    for (var i = 1; i < line.length; i++) t.equal(R.hexDistance(line[i - 1], line[i]), 1, 'step ' + i + ' is next door');
    t.same(R.hexLine(a, a), [a]);
  });

  test('walking to your own hex is nothing', function (t) {
    var p = party();
    t.equal(plan(p, [10, 6]).plan.reason, 'here');
  });

  test('a walk costs 6 miles a hex, like a drag, and goes hex by hex when snapped', function (t) {
    var p = party();
    p.s.snap.enabled = true;
    p.s.travel.travelEventDay = p.s.travel.day; /* today's roll already made: no event in the way */
    var r = plan(p, [13, 6]);
    t.ok(r.plan.ok);
    t.equal(r.plan.hexes, 3);
    t.equal(r.plan.miles, 18);
    t.equal(r.plan.cutAt, null);
    t.equal(r.plan.path.length, 4, 'the start and three hexes');
    t.same(r.plan.endAx, { q: 13, r: 6 });
    var c = R.axialToPixel(p.s.grid, 13, 6);
    t.ok(Math.abs(r.plan.end.x - c.x) < 0.001 && Math.abs(r.plan.end.y - c.y) < 0.001, 'ends in the middle of the hex');
  });

  test('unsnapped, the walk is one straight line to the point clicked', function (t) {
    var p = party();
    p.s.snap.enabled = false;
    p.s.travel.travelEventDay = p.s.travel.day;
    var d = { x: R.axialToPixel(p.s.grid, 12, 6).x + 5, y: R.axialToPixel(p.s.grid, 12, 6).y - 4 };
    var id = p.s.tokens[0].id;
    var drag = R.startDrag(p.s, p.b, [id], id);
    var pl = R.walkPlan(p.s, p.b, drag, d, dice([0.99]));
    t.ok(pl.ok);
    t.equal(pl.path.length, 2);
    t.same(pl.end, d);
    t.equal(pl.hexes, 2);
  });

  test('beyond the day\'s limit is refused before anyone moves, for the most-travelled hero', function (t) {
    var p = party();
    p.s.travel.travelEventDay = p.s.travel.day;
    p.s.tokens[1].milesUsed = 24;
    var ids = [p.s.tokens[0].id, p.s.tokens[1].id];
    var drag = R.startDrag(p.s, p.b, ids, ids[0]);
    var ok = R.walkPlan(p.s, p.b, drag, centreOf(p.s, p.b, 11, 6), dice([0.99]));
    t.ok(ok.ok, 'one hex is 24 + 6 = 30: just inside');
    var far = R.walkPlan(p.s, p.b, drag, centreOf(p.s, p.b, 12, 6), dice([0.99]));
    t.equal(far.ok, false);
    t.equal(far.reason, 'tooFar');
    t.equal(far.miles, 12);
    t.equal(p.s.tokens[1].milesUsed, 24, 'planning charges nothing');
  });

  test('Free Move walks anywhere without a limit or an event', function (t) {
    var p = party();
    p.s.freeMove = true;
    var r = plan(p, [20, 6]);
    t.ok(r.plan.ok);
    t.equal(r.plan.cutAt, null);
    t.equal(R.token(p.s, p.s.tokens[0].id).milesUsed || 0, 0);
  });

  test('a hero who has used the day cannot walk', function (t) {
    var p = party();
    p.s.tokens[0].milesUsed = R.dayLimit(p.s);
    t.equal(plan(p, [11, 6]).plan.reason, 'tired');
  });

  test('where today\'s travel roll would be made part-way, the walk stops at that hex', function (t) {
    var p = party();
    p.s.snap.enabled = true;
    p.s.travel.nextTravelEventAtMiles = 12;   /* the party's 12th mile */
    var r = plan(p, [16, 6]);                  /* six hexes: 36 miles would be too far; use a shorter one */
    t.equal(r.plan.ok, false);
    var r2 = plan(p, [14, 6]);                 /* four hexes: 24 miles, the roll falls on hex 2 */
    t.ok(r2.plan.ok);
    t.equal(r2.plan.cutAt, 2);
    t.equal(r2.plan.hexes, 2);
    t.equal(r2.plan.miles, 12);
    t.same(r2.plan.endAx, { q: 12, r: 6 });
    t.equal(r2.plan.path.length, 3);
  });

  test('the cut walk, ended where it stops, makes the day\'s roll exactly as a drag to that hex would', function (t) {
    var p = party();
    p.s.snap.enabled = true;
    p.s.travel.nextTravelEventAtMiles = 12;
    var id = p.s.tokens[0].id;
    var drag = R.startDrag(p.s, p.b, [id], id);
    var pl = R.walkPlan(p.s, p.b, drag, centreOf(p.s, p.b, 14, 6), dice([0.99]));
    R.snapTo(p.s, p.b, drag, pl.endAx);
    var res = R.finishMove(p.s, D, E, drag, p.b, dice([0.99]));
    t.equal(res.result, 'moved');
    t.equal(res.miles, 12);
    t.equal(p.s.travel.travelEventDay, p.s.travel.day, 'the day\'s roll was made at the hex where the walk stopped');
    t.equal(R.token(p.s, id).milesUsed, 12);
  });

  test('no cut when today\'s roll is already made, or an event is open', function (t) {
    var p = party();
    p.s.snap.enabled = true;
    p.s.travel.nextTravelEventAtMiles = 12;
    p.s.travel.travelEventDay = p.s.travel.day;
    t.equal(plan(p, [14, 6]).plan.cutAt, null);
    var q = party();
    q.s.snap.enabled = true;
    q.s.travel.nextTravelEventAtMiles = 12;
    q.s.journey.current = { id: 'x' };
    t.equal(plan(q, [14, 6]).plan.cutAt, null);
  });

  test('unsnapped, a cut walk stops at the first point that is far enough along the line', function (t) {
    var p = party();
    p.s.snap.enabled = false;
    p.s.travel.nextTravelEventAtMiles = 12;
    var id = p.s.tokens[0].id;
    var drag = R.startDrag(p.s, p.b, [id], id);
    var dest = centreOf(p.s, p.b, 14, 6);
    var pl = R.walkPlan(p.s, p.b, drag, dest, dice([0.99]));
    t.equal(pl.cutAt, 2);
    t.equal(R.hexDistance(drag.startAxial, R.hexAt(p.s.grid, pl.end.x, pl.end.y)), 2);
    t.ok(pl.end.x < dest.x, 'short of the destination');
    t.equal(pl.path.length, 2);
  });

  test('a walker moves along its path at the distance asked and is done at the end', function (t) {
    var path = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }];
    t.equal(R.pathLength(path), 150);
    var mid = R.pointAlong(path, 100);
    t.ok(mid.x === 100 && mid.y === 0 && !mid.done || (mid.x === 100 && mid.y === 0));
    var later = R.pointAlong(path, 125);
    t.ok(Math.abs(later.x - 100) < 1e-9 && Math.abs(later.y - 25) < 1e-9 && !later.done);
    t.ok(R.pointAlong(path, 999).done);
    t.equal(R.pointAlong(path, 999).y, 50);
    t.equal(R.WALK_MS_PER_HEX, 260);
  });

  test('snapTo puts every dragged hero the same number of hexes along as the one grabbed', function (t) {
    var p = party();
    p.s.snap.enabled = true;
    var a = p.s.tokens[0].id, c = p.s.tokens[2].id;
    putOnHex(p.s, p.b, c, 11, 6);
    var drag = R.startDrag(p.s, p.b, [a, c], a);
    R.snapTo(p.s, p.b, drag, { q: 13, r: 7 });
    t.same(R.tokenHex(p.s, p.b, R.token(p.s, a)), { q: 13, r: 7 });
    t.same(R.tokenHex(p.s, p.b, R.token(p.s, c)), { q: 14, r: 7 });
  });
}());
