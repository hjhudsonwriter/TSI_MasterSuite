/* Scarlett Isles: Beast Handler — drawing a QR code (S17, 22 October 2026).

   The DM's box shows a QR code that links a player's phone. The squares are worked
   out by the bundled library tools/beasthandler/lib/qrcode.js (qrcode-generator
   2.0.4, MIT, licences/qrcode-generator-MIT.txt). This file only turns those squares into a
   picture: a plain SVG drawing made of one path, black on white with a white margin.
   It is NOT drawn on a canvas (CLAUDE.md: never export a canvas that has had a
   bundled image on it; this one has nothing to export), and the drawing is built
   with DOM calls, never with innerHTML, so nothing typed can end up as code.

   Only the Bastion page loads this and the library. The player's phone page does not
   (it reads a code, it never makes one).

   BH.qr.matrix(text)  → { size, rows } rows[r][c] is true for a dark square
   BH.qr.svg(text, o)  → an <svg> element (o.px: width in pixels; o.label: what a screen reader says) */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};
  var Q = ns.qr = {};

  var NS = 'http://www.w3.org/2000/svg';
  /* Medium error correction: a smudge or glare on the screen is forgiven, and a link of about 130 letters is still only 45 to 49 squares wide. */
  Q.LEVEL = 'M';
  Q.QUIET = 4;   /* squares of white margin, the least a scanner needs */

  /* The squares for some text, or { error } if it won't fit in any QR code. Nothing is drawn. */
  Q.matrix = function (text) {
    if (typeof window.qrcode !== 'function') return { error: 'The QR code maker isn\'t loaded.' };
    try {
      var qr = window.qrcode(0, Q.LEVEL);
      qr.addData(String(text), 'Byte');
      qr.make();
      var size = qr.getModuleCount();
      var rows = [];
      for (var r = 0; r < size; r++) {
        var row = [];
        for (var c = 0; c < size; c++) row.push(!!qr.isDark(r, c));
        rows.push(row);
      }
      return { size: size, rows: rows };
    } catch (e) {
      return { error: 'That is too long for a QR code.' };
    }
  };

  /* The squares as one path (a run of dark squares in a row is one rectangle). */
  Q.pathData = function (m) {
    var d = '';
    for (var r = 0; r < m.size; r++) {
      var c = 0;
      while (c < m.size) {
        if (!m.rows[r][c]) { c++; continue; }
        var start = c;
        while (c < m.size && m.rows[r][c]) c++;
        d += 'M' + (start + Q.QUIET) + ' ' + (r + Q.QUIET) + 'h' + (c - start) + 'v1h-' + (c - start) + 'z';
      }
    }
    return d;
  };

  /* An <svg> drawing of the code, or null if it can't be made. */
  Q.svg = function (text, o) {
    o = o || {};
    var m = Q.matrix(text);
    if (m.error) return null;
    var full = m.size + Q.QUIET * 2;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('xmlns', NS);
    svg.setAttribute('viewBox', '0 0 ' + full + ' ' + full);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', o.label || 'QR code');
    svg.setAttribute('shape-rendering', 'crispEdges');
    if (o.px) { svg.setAttribute('width', String(o.px)); svg.setAttribute('height', String(o.px)); }
    var back = document.createElementNS(NS, 'rect');
    back.setAttribute('width', String(full)); back.setAttribute('height', String(full)); back.setAttribute('fill', '#ffffff');
    var dark = document.createElementNS(NS, 'path');
    dark.setAttribute('d', Q.pathData(m));
    dark.setAttribute('fill', '#000000');
    svg.appendChild(back);
    svg.appendChild(dark);
    return svg;
  };
}());
