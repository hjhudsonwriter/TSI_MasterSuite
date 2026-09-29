/* Clan Crest Creator — the sigil drawing kit (plain functions).
   data/sigils.js draws each sigil with these: smooth outlines through a list
   of points, tapering strokes (horns, claws, feathers, rays, antlers), circles
   and ellipses. Each returns SVG path text, worked out once when the page
   loads, so the sigils stay as readable lists of points rather than long
   strings of numbers. All sigils are drawn in a 1000 × 1000 box. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var crest = TSI.crest = TSI.crest || {};

  function f(n) { return String(Math.round(n * 10) / 10); }
  function pt(p) { return f(p[0]) + ',' + f(p[1]); }
  function corner(p) { return p[2] === 1 || p[2] === 'c'; }

  /* The control points of the curve between b and c, given the points either side. */
  function handles(a, b, c, d, k) {
    k = k === undefined ? 1 : k;
    return [
      [b[0] + (c[0] - a[0]) / 6 * k, b[1] + (c[1] - a[1]) / 6 * k],
      [c[0] - (d[0] - b[0]) / 6 * k, c[1] - (d[1] - b[1]) / 6 * k]
    ];
  }

  /* A closed smooth shape through the points. A point written [x, y, 1] is a
     sharp corner (a tip or a notch); the rest are smooth. */
  function shape(points, k) {
    var n = points.length, s = 'M ' + pt(points[0]);
    for (var i = 0; i < n; i++) {
      var b = points[i], c = points[(i + 1) % n];
      var a = corner(b) ? b : points[(i - 1 + n) % n];
      var d = corner(c) ? c : points[(i + 2) % n];
      var h = handles(a, b, c, d, k);
      s += ' C ' + pt(h[0]) + ' ' + pt(h[1]) + ' ' + pt(c);
    }
    return s + ' Z';
  }

  /* An open smooth line through the points (for strokes and inner lines). */
  function line(points, k) {
    var n = points.length, s = 'M ' + pt(points[0]);
    for (var i = 0; i < n - 1; i++) {
      var b = points[i], c = points[i + 1];
      var a = (i === 0 || corner(b)) ? b : points[i - 1];
      var d = (i + 2 >= n || corner(c)) ? c : points[i + 2];
      var h = handles(a, b, c, d, k);
      s += ' C ' + pt(h[0]) + ' ' + pt(h[1]) + ' ' + pt(c);
    }
    return s;
  }

  /* Points along the smooth line, `per` to each stretch between points. */
  function trace(points, per) {
    var out = [], n = points.length;
    per = per || 16;
    for (var i = 0; i < n - 1; i++) {
      var b = points[i], c = points[i + 1];
      var a = (i === 0 || corner(b)) ? b : points[i - 1];
      var d = (i + 2 >= n || corner(c)) ? c : points[i + 2];
      var h = handles(a, b, c, d);
      for (var j = (i === 0 ? 0 : 1); j <= per; j++) {
        var t = j / per, u = 1 - t;
        out.push([
          u * u * u * b[0] + 3 * u * u * t * h[0][0] + 3 * u * t * t * h[1][0] + t * t * t * c[0],
          u * u * u * b[1] + 3 * u * u * t * h[0][1] + 3 * u * t * t * h[1][1] + t * t * t * c[1]
        ]);
      }
    }
    return out;
  }

  /* A stroke that changes width along a smooth centre line: horns, claws,
     feathers, tentacles, antler tines. `widths` gives the full width at each
     point of the line (0 makes a point). Ends are square unless `round`. */
  function taper(points, widths, round) {
    var line = trace(points, 18), n = line.length;
    var lens = [0];
    for (var i = 1; i < n; i++) lens.push(lens[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    var total = lens[n - 1] || 1;
    /* the width at each traced point, from the widths at the given points */
    var ctrl = [0];
    for (var c = 1; c < points.length; c++) ctrl.push(c / (points.length - 1));
    if (widths.length !== points.length) {
      var w0 = widths[0], w1 = widths[widths.length - 1];
      widths = points.map(function (p, k) { return w0 + (w1 - w0) * k / (points.length - 1); });
    }
    function widthAt(fr) {
      for (var k = 1; k < ctrl.length; k++) {
        if (fr <= ctrl[k]) {
          var t = (fr - ctrl[k - 1]) / (ctrl[k] - ctrl[k - 1]);
          var e = (1 - Math.cos(Math.PI * t)) / 2;      /* ease between the given widths */
          return widths[k - 1] + (widths[k] - widths[k - 1]) * e;
        }
      }
      return widths[widths.length - 1];
    }
    var left = [], right = [];
    for (var m = 0; m < n; m++) {
      var p0 = line[Math.max(0, m - 1)], p1 = line[Math.min(n - 1, m + 1)];
      var tx = p1[0] - p0[0], ty = p1[1] - p0[1], l = Math.hypot(tx, ty) || 1;
      var nx = -ty / l, ny = tx / l, w = widthAt(lens[m] / total) / 2;
      left.push([line[m][0] + nx * w, line[m][1] + ny * w]);
      right.push([line[m][0] - nx * w, line[m][1] - ny * w]);
    }
    var s = 'M ' + pt(left[0]);
    for (var q = 1; q < n; q++) s += ' L ' + pt(left[q]);
    var we = widthAt(1) / 2, ws = widthAt(0) / 2;
    if (round && we > 0) s += ' A ' + f(we) + ' ' + f(we) + ' 0 0 1 ' + pt(right[n - 1]);
    else s += ' L ' + pt(right[n - 1]);
    for (var r = n - 2; r >= 0; r--) s += ' L ' + pt(right[r]);
    if (round && ws > 0) s += ' A ' + f(ws) + ' ' + f(ws) + ' 0 0 1 ' + pt(left[0]);
    return s + ' Z';
  }

  function circle(cx, cy, r) {
    return 'M ' + f(cx - r) + ',' + f(cy) + ' A ' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(cx + r) + ',' + f(cy) +
      ' A ' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(cx - r) + ',' + f(cy) + ' Z';
  }

  function ellipse(cx, cy, rx, ry, deg) {
    var a = (deg || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var p1 = [cx - rx * c, cy - rx * s], p2 = [cx + rx * c, cy + rx * s];
    return 'M ' + pt(p1) + ' A ' + f(rx) + ' ' + f(ry) + ' ' + f(deg || 0) + ' 1 0 ' + pt(p2) +
      ' A ' + f(rx) + ' ' + f(ry) + ' ' + f(deg || 0) + ' 1 0 ' + pt(p1) + ' Z';
  }

  /* A straight-sided shape through the points. */
  function poly(points) {
    return 'M ' + points.map(pt).join(' L ') + ' Z';
  }

  function rect(x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    if (!r) return poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
    return 'M ' + f(x + r) + ',' + f(y) + ' H ' + f(x + w - r) + ' A ' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(x + w) + ',' + f(y + r) +
      ' V ' + f(y + h - r) + ' A ' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(x + w - r) + ',' + f(y + h) +
      ' H ' + f(x + r) + ' A ' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(x) + ',' + f(y + h - r) +
      ' V ' + f(y + r) + ' A ' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(x + r) + ',' + f(y) + ' Z';
  }

  /* The same points turned about a centre, or mirrored across x = 500. */
  function turn(points, deg, cx, cy) {
    var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    cx = cx === undefined ? 500 : cx; cy = cy === undefined ? 500 : cy;
    return points.map(function (p) {
      var x = p[0] - cx, y = p[1] - cy;
      var o = [cx + x * c - y * s, cy + x * s + y * c];
      if (p.length > 2) o.push(p[2]);
      return o;
    });
  }
  function flip(points) {
    return points.map(function (p) { var o = [1000 - p[0], p[1]]; if (p.length > 2) o.push(p[2]); return o; });
  }

  crest.kit = {
    shape: shape,
    line: line,
    trace: trace,
    taper: taper,
    circle: circle,
    ellipse: ellipse,
    poly: poly,
    rect: rect,
    turn: turn,
    flip: flip
  };
}());
