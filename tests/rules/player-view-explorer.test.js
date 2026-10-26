/* The Explorer's Player View (26 October 2026; docs/PLAYER-VIEW-PLAN.md, phase P4): the snapshot the TV is sent
   (tools/explorer/player-view-rules.js) holds what the players may see and nothing else. */
(function () {
  var R = TSI.explorer.rules;
  var D = window.TSI_DATA.explorer;

  /* A busy Explorer, full of things the players must not see. */
  function busy() {
    var s = R.defaultState(D);
    R.loadPreset(s, D, 'the_east_isle');
    s.travel.day = 5;
    s.tokens[0].milesUsed = 12;
    s.tokens[1].milesUsed = 12;
    s.journey.gold = 75;
    s.journey.log = ['ZZLOG one'];
    s.journey.effects = [{ id: 'e1', name: 'ZZEFFECT', whoName: 'ZZWHO' }];
    s.journey.threads = [{ id: 't1', name: 'ZZTHREAD' }];
    s.journey.inventory = [{ id: 'i1', kind: 'ZZBAG', qty: 3 }];
    s.journey.outbox = [{ id: 'm1', text: 'ZZOUTBOX' }];
    s.journey.current = { id: 'ZZCURRENT' };
    s.journey.tonight = { id: 'ZZTONIGHT' };
    s.dmDoc = { text: 'ZZDMDOC' };
    s.notes = 'ZZNOTES';
    return s;
  }
  function snap(s) { return R.playerSnapshot(s, D); }

  group('Explorer Player View: the snapshot');

  test('holds the day, one Daily Travel figure out of the limit, and the Gold purse', function (t) {
    var s = snap(busy());
    t.same([s.v, s.day, s.miles, s.limit, s.gold], [1, 5, 12, 30, 75]);
  });

  test('Daily Travel follows the daily limit, a chart\'s extra miles included, and caps at the limit', function (t) {
    var b = busy();
    b.travel.extraMiles = 6;
    t.equal(snap(b).limit, 36);
    b.tokens[0].milesUsed = 40;
    t.equal(snap(b).miles, 36, 'never above the limit');
  });

  test('the map: a preset is a path inside the suite; an upload is only a key (the picture is sent apart)', function (t) {
    var b = busy();
    var s = snap(b);
    t.equal(s.map.kind, 'preset');
    t.equal(s.map.src, R.preset(D, 'the_east_isle').src);
    t.equal(s.board.w, R.BOARD_W);
    b.mapPresetId = null; b.mapUploadKey = 'abc123'; b.mapAspect = 2;
    var u = snap(b);
    t.same([u.map.kind, u.map.src, u.map.key], ['upload', '', 'upload:abc123']);
    t.equal(u.board.h, R.BOARD_W / 2);
    var none = R.defaultState(D);
    t.equal(snap(none).map.kind, 'none');
  });

  test('the grid is exactly as the DM set it', function (t) {
    var b = busy();
    b.grid = { enabled: true, r: 50, offsetX: 7, offsetY: -3, opacity: 0.8 };
    t.same(snap(b).grid, { enabled: true, r: 50, offsetX: 7, offsetY: -3, opacity: 0.8 });
    b.grid.enabled = false;
    t.equal(snap(b).grid.enabled, false);
  });

  test('the fog: the uncovered hexes of this map only, and none when fog is off', function (t) {
    var b = busy();
    b.fog.enabled = true;
    R.reveal(b, { q: 3, r: 4 }, 1);
    var s = snap(b);
    t.ok(s.fog.enabled);
    t.equal(s.fog.hexes.length, R.revealedCount(b));
    t.ok(s.fog.hexes.indexOf('3,4') !== -1);
    b.fog.enabled = false;
    t.same(snap(b).fog, { enabled: false, hexes: [] });
  });

  test('the pins are the DM\'s visible markers, with no descriptions', function (t) {
    var b = busy();
    var s = snap(b);
    var want = R.visibleMarkers(b, D, R.board(R.aspect(b, D))).map(function (m) { return m.id; });
    t.same(s.markers.map(function (m) { return m.id; }), want);
    t.ok(want.length > 0, 'the East Isle has pins');
    t.same(Object.keys(s.markers[0]).sort(), ['id', 'label', 'thumb', 'x', 'y']);
  });

  test('the heroes are where the DM draws them (R.layoutTokens), in board units', function (t) {
    var b = busy();
    b.snap.enabled = true;
    R.snapAll(b, R.board(R.aspect(b, D)));
    var board = R.board(R.aspect(b, D));
    var spots = R.layoutTokens(b, board, null);
    var s = snap(b);
    t.equal(s.tokens.length, b.tokens.length);
    s.tokens.forEach(function (tk, i) {
      t.same([tk.id, tk.x, tk.y, tk.size, tk.initial], [b.tokens[i].id, spots[tk.id].x, spots[tk.id].y, b.tokens[i].size, b.tokens[i].initial]);
    });
  });

  test('today\'s weather video is sent, and read without changing the save', function (t) {
    var b = busy();
    var kind = Object.keys(D.weatherVideos)[0];
    b.travel.activeWeather = { kind: kind, day: 5 };
    t.equal(snap(b).weather, D.weatherVideos[kind]);
    b.travel.activeWeather = { kind: kind, day: 4 };
    t.equal(snap(b).weather, null);
    t.ok(b.travel.activeWeather, 'the save is left alone');
  });

  group('Explorer Player View: nothing DM-only leaks');

  test('no notes, bags, log, effects, threads, outbox, event in progress or DM doc anywhere in the snapshot', function (t) {
    var json = JSON.stringify(snap(busy()));
    ['ZZLOG', 'ZZEFFECT', 'ZZWHO', 'ZZTHREAD', 'ZZBAG', 'ZZOUTBOX', 'ZZCURRENT', 'ZZTONIGHT', 'ZZDMDOC', 'ZZNOTES'].forEach(function (word) {
      t.ok(json.indexOf(word) === -1, word + ' is not in the snapshot');
    });
  });

  test('the snapshot has only the listed top-level fields, and survives a structured clone shape (plain JSON)', function (t) {
    var s = snap(busy());
    t.same(Object.keys(s).sort(), ['board', 'day', 'fog', 'gold', 'grid', 'limit', 'map', 'markers', 'miles', 'pin', 'dim', 'camp', 'tokens', 'v', 'weather'].sort());
    t.same(JSON.parse(JSON.stringify(s)), s);
  });

  test('an open pin card sends only its name, picture and description, looked up by id', function (t) {
    var b = busy();
    var m = D.markersByMapId.the_east_isle[0];
    var s = R.playerSnapshot(b, D, { pin: m.id });
    t.same(Object.keys(s.pin).sort(), ['description', 'id', 'image', 'label']);
    t.same([s.pin.id, s.pin.label, s.pin.image], [m.id, m.label, m.submapImage]);
    t.equal(R.playerSnapshot(b, D, {}).pin, null);
    t.equal(R.playerSnapshot(b, D, { pin: 'nope' }).pin, null, 'an unknown id sends nothing');
    t.equal(R.playerSnapshot(b, D, { pin: { label: 'ZZPINJUNK', description: 'ZZPINDESC' } }).pin, null, 'only an id is taken, never the DM\'s own text');
    var json = JSON.stringify(s);
    t.ok(json.indexOf('ZZ') === -1);
  });

  test('dim and camp: only the known words and a whole count get through', function (t) {
    var b = busy();
    t.same([R.playerSnapshot(b, D, { dim: 'event', camp: 3 }).dim, R.playerSnapshot(b, D, { dim: 'event', camp: 3 }).camp], ['event', 3]);
    t.equal(R.playerSnapshot(b, D, { dim: 'night' }).dim, 'night');
    t.equal(R.playerSnapshot(b, D, { dim: 'ZZ' }).dim, 'none');
    t.equal(R.playerSnapshot(b, D, { camp: -2 }).camp, 0);
    t.equal(R.playerSnapshot(b, D).dim, 'none');
  });

  test('building a snapshot changes nothing in the state', function (t) {
    var b = busy();
    var before = JSON.stringify(b);
    snap(b);
    t.equal(JSON.stringify(b), before);
  });
}());
