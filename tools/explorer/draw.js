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
}());
