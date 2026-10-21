/* The Ironbow Bastion Manager — the creatures (pull request 7 of the
   facilities overhaul; Harry's answers, 14 October 2026). Plain functions
   (no screen code), tested on tests/rules.html. They add to the Bastion's
   rules (tools/bastion/rules.js), as courier-rules.js does.

   How a creature comes to the Ironbow:
   - Elara's wyvern. The Wyvern Roost's Level 1 order, House Elara's Wyvern
     (3 days, no gold), records her existing wyvern when it completes, once
     ever ('elara_wyvern', owner 'elara'). It is never a new animal: a
     second order is refused, and completing one twice changes nothing.
   - A griffin or a dire wolf. The DM grants one in the Explorer; the link
     carries it (shared/js/bridge-rules.js, a 'creature' message) and the
     Bastion holds it once, 'waiting' for a home (R.addCreatureGrant, from
     R.applyInbox, with its receipt in the same change). The Griffin
     Tower's or Dire Wolf Den's Level 1 order (House a Griffin, House a Dire
     Wolf: 3 days, no gold) houses the waiting creature the DM picks: the
     order keeps its id (as Register Port Charter keeps its Charter), and
     when it completes the creature is 'housed' there, once.
   Room: each level of the Tower or the Den houses one creature (Harry, Q6).
   Room left = the level's room − the creatures housed there − a House order
   waiting there (one at a time). A creature with no room waits until there
   is room (an Upgrade adds it).

   The record and its cleaner are in rules.js (R.cleanCreatures), which is
   always loaded. The data is data/creatures-data.js (data.creatures).

   Demolish: a House order waiting there is cancelled, and its creature
   keeps waiting. Creatures already housed stay at the Ironbow, still
   guarding it, and keep their home: rebuilding the building is their home
   again, and adds nobody twice. A rebuilt Tower or Den starts at Level 1,
   so if more creatures live there than its room, they all stay and new
   housing waits for room.
   Under Repair: House orders wait, as every order does; the creatures
   still guard the Ironbow. Cancel gives nothing back (nothing was paid or
   held): a granted creature keeps waiting.

   On the War Table (war-campaign-rules.js) every housed creature defends
   the Ironbow when it is attacked (Defend Bastion only), one unit each
   with its own profile; it is never sent on a War Action and never killed
   or captured. None of this changes the Menagerie, R.beastQty or the War
   Council's lock. */
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
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function words(id) {
    return String(id || '').split('_').filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
  }

  /* ---------- The creatures' data, with safe defaults ---------- */
  /* data.creatures (data/creatures-data.js); the page's own copy if a
     caller's data has none (an older test or tool data object). With
     neither, no creature fights and nothing can be housed. */
  function cdata(data) {
    if (data && isObj(data.creatures)) return data.creatures;
    var g = window.TSI_DATA && window.TSI_DATA.bastionCreatures;
    return isObj(g) ? g : {};
  }
  R.creaturesData = cdata;
  R.creatureSpecies = function (data, id) {
    var sp = cdata(data).species;
    return typeof id === 'string' && isObj(sp) && isObj(sp[id]) ? sp[id] : null;
  };
  R.creatureUnique = function (data, id) {
    var u = cdata(data).unique;
    return typeof id === 'string' && isObj(u) && isObj(u[id]) ? u[id] : null;
  };
  /* 'griffin' → 'Griffin'; one this copy doesn't know → 'Unknown creature'. */
  R.speciesName = function (data, id) {
    var sp = R.creatureSpecies(data, id);
    return sp && typeof sp.name === 'string' && sp.name ? sp.name : 'Unknown creature';
  };
  /* In a sentence: 'griffin' / 'griffins', 'dire wolf' / 'dire wolves'. */
  R.speciesNoun = function (data, id) { return R.speciesName(data, id).toLowerCase(); };
  R.speciesNounPlural = function (data, id) {
    var sp = R.creatureSpecies(data, id);
    return sp && typeof sp.plural === 'string' && sp.plural ? sp.plural.toLowerCase() : R.speciesNoun(data, id) + 's';
  };
  /* The facility a kind of creature lives in ('griffin' → 'griffin_tower'), or ''. */
  R.speciesHome = function (data, id) {
    var sp = R.creatureSpecies(data, id);
    return sp && typeof sp.home === 'string' ? sp.home : '';
  };
  function facName(data, facId) {
    var f = facId ? R.facility(data, facId) : null;
    return f ? f.name : words(facId) || 'its home';
  }
  R.creatureFacilityName = facName;
  R.creatureNameMax = function (data) { var n = cdata(data).nameMax; return isNum(n) && n > 0 ? Math.floor(n) : 40; };
  /* What the DM can grant in the Explorer: ['griffin', 'dire_wolf']. */
  R.grantableSpecies = function (data) {
    return (arr(cdata(data).grantable) || []).filter(function (id) { return !!R.creatureSpecies(data, id); });
  };
  /* Room at a building: creatures housed per level (0 if it houses none by level). */
  R.creatureRoomPerLevel = function (data, facId) {
    var r = cdata(data).room;
    return isObj(r) && isNum(r[facId]) ? clampInt(r[facId], 0, 20) : 0;
  };
  /* Extra places a building has whatever its level (the Wyvern Roost: 1). */
  R.creatureRoomBase = function (data, facId) {
    var r = cdata(data).roomBase;
    return isObj(r) && isNum(r[facId]) ? clampInt(r[facId], 0, 20) : 0;
  };
  R.creaturesComingLater = function (data) { return txt(cdata(data).comingLater, 300); };

  /* ---------- The register ---------- */
  R.creatures = function (s) {
    if (!arr(s.creatures)) s.creatures = [];
    return s.creatures;
  };
  R.creatureById = function (s, id) {
    return R.creatures(s).filter(function (c) { return isObj(c) && c.id === id; })[0] || null;
  };
  /* A granted creature's id, made from its Explorer message's id: the same
     every time, and never shared ('lq3k9x-1a2b3c4d:dm:0' →
     'cr-lq3k9x-1a2b3c4d-dm-0'). */
  R.creatureIdFor = function (msgId) { return ('cr-' + String(msgId || '').replace(/[^A-Za-z0-9_-]/g, '-')).slice(0, 80); };
  /* The name the panels show: the typed name; for Elara's wyvern the data's
     name (Harry gives it later) or "Elara's wyvern"; otherwise "Griffin
     (granted Day 5)". */
  R.creatureName = function (data, c) {
    if (!isObj(c)) return 'A creature';
    if (typeof c.name === 'string' && c.name) return c.name;
    var u = R.creatureUnique(data, c.id);
    if (u && typeof u.name === 'string' && u.name) return u.name;
    if (u && typeof u.defaultName === 'string' && u.defaultName) return u.defaultName;
    return R.speciesName(data, c.species) + ' (granted ' + R.dayLabel(c.grantedDay) + ')';
  };
  /* The name in a House order's label: "House a Griffin (Swiftwing)", or
     "House a Griffin (granted Day 5)" for one with no name. */
  R.creatureOrderName = function (c) {
    if (!isObj(c)) return '';
    return typeof c.name === 'string' && c.name ? c.name : 'granted ' + R.dayLabel(c.grantedDay);
  };
  /* "Elara" for her wyvern; '' for the Ironbow's own. */
  R.creatureOwnerName = function (data, c) {
    var u = isObj(c) ? R.creatureUnique(data, c.id) : null;
    if (u && typeof u.ownerName === 'string') return u.ownerName;
    return isObj(c) && c.owner ? words(c.owner) : '';
  };

  /* ---------- House orders ---------- */
  function isHouseOrder(o) {
    return isObj(o) && isObj(o.chosen) && typeof o.chosen.creatureId === 'string' && o.chosen.creatureId &&
      !(isObj(o.meta) && (o.meta.kind === 'upgrade' || o.meta.kind === 'research'));
  }
  /* The House order waiting for this creature, or null. */
  R.houseOrderFor = function (s, creatureId) {
    return (arr(s.pendingOrders) || []).filter(function (o) { return isHouseOrder(o) && o.chosen.creatureId === creatureId; })[0] || null;
  };
  /* The House order waiting at a building (one at a time), or null. */
  R.houseOrderAt = function (s, facId) {
    return (arr(s.pendingOrders) || []).filter(function (o) { return isHouseOrder(o) && o.facId === facId; })[0] || null;
  };
  /* Granted creatures of a kind waiting for a home, and not being housed:
     the House order's list. */
  R.waitingCreatures = function (s, data, species) {
    return R.creatures(s).filter(function (c) {
      return isObj(c) && c.status === 'waiting' && (!species || c.species === species) && !R.houseOrderFor(s, c.id);
    });
  };
  /* Release a granted creature still waiting for a home (Harry, 15 October
     2026: a grant made by mistake can be undone this way). It leaves the
     register; its grant's receipt stays, so it never comes back by itself.
     A creature being housed, or housed, or Elara's wyvern, can't be. */
  R.releaseBlocker = function (s, data, c) {
    if (!isObj(c) || !R.creatureById(s, c.id)) return 'That creature isn\'t at the Ironbow any more.';
    var name = R.creatureName(data, c);
    if (c.status !== 'waiting') return name + ' lives at the Ironbow now, and stays.';
    if (R.houseOrderFor(s, c.id)) return name + ' is being housed. Cancel that order first.';
    return '';
  };
  R.releaseCreature = function (s, data, id, now) {
    var c = R.creatureById(s, id);
    var why = R.releaseBlocker(s, data, c);
    if (why) return { ok: false, message: why };
    var name = R.creatureName(data, c);
    s.creatures = R.creatures(s).filter(function (x) { return x !== c; });
    R.log(s, 'Creatures', name + ' was released: it no longer waits at the Ironbow.', now);
    return { ok: true, name: name };
  };
  /* The DM's name for a creature at the Ironbow: any of them, waiting or
     housed, and Elara's wyvern too (Harry, 18 October 2026: he doesn't know
     her wyvern's name yet). An empty name gives back the default one ("Elara's
     wyvern", or "Griffin (granted Day 5)"). A House order still waiting for
     it follows the new name. Returns { ok, changed, message?, log? }. */
  R.renameCreature = function (s, data, id, text, now) {
    var c = R.creatureById(s, id);
    if (!c) return { ok: false, message: 'That creature isn\'t at the Ironbow any more.' };
    var before = R.creatureName(data, c);
    var oldOrderName = R.creatureOrderName(c);
    c.name = String(text || '').replace(/\s+/g, ' ').trim().slice(0, R.creatureNameMax(data));
    var after = R.creatureName(data, c);
    var o = R.houseOrderFor(s, c.id);
    var fresh = R.creatureOrderName(c);
    if (o) {
      if (typeof o.label === 'string' && oldOrderName && o.label.indexOf('(' + oldOrderName + ')') !== -1) o.label = o.label.replace('(' + oldOrderName + ')', '(' + fresh + ')');
      o.optionLabel = fresh;
    }
    /* A training programme names the creature as the panels do. */
    var tr = R.trainingOrderFor ? R.trainingOrderFor(s, c.id) : null;
    if (tr) {
      if (typeof tr.label === 'string' && tr.label.indexOf('(' + before + ')') !== -1) tr.label = tr.label.replace('(' + before + ')', '(' + R.creatureName(data, c) + ')');
      tr.optionLabel = R.creatureName(data, c);
      if (isObj(tr.chosen)) tr.chosen.label = tr.optionLabel;
    }
    var line = before === after ? before + ' keeps its name.' : before + ' is now called ' + after + '.';
    if (before !== after) R.log(s, 'Creatures', line, now);
    return { ok: true, changed: before !== after, name: after, log: ['Creatures', line] };
  };
  R.housingOptions = function (s, data, species) {
    return R.waitingCreatures(s, data, species).map(function (c) { return { label: R.creatureName(data, c), creatureId: c.id }; });
  };
  /* The creatures housed at a building (kept when it's demolished). */
  R.housedAt = function (s, facId) {
    return R.creatures(s).filter(function (c) { return isObj(c) && c.status === 'housed' && c.home === facId; });
  };
  /* Room at the Griffin Tower or Dire Wolf Den: { level, perLevel,
     capacity, housed, pending, free, over }. free is never below 0; over:
     more live there than its room (a rebuilt building starts at Level 1). */
  R.creatureRoom = function (s, data, facId) {
    var per = R.creatureRoomPerLevel(data, facId);
    var level = R.getFacilityLevel(s, facId);
    var base = R.creatureRoomBase(data, facId);
    var capacity = per * level + (per > 0 ? base : 0);
    var housed = R.housedAt(s, facId).length;
    var pending = R.houseOrderAt(s, facId) ? 1 : 0;
    var out = { level: level, perLevel: per, capacity: capacity, housed: housed, pending: pending, free: Math.max(0, capacity - housed - pending), over: Math.max(0, housed - capacity) };
    if (per > 0 && base) out.base = base;
    return out;
  };
  /* Why a House order can't be given now, or ''. Under Repair, the
     party's level and the order's own level are checked by R.issueOrder. */
  R.housingBlocker = function (s, data, fac, fn) {
    if (!fac || !fn) return 'There\'s no such order.';
    if (R.builtFacilityIds(s, data).indexOf(fac.id) === -1) return 'The ' + fac.name + ' isn\'t built yet.';
    if (fn.housesCreature) {
      var id = String(fn.housesCreature);
      if (!R.creatureUnique(data, id)) return 'This copy of the Bastion doesn\'t know that creature.';
      var have = R.creatureById(s, id);
      var name = R.creatureName(data, have || { id: id });
      if (have) return name + ' already lives at the Ironbow.';
      var o = R.houseOrderFor(s, id);
      if (o) return name + ' is already being housed at the ' + facName(data, o.facId) + ': ready on ' + R.dayLabel(o.dueDay) + '.';
      return '';
    }
    var species = String(fn.housesSpecies || '');
    if (!R.creatureSpecies(data, species)) return 'This copy of the Bastion doesn\'t know that kind of creature.';
    var noun = R.speciesNoun(data, species);
    var busy = R.houseOrderAt(s, fac.id);
    if (busy) {
      var bc = R.creatureById(s, busy.chosen.creatureId);
      return 'The ' + fac.name + ' houses one ' + noun + ' at a time: ' + (bc ? R.creatureName(data, bc) : 'one') + ' is ready on ' + R.dayLabel(busy.dueDay) + '.';
    }
    if (!R.waitingCreatures(s, data, species).length) return 'No ' + noun + ' is waiting for a home. The DM grants one in the Explorer.';
    var room = R.creatureRoom(s, data, fac.id);
    if (room.free <= 0) {
      return 'No room: a Level ' + room.level + ' ' + fac.name + ' houses ' + plural(room.capacity, noun, R.speciesNounPlural(data, species)) +
        (room.level >= R.MAX_LEVEL ? ', its most.' : '; upgrade it to house more.');
    }
    return '';
  };

  /* A House order completing: its creature is housed, once. Returns a log
     line [title, body]. */
  R.completeHousing = function (s, data, order) {
    var fac = R.facility(data, order.facId);
    var fn = R.fn(fac, order.fnId);
    var lab = order.label || (fac ? fac.name : 'House') + ': ' + (fn ? fn.label : 'House');
    if (!fac || !fn) return ['Creatures', lab + ': nothing changed.'];
    if (fn.housesCreature) {
      var uid = String(fn.housesCreature);
      var have = R.creatureById(s, uid);
      if (have) return ['Creatures', lab + ': ' + R.creatureName(data, have) + ' already lives at the Ironbow, so nothing changed.'];
      var u = R.creatureUnique(data, uid);
      if (!u) return ['Creatures', lab + ': this copy of the Bastion doesn\'t know that creature, so nothing changed.'];
      var w = { id: uid, species: txt(u.species, 40), owner: txt(u.owner, 40), name: '', status: 'housed', home: fac.id, grantedDay: s.day, housedDay: s.day, msgId: '' };
      /* Her bond (Bond 1) is credited once, with its Chronicle line. */
      if (uid === 'elara_wyvern') w.development = R.newDevelopment(w, s.day);
      R.creatures(s).push(w);
      var owner = R.creatureOwnerName(data, w);
      return ['Order Completed', lab + ' → ' + R.creatureName(data, w) + ' lives at the Ironbow now, at the ' + fac.name + (owner ? ' (' + owner + '\'s)' : '') + '. It guards the Ironbow when it is attacked.'];
    }
    var id = isObj(order.chosen) ? order.chosen.creatureId : '';
    var c = id ? R.creatureById(s, id) : null;
    var noun = R.speciesNoun(data, fn.housesSpecies);
    if (!c) return ['Creatures', lab + ': that ' + noun + ' isn\'t held any more, so nothing changed.'];
    var name = R.creatureName(data, c);
    if (c.status === 'housed') return ['Creatures', lab + ': ' + name + ' already has a home' + (c.home ? ' at the ' + facName(data, c.home) : '') + ', so nothing changed.'];
    if (c.species !== fn.housesSpecies) return ['Creatures', lab + ': ' + name + ' isn\'t a ' + noun + ', so nothing changed.'];
    c.status = 'housed';
    c.home = fac.id;
    c.housedDay = s.day;
    return ['Order Completed', lab + ' → ' + name + ' has a home at the ' + fac.name + '. It guards the Ironbow when it is attacked.'];
  };

  /* ---------- Grants from the Explorer ---------- */
  /* A creature message from the Explorer (already checked by the link's
     B.check). Held once: the same message again changes nothing. Returns
     { added, creature }. */
  R.addCreatureGrant = function (s, data, m, day) {
    var id = R.creatureIdFor(m.id);
    var have = R.creatureById(s, id) || R.creatures(s).filter(function (c) { return isObj(c) && c.msgId && c.msgId === m.id; })[0];
    if (have) return { added: false, creature: have };
    var c = {
      id: id,
      species: txt(m.species, 40),
      owner: '',
      name: txt(String(typeof m.name === 'string' ? m.name : '').replace(/\s+/g, ' ').trim(), R.creatureNameMax(data)),
      status: 'waiting',
      home: '',
      grantedDay: dayNum(m.day, dayNum(day, s.day)),
      housedDay: null,
      msgId: txt(m.id, 80)
    };
    R.creatures(s).push(c);
    return { added: true, creature: c };
  };
  /* "a griffin (Swiftwing)", or "a griffin" with no name. */
  function grantWhat(data, c) {
    var noun = R.speciesNoun(data, c.species);
    return (/^[aeiou]/.test(noun) ? 'an ' : 'a ') + noun + (c.name ? ' (' + c.name + ')' : '');
  }
  /* The Day Log's line for a grant: "Creature granted (DM, Day 5): a
     griffin (Swiftwing), waiting for a home at the Griffin Tower." */
  R.creatureGrantLine = function (s, data, res, from) {
    var c = res.creature;
    var home = facName(data, R.speciesHome(data, c.species));
    return 'Creature granted (' + from + '): ' + (res.added
      ? grantWhat(data, c) + ', waiting for a home at the ' + home + '.'
      : 'the Bastion already holds ' + grantWhat(data, c) + ', so nothing changed.');
  };
  /* The notice and "The Ironbow sends word…": "From the Explorer: a griffin
     (Swiftwing) for the Ironbow, waiting for a home at the Griffin Tower." */
  R.creatureGrantNotice = function (s, data, c) {
    return 'From the Explorer: ' + grantWhat(data, c) + ' for the Ironbow, waiting for a home at the ' + facName(data, R.speciesHome(data, c.species)) + '.';
  };
  /* Clan Influence's "Changes from the Explorer" heading for a creature's
     receipt: "Creature granted: Griffin (Swiftwing)". */
  R.creatureReceiptHead = function (data, r) {
    var what = R.speciesName(data, r && r.species) + (r && r.name ? ' (' + r.name + ')' : '');
    if (r && r.r === 'applied') return 'Creature granted: ' + what + (r.held ? ' (already held)' : '');
    return (r && r.r === 'skipped' ? 'Skipped: ' : 'Refused: ') + 'creature granted, ' + what;
  };

  /* ---------- How a creature is doing ---------- */
  /* Its War Table numbers (data species.war), or null: it doesn't fight. */
  R.creatureWar = function (data, c) {
    var sp = isObj(c) ? R.creatureSpecies(data, c.species) : null;
    var w = sp && isObj(sp.war) ? sp.war : null;
    if (!w) return null;
    var keys = ['cohesion', 'attack', 'defence', 'move', 'resolve', 'bv'];
    for (var i = 0; i < keys.length; i++) if (!isNum(w[keys[i]])) return null;
    /* A discipline it has learned adds to its own numbers (Battle Value is
       left as it was). */
    var done = isObj(c.development) && isObj(c.development.training) ? c.development.training : {};
    var bonus = isObj(cdata(data).development) && isObj(cdata(data).development.trainingBonus) ? cdata(data).development.trainingBonus : {};
    var gained = Object.keys(bonus).filter(function (k) { return isObj(done[k]) && isObj(bonus[k]) && typeof bonus[k].stat === 'string' && isNum(w[bonus[k].stat]); });
    if (!gained.length) return w;
    var out = Object.assign({}, w);
    gained.forEach(function (k) { out[bonus[k].stat] = w[bonus[k].stat] + (isNum(bonus[k].amount) ? bonus[k].amount : 0); });
    out.trained = gained.map(function (k) { return String(bonus[k].label || k); });
    return out;
  };
  /* Housed creatures that can defend the Ironbow (whether or not they're
     recovering or already defending: the War Table decides that). */
  R.fightingCreatures = function (s, data) {
    return R.creatures(s).filter(function (c) { return isObj(c) && c.status === 'housed' && !!R.creatureWar(data, c); });
  };
  /* Its record in warRecovery after a battle, or null. */
  R.creatureRecovery = function (s, id) {
    return (arr(s.warRecovery) || []).filter(function (r) { return isObj(r) && r.kind === 'creature' && r.creatureId === id; })[0] || null;
  };
  /* The Defend Bastion it stands in, or null. */
  function defending(s, id) {
    return (arr(s.militaryActions) || []).filter(function (ma) {
      return isObj(ma) && isObj(ma.commit) && Array.isArray(ma.commit.creatures) && ma.commit.creatures.indexOf(id) !== -1;
    })[0] || null;
  }
  var RECOVERY_WORDS = { badly_wounded: 'Badly wounded', wounded: 'Wounded', recovered: 'Recovering', separated: 'Separated from the army' };
  /* { kind: 'waiting' | 'housing' | 'guarding' | 'defending' | 'recovering', line }. */
  R.creatureStatus = function (s, data, c) {
    if (!isObj(c)) return { kind: 'waiting', line: '' };
    if (c.status !== 'housed') {
      var home = facName(data, R.speciesHome(data, c.species));
      var o = R.houseOrderFor(s, c.id);
      if (o) return { kind: 'housing', line: 'Being housed at the ' + facName(data, o.facId) + ': ready on ' + R.dayLabel(o.dueDay) + '.' };
      return { kind: 'waiting', line: 'Waiting for a home at the ' + home + '.' };
    }
    var rec = R.creatureRecovery(s, c.id);
    if (rec) return { kind: 'recovering', line: (RECOVERY_WORDS[rec.status] || 'Recovering') + ': fit again on ' + R.dayLabel(rec.untilDay) + '.' };
    if (!R.creatureWar(data, c)) return { kind: 'guarding', line: 'Lives at the Ironbow (this copy of the Bastion doesn\'t know how it fights).' };
    if (defending(s, c.id)) return { kind: 'defending', line: 'Defending the Ironbow against an attack.' };
    var built = c.home && R.builtFacilityIds(s, data).indexOf(c.home) !== -1;
    return { kind: 'guarding', line: built || !c.home ? 'Guarding the Ironbow.' : 'Guarding the Ironbow (the ' + facName(data, c.home) + ' isn\'t standing: rebuilding it gives it a home again).' };
  };
  /* Its War Table line: "Defends the Ironbow: Battle Value 11, Flight", or ''. */
  R.creatureWarLine = function (data, c) {
    var w = R.creatureWar(data, c);
    if (!w) return '';
    var wd = R.warData ? R.warData(data) : null;
    var trait = w.trait ? (wd && wd.traits && wd.traits[w.trait] ? wd.traits[w.trait].name : words(w.trait)) : '';
    return 'Defends the Ironbow: Battle Value ' + w.bv + (trait ? ', ' + trait : '') + (w.trained && w.trained.length ? ' (trained: ' + w.trained.join(', ') + ')' : '');
  };
  /* What a building's panel lists: the creatures housed there (by their
     home), those of its kind waiting for a home, and its room. */
  R.creaturesAt = function (s, data, facId) {
    var species = Object.keys(isObj(cdata(data).species) ? cdata(data).species : {}).filter(function (k) { return R.speciesHome(data, k) === facId; });
    return {
      housed: R.housedAt(s, facId),
      waiting: R.creatures(s).filter(function (c) { return isObj(c) && c.status === 'waiting' && species.indexOf(c.species) !== -1; }),
      room: R.creatureRoomPerLevel(data, facId) > 0 ? R.creatureRoom(s, data, facId) : null
    };
  };
  /* The Demolish question's extra sentences, or ''. */
  R.creatureDemolishNote = function (s, data, facId) {
    var parts = [];
    var housed = R.housedAt(s, facId);
    var name = facName(data, facId);
    if (housed.length === 1) parts.push(R.creatureName(data, housed[0]) + ' stays at the Ironbow, still guarding it; rebuilding the ' + name + ' gives it a home again.');
    else if (housed.length > 1) parts.push('The ' + housed.length + ' creatures living here stay at the Ironbow, still guarding it; rebuilding the ' + name + ' gives them a home again.');
    var o = R.houseOrderAt(s, facId);
    if (o) {
      var c = R.creatureById(s, o.chosen.creatureId);
      parts.push((o.label || 'The House order') + ' is cancelled' + (c && c.status === 'waiting' ? ': ' + R.creatureName(data, c) + ' keeps waiting for a home.' : '.'));
    }
    return parts.join(' ');
  };

  /* ---------- Bonding and training (Wyvern Roost: Bonding, Training & Rider Mastery) ----------
     Harry's approvals of 20 October 2026. The Roost creates the chance, the
     training makes the capability, and the DM confirms the bond:
     - Each programme (an order at the Wyvern Roost, "trains") is for one
       named, housed wyvern, costs nothing, and can be done once by each
       wyvern. A wyvern has one programme at a time, and the Roost has a few
       training places (Level 1: 1, 2: 1, 3: 2, 4: 2, 5: 3); the House
       orders don't use one.
     - A bond programme finishing makes the next bond milestone READY. It
       never raises the bond: after a scene at the table the DM presses
       Confirm bond milestone, gives a reason, and the bond rises by exactly
       one level, with one Chronicle line. Nothing lowers a bond by itself.
     - A learned discipline adds to that wyvern's own Defend Bastion numbers
       (R.creatureWar); Battle Value is unchanged.
     - A wyvern that is recovering from a battle pauses its programme: each
       recovering day moves the due day on by one, so no training days are
       lost and nothing is credited while it is hurt.
     The Chronicle is the wyvern's dated record: grants, training, bond
     confirmations, handler changes and the DM's own notes. */
  function devOf(c) { return isObj(c) && isObj(c.development) ? c.development : null; }
  R.creatureDev = devOf;
  /* Its development, made (with the usual defaults) if it has none yet. */
  R.ensureDev = function (s, c) {
    if (!isObj(c)) return null;
    if (!isObj(c.development)) c.development = R.newDevelopment(c, s.day);
    return c.development;
  };
  /* What the panels read: its development, or the defaults (not stored). */
  R.devView = function (s, c) { return devOf(c) || R.newDevelopment(isObj(c) && c.id !== 'elara_wyvern' ? c : { id: '' }, s.day); };
  R.bondName = function (level) { return R.BOND_NAMES[clampInt(level, 0, 5)] || 'Unfamiliar'; };
  R.handlerName = function (id) { return id === 'elara' ? 'Elara' : String(id || ''); };
  R.addChronicle = function (s, c, cat, text, by, link) {
    var d = R.ensureDev(s, c);
    d.seq = clampInt(d.seq, 0, 1000000) + 1;
    var e = { id: 'ch-' + d.seq, day: dayNum(s.day, 1), cat: txt(cat, 20), text: txt(text, 400), by: txt(by || 'DM', 40), link: txt(link || '', 80) };
    d.chronicle.push(e);
    if (d.chronicle.length > R.CHRONICLE_MAX) d.chronicle = d.chronicle.slice(d.chronicle.length - R.CHRONICLE_MAX);
    return e;
  };

  /* ----- places ----- */
  function trainOrder(o) {
    return isObj(o) && isObj(o.chosen) && typeof o.chosen.trainCreatureId === 'string' && o.chosen.trainCreatureId &&
      !(isObj(o.meta) && (o.meta.kind === 'upgrade' || o.meta.kind === 'research'));
  }
  R.trainingOrders = function (s) { return (arr(s.pendingOrders) || []).filter(trainOrder); };
  R.trainingOrderFor = function (s, creatureId) {
    return R.trainingOrders(s).filter(function (o) { return o.chosen.trainCreatureId === creatureId; })[0] || null;
  };
  /* { cap, used, free } at a building (the Roost's level decides). */
  R.trainingPlaces = function (s, data, facId) {
    var d = isObj(cdata(data).development) && isObj(cdata(data).development.trainingPlaces) ? cdata(data).development.trainingPlaces[facId] : null;
    var level = R.getFacilityLevel(s, facId);
    var cap = isObj(d) ? clampInt(d[level] !== undefined ? d[level] : d[Math.min(5, Math.max(1, level))], 0, 20) : 0;
    var used = R.trainingOrders(s).filter(function (o) { return o.facId === facId; }).length;
    return { cap: cap, used: used, free: Math.max(0, cap - used), level: level };
  };
  R.trainingDone = function (c, key) { var d = devOf(c); return !!(d && isObj(d.training) && isObj(d.training[key])); };

  /* Whose programme an order is: its own species, else the kind that lives
     in its building (the Roost's are wyverns, the Tower's griffins, the
     Den's dire wolves). */
  R.fnSpecies = function (data, fac, fn) {
    if (isObj(fn) && typeof fn.species === 'string' && fn.species) return fn.species;
    var sp = isObj(cdata(data).species) ? cdata(data).species : {};
    return Object.keys(sp).filter(function (k) { return fac && R.speciesHome(data, k) === fac.id; })[0] || 'wyvern';
  };
  /* The word for a first mounted outing: 'flight' for the fliers, 'ride' for the wolves. */
  R.rideNoun = function (data, species) {
    var m = isObj(cdata(data).development) && isObj(cdata(data).development.rideNoun) ? cdata(data).development.rideNoun : {};
    return typeof m[species] === 'string' && m[species] ? m[species] : 'flight';
  };
  /* The building where a kind of creature is trained, and its programme with a given role (or null). */
  R.trainingFacility = function (data, species) { return R.facility(data, R.speciesHome(data, species)); };
  R.trainingFnByRole = function (data, species, role) {
    var fac = R.trainingFacility(data, species);
    return fac ? (fac.functions || []).filter(function (f) { return f.trains && f.role === role && R.fnSpecies(data, fac, f) === species; })[0] || null : null;
  };
  /* Does this kind have bonding and training (a building with programmes)? */
  R.hasDevelopment = function (data, species) {
    var fac = R.trainingFacility(data, species);
    return !!fac && (fac.functions || []).some(function (f) { return f.trains && R.fnSpecies(data, fac, f) === species; });
  };
  /* The wyverns (or griffins, or dire wolves) an order can name: every housed one of its kind (what is
     wrong with a choice is said when it is picked). */
  R.trainingOptions = function (s, data, fac, fn) {
    var kind = R.fnSpecies(data, fac, fn);
    return R.creatures(s).filter(function (c) { return isObj(c) && c.status === 'housed' && c.species === kind; })
      .map(function (c) { return { label: R.creatureName(data, c), trainCreatureId: c.id }; });
  };
  /* Why this order can't be given to this wyvern now, or '' (the most
     helpful reason first). */
  R.trainingBlocker = function (s, data, fac, fn, c) {
    if (!fac || !fn) return 'There\'s no such order.';
    if (R.builtFacilityIds(s, data).indexOf(fac.id) === -1) return 'The ' + fac.name + ' isn\'t built yet.';
    var need = clampInt(fn.requiredFacilityLevel || 1, 1, R.MAX_LEVEL);
    var level = R.getFacilityLevel(s, fac.id);
    if (level < need) return 'Needs the ' + fac.name + ' at Level ' + need + ' (it\'s Level ' + level + ').';
    var kind = R.fnSpecies(data, fac, fn);
    if (!isObj(c) || c.species !== kind) return 'Choose a ' + R.speciesNoun(data, kind) + '.';
    var name = R.creatureName(data, c);
    if (c.status !== 'housed') return name + ' isn\'t housed at the Ironbow yet.';
    if (R.trainingDone(c, fn.id)) return name + ' has already completed ' + fn.label + '.';
    var cur = R.trainingOrderFor(s, c.id);
    if (cur) return name + ' is already in a programme: ' + (cur.label || 'training') + ', ready on ' + R.dayLabel(cur.dueDay) + '.';
    var d = devOf(c) || R.devView(s, c);
    if (isNum(fn.bondTarget) || isNum(fn.needsBond)) {
      if (isNum(d.bond.ready) && d.bond.ready > 0) return name + '\'s Bond ' + d.bond.ready + ' milestone (' + R.bondName(d.bond.ready) + ') is waiting for you to confirm it. Confirm it first.';
    }
    if (isNum(fn.bondTarget) && !d.handlerId) return name + ' has no handler yet. Assign one first.';
    if (isNum(fn.needsBond) && d.bond.level < fn.needsBond) return 'Needs Bond ' + fn.needsBond + ' (' + R.bondName(fn.needsBond) + '); ' + name + ' is Bond ' + d.bond.level + ' (' + R.bondName(d.bond.level) + ').';
    if (isNum(fn.bondTarget) && d.bond.level >= fn.bondTarget) return name + ' is already Bond ' + d.bond.level + ' (' + R.bondName(d.bond.level) + ') or more.';
    if (fn.fitsHarness && d.harness && d.harness.fitted) return name + ' already has a fitted riding harness.';
    if (fn.needsHarness && !(d.harness && d.harness.fitted)) { var hf = R.trainingFnByRole(data, kind, 'harness'); return 'Needs a fitted riding harness: ' + (hf ? hf.label : 'Commission Riding Harness') + ' first.'; }
    var needT = Array.isArray(fn.needsTrained) ? fn.needsTrained : [];
    for (var ni = 0; ni < needT.length; ni++) {
      if (!R.trainingDone(c, needT[ni])) {
        var nf = (fac.functions || []).filter(function (x) { return x.id === needT[ni]; })[0];
        return 'Needs ' + (nf ? nf.label : needT[ni]) + ' first.';
      }
    }
    if (fn.needsFirstFlight && !(d.firstFlight && d.firstFlight.approved)) return 'Needs the first mounted ' + R.rideNoun(data, kind) + ' confirmed by the DM (see Riding in ' + name + '\'s profile).';
    var places = R.trainingPlaces(s, data, fac.id);
    if (places.free <= 0) return 'All ' + places.cap + ' training ' + (places.cap === 1 ? 'place is' : 'places are') + ' taken (a Level ' + places.level + ' ' + fac.name + ' has ' + places.cap + ').';
    var cost = clampInt(fn.costGP || 0, 0, 100000);
    if (cost && clampInt(s.treasuryGP, 0, 1e9) < cost) return 'Needs ' + cost + ' gp; the treasury has ' + clampInt(s.treasuryGP, 0, 1e9) + ' gp.';
    return '';
  };
  /* Issue one (R.issueOrder calls this): checks everything, then adds the
     order in one change. */
  R.issueTraining = function (s, data, fac, fn, optionIdx, rand) {
    var opts = R.trainingOptions(s, data, fac, fn);
    var pick = opts[clampInt(optionIdx, 0)] || null;
    var c = pick ? R.creatureById(s, pick.trainCreatureId) : null;
    if (!c) return { ok: false, message: R.trainingBlocker(s, data, fac, fn, null) || 'No ' + R.speciesNoun(data, R.fnSpecies(data, fac, fn)) + ' is housed here yet.' };
    var why = R.trainingBlocker(s, data, fac, fn, c);
    if (why) return { ok: false, message: why };
    var nm = R.creatureName(data, c);
    var label = fac.name + ': ' + fn.label + ' (' + nm + ')';
    var days = R.orderDays(fn);
    /* The one gold cost (the 150 gp harness) is taken now, once, with the order. */
    var cost = clampInt(fn.costGP || 0, 0, 100000);
    s.treasuryGP = clampInt(s.treasuryGP, 0, 1e9) - cost;
    s.pendingOrders.push({ id: R.uid(rand), facId: fac.id, fnId: fn.id, chosen: { label: nm, trainCreatureId: c.id }, optionLabel: nm, notes: '', label: label, costGP: cost, issuedDay: s.day, dueDay: s.day + days });
    return { ok: true, log: ['Order Issued', label + ' (' + R.daysText(days) + ': due Day ' + (s.day + days) + ')' + (cost ? '. ' + cost + ' gp from the treasury' : '') + '.'] };
  };
  /* A programme completing, once: the discipline is recorded for good; a
     bond programme makes the next milestone ready (never the bond itself). */
  R.completeTraining = function (s, data, order, fn, fac) {
    var lab = order.label || (fac ? fac.name : 'Roost') + ': ' + (fn ? fn.label : 'training');
    var c = isObj(order.chosen) ? R.creatureById(s, order.chosen.trainCreatureId) : null;
    if (!c || !fn) return ['Creatures', lab + ': that creature isn\'t held any more, so nothing changed.'];
    var name = R.creatureName(data, c);
    if (R.trainingDone(c, fn.id)) return ['Creatures', lab + ': ' + name + ' had already completed it, so nothing changed.'];
    var d = R.ensureDev(s, c);
    d.training[fn.id] = { day: dayNum(s.day, 1) };
    var line = fn.label + ' completed.';
    var bonus = isObj(cdata(data).development) && isObj(cdata(data).development.trainingBonus) ? cdata(data).development.trainingBonus[fn.id] : null;
    var tail = '';
    if (fn.fitsHarness) {
      d.harness = { fitted: true, paidGP: clampInt(order.costGP, 0, 100000), fittedDay: dayNum(s.day, 1) };
      tail += ' A bespoke riding harness is fitted (' + d.harness.paidGP + ' gp, paid once).';
    }
    if (fn.role === 'ascent') tail += ' Riding proficiency is recorded; it is not permission to mount yet.';
    if (fn.role === 'recall') tail += ' Emergency-return discipline is recorded.';
    if (fn.role === 'signals') tail += ' Recorded as a prerequisite for a future mounted-combat system; nothing new happens in battle.';
    if (isNum(fn.bondTarget) && fn.bondTarget === d.bond.level + 1) {
      d.bond.ready = fn.bondTarget;
      tail = ' The Bond ' + fn.bondTarget + ' (' + R.bondName(fn.bondTarget) + ') milestone is ready: confirm it after a scene at the table.';
    }
    if (isObj(bonus)) tail += ' It adds ' + String(bonus.label || '') + ' when the Ironbow is attacked.';
    R.addChronicle(s, c, 'training', line + tail.replace(/^ /, ' '), 'Roost', order.id);
    return ['Order Completed', lab + ' → ' + name + ': ' + line + tail];
  };
  /* Each day (the 'trade' stage, before the orders): a recovering wyvern's
     programme doesn't advance, so its due day moves on by one, once a day. */
  R.tickTraining = function (s, data) {
    var n = 0;
    R.trainingOrders(s).forEach(function (o) {
      if (R.creatureRecovery(s, o.chosen.trainCreatureId) && o.pausedOn !== s.day) {
        o.dueDay += 1;
        o.pausedOn = s.day;
        n++;
      }
    });
    return n;
  };
  /* A programme in plain words, for the profile. */
  R.trainingStatus = function (s, data, c) {
    var o = R.trainingOrderFor(s, c.id);
    if (!o) return null;
    var rec = R.creatureRecovery(s, c.id);
    return rec ? { kind: 'paused', line: 'Paused while recovering: ' + (o.label || 'training') + ' (resumes after ' + R.dayLabel(rec.untilDay) + ')' }
      : { kind: 'training', line: (o.label || 'Training') + ', ready on ' + R.dayLabel(o.dueDay) };
  };

  /* ----- the DM's actions ----- */
  function reasonOf(why) { return typeof why === 'string' ? why.replace(/\s+/g, ' ').trim() : ''; }
  /* Assign (or change) the handler. The first assignment keeps the bond; a
     change keeps the history and starts the new pairing at Bond 0, unless the
     DM credits the old bond (keepBond). Training stays with the wyvern. */
  R.assignHandler = function (s, data, id, handler, reason, keepBond) {
    var c = R.creatureById(s, id);
    if (!c) return { ok: false, message: 'That creature isn\'t at the Ironbow any more.' };
    var h = String(handler || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    var why = reasonOf(reason);
    if (!h) return { ok: false, message: 'Type the handler\'s name.' };
    var d = R.ensureDev(s, c);
    var name = R.creatureName(data, c);
    if (d.handlerId === h) return { ok: false, message: R.handlerName(h) + ' is already ' + name + '\'s handler.' };
    if (d.handlerId) {
      if (why.length < 3) return { ok: false, message: 'Say why the handler is changing.' };
      if (R.trainingOrderFor(s, c.id)) return { ok: false, message: name + ' is in a programme: let it finish or cancel it before changing the handler.' };
      d.handlerHistory.push({ handlerId: d.handlerId, bond: d.bond.level, fromDay: 1, toDay: s.day, reason: why });
      var was = d.bond.level;
      if (!keepBond) d.bond.level = 0;
      d.bond.ready = null;
      d.handlerId = h;
      if (d.firstFlight && d.firstFlight.approved) {
        d.firstFlight = { approved: false, day: null, handlerId: null };
        R.addChronicle(s, c, 'flight', 'The first flight was confirmed for the earlier pairing: the new pairing needs its own.', 'DM');
      }
      R.addChronicle(s, c, 'handler', 'Handler changed to ' + R.handlerName(h) + '. ' + (keepBond ? 'The DM credited the old bond (Bond ' + was + ').' : 'The new pairing starts at Bond 0 (Bond ' + was + ' kept in the history).') + ' Reason: ' + why, 'DM');
      return { ok: true, log: ['Creatures', name + '\'s handler is now ' + R.handlerName(h) + (keepBond ? ' (Bond ' + d.bond.level + ' credited).' : ' (Bond 0: a new pairing).')] };
    }
    d.handlerId = h;
    R.addChronicle(s, c, 'handler', R.handlerName(h) + ' assigned as handler.' + (why ? ' ' + why : ''), 'DM');
    return { ok: true, log: ['Creatures', R.handlerName(h) + ' is now ' + name + '\'s handler.'] };
  };
  R.setTemperament = function (s, data, id, fields) {
    var c = R.creatureById(s, id);
    if (!c) return { ok: false, message: 'That creature isn\'t at the Ironbow any more.' };
    var d = R.ensureDev(s, c);
    var f = isObj(fields) ? fields : {};
    ['dominant', 'attachment', 'trigger'].forEach(function (k) { if (typeof f[k] === 'string') d.temperament[k] = f[k].replace(/\s+/g, ' ').trim().slice(0, 120); });
    return { ok: true, log: ['Creatures', R.creatureName(data, c) + '\'s temperament notes were updated.'] };
  };
  /* The DM confirms the ready milestone: exactly one level, with a reason. */
  R.confirmBond = function (s, data, id, reason) {
    var c = R.creatureById(s, id);
    if (!c) return { ok: false, message: 'That creature isn\'t at the Ironbow any more.' };
    var d = devOf(c);
    var name = R.creatureName(data, c);
    if (!d || !isNum(d.bond.ready) || d.bond.ready !== d.bond.level + 1) return { ok: false, message: 'No bond milestone is ready for ' + name + ': a bond programme has to finish first.' };
    var why = reasonOf(reason);
    if (why.length < 3) return { ok: false, message: 'Say what happened at the table (the scene that earned it).' };
    d.bond.level = d.bond.ready;
    d.bond.ready = null;
    R.addChronicle(s, c, 'bond', 'Bond ' + d.bond.level + ' (' + R.bondName(d.bond.level) + ') confirmed by the DM. ' + why, 'DM');
    return { ok: true, level: d.bond.level, log: ['Creatures', name + ' is now Bond ' + d.bond.level + ': ' + R.bondName(d.bond.level) + '. ' + why] };
  };
  /* A note in the Chronicle from the DM (a scene, a memory). */
  R.addChronicleNote = function (s, data, id, text) {
    var c = R.creatureById(s, id);
    if (!c) return { ok: false, message: 'That creature isn\'t at the Ironbow any more.' };
    var t = reasonOf(text);
    if (t.length < 3) return { ok: false, message: 'Write the note.' };
    R.addChronicle(s, c, 'note', t, 'DM');
    return { ok: true, log: ['Creatures', 'A note was added to ' + R.creatureName(data, c) + '\'s Chronicle.'] };
  };
  /* What comes next for a creature, in one line, for the DM. */
  R.nextStepLine = function (s, data, c) {
    var d = R.devView(s, c);
    var sp = c.species;
    if (!R.hasDevelopment(data, sp)) return '';
    var fac = R.trainingFacility(data, sp);
    var noun = R.rideNoun(data, sp);
    if (c.status !== 'housed') return 'Needs a home at the ' + fac.name + ' first.';
    if (isNum(d.bond.ready)) return 'Bond ' + d.bond.ready + ' (' + R.bondName(d.bond.ready) + ') is ready: confirm it after a scene at the table.';
    var byRole = function (role) { return R.trainingFnByRole(data, sp, role); };
    var label = function (f) { return f ? f.label + ' (Level ' + (f.requiredFacilityLevel || 1) + ', ' + R.daysText(f.days) + (f.costGP ? ', ' + f.costGP + ' gp' : '') + ')' : ''; };
    if (d.bond.level >= 4) {
      var steps = [['harness', !(d.harness && d.harness.fitted)], ['ascent', true], ['recall', true]];
      for (var si = 0; si < steps.length; si++) {
        var f = byRole(steps[si][0]);
        var open = steps[si][0] === 'harness' ? steps[si][1] : (f && !R.trainingDone(c, f.id));
        if (f && open) return 'Bond ' + d.bond.level + ' (' + R.bondName(d.bond.level) + '). Next for riding: ' + label(f) + '.';
      }
      if (!(d.firstFlight && d.firstFlight.approved)) return 'Riding preparation is done: the first mounted ' + noun + ' waits for you (see Riding).';
      if (d.bond.level < 5) return 'Bond ' + d.bond.level + ' (' + R.bondName(d.bond.level) + '). Next: ' + label(byRole('pact')) + '.';
      return 'Bond 5 (' + R.bondName(5) + '). The Level 5 programmes are open to it.';
    }
    var next = (fac.functions || []).filter(function (f) { return f.trains && R.fnSpecies(data, fac, f) === sp && isNum(f.bondTarget) && f.bondTarget === d.bond.level + 1; })[0];
    if (!next) return '';
    if (!d.handlerId) return 'Assign a handler, then ' + next.label + ' (Level ' + (next.requiredFacilityLevel || 1) + ') prepares Bond ' + next.bondTarget + '.';
    if (R.trainingDone(c, next.id)) return 'Bond ' + next.bondTarget + ' training is done: waiting for the DM milestone.';
    return next.label + ' (Level ' + (next.requiredFacilityLevel || 1) + ', ' + R.daysText(next.days) + ') prepares Bond ' + next.bondTarget + ' (' + R.bondName(next.bondTarget) + ').';
  };

  /* ---------- First flight readiness (Wyvern Roost: Bonding, Training & Rider Mastery, phase 3) ----------
     A wyvern and its handler may be marked ready for a FIRST FLIGHT SCENE
     when every check below holds; the DM then runs the scene and confirms
     it. That is all it means: story permission for a DM-run mounted flight.
     There is no riding movement, speed, turn, feat or combat action in the
     Bastion yet, and nothing says "rideable". */
  R.firstFlightLevel = function (data) {
    var n = isObj(cdata(data).development) ? cdata(data).development.firstFlightPartyLevel : null;
    return isNum(n) ? clampInt(n, 1, 20) : 13;
  };
  /* [{ ok, text }]: each prerequisite, ticked or not, in plain words. */
  R.firstFlightChecks = function (s, data, c) {
    var d = R.devView(s, c);
    var sp = isObj(c) ? c.species : '';
    var fac = R.trainingFacility(data, sp);
    var need = R.firstFlightLevel(data);
    var harnessFn = R.trainingFnByRole(data, sp, 'harness');
    var minLevel = harnessFn ? clampInt(harnessFn.requiredFacilityLevel || 4, 1, R.MAX_LEVEL) : 4;
    var home = fac ? fac.id : '';
    var homeLevel = home && R.builtFacilityIds(s, data).indexOf(home) !== -1 ? R.getFacilityLevel(s, home) : 0;
    var housed = isObj(c) && c.status === 'housed' && c.home === home;
    var rec = isObj(c) ? R.creatureRecovery(s, c.id) : null;
    var st = isObj(c) ? R.creatureStatus(s, data, c) : { kind: '' };
    var list = [
      { ok: clampInt(s.partyLevel, 1, 20) >= need, text: 'Party level ' + need + ' or higher (it\'s ' + clampInt(s.partyLevel, 1, 20) + ')' },
      { ok: homeLevel >= minLevel && housed, text: 'Housed at a standing ' + (fac ? fac.name : 'building') + ' of Level ' + minLevel + ' or more' },
      { ok: d.bond.level >= 4 && !!d.handlerId, text: 'Bond 4 or more with a handler' },
      { ok: !!(d.harness && d.harness.fitted), text: 'A fitted riding harness' }
    ];
    ['ascent', 'recall'].forEach(function (role) {
      var f = R.trainingFnByRole(data, sp, role);
      if (f) list.push({ ok: R.trainingDone(c, f.id), text: f.label });
    });
    list.push({ ok: !rec && st.kind !== 'defending', text: 'Not wounded or defending' });
    return list;
  };
  R.firstFlightReady = function (s, data, c) { return R.firstFlightChecks(s, data, c).every(function (x) { return x.ok; }); };
  /* The Riding line: never "rideable". */
  R.ridingLine = function (s, data, c) {
    var d = R.devView(s, c);
    var noun = R.rideNoun(data, c.species);
    var Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
    if (d.firstFlight && d.firstFlight.approved) return 'Mounted ' + Noun + ' Qualified (' + R.dayLabel(d.firstFlight.day) + ', handler ' + R.handlerName(d.firstFlight.handlerId) + '): story permission for a DM-run mounted ' + noun + ' only. Riding movement and mounted combat are not part of the Bastion yet.';
    if (R.firstFlightReady(s, data, c)) return 'First ' + noun + ' ready, awaiting the DM\'s milestone.';
    return 'Not ready for a first ' + noun + ' yet.';
  };
  /* The DM confirms the first flight (or ride) scene happened. */
  R.confirmFirstFlight = function (s, data, id, reason) {
    var c = R.creatureById(s, id);
    if (!c) return { ok: false, message: 'That creature isn\'t at the Ironbow any more.' };
    var d = R.ensureDev(s, c);
    var name = R.creatureName(data, c);
    var noun = R.rideNoun(data, c.species);
    if (d.firstFlight && d.firstFlight.approved) return { ok: false, message: name + ' and ' + R.handlerName(d.firstFlight.handlerId) + ' have already ' + (noun === 'ride' ? 'ridden' : 'flown') + '.' };
    var bad = R.firstFlightChecks(s, data, c).filter(function (x) { return !x.ok; })[0];
    if (bad) return { ok: false, message: 'Not ready: ' + bad.text + '.' };
    var why = reasonOf(reason);
    if (why.length < 3) return { ok: false, message: 'Say how the first ' + noun + ' went (the scene).' };
    d.firstFlight = { approved: true, day: dayNum(s.day, 1), handlerId: d.handlerId };
    R.addChronicle(s, c, 'flight', 'First mounted ' + noun + ' confirmed by the DM with ' + R.handlerName(d.handlerId) + '. ' + why, 'DM');
    return { ok: true, log: ['Creatures', name + ' and ' + R.handlerName(d.handlerId) + ': first mounted ' + noun + ' confirmed. ' + why] };
  };
}());
