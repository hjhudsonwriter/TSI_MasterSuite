/* Clan Crest Creator — shape geometry (plain functions, tested in tests/rules.html).
   The shield outlines in data/shields.js are kept exactly as their sources
   drew them, each in its own units. These functions read an SVG outline,
   move and scale it into the crest's 1024 × 1024 picture, trace it as points,
   and work out where a sigil fits inside it: the largest box of the sigil's
   shape that sits inside the shield's rim, on its centre line. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var crest = TSI.crest = TSI.crest || {};

  var NUM = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
  var ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

  /* An SVG path's d="…" as a list of absolute commands: M, L, C, Q, A and Z
     (H, V, S and T are turned into L, C and Q). */
  function parse(d) {
    var out = [];
    var re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    var m, x = 0, y = 0, sx = 0, sy = 0, lastC = null, lastQ = null;
    while ((m = re.exec(String(d)))) {
      var cmd = m[1], up = cmd.toUpperCase(), rel = cmd !== up;
      var nums = (m[2].match(NUM) || []).map(Number);
      if (up === 'A') nums = arcArgs(m[2]);
      var n = ARGS[up];
      if (n === 0) {
        out.push({ c: 'Z' });
        x = sx; y = sy; lastC = lastQ = null;
        continue;
      }
      for (var i = 0; i + n <= nums.length; i += n) {
        var a = nums.slice(i, i + n);
        var ox = rel ? x : 0, oy = rel ? y : 0;
        var type = up;
        if (up === 'M' && i > 0) type = 'L';          /* extra pairs after M are lines */
        if (type === 'M') {
          x = a[0] + ox; y = a[1] + oy; sx = x; sy = y;
          out.push({ c: 'M', x: x, y: y }); lastC = lastQ = null;
        } else if (type === 'L') {
          x = a[0] + ox; y = a[1] + oy;
          out.push({ c: 'L', x: x, y: y }); lastC = lastQ = null;
        } else if (type === 'H') {
          x = a[0] + (rel ? x : 0);
          out.push({ c: 'L', x: x, y: y }); lastC = lastQ = null;
        } else if (type === 'V') {
          y = a[0] + (rel ? y : 0);
          out.push({ c: 'L', x: x, y: y }); lastC = lastQ = null;
        } else if (type === 'C' || type === 'S') {
          var x1, y1, k = 0;
          if (type === 'C') { x1 = a[0] + ox; y1 = a[1] + oy; k = 2; }
          else { x1 = lastC ? 2 * x - lastC[0] : x; y1 = lastC ? 2 * y - lastC[1] : y; }
          var x2 = a[k] + ox, y2 = a[k + 1] + oy, ex = a[k + 2] + ox, ey = a[k + 3] + oy;
          out.push({ c: 'C', x1: x1, y1: y1, x2: x2, y2: y2, x: ex, y: ey });
          lastC = [x2, y2]; lastQ = null; x = ex; y = ey;
        } else if (type === 'Q' || type === 'T') {
          var qx, qy, j = 0;
          if (type === 'Q') { qx = a[0] + ox; qy = a[1] + oy; j = 2; }
          else { qx = lastQ ? 2 * x - lastQ[0] : x; qy = lastQ ? 2 * y - lastQ[1] : y; }
          var qex = a[j] + ox, qey = a[j + 1] + oy;
          out.push({ c: 'Q', x1: qx, y1: qy, x: qex, y: qey });
          lastQ = [qx, qy]; lastC = null; x = qex; y = qey;
        } else if (type === 'A') {
          var ax = a[5] + ox, ay = a[6] + oy;
          out.push({ c: 'A', rx: Math.abs(a[0]), ry: Math.abs(a[1]), rot: a[2], large: a[3] ? 1 : 0, sweep: a[4] ? 1 : 0, x: ax, y: ay });
          lastC = lastQ = null; x = ax; y = ay;
        }
      }
    }
    return out;
  }

  /* Arc flags may be written without spaces ("0 0110,10"), so read them one digit at a time. */
  function arcArgs(s) {
    var out = [], str = String(s), pos = 0;
    while (pos < str.length) {
      var slot = out.length % 7;
      pos += str.slice(pos).match(/^[\s,]*/)[0].length;
      if (pos >= str.length) break;
      var m;
      if (slot === 3 || slot === 4) m = str.slice(pos).match(/^[01]/);
      else m = str.slice(pos).match(/^[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/);
      if (!m) break;
      out.push(Number(m[0]));
      pos += m[0].length;
    }
    return out;
  }

  function fmt(n) { return String(Math.round(n * 100) / 100); }

  function toPath(cmds) {
    return cmds.map(function (k) {
      switch (k.c) {
        case 'M': case 'L': return k.c + ' ' + fmt(k.x) + ',' + fmt(k.y);
        case 'C': return 'C ' + fmt(k.x1) + ',' + fmt(k.y1) + ' ' + fmt(k.x2) + ',' + fmt(k.y2) + ' ' + fmt(k.x) + ',' + fmt(k.y);
        case 'Q': return 'Q ' + fmt(k.x1) + ',' + fmt(k.y1) + ' ' + fmt(k.x) + ',' + fmt(k.y);
        case 'A': return 'A ' + fmt(k.rx) + ' ' + fmt(k.ry) + ' ' + fmt(k.rot) + ' ' + k.large + ' ' + k.sweep + ' ' + fmt(k.x) + ',' + fmt(k.y);
        default: return 'Z';
      }
    }).join(' ');
  }

  /* Scale (the same across and down) then move. */
  function transform(cmds, s, tx, ty) {
    return cmds.map(function (k) {
      var o = { c: k.c };
      if (k.c === 'Z') return o;
      o.x = k.x * s + tx; o.y = k.y * s + ty;
      if (k.c === 'C' || k.c === 'Q') { o.x1 = k.x1 * s + tx; o.y1 = k.y1 * s + ty; }
      if (k.c === 'C') { o.x2 = k.x2 * s + tx; o.y2 = k.y2 * s + ty; }
      if (k.c === 'A') { o.rx = k.rx * s; o.ry = k.ry * s; o.rot = k.rot; o.large = k.large; o.sweep = k.sweep; }
      return o;
    });
  }

  /* An arc's centre and angles, from its end points (SVG spec, appendix F.6.5). */
  function arcCentre(x1, y1, k) {
    var rx = k.rx, ry = k.ry, phi = k.rot * Math.PI / 180;
    var x2 = k.x, y2 = k.y;
    if (!rx || !ry) return null;
    var cos = Math.cos(phi), sin = Math.sin(phi);
    var dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    var xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
    var lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (lam > 1) { var r = Math.sqrt(lam); rx *= r; ry *= r; }
    var num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
    var den = rx * rx * yp * yp + ry * ry * xp * xp;
    var co = Math.sqrt(Math.max(0, num / den)) * (k.large === k.sweep ? -1 : 1);
    var cxp = co * rx * yp / ry, cyp = -co * ry * xp / rx;
    var cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
    var cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
    function ang(ux, uy, vx, vy) {
      var a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      return a;
    }
    var t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    var dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!k.sweep && dt > 0) dt -= 2 * Math.PI;
    if (k.sweep && dt < 0) dt += 2 * Math.PI;
    return { cx: cx, cy: cy, rx: rx, ry: ry, phi: phi, t1: t1, dt: dt };
  }

  /* The outline as points, about `step` apart: one list per closed part. */
  function sample(cmds, step) {
    step = step || 4;
    var parts = [], cur = null, x = 0, y = 0, sx = 0, sy = 0;
    function push(px, py) { cur.push([px, py]); }
    function n(len) { return Math.max(1, Math.ceil(len / step)); }
    cmds.forEach(function (k) {
      if (k.c === 'M') {
        cur = []; parts.push(cur);
        x = sx = k.x; y = sy = k.y; push(x, y); return;
      }
      if (!cur) { cur = []; parts.push(cur); push(x, y); }
      var i, t, count;
      if (k.c === 'L') {
        count = n(Math.hypot(k.x - x, k.y - y));
        for (i = 1; i <= count; i++) { t = i / count; push(x + (k.x - x) * t, y + (k.y - y) * t); }
      } else if (k.c === 'C') {
        var len = Math.hypot(k.x1 - x, k.y1 - y) + Math.hypot(k.x2 - k.x1, k.y2 - k.y1) + Math.hypot(k.x - k.x2, k.y - k.y2);
        count = n(len);
        for (i = 1; i <= count; i++) {
          t = i / count; var u = 1 - t;
          push(u * u * u * x + 3 * u * u * t * k.x1 + 3 * u * t * t * k.x2 + t * t * t * k.x,
               u * u * u * y + 3 * u * u * t * k.y1 + 3 * u * t * t * k.y2 + t * t * t * k.y);
        }
      } else if (k.c === 'Q') {
        count = n(Math.hypot(k.x1 - x, k.y1 - y) + Math.hypot(k.x - k.x1, k.y - k.y1));
        for (i = 1; i <= count; i++) {
          t = i / count; var v = 1 - t;
          push(v * v * x + 2 * v * t * k.x1 + t * t * k.x, v * v * y + 2 * v * t * k.y1 + t * t * k.y);
        }
      } else if (k.c === 'A') {
        var a = arcCentre(x, y, k);
        if (!a) { push(k.x, k.y); }
        else {
          count = n(Math.abs(a.dt) * Math.max(a.rx, a.ry));
          for (i = 1; i <= count; i++) {
            var th = a.t1 + a.dt * i / count;
            var ex = a.rx * Math.cos(th), ey = a.ry * Math.sin(th);
            push(Math.cos(a.phi) * ex - Math.sin(a.phi) * ey + a.cx, Math.sin(a.phi) * ex + Math.cos(a.phi) * ey + a.cy);
          }
        }
      } else if (k.c === 'Z') {
        if (Math.hypot(sx - x, sy - y) > 0.001) {
          count = n(Math.hypot(sx - x, sy - y));
          for (i = 1; i <= count; i++) { t = i / count; push(x + (sx - x) * t, y + (sy - y) * t); }
        }
        x = sx; y = sy; return;
      }
      x = k.x; y = k.y;
    });
    return parts.filter(function (p) { return p.length > 1; });
  }

  function bounds(parts) {
    var b = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
    parts.forEach(function (p) {
      p.forEach(function (q) {
        if (q[0] < b.x1) b.x1 = q[0];
        if (q[0] > b.x2) b.x2 = q[0];
        if (q[1] < b.y1) b.y1 = q[1];
        if (q[1] > b.y2) b.y2 = q[1];
      });
    });
    b.w = b.x2 - b.x1; b.h = b.y2 - b.y1;
    return b;
  }

  /* Where a level line at height y crosses the outline, left to right. */
  function crossings(parts, y) {
    var xs = [];
    parts.forEach(function (p) {
      for (var i = 0; i < p.length; i++) {
        var a = p[i], b = p[(i + 1) % p.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
    });
    return xs.sort(function (m, n) { return m - n; });
  }

  /* The outline's balance point (the centre of its area): heraldry's fess
     point sits about here, a little above the middle on a pointed shield. */
  function centroid(parts) {
    var a = 0, cx = 0, cy = 0;
    parts.forEach(function (p) {
      for (var i = 0; i < p.length; i++) {
        var q = p[i], r = p[(i + 1) % p.length], k = q[0] * r[1] - r[0] * q[1];
        a += k; cx += (q[0] + r[0]) * k; cy += (q[1] + r[1]) * k;
      }
    });
    if (!a) { var b = bounds(parts); return [b.x1 + b.w / 2, b.y1 + b.h / 2]; }
    return [cx / (3 * a), cy / (3 * a)];
  }

  function inside(parts, x, y) {
    var xs = crossings(parts, y), c = 0;
    xs.forEach(function (v) { if (v < x) c++; });
    return c % 2 === 1;
  }

  /* The room either side of the centre line, row by row: at each height, how
     far you can go left and right from cx before meeting the outline. */
  function rows(parts, cx, step) {
    var b = bounds(parts), out = [];
    step = step || 2;
    for (var y = Math.ceil(b.y1); y <= b.y2; y += step) {
      var xs = crossings(parts, y), left = null, right = null;
      for (var i = 0; i + 1 < xs.length; i += 2) {
        if (xs[i] <= cx && xs[i + 1] >= cx) { left = xs[i]; right = xs[i + 1]; }
      }
      out.push({ y: y, room: left === null ? 0 : Math.min(cx - left, right - cx) });
    }
    return out;
  }

  /* The largest box with the sigil's shape (aspect = width ÷ height), centred
     on cx, that keeps `margin` clear of the outline all round. `near` keeps
     its centre within [lowest, highest] height, so a wide sigil stays in the
     middle of a tapering shield rather than riding up to the top. Returns its
     centre and size. */
  function fitBox(parts, cx, aspect, margin, step, near) {
    step = step || 2;
    margin = margin || 0;
    var r = rows(parts, cx, step);
    var best = { cx: cx, cy: 0, w: 0, h: 0 };
    for (var i = 0; i < r.length; i++) {
      if (near && (r[i].y < near[0] || r[i].y > near[1])) continue;
      /* grow a box centred on row i until a row inside it lacks the room */
      var lo = 0, hi = r.length;
      while (lo < hi) {
        var k = Math.ceil((lo + hi) / 2);             /* half-height in rows */
        var half = k * step, need = half * aspect + margin, ok = true;
        var pad = Math.ceil(margin / step);
        if (i - k - pad < 0 || i + k + pad >= r.length) ok = false;
        for (var j = i - k - pad; ok && j <= i + k + pad; j++) if (r[j].room < need) ok = false;
        if (ok) lo = k; else hi = k - 1;
      }
      var h = lo * step * 2;
      if (h > best.h) best = { cx: cx, cy: r[i].y, w: h * aspect, h: h };
    }
    return best;
  }

  /* Points spaced `gap` apart along a line `inset` inside the outline (for
     studs and rope on the rim), each with the line's direction there. Points
     that come closer than the inset to any part of the outline, where it
     turns sharply, are left out. */
  function insetPoints(parts, inset, gap) {
    var out = [];
    insetLines(parts, inset).forEach(function (kept) {
      var acc = gap, last = null;
      kept.forEach(function (q, i) {
        if (last) acc += Math.hypot(q[0] - last[0], q[1] - last[1]);
        if (acc >= gap) {
          var a = kept[Math.max(0, i - 1)], b = kept[Math.min(kept.length - 1, i + 1)];
          var l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          out.push([q[0], q[1], (b[0] - a[0]) / l, (b[1] - a[1]) / l]);
          acc = 0;
        }
        last = q;
      });
    });
    return out;
  }

  /* The line `inset` inside the outline, as points. */
  function insetLines(parts, inset) {
    var out = [];
    parts.forEach(function (p) {
      var area = 0;
      for (var i = 0; i < p.length; i++) {
        var a = p[i], b = p[(i + 1) % p.length];
        area += a[0] * b[1] - b[0] * a[1];
      }
      var dir = area > 0 ? 1 : -1;       /* which side is inside */
      var line = [];
      for (var j = 0; j < p.length; j++) {
        var prev = p[(j - 1 + p.length) % p.length], next = p[(j + 1) % p.length];
        var tx = next[0] - prev[0], ty = next[1] - prev[1], l = Math.hypot(tx, ty) || 1;
        var nx = -ty / l * dir, ny = tx / l * dir;
        line.push([p[j][0] + nx * inset, p[j][1] + ny * inset]);
      }
      out.push(line.filter(function (q) {
        return inside(parts, q[0], q[1]) && distance(parts, q[0], q[1]) >= inset * 0.96;
      }));
    });
    return out;
  }

  function distance(parts, x, y) {
    var best = Infinity;
    parts.forEach(function (p) {
      for (var i = 0; i < p.length; i++) {
        var a = p[i], b = p[(i + 1) % p.length];
        var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
        var t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
        var d = Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
        if (d < best) best = d;
      }
    });
    return best;
  }

  crest.geo = {
    parse: parse,
    toPath: toPath,
    transform: transform,
    sample: sample,
    bounds: bounds,
    centroid: centroid,
    crossings: crossings,
    inside: inside,
    rows: rows,
    fitBox: fitBox,
    insetPoints: insetPoints,
    insetLines: insetLines,
    distance: distance
  };
}());
