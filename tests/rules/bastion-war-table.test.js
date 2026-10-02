/* The Ironbow Bastion Manager's War Table: tools/bastion/war-table-rules.js */
(function () {
  var W = TSI.bastion.warTableRules;

  function grid(extra) { return Object.assign({ show: true, size: 70, snap: false, offX: 0, offY: 0 }, extra || {}); }
  function forces(counts) {
    var list = [];
    function add(kind, n, extra) {
      for (var i = 1; i <= n; i++) list.push(Object.assign({ id: kind + '-' + i, kind: kind, label: kind + ' ' + i }, extra || {}));
    }
    add('regiment', counts.regiment || 0, { sub: '100 soldiers' });
    add('lieutenant', counts.lieutenant || 0);
    add('beast', counts.beast || 0);
    if (counts.defenders) list.push({ id: 'def', kind: 'defenders', label: 'Bastion Defenders', count: counts.defenders });
    return list;
  }
  /* Every token whole on the board and on or below the midline. */
  function allOnOurGround(t, positions, list, board, g, scale, what) {
    list.forEach(function (f) {
      var p = positions[f.id];
      t.ok(p, what + ': ' + f.id + ' has a place');
      var d = W.tokenDims(f, g, scale);
      var cx = p.x * board.w;
      var cy = p.y * board.h;
      t.ok(cx - d.w / 2 >= -1e-6 && cx + d.w / 2 <= board.w + 1e-6, what + ': ' + f.id + ' is across the board');
      t.ok(cy - d.h / 2 >= board.h / 2 - 1e-6, what + ': ' + f.id + ' is below the midline (top ' + (cy - d.h / 2) + ')');
      t.ok(cy + d.h / 2 <= board.h + 1e-6 || d.h > board.h / 2, what + ': ' + f.id + ' is above the bottom edge');
    });
  }
  function overlaps(positions, list, board, g, scale) {
    var boxes = list.map(function (f) {
      var d = W.tokenDims(f, g, scale);
      var p = positions[f.id];
      return { id: f.id, l: p.x * board.w - d.w / 2, r: p.x * board.w + d.w / 2, t: p.y * board.h - d.h / 2, b: p.y * board.h + d.h / 2 };
    });
    var hits = [];
    for (var i = 0; i < boxes.length; i++) {
      for (var j = i + 1; j < boxes.length; j++) {
        var a = boxes[i];
        var b = boxes[j];
        if (a.l < b.r - 1e-6 && b.l < a.r - 1e-6 && a.t < b.b - 1e-6 && b.t < a.b - 1e-6) hits.push(a.id + '/' + b.id);
      }
    }
    return hits;
  }

  group('Bastion War Table: the board and the screen');

  test('the board is 1600 units wide and shaped like the map (1600 × 900 with none)', function (t) {
    t.same(W.board(1600, 1000), { w: 1600, h: 1000 });
    t.same(W.board(3000, 2000), { w: 1600, h: 1600 * 2000 / 3000 });
    t.same(W.board(0, 0), { w: 1600, h: 900 });
    t.equal(W.BOARD_W, 1600);
    t.equal(W.MAX_UPLOAD_BYTES, 4 * 1024 * 1024);
  });

  test('a point maps to the same spot of the map on the laptop, the TV, zoomed and panned', function (t) {
    var board = W.board(1600, 1000);
    var spot = { x: 1234, y: 777 };
    [
      [1360, 760, { x: 0, y: 0, zoom: 1 }],      /* laptop, 1707 × 930 */
      [1360, 897, { x: 0, y: 0, zoom: 1 }],      /* laptop in full screen */
      [1570, 910, { x: 0, y: 0, zoom: 1 }],      /* the TV, 1920 × 1080 */
      [1570, 910, { x: 0, y: 0, zoom: 2 }],      /* zoomed in */
      [1360, 760, { x: 120, y: -80, zoom: 1.75 }] /* zoomed and panned */
    ].forEach(function (s) {
      var v = W.view(s[0], s[1], board, s[2]);
      var p = W.toScreen(v, spot.x, spot.y);
      var corner = W.toScreen(v, 0, 0);
      var far = W.toScreen(v, board.w, board.h);
      t.equal(((p.x - corner.x) / (far.x - corner.x)).toFixed(6), (1234 / 1600).toFixed(6));
      t.equal(((p.y - corner.y) / (far.y - corner.y)).toFixed(6), (777 / 1000).toFixed(6));
      var back = W.toWorld(v, p.x, p.y);
      t.same([back.x.toFixed(6), back.y.toFixed(6)], ['1234.000000', '777.000000']);
    });
  });

  test('at zoom 1 the whole board fits the stage, centred; zoom keeps the centre where it is', function (t) {
    var board = W.board(0, 0);
    var v = W.view(1800, 910, board, { x: 0, y: 0, zoom: 1 });
    t.equal(v.scale.toFixed(4), (910 / 900).toFixed(4));
    t.equal(Math.round(v.ox), Math.round((1800 - 1600 * 910 / 900) / 2));
    t.equal(Math.round(v.oy), 0);
    var tall = W.view(1360, 910, board, { x: 0, y: 0, zoom: 1 });
    t.equal(tall.scale.toFixed(4), (1360 / 1600).toFixed(4), 'a narrow stage fits the width instead');
    var z = W.view(1800, 910, board, { x: 0, y: 0, zoom: 2 });
    var c = W.toWorld(z, 900, 455);
    t.same([c.x.toFixed(6), c.y.toFixed(6)], ['800.000000', '450.000000'], 'the board centre stays in the middle of the stage');
    t.equal(z.scale.toFixed(4), (2 * 910 / 900).toFixed(4));
  });

  test('Ctrl + wheel zoom keeps the point under the pointer still', function (t) {
    var board = W.board(1600, 1000);
    var cam = { x: 0, y: 0, zoom: 1 };
    var before = W.view(1360, 760, board, cam);
    var under = W.toWorld(before, 300, 200);
    var next = W.zoomAt(1360, 760, board, cam, 2, 300, 200);
    t.equal(next.zoom, 2);
    var after = W.view(1360, 760, board, next);
    var p = W.toScreen(after, under.x, under.y);
    t.same([p.x.toFixed(4), p.y.toFixed(4)], ['300.0000', '200.0000']);
  });

  test('the camera can\'t be panned off the board, and zooming back out re-centres it', function (t) {
    var k = 1 - 1 / 3;
    t.same(W.clampCamera({ x: 5000, y: -5000, zoom: 9 }, { w: 1600, h: 900 }), { x: 800 * k, y: -450 * k, zoom: 3 });
    t.same(W.clampCamera({ x: 300, y: -200, zoom: 1 }, { w: 1600, h: 900 }), { x: 0, y: 0, zoom: 1 });
    t.same(W.clampCamera({ x: 300, y: -200, zoom: 2 }, { w: 1600, h: 900 }), { x: 300, y: -200, zoom: 2 });
    var k2 = 1 - 1 / 1.25;
    t.same(W.clampCamera({ x: 500, y: -300, zoom: 1.25 }, { w: 1600, h: 900 }), { x: 800 * k2, y: -450 * k2, zoom: 1.25 });
  });

  group('Bastion War Table: settings and the saved map');

  test('default settings', function (t) {
    t.same(W.defaultSettings(), { grid: { show: true, size: 70, snap: false, offX: 0, offY: 0 }, tokenScale: 1, camera: { x: 0, y: 0, zoom: 1 } });
    t.same(W.normalizeSettings(undefined), W.defaultSettings());
    t.same(W.normalizeSettings({}), W.defaultSettings());
  });

  test('settings are put back in range and filled in', function (t) {
    var s = W.normalizeSettings({ grid: { show: false, size: 5, snap: 'yes', offX: 'x' }, tokenScale: 9, camera: { x: 12, zoom: 0.1 } });
    t.same(s, { grid: { show: false, size: 20, snap: false, offX: 0, offY: 0 }, tokenScale: 2.5, camera: { x: 12, y: 0, zoom: 0.5 } });
    t.equal(W.normalizeSettings({ grid: { size: 999 } }).grid.size, 200);
    t.equal(W.normalizeSettings({ tokenScale: 0.1 }).tokenScale, 0.5);
    t.equal(W.normalizeSettings({ tokenScale: 1.1 + 0.1 }).tokenScale, 1.2, 'no floating-point crumbs');
    t.equal(W.normalizeSettings({ camera: { zoom: 7 } }).camera.zoom, 3);
    var original = { grid: { size: 300 } };
    W.normalizeSettings(original);
    t.equal(original.grid.size, 300, 'the value passed in is not changed');
  });

  test('isSettings takes any plain object', function (t) {
    t.ok(W.isSettings({}));
    t.ok(W.isSettings({ grid: 'odd' }), 'normalizeSettings deals with the values');
    t.ok(!W.isSettings(null) && !W.isSettings([]) && !W.isSettings('grid') && !W.isSettings(3));
  });

  test('a saved map is a picture data URL with a key', function (t) {
    t.ok(W.isMap({ dataUrl: 'data:image/png;base64,AAAA', key: 'abc', name: 'field.png' }));
    t.ok(W.isMap({ dataUrl: 'data:image/jpeg;base64,AAAA', key: 'abc' }), 'the name is optional');
    t.ok(!W.isMap({ dataUrl: 'https://example.com/map.png', key: 'abc' }), 'no web addresses');
    t.ok(!W.isMap({ dataUrl: 'data:text/plain;base64,AAAA', key: 'abc' }));
    t.ok(!W.isMap({ dataUrl: 'data:image/png;base64,AAAA' }), 'needs a key');
    t.ok(!W.isMap({ dataUrl: 'data:image/png;base64,AAAA', key: 'abc', name: 7 }));
    t.ok(!W.isMap('data:image/png;base64,AAAA') && !W.isMap(null));
  });

  test('hashText is the djb2 fingerprint', function (t) {
    t.equal(W.hashText(''), (5381).toString(16));
    t.equal(W.hashText('a'), ((5381 * 33 + 97) >>> 0).toString(16));
    t.equal(W.hashText('data:image/png;base64,AAAA'), W.hashText('data:image/png;base64,AAAA'));
    t.ok(W.hashText('map one') !== W.hashText('map two'));
  });

  test('a saved deployment is cleaned up', function (t) {
    t.same(W.normalizeDeployment(null), { started: false, locked: false, positions: {} });
    t.same(W.normalizeDeployment({ started: true, positions: { a: { x: 0.5, y: 0.75 }, b: { x: 'x', y: 1 }, c: { x: 2, y: -1 } } }),
      { started: true, locked: false, positions: { a: { x: 0.5, y: 0.75 }, c: { x: 1, y: 0 } } });
    t.same(W.normalizeDeployment({ locked: true }), { started: true, locked: true, positions: {} }, 'locked means started');
  });

  group('Bastion War Table: tokens');

  test('token sizes: lieutenants and beasts are 1 square, regiments and defenders 3 × 2', function (t) {
    var g = grid();
    t.same(W.tokenDims({ kind: 'lieutenant' }, g, 1), { w: 70, h: 70, cols: 1, rows: 1, shape: 'circle' });
    t.same(W.tokenDims({ kind: 'beast' }, g, 1), { w: 70, h: 70, cols: 1, rows: 1, shape: 'circle' });
    t.same(W.tokenDims({ kind: 'regiment' }, g, 1), { w: 210, h: 140, cols: 3, rows: 2, shape: 'rect' });
    t.same(W.tokenDims({ kind: 'defenders' }, g, 1), { w: 210, h: 140, cols: 3, rows: 2, shape: 'rect' });
    var big = W.tokenDims('regiment', grid({ size: 50 }), 1.5);
    t.same([big.w, big.h], [225, 150], 'grid size × token size');
    t.equal(W.tokenDims('dragon', g, 1).shape, 'circle', 'an unknown kind is drawn like a lieutenant');
  });

  test('a circle dragged into the top half stops with its top edge on the midline', function (t) {
    var board = W.board(1600, 1000);
    var c = W.clampToBottomHalf(400, 120, 70, 70, board);
    t.same(c, { x: 400, y: 535 });
    t.equal(c.y - 35, board.h / 2);
    t.ok(W.inBottomHalf(c.x, c.y, 70, 70, board));
    t.ok(!W.inBottomHalf(400, 520, 70, 70, board), 'a circle poking over the midline is not on our ground');
  });

  test('a rectangle stays whole on the board and in the bottom half', function (t) {
    var board = W.board(0, 0);
    t.same(W.clampToBottomHalf(-500, -500, 210, 140, board), { x: 105, y: 520 }, 'top-left: on the midline and the left edge');
    t.same(W.clampToBottomHalf(5000, 5000, 210, 140, board), { x: 1495, y: 830 }, 'bottom-right corner');
    t.same(W.clampToBottomHalf(800, 600, 210, 140, board), { x: 800, y: 600 }, 'already fine: unchanged');
    t.ok(W.inBottomHalf(800, 600, 210, 140, board));
    t.ok(!W.inBottomHalf(1550, 600, 210, 140, board), 'hanging off the right edge');
  });

  test('a token taller than the bottom half is pinned to the midline', function (t) {
    var board = W.board(0, 0);
    var c = W.clampToBottomHalf(800, 300, 600, 500, board);
    t.equal(c.y - 250, 450);
    var wide = W.clampToBottomHalf(100, 700, 2000, 100, board);
    t.equal(wide.x, 800, 'one wider than the board is centred');
  });

  test('snap: odd spans go on square centres, even spans on grid corners', function (t) {
    var g = grid();
    t.same(W.snapToken(100, 100, 70, 70, g), { x: 105, y: 105 }, 'a circle covers one square');
    t.same(W.snapToken(330, 600, 210, 140, g), { x: 315, y: 630 }, 'a regiment: 3 squares across (centre), 2 down (corner)');
    t.same(W.snapToken(100, 100, 70, 70, grid({ offX: 10, offY: -5 })), { x: 115, y: 100 }, 'the grid shift counts');
    var r = W.snapToken(330, 600, 210, 140, g);
    t.equal((r.x - 105) % 70, 0, 'its left edge is on a grid line');
    t.equal((r.y - 70) % 70, 0, 'its top edge is on a grid line');
  });

  test('settle: snapping never pushes a token over the midline or off the board', function (t) {
    var board = W.board(0, 0);
    var g = grid({ snap: true });
    var c = W.settle(800, 455, 210, 140, board, g, true);
    t.ok(c.y - 70 >= 450, 'top edge on or below the midline');
    t.equal((c.y - 70) % 70, 0, 'and still on a grid line');
    var e = W.settle(1590, 880, 70, 70, board, g, true);
    t.ok(e.x + 35 <= 1600 && e.y + 35 <= 900);
    t.same(W.settle(400, 120, 70, 70, board, g, false), W.clampToBottomHalf(400, 120, 70, 70, board), 'without snap it just clamps');
  });

  group('Bastion War Table: the opening battle line');

  test('no forces: nothing to place', function (t) {
    t.same(W.formation([], W.board(0, 0), grid(), 1), {});
    t.same(W.formation(null, W.board(0, 0), grid(), 1), {});
  });

  test('one regiment: centred, just below the midline', function (t) {
    var board = W.board(0, 0);
    var list = forces({ regiment: 1 });
    var p = W.formation(list, board, grid(), 1);
    t.equal(p['regiment-1'].x, 0.5);
    var top = p['regiment-1'].y * board.h - 70;
    t.ok(top >= 450 && top <= 450 + 35, 'its top edge is just below the midline (' + top + ')');
  });

  test('a few forces: regiments in front, lieutenants behind, defenders at the back, beasts on the flanks', function (t) {
    var board = W.board(1600, 1000);
    var g = grid();
    var list = forces({ regiment: 3, lieutenant: 2, beast: 5, defenders: 12 });
    var p = W.formation(list, board, g, 1);
    allOnOurGround(t, p, list, board, g, 1, 'few');
    t.same(overlaps(p, list, board, g, 1), [], 'nothing overlaps');
    var regY = p['regiment-1'].y;
    t.ok(p['lieutenant-1'].y > regY && p.def.y > p['lieutenant-1'].y, 'regiments, then lieutenants, then defenders');
    t.equal(p.def.x, 0.5, 'the defenders are behind the centre');
    t.equal(p['regiment-2'].x, 0.5, 'the middle regiment is at the centre');
    t.ok(p['beast-1'].x < p['regiment-1'].x && p['beast-2'].x > p['regiment-3'].x, 'beasts on both flanks of the front line');
  });

  test('many forces (6 regiments, 10 beasts, 5 lieutenants, defenders) all stay on our ground', function (t) {
    var list = forces({ regiment: 6, lieutenant: 5, beast: 10, defenders: 30 });
    [[W.board(0, 0), grid(), 1], [W.board(1600, 1000), grid(), 1], [W.board(2400, 1200), grid({ size: 50 }), 1.3], [W.board(1600, 900), grid({ snap: true }), 1]].forEach(function (s, i) {
      var p = W.formation(list, s[0], s[1], s[2]);
      t.equal(Object.keys(p).length, list.length, 'case ' + i + ': everyone placed');
      allOnOurGround(t, p, list, s[0], s[1], s[2], 'case ' + i);
    });
    var roomy = W.formation(list, W.board(1600, 1600), grid(), 1);
    t.same(overlaps(roomy, list, W.board(1600, 1600), grid(), 1), [], 'with room to spare, nothing overlaps');
  });

  test('even far too many still end on the board and in the bottom half', function (t) {
    var list = forces({ regiment: 20, lieutenant: 30, beast: 40, defenders: 5 });
    var g = grid({ size: 120 });
    var p = W.formation(list, W.board(0, 0), g, 2);
    allOnOurGround(t, p, list, W.board(0, 0), g, 2, 'crowded');
  });

  test('with snap on, the battle line is on the grid', function (t) {
    var board = W.board(0, 0);
    var g = grid({ snap: true });
    var list = forces({ regiment: 2, lieutenant: 2, beast: 2, defenders: 4 });
    var p = W.formation(list, board, g, 1);
    allOnOurGround(t, p, list, board, g, 1, 'snapped');
    t.same(overlaps(p, list, board, g, 1), [], 'nothing overlaps');
    list.forEach(function (f) {
      var d = W.tokenDims(f, g, 1);
      var left = p[f.id].x * board.w - d.w / 2;
      var top = p[f.id].y * board.h - d.h / 2;
      t.ok(Math.abs(left / 70 - Math.round(left / 70)) < 1e-6 && Math.abs(top / 70 - Math.round(top / 70)) < 1e-6, f.id + ' sits on grid lines');
    });
  });

  group('Bastion War Table: fractions and re-placing');

  test('fractions and board units go back and forth', function (t) {
    var board = W.board(1600, 1000);
    var units = W.fromFractions({ a: { x: 0.25, y: 0.75 } }, board);
    t.same(units, { a: { x: 400, y: 750 } });
    t.same(W.toFractions(units, board), { a: { x: 0.25, y: 0.75 } });
  });

  test('clampAll keeps every token on our ground after the map shape or token size changes', function (t) {
    var list = forces({ regiment: 1, beast: 1 });
    var g = grid();
    var positions = { 'regiment-1': { x: 0.5, y: 0.56 }, 'beast-1': { x: 0.99, y: 0.99 }, gone: { x: 0.1, y: 0.1 } };
    var squat = W.board(1600, 500);
    var p = W.clampAll(positions, list, squat, g, 1.5);
    allOnOurGround(t, p, list, squat, g, 1.5, 'after');
    t.ok(!p.gone, 'forces no longer listed are dropped');
    var again = W.clampAll(p, list, squat, g, 1.5);
    t.ok(W.samePositions(p, again), 're-clamping changes nothing');
  });

  test('fillMissing places a force added after deployment began, and leaves the rest alone', function (t) {
    var board = W.board(0, 0);
    var list = forces({ regiment: 1, beast: 1 });
    var p = W.fillMissing({ 'regiment-1': { x: 0.2, y: 0.8 } }, list, board, grid(), 1);
    t.same(p['regiment-1'], { x: 0.2, y: 0.8 });
    t.ok(p['beast-1'] && p['beast-1'].y > 0.5);
  });

  test('the roster groups forces as Regiments, Defenders, Lieutenants, Beasts', function (t) {
    var g = W.groups(forces({ regiment: 2, beast: 1, defenders: 12 }));
    t.same(g.map(function (x) { return x.name + ' ' + x.items.length; }), ['Regiments 2', 'Defenders 1', 'Beasts 1']);
    t.equal(W.cleanForces([{ id: 'a', kind: 'beast' }, { id: 'a', kind: 'beast' }, { kind: 'beast' }, null]).length, 1, 'repeats and forces without an id are dropped');
  });
}());
