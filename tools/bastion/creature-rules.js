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
    var capacity = per * level;
    var housed = R.housedAt(s, facId).length;
    var pending = R.houseOrderAt(s, facId) ? 1 : 0;
    return { level: level, perLevel: per, capacity: capacity, housed: housed, pending: pending, free: Math.max(0, capacity - housed - pending), over: Math.max(0, housed - capacity) };
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
    return w;
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
    return 'Defends the Ironbow: Battle Value ' + w.bv + (trait ? ', ' + trait : '');
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
}());
