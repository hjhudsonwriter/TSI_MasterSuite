/* The Ironbow Bastion Manager — the war mini-game's battle rules (phase 2).

   The battle on the War Table, as plain functions with no page code, so it
   can be tested on its own (tests/rules/bastion-battle.test.js) and played
   by the enemy's AI (war-ai.js) under exactly the same rules as the player.

   - The battlefield is a grid of squares, 22 across by default (20 to 24),
     its depth following the map's shape. A square is { c, r }: c counts
     columns from the left, r rows from the top. The enemy's edge is the top
     row (r = 0); yours, your "baseline", is the bottom row. The middle rows
     are a no-deployment strip, and each army deploys on its own side of it.
   - Every formation, detachment and beast fills exactly one square.
     Lieutenants and Captains ride with a formation, and so do Bastion
     Defenders who support a regiment.
   - The whole battle is one plain object (see createBattle) that the Bastion
     saves as it goes, so a battle can be closed and picked up again at any
     point. Nothing here keeps any state of its own.
   - Dice come from a rand() function that is passed in (or from a d20
     typed at the table), so tests can fix them. Nothing here uses
     Math.random or the clock.
   - Every number comes from TSI_DATA.bastionWar (data/war-units-data.js),
     called W below. A few layout numbers the data file doesn't hold yet are
     read from it first if it ever does (see "Numbers not in the data file").

   Order of play: createBattle ('setup') → beginDeployment ('deploy': both
   armies placed; you may rearrange yours) → startBattle ('battle') → one
   resolveOrder per activation, the two sides taking turns, for six rounds
   or until a result → 'over', with battle.result filled in. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var bas = TSI.bastion = TSI.bastion || {};
  var W = window.TSI_DATA && window.TSI_DATA.bastionWar;

  var BR = bas.battleRules = {};

  /* ---------- Housekeeping (not rules) ---------- */
  var LOG_MAX = 300;
  /* The eight neighbours, clockwise from straight up. */
  var DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  /* A unit that is still fighting (on the field, not Routed or Defeated). */
  var FIGHTING = { steady: true, shaken: true };
  var KINDS = ['formation', 'detachment', 'beast'];

  /* ---------- Numbers not in the data file ----------
     Each is read from the data file first, so adding it there takes over:
     - which difficult ground a terrain trait crosses at normal cost (the
       traits' own rule text): W.traits[id].ignores;
     - where the raid's supply markers sit across the board (about 20%, 50%
       and 80%): W.objectives.raid.markerCols;
     - the size of the defended depot and of the outpost (4 × 2 squares):
       W.objectives[id].zone = { w, h };
     - how many round ends in a row win or lose a zone (two):
       W.objectives[id].holdRounds;
     - Terror's −2 on the Resolve check that follows its damage:
       W.traits.terror.checkMod. */
  var TRAIT_GROUND = { woodland: ['woods', 'dense'], wader: ['bog'], cragsure: ['rubble'], climber: ['woods', 'rubble', 'dense'] };
  function groundFor(trait) {
    var t = W.traits[trait];
    if (t && Array.isArray(t.ignores)) return t.ignores;
    return TRAIT_GROUND[trait] || [];
  }
  function markerFractions(n) {
    var given = W.objectives.raid.markerCols;
    if (Array.isArray(given) && given.length === n) return given;
    var out = [];
    for (var i = 0; i < n; i++) out.push(n === 1 ? 0.5 : 0.2 + 0.6 * i / (n - 1));
    return out;
  }
  function zoneSize(id) {
    var z = W.objectives[id] && W.objectives[id].zone;
    return { w: num(z && z.w, 4), h: num(z && z.h, 2) };
  }
  function holdNeed(id) { return num(W.objectives[id] && W.objectives[id].holdRounds, 2); }
  function raidNeed() { return num(W.objectives.raid.need, 2); }
  function terrorMod() { return num(W.traits.terror && W.traits.terror.checkMod, -2); }

  /* ---------- Small helpers ---------- */
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function num(v, fallback) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return fallback;
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function copy(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function other(side) { return side === 'player' ? 'enemy' : 'player'; }
  function toHalf(v) { return Math.round(v * 2) / 2; }
  /* "+2", "−2", "+0" (a true minus sign, as the rest of the Bastion). */
  function signed(n) { return n < 0 ? '−' + Math.abs(n) : '+' + n; }
  /* " + 2" / " − 2", for sums written out in the log. */
  function spaced(n) { return n < 0 ? ' − ' + Math.abs(n) : ' + ' + n; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function cellOf(v) {
    if (!v || typeof v !== 'object') return null;
    var c = num(v.c, NaN);
    var r = num(v.r, NaN);
    if (!isFinite(c) || !isFinite(r) || Math.floor(c) !== c || Math.floor(r) !== r) return null;
    return { c: c, r: r };
  }
  function key(cell) { return cell.c + ',' + cell.r; }
  function sameCell(a, b) { return !!a && !!b && a.c === b.c && a.r === b.r; }
  function validD20(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return false;
    var n = Number(v);
    return Math.floor(n) === n && n >= 1 && n <= 20;
  }
  function rollD20(rand) {
    var x = Number(rand());
    if (!isFinite(x)) x = 0;
    return clamp(1 + Math.floor(x * 20), 1, 20);
  }
  /* "Giant Vulture 2" → "GV2"; "Ape" → "Ap". */
  function initials(label) {
    var words = String(label || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    var digits = /^\d+$/.test(words[words.length - 1]) ? words.pop() : '';
    if (!words.length) return digits || '?';
    var ini = words.length === 1 ? words[0].slice(0, 2).replace(/^./, function (c) { return c.toUpperCase(); }) : words.map(function (w) { return w.charAt(0).toUpperCase(); }).join('').slice(0, 3);
    return ini + digits;
  }

  BR.key = key;
  BR.signed = signed;

  /* ---------- Geometry ---------- */
  BR.dist = function (a, b) { return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)); };
  BR.adjacent = function (a, b) { return !!a && !!b && BR.dist(a, b) === 1; };
  BR.inBoard = function (battle, cell) {
    return !!cell && cell.c >= 0 && cell.r >= 0 && cell.c < battle.cols && cell.r < battle.rows;
  };

  /* The no-deployment strip: the middle two rows when there's an even
     number of rows, the middle three when odd. */
  BR.stripRows = function (rows) {
    if (rows % 2 === 0) return [rows / 2 - 1, rows / 2];
    var m = Math.floor(rows / 2);
    return [m - 1, m, m + 1];
  };

  /* The grid for a board ({ w, h } in any units; only the shape matters) or
     no map (null). cols is the War Table's choice (20 to 24), 22 if not set. */
  BR.gridFor = function (board, cols) {
    var s = W.scale;
    var c = Math.round(clamp(num(cols, s.cols), s.minCols, s.maxCols));
    var rows = s.noMapRows;
    if (board && num(board.w, 0) > 0 && num(board.h, 0) > 0) rows = clamp(Math.round(c * board.h / board.w), s.minRows, s.maxRows);
    return { cols: c, rows: rows, strip: BR.stripRows(rows) };
  };

  /* Whose ground a row is: 'enemy' above the strip, 'player' below it, 'strip'. */
  BR.zoneOf = function (battle, r) {
    var strip = battle.strip;
    if (r < strip[0]) return 'enemy';
    if (r > strip[strip.length - 1]) return 'player';
    return 'strip';
  };
  /* A side's deployment rows, from the front (next to the strip) to the back. */
  BR.zoneRows = function (battle, side) {
    var out = [];
    var r;
    if (side === 'player') for (r = battle.strip[battle.strip.length - 1] + 1; r < battle.rows; r++) out.push(r);
    else for (r = battle.strip[0] - 1; r >= 0; r--) out.push(r);
    return out;
  };
  /* A side's own starting edge: the bottom row for you, the top for the enemy. */
  BR.baseline = function (battle, side) { return side === 'player' ? battle.rows - 1 : 0; };

  /* ---------- Terrain ---------- */
  function openGround() {
    for (var i = 0; i < W.terrain.length; i++) if (W.terrain[i].id === 'open') return W.terrain[i];
    return W.terrain[0];
  }
  BR.terrainByCode = function (code) {
    for (var i = 0; i < W.terrain.length; i++) if (W.terrain[i].code === code) return W.terrain[i];
    return openGround();
  };
  /* The terrain on a square: open ground when there's no painting or the
     square is outside it. terrain = { cols, rows, cells: 'codes, row by row' }. */
  BR.terrainAt = function (terrain, c, r) {
    if (!isObj(terrain) || typeof terrain.cells !== 'string') return openGround();
    var cols = Math.floor(num(terrain.cols, 0));
    var rows = Math.floor(num(terrain.rows, 0));
    if (c < 0 || r < 0 || c >= cols || r >= rows) return openGround();
    return BR.terrainByCode(terrain.cells.charAt(r * cols + c));
  };
  /* A saved painting fitted to this battle's grid, square by square
     (nearest neighbour). No painting: everything is open ground. */
  BR.terrainForGrid = function (saved, cols, rows) {
    var C = Math.max(1, Math.floor(num(cols, W.scale.cols)));
    var R = Math.max(1, Math.floor(num(rows, W.scale.noMapRows)));
    var ok = isObj(saved) && typeof saved.cells === 'string' && num(saved.cols, 0) >= 1 && num(saved.rows, 0) >= 1;
    var sc = ok ? Math.floor(saved.cols) : 0;
    var sr = ok ? Math.floor(saved.rows) : 0;
    var known = {};
    W.terrain.forEach(function (t) { known[t.code] = true; });
    var out = '';
    for (var r = 0; r < R; r++) {
      for (var c = 0; c < C; c++) {
        var code = '.';
        if (ok) {
          var x = Math.min(sc - 1, Math.floor((c + 0.5) * sc / C));
          var y = Math.min(sr - 1, Math.floor((r + 0.5) * sr / R));
          var ch = saved.cells.charAt(y * sc + x);
          if (known[ch]) code = ch;
        }
        out += code;
      }
    }
    return { cols: C, rows: R, cells: out };
  };
  /* The painting at this battle's size (resampled only if it isn't already). */
  function fit(battle, terrain) {
    if (!isObj(terrain) || typeof terrain.cells !== 'string') return null;
    if (terrain.cols === battle.cols && terrain.rows === battle.rows) return terrain;
    return BR.terrainForGrid(terrain, battle.cols, battle.rows);
  }
  BR.fitTerrain = fit;

  /* The squares on a straight line between two square centres (Bresenham),
     both ends included, in order from a to b.
     A Bresenham line can pass through different squares depending on which
     end it starts from, which would let one archer shoot another that
     couldn't shoot back. So the line is always traced from the same end
     (the one in the higher row, or the left one in the same row) and turned
     round if need be: the two ends always see the same squares between them. */
  BR.lineCells = function (a, b) {
    var flip = b.r < a.r || (b.r === a.r && b.c < a.c);
    var from = flip ? b : a;
    var to = flip ? a : b;
    var out = [];
    var x = from.c;
    var y = from.r;
    var dx = Math.abs(to.c - x);
    var dy = -Math.abs(to.r - y);
    var sx = x < to.c ? 1 : -1;
    var sy = y < to.r ? 1 : -1;
    var err = dx + dy;
    for (var guard = 0; guard < 1000; guard++) {
      out.push({ c: x, r: y });
      if (x === to.c && y === to.r) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return flip ? out.reverse() : out;
  };
  /* Can a shooter on square a see square b? Blocked by any sight-blocking
     terrain strictly between them (dense woods, a ridge). Units never block.
     Nor can the line slip diagonally between two sight-blocking squares
     that touch at their corners (a line of woods or a ridge painted on a
     slant). Sight works both ways: if a can see b, b can see a (the same
     squares, and the same corners, lie between them from either end). */
  BR.lineOfSight = function (battle, terrain, a, b) {
    var tt = fit(battle, terrain);
    var cells = BR.lineCells(a, b);
    function blocks(c, r) {
      if ((c === a.c && r === a.r) || (c === b.c && r === b.r)) return false;
      return !!BR.terrainAt(tt, c, r).blocksSight;
    }
    for (var i = 1; i < cells.length; i++) {
      var p = cells[i - 1];
      var q = cells[i];
      if (i < cells.length - 1 && blocks(q.c, q.r)) return false;
      if (p.c !== q.c && p.r !== q.r && blocks(q.c, p.r) && blocks(p.c, q.r)) return false;
    }
    return true;
  };

  /* ---------- Units and leaders ---------- */
  BR.unitById = function (battle, id) {
    if (!battle || !Array.isArray(battle.units)) return null;
    for (var i = 0; i < battle.units.length; i++) if (battle.units[i].id === id) return battle.units[i];
    return null;
  };
  BR.leaderById = function (battle, id) {
    if (!battle || !Array.isArray(battle.leaders)) return null;
    for (var i = 0; i < battle.leaders.length; i++) if (battle.leaders[i].id === id) return battle.leaders[i];
    return null;
  };
  BR.leaderOf = function (battle, unit) { return unit && unit.leaderId ? BR.leaderById(battle, unit.leaderId) : null; };
  /* On the field and still fighting (Steady or Shaken). */
  BR.onField = function (u) { return !!u && !!u.pos && FIGHTING[u.status] === true; };
  BR.hasTrait = function (u, id) { return !!u && Array.isArray(u.traits) && u.traits.indexOf(id) !== -1; };
  function hasCharge(u) {
    return (u.traits || []).some(function (t) { return t === 'charge' || t === 'strong_charge' || (W.traits[t] && W.traits[t].charge === true); });
  }
  /* The Charge bonus: the biggest of the unit's charge traits. */
  function chargeBonus(u) {
    var best = 0;
    (u.traits || []).forEach(function (t) {
      var d = W.traits[t];
      if (d && (t === 'charge' || t === 'strong_charge' || d.charge === true)) best = Math.max(best, num(d.bonus, 0));
    });
    return best;
  }
  BR.unitAt = function (battle, cell) {
    if (!cell) return null;
    for (var i = 0; i < battle.units.length; i++) {
      var u = battle.units[i];
      if (u.pos && u.pos.c === cell.c && u.pos.r === cell.r) return u;
    }
    return null;
  };
  /* The other side's units still fighting on the field. */
  BR.enemiesOf = function (battle, side) {
    return battle.units.filter(function (u) { return u.side !== side && BR.onField(u); });
  };
  /* Engaged: next to at least one enemy unit that is still fighting. at is
     the square to test (the unit's own if not given). */
  BR.isEngaged = function (battle, unit, at) {
    var p = at || (unit && unit.pos);
    if (!unit || !p) return false;
    return BR.enemiesOf(battle, unit.side).some(function (e) { return e.id !== unit.id && BR.adjacent(e.pos, p); });
  };
  /* Units of a side that can still act this round, in roster order. */
  BR.activeUnits = function (battle, side) {
    if (!battle || !Array.isArray(battle.units)) return [];
    return battle.units.filter(function (u) { return u.side === side && BR.onField(u) && !u.activated; });
  };
  BR.orderById = function (id) {
    for (var i = 0; i < W.orders.length; i++) if (W.orders[i].id === id) return W.orders[i];
    return null;
  };
  function markerById(battle, id) {
    var list = battle.objective && battle.objective.markers ? battle.objective.markers : [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* A supply marker lying on the ground at a square. */
  BR.fieldMarkerAt = function (battle, cell) {
    var list = battle.objective && battle.objective.markers ? battle.objective.markers : [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.state === 'field' && cell && m.c === cell.c && m.r === cell.r) return m;
    }
    return null;
  };

  /* A unit's Battle Value: its profile's, plus any Bastion Defenders
     supporting it. Its leader's is counted separately. */
  BR.unitBV = function (u) {
    var bv = num(u.profile && u.profile.bv, 0);
    if (u.support) bv += num(u.support.bonus, 0) * W.defenders.supportBvPerPoint;
    return bv;
  };
  function leaderBV(battle, u) {
    var l = BR.leaderOf(battle, u);
    return l ? num(l.bv, 0) : 0;
  }
  /* A side's whole Battle Value. placedOnly: only units on the board, with
     the leaders riding with them (used when the battle starts); otherwise
     every unit and every leader. */
  function rosterBV(battle, side, placedOnly) {
    var total = 0;
    battle.units.forEach(function (u) {
      if (u.side !== side || (placedOnly && !u.pos)) return;
      total += BR.unitBV(u) + (placedOnly ? leaderBV(battle, u) : 0);
    });
    if (!placedOnly) battle.leaders.forEach(function (l) { if (l.side === side) total += num(l.bv, 0); });
    return toHalf(total);
  }

  /* ---------- Profiles ---------- */
  BR.archetypeFor = function (type) {
    if (type === 'defenders') return W.archetypes[W.defenders.profile] || null;
    return W.archetypes[type] || null;
  };
  BR.beastFor = function (name) { return W.beasts[name] || W.beastDefault; };
  /* The traits a unit has when its spec doesn't list them: its archetype's
     plus its variant's, or its beast's one trait. */
  BR.defaultTraits = function (type, variant, beastName) {
    var out = [];
    if (type === 'beast') {
      var b = BR.beastFor(beastName);
      if (b.trait) out.push(b.trait);
      return out;
    }
    var a = BR.archetypeFor(type);
    if (a && Array.isArray(a.traits)) out = a.traits.slice();
    if (variant && variant.trait && out.indexOf(variant.trait) === -1) out.push(variant.trait);
    return out;
  };
  /* The printed profile: the base numbers with the traits' changes
     (Armoured +1 Defence, Fleet +1 Move, Steady +1 Resolve) already in, as
     a stat block shows them. The battle uses these printed numbers as they
     are and doesn't add the traits again. */
  BR.printedProfile = function (base, traits) {
    var b = base || {};
    var p = { cohesion: num(b.cohesion, 1), attack: num(b.attack, 0) };
    if (b.rangedAttack !== undefined && b.rangedAttack !== null) {
      p.rangedAttack = num(b.rangedAttack, 0);
      p.range = num(b.range, 1);
    }
    p.defence = num(b.defence, 10);
    p.move = num(b.move, 1);
    p.resolve = num(b.resolve, 0);
    p.bv = num(b.bv, 0);
    (traits || []).forEach(function (t) {
      var d = W.traits[t];
      if (!d) return;
      if (d.defence) p.defence += d.defence;
      if (d.move) p.move += d.move;
      if (d.resolve) p.resolve += d.resolve;
    });
    return p;
  };
  /* A profile given in a spec, tidied: numbers only, gaps filled from the fallback. */
  function cleanProfile(p, fallback) {
    var out = { cohesion: num(p.cohesion, fallback.cohesion), attack: num(p.attack, fallback.attack) };
    var ranged = p.rangedAttack !== undefined && p.rangedAttack !== null ? p.rangedAttack : fallback.rangedAttack;
    if (ranged !== undefined && ranged !== null) {
      out.rangedAttack = num(ranged, 0);
      out.range = num(p.range, num(fallback.range, 1));
    }
    out.defence = num(p.defence, fallback.defence);
    out.move = num(p.move, fallback.move);
    out.resolve = num(p.resolve, fallback.resolve);
    out.bv = num(p.bv, fallback.bv);
    return out;
  }

  /* A battle unit from a unit spec (see the contract): everything the
     battle tracks is filled in, and the spec's own fields are kept. */
  function makeUnit(s, side, index) {
    var kind = KINDS.indexOf(s.kind) !== -1 ? s.kind : (s.type === 'beast' ? 'beast' : s.type === 'defenders' ? 'detachment' : 'formation');
    var type = kind === 'beast' ? 'beast' : (typeof s.type === 'string' && s.type ? s.type : (kind === 'detachment' ? 'defenders' : 'line'));
    var arche = BR.archetypeFor(type);
    var name = String(s.name || (kind === 'beast' ? 'Beast' : (arche && arche.name) || 'Unit'));
    var variant = isObj(s.variant) ? { id: String(s.variant.id || ''), name: String(s.variant.name || ''), trait: s.variant.trait || null } : null;
    var base = kind === 'beast' ? BR.beastFor(name) : (arche || W.archetypes.line);
    var traits = Array.isArray(s.traits) ? s.traits.filter(function (t) { return typeof t === 'string'; }) : BR.defaultTraits(type, variant, name);
    var printed = BR.printedProfile(base, traits);
    var profile = isObj(s.profile) ? cleanProfile(s.profile, printed) : printed;
    var size = kind === 'beast' ? 1 : Math.max(1, num(s.size, base.size || W.defenders.fullSize));
    var personnel = kind === 'beast' ? 1 : Math.max(0, num(s.personnel, size));
    var label = String(s.label || name);
    var u = {
      id: String(s.id !== undefined && s.id !== null && s.id !== '' ? s.id : (side === 'player' ? 'p' : 'e') + (index + 1)),
      side: side, kind: kind, type: type,
      name: name, label: label, short: String(s.short || initials(label)),
      personnel: personnel, size: size,
      profile: profile, traits: traits, variant: variant,
      support: null, leaderId: null,
      cohesionMax: profile.cohesion, cohesion: profile.cohesion, status: 'steady',
      pos: null, startPos: null,
      activated: false, holding: false, carrying: null, heldFast: false, everHalf: false,
      source: isObj(s.source) ? copy(s.source) : {}
    };
    if (kind === 'detachment') u.armed = s.armed !== false;
    return u;
  }

  /* ---------- The Bastion Defenders (W.defenders) ----------
     count defenders, armed or not, beside the regiments with these ids
     (in order). 75 or more fight as detachments of their own, at most 150
     each, split as evenly as possible (so 160 make two of 80). Fewer than 75
     support the regiments instead: +1 Cohesion per 5 armed (per 10
     unarmed), at most +2 (+1 unarmed), so up to 10 to a regiment, in order;
     any left over when every regiment has its support form one small
     detachment. A detachment has the Levy profile with Cohesion 4 × (n ÷
     150) rounded (at least 1) and Battle Value 3 × (n ÷ 150) to the nearest
     half (at least ½); unarmed, its Attack is 2 lower.
     Returns { detachments: [unit spec], support: [{ hostId, count, armed, bonus }] }. */
  BR.formDefenders = function (count, armed, regimentIds) {
    var d = W.defenders;
    var n = Math.max(0, Math.floor(num(count, 0)));
    var isArmed = armed === true;
    var out = { detachments: [], support: [] };
    if (!n) return out;
    var sizes = [];
    if (n >= d.detachmentMin) {
      var k = Math.ceil(n / d.fullSize);
      for (var i = 0; i < k; i++) sizes.push(Math.floor(n / k) + (i < n % k ? 1 : 0));
    } else {
      var per = isArmed ? d.supportPer : d.unarmedSupportPer;
      var max = isArmed ? d.supportMax : d.unarmedSupportMax;
      var cap = per * max;
      var left = n;
      (Array.isArray(regimentIds) ? regimentIds : []).forEach(function (id) {
        if (left <= 0) return;
        var take = Math.min(cap, left);
        out.support.push({ hostId: String(id), count: take, armed: isArmed, bonus: Math.min(max, Math.floor(take / per)) });
        left -= take;
      });
      if (left > 0) sizes.push(left);
    }
    sizes.forEach(function (m, idx) {
      out.detachments.push(BR.defenderSpec(m, isArmed, sizes.length > 1 ? idx + 1 : 0));
    });
    return out;
  };
  /* One detachment of m defenders (numbered when there are several). */
  BR.defenderSpec = function (m, armed, number) {
    var d = W.defenders;
    var levy = W.archetypes[d.profile];
    var share = m / d.fullSize;
    var profile = BR.printedProfile(levy, levy.traits);
    profile.cohesion = Math.max(1, Math.round(levy.cohesion * share));
    profile.attack = levy.attack + (armed ? 0 : d.unarmedAttack);
    profile.bv = Math.max(0.5, toHalf(levy.bv * share));
    return {
      id: 'def-' + (number || 1), kind: 'detachment', type: 'defenders',
      name: 'Bastion Defenders', label: number ? 'Bastion Defenders ' + number : 'Bastion Defenders',
      short: number ? 'BD' + number : 'BD',
      personnel: m, size: d.fullSize, profile: profile, traits: (levy.traits || []).slice(), variant: null,
      armed: armed
    };
  };

  /* ---------- Objectives ---------- */
  function objectiveId(v) {
    var id = typeof v === 'string' ? v : (isObj(v) ? v.id : null);
    return W.objectives[id] ? id : 'skirmish';
  }
  /* A w × h block centred in a side's deployment zone. */
  function centredZone(battle, side, size, owner) {
    var rows = BR.zoneRows(battle, side);
    var top = Math.min.apply(null, rows);
    var depth = rows.length;
    var h = Math.min(size.h, depth);
    var w = Math.min(size.w, battle.cols);
    var r0 = top + Math.floor((depth - h) / 2);
    var c0 = Math.floor((battle.cols - w) / 2);
    return { c0: c0, r0: r0, c1: c0 + w - 1, r1: r0 + h - 1, owner: owner };
  }
  /* Raid: the supply markers in the enemy's zone, one row above its bottom
     row, spread across the board. Defend: your supply depot, centred in your
     zone. Seize: the outpost, centred in the enemy's zone. */
  function layoutObjective(battle, id) {
    var o = { id: id, markers: [], zone: null, held: { player: 0, enemy: 0 }, extracted: 0 };
    if (id === 'raid') {
      var n = Math.max(1, Math.floor(num(W.objectives.raid.markers, 3)));
      var r = Math.max(0, battle.strip[0] - 2);
      markerFractions(n).forEach(function (f, i) {
        o.markers.push({ id: 'm' + (i + 1), c: clamp(Math.round((battle.cols - 1) * f), 0, battle.cols - 1), r: r, state: 'field', carrier: null });
      });
    } else if (id === 'defend') {
      o.zone = centredZone(battle, 'player', zoneSize('defend'), 'player');
    } else if (id === 'seize_outpost') {
      o.zone = centredZone(battle, 'enemy', zoneSize('seize_outpost'), 'enemy');
    }
    return o;
  }
  BR.inZone = function (zone, cell) {
    return !!zone && !!cell && cell.c >= zone.c0 && cell.c <= zone.c1 && cell.r >= zone.r0 && cell.r <= zone.r1;
  };
  BR.zoneCells = function (zone) {
    var out = [];
    if (!zone) return out;
    for (var r = zone.r0; r <= zone.r1; r++) for (var c = zone.c0; c <= zone.c1; c++) out.push({ c: c, r: r });
    return out;
  };
  /* Who controls the depot or outpost now: a side with a Steady unit inside
     while the other side has no fighting unit inside. 'player', 'enemy' or null. */
  BR.zoneControl = function (battle, zone) {
    var z = zone || (battle.objective && battle.objective.zone);
    if (!z) return null;
    var inside = { player: [], enemy: [] };
    battle.units.forEach(function (u) { if (BR.onField(u) && BR.inZone(z, u.pos)) inside[u.side].push(u); });
    function steady(list) { return list.some(function (u) { return u.status === 'steady'; }); }
    if (steady(inside.player) && !inside.enemy.length) return 'player';
    if (steady(inside.enemy) && !inside.player.length) return 'enemy';
    return null;
  };

  /* ---------- Objectives on painted ground ----------
     The supply markers, the depot and the outpost are first laid out by
     grid position alone (layoutObjective). Once the painting is known
     (beginDeployment, or fitObjective after a repaint), they are moved off
     ground that troops on foot can't use, so a river or lake painted over
     them can't make the mission impossible:
     - each supply marker goes to the nearest square in the enemy's zone
       that your troops can walk to from your starting edge (and so carry
       back to it): its own square if that's fine, otherwise the nearest,
       keeping to its row where it can, then deeper in the enemy's ground;
     - the depot or outpost goes to the nearest place, inside the same zone,
       where every square can be stood on and reached by the side that has
       to get there (the enemy for your depot, you for the outpost); if
       there's no such place, where the most squares can.
     Flight and Swimmer don't count here: the objective has to work for
     ordinary troops. If even that fails, the objective stays where it was
     and objectiveProblems explains why, so the War Table can warn. */

  /* Every square troops on foot can walk to from any open square in these
     rows, round deep water and cliffs (never squeezing diagonally between
     two that touch at their corners). Units don't count: they move. */
  function walkFrom(battle, tt, rows) {
    var seen = {};
    var queue = [];
    rows.forEach(function (r) {
      for (var c = 0; c < battle.cols; c++) {
        if (BR.terrainAt(tt, c, r).impassable) continue;
        seen[c + ',' + r] = true;
        queue.push({ c: c, r: r });
      }
    });
    for (var i = 0; i < queue.length; i++) {
      for (var d = 0; d < DIRS.length; d++) {
        var n = { c: queue[i].c + DIRS[d][0], r: queue[i].r + DIRS[d][1] };
        var nk = key(n);
        if (seen[nk] || !BR.inBoard(battle, n) || BR.terrainAt(tt, n.c, n.r).impassable) continue;
        if (n.c !== queue[i].c && n.r !== queue[i].r &&
          BR.terrainAt(tt, n.c, queue[i].r).impassable && BR.terrainAt(tt, queue[i].c, n.r).impassable) continue;
        seen[nk] = true;
        queue.push(n);
      }
    }
    return seen;
  }
  /* Can troops on foot stand on this square (and, given reach, get to it)? */
  function footing(tt, c, r, reach) {
    return !BR.terrainAt(tt, c, r).impassable && (!reach || reach[c + ',' + r] === true);
  }

  /* The square in these rows nearest to want for which ok(c, r) is true:
     nearest first, then the same row, then the same column, then the row
     nearer the top (deeper in the enemy's ground), then leftmost. */
  function nearestWhere(battle, rows, want, ok) {
    var best = null;
    var bestScore = null;
    rows.forEach(function (r) {
      for (var c = 0; c < battle.cols; c++) {
        if (!ok(c, r)) continue;
        var dc = Math.abs(c - want.c);
        var dr = Math.abs(r - want.r);
        var score = [Math.max(dc, dr), dr, dc, r, c];
        if (!bestScore || less(score, bestScore)) { best = { c: c, r: r }; bestScore = score; }
      }
    });
    return best;
  }

  /* The supply markers: each at its laid-out square if troops on foot can
     reach it from your starting edge; otherwise the nearest such square
     that is free (no other marker; no unit, while deploying). Failing that,
     the nearest square that can at least be stood on. keep(m), if given:
     markers it is true for stay exactly where they are (and their squares
     are kept clear of the others). */
  function settleMarkers(battle, tt, ideal, keep) {
    var reach = walkFrom(battle, tt, [BR.baseline(battle, 'player')]);
    var occ = occupancy(battle);
    var rows = BR.zoneRows(battle, 'enemy');
    var used = {};
    if (keep) ideal.forEach(function (m) { if (keep(m)) used[key(m)] = true; });
    ideal.forEach(function (m) {
      if (keep && keep(m)) return;
      function free(c, r) {
        if (used[c + ',' + r]) return false;
        return (c === m.c && r === m.r) || !occ[c + ',' + r];
      }
      var cell = nearestWhere(battle, rows, m, function (c, r) { return free(c, r) && footing(tt, c, r, reach); }) ||
        nearestWhere(battle, rows, m, function (c, r) { return free(c, r) && footing(tt, c, r, null); });
      if (cell) { m.c = cell.c; m.r = cell.r; }
      used[key(m)] = true;
    });
    return ideal;
  }

  /* The depot or outpost: the block of the same size, inside the same
     zone, with the most squares the side that has to get there can stand
     on and reach (all of them, if possible), the nearest such block to
     where it was laid out. */
  function settleZone(battle, tt, ideal) {
    var w = ideal.c1 - ideal.c0 + 1;
    var h = ideal.r1 - ideal.r0 + 1;
    var rows = BR.zoneRows(battle, ideal.owner);
    var top = Math.min.apply(null, rows);
    var bottom = Math.max.apply(null, rows);
    function bestBlock(reach) {
      var best = null;
      var bestScore = null;
      for (var r0 = top; r0 + h - 1 <= bottom; r0++) {
        for (var c0 = 0; c0 + w - 1 < battle.cols; c0++) {
          var good = 0;
          for (var r = r0; r < r0 + h; r++) for (var c = c0; c < c0 + w; c++) if (footing(tt, c, r, reach)) good += 1;
          var dc = Math.abs(c0 - ideal.c0);
          var dr = Math.abs(r0 - ideal.r0);
          var score = [w * h - good, Math.max(dc, dr), dr, dc, r0, c0];
          if (!bestScore || less(score, bestScore)) { best = { c0: c0, r0: r0, good: good }; bestScore = score; }
        }
      }
      return best;
    }
    var reach = walkFrom(battle, tt, BR.zoneRows(battle, other(ideal.owner)));
    var pick = bestBlock(reach);
    if (!pick || !pick.good) pick = bestBlock(null);
    if (!pick || !pick.good) return ideal;
    return { c0: pick.c0, r0: pick.r0, c1: pick.c0 + w - 1, r1: pick.r0 + h - 1, owner: ideal.owner };
  }

  /* Lay the objective out afresh and fit it to the painting (see above).
     Only before the battle starts, while nothing has happened to it.
     keepPlaced: once the DM has moved part of it while deploying
     (dmPlaced), it is fitted from where it is now rather than laid out
     afresh, and what the DM moved stays exactly where it was put:
     - a supply marker the DM moved (its own dmPlaced), unless the new
       painting makes its square deep water or cliff;
     - the depot or outpost, unless the new painting leaves it with no
       square troops can stand on.
     Even where troops on foot can't reach it: objectiveProblems then warns. */
  function settleObjective(battle, tt, keepPlaced) {
    var o = battle.objective;
    var placed = !!(keepPlaced && o.dmPlaced);
    var fresh = placed ? { markers: copy(o.markers), zone: o.zone ? copy(o.zone) : null } : layoutObjective(battle, o.id);
    function standable(c, r) { return !BR.terrainAt(tt, c, r).impassable; }
    o.markers = settleMarkers(battle, tt, fresh.markers, placed ? function (m) { return m.dmPlaced === true && standable(m.c, m.r); } : null);
    o.zone = !fresh.zone ? null :
      placed && BR.zoneCells(fresh.zone).some(function (c) { return standable(c.c, c.r); }) ? fresh.zone :
        settleZone(battle, tt, fresh.zone);
  }

  /* After the painting changes while deploying (or before): the objective
     is laid out again and kept off ground troops on foot can't use or
     reach; while deploying, a supply marker, depot or outpost the DM has
     moved stays where it was put unless the new painting rules that out.
     Units stay where they are. Returns true if it was allowed.
     (beginDeployment does this itself.) */
  BR.fitObjective = function (battle, terrain) {
    if (!battle || (battle.phase !== 'setup' && battle.phase !== 'deploy') || !battle.objective) return false;
    settleObjective(battle, fit(battle, terrain), battle.phase === 'deploy');
    return true;
  };

  /* ---------- The DM moving the objective (while deploying) ----------
     As the DM can move the enemy's units (DM: adjust enemy), so a supply
     marker, your supply depot or the outpost can be moved before the battle
     starts. what: { marker: id } or { zone: true }; cell: the marker's new
     square, or the depot's or outpost's new top-left square.
     - A supply marker stays on the enemy's ground, on a square troops can
       stand on, with no unit and no other marker on it.
     - The depot or outpost keeps its size and stays wholly on its owner's
       ground (the depot on yours, the outpost on the enemy's), with at least
       one square troops can stand on. Units may be inside it.
     The objective (and a moved marker) is then marked dmPlaced, so a
     repaint while deploying keeps it where it was put (fitObjective). */
  function movedZone(z, at) {
    return { c0: at.c, r0: at.r, c1: at.c + z.c1 - z.c0, r1: at.r + z.r1 - z.r0, owner: z.owner };
  }
  BR.canMoveObjective = function (battle, what, cell, terrain) {
    if (!battle || battle.phase !== 'deploy' || !battle.objective || !isObj(what)) return false;
    var at = cellOf(cell);
    if (!at || !BR.inBoard(battle, at)) return false;
    var o = battle.objective;
    var tt = fit(battle, terrain);
    if (what.marker !== undefined && what.marker !== null) {
      var m = markerById(battle, what.marker);
      if (!m || m.state !== 'field') return false;
      if (BR.zoneOf(battle, at.r) !== 'enemy') return false;
      if (BR.terrainAt(tt, at.c, at.r).impassable) return false;
      if (BR.unitAt(battle, at)) return false;
      return !o.markers.some(function (x) { return x !== m && x.state === 'field' && sameCell(x, at); });
    }
    if (what.zone === true && o.zone) {
      var z = movedZone(o.zone, at);
      if (z.c1 >= battle.cols || z.r1 >= battle.rows) return false;
      var rows = BR.zoneRows(battle, z.owner);
      for (var r = z.r0; r <= z.r1; r++) if (rows.indexOf(r) === -1) return false;
      return BR.zoneCells(z).some(function (c) { return !BR.terrainAt(tt, c.c, c.r).impassable; });
    }
    return false;
  };
  BR.moveObjective = function (battle, what, cell, terrain) {
    if (!BR.canMoveObjective(battle, what, cell, terrain)) return false;
    var at = cellOf(cell);
    var o = battle.objective;
    if (what.marker !== undefined && what.marker !== null) {
      var m = markerById(battle, what.marker);
      m.c = at.c;
      m.r = at.r;
      m.dmPlaced = true;
    } else {
      o.zone = movedZone(o.zone, at);
    }
    o.dmPlaced = true;
    return true;
  };

  /* Anything about the painting that makes the objective impossible for
     troops on foot (those that can fly or swim may still manage it), in
     plain English for the War Table to show: [text], empty when all is
     well. */
  BR.objectiveProblems = function (battle, terrain) {
    var out = [];
    var o = battle && battle.objective;
    if (!o) return out;
    var tt = fit(battle, terrain);
    if (o.id === 'raid') {
      var home = BR.baseline(battle, 'player');
      var reach = walkFrom(battle, tt, [home]);
      if (!Object.keys(reach).length) {
        out.push('Your starting edge is all deep water or cliff, so no supply marker can be brought home (except by a unit that can fly or swim).');
        return out;
      }
      var ok = o.markers.filter(function (m) { return m.state !== 'field' || footing(tt, m.c, m.r, reach); }).length;
      if (ok < raidNeed()) out.push('Only ' + ok + ' of the supply markers can be reached from your starting edge on foot, and the raid needs ' + raidNeed() + ': deep water or cliffs are in the way.');
    } else if (o.zone) {
      var taker = other(o.zone.owner);
      var zr = walkFrom(battle, tt, BR.zoneRows(battle, taker));
      var good = BR.zoneCells(o.zone).filter(function (c) { return footing(tt, c.c, c.r, zr); }).length;
      if (!good) {
        out.push(o.id === 'defend' ?
          'The enemy can\'t reach any square of your supply depot on foot: deep water or cliffs are in the way.' :
          'Your troops can\'t reach any square of the outpost on foot, so it can\'t be seized: deep water or cliffs are in the way.');
      }
    }
    return out;
  };

  function normConditions(c) {
    var x = isObj(c) ? c : {};
    var w = typeof x.weather === 'string' && W.weather[x.weather] ? x.weather : 'clear';
    return { weather: w, moraleMod: num(x.moraleMod, 0), luckMod: num(x.luckMod, 0) };
  }

  /* ---------- Creating the battle ----------
     spec = { player: { units: [unit spec], leaders: [{ id, name, source }],
     defenders: null | { count, armed, source } }, enemy: { units, leaders },
     objective, conditions: { weather, moraleMod, luckMod }, cols? }.
     board = { w, h } (only its shape matters) or null for no map.
     Returns the battle in phase 'setup'. */
  BR.createBattle = function (spec, board) {
    var sp = isObj(spec) ? spec : {};
    var g = BR.gridFor(board, sp.cols);
    var cond = normConditions(sp.conditions);
    var first = cond.luckMod > 0 ? 'player' : 'enemy';
    var battle = {
      v: 2, phase: 'setup', cols: g.cols, rows: g.rows, strip: g.strip,
      objective: null, conditions: cond,
      round: 1, maxRounds: W.rounds, firstSide: first, turnSide: first,
      started: false, units: [], leaders: [], log: [],
      startBV: { player: 0, enemy: 0 }, result: null
    };
    var usedUnits = {};
    function addUnit(u) {
      var id = u.id;
      var n = 2;
      while (usedUnits[id]) id = u.id + '-' + n++;
      u.id = id;
      usedUnits[id] = true;
      battle.units.push(u);
      return u;
    }
    var P = isObj(sp.player) ? sp.player : {};
    var E = isObj(sp.enemy) ? sp.enemy : {};
    (Array.isArray(P.units) ? P.units : []).filter(isObj).forEach(function (s, i) { addUnit(makeUnit(s, 'player', i)); });
    if (isObj(P.defenders) && num(P.defenders.count, 0) > 0) {
      var hosts = battle.units.filter(function (u) { return u.side === 'player' && u.kind === 'formation'; }).map(function (u) { return u.id; });
      var fd = BR.formDefenders(P.defenders.count, P.defenders.armed, hosts);
      fd.support.forEach(function (sg) {
        var h = BR.unitById(battle, sg.hostId);
        if (!h) return;
        h.support = { count: sg.count, armed: sg.armed, bonus: sg.bonus };
        h.cohesionMax += sg.bonus;
        h.cohesion += sg.bonus;
      });
      fd.detachments.forEach(function (s) {
        s.source = Object.assign(isObj(P.defenders.source) ? copy(P.defenders.source) : {}, { defenders: true });
        addUnit(makeUnit(s, 'player', battle.units.length));
      });
    }
    (Array.isArray(E.units) ? E.units : []).filter(isObj).forEach(function (s, i) { addUnit(makeUnit(s, 'enemy', i)); });

    var usedLeaders = {};
    function addLeaders(list, side) {
      var def = side === 'player' ? W.lieutenant : W.captain;
      (Array.isArray(list) ? list : []).filter(isObj).forEach(function (l, i) {
        var id = String(l.id !== undefined && l.id !== null && l.id !== '' ? l.id : (side === 'player' ? 'lt-' : 'cpt-') + (i + 1));
        var n = 2;
        var base = id;
        while (usedLeaders[id]) id = base + '-' + n++;
        usedLeaders[id] = true;
        battle.leaders.push({
          id: id, side: side, name: String(l.name || (def.name + ' ' + (i + 1))), hostId: null,
          autoRallyLeft: num(def.autoRallies, 1), bv: num(def.bv, 2),
          source: isObj(l.source) ? copy(l.source) : {}
        });
      });
    }
    addLeaders(P.leaders, 'player');
    addLeaders(E.leaders, 'enemy');

    battle.objective = layoutObjective(battle, objectiveId(sp.objective));
    battle.startBV = { player: rosterBV(battle, 'player', false), enemy: rosterBV(battle, 'enemy', false) };
    return battle;
  };

  /* Before the battle starts (setup or deploy), a new map shape or grid
     width: the grid and objective are laid out again and every unit is
     taken off the board (phase back to 'setup'; call beginDeployment again).
     Returns true if it was allowed. */
  BR.setBoard = function (battle, board, cols) {
    if (!battle || (battle.phase !== 'setup' && battle.phase !== 'deploy')) return false;
    var g = BR.gridFor(board, cols === undefined || cols === null ? battle.cols : cols);
    battle.cols = g.cols;
    battle.rows = g.rows;
    battle.strip = g.strip;
    battle.objective = layoutObjective(battle, battle.objective ? battle.objective.id : 'skirmish');
    battle.units.forEach(function (u) { u.pos = null; u.startPos = null; u.leaderId = null; });
    battle.leaders.forEach(function (l) { l.hostId = null; });
    battle.phase = 'setup';
    return true;
  };

  /* ---------- Deployment ---------- */
  function roleOf(u) {
    if (u.kind === 'beast') return 'beast';
    if (u.kind === 'detachment') return 'infantry';
    var a = W.archetypes[u.type];
    var role = a ? a.role : 'infantry';
    return role === 'ranged' || role === 'cavalry' ? role : 'infantry';
  }
  /* Can this unit stand on this terrain? Impassable ground only for a
     swimmer in water or a flyer (who crosses and may stop over anything). */
  function canStand(u, t) {
    if (!t.impassable) return true;
    if (BR.hasTrait(u, 'flight')) return true;
    return !!t.water && BR.hasTrait(u, 'swimmer');
  }
  /* The free square in a side's zone nearest to a target square: nearest
     first, then the same row, then the same column, then leftmost. Never on
     impassable ground (for anyone, at deployment), a taken square or one to
     avoid (a supply marker). */
  function bestCell(battle, tt, side, target, taken, avoid) {
    var best = null;
    var bestScore = null;
    BR.zoneRows(battle, side).forEach(function (r) {
      for (var c = 0; c < battle.cols; c++) {
        var k = c + ',' + r;
        if (taken[k] || avoid[k]) continue;
        if (BR.terrainAt(tt, c, r).impassable) continue;
        var dc = Math.abs(c - target.c);
        var dr = Math.abs(r - target.r);
        var score = [Math.max(dc, dr), dr, dc, c];
        if (!bestScore || less(score, bestScore)) { best = { c: c, r: r }; bestScore = score; }
      }
    });
    return best;
  }
  function less(a, b) {
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  }
  /* 0, −1, +1, −2, +2… for spreading out from a centre. */
  function centreOut(i) { return i === 0 ? 0 : (i % 2 ? -(i + 1) / 2 : i / 2); }

  /* The enemy's reserve, kept near its objective: none in a skirmish;
     otherwise a third of its units (at least one for the outpost), beasts
     first, then infantry from the back of its list, always leaving one
     infantry unit in the line (except at the outpost). */
  function pickReserves(battle, groups, n) {
    var id = battle.objective.id;
    if (id === 'skirmish') return [];
    var want = Math.floor(n / 3);
    if (id === 'seize_outpost') want = Math.max(1, want);
    var out = groups.beast.slice(0, want);
    var inf = groups.infantry.slice();
    var keep = id === 'seize_outpost' ? 0 : 1;
    while (out.length < want && inf.length > keep) out.push(inf.pop());
    return out;
  }
  /* Where each reserve unit aims: raid, just behind a supply marker (the
     middle one first); outpost, inside it (front row first, from the
     centre out); defend, behind the centre of the line, toward your depot. */
  function reserveTargets(battle, reserves, row) {
    var o = battle.objective;
    var centre = Math.floor((battle.cols - 1) / 2);
    return reserves.map(function (u, i) {
      if (o.id === 'raid') {
        var ms = o.markers.filter(function (m) { return m.state === 'field'; }).slice().sort(function (a, b) { return Math.abs(a.c - centre) - Math.abs(b.c - centre) || a.c - b.c; });
        if (ms.length) {
          var m = ms[i % ms.length];
          return { c: m.c, r: Math.max(0, m.r - 1) };
        }
      }
      if (o.id === 'seize_outpost' && o.zone) {
        var mid = (o.zone.c0 + o.zone.c1) / 2;
        var cols = [];
        for (var c = o.zone.c0; c <= o.zone.c1; c++) cols.push(c);
        cols.sort(function (a, b) { return Math.abs(a - mid) - Math.abs(b - mid) || a - b; });
        var cells = [];
        for (var r = o.zone.r1; r >= o.zone.r0; r--) cols.forEach(function (cc) { cells.push({ c: cc, r: r }); });
        return cells[i % cells.length];
      }
      return { c: centre + centreOut(i), r: row(1) };
    });
  }

  /* Place one army by role. You: infantry in the front row just behind the
     strip, archers behind them, cavalry and beasts on the flanks (left,
     right, left…). The enemy: infantry nearest the strip, archers behind,
     cavalry together on the flank with more room, its reserve near its
     objective, any other beasts on the other flank. */
  function deploySide(battle, tt, side, taken, avoid) {
    var units = battle.units.filter(function (u) { return u.side === side && FIGHTING[u.status]; });
    if (!units.length) return;
    var rows = BR.zoneRows(battle, side);
    function row(d) { return rows[Math.min(d, rows.length - 1)]; }
    var groups = { infantry: [], ranged: [], cavalry: [], beast: [] };
    units.forEach(function (u) { groups[roleOf(u)].push(u); });
    var reserves = side === 'enemy' ? pickReserves(battle, groups, units.length) : [];
    var line = groups.infantry.filter(function (u) { return reserves.indexOf(u) === -1; });
    var k = line.length;
    var start = Math.round((battle.cols - k) / 2);
    var plan = [];
    line.forEach(function (u, i) { plan.push([u, { c: start + i, r: row(0) }]); });
    var ka = groups.ranged.length;
    var startA = Math.round((battle.cols - ka) / 2);
    groups.ranged.forEach(function (u, i) { plan.push([u, { c: startA + i, r: row(1) }]); });
    var rt = reserveTargets(battle, reserves, row);
    reserves.forEach(function (u, i) { plan.push([u, rt[i]]); });

    function flankTarget(dir, n) { return dir < 0 ? { c: start - 1 - n, r: row(0) } : { c: start + k + n, r: row(0) }; }
    if (side === 'player') {
      groups.cavalry.concat(groups.beast).forEach(function (u, j) {
        plan.push([u, flankTarget(j % 2 === 0 ? -1 : 1, Math.floor(j / 2))]);
      });
    } else {
      var spare = groups.beast.filter(function (u) { return reserves.indexOf(u) === -1; });
      var room = { left: 0, right: 0 };
      [row(0), row(1)].forEach(function (r) {
        for (var c = 0; c < battle.cols; c++) {
          if (c >= start && c < start + k) continue;
          if (BR.terrainAt(tt, c, r).impassable || avoid[c + ',' + r]) continue;
          room[c < start ? 'left' : 'right'] += 1;
        }
      });
      var cavDir = room.right > room.left ? 1 : -1;
      groups.cavalry.forEach(function (u, j) { plan.push([u, flankTarget(cavDir, j)]); });
      spare.forEach(function (u, j) { plan.push([u, flankTarget(-cavDir, j)]); });
    }

    plan.forEach(function (p) {
      var cell = bestCell(battle, tt, side, p[1], taken, avoid);
      if (!cell) return;
      p[0].pos = cell;
      p[0].startPos = { c: cell.c, r: cell.r };
      taken[key(cell)] = true;
    });
  }

  function eligibleHost(u) { return !!u && (u.kind === 'formation' || u.kind === 'detachment') && FIGHTING[u.status] === true; }
  /* Each leader joins the strongest formation (or detachment) on the board
     that has no leader yet; never a beast. */
  function autoAttach(battle, side) {
    battle.leaders.forEach(function (l) {
      if (l.side !== side) return;
      var best = null;
      battle.units.forEach(function (u) {
        if (u.side !== side || !eligibleHost(u) || u.leaderId || !u.pos) return;
        if (!best || BR.unitBV(u) > BR.unitBV(best)) best = u;
      });
      if (best) {
        best.leaderId = l.id;
        l.hostId = best.id;
      }
    });
  }

  /* Both armies placed by role, the leaders attached; phase → 'deploy'.
     The objective is first fitted to the painting (see "Objectives on
     painted ground"). Called again while deploying, it starts the
     placement over. */
  BR.beginDeployment = function (battle, terrain) {
    if (!battle || (battle.phase !== 'setup' && battle.phase !== 'deploy')) return battle;
    var tt = fit(battle, terrain);
    battle.units.forEach(function (u) { u.pos = null; u.startPos = null; u.leaderId = null; });
    battle.leaders.forEach(function (l) { l.hostId = null; });
    if (battle.objective) delete battle.objective.dmPlaced;
    settleObjective(battle, tt, false);
    var taken = {};
    var avoid = {};
    battle.objective.markers.forEach(function (m) { if (m.state === 'field') avoid[key(m)] = true; });
    deploySide(battle, tt, 'player', taken, avoid);
    deploySide(battle, tt, 'enemy', taken, avoid);
    autoAttach(battle, 'player');
    autoAttach(battle, 'enemy');
    battle.phase = 'deploy';
    return battle;
  };

  /* Can this unit be moved to this square while deploying? Your units
     only, within your zone (opts.dm: the DM may also move the enemy's,
     within the enemy's zone), never on the strip, impassable ground or
     another unit. */
  BR.canDeploy = function (battle, unitId, cell, terrain, opts) {
    if (!battle || battle.phase !== 'deploy') return false;
    var u = BR.unitById(battle, unitId);
    if (!u || !FIGHTING[u.status]) return false;
    if (u.side !== 'player' && !(opts && opts.dm === true)) return false;
    var at = cellOf(cell);
    if (!at || !BR.inBoard(battle, at)) return false;
    if (BR.zoneOf(battle, at.r) !== u.side) return false;
    if (BR.terrainAt(fit(battle, terrain), at.c, at.r).impassable) return false;
    var there = BR.unitAt(battle, at);
    return !there || there.id === u.id;
  };
  BR.deployMove = function (battle, unitId, cell, terrain, opts) {
    if (!BR.canDeploy(battle, unitId, cell, terrain, opts)) return false;
    var u = BR.unitById(battle, unitId);
    var at = cellOf(cell);
    u.pos = { c: at.c, r: at.r };
    u.startPos = { c: at.c, r: at.r };
    return true;
  };
  /* Put a leader with a formation of its own side (deploy phase only); a
     formation has at most one leader, and beasts none. hostId null takes the
     leader off its formation. */
  BR.attachLeader = function (battle, leaderId, hostId) {
    if (!battle || battle.phase !== 'deploy') return false;
    var l = BR.leaderById(battle, leaderId);
    if (!l) return false;
    var old = l.hostId ? BR.unitById(battle, l.hostId) : null;
    if (hostId === null || hostId === undefined || hostId === '') {
      if (old && old.leaderId === l.id) old.leaderId = null;
      l.hostId = null;
      return true;
    }
    var h = BR.unitById(battle, hostId);
    if (!h || h.side !== l.side || !eligibleHost(h)) return false;
    if (h.leaderId && h.leaderId !== l.id) return false;
    if (old && old.leaderId === l.id) old.leaderId = null;
    l.hostId = h.id;
    h.leaderId = l.id;
    return true;
  };

  /* Deployment done: the battle begins at round 1 with the side that won
     the Luck roll's initiative (firstSide). Starting Battle Value is fixed
     now, from the units on the board and the leaders riding with them. */
  BR.startBattle = function (battle) {
    if (!battle || battle.phase !== 'deploy') return battle;
    battle.phase = 'battle';
    battle.round = 1;
    battle.started = false;
    battle.result = null;
    battle.units.forEach(function (u) {
      u.activated = false;
      u.holding = false;
      u.heldFast = false;
      u.startPos = u.pos ? { c: u.pos.c, r: u.pos.r } : null;
    });
    battle.startBV = { player: rosterBV(battle, 'player', true), enemy: rosterBV(battle, 'enemy', true) };
    battle.turnSide = battle.firstSide;
    addLog(battle, null, 'Battle begins. Round 1: ' + (battle.firstSide === 'player' ? 'your forces act first.' : 'the enemy acts first.'), 'round');
    if (!BR.activeUnits(battle, battle.turnSide).length) {
      if (BR.activeUnits(battle, other(battle.turnSide)).length) battle.turnSide = other(battle.turnSide);
      else BR.endRound(battle);
    }
    return battle;
  };

  /* ---------- Movement ---------- */
  /* Move this turn: the printed Move, 1 less in a snowstorm (at least 1)
     unless the unit is Hardy. (Fleet's +1 is already in the printed Move.) */
  BR.effectiveMove = function (battle, unit) {
    var m = num(unit && unit.profile && unit.profile.move, 0);
    var w = W.weather[battle.conditions && battle.conditions.weather];
    if (w && w.moveMod && !BR.hasTrait(unit, 'hardy')) m = Math.max(1, m + w.moveMod);
    return m;
  };
  /* What entering a square costs this unit (Infinity: it can't). Flight:
     every square costs 1. Impassable ground: only a swimmer in water. A
     terrain trait makes its own difficult ground cost 1. */
  function costIn(u, t) {
    if (BR.hasTrait(u, 'flight')) return 1;
    if (t.impassable && !(t.water && BR.hasTrait(u, 'swimmer'))) return Infinity;
    if (t.difficult && (u.traits || []).some(function (tr) { return groundFor(tr).indexOf(t.id) !== -1; })) return 1;
    return num(t.cost, 1);
  }
  /* A diagonal step can't squeeze between two squares this unit can't
     enter that touch at their corners: a river or a cliff painted on a
     slant is as solid as one painted straight. (Flight passes over.) */
  function cornerBlocked(u, tt, from, to) {
    if (from.c === to.c || from.r === to.r) return false;
    return !isFinite(costIn(u, BR.terrainAt(tt, to.c, from.r))) && !isFinite(costIn(u, BR.terrainAt(tt, from.c, to.r)));
  }
  BR.moveCost = function (battle, unit, cell, terrain) {
    var at = cellOf(cell);
    if (!at || !BR.inBoard(battle, at) || !unit) return Infinity;
    return costIn(unit, BR.terrainAt(fit(battle, terrain), at.c, at.r));
  };

  /* Squares next to an enemy fighting unit: entering one stops a move. */
  function zocSet(battle, side) {
    var set = {};
    BR.enemiesOf(battle, side).forEach(function (e) {
      DIRS.forEach(function (d) { set[(e.pos.c + d[0]) + ',' + (e.pos.r + d[1])] = true; });
    });
    return set;
  }
  function occupancy(battle) {
    var occ = {};
    battle.units.forEach(function (u) { if (u.pos) occ[key(u.pos)] = u; });
    return occ;
  }

  /* Every square the unit can reach within budget, by the cheapest path
     (a straight line when one is as cheap). It may pass through its own
     side's units but must end on an empty square; it may not enter an
     enemy's square; entering a square next to an enemy ends the move there
     (zone of control). Flight ignores enemies in the way and zones of
     control, but still ends on an empty square. */
  function search(battle, u, budget, tt, includeStart, safeOnly) {
    var flight = BR.hasTrait(u, 'flight');
    var occ = occupancy(battle);
    var zoc = zocSet(battle, u.side);
    var start = u.pos;
    var sk = key(start);
    var nodes = {};
    nodes[sk] = { c: start.c, r: start.r, cost: 0, prev: null };
    var open = [sk];
    var closed = {};
    while (open.length) {
      var bi = 0;
      for (var i = 1; i < open.length; i++) if (nodes[open[i]].cost < nodes[open[bi]].cost) bi = i;
      var ck = open.splice(bi, 1)[0];
      if (closed[ck]) continue;
      closed[ck] = true;
      var cur = nodes[ck];
      if (ck !== sk && !flight && zoc[ck]) continue;
      for (var d = 0; d < DIRS.length; d++) {
        var n = { c: cur.c + DIRS[d][0], r: cur.r + DIRS[d][1] };
        if (!BR.inBoard(battle, n)) continue;
        var nk = key(n);
        if (closed[nk]) continue;
        var o = occ[nk];
        if (o && o.side !== u.side && !flight) continue;
        var step = costIn(u, BR.terrainAt(tt, n.c, n.r));
        if (!isFinite(step) || cornerBlocked(u, tt, cur, n)) continue;
        var nc = cur.cost + step;
        if (nc > budget) continue;
        if (!nodes[nk] || nc < nodes[nk].cost) {
          nodes[nk] = { c: n.c, r: n.r, cost: nc, prev: ck };
          open.push(nk);
        }
      }
    }
    var out = {};
    Object.keys(nodes).forEach(function (nk) {
      var nd = nodes[nk];
      if (nk === sk) {
        if (includeStart) out[nk] = { cost: 0, path: [{ c: start.c, r: start.r }] };
        return;
      }
      if (occ[nk]) return;
      if (!canStand(u, BR.terrainAt(tt, nd.c, nd.r))) return;
      if (safeOnly && zoc[nk]) return;
      var path = [];
      for (var at = nk; at !== null; at = nodes[at].prev) path.unshift({ c: nodes[at].c, r: nodes[at].r });
      if (!isStraight(path)) {
        var straight = straightPath(battle, u, start, nd, tt, occ, zoc, flight);
        if (straight && straight.cost === nd.cost) path = straight.path;
      }
      out[nk] = { cost: nd.cost, path: path };
    });
    return out;
  }
  /* The straight line from start to dest, if one is legal: every square on
     the board and enterable, no enemy in the way, no zone of control before
     the last square. Returns { path, cost } or null. */
  function straightPath(battle, u, start, dest, tt, occ, zoc, flight) {
    var dc = dest.c - start.c;
    var dr = dest.r - start.r;
    if (!(dc === 0 || dr === 0 || Math.abs(dc) === Math.abs(dr))) return null;
    var steps = Math.max(Math.abs(dc), Math.abs(dr));
    var sx = dc === 0 ? 0 : dc / Math.abs(dc);
    var sy = dr === 0 ? 0 : dr / Math.abs(dr);
    var path = [{ c: start.c, r: start.r }];
    var cost = 0;
    for (var i = 1; i <= steps; i++) {
      var n = { c: start.c + sx * i, r: start.r + sy * i };
      var nk = key(n);
      var o = occ[nk];
      if (o && o.side !== u.side && !flight) return null;
      var step = costIn(u, BR.terrainAt(tt, n.c, n.r));
      if (!isFinite(step) || cornerBlocked(u, tt, path[path.length - 1], n)) return null;
      cost += step;
      if (i < steps && !flight && zoc[nk]) return null;
      path.push(n);
    }
    return { path: path, cost: cost };
  }
  /* Every step the same one-square direction. */
  function isStraight(path) {
    if (path.length < 2) return true;
    var dx = path[1].c - path[0].c;
    var dy = path[1].r - path[0].r;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
    for (var i = 2; i < path.length; i++) {
      if (path[i].c - path[i - 1].c !== dx || path[i].r - path[i - 1].r !== dy) return false;
    }
    return true;
  }

  /* Where a unit can move with an order: { 'c,r': { cost, path } }, the path
     from its own square to the destination, both included.
     - advance: up to Move (the unit's own square included at cost 0, as
       moving is optional); nothing if it's engaged;
     - march: up to twice Move; nothing if engaged or held fast;
     - disengage: up to half Move, rounded up, only when engaged and not held
       fast, to squares clear of every enemy. */
  BR.reachable = function (battle, unitId, orderId, terrain) {
    var u = BR.unitById(battle, unitId);
    if (!battle || !BR.onField(u)) return {};
    var tt = fit(battle, terrain);
    var engaged = BR.isEngaged(battle, u);
    var move = BR.effectiveMove(battle, u);
    if (orderId === 'advance') return engaged ? {} : search(battle, u, move, tt, true, false);
    if (orderId === 'march') return engaged || u.heldFast ? {} : search(battle, u, 2 * move, tt, false, false);
    if (orderId === 'disengage') return !engaged || u.heldFast ? {} : search(battle, u, Math.ceil(move / 2), tt, false, true);
    return {};
  };

  /* ---------- Attacks ---------- */
  /* The path as squares from the unit's own square (added if missing). */
  function normPath(u, path) {
    var cells = (Array.isArray(path) ? path : []).map(cellOf).filter(Boolean);
    if (!cells.length || !sameCell(cells[0], u.pos)) cells.unshift({ c: u.pos.c, r: u.pos.r });
    return cells;
  }
  /* A Charge: a charging unit, not Shaken, not engaged when its activation
     began, moving at least 2 squares in a straight line with no difficult
     ground after its starting square, ending next to a target that isn't
     Holding or Braced. */
  function canChargeAt(battle, u, cells, from, target, tt) {
    if (!hasCharge(u) || u.status === 'shaken') return false;
    if (BR.isEngaged(battle, u, u.pos)) return false;
    if (cells.length < 3 || !isStraight(cells)) return false;
    if (!sameCell(cells[cells.length - 1], from)) return false;
    for (var i = 1; i < cells.length; i++) if (BR.terrainAt(tt, cells[i].c, cells[i].r).difficult) return false;
    if (!BR.adjacent(from, target.pos)) return false;
    return !target.holding && !BR.hasTrait(target, 'braced');
  }

  /* What the unit could attack after moving to fromCell along path:
     [{ targetId, kind: 'melee' | 'ranged', charge }], in roster order.
     Melee: an enemy next to fromCell. Ranged (archers): not engaged at
     fromCell, within range, in line of sight, and the target isn't already
     in melee with one of the shooter's side. */
  BR.attackOptions = function (battle, unitId, fromCell, path, terrain) {
    var u = BR.unitById(battle, unitId);
    if (!battle || !BR.onField(u)) return [];
    var from = cellOf(fromCell) || u.pos;
    var tt = fit(battle, terrain);
    var cells = normPath(u, path);
    var enemies = BR.enemiesOf(battle, u.side);
    var engagedThere = enemies.some(function (e) { return BR.adjacent(e.pos, from); });
    var ranged = u.profile.rangedAttack !== undefined && u.profile.rangedAttack !== null;
    var friends = battle.units.filter(function (f) { return f.side === u.side && f.id !== u.id && BR.onField(f); });
    var out = [];
    enemies.forEach(function (e) {
      if (BR.adjacent(e.pos, from)) {
        out.push({ targetId: e.id, kind: 'melee', charge: canChargeAt(battle, u, cells, from, e, tt) });
        return;
      }
      if (!ranged || engagedThere) return;
      if (BR.dist(from, e.pos) > num(u.profile.range, 0)) return;
      if (!BR.lineOfSight(battle, tt, from, e.pos)) return;
      if (friends.some(function (f) { return BR.adjacent(f.pos, e.pos); })) return;
      out.push({ targetId: e.id, kind: 'ranged', charge: false });
    });
    return out;
  };

  /* Is another of the attacker's side fighting the target with at least
     90° between them (seen from the target)? Pack: any other, from any
     side. Returns 'surround', 'pack' or null. */
  function surroundBy(battle, a, from, t) {
    var va = { x: from.c - t.pos.c, y: from.r - t.pos.r };
    var la = Math.sqrt(va.x * va.x + va.y * va.y);
    var friends = battle.units.filter(function (f) { return f.side === a.side && f.id !== a.id && BR.onField(f) && BR.adjacent(f.pos, t.pos); });
    for (var i = 0; i < friends.length; i++) {
      var vb = { x: friends[i].pos.c - t.pos.c, y: friends[i].pos.r - t.pos.r };
      var lb = Math.sqrt(vb.x * vb.x + vb.y * vb.y);
      var cos = (va.x * vb.x + va.y * vb.y) / (la * lb);
      var angle = Math.acos(clamp(cos, -1, 1)) * 180 / Math.PI;
      if (angle >= W.attack.surroundAngle - 1e-9) return 'surround';
    }
    return friends.length && BR.hasTrait(a, 'pack') ? 'pack' : null;
  }

  /* The attack worked out before the dice: { kind, charge, attackerId,
     targetId, attack (printed), mods: [{ label, value }], modRaw, modTotal
     (kept within ±4), capped, defence (with Hold +2, and Cover +2 against
     ranged), defenceMods, needs: the d20 needed to hit }. null if the
     target can't be attacked from there. */
  BR.previewAttack = function (battle, attackerId, fromCell, path, targetId, terrain) {
    var a = BR.unitById(battle, attackerId);
    if (!battle || !BR.onField(a)) return null;
    var tt = fit(battle, terrain);
    var from = cellOf(fromCell) || a.pos;
    var opt = BR.attackOptions(battle, attackerId, from, path, tt).filter(function (o) { return o.targetId === targetId; })[0];
    if (!opt) return null;
    var t = BR.unitById(battle, targetId);
    var ranged = opt.kind === 'ranged';
    var attack = num(ranged ? a.profile.rangedAttack : a.profile.attack, 0);
    var mods = [];
    var luck = num(battle.conditions.luckMod, 0);
    if (a.side === 'player' && luck) mods.push({ label: 'Luck', value: luck });
    if (a.status === 'shaken') mods.push({ label: 'Shaken', value: W.attack.shakenAttack });
    if (opt.charge) mods.push({ label: BR.hasTrait(a, 'strong_charge') ? 'Strong Charge' : 'Charge', value: chargeBonus(a) });
    if (!ranged) {
      var s = surroundBy(battle, a, from, t);
      if (s) mods.push({ label: s === 'pack' ? 'Pack' : 'Surround', value: W.attack.surroundBonus });
    }
    var weather = W.weather[battle.conditions.weather];
    if (ranged && weather && weather.rangedMod && !BR.hasTrait(a, 'hardy')) mods.push({ label: 'Rainstorm', value: weather.rangedMod });
    var raw = mods.reduce(function (sum, m) { return sum + m.value; }, 0);
    var cap = W.attack.modCap;
    var modTotal = clamp(raw, -cap, cap);
    var defence = num(t.profile.defence, 10);
    var defenceMods = [];
    if (t.holding) defenceMods.push({ label: 'Hold', value: W.attack.holdDefence });
    if (ranged && BR.terrainAt(tt, t.pos.c, t.pos.r).cover) defenceMods.push({ label: 'Cover', value: W.attack.coverDefence });
    defenceMods.forEach(function (m) { defence += m.value; });
    return {
      kind: opt.kind, charge: opt.charge, attackerId: a.id, targetId: t.id,
      attack: attack, mods: mods, modRaw: raw, modTotal: modTotal, capped: raw !== modTotal,
      defence: defence, defenceMods: defenceMods,
      needs: defence - attack - modTotal
    };
  };

  /* Cohesion lost to one attack: a natural 1 always misses, a natural 20
     always inflicts 3; otherwise by how far the total beat Defence. */
  BR.damageFor = function (d20, total, defence) {
    if (d20 === 1) return 0;
    if (d20 === 20) return W.attack.nat20Damage;
    var margin = total - defence;
    if (margin < 0) return 0;
    var dmg = 0;
    W.attack.bands.forEach(function (b) { if (margin >= b.margin) dmg = Math.max(dmg, b.damage); });
    return Math.min(dmg, W.attack.maxDamage);
  };

  /* ---------- Morale ---------- */
  /* A Resolve check against DC 10: d20 + Resolve (Steady's +1 is already in
     it) + your army's opening Morale (your side only) + the attached
     leader's +2 + Heatwave −1 (unless Hardy) + extraMod (Terror −2: a number,
     or { label, value }). d20 typed at the table if given, else rolled. */
  BR.resolveCheck = function (battle, unit, rand, extraMod, d20) {
    var roll = validD20(d20) ? Number(d20) : rollD20(rand);
    var mods = [{ label: 'Resolve', value: num(unit.profile.resolve, 0) }];
    var morale = num(battle.conditions.moraleMod, 0);
    if (unit.side === 'player' && morale) mods.push({ label: 'Morale', value: morale });
    var l = BR.leaderOf(battle, unit);
    if (l) mods.push({ label: l.name || 'Leader', value: num((l.side === 'player' ? W.lieutenant : W.captain).resolveBonus, 0) });
    var w = W.weather[battle.conditions.weather];
    if (w && w.resolveMod && !BR.hasTrait(unit, 'hardy')) mods.push({ label: 'Heatwave', value: w.resolveMod });
    if (isObj(extraMod) && num(extraMod.value, 0)) mods.push({ label: String(extraMod.label || 'Modifier'), value: num(extraMod.value, 0) });
    else if (num(extraMod, 0)) mods.push({ label: 'Terror', value: num(extraMod, 0) });
    var total = roll + mods.reduce(function (s, m) { return s + m.value; }, 0);
    var dc = W.morale.dc;
    return { d20: roll, total: total, dc: dc, pass: total >= dc, mods: mods };
  };
  /* "12 + 1 − 2 = 11 vs DC 10" (Resolve always shown, other zeros left out). */
  function checkText(chk) {
    var s = String(chk.d20);
    chk.mods.forEach(function (m, i) { if (m.value || i === 0) s += spaced(m.value); });
    return s + ' = ' + chk.total + ' vs DC ' + chk.dc;
  }

  /* ---------- The log ---------- */
  function addLog(battle, side, text, kind) {
    battle.log.push({ round: battle.round, side: side, text: text, kind: kind || 'note' });
    if (battle.log.length > LOG_MAX) battle.log.splice(0, battle.log.length - LOG_MAX);
  }

  /* ---------- Orders ---------- */
  /* Why a unit can't act at all right now ('' if it can). */
  function notReady(battle, u) {
    if (!battle || battle.phase !== 'battle' || battle.result) return 'The battle isn\'t under way.';
    if (!u) return 'There\'s no such unit.';
    if (!BR.onField(u)) return u.label + ' has left the field.';
    if (u.side !== battle.turnSide) return battle.turnSide === 'player' ? 'It\'s your turn: the enemy can\'t act now.' : 'It\'s the enemy\'s turn.';
    if (u.activated) return u.label + ' has already acted this round.';
    return '';
  }
  function orderWhy(battle, u, id, tt) {
    var engaged = BR.isEngaged(battle, u);
    if (id === 'advance') {
      if (engaged) return '';
      if (Object.keys(BR.reachable(battle, u.id, 'advance', tt)).length > 1) return '';
      if (BR.attackOptions(battle, u.id, u.pos, null, tt).length) return '';
      return 'Nowhere to move and nothing in reach to attack.';
    }
    if (id === 'march') {
      if (engaged) return 'It\'s engaged in melee, so it can\'t March (Disengage first).';
      if (u.heldFast) return 'It\'s held fast (grappled), so it can\'t March on this activation.';
      if (!Object.keys(BR.reachable(battle, u.id, 'march', tt)).length) return 'There\'s nowhere it can March to.';
      return '';
    }
    if (id === 'hold') return '';
    if (id === 'rally') return u.status === 'shaken' ? '' : 'Only a Shaken unit needs to Rally.';
    if (id === 'disengage') {
      if (!engaged) return 'It isn\'t in melee, so there\'s nothing to Disengage from.';
      if (u.heldFast) return 'It\'s held fast (grappled), so it can\'t Disengage on this activation.';
      if (!Object.keys(BR.reachable(battle, u.id, 'disengage', tt)).length) return 'There\'s no square within reach that\'s clear of the enemy.';
      return '';
    }
    if (id === 'interact') {
      if (battle.objective.id !== 'raid') return 'Interact is only used to collect supply markers in a Raid.';
      if (u.side !== 'player') return 'Only your forces collect supply markers.';
      if (u.carrying) return 'It\'s already carrying a supply marker.';
      if (!BR.fieldMarkerAt(battle, u.pos)) return 'Stand on a supply marker to collect it.';
      return '';
    }
    return 'That isn\'t one of the six orders.';
  }
  /* The six orders for a unit now: [{ id, name, ok, why }] ('' when ok). */
  BR.legalOrders = function (battle, unitId, terrain) {
    var u = BR.unitById(battle, unitId);
    var base = notReady(battle, u);
    var tt = base ? null : fit(battle, terrain);
    return W.orders.map(function (o) {
      var why = base || orderWhy(battle, u, o.id, tt);
      return { id: o.id, name: o.name, ok: !why, why: why };
    });
  };

  /* ---------- Resolving an activation ---------- */
  function moveUnit(battle, u, dest, path, orderId, events) {
    var from = { c: u.pos.c, r: u.pos.r };
    u.pos = { c: dest.c, r: dest.r };
    if (u.carrying) {
      var m = markerById(battle, u.carrying);
      if (m) { m.c = dest.c; m.r = dest.r; }
    }
    var verb = { advance: 'advances', march: 'marches', disengage: 'disengages, falling back' }[orderId] || 'moves';
    events.push({ kind: 'move', unitId: u.id, from: from, to: { c: dest.c, r: dest.r }, path: copy(path), text: u.label + ' ' + verb + ' ' + plural(path.length - 1, 'square') + '.' });
  }
  function dropMarker(battle, u, events) {
    var m = markerById(battle, u.carrying);
    u.carrying = null;
    if (!m || !u.pos) return;
    m.state = 'field';
    m.carrier = null;
    m.c = u.pos.c;
    m.r = u.pos.r;
    events.push({ kind: 'drop', unitId: u.id, side: u.side, text: u.label + ' drops its supply marker.' });
  }
  /* A Routed or Defeated unit leaves the board (dropping any marker it carries). */
  function leaveField(battle, u, events) {
    if (u.carrying) dropMarker(battle, u, events);
    u.pos = null;
    u.holding = false;
    u.heldFast = false;
  }
  /* After damage: Cohesion gone → Defeated (no check). At or below half its
     Cohesion → a Resolve check: a Steady unit that fails is Shaken; a Shaken
     one that fails Routs. A unit that has rallied only checks again when it
     is damaged again. */
  function afterDamage(battle, t, attacker, rand, events, moraleD20) {
    if (t.cohesion <= 0) {
      t.status = 'defeated';
      t.everHalf = true;
      events.push({ kind: 'defeated', unitId: t.id, side: t.side, text: t.label + ' is defeated: its Cohesion is gone, and it leaves the field.' });
      leaveField(battle, t, events);
      return;
    }
    if (t.cohesion * 2 > t.cohesionMax) return;
    t.everHalf = true;
    var extra = BR.hasTrait(attacker, 'terror') ? { label: 'Terror', value: terrorMod() } : null;
    var chk = BR.resolveCheck(battle, t, rand, extra, moraleD20);
    var calc = checkText(chk);
    if (chk.pass) {
      events.push({ kind: 'morale', unitId: t.id, side: t.side, calc: chk, text: t.label + ' holds its nerve: ' + calc + '.' });
    } else if (t.status === 'shaken') {
      t.status = 'routed';
      events.push({ kind: 'routed', unitId: t.id, side: t.side, calc: chk, text: t.label + ' routs: ' + calc + '. It flees the field.' });
      leaveField(battle, t, events);
    } else {
      t.status = 'shaken';
      events.push({ kind: 'shaken', unitId: t.id, side: t.side, calc: chk, text: t.label + ' is Shaken: ' + calc + '.' });
    }
  }
  function attackText(d20, pv, total) {
    var s = d20 + spaced(pv.attack);
    if (pv.capped) s += spaced(pv.modTotal) + ' (modifiers capped at ' + signed(pv.modTotal) + ')';
    else pv.mods.forEach(function (m) { if (m.value) s += spaced(m.value); });
    return s + ' = ' + total + ' vs ' + pv.defence;
  }
  function attack(battle, u, pv, order, rand, events) {
    var t = BR.unitById(battle, pv.targetId);
    var d20 = validD20(order.d20) ? Number(order.d20) : rollD20(rand);
    var total = d20 + pv.attack + pv.modTotal;
    var dmg = BR.damageFor(d20, total, pv.defence);
    t.cohesion = Math.max(0, t.cohesion - dmg);
    var verb = pv.kind === 'ranged' ? 'shoots at' : (pv.charge ? 'charges' : 'attacks');
    var result;
    if (d20 === 1) result = 'natural 1: a miss';
    else if (!dmg) result = 'a miss';
    else result = (d20 === 20 ? 'natural 20: ' : '') + dmg + ' Cohesion (' + t.cohesion + ' left)';
    events.push({
      kind: 'attack', unitId: u.id, targetId: t.id,
      text: u.label + ' ' + verb + ' ' + t.label + ': ' + attackText(d20, pv, total) + ' → ' + result,
      calc: { d20: d20, attack: pv.attack, mods: copy(pv.mods), modTotal: pv.modTotal, capped: pv.capped, total: total, defence: pv.defence, defenceMods: copy(pv.defenceMods), damage: dmg, kind: pv.kind, charge: pv.charge }
    });
    if (!dmg) return;
    if (pv.kind === 'melee' && BR.hasTrait(u, 'grapple') && t.cohesion > 0) {
      t.heldFast = true;
      events.push({ kind: 'grapple', unitId: u.id, targetId: t.id, side: t.side, text: t.label + ' is held fast: it can\'t March or Disengage on its next activation.' });
    }
    afterDamage(battle, t, u, rand, events, order.moraleD20);
  }
  /* A carrier ending its activation on its own baseline brings the marker home. */
  function extractIfHome(battle, u, events) {
    if (!u.carrying || !u.pos || u.pos.r !== BR.baseline(battle, u.side)) return;
    var m = markerById(battle, u.carrying);
    u.carrying = null;
    if (!m) return;
    m.state = 'extracted';
    m.carrier = null;
    m.c = u.pos.c;
    m.r = u.pos.r;
    battle.objective.extracted += 1;
    events.push({ kind: 'extract', unitId: u.id, text: u.label + ' brings a supply marker home (' + battle.objective.extracted + ' of the ' + raidNeed() + ' needed).' });
  }
  function nextTurn(battle, side) {
    var o = other(side);
    if (BR.activeUnits(battle, o).length) battle.turnSide = o;
    else if (BR.activeUnits(battle, side).length) battle.turnSide = side;
    else BR.endRound(battle);
  }

  /* One activation: order = { unitId, id: 'advance' | 'march' | 'hold' |
     'rally' | 'disengage' | 'interact', dest?: { c, r }, targetId?, d20?
     (the attack's, or the Rally check's, typed at the table), moraleD20?
     (the target's Resolve check, typed), useLeaderRally? }.
     Everything is checked first; nothing changes unless the order is legal.
     Returns { ok, why?, events: [{ kind, side, text, unitId?, targetId?,
     calc? }], result } and adds every event to the battle's log. */
  BR.resolveOrder = function (battle, order, terrain, rand) {
    function fail(why) { return { ok: false, why: why, events: [], result: battle ? battle.result || null : null }; }
    if (!battle || battle.phase !== 'battle' || battle.result) return fail('The battle isn\'t under way.');
    if (!isObj(order)) return fail('No order was given.');
    if (typeof rand !== 'function') return fail('There are no dice to roll with.');
    var u = BR.unitById(battle, order.unitId);
    var why = notReady(battle, u);
    if (why) return fail(why);
    var def = BR.orderById(order.id);
    if (!def) return fail('That isn\'t one of the six orders.');
    var tt = fit(battle, terrain);
    var whyNot = orderWhy(battle, u, def.id, tt);
    if (whyNot) return fail(whyNot);

    var moves = def.id === 'advance' || def.id === 'march' || def.id === 'disengage';
    var given = order.dest !== undefined && order.dest !== null;
    var dest = given ? cellOf(order.dest) : null;
    if (given && !dest) return fail('That isn\'t a square on the board.');
    if (dest && sameCell(dest, u.pos)) dest = null;
    var path = [{ c: u.pos.c, r: u.pos.r }];
    if (dest && !moves) return fail(def.name + ' doesn\'t move the unit.');
    if (moves && !dest && def.id !== 'advance') return fail('Choose a square to ' + (def.id === 'march' ? 'March' : 'fall back') + ' to.');
    if (dest) {
      if (def.id === 'advance' && BR.isEngaged(battle, u)) return fail('It\'s engaged in melee, so it can\'t move with Advance (Disengage instead).');
      var hit = BR.reachable(battle, u.id, def.id, tt)[key(dest)];
      if (!hit) return fail('It can\'t reach that square with this order.');
      path = hit.path;
    }
    var preview = null;
    if (order.targetId !== undefined && order.targetId !== null && order.targetId !== '') {
      if (def.id !== 'advance') return fail(def.name + ' can\'t attack.');
      preview = BR.previewAttack(battle, u.id, dest || u.pos, path, order.targetId, tt);
      if (!preview) return fail('That target can\'t be attacked from there.');
    }
    var leader = null;
    if (def.id === 'rally' && order.useLeaderRally) {
      leader = BR.leaderOf(battle, u);
      if (!leader || !(num(leader.autoRallyLeft, 0) > 0)) return fail('This unit has no leader with a sure Rally left.');
    }

    /* Everything checks out: carry it out. */
    var events = [];
    var side = u.side;
    u.holding = false; /* Hold lasts until the start of the unit's next activation. */
    if (dest) moveUnit(battle, u, dest, path, def.id, events);
    if (def.id === 'advance') {
      if (preview) attack(battle, u, preview, order, rand, events);
      else if (!dest) events.push({ kind: 'advance', unitId: u.id, text: u.label + ' stands its ground.' });
    } else if (def.id === 'hold') {
      u.holding = true;
      events.push({ kind: 'hold', unitId: u.id, text: u.label + ' holds: +' + W.attack.holdDefence + ' Defence until its next activation, and no Charge bonus against it.' });
    } else if (def.id === 'rally') {
      if (leader) {
        leader.autoRallyLeft = num(leader.autoRallyLeft, 0) - 1;
        u.status = 'steady';
        events.push({ kind: 'rally', unitId: u.id, text: leader.name + ' rallies ' + u.label + ': no roll needed (once a battle). It is Steady again.' });
      } else {
        var chk = BR.resolveCheck(battle, u, rand, null, order.d20);
        if (chk.pass) u.status = 'steady';
        events.push({ kind: 'rally', unitId: u.id, calc: chk, text: u.label + (chk.pass ? ' rallies: ' : ' fails to rally: ') + checkText(chk) + (chk.pass ? '. It is Steady again.' : '. It stays Shaken.') });
      }
    } else if (def.id === 'interact') {
      var m = BR.fieldMarkerAt(battle, u.pos);
      m.state = 'carried';
      m.carrier = u.id;
      u.carrying = m.id;
      events.push({ kind: 'interact', unitId: u.id, text: u.label + ' secures a supply marker. Bring it back to your starting edge to extract it.' });
    } else if (def.id === 'disengage' || def.id === 'march') {
      /* The move is the whole order. */
    }
    u.activated = true;
    u.heldFast = false; /* a grapple lasts for one activation */
    battle.started = true;
    extractIfHome(battle, u, events);
    /* Each line is filed under the side of the unit it is about (a morale
       check after an attack under the defender's side). */
    events.forEach(function (e) {
      if (!e.side) e.side = side;
      addLog(battle, e.side, e.text, e.kind);
    });
    if (!BR.checkResult(battle)) nextTurn(battle, side);
    return { ok: true, events: events, result: battle.result };
  };

  /* ---------- Rounds and results ---------- */
  /* Share of a side's starting Battle Value that has been Routed or
     Defeated (leaders count with their formation). Broken at W.breakPct. */
  BR.armyLoss = function (battle, side) {
    var start = num(battle.startBV && battle.startBV[side], 0);
    var lost = 0;
    battle.units.forEach(function (u) {
      if (u.side === side && (u.status === 'routed' || u.status === 'defeated')) lost += BR.unitBV(u) + leaderBV(battle, u);
    });
    var share = start > 0 ? lost / start : 0;
    return { startBV: start, lostBV: toHalf(lost), pct: Math.round(share * 1000) / 10, broken: start > 0 && lost * 100 >= W.breakPct * start - 1e-9, share: share };
  };

  var OUTCOME_WORDS = { victory: 'Victory', defeat: 'Defeat', draw: 'A draw', withdrawal: 'Withdrawal' };
  function finish(battle, outcome, reason) {
    var p = BR.armyLoss(battle, 'player');
    var e = BR.armyLoss(battle, 'enemy');
    battle.result = {
      outcome: outcome, reason: reason, round: battle.round,
      lostPct: { player: p.pct, enemy: e.pct },
      extracted: battle.objective.extracted,
      broken: { player: p.broken, enemy: e.broken }
    };
    battle.phase = 'over';
    addLog(battle, null, OUTCOME_WORDS[outcome] + '. ' + reason, 'result');
    return battle.result;
  }
  /* The enemy army has broken: what's left of it flees the field (and the
     battle is won: checkResult). */
  function enemyWithdraws(battle) {
    var gone = battle.units.filter(function (u) { return u.side === 'enemy' && BR.onField(u); });
    if (!gone.length) return;
    gone.forEach(function (u) {
      u.pos = null;
      u.holding = false;
      u.heldFast = false;
      u.withdrawn = true;
    });
    addLog(battle, 'enemy', 'The enemy army breaks: what is left of it flees the field.', 'withdraw');
  }
  function lostLine(battle) {
    var p = BR.armyLoss(battle, 'player');
    var e = BR.armyLoss(battle, 'enemy');
    return 'You lost ' + p.pct + '% of your Battle Value; the enemy lost ' + e.pct + '%.';
  }

  /* Is the battle decided? Called after every activation and at each round
     end; sets battle.result (phase 'over') and returns it, or null. */
  BR.checkResult = function (battle, atRoundEnd) {
    if (!battle) return null;
    if (battle.result) return battle.result;
    if (battle.phase !== 'battle') return null;
    var o = battle.objective;
    if (o.id === 'raid' && o.extracted >= raidNeed()) return finish(battle, 'victory', 'You brought ' + o.extracted + ' supply markers home.');
    var p = BR.armyLoss(battle, 'player');
    if (p.broken) return finish(battle, 'defeat', 'Your army broke: ' + p.pct + '% of its Battle Value was Routed or Defeated, and it withdrew.');
    /* Breaking the enemy army wins at once, whatever the objective (Harry,
       4 October 2026): what's left of it flees the field, leaving the
       supplies, the outpost or your depot to you. */
    var e = BR.armyLoss(battle, 'enemy');
    if (e.broken) {
      enemyWithdraws(battle);
      var left = { raid: ', leaving the supplies to you', seize_outpost: ', leaving the outpost to you', defend: ', leaving your supply depot safe' }[o.id] || '';
      return finish(battle, 'victory', 'The enemy army broke (' + e.pct + '% of its Battle Value Routed or Defeated) and fled the field' + left + '.');
    }
    if (atRoundEnd === true) {
      if (o.id === 'seize_outpost' && o.held.player >= holdNeed(o.id)) return finish(battle, 'victory', 'You held the outpost at ' + o.held.player + ' round ends in a row.');
      if (o.id === 'defend' && o.held.enemy >= holdNeed(o.id)) return finish(battle, 'defeat', 'The enemy held your supply depot at ' + o.held.enemy + ' round ends in a row.');
    }
    return null;
  };

  /* After the last round: the objective decides. */
  function finalResult(battle) {
    var o = battle.objective;
    if (o.id === 'raid') {
      return o.extracted >= raidNeed() ? finish(battle, 'victory', 'You brought ' + o.extracted + ' supply markers home.') :
        finish(battle, 'defeat', 'The last round ended with ' + o.extracted + ' of the ' + raidNeed() + ' supply markers needed brought home.');
    }
    if (o.id === 'seize_outpost') {
      return o.held.player >= holdNeed(o.id) ? finish(battle, 'victory', 'You held the outpost at ' + o.held.player + ' round ends in a row.') :
        finish(battle, 'defeat', 'The last round ended without the outpost held at ' + holdNeed(o.id) + ' round ends in a row.');
    }
    if (o.id === 'defend') {
      if (o.held.enemy >= holdNeed(o.id)) return finish(battle, 'defeat', 'The enemy held your supply depot at ' + o.held.enemy + ' round ends in a row.');
      if (BR.armyLoss(battle, 'player').broken) return finish(battle, 'defeat', 'Your army broke.');
      return finish(battle, 'victory', 'Your supply depot held and your army stayed unbroken to the end.');
    }
    /* Skirmish: the shares compared are the percentages the War Report shows
       (to one decimal place), so the result always agrees with the numbers
       on the screen: 32.9% against 32.9% is a draw. */
    var p = BR.armyLoss(battle, 'player');
    var e = BR.armyLoss(battle, 'enemy');
    if (p.pct === e.pct) return finish(battle, 'draw', 'Both armies lost the same share of their strength. ' + lostLine(battle));
    return p.pct < e.pct ? finish(battle, 'victory', 'The enemy lost the bigger share of its strength. ' + lostLine(battle)) :
      finish(battle, 'defeat', 'You lost the bigger share of your strength. ' + lostLine(battle));
  }

  /* The round ends when nobody can act: the depot or outpost is checked
     (control at two round ends in a row decides it), then the next round
     begins with the other side first, or after the last round the battle
     is decided. Returns the result, or null while the battle goes on. */
  BR.endRound = function (battle) {
    if (!battle || battle.phase !== 'battle' || battle.result) return battle ? battle.result || null : null;
    var o = battle.objective;
    var line = 'Round ' + battle.round + ' ends.';
    if (o.zone) {
      var ctrl = BR.zoneControl(battle);
      o.held.player = ctrl === 'player' ? o.held.player + 1 : 0;
      o.held.enemy = ctrl === 'enemy' ? o.held.enemy + 1 : 0;
      var place = o.id === 'defend' ? 'your supply depot' : 'the outpost';
      if (ctrl) line += ' ' + (ctrl === 'player' ? 'You hold ' : 'The enemy holds ') + place + ' (' + plural(o.held[ctrl], 'round end') + ' in a row).';
      else line += ' Nobody holds ' + place + '.';
    }
    addLog(battle, null, line, 'round');
    var res = BR.checkResult(battle, true);
    if (res) return res;
    if (battle.round >= battle.maxRounds) return finalResult(battle);
    battle.round += 1;
    battle.units.forEach(function (u) { u.activated = false; });
    battle.firstSide = other(battle.firstSide);
    battle.turnSide = battle.firstSide;
    if (!BR.activeUnits(battle, battle.turnSide).length) {
      if (BR.activeUnits(battle, other(battle.turnSide)).length) battle.turnSide = other(battle.turnSide);
      else return BR.endRound(battle);
    }
    addLog(battle, null, 'Round ' + battle.round + ' begins: ' + (battle.turnSide === 'player' ? 'your forces act first.' : 'the enemy acts first.'), 'round');
    return null;
  };

  /* Nothing more can change (say the enemy has gone and you've finished):
     the rest of the battle plays out with nobody moving, round end by round
     end, to a result. */
  BR.endBattleEarly = function (battle) {
    if (!battle || battle.phase !== 'battle' || battle.result) return battle ? battle.result || null : null;
    addLog(battle, null, 'The rest of the battle plays out with no more moves, to the end of round ' + battle.maxRounds + '.', 'round');
    for (var guard = 0; guard <= battle.maxRounds + 1 && battle.phase === 'battle'; guard++) {
      battle.units.forEach(function (u) { u.activated = true; });
      BR.endRound(battle);
    }
    return battle.result;
  };
  /* True when one side has nothing left on the field (so endBattleEarly makes sense). */
  BR.canEndEarly = function (battle) {
    if (!battle || battle.phase !== 'battle' || battle.result) return false;
    function any(side) { return battle.units.some(function (u) { return u.side === side && BR.onField(u); }); }
    return !any('enemy') || !any('player');
  };

  /* Withdraw (once the battle has begun; before that it's Call off). */
  BR.withdraw = function (battle) {
    if (!battle || battle.phase !== 'battle' || battle.result) return null;
    return finish(battle, 'withdrawal', 'You withdrew from the field.');
  };

  /* ---------- Stat blocks (War Table tooltips, the War Room's list) ----------
     what: a battle unit, an archetype or beast entry from the data, an
     archetype id ('archers'), 'defenders', a beast's name, or 'lieutenant' /
     'captain'. Returns { title, rows: [{ key, name, value, text }],
     traits: [{ id, name, text }], distinction, notes: [text] }, or null. */
  BR.statBlock = function (what, data) {
    var D = data || W;
    var src = what;
    if (typeof src === 'string') {
      if (src === 'lieutenant' || src === 'captain') return leaderBlock(D, src);
      if (src === 'defenders') src = Object.assign({}, D.archetypes[D.defenders.profile], { name: 'Bastion Defenders' });
      else if (D.archetypes[src]) src = D.archetypes[src];
      else if (D.beasts[src]) src = Object.assign({ name: what }, D.beasts[src]);
      else return null;
    }
    if (!isObj(src)) return null;
    var unit = isObj(src.profile) ? src : null;
    var p = unit ? unit.profile : src;
    var title;
    var traits;
    var distinction;
    var notes = [];
    if (unit) {
      title = unit.label || unit.name || '';
      traits = Array.isArray(unit.traits) ? unit.traits.slice() : [];
      var base = unit.kind === 'beast' ? (D.beasts[unit.name] || D.beastDefault) :
        (unit.type === 'defenders' ? D.archetypes[D.defenders.profile] : D.archetypes[unit.type]);
      distinction = (base && base.distinction) || '';
      if (unit.variant && unit.variant.name && unit.variant.name !== title) notes.push(unit.variant.name + '.');
      if (unit.type === 'defenders') notes.push(unit.personnel + ' Bastion Defenders' + (unit.armed === false ? ', unarmed (' + signed(D.defenders.unarmedAttack) + ' Attack).' : '.'));
      if (unit.support) {
        var supBV = num(unit.support.bonus, 0) * W.defenders.supportBvPerPoint;
        notes.push('Supported by ' + unit.support.count + ' Bastion Defenders: ' + signed(unit.support.bonus) + ' Cohesion' + (supBV ? ', ' + signed(supBV) + ' Battle Value.' : '.'));
      }
      if (unit.kind !== 'beast' && unit.size && unit.personnel !== unit.size && unit.type !== 'defenders') notes.push(unit.personnel + ' of ' + unit.size + ' soldiers.');
    } else {
      title = src.name || '';
      traits = Array.isArray(src.traits) ? src.traits.slice() : [];
      if (src.trait && traits.indexOf(src.trait) === -1) traits.push(src.trait);
      distinction = src.distinction || '';
    }
    var hasRanged = p.rangedAttack !== undefined && p.rangedAttack !== null;
    var rows = D.stats.map(function (s) {
      var v = p[s.key];
      var value;
      var text = s.text;
      if (s.key === 'cohesion') value = unit ? unit.cohesion + ' / ' + unit.cohesionMax : String(num(v, 0));
      else if (s.key === 'attack') {
        value = hasRanged ? signed(num(p.rangedAttack, 0)) + ' ranged / ' + signed(num(p.attack, 0)) + ' melee' : signed(num(v, 0));
        if (hasRanged) text += ' Ranged attacks reach ' + num(p.range, 0) + ' squares.';
      } else if (s.key === 'resolve') value = signed(num(v, 0));
      /* A unit's own Battle Value counts any defenders supporting it, as
         the army's totals do, so the stat blocks add up to them. */
      else if (s.key === 'bv' && unit) value = String(BR.unitBV(unit));
      else value = String(num(v, 0));
      return { key: s.key, name: s.name, value: value, text: text };
    });
    return {
      title: title,
      rows: rows,
      traits: traits.filter(function (t) { return D.traits[t]; }).map(function (t) { return { id: t, name: D.traits[t].name, text: D.traits[t].text }; }),
      distinction: distinction,
      notes: notes
    };
  };
  function leaderBlock(D, which) {
    var l = which === 'captain' ? D.captain : D.lieutenant;
    var bvStat = D.stats.filter(function (s) { return s.key === 'bv'; })[0];
    return {
      title: l.name,
      rows: [{ key: 'bv', name: bvStat ? bvStat.name : 'Battle Value', value: String(l.bv), text: bvStat ? bvStat.text : '' }],
      traits: [],
      distinction: D.lieutenant.text,
      notes: []
    };
  }
}());
