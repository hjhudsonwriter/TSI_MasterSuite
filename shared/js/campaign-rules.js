/* The Scarlett Isles: D&D Tool Suite — the campaign at a glance (7 October 2026).
   Plain functions (no screen code, tested in tests/rules.html) that read the
   Explorer's and the Bastion's saves and say where the campaign stands. The
   DM doc shows them (shared/js/dmdoc.js). The Explorer uses two of them
   too, so the DM doc and the Explorer can never disagree:
   - untilText: when an Active Effect ends ("ends Day 9", "until Make Camp");
   - isBastionDay: the weekly Bastion reminder, at the Make Camp that starts
     Day 8, 15, 22 and so on.

   TSI.campaign.summary(explorerSave, bastionSave, regions) → everything the
   DM doc shows. Either save may be null (that tool hasn't saved yet).
   regions is TSI_DATA.regions (shared/data/regions.js). */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function str(v) { return typeof v === 'string' ? v : ''; }
  function clampInt(v, min, max, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  var C = TSI.campaign = {
    /* The Explorer's Bastion reminder comes every 7 days. */
    BASTION_EVERY: 7,

    /* Does the Make Camp that starts this day bring the Bastion reminder? (Days 8, 15, 22…) */
    isBastionDay: function (day) {
      return isNum(day) && day > 1 && (Math.floor(day) - 1) % C.BASTION_EVERY === 0;
    },
    /* The next day after this one that brings the reminder. */
    nextBastionDay: function (day) {
      var d = isNum(day) ? Math.max(1, Math.floor(day)) : 1;
      return d + (C.BASTION_EVERY - ((d - 1) % C.BASTION_EVERY));
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

    summary: function (explorer, bastion, regions) {
      var ex = isObj(explorer) ? explorer : null;
      var ba = isObj(bastion) ? bastion : null;
      var travel = ex && isObj(ex.travel) ? ex.travel : {};
      var out = { explorerSaved: !!ex, bastionSaved: !!ba };

      /* The party: the Bastion's level (7, its starting level, until it saves one), and the Explorer's heroes. */
      var level = ba ? clampInt(ba.partyLevel, 1, 20, null) : null;
      out.level = { value: level === null ? 7 : level, fromBastion: level !== null };
      out.heroes = ex && Array.isArray(ex.tokens)
        ? ex.tokens.map(function (t) { return isObj(t) ? str(t.name).trim() : ''; }).filter(Boolean)
        : [];

      /* Time: the Explorer's day; the Bastion's turns (its turn counter starts at 1, so turns done = turn − 1). */
      var day = ex ? clampInt(travel.day, 1, 100000, 1) : null;
      out.day = day;
      out.daysPassed = day === null ? null : day - 1;
      if (day !== null) {
        var next = C.nextBastionDay(day);
        out.nextBastion = { day: next, inDays: next - day };
      } else {
        out.nextBastion = null;
      }
      var turn = ba ? clampInt(ba.turn, 1, 100000, 1) : null;
      out.bastionTurns = turn === null ? null : turn - 1;

      /* Where the party is: the Explorer's Region, its Clan and god, and their standing in the Bastion. */
      var rid = ex ? (str(travel.provinceId) || 'northern_province') : null;
      var reg = rid && regions && isObj(regions[rid]) ? regions[rid] : null;
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
        out.god = { key: reg.god, name: reg.godName, favour: ba ? clampInt(fav, 0, 100, 0) : null };
      } else {
        out.region = null;
        out.clan = null;
        out.god = null;
      }

      /* The Explorer's Active Effects, exactly as its own list shows them. */
      var effects = ex && isObj(ex.journey) && Array.isArray(ex.journey.effects) ? ex.journey.effects : [];
      out.effects = effects.filter(function (e) { return isObj(e) && str(e.name); }).map(function (e) {
        return {
          id: str(e.id), name: e.name, who: str(e.whoName) || 'The party', text: str(e.text),
          until: C.untilText(e, day === null ? 1 : day), from: str(e.from)
        };
      });
      return out;
    }
  };
}());
