/* The Ironbow Bastion Manager: the creatures (pull request 7 of the
   facilities overhaul; Harry's answers, 14 October 2026; reworked for the
   Beast Pen in the Strip Back Overhaul, 22 October 2026). Plain functions
   (no screen code), tested on tests/rules.html. They add to the Bastion's
   rules (tools/bastion/rules.js), as courier-rules.js does.

   How a creature comes to the Ironbow: the DM grants one in the Explorer
   (a wyvern, griffin, dire wolf, buckbear or fellcat); the link carries it
   (shared/js/bridge-rules.js, a 'creature' message) and the Bastion holds it
   once, 'waiting' for a home (R.addCreatureGrant, from R.applyInbox, with its
   receipt in the same change). The Beast Pen's House Beast Here order (3
   days, no gold) houses the waiting creature the DM picks: the order keeps
   its id (as Register Port Charter keeps its Charter), and when it completes
   the creature is 'housed' there, once. Nothing makes an animal by itself
   (Elara's wyvern too: an old save that has her keeps her).

   Room: the Pen keeps ONE beast of each kind (creatures-data.js "pen"). A kind
   is full when one is housed or being housed; a creature of a full kind waits
   for a home. The limit only blocks NEW housing: beasts already housed (an
   older save with two griffins) all stay, and nothing is ever sent away.

   Acclimatise With Beast (R.acclimatise): a housed beast at Bond 0 is rolled
   for at the table. The handler rolls Animal Handling, the DM types the total,
   and a total of the DC (20) or more passes: Bond 1, and the Bastion rolls the
   beast's first meeting for the Beast Handler once. A fail locks that beast, and
   only it, for 3 days. Until then nothing else about bonding works.

   Out on the road (R.takeOut, R.returnToPit): an acclimatised beast with a
   handler can be taken out of the Pen ("Away from the Ironbow"). Each day that
   passes while it is away is one Bonding Day (R.tickBonding, called by R.startDay
   exactly once for each day). Bonding Days are totals (creatures-data.js
   bondTotals): 10 days make Bond 2 ready, 20 Bond 3, 30 Bond 4, 50 Bond 5. A
   ready level waits for the DM, who runs a scene and confirms it (R.confirmBond):
   exactly ONE level at a time, and the days keep counting while it waits.

   The record and its cleaner are in rules.js (R.cleanCreatures,
   R.cleanDevelopment), which is always loaded. The data is
   data/creatures-data.js (data.creatures).

   Demolish: the Pen can't be demolished while any beast is housed. Under Repair:
   House orders wait, as every order does. Cancel gives nothing back (nothing was
   paid or held): a granted creature keeps waiting.

   The war game (the War Table, in which every housed creature defended the
   Ironbow when it was attacked) was removed on 22 October 2026 (the Strip
   Back Overhaul, step S06), and so were the creatures' war profiles. */
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
  /* ---------- The Beast Pen's numbers (creatures-data.js) ---------- */
  /* The Beast Pen's id in facilities-data.js. */
  R.PEN_ID = 'beast_pen';
  /* How many beasts of each kind the Pen keeps (1). */
  R.penPerKind = function (data) {
    var p = cdata(data).pen;
    return isObj(p) && isNum(p.perKind) ? clampInt(p.perKind, 1, 20) : 1;
  };
  /* { dc, skill, retryDays } for Acclimatise With Beast; a kind's own DC (species.<kind>.acclimatiseDC) wins. */
  R.acclimatiseData = function (data, species) {
    var a = isObj(cdata(data).acclimatise) ? cdata(data).acclimatise : {};
    var sp = species ? R.creatureSpecies(data, species) : null;
    var dc = sp && isNum(sp.acclimatiseDC) ? sp.acclimatiseDC : a.dc;
    return {
      dc: isNum(dc) ? clampInt(dc, 1, 60) : 20,
      skill: txt(a.skill, 40) || 'Animal Handling',
      retryDays: isNum(a.retryDays) ? clampInt(a.retryDays, 1, 100) : 3
    };
  };
  R.acclimatiseDC = function (data, species) { return R.acclimatiseData(data, species).dc; };
  /* The Bonding Days a level needs in all (Bond 2: 10, 3: 20, 4: 30, 5: 50); 0 for Bond 1 or less, null above 5. */
  R.bondTotal = function (data, level) {
    var n = clampInt(level, 0, 99);
    if (n > 5) return null;
    if (n <= 1) return 0;
    var t = cdata(data).bondTotals;
    var v = isObj(t) ? t[n] : undefined;
    var def = { 2: 10, 3: 20, 4: 30, 5: 50 }[n];
    return isNum(v) ? clampInt(v, 1, 100000) : def;
  };

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
  /* The House order waiting at a building, or null (the Pen can have one for each kind at once). */
  R.houseOrderAt = function (s, facId) {
    return (arr(s.pendingOrders) || []).filter(function (o) { return isHouseOrder(o) && o.facId === facId; })[0] || null;
  };
  /* The kind of creature a House order is for ('' if it can't be told): the creature's own, or the story creature's. */
  function orderKind(s, data, o) {
    var id = isObj(o) && isObj(o.chosen) ? o.chosen.creatureId : '';
    var c = id ? R.creatureById(s, id) : null;
    if (c) return c.species;
    var u = id ? R.creatureUnique(data, id) : null;
    return u && typeof u.species === 'string' ? u.species : '';
  }
  /* The House order waiting for a beast of this kind, or null (one at a time for each kind). */
  R.houseOrderForKind = function (s, data, species) {
    return (arr(s.pendingOrders) || []).filter(function (o) { return isHouseOrder(o) && orderKind(s, data, o) === species; })[0] || null;
  };
  /* Granted creatures waiting for a home, and not being housed: the House order's list. species: one kind, or '*' / nothing for all. */
  R.waitingCreatures = function (s, data, species) {
    return R.creatures(s).filter(function (c) {
      return isObj(c) && c.status === 'waiting' && (!species || species === '*' || c.species === species) && !R.houseOrderFor(s, c.id);
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
    var line = before === after ? before + ' keeps its name.' : before + ' is now called ' + after + '.';
    if (before !== after) R.log(s, 'Creatures', line, now);
    return { ok: true, changed: before !== after, name: after, log: ['Creatures', line] };
  };
  /* The creatures housed at a building (kept when it's demolished). */
  R.housedAt = function (s, facId) {
    return R.creatures(s).filter(function (c) { return isObj(c) && c.status === 'housed' && c.home === facId; });
  };
  /* Every housed creature: they all live at the Beast Pen (an older save's creature with another home id is still one of them). */
  R.penHoused = function (s) {
    return R.creatures(s).filter(function (c) { return isObj(c) && c.status === 'housed'; });
  };
  /* Does the Beast Pen stand (built, not only being built)? */
  R.penStands = function (s, data) { return R.builtFacilityIds(s, data).indexOf(R.PEN_ID) !== -1; };
  /* House Beast Here's list: the beasts waiting for a home and not being housed. A named one shows its kind ("Swiftwing (Griffin)"). */
  R.housingOptions = function (s, data, species) {
    return R.waitingCreatures(s, data, species).map(function (c) {
      var name = R.creatureName(data, c);
      return { label: c.name ? name + ' (' + R.speciesName(data, c.species) + ')' : name, creatureId: c.id };
    });
  };
  /* Room in the Pen for one kind: { species, perKind, housed, pending, free, over }. housed: the creatures of this kind
     housed; pending: the House orders for this kind. free is never below 0; over: more of this kind are housed than the
     Pen keeps (an older save: they all stay, and housing another waits). */
  R.penRoom = function (s, data, species) {
    var per = R.penPerKind(data);
    var housed = R.penHoused(s).filter(function (c) { return c.species === species; });
    var pending = (arr(s.pendingOrders) || []).filter(function (o) { return isHouseOrder(o) && orderKind(s, data, o) === species; });
    return { species: species, perKind: per, housed: housed, pending: pending, free: Math.max(0, per - housed.length - pending.length), over: Math.max(0, housed.length - per) };
  };
  /* Why this creature can't be housed now, or '' ("The Beast Pen keeps one griffin at a time: Swiftwing lives here."). */
  function roomBlocker(s, data, c) {
    var room = R.penRoom(s, data, c.species);
    if (room.free > 0) return '';
    var noun = R.speciesNoun(data, c.species);
    var holder = room.housed[0] ? R.creatureName(data, room.housed[0]) + ' lives here' : 'one is being housed (ready on ' + R.dayLabel(room.pending[0] && room.pending[0].dueDay) + ')';
    return 'The Beast Pen keeps ' + (room.perKind === 1 ? 'one ' + noun + ' at a time' : plural(room.perKind, noun, R.speciesNounPlural(data, c.species)) + ' at a time') + ': ' + holder + '.';
  }
  /* Why a House order can't be given now, or ''. creatureId: the beast chosen in the list; left out, the order as a whole
     (can ANY waiting beast be housed?). Under Repair, the party's level and the order's own level are checked by R.issueOrder. */
  R.housingBlocker = function (s, data, fac, fn, creatureId) {
    if (!fac || !fn) return 'There\'s no such order.';
    if (R.builtFacilityIds(s, data).indexOf(fac.id) === -1) return 'The ' + fac.name + ' isn\'t built yet.';
    if (fn.housesCreature) {
      /* An order kept from before the Strip Back Overhaul (Elara's wyvern): never offered for a new one. */
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
    if (species !== '*' && !R.creatureSpecies(data, species)) return 'This copy of the Bastion doesn\'t know that kind of creature.';
    if (creatureId === undefined) {
      var list = R.waitingCreatures(s, data, species);
      if (!list.length) return species === '*' ? 'No beast is waiting for a home. The DM grants one in the Explorer.' : 'No ' + R.speciesNoun(data, species) + ' is waiting for a home. The DM grants one in the Explorer.';
      var first = '';
      for (var i = 0; i < list.length; i++) { first = roomBlocker(s, data, list[i]); if (!first) return ''; }
      return first;
    }
    var c = R.creatureById(s, creatureId);
    if (!c) return 'That beast isn\'t at the Ironbow any more.';
    var cname = R.creatureName(data, c);
    if (c.status === 'housed') return cname + ' already lives at the ' + fac.name + '.';
    var pending = R.houseOrderFor(s, c.id);
    if (pending) return cname + ' is already being housed: ready on ' + R.dayLabel(pending.dueDay) + '.';
    if (species !== '*' && c.species !== species) return cname + ' isn\'t a ' + R.speciesNoun(data, species) + '.';
    return roomBlocker(s, data, c);
  };

  /* A House order completing: its creature is housed, once. Returns a log
     line [title, body]. The Pen's room is checked again now: an order given
     under the old rules (up to three side by side, a room for each level) never
     overfills the Pen, and the beast keeps waiting. */
  R.completeHousing = function (s, data, order) {
    var fac = R.facility(data, order.facId);
    var fn = R.fn(fac, order.fnId);
    var lab = order.label || (fac ? fac.name : 'House') + ': ' + (fn ? fn.label : 'House');
    if (!fac || !fn) return ['Creatures', lab + ': nothing changed.'];
    var id = isObj(order.chosen) && typeof order.chosen.creatureId === 'string' && order.chosen.creatureId ? order.chosen.creatureId : (fn.housesCreature ? String(fn.housesCreature) : '');
    var have0 = id ? R.creatureById(s, id) : null;
    /* A creature that already exists in the story and was not recorded yet (Elara's wyvern, ordered before the change): recorded once. */
    if (id && !have0 && R.creatureUnique(data, id)) {
      var u = R.creatureUnique(data, id);
      var w = { id: id, species: txt(u.species, 40), owner: txt(u.owner, 40), name: '', status: 'housed', home: fac.id, grantedDay: s.day, housedDay: s.day, msgId: '' };
      var uroom = R.penRoom(s, data, w.species);
      /* The order itself is pending, so it counts as the one place for this kind: only already-housed beasts can fill it. */
      if (uroom.housed.length >= uroom.perKind) return ['Creatures', lab + ': the Beast Pen keeps one ' + R.speciesNoun(data, w.species) + ' and ' + R.creatureName(data, uroom.housed[0]) + ' lives here, so nothing changed.'];
      if (id === 'elara_wyvern') w.development = R.newDevelopment(w, s.day);
      R.creatures(s).push(w);
      var owner = R.creatureOwnerName(data, w);
      return ['Order Completed', lab + ' → ' + R.creatureName(data, w) + ' lives at the Ironbow now, at the ' + fac.name + (owner ? ' (' + owner + '\'s)' : '') + '.'];
    }
    var c = have0;
    var noun = R.speciesNoun(data, fn.housesSpecies === '*' ? (c ? c.species : '') : fn.housesSpecies);
    if (!c) return ['Creatures', lab + ': that beast isn\'t held any more, so nothing changed.'];
    var name = R.creatureName(data, c);
    if (c.status === 'housed') return ['Creatures', lab + ': ' + name + ' already has a home' + (c.home ? ' at the ' + facName(data, c.home) : '') + ', so nothing changed.'];
    if (fn.housesSpecies && fn.housesSpecies !== '*' && c.species !== fn.housesSpecies) return ['Creatures', lab + ': ' + name + ' isn\'t a ' + noun + ', so nothing changed.'];
    /* Room, counting only the housed beasts (this order is the pending one). */
    var room = R.penRoom(s, data, c.species);
    if (room.housed.length >= room.perKind) {
      return ['Creatures', lab + ': the Beast Pen keeps ' + (room.perKind === 1 ? 'one ' + R.speciesNoun(data, c.species) : plural(room.perKind, R.speciesNoun(data, c.species), R.speciesNounPlural(data, c.species))) + ' and ' + R.creatureName(data, room.housed[0]) + ' lives here, so ' + name + ' keeps waiting for a home.'];
    }
    c.status = 'housed';
    c.home = fac.id;
    c.housedDay = s.day;
    return ['Order Completed', lab + ' → ' + name + ' has a home at the ' + fac.name + '. Acclimatise it with its handler (Acclimatise With Beast) before it can go out on the road.'];
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

  /* ---------- Bonding: the record, the Chronicle and the DM's actions ----------
     A beast's bond (0 to 5), handler and Chronicle are kept in its "development" (rules.js). Bond 1 comes from the
     Beast Pen's acclimatisation roll; Bond 2 to 5 come from Bonding Days (days out on the road with its handler), and
     the DM confirms each after a scene at the table. The Chronicle is the beast's dated record: grants, acclimatising,
     going out and coming back, bond confirmations, handler changes and the DM's own notes. */
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
  R.addChronicle = function (s, c, cat, text, by, link, dmOnly) {
    var d = R.ensureDev(s, c);
    d.seq = clampInt(d.seq, 0, 1000000) + 1;
    var e = { id: 'ch-' + d.seq, day: dayNum(s.day, 1), cat: txt(cat, 20), text: txt(text, 400), by: txt(by || 'DM', 40), link: txt(link || '', 80) };
    if (dmOnly === true) e.private = true;
    d.chronicle.push(e);
    if (d.chronicle.length > R.CHRONICLE_MAX) d.chronicle = d.chronicle.slice(d.chronicle.length - R.CHRONICLE_MAX);
    return e;
  };
  function reasonOf(why) { return typeof why === 'string' ? why.replace(/\s+/g, ' ').trim() : ''; }
  function gone() { return { ok: false, message: 'That creature isn\'t at the Ironbow any more.' }; }

  /* ---------- Bonding Days ---------- */
  /* The Bonding Days a beast already has by being at this level: Bond 2 = 10, 3 = 20... (an older save's beast, brought
     to a level by the old programmes, counts as having them). */
  R.bondFloor = function (data, level) { var n = R.bondTotal(data, level); return n === null ? 0 : n; };
  /* A beast's Bonding Days in all, as the counter shows them: what it earned, and never fewer than its level's total. */
  R.bondingDays = function (data, c) {
    var d = devOf(c);
    var level = d ? d.bond.level : 0;
    var own = d && isObj(d.bonding) ? d.bonding.days : 0;
    return Math.max(own, R.bondFloor(data, level));
  };
  /* Is it out on the road with its handler? */
  R.isAway = function (c) { var d = devOf(c); return !!(d && isObj(d.bonding) && d.bonding.away === true && c.status === 'housed'); };
  /* Where it stands on the way to its next level (read only; nothing changes): { level, name, next, days (in all),
     since, away, ready (the level waiting for the DM, or null), pill: null (Bond 0 or 5) or { n: the pill filling,
     days (into this pill), need (this pill needs), fraction (0 to 1), full }, line }. A pill fills between the two
     totals either side of it (pill 3: 10 to 20 days); Pill 1 is full at Bond 1 (the acclimatisation roll). */
  R.bondProgress = function (s, data, c) {
    var d = R.devView(s, c);
    var level = d.bond.level;
    var days = R.bondingDays(data, c);
    var away = R.isAway(c);
    var b = devOf(c) && isObj(devOf(c).bonding) ? devOf(c).bonding : null;
    var out = { level: level, name: R.bondName(level), next: level >= 1 && level < 5 ? level + 1 : null, days: days, away: away, since: away && b ? b.awaySince : null, ready: isNum(d.bond.ready) ? d.bond.ready : null, pill: null };
    if (out.next) {
      var prev = R.bondTotal(data, level);
      var need = R.bondTotal(data, out.next);
      var span = Math.max(1, need - prev);
      var into = Math.max(0, Math.min(span, days - prev));
      out.pill = { n: out.next, days: into, need: span, fraction: into / span, full: into >= span || out.ready === out.next };
    }
    return out;
  };
  /* Make the next level ready for the DM if the Bonding Days already meet its total and none is waiting. Returns the
     level made ready, or 0 (nothing to do). */
  R.refreshBondReady = function (s, data, c) {
    var d = devOf(c);
    if (!d || c.status !== 'housed' || d.bond.level < 1 || d.bond.level >= 5 || isNum(d.bond.ready)) return 0;
    var next = d.bond.level + 1;
    if (R.bondingDays(data, c) < R.bondTotal(data, next)) return 0;
    d.bond.ready = next;
    return next;
  };
  /* A day passes (R.startDay calls this once for each new day): every beast out on the road with its handler earns one
     Bonding Day, once. The guard is lastTick, the last Explorer day credited: asked again for the same day it does
     nothing. The counter keeps counting while a milestone waits for the DM (nothing is lost); a level that has just
     become ready is said once, in the Day Log and in "The Ironbow sends word…". Returns the lines said. */
  R.tickBonding = function (s, data, now) {
    var said = [];
    R.creatures(s).forEach(function (c) {
      var d = devOf(c);
      if (!d || c.status !== 'housed') return;
      var b = isObj(d.bonding) ? d.bonding : null;
      if (b && b.away === true && d.bond.level >= 1 && !(isNum(b.lastTick) && b.lastTick >= s.day)) {
        b.lastTick = s.day;
        b.days = R.bondingDays(data, c) + 1;
      }
      var made = R.refreshBondReady(s, data, c);
      if (made) {
        var name = R.creatureName(data, c);
        var line = name + ' and ' + R.handlerName(d.handlerId) + ' have spent ' + plural(R.bondingDays(data, c), 'day', 'days') + ' together: Bond ' + made + ' (' + R.bondName(made) + ') is ready. Run a scene at the table, then confirm it in the Beast Pen.';
        R.log(s, 'Creatures', line, now);
        R.addWord(s, line);
        said.push(line);
      }
    });
    return said;
  };

  /* ---------- Acclimatise With Beast ---------- */
  /* The beasts the roll is for: housed, Bond 0, in a standing Pen. Each: { label, creatureId, blocked }, blocked being
     why it can't be rolled for now ('' when it can: needs a handler, or tries again on Day N). */
  R.acclimatiseBlocker = function (s, data, id, ctx) {
    var c = R.creatureById(s, id);
    if (!c) return 'That beast isn\'t at the Ironbow any more.';
    var name = R.creatureName(data, c);
    if (c.status !== 'housed') return name + ' has no home at the Beast Pen yet.';
    if (!R.penStands(s, data)) return 'The Beast Pen isn\'t built yet.';
    var d = devOf(c);
    if (d && d.bond.level >= 1) return name + ' is already acclimatised (Bond ' + d.bond.level + ').';
    if (!d || !d.handlerId) return name + ' has no handler yet. Assign one first.';
    var a = d && isObj(d.acclimatise) ? d.acclimatise : null;
    if (a && isNum(a.retryDay) && s.day < a.retryDay) return name + ' can try again on ' + R.dayLabel(a.retryDay) + '.';
    if (s.dayInProgress) return 'A day is being passed. Wait for it to finish.';
    if (ctx && isNum(ctx.explorerDay) && ctx.explorerDay > s.day) return 'The Bastion is catching up with the Explorer\'s day. Wait a moment.';
    return '';
  };
  R.acclimatiseOptions = function (s, data) {
    if (!R.penStands(s, data)) return [];
    return R.creatures(s).filter(function (c) {
      var d = devOf(c);
      return isObj(c) && c.status === 'housed' && !(d && d.bond.level >= 1);
    }).map(function (c) {
      var d = devOf(c);
      var a = d && isObj(d.acclimatise) ? d.acclimatise : null;
      var blocked = !d || !d.handlerId ? 'needs a handler' : a && isNum(a.retryDay) && s.day < a.retryDay ? 'tries again on ' + R.dayLabel(a.retryDay) : '';
      var name = R.creatureName(data, c);
      return { label: (c.name ? name + ' (' + R.speciesName(data, c.species) + ')' : name) + (d && d.handlerId ? ', handler ' + R.handlerName(d.handlerId) : '') + (blocked ? ': ' + blocked : ''), creatureId: c.id, blocked: blocked };
    });
  };
  /* The handler's total, as typed at the table: a whole number from 1 to 60, or null. */
  R.acclimatiseTotal = function (v) {
    var n = typeof v === 'number' ? v : (typeof v === 'string' && /^\s*\d{1,3}\s*$/.test(v) ? Number(v) : NaN);
    return isNum(n) && Math.floor(n) === n && n >= 1 && n <= 60 ? n : null;
  };
  /* The roll. ctx: { rand (for the first meeting), explorerDay }. A pass is Bond 1 at once (and the Bastion rolls the
     beast's first meeting for the Beast Handler); a fail locks that beast for the data's days (a fail on Day 10 blocks
     Days 11 and 12, and Day 13 is allowed). Returns { ok, pass, total, dc, name, handler, retryDay?, log, introduced? } or
     { ok: false, message }. Nothing changes when it is refused. */
  R.acclimatise = function (s, data, id, total, ctx) {
    var why = R.acclimatiseBlocker(s, data, id, ctx);
    if (why) return { ok: false, message: why };
    var n = R.acclimatiseTotal(total);
    if (n === null) return { ok: false, message: 'Type the handler\'s total as a whole number from 1 to 60.' };
    var c = R.creatureById(s, id);
    var name = R.creatureName(data, c);
    var d = R.ensureDev(s, c);
    var ad = R.acclimatiseData(data, c.species);
    var handler = R.handlerName(d.handlerId);
    var pass = n >= ad.dc;
    var prev = isObj(d.acclimatise) ? d.acclimatise : { tries: 0 };
    var rec = { tries: clampInt(prev.tries, 0, 100000) + 1, retryDay: null, last: { day: dayNum(s.day, 1), total: n, dc: ad.dc, pass: pass } };
    var out = { ok: true, pass: pass, total: n, dc: ad.dc, skill: ad.skill, name: name, handler: handler };
    if (pass) {
      d.acclimatise = rec;
      d.bond.level = 1;
      d.bond.ready = null;
      R.addChronicle(s, c, 'bond', 'Acclimatised with ' + handler + ' on ' + R.dayLabel(s.day) + ' (rolled ' + n + ' against DC ' + ad.dc + '). Bond 1 (' + R.bondName(1) + ').', 'DM');
      /* The first meeting is rolled now, once, so the Beast Handler has it (the daily sweep would do it later: this is the same). */
      if (R.rollInitiation) out.introduced = R.rollInitiation(s, data, c.id, ctx && typeof ctx.rand === 'function' ? ctx.rand : undefined);
      out.log = ['Creatures', name + ' and ' + handler + ' passed acclimatisation (' + ad.skill + ' ' + n + ' against DC ' + ad.dc + '): Bond 1 on ' + R.dayLabel(s.day) + '. ' + name + ' can now go out on the road with ' + handler + '.'];
      R.addWord(s, out.log[1]);
    } else {
      rec.retryDay = dayNum(s.day, 1) + ad.retryDays;
      d.acclimatise = rec;
      out.retryDay = rec.retryDay;
      R.addChronicle(s, c, 'bond', 'Acclimatisation failed on ' + R.dayLabel(s.day) + ': rolled ' + n + ' against DC ' + ad.dc + '. It can try again on ' + R.dayLabel(rec.retryDay) + '.', 'DM', '', true);
      out.log = ['Creatures', name + ' and ' + handler + ' failed acclimatisation (' + ad.skill + ' ' + n + ' against DC ' + ad.dc + '). ' + name + ' can try again on ' + R.dayLabel(rec.retryDay) + '.'];
    }
    return out;
  };

  /* ---------- Out on the road, and back ---------- */
  /* Why this beast can't go out (take) or come back (!take) now, or ''. ctx: { explorerDay }. The Bastion must be on the
     Explorer's day and not part-way through one: otherwise the days between would be counted for a trip that began
     (or ended) "now". */
  R.awayBlocker = function (s, data, id, take, ctx) {
    var c = R.creatureById(s, id);
    if (!c) return 'That beast isn\'t at the Ironbow any more.';
    var name = R.creatureName(data, c);
    var d = devOf(c);
    if (c.status !== 'housed') return name + ' has no home at the Beast Pen yet.';
    if (take) {
      if (R.isAway(c)) return name + ' is already away from the Ironbow.';
      if (!R.penStands(s, data)) return 'The Beast Pen must stand before ' + name + ' can go out.';
      if (!d || d.bond.level < 1) return name + ' must pass Acclimatise With Beast first.';
      if (!d.handlerId) return name + ' has no handler. Assign one first.';
    } else if (!R.isAway(c)) return name + ' is already at the Beast Pen.';
    if (s.dayInProgress) return 'A day is being passed. Wait for it to finish.';
    if (ctx && isNum(ctx.explorerDay) && ctx.explorerDay > s.day) return 'The Bastion is catching up with the Explorer\'s day. Wait a moment.';
    return '';
  };
  /* Take it out on the road with its handler: "Away from the Ironbow". The day it goes out is not counted; each day that
     passes after it is. Returns { ok, name, log } or { ok: false, message }. */
  R.takeOut = function (s, data, id, ctx) {
    var why = R.awayBlocker(s, data, id, true, ctx);
    if (why) return { ok: false, message: why };
    var c = R.creatureById(s, id);
    var d = R.ensureDev(s, c);
    var name = R.creatureName(data, c);
    var handler = R.handlerName(d.handlerId);
    d.bonding = { away: true, awaySince: dayNum(s.day, 1), lastTick: dayNum(s.day, 1), days: R.bondingDays(data, c) };
    R.addChronicle(s, c, 'travel', 'Taken out on the road with ' + handler + ' on ' + R.dayLabel(s.day) + '.', 'DM');
    return { ok: true, name: name, log: ['Creatures', name + ' is away from the Ironbow with ' + handler + ' (' + R.dayLabel(s.day) + '). Each day that passes now is a Bonding Day.'] };
  };
  /* Bring it back: "At the Beast Pen". Its Bonding Days stay; no more are counted until it goes out again. */
  R.returnToPit = function (s, data, id, ctx) {
    var why = R.awayBlocker(s, data, id, false, ctx);
    if (why) return { ok: false, message: why };
    var c = R.creatureById(s, id);
    var d = devOf(c);
    var name = R.creatureName(data, c);
    var since = isNum(d.bonding.awaySince) ? d.bonding.awaySince : s.day;
    var away = Math.max(0, s.day - since);
    var total = R.bondingDays(data, c);
    d.bonding = { away: false, awaySince: null, lastTick: null, days: total };
    R.addChronicle(s, c, 'travel', 'Returned to the Beast Pen on ' + R.dayLabel(s.day) + ' after ' + plural(away, 'day', 'days') + ' on the road.', 'DM');
    return { ok: true, name: name, days: away, log: ['Creatures', name + ' is back at the Beast Pen on ' + R.dayLabel(s.day) + ' after ' + plural(away, 'day', 'days') + ' on the road (' + plural(total, 'Bonding Day', 'Bonding Days') + ' in all).'] };
  };

  /* ---------- Where a beast is, in words ---------- */
  /* { kind: 'waiting' | 'housing' | 'pen' | 'away', line }. */
  R.penStatus = function (s, data, c) {
    if (!isObj(c)) return { kind: 'waiting', line: '' };
    if (c.status !== 'housed') {
      var o = R.houseOrderFor(s, c.id);
      if (o) return { kind: 'housing', line: 'Being housed at the ' + facName(data, o.facId) + ': ready on ' + R.dayLabel(o.dueDay) + '.' };
      return { kind: 'waiting', line: 'Waiting for a home at the ' + facName(data, R.speciesHome(data, c.species)) + '.' };
    }
    var d = devOf(c);
    if (R.isAway(c)) return { kind: 'away', line: 'Away from the Ironbow since ' + R.dayLabel(d.bonding.awaySince) };
    return { kind: 'pen', line: 'At the Beast Pen' + (d && d.bond.level >= 1 ? '' : '. Not acclimatised yet') };
  };
  /* The Pen's stalls, one for each kind the DM can grant: [{ species, name, housed, waiting, pending, free, over }]. */
  R.penSummary = function (s, data) {
    var kinds = R.grantableSpecies(data);
    Object.keys(isObj(cdata(data).species) ? cdata(data).species : {}).forEach(function (k) { if (kinds.indexOf(k) === -1) kinds.push(k); });
    return kinds.map(function (k) {
      var room = R.penRoom(s, data, k);
      return { species: k, name: R.speciesName(data, k), housed: room.housed, pending: room.pending, waiting: R.creatures(s).filter(function (c) { return isObj(c) && c.status === 'waiting' && c.species === k; }), free: room.free, over: room.over };
    });
  };
  /* The Demolish question's refusal, or '': the Pen stays while any beast lives in it (there is nowhere else to take them). */
  R.penDemolishBlocker = function (s, data, facId) {
    if (facId !== R.PEN_ID) return '';
    var n = R.penHoused(s).length;
    if (!n) return '';
    return 'The Beast Pen can\'t be demolished while ' + (n === 1 ? 'a beast lives' : plural(n, 'beast', 'beasts') + ' live') + ' in it: there is nowhere else for ' + (n === 1 ? 'it' : 'them') + ' to go.';
  };

  /* ----- the DM's actions ----- */
  /* Assign (or change) the handler. The first assignment keeps the bond; a change keeps the history and starts the new
     pairing at Bond 0 (it must be acclimatised with the new handler), unless the DM credits the old bond (keepBond).
     Never while the beast is away: it has to be back at the Pen first. A new pairing starts its Bonding Days again. */
  R.assignHandler = function (s, data, id, handler, reason, keepBond) {
    var c = R.creatureById(s, id);
    if (!c) return gone();
    var h = String(handler || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    var why = reasonOf(reason);
    if (!h) return { ok: false, message: 'Type the handler\'s name.' };
    var d = R.ensureDev(s, c);
    var name = R.creatureName(data, c);
    if (d.handlerId === h) return { ok: false, message: R.handlerName(h) + ' is already ' + name + '\'s handler.' };
    if (R.isAway(c)) return { ok: false, message: 'Return ' + name + ' to the Beast Pen first.' };
    if (d.handlerId) {
      if (why.length < 3) return { ok: false, message: 'Say why the handler is changing.' };
      d.handlerHistory.push({ handlerId: d.handlerId, bond: d.bond.level, fromDay: 1, toDay: s.day, reason: why });
      var was = d.bond.level;
      if (!keepBond) d.bond.level = 0;
      d.bond.ready = null;
      d.handlerId = h;
      /* A new pairing: its own Bonding Days, and its own try at acclimatising. */
      delete d.bonding;
      delete d.acclimatise;
      R.addChronicle(s, c, 'handler', 'Handler changed to ' + R.handlerName(h) + '. ' + (keepBond ? 'The DM credited the old bond (Bond ' + was + ').' : 'The new pairing starts at Bond 0 (Bond ' + was + ' kept in the history). It must be acclimatised again.') + ' Reason: ' + why, 'DM');
      return { ok: true, log: ['Creatures', name + '\'s handler is now ' + R.handlerName(h) + (keepBond ? ' (Bond ' + d.bond.level + ' credited).' : ' (Bond 0: a new pairing).')] };
    }
    d.handlerId = h;
    R.addChronicle(s, c, 'handler', R.handlerName(h) + ' assigned as handler.' + (why ? ' ' + why : ''), 'DM');
    return { ok: true, log: ['Creatures', R.handlerName(h) + ' is now ' + name + '\'s handler.'] };
  };
  R.setTemperament = function (s, data, id, fields) {
    var c = R.creatureById(s, id);
    if (!c) return gone();
    var d = R.ensureDev(s, c);
    var f = isObj(fields) ? fields : {};
    ['dominant', 'attachment', 'trigger'].forEach(function (k) { if (typeof f[k] === 'string') d.temperament[k] = f[k].replace(/\s+/g, ' ').trim().slice(0, 120); });
    /* The Regional Variety (Beast Handler, 21 October 2026): a cosmetic line of at most 60 letters; empty clears it. */
    if (typeof f.regional === 'string') {
      var rv = f.regional.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (rv) d.regional = rv; else delete d.regional;
    }
    return { ok: true, log: ['Creatures', R.creatureName(data, c) + '\'s temperament notes were updated.'] };
  };
  /* The DM confirms the ready milestone: exactly one level, with a reason. If the Bonding Days already meet the next
     level's total (they kept counting while it waited), the next level is ready at once and needs its own scene: a
     level is never skipped. */
  R.confirmBond = function (s, data, id, reason) {
    var c = R.creatureById(s, id);
    if (!c) return gone();
    var d = devOf(c);
    var name = R.creatureName(data, c);
    if (!d || !isNum(d.bond.ready) || d.bond.ready !== d.bond.level + 1) return { ok: false, message: 'No bond milestone is ready for ' + name + ': it needs more days on the road with its handler.' };
    var why = reasonOf(reason);
    if (why.length < 3) return { ok: false, message: 'Say what happened at the table (the scene that earned it).' };
    d.bond.level = d.bond.ready;
    d.bond.ready = null;
    R.addChronicle(s, c, 'bond', 'Bond ' + d.bond.level + ' (' + R.bondName(d.bond.level) + ') confirmed by the DM. ' + why, 'DM');
    var again = R.refreshBondReady(s, data, c);
    return { ok: true, level: d.bond.level, readyNext: again || null, log: ['Creatures', name + ' is now Bond ' + d.bond.level + ': ' + R.bondName(d.bond.level) + '. ' + why + (again ? ' Bond ' + again + ' (' + R.bondName(again) + ') is ready too: it needs its own scene.' : '')] };
  };
  /* A note in the Chronicle from the DM (a scene, a memory); dmOnly keeps it from the player's companion. */
  R.addChronicleNote = function (s, data, id, text, dmOnly) {
    var c = R.creatureById(s, id);
    if (!c) return gone();
    var t = reasonOf(text);
    if (t.length < 3) return { ok: false, message: 'Write the note.' };
    /* dmOnly: the player's Beast Handler companion never shows it (Harry, D6). */
    R.addChronicle(s, c, 'note', t, 'DM', '', dmOnly === true);
    return { ok: true, log: ['Creatures', 'A note was added to ' + R.creatureName(data, c) + '\'s Chronicle' + (dmOnly === true ? ' (DM only)' : '') + '.'] };
  };
  /* What comes next for a beast, in one line, for the DM. */
  R.nextStepLine = function (s, data, c) {
    var name = R.creatureName(data, c);
    var ad = R.acclimatiseData(data, c.species);
    if (c.status !== 'housed') return 'Needs a home at the ' + facName(data, R.speciesHome(data, c.species)) + ' first.';
    var d = devOf(c);
    if (!d || !d.handlerId) return 'Assign a handler, then Acclimatise With Beast.';
    if (d.bond.level < 1) {
      var a = isObj(d.acclimatise) ? d.acclimatise : null;
      if (a && isNum(a.retryDay) && s.day < a.retryDay) return 'Its last try failed. It can try again on ' + R.dayLabel(a.retryDay) + '.';
      return 'Ready to acclimatise: ' + R.handlerName(d.handlerId) + ' rolls ' + ad.skill + ' against DC ' + ad.dc + '.';
    }
    var pr = R.bondProgress(s, data, c);
    if (pr.ready) return 'Bond ' + pr.ready + ' (' + R.bondName(pr.ready) + ') is ready: confirm it after a scene at the table.';
    if (!pr.pill) return 'Bond 5 (' + R.bondName(5) + '): the highest bond.';
    var left = pr.pill.need - pr.pill.days;
    return pr.away
      ? 'Out on the road with ' + R.handlerName(d.handlerId) + ': ' + pr.pill.days + ' of ' + pr.pill.need + ' days to Bond ' + pr.pill.n + '.'
      : 'At the Beast Pen: take ' + name + ' on the road to bond (' + plural(left, 'more day', 'more days') + ' to Bond ' + pr.pill.n + ').';
  };
}());
