/* The Scarlett Isles: D&D Tool Suite — the DM's cursor on the players' screen.
   While the DM's pointer is over a tool's picture (the Explorer's map, the Bastion's painting, the Tidal chamber), the
   players' window draws a small gold arrow at the same place, and a ring when the DM clicks. Both ends work in the
   picture's own coordinates, so it is in the right place on any screen shape or zoom. It carries only a position: the
   pointer's coordinates, nothing else. The DM can switch it off with a tick box.

   DM side:      TSI.pointerMirror.attach({ life, target, link, point(event) -> { x, y }, enabled() -> true/false })
                 sends 'cursor' { x, y, down } while the pointer moves over target, { x: null } when it leaves.
   Players' side: var c = TSI.pointerMirror.cursor(parentElement);   c.at(x, y, 'px' | '%');  c.hide();  c.press(); */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var EVERY_MS = 33;
  var STALE_MS = 6000;

  function attach(o) {
    var last = 0;
    var pending = null;
    var shown = false;
    function send(p, down) {
      if (!o.link || !o.link.isConnected()) return;
      o.link.send('cursor', { x: p ? p.x : null, y: p ? p.y : null, down: !!down });
      shown = !!p;
    }
    function leave() {
      if (pending !== null) { o.life.clearTimeout(pending); pending = null; }
      if (shown) send(null);
    }
    function move(e, down) {
      if (!o.enabled()) { if (shown) send(null); return; }
      var p = o.point(e);
      if (!p || !isFinite(p.x) || !isFinite(p.y)) return;
      var now = Date.now();
      if (down || now - last >= EVERY_MS) {
        if (pending !== null) { o.life.clearTimeout(pending); pending = null; }   /* an older position must never arrive after this one */
        last = now; send(p, down); return;
      }
      /* Too soon: send where it ended up, so it never stops short. */
      if (pending !== null) o.life.clearTimeout(pending);
      pending = o.life.setTimeout(function () { pending = null; last = Date.now(); send(p, false); }, EVERY_MS);
    }
    o.life.on(o.target, 'pointermove', function (e) { move(e, false); });
    o.life.on(o.target, 'pointerdown', function (e) { move(e, true); });
    o.life.on(o.target, 'pointerleave', leave);
    return { hide: leave };
  }

  function arrow() {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 32');
    svg.setAttribute('class', 'tsi-pm-arrow');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M2 2 L2 25 L8 19.5 L12.5 29.5 L16.5 27.7 L12.2 18 L20.5 18 Z');
    svg.appendChild(p);
    return svg;
  }

  function cursor(parent) {
    var ring = document.createElement('span');
    ring.className = 'tsi-pm-ring';
    var node = document.createElement('div');
    node.className = 'tsi-pm-cursor';
    node.setAttribute('aria-hidden', 'true');
    node.hidden = true;
    node.appendChild(ring);
    node.appendChild(arrow());
    parent.appendChild(node);
    var stale = null;
    function hide() { node.hidden = true; window.clearTimeout(stale); }
    return {
      node: node,
      at: function (x, y, unit) {
        var u = unit === '%' ? '%' : 'px';
        node.style.left = x + u;
        node.style.top = y + u;
        node.hidden = false;
        window.clearTimeout(stale);
        stale = window.setTimeout(hide, STALE_MS);   /* the DM's window went quiet: let go of it */
      },
      hide: hide,
      press: function () {
        ring.classList.remove('is-on');
        void ring.offsetWidth;
        ring.classList.add('is-on');
      }
    };
  }

  TSI.pointerMirror = { attach: attach, cursor: cursor };
}());
