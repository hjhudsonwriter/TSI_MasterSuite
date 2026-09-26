/* The Scarlett Isles: D&D Tool Suite — lifecycle helper.
   Each tool gets one "life" when it starts. Everything the tool sets going
   through it (timers, animation frames, listeners, key shortcuts, sounds,
   videos) is remembered, and life.stop() stops all of it, so nothing from a
   closed tool can carry on or pop up over another tool.
   Every callback is wrapped so an error shows the suite's error bar. */
(function () {
  'use strict';

  var TSI = window.TSI;

  TSI.createLife = function (name) {
    var where = name || 'a tool';
    var timeouts = new Set();
    var intervals = new Set();
    var frames = new Set();
    var listeners = new Set();
    var media = new Set();
    var cleanups = [];
    var stopped = false;

    function wrap(fn) { return TSI.guard(fn, where); }

    var life = {
      name: where,

      get alive() { return !stopped; },

      setTimeout: function (fn, ms) {
        if (stopped) return null;
        var safe = wrap(fn);
        var id = window.setTimeout(function () {
          timeouts.delete(id);
          if (!stopped) safe();
        }, ms || 0);
        timeouts.add(id);
        return id;
      },

      clearTimeout: function (id) {
        window.clearTimeout(id);
        timeouts.delete(id);
      },

      /* A promise that resolves after ms (never resolves once the tool has stopped). */
      wait: function (ms) {
        return new Promise(function (resolve) { life.setTimeout(resolve, ms); });
      },

      setInterval: function (fn, ms) {
        if (stopped) return null;
        var safe = wrap(fn);
        var id = window.setInterval(function () { if (!stopped) safe(); }, ms);
        intervals.add(id);
        return id;
      },

      clearInterval: function (id) {
        window.clearInterval(id);
        intervals.delete(id);
      },

      raf: function (fn) {
        if (stopped) return null;
        var safe = wrap(fn);
        var id = window.requestAnimationFrame(function (t) {
          frames.delete(id);
          if (!stopped) safe(t);
        });
        frames.add(id);
        return id;
      },

      cancelRaf: function (id) {
        window.cancelAnimationFrame(id);
        frames.delete(id);
      },

      /* Add an event listener. Returns a function that removes it. */
      on: function (target, type, fn, options) {
        if (stopped || !target) return function () {};
        var safe = wrap(fn);
        target.addEventListener(type, safe, options);
        var entry = { target: target, type: type, fn: safe, options: options };
        listeners.add(entry);
        return function off() {
          target.removeEventListener(type, safe, options);
          listeners.delete(entry);
        };
      },

      /* A keyboard shortcut listener for this tool. It is skipped while a text
         box has focus or a pop-up is open, unless options say otherwise. */
      onKey: function (fn, options) {
        options = options || {};
        return life.on(document, options.type || 'keydown', function (event) {
          if (!options.whileTyping && TSI.keys.isTyping(event)) return;
          if (!options.underModal && TSI.modal && TSI.modal.isOpen()) return;
          fn(event);
        });
      },

      /* A sound owned by this tool. It stops (and lets go of its file) when the tool closes. */
      audio: function (src, options) {
        var el = new Audio();
        if (options && options.loop) el.loop = true;
        if (options && typeof options.volume === 'number') el.volume = options.volume;
        el.preload = (options && options.preload) || 'auto';
        if (src) el.src = src;
        return life.track(el);
      },

      /* Hand over a sound or video element made elsewhere so it is stopped on close. */
      track: function (el) {
        if (stopped) {
          silence(el);
          return el;
        }
        media.add(el);
        return el;
      },

      untrack: function (el) { media.delete(el); },

      /* A group of timers that can be cancelled together, e.g. one per puzzle,
         cleared on Reset without stopping the whole tool. Everything in a group
         also stops when the tool closes.
           var timers = life.group();
           timers.setTimeout(fn, ms); await timers.wait(ms); timers.raf(fn);
           timers.clear();       // cancels them all; waits never finish
           timers.generation     // goes up by one on every clear() */
      group: function () {
        var ids = new Set();
        var rafs = new Set();
        var generation = 0;
        var g = {
          get generation() { return generation; },

          setTimeout: function (fn, ms) {
            var id = life.setTimeout(function () {
              ids.delete(id);
              fn();
            }, ms);
            if (id !== null) ids.add(id);
            return id;
          },

          clearTimeout: function (id) {
            life.clearTimeout(id);
            ids.delete(id);
          },

          /* Resolves after ms, unless the group is cleared first (then it never does). */
          wait: function (ms) {
            return new Promise(function (resolve) { g.setTimeout(resolve, ms); });
          },

          raf: function (fn) {
            var id = life.raf(function (t) {
              rafs.delete(id);
              fn(t);
            });
            if (id !== null) rafs.add(id);
            return id;
          },

          clear: function () {
            generation++;
            ids.forEach(function (id) { life.clearTimeout(id); });
            rafs.forEach(function (id) { life.cancelRaf(id); });
            ids.clear();
            rafs.clear();
          },

          counts: function () { return { timeouts: ids.size, frames: rafs.size }; }
        };
        return g;
      },

      /* Anything else to do when the tool closes. */
      onStop: function (fn) {
        if (stopped) {
          wrap(fn)();
          return;
        }
        cleanups.push(wrap(fn));
      },

      stop: function () {
        if (stopped) return;
        stopped = true;
        timeouts.forEach(function (id) { window.clearTimeout(id); });
        intervals.forEach(function (id) { window.clearInterval(id); });
        frames.forEach(function (id) { window.cancelAnimationFrame(id); });
        listeners.forEach(function (l) { l.target.removeEventListener(l.type, l.fn, l.options); });
        media.forEach(silence);
        timeouts.clear();
        intervals.clear();
        frames.clear();
        listeners.clear();
        media.clear();
        var list = cleanups.splice(0);
        list.reverse().forEach(function (fn) { fn(); });
      },

      /* For tests: how many things are still running. */
      counts: function () {
        return {
          timeouts: timeouts.size,
          intervals: intervals.size,
          frames: frames.size,
          listeners: listeners.size,
          media: media.size,
          cleanups: cleanups.length
        };
      }
    };

    return life;
  };

  function silence(el) {
    try {
      el.pause();
      el.removeAttribute('src');
      Array.prototype.forEach.call(el.querySelectorAll ? el.querySelectorAll('source') : [], function (s) { s.remove(); });
      el.load();
    } catch (e) { /* already gone */ }
  }
}());
