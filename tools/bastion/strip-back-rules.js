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
    { id: 'events', title: 'Bastion events' },
    { id: 'also', title: 'Also' }
  ];
  /* Each god's bar as the Bastion would load it (0 to 100). */
  function favourBars(s) {
    var f = isObj(s) && isObj(s.favour) ? s.favour : {};
    return { telluria: clampInt(f.telluria, 0, 100), aurush: clampInt(f.aurush, 0, 100), pelagos: clampInt(f.pelagos, 0, 100) };
  }
  function newReport(s, again, v3Lines) {
    var g = gold(s);
    return {
      day: Math.max(1, dayNum(s.day, 1)),
      again: !!again,
      lines: [],
      /* The earlier change's lines (13 October 2026), when a version 2 save went through both. */
      v3Lines: (v3Lines || []).slice(),
      gold: { was: g, now: g, refunded: 0, settlement: 0, items: [] },
      favour: { telluria: 0, aurush: 0, pelagos: 0, lost: { telluria: 0, aurush: 0, pelagos: 0 }, was: favourBars(s) },
      goods: [],
      cancelled: [],
      moved: [],
      removed: {},
      notes: [],
      /* said: heading id → sentences, from R.stripBackSay. archived: facilities to record in archivedFacilities. */
      said: {},
      archived: [],
      /* The Beast Pen step (S14): how many old beast buildings became it, and whether it was built free. Only for the one-line summary. */
      pen: { joined: 0, builtFree: false }
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
    var rec = { id: idOf(order), label: label, why: String(why || 'it can no longer be carried out'), facId: str(order.facId), gp: 0, favour: 0, favourUnplaced: 0, god: '', goods: [] };
    rec.gp = R.stripBackPayGold(s, report, order.costGP, label, 'refund');
    var fav = clampInt(order.favourCost, 0, 100);
    if (fav > 0) {
      var god = GODS.indexOf(opts.god) !== -1 ? opts.god : R.shrineGod(order.facId);
      if (god) {
        rec.favour = fav;
        rec.god = god;
        addFavour(s, report, god, fav);
      } else {
        rec.favourUnplaced = fav;
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
  /* An order that carries on somewhere else. Only its PLACE and NAME may change:
     R.STRIP_BACK_MOVE_KEYS (J 4.3: "a moved order keeps its id, due day and
     chosen item"). Its id, what it cost (costGP), the Favour it used
     (favourCost), the goods it holds (inputs), the day it was issued and its due
     day, and its meta, are paid for and must come across exactly: asking to
     change any of them is a mistake in the step that asks, so it stops the
     conversion (which then fails closed) rather than quietly changing what was
     paid. The audit checks it again on the result. Listed as moved, with where
     it went (to: words). Only an order with an id can be moved (cancel one
     without). */
  R.STRIP_BACK_MOVE_KEYS = ['facId', 'fnId', 'label', 'optionLabel', 'chosen', 'notes'];
  R.stripBackMoveOrder = function (report, order, patch, to) {
    var keys = Object.keys(patch || {});
    keys.forEach(function (k) {
      if (R.STRIP_BACK_MOVE_KEYS.indexOf(k) === -1) throw new Error('A moved order may only have its place and name changed (' + R.STRIP_BACK_MOVE_KEYS.join(', ') + '), not its "' + k + '".');
    });
    if (!idOf(order)) throw new Error('An order with no id can\'t be moved (cancel it with its refund instead).');
    var label = str(order.label).trim() || 'An order';
    keys.forEach(function (k) { order[k] = patch[k]; });
    report.moved.push({ id: idOf(order), label: label, to: String(to || '') });
  };

  /* ---------- The steps ---------- */
  /* Step S05: the Bastion has no events any more (Harry, 22 October 2026). The
     panel, the Roll Bastion Event button, the d100 roll and the automatic one
     every 28 days are gone, and so is what they kept: lastEvent (the last one
     rolled: its roll, name, description, day) and lastEventDay (the day of the
     last automatic one). An event was only a note for the DM: nothing in it
     changed the Bastion's numbers, so nothing needs giving back. "The Ironbow
     sends word" (state.word) keeps any line an earlier event put there: that
     is history, and the audit checks it comes back the same.
     A save that never had an event leaves no trace (the two fields are simply
     not carried over, and nothing is said). Only a record that really held an
     event, or the day of one, is a leftover and is reported. */
  function eventLeft(v) { return v !== undefined && v !== null && v !== 0 && v !== false && v !== ''; }
  function detectEvents(s) {
    var out = [];
    if (eventLeft(s.lastEvent)) out.push('the last Bastion event');
    if (eventLeft(s.lastEventDay)) out.push('the day of the last Bastion event');
    if (eventLeft(s.pendingEvent)) out.push('a Bastion event waiting');
    var dip = isObj(s.dayInProgress) ? s.dayInProgress : null;
    if (dip && (eventLeft(dip.event) || eventLeft(dip.pendingEvent))) out.push('a Bastion event in the day being passed');
    return out;
  }
  function dropEvents(s, data, report) {
    var found = detectEvents(s);
    var last = isObj(s.lastEvent) ? s.lastEvent : null;
    delete s.lastEvent;
    delete s.lastEventDay;
    delete s.pendingEvent;
    if (isObj(s.dayInProgress)) {
      delete s.dayInProgress.event;
      delete s.dayInProgress.pendingEvent;
    }
    if (!found.length) return;
    var name = last ? (str(last.name).trim() || words(last.id)) : '';
    var day = last ? dayNum(last.day, null) : null;
    report.removed.events = { name: name, day: day };
    R.stripBackSay(report, 'events', last
      ? 'The Bastion no longer has events, so the last one it rolled' + (name ? ' (' + name + (day !== null && day >= 1 ? ', Day ' + day : '') + ')' : '') + ' is not kept. It was only a note for you; nothing in it changed the Bastion\'s numbers.'
      : 'The Bastion no longer has events, so its record of them is not kept. It was only a note for you; nothing in it changed the Bastion\'s numbers.');
  }

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
      /* Worded as of the day it happened: it is read again later, when the treasury has moved on. */
      said.gold.unshift(fmt(total) + ' gp went back into the treasury (on Day ' + report.day + ' it went from ' + fmt(report.gold.was) + ' gp to ' + fmt(gold(s)) + ' gp): ' +
        report.gold.items.map(function (i) { return i.label + ', ' + fmt(i.gp) + ' gp' + (i.kind === 'settlement' ? ' (paid out in full)' : ''); }).join('; ') + '.');
    }
    GODS.forEach(function (g) {
      var back = report.favour[g], lost = report.favour.lost[g];
      if (back > 0) said.favour.push(GOD_NAMES[g] + ': ' + back + '% went back to the bar (on Day ' + report.day + ' it went from ' + report.favour.was[g] + '% to ' + clampInt(s.favour && s.favour[g], 0, 100) + '%).');
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
    /* The Beast Pen comes first (these two start with a capital: the others carry on from them). The three beast buildings
       that became the Pen are not "removed": they are the Pen. */
    var pen = isObj(report.pen) ? report.pen : { joined: 0, builtFree: false };
    if (pen.joined) bits.push(pen.joined === 1 ? 'The beast building became the Beast Pen' : 'The ' + (pen.joined === 2 ? 'two' : pen.joined === 3 ? 'three' : pen.joined) + ' beast buildings became one Beast Pen');
    if (pen.builtFree) bits.push('A Beast Pen was built for your beasts');
    if (total > 0) bits.push(fmt(total) + ' gp went back into the treasury');
    if (report.cancelled.length) bits.push(plural(report.cancelled.length, 'order was', 'orders were') + ' cancelled');
    if (report.moved.length) bits.push(plural(report.moved.length, 'order', 'orders') + ' moved');
    if (report.goods.length) bits.push('goods went back to the Warehouse');
    var gone = report.archived.length - (pen.joined || 0);
    if (gone > 0) bits.push(plural(gone, 'place', 'places') + ' removed');
    if (report.removed.events) bits.push('the Bastion\'s event record was dropped');
    return bits.length ? bits.join('; ') + '.' : 'Nothing of yours changed.';
  }
  /* What is kept in the save about this conversion (migration.v4). A report that
     was never read is NEVER thrown away: if the Bastion is converted again before
     "I've read this" was pressed, the new lines are added after the earlier ones
     (each paragraph keeps its own figures), the day stays the first one, and it
     does not claim an older copy of the suite did it. "An older copy saved over
     your Bastion" is said only when the earlier report HAD been read and
     something came back after that. Pure: prev is the earlier migration.v4 (or
     null), report this conversion's, summary its one-line summary. */
  R.stripBackReportRecord = function (prev, report, summary) {
    var fresh = {
      day: report.day, lines: report.lines.slice(), summary: summary, changed: report.lines.length > 0,
      again: !!(report.again && isObj(prev) && prev.shown === true), shown: false,
      gp: report.gold.refunded + report.gold.settlement
    };
    if (!isObj(prev) || prev.shown === true) return fresh;
    if (!fresh.changed) return Object.assign({}, prev);
    var earlier = arr(prev.lines) || [];
    return {
      day: prev.changed ? clampInt(prev.day, 1) : fresh.day,
      lines: earlier.concat(earlier.length ? ['More was found on Day ' + report.day + ' and put right the same way.'] : [], fresh.lines),
      summary: prev.changed ? String(prev.summary || '').replace(/\.$/, '') + '; then, on Day ' + report.day + ': ' + summary : summary,
      changed: true, again: !!prev.again, shown: false,
      gp: clampInt(prev.gp, 0) + fresh.gp
    };
  };
  /* The last step: the version, the report kept in the save, the archive. */
  function finish(s, data, report) {
    if (report.archived.length) s.archivedFacilities = (arr(s.archivedFacilities) || []).filter(function (x) { return isObj(x); }).concat(report.archived);
    report.gold.now = gold(s);
    report.lines = paragraphs(s, data, report);
    s.v = R.STATE_VERSION;
    var prev = isObj(s.migration) && isObj(s.migration.v4) ? s.migration.v4 : null;
    s.migration = Object.assign({}, isObj(s.migration) ? s.migration : {}, { v4: R.stripBackReportRecord(prev, report, summaryOf(report)) });
  }
  R.stripBackFmt = fmt;

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

  /* Step S14 (Harry, 22 October 2026): the Wyvern Roost, Griffin Tower and Dire Wolf Den become ONE Beast Pen.
     - Their slots become one beast_pen entry in the slot of the one that was built (else the one that would be ready
       first); the others' slots are free. facilityLevels.beast_pen is 1 (it has one level); the old levels, repairs and
       research entries go. Every retired id is recorded in archivedFacilities.
     - Every housed creature's home is the Beast Pen. Nothing is released, nothing is credited and no dice are rolled:
       a creature's development (bond, handler, Chronicle, training, harness, first flight, the profile) is left exactly
       as it was. A beast at Bond 1 or more counts as acclimatised; one at Bond 0 must roll at the Pen.
     - Creatures but no beast building standing (demolished earlier, the creatures stayed): the Pen is built FREE in the
       first empty slot (a Pen costs time, never gold; this only makes them visible again). Only housed creatures do
       this: a creature still waiting for a home needs nothing built.
     - House orders (house_wyvern, house_griffin, house_dire_wolf and Elara's house_elara_wyvern) MOVE to the Pen's
       house_beast, keeping id, due day, cost and the creature they house; the label is written again. If the Pen has no
       room for that kind when it completes (it keeps one of each kind), the beast keeps waiting: the report says so.
     - Training orders and Upgrade orders at the three buildings are cancelled, with everything they cost given back (the
       150 gp Riding Harness is the only one that cost gold).
     - Two or more of one kind housed: all stay; the report says which kind is over and that no more can be housed.
     Pure: no storage, clock or dice. */
  var PEN_ID = 'beast_pen';
  var OLD_PENS = ['wyvern_roost', 'griffin_tower', 'dire_wolf_den'];
  var HOUSE_FNS = { wyvern_roost: ['house_elara_wyvern', 'house_wyvern'], griffin_tower: ['house_griffin'], dire_wolf_den: ['house_dire_wolf'] };
  function creaturesData(data) {
    if (data && isObj(data.creatures)) return data.creatures;
    var g = window.TSI_DATA && window.TSI_DATA.bastionCreatures;
    return isObj(g) ? g : {};
  }
  function kindOf(data, id) { var sp = creaturesData(data).species; return isObj(sp) && isObj(sp[id]) ? sp[id] : null; }
  function kindNoun(data, id) { var k = kindOf(data, id); return k && str(k.name) ? str(k.name).toLowerCase() : 'beast'; }
  function kindNounPlural(data, id) { var k = kindOf(data, id); return k && str(k.plural) ? str(k.plural).toLowerCase() : kindNoun(data, id) + 's'; }
  function perKind(data) { var p = creaturesData(data).pen; return isObj(p) && typeof p.perKind === 'number' && p.perKind >= 1 ? Math.floor(p.perKind) : 1; }
  /* A creature's name as the panels say it (rules in creature-rules.js, which the Explorer does not load). */
  function beastName(data, c) {
    if (isObj(c) && str(c.name)) return str(c.name);
    var uniq = creaturesData(data).unique;
    var u = isObj(c) && isObj(uniq) ? uniq[c.id] : null;
    if (u && str(u.name)) return str(u.name);
    if (u && str(u.defaultName)) return str(u.defaultName);
    var kind = kindOf(data, isObj(c) ? c.species : '');
    return (kind && str(kind.name) ? str(kind.name) : 'Creature') + ' (granted ' + dayWord(isObj(c) ? c.grantedDay : null) + ')';
  }
  function dayWord(n) { return typeof n === 'number' && n >= 1 ? 'Day ' + n : 'before Day 1'; }
  /* The name an order's label uses ("Swiftwing", or "granted Day 5" for one with no name). */
  function orderBeastName(data, c, id) {
    if (isObj(c)) return str(c.name) ? str(c.name) : 'granted ' + dayWord(c.grantedDay);
    var uniq = creaturesData(data).unique;
    var u = isObj(uniq) ? uniq[id] : null;
    return u ? (str(u.name) || str(u.defaultName) || 'a story beast') : 'a beast';
  }
  function entryOf(x) {
    if (typeof x === 'string' && x) return { facId: x, status: 'built' };
    return isObj(x) && typeof x.facId === 'string' && x.facId ? x : null;
  }
  function isOldPenId(id) { return OLD_PENS.indexOf(id) !== -1; }
  function isHouseOrder(o) {
    return isObj(o) && isOldPenId(o.facId) && (HOUSE_FNS[o.facId].indexOf(o.fnId) !== -1) && !(isObj(o.meta) && (o.meta.kind === 'upgrade' || o.meta.kind === 'research'));
  }
  function detectBeastPen(s) {
    var out = [];
    ['builtExtras', 'builtPlots'].forEach(function (key) {
      (arr(s[key]) || []).forEach(function (x) { var e = entryOf(x); if (e && isOldPenId(e.facId)) out.push('a place: ' + e.facId); });
    });
    /* (The saved research is not touched: none of the three buildings ever had a research tree, the audit insists the
       research record comes back exactly as it was, and the Bastion drops a tree it does not know when it loads.) */
    ['facilityLevels', 'repairs'].forEach(function (key) {
      if (isObj(s[key])) Object.keys(s[key]).forEach(function (id) { if (isOldPenId(id)) out.push('a ' + (key === 'repairs' ? 'repair' : 'level') + ': ' + id); });
    });
    (arr(s.pendingOrders) || []).forEach(function (o) { if (isObj(o) && isOldPenId(o.facId)) out.push('an order: ' + o.facId); });
    (arr(s.creatures) || []).forEach(function (c) {
      if (isObj(c) && c.status === 'housed' && typeof c.home === 'string' && c.home !== PEN_ID) out.push('a beast at ' + (c.home || 'no home'));
    });
    return out;
  }
  function rehomeBeasts(s, data, report) {
    var found = detectBeastPen(s);
    if (!found.length) return;
    var day = report.day;
    var cancelledBefore = report.cancelled.length;
    var seen = {};
    var penEntry = null;          /* the slot that stands as the Pen: { list, index } */
    var olds = [];                /* every old building found in a slot: { list, index, entry, plot } */
    [['builtExtras', false], ['builtPlots', true]].forEach(function (pair) {
      var list = arr(s[pair[0]]);
      if (!list) return;
      list.forEach(function (x, i) {
        var e = entryOf(x);
        if (!e) return;
        if (e.facId === PEN_ID && !penEntry) penEntry = { list: list, index: i };
        if (isOldPenId(e.facId)) olds.push({ list: list, index: i, entry: e, plot: pair[1] });
      });
    });
    /* The slot that carries on as the Pen: one that is already the Pen, else the built old building, else the one ready first. */
    var keep = null;
    if (!penEntry && olds.length) {
      keep = olds.slice().sort(function (a, b) {
        var A = a.entry.status === 'building' ? 1 : 0, B2 = b.entry.status === 'building' ? 1 : 0;
        if (A !== B2) return A - B2;
        if (A === 1) return dayNum(a.entry.readyDay, 0) - dayNum(b.entry.readyDay, 0) || a.index - b.index;
        return a.index - b.index;
      })[0];
    }
    var standing = penEntry ? entryOf(penEntry.list[penEntry.index]) : null;
    var names = [];
    olds.forEach(function (o) {
      var name = R.stripBackName(data, o.entry.facId);
      var building = o.entry.status === 'building';
      var rec = { facId: o.entry.facId, name: name, status: building ? 'building' : 'built', slot: o.index, day: day };
      if (o.plot) rec.plot = true;
      report.archived.push(rec);
      if (names.indexOf(name) === -1) names.push(name);
      if (keep && o === keep) {
        var made = { facId: PEN_ID, status: building ? 'building' : 'built' };
        if (building) { made.startDay = o.entry.startDay; made.readyDay = o.entry.readyDay; }
        o.list[o.index] = made;
        standing = made;
      } else {
        o.list[o.index] = '';
      }
      seen[o.entry.facId] = true;
    });
    /* A creature housed but no building standing: the Pen is built free in the first empty slot. */
    var housed = (arr(s.creatures) || []).filter(function (c) { return isObj(c) && c.status === 'housed'; });
    var builtFree = false;
    report.pen.joined = olds.length;
    if (!standing && housed.length) {
      if (!arr(s.builtExtras)) s.builtExtras = [];
      var at = -1;
      for (var i = 0; i < s.builtExtras.length; i++) { if (!entryOf(s.builtExtras[i])) { at = i; break; } }
      if (at === -1) at = s.builtExtras.length;
      s.builtExtras[at] = { facId: PEN_ID, status: 'built' };
      standing = s.builtExtras[at];
      builtFree = true;
      report.pen.builtFree = true;
    }
    /* Levels and repairs: the old ids go; the Pen has one level. */
    ['facilityLevels', 'repairs'].forEach(function (key) {
      if (!isObj(s[key])) return;
      OLD_PENS.forEach(function (id) { if (id in s[key]) { delete s[key][id]; seen[id] = true; (report.removed[key] = report.removed[key] || []).push(id); } });
    });
    if (standing) {
      if (!isObj(s.facilityLevels)) s.facilityLevels = {};
      s.facilityLevels[PEN_ID] = 1;
    }
    /* Creatures: every housed one lives at the Pen now. Only the home changes. */
    housed.forEach(function (c) { c.home = PEN_ID; });
    /* Pending orders. */
    var orders = arr(s.pendingOrders) || [];
    orders.slice().forEach(function (o) {
      if (!isObj(o) || !isOldPenId(o.facId)) return;
      seen[o.facId] = true;
      var fnName = '';
      var isUpgrade = isObj(o.meta) && o.meta.kind === 'upgrade';
      if (isHouseOrder(o)) {
        var id = isObj(o.chosen) && typeof o.chosen.creatureId === 'string' ? o.chosen.creatureId : '';
        var c = id ? (arr(s.creatures) || []).filter(function (x) { return isObj(x) && x.id === id; })[0] : null;
        var uniq = creaturesData(data).unique;
        if (!id || (!c && !(isObj(uniq) && isObj(uniq[id])))) {
          R.stripBackCancel(s, data, report, o, 'the beast it was for could not be found');
          return;
        }
        var nm = orderBeastName(data, c, id);
        R.stripBackMoveOrder(report, o, { facId: PEN_ID, fnId: 'house_beast', label: 'Beast Pen: House Beast Here (' + nm + ')', optionLabel: nm }, 'the Beast Pen');
        return;
      }
      R.stripBackCancel(s, data, report, o, isUpgrade ? 'the Beast Pen has one level only, so there is nothing to upgrade' : 'training and riding are gone: beasts now bond day by day on the road');
    });

    /* ---------- The words ---------- */
    var poolNames = ['wyvern', 'griffin', 'dire wolf', 'buckbear', 'fellcat'];
    if (olds.length) {
      var these = OLD_PENS.filter(function (id) { return olds.some(function (o) { return o.entry.facId === id; }); }).map(function (id) { return R.stripBackName(data, id); });
      var keepsLine = 'It keeps one beast of each kind: ' + listText(poolNames.map(function (n) { return (/^[aeiou]/.test(n) ? 'an ' : 'a ') + n; })) + '.';
      var state = standing && standing.status === 'building' ? ' It is still being built (ready on Day ' + dayNum(standing.readyDay, day) + ').' : '';
      var freed = olds.length - (keep ? 1 : 0);
      R.stripBackSay(report, 'joined', 'The ' + listText(these) + (these.length > 1 ? ' have become one Beast Pen. ' : ' has become the Beast Pen. ') + keepsLine + state + (freed > 0 ? (freed === 1 ? ' The other slot is free.' : ' The other slots are free.') : ''));
    }
    if (builtFree) {
      R.stripBackSay(report, 'beasts', (housed.length === 1 ? 'Your beast had' : 'Your beasts had') + ' no building left standing, so the Beast Pen was built for you, free, in an empty slot (a Beast Pen costs time, never gold). ' + (housed.length === 1 ? 'It is' : 'They are all') + ' still there.');
    }
    /* Only real records: a damaged entry (null, text, a number) is not a beast and is left alone. */
    var beasts = (arr(s.creatures) || []).filter(isObj);
    if (beasts.length) {
      var hasDev = function (c, key) { return isObj(c.development) && isObj(c.development[key]); };
      R.stripBackSay(report, 'beasts', beasts.length === 1
        ? 'Your beast is still here, with its name, handler, bond and Chronicle: ' + beastName(data, beasts[0]) + '.'
        : 'All ' + beasts.length + ' of your beasts are still here, with their names, handlers, bonds and Chronicles: ' + listText(beasts.map(function (c) { return beastName(data, c); })) + '.');
      var acclimatised = housed.filter(function (c) { return isObj(c.development) && isObj(c.development.bond) && clampInt(c.development.bond.level, 0, 5) >= 1; });
      var toRoll = housed.filter(function (c) { return !(isObj(c.development) && isObj(c.development.bond) && clampInt(c.development.bond.level, 0, 5) >= 1); });
      if (acclimatised.length || toRoll.length) {
        R.stripBackSay(report, 'beasts', [
          acclimatised.length ? 'A beast at Bond 1 or more counts as acclimatised: ' + listText(acclimatised.map(function (c) { return beastName(data, c); })) + '.' : '',
          toRoll.length ? listText(toRoll.map(function (c) { return beastName(data, c); })) + (toRoll.length > 1 ? ' still need' : ' still needs') + ' the Acclimatise With Beast roll at the Beast Pen before ' + (toRoll.length > 1 ? 'they can' : 'it can') + ' bond.' : ''
        ].filter(Boolean).join(' '));
      }
      beasts.forEach(function (c) {
        var d = isObj(c.development) ? c.development : null;
        if (d && isObj(d.bond) && typeof d.bond.ready === 'number' && d.bond.ready === clampInt(d.bond.level, 0, 5) + 1) {
          R.stripBackSay(report, 'beasts', beastName(data, c) + '\'s Bond ' + d.bond.ready + ' milestone was waiting for your scene, and still is: confirm it in the Beast Pen.');
        }
      });
      var learned = beasts.filter(function (c) { return isObj(c.development) && ((isObj(c.development.training) && Object.keys(c.development.training).length) || (isObj(c.development.harness) && c.development.harness.fitted === true) || (isObj(c.development.firstFlight) && c.development.firstFlight.approved === true)); });
      if (learned.length || report.cancelled.length > cancelledBefore) {
        R.stripBackSay(report, 'beasts', 'Training, riding harnesses and first flights are gone, so beasts now bond day by day on the road with their handlers.' +
          (learned.length ? ' What ' + listText(learned.map(function (c) { return beastName(data, c); })) + ' had learned stays in ' + (learned.length > 1 ? 'their records' : 'its record') + ', out of sight.' : ''));
      }
      /* Over the one-of-each limit. */
      var count = {};
      housed.forEach(function (c) { count[c.species] = (count[c.species] || 0) + 1; });
      Object.keys(count).forEach(function (k) {
        if (count[k] > perKind(data)) {
          R.stripBackSay(report, 'beasts', 'The Beast Pen keeps ' + (perKind(data) === 1 ? 'one ' + kindNoun(data, k) : plural(perKind(data), kindNoun(data, k), kindNounPlural(data, k))) + ', and ' + count[k] + ' ' + kindNounPlural(data, k) + ' live there. They all stay: nothing is sent away. No more ' + kindNounPlural(data, k) + ' can be housed.');
        }
      });
      /* A moved House order that will not fit when it completes: the beast keeps waiting (a story beast that is not in the
         list yet, Elara's wyvern, is added to it as waiting then; nothing is lost). */
      var ordered = {};
      report.moved.forEach(function (m) {
        var o = orders.filter(function (x) { return isObj(x) && idOf(x) === m.id; })[0];
        if (!o || o.fnId !== 'house_beast') return;
        var cid = isObj(o.chosen) ? o.chosen.creatureId : '';
        ordered[cid] = true;
        var c = beasts.filter(function (x) { return x.id === cid; })[0];
        var uniq = creaturesData(data).unique;
        var species = c ? c.species : (isObj(uniq) && isObj(uniq[cid]) ? uniq[cid].species : '');
        if (species && (count[species] || 0) >= perKind(data)) {
          var who = orderBeastName(data, c, cid);
          R.stripBackSay(report, 'beasts', 'The House order for ' + who + ' carries on, but the Beast Pen already holds a ' + kindNoun(data, species) + ', so ' + who + ' will ' + (c ? 'keep waiting' : 'wait') + ' for a home when it completes' +
            (c ? '.' : ' (it is added to the list of waiting beasts then; it is not lost).'));
        }
      });
      /* Beasts already waiting with no order, because the Pen already holds one of their kind. */
      var stuck = beasts.filter(function (c) { return c.status === 'waiting' && !ordered[c.id] && (count[c.species] || 0) >= perKind(data); });
      if (stuck.length) {
        R.stripBackSay(report, 'beasts', stuck.length === 1
          ? beastName(data, stuck[0]) + ' is waiting for a home, because the Beast Pen already holds a ' + kindNoun(data, stuck[0].species) + '. It stays on the waiting list; nothing is sent away.'
          : 'These beasts are waiting for a home, because the Beast Pen already holds one of their kind: ' + listText(stuck.map(function (c) { return beastName(data, c) + ' (a ' + kindNoun(data, c.species) + ')'; })) + '. They stay on the waiting list; nothing is sent away.');
      }
    }
  }

  /* The registry, in the order they run. Add a step ABOVE sweepFacilities. */
  R.stripBackSteps = [
    { id: 'dropEvents', detect: detectEvents, run: dropEvents },
    { id: 'dropBeastRequests', detect: detectBeastRequests, run: dropBeastRequests },
    { id: 'rehomeBeasts', detect: detectBeastPen, run: rehomeBeasts },
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
    return { bastion: D.bastion, facilities: D.bastionFacilities, tools: D.bastionTools, research: D.bastionResearch, goods: D.bastionGoods, commerce: D.bastionCommerce, courier: D.bastionCourier, creatures: D.bastionCreatures, warRoom: D.bastionWarRoom };
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
  /* The orders that are KEPT or MOVED are compared with what they were (J 4.3: what an order cost, the
     Favour and goods it holds and its due day all come across exactly). A kept order must be unchanged
     altogether; a moved one may change only its place and name (R.STRIP_BACK_MOVE_KEYS) and must be
     listed as moved. Orders that share an id can't be told apart one by one, so when none of them was
     cancelled or moved the lot must come across exactly (the same orders, whatever their order). */
  var PAID_ORDER_FIELDS = [['costGP', 'gold cost'], ['favourCost', 'Favour cost'], ['inputs', 'goods held'], ['issuedDay', 'issue day'], ['dueDay', 'due day']];
  function without(o, keys) {
    var out = Object.assign({}, o);
    keys.forEach(function (k) { delete out[k]; });
    return out;
  }
  function auditKeptOrders(before, after, report, bad) {
    var gone = {}, movedIds = {}, bc = {}, ac = {}, first = {};
    (arr(report.cancelled) || []).forEach(function (c) { if (isObj(c) && c.id) gone[c.id] = true; });
    (arr(report.moved) || []).forEach(function (m) { if (isObj(m) && m.id) movedIds[m.id] = true; });
    var bo = arr(before.pendingOrders) || [], ao = arr(after.pendingOrders) || [];
    bo.forEach(function (o) { var id = idOf(o); if (id) bc[id] = (bc[id] || 0) + 1; });
    ao.forEach(function (o) { var id = idOf(o); if (id) { ac[id] = (ac[id] || 0) + 1; if (!first[id]) first[id] = o; } });
    var sharedBefore = {}, sharedAfter = {};
    bo.forEach(function (o) { var id = idOf(o); if (id && (bc[id] > 1 || ac[id] > 1)) (sharedBefore[id] = sharedBefore[id] || []).push(canon(o)); });
    ao.forEach(function (o) { var id = idOf(o); if (id && (bc[id] > 1 || ac[id] > 1)) (sharedAfter[id] = sharedAfter[id] || []).push(canon(o)); });
    Object.keys(sharedBefore).forEach(function (id) {
      if (gone[id] || movedIds[id]) return;
      if (JSON.stringify((sharedBefore[id] || []).sort()) !== JSON.stringify((sharedAfter[id] || []).sort())) bad('Orders that share the id "' + id + '" would be changed.');
    });
    bo.forEach(function (b) {
      var id = idOf(b);
      if (!id || gone[id] || bc[id] > 1 || ac[id] > 1 || !first[id]) return;
      var a = first[id];
      var name = str(b.label).trim() || 'An order';
      PAID_ORDER_FIELDS.forEach(function (f) {
        if (canon(b[f[0]]) !== canon(a[f[0]])) bad('"' + name + '" would have its ' + f[1] + ' changed.');
      });
      if (movedIds[id]) {
        if (canon(without(b, R.STRIP_BACK_MOVE_KEYS)) !== canon(without(a, R.STRIP_BACK_MOVE_KEYS))) bad('"' + name + '" is listed as moved, but more than its place and name would change.');
      } else if (canon(b) !== canon(a)) {
        bad('"' + name + '" would be changed, but the report does not say it moved.');
      }
    });
    /* An order with no id can't be followed by name: each one left must be exactly one there was. */
    var spare = bo.filter(function (o) { return isObj(o) && !idOf(o); }).map(canon);
    ao.forEach(function (o) {
      if (!isObj(o) || idOf(o)) return;
      var i = spare.indexOf(canon(o));
      if (i === -1) bad('An order with no id would be changed.'); else spare.splice(i, 1);
    });
  }
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
        /* Every point of Favour the order used is either handed back to a god's bar or said to be unplaced. */
        if (clampInt(c.favour, 0, 100) + clampInt(c.favourUnplaced, 0, 100) !== clampInt(was.favourCost, 0, 100)) bad('"' + c.label + '" used ' + clampInt(was.favourCost, 0, 100) + '% of a god\'s Favour, but ' + clampInt(c.favour, 0, 100) + '% is handed back' + (c.favourUnplaced ? ' and ' + c.favourUnplaced + '% is said to have no god' : '') + '.');
        if (c.favour > 0 && !c.god) bad('"' + c.label + '" hands Favour back to no god.');
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
    /* Kept and moved orders against what they were: the same cost, Favour, goods and days (a moved one changes only its place and name). */
    auditKeptOrders(before, after, report, bad);

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
