/* Scarlett Isles Explorer: the sound effects' plain rules (tools/explorer/sfx.js; 30 October 2026). */
(function () {
  var S = TSI.explorer.sfx;
  var C = window.TSI_DATA.explorerSfx;

  test('only rain and storm weather have a sound', function (t) {
    t.equal(S.weatherSound('rain'), 'rain');
    t.equal(S.weatherSound('storm'), 'storm');
    t.equal(S.weatherSound('blizzard'), null);
    t.equal(S.weatherSound('sun_heat'), null);
    t.equal(S.weatherSound(null), null);
  });

  test('the campfire is on through the fade, and while a campfire event is open', function (t) {
    var camp = { fadeEnd: 5000, holds: 0 };
    t.equal(S.campOn(camp, 1000), true, 'during the fade');
    t.equal(S.campOn(camp, 5000), false, 'fade over');
    camp.holds = 1;
    t.equal(S.campOn(camp, 9000), true, 'a campfire event is open');
    camp.holds = 0;
    t.equal(S.campOn(camp, 9000), false, 'and finished');
    t.equal(S.campOn(null, 0), false);
  });

  test('the saved settings are tidied: on unless switched off, volume kept between 0 and 1', function (t) {
    t.same(S.cleanSettings(null), { on: true, volume: 0.8 });
    t.same(S.cleanSettings({ on: false, volume: 0.3 }), { on: false, volume: 0.3 });
    t.same(S.cleanSettings({ on: 'x', volume: 7 }), { on: true, volume: 1 });
    t.same(S.cleanSettings({ volume: 'loud' }), { on: true, volume: 0.8 });
  });

  test('how loud: the slider times the sound\'s own volume, and nothing when off', function (t) {
    t.equal(S.level({ on: true, volume: 0.5 }, { volume: 0.6 }), 0.3);
    t.equal(S.level({ on: false, volume: 0.5 }, { volume: 0.6 }), 0);
    t.equal(S.level({ on: true, volume: 1 }, { volume: 2 }), 1);
  });

  test('Harry\'s six clips are listed: footsteps, campfire and the weather loop; the wing flap and the caw play once', function (t) {
    t.same(Object.keys(C.sounds).sort(), ['campfire', 'footsteps', 'rain', 'raven', 'storm', 'wingflap']);
    t.same(C.groups.word.sounds, ['wingflap', 'raven'], 'the Ironbow\'s message is the wing flap and the caw together');
    t.same(['footsteps', 'campfire', 'rain', 'storm'].map(function (n) { return C.sounds[n].loop; }), [true, true, true, true]);
    t.equal(C.sounds.raven.loop, false); t.equal(C.sounds.wingflap.loop, false);
    t.equal(C.campFadeMs, 4000);
    Object.keys(C.sounds).forEach(function (n) { t.ok(/^[a-z-]+\.mp3$/.test(C.sounds[n].file) && C.sounds[n].volume > 0 && C.sounds[n].volume <= 1, n); });
  });

  var R = TSI.explorer.rules;
  test('the DM\'s settings are tidied: unknown or wrong-typed values fall back to the defaults', function (t) {
    t.same(R.cleanPrefs(null), { sfxOn: true, sfxVolume: 0.8, autoplayVoice: true, clickMove: true, showCursor: true, showReach: true, showTerrain: false });
    t.same(R.cleanPrefs({ sfxOn: false, sfxVolume: 9, showReach: 'yes', showTerrain: true, junk: 1 }), { sfxOn: false, sfxVolume: 1, autoplayVoice: true, clickMove: true, showCursor: true, showReach: true, showTerrain: true });
    t.same(R.cleanPrefs('x'), R.defaultPrefs());
  });
}());