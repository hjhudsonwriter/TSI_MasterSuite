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
    R.hexesWithin(reach.q, reach.r, reach.n).forEach(function (hex) {
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
      if (label && (target.inReach || target.miles > 0)) {
        var text = target.inReach ? target.miles + ' mi' : 'too far';
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
