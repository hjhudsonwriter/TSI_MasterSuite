/* The Bastion's Player View (26 October 2026; docs/PLAYER-VIEW-PLAN.md, phases P1 to P3): the snapshot the TV is sent
   (tools/bastion/player-view-rules.js) holds what the players may see and nothing else, and the panel data has one entry
   per facility. */
(function () {
  var R = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };

  function order(id, facId, label, extra) {
    return Object.assign({ id: id, facId: facId, fnId: 'x', chosen: { label: 'ZZCHOSEN' }, optionLabel: 'ZZOPTION', notes: 'ZZORDERNOTE', label: label, costGP: 987654, issuedDay: 3, dueDay: 9, inputs: [{ good: 'ZZINPUT', qty: 3 }], meta: { secret: 'ZZMETA' } }, extra || {});
  }
  /* A busy Bastion at party level 13, full of things the players must not see. */
  function busy() {
    var b = R.defaultState(data);
    b.day = 14; b.anchored = true; b.partyLevel = 13; b.treasuryGP = 250; b.partyName = 'The Ember Company';
    b.builtExtras = [{ facId: 'temple', status: 'built' }, { facId: 'prison_tower', status: 'built' }, { facId: 'beast_pen', status: 'built' }, { facId: 'hall_of_emissaries', status: 'building', readyDay: 20 }];
    b.builtPlots = [{ facId: 'herbal_gardens', status: 'built' }];
    R.ensureLevels(b, data);
    b.facilityLevels.workshop = 3;
    b.facilityLevels.dock = 2;
    b.favour = { telluria: 80, aurush: 25, pelagos: 50 };
    b.pendingOrders = [order('o1', 'workshop', 'Workshop: Craft: Longsword'), order('o2', 'workshop', 'Workshop: Upgrade to Level 4'), order('o3', 'dock', 'Dock: Ship cargo')];
    b.warehouse = [{ name: 'ZZWAREHOUSE', qty: 99 }];
    b.politicalCapital.ironbow = 77; b.honourRespectByClan.ironbow = 4;
    b.diplomaticRecords = { next: 2, list: [{ id: 1, text: 'ZZRECORD' }] };
    b.notes = 'ZZDMNOTE';
    b.dmDoc = { text: 'ZZDMDOC' };
    b.creatures = [{ id: 'c1', name: 'ZZBEAST', kind: 'wyvern' }];
    b.beast = { campaignId: 'ZZPAIRCODE', secret: 'ZZSECRET' };
    b.notices = [{ text: 'ZZNOTICE' }];
    b.prison.cells[0] = { name: 'ZZPRISONER', thread: 'ZZTHREAD', days: 7, sentenceEnds: 30, conditions: 'ZZCOND', found: 'ZZFOUND' };
    return b;
  }
  var CREST = { dataUrl: 'data:image/png;base64,AAAA', key: 'k1', name: 'ZZCRESTFILE.png' };
  function snap(b, extras) { return R.playerSnapshot(b, data, Object.assign({ crest: CREST, focus: null }, extras || {})); }

  group('Player View: the snapshot');

  test('holds the day, the treasury, the counts, the Party Name and the crest picture', function (t) {
    var s = snap(busy());
    t.same([s.v, s.day, s.treasuryGP, s.facilityCount, s.orderCount, s.partyName], [1, 14, 250, 6, 3, 'The Ember Company']);
    t.same(s.crest, { key: 'k1', dataUrl: 'data:image/png;base64,AAAA' });
    t.equal(snap(busy(), { crest: null }).crest, null);
    t.equal(snap(busy(), { crest: { dataUrl: '' } }).crest, null, 'an empty picture is no crest');
  });

  test('the counts are the DM top bar\'s: built facilities (not those still being built) and pending orders', function (t) {
    var b = busy();
    var s = snap(b);
    t.equal(s.facilityCount, R.builtFacilityIds(b, data).length);
    t.equal(s.orderCount, b.pendingOrders.length);
  });

  test('the map overlays and labels are the DM\'s (R.mapOverlays, R.mapLabels)', function (t) {
    var b = busy();
    var s = snap(b);
    t.same(s.overlays.map(function (o) { return o.pic; }), R.mapOverlays(b, data).map(function (o) { return o.pic; }));
    t.same(s.labels.map(function (l) { return [l.fac, l.name, l.level, l.x, l.y]; }), R.mapLabels(b, data).map(function (l) { return [l.fac, l.name, l.level, l.x, l.y]; }));
  });

  test('the tray: starting tiles and the Party Quarters, four slots, six plots, in the DM\'s order and states', function (t) {
    var s = snap(busy());
    var row1 = s.tiles.filter(function (x) { return x.row === 1; });
    var row2 = s.tiles.filter(function (x) { return x.row === 2; });
    t.same(row1.slice(0, 3).map(function (x) { return [x.kind, x.fac]; }), [['built', 'workshop'], ['built', 'dock'], ['picture', 'party_quarters']]);
    t.equal(row1.length, 3 + 4, 'three starting tiles and four construction slots');
    t.equal(row2.length, 6, 'six Development Plots (four open at party level 13)');
    t.same(row1.slice(3).map(function (x) { return x.kind + ':' + x.fac; }), ['built:temple', 'built:prison_tower', 'built:beast_pen', 'building:hall_of_emissaries']);
    t.equal(row1[6].daysLeft, 6, 'the Hall has 6 days of building left on Day 14');
    t.same(row2.map(function (x) { return x.kind; }), ['built', 'empty', 'empty', 'empty', 'locked', 'locked']);
    var low = busy(); low.partyLevel = 1; low.builtExtras = []; low.builtPlots = [];
    var l = snap(low);
    t.same(l.tiles.filter(function (x) { return x.row === 1; }).slice(3).map(function (x) { return x.kind; }), ['locked', 'locked', 'locked', 'locked']);
    t.same(l.tiles.filter(function (x) { return x.row === 2; }).map(function (x) { return x.kind; }), ['locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
  });

  test('each built facility has its name, level and the NAMES of its pending orders, in order', function (t) {
    var s = snap(busy());
    t.same(s.facilities.workshop.orders, ['Workshop: Craft: Longsword', 'Workshop: Upgrade to Level 4']);
    t.same(s.facilities.dock.orders, ['Dock: Ship cargo']);
    t.same(s.facilities.temple.orders, []);
    t.same([s.facilities.workshop.level, s.facilities.dock.level, s.facilities.temple.single, s.facilities.workshop.single], [3, 2, true, false]);
    t.equal(s.facilities.hall_of_emissaries, undefined, 'a facility still being built has no panel');
    t.equal(s.tiles.filter(function (x) { return x.fac === 'workshop'; })[0].orders, 2);
  });

  test('the Workshop shows its five staff, those not yet open marked', function (t) {
    var s = snap(busy());
    t.same(s.facilities.workshop.staff.map(function (x) { return [x.name, x.open]; }), [['Handyman', true], ['Smith', true], ['Scholar', true], ['Alchemist', false], ['Artisan', false]]);
    t.equal(s.facilities.dock.staff, undefined);
  });

  test('the Temple shows its three favour bars, 0 to 100 each, and nothing else of the gods', function (t) {
    var s = snap(busy());
    t.same(s.facilities.temple.gods, [{ id: 'telluria', name: 'Telluria', pct: 80 }, { id: 'aurush', name: 'Aurush', pct: 25 }, { id: 'pelagos', name: 'Pelagos', pct: 50 }]);
    var b = busy(); b.favour = { telluria: 400, aurush: -5, pelagos: 'x' };
    t.same(snap(b).facilities.temple.gods.map(function (g) { return g.pct; }), [100, 0, 0]);
  });

  test('focus: only a built facility with a panel; the Hall\'s panel is "diplomacy"', function (t) {
    t.equal(snap(busy(), { focus: 'workshop' }).focus, 'workshop');
    t.equal(snap(busy(), { focus: 'hall_of_emissaries' }).focus, null, 'not built yet');
    t.equal(snap(busy(), { focus: 'party_quarters' }).focus, null, 'the Party Quarters has no panel');
    t.equal(snap(busy(), { focus: 'nonsense' }).focus, null);
    t.equal(snap(busy(), { focus: 42 }).focus, null);
    t.equal(snap(busy()).focus, null);
    t.equal(R.playerFocusOf('fac-workshop'), 'workshop');
    t.equal(R.playerFocusOf('diplomacy'), 'hall_of_emissaries');
    t.equal(R.playerFocusOf('orders'), null);
    t.equal(R.playerFocusOf('build'), null);
    t.equal(R.playerFocusOf(undefined), null);
  });

  test('an Under Repair facility says so', function (t) {
    var b = busy(); b.repairs = { dock: 20 };
    var s = snap(b);
    t.equal(s.facilities.dock.repair, 20);
    t.equal(s.facilities.workshop.repair, 0);
    t.ok(s.overlays.every(function (o) { return o.repair === false || o.facs.indexOf('dock') !== -1; }));
  });

  group('Player View: nothing DM-only leaks');

  var SECRETS = ['ZZWAREHOUSE', 'ZZRECORD', 'ZZDMNOTE', 'ZZDMDOC', 'ZZBEAST', 'ZZPAIRCODE', 'ZZSECRET', 'ZZNOTICE', 'ZZPRISONER', 'ZZTHREAD', 'ZZCOND', 'ZZFOUND',
    'ZZCHOSEN', 'ZZOPTION', 'ZZORDERNOTE', 'ZZINPUT', 'ZZMETA', 'ZZCRESTFILE'];

  test('none of the DM\'s notes, doc, Warehouse, records, creatures, prisoners, Beast Handler codes, notices or order details are in it', function (t) {
    var text = JSON.stringify(snap(busy(), { focus: 'prison_tower' }));
    SECRETS.forEach(function (w) { t.equal(text.indexOf(w), -1, w + ' must not be sent'); });
  });

  test('no gold but the treasury, and no clan scores, order costs or days', function (t) {
    var text = JSON.stringify(snap(busy()));
    t.equal(text.indexOf('987654'), -1, 'an order\'s cost is not sent');
    t.equal(text.indexOf('costGP'), -1);
    t.equal(text.indexOf('politicalCapital'), -1);
    t.equal(text.indexOf('honour'), -1);
    t.equal(text.indexOf('dueDay'), -1, 'the days an order is due are not sent');
    t.equal(text.indexOf('warehouse'), -1);
    t.equal(text.indexOf('cells'), -1);
    t.equal(text.indexOf('creature'), -1);
  });

  test('only these keys exist, at every level', function (t) {
    var s = snap(busy(), { focus: 'temple' });
    t.same(Object.keys(s).sort(), ['crest', 'day', 'facilities', 'facilityCount', 'focus', 'labels', 'orderCount', 'overlays', 'partyName', 'tiles', 'treasuryGP', 'v']);
    t.same(Object.keys(s.crest).sort(), ['dataUrl', 'key']);
    s.overlays.forEach(function (o) { t.same(Object.keys(o).sort(), ['facs', 'pic', 'repair']); });
    s.labels.forEach(function (l) { t.ok(Object.keys(l).every(function (k) { return ['fac', 'name', 'level', 'single', 'x', 'y', 'repair', 'part'].indexOf(k) !== -1; }), 'a label has only its own fields'); });
    s.tiles.forEach(function (x) { t.ok(Object.keys(x).every(function (k) { return ['row', 'kind', 'fac', 'name', 'level', 'single', 'repair', 'orders', 'daysLeft', 'plot'].indexOf(k) !== -1; }), 'a tile has only its own fields'); });
    Object.keys(s.facilities).forEach(function (id) {
      t.ok(Object.keys(s.facilities[id]).every(function (k) { return ['name', 'level', 'single', 'repair', 'orders', 'staff', 'gods'].indexOf(k) !== -1; }), id + ' has only its own fields');
    });
  });

  test('the Prison Tower and the Beast Pen show only a level and their orders\' names', function (t) {
    var s = snap(busy());
    t.same(Object.keys(s.facilities.prison_tower).sort(), ['level', 'name', 'orders', 'repair', 'single']);
    t.same(Object.keys(s.facilities.beast_pen).sort(), ['level', 'name', 'orders', 'repair', 'single']);
  });

  test('the snapshot is plain data: it survives a copy through JSON unchanged', function (t) {
    var s = snap(busy(), { focus: 'workshop' });
    t.same(JSON.parse(JSON.stringify(s)), s);
  });

  test('building the snapshot changes nothing in the Bastion (beyond the tidying every read of its buildings does)', function (t) {
    var b = busy();
    snap(b);
    var before = JSON.stringify(b);
    snap(b, { focus: 'temple' });
    t.equal(JSON.stringify(b), before);
  });

  test('a brand-new Bastion works too (no crest, no name, nothing built but the start)', function (t) {
    var b = R.defaultState(data);
    var s = R.playerSnapshot(b, data, {});
    t.same([s.day, s.treasuryGP, s.facilityCount, s.orderCount, s.partyName, s.crest, s.focus], [1, 0, 2, 0, '', null, null]);
    t.same(Object.keys(s.facilities).sort(), ['dock', 'workshop']);
  });

  group('Player View: the panels\' data file');

  test('one entry for every facility, none for the Party Quarters, each with a title, tagline and blurb', function (t) {
    var panels = T.bastionPlayerPanels;
    t.same(panels.map(function (p) { return p.id; }).sort(), data.facilities.map(function (f) { return f.id; }).sort());
    panels.forEach(function (p) {
      t.equal(R.facility(data, p.id).name, p.title, p.id + '\'s title is its name');
      t.ok(p.tagline && p.blurb, p.id + ' has a tagline and a blurb');
      t.ok(p.widgets.indexOf('level') !== -1 && p.widgets.indexOf('orders') !== -1, p.id + ' shows its level and orders');
      var files = p.art === null ? [] : typeof p.art === 'string' ? [p.art] : Object.keys(p.art.levels).map(function (k) { return p.art.levels[k]; });
      t.ok(files.every(function (f) { return /^[a-z0-9_\-]+\.(png|jpg|webp)$/.test(f); }), p.id + '\'s art is file names or null');
    });
    t.equal(panels.filter(function (p) { return p.id === 'party_quarters'; }).length, 0);
  });

  test('the Workshop shows staff, the Temple shows shrines, nobody else does', function (t) {
    T.bastionPlayerPanels.forEach(function (p) {
      t.equal(p.widgets.indexOf('staff') !== -1, p.id === 'workshop', p.id + ' staff');
      t.equal(p.widgets.indexOf('shrines') !== -1, p.id === 'temple', p.id + ' shrines');
    });
  });
}());
