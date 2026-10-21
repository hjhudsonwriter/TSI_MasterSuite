/* Scarlett Isles: Beast Handler — on the DM's laptop (BH-1b, with the writing of BH-2c).

   The companion as a tool in the suite. It takes the Bastion saved on this
   device, builds the chosen handler's snapshot from it (projection.js, which
   holds back everything a player shouldn't see) and draws it with the shared
   screens (view.js). Because this copy runs on the DM's own laptop, the
   "Viewing as" box lets the DM see the companion as any handler; a phone page
   (beasthandler.html) does not have it.

   Asking: a request is written to a small queue this tool keeps
   (tsi.beasthandler.queue). The Bastion's window reads it every couple of
   seconds, checks each request against its live save, applies it once and
   records a receipt in its own save (tools/beasthandler/bastion-link.js). This
   tool never changes the Bastion's save. If the Bastion's window is shut, the
   request waits; nothing starts until the Bastion accepts and saves it.

   The words are in model.js, the player's view of the Bastion in projection.js,
   Harry's tables in data/profile-tables.js, and the pictures in data/art-map.js. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var BH = TSI.beasthandler = TSI.beasthandler || {};

  var BASTION_KEY = 'tsi.bastion.state';
  var QUEUE_KEY = 'tsi.beasthandler.queue';
  var REFRESH_MS = 3000;
  var CHOICE_KEY = 'tsi.beasthandler.viewAs' + (TSI.space === 'test' ? '.test' : '');
  var DRAFT_KEY = 'tsi.beasthandler.meetDraft' + (TSI.space === 'test' ? '.test' : '');
  /* As long as the Bastion would still take a request (codes.js MAX_AGE_MS: 30 days). */
  var STALE_MS = 30 * 24 * 3600 * 1000;

  function readChoice() {
    try { var v = sessionStorage.getItem(CHOICE_KEY); return v === null ? undefined : v; } catch (e) { return undefined; }
  }
  function writeChoice(v) {
    try { sessionStorage.setItem(CHOICE_KEY, v); } catch (e) { /* this window just won't remember */ }
  }

  TSI.registerTool('beasthandler', {
    start: function (ctx) {
      var life = ctx.life;
      var R = TSI.bastion.rules;
      var P = BH.projection;
      var M = BH.model;
      var D = window.TSI_DATA;
      var data = { bastion: D.bastion, facilities: D.bastionFacilities, tools: D.bastionTools, events: D.bastionEvents, research: D.bastionResearch, goods: D.bastionGoods, commerce: D.bastionCommerce, courier: D.bastionCourier, creatures: D.bastionCreatures, warRoom: D.bastionWarRoom };

      var viewAs = readChoice();
      var queue = M.cleanQueue(ctx.store.get('queue', null));
      var cur = { snap: null, state: null, handlers: [], info: { ok: false }, problem: '', key: '' };
      var view = null;

      /* ---------- Reading the Bastion ---------- */
      /* Until the DM chooses a handler, only the directory shows (nobody's detail is open by default). */
      function viewing(handlers) {
        return viewAs === undefined ? '' : viewAs;
      }
      function read() {
        return TSI.store.fresh(BASTION_KEY, null).then(function (saved) {
          if (!saved || !R.isSave(saved) || R.isOldSave(saved)) return null;
          return R.fromSave(TSI.clone(saved), data);
        });
      }
      /* Every change re-reads the stored queue first and changes only what it means to, so two windows (or the
         Bastion taking answered requests out) never write over one another's. */
      function changeQueue(edit) {
        return TSI.store.fresh(QUEUE_KEY, null).then(function (stored) {
          var list = M.cleanQueue(stored).commands;
          var next = M.cleanQueue({ commands: edit(list) }).commands;
          queue.commands = next;
          if (JSON.stringify(next) !== JSON.stringify(list)) ctx.store.set('queue', { commands: next });
          return next;
        });
      }
      /* Requests the Bastion has answered (their receipt is in its save), and very old ones, leave the queue. */
      function prune(state) {
        if (!state) return;
        var done = state.beast && state.beast.done ? state.beast.done : {};
        var gone = function (c) { return Object.prototype.hasOwnProperty.call(done, c.id) || Date.now() - c.at >= STALE_MS; };
        if (!queue.commands.some(gone)) return;
        queue.commands = queue.commands.filter(function (c) { return !gone(c); });
        changeQueue(function (list) { return list.filter(function (c) { return !gone(c); }); });
      }
      function refresh() {
        /* The stored queue is adopted each time, so a request made in another window shows here too. */
        return Promise.all([read(), TSI.store.fresh(QUEUE_KEY, null).then(function (q) { return M.cleanQueue(q).commands; }, function () { return null; })]).then(function (both) {
          var state = both[0];
          if (!life.alive) return;
          if (both[1]) queue.commands = both[1];
          var next;
          if (!state) {
            next = { snap: null, state: null, handlers: [], info: { ok: false }, problem: '' };
          } else {
            prune(state);
            var handlers = P.handlers(state, data);
            var snap = P.build(state, data, viewing(handlers));
            next = { snap: snap, state: state, handlers: handlers, info: { ok: true, asOfLabel: snap.asOfLabel }, problem: '' };
          }
          next.key = JSON.stringify([next.snap, next.handlers, next.problem, queue.commands.map(function (c) { return c.id; })]);
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
      function labelFor(body) {
        var d = cur.snap && cur.snap.creatures[body.creature];
        if (!d) return '';
        if (body.type === 'profile.set') return d.name + ' (profile)';
        var a = d.orders.available.filter(function (o) { return o.fnId === body.payload.fnId; })[0];
        return d.name + ': ' + (a ? a.label : body.payload.fnId);
      }
      var host = {
        mode: 'laptop',
        life: life,
        snapshot: function () { return cur.snap; },
        problem: function () { return cur.problem; },
        syncOk: function () { return cur.info.ok; },
        syncLine: function () {
          var base = M.syncLine(cur.info);
          var waiting = queue.commands.length;
          return base + (waiting ? ' · ' + waiting + (waiting === 1 ? ' request is' : ' requests are') + ' waiting for the Bastion to pick up' : '');
        },
        /* The first meeting's choices live in this window only (they are working notes, not part of the saved suite). */
        drafts: {
          read: function () { try { var m = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } },
          write: function (m) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(m)); } catch (e) { /* this window just won't remember */ } }
        },
        handlerChoices: function () { return M.handlerChoices(cur.handlers); },
        viewing: function () { return viewing(cur.handlers); },
        setViewing: function (v) { viewAs = v; writeChoice(v); refresh(); },
        canSubmit: function () {
          if (!cur.snap || !cur.snap.handler) return 'Choose a handler first.';
          if (!cur.snap.campaign) return 'The Bastion needs to be opened once so it can link up with the Beast Handler.';
          return '';
        },
        /* Only the viewed handler's own waiting requests: another handler's request for the same beast (the DM may have handed it on) must not show on this page. */
        outbox: function (all) {
          var me = cur.snap && cur.snap.handler ? cur.snap.handler.id : '';
          return queue.commands.filter(function (c) { return all === true || (!!me && P.sameHandler(c.handler, me)); })
            .map(function (c) { return { id: c.id, type: c.type, creature: c.creature, fac: c.fac, label: c.label, at: c.at, payload: c.payload }; });
        },
        submit: function (body) {
          var why = host.canSubmit();
          if (why) return Promise.resolve({ ok: false, message: why });
          var cmd = {
            v: 1, id: 'c-' + TSI.hmac.randomId(24), campaign: cur.snap.campaign, handler: cur.snap.handler.id, creature: body.creature, fac: body.fac || '',
            type: body.type, view: body.view || '', label: labelFor(body), payload: body.payload, at: Date.now()
          };
          return changeQueue(function (list) { return list.concat([cmd]); }).then(function () { return { ok: true, id: cmd.id }; });
        }
      };

      view = BH.view.mount(ctx.root, host);
      view.render();
      refresh();
      life.setInterval(refresh, REFRESH_MS);
    },

    stop: function () { /* the lifecycle helper stops the timers; the queue is saved as it changes */ },

    validateImport: function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].key === 'tsi.beasthandler.queue' && !BH.model.cleanQueue(records[i].value).commands.length && records[i].value && records[i].value.commands && records[i].value.commands.length) {
          return 'This file\'s waiting requests aren\'t in the right form, so it wasn\'t imported. Nothing was changed.';
        }
      }
      return null;
    }
  });
}());
