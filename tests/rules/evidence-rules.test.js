/* The Evidence Board's rules (shared/js/evidence-rules.js) and what its save is kept with. */
(function () {
  var E = TSI.evidenceRules;
  var SEED = window.TSI_DATA.evidenceSeed;
  var fixed = function () { return 0.5; };
  function board() { return E.fresh(SEED); }

  group('Evidence Board');

  test('a fresh board pins the seed notes in free space and keeps the rest ready to award; the same every time', function (t) {
    var s = board();
    t.equal(s.version, 1); t.equal(s.board, 'c2'); t.equal(s.title, 'The Tides That Remember');
    t.equal(s.notes.length, SEED.notes.length);
    t.equal(s.prepared.length, SEED.prepared.length);
    t.same(s.strings, []);
    t.equal(JSON.stringify(s), JSON.stringify(board()), 'two windows making a fresh board agree');
    s.notes.forEach(function (a, i) { s.notes.forEach(function (b, j) { if (i < j) t.ok(Math.abs(a.x - b.x) >= E.NOTE_W - 0.01 || Math.abs(a.y - b.y) >= E.NOTE_H - 0.01, a.id + ' and ' + b.id + ' do not overlap'); }); });
    s.notes.forEach(function (n) { t.equal(n.from, 'seed'); t.ok(Math.abs(n.tilt) <= 4); });
  });

  test('add: trimmed, the first line is the heading, capped at 200, nothing empty, placed in free space', function (t) {
    var s = E.empty();
    var r = E.addNote(s, { text: '  The key\nIt was warm.  ', from: 'board', day: 5 }, { rand: fixed });
    t.equal(r.note.text, 'The key\nIt was warm.'); t.equal(E.heading(r.note.text), 'The key'); t.equal(r.note.addedDay, 5); t.equal(r.note.tilt, 0);
    t.equal(s.notes.length, 0, 'the old state is untouched');
    t.equal(E.addNote(r.state, { text: '   ' }).note, null);
    t.equal(E.addNote(E.empty(), { text: 'x'.repeat(500) }).note.text.length, 200);
    var r2 = E.addNote(r.state, { text: 'Second' }, { rand: fixed });
    t.ok(Math.abs(r2.note.x - r.note.x) >= E.NOTE_W || Math.abs(r2.note.y - r.note.y) >= E.NOTE_H, 'not on top of the first');
    t.ok(r.note.id !== r2.note.id);
  });

  test('a full board still takes a note (overlapping a little); never more than 120', function (t) {
    var s = E.empty();
    for (var i = 0; i < 60; i++) s = E.addNote(s, { text: 'n' + i }, { rand: fixed }).state;
    t.equal(s.notes.length, 60);
    s.notes.forEach(function (n) { t.ok(n.x >= 3 && n.x <= 97 && n.y >= 3 && n.y <= 97); });
  });

  test('edit, move (kept on the board), remove (and its strings go)', function (t) {
    var s = E.addNote(E.addNote(E.empty(), { text: 'A', id: 'a' }, { rand: fixed }).state, { text: 'B', id: 'b' }, { rand: fixed }).state;
    s = E.tie(s, 'a', 'b');
    t.equal(s.strings.length, 1);
    t.equal(E.editNote(s, 'a', { text: 'A2' }).notes[0].text, 'A2');
    t.equal(E.editNote(s, 'a', { text: '  ' }), s, 'an empty edit changes nothing');
    var m = E.moveNote(s, 'a', 150, -20);
    t.same([m.notes[0].x, m.notes[0].y], [97, 3]);
    t.equal(E.moveNote(s, 'zzz', 5, 5), s);
    var r = E.removeNote(s, 'a');
    t.same(r.notes.map(function (n) { return n.id; }), ['b']);
    t.same(r.strings, []);
    t.equal(E.removeNote(s, 'zzz'), s);
  });

  test('tie: not to itself, not twice (either way round), both notes must exist; untie by string or by notes', function (t) {
    var s = E.addNote(E.addNote(E.empty(), { text: 'A', id: 'a' }, { rand: fixed }).state, { text: 'B', id: 'b' }, { rand: fixed }).state;
    t.equal(E.tie(s, 'a', 'a'), s);
    t.equal(E.tie(s, 'a', 'nope'), s);
    var t1 = E.tie(s, 'a', 'b');
    t.equal(t1.strings.length, 1);
    t.equal(E.tie(t1, 'b', 'a'), t1);
    t.equal(E.untie(t1, t1.strings[0].id).strings.length, 0);
    t.equal(E.untie(t1, 'b', 'a').strings.length, 0);
    t.equal(E.untie(t1, 'zzz'), t1);
  });

  test('award moves a prepared clue onto the board once, with its picture', function (t) {
    var s = board();
    var n0 = s.notes.length, p0 = s.prepared.length;
    var r = E.award(s, 'maerys-letter', { day: 3, rand: fixed });
    t.equal(r.state.notes.length, n0 + 1); t.equal(r.state.prepared.length, p0 - 1);
    t.equal(r.note.from, 'cue'); t.equal(r.note.addedDay, 3); t.ok(/04-letter\.png$/.test(r.note.image));
    t.equal(E.award(r.state, 'maerys-letter').note, null, 'a second time does nothing');
    t.equal(E.award(s, 'no-such-clue').note, null);
  });

  test('the snapshot is only what the players may see: never the prepared clues, where a note came from, or the day', function (t) {
    var s = E.award(board(), 'warm-tea', { day: 2, rand: fixed }).state;
    s.notes[0].from = 'dm-doc'; s.notes[0].ref = 'SECRET-REF';
    var snap = E.snapshot(s);
    var json = JSON.stringify(snap);
    t.same(Object.keys(snap).sort(), ['notes', 'strings', 'title']);
    t.same(Object.keys(snap.notes[0]).sort(), ['id', 'image', 'text', 'tilt', 'x', 'y']);
    s.prepared.forEach(function (p) { t.ok(json.indexOf(p.text.split('\n')[0]) === -1 || s.notes.some(function (n) { return n.text === p.text; }), 'prepared clue not in the snapshot: ' + p.id); });
    t.ok(json.indexOf('SECRET-REF') === -1 && json.indexOf('addedDay') === -1 && json.indexOf('dm-doc') === -1 && json.indexOf('prepared') === -1);
    t.equal(snap.notes.length, s.notes.length);
    var tricked = E.cleanSnapshot({ title: 'x', notes: s.notes, strings: [], prepared: [{ id: 'p', text: 'LEAK' }], extra: 'LEAK' });
    t.ok(JSON.stringify(tricked).indexOf('LEAK') === -1, 'a snapshot with extras is cleaned');
  });

  test('a saved board is cleaned: bad notes and strings dropped, pictures limited, nothing thrown', function (t) {
    t.equal(E.clean(null), null); t.equal(E.clean({ version: 2, notes: [] }), null);
    var c = E.clean({ version: 1, notes: [{ id: 'a', text: 'A', x: 500, y: -5, tilt: 90, image: 'http://evil/x.png' }, { id: 'a', text: 'dup' }, { id: 'b', text: '' }, { text: 'no id' }, { id: 'c', text: 'C', image: 'tools/explorer/assets/x.png' }],
      strings: [{ id: 's1', a: 'a', b: 'c' }, { id: 's2', a: 'c', b: 'a' }, { id: 's3', a: 'a', b: 'a' }, { id: 's4', a: 'a', b: 'gone' }], prepared: [{ id: 'a', text: 'clash' }, { id: 'p', text: 'P' }] });
    t.same(c.notes.map(function (n) { return n.id; }), ['a', 'c']);
    t.same([c.notes[0].x, c.notes[0].y, c.notes[0].tilt, c.notes[0].image], [97, 3, 4, '']);
    t.equal(c.notes[1].image, 'tools/explorer/assets/x.png');
    t.same(c.strings.map(function (s) { return s.id; }), ['s1']);
    t.same(c.prepared.map(function (p) { return p.id; }), ['p']);
  });

  test('copy as text carries the day; the table log entry has the heading and no uploaded picture', function (t) {
    var s = E.addNote(E.empty(), { text: 'Head\nBody', day: 4, image: 'data:image/png;base64,AAAA' }, { rand: fixed });
    t.equal(E.copyText(s.state), 'Day 4: Head | Body');
    var le = E.logEntry(s.note, 4);
    t.same([le.kind, le.label, le.image, le.day], ['clue', 'Head', '', 4]);
  });

  test('it is part of the campaign (Explorer Export/Import, Back up everything, Restore only some) and snapshots', function (t) {
    t.ok(TSI.backupRules.CAMPAIGN.indexOf('evidence') !== -1);
    t.equal(TSI.storeRules.toolOf(E.KEY), 'evidence');
    var items = TSI.snapshotRules.makeItems({ a: 1 }, { b: 1 }, { notes: [] });
    t.same(Object.keys(items).sort(), ['bastion', 'evidence', 'explorer']);
    var oldSnap = { items: TSI.snapshotRules.makeItems({ a: 1 }, null) };
    var out = TSI.snapshotRules.rollbackRecords([{ key: E.KEY, value: { keep: 1 } }], oldSnap, 0);
    t.ok(out.some(function (r) { return r.key === E.KEY; }), 'an older snapshot leaves the board alone');
  });
}());
