/* The Ironbow Bastion Manager — the Hall of Emissaries' Diplomatic Records
   (pull request 9 of the facilities overhaul; Harry's decisions, 18
   October 2026, from his Hall redesign handover). Plain functions (no
   screen code), tested on tests/rules.html. They add to the Bastion's
   rules (tools/bastion/rules.js), as creature-rules.js does.

   What it is: a DM-led ledger of diplomatic events and what they led to.
   The DM writes a record (title, the Clans involved, the in-game day, the
   situation, what the players decided, the outcome, notes) and the
   consequences it has. Nothing changes in the game until the DM confirms
   the record:
   - A record is a draft, then confirmed (or dismissed). A draft can be
     edited. A confirmed record is kept as it is; only a note can be added,
     and a consequence that lasts can be ended early.
   - Honour & Respect and Political Capital changes are really applied, to
     the Bastion's existing scores (R.adjustStanding, s.politicalCapital),
     once, when the record is confirmed.
   - Everything else (a restriction or embargo, a privilege, a favour, an
     unresolved obligation, a quest hook) is DM-tracked: the Bastion records
     it, shows it and counts its days, but does not enforce it. It says so.
   - Nothing is preset: no numbers, durations, events or effects are
     invented. The DM types each one.
   - Days are the shared Explorer day (the Bastion's day).
   - Each record has a stable id ('dr-0001') and a history, so the later
     hybrid event system (DM-authored and DM-approved offered events) can
     use the same records.

   The records are a top-level part of the save (s.diplomaticRecords), apart
   from s.diplomacy and s.legacyDiplomacy (the Hall's old agreements, which
   ended in the Strip Back Overhaul, step S09). The ledger is shown in the
   Hall as "Diplomatic Events". */
(function () {
  'use strict';
  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.bastion = TSI.bastion || {};
  var R = ns.rules;
  if (!R) return;
  var clampInt = R.clampInt;
  var dayNum = R.dayNum;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : null; }

  var TITLE_MAX = 80;
  var TEXT_MAX = 1000;
  var NOTE_MAX = 300;
  var HISTORY_MAX = 60;
  var CONSEQUENCES_MAX = 12;
  var RECORDS_MAX = 500;
  var DAYS_MAX = 3650;

  /* The kinds of consequence. enforced: the Bastion really changes a score
     (hr, pc); the rest are DM-tracked. days: 'required', 'optional' or
     'none'. clan: whether a Clan is needed. */
  R.DIP_KINDS = [
    { id: 'hr', label: 'Honour & Respect', enforced: true, clan: 'required', days: 'none', amount: [-5, 5] },
    { id: 'pc', label: 'Political Capital', enforced: true, clan: 'required', days: 'none', amount: [-100, 100] },
    { id: 'restriction', label: 'Restriction or embargo', enforced: false, clan: 'required', days: 'required' },
    { id: 'privilege', label: 'Privilege', enforced: false, clan: 'optional', days: 'optional' },
    { id: 'favour', label: 'Favour owed', enforced: false, clan: 'optional', days: 'optional' },
    { id: 'obligation', label: 'Unresolved obligation', enforced: false, clan: 'optional', days: 'none' },
    { id: 'hook', label: 'Quest hook', enforced: false, clan: 'optional', days: 'none' }
  ];
  function kindOf(id) {
    for (var i = 0; i < R.DIP_KINDS.length; i++) if (R.DIP_KINDS[i].id === id) return R.DIP_KINDS[i];
    return null;
  }
  R.dipKind = kindOf;
  R.DIP_LIMITS = { title: TITLE_MAX, text: TEXT_MAX, consequences: CONSEQUENCES_MAX, days: DAYS_MAX };

  function clanList(data) {
    var list = data && data.bastion && Array.isArray(data.bastion.clans) ? data.bastion.clans : (window.TSI_DATA && window.TSI_DATA.bastion && window.TSI_DATA.bastion.clans) || [];
    return list.filter(function (c) { return isObj(c) && typeof c.key === 'string'; });
  }
  R.dipClans = clanList;
  function clanKeys(data) { return clanList(data).map(function (c) { return c.key; }); }
  function clanName(data, key) {
    var c = clanList(data).filter(function (x) { return x.key === key; })[0];
    return c ? 'Clan ' + c.name : (key ? 'Clan ' + key : '');
  }
  R.dipClanName = clanName;
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }
  function oneLine(v, max) { return String(typeof v === 'string' ? v : '').replace(/\s+/g, ' ').trim().slice(0, max); }
  function multiLine(v, max) { return String(typeof v === 'string' ? v : '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim().slice(0, max); }
  function whole(v) { var n = typeof v === 'number' ? v : parseInt(String(v), 10); return isFinite(n) ? Math.round(n) : null; }

  R.defaultDiplomaticRecords = function () { return { next: 1, list: [] }; };
  R.diplomaticRecords = function (s) {
    if (!isObj(s.diplomaticRecords) || !Array.isArray(s.diplomaticRecords.list)) s.diplomaticRecords = R.defaultDiplomaticRecords();
    return s.diplomaticRecords.list;
  };
  R.dipRecordById = function (s, id) {
    return R.diplomaticRecords(s).filter(function (r) { return r.id === id; })[0] || null;
  };
  function idNumber(id) { var m = /^dr-(\d+)$/.exec(String(id)); return m ? parseInt(m[1], 10) : 0; }
  function makeId(n) { var t = String(n); while (t.length < 4) t = '0' + t; return 'dr-' + t; }

  /* ---------- Cleaning a save ---------- */
  function cleanHistory(list, fallbackDay) {
    return (arr(list) || []).filter(isObj).map(function (h) {
      return { day: dayNum(h.day, fallbackDay), text: oneLine(h.text, 400) };
    }).filter(function (h) { return h.text; }).slice(-HISTORY_MAX);
  }
  function cleanConsequence(c, rid, index, recordStatus, data) {
    var kind = isObj(c) ? kindOf(c.kind) : null;
    if (!kind) return null;
    var keys = clanKeys(data);
    var out = {
      id: rid + ':c' + (index + 1),
      kind: kind.id,
      clan: isObj(c) && keys.indexOf(c.clan) !== -1 ? c.clan : '',
      amount: 0,
      days: null,
      text: oneLine(c.text, 400),
      status: 'pending',
      until: null
    };
    if (kind.amount) out.amount = clampInt(whole(c.amount) || 0, kind.amount[0], kind.amount[1]);
    if (kind.days !== 'none') { var d = whole(c.days); out.days = d !== null && d >= 1 ? Math.min(d, DAYS_MAX) : null; }
    if (recordStatus === 'confirmed') {
      /* A confirmed record's scores were applied when it was confirmed, so a
         consequence is never applied again whatever its saved state says. */
      if (kind.enforced) {
        out.status = 'applied';
        out.appliedDay = dayNum(c.appliedDay, 1);
        if (whole(c.was) !== null) out.was = clampInt(whole(c.was), -100, 100);
        if (whole(c.now) !== null) out.now = clampInt(whole(c.now), -100, 100);
      } else {
        out.status = c.status === 'ended' ? 'ended' : 'active';
        out.appliedDay = dayNum(c.appliedDay, 1);
        out.until = c.until === null || c.until === undefined ? null : dayNum(c.until, null);
        if (out.status === 'ended') out.endedDay = dayNum(c.endedDay, out.appliedDay);
      }
    }
    return out;
  }
  R.cleanDiplomaticRecords = function (raw, today, data) {
    var base = R.defaultDiplomaticRecords();
    if (!isObj(raw)) return base;
    var seen = {};
    var maxN = 0;
    var keys = clanKeys(data);
    (arr(raw.list) || []).forEach(function (r) {
      if (!isObj(r) || typeof r.id !== 'string' || !r.id || seen[r.id] || base.list.length >= RECORDS_MAX) return;
      seen[r.id] = true;
      maxN = Math.max(maxN, idNumber(r.id));
      var status = r.status === 'confirmed' ? 'confirmed' : r.status === 'dismissed' ? 'dismissed' : 'draft';
      var out = {
        id: r.id,
        title: oneLine(r.title, TITLE_MAX) || 'Untitled record',
        clans: keys.filter(function (k) { return arr(r.clans) && r.clans.indexOf(k) !== -1; }),
        day: dayNum(r.day, dayNum(today, 1)),
        situation: multiLine(r.situation, TEXT_MAX),
        decision: multiLine(r.decision, TEXT_MAX),
        outcome: multiLine(r.outcome, TEXT_MAX),
        notes: multiLine(r.notes, TEXT_MAX),
        status: status,
        createdDay: dayNum(r.createdDay, dayNum(r.day, dayNum(today, 1))),
        confirmedDay: status === 'confirmed' ? dayNum(r.confirmedDay, dayNum(r.day, 1)) : null,
        history: cleanHistory(r.history, dayNum(r.createdDay, 1)),
        consequences: []
      };
      (arr(r.consequences) || []).slice(0, CONSEQUENCES_MAX).forEach(function (c, i) {
        var cc = cleanConsequence(c, out.id, i, status, data);
        if (cc) out.consequences.push(cc);
      });
      base.list.push(out);
    });
    base.next = Math.max(1, clampInt(whole(raw.next) || 1, 1, 1000000), maxN + 1);
    return base;
  };

  /* ---------- Checking what the DM typed ---------- */
  /* fields: { title, clans, day, situation, decision, outcome, notes,
     consequences: [{ kind, clan, amount, days, text }] }. Returns
     { problem } or { fields } tidied. */
  R.checkDipFields = function (s, data, fields) {
    var f = isObj(fields) ? fields : {};
    var title = oneLine(f.title, TITLE_MAX);
    if (!title) return { problem: 'Give the event a title.' };
    var keys = clanKeys(data);
    var clans = keys.filter(function (k) { return arr(f.clans) && f.clans.indexOf(k) !== -1; });
    var day = f.day === '' || f.day === undefined || f.day === null ? s.day : whole(f.day);
    if (day === null) return { problem: 'The in-game day must be a whole number.' };
    var list = [];
    var raw = arr(f.consequences) || [];
    if (raw.length > CONSEQUENCES_MAX) return { problem: 'A record holds up to ' + CONSEQUENCES_MAX + ' consequences.' };
    for (var i = 0; i < raw.length; i++) {
      var c = raw[i];
      var kind = isObj(c) ? kindOf(c.kind) : null;
      var n = i + 1;
      if (!kind) return { problem: 'Consequence ' + n + ': choose what kind it is.' };
      var clan = keys.indexOf(c.clan) !== -1 ? c.clan : '';
      if (kind.clan === 'required' && !clan) return { problem: 'Consequence ' + n + ' (' + kind.label + '): choose the Clan.' };
      var out = { kind: kind.id, clan: clan, amount: 0, days: null, text: oneLine(c.text, 400) };
      if (kind.amount) {
        var a = whole(c.amount);
        if (a === null || a === 0) return { problem: 'Consequence ' + n + ' (' + kind.label + '): type the change as a whole number, not 0.' };
        if (a < kind.amount[0] || a > kind.amount[1]) return { problem: 'Consequence ' + n + ' (' + kind.label + '): the change must be from ' + signed(kind.amount[0]) + ' to ' + signed(kind.amount[1]) + '.' };
        out.amount = a;
      }
      if (kind.days !== 'none') {
        var blank = c.days === '' || c.days === undefined || c.days === null;
        if (blank && kind.days === 'required') return { problem: 'Consequence ' + n + ' (' + kind.label + '): type how many days it lasts.' };
        if (!blank) {
          var d = whole(c.days);
          if (d === null || d < 1 || d > DAYS_MAX) return { problem: 'Consequence ' + n + ' (' + kind.label + '): days must be a whole number from 1 to ' + DAYS_MAX + '.' };
          out.days = d;
        }
      }
      if (!kind.enforced && !out.text) return { problem: 'Consequence ' + n + ' (' + kind.label + '): say what it is, so it can be tracked.' };
      list.push(out);
    }
    return { fields: {
      title: title, clans: clans, day: day,
      situation: multiLine(f.situation, TEXT_MAX), decision: multiLine(f.decision, TEXT_MAX),
      outcome: multiLine(f.outcome, TEXT_MAX), notes: multiLine(f.notes, TEXT_MAX),
      consequences: list
    } };
  };

  function fillConsequences(rid, list) {
    return list.map(function (c, i) {
      return { id: rid + ':c' + (i + 1), kind: c.kind, clan: c.clan, amount: c.amount, days: c.days, text: c.text, status: 'pending', until: null };
    });
  }
  function note(r, day, text) {
    r.history.push({ day: day, text: oneLine(text, 400) });
    if (r.history.length > HISTORY_MAX) r.history = r.history.slice(-HISTORY_MAX);
  }

  /* ---------- Writing, editing, confirming ---------- */
  /* A new draft record. Returns { ok, record } or { ok: false, message }. */
  R.createDipRecord = function (s, data, fields, now) {
    var list = R.diplomaticRecords(s);
    if (list.length >= RECORDS_MAX) return { ok: false, message: 'The ledger is full (' + RECORDS_MAX + ' records).' };
    var chk = R.checkDipFields(s, data, fields);
    if (chk.problem) return { ok: false, message: chk.problem };
    var f = chk.fields;
    var n = Math.max(1, s.diplomaticRecords.next || 1);
    while (R.dipRecordById(s, makeId(n))) n++;
    var id = makeId(n);
    s.diplomaticRecords.next = n + 1;
    var r = {
      id: id, title: f.title, clans: f.clans, day: f.day,
      situation: f.situation, decision: f.decision, outcome: f.outcome, notes: f.notes,
      status: 'draft', createdDay: s.day, confirmedDay: null,
      history: [], consequences: fillConsequences(id, f.consequences)
    };
    note(r, s.day, 'Recorded as a draft.');
    list.push(r);
    return { ok: true, record: r };
  };
  /* Edit a draft. A record that is confirmed or dismissed can't be edited. */
  R.updateDipRecord = function (s, data, id, fields) {
    var r = R.dipRecordById(s, id);
    if (!r) return { ok: false, message: 'That record isn\'t in the ledger any more.' };
    if (r.status !== 'draft') return { ok: false, message: r.status === 'confirmed' ? 'A confirmed record can\'t be edited: add a note instead.' : 'A dismissed record can\'t be edited.' };
    var chk = R.checkDipFields(s, data, fields);
    if (chk.problem) return { ok: false, message: chk.problem };
    var f = chk.fields;
    r.title = f.title; r.clans = f.clans; r.day = f.day;
    r.situation = f.situation; r.decision = f.decision; r.outcome = f.outcome; r.notes = f.notes;
    r.consequences = fillConsequences(r.id, f.consequences);
    note(r, s.day, 'Edited.');
    return { ok: true, record: r };
  };
  /* What confirming does, in words, for the "are you sure?" and the log. */
  R.dipConsequenceLine = function (s, data, c) {
    var who = c.clan ? clanName(data, c.clan) : 'The Ironbow';
    var k = kindOf(c.kind);
    var why = c.text ? ' (' + c.text + ')' : '';
    var until = c.days ? ' for ' + c.days + (c.days === 1 ? ' day' : ' days') : '';
    if (c.kind === 'hr') return who + ': Honour & Respect ' + signed(c.amount) + why;
    if (c.kind === 'pc') return who + ': Political Capital ' + signed(c.amount) + why;
    if (!k) return c.text;
    return k.label + (c.clan ? ' (' + who + ')' : '') + ': ' + (c.text || '') + until + '. The DM tracks this: the Bastion does not enforce it.';
  };
  R.dipConfirmLines = function (s, data, r) {
    return r.consequences.map(function (c) { return R.dipConsequenceLine(s, data, c); });
  };
  /* Confirm a draft: the scores change, once, and the record is kept as
     confirmed. Returns { ok, lines } or { ok: false, message }. */
  R.confirmDipRecord = function (s, data, id, now) {
    var r = R.dipRecordById(s, id);
    if (!r) return { ok: false, message: 'That record isn\'t in the ledger any more.' };
    if (r.status === 'confirmed') return { ok: false, message: 'That record is already confirmed. Nothing was applied again.' };
    if (r.status !== 'draft') return { ok: false, message: 'A dismissed record can\'t be confirmed.' };
    var chk = R.checkDipFields(s, data, r);
    if (chk.problem) return { ok: false, message: chk.problem };
    r.status = 'confirmed';
    r.confirmedDay = s.day;
    var lines = [];
    r.consequences.forEach(function (c) {
      var k = kindOf(c.kind);
      c.appliedDay = s.day;
      if (c.kind === 'hr') {
        var res = R.adjustStanding(s, c.clan, c.amount);
        c.status = 'applied';
        if (res) { c.was = res.was; c.now = res.now; }
        lines.push(clanName(data, c.clan) + ': Honour & Respect ' + signed(res ? res.was : 0) + ' → ' + signed(res ? res.now : 0) + (c.text ? ' (' + c.text + ')' : ''));
      } else if (c.kind === 'pc') {
        if (!isObj(s.politicalCapital)) s.politicalCapital = {};
        var was = clampInt(s.politicalCapital[c.clan] || 0, -100, 100);
        var now2 = clampInt(was + c.amount, -100, 100);
        s.politicalCapital[c.clan] = now2;
        c.status = 'applied'; c.was = was; c.now = now2;
        lines.push(clanName(data, c.clan) + ': Political Capital ' + signed(was) + ' → ' + signed(now2) + (c.text ? ' (' + c.text + ')' : ''));
      } else {
        c.status = 'active';
        c.until = c.days ? s.day + c.days : null;
        lines.push(R.dipConsequenceLine(s, data, c).replace(/ The DM tracks this.*$/, '') + (c.until ? ' until ' + R.dayLabel(c.until) : '') + ' (DM-tracked)');
      }
    });
    note(r, s.day, 'Confirmed.' + (lines.length ? ' ' + lines.join('; ') : ''));
    R.log(s, 'Diplomatic Records', r.title + ' was confirmed' + (lines.length ? ': ' + lines.join('; ') + '.' : '.'), now);
    return { ok: true, lines: lines };
  };
  R.dismissDipRecord = function (s, id, now) {
    var r = R.dipRecordById(s, id);
    if (!r) return { ok: false, message: 'That record isn\'t in the ledger any more.' };
    if (r.status !== 'draft') return { ok: false, message: r.status === 'confirmed' ? 'A confirmed record can\'t be dismissed.' : 'That record is already dismissed.' };
    r.status = 'dismissed';
    note(r, s.day, 'Dismissed: nothing was applied.');
    R.log(s, 'Diplomatic Records', r.title + ' was dismissed: nothing was applied.', now);
    return { ok: true };
  };
  /* A note on any record, whatever its state. It changes nothing else. */
  R.addDipNote = function (s, id, text) {
    var r = R.dipRecordById(s, id);
    if (!r) return { ok: false, message: 'That record isn\'t in the ledger any more.' };
    var t = oneLine(text, NOTE_MAX);
    if (!t) return { ok: false, message: 'Type the note first.' };
    note(r, s.day, 'Note: ' + t);
    return { ok: true };
  };

  /* ---------- What a consequence is now ---------- */
  /* 'pending' (draft), 'applied' (a score, done), 'active', 'expired' (its
     last day has gone) or 'ended' (ended early by the DM). */
  R.dipConsequenceState = function (s, c) {
    if (!isObj(c)) return 'ended';
    if (c.status === 'pending' || c.status === 'applied' || c.status === 'ended') return c.status;
    if (typeof c.until === 'number' && s.day > c.until) return 'expired';
    return 'active';
  };
  /* End a lasting consequence early (story resolution). */
  R.endDipConsequence = function (s, data, recordId, consId, now) {
    var r = R.dipRecordById(s, recordId);
    var c = r ? r.consequences.filter(function (x) { return x.id === consId; })[0] : null;
    if (!c) return { ok: false, message: 'That consequence isn\'t in the ledger any more.' };
    var k = kindOf(c.kind);
    if (!k || k.enforced) return { ok: false, message: 'A change to a score is done once and can\'t be ended.' };
    var st = R.dipConsequenceState(s, c);
    if (st === 'ended') return { ok: false, message: 'That has already been ended.' };
    if (st === 'pending') return { ok: false, message: 'Confirm the record first.' };
    c.status = 'ended';
    c.endedDay = s.day;
    var line = k.label + (c.clan ? ' (' + clanName(data, c.clan) + ')' : '') + ': ' + (c.text || '') + ' ended early.';
    note(r, s.day, line);
    R.log(s, 'Diplomatic Records', r.title + ': ' + line, now);
    return { ok: true, line: line };
  };

  /* ---------- The Clan Relations summary ---------- */
  /* For each of the seven Clans: the Bastion's own Honour & Respect and
     Political Capital, and the DM-tracked restrictions, privileges and
     obligations still running. */
  R.clanRelations = function (s, data) {
    var out = clanList(data).map(function (c) {
      return {
        key: c.key, name: 'Clan ' + c.name,
        hr: clampInt((s.honourRespectByClan || {})[c.key] || 0, -5, 5),
        pc: clampInt((s.politicalCapital || {})[c.key] || 0, -100, 100),
        restrictions: [], privileges: [], obligations: []
      };
    });
    R.diplomaticRecords(s).forEach(function (r) {
      if (r.status !== 'confirmed') return;
      r.consequences.forEach(function (c) {
        var k = kindOf(c.kind);
        if (!k || k.enforced || !c.clan) return;
        if (R.dipConsequenceState(s, c) !== 'active') return;
        var row = out.filter(function (x) { return x.key === c.clan; })[0];
        if (!row) return;
        var item = { recordId: r.id, consId: c.id, title: r.title, text: c.text, until: c.until, kind: c.kind };
        if (c.kind === 'restriction') row.restrictions.push(item);
        else if (c.kind === 'privilege') row.privileges.push(item);
        else row.obligations.push(item);
      });
    });
    return out;
  };
  /* The same obligations and restrictions that name no Clan. */
  R.dipUnattached = function (s) {
    var out = [];
    R.diplomaticRecords(s).forEach(function (r) {
      if (r.status !== 'confirmed') return;
      r.consequences.forEach(function (c) {
        var k = kindOf(c.kind);
        if (!k || k.enforced || c.clan) return;
        if (R.dipConsequenceState(s, c) !== 'active') return;
        out.push({ recordId: r.id, consId: c.id, title: r.title, text: c.text, until: c.until, kind: c.kind });
      });
    });
    return out;
  };

  /* ---------- A day moved (Reset Travel) ---------- */
  R.shiftDiplomaticRecords = function (s, by) {
    var n = dayNum(by, 0);
    if (!n || !isObj(s.diplomaticRecords)) return;
    var mv = function (obj, key) { if (obj && typeof obj[key] === 'number') obj[key] += n; };
    (s.diplomaticRecords.list || []).forEach(function (r) {
      mv(r, 'day'); mv(r, 'createdDay'); mv(r, 'confirmedDay');
      (r.history || []).forEach(function (h) { mv(h, 'day'); });
      (r.consequences || []).forEach(function (c) { mv(c, 'until'); mv(c, 'appliedDay'); mv(c, 'endedDay'); });
    });
  };
}());
