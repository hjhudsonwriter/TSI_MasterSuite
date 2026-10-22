/* The Ironbow Bastion Manager — the rules, as plain functions (no screen
   code), so they can be tested on tests/rules.html.

   Everything follows the old app.js; line numbers in comments point there.
   Dice and random picks take a rand() function so tests can fix them, and
   rolls typed at the table are passed in. Functions that change the Bastion
   change the state object they're given and return what happened (log lines,
   the lines for a result box), for the screen to show.

   Changes from the old tool, all listed in docs/KNOWN_ISSUES.md:
   - Loading restores every saved field (BAS-01).
   - A cancelled roll changes nothing and keeps the order (BAS-02): every roll
     an action needs is asked for first, then the result is applied at once.
   - Orders complete on their day or any later one (BAS-13).
   - Lowering the party level keeps the buildings (BAS-04, B8).
   - Each trade route pays at most once each time it sails (BAS-05, BAS-11).
   - Host Delegation changes Political Capital once, by its own two rolls (B2).

   Days, not turns (Harry, 8 October 2026; docs/BASTION-OVERHAUL.md). The
   Bastion follows the Explorer's day: state.day is the last day it has
   passed, and the screen passes each new day in turn (R.startDay, the
   day's routes and orders, R.rollWarAttack, R.finishDay). Orders complete
   on a due day; buildings on a ready day; contracts send a shipment, routes
   sail and a Clan at war rolls to attack every 7 days from when each began.
   Every day stored is an Explorer day number (it can be 0 or less after
   R.shiftDays, for something that happened before a Reset Travel). A save
   from before (in Bastion turns) is set aside, not converted (Harry). */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ns = TSI.bastion = TSI.bastion || {};
  var R = {};

  /* ---------- Small helpers (old 5569-5583) ---------- */
  /* Whole numbers, as the old tool read them: parseInt, then limits. */
  R.clampInt = function (v, min, max) {
    var n = parseInt(String(v), 10);
    var x = isNaN(n) ? (min === undefined || min === null ? 0 : min) : n;
    var lo = min === undefined || min === null ? 0 : min;
    if (max !== undefined && max !== null) return Math.max(lo, Math.min(max, x));
    return Math.max(lo, x);
  };
  var clampInt = R.clampInt;
  R.d = function (sides, rand) { return 1 + Math.floor(rand() * sides); };
  R.uid = function (rand) { return rand().toString(36).slice(2) + Date.now().toString(36); };
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  R.formatTime = function (ms) {
    var d = new Date(ms);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  /* Each log entry is stamped with the day it happened on. */
  R.log = function (state, title, body, now) {
    state.log.unshift({ title: title, body: body, at: now === undefined ? Date.now() : now, day: typeof state.day === 'number' ? state.day : null });
  };
  /* A day number as saved: a whole number, which can be 0 or less (before a
     Reset Travel); anything else is the fallback. */
  function dayNum(v, fallback) {
    var n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return typeof n === 'number' && isFinite(n) ? Math.max(-100000, Math.min(100000, Math.trunc(n))) : fallback;
  }
  R.dayNum = dayNum;
  /* "Day 12"; a day before Day 1 (after a Reset Travel) reads "before Day 1". */
  R.dayLabel = function (n) { return n >= 1 ? 'Day ' + n : 'before Day 1'; };
  /* "in 3 days", "tomorrow", "today", "3 days ago". */
  R.inDays = function (from, to) {
    var n = to - from;
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n > 1) return 'in ' + n + ' days';
    return n === -1 ? 'yesterday' : (-n) + ' days ago';
  };
  /* The Bastion's time settings (bastion-data.js time), with defaults. */
  R.time = function (data) {
    var t = (data && data.bastion && data.bastion.time) || {};
    return {
      buildDays: Array.isArray(t.buildDays) ? t.buildDays : [{ level: 17, days: 35 }, { level: 13, days: 35 }, { level: 9, days: 28 }, { level: 5, days: 21 }],
      every: t.every > 0 ? t.every : 7,
      patrolDays: t.patrolDays > 0 ? t.patrolDays : 7,
      musterDays: t.musterDays > 0 ? t.musterDays : 3
    };
  };
  /* "The Ironbow sends word…": a short line for the day being passed, shown
     in one pop-up when the days are done (state.word). Outside a day being
     passed (the DM is there, pressing the button) nothing is added. */
  R.addWord = function (s, line) {
    var dip = s.dayInProgress;
    if (!isObj(dip) || !line) return;
    if (!Array.isArray(dip.news)) dip.news = [];
    dip.news.push(String(line));
  };

  /* ---------- The starting Bastion (old loadState defaults, 4743-4833) ---------- */
  function clanMap(value) {
    return { blackstone: value, bacca: value, farmer: value, slade: value, molten: value, rowthorn: value, karr: value };
  }
  R.defaultDiplomacy = function () {
    return { agreements: [], delegations: [], summits: [], arbitrations: [], consortiums: [], rep: 0, cooldowns: {}, tokens: 0 };
  };
  /* routes: the Hall's old sea routes (legacy_abstract). Then commodity
     trade (pull request 5, commerce-rules.js): Port Charters, cargo ships at
     sea, standing shipments, sale receipts, voyage protections ready to use,
     and each good sold (for market saturation). parcels: the Courier
     Exchange's parcels (pull request 6, courier-rules.js). */
  R.defaultTradeNetwork = function () {
    return { active: false, strategy: 'balanced', stability: 75, routes: [], portCharters: [], voyages: [], schedules: [], cargoSales: [], protections: {}, marketLedger: [], parcels: [] };
  };
  R.defaultState = function (data) {
    var s = {
      treasuryGP: 0,
      partyLevel: 7,
      builtFacilities: data.bastion.startingBuilt.slice(),
      builtExtras: [],
      builtPlots: [],
      facilityLevels: {},
      pendingOrders: [],
      /* patrolUntil: the last day the Watchtower's Patrol gives Advantage. */
      defenders: { count: 0, armed: false, patrolUntil: 0 },
      defenderBeasts: [],
      military: [],
      warehouse: [],
      artisanTools: ['', '', '', '', '', ''],
      favour: { telluria: 0, aurush: 0, pelagos: 0 },
      politicalCapital: clanMap(0),
      tradeNetwork: R.defaultTradeNetwork(),
      arbitration: { queue: [] },
      diplomacy: R.defaultDiplomacy(),
      /* The Hall's Diplomatic Records (pull request 9, diplomacy-rules.js): a
         ledger apart from diplomacy, so Clear Diplomacy Records never wipes it. */
      diplomaticRecords: { next: 1, list: [] },
      dmEdits: { done: {} },
      /* The days overhaul (8 October 2026): v 2 marks a save in days. day is
         the last day the Bastion has passed; anchored, whether it has read
         the Explorer's day yet (until then any Explorer day moves the whole
         Bastion to it, without passing days). */
      v: 4,
      day: 1,
      anchored: false,
      log: [],
      /* 'unsworn' or 'clan' (the Mercenary Brigade was archived in the
         Bastion overhaul, Build 3: tools/bastion/archive/mercenary-brigade.js). */
      organization: { type: 'unsworn', name: '', chief: '', motto: '', foundedAtDay: null },
      clanHonor: 40,
      honourRespectByClan: clanMap(0),
      /* The archived Brigade's Trusted Clients scores: nothing reads them
         now, but they're kept in the save, so putting the Brigade back
         (archive/mercenary-brigade.js) loses nothing. */
      trustedClientsByClan: clanMap(50),
      warLog: [],
      /* Where passing a day has got to ({ day, stage, skipped, attackRolled,
         news }), so it can finish after a cancelled roll or a closed window
         (BAS-02); and "The Ironbow sends word…" not yet shown, [{ day,
         lines }]. */
      dayInProgress: null,
      word: [],
      /* New: Military Actions under way, one per war action that has come
         due (rolls, deployment), so each step is kept as it happens
         (Harry's request, 2 October 2026). */
      militaryActions: [],
      /* New in the war's phase 2 (war-campaign-rules.js): the enemy armies
         drawn up for missions, by "target|objective|force"; Lieutenants and
         beasts recovering from a battle; and the counter that seeds each new
         mission's dice. */
      warMissions: {},
      warRecovery: [],
      warMissionSeq: 0,
      /* New in the war's round of 4 October 2026 (war-campaign-rules.js):
         the Clans you're at war with, { clanKey: { since, last, next } }
         (the day the war began, the day of the latest War Action, muster,
         battle or attack between you, and the day of its next attack roll);
         and the facilities Under Repair after a lost Defend Bastion,
         { facId: untilDay } (Under Repair while the day is at or before
         untilDay). */
      wars: {},
      repairs: {},
      /* The facilities overhaul (13 October 2026): v 3. Retired buildings
         whose old order is kept ("smithy": the Workshop's Smithing), the
         buildings retired from this Bastion (an audit record), and the
         one-time conversion's report. */
      legacyFacilities: [],
      research: {},
      archivedFacilities: [],
      migration: null,
      /* The Explorer link (pull request 4, 13 October 2026): a receipt for
         each change from the Explorer, { messageId: { r, day, at, clan, hr,
         was, now, text, why } }, saved with the change itself, so nothing
         counts twice. fresh: a Bastion starting from nothing, which skips
         (and lists) the Explorer's earlier changes rather than applying
         them on top of values typed in by hand. */
      bridge: { fresh: true, done: {} },
      /* The creatures (pull request 7, 14 October 2026): each real, named
         animal the Ironbow keeps (Elara's wyvern, and the griffins and dire
         wolves the DM grants in the Explorer), as R.cleanCreatures keeps
         them. The Menagerie's beasts stay in defenderBeasts. */
      creatures: [],
      /* The Shrines' Great Rites (pull request 8b): each made at the Ironbow
         and waiting there until the DM gives it to the party on an
         expedition (the Explorer's half comes next). */
      greatRites: []
    };
    R.ensureLevels(s, data);
    return s;
  };
  /* The save's version: 2 (the days overhaul, 8 October 2026), 3 (the
     facilities overhaul, 13 October 2026), 4 (the Strip Back Overhaul, 22
     October 2026: R.migrateToV4 in strip-back-rules.js). A new Bastion is
     already the latest. */
  R.STATE_VERSION = 4;

  /* ---------- The facilities overhaul: converting a v 2 save, once ----------
     (Harry, 13 October 2026; docs/FACILITIES-OVERHAUL-PLAN.md section 4.)
     Works on the raw save, before R.fromSave tidies it (which drops repairs
     and orders of facilities it doesn't know). Each retired facility moves
     to its new one (bastion-data.js retiredFacilities): its slot, building
     work, pending orders (ids, due days and costs kept; a Craft order from
     the Smithy or Laboratory, or a Greenhouse Harvest, takes its new
     order's name, so two never clash), level (the highest) and repairs (the latest).
     If both halves of a merge were there, the built one (or the first) is
     kept and the other slot freed. The Smithy joins the Workshop, a
     starting facility: its slot is freed, and a Bastion that had it keeps
     its order (legacyFacilities). The Gaming Hall goes, with its pending
     Trade order (which cost nothing), and is recorded in archivedFacilities.
     A save already converted (v 3) comes back as it is.
     Returns { save, lines } (lines: the report, in plain English). */
  R.migrateToV3 = function (raw, data) {
    var s = TSI.clone(raw);
    /* A save already converted (v 3), or newer (v 4), comes back as it is. */
    if (isObj(s) && s.v >= 3) return { save: s, lines: [] };
    var map = (data.bastion && data.bastion.retiredFacilities) || {};
    var day = Math.max(1, dayNum(s.day, 1));
    var lines = [];
    var legacy = arr(s.legacyFacilities) ? s.legacyFacilities.slice() : [];
    var archived = arr(s.archivedFacilities) ? s.archivedFacilities.slice() : [];
    function nameOf(id) { var f = R.facility(data, id); return (f && f.name) || id; }
    var extrasIn = arr(s.builtExtras) ? s.builtExtras : [];
    var slots = extrasIn.map(function (x, i) {
      if (!x) return '';
      if (typeof x === 'string') x = { facId: x, status: 'built' };
      if (!isObj(x) || !x.facId) return '';
      var m = map[x.facId];
      if (!m) return x;
      var building = x.status === 'building';
      if (m.to === null) {
        archived.push({ facId: x.facId, name: m.name, status: building ? 'building' : 'built', slot: i, day: day });
        lines.push(building ? 'Building work on the ' + m.name + ' stopped, as it is no longer part of the Bastion; its slot is free.' : 'The ' + m.name + ' is no longer part of the Bastion; its slot is free.');
        return '';
      }
      if (data.bastion.startingBuilt.indexOf(m.to) !== -1) {
        if (!building && m.legacy && legacy.indexOf(m.legacy) === -1) legacy.push(m.legacy);
        lines.push(building ? 'Building work on the ' + m.name + ' stopped: it has joined the ' + nameOf(m.to) + '. Its slot is free.' : 'The ' + m.name + ' joined the ' + nameOf(m.to) + ': its slot is free, and the ' + nameOf(m.to) + ' keeps the ' + m.name + '\'s order.');
        return '';
      }
      return { facId: m.to, status: x.status, startDay: x.startDay, readyDay: x.readyDay, from: x.facId };
    });
    /* Two halves of one merge: keep the built one (else the first to be
       ready), free the other. */
    var groups = {};
    slots.forEach(function (x, i) { if (x && x.from) (groups[x.facId] = groups[x.facId] || []).push(i); });
    Object.keys(groups).forEach(function (to) {
      var idx = groups[to];
      var keep = idx.slice().sort(function (a, b) {
        var A = slots[a], Bx = slots[b];
        var ab = A.status === 'built' ? 0 : 1, bb = Bx.status === 'built' ? 0 : 1;
        if (ab !== bb) return ab - bb;
        if (ab === 1) return dayNum(A.readyDay, 0) - dayNum(Bx.readyDay, 0) || a - b;
        return a - b;
      })[0];
      var names = idx.map(function (i) { return map[slots[i].from].name; });
      var stopped = idx.filter(function (i) { return i !== keep && slots[i].status === 'building'; }).map(function (i) { return map[slots[i].from].name; });
      if (idx.length > 1) lines.push('The ' + names.join(' and the ') + ' are now one ' + nameOf(to) + (slots[keep].status === 'building' ? ' (still being built)' : '') + ': the other slot is free' +
        (stopped.length ? ', and building work on the ' + stopped.join(' and the ') + ' stopped (building costs no gold).' : '.'));
      else lines.push('The ' + names[0] + ' is now the ' + nameOf(to) + (slots[keep].status === 'building' ? ' (still being built)' : '') + '.');
      idx.forEach(function (i) { if (i !== keep) slots[i] = ''; });
    });
    s.builtExtras = slots.map(function (x) {
      if (!x || !x.from) return x;
      var out = { facId: x.facId, status: x.status };
      if (x.status === 'building') { out.startDay = x.startDay; out.readyDay = x.readyDay; }
      return out;
    });
    /* Pending orders follow their facility. */
    var moved = 0;
    var dropped = [];
    if (arr(s.pendingOrders)) {
      s.pendingOrders = s.pendingOrders.filter(function (o) {
        if (!isObj(o)) return true;
        var m = map[o.facId];
        if (!m) return true;
        if (m.to === null) { dropped.push(o); return false; }
        if (m.fns && m.fns[o.fnId]) o.fnId = m.fns[o.fnId];
        o.facId = m.to;
        moved += 1;
        return true;
      });
    }
    if (moved) lines.push(moved === 1 ? '1 pending order moved with its facility, keeping its due day.' : moved + ' pending orders moved with their facilities, keeping their due days.');
    if (dropped.length) lines.push('Cancelled, with the Gaming Hall: ' + dropped.map(function (o) { return o.label || 'an order'; }).join('; ') + ' (it cost nothing).');
    /* Levels: the highest of a merge's halves. Repairs: the latest. A retired
       building's repairs don't pass to a starting facility. */
    if (isObj(s.facilityLevels)) {
      Object.keys(map).forEach(function (old) {
        if (!(old in s.facilityLevels)) return;
        var m = map[old];
        var lv = Number(s.facilityLevels[old]) || 1;
        delete s.facilityLevels[old];
        if (m.to && data.bastion.startingBuilt.indexOf(m.to) === -1) s.facilityLevels[m.to] = Math.max(Number(s.facilityLevels[m.to]) || 0, lv);
      });
    }
    if (isObj(s.repairs)) {
      Object.keys(map).forEach(function (old) {
        if (!(old in s.repairs)) return;
        var m = map[old];
        var until = s.repairs[old];
        delete s.repairs[old];
        if (m.to && data.bastion.startingBuilt.indexOf(m.to) === -1 && okDay(until)) s.repairs[m.to] = Math.max(okDay(s.repairs[m.to]) ? s.repairs[m.to] : 0, until);
      });
    }
    s.legacyFacilities = legacy;
    s.archivedFacilities = archived;
    s.v = 3;
    s.migration = { v3: { day: day, lines: lines, shown: !lines.length } };
    if (lines.length) {
      if (!arr(s.log)) s.log = [];
      s.log.unshift({ title: 'Facilities', body: 'The facilities overhaul (13 October 2026): ' + lines.join(' '), at: Date.now(), day: day });
    }
    return { save: s, lines: lines };
  };

  /* Built facilities default to level 1 (old ensureDiplomacyState 1543-1547). */
  R.ensureLevels = function (s, data) {
    if (!isObj(s.facilityLevels)) s.facilityLevels = {};
    R.builtFacilityIds(s, data).forEach(function (id) {
      if (s.facilityLevels[id] === undefined || s.facilityLevels[id] === null) s.facilityLevels[id] = 1;
    });
  };

  /* ---------- Saves ---------- */
  function arr(v) { return Array.isArray(v) ? v : null; }
  function numMap(src, keys, min, max, fallback) {
    var out = {};
    keys.forEach(function (k) { out[k] = clampInt(src && src[k] !== undefined && src[k] !== null ? src[k] : fallback, min, max); });
    return out;
  }
  var CLAN_KEYS = ['blackstone', 'bacca', 'farmer', 'slade', 'molten', 'rowthorn', 'karr'];

  /* Load a save over the defaults. Every field comes back, with safe
     defaults (BAS-01: identity, war log and diplomacy were dropped before).
     The treasury is floored at 0 when loaded, as before (B17). */
  R.fromSave = function (saved, data) {
    var d = R.defaultState(data);
    /* A save from before the Strip Back Overhaul (v 2 or 3, or a v 4 that an
       older copy of the suite has overwritten, so it holds things the
       Bastion no longer has) is converted first, once: v 2 to v 3
       (R.migrateToV3), then v 3 to v 4 (R.migrateToV4, which runs the older
       step itself for a v 2 save). The Bastion's own screen converts it
       before this, so it can check the result and keep a copy
       (tools/bastion/tool.js); this chain is for everything else that reads
       a save (the Beast Handler on the laptop), in memory only. */
    var s = saved;
    if (R.needsStripBack(s, data)) s = R.migrateToV4(s, data).save;
    d.treasuryGP = clampInt(s.treasuryGP === undefined || s.treasuryGP === null ? 0 : s.treasuryGP, 0);
    d.partyLevel = clampInt(s.partyLevel === undefined || s.partyLevel === null ? 7 : s.partyLevel, 1, 20);
    if (arr(s.builtFacilities)) d.builtFacilities = s.builtFacilities.slice();
    if (arr(s.builtExtras)) d.builtExtras = s.builtExtras.slice();
    if (arr(s.builtPlots)) d.builtPlots = s.builtPlots.slice();
    if (isObj(s.facilityLevels)) d.facilityLevels = Object.assign({}, s.facilityLevels);
    if (arr(s.pendingOrders)) d.pendingOrders = s.pendingOrders.filter(isObj).map(function (o) { return cleanOrderInputs(o); });
    d.day = Math.max(1, dayNum(s.day, 1));
    d.anchored = s.anchored === true;
    if (isObj(s.defenders)) {
      d.defenders = {
        count: clampInt(s.defenders.count === undefined || s.defenders.count === null ? 0 : s.defenders.count, 0),
        armed: !!s.defenders.armed,
        patrolUntil: dayNum(s.defenders.patrolUntil, 0)
      };
    }
    if (arr(s.defenderBeasts)) d.defenderBeasts = s.defenderBeasts.filter(isObj);
    if (arr(s.military)) d.military = s.military.filter(isObj);
    if (arr(s.warehouse)) d.warehouse = R.cleanWarehouse(s.warehouse, data);
    if (arr(s.artisanTools)) d.artisanTools = s.artisanTools.map(function (x) { return typeof x === 'string' ? x : ''; });
    d.favour = numMap(s.favour, ['telluria', 'aurush', 'pelagos'], 0, 100, 0);
    d.politicalCapital = numMap(s.politicalCapital, CLAN_KEYS, -100, 100, 0);
    if (isObj(s.tradeNetwork)) {
      d.tradeNetwork = Object.assign(R.defaultTradeNetwork(), s.tradeNetwork);
      d.tradeNetwork.routes = arr(s.tradeNetwork.routes) ? s.tradeNetwork.routes.filter(isObj) : [];
    }
    if (isObj(s.arbitration)) {
      d.arbitration = Object.assign({ queue: [] }, s.arbitration);
      d.arbitration.queue = arr(s.arbitration.queue) ? s.arbitration.queue.filter(isObj) : [];
    }
    if (isObj(s.diplomacy)) {
      var dip = R.defaultDiplomacy();
      ['agreements', 'delegations', 'summits', 'arbitrations', 'consortiums'].forEach(function (k) {
        if (arr(s.diplomacy[k])) dip[k] = s.diplomacy[k].filter(isObj);
      });
      if (typeof s.diplomacy.rep === 'number') dip.rep = s.diplomacy.rep;
      if (isObj(s.diplomacy.cooldowns)) dip.cooldowns = Object.assign({}, s.diplomacy.cooldowns);
      if (typeof s.diplomacy.tokens === 'number') dip.tokens = s.diplomacy.tokens;
      d.diplomacy = dip;
    }
    if (arr(s.log)) d.log = s.log.filter(isObj);
    /* A Mercenary Brigade (archived in Build 3) becomes Unsworn: the screen
       says so once and the Day Log keeps its name (R.formerBrigade). */
    if (isObj(s.organization) && s.organization.type !== 'merc') {
      var o = s.organization;
      d.organization = {
        type: o.type === 'clan' ? 'clan' : 'unsworn',
        name: typeof o.name === 'string' ? o.name : '',
        chief: typeof o.chief === 'string' ? o.chief : '',
        motto: typeof o.motto === 'string' ? o.motto : '',
        foundedAtDay: dayNum(o.foundedAtDay, null)
      };
    }
    if (s.clanHonor !== undefined && s.clanHonor !== null) d.clanHonor = clampInt(s.clanHonor, 0, 100);
    d.honourRespectByClan = numMap(s.honourRespectByClan, CLAN_KEYS, -5, 5, 0);
    d.trustedClientsByClan = numMap(s.trustedClientsByClan, CLAN_KEYS, 0, 100, 50);
    if (arr(s.warLog)) d.warLog = s.warLog.filter(isObj);
    if (isObj(s.dayInProgress) && typeof s.dayInProgress.stage === 'string') {
      var dip = s.dayInProgress;
      d.dayInProgress = {
        day: Math.max(1, dayNum(dip.day, d.day)),
        stage: DAY_STAGES.indexOf(dip.stage) === -1 ? 'orders' : dip.stage,
        skipped: arr(dip.skipped) ? dip.skipped.slice() : [],
        /* The day's attack roll has been made, so it can't be made again. */
        attackRolled: dip.attackRolled === true,
        news: arr(dip.news) ? dip.news.filter(function (x) { return typeof x === 'string'; }) : []
      };
    }
    if (arr(s.word)) {
      d.word = s.word.filter(function (w) { return isObj(w) && Array.isArray(w.lines); }).map(function (w) {
        return { day: dayNum(w.day, d.day), lines: w.lines.filter(function (x) { return typeof x === 'string'; }) };
      });
    }
    d.wars = cleanWars(s.wars, d.day);
    d.repairs = cleanRepairs(s.repairs, data);
    d.legacyFacilities = arr(s.legacyFacilities) ? s.legacyFacilities.filter(function (x) { return typeof x === 'string'; }) : [];
    d.archivedFacilities = arr(s.archivedFacilities) ? s.archivedFacilities.filter(isObj) : [];
    d.migration = isObj(s.migration) ? s.migration : null;
    d.research = R.cleanResearch(s.research, data);
    d.bridge = R.cleanBridge(s.bridge);
    /* The creatures (pull request 7), before the war's records, which read them. */
    d.creatures = R.cleanCreatures(s.creatures, d.day);
    /* The Beast Handler's record (tools/beasthandler/bastion-link.js): only if the save has one. */
    if (isObj(s.beast) && R.cleanBeast) d.beast = R.cleanBeast(s.beast);
    d.greatRites = R.cleanGreatRites(s.greatRites);
    d.dmEdits = R.cleanDmEdits(s.dmEdits);
    d.diplomaticRecords = R.cleanDiplomaticRecords ? R.cleanDiplomaticRecords(s.diplomaticRecords, d.day, data) : (isObj(s.diplomaticRecords) ? s.diplomaticRecords : { next: 1, list: [] });
    if (arr(s.militaryActions)) d.militaryActions = s.militaryActions.filter(isObj);
    /* Port Charters, ships at sea, standing shipments and sales (pull
       request 5, commerce-rules.js). */
    if (R.cleanCommerce) R.cleanCommerce(d, data);
    /* The Courier Exchange's parcels (pull request 6, courier-rules.js). */
    if (R.cleanCourier) R.cleanCourier(d, data);
    R.normalizeBuiltExtras(d);
    tidyPlots(d, data);
    R.ensureLevels(d, data);
    /* The war's records (missions, recovery, depleted regiments, Military
       Actions, including upgrading phase 1 ones) are tidied last, by
       war-campaign-rules.js, as they need everything else loaded. */
    if (R.normalizeWar) R.normalizeWar(d, s, data);
    return d;
  };
  R.toSave = function (state) { return TSI.clone(state); };

  /* ---------- Scores set by hand in the DM doc (Harry, 19 October 2026) ----------
     The DM doc keeps a list of edits (shared/js/dmdoc-rules.js). Each is
     applied here once: the score is set, the Day Log says what it was and
     is now, and a receipt (dmEdits.done[id]) is kept in the same save, so a
     reload or a second look can't apply it again. An edit that can't be
     used (a Clan or value this copy doesn't know) is refused for good, with
     a receipt saying why; nothing changes. */
  var DM_RECEIPTS_MAX = 300;
  R.cleanDmEdits = function (raw) {
    var done = {};
    var src = isObj(raw) && isObj(raw.done) ? raw.done : {};
    Object.keys(src).forEach(function (id) {
      var r = src[id];
      if (!isObj(r)) return;
      done[id] = {
        r: r.r === 'refused' ? 'refused' : 'applied',
        at: typeof r.at === 'number' ? r.at : 0,
        day: typeof r.day === 'number' ? r.day : null,
        kind: String(r.kind || '').slice(0, 10), key: String(r.key || '').slice(0, 20),
        was: typeof r.was === 'number' ? r.was : 0, now: typeof r.now === 'number' ? r.now : 0,
        why: String(r.why || '').slice(0, 200)
      };
    });
    var ids = Object.keys(done);
    if (ids.length > DM_RECEIPTS_MAX) {
      ids.sort(function (a, b) { return done[a].at - done[b].at; }).slice(0, ids.length - DM_RECEIPTS_MAX).forEach(function (id) { delete done[id]; });
    }
    return { done: done };
  };
  R.applyDmEdits = function (s, edits, now) {
    var out = { changed: false, lines: [], refused: 0 };
    var D = TSI.dmDocRules;
    if (!D || !Array.isArray(edits)) return out;
    if (!isObj(s.dmEdits) || !isObj(s.dmEdits.done)) s.dmEdits = R.cleanDmEdits(s.dmEdits);
    var at = now === undefined ? Date.now() : now;
    edits.slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); }).forEach(function (e) {
      if (!isObj(e) || typeof e.id !== 'string' || Object.prototype.hasOwnProperty.call(s.dmEdits.done, e.id)) return;
      var c = D.checkEdit(e.kind, e.key, e.value);
      var rec = { r: 'applied', at: at, day: typeof s.day === 'number' ? s.day : null, kind: String(e.kind || ''), key: String(e.key || ''), was: 0, now: 0, why: '' };
      if (!c.ok) {
        rec.r = 'refused';
        rec.why = c.message;
        out.refused += 1;
      } else {
        var map = e.kind === 'pc' ? 'politicalCapital' : e.kind === 'hr' ? 'honourRespectByClan' : 'favour';
        if (!isObj(s[map])) s[map] = {};
        rec.was = clampInt(s[map][e.key] || 0, D.EDIT_KINDS[e.kind].min, D.EDIT_KINDS[e.kind].max);
        s[map][e.key] = c.value;
        rec.now = c.value;
        var unit = e.kind === 'favour' ? '%' : '';
        var line = D.EDIT_KINDS[e.kind].label + ' for ' + D.keyName(e.kind, e.key) + ' set by the DM: ' + rec.was + unit + ' to ' + c.value + unit + '.';
        R.log(s, 'DM doc', line, at);
        out.lines.push(line);
      }
      s.dmEdits.done[e.id] = rec;
      out.changed = true;
    });
    return out;
  };

  /* ---------- The Explorer link (pull request 4 of the facilities overhaul) ----------
     8 Explorer event moments send a change of 1 in a Clan's Honour/Respect
     (Harry, 13 October 2026). The Bastion applies each once, at a safe
     moment (when it's idle, after it reads the Explorer's day, and at the
     start of each day it passes), and keeps a receipt (shared/js/bridge-rules.js). */

  /* The receipts, as saved. Every entry is kept, tidied but never dropped:
     a lost receipt is the one way a change could count twice. fresh is
     kept only if it was saved as true (a Bastion that hasn't yet read the
     Explorer's day since it started from nothing); a save from before the
     link has none, so it applies the Explorer's new changes. */
  function txt(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  /* Words from a save: no markup brackets, control or direction-changing characters, tidy spaces, at most max letters. */
  function words(v, max) {
    return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
  }
  function numOr(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }
  R.cleanBridge = function (src) {
    var out = { fresh: false, done: {} };
    if (!isObj(src)) return out;
    out.fresh = src.fresh === true;
    if (isObj(src.done)) {
      Object.keys(src.done).forEach(function (id) {
        var r = isObj(src.done[id]) ? src.done[id] : {};
        out.done[id] = {
          r: ['applied', 'refused', 'skipped'].indexOf(r.r) !== -1 ? r.r : 'refused',
          day: dayNum(r.day, null),
          at: numOr(r.at, 0),
          clan: txt(r.clan, 40),
          hr: numOr(r.hr, 0),
          was: numOr(r.was, 0),
          now: numOr(r.now, 0),
          text: txt(r.text, 200),
          why: txt(r.why, 200)
        };
        /* A Port Charter's receipt (pull request 5) also says which port, and
           whether the Bastion already held it. Other receipts are as before. */
        if (r.type === 'charter') {
          out.done[id].type = 'charter';
          out.done[id].port = txt(r.port, 40);
          out.done[id].held = r.held === true;
        }
        /* A parcel pickup's receipt (pull request 6) says which parcel and
           town, and whether it was already recorded as collected. */
        if (r.type === 'parcel_collected') {
          out.done[id].type = 'parcel_collected';
          out.done[id].parcel = txt(r.parcel, 40);
          out.done[id].point = txt(r.point, 40);
          out.done[id].held = r.held === true;
        }
        /* A creature the DM granted (pull request 7) says which kind, its
           name, the creature it made and whether it was already held. */
        if (r.type === 'creature') {
          out.done[id].type = 'creature';
          out.done[id].species = txt(r.species, 40);
          out.done[id].name = txt(r.name, 40);
          out.done[id].creatureId = txt(r.creatureId, 80);
          out.done[id].held = r.held === true;
        }
        /* A Great Rite given to the party (pull request 8b) says which rite
           and whether it was already with the party. */
        if (r.type === 'rite') {
          out.done[id].type = 'rite';
          out.done[id].rite = txt(r.rite, 40);
          out.done[id].riteId = txt(r.riteId, 80);
          out.done[id].held = r.held === true;
        }
      });
    }
    return out;
  };

  /* ---------- The Shrines' Great Rites (pull request 8b) ----------
     s.greatRites: { id, rite, god, madeDay, status } in the order made.
     rite: 'earths_endurance', 'cleansing_radiance' or 'tides_passage';
     status 'waiting' (at the Ironbow). The Explorer's half (giving one to
     the party on an expedition) comes with pull request 8b's second part. */
  var RITES = { earths_endurance: 'telluria', cleansing_radiance: 'aurush', tides_passage: 'pelagos' };
  R.RITE_NAMES = { earths_endurance: 'Earth\'s Endurance', cleansing_radiance: 'Cleansing Radiance', tides_passage: 'Tide\'s Passage' };
  R.cleanGreatRites = function (list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).filter(function (g) {
      if (!isObj(g) || typeof g.id !== 'string' || !g.id || seen[g.id] || !RITES[g.rite]) return false;
      seen[g.id] = true;
      return true;
    }).map(function (g) {
      var out = { id: g.id, rite: g.rite, god: RITES[g.rite], madeDay: dayNum(g.madeDay, 1), status: g.status === 'assigned' ? 'assigned' : 'waiting' };
      if (out.status === 'assigned') out.assignedDay = dayNum(g.assignedDay, out.madeDay);
      return out;
    });
  };
  /* The Explorer's message says the DM gave this rite to the party: it is
     marked, once (a second time changes nothing and says so). */
  R.assignGreatRite = function (s, m) {
    var rid = TSI.bridge && TSI.bridge.riteIdOf ? TSI.bridge.riteIdOf(m.id) : '';
    var g = (Array.isArray(s.greatRites) ? s.greatRites : []).filter(function (x) { return isObj(x) && x.id === rid; })[0];
    if (!g) return { r: 'refused', why: 'The Ironbow has no Great Rite waiting under that name.' };
    if (g.rite !== m.rite) return { r: 'refused', why: 'It names ' + R.RITE_NAMES[m.rite] + ', but that rite is ' + R.RITE_NAMES[g.rite] + '.' };
    if (g.status === 'assigned') return { r: 'applied', held: true, rite: g.rite, riteId: g.id };
    g.status = 'assigned';
    g.assignedDay = s.day;
    return { r: 'applied', held: false, rite: g.rite, riteId: g.id };
  };
  /* The god whose Favour a Shrine's order spends ('shrine_aurush' → 'aurush'). */
  R.shrineGod = function (facId) { var m = /^shrine_(telluria|aurush|pelagos)$/.exec(String(facId || '')); return m ? m[1] : ''; };
  R.GOD_NAMES = { telluria: 'Telluria', aurush: 'Aurush', pelagos: 'Pelagos' };
  /* Why an order's Favour can't be paid now ('' if it can, or it costs none). */
  R.favourBlocker = function (s, fac, fn) {
    var cost = fn && fn.favourCost ? clampInt(fn.favourCost, 0, 100) : 0;
    var god = R.shrineGod(fac && fac.id);
    if (!cost || !god) return '';
    var have = clampInt(isObj(s.favour) ? s.favour[god] : 0, 0, 100);
    return have < cost ? 'Needs ' + cost + '% of ' + R.GOD_NAMES[god] + '\'s Favour; the Ironbow has ' + have + '%.' : '';
  };

  /* ---------- The creatures (pull request 7, Harry's answers of 14 October 2026) ----------
     s.creatures: each real, named animal the Ironbow keeps, { id, species,
     owner, name, status, home, grantedDay, housedDay, msgId }, always in this
     order, so loading a save twice gives the same save:
     - id: 'elara_wyvern' for Elara's wyvern (creatures-data.js unique); for a
       griffin or dire wolf the DM granted, made from the Explorer message's
       id (R.creatureIdFor), so it is the same every time and never shared;
     - species: 'wyvern', 'griffin' or 'dire_wolf' (one this copy doesn't
       know is kept, never dropped, and shown as unknown);
     - owner: 'elara' (the Explorer's hero) for her wyvern, '' for the
       Ironbow's own;
     - name: as the DM typed it (at most 40 letters), or '' (then the data's
       name, or "Griffin (granted Day 5)");
     - status: 'waiting' (granted, with no home yet) or 'housed';
     - home: the facility that houses it ('' while waiting). A creature
       stays housed, and keeps its home, if that building is demolished;
     - grantedDay, housedDay: Explorer days (housedDay null while waiting);
     - msgId: the Explorer message that granted it ('' for Elara's wyvern).
     The cleaner lives here, not in creature-rules.js, because a top-level
     field R.fromSave doesn't know is dropped, and this file is always
     loaded (the Explorer loads it to check a campaign file). */
  /* ---------- A creature's development (Wyvern Roost: Bonding, Training & Rider Mastery, 20 October 2026) ----------
     An optional extra on a creature, kept whole by the cleaner below (a
     field this list doesn't know is dropped on every reload, so everything
     the Roost adds lives here, never beside the creature):
     development: { version, handlerId, bond: { level 0-5, ready: the level a
     finished programme has made ready for the DM to confirm, or null },
     temperament: { dominant, attachment, trigger } (the DM's own words),
     training: { <programme id>: { day } } (each once, for good), harness:
     { fitted, paidGP, fittedDay }, firstFlight: { approved, day, handlerId },
     handlerHistory: [{ handlerId, bond, fromDay, toDay, reason }], seq, chronicle:
     [{ id, day, cat, text, by, link, private? }], regional?, profileLog?,
     initiation?: { regional, rolls: { dominant, attachment, trigger }, day } } (private: a DM-only note,
     never shown to the player's Beast Handler companion; initiation: what the Bastion rolled for the
     beast's first meeting, set once (tools/beasthandler/bastion-link.js R.rollInitiation): the variety's
     id and the number each die showed, 0 for a line the DM had already written).
     Elara's wyvern is credited Bond 1 once, with one Chronicle line, the first
     time it is loaded or housed without a development; a creature whose
     development is already there is never reset. Any other creature gets one
     only when the DM first works with it (creature-rules.js). */
  R.BOND_NAMES = ['Unfamiliar', 'Acclimatised', 'Trusting', 'Bonded', 'Devoted', 'Legendary Partnership'];
  R.CHRONICLE_MAX = 500;
  /* Is this Chronicle entry marked DM only? It fails closed: true, 1, "true", "yes" and the like all count, so a
     hand-edited or imported file can never make a hidden note public by writing the flag a different way. */
  R.isPrivateNote = function (e) {
    var v = isObj(e) ? e.private : undefined;
    return v === true || v === 1 || (typeof v === 'string' && /^\s*(true|1|yes|y|private)\s*$/i.test(v));
  };
  R.newDevelopment = function (c, day) {
    var elara = !!c && c.id === 'elara_wyvern';
    var d = {
      version: 1,
      handlerId: elara ? 'elara' : '',
      bond: { level: elara ? 1 : 0, ready: null },
      temperament: { dominant: '', attachment: '', trigger: '' },
      training: {},
      harness: { fitted: false, paidGP: 0, fittedDay: null },
      firstFlight: { approved: false, day: null, handlerId: null },
      handlerHistory: [],
      seq: 0,
      chronicle: []
    };
    if (elara) d.chronicle.push({ id: 'ch-credit', day: dayNum(day, 1), cat: 'bond', text: 'Existing relationship credited; Bond 1 per campaign decision.', by: 'DM', link: '' });
    return d;
  };
  R.cleanDevelopment = function (raw) {
    var d = isObj(raw) ? raw : {};
    var level = clampInt(isObj(d.bond) ? d.bond.level : 0, 0, 5);
    var ready = isObj(d.bond) && Number(d.bond.ready) === level + 1 && level < 5 ? level + 1 : null;
    var training = {};
    if (isObj(d.training)) Object.keys(d.training).forEach(function (k) {
      if (/^[a-z0-9_]{1,40}$/.test(k) && isObj(d.training[k])) training[k] = { day: dayNum(d.training[k].day, 1) };
    });
    var t = isObj(d.temperament) ? d.temperament : {};
    var h = isObj(d.harness) ? d.harness : {};
    var f = isObj(d.firstFlight) ? d.firstFlight : {};
    var seen = {};
    var chronicle = (arr(d.chronicle) || []).filter(function (e) {
      if (!isObj(e) || typeof e.id !== 'string' || !e.id || seen[e.id] || typeof e.text !== 'string' || !e.text) return false;
      seen[e.id] = true;
      return true;
    }).map(function (e) {
      var out = { id: txt(e.id, 40), day: dayNum(e.day, 1), cat: txt(e.cat, 20), text: txt(e.text, 400), by: txt(e.by, 40), link: txt(e.link, 80) };
      /* A DM-only entry (Beast Handler, D6): the player's companion never shows it. Kept only when set, so older saves are unchanged. */
      if (R.isPrivateNote(e)) out.private = true;
      return out;
    });
    if (chronicle.length > R.CHRONICLE_MAX) chronicle = chronicle.slice(chronicle.length - R.CHRONICLE_MAX);
    var kept = {
      version: 1,
      handlerId: txt(d.handlerId, 40),
      bond: { level: level, ready: ready },
      temperament: { dominant: txt(t.dominant, 120), attachment: txt(t.attachment, 120), trigger: txt(t.trigger, 120) },
      training: training,
      harness: { fitted: h.fitted === true, paidGP: clampInt(h.paidGP, 0, 100000), fittedDay: h.fitted === true && isFinite(Number(h.fittedDay)) && h.fittedDay !== null ? dayNum(h.fittedDay, 1) : null },
      firstFlight: { approved: f.approved === true, day: f.approved === true && f.day !== null && isFinite(Number(f.day)) ? dayNum(f.day, 1) : null, handlerId: f.approved === true && typeof f.handlerId === 'string' ? txt(f.handlerId, 40) : null },
      handlerHistory: (arr(d.handlerHistory) || []).filter(isObj).slice(-20).map(function (x) {
        return { handlerId: txt(x.handlerId, 40), bond: clampInt(x.bond, 0, 5), fromDay: dayNum(x.fromDay, 1), toDay: dayNum(x.toDay, 1), reason: txt(x.reason, 300) };
      }),
      seq: clampInt(d.seq, 0, 1000000),
      chronicle: chronicle
    };
    /* Beast Handler (21 October 2026): the Regional Variety (a cosmetic line, never a stat) and a short
       note of each change to the profile lines (who, when, from, to), kept only when there is something to keep. */
    var regional = words(d.regional, 60);
    if (regional) kept.regional = regional;
    var plog = (arr(d.profileLog) || []).filter(isObj).slice(-40).map(function (x) {
      var change = {};
      ['dominant', 'attachment', 'trigger', 'regional'].forEach(function (f) {
        if (isObj(x.change) && isObj(x.change[f])) change[f] = { from: words(x.change[f].from, 120), to: words(x.change[f].to, 120) };
      });
      return { day: dayNum(x.day, 1), by: words(x.by, 40), change: change };
    }).filter(function (x) { return Object.keys(x.change).length; });
    if (plog.length) kept.profileLog = plog;
    /* Beast Handler (22 October 2026): what the Bastion rolled for the first meeting, kept once it is set (a field this
       cleaner does not list would be dropped on every load, and the roll would then be made again). The die numbers are
       whole numbers from 0 (no roll: the DM had written that line) up. */
    var ini = isObj(d.initiation) ? d.initiation : null;
    if (ini && typeof ini.regional === 'string' && /^[a-z0-9_]{1,40}$/.test(ini.regional)) {
      var rolls = isObj(ini.rolls) ? ini.rolls : {};
      kept.initiation = {
        regional: ini.regional,
        rolls: { dominant: clampInt(rolls.dominant, 0, 100), attachment: clampInt(rolls.attachment, 0, 100), trigger: clampInt(rolls.trigger, 0, 100) },
        day: dayNum(ini.day, 1)
      };
    }
    return kept;
  };
  R.CREATURE_KEYS = ['id', 'species', 'owner', 'name', 'status', 'home', 'grantedDay', 'housedDay', 'msgId'];
  R.cleanCreatures = function (src, today) {
    var out = [];
    var seen = {};
    var day = dayNum(today, 1);
    (arr(src) || []).forEach(function (c) {
      if (!isObj(c) || typeof c.id !== 'string' || !c.id) return;
      var id = c.id.slice(0, 80);
      if (Object.prototype.hasOwnProperty.call(seen, id)) return;
      seen[id] = true;
      var home = txt(c.home, 40);
      var status = c.status === 'housed' || c.status === 'waiting' ? c.status : (home ? 'housed' : 'waiting');
      var granted = dayNum(c.grantedDay, dayNum(c.housedDay, day));
      var rec = {
        id: id,
        species: txt(c.species, 40),
        owner: txt(c.owner, 40),
        name: txt(c.name, 40),
        status: status,
        home: status === 'housed' ? home : '',
        grantedDay: granted,
        housedDay: status === 'housed' ? dayNum(c.housedDay, granted) : null,
        msgId: txt(c.msgId, 80)
      };
      /* Its development, kept whole; Elara's wyvern is credited Bond 1 once. */
      if (isObj(c.development)) rec.development = R.cleanDevelopment(c.development);
      else if (id === 'elara_wyvern' && status === 'housed') rec.development = R.newDevelopment({ id: id }, c.housedDay !== undefined && c.housedDay !== null ? c.housedDay : day);
      out.push(rec);
    });
    return out;
  };

  /* Change a Clan's Honour/Respect by hr, kept within −5..+5. Returns
     { was, now, delta } (delta 0 when it was already at the limit), or
     null for a Clan the Bastion doesn't know. */
  R.adjustStanding = function (s, key, hr) {
    if (CLAN_KEYS.indexOf(key) === -1) return null;
    if (!isObj(s.honourRespectByClan)) s.honourRespectByClan = clanMap(0);
    var was = clampInt(s.honourRespectByClan[key] || 0, -5, 5);
    var now = clampInt(was + (Number(hr) || 0), -5, 5);
    s.honourRespectByClan[key] = now;
    return { was: was, now: now, delta: now - was };
  };

  function signedNum(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }
  function clanLabel(data, key) {
    var list = (data && data.bastion && data.bastion.clans) || [];
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return 'Clan ' + list[i].name;
    return 'Clan ' + (TSI.bridge ? TSI.bridge.clanName(key) : key);
  }

  /* Apply the Explorer's waiting changes (explorerSave: its save, as last
     read). Only once the Bastion has read the Explorer's day (anchored), and
     only changes dated on or before the Bastion's day. Each gets its receipt
     in the same state, so one save() keeps both. A Bastion starting from
     nothing (fresh) instead marks every change already sent as skipped, once
     (or, if there's no Explorer save yet, simply stops being fresh).
     Pull request 5 adds Port Charters (R.addCharter, commerce-rules.js):
     each is held once, and its receipt names the port. Pull request 6 adds
     parcels collected in the Explorer (R.collectParcel, courier-rules.js):
     the parcel is closed once, never touching Honour/Respect; a copy
     without the courier rules leaves the pickup waiting. Pull request 7 adds
     a griffin or a dire wolf the DM grants (R.addCreatureGrant,
     creature-rules.js): the Bastion holds it once, waiting for a home; a
     copy without the creature rules leaves the grant waiting. A kind of
     message from a newer copy of the suite waits, with no receipt.
     Returns { changed, applied: [lines], charters: [lines], parcels:
     [notices], creatures: [notices], skipped: n, refused: n, refusals:
     [sentences], skips: [sentences] }: refusals has one plain sentence for
     each change that couldn't be used, with its reason; skips has one for each
     kind of change skipped because it was sent before this Bastion started
     (R.settledNotices turns both into notices). */
  R.applyInbox = function (s, data, explorerSave, now) {
    var out = { changed: false, applied: [], charters: [], parcels: [], creatures: [], skipped: 0, refused: 0, refusals: [], skips: [] };
    var B = TSI.bridge;
    if (!B) return out;
    if (!isObj(s.bridge) || !isObj(s.bridge.done)) s.bridge = R.cleanBridge(s.bridge);
    /* No Explorer save at all: nothing can have been sent before this
       Bastion, so whatever comes later applies as normal. */
    if (s.bridge.fresh && !isObj(explorerSave)) {
      s.bridge.fresh = false;
      out.changed = true;
      return out;
    }
    if (!s.anchored) return out;
    var done = s.bridge.done;
    var at = now === undefined ? Date.now() : now;
    var day = s.day;
    function receipt(m, r, extra) {
      done[m.id] = Object.assign({
        r: r, day: day, at: at, clan: txt(m.clan, 40), hr: 0, was: 0, now: 0,
        text: txt(m.text, 200), why: ''
      }, extra || {});
      out.changed = true;
    }
    /* A Port Charter's receipt also names its port; a parcel pickup's names
       its parcel and town; a creature grant's its kind and name (in the order
       R.cleanBridge keeps them). */
    function charterExtra(m) {
      if (m.type === 'charter') return { type: 'charter', port: txt(m.port, 40), held: false };
      if (m.type === 'parcel_collected') return parcelExtra(m, null);
      if (m.type === 'creature') return creatureExtra(m, null);
      if (m.type === 'rite') return riteExtra(m, null);
      return {};
    }
    function riteExtra(m, res) {
      return { type: 'rite', rite: txt(m.rite, 40), riteId: txt(res ? res.riteId : (B.riteIdOf ? B.riteIdOf(m.id) : ''), 80), held: !!(res && res.held) };
    }
    function creatureExtra(m, res) {
      return { type: 'creature', species: txt(m.species, 40), name: txt(m.name, 40), creatureId: res ? txt(res.creature.id, 80) : '', held: !!(res && !res.added) };
    }
    function parcelExtra(m, res) {
      var pid = res ? res.parcel : (B.parcelIdOf ? B.parcelIdOf(m.id) : '') || txt(m.parcel, 40);
      return { type: 'parcel_collected', parcel: txt(pid, 40), point: txt(res ? res.point : m.point, 40), held: !!(res && res.held) };
    }
    function fromText(m) {
      return m.from && m.from.code ? m.from.code + (typeof m.day === 'number' ? ', ' + R.dayLabel(m.day) : '') : (typeof m.day === 'number' ? R.dayLabel(m.day) : 'the Explorer');
    }
    if (s.bridge.fresh) {
      var charters = 0;
      var newer = 0;
      var pickups = 0;
      var grants = 0;
      var rites = 0;
      B.outbox(explorerSave).forEach(function (m) {
        if (Object.prototype.hasOwnProperty.call(done, m.id)) return;
        receipt(m, 'skipped', Object.assign(charterExtra(m), { why: 'Sent before this Bastion started.' }));
        if (m.type === 'charter') charters += 1;
        else if (m.type === 'parcel_collected') pickups += 1;
        else if (m.type === 'creature') grants += 1;
        else if (m.type === 'rite') rites += 1;
        else if (B.waitsForNewer && B.waitsForNewer(m)) newer += 1;
        out.skipped += 1;
      });
      s.bridge.fresh = false;
      out.changed = true;
      var standing = out.skipped - charters - newer - pickups - grants - rites;
      /* The same skips as notices: what was skipped, why, and what to do. */
      function skipSaid(n, what, tail) {
        out.skips.push(n + ' ' + what + (n === 1 ? ' was' : ' were') + ' skipped, so nothing counts twice.' + (tail ? ' ' + tail : ''));
      }
      if (newer) skipSaid(newer, newer === 1 ? 'message from a newer copy of the suite, sent before this Bastion started,' : 'messages from a newer copy of the suite, sent before this Bastion started,');
      if (standing) skipSaid(standing, (standing === 1 ? 'change to Honour/Respect' : 'changes to Honour/Respect') + ', sent before this Bastion started,', standing === 1 ? 'Use Change a score in the DM doc if it should count.' : 'Use Change a score in the DM doc if they should count.');
      if (charters) skipSaid(charters, (charters === 1 ? 'Port Charter' : 'Port Charters') + ', sent before this Bastion started,', charters === 1 ? 'Grant it again in the Explorer if it should count.' : 'Grant them again in the Explorer if they should count.');
      if (pickups) skipSaid(pickups, (pickups === 1 ? 'parcel pickup' : 'parcel pickups') + ', collected before this Bastion started,', 'The items stay in the Travel bags.');
      if (grants) skipSaid(grants, (grants === 1 ? 'creature grant' : 'creature grants') + ', sent before this Bastion started,', grants === 1 ? 'Grant it again in the Explorer if it should count.' : 'Grant them again in the Explorer if they should count.');
      if (rites) skipSaid(rites, (rites === 1 ? 'Great Rite handover' : 'Great Rite handovers') + ', sent before this Bastion started,');
      if (newer) {
        R.log(s, 'From the Explorer', newer + (newer === 1 ? ' message' : ' messages') + ' from a newer copy of the suite, sent before this Bastion started, ' + (newer === 1 ? 'was' : 'were') + ' skipped, so nothing counts twice.', at);
      }
      if (standing) {
        R.log(s, 'From the Explorer', standing + (standing === 1 ? ' change' : ' changes') + ' to Honour/Respect, sent before this Bastion started, ' + (standing === 1 ? 'was' : 'were') + ' skipped, so nothing counts twice. Clan Influence lists ' + (standing === 1 ? 'it, to type in by hand if it should count.' : 'them, to type in by hand if they should count.'), at);
      }
      if (charters) {
        R.log(s, 'From the Explorer', charters + (charters === 1 ? ' Port Charter' : ' Port Charters') + ', sent before this Bastion started, ' + (charters === 1 ? 'was' : 'were') + ' skipped, so nothing counts twice. Clan Influence lists ' + (charters === 1 ? 'it: grant it again in the Explorer if it should count.' : 'them: grant them again in the Explorer if they should count.'), at);
      }
      /* A Bastion starting from nothing has no parcels, so a pickup sent
         before it changes nothing here: the items stay in the Travel bags. */
      if (pickups) {
        R.log(s, 'From the Explorer', pickups + (pickups === 1 ? ' parcel pickup' : ' parcel pickups') + ', collected before this Bastion started, ' + (pickups === 1 ? 'was' : 'were') + ' skipped, so nothing counts twice. Clan Influence lists ' + (pickups === 1 ? 'it' : 'them') + '; the items stay in the Travel bags.', at);
      }
      /* Griffins and dire wolves granted before this Bastion started (pull
         request 7): none is held, so none can count twice. */
      if (grants) {
        R.log(s, 'From the Explorer', grants + (grants === 1 ? ' creature grant' : ' creature grants') + ', sent before this Bastion started, ' + (grants === 1 ? 'was' : 'were') + ' skipped, so nothing counts twice. Clan Influence lists ' + (grants === 1 ? 'it: grant it again in the Explorer if it should count.' : 'them: grant them again in the Explorer if they should count.'), at);
      }
      /* A Great Rite given to the party before this Bastion started (pull
         request 8b): the Bastion holds none, so nothing counts twice. */
      if (rites) {
        R.log(s, 'From the Explorer', rites + (rites === 1 ? ' Great Rite handover' : ' Great Rite handovers') + ', sent before this Bastion started, ' + (rites === 1 ? 'was' : 'were') + ' skipped, so nothing counts twice.', at);
      }
      return out;
    }
    B.pending(explorerSave, done, day).forEach(function (m) {
      /* A kind of change from a newer copy of the suite: it waits, with no
         receipt, so that copy can still use it. */
      if (B.waitsForNewer && B.waitsForNewer(m)) return;
      var why = B.check(m);
      if (!why && m.type === 'charter') {
        if (!R.addCharter) return;
        var got = R.addCharter(s, m, day);
        receipt(m, 'applied', { type: 'charter', port: txt(m.port, 40), held: !got.added });
        var where = R.portWithClan(data, m.port, m.clan);
        var regFn = R.fn(R.facility(data, 'hall_of_emissaries'), 'register_port_charter');
        var regLevel = regFn && regFn.requiredFacilityLevel > 1 ? ' (Level ' + regFn.requiredFacilityLevel + ')' : '';
        var cline = 'Port Charter for ' + where + ' (' + fromText(m) + '): ' + (got.added
          ? 'the Bastion now holds it. Register it at the Hall of Emissaries' + regLevel + ' before the Dock ships cargo there.'
          : 'the Bastion already holds it, so nothing changed.');
        R.log(s, 'From the Explorer', cline + (m.text ? ' ' + txt(m.text, 200) : ''), at);
        R.addWord(s, 'From the Explorer: Port Charter for ' + where + (got.added ? '.' : ' (already held).'));
        out.charters.push(cline);
        return;
      }
      /* A parcel collected in the Explorer (pull request 6): the Bastion's
         own parcel record decides, and Honour/Respect never changes. A copy
         without the courier rules leaves it waiting, with no receipt. */
      if (!why && m.type === 'parcel_collected') {
        if (!R.collectParcel) return;
        var pr = R.collectParcel(s, data, m, fromText(m));
        receipt(m, pr.r, Object.assign(parcelExtra(m, pr), { why: pr.r === 'refused' ? pr.why : '' }));
        if (pr.r === 'refused') {
          out.refused += 1;
          out.refusals.push('A parcel pickup from the Explorer (' + fromText(m) + ') couldn\'t be used, so nothing changed: ' + pr.why);
          R.log(s, 'From the Explorer', 'A parcel pickup from the Explorer (' + fromText(m) + ') couldn\'t be used, so nothing changed: ' + pr.why, at);
          return;
        }
        R.log(s, 'From the Explorer', pr.line, at);
        if (!pr.held) {
          R.addWord(s, 'From the Explorer: ' + pr.word);
          out.parcels.push(pr.notice);
        }
        return;
      }
      /* A griffin or a dire wolf the DM granted (pull request 7): held once,
         waiting for a home, never touching Honour/Respect. A copy without
         the creature rules leaves it waiting, with no receipt. */
      if (!why && m.type === 'creature') {
        if (!R.addCreatureGrant) return;
        var cg = R.addCreatureGrant(s, data, m, day);
        receipt(m, 'applied', creatureExtra(m, cg));
        R.log(s, 'From the Explorer', R.creatureGrantLine(s, data, cg, fromText(m)) + (m.text ? ' ' + txt(m.text, 200) : ''), at);
        if (cg.added) {
          var notice = R.creatureGrantNotice(s, data, cg.creature);
          R.addWord(s, notice);
          out.creatures.push(notice);
        }
        return;
      }
      /* A Great Rite given to the party (pull request 8b): marked once, and
         Honour/Respect never changes. */
      if (!why && m.type === 'rite') {
        var rr = R.assignGreatRite(s, m);
        receipt(m, rr.r, Object.assign(riteExtra(m, rr), { why: rr.r === 'refused' ? rr.why : '' }));
        if (rr.r === 'refused') {
          out.refused += 1;
          out.refusals.push('A Great Rite handover from the Explorer (' + fromText(m) + ') couldn\'t be used, so nothing changed: ' + rr.why);
          R.log(s, 'From the Explorer', 'A Great Rite handover from the Explorer (' + fromText(m) + ') couldn\'t be used, so nothing changed: ' + rr.why, at);
          return;
        }
        R.log(s, 'From the Explorer', R.RITE_NAMES[rr.rite] + (rr.held ? ' was already marked as with the party, so nothing changed' : ' went with the party (' + fromText(m) + ')') + '.', at);
        if (!rr.held) R.addWord(s, 'From the Explorer: ' + R.RITE_NAMES[rr.rite] + ' went with the party.');
        return;
      }
      var res = why ? null : R.adjustStanding(s, m.clan, m.hr);
      if (!res) {
        why = why || 'It names a Clan the Bastion doesn\'t know.';
        receipt(m, 'refused', Object.assign(charterExtra(m), { why: why }));
        out.refused += 1;
        out.refusals.push('A change from the Explorer (' + fromText(m) + ') couldn\'t be used, so nothing changed: ' + why);
        R.log(s, 'From the Explorer', 'A change from the Explorer couldn\'t be used, so nothing changed: ' + why + (m.text ? ' (' + txt(m.text, 200) + ')' : ''), at);
        return;
      }
      receipt(m, 'applied', { hr: res.delta, was: res.was, now: res.now });
      var line = 'Honour/Respect ' + signedNum(m.hr) + ' with ' + clanLabel(data, m.clan) + ' (' + fromText(m) + ')' +
        (res.delta ? ': ' + signedNum(res.was) + ' → ' + signedNum(res.now) + '.' : ': already at ' + signedNum(res.now) + ', so it stays there.');
      R.log(s, 'From the Explorer', line + (m.text ? ' ' + txt(m.text, 200) : ''), at);
      R.addWord(s, 'From the Explorer: ' + line);
      out.applied.push(line);
    });
    return out;
  };

  /* The newest receipts first, for Clan Influence's "Changes from the
     Explorer" list: [{ id, r, day, clan, hr, was, now, text, why }]. */
  R.bridgeHistory = function (s, max) {
    var done = isObj(s.bridge) && isObj(s.bridge.done) ? s.bridge.done : {};
    var list = Object.keys(done).map(function (id) { return Object.assign({ id: id }, done[id]); });
    list.sort(function (a, b) { return (b.at || 0) - (a.at || 0) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0); });
    return typeof max === 'number' ? list.slice(0, max) : list;
  };

  /* ---------- What the Explorer link delivered, in words ----------
     (Strip Back Overhaul, step S02: replacement before removal. The list in
     Management, "Changes from the Explorer", and the notices read these, so
     Clan Influence can go without the Explorer's deliveries, refusals and
     skips losing their home. Plain functions: no screen, no clock, no dice.)

     R.bridgeChange(s, data, receipt) says one receipt (a record of
     s.bridge.done, with its id) as { id, result: 'applied' | 'skipped' |
     'refused', kind: 'standing' | 'charter' | 'parcel' | 'creature' | 'rite',
     head, day: number or null, dayText, text, why, tail }:
     - head: what it was ("Clan Farmer +1 (0 → +1)", "Port Charter: Goldport
       (Clan Molten)", "Skipped: Great Rite handover");
     - text: what the Explorer said about it, if anything;
     - why: for a skipped or refused one, always a reason (the receipt's own,
       or a plain one if an older copy left it out); '' for an applied one;
     - tail: for a skipped one, what to do about it, in words that name no
       panel that is going away ('' when there is nothing to do). */
  R.bridgeChange = function (s, data, r) {
    var B = TSI.bridge;
    r = isObj(r) ? r : {};
    var result = r.r === 'applied' || r.r === 'skipped' ? r.r : 'refused';
    var kind = r.type === 'charter' || r.type === 'creature' || r.type === 'rite' ? r.type : '';
    var made = null;
    /* An older copy of the suite can strip a receipt's kind: the Port Charter
       it made, or the parcel id in its own id, still say what it was. */
    if (!kind && R.charterById) made = R.charterById(s, r.id);
    if (!kind && made) kind = 'charter';
    var pid = !kind && B && B.parcelIdOf ? B.parcelIdOf(r.id) : '';
    var sent = pid && R.parcelById ? R.parcelById(s, pid) : null;
    if (!kind && (r.type === 'parcel_collected' || pid)) kind = 'parcel';
    if (!kind) kind = 'standing';
    var prefix = result === 'skipped' ? 'Skipped: ' : result === 'refused' ? 'Refused: ' : '';
    var clanKey = typeof r.clan === 'string' ? r.clan : '';
    var clanWord = clanKey && R.clanName ? R.clanName(data, clanKey) : '';
    var clan = clanWord ? 'Clan ' + clanWord : 'An unknown Clan';
    var head;
    var tail = '';
    if (kind === 'rite') {
      head = result === 'applied'
        ? 'Great Rite: ' + (R.RITE_NAMES[r.rite] || 'a Great Rite') + ' went with the party' + (r.held ? ' (already marked)' : '')
        : prefix + 'Great Rite handover';
    } else if (kind === 'creature') {
      head = R.creatureReceiptHead ? R.creatureReceiptHead(data, r) : prefix + 'creature granted';
      tail = 'Grant it again in the Explorer if it should count.';
    } else if (kind === 'parcel') {
      var town = R.courierPointName ? R.courierPointName(r.point || (sent ? sent.point : '')) : '';
      head = result === 'applied' ? 'Parcel collected: ' + town + (r.held ? ' (already recorded)' : '') : prefix + 'parcel collected at ' + town;
      tail = 'The items stay in the Travel bags.';
    } else if (kind === 'charter') {
      var what = 'Port Charter: ' + (R.portWithClan ? R.portWithClan(data, made ? made.port : r.port, made ? made.clan : r.clan) : String(r.port || ''));
      head = result === 'applied' ? what + (r.held ? ' (already held)' : '') : prefix + what;
      tail = 'Grant it again in the Explorer if it should count.';
    } else {
      head = result === 'applied'
        ? (r.hr ? clan + ' ' + signedNum(r.hr) + ' (' + signedNum(r.was) + ' → ' + signedNum(r.now) + ')' : clan + ': no change, already at ' + signedNum(r.now))
        : prefix + clan;
      tail = 'Use Change a score in the DM doc if it should count.';
    }
    var why = '';
    if (result !== 'applied') {
      why = typeof r.why === 'string' && r.why ? r.why : result === 'skipped' ? 'The Bastion skipped it, so nothing counts twice.' : 'The Bastion couldn\'t use it, so nothing changed.';
    }
    var day = typeof r.day === 'number' && isFinite(r.day) ? Math.trunc(r.day) : null;
    return {
      id: String(r.id || ''), result: result, kind: kind, head: head,
      day: day, dayText: day === null ? '' : R.dayLabel(day),
      text: typeof r.text === 'string' ? r.text : '',
      why: why, tail: result === 'skipped' && kind !== 'rite' ? tail : ''
    };
  };

  /* Every receipt, newest first, each said as R.bridgeChange does (the screen
     shows the first few, and the rest on request). */
  R.bridgeChanges = function (s, data) {
    return R.bridgeHistory(s).map(function (r) { return R.bridgeChange(s, data, r); });
  };

  /* The notices R.applyInbox's result calls for, as [{ message, type, title,
     id, timeout }] for TSI.notify: Port Charters, parcels, creatures and
     Honour/Respect that were applied; then, on their own, every change that
     couldn't be used (each with its reason) and every kind of change skipped
     because it was sent before this Bastion started (what to do about it). A
     refusal is never folded into an applied notice: it has its own, so its
     reason is not lost. */
  var NOTICE_SHOWN = 3;
  R.settledNotices = function (res) {
    var out = [];
    if (!isObj(res)) return out;
    var list = function (v) { return Array.isArray(v) ? v : []; };
    var look = 'Changes from the Explorer, in Management, lists ';
    if (list(res.charters).length) out.push({ message: 'From the Explorer: ' + res.charters.join(' '), type: 'info', title: 'Port Charter.', id: 'tsi-bas-charter', timeout: 14000 });
    if (list(res.parcels).length) out.push({ message: res.parcels.join(' '), type: 'info', title: 'Courier Exchange.', id: 'tsi-bas-courier', timeout: 14000 });
    if (list(res.creatures).length) out.push({ message: res.creatures.join(' '), type: 'info', title: 'Creatures.', id: 'tsi-bas-creature', timeout: 14000 });
    if (list(res.applied).length) {
      out.push({ message: 'From the Explorer: ' + res.applied.join(' ') + ' ' + look + (res.applied.length === 1 ? 'it.' : 'them.'), type: 'info', title: 'Honour/Respect.', id: 'tsi-bas-bridge', timeout: 12000 });
    }
    var refusals = list(res.refusals);
    if (refusals.length) {
      var more = refusals.length - NOTICE_SHOWN;
      out.push({
        message: refusals.slice(0, NOTICE_SHOWN).join(' ') + (more > 0 ? ' ' + more + (more === 1 ? ' more was' : ' more were') + ' refused too.' : '') + ' ' + look + (refusals.length === 1 ? 'it.' : 'them.'),
        type: 'warn', title: 'Not used.', id: 'tsi-bas-bridge-refused', timeout: 20000
      });
    } else if (res.refused) {
      out.push({ message: 'A change from the Explorer couldn\'t be used, so nothing changed. ' + look + 'it, with the reason.', type: 'warn', title: 'Not used.', id: 'tsi-bas-bridge-refused', timeout: 20000 });
    }
    var skips = list(res.skips);
    if (skips.length) out.push({ message: skips.join(' ') + ' ' + look + (res.skipped === 1 ? 'it.' : 'them.'), type: 'info', title: 'Skipped.', id: 'tsi-bas-bridge-skipped', timeout: 20000 });
    return out;
  };

  /* A finished order's result as a notice, for an order settled on its own
     (the Resolve button, outside a day passing: inside a day the result goes
     into "The Ironbow sends word…"). lines: [[title, body], …] as the order
     rules return them. { message, type, title, id, timeout }, or null when
     there is nothing to say. */
  R.resolveNotice = function (lines, orderId) {
    var bodies = (Array.isArray(lines) ? lines : []).map(function (l) { return Array.isArray(l) ? String(l[1] === undefined ? '' : l[1]).trim() : ''; }).filter(Boolean);
    if (!bodies.length) return null;
    var message = bodies.join(' ');
    return {
      message: message, type: /couldn.t be completed|can.t be/.test(message) ? 'warn' : 'info',
      title: 'Order resolved.', id: 'tsi-bas-resolved' + (orderId ? '-' + orderId : ''), timeout: 14000
    };
  };

  /* The wars, as saved: only known Clans, each with the day it began, the
     day of the latest war activity (never before the first, never after
     today) and the day of its next attack roll (a week on from today if
     it's missing). Anything damaged is dropped: that Clan is at peace. */
  function okDay(v) { return typeof v === 'number' && isFinite(v); }
  function cleanWars(src, day) {
    var out = {};
    if (!isObj(src)) return out;
    CLAN_KEYS.forEach(function (k) {
      var w = src[k];
      if (!isObj(w) || !okDay(w.since) || !okDay(w.last)) return;
      var since = Math.min(dayNum(w.since, day), day);
      var last = Math.max(since, Math.min(dayNum(w.last, day), day));
      out[k] = { since: since, last: last, next: okDay(w.next) ? dayNum(w.next, day + 7) : day + 7 };
    });
    return out;
  }
  /* The facilities Under Repair, as saved: only known facilities, each with
     the last day of its repairs as a whole number. Anything damaged is
     dropped: that facility is working. */
  function cleanRepairs(src, data) {
    var out = {};
    if (!isObj(src)) return out;
    Object.keys(src).forEach(function (id) {
      if (!R.facility(data, id) || !okDay(src[id])) return;
      out[id] = dayNum(src[id], 0);
    });
    return out;
  }

  /* A reason a save can't be used, or null. Anything that would stop the
     Bastion opening is refused, so another tool's file or a damaged one
     can't replace the Bastion (BAS-14). */
  R.saveProblem = function (s) {
    if (!isObj(s)) return 'It isn\'t a Bastion save.';
    if (R.isOldSave(s)) return 'It was saved before the Bastion counted in days (in Bastion turns), so it can\'t be used.';
    var marks = ['treasuryGP', 'partyLevel', 'day', 'builtExtras', 'pendingOrders', 'defenders', 'warehouse'];
    var found = marks.filter(function (k) { return k in s; }).length;
    if (found < 4) return 'It doesn\'t look like a Bastion save.';
    var lists = ['builtExtras', 'builtPlots', 'pendingOrders', 'defenderBeasts', 'military', 'warehouse', 'log', 'warLog', 'militaryActions', 'warRecovery', 'creatures', 'greatRites'];
    for (var i = 0; i < lists.length; i++) {
      if (lists[i] in s && !Array.isArray(s[lists[i]])) return 'Its ' + lists[i] + ' list is damaged.';
    }
    var maps = ['defenders', 'favour', 'politicalCapital', 'tradeNetwork', 'arbitration', 'diplomacy', 'organization', 'facilityLevels', 'warMissions', 'wars', 'repairs', 'bridge'];
    for (var j = 0; j < maps.length; j++) {
      if (maps[j] in s && s[maps[j]] !== null && !isObj(s[maps[j]])) return 'Its ' + maps[j] + ' record is damaged.';
    }
    if ('day' in s && isNaN(parseInt(String(s.day), 10))) return 'Its day number is damaged.';
    return null;
  };
  R.isSave = function (s) { return R.saveProblem(s) === null; };
  /* A Bastion saved in turns, before the days overhaul (it has no v: 2).
     It's set aside, not converted (Harry, 8 October 2026). */
  R.isOldSave = function (s) {
    return isObj(s) && s.v !== 2 && s.v !== 3 && s.v !== 4 && ('turn' in s || 'turnInProgress' in s);
  };
  R.isUi = function (v) { return isObj(v); };
  /* What the screen remembers (tsi.bastion.ui), since the new screen
     (Build 2, 8 October 2026): gridOpen, whether the facility grid is open
     (open at first), and warNoticed, the war pop-ups already seen. Anything
     else (the old panels' open or closed state) is dropped. */
  R.cleanUi = function (v) {
    var src = isObj(v) ? v : {};
    var out = { gridOpen: src.gridOpen !== false };
    if (isObj(src.warNoticed)) out.warNoticed = src.warNoticed;
    if (src.whSort === 'grouped') out.whSort = 'grouped';
    return out;
  };

  /* The Bastion's crest picture, saved apart from the Bastion as
     tsi.bastion.crest: { dataUrl, key, name, design? }. An uploaded picture
     is shrunk to 512 pixels a side; one from the Clan Crest Creator also
     keeps the Creator's design (its settings), so it can be re-edited. */
  R.isCrest = function (v) {
    return isObj(v) && typeof v.dataUrl === 'string' && /^data:image\//.test(v.dataUrl) && typeof v.key === 'string' &&
      (v.design === undefined || isObj(v.design));
  };
  /* A crest sent from the Clan Crest Creator (TSI.handoff 'crest': { id,
     at, name, dataUrl, design }) as the Bastion keeps it, or null if it
     isn't one: a PNG of at most about 3 MB, and a design that's a plain
     set of settings. */
  var CREST_HANDOFF_MAX = 3000000;
  R.crestFromHandoff = function (h) {
    if (!isObj(h) || typeof h.dataUrl !== 'string' || !/^data:image\/png;base64,/.test(h.dataUrl) || h.dataUrl.length > CREST_HANDOFF_MAX) return null;
    var name = typeof h.name === 'string' ? h.name.trim().slice(0, 80) : '';
    var c = { dataUrl: h.dataUrl, key: R.hashText(h.dataUrl), name: (name || 'Crest') + ' (Crest Creator).png' };
    if (isObj(h.design)) {
      var design = {};
      Object.keys(h.design).forEach(function (k) {
        var v = h.design[k];
        if (typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) design[k] = v;
      });
      c.design = design;
    }
    return c;
  };
  /* The name of a Mercenary Brigade in a save from before Build 3 (Builds 1
     and 2 still had Form Mercenary Brigade), or null: it loads as Unsworn. */
  R.formerBrigade = function (saved) {
    var o = isObj(saved) && isObj(saved.organization) ? saved.organization : null;
    if (!o || o.type !== 'merc') return null;
    return { name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'the Brigade' };
  };
  /* A short fingerprint of a picture, so a new one can be told from the old. */
  R.hashText = function (str) {
    var h = 5381;
    str = String(str || '');
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  };
  /* The War Table's battle map and settings (tsi.bastion.warMap and
     tsi.bastion.warTable), checked by war-table-rules.js. */
  function warTableRules() { return ns.warTableRules || null; }
  R.isWarMap = function (v) {
    var W = warTableRules();
    return W ? W.isMap(v) : (isObj(v) && typeof v.dataUrl === 'string' && /^data:image\//.test(v.dataUrl) && typeof v.key === 'string');
  };
  R.isWarTable = function (v) {
    var W = warTableRules();
    return W ? W.isSettings(v) : isObj(v);
  };

  /* The War Table's painted terrain (tsi.bastion.warTerrain): one painting
     per map, { [mapKey]: { cols, rows, cells } }, cells being a string of
     terrain codes (war-units-data.js), one per square, row by row. */
  R.isWarTerrain = function (v) {
    if (!isObj(v)) return false;
    var war = window.TSI_DATA && window.TSI_DATA.bastionWar;
    var codes = war ? war.terrain.map(function (t) { return t.code; }).join('') : null;
    return Object.keys(v).every(function (k) {
      var p = v[k];
      if (!isObj(p) || typeof p.cells !== 'string') return false;
      var cols = p.cols, rows = p.rows;
      if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > 200 || rows > 200) return false;
      if (p.cells.length !== cols * rows) return false;
      if (!codes) return true;
      for (var i = 0; i < p.cells.length; i++) if (codes.indexOf(p.cells.charAt(i)) === -1) return false;
      return true;
    });
  };

  R.importProblem = function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.key === 'tsi.bastion.state') {
        if (R.isOldSave(r.value)) return 'This file is from before the Bastion counted in days, so it can\'t be imported. Nothing was changed.';
        var p = R.saveProblem(r.value);
        if (p) return 'This file\'s Bastion isn\'t in the right form, so it wasn\'t imported. ' + p + ' Nothing was changed.';
      }
      if (r.key === 'tsi.bastion.ui' && !isObj(r.value)) return 'This file\'s panel settings aren\'t in the right form, so it wasn\'t imported. Nothing was changed.';
      if (r.key === 'tsi.bastion.crest' && !R.isCrest(r.value)) return 'This file\'s crest picture isn\'t in the right form, so it wasn\'t imported. Nothing was changed.';
      /* The War Table's three saves (tsi.bastion.warMap, .warTable, .warTerrain)
         are not checked any more (the Strip Back Overhaul, 22 October 2026):
         the war game is going, and an old backup must never be refused for
         them. If the War Table is still there it checks them itself when it
         opens; otherwise the Bastion sets them aside (STRIP_BACK_ORPHAN_KEYS). */
    }
    return null;
  };

  /* ---------- Facilities and construction ---------- */
  R.facility = function (data, id) {
    for (var i = 0; i < data.facilities.length; i++) if (data.facilities[i].id === id) return data.facilities[i];
    return null;
  };
  R.fn = function (fac, fnId) {
    var list = (fac && fac.functions) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === fnId) return list[i];
    return null;
  };

  /* Construction slots by party level (1503-1510). */
  R.constructionSlotsForLevel = function (level) {
    var lvl = clampInt(level, 1, 20);
    if (lvl >= 17) return 6;
    if (lvl >= 13) return 5;
    if (lvl >= 9) return 4;
    if (lvl >= 5) return 2;
    return 0;
  };
  /* Build time in days by the facility's required level (216-223; it was
     3 / 4 / 5 / 5 turns, now bastion-data.js time.buildDays). */
  R.buildDaysForRequiredLevel = function (requiredLevel, data) {
    var rl = Number(requiredLevel || 0);
    var rows = R.time(data).buildDays;
    for (var i = 0; i < rows.length; i++) if (rl >= rows[i].level) return clampInt(rows[i].days, 0);
    return 0;
  };
  /* Old saves' plain names become { facId, status: "built" } (229-237).
     The Development Plots (s.builtPlots, pull request 3) are the same. */
  /* In place, so a list held elsewhere stays the same list. */
  function normalList(list) {
    var out = Array.isArray(list) ? list : [];
    for (var i = 0; i < out.length; i++) {
      var x = out[i];
      if (!x) out[i] = '';
      else if (typeof x === 'string') out[i] = { facId: x, status: 'built' };
      else if (!(typeof x === 'object' && x.facId)) out[i] = '';
    }
    return out;
  }
  R.normalizeBuiltExtras = function (s) {
    s.builtExtras = normalList(s.builtExtras);
    s.builtPlots = normalList(s.builtPlots);
  };
  function extras(s) { return s.builtExtras.filter(function (x) { return x && typeof x === 'object' && x.facId; }); }
  function plotsOf(s) { return (s.builtPlots || []).filter(function (x) { return x && typeof x === 'object' && x.facId; }); }
  function allEntries(s) { return extras(s).concat(plotsOf(s)); }
  /* ---------- Development Plots (pull request 3; Harry's facility guide, 13 October 2026) ----------
     A second kind of construction slot, only for the facilities marked
     "plot" (the six economic ones). Plots open by party level
     (bastion-data.js developmentPlots: 0 / 2 / 4 / 6 from levels 1 / 9 / 13
     / 17). A plot facility in a construction slot (a Herbal Gardens built
     before plots existed) moves to the first free plot when there is one
     (R.settlePlots); it is never removed for lack of room. */
  R.plotsForLevel = function (level, data) {
    var lvl = clampInt(level, 1, 20);
    var rows = (data && data.bastion && arr(data.bastion.developmentPlots)) || [{ from: 1, plots: 0 }, { from: 9, plots: 2 }, { from: 13, plots: 4 }, { from: 17, plots: 6 }];
    var n = 0;
    rows.forEach(function (r) { if (lvl >= clampInt(r.from, 1, 20)) n = clampInt(r.plots, 0, 20); });
    return n;
  };
  R.isPlotFacility = function (data, facId) { var f = R.facility(data, facId); return !!(f && f.plot); };
  /* Where a facility sits: { kind: 'slot' | 'plot', index, entry }, or null. */
  R.facilityPlace = function (s, facId) {
    R.normalizeBuiltExtras(s);
    for (var i = 0; i < s.builtExtras.length; i++) if (s.builtExtras[i] && s.builtExtras[i].facId === facId) return { kind: 'slot', index: i, entry: s.builtExtras[i] };
    for (var j = 0; j < s.builtPlots.length; j++) if (s.builtPlots[j] && s.builtPlots[j].facId === facId) return { kind: 'plot', index: j, entry: s.builtPlots[j] };
    return null;
  };
  /* A save's plots as loaded: a facility that doesn't belong on a plot goes
     back to a construction slot (never dropped). */
  function tidyPlots(s, data) {
    s.builtPlots = s.builtPlots.map(function (x) {
      if (!x || R.isPlotFacility(data, x.facId) || !R.facility(data, x.facId)) return x;
      var free = s.builtExtras.indexOf('');
      if (free === -1) s.builtExtras.push(x); else s.builtExtras[free] = x;
      return '';
    });
  }
  /* Move plot facilities from construction slots to free plots, in slot
     order, keeping everything about them (it's all kept by facility).
     Returns [{ facId, fromSlot, toPlot }]. */
  R.settlePlots = function (s, data) {
    R.normalizeBuiltExtras(s);
    var moved = [];
    s.builtExtras.forEach(function (x, i) {
      if (!x || !R.isPlotFacility(data, x.facId)) return;
      var rows = R.plotRows(s, s.partyLevel, data).rows;
      var to = -1;
      for (var k = 0; k < rows.length; k++) if (rows[k].canBuild) { to = rows[k].index; break; }
      if (to === -1) return;
      s.builtPlots[to] = x;
      s.builtExtras[i] = '';
      moved.push({ facId: x.facId, fromSlot: i, toPlot: to });
    });
    return moved;
  };
  R.settleLine = function (data, moved) {
    return moved.map(function (m) { var f = R.facility(data, m.facId); return 'The ' + ((f && f.name) || m.facId) + ' moved to a Development Plot; its construction slot is free.'; }).join(' ');
  };
  /* Built or being built: can't be chosen again (240-246). */
  R.reservedFacilityIds = function (s, data) {
    R.normalizeBuiltExtras(s);
    var ids = data.bastion.startingBuilt.concat(allEntries(s).map(function (x) { return x.facId; }));
    return ids.filter(function (id, i) { return ids.indexOf(id) === i; });
  };
  /* The overlays to draw on the Bastion map: one per picture (two
     facilities sharing one are drawn once), in the data's order, each with
     the facilities it stands for and whether any of them is Under Repair. */
  R.mapOverlays = function (s, data) {
    var built = R.builtFacilityIds(s, data);
    var out = [];
    var byPic = {};
    ((data.bastion.map && data.bastion.map.overlays) || []).forEach(function (o) {
      if (!o || built.indexOf(o.fac) === -1) return;
      var e = byPic[o.pic];
      if (!e) { e = byPic[o.pic] = { pic: o.pic, facs: [], repair: false }; out.push(e); }
      e.facs.push(o.fac);
      if (R.underRepair(s, o.fac)) e.repair = true;
    });
    return out;
  };
  /* The map's name-and-level labels, shown while the facility grid is open
     (Harry, 13 October 2026): one per built facility with a position in
     bastion-data.js mapLabels (in pixels on the painting), in built order. */
  R.mapLabels = function (s, data) {
    var at = (data.bastion && data.bastion.mapLabels) || {};
    return R.builtFacilityIds(s, data).map(function (id) {
      var p = at[id];
      if (!isObj(p) || !okDay(p.x) || !okDay(p.y)) return null;
      var f = R.facility(data, id);
      return { fac: id, name: (f && f.name) || id, level: R.getFacilityLevel(s, id), x: p.x, y: p.y, repair: !!R.underRepair(s, id) };
    }).filter(Boolean);
  };
  /* Built and working (249-255). */
  R.builtFacilityIds = function (s, data) {
    R.normalizeBuiltExtras(s);
    var ids = data.bastion.startingBuilt.concat(allEntries(s).filter(function (x) { return x.status === 'built'; }).map(function (x) { return x.facId; }));
    return ids.filter(function (id, i) { return ids.indexOf(id) === i; });
  };
  /* Building work finished by today: each building whose ready day has
     come is built. Returns the facilities finished (258-282). */
  R.completeConstruction = function (s) {
    R.normalizeBuiltExtras(s);
    var completed = [];
    function finish(entry) {
      if (!entry || entry === '') return '';
      if (entry.status === 'building' && !(dayNum(entry.readyDay, s.day) > s.day)) {
        completed.push(entry.facId);
        return { facId: entry.facId, status: 'built' };
      }
      return entry;
    }
    s.builtExtras = s.builtExtras.map(finish);
    s.builtPlots = s.builtPlots.map(finish);
    return completed;
  };
  /* Days of building work left (0 once it's due). */
  R.buildDaysLeft = function (s, entry) {
    return entry && entry.status === 'building' ? Math.max(0, dayNum(entry.readyDay, s.day) - s.day) : 0;
  };

  /* The construction slots to show. Lowering the level no longer deletes
     buildings (BAS-04, B8): they're all kept and keep working, and any beyond
     the new limit (counting in slot order) are marked over capacity. Empty
     slots can only be built in while there's room; the screen hides the ones
     that can't. Only empty slots past the limit are dropped. */
  function rowsFor(list, max, kind) {
    while (list.length < max) list.push('');
    while (list.length > max && !list[list.length - 1]) list.pop();
    var used = list.filter(function (x) { return x && x.facId; }).length;
    var seen = 0;
    return {
      max: max,
      used: used,
      over: Math.max(0, used - max),
      rows: list.map(function (entry, i) {
        var occupied = !!(entry && entry.facId);
        var over = false;
        if (occupied) { over = seen >= max; seen += 1; }
        return { index: i, kind: kind, entry: occupied ? entry : null, overCapacity: over, canBuild: !occupied && used < max };
      })
    };
  }
  R.slotRows = function (s, level) {
    R.normalizeBuiltExtras(s);
    return rowsFor(s.builtExtras, R.constructionSlotsForLevel(level), 'slot');
  };
  /* The Development Plots to show, the same way (pull request 3). */
  R.plotRows = function (s, level, data) {
    R.normalizeBuiltExtras(s);
    return rowsFor(s.builtPlots, R.plotsForLevel(level, data), 'plot');
  };
  /* Build in a construction slot, or (a plot facility) in a Development
     Plot: slotIndex is the index in that list. kind ('slot' or 'plot'), if
     given, must match the facility. */
  R.startBuild = function (s, data, slotIndex, facId, kind) {
    if (!facId) return { ok: false };
    R.normalizeBuiltExtras(s);
    var fac = R.facility(data, facId);
    var req = Number(fac && fac.requiredLevel || 0);
    var name = (fac && fac.name) || facId;
    if (!fac) return { ok: false };
    var onPlot = !!fac.plot;
    if (kind && (kind === 'plot') !== onPlot) return { ok: false, message: onPlot ? 'The ' + name + ' is built on a Development Plot.' : 'The ' + name + ' is built in a construction slot, not on a Development Plot.' };
    var list = onPlot ? s.builtPlots : s.builtExtras;
    if (list[slotIndex]) return { ok: false };
    if (fac.inDevelopment) return { ok: false, message: 'The ' + name + ' is still in development: it can\'t be built yet.' };
    if (s.partyLevel < req) return { ok: false, message: 'Locked. ' + name + ' requires party level ' + req + '.' };
    if (R.reservedFacilityIds(s, data).indexOf(facId) !== -1) return { ok: false, message: 'That facility is already built or under construction.' };
    if (onPlot) {
      var pr = R.plotRows(s, s.partyLevel, data);
      if (!pr.rows[slotIndex] || !pr.rows[slotIndex].canBuild) return { ok: false, message: 'The ' + name + ' needs a free Development Plot: plots open at party level 9 (2), 13 (4) and 17 (6).' };
    }
    var days = R.buildDaysForRequiredLevel(req, data);
    if (days <= 0) {
      list[slotIndex] = { facId: facId, status: 'built' };
      return { ok: true, log: ['Construction', name + ' built instantly.'] };
    }
    list[slotIndex] = { facId: facId, status: 'building', startDay: s.day, readyDay: s.day + days };
    return { ok: true, log: ['Construction Started', name + ' is under construction (' + days + ' days: ready on Day ' + (s.day + days) + ').'] };
  };
  /* Demolish a facility in a construction slot or on a Development Plot,
     built or still being built (Harry, 13 October 2026). The five starting
     facilities can't be demolished. Its slot or plot is freed; orders pending
     there are cancelled (their gold isn't given back, as with Cancel: B9, but
     goods they hold go back to the Warehouse); its level and any repairs go.
     What it already made stays (the Warehouse, defenders, beasts, units),
     and the Hall's records and routes carry on. Returns { ok, log, cancelled, moved }
     or { ok: false, message }. */
  R.demolishFacility = function (s, data, facId) {
    R.normalizeBuiltExtras(s);
    var fac = R.facility(data, facId);
    var name = (fac && fac.name) || facId;
    if (data.bastion.startingBuilt.indexOf(facId) !== -1) return { ok: false, message: 'The ' + name + ' is one of the five starting facilities: it can\'t be demolished.' };
    var place = R.facilityPlace(s, facId);
    if (!place) return { ok: false, message: 'The ' + name + ' isn\'t built or being built.' };
    var building = place.entry.status === 'building';
    (place.kind === 'plot' ? s.builtPlots : s.builtExtras)[place.index] = '';
    var where = place.kind === 'plot' ? 'plot' : 'slot';
    var cancelled = s.pendingOrders.filter(function (o) { return o && o.facId === facId; });
    s.pendingOrders = s.pendingOrders.filter(function (o) { return !(o && o.facId === facId); });
    var held = [];
    cancelled.forEach(function (o) { if (arr(o.inputs)) held = held.concat(o.inputs); });
    var back = held.length ? R.returnGoods(s, data, held) : '';
    if (isObj(s.facilityLevels)) delete s.facilityLevels[facId];
    if (isObj(s.repairs)) delete s.repairs[facId];
    if (isObj(s.research)) delete s.research[facId];
    /* A freed plot takes a plot facility still waiting in a construction slot. */
    var moved = place.kind === 'plot' ? R.settlePlots(s, data) : [];
    var body = (building
      ? 'Building work on the ' + name + ' stopped; its ' + where + ' is free.'
      : 'The ' + name + ' was demolished; its ' + where + ' is free.' + (cancelled.length ? ' Cancelled: ' + cancelled.map(function (o) { return o.label; }).join('; ') + '.' : '') + (back ? ' ' + back : '')) +
      (moved.length ? ' ' + R.settleLine(data, moved) : '');
    return { ok: true, log: [building ? 'Construction Stopped' : 'Facility Demolished', body], cancelled: cancelled, moved: moved };
  };
  /* A facility's level, 1 to 5 (1 to 3 before the facilities overhaul's
     step 1b; only the Hall had levels then). */
  R.MAX_LEVEL = 5;
  R.getFacilityLevel = function (s, facId) { return clampInt(s.facilityLevels && s.facilityLevels[facId] !== undefined && s.facilityLevels[facId] !== null ? s.facilityLevels[facId] : 1, 1, R.MAX_LEVEL); };

  /* ---------- Upgrading a facility (step 1b, 13 October 2026) ----------
     One Upgrade order for every facility, the Hall included: a pending
     order (fnId "upgrade", meta.kind "upgrade") that raises the facility one
     level when it completes. Days to reach each level and the cost are one
     table (bastion-data.js levels: 7 / 14 / 21 / 28 days, no gold: D8). Not
     while Under Repair (D6); one at a time; it doesn't stop the facility's
     other orders. A Hall upgrade ordered before step 1b ("upgrade_hall")
     still completes, the same way. */
  function levelsTable(data) {
    var t = data.bastion && data.bastion.levels;
    return isObj(t) ? t : { max: R.MAX_LEVEL, upgradeDays: { 2: 7, 3: 14, 4: 21, 5: 28 }, upgradeCostGP: 0 };
  }
  /* ---------- Levels that replace each other (Strip Back Overhaul, step S04) ----------
     The Timber Yard & Sawmill, Fishery & Smokehouse, Stone Quarry & Masonworks
     and Weavers' Hall carry "levelOrders": "replace" in facilities-data.js: a
     level offers only the order(s) whose requiredFacilityLevel is that level,
     and an upgrade replaces the last level's order. The words below are made
     from the data, so a renamed order renames them. */
  R.replacesLevelOrders = function (fac) { return !!fac && fac.levelOrders === 'replace'; };
  function orderLevel(fn) {
    return clampInt(fn && fn.requiredFacilityLevel !== undefined && fn.requiredFacilityLevel !== null ? fn.requiredFacilityLevel : 1, 1, R.MAX_LEVEL);
  }
  /* The labels of the orders a level of the facility offers (data order). */
  R.levelOrderLabels = function (fac, level) {
    return ((fac && fac.functions) || []).filter(function (fn) {
      return fn && fn.id !== 'upgrade' && fn.id !== 'upgrade_hall' && !fn.retired && orderLevel(fn) === level;
    }).map(function (fn) { return fn.label || fn.id; });
  };
  /* "A", "A and B", "A, B and C". */
  R.joinNames = function (names) {
    var n = names.length;
    return n < 2 ? (names[0] || '') : names.slice(0, n - 1).join(', ') + ' and ' + names[n - 1];
  };
  /* What reaching a level does to the orders at a facility whose levels
     replace each other: { from, to, text } ("replaces Harvest Timber with Saw
     Lumber"), or null for any other facility, for Level 1, or a level with
     nothing to swap. */
  R.levelReplacement = function (data, facId, level) {
    var fac = R.facility(data, facId);
    if (!R.replacesLevelOrders(fac) || !(level > 1)) return null;
    var from = R.levelOrderLabels(fac, level - 1);
    var to = R.levelOrderLabels(fac, level);
    if (!from.length || !to.length) return null;
    return { from: from, to: to, text: 'replaces ' + R.joinNames(from) + ' with ' + R.joinNames(to) };
  };
  /* The question asked before such an upgrade, or null for any other: what the
     new level replaces and that the replaced order can't be started again
     (one already running still finishes). */
  R.upgradeReplaceNotice = function (s, data, facId) {
    var c = R.upgradeCheck(s, data, facId);
    if (!c.ok) return null;
    var swap = R.levelReplacement(data, facId, c.toLevel);
    if (!swap) return null;
    var fac = R.facility(data, facId);
    return 'Upgrade the ' + fac.name + ' to Level ' + c.toLevel + '? Level ' + c.toLevel + ' ' + swap.text + '. Once the upgrade finishes, ' +
      R.joinNames(swap.from) + ' can no longer be started; an order already running will still finish.';
  };
  /* What reaching a level gives (Harry, 18 October 2026): the orders that
     open at it, then the lines in data.bastion.levels.effects. An empty list
     means the level unlocks nothing yet. */
  R.levelUnlocks = function (data, facId, level) {
    var fac = R.facility(data, facId);
    var out = [];
    if (!fac) return out;
    /* A facility whose levels replace each other (levelOrders "replace", the
       Strip Back Overhaul's S04) says so, in one line, instead of listing the
       new order as an addition. */
    var swap = R.levelReplacement(data, facId, level);
    if (swap) out.push(swap.text.charAt(0).toUpperCase() + swap.text.slice(1));
    else (fac.functions || []).forEach(function (fn) {
      if (!fn || fn.id === 'upgrade' || fn.id === 'upgrade_hall') return;
      var req = clampInt(fn.requiredFacilityLevel === undefined || fn.requiredFacilityLevel === null ? 1 : fn.requiredFacilityLevel, 1, R.MAX_LEVEL);
      if (req === level && level > 1) out.push(fn.label || fn.id);
    });
    var fx = data && data.bastion && data.bastion.levelEffects;
    var lines = isObj(fx) && isObj(fx[facId]) ? fx[facId][level] : null;
    if (Array.isArray(lines)) lines.forEach(function (t) { if (typeof t === 'string' && t) out.push(t); });
    return out;
  };
  /* The Upgrade row's words: { next, nextText, later } for a facility at fromLevel.
     later: the nearest higher level that unlocks something, when the next unlocks nothing. */
  R.levelUnlockSummary = function (data, facId, fromLevel) {
    var max = clampInt(levelsTable(data).max || R.MAX_LEVEL, 1, R.MAX_LEVEL);
    var to = fromLevel + 1;
    if (to > max) return null;
    var list = R.levelUnlocks(data, facId, to);
    var out = { toLevel: to, unlocks: list, later: null, replaces: R.levelReplacement(data, facId, to) };
    if (!list.length) {
      for (var l = to + 1; l <= max; l++) {
        var more = R.levelUnlocks(data, facId, l);
        if (more.length) { out.later = { level: l, unlocks: more }; break; }
      }
    }
    return out;
  };
  R.upgradeDays = function (data, toLevel) {
    var d = levelsTable(data).upgradeDays || {};
    return clampInt(d[toLevel] === undefined || d[toLevel] === null ? 7 : d[toLevel], 1, 365);
  };
  function isUpgradeOrder(o) { return isObj(o) && ((isObj(o.meta) && o.meta.kind === 'upgrade') || o.fnId === 'upgrade_hall'); }
  R.isUpgradeOrder = isUpgradeOrder;
  /* The upgrade pending at a facility, or null. */
  R.upgradePending = function (s, facId) {
    return (s.pendingOrders || []).filter(function (o) { return isUpgradeOrder(o) && o.facId === facId; })[0] || null;
  };
  /* Can the facility be upgraded now? { ok, toLevel, days, costGP } or { ok: false, message, top? }. */
  R.upgradeCheck = function (s, data, facId) {
    var fac = R.facility(data, facId);
    if (!fac) return { ok: false, message: 'There\'s no such facility.' };
    if (R.builtFacilityIds(s, data).indexOf(facId) === -1) return { ok: false, message: 'The ' + fac.name + ' isn\'t built yet.' };
    var max = clampInt(levelsTable(data).max || R.MAX_LEVEL, 1, R.MAX_LEVEL);
    var cur = R.getFacilityLevel(s, facId);
    if (cur >= max) return { ok: false, top: true, message: 'The ' + fac.name + ' is at its highest level (' + max + ').' };
    var pend = R.upgradePending(s, facId);
    if (pend) return { ok: false, pending: pend, message: 'The ' + fac.name + ' is already being upgraded: ready on Day ' + pend.dueDay + '.' };
    var broken = repairRefusal(s, fac);
    if (broken) return broken;
    var to = cur + 1;
    return { ok: true, toLevel: to, days: R.upgradeDays(data, to), costGP: clampInt(levelsTable(data).upgradeCostGP || 0, 0) };
  };
  R.issueUpgrade = function (s, data, facId, rand) {
    var c = R.upgradeCheck(s, data, facId);
    if (!c.ok) return c;
    if (c.costGP > s.treasuryGP) return { ok: false, message: 'Not enough gp. Need ' + c.costGP + 'gp, you have ' + s.treasuryGP + 'gp.' };
    var fac = R.facility(data, facId);
    s.treasuryGP -= c.costGP;
    var label = fac.name + ': Upgrade to Level ' + c.toLevel;
    s.pendingOrders.push({ id: R.uid(rand), facId: facId, fnId: 'upgrade', chosen: null, optionLabel: null, notes: '', label: label, costGP: c.costGP, issuedDay: s.day, dueDay: s.day + c.days, meta: { kind: 'upgrade', toLevel: c.toLevel } });
    return { ok: true, log: ['Order Issued', label + ' (' + R.daysText(c.days) + ': due Day ' + (s.day + c.days) + ').'] };
  };
  /* ---------- Research (the facilities overhaul's pull request 2, 13 October 2026) ----------
     A facility with a tree (research-data.js) earns a research token at each
     level from 2 (Levels 2 to 5: four in all). A project is a pending order
     (fnId "research", meta.kind "research") costing the branch's gold for
     that stage and taking 7 / 14 / 21 days; it takes a token while it runs.
     One at a time at a facility. When it completes, the choice is recorded
     in s.research[facId][branchId] (the chosen ids, Stage I first). Undoing
     a stage frees its token and those of the stages above it; the gold and
     days spent aren't given back (as with Cancel: B9). Effects come only
     from the fixed list below, read from the data, never from the save. */
  function researchData(data) { return isObj(data.research) ? data.research : { trees: {}, stageDays: [7, 14, 21], needs: {} }; }
  R.researchTree = function (data, facId) {
    var t = researchData(data).trees;
    return isObj(t) && isObj(t[facId]) ? t[facId] : null;
  };
  function findBranch(tree, branchId) { return tree ? (tree.branches || []).filter(function (b) { return b.id === branchId; })[0] || null : null; }
  /* Where a choice sits: { branch, stageIdx, choice } or null. */
  function findChoice(tree, branchId, choiceId) {
    var b = findBranch(tree, branchId);
    if (!b) return null;
    for (var i = 0; i < (b.stages || []).length; i++) {
      var c = (b.stages[i].choices || []).filter(function (x) { return x.id === choiceId; })[0];
      if (c) return { branch: b, stageIdx: i, choice: c };
    }
    return null;
  }
  /* A save's research, kept only where the tree knows it, stage by stage. */
  R.cleanResearch = function (src, data) {
    var out = {};
    if (!isObj(src)) return out;
    Object.keys(src).forEach(function (facId) {
      var tree = R.researchTree(data, facId);
      if (!tree || !isObj(src[facId])) return;
      var fac = {};
      Object.keys(src[facId]).forEach(function (bid) {
        var b = findBranch(tree, bid);
        var list = arr(src[facId][bid]);
        if (!b || !list) return;
        var kept = [];
        for (var i = 0; i < list.length && i < (b.stages || []).length; i++) {
          var ok = (b.stages[i].choices || []).some(function (c) { return c.id === list[i]; });
          if (!ok) break;
          kept.push(list[i]);
        }
        if (kept.length) fac[bid] = kept;
      });
      if (Object.keys(fac).length) out[facId] = fac;
    });
    return out;
  };
  function picks(s, facId) { return isObj(s.research) && isObj(s.research[facId]) ? s.research[facId] : {}; }
  R.researchRunning = function (s, facId) {
    return (s.pendingOrders || []).filter(function (o) { return isObj(o) && o.facId === facId && isObj(o.meta) && o.meta.kind === 'research'; })[0] || null;
  };
  /* Tokens: one per level from Level 2; used by choices made and a project running. */
  R.researchTokens = function (s, data, facId) {
    var total = R.researchTree(data, facId) && R.builtFacilityIds(s, data).indexOf(facId) !== -1 ? Math.max(0, R.getFacilityLevel(s, facId) - 1) : 0;
    var p = picks(s, facId);
    var used = Object.keys(p).reduce(function (n, k) { return n + p[k].length; }, 0) + (R.researchRunning(s, facId) ? 1 : 0);
    return { total: total, used: used, free: Math.max(0, total - used) };
  };
  R.researchDays = function (data, stageIdx) {
    var d = researchData(data).stageDays || [7, 14, 21];
    return clampInt(d[stageIdx] === undefined ? 7 * (stageIdx + 1) : d[stageIdx], 1, 365);
  };
  R.researchNeedsText = function (data, key) {
    var n = researchData(data).needs || {};
    return n[key] || 'a part of the Bastion still to be built';
  };
  /* Each choice's state: 'done', 'running', 'other' (the other choice at
     that stage was taken), 'coming' (needs a part still to be built, so it
     can't be chosen and costs nothing), 'unreachable' (no choice before it
     can be researched),
     'locked' (the stage before isn't done), or 'open'. */
  R.researchChoiceState = function (s, data, facId, branchId, choiceId) {
    var tree = R.researchTree(data, facId);
    var at = findChoice(tree, branchId, choiceId);
    if (!at) return 'none';
    var done = picks(s, facId)[branchId] || [];
    if (done[at.stageIdx] === choiceId) return 'done';
    var run = R.researchRunning(s, facId);
    if (run && run.meta.branch === branchId && run.meta.choice === choiceId) return 'running';
    if (done[at.stageIdx] || (run && run.meta.branch === branchId && run.meta.stage === at.stageIdx)) return 'other';
    if (at.choice.needs) return 'coming';
    if (done.length < at.stageIdx) return R.researchStageReachable(tree, branchId, at.stageIdx, done) ? 'locked' : 'unreachable';
    return 'open';
  };
  /* Can a stage be reached at all? Every stage before it needs a choice taken
     or at least one choice that can really be researched (none "coming").
     Otherwise it is 'unreachable' (Harry, 18 October 2026): shown as not
     available rather than "after Stage II", which would never come. */
  R.researchStageReachable = function (tree, branchId, stageIdx, done) {
    var b = findBranch(tree, branchId);
    if (!b) return false;
    for (var i = 0; i < stageIdx; i++) {
      if (done && done[i]) continue;
      var ok = ((b.stages[i] && b.stages[i].choices) || []).some(function (c) { return !c.needs; });
      if (!ok) return false;
    }
    return true;
  };
  /* Can this choice be researched now? { ok, stageIdx, days, costGP } or { ok: false, message }. */
  R.researchCheck = function (s, data, facId, branchId, choiceId) {
    var tree = R.researchTree(data, facId);
    var fac = R.facility(data, facId);
    var at = findChoice(tree, branchId, choiceId);
    if (!fac || !at) return { ok: false, message: 'There\'s no such research.' };
    if (R.builtFacilityIds(s, data).indexOf(facId) === -1) return { ok: false, message: 'The ' + fac.name + ' isn\'t built yet.' };
    if (R.getFacilityLevel(s, facId) < 2) return { ok: false, message: 'Research opens at Level 2.' };
    var state = R.researchChoiceState(s, data, facId, branchId, choiceId);
    if (state === 'done') return { ok: false, message: at.choice.name + ' is already researched.' };
    if (state === 'running') return { ok: false, message: at.choice.name + ' is being researched now.' };
    if (state === 'other') return { ok: false, message: 'The other choice at this stage was taken: only one can be.' };
    if (state === 'coming') return { ok: false, message: 'Not available yet: it needs ' + R.researchNeedsText(data, at.choice.needs) + '. Nothing was spent.' };
    if (state === 'unreachable') return { ok: false, message: 'Not reachable yet: no choice at the stage before it can be researched. Nothing was spent.' };
    if (state === 'locked') return { ok: false, message: 'Research the stage before it on this branch first.' };
    var run = R.researchRunning(s, facId);
    if (run) return { ok: false, message: 'The ' + fac.name + ' is already researching ' + (run.meta.name || 'something') + ': ready on Day ' + run.dueDay + '.' };
    var broken = repairRefusal(s, fac);
    if (broken) return broken;
    if (R.researchTokens(s, data, facId).free < 1) return { ok: false, message: 'No research token free: the ' + fac.name + ' earns one at each level from 2 to 5.' };
    var cost = clampInt((at.branch.costs || [])[at.stageIdx] || 0, 0);
    if (cost > s.treasuryGP) return { ok: false, message: 'Not enough gp. Need ' + cost + 'gp, you have ' + s.treasuryGP + 'gp.' };
    return { ok: true, stageIdx: at.stageIdx, days: R.researchDays(data, at.stageIdx), costGP: cost };
  };
  R.startResearch = function (s, data, facId, branchId, choiceId, rand) {
    var c = R.researchCheck(s, data, facId, branchId, choiceId);
    if (!c.ok) return c;
    var fac = R.facility(data, facId);
    var at = findChoice(R.researchTree(data, facId), branchId, choiceId);
    s.treasuryGP -= c.costGP;
    var label = fac.name + ': Research ' + at.choice.name + ' (' + at.branch.name + ', Stage ' + ['I', 'II', 'III'][c.stageIdx] + ')';
    s.pendingOrders.push({ id: R.uid(rand), facId: facId, fnId: 'research', chosen: null, optionLabel: null, notes: '', label: label, costGP: c.costGP, issuedDay: s.day, dueDay: s.day + c.days,
      meta: { kind: 'research', branch: branchId, stage: c.stageIdx, choice: choiceId, name: at.choice.name } });
    return { ok: true, log: ['Research Started', label + ' (' + c.costGP + 'gp, ' + R.daysText(c.days) + ': ready on Day ' + (s.day + c.days) + ').'] };
  };
  R.completeResearch = function (s, data, order) {
    var m = order.meta || {};
    var at = findChoice(R.researchTree(data, order.facId), m.branch, m.choice);
    var label = order.label || 'Research';
    if (!at) return ['Research', label + ' → That research no longer exists; nothing changes.'];
    if (!isObj(s.research)) s.research = {};
    if (!isObj(s.research[order.facId])) s.research[order.facId] = {};
    var list = arr(s.research[order.facId][m.branch]) || [];
    if (list.length !== at.stageIdx) return ['Research', label + ' → The stage before it is no longer researched, so it can\'t be finished; nothing changes.'];
    list.push(at.choice.id);
    s.research[order.facId][m.branch] = list;
    return ['Research Complete', label + ' → ' + at.choice.name + ' is researched.'];
  };
  /* Undo a researched stage and any above it on that branch: their tokens come back. */
  R.undoResearch = function (s, data, facId, branchId, stageIdx) {
    var tree = R.researchTree(data, facId);
    var b = findBranch(tree, branchId);
    var list = b ? (picks(s, facId)[branchId] || []) : [];
    var i = clampInt(stageIdx, 0, 2);
    if (!b || !list[i]) return { ok: false, message: 'That stage isn\'t researched.' };
    var run = R.researchRunning(s, facId);
    if (run && run.meta.branch === branchId && run.meta.stage > i) return { ok: false, message: 'A later stage on this branch is being researched: cancel it first.' };
    var gone = list.slice(i).map(function (id) { return (findChoice(tree, branchId, id) || { choice: { name: id } }).choice.name; });
    s.research[facId][branchId] = list.slice(0, i);
    if (!s.research[facId][branchId].length) delete s.research[facId][branchId];
    if (!Object.keys(s.research[facId]).length) delete s.research[facId];
    var fac = R.facility(data, facId);
    return { ok: true, undone: gone, log: ['Research Undone', fac.name + ': ' + gone.join(', ') + (gone.length === 1 ? ' is' : ' are') + ' no longer researched; ' + (gone.length === 1 ? 'its token is' : 'their tokens are') + ' free again.'] };
  };
  /* Is a choice researched at a facility? And its name, for messages. */
  R.researched = function (s, facId, choiceId) {
    var p = picks(s, facId);
    return Object.keys(p).some(function (b) { return p[b].indexOf(choiceId) !== -1; });
  };
  R.researchChoiceName = function (data, facId, choiceId) {
    var tree = R.researchTree(data, facId);
    var found = null;
    (tree ? tree.branches : []).forEach(function (b) { if (!found) found = findChoice(tree, b.id, choiceId); });
    return found ? found.choice.name : choiceId;
  };
  /* The effects of everything researched at a facility (from the data). */
  R.researchEffects = function (s, data, facId) {
    var tree = R.researchTree(data, facId);
    var out = [];
    var p = picks(s, facId);
    Object.keys(p).forEach(function (bid) {
      p[bid].forEach(function (id) {
        var at = findChoice(tree, bid, id);
        if (at && !at.choice.needs) (at.choice.effects || []).forEach(function (e) { if (isObj(e)) out.push(e); });
      });
    });
    return out;
  };
  /* An order's days at a facility, with research: the biggest saving, never below its minimum. */
  R.orderDaysAt = function (s, data, fac, fn, chosen) {
    /* A choice can take its own days (the Herbal Gardens' Level 3-5 recipes). */
    var days = chosen && chosen.days ? R.orderDays(chosen) : R.orderDays(fn);
    if (!fac || !fn) return days;
    var best = null;
    R.researchEffects(s, data, fac.id).forEach(function (e) {
      if (e.type !== 'faster' || (e.fns || []).indexOf(fn.id) === -1) return;
      var min = clampInt(e.min === undefined ? 1 : e.min, 1, 365);
      var d = Math.max(Math.min(days, min), days - clampInt(e.days || 0, 0, 365));
      if (best === null || d < best) best = d;
    });
    return best === null ? days : best;
  };
  /* What an order's choice puts in the Warehouse, with research: { name, count }.
     A batch ("Rations (100)") can start bigger (batch) and grow by the
     biggest yield, rounded up; an item can come several at a time (output). */
  R.researchOutput = function (s, data, fac, fn, chosen, optionLabel) {
    var out = { name: optionLabel, count: 1 };
    var key = chosen && chosen.key ? chosen.key : null;
    if (!key || !fac || !fn) return out;
    var effects = R.researchEffects(s, data, fac.id).filter(function (e) { return e.fn === fn.id; });
    var batch = isObj(chosen.batch) ? chosen.batch : null;
    if (batch) {
      var qty = clampInt(batch.qty || 1, 1);
      effects.forEach(function (e) { if (e.type === 'batch' && e.key === key) qty = Math.max(qty, clampInt(e.qty || 1, 1)); });
      var pct = 0;
      effects.forEach(function (e) { if (e.type === 'yield' && (e.keys || []).indexOf(key) !== -1) pct = Math.max(pct, clampInt(e.pct || 0, 0, 1000)); });
      qty = Math.ceil(qty * (100 + pct) / 100);
      out.name = batch.name + ' (' + qty + (batch.unit ? ' ' + batch.unit : '') + ')';
    }
    effects.forEach(function (e) { if (e.type === 'output' && e.key === key) out.count = Math.max(out.count, clampInt(e.count || 1, 1, 100)); });
    return out;
  };

  /* An upgrade completing: the facility goes up one level (at most 5). */
  R.completeUpgrade = function (s, data, order) {
    var fac = R.facility(data, order.facId);
    var name = (fac && fac.name) || order.facId;
    var cur = R.getFacilityLevel(s, order.facId);
    if (cur >= R.MAX_LEVEL) return ['Upgrade', 'The ' + name + ' is already at its highest level.'];
    if (!isObj(s.facilityLevels)) s.facilityLevels = {};
    s.facilityLevels[order.facId] = cur + 1;
    return ['Order Completed', (order.label || name + ': Upgrade') + ' → The ' + name + ' is now Level ' + (cur + 1) + '.'];
  };

  /* ---------- Orders ---------- */
  /* What a function costs (4692-4725). */
  R.computeFnCost = function (s, fac, fn, chosen) {
    if (fac.id === 'armoury' && fn.id === 'arm_defenders') {
      var dyn = 100 + (s.defenders.count * 100);
      return { costGP: dyn, costText: dyn + 'gp (100 + defenders×100)' };
    }
    if (chosen && chosen.costGP !== undefined && chosen.costGP !== null) {
      return { costGP: Number(chosen.costGP) || 0, costText: (Number(chosen.costGP) || 0) + 'gp' };
    }
    if (fn.costGP !== undefined && fn.costGP !== null) {
      return { costGP: Number(fn.costGP) || 0, costText: (Number(fn.costGP) || 0) + 'gp' };
    }
    if (fn.costText) {
      var m = String(fn.costText).replace(/,/g, '').match(/(\d+)/);
      return { costGP: m ? Number(m[1]) : 0, costText: fn.costText };
    }
    return { costGP: 0, costText: '0gp' };
  };
  R.isEmissary = function (fac, fn) { return fac.id === 'hall_of_emissaries' && !!(fn.special && fn.special.type === 'emissary_action'); };
  /* An active summit cuts the cost of Hall actions (3308-3315). */
  R.withSummitDiscount = function (s, fac, fn, cost) {
    if (!R.isEmissary(fac, fn)) return cost;
    var summit = (s.diplomacy.summits || [])[0];
    if (summit && summit.costReductionPct) {
      var pct = clampInt(summit.costReductionPct, 0, 90);
      return Math.max(0, Math.floor(cost * (100 - pct) / 100));
    }
    return cost;
  };
  /* The tool tables that can be picked as artisan tools (3420-3422). */
  R.toolTableNames = function (tools) {
    return Object.keys(tools || {}).filter(function (k) { return /Tools$/.test(k) || /Supplies$/.test(k); });
  };
  /* What the Workshop can craft with the chosen artisan tools (4514-4528). */
  R.craftItems = function (s, tools) {
    var seen = {};
    (s.artisanTools || []).filter(Boolean).forEach(function (t) {
      (tools[t] || []).forEach(function (item) { seen[String(item)] = true; });
    });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
  };
  /* The choices a function's list shows. */
  R.fnOptions = function (s, data, fac, fn) {
    if (fac.id === 'workshop' && fn.id === 'craft') {
      return R.craftItems(s, data.tools).map(function (name) { return { label: name, craftItem: name }; });
    }
    /* The Hall's Register Port Charter: the Charters held and not yet
       registered or being registered (pull request 5). */
    if (fn.portCharter) {
      return (R.registrableCharters ? R.registrableCharters(s) : []).map(function (c) { return { label: 'Port Charter: ' + R.charterLabel(data, c), charterId: c.id }; });
    }
    /* The Griffin Tower's and Dire Wolf Den's House order: the creatures of
       its kind waiting for a home, and not being housed already (pull
       request 7, creature-rules.js). */
    if (fn.housesSpecies) return R.housingOptions ? R.housingOptions(s, data, fn.housesSpecies) : [];
    /* The War Room's Drill a Regiment: every regiment that can drill now;
       a Muster: the Recruit order's own list (pull request 8a,
       regiment-rules.js). */
    if (fn.drill) return R.drillOptions ? R.drillOptions(s, data) : [];
    /* The Wyvern Roost's training: every housed wyvern (creature-rules.js). */
    if (fn.trains) return R.trainingOptions ? R.trainingOptions(s, data, fac, fn) : [];
    if (fn.muster) return R.musterChoices ? R.musterChoices(data) : [];
    return fn.options || [];
  };
  function orderLabel(fac, fn, optionLabel) {
    /* A production order with only one choice doesn't repeat it ("Timber Yard & Sawmill: Harvest Timber"). */
    if (fn.production && (fn.options || []).length === 1) return fac.name + ': ' + fn.label;
    if (fn.production && optionLabel) return fac.name + ': ' + fn.label + ' → ' + optionLabel;
    return fac.name + ': ' + fn.label + (optionLabel ? ' (' + optionLabel + ')' : '');
  }
  function pendingSame(s, facId, fnId) {
    return s.pendingOrders.some(function (o) { return o.facId === facId && o.fnId === fnId; });
  }

  /* ---------- Under Repair (Harry, 4 October 2026) ----------
     A lost Defend Bastion leaves some facilities Under Repair
     (war-campaign-rules.js): s.repairs = { facId: untilDay }. While the
     day is at or before untilDay, the facility takes no orders, and orders
     already running there wait. Returns untilDay, or 0. */
  R.underRepair = function (s, facId) {
    var u = isObj(s.repairs) ? s.repairs[facId] : undefined;
    return typeof u === 'number' && Number(s.day) <= u ? u : 0;
  };
  /* Why a facility can't take an order now, or null. */
  function repairRefusal(s, fac) {
    var until = R.underRepair(s, fac.id);
    return until ? { ok: false, message: 'The ' + fac.name + ' is Under Repair until Day ' + until + '.' } : null;
  }
  /* How many days an order takes (facilities-data.js days; at least 1). */
  R.orderDays = function (fn) { return clampInt(fn && fn.days !== undefined && fn.days !== null ? fn.days : 1, 1, 365); };

  /* Can this order be given here? The facilities overhaul keeps each
     merged order's old party level ("requiredPartyLevel") and keeps the
     Smithy's order only for a Bastion that had a Smithy ("onlyIfLegacy";
     hidden otherwise). Returns { ok } or { ok: false, hidden?, message }. */
  R.fnAvailable = function (s, fac, fn) {
    /* The Hall's own Upgrade, replaced by every facility's Upgrade in step 1b
       ("retired": one already ordered still completes). */
    if (fn && fn.retired) return { ok: false, hidden: true, message: 'That order has been replaced by Upgrade.' };
    /* An order whose effect has nothing to work on yet (pull request 8b:
       Bless Bastion Foundations): listed, never given. */
    if (fn && fn.waiting) return { ok: false, message: 'Not available yet', why: String(fn.waiting) };
    /* The Hall's Secure Trade Agreement (20 October 2026): no new ones; the
       running ones simply finish (R.tickDiplomacy). */
    if (fn && fn.retiredNote) return { ok: false, hidden: true, message: 'That order has been retired.', why: String(fn.retiredNote) };
    /* A facility whose levels replace each other (levelOrders "replace", the
       Strip Back Overhaul's S04) offers only the order(s) of its current level:
       the others are hidden, never deleted, so an order already pending still
       completes (R.fn finds it by id). */
    if (fac && fn && R.replacesLevelOrders(fac)) {
      var own = orderLevel(fn);
      if (own !== R.getFacilityLevel(s, fac.id)) return { ok: false, hidden: true, message: 'That order belongs to Level ' + own + '.' };
    }
    /* An order a facility level unlocks (the Hall's, and the production orders: pull request 3). */
    var need = clampInt(fn && fn.requiredFacilityLevel ? fn.requiredFacilityLevel : 1, 1, R.MAX_LEVEL);
    if (fac && need > 1 && R.getFacilityLevel(s, fac.id) < need) return { ok: false, message: 'Needs Level ' + need + '.' };
    if (fn && fn.onlyIfLegacy && (s.legacyFacilities || []).indexOf(fn.onlyIfLegacy) === -1) return { ok: false, hidden: true, message: 'That order isn\'t available here.' };
    var lvl = Number(fn && fn.requiredPartyLevel || 0);
    if (lvl && s.partyLevel < lvl) return { ok: false, message: 'Needs party level ' + lvl + '.' };
    return { ok: true };
  };

  /* Issue an order from a facility card (3247-3344). optionIdx is the list's choice. */
  R.issueOrder = function (s, data, facId, fnId, optionIdx, rand) {
    var fac = R.facility(data, facId);
    var fn = R.fn(fac, fnId);
    if (!fac || !fn) return { ok: false };
    var broken = repairRefusal(s, fac);
    if (broken) return broken;
    /* A Wyvern Roost training programme: one named wyvern, with every reason
       it can't be given said exactly (the level included). */
    if (fn.trains) {
      if (!R.issueTraining) return { ok: false, message: 'This copy of the Bastion can\'t train creatures.' };
      return R.issueTraining(s, data, fac, fn, optionIdx, rand);
    }
    var avail = R.fnAvailable(s, fac, fn);
    if (!avail.ok) return { ok: false, message: avail.message };
    /* Register Port Charter: one at a time, and it says whose is running. */
    if (fn.portCharter && R.registerBusy && R.registerBusy(s, data)) return { ok: false, message: R.registerBusy(s, data) };
    /* A House order (pull request 7): its creature, its room, one at a time
       (creature-rules.js); refused in a copy without the creature rules. */
    if (fn.housesCreature || fn.housesSpecies) {
      var homeless = R.housingBlocker ? R.housingBlocker(s, data, fac, fn) : 'This copy of the Bastion can\'t house creatures.';
      if (homeless) return { ok: false, message: homeless };
    }
    /* Drill a Regiment (pull request 8a): one order per regiment, as many
       at once as the War Room has drill places (regiment-rules.js). */
    if (fn.drill) {
      if (!R.issueDrill) return { ok: false, message: 'This copy of the Bastion can\'t drill regiments.' };
      var pick = R.fnOptions(s, data, fac, fn)[clampInt(optionIdx, 0)] || null;
      if (!pick) return { ok: false, message: R.drillRoomBlocker(s, data) || 'No regiment can drill now: each must be at full strength and not drilling already.' };
      return R.issueDrill(s, data, pick.regimentId, rand);
    }
    if (pendingSame(s, facId, fnId)) return { ok: false, message: 'That order is already pending.' };
    /* A commercial voyage protection (20 October 2026): refused while one is ready or active. */
    if (R.protectionBusy) { var pbusy = R.protectionBusy(s, data, fn); if (pbusy) return { ok: false, message: pbusy }; }
    /* A Muster (pull request 8a): one formation for each of its lists. */
    if (fn.muster) {
      var choices = R.fnOptions(s, data, fac, fn);
      var idxs = Array.isArray(optionIdx) ? optionIdx : [optionIdx];
      var picks = [];
      for (var mi = 0; mi < R.musterSize(fn); mi++) {
        var ch = choices[clampInt(idxs[mi] === undefined ? 0 : idxs[mi], 0)];
        if (!ch) return { ok: false, message: 'Choose what to raise.' };
        picks.push(String(ch.label));
      }
      var mLabel = fac.name + ': ' + fn.label + ' (' + picks.join(', ') + ')';
      var mDays = R.orderDays(fn);
      s.pendingOrders.push({ id: R.uid(rand), facId: facId, fnId: fnId, chosen: { label: picks.join(', '), units: picks }, optionLabel: picks.join(', '), notes: '', label: mLabel, costGP: 0, issuedDay: s.day, dueDay: s.day + mDays });
      return { ok: true, log: ['Order Issued', mLabel + ' (' + R.daysText(mDays) + ': due Day ' + (s.day + mDays) + ').'] };
    }
    var busy = productionBusy(s, data, fac, fn);
    if (busy) return { ok: false, message: busy };
    var blocked = R.recipeBlocker(s, data, fac, fn, fn.options && fn.options.length ? fn.options[clampInt(optionIdx, 0)] || null : null);
    if (blocked) return { ok: false, message: blocked };
    var chosen = null;
    var optionLabel = null;
    if (fn.options && fn.options.length) {
      chosen = fn.options[clampInt(optionIdx, 0)] || null;
      optionLabel = chosen && chosen.label ? chosen.label : String(chosen || '');
    } else if (fac.id === 'workshop' && fn.id === 'craft') {
      var picked = R.craftItems(s, data.tools)[clampInt(optionIdx, 0)] || '';
      chosen = { label: picked, craftItem: picked };
      optionLabel = picked;
    } else if (fn.portCharter) {
      chosen = R.fnOptions(s, data, fac, fn)[clampInt(optionIdx, 0)] || null;
      if (!chosen) return { ok: false, message: 'There\'s no Port Charter to register: the DM grants one in the Explorer.' };
      optionLabel = R.portName(R.charterById(s, chosen.charterId).port);
    } else if (fn.housesSpecies) {
      /* The order keeps the creature it houses, as Register Port Charter
         keeps its Charter: "Griffin Tower: House a Griffin (Swiftwing)". */
      chosen = R.fnOptions(s, data, fac, fn)[clampInt(optionIdx, 0)] || null;
      if (!chosen) return { ok: false, message: R.housingBlocker(s, data, fac, fn) || 'Choose a creature to house.' };
      optionLabel = R.creatureOrderName(R.creatureById(s, chosen.creatureId));
    } else if (fn.housesCreature) {
      chosen = { creatureId: String(fn.housesCreature) };
    }
    var notes = '';
    if (facId === 'library_scriptorium' && fnId === 'research') notes = data.bastion.scriptureNotes[String(optionLabel || '').trim()] || '';
    var inputs = chosen && Array.isArray(chosen.inputs) ? chosen.inputs : [];
    var costGP = R.withSummitDiscount(s, fac, fn, R.computeFnCost(s, fac, fn, chosen).costGP);
    if (costGP > s.treasuryGP) return { ok: false, message: 'Not enough gp. Need ' + costGP + 'gp, you have ' + s.treasuryGP + 'gp.' };
    /* A Shrine order's Favour (pull request 8b): taken once, when it starts. */
    var noFavour = R.favourBlocker ? R.favourBlocker(s, fac, fn) : '';
    if (noFavour) return { ok: false, message: noFavour };
    var favour = fn.favourCost ? clampInt(fn.favourCost, 0, 100) : 0;
    if (favour) s.favour[R.shrineGod(fac.id)] -= favour;
    s.treasuryGP -= costGP;
    /* Its goods leave the Warehouse now and are held by the order (Harry's
       guide: an order's inputs are set aside when it begins). */
    var taken = inputs.length ? (R.takeGoods(s, data, inputs) || []) : [];
    var label = orderLabel(fac, fn, optionLabel);
    var days = R.orderDaysAt(s, data, fac, fn, chosen);
    var o = { id: R.uid(rand), facId: facId, fnId: fnId, chosen: chosen, optionLabel: optionLabel, notes: notes, label: label, costGP: costGP, issuedDay: s.day, dueDay: s.day + days };
    if (taken.length) o.inputs = taken;
    if (favour) o.favourCost = favour;
    s.pendingOrders.push(o);
    return { ok: true, log: ['Order Issued', label + ' (' + days + (days === 1 ? ' day' : ' days') + ': due Day ' + (s.day + days) + ')' + (taken.length ? '. Taken from the Warehouse: ' + R.goodsListText(data, taken) : '') +
      (favour ? '. ' + favour + '% of ' + R.GOD_NAMES[R.shrineGod(fac.id)] + '\'s Favour spent (now ' + s.favour[R.shrineGod(fac.id)] + '%)' : '') + '.'] };
  };

  /* Issue a Hall action after its planning box (3346-3417). */
  R.issueOrderWithMeta = function (s, data, facId, fnId, optionIdx, meta, rand) {
    var fac = R.facility(data, facId);
    var fn = R.fn(fac, fnId);
    if (!fac || !fn) return { ok: false };
    var broken = repairRefusal(s, fac);
    if (broken) return broken;
    var availM = R.fnAvailable(s, fac, fn);
    if (!availM.ok && fn.retiredNote) return { ok: false, message: availM.message };
    if (pendingSame(s, facId, fnId)) return { ok: false, message: 'That order is already pending.' };
    var chosen = null;
    var optionLabel = null;
    if (fn.options && fn.options.length) {
      chosen = fn.options[clampInt(optionIdx, 0)] || null;
      optionLabel = chosen && chosen.label ? chosen.label : String(chosen || '');
    } else {
      var t = isObj(meta) ? String(meta.targetClan || '') : '';
      if (t) { optionLabel = t; chosen = { label: t }; }
    }
    var costGP = R.withSummitDiscount(s, fac, fn, R.computeFnCost(s, fac, fn, chosen).costGP);
    if (costGP > s.treasuryGP) return { ok: false, message: 'Not enough gp. Need ' + costGP + 'gp, you have ' + s.treasuryGP + 'gp.' };
    s.treasuryGP -= costGP;
    var label = orderLabel(fac, fn, optionLabel);
    var notes = isObj(meta) && meta.notes ? String(meta.notes) : '';
    var days = R.orderDays(fn);
    s.pendingOrders.push({ id: R.uid(rand), facId: facId, fnId: fnId, chosen: chosen, optionLabel: optionLabel, notes: notes, label: label, costGP: costGP, issuedDay: s.day, dueDay: s.day + days, meta: isObj(meta) ? meta : null });
    return { ok: true, log: ['Order Issued', label + ' (' + days + (days === 1 ? ' day' : ' days') + ': due Day ' + (s.day + days) + ').'] };
  };

  /* Trade Network investments (710-763). */
  R.issueNetworkUpgrade = function (s, data, kind, rand) {
    if (!s.tradeNetwork.active) return { ok: false, message: 'No active Trade Consortium. Establish the Trade Network first.' };
    if (s.pendingOrders.some(function (o) { return o.facId === 'trade_network'; })) return { ok: false, message: 'A Trade Network upgrade is already pending.' };
    var up = data.bastion.networkUpgrades[kind];
    if (!up) return { ok: false, message: 'Unknown upgrade type.' };
    if (up.costGP > s.treasuryGP) return { ok: false, message: 'Not enough gp. Need ' + up.costGP + 'gp, you have ' + s.treasuryGP + 'gp.' };
    s.treasuryGP -= up.costGP;
    var days = clampInt(up.days === undefined ? 7 : up.days, 1, 365);
    s.pendingOrders.push({ id: R.uid(rand), facId: 'trade_network', fnId: 'upgrade', chosen: null, optionLabel: null, label: up.label, costGP: up.costGP, issuedDay: s.day, dueDay: s.day + days, meta: { kind: kind } });
    return { ok: true, log: ['Order Issued', up.label + ' (' + days + (days === 1 ? ' day' : ' days') + ': due Day ' + (s.day + days) + ').'] };
  };

  /* Cancelling an order keeps the gold spent (B9, kept). A War Action
     cancelled on the day it was queued gives back what declaring war cost
     (R.undoWarDeclaration, war-campaign-rules.js), and says so. */
  R.cancelOrder = function (s, id, data, now) {
    var gone = s.pendingOrders.filter(function (x) { return String(x.id) === String(id); })[0];
    s.pendingOrders = s.pendingOrders.filter(function (x) { return String(x.id) !== String(id); });
    var war = gone && R.undoWarDeclaration ? R.undoWarDeclaration(s, data, gone, now) : null;
    /* Goods it held go back to the Warehouse (only an order actually found and
       removed here, so a second Cancel gives nothing back). */
    var back = gone && arr(gone.inputs) && gone.inputs.length ? R.returnGoods(s, data, gone.inputs) : '';
    if (back) return ['Orders', 'Cancelled ' + (gone.label || 'an order') + '. ' + back];
    return war || ['Orders', 'Cancelled an order.'];
  };

  /* ---------- Lists, warehouse, favour, Political Capital ---------- */
  /* Same name adds to the count (5406-5415). A regiment that came home
     under strength has its own row (depleted), which is never added to. */
  R.addToList = function (list, name, meta) {
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].name === name && list[i].depleted !== true) { idx = i; break; }
    if (idx >= 0) {
      list[idx].qty = (list[idx].qty || 1) + 1;
      list[idx].source = (meta && meta.source) || list[idx].source;
    } else {
      list.push({ name: name, qty: 1, source: (meta && meta.source) || '' });
    }
  };
  R.metaLine = function (it) {
    var parts = [];
    if (it.qty && it.qty !== 1) parts.push('x' + it.qty);
    if (it.source) parts.push(it.source);
    return parts.join(' • ') || '—';
  };
  /* Add to the warehouse, merging a same-named row (1455-1475). */
  R.appendToWarehouse = function (s, itemName, qty, gp, notes, rand) {
    var name = String(itemName || '').trim();
    if (!name) return;
    var q = clampInt(qty === undefined ? 1 : qty, 1);
    var found = null;
    for (var i = 0; i < s.warehouse.length; i++) {
      if (s.warehouse[i].goodId) continue; /* a goods row only takes its own good (R.addGoods) */
      if (String(s.warehouse[i].item || '').toLowerCase() === name.toLowerCase()) { found = s.warehouse[i]; break; }
    }
    if (found) {
      found.qty = clampInt((found.qty === undefined || found.qty === null ? 0 : found.qty) + q, 0);
      if (notes && String(found.notes || '').indexOf(notes) === -1) found.notes = (found.notes ? found.notes + ' | ' : '') + notes;
    } else {
      s.warehouse.push({ id: R.uid(rand), item: name, qty: q, gp: gp === undefined || gp === null ? '' : gp, notes: notes === undefined || notes === null ? '' : notes });
    }
  };
  /* An empty warehouse shows one "New Item" row, as before (1386-1388). */
  R.ensureWarehouseRow = function (s, rand) {
    if (s.warehouse.length === 0) s.warehouse.push({ id: R.uid(rand), item: 'New Item', qty: 1, gp: '', notes: '' });
  };
  /* A warehouse row as typed (1406-1427). */
  R.readWarehouseRow = function (fields) {
    return {
      item: String(fields.item || '').trim() || 'New Item',
      qty: clampInt(fields.qty === undefined ? 0 : fields.qty, 0),
      gp: String(fields.gp || '').trim(),
      notes: String(fields.notes || '').trim()
    };
  };
  /* Hand to the party (pull request B, 19 October 2026): some of a free-text
     Warehouse row (typed by hand, not a good the Ironbow makes) goes to the
     party. Only the quantity handed over leaves the row, once; a row that
     reaches 0 is removed. The suite doesn't hold a character's inventory, so
     the Day Log says plainly that the DM records the item on the D&D sheet.
     Goods the Ironbow makes, and anything physically delivered, go by the
     Courier Exchange instead. Returns { ok, message } or { ok, line }. */
  R.HAND_RECIPIENT_MAX = 60;
  R.handToParty = function (state, row, qty, recipient, now) {
    var i = state.warehouse.indexOf(row);
    if (i < 0) return { ok: false, message: 'That row isn\'t in the Warehouse any more.' };
    if (row.goodId) return { ok: false, message: 'Goods the Ironbow makes can\'t be handed over here: send them by the Courier Exchange.' };
    var have = clampInt(row.qty === undefined ? 0 : row.qty, 0);
    var n = typeof qty === 'number' ? qty : (String(qty).trim() === '' ? NaN : Number(qty));
    if (!isFinite(n) || n !== Math.floor(n) || n < 1) return { ok: false, message: 'Type a whole number of 1 or more.' };
    if (n > have) return { ok: false, message: 'The Warehouse only has ' + have + ' of that.' };
    var who = String(recipient || '').trim().slice(0, R.HAND_RECIPIENT_MAX);
    var name = String(row.item || '').trim() || 'New Item';
    row.qty = have - n;
    if (row.qty <= 0) state.warehouse.splice(i, 1);
    var line = 'Handed to the party: ' + n + ' \u00d7 ' + name + (who ? ' (to ' + who + ')' : '') + ' on ' + R.dayLabel(state.day) + '. ' +
      (row.qty > 0 ? row.qty + ' left in the Warehouse. ' : 'None left in the Warehouse. ') +
      'The DM records it on the character\'s D&D sheet: this tool doesn\'t.';
    R.log(state, 'Warehouse', line, now);
    return { ok: true, line: line, left: Math.max(0, row.qty) };
  };

  /* The Warehouse's Sort (Harry, 19 October 2026): only how the rows are
     shown, never the saved order. "grouped" lists the supplies together
     (packs, charts, the Shrines' items), then ingredients, then trade goods,
     then every general item (rows typed by hand: potions, tools, anything),
     each group keeping the order its rows were added in. "entered" is the
     saved order, as before. */
  R.WH_GROUPS = [
    { id: 'supply', label: 'Supplies' },
    { id: 'ingredient', label: 'Ingredients' },
    { id: 'cargo', label: 'Trade goods' },
    { id: 'general', label: 'General items' }
  ];
  R.warehouseGroup = function (data, row) {
    if (!isObj(row) || !row.goodId) return 'general';
    var g = R.good ? R.good(data, row.goodId) : null;
    return g && g.kind === 'supply' ? 'supply' : g && g.kind === 'ingredient' ? 'ingredient' : 'cargo';
  };
  /* The rows to show: [{ row, index (its place in state.warehouse), group }],
     in the saved order, or grouped; and for grouped, the headings'
     counts: [{ id, label, count }] for the groups that have rows. */
  R.warehouseView = function (data, rows, mode) {
    var items = (rows || []).map(function (row, i) { return { row: row, index: i, group: R.warehouseGroup(data, row) }; });
    if (mode !== 'grouped') return { items: items, groups: [] };
    var order = R.WH_GROUPS.map(function (g) { return g.id; });
    items = items.map(function (x, n) { x.n = n; return x; }).sort(function (a, b) { return (order.indexOf(a.group) - order.indexOf(b.group)) || (a.n - b.n); });
    var groups = R.WH_GROUPS.map(function (g) { return { id: g.id, label: g.label, count: items.filter(function (x) { return x.group === g.id; }).length }; }).filter(function (g) { return g.count > 0; });
    return { items: items, groups: groups };
  };

  /* ---------- Goods (the facilities overhaul's pull request 3, 13 October 2026) ----------
     The goods catalogue (data/goods-data.js) gives each good a stable id.
     In the Warehouse a good is a row with a "goodId" (its count in its own
     unit: lots, portions or packs), beside the free rows typed by hand:
     { id, goodId, item (the catalogue name), qty, gp: '', notes }. Its value
     is worked out, never stored. A production order's inputs leave the
     Warehouse when it begins and are held on the order (order.inputs:
     [{ goodId, name, qty }]); Cancel, Demolish, or an order that can't
     complete, give them back. Nothing here needs the catalogue to load a
     save (the Explorer checks a campaign file with no Bastion data). */
  function goodsList(data) { return data && isObj(data.goods) && arr(data.goods.goods) ? data.goods.goods : []; }
  R.goodsList = goodsList;
  R.good = function (data, id) { return goodsList(data).filter(function (g) { return g.id === id; })[0] || null; };
  R.goodName = function (data, id) { var g = R.good(data, id); return g ? g.name : String(id || '').replace(/_/g, ' '); };
  /* "1 lot of Raw Timber", "10 portions of Restorative Herbs", "5 Expedition Provision Packs". */
  R.goodsAmountText = function (data, id, qty) {
    var g = R.good(data, id);
    var n = clampInt(qty, 0);
    var name = g ? g.name : R.goodName(data, id);
    if (g && g.kind === 'supply') return n + ' ' + (n === 1 ? name : typeof g.plural === 'string' && g.plural ? g.plural : name + 's');
    return R.goodsCountText(data, id, n) + ' of ' + name;
  };
  /* Just the count in the good's unit: "3 lots", "10 portions", "5 packs",
     "2 charts" (a supply with its own unit, pull request 6). */
  R.goodsCountText = function (data, id, qty) {
    var g = R.good(data, id);
    var n = clampInt(qty, 0);
    var unit = g && g.kind === 'ingredient' ? 'portion' : g && g.kind === 'supply' ? (typeof g.unit === 'string' && g.unit ? g.unit : 'pack') : 'lot';
    return n + ' ' + unit + (n === 1 ? '' : 's');
  };
  R.goodsListText = function (data, list) {
    return (list || []).map(function (x) { return R.goodsAmountText(data, x.goodId || x.good, x.qty); }).join(', ');
  };
  /* A good's value in the Warehouse (base value per lot × lots), or null if it has none. */
  R.goodsValue = function (data, id, qty) {
    var g = R.good(data, id);
    return g && typeof g.gp === 'number' ? g.gp * clampInt(qty, 0) : null;
  };
  R.goodsQty = function (s, id) {
    return (s.warehouse || []).reduce(function (n, w) { return n + (isObj(w) && w.goodId === id ? clampInt(w.qty, 0) : 0); }, 0);
  };
  /* Add goods: merged into that good's row (by id, never by name), or a new row. */
  R.addGoods = function (s, data, id, qty, notes, rand) {
    var q = clampInt(qty, 0);
    if (!id || !q) return;
    var row = (s.warehouse || []).filter(function (w) { return isObj(w) && w.goodId === id; })[0];
    if (row) {
      row.qty = clampInt(row.qty, 0) + q;
      if (notes && String(row.notes || '').indexOf(notes) === -1) row.notes = (row.notes ? row.notes + ' | ' : '') + notes;
      return;
    }
    s.warehouse.push({ id: R.uid(rand || Math.random), goodId: id, item: R.goodName(data, id), qty: q, gp: '', notes: notes || '' });
  };
  /* The first good an order lacks: { good, need, have, message }, or null. */
  /* An order's inputs with each good once (so a recipe naming a good twice
     can't pass the check for each line alone). */
  function mergeInputs(inputs) {
    var out = [];
    (inputs || []).forEach(function (x) {
      if (!isObj(x) || !x.good) return;
      var have = out.filter(function (y) { return y.good === x.good; })[0];
      if (have) have.qty += clampInt(x.qty, 1); else out.push({ good: x.good, qty: clampInt(x.qty, 1) });
    });
    return out;
  }
  R.inputsShort = function (s, data, inputs) {
    inputs = mergeInputs(inputs);
    for (var i = 0; i < inputs.length; i++) {
      var x = inputs[i];
      if (!isObj(x) || !x.good) continue;
      var need = clampInt(x.qty, 1);
      var have = R.goodsQty(s, x.good);
      if (have < need) return { good: x.good, need: need, have: have, message: 'Needs ' + R.goodsAmountText(data, x.good, need) + ' in the Warehouse; it has ' + R.goodsCountText(data, x.good, have) + '.' };
    }
    return null;
  };
  /* Take an order's inputs out of the Warehouse, all or nothing: what was
     taken, or null if anything is short. A goods row used up stays, at 0
     (the DM's Remove takes it away), so an order never leaves the Warehouse
     empty, which would bring back the "New Item" row an empty one shows. */
  /* A trade good that has run out leaves the Warehouse (Harry, 19 October
     2026): only trade goods that are actually there get a line. Supplies and
     ingredients, and the rows typed by hand, are left as they are. Returns
     true if a row went. */
  R.pruneEmptyCargo = function (s, data) {
    if (!Array.isArray(s.warehouse)) return false;
    var before = s.warehouse.length;
    s.warehouse = s.warehouse.filter(function (w) {
      if (!isObj(w) || !w.goodId) return true;
      var g = R.good(data, w.goodId);
      return !(g && g.kind === 'cargo' && clampInt(w.qty, 0) <= 0);
    });
    return s.warehouse.length !== before;
  };
  R.takeGoods = function (s, data, inputs) {
    inputs = mergeInputs(inputs);
    if (R.inputsShort(s, data, inputs)) return null;
    var taken = [];
    (inputs || []).forEach(function (x) {
      if (!isObj(x) || !x.good) return;
      var left = clampInt(x.qty, 1);
      s.warehouse.forEach(function (w) {
        if (!left || !isObj(w) || w.goodId !== x.good) return;
        var have = clampInt(w.qty, 0);
        var use = Math.min(have, left);
        w.qty = have - use;
        left -= use;
      });
      taken.push({ goodId: x.good, name: R.goodName(data, x.good), qty: clampInt(x.qty, 1) });
    });
    return taken;
  };
  /* Give held goods back to the Warehouse; says what went back. */
  R.returnGoods = function (s, data, held) {
    var list = (held || []).filter(function (x) { return isObj(x) && x.goodId && clampInt(x.qty, 0) > 0; });
    list.forEach(function (x) { R.addGoods(s, data, x.goodId, x.qty, 'Returned'); });
    return list.length ? R.goodsListText(data, list) + ' went back to the Warehouse.' : '';
  };
  /* An order whose facility or order no longer exists: nothing is made,
     and the goods it held go back. */
  R.dropOrderGoods = function (s, data, order) {
    var back = order && arr(order.inputs) && order.inputs.length ? R.returnGoods(s, data, order.inputs) : '';
    return back ? [['Orders', (order.label || 'An order') + ' couldn\'t be completed (its facility or order no longer exists). ' + back]] : null;
  };
  /* How many of a good an order makes, with research: the biggest yield
     (a percentage, rounded up, or a number added), then any bonus on top. */
  R.goodsOutputQty = function (s, data, fac, fn, goodId, qty) {
    var base = clampInt(qty, 0);
    var effects = R.researchEffects(s, data, fac.id).filter(function (e) { return e.fn === fn.id && (e.keys || []).indexOf(goodId) !== -1; });
    var best = 0;
    var bonus = 0;
    effects.forEach(function (e) {
      if (e.type === 'yield') best = Math.max(best, e.pct ? Math.ceil(base * clampInt(e.pct, 0, 1000) / 100) : clampInt(e.add || 0, 0, 1000));
      if (e.type === 'bonus') bonus += clampInt(e.add || 0, 0, 1000);
    });
    return base + best + bonus;
  };
  /* A production order completing: its outputs into the Warehouse. */
  R.completeProduction = function (s, data, fac, fn, order, rand) {
    /* Work out everything first, then add it, so nothing is half done. */
    var plan = (order.chosen.outputs || []).filter(isObj).map(function (x) {
      if (x.good) return { good: x.good, qty: R.goodsOutputQty(s, data, fac, fn, x.good, x.qty) };
      if (x.item) return { item: String(x.item), qty: clampInt(x.qty, 1) };
      return null;
    }).filter(Boolean);
    var made = plan.map(function (x) {
      if (x.good) { R.addGoods(s, data, x.good, x.qty, fac.name, rand); return R.goodsAmountText(data, x.good, x.qty); }
      R.appendToWarehouse(s, x.item, x.qty, '', fac.name, rand);
      return x.qty + ' × ' + x.item;
    });
    return ['Order Completed', (order.label || fac.name + ': ' + fn.label) + ' → Added to Warehouse: ' + made.join(', ') + '.'];
  };
  /* A goods row as typed: only its count and notes can change by hand. */
  R.readGoodsRow = function (fields) {
    return { qty: clampInt(fields.qty === undefined ? 0 : fields.qty, 0, 100000), notes: String(fields.notes || '').trim() };
  };
  /* The Warehouse as saved: free rows exactly as they were; goods rows tidied
     (a whole count, the catalogue's name when it's known, no typed gp). */
  R.cleanWarehouse = function (list, data) {
    return (list || []).filter(isObj).map(function (w) {
      if (typeof w.goodId !== 'string' || !w.goodId) return w;
      var g = R.good(data, w.goodId);
      return { id: w.id || R.uid(Math.random), goodId: w.goodId, item: g ? g.name : String(w.item || w.goodId), qty: clampInt(w.qty, 0, 100000), gp: '', notes: String(w.notes || '') };
    });
  };
  /* An order's held goods, as saved: well-formed entries only. */
  function cleanOrderInputs(o) {
    /* An order with no id would be removed with every other such order. */
    if (o.id === undefined || o.id === null || o.id === '') o = Object.assign({}, o, { id: R.uid(Math.random) });
    if (!('inputs' in o)) return o;
    var list = arr(o.inputs) ? o.inputs.filter(function (x) { return isObj(x) && typeof x.goodId === 'string' && x.goodId && clampInt(x.qty, 0) > 0; })
      .map(function (x) { return { goodId: x.goodId, name: String(x.name || x.goodId), qty: clampInt(x.qty, 1) }; }) : [];
    var c = Object.assign({}, o);
    if (list.length) c.inputs = list; else delete c.inputs;
    return c;
  }
  /* A facility that makes goods one order at a time (the Timber Yard and the
     Fishery: "productionLimit"): the message if it's busy, or null. */
  function productionBusy(s, data, fac, fn) {
    var limit = fac.productionLimit ? clampInt(fac.productionLimit, 1, 20) : 0;
    if (!limit || !fn.production) return null;
    var running = (s.pendingOrders || []).filter(function (o) {
      if (!isObj(o) || o.facId !== fac.id) return false;
      if (isObj(o.meta) && (o.meta.kind === 'upgrade' || o.meta.kind === 'research')) return false;
      var f = R.fn(fac, o.fnId);
      return !!(f && f.production);
    });
    if (running.length < limit) return null;
    return 'The ' + fac.name + ' is busy: one production order at a time (' + (running[0].label || 'an order') + ', due on Day ' + running[0].dueDay + ').';
  }
  R.productionBusy = productionBusy;
  /* Why a production recipe can't be ordered now (a valid choice, its
     research, its goods in the Warehouse), or null. */
  R.recipeBlocker = function (s, data, fac, fn, chosen) {
    if (!fn || !fn.production) return null;
    if (!(chosen && Array.isArray(chosen.outputs))) return 'Choose what to make.';
    /* A recipe that needs research (Harry, 13 October 2026). */
    if (chosen.needsResearch && !R.researched(s, fac.id, chosen.needsResearch)) return 'Needs the research ' + R.researchChoiceName(data, fac.id, chosen.needsResearch) + '.';
    var short = R.inputsShort(s, data, chosen.inputs || []);
    return short ? short.message : null;
  };

  R.addFavourPercent = function (s, god, amount) {
    var g = String(god || '').toLowerCase();
    if (['telluria', 'aurush', 'pelagos'].indexOf(g) === -1) return;
    s.favour[g] = clampInt((s.favour[g] || 0) + clampInt(amount === undefined || amount === null ? 0 : amount, 0, 100), 0, 100);
  };
  /* "Clan Blackstone" or "Blackstone" → "blackstone" (5489-5502). */
  R.clanIdFromLabel = function (label) {
    var raw = String(label || '').toLowerCase().trim();
    var key = raw.replace(/^clan\s+/, '').replace(/\s+/g, ' ');
    return CLAN_KEYS.indexOf(key) === -1 ? null : key;
  };
  R.addPoliticalCapital = function (s, clanLabel, delta) {
    var id = R.clanIdFromLabel(clanLabel);
    if (!id) return;
    s.politicalCapital[id] = clampInt((s.politicalCapital[id] || 0) + clampInt(delta, -100, 100), -100, 100);
  };

  /* ---------- Rolls and the Hall of Emissaries ---------- */
  /* A roll's tier (1857-1868). */
  R.tierFromRoll = function (d20, total, dc) {
    if (d20 === 20) return 'critical_success';
    if (d20 === 1) return 'critical_failure';
    if (total >= dc + 5) return 'great_success';
    if (total >= dc) return 'success';
    if (total <= dc - 5) return 'bad_failure';
    return 'failure';
  };
  R.formatTier = function (t) {
    if (t === 'critical_success') return 'Critical Success';
    if (t === 'great_success') return 'Great Success';
    if (t === 'success') return 'Success';
    if (t === 'failure') return 'Failure';
    return 'Bad Failure';
  };
  /* A typed d20: 1 to 20 (1681-1683). */
  R.readD20 = function (text, mod) {
    var d20 = clampInt(text === undefined || text === null ? 10 : text, 1, 20);
    return { d20: d20, total: d20 + clampInt(mod, -50, 50) };
  };
  R.clanReactionLine = function (data, clanLabel, tier, rand) {
    var clan = String(clanLabel || '').trim();
    var set = tier === 'critical_success' || tier === 'great_success' ? data.bastion.reactions.good : tier === 'success' ? data.bastion.reactions.mid : data.bastion.reactions.bad;
    return set[Math.floor(rand() * set.length)].replace(/\{clan\}/g, clan);
  };
  /* The Hall's bonus: level 1 +2, level 2 +4, level 3 +6, plus reputation (1830-1837). */
  R.diplomacyModForHall = function (s) {
    var lvl = R.getFacilityLevel(s, 'hall_of_emissaries');
    var rep = clampInt(s.diplomacy.rep || 0, -5, 5);
    return (lvl === 1 ? 2 : lvl === 2 ? 4 : 6) + rep;
  };
  /* A Hall action cooling down after a bad failure: cooldowns[kind] is the
     day it's free again. The days left (0 when it's free). */
  R.cooldownLeft = function (s, key) {
    var until = s.diplomacy.cooldowns ? s.diplomacy.cooldowns[key] : undefined;
    return typeof until === 'number' ? Math.max(0, until - s.day) : 0;
  };
  R.setCooldown = function (s, key, days) {
    var t = clampInt(days, 0, 999);
    if (t <= 0) delete s.diplomacy.cooldowns[key];
    else s.diplomacy.cooldowns[key] = s.day + t;
  };

  /* What a Hall action needs before anything happens: the rolls to ask for,
     in the old order (the action roll, then for a delegation its Diplomacy
     and Insight rolls). blocked is set while the action is cooling down. */
  R.emissaryPlan = function (s, data, order) {
    var fac = R.facility(data, order.facId);
    var fn = R.fn(fac, order.fnId);
    var kind = String(fn.special.kind || 'unknown');
    var opt = order.optionLabel || (order.meta && order.meta.targetClan) || '';
    var dc = data.bastion.hallDC[kind] !== undefined ? data.bastion.hallDC[kind] : 14;
    var cd = R.cooldownLeft(s, kind);
    var mod = R.diplomacyModForHall(s);
    var rolls = [{ key: 'main', title: fn.label + ' (' + opt + ')', mod: mod, dc: dc }];
    var tone = null;
    if (kind === 'host_delegation') {
      tone = String((order.meta && order.meta.tone) || 'assertive');
      var toneMod = data.bastion.delegation.toneMod[tone] || 0;
      rolls.push({ key: 'r1', title: 'Diplomacy Roll (' + tone + ')', mod: mod + toneMod, dc: data.bastion.delegation.diplomacyDC });
      rolls.push({ key: 'r2', title: 'Insight Roll (' + tone + ')', mod: mod, dc: data.bastion.delegation.insightDC });
    }
    return { fac: fac, fn: fn, kind: kind, opt: opt, dc: dc, mod: mod, tone: tone, blocked: cd, rolls: rolls };
  };

  /* How long a Hall action's record lasts before its roll tier: its
     durationDays, or for a Trade Agreement the weeks chosen when it was
     planned (1, 3 or 6; Harry, 8 October 2026). */
  R.hallBaseDays = function (data, fn, order) {
    var sp = fn.special || {};
    if (sp.kind === 'trade_agreement') {
      var choices = data.bastion.tradeAgreementWeeks || [1, 3, 6];
      var w = order && order.meta ? Number(order.meta.weeks) : NaN;
      if (choices.indexOf(w) === -1) w = data.bastion.tradeAgreementDefaultWeeks || 3;
      return w * 7;
    }
    return clampInt(sp.durationDays === undefined || sp.durationDays === null ? 14 : sp.durationDays, 1, 365);
  };
  /* "21 days (3 shipments)". */
  R.daysText = function (n) { return n + (n === 1 ? ' day' : ' days'); };
  R.shipmentsText = function (n) { return n + (n === 1 ? ' shipment' : ' shipments'); };

  /* Apply a Hall action once all its rolls are in (899-1201). rolls holds
     { main, r1, r2 } as { d20, total }. Returns the result box's lines.
     Its record lasts its base days plus the roll tier's (at least a week);
     a contract sends a shipment every 7 days from today, the last on its
     final day. */
  R.applyEmissary = function (s, data, order, plan, rolls, rand) {
    var fn = plan.fn;
    var kind = plan.kind;
    var opt = plan.opt;
    var roll = rolls.main;
    var tier = R.tierFromRoll(roll.d20, roll.total, plan.dc);
    var changes = [];
    var summary = '';
    var every = R.time(data).every;
    var baseDays = R.hallBaseDays(data, fn, order);
    var randBetween = function (a, b) {
      var min = clampInt(Math.min(a, b), -999999, 999999);
      var max = clampInt(Math.max(a, b), -999999, 999999);
      return min + Math.floor(rand() * (max - min + 1));
    };
    var t = data.bastion.hallTiers[tier] || { daysAdj: 0, incomeMult: 1, pcDelta: 0 };
    var daysAdj = t.daysAdj || 0;
    var incomeMult = t.incomeMult;
    var pcDelta = t.pcDelta;
    if (t.cooldownDays) { R.setCooldown(s, kind, t.cooldownDays); changes.push('Cooldown: ' + R.daysText(t.cooldownDays)); }

    /* The action roll's Political Capital. A delegation's comes from its own
       two rolls instead (B2), so it isn't changed here. */
    if (kind === 'summit') {
      var parts = String(opt).split(/[&\/+]/).map(function (x) { return x.trim(); }).filter(Boolean);
      parts.forEach(function (p) { R.addPoliticalCapital(s, p, pcDelta); });
      if (parts.length) changes.push('Political Capital: ' + (pcDelta >= 0 ? '+' : '') + pcDelta + ' (' + parts.join(' & ') + ')');
    } else if (kind !== 'host_delegation') {
      R.addPoliticalCapital(s, opt, pcDelta);
      changes.push('Political Capital: ' + (pcDelta >= 0 ? '+' : '') + pcDelta + ' (' + String(opt) + ')');
    }
    var days = clampInt(baseDays + daysAdj, every, 365);
    var endDay = s.day + days;
    var shipments = Math.ceil(days / every);

    if (kind === 'summit') {
      if (incomeMult === 0) {
        summary = 'The summit collapses into accusation and slammed goblets. No accord is reached.';
      } else {
        var basePct = clampInt(fn.special.costReductionPct || 0, 0, 90);
        var pct = tier === 'critical_success' ? clampInt(basePct + 10, 0, 90)
          : tier === 'great_success' ? clampInt(basePct + 5, 0, 90)
          : tier === 'failure' ? clampInt(basePct - 5, 0, 90)
          : basePct;
        s.diplomacy.summits.push({ id: R.uid(rand), title: 'Inter-Clan Summit', pair: String(opt), startDay: s.day, endDay: endDay, costReductionPct: pct });
        R.appendToWarehouse(s, 'Summit Charter', 1, '', 'Hall of Emissaries', rand);
        changes.push('Trade action discount: ' + pct + '% (' + R.daysText(days) + ', until Day ' + endDay + ')');
        summary = 'A charter is inked. Trade routes loosen. The room exhales.';
      }
    } else if (kind === 'host_delegation') {
      var tone = plan.tone;
      var gMin = clampInt(fn.special.oneTimeTreasuryMin || 0, 0);
      var gMax = clampInt(fn.special.oneTimeTreasuryMax === undefined ? gMin : fn.special.oneTimeTreasuryMax, gMin);
      var dDC = data.bastion.delegation.diplomacyDC;
      var iDC = data.bastion.delegation.insightDC;
      var s1 = rolls.r1.total >= dDC;
      var s2 = rolls.r2.total >= iDC;
      var successes = (s1 ? 1 : 0) + (s2 ? 1 : 0);
      var weak = !s1 && !s2 && (rolls.r1.total >= dDC - 2 || rolls.r2.total >= iDC - 2);
      var dPc = 0;
      var tokenGain = 0;
      /* This outcome text was never shown (BAS-34, kept). */
      if (successes === 2) { dPc = 15; tokenGain = 1; }
      else if (successes === 1) { dPc = 8; }
      else if (weak) { dPc = 0; }
      else { dPc = -12; }
      R.addPoliticalCapital(s, opt, dPc);
      changes.push('Political Capital: ' + (dPc >= 0 ? '+' : '') + dPc + ' (' + String(opt) + ')');
      if (tokenGain > 0) {
        s.diplomacy.tokens = clampInt((s.diplomacy.tokens || 0) + tokenGain, 0, 999);
        changes.push('Favour Token: +' + tokenGain);
      }
      var gained = clampInt(randBetween(gMin, gMax), 0, 999999);
      if (tone === 'conciliatory') gained = clampInt(Math.floor(gained * 0.85), 0, 999999);
      if (tone === 'opportunistic') gained = clampInt(Math.floor(gained * 1.15), 0, 999999);
      if (successes > 0 || weak) {
        s.treasuryGP += gained;
        changes.push('Treasury: +' + gained + ' gp');
      } else {
        var penalty = clampInt(Math.ceil((gMin + gMax) / 6), 0);
        s.treasuryGP -= penalty;
        changes.push('Treasury: -' + penalty + ' gp');
      }
      s.diplomacy.delegations.push({ id: R.uid(rand), title: 'Hosted Delegation (' + tone + ')', clan: String(opt), startDay: s.day, endDay: endDay });
      changes.push('Delegation active: ' + R.daysText(days) + ', until Day ' + endDay);
    } else {
      var iMin = clampInt(fn.special.incomeMin || 0, 0);
      var iMax = clampInt(fn.special.incomeMax === undefined ? iMin : fn.special.incomeMax, iMin);
      var baseIncome = randBetween(iMin, iMax);
      if (incomeMult === 0) {
        summary = 'Negotiations sour. Ink never touches parchment.';
      } else {
        var perShipment = clampInt(Math.floor(baseIncome * incomeMult), 0);
        var title = kind === 'arbitration' ? 'Secure Writ of Authority' : kind === 'consortium' ? 'Form Trade Consortium' : 'Trade Agreement';
        /* income: the gold each shipment brings; lastShipmentDay: the day
           of the latest shipment (today, to start the count). */
        var rec = { id: R.uid(rand), title: title, clan: String(opt), startDay: s.day, endDay: endDay, income: perShipment, lastShipmentDay: s.day };
        var list = kind === 'arbitration' ? 'arbitrations' : kind === 'consortium' ? 'consortiums' : 'agreements';
        s.diplomacy[list].push(rec);
        changes.push('New record: ' + rec.title + ' (' + R.daysText(days) + ', ' + R.shipmentsText(shipments) + ', until Day ' + endDay + ')');
        if (rec.income) changes.push('Income: +' + rec.income + ' gp a shipment, every ' + every + ' days');
        if (kind === 'consortium') {
          s.tradeNetwork.active = true;
          if (!Array.isArray(s.tradeNetwork.routes)) s.tradeNetwork.routes = [];
          var ck = R.clanIdFromLabel(opt);
          if (ck) {
            var meta = data.bastion.clanTrade[ck] || { name: opt, commodity: 'Goods', risk: 'medium' };
            /* An expired route counts too, so a new consortium can't reopen it (B21, kept). */
            var exists = s.tradeNetwork.routes.some(function (r) { return String(r.clan).toLowerCase() === meta.name.toLowerCase(); });
            if (!exists) {
              /* It sails every 7 days from today (nextDay), until its
                 consortium's base days are up (the roll's tier doesn't
                 change the route's life, as before). */
              s.tradeNetwork.routes.push({
                id: R.uid(rand), clan: meta.name, commodity: meta.commodity, risk: meta.risk,
                openedDay: s.day, expiresDay: s.day + clampInt(fn.special.durationDays === undefined ? 35 : fn.special.durationDays, 1, 365),
                nextDay: s.day + every, yieldGP: perShipment, stabilityDC: 12, status: 'active'
              });
              changes.push('Trade Network: Route opened (' + meta.name + ')');
            }
          }
          changes.push('Market Stability: ' + clampInt(s.tradeNetwork.stability === undefined ? 75 : s.tradeNetwork.stability, 0, 100) + '%');
        }
        R.appendToWarehouse(s, rec.title + ' Contract', 1, '', 'Hall of Emissaries', rand);
        summary = tier === 'critical_success' ? 'The deal is legendary. Other emissaries will quote this contract for years.'
          : tier === 'great_success' ? 'A strong deal. Clean clauses. Better margins.'
          : tier === 'failure' ? 'A deal, but you concede ground. The margins are thinner.'
          : 'Terms are acceptable. The contract is sealed.';
      }
    }
    var narrative = R.clanReactionLine(data, opt, tier, rand);
    return {
      tier: tier, dc: plan.dc, mod: plan.mod, roll: roll, summary: summary, narrative: narrative, changes: changes,
      log: ['Order Resolved', fn.label + ' (' + opt + ') → ' + R.formatTier(tier) + '. ' + narrative + ' ' + summary]
    };
  };

  /* Hall upgrade: one level, free (1204-1226; B4, kept). */
  R.upgradeHall = function (s, fn) {
    var cur = R.getFacilityLevel(s, 'hall_of_emissaries');
    /* Up to Level 5 since step 1b (the data's maxLevel 3 is the old limit). */
    if (cur >= R.MAX_LEVEL) return ['Upgrade', 'Hall of Emissaries is already max level.'];
    s.facilityLevels.hall_of_emissaries = clampInt(cur + 1, 1, R.MAX_LEVEL);
    return ['Upgrade', 'Hall of Emissaries upgraded to Level ' + (cur + 1) + '.'];
  };

  /* A Trade Network investment completing (765-817). */
  R.completeNetworkUpgrade = function (s, order) {
    var tn = s.tradeNetwork;
    var kind = order.meta && order.meta.kind;
    var lines = [];
    var title = 'Consortium Resolution';
    if (kind === 'stability') {
      var before = clampInt(tn.stability === undefined ? 75 : tn.stability, 0, 100);
      tn.stability = clampInt(before + 8, 0, 100);
      lines.push('Coin changes hands under closed doors. Inspectors are paid. Bribes are… politely renamed.');
      lines.push('Market Stability rises from ' + before + '% to ' + tn.stability + '%.');
      title = 'Stability Investment Sealed';
    } else if (kind === 'yield') {
      var b2 = clampInt(tn.yieldBonusPct || 0, 0, 200);
      tn.yieldBonusPct = clampInt(b2 + 5, 0, 200);
      lines.push('New contracts are drafted with sharper margins and stricter ledgers.');
      lines.push('Network yield improves from +' + b2 + '% to +' + tn.yieldBonusPct + '%.');
      title = 'Yield Investment Sealed';
    } else if (kind === 'toggle_high_risk') {
      tn.highRiskRouting = !tn.highRiskRouting;
      lines.push('A doctrine memorandum is circulated: routes will be ' + (tn.highRiskRouting ? 'pushed harder' : 'kept conservative') + '.');
      lines.push('High-Risk Routing is now ' + (tn.highRiskRouting ? 'Enabled' : 'Disabled') + '.');
      title = 'Routing Doctrine Issued';
    } else {
      lines.push('The Council archives a motion with no clear effect.');
    }
    return { title: title, lines: lines, log: ['Trade Network', (order.label || 'Trade Network upgrade') + ' resolved.'] };
  };

  /* Orders that need no typed roll (819-1254, the non-Hall parts).
     Returns log lines, or null if the order has no facility (as before,
     nothing happens then). */
  R.completeSimpleOrder = function (s, data, order, rand) {
    var fac = R.facility(data, order.facId);
    if (!fac) return R.dropOrderGoods(s, data, order, rand);
    if (isObj(order.meta) && order.meta.kind === 'upgrade') return [R.completeUpgrade(s, data, order)];
    if (isObj(order.meta) && order.meta.kind === 'research') return [R.completeResearch(s, data, order)];
    var fn = R.fn(fac, order.fnId);
    if (!fn) return R.dropOrderGoods(s, data, order, rand);
    /* The Hall's Register Port Charter (pull request 5): the Charter becomes
       registered, once; nothing goes into the Warehouse. */
    if (fn.portCharter && R.completeCharterRegistration) return [R.completeCharterRegistration(s, data, order)];
    /* A House order (pull request 7): its creature is housed, once; nothing
       goes into the Warehouse. (A copy without the creature rules changes
       nothing: a granted creature stays waiting, to be housed again.) */
    if (fn.trains) {
      return [R.completeTraining ? R.completeTraining(s, data, order, fn, fac) : ['Orders', (order.label || fac.name + ': ' + fn.label) + ' couldn\'t be completed: this copy of the Bastion can\'t train creatures.']];
    }
    if (fn.housesCreature || fn.housesSpecies) {
      return [R.completeHousing ? R.completeHousing(s, data, order) : ['Orders', (order.label || fac.name + ': ' + fn.label) + ' couldn\'t be completed: this copy of the Bastion can\'t house creatures. Nothing changed.']];
    }
    /* A production order (pull request 3): its outputs go into the
       Warehouse; its inputs were used up when it began. */
    if (order.chosen && Array.isArray(order.chosen.outputs)) return [R.completeProduction(s, data, fac, fn, order, rand)];
    var label = order.label || (fac.name + ': ' + fn.label);
    var optionLabel = order.optionLabel || null;
    var chosen = order.chosen || null;
    var special = chosen && chosen.special ? chosen.special : null;
    if (special && special.type) {
      var god = String(special.god || '').toLowerCase();
      if (special.type === 'favour_blessing') {
        var r20 = R.d(20, rand);
        R.addFavourPercent(s, god, r20);
        return [['Order Completed', label + ' → Rolled 1d20 = ' + r20 + '. Added +' + r20 + '% to ' + god.toUpperCase() + ' favour.']];
      }
      if (special.type === 'oracle_hint') {
        var r10 = R.d(10, rand);
        var hit = r10 >= 4 && r10 <= 7;
        return [['Order Completed', label + ' → Rolled 1d10 = ' + r10 + '. ' + (hit ? 'A hint is granted (DM decides the hint).' : 'No hint this time.')]];
      }
      if (special.type === 'blessing_rest') {
        var r6 = R.d(6, rand);
        return [['Order Completed', label + ' → Rolled 1d6 = ' + r6 + '. ' + (r6 >= 5 ? 'Long Rest effects granted.' : 'No rest granted.')]];
      }
    }
    if (fac.id === 'barracks' && fn.id === 'recruit_defenders') {
      var r4 = R.d(4, rand);
      s.defenders.count += r4;
      return [['Order Completed', label + ' → Recruited ' + r4 + ' defenders.']];
    }
    if (fac.id === 'watchtower' && fn.id === 'patrol') {
      var until = s.day + R.time(data).patrolDays;
      s.defenders.patrolUntil = Math.max(R.patrolActive(s) ? s.defenders.patrolUntil : 0, until);
      return [['Order Completed', label + ' → Patrol active until Day ' + s.defenders.patrolUntil + '.']];
    }
    if (fac.id === 'armoury' && fn.id === 'arm_defenders') {
      s.defenders.armed = s.defenders.count > 0;
      return [['Order Completed', label + ' → Defenders armed.']];
    }
    /* The Shrines (pull request 8b): a Blessing of Pelagos for the next
       ship, or a Great Rite waiting at the Ironbow; each once. */
    /* The Watchtower's Protect Maritime Approaches: active for windowDays,
       the day it completes counting as Day 1 (so it ends on day + windowDays − 1). */
    if (fn.protectionWindow) {
      var tw = s.tradeNetwork;
      if (!isObj(tw.protections)) tw.protections = {};
      var until = s.day + clampInt(fn.windowDays || 7, 1, 365) - 1;
      tw.protections[fn.protectionWindow] = { untilDay: until };
      return [['Order Completed', (order.label || fac.name + ': ' + fn.label) + ' → Protected Maritime Approaches are active until ' + R.dayLabel(until) + ': every ship the Dock sends with cargo in that time has its voyage risk 5 points lower.']];
    }
    if (fn.protectionCharge === 'commercial_convoy') {
      var tc = s.tradeNetwork;
      if (!isObj(tc.protections)) tc.protections = {};
      var pc = isObj(tc.protections.commercial_convoy) ? tc.protections.commercial_convoy : {};
      pc.charges = Math.min(clampInt(fn.protectionMax || 1, 1, 99), clampInt(pc.charges || 0, 0, 999) + 1);
      tc.protections.commercial_convoy = pc;
      return [['Order Completed', (order.label || fac.name + ': ' + fn.label) + ' → A Commercial Convoy is prepared for the next ship the Dock sends with cargo (' + pc.charges + ' held).']];
    }
    if (fn.protectionCharge) {
      var t8 = s.tradeNetwork;
      if (!isObj(t8.protections)) t8.protections = {};
      var pr = isObj(t8.protections[fn.protectionCharge]) ? t8.protections[fn.protectionCharge] : {};
      pr.charges = clampInt(pr.charges || 0, 0, 999) + 1;
      t8.protections[fn.protectionCharge] = pr;
      return [['Order Completed', (order.label || fac.name + ': ' + fn.label) + ' → A Blessing of Pelagos waits for the next ship the Dock sends with cargo (' + pr.charges + ' held).']];
    }
    if (fn.greatRite) {
      if (!Array.isArray(s.greatRites)) s.greatRites = [];
      var rid = 'rite-' + String(order.id);
      if (!s.greatRites.some(function (g) { return g.id === rid; })) s.greatRites.push({ id: rid, rite: fn.greatRite, god: R.shrineGod(fac.id), madeDay: s.day, status: 'waiting' });
      return [['Order Completed', (order.label || fac.name + ': ' + fn.label) + ' → ' + R.RITE_NAMES[fn.greatRite] + ' waits at the Ironbow until the DM gives it to the party on an expedition.']];
    }
    /* Pull request 8a (regiment-rules.js). */
    if (fac.id === 'war_room' && fn.drill && R.completeDrill) return [['Order Completed', R.completeDrill(s, data, order)]];
    if (fac.id === 'war_room' && fn.muster && R.completeMuster) return [['Order Completed', R.completeMuster(s, data, order)]];
    if (fac.id === 'war_room' && fn.id === 'recruit') {
      var unit = optionLabel || 'Unit';
      /* A depleted regiment of that type is brought back to full strength
         first (war-campaign-rules.js). */
      if (R.recruitUnit) return [['Order Completed', label + ' → ' + R.recruitUnit(s, data, unit)]];
      R.addToList(s.military, unit, { source: 'War Room' });
      return [['Order Completed', label + ' → Recruited: ' + unit + '.']];
    }
    if (fac.id === 'menagerie' && fn.id === 'recruit_beast') {
      var beast = optionLabel || 'Beast';
      R.addToList(s.defenderBeasts, beast, { source: 'Menagerie' });
      return [['Order Completed', label + ' → Recruited beast: ' + beast + '. Added to Bastion Defenders.']];
    }
    if (fac.id === 'hall_of_emissaries' && fn.special && fn.special.type === 'upgrade_facility') {
      return [R.upgradeHall(s, fn)];
    }
    if (fac.id === 'dock' && fn.id === 'charter_berth') {
      R.appendToWarehouse(s, optionLabel || 'Chartered vessel', 1, '', 'Dock', rand);
      return [['Order Completed', label + ' → Added to Warehouse.']];
    }
    if (fac.id === 'workshop' && fn.id === 'craft' && chosen && chosen.craftItem) {
      R.appendToWarehouse(s, chosen.craftItem, 1, '', 'Workshop', rand);
      return [['Order Completed', label + ' → Crafted: ' + chosen.craftItem + '.']];
    }
    if (optionLabel) {
      var notes = order.notes ? fac.name + ' • ' + String(order.notes) : fac.name;
      /* Research can make a batch bigger or bring items two at a time. */
      var made = R.researchOutput(s, data, fac, fn, chosen, optionLabel);
      R.appendToWarehouse(s, made.name, made.count, '', notes, rand);
      return [['Order Completed', label + ' → Added to Warehouse' + (made.count > 1 ? ': ' + made.count + ' × ' + made.name : made.name !== optionLabel ? ': ' + made.name : '') + '.']];
    }
    return [['Order Completed', label + ' → Completed.']];
  };

  /* How an order is completed: 'network', 'war', 'emissary', 'simple' or 'none'. */
  R.orderKind = function (data, order) {
    if (order.facId === 'trade_network') return 'network';
    if (order.facId === 'war_council' || (order.meta && order.meta.kind === 'war_action')) return 'war';
    var fac = R.facility(data, order.facId);
    if (fac && order.meta && (order.meta.kind === 'upgrade' || order.meta.kind === 'research')) return 'simple';
    var fn = R.fn(fac, order.fnId);
    if (!fac || !fn) return 'none';
    if (R.isEmissary(fac, fn)) return 'emissary';
    return 'simple';
  };
  /* The Watchtower's Patrol: Advantage for the defenders, from the day it
     completes until patrolUntil. */
  R.patrolActive = function (s) {
    return !!(isObj(s.defenders) && typeof s.defenders.patrolUntil === 'number' && s.defenders.patrolUntil >= s.day && s.defenders.patrolUntil > 0);
  };
  /* Is an order due (its day has come)? */
  R.isDue = function (s, o) { return isObj(o) && !(dayNum(o.dueDay, s.day) > s.day); };
  /* Orders due now: on their day or any day since (BAS-13). Orders at a
     facility Under Repair wait (they stay pending) until it's working. */
  R.dueOrders = function (s, skipped) {
    return s.pendingOrders.filter(function (o) {
      return R.isDue(s, o) && (skipped || []).indexOf(o.id) === -1 && !R.underRepair(s, o.facId);
    });
  };
  R.removeOrder = function (s, id) {
    s.pendingOrders = s.pendingOrders.filter(function (o) { return o.id !== id; });
  };

  /* ---------- Diplomacy each day (2331-2385) ----------
     Contracts (agreements, writs, consortiums) send a shipment every 7 days
     from the day each was signed, the last one on its final day; then
     every record whose final day has come ends (a delegation or summit
     lasts until its final day). A sea route whose consortium has ended, or
     whose own days are up, expires; a cooldown that's over is cleared.
     Returns { logs, word }: the log lines, and the lines for "The Ironbow
     sends word…" (records that ended). */
  var CONTRACTS = ['agreements', 'arbitrations', 'consortiums'];
  var RECORDS = ['agreements', 'delegations', 'summits', 'arbitrations', 'consortiums'];
  /* The day a contract's next shipment comes, or null when it's had them all. */
  R.nextShipmentDay = function (rec, every) {
    var last = dayNum(rec.lastShipmentDay, dayNum(rec.startDay, 0));
    var end = dayNum(rec.endDay, last);
    if (last >= end) return null;
    return Math.min(last + (every || 7), end);
  };
  /* Shipments still to come, and days left. */
  R.shipmentsLeft = function (rec, every) {
    var last = dayNum(rec.lastShipmentDay, dayNum(rec.startDay, 0));
    var end = dayNum(rec.endDay, last);
    return end > last ? Math.ceil((end - last) / (every || 7)) : 0;
  };
  R.daysLeft = function (s, rec) { return Math.max(0, dayNum(rec.endDay, s.day) - s.day); };
  /* "Trade Agreement with Clan Karr". */
  function recordName(list, rec) {
    if (list === 'summits') return 'Inter-Clan Summit (' + (rec.pair || '—') + ')';
    if (list === 'delegations') return 'delegation from ' + (rec.clan || '—');
    return (rec.title || 'contract') + ' with ' + (rec.clan || '—');
  }
  R.tickDiplomacy = function (s, data) {
    var logs = [];
    var word = [];
    var d = s.diplomacy;
    var every = R.time(data).every;
    var income = 0;
    CONTRACTS.forEach(function (list) {
      (Array.isArray(d[list]) ? d[list] : []).forEach(function (x) {
        var next = R.nextShipmentDay(x, every);
        if (next === null || next > s.day) return;
        x.lastShipmentDay = next;
        income += clampInt(x.income || 0, 0);
      });
    });
    if (income > 0) {
      s.treasuryGP += income;
      logs.push(['Diplomacy', 'Contract shipments arrived: +' + income + ' gp.']);
    }
    RECORDS.forEach(function (list) {
      if (!Array.isArray(d[list])) { d[list] = []; return; }
      d[list] = d[list].filter(function (x) {
        if (dayNum(x.endDay, s.day) > s.day) return true;
        var contract = CONTRACTS.indexOf(list) !== -1;
        var line = 'Your ' + recordName(list, x) + ' has ended' + (contract ? ' (its last shipment arrived)' : '') + '.';
        logs.push(['Diplomacy', line]);
        word.push(line);
        return false;
      });
    });
    var clans = {};
    (d.consortiums || []).forEach(function (x) { clans[String(x.clan || '')] = true; });
    (s.tradeNetwork.routes || []).forEach(function (r) {
      if (!r || r.status === 'expired') return;
      if (!clans[String(r.clan || '')] || (r.expiresDay !== undefined && r.expiresDay !== null && s.day > r.expiresDay)) r.status = 'expired';
    });
    Object.keys(d.cooldowns || {}).forEach(function (k) {
      if (!(d.cooldowns[k] > s.day)) delete d.cooldowns[k];
    });
    return { logs: logs, word: word };
  };
  /* The gold contracts bring each week (a shipment each, every 7 days). */
  R.passiveIncome = function (s) {
    var d = s.diplomacy;
    return (d.agreements || []).concat(d.arbitrations || [], d.consortiums || []).reduce(function (a, x) { return a + (x.income || 0); }, 0);
  };

  /* ---------- Trade routes (2390-2595) ---------- */
  R.routeDC = function (s, route) {
    var stab = clampInt(s.tradeNetwork.stability === undefined ? 75 : s.tradeNetwork.stability, 0, 100);
    var stabMod = stab >= 85 ? -2 : stab >= 70 ? -1 : stab >= 50 ? 0 : stab >= 35 ? 1 : 2;
    var riskMod = route.risk === 'high' ? 3 : route.risk === 'medium' ? 1 : 0;
    var strat = String(s.tradeNetwork.strategy || 'balanced');
    var stratMod = strat === 'conservative' ? -1 : strat === 'aggressive' ? 2 : 0;
    var hr = s.tradeNetwork.highRiskRouting ? 2 : 0;
    return clampInt(12 + stabMod + riskMod + stratMod + hr, 6, 20);
  };
  R.routePayout = function (s, route, outcome) {
    if (String((route && route.status) || '').toLowerCase() === 'expired') return 0;
    var baseYield = clampInt(route.yieldGP || 0, 0, 999999);
    var yieldBonusPct = clampInt(s.tradeNetwork.yieldBonusPct || 0, 0, 200);
    var hrBonusPct = s.tradeNetwork.highRiskRouting ? 20 : 0;
    var boosted = Math.floor(baseYield * (100 + yieldBonusPct + hrBonusPct) / 100);
    if (outcome === 'strong_success') return clampInt(Math.floor(boosted * 1.20), 0, 999999);
    if (outcome === 'success') return clampInt(boosted, 0, 999999);
    return 0;
  };
  R.routeOutcomeFromTier = function (tier) {
    if (tier === 'critical_success' || tier === 'great_success') return 'strong_success';
    if (tier === 'success') return 'success';
    if (tier === 'failure') return 'failure';
    return 'critical_failure';
  };
  /* Routes still running today (2456-2463). */
  R.liveRoutes = function (s) {
    return (s.tradeNetwork.routes || []).filter(function (r) {
      if (!r || r.status === 'removed') return false;
      if (String(r.status || '').toLowerCase() === 'expired') return false;
      if (r.expiresDay !== undefined && r.expiresDay !== null && s.day > r.expiresDay) return false;
      return true;
    });
  };
  /* A route has sailed: its next sailing is 7 days on from the one just
     settled, so none can pay twice for the same sailing (BAS-05, BAS-11). */
  R.markSettled = function (s, r, data) {
    r.nextDay = dayNum(r.nextDay, s.day) + R.time(data).every;
    r.lastSettledDay = s.day;
  };
  /* Does this route need a typed roll? High-risk routes do, and every route
     does with High-Risk Routing on (2492-2494). */
  R.routeNeedsRoll = function (s, r) {
    return String(r.risk || 'low') === 'high' || !!s.tradeNetwork.highRiskRouting;
  };
  /* Settle one route: with no roll needed, roll is null. Returns the
     narrative line and the gold paid (2486-2568). */
  R.settleRoute = function (s, data, r, roll, rand) {
    var gained = 0;
    var line;
    if (r.status === 'disrupted') {
      line = r.clan + ': disrupted. Dockmasters report no confirmed arrivals.';
    } else if (!R.routeNeedsRoll(s, r)) {
      var payout = R.routePayout(s, r, 'success');
      if (payout > 0) {
        s.treasuryGP += payout;
        gained = payout;
        line = r.clan + ' caravans arrive on schedule, holds sealed and accounted. Treasury increases by ' + payout + ' gp.';
      } else {
        line = r.clan + ' reports routine movement, but no taxable yield was recorded.';
      }
    } else {
      var dc = R.routeDC(s, r);
      var outcome = R.routeOutcomeFromTier(R.tierFromRoll(roll.d20, roll.total, dc));
      if (outcome === 'success' || outcome === 'strong_success') {
        var pay = R.routePayout(s, r, outcome);
        s.treasuryGP += pay;
        gained = pay;
        line = outcome === 'strong_success'
          ? r.clan + ' convoys arrive early with double-stamped manifests. Treasury increases by ' + pay + ' gp.'
          : r.clan + ' convoys arrive after a tense crossing. Treasury increases by ' + pay + ' gp.';
      } else {
        r.status = 'disrupted';
        if (outcome === 'failure') {
          line = r.clan + ' route collapses into delays and seized cargo. Status: Disrupted. No income collected.';
        } else {
          var drop = String(r.risk || 'low') === 'high' ? 10 : 6;
          s.tradeNetwork.stability = clampInt((s.tradeNetwork.stability === undefined ? 75 : s.tradeNetwork.stability) - drop, 0, 100);
          line = r.clan + ' suffers a catastrophic loss at sea. Status: Disrupted. Market Stability falls by ' + drop + '%.';
          R.enqueueDispute(s, data, r.clan, 'Trade disruption and disputed tariffs.', {
            kind: 'trade', routeClan: r.clan, commodity: r.commodity || 'Goods', disruptedDay: s.day,
            stabilityAtFiling: clampInt(s.tradeNetwork.stability === undefined ? 75 : s.tradeNetwork.stability, 0, 100),
            risk: r.risk || 'medium', b: data.bastion.consortiumName
          }, rand);
        }
      }
    }
    R.markSettled(s, r, data);
    return { line: line, gained: gained };
  };

  /* ---------- The Council Ledger (2753-3051) ---------- */
  R.enqueueDispute = function (s, data, clanA, reason, meta, rand) {
    meta = meta || {};
    s.arbitration.queue.push({
      id: R.uid(rand),
      a: String(clanA || 'Unknown'),
      b: String(meta.b || data.bastion.consortiumName),
      reason: String(reason || 'A dispute over tariffs, delays, and cargo claims.'),
      createdDay: s.day,
      meta: {
        kind: String(meta.kind || 'trade'),
        routeClan: String(meta.routeClan || clanA || ''),
        routeId: meta.routeId ? String(meta.routeId) : null,
        risk: meta.risk ? String(meta.risk) : null,
        commodity: meta.commodity ? String(meta.commodity) : null,
        disruptedDay: meta.disruptedDay !== undefined && meta.disruptedDay !== null ? dayNum(meta.disruptedDay, null) : null,
        stabilityAtFiling: meta.stabilityAtFiling !== undefined && meta.stabilityAtFiling !== null ? clampInt(meta.stabilityAtFiling, 0, 100) : null
      }
    });
  };
  /* The Writ bonus. It's never granted, so this is always 0 (B6, kept). */
  R.councilBonus = function (s) { return s.arbitration.authorityBonusTurns && s.arbitration.authorityBonusTurns > 0 ? 2 : 0; };
  /* A ruling once its roll is in. choice is 'A', 'S' or 'B'. */
  R.rule = function (s, data, disputeId, choice, roll) {
    var d = null;
    s.arbitration.queue.forEach(function (x) { if (String(x.id) === String(disputeId)) d = x; });
    if (!d) return null;
    var dc = data.bastion.councilDC;
    var bonus = R.councilBonus(s);
    var total = roll.total;
    var passed = total >= dc;
    var clanA = String(d.a || '');
    var clanB = String(d.b || data.bastion.consortiumName);
    if (passed) s.arbitration.queue = s.arbitration.queue.filter(function (x) { return String(x.id) !== String(disputeId); });
    else d.reason = String(d.reason || '') + ' (Returned to docket after council deadlock.)';
    if (s.arbitration.authorityBonusTurns && s.arbitration.authorityBonusTurns > 0) s.arbitration.authorityBonusTurns -= 1;
    /* A binding verdict restores the first route with that clan, if it's disrupted. */
    if (passed && d.meta && d.meta.routeClan) {
      var rc = String(d.meta.routeClan);
      var route = null;
      (s.tradeNetwork.routes || []).some(function (r) { if (String(r.clan) === rc) { route = r; return true; } return false; });
      if (route && route.status === 'disrupted') route.status = 'active';
    }
    var verdictWord = choice === 'A' ? 'ruled for ' + clanA : choice === 'B' ? 'ruled for ' + clanB : 'split the claims';
    /* The log shows "[object Object]" for the roll, as before (BAS-29, kept). */
    var outcomeLine = passed
      ? 'The seal is struck. The council has ' + verdictWord + '. (Roll [object Object]' + (bonus ? '+' + bonus : '') + ' = ' + total + ' vs DC ' + dc + ')'
      : 'Wax cracks under hesitation. The council fails to reach binding consensus. (Roll [object Object]' + (bonus ? '+' + bonus : '') + ' = ' + total + ' vs DC ' + dc + ')';
    var rulingLabel = choice === 'A' ? 'Rule for ' + clanA : choice === 'B' ? 'Rule for ' + clanB : 'Split the Claims';
    var effects = [];
    var stab = function (delta) { s.tradeNetwork.stability = clampInt((s.tradeNetwork.stability === undefined ? 75 : s.tradeNetwork.stability) + delta, 0, 100); };
    if (passed) {
      if (choice === 'A') {
        R.addPoliticalCapital(s, clanA, 6); stab(-1);
        effects.push(clanA + ' gains political leverage (+6 Political Capital).', 'Consortium confidence wavers. Market Stability -1%.');
      } else if (choice === 'S') {
        R.addPoliticalCapital(s, clanA, 2); stab(2);
        effects.push(clanA + ' accepts a compromise (+2 Political Capital).', 'Market Stability +2%.');
      } else if (choice === 'B') {
        R.addPoliticalCapital(s, clanA, -4); stab(4);
        effects.push(clanA + ' loses face (-4 Political Capital).', 'Market Stability +4%.');
      }
      if (d.meta && d.meta.routeClan) effects.push(d.meta.routeClan + ' route status: Restored (Active).');
    } else {
      R.addPoliticalCapital(s, clanA, -2); stab(-2);
      effects.push(clanA + ' storms out of chamber (-2 Political Capital).', 'Market Stability -2%.');
    }
    return {
      passed: passed, dc: dc, bonus: bonus, total: total, roll: roll, rulingLabel: rulingLabel, effects: effects,
      verdictText: passed ? 'A verdict is issued. The council seals the ruling: ' + rulingLabel + '.' : 'The council deadlocks. No binding verdict is sealed today.',
      log: ['Arbitration', outcomeLine],
      stillThere: s.arbitration.queue.some(function (x) { return String(x.id) === String(disputeId); })
    };
  };

  /* ---------- Identity (4995-5033) ---------- */
  R.supportForClanKey = function (s, key) {
    var pc = clampInt(s.politicalCapital[key] || 0, -100, 100);
    var hr = clampInt(s.honourRespectByClan[key] || 0, -5, 5);
    return clampInt(Math.round((pc + 100) / 2 + hr * 4), 0, 100);
  };
  R.totalSupport = function (s) {
    return CLAN_KEYS.reduce(function (sum, k) { return sum + R.supportForClanKey(s, k); }, 0);
  };
  R.clansAtSupport = function (s, threshold) {
    return CLAN_KEYS.filter(function (k) { return R.supportForClanKey(s, k) >= threshold; }).length;
  };
  R.canFormClan = function (s, data) {
    var rules = data.bastion.identityRules;
    var lvlOk = (s.partyLevel || 1) >= rules.clanMinLevel;
    var totalOk = R.totalSupport(s) >= rules.clanSupportTotalMin;
    var countOk = R.clansAtSupport(s, rules.clanSupportPerClanMin) >= rules.clanSupportClanCountMin;
    return { ok: lvlOk && totalOk && countOk, lvlOk: lvlOk, totalOk: totalOk, countOk: countOk };
  };
  R.orgLabel = function (s) {
    var o = s.organization;
    if (o.type === 'clan') return 'Clan: ' + (o.name || 'Unnamed');
    return 'Unsworn';
  };
  R.requirementsHint = function (s, data) {
    var r = data.bastion.identityRules;
    var c = R.canFormClan(s, data);
    return 'Clan requirements: Level ' + r.clanMinLevel + '+ (' + (c.lvlOk ? 'OK' : 'NO') + '), Total Support ' + r.clanSupportTotalMin + '+ (' + (c.totalOk ? 'OK' : 'NO') + '), ' +
      r.clanSupportClanCountMin + ' clans at ' + r.clanSupportPerClanMin + '+ (' + (c.countOk ? 'OK' : 'NO') + ').';
  };

  /* ---------- War (5262-5404) ---------- */
  /* Military counted by quantity, e.g. "Lieutenant (1)" rows (4983-4993). */
  R.militaryQty = function (s, rx) {
    return (s.military || []).reduce(function (sum, it) {
      return rx.test(String((it && it.name) || '')) ? sum + clampInt(it.qty === undefined || it.qty === null ? 1 : it.qty, 0) : sum;
    }, 0);
  };
  /* Beasts counted by number: each row is one kind of beast with its qty,
     so five Giant Vultures are five beasts (BAS-25, Harry's request,
     2 October 2026; they were counted by row before, B10). */
  R.beastQty = function (s) {
    return (Array.isArray(s.defenderBeasts) ? s.defenderBeasts : []).reduce(function (sum, it) {
      return sum + clampInt(it && it.qty !== undefined && it.qty !== null ? it.qty : 1, 0);
    }, 0);
  };
  /* The old single-roll war (R.warCommit, R.queueWarAction, R.warPlan,
     R.resolveWar and R.removeBeasts) was archived in Build 3, with the
     Mercenary Brigade: tools/bastion/archive/mercenary-brigade.js. What can
     be committed is R.warForces, R.warAvailable and R.warCommit2, in
     war-campaign-rules.js. */

  /* ---------- The Military Action (Harry's request, 2 October 2026) ----------
     When a war action comes due, it becomes a Military Action instead of a
     single roll: three rolls (Weather, Morale, Luck), then the battle on the
     War Table. Every step is saved as it happens, and each one only applies
     at its own step, so a cancelled roll or a closed window loses nothing
     and nothing is applied twice.
     step: 'weather' → 'morale' → 'luck' → 'deploy' → 'battle'.
     The opening rolls are here; the rest (starting the action, its battle
     line-up, saving the battle, calling off, and the consequences) is in
     war-campaign-rules.js, with R.MILITARY_STEPS. */
  function maData(data) { return data.bastion.war.militaryAction; }

  /* "Giant Vulture" → "GV"; "Ape" → "Ap". */
  R.forceInitials = function (name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    if (words.length === 1) return words[0].slice(0, 2).replace(/^./, function (c) { return c.toUpperCase(); });
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  R.militaryById = function (s, id) {
    var list = Array.isArray(s.militaryActions) ? s.militaryActions : [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };
  /* "Raid vs Bacca": the objective's own name from war-units-data.js (the
     old tool wrote its id in capitals, "SEIZE_OUTPOST vs Bacca"). */
  R.militaryName = function (ma) {
    var war = window.TSI_DATA && window.TSI_DATA.bastionWar;
    var o = war && war.objectives && war.objectives[ma.objective || 'raid'];
    return (o ? o.name : String(ma.objective || 'raid').toUpperCase()) + ' vs ' + ma.targetName;
  };

  R.militaryWeather = function (data, id) {
    var m = maData(data);
    if (id === m.clear.id) return m.clear;
    for (var i = 0; i < m.storms.length; i++) if (m.storms[i].id === id) return m.storms[i];
    return m.clear;
  };
  /* The DC for a step. Morale's rises with bad weather. */
  R.militaryDC = function (data, ma, step) {
    var dc = maData(data).dc;
    if (step === 'weather') return dc.weather;
    if (step === 'morale') return dc.morale + (ma.weather ? R.militaryWeather(data, ma.weather.id).moraleDc || 0 : 0);
    if (step === 'luck') return dc.luck;
    return null;
  };
  /* The Luck roll's modifier to every attack in the battle: the war data
     file's (W.luck passMod / failMod), so the Luck box, the summary and the
     battle always agree; +1 / −1 if that file isn't loaded. */
  R.luckMod = function (data, pass) {
    var w = (data && data.war) || (window.TSI_DATA && window.TSI_DATA.bastionWar);
    var l = w && w.luck;
    if (pass) return l && typeof l.passMod === 'number' ? l.passMod : 1;
    return l && typeof l.failMod === 'number' ? l.failMod : -1;
  };
  R.militaryRollTitle = function (step) {
    return { weather: 'Weather Conditions', morale: 'Morale', luck: 'Luck' }[step] || 'Roll';
  };

  /* Apply one roll ({ d20, total }) at its step. Returns what happened (see
     militaryResult), or null if it isn't that step any more. */
  R.militaryRoll = function (s, data, id, step, roll, rand) {
    var ma = R.militaryById(s, id);
    if (!ma || ma.step !== step || !roll) return null;
    var dc = R.militaryDC(data, ma, step);
    var pass = roll.total >= dc;
    var rec = { d20: roll.d20, total: roll.total, dc: dc, pass: pass };
    if (step === 'weather') {
      var storms = maData(data).storms;
      rec.id = pass ? maData(data).clear.id : storms[Math.min(storms.length - 1, Math.floor(rand() * storms.length))].id;
      ma.weather = rec;
      ma.step = 'morale';
    } else if (step === 'morale') {
      ma.morale = rec;
      ma.step = 'luck';
    } else if (step === 'luck') {
      rec.mod = R.luckMod(data, pass);
      ma.luck = rec;
      ma.step = 'deploy';
      /* The three rolls now belong to the mission and the battle's line-up. */
      if (R.warConditionsRolled) R.warConditionsRolled(s, data, ma);
    } else {
      return null;
    }
    return R.militaryResult(data, ma, step);
  };

  /* Who keeps the ranks going: the Lieutenants if any march, otherwise the
     party themselves ("you"). */
  function leaders(ma, capital) {
    var who = ma.commit && ma.commit.lieutenants > 0 ? 'your Lieutenants' : 'you';
    return capital ? who.charAt(0).toUpperCase() + who.slice(1) : who;
  }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }

  /* What a finished step shows: { title, headline, text, video }. */
  R.militaryResult = function (data, ma, step) {
    var m = maData(data);
    if (step === 'weather' && ma.weather) {
      var w = R.militaryWeather(data, ma.weather.id);
      return {
        title: 'Weather Conditions', pass: ma.weather.pass,
        headline: ma.weather.pass || w.title.indexOf(w.kind) !== -1 ? w.title : w.title + ' (' + w.kind + ')',
        text: w.text + (w.moraleDc ? '\n\nThe march will be hard: the Morale DC rises by ' + w.moraleDc + '.' : ''),
        video: w.video || null
      };
    }
    if (step === 'morale' && ma.morale) {
      var wid = ma.weather ? R.militaryWeather(data, ma.weather.id).id : m.clear.id;
      var t = (m.morale[wid] || m.morale.clear)[ma.morale.pass ? 'pass' : 'fail'];
      return {
        title: 'Morale', pass: ma.morale.pass,
        headline: ma.morale.pass ? 'Morale: High' : 'Morale: Low',
        text: t.replace(/\{leaders\}/g, leaders(ma, false)).replace(/\{Leaders\}/g, leaders(ma, true)),
        video: null
      };
    }
    if (step === 'luck' && ma.luck) {
      return {
        title: 'Luck', pass: ma.luck.pass,
        headline: 'Luck: ' + signed(ma.luck.mod),
        text: m.luck[ma.luck.pass ? 'pass' : 'fail'],
        video: null
      };
    }
    return null;
  };

  /* The three results so far, for the War Table's header and the panel. */
  R.militarySummary = function (data, ma) {
    var out = [];
    if (ma.weather) out.push({ label: 'Weather', value: R.militaryWeather(data, ma.weather.id).title });
    if (ma.morale) out.push({ label: 'Morale', value: ma.morale.pass ? 'High' : 'Low' });
    if (ma.luck) out.push({ label: 'Luck', value: signed(ma.luck.mod) });
    return out;
  };

  /* ---------- Passing a day, as resumable steps (560-604; BAS-02) ----------
     The screen passes each new day in turn, in this order:
     1. R.startDay: the day number moves on; Lieutenants and beasts whose
        recovery is over are fit again, quiet wars end, repairs that are
        done finish, building work due today is built, contracts due a
        shipment send it and records whose days are up end.
     2. 'trade': the sea routes sailing today settle (a d20 for a high-risk
        route, asked for by the screen; R.settleRoute), then R.finishRoutes.
     3. 'orders': the orders due today complete one by one (the screen asks
        for any rolls; a cancelled roll leaves the order due, R.skipOrder).
     4. 'war' (R.rollWarAttack): each Clan at war whose 7-day mark is today
        rolls to attack.
     5. R.finishDay: what happened goes into "The Ironbow sends word…"
        (state.word).
     state.dayInProgress remembers the step reached, so a cancelled roll or
     a closed window loses nothing and nothing is done twice. */
  var DAY_STAGES = ['trade', 'orders'];
  R.DAY_STAGES = DAY_STAGES;
  R.startDay = function (s, data, now) {
    s.day += 1;
    s.dayInProgress = { day: s.day, stage: 'trade', skipped: [], attackRolled: false, news: [] };
    /* Lieutenants and beasts whose recovery is over are fit again; wars
       with 42 quiet days end; repairs that are done finish
       (war-campaign-rules.js). Each says so in the log and the word. */
    var before = s.log.length;
    if (R.tickRecovery) R.tickRecovery(s, now);
    if (R.tickWars) R.tickWars(s, now, data);
    if (R.tickRepairs) R.tickRepairs(s, now, data);
    for (var i = s.log.length - before - 1; i >= 0; i--) R.addWord(s, s.log[i].body);
    R.completeConstruction(s).forEach(function (id) {
      var fac = R.facility(data, id);
      var name = fac ? fac.name : id;
      R.log(s, 'Construction Complete', name + ' is now built and active.', now);
      R.addWord(s, 'The ' + name + ' is built.');
    });
    var dip = R.tickDiplomacy(s, data);
    dip.logs.forEach(function (l) { R.log(s, l[0], l[1], now); });
    dip.word.forEach(function (l) { R.addWord(s, l); });
  };
  /* Routes sailing today and still to settle (running, and their day has
     come). A route whose roll was cancelled stays due. */
  R.routesToSettle = function (s) {
    if (!s.tradeNetwork.active) return [];
    return R.liveRoutes(s).filter(function (r) { return !(dayNum(r.nextDay, s.day) > s.day); });
  };
  R.routesDueToday = function (s) { return R.routesToSettle(s).length > 0; };
  /* The day's routes are done (or put off): on to the orders. */
  R.finishRoutes = function (s) {
    if (s.dayInProgress && s.dayInProgress.stage === 'trade') s.dayInProgress.stage = 'orders';
  };
  /* An order whose roll was cancelled stays due; it's skipped for the rest
     of this day and comes up again the next day (or with Resolve). */
  R.skipOrder = function (s, id) {
    if (s.dayInProgress && s.dayInProgress.skipped.indexOf(id) === -1) s.dayInProgress.skipped.push(id);
  };
  /* The day's last step: the day's news is kept for "The Ironbow sends
     word…". */
  R.finishDay = function (s) {
    var dip = s.dayInProgress;
    if (isObj(dip) && Array.isArray(dip.news) && dip.news.length) {
      if (!Array.isArray(s.word)) s.word = [];
      s.word.push({ day: s.day, lines: dip.news.slice() });
    }
    s.dayInProgress = null;
  };
  /* The Explorer's day, read by the screen: what to do about it.
     { kind: 'none' } nothing; { kind: 'anchor', to } the Bastion hasn't
     read a day yet, so it moves to this one without passing days;
     { kind: 'pass', days } days to pass; { kind: 'shift', by } the Explorer's
     day went back (Reset Travel): everything moves by this many days. */
  R.clockAction = function (s, explorerDay) {
    var d = dayNum(explorerDay, null);
    if (d === null || d < 1) return { kind: 'none' };
    if (!s.anchored) return d === s.day ? { kind: 'anchor', to: d, by: 0 } : { kind: 'anchor', to: d, by: d - s.day };
    if (s.dayInProgress) return { kind: 'pass', days: Math.max(0, d - s.day) };
    if (d > s.day) return { kind: 'pass', days: d - s.day };
    if (d < s.day) return { kind: 'shift', by: d - s.day };
    return { kind: 'none' };
  };
  /* Move the whole Bastion by `by` days (Reset Travel put the Explorer's day
     back, or the Bastion is reading the Explorer's day for the first time):
     every due day, ready day, end day, cooldown, route, war, repair and
     recovery moves with it, so what was due in 4 days is still due in 4
     days. The log and "The Ironbow sends word…" are history and stay. */
  R.shiftDays = function (s, by) {
    var n = dayNum(by, 0);
    if (!n) return;
    var mv = function (obj, key) { if (obj && typeof obj[key] === 'number') obj[key] += n; };
    s.day = Math.max(1, s.day + n);
    if (isObj(s.dayInProgress)) s.dayInProgress.day = s.day;
    if (isObj(s.defenders)) mv(s.defenders, 'patrolUntil');
    (s.pendingOrders || []).forEach(function (o) { mv(o, 'issuedDay'); mv(o, 'dueDay'); if (o.meta && isObj(o.meta.declared)) mv(o.meta.declared, 'day'); });
    (s.builtExtras || []).concat(s.builtPlots || []).forEach(function (e) { if (isObj(e)) { mv(e, 'startDay'); mv(e, 'readyDay'); } });
    RECORDS.forEach(function (list) {
      (s.diplomacy[list] || []).forEach(function (x) { mv(x, 'startDay'); mv(x, 'endDay'); mv(x, 'lastShipmentDay'); });
    });
    Object.keys(s.diplomacy.cooldowns || {}).forEach(function (k) { mv(s.diplomacy.cooldowns, k); });
    (s.tradeNetwork.routes || []).forEach(function (r) { mv(r, 'openedDay'); mv(r, 'expiresDay'); mv(r, 'nextDay'); mv(r, 'lastSettledDay'); });
    (s.arbitration.queue || []).forEach(function (q) { mv(q, 'createdDay'); if (q.meta) mv(q.meta, 'disruptedDay'); });
    Object.keys(s.repairs || {}).forEach(function (k) { mv(s.repairs, k); });
    Object.keys(s.wars || {}).forEach(function (k) { mv(s.wars[k], 'since'); mv(s.wars[k], 'last'); mv(s.wars[k], 'next'); });
    (s.warRecovery || []).forEach(function (r) { mv(r, 'untilDay'); });
    (s.militaryActions || []).forEach(function (ma) { mv(ma, 'day'); });
    Object.keys(s.warMissions || {}).forEach(function (k) { mv(s.warMissions[k], 'createdDay'); mv(s.warMissions[k], 'seenDay'); });
    if (isObj(s.organization)) mv(s.organization, 'foundedAtDay');
    /* Port Charters, ships at sea and standing shipments (pull request 5). */
    if (R.shiftCommerce) R.shiftCommerce(s, n);
    /* The Courier Exchange's parcels (pull request 6). */
    if (R.shiftCourier) R.shiftCourier(s, n);
    /* The Hall's Diplomatic Records (pull request 9). */
    if (R.shiftDiplomaticRecords) R.shiftDiplomaticRecords(s, n);
    /* The creatures (pull request 7): when each was granted and housed. */
    (Array.isArray(s.creatures) ? s.creatures : []).forEach(function (c) { mv(c, 'grantedDay'); mv(c, 'housedDay'); });
    /* The Great Rites (pull request 8b): the day each was made. */
    (Array.isArray(s.greatRites) ? s.greatRites : []).forEach(function (g) { mv(g, 'madeDay'); if (g && g.assignedDay !== undefined) mv(g, 'assignedDay'); });
  };
  /* Read the Explorer's day for the first time (or before it has one): the
     Bastion moves to it, nothing passes. */
  R.anchor = function (s, day) {
    var d = Math.max(1, dayNum(day, s.day));
    R.shiftDays(s, d - s.day);
    s.day = d;
    s.anchored = true;
  };

  /* ---------- What's waiting and what's next (the screen and the DM doc) ---------- */
  /* Orders and builds by when they finish: [{ kind: 'order'|'build', label,
     day, due }] in day order, due ones first. */
  R.upcoming = function (s, data) {
    var out = [];
    s.pendingOrders.forEach(function (o) {
      if (!isObj(o)) return;
      out.push({ kind: 'order', id: o.id, label: o.label || 'Order', day: dayNum(o.dueDay, s.day), due: R.isDue(s, o), repair: R.underRepair(s, o.facId) });
    });
    R.normalizeBuiltExtras(s);
    allEntries(s).forEach(function (e) {
      if (e.status !== 'building') return;
      var fac = R.facility(data, e.facId);
      out.push({ kind: 'build', id: e.facId, label: (fac ? fac.name : e.facId), day: dayNum(e.readyDay, s.day), due: false, repair: 0 });
    });
    return out.sort(function (a, b) { return a.day - b.day; });
  };

  /* ---------- The Compendium (4098-4142) ---------- */
  R.compendiumIndex = function (facilities, tools) {
    var map = {};
    var order = [];
    var add = function (label, facName, fnLabel) {
      var key = String(label || '').trim();
      if (!key) return;
      if (!map[key]) { map[key] = []; order.push(key); }
      var sig = facName + '__' + (fnLabel || '');
      if (!map[key].some(function (x) { return x.facName + '__' + (x.fnLabel || '') === sig; })) map[key].push({ facName: facName, fnLabel: fnLabel || '' });
    };
    facilities.forEach(function (fac) {
      var facName = fac.name || fac.id || 'Unknown Facility';
      (fac.functions || []).forEach(function (fn) {
        if (fn.production) return; /* goods and recipes aren't Compendium items */
        var fnLabel = fn.label || fn.id || '';
        (Array.isArray(fn.options) ? fn.options : []).forEach(function (o) {
          if (o && typeof o === 'object' && 'label' in o) add(o.label, facName, fnLabel);
          else add(String(o), facName, fnLabel);
        });
      });
    });
    Object.keys(tools || {}).forEach(function (t) {
      (Array.isArray(tools[t]) ? tools[t] : []).forEach(function (item) { add(String(item), 'Workshop', 'Craft (via Artisan Tools)'); });
    });
    var items = order.slice().sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
    return { items: items, links: map };
  };
  R.roll20Url = function (item) { return 'https://roll20.net/compendium/dnd5e/' + encodeURIComponent(String(item || '').trim()); };
  /* Export Compendium JSON without the online lookup (B15): entries already
     filled in are kept, the rest become stubs with a Roll20 link. */
  R.compendiumExport = function (index, existing) {
    var out = {};
    Object.keys(existing || {}).forEach(function (k) { out[k] = Object.assign({}, existing[k]); });
    var kept = 0;
    var stubbed = 0;
    index.items.forEach(function (name) {
      var e = out[name];
      if (e && String(e.summary || '').trim()) {
        if (!e.roll20) e.roll20 = R.roll20Url(name);
        kept += 1;
        return;
      }
      out[name] = { type: (e && e.type) || '', attunement: (e && e.attunement) || '', summary: (e && e.summary) || '', source: (e && e.source) || '', roll20: R.roll20Url(name) };
      stubbed += 1;
    });
    var sorted = {};
    Object.keys(out).sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); }).forEach(function (k) { sorted[k] = out[k]; });
    return { file: { version: 1, items: sorted }, filled: 0, kept: kept, stubbed: stubbed };
  };

  ns.rules = R;
  /* The import check the campaign save uses from the other tool's page
     (shared/js/backup.js): the Explorer and the Bastion export and import
     together, so each page loads the other's rules to check its half. */
  TSI.importChecks = TSI.importChecks || {};
  TSI.importChecks.bastion = R.importProblem;
}());
