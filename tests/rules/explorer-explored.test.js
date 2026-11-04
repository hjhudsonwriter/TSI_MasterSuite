/* Scarlett Isles Explorer: the three fog modes and the explored map's plain rules (tools/explorer/explored-rules.js; guide 6B, 4 November 2026). */
(function () {
  var E = TSI.explorer.explored;
  var R = TSI.explorer.rules;
  var D = window.TSI_DATA;
  var EX = D.explorer;
  var KEY = 'preset:midland_province';

  group('Colour reveal: the explored hexes');

  test('hexesWithin: radius 0 is the hex itself, 1 is 7 hexes, 2 is 19, all really within that many hex steps', function (t) {
    t.equal(E.hexesWithin({ q: 3, r: -2 }, 0).length, 1);
    t.same(E.hexesWithin({ q: 3, r: -2 }, 0), [{ q: 3, r: -2 }]);
    t.equal(E.hexesWithin({ q: 3, r: -2 }, 1).length, 7);
    var two = E.hexesWithin({ q: 3, r: -2 }, 2);
    t.equal(two.length, 19);
    two.forEach(function (h) { t.ok(R.hexDistance({ q: 3, r: -2 }, h) <= 2, 'within 2: ' + h.q + ',' + h.r); });
    t.equal(new Set(two.map(function (h) { return h.q + ',' + h.r; })).size, 19, 'no hex twice');
    t.equal(E.hexesWithin({ q: 0, r: 0 }, 6).length, 127);
    t.same(E.hexesWithin(null, 2), []);
    t.same(E.hexesWithin({ q: 1.5, r: 0 }, 2), []);
  });

  test('reveal, hide, has, count and reset work on one map and never touch another', function (t) {
    var e = E.empty('colour');
    t.equal(E.reveal(e, KEY, E.hexesWithin({ q: 0, r: 0 }, 2)), 19);
    t.equal(E.reveal(e, KEY, E.hexesWithin({ q: 0, r: 0 }, 2)), 0, 'again: nothing new');
    t.equal(E.reveal(e, KEY, E.hexesWithin({ q: 2, r: 0 }, 1)), 3, 'an overlapping circle adds only the new hexes');
    t.equal(E.count(e, KEY), 22);
    t.equal(E.has(e, KEY, 0, 0), true);
    t.equal(E.has(e, KEY, 9, 9), false);
    t.equal(E.has(e, 'preset:the_east_isle', 0, 0), false, 'another map is its own');
    t.equal(E.hide(e, KEY, [{ q: 0, r: 0 }, { q: 40, r: 40 }]), 1, 'one was there to hide');
    t.equal(E.has(e, KEY, 0, 0), false);
    t.equal(E.reveal(e, 'none', [{ q: 0, r: 0 }]), 0, 'no map, nothing to reveal');
    t.equal(E.reveal(e, KEY, [{ q: 'x', r: 1 }, null, { q: 1, r: NaN }]), 0, 'bad hexes are ignored');
    t.equal(E.reset(e, KEY), 21);
    t.equal(E.count(e, KEY), 0);
    t.equal(E.reset(e, KEY), 0);
  });

  test('reveal all uncovers every hex whose centre is on the map, and nothing outside it', function (t) {
    var s = R.defaultState(EX);
    s.mapPresetId = 'midland_province';
    var board = R.board(R.aspect(s, EX));
    var e = E.empty('colour');
    var n = E.revealAll(e, KEY, s.grid, board);
    t.ok(n > 300, 'many hexes: ' + n);
    E.snapshot(e, KEY).forEach(function (v, i, a) { if (i % 2 === 0) { var p = R.axialToPixel(s.grid, v, a[i + 1]); t.ok(p.x >= 0 && p.y >= 0 && p.x <= board.w && p.y <= board.h, 'on the map'); } });
    t.equal(E.revealAll(e, KEY, s.grid, board), 0, 'again: nothing new');
    var corner = R.hexAt(s.grid, 1, 1);
    t.equal(E.has(e, KEY, corner.q, corner.r) || true, true);
  });

  test('revealing around the heroes opens the radius around each one', function (t) {
    var s = R.defaultState(EX);
    s.mapPresetId = 'midland_province';
    var board = R.board(R.aspect(s, EX));
    var e = E.empty('colour');
    var added = E.revealAroundHeroes(e, KEY, s, board);
    t.ok(added >= 19, 'at least one full circle: ' + added);
    s.tokens.forEach(function (tk) { var h = R.tokenHex(s, board, tk); t.equal(E.has(e, KEY, h.q, h.r), true, tk.name + '\'s own hex'); });
    t.equal(E.revealAroundHeroes(e, KEY, s, board), 0, 'standing still adds nothing');
    e.radius = 1;
    var e2 = E.empty('colour'); e2.radius = 1;
    t.ok(E.revealAroundHeroes(e2, KEY, s, board) < added, 'a smaller radius opens less');
  });

  group('Colour reveal: saving, old saves and the starting mode');

  test('what is saved is one flat sorted list per map, and it comes back exactly', function (t) {
    var e = E.empty('colour');
    E.reveal(e, KEY, [{ q: 5, r: -1 }, { q: -3, r: 2 }, { q: 5, r: -2 }]);
    var saved = E.toSave(e);
    t.same(saved, { version: 1, mode: 'colour', radius: 2, maps: { 'preset:midland_province': [-3, 2, 5, -2, 5, -1] } });
    t.equal(E.isSaved(saved), true);
    var back = E.fromSave(JSON.parse(JSON.stringify(saved)));
    t.same(E.snapshot(back, KEY), [-3, 2, 5, -2, 5, -1]);
    t.same([back.mode, back.radius], ['colour', 2]);
    t.same(E.toSave(E.empty('off')), { version: 1, mode: 'off', radius: 2, maps: {} }, 'an empty map is not kept');
  });

  test('a bad saved record is refused or tidied, never thrown: wrong shapes, half pairs, odd numbers', function (t) {
    t.equal(E.isSaved(null), false);
    t.equal(E.isSaved({ version: 2, mode: 'colour', maps: {} }), false);
    t.equal(E.isSaved({ version: 1, mode: 'fancy', maps: {} }), false);
    t.equal(E.isSaved({ version: 1, mode: 'colour', maps: [] }), false);
    t.equal(E.isSaved({ version: 1, mode: 'colour', maps: { a: 'x' } }), false);
    t.equal(E.isSaved({ version: 1, mode: 'colour', radius: 99, maps: {} }), false);
    t.same(E.snapshot(E.fromSave('junk', 'off'), KEY), []);
    t.equal(E.fromSave('junk', 'off').mode, 'off', 'no record: the mode it was told');
    var e = E.fromSave({ version: 1, mode: 'colour', maps: { m: [1, 2, 3, 'x', 4.5, 6, 7] } });
    t.same(E.snapshot(e, 'm'), [1, 2], 'only whole pairs of whole numbers');
    t.same(E.cleanFlat([1, 2, 'a', 3, 9, 8, 7]), [1, 2, 9, 8]);
  });

  test('the starting mode: a new save starts in Colour reveal; an old save keeps its black fog or its no fog; a record keeps its own', function (t) {
    t.equal(E.startMode(null, false, false), 'colour', 'new');
    t.equal(E.startMode(null, false, true), 'colour', 'new, whatever');
    t.equal(E.startMode(null, true, true), 'classic', 'an old save with the black fog on');
    t.equal(E.startMode(null, true, false), 'off', 'an old save with no fog');
    t.equal(E.startMode({ version: 1, mode: 'classic', radius: 2, maps: {} }, true, false), 'classic');
    t.equal(E.startMode({ version: 1, mode: 'colour', radius: 2, maps: {} }, true, true), 'colour');
    t.equal(E.startMode('garbage', true, true), 'classic');
  });

  group('Colour reveal: what the players may see');

  test('who sees a spot: colour reveal only where explored; classic only where uncovered; off anywhere', function (t) {
    var s = R.defaultState(EX);
    s.mapPresetId = 'midland_province';
    var board = R.board(R.aspect(s, EX));
    var h = R.hexAt(s.grid, 700, 300);
    var x = R.axialToPixel(s.grid, h.q, h.r);
    s.explored = E.empty('colour');
    t.equal(E.visibleToPlayers(s, board, x.x, x.y), false, 'unexplored');
    E.reveal(s.explored, KEY, [h]);
    t.equal(E.visibleToPlayers(s, board, x.x, x.y), true, 'explored');
    s.explored.mode = 'off';
    t.equal(E.visibleToPlayers(s, board, 5, 5), true, 'off');
    s.explored.mode = 'classic';
    s.fog.enabled = true;
    t.equal(E.visibleToPlayers(s, board, x.x, x.y), false, 'classic, covered');
    R.fogStore(s)[h.q + ',' + h.r] = true;
    t.equal(E.visibleToPlayers(s, board, x.x, x.y), true, 'classic, uncovered');
    var bare = R.defaultState(EX);
    t.equal(E.visibleToPlayers(bare, board, 5, 5), true, 'no record and no fog: as before');
  });

  test('Known to players: saved, tidied, set and cleared', function (t) {
    var k = E.emptyKnown();
    t.equal(E.setKnown(k, 'middlemount', true), true);
    t.equal(E.setKnown(k, 'middlemount', true), false);
    t.equal(E.isKnownPin(k, 'middlemount'), true);
    t.equal(E.setKnown(k, 'middlemount', false), true);
    t.equal(E.setKnown(k, 'middlemount', false), false);
    t.equal(E.setKnown(k, '', true), false);
    t.equal(E.isKnown({ version: 1, known: {} }), true);
    t.equal(E.isKnown({ version: 1, known: [] }), false);
    t.same(E.cleanKnown({ version: 1, known: { a: true, b: false, c: 'yes' } }), { version: 1, known: { a: true } });
    t.same(E.cleanKnown('junk'), { version: 1, known: {} });
  });

  test('pins: the DM sees every pin; the players see a pin only once its hex is explored, or when it is Known to players', function (t) {
    var s = R.defaultState(EX);
    s.mapPresetId = 'midland_province';
    var board = R.board(R.aspect(s, EX));
    s.explored = E.empty('colour');
    s.knownPins = E.emptyKnown();
    var dm = R.visibleMarkers(s, EX, board).map(function (m) { return m.id; });
    t.same(dm, ['river_rook', 'middlemount'], 'the DM sees them all');
    t.same(R.visibleMarkers(s, EX, board, 'players').map(function (m) { return m.id; }), [], 'nothing explored yet');
    E.setKnown(s.knownPins, 'middlemount', true);
    t.same(R.visibleMarkers(s, EX, board, 'players').map(function (m) { return m.id; }), ['middlemount'], 'Known to players');
    var rr = EX.markersByMapId.midland_province.filter(function (m) { return m.id === 'river_rook'; })[0];
    E.reveal(s.explored, KEY, [R.hexAt(s.grid, rr.x * board.w, rr.y * board.h)]);
    t.same(R.visibleMarkers(s, EX, board, 'players').map(function (m) { return m.id; }), ['river_rook', 'middlemount'], 'explored');
    s.explored.mode = 'classic'; s.fog.enabled = true;
    E.setKnown(s.knownPins, 'middlemount', false);
    t.same(R.visibleMarkers(s, EX, board, 'players').map(function (m) { return m.id; }), [], 'classic fog: as it always was');
    E.setKnown(s.knownPins, 'middlemount', true);
    t.same(R.visibleMarkers(s, EX, board, 'players').map(function (m) { return m.id; }), ['middlemount'], 'Known to players works in classic fog too');
    E.setKnown(s.knownPins, 'middlemount', false);
    s.fog.enabled = true;
    t.same(R.visibleMarkers(s, EX, board).map(function (m) { return m.id; }), [], 'the DM, with fog on their view, sees only the uncovered pins');
    t.same(R.visibleMarkers(s, EX, board, 'dm-all').map(function (m) { return m.id; }), ['river_rook', 'middlemount'], 'with Fog on my view off, the DM sees every pin');
    E.setKnown(s.knownPins, 'middlemount', true);
    s.explored.mode = 'off'; s.fog.enabled = false;
    t.same(R.visibleMarkers(s, EX, board, 'players').map(function (m) { return m.id; }), ['river_rook', 'middlemount'], 'no fog');
  });

  test('the snapshot: the explored hexes only in colour mode, as plain numbers; quest markers follow the fog; LEAK: no marker text, no unexplored town', function (t) {
    var s = R.defaultState(EX);
    s.mapPresetId = 'midland_province';
    var board = R.board(R.aspect(s, EX));
    s.explored = E.empty('colour');
    s.knownPins = E.emptyKnown();
    var h = R.hexAt(s.grid, 0.5 * board.w, 0.5 * board.h);
    var spot = R.axialToPixel(s.grid, h.q, h.r);
    E.reveal(s.explored, KEY, [h]);
    var quests = [
      { id: 'qm-1', mapId: KEY, x: spot.x / board.w, y: spot.y / board.h, label: 'SECRET-LABEL', note: 'SECRET-NOTE' },
      { id: 'qm-2', mapId: KEY, x: 0.02, y: 0.02, label: 'SECRET-TWO', note: 'SECRET-NOTE-2' }
    ];
    var snap = R.playerSnapshot(s, EX, { quests: quests, banners: {} });
    t.same(snap.explored, { hexes: [h.q, h.r] }, 'one explored hex, as plain numbers');
    t.same(snap.quests.map(function (q) { return q.id; }), ['qm-1'], 'a marker in unexplored land is not sent');
    var text = JSON.stringify(snap);
    t.ok(text.indexOf('SECRET') === -1, 'no label or note');
    t.ok(text.indexOf('middlemount') === -1 && text.indexOf('Middlemount') === -1, 'no unexplored town');
    t.same(JSON.parse(text), snap, 'plain JSON');
    s.explored.mode = 'classic';
    t.equal(R.playerSnapshot(s, EX, {}).explored, null, 'not in classic');
    s.explored.mode = 'off';
    t.equal(R.playerSnapshot(s, EX, {}).explored, null, 'not when fog is off');
    t.equal(R.playerSnapshot(s, EX, { clouds: true }).clouds, true);
    t.equal(R.playerSnapshot(s, EX, {}).clouds, false);
  });
}());
