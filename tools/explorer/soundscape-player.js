/* Scarlett Isles Explorer: the soundscape player (guide 5, 5 November 2026). It makes what soundscape-rules.js says should be playing so, and runs in
   whichever window is playing the beds: the Explorer Player View (the TV window, which stays open across tool switches) or, when no Player View
   is open, the DM's Explorer window.
   - Every sound is a channel with two copies of its file: a loop never leaves a gap, the second copy fades in under the end of the first
     (the Tidal Sequence's bed does the same, KNOWN_ISSUES PEL-22). A sound is never played twice at once.
   - Sounds crossfade over data.fadeSecs when the plan changes; everything drops to data.duckTo while a voice line plays; mute is at once.
   - A file that is not there is skipped quietly (status().missing). A browser that will not play a sound before the window has been clicked is
     noticed (status().blocked): resume() on the first click starts what was wanted.
   TSI.soundscape.create({ makeAudio, setInterval, clearInterval, onStatus, data }) → { apply(auto, mix), status(), resume(), stop(), debug() } */
(function () {
  'use strict';

  var TSI = window.TSI;
  var R = TSI.soundscapeRules;
  var TICK_MS = 100;
  var DUCK_SECS = 0.5;

  function clamp(v) { return Math.max(0, Math.min(1, v)); }

  TSI.soundscape = {
    create: function (opts) {
      var d = opts.data || window.TSI_DATA.soundscape;
      var fadeSecs = Math.max(0.2, Number(d.fadeSecs) || 4);
      var channels = {};
      var wanted = {};             /* id -> { role, level } */
      var auto = R.cleanAuto(null), mix = R.cleanMix(null);
      var duck = 1;                /* the current duck, moving towards its target */
      var timer = null;
      var lastStatusKey = '';
      var stopped = false;

      function missingIds() { return Object.keys(channels).filter(function (k) { return channels[k].missing; }); }

      function newAudio(ch) {
        var a = opts.makeAudio();
        a.preload = 'auto';
        a.loop = false;
        a.addEventListener('error', function () { ch.missing = true; ch.state = 'idle'; reapply(); report(); });
        a.addEventListener('loadedmetadata', function () { if (isFinite(a.duration) && a.duration > 0) ch.duration = a.duration; });
        a.setAttribute('src', TSI.path(d.beds[ch.id].file));
        return a;
      }
      function channel(id) {
        if (channels[id]) return channels[id];
        var ch = channels[id] = { id: id, copies: [], active: 0, cur: 0, state: 'idle', missing: false, blocked: false, duration: 0, xf: null };
        ch.copies = [newAudio(ch), newAudio(ch)];
        return ch;
      }

      function play(ch, a) {
        var p;
        try { p = a.play(); } catch (e) { p = null; }
        if (p && p.catch) p.catch(function (err) { if (!ch.missing && err && err.name !== 'AbortError') ch.blocked = true; report(); });
      }
      function start(ch) {
        if (ch.missing) return;
        ch.state = 'playing';
        ch.xf = null;
        ch.active = 0;
        var a = ch.copies[0];
        try { a.currentTime = 0; } catch (e) { /* not loaded yet */ }
        a.volume = 0;
        ch.blocked = false;
        play(ch, a);
      }
      function halt(ch) {
        ch.copies.forEach(function (a) { try { a.pause(); a.currentTime = 0; } catch (e) { /* nothing */ } });
        ch.state = 'idle'; ch.xf = null; ch.cur = 0;
      }

      function setVolumes(ch, level) {
        var v = mix.muted ? 0 : clamp(level);
        if (ch.xf) {
          var t = clamp((Date.now() - ch.xf.start) / (ch.xf.secs * 1000));
          ch.xf.from.volume = clamp(v * (1 - t)); ch.xf.to.volume = clamp(v * t);
          if (t >= 1) { try { ch.xf.from.pause(); ch.xf.from.currentTime = 0; } catch (e) { /* nothing */ } ch.active = ch.copies.indexOf(ch.xf.to); ch.xf = null; }
        } else {
          ch.copies[ch.active].volume = v;
        }
        ch.copies.forEach(function (a) { a.muted = mix.muted; });
      }

      function tick() {
        if (stopped) return;
        var dt = TICK_MS / 1000;
        /* the duck moves quickly; the sounds fade over fadeSecs */
        var duckTarget = R.duckFactor(auto, d);
        duck = duck < duckTarget ? Math.min(duckTarget, duck + dt / DUCK_SECS) : Math.max(duckTarget, duck - dt / DUCK_SECS);
        Object.keys(channels).forEach(function (id) {
          var ch = channels[id];
          var w = wanted[id];
          if (w && ch.state === 'idle' && !ch.missing) start(ch);
          if (ch.state !== 'playing') return;
          ch.cur = w ? Math.min(1, ch.cur + dt / fadeSecs) : Math.max(0, ch.cur - dt / fadeSecs);
          if (!w && ch.cur <= 0) { halt(ch); return; }
          if (w) ch.level = w.level;
          /* the loop: near the end of the playing copy, the other one starts and takes over */
          var a = ch.copies[ch.active];
          var dur = ch.duration || (isFinite(a.duration) ? a.duration : 0);
          if (!ch.xf && dur > 0) {
            var secs = Math.min(2.5, dur / 4);
            if (a.currentTime >= dur - secs && !a.paused) {
              var b = ch.copies[1 - ch.active];
              try { b.currentTime = 0; } catch (e) { /* nothing */ }
              b.volume = 0;
              play(ch, b);
              ch.xf = { from: a, to: b, start: Date.now(), secs: secs };
            } else if (a.ended) {
              try { a.currentTime = 0; } catch (e) { /* nothing */ }
              play(ch, a);
            }
          }
          setVolumes(ch, (ch.level || 0) * mix.volume * duck * ch.cur);
        });
        report();
      }
      function ensureTimer() { if (!timer && !stopped) timer = opts.setInterval(tick, TICK_MS); }

      function reapply() { apply(auto, mix); }
      function apply(nextAuto, nextMix) {
        auto = R.cleanAuto(nextAuto); mix = R.cleanMix(nextMix);
        var layers = R.layers(auto, mix, d, missingIds());
        wanted = {};
        layers.forEach(function (l) { wanted[l.id] = { role: l.role, level: l.level }; channel(l.id); });
        /* a mute is heard at once, not at the next tick */
        Object.keys(channels).forEach(function (id) { var ch = channels[id]; ch.copies.forEach(function (a) { a.muted = mix.muted; }); if (mix.muted) ch.copies.forEach(function (a) { a.volume = 0; }); });
        ensureTimer();
        tick();
      }

      function status() {
        var ids = Object.keys(channels);
        return {
          playing: ids.filter(function (k) { var ch = channels[k]; return wanted[k] && ch.state === 'playing' && !ch.blocked; }),
          missing: missingIds(),
          blocked: ids.some(function (k) { return wanted[k] && channels[k].blocked; })
        };
      }
      function report() {
        if (!opts.onStatus) return;
        var s = status();
        var key = s.playing.join(',') + '|' + s.missing.join(',') + '|' + s.blocked;
        if (key === lastStatusKey) return;
        lastStatusKey = key;
        opts.onStatus(s);
      }

      return {
        apply: apply,
        status: status,
        /* A click in the window: sound the browser had refused starts now. */
        resume: function () {
          Object.keys(channels).forEach(function (k) {
            var ch = channels[k];
            if (!ch.blocked || !wanted[k]) return;
            ch.blocked = false;
            ch.state = 'idle';
            ch.copies.forEach(function (a) { try { a.pause(); } catch (e) { /* nothing */ } });
          });
          tick();
        },
        /* Everything stops now (the window is closing, or the tool has been left). */
        stop: function () {
          stopped = true;
          if (timer) { opts.clearInterval(timer); timer = null; }
          Object.keys(channels).forEach(function (k) { var ch = channels[k]; halt(ch); ch.copies.forEach(function (a) { try { a.removeAttribute('src'); a.load(); } catch (e) { /* nothing */ } }); });
          wanted = {};
          report();
        },
        /* For the tests: what each channel is doing. */
        debug: function () {
          var out = {};
          Object.keys(channels).forEach(function (k) {
            var ch = channels[k];
            out[k] = { state: ch.state, wanted: !!wanted[k], fade: Math.round(ch.cur * 100) / 100, missing: ch.missing, blocked: ch.blocked, crossfading: !!ch.xf, active: ch.active,
              volumes: ch.copies.map(function (a) { return Math.round(a.volume * 100) / 100; }), playing: ch.copies.filter(function (a) { return !a.paused; }).length, muted: ch.copies[0].muted, src: ch.copies[0].getAttribute('src') };
          });
          return { duck: Math.round(duck * 100) / 100, channels: out };
        }
      };
    }
  };
}());
