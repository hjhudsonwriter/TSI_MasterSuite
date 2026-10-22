/* Scarlett Isles: Beast Handler — on the DM's laptop (BH-1b; read-only since 22 October 2026).

   The companion as a tool in the suite. It takes the Bastion saved on this
   device, builds the chosen handler's snapshot from it (projection.js, which
   holds back everything a player shouldn't see) and draws it with the shared
   screens (view.js). Because this copy runs on the DM's own laptop, the
   "Viewing as" box lets the DM see the companion as any handler; a phone page
   (beasthandler.html) does not have it.

   It only LOOKS. It never changes the Bastion's save and sends it nothing: the
   queue of requests this tool used to keep (tsi.beasthandler.queue) is gone, and
   an old one left in the browser is cleared away when this tool opens. It saves
   nothing of its own either: which beasts have had their first meeting shown in
   this window is kept for the window's session only (sessionStorage), like the
   "Viewing as" choice, so a DM trying the app out never marks a player's phone
   as having seen it.

   The words are in model.js, the player's view of the Bastion in projection.js,
   Harry's tables in data/profile-tables.js, and the pictures in data/art-map.js. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var BH = TSI.beasthandler = TSI.beasthandler || {};

  var BASTION_KEY = 'tsi.bastion.state';
  var OLD_QUEUE_KEY = 'tsi.beasthandler.queue';
  var REFRESH_MS = 3000;
  var SUFFIX = TSI.space === 'test' ? '.test' : '';
  var CHOICE_KEY = 'tsi.beasthandler.viewAs' + SUFFIX;
  var SEEN_KEY = 'tsi.beasthandler.seen' + SUFFIX;
  /* Kept by earlier versions of this tool, for the window's session only: cleared away. */
  var OLD_DRAFT_KEY = 'tsi.beasthandler.meetDraft' + SUFFIX;

  function readChoice() {
    try { var v = sessionStorage.getItem(CHOICE_KEY); return v === null ? undefined : v; } catch (e) { return undefined; }
  }
  function writeChoice(v) {
    try { sessionStorage.setItem(CHOICE_KEY, v); } catch (e) { /* this window just won't remember */ }
  }
  var memorySeen = {};   /* used only if the browser won't keep anything for this window */
  function readSeen() {
    try {
      var m = JSON.parse(sessionStorage.getItem(SEEN_KEY) || '{}');
      return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
    } catch (e) { return memorySeen; }
  }
  function writeSeen(m) {
    memorySeen = m;
    try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch (e) { /* this window just won't remember */ }
  }

  TSI.registerTool('beasthandler', {
    start: function (ctx) {
      var life = ctx.life;
      var R = TSI.bastion.rules;
      var P = BH.projection;
      var M = BH.model;
      var D = window.TSI_DATA;
      var data = { bastion: D.bastion, facilities: D.bastionFacilities, tools: D.bastionTools, events: D.bastionEvents, research: D.bastionResearch, goods: D.bastionGoods, commerce: D.bastionCommerce, courier: D.bastionCourier, creatures: D.bastionCreatures, warRoom: D.bastionWarRoom };

      /* The old request queue is never read by anything now: clear it away (and a working note the old first meeting kept). */
      try { TSI.store.remove(OLD_QUEUE_KEY); } catch (e) { /* nothing to clear */ }
      try { sessionStorage.removeItem(OLD_DRAFT_KEY); } catch (e) { /* nothing to clear */ }

      var viewAs = readChoice();
      var cur = { snap: null, state: null, handlers: [], info: { ok: false }, problem: '', key: '' };
      var view = null;

      /* ---------- Reading the Bastion ---------- */
      /* Until the DM chooses a handler, only the directory shows (nobody's detail is open by default). */
      function viewing() {
        return viewAs === undefined ? '' : viewAs;
      }
      function read() {
        return TSI.store.fresh(BASTION_KEY, null).then(function (saved) {
          if (!saved || !R.isSave(saved) || R.isOldSave(saved)) return null;
          return R.fromSave(TSI.clone(saved), data);
        });
      }
      function refresh() {
        return read().then(function (state) {
          if (!life.alive) return;
          var next;
          if (!state) {
            next = { snap: null, state: null, handlers: [], info: { ok: false }, problem: '' };
          } else {
            var handlers = P.handlers(state, data);
            var snap = P.build(state, data, viewing());
            next = { snap: snap, state: state, handlers: handlers, info: { ok: true, asOfLabel: snap.asOfLabel }, problem: '' };
          }
          next.key = JSON.stringify([next.snap, next.handlers, next.problem]);
          if (next.key === cur.key) return;
          cur = next;
          if (view) view.refresh();
        }, function (err) {
          if (!life.alive) return;
          var next = { snap: null, state: null, handlers: [], info: { ok: false }, problem: 'The Bastion save couldn\'t be read. ' + (err && err.message ? err.message : '') };
          next.key = JSON.stringify([next.problem]);
          if (next.key === cur.key) return;
          cur = next;
          if (view) view.refresh();
        });
      }

      /* ---------- What the shared screens ask of this host ---------- */
      var host = {
        mode: 'laptop',
        life: life,
        snapshot: function () { return cur.snap; },
        problem: function () { return cur.problem; },
        syncOk: function () { return cur.info.ok; },
        syncLine: function () { return M.syncLine(cur.info); },
        /* Which beasts' first meeting has been shown in this window (the window's session only, never saved). */
        seen: function () { return readSeen(); },
        markSeen: function (id) { var m = Object.assign({}, readSeen()); m[id] = true; writeSeen(m); },
        handlerChoices: function () { return M.handlerChoices(cur.handlers); },
        viewing: function () { return viewing(); },
        setViewing: function (v) { viewAs = v; writeChoice(v); refresh(); }
      };

      view = BH.view.mount(ctx.root, host);
      view.render();
      refresh();
      life.setInterval(refresh, REFRESH_MS);
      /* For the tests: look at the Bastion now, and reach the screens. */
      BH.debug = { refresh: function () { return refresh(); }, view: function () { return view; } };
      life.onStop(function () { BH.debug = null; });
    },

    stop: function () { /* the lifecycle helper stops the timers; nothing is saved */ }
  });
}());
