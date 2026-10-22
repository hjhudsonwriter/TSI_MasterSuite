/* The Scarlett Isles: D&D Tool Suite — the campaign at a glance (7 October 2026).
   Plain functions (no screen code, tested in tests/rules.html) that read the
   Explorer's and the Bastion's saves and say where the campaign stands. The
   DM doc shows them (shared/js/dmdoc.js). The Explorer uses some of them
   too, so the DM doc and the Explorer can never disagree:
   - untilText: when an Active Effect ends ("ends Day 9", "until Make Camp");
   - threadDueText and rewardLines: when a Thread's follow-up is due, and what
     resolving it gives;
   - ironbowNews: "The Ironbow sends word…", what the Bastion has coming on
     the days just reached (Harry, 8 October 2026: it replaced the weekly
     Bastion reminder). It only reads the Bastion's save: the Bastion
     itself works the days out, with their dice, when it next sees them.

   TSI.campaign.summary(explorerSave, bastionSave, regions) → everything the
   DM doc shows. Either save may be null (that tool hasn't saved yet).
   regions is TSI_DATA.regions (shared/data/regions.js). */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function str(v) { return typeof v === 'string' ? v : ''; }
  function clampInt(v, min, max, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  /* "hall_of_emissaries" → "Hall of Emissaries"; "shrine_aurush" → "Shrine of
     Aurush". The Bastion's facility names follow this rule, so the Explorer
     can name them without loading the Bastion's data. */
  /* Names the rule above can't make (the facilities overhaul, 13 October
     2026); keep them the same as tools/bastion/data/facilities-data.js. */
  var FACILITY_NAMES = {
    library_scriptorium: 'Library & Scriptorium',
    weavers_hall: 'Weavers\' Hall',
    stone_masonworks: 'Stone Quarry & Masonworks',
    timber_sawmill: 'Timber Yard & Sawmill',
    fishery_smokehouse: 'Fishery & Smokehouse'
  };
  function facilityName(id) {
    if (FACILITY_NAMES[str(id)]) return FACILITY_NAMES[str(id)];
    var words = str(id).split('_').filter(Boolean);
    if (words[0] === 'shrine' && words.length === 2) words = ['shrine', 'of', words[1]];
    return words.map(function (w) { return w === 'of' ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
  }
  /* A Bastion saved in days: v 2, v 3 (the facilities overhaul, 13 October
     2026) or v 4 (the Strip Back Overhaul, 22 October 2026). The Bastion
     converts an older save the next time it opens, so this page, the DM doc
     and the Explorer read all three: a version missed here would silently
     blank "The Ironbow sends word…" and the DM doc's orders. */
  function inDaysSave(ba) { return !!ba && (ba.v === 2 || ba.v === 3 || ba.v === 4); }
  /* The 13 facilities the Strip Back Overhaul takes out of the Bastion, and what
     becomes of their pending orders when the Bastion next opens and converts a
     save (R.migrateToV4, docs/strip-back/J-cross-cutting.md section 4.3):
       'cancel': the facility's orders end, with a refund (the Barracks, Armoury,
                 Watchtower, War Room and Menagerie);
       'move':   the facility's orders carry on somewhere else (the Library and
                 Arcane Laboratory's to the Workshop; the Shrines' blessings to the Temple;
                 the Wyvern Roost, Griffin Tower and Dire Wolf Den's House orders to
                 the Beast Pen), EXCEPT the few that end, which
                 C.cancelledByConversion names exactly.
     A version 3 save read before the Bastion opens must not forecast an order
     that will be cancelled, but must still forecast one that will only move
     (it completes on the same day). A version 4 save has been converted, so
     nothing is left out of it. KEEP THIS TABLE TRUE: each later step that
     retires or re-homes a facility changes its row here (and the rule below) in
     the same commit as its step in tools/bastion/strip-back-rules.js. */
  var RETIRED_FACILITIES = {
    barracks: 'cancel', armoury: 'cancel', watchtower: 'cancel', war_room: 'cancel', menagerie: 'cancel',
    library_scriptorium: 'move', arcane_laboratory: 'move',
    shrine_telluria: 'move', shrine_aurush: 'move', shrine_pelagos: 'move',
    wyvern_roost: 'move', griffin_tower: 'move', dire_wolf_den: 'move'
  };
  /* The Shrines' orders that carry on at the Temple (step S11, Harry, 22 October 2026): the nine blessings it gives, three
     for each god (the same ids as the Temple's blessing functions in tools/bastion/data/facilities-data.js, which the step
     shrinesToTemple in tools/bastion/strip-back-rules.js reads; a test keeps the two the same). Every other Shrine order
     ends with its cost given back: Craft, every Pray (the Temple's Pray is instant), Purification Incense, the Aquatic
     Protection Charm and Bless Bastion Foundations. */
  var SHRINE_ORDERS_THAT_CARRY_ON = {
    shrine_telluria: ['prepare_earthward_talisman', 'prepare_rootguard_salve', 'great_rite_telluria'],
    shrine_aurush: ['prepare_blessed_lantern', 'consecrate_expedition_supplies', 'great_rite_aurush'],
    shrine_pelagos: ['bless_voyage', 'bless_commercial_shipment', 'great_rite_pelagos']
  };
  /* The House orders the Beast Pen step moves (the same lists as HOUSE_FNS in tools/bastion/strip-back-rules.js). */
  var BEAST_HOUSE_ORDERS = { wyvern_roost: ['house_elara_wyvern', 'house_wyvern'], griffin_tower: ['house_griffin'], dire_wolf_den: ['house_dire_wolf'] };
  /* Will converting a version 3 Bastion CANCEL this pending order? (Not move it, not keep it.) */
  function cancelledByConversion(o) {
    if (!isObj(o) || !Object.prototype.hasOwnProperty.call(RETIRED_FACILITIES, o.facId)) return false;
    if (RETIRED_FACILITIES[o.facId] === 'cancel') return true;
    /* Whatever a place's orders do, its Upgrade orders end (the place is going; they cost no gold). */
    if (isObj(o.meta) && o.meta.kind === 'upgrade') return true;
    if (SHRINE_ORDERS_THAT_CARRY_ON[o.facId]) return SHRINE_ORDERS_THAT_CARRY_ON[o.facId].indexOf(o.fnId) === -1;
    /* A creature building: its House orders carry on at the Beast Pen (rehomeBeasts); training, riding and flight orders end. */
    if (BEAST_HOUSE_ORDERS[o.facId]) return BEAST_HOUSE_ORDERS[o.facId].indexOf(o.fnId) === -1;
    /* The Library & Scriptorium and the Arcane Laboratory: their jobs go to the Workshop's Scholar and Alchemist. */
    return false;
  }
  /* The pending orders a Bastion save will really have (see above). */
  function liveOrders(ba) {
    var list = Array.isArray(ba.pendingOrders) ? ba.pendingOrders : [];
    if (ba.v === 4) return list;
    return list.filter(function (o) { return !cancelledByConversion(o); });
  }
  var OBJECTIVES = { raid: 'Raid', skirmish: 'Skirmish', seize_outpost: 'Seize Outpost' };
  function clanTitle(name) { var n = str(name).trim(); return /^clan /i.test(n) ? n : 'Clan ' + n; }
  /* 'goldport' → 'Goldport' (shared/data/ports.js). */
  function portName(id) {
    var p = window.TSI_DATA && window.TSI_DATA.ports && window.TSI_DATA.ports[id];
    return p && str(p.label) ? p.label : str(id) || 'port';
  }
  /* 'slades_muster' → 'Slade’s Muster' (shared/data/courier-points.js). */
  function pointName(id) {
    var p = window.TSI_DATA && window.TSI_DATA.courierPoints && window.TSI_DATA.courierPoints[id];
    return p && str(p.label) ? p.label : str(id).replace(/_/g, ' ') || 'its town';
  }

  var C = TSI.campaign = {
    /* The 13 facilities the Strip Back Overhaul retires, and the fate of their orders (see above). */
    RETIRED_FACILITIES: RETIRED_FACILITIES,
    cancelledByConversion: cancelledByConversion,

    /* What the Bastion has coming, from its save: [{ day, kind, line }], in day
       order (only what can be known before the day: building finished,
       orders due, contracts and records ending, repairs and recovery over,
       sea routes needing a roll, cargo ships and Courier Exchange parcels
       due, a Clan at war's attack roll). Nothing for a
       Bastion that hasn't read the Explorer's day yet. */
    bastionComing: function (bastion) {
      var ba = isObj(bastion) ? bastion : null;
      if (!inDaysSave(ba) || ba.anchored !== true || !isNum(ba.day)) return [];
      var out = [];
      function add(day, kind, line) { if (isNum(day)) out.push({ day: Math.trunc(day), kind: kind, line: line }); }
      var repairs = isObj(ba.repairs) ? ba.repairs : {};
      /* Construction slots, then Development Plots (the Bastion's pull request 3). */
      (Array.isArray(ba.builtExtras) ? ba.builtExtras : []).concat(Array.isArray(ba.builtPlots) ? ba.builtPlots : []).forEach(function (e) {
        if (isObj(e) && e.status === 'building') add(e.readyDay, 'built', 'The ' + facilityName(e.facId) + ' is built.');
      });
      liveOrders(ba).forEach(function (o) {
        if (!isObj(o) || !isNum(o.dueDay)) return;
        var label = str(o.label) || 'An order';
        var m = isObj(o.meta) ? o.meta : {};
        var fix = isNum(repairs[o.facId]) ? repairs[o.facId] : null;
        var day = fix !== null && o.dueDay <= fix ? fix + 1 : o.dueDay;
        if (o.facId === 'war_council' || m.kind === 'war_action') {
          add(day, 'war', 'Your army is ready to march on ' + (str(m.targetName) || 'the enemy') + ' (' + (OBJECTIVES[m.objective] || 'War Action') + ').');
        } else if (o.facId === 'hall_of_emissaries' && o.fnId !== 'upgrade_hall' && o.fnId !== 'register_port_charter' && !(isObj(m) && m.kind === 'upgrade')) {
          add(day, 'roll', label + ' needs your roll.');
        } else {
          /* Every other order, the creature buildings' House orders (pull
             request 7) among them: "Griffin Tower: House a Griffin
             (Swiftwing) is complete." No roll is ever asked for. */
          add(day, 'order', label + ' is complete.');
        }
      });
      var dip = isObj(ba.diplomacy) ? ba.diplomacy : {};
      [['agreements', true], ['arbitrations', true], ['consortiums', true], ['delegations', false], ['summits', false]].forEach(function (pair) {
        (Array.isArray(dip[pair[0]]) ? dip[pair[0]] : []).forEach(function (r) {
          if (!isObj(r)) return;
          var name = pair[0] === 'summits' ? 'Inter-Clan Summit (' + (str(r.pair) || '—') + ')'
            : pair[0] === 'delegations' ? 'delegation from ' + (str(r.clan) || '—')
            : (str(r.title) || 'contract') + ' with ' + (str(r.clan) || '—');
          add(r.endDay, 'ended', 'Your ' + name + ' has ended' + (pair[1] ? ' (its last shipment arrived)' : '') + '.');
        });
      });
      Object.keys(repairs).forEach(function (id) {
        if (isNum(repairs[id])) add(repairs[id] + 1, 'repairs', 'Repairs: the ' + facilityName(id) + ' is working again.');
      });
      (Array.isArray(ba.warRecovery) ? ba.warRecovery : []).forEach(function (r) {
        if (!isObj(r)) return;
        /* A creature (the Bastion's pull request 7) goes by its own name:
           "Elara's wyvern is fit to fight again." */
        add(r.untilDay, 'recovery', r.status === 'separated' ? str(r.name) + ' has found the way back to the Bastion.'
          : r.kind === 'beast' ? 'The ' + str(r.name) + ' is fit to fight again.'
          : r.kind === 'creature' ? (str(r.name) || 'A creature') + ' is fit to fight again.' : str(r.name) + ' is fit for duty again.');
      });
      var tn = isObj(ba.tradeNetwork) ? ba.tradeNetwork : {};
      if (tn.active) {
        (Array.isArray(tn.routes) ? tn.routes : []).forEach(function (r) {
          if (!isObj(r) || r.status !== 'active' || !isNum(r.nextDay)) return;
          if (isNum(r.expiresDay) && r.nextDay > r.expiresDay) return;
          if (r.risk === 'high' || tn.highRiskRouting) add(r.nextDay, 'route', 'The sea route to ' + str(r.clan) + ' needs a roll.');
        });
      }
      /* Cargo ships (pull request 5): when each reaches its port and comes
         home, and when a standing shipment is due to sail. Never what it
         sells for: the Bastion rolls the voyage when the day comes. */
      (Array.isArray(tn.voyages) ? tn.voyages : []).forEach(function (v) {
        if (!isObj(v)) return;
        var port = portName(v.port);
        if (v.stage === 'outbound') add(v.arriveDay, 'cargo', 'Your cargo ship reaches ' + port + '.');
        add(v.returnDay, 'cargo', 'Your cargo ship is home from ' + port + '.');
      });
      (Array.isArray(tn.schedules) ? tn.schedules : []).forEach(function (sc) {
        if (isObj(sc)) add(sc.nextDay, 'cargo', 'A standing shipment to ' + portName(sc.port) + ' is due to sail, if a ship and the goods are ready.');
      });
      /* Courier Exchange parcels (pull request 6): when each is due at its
         town, and when a recalled one is due home. Only ever "due": the
         Bastion records the arrival itself when it passes the day. */
      (Array.isArray(tn.parcels) ? tn.parcels : []).forEach(function (p) {
        if (!isObj(p)) return;
        if (p.status === 'in_transit') add(p.readyDay, 'parcel', 'A parcel from the Ironbow is due at ' + pointName(p.point) + '.');
        else if (p.status === 'returning') add(p.returnDay, 'parcel', 'A recalled parcel is due back at the Ironbow.');
      });
      var wars = isObj(ba.wars) ? ba.wars : {};
      Object.keys(wars).forEach(function (k) {
        var w = wars[k];
        if (isObj(w) && isNum(w.next)) add(w.next, 'attack', clanTitle(k.charAt(0).toUpperCase() + k.slice(1)) + ' may attack: the Bastion rolls to see.');
      });
      return out.sort(function (a, b) { return a.day - b.day; });
    },

    /* "The Ironbow sends word…": what the Bastion has coming on the days
       after `fromDay`, up to and including `toDay`, grouped by day:
       [{ day, lines }]. Empty if the Bastion is ahead of fromDay (Reset
       Travel: it will move its days, not pass them) or has nothing. */
    ironbowNews: function (bastion, fromDay, toDay) {
      var ba = isObj(bastion) ? bastion : null;
      if (!ba || !isNum(fromDay) || !isNum(toDay) || toDay <= fromDay || (isNum(ba.day) && ba.day > fromDay)) return [];
      var by = {};
      var days = [];
      C.bastionComing(ba).forEach(function (x) {
        if (x.day <= fromDay || x.day > toDay) return;
        if (!by[x.day]) { by[x.day] = []; days.push(x.day); }
        by[x.day].push(x.line);
      });
      return days.sort(function (a, b) { return a - b; }).map(function (d) { return { day: d, lines: by[d] }; });
    },

    /* When an Explorer Active Effect ends, as the Explorer's Active Effects list says it. */
    untilText: function (e, today) {
      if (e.until === 'used') return 'until used';
      if (e.until === 'dm' || e.untilDay === null || e.untilDay === undefined) return 'until you remove it';
      if (e.until === 'camp' || e.until === 'night') {
        return e.untilDay - today <= 1 ? 'until Make Camp' : 'until Make Camp on Day ' + (e.untilDay - 1);
      }
      return 'ends Day ' + e.untilDay;
    },

    /* When a Thread's follow-up is due, as the Explorer's Threads list says it ('' if it has none). */
    threadDueText: function (t) {
      if (!t || !t.follow) return '';
      return t.follow.from === t.follow.to ? 'Follow-up due Day ' + t.follow.from : 'Follow-up due Days ' + t.follow.from + '–' + t.follow.to;
    },
    /* What resolving a Thread gives: its gold and its note for the DM. */
    rewardLines: function (t) {
      var lines = [];
      if (t && isObj(t.resolve)) {
        if (isNum(t.resolve.gold) && t.resolve.gold) lines.push(signed(Math.round(t.resolve.gold)) + ' gold');
        if (str(t.resolve.dm)) lines.push('DM note: ' + t.resolve.dm);
      }
      return lines;
    },

    /* The Hall's DM-tracked consequences still running (restrictions,
       privileges, favours owed, obligations, quest hooks): read straight
       from the Bastion's saved Diplomatic Records, so this page needn't load
       the Bastion's rules. A change to a score (hr, pc) is applied by the
       Bastion itself and never listed. clanKey: those naming this Clan; ''
       gives those naming no Clan. Each: its kind, the record's title, the
       text, and when it ends ("until Day 40 (6 days left)" or "no end
       day"). Pending, applied and ended ones, and expired ones, are left out. */
    TRACKED_KINDS: { restriction: 'Restriction or embargo', privilege: 'Privilege', favour: 'Favour owed', obligation: 'Unresolved obligation', hook: 'Quest hook' },
    trackedConsequences: function (bastion, clanKey, today) {
      var out = [];
      var dr = isObj(bastion) && isObj(bastion.diplomaticRecords) ? bastion.diplomaticRecords : null;
      var list = dr && Array.isArray(dr.list) ? dr.list : [];
      var now = isNum(today) ? today : (isObj(bastion) && isNum(bastion.day) ? bastion.day : 1);
      list.forEach(function (r) {
        if (!isObj(r) || r.status !== 'confirmed' || !Array.isArray(r.consequences)) return;
        r.consequences.forEach(function (c) {
          if (!isObj(c) || typeof c.kind !== 'string' || !Object.prototype.hasOwnProperty.call(C.TRACKED_KINDS, c.kind)) return;
          if (c.status === 'pending' || c.status === 'applied' || c.status === 'ended') return;
          if (isNum(c.until) && now > c.until) return;
          if ((str(c.clan) || '') !== (clanKey || '')) return;
          var left = isNum(c.until) ? c.until - now : null;
          out.push({
            kind: c.kind, label: C.TRACKED_KINDS[c.kind], title: str(r.title), text: str(c.text),
            until: isNum(c.until) ? c.until : null,
            when: left === null ? 'no end day' : 'until Day ' + c.until + ' (' + (left === 0 ? 'last day' : left + (left === 1 ? ' day left' : ' days left')) + ')'
          });
        });
      });
      out.sort(function (a, b) { return (a.until === null ? 1e9 : a.until) - (b.until === null ? 1e9 : b.until); });
      return out;
    },

    summary: function (explorer, bastion, regions) {
      var ex = isObj(explorer) ? explorer : null;
      var ba = isObj(bastion) ? bastion : null;
      var travel = ex && isObj(ex.travel) ? ex.travel : {};
      var out = { explorerSaved: !!ex, bastionSaved: !!ba };

      /* The party: the Bastion's level (7, its starting level, until it saves one), and the Explorer's heroes. */
      var level = ba ? clampInt(ba.partyLevel, 1, 20, null) : null;
      out.level = { value: level === null ? 7 : level, fromBastion: level !== null };
      /* Each hero is { id, name, effects }: the effects are filled in below,
         once the Explorer's Active Effects have been read. */
      out.heroes = ex && Array.isArray(ex.tokens)
        ? ex.tokens.filter(function (t) { return isObj(t) && str(t.name).trim(); }).map(function (t) { return { id: str(t.id), name: str(t.name).trim(), effects: [] }; })
        : [];

      /* Time: the Explorer's day (the campaign's only clock). The Bastion's
         orders: how many are pending, and which completes next; and the
         next day the Ironbow sends word, after today. A Bastion saved in
         turns (before the days overhaul) has neither to show. */
      var day = ex ? clampInt(travel.day, 1, 100000, 1) : null;
      out.day = day;
      out.daysPassed = day === null ? null : day - 1;
      var inDays = inDaysSave(ba) ? ba : null;
      if (inDays) {
        var today = day === null ? clampInt(inDays.day, 1, 100000, 1) : day;
        var orders = liveOrders(inDays).filter(function (o) { return isObj(o) && isNum(o.dueDay); })
          .slice().sort(function (a, b) { return a.dueDay - b.dueDay; });
        out.orders = {
          count: orders.length,
          next: orders.length ? { day: orders[0].dueDay, label: str(orders[0].label) || 'An order', inDays: orders[0].dueDay - today } : null,
          /* Up to five, the one completing next first. */
          list: orders.slice(0, C.ORDERS_LISTED).map(function (o) { return { day: o.dueDay, label: str(o.label) || 'An order', inDays: o.dueDay - today }; })
        };
        var coming = C.bastionComing(inDays).filter(function (x) { return x.day > today; });
        out.nextWord = coming.length ? {
          day: coming[0].day, inDays: coming[0].day - today,
          lines: coming.filter(function (x) { return x.day === coming[0].day; }).map(function (x) { return x.line; })
        } : null;
      } else {
        out.orders = null;
        out.nextWord = null;
      }

      /* Where the party is: the Explorer's Region, its Clan and god, and their standing in the Bastion. */
      var rid = ex ? (str(travel.provinceId) || 'northern_province') : null;
      var reg = rid && regions && Object.prototype.hasOwnProperty.call(regions, rid) && isObj(regions[rid]) ? regions[rid] : null;
      if (reg) {
        out.region = { id: rid, label: reg.label };
        var pc = ba && isObj(ba.politicalCapital) ? ba.politicalCapital[reg.clanKey] : 0;
        var hr = ba && isObj(ba.honourRespectByClan) ? ba.honourRespectByClan[reg.clanKey] : 0;
        var fav = ba && isObj(ba.favour) ? ba.favour[reg.god] : 0;
        out.clan = {
          name: reg.clan, chief: reg.chief,
          politicalCapital: ba ? clampInt(pc, -100, 100, 0) : null,
          honourRespect: ba ? clampInt(hr, -5, 5, 0) : null
        };
        out.clanTracked = ba ? C.trackedConsequences(ba, reg.clanKey, day) : [];
        out.god = { key: reg.god, name: reg.godName, favour: ba ? clampInt(fav, 0, 100, 0) : null };
      } else {
        out.region = null;
        out.clan = null;
        out.god = null;
      }

      /* Agreements that name no Clan, wherever the party is. */
      out.trackedAnywhere = ba ? C.trackedConsequences(ba, '', day) : [];

      /* The party's event gold: a running total in the Explorer until the DM clears it. */
      var journey = ex && isObj(ex.journey) ? ex.journey : {};
      out.gold = ex ? (isNum(journey.gold) ? Math.round(journey.gold) : 0) : null;

      /* The Explorer's Threads, as its own list shows them, with what resolving each gives;
         and the soonest follow-up still to come. */
      var threads = Array.isArray(journey.threads) ? journey.threads : [];
      out.threads = [];
      out.nextFollowUp = null;
      threads.forEach(function (t) {
        if (!isObj(t) || !str(t.name)) return;
        var follow = isObj(t.follow) && isNum(t.follow.from) && isNum(t.follow.to) ? { from: t.follow.from, to: t.follow.to } : null;
        var due = follow ? C.threadDueText({ follow: follow }) : '';
        out.threads.push({
          id: str(t.id), name: t.name, note: str(t.note), day: isNum(t.day) ? t.day : null, from: str(t.from),
          due: due, reward: C.rewardLines(t)
        });
        if (follow && (!out.nextFollowUp || follow.to < out.nextFollowUp.to || (follow.to === out.nextFollowUp.to && follow.from < out.nextFollowUp.from))) {
          out.nextFollowUp = { name: t.name, from: follow.from, to: follow.to, text: due };
        }
      });

      /* The Explorer's Active Effects, exactly as its own list shows them. */
      var effects = Array.isArray(journey.effects) ? journey.effects : [];
      /* Looked up by an id taken from a save, so no name like "constructor" or "__proto__" can find anything but a hero. */
      var heroById = Object.create(null);
      out.heroes.forEach(function (h) { if (h.id) heroById[h.id] = h; });
      out.effects = [];
      out.partyEffects = [];
      effects.filter(function (e) { return isObj(e) && str(e.name); }).forEach(function (e) {
        var line = {
          id: str(e.id), name: e.name, who: str(e.whoName) || 'The party', text: str(e.text),
          until: C.untilText(e, day === null ? 1 : day), from: str(e.from)
        };
        out.effects.push(line);
        /* An effect belongs to a hero by the hero's id (so a later rename can't
           orphan it). One for the whole party, or for a hero who is no longer
           in the Explorer's list, goes with the party's, so none is hidden. */
        var hero = typeof e.who === 'string' && e.who ? heroById[e.who] : null;
        (hero ? hero.effects : out.partyEffects).push(line);
      });

      /* The Great Rite the party holds (not one of the Active Effects: it
         ends with the expedition). */
      var blessing = isObj(journey.blessing) && str(journey.blessing.rite) ? journey.blessing : null;
      var rites = window.TSI_DATA && window.TSI_DATA.shrineRites;
      var riteInfo = blessing && rites && Object.prototype.hasOwnProperty.call(rites, blessing.rite) ? rites[blessing.rite] : null;
      out.rite = blessing ? { name: riteInfo && str(riteInfo.name) ? riteInfo.name : 'A Great Rite', used: blessing.used === true } : null;

      /* The expedition: none yet, under way (and for how many days), or ended
         (and which days it ran). Days count as the Explorer's "days passed"
         does: today minus the start day. An end day an old save never stored
         is read from the Explorer's log, and left null if it isn't there. */
      var expd = isObj(journey.expedition) ? journey.expedition : {};
      var xc = ex ? C.cleanExpedition(expd, journey.log) : C.cleanExpedition(null, []);
      var xKnown = xc.n > 0 && (expd.v === 2 || xc.startedDay > 0);     /* an older record's 0 was "not known" */
      out.expedition = {
        n: xc.n,
        state: xc.n === 0 ? 'none' : xc.active ? 'active' : 'ended',
        startedDay: xKnown ? xc.startedDay : null,
        endedDay: xc.n > 0 && !xc.active ? xc.endedDay : null,
        daysRunning: xc.active && xKnown && day !== null ? Math.max(0, day - xc.startedDay) : null
      };
      return out;
    }
  };

  /* How many pending orders the DM doc lists (the next to complete first). */
  C.ORDERS_LISTED = 5;

  /* The Explorer's expedition record, read from a save: { v: 2, n, active,
     startedDay, endedDay }. The days are whole numbers of any size, because
     Reset Travel moves them with the other days and they can end up 0 or
     below; endedDay is null while an expedition is under way and when there
     has been none. A record without v 2 is from before that: its days of 0
     meant "not known", and an expedition that had ended has no end day, so
     it is taken from the log's "Expedition N ended on Day D." line while
     that is still there, else left null. A day is never guessed. */
  C.cleanExpedition = function (raw, log) {
    var r = isObj(raw) ? raw : {};
    var v2 = r.v === 2;
    var n = Math.max(0, clampInt(r.n, 0, 100000, 0));
    var active = r.active === true;
    var started = isNum(r.startedDay) ? Math.round(r.startedDay) : 0;
    if (!v2) started = Math.max(0, started);
    var ended = isNum(r.endedDay) ? Math.round(r.endedDay) : null;
    if (!v2 && ended !== null && ended <= 0) ended = null;
    if (!v2 && n > 0 && !active && ended === null) ended = C.endedDayFromLog(log, n) || null;
    return { v: 2, n: n, active: active, startedDay: started, endedDay: active ? null : ended };
  };

  /* The day expedition number n ended, read from the Explorer's journey log
     (newest line first) when an older save never stored it: the line is
     "Day 9 · Expedition 2 ended on Day 9." Returns 0 when it isn't there (the
     log keeps only the last 100 lines), because a day is never guessed. */
  C.endedDayFromLog = function (log, n) {
    var list = Array.isArray(log) ? log : [];
    for (var i = 0; i < list.length; i++) {
      var m = typeof list[i] === 'string' ? /Expedition (\d+) ended on Day (\d+)\./.exec(list[i]) : null;
      if (m && Number(m[1]) === n) return Number(m[2]);
    }
    return 0;
  };
}());
