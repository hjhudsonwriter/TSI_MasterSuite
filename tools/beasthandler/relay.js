/* Scarlett Isles: Beast Handler — the OPTIONAL online link: talking to the post box (S17, 22 October 2026).

   READ THIS FIRST. This file is completely dormant unless the settings file switches
   it on:
   1. tools/beasthandler/relay-config.js says enabled: true (it ships false) AND holds
      a database address (it ships empty). That is the only on-switch the player's
      phone page has, and a phone also has to have been linked with a QR code (or a
      pairing code) before it ever looks.
   2. In the Bastion, as well as 1, the DM has to press "Switch on" in the Beast
      Handler box (the switch is s.beast.onlineLink in the Bastion's save, off until
      pressed). The phone cannot see that switch.
   Until then nothing here makes a request of any kind: R.create() hands back null,
   and null means "do nothing". Nothing else in the suite can reach this file's
   network calls, and the one place that does is R.http() below, which also checks
   (on every request) that the settings file still says enabled: true with this
   address, so even a caller that bypasses R.create() sends nothing while it is off.

   What it is: a small "post box" at Google (a Firebase Realtime Database that Harry
   owns, in a project that is NOT the Knightly Treasures shop's) that keeps a player's
   phone up to date by itself. The Bastion puts the player's latest snapshot in a
   place named after a code worked out from the handler's secret, scrambled first
   (seal.js), so the post box holds only scrambled letters. The phone looks in its
   place every so often, unscrambles what it finds and checks it exactly like a pasted
   snapshot (link-rules.js, L.accept). docs/ONLINE-LINK-SETUP.md is the guide for
   setting the post box up.

   It talks to the database with plain web requests (fetch), not Google's library, so
   no library or code is ever loaded from the internet: only data is sent and fetched.
   fetch() is used ONLY here, ONLY for an https address that passed
   BH.link.cleanDatabaseUrl, never for a file on this computer (CLAUDE.md's rule
   against fetching local files is about those). Every request has a time limit and
   any failure is swallowed into a quiet "not just now"; nothing ever waits on it.

   Tests: the page used for tests (tests/harness.html, TSI.space 'test') never makes a
   request: it gets a stand-in kept in memory (R.standIn), as the Notice Board's shop
   link does (tools/quests/shop-link.js). And an automated browser (navigator.webdriver,
   which Playwright and Selenium set) may only use the made-up address
   "tsi-test-relay.invalid", so a test run can't reach a real database even if a real
   address is filled in. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};
  var R = ns.relay = {};

  R.TIMEOUT_MS = 8000;
  var CHAN_OK = /^[A-Za-z0-9_-]{32,64}$/;
  function L() { return ns.link; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function ok(extra) { return Promise.resolve(Object.assign({ ok: true }, extra || {})); }
  function no(why, extra) { return Promise.resolve(Object.assign({ ok: false, why: why }, extra || {})); }

  /* ---------- Whether the link is set up, and whether it may be used here ---------- */
  /* { ok, url }: the database address from relay-config.js, or ok false while it isn't set up. */
  R.config = function () {
    var url = L().configuredUrl();
    return { ok: !!url, url: url };
  };
  /* An automated browser (a test run) may only use the test address. */
  R.allowed = function (url) {
    var automated = false;
    try { automated = navigator.webdriver === true; } catch (e) { automated = false; }
    return !automated || L().isTestHost(url);
  };

  /* What a document in the post box must look like (the database's own rules say the same). */
  R.validDoc = function (doc) {
    if (!isObj(doc)) return false;
    var keys = Object.keys(doc).sort();
    return keys.length === 2 && keys[0] === 'd' && keys[1] === 't' && typeof doc.t === 'number' && isFinite(doc.t) && typeof doc.d === 'string' && doc.d.length < 120000;
  };

  /* ---------- The stand-in (memory), for tests ---------- */
  /* One shared in-memory post box for the page. online: false makes every request fail as if offline. */
  R.standIn = { docs: {}, log: [], online: true };

  /* A post box kept in memory, with the same checks the real database's rules make. */
  R.memory = function (store) {
    var st = store || { docs: {}, log: [], online: true };
    var closed = false;
    function note(method, path) { st.log.push({ method: method, path: path }); }
    function gate() { return closed ? 'closed' : (st.online === false ? 'offline' : ''); }
    var t = {
      kind: 'memory',
      store: st,
      putState: function (chan, doc) {
        var g = gate(); if (g) return no(g);
        if (!CHAN_OK.test(chan) || !R.validDoc(doc)) return no('refused', { status: 401 });
        note('PUT', '/tsi/state/' + chan);
        st.docs[chan] = JSON.parse(JSON.stringify(doc));
        return ok();
      },
      getState: function (chan) {
        var g = gate(); if (g) return no(g);
        if (!CHAN_OK.test(chan)) return no('refused', { status: 401 });
        note('GET', '/tsi/state/' + chan);
        return ok({ value: Object.prototype.hasOwnProperty.call(st.docs, chan) ? JSON.parse(JSON.stringify(st.docs[chan])) : null });
      },
      getStamp: function (chan) {
        var g = gate(); if (g) return no(g);
        if (!CHAN_OK.test(chan)) return no('refused', { status: 401 });
        note('GET', '/tsi/state/' + chan + '/t');
        return ok({ value: Object.prototype.hasOwnProperty.call(st.docs, chan) ? st.docs[chan].t : null });
      },
      deleteState: function (chan) {
        var g = gate(); if (g) return no(g);
        if (!CHAN_OK.test(chan)) return no('refused', { status: 401 });
        note('DELETE', '/tsi/state/' + chan);
        delete st.docs[chan];
        return ok();
      },
      /* The raw requests the self-test makes, answered as the real database's rules answer them. */
      raw: function (method, path, body) {
        var g = gate(); if (g) return no(g);
        note(method, path);
        var m = /^\/tsi\/state\/([A-Za-z0-9_-]+)\.json$/.exec(path);
        if (!m) return no('refused', { status: 401 });
        if (method === 'PUT') {
          if (!CHAN_OK.test(m[1]) || !R.validDoc(body)) return no('refused', { status: 401 });
          st.docs[m[1]] = JSON.parse(JSON.stringify(body));
          return ok({ value: null });
        }
        if (method === 'GET') return ok({ value: Object.prototype.hasOwnProperty.call(st.docs, m[1]) ? JSON.parse(JSON.stringify(st.docs[m[1]])) : null });
        if (method === 'DELETE') { delete st.docs[m[1]]; return ok({ value: null }); }
        return no('refused', { status: 401 });
      },
      close: function () { closed = true; }
    };
    return t;
  };

  /* ---------- The real post box: plain web requests to the configured address ---------- */
  R.http = function (base, life) {
    var closed = false;
    var inflight = [];

    function request(method, path, body) {
      if (closed || (life && !life.alive)) return no('closed');
      /* The settings file's on-switch, checked at the very last step: no enabled: true with this address, no request. */
      if (L().configuredUrl() !== base) return no('closed');
      if (typeof fetch !== 'function') return no('unsupported');
      return new Promise(function (resolve) {
        var finished = false;
        var ctl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = null;
        function finish(r) {
          if (finished) return;
          finished = true;
          if (timer !== null) window.clearTimeout(timer);
          var i = inflight.indexOf(ctl);
          if (i !== -1) inflight.splice(i, 1);
          resolve(r);
        }
        if (ctl) inflight.push(ctl);
        timer = window.setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e) { /* already over */ } } finish({ ok: false, why: 'timeout' }); }, R.TIMEOUT_MS);
        var opts = { method: method, mode: 'cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
        if (ctl) opts.signal = ctl.signal;
        if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers = { 'Content-Type': 'application/json' }; }
        var offlineNow = false;
        try { offlineNow = navigator.onLine === false; } catch (e) { offlineNow = false; }
        /* base was checked by BH.link.cleanDatabaseUrl: it is an https database address and nothing else. */
        fetch(base + path, opts).then(function (res) {
          if (res.status === 401 || res.status === 403) return finish({ ok: false, why: 'refused', status: res.status });
          if (!res.ok) return finish({ ok: false, why: 'error', status: res.status });
          if (res.status === 204) return finish({ ok: true, value: null });
          return res.text().then(function (text) {
            var value = null;
            try { value = text ? JSON.parse(text) : null; } catch (e) { return finish({ ok: false, why: 'badreply' }); }
            finish({ ok: true, value: value });
          }, function () { finish({ ok: false, why: 'network' }); });
        }, function () { finish({ ok: false, why: offlineNow ? 'offline' : 'network' }); });
      });
    }
    function statePath(chan, tail) { return '/tsi/state/' + chan + (tail || '') + '.json'; }

    var t = {
      kind: 'http',
      base: base,
      putState: function (chan, doc) {
        if (!CHAN_OK.test(chan) || !R.validDoc(doc)) return no('refused');
        return request('PUT', statePath(chan) + '?print=silent', doc);
      },
      getState: function (chan) { return CHAN_OK.test(chan) ? request('GET', statePath(chan)) : no('refused'); },
      getStamp: function (chan) { return CHAN_OK.test(chan) ? request('GET', statePath(chan, '/t')) : no('refused'); },
      deleteState: function (chan) { return CHAN_OK.test(chan) ? request('DELETE', statePath(chan) + '?print=silent') : no('refused'); },
      raw: function (method, path, body) { return request(method, path, body); },
      close: function () {
        closed = true;
        inflight.splice(0).forEach(function (c) { try { c.abort(); } catch (e) { /* already over */ } });
      }
    };
    if (life) life.onStop(function () { t.close(); });
    return t;
  };

  /* The transport to use, or null while the link isn't set up (or may not be used here). Asking for one makes no request. */
  R.create = function (life) {
    if (TSI.space === 'test') return R.memory(R.standIn);
    var c = R.config();
    if (!c.ok || !R.allowed(c.url)) return null;
    return R.http(c.url, life);
  };

  /* ---------- The DM's self-test ("Test the link") ---------- */
  /* Four checks on the real post box, in plain words. Needs the seal (seal.js) and a transport.
     Resolves { ok, checks: [{ id, ok, text }] }; it leaves nothing behind. */
  R.selfTest = function (transport, rand) {
    var S = ns.seal;
    var H = TSI.hmac;
    var secret = H.randomId(24, rand);
    var chan = S.chan(secret);
    var checks = [];
    function add(id, good, text) { checks.push({ id: id, ok: !!good, text: text }); }
    var plain = 'tsi-link-self-test';
    var reached = false;
    return S.seal(plain, secret, S.aadState(chan)).then(function (sealed) {
      return transport.putState(chan, { t: Date.now(), d: sealed }).then(function (put) {
        reached = put.ok;
        add('send', put.ok, put.ok ? 'This computer can put a scrambled test message in the post box.'
          : put.why === 'refused' ? 'The post box refused the test message. The safety rules are probably not published, or are not the ones in the guide. Paste them again.'
          : 'This computer could not reach the post box (' + (put.why === 'offline' ? 'no internet' : put.why === 'timeout' ? 'it took too long' : 'something went wrong') + '). Check the web address in relay-config.js and the internet.');
        return put.ok ? transport.getState(chan) : null;
      }).then(function (got) {
        if (got === null) { add('read', false, 'Skipped, because the test message could not be sent.'); return null; }
        if (!got.ok || !R.validDoc(got.value)) { add('read', false, 'The test message could not be read back.'); return null; }
        return S.open(got.value.d, secret, S.aadState(chan)).then(function (back) {
          add('read', back === plain, back === plain ? 'It was read back and unscrambled correctly.' : 'It came back but could not be unscrambled.');
        });
      }).then(function () {
        if (!reached) { add('list', false, 'Skipped, because the post box could not be reached.'); return null; }
        return Promise.all([transport.raw('GET', '/.json'), transport.raw('GET', '/tsi/state.json')]).then(function (lists) {
          var refused = lists.every(function (r) { return !r.ok && r.why === 'refused'; });
          add('list', refused, refused ? 'A stranger asking for a list of everything in the post box is refused.'
            : 'A stranger could list what is in the post box. The safety rules are not right: paste them again, and never choose test mode.');
        });
      }).then(function () {
        if (!reached) { add('junk', false, 'Skipped, because the post box could not be reached.'); return null; }
        return transport.raw('PUT', '/tsi/state/' + chan + '.json', { t: 1, d: 'x', extra: 1 }).then(function (junk) {
          var refused = !junk.ok && junk.why === 'refused';
          add('junk', refused, refused ? 'A stranger writing something of the wrong shape is refused.'
            : 'A stranger could write something of the wrong shape. The safety rules are not right: paste them again.');
        });
      }).then(function () {
        return reached ? transport.deleteState(chan) : null;
      }).then(function () {
        return { ok: checks.length === 4 && checks.every(function (c) { return c.ok; }), checks: checks };
      });
    }, function () {
      add('send', false, 'This browser can\'t scramble the test message, so the online link can\'t be used here.');
      return { ok: false, checks: checks };
    });
  };
}());
