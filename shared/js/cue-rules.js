/* The Scarlett Isles: D&D Tool Suite — cue tags in the DM's session text (plain functions, tested in tests/rules.html).
   Harry types or imports a session file into the DM doc's Quest box. Wherever the text holds a tag in curly
   brackets, the Quest box shows a small gold button instead, and one click does the thing on the TV:

     {card: act1/letter}   a scene card (the deck's id, a slash, the card's id; the absent_tide_ start is optional)
     {deck: act2}          open that deck's pop-up
     {cast: dren-marr}     an NPC's portrait (or name card)
     {hide}                clear the TV back to the map
     {fight: t2}           "Set up this fight" for that encounter
     {puzzle: tidal}       open the Pelagosi Puzzle Trials on that puzzle (tidal or marker)
     {camp}                Make Camp (it asks first)
     {sound: rain}         a sound effect from the Explorer
     {clue: id}            award a prepared clue to the Evidence Board ({clue: any words} pins those words as a note)
     {recap}               the Recap (not built yet: shows greyed)

   Tags are not case-sensitive and may have spaces after the colon. The text itself is never changed.

   parseCues(text) → [{ start, end, raw, kind, arg, problem }]   (problem: '' when the tag is well formed)
   resolveCue(cue, data) → { ok, kind, arg, deck, step, cast, label, problem, suggestion, soon }
   findMatches(text, query) → character positions to jump to, scene numbers at the start of a line first
   data: { decks: [{ id, steps: [{ id }] }], cast: [{ id }], fights: [id], puzzles: [id], sounds: [id] } */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  var KINDS = ['card', 'deck', 'cast', 'hide', 'fight', 'puzzle', 'camp', 'sound', 'clue', 'recap'];
  var NEEDS_ARG = { card: 1, deck: 1, cast: 1, fight: 1, puzzle: 1, sound: 1, clue: 1 };
  /* Built by later pull requests: they show greyed until then. */
  var COMING = { recap: 'recap (coming)' };
  var PUZZLES = ['tidal', 'marker'];
  var PREFIX = 'absent_tide_';

  function lower(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  /* How different two short words are (the number of single-letter changes). */
  function distance(a, b) {
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  /* The closest of the choices to what was typed, or '' if none is close. */
  function nearest(word, choices) {
    word = lower(word);
    var best = '', bestD = 1e9;
    (choices || []).forEach(function (c) {
      var d = distance(word, lower(c));
      if (d < bestD) { bestD = d; best = c; }
    });
    return bestD <= Math.max(2, Math.floor(word.length / 3)) ? best : '';
  }

  var TAG = /\{\s*([A-Za-z]+)\s*(?::\s*([^{}]*?))?\s*\}/g;

  var rules = {
    KINDS: KINDS,
    PUZZLES: PUZZLES,
    DECK_PREFIX: PREFIX,

    parseCues: function (text) {
      var out = [];
      text = String(text == null ? '' : text);
      TAG.lastIndex = 0;
      var m;
      while ((m = TAG.exec(text))) {
        var kind = lower(m[1]);
        var arg = (m[2] || '').trim();
        var problem = '';
        if (KINDS.indexOf(kind) === -1) problem = 'unknown tag "' + m[1] + '"';
        else if (NEEDS_ARG[kind] && !arg) problem = 'the tag {' + kind + '} needs something after the colon';
        out.push({ start: m.index, end: m.index + m[0].length, raw: m[0], kind: kind, arg: arg, problem: problem });
      }
      return out;
    },

    /* The deck for an id as typed: exact, or with absent_tide_ put on the front. */
    findDeck: function (decks, id) {
      id = lower(id);
      var list = decks || [];
      for (var i = 0; i < list.length; i++) if (lower(list[i].id) === id) return list[i];
      for (var j = 0; j < list.length; j++) if (lower(list[j].id) === PREFIX + id) return list[j];
      return null;
    },
    /* A deck's id as the DM would type it (without absent_tide_). */
    shortDeckId: function (id) { return String(id || '').indexOf(PREFIX) === 0 ? String(id).slice(PREFIX.length) : String(id || ''); },

    resolveCue: function (cue, data) {
      data = data || {};
      var kind = cue.kind, arg = cue.arg || '';
      var r = { ok: false, kind: kind, arg: arg, label: '', problem: '', suggestion: '', soon: false };
      if (cue.problem) { r.problem = cue.problem; return r; }
      var ids = function (list) { return (list || []).map(function (x) { return typeof x === 'string' ? x : x.id; }); };

      if (COMING[kind]) { r.soon = true; r.label = COMING[kind]; r.problem = 'Not built yet.'; return r; }
      /* {clue: id} awards a prepared clue; {clue: any other words} pins those words as a new note. Neither opens the board on the TV. */
      if (kind === 'clue') {
        var pid = lower(arg), prepared = ids(data.prepared).filter(function (c) { return lower(c) === pid; })[0];
        r.ok = true;
        var onBoard = (data.boardIds || []).filter(function (c) { return lower(c) === pid; })[0];
        if (prepared) { r.arg = prepared; r.isId = true; r.label = 'Clue: ' + ((data.preparedLabels && data.preparedLabels[prepared]) || prepared); }
        else if (onBoard) { r.arg = onBoard; r.isId = true; r.already = true; r.label = 'Clue: ' + onBoard + ' (already up)'; }
        else { r.isId = false; r.label = 'Pin: ' + (arg.length > 28 ? arg.slice(0, 27) + '…' : arg); }
        return r;
      }
      if (kind === 'hide') { r.ok = true; r.label = 'Hide'; return r; }
      if (kind === 'camp') { r.ok = true; r.label = 'Make camp'; return r; }

      if (kind === 'card') {
        var parts = arg.split('/');
        if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) { r.problem = 'a card tag looks like {card: act1/letter} (the deck, a slash, the card)'; return r; }
        var deck = rules.findDeck(data.decks, parts[0]);
        if (!deck) {
          var near = nearest(rules.shortDeckId(parts[0]), (data.decks || []).map(function (d) { return rules.shortDeckId(d.id); }));
          r.problem = 'no deck ' + parts[0].trim() + (near ? ': did you mean ' + near + '?' : '');
          if (near) r.suggestion = near + '/' + parts[1].trim();
          return r;
        }
        var stepId = lower(parts[1]);
        var step = null;
        (deck.steps || []).forEach(function (s) { if (!step && lower(s.id) === stepId) step = s; });
        if (!step) {
          var nearStep = nearest(stepId, ids(deck.steps));
          r.problem = 'no card ' + rules.shortDeckId(deck.id) + '/' + parts[1].trim() + (nearStep ? ': did you mean ' + rules.shortDeckId(deck.id) + '/' + nearStep + '?' : '');
          if (nearStep) r.suggestion = rules.shortDeckId(deck.id) + '/' + nearStep;
          return r;
        }
        r.ok = true; r.deck = deck.id; r.step = step.id; r.label = step.name || step.id;
        return r;
      }

      if (kind === 'deck') {
        var d = rules.findDeck(data.decks, arg);
        if (!d) {
          var nd = nearest(rules.shortDeckId(arg), (data.decks || []).map(function (x) { return rules.shortDeckId(x.id); }));
          r.problem = 'no deck ' + arg + (nd ? ': did you mean ' + nd + '?' : '');
          if (nd) r.suggestion = nd;
          return r;
        }
        r.ok = true; r.deck = d.id; r.label = d.title || rules.shortDeckId(d.id);
        return r;
      }

      if (kind === 'cast') {
        var cid = lower(arg), found = null;
        (data.cast || []).forEach(function (c) { if (!found && lower(c.id) === cid) found = c; });
        if (!found) {
          var nc = nearest(cid, ids(data.cast));
          r.problem = 'no cast member ' + arg + (nc ? ': did you mean ' + nc + '?' : '');
          if (nc) r.suggestion = nc;
          return r;
        }
        r.ok = true; r.cast = found.id; r.label = found.name || found.id;
        return r;
      }

      if (kind === 'fight') {
        var fid = lower(arg), hit = ids(data.fights).filter(function (f) { return lower(f) === fid; })[0];
        if (!hit) {
          var nf = nearest(fid, ids(data.fights));
          r.problem = 'no fight ' + arg + (nf ? ': did you mean ' + nf + '?' : '');
          if (nf) r.suggestion = nf;
          return r;
        }
        r.ok = true; r.arg = hit; r.label = 'Fight ' + hit;
        return r;
      }

      if (kind === 'puzzle') {
        var pid = lower(arg), list = data.puzzles || PUZZLES;
        if (list.indexOf(pid) === -1) {
          var np = nearest(pid, list);
          r.problem = 'no puzzle ' + arg + (np ? ': did you mean ' + np + '?' : ': use tidal or marker');
          if (np) r.suggestion = np;
          return r;
        }
        r.ok = true; r.arg = pid; r.label = pid === 'tidal' ? 'Tidal puzzle' : 'Marker puzzle';
        return r;
      }

      if (kind === 'sound') {
        var sid = lower(arg), sh = ids(data.sounds).filter(function (s) { return lower(s) === sid; })[0];
        if (!sh) {
          var ns = nearest(sid, ids(data.sounds));
          r.problem = 'no sound ' + arg + (ns ? ': did you mean ' + ns + '?' : '');
          if (ns) r.suggestion = ns;
          return r;
        }
        r.ok = true; r.arg = sh; r.label = 'Sound: ' + sh;
        return r;
      }

      r.problem = 'unknown tag';
      return r;
    },

    /* What tags are checked against, taken from the data files (window.TSI_DATA): the decks, the cast, the fights and the sounds. */
    catalogue: function (D, prepared, boardIds) {
      D = D || {};
      var sfx = D.explorerSfx || {};
      return {
        decks: (D.decks || []).filter(function (d) { return d && d.deck; }),
        cast: D.cast || [],
        fights: Object.keys((D.fights && D.fights.encounters) || {}),
        puzzles: PUZZLES.slice(),
        sounds: Object.keys(sfx.sounds || {}).concat(Object.keys(sfx.groups || {})),
        /* the Evidence Board's clues ready to award: [{ id, text }] (the board's own save, or the seed) */
        prepared: (prepared || []).map(function (c) { return c.id; }),
        boardIds: (boardIds || []).slice(),
        preparedLabels: (prepared || []).reduce(function (o, c) { o[c.id] = String(c.text || '').split('\n')[0].replace(/[.:]$/, ''); return o; }, {})
      };
    },

    /* Does a pop-up need to say "the page will reload" or "asks first"? */
    needsWarning: function (kind) { return kind === 'puzzle' ? 'puzzle' : kind === 'camp' ? 'camp' : ''; },

    /* The tag as it is typed, for a copy button. */
    tagText: function (kind, arg) { return arg ? '{' + kind + ': ' + arg + '}' : '{' + kind + '}'; },

    /* Where to jump for a find: positions in the text. A scene number such as 4.4 matches a line that starts with it first
       (so "4.4" finds "4.4 The liaison office" before "...see 4.4..."); then every other match, in order. */
    findMatches: function (text, query) {
      text = String(text == null ? '' : text);
      var q = String(query == null ? '' : query).trim().toLowerCase();
      if (!q) return [];
      var low = text.toLowerCase();
      var first = [], rest = [];
      var numbered = /^\d+(\.\d+)*$/.test(q);
      var i = 0;
      while ((i = low.indexOf(q, i)) !== -1) {
        var lineStart = low.lastIndexOf('\n', i - 1) + 1;
        var before = text.slice(lineStart, i);
        /* A scene number: the line starts with it (spaces or "Scene " first) and it is not the front of a longer number. */
        var next = low.charAt(i + q.length), next2 = low.charAt(i + q.length + 1);
        var longer = /[0-9]/.test(next) || (next === '.' && /[0-9]/.test(next2));
        var atStart = /^\s*(scene\s+)?$/i.test(before) && !longer;
        (numbered && atStart ? first : rest).push(i);
        i += Math.max(1, q.length);
      }
      return first.concat(rest);
    }
  };

  TSI.cueRules = rules;
}());
