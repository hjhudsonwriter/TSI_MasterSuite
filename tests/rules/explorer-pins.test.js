/* Scarlett Isles Explorer: town banners and quest markers' plain rules (tools/explorer/pins-rules.js; guide 6A, 4 November 2026). */
(function () {
  var P = TSI.explorer.pins;
  var R = TSI.explorer.rules;
  var D = window.TSI_DATA;
  var SHIELDS = D.clanShields;
  var SEEDS = D.townClans;
  var EX = D.explorer;

  group('Town banners: which clan each town shows');

  test('the seven clans each have a name and two pictures', function (t) {
    t.same(Object.keys(SHIELDS), ['farmer', 'slade', 'bacca', 'blackstone', 'molten', 'karr', 'rowthorn']);
    Object.keys(SHIELDS).forEach(function (k) { t.ok(SHIELDS[k].name.indexOf('Clan ') === 0 && /\.png$/.test(SHIELDS[k].image) && /-banner\.png$/.test(SHIELDS[k].bannerImage), k); });
  });

  test('every town pin resolves to a known clan or to none, and the 33 towns of Harry\'s table show their province\'s clan', function (t) {
    var ids = [];
    Object.keys(EX.markersByMapId).forEach(function (mapId) {
      EX.markersByMapId[mapId].forEach(function (m) {
        ids.push(m.id);
        t.ok(Object.prototype.hasOwnProperty.call(SEEDS, m.id), mapId + ' / ' + m.id + ' has a row');
        var c = P.clanFor(P.emptyTownClans(), SEEDS, SHIELDS, m.id);
        t.ok(c === null || !!SHIELDS[c], m.id);
      });
    });
    Object.keys(SEEDS).forEach(function (k) { t.ok(ids.indexOf(k) !== -1, k + ' is a real pin'); });
    var byClan = {};
    Object.keys(SEEDS).forEach(function (k) { if (SEEDS[k]) byClan[SEEDS[k]] = (byClan[SEEDS[k]] || 0) + 1; });
    t.same(byClan, { rowthorn: 3, karr: 3, bacca: 5, slade: 7, blackstone: 6, molten: 6, farmer: 3 }, '33 towns');
    t.equal(P.clanFor(P.emptyTownClans(), SEEDS, SHIELDS, 'leatherport'), null, 'a pin that is not in the table is a plain nameplate');
    t.equal(P.clanFor(P.emptyTownClans(), SEEDS, SHIELDS, 'no_such_town'), null);
  });

  test('the DM\'s choice wins over the file, None is a choice, and choosing the file\'s own clan drops the override', function (t) {
    var tc = P.emptyTownClans();
    t.equal(P.clanFor(tc, SEEDS, SHIELDS, 'swyth'), 'rowthorn');
    t.equal(P.setClan(tc, SEEDS, SHIELDS, 'swyth', 'karr'), true);
    t.equal(P.clanFor(tc, SEEDS, SHIELDS, 'swyth'), 'karr');
    t.same(tc.overrides, { swyth: 'karr' });
    t.equal(P.setClan(tc, SEEDS, SHIELDS, 'swyth', null), true, 'None');
    t.equal(P.clanFor(tc, SEEDS, SHIELDS, 'swyth'), null);
    t.same(tc.overrides, { swyth: null }, 'None is saved');
    t.equal(P.setClan(tc, SEEDS, SHIELDS, 'swyth', 'rowthorn'), true);
    t.same(tc.overrides, {}, 'back to the file: nothing kept');
    t.equal(P.setClan(tc, SEEDS, SHIELDS, 'swyth', 'dragons'), false, 'an unknown clan is refused');
    t.equal(P.setClan(tc, SEEDS, SHIELDS, 'leatherport', 'karr'), true, 'a town not in the table can be given a clan');
    t.equal(P.clearClan(tc, 'leatherport'), true);
    t.equal(P.clearClan(tc, 'leatherport'), false);
    t.same(P.bannerFor(tc, SEEDS, SHIELDS, 'middlemount'), { clan: 'bacca', clanName: 'Clan Bacca', banner: 'tools/explorer/assets/clans/bacca-banner.png' });
    t.same(P.bannerFor(tc, SEEDS, SHIELDS, 'leatherport'), { clan: null, clanName: '', banner: '' });
  });

  test('saved town clans are checked and tidied: bad shapes are refused, unknown clans dropped, nothing throws', function (t) {
    t.equal(P.isTownClans(null), false);
    t.equal(P.isTownClans({ version: 2, overrides: {} }), false);
    t.equal(P.isTownClans({ version: 1, overrides: { a: 5 } }), false);
    t.equal(P.isTownClans({ version: 1, overrides: { a: null, b: 'karr' } }), true);
    t.same(P.cleanTownClans('junk', SHIELDS), { version: 1, overrides: {} });
    t.same(P.cleanTownClans({ version: 1, overrides: { swyth: 'karr', wyre: 'nobody', fork_farm: null } }, SHIELDS), { version: 1, overrides: { swyth: 'karr', fork_farm: null } });
    var damaged = { version: 1, overrides: { swyth: 'nobody' } };
    t.equal(P.clanFor(damaged, SEEDS, SHIELDS, 'swyth'), null, 'a damaged choice shows no shield');
  });

  test('banners that would overlap are pushed apart, the lower one down, and a lone banner stays put', function (t) {
    t.same(P.nudgeBanners([{ id: 'a', x: 100, y: 100, w: 120, h: 36 }]), { a: { dx: 0, dy: 0 } });
    var n = P.nudgeBanners([{ id: 'a', x: 100, y: 100, w: 120, h: 36 }, { id: 'b', x: 130, y: 110, w: 120, h: 36 }]);
    t.equal(n.a.dy, 0);
    t.equal(n.b.dy, 29, 'b is moved clear of a (a ends at 140, b would start at 114, 3 apart)');
    var far = P.nudgeBanners([{ id: 'a', x: 100, y: 100, w: 120, h: 36 }, { id: 'b', x: 400, y: 100, w: 120, h: 36 }]);
    t.same(far, { a: { dx: 0, dy: 0 }, b: { dx: 0, dy: 0 } });
    var three = P.nudgeBanners([{ id: 'a', x: 100, y: 100, w: 120, h: 36 }, { id: 'b', x: 100, y: 100, w: 120, h: 36 }, { id: 'c', x: 100, y: 100, w: 120, h: 36 }]);
    t.ok(three.b.dy > 0 && three.c.dy > three.b.dy, 'three on one spot stack');
  });

  test('whether a pin shows is decided in one place (R.isPinVisible): a pin with no town map stays hidden unless it is a port waiting for its picture', function (t) {
    var s = R.defaultState(EX);
    s.mapPresetId = 'midland_province';
    var board = R.board(R.aspect(s, EX));
    var list = EX.markersByMapId.midland_province;
    var shown = list.filter(function (m) { return R.isPinVisible(s, EX, board, m); }).map(function (m) { return m.id; });
    t.same(shown, R.visibleMarkers(s, EX, board).map(function (m) { return m.id; }));
    t.same(shown, ['river_rook', 'middlemount']);
  });

  group('Quest markers');

  test('a marker is dropped, edited, moved and removed; positions are fractions held between 0 and 1', function (t) {
    var mk = P.emptyMarkers();
    t.equal(P.addMarker(mk, 'none', 0.5, 0.5), null, 'no map, no marker');
    var a = P.addMarker(mk, 'preset:midland_province', 0.25, 0.75);
    t.same(a, { id: 'qm-1', mapId: 'preset:midland_province', x: 0.25, y: 0.75, label: '', note: '', shown: false, source: '' });
    var b = P.addMarker(mk, 'preset:the_east_isle', 2, -3);
    t.same([b.id, b.x, b.y], ['qm-2', 1, 0], 'held on the map');
    t.equal(P.editMarker(mk, 'qm-1', '  The   old mill ', 'Ask for\nBranwen'), true);
    t.same([a.label, a.note], ['The old mill', 'Ask for\nBranwen']);
    t.equal(P.editMarker(mk, 'qm-1', 'x'.repeat(200), 'n'.repeat(900)), true);
    t.same([a.label.length, a.note.length], [P.LABEL_MAX, P.NOTE_MAX], 'cut to length');
    t.equal(P.moveMarker(mk, 'qm-1', 0.4, 0.6), true);
    t.same([a.x, a.y], [0.4, 0.6]);
    t.equal(P.moveMarker(mk, 'nope', 0.4, 0.6), false);
    t.same(P.markersForMap(mk, 'preset:midland_province').map(function (m) { return m.id; }), ['qm-1'], 'a marker belongs to one map');
    t.equal(P.removeMarker(mk, 'qm-1'), true);
    t.equal(P.removeMarker(mk, 'qm-1'), false);
    t.equal(P.addMarker(mk, 'preset:midland_province', 0.1, 0.1).id, 'qm-3', 'a new id never clashes with one still there');
    t.equal(new Set(mk.markers.map(function (m) { return m.id; })).size, mk.markers.length, 'ids are unique');
  });

  test('saved markers are checked and tidied: bad entries dropped, nothing throws', function (t) {
    t.equal(P.isMarkers(null), false);
    t.equal(P.isMarkers({ version: 1, markers: 'x' }), false);
    var c = P.cleanMarkers({ version: 1, markers: [
      { id: 'a', mapId: 'm', x: 7, y: -1, label: 'L', note: 'N', source: 'notice-board' },
      { id: 'a', mapId: 'm', x: 0, y: 0 },
      { id: '', mapId: 'm' }, null, 5, { id: 'c' }
    ] });
    t.same(c, { version: 1, markers: [{ id: 'a', mapId: 'm', x: 1, y: 0, label: 'L', note: 'N', shown: false, source: '' }] }, 'one good entry; source stays empty for now');
    t.same(P.cleanMarkers('junk'), { version: 1, markers: [] });
  });

  test('LEAK: the players\' markers hold only id, mapId, x and y: never the label or the note', function (t) {
    var mk = P.emptyMarkers();
    var m = P.addMarker(mk, 'preset:midland_province', 0.3, 0.4);
    P.editMarker(mk, m.id, 'SECRET-LABEL', 'SECRET-NOTE');
    var snap = P.snapshot(mk, 'preset:midland_province');
    t.same(snap, [{ id: 'qm-1', mapId: 'preset:midland_province', x: 0.3, y: 0.4 }]);
    var s = R.defaultState(EX);
    s.mapPresetId = 'midland_province';
    var full = R.playerSnapshot(s, EX, { quests: mk.markers, banners: {} });
    t.same(full.quests, [{ id: 'qm-1', mapId: 'preset:midland_province', x: 0.3, y: 0.4 }], 'even handed the whole marker, the snapshot keeps four fields');
    var text = JSON.stringify(full);
    t.ok(text.indexOf('SECRET') === -1, 'no label or note anywhere in the snapshot');
    t.same(R.playerSnapshot(s, EX, {}).quests, [], 'none by default');
  });

  test('Show to players: a marker can be ticked to show on the players\' window in unexplored land, and only then; the label and note still never go', function (t) {
    var mk = P.emptyMarkers();
    var m = P.addMarker(mk, 'preset:midland_province', 0.02, 0.02);
    P.editMarker(mk, m.id, 'SECRET-LABEL', 'SECRET-NOTE');
    t.equal(m.shown, false, 'not shown by default');
    var s = R.defaultState(EX);
    s.mapPresetId = 'midland_province';
    s.explored = TSI.explorer.explored.empty('colour');
    t.same(R.playerSnapshot(s, EX, { quests: mk.markers }).quests, [], 'in unexplored land, hidden');
    t.equal(P.editMarker(mk, m.id, 'SECRET-LABEL', 'SECRET-NOTE', true), true);
    t.equal(m.shown, true);
    var snap = R.playerSnapshot(s, EX, { quests: mk.markers });
    t.same(snap.quests, [{ id: 'qm-1', mapId: 'preset:midland_province', x: 0.02, y: 0.02 }], 'sent, as a bare spot');
    t.ok(JSON.stringify(snap).indexOf('SECRET') === -1 && JSON.stringify(snap).indexOf('shown') === -1, 'no label, no note, not even the flag');
    P.editMarker(mk, m.id, 'x', 'y');
    t.equal(m.shown, true, 'editing the text alone keeps the tick');
    P.editMarker(mk, m.id, 'x', 'y', false);
    t.equal(m.shown, false);
    t.equal(P.cleanMarkers({ version: 1, markers: [{ id: 'a', mapId: 'm', x: 0, y: 0, shown: 'yes' }] }).markers[0].shown, false, 'only a real true counts');
  });

  test('the players\' town markers carry the shield picture and the clan\'s name only, for the pins that show', function (t) {
    var s = R.defaultState(EX);
    s.mapPresetId = 'midland_province';
    var banners = { middlemount: P.bannerFor(P.emptyTownClans(), SEEDS, SHIELDS, 'middlemount'), colver: P.bannerFor(P.emptyTownClans(), SEEDS, SHIELDS, 'colver') };
    var snap = R.playerSnapshot(s, EX, { banners: banners });
    var mm = snap.markers.filter(function (m) { return m.id === 'middlemount'; })[0];
    t.same([mm.banner, mm.clan], ['tools/explorer/assets/clans/bacca-banner.png', 'Clan Bacca']);
    t.same(Object.keys(mm).sort(), ['banner', 'clan', 'id', 'label', 'thumb', 'x', 'y']);
    t.ok(snap.markers.every(function (m) { return m.id !== 'colver'; }), 'a pin that does not show is not sent');
    var rr = snap.markers.filter(function (m) { return m.id === 'river_rook'; })[0];
    t.same([rr.banner, rr.clan], ['', ''], 'a town with no clan has a plain nameplate');
  });
}());
