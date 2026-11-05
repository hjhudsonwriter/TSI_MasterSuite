/* The Scarlett Isles: D&D Tool Suite — the table log, saved (the rules are in tablelog-rules.js).
   TSI.tablelog.add({ kind, ref, label, image, day }) puts one entry on the end; TSI.tablelog.endSession() writes the
   marker End session leaves; TSI.tablelog.all() reads the list. It is saved as tsi.tablelog.entries, so Back up everything
   and Restore hold it. It never throws: if the browser will not save, the entry is simply not kept. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var R = TSI.tablelogRules;
  var KEY = 'tsi.tablelog.' + R.KEY_NAME;

  /* The Explorer's day now (the recap counts the days travelled from one marker to the next), or null. */
  function explorerDay() {
    try {
      var ex = TSI.store.get('tsi.explorer.save', null);
      var d = ex && ex.travel ? Number(ex.travel.day) : NaN;
      return isFinite(d) ? Math.floor(d) : null;
    } catch (e) { return null; }
  }

  function read() { return TSI.store.fresh(KEY, null).then(function (raw) { return R.clean(raw); }, function () { return []; }); }

  function write(entry) {
    return read().then(function (list) {
      var next = R.add(list, entry);
      TSI.store.set(KEY, R.pack(next));
      return next;
    }).catch(function () { return []; });
  }

  TSI.tablelog = {
    KEY: KEY,
    all: read,
    add: function (entry) { var e = Object.assign({ at: Date.now() }, entry); return write(e); },
    /* End session: a marker, so "since last session" starts here. */
    endSession: function () { return write({ kind: 'session-end', at: Date.now(), label: 'Session ended', day: explorerDay() }); },
    sinceLastSession: function () { return read().then(R.sinceLastSession); }
  };
}());
