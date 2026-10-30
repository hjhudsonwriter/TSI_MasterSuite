/* Scarlett Isles Explorer: sound effects (30 October 2026). Plain functions for what should be playing, and a small player that
   starts and stops the sounds listed in data/sfx-data.js. They play from the DM's window only. Nothing here touches the game's rules.

   What plays when (the Explorer tells this player; it decides nothing about the game):
     footsteps  only while heroes are moving (dragged or walking): moving() keeps it going, it stops a moment after the last move
     campfire   from Make Camp for the fade (data campFadeMs), and on while a campfire event is open
     rain, storm  for as long as that weather is active
     raven      once, when "The Ironbow sends word..." opens
   A sound whose file is missing is skipped quietly. Browsers won't play a sound before the page has been clicked; anything wanted
   starts at the next click. */
(function () {
  'use strict';

  var ns = TSI.explorer = TSI.explorer || {};
  var S = ns.sfx = {};

  S.KEY = 'tsi.explorer.sfx';
  S.STOP_AFTER_MS = 260;      /* footsteps stop this long after the last movement */
  S.FADE_OUT_MS = 260;

  /* The weather's sound: a sound name, or null (blizzard and sun-heat have none). */
  S.weatherSound = function (kind) { return kind === 'rain' ? 'rain' : kind === 'storm' ? 'storm' : null; };

  /* The saved settings, tidied: { on, volume }. */
  S.cleanSettings = function (raw) {
    var o = raw && typeof raw === 'object' ? raw : {};
    var v = Number(o.volume);
    return { on: o.on !== false, volume: isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8 };
  };

  /* Is the campfire wanted? camp is { fadeEnd (a time), holds (campfire events open) }. */
  S.campOn = function (camp, now) { return !!camp && (camp.holds > 0 || now < camp.fadeEnd); };

  /* How loud a sound should be: the master volume times its own, or 0 when sound is off. */
  S.level = function (settings, cfg) { return settings.on ? Math.min(1, Math.max(0, settings.volume * (Number(cfg && cfg.volume) || 0))) : 0; };

  /* opts: { life, config (data/sfx-data.js), now, load, save }. */
  S.create = function (opts) {
    var life = opts.life;
    var config = opts.config || { folder: '', sounds: {}, campFadeMs: 4000 };
    var now = opts.now || function () { return Date.now(); };
    var settings = S.cleanSettings(opts.load ? opts.load() : null);
    var names = Object.keys(config.sounds);
    var voices = {};      /* name -> { audio, status: 'unknown' | 'ok' | 'missing', playing, fading } */
    var want = { footsteps: false, weather: null };
    var camp = { fadeEnd: 0, holds: 0 };
    var footTimer = null, campTimer = null;
    var oneShots = {};

    function cfgOf(name) { return config.sounds[name]; }
    function srcOf(name) { return TSI.path(config.folder + cfgOf(name).file); }
    function voice(name) {
      if (voices[name]) return voices[name];
      var v = { audio: null, status: 'unknown', playing: false, fadeTimer: null, blocked: false };
      v.audio = life.audio(null, { preload: 'none', loop: !!cfgOf(name).loop });
      v.audio.addEventListener('error', function () { v.status = 'missing'; v.playing = false; });
      v.audio.addEventListener('canplay', function () { if (v.status === 'unknown') v.status = 'ok'; });
      v.audio.setAttribute('src', srcOf(name));
      voices[name] = v;
      return v;
    }
    function clearFade(v) { if (v.fadeTimer) { life.clearInterval(v.fadeTimer); v.fadeTimer = null; } }

    function start(name) {
      if (!settings.on || !cfgOf(name)) return;
      var v = voice(name);
      if (v.status === 'missing') return;
      clearFade(v);
      v.audio.volume = S.level(settings, cfgOf(name));
      if (v.playing && !v.audio.paused) return;
      v.playing = true;
      var p = v.audio.play();
      if (p && p.catch) p.catch(function () { v.blocked = true; });
    }
    function stop(name, quick) {
      var v = voices[name];
      if (!v || !v.playing) return;
      v.playing = false;
      clearFade(v);
      if (quick || v.audio.paused) { try { v.audio.pause(); } catch (e) { /* nothing */ } return; }
      var from = v.audio.volume, steps = 6, i = 0;
      v.fadeTimer = life.setInterval(function () {
        i++;
        try { v.audio.volume = Math.max(0, from * (1 - i / steps)); } catch (e) { /* nothing */ }
        if (i >= steps) { clearFade(v); try { v.audio.pause(); } catch (e) { /* nothing */ } }
      }, Math.round(S.FADE_OUT_MS / steps));
    }

    /* Make what is playing match what is wanted now. */
    function sync() {
      var weather = S.weatherSound(want.weather);
      var wanted = { footsteps: want.footsteps, campfire: S.campOn(camp, now()), rain: weather === 'rain', storm: weather === 'storm' };
      ['footsteps', 'campfire', 'rain', 'storm'].forEach(function (name) {
        if (!cfgOf(name)) return;
        if (wanted[name]) start(name); else stop(name);
      });
    }

    /* A click lets the browser play sound: start anything that was wanted but blocked. */
    life.on(document, 'pointerdown', function () {
      names.forEach(function (n) { if (voices[n] && voices[n].blocked) { voices[n].blocked = false; voices[n].playing = false; } });
      sync();
    }, true);

    var api = {
      /* Heroes moved just now: footsteps play, and stop a moment after the last move. */
      moving: function () {
        want.footsteps = true;
        if (footTimer) life.clearTimeout(footTimer);
        footTimer = life.setTimeout(function () { footTimer = null; want.footsteps = false; sync(); }, S.STOP_AFTER_MS);
        sync();
      },
      stopMoving: function () {
        if (footTimer) { life.clearTimeout(footTimer); footTimer = null; }
        want.footsteps = false;
        sync();
      },
      /* Make Camp: the campfire plays through the fade. */
      campStart: function () {
        camp.fadeEnd = now() + (Number(config.campFadeMs) || 4000);
        if (campTimer) life.clearTimeout(campTimer);
        campTimer = life.setTimeout(function () { campTimer = null; sync(); }, (Number(config.campFadeMs) || 4000) + 30);
        sync();
      },
      /* A campfire event opened (true) or finished (false): the fire stays on while one is open. */
      campHold: function (on) {
        camp.holds = Math.max(0, camp.holds + (on ? 1 : -1));
        sync();
      },
      /* The weather now (the weather kind, or null). */
      weather: function (kind) { want.weather = kind || null; sync(); },
      /* A one-off sound, from the start. */
      play: function (name) {
        if (!cfgOf(name) || !settings.on) return;
        var v = voice(name);
        if (v.status === 'missing') return;
        clearFade(v);
        v.audio.volume = S.level(settings, cfgOf(name));
        try { v.audio.currentTime = 0; } catch (e) { /* not loaded yet */ }
        v.playing = true;
        var p = v.audio.play();
        if (p && p.catch) p.catch(function () { v.blocked = true; });
        if (!cfgOf(name).loop) v.audio.onended = function () { v.playing = false; };
      },
      /* The Sound panel's Test button: a few seconds of it, even if sound is switched off at the moment. */
      test: function (name) {
        if (!cfgOf(name)) return;
        var was = settings.on;
        settings.on = true;
        if (oneShots[name]) life.clearTimeout(oneShots[name]);
        api.play(name);
        settings.on = was;
        if (cfgOf(name).loop) oneShots[name] = life.setTimeout(function () { oneShots[name] = null; if (!(name === 'footsteps' ? want.footsteps : name === 'campfire' ? S.campOn(camp, now()) : S.weatherSound(want.weather) === name)) stop(name); }, 3000);
      },
      /* Does the file exist? Calls back 'ok' or 'missing'. */
      probe: function (name, cb) {
        if (!cfgOf(name)) return cb('missing');
        var a = new Audio();
        a.preload = 'metadata';
        a.addEventListener('loadedmetadata', function () { cb('ok'); a.removeAttribute('src'); a.load(); });
        a.addEventListener('error', function () { cb('missing'); });
        a.src = srcOf(name);
      },
      setOn: function (on) {
        settings.on = !!on;
        if (opts.save) opts.save(settings);
        if (!settings.on) names.forEach(function (n) { stop(n, true); });
        sync();
      },
      setVolume: function (v) {
        settings.volume = S.cleanSettings({ volume: v }).volume;
        if (opts.save) opts.save(settings);
        names.forEach(function (n) { if (voices[n] && voices[n].playing) voices[n].audio.volume = S.level(settings, cfgOf(n)); });
      },
      settings: function () { return { on: settings.on, volume: settings.volume }; },
      names: function () { return names.slice(); },
      label: function (name) { return cfgOf(name) ? cfgOf(name).label : name; },
      /* For the tests: what is playing and from which file. */
      debug: function () {
        var out = {};
        names.forEach(function (n) {
          var v = voices[n];
          out[n] = v ? { playing: v.playing && !v.audio.paused, wanted: v.playing, src: v.audio.getAttribute('src') || '', volume: v.audio.volume, status: v.status } : { playing: false, wanted: false, src: '', volume: 0, status: 'unknown' };
        });
        return out;
      }
    };
    life.onStop(function () {
      names.forEach(function (n) { var v = voices[n]; if (v) { clearFade(v); try { v.audio.pause(); } catch (e) { /* nothing */ } v.audio.removeAttribute('src'); try { v.audio.load(); } catch (e) { /* nothing */ } } });
    });
    return api;
  };
}());
