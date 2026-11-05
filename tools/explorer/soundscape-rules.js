/* Scarlett Isles Explorer: the soundscape's rules (guide 5, 5 November 2026). Plain functions, tested in tests/rules.html. Nothing here plays a sound.
   The Explorer works out what the table calls for (a situation) and what should play (the automatic plan); the Sound control adds the DM's
   choices (a mix: volume, mute and a mood); layers() puts the two together, and the player (soundscape-player.js) makes it so.

   situation   { mapId, town (a town's pin card is open on the TV), camp (Make Camp's fade or a campfire event), night (a night event is open),
                 weather (the weather kind or null), fight (a fight is with the Combat Tracker and not yet won) }
   auto        { base, also, overlay, fight, voice } (also: a second sound that plays with the base, at its own level, such as the night with the campfire): the bed ids that play by themselves, whether the combat mood is wanted, and whether a voice line is playing
   mix         { volume (0 to 1), muted, mood }: the DM's choices ('' is Off (automatic))
   layers      [{ id, role: 'base' | 'overlay' | 'mood', level }]: what should be playing, each as loud as its file's own level and its role make it
               (the master volume and ducking are applied by the player) */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function id(v) { return typeof v === 'string' && /^[a-z0-9_]{1,30}$/.test(v) ? v : ''; }
  function data(d) { return d || (window.TSI_DATA && window.TSI_DATA.soundscape) || { beds: {}, moods: [], mapBeds: {}, weatherBeds: {} }; }

  var R = TSI.soundscapeRules = {
    DEFAULT_VOLUME: 0.8,
    MAX_AGE_MS: 12 * 3600 * 1000,       /* a plan left behind from a session over twelve hours ago is not followed */

    /* ---------- The DM's choices ---------- */
    cleanMix: function (raw) {
      var o = isObj(raw) ? raw : {};
      var v = Number(o.volume);
      return { volume: isFinite(v) ? Math.min(1, Math.max(0, Math.round(v * 100) / 100)) : R.DEFAULT_VOLUME, muted: o.muted === true, mood: id(o.mood) };
    },
    cleanAuto: function (raw) {
      var o = isObj(raw) ? raw : {};
      return { base: id(o.base), also: id(o.also), overlay: id(o.overlay), fight: o.fight === true, voice: o.voice === true };
    },

    /* ---------- What the table calls for ---------- */
    /* The road sound, a town, camp or night; and the weather on top; and the combat mood while a fight is on. */
    autoPlan: function (sit, d) {
      d = data(d);
      sit = isObj(sit) ? sit : {};
      var base = '';
      if (sit.camp) base = d.campBed || '';
      else if (sit.night) base = d.nightBed || '';
      else if (sit.town) base = d.townBed || '';
      else if (sit.mapId && d.mapBeds && d.mapBeds[sit.mapId]) base = d.mapBeds[sit.mapId];
      var also = sit.camp && d.campWith && d.beds && d.beds[d.campWith] ? d.campWith : '';
      var overlay = sit.weather && d.weatherBeds && d.weatherBeds[sit.weather] ? d.weatherBeds[sit.weather] : '';
      return { base: d.beds && d.beds[base] ? base : '', also: also, overlay: d.beds && d.beds[overlay] ? overlay : '', fight: !!sit.fight, voice: !!sit.voice };
    },

    /* The mood in force: the DM's choice, else the combat mood while a fight is on, else none. Any bed id will do for a DM's choice. */
    moodNow: function (auto, mix, d) {
      d = data(d);
      var m = mix && mix.mood && d.beds[mix.mood] ? mix.mood : '';
      if (!m && auto && auto.fight && d.fightMood && d.beds[d.fightMood]) m = d.fightMood;
      return m;
    },

    /* What should be playing: the road sound (halved under a mood), the weather over it, the mood over both. Each sound once, even if two
       of them are the same file's id (the later role wins). missing is a list of bed ids whose files are not there: they are left out. */
    layers: function (auto, mix, d, missing) {
      d = data(d);
      auto = R.cleanAuto(auto);
      mix = R.cleanMix(mix);
      var gone = missing || [];
      var mood = R.moodNow(auto, mix, d);
      var list = [];
      if (auto.base) list.push({ id: auto.base, role: 'base', level: d.beds[auto.base].volume * (mood ? (d.moodBedLevel || 0.5) : 1) });
      if (auto.also && d.beds[auto.also]) list.push({ id: auto.also, role: 'base', level: d.beds[auto.also].volume * (mood ? (d.moodBedLevel || 0.5) : 1) });
      if (auto.overlay) list.push({ id: auto.overlay, role: 'overlay', level: d.beds[auto.overlay].volume });
      if (mood) list.push({ id: mood, role: 'mood', level: d.beds[mood].volume });
      var seen = {}, out = [];
      for (var i = list.length - 1; i >= 0; i--) { if (!seen[list[i].id]) { seen[list[i].id] = 1; out.unshift(list[i]); } }
      return out.filter(function (l) { return gone.indexOf(l.id) === -1; });
    },
    /* How loud everything is while a voice line plays. */
    duckFactor: function (auto, d) { d = data(d); return auto && auto.voice ? (typeof d.duckTo === 'number' ? d.duckTo : 0.3) : 1; },
    /* The level a layer plays at, 0 to 1. */
    levelOf: function (layer, auto, mix, d) { return mix.muted ? 0 : Math.max(0, Math.min(1, layer.level * mix.volume * R.duckFactor(auto, d))); },

    /* A short key for "has anything changed?" */
    key: function (auto, mix, d) {
      return R.layers(auto, mix, d).map(function (l) { return l.role + ':' + l.id; }).join('|') + (auto && auto.voice ? '|duck' : '');
    },

    /* ---------- What the Sound control says ---------- */
    label: function (bedId, d) { d = data(d); return d.beds[bedId] ? d.beds[bedId].label.replace(/\s*\(.*\)\s*$/, '') : bedId; },
    /* status: { playing: [ids], missing: [ids], blocked: bool } as the player reports it. */
    nowPlaying: function (layers, status, d) {
      status = isObj(status) ? status : {};
      var gone = Array.isArray(status.missing) ? status.missing : [];
      var parts = (layers || []).map(function (l) { return R.label(l.id, d) + (l.role === 'mood' ? ' (mood)' : ''); });
      gone.forEach(function (g) { parts.push(R.label(g, d) + ': file missing'); });
      var text = parts.length ? parts.join(', ') : 'Nothing is playing';
      if (status.blocked) text += '. Click once in the TV window to let it play sound';
      return text;
    },
    moodChoices: function (d) { d = data(d); return (d.moods || []).filter(function (m) { return d.beds[m]; }).map(function (m) { return { id: m, label: R.label(m, d) }; }); },
    /* What a {sound: id} tag may name beyond the sound effects: any bed or mood, and off. */
    cueIds: function (d) { d = data(d); return Object.keys(d.beds || {}).concat(['off']); },

    /* ---------- Messages between windows ---------- */
    /* The hand-off value: { at, auto, mix }. A part that is missing keeps what the reader already has. */
    pack: function (auto, mix, now) { return { at: now || Date.now(), auto: R.cleanAuto(auto), mix: R.cleanMix(mix) }; },
    unpack: function (raw, now) {
      if (!isObj(raw)) return null;
      var at = Number(raw.at);
      if (!isFinite(at) || (now || Date.now()) - at > R.MAX_AGE_MS) return null;
      return { at: at, auto: R.cleanAuto(raw.auto), mix: R.cleanMix(raw.mix) };
    }
  };
}());
