/* Pelagosi Puzzle Trials: the cinematic clips, played once, the same way in both windows.
   The DM's window uses it as an overlay when no players' window is connected; the players' window uses it full-bleed.
   Clips are always muted (every sound stays in the DM window's own sound engine). A clip that is missing or won't
   play is skipped silently. It never traps the mouse: the layer ignores clicks, except its small Skip button.

   var cinema = TSI.pelagosi.cinema.create({ parent, timers, onEnd(name, why), skip: true });
   cinema.preload({ arrival: 'url', ... });     // once, so playback starts at once
   cinema.play('absence', { rate: 0.81, ms: 6000, dark: [0.55, 0.85], hold: true });   // false if it can't start
   cinema.ripple();  cinema.skip();  cinema.stop();                                  // stop() clears everything
   timers: { setTimeout(fn, ms) -> id, clearTimeout(id) }. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var pel = TSI.pelagosi = TSI.pelagosi || {};

  function create(o) {
    var el = TSI.el;
    var timers = o.timers;
    var clips = {};
    var current = null;           /* { name, opts, ended } */
    var pending = [];             /* timer ids, so stop() can clear them */

    var dark = el('div', { class: 'tsi-pel-cine-dark', 'aria-hidden': 'true' });
    var frame = el('div', { class: 'tsi-pel-cine-frame', 'aria-hidden': 'true' }, dark);
    var skipBtn = o.skip ? el('button', { type: 'button', class: 'tsi-btn tsi-pel-small-btn tsi-pel-cine-skip', 'data-test': 'cine-skip', text: 'Skip (Esc)' }) : null;
    var root = el('div', { class: 'tsi-pel-cine', 'data-test': o.testId || 'cine', 'aria-hidden': skipBtn ? null : 'true' }, [frame, skipBtn].filter(Boolean));
    root.hidden = true;
    o.parent.appendChild(root);
    if (skipBtn) skipBtn.addEventListener('click', function () { api.skip(); });

    function later(fn, ms) {
      var id = timers.setTimeout(function () { var i = pending.indexOf(id); if (i >= 0) pending.splice(i, 1); fn(); }, ms);
      pending.push(id);
      return id;
    }

    function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

    function finish(why) {
      if (!current || current.ended) return;
      var c = current;
      c.ended = true;
      var v = clips[c.name] && clips[c.name].video;
      if (v) { try { v.pause(); } catch (e) { /* nothing to do */ } }
      if (c.opts.hold && why !== 'failed') {
        /* The Absence: the picture goes, the screen stays black so the ripple can be drawn on it. */
        dark.style.transitionDuration = '900ms';
        dark.style.opacity = '1';
        later(function () { if (v) v.classList.remove('tsi-pel-cine-video--on'); }, 950);
      } else {
        root.classList.remove('tsi-pel-cine--on');
        later(function () { if (current === c) { root.hidden = true; if (v) v.classList.remove('tsi-pel-cine-video--on'); } }, 760);
      }
      if (o.onEnd) o.onEnd(c.name, why);
    }

    var api = {
      root: root,
      has: function (name) { return !!clips[name]; },

      preload: function (map) {
        Object.keys(map || {}).forEach(function (name) {
          if (clips[name] && clips[name].src === map[name]) return;
          var v = document.createElement('video');
          v.className = 'tsi-pel-cine-video';
          v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
          v.playsInline = true; v.setAttribute('playsinline', '');
          v.preload = 'auto';
          v.src = map[name];
          frame.insertBefore(v, dark);
          clips[name] = { video: v, src: map[name] };
        });
      },

      /* opts: { rate, ms (the clip's length, for the safety timer), dark: [from, to], hold } */
      play: function (name, opts) {
        opts = opts || {};
        var clip = clips[name];
        if (!clip || reduced()) return false;
        api.stop();
        var v = clip.video;
        current = { name: name, opts: opts, ended: false };
        var c = current;
        Object.keys(clips).forEach(function (n) { clips[n].video.classList.toggle('tsi-pel-cine-video--on', n === name); });
        var rate = opts.rate || 1;
        var span = (opts.ms || 6000) / rate;
        dark.style.transitionDuration = '0ms';
        dark.style.opacity = opts.dark ? String(opts.dark[0]) : '0';
        root.hidden = false;
        void root.offsetWidth;
        root.classList.add('tsi-pel-cine--on');
        if (opts.dark) later(function () { dark.style.transitionDuration = Math.round(span) + 'ms'; dark.style.transitionTimingFunction = 'linear'; dark.style.opacity = String(opts.dark[1]); }, 60);
        try { v.currentTime = 0; } catch (e) { /* not loaded yet */ }
        v.playbackRate = rate;
        v.onended = function () { if (current === c) finish('ended'); };
        v.onplaying = function () { c.playing = true; };
        var p;
        try { p = v.play(); } catch (e) { p = null; }
        if (p && p.catch) p.catch(function () { if (current === c && !c.ended) finish('failed'); });
        later(function () { if (current === c && !c.ended && !c.playing) finish('failed'); }, 2500);   /* never started */
        later(function () { if (current === c && !c.ended) finish('ended'); }, span + 1500);          /* safety: never stuck on */
        return true;
      },

      /* The third ripple, drawn on the screen over the clip's last frames or the black after it. */
      ripple: function () {
        if (reduced() && !current) return;
        root.hidden = false;
        root.classList.add('tsi-pel-cine--on');
        var r = el('span', { class: 'tsi-pel-cine-ripple', 'aria-hidden': 'true', 'data-test': 'cine-ripple' });
        frame.appendChild(r);
        later(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 2800);
      },

      isPlaying: function () { return !!current && !current.ended; },
      skip: function () { if (current && !current.ended) finish('skipped'); },

      /* Everything off at once: pictures, timers, ripples. */
      stop: function () {
        pending.splice(0).forEach(function (id) { timers.clearTimeout(id); });
        Object.keys(clips).forEach(function (n) {
          var v = clips[n].video;
          v.onended = null; v.onplaying = null;
          try { v.pause(); } catch (e) { /* nothing to do */ }
          v.classList.remove('tsi-pel-cine-video--on');
        });
        Array.prototype.forEach.call(frame.querySelectorAll('.tsi-pel-cine-ripple'), function (n) { n.parentNode.removeChild(n); });
        dark.style.transitionDuration = '0ms';
        dark.style.opacity = '0';
        root.classList.remove('tsi-pel-cine--on');
        root.hidden = true;
        current = null;
      }
    };
    return api;
  }

  pel.cinema = { create: create };
}());
