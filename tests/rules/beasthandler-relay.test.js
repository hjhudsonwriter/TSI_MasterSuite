/* Scarlett Isles: Beast Handler — the OPTIONAL online link (S17, 22 October 2026): scrambling a snapshot (seal.js),
   the post box's address rules and the stand-in kept in memory (relay.js), what the Bastion sends and when
   (publisher.js), what a phone does with what it finds (puller.js), and that all of it is dormant unless the DM
   has set it up and switched it on. Nothing here reaches the network: the real post box is never used, the
   "web requests" are a fake fetch that only records, and the address is the made-up "tsi-test-relay.invalid". */
(function () {
  var BR = TSI.bastion.rules;
  var BH = TSI.beasthandler;
  var C = BH.codes;
  var L = BH.link;
  var S = BH.seal;
  var RL = BH.relay;
  var P = BH.projection;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
  var TEST_URL = 'https://' + L.TEST_HOST;
  var SECRET = 'abcdefghijkmnpqrstuvwxyz';

  function world() {
    var b = BR.defaultState(bdata);
    b.day = 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 400;
    b.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
    BR.ensureLevels(b, bdata);
    BR.beastState(b);
    return b;
  }
  /* The settings object is shared, so every test that fills it in puts it back. enabled is the file's on-switch (true unless a test says otherwise). */
  function withConfig(url, fn, enabled) {
    var was = window.TSI_DATA.beastRelay;
    var cfg = { databaseURL: url };
    if (enabled !== 'omit') cfg.enabled = enabled === undefined ? true : enabled;   /* 'omit': a settings file with no enabled line at all */
    window.TSI_DATA.beastRelay = cfg;
    function restore() { window.TSI_DATA.beastRelay = was; }
    var out;
    try { out = fn(); } catch (e) { restore(); throw e; }
    if (out && typeof out.then === 'function') return out.then(function (v) { restore(); return v; }, function (e) { restore(); throw e; });
    restore();
    return out;
  }
  /* Count anything that could leave the page while the body runs. */
  function watchNetwork(fn) {
    var calls = [];
    var saved = { fetch: window.fetch, open: XMLHttpRequest.prototype.open, beacon: navigator.sendBeacon, es: window.EventSource, ws: window.WebSocket };
    window.fetch = function (u) { calls.push('fetch ' + u); return Promise.reject(new Error('no network in tests')); };
    XMLHttpRequest.prototype.open = function (m, u) { calls.push('xhr ' + u); throw new Error('no network in tests'); };
    try { navigator.sendBeacon = function (u) { calls.push('beacon ' + u); return false; }; } catch (e) { /* read-only */ }
    window.EventSource = function (u) { calls.push('eventsource ' + u); throw new Error('no network in tests'); };
    window.WebSocket = function (u) { calls.push('websocket ' + u); throw new Error('no network in tests'); };
    function restore() {
      window.fetch = saved.fetch; XMLHttpRequest.prototype.open = saved.open;
      try { navigator.sendBeacon = saved.beacon; } catch (e) { /* read-only */ }
      window.EventSource = saved.es; window.WebSocket = saved.ws;
    }
    var out;
    try { out = fn(calls); } catch (e) { restore(); throw e; }
    if (out && typeof out.then === 'function') return out.then(function (v) { restore(); return calls; }, function (e) { restore(); throw e; });
    restore();
    return calls;
  }
  function digest(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) { return new Uint8Array(buf); });
  }
  /* A handler's world with a pairing, a publisher on a clock we control, and a post box in memory. */
  function setup(opts) {
    opts = opts || {};
    var b = world();
    BR.beastEnsurePaired(b, bdata, 'Mira');
    var secret = BR.beastSecret(b, 'mira');
    var store = { docs: {}, log: [], online: true };
    var clock = { t: 1000000 };
    var life = TSI.createLife('a test of the online link');
    var made = 0;
    var host = { state: function () { return b; }, data: bdata, life: life };
    var pub = BH.publisher.create(host, { tickMs: 3600000, now: function () { return clock.t; }, transport: function () { made++; return BH.relay.memory(store); } });
    return { b: b, secret: secret, chan: S.chan(secret), store: store, clock: clock, life: life, pub: pub, made: function () { return made; } };
  }

  group('Beast Handler: the optional online link (S17, 22 October 2026)');

  test('scrambling: the post box\'s place and the key are worked out from the secret, and the place cannot be turned back into it', function (t) {
    var chan = S.chan(SECRET);
    t.equal(chan.length, 43);
    t.ok(/^[A-Za-z0-9_-]{43}$/.test(chan));
    t.equal(S.chan(SECRET), chan, 'always the same');
    t.ok(S.chan('abcdefghijkmnpqrstuvwxyA') !== chan, 'another secret, another place');
    t.equal(chan.indexOf(SECRET), -1);
    ['', 'short', 'has space in it that is long', 'abcdefghijkmnpqrstuvwxy!', null, undefined, 5].forEach(function (v) { t.equal(S.chan(v), '', JSON.stringify(v)); });
    t.equal(S.keyBytes(SECRET).length, 32);
    t.equal(S.keyBytes('short'), null);
    t.ok(S.chan(SECRET) !== S.bytesToB64u(S.keyBytes(SECRET)), 'the place and the key are not the same thing');
    return digest('tsi-link-v1/chan/' + SECRET).then(function (d) {
      t.equal(S.bytesToB64u(d), chan, 'the place is the SHA-256 of the secret (checked against the browser\'s own)');
      return digest('tsi-link-v1/key/' + SECRET);
    }).then(function (d) {
      t.same(Array.prototype.slice.call(S.keyBytes(SECRET)), Array.prototype.slice.call(d), 'and the key too');
    });
  });

  test('scrambling works from a double-clicked file (this page is one): a snapshot goes in and comes out the same, in any language', function (t) {
    t.equal(S.available(), true, 'the browser offers crypto.subtle here');
    t.equal(window.location.protocol, 'file:', 'this page is a file');
    var text = 'BHS1.' + new Array(900).join('héllo wörld 🐉 日本語 ').slice(0, 20000);
    var chan = S.chan(SECRET);
    return S.seal(text, SECRET, S.aadState(chan)).then(function (sealed) {
      t.ok(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(sealed), 'URL-safe letters, iv then scrambled text');
      t.equal(sealed.split('.')[0].length, 16, '12 random bytes for the iv');
      t.equal(sealed.indexOf('wörld'), -1, 'the contents are not readable');
      t.equal(sealed.indexOf(SECRET), -1);
      return S.open(sealed, SECRET, S.aadState(chan)).then(function (back) { t.equal(back, text); });
    });
  });

  test('scrambling is tamper-proof: another secret, another place, a changed letter, a cut-short or made-up message all fail to open, and no two seals are alike', function (t) {
    var chan = S.chan(SECRET);
    var aad = S.aadState(chan);
    return S.seal('hello', SECRET, aad).then(function (a) {
      return S.seal('hello', SECRET, aad).then(function (b) {
        t.ok(a !== b, 'a fresh iv every time');
        var bits = a.split('.');
        var flip = function (s) { return s.slice(0, 5) + (s.charAt(5) === 'A' ? 'B' : 'A') + s.slice(6); };
        return Promise.all([
          S.open(a, 'abcdefghijkmnpqrstuvwxyA', aad),
          S.open(a, SECRET, S.aadState(S.chan('abcdefghijkmnpqrstuvwxyA'))),
          S.open(bits[0] + '.' + flip(bits[1]), SECRET, aad),
          S.open(flip(bits[0]) + '.' + bits[1], SECRET, aad),
          S.open(bits[0] + '.' + bits[1].slice(0, -4), SECRET, aad),
          S.open(a + '.x', SECRET, aad), S.open('', SECRET, aad), S.open('x.y', SECRET, aad), S.open(null, SECRET, aad), S.open(5, SECRET, aad),
          S.open('!!!!.????', SECRET, aad), S.open(bits[0] + '.' + bits[1].slice(0, 10), SECRET, aad),
          S.open(a, 'short', aad)
        ]).then(function (results) {
          t.same(results, results.map(function () { return null; }), 'none of them opens');
          return S.open(a, SECRET, aad).then(function (ok) { t.equal(ok, 'hello'); });
        });
      });
    });
  });

  test('the post box\'s stand-in (memory) makes the same checks as the real database\'s rules, and answers like it', function (t) {
    var m = RL.memory();
    var chan = S.chan(SECRET);
    var good = { t: 5, d: 'abc.def' };
    return m.putState(chan, good).then(function (r) {
      t.equal(r.ok, true);
      return Promise.all([m.getState(chan), m.getStamp(chan), m.getState(S.chan('abcdefghijkmnpqrstuvwxyA')), m.getStamp(S.chan('abcdefghijkmnpqrstuvwxyA'))]);
    }).then(function (r) {
      t.same(r[0], { ok: true, value: good });
      t.same(r[1], { ok: true, value: 5 });
      t.same([r[2].ok, r[2].value, r[3].value], [true, null, null], 'an empty place is null');
      return Promise.all([
        m.putState(chan, { t: 5, d: 'x', extra: 1 }), m.putState(chan, { t: '5', d: 'x' }), m.putState(chan, { t: 5, d: 7 }), m.putState(chan, { t: 5 }), m.putState(chan, { t: 5, d: new Array(120001).join('x') }),
        m.putState('short', good), m.putState('../etc', good), m.putState(chan, null), m.putState(chan, [1, 2]),
        m.getState('short'), m.deleteState('a/b'), m.raw('GET', '/.json'), m.raw('GET', '/tsi/state.json'), m.raw('GET', '/tsi/inbox.json'), m.raw('PUT', '/other/path.json', good), m.raw('PUT', '/tsi/state/' + chan + '.json', { t: 1, d: 'x', extra: 1 })
      ]);
    }).then(function (refusals) {
      t.ok(refusals.every(function (r) { return r.ok === false && r.why === 'refused'; }), JSON.stringify(refusals.map(function (r) { return r.why; })));
      return m.deleteState(chan);
    }).then(function () { return m.getState(chan); }).then(function (r) {
      t.equal(r.value, null, 'deleted');
      m.store.online = false;
      return m.putState(chan, good);
    }).then(function (r) {
      t.same([r.ok, r.why], [false, 'offline']);
      m.close();
      return m.getState(chan);
    }).then(function (r) { t.equal(r.why, 'closed'); });
  });

  test('the real transport (fetch) makes exactly the requests the database\'s rules expect, with no cookies, and turns every failure into a quiet answer', function (t) {
    var seen = [];
    var script = [];
    var saved = window.fetch;
    window.fetch = function (url, opts) {
      seen.push({ url: url, opts: opts });
      var next = script.shift();
      if (next instanceof Error) return Promise.reject(next);
      if (next === 'hang') return new Promise(function (_, rej) { opts.signal.addEventListener('abort', function () { rej(new Error('aborted')); }); });
      return Promise.resolve(new Response(next.body === undefined ? null : next.body, { status: next.status }));
    };
    var chan = S.chan(SECRET);
    var life = TSI.createLife('a test of the real transport');
    var tr = RL.http(TEST_URL, life);
    var was = RL.TIMEOUT_MS;
    /* The transport checks the settings file's on-switch on every request, so the file is made to say "on" for this test. */
    var wasConfig = window.TSI_DATA.beastRelay;
    window.TSI_DATA.beastRelay = { enabled: true, databaseURL: TEST_URL };
    function end() { window.fetch = saved; RL.TIMEOUT_MS = was; window.TSI_DATA.beastRelay = wasConfig; life.stop(); }
    script.push({ status: 204 }, { status: 200, body: '1234' }, { status: 200, body: JSON.stringify({ t: 3, d: 'a.b' }) }, { status: 200, body: 'null' }, { status: 204 },
      { status: 401, body: '{"error":"Permission denied"}' }, { status: 500 }, { status: 200, body: '{oops' }, new TypeError('Failed to fetch'));
    return tr.putState(chan, { t: 3, d: 'a.b' }).then(function (put) {
      t.equal(put.ok, true);
      return tr.getStamp(chan);
    }).then(function (stamp) {
      t.same([stamp.ok, stamp.value], [true, 1234]);
      return tr.getState(chan);
    }).then(function (got) {
      t.same(got.value, { t: 3, d: 'a.b' });
      return tr.getState(chan);
    }).then(function (empty) {
      t.same([empty.ok, empty.value], [true, null], 'nothing there');
      return tr.deleteState(chan);
    }).then(function (del) {
      t.equal(del.ok, true);
      t.same(seen.map(function (s) { return s.opts.method + ' ' + s.url; }), [
        'PUT ' + TEST_URL + '/tsi/state/' + chan + '.json?print=silent',
        'GET ' + TEST_URL + '/tsi/state/' + chan + '/t.json',
        'GET ' + TEST_URL + '/tsi/state/' + chan + '.json',
        'GET ' + TEST_URL + '/tsi/state/' + chan + '.json',
        'DELETE ' + TEST_URL + '/tsi/state/' + chan + '.json?print=silent'
      ]);
      t.ok(seen.every(function (s) { return s.opts.credentials === 'omit' && s.opts.cache === 'no-store' && s.opts.referrerPolicy === 'no-referrer' && s.opts.mode === 'cors'; }), 'no cookies, no caching, no referrer');
      t.equal(seen[0].opts.body, JSON.stringify({ t: 3, d: 'a.b' }));
      t.equal(seen[1].opts.body, undefined);
      t.ok(seen.every(function (s) { return s.url.indexOf('https://' + L.TEST_HOST + '/') === 0; }), 'only ever the configured address');
      return tr.getState(chan);
    }).then(function (refused) {
      t.same([refused.ok, refused.why, refused.status], [false, 'refused', 401]);
      return tr.getState(chan);
    }).then(function (err) {
      t.same([err.ok, err.why], [false, 'error']);
      return tr.getState(chan);
    }).then(function (bad) {
      t.same([bad.ok, bad.why], [false, 'badreply']);
      return tr.getState(chan);
    }).then(function (net) {
      t.same([net.ok, net.why], [false, 'network']);
      var before = seen.length;
      return Promise.all([tr.getState('short'), tr.getStamp('a/b'), tr.deleteState(''), tr.putState(chan, { t: 1 })]).then(function (r) {
        t.ok(r.every(function (x) { return x.why === 'refused'; }), 'a bad name or shape never even leaves');
        t.equal(seen.length, before);
      });
    }).then(function () {
      RL.TIMEOUT_MS = 40;
      script.push('hang');
      return tr.getState(chan);
    }).then(function (slow) {
      t.same([slow.ok, slow.why], [false, 'timeout'], 'a slow answer gives up');
      RL.TIMEOUT_MS = was;
      script.push('hang');
      var p = tr.getState(chan);
      tr.close();
      return p.then(function (r) { t.equal(r.ok, false); return tr.getState(chan); });
    }).then(function (closed) {
      t.equal(closed.why, 'closed', 'after closing nothing is sent');
      end();
    }, function (e) { end(); throw e; });
  });

  test('the post box is used only with a Firebase address in the settings AND not by an automated browser, except the made-up test address; asking for one sends nothing', function (t) {
    /* The suite now ships with Harry's real post box address (26 October 2026); this test is about empty settings. */
    return withConfig('', function () {
    var real = 'https://scarlett-isles-link-default-rtdb.firebaseio.com';
    var calls = watchNetwork(function () {
      t.equal(RL.config().ok, false, 'the shipped settings are empty');
      t.equal(RL.create(TSI.createLife('x')), null, 'so there is no post box to talk to');
      withConfig(real, function () {
        t.equal(RL.config().url, real);
        t.equal(RL.allowed(real), navigator.webdriver !== true, 'a test browser may not use a real address');
        t.equal(RL.allowed(TEST_URL), true);
        var life = TSI.createLife('y');
        var tr = RL.create(life);
        t.equal(tr === null, navigator.webdriver === true);
        if (tr) tr.close();
        life.stop();
      });
      withConfig(TEST_URL, function () {
        var life = TSI.createLife('z');
        var tr = RL.create(life);
        t.equal(tr.kind, 'http');
        t.equal(tr.base, TEST_URL);
        tr.close();
        life.stop();
      });
      withConfig('https://evil.example.com', function () { t.equal(RL.create(TSI.createLife('w')), null); });
    });
    t.same(calls, [], 'nothing was sent');
    }, false);
  });

  test('the sender is dormant: with the switch off, or the settings empty, it sends nothing, builds nothing and never even asks for a post box', function (t) {
    /* The suite now ships with Harry's real post box address (26 October 2026); this test is about empty settings. */
    return withConfig('', function () {
    var calls = [];
    return watchNetwork(function () {
      var w = setup();
      /* 1. Settings empty, switch off. */
      return w.pub.tick().then(function (st) {
        t.equal(st.state, 'unset');
        /* 2. Switch ON but settings empty: still nothing. */
        BR.setBeastOnlineLink(w.b, true);
        return w.pub.tick();
      }).then(function (st) {
        t.equal(st.state, 'unset', 'a switch with no address does nothing');
        BR.setBeastOnlineLink(w.b, false);
        /* 3. Settings filled, switch off: still nothing. */
        return withConfig(TEST_URL, function () { return w.pub.tick(); });
      }).then(function (st) {
        t.equal(st.state, 'off');
        t.equal(w.made(), 0, 'no post box was ever made');
        t.same(w.store.log, []);
        t.same(w.pub.debug().entries, []);
        w.life.stop();
      });
    }).then(function (c) { t.same(c, [], 'no fetch, no XMLHttpRequest, no EventSource, no WebSocket, no beacon'); });
    }, false);
  });

  test('switched on, the sender puts one scrambled copy for each linked handler in the post box, once, and the box holds nothing readable', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.beastEnsurePaired(w.b, bdata, 'Joss');
      BR.setBeastOnlineLink(w.b, true);
      return w.pub.tick().then(function (st) {
        t.equal(Object.keys(w.store.docs).length, 1, 'one copy so far: one handler is sent at each look');
        w.clock.t += 11000;
        return w.pub.tick();
      }).then(function () {
        t.equal(Object.keys(w.store.docs).length, 2, 'then the other');
        var joss = BR.beastSecret(w.b, 'joss');
        t.ok(w.store.docs[w.chan] && w.store.docs[S.chan(joss)]);
        var doc = w.store.docs[w.chan];
        t.same(Object.keys(doc).sort(), ['d', 't']);
        t.equal(typeof doc.t, 'number');
        var all = JSON.stringify(w.store.docs);
        /* Only letters and one full stop: none of the snapshot's own punctuation (quotes, braces, spaces) can be in it. */
        Object.keys(w.store.docs).forEach(function (c) { t.ok(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(w.store.docs[c].d), 'only scrambled letters'); });
        ['"handler"', '"creatures"', 'tsi.beasthandler.snapshot', 'BHS1.', ' ', w.secret, joss, BR.beastCampaignId(w.b)].forEach(function (word) { t.equal(all.indexOf(word.replace(/"/g, '\\"')), -1, 'not readable in the post box: ' + word); });
        return S.open(doc.d, w.secret, S.aadState(w.chan)).then(function (code) {
          t.equal(C.kind(code), 'snap');
          var d = C.decodeSnapshot(code, w.secret);
          t.equal(d.ok, true);
          t.equal(d.snapshot.handler.id, 'mira');
          t.equal(d.snapshot.madeAt, doc.t, 'the time on the outside is the time made');
          t.equal(JSON.stringify(d.snapshot).indexOf(w.secret), -1, 'no secret inside');
          return S.open(doc.d, joss, S.aadState(w.chan));
        }).then(function (other) {
          t.equal(other, null, 'another handler\'s key does not open it');
          w.life.stop();
        });
      });
    });
  });

  test('after the first send it sends again only when what the player may see has changed, never twice in ten seconds, and "Send to phones now" sends regardless', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.setBeastOnlineLink(w.b, true);
      var puts = function () { return w.store.log.filter(function (x) { return x.method === 'PUT'; }).length; };
      return w.pub.tick().then(function () {
        t.equal(puts(), 1, 'once at the start');
        var first = w.store.docs[w.chan].t;
        w.clock.t += 60000;
        return w.pub.tick().then(function () {
          t.equal(puts(), 1, 'a minute later and nothing changed: nothing sent');
          w.b.day = 11;
          w.clock.t += 3000;
          return w.pub.tick();
        }).then(function () {
          t.equal(puts(), 2, 'changed, and the last send was a minute ago: sent');
          t.ok(w.store.docs[w.chan].t > first, 'with a newer time');
          w.b.day = 12;
          w.clock.t += 3000;
          return w.pub.tick();
        }).then(function () {
          t.equal(puts(), 2, 'changed again, but only 3 seconds since the last send: it waits');
          w.clock.t += 8000;
          return w.pub.tick();
        }).then(function () {
          t.equal(puts(), 3, 'once the ten seconds are over the latest is sent');
          w.clock.t += 60000;
          return w.pub.sendNow();
        }).then(function () {
          t.equal(puts(), 4, 'Send now sends even though nothing changed');
          t.ok(w.pub.status().lastAt > 0);
          t.equal(w.pub.status().state, 'idle');
          t.ok(/Last sent/.test(w.pub.statusLine()));
          w.life.stop();
        });
      });
    });
  });

  test('every sent copy has a later time than the one before, even when two are made in the same moment', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.setBeastOnlineLink(w.b, true);
      var times = [];
      var step = Promise.resolve();
      for (var i = 0; i < 4; i++) {
        step = step.then(function () { return w.pub.sendNow(); }).then(function () { times.push(w.store.docs[w.chan].t); });
      }
      return step.then(function () {
        t.equal(times.length, 4);
        t.ok(times.every(function (x, i) { return i === 0 || x > times[i - 1]; }), JSON.stringify(times));
        w.life.stop();
      });
    });
  });

  test('a send that fails is quiet: the sender waits 5 seconds, then 15, then a minute, then five minutes, and tries again; nothing is lost; offline is its own answer', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.setBeastOnlineLink(w.b, true);
      var puts = function () { return w.store.log.filter(function (x) { return x.method === 'PUT'; }).length; };
      w.store.online = false;
      return w.pub.tick().then(function (st) {
        t.equal(st.state, 'offline');
        t.equal(puts(), 0);
        w.clock.t += 1000;
        return w.pub.tick();
      }).then(function () {
        t.equal(w.pub.debug().entries[0].failures, 1, 'it tried once and failed');
        w.clock.t += 3000;
        return w.pub.tick();
      }).then(function () {
        t.equal(w.pub.debug().entries[0].failures, 1, 'still waiting out the 5 seconds');
        w.clock.t += 3000;
        return w.pub.tick();
      }).then(function () {
        t.equal(w.pub.debug().entries[0].failures, 2, 'tried again after 5 s');
        w.clock.t += 14000;
        return w.pub.tick();
      }).then(function () {
        t.equal(w.pub.debug().entries[0].failures, 2, 'waiting 15 s now');
        w.store.online = true;
        w.clock.t += 2000;
        return w.pub.tick();
      }).then(function (st) {
        t.equal(Object.keys(w.store.docs).length, 1, 'and once the post box answers, the latest is there');
        t.equal(w.pub.debug().entries[0].failures, 0);
        t.equal(st.state, 'idle');
        w.life.stop();
      });
    });
  });

  test('while the computer reports it is offline the sender does not try at all', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.setBeastOnlineLink(w.b, true);
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: function () { return false; } });
      return w.pub.tick().then(function (st) {
        t.equal(st.state, 'offline');
        t.equal(w.made(), 0, 'no post box even asked for');
        t.same(w.store.log, []);
        delete navigator.onLine;
        w.life.stop();
      }, function (e) { delete navigator.onLine; throw e; });
    });
  });

  test('taking a code back removes that handler\'s copy from the post box; a new code is a new place; switching the link off stops everything', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.setBeastOnlineLink(w.b, true);
      return w.pub.tick().then(function () {
        t.equal(Object.keys(w.store.docs).length, 1);
        BR.beastRevoke(w.b, 'mira');
        w.clock.t += 20000;
        return w.pub.tick();
      }).then(function () {
        t.equal(Object.keys(w.store.docs).length, 0, 'the old copy is gone');
        t.same(w.pub.debug().known, [], 'and forgotten');
        BR.beastEnsurePaired(w.b, bdata, 'Mira');
        w.clock.t += 20000;
        return w.pub.tick();
      }).then(function () {
        var chan2 = S.chan(BR.beastSecret(w.b, 'mira'));
        t.ok(chan2 !== w.chan);
        t.same(Object.keys(w.store.docs), [chan2], 'a new place for the new code');
        BR.setBeastOnlineLink(w.b, false);
        w.store.log.length = 0;
        w.clock.t += 60000;
        return w.pub.tick();
      }).then(function (st) {
        t.equal(st.state, 'off');
        t.same(w.store.log, [], 'switched off: not a single request');
        w.life.stop();
      });
    });
  });

  test('a snapshot too big for the post box is not sent, and the DM is told', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.setBeastOnlineLink(w.b, true);
      var was = L.MAX_DOC_LETTERS;
      L.MAX_DOC_LETTERS = 100;
      return w.pub.tick().then(function (st) {
        L.MAX_DOC_LETTERS = was;
        t.equal(st.state, 'toolarge');
        t.same(w.store.docs, {});
        t.ok(/too big/.test(L.statusLine(st, 0)));
        w.life.stop();
      }, function (e) { L.MAX_DOC_LETTERS = was; throw e; });
    });
  });

  test('"Test the link" makes the four checks on a post box set up the right way, leaves nothing behind, and says which fails when it is not', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.setBeastOnlineLink(w.b, true);
      return w.pub.selfTest().then(function (r) {
        t.equal(r.ok, true, JSON.stringify(r));
        t.same(r.checks.map(function (c) { return c.id; }), ['send', 'read', 'list', 'junk']);
        t.ok(r.checks.every(function (c) { return c.ok && c.text.length > 10; }));
        t.same(w.store.docs, {}, 'the test message was cleared away');
        /* A post box left in test mode (anyone can list it and write anything): the two safety checks fail. */
        var open = RL.memory(w.store);
        open.raw = function (method, path, body) { return Promise.resolve({ ok: true, value: method === 'GET' ? { x: 1 } : null }); };
        return RL.selfTest(open);
      }).then(function (r) {
        t.equal(r.ok, false);
        t.same(r.checks.map(function (c) { return c.ok; }), [true, true, false, false]);
        t.ok(/never choose test mode/.test(r.checks[2].text));
        w.store.online = false;
        return RL.selfTest(RL.memory(w.store));
      }).then(function (r) {
        t.same(r.checks.map(function (c) { return c.ok; }), [false, false, false, false], 'offline: all four fail');
        t.ok(/no internet/.test(r.checks[0].text));
        t.ok(/Skipped/.test(r.checks[2].text), 'the safety checks say they were skipped rather than blaming the rules');
        BR.setBeastOnlineLink(w.b, false);
        return w.pub.selfTest();
      }).then(function (r) {
        t.equal(r.ok, false);
        t.ok(/off/.test(r.checks[0].text), 'switched off, the test does not touch the network');
        w.life.stop();
      });
    });
  });

  test('closing the Bastion stops the sender: its timer, its post box and anything in flight go with the tool\'s life, so nothing can send afterwards', function (t) {
    return withConfig(TEST_URL, function () {
      var b = world();
      BR.beastEnsurePaired(b, bdata, 'Mira');
      BR.setBeastOnlineLink(b, true);
      var store = { docs: {}, log: [], online: true };
      var life = TSI.createLife('a test of closing');
      var made = [];
      BH.publisher.create({ state: function () { return b; }, data: bdata, life: life }, { tickMs: 20, transport: function () { var m = RL.memory(store); made.push(m); return m; } });
      return new Promise(function (resolve) { setTimeout(resolve, 400); }).then(function () {
        t.ok(store.log.length >= 1, 'while the tool is open it sends: ' + store.log.length);
        life.stop();
        var n = store.log.length;
        BR.beastEnsurePaired(b, bdata, 'Joss');
        b.day = 20;
        return new Promise(function (resolve) { setTimeout(resolve, 400); }).then(function () {
          t.equal(store.log.length, n, 'after it closes nothing more is sent, whatever changes');
          return made[0].getState(S.chan(BR.beastSecret(b, 'mira')));
        });
      }).then(function (r) { t.equal(r.why, 'closed', 'and the post box connection is closed'); });
    });
  });

  test('handlers named after the language\'s own words (__proto__, constructor, toString) are published, kept apart and cleaned up like any other handler', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();   /* Mira is paired already */
      var odd = ['__proto__', 'constructor', 'toString'];
      odd.forEach(function (name) { t.equal(BR.beastEnsurePaired(w.b, bdata, name).ok, true, name + ' can be paired'); });
      t.equal(w.b.beast.handlers.length, 4, 'four handlers, none lost');
      t.equal(BR.fromSave(JSON.parse(JSON.stringify(BR.toSave(w.b))), bdata).beast.handlers.length, 4, 'and all four survive saving and loading');
      var chans = new Map();   /* a Map: the test would hit the very bug it is checking for with a plain object */
      var names = ['mira'].concat(odd);
      names.forEach(function (n) { chans.set(n, S.chan(BR.beastSecret(w.b, n))); t.ok(/^[A-Za-z0-9_-]{43}$/.test(chans.get(n)), n + ' has a place of its own'); });
      t.equal(new Set(Array.from(chans.values())).size, 4, 'four different places');
      BR.setBeastOnlineLink(w.b, true);
      function sendAll(n) {
        var chain = Promise.resolve();
        for (var i = 0; i < n; i++) chain = chain.then(function () { w.clock.t += 11000; return w.pub.tick(); });
        return chain;
      }
      return sendAll(6).then(function () {
        var have = Object.keys(w.store.docs).sort();
        t.same(have, names.map(function (n) { return chans.get(n); }).sort(), 'every one of the four copies is in the post box');
        t.equal(w.pub.debug().known.length, 4, 'and all four are remembered, by name');
        t.same(w.pub.debug().known.map(function (kv) { return kv[0]; }).sort(), ['__proto__', 'constructor', 'mira', 'tostring'], 'under their own names (a handler id is lower-case)');
        t.equal(w.pub.debug().entries.length, 4);
        var sentBefore = w.pub.debug().sent;
        return sendAll(3).then(function () { t.equal(w.pub.debug().sent, sentBefore, 'nothing changed, so nothing is sent again'); });
      }).then(function () {
        names.forEach(function (n) { BR.beastRevoke(w.b, n); });
        return sendAll(8);
      }).then(function () {
        t.same(Object.keys(w.store.docs), [], 'every taken-back code had its copy removed, including the odd names');
        t.same(w.pub.debug().known, [], 'and none is remembered');
        t.equal(w.pub.debug().entries.length, 0);
        BR.beastEnsurePaired(w.b, bdata, '__proto__');
        return sendAll(2);
      }).then(function () {
        t.same(Object.keys(w.store.docs), [S.chan(BR.beastSecret(w.b, '__proto__'))], 'a new pairing for __proto__ is sent to a new place');
        w.life.stop();
      });
    });
  });

  test('a link is told apart from a snapshot code when pasted', function (t) {
    var link = L.buildLink('', { campaign: 'CAMPAIGN12345678', handler: 'mira', name: 'Mira', secret: SECRET });
    t.equal(C.looksLikeLink(link), true);
    t.equal(C.looksLikeLink('#L1.a.b.c'), true);
    t.equal(C.looksLikeLink('L1.a.b.c'), true);
    t.equal(C.looksLikeLink('pair=BHP1.abc'), true);
    t.equal(C.looksLikeLink('BHP1.abc.def'), false);
    t.equal(C.looksLikeLink('BHS1.abc.def'), false);
    t.equal(C.looksLikeLink('hello there'), false);
    t.equal(C.looksLikeLink(null), false);
  });

  test('a phone looks for a new copy, takes only one that opens, belongs to it and is newer, and keeps quiet when something is wrong', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.setBeastOnlineLink(w.b, true);
      var pairing = { campaign: BR.beastCampaignId(w.b), handler: 'mira', name: 'Mira', secret: w.secret };
      var held = null;
      var taken = [];
      var lifeP = TSI.createLife('a phone');
      var puller = BH.puller.create({
        life: lifeP, pairing: function () { return pairing; }, held: function () { return held; },
        take: function (snap) { held = snap; taken.push(snap); },
        transport: function () { return RL.memory(w.store); }
      });
      return puller.check(false).then(function (st) {
        t.equal(taken.length, 0);
        t.equal(st.state, 'empty', 'nothing published yet');
        return w.pub.tick();
      }).then(function () {
        return puller.check(false);
      }).then(function (st) {
        t.equal(st.state, 'ok');
        t.equal(taken.length, 1, 'it took the first copy');
        t.equal(taken[0].handler.id, 'mira');
        var before = w.store.log.length;
        return puller.check(false).then(function () {
          var added = w.store.log.slice(before).map(function (x) { return x.method + ' ' + x.path.split('/').pop(); });
          t.same(added, ['GET t'], 'the next look asks only for the time, and finds nothing new');
          t.equal(taken.length, 1);
          return puller.check(true);
        }).then(function () {
          t.equal(taken.length, 1, 'Check now fetches it again but it is the very same copy: no change');
          w.b.day = 12;
          w.clock.t += 20000;
          return w.pub.tick();
        });
      }).then(function () { return puller.check(false); }).then(function () {
        t.equal(taken.length, 2, 'a changed copy is taken');
        t.equal(taken[1].asOfDay, 12);
        /* A rollback: an older copy put back in the box is refused. */
        var older = Object.assign({}, taken[0], { madeAt: taken[0].madeAt - 5000 });
        return S.seal(C.encodeSnapshot(older, w.secret), w.secret, S.aadState(w.chan)).then(function (sealed) {
          w.store.docs[w.chan] = { t: taken[1].madeAt + 1, d: sealed };
          return puller.check(false);
        });
      }).then(function (st) {
        t.equal(taken.length, 2, 'an older copy is not taken');
        t.equal(held.asOfDay, 12, 'and the phone still shows the newer one');
        /* A copy scrambled with another key, a changed copy, a made-up one. */
        return S.seal('BHS1.x.y', 'abcdefghijkmnpqrstuvwxyA', S.aadState(w.chan)).then(function (sealed) {
          w.store.docs[w.chan] = { t: taken[1].madeAt + 2, d: sealed };
          return puller.check(false);
        });
      }).then(function (st) {
        t.equal(st.state, 'unreadable', 'another key: the phone says it couldn\'t read it');
        w.store.docs[w.chan] = { t: taken[1].madeAt + 3, d: 'not.real' };
        return puller.check(false);
      }).then(function (st) {
        t.equal(st.state, 'unreadable');
        w.store.docs[w.chan] = { t: taken[1].madeAt + 4, d: 'x', extra: 1 };
        return puller.check(false);
      }).then(function (st) {
        t.equal(st.state, 'unreadable', 'a document of the wrong shape');
        t.equal(taken.length, 2);
        w.store.online = false;
        return puller.check(true);
      }).then(function (st) {
        t.equal(st.state, 'offline');
        t.equal(held.asOfDay, 12, 'offline: it keeps what it has');
        w.life.stop();
        lifeP.stop();
      });
    });
  });

  test('a snapshot sealed for someone else, or for another place, is not taken by this phone even though it opens for its own key', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.beastEnsurePaired(w.b, bdata, 'Joss');
      BR.setBeastOnlineLink(w.b, true);
      var joss = BR.beastSecret(w.b, 'joss');
      var jossCode = BR.beastSnapshotCode(w.b, bdata, 'joss').code;
      var taken = [];
      var lifeP = TSI.createLife('a phone');
      var miraPairing = { campaign: BR.beastCampaignId(w.b), handler: 'mira', name: 'Mira', secret: w.secret };
      var puller = BH.puller.create({ life: lifeP, pairing: function () { return miraPairing; }, held: function () { return null; }, take: function (s) { taken.push(s); }, transport: function () { return RL.memory(w.store); } });
      /* Joss's snapshot sealed with Mira's own key and place (someone who knew Mira's key tried to give her Joss's beasts). */
      return S.seal(jossCode, w.secret, S.aadState(w.chan)).then(function (sealed) {
        w.store.docs[w.chan] = { t: 5, d: sealed };
        return puller.check(false);
      }).then(function (st) {
        t.equal(taken.length, 0, 'Joss\'s snapshot, signed with Joss\'s secret, is refused on Mira\'s phone');
        t.equal(st.state, 'unreadable');
        /* Mira's own snapshot copied into another place: the place is part of the seal, so it does not open there. */
        var mine = BR.beastSnapshotCode(w.b, bdata, 'mira').code;
        return S.seal(mine, w.secret, S.aadState(S.chan(joss))).then(function (sealed) {
          w.store.docs[w.chan] = { t: 6, d: sealed };
          return puller.check(false);
        });
      }).then(function (st) {
        t.equal(taken.length, 0);
        t.equal(st.state, 'unreadable');
        lifeP.stop(); w.life.stop();
      });
    });
  });

  test('the phone\'s side is dormant too: with the settings empty, or no link, start() makes no timer, no listener and no request', function (t) {
    /* The suite now ships with Harry's real post box address (26 October 2026); this test is about empty settings. */
    return withConfig('', function () {
    var made = 0;
    var life = TSI.createLife('a phone');
    var pairing = { campaign: 'CAMPAIGN12345678', handler: 'mira', name: 'Mira', secret: SECRET };
    var current = null;
    var puller = BH.puller.create({ life: life, pairing: function () { return current; }, held: function () { return null; }, take: function () {}, transport: function () { made++; return RL.memory(); } });
    var calls = watchNetwork(function () {
      current = pairing;
      puller.start();
      t.equal(puller.active(), false, 'settings empty: nothing to do');
      t.same(puller.debug(), { started: false, timer: false, lastT: null });
      return puller.check(true).then(function (st) {
        t.equal(st.state, 'off');
        t.equal(made, 0);
        return withConfig(TEST_URL, function () {
          current = null;
          puller.start();
          t.equal(puller.active(), false, 'not linked: nothing to do');
          t.equal(puller.debug().timer, false);
          return puller.check(true);
        });
      }).then(function () {
        t.equal(made, 0, 'no post box was ever made');
        return withConfig(TEST_URL, function () {
          current = pairing;
          puller.start();
          t.equal(puller.active(), true, 'set up and linked: it runs');
          t.equal(puller.debug().timer, true);
          puller.stop();
          t.equal(puller.debug().timer, false, 'and stops cleanly');
        });
      });
    });
    return calls.then(function (c) { life.stop(); t.same(c, [], 'no request of any kind'); });
    }, false);
  });
  test('the phone has its own on-switch (enabled in relay-config.js): with an address and a linked phone but enabled false, missing or not a real true, the phone makes no request, no timer and no listener', function (t) {
    var made = 0;
    var life = TSI.createLife('a phone');
    var pairing = { campaign: 'CAMPAIGN12345678', handler: 'mira', name: 'Mira', secret: SECRET };
    var puller = BH.puller.create({ life: life, pairing: function () { return pairing; }, held: function () { return null; }, take: function () {}, transport: function () { made++; return RL.memory(); } });
    var calls = watchNetwork(function () {
      var chain = Promise.resolve();
      [false, 'omit', 'true', 'yes', 1, 0, null, {}, [true]].forEach(function (v) {
        chain = chain.then(function () {
          return withConfig(TEST_URL, function () {
            puller.start();
            t.equal(puller.active(), false, 'enabled ' + (v === 'omit' ? 'missing' : JSON.stringify(v)) + ': nothing to do');
            t.same(puller.debug(), { started: false, timer: false, lastT: null });
            return puller.check(true).then(function (st) { t.equal(st.state, 'off'); });
          }, v);
        });
      });
      return chain.then(function () {
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('online'));
        t.equal(made, 0, 'no post box was ever made, however many times it was asked');
        return withConfig(TEST_URL, function () {
          puller.start();
          t.equal(puller.active(), true, 'enabled true, an address and a linked phone: it runs');
          t.equal(puller.debug().timer, true);
          return puller.check(true).then(function () {
            t.ok(made >= 1, 'and it looks in the post box');
            puller.stop();
            t.equal(puller.debug().timer, false);
          });
        });
      });
    });
    return calls.then(function (c) { life.stop(); t.same(c, [], 'no fetch, no XMLHttpRequest, no EventSource, no WebSocket, no beacon'); });
  });

  test('with enabled false the real transport sends nothing even if something calls it directly; with enabled true it sends exactly the one request asked for', function (t) {
    var chan = S.chan(SECRET);
    var life = TSI.createLife('a direct caller');
    var calls = watchNetwork(function (log) {
      var tr = RL.http(TEST_URL, life);
      return withConfig(TEST_URL, function () { return tr.getStamp(chan); }, false).then(function (r) {
        t.same([r.ok, r.why], [false, 'closed']);
        return withConfig(TEST_URL, function () { return tr.putState(chan, { t: 1, d: 'a.b' }); }, 'omit');
      }).then(function (r) {
        t.equal(r.ok, false);
        t.same(log, [], 'nothing left while the file did not say enabled: true');
        return withConfig('https://x-default-rtdb.firebaseio.com', function () { return tr.getStamp(chan); });
      }).then(function (r) {
        t.equal(r.ok, false, 'a different address from the one the file holds is refused too');
        t.same(log, [], 'still nothing');
        return withConfig(TEST_URL, function () { return tr.getStamp(chan); });
      }).then(function () {
        t.equal(log.length, 1, 'switched on, the one request is made');
        t.equal(log[0], 'fetch ' + TEST_URL + '/tsi/state/' + chan + '/t.json');
      });
    });
    return calls.then(function () { life.stop(); });
  });

  test('the Bastion with its own switch on and an address but enabled false in the file sends nothing, builds nothing, and says why', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      BR.setBeastOnlineLink(w.b, true);
      return watchNetwork(function () {
        return w.pub.tick().then(function (st) {
          t.equal(st.state, 'notenabled');
          t.ok(/enabled: false/.test(L.statusLine(st, 0)), L.statusLine(st, 0));
          t.equal(w.made(), 0, 'no post box was made');
          t.same(w.store.log, []);
          return w.pub.selfTest();
        }).then(function (r) {
          t.equal(r.ok, false, '"Test the link" does not run either');
          t.same(w.store.log, []);
          return w.pub.sendNow();
        }).then(function () {
          t.same(w.store.log, [], 'nor does Send to phones now');
          t.equal(w.made(), 0);
        });
      }).then(function (calls) {
        t.same(calls, [], 'no request of any kind');
        w.life.stop();
      });
    }, false);
  });

  test('with the file on (enabled true and an address) but the DM\'s Switch on not pressed, the Bastion still sends nothing; pressing it sends', function (t) {
    return withConfig(TEST_URL, function () {
      var w = setup();
      return w.pub.tick().then(function (st) {
        t.equal(st.state, 'off');
        t.equal(w.made(), 0);
        BR.setBeastOnlineLink(w.b, true);
        return w.pub.tick();
      }).then(function () {
        t.equal(Object.keys(w.store.docs).length, 1, 'both switches on: it sends');
        w.life.stop();
      });
    });
  });
}());
