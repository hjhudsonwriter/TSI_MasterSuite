/* Scarlett Isles: Beast Handler — rolling and checking a beast's profile (BH-2a).

   Plain functions, tested on tests/rules.html. The tables are Harry's, in
   data/profile-tables.js. His rules for the profile (21 October 2026):
   - Roll shows a SUGGESTION and saves nothing. The player can roll again, pick
     another listed option or type their own, and only Save sends it.
   - A roll never changes a bond, a stat, an attack, a resistance, training
     speed or bond progress. Nothing in this file touches any of them: it only
     ever produces words.
   - A Bond 0 beast can have a temperament; the bond is never looked at.
   - A description never overrides something the DM has established: the DM can
     still edit all of it, and the Bastion keeps a note of every change.
   - Text is cleaned (no angle brackets, control or direction-changing
     characters; spaces tidied; Unicode kept) and length-checked. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};
  var Pf = ns.profile = {};

  var FIELDS = ['dominant', 'attachment', 'trigger', 'regional'];
  Pf.FIELDS = FIELDS;
  Pf.LABELS = { dominant: 'Dominant Temperament', attachment: 'Attachment Cue', trigger: 'Instinctive Trigger', regional: 'Regional Variety' };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function tables() { return window.TSI_DATA && window.TSI_DATA.beastProfile; }

  /* Words, safely: no markup brackets, control characters or characters that flip the text's direction. */
  Pf.clean = function (text, max) {
    var t = String(text === undefined || text === null ? '' : text)
      .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿<>]/g, ' ')
      .replace(/\s+/g, ' ').trim();
    return typeof max === 'number' ? t.slice(0, max) : t;
  };

  Pf.limit = function (field, tb) {
    var t = tb || tables() || {};
    return field === 'regional' ? (t.regionalMax || 60) : (t.textMax || 120);
  };

  /* One die: the entry whose roll comes up. rnd() is 0 up to (not including) 1. */
  Pf.rollTable = function (table, rnd) {
    if (!isObj(table) || !Array.isArray(table.entries) || !table.entries.length) return null;
    var dice = table.dice > 0 ? table.dice : table.entries.length;
    var r = Math.min(dice, Math.floor((rnd || Math.random)() * dice) + 1);
    return table.entries.filter(function (e) { return e.roll === r; })[0] || table.entries[r - 1] || null;
  };

  /* A suggested profile for a kind of beast: the d12 temperament and the two d8s. Not saved. */
  Pf.suggest = function (speciesId, rnd, tb) {
    var t = tb || tables();
    var sp = t && isObj(t.species) ? t.species[speciesId] : null;
    if (!sp) return null;
    var d = Pf.rollTable(t.dominant, rnd);
    var a = Pf.rollTable(sp.attachment, rnd);
    var g = Pf.rollTable(sp.trigger, rnd);
    return {
      dominant: d ? d.label : '', attachment: a ? a.label : '', trigger: g ? g.label : '',
      rolls: { dominant: d ? d.roll : 0, attachment: a ? a.roll : 0, trigger: g ? g.roll : 0 }
    };
  };

  /* One field rolled again on its own: its new suggestion (words only), or null. */
  Pf.suggestOne = function (speciesId, field, rnd, tb) {
    var t = tb || tables();
    var sp = t && isObj(t.species) ? t.species[speciesId] : null;
    if (!sp) return null;
    var table = field === 'dominant' ? t.dominant : (field === 'attachment' || field === 'trigger') ? sp[field] : null;
    var e = Pf.rollTable(table, rnd);
    return e ? { text: e.label, roll: e.roll } : null;
  };

  /* The listed options for a kind of beast, to pick from: { dominant: [...], attachment: [...], trigger: [...], regional: [...] }. */
  Pf.options = function (speciesId, tb) {
    var t = tb || tables();
    var sp = t && isObj(t.species) ? t.species[speciesId] : null;
    var labels = function (table) { return table && Array.isArray(table.entries) ? table.entries.map(function (e) { return e.label; }) : []; };
    return {
      dominant: t ? labels(t.dominant) : [],
      attachment: sp ? labels(sp.attachment) : [],
      trigger: sp ? labels(sp.trigger) : [],
      regional: sp && Array.isArray(sp.regional) ? sp.regional.map(function (r) { return r.name; }) : []
    };
  };

  /* Check the fields a player wants to save. Only the fields given are looked at.
     Returns { ok, clean: { field: text }, problems: [text] }; an empty text clears that line. */
  Pf.check = function (fields, tb) {
    var out = { ok: true, clean: {}, problems: [] };
    if (!isObj(fields)) { out.ok = false; out.problems.push('There is nothing to save.'); return out; }
    var any = false;
    FIELDS.forEach(function (f) {
      if (fields[f] === undefined) return;
      any = true;
      if (typeof fields[f] !== 'string') { out.problems.push(Pf.LABELS[f] + ' has to be words.'); return; }
      var max = Pf.limit(f, tb);
      var raw = Pf.clean(fields[f]);
      if (raw.length > max) { out.problems.push(Pf.LABELS[f] + ' can be at most ' + max + ' letters (it is ' + raw.length + ').'); return; }
      out.clean[f] = raw;
    });
    Object.keys(fields).forEach(function (k) { if (FIELDS.indexOf(k) === -1) out.problems.push('"' + String(k).slice(0, 20) + '" isn\'t something a handler can change.'); });
    if (!any && !out.problems.length) out.problems.push('There is nothing to save.');
    out.ok = out.problems.length === 0;
    return out;
  };

  /* Which of the cleaned fields really differ from what is there: [field]. */
  Pf.changed = function (current, clean) {
    var cur = isObj(current) ? current : {};
    return FIELDS.filter(function (f) { return clean[f] !== undefined && String(cur[f] || '') !== clean[f]; });
  };
}());
