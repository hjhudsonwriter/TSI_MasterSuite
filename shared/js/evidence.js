/* The Scarlett Isles: D&D Tool Suite — the Evidence Board, saved (the rules are in evidence-rules.js).
   Any window may change the board: the Explorer (for the players' window, and for {clue} cues), and the DM doc (Edit Evidence
   Board, also in its own pop-out window). So that two windows never overwrite each other, every change is read-fresh, applied,
   written and flushed, one at a time in this window; then the other windows are told (TSI.handoff 'evidence') and read it again.
   TSI.evidence.apply(change, meta) → Promise<{ state, note }>
     change(state) returns a new state, or { state, note }; meta: { log: true } notes a pinned note in the table log.
   TSI.evidence.read() → Promise<state> (a fresh board made from the seed if none is saved yet; nothing is written until a change)
   TSI.evidence.onChange(fn): fn(state) after this window or another changed the board. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var R = TSI.evidenceRules;
  var KEY = R.KEY;
  var listeners = [];
  var queue = Promise.resolve();
  var cached = null;

  function seed() { return (window.TSI_DATA && window.TSI_DATA.evidenceSeed) || { notes: [], prepared: [] }; }
  function fromRaw(raw) { return R.clean(raw) || R.fresh(seed()); }
  function day() {
    try {
      var ex = TSI.store.get('tsi.explorer.save', null);
      var d = ex && ex.travel ? Number(ex.travel.day) : NaN;
      return isFinite(d) ? Math.floor(d) : null;
    } catch (e) { return null; }
  }
  function tell(state) { cached = state; listeners.slice().forEach(function (fn) { try { fn(state); } catch (e) { TSI.reportError(e, 'the Evidence Board'); } }); }

  /* One change at a time across every window of the browser (a Web Lock works from a double-clicked file), so the Explorer's window and
     the DM doc's pop-out can never read the same board and each write back without the other's note. Without locks, this window's own
     queue still keeps its changes in order. */
  function exclusively(job) {
    var locks = window.navigator && window.navigator.locks;
    if (!locks || !locks.request) return job();
    return locks.request('tsi-evidence-board', function () { return job(); });
  }

  var api = TSI.evidence = {
    KEY: KEY,
    day: day,
    read: function () { return TSI.store.ready.then(function () { return TSI.store.fresh(KEY, null); }).then(fromRaw, function () { return cached || R.fresh(seed()); }); },
    /* The last state seen in this window (or a fresh board). */
    peek: function () { return cached || fromRaw(TSI.store.get(KEY, null)); },
    apply: function (change, meta) {
      meta = meta || {};
      var job = queue.then(function () {
        return exclusively(function () { return api.read().then(function (before) {
          var out = change(before);
          var next = out && out.state ? out.state : out;
          var note = out && out.state ? out.note : null;
          if (!next || JSON.stringify(next) === JSON.stringify(before)) { tell(before); return { state: before, note: null }; }
          TSI.store.set(KEY, next);
          return TSI.store.flush().then(function () {
            tell(next);
            TSI.handoff.write('evidence', { at: Date.now(), n: Math.random() });
            if (note && meta.log && TSI.tablelog) TSI.tablelog.add(R.logEntry(note, day()));
            return { state: next, note: note };
          });
        }); });
      }).catch(function (err) { TSI.reportError(err, 'saving the Evidence Board'); return { state: cached, note: null }; });
      queue = job;
      return job;
    },
    onChange: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    /* life: the tool's ctx.life, so the listener stops when the tool closes. Another window changed the board: read it again. */
    listen: function (life, fn) {
      /* Read at once and again a moment later: the other window's write may not be visible to this one for an instant after its ping. */
      function again(delay) {
        life.setTimeout(function () {
          api.read().then(function (s) { if (JSON.stringify(s) !== JSON.stringify(cached)) { cached = s; fn(s); } });
        }, delay);
      }
      TSI.handoff.listen(life, 'evidence', function () { api.read().then(function (s) { cached = s; fn(s); }); again(300); again(1200); });
    }
  };
}());
