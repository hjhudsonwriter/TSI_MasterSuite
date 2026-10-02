/* The Ironbow Bastion Manager — the War Table's rules.
   The War Table is the battle screen the Bastion opens during a Military
   Action. The battle itself (every rule of play) lives in
   war-battle-rules.js (TSI.bastion.battleRules); these are only the War
   Table's own plain rules, with no page code, so they can be tested on
   their own (tests/rules/bastion-war-table.test.js):
   - the board: the battle grid in "board units" (1600 wide, one square
     = 1600 ÷ the squares across), so a square is the same spot of the map
     at any window size, zoom, in full screen and when the window moves
     between the laptop and the TV;
   - where the board sits on screen (view, toScreen, toWorld, the camera);
   - the saved settings (grid lines, Snap, token size, camera, the chosen
     battlefield width) and the saved map record;
   - the painted terrain store ('warTerrain', one painting per map and
     battlefield width) and a battle's own ground (battle.ground);
   - which order a square chosen before an order proposes;
   - the words the table shows: the objective and its progress, the attack
     preview line, losses, why a unit can't be set out on a square, what
     ending a battle early would do;
   - stepping a proposed move with the arrow keys. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var bas = TSI.bastion = TSI.bastion || {};

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function num(v, fallback) {
    var n = Number(v);
    return (v === null || v === '' || typeof v === 'boolean' || !Number.isFinite(n)) ? fallback : n;
  }
  function round2(v) { return Math.round(v * 100) / 100; }
  function war() { return (window.TSI_DATA && window.TSI_DATA.bastionWar) || null; }
  function scale() {
    var w = war();
    var s = (w && w.scale) || {};
    return { cols: num(s.cols, 22), minCols: num(s.minCols, 20), maxCols: num(s.maxCols, 24), minRows: num(s.minRows, 10), maxRows: num(s.maxRows, 30) };
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  /* " + 2" / " − 2" (a true minus sign, as the rest of the Bastion). */
  function spaced(n) { return n < 0 ? ' − ' + Math.abs(n) : ' + ' + n; }
  function signed(n) { return n < 0 ? '−' + Math.abs(n) : '+' + n; }

  var W = bas.warTableRules = {
    BOARD_W: 1600,
    MAX_UPLOAD_BYTES: 4 * 1024 * 1024,
    /* Tokens are drawn at this share of their square (display only). */
    TOKEN_MIN: 0.5,
    TOKEN_MAX: 1,
    TOKEN_STEP: 0.1,
    TOKEN_DEFAULT: 0.9,
    ZOOM_MIN: 0.5,
    ZOOM_MAX: 3,
    ZOOM_STEP: 0.25,
    /* How many maps' "no terrain yet" warnings are remembered as dismissed. */
    DISMISS_MAX: 50,
    /* A picture that loses more than this share of its height or width to
       the battlefield's shape gets a note (rounding the depth to whole
       squares alone never loses more than half a row: under 5%). */
    TRIM_WARN: 0.05,

    clamp: clamp,
    plural: plural,
    spaced: spaced,
    signed: signed,

    /* ---------- The board: the battle grid in board units ---------- */
    /* cols × rows squares, 1600 units across; one square is cell units. */
    boardFor: function (cols, rows) {
      var c = Math.max(1, Math.floor(num(cols, 22)));
      var r = Math.max(1, Math.floor(num(rows, 12)));
      var cell = W.BOARD_W / c;
      return { w: W.BOARD_W, h: cell * r, cols: c, rows: r, cell: cell };
    },
    /* The square under a board point, or null off the board. */
    cellAt: function (board, x, y) {
      if (!(x >= 0) || !(y >= 0)) return null;
      var c = Math.floor(x / board.cell);
      var r = Math.floor(y / board.cell);
      return c >= 0 && r >= 0 && c < board.cols && r < board.rows ? { c: c, r: r } : null;
    },
    /* The nearest square to a board point (always on the board). */
    nearestCell: function (board, x, y) {
      return {
        c: clamp(Math.floor(num(x, 0) / board.cell), 0, board.cols - 1),
        r: clamp(Math.floor(num(y, 0) / board.cell), 0, board.rows - 1)
      };
    },
    cellCentre: function (board, c, r) { return { x: (c + 0.5) * board.cell, y: (r + 0.5) * board.cell }; },
    /* A token's box in its square: drawn at tokenScale of the square, centred. */
    tokenBox: function (board, c, r, tokenScale) {
      var size = board.cell * clamp(num(tokenScale, W.TOKEN_DEFAULT), W.TOKEN_MIN, W.TOKEN_MAX);
      return { x: c * board.cell + (board.cell - size) / 2, y: r * board.cell + (board.cell - size) / 2, size: size };
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
      var s = f * zoom;
      var cx = board.w / 2 + num(camera && camera.x, 0);
      var cy = board.h / 2 + num(camera && camera.y, 0);
      return { fit: f, scale: s, ox: stageW / 2 - s * cx, oy: stageH / 2 - s * cy };
    },
    toScreen: function (v, x, y) { return { x: v.ox + v.scale * x, y: v.oy + v.scale * y }; },
    toWorld: function (v, sx, sy) { return { x: (sx - v.ox) / v.scale, y: (sy - v.oy) / v.scale }; },

    /* The pan is kept within what the zoom allows, so the map always fills
       the view it can: at 100% or less it's centred, and zooming back out
       after a pan brings it back. */
    clampCamera: function (camera, board) {
      var c = isObj(camera) ? camera : {};
      var zoom = clamp(num(c.zoom, 1), W.ZOOM_MIN, W.ZOOM_MAX);
      var k = zoom > 1 ? 1 - 1 / zoom : 0;
      return {
        x: clamp(num(c.x, 0), -board.w / 2 * k, board.w / 2 * k),
        y: clamp(num(c.y, 0), -board.h / 2 * k, board.h / 2 * k),
        zoom: zoom
      };
    },

    /* A new camera at a new zoom that keeps the board point under the
       pointer (sx, sy on the stage) where it is: Ctrl + wheel. */
    zoomAt: function (stageW, stageH, board, camera, zoom, sx, sy) {
      var before = W.view(stageW, stageH, board, camera);
      var p = W.toWorld(before, sx, sy);
      var z = clamp(num(zoom, 1), W.ZOOM_MIN, W.ZOOM_MAX);
      var s = before.fit * z;
      return W.clampCamera({
        x: p.x - board.w / 2 - (sx - stageW / 2) / s,
        y: p.y - board.h / 2 - (sy - stageH / 2) / s,
        zoom: z
      }, board);
    },

    /* ---------- Settings (saved as 'warTable') ----------
       grid.show and grid.snap are display preferences only; tokenScale is
       how big tokens are drawn inside their square; cols is the battlefield
       width chosen before deployment; terrainDismissed lists the maps whose
       "no terrain yet" warning was dismissed, trimDismissed those whose
       "edges hidden" note was. */
    defaultSettings: function () {
      return {
        grid: { show: true, snap: true },
        tokenScale: W.TOKEN_DEFAULT,
        camera: { x: 0, y: 0, zoom: 1 },
        cols: scale().cols,
        terrainDismissed: [],
        trimDismissed: []
      };
    },
    /* A plain object is accepted; normalizeSettings deals with the values. */
    isSettings: function (v) { return isObj(v); },
    /* A clean copy, with anything missing filled in and everything in range.
       Phase 1's grid size and offsets are let go (the grid is now the battle's). */
    normalizeSettings: function (v) {
      var d = W.defaultSettings();
      var s = isObj(v) ? v : {};
      var g = isObj(s.grid) ? s.grid : {};
      var c = isObj(s.camera) ? s.camera : {};
      var sc = scale();
      function keys(list) {
        var seen = {};
        return (Array.isArray(list) ? list : []).filter(function (k) {
          if (typeof k !== 'string' || !k || seen[k]) return false;
          seen[k] = true;
          return true;
        }).slice(-W.DISMISS_MAX);
      }
      return {
        grid: {
          show: typeof g.show === 'boolean' ? g.show : d.grid.show,
          snap: typeof g.snap === 'boolean' ? g.snap : d.grid.snap
        },
        tokenScale: round2(clamp(num(s.tokenScale, d.tokenScale), W.TOKEN_MIN, W.TOKEN_MAX)),
        camera: {
          x: num(c.x, 0),
          y: num(c.y, 0),
          zoom: round2(clamp(num(c.zoom, 1), W.ZOOM_MIN, W.ZOOM_MAX))
        },
        cols: Math.round(clamp(num(s.cols, sc.cols), sc.minCols, sc.maxCols)),
        terrainDismissed: keys(s.terrainDismissed),
        trimDismissed: keys(s.trimDismissed)
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

    /* How much of the map picture the board hides. The picture fills the
       battlefield's squares (cols × rows), trimmed evenly from two opposite
       edges when its shape differs: the depth follows the picture's shape
       only from minRows to maxRows squares, and from deployment on the
       squares are fixed. null when under TRIM_WARN is lost; otherwise
       { edges: 'tall' (the top and bottom are hidden) or 'wide' (the left
       and right), each: the percentage hidden at each of those edges }. */
    mapTrim: function (pic, grid) {
      if (!isObj(pic) || !isObj(grid)) return null;
      var pw = num(pic.w, 0), ph = num(pic.h, 0), c = num(grid.cols, 0), r = num(grid.rows, 0);
      if (!(pw > 0 && ph > 0 && c > 0 && r > 0)) return null;
      var p = pw / ph;
      var b = c / r;
      var cut = 1 - Math.min(p, b) / Math.max(p, b);
      if (!(cut > W.TRIM_WARN + 1e-9)) return null;
      return { edges: p < b ? 'tall' : 'wide', each: Math.max(1, Math.round(cut * 50)) };
    },
    /* The note for mapTrim's answer. setup: before deployment, while the
       battlefield's width can still change (and its depth follows the map). */
    mapTrimText: function (trim, grid, setup) {
      if (!trim || !grid) return '';
      var sc = scale();
      var tall = trim.edges === 'tall';
      var out = 'About ' + trim.each + '% of this picture is hidden at the ' + (tall ? 'top' : 'left') + ' and ' + trim.each + '% at the ' + (tall ? 'bottom' : 'right') + ': ';
      if (setup && tall && grid.rows >= sc.maxRows) out += 'the battlefield is never more than ' + sc.maxRows + ' squares deep (' + grid.cols + ' × ' + grid.rows + ' now).';
      else if (setup && !tall && grid.rows <= sc.minRows) out += 'the battlefield is never less than ' + sc.minRows + ' squares deep (' + grid.cols + ' × ' + grid.rows + ' now).';
      else out += 'it is ' + (tall ? 'taller' : 'wider') + ' than the battlefield\'s squares (' + grid.cols + ' × ' + grid.rows + (setup ? '' : ', fixed when deployment began') + ').';
      var g = function (a, b) { return b ? g(b, a % b) : a; };
      var k = g(grid.cols, grid.rows) || 1;
      out += ' To see all of it, crop the picture to ' + (grid.cols / k) + ' : ' + (grid.rows / k) + ' (width : height, the shape of ' + grid.cols + ' × ' + grid.rows + ' squares) and use Replace map.';
      if (setup && tall && grid.cols > sc.minCols) out += ' Fewer squares across shows a little more of it.';
      if (setup && !tall && grid.cols < sc.maxCols) out += ' More squares across shows a little more of it.';
      return out;
    },

    /* ---------- Painted terrain (saved as 'warTerrain') ----------
       { [mapKey]: { cols, rows, cells } }: one painting per map ('none' for
       the plain board); cells is a string of terrain codes, row by row. */
    codes: function () {
      var w = war();
      return w ? w.terrain.map(function (t) { return t.code; }) : ['.'];
    },
    isPainting: function (v) {
      return isObj(v) && typeof v.cells === 'string' &&
        Number.isInteger(v.cols) && Number.isInteger(v.rows) && v.cols >= 1 && v.rows >= 1 &&
        v.cols <= 200 && v.rows <= 200 && v.cells.length === v.cols * v.rows;
    },
    /* The saved store tidied: well-formed paintings kept (unknown codes
       become open ground), anything else let go. */
    cleanTerrainStore: function (v) {
      var out = {};
      if (!isObj(v)) return out;
      var known = {};
      W.codes().forEach(function (c) { known[c] = true; });
      Object.keys(v).forEach(function (k) {
        var p = v[k];
        if (!W.isPainting(p)) return;
        var cells = '';
        for (var i = 0; i < p.cells.length; i++) cells += known[p.cells.charAt(i)] ? p.cells.charAt(i) : '.';
        out[k] = { cols: p.cols, rows: p.rows, cells: cells };
      });
      return out;
    },
    blankPainting: function (cols, rows) {
      var n = Math.max(1, cols) * Math.max(1, rows);
      return { cols: cols, rows: rows, cells: new Array(n + 1).join('.') };
    },
    /* True when nothing but open ground is painted (or there's no painting). */
    allOpen: function (painting) {
      return !W.isPainting(painting) || !/[^.]/.test(painting.cells);
    },
    /* Paint these squares with code: a new painting and how many changed. */
    paint: function (painting, cells, code) {
      var p = painting;
      var chars = p.cells.split('');
      var changed = 0;
      (cells || []).forEach(function (cell) {
        if (!cell || cell.c < 0 || cell.r < 0 || cell.c >= p.cols || cell.r >= p.rows) return;
        var i = cell.r * p.cols + cell.c;
        if (chars[i] === code) return;
        chars[i] = code;
        changed += 1;
      });
      return { painting: { cols: p.cols, rows: p.rows, cells: chars.join('') }, changed: changed };
    },
    /* Every square on a straight line from a to b, both included (so a fast
       drag paints without gaps). */
    strokeCells: function (a, b) {
      var out = [];
      var x = a.c;
      var y = a.r;
      var dx = Math.abs(b.c - x);
      var dy = -Math.abs(b.r - y);
      var sx = x < b.c ? 1 : -1;
      var sy = y < b.r ? 1 : -1;
      var err = dx + dy;
      for (var guard = 0; guard < 1000; guard++) {
        out.push({ c: x, r: y });
        if (x === b.c && y === b.r) break;
        var e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
      return out;
    },
    /* One painting per map and battlefield width. store[mapKey] is the
       painting last made for that map; a painting made for one of the map's
       other widths is kept as store[mapKey + '@' + cols], so changing the
       width and painting there never overwrites (or thins out) the painting
       made at another width. */
    widthKey: function (mapKey, cols) { return mapKey + '@' + cols; },
    /* The painting for this map at this grid: its own if it has one
       ({ own: true }), otherwise the map's latest painting redrawn for this
       grid by battleRules.terrainForGrid ({ own: false, fromCols }), or open
       ground. Nothing is saved. */
    paintingFor: function (BR, store, mapKey, cols, rows) {
      var s = isObj(store) ? store : {};
      function fits(p) { return W.isPainting(p) && p.cols === cols && p.rows === rows; }
      var main = s[mapKey];
      if (fits(main)) return { painting: { cols: cols, rows: rows, cells: main.cells }, own: true, fromCols: null };
      var other = s[W.widthKey(mapKey, cols)];
      if (fits(other)) return { painting: { cols: cols, rows: rows, cells: other.cells }, own: true, fromCols: null };
      var base = W.isPainting(main) ? main : null;
      var p = BR.terrainForGrid(base, cols, rows);
      return { painting: { cols: p.cols, rows: p.rows, cells: p.cells }, own: false, fromCols: base && !W.allOpen(base) ? base.cols : null };
    },
    /* A new store with this painting saved as the map's latest. The map's
       previous latest painting, if it was for another grid, is kept under
       its own width. The store passed in is not changed. */
    storePainting: function (store, mapKey, painting) {
      var out = Object.assign({}, isObj(store) ? store : {});
      var old = out[mapKey];
      if (W.isPainting(old) && (old.cols !== painting.cols || old.rows !== painting.rows)) out[W.widthKey(mapKey, old.cols)] = old;
      delete out[W.widthKey(mapKey, painting.cols)];
      out[mapKey] = { cols: painting.cols, rows: painting.rows, cells: painting.cells };
      return out;
    },
    /* A new store without any of this map's paintings (Clear terrain). */
    forgetPaintings: function (store, mapKey) {
      var out = {};
      var prefix = mapKey + '@';
      Object.keys(isObj(store) ? store : {}).forEach(function (k) {
        if (k !== mapKey && k.indexOf(prefix) !== 0) out[k] = store[k];
      });
      return out;
    },
    /* The battle's own ground, kept on the battle record from Begin
       Deployment on: { mapKey, mapName, terrain: { cols, rows, cells } }.
       The battle's terrain lives here, so another battle's setup, or a map
       brought back mid-battle, can't change it. A tidy copy for this grid,
       or null if it isn't in the right form. */
    cleanGround: function (v, cols, rows) {
      if (!isObj(v) || typeof v.mapKey !== 'string' || !v.mapKey) return null;
      var t = v.terrain;
      if (!W.isPainting(t) || t.cols !== cols || t.rows !== rows) return null;
      var store = W.cleanTerrainStore({ t: t });
      return {
        mapKey: v.mapKey,
        mapName: typeof v.mapName === 'string' ? v.mapName : '',
        terrain: store.t
      };
    },
    /* The dismissed list with this map added (newest last, capped). */
    dismiss: function (list, key) {
      var out = (Array.isArray(list) ? list : []).filter(function (k) { return k !== key; });
      out.push(key);
      return out.slice(-W.DISMISS_MAX);
    },

    /* ---------- Moving a proposed square with the arrow keys ----------
       From square from, the first square in reach (keys 'c,r') in the
       direction [dc, dr], skipping squares that aren't; null if none. */
    arrowStep: function (reach, from, dir, cols, rows) {
      if (!reach || !from || !dir) return null;
      for (var k = 1; k <= Math.max(cols, rows); k++) {
        var c = from.c + dir[0] * k;
        var r = from.r + dir[1] * k;
        if (c < 0 || r < 0 || c >= cols || r >= rows) return null;
        if (reach[c + ',' + r]) return { c: c, r: r };
      }
      return null;
    },

    /* ---------- Dragging a selected unit before choosing an order ----------
       areas: { advance, march, disengage } (battleRules.reachable's maps, or
       null). The order a drop on this square proposes: Advance & Attack
       within the unit's Move, March beyond it, Disengage when it is in
       melee; null when no order reaches the square. */
    orderForCell: function (areas, cell) {
      if (!areas || !cell) return null;
      var k = cell.c + ',' + cell.r;
      var order = null;
      ['advance', 'march', 'disengage'].some(function (id) {
        if (areas[id] && areas[id][k]) { order = id; return true; }
        return false;
      });
      return order;
    },

    /* ---------- A drop on an enemy's square ----------
       Where unitId could attack targetId from by Advance & Attack this
       activation: 'here' from the square chosen (from, reached along path;
       its own square before a move is chosen), 'move' from another square
       in reach (reach: battleRules.reachable's map for Advance & Attack),
       or null. kind: 'melee' or 'ranged' (ranged preferred when a square
       in reach offers it). */
    attackRoute: function (BR, battle, unitId, targetId, reach, from, path, terrain) {
      var u = BR.unitById(battle, unitId);
      if (!u || !u.pos) return null;
      var at = from || u.pos;
      function kindFrom(cell, p) {
        var o = BR.attackOptions(battle, unitId, cell, p, terrain).filter(function (x) { return x.targetId === targetId; })[0];
        return o ? o.kind : null;
      }
      var k = kindFrom(at, path || [{ c: at.c, r: at.r }]);
      if (k) return { at: 'here', kind: k };
      var found = null;
      Object.keys(reach || {}).some(function (key) {
        var hit = reach[key];
        if (!hit || !Array.isArray(hit.path) || !hit.path.length) return false;
        var kk = kindFrom(hit.path[hit.path.length - 1], hit.path);
        if (kk) found = { at: 'move', kind: kk };
        return kk === 'ranged';
      });
      return found;
    },
    /* The words for a drop on an enemy's square. order: the order being
       given (null before one is chosen). */
    enemySquareText: function (route, unitLabel, targetLabel, order) {
      var t = targetLabel;
      if (order && order !== 'advance') {
        var name = order === 'march' ? 'March' : order === 'disengage' ? 'Disengage' : 'This order';
        return 'That square holds ' + t + ': ' + name + ' can\'t attack, and a move must end on an empty square.' +
          (route ? ' To attack it, choose Advance & Attack instead.' : ' ' + unitLabel + ' can\'t attack it this activation.');
      }
      var where = route && route.kind === 'ranged' ? 'within range of it' : 'next to it';
      if (order === 'advance') {
        var lead = 'That square holds ' + t + ', and a move must end on an empty square.';
        if (!route) return lead + ' ' + unitLabel + ' can\'t attack it this activation from any square it can reach.';
        if (route.at === 'here') return lead + ' Click ' + t + ' to attack it from the square chosen: it is ringed in red.';
        return lead + ' To attack it, click a lit square ' + where + ' first, then click ' + t + ': the targets in reach are ringed in red.';
      }
      if (!route) return t + ' is out of reach: ' + unitLabel + ' can\'t attack it this activation from any square it can reach. The lit squares show where it can go.';
      if (route.at === 'here') return 'To attack ' + t + ', choose Advance & Attack, then click ' + t + ': ' + unitLabel + ' can attack it from where it stands.';
      return 'To attack ' + t + ', click a lit square ' + where + ' (Advance & Attack), then click ' + t + ': the targets in reach are ringed in red.';
    },

    /* ---------- The battle log ----------
       How many of the log's entries came after the one last seen (entries
       are compared as objects, so this still works once the battle rules
       start dropping the oldest entries at their limit). */
    freshCount: function (log, seen) {
      var list = Array.isArray(log) ? log : [];
      if (!seen) return list.length;
      var i = list.lastIndexOf(seen);
      return i === -1 ? list.length : list.length - 1 - i;
    },

    /* ---------- Ending a battle early ----------
       What "End the battle" would do now, worked out on a copy (the battle
       passed in is not changed): { outcome, reason, couldChange }.
       couldChange: you still have units on the field and the result
       wouldn't be a victory, so playing on might change it. */
    endEarlyPreview: function (BR, battle) {
      if (!battle || battle.result || typeof BR.endBattleEarly !== 'function') return null;
      var copy = JSON.parse(JSON.stringify(battle));
      BR.endBattleEarly(copy);
      var res = copy.result;
      if (!res) return null;
      var yours = (battle.units || []).some(function (u) { return u.side === 'player' && BR.onField(u); });
      return { outcome: res.outcome, reason: res.reason || '', couldChange: yours && res.outcome !== 'victory' };
    },
    outcomeWord: function (outcome) {
      return { victory: 'a victory', defeat: 'a defeat', draw: 'a draw', withdrawal: 'a withdrawal' }[outcome] || 'over';
    },

    /* ---------- The d20 box ---------- */
    /* Blank → null (roll for me); a whole number 1 to 20 → it; anything else → NaN. */
    parseD20: function (text) {
      var s = String(text === undefined || text === null ? '' : text).trim();
      if (!s) return null;
      if (!/^\d{1,2}$/.test(s)) return NaN;
      var n = Number(s);
      return n >= 1 && n <= 20 ? n : NaN;
    },

    /* ---------- Words ---------- */
    roundText: function (battle) {
      return 'Round ' + battle.round + ' of ' + battle.maxRounds;
    },
    turnText: function (battle) {
      if (battle.result) return 'The battle is over';
      return battle.turnSide === 'player' ? 'Your turn' : 'The enemy\'s turn';
    },
    /* The objective, its deadline and how it's going, in one line. */
    objectiveText: function (battle, data) {
      var D = data || war();
      var o = battle.objective || { id: 'skirmish' };
      var def = (D && D.objectives[o.id]) || { name: 'Skirmish' };
      var last = 'by the end of round ' + battle.maxRounds;
      if (o.id === 'raid') {
        var need = num(def.need, 2);
        var markers = o.markers || [];
        var carried = markers.filter(function (m) { return m.state === 'carried'; }).length;
        return def.name + ': carry off ' + need + ' of ' + markers.length + ' supplies ' + last + ' · ' +
          (o.extracted || 0) + ' carried off' + (carried ? ', ' + carried + ' on the way' : '');
      }
      if (o.id === 'seize_outpost') {
        var needS = num(def.holdRounds, 2);
        return def.name + ': hold it at ' + needS + ' round ends in a row ' + last + ' · held ' +
          plural((o.held && o.held.player) || 0, 'round end') + ' (' + needS + ' needed)';
      }
      if (o.id === 'defend') {
        var needD = num(def.holdRounds, 2);
        var held = (o.held && o.held.enemy) || 0;
        return def.name + ': keep the enemy off your supply depot and your army unbroken ' + last + ', or break the enemy · ' +
          (held ? 'the enemy has held it ' + plural(held, 'round end') + ' (' + needD + ' in a row loses)' : 'the enemy hasn\'t held it');
      }
      return def.name + ': break the enemy army, or lose the smaller share of your strength ' + last;
    },
    /* The attack worked out before the dice, in one line:
       "d20 + 4 + 1 (Luck) vs 13: needs 8". pv is battleRules.previewAttack's. */
    previewLine: function (pv) {
      if (!pv) return '';
      var s = 'd20' + spaced(pv.attack);
      if (pv.capped) s += spaced(pv.modTotal) + ' (modifiers, capped)';
      else (pv.mods || []).forEach(function (m) { if (m.value) s += spaced(m.value) + ' (' + m.label + ')'; });
      var base = pv.defence - (pv.defenceMods || []).reduce(function (t, m) { return t + m.value; }, 0);
      s += ' vs ' + pv.defence;
      if (pv.defenceMods && pv.defenceMods.length) {
        s += ' (' + base + (pv.defenceMods.map(function (m) { return spaced(m.value) + ' ' + m.label; }).join('')) + ')';
      }
      return s + ': ' + W.needsText(pv.needs);
    },
    /* What the d20 has to show (a natural 1 always misses, a natural 20 always hits). */
    needsText: function (needs) {
      if (needs > 20) return 'only a natural 20 hits';
      if (needs <= 2) return 'needs 2 (only a natural 1 misses)';
      return 'needs ' + needs;
    },
    /* A Resolve check worked out before the dice (battleRules.resolveCheck's mods). */
    checkLine: function (mods, dc) {
      var s = 'd20';
      var total = 0;
      (mods || []).forEach(function (m, i) {
        total += m.value;
        if (m.value || i === 0) s += spaced(m.value) + ' (' + m.label + ')';
      });
      return s + ' vs DC ' + dc + ': ' + W.needsText(dc - total);
    },
    /* "Lost 7.5 of 39 Battle Value (19.2%)". loss is battleRules.armyLoss's. */
    lossText: function (loss) {
      return 'Lost ' + loss.lostBV + ' of ' + loss.startBV + ' Battle Value (' + loss.pct + '%)' + (loss.broken ? ': broken' : '');
    },
    statusWord: function (u) {
      if (!u) return '';
      if (u.withdrawn) return u.status === 'shaken' ? 'Shaken, withdrew' : 'Withdrew';
      if (u.status === 'routed') return 'Routed';
      if (u.status === 'defeated') return 'Defeated';
      if (u.status === 'shaken') return 'Shaken';
      return 'Steady';
    },
    /* Bastion Defenders supporting a regiment: "+10 defenders: +2 Cohesion". */
    supportText: function (support) {
      if (!support) return '';
      return '+' + support.count + ' defenders: ' + (support.bonus ? signed(support.bonus) + ' Cohesion' : 'no Cohesion bonus');
    },
    /* The enemy's colours: the clan's own where established, else the plain enemy colours. */
    clanStyle: function (data, clanKey) {
      var D = data || war();
      var c = D && D.clans && D.clans[clanKey];
      return (c && c.style) || (D && D.enemyStyle) || { fill: '#2b2f36', ink: '#e7e2d6' };
    },
    /* "Bacca" → "B"; "Clan Bacca" → "B". */
    clanInitial: function (name) {
      var words = String(name || '').trim().split(/\s+/).filter(function (w) { return w && !/^(the|clan)$/i.test(w); });
      return words.length ? words[0].charAt(0).toUpperCase() : '?';
    },
    /* Why a unit can't be set out on a square during deployment ('' if it can).
       BR is battleRules; opts.dm lets the DM move the enemy within its zone. */
    deployRefusal: function (BR, battle, unitId, cell, terrain, opts) {
      var u = BR.unitById(battle, unitId);
      if (!u) return 'There\'s no such unit.';
      if (!cell || !BR.inBoard(battle, cell)) return 'That\'s off the battlefield.';
      if (u.side !== 'player' && !(opts && opts.dm)) return 'The enemy\'s units can only be moved with DM: adjust enemy.';
      var zone = BR.zoneOf(battle, cell.r);
      if (zone === 'strip') return 'Nobody deploys in the no-deployment strip across the middle.';
      if (zone !== u.side) return u.side === 'player' ? 'That\'s the enemy\'s ground: set your units out below the strip.' : 'The enemy deploys on its own ground, above the strip.';
      var t = BR.terrainAt(BR.fitTerrain(battle, terrain), cell.c, cell.r);
      if (t.impassable) return t.name + ': nobody can be set out there.';
      var there = BR.unitAt(battle, cell);
      if (there && there.id !== u.id) return 'That square is taken by ' + there.label + '.';
      if (BR.fieldMarkerAt(battle, cell)) return 'Keep the supplies clear: nobody is set out on them.';
      return BR.canDeploy(battle, unitId, cell, terrain, opts) ? '' : 'It can\'t be set out there.';
    },
    /* A side's forces for the roster: [{ id, name, items }] in roster order
       (formations, detachments, leaders, beasts), empty groups left out. */
    rosterGroups: function (battle, side) {
      var units = (battle && battle.units) || [];
      var leaders = (battle && battle.leaders) || [];
      var mine = units.filter(function (u) { return u.side === side; });
      return [
        { id: 'formation', name: 'Formations', items: mine.filter(function (u) { return u.kind === 'formation'; }) },
        { id: 'detachment', name: 'Detachments', items: mine.filter(function (u) { return u.kind === 'detachment'; }) },
        { id: 'leader', name: side === 'player' ? 'Lieutenants' : 'Captains', items: leaders.filter(function (l) { return l.side === side; }) },
        { id: 'beast', name: 'Beasts', items: mine.filter(function (u) { return u.kind === 'beast'; }) }
      ].filter(function (g) { return g.items.length; });
    },
    /* What the scouts report before deployment: the enemy's units counted
       by type ([{ name, count, sample }]) and its Captains. */
    enemyIntel: function (battle) {
      var out = [];
      var byName = {};
      ((battle && battle.units) || []).forEach(function (u) {
        if (u.side !== 'enemy') return;
        var name = (u.variant && u.variant.name) || u.name;
        if (!byName[name]) {
          byName[name] = { name: name, count: 0, sample: u };
          out.push(byName[name]);
        }
        byName[name].count += 1;
      });
      var captains = ((battle && battle.leaders) || []).filter(function (l) { return l.side === 'enemy'; }).length;
      return { units: out, captains: captains };
    }
  };
}());
