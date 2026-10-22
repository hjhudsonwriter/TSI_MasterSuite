/* The Ironbow Bastion Manager: the Strip Back conversion (a save from
   version 3 to version 4). Plain functions, no screen code, tested on
   tests/rules.html (tests/rules/strip-back.test.js). They add to the
   Bastion's rules (tools/bastion/rules.js), as courier-rules.js does, and
   load wherever rules.js does: the Bastion, the Explorer (which only checks
   a campaign file on Import) and the Beast Handler on the laptop (which
   reads the save), and the rules test page.

   Why one conversion for the whole overhaul (Harry, 22 October 2026;
   docs/STRIP-BACK-PLAN.md and docs/strip-back/J-cross-cutting.md): every part
   of it changes the Bastion's save, so there is ONE new version, 4, and ONE
   function, R.migrateToV4, that every part adds a small step to, in the same
   commit as the change that needs it. Version 2 (days) and 3 (facilities,
   R.migrateToV3 in rules.js) stay as they are; a version 2 save goes through
   both, in one go.

   What it guarantees (R.stripBackAudit checks it, in every test and again at
   run time, before anything is written):
   - the treasury is never lower, and every pound handed back is itemised;
   - goods that an order held go back to the Warehouse, quantity for quantity;
   - a god's Favour is never lower (a refund stops at 100%, and what could not
     be returned is said);
   - every pending order is kept, moved or cancelled (listed with its reason);
   - creatures: the same animals, the same development, only a home may change;
   - the records that must never change (the Explorer link's receipts, the DM
     doc's edits, Diplomatic Records, scores, Great Rites, research, "the
     Ironbow sends word", ships at sea, Port Charters, parcels) come back the
     same;
   - converting again changes nothing (it is idempotent).
   If the audit finds a problem at run time the Bastion changes nothing and says so
   (tools/bastion/tool.js).

   The conversion is PURE: no storage, no clock, no dice, and it never touches
   the object it is given. It runs on the raw save, before R.fromSave tidies
   it (which drops every field it doesn't know), so it can still see what is
   about to go.

   HOW A LATER STEP ADDS ITS PART: add one entry to R.stripBackSteps, ABOVE
   sweepFacilities (which is the catch-all for anything left over) and below
   nothing else but finish. An entry is { id, detect, run }:
     detect(s, data) → a list of short words naming what it still finds in a
       save (an empty list when there is none). It is how a version 4 save that
       an older copy of the suite has overwritten is found and cleaned again.
     run(s, data, report) → changes s (a copy), and says what it did through
       the helpers below: R.stripBackCancel (cancel an order and give back
       everything it cost), R.stripBackMoveOrder, R.stripBackPayGold,
       R.stripBackSay (a line for the report, under a heading).
   Each step must be idempotent (run on a clean save it does nothing) and must
   have tests in tests/rules/strip-back.test.js (the audit runs on every
   fixture there). The Bastion keeps a copy of the save as it was before it
   writes the converted one (TSI.store.keepCopy). */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.bastion = TSI.bastion || {};
  var R = ns.rules;
  if (!R) return;
  var clampInt = R.clampInt;
  var dayNum = R.dayNum;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : null; }
  function str(v) { return typeof v === 'string' ? v : ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  /* ["a", "b", "c"] → "a, b and c". */
  function listText(items) {
    return items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }
  /* 1350 → "1,350" (the same in every browser and in Node). */
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* Text with its object keys in order, so two records can be compared. */
  function canon(v) {
    if (v === undefined) return 'undefined';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  }
  R.stripBackCanon = canon;
  /* The treasury as the Bastion reads it when it loads (never below 0). */
  function gold(s) { return clampInt(isObj(s) ? s.treasuryGP : 0, 0); }
  function idOf(o) { return isObj(o) && (typeof o.id === 'string' || typeof o.id === 'number') && String(o.id) !== '' ? String(o.id) : ''; }

  var GODS = ['telluria', 'aurush', 'pelagos'];
  var GOD_NAMES = { telluria: 'Telluria', aurush: 'Aurush', pelagos: 'Pelagos' };

  /* Orders that are not at a facility of the catalogue but are still real
     (the old War Council's War Actions, the Trade Network's investments).
     The step that removes each one deals with its orders and then takes its
     name off this list; until then the catch-all leaves them alone. */
  R.STRIP_BACK_PSEUDO_FACILITIES = ['war_council', 'trade_network'];

  /* The War Table's three saves (tsi.bastion.<name>). Once the War Table is
     gone nothing reads them: the Bastion sets them aside every time it opens
     (a Restore of an old backup can bring them back). */
  R.STRIP_BACK_ORPHAN_KEYS = ['warMap', 'warTable', 'warTerrain'];
  /* Which of those are in the browser now: has(name) says so. */
  R.stripBackOrphans = function (has) { return R.STRIP_BACK_ORPHAN_KEYS.filter(function (name) { return has(name); }); };

  /* ---------- Names, in plain English ---------- */
  function sbData(data) {
    var b = data && data.bastion;
    return b && isObj(b.stripBack) ? b.stripBack : {};
  }
  function words(id) {
    var text = String(id === undefined || id === null ? '' : id).replace(/[_-]+/g, ' ').trim();
    return text ? text.split(' ').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ') : '';
  }
  /* A facility's name even after its definition has gone from the catalogue:
     the catalogue's own, then the Strip Back table's (bastion-data.js), the
     older retired facilities', then its id in words. Never the bare id. */
  R.stripBackName = function (data, id) {
    var f = data && R.facility(data, id);
    if (f && f.name) return f.name;
    var t = sbData(data);
    if (isObj(t.facilities) && typeof t.facilities[id] === 'string') return t.facilities[id];
    if (isObj(t.names) && typeof t.names[id] === 'string') return t.names[id];
    var old = data && data.bastion && isObj(data.bastion.retiredFacilities) ? data.bastion.retiredFacilities[id] : null;
    if (isObj(old) && typeof old.name === 'string') return old.name;
    return words(id) || 'A facility';
  };

  /* ---------- The report ----------
     What the conversion did, as numbers and as words. lines (plain English,
     one paragraph for each heading that has something to say) is filled in by
     the last step. */
  R.STRIP_BACK_HEADINGS = [
    { id: 'v3', title: 'Facilities (the change of 13 October 2026)' },
    { id: 'gold', title: 'Gold' },
    { id: 'trade', title: 'Trade' },
    { id: 'favour', title: 'Favour' },
    { id: 'goods', title: 'Goods' },
    { id: 'orders', title: 'Orders' },
    { id: 'gone', title: 'Places that are gone' },
    { id: 'joined', title: 'Places that joined others' },
    { id: 'war', title: 'The army and the war' },
    { id: 'party', title: 'Your Party' },
    { id: 'beasts', title: 'Beasts' },
    { id: 'also', title: 'Also' }
  ];
  function newReport(s, again, v3Lines) {
    var g = gold(s);
    return {
      day: Math.max(1, dayNum(s.day, 1)),
      again: !!again,
      lines: [],
      /* The earlier change's lines (13 October 2026), when a version 2 save went through both. */
      v3Lines: (v3Lines || []).slice(),
      gold: { was: g, now: g, refunded: 0, settlement: 0, items: [] },
      favour: { telluria: 0, aurush: 0, pelagos: 0, lost: { telluria: 0, aurush: 0, pelagos: 0 } },
      goods: [],
      cancelled: [],
      moved: [],
      removed: {},
      notes: [],
      /* said: heading id → sentences, from R.stripBackSay. archived: facilities to record in archivedFacilities. */
      said: {},
      archived: []
    };
  }
  R.stripBackNewReport = function (s, data) { return newReport(isObj(s) ? s : {}, false, []); };
  /* A sentence for the report, under one of the headings (R.STRIP_BACK_HEADINGS). */
  R.stripBackSay = function (report, heading, text) {
    var known = R.STRIP_BACK_HEADINGS.some(function (h) { return h.id === heading; });
    var id = known ? heading : 'also';
    if (id === 'also') report.notes.push(String(text));
    else (report.said[id] = report.said[id] || []).push(String(text));
  };

  /* ---------- Helpers every step uses ---------- */
  /* Gold into the treasury, itemised. kind: 'refund' (an order cancelled) or
     'settlement' (money owed, paid once). Returns what was added. */
  R.stripBackPayGold = function (s, report, amount, label, kind) {
    var n = clampInt(amount, 0);
    if (n <= 0) return 0;
    s.treasuryGP = gold(s) + n;
    if (kind === 'settlement') report.gold.settlement += n; else report.gold.refunded += n;
    report.gold.items.push({ label: String(label || 'An order'), gp: n, kind: kind === 'settlement' ? 'settlement' : 'refund' });
    report.gold.now = s.treasuryGP;
    return n;
  };
  /* Favour back on a god's bar, never past 100%: what could not go back is kept
     in report.favour.lost, so it is said. */
  function addFavour(s, report, god, amount) {
    if (GODS.indexOf(god) === -1 || amount <= 0) return;
    if (!isObj(s.favour)) s.favour = { telluria: 0, aurush: 0, pelagos: 0 };
    var have = clampInt(s.favour[god], 0, 100);
    var give = Math.min(amount, 100 - have);
    s.favour[god] = have + give;
    report.favour[god] += give;
    report.favour.lost[god] += amount - give;
  }
  /* Goods held by an order back into the Warehouse (R.returnGoods), each good
     in its own row. A row made here has a fixed id (never random), so the
     conversion is the same every time. */
  function giveBackGoods(s, data, report, list) {
    if (!arr(s.warehouse)) s.warehouse = [];
    list.forEach(function (x) {
      var has = s.warehouse.some(function (w) { return isObj(w) && w.goodId === x.goodId; });
      if (!has) s.warehouse.push({ id: 'returned-' + x.goodId, goodId: x.goodId, item: R.goodName(data, x.goodId), qty: 0, gp: '', notes: '' });
    });
    R.returnGoods(s, data, list);
    list.forEach(function (x) {
      var row = report.goods.filter(function (g) { return g.goodId === x.goodId; })[0];
      if (row) row.qty += x.qty; else report.goods.push({ goodId: x.goodId, name: x.name || R.goodName(data, x.goodId), qty: x.qty });
    });
  }
  /* The goods an order holds that can be read: { goodId, name, qty }. */
  function heldGoods(order, data) {
    return (arr(order.inputs) || []).filter(function (x) { return isObj(x) && typeof x.goodId === 'string' && x.goodId && clampInt(x.qty, 0) > 0; })
      .map(function (x) { return { goodId: x.goodId, name: str(x.name) || R.goodName(data, x.goodId), qty: clampInt(x.qty, 1) }; });
  }
  /* THE shared "cancel an order and give everything back" (J 4.3): the order
     is removed; its gold (costGP) goes back to the treasury; its Favour
     (favourCost, from the god's bar: opts.god, or the Shrine's own) goes back
     up to 100%; the goods it held (inputs) go back to the Warehouse; and it is
     listed by its saved label with the reason. (R.cancelOrder is the DM's own
     Cancel, which keeps the gold: that rule stays.) Returns false if the
     order is not in the save. */
  R.stripBackCancel = function (s, data, report, order, why, opts) {
    opts = opts || {};
    var list = arr(s.pendingOrders);
    var at = list ? list.indexOf(order) : -1;
    if (at === -1) return false;
    list.splice(at, 1);
    var label = str(order.label).trim() || 'An order';
    var rec = { id: idOf(order), label: label, why: String(why || 'it can no longer be carried out'), facId: str(order.facId), gp: 0, favour: 0, god: '', goods: [] };
    rec.gp = R.stripBackPayGold(s, report, order.costGP, label, 'refund');
    var fav = clampInt(order.favourCost, 0, 100);
    if (fav > 0) {
      var god = GODS.indexOf(opts.god) !== -1 ? opts.god : R.shrineGod(order.facId);
      if (god) {
        rec.favour = fav;
        rec.god = god;
        addFavour(s, report, god, fav);
      } else {
        R.stripBackSay(report, 'also', label + ' had used ' + fav + '% of a god\'s Favour. It could not be told which god, so that Favour could not be given back.');
      }
    }
    var held = arr(order.inputs) || [];
    var good = heldGoods(order, data);
    if (held.length > good.length) R.stripBackSay(report, 'also', label + ' held some goods that could not be read, so they could not be put back in the Warehouse.');
    if (good.length) {
      giveBackGoods(s, data, report, good);
      rec.goods = good;
    }
    report.cancelled.push(rec);
    return true;
  };
  /* An order that carries on somewhere else: patch is what changes (its place:
     facId, fnId, label...); it keeps its id, due day, cost and everything it
     holds. Listed as moved, with where it went (to: words). */
  R.stripBackMoveOrder = function (report, order, patch, to) {
    var label = str(order.label).trim() || 'An order';
    Object.keys(patch || {}).forEach(function (k) { order[k] = patch[k]; });
    report.moved.push({ id: idOf(order), label: label, to: String(to || '') });
  };

  /* ---------- The steps ---------- */
  function slotId(x) { return typeof x === 'string' ? x : (isObj(x) && typeof x.facId === 'string' ? x.facId : ''); }
  function isGhostOrder(o, data) {
    return isObj(o) && typeof o.facId === 'string' && !R.facility(data, o.facId) && R.STRIP_BACK_PSEUDO_FACILITIES.indexOf(o.facId) === -1;
  }
  /* The catch-all: any facility the catalogue does not know (an id from an
     older or newer copy of the suite, or one a later step has taken out of
     the catalogue) is freed everywhere it appears, and its pending orders are
     cancelled WITH everything they cost given back. */
  function detectGhosts(s, data) {
    var out = [];
    ['builtExtras', 'builtPlots'].forEach(function (key) {
      (arr(s[key]) || []).forEach(function (x) {
        var id = slotId(x);
        if (id && !R.facility(data, id)) out.push('a place: ' + id);
      });
    });
    ['facilityLevels', 'repairs'].forEach(function (key) {
      if (!isObj(s[key])) return;
      Object.keys(s[key]).forEach(function (id) { if (!R.facility(data, id)) out.push('a ' + (key === 'repairs' ? 'repair' : 'level') + ': ' + id); });
    });
    (arr(s.pendingOrders) || []).forEach(function (o) { if (isGhostOrder(o, data)) out.push('an order: ' + o.facId); });
    return out;
  }
  function sweepFacilities(s, data, report) {
    var day = report.day;
    var stood = [];
    var seen = {};
    [['builtExtras', false], ['builtPlots', true]].forEach(function (pair) {
      var list = arr(s[pair[0]]);
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        var id = slotId(list[i]);
        if (!id || R.facility(data, id)) continue;
        var building = isObj(list[i]) && list[i].status === 'building';
        var name = R.stripBackName(data, id);
        var entry = { facId: id, name: name, status: building ? 'building' : 'built', slot: i, day: day };
        if (pair[1]) entry.plot = true;
        report.archived.push(entry);
        list[i] = '';
        if (!seen[id]) {
          seen[id] = true;
          stood.push({ id: id, name: name, building: building, plot: pair[1] });
        }
      }
    });
    stood.forEach(function (x) {
      var place = x.plot ? 'its Development Plot is free' : 'its slot is free';
      R.stripBackSay(report, 'gone', x.building
        ? 'Building work on the ' + x.name + ' stopped, as it is no longer part of the Bastion; ' + place + '.'
        : 'The ' + x.name + ' is no longer part of the Bastion; ' + place + '.');
    });
    ['facilityLevels', 'repairs'].forEach(function (key) {
      if (!isObj(s[key])) return;
      Object.keys(s[key]).forEach(function (id) {
        if (R.facility(data, id)) return;
        delete s[key][id];
        (report.removed[key] = report.removed[key] || []).push(id);
      });
    });
    (arr(s.pendingOrders) || []).slice().forEach(function (o) {
      if (isGhostOrder(o, data)) R.stripBackCancel(s, data, report, o, 'the ' + R.stripBackName(data, o.facId) + ' is no longer part of the Bastion');
    });
  }

  /* The words, one paragraph for each heading that has something to say. */
  function paragraphs(s, data, report) {
    var said = {};
    R.STRIP_BACK_HEADINGS.forEach(function (h) { said[h.id] = (report.said[h.id] || []).slice(); });
    said.also = report.notes.slice();
    if (report.v3Lines.length) said.v3.unshift(report.v3Lines.join(' '));
    var total = report.gold.refunded + report.gold.settlement;
    if (total > 0) {
      said.gold.unshift(fmt(total) + ' gp went back into the treasury (it was ' + fmt(report.gold.was) + ' gp, it is now ' + fmt(gold(s)) + ' gp): ' +
        report.gold.items.map(function (i) { return i.label + ', ' + fmt(i.gp) + ' gp' + (i.kind === 'settlement' ? ' (paid out in full)' : ''); }).join('; ') + '.');
    }
    GODS.forEach(function (g) {
      var back = report.favour[g], lost = report.favour.lost[g];
      if (back > 0) said.favour.push(GOD_NAMES[g] + ': ' + back + '% went back to the bar, which is now at ' + clampInt(s.favour && s.favour[g], 0, 100) + '%.');
      if (lost > 0) said.favour.push(GOD_NAMES[g] + '\'s bar was too full to take back ' + lost + '% of what its orders had used.');
    });
    if (report.goods.length) said.goods.push(listText(report.goods.map(function (g) { return R.goodsAmountText(data, g.goodId, g.qty); })) + ' went back to the Warehouse.');
    if (report.cancelled.length) {
      said.orders.push((report.cancelled.length === 1 ? 'One order was cancelled: ' : report.cancelled.length + ' orders were cancelled: ') +
        report.cancelled.map(function (c) { return c.label + ' (' + c.why + ')'; }).join('; ') + '.');
    }
    if (report.moved.length) {
      said.orders.push((report.moved.length === 1 ? 'One order moved with its place, keeping its due day: ' : report.moved.length + ' orders moved with their places, keeping their due days: ') +
        report.moved.map(function (m) { return m.label + (m.to ? ' (now at ' + m.to + ')' : ''); }).join('; ') + '.');
    }
    return R.STRIP_BACK_HEADINGS.filter(function (h) { return said[h.id].length; }).map(function (h) { return h.title + '. ' + said[h.id].join(' '); });
  }
  /* One short sentence for the DM doc and the Management panel. */
  function summaryOf(report) {
    var bits = [];
    var total = report.gold.refunded + report.gold.settlement;
    if (total > 0) bits.push(fmt(total) + ' gp went back into the treasury');
    if (report.cancelled.length) bits.push(plural(report.cancelled.length, 'order was', 'orders were') + ' cancelled');
    if (report.moved.length) bits.push(plural(report.moved.length, 'order', 'orders') + ' moved');
    if (report.goods.length) bits.push('goods went back to the Warehouse');
    if (report.archived.length) bits.push(plural(report.archived.length, 'place', 'places') + ' removed');
    return bits.length ? bits.join('; ') + '.' : 'Nothing of yours changed.';
  }
  /* The last step: the version, the report kept in the save, the archive. */
  function finish(s, data, report) {
    if (report.archived.length) s.archivedFacilities = (arr(s.archivedFacilities) || []).filter(function (x) { return isObj(x); }).concat(report.archived);
    report.gold.now = gold(s);
    report.lines = paragraphs(s, data, report);
    s.v = R.STATE_VERSION;
    s.migration = Object.assign({}, isObj(s.migration) ? s.migration : {}, {
      v4: { day: report.day, lines: report.lines.slice(), summary: summaryOf(report), changed: report.lines.length > 0, again: report.again, shown: false }
    });
  }

  /* The Beast Handler's old request record (step S13, 22 October 2026). The app no longer sends requests, so the Bastion
     has nothing to answer: s.beast.done (a receipt for each request), .accept (the "take requests" switch) and .floor
     (the time of the newest receipt forgotten) are dropped. Nothing else of s.beast moves (the campaign id and the
     handlers' pairing codes stay). It says nothing in the report: it is bookkeeping no one reads. A version 4 save only
     counts as "needs converting" for this if a receipt, a raised floor or a switched-off switch is still in it; the
     empty shape older builds wrote is dropped quietly when the save loads (R.cleanBeast). */
  function detectBeastRequests(s) {
    var b = isObj(s.beast) ? s.beast : null;
    var out = [];
    if (!b) return out;
    if (isObj(b.done) && Object.keys(b.done).length) out.push('Beast Handler requests');
    else if (typeof b.floor === 'number' && b.floor > 0) out.push('a Beast Handler request limit');
    else if (b.accept === false) out.push('a Beast Handler request switch');
    return out;
  }
  function dropBeastRequests(s) {
    if (!isObj(s.beast)) return;
    delete s.beast.done;
    delete s.beast.accept;
    delete s.beast.floor;
  }

  /* The registry, in the order they run. Add a step ABOVE sweepFacilities. */
  R.stripBackSteps = [
    { id: 'dropBeastRequests', detect: detectBeastRequests, run: dropBeastRequests },
    { id: 'sweepFacilities', detect: detectGhosts, run: sweepFacilities },
    { id: 'finish', detect: null, run: finish }
  ];

  /* ---------- Does a save need converting? ---------- */
  /* What the steps still find in a save: [{ step, what }]. */
  R.stripBackLeftovers = function (s, data) {
    var out = [];
    if (!isObj(s)) return out;
    R.stripBackSteps.forEach(function (st) {
      if (typeof st.detect !== 'function') return;
      (arr(st.detect(s, data)) || []).forEach(function (what) { out.push({ step: st.id, what: String(what) }); });
    });
    return out;
  };
  /* Older than version 4, or version 4 with something the Bastion no longer
     has in it (an older copy of the suite saved over it). */
  R.needsStripBack = function (s, data) {
    if (!isObj(s)) return false;
    var v = typeof s.v === 'number' ? s.v : 0;
    return v < R.STATE_VERSION || R.stripBackLeftovers(s, data).length > 0;
  };

  /* ---------- The conversion ---------- */
  /* → { save, report, before }. save: the converted save (a copy; the one
     given is untouched). report: what it did. before: what the new steps
     started from (the given save, or what version 2 became after the earlier
     step), so R.stripBackAudit has something to compare with. A save that
     needs nothing comes back as it is, with an empty report. */
  R.migrateToV4 = function (raw, data) {
    if (!isObj(raw)) return { save: raw, report: newReport({}, false, []), before: raw };
    var s = TSI.clone(raw);
    var again = typeof s.v === 'number' && s.v >= R.STATE_VERSION;
    var v3Lines = [];
    if (s.v === 2) {
      var earlier = R.migrateToV3(s, data);
      s = earlier.save;
      v3Lines = earlier.lines;
    }
    if (!R.needsStripBack(s, data)) return { save: s, report: newReport(s, false, []), before: TSI.clone(s) };
    var before = TSI.clone(s);
    var report = newReport(s, again, v3Lines);
    R.stripBackSteps.forEach(function (st) { st.run(s, data, report); });
    return { save: s, report: report, before: before };
  };

  /* ---------- The audit ---------- */
  function defaultData() {
    var D = window.TSI_DATA || {};
    return { bastion: D.bastion, facilities: D.bastionFacilities, tools: D.bastionTools, events: D.bastionEvents, research: D.bastionResearch, goods: D.bastionGoods, commerce: D.bastionCommerce, courier: D.bastionCourier, creatures: D.bastionCreatures, warRoom: D.bastionWarRoom };
  }
  function goodsTotals(s) {
    var t = {};
    (arr(s.warehouse) || []).forEach(function (w) {
      if (isObj(w) && typeof w.goodId === 'string' && w.goodId) t[w.goodId] = (t[w.goodId] || 0) + clampInt(w.qty, 0);
    });
    return t;
  }
  function typedRows(s) {
    return (arr(s.warehouse) || []).filter(function (w) { return !(isObj(w) && typeof w.goodId === 'string' && w.goodId); });
  }
  function okWhole(n) { return typeof n === 'number' && isFinite(n) && n >= 0 && Math.floor(n) === n; }
  /* The seven guarantees (J 4.5). Returns a list of problems in plain English;
     empty when the conversion is safe. before and after are saves (R.migrateToV4's
     before and save), report its report; data defaults to the page's own. */
  R.stripBackAudit = function (before, after, report, data) {
    var problems = [];
    function bad(text) { problems.push(text); }
    if (!isObj(before) || !isObj(after) || !isObj(report) || !isObj(report.gold)) return ['The converted Bastion could not be compared with the one it started from.'];
    data = data || defaultData();
    if (after.v !== R.STATE_VERSION) bad('The converted Bastion is not marked as version ' + R.STATE_VERSION + '.');
    var cancelled = arr(report.cancelled) || [];
    var moved = arr(report.moved) || [];
    var beforeOrders = arr(before.pendingOrders) || [];
    var afterOrders = arr(after.pendingOrders) || [];
    var byId = {};
    beforeOrders.forEach(function (o) { var id = idOf(o); if (id && !byId[id]) byId[id] = o; });

    /* I1: gold. Never lower; every pound itemised; what the cancelled orders cost. */
    var refunded = report.gold.refunded;
    var settlement = report.gold.settlement;
    if (!okWhole(refunded) || !okWhole(settlement)) {
      bad('The gold handed back is not a whole number of gp.');
    } else {
      var gB = gold(before), gA = gold(after);
      if (gA < gB) bad('The treasury would go down, from ' + gB + ' gp to ' + gA + ' gp.');
      if (gA !== gB + refunded + settlement) bad('The treasury changes by ' + (gA - gB) + ' gp, but the report says ' + (refunded + settlement) + ' gp.');
      var sumRefund = 0, sumSettle = 0;
      (arr(report.gold.items) || []).forEach(function (it) {
        if (!isObj(it) || !okWhole(it.gp) || !str(it.label)) { bad('A line of the gold report is damaged.'); return; }
        if (it.kind === 'settlement') sumSettle += it.gp; else sumRefund += it.gp;
      });
      if (sumRefund !== refunded || sumSettle !== settlement) bad('Not every pound is itemised: the lines add up to ' + (sumRefund + sumSettle) + ' gp, the report says ' + (refunded + settlement) + ' gp.');
      var fromOrders = cancelled.reduce(function (n, c) { return n + (isObj(c) && okWhole(c.gp) ? c.gp : 0); }, 0);
      if (fromOrders !== refunded) bad('The gold handed back (' + refunded + ' gp) is not what the cancelled orders cost (' + fromOrders + ' gp).');
    }

    /* I4: every pending order is kept, moved or cancelled, once. */
    var counts = {};
    function key(o) { return isObj(o) ? (idOf(o) || '(no id)') : '(not an order)'; }
    beforeOrders.forEach(function (o) { var k = key(o); counts[k] = (counts[k] || 0) + 1; });
    cancelled.forEach(function (c) {
      if (!isObj(c) || !str(c.why) || !str(c.label)) { bad('A cancelled order is listed without its name or its reason.'); return; }
      var k = c.id || '(no id)';
      if (!counts[k]) { bad('"' + c.label + '" is listed as cancelled, but the Bastion had no such order.'); return; }
      counts[k] -= 1;
      var was = byId[c.id];
      if (was) {
        if (clampInt(was.costGP, 0) !== c.gp) bad('"' + c.label + '" cost ' + clampInt(was.costGP, 0) + ' gp, but ' + c.gp + ' gp is handed back for it.');
        if (c.god && c.favour !== clampInt(was.favourCost, 0, 100)) bad('"' + c.label + '" used ' + clampInt(was.favourCost, 0, 100) + '% of a god\'s Favour, but ' + c.favour + '% is handed back.');
        var held = heldGoods(was, data).map(function (g) { return g.goodId + ':' + g.qty; }).sort().join(',');
        var back = (arr(c.goods) || []).map(function (g) { return g.goodId + ':' + g.qty; }).sort().join(',');
        if (held !== back) bad('"' + c.label + '" held goods that are not all put back in the Warehouse.');
      }
    });
    var afterCounts = {};
    afterOrders.forEach(function (o) { var k = key(o); afterCounts[k] = (afterCounts[k] || 0) + 1; });
    Object.keys(counts).concat(Object.keys(afterCounts)).forEach(function (k, i, all) {
      if (all.indexOf(k) !== i) return;
      if ((counts[k] || 0) !== (afterCounts[k] || 0)) bad('An order ("' + k + '") is not accounted for: it was neither kept, moved nor listed as cancelled.');
    });
    moved.forEach(function (m) {
      if (!isObj(m) || !m.id || !afterCounts[m.id]) bad('An order listed as moved is not in the converted Bastion.');
    });

    /* I2: the Warehouse is what it was, plus the goods the cancelled orders held. */
    var returned = {};
    (arr(report.goods) || []).forEach(function (g) {
      if (!isObj(g) || typeof g.goodId !== 'string' || !okWhole(g.qty)) { bad('A line of the goods report is damaged.'); return; }
      returned[g.goodId] = (returned[g.goodId] || 0) + g.qty;
    });
    var heldBack = {};
    cancelled.forEach(function (c) { (isObj(c) && arr(c.goods) || []).forEach(function (g) { heldBack[g.goodId] = (heldBack[g.goodId] || 0) + g.qty; }); });
    var gb = goodsTotals(before), ga = goodsTotals(after);
    Object.keys(gb).concat(Object.keys(ga), Object.keys(returned), Object.keys(heldBack)).forEach(function (id, i, all) {
      if (all.indexOf(id) !== i) return;
      if ((returned[id] || 0) !== (heldBack[id] || 0)) bad('The goods put back (' + id.replace(/_/g, ' ') + ') are not what the cancelled orders held.');
      if ((ga[id] || 0) !== (gb[id] || 0) + (returned[id] || 0)) bad('The Warehouse\'s ' + id.replace(/_/g, ' ') + ' would be ' + (ga[id] || 0) + ', not ' + ((gb[id] || 0) + (returned[id] || 0)) + '.');
    });
    if (canon(typedRows(before)) !== canon(typedRows(after))) bad('Something written by hand in the Warehouse would change.');

    /* I3: Favour is never lower, and never past 100%. */
    var fav = isObj(report.favour) ? report.favour : {};
    var lost = isObj(fav.lost) ? fav.lost : {};
    GODS.forEach(function (g) {
      var fB = clampInt(isObj(before.favour) ? before.favour[g] : 0, 0, 100);
      var fA = clampInt(isObj(after.favour) ? after.favour[g] : 0, 0, 100);
      var back = clampInt(fav[g], 0), over = clampInt(lost[g], 0);
      var used = cancelled.reduce(function (n, c) { return n + (isObj(c) && c.god === g ? clampInt(c.favour, 0, 100) : 0); }, 0);
      if (fA < fB) bad(GOD_NAMES[g] + '\'s Favour would go down, from ' + fB + '% to ' + fA + '%.');
      if (fA !== fB + back) bad(GOD_NAMES[g] + '\'s Favour changes by ' + (fA - fB) + '%, but the report says ' + back + '%.');
      var rawA = isObj(after.favour) ? Number(after.favour[g]) : 0;
      if (rawA > 100 && rawA !== Number(isObj(before.favour) ? before.favour[g] : 0)) bad(GOD_NAMES[g] + '\'s Favour would pass 100%.');
      if (back + over !== used) bad(GOD_NAMES[g] + '\'s Favour given back (' + (back + over) + '%) is not what the cancelled orders used (' + used + '%).');
      if (over > 0 && fA !== 100) bad(GOD_NAMES[g] + '\'s Favour was held back although its bar is not full.');
    });

    /* I5: creatures: the same animals, only a home may change. */
    var cB = before.creatures, cA = after.creatures;
    function noHome(c) { if (!isObj(c)) return c; var o = Object.assign({}, c); delete o.home; return o; }
    if (arr(cB) && arr(cA)) {
      if (cB.length !== cA.length) bad('The number of creatures would change.');
      else cB.forEach(function (c, i) { if (canon(noHome(c)) !== canon(noHome(cA[i]))) bad('A creature would change (more than its home).'); });
    } else if (canon(cB) !== canon(cA)) {
      bad('The creatures would change.');
    }

    /* I6: the records that must come back exactly the same. */
    ['bridge', 'dmEdits', 'diplomaticRecords', 'politicalCapital', 'honourRespectByClan', 'greatRites', 'research', 'word'].forEach(function (k) {
      if (canon(before[k]) !== canon(after[k])) bad('Its ' + k + ' record would change.');
    });
    var tB = isObj(before.tradeNetwork) ? before.tradeNetwork : {};
    var tA = isObj(after.tradeNetwork) ? after.tradeNetwork : {};
    ['portCharters', 'voyages', 'schedules', 'cargoSales', 'marketLedger', 'parcels'].forEach(function (k) {
      if (canon(tB[k]) !== canon(tA[k])) bad('Its trade ' + k + ' would change.');
    });
    if (canon(isObj(tB.protections) ? tB.protections.pelagos_blessing : undefined) !== canon(isObj(tA.protections) ? tA.protections.pelagos_blessing : undefined)) bad('Its Pelagos blessing would change.');

    /* I7: converting the converted Bastion changes nothing. A clean save is
       not converted at all, so also run every step (but the last, which writes
       the report) on a copy: each must do nothing to a save it has already
       cleaned. */
    if (R.needsStripBack(after, data)) {
      bad('The converted Bastion would be converted again.');
    } else {
      if (canon(R.migrateToV4(after, data).save) !== canon(after)) bad('Converting the converted Bastion again would change it.');
      var probe = TSI.clone(after);
      var spare = newReport(probe, true, []);
      R.stripBackSteps.forEach(function (st) { if (st.id !== 'finish') st.run(probe, data, spare); });
      if (canon(probe) !== canon(after)) bad('Running the conversion\'s steps again would change the converted Bastion.');
    }
    return problems;
  };

  /* ---------- The words Harry reads ---------- */
  R.STRIP_BACK_NOTE = 'A copy of your Bastion exactly as it was is kept in "Back up everything" on the home screen. Don\'t open an older copy of the suite on this laptop afterwards: it would not understand this Bastion.';
  R.stripBackHeadline = function (m) {
    if (!isObj(m)) return '';
    if (m.again) return 'The Bastion has been tidied again.';
    return m.changed === false || !arr(m.lines) || !m.lines.length ? 'The Bastion has been updated; nothing of yours changed.' : 'The Bastion has changed. Here is exactly what happened to yours.';
  };
  /* The report as one text file (Save this as a text file). */
  R.stripBackText = function (m) {
    if (!isObj(m)) return '';
    var out = [R.stripBackHeadline(m)];
    if (m.again) out.push('', 'An older copy of the suite had saved over your Bastion, so it was converted again. Nothing was lost.');
    out.push('', 'Converted on Day ' + Math.max(1, dayNum(m.day, 1)) + ' of the campaign.');
    if (arr(m.lines) && m.lines.length) out.push('');
    (arr(m.lines) || []).forEach(function (line) { out.push(String(line), ''); });
    if (!(arr(m.lines) && m.lines.length)) out.push('');
    out.push(R.STRIP_BACK_NOTE);
    return out.join('\n') + '\n';
  };
}());
