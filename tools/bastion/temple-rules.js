/* The Ironbow Bastion Manager: the Temple. Plain functions, no screen code, tested on
   tests/rules.html (tests/rules/temple.test.js). They add to the Bastion's rules
   (tools/bastion/rules.js), as courier-rules.js does.

   The Strip Back Overhaul (Harry, 22 October 2026, step S11): the three Shrines (Telluria,
   Aurush, Pelagos) became ONE Temple, and the Favour of the Gods panel went (its bars are in
   the Temple). The Temple's panel is split into thirds, one for each god. In each third:
   - the god's Favour bar, 0 to 100 percent (s.favour, as it has always been saved);
   - Pray to (god): INSTANT. It adds a random whole number from 1 to 50 (a d50) to the bar,
     which stops at 100. The roll is the Bastion's own, made here with the rand it is given,
     and shown to the DM in the result;
   - Receive Blessing: a dropdown of exactly three blessings, not possible until the god's bar
     is FULL (100). It takes effect INSTANTLY, spends the WHOLE bar, and the bar goes back to 0.
   Nothing here is an order with days. (An order carried over from an old Shrine, by the
   conversion in strip-back-rules.js, still completes on its due day through rules.js.)

   Where everything comes from: the gods, the number that makes a bar full ("full": 100), the
   die ("prayDie": 50) and the blessings (the Temple's functions that name a god) are all in
   tools/bastion/data/facilities-data.js, in the Temple's block. What a blessing makes:
   - "production": goods into the Warehouse (the option's "outputs");
   - "protectionCharge": one Blessing of Pelagos kept for the Dock's next ship (commerce-rules.js
     reads it when a ship sails);
   - "greatRite": a Great Rite in s.greatRites, waiting at the Ironbow until the DM gives it to
     the party on an expedition in the Explorer (tools/explorer/journey.js).
   Pure: no storage, no clock, no dice other than the rand it is given. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.bastion = TSI.bastion || {};
  var R = ns.rules;
  if (!R) return;
  var clampInt = R.clampInt;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  R.TEMPLE_ID = 'temple';
  /* The most a bar can hold (the saved Favour map is clamped to this). */
  R.FAVOUR_MAX = 100;

  /* ---------- The data ---------- */
  R.templeFac = function (data) { return data && arr(data.facilities).length ? R.facility(data, R.TEMPLE_ID) : null; };
  function block(data) {
    var f = R.templeFac(data);
    return f && isObj(f.temple) ? f.temple : {};
  }
  /* How full a bar must be before its god gives a blessing. */
  R.templeFull = function (data) { return clampInt(block(data).full === undefined ? 100 : block(data).full, 1, R.FAVOUR_MAX); };
  /* Pray adds a random whole number from 1 to this. */
  R.templePrayDie = function (data) { return clampInt(block(data).prayDie === undefined ? 50 : block(data).prayDie, 2, 100); };
  /* The gods, in the panel's order: [{ id, name, art }]. */
  R.templeGods = function (data) {
    var list = arr(block(data).gods).filter(function (g) { return isObj(g) && R.GODS.indexOf(g.id) !== -1; })
      .map(function (g) { return { id: g.id, name: typeof g.name === 'string' && g.name ? g.name : R.GOD_NAMES[g.id], art: typeof g.art === 'string' ? g.art : '' }; });
    return list.length ? list : R.GODS.map(function (id) { return { id: id, name: R.GOD_NAMES[id], art: '' }; });
  };
  R.templeGod = function (data, id) { return R.templeGods(data).filter(function (g) { return g.id === id; })[0] || null; };
  /* A god's blessings, in the dropdown's order: [{ id, label, notes, kind, fn }]. kind: 'goods', 'charge' or 'rite'. */
  R.templeBlessings = function (data, god) {
    var f = R.templeFac(data);
    return arr(f && f.functions).filter(function (fn) { return isObj(fn) && fn.blessing === true && fn.god === god; }).map(function (fn) {
      return { id: fn.id, label: fn.label || fn.id, notes: typeof fn.notes === 'string' ? fn.notes : '', kind: fn.greatRite ? 'rite' : fn.protectionCharge ? 'charge' : 'goods', fn: fn };
    });
  };
  R.templeBlessing = function (data, god, fnId) {
    return R.templeBlessings(data, god).filter(function (b) { return b.id === fnId; })[0] || null;
  };

  /* ---------- State ---------- */
  R.templeBuilt = function (s, data) { return R.builtFacilityIds(s, data).indexOf(R.TEMPLE_ID) !== -1; };
  /* A god's bar, 0 to 100. */
  R.templeBar = function (s, god) {
    return R.GODS.indexOf(god) === -1 || !isObj(s.favour) ? 0 : clampInt(s.favour[god], 0, R.FAVOUR_MAX);
  };
  /* A god's Great Rites (waiting at the Ironbow or with the party) and the Blessings of Pelagos held for the Dock. */
  R.templeRites = function (s, god) {
    return arr(s.greatRites).filter(function (g) { return isObj(g) && g.god === god; });
  };
  R.templeHeld = function (s, god) {
    var p = god === 'pelagos' && isObj(s.tradeNetwork) && isObj(s.tradeNetwork.protections) ? s.tradeNetwork.protections.pelagos_blessing : null;
    return isObj(p) ? clampInt(p.charges, 0, 999) : 0;
  };
  /* Everything the Temple's panel shows: { built, full, die, gods: [{ id, name, art, bar, isFull, blessings, rites, held }] }. */
  R.templeView = function (s, data) {
    var full = R.templeFull(data);
    return {
      built: R.templeBuilt(s, data), full: full, die: R.templePrayDie(data),
      gods: R.templeGods(data).map(function (g) {
        var bar = R.templeBar(s, g.id);
        return { id: g.id, name: g.name, art: g.art, bar: bar, isFull: bar >= full, blessings: R.templeBlessings(data, g.id), rites: R.templeRites(s, g.id), held: R.templeHeld(s, g.id) };
      })
    };
  };

  /* ---------- Pray ---------- */
  /* Why Pray can't be done now ('' if it can). */
  R.templePrayBlocker = function (s, data, god) {
    if (!R.templeGod(data, god)) return 'That isn\'t one of the Temple\'s gods.';
    if (!R.templeBuilt(s, data)) return 'The Temple isn\'t built yet.';
    return '';
  };
  /* Pray to a god: the Bastion rolls a d50 and adds it to the god's bar (the bar stops at 100). Praying with a full bar
     adds nothing (the roll is still made and said). Returns { ok, god, name, die, roll, before, after, added, over, log:
     [title, body], text } or { ok: false, message }. */
  R.templePray = function (s, data, god, rand) {
    var why = R.templePrayBlocker(s, data, god);
    if (why) return { ok: false, message: why };
    var g = R.templeGod(data, god);
    var die = R.templePrayDie(data);
    var roll = R.d(die, rand);
    var before = R.templeBar(s, god);
    var after = Math.min(R.FAVOUR_MAX, before + roll);
    if (!isObj(s.favour)) s.favour = { telluria: 0, aurush: 0, pelagos: 0 };
    s.favour[god] = after;
    var added = after - before;
    var over = roll - added;
    var text = 'Rolled a d' + die + ': ' + roll + '. ' + (before >= R.FAVOUR_MAX
      ? g.name + '\'s bar was already full (' + R.FAVOUR_MAX + '%), so nothing was added. Receive a blessing to start it again.'
      : over > 0
        ? g.name + '\'s bar goes from ' + before + '% to ' + after + '% (it stops at ' + R.FAVOUR_MAX + '%, so ' + over + '% of the roll did not fit).'
        : g.name + '\'s bar goes from ' + before + '% to ' + after + '% (+' + roll + '%).');
    return { ok: true, god: god, name: g.name, die: die, roll: roll, before: before, after: after, added: added, over: over, text: text, log: ['Prayer', 'Prayed to ' + g.name + '. ' + text] };
  };

  /* ---------- Receive Blessing ---------- */
  /* Why a blessing can't be received now ('' if it can): the Temple built, a blessing of that god, and the bar full. */
  R.templeReceiveBlocker = function (s, data, god, fnId) {
    var g = R.templeGod(data, god);
    if (!g) return 'That isn\'t one of the Temple\'s gods.';
    if (!R.templeBuilt(s, data)) return 'The Temple isn\'t built yet.';
    if (!R.templeBlessing(data, god, fnId)) return 'That isn\'t one of ' + g.name + '\'s blessings.';
    var full = R.templeFull(data);
    var bar = R.templeBar(s, god);
    return bar < full ? g.name + '\'s bar is at ' + bar + '%. It must be full (' + full + '%) before a blessing can be received.' : '';
  };
  /* A Great Rite's id is made here, never reused: 'rite-' and a code, a number added if one is already held. */
  function newRiteId(s, rand) {
    var base = 'rite-' + R.uid(rand);
    var id = base;
    for (var n = 2; arr(s.greatRites).some(function (g) { return isObj(g) && g.id === id; }); n++) id = base + '-' + n;
    return id;
  }
  /* Receive a blessing: the whole bar is spent (it goes back to 0) and the blessing happens at once. Everything is checked
     first, so a refusal changes nothing. Returns { ok, god, name, fnId, label, kind, spent, text, log: [title, body] } or
     { ok: false, message }. */
  R.templeReceive = function (s, data, god, fnId, rand) {
    var why = R.templeReceiveBlocker(s, data, god, fnId);
    if (why) return { ok: false, message: why };
    var g = R.templeGod(data, god);
    var b = R.templeBlessing(data, god, fnId);
    var fn = b.fn;
    var fac = R.templeFac(data);
    var spent = R.templeBar(s, god);
    s.favour[god] = 0;
    var effect;
    if (fn.greatRite) {
      if (!Array.isArray(s.greatRites)) s.greatRites = [];
      s.greatRites.push({ id: newRiteId(s, rand), rite: fn.greatRite, god: god, madeDay: s.day, status: 'waiting' });
      effect = R.RITE_NAMES[fn.greatRite] + ' waits at the Ironbow until the DM gives it to the party on an expedition, in the Explorer.';
    } else if (fn.protectionCharge) {
      if (!isObj(s.tradeNetwork)) s.tradeNetwork = {};
      if (!isObj(s.tradeNetwork.protections)) s.tradeNetwork.protections = {};
      var held = isObj(s.tradeNetwork.protections[fn.protectionCharge]) ? s.tradeNetwork.protections[fn.protectionCharge] : {};
      held.charges = clampInt(held.charges || 0, 0, 999) + 1;
      s.tradeNetwork.protections[fn.protectionCharge] = held;
      effect = 'A Blessing of Pelagos waits for the next ship the Dock sends with cargo (' + held.charges + ' held): its chance of trouble at sea is lower.';
    } else {
      var opt = arr(fn.options)[0];
      var made = arr(opt && opt.outputs).filter(isObj).map(function (x) {
        if (x.good) {
          var qty = R.goodsOutputQty(s, data, fac, fn, x.good, x.qty);
          R.addGoods(s, data, x.good, qty, fac.name, rand);
          return R.goodsAmountText(data, x.good, qty);
        }
        var n = clampInt(x.qty, 1);
        R.appendToWarehouse(s, String(x.item), n, '', fac.name, rand);
        return n + ' × ' + x.item;
      });
      effect = 'Added to the Warehouse: ' + made.join(', ') + '.';
    }
    var text = g.name + '\'s bar (' + spent + '%) was spent and is back at 0%. ' + b.label + ': ' + effect;
    return { ok: true, god: god, name: g.name, fnId: fnId, label: b.label, kind: b.kind, spent: spent, text: text, log: ['Blessing', 'Received ' + b.label + ' from ' + g.name + '. ' + text] };
  };
}());
