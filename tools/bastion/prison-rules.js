/* The Ironbow Bastion Manager: the Prison Tower. Plain functions, no screen code, tested on
   tests/rules.html (tests/rules/prison.test.js). They add to the Bastion's rules
   (tools/bastion/rules.js), as temple-rules.js does.

   The Prison Tower (Harry, 26 October 2026) is a narrative device: a place where the party can
   send people they have captured, or people tied to a quest. It has three cells. The DM locks a
   prisoner up by hand: a name, the thread or quest they are tied to, a sentence of 7, 14, 21 or
   28 days, and (optionally) the conditions of their release. The sentence counts from the day
   of lock-up: a 7-day sentence locked up on Day 10 ends on Day 17. When it ends, the prisoner is
   released by the day passing (R.tickPrison, called once for each day by R.startDay) and the
   Ironbow sends word of it; the Explorer reads the end day from the saved Bastion
   (TSI.campaign.bastionComing), as it does for every other Bastion news. A prisoner can be
   interrogated (the DM says whether the check was passed; a pass lets the DM write what was
   discovered, kept on the prisoner) or released early (a reason is required). Nothing here has
   gold, costs or orders.

   Saved in s.prison = { cells: [cell|null, cell|null, cell|null], freed: [] }: a cell is
   { name, thread, days, conditions, lockedDay, endDay, notes: [{ day, text }] }. freed keeps the
   last few who left, for the record (nothing shows it yet).

   Under Repair: the sentences keep counting, so a prisoner is still released on the day, but the
   panel can't lock up, interrogate or release until the repair ends. The Tower can't be demolished
   while a cell is in use. Pure: no storage, no clock, no dice. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.bastion = TSI.bastion || {};
  var R = ns.rules;
  if (!R) return;
  var clampInt = R.clampInt;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function text(v, max) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''; }

  R.PRISON_ID = 'prison_tower';
  R.PRISON_NAME_MAX = 60;
  R.PRISON_THREAD_MAX = 120;
  R.PRISON_CONDITIONS_MAX = 200;
  R.PRISON_NOTE_MAX = 600;
  R.PRISON_FREED_MAX = 30;

  /* ---------- The data ---------- */
  R.prisonFac = function (data) { return data && arr(data.facilities).length ? R.facility(data, R.PRISON_ID) : null; };
  function block(data) {
    var f = R.prisonFac(data);
    return f && isObj(f.prison) ? f.prison : {};
  }
  R.prisonCellCount = function (data) { return clampInt(block(data).cells === undefined ? 3 : block(data).cells, 1, 6); };
  /* The sentences the DM can choose, in days. */
  R.prisonSentences = function (data) {
    var list = arr(block(data).sentences).filter(function (n) { return isNum(n) && n >= 1 && Math.floor(n) === n; });
    return list.length ? list : [7, 14, 21, 28];
  };

  /* ---------- The save ---------- */
  R.cleanPrisoner = function (src, today) {
    if (!isObj(src)) return null;
    var name = text(src.name, R.PRISON_NAME_MAX);
    if (!name) return null;
    var locked = isNum(src.lockedDay) ? Math.trunc(src.lockedDay) : today;
    var days = isNum(src.days) && src.days >= 1 ? Math.trunc(src.days) : 7;
    return {
      name: name,
      thread: text(src.thread, R.PRISON_THREAD_MAX),
      days: days,
      conditions: text(src.conditions, R.PRISON_CONDITIONS_MAX),
      lockedDay: locked,
      endDay: isNum(src.endDay) ? Math.trunc(src.endDay) : locked + days,
      notes: arr(src.notes).filter(isObj).map(function (n) {
        return { day: isNum(n.day) ? Math.trunc(n.day) : locked, text: text(n.text, R.PRISON_NOTE_MAX) };
      }).filter(function (n) { return n.text; })
    };
  };
  /* A save's prison with safe defaults: three cells (a saved list of another length is made the right length, an extra cell
     only dropped if it is empty) and the record of those freed. */
  R.cleanPrison = function (src, today, data) {
    var n = R.prisonCellCount(data);
    var cells = arr(isObj(src) ? src.cells : null).map(function (c) { return R.cleanPrisoner(c, today); });
    while (cells.length < n) cells.push(null);
    while (cells.length > n && !cells[cells.length - 1]) cells.pop();
    var freed = arr(isObj(src) ? src.freed : null).filter(isObj).map(function (f) {
      return { name: text(f.name, R.PRISON_NAME_MAX), thread: text(f.thread, R.PRISON_THREAD_MAX), day: isNum(f.day) ? Math.trunc(f.day) : today, early: f.early === true, reason: text(f.reason, 300),
        notes: arr(f.notes).filter(isObj).map(function (x) { return { day: isNum(x.day) ? Math.trunc(x.day) : today, text: text(x.text, R.PRISON_NOTE_MAX) }; }).filter(function (x) { return x.text; }) };
    }).filter(function (f) { return f.name; }).slice(-R.PRISON_FREED_MAX);
    return { cells: cells, freed: freed };
  };
  /* The saved cells, made if the save has none yet. */
  R.prison = function (s, data) {
    if (!isObj(s.prison) || !Array.isArray(s.prison.cells)) s.prison = R.cleanPrison(s.prison, s.day, data);
    return s.prison;
  };
  R.prisonBuilt = function (s, data) { return R.builtFacilityIds(s, data).indexOf(R.PRISON_ID) !== -1; };
  /* Who is held: [{ index, prisoner }] for each cell in use. */
  R.prisonHeld = function (s, data) {
    var out = [];
    R.prison(s, data).cells.forEach(function (c, i) { if (c) out.push({ index: i, prisoner: c }); });
    return out;
  };
  R.prisonDaysLeft = function (s, c) { return c ? Math.max(0, c.endDay - s.day) : 0; };
  /* The day a sentence ends: the lock-up day plus the sentence. */
  R.prisonEndDay = function (lockedDay, days) { return lockedDay + days; };

  /* Why the Tower's panel can't be used now ('' if it can): it must stand and not be Under Repair. */
  R.prisonBlocker = function (s, data) {
    if (!R.prisonBuilt(s, data)) return 'The Prison Tower isn\'t built yet.';
    var until = R.underRepair(s, R.PRISON_ID);
    if (until) return 'The Prison Tower is Under Repair until Day ' + until + '. The prisoners are safe and their sentences keep counting.';
    return '';
  };
  /* A blocker for something done to the prisoner in a cell. */
  function cellBlocker(s, data, index) {
    var why = R.prisonBlocker(s, data);
    if (why) return why;
    var c = R.prison(s, data).cells[index];
    return c ? '' : 'That cell is empty.';
  }

  /* ---------- Locking someone up ---------- */
  /* Checks what the DM typed. Returns '' or the first thing wrong. */
  R.prisonLockUpBlocker = function (s, data, index, f) {
    var why = R.prisonBlocker(s, data);
    if (why) return why;
    var p = R.prison(s, data);
    if (!isNum(index) || index < 0 || index >= p.cells.length || Math.floor(index) !== index) return 'There is no such cell.';
    if (p.cells[index]) return 'That cell already holds ' + p.cells[index].name + '.';
    f = isObj(f) ? f : {};
    if (!text(f.name, R.PRISON_NAME_MAX)) return 'Type the prisoner\'s name.';
    if (!text(f.thread, R.PRISON_THREAD_MAX)) return 'Type the thread or quest the prisoner is tied to.';
    if (R.prisonSentences(data).indexOf(Number(f.days)) === -1) return 'Choose a sentence of ' + R.prisonSentences(data).join(', ') + ' days.';
    return '';
  };
  /* f: { name, thread, days, conditions }. Returns { ok, name, endDay, log } or { ok: false, message }. */
  R.prisonLockUp = function (s, data, index, f) {
    var why = R.prisonLockUpBlocker(s, data, index, f);
    if (why) return { ok: false, message: why };
    var days = Number(f.days);
    var c = {
      name: text(f.name, R.PRISON_NAME_MAX), thread: text(f.thread, R.PRISON_THREAD_MAX), days: days, conditions: text(f.conditions, R.PRISON_CONDITIONS_MAX),
      lockedDay: s.day, endDay: R.prisonEndDay(s.day, days), notes: []
    };
    R.prison(s, data).cells[index] = c;
    return { ok: true, name: c.name, endDay: c.endDay, log: ['Prisoner Locked Up', c.name + ' is locked up for ' + R.daysText(days) + ' (' + R.dayLabel(c.lockedDay) + '): released on ' + R.dayLabel(c.endDay) + '. Thread: ' + c.thread + '.'] };
  };

  /* ---------- Releasing early ---------- */
  R.prisonReleaseBlocker = function (s, data, index, reason) {
    var why = cellBlocker(s, data, index);
    if (why) return why;
    return text(reason, 300).length < 3 ? 'Say why the party released them.' : '';
  };
  function free(s, data, index, early, reason) {
    var p = R.prison(s, data);
    var c = p.cells[index];
    p.cells[index] = null;
    p.freed.push({ name: c.name, thread: c.thread, day: s.day, early: early, reason: reason, notes: c.notes.slice() });
    while (p.freed.length > R.PRISON_FREED_MAX) p.freed.shift();
    return c;
  }
  R.prisonRelease = function (s, data, index, reason) {
    var why = R.prisonReleaseBlocker(s, data, index, reason);
    if (why) return { ok: false, message: why };
    var r = text(reason, 300);
    var c = free(s, data, index, true, r);
    return { ok: true, name: c.name, reason: r, line: c.name + ' is released early: ' + r, log: ['Prisoner Released', c.name + ' was released early on ' + R.dayLabel(s.day) + '. Reason: ' + r] };
  };

  /* ---------- Interrogating ---------- */
  /* The DM says whether the check (Intimidation, Persuasion or whatever was decided in play) was passed. The line is the
     notice. A pass leaves the DM to write what was discovered (R.prisonAddNote). */
  R.prisonInterrogate = function (s, data, index, passed) {
    var why = cellBlocker(s, data, index);
    if (why) return { ok: false, message: why };
    var c = R.prison(s, data).cells[index];
    return { ok: true, name: c.name, passed: passed === true, line: c.name + (passed === true ? ' starts talking.' : ' holds their tongue.') };
  };
  R.prisonNoteBlocker = function (s, data, index, note) {
    var why = cellBlocker(s, data, index);
    if (why) return why;
    return text(note, R.PRISON_NOTE_MAX).length < 1 ? 'Write what was discovered.' : '';
  };
  R.prisonAddNote = function (s, data, index, note) {
    var why = R.prisonNoteBlocker(s, data, index, note);
    if (why) return { ok: false, message: why };
    var c = R.prison(s, data).cells[index];
    var t = text(note, R.PRISON_NOTE_MAX);
    c.notes.push({ day: s.day, text: t });
    return { ok: true, name: c.name, log: ['Prisoner Interrogated', c.name + ' told the party something (' + R.dayLabel(s.day) + '): ' + t] };
  };

  /* ---------- Days ---------- */
  /* A day passes (R.startDay calls this once for each new day): everyone whose sentence has ended is released, once (the cell
     is emptied, so asked again nothing happens), and the Ironbow sends word. This works even while the Tower is Under Repair.
     Returns the lines said. */
  R.tickPrison = function (s, data) {
    var said = [];
    var p = R.prison(s, data);
    p.cells.forEach(function (c, i) {
      if (!c || c.endDay > s.day) return;
      free(s, data, i, false, '');
      var line = c.name + ' is released from the Prison Tower: their sentence is served.';
      R.addWord(s, line);
      said.push(line);
    });
    return said;
  };
  /* Reset Travel moved the Bastion's days by n: every day in the prison moves with it. */
  R.shiftPrison = function (s, n) {
    if (!isObj(s.prison)) return;
    var mv = function (o, k) { if (o && typeof o[k] === 'number') o[k] += n; };
    arr(s.prison.cells).forEach(function (c) {
      if (!isObj(c)) return;
      mv(c, 'lockedDay'); mv(c, 'endDay');
      arr(c.notes).forEach(function (x) { mv(x, 'day'); });
    });
    arr(s.prison.freed).forEach(function (f) { mv(f, 'day'); arr(f.notes).forEach(function (x) { mv(x, 'day'); }); });
  };
  /* The Tower stays while anyone is held in it. */
  R.prisonDemolishBlocker = function (s, data, facId) {
    if (facId !== R.PRISON_ID) return '';
    var n = R.prisonHeld(s, data).length;
    return n ? 'The Prison Tower holds ' + n + (n === 1 ? ' prisoner' : ' prisoners') + '. Release them (or wait for their sentences to end) before demolishing it.' : '';
  };
}());
