/* Scarlett Isles: Beast Handler — the phone's side of the OPTIONAL online link (S17, 22 October 2026).

   Dormant unless tools/beasthandler/relay-config.js holds a database address (it ships
   empty) AND the phone has been linked with a QR code (or a pairing code). While either
   is missing, start() does nothing at all: no timer, no listener, no request.

   When it is on, the phone looks in its own place in the post box (named by a code
   worked out from the pairing secret, relay.js) every 20 seconds while the page is
   showing, again whenever the page comes back to the front or the phone comes back
   online, and when the player presses "Check now". It first asks only for the time of
   the latest update (a few letters); only if that is new does it fetch the whole
   scrambled snapshot. It unscrambles it (seal.js) and gives it to
   BH.link.accept, which is the very same check a pasted snapshot code gets: the
   signature, the Bastion save, the handler, and a refusal of anything older than the
   snapshot already held. Anything that goes wrong (no internet, a slow answer, a
   damaged message) is a quiet "not just now": the phone keeps showing what it has.

   opts: { life, pairing(): the pairing or null, held(): the snapshot held or null,
           take(snapshot): called with a snapshot that is newer and valid,
           onStatus(st): called when the state changes, transport?: for tests }. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};

  ns.puller = {
    create: function (opts) {
      var life = opts.life;
      var transport = null;
      var busy = false;
      var started = false;
      var lastT = null;        /* the update time of the copy we last looked at */
      var timer = null;
      var offs = [];
      var st = { state: 'off', checkedAt: 0 };

      function link() { return ns.link; }
      function seal() { return ns.seal; }

      function set(state, extra) {
        st = Object.assign({ state: state, checkedAt: st.checkedAt }, extra || {});
        if (opts.onStatus) { try { opts.onStatus(st); } catch (e) { /* a screen that has gone */ } }
      }
      /* Is there anything to do at all? */
      function active() {
        return !!(link().configuredUrl() && opts.pairing() && seal().available());
      }
      function getTransport() {
        if (!transport) transport = opts.transport ? opts.transport(life) : ns.relay.create(life);
        return transport;
      }
      function stopTimers() {
        if (timer !== null) { life.clearInterval(timer); timer = null; }
        offs.splice(0).forEach(function (off) { off(); });
      }

      /* One look. force: fetch the whole copy even if its time hasn't moved ("Check now"). */
      function check(force) {
        if (!active()) return Promise.resolve(st);
        if (busy) return Promise.resolve(st);
        var pairing = opts.pairing();
        var chan = seal().chan(pairing.secret);
        var t = getTransport();
        if (!chan || !t) return Promise.resolve(st);
        busy = true;
        set('checking');
        function fail(why) { st.checkedAt = Date.now(); set(why === 'offline' ? 'offline' : 'trouble'); }
        return t.getStamp(chan).then(function (r) {
          if (!r.ok) return fail(r.why);
          st.checkedAt = Date.now();
          if (r.value === null || typeof r.value !== 'number') { set('empty'); return null; }
          if (!force && lastT === r.value) { set('ok'); return null; }
          return t.getState(chan).then(function (got) {
            if (!got.ok) return fail(got.why);
            var doc = got.value;
            if (doc === null) { set('empty'); return null; }
            if (!ns.relay.validDoc(doc)) { lastT = doc && doc.t; set('unreadable'); return null; }
            return seal().open(doc.d, pairing.secret, seal().aadState(chan)).then(function (code) {
              lastT = doc.t;
              if (code === null) { set('unreadable'); return null; }
              var held = opts.held();
              var res = link().accept(pairing, held, code);
              if (!res.ok) { set(res.older ? 'ok' : 'unreadable', { why: res.why }); return null; }
              if (!res.same) opts.take(res.snapshot);
              set('ok');
              return null;
            });
          });
        }).then(function () { busy = false; return st; }, function () { busy = false; set('trouble'); return st; });
      }

      function visible() { try { return document.visibilityState !== 'hidden'; } catch (e) { return true; } }

      /* Begin looking (does nothing while the link isn't set up or the phone isn't linked). Safe to call again. */
      function start() {
        if (started) stop();
        if (!active()) { set('off'); return; }
        started = true;
        lastT = null;
        timer = life.setInterval(function () { if (visible()) check(false); }, link().POLL_MS);
        offs.push(life.on(document, 'visibilitychange', function () { if (visible()) check(false); }));
        offs.push(life.on(window, 'online', function () { check(false); }));
        check(true);
      }
      function stop() {
        started = false;
        stopTimers();
        if (transport) { try { transport.close(); } catch (e) { /* already closed */ } transport = null; }
        busy = false;
        set('off');
      }
      life.onStop(function () { stopTimers(); if (transport) { try { transport.close(); } catch (e) { /* closed */ } transport = null; } });

      return {
        start: start,
        stop: stop,
        check: check,
        active: active,
        status: function () { return st; },
        /* For tests. */
        debug: function () { return { started: started, timer: timer !== null, lastT: lastT }; }
      };
    }
  };
}());
