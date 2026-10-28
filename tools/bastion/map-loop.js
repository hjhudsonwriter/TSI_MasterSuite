/* The Ironbow Bastion: the base painting as a short loop.
   The painting is a still (map/bastion_base.jpg); Harry's loop (map/bastion_base_loop.mp4, the same picture with the sea,
   the boat and the smoke moving) plays over it, muted, on repeat. The still stays underneath, so a loop that is missing,
   cannot play or is switched off by "reduce motion" leaves the painting exactly as it was. The facility overlays and
   labels sit above both, and line up because the loop is cropped to the painting's own shape. */
(function () {
  'use strict';

  var TSI = window.TSI;

  /* parent: the map's frame (position: relative). src: the loop's URL, or '' for none. className: the video's class.
     Returns the video element (already in the parent, hidden until it is really playing), or null. */
  TSI.paintingLoop = function (parent, src, className) {
    if (!src) return null;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    var v = document.createElement('video');
    v.className = className;
    v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
    v.loop = true;
    v.playsInline = true; v.setAttribute('playsinline', '');
    v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    v.setAttribute('data-test', 'map-loop');
    v.hidden = true;
    v.addEventListener('playing', function () { v.hidden = false; });
    v.addEventListener('error', function () { v.hidden = true; });
    v.setAttribute('src', src);
    /* After the still, before the overlays. */
    parent.insertBefore(v, parent.children[1] || null);
    var p = v.play();
    if (p && p.catch) p.catch(function () { v.hidden = true; });
    return v;
  };
}());
