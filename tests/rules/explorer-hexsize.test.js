/* Each map keeps its own hex size; the "miles across" setting; the lock. */
(function () {
  'use strict';
  var R = TSI.explorer.rules;
  var data = window.TSI_DATA.explorer;
  {
    test('a map\'s hex size comes back when the map is opened again', function (t) {
      var s = R.defaultState(data);
      R.loadPreset(s, data, 'midland_province');
      s.grid.r = 52; s.grid.offsetX = 4; R.rememberGrid(s);
      R.loadPreset(s, data, 'the_east_isle');
      t.equal(s.grid.r, 38, 'a map not opened before starts at the usual size');
      s.grid.r = 90; R.rememberGrid(s);
      R.loadPreset(s, data, 'midland_province');
      t.equal(s.grid.r, 52); t.equal(s.grid.offsetX, 4);
      R.loadPreset(s, data, 'the_east_isle');
      t.equal(s.grid.r, 90);
    });
    test('a map with miles across: one hex is 6 miles', function (t) {
      var s = R.defaultState(data);
      R.loadPreset(s, data, 'midland_province');
      var res = R.calibrate(s, 300);
      t.ok(res.ok);
      t.equal(R.milesAcross(s.grid), 300);
      t.equal(s.gridByMap['preset:midland_province'].r, s.grid.r);
      t.ok(!R.calibrate(s, 5).ok, 'too small is refused');
      t.ok(!R.calibrate(s, 'abc').ok);
      t.equal(R.calibrate(s, 5000).reason, 'range');
    });
    test('locked sizes refuse to change, and the lock is kept per map and in saves', function (t) {
      var s = R.defaultState(data);
      R.loadPreset(s, data, 'midland_province');
      R.calibrate(s, 240); s.grid.locked = true; R.rememberGrid(s);
      var r = s.grid.r;
      t.equal(R.calibrate(s, 120).reason, 'locked');
      t.equal(s.grid.r, r);
      var back = R.fromSave(JSON.parse(JSON.stringify(R.toSave(s))), data);
      t.equal(back.grid.locked, true); t.equal(back.grid.r, r);
      R.loadPreset(back, data, 'the_east_isle');
      t.equal(back.grid.locked, false, 'another map is not locked');
      R.loadPreset(back, data, 'midland_province');
      t.equal(back.grid.locked, true);
    });
    test('an older save (one grid) is filed under the open map; damaged entries are ignored', function (t) {
      var old = R.toSave(R.defaultState(data));
      delete old.gridByMap; old.mapPresetId = 'midland_province'; old.grid.r = 61;
      var s = R.fromSave(old, data);
      t.equal(s.gridByMap['preset:midland_province'].r, 61);
      old.gridByMap = { 'preset:midland_province': 'junk', 'nonsense': { r: 5 } };
      var s2 = R.fromSave(old, data);
      t.equal(s2.grid.r, 61);
    });
  }
})();
