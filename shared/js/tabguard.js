/* The Scarlett Isles: D&D Tool Suite — "already open" warning.
   If the suite is open in two tabs or windows, whichever saves last would
   overwrite the other's changes. Each open copy writes a small heartbeat to
   the browser's shared storage (tsi.suite.tabs); if another copy's heartbeat
   is fresh, both show a warning. Player windows don't count.

   A tab keeps the same id when it reloads (it's kept in sessionStorage),
   so switching tools never sets off a false warning. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var NAMES = TSI.storeRules.spaceNames(TSI.space);
  var KEY = NAMES.tabs;       /* the test page keeps its own list, so it never warns about the real suite */
  var ID_KEY = NAMES.tabId;
  var BEAT_MS = 2000;
  var STALE_MS = 7000;
  var notice = null;
  var dismissedFor = '';

  function read() {
    try {
      var map = JSON.parse(localStorage.getItem(KEY) || '{}');
      return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
    } catch (e) { return {}; }
  }

  function write(map) {
    try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) { /* can't warn without storage */ }
  }

  function newId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* Keep this tab's id across reloads, but not when a tab is duplicated
     (a duplicate copies sessionStorage, and the original is still beating). */
  function chooseId() {
    var id = null;
    try { id = sessionStorage.getItem(ID_KEY); } catch (e) { /* no session storage */ }
    var entry = id ? read()[id] : null;
    if (!id || (entry && !entry.closing && Date.now() - entry.at < STALE_MS)) id = newId();
    try { sessionStorage.setItem(ID_KEY, id); } catch (e) { /* ignore */ }
    return id;
  }

  var myId = chooseId();

  function others(map, now) {
    return Object.keys(map).filter(function (id) {
      /* A tab that's just reloading is still counted, so its warning doesn't flicker. */
      return id !== myId && map[id] && now - map[id].at < STALE_MS;
    }).sort();
  }

  function beat() {
    var map = read();
    var now = Date.now();
    Object.keys(map).forEach(function (id) {
      if (!map[id] || now - map[id].at > STALE_MS * 3) delete map[id];
    });
    map[myId] = { at: now };
    write(map);
    update(others(map, now));
  }

  function update(list) {
    var signature = list.join(',');
    if (!list.length) {
      if (notice) { notice.close(); notice = null; }
      dismissedFor = '';
      return;
    }
    if (notice && notice.node.isConnected) return;
    if (dismissedFor === signature) return;
    notice = TSI.notify('The suite is also open in another tab or window. If both stay open, one can overwrite the other\'s saves. Close one of them.', {
      type: 'warn',
      title: 'Already open.',
      id: 'tsi-tabs',
      dismiss: false,
      actions: [{
        label: 'Dismiss',
        onClick: function () { dismissedFor = signature; notice = null; }
      }]
    });
  }

  function check() { update(others(read(), Date.now())); }

  TSI.tabGuard = {
    id: myId,
    otherCount: function () { return others(read(), Date.now()).length; },
    start: function () {
      beat();
      setInterval(beat, BEAT_MS);
      window.addEventListener('storage', function (event) {
        if (event.key === KEY) check();
      });
      /* On reload or close, mark this tab as closing so the next page (or other tabs) knows. */
      window.addEventListener('pagehide', function () {
        var map = read();
        map[myId] = { at: Date.now(), closing: true };
        write(map);
      });
      window.addEventListener('pageshow', function (event) { if (event.persisted) beat(); });
    }
  };
}());
