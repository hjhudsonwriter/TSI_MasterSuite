/* The Scarlett Isles: D&D Tool Suite — the Evidence Board's rules (plain functions, tested in tests/rules.html).
   The board is a wall of notes pinned up for the players: what the party has found. It is saved as tsi.evidence.state:
     { version: 1, board: 'c2', title, notes: [], strings: [], prepared: [] }
   A note:     { id, text, image, x, y, tilt, addedDay, from: 'seed'|'board'|'dm-doc'|'cue', ref }
               x and y are percentages of the board (the middle of the note); tilt is a small angle (±4°).
               The first line of text is the note's heading. image is '' or a picture (a bundled path or an uploaded data URL).
   A string:   { id, a, b }  red string between two notes.
   Prepared:   { id, text, image, scene }  clues ready to award, hidden from the players until awarded.
   Every function returns a new state and never changes the one it is given. snapshot(state) is what the players may see:
   the prepared clues, where a note came from and the day it was added never leave the DM's side. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  var MAX_TEXT = 200;
  var MAX_IMAGE = 1500000;       /* an uploaded picture's data URL, in characters */
  var MAX_NOTES = 120;
  var NOTE_W = 15.5, NOTE_H = 19;   /* a note's size in percent of the board (the board is 16:9), for finding free space */
  var LO_X = 9, HI_X = 91, LO_Y = 13, HI_Y = 87;
  var FROM = ['seed', 'board', 'dm-doc', 'cue'];

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function clampPct(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function cleanText(t, max) { return String(t === undefined || t === null ? '' : t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max || MAX_TEXT); }
  function cleanImage(v) {
    v = typeof v === 'string' ? v : '';
    if (!v) return '';
    if (v.indexOf('data:image/') === 0) return v.length <= MAX_IMAGE ? v : '';
    return /^tools\/[A-Za-z0-9_\-\/.]+\.(png|jpe?g|webp)$/.test(v) ? v : '';
  }
  function copy(state) { return JSON.parse(JSON.stringify(state)); }

  var rules = {
    MAX_TEXT: MAX_TEXT, NOTE_W: NOTE_W, NOTE_H: NOTE_H, FROM: FROM, KEY: 'tsi.evidence.state',
    TITLE: 'The Tides That Remember',

    heading: function (text) { return String(text || '').split('\n')[0].trim(); },
    body: function (text) { return String(text || '').split('\n').slice(1).join('\n').trim(); },

    empty: function () { return { version: 1, board: 'c2', title: rules.TITLE, notes: [], strings: [], prepared: [] }; },

    cleanNote: function (raw) {
      if (!isObj(raw)) return null;
      var text = cleanText(raw.text);
      if (!text) return null;
      var id = str(raw.id, 60);
      if (!id) return null;
      return {
        id: id, text: text, image: cleanImage(raw.image),
        x: clampPct(num(raw.x, 50), 3, 97), y: clampPct(num(raw.y, 50), 3, 97),
        tilt: clampPct(num(raw.tilt, 0), -4, 4),
        addedDay: raw.addedDay === null || raw.addedDay === undefined ? null : Math.floor(num(raw.addedDay, 0)),
        from: FROM.indexOf(raw.from) !== -1 ? raw.from : 'board', ref: str(raw.ref, 60)
      };
    },

    /* A saved board, cleaned; null if it is not one. Notes with the same id keep the first; strings must join two notes that exist. */
    clean: function (raw) {
      if (!isObj(raw) || raw.version !== 1 || !Array.isArray(raw.notes)) return null;
      var seen = {}, notes = [];
      raw.notes.slice(0, MAX_NOTES).forEach(function (n) { var c = rules.cleanNote(n); if (c && !seen[c.id]) { seen[c.id] = 1; notes.push(c); } });
      var strings = [], pair = {};
      (Array.isArray(raw.strings) ? raw.strings : []).slice(0, 400).forEach(function (s) {
        if (!isObj(s)) return;
        var a = str(s.a, 60), b = str(s.b, 60), id = str(s.id, 60);
        var k = [a, b].sort().join('|');
        if (!id || a === b || !seen[a] || !seen[b] || pair[k]) return;
        pair[k] = 1; strings.push({ id: id, a: a, b: b });
      });
      var prepared = [], pseen = {};
      (Array.isArray(raw.prepared) ? raw.prepared : []).slice(0, 200).forEach(function (p) {
        if (!isObj(p)) return;
        var id = str(p.id, 60), text = cleanText(p.text);
        if (!id || !text || pseen[id] || seen[id]) return;
        pseen[id] = 1; prepared.push({ id: id, text: text, image: cleanImage(p.image), scene: str(p.scene, 40) });
      });
      return { version: 1, board: 'c2', title: str(raw.title, 80) || rules.TITLE, notes: notes, strings: strings, prepared: prepared };
    },

    /* The first time: pin the seed rows marked pin, and keep the rest ready to award. seed: { notes: [...], prepared: [...] } */
    fresh: function (seed, rand) {
      /* The same tilts every time (so two windows that both make a fresh board agree before anything is saved). */
      if (!rand) { var seedN = 20261104; rand = function () { seedN = (seedN * 1664525 + 1013904223) % 4294967296; return seedN / 4294967296; }; }
      var s = rules.empty();
      seed = seed || {};
      (seed.notes || []).forEach(function (n) {
        var r = rules.addNote(s, { id: n.id, text: n.text, image: n.image || '', from: 'seed', ref: n.id, day: null }, { rand: rand });
        s = r.state;
      });
      s.prepared = (seed.prepared || []).map(function (p) { return { id: String(p.id), text: cleanText(p.text), image: cleanImage(p.image), scene: str(p.scene, 40) }; }).filter(function (p) { return p.id && p.text; });
      return s;
    },

    nextId: function (state) {
      var n = 0;
      state.notes.concat(state.strings).forEach(function (x) { var m = /^[a-z]+-(\d+)$/.exec(x.id); if (m) n = Math.max(n, Number(m[1])); });
      return n + 1;
    },

    /* A spot clear of the other notes, as { x, y }. Tries a grid left to right, top to bottom; if the board is full, the spot
       with the least overlap. */
    placeFree: function (notes) {
      var best = null, bestScore = 1e9;
      for (var y = LO_Y + 5; y <= HI_Y - 5; y += 3) {
        for (var x = LO_X + 5; x <= HI_X - 5; x += 3) {
          var score = 0;
          for (var i = 0; i < notes.length; i++) {
            var ox = NOTE_W - Math.abs(notes[i].x - x), oy = NOTE_H - Math.abs(notes[i].y - y);
            if (ox > 0 && oy > 0) score += ox * oy;
          }
          if (score === 0) return { x: x, y: y };
          if (score < bestScore) { bestScore = score; best = { x: x, y: y }; }
        }
      }
      return best || { x: 50, y: 50 };
    },

    /* opts.text, image, from, ref, day, id, x, y, tilt. o.rand makes the tilt (tests give their own). Returns { state, note } (note null if nothing was added). */
    addNote: function (state, opts, o) {
      o = o || {};
      var text = cleanText(opts.text, o.max);
      if (!text || state.notes.length >= MAX_NOTES) return { state: state, note: null };
      var s = copy(state);
      var id = opts.id && !s.notes.some(function (n) { return n.id === opts.id; }) && !s.prepared.some(function (n) { return n.id === opts.id; }) ? String(opts.id) : 'n-' + rules.nextId(s);
      var spot = typeof opts.x === 'number' && typeof opts.y === 'number' ? { x: opts.x, y: opts.y } : rules.placeFree(s.notes);
      var rand = o.rand || Math.random;
      var note = rules.cleanNote({
        id: id, text: text, image: opts.image || '', x: spot.x, y: spot.y,
        tilt: typeof opts.tilt === 'number' ? opts.tilt : Math.round((rand() * 8 - 4) * 10) / 10,
        addedDay: opts.day === undefined ? null : opts.day, from: opts.from || 'board', ref: opts.ref || ''
      });
      s.notes.push(note);
      return { state: s, note: note };
    },

    editNote: function (state, id, change, o) {
      var i = state.notes.findIndex(function (n) { return n.id === id; });
      if (i < 0) return state;
      var text = change && change.text !== undefined ? cleanText(change.text, o && o.max) : state.notes[i].text;
      if (!text) return state;
      var s = copy(state);
      s.notes[i].text = text;
      if (change && change.image !== undefined) s.notes[i].image = cleanImage(change.image);
      return s;
    },

    moveNote: function (state, id, x, y) {
      var i = state.notes.findIndex(function (n) { return n.id === id; });
      if (i < 0 || !isFinite(x) || !isFinite(y)) return state;
      var s = copy(state);
      s.notes[i].x = clampPct(x, 3, 97); s.notes[i].y = clampPct(y, 3, 97);
      return s;
    },

    /* Taking a note down also takes down its strings. */
    removeNote: function (state, id) {
      if (!state.notes.some(function (n) { return n.id === id; })) return state;
      var s = copy(state);
      s.notes = s.notes.filter(function (n) { return n.id !== id; });
      s.strings = s.strings.filter(function (t) { return t.a !== id && t.b !== id; });
      return s;
    },

    /* Red string between two notes: not to itself, not twice (either way round), both must be on the board. */
    tie: function (state, a, b) {
      if (!a || !b || a === b) return state;
      var has = function (id) { return state.notes.some(function (n) { return n.id === id; }); };
      if (!has(a) || !has(b)) return state;
      if (state.strings.some(function (t) { return (t.a === a && t.b === b) || (t.a === b && t.b === a); })) return state;
      var s = copy(state);
      s.strings.push({ id: 's-' + rules.nextId(s), a: a, b: b });
      return s;
    },

    /* by a string's id, or by the two notes' ids */
    untie: function (state, idOrA, b) {
      var s = copy(state);
      s.strings = s.strings.filter(function (t) { return b === undefined ? t.id !== idOrA : !((t.a === idOrA && t.b === b) || (t.a === b && t.b === idOrA)); });
      return s.strings.length === state.strings.length ? state : s;
    },

    /* A prepared clue goes up on the board (placed in free space). Returns { state, note }. */
    award: function (state, id, o) {
      o = o || {};
      var p = state.prepared.filter(function (x) { return x.id === id; })[0];
      if (!p) return { state: state, note: null };
      var s = copy(state);
      s.prepared = s.prepared.filter(function (x) { return x.id !== id; });
      var r = rules.addNote(s, { id: p.id, text: p.text, image: p.image, from: 'cue', ref: p.id, day: o.day }, { rand: o.rand, max: 400 });
      return r;
    },

    /* What the players may see: the title, and each note's id, words, picture, place and tilt, and the strings. Nothing else. */
    snapshot: function (state) {
      if (!state || !Array.isArray(state.notes)) return { title: rules.TITLE, notes: [], strings: [] };
      return {
        title: str(state.title, 80) || rules.TITLE,
        notes: state.notes.map(function (n) { return { id: n.id, text: n.text, image: n.image, x: n.x, y: n.y, tilt: n.tilt }; }),
        strings: state.strings.map(function (t) { return { id: t.id, a: t.a, b: t.b }; })
      };
    },

    /* Is this clean-looking snapshot safe to draw? (The players' window cleans what it is sent again.) */
    cleanSnapshot: function (raw) {
      if (!isObj(raw) || !Array.isArray(raw.notes)) return null;
      var st = { version: 1, notes: raw.notes, strings: raw.strings, prepared: [], title: raw.title };
      var c = rules.clean(st);
      return c ? rules.snapshot(c) : null;
    },

    /* Every note's words, with the day it went up, for the DM's canon notes. */
    copyText: function (state) {
      return state.notes.map(function (n) { return (n.addedDay === null || n.addedDay === undefined ? '' : 'Day ' + n.addedDay + ': ') + n.text.replace(/\n+/g, ' | '); }).join('\n');
    },

    /* What the table log is told when a note goes up. */
    logEntry: function (note, day) {
      return { kind: 'clue', ref: note.ref || note.id, label: rules.heading(note.text) || 'A note', image: note.image && note.image.indexOf('data:') !== 0 ? note.image : '', day: day };
    }
  };

  TSI.evidenceRules = rules;
}());
