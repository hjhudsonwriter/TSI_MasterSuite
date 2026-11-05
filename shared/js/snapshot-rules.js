/* The Scarlett Isles: D&D Tool Suite — snapshot rules (plain functions, tested in tests/rules.html).
   A snapshot (Harry, 2 November 2026) is a copy of the campaign (the Explorer's journey and the Bastion) kept inside the browser
   at a moment that matters: Make Camp, a Bastion day passing, or every ten minutes of play if something changed. The last twelve
   are kept, so a mistake at the table can be taken back a step without finding a backup file. They are not part of any backup
   file and a Restore leaves them alone.
   { id, at (ms), why, items: { explorer: <the Explorer's save or null>, bastion: <the Bastion's save or null> } } */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  var KEYS = { explorer: 'tsi.explorer.save', bastion: 'tsi.bastion.state', evidence: 'tsi.evidence.state' };

  var rules = {
    MAX: 12,
    AUTO_EVERY_MS: 10 * 60 * 1000,
    KEYS: KEYS,

    cleanWhy: function (text) {
      return String(text === undefined || text === null ? '' : text).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    },

    /* What a snapshot holds: the two saves (null if the tool has none). */
    makeItems: function (explorerSave, bastionSave, evidenceSave) {
      var items = { explorer: explorerSave === undefined ? null : explorerSave, bastion: bastionSave === undefined ? null : bastionSave };
      /* The Evidence Board (guide 2) is kept too; an older snapshot without it leaves the board as it is when it is put back. */
      if (evidenceSave !== undefined) items.evidence = evidenceSave;
      return items;
    },

    sameItems: function (a, b) {
      if (!a || !b) return false;
      return JSON.stringify(a.items || null) === JSON.stringify(b.items || null);
    },

    /* Should a new snapshot be kept? Not if nothing is saved at all, and not if it is the same as the latest (unless forced). */
    shouldKeep: function (latest, items, force) {
      if (!items || (items.explorer === null && items.bastion === null)) return false;
      if (force) return true;
      return !rules.sameItems(latest, { items: items });
    },

    makeSnapshot: function (items, why, when) {
      var at = when instanceof Date ? when.getTime() : (typeof when === 'number' ? when : Date.now());
      return { id: at + '-' + Math.random().toString(36).slice(2, 7), at: at, why: rules.cleanWhy(why) || 'Snapshot', items: items };
    },

    /* Newest first, and only the newest MAX. Returns { kept, dropped }. */
    prune: function (list, max) {
      var sorted = (list || []).slice().sort(function (a, b) { return b.at - a.at; });
      var n = typeof max === 'number' ? max : rules.MAX;
      return { kept: sorted.slice(0, n), dropped: sorted.slice(n) };
    },

    /* "Explorer Day 5 · Bastion Day 4" */
    summary: function (snap) {
      var parts = [];
      var ex = snap && snap.items && snap.items.explorer;
      var ba = snap && snap.items && snap.items.bastion;
      if (ex && ex.travel && isFinite(Number(ex.travel.day))) parts.push('Explorer Day ' + Math.floor(Number(ex.travel.day)));
      if (ba && isFinite(Number(ba.day))) parts.push('Bastion Day ' + Math.floor(Number(ba.day)));
      return parts.join(' · ');
    },

    /* The records to write to go back to a snapshot: the current records of the campaign tools, with the Explorer's and the
       Bastion's saves swapped for the snapshot's (a save the snapshot did not have is removed). current: records. */
    rollbackRecords: function (current, snap, when) {
      var stamp = new Date(when || Date.now()).toISOString();
      var hasBoard = !!snap.items && snap.items.evidence !== undefined;
      var out = (current || []).filter(function (r) { return r.key !== KEYS.explorer && r.key !== KEYS.bastion && !(hasBoard && r.key === KEYS.evidence); });
      ['explorer', 'bastion'].concat(hasBoard ? ['evidence'] : []).forEach(function (tool) {
        var value = snap.items ? snap.items[tool] : null;
        if (value !== null && value !== undefined) out.push({ key: KEYS[tool], value: value, savedAt: stamp });
      });
      return out.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
    }
  };

  TSI.snapshotRules = rules;
}());
