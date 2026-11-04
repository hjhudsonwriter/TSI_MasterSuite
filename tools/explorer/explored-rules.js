/* The Scarlett Isles Explorer: the three fog modes and the explored map, as plain functions (guide 6B, 4 November 2026).

   Fog has three modes (the DM picks one; it is saved):
     classic  the black fog the Explorer has always had (state.fog, untouched);
     colour   "colour reveal": the players see the whole map, greyscale and dimmed where the party has not been, and in
              full colour where it has, with soft edges. The DM sees the full colour map with a light grey wash over
              what is unexplored;
     off      no fog, the whole map in full colour.

   What counts as explored (colour mode): every hex within RADIUS (2) hex steps of a hero when a move finishes, kept for good
   (the colour never fades when the party walks away), plus whatever the DM brushes in or out by hand.

   Saved as tsi.explorer.explored = { version: 1, mode, radius, maps: { <map key>: [q0, r0, q1, r1, ...] } }, the hexes of
   each map as one flat list of whole numbers (the Explorer's own axial hex addresses, sorted), which is compact however
   many hexes a map has. In memory each map is a set ({ "q,r": true }) so a move costs next to nothing.
   tsi.explorer.pinknown = { version: 1, known: { <pin id>: true } } lists the towns the DM has marked "Known to players":
   a town the party has heard of, or can see from afar, whose pin shows on the TV before its hex is explored.

   Hex distance here is the same hex steps the movement rules use (R.hexDistance): a radius of 2 is 19 hexes. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.explorer = TSI.explorer || {};
  var E = ns.explored = ns.explored || {};

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function whole(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && Math.abs(v) <= 100000; }

  E.MODES = ['classic', 'colour', 'off'];
  E.DEFAULT_RADIUS = 2;
  E.MAX_RADIUS = 6;
  E.MAX_HEXES_PER_MAP = 60000;

  /* ---------- The record ---------- */
  E.empty = function (mode) { return { version: 1, mode: E.MODES.indexOf(mode) !== -1 ? mode : 'colour', radius: E.DEFAULT_RADIUS, maps: {} }; };
  /* Is this a saved record of the right shape? (Checked before anything is replaced.) */
  E.isSaved = function (v) {
    if (!isObj(v) || v.version !== 1 || E.MODES.indexOf(v.mode) === -1 || !isObj(v.maps)) return false;
    if ('radius' in v && !(whole(v.radius) && v.radius >= 1 && v.radius <= E.MAX_RADIUS)) return false;
    return Object.keys(v.maps).every(function (k) { return Array.isArray(v.maps[k]); });
  };
  /* The record as the Explorer keeps it in memory (a bad record, or none, gives an empty one in mode). Odd numbers, half pairs and
     too many hexes are dropped, never thrown. */
  E.fromSave = function (v, mode) {
    var e = E.empty(mode);
    if (!E.isSaved(v)) return e;
    e.mode = v.mode;
    if (whole(v.radius) && v.radius >= 1 && v.radius <= E.MAX_RADIUS) e.radius = v.radius;
    Object.keys(v.maps).slice(0, 200).forEach(function (key) {
      var list = v.maps[key], set = {}, n = 0;
      for (var i = 0; i + 1 < list.length && n < E.MAX_HEXES_PER_MAP; i += 2) {
        if (whole(list[i]) && whole(list[i + 1])) { set[list[i] + ',' + list[i + 1]] = true; n++; }
      }
      if (n) e.maps[String(key).slice(0, 120)] = set;
    });
    return e;
  };
  /* What is saved: each map's hexes as one sorted flat list. */
  E.toSave = function (e) {
    var maps = {};
    Object.keys(e.maps || {}).forEach(function (key) {
      var flat = E.snapshot(e, key);
      if (flat.length) maps[key] = flat;
    });
    return { version: 1, mode: e.mode, radius: e.radius, maps: maps };
  };
  /* Which mode a copy of the Explorer starts in (Harry's answer, 4 November 2026): a new save starts in Colour reveal. A save that
     came before this existed keeps what it had: the black fog if it was on, no fog if it was off. With a record, its own mode. */
  E.startMode = function (record, hadSave, fogWasOn) {
    if (E.isSaved(record)) return record.mode;
    if (!hadSave) return 'colour';
    return fogWasOn ? 'classic' : 'off';
  };

  /* ---------- Hexes ---------- */
  /* Every hex within `radius` hex steps of centre (radius 0: the hex itself; radius 2: 19 hexes). */
  E.hexesWithin = function (centre, radius) {
    var out = [];
    if (!centre || !whole(centre.q) || !whole(centre.r)) return out;
    var n = Math.max(0, Math.floor(radius) || 0);
    for (var dq = -n; dq <= n; dq++) {
      for (var dr = Math.max(-n, -dq - n); dr <= Math.min(n, -dq + n); dr++) out.push({ q: centre.q + dq, r: centre.r + dr });
    }
    return out;
  };
  function set(e, key) {
    if (typeof key !== 'string' || !key || key === 'none') return null;
    if (!isObj(e.maps)) e.maps = {};
    return e.maps[key] || (e.maps[key] = {});
  }
  /* Reveal these hexes on a map. Returns how many were new. */
  E.reveal = function (e, key, hexes) {
    var s = set(e, key), added = 0;
    if (!s) return 0;
    (hexes || []).forEach(function (h) {
      if (!h || !whole(h.q) || !whole(h.r)) return;
      var k = h.q + ',' + h.r;
      if (!s[k] && Object.keys(s).length < E.MAX_HEXES_PER_MAP) { s[k] = true; added++; }
    });
    return added;
  };
  /* Hide these hexes again. Returns how many were taken away. */
  E.hide = function (e, key, hexes) {
    var s = isObj(e.maps) && e.maps[key], gone = 0;
    if (!s) return 0;
    (hexes || []).forEach(function (h) {
      if (!h) return;
      var k = h.q + ',' + h.r;
      if (s[k]) { delete s[k]; gone++; }
    });
    return gone;
  };
  /* Reveal every hex whose centre is on the map. grid: { r, offsetX, offsetY }; board: { w, h } in board units. */
  E.revealAll = function (e, key, grid, board) {
    var R = ns.rules, s = set(e, key), added = 0;
    if (!s) return 0;
    var size = R.hexSize(grid), w = size * Math.sqrt(3);
    var span = Math.ceil((board.w + board.h) / w) + 4;
    var c0 = R.hexAt(grid, board.w / 2, board.h / 2);
    for (var q = c0.q - span; q <= c0.q + span; q++) {
      for (var r = c0.r - span; r <= c0.r + span; r++) {
        var p = R.axialToPixel(grid, q, r);
        if (p.x < 0 || p.y < 0 || p.x > board.w || p.y > board.h) continue;
        var k = q + ',' + r;
        if (!s[k] && Object.keys(s).length < E.MAX_HEXES_PER_MAP) { s[k] = true; added++; }
      }
    }
    return added;
  };
  /* Hide the whole of a map again. Returns how many hexes there were. */
  E.reset = function (e, key) {
    var n = isObj(e.maps) && e.maps[key] ? Object.keys(e.maps[key]).length : 0;
    if (n) delete e.maps[key];
    return n;
  };
  E.has = function (e, key, q, r) { return !!(isObj(e.maps) && e.maps[key] && e.maps[key][q + ',' + r]); };
  E.count = function (e, key) { return isObj(e.maps) && e.maps[key] ? Object.keys(e.maps[key]).length : 0; };
  /* A map's explored hexes as one sorted flat list [q0, r0, q1, r1, ...]: what is saved, and what the players' window is sent. */
  E.snapshot = function (e, key) {
    var s = isObj(e.maps) && e.maps[key] ? e.maps[key] : {};
    var pairs = Object.keys(s).map(function (k) { var p = k.split(','); return [Number(p[0]), Number(p[1])]; })
      .filter(function (p) { return whole(p[0]) && whole(p[1]); })
      .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var flat = [];
    pairs.forEach(function (p) { flat.push(p[0], p[1]); });
    return flat;
  };
  /* The same list, cleaned (what the players' window is handed): whole numbers only, at most MAX_HEXES_PER_MAP pairs. */
  E.cleanFlat = function (list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i + 1 < list.length && out.length < E.MAX_HEXES_PER_MAP * 2; i += 2) {
      if (whole(list[i]) && whole(list[i + 1])) out.push(list[i], list[i + 1]);
    }
    return out;
  };
  /* Reveal the radius around every hero's hex (when a move finishes, and when a map is opened). Returns how many hexes were new. */
  E.revealAroundHeroes = function (e, key, state, board) {
    var R = ns.rules, added = 0;
    (state.tokens || []).forEach(function (t) {
      var h = R.tokenHex(state, board, t);
      added += E.reveal(e, key, E.hexesWithin(h, e.radius));
    });
    return added;
  };

  /* ---------- Who sees a spot ---------- */
  /* Can the players see a place on the map (a town pin, a quest marker)? x and y are board units. Classic fog: only in an uncovered
     hex (as it always was); colour reveal: only in an explored hex; off: anywhere. */
  E.visibleToPlayers = function (state, board, x, y) {
    var R = ns.rules, e = state.explored;
    var mode = e && E.MODES.indexOf(e.mode) !== -1 ? e.mode : (state.fog && state.fog.enabled ? 'classic' : 'off');
    if (mode === 'off') return true;
    var h = R.hexAt(state.grid, x, y);
    if (mode === 'classic') return !!R.fogStore(state)[h.q + ',' + h.r];
    return E.has(e, R.mapKey(state), h.q, h.r);
  };

  /* ---------- Towns the DM has marked "Known to players" ---------- */
  E.emptyKnown = function () { return { version: 1, known: {} }; };
  E.isKnown = function (v) { return isObj(v) && v.version === 1 && isObj(v.known); };
  E.cleanKnown = function (v) {
    var out = E.emptyKnown();
    if (!E.isKnown(v)) return out;
    Object.keys(v.known).slice(0, 300).forEach(function (k) { if (v.known[k] === true && k && k.length <= 80) out.known[k] = true; });
    return out;
  };
  E.setKnown = function (kn, pinId, on) {
    if (!isObj(kn) || !isObj(kn.known) || typeof pinId !== 'string' || !pinId) return false;
    if (on) { if (kn.known[pinId]) return false; kn.known[pinId] = true; return true; }
    if (!kn.known[pinId]) return false;
    delete kn.known[pinId];
    return true;
  };
  E.isKnownPin = function (kn, pinId) { return !!(isObj(kn) && isObj(kn.known) && kn.known[pinId] === true); };
}());
