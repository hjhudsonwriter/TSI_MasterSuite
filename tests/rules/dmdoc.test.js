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
      t.same([r.w, r.h], [1040, 640], 'its first size: wide enough for the 2 × 2 grid of four panels, and fitting both screens');
      t.equal(r.x, v.width - 1040 - 24, 'near the right edge');
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
    t.same([r.x, r.y, r.w, r.h], [0, 56, 1040, 640]);
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

  test('its place and size are saved as whole numbers, with the layout version, and read back', function (t) {
    t.same(D.toSaved({ x: 10.4, y: 80.6, w: 440, h: 519.5 }), { v: 2, x: 10, y: 81, w: 440, h: 520 });
    t.same(D.fromSaved({ v: 2, x: 10, y: 81, w: 440, h: 520 }), { x: 10, y: 81, w: 440, h: 520 });
    t.same(D.fromSaved(D.toSaved({ x: 5, y: 60, w: 1000, h: 600 })), { x: 5, y: 60, w: 1000, h: 600 }, 'a round trip');
  });

  test('a layout saved before the 2 × 2 grid (the old 440-wide column) is ignored, once', function (t) {
    t.equal(D.fromSaved({ x: 1200, y: 80, w: 440, h: 800 }), null, 'no version: the old shape');
    t.equal(D.fromSaved({ v: 1, x: 1200, y: 80, w: 440, h: 800 }), null, 'an earlier version');
    t.equal(D.fromSaved({ v: 3, x: 1, y: 2, w: 500, h: 400 }), null, 'a later one this copy can\'t read');
    t.equal(D.LAYOUT_VERSION, 2);
  });

  test('a missing or damaged saved layout is ignored', function (t) {
    [null, undefined, 'left', [1, 2, 3, 4], {}, { v: 2 }, { v: 2, x: 1, y: 2, w: 3 }, { v: 2, x: 1, y: 2, w: 0, h: 5 }, { v: 2, x: 'a', y: 2, w: 3, h: 4 }, { v: 2, x: 1, y: 2, w: Infinity, h: 4 }].forEach(function (v) {
      t.equal(D.fromSaved(v), null, JSON.stringify(v));
    });
  });

  test('the pop-out opens wide (landscape), as its own window, without sharing this one\'s tab', function (t) {
    t.same([D.POPOUT_W, D.POPOUT_H], [1100, 760]);
    t.equal(D.popOutFeatures(), 'noopener,popup,width=1100,height=760');
    t.ok(D.POPOUT_W > D.POPOUT_H, 'landscape');
    t.ok(D.POPOUT_W >= D.NARROW_W, 'wide enough for the grid, not the stacked column');
    t.ok(D.DEFAULT_W >= D.NARROW_W, 'and so is the floating panel\'s first size');
  });

  test('its saves are a suite family: a valid name, kept for the suite, named in backups', function (t) {
    t.ok(S.isValidKey('tsi.dmdoc.layout'));
    t.ok(S.isValidKey(D.QUEST_KEY), 'the Quest box\'s key is a valid suite key');
    t.equal(D.QUEST_KEY, 'tsi.dmdoc.quest');
    t.equal(S.toolOf('tsi.dmdoc.layout'), 'dmdoc');
    t.equal(S.toolOf(D.QUEST_KEY), 'dmdoc', 'the Quest box is in the DM doc family, so backups already hold it');
    t.ok(!S.isTestOnly(D.QUEST_KEY));
    t.ok(S.RESERVED_TOOLS.indexOf('dmdoc') !== -1, 'no tool can be called dmdoc');
    t.ok(!S.isTestOnly('tsi.dmdoc.layout'), 'it isn\'t test data');
    t.equal(S.fromLocalKey('tsi.dmdoc.layout', 'suite'), 'tsi.dmdoc.layout', 'it\'s read back from the small storage too');
  });

  test('Back up everything holds it, Restore takes it, and the summary calls it the DM doc', function (t) {
    var records = [S.makeRecord('tsi.dmdoc.layout', { v: 2, x: 1, y: 60, w: 440, h: 520 }, when), S.makeRecord('tsi.quests.accepted', [1], when)];
    var parsed = B.parse(JSON.stringify(B.makeSuiteBackup(records, when)));
    t.ok(parsed.ok, parsed.reason);
    t.equal(B.checkForSuite(parsed.backup), null, 'Restore accepts it');
    t.same(B.summarise(parsed.backup, function (id) { return id === 'quests' ? 'Notice Board Quest Generator' : null; }).lines,
      ['DM doc: 1 saved item', 'Notice Board Quest Generator: 1 saved item']);
  });

  test('the Quest box\'s text is in Back up everything and Restore with no other change', function (t) {
    var q = D.makeQuest('Session 12: the Ironbow gates.', Date.UTC(2026, 9, 22));
    var records = [S.makeRecord('tsi.dmdoc.layout', { v: 2, x: 1, y: 60, w: 440, h: 520 }, when), S.makeRecord(D.QUEST_KEY, q, when)];
    var parsed = B.parse(JSON.stringify(B.makeSuiteBackup(records, when)));
    t.ok(parsed.ok, parsed.reason);
    t.equal(B.checkForSuite(parsed.backup), null, 'Restore accepts it');
    t.same(B.summarise(parsed.backup, function () { return null; }).lines, ['DM doc: 2 saved items']);
    var kept = parsed.backup.records.filter(function (r) { return r.key === D.QUEST_KEY; })[0];
    t.same(D.cleanQuest(kept.value), q, 'the text comes back exactly');
  });

  test('a tool\'s own export can\'t carry the DM doc', function (t) {
    var file = B.makeToolBackup('quests', 'Notice Board Quest Generator', [S.makeRecord('tsi.dmdoc.layout', { v: 2, x: 1, y: 60, w: 440, h: 520 }, when)], when);
    t.ok(!B.parse(JSON.stringify(file)).ok);
    var quest = B.makeToolBackup('quests', 'Notice Board Quest Generator', [S.makeRecord(D.QUEST_KEY, D.makeQuest('secret', 1), when)], when);
    t.ok(!B.parse(JSON.stringify(quest)).ok, 'nor the Quest box\'s text');
  });

  test('whether it\'s open is kept per window, under a tsi. name, apart on the test page', function (t) {
    t.equal(S.spaceNames('suite').dmdocOpen, 'tsi.suite.dmdoc-open');
    t.equal(S.spaceNames('test').dmdocOpen, 'tsi.test:dmdoc-open');
  });

  group('DM doc: the Quest box');

  test('what is saved is { text, at }; anything else is tidied to that', function (t) {
    t.same(D.cleanQuest(null), { text: '', at: 0 });
    t.same(D.cleanQuest(undefined), { text: '', at: 0 });
    t.same(D.cleanQuest({ text: 'Hello', at: 1700000000000 }), { text: 'Hello', at: 1700000000000 });
    t.same(D.cleanQuest('just text'), { text: 'just text', at: 0 }, 'a plain string is the text');
    t.same(D.cleanQuest({ text: 42, at: 'soon' }), { text: '', at: 0 }, 'wrong types become empty');
    t.same(D.cleanQuest({ text: 'x', at: -5 }), { text: 'x', at: 0 });
    t.same(D.cleanQuest({ text: 'x', at: NaN }), { text: 'x', at: 0 });
    t.same(D.cleanQuest([1, 2]), { text: '', at: 0 }, 'an array is nothing');
    t.same(D.makeQuest('Hi', 5), { text: 'Hi', at: 5 });
    t.same(D.makeQuest(null, 5), { text: '', at: 5 });
  });

  test('the box holds up to 200,000 characters; longer saved text is cut at the limit, never more', function (t) {
    t.equal(D.QUEST_MAX, 200000);
    var exact = new Array(D.QUEST_MAX + 1).join('a');
    t.equal(D.cleanQuest({ text: exact, at: 1 }).text.length, 200000, 'exactly the limit is kept whole');
    t.equal(D.cleanQuest({ text: exact + 'b', at: 1 }).text.length, 200000, 'one over is cut');
    t.equal(D.makeQuest(exact + exact, 1).text.length, 200000);
  });

  test('two windows: the copy typed in last wins; a tie changes nothing', function (t) {
    var mine = { text: 'mine', at: 100 };
    var theirs = { text: 'theirs', at: 200 };
    t.same(D.newerQuest(mine, theirs), theirs, 'the other window typed later');
    t.same(D.newerQuest(theirs, mine), theirs, 'and the other way round');
    t.same(D.newerQuest(mine, { text: 'same time', at: 100 }), mine, 'a tie keeps mine');
    t.same(D.newerQuest(mine, null), mine, 'nothing saved elsewhere');
    t.same(D.newerQuest(null, theirs), theirs, 'nothing here yet');
    t.same(D.newerQuest(null, null), { text: '', at: 0 });
  });

  test('imported text is tidied: no byte-order mark or hidden characters, plain line endings, no big gaps', function (t) {
    t.equal(D.cleanImportedText('\uFEFFHello'), 'Hello', 'byte-order mark');
    t.equal(D.cleanImportedText('a\u0000b\u0007c\u001Fd'), 'abcd', 'control characters');
    t.equal(D.cleanImportedText('a\tb'), 'a\tb', 'a tab is kept');
    t.equal(D.cleanImportedText('one\r\ntwo\rthree\nfour'), 'one\ntwo\nthree\nfour', 'line endings');
    t.equal(D.cleanImportedText('one\n\n\n\n\n\ntwo'), 'one\n\n\ntwo', 'a run of blank lines is cut to two');
    t.equal(D.cleanImportedText('one\n\ntwo'), 'one\n\ntwo', 'one blank line is left alone');
    t.equal(D.cleanImportedText('one   \ntwo\t\nthree'), 'one\ntwo\nthree', 'trailing spaces');
    t.equal(D.cleanImportedText('  \n\n  Hello  \n\n'), 'Hello', 'trimmed at both ends');
    t.equal(D.cleanImportedText('a\u00A0b'), 'a b', 'a non-breaking space is a space');
    t.equal(D.cleanImportedText('a\u2028b'), 'a\nb', 'a line separator');
    t.equal(D.cleanImportedText('Ironbow \u2014 Kaelen\u2019s <b>bold</b>'), 'Ironbow \u2014 Kaelen\u2019s <b>bold</b>', 'real characters and angle brackets are untouched');
    t.equal(D.cleanImportedText(null), '');
    t.equal(D.cleanImportedText(undefined), '');
    t.equal(D.cleanImportedText(12), '12');
  });

  test('Replace or Add to the end: what the box would hold, and the limit', function (t) {
    t.same(D.joinQuest('old notes', 'new text', 'replace'), { ok: true, text: 'new text' });
    t.same(D.joinQuest('old notes\n', 'new text', 'append'), { ok: true, text: 'old notes\n\nnew text' }, 'after a blank line');
    t.same(D.joinQuest('', 'new text', 'append'), { ok: true, text: 'new text' }, 'an empty box: no blank lines in front');
    t.same(D.joinQuest('   \n', 'new text', 'append'), { ok: true, text: 'new text' }, 'a box of spaces counts as empty');
    t.same(D.joinQuest(null, '\uFEFFnew\r\ntext', 'replace'), { ok: true, text: 'new\ntext' }, 'tidied on the way in');
    var r = D.joinQuest('', '   \n  ', 'replace');
    t.ok(!r.ok && /no text/.test(r.message), 'nothing to import: ' + r.message);
    var big = new Array(D.QUEST_MAX + 2).join('x');
    r = D.joinQuest('', big, 'replace');
    t.ok(!r.ok && /200,000/.test(r.message) && /Nothing was imported/.test(r.message), 'over the limit: ' + r.message);
    var half = new Array(120001).join('x');
    t.ok(D.joinQuest('', half, 'replace').ok, 'on its own it fits');
    r = D.joinQuest(half, half, 'append');
    t.ok(!r.ok && /240,002/.test(r.message), 'but not added to an existing 120,000: ' + r.message);
    t.ok(D.joinQuest(half, half, 'replace').ok, 'replacing it does fit');
    t.ok(D.joinQuest(new Array(D.QUEST_MAX - 1).join('x'), 'y', 'replace').ok);
    t.equal(D.joinQuest(new Array(D.QUEST_MAX + 1).join('x'), 'y', 'append').ok, false, 'a full box has no room to add to');
  });

  test('the text file is named for the day', function (t) {
    t.equal(D.questFileName(new Date(2026, 9, 22, 14, 3).getTime()), 'dm-doc-quest-2026-10-22.txt');
  });

  test('the biggest file the import will try is 20 MB', function (t) {
    t.equal(D.IMPORT_MAX_BYTES, 20 * 1024 * 1024);
  });
}());
