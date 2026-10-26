/* The Scarlett Isles Explorer: the Player View's snapshot, as a plain function (no screen code).

   The Player View is a second window the DM drags to the TV. It is view-only and is sent a SNAPSHOT: a small picture
   of what the players may see, built here from the Explorer's state. It is never sent the save. Everything the
   players may see is listed in R.playerSnapshot; anything not listed cannot reach the TV, and
   tests/rules/player-view-explorer.test.js proves the notes, the Travel bags, the journey log, the effects and threads,
   the Ironbow parcels and the DM doc do not leak.

   "The same view" (Harry, 26 October 2026): the Explorer always shows the WHOLE map, fitted into the window and
   centred (R.view). It has no pan or zoom of its own. So the players' window fits the same whole board into its own
   shape, centred, with dark margins where the shapes differ, and the two show the same region whatever the screens.
   Every position below is in BOARD units (R.board: 1440 wide), so it is the same on any screen.

   A snapshot holds only plain strings, numbers, true/false and lists:
   {
     v: 1, day, miles, limit, gold,         the slim row: Day, Daily Travel (miles out of the daily limit), Gold
     board: { w, h },
     map: { kind: 'preset' | 'upload' | 'none', src, key },   src is a path inside the suite (preset only); an upload is
                                                              sent once, apart from the snapshot, and kept by key
     weather: a video's path or null,
     grid: { enabled, r, offsetX, offsetY, opacity },
     fog: { enabled, hexes: ['q,r', ...] },     the uncovered hexes
     markers: [{ id, label, thumb, x, y }],     the town pins showing (x and y are fractions of the board)
     tokens: [{ id, name, initial, size, x, y }]   the heroes, as drawn: top-left corner in board units
   } */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.explorer = TSI.explorer || {};
  var R = ns.rules;

  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : ''; }
  function num(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }

  R.playerSnapshot = function (s, data) {
    var limit = R.dayLimit(s);
    /* The heroes always move together: one figure for the party, the furthest any hero has gone today. */
    var used = 0;
    s.tokens.forEach(function (t) { used = Math.max(used, R.milesShown(t, limit)); });
    var board = R.board(R.aspect(s, data));

    var preset = s.mapPresetId ? R.preset(data, s.mapPresetId) : null;
    var map = { kind: 'none', src: '', key: '' };
    if (preset) map = { kind: 'preset', src: str(preset.src, 300), key: R.mapKey(s) };
    else if (s.mapUploadKey) map = { kind: 'upload', src: '', key: R.mapKey(s) };

    /* Today's weather video, read without clearing anything (R.currentWeather would tidy the save). */
    var aw = s.travel && s.travel.activeWeather;
    var weather = aw && Number(aw.day) === (Number(s.travel.day) || 1) && data.weatherVideos[aw.kind] ? str(data.weatherVideos[aw.kind], 300) : null;

    var fogOn = !!(s.fog && s.fog.enabled);
    var hexes = [];
    if (fogOn) {
      var store = (s.fog.revealedByMapKey || {})[R.mapKey(s)] || {};
      hexes = Object.keys(store).filter(function (k) { return store[k]; });
    }

    var spots = R.layoutTokens(s, board, null);
    return {
      v: 1,
      day: Math.max(1, Math.floor(num(Number(s.travel.day), 1)) || 1),
      miles: used,
      limit: limit,
      gold: num(Number(s.journey && s.journey.gold), 0) || 0,
      board: { w: board.w, h: board.h },
      map: map,
      weather: weather,
      grid: { enabled: !!s.grid.enabled, r: num(Number(s.grid.r), 38), offsetX: num(Number(s.grid.offsetX), 0), offsetY: num(Number(s.grid.offsetY), 0), opacity: R.gridOpacity(s.grid) },
      fog: { enabled: fogOn, hexes: hexes },
      markers: R.visibleMarkers(s, data, board).map(function (m) {
        return { id: str(m.id, 80), label: str(m.label, 120), thumb: str(m.thumb, 300), x: num(Number(m.x), 0), y: num(Number(m.y), 0) };
      }),
      tokens: s.tokens.map(function (t) {
        var spot = spots[t.id] || { x: 0, y: 0 };
        return { id: str(t.id, 60), name: str(t.name, 80), initial: str(t.initial, 4), size: num(Number(t.size), 46), x: spot.x, y: spot.y };
      })
    };
  };
}());
