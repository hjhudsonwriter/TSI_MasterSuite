/* Scarlett Isles: Beast Handler — the player's view of the Bastion (BH-1a; read-only, version 2, 22 October 2026).

   Plain functions (no screen code), tested on tests/rules.html. They turn
   the Bastion's real save into a small, read-only SNAPSHOT for one handler:
   the creatures they look after, and a plain directory of the others. The
   Bastion stays the only place anything is decided; this file only reads
   it, and never changes the save it is given (it never rolls a first meeting
   either: R.sweepInitiation does that, in the Bastion).

   What a snapshot holds (version 2):
   - the directory: each standing Wyvern Roost, Griffin Tower and Dire Wolf
     Den, its level, and every creature housed there (name, kind, the
     handler's name, the bond, and whether it has been acclimatised). A
     creature that belongs to someone else is a directory line and nothing
     more.
   - the detail of the handler's OWN creatures only. A creature that has not
     passed acclimatisation (Bond 0) is "not available": its name, kind,
     building, handler and bond, and nothing else. From Bond 1 the detail is
     its profile, its Chronicle (without the DM's DM-only notes), its picture
     key and the first meeting the Bastion rolled for it (null until it has
     one).
   It never holds the treasury, the Day Log, the DM's notes, other
   buildings, or any raw part of the save, and since version 2 it holds no
   orders, training, receipts or request fingerprints: the app sends the
   Bastion nothing, so there is nothing to answer.

   Why a player may see each field is written beside it, and every one has a
   test (tests/rules/beasthandler-projection.test.js): a snapshot field is
   never added without one. A snapshot of another version is refused by
   P.check, which is how every older snapshot kept on a phone is retired. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};
  var P = ns.projection = {};

  P.KIND = 'tsi.beasthandler.snapshot';
  P.VERSION = 2;

  function R() { return TSI.bastion && TSI.bastion.rules; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function txt(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function num(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }

  /* A name that is safe to use as a key in a plain object (a save can hold any text for an id or a handler). */
  P.safeKey = function (k) { return typeof k === 'string' && k !== '' && ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty'].indexOf(k) === -1; };

  /* ---------- Who is who ---------- */
  /* The handler's name is the key today ("elara"); compared without regard to capitals or spacing. */
  P.handlerKey = function (id) { return String(id === undefined || id === null ? '' : id).replace(/\s+/g, ' ').trim().toLowerCase(); };
  P.sameHandler = function (a, b) {
    var x = P.handlerKey(a);
    return x !== '' && x === P.handlerKey(b);
  };

  /* ---------- The three buildings ---------- */
  /* [{ speciesId, speciesName, facId }] in the creatures data's order. */
  P.homes = function (data) {
    var r = R();
    var sp = r.creaturesData(data).species;
    var out = [];
    Object.keys(isObj(sp) ? sp : {}).forEach(function (id) {
      var home = r.speciesHome(data, id);
      if (home && r.facility(data, home)) out.push({ speciesId: id, speciesName: r.speciesName(data, id), facId: home });
    });
    return out;
  };

  /* The creatures standing in a built building: housed there, of its kind. */
  function housedIn(s, data, home) {
    var r = R();
    if (r.builtFacilityIds(s, data).indexOf(home.facId) === -1) return [];
    return r.housedAt(s, home.facId).filter(function (c) { return c.species === home.speciesId; });
  }

  P.housedIn = housedIn;

  function handlerOf(c) { return isObj(c.development) ? txt(c.development.handlerId, 40) : ''; }

  /* The handlers who have a creature in a standing building: [{ id, name, count }], for the DM's own preview. */
  P.handlers = function (s, data) {
    var r = R();
    var seen = new Map();
    var out = [];
    P.homes(data).forEach(function (home) {
      housedIn(s, data, home).forEach(function (c) {
        var h = handlerOf(c);
        var k = P.handlerKey(h);
        if (!k) return;
        if (!seen.has(k)) { var entry = { id: h, name: r.handlerName(h), count: 0 }; seen.set(k, entry); out.push(entry); }
        seen.get(k).count++;
      });
    });
    return out;
  };

  /* ---------- One creature ---------- */
  /* The Chronicle as a player sees it: in the order written, without the DM-only notes. The ids are numbered
     afresh (e1, e2…) so a gap can never show that a hidden note was there, and no Bastion-internal link goes out. */
  function chronicleOf(d) {
    var r = R();
    var isPrivate = r.isPrivateNote || function (e) { return !!e.private; };
    return arr(d.chronicle).filter(function (e) { return isObj(e) && !isPrivate(e); }).map(function (e, i) {
      return { id: 'e' + (i + 1), day: num(e.day, 1), dayLabel: r.dayLabel(num(e.day, 1)), cat: txt(e.cat, 20), text: txt(e.text, 400), by: txt(e.by, 40) };
    });
  }

  /* The first meeting the Bastion rolled, or null (not yet). The variety's id and the number each die showed: the
     reveal on the phone plays exactly these. The day it was made is the Bastion's business and is not sent. */
  function initiationOf(d) {
    var ini = isObj(d.initiation) ? d.initiation : null;
    if (!ini || typeof ini.regional !== 'string' || !ini.regional) return null;
    var rolls = isObj(ini.rolls) ? ini.rolls : {};
    return {
      regional: txt(ini.regional, 40),
      rolls: { dominant: num(rolls.dominant, 0), attachment: num(rolls.attachment, 0), trigger: num(rolls.trigger, 0) }
    };
  }

  function detailOf(s, data, c, home) {
    var r = R();
    var fac = r.facility(data, home.facId);
    var d = r.devView(s, c);
    var t = d.temperament;
    var level = d.bond.level;
    var detail = {
      /* A name, a kind, a building and a handler are on the directory line anyway. */
      id: c.id,
      name: txt(r.creatureName(data, c), 80),
      species: { id: home.speciesId, name: home.speciesName },
      facility: { id: fac.id, name: fac.name, level: r.getFacilityLevel(s, fac.id) },
      handler: { name: txt(r.handlerName(d.handlerId), 40) },
      /* Whether the app opens this beast at all: only after the Pit's acclimatisation (Bond 1). */
      available: level >= 1,
      bond: { level: level, name: r.bondName(level), max: 5 }
    };
    /* Bond 0: nothing more is sent. */
    if (!detail.available) return detail;
    /* Its own handler's beast, so its own profile lines. */
    detail.initiation = initiationOf(d);
    detail.profile = {
      regional: txt(d.regional, 60),
      dominant: txt(t.dominant, 120),
      attachment: txt(t.attachment, 120),
      trigger: txt(t.trigger, 120)
    };
    detail.chronicle = chronicleOf(d);
    detail.artKey = home.speciesId;
    return detail;
  }

  /* ---------- The snapshot ---------- */
  /* The snapshot for one handler (handlerId '' or unknown: the directory
     alone, with no detail). Never changes s. */
  P.build = function (s, data, handlerId) {
    var r = R();
    var key = P.handlerKey(handlerId);
    var facilities = [];
    var creatures = {};
    P.homes(data).forEach(function (home) {
      var fac = r.facility(data, home.facId);
      if (r.builtFacilityIds(s, data).indexOf(home.facId) === -1) return;
      var list = housedIn(s, data, home);
      facilities.push({
        id: fac.id,
        name: fac.name,
        level: r.getFacilityLevel(s, fac.id),
        species: { id: home.speciesId, name: home.speciesName },
        creatures: list.filter(function (c) { return P.safeKey(c.id); }).map(function (c) {
          var mine = !!key && P.sameHandler(handlerOf(c), key);
          if (mine && P.safeKey(c.id)) creatures[c.id] = detailOf(s, data, c, home);
          var d = isObj(c.development) ? c.development : null;
          return {
            id: c.id,
            name: txt(r.creatureName(data, c), 80),
            species: { id: home.speciesId, name: home.speciesName },
            handlerName: d && d.handlerId ? txt(r.handlerName(d.handlerId), 40) : '',
            bond: d ? { level: d.bond.level, name: r.bondName(d.bond.level) } : null,
            /* Whether the beast has passed acclimatisation: the directory says "Not acclimatised yet" otherwise. */
            available: !!d && d.bond.level >= 1,
            mine: mine
          };
        })
      });
    });
    var anyMine = Object.keys(creatures).length > 0;
    return {
      kind: P.KIND,
      version: P.VERSION,
      /* This Bastion save's own id: a phone only takes a snapshot made for the Bastion it was paired with (set once the Bastion has run since the Beast Handler arrived). */
      campaign: r.beastCampaignId ? r.beastCampaignId(s) : '',
      asOfDay: num(s.day, 1),
      asOfLabel: r.dayLabel(num(s.day, 1)),
      handler: key ? { id: key, name: txt(r.handlerName(handlerId), 40), hasCreatures: anyMine } : null,
      facilities: facilities,
      creatures: creatures
    };
  };

  /* Is this a snapshot this version of the companion can read? '' if so, or why not. */
  P.check = function (snap) {
    if (!isObj(snap) || snap.kind !== P.KIND) return 'That isn\'t a Beast Handler snapshot.';
    if (snap.version !== P.VERSION) return 'That snapshot is from a different version of the Beast Handler.';
    if (!Array.isArray(snap.facilities) || !isObj(snap.creatures)) return 'That snapshot is incomplete.';
    return '';
  };
}());
