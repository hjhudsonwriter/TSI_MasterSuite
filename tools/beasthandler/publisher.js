/* Scarlett Isles: Beast Handler — the Bastion's side of the OPTIONAL online link (S17, 22 October 2026).

   Dormant unless the DM has pressed "Switch on" (s.beast.onlineLink) AND
   tools/beasthandler/relay-config.js says enabled: true and holds a database address
   (the settings file's enabled line is the master switch for the laptop and for every
   phone; "Switch on" is the laptop's own, extra switch). Until then its timer does one
   cheap check and goes back to sleep: no request of any kind is made, no snapshot is
   built, nothing is scrambled.

   When it is on, it keeps each linked player's phone up to date, in the background:
   - once when the Bastion opens (and once for a handler as soon as they have a QR
     link), it sends that handler's snapshot, scrambled (seal.js), to their place in
     the post box (relay.js);
   - after that it sends again only when what the player may see has CHANGED (it
     compares a fingerprint of the snapshot with the time it was made left out), at
     most once every ten seconds for each handler;
   - if the computer is offline or a send fails it carries on quietly and tries again
     after 5 seconds, then 15, then a minute, then every five minutes; the Bastion
     never waits for it and nothing is lost, because the next send carries everything;
   - when a handler's code is taken back it removes that handler's copy from the post
     box (if it can);
   - the DM's box shows one plain line of status (L.statusLine).
   It only works while the Bastion's window is open: that is the only place days pass.

   host: { state(): the live Bastion save, data, life }. opts (tests): { transport(life) →
   a transport or null, now(): the time in ms }. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};

  ns.publisher = {
    create: function (host, opts) {
      opts = opts || {};
      var now = opts.now || function () { return Date.now(); };
      var life = host.life;
      /* Maps, not plain objects: a handler may be named anything a player can type ("__proto__", "constructor"), and a plain
         object would silently lose such a handler (assigning to __proto__ does nothing), so its copy would never be sent or cleaned up. */
      var entries = new Map(); /* chan → { hash, lastAt, nextTry, failures, madeAt } */
      var known = new Map();   /* handler id → the chan we last published for them (so a code taken back can be cleaned up) */
      var transport = null;
      var busy = false;
      var forceAll = false;
      var lastAt = 0;          /* when anything was last sent */
      var lastState = 'idle';  /* the outcome of the latest attempt: idle, working, waiting, toolarge */
      var listeners = [];
      var sent = 0;

      function R() { return TSI.bastion.rules; }
      function link() { return ns.link; }
      function seal() { return ns.seal; }
      function onlineNow() { try { return navigator.onLine !== false; } catch (e) { return true; } }
      function liveState() { try { return host.state(); } catch (e) { return null; } }

      /* The status for the DM's box, worked out without any request. */
      function status() {
        var s = liveState();
        var url = link().configuredUrl();
        var st = { state: 'unset', lastAt: lastAt, sent: sent };
        if (!url) { if (!link().enabled() && link().addressFilled()) st.state = 'notenabled'; return st; }
        if (!s || !R().beastOnlineLink(s)) { st.state = 'off'; return st; }
        if (!seal().available()) { st.state = 'unsupported'; return st; }
        if (!onlineNow()) { st.state = 'offline'; return st; }
        st.state = busy ? 'working' : lastState;
        return st;
      }
      function changed() { var st = status(); listeners.slice().forEach(function (fn) { try { fn(st); } catch (e) { /* a screen that has gone */ } }); }

      function closeTransport() {
        if (transport) { try { transport.close(); } catch (e) { /* already closed */ } transport = null; }
      }
      function getTransport() {
        if (transport) return transport;
        transport = opts.transport ? opts.transport(life) : ns.relay.create(life);
        return transport;
      }

      /* Send one handler's snapshot. Resolves when the attempt is over, whatever happened. */
      function publish(chan, body, hash, entry) {
        var snap = body.snapshot;
        snap.madeAt = Math.max(now(), (entry.madeAt || 0) + 1);
        var code = ns.codes.encodeSnapshot(snap, body.secret);
        return seal().seal(code, body.secret, seal().aadState(chan)).then(function (sealed) {
          if (sealed.length > link().MAX_DOC_LETTERS) {
            entry.failures = (entry.failures || 0) + 1;
            entry.nextTry = now() + 300000;
            lastState = 'toolarge';
            return null;
          }
          return transport.putState(chan, { t: snap.madeAt, d: sealed }).then(function (r) {
            if (r.ok) {
              entry.hash = hash; entry.lastAt = now(); entry.madeAt = snap.madeAt; entry.failures = 0; entry.nextTry = 0;
              lastAt = entry.lastAt; sent++; lastState = 'idle';
            } else {
              entry.failures = (entry.failures || 0) + 1;
              entry.nextTry = now() + link().backoffMs(entry.failures);
              lastState = r.why === 'offline' ? 'offline' : 'waiting';
            }
          });
        }, function () {
          entry.failures = (entry.failures || 0) + 1;
          entry.nextTry = now() + link().backoffMs(entry.failures);
          lastState = 'waiting';
        });
      }

      /* One look: clean up taken-back codes, then send at most one handler's snapshot that is worth sending. */
      function tick() {
        var s = liveState();
        var url = link().configuredUrl();
        if (!s || !url || !R().beastOnlineLink(s)) {
          if (transport) { closeTransport(); changed(); }
          return Promise.resolve(status());
        }
        if (busy) return Promise.resolve(status());
        if (!seal().available() || !onlineNow()) { changed(); return Promise.resolve(status()); }
        if (!getTransport()) return Promise.resolve(status());
        var force = forceAll;
        forceAll = false;
        var handlers = (s.beast && Array.isArray(s.beast.handlers) ? s.beast.handlers : []).filter(function (h) { return h && h.secret; });
        var live = new Map();
        handlers.forEach(function (h) { live.set(h.id, seal().chan(h.secret)); });
        /* A code taken back or replaced: remove the old copy from the post box. */
        var stale = Array.from(known.keys()).filter(function (id) { return known.get(id) !== live.get(id); });
        var job = null;
        if (stale.length) {
          var id = stale[0];
          var old = known.get(id);
          busy = true;
          job = transport.deleteState(old).then(function (r) {
            if (r.ok || r.why === 'refused') { known.delete(id); entries.delete(old); }
          });
        } else {
          var now0 = now();
          for (var i = 0; i < handlers.length && !job; i++) {
            var h = handlers[i];
            var chan = live.get(h.id);
            var body = R().beastSnapshotBody(s, host.data, h.id);
            if (!chan || !body.ok) continue;
            var entry = entries.get(chan);
            if (!entry) { entry = {}; entries.set(chan, entry); }
            var hash = link().contentKey(body.snapshot);
            if (force) entry.nextTry = 0;
            if (link().shouldPublish(entry, hash, now0, force)) {
              busy = true;
              known.set(h.id, chan);
              job = publish(chan, body, hash, entry);
            } else {
              known.set(h.id, chan);
            }
          }
        }
        if (!job) return Promise.resolve(status());
        changed();
        return job.then(function () { busy = false; changed(); return status(); }, function () { busy = false; lastState = 'waiting'; changed(); return status(); });
      }

      /* "Send to phones now": send every linked handler's snapshot at the next look, changed or not. */
      function sendNow() {
        forceAll = true;
        return tick();
      }

      /* "Test the link": the four checks in relay.js, on the real post box. Only while the link is switched on. */
      function selfTest() {
        var s = liveState();
        if (!s || !R().beastOnlineLink(s) || !link().configuredUrl()) return Promise.resolve({ ok: false, checks: [{ id: 'off', ok: false, text: 'The online link is off. Switch it on first.' }] });
        if (!seal().available()) return Promise.resolve({ ok: false, checks: [{ id: 'send', ok: false, text: 'This browser can\'t scramble data, so the online link can\'t be used here.' }] });
        var t = getTransport();
        if (!t) return Promise.resolve({ ok: false, checks: [{ id: 'send', ok: false, text: 'The online link can\'t be used here.' }] });
        return ns.relay.selfTest(t);
      }

      /* Sleep, wake: the timer runs always but does nothing while the link is off. */
      var timer = life.setInterval(function () { tick(); }, opts.tickMs || link().TICK_MS);
      life.on(window, 'online', function () {
        entries.forEach(function (e) { e.nextTry = 0; });
        tick();
      });
      life.on(window, 'offline', function () { changed(); });
      life.onStop(function () { closeTransport(); listeners = []; });

      return {
        tick: tick,
        sendNow: sendNow,
        selfTest: selfTest,
        status: status,
        statusLine: function () { return link().statusLine(status(), now()); },
        onStatus: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
        /* For tests: what has been remembered about the posted copies (no secrets). known is a list of [handler id, place]. */
        debug: function () { return { known: Array.from(known.entries()), entries: Array.from(entries.entries()).map(function (kv) { return { chan: kv[0], hash: kv[1].hash || '', failures: kv[1].failures || 0, lastAt: kv[1].lastAt || 0 }; }), sent: sent, timer: timer !== null }; }
      };
    }
  };
}());
