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
     tokens: [{ id, name, initial, size, x, y }],  the heroes, as drawn: top-left corner in board units
     pin: { id, label, image, description } or null,   the town pin card the DM has open: only what the card itself shows
                                                    (its name, picture and description); never the Port Charter or
                                                    Courier boxes, which are the DM's
     view: { x0, y0, x1, y1 },              the part of the map the DM's window shows, as fractions of the map (0 to 1); the whole
                                          map (0, 0, 1, 1) when the DM has not zoomed. The players' window fits that region
                                          into its own shape, centred (R.regionView), so both show the same part of the map.
     atlas: true/false,                    the DM has chosen to show the players the picture of the Scarlett Isles (their window opens its map panel)
     dim: 'none' | 'night' | 'event',     'event' while a campfire event is open in the DM's window: the map stays very dark
     camp: n                               how many times the DM has made camp; each new number fades the map out and in once
     scene: null | { kind: 'image' | 'video' | 'portrait', src, poster, loop, name, caption, overlays, subtitle }
                                          the one scene card the DM is showing (the Absent Tide decks): the map fades to black and the card
                                          fills the window. Only what is on screen: never the DM's note, the voice line (unless the card
                                          switches its subtitle on, when subtitle holds the text; otherwise it is ''), the other cards or
                                          the step list. overlays: [{ text, x, y, w, size, rotate, align }], x, y and w in percent of the
                                          picture, size in percent of its width.
   } */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.explorer = TSI.explorer || {};
  var R = ns.rules;

  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : ''; }
  function num(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }

  /* A scene card, cleaned: exactly the fields the players may see, each trimmed to a sane size, or null. */
  R.cleanScene = function (raw) {
    if (!raw || typeof raw !== 'object') return null;
    var kind = raw.kind === 'video' || raw.kind === 'portrait' ? raw.kind : 'image';
    var src = str(raw.src, 300);
    if (!src) return null;
    var overlays = (Array.isArray(raw.overlays) ? raw.overlays : []).slice(0, 8).map(function (o) {
      o = o && typeof o === 'object' ? o : {};
      return {
        text: str(o.text, 400),
        x: num(Number(o.x), 50), y: num(Number(o.y), 50), w: num(Number(o.w), 40),
        size: num(Number(o.size), 3), rotate: num(Number(o.rotate), 0),
        align: o.align === 'left' || o.align === 'right' ? o.align : 'center'
      };
    }).filter(function (o) { return o.text; });
    return {
      kind: kind, src: src, poster: str(raw.poster, 300), loop: raw.loop === true,
      name: str(raw.name, 80), caption: str(raw.caption, 200), overlays: overlays, subtitle: str(raw.subtitle, 400)
    };
  };

  /* extras: { atlas: true to show the Scarlett Isles map panel, view: the DM's visible region ({ x0, y0, x1, y1 }) or none, pin: a marker's id or null, dim: 'none' | 'night' | 'event', camp: a whole number, scene: a scene card (see R.cleanScene) or null }. */
  R.playerSnapshot = function (s, data, extras) {
    extras = extras && typeof extras === 'object' ? extras : {};
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

    /* The open pin card: looked up in the data by id, so only the card's own fields can be sent. */
    var pin = null;
    if (typeof extras.pin === 'string' && extras.pin) {
      var list = (data.markersByMapId && data.markersByMapId[s.mapPresetId || '']) || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === extras.pin) {
          pin = { id: str(list[i].id, 80), label: str(list[i].label, 120), image: str(list[i].submapImage, 300), description: str(list[i].description == null ? '' : String(list[i].description), 4000) };
          break;
        }
      }
    }
    var vr = extras.view && typeof extras.view === 'object' ? extras.view : {};
    var view = { x0: 0, y0: 0, x1: 1, y1: 1 };
    var ok = ['x0', 'y0', 'x1', 'y1'].every(function (k) { return typeof vr[k] === 'number' && isFinite(vr[k]) && vr[k] >= 0 && vr[k] <= 1; });
    if (ok && vr.x1 - vr.x0 > 0.0005 && vr.y1 - vr.y0 > 0.0005) view = { x0: vr.x0, y0: vr.y0, x1: vr.x1, y1: vr.y1 };
    var dim = extras.dim === 'event' || extras.dim === 'night' ? extras.dim : 'none';
    var camp = typeof extras.camp === 'number' && isFinite(extras.camp) && extras.camp > 0 ? Math.floor(extras.camp) : 0;

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
      }),
      pin: pin,
      view: view,
      atlas: extras.atlas === true,
      dim: dim,
      camp: camp,
      scene: R.cleanScene(extras.scene)
    };
  };
}());
