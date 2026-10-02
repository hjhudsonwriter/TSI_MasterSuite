/* The Scarlett Isles: D&D Tool Suite — "already open" warning.
   If the same tool is open in two tabs or windows, whichever saves last would
   overwrite the other's changes. Each open copy writes a small heartbeat to
   the browser's shared storage (tsi.suite.tabs) saying which tool it has
   open; if another copy's heartbeat is fresh and the two could clash, both
   show a warning. Player windows don't count.

   Two tabs clash when they have the same tool open, when either is on the
   home screen (its Restore and Back up everything cover every tool), or when
   the other tab doesn't say which tool it has open. Two different tools,
   such as the Bastion in one tab and the Crest in another, don't: each tool
   only saves its own names. The rule is TSI.storeRules.tabsClash.

   A tab keeps the same id when it reloads (it's kept in sessionStorage),
   so switching tools never sets off a false warning, and the new page's
   first heartbeat says which tool it has open now. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var rules = TSI.storeRules;
  var NAMES = rules.spaceNames(TSI.space);
  var KEY = NAMES.tabs;       /* the test page keeps its own list, so it never warns about the real suite */
  var ID_KEY = NAMES.tabId;
  var BEAT_MS = 2000;
  var STALE_MS = 7000;
  var notice = null;
  var shownText = '';
  var dismissedFor = '';
  var started = false;
  var myTool = null;          /* a tool id, '' for the home screen, null until start() says */

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

  /* This tab's heartbeat. A tab whose tool isn't known leaves "tool" out,
     so other tabs treat it as clashing with everything. */
  function entry(extra) {
    var e = { at: Date.now() };
    if (myTool !== null) e.tool = myTool;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }

  /* Every other live tab: [{ id, tool }], tool as TSI.storeRules.tabTool reads it. */
  function others(map, now) {
    return Object.keys(map).filter(function (id) {
      /* A tab that's just reloading is still counted, so its warning doesn't flicker. */
      return id !== myId && map[id] && now - map[id].at < STALE_MS;
    }).sort().map(function (id) {
      return { id: id, tool: rules.tabTool(map[id].tool) };
    });
  }

  /* The other live tabs that could overwrite this tab's saves, or the other way round. */
  function clashing(map, now) {
    return others(map, now).filter(function (o) { return rules.tabsClash(myTool, o.tool); });
  }

  function beat() {
    var map = read();
    var now = Date.now();
    Object.keys(map).forEach(function (id) {
      if (!map[id] || now - map[id].at > STALE_MS * 3) delete map[id];
    });
    map[myId] = entry();
    write(map);
    update(clashing(map, now));
  }

  var WARNING = 'The suite is also open in another tab or window. If both stay open, one can overwrite the other\'s saves. Close one of them.';

  /* The warning names what the other tab has open: "The Ironbow Bastion
     Manager is also open…" when every clashing tab has the same tool open,
     "The suite's home screen is also open…" when they're all on the home
     screen, and "The suite is also open…" otherwise. */
  function message(list) {
    var tools = [];
    list.forEach(function (o) { if (tools.indexOf(o.tool) === -1) tools.push(o.tool); });
    var what = null;
    if (tools.length === 1 && tools[0] === '') {
      what = 'The suite\'s home screen';
    } else if (tools.length === 1 && tools[0]) {
      var info = TSI.toolInfo(tools[0]);
      if (info) what = TSI.the(info.name, true);
    }
    return what ? what + WARNING.slice('The suite'.length) : WARNING;
  }

  function update(list) {
    if (!list.length) {
      if (notice) { notice.close(); notice = null; }
      shownText = '';
      dismissedFor = '';
      return;
    }
    /* Which tabs, and what each has open: a Dismiss lasts until this changes. */
    var signature = list.map(function (o) { return o.id + '=' + (o.tool === null ? '?' : o.tool); }).join(',');
    var text = message(list);
    if (notice && notice.node.isConnected) {
      if (text === shownText) return;
    } else if (dismissedFor === signature) {
      return;
    }
    shownText = text;
    /* The same id replaces a warning that's already showing, so its wording stays up to date. */
    notice = TSI.notify(text, {
      type: 'warn',
      title: 'Already open.',
      id: 'tsi-tabs',
      dismiss: false,
      actions: [{
        label: 'Dismiss',
        onClick: function () { dismissedFor = signature; notice = null; shownText = ''; }
      }]
    });
  }

  function check() { update(clashing(read(), Date.now())); }

  TSI.tabGuard = {
    id: myId,
    /* What this tab has open: a tool id, '' for the home screen, or null before start(). */
    tool: function () { return myTool; },
    /* Every other live tab of the suite (or of the test page), whatever it has open. */
    otherCount: function () { return others(read(), Date.now()).length; },
    /* The other live tabs that set off the warning. */
    clashCount: function () { return clashing(read(), Date.now()).length; },
    /* Called once by the shell, with the open tool's id ('' or null for the home screen).
       Called with nothing, the tab's tool isn't known, so it clashes with every other tab. */
    start: function (toolId) {
      if (started) return;
      started = true;
      myTool = rules.tabTool(toolId);
      beat();
      setInterval(beat, BEAT_MS);
      window.addEventListener('storage', function (event) {
        if (event.key === KEY) check();
      });
      /* On reload or close, mark this tab as closing so the next page (or other tabs) knows. */
      window.addEventListener('pagehide', function () {
        var map = read();
        map[myId] = entry({ closing: true });
        write(map);
      });
      window.addEventListener('pageshow', function (event) { if (event.persisted) beat(); });
    }
  };
}());
