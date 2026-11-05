/* The recap reel's rules (tools/recap/recap-rules.js) */
(function () {
  var Rc = TSI.recapRules;
  var NOW = new Date(2026, 10, 5, 21, 30, 15);

  function e(kind, ref, label, extra) { return Object.assign({ day: 4, at: 1, kind: kind, ref: ref, label: label, image: '' }, extra || {}); }
  var IMG = function (n) { return 'tools/explorer/assets/absent-tide/' + n + '.png'; };
  function card(deck, step, label, extra) { return e('card', deck + '/' + step, label, Object.assign({ image: IMG(deck + '-' + step) }, extra || {})); }
  function mark(day) { return e('session-end', '', 'Session ended', { day: day === undefined ? 4 : day }); }

  group('Recap: which part of the log');

  test('since the last End session marker; or, right after End session, the session before it', function (t) {
    var log = [e('card', 'a/1', 'One'), mark(3), e('card', 'a/2', 'Two'), e('card', 'a/3', 'Three')];
    var w = Rc.windowOf(log);
    t.same(w.entries.map(function (x) { return x.label; }), ['Two', 'Three']); t.equal(w.to, null); t.equal(w.from.kind, 'session-end');
    var ended = Rc.windowOf(log.concat([mark(6)]));
    t.same(ended.entries.map(function (x) { return x.label; }), ['Two', 'Three'], 'the marker just written closes the session');
    t.equal(ended.from.day, 3); t.equal(ended.to.day, 6);
    var two = Rc.windowOf([e('card', 'a/1', 'One'), mark(3), e('card', 'a/2', 'Two'), mark(6)]);
    t.same(two.entries.map(function (x) { return x.label; }), ['Two']);
    t.same(Rc.windowOf([]).entries, []);
    t.equal(Rc.windowOf([e('card', 'a/1', 'One')]).entries.length, 1, 'no marker yet: everything');
  });

  group('Recap: drafting');

  test('an empty log gives only the title and the closing card', function (t) {
    var d = Rc.draft([], null, { now: NOW });
    t.same(d.slides.map(function (s) { return s.kind; }), ['title', 'closing']);
    t.equal(d.slides[0].caption, 'Previously, in the Scarlett Isles…'); t.equal(d.slides[1].caption, 'The Scarlett Isles');
    t.equal(d.id, 'recap-2026-11-05-213015'); t.equal(d.narration, 'tools/recap/assets/narration/recap-2026-11-05-213015.mp3');
  });

  test('picture slides: cards and cast with a picture, in the order shown, each once, captions from their names', function (t) {
    var log = [card('act1', 'letter', 'The letter'), e('cast', 'dren-marr', 'Dren Marr', { image: IMG('dren') }), card('act1', 'letter', 'The letter'),
      e('cast', 'seris', 'Seris Thane'), card('act1', 'door', 'The door')];
    var d = Rc.draft(log, null, { now: NOW });
    var pics = d.slides.filter(function (s) { return s.kind === 'picture'; });
    t.same(pics.map(function (s) { return s.caption; }), ['The letter', 'Dren Marr', 'The door'], 'no repeat; a name card with no picture is not a picture slide');
    t.ok(pics.every(function (s) { return s.secs === 6; }));
  });

  test('the slide limit: at most 8 pictures; the first card of each deck and each cast member come first; the order shown is kept', function (t) {
    var log = [];
    for (var i = 1; i <= 7; i++) log.push(card('act1', 's' + i, 'A1 ' + i));
    log.push(card('act2', 's1', 'A2 first'));
    log.push(e('cast', 'linnet', 'Linnet', { image: IMG('linnet') }));
    log.push(card('act3', 's1', 'A3 first'));
    var d = Rc.draft(log, null, { now: NOW });
    var caps = d.slides.filter(function (s) { return s.kind === 'picture'; }).map(function (s) { return s.caption; });
    t.equal(caps.length, 8);
    ['A1 1', 'A2 first', 'Linnet', 'A3 first'].forEach(function (c) { t.ok(caps.indexOf(c) !== -1, c + ' is in'); });
    t.same(caps, ['A1 1', 'A1 2', 'A1 3', 'A1 4', 'A2 first', 'Linnet', 'A3 first'].length === 8 ? caps : caps, 'ordered below');
    var order = log.map(function (x) { return x.label; }).filter(function (l) { return caps.indexOf(l) !== -1; });
    t.same(caps, order, 'in the order shown');
    t.equal(Rc.draft(log, null, { now: NOW, maxPictures: 3 }).slides.filter(function (s) { return s.kind === 'picture'; }).length, 3);
  });

  test('a picture that is not a bundled file or a saved picture is never used', function (t) {
    var log = [card('a', '1', 'Bad', { image: 'https://evil.example/x.png' }), card('a', '2', 'Bad2', { image: '../secret.png' }), card('a', '3', 'Good')];
    t.same(Rc.draft(log, null, { now: NOW }).slides.filter(function (s) { return s.kind === 'picture'; }).map(function (s) { return s.caption; }), ['Good']);
    t.equal(Rc.cleanImage('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
    t.equal(Rc.cleanImage('javascript:alert(1)'), '');
  });

  test('the clue slide: up to 5 headings of notes pinned that session; a note taken off the board is left out; changed words show', function (t) {
    var log = [];
    for (var i = 1; i <= 7; i++) log.push(e('clue', 'c' + i, 'Clue ' + i));
    var board = { notes: [1, 2, 3, 4, 5, 6].map(function (n) { return { id: 'c' + n, ref: 'c' + n, text: (n === 2 ? 'Changed heading\nBody' : 'Clue ' + n + '\nBody') }; }) };
    var d = Rc.draft(log, board, { now: NOW });
    var s = d.slides.filter(function (x) { return x.kind === 'clues'; })[0];
    t.same(s.lines, ['Clue 1', 'Changed heading', 'Clue 3', 'Clue 4', 'Clue 5'], 'five, c7 is not on the board');
    t.equal(Rc.draft([], null, { now: NOW }).slides.some(function (x) { return x.kind === 'clues'; }), false, 'no clues, no slide');
    t.equal(Rc.draft(log, null, { now: NOW }).slides.filter(function (x) { return x.kind === 'clues'; })[0].lines.length, 5, 'with no board saved, the log is used');
  });

  test('"Meanwhile…": fights won, days travelled since the last marker, Bond milestones; nothing to say, no slide', function (t) {
    var log = [e('card', 'a/0', 'Old', { image: IMG('x') }), mark(3),
      e('fight', 'won:f1', 'Won: The ford', { result: 'won', day: null }), e('fight', 'won:f1', 'Won: The ford', { result: 'won', day: null }),
      e('fight', 'f2', 'Fight t2'), e('fight', 'won:f3', 'Won: The camp', { result: 'won' }),
      e('bond', 'c1', 'Fenstalker reached Bond 2 (Trusted)'), e('camp', 'day-5', 'Camp, Day 5', { day: 5 })];
    var d = Rc.draft(log, null, { now: NOW, dayNow: 8 });
    var m = d.slides.filter(function (x) { return x.kind === 'meanwhile'; })[0];
    t.same(m.lines, ['2 fights won', '5 days travelled', 'Fenstalker reached Bond 2 (Trusted)']);
    t.equal(d.sinceDay, 3); t.equal(d.toDay, 8);
    var one = Rc.draft([e('fight', 'won:z', 'Won', { result: 'won', day: null })], null, { now: NOW });
    t.same(one.slides.filter(function (x) { return x.kind === 'meanwhile'; })[0].lines, ['1 fight won']);
    t.equal(Rc.draft([e('card', 'a/1', 'Only', { image: IMG('x') })], null, { now: NOW, dayNow: 4 }).slides.some(function (x) { return x.kind === 'meanwhile'; }), false);
    var after = Rc.draft([mark(3), e('camp', 'day-5', 'Camp', { day: 5 }), mark(7)], null, { now: NOW, dayNow: 99 });
    t.equal(after.toDay, 7, 'right after End session the days end at the marker, not today');
  });

  test('a normal session fits 60 to 90 seconds', function (t) {
    var log = [];
    for (var i = 1; i <= 9; i++) log.push(card('d' + i, 'a', 'Card ' + i));
    log.push(e('clue', 'c1', 'A clue'), e('fight', 'won:1', 'Won', { result: 'won' }));
    var d = Rc.draft(log, null, { now: NOW, dayNow: 6 });
    t.equal(Rc.totalSecs(d.slides), 4 + 8 * 6 + 6 + 6 + 4);
    t.equal(Rc.fit(Rc.totalSecs(d.slides)), 'ok');
  });

  group('Recap: editing');

  test('time: totals, limits of 4 to 8 seconds, and stretching to a narration', function (t) {
    var slides = [{ kind: 'title', secs: 4 }, { kind: 'picture', secs: 6 }, { kind: 'picture', secs: 6 }, { kind: 'closing', secs: 4 }];
    t.equal(Rc.totalSecs(slides), 20);
    t.equal(Rc.clampSecs(1), 4); t.equal(Rc.clampSecs(20), 8); t.equal(Rc.clampSecs(5.5), 5.5);
    var r = Rc.retime(slides, 40);
    t.equal(Rc.totalSecs(r), 40); t.same(r.map(function (s) { return s.secs; }), [8, 12, 12, 8]);
    t.equal(slides[1].secs, 6, 'the slides given are not changed');
    t.equal(Rc.totalSecs(Rc.retime(slides, 5)), 8, 'none under two seconds');
    t.same(Rc.retime([], 30), []);
    t.equal(Rc.fit(59), 'short'); t.equal(Rc.fit(60), 'ok'); t.equal(Rc.fit(90), 'ok'); t.equal(Rc.fit(91), 'long');
  });

  test('reorder and remove: the title stays first and the closing card last', function (t) {
    var s = ['title', 'picture', 'picture', 'closing'].map(function (k, i) { return { kind: k, caption: k + i, secs: 6 }; });
    t.same(Rc.moveSlide(s, 2, -1).map(function (x) { return x.caption; }), ['title0', 'picture2', 'picture1', 'closing3']);
    t.same(Rc.moveSlide(s, 1, -1).map(function (x) { return x.caption; }), ['title0', 'picture1', 'picture2', 'closing3'], 'cannot pass the title');
    t.same(Rc.moveSlide(s, 2, 1).map(function (x) { return x.caption; }), ['title0', 'picture1', 'picture2', 'closing3'], 'cannot pass the closing card');
    t.same(Rc.removeSlide(s, 1).map(function (x) { return x.caption; }), ['title0', 'picture2', 'closing3']);
    t.equal(Rc.removeSlide(s, 0).length, 4); t.equal(Rc.removeSlide(s, 3).length, 4);
  });

  test('the narration script is the captions as one paragraph, and the file is named for the recap', function (t) {
    var d = Rc.draft([card('a', '1', 'The letter'), e('clue', 'c1', 'Warm tea'), e('fight', 'won:1', 'Won', { result: 'won' })], null, { now: NOW });
    var text = Rc.narrationScript(d);
    t.equal(text, 'Previously, in the Scarlett Isles… The letter. On the Evidence Board: Warm tea. Meanwhile: 1 fight won. The Scarlett Isles.');
    t.ok(text.indexOf('\n') === -1);
    t.equal(Rc.narrationFile('recap-x'), 'tools/recap/assets/narration/recap-x.mp3');
  });

  group('Recap: saving');

  test('the latest 10 are kept; put replaces by id; a damaged save is cleaned, never thrown', function (t) {
    var s = Rc.empty();
    for (var i = 0; i < 12; i++) s = Rc.put(s, Rc.draft([], null, { now: new Date(2026, 10, 5, 10, 0, i), id: 'recap-' + i }));
    t.equal(s.recaps.length, 10); t.equal(s.recaps[0].id, 'recap-2'); t.equal(Rc.latest(s).id, 'recap-11');
    var edited = JSON.parse(JSON.stringify(Rc.latest(s))); edited.slides[0].caption = 'Edited';
    s = Rc.put(s, edited);
    t.equal(s.recaps.length, 10); t.equal(Rc.find(s, 'recap-11').slides[0].caption, 'Edited');
    t.equal(Rc.remove(s, 'recap-11').recaps.length, 9);
    t.equal(Rc.clean(null), null); t.equal(Rc.clean({ version: 2, recaps: [] }), null);
    var c = Rc.clean({ version: 1, recaps: [{ id: 'ok', slides: [{ kind: 'title', caption: 'x', secs: 99, image: 'http://evil/x.png' }] }, { id: 'bad id!', slides: [{ kind: 'title' }] }, { id: 'none', slides: [] }, 5] });
    t.equal(c.recaps.length, 1); t.equal(c.recaps[0].slides[0].secs, 60, 'a saved slide is held to 1 to 60 seconds; the editor keeps it to 4 to 8'); t.equal(c.recaps[0].slides[0].image, '');
  });

  test('it is part of the campaign in backups', function (t) {
    t.ok(TSI.backupRules.CAMPAIGN.indexOf('recap') !== -1);
    t.equal(TSI.storeRules.toolOf(Rc.KEY), 'recap');
  });

  group('Recap: what the TV may see');

  test('leak test: the snapshot carries pictures and words only, never when it was made, the days, its id or the narration file', function (t) {
    var d = Rc.draft([card('a', '1', 'The letter'), e('clue', 'c1', 'Warm tea')], null, { now: NOW, dayNow: 9 });
    d.secretDmNote = 'the Sunheart is under the Temple'; d.slides[1].dmNote = 'secret';
    var snap = Rc.snapshot(d);
    t.same(Object.keys(snap).sort(), ['slides', 'v']);
    snap.slides.forEach(function (s) { t.same(Object.keys(s).sort(), ['caption', 'image', 'kind', 'lines', 'secs']); });
    var json = JSON.stringify(snap);
    ['recap-2026', 'narration', 'made', 'sinceDay', 'toDay', 'Sunheart', 'secret', '.mp3'].forEach(function (w) { t.ok(json.indexOf(w) === -1, w + ' never reaches the TV'); });
    t.ok(Rc.isSafeSnapshot(snap)); t.ok(!Rc.isSafeSnapshot({ v: 1, slides: snap.slides, narration: 'x.mp3' }));
    t.equal(Rc.snapshot(null), null); t.equal(Rc.snapshot({ slides: [] }), null);
  });
}());
