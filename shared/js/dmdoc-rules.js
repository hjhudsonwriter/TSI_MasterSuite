/* The Scarlett Isles: D&D Tool Suite — the DM doc's rules (plain functions, tested in tests/rules.html).
   The DM doc is a floating panel (shared/js/dmdoc.js) with four panels in a
   2 × 2 grid: Party, Bastion, Explorer and Quest. These work out where it
   sits and how big it is, so it always stays on screen:
   - never wider or taller than the window, and no smaller than 280 × 200
     (unless the window itself is smaller than that);
   - never over the suite's top bar, so its title bar can always be grabbed.
   They also hold the Quest box's rules (what is saved, how much, how a
   second window's copy is told from this one's, how imported text is tidied)
   and the hand-set scores' list (below).

   A "rect" is { x, y, w, h } in CSS pixels from the window's top-left corner.
   A "view" is the window: { width, height, top }, where top is the bottom edge
   of the suite's top bar. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  function num(value, fallback) {
    return typeof value === 'number' && isFinite(value) ? value : fallback;
  }

  var rules = {
    MIN_W: 280,
    MIN_H: 200,
    /* The first size for the 2 × 2 grid (the DM doc overhaul): it fits the
       laptop (1707 × 930) and the TV (1920 × 1080); each panel scrolls on
       its own if its lists get long. */
    DEFAULT_W: 1040,
    DEFAULT_H: 640,
    /* Below this width the four panels stack in one column (dmdoc.js and
       components.css use it: the narrowest the grid is comfortable at). */
    NARROW_W: 760,
    /* The size the pop-out window opens at: landscape, for the four panels. */
    POPOUT_W: 1100,
    POPOUT_H: 760,
    /* The saved layout's version. Version 1 (no number) was the old tall,
       narrow column, 440 wide: it would reopen as a squashed box, so it is
       ignored once, and the next move or resize saves a version 2. */
    LAYOUT_VERSION: 2,
    /* The gap from the window's right edge and the top bar when it first opens. */
    GAP: 24,
    /* Arrow keys on the title bar move it this far (Shift: further). */
    NUDGE: 10,
    NUDGE_BIG: 50,

    /* A tidy copy of a view, with sensible values for anything missing. */
    view: function (v) {
      v = v || {};
      var width = Math.max(0, num(v.width, 0));
      var height = Math.max(0, num(v.height, 0));
      var top = Math.min(Math.max(0, num(v.top, 0)), height);
      return { width: width, height: height, top: top };
    },

    /* The rect moved and sized to fit the view: no larger than it, no smaller
       than the minimum, and wholly inside it below the top bar. */
    clamp: function (rect, view) {
      var v = rules.view(view);
      rect = rect || {};
      var room = v.height - v.top;
      var w = Math.min(Math.max(num(rect.w, rules.DEFAULT_W), rules.MIN_W), v.width);
      var h = Math.min(Math.max(num(rect.h, rules.DEFAULT_H), rules.MIN_H), room);
      var x = Math.min(Math.max(num(rect.x, 0), 0), v.width - w);
      var y = Math.min(Math.max(num(rect.y, v.top), v.top), v.height - h);
      return { x: Math.round(x), y: Math.round(y), w: Math.floor(w), h: Math.floor(h) };
    },

    /* Where it opens the first time: near the right edge, just below the top bar. */
    defaultRect: function (view) {
      var v = rules.view(view);
      var h = Math.min(rules.DEFAULT_H, v.height - v.top - 2 * rules.GAP);
      return rules.clamp({
        x: v.width - rules.DEFAULT_W - rules.GAP,
        y: v.top + rules.GAP,
        w: rules.DEFAULT_W,
        h: h
      }, v);
    },

    /* Dragging the title bar by (dx, dy) from where the drag started. */
    move: function (start, dx, dy, view) {
      return rules.clamp({ x: start.x + num(dx, 0), y: start.y + num(dy, 0), w: start.w, h: start.h }, view);
    },

    /* Dragging the bottom-right grip by (dx, dy). The top-left corner stays
       put, and the panel stops growing at the window's edge (it only moves
       if there's no room left for even the smallest size). */
    resize: function (start, dx, dy, view) {
      var v = rules.view(view);
      var w = Math.max(start.w + num(dx, 0), rules.MIN_W);
      var h = Math.max(start.h + num(dy, 0), rules.MIN_H);
      w = Math.min(w, Math.max(v.width - start.x, rules.MIN_W));
      h = Math.min(h, Math.max(v.height - start.y, rules.MIN_H));
      return rules.clamp({ x: start.x, y: start.y, w: w, h: h }, v);
    },

    /* An arrow key on the title bar: the moved rect, or null for any other key. */
    nudge: function (rect, key, big, view) {
      var step = big ? rules.NUDGE_BIG : rules.NUDGE;
      var d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[key];
      return d ? rules.move(rect, d[0], d[1], view) : null;
    },

    /* The window features for the pop-out: noopener (so the new window doesn't
       share this one's tab), landscape and wide enough for the four panels. */
    popOutFeatures: function () {
      return 'noopener,popup,width=' + rules.POPOUT_W + ',height=' + rules.POPOUT_H;
    },

    /* What's saved: { v, x, y, w, h }, with whole numbers. */
    toSaved: function (rect) {
      return { v: rules.LAYOUT_VERSION, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) };
    },

    /* A saved layout read back, or null if it's missing, damaged or from the
       old single-column version (so the first size for the new grid is used). */
    fromSaved: function (value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      if (value.v !== rules.LAYOUT_VERSION) return null;
      var ok = ['x', 'y', 'w', 'h'].every(function (k) { return typeof value[k] === 'number' && isFinite(value[k]); });
      if (!ok || value.w <= 0 || value.h <= 0) return null;
      return { x: value.x, y: value.y, w: value.w, h: value.h };
    }
  };

  /* ---------- The Quest box ----------
     A box for the DM's own text (a session file to read from, pasted or
     imported from a PDF, Word or text file). One box, saved as
     tsi.dmdoc.quest = { text, at }, where `at` is when it was last typed in
     (so a window can tell whether another window's copy is newer). It is
     never sent to the players: nothing but the DM doc reads this key.
     QUEST_MAX is far under what the browser's database could hold; it is
     there for the day the browser falls back to its small storage (about 5
     million characters for the whole suite). */
  rules.QUEST_KEY = 'tsi.dmdoc.quest';
  rules.QUEST_MAX = 200000;
  /* The biggest file the import will even try to read. */
  rules.IMPORT_MAX_BYTES = 20 * 1024 * 1024;
  var CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

  /* A saved Quest value read back: { text, at }, with the text no longer than the limit. */
  rules.cleanQuest = function (raw) {
    var text = '';
    var at = 0;
    if (typeof raw === 'string') text = raw;
    else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      if (typeof raw.text === 'string') text = raw.text;
      at = typeof raw.at === 'number' && isFinite(raw.at) && raw.at > 0 ? Math.floor(raw.at) : 0;
    }
    return { text: text.length > rules.QUEST_MAX ? text.slice(0, rules.QUEST_MAX) : text, at: at };
  };

  /* What to save for the text now in the box. */
  rules.makeQuest = function (text, now) {
    var q = rules.cleanQuest({ text: String(text === null || text === undefined ? '' : text), at: typeof now === 'number' ? now : Date.now() });
    return q;
  };

  /* Which of two windows' copies to keep: the one typed in last. A tie keeps
     `mine` (nothing has changed). Either may be null. */
  rules.newerQuest = function (mine, theirs) {
    var a = mine ? rules.cleanQuest(mine) : null;
    var b = theirs ? rules.cleanQuest(theirs) : null;
    if (!b) return a || rules.cleanQuest(null);
    if (!a) return b;
    return b.at > a.at ? b : a;
  };

  /* Imported text tidied for the box: no byte-order mark or hidden control
     characters, plain line endings, no trailing spaces, no run of more than
     two blank lines, and no blank space at either end. */
  rules.cleanImportedText = function (raw) {
    var text = String(raw === null || raw === undefined ? '' : raw);
    return text
      .replace(/\uFEFF/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u2028\u2029]/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(CONTROL, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();
  };

  /* What the box would hold if imported text were put in it. mode 'replace'
     puts it in place of what is there; 'append' adds it to the end, after a
     blank line. Too long: { ok: false, message }, and nothing should change;
     there is no cutting off the end of a document silently. */
  rules.joinQuest = function (current, incoming, mode) {
    var add = rules.cleanImportedText(incoming);
    var have = String(current || '');
    var text = mode === 'append' && have.trim() ? have.replace(/\s+$/, '') + '\n\n' + add : add;
    if (!add) return { ok: false, message: 'There was no text to import.' };
    if (text.length > rules.QUEST_MAX) {
      return {
        ok: false,
        message: 'That would make ' + text.length.toLocaleString('en-GB') + ' characters, and the Quest box holds up to ' + rules.QUEST_MAX.toLocaleString('en-GB') + '. Nothing was imported.'
      };
    }
    return { ok: true, text: text };
  };

  /* The name for "Save as text file". */
  rules.questFileName = function (now) {
    var d = new Date(typeof now === 'number' ? now : Date.now());
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return 'dm-doc-quest-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.txt';
  };

  /* ---------- Editing the scores by hand (Harry, 19 October 2026) ----------
     The DM sets a Clan's Political Capital or Honour/Respect, or a god's
     Favour, from the DM doc. The DM doc never writes the Bastion's save
     (only the open Bastion does): it adds a message to its own list
     (tsi.dmdoc.edits), and the Bastion applies each once, the next time it
     is open, writing a receipt (dmEdits.done) in its own save with the
     change. So nothing counts twice and the two never overwrite each other.
     An edit: { id, kind: 'pc' | 'hr' | 'favour', key (a Clan's or god's
     key), value (the new score), at, day }. */
  var GODS = ['telluria', 'aurush', 'pelagos'];
  var GOD_NAMES = { telluria: 'Telluria', aurush: 'Aurush', pelagos: 'Pelagos' };
  var FALLBACK_CLANS = ['blackstone', 'bacca', 'farmer', 'slade', 'molten', 'rowthorn', 'karr'];
  rules.EDIT_KINDS = {
    pc: { label: 'Political Capital', min: -100, max: 100, scope: 'clan' },
    hr: { label: 'Honour/Respect', min: -5, max: 5, scope: 'clan' },
    favour: { label: 'Favour', min: 0, max: 100, scope: 'god' }
  };
  rules.EDITS_MAX = 100;
  rules.GODS = GODS;
  rules.clanKeys = function () { return TSI.bridge && TSI.bridge.CLANS && TSI.bridge.CLANS.length ? TSI.bridge.CLANS.slice() : FALLBACK_CLANS.slice(); };
  rules.keyName = function (kind, key) {
    var k = rules.EDIT_KINDS[kind];
    if (k && k.scope === 'god') return GOD_NAMES[key] || key;
    return 'Clan ' + (TSI.bridge && TSI.bridge.clanName ? TSI.bridge.clanName(key) : key);
  };
  /* A typed value read as a whole number in range, or why not. */
  rules.checkEdit = function (kind, key, value) {
    var k = rules.EDIT_KINDS[kind];
    if (!k) return { ok: false, message: 'That isn\'t a score the DM doc can change.' };
    var valid = k.scope === 'god' ? GODS : rules.clanKeys();
    if (valid.indexOf(key) === -1) return { ok: false, message: 'Pick ' + (k.scope === 'god' ? 'a god' : 'a Clan') + ' from the list.' };
    var n = typeof value === 'number' ? value : (String(value).trim() === '' ? NaN : Number(String(value).trim()));
    if (!isFinite(n) || n !== Math.floor(n)) return { ok: false, message: 'Type a whole number.' };
    if (n < k.min || n > k.max) return { ok: false, message: k.label + ' goes from ' + k.min + ' to ' + k.max + '.' };
    return { ok: true, value: n };
  };
  rules.makeEdit = function (kind, key, value, now, rand, day) {
    var c = rules.checkEdit(kind, key, value);
    if (!c.ok) return c;
    var r = typeof rand === 'function' ? rand() : Math.random();
    return { ok: true, edit: { id: 'dm:' + now + ':' + Math.floor(r * 1e9).toString(36), kind: kind, key: key, value: c.value, at: now, day: typeof day === 'number' ? day : null } };
  };
  /* The saved list, tidied: only well-formed edits, oldest first, the newest 100. */
  rules.cleanEdits = function (raw) {
    var list = Array.isArray(raw) ? raw : [];
    var seen = {};
    var out = [];
    list.forEach(function (e) {
      if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !e.id || seen[e.id]) return;
      var c = rules.checkEdit(e.kind, e.key, e.value);
      if (!c.ok) return;
      seen[e.id] = true;
      out.push({ id: e.id.slice(0, 80), kind: e.kind, key: e.key, value: c.value, at: typeof e.at === 'number' ? e.at : 0, day: typeof e.day === 'number' ? e.day : null });
    });
    out.sort(function (a, b) { return a.at - b.at; });
    return out.slice(-rules.EDITS_MAX);
  };
  rules.addEdit = function (raw, edit) {
    var list = Array.isArray(raw) ? raw.slice() : [];
    list.push(edit);
    return rules.cleanEdits(list);
  };
  /* Where an edit stands, from the Bastion's save: 'applied', 'refused' or 'waiting'. */
  rules.editStatus = function (edit, bastion) {
    var done = bastion && bastion.dmEdits && bastion.dmEdits.done;
    var r = done && Object.prototype.hasOwnProperty.call(done, edit.id) ? done[edit.id] : null;
    return r ? { state: r.r === 'refused' ? 'refused' : 'applied', receipt: r } : { state: 'waiting', receipt: null };
  };
  rules.editText = function (edit) {
    return rules.EDIT_KINDS[edit.kind].label + ', ' + rules.keyName(edit.kind, edit.key) + ': set to ' + (edit.kind !== 'favour' && edit.value > 0 ? '+' : '') + edit.value + (edit.kind === 'favour' ? '%' : '');
  };

  TSI.dmDocRules = rules;
}());
