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

   Levels 3 to 5 (Harry's rulings, 10 November 2026):
   - Level 3, Collect Expedition Cargo: a RETURN TRIP. At a town's courier post the DM sends items from the Travel bags to the Ironbow
     (a message from the Explorer, 'cargo_return'; R.receiveCargo). The parcel is 'inbound' (direction 'in') for that town's days at that
     town's fee, takes a travelling place, and on its arrival day its goods go into the Warehouse once and it is 'delivered'.
   - Level 4, Priority Courier: a Priority tick on a parcel (out or back): half the days (rounded up, at least minDays) and double the fee.
   - Level 5, Express Cargo Exchange: a COMBINED parcel: one trip, two towns. It is two linked parcels (the same combo id), each reaching its
     own town on its own days and collected on its own; it takes ONE travelling place, one fee (the dearer town's plus half the other's) and
     at most the level's items in all.
   More travelling places and room at every level (courier-data.js levels). A parcel also has, only when they apply: direction 'in',
   priority true, combo (its linked parcel's group id) and msgId (the Explorer message a return trip came from).

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
  var OPEN = ['in_transit', 'ready', 'returning', 'inbound'];
  var STATUSES = ['in_transit', 'ready', 'collected', 'returning', 'returned', 'inbound', 'delivered'];
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
  /* ---------- Rows typed into the Warehouse by hand (Harry, 20 October 2026) ----------
     A row with no goodId (a potion, a tool, a letter) can go in a parcel.
     Its identity is its row id, so two rows with the same name stay apart:
     the parcel's entry is { goodId: 'free:<row id>', name, qty }. The name
     is kept with the parcel (the row may be renamed or deleted after), and
     each count is 1 item. Trade lots, coin, ships and living creatures are
     never sent this way: they have their own rows or aren't rows at all,
     and a typed row is refused if its name says it is one of those. */
  var FREE = 'free:';
  R.FREE_PREFIX = FREE;
  R.isFreeGood = function (id) { return typeof id === 'string' && id.indexOf(FREE) === 0 && id.length > FREE.length; };
  function freeOn(data) { return courier(data).freeItems !== false; }
  /* A Warehouse row the courier could carry, or null. */
  function freeRow(s, id) {
    var rid = id.slice(FREE.length);
    var row = (s.warehouse || []).filter(function (w) { return isObj(w) && !w.goodId && typeof w.id === 'string' && w.id === rid; })[0];
    return row || null;
  }
  function freeName(row) { return String(row.item || '').trim().slice(0, 60); }
  R.freeRowBlocker = function (s, data, id) {
    if (!freeOn(data)) return 'Items typed into the Warehouse don\'t go by courier (courier-data.js).';
    var row = freeRow(s, id);
    if (!row) return 'That Warehouse item isn\'t there any more.';
    var name = freeName(row);
    if (!name) return 'A Warehouse item with no name can\'t be sent.';
    /* The empty Warehouse's own placeholder row isn't an item. */
    if (name === 'New Item' && !String(row.notes || '').trim() && (row.gp === '' || row.gp === undefined || row.gp === null)) return 'That is the Warehouse\'s empty placeholder row: rename it to send it.';
    return '';
  };
  /* The typed rows the courier could carry now: [{ goodId, name, size, have, free: true }]. */
  R.courierFreeRows = function (s, data) {
    if (!freeOn(data)) return [];
    return (s.warehouse || []).filter(function (w) {
      return isObj(w) && !w.goodId && typeof w.id === 'string' && w.id && clampInt(w.qty, 0) > 0 && freeName(w) && !R.freeRowBlocker(s, data, FREE + w.id);
    }).map(function (w) { return { goodId: FREE + w.id, name: freeName(w), size: 1, have: clampInt(w.qty, 0, 100000), free: true }; });
  };
  function sizeOf(data, goodId) {
    if (R.isFreeGood(goodId)) return 1;
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
    return R.courierGoods(data).map(function (g) { return Object.assign({}, g, { have: R.goodsQty(s, g.goodId) }); }).concat(R.courierFreeRows(s, data));
  };
  /* Take a parcel's goods out of the Warehouse, all or nothing: what was
     taken ([{ goodId, qty, name? }]), or null if anything is short. The
     named goods go through R.takeGoods; typed rows are counted down by row. */
  function takeParcelGoods(s, data, goods) {
    var plain = goods.filter(function (x) { return !R.isFreeGood(x.goodId); });
    var typed = goods.filter(function (x) { return R.isFreeGood(x.goodId); });
    for (var i = 0; i < typed.length; i++) {
      var row = freeRow(s, typed[i].goodId);
      if (!row || clampInt(row.qty, 0) < typed[i].qty) return null;
    }
    var got = plain.length ? R.takeGoods(s, data, plain.map(function (x) { return { good: x.goodId, qty: x.qty }; })) : [];
    if (!got) return null;
    var out = got.map(function (x) { return { goodId: x.goodId, qty: x.qty }; });
    typed.forEach(function (x) {
      var row = freeRow(s, x.goodId);
      row.qty = clampInt(row.qty, 0) - x.qty;
      out.push({ goodId: x.goodId, qty: x.qty, name: freeName(row) });
    });
    /* Keep the order the DM chose. */
    return goods.map(function (g) { return out.filter(function (o) { return o.goodId === g.goodId; })[0]; });
  }
  /* Put a recalled parcel's goods back, once: named goods into their row,
     typed goods into the row they came from (by id), or a new row with that
     id and the kept name if it has been deleted. */
  function returnParcelGoods(s, data, goods) {
    var plain = [];
    (goods || []).forEach(function (x) {
      if (!R.isFreeGood(x.goodId)) { plain.push(x); return; }
      var row = freeRow(s, x.goodId);
      if (row) row.qty = clampInt(row.qty, 0) + x.qty;
      else {
        if (!Array.isArray(s.warehouse)) s.warehouse = [];
        s.warehouse.push({ id: x.goodId.slice(FREE.length), item: txt(x.name, 60) || 'Returned item', qty: x.qty, gp: '', notes: 'Returned' });
      }
    });
    R.returnGoods(s, data, plain);
  }

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
      maxItems: row ? Math.floor(num(row.maxItems, 0, 1000, 0)) : 0,
      /* What the level can do besides sending a parcel out (10 November 2026). */
      returns: !!(row && row.returns === true),
      priority: !!(row && row.priority === true),
      combined: !!(row && row.combined === true)
    };
  };
  /* Priority (Level 4): the days are divided (rounded up, never fewer than minDays) and the fee multiplied. */
  R.priorityRule = function (data) {
    var p = isObj(courier(data).priority) ? courier(data).priority : {};
    return { divisor: Math.max(1, num(p.daysDivisor, 1, 100, 2)), multiplier: Math.max(1, num(p.feeMultiplier, 1, 100, 2)) };
  };
  /* A town's days and fee for a trip, with Priority or not. */
  R.pointDays = function (data, point, priority) {
    var d = point.days;
    if (priority === true) d = Math.ceil(d / R.priorityRule(data).divisor);
    return Math.max(minDays(data), d);
  };
  R.pointFee = function (data, point, priority) {
    return priority === true ? Math.ceil(point.feeGP * R.priorityRule(data).multiplier) : point.feeGP;
  };
  /* A combined parcel's one fee: the dearer leg's, plus a share (courier-data.js combined.feeShare, half) of the other's. */
  R.combinedFee = function (data, feeA, feeB) {
    var c = isObj(courier(data).combined) ? courier(data).combined : {};
    var share = isNum(c.feeShare) ? Math.max(0, Math.min(1, c.feeShare)) : 0.5;
    return Math.max(feeA, feeB) + Math.ceil(Math.min(feeA, feeB) * share);
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
  R.travellingParcels = function (s) { return R.parcels(s).filter(function (p) { return p.status === 'in_transit' || p.status === 'returning' || p.status === 'inbound'; }); };
  function endDayOf(p) { return p.status === 'returning' ? p.returnDay : p.readyDay; }
  /* The travelling places in use: a combined parcel's two legs share one place, which is free once both legs are done. [{ id, endDay }]. */
  R.travelGroups = function (s) {
    var groups = {}, order = [];
    R.travellingParcels(s).forEach(function (p) {
      var key = typeof p.combo === 'string' && p.combo ? 'c:' + p.combo : 'p:' + p.id;
      if (!groups[key]) { groups[key] = { id: key, endDay: null }; order.push(key); }
      var d = endDayOf(p);
      if (groups[key].endDay === null || d > groups[key].endDay) groups[key].endDay = d;
    });
    return order.map(function (k) { return groups[k]; });
  };
  /* Parcels not yet closed (travelling or waiting). */
  R.openParcels = function (s) { return R.parcels(s).filter(function (p) { return OPEN.indexOf(p.status) !== -1; }); };
  /* "3 Expedition Provision Packs, 1 Overland chart". */
  R.parcelGoodsText = function (data, goods) {
    return (goods || []).map(function (x) {
      return R.isFreeGood(x.goodId) ? x.qty + ' × ' + (txt(x.name, 60) || 'item') : R.goodsAmountText(data, x.goodId, x.qty);
    }).join(', ');
  };
  /* A parcel in plain words, for the panel. */
  R.parcelState = function (p) {
    var town = R.courierPointName(p.point);
    if (p.status === 'in_transit') return 'On the road to ' + town + ': arrives ' + R.dayLabel(p.readyDay);
    if (p.status === 'ready') return 'Waiting at ' + town + ' since ' + R.dayLabel(isNum(p.arrivedDay) ? p.arrivedDay : p.readyDay) + ', for the party to collect';
    if (p.status === 'inbound') return 'Cargo on the road from ' + town + ' to the Ironbow: arrives ' + R.dayLabel(p.readyDay) + (p.priority ? ' (Priority)' : '');
    if (p.status === 'delivered') return 'Cargo from ' + town + ' reached the Ironbow' + (isNum(p.arrivedDay) ? ' on ' + R.dayLabel(p.arrivedDay) : '') + ', its contents in the Warehouse';
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
    var out = R.travelGroups(s);
    if (out.length >= spec.onRoad) {
      var next = out.reduce(function (m, g) {
        var d = g.endDay;
        return m === null || d < m ? d : m;
      }, null);
      return (spec.onRoad === 1 ? 'A parcel is already travelling' : 'All ' + spec.onRoad + ' travelling places are taken') +
        (next !== null ? ': the first place is free on ' + R.dayLabel(next) + '.' : '.');
    }
    if (!R.courierPoints(s, data).length) return 'The Courier Exchange reaches no town yet (courier-data.js).';
    var stock = R.courierStock(s, data);
    if (!stock.some(function (g) { return g.have > 0; })) {
      /* The first two by name, then "and the Temple's items" (pull request 8b). */
      var names = stock.slice(0, 2).map(function (g) { var x = R.good(data, g.goodId); return x && x.kind === 'supply' ? (typeof x.plural === 'string' && x.plural ? x.plural : g.name + 's') : g.name; });
      var more = stock.length > 2 ? ' and the Temple\'s items' : '';
      return 'The Warehouse has nothing the courier carries' + (names.length ? ' (' + names.join(', ') + more + ')' : '') + '.';
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
  R.parcelProblem = function (s, data, pointId, picks, opts) {
    var why = R.parcelBlocker(s, data);
    if (why) return why;
    var B = bridge();
    var priority = !!(opts && opts.priority === true);
    if (priority && !R.courierSpec(s, data).priority) return 'Priority needs the Courier Exchange at the level that opens the Priority Courier (it\'s Level ' + R.courierSpec(s, data).level + ').';
    var point = R.courierPoint(data, pointId);
    if (!point) return (B && B.isPoint(pointId) ? R.courierPointName(pointId) + ' has no courier days or fee yet (courier-data.js).' : 'Choose a town the courier knows.');
    var spec = R.courierSpec(s, data);
    if (point.level > spec.level) return point.label + ' needs the Courier Exchange at Level ' + point.level + ' (it\'s Level ' + spec.level + ').';
    var goods = mergePicks(picks);
    for (var i = 0; i < goods.length; i++) {
      var bad = R.isFreeGood(goods[i].goodId) ? R.freeRowBlocker(s, data, goods[i].goodId) : R.courierGoodBlocker(data, goods[i].goodId);
      if (bad) return bad;
    }
    var items = R.parcelItems(data, goods);
    if (items < 1) return 'Choose at least 1 item to send.';
    if (items > spec.maxItems) return 'That\'s ' + plural(items, 'item') + ': a parcel from a Level ' + spec.level + ' Courier Exchange holds up to ' + plural(spec.maxItems, 'item') + '.';
    var short = R.inputsShort(s, data, goods.filter(function (x) { return !R.isFreeGood(x.goodId); }).map(function (x) { return { good: x.goodId, qty: x.qty }; }));
    if (short) return short.message;
    for (var k = 0; k < goods.length; k++) {
      if (!R.isFreeGood(goods[k].goodId)) continue;
      var frow = freeRow(s, goods[k].goodId);
      if (clampInt(frow.qty, 0) < goods[k].qty) return 'Needs ' + goods[k].qty + ' × ' + freeName(frow) + ' in the Warehouse; it has ' + clampInt(frow.qty, 0) + '.';
    }
    var gold = clampInt(s.treasuryGP, 0);
    var fee = R.pointFee(data, point, priority);
    if (gold < fee) return 'Sending a parcel to ' + point.label + ' costs ' + fee + ' gp' + (priority ? ' (Priority)' : '') + '; the treasury has ' + gold + ' gp.';
    return '';
  };

  /* A one-line summary of a draft parcel, for the Send pop-up: "3 items of
     5 · fee 5 gp · leaves today, reaches Slade’s Muster on Day 14 and waits
     there until the party collects it." */
  R.parcelSummary = function (s, data, pointId, picks, opts) {
    var spec = R.courierSpec(s, data);
    var items = R.parcelItems(data, mergePicks(picks));
    var point = R.courierPoint(data, pointId);
    var priority = !!(opts && opts.priority === true);
    var head = plural(items, 'item') + ' of ' + spec.maxItems;
    if (!point) return head + ' · choose a town.';
    var days = R.pointDays(data, point, priority);
    return head + ' · fee ' + R.pointFee(data, point, priority) + ' gp' + (priority ? ' (Priority)' : '') + ' · leaves today, reaches ' + point.label + ' on ' + R.dayLabel(s.day + days) + ' and waits there until the party collects it.';
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
  R.sendParcel = function (s, data, pointId, picks, rand, explorerSave, opts) {
    var why = R.parcelProblem(s, data, pointId, picks, opts);
    if (why) return { ok: false, message: why };
    var point = R.courierPoint(data, pointId);
    var priority = !!(opts && opts.priority === true);
    var days = R.pointDays(data, point, priority);
    var fee = R.pointFee(data, point, priority);
    var goods = mergePicks(picks);
    var taken = takeParcelGoods(s, data, goods);
    if (!taken) return { ok: false, message: 'The Warehouse doesn\'t have those supplies.' };
    s.treasuryGP = clampInt(s.treasuryGP, 0) - fee;
    var p = {
      id: uniqueId(s, rand, explorerSave),
      point: point.id,
      goods: taken.map(function (x) { return R.isFreeGood(x.goodId) ? { goodId: x.goodId, qty: x.qty, name: x.name } : { goodId: x.goodId, qty: x.qty }; }),
      items: R.parcelItems(data, taken),
      departDay: s.day,
      readyDay: s.day + days,
      status: 'in_transit',
      arrivedDay: null,
      collectedDay: null,
      collectId: null,
      recalledDay: null,
      returnDay: null,
      feeGP: fee
    };
    if (priority) p.priority = true;
    R.parcels(s).push(p);
    return {
      ok: true, parcel: p,
      log: ['Courier', 'A ' + (priority ? 'Priority ' : '') + 'parcel left for ' + point.label + ': ' + R.parcelGoodsText(data, p.goods) + ', from the Warehouse (fee ' + fee + ' gp from the treasury). It reaches ' + point.label + ' on ' + R.dayLabel(p.readyDay) + ' and waits there until the party collects it.']
    };
  };

  /* ---------- A combined parcel (Level 5, the Express Cargo Exchange) ----------
     legs: [{ point, picks }, { point, picks }]: two different towns, each with its own goods. It is two linked parcels (the same combo id)
     taking one travelling place, with one fee, and at most the level's items in all. Each leg arrives on its own days and is collected on
     its own. Returns the first problem as a sentence, or ''. */
  R.combinedProblem = function (s, data, legs, opts) {
    var spec = R.courierSpec(s, data);
    var why = R.parcelBlocker(s, data);
    if (why) return why;
    if (!spec.combined) return 'A combined parcel needs the Courier Exchange at the level that opens the Express Cargo Exchange (it\'s Level ' + spec.level + ').';
    var priority = !!(opts && opts.priority === true);
    if (priority && !spec.priority) return 'Priority needs a higher Courier Exchange level.';
    if (!arr(legs) || legs.length !== 2) return 'A combined parcel goes to two towns.';
    if (!legs[0] || !legs[1] || legs[0].point === legs[1].point) return 'Choose two different towns.';
    var fees = [], total = 0, merged = [];
    for (var i = 0; i < 2; i++) {
      var point = R.courierPoint(data, legs[i].point);
      if (!point) return 'Choose a town the courier knows.';
      if (point.level > spec.level) return point.label + ' needs the Courier Exchange at Level ' + point.level + ' (it\'s Level ' + spec.level + ').';
      var goods = mergePicks(legs[i].picks);
      for (var k = 0; k < goods.length; k++) {
        var bad = R.isFreeGood(goods[k].goodId) ? R.freeRowBlocker(s, data, goods[k].goodId) : R.courierGoodBlocker(data, goods[k].goodId);
        if (bad) return bad;
      }
      var items = R.parcelItems(data, goods);
      if (items < 1) return 'Choose at least 1 item to send to ' + point.label + '.';
      total += items;
      fees.push(R.pointFee(data, point, priority));
      goods.forEach(function (g) {
        var have = merged.filter(function (m) { return m.goodId === g.goodId; })[0];
        if (have) have.qty += g.qty; else merged.push({ goodId: g.goodId, qty: g.qty });
      });
    }
    if (total > spec.maxItems) return 'That\'s ' + plural(total, 'item') + ' in all: a combined parcel from a Level ' + spec.level + ' Courier Exchange holds up to ' + plural(spec.maxItems, 'item') + '.';
    var short = R.inputsShort(s, data, merged.filter(function (x) { return !R.isFreeGood(x.goodId); }).map(function (x) { return { good: x.goodId, qty: x.qty }; }));
    if (short) return short.message;
    for (var j = 0; j < merged.length; j++) {
      if (!R.isFreeGood(merged[j].goodId)) continue;
      var frow = freeRow(s, merged[j].goodId);
      if (clampInt(frow && frow.qty, 0) < merged[j].qty) return 'Needs ' + merged[j].qty + ' × ' + (frow ? freeName(frow) : 'that item') + ' in the Warehouse; it has ' + clampInt(frow && frow.qty, 0) + '.';
    }
    var fee = R.combinedFee(data, fees[0], fees[1]);
    var gold = clampInt(s.treasuryGP, 0);
    if (gold < fee) return 'A combined parcel to ' + R.courierPointName(legs[0].point) + ' and ' + R.courierPointName(legs[1].point) + ' costs ' + fee + ' gp' + (priority ? ' (Priority)' : '') + '; the treasury has ' + gold + ' gp.';
    return '';
  };
  R.combinedSummary = function (s, data, legs, opts) {
    var spec = R.courierSpec(s, data);
    var priority = !!(opts && opts.priority === true);
    var a = R.courierPoint(data, legs && legs[0] && legs[0].point), b = R.courierPoint(data, legs && legs[1] && legs[1].point);
    var items = (legs || []).reduce(function (n, l) { return n + R.parcelItems(data, mergePicks(l && l.picks)); }, 0);
    var head = plural(items, 'item') + ' of ' + spec.maxItems + ' in all';
    if (!a || !b) return head + ' · choose two towns.';
    var fee = R.combinedFee(data, R.pointFee(data, a, priority), R.pointFee(data, b, priority));
    return head + ' · one fee ' + fee + ' gp' + (priority ? ' (Priority)' : '') + ' · leaves today, reaches ' + a.label + ' on ' + R.dayLabel(s.day + R.pointDays(data, a, priority)) + ' and ' + b.label + ' on ' + R.dayLabel(s.day + R.pointDays(data, b, priority)) + '.';
  };
  /* Send it: both legs, one fee, one place. Returns { ok, parcels: [leg, leg], log } or { ok: false, message }. */
  R.sendCombined = function (s, data, legs, rand, explorerSave, opts) {
    var why = R.combinedProblem(s, data, legs, opts);
    if (why) return { ok: false, message: why };
    var priority = !!(opts && opts.priority === true);
    var merged = [];
    legs.forEach(function (l) { mergePicks(l.picks).forEach(function (g) {
      var have = merged.filter(function (m) { return m.goodId === g.goodId; })[0];
      if (have) have.qty += g.qty; else merged.push({ goodId: g.goodId, qty: g.qty });
    }); });
    var taken = takeParcelGoods(s, data, merged);
    if (!taken) return { ok: false, message: 'The Warehouse doesn\'t have those supplies.' };
    var names = {};
    taken.forEach(function (x) { if (x && x.name) names[x.goodId] = x.name; });
    var points = legs.map(function (l) { return R.courierPoint(data, l.point); });
    var fees = points.map(function (p) { return R.pointFee(data, p, priority); });
    var fee = R.combinedFee(data, fees[0], fees[1]);
    s.treasuryGP = clampInt(s.treasuryGP, 0) - fee;
    var made = [];
    legs.forEach(function (l, i) {
      var goods = mergePicks(l.picks).map(function (g) { return R.isFreeGood(g.goodId) ? { goodId: g.goodId, qty: g.qty, name: names[g.goodId] || 'Item' } : { goodId: g.goodId, qty: g.qty }; });
      var days = R.pointDays(data, points[i], priority);
      var p = {
        id: uniqueId(s, rand, explorerSave), point: points[i].id, goods: goods, items: R.parcelItems(data, goods),
        departDay: s.day, readyDay: s.day + days, status: 'in_transit', arrivedDay: null, collectedDay: null, collectId: null,
        recalledDay: null, returnDay: null, feeGP: i === 0 ? fee : 0
      };
      if (priority) p.priority = true;
      R.parcels(s).push(p);
      made.push(p);
    });
    made.forEach(function (p) { p.combo = made[0].id; });
    return {
      ok: true, parcels: made,
      log: ['Courier', 'A combined ' + (priority ? 'Priority ' : '') + 'parcel left for ' + points[0].label + ' (' + R.parcelGoodsText(data, made[0].goods) + ') and ' + points[1].label + ' (' + R.parcelGoodsText(data, made[1].goods) +
        '), on one fee of ' + fee + ' gp from the treasury. It reaches ' + points[0].label + ' on ' + R.dayLabel(made[0].readyDay) + ' and ' + points[1].label + ' on ' + R.dayLabel(made[1].readyDay) + ', and each waits there until the party collects it.']
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
    if (p.status === 'inbound') return 'That cargo is already on its way from ' + town + ' to the Ironbow: it can\'t be recalled.';
    if (p.status === 'delivered') return 'That cargo has already reached the Ironbow.';
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
      } else if (p.status === 'inbound' && p.readyDay <= s.day) {
        /* Cargo the party sent home from a town (Level 3): its goods go into the Warehouse, once. */
        deliverCargo(s, data, p.goods, town);
        p.status = 'delivered';
        p.arrivedDay = s.day;
        out.changed = true;
        var cline = 'Cargo from ' + town + ' has reached the Ironbow: ' + R.parcelGoodsText(data, p.goods) + ' (now in the Warehouse).';
        out.log.push(['Courier', cline]);
        out.word.push(cline);
      } else if (p.status === 'returning' && p.returnDay <= s.day) {
        returnParcelGoods(s, data, p.goods);
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
  /* Cargo arriving from the party: named goods go into their rows; a typed item (or a good this copy does not know) into a typed row. */
  function deliverCargo(s, data, goods, town) {
    (goods || []).forEach(function (x) {
      if (R.isFreeGood(x.goodId)) { R.appendToWarehouse(s, txt(x.name, 60) || 'Item', x.qty, '', 'From ' + town); return; }
      if (R.good(data, x.goodId)) R.addGoods(s, data, x.goodId, x.qty, 'From ' + town);
      else R.appendToWarehouse(s, String(x.goodId).replace(/_/g, ' '), x.qty, '', 'From ' + town);
    });
  }
  /* ---------- Cargo sent home by the party (Level 3; R.applyInbox calls this) ----------
     m: a 'cargo_return' message that passed B.check: { id, day, point, goods, priority }. The items already left the Travel bags in the
     Explorer's save, so the Bastion ALWAYS takes it (it never loses the party's goods): the parcel is recorded 'inbound', the fee comes from the
     treasury (never below 0) and it takes a travelling place. The Explorer asked the Bastion's save before sending, so a missing Courier
     Exchange or a full road is only possible after a change in between; if so it is noted, never refused. Held once by the message's id.
     Returns { r: 'applied'|'refused', held, why, parcel, line, notice, word }. */
  R.receiveCargo = function (s, data, m, from) {
    var B = bridge();
    var uid = B && typeof m.id === 'string' ? m.id.split(':')[0] : '';
    var by = from ? ' (' + from + ')' : '';
    var existing = R.parcels(s).filter(function (p) { return p.msgId === m.id; })[0];
    if (existing) return { r: 'applied', held: true, why: '', parcel: existing.id, point: existing.point, line: 'Cargo from ' + R.courierPointName(existing.point) + by + ': the Bastion already held it, so nothing changed.', notice: '', word: '' };
    var point = R.courierPoint(data, m.point);
    if (!point) return { r: 'refused', held: false, why: 'It names a town the courier has no days or fee for. Nothing changed; the items are in the Travel bags.', parcel: '', point: txt(m.point, 40) };
    var goods = cleanGoods(m.goods);
    if (!goods.length) return { r: 'refused', held: false, why: 'It carries nothing.', parcel: '', point: point.id };
    var priority = m.priority === true;
    var days = R.pointDays(data, point, priority);
    var fee = R.pointFee(data, point, priority);
    var spec = R.courierSpec(s, data);
    var notes = [];
    if (!spec.built) notes.push('The Courier Exchange isn\'t standing now, but the cargo is taken anyway.');
    var gold = clampInt(s.treasuryGP, 0);
    if (gold < fee) notes.push('The treasury had only ' + gold + ' gp for the ' + fee + ' gp fee, so it is now empty.');
    s.treasuryGP = Math.max(0, gold - fee);
    var id = uid && B.UID_PATTERN.test(uid) && !R.parcelById(s, uid) ? uid : uniqueId(s, null, null);
    var depart = dayNum(m.day, s.day);
    var p = {
      id: id, point: point.id, goods: goods, items: R.parcelItems(data, goods), departDay: depart, readyDay: depart + days, status: 'inbound',
      arrivedDay: null, collectedDay: null, collectId: null, recalledDay: null, returnDay: null, feeGP: fee, direction: 'in'
    };
    if (priority) p.priority = true;
    p.msgId = String(m.id);
    R.parcels(s).push(p);
    var what = R.parcelGoodsText(data, goods);
    return {
      r: 'applied', held: false, why: '', parcel: p.id, point: point.id,
      line: (priority ? 'Priority cargo' : 'Cargo') + ' sent home from ' + point.label + by + ': ' + what + '. Fee ' + fee + ' gp; it reaches the Ironbow on ' + R.dayLabel(p.readyDay) + ', and its contents go into the Warehouse then.' + (notes.length ? ' ' + notes.join(' ') : ''),
      notice: 'Cargo is on its way from ' + point.label + ': ' + what + ' (arrives ' + R.dayLabel(p.readyDay) + ').',
      word: 'Cargo is on its way from ' + point.label + ' to the Ironbow: ' + what + '.'
    };
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
      .map(function (x) {
        var g = { goodId: txt(x.goodId, 60), qty: clampInt(x.qty, 1, 9999) };
        if (R.isFreeGood(g.goodId)) g.name = txt(typeof x.name === 'string' ? x.name.trim() : '', 60) || 'Item';
        return g;
      });
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
      var arrived = status === 'ready' || status === 'delivered' ? dayOr(p.arrivedDay, ready) : status === 'collected' && isNum(p.arrivedDay) ? dayNum(p.arrivedDay, ready) : null;
      var recalled = status === 'returning' || status === 'returned' ? Math.max(depart, dayOr(p.recalledDay, depart)) : null;
      var home = recalled !== null ? Math.max(recalled + 1, dayOr(p.returnDay, recalled + Math.max(1, recalled - depart))) : null;
      var items = isWhole(p.items) && p.items >= 0 ? Math.min(p.items, 100000) : goods.reduce(function (n2, x) { return n2 + x.qty; }, 0);
      var rec = {
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
      };
      /* Only when they apply (10 November 2026): cargo sent home (direction 'in'), Priority, a combined parcel's group, the message it came from. */
      if (p.direction === 'in' || status === 'inbound' || status === 'delivered') rec.direction = 'in';
      if (p.priority === true) rec.priority = true;
      if (typeof p.combo === 'string' && p.combo) rec.combo = txt(p.combo, 40);
      if (typeof p.msgId === 'string' && p.msgId) rec.msgId = txt(p.msgId, 80);
      out.push(rec);
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
  /* What the Explorer needs to send cargo home (Level 3), saved with the Bastion (tool.js save()): the Explorer can't read the Bastion's rules,
     so this is a plain summary of them as of the last save. { built, level, repairUntil, returns, priority, onRoad, groups: [endDay...],
     maxItems, treasuryGP, day, priorityRule: { divisor, multiplier }, points: { id: { days, feeGP } } } (a town the level reaches). */
  R.courierDesk = function (s, data) {
    var spec = R.courierSpec(s, data);
    var pr = R.priorityRule(data);
    var points = {};
    R.courierPoints(s, data).forEach(function (p) { points[p.id] = { days: p.days, feeGP: p.feeGP }; });
    return {
      built: spec.built, level: spec.level, repairUntil: R.underRepair(s, FAC), returns: spec.returns, priority: spec.priority,
      onRoad: spec.onRoad, groups: R.travelGroups(s).map(function (g) { return g.endDay; }), maxItems: spec.maxItems,
      treasuryGP: clampInt(s.treasuryGP, 0), day: dayNum(s.day, 1), minDays: minDays(data), priorityRule: { divisor: pr.divisor, multiplier: pr.multiplier }, points: points
    };
  };
  R.courierStatusLine = function (s, data) {
    var spec = R.courierSpec(s, data);
    if (!spec.built) return 'The Courier Exchange isn\'t built.';
    var towns = R.courierPoints(s, data).map(function (p) { return p.label; });
    return 'Level ' + spec.level + ': ' + plural(spec.onRoad, 'parcel') + ' travelling at a time, up to ' + plural(spec.maxItems, 'item') + ' each. Reaches: ' + (towns.length ? towns.join(', ') : 'no town yet') + '.';
  };
}());
