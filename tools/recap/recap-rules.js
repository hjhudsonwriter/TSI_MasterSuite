/* "Previously, in the Scarlett Isles…" — the recap reel's rules (guide 4, 5 November 2026). Plain functions, tested in tests/rules.html.
   A recap is a short reel (60 to 90 seconds) of what the players saw last session, drafted from the table log (shared/js/tablelog-rules.js):
     { id, made, sinceDay, toDay, title, narration, slides: [{ kind, image, caption, lines, secs }] }
   slide kinds: title (the opening words), picture (a card or portrait shown, with a one-line caption), clues (the notes pinned to the
   Evidence Board that session, up to 5 headings), meanwhile (fights won, days travelled, bond milestones), closing (the closing card).
   It is saved as tsi.recap.state { version: 1, recaps: [...] }, the latest 10. snapshot(recap) is all the TV may ever be sent: pictures and
   words, never when it was made, the days, or where the narration file is. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  var OPENING = 'Previously, in the Scarlett Isles…';
  var CLOSING = 'The Scarlett Isles';
  var MAX_RECAPS = 10;
  var MAX_PICTURES = 8;
  var MAX_CLUES = 5;
  var SECS = { title: 4, picture: 6, clues: 6, meanwhile: 6, closing: 4 };
  var MIN_SECS = 4, MAX_SECS = 8, FLOOR_SECS = 2;
  var TARGET = { min: 60, max: 90 };
  var KINDS = ['title', 'picture', 'clues', 'meanwhile', 'closing'];
  var NARRATION_FOLDER = 'tools/recap/assets/narration/';

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function oneLine(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function sentence(s) { s = String(s || '').trim(); return !s ? '' : /[.!?…]$/.test(s) ? s : s + '.'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  var rules = {
    OPENING: OPENING, CLOSING: CLOSING, MAX_RECAPS: MAX_RECAPS, MAX_PICTURES: MAX_PICTURES, MAX_CLUES: MAX_CLUES,
    SECS: SECS, MIN_SECS: MIN_SECS, MAX_SECS: MAX_SECS, TARGET: TARGET, KINDS: KINDS, KEY: 'tsi.recap.state', NARRATION_FOLDER: NARRATION_FOLDER,

    /* A picture that may be drawn: a bundled one (under tools/ or shared/) or one already held in a save (a data URL). Nothing from the internet. */
    cleanImage: function (v) {
      v = typeof v === 'string' ? v : '';
      if (!v) return '';
      if (v.indexOf('data:image/') === 0) return v.length <= 1500000 ? v : '';
      return /^(tools|shared)\/[A-Za-z0-9_\-\/. ]+\.(png|jpe?g|webp)$/i.test(v) && v.indexOf('..') === -1 ? v : '';
    },

    narrationFile: function (id) { return NARRATION_FOLDER + String(id) + '.mp3'; },

    clampSecs: function (v) { var n = Math.round(num(Number(v), SECS.picture) * 10) / 10; return Math.max(MIN_SECS, Math.min(MAX_SECS, n)); },

    /* ---------- Which part of the table log is this recap about? ----------
       Since the last End session marker if anything has happened since; if not (End session was just pressed, which writes its marker first),
       the session before it: from the marker before that one to the last marker. Returns { entries, from, to } (from and to are markers or null). */
    windowOf: function (log) {
      log = Array.isArray(log) ? log : [];
      var marks = [];
      log.forEach(function (e, i) { if (e && e.kind === 'session-end') marks.push(i); });
      var last = marks.length ? marks[marks.length - 1] : -1;
      var after = log.slice(last + 1);
      if (after.length || last === -1) return { entries: after, from: last === -1 ? null : log[last], to: null };
      var prev = marks.length > 1 ? marks[marks.length - 2] : -1;
      return { entries: log.slice(prev + 1, last), from: prev === -1 ? null : log[prev], to: log[last] };
    },

    /* The pictures to show: cards and cast with a picture, each thing once (its first showing), at most max, in the order shown.
       When there are more than max, each deck's first card and each cast member's first appearance come first. */
    picturesFrom: function (entries, max) {
      max = max === undefined ? MAX_PICTURES : max;
      var seen = {}, decks = {}, list = [];
      (entries || []).forEach(function (e, i) {
        if (!e || (e.kind !== 'card' && e.kind !== 'cast')) return;
        var image = rules.cleanImage(e.image);
        if (!image) return;
        var ref = e.kind + ':' + (e.ref || e.label);
        if (seen[ref]) return;
        seen[ref] = 1;
        var deck = e.kind === 'card' ? String(e.ref || '').split('/')[0] : '';
        var first = e.kind === 'cast' || !decks[deck];
        if (e.kind === 'card') decks[deck] = 1;
        list.push({ order: i, rank: first ? 0 : 1, entry: e, image: image });
      });
      var chosen = list.slice().sort(function (a, b) { return a.rank - b.rank || a.order - b.order; }).slice(0, Math.max(0, max));
      return chosen.sort(function (a, b) { return a.order - b.order; }).map(function (c) {
        return { kind: 'picture', image: c.image, caption: oneLine(c.entry.label, 120), lines: [], secs: SECS.picture };
      });
    },

    /* Headings of the notes pinned to the Evidence Board that session (up to 5). A note since taken off the board is left out, and one
       whose words were changed shows its new heading. evidence is the board's save, or null. */
    clueHeadings: function (entries, evidence, max) {
      max = max === undefined ? MAX_CLUES : max;
      var seen = {}, out = [];
      var notes = evidence && Array.isArray(evidence.notes) ? evidence.notes : null;
      (entries || []).forEach(function (e) {
        if (!e || e.kind !== 'clue') return;
        var key = e.ref || e.label;
        if (seen[key]) return;
        seen[key] = 1;
        var heading = oneLine(e.label, 80);
        if (notes) {
          var n = notes.filter(function (x) { return x.id === e.ref || x.ref === e.ref; })[0];
          if (!n) return;
          heading = oneLine(String(n.text || '').split('\n')[0], 80) || heading;
        }
        if (heading) out.push(heading);
      });
      return out.slice(0, Math.max(0, max));
    },

    /* The "Meanwhile…" lines: fights won, days travelled, bond milestones. */
    meanwhileLines: function (entries, win, dayNow) {
      var lines = [];
      var won = {}, wonCount = 0;
      (entries || []).forEach(function (e) {
        if (e && e.kind === 'fight' && e.result === 'won') { var k = e.ref || e.label; if (!won[k]) { won[k] = 1; wonCount++; } }
      });
      if (wonCount) lines.push(plural(wonCount, 'fight won', 'fights won'));
      var days = rules.daysTravelled(entries, win, dayNow);
      if (days > 0) lines.push(plural(days, 'day travelled', 'days travelled'));
      var seenBond = {};
      (entries || []).forEach(function (e) {
        if (e && e.kind === 'bond') { var k = e.ref + '|' + e.label; if (!seenBond[k] && lines.length < 9) { seenBond[k] = 1; lines.push(oneLine(e.label, 120)); } }
      });
      return lines.filter(Boolean);
    },

    /* The Explorer's day now, minus its day at the previous marker (or the first day in the log). { from, to } are null if unknown. */
    dayRange: function (entries, win, dayNow) {
      var days = (entries || []).map(function (e) { return e && e.day; }).filter(function (d) { return typeof d === 'number' && isFinite(d); });
      var from = win && win.from && typeof win.from.day === 'number' ? win.from.day : (days.length ? Math.min.apply(null, days) : null);
      var to = win && win.to && typeof win.to.day === 'number' ? win.to.day : (typeof dayNow === 'number' && isFinite(dayNow) ? dayNow : (days.length ? Math.max.apply(null, days) : null));
      return { from: from, to: to };
    },
    daysTravelled: function (entries, win, dayNow) {
      var r = rules.dayRange(entries, win, dayNow);
      return r.from === null || r.to === null ? 0 : Math.max(0, Math.floor(r.to - r.from));
    },

    /* The id a recap made at this moment gets. */
    makeId: function (now) {
      now = now || new Date();
      return 'recap-' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    },

    /* The first draft, from the table log and the Evidence Board's save. opts: { now, dayNow, maxPictures, title, closing, id }.
       An empty log gives only the title and the closing card. */
    draft: function (log, evidence, opts) {
      opts = opts || {};
      var win = rules.windowOf(log);
      var slides = [{ kind: 'title', image: '', caption: oneLine(opts.title, 120) || OPENING, lines: [], secs: SECS.title }];
      rules.picturesFrom(win.entries, opts.maxPictures).forEach(function (s) { slides.push(s); });
      var clues = rules.clueHeadings(win.entries, evidence);
      if (clues.length) slides.push({ kind: 'clues', image: '', caption: 'Pinned to the Evidence Board', lines: clues, secs: SECS.clues });
      var meanwhile = rules.meanwhileLines(win.entries, win, opts.dayNow);
      if (meanwhile.length) slides.push({ kind: 'meanwhile', image: '', caption: 'Meanwhile…', lines: meanwhile, secs: SECS.meanwhile });
      slides.push({ kind: 'closing', image: '', caption: oneLine(opts.closing, 120) || CLOSING, lines: [], secs: SECS.closing });
      var range = rules.dayRange(win.entries, win, opts.dayNow);
      var id = opts.id || rules.makeId(opts.now);
      return {
        id: id, made: (opts.now || new Date()).toISOString(), sinceDay: range.from, toDay: range.to,
        title: slides[0].caption, narration: rules.narrationFile(id), slides: slides
      };
    },

    /* ---------- Time ---------- */
    totalSecs: function (slides) { return Math.round((slides || []).reduce(function (t, s) { return t + num(Number(s.secs), 0); }, 0) * 10) / 10; },
    /* 'short' under a minute, 'long' over ninety seconds, else 'ok'. */
    fit: function (total) { return total < TARGET.min ? 'short' : total > TARGET.max ? 'long' : 'ok'; },
    /* Stretch or squeeze the slides to make the reel this long (the narration's length): every slide in proportion, none under 2 seconds. */
    retime: function (slides, total) {
      slides = copy(slides || []);
      var now = rules.totalSecs(slides);
      if (!slides.length || !(total > 0) || !(now > 0)) return slides;
      var k = total / now;
      slides.forEach(function (s) { s.secs = Math.max(FLOOR_SECS, Math.round(s.secs * k * 10) / 10); });
      return slides;
    },

    /* ---------- Editing (each returns new slides) ---------- */
    moveSlide: function (slides, i, dir) {
      var out = copy(slides), j = i + dir;
      if (i < 0 || i >= out.length || j < 0 || j >= out.length) return out;
      /* The title stays first and the closing card last. */
      if (out[i].kind === 'title' || out[i].kind === 'closing' || out[j].kind === 'title' || out[j].kind === 'closing') return out;
      var t = out[i]; out[i] = out[j]; out[j] = t;
      return out;
    },
    removeSlide: function (slides, i) {
      var out = copy(slides);
      if (i < 0 || i >= out.length || out[i].kind === 'title' || out[i].kind === 'closing') return out;
      out.splice(i, 1);
      return out;
    },

    /* The captions as one paragraph, to voice. */
    narrationScript: function (recap) {
      var parts = [];
      (recap && recap.slides || []).forEach(function (s) {
        if (s.kind === 'clues') parts.push(sentence('On the Evidence Board: ' + (s.lines || []).filter(Boolean).join(', ')));
        else if (s.kind === 'meanwhile') parts.push(sentence('Meanwhile: ' + (s.lines || []).filter(Boolean).join('; ')));
        else if (s.caption) parts.push(sentence(s.caption));
      });
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    },

    /* ---------- Cleaning and saving ---------- */
    cleanSlide: function (raw) {
      if (!isObj(raw) || KINDS.indexOf(raw.kind) === -1) return null;
      var lines = Array.isArray(raw.lines) ? raw.lines.map(function (l) { return oneLine(l, 120); }).filter(Boolean).slice(0, 10) : [];
      /* The editor keeps each slide to 4 to 8 seconds (clampSecs); a slide stretched to fit a narration may run longer, so saving only holds it to 1 to 60. */
      return { kind: raw.kind, image: rules.cleanImage(raw.image), caption: oneLine(raw.caption, 120), lines: lines, secs: Math.max(1, Math.min(60, Math.round(num(Number(raw.secs), SECS.picture) * 10) / 10)) };
    },
    cleanRecap: function (raw) {
      if (!isObj(raw)) return null;
      var id = str(raw.id, 60);
      if (!/^[A-Za-z0-9_\-]+$/.test(id)) return null;
      var slides = (Array.isArray(raw.slides) ? raw.slides : []).slice(0, 40).map(rules.cleanSlide).filter(Boolean);
      if (!slides.length) return null;
      var sd = raw.sinceDay === null || raw.sinceDay === undefined ? null : Math.floor(num(Number(raw.sinceDay), 0));
      var td = raw.toDay === null || raw.toDay === undefined ? null : Math.floor(num(Number(raw.toDay), 0));
      return { id: id, made: str(raw.made, 40), sinceDay: sd, toDay: td, title: oneLine(raw.title, 120) || OPENING, narration: rules.narrationFile(id), slides: slides };
    },
    empty: function () { return { version: 1, recaps: [] }; },
    clean: function (raw) {
      if (!isObj(raw) || raw.version !== 1 || !Array.isArray(raw.recaps)) return null;
      var seen = {}, list = [];
      raw.recaps.forEach(function (r) { var c = rules.cleanRecap(r); if (c && !seen[c.id]) { seen[c.id] = 1; list.push(c); } });
      return { version: 1, recaps: list.slice(Math.max(0, list.length - MAX_RECAPS)) };
    },
    /* Add (or replace, by id) a recap; only the latest 10 are kept. */
    put: function (state, recap) {
      var s = copy(state || rules.empty());
      var c = rules.cleanRecap(recap);
      if (!c) return s;
      var at = s.recaps.findIndex(function (r) { return r.id === c.id; });
      if (at === -1) s.recaps.push(c); else s.recaps[at] = c;
      s.recaps = s.recaps.slice(Math.max(0, s.recaps.length - MAX_RECAPS));
      return s;
    },
    remove: function (state, id) { var s = copy(state || rules.empty()); s.recaps = s.recaps.filter(function (r) { return r.id !== id; }); return s; },
    find: function (state, id) { return (state && state.recaps || []).filter(function (r) { return r.id === id; })[0] || null; },
    latest: function (state) { var l = state && state.recaps || []; return l.length ? l[l.length - 1] : null; },

    /* ---------- What the TV may see ---------- */
    /* Pictures and words only. Never when it was made, the days it covers, its id or where its narration file is. */
    snapshot: function (recap) {
      if (!recap || !Array.isArray(recap.slides)) return null;
      var slides = recap.slides.map(rules.cleanSlide).filter(Boolean).map(function (s) { return { kind: s.kind, image: s.image, caption: s.caption, lines: s.lines, secs: s.secs }; });
      return slides.length ? { v: 1, slides: slides } : null;
    },
    /* A snapshot that arrived in the TV window, cleaned again before it is drawn. */
    isSafeSnapshot: function (snap) {
      return isObj(snap) && snap.v === 1 && Array.isArray(snap.slides) && snap.slides.length > 0 &&
        Object.keys(snap).every(function (k) { return k === 'v' || k === 'slides'; });
    }
  };

  TSI.recapRules = rules;
}());
