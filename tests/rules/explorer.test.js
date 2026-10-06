/* Scarlett Isles Explorer: tools/explorer/rules.js and its data */
(function () {
  var R = TSI.explorer.rules;
  var D = window.TSI_DATA.explorer;
  /* Harry's new travel and campfire events (6 October 2026); the old 601 are switched off. */
  var E = window.TSI_DATA.journeyEvents;

  /* Dice that come up in the given order (numbers from 0 up to 1). */
  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function fresh() { return R.defaultState(D); }
  function board43() { return R.board(4 / 3); }
  /* Put a hero's centre on a hex. */
  function putOnHex(s, board, id, q, r) {
    var p = R.axialToPixel(s.grid, q, r);
    R.place(board, R.token(s, id), p.x, p.y);
  }
  /* Drag heroes by whole hexes, as a snapped drag does. */
  function move(s, board, ids, anchorId, dq, dr, rand) {
    var drag = R.startDrag(s, board, ids, anchorId);
    ids.forEach(function (id) {
      var a = drag.startAxials[id];
      putOnHex(s, board, id, a.q + dq, a.r + dr);
    });
    return { drag: drag, res: R.finishMove(s, D, E, drag, board, rand || dice([0.99])) };
  }

  group('Explorer: content');

  test('ten maps in seven event regions, five heroes', function (t) {
    t.equal(D.maps.length, 10);
    t.equal(D.provinces.length, 7);
    t.same(D.heroes.map(function (h) { return h.title; }), ['Kaelen', 'Umbrys', 'Magnus', 'Elara', 'Charles']);
    t.equal(R.mapProvince(D, 'northern_province_west'), 'northern_province');
    t.equal(R.mapProvince(D, 'the_east_isle'), 'the_east_isle');
    t.equal(R.mapProvince(D, 'western_province_south'), 'western_province');
    t.equal(R.mapProvince(D, 'somewhere_else'), 'northern_province', 'unknown maps fall back as before');
  });

  test('events: Harry\'s new ones; the old 601 aren\'t loaded', function (t) {
    var on = E.events.filter(function (ev) { return !ev.off; });
    var kinds = function (k) { return on.filter(function (ev) { return ev.kind === k; }).length; };
    t.equal(kinds('travel') + kinds('dm'), 17, '17 travel events, T17 among them as a DM event');
    t.equal(kinds('camp'), 12);
    t.equal(kinds('follow'), 3);
    t.equal(window.TSI_DATA.explorerEvents, undefined, 'the old events file is switched off');
  });

  test('33 town pins on 10 maps; the 15 with a town map show (E10)', function (t) {
    var all = 0, shown = 0;
    Object.keys(D.markersByMapId).forEach(function (m) {
      D.markersByMapId[m].forEach(function (p) {
        all++;
        if (p.submapImage) shown++;
        t.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1, p.id + ' is on its map picture');
      });
    });
    t.equal(all, 33);
    t.equal(shown, 15);
  });

  test('17 map-to-map entry points, all on the arriving map', function (t) {
    var n = 0;
    Object.keys(D.spawns).forEach(function (from) {
      Object.keys(D.spawns[from]).forEach(function (to) {
        n++;
        var p = D.spawns[from][to];
        t.ok(R.preset(D, from) && R.preset(D, to), from + ' → ' + to + ' are real maps');
        t.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1, from + ' → ' + to + ' is on the map');
      });
    });
    t.equal(n, 17);
  });

  test('two main events with 11 pictures; four kinds of weather', function (t) {
    t.equal(D.mainEvents.length, 2);
    var pics = 0;
    D.mainEvents.forEach(function (ev) { ev.steps.forEach(function (s) { if (s.image) pics++; }); });
    t.equal(pics, 11);
    t.same(D.weather.map(function (w) { return w.kind; }), ['blizzard', 'storm', 'rain', 'sun_heat']);
    D.weather.forEach(function (w) { t.ok(D.weatherVideos[w.kind], w.kind + ' has a video'); });
  });

  group('Explorer: the map and the screen');

  test('the board is the map picture: 1440 wide, as tall as its shape', function (t) {
    t.same(board43(), { w: 1440, h: 1080 });
    var s = fresh();
    t.equal(R.aspect(s, D), 16 / 9, 'no map: 16:9');
    s.mapPresetId = 'midland_province';
    t.equal(R.aspect(s, D), 4 / 3);
  });

  test('the map is fitted whole and centred, like the old picture', function (t) {
    var v = R.view(1920, 1080, board43());
    t.equal(v.fit, 1);
    t.equal(v.ox, 240);
    t.equal(v.oy, 0);
    var back = R.toBoard(v, 1000, 500);
    var there = R.toScreen(v, back.x, back.y);
    t.same([Math.round(there.x), Math.round(there.y)], [1000, 500]);
  });

  test('a hero stays on the same spot of the map at any window size (EXP-10)', function (t) {
    var b = board43();
    var s = fresh();
    var tok = s.tokens[0];
    [[1109, 850], [1920, 1080], [1422, 1067], [800, 450]].forEach(function (size) {
      var v = R.view(size[0], size[1], b);
      var c = R.centre(b, tok);
      var p = R.toScreen(v, c.x, c.y);
      /* As a fraction of the picture on screen: */
      var fx = (p.x - v.ox) / (b.w * v.fit);
      var fy = (p.y - v.oy) / (b.h * v.fit);
      t.ok(Math.abs(fx - tok.x) < 1e-9 && Math.abs(fy - tok.y) < 1e-9, 'same spot at ' + size.join(' × '));
    });
  });

  test('pointy-top hexes: there and back, and distances', function (t) {
    var g = { r: 38, offsetX: 10, offsetY: -4 };
    var p = R.axialToPixel(g, 3, -2);
    t.same(R.hexAt(g, p.x, p.y), { q: 3, r: -2 });
    t.equal(R.hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 }), 1);
    t.equal(R.hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 }), 2);
    t.equal(R.hexDistance({ q: 0, r: 0 }, { q: -3, r: 3 }), 3);
  });

  test('the hex size and nudges are clamped as before; readout wording', function (t) {
    t.equal(R.hexSize({ r: 5 }), 10);
    t.equal(R.hexSize({ r: 500 }), 220);
    t.equal(R.hexSize({ r: 0 }), 38);
    t.equal(R.readout({ r: 38 }), 'Hex: r=38px (≈ 66px wide)');
  });

  test('grid opacity 0 draws at the default 0.35, as before (EXP-26, kept)', function (t) {
    t.equal(R.gridOpacity({ opacity: 0 }), 0.35);
    t.equal(R.gridOpacity({ opacity: 0.05 }), 0.05);
  });

  test('a hero is always kept wholly on the map picture', function (t) {
    var b = board43();
    var s = fresh();
    var tok = s.tokens[0];
    R.place(b, tok, -500, 5000);
    t.same([tok.x * b.w, tok.y * b.h], [23, 1080 - 23]);
  });

  group('Explorer: moving and miles');

  test('one hex costs 6 miles', function (t) {
    var b = board43();
    var s = fresh();
    s.snap.enabled = true;
    var m = move(s, b, ['kaelen'], 'kaelen', 1, 0);
    t.equal(m.res.result, 'moved');
    t.equal(m.res.miles, 6);
    t.equal(R.token(s, 'kaelen').milesUsed, 6);
  });

  test('a grouped move charges every hero in it once', function (t) {
    var b = board43();
    var s = fresh();
    var m = move(s, b, ['kaelen', 'umbrys', 'magnus'], 'umbrys', 0, 2);
    t.equal(m.res.miles, 12);
    t.same(s.tokens.map(function (x) { return x.milesUsed; }), [12, 12, 12, 0, 0]);
  });

  test('a move over 30 miles for anyone in it is refused, and nobody is charged', function (t) {
    var b = board43();
    var s = fresh();
    R.token(s, 'umbrys').milesUsed = 24;
    var m = move(s, b, ['kaelen', 'umbrys'], 'kaelen', 2, 0);
    t.equal(m.res.result, 'tooFar');
    t.same([R.token(s, 'kaelen').milesUsed, R.token(s, 'umbrys').milesUsed], [0, 24]);
    R.undoDrag(s, m.drag);
    t.same(R.tokenHex(s, b, R.token(s, 'kaelen')), m.drag.startAxials.kaelen, 'back where it started');
  });

  test('exactly 30 miles is allowed; then the hero can\'t be dragged until camp', function (t) {
    var b = board43();
    var s = fresh();
    var m = move(s, b, ['elara'], 'elara', 5, 0);
    t.equal(m.res.result, 'moved');
    t.equal(R.token(s, 'elara').milesUsed, 30);
    t.ok(m.res.tired);
    t.equal(R.canDrag(s, 'elara'), false);
    s.freeMove = true;
    t.equal(R.canDrag(s, 'elara'), true, 'Free Move lets you reposition');
  });

  test('Free Move costs nothing and starts no event', function (t) {
    var b = board43();
    var s = fresh();
    s.freeMove = true;
    var m = move(s, b, ['kaelen'], 'kaelen', 4, 0);
    t.equal(m.res.result, 'free');
    t.equal(R.token(s, 'kaelen').milesUsed, 0);
    t.equal(m.res.open, null);
  });

  test('pace wording by miles', function (t) {
    t.equal(R.travelMode(0).mode, '—');
    t.equal(R.travelMode(18).mode, 'Slow (≤18 miles)');
    t.equal(R.travelMode(18).effects, '+Stealth', 'good foraging went with the rations');
    t.equal(R.travelMode(18).key, 'slow');
    t.equal(R.travelMode(24).mode, 'Normal (≤24 miles)');
    t.equal(R.travelMode(30).effects, '−5 Passive Perception');
  });

  test('the day\'s travel roll comes once, at a random 6–24 miles', function (t) {
    var b = board43();
    var s = fresh();
    s.travel.provinceId = 'midland_province';
    /* First roll sets today's mark: 0.5 → 6 + 9 = 15 miles. */
    var m1 = move(s, b, ['kaelen'], 'kaelen', 2, 0, dice([0.5, 0]));
    t.equal(s.travel.nextTravelEventAtMiles, 15);
    t.equal(m1.res.open, null, '12 miles: not yet');
    /* 18 miles: the roll (0 is under 30%), then the draw (the first card). */
    var m2 = move(s, b, ['kaelen'], 'kaelen', 1, 0, dice([0]));
    t.equal(m2.res.open.kind, 'journey');
    t.equal(s.journey.current.id, 't1', 'begun at once, so a reload picks it up');
    t.equal(s.travel.travelEventDay, 1);
    s.journey.current = null;
    var m3 = move(s, b, ['kaelen'], 'kaelen', 1, 0, dice([0]));
    t.equal(m3.res.open, null, 'only one roll a day');
  });

  test('a miss on the 30% roll means no event today', function (t) {
    var b = board43();
    var s = fresh();
    s.travel.nextTravelEventAtMiles = 6;
    var m = move(s, b, ['kaelen'], 'kaelen', 1, 0, dice([0.3]));
    t.equal(m.res.open, null, '0.30 is not under 30%');
    t.equal(s.journey.rolledDay, 1);
  });

  test('an event can change today\'s 30 miles', function (t) {
    var b = board43();
    var s = fresh();
    s.travel.milesAdjust = -6;
    t.equal(R.dayLimit(s), 24);
    var m = move(s, b, ['kaelen'], 'kaelen', 5, 0, dice([0.99]));
    t.equal(m.res.result, 'tooFar', '30 miles is past today\'s 24');
    s.travel.milesAdjust = 12;
    var m2 = move(s, b, ['kaelen'], 'kaelen', 7, 0, dice([0.99]));
    t.equal(m2.res.result, 'moved', '42 miles fits today\'s 42');
    t.equal(R.milesShown(R.token(s, 'kaelen'), R.dayLimit(s)), 42);
    t.ok(!R.canDrag(s, 'kaelen'), 'then the hero is tired');
  });

  test('Snap on puts every hero in the middle of its hex', function (t) {
    var b = board43();
    var s = fresh();
    R.snapAll(s, b);
    s.tokens.forEach(function (tok) {
      var a = R.tokenHex(s, b, tok);
      var c = R.axialToPixel(s.grid, a.q, a.r);
      var here = R.centre(b, tok);
      t.ok(Math.abs(here.x - c.x) < 1e-6 && Math.abs(here.y - c.y) < 1e-6, tok.id + ' centred');
    });
  });

  test('a snapped drag moves the whole group by the same hexes', function (t) {
    var b = board43();
    var s = fresh();
    s.snap.enabled = true;
    R.snapAll(s, b);
    var ids = ['kaelen', 'umbrys'];
    var drag = R.startDrag(s, b, ids, 'kaelen');
    var start = { k: drag.startAxials.kaelen, u: drag.startAxials.umbrys };
    var target = R.axialToPixel(s.grid, start.k.q + 2, start.k.r - 1);
    var hit = R.dragSnap(s, b, drag, target);
    t.ok(hit, 'moved to a new hex');
    var k = R.tokenHex(s, b, R.token(s, 'kaelen'));
    var u = R.tokenHex(s, b, R.token(s, 'umbrys'));
    t.same([k.q - start.k.q, k.r - start.k.r], [u.q - start.u.q, u.r - start.u.r], 'same hex move for both');
  });

  test('heroes in one hex sit in a small cluster inside it', function (t) {
    var b = board43();
    var s = fresh();
    s.snap.enabled = true;
    s.tokens.forEach(function (tok) { putOnHex(s, b, tok.id, 10, 3); });
    var spots = R.layoutTokens(s, b, 'magnus');
    var c = R.axialToPixel(s.grid, 10, 3);
    t.same([spots.magnus.x + 23, spots.magnus.y + 23].map(Math.round), [c.x, c.y].map(Math.round), 'the dragged hero in the middle');
    Object.keys(spots).forEach(function (id) {
      var d = Math.hypot(spots[id].x + 23 - c.x, spots[id].y + 23 - c.y);
      t.ok(d <= 12.0001, id + ' within the cluster');
    });
  });

  group('Explorer: changing map');

  test('loading a map sets its event region', function (t) {
    var s = fresh();
    var res = R.loadPreset(s, D, 'southern_province_west');
    t.equal(res.spawned, false, 'no link from no map');
    t.equal(s.travel.provinceId, 'southern_province');
    t.equal(R.mapKey(s), 'preset:southern_province_west');
  });

  test('arriving from a linked map puts the party at the entry point, in formation', function (t) {
    var s = fresh();
    R.loadPreset(s, D, 'eastern_province_north');
    /* A tight group, so no one is held back at the map's edge. */
    s.tokens.forEach(function (x, i) { x.x = 0.5 + i * 0.01; x.y = 0.5 - i * 0.005; });
    var before = s.tokens.map(function (x) { return [x.x, x.y]; });
    var res = R.loadPreset(s, D, 'the_east_isle');
    t.equal(res.spawned, true);
    var entry = D.spawns.eastern_province_north.the_east_isle;
    var cx = 0, cy = 0;
    s.tokens.forEach(function (x) { cx += x.x; cy += x.y; });
    t.ok(Math.abs(cx / 5 - entry.x) < 1e-9 && Math.abs(cy / 5 - entry.y) < 1e-9, 'party centred on the entry point');
    var gap0 = [before[1][0] - before[0][0], before[1][1] - before[0][1]];
    var gap1 = [s.tokens[1].x - s.tokens[0].x, s.tokens[1].y - s.tokens[0].y];
    t.ok(Math.abs(gap0[0] - gap1[0]) < 1e-9 && Math.abs(gap0[1] - gap1[1]) < 1e-9, 'formation kept');
  });

  test('after arriving with Snap on, each hero\'s hex is where it is drawn (EXP-04)', function (t) {
    var s = fresh();
    s.snap.enabled = true;
    R.loadPreset(s, D, 'eastern_province_north');
    R.loadPreset(s, D, 'the_east_isle');
    var b = R.board(R.aspect(s, D));
    var spots = R.layoutTokens(s, b, null);
    s.tokens.forEach(function (tok) {
      var a = R.tokenHex(s, b, tok);
      var drawn = R.hexAt(s.grid, spots[tok.id].x + tok.size / 2, spots[tok.id].y + tok.size / 2);
      t.same(drawn, a, tok.id);
    });
  });

  group('Explorer: fog and pins');

  test('fog clears two hexes round the hero, and is kept per map', function (t) {
    var b = board43();
    var s = fresh();
    s.mapPresetId = 'the_north_isle';
    s.fog.enabled = true;
    R.revealAroundFocus(s, b, 'kaelen');
    t.equal(R.revealedCount(s), 19);
    s.mapPresetId = 'the_east_isle';
    t.equal(R.revealedCount(s), 0, 'another map has its own fog');
  });

  test('pins without a town map stay hidden; with fog, pins show once uncovered', function (t) {
    var b = board43();
    var s = fresh();
    s.mapPresetId = 'midland_province';
    t.same(R.visibleMarkers(s, D, b).map(function (m) { return m.id; }), ['middlemount']);
    s.fog.enabled = true;
    t.equal(R.visibleMarkers(s, D, b).length, 0);
    var m = D.markersByMapId.midland_province[0];
    R.reveal(s, R.hexAt(s.grid, m.x * b.w, m.y * b.h), 0);
    t.equal(R.visibleMarkers(s, D, b).length, 1);
  });

  group('Explorer: camp, events and weather');

  test('camp: weather, then the Bastion prompt on day 8 (E4); no campfire after weather', function (t) {
    var s = fresh();
    s.travel.day = 7;
    s.travel.provinceId = 'the_east_isle';
    s.tokens[0].milesUsed = 18;
    s.travel.milesAdjust = -6;
    s.journey.gold = 40;
    var q = R.makeCamp(s, D, E, dice([0.1, 0.5, 0.5]));
    t.same(q.map(function (i) { return i.kind; }), ['weather', 'camp']);
    t.equal(q[0].weather.id, 'cold_rain');
    t.equal(q[1].event.title, 'Bastion Turn');
    t.equal(s.travel.day, 8);
    t.same([s.travel.lastWeatherDay, s.travel.weatherEventDay], [8, 8]);
    t.equal(s.tokens[0].milesUsed, 0, 'miles reset');
    t.equal(s.travel.milesAdjust, 0, 'and back to 30 a day');
    t.equal(s.travel.nextTravelEventAtMiles, 15);
    t.equal(s.travel.travelEventDay, 0);
    t.equal(s.journey.gold, 40, 'the event gold is a running total now (Harry, 6 October 2026)');
    t.equal(s.journey.current, null);
  });

  test('camp: a campfire event comes first, begun at once (25%)', function (t) {
    var s = fresh();
    s.travel.day = 7;
    s.travel.provinceId = 'the_east_isle';
    var q = R.makeCamp(s, D, E, dice([0.9, 0.1, 0, 0.5]));
    t.same(q.map(function (i) { return i.kind; }), ['journey', 'camp']);
    t.equal(s.journey.current.id, 'c1');
    t.equal(s.journey.current.kind, 'camp');
    var s2 = fresh();
    var q2 = R.makeCamp(s2, D, E, dice([0.9, 0.25, 0.5]));
    t.equal(q2.length, 0, '0.25 is not under 25%');
  });

  test('the Bastion prompt comes on days 8, 15, 22 and never between', function (t) {
    var days = [];
    var s = fresh();
    for (var i = 0; i < 25; i++) {
      var q = R.makeCamp(s, D, E, dice([0.99]));
      if (q.some(function (x) { return x.event && x.event.title === 'Bastion Turn'; })) days.push(s.travel.day);
    }
    t.same(days, [8, 15, 22]);
  });

  test('weather: a 45% chance, then a 3-day wait (unchanged)', function (t) {
    var s = fresh();
    var q1 = R.makeCamp(s, D, E, dice([0.44, 0, 0.5]));
    t.equal(q1[0].kind, 'weather', '0.44 is under 45%');
    var q2 = R.makeCamp(s, D, E, dice([0.99]));
    t.equal(q2.length, 0, 'day 3: still waiting');
    var q3 = R.makeCamp(s, D, E, dice([0.99]));
    t.equal(q3.length, 0, 'day 4: still waiting');
    var q4 = R.makeCamp(s, D, E, dice([0.45, 0.99]));
    t.equal(q4.length, 0, 'day 5: 0.45 is not under 45%');
    var q5 = R.makeCamp(s, D, E, dice([0.1, 0.99]));
    t.equal(q5[0].weather.id, 'sun_heatwave', 'day 6');
  });

  test('weather rolls: the old cut-offs', function (t) {
    var w = {};
    D.weather.forEach(function (x) { w[x.id] = x; });
    t.equal(R.resolveWeather(w.white_blizzard, 13).headline, 'Success');
    t.equal(R.resolveWeather(w.white_blizzard, 12).effect, 'Each character gains 1 level of Exhaustion.');
    t.equal(R.resolveWeather(w.black_storm, 14).headline, 'Success');
    t.equal(R.resolveWeather(w.black_storm, 13).headline, 'Failure');
    t.equal(R.resolveWeather(w.cold_rain, 17).headline, 'Great Success');
    t.equal(R.resolveWeather(w.cold_rain, 12).headline, 'Success');
    t.equal(R.resolveWeather(w.cold_rain, 11).headline, 'Failure');
    t.equal(R.resolveWeather(w.sun_heatwave, 12).effect, 'Lethargy: limit travel to 2 hexes (12 miles) today.');
    t.equal(R.readRoll('abc'), null);
    t.equal(R.readRoll(''), 0, 'an empty box counts as 0, as before');
  });

  test('the weather video lasts for its day only', function (t) {
    var s = fresh();
    s.travel.day = 4;
    R.setWeather(s, D.weather[1], 4);
    t.equal(R.currentWeather(s, D).src, D.weatherVideos.storm);
    s.travel.day = 5;
    var w = R.currentWeather(s, D);
    t.same([w.src, w.changed, s.travel.activeWeather], [null, true, null]);
  });

  test('camp clears yesterday\'s weather', function (t) {
    var s = fresh();
    R.setWeather(s, D.weather[0], 1);
    R.makeCamp(s, D, E, dice([0.99]));
    t.equal(s.travel.activeWeather, null);
  });

  test('main-event outcomes: gold goes on the party\'s event gold; rations are ignored', function (t) {
    var s = fresh();
    t.equal(R.applyOutcome(s, { gold: -10, rations: 2, note: 'Paid the toll.', text: 'x' }), 'Outcome: -10 gold • Paid the toll.');
    t.equal(s.journey.gold, -10);
    t.same(s.journey.log, ['Day 1 · -10 gold • Paid the toll.']);
    t.equal(R.applyOutcome(s, { gold: 0, rations: 3, note: '', text: 'x' }), null);
    t.equal(R.outcomeText({ note: 'n' }), 'n');
    t.equal(R.outcomeText({}), 'The moment passes, leaving only the road ahead.');
  });

  test('event heading line and the ambient sentence', function (t) {
    var s = fresh();
    t.equal(R.eventMeta(D, s, 'travel', { type: 'Funnel' }), 'Travel Event • Northern Province • Funnel');
    t.equal(R.eventMeta(D, s, 'main', {}), 'Main Campaign • Northern Province • —');
    t.equal(R.stripAmbientLine('A. The air carries cold pines, crags, old stone roads, watchposts, buckbear heraldry. B.'), 'A. B.');
  });

  test('a queued main event that\'s due replaces the campfire event', function (t) {
    var s = fresh();
    s.travel.forcedMainEvent = { id: 'turning_tide', dueDay: 1 };
    var q = R.makeCamp(s, D, E, dice([0.99]));
    t.equal(q[0].kind, 'main');
    t.equal(q[0].event.id, 'turning_tide');
    t.same([s.travel.forcedMainEvent, s.travel.forcedMainEventFired], [null, true]);
  });

  test('Reset Travel: day 1 and no miles; the weather wait stays (E9)', function (t) {
    var s = fresh();
    s.travel.day = 9;
    s.travel.lastWeatherDay = 8;
    s.travel.milesAdjust = -12;
    s.tokens[2].milesUsed = 12;
    R.resetTravel(s);
    t.same([s.travel.day, s.tokens[2].milesUsed, s.travel.lastWeatherDay, s.travel.milesAdjust], [1, 0, 8, 0]);
  });

  group('Explorer: saving');

  test('a save comes back whole, heroes\' miles included (EXP-03)', function (t) {
    var s = fresh();
    s.mapPresetId = 'the_east_isle';
    s.snap.enabled = true;
    s.fog.enabled = true;
    s.fog.revealedByMapKey['preset:the_east_isle'] = { '1,2': true };
    s.grid.r = 44;
    s.tokens[1].milesUsed = 18;
    s.tokens[1].groupId = 'g1';
    s.tokens[3].x = 0.4;
    s.travel.day = 6;
    s.travel.activeWeather = { kind: 'rain', day: 6 };
    var saved = JSON.parse(JSON.stringify(R.toSave(s)));
    t.ok(R.isSave(saved));
    var back = R.fromSave(saved, D);
    t.same(R.toSave(back), R.toSave(s));
  });

  test('a damaged save is refused rather than locking the Explorer (EXP-12)', function (t) {
    t.ok(!R.isSave({ grid: {}, tokens: [null], travel: {} }));
    t.ok(!R.isSave({ grid: {}, tokens: [{ id: 'kaelen', x: 'left' }], travel: {} }));
    t.ok(!R.isSave({ grid: {}, tokens: [], travel: 5 }));
    t.ok(!R.isSave('hello'));
    t.ok(R.isSave({ grid: {}, tokens: [], travel: {} }), 'a bare but sound save is fine');
  });

  test('import checks every record before anything is replaced', function (t) {
    var good = R.toSave(fresh());
    t.equal(R.importProblem([{ key: 'tsi.explorer.save', value: good }]), null);
    t.ok(/journey/.test(R.importProblem([{ key: 'tsi.explorer.save', value: { tokens: [null] } }])));
    t.ok(/map picture/.test(R.importProblem([{ key: 'tsi.explorer.mapImage', value: { dataUrl: 'nope', key: 'x' } }])));
    t.equal(R.importProblem([{ key: 'tsi.explorer.mapImage', value: { dataUrl: 'data:image/png;base64,AAAA', key: 'k' } }]), null);
  });

  test('unknown maps and odd numbers in a save fall back safely', function (t) {
    var saved = R.toSave(fresh());
    saved.mapPresetId = 'atlantis';
    saved.travel.provinceId = 'nowhere';
    saved.tokens[0].size = 9000;
    var back = R.fromSave(saved, D);
    t.same([back.mapPresetId, back.travel.provinceId, back.tokens[0].size], [null, 'northern_province', 140]);
  });

  test('Pick Marker XY gives the pin form', function (t) {
    t.equal(R.pickText(0.123456, 0.5), '"x": 0.1235, "y": 0.5');
  });
}());
