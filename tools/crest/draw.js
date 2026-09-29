/* Clan Crest Creator — drawing.
   Builds the crest as an SVG picture (as text) from the current choices, in a
   1024 × 1024 box with nothing behind it, so the PNG has a see-through
   background. From the back:
     the field (its colours and division) → the band (ordinary) → texture →
     the sigil → light and shade → the rim → the motto ribbon.
   Every hidden part name starts "tsi-crest-svg-" and ends with a number
   unique to that picture, so previews, thumbnails and the tool's controls
   can never borrow each other's parts (KNOWN_ISSUES CRS-01, CRS-02).
   Plain functions with no screen code, so tests can check them. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var crest = TSI.crest = TSI.crest || {};
  var G = crest.geo;
  var R = crest.rules;

  var MOTTO_FONT = 'Cinzel';
  var SIGIL_LINE = 12;      /* sigil outline, in the sigil's 1000-unit box */
  var counter = 0;

  function shieldList() { return window.TSI_DATA.crestShields; }
  function sigilList() { return window.TSI_DATA.crestSigils; }
  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }
  function n(v) { return String(Math.round(v * 10) / 10); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  /* Control characters can't go in a picture's text (a pasted one used to stop
     the download: KNOWN_ISSUES CRS-10), so they're left out. */
  function cleanText(s) {
    return String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  }
  function colour(hex, fallback) { return R.cleanHex(hex) || fallback || '#000000'; }

  /* ---------- Where the shield sits ---------- */
  /* With a motto ribbon the shield sits higher and a little smaller. */
  function shieldBox(withBanner) {
    return withBanner ? { x: 172, y: 36, w: 680, h: 770 } : { x: 142, y: 48, w: 740, h: 900 };
  }

  var outlineCache = {};
  /* The shield's outline scaled into the box: its path, traced points, bounds
     and fess point (the centre of the largest square inside it). */
  function outline(shapeId, box) {
    var key = shapeId + '|' + box.x + ',' + box.y + ',' + box.w + ',' + box.h;
    if (outlineCache[key]) return outlineCache[key];
    var sh = find(shieldList(), shapeId);
    var cmds = G.parse(sh.d);
    var xs = [], ys = [];
    cmds.forEach(function (k) { if (k.c !== 'Z') { xs.push(k.x); ys.push(k.y); } });
    var span = Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys)) || 1;
    var b = G.bounds(G.sample(cmds, span / 500));
    var s = Math.min(box.w / b.w, box.h / b.h);
    var tx = box.x + box.w / 2 - (b.x1 + b.w / 2) * s;
    var ty = box.y + (box.h - b.h * s) / 2 - b.y1 * s;
    var t = G.transform(cmds, s, tx, ty);
    var parts = G.sample(t, 3);
    var bb = G.bounds(parts);
    var o = { id: sh.id, d: G.toPath(t), parts: parts, bb: bb, fx: 512, fy: G.centroid(parts)[1], fit: {} };
    outlineCache[key] = o;
    return o;
  }

  /* ---------- The sigil's own size ---------- */
  var sigilBoxCache = {};
  function transformPoint(p, at) {
    /* the layer transforms used in data/sigils.js: translate(x y) and rotate(a cx cy) */
    var out = [p[0], p[1]];
    var ops = [], re = /(translate|rotate)\(([^)]*)\)/g, m;
    while ((m = re.exec(at))) ops.push([m[1], m[2].split(/[\s,]+/).map(Number)]);
    for (var i = ops.length - 1; i >= 0; i--) {
      var a = ops[i][1];
      if (ops[i][0] === 'translate') { out = [out[0] + (a[0] || 0), out[1] + (a[1] || 0)]; }
      else {
        var r = a[0] * Math.PI / 180, cx = a[1] || 0, cy = a[2] || 0, x = out[0] - cx, y = out[1] - cy;
        out = [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)];
      }
    }
    return out;
  }
  function sigilBox(sig) {
    if (sigilBoxCache[sig.id]) return sigilBoxCache[sig.id];
    var pts = [];
    sig.layers.forEach(function (ly) {
      var ds = (ly.body || []).concat(ly.armed || []).concat((ly.strokes || []).map(function (x) { return x[0]; }));
      ds.forEach(function (d) {
        G.sample(G.parse(d), 8).forEach(function (part) {
          part.forEach(function (p) {
            var q = ly.at ? transformPoint(p, ly.at) : p;
            pts.push(q);
            if (ly.mirror) pts.push(ly.at ? transformPoint([1000 - p[0], p[1]], ly.at) : [1000 - q[0], q[1]]);
          });
        });
      });
    });
    var b = G.bounds([pts]);
    var pad = SIGIL_LINE;
    var box = { x1: b.x1 - pad, y1: b.y1 - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    sigilBoxCache[sig.id] = box;
    return box;
  }

  /* Where the sigil goes on this shield: the largest box of its shape inside
     the rim, then the size and nudge the sliders ask for. */
  function sigilPlace(o, sig, st) {
    var box = sigilBox(sig);
    var rimW = st.rim === 'none' ? 0 : Number(st.rimWidth) || 0;
    var margin = rimW + 22;
    var key = sig.id + '|' + margin;
    if (!o.fit[key]) o.fit[key] = G.fitBox(o.parts, 512, box.w / box.h, margin, 3, [o.fy - o.bb.h * 0.07, o.fy + o.bb.h * 0.07]);
    var fit = o.fit[key];
    var size = (Number(st.sigilSize) || 100) / 100;
    var scale = fit.h / box.h * size;
    var shift = (Number(st.sigilShift) || 0) / 100 * fit.h;
    return { cx: fit.cx, cy: fit.cy + shift, scale: scale, box: box };
  }

  /* ---------- The sigil itself ---------- */
  function sigilLayers(sig, c, uid) {
    var ow = SIGIL_LINE;
    function blocks(ly) {
      var under = '', fills = '', aunder = '', afills = '', det = '', ln = '', mk = '';
      (ly.body || []).forEach(function (d) {
        under += '<path d="' + d + '" stroke-width="' + (2 * ow) + '"/>';
        fills += '<path d="' + d + '" fill="' + c.t + '" fill-rule="evenodd"/>';
      });
      (ly.strokes || []).forEach(function (x) {
        under += '<path d="' + x[0] + '" stroke-width="' + (x[1] + 2 * ow) + '"/>';
        fills += '<path d="' + x[0] + '" fill="none" stroke="' + c.t + '" stroke-width="' + x[1] + '" stroke-linecap="round" stroke-linejoin="round"/>';
      });
      (ly.armed || []).forEach(function (d) {
        aunder += '<path d="' + d + '" stroke-width="' + (1.6 * ow) + '"/>';
        afills += '<path d="' + d + '" fill="' + c.a + '" fill-rule="evenodd"/>';
      });
      (ly.detail || []).forEach(function (d) { det += '<path d="' + d + '"/>'; });
      (ly.lines || []).forEach(function (x) { ln += '<path d="' + x[0] + '" stroke-width="' + x[1] + '"/>'; });
      (ly.marks || []).forEach(function (x) { mk += '<path d="' + x[0] + '" stroke-width="' + x[1] + '"/>'; });
      function U(x) { return x ? '<g fill="none" stroke="' + c.l + '" stroke-linejoin="round" stroke-linecap="round">' + x + '</g>' : ''; }
      return [
        U(under), fills ? '<g>' + fills + '</g>' : '', U(aunder), afills ? '<g>' + afills + '</g>' : '',
        det ? '<g fill="' + c.l + '" fill-rule="evenodd">' + det + '</g>' : '',
        ln ? '<g fill="none" stroke="' + c.l + '" stroke-linecap="round" stroke-linejoin="round">' + ln + '</g>' : '',
        mk ? '<g fill="none" stroke="' + c.t + '" stroke-linecap="round">' + mk + '</g>' : ''
      ];
    }
    return sig.layers.map(function (ly) {
      var out = '';
      blocks(ly).forEach(function (x) {
        if (!x) return;
        out += x;
        if (ly.mirror) out += '<g transform="matrix(-1 0 0 1 1000 0)">' + x + '</g>';
      });
      return '<g' + (ly.at ? ' transform="' + ly.at + '"' : '') + '>' + out + '</g>';
    }).join('');
  }

  function sigilColours(st) {
    return { t: colour(st.sigilColour, '#d6b25e'), a: colour(st.accentColour, '#1f4fa8'), l: colour(st.lineColour, '#1a1110') };
  }

  /* ---------- The field ---------- */
  function field(o, st, uid, defs) {
    var c1 = colour(st.field1, '#b1122a'), c2 = colour(st.field2, '#d6b25e');
    var bb = o.bb, fx = o.fx, fy = o.fy, big = 3000;
    var line = R.darken(R.mix(c1, c2, 0.5), 0.55);
    var out = '<rect x="' + n(bb.x1 - 20) + '" y="' + n(bb.y1 - 20) + '" width="' + n(bb.w + 40) + '" height="' + n(bb.h + 40) + '" fill="' + c1 + '"/>';
    var W = bb.w, H = bb.h, splits = [];
    function poly(pts, fill) { return '<path d="M ' + pts.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join(' L ') + ' Z" fill="' + fill + '"/>'; }
    function seg(a, b) { splits.push('M ' + n(a[0]) + ',' + n(a[1]) + ' L ' + n(b[0]) + ',' + n(b[1])); }
    switch (st.division) {
      case 'perPale':
        out += poly([[fx, fy - big], [fx + big, fy - big], [fx + big, fy + big], [fx, fy + big]], c2);
        seg([fx, fy - big], [fx, fy + big]);
        break;
      case 'perFess':
        out += poly([[fx - big, fy], [fx + big, fy], [fx + big, fy + big], [fx - big, fy + big]], c2);
        seg([fx - big, fy], [fx + big, fy]);
        break;
      case 'perBend':
        out += poly([[fx - big, fy - big], [fx + big, fy + big], [fx - big, fy + big]], c2);
        seg([fx - big, fy - big], [fx + big, fy + big]);
        break;
      case 'perBendSinister':
        out += poly([[fx + big, fy - big], [fx - big, fy + big], [fx + big, fy + big]], c2);
        seg([fx + big, fy - big], [fx - big, fy + big]);
        break;
      case 'perChevron': {
        var ay = fy - H * 0.06;
        out += poly([[fx - big, ay + big], [fx, ay], [fx + big, ay + big]], c2);
        seg([fx - big, ay + big], [fx, ay]); seg([fx, ay], [fx + big, ay + big]);
        break;
      }
      case 'quarterly':
        out += poly([[fx, fy - big], [fx + big, fy - big], [fx + big, fy], [fx, fy]], c2);
        out += poly([[fx - big, fy], [fx, fy], [fx, fy + big], [fx - big, fy + big]], c2);
        seg([fx, fy - big], [fx, fy + big]); seg([fx - big, fy], [fx + big, fy]);
        break;
      case 'perSaltire':
        out += poly([[fx, fy], [fx - big, fy - big], [fx - big, fy + big]], c2);
        out += poly([[fx, fy], [fx + big, fy - big], [fx + big, fy + big]], c2);
        seg([fx - big, fy - big], [fx + big, fy + big]); seg([fx + big, fy - big], [fx - big, fy + big]);
        break;
      case 'gyronny':
        for (var g = 0; g < 8; g++) {
          var a1 = (-90 + g * 45) * Math.PI / 180, a2 = (-45 + g * 45) * Math.PI / 180;
          if (g % 2) out += poly([[fx, fy], [fx + big * Math.cos(a1), fy + big * Math.sin(a1)], [fx + big * Math.cos(a2), fy + big * Math.sin(a2)]], c2);
          seg([fx, fy], [fx + big * Math.cos(a1), fy + big * Math.sin(a1)]);
        }
        break;
      case 'paly': {
        var pw = W / 6;
        for (var i = 1; i < 6; i += 2) out += '<rect x="' + n(bb.x1 + i * pw) + '" y="' + n(bb.y1 - 20) + '" width="' + n(pw) + '" height="' + n(H + 40) + '" fill="' + c2 + '"/>';
        for (var j = 1; j < 6; j++) seg([bb.x1 + j * pw, bb.y1 - 20], [bb.x1 + j * pw, bb.y2 + 20]);
        break;
      }
      case 'barry': {
        var bh = H / 8;
        for (var k = 1; k < 8; k += 2) out += '<rect x="' + n(bb.x1 - 20) + '" y="' + n(bb.y1 + k * bh) + '" width="' + n(W + 40) + '" height="' + n(bh) + '" fill="' + c2 + '"/>';
        for (var m = 1; m < 8; m++) seg([bb.x1 - 20, bb.y1 + m * bh], [bb.x2 + 20, bb.y1 + m * bh]);
        break;
      }
      case 'bendy': {
        var sw = W / 6 * Math.SQRT1_2;
        defs.push('<pattern id="tsi-crest-svg-bendy-' + uid + '" patternUnits="userSpaceOnUse" width="' + n(sw * 2) + '" height="' + n(sw * 2) + '" patternTransform="translate(' + n(fx) + ' ' + n(fy) + ') rotate(45)">' +
          '<rect width="' + n(sw * 2) + '" height="' + n(sw * 2) + '" fill="' + c1 + '"/><rect x="' + n(sw) + '" width="' + n(sw) + '" height="' + n(sw * 2) + '" fill="' + c2 + '"/>' +
          '<path d="M 0,0 V ' + n(sw * 2) + ' M ' + n(sw) + ',0 V ' + n(sw * 2) + '" stroke="' + line + '" stroke-opacity=".55" stroke-width="3"/></pattern>');
        out += '<rect x="' + n(bb.x1 - 20) + '" y="' + n(bb.y1 - 20) + '" width="' + n(W + 40) + '" height="' + n(H + 40) + '" fill="url(#tsi-crest-svg-bendy-' + uid + ')"/>';
        break;
      }
      case 'chequy': {
        var q = W / 6;
        defs.push('<pattern id="tsi-crest-svg-chequy-' + uid + '" patternUnits="userSpaceOnUse" width="' + n(q * 2) + '" height="' + n(q * 2) + '" patternTransform="translate(' + n(bb.x1) + ' ' + n(bb.y1) + ')">' +
          '<rect width="' + n(q * 2) + '" height="' + n(q * 2) + '" fill="' + c1 + '"/><rect x="' + n(q) + '" width="' + n(q) + '" height="' + n(q) + '" fill="' + c2 + '"/><rect y="' + n(q) + '" width="' + n(q) + '" height="' + n(q) + '" fill="' + c2 + '"/>' +
          '<path d="M 0,0 H ' + n(q * 2) + ' M 0,' + n(q) + ' H ' + n(q * 2) + ' M 0,0 V ' + n(q * 2) + ' M ' + n(q) + ',0 V ' + n(q * 2) + '" stroke="' + line + '" stroke-opacity=".5" stroke-width="3"/></pattern>');
        out += '<rect x="' + n(bb.x1 - 20) + '" y="' + n(bb.y1 - 20) + '" width="' + n(W + 40) + '" height="' + n(H + 40) + '" fill="url(#tsi-crest-svg-chequy-' + uid + ')"/>';
        break;
      }
      case 'lozengy': {
        var lw = W / 5, lh = lw * 1.3;
        defs.push('<pattern id="tsi-crest-svg-lozengy-' + uid + '" patternUnits="userSpaceOnUse" width="' + n(lw) + '" height="' + n(lh) + '" patternTransform="translate(' + n(fx - lw / 2) + ' ' + n(bb.y1) + ')">' +
          '<rect width="' + n(lw) + '" height="' + n(lh) + '" fill="' + c1 + '"/><path d="M ' + n(lw / 2) + ',0 L ' + n(lw) + ',' + n(lh / 2) + ' L ' + n(lw / 2) + ',' + n(lh) + ' L 0,' + n(lh / 2) + ' Z" fill="' + c2 + '" stroke="' + line + '" stroke-opacity=".5" stroke-width="3"/></pattern>');
        out += '<rect x="' + n(bb.x1 - 20) + '" y="' + n(bb.y1 - 20) + '" width="' + n(W + 40) + '" height="' + n(H + 40) + '" fill="url(#tsi-crest-svg-lozengy-' + uid + ')"/>';
        break;
      }
      default: break;
    }
    if (splits.length) out += '<path d="' + splits.join(' ') + '" fill="none" stroke="' + line + '" stroke-opacity=".6" stroke-width="3"/>';
    return out;
  }

  /* ---------- The band (ordinary) ---------- */
  function ordinary(o, st) {
    if (!st.ordinary || st.ordinary === 'none') return '';
    var col = colour(st.ordinaryColour, '#d6b25e');
    var edge = R.darken(col, 0.6);
    var bb = o.bb, fx = o.fx, fy = o.fy, W = bb.w, H = bb.h, big = 3000;
    var band = W * 0.22, h = band / 2, shapes = [];
    function poly(pts) { return 'M ' + pts.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join(' L ') + ' Z'; }
    function arm(ux, uy, len) {
      var l = Math.hypot(ux, uy); ux /= l; uy /= l;
      var px = -uy * h, py = ux * h;
      return poly([[fx - px - ux * h, fy - py - uy * h], [fx + ux * len - px, fy + uy * len - py], [fx + ux * len + px, fy + uy * len + py], [fx + px - ux * h, fy + py - uy * h]]);
    }
    switch (st.ordinary) {
      case 'chief': shapes.push(poly([[bb.x1 - 30, bb.y1 - 30], [bb.x2 + 30, bb.y1 - 30], [bb.x2 + 30, bb.y1 + H * 0.28], [bb.x1 - 30, bb.y1 + H * 0.28]])); break;
      case 'fess': shapes.push(poly([[fx - big, fy - h * 1.1], [fx + big, fy - h * 1.1], [fx + big, fy + h * 1.1], [fx - big, fy + h * 1.1]])); break;
      case 'pale': shapes.push(poly([[fx - h, fy - big], [fx + h, fy - big], [fx + h, fy + big], [fx - h, fy + big]])); break;
      case 'bend': shapes.push(arm(1, 1, big), arm(-1, -1, big)); break;
      case 'bendSinister': shapes.push(arm(-1, 1, big), arm(1, -1, big)); break;
      case 'cross': shapes.push(arm(0, -1, big), arm(0, 1, big), arm(1, 0, big), arm(-1, 0, big)); break;
      case 'saltire': shapes.push(arm(1, 1, big), arm(-1, -1, big), arm(-1, 1, big), arm(1, -1, big)); break;
      case 'pall': shapes.push(arm(-1, -1, big), arm(1, -1, big), arm(0, 1, big)); break;
      case 'chevron': {
        var ay = fy - H * 0.08, v = band * Math.SQRT2;
        shapes.push(poly([[fx - big, ay + big], [fx, ay], [fx + big, ay + big], [fx + big, ay + big + v], [fx, ay + v], [fx - big, ay + big + v]]));
        break;
      }
      case 'pile': shapes.push(poly([[fx - W * 0.24, bb.y1 - 30], [fx + W * 0.24, bb.y1 - 30], [fx, bb.y1 + H * 0.82]])); break;
      case 'bordure': {
        var rimW = st.rim === 'none' ? 0 : Number(st.rimWidth) || 0;
        var bw = rimW + W * 0.085;
        return '<path d="' + o.d + '" fill="none" stroke="' + edge + '" stroke-width="' + n(bw * 2 + 6) + '"/>' +
          '<path d="' + o.d + '" fill="none" stroke="' + col + '" stroke-width="' + n(bw * 2) + '"/>';
      }
      default: return '';
    }
    /* outlined as one piece: dark strokes underneath, the band on top */
    return '<g fill="none" stroke="' + edge + '" stroke-width="6" stroke-linejoin="round">' + shapes.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</g>' +
      '<g fill="' + col + '">' + shapes.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</g>';
  }

  /* ---------- Texture, light and shade ---------- */
  function texture(st, uid, defs, bb) {
    var id = 'tsi-crest-svg-texture-' + uid;
    var rect = '<rect x="' + n(bb.x1 - 20) + '" y="' + n(bb.y1 - 20) + '" width="' + n(bb.w + 40) + '" height="' + n(bb.h + 40) + '"';
    switch (st.texture) {
      case 'parchment':
        defs.push('<filter id="' + id + '" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="7"/>' +
          '<feColorMatrix values="0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0 0.1  0 0 0 1.1 -0.42"/></filter>');
        return rect + ' filter="url(#' + id + ')" opacity=".55"/>';
      case 'grain':
        defs.push('<filter id="' + id + '" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" stitchTiles="stitch"/>' +
          '<feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 0.75"/></filter>');
        return rect + ' filter="url(#' + id + ')" opacity=".32"/>';
      case 'brushed':
        defs.push('<filter id="' + id + '" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.55" numOctaves="2" seed="11"/>' +
          '<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -0.62"/></filter>');
        return rect + ' filter="url(#' + id + ')" opacity=".45"/>';
      case 'linen':
        defs.push('<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="7" height="7"><path d="M 0,0 H 7 M 0,0 V 7" stroke="#000" stroke-opacity=".16" stroke-width="1.6"/></pattern>');
        return rect + ' fill="url(#' + id + ')"/>';
      default: return '';
    }
  }

  function lighting(st, o, uid, defs, rimW) {
    if (st.lighting === 'flat') return '';
    var bb = o.bb;
    defs.push('<radialGradient id="tsi-crest-svg-sheen-' + uid + '" cx="0.32" cy="0.2" r="0.95"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset=".45" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>');
    defs.push('<filter id="tsi-crest-svg-soften-' + uid + '" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14"/></filter>');
    var out = '<rect x="' + n(bb.x1) + '" y="' + n(bb.y1) + '" width="' + n(bb.w) + '" height="' + n(bb.h) + '" fill="url(#tsi-crest-svg-sheen-' + uid + ')"/>' +
      /* shade just inside the rim, so the field sits a little below it */
      '<path d="' + o.d + '" fill="none" stroke="#000" stroke-opacity=".42" stroke-width="' + n(rimW * 2 + 34) + '" filter="url(#tsi-crest-svg-soften-' + uid + ')"/>';
    if (st.lighting === 'gloss') {
      defs.push('<linearGradient id="tsi-crest-svg-gloss-' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>');
      var gx = bb.x1 - 40, gy = bb.y1 - 40, gw = bb.w + 80, gh = bb.h * 0.46;
      out += '<path d="M ' + n(gx) + ',' + n(gy) + ' H ' + n(gx + gw) + ' V ' + n(gy + gh * 0.7) + ' Q ' + n(gx + gw / 2) + ',' + n(gy + gh * 1.25) + ' ' + n(gx) + ',' + n(gy + gh * 0.7) + ' Z" fill="url(#tsi-crest-svg-gloss-' + uid + ')"/>';
    }
    return out;
  }

  /* ---------- The rim ---------- */
  function rim(o, st, uid, defs) {
    var w = Number(st.rimWidth) || 0;
    var base = colour(st.rimColour, '#d4a93c');
    var light = R.lighten(base, 0.5), dark = R.darken(base, 0.5), line = R.darken(base, 0.78);
    var gid = 'tsi-crest-svg-metal-' + uid;
    defs.push('<linearGradient id="' + gid + '" gradientUnits="userSpaceOnUse" x1="' + n(o.bb.x1) + '" y1="' + n(o.bb.y1) + '" x2="' + n(o.bb.x2) + '" y2="' + n(o.bb.y2) + '">' +
      '<stop offset="0" stop-color="' + light + '"/><stop offset=".38" stop-color="' + base + '"/><stop offset=".7" stop-color="' + R.darken(base, 0.18) + '"/><stop offset="1" stop-color="' + dark + '"/></linearGradient>');
    var metal = 'url(#' + gid + ')';
    function band(width, paint, extra) { return '<path d="' + o.d + '" fill="none" stroke="' + paint + '" stroke-width="' + n(width * 2) + '"' + (extra || '') + '/>'; }
    var out = '';
    switch (st.rim) {
      case 'none': return '';
      case 'fine': {
        var fw = Math.max(4, w * 0.35);
        out = band(fw + 2.5, line) + band(fw, metal);
        break;
      }
      case 'double':
        out = band(w + 2.5, line) + band(w, metal) + band(w * 0.6, line) + band(w * 0.45, metal) +
          band(w * 0.18, light, ' stroke-opacity=".45"');
        break;
      default:
        out = band(w + 2.5, line) + band(w, metal) + band(w * 0.3, light, ' stroke-opacity=".4"');
    }
    if (st.rim === 'studded') {
      var pts = G.insetPoints(o.parts, w / 2, Math.max(26, w * 2.4));
      var sid = 'tsi-crest-svg-stud-' + uid;
      defs.push('<radialGradient id="' + sid + '" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="' + R.lighten(base, 0.7) + '"/><stop offset=".5" stop-color="' + base + '"/><stop offset="1" stop-color="' + dark + '"/></radialGradient>');
      var r = Math.max(4, w * 0.3);
      out += pts.map(function (p) { return '<circle cx="' + n(p[0]) + '" cy="' + n(p[1]) + '" r="' + n(r) + '" fill="url(#' + sid + ')" stroke="' + line + '" stroke-width="2"/>'; }).join('');
    }
    if (st.rim === 'rope') {
      var gap = Math.max(10, w * 0.62);
      var ps = G.insetPoints(o.parts, w / 2, gap);
      out += '<g stroke="' + line + '" stroke-width="' + n(Math.max(2.5, w * 0.12)) + '" stroke-linecap="round" stroke-opacity=".8">' + ps.map(function (p) {
        var tx = p[2], ty = p[3], nx = -ty, ny = tx, a = w * 0.38, b = w * 0.3;
        return '<path d="M ' + n(p[0] - tx * b - nx * a) + ',' + n(p[1] - ty * b - ny * a) + ' L ' + n(p[0] + tx * b + nx * a) + ',' + n(p[1] + ty * b + ny * a) + '"/>';
      }).join('') + '</g>';
    }
    return out;
  }

  /* ---------- The motto ---------- */
  function fontFace(options) {
    if (!options.fontDataUrl) return '';
    return '<style>@font-face{font-family:"' + MOTTO_FONT + '";src:url(' + options.fontDataUrl + ') format("truetype");font-weight:400 900;font-style:normal;}</style>';
  }

  /* The lettering's size, so the whole motto fits along the ribbon. */
  function mottoSize(text, room, max) {
    var len = Math.max(1, text.length);
    return Math.min(max, room / (len * 0.86));
  }

  function banner(st, uid, defs) {
    var text = cleanText(st.motto).trim();
    if (!st.banner || st.banner === 'none' || !text) return '';
    var fill = colour(st.ribbonColour, '#7a0a12'), ink = colour(st.mottoColour, '#e8cc7a');
    var deep = R.darken(fill, 0.38), edge = R.darken(fill, 0.7), hi = R.lighten(fill, 0.22);
    var metal = colour(st.rimColour, '#d4a93c');
    var gid = 'tsi-crest-svg-ribbon-' + uid;
    defs.push('<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + hi + '"/><stop offset=".5" stop-color="' + fill + '"/><stop offset="1" stop-color="' + R.darken(fill, 0.2) + '"/></linearGradient>');
    var upper = esc(text.toUpperCase());
    var style = 'font-family:' + MOTTO_FONT + ',serif;font-weight:700;letter-spacing:0.08em';
    var stroke = ' stroke="' + edge + '" stroke-width="4" stroke-linejoin="round"';
    var out = '';

    if (st.banner === 'ribbon') {
      /* a curved ribbon with its ends folded back behind it and cut in a swallowtail */
      var pathId = 'tsi-crest-svg-motto-' + uid;
      out += '<path d="M 218,832 L 92,846 L 146,896 L 86,954 L 232,928 Z" fill="' + deep + '"' + stroke + '/>';
      out += '<path d="M 806,832 L 932,846 L 878,896 L 938,954 L 792,928 Z" fill="' + deep + '"' + stroke + '/>';
      out += '<path d="M 218,832 L 262,866 L 232,928 Z" fill="' + edge + '"/><path d="M 806,832 L 762,866 L 792,928 Z" fill="' + edge + '"/>';
      out += '<path d="M 196,812 Q 512,936 828,812 L 828,908 Q 512,1032 196,908 Z" fill="url(#' + gid + ')"' + stroke + '/>';
      out += '<path d="M 204,826 Q 512,948 820,826" fill="none" stroke="' + R.lighten(fill, 0.4) + '" stroke-opacity=".35" stroke-width="3"/>';
      defs.push('<path id="' + pathId + '" d="M 196,860 Q 512,984 828,860"/>');
      var fs = mottoSize(text, 560, 52);
      out += '<text fill="' + ink + '" font-size="' + n(fs) + '" style="' + style + '" dy="' + n(fs * 0.36) + '"><textPath href="#' + pathId + '" startOffset="50%" text-anchor="middle">' + upper + '</textPath></text>';
      return out;
    }

    if (st.banner === 'scroll') {
      /* a straight scroll with rolled ends */
      out += '<path d="M 214,828 H 810 V 928 H 214 Z" fill="url(#' + gid + ')"' + stroke + '/>';
      out += '<path d="M 214,928 C 176,928 150,904 150,874 C 150,846 172,828 200,828 C 228,828 244,848 244,872 C 244,894 226,906 208,906 C 190,906 180,892 182,878" fill="' + deep + '"' + stroke + '/>';
      out += '<path d="M 810,928 C 848,928 874,904 874,874 C 874,846 852,828 824,828 C 796,828 780,848 780,872 C 780,894 798,906 816,906 C 834,906 844,892 842,878" fill="' + deep + '"' + stroke + '/>';
      var fs2 = mottoSize(text, 500, 48);
      out += '<text x="512" y="' + n(878 + fs2 * 0.36) + '" text-anchor="middle" fill="' + ink + '" font-size="' + n(fs2) + '" style="' + style + '">' + upper + '</text>';
      return out;
    }

    /* plaque: a framed tablet in the rim's metal */
    var pid = 'tsi-crest-svg-plaque-' + uid;
    defs.push('<linearGradient id="' + pid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + R.lighten(metal, 0.45) + '"/><stop offset=".5" stop-color="' + metal + '"/><stop offset="1" stop-color="' + R.darken(metal, 0.45) + '"/></linearGradient>');
    out += '<rect x="206" y="822" width="612" height="120" rx="22" fill="url(#' + pid + ')" stroke="' + R.darken(metal, 0.75) + '" stroke-width="4"/>';
    out += '<rect x="222" y="838" width="580" height="88" rx="13" fill="url(#' + gid + ')" stroke="' + edge + '" stroke-width="3"/>';
    var fs3 = mottoSize(text, 520, 48);
    out += '<text x="512" y="' + n(882 + fs3 * 0.36) + '" text-anchor="middle" fill="' + ink + '" font-size="' + n(fs3) + '" style="' + style + '">' + upper + '</text>';
    return out;
  }

  function hasBanner(st) {
    return !!(st.banner && st.banner !== 'none' && cleanText(st.motto).trim());
  }

  /* ---------- The whole crest ---------- */
  function svg(st, options) {
    options = options || {};
    var uid = ++counter;
    var defs = [];
    var o = outline(st.shield, shieldBox(hasBanner(st)));
    var sig = find(sigilList(), st.sigil);
    var place = sigilPlace(o, sig, st);
    var rimW = st.rim === 'none' ? 0 : (st.rim === 'fine' ? Math.max(4, (Number(st.rimWidth) || 0) * 0.35) : Number(st.rimWidth) || 0);
    var clip = 'tsi-crest-svg-clip-' + uid;
    defs.push('<clipPath id="' + clip + '"><path d="' + o.d + '"/></clipPath>');
    defs.push('<filter id="tsi-crest-svg-shadow-' + uid + '" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000" flood-opacity=".55"/></filter>');

    var raised = st.relief !== 'flat';
    if (raised) {
      defs.push('<filter id="tsi-crest-svg-relief-' + uid + '" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">' +
        '<feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="blur"/>' +
        '<feSpecularLighting in="blur" surfaceScale="3.2" specularConstant=".62" specularExponent="16" lighting-color="#ffffff" result="spec"><feDistantLight azimuth="225" elevation="46"/></feSpecularLighting>' +
        '<feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>' +
        '<feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3=".55" k4="0" result="lit"/>' +
        '<feDropShadow in="lit" dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".55"/></filter>');
    }
    var flip = st.sigilFace === 'right' ? -1 : 1;
    var b = place.box;
    var sigilSvg = '<g clip-path="url(#' + clip + ')"><g' + (raised ? ' filter="url(#tsi-crest-svg-relief-' + uid + ')"' : '') + '>' +
      '<g transform="translate(' + n(place.cx) + ' ' + n(place.cy) + ') scale(' + (flip * place.scale).toFixed(4) + ' ' + place.scale.toFixed(4) + ') translate(' + n(-(b.x1 + b.w / 2)) + ' ' + n(-(b.y1 + b.h / 2)) + ')">' +
      sigilLayers(sig, sigilColours(st), uid) + '</g></g></g>';

    var body =
      '<g clip-path="url(#' + clip + ')">' + field(o, st, uid, defs) + ordinary(o, st) + texture(st, uid, defs, o.bb) + '</g>' +
      sigilSvg +
      '<g clip-path="url(#' + clip + ')">' + lighting(st, o, uid, defs, rimW) + '<g clip-path="url(#' + clip + ')">' + rim(o, st, uid, defs) + '</g></g>' +
      '<path d="' + o.d + '" fill="none" stroke="' + R.darken(colour(st.rimColour, '#d4a93c'), 0.8) + '" stroke-width="4" stroke-linejoin="round"/>';

    var ban = banner(st, uid, defs);
    var size = options.size || '100%';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 1024 1024" role="img" aria-label="Clan crest">' +
      '<defs>' + (ban ? fontFace(options) : '') + defs.join('') + '</defs>' +
      '<g filter="url(#tsi-crest-svg-shadow-' + uid + ')">' + body + ban + '</g></svg>';
  }

  /* ---------- Small pictures for the choices ---------- */
  var THUMB_BOX = { x: 112, y: 40, w: 800, h: 944 };

  function thumbShape(shapeId, st) {
    var o = outline(shapeId, THUMB_BOX);
    return '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="' + o.d + '" fill="' + colour(st.field1) + '" stroke="' + colour(st.rimColour) + '" stroke-width="48" stroke-linejoin="round"/></svg>';
  }

  function thumbField(kind, id, st) {
    var uid = ++counter, defs = [];
    var o = outline(st.shield, THUMB_BOX);
    var clip = 'tsi-crest-svg-clip-' + uid;
    defs.push('<clipPath id="' + clip + '"><path d="' + o.d + '"/></clipPath>');
    var s2 = Object.assign({}, st, kind === 'division' ? { division: id, ordinary: 'none' } : { division: 'plain', ordinary: id, rim: 'none' });
    var inner = field(o, s2, uid, defs) + ordinary(o, s2);
    return '<svg viewBox="0 0 1024 1024" aria-hidden="true"><defs>' + defs.join('') + '</defs><g clip-path="url(#' + clip + ')">' + inner +
      '</g><path d="' + o.d + '" fill="none" stroke="' + colour(st.rimColour) + '" stroke-width="40" stroke-linejoin="round"/></svg>';
  }

  function thumbSigil(sigilId, st) {
    var sig = find(sigilList(), sigilId), b = sigilBox(sig);
    var s = Math.min(1000 / b.w, 1000 / b.h);
    return '<svg viewBox="0 0 1000 1000" aria-hidden="true"><g transform="translate(500 500) scale(' + s.toFixed(4) + ') translate(' + n(-(b.x1 + b.w / 2)) + ' ' + n(-(b.y1 + b.h / 2)) + ')">' +
      sigilLayers(sig, sigilColours(st), ++counter) + '</g></svg>';
  }

  crest.draw = {
    svg: svg,
    outline: outline,
    shieldBox: shieldBox,
    sigilBox: sigilBox,
    sigilPlace: sigilPlace,
    hasBanner: hasBanner,
    cleanText: cleanText,
    mottoSize: mottoSize,
    thumbShape: thumbShape,
    thumbField: thumbField,
    thumbSigil: thumbSigil
  };
}());
