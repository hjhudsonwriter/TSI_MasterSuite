/* The Scarlett Isles Explorer: town banners and quest markers, as plain functions (guide 6A, 4 November 2026).

   Two things drawn on top of the map, neither of which changes movement, fog, events, camp or the Bastion:

   TOWN BANNERS. Every town pin that shows gets a parchment nameplate with its ruling clan's shield and its name. Which
   clan is in data/town-clans.js (one clan id, or null for a plain nameplate); the DM can change a town in play, and the
   choice is saved (tsi.explorer.townclans = { version: 1, overrides: { <pin id>: <clan id or null> } }) on top of that file.

   QUEST MARKERS. Gold "!" markers the DM places by hand on a map (tsi.explorer.markers = { version: 1, markers: [...] }).
   A marker is { id, mapId, x, y, label, note, source } with x and y as fractions of its map's width and height, so it stays
   where it was whatever size the map is shown at. label and note are for the DM only: the players' snapshot carries just
   id, mapId, x and y (P.snapshot). shown (guide 6B follow-up, 4 November 2026) is the DM's "Show to players" tick: it only decides whether the marker is sent at all in land the party has not explored. source is spare and always '' for now (so a later guide can add markers from the
   Notice Board without a migration).

   Whether a pin (and so its banner) shows is decided in one place, R.isPinVisible in rules.js; guide 6B changes the rule there. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.explorer = TSI.explorer || {};
  var P = ns.pins = ns.pins || {};

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v, max) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
  function clamp01(v) { v = Number(v); return isFinite(v) ? Math.min(1, Math.max(0, v)) : 0; }

  /* ---------- Town clans ---------- */
  P.clanIds = function (shields) { return Object.keys(isObj(shields) ? shields : {}); };
  P.emptyTownClans = function () { return { version: 1, overrides: {} }; };
  /* Is this a saved record of the right shape? (null is a plain nameplate, so it is a valid choice.) */
  P.isTownClans = function (v) {
    if (!isObj(v) || v.version !== 1 || !isObj(v.overrides)) return false;
    return Object.keys(v.overrides).every(function (k) { return v.overrides[k] === null || typeof v.overrides[k] === 'string'; });
  };
  /* A tidy copy: only ids that are known clans (or null), and only 200 towns at most. */
  P.cleanTownClans = function (v, shields) {
    var out = P.emptyTownClans();
    if (!P.isTownClans(v)) return out;
    var ids = P.clanIds(shields);
    Object.keys(v.overrides).slice(0, 200).forEach(function (k) {
      var c = v.overrides[k];
      if (typeof k === 'string' && k && k.length <= 80 && (c === null || ids.indexOf(c) !== -1)) out.overrides[k] = c;
    });
    return out;
  };
  /* The clan a town shows: the DM's choice if there is one (even None), else the seed, else none. A clan that is not a known
     clan (a damaged file) shows as none. */
  P.clanFor = function (tc, seeds, shields, pinId) {
    var ids = P.clanIds(shields);
    var pick = null;
    if (isObj(tc) && isObj(tc.overrides) && Object.prototype.hasOwnProperty.call(tc.overrides, pinId)) pick = tc.overrides[pinId];
    else if (isObj(seeds) && Object.prototype.hasOwnProperty.call(seeds, pinId)) pick = seeds[pinId];
    return typeof pick === 'string' && ids.indexOf(pick) !== -1 ? pick : null;
  };
  /* The DM changes a town: clanId is a clan id, or null for a plain nameplate. If it is the same as the seed's, the override is
     dropped, so the file stays as small as the changes. Returns true when something changed. */
  P.setClan = function (tc, seeds, shields, pinId, clanId) {
    if (!isObj(tc) || !isObj(tc.overrides) || typeof pinId !== 'string' || !pinId) return false;
    var ids = P.clanIds(shields);
    if (clanId !== null && ids.indexOf(clanId) === -1) return false;
    var before = P.clanFor(tc, seeds, shields, pinId);
    var seed = isObj(seeds) && Object.prototype.hasOwnProperty.call(seeds, pinId) && ids.indexOf(seeds[pinId]) !== -1 ? seeds[pinId] : null;
    if (clanId === seed) delete tc.overrides[pinId]; else tc.overrides[pinId] = clanId;
    return P.clanFor(tc, seeds, shields, pinId) !== before;
  };
  P.clearClan = function (tc, pinId) {
    if (!isObj(tc) || !isObj(tc.overrides) || !Object.prototype.hasOwnProperty.call(tc.overrides, pinId)) return false;
    delete tc.overrides[pinId];
    return true;
  };
  /* What a banner shows: { clan, name, banner } (clan null: a plain nameplate). */
  P.bannerFor = function (tc, seeds, shields, pinId) {
    var clan = P.clanFor(tc, seeds, shields, pinId);
    var sh = clan ? shields[clan] : null;
    return { clan: clan, clanName: sh ? String(sh.name || '') : '', banner: sh ? String(sh.bannerImage || '') : '' };
  };

  /* Where each banner goes. items: [{ id, x, y, w, h }] with x, y the pin's tip in screen pixels and w, h the banner's size. A
     banner sits centred just under its pin's tip; when two overlap, the lower one is pushed down until they do not. Returns
     { id: { dx, dy } } offsets from the usual spot. */
  P.nudgeBanners = function (items, gap) {
    gap = typeof gap === 'number' ? gap : 3;
    var placed = [];
    var out = {};
    items.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; }).forEach(function (it) {
      var left = it.x - it.w / 2, top = it.y + 4, dy = 0;
      for (var guard = 0; guard < 30; guard++) {
        var hit = placed.filter(function (p) { return left < p.left + p.w && p.left < left + it.w && top + dy < p.top + p.h && p.top < top + dy + it.h; })[0];
        if (!hit) break;
        dy = hit.top + hit.h + gap - top;
      }
      placed.push({ left: left, top: top + dy, w: it.w, h: it.h });
      out[it.id] = { dx: 0, dy: dy };
    });
    return out;
  };

  /* ---------- Quest markers ---------- */
  P.NOTE_MAX = 300;
  P.LABEL_MAX = 60;
  P.MARKERS_MAX = 300;
  P.emptyMarkers = function () { return { version: 1, markers: [] }; };
  function cleanMarker(m) {
    if (!isObj(m) || typeof m.id !== 'string' || !m.id || typeof m.mapId !== 'string' || !m.mapId) return null;
    return { id: m.id.slice(0, 60), mapId: m.mapId.slice(0, 120), x: clamp01(m.x), y: clamp01(m.y), label: str(m.label, P.LABEL_MAX), note: typeof m.note === 'string' ? m.note.slice(0, P.NOTE_MAX) : '', shown: m.shown === true, source: '' };
  }
  P.isMarkers = function (v) { return isObj(v) && v.version === 1 && Array.isArray(v.markers); };
  /* A tidy copy: a bad entry is dropped, positions are held between 0 and 1, text is cut to length, ids are kept unique. */
  P.cleanMarkers = function (v) {
    var out = P.emptyMarkers();
    if (!P.isMarkers(v)) return out;
    var seen = {};
    v.markers.forEach(function (m) {
      var c = cleanMarker(m);
      if (c && !seen[c.id] && out.markers.length < P.MARKERS_MAX) { seen[c.id] = true; out.markers.push(c); }
    });
    return out;
  };
  /* A new id that no marker has, e.g. "qm-1". */
  P.newMarkerId = function (mk) {
    var n = mk.markers.length + 1;
    var used = {};
    mk.markers.forEach(function (m) { used[m.id] = true; });
    while (used['qm-' + n]) n++;
    return 'qm-' + n;
  };
  P.markersForMap = function (mk, mapId) { return mk.markers.filter(function (m) { return m.mapId === mapId; }); };
  P.markerById = function (mk, id) { return mk.markers.filter(function (m) { return m.id === id; })[0] || null; };
  /* Drop a marker: returns it, or null when there is no map or the list is full. */
  P.addMarker = function (mk, mapId, x, y) {
    if (typeof mapId !== 'string' || !mapId || mapId === 'none' || mk.markers.length >= P.MARKERS_MAX) return null;
    var m = { id: P.newMarkerId(mk), mapId: mapId, x: clamp01(x), y: clamp01(y), label: '', note: '', shown: false, source: '' };
    mk.markers.push(m);
    return m;
  };
  /* shown (optional): true shows the marker to the players even in land they have not explored; leave it out to keep it as it is. */
  P.editMarker = function (mk, id, label, note, shown) {
    var m = P.markerById(mk, id);
    if (!m) return false;
    if (typeof shown === 'boolean') m.shown = shown;
    m.label = str(label, P.LABEL_MAX);
    m.note = typeof note === 'string' ? note.replace(/\r\n/g, '\n').slice(0, P.NOTE_MAX) : '';
    return true;
  };
  P.moveMarker = function (mk, id, x, y) {
    var m = P.markerById(mk, id);
    if (!m) return false;
    m.x = clamp01(x); m.y = clamp01(y);
    return true;
  };
  P.removeMarker = function (mk, id) {
    var n = mk.markers.length;
    mk.markers = mk.markers.filter(function (m) { return m.id !== id; });
    return mk.markers.length !== n;
  };
  /* What the players are sent: id, mapId, x and y, and nothing else. The label and note can never reach them. */
  P.snapshot = function (mk, mapId) {
    return P.markersForMap(mk, mapId).map(function (m) { return { id: m.id, mapId: m.mapId, x: m.x, y: m.y }; });
  };
}());
