/* The Ironbow Bastion Manager — the Courier Exchange (pull request 6 of the
   facilities overhaul; Harry's answers, 14 October 2026). Plain functions
   (no screen code), tested on tests/rules.html. They add to the Bastion's
   rules (tools/bastion/rules.js), as commerce-rules.js does.

   How a parcel goes:
   - Send. The DM picks a town the Courier Exchange's level reaches and the
     supplies to send (only goods listed in data/courier-data.js items).
     Everything is checked first; then, in one change, the goods leave the
     Warehouse, the fee leaves the treasury and the parcel is recorded
     (tradeNetwork.parcels), 'in_transit'.
   - Arrive. In the day's 'trade' stage, a parcel whose readyDay has come
     becomes 'ready': it waits at its town, for as long as it takes.
   - Collect. The DM collects it in the Explorer, at that town's picture; the
     goods go into the Travel bags with a pickup message
     (shared/js/bridge-rules.js). The Bastion closes the parcel once,
     'collected', from R.applyInbox, with its receipt in the same change. The
     only way out of 'ready' is the pickup, so a waiting parcel's goods are
     never in two places.
   - Recall. A parcel still on its way out can be recalled (not on or after
     its arrival day): 'returning', home after as many days as it had
     travelled (at least 1), when its goods go back into the Warehouse once
     and it becomes 'returned'. The fee isn't refunded.
   Travelling parcels (on their way out, or recalled and on their way back)
   take the level's travelling places; waiting ones don't.

   A parcel: { id, point, goods: [{ goodId, qty }], items, departDay,
   readyDay, status, arrivedDay, collectedDay, collectId, recalledDay,
   returnDay, feeGP }, always in this order (so loading a save twice gives
   the same save). Names are never stored: they come from the data when
   shown. The Courier Exchange is separate from the Dock: no ships, no Dock
   room, no Port Charters, no sea routes.

   Under Repair stops new parcels only; parcels already sent carry on, and
   a recall is still allowed. After Demolish, parcels already sent still
   arrive and can be collected, and recalled ones still come home; only
   sending and recalling need the Courier Exchange standing (Recall parcel…
   is in its panel). */
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
  function txt(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isWhole(v) { return isNum(v) && Math.floor(v) === v; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function bridge() { return TSI.bridge || null; }

  var FAC = 'courier_exchange';
  R.COURIER_FAC = FAC;
  var OPEN = ['in_transit', 'ready', 'returning'];
  var STATUSES = ['in_transit', 'ready', 'collected', 'returning', 'returned'];
  R.PARCEL_STATUSES = STATUSES;

  /* ---------- The courier's data, with safe defaults ---------- */
  /* data.courier (data/courier-data.js); the page's own copy if a caller's
     data has none (an older test or tool data object). */
  function courier(data) {
    if (data && isObj(data.courier)) return data.courier;
    var g = window.TSI_DATA && window.TSI_DATA.bastionCourier;
    return isObj(g) ? g : {};
  }
  R.courier = courier;
  function num(v, min, max, fallback) { return isNum(v) ? Math.max(min, Math.min(max, v)) : fallback; }
  function minDays(data) { return Math.floor(num(courier(data).minDays, 1, 365, 1)); }
  function keptClosed(data) { return Math.floor(num(courier(data).keptClosed, 1, 500, 30)); }

  /* What a parcel can carry: [{ goodId, name, size }], in the data's order.
     A good is only carried if courier-data.js lists it, the Bastion knows
     it, it isn't a trade good (bulk cargo never goes by courier), and the
     Travel bags can hold it (shared/data/party-items.js). */
  R.courierGoodBlocker = function (data, goodId) {
    var items = isObj(courier(data).items) ? courier(data).items : {};
    var g = R.good(data, goodId);
    var name = g ? g.name : R.goodName(data, goodId);
    if (!g) return 'That isn\'t a good the Bastion knows.';
    if (!isObj(items[goodId])) return name + ' doesn\'t go by courier (courier-data.js).';
    if (g.kind === 'cargo') return name + ' is bulk cargo: it goes by the Dock, never by courier.';
    var bags = (window.TSI_DATA && window.TSI_DATA.partyItems) || null;
    if (bags && !isObj(bags[goodId])) return name + ' can\'t go in the Travel bags, so the party couldn\'t collect it.';
    return '';
  };
  R.courierGoods = function (data) {
    var items = isObj(courier(data).items) ? courier(data).items : {};
    return Object.keys(items).filter(function (id) { return !R.courierGoodBlocker(data, id); }).map(function (id) {
      return { goodId: id, name: R.goodName(data, id), size: Math.floor(num(items[id].size, 1, 100, 1)) };
    });
  };
  function sizeOf(data, goodId) {
    var items = isObj(courier(data).items) ? courier(data).items : {};
    return isObj(items[goodId]) ? Math.floor(num(items[goodId].size, 1, 100, 1)) : 1;
  }
  /* How many items a parcel's goods count as (each good's qty × size). */
  R.parcelItems = function (data, goods) {
    return (goods || []).reduce(function (n, x) { return n + (isObj(x) ? clampInt(x.qty, 0) * sizeOf(data, x.goodId) : 0); }, 0);
  };
  /* What the courier can carry and the Warehouse holds now:
     [{ goodId, name, size, have }]. */
  R.courierStock = function (s, data) {
    return R.courierGoods(data).map(function (g) { return Object.assign({}, g, { have: R.goodsQty(s, g.goodId) }); });
  };

  /* The Courier Exchange's room at its level: { built, level, name, onRoad,
     maxItems }. Levels above the highest one in the data use that one. */
  R.courierSpec = function (s, data) {
    var built = R.builtFacilityIds(s, data).indexOf(FAC) !== -1;
    var level = built ? R.getFacilityLevel(s, FAC) : 0;
    var table = isObj(courier(data).levels) ? courier(data).levels : {};
    var row = null;
    for (var lv = level; lv >= 1 && !row; lv--) if (isObj(table[lv])) row = table[lv];
    return {
      built: built,
      level: level,
      name: row && typeof row.name === 'string' ? row.name : '',
      onRoad: row ? Math.floor(num(row.onRoad, 0, 50, 0)) : 0,
      maxItems: row ? Math.floor(num(row.maxItems, 0, 1000, 0)) : 0
    };
  };

  /* A collection point, with its numbers: { id, label, clan, mapId, region,
     level, days, feeGP }, or null if the town isn't on the shared list
     (shared/data/courier-points.js) or has no numbers in courier-data.js. */
  R.courierPoint = function (data, id) {
    var B = bridge();
    var table = isObj(courier(data).points) ? courier(data).points : {};
    var row = typeof id === 'string' && isObj(table[id]) ? table[id] : null;
    if (!row || !B || !B.isPoint(id)) return null;
    var geo = (window.TSI_DATA && window.TSI_DATA.courierPoints && window.TSI_DATA.courierPoints[id]) || {};
    return {
      id: id,
      label: B.pointLabel(id),
      clan: B.pointClan(id),
      mapId: txt(geo.mapId, 60),
      region: txt(geo.region, 60),
      level: Math.floor(num(row.level, 1, R.MAX_LEVEL, 1)),
      days: Math.max(minDays(data), Math.floor(num(row.days, 1, 365, 7))),
      feeGP: Math.floor(num(row.feeGP, 0, 100000, 0))
    };
  };
  /* Every collection point with its numbers, in the data's order. */
  R.courierPointList = function (data) {
    var table = isObj(courier(data).points) ? courier(data).points : {};
    return Object.keys(table).map(function (id) { return R.courierPoint(data, id); }).filter(Boolean);
  };
  /* The towns the Courier Exchange reaches at its level now. */
  R.courierPoints = function (s, data) {
    var spec = R.courierSpec(s, data);
    return R.courierPointList(data).filter(function (p) { return p.level <= spec.level; });
  };
  R.courierPointName = function (id) { var B = bridge(); return B ? B.pointLabel(id) : String(id || ''); };
  /* The lowest Courier Exchange level that reaches a town (0 if none). */
  R.courierLevelFor = function (data, id) { var p = R.courierPoint(data, id); return p ? p.level : 0; };

  /* ---------- The parcels ---------- */
  function tn(s) {
    if (!isObj(s.tradeNetwork)) s.tradeNetwork = R.defaultTradeNetwork();
    return s.tradeNetwork;
  }
  R.parcels = function (s) {
    var t = tn(s);
    if (!arr(t.parcels)) t.parcels = [];
    return t.parcels;
  };
  R.parcelById = function (s, id) { return R.parcels(s).filter(function (p) { return p.id === id; })[0] || null; };
  R.parcelsWith = function (s, status) { return R.parcels(s).filter(function (p) { return p.status === status; }); };
  /* Parcels taking a travelling place: on their way out, or recalled and on
     their way back. Waiting ones don't. */
  R.travellingParcels = function (s) { return R.parcels(s).filter(function (p) { return p.status === 'in_transit' || p.status === 'returning'; }); };
  /* Parcels not yet closed (travelling or waiting). */
  R.openParcels = function (s) { return R.parcels(s).filter(function (p) { return OPEN.indexOf(p.status) !== -1; }); };
  /* "3 Expedition Provision Packs, 1 Overland chart". */
  R.parcelGoodsText = function (data, goods) { return R.goodsListText(data, (goods || []).map(function (x) { return { goodId: x.goodId, qty: x.qty }; })); };
  /* A parcel in plain words, for the panel. */
  R.parcelState = function (p) {
    var town = R.courierPointName(p.point);
    if (p.status === 'in_transit') return 'On the road to ' + town + ': arrives ' + R.dayLabel(p.readyDay);
    if (p.status === 'ready') return 'Waiting at ' + town + ' since ' + R.dayLabel(isNum(p.arrivedDay) ? p.arrivedDay : p.readyDay) + ', for the party to collect';
    if (p.status === 'returning') return 'Recalled on the way to ' + town + ': back at the Ironbow on ' + R.dayLabel(p.returnDay);
    if (p.status === 'returned') return 'Recalled on the way to ' + town + ': back at the Ironbow on ' + R.dayLabel(p.returnDay) + ', its contents in the Warehouse';
    return 'Collected at ' + town + (isNum(p.collectedDay) ? ' on ' + R.dayLabel(p.collectedDay) : '');
  };

  /* ---------- Sending a parcel ---------- */
  /* Why no parcel can be sent now ('' if one can): the Courier Exchange
     isn't built, is Under Repair, has every travelling place taken, or the
     Warehouse has nothing it carries. */
  R.parcelBlocker = function (s, data) {
    var spec = R.courierSpec(s, data);
    if (!spec.built) return 'The Courier Exchange isn\'t built.';
    var repair = R.underRepair(s, FAC);
    if (repair) return 'The Courier Exchange is Under Repair until ' + R.dayLabel(repair) + '.';
    if (spec.onRoad < 1) return 'The Courier Exchange can\'t send parcels at Level ' + spec.level + ' (courier-data.js).';
    var out = R.travellingParcels(s);
    if (out.length >= spec.onRoad) {
      var next = out.reduce(function (m, p) {
        var d = p.status === 'returning' ? p.returnDay : p.readyDay;
        return m === null || d < m ? d : m;
      }, null);
      return (spec.onRoad === 1 ? 'A parcel is already travelling' : 'All ' + spec.onRoad + ' travelling places are taken') +
        (next !== null ? ': the first place is free on ' + R.dayLabel(next) + '.' : '.');
    }
    if (!R.courierPoints(s, data).length) return 'The Courier Exchange reaches no town yet (courier-data.js).';
    var stock = R.courierStock(s, data);
    if (!stock.some(function (g) { return g.have > 0; })) {
      var names = stock.map(function (g) { var x = R.good(data, g.goodId); return x && x.kind === 'supply' ? (typeof x.plural === 'string' && x.plural ? x.plural.charAt(0).toUpperCase() + x.plural.slice(1) : g.name + 's') : g.name; });
      return 'The Warehouse has nothing the courier carries' + (names.length ? ' (' + names.join(', ') + ')' : '') + '.';
    }
    return '';
  };

  /* Tidy what the DM picked: [{ goodId, qty }], each good once, whole counts. */
  function mergePicks(picks) {
    var out = [];
    (picks || []).forEach(function (x) {
      if (!isObj(x) || typeof x.goodId !== 'string' || !x.goodId) return;
      var q = clampInt(x.qty, 0, 1000);
      if (!q) return;
      var have = out.filter(function (y) { return y.goodId === x.goodId; })[0];
      if (have) have.qty += q; else out.push({ goodId: x.goodId, qty: q });
    });
    return out;
  }
  R.mergeParcelPicks = mergePicks;

  /* Why this parcel would be refused ('' if it can be sent): everything the
     Send checks, in the order it checks them. */
  R.parcelProblem = function (s, data, pointId, picks) {
    var why = R.parcelBlocker(s, data);
    if (why) return why;
    var B = bridge();
    var point = R.courierPoint(data, pointId);
    if (!point) return (B && B.isPoint(pointId) ? R.courierPointName(pointId) + ' has no courier days or fee yet (courier-data.js).' : 'Choose a town the courier knows.');
    var spec = R.courierSpec(s, data);
    if (point.level > spec.level) return point.label + ' needs the Courier Exchange at Level ' + point.level + ' (it\'s Level ' + spec.level + ').';
    var goods = mergePicks(picks);
    for (var i = 0; i < goods.length; i++) {
      var bad = R.courierGoodBlocker(data, goods[i].goodId);
      if (bad) return bad;
    }
    var items = R.parcelItems(data, goods);
    if (items < 1) return 'Choose at least 1 item to send.';
    if (items > spec.maxItems) return 'That\'s ' + plural(items, 'item') + ': a parcel from a Level ' + spec.level + ' Courier Exchange holds up to ' + plural(spec.maxItems, 'item') + '.';
    var short = R.inputsShort(s, data, goods.map(function (x) { return { good: x.goodId, qty: x.qty }; }));
    if (short) return short.message;
    var gold = clampInt(s.treasuryGP, 0);
    if (gold < point.feeGP) return 'Sending a parcel to ' + point.label + ' costs ' + point.feeGP + ' gp; the treasury has ' + gold + ' gp.';
    return '';
  };

  /* A one-line summary of a draft parcel, for the Send pop-up: "3 items of
     5 · fee 5 gp · leaves today, reaches Slade’s Muster on Day 14 and waits
     there until the party collects it." */
  R.parcelSummary = function (s, data, pointId, picks) {
    var spec = R.courierSpec(s, data);
    var items = R.parcelItems(data, mergePicks(picks));
    var point = R.courierPoint(data, pointId);
    var head = plural(items, 'item') + ' of ' + spec.maxItems;
    if (!point) return head + ' · choose a town.';
    return head + ' · fee ' + point.feeGP + ' gp · leaves today, reaches ' + point.label + ' on ' + R.dayLabel(s.day + point.days) + ' and waits there until the party collects it.';
  };

  /* A parcel's id: never one a parcel already has, and never one with a
     pickup receipt or a pickup waiting (a receipt with its pickup id means
     "already collected"). It always fits the link's id pattern, so its
     pickup id does too. */
  function uniqueId(s, rand, explorerSave) {
    var B = bridge();
    var taken = {};
    R.parcels(s).forEach(function (p) { taken[p.id] = true; });
    var done = isObj(s.bridge) && isObj(s.bridge.done) ? s.bridge.done : {};
    var used = function (id) {
      if (taken[id]) return true;
      if (B && Object.prototype.hasOwnProperty.call(done, B.collectId(id))) return true;
      if (B && explorerSave && B.outbox(explorerSave).some(function (m) { return m.id === B.collectId(id); })) return true;
      return B ? !B.UID_PATTERN.test(id) : false;
    };
    var base = R.uid(rand).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    if (base.length < 6) base = (base + 'parcel').slice(0, 30);
    var id = base;
    for (var n = 2; used(id); n++) id = base + '-' + n;
    return id;
  }

  /* Send a parcel. Every check is made first (R.parcelProblem); a refusal
     changes nothing. Then, in one change: the goods leave the Warehouse
     (all or nothing), the fee leaves the treasury, and the parcel is
     recorded. explorerSave (optional): the Explorer's save as last read, so
     a new id never matches a pickup already sent.
     Returns { ok, parcel, log } or { ok: false, message }. */
  R.sendParcel = function (s, data, pointId, picks, rand, explorerSave) {
    var why = R.parcelProblem(s, data, pointId, picks);
    if (why) return { ok: false, message: why };
    var point = R.courierPoint(data, pointId);
    var goods = mergePicks(picks);
    var taken = R.takeGoods(s, data, goods.map(function (x) { return { good: x.goodId, qty: x.qty }; }));
    if (!taken) return { ok: false, message: 'The Warehouse doesn\'t have those supplies.' };
    s.treasuryGP = clampInt(s.treasuryGP, 0) - point.feeGP;
    var p = {
      id: uniqueId(s, rand, explorerSave),
      point: point.id,
      goods: taken.map(function (x) { return { goodId: x.goodId, qty: x.qty }; }),
      items: R.parcelItems(data, taken),
      departDay: s.day,
      readyDay: s.day + point.days,
      status: 'in_transit',
      arrivedDay: null,
      collectedDay: null,
      collectId: null,
      recalledDay: null,
      returnDay: null,
      feeGP: point.feeGP
    };
    R.parcels(s).push(p);
    return {
      ok: true, parcel: p,
      log: ['Courier', 'A parcel left for ' + point.label + ': ' + R.parcelGoodsText(data, p.goods) + ', from the Warehouse (fee ' + point.feeGP + ' gp from the treasury). It reaches ' + point.label + ' on ' + R.dayLabel(p.readyDay) + ' and waits there until the party collects it.']
    };
  };

  /* ---------- Recalling a parcel (Harry, 14 October 2026) ----------
     Only on its way out, before its arrival day. It turns back at once and
     can't be delivered any more; its contents stay in the parcel until it's
     home, after as many days as it had travelled (at least 1), when they go
     back into the Warehouse. The fee isn't refunded, and the way back costs
     nothing. Allowed while the Courier Exchange is Under Repair (it starts
     nothing new), but not once it's demolished: the parcel then simply
     arrives and waits, as Harry decided parcels on the road carry on. */
  R.parcelRecallBlocker = function (s, p, data) {
    if (!p) return 'That parcel isn\'t on the road any more.';
    if (data && R.builtFacilityIds(s, data).indexOf(FAC) === -1 && p.status === 'in_transit') return 'The Courier Exchange has been demolished, so the parcel can\'t be recalled; it still reaches ' + R.courierPointName(p.point) + ' and can be collected there.';
    var town = R.courierPointName(p.point);
    if (p.status === 'returning') return 'That parcel has already been recalled: it\'s on its way back to the Ironbow.';
    if (p.status === 'returned') return 'That parcel has already been recalled and is back at the Ironbow.';
    if (p.status === 'ready') return 'That parcel has already reached ' + town + ': it waits there for the party.';
    if (p.status === 'collected') return 'That parcel has already been collected at ' + town + '.';
    if (p.status !== 'in_transit') return 'That parcel isn\'t on the road.';
    if (p.readyDay <= s.day) return 'That parcel reaches ' + town + ' today: it can\'t be recalled now.';
    return '';
  };
  /* When a recalled parcel would be home if recalled today. */
  R.parcelRecallDay = function (s, p) { return s.day + Math.max(1, s.day - dayNum(p.departDay, s.day)); };
  /* Returns { ok, parcel, log } or { ok: false, message }. */
  R.recallParcel = function (s, data, id) {
    var p = R.parcelById(s, id);
    var why = R.parcelRecallBlocker(s, p, data);
    if (why) return { ok: false, message: why };
    p.status = 'returning';
    p.recalledDay = s.day;
    p.returnDay = R.parcelRecallDay(s, p);
    return {
      ok: true, parcel: p,
      log: ['Courier', 'The parcel bound for ' + R.courierPointName(p.point) + ' was recalled and turned back for the Ironbow. It is home on ' + R.dayLabel(p.returnDay) +
        ', and its contents (' + R.parcelGoodsText(data, p.goods) + ') go back into the Warehouse then. The ' + clampInt(p.feeGP, 0) + ' gp fee isn\'t refunded.']
    };
  };

  /* ---------- The day's settlement (the 'trade' stage) ----------
     Parcels reaching their town become 'ready' (they wait there); recalled
     parcels coming home put their contents back into the Warehouse, once,
     and become 'returned'. Each parcel moves on in the same change as its
     goods, so with the one save that follows nothing happens twice. Closed
     parcels beyond keptClosed are trimmed (oldest first).
     Returns { changed, log: [[title, body]], word: [lines] }. */
  R.settleParcels = function (s, data) {
    var out = { changed: false, log: [], word: [] };
    R.parcels(s).forEach(function (p) {
      var town = R.courierPointName(p.point);
      if (p.status === 'in_transit' && p.readyDay <= s.day) {
        p.status = 'ready';
        p.arrivedDay = s.day;
        out.changed = true;
        out.log.push(['Courier', 'A parcel from the Ironbow has reached ' + town + ': ' + R.parcelGoodsText(data, p.goods) + '. It waits there until the party collects it.']);
        out.word.push('A parcel is waiting at ' + town + ' for the party to collect.');
      } else if (p.status === 'returning' && p.returnDay <= s.day) {
        R.returnGoods(s, data, p.goods);
        p.status = 'returned';
        out.changed = true;
        var line = 'The recalled parcel is back at the Ironbow; its contents (' + R.parcelGoodsText(data, p.goods) + ') are back in the Warehouse.';
        out.log.push(['Courier', line]);
        out.word.push(line);
      }
    });
    if (trimClosed(s, data)) out.changed = true;
    return out;
  };
  /* Keep the newest keptClosed closed parcels; never an open one. */
  function trimList(list, kept) {
    var closed = list.filter(function (p) { return OPEN.indexOf(p.status) === -1; });
    if (closed.length <= kept) return list;
    var drop = closed.slice(0, closed.length - kept);
    return list.filter(function (p) { return drop.indexOf(p) === -1; });
  }
  function trimClosed(s, data) {
    var all = R.parcels(s);
    var kept = trimList(all, keptClosed(data));
    if (kept.length === all.length) return false;
    tn(s).parcels = kept;
    return true;
  }

  /* ---------- A pickup from the Explorer (R.applyInbox calls this) ----------
     m: a 'parcel_collected' message that passed B.check. The Bastion's own
     parcel record decides: found by the parcel id in the message's id (an
     older Explorer may have dropped the message's parcel field).
     - waiting ('ready'): closed, 'collected', on the message's day;
     - still 'in_transit' (only a Bastion restored from an earlier moment,
       since the Explorer can only collect a parcel it read as waiting):
       closed the same way, so it never arrives or comes home as well;
     - already 'collected': nothing changes (held);
     - recalled ('returning' or 'returned'), or not there at all: refused,
       and nothing changes.
     The town in the message is only for showing: a different one is noted,
     never refused. from (optional): who sent it, for the log ("DM, Day 14").
     Returns { r: 'applied'|'refused', held, why, parcel, point, line (the
     log), notice (for the screen), word (for "The Ironbow sends word…") }. */
  R.collectParcel = function (s, data, m, from) {
    var B = bridge();
    var pid = B ? B.parcelIdOf(m && m.id) : '';
    if (!pid && m && typeof m.parcel === 'string') pid = m.parcel;
    var p = pid ? R.parcelById(s, pid) : null;
    var said = m && typeof m.point === 'string' ? m.point : '';
    if (!p) return { r: 'refused', held: false, parcel: pid, point: said, why: 'The Bastion has no record of this parcel (a save from another moment?). Nothing changed. Check both the Warehouse and the Travel bags.' };
    var town = R.courierPointName(p.point);
    var by = from ? ' (' + from + ')' : '';
    var res = { r: 'applied', held: false, parcel: p.id, point: p.point, why: '', line: '', notice: '', word: '' };
    if (p.status === 'collected') {
      res.held = true;
      res.line = 'Parcel collected at ' + town + by + ': it was already recorded as collected, so nothing changed.';
      return res;
    }
    if (p.status === 'returning' || p.status === 'returned') {
      return { r: 'refused', held: false, parcel: p.id, point: p.point, why: 'That parcel was recalled; its items were already on their way back to the Warehouse.' };
    }
    var early = p.status === 'in_transit';
    p.status = 'collected';
    p.collectedDay = dayNum(m.day, s.day);
    p.collectId = String(m.id);
    var notes = [];
    if (early) notes.push('The Bastion hadn\'t recorded its arrival yet (a save from an earlier moment?), so it is closed now and won\'t arrive or come home as well.');
    if (said && said !== p.point) notes.push('The Explorer named ' + R.courierPointName(said) + ', but the parcel was sent to ' + town + '.');
    res.notice = 'Collected at ' + town + ': ' + R.parcelGoodsText(data, p.goods) + ' (from the Explorer).';
    res.word = 'Parcel collected at ' + town + ': ' + R.parcelGoodsText(data, p.goods) + '.';
    res.line = 'Parcel collected at ' + town + by + ': ' + R.parcelGoodsText(data, p.goods) + '. The parcel is closed.' + (notes.length ? ' ' + notes.join(' ') : '');
    trimClosed(s, data);
    return res;
  };

  /* ---------- + Add supplies (Harry, 14 October 2026) ----------
     The DM adds supplies to the Warehouse by hand, for now: only the goods
     in courier-data.js manualAdd (never a trade good, so it can't make
     gold), 1 to 99 at a time, merged into the good's row and logged. */
  R.manualAddGoods = function (data) {
    var list = arr(courier(data).manualAdd) || [];
    return list.filter(function (id, i) {
      var g = typeof id === 'string' ? R.good(data, id) : null;
      return g && g.kind !== 'cargo' && list.indexOf(id) === i;
    }).map(function (id) { return { goodId: id, name: R.goodName(data, id) }; });
  };
  /* Returns { ok, log } or { ok: false, message }. */
  R.addSupplies = function (s, data, goodId, qty) {
    if (!R.manualAddGoods(data).some(function (g) { return g.goodId === goodId; })) return { ok: false, message: 'Only supplies on the list can be added by hand.' };
    var n = typeof qty === 'string' && qty.trim() ? Number(qty) : qty;
    if (!isWhole(n) || n < 1 || n > 99) return { ok: false, message: 'Add from 1 to 99 at a time.' };
    if (!arr(s.warehouse)) s.warehouse = [];
    R.addGoods(s, data, goodId, n, 'Added by hand');
    return { ok: true, log: ['Warehouse', 'Added by hand (DM): ' + R.goodsAmountText(data, goodId, n) + '.'] };
  };

  /* ---------- Saves: tidy each parcel, safe to run twice ---------- */
  function cleanGoods(list) {
    return (arr(list) || []).filter(function (x) { return isObj(x) && typeof x.goodId === 'string' && x.goodId && clampInt(x.qty, 0) > 0; })
      .map(function (x) { return { goodId: txt(x.goodId, 60), qty: clampInt(x.qty, 1, 9999) }; });
  }
  function dayOr(v, fallback) { return isNum(v) ? dayNum(v, fallback) : fallback; }
  /* A status from the saved one, or (if it's damaged) from what the record
     says happened: a pickup id means collected, a recall means on its way
     back, an arrival means waiting; otherwise still travelling. */
  function statusOf(p) {
    if (STATUSES.indexOf(p.status) !== -1) return p.status;
    if (typeof p.collectId === 'string' && p.collectId) return 'collected';
    if (isNum(p.recalledDay) || isNum(p.returnDay)) return 'returning';
    if (isNum(p.arrivedDay)) return 'ready';
    return 'in_transit';
  }
  /* The parcels, as saved. A parcel still travelling or waiting is never
     dropped (its goods are nowhere else), and keeps goods the data doesn't
     know (shown as they are). A record with no id or no town is dropped only
     if it couldn't hold goods (it's closed, or empty); otherwise it's kept,
     with a fixed id made from its place in the list (the same every time it
     loads), and an unknown town. Closed parcels beyond keptClosed go, oldest
     first. */
  R.cleanParcels = function (src, today, kept) {
    var list = (arr(src) || []).filter(isObj);
    var ids = {};
    list.forEach(function (p) { if (typeof p.id === 'string' && p.id) ids[txt(p.id, 40)] = true; });
    var out = [];
    list.forEach(function (p, i) {
      var status = statusOf(p);
      var goods = cleanGoods(p.goods);
      var hasId = typeof p.id === 'string' && p.id;
      var hasPoint = typeof p.point === 'string' && p.point;
      if ((!hasId || !hasPoint) && (OPEN.indexOf(status) === -1 || !goods.length)) return;
      var id = hasId ? txt(p.id, 40) : '';
      if (!id) {
        id = 'parcel-' + i;
        for (var n = 2; ids[id]; n++) id = 'parcel-' + i + '-' + n;
        ids[id] = true;
      }
      var depart = dayOr(p.departDay, today);
      var ready = Math.max(depart + 1, dayOr(p.readyDay, depart + 1));
      var arrived = status === 'ready' ? dayOr(p.arrivedDay, ready) : status === 'collected' && isNum(p.arrivedDay) ? dayNum(p.arrivedDay, ready) : null;
      var recalled = status === 'returning' || status === 'returned' ? Math.max(depart, dayOr(p.recalledDay, depart)) : null;
      var home = recalled !== null ? Math.max(recalled + 1, dayOr(p.returnDay, recalled + Math.max(1, recalled - depart))) : null;
      var items = isWhole(p.items) && p.items >= 0 ? Math.min(p.items, 100000) : goods.reduce(function (n2, x) { return n2 + x.qty; }, 0);
      out.push({
        id: id,
        point: hasPoint ? txt(p.point, 40) : '',
        goods: goods,
        items: items,
        departDay: depart,
        readyDay: ready,
        status: status,
        arrivedDay: arrived,
        collectedDay: status === 'collected' ? dayOr(p.collectedDay, arrived !== null ? arrived : ready) : null,
        collectId: status === 'collected' && typeof p.collectId === 'string' && p.collectId ? txt(p.collectId, 60) : null,
        recalledDay: recalled,
        returnDay: home,
        feeGP: clampInt(p.feeGP, 0, 100000)
      });
    });
    return trimList(out, Math.max(1, clampInt(kept === undefined ? 30 : kept, 1, 500)));
  };
  /* Every parcel in a loaded Bastion (R.fromSave calls this). */
  R.cleanCourier = function (d, data) {
    var t = tn(d);
    t.parcels = R.cleanParcels(t.parcels, d.day, keptClosed(data));
  };
  /* Reset Travel moves every parcel's days with the rest of the Bastion
     (R.shiftDays calls this). */
  R.shiftCourier = function (s, n) {
    var t = tn(s);
    var mv = function (obj, key) { if (obj && typeof obj[key] === 'number') obj[key] += n; };
    (arr(t.parcels) || []).forEach(function (p) {
      if (!isObj(p)) return;
      mv(p, 'departDay'); mv(p, 'readyDay'); mv(p, 'arrivedDay'); mv(p, 'collectedDay'); mv(p, 'recalledDay'); mv(p, 'returnDay');
    });
  };

  /* The Demolish question's extra sentence when parcels are still out, or ''. */
  R.courierDemolishNote = function (s) {
    var n = R.openParcels(s).length;
    if (!n) return '';
    return (n === 1 ? 'The parcel already sent carries on: it still arrives and can be collected (or, if it was recalled, still comes home), but it can no longer be recalled.'
      : 'The ' + n + ' parcels already sent carry on: they still arrive and can be collected (and recalled ones still come home), but they can no longer be recalled.');
  };
  /* The panel's first line: "Level 1: 1 parcel travelling at a time, up to
     5 items each. Reaches: Slade’s Muster." */
  R.courierStatusLine = function (s, data) {
    var spec = R.courierSpec(s, data);
    if (!spec.built) return 'The Courier Exchange isn\'t built.';
    var towns = R.courierPoints(s, data).map(function (p) { return p.label; });
    return 'Level ' + spec.level + ': ' + plural(spec.onRoad, 'parcel') + ' travelling at a time, up to ' + plural(spec.maxItems, 'item') + ' each. Reaches: ' + (towns.length ? towns.join(', ') : 'no town yet') + '.';
  };
}());
