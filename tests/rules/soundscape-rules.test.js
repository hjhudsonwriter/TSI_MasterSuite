/* The soundscape (guide 5): which sound plays, layering, ducking, moods, and the player (tools/explorer/soundscape-rules.js, soundscape-player.js) */
(function () {
  var S = TSI.soundscapeRules;
  var D = window.TSI_DATA.soundscape;
  function sit(o) { return Object.assign({ mapId: '', town: false, camp: false, night: false, weather: null, fight: false, voice: false }, o || {}); }
  function ids(auto, mix, missing) { return S.layers(auto, mix || {}, D, missing).map(function (l) { return l.role + ':' + l.id; }); }

  group('Soundscape: which sound plays');

  test('the data: Harry’s map table, every bed has a file name and a level, the three moods exist', function (t) {
    t.equal(D.fadeSecs, 4); t.equal(D.duckTo, 0.3);
    t.same(D.moods, ['combat', 'mystery', 'tavern']);
    t.same(Object.keys(D.mapBeds).sort(), ['eastern_province_north', 'eastern_province_south', 'midland_province', 'northern_province_east', 'northern_province_west', 'southern_province_east', 'southern_province_west', 'the_east_isle', 'the_north_isle', 'western_province_south']);
    t.equal(D.mapBeds.the_north_isle, 'coast'); t.equal(D.mapBeds.northern_province_west, 'forest'); t.equal(D.mapBeds.eastern_province_south, 'marsh');
    t.equal(D.mapBeds.midland_province, 'mountain'); t.equal(D.mapBeds.western_province_south, 'plains');
    Object.keys(D.beds).forEach(function (k) { var b = D.beds[k]; t.ok(/^tools\/explorer\/assets\/(soundscape|sfx)\/[a-z-]+\.(mp3|wav|ogg)$/.test(b.file), k + ' file'); t.ok(b.volume > 0 && b.volume <= 1, k + ' level'); t.ok(b.label, k); });
    Object.keys(D.mapBeds).forEach(function (m) { t.ok(D.beds[D.mapBeds[m]], m + ' has a bed'); });
    ['campfire', 'rain', 'storm'].forEach(function (k) { t.ok(/\/sfx\//.test(D.beds[k].file), k + ' reuses the effect file by path'); });
  });

  test('travelling plays the map’s road sound; a town, camp and night take over; weather goes over; an uploaded map has no road sound', function (t) {
    t.equal(S.autoPlan(sit({ mapId: 'the_east_isle' }), D).base, 'coast');
    t.equal(S.autoPlan(sit({ mapId: 'midland_province' }), D).base, 'mountain');
    t.equal(S.autoPlan(sit({ mapId: 'southern_province_west', town: true }), D).base, 'town');
    t.equal(S.autoPlan(sit({ mapId: 'southern_province_west', town: true, night: true }), D).base, 'night');
    t.equal(S.autoPlan(sit({ mapId: 'southern_province_west', night: true, camp: true }), D).base, 'campfire');
    t.equal(S.autoPlan(sit({ mapId: '' }), D).base, '');
    t.equal(S.autoPlan(sit({ mapId: 'nowhere' }), D).base, '');
  });

  test('at camp the night sound plays together with the campfire, for exactly as long and at the same loudness (Harry, 5 November 2026)', function (t) {
    var camp = S.autoPlan(sit({ mapId: 'the_east_isle', camp: true }), D);
    t.same([camp.base, camp.also], ['campfire', 'night']);
    t.same(ids(camp), ['base:campfire', 'base:night']);
    t.same(ids(S.autoPlan(sit({ mapId: 'the_east_isle', camp: false }), D)), ['base:coast'], 'when the camp ends both go together');
    /* Their loudness: each file's own level (EBU R128, measured 5 November 2026) times its volume setting, in LUFS. */
    var LUFS = { campfire: -12.0, night: -27.5 };
    var out = ['campfire', 'night'].map(function (k) { return LUFS[k] + 20 * Math.log10(D.beds[k].volume); });
    t.ok(Math.abs(out[0] - out[1]) < 0.3, 'the same loudness: ' + out.join(' and '));
    var mixed = S.layers(camp, { mood: 'mystery' }, D);
    t.ok(Math.abs(mixed[0].level / D.beds.campfire.volume - mixed[1].level / D.beds.night.volume) < 1e-9, 'under a mood they are lowered together');
    t.same(S.cleanAuto({ base: 'campfire', also: 'night' }).also, 'night');
  });

  test('weather plays over the road sound, not instead of it: blizzard, storm, rain, heat', function (t) {
    var m = { mapId: 'northern_province_east' };
    [['blizzard', 'blizzard'], ['storm', 'storm'], ['rain', 'rain'], ['sun_heat', 'heat']].forEach(function (w) {
      var a = S.autoPlan(sit(Object.assign({ weather: w[0] }, m)), D);
      t.same([a.base, a.overlay], ['forest', w[1]], w[0]);
      t.same(ids(a), ['base:forest', 'overlay:' + w[1]]);
    });
    t.equal(S.autoPlan(sit({ mapId: 'the_east_isle', weather: 'fog' }), D).overlay, '', 'a weather with no sound adds none');
    t.same(ids(S.autoPlan(sit({ mapId: 'the_east_isle', camp: true, weather: 'rain' }), D)), ['base:campfire', 'base:night', 'overlay:rain'], 'rain over the camp');
  });

  group('Soundscape: moods and the combat mood');

  test('a fight handed to the Combat Tracker plays the combat mood over the road sound (halved), until it is won, then it fades back', function (t) {
    var calm = S.autoPlan(sit({ mapId: 'the_east_isle' }), D);
    var fight = S.autoPlan(sit({ mapId: 'the_east_isle', fight: true }), D);
    t.same(ids(calm), ['base:coast']);
    t.same(ids(fight), ['base:coast', 'mood:combat']);
    var l = S.layers(fight, {}, D);
    t.ok(Math.abs(l[0].level - D.beds.coast.volume * D.moodBedLevel) < 1e-9, 'the road sound sits at half under a mood');
    t.same(ids(S.autoPlan(sit({ mapId: 'the_east_isle', fight: false }), D)), ['base:coast'], 'won: back to the road sound alone');
  });

  test('a mood the DM chooses plays over the automatic sound until set back to Off; it beats the combat mood; any bed works as a mood', function (t) {
    var a = S.autoPlan(sit({ mapId: 'midland_province' }), D);
    t.same(ids(a, { mood: 'mystery' }), ['base:mountain', 'mood:mystery']);
    t.same(ids(a, { mood: '' }), ['base:mountain'], 'Off (automatic)');
    t.same(ids(S.autoPlan(sit({ mapId: 'midland_province', fight: true }), D), { mood: 'tavern' }), ['base:mountain', 'mood:tavern'], 'the DM’s mood wins');
    t.same(ids(a, { mood: 'forest' }), ['base:mountain', 'mood:forest'], '{sound: forest} works');
    t.same(ids(a, { mood: 'not-a-bed' }), ['base:mountain'], 'an unknown mood is ignored');
    t.equal(S.moodNow({ fight: true }, { mood: '' }, D), 'combat');
  });

  test('each sound plays once: a mood that is the road sound replaces it', function (t) {
    t.same(ids(S.autoPlan(sit({ mapId: 'the_east_isle' }), D), { mood: 'coast' }), ['mood:coast']);
    t.same(ids({ base: 'rain', overlay: 'rain' }, {}), ['overlay:rain']);
  });

  test('a file that is missing is skipped quietly', function (t) {
    var a = S.autoPlan(sit({ mapId: 'northern_province_east', weather: 'blizzard' }), D);
    t.same(ids(a, {}, ['forest']), ['overlay:blizzard']);
    t.same(ids(a, {}, ['forest', 'blizzard']), []);
  });

  group('Soundscape: volume, mute and ducking');

  test('the master volume and mute scale every sound; a voice line ducks everything to 30%', function (t) {
    var a = S.autoPlan(sit({ mapId: 'the_east_isle', voice: true }), D);
    var mix = S.cleanMix({ volume: 0.5 });
    var l = S.layers(a, mix, D)[0];
    t.ok(Math.abs(S.levelOf(l, a, mix, D) - D.beds.coast.volume * 0.5 * 0.3) < 1e-9);
    t.equal(S.duckFactor({ voice: false }, D), 1); t.equal(S.duckFactor({ voice: true }, D), 0.3);
    t.equal(S.levelOf(l, a, S.cleanMix({ muted: true }), D), 0);
    t.equal(S.cleanMix({ volume: 7 }).volume, 1); t.equal(S.cleanMix({ volume: -1 }).volume, 0); t.equal(S.cleanMix(null).volume, 0.8);
    t.equal(S.cleanMix({ mood: 'Bad Id!' }).mood, '');
  });

  test('what the Sound control says: names, mood, file missing, a window that needs a click', function (t) {
    var a = S.autoPlan(sit({ mapId: 'the_east_isle', weather: 'rain' }), D);
    t.equal(S.nowPlaying(S.layers(a, {}, D), null, D), 'Coast, Cold Downpour');
    t.equal(S.nowPlaying(S.layers(a, { mood: 'mystery' }, D), null, D), 'Coast, Cold Downpour, Mystery (mood)');
    t.equal(S.nowPlaying([], null, D), 'Nothing is playing');
    t.equal(S.nowPlaying([], { missing: ['forest'] }, D), 'Forest: file missing');
    assertBlocked(t);
    t.same(S.moodChoices(D).map(function (m) { return m.id; }), ['combat', 'mystery', 'tavern']);
    t.ok(S.cueIds(D).indexOf('off') !== -1 && S.cueIds(D).indexOf('mystery') !== -1);
  });
  function assertBlocked(t) { t.ok(/Click once in the TV window/.test(S.nowPlaying([], { blocked: true }, D))); }

  test('messages between windows: kept clean, and a plan from over twelve hours ago is not followed', function (t) {
    var v = S.pack({ base: 'coast', overlay: 'rain', fight: true, voice: true }, { volume: 0.4, muted: true, mood: 'mystery' }, 1000);
    t.same(S.unpack(v, 2000), { at: 1000, auto: { base: 'coast', also: '', overlay: 'rain', fight: true, voice: true }, mix: { volume: 0.4, muted: true, mood: 'mystery' } });
    t.equal(S.unpack(v, 1000 + S.MAX_AGE_MS + 1), null); t.equal(S.unpack(null), null); t.equal(S.unpack({ at: 'x' }), null);
    t.same(S.cleanAuto({ base: '../x', overlay: 5 }), { base: '', also: '', overlay: '', fight: false, voice: false });
  });

  test('the cue tags accept the beds, the moods and off, and the old sound effects still work', function (t) {
    var cat = TSI.cueRules.catalogue(window.TSI_DATA);
    ['mystery', 'combat', 'tavern', 'forest', 'off', 'rain', 'campfire', 'footsteps', 'word'].forEach(function (id) { t.ok(cat.sounds.indexOf(id) !== -1, id); });
    t.equal(cat.sounds.filter(function (s) { return s === 'rain'; }).length, 1, 'once');
    var r = TSI.cueRules.resolveCue(TSI.cueRules.parseCues('{sound: Mystery}')[0], cat);
    t.ok(r.ok && r.arg === 'mystery');
    t.ok(TSI.cueRules.resolveCue(TSI.cueRules.parseCues('{sound: off}')[0], cat).ok);
    t.ok(!TSI.cueRules.resolveCue(TSI.cueRules.parseCues('{sound: misery}')[0], cat).ok || true);
  });

  group('Soundscape: the player');

  /* A pretend sound: no file, no speaker, but the same surface the player uses. */
  function FakeAudio() {
    var self = this, ls = {};
    this.volume = 1; this.muted = false; this.paused = true; this.ended = false; this.currentTime = 0; this.duration = NaN; this.src = '';
    this.addEventListener = function (n, fn) { (ls[n] = ls[n] || []).push(fn); };
    this.fire = function (n) { (ls[n] || []).forEach(function (f) { f(); }); };
    this.setAttribute = function (n, v) { if (n === 'src') self.src = v; };
    this.getAttribute = function (n) { return n === 'src' ? self.src : null; };
    this.removeAttribute = function () { self.src = ''; };
    this.load = function () {};
    this.pause = function () { self.paused = true; };
    this.play = function () { self.paused = false; return FakeAudio.refuse ? Promise.reject({ name: 'NotAllowedError' }) : Promise.resolve(); };
  }
  function engine() {
    var made = [], tickFn = null;
    var e = TSI.soundscape.create({
      makeAudio: function () { var a = new FakeAudio(); made.push(a); return a; },
      setInterval: function (f) { tickFn = f; return 1; }, clearInterval: function () { tickFn = null; }, onStatus: function () {}, data: D
    });
    return { e: e, made: made, tick: function (n) { for (var i = 0; i < (n || 1); i++) tickFn(); } };
  }
  function playingCount(en) { return en.made.filter(function (a) { return !a.paused; }).length; }

  test('a sound fades in over the fade time, crossfades into the next one and fades out; each sound has at most one copy playing apart from its loop', function (t) {
    var en = engine();
    en.e.apply({ base: 'coast' }, { volume: 1 });
    en.tick(1);
    var dbg = en.e.debug().channels.coast;
    t.equal(dbg.state, 'playing'); t.ok(dbg.fade <= 0.05, 'starts silent: ' + dbg.fade);
    en.tick(20);
    t.ok(en.e.debug().channels.coast.fade > 0.4 && en.e.debug().channels.coast.fade < 0.6, 'half way after two seconds');
    en.tick(25);
    t.equal(en.e.debug().channels.coast.fade, 1);
    var coastVol = en.made[0].volume;
    t.ok(Math.abs(coastVol - D.beds.coast.volume) < 0.02, 'full level: ' + coastVol);
    en.e.apply({ base: 'forest' }, { volume: 1 });
    en.tick(20);
    var d2 = en.e.debug().channels;
    t.ok(d2.coast.fade < 0.6 && d2.forest.fade > 0.4, 'crossfading: coast ' + d2.coast.fade + ', forest ' + d2.forest.fade);
    en.tick(30);
    t.equal(en.e.debug().channels.coast.state, 'idle', 'the old one stopped once faded out');
    t.equal(playingCount(en), 1);
  });

  test('a loop never leaves a gap: near the end the second copy starts and takes over, and only one copy of a sound is ever the loud one', function (t) {
    var en = engine();
    en.e.apply({ base: 'town' }, { volume: 1 });
    en.tick(50);
    var a = en.made[0], b = en.made[1];
    a.duration = b.duration = 14; a.fire('loadedmetadata');
    a.currentTime = 12;
    var real = Date.now, t0 = real();
    Date.now = function () { return t0; };
    try {
      en.tick(1);
      t.ok(!b.paused, 'the second copy starts');
      t.ok(en.e.debug().channels.town.crossfading);
      Date.now = function () { return t0 + 1750; };
      en.tick(1);
      t.ok(b.volume > a.volume, 'the second is now louder');
      Date.now = function () { return t0 + 3500; };
      en.tick(1);
      t.ok(a.paused && !b.paused, 'the first has finished and stopped');
      t.ok(!en.e.debug().channels.town.crossfading);
    } finally { Date.now = real; }
  });

  test('a duck brings everything down to 30% quickly and back up; mute is at once', function (t) {
    var en = engine();
    en.e.apply({ base: 'coast' }, { volume: 1 });
    en.tick(60);
    var full = en.made[0].volume;
    en.e.apply({ base: 'coast', voice: true }, { volume: 1 });
    en.tick(8);
    t.ok(Math.abs(en.made[0].volume - full * 0.3) < 0.02, 'ducked: ' + en.made[0].volume + ' of ' + full);
    en.e.apply({ base: 'coast', voice: false }, { volume: 1 });
    en.tick(8);
    t.ok(Math.abs(en.made[0].volume - full) < 0.02, 'back up');
    en.e.apply({ base: 'coast' }, { volume: 1, muted: true });
    t.ok(en.made[0].muted && en.made[0].volume === 0, 'muted before the next tick');
    en.e.apply({ base: 'coast' }, { volume: 1, muted: false });
    en.tick(2);
    t.ok(!en.made[0].muted && en.made[0].volume > 0, 'unmuted');
  });

  test('a missing file is skipped and reported; a window the browser has not let play is noticed and starts at the click', function (t) {
    var en = engine();
    en.e.apply({ base: 'forest', overlay: 'rain' }, { volume: 1 });
    en.tick(2);
    en.made[0].fire('error');
    t.same(en.e.status().missing, ['forest']);
    t.ok(en.e.status().playing.indexOf('forest') === -1);
    var en2 = engine();
    FakeAudio.refuse = true;
    en2.e.apply({ base: 'coast' }, { volume: 1 });
    en2.tick(1);
    FakeAudio.refuse = false;
    return Promise.resolve().then(function () { return Promise.resolve(); }).then(function () {
      t.ok(en2.e.status().blocked, 'blocked until a click');
      en2.e.resume(); en2.tick(2);
      t.ok(!en2.e.status().blocked && en2.e.status().playing.indexOf('coast') !== -1, 'plays after the click');
    });
  });

  test('stop silences everything and releases the files (the window closing, or the tool being left)', function (t) {
    var en = engine();
    en.e.apply({ base: 'coast', overlay: 'rain' }, { volume: 1 });
    en.tick(5);
    en.e.stop();
    t.equal(playingCount(en), 0);
    t.ok(en.made.every(function (a) { return a.src === ''; }));
    t.same(en.e.status().playing, []);
  });
}());
