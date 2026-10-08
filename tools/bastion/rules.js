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
   - The Treasure event (99–00) can come up (B11).

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
    return typeof n === 'number' && isFinite(n) ? Math.max(-100000, Math.min(100000, Math.round(n))) : fallback;
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
      musterDays: t.musterDays > 0 ? t.musterDays : 3,
      eventEvery: t.eventEvery > 0 ? t.eventEvery : 28
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
  R.defaultTradeNetwork = function () {
    return { active: false, strategy: 'balanced', stability: 75, routes: [] };
  };
  R.defaultState = function (data) {
    var s = {
      treasuryGP: 0,
      partyLevel: 7,
      builtFacilities: data.bastion.startingBuilt.slice(),
      builtExtras: [],
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
      /* The days overhaul (8 October 2026): v 2 marks a save in days. day is
         the last day the Bastion has passed; anchored, whether it has read
         the Explorer's day yet (until then any Explorer day moves the whole
         Bastion to it, without passing days). */
      v: 2,
      day: 1,
      anchored: false,
      lastEvent: null,
      /* The day of the latest automatic Bastion event. */
      lastEventDay: 0,
      log: [],
      organization: { type: 'unsworn', name: '', chief: '', motto: '', foundedAtDay: null },
      clanHonor: 40,
      honourRespectByClan: clanMap(0),
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
      repairs: {}
    };
    R.ensureLevels(s, data);
    return s;
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
    var s = saved;
    d.treasuryGP = clampInt(s.treasuryGP === undefined || s.treasuryGP === null ? 0 : s.treasuryGP, 0);
    d.partyLevel = clampInt(s.partyLevel === undefined || s.partyLevel === null ? 7 : s.partyLevel, 1, 20);
    if (arr(s.builtFacilities)) d.builtFacilities = s.builtFacilities.slice();
    if (arr(s.builtExtras)) d.builtExtras = s.builtExtras.slice();
    if (isObj(s.facilityLevels)) d.facilityLevels = Object.assign({}, s.facilityLevels);
    if (arr(s.pendingOrders)) d.pendingOrders = s.pendingOrders.filter(isObj);
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
    if (arr(s.warehouse)) d.warehouse = s.warehouse.filter(isObj);
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
    d.lastEvent = isObj(s.lastEvent) ? s.lastEvent : null;
    d.lastEventDay = dayNum(s.lastEventDay, 0);
    if (arr(s.log)) d.log = s.log.filter(isObj);
    if (isObj(s.organization)) {
      var o = s.organization;
      d.organization = {
        type: o.type === 'clan' || o.type === 'merc' ? o.type : 'unsworn',
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
    if (arr(s.militaryActions)) d.militaryActions = s.militaryActions.filter(isObj);
    R.normalizeBuiltExtras(d);
    R.ensureLevels(d, data);
    /* The war's records (missions, recovery, depleted regiments, Military
       Actions, including upgrading phase 1 ones) are tidied last, by
       war-campaign-rules.js, as they need everything else loaded. */
    if (R.normalizeWar) R.normalizeWar(d, s, data);
    return d;
  };
  R.toSave = function (state) { return TSI.clone(state); };

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
    var lists = ['builtExtras', 'pendingOrders', 'defenderBeasts', 'military', 'warehouse', 'log', 'warLog', 'militaryActions', 'warRecovery'];
    for (var i = 0; i < lists.length; i++) {
      if (lists[i] in s && !Array.isArray(s[lists[i]])) return 'Its ' + lists[i] + ' list is damaged.';
    }
    var maps = ['defenders', 'favour', 'politicalCapital', 'tradeNetwork', 'arbitration', 'diplomacy', 'organization', 'facilityLevels', 'warMissions', 'wars', 'repairs'];
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
    return isObj(s) && s.v !== 2 && ('turn' in s || 'turnInProgress' in s);
  };
  R.isUi = function (v) { return isObj(v); };

  /* The Clan's or Brigade's crest picture, saved apart from the Bastion as
     tsi.bastion.crest (it's shrunk when uploaded): { dataUrl, key, name }. */
  R.isCrest = function (v) {
    return isObj(v) && typeof v.dataUrl === 'string' && /^data:image\//.test(v.dataUrl) && typeof v.key === 'string';
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
      if (r.key === 'tsi.bastion.warMap' && !R.isWarMap(r.value)) return 'This file\'s battle map isn\'t in the right form, so it wasn\'t imported. Nothing was changed.';
      if (r.key === 'tsi.bastion.warTable' && !R.isWarTable(r.value)) return 'This file\'s War Table settings aren\'t in the right form, so it wasn\'t imported. Nothing was changed.';
      if (r.key === 'tsi.bastion.warTerrain' && !R.isWarTerrain(r.value)) return 'This file\'s battle terrain isn\'t in the right form, so it wasn\'t imported. Nothing was changed.';
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
  /* Old saves' plain names become { facId, status: "built" } (229-237). */
  R.normalizeBuiltExtras = function (s) {
    if (!Array.isArray(s.builtExtras)) s.builtExtras = [];
    s.builtExtras = s.builtExtras.map(function (x) {
      if (!x) return '';
      if (typeof x === 'string') return { facId: x, status: 'built' };
      if (typeof x === 'object' && x.facId) return x;
      return '';
    });
  };
  function extras(s) { return s.builtExtras.filter(function (x) { return x && typeof x === 'object' && x.facId; }); }
  /* Built or being built: can't be chosen again (240-246). */
  R.reservedFacilityIds = function (s, data) {
    R.normalizeBuiltExtras(s);
    var ids = data.bastion.startingBuilt.concat(extras(s).map(function (x) { return x.facId; }));
    return ids.filter(function (id, i) { return ids.indexOf(id) === i; });
  };
  /* Built and working (249-255). */
  R.builtFacilityIds = function (s, data) {
    R.normalizeBuiltExtras(s);
    var ids = data.bastion.startingBuilt.concat(extras(s).filter(function (x) { return x.status === 'built'; }).map(function (x) { return x.facId; }));
    return ids.filter(function (id, i) { return ids.indexOf(id) === i; });
  };
  /* Building work finished by today: each building whose ready day has
     come is built. Returns the facilities finished (258-282). */
  R.completeConstruction = function (s) {
    R.normalizeBuiltExtras(s);
    var completed = [];
    s.builtExtras = s.builtExtras.map(function (entry) {
      if (!entry || entry === '') return '';
      if (entry.status === 'building' && !(dayNum(entry.readyDay, s.day) > s.day)) {
        completed.push(entry.facId);
        return { facId: entry.facId, status: 'built' };
      }
      return entry;
    });
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
  R.slotRows = function (s, level) {
    R.normalizeBuiltExtras(s);
    var max = R.constructionSlotsForLevel(level);
    while (s.builtExtras.length < max) s.builtExtras.push('');
    while (s.builtExtras.length > max && !s.builtExtras[s.builtExtras.length - 1]) s.builtExtras.pop();
    var used = extras(s).length;
    var seen = 0;
    return {
      max: max,
      used: used,
      over: Math.max(0, used - max),
      rows: s.builtExtras.map(function (entry, i) {
        var occupied = !!(entry && entry.facId);
        var over = false;
        if (occupied) { over = seen >= max; seen += 1; }
        return { index: i, entry: occupied ? entry : null, overCapacity: over, canBuild: !occupied && used < max };
      })
    };
  };
  R.startBuild = function (s, data, slotIndex, facId) {
    if (!facId) return { ok: false };
    if (s.builtExtras[slotIndex]) return { ok: false };
    var fac = R.facility(data, facId);
    var req = Number(fac && fac.requiredLevel || 0);
    var name = (fac && fac.name) || facId;
    if (s.partyLevel < req) return { ok: false, message: 'Locked. ' + name + ' requires party level ' + req + '.' };
    if (R.reservedFacilityIds(s, data).indexOf(facId) !== -1) return { ok: false, message: 'That facility is already built or under construction.' };
    var days = R.buildDaysForRequiredLevel(req, data);
    if (days <= 0) {
      s.builtExtras[slotIndex] = { facId: facId, status: 'built' };
      return { ok: true, log: ['Construction', name + ' built instantly.'] };
    }
    s.builtExtras[slotIndex] = { facId: facId, status: 'building', startDay: s.day, readyDay: s.day + days };
    return { ok: true, log: ['Construction Started', name + ' is under construction (' + days + ' days: ready on Day ' + (s.day + days) + ').'] };
  };
  R.getFacilityLevel = function (s, facId) { return clampInt(s.facilityLevels && s.facilityLevels[facId] !== undefined && s.facilityLevels[facId] !== null ? s.facilityLevels[facId] : 1, 1, 3); };

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
    return fn.options || [];
  };
  function orderLabel(fac, fn, optionLabel) {
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

  /* Issue an order from a facility card (3247-3344). optionIdx is the list's choice. */
  R.issueOrder = function (s, data, facId, fnId, optionIdx, rand) {
    var fac = R.facility(data, facId);
    var fn = R.fn(fac, fnId);
    if (!fac || !fn) return { ok: false };
    var broken = repairRefusal(s, fac);
    if (broken) return broken;
    if (pendingSame(s, facId, fnId)) return { ok: false, message: 'That order is already pending.' };
    var chosen = null;
    var optionLabel = null;
    if (fn.options && fn.options.length) {
      chosen = fn.options[clampInt(optionIdx, 0)] || null;
      optionLabel = chosen && chosen.label ? chosen.label : String(chosen || '');
    } else if (fac.id === 'workshop' && fn.id === 'craft') {
      var picked = R.craftItems(s, data.tools)[clampInt(optionIdx, 0)] || '';
      chosen = { label: picked, craftItem: picked };
      optionLabel = picked;
    }
    var notes = '';
    if (facId === 'library' && fnId === 'research') notes = data.bastion.scriptureNotes[String(optionLabel || '').trim()] || '';
    var costGP = R.withSummitDiscount(s, fac, fn, R.computeFnCost(s, fac, fn, chosen).costGP);
    if (costGP > s.treasuryGP) return { ok: false, message: 'Not enough gp. Need ' + costGP + 'gp, you have ' + s.treasuryGP + 'gp.' };
    s.treasuryGP -= costGP;
    var label = orderLabel(fac, fn, optionLabel);
    var days = R.orderDays(fn);
    s.pendingOrders.push({ id: R.uid(rand), facId: facId, fnId: fnId, chosen: chosen, optionLabel: optionLabel, notes: notes, label: label, costGP: costGP, issuedDay: s.day, dueDay: s.day + days });
    return { ok: true, log: ['Order Issued', label + ' (' + days + (days === 1 ? ' day' : ' days') + ': due Day ' + (s.day + days) + ').'] };
  };

  /* Issue a Hall action after its planning box (3346-3417). */
  R.issueOrderWithMeta = function (s, data, facId, fnId, optionIdx, meta, rand) {
    var fac = R.facility(data, facId);
    var fn = R.fn(fac, fnId);
    if (!fac || !fn) return { ok: false };
    var broken = repairRefusal(s, fac);
    if (broken) return broken;
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
    var max = clampInt(fn.special.maxLevel === undefined ? 3 : fn.special.maxLevel, 1, 3);
    if (cur >= max) return ['Upgrade', 'Hall of Emissaries is already max level.'];
    s.facilityLevels.hall_of_emissaries = clampInt(cur + 1, 1, 3);
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
    if (!fac) return null;
    var fn = R.fn(fac, order.fnId);
    if (!fn) return null;
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
      R.appendToWarehouse(s, optionLabel, 1, '', notes, rand);
      return [['Order Completed', label + ' → Added to Warehouse.']];
    }
    return [['Order Completed', label + ' → Completed.']];
  };

  /* How an order is completed: 'network', 'war', 'emissary', 'simple' or 'none'. */
  R.orderKind = function (data, order) {
    if (order.facId === 'trade_network') return 'network';
    if (order.facId === 'war_council' || (order.meta && order.meta.kind === 'war_action')) return 'war';
    var fac = R.facility(data, order.facId);
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
  R.canFormMerc = function (s, data) {
    var rules = data.bastion.identityRules;
    var lvlOk = (s.partyLevel || 1) >= rules.mercMinLevel;
    var defOk = (s.defenders.count || 0) >= rules.mercMinDefenders;
    return { ok: lvlOk && defOk, lvlOk: lvlOk, defOk: defOk };
  };
  R.orgLabel = function (s) {
    var o = s.organization;
    if (o.type === 'clan') return 'Clan: ' + (o.name || 'Unnamed');
    if (o.type === 'merc') return 'Brigade: ' + (o.name || 'Unnamed');
    return 'Unsworn';
  };
  R.requirementsHint = function (s, data) {
    var r = data.bastion.identityRules;
    var c = R.canFormClan(s, data);
    var m = R.canFormMerc(s, data);
    return 'Clan requirements: Level ' + r.clanMinLevel + '+ (' + (c.lvlOk ? 'OK' : 'NO') + '), Total Support ' + r.clanSupportTotalMin + '+ (' + (c.totalOk ? 'OK' : 'NO') + '), ' +
      r.clanSupportClanCountMin + ' clans at ' + r.clanSupportPerClanMin + '+ (' + (c.countOk ? 'OK' : 'NO') + ').  ' +
      'Merc requirements: Level ' + r.mercMinLevel + '+ (' + (m.lvlOk ? 'OK' : 'NO') + '), ' + r.mercMinDefenders + '+ defenders (' + (m.defOk ? 'OK' : 'NO') + ').';
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
  /* Lose n beasts one at a time, not whole rows. The beasts that march are
     the first `committed` in list order (as the War Table names them), so
     the losses come from those, the last-named first. With no `committed`,
     from the end of the list. */
  R.removeBeasts = function (s, n, committed) {
    var list = s.defenderBeasts;
    var total = R.beastQty(s);
    var upto = committed === undefined || committed === null ? total : Math.min(total, clampInt(committed, 0));
    var left = Math.min(clampInt(n, 0), upto);
    for (; left > 0; left--, upto--) {
      var idx = upto - 1, seen = 0;
      for (var i = 0; i < list.length; i++) {
        var row = list[i];
        var q = clampInt(row && row.qty !== undefined && row.qty !== null ? row.qty : 1, 0);
        if (idx < seen + q) {
          if (q - 1 <= 0) list.splice(i, 1);
          else row.qty = q - 1;
          break;
        }
        seen += q;
      }
    }
  };
  /* What can be committed: R.warAvailable and the phase 2 R.warForces are
     in war-campaign-rules.js (they leave out anything already committed or
     recovering). */
  R.warCommit = function (s, fields) {
    var a = R.warAvailable(s);
    return {
      commitDefenders: clampInt(fields.defenders === undefined ? 0 : fields.defenders, 0, a.defenders),
      commitBeasts: clampInt(fields.beasts === undefined ? 0 : fields.beasts, 0, a.beasts),
      commitLieutenants: a.fullWar ? clampInt(fields.lieutenants === undefined ? 0 : fields.lieutenants, 0, a.lieutenants) : 0,
      commitRegiments: a.fullWar ? clampInt(fields.regiments === undefined ? 0 : fields.regiments, 0, a.regiments) : 0
    };
  };
  /* The old single-roll war, kept until it's archived (the screen uses
     R.queueWarAction2). */
  R.queueWarAction = function (s, meta, rand, data) {
    var days = R.time(data).musterDays;
    var order = { id: R.uid(rand), facId: 'war_council', fnId: 'war_action', optionIdx: 0, label: 'War Action', issuedDay: s.day, dueDay: s.day + days, meta: Object.assign({}, meta, { kind: 'war_action' }) };
    s.pendingOrders.push(order);
    return ['War Action Queued', meta.objective.toUpperCase() + ' vs ' + meta.targetName + ' (musters on Day ' + (s.day + days) + ').'];
  };
  R.warPlan = function (s, data, order) {
    var meta = order.meta || {};
    var objective = String(meta.objective || 'raid');
    var targetKey = String(meta.targetKey || 'blackstone');
    var target = null;
    data.bastion.clans.forEach(function (c) { if (c.key === targetKey) target = c; });
    var targetName = target ? target.name : 'Unknown';
    var dc = data.bastion.war.dc[objective] !== undefined ? data.bastion.war.dc[objective] : 13;
    var defenders = clampInt(meta.commitDefenders || 0, 0);
    var beasts = clampInt(meta.commitBeasts || 0, 0);
    var lieutenants = clampInt(meta.commitLieutenants || 0, 0);
    var regiments = clampInt(meta.commitRegiments || 0, 0);
    var mod = Math.min(4, Math.floor(defenders / 2)) + Math.min(2, beasts) + Math.min(3, Math.floor((lieutenants + regiments) / 2));
    return {
      objective: objective, targetKey: targetKey, targetName: targetName, dc: dc, mod: mod,
      defenders: defenders, beasts: beasts, lieutenants: lieutenants, regiments: regiments,
      title: 'War Action: ' + objective.toUpperCase() + ' vs ' + targetName
    };
  };
  /* notes: extra lines for the war log (a Military Action's weather,
     morale and luck). */
  R.resolveWar = function (s, data, plan, roll, rand, now, notes) {
    var success = roll.total >= plan.dc;
    var o = data.bastion.war.outcomes[plan.objective] || { gp: [0, 0], pc: [0, 0] };
    var gpDelta = success ? o.gp[0] : o.gp[1];
    var pcDelta = success ? o.pc[0] : o.pc[1];
    var clanHonorDelta = 0;
    var isClan = s.organization.type === 'clan';
    var isMerc = s.organization.type === 'merc';
    s.treasuryGP = clampInt((s.treasuryGP || 0) + gpDelta, 0);
    R.addPoliticalCapital(s, plan.targetName, pcDelta);
    var defLoss = Math.min(plan.defenders, Math.max(1, Math.floor(plan.defenders / 3)));
    if (!success) {
      s.defenders.count = Math.max(0, (s.defenders.count || 0) - defLoss);
      /* One beast is lost, not a whole row of them (BAS-25). */
      var beastLoss = Math.min(plan.beasts, plan.beasts > 0 ? 1 : 0);
      if (beastLoss > 0) R.removeBeasts(s, beastLoss, plan.beasts);
    }
    if (isClan) {
      clanHonorDelta = success ? 6 : -8;
      s.clanHonor = clampInt((s.clanHonor === undefined || s.clanHonor === null ? 40 : s.clanHonor) + clanHonorDelta, 0, 100);
    }
    if (isMerc) {
      var tcDelta = success ? -8 : -4;
      s.trustedClientsByClan[plan.targetKey] = clampInt((s.trustedClientsByClan[plan.targetKey] === undefined ? 50 : s.trustedClientsByClan[plan.targetKey]) + tcDelta, 0, 100);
      data.bastion.clans.forEach(function (c) {
        if (c.key === plan.targetKey) return;
        s.trustedClientsByClan[c.key] = clampInt((s.trustedClientsByClan[c.key] === undefined ? 50 : s.trustedClientsByClan[c.key]) + (success ? 1 : -1), 0, 100);
      });
    }
    var title = (success ? 'Success' : 'Failure') + ': ' + plan.objective.toUpperCase() + ' vs ' + plan.targetName;
    var details = 'Roll: d20 ' + roll.d20 + ' + mod ' + plan.mod + ' = ' + roll.total + ' vs DC ' + plan.dc + '\n' +
      'Treasury: ' + (gpDelta >= 0 ? '+' : '') + gpDelta + ' gp\n' +
      'Political Capital (' + plan.targetName + '): ' + (pcDelta >= 0 ? '+' : '') + pcDelta + '\n' +
      (isClan ? 'Clan Honour: ' + (clanHonorDelta >= 0 ? '+' : '') + clanHonorDelta + '\n' : '') +
      (!success ? 'Casualties: defenders ' + defLoss + '; beasts ' + (plan.beasts > 0 ? 1 : 0) + '\n' : '') +
      (notes && notes.length ? notes.join('\n') + '\n' : '');
    s.warLog.unshift({
      id: R.uid(rand), at: now === undefined ? Date.now() : now, title: title,
      subtitle: 'Committed: ' + plan.defenders + ' defenders, ' + plan.beasts + ' beasts, ' + plan.lieutenants + ' lieutenants, ' + plan.regiments + ' regiments',
      details: details
    });
    return ['War Action Resolved', title];
  };

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

  /* ---------- Bastion events (4728-4736) ---------- */
  /* "99-00" means 99 to 100, so the Treasure event can come up (B11). */
  R.resolveEvent = function (roll, table) {
    var rows = table || [];
    for (var i = 0; i < rows.length; i++) {
      var parts = String(rows[i].range).split('-').map(function (x) { return parseInt(x, 10); });
      var min = isNaN(parts[0]) ? 1 : parts[0];
      var max = isNaN(parts[1]) ? min : parts[1];
      if (max === 0 && min > 0) max = 100;
      if (roll >= min && roll <= max) return rows[i];
    }
    return { range: '??', name: 'Unknown' };
  };
  R.rollEvent = function (s, events, rand, now) {
    var roll = R.d(100, rand);
    var ev = R.resolveEvent(roll, events.eventTable);
    var lines = events.descriptions && events.descriptions[ev.name] ? events.descriptions[ev.name] : [];
    s.lastEvent = { roll: roll, name: ev.name, lines: lines, at: now === undefined ? Date.now() : now, day: s.day };
    return { roll: roll, name: ev.name };
  };
  /* The automatic event comes every 28 days, counted from Day 1: Days 29,
     57, 85… (it was every 4th Bastion turn). */
  R.isEventDay = function (data, day) {
    var e = R.time(data).eventEvery;
    return day > 1 && (day - 1) % e === 0;
  };
  R.nextEventDay = function (data, day) {
    var e = R.time(data).eventEvery;
    var n = day < 1 ? 1 + e : day + (e - ((day - 1) % e));
    return n;
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
     5. R.finishDay: the automatic event on its day, then what happened goes
        into "The Ironbow sends word…" (state.word).
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
  /* The day's last step: the automatic event on its day (once), then the
     day's news is kept for "The Ironbow sends word…". */
  R.finishDay = function (s, data, events, rand, now) {
    var dip = s.dayInProgress;
    if (R.isEventDay(data, s.day) && s.lastEventDay !== s.day) {
      var ev = R.rollEvent(s, events, rand, now);
      s.lastEventDay = s.day;
      R.log(s, 'Bastion Event', 'Auto event (Day ' + s.day + ') → Rolled ' + ev.roll + ' → ' + ev.name, now);
      R.addWord(s, 'Bastion event: ' + ev.name + ' (rolled ' + ev.roll + ').');
    }
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
    mv(s, 'lastEventDay');
    if (isObj(s.defenders)) mv(s.defenders, 'patrolUntil');
    (s.pendingOrders || []).forEach(function (o) { mv(o, 'issuedDay'); mv(o, 'dueDay'); if (o.meta && isObj(o.meta.declared)) mv(o.meta.declared, 'day'); });
    (s.builtExtras || []).forEach(function (e) { if (isObj(e)) { mv(e, 'startDay'); mv(e, 'readyDay'); } });
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
    extras(s).forEach(function (e) {
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
}());
