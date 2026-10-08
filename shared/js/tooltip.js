/* The Scarlett Isles: D&D Tool Suite — the tooltip card.
   One tooltip for the whole suite (the Bastion overhaul, Build 2, Harry,
   8 October 2026): a dark card with a gold title line, the body, and an
   optional line at the foot (a cost, or how many days something takes).
   It shows on hover and on keyboard focus, beside what it describes and
   never over it, and above any open pop-up, so it works inside panels.

   TSI.tooltip.bind(node, build, opts)
     build() → { title, parts, foot } (parts: nodes or text; foot: text),
     or null for no tooltip. Shown while the pointer is over node (and on
     'change', unless opts.noChange). opts.anchor: the element to sit beside
     (default node).
   TSI.tooltip.bindFocus(target, anchor, build)
     The same from the keyboard: shown beside anchor while target has the
     focus, if the focus came by the keyboard (so a click into a box doesn't
     cover the next one); Escape or moving on hides it.
   TSI.tooltip.show(content, rect | element, opts) / hide() / isShown()
     opts.beside: to the right of the rect (or its left where there's no
     room), level with opts.row (a second rect), as for an open list.
   TSI.tooltip.node: the card itself (id "tsi-tip", data-test "tooltip"). */
(function () {
  'use strict';

  var TSI = window.TSI;
  var GAP = 10;
  var EDGE = 12;
  var node = null;
  var keyboard = false;

  function card() {
    if (node) return node;
    node = TSI.el('div', { class: 'tsi-tip', id: 'tsi-tip', role: 'tooltip', hidden: true, 'data-test': 'tooltip' });
    return node;
  }
  /* In full screen, inside the full-screen element, so it can be seen. */
  function attach() {
    var host = document.fullscreenElement || document.body;
    if (card().parentNode !== host) host.appendChild(node);
  }
  function rectOf(x) {
    if (!x) return null;
    if (typeof x.getBoundingClientRect === 'function') return x.getBoundingClientRect();
    return x;
  }
  function fill(c) {
    var n = card();
    TSI.clear(n);
    n.appendChild(TSI.el('div', { class: 'tsi-tip__title', text: c.title || '' }));
    var body = TSI.el('div', { class: 'tsi-tip__body' });
    TSI.append(body, c.parts);
    n.appendChild(body);
    if (c.foot) n.appendChild(TSI.el('div', { class: 'tsi-tip__foot', text: c.foot }));
  }
  /* Above or below the rect, whichever has room (above for things low on
     the screen), lined up with it and kept inside the window. */
  function place(r, opts) {
    var n = card();
    var w = n.offsetWidth || 320;
    var h = n.offsetHeight || 120;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var x, y;
    if (opts && opts.beside) {
      x = r.right + GAP;
      if (x + w > vw - EDGE) x = Math.max(EDGE, r.left - GAP - w);
      var row = opts.row || r;
      y = Math.max(EDGE, Math.min(row.top - 8, vh - h - EDGE));
    } else {
      var roomAbove = r.top - GAP - EDGE;
      var roomBelow = vh - r.bottom - GAP - EDGE;
      var above = roomAbove >= h || (roomAbove > roomBelow && r.top > vh / 2);
      y = above ? r.top - GAP - h : r.bottom + GAP;
      /* Neither fits whole: beside it instead, so it still doesn't cover it. */
      if ((above && y < EDGE) || (!above && y + h > vh - EDGE)) {
        x = r.right + GAP;
        if (x + w > vw - EDGE) x = r.left - GAP - w;
        y = Math.max(EDGE, Math.min(r.top, vh - h - EDGE));
        n.style.left = Math.max(EDGE, Math.min(x, vw - w - EDGE)) + 'px';
        n.style.top = y + 'px';
        return;
      }
      x = r.left + r.width / 2 - w / 2;
    }
    n.style.left = Math.max(EDGE, Math.min(x, vw - w - EDGE)) + 'px';
    n.style.top = Math.max(EDGE, y) + 'px';
  }

  function show(content, near, opts) {
    if (!content) { hide(); return; }
    attach();
    fill(content);
    node.hidden = false;
    var r = rectOf(near);
    if (r) place(r, opts);
  }
  function hide() { if (node) node.hidden = true; }

  function bind(target, build, opts) {
    opts = opts || {};
    function open() {
      var c = build();
      if (!c) { hide(); return; }
      show(c, opts.anchor || target);
    }
    target.addEventListener('mouseenter', open);
    target.addEventListener('mouseleave', hide);
    if (!opts.noChange) target.addEventListener('change', open);
    return target;
  }

  function bindFocus(target, anchor, build) {
    var id = card().id;
    target.addEventListener('focus', function () {
      if (!keyboard) return;
      var c = build();
      if (!c) return;
      show(c, anchor || target);
      target.setAttribute('aria-describedby', id);
    });
    function off() {
      if (target.getAttribute('aria-describedby') !== id) return;
      target.removeAttribute('aria-describedby');
      hide();
    }
    target.addEventListener('blur', off);
    target.addEventListener('keydown', function (e) { if (e.key === 'Escape') off(); });
    return target;
  }

  /* Was the last thing done with the keyboard? (A click doesn't show focus tooltips.) */
  document.addEventListener('keydown', function () { keyboard = true; }, true);
  document.addEventListener('pointerdown', function () { keyboard = false; }, true);
  /* Scrolling or resizing moves things out from under it. */
  window.addEventListener('resize', hide);
  document.addEventListener('fullscreenchange', function () { if (node && !node.hidden) attach(); });

  TSI.tooltip = {
    bind: bind,
    bindFocus: bindFocus,
    show: show,
    hide: hide,
    isShown: function () { return !!node && !node.hidden; },
    get node() { return card(); },
    /* A list for a tooltip's body. */
    list: function (lines) { return TSI.el('ul', null, (lines || []).map(function (x) { return TSI.el('li', { text: String(x) }); })); }
  };
}());
