/* The Ironbow Bastion Manager — the war mini-game's enemy commander (phase 2).

   One function decides what the enemy does with its next activation:
   chooseOrder(battle, terrain) returns an order for battleRules.resolveOrder.
   The same judgement can play your side too (chooseOrder(battle, terrain,
   'player')), so tests can play whole battles out with nobody at the table.

   - It plays by exactly the same rules as you: every square and target it
     picks comes from battleRules (reachable, attackOptions, previewAttack),
     and it only looks at what is on the table for everyone to see (where
     units stand, their Cohesion, Shaken or Holding, their printed numbers).
     It never peeks at dice to come.
   - No dice and no randomness at all: the same battle always gets the same
     order. Ties are settled by roster order, then by square (top row first,
     then left to right).
   - It never changes the battle: it only reads it.

   How it thinks, for one unit (first that applies):
   1. Raids, your side only: a unit standing on a supply marker picks it up;
      a carrier heads for home (Disengages first if it is caught in melee).
   2. Shaken and not in melee: Rally (with its leader's sure Rally if it
      still has one).
   3. In melee: attack the best adjacent target.
   4. Otherwise, the best attack it can make this activation (archers only
      shoot, never wade into melee by choice), unless its job is to stay
      put (keeping the outpost or depot, guarding a supply marker).
   5. Otherwise, move for the objective:
      - Raid (the enemy defending): one guard to each supply marker still on
        the ground, standing next to it (not on it, so it can still be
        picked up by fighting past the guard); the rest chase anyone
        carrying a marker, or close in.
        (Raid, your side: one runner to each marker, the rest escort.)
      - The outpost or depot its side holds: keep a Steady unit (two, in an
        army of three or more) inside it, archers only if nobody else can;
        the rest strike anything coming near it, and archers close enough
        to shoot into it.
      - The outpost or depot it must take: push into it, striking whatever
        blocks the way.
      - Skirmish: close in on the nearest enemy. It closes by stages: first
        as far as it can while staying out of reach of every enemy's melee,
        then on in, so it never stands off for good. It won't March into
        contact, where it couldn't attack.
      Archers, whatever their job, never end a move next to an enemy and
      never choose melee (only shots) unless they're already in it; while
      closing in they keep out of reach of enemy melee.
   6. Nothing useful: Hold.
   Which unit acts: one that can do the objective's urgent work right now
   (raids, your side), then units that can attack (the most expected damage
   first, a carrier as target before anything), then Rallies, then units
   moving for the objective (nearest to it first), then the rest (nearest
   the enemy first), and units that would only Hold last. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var bas = TSI.bastion = TSI.bastion || {};
  var AI = bas.warAI = {};

  /* ---------- The commander's habits (judgement, not game rules) ---------- */
  /* Units it keeps inside an outpost or depot it holds: 1 in an army of one
     or two, otherwise 2. */
  var KEEPERS_SMALL = 1;
  var KEEPERS = 2;
  /* An enemy unit within its Move + this of the held zone is "approaching" it. */
  var APPROACH_MARGIN = 2;
  /* Which unit acts first: lower tiers first. */
  var TIER = { urgent: 0, attack: 1, rally: 2, objective: 3, move: 4, hold: 5 };

  /* ---------- Small helpers ---------- */
  function BRules() { return bas.battleRules; }
  function W() { return (window.TSI_DATA && window.TSI_DATA.bastionWar) || {}; }
  function num(v, fallback) {
    var n = Number(v);
    return v === null || v === undefined || v === '' || !isFinite(n) ? fallback : n;
  }
  function key(cell) { return cell.c + ',' + cell.r; }
  function same(a, b) { return !!a && !!b && a.c === b.c && a.r === b.r; }
  function dist(a, b) { return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)); }
  function last(path) { return path[path.length - 1]; }
  function isRanged(u) { return !!u && !!u.profile && u.profile.rangedAttack !== undefined && u.profile.rangedAttack !== null; }
  /* Lexicographic comparison of two score lists: negative when a comes first. */
  function cmp(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return 0;
  }
  function round3(v) { return Math.round(v * 1000) / 1000; }
  /* Squares from a zone (Chebyshev; 0 inside it). */
  function zoneDist(z, cell) {
    var dc = Math.max(z.c0 - cell.c, 0, cell.c - z.c1);
    var dr = Math.max(z.r0 - cell.r, 0, cell.r - z.r1);
    return Math.max(dc, dr);
  }
  function minDist(cell, units) {
    var best = Infinity;
    for (var i = 0; i < units.length; i++) best = Math.min(best, dist(cell, units[i].pos));
    return best;
  }

  /* The expected Cohesion damage of an attack worked out by previewAttack:
     the average over the twenty faces of the d20. */
  AI.expectedDamage = function (pv) {
    if (!pv) return 0;
    var BR = BRules();
    var sum = 0;
    for (var d = 1; d <= 20; d++) sum += BR.damageFor(d, d + pv.attack + pv.modTotal, pv.defence);
    return sum / 20;
  };

  /* ---------- What the commander sees ---------- */
  function makeCtx(battle, terrain, side) {
    var BR = BRules();
    var ctx = {
      BR: BR, battle: battle, tt: BR.fitTerrain(battle, terrain), side: side,
      index: {}, reach: {}, threatCache: {}
    };
    battle.units.forEach(function (u, i) { ctx.index[u.id] = i; });
    ctx.mine = battle.units.filter(function (u) { return u.side === side && BR.onField(u); });
    ctx.opp = BR.enemiesOf(battle, side);
    ctx.oppReach = ctx.opp.map(function (o) {
      var mv = BR.effectiveMove(battle, o);
      return { u: o, melee: mv + 1, ranged: isRanged(o) ? mv + num(o.profile.range, 0) : 0 };
    });
    /* Squares next to an enemy: the only places a melee attack can come from. */
    ctx.adjOpp = {};
    ctx.opp.forEach(function (o) {
      for (var dc = -1; dc <= 1; dc++) for (var dr = -1; dr <= 1; dr++) if (dc || dr) ctx.adjOpp[(o.pos.c + dc) + ',' + (o.pos.r + dr)] = true;
    });
    var o = battle.objective || { id: 'skirmish' };
    ctx.objective = o;
    ctx.zone = o.zone || null;
    if (ctx.zone) ctx.role = ctx.zone.owner === side ? 'holder' : 'taker';
    else if (o.id === 'raid') ctx.role = side === 'player' ? 'raider' : 'defender';
    else ctx.role = 'skirmish';
    ctx.fieldMarkers = (o.markers || []).filter(function (m) { return m.state === 'field'; });
    ctx.home = BR.baseline(battle, side);
    /* Squares it won't end a move on: the defenders of a raid keep off the
       supply markers (only the raiders can pick them up, so a defender
       standing on one would simply block it). */
    ctx.noStand = {};
    if (ctx.role === 'defender') ctx.fieldMarkers.forEach(function (m) { ctx.noStand[key(m)] = true; });
    ctx.oppCarriers = ctx.opp.filter(function (u) { return !!u.carrying; });
    ctx.myCarriers = ctx.mine.filter(function (u) { return !!u.carrying; });
    assignRoles(ctx);
    return ctx;
  }

  /* Each unit's job this activation (worked out afresh every time, from the
     whole of its side on the field, so the jobs fit together).
     roles[unitId] = { role, marker? }. */
  function assignRoles(ctx) {
    var BR = ctx.BR;
    var roles = ctx.roles = {};
    var idx = ctx.index;
    function set(list, role) { list.forEach(function (u) { if (!roles[u.id]) roles[u.id] = { role: role }; }); }
    /* Can it set off for a square? Not while caught in melee, unless it's
       already next to (or on) that square. */
    function canSetOff(u, cell) { return dist(u.pos, cell) <= 1 || !BR.isEngaged(ctx.battle, u); }
    /* One unit to each marker, nearest pairs first (non-archers before archers). */
    function toMarkers(units, markers, role) {
      var pools = [units.filter(function (u) { return !isRanged(u); }), units.filter(isRanged)];
      var left = markers.slice();
      pools.forEach(function (pool) {
        var pairs = [];
        pool.forEach(function (u) {
          left.forEach(function (m, j) { if (canSetOff(u, m)) pairs.push([dist(u.pos, m), idx[u.id], j, u, m]); });
        });
        pairs.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; });
        var usedU = {};
        var usedM = {};
        pairs.forEach(function (p) {
          if (usedU[p[3].id] || usedM[p[4].id] || roles[p[3].id]) return;
          usedU[p[3].id] = true;
          usedM[p[4].id] = true;
          roles[p[3].id] = { role: role, marker: p[4] };
        });
        left = left.filter(function (m) { return !usedM[m.id]; });
      });
    }

    if (ctx.role === 'defender') {
      toMarkers(ctx.mine, ctx.fieldMarkers, 'guard');
      set(ctx.mine, ctx.oppCarriers.length ? 'interceptor' : 'screen');
    } else if (ctx.role === 'raider') {
      set(ctx.myCarriers, 'carrier');
      var need = num(W().objectives && W().objectives.raid && W().objectives.raid.need, 2);
      var wanted = need - num(ctx.objective.extracted, 0) - ctx.myCarriers.length;
      if (wanted > 0) {
        /* The markers nearest this side's runners, one spare. */
        var free = ctx.mine.filter(function (u) { return !u.carrying; });
        var ms = ctx.fieldMarkers.slice().sort(function (a, b) {
          return minDist(a, free) - minDist(b, free) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        }).slice(0, wanted + 1);
        toMarkers(free, ms, 'runner');
      }
      set(ctx.mine, 'escort');
    } else if (ctx.role === 'holder') {
      var z = ctx.zone;
      /* Steady first, and archers last: they'd rather shoot than hold ground. */
      var rank = function (u) { return (u.status === 'steady' ? 0 : 2) + (isRanged(u) ? 1 : 0); };
      var inside = ctx.mine.filter(function (u) { return BR.inZone(z, u.pos); }).sort(function (a, b) {
        return rank(a) - rank(b) || idx[a.id] - idx[b.id];
      });
      var k = ctx.mine.length <= 2 ? KEEPERS_SMALL : KEEPERS;
      set(inside.slice(0, k), 'keeper');
      var missing = Math.max(0, k - inside.length);
      if (!missing && !inside.some(function (u) { return u.status === 'steady'; })) missing = 1;
      var outside = ctx.mine.filter(function (u) { return !BR.inZone(z, u.pos) && (zoneDist(z, u.pos) <= 1 || !BR.isEngaged(ctx.battle, u)); }).sort(function (a, b) {
        return rank(a) - rank(b) || zoneDist(z, a.pos) - zoneDist(z, b.pos) || idx[a.id] - idx[b.id];
      });
      set(outside.slice(0, missing), 'incoming');
      set(ctx.mine, 'striker');
    } else if (ctx.role === 'taker') {
      set(ctx.mine, 'taker');
    } else {
      set(ctx.mine, 'skirmisher');
    }
  }

  /* Where a unit can go with an order (worked out once per unit per order). */
  function reach(ctx, u, orderId) {
    var r = ctx.reach[u.id] || (ctx.reach[u.id] = {});
    if (!r[orderId]) r[orderId] = ctx.BR.reachable(ctx.battle, u.id, orderId, ctx.tt);
    return r[orderId];
  }

  /* How many enemy units could attack this square on their next activation
     (from where they stand now: Move + 1 for melee, Move + range for
     archers). meleeOnly leaves the arrows out. Terrain and other units are
     ignored: a quick, cautious count. */
  function threatAt(ctx, cell, meleeOnly) {
    var k = key(cell) + (meleeOnly ? 'm' : '');
    if (ctx.threatCache[k] !== undefined) return ctx.threatCache[k];
    var n = 0;
    ctx.oppReach.forEach(function (r) {
      var d = dist(r.u.pos, cell);
      if (d <= r.melee || (!meleeOnly && r.ranged && d <= r.ranged)) n += 1;
    });
    ctx.threatCache[k] = n;
    return n;
  }

  /* ---------- Attacks ---------- */
  /* Every attack the unit could make: from its own square when it is in
     melee, else from every square it can reach with Advance & Attack.
     Archers only shoot unless they are already in melee. */
  function attackCands(ctx, u, engaged) {
    var BR = ctx.BR;
    var out = [];
    var ranged = isRanged(u);
    var edCache = {};
    function add(S, path, cost) {
      BR.attackOptions(ctx.battle, u.id, S, path, ctx.tt).forEach(function (opt) {
        if (ranged && !engaged && opt.kind !== 'ranged') return;
        var ed;
        var pv = null;
        /* A shot's odds don't depend on where it's shot from. */
        if (opt.kind === 'ranged' && edCache[opt.targetId] !== undefined) ed = edCache[opt.targetId];
        else {
          pv = BR.previewAttack(ctx.battle, u.id, S, path, opt.targetId, ctx.tt);
          if (!pv) return;
          ed = round3(AI.expectedDamage(pv));
          if (opt.kind === 'ranged') edCache[opt.targetId] = ed;
        }
        out.push({ S: S, path: path, cost: cost, opt: opt, ed: ed, target: BR.unitById(ctx.battle, opt.targetId) });
      });
    }
    if (engaged) {
      add({ c: u.pos.c, r: u.pos.r }, [{ c: u.pos.c, r: u.pos.r }], 0);
      return out;
    }
    var ra = reach(ctx, u, 'advance');
    Object.keys(ra).forEach(function (k) {
      if (!ranged && !ctx.adjOpp[k]) return;
      if (ctx.noStand[k] && ra[k].cost > 0) return;
      add(last(ra[k].path), ra[k].path, ra[k].cost);
    });
    return out;
  }

  /* How much the objective wants this target hit (higher first). */
  function objectiveWeight(ctx, roleInfo, t) {
    var BR = ctx.BR;
    if (ctx.zone) {
      var dz = zoneDist(ctx.zone, t.pos);
      return dz === 0 ? 2 : (dz === 1 ? 1 : 0);
    }
    if (ctx.role === 'defender') {
      return ctx.fieldMarkers.some(function (m) { return dist(m, t.pos) <= 1; }) ? 1 : 0;
    }
    if (ctx.role === 'raider') {
      if (ctx.myCarriers.some(function (c) { return BR.adjacent(c.pos, t.pos); })) return 2;
      if (roleInfo && roleInfo.marker && dist(roleInfo.marker, t.pos) <= 1) return 1;
    }
    return 0;
  }
  /* The target's worth (higher first): a carrier, then what the objective
     wants, then a Charge, then a Shaken unit, then the lowest Cohesion,
     then the most expected damage. */
  function attackScore(ctx, roleInfo, a) {
    var t = a.target;
    return [t.carrying ? 1 : 0, objectiveWeight(ctx, roleInfo, t), a.opt.charge ? 1 : 0, t.status === 'shaken' ? 1 : 0, -t.cohesion, a.ed];
  }
  /* The best attack among cands (optionally filtered): the target's worth,
     then the safest square, then the shortest move, then roster order, then
     square order. */
  function pickAttack(ctx, u, cands, filter) {
    var roleInfo = ctx.roles[u.id];
    var best = null;
    var bestKey = null;
    cands.forEach(function (a) {
      if (filter && !filter(a)) return;
      var s = attackScore(ctx, roleInfo, a);
      var k = s.map(function (v) { return -v; }).concat([threatAt(ctx, a.S, false), a.cost, ctx.index[a.target.id], a.S.r, a.S.c]);
      if (!bestKey || cmp(k, bestKey) < 0) { best = a; bestKey = k; }
    });
    return best;
  }

  /* ---------- Plans ---------- */
  function plan(u, order, rule, tier, sortKey, extra) {
    order.unitId = u.id;
    order.rule = rule;
    var p = { unitId: u.id, order: order, rule: rule, tier: tier, sortKey: [tier].concat(sortKey || []) };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }
  function attackPlan(ctx, u, a, rule) {
    var order = { id: 'advance', targetId: a.target.id };
    if (!same(a.S, u.pos)) order.dest = { c: a.S.c, r: a.S.r };
    var r = rule || (a.opt.kind === 'ranged' ? 'shoot' : (a.opt.charge ? 'charge' : 'attack'));
    return plan(u, order, r, TIER.attack, [-(a.target.carrying ? 1 : 0), -a.ed], { expected: a.ed });
  }
  function holdPlan(u, rule) { return plan(u, { id: 'hold' }, rule || 'hold', TIER.hold, []); }
  function rallyPlan(ctx, u) {
    var l = ctx.BR.leaderOf(ctx.battle, u);
    var order = { id: 'rally' };
    if (l && num(l.autoRallyLeft, 0) > 0) order.useLeaderRally = true;
    return plan(u, order, 'rally', TIER.rally, []);
  }

  /* Move toward a goal: goal(cell) → a number, lower is better (0: there).
     opts: safe (archers: no square more enemy melee could reach than
     here), edge (close in by stages: first as far as it can while still
     out of reach of every enemy's melee; only from there into reach),
     march (also look at March squares), avoidContact (rather not March
     next to an enemy, where it couldn't attack), onlyArrive (only a square
     at goal 0 will do). Archers never end a move next to an enemy. "Reach"
     here is always melee reach (Move + 1): an archer's range never stops
     a unit closing in, or it would stand still while it was shot.
     Returns a plan, or null if no square is better than staying put. */
  function movePlan(ctx, u, goal, opts, rule, tier) {
    var BR = ctx.BR;
    var o = opts || {};
    var cur = u.pos;
    var gCur = goal(cur);
    var ranged = isRanged(u);
    var tCur = threatAt(ctx, cur, true);
    var ra = reach(ctx, u, 'advance');
    var best = null;
    var bestKey = null;
    var edge = null;
    var edgeKey = null;
    function consider(rc, id) {
      Object.keys(rc).forEach(function (k) {
        if (id === 'march' && ra[k]) return;
        var e = rc[k];
        var S = last(e.path);
        if (same(S, cur)) return;
        /* Archers never walk into contact: that would only leave them a
           melee attack at +1. */
        if (ranged && ctx.adjOpp[k]) return;
        if (ctx.noStand[k]) return;
        var th = threatAt(ctx, S, true);
        if (o.safe && th > tCur) return;
        var g = goal(S);
        if (!isFinite(g)) return;
        var contact = ctx.adjOpp[k] && id === 'march' ? 1 : 0;
        var sk = o.avoidContact ? [contact, g, th, e.cost, S.r, S.c] : [g, contact, th, e.cost, S.r, S.c];
        var cand = { id: id, S: S, path: e.path, g: g };
        if (!bestKey || cmp(sk, bestKey) < 0) { best = cand; bestKey = sk; }
        if (o.edge && th === 0 && (!edgeKey || cmp(sk, edgeKey) < 0)) { edge = cand; edgeKey = sk; }
      });
    }
    consider(ra, 'advance');
    if (o.march) consider(reach(ctx, u, 'march'), 'march');
    /* Closing in by stages: to the edge of the enemy's reach if that's
       nearer than here; otherwise on in (never standing off for good). */
    if (edge && edge.g < gCur) best = edge;
    if (!best || !(best.g < gCur)) return null;
    if (o.onlyArrive && best.g > 0) return null;
    var order = { id: best.id, dest: { c: best.S.c, r: best.S.r } };
    if (best.id === 'advance') {
      /* Arriving next to an enemy anyway (or, for archers, with a shot):
         strike while there. Archers only shoot. */
      var free = [];
      BR.attackOptions(ctx.battle, u.id, best.S, best.path, ctx.tt).forEach(function (opt) {
        if (ranged && opt.kind !== 'ranged') return;
        var pv = BR.previewAttack(ctx.battle, u.id, best.S, best.path, opt.targetId, ctx.tt);
        if (pv) free.push({ S: best.S, path: best.path, cost: 0, opt: opt, ed: round3(AI.expectedDamage(pv)), target: BR.unitById(ctx.battle, opt.targetId) });
      });
      var a = pickAttack(ctx, u, free);
      if (a) order.targetId = a.target.id;
    }
    var sortKey = tier === TIER.move ? [minDist(cur, ctx.opp)] : [best.g];
    return plan(u, order, rule, tier, sortKey);
  }

  /* A carrier (raid, your side) heads home: out of melee first if it can,
     then by March to its own edge. */
  function carrierPlan(ctx, u, engaged) {
    var home = ctx.home;
    function g(cell) { return Math.abs(cell.r - home); }
    if (engaged) {
      var rd = reach(ctx, u, 'disengage');
      var best = null;
      var bestKey = null;
      Object.keys(rd).forEach(function (k) {
        var S = last(rd[k].path);
        var sk = [g(S), threatAt(ctx, S, false), rd[k].cost, S.r, S.c];
        if (!bestKey || cmp(sk, bestKey) < 0) { best = S; bestKey = sk; }
      });
      if (best) return plan(u, { id: 'disengage', dest: { c: best.c, r: best.r } }, 'carry-escape', TIER.urgent, [g(best)]);
      return null;
    }
    return movePlan(ctx, u, g, { march: true }, 'carry', TIER.urgent);
  }

  /* The goal for closing in on the enemy: archers want them in range,
     everyone else wants to be next to them. */
  function approachGoal(u, targets) {
    var range = isRanged(u) ? num(u.profile.range, 1) : 1;
    return function (cell) {
      if (!targets.length) return Infinity;
      return Math.max(0, minDist(cell, targets) - range);
    };
  }
  /* Close in. Archers only where no more enemy melee could reach them than
     here; everyone else by stages (to the edge of the enemy's reach, then
     on in), and never by Marching into contact. */
  function approachPlan(ctx, u, targets, rule) {
    if (!targets.length) return null;
    var opts = isRanged(u) ? { safe: true, march: true, avoidContact: true } : { edge: true, march: true, avoidContact: true };
    return movePlan(ctx, u, approachGoal(u, targets), opts, rule || 'approach', TIER.move);
  }

  /* The plan for one unit. */
  function planUnit(ctx, u) {
    var BR = ctx.BR;
    var battle = ctx.battle;
    var info = ctx.roles[u.id] || { role: 'skirmisher' };
    var role = info.role;
    var z = ctx.zone;
    var engaged = BR.isEngaged(battle, u);
    var p;

    /* 1. Raids (your side): pick up the marker underfoot; carry it home. */
    if (role === 'carrier') {
      p = carrierPlan(ctx, u, engaged);
      if (p) return p;
    }
    if (ctx.role === 'raider' && !u.carrying && BR.fieldMarkerAt(battle, u.pos)) return plan(u, { id: 'interact' }, 'interact', TIER.urgent, []);
    /* 2. Shaken and out of melee: Rally. */
    if (u.status === 'shaken' && !engaged) return rallyPlan(ctx, u);
    /* 3. In melee: strike the best adjacent target. */
    if (engaged) {
      var here = pickAttack(ctx, u, attackCands(ctx, u, true));
      return here ? attackPlan(ctx, u, here, 'melee') : holdPlan(u);
    }
    var cands = attackCands(ctx, u, false);
    var any = pickAttack(ctx, u, cands);
    function inZone(a) { return BR.inZone(z, a.S); }

    /* 4 and 5, by the unit's job. */
    if (role === 'keeper') {
      var kp = pickAttack(ctx, u, cands, inZone);
      return kp ? attackPlan(ctx, u, kp) : holdPlan(u, 'hold-zone');
    }
    if (role === 'taker' && BR.inZone(z, u.pos)) {
      var tp = pickAttack(ctx, u, cands, inZone);
      return tp ? attackPlan(ctx, u, tp) : holdPlan(u, 'hold-zone');
    }
    if (role === 'incoming' || role === 'taker') {
      var zoneGoal = function (cell) { return zoneDist(z, cell); };
      /* From inside the zone; or at a unit in or next to it (archers may
         shoot it from where they are). */
      var fromZone = pickAttack(ctx, u, cands, function (a) { return inZone(a) || ((role === 'taker' || isRanged(u)) && zoneDist(z, a.target.pos) <= 1); });
      if (fromZone) return attackPlan(ctx, u, fromZone);
      if (!(role === 'taker' && isRanged(u))) {
        p = movePlan(ctx, u, zoneGoal, { march: true, onlyArrive: true }, role === 'taker' ? 'push' : 'keep', TIER.objective);
        if (p) return p;
      }
      if (any) return attackPlan(ctx, u, any);
      if (role === 'taker' && isRanged(u)) {
        var near = ctx.opp.filter(function (o) { return zoneDist(z, o.pos) <= 1; });
        return approachPlan(ctx, u, near.length ? near : ctx.opp) || holdPlan(u);
      }
      /* Not there this activation: get closer, but not by Marching into
         contact where it can't strike first. */
      return movePlan(ctx, u, zoneGoal, { march: true, avoidContact: true }, role === 'taker' ? 'push' : 'keep', TIER.objective) || holdPlan(u);
    }
    if (role === 'guard') {
      /* It stands next to its marker, not on it, so your units can still
         reach the marker and pick it up by fighting past the guard. */
      var m = info.marker;
      var gp = pickAttack(ctx, u, cands, function (a) { return !!a.target.carrying || dist(a.S, m) <= 1 || (isRanged(u) && dist(a.target.pos, m) <= 1); });
      if (gp) return attackPlan(ctx, u, gp);
      return movePlan(ctx, u, function (cell) { return Math.abs(dist(cell, m) - 1); }, { march: true }, 'guard', TIER.objective) || holdPlan(u, 'hold-guard');
    }
    if (role === 'runner') {
      /* Onto the marker if it can; else strike something on the way (or
         guarding the marker); else run for it; else any attack. */
      var mk = info.marker;
      var toMarker = function (cell) { return dist(cell, mk); };
      p = movePlan(ctx, u, toMarker, { march: true, onlyArrive: true }, 'run', TIER.objective);
      if (p) return p;
      var onWay = pickAttack(ctx, u, cands, function (a) { return dist(a.S, mk) < dist(u.pos, mk) || dist(a.target.pos, mk) <= 1; });
      if (onWay) return attackPlan(ctx, u, onWay);
      return movePlan(ctx, u, toMarker, { march: true }, 'run', TIER.objective) || (any ? attackPlan(ctx, u, any) : holdPlan(u));
    }
    if (any) return attackPlan(ctx, u, any);
    if (role === 'interceptor') {
      var carriers = ctx.oppCarriers;
      var home = BR.baseline(battle, ctx.side === 'player' ? 'enemy' : 'player');
      /* Get next to the carrier, ideally between it and its way home (the
         fraction only settles ties between squares equally near). */
      var ig = function (cell) {
        var best = Infinity;
        carriers.forEach(function (c) { best = Math.min(best, dist(cell, c.pos) + Math.abs(cell.r - home) / 1000); });
        return best;
      };
      if (isRanged(u)) return approachPlan(ctx, u, carriers, 'intercept') || holdPlan(u);
      return movePlan(ctx, u, ig, { march: true }, 'intercept', TIER.objective) || holdPlan(u);
    }
    if (role === 'striker') {
      /* Coming: within its Move + 2 of the zone, or archers close enough to
         shoot into it from where they stand. */
      var coming = ctx.oppReach.filter(function (r) {
        var dz = zoneDist(z, r.u.pos);
        return dz <= r.melee - 1 + APPROACH_MARGIN || (r.ranged > 0 && dz <= num(r.u.profile.range, 0));
      }).map(function (r) { return r.u; });
      if (coming.length) return approachPlan(ctx, u, coming, 'strike') || holdPlan(u);
      if (zoneDist(z, u.pos) > 1) {
        return movePlan(ctx, u, function (cell) { return Math.max(0, zoneDist(z, cell) - 1); }, { march: true, avoidContact: true, safe: isRanged(u) }, 'cover-zone', TIER.objective) || holdPlan(u);
      }
      return holdPlan(u);
    }
    /* Skirmish, screens and escorts: close in on the nearest enemy. */
    return approachPlan(ctx, u, ctx.opp) || holdPlan(u);
  }

  /* ---------- The public functions ---------- */
  function sideOf(side) { return side === 'player' ? 'player' : 'enemy'; }
  function ready(battle, side) {
    if (!battle || battle.phase !== 'battle' || battle.result || !Array.isArray(battle.units)) return false;
    return battle.turnSide === side;
  }

  /* Every plan for the side's units that can still act, best first (the
     first is the one chooseOrder returns). [] when it isn't that side's
     turn. */
  AI.plans = function (battle, terrain, side) {
    var s = sideOf(side);
    if (!ready(battle, s)) return [];
    var BR = BRules();
    var active = BR.activeUnits(battle, s);
    if (!active.length) return [];
    var ctx = makeCtx(battle, terrain, s);
    var plans = active.map(function (u) {
      var p = planUnit(ctx, u);
      p.sortKey = p.sortKey.concat([ctx.index[u.id]]);
      return p;
    });
    plans.sort(function (a, b) { return cmp(a.sortKey, b.sortKey); });
    return plans;
  };

  /* The order for the side's next activation (the enemy's unless side is
     'player'), or null when it isn't that side's turn or it has nobody left
     to act. The order is { unitId, id, dest?, targetId?, useLeaderRally? }
     plus rule, a short tag naming the reason (e.g. 'rally', 'charge',
     'hold-zone'), which resolveOrder ignores. */
  AI.chooseOrder = function (battle, terrain, side) {
    var plans = AI.plans(battle, terrain, side);
    return plans.length ? plans[0].order : null;
  };

  /* The plan for one particular unit of the side whose turn it is (for
     tests, and for a "what would the enemy do with this unit" hint), or
     null. */
  AI.planFor = function (battle, unitId, terrain) {
    var BR = BRules();
    var u = BR.unitById(battle, unitId);
    if (!u || !ready(battle, u.side) || !BR.onField(u) || u.activated) return null;
    return planUnit(makeCtx(battle, terrain, u.side), u);
  };

  /* Plays the battle out to its result with both sides chosen here (for
     tests). rand: the dice. Returns { steps, refused: [{ order, why }],
     result }. An order the rules refuse (which shouldn't happen) is
     recorded and replaced by Hold. */
  AI.playOut = function (battle, terrain, rand, opts) {
    var BR = BRules();
    var max = num(opts && opts.maxSteps, 5000);
    var steps = 0;
    var refused = [];
    while (battle && battle.phase === 'battle' && !battle.result && steps < max) {
      var order = AI.chooseOrder(battle, terrain, battle.turnSide);
      if (!order) break;
      var res = BR.resolveOrder(battle, order, terrain, rand);
      if (!res.ok) {
        refused.push({ order: order, why: res.why });
        res = BR.resolveOrder(battle, { unitId: order.unitId, id: 'hold' }, terrain, rand);
        if (!res.ok) break;
      }
      steps += 1;
    }
    return { steps: steps, refused: refused, result: battle ? battle.result : null };
  };
}());
