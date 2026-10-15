/* The Ironbow Bastion Manager — the War Room's regiments (the facilities
   overhaul's pull request 8a; Harry's War Room proposal, approved as
   written on 15 October 2026: docs/specs/war-room-training.txt). Plain
   functions (no screen code), tested on tests/rules.html. They add to the
   Bastion's rules, as creature-rules.js does. The numbers are in
   data/war-room-data.js (data.warRoom).

   Every regiment on the Military list is its own record:
     { id, name, qty: 1, source, num, label, grade
       [, strength, depleted: true, recoup: { days, left, from }] }
   - name: what was recruited ("Line Infantry (100)"); its kind comes from
     R.unitTypeOf, as before.
   - num: its number among regiments of its kind ("Line Infantry II"), kept
     for good; label: a name the DM types instead ('' for none).
   - grade: 'regular', 'trained' or 'veteran' (Drill a Regiment).
   - strength, depleted, recoup: a regiment under strength. It refills by
     itself (Recouping): each day it isn't away at a battle, one day of
     recoup.left goes, and its strength climbs evenly from recoup.from to
     full on the last day.
   Lieutenants aren't regiments: they stay a counted row (Harry, W2).

   Drill a Regiment (War Room Level 2) is a pending order holding its
   regiment's id (chosen.regimentId) and the grade it gives (chosen.toGrade).
   Its gold is paid once, when it starts. While its regiment is Recouping or
   away at a battle, the drill waits a day for each such day. If the
   regiment is lost, the drill ends with it (Harry, W3), with nothing back.
   The Musters (Levels 3 and 5) are pending orders holding the formations
   they raise (chosen.units); each is raised as Recruit raises one. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.bastion = TSI.bastion || {};
  var R = ns.rules;
  if (!R) return;
  var clampInt = R.clampInt;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function rowQty(row) { return clampInt(row && row.qty !== undefined && row.qty !== null ? row.qty : 1, 0); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------- The War Room's data, with safe defaults ---------- */
  var FALLBACK = {
    grades: [{ id: 'regular', name: 'Regular' }],
    drillSlots: {}, drillLevel: 2,
    recoup: [{ upToPct: 100, days: 14 }],
    nameMax: 40
  };
  function wr(data) {
    if (data && isObj(data.warRoom)) return data.warRoom;
    var g = window.TSI_DATA && window.TSI_DATA.bastionWarRoom;
    return isObj(g) ? g : FALLBACK;
  }
  R.warRoomData = wr;
  function war(data) { return R.warData ? R.warData(data) : null; }
  function archetypeOf(row, data) {
    var w = war(data);
    var type = isObj(row) && R.unitTypeOf ? R.unitTypeOf(row.name, data) : null;
    return type && w && w.archetypes && w.archetypes[type] ? { type: type, a: w.archetypes[type] } : null;
  }
  R.regimentArchetype = archetypeOf;

  /* ---------- Grades ---------- */
  function grades(data) { return Array.isArray(wr(data).grades) && wr(data).grades.length ? wr(data).grades : FALLBACK.grades; }
  R.gradeIndex = function (data, id) {
    var g = grades(data);
    for (var i = 0; i < g.length; i++) if (g[i].id === id) return i;
    return 0;
  };
  R.gradeOf = function (data, id) { return grades(data)[R.gradeIndex(data, id)]; };
  R.gradeName = function (data, id) { return R.gradeOf(data, id).name; };
  R.nextGrade = function (data, id) { return grades(data)[R.gradeIndex(data, id) + 1] || null; };
  /* A regiment's bonus over its base stat block: every step's, added up. */
  R.gradeBonus = function (data, id) {
    var out = { resolve: 0, cohesion: 0, bv: 0 };
    var g = grades(data), top = R.gradeIndex(data, id);
    for (var i = 1; i <= top; i++) {
      var b = isObj(g[i].bonus) ? g[i].bonus : {};
      out.resolve += Number(b.resolve) || 0;
      out.cohesion += Number(b.cohesion) || 0;
      out.bv += Number(b.bv) || 0;
    }
    return out;
  };
  /* A base profile with a grade's bonus added (a copy). */
  R.gradedProfile = function (data, profile, gradeId) {
    var p = Object.assign({}, profile);
    var b = R.gradeBonus(data, gradeId);
    p.resolve = (Number(p.resolve) || 0) + b.resolve;
    p.cohesion = (Number(p.cohesion) || 0) + b.cohesion;
    p.bv = (Number(p.bv) || 0) + b.bv;
    return p;
  };

  /* ---------- Names ---------- */
  function roman(n) {
    var map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var out = '';
    n = clampInt(n, 1, 3999);
    map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
    return out;
  }
  R.roman = roman;
  /* "Line Infantry II", or the name the DM gave it. */
  R.regimentName = function (row, data) {
    if (!isObj(row)) return '';
    if (typeof row.label === 'string' && row.label.trim()) return row.label.trim();
    var at = archetypeOf(row, data);
    if (!at) return String(row.name || '');
    return at.a.name + ' ' + roman(row.num || 1);
  };
  /* Its kind, for a line under a renamed regiment: "Line Infantry". */
  R.regimentKindName = function (row, data) {
    var at = archetypeOf(row, data);
    return at ? at.a.name : String(row && row.name || '');
  };

  /* ---------- Recouping ---------- */
  /* How many days a regiment takes to refill from this strength. */
  R.recoupDays = function (data, strength, size) {
    size = Math.max(1, clampInt(size, 1));
    var lostPct = (size - clampInt(strength, 0, size)) * 100 / size;
    var bands = Array.isArray(wr(data).recoup) && wr(data).recoup.length ? wr(data).recoup : FALLBACK.recoup;
    for (var i = 0; i < bands.length; i++) if (lostPct <= Number(bands[i].upToPct) + 1e-9) return clampInt(bands[i].days, 1, 365);
    return clampInt(bands[bands.length - 1].days, 1, 365);
  };
  function freshRecoup(data, strength, size) {
    var days = R.recoupDays(data, strength, size);
    return { days: days, left: days, from: clampInt(strength, 0, size) };
  }
  /* A regiment's strength set after a battle: under strength, it starts
     (or starts again) Recouping from here; at 0 the caller removes it. */
  R.setRegimentStrength = function (row, data, strength) {
    var at = archetypeOf(row, data);
    if (!at) return;
    var size = at.a.size;
    strength = clampInt(strength, 0, size);
    if (strength >= size) { makeFull(row); return; }
    row.strength = strength;
    row.depleted = true;
    row.recoup = freshRecoup(data, strength, size);
  };
  function makeFull(row) {
    delete row.strength;
    delete row.depleted;
    delete row.recoup;
  }
  R.makeRegimentFull = makeFull;
  /* The day it will be full, counting from today (if nothing else happens). */
  R.recoupFullDay = function (s, row) {
    return isObj(row) && isObj(row.recoup) ? Number(s.day) + clampInt(row.recoup.left, 0) : Number(s.day);
  };

  /* ---------- The records, tidied (on every load; twice changes nothing) ----------
     A counted row of a regiment kind becomes that many records, each with
     its own id and number; a record keeps its id, number, name, grade and
     Recouping. Lieutenants and anything not a regiment kind are kept as
     they are. */
  R.cleanRegiments = function (list, data) {
    var max = clampInt(wr(data).nameMax || 40, 1, 200);
    var src = (Array.isArray(list) ? list : []).filter(isObj);
    var usedIds = {}, usedNum = {};
    /* First the numbers already held (the first of each), so a new record never takes one. */
    var keepNum = [];
    src.forEach(function (row, i) {
      var at = archetypeOf(row, data);
      if (!at) return;
      var n = Number(row.num);
      var key = at.type + ':' + n;
      if (n >= 1 && n <= 3999 && Math.floor(n) === n && !usedNum[key]) { usedNum[key] = true; keepNum[i] = n; }
    });
    function nextNum(type) {
      for (var n = 1; ; n++) if (!usedNum[type + ':' + n]) { usedNum[type + ':' + n] = true; return n; }
    }
    function freeId(base) {
      var id = base, n = 2;
      while (usedIds[id]) id = base + '-' + (n++);
      usedIds[id] = true;
      return id;
    }
    var out = [];
    src.forEach(function (row, i) {
      var at = archetypeOf(row, data);
      if (!at) {
        /* Not a regiment kind (a Lieutenant, an unknown name): as before, an
           under-strength mark is dropped and its count kept. */
        if (row.depleted === true || (row.strength !== undefined && row.strength !== null)) out.push({ name: String(row.name || ''), qty: Math.max(1, rowQty(row)), source: String(row.source || '') });
        else out.push(row);
        return;
      }
      var size = at.a.size;
      var count = rowQty(row);
      var strength = row.depleted === true || (row.strength !== undefined && row.strength !== null) ? clampInt(row.strength, 0, size) : size;
      if (!count || strength <= 0) return;
      var name = String(row.name || at.a.name);
      var source = String(row.source || '');
      var label = typeof row.label === 'string' ? row.label.trim().slice(0, max) : '';
      var grade = grades(data)[R.gradeIndex(data, row.grade)].id;
      for (var k = 0; k < count; k++) {
        var hasId = k === 0 && typeof row.id === 'string' && row.id && !usedIds[row.id];
        var id = hasId ? (usedIds[row.id] = true, row.id) : freeId('reg-' + R.hashText(name + '|' + i + '|' + k));
        var num = k === 0 && keepNum[i] ? keepNum[i] : nextNum(at.type);
        var rec = { id: id, name: name, qty: 1, source: source, num: num, label: k === 0 ? label : '', grade: k === 0 ? grade : 'regular' };
        if (strength < size) {
          rec.strength = strength;
          rec.depleted = true;
          var rc = row.recoup;
          var days = isObj(rc) ? clampInt(rc.days, 1, 365) : 0;
          rec.recoup = isObj(rc) && days && clampInt(rc.left, 0, days) >= 1 && clampInt(rc.from, 0, size) <= strength
            ? { days: days, left: clampInt(rc.left, 1, days), from: clampInt(rc.from, 0, size - 1) }
            : freshRecoup(data, strength, size);
        }
        out.push(rec);
      }
    });
    return out;
  };

  /* ---------- Finding regiments ---------- */
  R.regiments = function (s, data) {
    return (Array.isArray(s.military) ? s.military : []).filter(function (row) { return !!archetypeOf(row, data) && typeof row.id === 'string'; });
  };
  R.regimentById = function (s, id) {
    var found = null;
    (Array.isArray(s.military) ? s.military : []).forEach(function (row) { if (!found && isObj(row) && row.id === id) found = row; });
    return found;
  };
  /* The regiments away at a battle (in a Military Action's line-up). */
  R.regimentsAway = function (s) {
    var ids = {};
    (Array.isArray(s.militaryActions) ? s.militaryActions : []).forEach(function (ma) {
      var units = isObj(ma) && isObj(ma.spec) && isObj(ma.spec.player) && Array.isArray(ma.spec.player.units) ? ma.spec.player.units : [];
      units.forEach(function (u) { if (isObj(u) && isObj(u.source) && u.source.rowId) ids[u.source.rowId] = true; });
    });
    return ids;
  };
  /* A new regiment (Recruit, a Muster): its own record, the next number. */
  R.addRegiment = function (s, data, name, source) {
    if (!Array.isArray(s.military)) s.military = [];
    var at = archetypeOf({ name: name }, data);
    if (!at) return null;
    var used = {}, ids = {};
    s.military.forEach(function (row) {
      if (!isObj(row)) return;
      if (typeof row.id === 'string') ids[row.id] = true;
      var t = archetypeOf(row, data);
      if (t && t.type === at.type) used[row.num] = true;
    });
    var num = 1;
    while (used[num]) num++;
    var base = 'reg-' + R.hashText(at.type + '|' + num + '|' + s.day + '|' + s.military.length), id = base, n = 2;
    while (ids[id]) id = base + '-' + (n++);
    var row = { id: id, name: String(name), qty: 1, source: source || 'War Room', num: num, label: '', grade: 'regular' };
    s.military.push(row);
    return row;
  };
  /* The DM's name for a regiment ('' gives back its number). */
  R.renameRegiment = function (s, data, id, text) {
    var row = R.regimentById(s, id);
    if (!row) return { ok: false, message: 'That regiment isn\'t on the Military list any more.' };
    var before = R.regimentName(row, data);
    row.label = String(text || '').replace(/\s+/g, ' ').trim().slice(0, clampInt(wr(data).nameMax || 40, 1, 200));
    var after = R.regimentName(row, data);
    return { ok: true, changed: before !== after, log: ['Military', before === after ? before + ' keeps its name.' : before + ' is now called ' + after + '.'] };
  };

  /* ---------- Drill a Regiment ---------- */
  function drillOrders(s) {
    return (Array.isArray(s.pendingOrders) ? s.pendingOrders : []).filter(function (o) {
      return isObj(o) && o.facId === 'war_room' && o.fnId === 'drill' && isObj(o.chosen);
    });
  }
  R.drillOrders = drillOrders;
  R.drillOrderFor = function (s, id) { return drillOrders(s).filter(function (o) { return o.chosen.regimentId === id; })[0] || null; };
  /* How many can drill at once at the War Room's level. */
  R.drillSlots = function (s, data) {
    var map = isObj(wr(data).drillSlots) ? wr(data).drillSlots : {};
    return clampInt(map[R.getFacilityLevel(s, 'war_room')] || 0, 0, 20);
  };
  /* What a regiment's next drill costs and takes, or null at the top. */
  R.drillPlan = function (s, data, row) {
    var at = archetypeOf(row, data);
    if (!at) return null;
    var next = R.nextGrade(data, row.grade);
    if (!next) return null;
    return { toGrade: next.id, gradeName: next.name, days: clampInt(next.days || 1, 1, 365), costGP: Math.round((Number(next.costPerBV) || 0) * (Number(at.a.bv) || 0)) };
  };
  /* Why this regiment can't drill now ('' if it can). */
  R.drillBlocker = function (s, data, row) {
    if (!isObj(row) || !archetypeOf(row, data)) return 'That regiment isn\'t on the Military list any more.';
    var name = R.regimentName(row, data);
    var o = R.drillOrderFor(s, row.id);
    if (o) return name + ' is already drilling: ready on ' + R.dayLabel(o.dueDay) + '.';
    if (!R.drillPlan(s, data, row)) return name + ' is already ' + R.gradeName(data, row.grade) + ', the highest grade.';
    if (row.depleted === true) return name + ' is Recouping (' + row.strength + ' of ' + archetypeOf(row, data).a.size + '). It can drill once it\'s back to full strength.';
    if (R.regimentsAway(s)[row.id]) return name + ' is away at a battle.';
    return '';
  };
  /* Why the War Room can't start a drill now ('' if it can). */
  R.drillRoomBlocker = function (s, data) {
    var lvl = R.getFacilityLevel(s, 'war_room');
    var need = clampInt(wr(data).drillLevel || 2, 1, R.MAX_LEVEL);
    if (lvl < need) return 'Needs Level ' + need + '.';
    var slots = R.drillSlots(s, data), busy = drillOrders(s).length;
    if (busy >= slots) return 'Every drill place is taken (' + busy + ' of ' + slots + '). ' + (lvl < R.MAX_LEVEL ? 'Upgrading the War Room adds more.' : '');
    return '';
  };
  /* The list Drill a Regiment shows: every regiment that can drill now. */
  R.drillOptions = function (s, data) {
    return R.regiments(s, data).filter(function (row) { return !R.drillBlocker(s, data, row); }).map(function (row) {
      var p = R.drillPlan(s, data, row);
      return { label: R.regimentName(row, data) + ' → ' + p.gradeName + ' (' + R.daysText(p.days) + ')', regimentId: row.id, toGrade: p.toGrade, costGP: p.costGP, days: p.days };
    });
  };
  /* Start a drill: checks everything, pays once, then the order. */
  R.issueDrill = function (s, data, regimentId, rand) {
    var room = R.drillRoomBlocker(s, data);
    if (room) return { ok: false, message: room.trim() };
    var row = R.regimentById(s, regimentId);
    var why = R.drillBlocker(s, data, row);
    if (why) return { ok: false, message: why };
    var p = R.drillPlan(s, data, row);
    if (p.costGP > s.treasuryGP) return { ok: false, message: 'Not enough gp. Need ' + p.costGP + 'gp, you have ' + s.treasuryGP + 'gp.' };
    s.treasuryGP -= p.costGP;
    var name = R.regimentName(row, data);
    var label = 'War Room: Drill a Regiment (' + name + ' → ' + p.gradeName + ')';
    s.pendingOrders.push({ id: R.uid(rand), facId: 'war_room', fnId: 'drill', chosen: { label: name + ' → ' + p.gradeName, regimentId: row.id, toGrade: p.toGrade }, optionLabel: name + ' → ' + p.gradeName, notes: '', label: label, costGP: p.costGP, issuedDay: s.day, dueDay: s.day + p.days });
    return { ok: true, log: ['Order Issued', label + ' (' + R.daysText(p.days) + ': due Day ' + (s.day + p.days) + '; ' + p.costGP + ' gp paid).'] };
  };
  /* A drill completed: the grade, once. */
  R.completeDrill = function (s, data, order) {
    var c = isObj(order.chosen) ? order.chosen : {};
    var row = R.regimentById(s, c.regimentId);
    if (!row) return order.label + ' → The regiment is no longer on the Military list, so the drill ends.';
    var to = R.gradeIndex(data, c.toGrade);
    if (R.gradeIndex(data, row.grade) >= to) return order.label + ' → ' + R.regimentName(row, data) + ' is already ' + R.gradeName(data, row.grade) + '.';
    row.grade = R.gradeOf(data, c.toGrade).id;
    var b = R.gradeBonus(data, row.grade);
    return order.label + ' → ' + R.regimentName(row, data) + ' is now ' + R.gradeName(data, row.grade) + ' (+' + b.resolve + ' Resolve' + (b.cohesion ? ', +' + b.cohesion + ' Cohesion' : '') + ', +' + b.bv + ' Battle Value in all).';
  };

  /* ---------- Musters ---------- */
  R.musterSize = function (fn) { return fn && fn.muster ? clampInt(fn.muster, 1, 10) : 0; };
  /* The formations it raises: the Recruit order's own list. */
  R.musterChoices = function (data) {
    var fac = R.facility(data, 'war_room');
    var rec = R.fn(fac, 'recruit');
    return rec && Array.isArray(rec.options) ? rec.options : [];
  };
  R.completeMuster = function (s, data, order) {
    var units = isObj(order.chosen) && Array.isArray(order.chosen.units) ? order.chosen.units : [];
    var lines = units.map(function (u) { return R.recruitUnit ? R.recruitUnit(s, data, String(u)) : ''; }).filter(Boolean);
    return order.label + ' → ' + (lines.length ? lines.join(' ') : 'Nobody to raise.');
  };

  /* ---------- Each day (the day's trade step, saved with it, so once) ----------
     Recouping regiments refill a day's worth (not while away at a battle);
     a drill whose regiment is Recouping or away waits a day; a drill whose
     regiment has gone ends. */
  R.settleRegiments = function (s, data) {
    var out = { log: [], word: [] };
    var away = R.regimentsAway(s);
    /* Recouping today (before today's refill), so a drill waits every day of it. */
    var recouping = {};
    R.regiments(s, data).forEach(function (row) { if (row.depleted === true) recouping[row.id] = true; });
    R.regiments(s, data).forEach(function (row) {
      if (!isObj(row.recoup) || away[row.id]) return;
      var size = archetypeOf(row, data).a.size;
      var rc = row.recoup;
      rc.left = clampInt(rc.left, 1, rc.days) - 1;
      if (rc.left <= 0) {
        makeFull(row);
        out.log.push(['Military', R.regimentName(row, data) + ' has finished Recouping: back to ' + size + ' soldiers.']);
        out.word.push(R.regimentName(row, data) + ' is back to full strength.');
        return;
      }
      row.strength = Math.min(size - 1, rc.from + Math.floor((size - rc.from) * (rc.days - rc.left) / rc.days));
    });
    var keep = [];
    s.pendingOrders.forEach(function (o) {
      if (!(isObj(o) && o.facId === 'war_room' && o.fnId === 'drill' && isObj(o.chosen))) { keep.push(o); return; }
      var row = R.regimentById(s, o.chosen.regimentId);
      if (!row) {
        out.log.push(['Military', o.label + ': the regiment is no longer on the Military list, so the drill ends (its gold isn\'t given back).']);
        return;
      }
      if (recouping[row.id] || away[row.id]) o.dueDay = Number(o.dueDay) + 1;
      keep.push(o);
    });
    s.pendingOrders = keep;
    return out;
  };

  /* A line for the panels: "Trained · Recouping: 60 of 100, full on Day 12". */
  R.regimentStatus = function (s, data, row) {
    var at = archetypeOf(row, data);
    if (!at) return '';
    var parts = [R.gradeName(data, row.grade)];
    if (row.depleted === true) parts.push('Recouping: ' + row.strength + ' of ' + at.a.size + ', full on ' + R.dayLabel(R.recoupFullDay(s, row)));
    else parts.push(plural(at.a.size, 'soldier', 'soldiers'));
    var o = R.drillOrderFor(s, row.id);
    if (o) parts.push('Drilling to ' + R.gradeName(data, o.chosen.toGrade) + ': ready on ' + R.dayLabel(o.dueDay));
    if (R.regimentsAway(s)[row.id]) parts.push('Away at a battle');
    return parts.join(' · ');
  };
}());
