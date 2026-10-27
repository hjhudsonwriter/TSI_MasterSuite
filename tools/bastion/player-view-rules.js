/* The Ironbow Bastion Manager: the Player View's snapshot, as a plain function (no screen code).

   The Player View is a second window the DM drags to the TV. It is view-only, and it is sent a SNAPSHOT: a small
   picture of what the players may see, built here from the Bastion's state. It is never sent the save. Everything the
   players may see is listed in R.playerSnapshot below; anything not listed there cannot reach the TV, and
   tests/rules/player-view.test.js proves that the DM's notes, the Warehouse, clan scores, prisoners, creatures, the
   Beast Handler's codes and the rest do not leak.

   A snapshot holds only plain strings, numbers, true/false and lists (it crosses to the other window by postMessage):
   {
     v: 1, day, treasuryGP, facilityCount, orderCount, partyName,
     crest: { key, dataUrl } or null,
     overlays: [{ pic, facs, repair }],             the buildings painted over the map (R.mapOverlays)
     labels: [{ fac, name, level, single, x, y, repair, part? }],   the map's name-and-level labels (R.mapLabels)
     tiles: [{ row, kind, fac, name, level, single, repair, orders, daysLeft }],
                                                    the tray: kind is 'built', 'building', 'empty', 'locked' or 'picture'
     facilities: { id: { name, level, single, repair, orders: [names], staff?, gods? } },   built facilities
     ledger: true when the DM has chosen to show the open facility's ledger picture (false with no facility open)
     focus: a built facility's id, 'party_quarters', or null           the facility panel the DM has open
     focusView: 'routes' when the DM has the Dock's panel open on its Routes tab, else null
     routes: only with focusView 'routes' (R.playerRoutes): { charters: [{ port, label }], lanes: [{ port, sea }],
       boats: [{ key, port, phase, fraction, point: [x, y], label }], journeys: [{ port, line }], more }
   }
   facilities.workshop.staff is [{ id, name, level, open }]; facilities.temple.gods is [{ id, name, pct }] (0 to 100).
   The Prison Tower shows only a level, its pending orders' names and facilities.prison_tower.cells: one true or false
   for each cell that is in use (nothing about who is held). The Beast Pen adds
   facilities.beast_pen.beasts: [{ name, species, handler }] and more (a count), and nothing else about the beasts. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.bastion = TSI.bastion || {};
  var R = ns.rules;
  var clampInt = R.clampInt;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : ''; }
  function num(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }

  /* The Hall's panel is "diplomacy" and every other facility's is "fac-<id>" (tool.js). */
  /* The Party Quarters is not a facility, but the DM can open a panel for it and the players see its picture: the one id
     besides the built facilities' that a focus may name. */
  /* The most beasts the Beast Pen's panel lists (the rest are "and N more"). */
  R.PLAYER_BEAST_MAX = 8;
  R.PARTY_QUARTERS_ID = 'party_quarters';
  R.playerFocusOf = function (panelId) {
    if (panelId === R.PARTY_QUARTERS_ID) return panelId;
    if (panelId === 'diplomacy') return 'hall_of_emissaries';
    var m = /^fac-([a-z_]+)$/.exec(String(panelId || ''));
    return m ? m[1] : null;
  };

  /* The party level a slot (0 to 3) or a plot (0 to 5) opens at, or null. */
  function slotOpensAt(i) {
    for (var lvl = 1; lvl <= 20; lvl++) if (R.constructionSlotsForLevel(lvl) > i) return lvl;
    return null;
  }
  function plotOpensAt(i, data) {
    for (var lvl = 1; lvl <= 20; lvl++) if (R.plotsForLevel(lvl, data) > i) return lvl;
    return null;
  }

  /* The Dock's Routes view for the players: which routes are lit (a registered Port Charter), where each ship at sea is,
     and a line for each journey. Nothing else about the Dock reaches them: no gold, cargo, prices, risk, protections,
     sales or ship records. At most PLAYER_JOURNEY_MAX journeys are sent (the rest are counted in `more`). */
  R.PLAYER_JOURNEY_MAX = 12;
  R.playerRoutes = function (s, data) {
    var m = R.routesMap(s, data);
    var seen = {};
    var ships = R.voyages(s).filter(isObj);
    return {
      charters: R.registeredCharters(s).map(function (c) { return { port: str(c.port, 40), label: str(R.charterLabel(data, c), 120) }; }),
      lanes: m.lanes.map(function (l) { return { port: str(l.port, 40), sea: l.glow === 'sea' }; }),
      boats: m.boats.map(function (b) {
        seen[b.port] = (seen[b.port] || 0) + 1;
        return { key: str(b.port, 40) + '#' + seen[b.port], port: str(b.port, 40), phase: str(b.phase, 20), fraction: num(b.fraction, 0), point: [num(b.point[0], 0), num(b.point[1], 0)], label: str(b.label, 120) };
      }),
      journeys: ships.slice(0, R.PLAYER_JOURNEY_MAX).map(function (v) { return { port: str(v.port, 40), line: str(R.voyageState(v), 200) }; }),
      more: Math.max(0, ships.length - R.PLAYER_JOURNEY_MAX)
    };
  };

  /* extras: { crest: the Bastion's crest ({ key, dataUrl }) or null, focus: the open facility panel's id or null, ledger: true to show its ledger, view: 'routes' for the Dock's Routes tab }. */
  R.playerSnapshot = function (s, data, extras) {
    extras = isObj(extras) ? extras : {};
    var built = R.builtFacilityIds(s, data);
    var pending = arr(s.pendingOrders).filter(isObj);

    function info(id) {
      var f = R.facility(data, id);
      return {
        name: str((f && f.name) || id, 80),
        level: R.getFacilityLevel(s, id),
        single: !!(f && f.singleLevel),
        repair: R.underRepair(s, id) || 0,
        orders: pending.filter(function (o) { return o.facId === id; }).map(function (o) { return str(o.label, 160); })
      };
    }

    var facilities = {};
    built.forEach(function (id) {
      var f = info(id);
      if (id === 'workshop') {
        f.staff = R.workshopStaff(data).map(function (st) {
          return { id: str(st.id, 40), name: str(st.name, 40), level: clampInt(st.level, 1, R.MAX_LEVEL), open: f.level >= st.level };
        });
      }
      if (id === R.TEMPLE_ID) {
        f.gods = R.templeGods(data).map(function (g) {
          return { id: str(g.id, 20), name: str(g.name, 40), pct: R.templeBar(s, g.id) };
        });
      }
      /* The Beast Pen lists the beasts housed there: a name, the kind (not the variety) and the handler's name, nothing else. */
      if (id === R.PEN_ID) {
        var housed = R.penHoused(s).filter(isObj);
        f.beasts = housed.slice(0, R.PLAYER_BEAST_MAX).map(function (c) {
          var u = R.creatureUnique(data, c.id);
          var named = (typeof c.name === 'string' && c.name) || (u && (u.name || u.defaultName)) || '';
          var d = R.devView(s, c);
          return { name: str(named || R.speciesName(data, c.species), 60), species: str(R.speciesName(data, c.species), 40), handler: str(d && d.handlerId ? R.handlerName(d.handlerId) : '', 60) };
        });
        f.more = Math.max(0, housed.length - R.PLAYER_BEAST_MAX);
      }
      /* The Prison Tower's picture follows which cells hold someone: three yes/no answers, and nothing about who. */
      if (id === R.PRISON_ID) f.cells = R.prison(s, data).cells.map(function (c) { return !!c; });
      facilities[id] = f;
    });

    /* The tray: the starting facilities, the Party Quarters' picture, the construction slots, then the Development Plots. */
    var tiles = [];
    function builtTile(row, id) {
      var f = facilities[id] || info(id);
      return { row: row, kind: 'built', fac: id, name: f.name, level: f.level, single: f.single, repair: f.repair, orders: f.orders.length, daysLeft: 0 };
    }
    data.bastion.startingBuilt.forEach(function (id) { tiles.push(builtTile(1, id)); });
    arr(data.bastion.startTiles).forEach(function (t) {
      tiles.push({ row: 1, kind: 'picture', fac: str(t.id, 40), name: str(t.name, 80), level: 0, single: false, repair: 0, orders: 0, daysLeft: 0 });
    });
    function rowTiles(rows, count, kind) {
      for (var i = 0; i < Math.max(count, rows.rows.length); i++) {
        var row = rows.rows[i];
        var rowNo = kind === 'plot' ? 2 : 1;
        if (row && row.entry) {
          if (row.entry.status === 'building') {
            var bf = R.facility(data, row.entry.facId);
            tiles.push({ row: rowNo, kind: 'building', fac: str(row.entry.facId, 40), name: str((bf && bf.name) || row.entry.facId, 80), level: 0, single: false, repair: 0, orders: 0, daysLeft: R.buildDaysLeft(s, row.entry) });
          } else {
            tiles.push(builtTile(rowNo, row.entry.facId));
          }
        } else {
          var opens = kind === 'plot' ? plotOpensAt(i, data) : slotOpensAt(i);
          var free = s.partyLevel >= (opens || 99) && !!row && row.canBuild;
          tiles.push({ row: rowNo, kind: free ? 'empty' : 'locked', fac: '', name: '', level: 0, single: false, repair: 0, orders: 0, daysLeft: 0, plot: kind === 'plot' });
        }
      }
    }
    rowTiles(R.slotRows(s, s.partyLevel), R.constructionSlotsForLevel(20), 'slot');
    rowTiles(R.plotRows(s, s.partyLevel, data), R.plotsForLevel(20, data), 'plot');

    var crest = extras.crest;
    var focus = typeof extras.focus === 'string' && (facilities[extras.focus] || extras.focus === R.PARTY_QUARTERS_ID) ? extras.focus : null;
    var routesView = focus === 'dock' && extras.view === 'routes';
    return {
      v: 1,
      day: R.dayNum(s.day, 1),
      treasuryGP: num(s.treasuryGP, 0),
      facilityCount: built.length,
      orderCount: pending.length,
      partyName: str(s.partyName, 80),
      crest: isObj(crest) && typeof crest.dataUrl === 'string' && crest.dataUrl ? { key: str(crest.key, 80), dataUrl: crest.dataUrl } : null,
      overlays: R.mapOverlays(s, data).map(function (o) { return { pic: str(o.pic, 200), facs: o.facs.map(function (x) { return str(x, 40); }), repair: !!o.repair }; }),
      labels: R.mapLabels(s, data).map(function (l) {
        var out = { fac: str(l.fac, 40), name: str(l.name, 80), level: l.level, single: !!l.single, x: l.x, y: l.y, repair: !!l.repair };
        if (l.part) out.part = l.part;
        return out;
      }),
      tiles: tiles,
      facilities: facilities,
      focus: focus,
      /* The DM has chosen to show the focused facility's ledger to the players (only ever true with a focus). */
      ledger: !!focus && extras.ledger === true,
      focusView: routesView ? 'routes' : null,
      routes: routesView ? R.playerRoutes(s, data) : null
    };
  };
}());
