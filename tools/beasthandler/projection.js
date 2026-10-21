/* Scarlett Isles: Beast Handler — the player's view of the Bastion (BH-1a).

   Plain functions (no screen code), tested on tests/rules.html. They turn
   the Bastion's real save into a small, read-only SNAPSHOT for one handler:
   the creatures they look after, and a plain directory of the others. The
   Bastion stays the only place anything is decided; this file only reads
   it, and never changes the save it is given.

   What a snapshot holds (version 1):
   - the directory: each standing Wyvern Roost, Griffin Tower and Dire Wolf
     Den, its level, and every creature housed there (name, kind, the
     handler's name, and the bond where the creature has one). A creature
     that belongs to someone else is a directory line and nothing more.
   - the detail of the handler's OWN creatures only: profile, bond, current
     training, Chronicle (without the DM's DM-only notes), and the orders
     they may ask for.
   It never holds the treasury, the Day Log, the DM's notes, other
   buildings, or any raw part of the save.

   Orders: the companion only previews what the Bastion would accept (the
   Bastion's own rules, R.trainingBlocker, decide). When a command comes, the
   Bastion checks it again against the live save. The player-facing rule
   (Harry, 21 October 2026): while ANY order is pending at a creature's
   building, the phone offers no new order from that building; it shows
   the pending order and the day it is due. The DM's own training places
   are not touched. A pending order at some other building never blocks. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};
  var P = ns.projection = {};

  P.KIND = 'tsi.beasthandler.snapshot';
  P.VERSION = 1;

  function R() { return TSI.bastion && TSI.bastion.rules; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function txt(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function num(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }

  /* ---------- Who is who ---------- */
  /* The handler's name is the key today ("elara"); compared without regard to capitals or spacing. */
  P.handlerKey = function (id) { return String(id === undefined || id === null ? '' : id).replace(/\s+/g, ' ').trim().toLowerCase(); };
  P.sameHandler = function (a, b) {
    var x = P.handlerKey(a);
    return x !== '' && x === P.handlerKey(b);
  };

  /* ---------- Which orders a player may ask for ---------- */
  function orderRule() {
    var r = window.TSI_DATA && window.TSI_DATA.beastPlayerOrders;
    return isObj(r) ? r : { rule: 'free_training', denyIds: [] };
  }
  /* Free training only (D5): a programme (trains) that costs no gold, and is not taken off the list. */
  P.isPlayerOrder = function (fn) {
    if (!isObj(fn) || fn.trains !== true) return false;
    var rule = orderRule();
    if (rule.rule !== 'free_training') return false;
    if (Number(fn.costGP || 0) !== 0) return false;
    return arr(rule.denyIds).indexOf(fn.id) === -1;
  };

  /* ---------- The three buildings ---------- */
  /* [{ speciesId, speciesName, facId }] in the creatures data's order. */
  P.homes = function (data) {
    var r = R();
    var sp = r.creaturesData(data).species;
    var out = [];
    Object.keys(isObj(sp) ? sp : {}).forEach(function (id) {
      var home = r.speciesHome(data, id);
      if (home && r.facility(data, home)) out.push({ speciesId: id, speciesName: r.speciesName(data, id), facId: home });
    });
    return out;
  };

  /* The pending order that is due first at a building, or null. */
  function pendingAt(s, facId) {
    var list = arr(s.pendingOrders).filter(function (o) { return isObj(o) && o.facId === facId; });
    list.sort(function (a, b) { return num(a.dueDay, 1e9) - num(b.dueDay, 1e9); });
    return list[0] || null;
  }

  /* The creatures standing in a built building: housed there, of its kind. */
  function housedIn(s, data, home) {
    var r = R();
    if (r.builtFacilityIds(s, data).indexOf(home.facId) === -1) return [];
    return r.housedAt(s, home.facId).filter(function (c) { return c.species === home.speciesId; });
  }

  function handlerOf(c) { return isObj(c.development) ? txt(c.development.handlerId, 40) : ''; }

  /* The handlers who have a creature in a standing building: [{ id, name, count }], for the DM's own preview. */
  P.handlers = function (s, data) {
    var r = R();
    var seen = {};
    var out = [];
    P.homes(data).forEach(function (home) {
      housedIn(s, data, home).forEach(function (c) {
        var h = handlerOf(c);
        var k = P.handlerKey(h);
        if (!k) return;
        if (!seen[k]) { seen[k] = { id: h, name: r.handlerName(h), count: 0 }; out.push(seen[k]); }
        seen[k].count++;
      });
    });
    return out;
  };

  /* ---------- One creature's orders ---------- */
  function consequenceOf(s, data, fn) {
    var r = R();
    var parts = [];
    if (typeof fn.bondTarget === 'number') parts.push('When it finishes, Bond ' + fn.bondTarget + ' (' + r.bondName(fn.bondTarget) + ') is ready for the DM to confirm.');
    var cd = r.creaturesData(data);
    var bonus = isObj(cd.development) && isObj(cd.development.trainingBonus) ? cd.development.trainingBonus[fn.id] : null;
    if (isObj(bonus) && bonus.label) parts.push('It adds ' + txt(bonus.label, 40) + ' when the Ironbow is attacked.');
    return parts.join(' ');
  }

  function ordersFor(s, data, c, fac) {
    var r = R();
    var out = { status: 'none', available: [], note: '', busy: null };
    var repair = r.underRepair(s, fac.id);
    if (repair) {
      out.status = 'repair';
      out.note = 'The ' + fac.name + ' is Under Repair until ' + r.dayLabel(repair) + '.';
      return out;
    }
    var busy = pendingAt(s, fac.id);
    if (busy) {
      var mine = r.trainingOrderFor(s, c.id);
      out.status = 'busy';
      out.busy = { label: txt(busy.label, 160), dueDay: num(busy.dueDay, 0), dueLabel: r.dayLabel(num(busy.dueDay, 0)), forThisCreature: !!mine && mine.id === busy.id };
      out.note = 'The ' + fac.name + ' is busy: ' + out.busy.label + ', ready on ' + out.busy.dueLabel + '.';
      return out;
    }
    var level = r.getFacilityLevel(s, fac.id);
    out.available = arr(fac.functions).filter(function (fn) {
      return P.isPlayerOrder(fn) && (num(fn.requiredFacilityLevel, 1)) <= level && r.trainingBlocker(s, data, fac, fn, c) === '';
    }).map(function (fn) {
      var days = r.orderDays(fn);
      return {
        fnId: txt(fn.id, 60),
        label: txt(fn.label, 80),
        days: days,
        daysText: r.daysText(days),
        readyDay: num(s.day, 1) + days,
        readyLabel: r.dayLabel(num(s.day, 1) + days),
        level: num(fn.requiredFacilityLevel, 1),
        costGP: 0,
        costText: 'Free',
        consequence: consequenceOf(s, data, fn)
      };
    });
    if (out.available.length) out.status = 'available';
    else out.note = 'No training orders are available for ' + r.creatureName(data, c) + ' right now.';
    return out;
  }

  /* ---------- One creature ---------- */
  function chronicleOf(d) {
    return arr(d.chronicle).filter(function (e) { return isObj(e) && e.private !== true; }).map(function (e) {
      var r = R();
      return { id: txt(e.id, 40), day: num(e.day, 1), dayLabel: r.dayLabel(num(e.day, 1)), cat: txt(e.cat, 20), text: txt(e.text, 400), by: txt(e.by, 40), link: txt(e.link, 80) };
    });
  }

  function trainingOf(s, data, c, fac) {
    var r = R();
    var o = r.trainingOrderFor(s, c.id);
    if (!o) return null;
    var fn = r.fn(fac, o.fnId);
    var rec = r.creatureRecovery(s, c.id);
    return { label: txt(fn ? fn.label : o.label, 80), dueDay: num(o.dueDay, 0), dueLabel: r.dayLabel(num(o.dueDay, 0)), paused: !!rec };
  }

  function detailOf(s, data, c, home) {
    var r = R();
    var fac = r.facility(data, home.facId);
    var d = r.devView(s, c);
    var t = d.temperament;
    var level = r.getFacilityLevel(s, fac.id);
    return {
      id: c.id,
      name: txt(r.creatureName(data, c), 80),
      species: { id: home.speciesId, name: home.speciesName },
      facility: { id: fac.id, name: fac.name, level: level },
      handler: { name: txt(r.handlerName(d.handlerId), 40) },
      bond: { level: d.bond.level, name: r.bondName(d.bond.level), max: 5 },
      training: trainingOf(s, data, c, fac),
      profile: {
        regional: txt(d.regional, 60),
        dominant: txt(t.dominant, 120),
        attachment: txt(t.attachment, 120),
        trigger: txt(t.trigger, 120)
      },
      chronicle: chronicleOf(d),
      orders: ordersFor(s, data, c, fac),
      artKey: home.speciesId
    };
  }

  /* ---------- The snapshot ---------- */
  /* The snapshot for one handler (handlerId '' or unknown: the directory
     alone, with no detail). Never changes s. */
  P.build = function (s, data, handlerId) {
    var r = R();
    var key = P.handlerKey(handlerId);
    var facilities = [];
    var creatures = {};
    P.homes(data).forEach(function (home) {
      var fac = r.facility(data, home.facId);
      if (r.builtFacilityIds(s, data).indexOf(home.facId) === -1) return;
      var list = housedIn(s, data, home);
      facilities.push({
        id: fac.id,
        name: fac.name,
        level: r.getFacilityLevel(s, fac.id),
        species: { id: home.speciesId, name: home.speciesName },
        creatures: list.map(function (c) {
          var mine = !!key && P.sameHandler(handlerOf(c), key);
          if (mine) creatures[c.id] = detailOf(s, data, c, home);
          var d = isObj(c.development) ? c.development : null;
          return {
            id: c.id,
            name: txt(r.creatureName(data, c), 80),
            species: { id: home.speciesId, name: home.speciesName },
            handlerName: d && d.handlerId ? txt(r.handlerName(d.handlerId), 40) : '',
            bond: d ? { level: d.bond.level, name: r.bondName(d.bond.level) } : null,
            mine: mine
          };
        })
      });
    });
    var anyMine = Object.keys(creatures).length > 0;
    return {
      kind: P.KIND,
      version: P.VERSION,
      asOfDay: num(s.day, 1),
      asOfLabel: r.dayLabel(num(s.day, 1)),
      handler: key ? { name: txt(r.handlerName(handlerId), 40), hasCreatures: anyMine } : null,
      facilities: facilities,
      creatures: creatures
    };
  };

  /* Is this a snapshot this version of the companion can read? '' if so, or why not. */
  P.check = function (snap) {
    if (!isObj(snap) || snap.kind !== P.KIND) return 'That isn\'t a Beast Handler snapshot.';
    if (snap.version !== P.VERSION) return 'That snapshot is from a different version of the Beast Handler.';
    if (!Array.isArray(snap.facilities) || !isObj(snap.creatures)) return 'That snapshot is incomplete.';
    return '';
  };
}());
