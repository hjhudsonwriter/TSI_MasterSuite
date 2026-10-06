/* The Scarlett Isles: D&D Tool Suite — saving rules (plain functions, tested in tests/rules.html).
   Every save is a "record": { key, value, savedAt }.
   Every key starts with "tsi.", then the tool's id, then a name:
     tsi.bastion.state   tsi.quests.accepted   tsi.encounter.mapImage
   Three ids are kept for the suite itself: "suite" (the shell),
   "quarantine" (damaged saves set aside rather than deleted) and "dmdoc"
   (the DM doc, the floating panel in the top bar, saved from every screen:
   tsi.dmdoc.layout). Back up everything and Restore cover all of them. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  var KEY_PATTERN = /^tsi\.[a-z][a-z0-9-]*(\.[A-Za-z0-9_-]+)+$/;
  var MAX_KEY_LENGTH = 200;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var rules = {
    RESERVED_TOOLS: ['suite', 'quarantine', 'dmdoc'],

    /* Saves that belong to the whole suite rather than one tool, and how a
       backup's "are you sure?" pop-up names them. */
    SUITE_FAMILIES: { quarantine: 'Damaged saves set aside', dmdoc: 'DM doc' },

    /* Tools that only exist on the test page. Their data is never kept in,
       backed up from or restored into the real suite. */
    TEST_ONLY_TOOLS: ['demo'],

    isTestOnly: function (key) {
      return rules.TEST_ONLY_TOOLS.indexOf(rules.toolOf(key)) !== -1;
    },

    /* The storage names for each "space". The real suite and the test page
       never share a database, a storage key or a backup file.
       - db: the browser database's name
       - local: the prefix for the small fallback storage (the test page's
         keys contain a colon, which a real save name can never have)
       - tabs, tabId, flash, dmdocOpen: the shell's own bookkeeping (tabs:
         each open tab's heartbeat, { at, tool }, for the "Already open"
         warning; dmdocOpen: whether this window has the DM doc open, kept
         per window so it never pops up on the TV's window by itself)
       - handoff, handback: a fight passed from the Explorer to the Combat
         Tracker, and its result passed back (TSI.handoff)
       - file: the start of backup file names */
    spaceNames: function (space) {
      if (space === 'test') {
        return { space: 'test', db: 'tsi.test', local: 'tsi.test:', tabs: 'tsi.test:tabs', tabId: 'tsi.test:tab-id', flash: 'tsi.test:flash', dmdocOpen: 'tsi.test:dmdoc-open', handoff: 'tsi.test:handoff', handback: 'tsi.test:handback', file: 'tsi-test-' };
      }
      return { space: 'suite', db: 'tsi.suite', local: '', tabs: 'tsi.suite.tabs', tabId: 'tsi.suite.tab-id', flash: 'tsi.suite.flash', dmdocOpen: 'tsi.suite.dmdoc-open', handoff: 'tsi.suite.handoff', handback: 'tsi.suite.handback', file: 'tsi-' };
    },

    /* The fallback-storage key for a save, and back again (null if it isn't one of this space's). */
    localKey: function (key, space) { return rules.spaceNames(space).local + key; },
    fromLocalKey: function (storageKey, space) {
      var prefix = rules.spaceNames(space).local;
      if (typeof storageKey !== 'string' || storageKey.indexOf(prefix) !== 0) return null;
      var key = storageKey.slice(prefix.length);
      if (!rules.isValidKey(key) || rules.toolOf(key) === 'suite') return null;
      return key;
    },

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

    /* ---------- Two open copies (the "Already open" warning) ----------
       Each open tab says which tool it has open: a tool id, '' for the home
       screen (null is read as the home screen too). Anything else, such as
       a heartbeat from before tabs said so, means "not known": null. */
    tabTool: function (value) {
      if (value === '' || value === null) return '';
      return rules.isValidToolId(value) ? value : null;
    },

    /* Can two open tabs overwrite each other's saves? Saves are written one
       name at a time and a tool only writes its own (tsi.<tool>.…), so two
       tabs on different tools can't. They can when both have the same tool
       open, when either is on the home screen (its Restore and Back up
       everything cover every tool), and, to be safe, when either tab's tool
       isn't known. Takes two results of tabTool. */
    tabsClash: function (mine, theirs) {
      if (mine === null || theirs === null || mine === undefined || theirs === undefined) return true;
      if (mine === '' || theirs === '') return true;
      return mine === theirs;
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
