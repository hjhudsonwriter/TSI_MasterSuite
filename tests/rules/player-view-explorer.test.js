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
    t.same(Object.keys(s).sort(), ['board', 'day', 'fog', 'gold', 'grid', 'limit', 'map', 'markers', 'miles', 'pin', 'dim', 'camp', 'atlas', 'scene', 'tokens', 'word', 'v', 'view', 'weather'].sort());
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

  test('the view: the whole map by default; a region from the DM is sent as fractions; nonsense falls back to the whole map', function (t) {
    var b = busy();
    t.same(R.playerSnapshot(b, D).view, { x0: 0, y0: 0, x1: 1, y1: 1 });
    t.same(R.playerSnapshot(b, D, { view: { x0: 0.25, y0: 0.1, x1: 0.75, y1: 0.6 } }).view, { x0: 0.25, y0: 0.1, x1: 0.75, y1: 0.6 });
    ['ZZ', { x0: 0.6, y0: 0, x1: 0.5, y1: 1 }, { x0: -1, y0: 0, x1: 1, y1: 1 }, { x0: 0, y0: 0, x1: 'a', y1: 1 }].forEach(function (bad) {
      t.same(R.playerSnapshot(b, D, { view: bad }).view, { x0: 0, y0: 0, x1: 1, y1: 1 });
    });
  });

  test('the Scarlett Isles map flag is only ever true or false (true only when the DM said true), and carries no picture', function (t) {
    var b = busy();
    t.equal(R.playerSnapshot(b, D).atlas, false);
    t.equal(R.playerSnapshot(b, D, { atlas: true }).atlas, true);
    ['yes', 1, {}, null].forEach(function (v) { t.equal(R.playerSnapshot(b, D, { atlas: v }).atlas, false); });
    t.ok(JSON.stringify(R.playerSnapshot(b, D, { atlas: true })).indexOf('scarlett-isles-map') === -1, 'the picture is the window\'s own file');
  });

  test('building a snapshot changes nothing in the state', function (t) {
    var b = busy();
    var before = JSON.stringify(b);
    snap(b);
    t.equal(JSON.stringify(b), before);
  });

  group('Explorer zoom and pan');

  var board = R.board(4 / 3);
  var W = 1200, H = 700;
  function near(a, b) { return Math.abs(a - b) < 1e-6; }

  test('zoom 1 is the whole map fitted and centred, exactly as R.view', function (t) {
    var v = R.zoomView(W, H, board, 1, 0.9, 0.1);
    var base = R.view(W, H, board);
    t.same([v.fit, v.ox, v.oy], [base.fit, base.ox, base.oy]);
  });

  test('zoomed in, the map fills the area and its edges stop at the area\'s edges', function (t) {
    var v = R.zoomView(W, H, board, 3, 0, 0);
    t.ok(near(v.ox, 0) && near(v.oy, 0), 'top left corner stops at the corner');
    var e = R.zoomView(W, H, board, 3, 1, 1);
    t.ok(near(e.ox + board.w * e.fit, W) && near(e.oy + board.h * e.fit, H), 'bottom right corner stops at the corner');
    t.equal(R.zoomView(W, H, board, 99, 0.5, 0.5).zoom, R.ZOOM_MAX);
    t.equal(R.zoomView(W, H, board, 0.2, 0.5, 0.5).zoom, 1);
  });

  test('zooming around the pointer keeps the map point under the pointer where it was', function (t) {
    var v = R.zoomView(W, H, board, 1, 0.5, 0.5);
    var sx = 700, sy = 300;
    var before = R.toBoard(v, sx, sy);
    var r = R.zoomAround(v, W, H, board, 2.5, sx, sy);
    var v2 = R.zoomView(W, H, board, r.zoom, r.cx, r.cy);
    var after = R.toBoard(v2, sx, sy);
    t.ok(Math.abs(before.x - after.x) < 0.01 && Math.abs(before.y - after.y) < 0.01, JSON.stringify([before, after]));
    t.equal(v2.zoom, 2.5);
  });

  test('panning slides the map and is clamped; at zoom 1 there is nothing to pan', function (t) {
    var v = R.zoomView(W, H, board, 2, 0.5, 0.5);
    var r = R.panBy(v, W, H, board, -100, -50);
    var v2 = R.zoomView(W, H, board, r.zoom, r.cx, r.cy);
    t.ok(near(v2.ox, v.ox - 100) && near(v2.oy, v.oy - 50));
    var far = R.panBy(v, W, H, board, 99999, 99999);
    var v3 = R.zoomView(W, H, board, far.zoom, far.cx, far.cy);
    t.ok(near(v3.ox, 0) && near(v3.oy, 0), 'cannot leave the area');
    var one = R.zoomView(W, H, board, 1, 0.5, 0.5);
    var p = R.panBy(one, W, H, board, 80, 80);
    var v4 = R.zoomView(W, H, board, p.zoom, p.cx, p.cy);
    t.same([v4.ox, v4.oy], [one.ox, one.oy]);
  });

  test('the visible region is the whole map at zoom 1 in any window shape, and the real region when zoomed', function (t) {
    [[1200, 700], [900, 900], [1920, 1080], [500, 1000]].forEach(function (sz) {
      var v = R.zoomView(sz[0], sz[1], board, 1, 0.5, 0.5);
      var r = R.visibleRegion(v, sz[0], sz[1], board);
      t.ok(near(r.x0, 0) && near(r.y0, 0) && near(r.x1, 1) && near(r.y1, 1), sz.join('x'));
    });
    var v = R.zoomView(W, H, board, 2, 0.5, 0.5);
    var r = R.visibleRegion(v, W, H, board);
    t.ok(near((r.x0 + r.x1) / 2, 0.5) && near((r.y0 + r.y1) / 2, 0.5));
    t.ok(r.x1 - r.x0 < 1 && r.y1 - r.y0 < 1);
  });

  test('the players\' window shows the same region in its own shape: the region is fully in view, centred, and the whole map at zoom 1 looks as before', function (t) {
    var whole = R.regionView({ x0: 0, y0: 0, x1: 1, y1: 1 }, 1920, 1080, board);
    var base = R.view(1920, 1080, board);
    t.same([whole.fit, whole.ox, whole.oy], [base.fit, base.ox, base.oy]);
    var region = { x0: 0.2, y0: 0.3, x1: 0.5, y1: 0.55 };
    [[1920, 1080], [900, 900], [1707, 930]].forEach(function (sz) {
      var rv = R.regionView(region, sz[0], sz[1], board);
      var a = R.toScreen(rv, region.x0 * board.w, region.y0 * board.h), b = R.toScreen(rv, region.x1 * board.w, region.y1 * board.h);
      t.ok(a.x >= -0.01 && a.y >= -0.01 && b.x <= sz[0] + 0.01 && b.y <= sz[1] + 0.01, 'inside ' + sz.join('x'));
      t.ok(near((a.x + b.x) / 2, sz[0] / 2) && near((a.y + b.y) / 2, sz[1] / 2), 'centred ' + sz.join('x'));
    });
    t.same(R.regionView({ x0: 0.6, y0: 0, x1: 0.5, y1: 1 }, 800, 600, board), R.regionView({ x0: 0, y0: 0, x1: 1, y1: 1 }, 800, 600, board));
  });

  group('Explorer Player View: scene cards (the Absent Tide)');

  var CARD = {
    kind: 'portrait', src: 'tools/explorer/assets/absent-tide/portraits/seris-thane.png', poster: '', loop: false,
    name: 'Captain Seris Thane', caption: '', overlays: [{ text: 'Do not trust yesterday.', x: 40, y: 30, w: 30, size: 3, rotate: -4, align: 'left' }], subtitle: '',
    dmNote: 'ZZDMNOTE', line: 'ZZVOICELINE', voice: 'tools/explorer/assets/absent-tide/voice/seris-thane.mp3', steps: ['ZZSTEPLIST'], next: 'tools/explorer/assets/absent-tide/act4/ZZOTHERCARD.png'
  };

  test('with no card the scene is null', function (t) {
    t.equal(R.playerSnapshot(busy(), D, {}).scene, null);
    t.equal(R.playerSnapshot(busy(), D, { scene: null }).scene, null);
    t.equal(R.playerSnapshot(busy(), D, { scene: { kind: 'image' } }).scene, null, 'a card with no picture is nothing');
  });

  test('a card holds only src, poster, loop, name, caption, overlays and subtitle', function (t) {
    var sc = R.playerSnapshot(busy(), D, { scene: CARD }).scene;
    t.same(Object.keys(sc).sort(), ['caption', 'kind', 'loop', 'name', 'overlays', 'poster', 'src', 'subtitle']);
    t.equal(sc.name, 'Captain Seris Thane');
    t.equal(sc.kind, 'portrait');
    t.same(Object.keys(sc.overlays[0]).sort(), ['align', 'rotate', 'size', 'text', 'w', 'x', 'y']);
    t.equal(sc.subtitle, '', 'no subtitle unless the card switches it on');
  });

  test('the DM\'s note, the voice line and file, the other cards and the step list never reach the snapshot', function (t) {
    var json = JSON.stringify(R.playerSnapshot(busy(), D, { scene: CARD }));
    ['ZZDMNOTE', 'ZZVOICELINE', 'seris-thane.mp3', 'voice/', 'ZZSTEPLIST', 'ZZOTHERCARD', 'dmNote', 'steps'].forEach(function (w) {
      t.ok(json.indexOf(w) < 0, 'the snapshot must not contain ' + w);
    });
    t.ok(json.indexOf('seris-thane.png') >= 0, 'the one picture on screen is there');
  });

  test('a subtitle appears only when the card carries one, and the rest of the snapshot is unchanged', function (t) {
    var on = R.playerSnapshot(busy(), D, { scene: Object.assign({}, CARD, { subtitle: 'Said aloud.' }) });
    t.equal(on.scene.subtitle, 'Said aloud.');
    var off = R.playerSnapshot(busy(), D, {});
    t.equal(off.v, 1);
    t.equal(off.dim, 'none');
  });

  test('overlays are tidied: at most eight, text only, numbers kept sane', function (t) {
    var many = []; for (var i = 0; i < 12; i++) many.push({ text: 'n' + i, x: 10, y: 10, w: 20, size: 2, rotate: 0, align: 'center' });
    many.push({ text: '' });
    var sc = R.cleanScene({ kind: 'image', src: 'a.png', overlays: many.concat([{ text: 'odd', x: 'left', align: 'weird' }]) });
    t.equal(sc.overlays.length, 8);
    var odd = R.cleanScene({ kind: 'image', src: 'a.png', overlays: [{ text: 'odd', x: 'left', align: 'weird' }] }).overlays[0];
    t.equal(odd.x, 50);
    t.equal(odd.align, 'center');
  });

  group('Absent Tide scene decks (data and the cards the players are sent)');

  var DECKS = D.mainEvents.filter(function (e) { return e.deck; });

  test('there are four decks, ids unique and starting absent_tide_, after the two older main events', function (t) {
    t.same(DECKS.map(function (d) { return d.id; }), ['absent_tide_act1', 'absent_tide_act2', 'absent_tide_act4', 'absent_tide_act5']);
    var ids = D.mainEvents.map(function (e) { return e.id; });
    t.equal(ids.length, new Set(ids).size);
    t.same(ids.slice(0, 2), ['tide_remembers_prologue', 'turning_tide']);
    DECKS.forEach(function (d) { t.ok(/^absent_tide_/.test(d.id), d.id); });
  });

  test('every card has a picture or a clip, and card ids are unique in their deck', function (t) {
    DECKS.forEach(function (d) {
      t.ok(d.steps.length > 0, d.id + ' has cards');
      var seen = {};
      d.steps.forEach(function (st) {
        t.ok(!!(st.image || st.video), d.id + '/' + st.id + ' has an image or a video');
        t.ok(!seen[st.id], d.id + '/' + st.id + ' is unique');
        seen[st.id] = true;
      });
    });
  });

  test('the two older main events are exactly as they were', function (t) {
    var a = R.mainEvent(D, 'tide_remembers_prologue'), b = R.mainEvent(D, 'turning_tide');
    t.equal(a.title, 'The Tide Remembers - Prologue');
    t.equal(a.steps.length, 3);
    t.ok(!a.deck && !b.deck);
    t.equal(b.steps.length, 8);
    t.equal(b.steps[0].image, 'tools/explorer/assets/main_events/turning_tide_1.png');
  });

  test('Act 2 holds the three portraits (Dren, Seris, Linnet), each with its voice line, and no clips or fonts', function (t) {
    var d = R.mainEvent(D, 'absent_tide_act2');
    t.same(R.deckCards(d).map(function (c) { return c.name; }), ['Dren Marr', 'Captain Seris Thane', 'Linnet']);
    t.ok(R.deckCards(d).every(function (c) { return c.kind === 'portrait' && c.voice && c.line; }));
    t.equal(d.showFirst, false, 'the party chooses its stops, so nothing goes up by itself');
  });

  test('Act 4 has eight cards in the handover\'s order, two with writing laid over them', function (t) {
    var d = R.mainEvent(D, 'absent_tide_act4');
    t.same(R.deckCards(d).map(function (c) { return c.kind; }), ['image', 'video', 'portrait', 'image', 'image', 'portrait', 'image', 'image']);
    t.same(d.steps.filter(function (s) { return s.overlays; }).map(function (s) { return s.overlays[0].text; }),
      ['Do not trust yesterday.', 'Five visitors asked after Maerys Vell. They were frightened. Do not tell them the date.']);
  });

  test('a portrait\'s card for the TV carries its name only, never the voice line or file, even with a DM note', function (t) {
    var d = R.mainEvent(D, 'absent_tide_act2');
    var step = JSON.parse(JSON.stringify(d.steps[1]));
    step.dmNote = 'ZZDMNOTE';
    var json = JSON.stringify(R.playerSnapshot(busy(), D, { scene: R.stepScene(step) }));
    t.ok(json.indexOf('Captain Seris Thane') >= 0);
    ['ZZDMNOTE', 'State your business', 'seris-thane.mp3', 'voice/', 'dren-marr', 'linnet', 'dmNote'].forEach(function (w) { t.ok(json.indexOf(w) < 0, 'must not contain ' + w); });
    step.subtitle = true;
    t.ok(JSON.stringify(R.playerSnapshot(busy(), D, { scene: R.stepScene(step) })).indexOf('State your business') >= 0, 'only when the card switches the subtitle on');
  });

  test('a clip card sends the clip with its still as the poster; with the clip missing it sends the still alone', function (t) {
    var step = R.mainEvent(D, 'absent_tide_act4').steps[1];
    var sc = R.cleanScene(R.stepScene(step));
    t.equal(sc.kind, 'video');
    t.ok(/\.mp4$/.test(sc.src) && /\.png$/.test(sc.poster));
    var still = R.cleanScene(R.stepScene(step, { stillOnly: true }));
    t.equal(still.kind, 'image');
    t.ok(/\.png$/.test(still.src) && still.poster === '');
  });

  group('Explorer Player View: The Ironbow sends word');

  test('with no word the snapshot has none; with it, only the days and the lines the pop-up shows', function (t) {
    t.equal(R.playerSnapshot(busy(), D, {}).word, null);
    var w = R.playerSnapshot(busy(), D, { word: [{ day: 3, lines: ['A cart arrives.', 'The harbour is quiet.'], secret: 'ZZSECRET' }] }).word;
    t.same(w, [{ day: 3, lines: ['A cart arrives.', 'The harbour is quiet.'] }]);
    t.ok(JSON.stringify(R.playerSnapshot(busy(), D, { word: [{ day: 3, lines: ['x'], secret: 'ZZSECRET' }] })).indexOf('ZZSECRET') < 0);
    t.equal(R.playerSnapshot(busy(), D, { word: [{ day: 3, lines: [] }] }).word, null, 'a day with nothing to say is nothing');
  });

  test('the Bastion records, the outbox and the DM\'s note never ride along with the word', function (t) {
    var json = JSON.stringify(R.playerSnapshot(busy(), D, { word: [{ day: 2, lines: ['One line.'] }] }));
    ['ZZOUTBOX', 'ZZLOG', 'ZZNOTES', 'ZZDMDOC', 'The Bastion works these out'].forEach(function (w) { t.ok(json.indexOf(w) < 0, w); });
  });

  test('the word is kept to six days of twelve lines', function (t) {
    var days = []; for (var i = 0; i < 9; i++) days.push({ day: i + 1, lines: new Array(20).fill('line') });
    var w = R.cleanWord(days);
    t.equal(w.length, 6);
    t.equal(w[0].lines.length, 12);
  });
}());
