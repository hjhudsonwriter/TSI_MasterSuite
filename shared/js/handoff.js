/* The Scarlett Isles: D&D Tool Suite — passing things between tools.
   The Explorer hands a fight to the Combat Tracker ("Set up this fight"),
   and the Combat Tracker reports back when every enemy is down; the Clan
   Crest Creator sends a crest to the Bastion ("Use for the Bastion"). The
   tools may be open in different windows, which share nothing but the
   browser's small shared storage (localStorage), so each message is
   written there:
   - 'fight' (tsi.suite.handoff): the fight to set up, from the Explorer
     (built by tools/explorer/fights.js);
   - 'result' (tsi.suite.handback): { id, result: 'won', at }, from the
     Combat Tracker, id being the fight's;
   - 'crest' (tsi.suite.handoff-crest): { id, at, name, dataUrl, design },
     from the Crest Creator: a 512-pixel PNG of the crest and the Creator's
     design (the Bastion overhaul, Build 3, Harry, 8 October 2026).
   A window with the other tool open hears at once (the browser's "storage"
   event); a tool opened later reads it as it starts. Only the latest of
   each is kept. They aren't saves, so they're not in backups. The test
   page keeps its own (tsi.test:handoff, tsi.test:handback and
   tsi.test:handoff-crest). */
(function () {
  'use strict';

  var TSI = window.TSI;
  var NAMES = TSI.storeRules.spaceNames(TSI.space);
  var KEYS = { fight: NAMES.handoff, result: NAMES.handback, crest: NAMES.handoffCrest };

  function key(kind) {
    if (!KEYS[kind]) throw new Error('There is no hand-off called ' + kind + '.');
    return KEYS[kind];
  }
  function parse(raw) {
    try {
      var v = JSON.parse(raw);
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  }

  TSI.handoff = {
    /* Write it for the other tool. Returns false if the browser refused. */
    write: function (kind, value) {
      try { localStorage.setItem(key(kind), JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    /* The latest one, or null. */
    read: function (kind) {
      try { return parse(localStorage.getItem(key(kind))); } catch (e) { return null; }
    },
    /* Remove it, but only if it's still the one with this id (another may have replaced it). */
    clear: function (kind, id) {
      var v = TSI.handoff.read(kind);
      if (!v || (id !== undefined && v.id !== id)) return;
      try { localStorage.removeItem(key(kind)); } catch (e) { /* nothing to do */ }
    },
    /* fn(value or null) whenever another window writes or clears it. life is
       the tool's ctx.life, so the listener stops when the tool closes. */
    listen: function (life, kind, fn) {
      var k = key(kind);
      life.on(window, 'storage', function (event) {
        if (event.key === k) fn(parse(event.newValue));
      });
    }
  };
}());
