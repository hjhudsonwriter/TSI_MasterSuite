/* The DM doc's geometry (shared/js/dmdoc-rules.js) and where its saves go. */
(function () {
  var D = TSI.dmDocRules;
  var S = TSI.storeRules;
  var B = TSI.backupRules;
  var LAPTOP = { width: 1707, height: 930, top: 56 };
  var TV = { width: 1920, height: 1080, top: 56 };
  var when = new Date(2026, 9, 6, 10, 0, 0);

  function inside(r, v) {
    return r.x >= 0 && r.y >= v.top && r.x + r.w <= v.width && r.y + r.h <= v.height;
  }

  group('DM doc: staying on screen');

  test('it first opens near the right edge, just below the top bar, on the laptop and the TV', function (t) {
    [LAPTOP, TV].forEach(function (v) {
      var r = D.defaultRect(v);
      t.same([r.w, r.h], [440, 680], 'its first size (tall enough for what it shows, 7 October 2026)');
      t.equal(r.x, v.width - 440 - 24, 'near the right edge');
      t.equal(r.y, v.top + 24, 'just below the top bar');
      t.ok(inside(r, v), 'inside the window');
    });
  });

  test('a short window gets a shorter first size, still clear of the top bar', function (t) {
    var v = { width: 1280, height: 520, top: 56 };
    var r = D.defaultRect(v);
    t.ok(inside(r, v), JSON.stringify(r));
    t.equal(r.y, 80);
    t.equal(r.h, 520 - 56 - 48);
  });

  test('a panel that fits is left exactly where it is', function (t) {
    t.same(D.clamp({ x: 100, y: 200, w: 500, h: 400 }, LAPTOP), { x: 100, y: 200, w: 500, h: 400 });
  });

  test('it is pulled back inside the window from every side, never over the top bar', function (t) {
    t.same(D.clamp({ x: -50, y: 0, w: 400, h: 300 }, LAPTOP), { x: 0, y: 56, w: 400, h: 300 }, 'top-left');
    t.same(D.clamp({ x: 1600, y: 900, w: 400, h: 300 }, LAPTOP), { x: 1307, y: 630, w: 400, h: 300 }, 'bottom-right');
    t.same(D.clamp({ x: 10, y: 40, w: 400, h: 300 }, LAPTOP), { x: 10, y: 56, w: 400, h: 300 }, 'its title bar can\'t hide under the top bar');
  });

  test('it is never smaller than 280 × 200, nor larger than the window', function (t) {
    t.same(D.clamp({ x: 0, y: 56, w: 50, h: 20 }, LAPTOP), { x: 0, y: 56, w: 280, h: 200 }, 'too small');
    t.same(D.clamp({ x: 0, y: 56, w: 5000, h: 5000 }, LAPTOP), { x: 0, y: 56, w: 1707, h: 874 }, 'too big');
    var tiny = { width: 240, height: 200, top: 56 };
    t.same(D.clamp({ x: 30, y: 60, w: 400, h: 400 }, tiny), { x: 0, y: 56, w: 240, h: 144 }, 'a window smaller than the minimum: the window wins');
  });

  test('moving from the TV to the laptop keeps it on screen; the place it was chosen for is unchanged', function (t) {
    var onTv = { x: 1400, y: 600, w: 480, h: 460 };
    t.ok(inside(D.clamp(onTv, TV), TV));
    var onLaptop = D.clamp(onTv, LAPTOP);
    t.ok(inside(onLaptop, LAPTOP), JSON.stringify(onLaptop));
    t.same([onLaptop.w, onLaptop.h], [480, 460], 'the same size');
    t.same(onTv, { x: 1400, y: 600, w: 480, h: 460 }, 'clamp doesn\'t change what it was given');
    t.same(D.clamp(onTv, TV), onTv, 'back on the TV, it goes back where it was');
  });

  test('missing or odd numbers fall back to sensible ones', function (t) {
    var r = D.clamp({ x: NaN, y: 'top', w: null }, LAPTOP);
    t.ok(inside(r, LAPTOP), JSON.stringify(r));
    t.same([r.x, r.y, r.w, r.h], [0, 56, 440, 680]);
    t.same(D.clamp(null, {}), { x: 0, y: 0, w: 0, h: 0 }, 'a window with no size doesn\'t throw');
  });

  group('DM doc: dragging, resizing and the arrow keys');

  test('dragging the title bar moves it, and stops at the edges', function (t) {
    var start = { x: 300, y: 200, w: 440, h: 520 };
    t.same(D.move(start, 50, -30, LAPTOP), { x: 350, y: 170, w: 440, h: 520 });
    t.same(D.move(start, 5000, 5000, LAPTOP), { x: 1267, y: 410, w: 440, h: 520 }, 'bottom-right corner');
    t.same(D.move(start, -5000, -5000, LAPTOP), { x: 0, y: 56, w: 440, h: 520 }, 'top-left, below the top bar');
  });

  test('the grip resizes it from the bottom-right corner, between the minimum and the window\'s edge', function (t) {
    var start = { x: 300, y: 200, w: 440, h: 520 };
    t.same(D.resize(start, 60, -100, LAPTOP), { x: 300, y: 200, w: 500, h: 420 });
    t.same(D.resize(start, -1000, -1000, LAPTOP), { x: 300, y: 200, w: 280, h: 200 }, 'no smaller than 280 × 200');
    t.same(D.resize(start, 5000, 5000, LAPTOP), { x: 300, y: 200, w: 1407, h: 730 }, 'stops at the window\'s edge; the corner stays put');
    var nearEdge = { x: 1500, y: 800, w: 207, h: 130 };
    var r = D.resize(nearEdge, 0, 0, LAPTOP);
    t.ok(inside(r, LAPTOP) && r.w === 280 && r.h === 200, 'no room for the minimum: it moves instead ' + JSON.stringify(r));
  });

  test('arrow keys nudge it 10 pixels, or 50 with Shift, and stay inside', function (t) {
    var r = { x: 300, y: 200, w: 440, h: 520 };
    t.same(D.nudge(r, 'ArrowRight', false, LAPTOP), { x: 310, y: 200, w: 440, h: 520 });
    t.same(D.nudge(r, 'ArrowLeft', true, LAPTOP), { x: 250, y: 200, w: 440, h: 520 });
    t.same(D.nudge(r, 'ArrowDown', false, LAPTOP), { x: 300, y: 210, w: 440, h: 520 });
    t.same(D.nudge(r, 'ArrowUp', true, LAPTOP), { x: 300, y: 150, w: 440, h: 520 });
    t.same(D.nudge({ x: 0, y: 56, w: 440, h: 520 }, 'ArrowUp', true, LAPTOP), { x: 0, y: 56, w: 440, h: 520 }, 'not under the top bar');
    t.equal(D.nudge(r, 'Enter', false, LAPTOP), null, 'other keys do nothing');
  });

  group('DM doc: what\'s saved');

  test('its place and size are saved as whole numbers and read back', function (t) {
    t.same(D.toSaved({ x: 10.4, y: 80.6, w: 440, h: 519.5 }), { x: 10, y: 81, w: 440, h: 520 });
    t.same(D.fromSaved({ x: 10, y: 81, w: 440, h: 520 }), { x: 10, y: 81, w: 440, h: 520 });
  });

  test('a missing or damaged saved layout is ignored', function (t) {
    [null, undefined, 'left', [1, 2, 3, 4], {}, { x: 1, y: 2, w: 3 }, { x: 1, y: 2, w: 0, h: 5 }, { x: 'a', y: 2, w: 3, h: 4 }, { x: 1, y: 2, w: Infinity, h: 4 }].forEach(function (v) {
      t.equal(D.fromSaved(v), null, JSON.stringify(v));
    });
  });

  test('its saves are a suite family: a valid name, kept for the suite, named in backups', function (t) {
    t.ok(S.isValidKey('tsi.dmdoc.layout'));
    t.equal(S.toolOf('tsi.dmdoc.layout'), 'dmdoc');
    t.ok(S.RESERVED_TOOLS.indexOf('dmdoc') !== -1, 'no tool can be called dmdoc');
    t.ok(!S.isTestOnly('tsi.dmdoc.layout'), 'it isn\'t test data');
    t.equal(S.fromLocalKey('tsi.dmdoc.layout', 'suite'), 'tsi.dmdoc.layout', 'it\'s read back from the small storage too');
  });

  test('Back up everything holds it, Restore takes it, and the summary calls it the DM doc', function (t) {
    var records = [S.makeRecord('tsi.dmdoc.layout', { x: 1, y: 60, w: 440, h: 520 }, when), S.makeRecord('tsi.quests.accepted', [1], when)];
    var parsed = B.parse(JSON.stringify(B.makeSuiteBackup(records, when)));
    t.ok(parsed.ok, parsed.reason);
    t.equal(B.checkForSuite(parsed.backup), null, 'Restore accepts it');
    t.same(B.summarise(parsed.backup, function (id) { return id === 'quests' ? 'Notice Board Quest Generator' : null; }).lines,
      ['DM doc: 1 saved item', 'Notice Board Quest Generator: 1 saved item']);
  });

  test('a tool\'s own export can\'t carry the DM doc', function (t) {
    var file = B.makeToolBackup('quests', 'Notice Board Quest Generator', [S.makeRecord('tsi.dmdoc.layout', { x: 1, y: 60, w: 440, h: 520 }, when)], when);
    t.ok(!B.parse(JSON.stringify(file)).ok);
  });

  test('whether it\'s open is kept per window, under a tsi. name, apart on the test page', function (t) {
    t.equal(S.spaceNames('suite').dmdocOpen, 'tsi.suite.dmdoc-open');
    t.equal(S.spaceNames('test').dmdocOpen, 'tsi.test:dmdoc-open');
  });
}());
