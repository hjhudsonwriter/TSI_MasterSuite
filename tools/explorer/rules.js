/* Scarlett Isles Explorer — the rules, as plain functions (no screen code),
   so they can be tested on tests/rules.html.

   Positions are tied to the map picture (EXP-10): the board is the picture,
   BOARD_W units wide and as tall as its shape needs (1440 × 1080 for the 4:3
   province maps). A token's x, y is its centre as a fraction of the board.
   The hex grid, token sizes and fog are in board units, so a hex covers the
   same ground on the laptop and the TV, in a window or full screen.
   BOARD_W is 1440 so that a unit is one screen pixel when a 4:3 map fills a
   1920 × 1080 TV in full screen (and very nearly on the laptop in full
   screen), which is where the old sizes (hex 38, token 46) came from.

   Every rule is as the old app.js had it; line numbers in comments point
   there. Random picks take a rand() function so tests can fix the dice.

   Harry's new events (6 October 2026) replace the old travel and campfire
   events: when they happen and what they do is in journey.js, and the
   events are in data/journey-events.js. Rations are gone entirely. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ns = TSI.explorer = TSI.explorer || {};

  var R = {};
  R.BOARD_W = 1440;
  R.NO_MAP_ASPECT = 16 / 9;
  R.MILES_PER_HEX = 6;
  R.DAY_MILES = 30;
  R.MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
  R.SAVE_VERSION = 1;

  function num(v, fallback) { var n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  R.clamp = function (n, min, max) { return Math.max(min, Math.min(max, n)); };

  /* ---------- Heroes and the starting state (old 444-513) ---------- */
  R.heroInitial = function (title) {
    var t = String(title || '').trim();
    if (!t) return '?';
    return t.split(/\s+/)[0].slice(0, 1).toUpperCase();
  };

  R.uid = function (rand) {
    return Math.floor(rand() * 0xffffffffffff).toString(16) + Date.now().toString(16);
  };

  R.defaultTravel = function () {
    return {
      day: 1,
      milesUsed: 0,
      forcedMainEvent: null,
      forcedMainEventFired: false,
      provinceId: 'northern_province',
      travelEventDay: 0,
      nextTravelEventAtMiles: 0,
      lastWeatherDay: -999,
      activeWeather: null,
      weatherEventDay: 0,
      /* Miles events added to (or took from) today's 30. */
      milesAdjust: 0
    };
  };
  function journeyRules() { return ns.journey; }
  function journeyDefs(defs) { return defs || (window.TSI_DATA && window.TSI_DATA.journeyEvents) || { events: [], regions: {}, settings: {} }; }

  /* The heroes start in a diagonal line near the top left, as before. The old
     spots (0.12 + 0.07i, 0.18 + 0.06i of the map box) are converted like the
     pins: the full-screen map box, with the 46px token's centre. */
  R.defaultState = function (data) {
    return {
      freeMove: false,
      mapPresetId: null,
      mapUploadKey: null,
      mapAspect: null,
      snap: { enabled: false },
      travel: R.defaultTravel(),
      grid: { enabled: true, r: 38, offsetX: 0, offsetY: 0, opacity: 0.35 },
      fog: { enabled: false, revealedByMapKey: {} },
      tokens: data.heroes.map(function (h, i) {
        return {
          id: h.id,
          name: h.title,
          initial: R.heroInitial(h.title),
          x: Math.round((0.0602 + i * 0.084) * 10000) / 10000,
          y: Math.round((0.2016 + i * 0.06) * 10000) / 10000,
          size: 46,
          groupId: null,
          milesUsed: 0
        };
      }),
      /* The events' gold, effects, threads and the event in progress
         (journey.js). Saved since 6 October 2026: the gold is a running
         total the DM clears (Harry's choice). */
      journey: journeyRules().empty()
    };
  };

  /* ---------- Saves ---------- */
  /* What's kept (old saveNow 1239-1251), with the map picture kept separately. */
  R.toSave = function (state) {
    return {
      version: R.SAVE_VERSION,
      freeMove: !!state.freeMove,
      mapPresetId: state.mapPresetId || null,
      mapUploadKey: state.mapUploadKey || null,
      mapAspect: state.mapAspect || null,
      snap: { enabled: !!state.snap.enabled },
      travel: TSI.clone(state.travel),
      grid: TSI.clone(state.grid),
      fog: TSI.clone(state.fog),
      tokens: state.tokens.map(function (t) {
        return { id: t.id, name: t.name, initial: t.initial, x: t.x, y: t.y, size: t.size, groupId: t.groupId || null, milesUsed: t.milesUsed };
      }),
      journey: TSI.clone(state.journey || journeyRules().empty())
    };
  };

  /* A problem that stops a save being used, or null. Anything that could crash
     the Explorer is refused here, so a damaged file can't lock it (EXP-12). */
  R.saveProblem = function (s) {
    if (!isObj(s)) return 'It isn\'t an Explorer save.';
    if (!Array.isArray(s.tokens)) return 'It has no heroes list.';
    for (var i = 0; i < s.tokens.length; i++) {
      var t = s.tokens[i];
      if (!isObj(t) || typeof t.id !== 'string') return 'Hero ' + (i + 1) + ' in the file is damaged.';
      if ('x' in t && typeof t.x !== 'number') return 'Hero ' + (i + 1) + '\'s position is damaged.';
      if ('y' in t && typeof t.y !== 'number') return 'Hero ' + (i + 1) + '\'s position is damaged.';
    }
    if (!isObj(s.travel)) return 'It has no travel record.';
    if (!isObj(s.grid)) return 'It has no grid settings.';
    if ('fog' in s && !isObj(s.fog)) return 'Its fog record is damaged.';
    if (isObj(s.fog) && 'revealedByMapKey' in s.fog && !isObj(s.fog.revealedByMapKey)) return 'Its fog record is damaged.';
    if ('snap' in s && !isObj(s.snap)) return 'Its snap setting is damaged.';
    if (s.travel.activeWeather !== null && s.travel.activeWeather !== undefined && !isObj(s.travel.activeWeather)) return 'Its weather record is damaged.';
    if (s.travel.forcedMainEvent !== null && s.travel.forcedMainEvent !== undefined && !isObj(s.travel.forcedMainEvent)) return 'Its main-event record is damaged.';
    return journeyRules().problem(s.journey);
  };
  R.isSave = function (s) { return R.saveProblem(s) === null; };

  /* The uploaded map picture: a data: URL of an image, or '' for none. */
  R.isMapImage = function (v) {
    return isObj(v) && typeof v.dataUrl === 'string' && /^data:image\//.test(v.dataUrl) && typeof v.key === 'string';
  };

  /* Load a save over the defaults (old 1195-1227). Heroes are matched by id;
     their miles now come back too (EXP-03). */
  R.fromSave = function (saved, data, defs) {
    var state = R.defaultState(data);
    state.journey = journeyRules().clean(saved.journey, journeyDefs(defs));
    if (typeof saved.mapPresetId === 'string' && R.preset(data, saved.mapPresetId)) state.mapPresetId = saved.mapPresetId;
    if (typeof saved.mapUploadKey === 'string') state.mapUploadKey = saved.mapUploadKey;
    if (typeof saved.mapAspect === 'number' && saved.mapAspect > 0) state.mapAspect = saved.mapAspect;
    if (isObj(saved.grid)) {
      ['r', 'offsetX', 'offsetY', 'opacity'].forEach(function (k) {
        if (typeof saved.grid[k] === 'number' && Number.isFinite(saved.grid[k])) state.grid[k] = saved.grid[k];
      });
      if (typeof saved.grid.enabled === 'boolean') state.grid.enabled = saved.grid.enabled;
    }
    if (isObj(saved.snap) && typeof saved.snap.enabled === 'boolean') state.snap.enabled = saved.snap.enabled;
    if (typeof saved.freeMove === 'boolean') state.freeMove = saved.freeMove;
    if (isObj(saved.travel)) {
      var t = saved.travel;
      var d = state.travel;
      ['day', 'milesUsed', 'travelEventDay', 'nextTravelEventAtMiles', 'lastWeatherDay', 'weatherEventDay', 'milesAdjust'].forEach(function (k) {
        if (typeof t[k] === 'number' && Number.isFinite(t[k])) d[k] = t[k];
      });
      if (typeof t.provinceId === 'string' && R.province(data, t.provinceId)) d.provinceId = t.provinceId;
      if (typeof t.forcedMainEventFired === 'boolean') d.forcedMainEventFired = t.forcedMainEventFired;
      if (isObj(t.forcedMainEvent) && typeof t.forcedMainEvent.id === 'string') d.forcedMainEvent = { id: t.forcedMainEvent.id, dueDay: num(t.forcedMainEvent.dueDay, 0) };
      if (isObj(t.activeWeather) && typeof t.activeWeather.kind === 'string') d.activeWeather = { kind: t.activeWeather.kind, day: num(t.activeWeather.day, 0) };
    }
    if (isObj(saved.fog)) {
      if (typeof saved.fog.enabled === 'boolean') state.fog.enabled = saved.fog.enabled;
      if (isObj(saved.fog.revealedByMapKey)) {
        Object.keys(saved.fog.revealedByMapKey).forEach(function (key) {
          var cells = saved.fog.revealedByMapKey[key];
          if (!isObj(cells)) return;
          var clean = {};
          Object.keys(cells).forEach(function (c) { if (cells[c]) clean[c] = true; });
          state.fog.revealedByMapKey[key] = clean;
        });
      }
    }
    if (Array.isArray(saved.tokens)) {
      var byId = {};
      saved.tokens.forEach(function (t) { if (isObj(t) && typeof t.id === 'string') byId[t.id] = t; });
      state.tokens = state.tokens.map(function (t) {
        var prev = byId[t.id];
        if (!prev) return t;
        return Object.assign({}, t, {
          x: R.clamp(num(prev.x, t.x), 0, 1),
          y: R.clamp(num(prev.y, t.y), 0, 1),
          size: R.clamp(num(prev.size, t.size), 24, 140),
          groupId: typeof prev.groupId === 'string' && prev.groupId ? prev.groupId : null,
          milesUsed: R.clamp(num(prev.milesUsed, 0), 0, 1000)
        });
      });
    }
    return state;
  };

  /* A reason to refuse an import file, or null (checked before anything is replaced). */
  R.importProblem = function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.key === 'tsi.explorer.save') {
        var problem = R.saveProblem(r.value);
        if (problem) return 'This file\'s journey isn\'t in the right form, so it wasn\'t imported. ' + problem + ' Nothing was changed.';
      }
      if (r.key === 'tsi.explorer.mapImage' && !R.isMapImage(r.value)) return 'This file\'s map picture isn\'t in the right form, so it wasn\'t imported. Nothing was changed.';
    }
    return null;
  };

  /* ---------- Lookups ---------- */
  R.preset = function (data, id) {
    for (var i = 0; i < data.maps.length; i++) if (data.maps[i].id === id) return data.maps[i];
    return null;
  };
  R.province = function (data, id) {
    for (var i = 0; i < data.provinces.length; i++) if (data.provinces[i].id === id) return data.provinces[i];
    return null;
  };
  R.provinceLabel = function (data, id) {
    var p = R.province(data, id);
    return p ? p.label : (id || 'Unknown');
  };
  /* The event region for a map (old mapIdToProvinceId, 60-74). */
  R.mapProvince = function (data, mapId) {
    var p = R.preset(data, mapId);
    if (p && p.province) return p.province;
    var prefixes = ['northern_province', 'midland_province', 'eastern_province', 'southern_province', 'western_province'];
    for (var i = 0; i < prefixes.length; i++) if (String(mapId).indexOf(prefixes[i]) === 0) return prefixes[i];
    return 'northern_province';
  };
  R.mainEvent = function (data, id) {
    for (var i = 0; i < data.mainEvents.length; i++) if (data.mainEvents[i].id === id) return data.mainEvents[i];
    return null;
  };
  R.token = function (state, id) {
    for (var i = 0; i < state.tokens.length; i++) if (state.tokens[i].id === id) return state.tokens[i];
    return null;
  };
  R.groupIds = function (state, groupId) {
    return state.tokens.filter(function (t) { return t.groupId === groupId; }).map(function (t) { return t.id; });
  };

  /* ---------- The board and the screen ---------- */
  /* The board's shape: the loaded map's, or 16:9 with no map. */
  R.aspect = function (state, data) {
    if (state.mapPresetId) {
      var p = R.preset(data, state.mapPresetId);
      if (p && p.aspect) return p.aspect;
    }
    if (state.mapUploadKey && state.mapAspect) return state.mapAspect;
    return R.NO_MAP_ASPECT;
  };
  R.board = function (aspect) {
    return { w: R.BOARD_W, h: R.BOARD_W / (aspect > 0 ? aspect : R.NO_MAP_ASPECT) };
  };
  /* The board fitted whole into the map area and centred, as the old map
     picture was (object-fit: contain). */
  R.view = function (stageW, stageH, board) {
    var fit = Math.max(0.0001, Math.min(stageW / board.w, stageH / board.h));
    return { fit: fit, ox: (stageW - board.w * fit) / 2, oy: (stageH - board.h * fit) / 2 };
  };
  R.toScreen = function (v, bx, by) { return { x: v.ox + bx * v.fit, y: v.oy + by * v.fit }; };
  R.toBoard = function (v, sx, sy) { return { x: (sx - v.ox) / v.fit, y: (sy - v.oy) / v.fit }; };

  /* A token's centre in board units, and back. */
  R.centre = function (board, t) { return { x: t.x * board.w, y: t.y * board.h }; };
  /* Keep the whole token on the map picture. */
  R.clampCentre = function (board, size, bx, by) {
    var half = size / 2;
    return {
      x: R.clamp(bx, Math.min(half, board.w / 2), Math.max(board.w - half, board.w / 2)),
      y: R.clamp(by, Math.min(half, board.h / 2), Math.max(board.h - half, board.h / 2))
    };
  };
  R.place = function (board, t, bx, by) {
    var c = R.clampCentre(board, t.size, bx, by);
    t.x = c.x / board.w;
    t.y = c.y / board.h;
  };

  /* ---------- Hex grid (pointy-top axial, old 1353-1425) ---------- */
  R.hexSize = function (grid) { return R.clamp(Number(grid.r) || 38, 10, 220); };
  R.pixelToAxial = function (grid, px, py) {
    var s = R.hexSize(grid);
    var x = px - (Number(grid.offsetX) || 0);
    var y = py - (Number(grid.offsetY) || 0);
    return { q: (Math.sqrt(3) / 3 * x - 1 / 3 * y) / s, r: (2 / 3 * y) / s };
  };
  R.axialToPixel = function (grid, q, r) {
    var s = R.hexSize(grid);
    return { x: s * Math.sqrt(3) * (q + r / 2) + (Number(grid.offsetX) || 0), y: s * (3 / 2) * r + (Number(grid.offsetY) || 0) };
  };
  R.axialRound = function (a) {
    var x = Number(a.q), z = Number(a.r), y = -x - z;
    var rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    var xd = Math.abs(rx - x), yd = Math.abs(ry - y), zd = Math.abs(rz - z);
    if (xd > yd && xd > zd) rx = -ry - rz;
    else if (yd > zd) ry = -rx - rz;
    else rz = -rx - ry;
    return { q: rx + 0, r: rz + 0 };
  };
  R.hexDistance = function (a, b) {
    var dq = a.q - b.q, dr = a.r - b.r, ds = (-a.q - a.r) - (-b.q - b.r);
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
  };
  R.hexAt = function (grid, bx, by) { return R.axialRound(R.pixelToAxial(grid, bx, by)); };
  /* The hex under a token, always worked out from where it is (so it can't go
     stale after a resize, full screen or a map change: EXP-04, EXP-11). */
  R.tokenHex = function (state, board, t) {
    var c = R.centre(board, t);
    return R.hexAt(state.grid, c.x, c.y);
  };
  /* The range of hexes covering a board-unit rectangle (old drawHexGrid 1763-1782). */
  R.hexRange = function (grid, x0, y0, x1, y1) {
    var pad = 3;
    var a = [R.pixelToAxial(grid, x0, y0), R.pixelToAxial(grid, x1, y0), R.pixelToAxial(grid, x0, y1), R.pixelToAxial(grid, x1, y1)];
    var rs = a.map(function (p) { return p.r; });
    var qs = a.map(function (p) { return p.q; });
    return {
      rMin: Math.floor(Math.min.apply(null, rs)) - pad,
      rMax: Math.ceil(Math.max.apply(null, rs)) + pad,
      qMin: Math.floor(Math.min.apply(null, qs)) - pad - 6,
      qMax: Math.ceil(Math.max.apply(null, qs)) + pad + 6
    };
  };

  /* ---------- Fog of war (radius 2, kept per map: old 1428-1482) ---------- */
  R.hashText = function (str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
    return (h >>> 0).toString(16);
  };
  R.mapKey = function (state) {
    if (state.mapPresetId) return 'preset:' + state.mapPresetId;
    if (state.mapUploadKey) return 'upload:' + state.mapUploadKey;
    return 'none';
  };
  R.fogStore = function (state) {
    if (!isObj(state.fog)) state.fog = { enabled: false, revealedByMapKey: {} };
    if (!isObj(state.fog.revealedByMapKey)) state.fog.revealedByMapKey = {};
    var key = R.mapKey(state);
    if (!state.fog.revealedByMapKey[key]) state.fog.revealedByMapKey[key] = {};
    return state.fog.revealedByMapKey[key];
  };
  R.reveal = function (state, centre, radius) {
    if (radius === undefined) radius = 2;
    if (!centre || !Number.isFinite(centre.q) || !Number.isFinite(centre.r)) return;
    var store = R.fogStore(state);
    for (var dq = -radius; dq <= radius; dq++) {
      for (var dr = -radius; dr <= radius; dr++) {
        var c = { q: centre.q + dq, r: centre.r + dr };
        if (R.hexDistance(centre, c) <= radius) store[c.q + ',' + c.r] = true;
      }
    }
  };
  R.revealedCount = function (state) { return Object.keys(R.fogStore(state)).length; };
  /* The focus hero (whose miles show) clears the fog around them. */
  R.focusToken = function (state, focusId) { return R.token(state, focusId) || state.tokens[0] || null; };
  R.revealAroundFocus = function (state, board, focusId) {
    var f = R.focusToken(state, focusId);
    if (!f) return;
    R.reveal(state, R.tokenHex(state, board, f), 2);
  };

  /* ---------- Town pins (old renderMarkers 1975-2014) ---------- */
  R.markerRevealed = function (state, board, m) {
    if (!state.fog || !state.fog.enabled) return true;
    var store = R.fogStore(state);
    var a = R.hexAt(state.grid, (Number(m.x) || 0) * board.w, (Number(m.y) || 0) * board.h);
    return !!store[a.q + ',' + a.r];
  };
  /* Only preset maps have pins; pins without a town map stay hidden (E10);
     with fog on, only pins in uncovered hexes show. */
  R.visibleMarkers = function (state, data, board) {
    var mapId = state.mapPresetId || '';
    if (!mapId) return [];
    var list = data.markersByMapId[mapId];
    if (!Array.isArray(list) || !list.length) return [];
    return list.filter(function (m) {
      if (!m.submapImage || !String(m.submapImage).trim()) return false;
      return R.markerRevealed(state, board, m);
    });
  };

  /* ---------- Travel ---------- */
  /* Pace for the miles walked today (old 1665-1670). Slow's "good foraging"
     went with the rations (Harry, 6 October 2026). */
  R.travelMode = function (m) {
    if (m <= 0) return { mode: '—', effects: '—', key: null };
    if (m <= 18) return { mode: 'Slow (≤18 miles)', effects: '+Stealth', key: 'slow' };
    if (m <= 24) return { mode: 'Normal (≤24 miles)', effects: 'No effects', key: 'normal' };
    return { mode: 'Fast (≤30 miles)', effects: '−5 Passive Perception', key: 'fast' };
  };
  /* Today's limit: 30 miles, plus or minus what events changed. */
  R.dayLimit = function (state) { return journeyRules().dayLimit(state); };
  R.milesShown = function (t, limit) {
    return R.clamp(Number(t && t.milesUsed) || 0, 0, Math.max(R.DAY_MILES, Number(limit) || 0));
  };

  /* Snap on: every hero moves to the centre of the hex it's in (old 2069-2110). */
  R.snapAll = function (state, board) {
    state.tokens.forEach(function (t) {
      var a = R.tokenHex(state, board, t);
      var p = R.axialToPixel(state.grid, a.q, a.r);
      R.place(board, t, p.x, p.y);
    });
  };

  /* Where each hero is drawn. With Snap on, heroes sharing a hex sit in a
     small cluster inside it; the hero being dragged sits in the middle (old
     renderTokens 1815-1927). Returns { id: {x, y} } top-left corners in board
     units. */
  R.layoutTokens = function (state, board, anchorId) {
    var out = {};
    if (!state.snap.enabled) {
      state.tokens.forEach(function (t) {
        var c = R.centre(board, t);
        out[t.id] = {
          x: R.clamp(c.x - t.size / 2, 0, Math.max(0, board.w - t.size)),
          y: R.clamp(c.y - t.size / 2, 0, Math.max(0, board.h - t.size))
        };
      });
      return out;
    }
    var groups = {};
    var hexOf = {};
    state.tokens.forEach(function (t) {
      var a = R.tokenHex(state, board, t);
      var key = a.q + ',' + a.r;
      hexOf[t.id] = a;
      (groups[key] = groups[key] || []).push(t);
    });
    state.tokens.forEach(function (t) {
      var a = hexOf[t.id];
      var cluster = groups[a.q + ',' + a.r].slice();
      if (anchorId) cluster.sort(function (p, q) { return p.id === anchorId ? -1 : q.id === anchorId ? 1 : 0; });
      var idx = cluster.indexOf(t);
      var n = Math.max(1, cluster.length);
      var centre = R.axialToPixel(state.grid, a.q, a.r);
      var tokenRadius = t.size / 2;
      var clusterR = Math.min(Math.max(0, R.hexSize(state.grid) * 0.86 - tokenRadius - 6), 12);
      var cx = centre.x, cy = centre.y;
      if (idx > 0) {
        var angle = (Math.PI * 2 * (idx - 1)) / Math.max(1, n - 1);
        cx = centre.x + Math.cos(angle) * clusterR;
        cy = centre.y + Math.sin(angle) * clusterR;
      }
      out[t.id] = {
        x: R.clamp(cx - tokenRadius, 0, Math.max(0, board.w - t.size)),
        y: R.clamp(cy - tokenRadius, 0, Math.max(0, board.h - t.size))
      };
    });
    return out;
  };

  /* A snapped drag: every dragged hero moves by the same number of hexes as
     the one you grabbed (old 2640-2715). target is the pointer in board
     units, pulled 30% towards the grabbed hero, as before. Returns the target
     hex, or null if it hasn't changed. */
  R.dragSnap = function (state, board, drag, pointer) {
    var anchor = R.token(state, drag.anchorId);
    var tx = pointer.x, ty = pointer.y;
    if (anchor) {
      var ac = R.centre(board, anchor);
      tx = pointer.x * 0.7 + ac.x * 0.3;
      ty = pointer.y * 0.7 + ac.y * 0.3;
    }
    var target = R.hexAt(state.grid, tx, ty);
    if (drag.lastTargetAx && drag.lastTargetAx.q === target.q && drag.lastTargetAx.r === target.r) return null;
    drag.lastTargetAx = target;
    var dq = target.q - drag.startAxial.q;
    var dr = target.r - drag.startAxial.r;
    drag.ids.forEach(function (id) {
      var t = R.token(state, id);
      var start = drag.startAxials[id];
      if (!t || !start) return;
      var p = R.axialToPixel(state.grid, start.q + dq, start.r + dr);
      R.place(board, t, p.x, p.y);
    });
    return target;
  };

  /* A free drag: every dragged hero moves by the pointer's movement (board units). */
  R.dragFree = function (state, board, drag, dx, dy) {
    drag.starts.forEach(function (st) {
      var t = R.token(state, st.id);
      if (t) R.place(board, t, st.cx + dx, st.cy + dy);
    });
  };

  /* Start a drag of the selected heroes, grabbed by anchorId. */
  R.startDrag = function (state, board, ids, anchorId) {
    var drag = { ids: ids.slice(), anchorId: anchorId, starts: [], startAxials: {}, startAxial: null, lastTargetAx: null };
    ids.forEach(function (id) {
      var t = R.token(state, id);
      if (!t) return;
      var c = R.centre(board, t);
      drag.starts.push({ id: id, x: t.x, y: t.y, cx: c.x, cy: c.y });
      drag.startAxials[id] = R.hexAt(state.grid, c.x, c.y);
    });
    var a = R.token(state, anchorId);
    if (a) drag.startAxial = R.tokenHex(state, board, a);
    return drag;
  };
  R.undoDrag = function (state, drag) {
    drag.starts.forEach(function (st) {
      var t = R.token(state, st.id);
      if (t) { t.x = st.x; t.y = st.y; }
    });
  };
  /* A tired hero (today's limit, 30 miles unless an event changed it) can't
     be dragged unless Free Move is on (old 2630-2632). */
  R.canDrag = function (state, anchorId) {
    var a = R.token(state, anchorId);
    return !!state.freeMove || (Number(a && a.milesUsed) || 0) < R.dayLimit(state);
  };

  /* A forced main event that's due replaces the camp or travel event (old
     2329-2349). The Queue button plays events at once (E5), so this only
     matters for a journey that already had one queued. */
  R.takeForcedMainEvent = function (state, data) {
    var queued = state.travel.forcedMainEvent;
    if (!queued || state.travel.forcedMainEventFired) return null;
    var dayNow = Number(state.travel.day) || 1;
    var dueDay = Number(queued.dueDay) || (dayNow + 1);
    if (dayNow < dueDay) return null;
    var ev = R.mainEvent(data, queued.id);
    if (!ev) return null;
    state.travel.forcedMainEventFired = true;
    state.travel.forcedMainEvent = null;
    return ev;
  };

  /* Letting go of a drag (old onTokenPointerUp 2753-2876). The grabbed hero's
     hex move sets the miles: 6 per hex, charged to every hero that moved.
     Returns { result: 'free' | 'tooFar' | 'moved', miles, open, tired }.
     'tooFar' means nothing was charged and the caller puts the heroes back.
     open is the event to show, if one triggered: a due main event (old
     saves only), or a new travel event, already begun (kind 'journey'). */
  R.finishMove = function (state, data, defs, drag, board, rand) {
    var anchor = R.token(state, drag.anchorId);
    if (!anchor || !drag.startAxial) return { result: 'none', miles: 0, open: null };
    var endAx = R.tokenHex(state, board, anchor);
    var miles = Math.round(R.hexDistance(drag.startAxial, endAx) * R.MILES_PER_HEX);
    if (state.freeMove) return { result: 'free', miles: miles, open: null };

    var limit = R.dayLimit(state);
    var moved = drag.ids.length ? drag.ids : [anchor.id];
    for (var i = 0; i < moved.length; i++) {
      var t = R.token(state, moved[i]);
      if (t && (Number(t.milesUsed) || 0) + miles > limit) return { result: 'tooFar', miles: miles, open: null };
    }
    moved.forEach(function (id) {
      var t = R.token(state, id);
      if (t) t.milesUsed = (Number(t.milesUsed) || 0) + miles;
    });

    /* Once a day, when the party has gone a random 6 to 24 miles, the day's
       travel roll is made (journey.js: 30%, never two days running). */
    var open = null;
    var travel = state.travel;
    var dayNow = Number(travel.day) || 1;
    if (!travel.nextTravelEventAtMiles || travel.nextTravelEventAtMiles <= 0) {
      travel.nextTravelEventAtMiles = 6 + Math.floor(rand() * 19);
    }
    /* An event still open (kept for later) waits; the day's roll isn't used up. */
    var busy = !!(state.journey && state.journey.current);
    if (travel.travelEventDay !== dayNow && miles > 0 && !busy) {
      var milesNow = Number(anchor.milesUsed) || 0;
      if (milesNow >= travel.nextTravelEventAtMiles) {
        travel.travelEventDay = dayNow;
        var main = R.takeForcedMainEvent(state, data);
        if (main) {
          open = { kind: 'main', event: main };
        } else {
          var J = journeyRules();
          var d = journeyDefs(defs);
          var ctx = J.context(state, d, { x: anchor.x, y: anchor.y });
          var it = J.travelRoll(state, d, ctx, rand);
          if (it) {
            J.begin(state, d, it, ctx, rand);
            open = { kind: 'journey' };
          }
        }
      }
    }
    return { result: 'moved', miles: miles, open: open, tired: (Number(anchor.milesUsed) || 0) >= limit };
  };

  /* ---------- Changing map (old loadPresetMapById 2153-2182) ---------- */
  /* Arriving from a linked map puts the party's centre at the entry point,
     keeping its formation (old 138-178). */
  R.spawnParty = function (state, data, fromId, toId) {
    if (!fromId || !toId) return false;
    var entry = data.spawns[fromId] && data.spawns[fromId][toId];
    if (!entry || !state.tokens.length) return false;
    var sx = 0, sy = 0;
    state.tokens.forEach(function (t) { sx += typeof t.x === 'number' ? t.x : 0.5; sy += typeof t.y === 'number' ? t.y : 0.5; });
    var cx = sx / state.tokens.length, cy = sy / state.tokens.length;
    var board = R.board(R.aspect(Object.assign({}, state, { mapPresetId: toId }), data));
    state.tokens.forEach(function (t) {
      R.place(board, t, R.clamp(entry.x + (t.x - cx), 0, 1) * board.w, R.clamp(entry.y + (t.y - cy), 0, 1) * board.h);
    });
    return true;
  };
  R.loadPreset = function (state, data, mapId) {
    var preset = R.preset(data, mapId);
    if (!preset) return null;
    var fromId = state.mapPresetId || null;
    state.mapPresetId = preset.id;
    state.mapUploadKey = null;
    state.mapAspect = null;
    state.travel.provinceId = R.mapProvince(data, preset.id);
    var spawned = R.spawnParty(state, data, fromId, preset.id);
    return { preset: preset, spawned: spawned };
  };

  /* ---------- Events ---------- */
  /* The line under an event's title (old 882-889). */
  R.eventMeta = function (data, state, kind, event) {
    var label = kind === 'main' ? 'Main Campaign' : kind === 'camp' ? 'Campfire Event' : kind === 'weather' ? 'Weather' : 'Travel Event';
    return label + ' • ' + R.provinceLabel(data, state.travel.provinceId || 'northern_province') + ' • ' + ((event && event.type) || '—');
  };
  /* One ambient sentence was taken out of the event text (old 842-845). */
  R.stripAmbientLine = function (text) {
    if (!text) return text;
    return String(text).replace(/\s*The air carries cold pines, crags, old stone roads, watchposts, buckbear heraldry\.\s*/g, ' ').trim();
  };
  R.step = function (event, stepId) {
    var steps = event.steps;
    for (var i = 0; i < steps.length; i++) if (steps[i].id === stepId) return steps[i];
    return steps[0];
  };
  R.firstStepId = function (event) {
    var hasStart = event.steps.some(function (s) { return s.id === 'start'; });
    return hasStart ? 'start' : String(event.steps[0].id || 'start');
  };
  /* A main campaign event's outcome (the old step format, still used by
     the main events and the weekly Bastion prompt): its gold goes on the
     party's event gold, and the summary shows under the travel line (old
     applyOutcome 847-877). Rations are gone (6 October 2026). */
  R.applyOutcome = function (state, outcome) {
    if (!outcome) return null;
    if (!isObj(state.journey)) state.journey = journeyRules().empty();
    var j = state.journey;
    if (Number.isFinite(outcome.gold) && outcome.gold) j.gold = (Number(j.gold) || 0) + outcome.gold;
    var note = outcome.note ? String(outcome.note).trim() : '';
    var parts = [];
    if (Number.isFinite(outcome.gold) && outcome.gold !== 0) parts.push((outcome.gold > 0 ? '+' : '') + outcome.gold + ' gold');
    if (note) parts.push(note);
    if (parts.length) {
      j.log.unshift('Day ' + (Number(state.travel.day) || 1) + ' · ' + parts.join(' • '));
      if (j.log.length > 100) j.log.length = 100;
    }
    return parts.length ? 'Outcome: ' + parts.join(' • ') : null;
  };
  R.outcomeText = function (o) {
    return (o && o.text) ? String(o.text) : (o && o.note) ? String(o.note) : 'The moment passes, leaving only the road ahead.';
  };

  /* Make Camp (old 2352-2427). Returns the night's pop-ups in order: the
     night's event (a due main event, tonight's set-up event, a follow-up on
     its last day, or a campfire event), then any weather, then the weekly
     Bastion prompt (E4). Before, each one replaced the last (EXP-01).
     Weather is exactly as before. A campfire event is rolled after the
     weather: 25%, skipped after a travel or weather event that day. A
     journey event is begun here (kind 'journey'), so a reload picks it up. */
  R.makeCamp = function (state, data, defs, rand) {
    var J = journeyRules();
    var d = journeyDefs(defs);
    var queue = [];
    var travel = state.travel;
    if (!isObj(state.journey)) state.journey = J.empty();
    var ctx = J.context(state, d);
    var dayBefore = Number(travel.day) || 1;
    var busy = !!state.journey.current;

    var main = R.takeForcedMainEvent(state, data);
    var night = null;
    if (main) {
      queue.push({ kind: 'main', event: main });
      J.postponeFollow(state, d, ctx);
    } else if (!busy) night = J.campOverride(state, d, ctx);

    travel.day = dayBefore + 1;
    if (travel.activeWeather) travel.activeWeather = null;

    var dayNow = Number(travel.day) || 1;
    var last = Number(travel.lastWeatherDay) || -999;
    var weatherTonight = false;
    if ((dayNow - last) >= data.weatherRules.cooldownDays && rand() < data.weatherRules.chance) {
      var w = data.weather[Math.floor(rand() * data.weather.length)];
      if (w) {
        queue.push({ kind: 'weather', weather: w, day: dayNow });
        travel.lastWeatherDay = dayNow;
        travel.weatherEventDay = dayNow;
        weatherTonight = true;
      }
    }

    /* A new day: miles back to 30, effects that have run out go. */
    state.tokens.forEach(function (t) { t.milesUsed = 0; });
    travel.milesAdjust = 0;
    J.newDay(state);

    if (!main && !busy) {
      var it = night || J.campRoll(state, d, ctx, rand, dayBefore, weatherTonight);
      if (it) {
        J.begin(state, d, it, ctx, rand);
        queue.unshift({ kind: 'journey' });
      }
    }

    /* The weekly Bastion prompt. The event gold is no longer cleared here:
       it's a saved running total the DM clears (Harry, 6 October 2026). */
    if ((Number(travel.day) || 1) % 7 === 1) {
      queue.push({ kind: 'camp', event: data.bastionPrompt });
    }

    travel.nextTravelEventAtMiles = 6 + Math.floor(rand() * 19);
    travel.travelEventDay = 0;
    return queue;
  };

  /* Reset Travel (old 2430-2442): back to day 1 with no miles. The weather
     wait is left as it is (E9). Effects and threads stay, and their days
     move with the day counter. */
  R.resetTravel = function (state) {
    var delta = 1 - (Number(state.travel.day) || 1);
    state.travel.day = 1;
    state.travel.milesAdjust = 0;
    state.tokens.forEach(function (t) { t.milesUsed = 0; });
    if (isObj(state.journey)) journeyRules().shiftDays(state, delta);
  };

  /* ---------- Weather ---------- */
  R.weatherMechLine = function (w) {
    var mech = (w && w.mechanic) || {};
    var dc = Number(mech.dc) || 0;
    return mech.label ? String(mech.label) : (dc ? 'DC ' + dc : 'Roll at the table');
  };
  R.weatherIntro = function (w) {
    return w.intro + '\n\nROLL: ' + R.weatherMechLine(w) + '\n\nEnter the final table roll result below to resolve the weather’s effect.';
  };
  /* The typed roll: a number, or null if it isn't one. An empty box counts as
     0, as before (Number('') is 0). */
  R.readRoll = function (text) {
    var roll = Number(text);
    return Number.isFinite(roll) ? roll : null;
  };
  R.resolveWeather = function (w, roll) {
    var results = w.results || [];
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (typeof r.min !== 'number' || roll >= r.min) return { headline: r.headline, text: r.text, effect: r.effect };
    }
    return { headline: 'Result', text: 'The weather passes.', effect: '' };
  };
  /* Resolving sets the video for the rest of that day (old 1099-1102). */
  R.setWeather = function (state, w, day) {
    state.travel.activeWeather = { kind: w.kind, day: day };
  };
  /* The weather video to show, or null. A video from an earlier day is
     cleared (old applyWeatherOverlay 1930-1947); returns changed: true then. */
  R.currentWeather = function (state, data) {
    var aw = state.travel.activeWeather;
    var dayNow = Number(state.travel.day) || 1;
    var changed = false;
    if (aw && Number(aw.day) !== dayNow) {
      state.travel.activeWeather = null;
      changed = true;
    }
    var active = state.travel.activeWeather;
    return { src: active ? (data.weatherVideos[active.kind] || null) : null, changed: changed };
  };

  /* ---------- Small helpers for the screen ---------- */
  R.readout = function (grid) {
    var r = Number(grid.r) || 0;
    var w = Math.round(Math.sqrt(3) * r);
    return r ? 'Hex: r=' + Math.round(r) + 'px (≈ ' + w + 'px wide)' : 'Hex: —';
  };
  /* The grid's strength. 0 counts as the default 0.35, as before (EXP-26, kept). */
  R.gridOpacity = function (grid) { return R.clamp(Number(grid.opacity) || 0.35, 0, 1); };
  R.resizeTokens = function (state, ids, delta) {
    state.tokens.forEach(function (t) {
      if (ids.indexOf(t.id) !== -1) t.size = R.clamp((Number(t.size) || 46) + delta, 24, 140);
    });
  };
  R.pickText = function (x, y) {
    return '"x": ' + Number(x.toFixed(4)) + ', "y": ' + Number(y.toFixed(4));
  };

  ns.rules = R;
}());
