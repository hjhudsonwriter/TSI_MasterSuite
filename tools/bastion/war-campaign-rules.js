/* The Ironbow Bastion Manager — the war mini-game's campaign rules (phase 2).

   The Bastion's side of a war, as plain functions added to the Bastion's
   rules (TSI.bastion.rules), with no screen code, so they can be tested on
   tests/rules.html (tests/rules/bastion-campaign.test.js):
   - the Military list: War Room units by type, regiments that came home
     under strength ("depleted"), and replacements from the War Room;
   - what can be committed to a war, counting every regiment, beast,
     Lieutenant and defender once, and leaving out anyone still recovering;
   - missions: the enemy army for a target clan, objective and size of
     force, drawn up once from its own seeded dice and saved, and the
     intelligence estimate the War Council shows;
   - the Military Action: from the war order to the battle's starting
     line-up (the "spec" the battle rules build the battle from);
   - after the battle: casualties, Lieutenants and beasts who were hurt,
     rewards and the War Report, all applied exactly once;
   - recovery each Bastion turn, and loading saves from before phase 2.
   Every number comes from data/war-units-data.js (TSI_DATA.bastionWar) or
   the Bastion's existing war amounts (data/bastion-data.js). Nothing here
   uses Math.random or the clock: dice come in as rand(), and a mission's
   dice are seeded from its key, the turn and a counter. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.bastion = TSI.bastion || {};
  var R = ns.rules;
  if (!R) return;
  var clampInt = R.clampInt;

  /* ---------- Small helpers ---------- */
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function clone(v) { return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)); }
  function round05(x) { return Math.round(x * 2) / 2; }
  function sum(map) { return Object.keys(map || {}).reduce(function (a, k) { return a + (Number(map[k]) || 0); }, 0); }
  function signed(n) { return n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function cap(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

  /* The war's numbers: data.war when a test passes its own, otherwise the
     data file's TSI_DATA.bastionWar. */
  function wd(data) { return (data && data.war) || (window.TSI_DATA && window.TSI_DATA.bastionWar) || null; }
  R.warData = wd;

  /* A few numbers the data file doesn't have (yet). If war-units-data.js
     gains a field of the same name, that's used instead. */
  var DEFAULTS = {
    variantChance: 0.75, /* how often a clan fields its variant instead of the plain unit */
    beastWeight: 1,      /* a clan beast's weight when the enemy army is picked */
    overshoot: 1,        /* an enemy army may come out at most this much over its budget */
    maxMissions: 12      /* missions kept at once */
  };
  function setting(w, key) { return w && typeof w[key] === 'number' ? w[key] : DEFAULTS[key]; }
  /* A Brigade's Trusted Clients after a war: the amounts R.resolveWar has
     always used (target clan, and every other clan), unless the data file
     gains rewards.trusted in the same shape. */
  var TRUSTED = { success: { target: -8, others: 1 }, failure: { target: -4, others: -1 } };

  var OUTCOMES = ['victory', 'defeat', 'draw', 'withdrawal'];
  var STATUS_NAMES = { steady: 'Steady', shaken: 'Shaken', routed: 'Routed', defeated: 'Defeated' };
  R.MILITARY_STEPS = ['weather', 'morale', 'luck', 'deploy', 'battle'];
  var PHASE1_STEPS = ['weather', 'morale', 'luck', 'deploy', 'resolve'];

  /* A seeded dice roller (mulberry32): the same seed always gives the same
     rolls, from 0 up to (not including) 1. */
  R.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  R.missionSeed = function (key, turn, seq) { return parseInt(R.hashText(key + ':' + turn + ':' + seq), 16) >>> 0; };

  R.clanName = function (data, key) {
    var list = (data && data.bastion && data.bastion.clans) || [];
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i].name;
    return key ? cap(String(key)) : 'Unknown';
  };
  function tierOf(w, id) {
    for (var i = 0; i < w.tiers.length; i++) if (w.tiers[i].id === id) return w.tiers[i];
    return null;
  }

  /* ---------- Unit types and names ---------- */
  /* What a Military row is: an archetype id ('line'), 'lieutenant', or null.
     "Line Infantry (100)", "line infantry", "line" all read as Line
     Infantry; a "Regiment (100)" from before phase 2 is Line Infantry too. */
  R.unitTypeOf = function (name, data) {
    var w = wd(data);
    var raw = String(name || '').trim();
    if (!raw || !w) return null;
    if (/lieutenant/i.test(raw)) return 'lieutenant';
    var lower = raw.toLowerCase();
    var base = lower.replace(/\s*\(\s*\d+\s*\)\s*$/, '').trim();
    for (var i = 0; i < w.warRoom.length; i++) {
      var e = w.warRoom[i];
      if (e.type && e.label.toLowerCase() === lower) return e.type;
    }
    var ids = Object.keys(w.archetypes);
    for (var j = 0; j < ids.length; j++) {
      var a = w.archetypes[ids[j]];
      if (a.name.toLowerCase() === base || a.id === base) return a.id;
    }
    if (w.legacyRegiment && (w.legacyRegiment.label.toLowerCase() === lower || base === 'regiment')) return w.legacyRegiment.type;
    return null;
  };

  /* Short names for tokens: "LI2" for Line Infantry 2. The plain units have
     fixed ones (Levy and Line would both be "LI" otherwise); anything else
     uses its initials, and two names that share initials get longer ones
     ("BlB" and "BrB" for a Black Bear and a Brown Bear). */
  var TYPE_SHORT = { levy: 'LV', line: 'LI', heavy: 'HI', archers: 'AR', light_cav: 'LC', shock_cav: 'SC' };
  function shortBases(units, w) {
    var bases = {}, owners = {};
    units.forEach(function (u) {
      if (bases[u.name]) return;
      var plain = w.archetypes[u.type] && w.archetypes[u.type].name === u.name;
      bases[u.name] = plain && TYPE_SHORT[u.type] ? TYPE_SHORT[u.type] : R.forceInitials(u.name);
      (owners[bases[u.name]] = owners[bases[u.name]] || []).push(u.name);
    });
    Object.keys(owners).forEach(function (b) {
      if (owners[b].length < 2) return;
      var longer = owners[b].map(function (name) {
        var words = name.trim().split(/\s+/);
        var l = words.length > 1 ? words[0].slice(0, 2) + words[words.length - 1].charAt(0).toUpperCase() : words[0].slice(0, 3);
        return l.charAt(0).toUpperCase() + l.slice(1);
      });
      /* Still the same (two names alike to the letter): numbered apart. */
      longer.forEach(function (l, i) { bases[owners[b][i]] = longer.indexOf(l) !== longer.lastIndexOf(l) ? l + (i + 1) : l; });
    });
    return bases;
  }
  /* The enemy's labels start with the clan's name ("Bacca Line Infantry 2"),
     as its variants and Captains do, so the battle log, the War Table and
     the War Report never mix them up with your own "Line Infantry 2". The
     short names on the tokens are unchanged. Doing it twice changes nothing. */
  function clanLabels(units, clanName) {
    (Array.isArray(units) ? units : []).forEach(function (u) {
      if (!isObj(u) || !clanName) return;
      var label = String(u.label || u.name || '');
      if (label.indexOf(clanName + ' ') !== 0) u.label = clanName + ' ' + label;
    });
  }
  /* Labels and short names for one side's units, numbered when there are
     several of a name: "Line Infantry 2" / "LI2" ("G10" from ten). */
  function nameUnits(units, w) {
    var bases = shortBases(units, w), totals = {}, seen = {};
    units.forEach(function (u) { totals[u.name] = (totals[u.name] || 0) + 1; });
    units.forEach(function (u) {
      var n = seen[u.name] = (seen[u.name] || 0) + 1;
      var many = totals[u.name] > 1, base = bases[u.name];
      u.label = many ? u.name + ' ' + n : u.name;
      u.short = many ? (n < 10 ? base : base.charAt(0)) + n : base;
    });
  }

  /* A unit's printed profile, with its traits' changes included (Steady +1
     Resolve, Armoured +1 Defence, Fleet +1 Move): the battle reads the
     profile as printed and doesn't add them again. */
  function profileOf(base, traits, w) {
    var p = { cohesion: base.cohesion, attack: base.attack };
    if (base.rangedAttack !== undefined) { p.rangedAttack = base.rangedAttack; p.range = base.range; }
    p.defence = base.defence;
    p.move = base.move;
    p.resolve = base.resolve;
    p.bv = base.bv;
    traits.forEach(function (id) {
      var t = w.traits[id];
      if (!t) return;
      if (typeof t.defence === 'number') p.defence += t.defence;
      if (typeof t.move === 'number') p.move += t.move;
      if (typeof t.resolve === 'number') p.resolve += t.resolve;
    });
    return p;
  }
  /* A regiment under strength: Cohesion max(1, round(Cohesion × soldiers ÷
     full size)), Battle Value likewise to the nearest half (at least ½).
     Everything else is unchanged. */
  function scaleProfile(p, personnel, size) {
    if (personnel >= size) return p;
    var f = personnel / size;
    p.cohesion = Math.max(1, Math.round(p.cohesion * f));
    p.bv = Math.max(0.5, round05(p.bv * f));
    return p;
  }
  R.unitBV = function (data, type, personnel) {
    var a = wd(data).archetypes[type];
    if (!a) return 0;
    var n = personnel === undefined ? a.size : clampInt(personnel, 0, a.size);
    return n >= a.size ? a.bv : Math.max(0.5, round05(a.bv * n / a.size));
  };

  /* ---------- The Military list ---------- */
  function rowQty(row) { return clampInt(row && row.qty !== undefined && row.qty !== null ? row.qty : 1, 0); }
  function isDepleted(row) { return isObj(row) && row.depleted === true; }

  /* Every regiment on the list by type: how many at full strength, and the
     depleted rows. */
  function regimentsOf(s, data) {
    var w = wd(data), out = {};
    Object.keys(w.archetypes).forEach(function (t) { out[t] = { full: 0, depleted: [] }; });
    (Array.isArray(s.military) ? s.military : []).forEach(function (row) {
      if (!isObj(row)) return;
      var type = R.unitTypeOf(row.name, data);
      if (!type || !out[type]) return;
      if (isDepleted(row)) out[type].depleted.push(row);
      else out[type].full += rowQty(row);
    });
    return out;
  }
  function beastCounts(s) {
    var out = {};
    (Array.isArray(s.defenderBeasts) ? s.defenderBeasts : []).forEach(function (row) {
      if (!isObj(row)) return;
      var name = String(row.name || 'Beast');
      out[name] = (out[name] || 0) + rowQty(row);
    });
    return out;
  }
  function recovering(s) {
    var out = { lieutenants: 0, beasts: {} };
    (Array.isArray(s.warRecovery) ? s.warRecovery : []).forEach(function (r) {
      if (!isObj(r)) return;
      if (r.kind === 'lieutenant') out.lieutenants += 1;
      else if (r.kind === 'beast') out.beasts[r.name] = (out.beasts[r.name] || 0) + 1;
    });
    return out;
  }
  /* Add one full-strength unit to its counted row (never to a depleted row). */
  function addFull(list, name, source) {
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (isObj(row) && !isDepleted(row) && row.name === name) {
        row.qty = rowQty(row) + 1;
        row.source = source || row.source;
        return;
      }
    }
    list.push({ name: name, qty: 1, source: source || '' });
  }
  /* A depleted row's id: from a hash, never from Math.random, and unique. */
  function uniqueId(list, base) {
    var used = {};
    list.forEach(function (r) { if (isObj(r) && typeof r.id === 'string') used[r.id] = true; });
    var id = base, n = 2;
    while (used[id]) id = base + '-' + (n++);
    return id;
  }
  /* Depleted rows in Military Actions under way: replacements go to a
     regiment at home, not one on the battlefield. */
  function rowsInAction(s) {
    var ids = {};
    (Array.isArray(s.militaryActions) ? s.militaryActions : []).forEach(function (ma) {
      specUnits(ma).forEach(function (u) { if (u.source && u.source.rowId) ids[u.source.rowId] = true; });
    });
    return ids;
  }
  function specUnits(ma) {
    return isObj(ma) && isObj(ma.spec) && isObj(ma.spec.player) && Array.isArray(ma.spec.player.units) ? ma.spec.player.units.filter(isObj) : [];
  }

  /* The War Room's Recruit, completed: a depleted regiment of that type (the
     weakest one at home) is brought back to full strength first; otherwise
     the unit is added to the list as before. Returns the sentence for the
     log. */
  R.recruitUnit = function (s, data, label) {
    if (!Array.isArray(s.military)) s.military = [];
    var w = wd(data);
    var name = String(label || 'Unit');
    var type = R.unitTypeOf(name, data);
    var a = type && w && w.archetypes[type];
    if (a) {
      var busy = rowsInAction(s), target = null;
      s.military.forEach(function (row) {
        if (!isDepleted(row) || busy[row.id] || R.unitTypeOf(row.name, data) !== type) return;
        if (!target || clampInt(row.strength, 0) < clampInt(target.strength, 0)) target = row;
      });
      if (target) {
        s.military = s.military.filter(function (row) { return row !== target; });
        var same = s.military.some(function (row) { return isObj(row) && !isDepleted(row) && row.name === target.name; });
        var home = same ? target.name : null;
        if (!home) s.military.forEach(function (row) { if (!home && isObj(row) && !isDepleted(row) && R.unitTypeOf(row.name, data) === type) home = row.name; });
        addFull(s.military, home || target.name, target.source || 'War Room');
        return 'Replacements bring ' + a.name + ' back to ' + a.size + '.';
      }
    }
    addFull(s.military, name, 'War Room');
    return 'Recruited: ' + name + '.';
  };

  /* ---------- Commitments ---------- */
  R.isWarOrder = function (o) { return isObj(o) && (o.facId === 'war_council' || (isObj(o.meta) && o.meta.kind === 'war_action')); };

  /* A commitment in the phase 2 shape: { defenders, lieutenants,
     units: { type: n }, beasts: { name: n } }, tidied (whole numbers, only
     the ones above 0, units in the War Room's archetype order). */
  R.cleanCommit = function (c, data) {
    var w = wd(data);
    c = isObj(c) ? c : {};
    var units = {}, beasts = {};
    var cu = isObj(c.units) ? c.units : {};
    Object.keys(w.archetypes).forEach(function (t) {
      var n = clampInt(cu[t], 0);
      if (n > 0) units[t] = n;
    });
    var cb = isObj(c.beasts) ? c.beasts : {};
    Object.keys(cb).forEach(function (name) {
      var n = clampInt(cb[name], 0);
      if (name && n > 0) beasts[name] = n;
    });
    return { defenders: clampInt(c.defenders, 0), lieutenants: clampInt(c.lieutenants, 0), units: units, beasts: beasts };
  };
  /* The first n beasts in the Menagerie's list order that nobody else
     holds (taken: { name: n } already held), as phase 1 would have sent
     them. */
  function firstBeasts(s, n, taken) {
    var out = {}, left = n, free = beastCounts(s);
    Object.keys(taken || {}).forEach(function (name) { if (free[name] !== undefined) free[name] = Math.max(0, free[name] - taken[name]); });
    (Array.isArray(s.defenderBeasts) ? s.defenderBeasts : []).forEach(function (row) {
      if (!isObj(row) || left <= 0) return;
      var name = String(row.name || 'Beast');
      var take = Math.min(left, rowQty(row), free[name] || 0);
      if (take <= 0) return;
      out[name] = (out[name] || 0) + take;
      free[name] -= take;
      left -= take;
    });
    return out;
  }
  /* A phase 1 commitment ({ defenders, beasts, lieutenants, regiments } as
     numbers): its Regiments are Line Infantry, its beasts the first free
     ones in the Menagerie's list. */
  function phase1Commit(s, data, c, taken) {
    var w = wd(data), units = {};
    var regs = clampInt(c.regiments, 0);
    if (regs > 0) units[w.legacyRegiment.type] = regs;
    return { defenders: clampInt(c.defenders, 0), lieutenants: clampInt(c.lieutenants, 0), units: units, beasts: firstBeasts(s, clampInt(c.beasts, 0), taken) };
  }
  function phase1OrderFields(o) {
    var m = isObj(o && o.meta) ? o.meta : {};
    return { defenders: m.commitDefenders, beasts: m.commitBeasts, lieutenants: m.commitLieutenants, regiments: m.commitRegiments };
  }
  function warOrders(s) { return (Array.isArray(s.pendingOrders) ? s.pendingOrders : []).filter(R.isWarOrder); }
  function actionsOf(s) { return (Array.isArray(s.militaryActions) ? s.militaryActions : []).filter(isObj); }

  /* Every Military Action's and waiting war order's commitment, in the phase
     2 shape. Phase 1 ones only said how many beasts, not which, so they're
     filled last, from the beasts nobody else holds: after every beast named
     by a phase 2 action or order and anyone still recovering, then phase 1
     actions and orders in list order. Returns { actions: { id: commit },
     orders: { id: commit }, taken: { beast name: n } }. */
  function readCommits(s, data) {
    var taken = {};
    var rec = recovering(s).beasts;
    Object.keys(rec).forEach(function (n) { taken[n] = rec[n]; });
    function claim(c) { Object.keys(c.beasts).forEach(function (n) { taken[n] = (taken[n] || 0) + c.beasts[n]; }); return c; }
    var actions = {}, orders = {};
    var mas = actionsOf(s), ords = warOrders(s);
    mas.forEach(function (ma) { if (ma.v === 2) actions[ma.id] = claim(R.cleanCommit(ma.commit, data)); });
    ords.forEach(function (o) { if (isObj(o.meta) && isObj(o.meta.commit)) orders[o.id] = claim(R.cleanCommit(o.meta.commit, data)); });
    mas.forEach(function (ma) { if (ma.v !== 2) actions[ma.id] = claim(phase1Commit(s, data, isObj(ma.commit) ? ma.commit : {}, taken)); });
    ords.forEach(function (o) { if (!orders.hasOwnProperty(o.id)) orders[o.id] = claim(phase1Commit(s, data, phase1OrderFields(o), taken)); });
    return { actions: actions, orders: orders, taken: taken };
  }
  /* What a war order commits, in the phase 2 shape; a phase 1 order
     (commitRegiments etc.) is read as Line Infantry, with the first beasts
     in the list that no other action or order holds. */
  R.orderCommit = function (s, data, order) {
    var m = isObj(order && order.meta) ? order.meta : {};
    if (isObj(m.commit)) return R.cleanCommit(m.commit, data);
    var read = readCommits(s, data);
    var listed = warOrders(s).some(function (o) { return o.id === order.id; });
    return listed ? read.orders[order.id] : phase1Commit(s, data, phase1OrderFields(order), read.taken);
  };
  R.commitTotal = function (c) { return c.defenders + c.lieutenants + sum(c.units) + sum(c.beasts); };
  /* What takes the field: regiments, beasts and defenders (Lieutenants only
     lead them). */
  function fieldTotal(c) { return c.defenders + sum(c.units) + sum(c.beasts); }
  /* How many formations a Lieutenant could lead: the regiments, and the
     defenders' detachments (never beasts, never defenders who only support
     a regiment). */
  function hostCount(data, defenders, armed, regiments) {
    return regiments + (defenders > 0 ? R.defenderPlan(data, defenders, armed, regiments).detachments.length : 0);
  }

  /* Everything already committed: by Military Actions under way (their
     regiments by identity, from the battle's line-up) and by war orders
     still waiting (by number, in the order they were queued: see
     warForces). opts.except leaves out one order or action (a waiting order
     left out still keeps its place in the queue); opts.ignoreOrders leaves
     out every waiting order.
     Leaving out a waiting order (mustering it) also leaves out the
     defenders, Lieutenants and beasts of the orders queued after it: they
     share them in queue order, as they share the regiments, so the first
     queued keeps its forces and the later ones get what's left. (Phase 1
     let two orders commit the same defenders.) */
  function commitments(s, data, opts) {
    var read = readCommits(s, data);
    var out = { defenders: 0, lieutenants: 0, beasts: {}, maFull: {}, maRows: {}, queue: [] };
    function addCommon(c) {
      out.defenders += c.defenders;
      out.lieutenants += c.lieutenants;
      Object.keys(c.beasts).forEach(function (n) { out.beasts[n] = (out.beasts[n] || 0) + c.beasts[n]; });
    }
    actionsOf(s).forEach(function (ma) {
      if (ma.id === opts.except || ma.orderId === opts.except) return;
      var c = read.actions[ma.id];
      addCommon(c);
      var units = specUnits(ma);
      /* No line-up (it shouldn't happen): its regiments are counted first. */
      if (!units.length) { out.queue.push({ units: c.units, mine: false }); return; }
      units.forEach(function (u) {
        if (u.kind !== 'formation' || !isObj(u.source)) return;
        if (u.source.rowId) out.maRows[u.source.rowId] = true;
        else out.maFull[u.type] = (out.maFull[u.type] || 0) + 1;
      });
    });
    if (!opts.ignoreOrders) {
      var passed = false;
      warOrders(s).forEach(function (o) {
        var c = read.orders[o.id];
        var mine = opts.except !== undefined && o.id === opts.except;
        if (mine) passed = true;
        else if (!passed) addCommon(c);
        out.queue.push({ units: c.units, mine: mine });
      });
    }
    return out;
  }

  /* What can be committed now: { defenders: { count, armed }, lieutenants,
     units: { type: [{ key, label, personnel, size, depleted }] } (every
     archetype, healthiest first), beasts: { name: n }, fullWar }. Anything
     committed to a waiting order or a Military Action, and any Lieutenant
     or beast still recovering, is left out.
     Waiting orders share the regiments in the order they were queued: the
     first takes the healthiest of its type, the next the healthiest left,
     and so on, which is what each was estimated with and what each marches
     with. A new order comes last, so it gets the healthiest nobody has. */
  R.warForces = function (s, data, opts) {
    var w = wd(data);
    opts = opts || {};
    var held = commitments(s, data, opts);
    var rec = recovering(s);
    var regs = regimentsOf(s, data);
    var units = {};
    Object.keys(w.archetypes).forEach(function (type) {
      var a = w.archetypes[type], r = regs[type];
      var full = Math.max(0, r.full - (held.maFull[type] || 0));
      var dep = r.depleted.filter(function (row) { return !held.maRows[row.id]; }).map(function (row) {
        return { key: String(row.id), strength: clampInt(row.strength, 1, a.size) };
      });
      dep.sort(function (x, y) { return y.strength - x.strength || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0); });
      /* Every regiment of the type, healthiest first, then each waiting
         order's share in queue order. Those held by another order go. */
      var pool = [];
      for (var f = 0; f < full; f++) pool.push(null);
      dep.forEach(function (d) { pool.push(d); });
      var other = [], at = 0;
      held.queue.forEach(function (q) {
        for (var k = 0; k < (q.units[type] || 0) && at < pool.length; k++) other[at++] = !q.mine;
      });
      var list = [], n = 0;
      pool.forEach(function (d, i) {
        if (other[i]) return;
        if (!d) list.push({ key: type + '-' + (++n), label: a.name, personnel: a.size, size: a.size, depleted: false });
        else list.push({ key: d.key, label: a.name + ' (' + d.strength + ' of ' + a.size + ')', personnel: d.strength, size: a.size, depleted: true });
      });
      units[type] = list;
    });
    var beasts = {}, all = beastCounts(s);
    Object.keys(all).forEach(function (name) {
      var n = all[name] - (held.beasts[name] || 0) - (rec.beasts[name] || 0);
      if (n > 0) beasts[name] = n;
    });
    var d = isObj(s.defenders) ? s.defenders : {};
    return {
      defenders: { count: Math.max(0, clampInt(d.count, 0) - held.defenders), armed: !!d.armed },
      lieutenants: Math.max(0, R.militaryQty(s, /lieutenant/i) - held.lieutenants - rec.lieutenants),
      units: units,
      beasts: beasts,
      fullWar: !!(isObj(s.organization) && s.organization.type !== 'unsworn')
    };
  };

  /* Phase 1's summary of the same thing (numbers only). */
  R.warAvailable = function (s, data) {
    var f = R.warForces(s, data);
    var regiments = Object.keys(f.units).reduce(function (a, t) { return a + f.units[t].length; }, 0);
    return { defenders: f.defenders.count, beasts: sum(f.beasts), lieutenants: f.lieutenants, regiments: regiments, fullWar: f.fullWar };
  };

  /* The boxes as typed, clamped to what can be committed. The Unsworn send
     only defenders and beasts, as before: no Lieutenants and no units.
     Each Lieutenant leads one formation (a regiment or a defenders'
     detachment), so there are never more Lieutenants than formations for
     them to lead. Read every box before clamping: Lieutenants typed before
     any regiment would otherwise come out as 0. */
  R.warCommit2 = function (s, data, fields, opts) {
    var w = wd(data);
    var f = R.warForces(s, data, opts);
    fields = isObj(fields) ? fields : {};
    var fu = isObj(fields.units) ? fields.units : {};
    var fb = isObj(fields.beasts) ? fields.beasts : {};
    var units = {}, beasts = {};
    if (f.fullWar) {
      Object.keys(w.archetypes).forEach(function (t) {
        var n = clampInt(fu[t] === undefined ? 0 : fu[t], 0, f.units[t].length);
        if (n > 0) units[t] = n;
      });
    }
    Object.keys(f.beasts).forEach(function (name) {
      var n = clampInt(fb[name] === undefined ? 0 : fb[name], 0, f.beasts[name]);
      if (n > 0) beasts[name] = n;
    });
    var defenders = clampInt(fields.defenders === undefined ? 0 : fields.defenders, 0, f.defenders.count);
    var hosts = hostCount(data, defenders, f.defenders.armed, sum(units));
    return {
      defenders: defenders,
      lieutenants: f.fullWar ? clampInt(fields.lieutenants === undefined ? 0 : fields.lieutenants, 0, Math.min(f.lieutenants, hosts)) : 0,
      units: units,
      beasts: beasts
    };
  };

  /* ---------- The player's army for a battle ---------- */
  /* The battle's line-up for a commitment: one unit per committed regiment
     (the healthiest first), one per committed beast, the Lieutenants
     ('lt-1'…) and the defenders, who the battle rules form into detachments
     and support. Each unit's source tells finishBattle where it came from. */
  R.playerSide = function (s, data, commit, opts) {
    var w = wd(data);
    var c = R.cleanCommit(commit, data);
    var f = R.warForces(s, data, opts);
    var units = [];
    Object.keys(w.archetypes).forEach(function (type) {
      var n = c.units[type] || 0;
      if (!n) return;
      var a = w.archetypes[type];
      f.units[type].slice(0, n).forEach(function (reg, i) {
        var traits = a.traits.slice();
        units.push({
          id: 'p-' + type + '-' + (i + 1), kind: 'formation', type: type, name: a.name, label: '', short: '',
          personnel: reg.personnel, size: a.size,
          profile: scaleProfile(profileOf(a, traits, w), reg.personnel, a.size),
          traits: traits, variant: null,
          source: reg.depleted ? { key: reg.key, type: type, rowId: reg.key } : { key: reg.key, type: type }
        });
      });
    });
    var bi = 0;
    Object.keys(c.beasts).forEach(function (name) {
      var n = Math.min(c.beasts[name], f.beasts[name] || 0);
      var p = w.beasts[name] || w.beastDefault;
      for (var k = 0; k < n; k++) {
        bi += 1;
        var traits = p.trait ? [p.trait] : [];
        units.push({
          id: 'p-beast-' + bi, kind: 'beast', type: 'beast', name: name, label: '', short: '',
          personnel: 1, size: 1, profile: profileOf(p, traits, w), traits: traits, variant: null,
          source: { key: 'beast-' + bi, beast: name }
        });
      }
    });
    nameUnits(units, w);
    var def = Math.min(c.defenders, f.defenders.count);
    var regs = units.filter(function (u) { return u.kind === 'formation'; }).length;
    /* Only as many Lieutenants as there are formations for them to lead. */
    var lts = Math.min(c.lieutenants, f.lieutenants, hostCount(data, def, f.defenders.armed, regs));
    var leaders = [];
    for (var i = 1; i <= lts; i++) leaders.push({ id: 'lt-' + i, name: lts > 1 ? 'Lieutenant ' + i : 'Lieutenant', source: { lieutenant: i } });
    return { units: units, leaders: leaders, defenders: def > 0 ? { count: def, armed: f.defenders.armed, source: { defenders: true } } : null };
  };

  /* How the defenders would fight beside this many regiments, for the
     Battle Value estimate: { detachments: [headcounts], support: [{ count,
     bonus }], bv }. The battle rules form the real ones
     (battleRules.formDefenders), so they're used when loaded; otherwise the
     same rule is followed here: 75 or more fight as detachments of at most
     150, split evenly; fewer support the regiments in order (up to 10 each:
     +1 Cohesion per 5 armed, at most +2; unarmed +1 per 10, at most +1), and
     any left over form one small detachment. */
  R.defenderPlan = function (data, count, armed, regiments) {
    var w = wd(data), D = w.defenders;
    var levy = w.archetypes[D.profile];
    var n = clampInt(count, 0), r = clampInt(regiments, 0);
    var dets = [], support = [];
    var br = ns.battleRules;
    if (br && typeof br.formDefenders === 'function') {
      var ids = [];
      for (var j = 1; j <= r; j++) ids.push('r' + j);
      var fd = br.formDefenders(n, !!armed, ids);
      dets = fd.detachments.map(function (x) { return x.personnel; });
      support = fd.support.map(function (g) { return { count: g.count, bonus: g.bonus }; });
    } else if (n >= D.detachmentMin) {
      var k = Math.ceil(n / D.fullSize);
      for (var i = 0; i < k; i++) dets.push(Math.floor(n / k) + (i < n % k ? 1 : 0));
    } else if (n > 0) {
      var per = armed ? D.supportPer : D.unarmedSupportPer;
      var most = armed ? D.supportMax : D.unarmedSupportMax;
      var left = n;
      for (var h = 0; h < r && left > 0; h++) {
        var take = Math.min(per * most, left);
        support.push({ count: take, bonus: Math.min(most, Math.floor(take / per)) });
        left -= take;
      }
      if (left > 0) dets.push(left);
    }
    var bv = dets.reduce(function (a, m) { return a + Math.max(0.5, round05(levy.bv * m / D.fullSize)); }, 0) +
      support.reduce(function (a, g) { return a + g.bonus * D.supportBvPerPoint; }, 0);
    return { detachments: dets, support: support, bv: bv };
  };

  /* One side's Battle Value: its units, its leaders (2 each) and, for the
     player, the defenders. */
  R.sideBV = function (data, side, leaderBV) {
    var w = wd(data);
    var units = Array.isArray(side.units) ? side.units : [];
    var total = units.reduce(function (a, u) { return a + (Number(u.profile && u.profile.bv) || 0); }, 0);
    total += (Array.isArray(side.leaders) ? side.leaders.length : 0) * (leaderBV === undefined ? w.lieutenant.bv : leaderBV);
    if (isObj(side.defenders) && side.defenders.count > 0) {
      var regs = units.filter(function (u) { return u.kind === 'formation'; }).length;
      total += R.defenderPlan(data, side.defenders.count, side.defenders.armed, regs).bv;
    }
    return round05(total);
  };
  /* The Battle Value of what's committed (an estimate for the War Council). */
  R.armyBV = function (s, data, commit, opts) {
    return R.sideBV(data, R.playerSide(s, data, commit, opts));
  };
  R.enemyBV = function (data, enemy) {
    return R.sideBV(data, { units: enemy && enemy.units, leaders: enemy && enemy.leaders }, wd(data).captain.bv);
  };

  /* ---------- Missions: the enemy army ---------- */
  function weightedPick(rng, list) {
    var total = list.reduce(function (a, x) { return a + x.weight; }, 0);
    var r = rng() * total;
    for (var i = 0; i < list.length; i++) {
      r -= list[i].weight;
      if (r < 0) return list[i];
    }
    return list[list.length - 1];
  }
  var ROLE_ORDER = { infantry: 0, ranged: 1, cavalry: 2, beast: 3 };

  /* Draw up an enemy army (pure: the same rng gives the same army).
     - Budget: the force's base Battle Value × the objective's multiplier ×
       one variation roll (d6), rounded.
     - Captains first: one from W.captains.first, another at second and
       third, and one more for a clan with extraCaptain (Farmer). They're
       paid for from the budget, and never outnumber the formations.
     - Then units: the first is always core infantry; after that, picks by
       the clan's weights, within its caps (archers as a share of the
       formations, cavalry, shock cavalry and beasts by number), keeping at
       least W.coreShare of the units' Battle Value in infantry, with beasts
       only from the clan's list at or above their minBudget.
     - A unit whose archetype has a clan variant is usually that variant
       (its name and trait).
     - It stops when nothing affordable is left; the total may come out a
       little under the budget, and never more than the overshoot (1) over.
     Never scaled to the party's level or to what the player commits.
     Returns { variation: { roll, mult }, budget, enemy: { units, leaders } },
     or null for an unknown clan, objective or force. */
  R.generateEnemy = function (data, targetKey, objective, tierId, rng) {
    var w = wd(data);
    var clan = w.clans[targetKey], obj = w.objectives[objective], tier = tierOf(w, tierId);
    if (!clan || !obj || !tier) return null;
    var roll = 1 + Math.floor(rng() * 6);
    var vrow = w.variation[w.variation.length - 1];
    for (var v = 0; v < w.variation.length; v++) if (roll <= w.variation[v].upTo) { vrow = w.variation[v]; break; }
    var budget = Math.round(tier.bv * obj.mult * vrow.mult);

    var captains = (budget >= w.captains.first ? 1 : 0) + (budget >= w.captains.second ? 1 : 0) + (budget >= w.captains.third ? 1 : 0) + (clan.extraCaptain ? 1 : 0);
    var left = budget - captains * w.captain.bv;
    var over = setting(w, 'overshoot');
    var picks = [], infBV = 0, totalBV = 0, counts = { archers: 0, cavalry: 0, shock_cav: 0, beasts: 0 };
    var capsOf = clan.caps || {};
    for (var guard = 0; guard < 200; guard++) {
      var options = [];
      Object.keys(w.archetypes).forEach(function (id) {
        var a = w.archetypes[id];
        var weight = (clan.weights && clan.weights[id]) || 0;
        if (weight <= 0 || a.bv > left + over) return;
        if (!picks.length && a.role !== 'infantry') return;
        if (a.role !== 'infantry' && infBV < w.coreShare * (totalBV + a.bv)) return;
        if (a.role === 'ranged' && counts.archers + 1 > (capsOf.archers || 0) * (picks.length + 1)) return;
        if (a.role === 'cavalry' && counts.cavalry + 1 > (capsOf.cavalry || 0)) return;
        if (id === 'shock_cav' && counts.shock_cav + 1 > (capsOf.shock_cav || 0)) return;
        options.push({ kind: 'unit', id: id, weight: weight, bv: a.bv });
      });
      if (picks.length) {
        (clan.beasts || []).forEach(function (b) {
          var p = w.beasts[b.name] || w.beastDefault;
          if (budget < (b.minBudget || 0) || counts.beasts + 1 > (capsOf.beasts || 0)) return;
          if (p.bv > left + over || infBV < w.coreShare * (totalBV + p.bv)) return;
          options.push({ kind: 'beast', name: b.name, hired: !!b.hired, weight: setting(w, 'beastWeight'), bv: p.bv });
        });
      }
      if (!options.length) break;
      var pick = weightedPick(rng, options);
      if (pick.kind === 'unit') {
        var a = w.archetypes[pick.id];
        var variants = (clan.variants || []).filter(function (x) { return x.base === pick.id; });
        var variant = null;
        if (variants.length && rng() < setting(w, 'variantChance')) {
          variant = variants.length > 1 ? variants[Math.floor(rng() * variants.length)] : variants[0];
        }
        picks.push({ kind: 'unit', id: pick.id, role: a.role, variant: variant });
        if (a.role === 'infantry') infBV += a.bv;
        if (a.role === 'ranged') counts.archers += 1;
        if (a.role === 'cavalry') counts.cavalry += 1;
        if (pick.id === 'shock_cav') counts.shock_cav += 1;
      } else {
        picks.push({ kind: 'beast', name: pick.name, hired: pick.hired, role: 'beast' });
        counts.beasts += 1;
      }
      totalBV += pick.bv;
      left -= pick.bv;
    }

    /* Infantry first, then archers, cavalry and beasts; the same names together. */
    var units = picks.map(function (p) {
      if (p.kind === 'beast') {
        var bp = w.beasts[p.name] || w.beastDefault;
        var bt = bp.trait ? [bp.trait] : [];
        return { id: '', kind: 'beast', type: 'beast', name: p.name, label: '', short: '', personnel: 1, size: 1,
          profile: profileOf(bp, bt, w), traits: bt, variant: null,
          source: p.hired ? { clan: targetKey, beast: p.name, hired: true } : { clan: targetKey, beast: p.name } };
      }
      var a = w.archetypes[p.id];
      var traits = a.traits.slice();
      if (p.variant && traits.indexOf(p.variant.trait) === -1) traits.push(p.variant.trait);
      return { id: '', kind: 'formation', type: p.id, name: p.variant ? p.variant.name : a.name, label: '', short: '',
        personnel: a.size, size: a.size, profile: profileOf(a, traits, w), traits: traits,
        variant: p.variant ? { id: p.variant.id, name: p.variant.name, trait: p.variant.trait } : null,
        source: { clan: targetKey, archetype: p.id } };
    });
    var typeIndex = Object.keys(w.archetypes);
    units.sort(function (x, y) {
      var rx = x.kind === 'beast' ? 3 : ROLE_ORDER[w.archetypes[x.type].role];
      var ry = y.kind === 'beast' ? 3 : ROLE_ORDER[w.archetypes[y.type].role];
      if (rx !== ry) return rx - ry;
      var tx = typeIndex.indexOf(x.type), ty = typeIndex.indexOf(y.type);
      if (tx !== ty) return tx - ty;
      return x.name < y.name ? -1 : x.name > y.name ? 1 : 0;
    });
    units.forEach(function (u, i) { u.id = 'e' + (i + 1); });
    nameUnits(units, w);
    var clanName = R.clanName(data, targetKey);
    clanLabels(units, clanName);

    var hosts = units.filter(function (u) { return u.kind !== 'beast'; }).length;
    captains = Math.min(captains, hosts);
    var leaders = [];
    for (var c = 1; c <= captains; c++) leaders.push({ id: 'c' + c, name: clanName + ' ' + w.captain.name + (captains > 1 ? ' ' + c : '') });
    return { variation: { roll: roll, mult: vrow.mult }, budget: budget, enemy: { units: units, leaders: leaders } };
  };

  R.missionKey = function (targetKey, objective, tierId) { return targetKey + '|' + objective + '|' + tierId; };

  /* Missions referred to by a waiting order or a Military Action. */
  function missionsInUse(s) {
    var used = {};
    (Array.isArray(s.pendingOrders) ? s.pendingOrders : []).forEach(function (o) {
      if (R.isWarOrder(o) && o.meta && o.meta.missionKey) used[o.meta.missionKey] = true;
    });
    (Array.isArray(s.militaryActions) ? s.militaryActions : []).forEach(function (ma) { if (isObj(ma) && ma.missionKey) used[ma.missionKey] = true; });
    return used;
  }
  /* The turn a mission was last shown (or drawn up, for one saved before
     missions kept a note of that). */
  function lastSeen(m) { return clampInt(m.seenTurn !== undefined ? m.seenTurn : m.createdTurn, 0); }
  /* Keep at most maxMissions: drop the one least recently shown that has no
     opening rolls, isn't waiting or under way, and wasn't shown this turn.
     A mission seen this turn is never dropped (there may be more than
     maxMissions until the next turn), so looking through the others can't
     redraw an army the War Council has already shown. */
  function pruneMissions(s, data, keep) {
    var max = setting(wd(data), 'maxMissions');
    var used = missionsInUse(s);
    used[keep] = true;
    var turn = clampInt(s.turn, 0);
    var keys = Object.keys(s.warMissions);
    while (keys.length > max) {
      var drop = null;
      keys.forEach(function (k) {
        var m = s.warMissions[k];
        if (used[k] || m.conditions || lastSeen(m) >= turn) return;
        if (!drop || lastSeen(m) < lastSeen(s.warMissions[drop])) drop = k;
      });
      if (!drop) break;
      delete s.warMissions[drop];
      keys = Object.keys(s.warMissions);
    }
  }

  /* The mission for a target, objective and force: the saved one, or a new
     one drawn up now (and saved) with its own seeded dice, from the key, the
     turn and s.warMissionSeq. Either way it's noted as seen this turn
     (seenTurn), so it isn't let go while the War Council is showing it. */
  R.ensureMission = function (s, data, targetKey, objective, tierId) {
    if (!isObj(s.warMissions)) s.warMissions = {};
    var key = R.missionKey(targetKey, objective, tierId);
    if (isObj(s.warMissions[key])) {
      s.warMissions[key].seenTurn = s.turn;
      return s.warMissions[key];
    }
    var seq = clampInt(s.warMissionSeq, 0);
    var gen = R.generateEnemy(data, targetKey, objective, tierId, R.mulberry32(R.missionSeed(key, s.turn, seq)));
    if (!gen) return null;
    s.warMissionSeq = seq + 1;
    var mission = {
      key: key, targetKey: targetKey, targetName: R.clanName(data, targetKey), objective: objective, tier: tierId,
      variation: gen.variation, budget: gen.budget, enemy: gen.enemy, conditions: null, createdTurn: s.turn, seenTurn: s.turn
    };
    s.warMissions[key] = mission;
    pruneMissions(s, data, key);
    return mission;
  };
  /* A Military Action's mission. If it has gone (another action against the
     same mission finished first), it's put back from the action's own
     line-up, so the enemy stays the same. */
  function missionFor(s, data, ma) {
    if (!isObj(s.warMissions)) s.warMissions = {};
    var m = s.warMissions[ma.missionKey];
    if (isObj(m)) return m;
    if (!isObj(ma.spec) || !isObj(ma.spec.enemy)) return R.ensureMission(s, data, ma.targetKey, ma.objective, ma.tier);
    m = {
      key: ma.missionKey, targetKey: ma.targetKey, targetName: ma.targetName, objective: ma.objective, tier: ma.tier,
      variation: null, budget: R.enemyBV(data, ma.spec.enemy), enemy: clone(ma.spec.enemy), conditions: null, createdTurn: s.turn, seenTurn: s.turn
    };
    s.warMissions[ma.missionKey] = m;
    return m;
  }

  /* How far a clan's army can come out from its budget: up to the
     overshoot over, and under by at most what's left when not even its
     cheapest infantry fits (generateEnemy stops only then: infantry is
     never held back by a cap). { under, over }. */
  function budgetSlack(w, clanKey) {
    var clan = w.clans[clanKey] || {};
    var over = setting(w, 'overshoot');
    var cheapest = null;
    Object.keys(w.archetypes).forEach(function (id) {
      var a = w.archetypes[id];
      if (a.role !== 'infantry' || !((clan.weights && clan.weights[id]) > 0)) return;
      if (cheapest === null || a.bv < cheapest) cheapest = a.bv;
    });
    return { under: cheapest === null ? 0 : Math.max(0, Math.ceil(cheapest) - over - 1), over: over };
  }

  /* The War Council's intelligence estimate: a range, never the exact army.
     { bvLow, bvHigh, formationsLow, formationsHigh, notes }. The Battle
     Value runs from the smallest variation roll's budget to the largest's,
     widened by how far an army can come out from its budget, so the real
     army is always inside it. */
  R.missionEstimate = function (mission, data) {
    var w = wd(data);
    var tier = tierOf(w, mission.tier) || w.tiers[0];
    var obj = w.objectives[mission.objective] || { mult: 1 };
    var base = tier.bv * obj.mult;
    var slack = budgetSlack(w, mission.targetKey);
    var units = (mission.enemy && mission.enemy.units) || [];
    var role = function (u) { return u.kind === 'beast' ? 'beast' : (w.archetypes[u.type] || {}).role; };
    var notes = [];
    if (units.some(function (u) { return role(u) === 'cavalry'; })) notes.push('cavalry reported');
    if (units.some(function (u) { return role(u) === 'ranged'; })) notes.push('archers reported');
    if (units.some(function (u) { return role(u) === 'beast'; })) notes.push('beasts sighted');
    return {
      bvLow: Math.max(0, Math.round(base * w.variation[0].mult) - slack.under),
      bvHigh: Math.round(base * w.variation[w.variation.length - 1].mult) + slack.over,
      formationsLow: Math.max(1, units.length - 1),
      formationsHigh: units.length + 1,
      notes: notes
    };
  };
  /* "Estimated enemy: 23–33 Battle Value; about 3 to 5 formations; archers reported." */
  R.missionEstimateLine = function (mission, data) {
    var e = R.missionEstimate(mission, data);
    return 'Estimated enemy: ' + e.bvLow + '–' + e.bvHigh + ' Battle Value; about ' + e.formationsLow + ' to ' + e.formationsHigh + ' formations' + (e.notes.length ? '; ' + e.notes.join(', ') : '') + '.';
  };

  /* ---------- Queueing a war ---------- */
  /* The war order: it resolves next Bastion turn, as before. Returns the
     order, or null if the target, objective or force is unknown or nothing
     that takes the field is committed (Lieutenants alone can't fight). The
     commitment is clamped to what's free now. */
  R.queueWarAction2 = function (s, data, opts) {
    var w = wd(data);
    opts = isObj(opts) ? opts : {};
    var objective = String(opts.objective || ''), tierId = String(opts.tier || ''), targetKey = String(opts.targetKey || '');
    if (!w.objectives[objective] || !tierOf(w, tierId) || !w.clans[targetKey]) return null;
    var commit = R.warCommit2(s, data, opts.commit);
    if (fieldTotal(commit) <= 0) return null;
    var mission = R.ensureMission(s, data, targetKey, objective, tierId);
    var used = {};
    s.pendingOrders.forEach(function (o) { if (isObj(o)) used[String(o.id)] = true; });
    (Array.isArray(s.militaryActions) ? s.militaryActions : []).forEach(function (ma) { if (isObj(ma)) used[String(ma.orderId)] = true; });
    var n = 1, id = 'war-' + s.turn + '-' + n;
    while (used[id]) id = 'war-' + s.turn + '-' + (++n);
    var order = {
      id: id, facId: 'war_council', fnId: 'war_action', optionIdx: 0, label: 'War Action', completeTurn: (s.turn || 1) + 1,
      meta: {
        kind: 'war_action', objective: objective, targetKey: targetKey, targetName: R.clanName(data, targetKey), tier: tierId,
        missionKey: mission.key, commit: commit,
        commitDefenders: commit.defenders, commitBeasts: sum(commit.beasts), commitLieutenants: commit.lieutenants, commitRegiments: sum(commit.units)
      }
    };
    s.pendingOrders.push(order);
    return order;
  };
  /* The log line for a queued war: ['War Action Queued', 'Raid vs Bacca (resolves next Bastion Turn).']. */
  R.warOrderLine = function (order) {
    var m = (order && order.meta) || {};
    return ['War Action Queued', R.militaryName({ objective: m.objective, targetName: m.targetName || 'Unknown' }) + ' (resolves next Bastion Turn).'];
  };

  /* ---------- The Military Action ---------- */
  /* The opening rolls as the battle uses them, or null until all three are in. */
  R.specConditions = function (data, ma) {
    if (!ma.weather || !ma.morale || !ma.luck) return null;
    var w = wd(data);
    return {
      weather: w.weather[ma.weather.id] ? ma.weather.id : 'clear',
      moraleMod: ma.morale.pass ? w.morale.highMod : w.morale.lowMod,
      luckMod: ma.luck.pass ? w.luck.passMod : w.luck.failMod
    };
  };
  /* The battle's line-up (battleRules.createBattle's spec): the player's
     side from the commitment, the mission's enemy, the objective and the
     opening rolls. */
  R.buildSpec = function (s, data, ma, opts) {
    var mission = missionFor(s, data, ma);
    var enemy = clone(mission ? mission.enemy : { units: [], leaders: [] });
    /* A mission drawn up before the enemy's labels had the clan's name. */
    var clanKey = mission && mission.targetKey ? mission.targetKey : ma.targetKey;
    if (isObj(enemy) && wd(data).clans[clanKey]) clanLabels(enemy.units, R.clanName(data, clanKey));
    return {
      player: R.playerSide(s, data, ma.commit, opts),
      enemy: enemy,
      objective: ma.objective,
      conditions: R.specConditions(data, ma)
    };
  };

  /* The war order becomes a Military Action: the order is removed and the
     action recorded in one step, so it can't come due twice (beginning the
     same order again gives back the action already made). What it commits
     is checked again against what's still free (a beast that died in the
     meantime can't march); if nothing that takes the field is left, the
     order lapses with a line in the log and null is returned. If an
     earlier action against the mission was called off after making some
     of the opening rolls, those rolls stand and this one carries on from
     the first roll not yet made (straight to deployment if all three were
     made). No dice are used here. */
  R.beginMilitaryAction = function (s, data, order, rand, now) {
    var w = wd(data);
    if (!isObj(order)) return null;
    var waiting = (Array.isArray(s.pendingOrders) ? s.pendingOrders : []).some(function (o) { return isObj(o) && o.id === order.id; });
    var already = R.militaryById(s, 'ma-' + String(order.id));
    if (already) {
      if (waiting) R.removeOrder(s, order.id);
      return already;
    }
    if (!waiting) return null;
    var meta = isObj(order.meta) ? order.meta : {};
    var objective = w.objectives[meta.objective] ? String(meta.objective) : 'raid';
    var targetKey = w.clans[meta.targetKey] ? String(meta.targetKey) : 'blackstone';
    var tier = tierOf(w, meta.tier) ? String(meta.tier) : 'established';
    var ordered = R.orderCommit(s, data, order);
    var commit = R.warCommit2(s, data, ordered, { except: order.id });
    var ma = {
      id: 'ma-' + String(order.id), orderId: String(order.id), turn: s.turn, v: 2,
      objective: objective, targetKey: targetKey, targetName: R.clanName(data, targetKey), tier: tier, missionKey: '',
      commit: commit, step: 'weather', weather: null, morale: null, luck: null, spec: null, battle: null
    };
    if (fieldTotal(commit) <= 0) {
      R.removeOrder(s, order.id);
      R.log(s, 'War Turn', R.militaryName(ma) + ': nothing committed to it is still free to march, so the war order lapses.', now);
      return null;
    }
    var mission = R.ensureMission(s, data, targetKey, objective, tier);
    ma.missionKey = mission.key;
    ma.spec = R.buildSpec(s, data, ma, { except: order.id });
    R.removeOrder(s, order.id);
    if (!Array.isArray(s.militaryActions)) s.militaryActions = [];
    s.militaryActions.push(ma);
    var cut = R.musterShortfall(data, ordered, commit);
    if (cut) R.log(s, 'War Turn', R.militaryName(ma) + ': ' + cut, now);
    R.log(s, 'War Turn', R.militaryName(ma) + ': your forces muster for battle. The Military Action is ready to begin.', now);
    var cond = isObj(mission.conditions) ? mission.conditions : {};
    if (isObj(cond.weather)) {
      ma.weather = clone(cond.weather);
      if (isObj(cond.morale)) {
        ma.morale = clone(cond.morale);
        if (isObj(cond.luck)) ma.luck = clone(cond.luck);
      }
      ma.step = !ma.morale ? 'morale' : !ma.luck ? 'luck' : 'deploy';
      ma.spec.conditions = R.specConditions(data, ma);
      R.log(s, 'War Turn', R.militaryName(ma) + (ma.luck
        ? ': the conditions are unchanged: ' + R.conditionsText(data, ma) + '.'
        : ': the rolls already made are unchanged: ' + R.conditionsText(data, ma) + '. Next: the ' + R.militaryRollTitle(ma.step) + ' roll.'), now);
    }
    return ma;
  };
  /* "Cold Downpour, morale high, luck −1". */
  R.conditionsText = function (data, ma) {
    var parts = [];
    if (ma.weather) parts.push(R.militaryWeather(data, ma.weather.id).title);
    if (ma.morale) parts.push('morale ' + (ma.morale.pass ? 'high' : 'low'));
    if (ma.luck) parts.push('luck ' + signed(ma.luck.pass ? wd(data).luck.passMod : wd(data).luck.failMod));
    return parts.join(', ');
  };

  /* After the Luck roll (called by R.militaryRoll): the battle's line-up
     gets its conditions. (The rolls become the mission's when the action is
     called off: see R.callOffMilitaryAction.) */
  R.warConditionsRolled = function (s, data, ma) {
    if (!isObj(ma) || ma.v !== 2) return;
    if (isObj(ma.spec)) ma.spec.conditions = R.specConditions(data, ma);
  };

  /* Save the battle from the War Table (only while deploying or fighting).
     Once it reaches the battle phase the action's step becomes 'battle',
     and it can't go back to deployment; once it has a result, only the
     same result can be saved over it (a late save from earlier in the
     battle can't undo it). */
  var PHASES = ['setup', 'deploy', 'battle', 'over'];
  R.isBattle = function (b) { return isObj(b) && Array.isArray(b.units) && PHASES.indexOf(b.phase) !== -1; };
  R.militaryBattleSave = function (s, id, battle) {
    var ma = R.militaryById(s, id);
    if (!ma || ma.v !== 2 || (ma.step !== 'deploy' && ma.step !== 'battle') || !R.isBattle(battle)) return false;
    var fighting = battle.phase === 'battle' || battle.phase === 'over';
    if (ma.step === 'battle' && !fighting) return false;
    var decided = isObj(ma.battle) && isObj(ma.battle.result) ? ma.battle.result.outcome : null;
    if (decided && !(isObj(battle.result) && battle.result.outcome === decided)) return false;
    ma.battle = clone(battle);
    if (fighting) ma.step = 'battle';
    return true;
  };

  /* Is it the same roll? (A Luck roll's modifier isn't compared: it follows
     the data file.) */
  function sameRoll(a, b) {
    return isObj(a) && isObj(b) && a.d20 === b.d20 && a.total === b.total && a.pass === b.pass && a.id === b.id;
  }
  /* The opening rolls an action made become its mission's, so calling off
     and trying again can't reroll them. Rolls the mission already has stay;
     the action's later rolls are added only if it was carrying on from them
     (a separate action against the same mission made its own). */
  function keepRolls(m, ma) {
    var c = isObj(m.conditions) ? m.conditions : {};
    var out = {}, carryingOn = true;
    ['weather', 'morale', 'luck'].forEach(function (k) {
      if (isObj(c[k])) {
        out[k] = c[k];
        if (!sameRoll(c[k], ma[k])) carryingOn = false;
      } else {
        out[k] = carryingOn && isObj(ma[k]) ? clone(ma[k]) : null;
        if (!out[k]) carryingOn = false;
      }
    });
    if (out.weather) m.conditions = out;
  }

  /* Call it off: nothing is won or lost, and the mission is kept, with the
     opening rolls made so far (even just the Weather), so a new attempt
     carries on from them. Refused once the first unit has acted, or once
     the battle has a result (that goes through R.finishBattle). */
  R.callOffMilitaryAction = function (s, id, now) {
    var ma = R.militaryById(s, id);
    if (!R.canCallOff(ma)) return false;
    if (ma.v === 2 && isObj(ma.weather)) {
      var m = missionFor(s, null, ma);
      if (m) keepRolls(m, ma);
    }
    s.militaryActions = s.militaryActions.filter(function (x) { return x.id !== ma.id; });
    R.log(s, 'War Turn', R.militaryName(ma) + ': the Military Action was called off. Nothing was won or lost.', now);
    return true;
  };
  R.canCallOff = function (ma) {
    if (!isObj(ma)) return false;
    var b = isObj(ma.battle) ? ma.battle : null;
    return !(b && (b.started || isObj(b.result) || b.phase === 'over'));
  };

  /* "6 defenders, 1 Lieutenant, Line Infantry ×2, Archers, Giant Vulture ×3"
     (what's committed). Phase 1's shape (regiments as a number) still reads. */
  R.militaryCommitLine = function (commit) {
    var w = wd();
    var c = isObj(commit) ? commit : {};
    var parts = [];
    function add(n, one, many) { n = clampInt(n, 0); if (n > 0) parts.push(plural(n, one, many)); }
    add(c.defenders, 'defender', 'defenders');
    add(c.lieutenants, 'Lieutenant', 'Lieutenants');
    if (isObj(c.units) || isObj(c.beasts)) {
      Object.keys(isObj(c.units) ? c.units : {}).forEach(function (t) {
        var n = clampInt(c.units[t], 0), a = w && w.archetypes[t];
        if (n > 0) parts.push((a ? a.name : t) + (n > 1 ? ' ×' + n : ''));
      });
      Object.keys(isObj(c.beasts) ? c.beasts : {}).forEach(function (name) {
        var n = clampInt(c.beasts[name], 0);
        if (n > 0) parts.push(name + (n > 1 ? ' ×' + n : ''));
      });
    } else {
      add(c.beasts, 'beast', 'beasts');
      add(c.regiments, 'Regiment', 'Regiments');
    }
    return parts.length ? parts.join(', ') : 'no forces';
  };
  /* When a war order musters with less than it committed (some of it is no
     longer free: a beast died, the defenders went down, or an earlier
     order holds it), the sentence that says so; '' when nothing changed.
     ordered and commit are in the phase 2 shape. */
  R.musterShortfall = function (data, ordered, commit) {
    var a = R.cleanCommit(ordered, data), b = R.cleanCommit(commit, data);
    var same = a.defenders === b.defenders && a.lieutenants === b.lieutenants;
    [[a.units, b.units], [a.beasts, b.beasts]].forEach(function (k) {
      Object.keys(k[0]).concat(Object.keys(k[1])).forEach(function (n) { if ((k[0][n] || 0) !== (k[1][n] || 0)) same = false; });
    });
    if (same) return '';
    return 'not everything the war order committed is still free to march, so it musters with ' + R.militaryCommitLine(b) +
      ' (the order had ' + R.militaryCommitLine(a) + ').';
  };

  /* Where a Military Action has got to, for the War Council panel. */
  R.militaryStatus = function (ma) {
    if (ma.step === 'weather') return 'Ready to begin. First: the Weather Conditions roll.';
    if (ma.step === 'morale') return 'Weather rolled. Next: the Morale roll.';
    if (ma.step === 'luck') return 'Morale rolled. Next: the Luck roll.';
    var b = isObj(ma.battle) ? ma.battle : null;
    if (ma.step === 'deploy') return b && b.phase === 'deploy' ? 'Deploying on the War Table.' : 'Rolls done. Next: deploy your forces on the War Table.';
    if (b && b.result) return 'The battle is over. Next: the War Report.';
    if (b) return 'Battle under way: round ' + clampInt(b.round, 1) + ' of ' + clampInt(b.maxRounds || wd().rounds, 1) + '.';
    return 'Battle under way.';
  };

  /* ---------- After the battle ---------- */
  /* Which line of the casualty table a unit's final state reads from. */
  function casualtyState(u, held) {
    if (u.status === 'defeated') return held ? 'defeatedHeld' : 'defeatedLost';
    if (u.status === 'routed') return 'routed';
    var max = Number(u.cohesionMax), now = Number(u.cohesion);
    if (u.status === 'shaken' || (isFinite(max) && isFinite(now) && now <= max / 2)) return 'halfOrBelow';
    return 'steady';
  }
  function isBeastUnit(u) { return u.kind === 'beast' || u.type === 'beast'; }
  function isDefenderUnit(u) { return u.type === 'defenders' || u.kind === 'detachment'; }
  function beastName(u) { return String((u.source && u.source.beast) || u.name || 'Beast'); }
  function unitLabel(u) { return String(u.label || u.name || u.id); }

  /* Everything a result would change, without changing anything: the
     casualties (as a share of the soldiers present at the start, rounded to
     the nearest), the Lieutenants and beasts who need a d6 (or are
     separated), and the rewards. outcome overrides the battle's own result
     (Withdraw's preview). */
  R.battleConsequences = function (s, data, ma, battle, outcome) {
    var w = wd(data);
    outcome = outcome || (battle.result && battle.result.outcome);
    var held = outcome === 'victory' || outcome === 'draw';
    var regiments = [], defenders = [], beasts = [], leaders = [], hurt = [];
    var allLeaders = (Array.isArray(battle.leaders) ? battle.leaders : []).filter(function (l) { return isObj(l) && l.side === 'player'; });
    (Array.isArray(battle.units) ? battle.units : []).forEach(function (u) {
      if (!isObj(u) || u.side !== 'player') return;
      var state = casualtyState(u, held);
      var pct = w.casualties[state] || 0;
      var label = unitLabel(u);
      if (isBeastUnit(u)) {
        var b = { unitId: u.id, label: label, name: beastName(u), status: u.status, hurt: null };
        if (u.status === 'defeated' || u.status === 'routed') { b.hurt = { kind: 'beast', name: b.name, label: label, unitId: u.id, status: u.status }; hurt.push(b.hurt); }
        beasts.push(b);
      } else {
        var before = clampInt(u.personnel, 0), lost = Math.round(before * pct / 100);
        var entry = { unitId: u.id, label: label, status: u.status, state: state, pct: pct, before: before, lost: lost, after: before - lost };
        if (isDefenderUnit(u)) {
          defenders.push(entry);
        } else {
          entry.type = String((u.source && u.source.type) || u.type);
          entry.rowId = (u.source && u.source.rowId) || null;
          entry.size = clampInt(u.size, 1);
          regiments.push(entry);
        }
        if (isObj(u.support) && clampInt(u.support.count, 0) > 0) {
          var sb = clampInt(u.support.count, 0), sl = Math.round(sb * pct / 100);
          defenders.push({ unitId: u.id, label: 'Defenders supporting ' + label, support: true, status: u.status, state: state, pct: pct, before: sb, lost: sl, after: sb - sl });
        }
      }
      allLeaders.forEach(function (l) {
        if (l.hostId !== u.id) return;
        var e = { id: l.id, name: String(l.name || 'Lieutenant'), host: label, status: u.status, hurt: null };
        if (u.status === 'defeated' || u.status === 'routed') { e.hurt = { kind: 'lieutenant', name: e.name, label: e.name + ' (with ' + label + ')', unitId: u.id, status: u.status }; hurt.push(e.hurt); }
        leaders.push(e);
      });
    });
    allLeaders.forEach(function (l) {
      if (!leaders.some(function (e) { return e.id === l.id; })) leaders.push({ id: l.id, name: String(l.name || 'Lieutenant'), host: null, status: null, hurt: null });
    });
    return {
      outcome: outcome, held: held, enemyHolds: !held,
      regiments: regiments, defenders: defenders, beasts: beasts, leaders: leaders, hurt: hurt,
      defendersLost: defenders.reduce(function (a, d) { return a + d.lost; }, 0),
      rewards: R.warRewards(s, data, ma, battle, outcome)
    };
  };

  /* The rewards for a result, from the Bastion's existing amounts
     (bastion-data.js war.outcomes: [success, failure]):
     - victory: success; defeat and withdrawal: failure; a draw: nothing;
     - a raid's gold follows the supplies carried off (half for one of two,
       all for two); with none, the failure's gold;
     - a Clan's Honour: victory, defeat or withdrawal amount (W.rewards);
     - a Brigade's Trusted Clients as R.resolveWar changes them. */
  R.warRewards = function (s, data, ma, battle, outcome) {
    var w = wd(data);
    var o = data.bastion.war.outcomes[ma.objective] || { gp: [0, 0], pc: [0, 0] };
    var res = outcome === 'victory' ? 'success' : outcome === 'draw' ? 'none' : 'failure';
    var r = isObj(battle && battle.result) ? battle.result : {};
    var extracted = clampInt(r.extracted !== undefined ? r.extracted : (battle && battle.objective && battle.objective.extracted), 0);
    var need = (w.objectives.raid && w.objectives.raid.need) || 1;
    var gp = 0, pc = 0;
    if (res !== 'none') {
      pc = res === 'success' ? o.pc[0] : o.pc[1];
      if (ma.objective === 'raid') gp = extracted > 0 ? Math.round(o.gp[0] * Math.min(extracted, need) / need) : o.gp[1];
      else gp = res === 'success' ? o.gp[0] : o.gp[1];
    }
    var type = isObj(s.organization) ? s.organization.type : 'unsworn';
    var honour = null;
    if (type === 'clan') honour = outcome === 'victory' ? w.rewards.victoryHonour : outcome === 'defeat' ? w.rewards.defeatHonour : outcome === 'withdrawal' ? w.rewards.withdrawalHonour : 0;
    var trustedTable = (w.rewards && isObj(w.rewards.trusted)) ? w.rewards.trusted : TRUSTED;
    var trusted = type === 'merc' && res !== 'none' ? trustedTable[res] : null;
    return { result: res, gp: gp, pc: pc, honour: honour, trusted: trusted, extracted: extracted, need: need };
  };

  /* Apply the rewards to s, within the Bastion's limits (the treasury
     never goes below 0; Clan Honour stays 0 to 100; Political Capital −100
     to 100; Trusted Clients 0 to 100). Returns what actually changed:
     { gp, pc, honour, trusted: { target, others: { clanKey: n } } | null }.
     Run on a copy of those numbers for a preview. */
  function applyRewards(s, data, ma, rw) {
    var out = { gp: 0, pc: 0, honour: 0, trusted: null };
    var gp0 = Number(s.treasuryGP) || 0;
    s.treasuryGP = clampInt(gp0 + rw.gp, 0);
    out.gp = s.treasuryGP - gp0;
    var pcKey = R.clanIdFromLabel(ma.targetName);
    if (rw.pc && pcKey) {
      var pc0 = s.politicalCapital[pcKey] || 0;
      R.addPoliticalCapital(s, ma.targetName, rw.pc);
      out.pc = (s.politicalCapital[pcKey] || 0) - pc0;
    }
    if (rw.honour) {
      var h0 = s.clanHonor === undefined || s.clanHonor === null ? 40 : clampInt(s.clanHonor, 0, 100);
      s.clanHonor = clampInt(h0 + rw.honour, 0, 100);
      out.honour = s.clanHonor - h0;
    }
    if (rw.trusted) {
      out.trusted = { target: 0, others: {} };
      var shift = function (key, by) {
        var t0 = s.trustedClientsByClan[key] === undefined ? 50 : clampInt(s.trustedClientsByClan[key], 0, 100);
        s.trustedClientsByClan[key] = clampInt(t0 + by, 0, 100);
        return s.trustedClientsByClan[key] - t0;
      };
      out.trusted.target = shift(ma.targetKey, rw.trusted.target);
      data.bastion.clans.forEach(function (cl) { if (cl.key !== ma.targetKey) out.trusted.others[cl.key] = shift(cl.key, rw.trusted.others); });
    }
    return out;
  }
  /* What the rewards would change now, without changing anything. */
  function previewRewards(s, data, ma, rw) {
    return applyRewards({
      treasuryGP: s.treasuryGP, clanHonor: s.clanHonor,
      politicalCapital: Object.assign({}, s.politicalCapital), trustedClientsByClan: Object.assign({}, s.trustedClientsByClan)
    }, data, ma, rw);
  }

  /* The money and standing lines: "Treasury: +75 gp (now 175 gp)." etc.
     They give what actually changed; when a limit cut it short, the full
     amount and the limit are given too: "Treasury: −20 gp (−60 gp, but the
     treasury can't go below 0; now 0 gp)." now: show the new totals. */
  function rewardLines(s, data, ma, rw, got, now) {
    var lines = [];
    function line(label, nominal, real, unit, limit, total) {
      if (!nominal) return label + ': no change' + (total !== null ? ' (now ' + total + unit + ')' : '') + '.';
      var notes = [];
      if (real !== nominal) notes.push(signed(nominal) + unit + ', but ' + limit);
      if (total !== null) notes.push('now ' + total + unit);
      return label + ': ' + signed(real) + unit + (notes.length ? ' (' + notes.join('; ') + ')' : '') + '.';
    }
    lines.push(line('Treasury', rw.gp, got.gp, ' gp', 'the treasury can\'t go below 0', now && rw.gp ? s.treasuryGP : null));
    lines.push(line('Political Capital (' + ma.targetName + ')', rw.pc, got.pc, '', 'it can\'t go ' + (rw.pc > 0 ? 'above 100' : 'below −100'), null));
    if (rw.honour !== null) lines.push(line('Clan Honour', rw.honour, got.honour, '', 'it can\'t go ' + (rw.honour > 0 ? 'above 100' : 'below 0'), now ? s.clanHonor : null));
    if (rw.trusted && got.trusted) {
      var short = [];
      data.bastion.clans.forEach(function (cl) {
        var n = got.trusted.others[cl.key];
        if (n === undefined || n === rw.trusted.others) return;
        short.push(cl.name + (n === 0 ? ' (already at ' + (rw.trusted.others > 0 ? 100 : 0) + ')' : ' ' + signed(n) + ' (at the limit)'));
      });
      var target = signed(got.trusted.target) + (got.trusted.target !== rw.trusted.target ? ' (' + signed(rw.trusted.target) + ', but it can\'t go ' + (rw.trusted.target > 0 ? 'above 100' : 'below 0') + ')' : '');
      lines.push('Trusted Clients: ' + ma.targetName + ' ' + target + ', every other clan ' + signed(rw.trusted.others) +
        (short.length ? ' except ' + short.join(', ') : '') + '.');
    }
    return lines;
  }
  /* "25 Line Infantry 2, 10 defenders" (soldiers lost). */
  function lossesLine(c) {
    var parts = [];
    c.regiments.forEach(function (r) { if (r.lost > 0) parts.push(r.lost + ' from ' + r.label); });
    if (c.defendersLost > 0) parts.push(plural(c.defendersLost, 'defender', 'defenders'));
    return parts.length ? 'Soldiers lost: ' + parts.join(', ') + '.' : 'No soldiers lost.';
  }

  /* What Withdraw would cost if confirmed now, for its confirm box. */
  R.withdrawPreview = function (s, data, ma, battle) {
    if (typeof ma === 'string') ma = R.militaryById(s, ma);
    if (!ma || !isObj(battle)) return [];
    var c = R.battleConsequences(s, data, ma, battle, 'withdrawal');
    var lines = ['Your army leaves the field and the enemy holds it: the battle counts as lost.'];
    rewardLines(s, data, ma, c.rewards, previewRewards(s, data, ma, c.rewards), false).forEach(function (l) { lines.push(l); });
    if (ma.objective === 'raid' && c.rewards.extracted > 0) lines.push('The supplies already carried off (' + c.rewards.extracted + ') are kept.');
    lines.push(lossesLine(c));
    var fallen = c.hurt.filter(function (h) { return h.status === 'defeated'; });
    var separated = c.hurt.filter(function (h) { return h.status === 'routed'; });
    if (fallen.length) lines.push('A d6 for each of ' + fallen.map(function (h) { return h.label; }).join(', ') + ': killed, captured, wounded or recovering.');
    if (separated.length) lines.push('Separated for ' + plural(wd(data).separatedTurns, 'turn', 'turns') + ': ' + separated.map(function (h) { return h.label; }).join(', ') + '.');
    return lines;
  };

  function recoveryRow(w, d6) {
    for (var i = 0; i < w.recovery.length; i++) if (d6 >= w.recovery[i].from && d6 <= w.recovery[i].to) return w.recovery[i];
    return w.recovery[w.recovery.length - 1];
  }
  var RECOVERY_WORDS = {
    killed: 'killed', captured: 'captured by the enemy', badly_wounded: 'badly wounded', wounded: 'wounded',
    recovered: 'recovering', separated: 'separated from the army'
  };
  /* "Lieutenant: wounded, back on turn 5." */
  R.recoveryText = function (rec) {
    return rec.name + ': ' + (RECOVERY_WORDS[rec.status] || rec.status) + ', back on turn ' + rec.untilTurn + '.';
  };

  /* Take one Lieutenant or one beast of that name off its list. */
  function removeOne(s, h) {
    var list = h.kind === 'lieutenant' ? s.military : s.defenderBeasts;
    if (!Array.isArray(list)) return;
    var idx = -1;
    for (var i = list.length - 1; i >= 0; i--) {
      var row = list[i];
      if (!isObj(row) || isDepleted(row)) continue;
      if (h.kind === 'lieutenant' ? /lieutenant/i.test(String(row.name || '')) : String(row.name || 'Beast') === h.name) { idx = i; break; }
    }
    if (idx === -1) return;
    var q = rowQty(list[idx]);
    if (q <= 1) list.splice(idx, 1);
    else list[idx].qty = q - 1;
  }

  /* A regiment's losses on the Military list: a full one leaves its counted
     row and comes back as a depleted row (or not at all if nobody's left);
     a depleted one has its strength lowered, or is removed at 0. */
  function applyRegimentLoss(s, data, ma, r) {
    if (!Array.isArray(s.military)) s.military = [];
    if (r.rowId) {
      var row = null;
      s.military.forEach(function (x) { if (isDepleted(x) && x.id === r.rowId) row = x; });
      if (!row) return 'no longer on the Military list';
      if (r.after <= 0) s.military = s.military.filter(function (x) { return x !== row; });
      else row.strength = r.after;
      return null;
    }
    var idx = -1;
    s.military.forEach(function (x, i) { if (idx === -1 && isObj(x) && !isDepleted(x) && R.unitTypeOf(x.name, data) === r.type && rowQty(x) > 0) idx = i; });
    if (idx === -1) return 'no longer on the Military list';
    var full = s.military[idx];
    var q = rowQty(full);
    var name = full.name, source = full.source || '';
    if (q <= 1) s.military.splice(idx, 1);
    else full.qty = q - 1;
    if (r.after > 0) {
      var at = -1;
      s.military.forEach(function (x, i) { if (isObj(x) && R.unitTypeOf(x.name, data) === r.type) at = i; });
      var dep = { id: uniqueId(s.military, 'reg-' + R.hashText(ma.id + '|' + r.unitId)), name: name, qty: 1, strength: r.after, source: source, depleted: true };
      s.military.splice(at === -1 ? Math.min(idx, s.military.length) : at + 1, 0, dep);
    }
    return null;
  }

  /* The battle's important moments, from its log, by the kind of each
     entry (the battle rules tag every one): the result and the army
     breaking first, then units Routed or Defeated and supplies brought
     home, then supplies taken or dropped and the depot or outpost held at a
     round end, then units Shaken or rallied. Moves, attacks, Hold orders
     and nerve held aren't moments. At most MOMENTS_MAX are kept, the
     least important going first; they're listed in the order they
     happened. A log from before the entries had kinds is read by its
     words instead. */
  var MOMENT_RANK = { result: 0, withdraw: 0, routed: 1, defeated: 1, extract: 1, interact: 2, drop: 2, round: 2, shaken: 3, rally: 3 };
  var MOMENT_WORDS = /rout|defeated|shaken|rall|extract|picks up|secures|drops|withdraw|breaks|round ends? in a row/i;
  var MOMENTS_MAX = 20;
  function momentRank(e) {
    var text = String(e.text || '');
    if (typeof e.kind === 'string') {
      if (!MOMENT_RANK.hasOwnProperty(e.kind)) return -1;
      /* Of the round lines, only a round end with the depot or outpost held. */
      if (e.kind === 'round' && !/\b(you hold|the enemy holds)\b/i.test(text)) return -1;
      return MOMENT_RANK[e.kind];
    }
    return MOMENT_WORDS.test(text) && !/ holds: /.test(text) ? 2 : -1;
  }
  function keyMoments(battle) {
    var picked = [];
    (Array.isArray(battle.log) ? battle.log : []).forEach(function (e, i) {
      if (!isObj(e)) return;
      var rank = momentRank(e);
      if (rank >= 0) picked.push({ e: e, i: i, rank: rank });
    });
    picked.sort(function (a, b) { return a.rank - b.rank || a.i - b.i; });
    picked = picked.slice(0, MOMENTS_MAX).sort(function (a, b) { return a.i - b.i; });
    return picked.map(function (p) { return 'Round ' + clampInt(p.e.round, 1) + ': ' + String(p.e.text); });
  }

  /* Apply a finished battle, exactly once: casualties, Lieutenants and beasts
     (a d6 each when their formation, or the beast, was Defeated; separated
     when Routed), rewards, the War Report in the war log, and the action
     and its mission removed. Refused (null) if the action has gone or the
     battle has no result. Returns { lines, report } (report is the war-log
     entry: { id, at, title, subtitle, details }). */
  R.finishBattle = function (s, data, id, battle, rand, now) {
    var ma = R.militaryById(s, id);
    var b = isObj(battle) ? battle : ma && ma.battle;
    if (!ma || !isObj(b) || !isObj(b.result) || OUTCOMES.indexOf(b.result.outcome) === -1) return null;
    var w = wd(data);
    var c = R.battleConsequences(s, data, ma, b);
    var mission = isObj(s.warMissions) ? s.warMissions[ma.missionKey] : null;

    /* Casualties. */
    c.regiments.forEach(function (r) { if (r.lost > 0) r.note = applyRegimentLoss(s, data, ma, r); });
    var defBefore = clampInt(s.defenders.count, 0);
    s.defenders.count = Math.max(0, defBefore - c.defendersLost);

    /* Lieutenants and beasts. */
    if (!Array.isArray(s.warRecovery)) s.warRecovery = [];
    c.hurt.forEach(function (h, i) {
      if (h.status === 'routed') {
        h.result = 'separated';
        h.turns = w.separatedTurns;
      } else {
        h.d6 = R.d(6, rand);
        var row = recoveryRow(w, h.d6);
        h.result = row.result;
        h.turns = row.turns || 0;
        if (row.result === 'captured' && !c.enemyHolds) { h.result = 'badly_wounded'; h.turns = w.badlyWoundedTurns; }
      }
      if (h.result === 'killed' || h.result === 'captured') {
        removeOne(s, h);
      } else {
        h.untilTurn = s.turn + h.turns;
        var recId = 'rec-' + R.hashText(ma.id + '|' + i + '|' + h.name);
        s.warRecovery.forEach(function (x) { if (x.id === recId) recId += '-' + i; });
        s.warRecovery.push({ id: recId, kind: h.kind, name: h.name, status: h.result, untilTurn: h.untilTurn });
      }
    });

    /* Rewards, within the Bastion's limits: c.applied is what changed. */
    var rw = c.rewards;
    c.applied = applyRewards(s, data, ma, rw);

    /* The War Report. */
    var report = warReport(s, data, ma, b, c, mission, defBefore, now);
    if (!Array.isArray(s.warLog)) s.warLog = [];
    s.warLog.unshift(report);
    R.log(s, 'War Turn Resolved', report.title, now);

    var lines = [headline(b, c)];
    rewardLines(s, data, ma, rw, c.applied, true).forEach(function (l) { lines.push(l); });
    if (ma.objective === 'raid') lines.push('Supplies carried off: ' + rw.extracted + ' of ' + rw.need + ' needed.');
    lines.push(lossesLine(c));
    c.hurt.forEach(function (h) { lines.push(hurtLine(h)); });

    s.militaryActions = s.militaryActions.filter(function (x) { return x.id !== ma.id; });
    closeMission(s, ma.missionKey);
    return { lines: lines, report: report };
  };
  /* The mission is done with. If another waiting order or Military Action
     is against the same mission, it's kept for them (the same enemy army),
     but without any opening rolls kept from a called-off attempt: the
     battle has been fought, and the next one is a new battle that makes
     its own rolls (an action already under way keeps the ones it made). */
  function closeMission(s, key) {
    if (!isObj(s.warMissions) || !s.warMissions[key]) return;
    if (!missionsInUse(s)[key]) { delete s.warMissions[key]; return; }
    s.warMissions[key].conditions = null;
  }

  function outcomeWord(o) { return { victory: 'Victory', defeat: 'Defeat', draw: 'Draw', withdrawal: 'Withdrawal' }[o] || 'Result'; }
  function headline(b, c) {
    var r = b.result;
    var reason = r.reason ? String(r.reason).trim() : '';
    if (reason && !/[.!?]$/.test(reason)) reason += '.';
    return outcomeWord(c.outcome) + ' in round ' + clampInt(r.round || b.round, 1) + ' of ' + clampInt(b.maxRounds || wd().rounds, 1) + (reason ? ': ' + reason : '.');
  }
  /* What happened to a Lieutenant or beast: "wounded (d6 3), back on turn 5." */
  function hurtResult(h) {
    var what = RECOVERY_WORDS[h.result] || h.result;
    var dice = h.d6 ? ' (d6 ' + h.d6 + ')' : '';
    if (h.result === 'killed' || h.result === 'captured') return what + dice + '.';
    return what + dice + ', back on turn ' + h.untilTurn + '.';
  }
  function hurtLine(h) { return h.label + ': ' + hurtResult(h); }
  function rollLine(label, rec, value) {
    return label + ': ' + value + ' (d20 ' + rec.total + ' vs DC ' + rec.dc + ')';
  }

  /* "Routed", or "Steady at half Cohesion or below" (why a Steady unit lost some). */
  function stateText(e) {
    var name = STATUS_NAMES[e.status] || String(e.status || 'Steady');
    return e.state === 'halfOrBelow' && e.status !== 'shaken' ? name + ' at half Cohesion or below' : name;
  }

  /* The full War Report, in plain English, as a war-log entry. */
  function warReport(s, data, ma, b, c, mission, defBefore, now) {
    var w = wd(data);
    var title = outcomeWord(c.outcome) + ': ' + R.militaryName(ma);
    var obj = w.objectives[ma.objective];
    var tier = tierOf(w, ma.tier);
    var out = [];
    out.push('Objective: ' + (obj ? obj.name + '. ' + obj.rule : ma.objective));
    var variation = '';
    if (mission && isObj(mission.variation)) {
      w.variation.forEach(function (v) { if (v.mult === mission.variation.mult && !variation) variation = v.text; });
    }
    var startBV = isObj(b.startBV) ? b.startBV : {};
    out.push('Enemy: ' + ma.targetName + ', ' + (tier ? tier.name.toLowerCase() : ma.tier) + (variation ? ' (' + variation + ')' : '') +
      (startBV.enemy !== undefined ? ', Battle Value ' + startBV.enemy : '') + '. Your army: Battle Value ' + (startBV.player !== undefined ? startBV.player : '?') + '.');
    var rolls = [];
    if (ma.weather) rolls.push(rollLine('Weather', ma.weather, R.militaryWeather(data, ma.weather.id).title));
    if (ma.morale) rolls.push(rollLine('Morale', ma.morale, ma.morale.pass ? 'High' : 'Low'));
    if (ma.luck) rolls.push(rollLine('Luck', ma.luck, signed(ma.luck.pass ? w.luck.passMod : w.luck.failMod)));
    if (rolls.length) out.push('Opening rolls: ' + rolls.join('; ') + '.');
    out.push('Result: ' + headline(b, c));
    var lost = isObj(b.result.lostPct) ? b.result.lostPct : {};
    /* To one decimal place, as the result line and the War Table show them
       (the Skirmish is decided on these). */
    var pct = function (v) { return String(Math.round((Number(v) || 0) * 10) / 10); };
    if (lost.player !== undefined || lost.enemy !== undefined) out.push('Battle Value lost: yours ' + pct(lost.player) + '%, the enemy\'s ' + pct(lost.enemy) + '%.');
    if (ma.objective === 'raid') out.push('Supplies carried off: ' + c.rewards.extracted + ' of ' + c.rewards.need + ' needed.');

    out.push('');
    out.push('Your forces (start → end):');
    c.regiments.forEach(function (r) {
      var end = r.lost <= 0 ? 'no losses' : r.after > 0 ? r.lost + ' lost, ' + r.after + ' remain' : 'all ' + r.before + ' lost; the unit is gone';
      out.push('- ' + r.label + ': ' + r.before + ' soldiers → ' + stateText(r) + ', ' + end + (r.note ? ' (' + r.note + ')' : '') + '.');
    });
    c.defenders.forEach(function (d) {
      out.push('- ' + (d.support ? d.label : d.label + ' (defenders)') + ': ' + d.before + ' → ' + stateText(d) + ', ' + (d.lost > 0 ? d.lost + ' lost' : 'no losses') + '.');
    });
    c.beasts.forEach(function (bst) {
      out.push('- ' + bst.label + ': ' + (STATUS_NAMES[bst.status] || bst.status) + (bst.hurt ? ', ' + hurtResult(bst.hurt) : '.'));
    });
    c.leaders.forEach(function (l) {
      var where = l.host ? ' (with ' + l.host + ')' : ' (not attached)';
      out.push('- ' + l.name + where + ': ' + (l.hurt ? (STATUS_NAMES[l.status] || l.status) + ', ' + hurtResult(l.hurt) : 'unhurt.'));
    });

    out.push('');
    out.push('Enemy forces (start → end):');
    var foes = (Array.isArray(b.units) ? b.units : []).filter(function (u) { return isObj(u) && u.side === 'enemy'; });
    foes.forEach(function (u) {
      var state = STATUS_NAMES[u.status] || u.status || 'Steady';
      /* Units still standing when their army broke left the field with it. */
      if (u.withdrawn === true) state = (u.status === 'shaken' ? 'Shaken, and withdrew' : 'Withdrew') + ' with its army';
      out.push('- ' + unitLabel(u) + ': ' + state + '.');
    });
    (Array.isArray(b.leaders) ? b.leaders : []).forEach(function (l) {
      if (!isObj(l) || l.side !== 'enemy') return;
      var host = null;
      foes.forEach(function (u) { if (u.id === l.hostId) host = u; });
      out.push('- ' + l.name + (host ? ' (with ' + unitLabel(host) + ')' : '') + '.');
    });

    var moments = keyMoments(b);
    if (moments.length) {
      out.push('');
      out.push('Key moments:');
      moments.forEach(function (m) { out.push('- ' + m); });
    }

    out.push('');
    out.push('Changes to the Bastion:');
    rewardLines(s, data, ma, c.rewards, c.applied, true).forEach(function (l) { out.push('- ' + l); });
    if (c.defendersLost > 0) out.push('- Defenders: ' + signed(-c.defendersLost) + ' (now ' + s.defenders.count + ', from ' + defBefore + ').');
    out.push('- ' + lossesLine(c));
    c.hurt.forEach(function (h) { out.push('- ' + hurtLine(h)); });

    return {
      id: 'wl-' + ma.id + '-' + (Array.isArray(s.warLog) ? s.warLog.length : 0),
      at: now === undefined ? Date.now() : now,
      title: title,
      subtitle: 'Committed: ' + R.militaryCommitLine(ma.commit),
      details: out.join('\n')
    };
  }

  /* ---------- Recovery, each Bastion turn ---------- */
  /* Called by R.startTurn after the turn number goes up: anyone whose time
     is up is fit again (and can be committed). Returns those who came back. */
  R.tickRecovery = function (s, now) {
    if (!Array.isArray(s.warRecovery)) { s.warRecovery = []; return []; }
    var back = s.warRecovery.filter(function (r) { return s.turn >= r.untilTurn; });
    if (!back.length) return [];
    s.warRecovery = s.warRecovery.filter(function (r) { return s.turn < r.untilTurn; });
    back.forEach(function (r) {
      var text = r.status === 'separated'
        ? r.name + ' has found the way back to the Bastion.'
        : r.kind === 'beast' ? 'The ' + r.name + ' is fit to fight again.' : r.name + ' is fit for duty again.';
      R.log(s, 'War Recovery', text, now);
    });
    return back;
  };

  /* ---------- Stat blocks ---------- */
  /* A unit's printed profile by archetype id, War Room label, name or beast
     name, with its name, traits and distinction; { kind: 'lieutenant' } for a
     Lieutenant; null if unknown. opts.beast: the name is a Menagerie beast,
     so one with no profile in the data file (from an imported save, say)
     gets W.beastDefault under its own name, as it fights. */
  R.unitProfile = function (data, what, opts) {
    var w = wd(data);
    var raw = String(what || '').trim();
    if (!raw) return null;
    var asBeast = isObj(opts) && opts.beast === true;
    var type = asBeast ? null : w.archetypes[raw] ? raw : R.unitTypeOf(raw, data);
    if (type === 'lieutenant') return { kind: 'lieutenant', name: w.lieutenant.name };
    if (type && w.archetypes[type]) {
      var a = w.archetypes[type];
      var p = profileOf(a, a.traits, w);
      return Object.assign({ id: a.id, name: a.name, type: a.id, kind: 'formation' }, p, { traits: a.traits.slice(), distinction: a.distinction });
    }
    var beast = w.beasts[raw];
    var name = raw;
    if (!beast) Object.keys(w.beasts).forEach(function (k) { if (!beast && k.toLowerCase() === raw.toLowerCase()) { beast = w.beasts[k]; name = k; } });
    if (!beast && asBeast) beast = w.beastDefault;
    if (!beast) return null;
    var traits = beast.trait ? [beast.trait] : [];
    return Object.assign({ id: name, name: name, type: 'beast', kind: 'beast' }, profileOf(beast, traits, w), { traits: traits, distinction: beast.distinction });
  };
  function signedStat(n) { return n < 0 ? '−' + Math.abs(n) : '+' + n; }
  /* The stat block, formatted here in the battle rules' shape: { title,
     rows: [{ key, name, value, text }], traits: [{ id, name, text }],
     distinction, notes }. value is what's shown ("+4 ranged / +1 melee",
     "13"); text says what the stat means. A Lieutenant's shows what it adds
     to the formation it leads. */
  R.formatStatBlock = function (p, data) {
    var w = wd(data);
    var bvStat = w.stats.filter(function (st) { return st.key === 'bv'; })[0] || { name: 'Battle Value', text: '' };
    if (p.kind === 'lieutenant') {
      var lt = w.lieutenant;
      return {
        title: lt.name,
        rows: [
          { key: 'resolve', name: 'Resolve', value: signedStat(lt.resolveBonus), text: 'Added to the Resolve of the formation it leads.' },
          { key: 'bv', name: bvStat.name, value: String(lt.bv), text: bvStat.text }
        ],
        traits: [], distinction: lt.text, notes: []
      };
    }
    var ranged = p.rangedAttack !== undefined;
    var rows = w.stats.map(function (st) {
      var v = p[st.key];
      var value = String(v), text = st.text;
      if (st.key === 'attack') {
        value = ranged ? signedStat(p.rangedAttack) + ' ranged / ' + signedStat(p.attack) + ' melee' : signedStat(v);
        if (ranged) text += ' Ranged attacks reach ' + p.range + ' squares.';
      }
      if (st.key === 'resolve') value = signedStat(v);
      return { key: st.key, name: st.name, value: value, text: text };
    });
    var traits = (p.traits || []).filter(function (t) { return w.traits[t]; }).map(function (t) { return { id: t, name: w.traits[t].name, text: w.traits[t].text }; });
    return { title: p.name, rows: rows, traits: traits, distinction: p.distinction || '', notes: [] };
  };
  /* The stat block for the War Room's dropdown, the Military panel and the
     Menagerie: from the battle rules when they're loaded (so it matches the
     War Table), otherwise formatted here. opts as R.unitProfile's: the
     Menagerie passes { beast: true }. */
  R.unitStatBlock = function (data, typeOrBeastName, opts) {
    var w = wd(data);
    var p = R.unitProfile(data, typeOrBeastName, opts);
    if (!p) return null;
    var br = ns.battleRules;
    if (br && typeof br.statBlock === 'function') {
      var block = br.statBlock(p.kind === 'lieutenant' ? 'lieutenant' : p, w);
      if (block) return block;
    }
    return R.formatStatBlock(p, data);
  };

  /* ---------- Loading saves ---------- */
  /* A saved roll, tidied. A Luck roll's modifier follows its pass and the
     data file (W.luck), as the battle does. */
  function cleanRoll(r, extra, data) {
    if (!isObj(r)) return null;
    var out = { d20: clampInt(r.d20, 1, 20), total: clampInt(r.total, -100, 200), dc: clampInt(r.dc, 0, 100), pass: !!r.pass };
    if (extra === 'id') out.id = typeof r.id === 'string' ? r.id : 'clear';
    if (extra === 'mod') out.mod = R.luckMod(data, out.pass);
    return out;
  }
  /* A step can't be ahead of the results it needs. */
  function fixStep(step, ma) {
    var at = R.MILITARY_STEPS.indexOf(step);
    if (!ma.weather && at > 0) return 'weather';
    if (!ma.morale && at > 1) return 'morale';
    if (!ma.luck && at > 2) return 'luck';
    var fighting = isObj(ma.battle) && (ma.battle.phase === 'battle' || ma.battle.phase === 'over');
    if (step === 'battle' && !fighting) return 'deploy';
    if (step === 'deploy' && fighting) return 'battle';
    return step;
  }
  /* Is it a Military Action (phase 1 or 2)? */
  R.isMilitaryAction = function (v) {
    if (!isObj(v) || typeof v.id !== 'string' || !isObj(v.commit)) return false;
    if (v.v === 2) return R.MILITARY_STEPS.indexOf(v.step) !== -1;
    return PHASE1_STEPS.indexOf(v.step) !== -1 && Array.isArray(v.forces);
  };
  /* A phase 2 Military Action, tidied, with its fields in a fixed order. */
  function cleanAction(d, data, v) {
    var w = wd(data);
    var ma = {
      id: v.id, orderId: String(v.orderId || ''), turn: clampInt(v.turn, 1), v: 2,
      objective: w.objectives[v.objective] ? String(v.objective) : 'raid',
      targetKey: String(v.targetKey || ''), targetName: String(v.targetName || ''),
      tier: tierOf(w, v.tier) ? String(v.tier) : 'established', missionKey: String(v.missionKey || ''),
      commit: R.cleanCommit(v.commit, data), step: v.step,
      weather: cleanRoll(v.weather, 'id'), morale: cleanRoll(v.morale), luck: cleanRoll(v.luck, 'mod', data),
      spec: isObj(v.spec) ? v.spec : null,
      battle: R.isBattle(v.battle) ? v.battle : null
    };
    if (!ma.missionKey) ma.missionKey = R.missionKey(ma.targetKey, ma.objective, ma.tier);
    ma.step = fixStep(ma.step, ma);
    if (!ma.spec) ma.spec = R.buildSpec(d, data, ma, { ignoreOrders: true });
    return ma;
  }
  /* A phase 1 Military Action becomes a phase 2 one: its Regiments are Line
     Infantry, it gets a mission (an established local force), its line-up is
     built now (anything already committed to an earlier action can't be
     used twice), any old deployment is dropped, and one that was waiting
     for the single battle roll goes back to deployment. */
  function upgradeAction(d, data, v) {
    var w = wd(data);
    var objective = w.objectives[v.objective] ? String(v.objective) : 'raid';
    var targetKey = w.clans[v.targetKey] ? String(v.targetKey) : 'blackstone';
    var ma = {
      id: v.id, orderId: String(v.orderId || ''), turn: clampInt(v.turn, 1), v: 2,
      objective: objective, targetKey: targetKey, targetName: String(v.targetName || R.clanName(data, targetKey)),
      tier: 'established', missionKey: '', commit: null, step: v.step === 'resolve' ? 'deploy' : v.step,
      weather: cleanRoll(v.weather, 'id'), morale: cleanRoll(v.morale), luck: cleanRoll(v.luck, 'mod', data),
      spec: null, battle: null
    };
    /* Its beasts: the first in the list not held by an action already loaded. */
    ma.commit = R.warCommit2(d, data, phase1Commit(d, data, v.commit, readCommits({ militaryActions: d.militaryActions, warRecovery: d.warRecovery, defenderBeasts: d.defenderBeasts }, data).taken), { ignoreOrders: true });
    var mission = R.ensureMission(d, data, targetKey, objective, 'established');
    ma.missionKey = mission.key;
    ma.step = fixStep(ma.step, ma);
    ma.spec = R.buildSpec(d, data, ma, { ignoreOrders: true });
    if (ma.luck) R.warConditionsRolled(d, data, ma);
    return ma;
  }
  /* The Military list's depleted rows: { id, name, qty: 1, strength, source,
     depleted: true }, strength 1 to one less than full size. A row at full
     strength becomes an ordinary one and keeps its count; a row under
     strength counting several becomes that many depleted rows (nobody is
     lost); one with nobody left is removed; one without an id gets one
     from a hash. Rows with no strength are kept as they are. */
  function cleanMilitary(list, data) {
    var w = wd(data), out = [];
    (Array.isArray(list) ? list : []).forEach(function (row, i) {
      if (!isObj(row)) return;
      if (row.depleted !== true && (row.strength === undefined || row.strength === null)) { out.push(row); return; }
      var type = R.unitTypeOf(row.name, data);
      var a = type && w.archetypes[type];
      var name = String(row.name || '');
      var source = String(row.source || '');
      if (!a) { out.push({ name: name, qty: Math.max(1, rowQty(row)), source: source }); return; }
      var strength = row.strength === undefined || row.strength === null ? a.size : clampInt(row.strength, 0, a.size);
      if (strength <= 0) return;
      if (strength >= a.size) { out.push({ name: name, qty: rowQty(row), source: source }); return; }
      var id = typeof row.id === 'string' && row.id ? row.id : 'reg-' + R.hashText(name + '|' + i + '|' + strength);
      for (var k = 0; k < rowQty(row); k++) out.push({ id: uniqueId(out, id), name: name, qty: 1, strength: strength, source: source, depleted: true });
    });
    return out;
  }
  function cleanMissions(src) {
    var out = {};
    if (!isObj(src)) return out;
    Object.keys(src).forEach(function (k) {
      var m = src[k];
      if (!isObj(m) || m.key !== k || !isObj(m.enemy) || !Array.isArray(m.enemy.units)) return;
      /* Kept opening rolls start with the Weather; anything else is none. */
      out[k] = isObj(m.conditions) && isObj(m.conditions.weather) ? m : Object.assign({}, m, { conditions: null });
    });
    return out;
  }
  function cleanRecovery(list) {
    return (Array.isArray(list) ? list : []).filter(function (r) {
      return isObj(r) && (r.kind === 'lieutenant' || r.kind === 'beast') && typeof r.name === 'string' && r.name;
    }).map(function (r, i) {
      return { id: typeof r.id === 'string' && r.id ? r.id : 'rec-' + i, kind: r.kind, name: r.name, status: String(r.status || 'wounded'), untilTurn: clampInt(r.untilTurn, 1) };
    });
  }

  /* Called by R.fromSave once everything else is loaded: the war's records
     tidied (missions, recovery, the mission counter, depleted regiments),
     and phase 1 Military Actions upgraded. d is the state being built, s the
     save. Doing it twice changes nothing. */
  R.normalizeWar = function (d, s, data) {
    d.military = cleanMilitary(d.military, data);
    d.warMissions = cleanMissions(s.warMissions);
    d.warRecovery = cleanRecovery(s.warRecovery);
    d.warMissionSeq = clampInt(s.warMissionSeq === undefined || s.warMissionSeq === null ? 0 : s.warMissionSeq, 0);
    var raw = Array.isArray(d.militaryActions) ? d.militaryActions : [];
    d.militaryActions = [];
    raw.forEach(function (v) {
      if (!R.isMilitaryAction(v)) return;
      d.militaryActions.push(v.v === 2 ? cleanAction(d, data, v) : upgradeAction(d, data, v));
    });
  };
}());
