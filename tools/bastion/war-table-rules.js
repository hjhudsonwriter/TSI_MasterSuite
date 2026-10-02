/* The Ironbow Bastion Manager — the War Table's rules.
   The War Table is the simplified battle map the Bastion opens during a
   Military Action. These are its plain rules, with no page code, so they can
   be tested on their own (tests/rules/bastion-war-table.test.js):
   - the board: everything is measured on the map picture in "board units"
     (1600 wide, as tall as the map's shape; 1600 × 900 with no map), so the
     forces stay on the same spot of the map at any window size, zoom, full
     screen, and when the window moves between the laptop and the TV;
   - where the board sits on screen (view, toScreen, toWorld);
   - the saved settings (grid, token size, camera) and the saved map record;
   - token sizes, keeping every token on your ground (the bottom half),
     snapping to the grid, and the opening battle line (formation).
   Positions are saved as FRACTIONS of the board (0..1, token centres), so a
   new map of a different shape keeps everyone in the same relative place. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var bas = TSI.bastion = TSI.bastion || {};

  var EPS = 1e-6;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function num(v, fallback) {
    var n = Number(v);
    return (v === null || v === '' || typeof v === 'boolean' || !Number.isFinite(n)) ? fallback : n;
  }
  function round2(v) { return Math.round(v * 100) / 100; }

  var W = bas.warTableRules = {
    BOARD_W: 1600,
    MAX_UPLOAD_BYTES: 4 * 1024 * 1024,
    GRID_MIN: 20,
    GRID_MAX: 200,
    GRID_STEP: 5,
    GRID_STEP_BIG: 20,
    TOKEN_MIN: 0.5,
    TOKEN_MAX: 2.5,
    TOKEN_STEP: 0.1,
    ZOOM_MIN: 0.5,
    ZOOM_MAX: 3,
    ZOOM_STEP: 0.25,
    /* The four kinds of force, in the order the roster lists them. */
    KINDS: ['regiment', 'defenders', 'lieutenant', 'beast'],
    KIND_NAMES: { regiment: 'Regiments', defenders: 'Defenders', lieutenant: 'Lieutenants', beast: 'Beasts' },

    clamp: clamp,

    /* ---------- The board ---------- */
    board: function (mapW, mapH) {
      if (mapW > 0 && mapH > 0) return { w: W.BOARD_W, h: W.BOARD_W * mapH / mapW };
      return { w: W.BOARD_W, h: 900 };
    },

    /* Where the board sits on screen. At zoom 1 the whole board fits the
       stage, centred ("contain"). Zoom is about the centre of the stage.
       camera.x / camera.y are a pan in board units: the board point at the
       centre of the stage is (board centre + camera).
       screen = origin + scale × board. */
    view: function (stageW, stageH, board, camera) {
      var f = Math.min(stageW / board.w, stageH / board.h);
      if (!(f > 0) || !Number.isFinite(f)) f = 1;
      var zoom = clamp(num(camera && camera.zoom, 1), W.ZOOM_MIN, W.ZOOM_MAX);
      var scale = f * zoom;
      var cx = board.w / 2 + num(camera && camera.x, 0);
      var cy = board.h / 2 + num(camera && camera.y, 0);
      return { fit: f, scale: scale, ox: stageW / 2 - scale * cx, oy: stageH / 2 - scale * cy };
    },
    toScreen: function (v, x, y) { return { x: v.ox + v.scale * x, y: v.oy + v.scale * y }; },
    toWorld: function (v, sx, sy) { return { x: (sx - v.ox) / v.scale, y: (sy - v.oy) / v.scale }; },

    /* Keep the centre of the stage over the board, so it can't be panned away. */
    clampCamera: function (camera, board) {
      var c = isObj(camera) ? camera : {};
      return {
        x: clamp(num(c.x, 0), -board.w / 2, board.w / 2),
        y: clamp(num(c.y, 0), -board.h / 2, board.h / 2),
        zoom: clamp(num(c.zoom, 1), W.ZOOM_MIN, W.ZOOM_MAX)
      };
    },

    /* A new camera at a new zoom that keeps the board point under the
       pointer (sx, sy on the stage) where it is: Ctrl + wheel. */
    zoomAt: function (stageW, stageH, board, camera, zoom, sx, sy) {
      var before = W.view(stageW, stageH, board, camera);
      var p = W.toWorld(before, sx, sy);
      var z = clamp(num(zoom, 1), W.ZOOM_MIN, W.ZOOM_MAX);
      var scale = before.fit * z;
      return W.clampCamera({
        x: p.x - board.w / 2 - (sx - stageW / 2) / scale,
        y: p.y - board.h / 2 - (sy - stageH / 2) / scale,
        zoom: z
      }, board);
    },

    /* ---------- Settings: grid, token size, camera ---------- */
    defaultSettings: function () {
      return { grid: { show: true, size: 70, snap: false, offX: 0, offY: 0 }, tokenScale: 1, camera: { x: 0, y: 0, zoom: 1 } };
    },
    /* A plain object is accepted; normalizeSettings deals with the values. */
    isSettings: function (v) { return isObj(v); },
    /* A clean copy, with anything missing filled in and everything in range. */
    normalizeSettings: function (v) {
      var d = W.defaultSettings();
      var s = isObj(v) ? v : {};
      var g = isObj(s.grid) ? s.grid : {};
      var c = isObj(s.camera) ? s.camera : {};
      return {
        grid: {
          show: typeof g.show === 'boolean' ? g.show : d.grid.show,
          size: Math.round(clamp(num(g.size, d.grid.size), W.GRID_MIN, W.GRID_MAX)),
          snap: typeof g.snap === 'boolean' ? g.snap : d.grid.snap,
          offX: num(g.offX, 0),
          offY: num(g.offY, 0)
        },
        tokenScale: round2(clamp(num(s.tokenScale, d.tokenScale), W.TOKEN_MIN, W.TOKEN_MAX)),
        camera: {
          x: num(c.x, 0),
          y: num(c.y, 0),
          zoom: round2(clamp(num(c.zoom, 1), W.ZOOM_MIN, W.ZOOM_MAX))
        }
      };
    },

    /* ---------- The map picture (saved as 'warMap') ---------- */
    isMap: function (v) {
      return isObj(v) &&
        typeof v.dataUrl === 'string' && /^data:image\//.test(v.dataUrl) &&
        typeof v.key === 'string' &&
        (v.name === undefined || typeof v.name === 'string');
    },
    /* A short fingerprint of the picture (djb2), like the Explorer's. */
    hashText: function (text) {
      var str = String(text);
      var h = 5381;
      for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
      return (h >>> 0).toString(16);
    },

    /* ---------- Deployment (saved by the Bastion) ---------- */
    /* { started, locked, positions: { id: { x, y } } } with x, y as fractions of the board. */
    normalizeDeployment: function (v) {
      var d = isObj(v) ? v : {};
      var positions = {};
      if (isObj(d.positions)) {
        Object.keys(d.positions).forEach(function (id) {
          var p = d.positions[id];
          if (isObj(p) && Number.isFinite(p.x) && Number.isFinite(p.y)) positions[id] = { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) };
        });
      }
      var locked = d.locked === true;
      return { started: d.started === true || locked, locked: locked, positions: positions };
    },

    /* ---------- Forces and their tokens ---------- */
    kindOf: function (force) {
      var k = typeof force === 'string' ? force : (force && force.kind);
      return W.KINDS.indexOf(k) === -1 ? 'lieutenant' : k;
    },
    isCircle: function (force) {
      var k = W.kindOf(force);
      return k === 'lieutenant' || k === 'beast';
    },
    /* The forces list cleaned up: an id each, no repeats, a known kind. */
    cleanForces: function (list) {
      var seen = {};
      var out = [];
      (Array.isArray(list) ? list : []).forEach(function (f) {
        if (!isObj(f) || f.id === undefined || f.id === null || f.id === '') return;
        var id = String(f.id);
        if (seen[id]) return;
        seen[id] = true;
        out.push(Object.assign({}, f, { id: id, kind: W.kindOf(f) }));
      });
      return out;
    },
    gridSize: function (grid) { return clamp(num(grid && grid.size, 70), W.GRID_MIN, W.GRID_MAX); },
    /* A token's size in board units: lieutenants and beasts are circles one
       square across; regiments and the Bastion Defenders are 3 × 2 squares. */
    tokenDims: function (force, grid, tokenScale) {
      var cell = W.gridSize(grid) * clamp(num(tokenScale, 1), W.TOKEN_MIN, W.TOKEN_MAX);
      if (W.isCircle(force)) return { w: cell, h: cell, cols: 1, rows: 1, shape: 'circle' };
      return { w: 3 * cell, h: 2 * cell, cols: 3, rows: 2, shape: 'rect' };
    },

    /* ---------- Your ground: the bottom half ---------- */
    /* Keep the whole token on the board and in the bottom half (its top edge
       on or below the midline). A token taller than the bottom half has its
       top pinned to the midline; one wider than the board is centred. */
    clampToBottomHalf: function (cx, cy, w, h, board) {
      var mid = board.h / 2;
      var x = w >= board.w ? board.w / 2 : clamp(num(cx, board.w / 2), w / 2, board.w - w / 2);
      var y = h >= board.h - mid ? mid + h / 2 : clamp(num(cy, mid + h / 2), mid + h / 2, board.h - h / 2);
      return { x: x, y: y };
    },
    /* True when the token is already where clampToBottomHalf would leave it. */
    inBottomHalf: function (cx, cy, w, h, board) {
      var c = W.clampToBottomHalf(cx, cy, w, h, board);
      return Math.abs(c.x - cx) < EPS && Math.abs(c.y - cy) < EPS;
    },

    /* Snap a token so it covers whole squares: its centre goes on a square's
       centre when it is an odd number of squares across (a circle, or 3
       wide), and on a grid corner when even (2 tall). offX / offY shift the grid. */
    snapToken: function (cx, cy, w, h, grid) {
      var size = W.gridSize(grid);
      var offX = num(grid && grid.offX, 0);
      var offY = num(grid && grid.offY, 0);
      function axis(c, span, off) {
        var n = Math.max(1, Math.round(span / size));
        if (n % 2 === 1) return off + (Math.floor((c - off) / size) + 0.5) * size;
        return off + Math.round((c - off) / size) * size;
      }
      return { x: axis(cx, w, offX), y: axis(cy, h, offY) };
    },

    /* Where a token ends up after a move: snapped (when snap is on) and kept
       on your ground. A snapped token that would cross the midline or the edge
       steps back by whole squares, so it stays on the grid; only if that
       can't work is it clamped. */
    settle: function (cx, cy, w, h, board, grid, snap) {
      if (!snap) return W.clampToBottomHalf(cx, cy, w, h, board);
      var size = W.gridSize(grid);
      var s = W.snapToken(cx, cy, w, h, grid);
      var mid = board.h / 2;
      function fit(c, half, lo, hi) {
        var min = lo + half;
        var max = hi - half;
        if (max < min - EPS) return null;
        if (c < min - EPS) c += Math.ceil((min - c) / size - EPS) * size;
        if (c > max + EPS) c -= Math.ceil((c - max) / size - EPS) * size;
        return (c < min - EPS || c > max + EPS) ? null : c;
      }
      var x = fit(s.x, w / 2, 0, board.w);
      var y = fit(s.y, h / 2, mid, board.h);
      var clamped = W.clampToBottomHalf(x === null ? s.x : x, y === null ? s.y : y, w, h, board);
      return clamped;
    },

    /* ---------- Fractions and board units ---------- */
    fromFractions: function (positions, board) {
      var out = {};
      Object.keys(positions || {}).forEach(function (id) {
        var p = positions[id];
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out[id] = { x: p.x * board.w, y: p.y * board.h };
      });
      return out;
    },
    toFractions: function (positions, board) {
      var out = {};
      Object.keys(positions || {}).forEach(function (id) {
        var p = positions[id];
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out[id] = { x: p.x / board.w, y: p.y / board.h };
      });
      return out;
    },

    /* Re-place every placed token after the board's shape, the grid or the
       token size changes: each stays on your ground (and on the grid, when
       snap is on). Fractions in, fractions out; tokens with no position are
       left out, and so are positions for forces no longer listed. */
    clampAll: function (positions, forces, board, grid, tokenScale) {
      var out = {};
      W.cleanForces(forces).forEach(function (f) {
        var p = positions && positions[f.id];
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        var d = W.tokenDims(f, grid, tokenScale);
        var c = W.settle(p.x * board.w, p.y * board.h, d.w, d.h, board, grid, !!(grid && grid.snap));
        out[f.id] = { x: c.x / board.w, y: c.y / board.h };
      });
      return out;
    },
    /* Positions for any listed force that hasn't got one yet (a force added
       after deployment began), taken from the opening battle line. */
    fillMissing: function (positions, forces, board, grid, tokenScale) {
      var out = Object.assign({}, positions || {});
      var line = null;
      W.cleanForces(forces).forEach(function (f) {
        if (out[f.id]) return;
        if (!line) line = W.formation(forces, board, grid, tokenScale);
        if (line[f.id]) out[f.id] = line[f.id];
      });
      return out;
    },
    /* True when two sets of fractions are the same (to a millionth). */
    samePositions: function (a, b) {
      var ka = Object.keys(a || {});
      var kb = Object.keys(b || {});
      if (ka.length !== kb.length) return false;
      return ka.every(function (id) {
        var p = a[id];
        var q = b[id];
        return q && Math.abs(p.x - q.x) < EPS && Math.abs(p.y - q.y) < EPS;
      });
    },

    /* ---------- The opening battle line ----------
       In the bottom half: the regiments in the front line just below the
       midline, centred; the lieutenants behind the regiments; the Bastion
       Defenders behind the centre; the beasts on the flanks of those rows,
       left and right in turn. Long lines wrap into more (balanced) rows. If
       everything can't fit, the rows close up and then overlap; every token
       still ends on the board and in the bottom half. When snap is on, each
       token is snapped to the grid. Returns { id: { x, y } } as fractions. */
    formation: function (forces, board, grid, tokenScale) {
      var list = W.cleanForces(forces);
      var out = {};
      if (!list.length) return out;
      var cell = W.gridSize(grid) * clamp(num(tokenScale, 1), W.TOKEN_MIN, W.TOKEN_MAX);
      var gap = cell * 0.25;        /* between banners, and from the board's edges */
      var gapDisc = cell * 0.5;     /* between discs, so their name captions have room */
      var gapRow = cell * 0.45;     /* between rows, below the captions */
      var mid = board.h / 2;
      var usableW = Math.max(cell, board.w - 2 * gap);
      var byKind = { regiment: [], defenders: [], lieutenant: [], beast: [] };
      list.forEach(function (f) { byKind[f.kind].push(f); });

      /* Split a line into balanced rows that fit the width. */
      function rowsOf(items, itemW, maxW, g) {
        if (!items.length) return [];
        var perRow = Math.max(1, Math.floor((maxW + g) / (itemW + g)));
        var count = Math.ceil(items.length / perRow);
        var each = Math.ceil(items.length / count);
        var rows = [];
        for (var i = 0; i < items.length; i += each) rows.push(items.slice(i, i + each));
        return rows;
      }

      var rows = [];
      ['regiment', 'lieutenant', 'defenders'].forEach(function (kind) {
        var items = byKind[kind];
        if (!items.length) return;
        var d = W.tokenDims(kind, grid, tokenScale);
        var g = d.shape === 'circle' ? gapDisc : gap;
        rowsOf(items, d.w, usableW, g).forEach(function (r) {
          rows.push({ items: r, w: d.w, h: d.h, gap: g, centralW: r.length * d.w + (r.length - 1) * g, beasts: { left: [], right: [] } });
        });
      });

      /* Beasts on the flanks of each row, nearest the centre first, then
         rows of beasts at the back for any left over (or if they are alone). */
      var beasts = byKind.beast.slice();
      var b = W.tokenDims('beast', grid, tokenScale).w;
      rows.forEach(function (row) {
        if (!beasts.length) return;
        var side = (usableW - row.centralW) / 2;
        var cols = Math.max(0, Math.floor(side / (b + gapDisc)));
        var perCol = Math.max(1, Math.floor((row.h + gapRow) / (b + gapRow)));
        var cap = cols * perCol;
        if (!cap) return;
        var left = Math.min(cap, Math.ceil(beasts.length / 2));
        var right = Math.min(cap, beasts.length - left);
        if (left < cap && beasts.length - left - right > 0) left = Math.min(cap, beasts.length - right);
        row.perCol = perCol;
        /* Alternate sides, so beast 1 is on the left, beast 2 on the right… */
        var takeL = left;
        var takeR = right;
        while ((takeL || takeR) && beasts.length) {
          if (takeL) { row.beasts.left.push(beasts.shift()); takeL--; }
          if (takeR && beasts.length) { row.beasts.right.push(beasts.shift()); takeR--; }
        }
      });
      rowsOf(beasts, b, usableW, gapDisc).forEach(function (r) {
        rows.push({ items: r, w: b, h: b, gap: gapDisc, centralW: r.length * b + (r.length - 1) * gapDisc, beasts: { left: [], right: [] } });
      });

      /* Row tops from the midline down; close up, then overlap, if too tall. */
      var heights = rows.map(function (r) { return r.h; });
      var sumH = heights.reduce(function (a, h) { return a + h; }, 0);
      var avail = board.h - mid;
      var gapY = gapRow;
      if (sumH + gapY * (rows.length + 1) > avail) gapY = Math.max(0, (avail - sumH) / (rows.length + 1));
      var tops = [];
      var y = mid + gapY;
      rows.forEach(function (r) {
        tops.push(y);
        y += r.h + gapY;
      });
      var last = rows.length - 1;
      var lastBottom = tops[last] + rows[last].h;
      if (lastBottom > board.h + EPS && tops[last] > mid) {
        var k = Math.max(0, (board.h - mid - rows[last].h) / (tops[last] - mid));
        tops = tops.map(function (t) { return mid + (t - mid) * k; });
      }

      var centreX = board.w / 2;
      rows.forEach(function (row, i) {
        var cy = tops[i] + row.h / 2;
        var x0 = centreX - row.centralW / 2;
        row.items.forEach(function (f, j) {
          out[f.id] = { x: x0 + j * (row.w + row.gap) + row.w / 2, y: cy };
        });
        var perCol = row.perCol || 1;
        function flank(items, dir) {
          var edge = dir < 0 ? x0 : x0 + row.centralW;
          items.forEach(function (f, n) {
            var col = Math.floor(n / perCol);
            var inCol = n % perCol;
            var inThisCol = Math.min(perCol, items.length - col * perCol);
            out[f.id] = {
              x: edge + dir * (gapDisc + b / 2 + col * (b + gapDisc)),
              y: cy + (inCol - (inThisCol - 1) / 2) * (b + gapRow)
            };
          });
        }
        flank(row.beasts.left, -1);
        flank(row.beasts.right, 1);
      });

      var snap = !!(grid && grid.snap);
      var fractions = {};
      list.forEach(function (f) {
        var p = out[f.id];
        var d = W.tokenDims(f, grid, tokenScale);
        var c = W.settle(p.x, p.y, d.w, d.h, board, grid, snap);
        fractions[f.id] = { x: c.x / board.w, y: c.y / board.h };
      });
      return fractions;
    },

    /* Forces grouped for the roster: [{ kind, name, items }] in roster order, empty groups left out. */
    groups: function (forces) {
      var list = W.cleanForces(forces);
      return W.KINDS.map(function (kind) {
        return { kind: kind, name: W.KIND_NAMES[kind], items: list.filter(function (f) { return f.kind === kind; }) };
      }).filter(function (g) { return g.items.length; });
    }
  };
}());
