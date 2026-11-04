/* The Scarlett Isles Explorer: the two canvas drawings (the hex grid and the fog of war) as plain functions.
   The DM's map (tool.js) and the Player View (player-view.js) both call these, so the players' map is drawn by the
   very same code as the DM's. They only draw plain lines and fills, never a picture.
   c is a 2D canvas context already scaled to CSS pixels; w and h are the canvas's size in CSS pixels; view is R.view(...). */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ns = TSI.explorer = TSI.explorer || {};
  var R = ns.rules;
  var D = ns.draw = {};

  D.hexPath = function (c, cx, cy, r) {
    c.beginPath();
    for (var i = 0; i < 6; i++) {
      var angle = (Math.PI / 180) * (60 * i - 30);
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  };

  /* The hex grid, at the opacity the DM set. grid is the saved grid ({ enabled, r, offsetX, offsetY, opacity }). */
  D.grid = function (c, w, h, view, grid) {
    if (!grid.enabled) return;
    var r = R.hexSize(grid) * view.fit;
    c.globalAlpha = R.gridOpacity(grid);
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(231,231,234,0.9)';
    var tl = R.toBoard(view, 0, 0);
    var br = R.toBoard(view, w, h);
    var range = R.hexRange(grid, tl.x, tl.y, br.x, br.y);
    for (var rr = range.rMin; rr <= range.rMax; rr++) {
      for (var qq = range.qMin; qq <= range.qMax; qq++) {
        var b = R.axialToPixel(grid, qq, rr);
        var p = R.toScreen(view, b.x, b.y);
        if (p.x < -2 * r || p.x > w + 2 * r || p.y < -2 * r || p.y > h + 2 * r) continue;
        D.hexPath(c, p.x, p.y, r);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
  };

  /* Where the picked party can reach today (rules.js R.reachFor): the hexes within reach tinted, the hex under the pointer picked
     out. reach is { q, r, n }; target is { hex: {q, r}, inReach, miles } or null; label: true draws the miles on the target (the DM's
     own map only: the Player View passes false); board is { w, h } so hexes off the map picture are left out. Plain fills and lines only. */
  D.reach = function (c, w, h, view, grid, reach, target, label, board) {
    if (!reach) return;
    var r = R.hexSize(grid) * view.fit;
    function at(hex) { var b = R.axialToPixel(grid, hex.q, hex.r); return R.toScreen(view, b.x, b.y); }
    (reach.cells || R.hexesWithin(reach.q, reach.r, reach.n)).forEach(function (hex) {
      /* Only hexes on the map picture: none out in the dark beyond its edge. */
      var b = R.axialToPixel(grid, hex.q, hex.r);
      if (board && (b.x < 0 || b.x > board.w || b.y < 0 || b.y > board.h)) return;
      var p = at(hex);
      if (p.x < -2 * r || p.x > w + 2 * r || p.y < -2 * r || p.y > h + 2 * r) return;
      D.hexPath(c, p.x, p.y, r * 0.96);
      c.fillStyle = 'rgba(120, 214, 160, 0.17)';
      c.fill();
      c.lineWidth = 1.2;
      c.strokeStyle = 'rgba(150, 232, 180, 0.55)';
      c.stroke();
    });
    if (target && target.hex) {
      var p = at(target.hex);
      D.hexPath(c, p.x, p.y, r * 0.96);
      if (target.inReach) {
        c.fillStyle = 'rgba(214, 178, 94, 0.32)';
        c.fill();
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(240, 214, 130, 0.95)';
        c.stroke();
      } else if (label) {
        c.lineWidth = 2;
        c.strokeStyle = 'rgba(232, 110, 100, 0.85)';
        c.stroke();
      }
      if (label && (target.inReach || target.miles > 0 || target.blocked)) {
        var text = target.inReach ? target.miles + ' mi' : target.blocked ? 'blocked' : 'too far';
        c.font = '600 ' + Math.max(11, Math.round(r * 0.5)) + 'px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineWidth = 4;
        c.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        c.strokeText(text, p.x, p.y);
        c.fillStyle = target.inReach ? '#f3e2a8' : '#f2b3a6';
        c.fillText(text, p.x, p.y);
      }
    }
  };

  /* The terrain painted on the hexes (data/hex-terrain-data.js): a tint on each painted hex. cells are [q, r, kind id]; board is
     { w, h } so hexes off the map picture are left out. Plain fills and lines only. */
  D.terrain = function (c, w, h, view, grid, cells, board) {
    if (!cells || !cells.length) return;
    var r = R.hexSize(grid) * view.fit;
    var colour = {};
    R.terrainKinds().forEach(function (k) { colour[k.id] = k.colour; });
    cells.forEach(function (cell) {
      var col = colour[cell[2]];
      if (!col) return;
      var b = R.axialToPixel(grid, cell[0], cell[1]);
      if (board && (b.x < 0 || b.x > board.w || b.y < 0 || b.y > board.h)) return;
      var p = R.toScreen(view, b.x, b.y);
      if (p.x < -2 * r || p.x > w + 2 * r || p.y < -2 * r || p.y > h + 2 * r) return;
      D.hexPath(c, p.x, p.y, r * 0.96);
      c.globalAlpha = 0.4;
      c.fillStyle = col;
      c.fill();
      c.globalAlpha = 0.85;
      c.lineWidth = 1.5;
      c.strokeStyle = col;
      c.stroke();
    });
    c.globalAlpha = 1;
  };

  /* Fog: the whole area dark, with the uncovered hexes cut out. store is { "q,r": true } for the uncovered hexes. */
  D.fog = function (c, w, h, view, grid, store) {
    var r = R.hexSize(grid) * view.fit;
    c.globalAlpha = 0.86;
    c.fillStyle = 'rgba(0,0,0,1)';
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'destination-out';
    Object.keys(store).forEach(function (key) {
      var parts = key.split(',');
      var q = Number(parts[0]), rr = Number(parts[1]);
      if (!Number.isFinite(q) || !Number.isFinite(rr)) return;
      var b = R.axialToPixel(grid, q, rr);
      var p = R.toScreen(view, b.x, b.y);
      if (p.x < -2 * r || p.x > w + 2 * r || p.y < -2 * r || p.y > h + 2 * r) return;
      D.hexPath(c, p.x, p.y, r * 0.98);
      c.fill();
    });
    c.globalCompositeOperation = 'source-over';
  };

  /* ---------- Colour reveal (guide 6B, 4 November 2026) ----------
     The explored hexes as two soft masks, as small pictures (data URLs) in board proportions, so the map's own layer can use them
     whatever the zoom: `colour` is opaque where the party has been (the colour shows through there) and `wash` is the opposite
     (the DM's light grey wash over what is unexplored). Only plain white shapes are drawn, never a map picture, so nothing is ever
     read from a picture. The edge is feathered by about half a hex. hexes is the flat list [q0, r0, q1, r1, ...]. Built only when
     the explored set, the grid or the map changes, never while dragging. */
  D.exploredMasks = function (board, grid, hexes) {
    var size = R.hexSize(grid);
    var scale = Math.min(1, 900 / Math.max(1, board.w));
    var w = Math.max(1, Math.ceil(board.w * scale)), h = Math.max(1, Math.ceil(board.h * scale));
    var a = document.createElement('canvas');
    a.width = w; a.height = h;
    var c = a.getContext('2d');
    c.scale(scale, scale);
    /* Draw the hexes a little over size, then soften the whole edge. (A browser with no canvas filter keeps hard edges.) */
    try { c.filter = 'blur(' + Math.max(0.5, size * 0.42 * scale).toFixed(2) + 'px)'; } catch (e) { /* hard edges */ }
    c.fillStyle = '#fff';
    for (var i = 0; i + 1 < hexes.length; i += 2) {
      var p = R.axialToPixel(grid, hexes[i], hexes[i + 1]);
      if (p.x < -2 * size || p.y < -2 * size || p.x > board.w + 2 * size || p.y > board.h + 2 * size) continue;
      D.hexPath(c, p.x, p.y, size * 1.04);
      c.fill();
    }
    var b = document.createElement('canvas');
    b.width = w; b.height = h;
    var d = b.getContext('2d');
    d.fillStyle = '#fff';
    d.fillRect(0, 0, w, h);
    d.globalCompositeOperation = 'destination-out';
    d.drawImage(a, 0, 0);
    return { colour: a.toDataURL('image/png'), wash: b.toDataURL('image/png') };
  };

  /* A soft, seamless tile of cloud shadows (a data URL), drawn in code from a fixed pattern: no art file. */
  D.cloudTile = function (size) {
    size = size || 320;
    var cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    var c = cv.getContext('2d');
    var seed = 20261104;
    function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
    for (var i = 0; i < 16; i++) {
      var x = rnd() * size, y = rnd() * size, r = size * (0.12 + rnd() * 0.2), a = 0.35 + rnd() * 0.5;
      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          var cx = x + ox * size, cy = y + oy * size;
          if (cx + r < 0 || cy + r < 0 || cx - r > size || cy - r > size) continue;
          var g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, 'rgba(8,10,18,' + a.toFixed(2) + ')');
          g.addColorStop(1, 'rgba(8,10,18,0)');
          c.fillStyle = g;
          c.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
    }
    return cv.toDataURL('image/png');
  };
}());
