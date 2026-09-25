/* The Scarlett Isles: D&D Tool Suite — backup file rules (plain functions, tested in tests/rules.html).
   A backup is a JSON file:
   {
     "format": "tsi-backup", "version": 1,
     "kind": "suite" | "tool", "tool": "<id, for a tool backup>",
     "suite": "The Scarlett Isles: D&D Tool Suite",
     "savedAt": "2026-09-25T13:03:00.000Z",
     "records": [ { "key": "tsi.quests.accepted", "value": ..., "savedAt": "..." } ]
   } */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fileStamp(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
  }
  function store() { return TSI.storeRules; }
  function the(name, start) { return TSI.the(name, start); }

  var SUITE_NAME = 'The Scarlett Isles: D&D Tool Suite';

  var rules = {
    FORMAT: 'tsi-backup',
    VERSION: 1,

    makeSuiteBackup: function (records, when) {
      return {
        format: rules.FORMAT,
        version: rules.VERSION,
        kind: 'suite',
        suite: SUITE_NAME,
        savedAt: new Date(when || Date.now()).toISOString(),
        records: records
      };
    },

    makeToolBackup: function (toolId, toolName, records, when) {
      return {
        format: rules.FORMAT,
        version: rules.VERSION,
        kind: 'tool',
        tool: toolId,
        toolName: toolName || toolId,
        suite: SUITE_NAME,
        savedAt: new Date(when || Date.now()).toISOString(),
        records: records
      };
    },

    /* tsi-backup-everything-2026-09-25-1403.json  or  tsi-quests-2026-09-25-1403.json */
    fileName: function (kind, toolId, when) {
      var stamp = fileStamp(when instanceof Date ? when : new Date(when || Date.now()));
      return kind === 'suite' ? 'tsi-backup-everything-' + stamp + '.json' : 'tsi-' + toolId + '-' + stamp + '.json';
    },

    /* Read a backup file's text. Returns { ok: true, backup } or { ok: false, reason } in plain English. */
    parse: function (text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return { ok: false, reason: 'This file isn\'t a suite backup. It isn\'t in the backup format at all.' };
      }
      if (!data || typeof data !== 'object' || Array.isArray(data) || data.format !== rules.FORMAT) {
        return { ok: false, reason: 'This file isn\'t a backup from ' + SUITE_NAME + '.' };
      }
      if (typeof data.version !== 'number' || data.version < 1) {
        return { ok: false, reason: 'This backup file is damaged (its version is missing).' };
      }
      if (data.version > rules.VERSION) {
        return { ok: false, reason: 'This backup was made by a newer version of the suite, so this version can\'t read it.' };
      }
      if (data.kind !== 'suite' && data.kind !== 'tool') {
        return { ok: false, reason: 'This backup file is damaged (it doesn\'t say what it holds).' };
      }
      if (data.kind === 'tool' && !store().isValidToolId(data.tool)) {
        return { ok: false, reason: 'This backup file is damaged (it doesn\'t say which tool it\'s from).' };
      }
      if (!Array.isArray(data.records)) {
        return { ok: false, reason: 'This backup file is damaged (its saved items are missing).' };
      }
      var seen = new Set();
      for (var i = 0; i < data.records.length; i++) {
        var r = data.records[i];
        if (!store().isRecord(r)) {
          return { ok: false, reason: 'This backup file is damaged (saved item ' + (i + 1) + ' can\'t be read).' };
        }
        if (seen.has(r.key)) {
          return { ok: false, reason: 'This backup file is damaged (it holds "' + r.key + '" twice).' };
        }
        seen.add(r.key);
        if (data.kind === 'tool' && store().toolOf(r.key) !== data.tool) {
          return { ok: false, reason: 'This backup file is damaged (it mixes in another tool\'s data).' };
        }
      }
      return { ok: true, backup: data };
    },

    /* Can this backup be restored from the home screen? Returns a reason, or null if yes. */
    checkForSuite: function (backup, nameOf) {
      if (backup.kind === 'tool') {
        var name = (nameOf && nameOf(backup.tool)) || backup.toolName || backup.tool;
        return 'This is a backup of just ' + the(name) + '. To load it, open ' + the(name) + ' and use Import.';
      }
      return null;
    },

    /* Can this backup be imported into this tool? Returns a reason, or null if yes. */
    checkForTool: function (backup, toolId, nameOf) {
      var mine = (nameOf && nameOf(toolId)) || toolId;
      if (backup.kind === 'suite') {
        return 'This is a whole-suite backup, not a ' + mine + ' file. To restore it, use Restore on the home screen.';
      }
      if (backup.tool !== toolId) {
        var theirs = (nameOf && nameOf(backup.tool)) || backup.toolName || backup.tool;
        return 'This file is from ' + the(theirs) + ', not ' + the(mine) + '. Nothing was changed.';
      }
      return null;
    },

    /* What's in a backup, for the "are you sure?" pop-up.
       Returns { total, lines: ['Notice Board Quest Generator: 3 saved items', ...] } */
    summarise: function (backup, nameOf) {
      var counts = {};
      var order = [];
      backup.records.forEach(function (r) {
        var tool = store().toolOf(r.key);
        if (!counts[tool]) { counts[tool] = 0; order.push(tool); }
        counts[tool]++;
      });
      var lines = order.map(function (tool) {
        var label = tool === 'quarantine' ? 'Damaged saves set aside' : ((nameOf && nameOf(tool)) || tool);
        return label + ': ' + counts[tool] + ' saved item' + (counts[tool] === 1 ? '' : 's');
      });
      return { total: backup.records.length, lines: lines };
    }
  };

  TSI.backupRules = rules;
}());
