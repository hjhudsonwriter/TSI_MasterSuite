/* The Scarlett Isles: D&D Tool Suite — saving rules (plain functions, tested in tests/rules.html).
   Every save is a "record": { key, value, savedAt }.
   Every key starts with "tsi.", then the tool's id, then a name:
     tsi.bastion.state   tsi.quests.accepted   tsi.encounter.mapImage
   Two ids are kept for the suite itself: "suite" (the shell) and
   "quarantine" (damaged saves set aside rather than deleted). */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  var KEY_PATTERN = /^tsi\.[a-z][a-z0-9-]*(\.[A-Za-z0-9_-]+)+$/;
  var MAX_KEY_LENGTH = 200;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var rules = {
    RESERVED_TOOLS: ['suite', 'quarantine'],

    isValidKey: function (key) {
      return typeof key === 'string' && key.length <= MAX_KEY_LENGTH && KEY_PATTERN.test(key);
    },

    /* 'tsi.bastion.state' → 'bastion' */
    toolOf: function (key) {
      if (!rules.isValidKey(key)) return null;
      return key.split('.')[1];
    },

    /* ('bastion', 'state') → 'tsi.bastion.state'. Throws on a bad tool id or name. */
    keyFor: function (tool, name) {
      var key = 'tsi.' + tool + '.' + name;
      if (!rules.isValidKey(key)) throw new Error('"' + key + '" is not a valid save name.');
      return key;
    },

    isValidToolId: function (id) {
      return typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id);
    },

    /* Saves are kept exactly as a backup file would hold them (plain JSON),
       so what is saved and what is backed up can never differ. */
    toJsonValue: function (value) {
      if (value === undefined) throw new Error('Nothing to save (the value is undefined).');
      var text = JSON.stringify(value);
      if (text === undefined) throw new Error('That value can\'t be saved.');
      return JSON.parse(text);
    },

    makeRecord: function (key, value, when, note) {
      if (!rules.isValidKey(key)) throw new Error('"' + key + '" is not a valid save name.');
      var record = {
        key: key,
        value: rules.toJsonValue(value),
        savedAt: (when instanceof Date ? when : new Date(when || Date.now())).toISOString()
      };
      if (note) record.note = note;
      return record;
    },

    isRecord: function (r) {
      return !!r && typeof r === 'object' && !Array.isArray(r) &&
        rules.isValidKey(r.key) &&
        Object.prototype.hasOwnProperty.call(r, 'value') && r.value !== undefined &&
        typeof r.savedAt === 'string' && !isNaN(Date.parse(r.savedAt));
    },

    /* Where a damaged save is set aside:
       tsi.bastion.state → tsi.quarantine.bastion.state.20260925-140312 */
    quarantineKey: function (key, when) {
      var d = when instanceof Date ? when : new Date(when || Date.now());
      var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
        pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
      var rest = rules.isValidKey(key) ? key.slice(4) : 'unreadable';
      if (rest.indexOf('quarantine.') === 0) rest = rest.slice('quarantine.'.length);
      return 'tsi.quarantine.' + rest + '.' + stamp;
    },

    /* A plain-English reason for a failed save. */
    describeFailure: function (err) {
      var name = err && err.name;
      if (name === 'QuotaExceededError') return 'The browser\'s storage space for the suite is full.';
      if (name === 'DataCloneError') return 'Part of the data couldn\'t be stored.';
      if (name === 'InvalidStateError' || name === 'UnknownError') return 'The browser\'s storage stopped responding.';
      return 'The browser refused to save' + (name ? ' (' + name + ')' : '') + '.';
    }
  };

  TSI.storeRules = rules;
}());
