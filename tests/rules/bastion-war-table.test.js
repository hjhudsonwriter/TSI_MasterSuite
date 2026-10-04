/* The Ironbow Bastion Manager's War Table: tools/bastion/war-table-rules.js */
(function () {
  var W = TSI.bastion.warTableRules;
  var BR = TSI.bastion.battleRules;
  var D = window.TSI_DATA.bastionWar;

  /* A small battle (no map: 22 × 12, strip rows 5 and 6) for the words and refusals. */
  function U(id, type, extra) {
    var a = D.archetypes[type];
    return Object.assign({ id: id, kind: 'formation', type: type, name: a.name, label: a.name + ' ' + id.replace(/\D/g, ''), personnel: a.size, size: a.size, variant: null, source: {} }, extra || {});
  }
  function battle(objective) {
    return BR.createBattle({
      player: { units: [U('p1', 'line'), U('p2', 'archers')], leaders: [{ id: 'lt-1', name: 'Lieutenant 1' }], defenders: { count: 10, armed: true } },
      enemy: {
        units: [U('e1', 'heavy', { name: 'Bacca Stoneguard', label: 'Bacca Stoneguard', variant: { id: 'bacca_stoneguard', name: 'Bacca Stoneguard', trait: 'steady' } }), U('e2', 'line'), U('e3', 'line')],
        leaders: [{ id: 'cpt-1', name: 'Captain 1' }]
      },
      objective: objective || 'skirmish',
      conditions: { weather: 'clear', moraleMod: 0, luckMod: 1 }
    }, null);
  }

  group('Bastion War Table: the board and the screen');

  test('the board is the battle grid: 1600 units across, one square = 1600 ÷ squares across', function (t) {
    var b = W.boardFor(22, 12);
    t.equal(b.w, 1600);
    t.equal(b.cell.toFixed(6), (1600 / 22).toFixed(6));
    t.equal(b.h.toFixed(6), (1600 / 22 * 12).toFixed(6));
    t.same([b.cols, b.rows], [22, 12]);
    t.same([W.boardFor(24, 30).cols, W.boardFor(24, 30).rows], [24, 30]);
    t.equal(W.BOARD_W, 1600);
    t.equal(W.MAX_UPLOAD_BYTES, 4 * 1024 * 1024);
  });

  test('cellAt finds the square under a point (null off the board); nearestCell never leaves it', function (t) {
    var b = W.boardFor(20, 10);   /* squares of 80 */
    t.same(W.cellAt(b, 0, 0), { c: 0, r: 0 });
    t.same(W.cellAt(b, 79.9, 80), { c: 0, r: 1 });
    t.same(W.cellAt(b, 1599, 799), { c: 19, r: 9 });
    t.equal(W.cellAt(b, 1600, 10), null);
    t.equal(W.cellAt(b, -1, 10), null);
    t.equal(W.cellAt(b, 10, 800), null);
    t.same(W.nearestCell(b, -50, 9999), { c: 0, r: 9 });
    t.same(W.nearestCell(b, 5000, -3), { c: 19, r: 0 });
    t.same(W.cellCentre(b, 2, 3), { x: 200, y: 280 });
  });

  test('a token is drawn at the token size, centred in its square (display only)', function (t) {
    var b = W.boardFor(20, 10);
    t.same(W.tokenBox(b, 2, 3, 0.9), { x: 160 + 4, y: 240 + 4, size: 72 });
    t.same(W.tokenBox(b, 0, 0, 1), { x: 0, y: 0, size: 80 });
    t.equal(W.tokenBox(b, 0, 0, 7).size, 80, 'never bigger than the square');
    t.equal(W.tokenBox(b, 0, 0, 0.1).size, 40, 'never smaller than half');
  });

  test('a point maps to the same spot of the board on the laptop, the TV, zoomed and panned', function (t) {
    var board = W.boardFor(22, 14);
    var spot = { x: 1234, y: 777 };
    [
      [1300, 740, { x: 0, y: 0, zoom: 1 }],      /* laptop, 1707 × 930 */
      [1300, 880, { x: 0, y: 0, zoom: 1 }],      /* laptop in full screen */
      [1490, 890, { x: 0, y: 0, zoom: 1 }],      /* the TV, 1920 × 1080 */
      [1490, 890, { x: 0, y: 0, zoom: 2 }],      /* zoomed in */
      [1300, 740, { x: 120, y: -80, zoom: 1.75 }] /* zoomed and panned */
    ].forEach(function (s) {
      var v = W.view(s[0], s[1], board, s[2]);
      var p = W.toScreen(v, spot.x, spot.y);
      var corner = W.toScreen(v, 0, 0);
      var far = W.toScreen(v, board.w, board.h);
      t.equal(((p.x - corner.x) / (far.x - corner.x)).toFixed(6), (1234 / board.w).toFixed(6));
      t.equal(((p.y - corner.y) / (far.y - corner.y)).toFixed(6), (777 / board.h).toFixed(6));
      var back = W.toWorld(v, p.x, p.y);
      t.same([back.x.toFixed(6), back.y.toFixed(6)], ['1234.000000', '777.000000']);
    });
  });

  test('at zoom 1 the whole board fits the stage, centred; zoom keeps the centre where it is', function (t) {
    var board = W.boardFor(22, 12);
    var v = W.view(1800, 700, board, { x: 0, y: 0, zoom: 1 });
    t.equal(v.scale.toFixed(4), (700 / board.h).toFixed(4));
    t.equal(Math.round(v.ox), Math.round((1800 - 1600 * 700 / board.h) / 2));
    t.equal(Math.round(v.oy), 0);
    var narrow = W.view(1000, 910, board, { x: 0, y: 0, zoom: 1 });
    t.equal(narrow.scale.toFixed(4), (1000 / 1600).toFixed(4), 'a narrow stage fits the width instead');
    var z = W.view(1800, 700, board, { x: 0, y: 0, zoom: 2 });
    var c = W.toWorld(z, 900, 350);
    t.same([c.x.toFixed(6), c.y.toFixed(6)], ['800.000000', (board.h / 2).toFixed(6)], 'the board centre stays in the middle of the stage');
  });

  test('Ctrl + wheel zoom keeps the point under the pointer still', function (t) {
    var board = W.boardFor(22, 14);
    var cam = { x: 0, y: 0, zoom: 1 };
    var before = W.view(1300, 740, board, cam);
    var under = W.toWorld(before, 300, 200);
    var next = W.zoomAt(1300, 740, board, cam, 2, 300, 200);
    t.equal(next.zoom, 2);
    var p = W.toScreen(W.view(1300, 740, board, next), under.x, under.y);
    t.same([p.x.toFixed(4), p.y.toFixed(4)], ['300.0000', '200.0000']);
  });

  test('the camera can\'t be panned off the board, and zooming back out re-centres it', function (t) {
    var k = 1 - 1 / 3;
    t.same(W.clampCamera({ x: 5000, y: -5000, zoom: 9 }, { w: 1600, h: 900 }), { x: 800 * k, y: -450 * k, zoom: 3 });
    t.same(W.clampCamera({ x: 300, y: -200, zoom: 1 }, { w: 1600, h: 900 }), { x: 0, y: 0, zoom: 1 });
    t.same(W.clampCamera({ x: 300, y: -200, zoom: 2 }, { w: 1600, h: 900 }), { x: 300, y: -200, zoom: 2 });
  });

  group('Bastion War Table: settings and the saved map');

  test('default settings: grid lines and Snap on, tokens at 90%, 22 squares across', function (t) {
    t.same(W.defaultSettings(), { grid: { show: true, snap: true }, tokenScale: 0.9, camera: { x: 0, y: 0, zoom: 1 }, cols: D.scale.cols, terrainDismissed: [], trimDismissed: [] });
    t.same(W.normalizeSettings(undefined), W.defaultSettings());
    t.same(W.normalizeSettings({}), W.defaultSettings());
  });

  test('settings are put back in range and filled in; phase 1\'s grid size is let go', function (t) {
    var s = W.normalizeSettings({ grid: { show: false, size: 5, snap: 'yes', offX: 'x' }, tokenScale: 9, camera: { x: 12, zoom: 0.1 }, cols: 99 });
    t.same(s, { grid: { show: false, snap: true }, tokenScale: 1, camera: { x: 12, y: 0, zoom: 0.5 }, cols: D.scale.maxCols, terrainDismissed: [], trimDismissed: [] });
    t.equal(W.normalizeSettings({ cols: 3 }).cols, D.scale.minCols);
    t.equal(W.normalizeSettings({ cols: 23.4 }).cols, 23);
    t.equal(W.normalizeSettings({ tokenScale: 0.1 }).tokenScale, 0.5);
    t.equal(W.normalizeSettings({ tokenScale: 0.7 + 0.1 }).tokenScale, 0.8, 'no floating-point crumbs');
    t.equal(W.normalizeSettings({ camera: { zoom: 7 } }).camera.zoom, 3);
    var original = { grid: { size: 300 }, cols: 50 };
    W.normalizeSettings(original);
    t.same(original, { grid: { size: 300 }, cols: 50 }, 'the value passed in is not changed');
  });

  test('dismissed warnings: strings only, no repeats, the newest kept', function (t) {
    t.same(W.normalizeSettings({ terrainDismissed: ['a', 'a', 7, '', 'b'] }).terrainDismissed, ['a', 'b']);
    var many = [];
    for (var i = 0; i < 70; i++) many.push('k' + i);
    var kept = W.normalizeSettings({ terrainDismissed: many }).terrainDismissed;
    t.equal(kept.length, W.DISMISS_MAX);
    t.equal(kept[kept.length - 1], 'k69');
    t.same(W.dismiss(['a', 'b'], 'a'), ['b', 'a'], 'moved to the end, not repeated');
    t.same(W.normalizeSettings({ trimDismissed: ['m', 'm', null, 'n'], terrainDismissed: ['a'] }).trimDismissed, ['m', 'n'], 'the "edges hidden" note keeps its own list');
    t.equal(W.normalizeSettings({ trimDismissed: many }).trimDismissed.length, W.DISMISS_MAX);
    t.equal(W.dismiss(many, 'new').length, W.DISMISS_MAX);
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

  test('a picture of another shape than the battlefield: how much of it is hidden, and the note', function (t) {
    /* Found in review: a 1000 × 2000 picture became 22 × 30 squares and lost
       16% at the top and bottom with no word said; 2400 × 900 became 22 × 10
       and lost 9% at each side. */
    var tall = W.mapTrim({ w: 1000, h: 2000 }, BR.gridFor({ w: 1000, h: 2000 }, 22));
    t.same(tall, { edges: 'tall', each: 16 });
    var wide = W.mapTrim({ w: 2400, h: 900 }, BR.gridFor({ w: 2400, h: 900 }, 22));
    t.same(wide, { edges: 'wide', each: 9 });
    /* Within the 10 to 30 rows the depth follows the picture: never a note. */
    for (var c = D.scale.minCols; c <= D.scale.maxCols; c++) {
      for (var rows = D.scale.minRows - 0.5; rows < D.scale.maxRows + 0.5; rows += 0.25) {
        var pic = { w: 1600, h: 1600 * rows / c };
        if (W.mapTrim(pic, BR.gridFor(pic, c))) { t.ok(false, c + ' across, ' + rows + ' deep shouldn\'t get a note'); return; }
      }
      var deep = { w: 1000, h: 1000 * (D.scale.maxRows + 2) / c };
      var flat = { w: 1000, h: 1000 * (D.scale.minRows - 1) / c };
      t.equal(W.mapTrim(deep, BR.gridFor(deep, c)).edges, 'tall', c + ' across: deeper than ' + D.scale.maxRows + ' rows gets the note');
      t.equal(W.mapTrim(flat, BR.gridFor(flat, c)).edges, 'wide', c + ' across: flatter than ' + D.scale.minRows + ' rows gets the note');
    }
    t.same(W.mapTrim({ w: 1600, h: 900 }, { cols: 22, rows: 30 }), { edges: 'wide', each: 29 }, 'a new picture on a battle\'s fixed squares');
    t.equal(W.mapTrim(null, { cols: 22, rows: 12 }), null);
    t.equal(W.mapTrim({ w: 0, h: 900 }, { cols: 22, rows: 12 }), null);
    t.equal(W.mapTrim({ w: 1600, h: 900 }, null), null);

    var g30 = { cols: 22, rows: 30 };
    t.equal(W.mapTrimText(tall, g30, true), 'About 16% of this picture is hidden at the top and 16% at the bottom: the battlefield is never more than 30 squares deep (22 × 30 now). ' +
      'To see all of it, crop the picture to 11 : 15 (width : height, the shape of 22 × 30 squares) and use Replace map. Fewer squares across shows a little more of it.');
    t.ok(!/Fewer squares/.test(W.mapTrimText(tall, { cols: D.scale.minCols, rows: 30 }, true)), 'not when it is already as narrow as it goes');
    t.equal(W.mapTrimText(wide, { cols: 22, rows: 10 }, true), 'About 9% of this picture is hidden at the left and 9% at the right: the battlefield is never less than 10 squares deep (22 × 10 now). ' +
      'To see all of it, crop the picture to 11 : 5 (width : height, the shape of 22 × 10 squares) and use Replace map. More squares across shows a little more of it.');
    t.equal(W.mapTrimText({ edges: 'wide', each: 30 }, g30, false), 'About 30% of this picture is hidden at the left and 30% at the right: it is wider than the battlefield\'s squares (22 × 30, fixed when deployment began). ' +
      'To see all of it, crop the picture to 11 : 15 (width : height, the shape of 22 × 30 squares) and use Replace map.');
    t.equal(W.mapTrimText(null, g30, true), '');
  });

  test('hashText is the djb2 fingerprint', function (t) {
    t.equal(W.hashText(''), (5381).toString(16));
    t.equal(W.hashText('a'), ((5381 * 33 + 97) >>> 0).toString(16));
    t.ok(W.hashText('map one') !== W.hashText('map two'));
  });

  group('Bastion War Table: painted terrain');

  test('a painting is cols × rows codes; the store keeps only good ones', function (t) {
    t.ok(W.isPainting({ cols: 2, rows: 2, cells: 'w.x.' }));
    t.ok(!W.isPainting({ cols: 2, rows: 2, cells: 'w.x' }), 'wrong length');
    t.ok(!W.isPainting({ cols: 2.5, rows: 2, cells: 'w.x.' }));
    t.ok(!W.isPainting({ cols: 0, rows: 0, cells: '' }));
    t.ok(!W.isPainting(null) && !W.isPainting('w.x.'));
    t.same(W.cleanTerrainStore({ a: { cols: 2, rows: 1, cells: 'wQ' }, b: 'nonsense', c: { cols: 1, rows: 1, cells: 'xx' } }),
      { a: { cols: 2, rows: 1, cells: 'w.' } }, 'unknown codes become open ground; broken paintings are let go');
    t.same(W.cleanTerrainStore(null), {});
    t.same(W.cleanTerrainStore([1]), {});
  });

  test('blank paintings, all open ground, painting squares', function (t) {
    var p = W.blankPainting(3, 2);
    t.same(p, { cols: 3, rows: 2, cells: '......' });
    t.ok(W.allOpen(p) && W.allOpen(null), 'no painting counts as open ground');
    var res = W.paint(p, [{ c: 0, r: 0 }, { c: 2, r: 1 }, { c: 9, r: 9 }, { c: -1, r: 0 }], 'w');
    t.equal(res.changed, 2, 'off-board squares are ignored');
    t.equal(res.painting.cells, 'w....w');
    t.ok(!W.allOpen(res.painting));
    t.equal(p.cells, '......', 'the old painting is unchanged');
    t.equal(W.paint(res.painting, [{ c: 0, r: 0 }], 'w').changed, 0, 'painting the same again changes nothing');
    t.equal(W.paint(res.painting, [{ c: 0, r: 0 }], '.').painting.cells, '.....w', 'the eraser is open ground');
  });

  test('a fast drag paints every square between two points', function (t) {
    t.same(W.strokeCells({ c: 0, r: 0 }, { c: 3, r: 0 }), [{ c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }, { c: 3, r: 0 }]);
    t.same(W.strokeCells({ c: 2, r: 2 }, { c: 2, r: 2 }), [{ c: 2, r: 2 }]);
    var diag = W.strokeCells({ c: 0, r: 0 }, { c: 3, r: 3 });
    t.equal(diag.length, 4);
    var long = W.strokeCells({ c: 0, r: 5 }, { c: 7, r: 1 });
    t.same(long[0], { c: 0, r: 5 });
    t.same(long[long.length - 1], { c: 7, r: 1 });
    for (var i = 1; i < long.length; i++) t.ok(Math.max(Math.abs(long[i].c - long[i - 1].c), Math.abs(long[i].r - long[i - 1].r)) === 1, 'no gaps');
  });

  test('each map keeps one painting per battlefield width: a width change never thins out a ford', function (t) {
    /* A 22-across river with a one-square ford at column 5, as painted. */
    var p22 = W.blankPainting(22, 14);
    p22 = W.paint(p22, W.strokeCells({ c: 0, r: 10 }, { c: 21, r: 10 }), 'x').painting;
    p22 = W.paint(p22, [{ c: 5, r: 10 }], 'f').painting;
    var store = W.storePainting({}, 'mapA', p22);
    t.same(Object.keys(store), ['mapA']);
    var at22 = W.paintingFor(BR, store, 'mapA', 22, 14);
    t.ok(at22.own, 'its own painting at 22 across');
    t.equal(at22.painting.cells, p22.cells);
    /* At 20 across it is only redrawn (nothing saved), and says where from. */
    var at20 = W.paintingFor(BR, store, 'mapA', 20, 13);
    t.ok(!at20.own);
    t.equal(at20.fromCols, 22);
    t.equal(at20.painting.cells.length, 20 * 13);
    t.equal(at20.painting.cells.slice(9 * 20, 10 * 20).indexOf('f'), -1, 'the redrawn river has lost its ford (why it is pointed out)');
    /* Painting at 20 saves a 20-across painting and keeps the 22-across one. */
    var p20 = W.paint(at20.painting, [{ c: 1, r: 1 }], 'c').painting;
    var store2 = W.storePainting(store, 'mapA', p20);
    t.same(Object.keys(store2).sort(), ['mapA', 'mapA@22']);
    t.equal(store2.mapA.cols, 20, 'the latest painting is the map\'s main one');
    t.same(store, { mapA: p22 }, 'the store passed in is not changed');
    var back = W.paintingFor(BR, store2, 'mapA', 22, 14);
    t.ok(back.own, 'back at 22 across: its own painting');
    t.equal(back.painting.cells.slice(10 * 22, 11 * 22), 'xxxxxfxxxxxxxxxxxxxxxx', 'the ford is still there');
    t.ok(W.paintingFor(BR, store2, 'mapA', 20, 13).own);
    /* Painting at 22 again: it becomes the main one, the 20-across one is kept. */
    var store3 = W.storePainting(store2, 'mapA', back.painting);
    t.same(Object.keys(store3).sort(), ['mapA', 'mapA@20']);
    t.equal(store3.mapA.cols, 22);
    /* Another map, the plain board, nothing painted. */
    var none = W.paintingFor(BR, store3, 'none', 22, 12);
    t.same([none.own, none.fromCols, W.allOpen(none.painting)], [false, null, true]);
    t.same(Object.keys(W.forgetPaintings(store3, 'mapA')), [], 'Clear terrain lets go of every width');
    t.same(Object.keys(W.forgetPaintings({ mapA: p22, 'mapA@20': p20, mapAB: p22, none: p22 }, 'mapA')).sort(), ['mapAB', 'none'], 'only that map\'s');
  });

  test('a battle keeps its own ground: its map and terrain, checked against its grid', function (t) {
    var p = W.paint(W.blankPainting(22, 12), [{ c: 3, r: 4 }], 'w').painting;
    t.same(W.cleanGround({ mapKey: 'abc', mapName: 'field.jpg', terrain: p }, 22, 12), { mapKey: 'abc', mapName: 'field.jpg', terrain: p });
    t.same(W.cleanGround({ mapKey: 'none', terrain: p }, 22, 12).mapName, '');
    t.equal(W.cleanGround({ mapKey: 'abc', terrain: p }, 20, 12), null, 'a painting for another grid isn\'t this battle\'s');
    t.equal(W.cleanGround({ mapKey: '', terrain: p }, 22, 12), null);
    t.equal(W.cleanGround({ mapKey: 'abc' }, 22, 12), null);
    t.equal(W.cleanGround(null, 22, 12), null);
    var odd = W.cleanGround({ mapKey: 'abc', terrain: { cols: 2, rows: 1, cells: 'wQ' } }, 2, 1);
    t.equal(odd.terrain.cells, 'w.', 'unknown codes become open ground');
  });

  group('Bastion War Table: proposing moves and typing rolls');

  test('a square chosen before an order proposes the order that reaches it', function (t) {
    var areas = { advance: { '5,8': {}, '5,7': {} }, march: { '5,8': {}, '5,7': {}, '5,4': {} }, disengage: null };
    t.equal(W.orderForCell(areas, { c: 5, r: 7 }), 'advance', 'within its Move: Advance & Attack');
    t.equal(W.orderForCell(areas, { c: 5, r: 4 }), 'march', 'beyond it: March');
    t.equal(W.orderForCell(areas, { c: 0, r: 0 }), null, 'out of reach');
    t.equal(W.orderForCell({ advance: null, march: null, disengage: { '3,9': {} } }, { c: 3, r: 9 }), 'disengage', 'in melee: Disengage');
    t.equal(W.orderForCell(null, { c: 5, r: 7 }), null);
    t.equal(W.orderForCell(areas, null), null);
  });

  test('a unit dropped on an enemy: how it could attack it this activation, and the words', function (t) {
    /* Found in review: dragging a unit onto an enemy said "Out of reach", or
       "choose Advance & Attack" when that order was already chosen. */
    var b = battle();
    BR.beginDeployment(b, null);
    BR.startBattle(b);
    b.units.forEach(function (u) { u.pos = null; });
    function put(id, c, r) { BR.unitById(b, id).pos = { c: c, r: r }; }
    function route(id, tid) { return W.attackRoute(BR, b, id, tid, BR.reachable(b, id, 'advance', null), null, null, null); }
    put('p1', 5, 8); put('e2', 5, 5); put('p2', 10, 11); put('e3', 10, 2);
    t.same(route('p1', 'e2'), { at: 'move', kind: 'melee' }, 'Line Infantry (Move 3) can step next to it first');
    t.same(route('p2', 'e3'), { at: 'move', kind: 'ranged' }, 'Archers (range 6) can move into range');
    put('p1', 5, 6);
    t.same(route('p1', 'e2'), { at: 'here', kind: 'melee' }, 'already next to it');
    put('e3', 10, 5);
    t.same(route('p2', 'e3'), { at: 'here', kind: 'ranged' }, 'already in range');
    put('p1', 0, 11); put('e2', 21, 0);
    t.equal(route('p1', 'e2'), null, 'too far this activation');
    t.equal(W.attackRoute(BR, b, 'p1', 'e2', null, null, null, null), null, 'no reach: from where it stands only');
    t.same(W.attackRoute(BR, b, 'p1', 'e2', null, { c: 20, r: 1 }, [{ c: 0, r: 11 }, { c: 20, r: 1 }], null), { at: 'here', kind: 'melee' }, 'from the square already chosen');

    var move = { at: 'move', kind: 'melee' };
    t.equal(W.enemySquareText(move, 'Light Cavalry', 'Bacca Cragmen', null),
      'To attack Bacca Cragmen, click a lit square next to it (Advance & Attack), then click Bacca Cragmen: the targets in reach are ringed in red.');
    t.ok(/within range of it/.test(W.enemySquareText({ at: 'move', kind: 'ranged' }, 'Archers', 'Bacca Cragmen', null)));
    t.equal(W.enemySquareText({ at: 'here', kind: 'melee' }, 'Light Cavalry', 'Bacca Cragmen', null),
      'To attack Bacca Cragmen, choose Advance & Attack, then click Bacca Cragmen: Light Cavalry can attack it from where it stands.');
    t.equal(W.enemySquareText(null, 'Light Cavalry', 'Bacca Cragmen', null),
      'Bacca Cragmen is out of reach: Light Cavalry can\'t attack it this activation from any square it can reach. The lit squares show where it can go.');
    var adv = W.enemySquareText(move, 'Light Cavalry', 'Bacca Cragmen', 'advance');
    t.equal(adv, 'That square holds Bacca Cragmen, and a move must end on an empty square. To attack it, click a lit square next to it first, then click Bacca Cragmen: the targets in reach are ringed in red.');
    t.ok(!/choose Advance & Attack/.test(adv), 'never tells you to choose the order you have chosen');
    t.ok(/Click Bacca Cragmen to attack it/.test(W.enemySquareText({ at: 'here', kind: 'melee' }, 'Light Cavalry', 'Bacca Cragmen', 'advance')));
    t.ok(/can't attack it this activation/.test(W.enemySquareText(null, 'Light Cavalry', 'Bacca Cragmen', 'advance')));
    t.equal(W.enemySquareText(move, 'Light Cavalry', 'Bacca Cragmen', 'march'),
      'That square holds Bacca Cragmen: March can\'t attack, and a move must end on an empty square. To attack it, choose Advance & Attack instead.');
    t.ok(/Disengage can't attack.*can't attack it this activation/.test(W.enemySquareText(null, 'Line Infantry', 'Bacca Cragmen', 'disengage')));
  });

  test('the log\'s new entries are counted from the last one seen, also once the oldest are dropped', function (t) {
    var log = [];
    for (var i = 0; i < 300; i++) log.push({ text: 'entry ' + i });
    var seen = log[299];
    t.equal(W.freshCount(log, seen), 0);
    log.splice(0, 2);
    log.push({ text: 'new 1' }, { text: 'new 2' });
    t.equal(log.length, 300, 'the length stays at the limit');
    t.equal(W.freshCount(log, seen), 2, 'still two new entries');
    t.equal(W.freshCount(log, null), 300);
    t.equal(W.freshCount(log, { text: 'gone' }), 300, 'an entry no longer in the log: everything is new');
    t.equal(W.freshCount(null, seen), 0);
  });

  test('ending a battle early: the result it would give, and whether playing on could change it', function (t) {
    var b = battle('raid');
    BR.beginDeployment(b, null);
    BR.startBattle(b);
    b.units.forEach(function (u) { if (u.side === 'enemy') { u.pos = null; u.withdrawn = true; } });
    b.started = true;
    t.ok(BR.canEndEarly(b));
    var before = JSON.stringify(b);
    var pv = W.endEarlyPreview(BR, b);
    t.equal(pv.outcome, 'defeat');
    t.ok(/supply markers/.test(pv.reason), pv.reason);
    t.ok(pv.couldChange, 'your units are on the field and could still carry supplies off');
    t.equal(JSON.stringify(b), before, 'the battle itself is not changed');
    t.equal(W.outcomeWord(pv.outcome), 'a defeat');
    /* Nothing of yours left on the field: nothing can change. */
    var s = battle('skirmish');
    BR.beginDeployment(s, null);
    BR.startBattle(s);
    s.units.forEach(function (u) { if (u.side === 'player') { u.pos = null; u.status = 'routed'; } });
    var pv2 = W.endEarlyPreview(BR, s);
    t.ok(pv2 && !pv2.couldChange, JSON.stringify(pv2));
    t.equal(W.endEarlyPreview(BR, null), null);
    BR.withdraw(b);
    t.equal(W.endEarlyPreview(BR, b), null, 'a battle that is already over');
    t.equal(W.outcomeWord('victory'), 'a victory');
  });

  test('arrow keys move the proposed square to the next one in reach that way', function (t) {
    var reach = { '5,5': 1, '6,5': 1, '8,5': 1, '5,4': 1 };
    t.same(W.arrowStep(reach, { c: 5, r: 5 }, [1, 0], 22, 12), { c: 6, r: 5 });
    t.same(W.arrowStep(reach, { c: 6, r: 5 }, [1, 0], 22, 12), { c: 8, r: 5 }, 'skips a square out of reach');
    t.equal(W.arrowStep(reach, { c: 8, r: 5 }, [1, 0], 22, 12), null, 'nothing further that way');
    t.same(W.arrowStep(reach, { c: 5, r: 5 }, [0, -1], 22, 12), { c: 5, r: 4 });
    t.equal(W.arrowStep(reach, { c: 5, r: 4 }, [0, -1], 22, 12), null);
    t.equal(W.arrowStep(null, { c: 5, r: 4 }, [0, -1], 22, 12), null);
  });

  test('the d20 box: blank rolls for you; 1 to 20 is used; anything else is refused', function (t) {
    t.equal(W.parseD20(''), null);
    t.equal(W.parseD20('  '), null);
    t.equal(W.parseD20(null), null);
    t.equal(W.parseD20('1'), 1);
    t.equal(W.parseD20(' 20 '), 20);
    t.equal(W.parseD20(7), 7);
    ['0', '21', '2.5', 'abc', '-3', '1e1', '100'].forEach(function (v) { t.ok(isNaN(W.parseD20(v)), v + ' is refused'); });
  });

  group('Bastion War Table: words');

  test('the round, whose turn it is', function (t) {
    var b = battle();
    BR.beginDeployment(b, null);
    BR.startBattle(b);
    t.equal(W.roundText(b), 'Round 1 of 6');
    t.equal(W.turnText(b), 'Your turn', 'Luck passed: you first');
    b.turnSide = 'enemy';
    t.equal(W.turnText(b), 'The enemy\'s turn');
    BR.withdraw(b);
    t.equal(W.turnText(b), 'The battle is over');
  });

  test('the objective and its progress, with the deadline', function (t) {
    var r = battle('raid');
    t.equal(W.objectiveText(r, D), 'Raid: carry off 2 of 3 supplies by the end of round 6, or break the enemy · 0 carried off');
    r.objective.extracted = 1;
    r.objective.markers[0].state = 'carried';
    t.equal(W.objectiveText(r, D), 'Raid: carry off 2 of 3 supplies by the end of round 6, or break the enemy · 1 carried off, 1 on the way');
    var s = battle('seize_outpost');
    s.objective.held.player = 1;
    t.equal(W.objectiveText(s, D), 'Seize Outpost: hold it at 2 round ends in a row by the end of round 6, or break the enemy · held 1 round end (2 needed)');
    var d = battle('defend');
    t.equal(W.objectiveText(d, D), 'Defend Bastion: keep the enemy off your supply depot and your army unbroken by the end of round 6, or break the enemy · the enemy hasn\'t held it');
    d.objective.held.enemy = 1;
    t.ok(/the enemy has held it 1 round end \(2 in a row loses\)$/.test(W.objectiveText(d, D)));
    t.equal(W.objectiveText(battle('skirmish'), D), 'Skirmish: break the enemy army, or lose the smaller share of your strength by the end of round 6');
  });

  test('the attack preview in one line (the contract\'s example, and the harder cases)', function (t) {
    t.equal(W.previewLine({ attack: 4, mods: [{ label: 'Luck', value: 1 }], modTotal: 1, capped: false, defence: 13, defenceMods: [], needs: 8 }),
      'd20 + 4 + 1 (Luck) vs 13: needs 8');
    t.equal(W.previewLine({ attack: 2, mods: [{ label: 'Luck', value: -1 }, { label: 'Shaken', value: -2 }], modTotal: -3, capped: false, defence: 15, defenceMods: [{ label: 'Hold', value: 2 }], needs: 16 }),
      'd20 + 2 − 1 (Luck) − 2 (Shaken) vs 15 (13 + 2 Hold): needs 16');
    t.equal(W.previewLine({ attack: 5, mods: [{ label: 'Luck', value: 1 }, { label: 'Strong Charge', value: 3 }, { label: 'Surround', value: 2 }], modTotal: 4, capped: true, defence: 12, defenceMods: [], needs: 3 }),
      'd20 + 5 + 4 (modifiers, capped) vs 12: needs 3');
    t.equal(W.needsText(1), 'needs 2 (only a natural 1 misses)');
    t.equal(W.needsText(21), 'only a natural 20 hits');
    t.equal(W.needsText(20), 'needs 20');
    t.equal(W.previewLine(null), '');
  });

  test('a real preview from the battle rules reads the same way', function (t) {
    var b = battle();
    BR.beginDeployment(b, null);
    BR.startBattle(b);
    b.units.forEach(function (u) { u.pos = null; });
    BR.unitById(b, 'p1').pos = { c: 5, r: 7 };
    BR.unitById(b, 'e2').pos = { c: 5, r: 6 };
    var pv = BR.previewAttack(b, 'p1', { c: 5, r: 7 }, null, 'e2', null);
    t.equal(W.previewLine(pv), 'd20 + 4 + 1 (Luck) vs 13: needs 8');
  });

  test('a Resolve check worked out before the dice', function (t) {
    t.equal(W.checkLine([{ label: 'Resolve', value: 1 }, { label: 'Morale', value: 2 }, { label: 'Lieutenant 1', value: 2 }], 10), 'd20 + 1 (Resolve) + 2 (Morale) + 2 (Lieutenant 1) vs DC 10: needs 5');
    t.equal(W.checkLine([{ label: 'Resolve', value: 0 }, { label: 'Heatwave', value: -1 }], 10), 'd20 + 0 (Resolve) − 1 (Heatwave) vs DC 10: needs 11');
  });

  test('losses, statuses, support, the enemy\'s colours and initial', function (t) {
    t.equal(W.lossText({ startBV: 39, lostBV: 7.5, pct: 19.2, broken: false }), 'Lost 7.5 of 39 Battle Value (19.2%)');
    t.equal(W.lossText({ startBV: 30, lostBV: 18, pct: 60, broken: true }), 'Lost 18 of 30 Battle Value (60%): broken');
    t.equal(W.statusWord({ status: 'steady' }), 'Steady');
    t.equal(W.statusWord({ status: 'shaken' }), 'Shaken');
    t.equal(W.statusWord({ status: 'routed' }), 'Routed');
    t.equal(W.statusWord({ status: 'defeated' }), 'Defeated');
    t.equal(W.statusWord({ status: 'steady', withdrawn: true }), 'Withdrew');
    t.equal(W.statusWord({ status: 'shaken', withdrawn: true }), 'Shaken, withdrew');
    t.equal(W.supportText({ count: 10, armed: true, bonus: 2 }), '+10 defenders: +2 Cohesion');
    t.equal(W.supportText({ count: 3, armed: true, bonus: 0 }), '+3 defenders: no Cohesion bonus');
    t.equal(W.supportText(null), '');
    t.same(W.clanStyle(D, 'slade'), D.clans.slade.style, 'Slade\'s teal and white');
    t.same(W.clanStyle(D, 'bacca'), D.enemyStyle);
    t.same(W.clanStyle(D, 'nobody'), D.enemyStyle);
    t.equal(W.clanInitial('Bacca'), 'B');
    t.equal(W.clanInitial('Clan Rowthorn'), 'R');
    t.equal(W.clanInitial('the Slade'), 'S');
    t.equal(W.clanInitial(''), '?');
  });

  group('Bastion War Table: deployment and rosters');

  test('why a unit can\'t be set out on a square', function (t) {
    var b = battle('raid');
    BR.beginDeployment(b, null);
    var p1 = BR.unitById(b, 'p1').pos;
    var p2 = BR.unitById(b, 'p2').pos;
    t.equal(W.deployRefusal(BR, b, 'p1', { c: 0, r: 11 }, null), '', 'your own ground is fine');
    t.equal(W.deployRefusal(BR, b, 'p1', p1, null), '', 'staying put is fine');
    t.ok(/no-deployment strip/.test(W.deployRefusal(BR, b, 'p1', { c: 3, r: 5 }, null)));
    t.ok(/enemy's ground/.test(W.deployRefusal(BR, b, 'p1', { c: 3, r: 1 }, null)));
    t.ok(/off the battlefield/.test(W.deployRefusal(BR, b, 'p1', { c: 30, r: 11 }, null)));
    t.ok(/off the battlefield/.test(W.deployRefusal(BR, b, 'p1', null, null)));
    t.equal(W.deployRefusal(BR, b, 'p1', p2, null), 'That square is taken by Archers 2.');
    var water = BR.terrainForGrid(null, 22, 12);
    water.cells = water.cells.slice(0, 11 * 22) + 'x' + water.cells.slice(11 * 22 + 1);
    t.equal(W.deployRefusal(BR, b, 'p1', { c: 0, r: 11 }, water), 'Deep water: nobody can be set out there.');
    t.ok(/DM: adjust enemy/.test(W.deployRefusal(BR, b, 'e2', { c: 0, r: 0 }, null)), 'the enemy needs the DM override');
    t.equal(W.deployRefusal(BR, b, 'e2', { c: 0, r: 0 }, null, { dm: true }), '');
    t.ok(/on its own ground/.test(W.deployRefusal(BR, b, 'e2', { c: 0, r: 11 }, null, { dm: true })));
    var m = b.objective.markers[0];
    t.ok(/supplies clear/.test(W.deployRefusal(BR, b, 'e2', { c: m.c, r: m.r }, null, { dm: true })), 'never on the supplies');
  });

  test('rosters by group, and the scouts\' report of the enemy', function (t) {
    var b = battle();
    var mine = W.rosterGroups(b, 'player');
    t.same(mine.map(function (g) { return g.id + ':' + g.items.length; }), ['formation:2', 'leader:1']);
    t.equal(mine[1].name, 'Lieutenants');
    var theirs = W.rosterGroups(b, 'enemy');
    t.same(theirs.map(function (g) { return g.id + ':' + g.items.length; }), ['formation:3', 'leader:1']);
    t.equal(theirs[1].name, 'Captains');
    var intel = W.enemyIntel(b);
    t.same(intel.units.map(function (x) { return x.count + ' × ' + x.name; }), ['1 × Bacca Stoneguard', '2 × Line Infantry']);
    t.equal(intel.captains, 1);
    t.equal(intel.units[0].sample.id, 'e1');
    t.same(W.enemyIntel(null), { units: [], captains: 0 });
    t.same(W.rosterGroups(null, 'player'), []);
  });
  group('Bastion War Table: attacking a clicked enemy, the DM moving the objective, the briefing (3 October 2026)');

  /* A battle under way with units exactly where a test wants them. */
  function inBattle(objective, where) {
    var b = battle(objective);
    BR.beginDeployment(b, null);
    BR.startBattle(b);
    b.units.forEach(function (u) { u.pos = null; });
    Object.keys(where).forEach(function (id) { BR.unitById(b, id).pos = { c: where[id][0], r: where[id][1] }; });
    b.turnSide = 'player';
    return b;
  }
  function spotFor(b, id, tid) { return W.attackFrom(BR, b, id, tid, BR.reachable(b, id, 'advance', null), null, null, null); }

  test('attackFrom: any enemy, whether or not it has acted or been attacked: from where the unit stands if it can, else the best square in reach', function (t) {
    /* Harry couldn't attack an enemy that had moved next to his unit: the click only showed the enemy. */
    var b = inBattle('skirmish', { p1: [5, 8], e2: [5, 7], e3: [15, 2] });
    var e2 = BR.unitById(b, 'e2');
    e2.activated = true;
    e2.cohesion -= 1;
    t.same(spotFor(b, 'p1', 'e2'), { cell: { c: 5, r: 8 }, path: [{ c: 5, r: 8 }], kind: 'melee', charge: false, moved: false }, 'engaged: it fights where it stands');
    b = inBattle('skirmish', { p1: [5, 9], e2: [5, 6], e3: [15, 2] });
    var s = spotFor(b, 'p1', 'e2');
    t.same([s.cell, s.kind, s.moved, s.path.length], [{ c: 5, r: 7 }, 'melee', true, 3], 'straight ahead, next to it');
    b = inBattle('skirmish', { p2: [10, 11], e3: [10, 6], e2: [1, 0] });
    t.same([spotFor(b, 'p2', 'e3').kind, spotFor(b, 'p2', 'e3').moved], ['ranged', false], 'archers shoot from where they stand');
    b = inBattle('skirmish', { p2: [10, 11], e3: [10, 3], e2: [1, 0] });
    s = spotFor(b, 'p2', 'e3');
    t.same([s.kind, s.moved, BR.dist(s.cell, { c: 10, r: 3 }) <= 6], ['ranged', true, true], 'archers move into range rather than into melee');
    b = inBattle('skirmish', { p2: [10, 9], p1: [10, 7], e3: [10, 6], e2: [1, 0] });
    s = spotFor(b, 'p2', 'e3');
    t.same([s.kind, s.moved, BR.adjacent(s.cell, { c: 10, r: 6 })], ['melee', true, true], 'no shooting into a melee: hand to hand instead');
    b = inBattle('skirmish', { p1: [0, 11], e2: [21, 0], e3: [15, 2] });
    t.equal(spotFor(b, 'p1', 'e2'), null, 'out of reach');
    t.same(W.attackFrom(BR, b, 'p1', 'e2', null, { c: 20, r: 1 }, [{ c: 0, r: 11 }, { c: 20, r: 1 }], null).cell, { c: 20, r: 1 }, 'the square already chosen, when it will do');
  });

  test('noAttackText: why a clicked enemy can\'t be attacked, in plain English', function (t) {
    var b = inBattle('skirmish', { p1: [5, 8], e2: [5, 7], e3: [10, 3] });
    t.equal(W.noAttackText(BR, b, 'p1', 'e3'), 'Line Infantry 1 is fighting hand to hand, so it can only attack the enemies next to it. To go after Line Infantry 3, Disengage first.');
    b = inBattle('skirmish', { p2: [10, 11], p1: [10, 7], e3: [10, 6], e2: [1, 0] });
    t.equal(W.noAttackText(BR, b, 'p2', 'e3'), 'Archers 2 can\'t shoot into a melee: Line Infantry 3 is already fighting one of your units, and no square in reach lets Archers 2 fight it hand to hand.');
    b = inBattle('skirmish', { p2: [0, 11], e2: [21, 0], e3: [15, 2] });
    t.equal(W.noAttackText(BR, b, 'p2', 'e2'), 'Line Infantry 2 is out of reach: Archers 2 can\'t attack it this activation from any square it can reach (archers need it within 6 squares, with a clear line of sight).');
    b = inBattle('skirmish', { p1: [0, 11], e2: [21, 0], e3: [15, 2] });
    t.equal(W.noAttackText(BR, b, 'p1', 'e2'), 'Line Infantry 2 is out of reach: Line Infantry 1 can\'t attack it this activation from any square it can reach.');
  });

  test('noAttackText only suggests Disengage when it can be given, and only blames the melee when the archers could otherwise shoot', function (t) {
    /* Review (3 October 2026): a unit held fast by a Grapple was told to Disengage, which it can't. */
    var b = inBattle('skirmish', { p1: [5, 8], e2: [5, 7], e3: [10, 3] });
    BR.unitById(b, 'p1').heldFast = true;
    t.equal(BR.legalOrders(b, 'p1', null).filter(function (o) { return o.id === 'disengage'; })[0].ok, false);
    t.equal(W.noAttackText(BR, b, 'p1', 'e3', null), 'Line Infantry 1 is fighting hand to hand and can\'t Disengage this activation, so it can only attack the enemies next to it.');
    /* No clear square to fall back to: cliffs all round, bar the enemy's side. */
    b = inBattle('skirmish', { p1: [5, 8], e2: [5, 7], e3: [10, 3] });
    var cliffs = [];
    for (var c = 2; c <= 8; c++) for (var r = 6; r <= 11; r++) if (!(r === 8 && c === 5) && !(r === 7 && (c === 4 || c === 5 || c === 6))) cliffs.push({ c: c, r: r });
    var tt = W.paint(W.blankPainting(b.cols, b.rows), cliffs, 'k').painting;
    t.equal(BR.legalOrders(b, 'p1', tt).filter(function (o) { return o.id === 'disengage'; })[0].ok, false, 'boxed in');
    t.ok(/can't Disengage this activation/.test(W.noAttackText(BR, b, 'p1', 'e3', tt)));
    t.ok(/Disengage first\.$/.test(W.noAttackText(BR, b, 'p1', 'e3', null)), 'with open ground behind, it still says Disengage first');
    /* Archers far out of range: the reason is the distance, not the melee. */
    b = inBattle('skirmish', { p2: [2, 11], p1: [15, 4], e2: [15, 3], e3: [3, 0] });
    t.equal(W.noAttackText(BR, b, 'p2', 'e2', null), 'Line Infantry 2 is out of reach: Archers 2 can\'t attack it this activation from any square it can reach (archers need it within 6 squares, with a clear line of sight).');
    b = inBattle('skirmish', { p2: [10, 11], p1: [10, 7], e3: [10, 6], e2: [1, 0] });
    t.ok(/can't shoot into a melee/.test(W.noAttackText(BR, b, 'p2', 'e3', null)), 'within range: the melee is the reason');
  });

  test('attackFromText: what the table says when a click also chose the square to attack from', function (t) {
    var after = ' Click another lit square to attack from somewhere else, or Confirm.';
    t.equal(W.attackFromText(null, 'A', 'B', false), '');
    t.equal(W.attackFromText({ moved: false, kind: 'melee' }, 'A', 'B', false), '', 'from where it stands: the order card says it all');
    t.equal(W.attackFromText({ moved: true, kind: 'ranged' }, 'Archers 2', 'Bacca Cragmen', true), 'Archers 2 will move to the square shown and shoot at Bacca Cragmen.' + after);
    t.equal(W.attackFromText({ moved: true, kind: 'melee' }, 'Archers 2', 'Bacca Cragmen', true), 'Archers 2 can\'t shoot Bacca Cragmen from any square in reach, so it will advance next to it and fight hand to hand.' + after);
    t.equal(W.attackFromText({ moved: true, kind: 'melee', charge: true }, 'Light Cavalry 1', 'Bacca Cragmen', false), 'Light Cavalry 1 will charge Bacca Cragmen from the square shown.' + after);
    t.equal(W.attackFromText({ moved: true, kind: 'melee' }, 'Line Infantry 1', 'Bacca Cragmen', false), 'Line Infantry 1 will advance to the square shown and attack Bacca Cragmen.' + after);
  });

  test('objectiveMoveRefusal agrees with battleRules.canMoveObjective on every square, and says why', function (t) {
    function sweep(b, what, tt) {
      var bad = [];
      for (var r = -1; r <= b.rows; r++) {
        for (var c = -1; c <= b.cols; c++) {
          var why = W.objectiveMoveRefusal(BR, b, what, { c: c, r: r }, tt);
          if (!why !== BR.canMoveObjective(b, what, { c: c, r: r }, tt)) bad.push(c + ',' + r + ': ' + why);
        }
      }
      return bad;
    }
    var raid = battle('raid');
    BR.beginDeployment(raid, null);
    var tt = W.paint(W.blankPainting(raid.cols, raid.rows), [{ c: 3, r: 1 }, { c: 4, r: 1 }], 'x').painting;
    t.same(sweep(raid, { marker: 'm1' }, tt), []);
    t.equal(W.objectiveMoveRefusal(BR, raid, { marker: 'm1' }, { c: 3, r: 9 }, tt), 'The supplies stay on the enemy\'s ground, above the strip.');
    t.equal(W.objectiveMoveRefusal(BR, raid, { marker: 'm1' }, { c: 3, r: 1 }, tt), 'Deep water: the supplies can\'t go there.');
    var foe = raid.units.filter(function (u) { return u.side === 'enemy'; })[0];
    t.equal(W.objectiveMoveRefusal(BR, raid, { marker: 'm1' }, foe.pos, tt), 'That square is taken by ' + foe.label + '.');
    var m2 = raid.objective.markers[1];
    t.equal(W.objectiveMoveRefusal(BR, raid, { marker: 'm1' }, { c: m2.c, r: m2.r }, tt), 'Another supply marker is already there.');
    t.equal(W.objectiveMoveRefusal(BR, raid, { marker: 'm1' }, null, tt), 'That\'s off the battlefield.');
    ['defend', 'seize_outpost'].forEach(function (id) {
      var b = battle(id);
      BR.beginDeployment(b, null);
      t.same(sweep(b, { zone: true }, tt), [], id);
    });
    var d = battle('defend');
    BR.beginDeployment(d, null);
    t.equal(W.objectiveMoveRefusal(BR, d, { zone: true }, { c: 3, r: 1 }, null), 'Your supply depot stays on your ground, below the strip.');
    t.equal(W.objectiveMoveRefusal(BR, d, { zone: true }, { c: d.cols - 2, r: 8 }, null), 'Your supply depot would run off the battlefield.');
    var lake = W.paint(W.blankPainting(d.cols, d.rows), [8, 9, 10, 11].reduce(function (a, c) { return a.concat([{ c: c, r: 7 }, { c: c, r: 8 }]); }, []), 'x').painting;
    t.equal(W.objectiveMoveRefusal(BR, d, { zone: true }, { c: 8, r: 7 }, lake), 'Your supply depot needs at least one square troops can stand on.');
    var so = battle('seize_outpost');
    BR.beginDeployment(so, null);
    t.equal(W.objectiveMoveRefusal(BR, so, { zone: true }, { c: 3, r: 8 }, null), 'The outpost stays on the enemy\'s ground, above the strip.');
    var sk = battle('skirmish');
    BR.beginDeployment(sk, null);
    t.equal(W.objectiveMoveRefusal(BR, sk, { zone: true }, { c: 3, r: 8 }, null), 'That can\'t be moved.');
    BR.startBattle(so);
    t.equal(W.objectiveMoveRefusal(BR, so, { zone: true }, { c: 0, r: 0 }, null), 'The objective can only be moved while deploying.');
  });

  test('the DM\'s deployment button says what it lets the DM move', function (t) {
    t.same(['raid', 'defend', 'seize_outpost', 'skirmish', 'nope'].map(W.dmAdjustLabel),
      ['DM: adjust enemy & supplies', 'DM: adjust enemy & depot', 'DM: adjust enemy & outpost', 'DM: adjust enemy', 'DM: adjust enemy']);
  });

  test('the briefing: how this battle is won and lost, today\'s conditions and the rules in brief, with the numbers from the data', function (t) {
    var b = battle('raid');
    var r = W.briefing(b, D);
    t.equal(r.title, 'Rules & objective: Raid');
    t.same(r.sections.map(function (x) { return x.id; }), ['goal', 'lose', 'conditions', 'turns', 'orders', 'fighting', 'morale']);
    t.equal(r.sections[0].items[0], 'Carry off 2 of the 3 supply markers (the crates on the enemy\'s side) by the end of round 6.');
    t.ok(/Interact/.test(r.sections[0].items[1]) && /bottom row of the board/.test(r.sections[0].items[2]));
    t.same(r.sections[1].items, ['Round 6 ends with fewer than 2 carried off.', 'Your army breaks: 60% of its starting Battle Value routed or defeated. The battle is lost at once.']);
    t.same(r.sections[2].items, ['Weather: clear, so no effect.', 'Morale: no effect on Resolve checks.', 'Luck: +1 on all your attack rolls.']);
    t.ok(/^6 rounds\..*Your forces act first in round 1; the side that starts swaps each round\.$/.test(r.sections[3].items[0]), r.sections[3].items[0]);
    t.equal(r.sections[4].items.length, 6);
    t.equal(r.sections[4].items[0], 'Advance & Attack: ' + D.orders[0].text);
    t.ok(/A hit costs 1 Cohesion, 2 if it beats Defence by 5, 3 by 10\. A natural 1 misses; a natural 20 does 3\./.test(r.sections[5].items[0]), r.sections[5].items[0]);
    t.ok(/never while in melee or into a melee/.test(r.sections[5].items[3]));
    t.ok(/against 10\)\. Failing makes it Shaken: −2 Attack/.test(r.sections[6].items[0]));

    b.conditions = { weather: 'white_blizzard', moraleMod: -2, luckMod: -1 };
    b.firstSide = 'enemy';
    r = W.briefing(b, D);
    t.same(r.sections[2].items, ['Weather: Snowstorm: every unit moves 1 less (at least 1), for both armies.', 'Morale low: −2 on your units\' Resolve checks all battle.', 'Luck: −1 on all your attack rolls.']);
    t.ok(/The enemy acts first in round 1/.test(r.sections[3].items[0]));

    r = W.briefing(battle('defend'), D);
    t.equal(r.title, 'Rules & objective: Defend Bastion');
    t.same(r.sections[0].items, ['Keep the enemy off your supply depot (the dashed box on your side) until the end of round 6.', 'Or break the enemy army (60% of its Battle Value routed or defeated) to win at once.']);
    t.equal(r.sections[1].items[0], 'The enemy holds your depot at 2 round ends in a row: a Steady enemy unit inside, and none of yours.');
    r = W.briefing(battle('seize_outpost'), D);
    t.ok(/Hold it at 2 round ends in a row, by the end of round 6: a Steady unit of yours inside, and no enemy unit inside\./.test(r.sections[0].items[1]));
    r = W.briefing(battle('skirmish'), D);
    t.equal(r.sections[0].items[0], 'Break the enemy army: it breaks when 60% of its Battle Value has been routed or defeated.');
    t.same(W.briefing(null, D), { title: 'Rules & objective', sections: [] });
  });

  test('the briefing: Charge for cavalry and beasts, Hardy units and the weather, and turns once a side has left the field', function (t) {
    /* Review (3 October 2026). */
    var r = W.briefing(battle('skirmish'), D);
    t.ok(/cavalry and beasts with Charge \(such as the Lion\)/.test(r.sections[5].items[2]), r.sections[5].items[2]);
    t.ok(D.beasts.Lion.trait === 'charge', 'the Lion has Charge');
    var karr = BR.createBattle({
      player: { units: [U('p1', 'line')], leaders: [] },
      enemy: { units: [U('e1', 'line', { name: 'Karr Shieldbearers', label: 'Karr Shieldbearers', variant: { id: 'karr_shieldbearers', name: 'Karr Shieldbearers', trait: 'hardy' } })], leaders: [] },
      objective: 'skirmish',
      conditions: { weather: 'white_blizzard', moraleMod: 0, luckMod: 0 }
    }, null);
    t.ok(BR.hasTrait(BR.unitById(karr, 'e1'), 'hardy'));
    t.equal(W.briefing(karr, D).sections[2].items[0], 'Weather: Snowstorm: every unit moves 1 less (at least 1), for both armies; Hardy units ignore it.');
    karr.conditions.weather = 'clear';
    t.equal(W.briefing(karr, D).sections[2].items[0], 'Weather: clear, so no effect.');
    /* The enemy has broken and withdrawn from a raid: you take every turn. */
    var b = inBattle('raid', { p1: [5, 9], p2: [6, 9] });
    b.round = 2;
    b.firstSide = 'enemy';
    b.started = true;
    var turns = W.briefing(b, D).sections[3].items[0];
    t.ok(/The enemy has left the field, so your forces take every turn\.$/.test(turns), turns);
    t.ok(!/The enemy acts first/.test(turns));
    b = inBattle('raid', { p1: [5, 9], e2: [6, 2] });
    b.firstSide = 'enemy';
    t.ok(/The enemy acts first in round 1/.test(W.briefing(b, D).sections[3].items[0]), 'both sides on the field: as before');
  });
}());
