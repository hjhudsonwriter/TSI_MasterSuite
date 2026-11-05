/* "Previously, in the Scarlett Isles…" — the reel, drawn on the Explorer's Player View (the TV window; guide 4).
   TSI.recapReel.create({ host, reducedMotion }) → { play(snapshot), stop(), playing() }
   It only draws what recap-rules.js's snapshot gives it (pictures and words), keeps nothing and saves nothing. The slides crossfade
   slowly with a gentle push-in (no push-in when the system asks for reduced motion), and the last frame is held until stop() ("Back to the
   map" on the DM's side). Optional pictures in tools/recap/assets/: title.png (the opening card; without it the words show over the map of
   the Scarlett Isles, dimmed). Sound is never played here: the DM's laptop plays the narration, sting and music bed. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var R = TSI.recapRules;
  var el = TSI.el;
  var TITLE_PICTURE = 'tools/recap/assets/title.png';
  var MAP = 'tools/explorer/assets/scarlett-isles-map.jpg';
  var FADE = 1.4;                 /* seconds to crossfade */

  function src(p) { return /^data:/.test(p) ? p : TSI.path(p); }

  TSI.recapReel = {
    create: function (opts) {
      var host = opts.host;
      var reduced = opts.reducedMotion || function () { return false; };
      var layer = null, timers = [], current = null, running = false, token = 0;

      function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
      function clearTimers() { timers.splice(0).forEach(clearTimeout); }

      /* A picture behind the words; if it will not load, a plain dark slide shows the words alone. */
      function backdrop(path, extra) {
        var box = el('div', { class: 'tsi-reel__bg' + (extra ? ' ' + extra : '') });
        var im = new Image();
        im.onload = function () { box.style.backgroundImage = 'url("' + src(path).replace(/"/g, '%22') + '")'; box.classList.add('is-loaded'); };
        im.onerror = function () { box.classList.add('is-missing'); };
        im.src = src(path);
        return box;
      }

      function build(s, secs) {
        var push = reduced() ? 'none' : (secs + FADE) + 's';
        var node = el('section', { class: 'tsi-reel__slide tsi-reel__slide--' + s.kind, 'data-test': 'reel-slide', 'data-kind': s.kind });
        node.style.setProperty('--tsi-reel-push', push);
        var kids = [];
        if (s.kind === 'title') {
          var bg = el('div', { class: 'tsi-reel__bg tsi-reel__bg--map' });
          var probe = new Image();
          probe.onload = function () { bg.style.backgroundImage = 'url("' + src(TITLE_PICTURE) + '")'; bg.classList.add('is-title'); };
          probe.onerror = function () { bg.style.backgroundImage = 'url("' + src(MAP) + '")'; bg.classList.add('is-map'); };
          probe.src = src(TITLE_PICTURE);
          kids.push(el('div', { class: 'tsi-reel__push' }, bg), el('h1', { class: 'tsi-reel__title', 'data-test': 'reel-caption', text: s.caption }));
        } else if (s.kind === 'picture') {
          kids.push(el('div', { class: 'tsi-reel__push' }, [backdrop(s.image, 'tsi-reel__bg--blur'), s.image ? pictureImg(s.image) : null]),
            el('p', { class: 'tsi-reel__caption', 'data-test': 'reel-caption', text: s.caption }));
        } else if (s.kind === 'clues') {
          kids.push(el('div', { class: 'tsi-reel__board' }), el('h2', { class: 'tsi-reel__head', 'data-test': 'reel-caption', text: s.caption }),
            el('ul', { class: 'tsi-reel__notes', 'data-test': 'reel-lines' }, s.lines.map(function (l, i) {
              var li = el('li', { class: 'tsi-reel__note', text: l });
              li.style.setProperty('--tsi-reel-tilt', ((i % 2 ? 1 : -1) * (1 + (i % 3) * 0.7)).toFixed(1) + 'deg');
              return li;
            })));
        } else if (s.kind === 'meanwhile') {
          kids.push(el('div', { class: 'tsi-reel__push' }, el('div', { class: 'tsi-reel__bg tsi-reel__bg--map is-map', style: 'background-image:url("' + src(MAP) + '")' })),
            el('h2', { class: 'tsi-reel__head', 'data-test': 'reel-caption', text: s.caption }),
            el('ul', { class: 'tsi-reel__lines', 'data-test': 'reel-lines' }, s.lines.map(function (l) { return el('li', { text: l }); })));
        } else {
          kids.push(el('div', { class: 'tsi-reel__rule' }), el('h1', { class: 'tsi-reel__title tsi-reel__title--closing', 'data-test': 'reel-caption', text: s.caption }), el('div', { class: 'tsi-reel__rule' }));
        }
        TSI.append(node, kids);
        return node;
      }
      function pictureImg(path) {
        var im = el('img', { class: 'tsi-reel__img', alt: '', draggable: 'false', src: src(path) });
        im.addEventListener('error', function () { im.remove(); });
        return im;
      }

      function show(i, snap, mine) {
        if (mine !== token) return;
        var s = snap.slides[i];
        var node = build(s, s.secs);
        node.style.setProperty('--tsi-reel-fade', (reduced() ? 0.3 : FADE) + 's');
        layer.appendChild(node);
        /* The next frame, so the fade-in runs. */
        requestAnimationFrame(function () { requestAnimationFrame(function () { node.classList.add('is-in'); }); });
        var old = current;
        current = node;
        if (old) {
          old.classList.add('is-out');
          later(function () { if (old.parentNode) old.remove(); }, (reduced() ? 0.3 : FADE) * 1000 + 100);
        }
      }

      function stop() {
        token++;
        clearTimers();
        running = false;
        current = null;
        if (layer) { layer.remove(); layer = null; }
      }

      return {
        playing: function () { return running; },
        stop: stop,
        play: function (snap) {
          if (!R.isSafeSnapshot(snap)) return false;
          snap = { v: 1, slides: snap.slides.map(R.cleanSlide).filter(Boolean) };
          if (!snap.slides.length) return false;
          stop();
          var mine = token;
          running = true;
          layer = el('div', { class: 'tsi-reel', 'data-test': 'reel', 'aria-label': 'Previously, in the Scarlett Isles', role: 'img' });
          host.appendChild(layer);
          var at = 0;
          snap.slides.forEach(function (s, i) {
            if (i === 0) show(0, snap, mine);
            else later(function () { show(i, snap, mine); }, at * 1000);
            at += s.secs;
          });
          /* The last slide stays up (nothing is scheduled after it) until stop(). */
          return true;
        }
      };
    }
  };
}());
