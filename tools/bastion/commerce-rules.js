/* The Ironbow Bastion Manager — commodity trade and Port Charters (pull
   request 5 of the facilities overhaul; Harry's answers, 14 October 2026).
   Plain functions (no screen code), tested on tests/rules.html. They add to
   the Bastion's rules (tools/bastion/rules.js), as war-campaign-rules.js does.

   How it fits together:
   - Port Charters. The DM grants one in the Explorer; the Explorer link
     carries it (shared/js/bridge-rules.js) and the Bastion holds it once,
     'earned' (R.addCharter, from R.applyInbox). A 3-day "Register Port
     Charter" order at the Hall of Emissaries (Level 2) makes it
     'registered'. Only a registered Charter takes cargo.
   - Cargo. The Dock (Level 2 or higher) sends a ship with real Warehouse
     lots to a port with a registered Charter. The lots leave the Warehouse
     when it sails, and are held by the voyage (tradeNetwork.voyages). The
     ship reaches the port after the route's outDays, and is home after its
     backDays more; until then it can't sail again.
   - On arrival the Bastion rolls the voyage's risk by itself (no roll for
     the DM). Most voyages sell: the price is worked out then (base value ×
     the Clan's demand × the Charter's price factor, less the fee and the
     tariff), paid into the treasury once, and recorded (cargoSales). If
     something goes wrong, nothing sells: the ship turns back with the
     cargo, which goes back into the Warehouse when the ship is home.
   - Standing shipments (Dock Level 4): the same cargo, every 7 days, when a
     ship, the goods and the room are there; otherwise they wait.
   Everything is settled in the day's 'trade' stage, after the old sea
   routes and before the orders, in the same save as the stage moving on
   (tools/bastion/tool.js runDay), so nothing is paid or returned twice.

   Two kinds of route, kept apart (Harry, 14 October 2026):
   - legacy_abstract: the Hall's old trade (Trade Agreements, the Trade
     Consortium's sea routes in tradeNetwork.routes), unchanged: it pays a
     fixed income and never carries goods;
   - commodity_backed: a Port Charter's route, which only ever carries
     goods that were really made.

   The new records live inside the Bastion save's tradeNetwork:
   portCharters, voyages, schedules, cargoSales and protections. Every
   number comes from data/commerce-data.js (data.commerce). Dice come in as
   rand(), as in the rest of the Bastion's rules. */
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
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function bridge() { return TSI.bridge || null; }

  R.ROUTE_MODES = { legacy: 'legacy_abstract', cargo: 'commodity_backed' };
  var STATUSES = ['earned', 'registered'];
  var STAGES = ['outbound', 'returning'];
  var OUTCOMES = ['sold', 'turned_back'];
  var DEFAULT_LEVELS = {
    high: { label: 'Highly sought-after', mult: 1.25 },
    moderate: { label: 'Moderate', mult: 1.10 },
    normal: { label: 'Normal', mult: 1.00 },
    oversupplied: { label: 'Oversupplied', mult: 0.75 }
  };

  /* ---------- The trade data, with safe defaults ---------- */
  function commerce(data) { return data && isObj(data.commerce) ? data.commerce : {}; }
  R.commerce = commerce;
  function levels(data) { var l = commerce(data).demandLevels; return isObj(l) ? l : DEFAULT_LEVELS; }
  /* A whole number from the data within limits, or the fallback. */
  function num(v, min, max, fallback) { return isNum(v) ? Math.max(min, Math.min(max, v)) : fallback; }

  /* The Dock's cargo room at its level: { level, lots, ships, schedule }. */
  R.dockSpec = function (s, data) {
    var built = R.builtFacilityIds(s, data).indexOf('dock') !== -1;
    var level = built ? R.getFacilityLevel(s, 'dock') : 0;
    var table = isObj(commerce(data).dock) ? commerce(data).dock : {};
    var row = isObj(table[level]) ? table[level] : {};
    return {
      level: level,
      lots: built ? Math.floor(num(row.lots, 0, 100, 0)) : 0,
      ships: built ? Math.floor(num(row.ships, 0, 10, 0)) : 0,
      schedule: built && row.schedule === true
    };
  };
  /* The lowest Dock level that can send cargo (or set up standing
     shipments, with 'schedule'), or 0 if none can. */
  R.dockLevelFor = function (data, what) {
    var table = isObj(commerce(data).dock) ? commerce(data).dock : {};
    for (var lv = 1; lv <= R.MAX_LEVEL; lv++) {
      var row = isObj(table[lv]) ? table[lv] : {};
      if (what === 'schedule' ? row.schedule === true : num(row.lots, 0, 100, 0) >= 1 && num(row.ships, 0, 10, 0) >= 1) return lv;
    }
    return 0;
  };

  /* A port's route: { outDays, backDays, risk, riskLabel, pct } or null if
     the port has no route in commerce-data.js. */
  R.portRoute = function (data, port) {
    var routes = isObj(commerce(data).routes) ? commerce(data).routes : {};
    var r = isObj(routes[port]) ? routes[port] : null;
    if (!r) return null;
    var risks = isObj(commerce(data).risks) ? commerce(data).risks : {};
    var risk = typeof r.risk === 'string' && isObj(risks[r.risk]) ? r.risk : 'low';
    var rk = isObj(risks[risk]) ? risks[risk] : { label: 'Low', pct: 5 };
    return {
      outDays: Math.floor(num(r.outDays, 1, 365, 7)),
      backDays: Math.floor(num(r.backDays, 0, 365, 7)),
      risk: risk,
      riskLabel: typeof rk.label === 'string' ? rk.label : risk,
      pct: Math.floor(num(rk.pct, 0, 100, 0)),
      feePerLot: isNum(r.feePerLot) ? Math.max(0, r.feePerLot) : null,
      tariffPct: isNum(r.tariffPct) ? Math.max(0, Math.min(100, r.tariffPct)) : null
    };
  };
  R.portName = function (port) { var B = bridge(); return B ? B.portLabel(port) : String(port || ''); };
  /* "Goldport (Clan Molten)". */
  R.portWithClan = function (data, port, clan) {
    var name = R.clanName(data, clan);
    return R.portName(port) + (name ? ' (Clan ' + name + ')' : '');
  };
  R.clanName = function (data, key) {
    var list = (data && data.bastion && data.bastion.clans) || [];
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i].name;
    var B = bridge();
    return key ? (B ? B.clanName(key) : key) : '';
  };

  /* How much the buying Clan wants a good: { level, label, mult }. A good's
     own entry wins over its kind's; anything not listed is Normal. */
  R.demandFor = function (data, clan, goodId) {
    var lv = levels(data);
    var table = isObj(commerce(data).demand) ? commerce(data).demand : {};
    var row = isObj(table[clan]) ? table[clan] : {};
    var g = R.good(data, goodId);
    var key = 'normal';
    if (typeof row[goodId] === 'string' && isObj(lv[row[goodId]])) key = row[goodId];
    else if (g && g.cat && typeof row[g.cat] === 'string' && isObj(lv[row[g.cat]])) key = row[g.cat];
    var l = isObj(lv[key]) ? lv[key] : { label: 'Normal', mult: 1 };
    return { level: key, label: typeof l.label === 'string' ? l.label : key, mult: num(l.mult, 0, 10, 1) };
  };

  /* Can this good go to sea on this route? '' or the reason it can't. */
  R.goodShipBlocker = function (data, goodId, route) {
    var g = R.good(data, goodId);
    if (!g) return 'That isn\'t a good the Bastion knows.';
    if (g.kind !== 'cargo') return g.name + ' isn\'t a trade good (ingredients and supplies don\'t sail).';
    var keep = isObj(commerce(data).maxDaysAtSea) ? commerce(data).maxDaysAtSea : {};
    if (isNum(keep[goodId])) {
      var max = Math.max(0, Math.floor(keep[goodId]));
      if (max === 0) return g.name + ' is for the local market: it isn\'t shipped.';
      if (route && route.outDays > max) return g.name + ' only keeps for ' + plural(max, 'day') + ' at sea, and this voyage takes ' + plural(route.outDays, 'day') + '.';
    }
    return '';
  };

  /* ---------- Port Charters ---------- */
  function tn(s) {
    if (!isObj(s.tradeNetwork)) s.tradeNetwork = R.defaultTradeNetwork();
    return s.tradeNetwork;
  }
  function list(s, key) {
    var t = tn(s);
    if (!arr(t[key])) t[key] = [];
    return t[key];
  }
  R.portCharters = function (s) { return list(s, 'portCharters'); };
  R.charterFor = function (s, port) { return R.portCharters(s).filter(function (c) { return c.port === port; })[0] || null; };
  R.charterById = function (s, id) { return R.portCharters(s).filter(function (c) { return c.id === id; })[0] || null; };
  R.charterLabel = function (data, c) { return R.portWithClan(data, c.port, c.clan); };
  /* The Hall's Register order for this Charter, if one is pending. */
  R.registerOrderFor = function (s, charterId) {
    return (s.pendingOrders || []).filter(function (o) {
      return isObj(o) && o.fnId === 'register_port_charter' && isObj(o.chosen) && o.chosen.charterId === charterId;
    })[0] || null;
  };
  /* Charters the Hall can register now: earned, and not being registered. */
  R.registrableCharters = function (s) {
    return R.portCharters(s).filter(function (c) { return c.status === 'earned' && !R.registerOrderFor(s, c.id); });
  };
  /* The Hall registers one Charter at a time: why another can't start now,
     or ''. */
  R.registerBusy = function (s, data) {
    var o = (s.pendingOrders || []).filter(function (x) { return isObj(x) && x.fnId === 'register_port_charter'; })[0];
    if (!o) return '';
    var c = isObj(o.chosen) ? R.charterById(s, o.chosen.charterId) : null;
    return 'The Hall registers one Port Charter at a time: ' + (c ? R.portName(c.port) + '\'s' : 'one') + ' is ready on ' + R.dayLabel(o.dueDay) + '.';
  };
  R.registeredCharters = function (s) { return R.portCharters(s).filter(function (c) { return c.status === 'registered'; }); };
  /* A Charter's state in plain words: "Registered on Day 12", "Being
     registered at the Hall (ready Day 12)", "Earned on Day 9: register it
     at the Hall of Emissaries". */
  R.charterState = function (s, c) {
    if (c.status === 'registered') return 'Registered' + (isNum(c.registeredDay) ? ' on ' + R.dayLabel(c.registeredDay) : '');
    var o = R.registerOrderFor(s, c.id);
    if (o) return 'Being registered at the Hall of Emissaries (ready ' + R.dayLabel(o.dueDay) + ')';
    return 'Earned' + (isNum(c.earnedDay) ? ' on ' + R.dayLabel(c.earnedDay) : '') + ': register it at the Hall of Emissaries';
  };

  /* A Port Charter message from the Explorer (already checked by the
     link's B.check). One Charter per port: a second for a port already
     held changes nothing. Returns { added, charter }. */
  R.addCharter = function (s, m, day) {
    var have = R.charterFor(s, m.port);
    if (have) return { added: false, charter: have };
    var c = {
      id: String(m.id),
      port: String(m.port),
      clan: String(m.clan),
      mode: R.ROUTE_MODES.cargo,
      status: 'earned',
      earnedDay: dayNum(m.day, dayNum(day, 1)),
      registeredDay: null,
      /* Negotiated concessions (none yet): priceMult, feePerLot, tariffPct. */
      terms: {},
      from: { code: txt(m.from && m.from.code, 20), title: txt(m.from && m.from.title, 80) },
      text: txt(m.text, 200)
    };
    R.portCharters(s).push(c);
    return { added: true, charter: c };
  };

  /* The Hall's Register order completing: the Charter becomes registered,
     once. Returns a log line [title, body]. */
  R.completeCharterRegistration = function (s, data, order) {
    var id = isObj(order.chosen) ? order.chosen.charterId : null;
    var c = id ? R.charterById(s, id) : null;
    var lab = order.label || 'Register Port Charter';
    if (!c) return ['Port Charter', lab + ': the Port Charter isn\'t held any more, so nothing changed.'];
    if (c.status === 'registered') return ['Port Charter', lab + ': the Port Charter for ' + R.charterLabel(data, c) + ' was already registered' + (isNum(c.registeredDay) ? ' on ' + R.dayLabel(c.registeredDay) : '') + ', so nothing changed.'];
    c.status = 'registered';
    c.registeredDay = s.day;
    var need = R.dockLevelFor(data, 'ship');
    return ['Order Completed', lab + ' → The Port Charter for ' + R.charterLabel(data, c) + ' is registered. The Dock can ship cargo there' + (need > 1 ? ' from Level ' + need : '') + '.'];
  };

  /* ---------- Voyage risk and its protections ---------- */
  /* The protections a voyage sailing now gets (applied by themselves):
     each one available in the data and ready in the Bastion (charges left,
     or until a day not yet passed). None is available yet. */
  R.voyageProtections = function (s, data) {
    var ready = isObj(tn(s).protections) ? tn(s).protections : {};
    return (arr(commerce(data).protections) || []).filter(function (p) {
      if (!isObj(p) || p.available !== true || typeof p.id !== 'string') return false;
      var r = ready[p.id];
      return isObj(r) && ((isNum(r.charges) && r.charges > 0) || (isNum(r.untilDay) && r.untilDay >= s.day));
    }).map(function (p) { return { id: p.id, label: txt(p.label, 80) || p.id, cut: Math.floor(num(p.cut, 0, 100, 0)), consumes: p.consumes === true }; });
  };
  /* The chance (out of 100) a voyage goes wrong: the route's risk less
     every protection's cut, never below 0. */
  R.voyageChance = function (pct, protections) {
    var cut = (protections || []).reduce(function (n, p) { return n + Math.floor(num(p && p.cut, 0, 100, 0)); }, 0);
    return Math.max(0, Math.min(100, Math.floor(num(pct, 0, 100, 0)) - cut));
  };

  /* ---------- The price, worked out when the cargo sells ---------- */
  /* Each line: lots × base value × the Clan's demand × the Charter's price
     factor, rounded down. Then the fee (per lot) and the tariff (a
     percentage of what it fetched) come off; never below 0.
     Returns { lines, lots, gross, fee, tariff, tariffPct, feePerLot, priceMult, net }. */
  R.cargoQuote = function (data, charter, port, clan, cargo) {
    var c = commerce(data);
    var route = R.portRoute(data, port) || {};
    var terms = isObj(charter && charter.terms) ? charter.terms : {};
    var priceMult = isNum(terms.priceMult) ? Math.max(0, Math.min(10, terms.priceMult)) : 1;
    var feePerLot = isNum(terms.feePerLot) ? Math.max(0, terms.feePerLot)
      : isNum(route.feePerLot) ? route.feePerLot : Math.max(0, num(c.feePerLot, 0, 100000, 0));
    var byClan = isObj(c.tariffByClan) ? c.tariffByClan : {};
    var tariffPct = isNum(terms.tariffPct) ? Math.max(0, Math.min(100, terms.tariffPct))
      : isNum(route.tariffPct) ? route.tariffPct
      : isNum(byClan[clan]) ? Math.max(0, Math.min(100, byClan[clan])) : num(c.tariffPct, 0, 100, 0);
    var lots = 0;
    var lines = (cargo || []).filter(function (x) { return isObj(x) && x.goodId && clampInt(x.qty, 0) > 0; }).map(function (x) {
      var g = R.good(data, x.goodId);
      var qty = clampInt(x.qty, 0);
      var base = g && isNum(g.gp) ? g.gp : 0;
      var d = R.demandFor(data, clan, x.goodId);
      lots += qty;
      return {
        goodId: x.goodId, name: g ? g.name : R.goodName(data, x.goodId), qty: qty, base: base, cat: g && g.cat ? g.cat : '',
        demand: d.level, demandLabel: d.label, mult: d.mult,
        gp: Math.floor(qty * base * d.mult * priceMult + 1e-9)
      };
    });
    var gross = lines.reduce(function (n, l) { return n + l.gp; }, 0);
    var fee = Math.floor(feePerLot * lots + 1e-9);
    var tariff = Math.floor(gross * tariffPct / 100 + 1e-9);
    return { lines: lines, lots: lots, gross: gross, fee: fee, tariff: tariff, tariffPct: tariffPct, feePerLot: feePerLot, priceMult: priceMult, net: Math.max(0, gross - fee - tariff) };
  };
  /* "2 lots of Sawn Lumber × 160 gp × Normal ×1.00 = 320 gp". */
  R.quoteLineText = function (l) {
    return plural(l.qty, 'lot') + ' of ' + l.name + ' × ' + l.base + ' gp × ' + l.demandLabel + ' ×' + l.mult.toFixed(2) + ' = ' + l.gp + ' gp';
  };
  /* "Shipping 0 gp · tariff 0 gp · 320 gp to the treasury". */
  R.quoteCostsText = function (q) {
    return 'Shipping ' + q.fee + ' gp · tariff ' + q.tariff + ' gp (' + q.tariffPct + '%)' + (q.priceMult !== 1 ? ' · Charter price ×' + q.priceMult.toFixed(2) : '') + ' · ' + q.net + ' gp to the treasury';
  };

  /* ---------- Ships at sea ---------- */
  R.voyages = function (s) { return list(s, 'voyages'); };
  R.schedules = function (s) { return list(s, 'schedules'); };
  R.cargoSales = function (s) { return list(s, 'cargoSales'); };
  /* "2 lots of Sawn Lumber, 1 lot of Raw Timber". */
  R.cargoText = function (data, cargo) { return R.goodsListText(data, (cargo || []).map(function (x) { return { goodId: x.goodId, qty: x.qty }; })); };
  /* A voyage in plain words: where it is and when it's next due. */
  R.voyageState = function (v) {
    var port = R.portName(v.port);
    if (v.stage === 'outbound') return 'Sailing to ' + port + ': arrives ' + R.dayLabel(v.arriveDay) + ', home ' + R.dayLabel(v.returnDay);
    if (v.outcome === 'turned_back') return 'Turned back from ' + port + ' with its cargo: home ' + R.dayLabel(v.returnDay);
    return 'Sold at ' + port + ', sailing home: back ' + R.dayLabel(v.returnDay);
  };

  /* Why the Dock can't send a ship now ('' if it can). */
  R.dispatchBlocker = function (s, data) {
    var spec = R.dockSpec(s, data);
    if (R.builtFacilityIds(s, data).indexOf('dock') === -1) return 'The Dock isn\'t built.';
    if (spec.lots < 1 || spec.ships < 1) {
      var need = R.dockLevelFor(data, 'ship');
      return need ? 'The Dock needs Level ' + need + ' to send cargo (it\'s Level ' + spec.level + ').' : 'The Dock can\'t send cargo at any level (commerce-data.js).';
    }
    var repair = R.underRepair(s, 'dock');
    if (repair) return 'The Dock is Under Repair until ' + R.dayLabel(repair) + '.';
    var out = R.voyages(s);
    if (out.length >= spec.ships) {
      var back = out.reduce(function (m, v) { return m === null || v.returnDay < m ? v.returnDay : m; }, null);
      return (spec.ships === 1 ? 'The ship is at sea' : 'Every ship is at sea') + (back !== null ? ': the first one home is back on ' + R.dayLabel(back) + '.' : '.');
    }
    if (!R.registeredCharters(s).length) return 'No Port Charter is registered yet: the DM grants one in the Explorer, then the Hall of Emissaries registers it.';
    return '';
  };

  /* Tidy what the DM picked: [{ goodId, qty }], each good once, whole lots. */
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
  /* Is this cargo all right for this Charter's route and the Dock's room?
     '' or the reason. Stock isn't checked here (R.takeGoods does that). */
  R.cargoBlocker = function (s, data, charter, picks) {
    if (!charter) return 'That Port Charter isn\'t held.';
    if (charter.status !== 'registered') return 'The Port Charter for ' + R.charterLabel(data, charter) + ' isn\'t registered yet: the Hall of Emissaries registers it.';
    var B = bridge();
    if (B && !B.isPort(charter.port)) return R.portName(charter.port) + ' isn\'t on the port list any more (shared/data/ports.js).';
    var route = R.portRoute(data, charter.port);
    if (!route) return R.portName(charter.port) + ' has no sea route yet (commerce-data.js).';
    var lots = mergePicks(picks);
    if (!lots.length) return 'Choose at least 1 lot to ship.';
    for (var i = 0; i < lots.length; i++) {
      var why = R.goodShipBlocker(data, lots[i].goodId, route);
      if (why) return why;
    }
    var total = lots.reduce(function (n, x) { return n + x.qty; }, 0);
    var spec = R.dockSpec(s, data);
    if (total > spec.lots) return 'That\'s ' + plural(total, 'lot') + ': a ship from a Level ' + spec.level + ' Dock carries ' + plural(spec.lots, 'lot') + '.';
    return '';
  };

  /* A voyage's id: never one a ship at sea or a sale receipt already has
     (a receipt with its id means "already settled"). */
  function uniqueId(s, rand) {
    var taken = {};
    R.voyages(s).forEach(function (v) { taken[v.id] = true; });
    R.cargoSales(s).forEach(function (x) { taken[x.id] = true; });
    var id = R.uid(rand);
    for (var n = 2; taken[id]; n++) id = R.uid(rand) + '-' + n;
    return id;
  }

  /* Send a ship (the DM's Ship cargo, or a standing shipment). Everything is
     checked against the Bastion as it is now; a refusal changes nothing.
     The lots leave the Warehouse, all or nothing, and the voyage holds them.
     opts: { scheduleId }. Returns { ok, voyage, log } or { ok: false, message }. */
  R.dispatchCargo = function (s, data, charterId, picks, rand, opts) {
    var why = R.dispatchBlocker(s, data);
    if (why) return { ok: false, message: why };
    var charter = R.charterById(s, charterId);
    why = R.cargoBlocker(s, data, charter, picks);
    if (why) return { ok: false, message: why };
    var lots = mergePicks(picks);
    var short = R.inputsShort(s, data, lots.map(function (x) { return { good: x.goodId, qty: x.qty }; }));
    if (short) return { ok: false, message: short.message };
    var taken = R.takeGoods(s, data, lots.map(function (x) { return { good: x.goodId, qty: x.qty }; }));
    if (!taken) return { ok: false, message: 'The Warehouse doesn\'t have that cargo.' };
    var route = R.portRoute(data, charter.port);
    var prot = R.voyageProtections(s, data);
    /* A protection that's used up by the voyage it protects. */
    var ready = isObj(tn(s).protections) ? tn(s).protections : {};
    prot.forEach(function (p) {
      if (p.consumes && isObj(ready[p.id]) && isNum(ready[p.id].charges)) ready[p.id].charges = Math.max(0, ready[p.id].charges - 1);
    });
    var v = {
      id: uniqueId(s, rand),
      port: charter.port,
      clan: charter.clan,
      charterId: charter.id,
      mode: R.ROUTE_MODES.cargo,
      cargo: taken,
      departDay: s.day,
      arriveDay: s.day + route.outDays,
      returnDay: s.day + route.outDays + route.backDays,
      stage: 'outbound',
      risk: route.risk,
      basePct: route.pct,
      protections: prot.map(function (p) { return { id: p.id, label: p.label, cut: p.cut }; }),
      chance: R.voyageChance(route.pct, prot),
      scheduleId: opts && typeof opts.scheduleId === 'string' ? opts.scheduleId : null,
      outcome: null,
      roll: null
    };
    R.voyages(s).push(v);
    var where = R.portWithClan(data, v.port, v.clan);
    return {
      ok: true, voyage: v,
      log: ['Cargo', (v.scheduleId ? 'Standing shipment: c' : 'C') + 'argo for ' + where + ' sailed: ' + R.cargoText(data, taken) + ', from the Warehouse. It reaches ' + R.portName(v.port) + ' on ' + R.dayLabel(v.arriveDay) +
        ' and the ship is home on ' + R.dayLabel(v.returnDay) + '. Voyage risk: ' + route.riskLabel + ' (' + v.chance + '%' + (v.protections.length ? ', after ' + v.protections.map(function (p) { return p.label; }).join(' and ') : '') + ').']
    };
  };

  /* ---------- Standing shipments (Dock Level 4) ---------- */
  /* Set up (or replace) the standing shipment to a Charter's port: the same
     cargo every scheduleEvery days, first tomorrow. The goods aren't
     checked now: each sailing waits until they're there. */
  R.setSchedule = function (s, data, charterId, picks, rand) {
    var spec = R.dockSpec(s, data);
    if (!spec.schedule) {
      var need = R.dockLevelFor(data, 'schedule');
      return { ok: false, message: need ? 'Standing shipments need the Dock at Level ' + need + ' (it\'s Level ' + spec.level + ').' : 'Standing shipments aren\'t possible (commerce-data.js).' };
    }
    var charter = R.charterById(s, charterId);
    var why = R.cargoBlocker(s, data, charter, picks);
    if (why) return { ok: false, message: why };
    var every = Math.floor(num(commerce(data).scheduleEvery, 1, 365, 7));
    var lots = mergePicks(picks).map(function (x) { return { goodId: x.goodId, name: R.goodName(data, x.goodId), qty: x.qty }; });
    var list2 = R.schedules(s);
    var old = list2.filter(function (x) { return x.charterId === charterId; })[0];
    var sc = { id: old ? old.id : R.uid(rand), charterId: charterId, port: charter.port, lots: lots, every: every, nextDay: s.day + 1, waiting: '' };
    if (old) list2[list2.indexOf(old)] = sc; else list2.push(sc);
    return { ok: true, schedule: sc, log: ['Cargo', 'Standing shipment ' + (old ? 'changed' : 'set up') + ' for ' + R.charterLabel(data, charter) + ': ' + R.cargoText(data, lots) + ' every ' + plural(every, 'day') + ', first on ' + R.dayLabel(sc.nextDay) + ' if a ship and the goods are ready.'] };
  };
  R.stopSchedule = function (s, data, id) {
    var list2 = R.schedules(s);
    var sc = list2.filter(function (x) { return x.id === id; })[0];
    if (!sc) return { ok: false, message: 'That standing shipment has already stopped.' };
    tn(s).schedules = list2.filter(function (x) { return x !== sc; });
    return { ok: true, log: ['Cargo', 'Standing shipment to ' + R.portName(sc.port) + ' stopped. Ships already at sea carry on.'] };
  };

  /* ---------- The day's settlement (the 'trade' stage) ----------
     In order: ships reaching their port (sell, or turn back), ships coming
     home (any turned-back cargo back into the Warehouse), then standing
     shipments due to sail. Each voyage moves on in the same state change as
     its gold or goods, so with the one save that follows nothing happens
     twice. Returns { changed, log: [[title, body]], word: [lines], sold: [receipts] }. */
  R.settleVoyages = function (s, data, rand) {
    var out = { changed: false, log: [], word: [], sold: [] };
    var c = commerce(data);
    var kept = Math.floor(num(c.salesKept, 1, 500, 30));
    var sales = R.cargoSales(s);
    R.voyages(s).forEach(function (v) {
      if (v.stage !== 'outbound' || v.arriveDay > s.day) return;
      var where = R.portWithClan(data, v.port, v.clan);
      /* Already settled (a receipt with its id): never paid again. */
      var had = sales.filter(function (x) { return x.id === v.id; })[0];
      if (had) { v.stage = 'returning'; v.outcome = had.outcome === 'sold' ? 'sold' : 'turned_back'; out.changed = true; return; }
      var chance = clampInt(v.chance, 0, 100);
      var roll = 1 + Math.floor(rand() * 100);
      v.roll = roll;
      v.stage = 'returning';
      out.changed = true;
      /* The receipt, in the order its fields are saved. */
      function receipt(outcome, q) {
        return { id: v.id, day: s.day, port: v.port, clan: v.clan, outcome: outcome, roll: roll, chance: chance, cargo: v.cargo.slice(),
          lines: q ? q.lines : [], gross: q ? q.gross : 0, fee: q ? q.fee : 0, tariff: q ? q.tariff : 0, tariffPct: q ? q.tariffPct : 0, priceMult: q ? q.priceMult : 1, net: q ? q.net : 0 };
      }
      var rec;
      if (roll > chance) {
        var q = R.cargoQuote(data, R.charterById(s, v.charterId), v.port, v.clan, v.cargo);
        s.treasuryGP += q.net;
        v.outcome = 'sold';
        rec = receipt('sold', q);
        out.log.push(['Cargo Sold', 'Cargo sold at ' + where + ': ' + q.lines.map(R.quoteLineText).join('; ') + '. ' + R.quoteCostsText(q) + '. Treasury +' + q.net + ' gp. (Voyage risk ' + chance + '%: rolled ' + roll + ', safe.) The ship is home on ' + R.dayLabel(v.returnDay) + '.']);
        out.word.push('Cargo sold at ' + R.portName(v.port) + ': +' + q.net + ' gp.');
      } else {
        v.outcome = 'turned_back';
        rec = receipt('turned_back', null);
        out.log.push(['Cargo', 'Trouble at sea: the ship for ' + where + ' turned back, and nothing was sold. (Voyage risk ' + chance + '%: rolled ' + roll + '.) It brings the cargo home on ' + R.dayLabel(v.returnDay) + ': ' + R.cargoText(data, v.cargo) + '.']);
        out.word.push('Trouble at sea: the cargo ship for ' + R.portName(v.port) + ' turned back with its cargo (home ' + R.dayLabel(v.returnDay) + ').');
      }
      sales.push(rec);
      out.sold.push(rec);
    });
    if (sales.length > kept) tn(s).cargoSales = sales.slice(sales.length - kept);
    /* Ships home: the Dock can send them again. */
    var home = R.voyages(s).filter(function (v) { return v.stage === 'returning' && v.returnDay <= s.day; });
    home.forEach(function (v) {
      var back = v.outcome === 'turned_back' ? R.returnGoods(s, data, v.cargo) : '';
      out.log.push(['Cargo', 'The cargo ship is home from ' + R.portName(v.port) + '.' + (back ? ' ' + back : '')]);
      out.word.push('The cargo ship is home from ' + R.portName(v.port) + (back ? ', and its cargo is back in the Warehouse.' : '.'));
    });
    if (home.length) {
      tn(s).voyages = R.voyages(s).filter(function (v) { return home.indexOf(v) === -1; });
      out.changed = true;
    }
    /* Standing shipments due: sail if they can, otherwise wait (said once
     for each new reason). The one that has waited longest goes first, so
     two sharing one ship take turns (a review fix). */
    R.schedules(s).slice().sort(function (a, b) { return a.nextDay - b.nextDay; }).forEach(function (sc) {
      if (sc.nextDay > s.day) return;
      var spec = R.dockSpec(s, data);
      var res = spec.schedule ? R.dispatchCargo(s, data, sc.charterId, sc.lots, rand, { scheduleId: sc.id })
        : { ok: false, message: 'Standing shipments need the Dock at Level ' + (R.dockLevelFor(data, 'schedule') || '?') + '.' };
      if (res.ok) {
        sc.nextDay = s.day + Math.floor(num(sc.every, 1, 365, 7));
        sc.waiting = '';
        out.log.push(res.log);
        out.word.push('Standing shipment: cargo sailed for ' + R.portName(sc.port) + ' (arrives ' + R.dayLabel(res.voyage.arriveDay) + ').');
        out.changed = true;
      } else if (sc.waiting !== res.message) {
        sc.waiting = res.message;
        out.log.push(['Cargo', 'Standing shipment to ' + R.portName(sc.port) + ' waits: ' + res.message]);
        out.word.push('Standing shipment to ' + R.portName(sc.port) + ' waits: ' + res.message);
        out.changed = true;
      }
    });
    return out;
  };

  /* ---------- Saves: tidy each record, safe to run twice ---------- */
  function cleanCargo(list2) {
    return (arr(list2) || []).filter(function (x) { return isObj(x) && typeof x.goodId === 'string' && x.goodId && clampInt(x.qty, 0) > 0; })
      .map(function (x) { return { goodId: x.goodId, name: txt(x.name, 80) || x.goodId, qty: clampInt(x.qty, 1, 1000) }; });
  }
  function cleanTerms(t) {
    var out = {};
    if (!isObj(t)) return out;
    if (isNum(t.priceMult)) out.priceMult = Math.max(0, Math.min(10, t.priceMult));
    if (isNum(t.feePerLot)) out.feePerLot = Math.max(0, Math.min(100000, t.feePerLot));
    if (isNum(t.tariffPct)) out.tariffPct = Math.max(0, Math.min(100, t.tariffPct));
    return out;
  }
  /* One Charter per port (a registered one first); a port that has left the
     port list is kept (the screen says so), as is anything it holds. */
  R.cleanPortCharters = function (src) {
    var all = (arr(src) || []).filter(function (c) { return isObj(c) && typeof c.id === 'string' && c.id && typeof c.port === 'string' && c.port; });
    /* The one kept for each port: its first registered Charter, else its first. */
    var pick = {};
    all.forEach(function (c) {
      var p = txt(c.port, 40);
      if (!pick[p] || (pick[p].status !== 'registered' && c.status === 'registered')) pick[p] = c;
    });
    return all.filter(function (c) { return pick[txt(c.port, 40)] === c; }).map(function (c) {
      return {
        id: txt(c.id, 80), port: txt(c.port, 40), clan: txt(c.clan, 40), mode: R.ROUTE_MODES.cargo,
        status: STATUSES.indexOf(c.status) !== -1 ? c.status : 'earned',
        earnedDay: dayNum(c.earnedDay, 1),
        registeredDay: c.status === 'registered' ? dayNum(c.registeredDay, dayNum(c.earnedDay, 1)) : null,
        terms: cleanTerms(c.terms),
        from: { code: txt(c.from && c.from.code, 20), title: txt(c.from && c.from.title, 80) },
        text: txt(c.text, 200)
      };
    });
  };
  R.cleanVoyages = function (src, today) {
    return (arr(src) || []).filter(function (v) { return isObj(v) && typeof v.id === 'string' && v.id && typeof v.port === 'string' && v.port; }).map(function (v) {
      var depart = dayNum(v.departDay, today);
      var arrive = dayNum(v.arriveDay, depart);
      var stage = STAGES.indexOf(v.stage) !== -1 ? v.stage : 'returning';
      return {
        id: txt(v.id, 80), port: txt(v.port, 40), clan: txt(v.clan, 40), charterId: txt(v.charterId, 80), mode: R.ROUTE_MODES.cargo,
        cargo: cleanCargo(v.cargo),
        departDay: depart, arriveDay: arrive, returnDay: Math.max(arrive, dayNum(v.returnDay, arrive)),
        stage: stage,
        risk: txt(v.risk, 20),
        basePct: clampInt(v.basePct, 0, 100),
        protections: (arr(v.protections) || []).filter(function (p) { return isObj(p) && typeof p.id === 'string'; })
          .map(function (p) { return { id: txt(p.id, 40), label: txt(p.label, 80), cut: clampInt(p.cut, 0, 100) }; }),
        chance: clampInt(v.chance, 0, 100),
        scheduleId: typeof v.scheduleId === 'string' && v.scheduleId ? txt(v.scheduleId, 80) : null,
        /* A ship on its way home always says how it went (a damaged one
           counts as turned back, so its cargo comes home and nothing is paid). */
        outcome: stage === 'outbound' ? null : OUTCOMES.indexOf(v.outcome) !== -1 ? v.outcome : 'turned_back',
        roll: isNum(v.roll) ? clampInt(v.roll, 1, 100) : null
      };
    });
  };
  R.cleanSchedules = function (src, today) {
    var seen = {};
    return (arr(src) || []).filter(function (x) { return isObj(x) && typeof x.id === 'string' && x.id && typeof x.charterId === 'string' && x.charterId; }).map(function (x) {
      return { id: txt(x.id, 80), charterId: txt(x.charterId, 80), port: txt(x.port, 40), lots: cleanCargo(x.lots), every: clampInt(x.every, 1, 365), nextDay: dayNum(x.nextDay, today + 1), waiting: txt(x.waiting, 200) };
    }).filter(function (x) {
      if (!x.lots.length || seen[x.charterId]) return false;
      seen[x.charterId] = true;
      return true;
    });
  };
  R.cleanCargoSales = function (src, kept) {
    var list2 = (arr(src) || []).filter(function (x) { return isObj(x) && typeof x.id === 'string' && x.id; }).map(function (x) {
      return {
        id: txt(x.id, 80), day: dayNum(x.day, 1), port: txt(x.port, 40), clan: txt(x.clan, 40),
        outcome: OUTCOMES.indexOf(x.outcome) !== -1 ? x.outcome : 'turned_back',
        roll: isNum(x.roll) ? clampInt(x.roll, 1, 100) : null, chance: clampInt(x.chance, 0, 100),
        cargo: cleanCargo(x.cargo),
        lines: (arr(x.lines) || []).filter(isObj).map(function (l) {
          return {
            goodId: txt(l.goodId, 60), name: txt(l.name, 80), qty: clampInt(l.qty, 0, 1000), base: clampInt(l.base, 0, 100000), cat: txt(l.cat, 20),
            demand: txt(l.demand, 20), demandLabel: txt(l.demandLabel, 40), mult: isNum(l.mult) ? Math.max(0, Math.min(10, l.mult)) : 1, gp: clampInt(l.gp, 0, 10000000)
          };
        }),
        gross: clampInt(x.gross, 0, 10000000), fee: clampInt(x.fee, 0, 10000000), tariff: clampInt(x.tariff, 0, 10000000),
        tariffPct: isNum(x.tariffPct) ? Math.max(0, Math.min(100, x.tariffPct)) : 0,
        priceMult: isNum(x.priceMult) ? Math.max(0, Math.min(10, x.priceMult)) : 1,
        net: clampInt(x.net, 0, 10000000)
      };
    });
    var n = Math.max(1, clampInt(kept === undefined ? 30 : kept, 1, 500));
    return list2.length > n ? list2.slice(list2.length - n) : list2;
  };
  R.cleanProtections = function (src) {
    var out = {};
    if (!isObj(src)) return out;
    Object.keys(src).forEach(function (k) {
      var r = src[k];
      if (!isObj(r) || !/^[a-z0-9_]{1,40}$/.test(k)) return;
      var x = {};
      if (isNum(r.charges)) x.charges = clampInt(r.charges, 0, 1000);
      if (isNum(r.untilDay)) x.untilDay = dayNum(r.untilDay, 0);
      out[k] = x;
    });
    return out;
  };
  /* Every commerce record in a loaded Bastion (R.fromSave calls this). */
  R.cleanCommerce = function (d, data) {
    var t = tn(d);
    t.portCharters = R.cleanPortCharters(t.portCharters);
    t.voyages = R.cleanVoyages(t.voyages, d.day);
    t.schedules = R.cleanSchedules(t.schedules, d.day);
    t.cargoSales = R.cleanCargoSales(t.cargoSales, num(commerce(data).salesKept, 1, 500, 30));
    t.protections = R.cleanProtections(t.protections);
    /* A ship on its way home that has a sale receipt sold its cargo, so
       never brings it home as well. */
    t.voyages.forEach(function (v) {
      var had = t.cargoSales.filter(function (x) { return x.id === v.id; })[0];
      if (had && v.stage === 'returning') v.outcome = had.outcome;
    });
  };
  /* Reset Travel moves every commerce day with the rest of the Bastion
     (R.shiftDays calls this). Sales are history and stay. */
  R.shiftCommerce = function (s, n) {
    var t = tn(s);
    var mv = function (obj, key) { if (obj && typeof obj[key] === 'number') obj[key] += n; };
    (arr(t.portCharters) || []).forEach(function (c) { mv(c, 'earnedDay'); mv(c, 'registeredDay'); });
    (arr(t.voyages) || []).forEach(function (v) { mv(v, 'departDay'); mv(v, 'arriveDay'); mv(v, 'returnDay'); });
    (arr(t.schedules) || []).forEach(function (sc) { mv(sc, 'nextDay'); });
    if (isObj(t.protections)) Object.keys(t.protections).forEach(function (k) { mv(t.protections[k], 'untilDay'); });
  };
}());
