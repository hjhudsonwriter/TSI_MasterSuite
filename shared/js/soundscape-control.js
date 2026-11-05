/* The Scarlett Isles: D&D Tool Suite — the Sound control in the top bar, on every screen (guide 5, 5 November 2026).
   A small pop-over with a volume slider, a mute, what is playing now and a Mood menu. It sets the DM's choices (the mix: volume, mute, mood);
   what plays by itself is the Explorer's decision (tools/explorer/soundscape-rules.js) and the sound comes from the Explorer Player View.
   The choices are kept in tsi.explorer.prefs (so they are in every backup) and passed on through TSI.handoff ('sound'). What the playing
   window is doing comes back through 'soundstatus'.
   TSI.soundControl.button() → the top bar's button;  .onMix(fn) → a way to stop listening: fn(mix) hears a change made in this window. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var el = TSI.el;
  var PREFS = 'tsi.explorer.prefs';
  var listeners = [];
  var pop = null, timer = null;

  function R() { return TSI.soundscapeRules; }
  function data() { return window.TSI_DATA.soundscape; }

  function readMix() {
    var p = null;
    try { p = TSI.store.get(PREFS, null); } catch (e) { p = null; }
    p = p && typeof p === 'object' ? p : {};
    return R().cleanMix({ volume: p.scVolume, muted: p.scMuted, mood: p.scMood });
  }
  /* One save at a time, always of the newest choice, so quick changes (the slider, then the menu) can never land in the wrong order. */
  var latest = null, writing = false, again = false;
  function persist() {
    if (writing) { again = true; return; }
    writing = true;
    TSI.store.fresh(PREFS, null).then(function (p) {
      p = p && typeof p === 'object' ? JSON.parse(JSON.stringify(p)) : {};
      p.scVolume = latest.volume; p.scMuted = latest.muted; p.scMood = latest.mood;
      TSI.store.set(PREFS, p);
    }, function () { /* the choice still reaches the TV */ }).then(function () { writing = false; if (again) { again = false; persist(); } });
  }
  /* Keep the choices in the Explorer's prefs (read fresh, so nothing else in them is lost) and tell the playing window. */
  function setMix(mix) {
    mix = R().cleanMix(mix);
    var current = null;
    try { current = TSI.handoff.read('sound'); } catch (e) { current = null; }
    var auto = current && current.auto ? current.auto : null;
    latest = mix;
    persist();
    TSI.handoff.write('sound', R().pack(auto, mix));
    listeners.slice().forEach(function (fn) { try { fn(mix); } catch (e) { TSI.reportError(e, 'the Sound control'); } });
  }

  function statusNow() { var s = TSI.handoff.read('soundstatus'); return s && !s.closed && Date.now() - Number(s.at) < 6 * 3600 * 1000 ? s : null; }

  function close() {
    if (timer) { clearInterval(timer); timer = null; }
    if (pop) { pop.remove(); pop = null; }
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
    var b = document.querySelector('[data-test=soundscape]');
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  function onKey(e) { if (e.key === 'Escape' && pop) { close(); var b = document.querySelector('[data-test=soundscape]'); if (b) b.focus(); } }
  function onOutside(e) { if (pop && !pop.contains(e.target) && !(e.target.closest && e.target.closest('[data-test=soundscape]'))) close(); }

  function open(button) {
    var mix = readMix();
    var vol = el('input', { type: 'range', min: '0', max: '100', step: '1', class: 'tsi-sound__vol', 'aria-label': 'Sound volume', 'data-test': 'sc-volume' });
    vol.value = String(Math.round(mix.volume * 100));
    var volText = el('span', { class: 'tsi-sound__volnum', 'data-test': 'sc-volume-text', text: vol.value + '%' });
    var mute = el('button', { type: 'button', class: 'tsi-btn tsi-btn--small', 'aria-pressed': mix.muted ? 'true' : 'false', 'data-test': 'sc-mute' }, mix.muted ? 'Unmute' : 'Mute');
    var mood = el('select', { class: 'tsi-input tsi-sound__mood', 'aria-label': 'Mood', 'data-test': 'sc-mood' }, [el('option', { value: '', text: 'Off (automatic)' })].concat(
      R().moodChoices().map(function (m) { return el('option', { value: m.id, text: m.label }); })));
    /* A mood set by a {sound: id} cue may be any bed: keep it in the menu so it shows. */
    if (mix.mood && !R().moodChoices().some(function (m) { return m.id === mix.mood; })) mood.appendChild(el('option', { value: mix.mood, text: R().label(mix.mood) }));
    mood.value = mix.mood;
    var now = el('p', { class: 'tsi-sound__now', role: 'status', 'data-test': 'sc-now' });
    function show() {
      var v = R().unpack(TSI.handoff.read('sound'));
      var m = readMix();
      var layers = v ? R().layers(v.auto, m, null, []) : [];
      var st = statusNow();
      now.textContent = (m.muted ? 'Muted. ' : '') + R().nowPlaying(v ? layers : [], st || null);
    }
    function change() {
      var m = { volume: Number(vol.value) / 100, muted: mute.getAttribute('aria-pressed') === 'true', mood: mood.value };
      volText.textContent = vol.value + '%';
      setMix(m); show();
    }
    vol.addEventListener('input', change);
    mood.addEventListener('change', change);
    mute.addEventListener('click', function () {
      var on = mute.getAttribute('aria-pressed') !== 'true';
      mute.setAttribute('aria-pressed', on ? 'true' : 'false');
      mute.textContent = on ? 'Unmute' : 'Mute';
      change();
    });
    pop = el('div', { class: 'tsi-sound', role: 'dialog', 'aria-label': 'Soundscape', 'data-test': 'sc-panel' }, [
      el('h2', { class: 'tsi-sound__title', text: 'Soundscape' }),
      el('div', { class: 'tsi-sound__row' }, [el('label', { class: 'tsi-sound__label' }, 'Volume'), vol, volText]),
      el('div', { class: 'tsi-sound__row' }, [mute]),
      el('div', { class: 'tsi-sound__row' }, [el('label', { class: 'tsi-sound__label' }, 'Mood'), mood]),
      now,
      el('p', { class: 'tsi-sound__hint', text: 'The background sound follows the table by itself and plays from the Player View on the TV. The mood plays over it until set back to Off.' })
    ]);
    document.body.appendChild(pop);
    button.setAttribute('aria-expanded', 'true');
    show();
    timer = setInterval(show, 1000);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onOutside, true);
    vol.focus();
  }

  TSI.soundControl = {
    readMix: readMix,
    setMix: setMix,
    onMix: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    close: close,
    button: function () {
      var b = el('button', { type: 'button', class: 'tsi-btn tsi-btn--small', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-test': 'soundscape', title: 'The background sound: volume, mute and mood' }, 'Soundscape');
      b.addEventListener('click', function () { if (pop) close(); else open(b); });
      return b;
    }
  };
}());
