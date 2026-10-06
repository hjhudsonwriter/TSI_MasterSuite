/* The Scarlett Isles: D&D Tool Suite — the DM doc's geometry (plain functions, tested in tests/rules.html).
   The DM doc is a floating panel (shared/js/dmdoc.js). These work out where it
   sits and how big it is, so it always stays on screen:
   - never wider or taller than the window, and no smaller than 280 × 200
     (unless the window itself is smaller than that);
   - never over the suite's top bar, so its title bar can always be grabbed.

   A "rect" is { x, y, w, h } in CSS pixels from the window's top-left corner.
   A "view" is the window: { width, height, top }, where top is the bottom edge
   of the suite's top bar. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  function num(value, fallback) {
    return typeof value === 'number' && isFinite(value) ? value : fallback;
  }

  var rules = {
    MIN_W: 280,
    MIN_H: 200,
    DEFAULT_W: 440,
    DEFAULT_H: 680,
    /* The gap from the window's right edge and the top bar when it first opens. */
    GAP: 24,
    /* Arrow keys on the title bar move it this far (Shift: further). */
    NUDGE: 10,
    NUDGE_BIG: 50,

    /* A tidy copy of a view, with sensible values for anything missing. */
    view: function (v) {
      v = v || {};
      var width = Math.max(0, num(v.width, 0));
      var height = Math.max(0, num(v.height, 0));
      var top = Math.min(Math.max(0, num(v.top, 0)), height);
      return { width: width, height: height, top: top };
    },

    /* The rect moved and sized to fit the view: no larger than it, no smaller
       than the minimum, and wholly inside it below the top bar. */
    clamp: function (rect, view) {
      var v = rules.view(view);
      rect = rect || {};
      var room = v.height - v.top;
      var w = Math.min(Math.max(num(rect.w, rules.DEFAULT_W), rules.MIN_W), v.width);
      var h = Math.min(Math.max(num(rect.h, rules.DEFAULT_H), rules.MIN_H), room);
      var x = Math.min(Math.max(num(rect.x, 0), 0), v.width - w);
      var y = Math.min(Math.max(num(rect.y, v.top), v.top), v.height - h);
      return { x: Math.round(x), y: Math.round(y), w: Math.floor(w), h: Math.floor(h) };
    },

    /* Where it opens the first time: near the right edge, just below the top bar. */
    defaultRect: function (view) {
      var v = rules.view(view);
      var h = Math.min(rules.DEFAULT_H, v.height - v.top - 2 * rules.GAP);
      return rules.clamp({
        x: v.width - rules.DEFAULT_W - rules.GAP,
        y: v.top + rules.GAP,
        w: rules.DEFAULT_W,
        h: h
      }, v);
    },

    /* Dragging the title bar by (dx, dy) from where the drag started. */
    move: function (start, dx, dy, view) {
      return rules.clamp({ x: start.x + num(dx, 0), y: start.y + num(dy, 0), w: start.w, h: start.h }, view);
    },

    /* Dragging the bottom-right grip by (dx, dy). The top-left corner stays
       put, and the panel stops growing at the window's edge (it only moves
       if there's no room left for even the smallest size). */
    resize: function (start, dx, dy, view) {
      var v = rules.view(view);
      var w = Math.max(start.w + num(dx, 0), rules.MIN_W);
      var h = Math.max(start.h + num(dy, 0), rules.MIN_H);
      w = Math.min(w, Math.max(v.width - start.x, rules.MIN_W));
      h = Math.min(h, Math.max(v.height - start.y, rules.MIN_H));
      return rules.clamp({ x: start.x, y: start.y, w: w, h: h }, v);
    },

    /* An arrow key on the title bar: the moved rect, or null for any other key. */
    nudge: function (rect, key, big, view) {
      var step = big ? rules.NUDGE_BIG : rules.NUDGE;
      var d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[key];
      return d ? rules.move(rect, d[0], d[1], view) : null;
    },

    /* What's saved: { x, y, w, h } as whole numbers. */
    toSaved: function (rect) {
      return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) };
    },

    /* A saved layout read back, or null if it's missing or damaged. */
    fromSaved: function (value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      var ok = ['x', 'y', 'w', 'h'].every(function (k) { return typeof value[k] === 'number' && isFinite(value[k]); });
      if (!ok || value.w <= 0 || value.h <= 0) return null;
      return { x: value.x, y: value.y, w: value.w, h: value.h };
    }
  };

  TSI.dmDocRules = rules;
}());
