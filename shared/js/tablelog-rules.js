/* The Scarlett Isles: D&D Tool Suite — the table log (plain functions, tested in tests/rules.html).
   A short list of what the DM put in front of the players: the scene cards and portraits shown on the TV, fights set up,
   camps made, and (later) clues and bonds. It is kept so a recap can say "last time you saw...". It holds only what the
   players could see (a title and a picture), never the DM's notes. The last 500 entries are kept.

   An entry: { day, at, kind, ref, label, image }
     day    the Explorer's day (a whole number, or null if not known)
     at     when it happened (milliseconds)
     kind   card, cast, clue, fight, camp, bond, note, or session-end (a marker written by End session)
     ref    what it was, for the DM's use (a card id, a cast id...)
     label  the words (a card's name, a person's name)
     image  the picture's path, or ''
     result 'won' on a fight entry the Combat Tracker reported as won (guide 4, the recap's "Meanwhile" slide), else '' */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var KINDS = ['card', 'cast', 'clue', 'fight', 'camp', 'bond', 'note', 'session-end'];
  var MAX = 500;

  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }

  var rules = {
    KINDS: KINDS,
    MAX: MAX,
    KEY_NAME: 'entries',

    /* One entry, cleaned, or null if it is not one. */
    cleanEntry: function (raw) {
      if (!raw || typeof raw !== 'object' || KINDS.indexOf(raw.kind) === -1) return null;
      var at = Number(raw.at);
      var day = raw.day === null || raw.day === undefined || raw.day === '' ? NaN : Number(raw.day);   /* no day is no day, not day 0 */
      var out = {
        day: isFinite(day) ? Math.floor(day) : null,
        at: isFinite(at) ? Math.floor(at) : 0,
        kind: raw.kind,
        ref: str(raw.ref, 120),
        label: str(raw.label, 200),
        image: str(raw.image, 300)
      };
      if (raw.result === 'won') out.result = 'won';
      return out;
    },

    /* A saved list, cleaned (anything wrong is dropped, never thrown). */
    clean: function (raw) {
      var list = raw && Array.isArray(raw.entries) ? raw.entries : Array.isArray(raw) ? raw : [];
      return rules.trim(list.map(rules.cleanEntry).filter(Boolean));
    },

    /* The wrapper that is saved. */
    pack: function (entries) { return { version: 1, entries: entries }; },

    /* Keep the last MAX. */
    trim: function (entries, max) {
      max = max || MAX;
      return entries.length > max ? entries.slice(entries.length - max) : entries.slice();
    },

    /* A new list with the entry added (null entries are ignored). The same thing twice in a row is kept once. */
    add: function (entries, raw) {
      var e = rules.cleanEntry(raw);
      if (!e) return entries.slice();
      var last = entries[entries.length - 1];
      if (last && last.kind === e.kind && last.ref === e.ref && last.label === e.label && (last.result || '') === (e.result || '') && e.kind !== 'camp' && e.kind !== 'session-end' && e.at - last.at < 3000) return entries.slice();
      return rules.trim(entries.concat([e]));
    },

    /* Everything since the last End session (the entries after the newest session-end marker). */
    sinceLastSession: function (entries) {
      var cut = -1;
      for (var i = entries.length - 1; i >= 0; i--) if (entries[i].kind === 'session-end') { cut = i; break; }
      return entries.slice(cut + 1).filter(function (e) { return e.kind !== 'session-end'; });
    }
  };

  TSI.tablelogRules = rules;
}());
