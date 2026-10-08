/* The Scarlett Isles: D&D Tool Suite — saving.
   Saves go in the browser's built-in database (IndexedDB), in a database
   called "tsi.suite". It holds far more than the old shared storage
   (localStorage), which every double-clicked file on the laptop shares and
   which one battle map can fill.

   Everything is read once when the page opens, so reading is instant
   (TSI.store.get). Writing (TSI.store.set) updates the copy in memory at
   once and saves to the browser a moment later, grouping quick changes.

   If the database can't be used, the suite falls back to the old shared
   storage, and if that fails too, keeps changes in memory only. Either way
   the shell shows a warning.

   The test page (tests/harness.html) uses its own database ("tsi.test") and
   its own fallback storage names, so test data never mixes with real saves. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var rules = TSI.storeRules;

  var NAMES = rules.spaceNames(TSI.space);
  var DB_NAME = NAMES.db;
  var SPACE = NAMES.space;
  var DB_STORE = 'records';
  var WRITE_DELAY = 120;
  var OPEN_TIMEOUT = 4000;

  var cache = new Map();       /* key → record */
  var pending = new Map();     /* key → { op: 'put' | 'delete', key, record } */
  var inflight = null;
  var timer = null;
  var backend = null;
  var statusListeners = [];
  var status = { state: 'idle', at: null, error: null, reason: '' };
  var unreadable = [];

  /* ---------- Back ends ---------- */
  function idbBackend(db) {
    return {
      mode: 'idb',
      /* One record as saved right now (another window may have changed it). */
      read: function (key) {
        return new Promise(function (resolve, reject) {
          try {
            var rq = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
            rq.onsuccess = function () { resolve(rq.result || null); };
            rq.onerror = function () { reject(rq.error); };
          } catch (err) { reject(err); }
        });
      },
      /* Every record as saved right now. */
      readAll: function () {
        return new Promise(function (resolve, reject) {
          try {
            var rq = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAll();
            rq.onsuccess = function () { resolve(rq.result || []); };
            rq.onerror = function () { reject(rq.error); };
          } catch (err) { reject(err); }
        });
      },
      write: function (batch) {
        return new Promise(function (resolve, reject) {
          var tx;
          try {
            tx = db.transaction(DB_STORE, 'readwrite');
            var os = tx.objectStore(DB_STORE);
            batch.forEach(function (op) {
              if (op.op === 'put') os.put(op.record);
              else os.delete(op.key);
            });
          } catch (err) {
            try { if (tx) tx.abort(); } catch (e) { /* ignore */ }
            reject(err);
            return;
          }
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function (event) { if (event && event.preventDefault) event.preventDefault(); };
          tx.onabort = function () { reject(tx.error || new Error('The save was cancelled by the browser.')); };
        });
      }
    };
  }

  function localBackend() {
    return {
      mode: 'local',
      read: function (key) {
        return new Promise(function (resolve) {
          var row = null;
          try { row = JSON.parse(localStorage.getItem(rules.localKey(key, SPACE)) || 'null'); } catch (e) { row = null; }
          resolve(row);
        });
      },
      readAll: function () {
        return new Promise(function (resolve) { resolve(readLocal()); });
      },
      write: function (batch) {
        return new Promise(function (resolve) {
          batch.forEach(function (op) {
            if (op.op === 'put') localStorage.setItem(rules.localKey(op.key, SPACE), JSON.stringify(op.record));
            else localStorage.removeItem(rules.localKey(op.key, SPACE));
          });
          resolve();
        });
      }
    };
  }

  function memoryBackend() {
    return { mode: 'memory', write: function () { return Promise.resolve(); } };
  }

  /* ---------- Opening ---------- */
  function openIdb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('This browser has no built-in database.')); return; }
      var settled = false;
      var giveUp = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error('The browser\'s database didn\'t open in time.'));
      }, OPEN_TIMEOUT);
      var req;
      try {
        req = indexedDB.open(DB_NAME, 1);
      } catch (err) {
        clearTimeout(giveUp);
        reject(err);
        return;
      }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'key' });
      };
      req.onsuccess = function () {
        var db = req.result;
        if (settled) { db.close(); return; }
        db.onversionchange = function () { db.close(); };
        var rq = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAll();
        rq.onsuccess = function () {
          if (settled) return;
          settled = true;
          clearTimeout(giveUp);
          resolve({ db: db, rows: rq.result || [] });
        };
        rq.onerror = function () {
          if (settled) return;
          settled = true;
          clearTimeout(giveUp);
          reject(rq.error);
        };
      };
      req.onerror = function () {
        if (settled) return;
        settled = true;
        clearTimeout(giveUp);
        reject(req.error || new Error('The browser\'s database couldn\'t be opened.'));
      };
    });
  }

  function readLocal() {
    var probe = NAMES.db + '.probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    var rows = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = rules.fromLocalKey(localStorage.key(i), SPACE);
      if (!key) continue;
      var raw = localStorage.getItem(localStorage.key(i));
      var row;
      try { row = JSON.parse(raw); } catch (e) { row = { key: key, broken: raw }; }
      /* A record must be stored under its own name. */
      if (row && typeof row === 'object' && row.key !== key) row = { key: key, broken: raw };
      rows.push(row);
    }
    return rows;
  }

  function loadRows(rows) {
    rows.forEach(function (row) {
      /* Leftover data from the test page's Demo tool (phase 1 kept it in the
         real database) is test junk: remove it so it can't reach a backup. */
      if (SPACE === 'suite' && row && typeof row.key === 'string' && rules.isTestOnly(row.key)) {
        pending.set(row.key, { op: 'delete', key: row.key });
        return;
      }
      if (rules.isRecord(row)) {
        cache.set(row.key, row);
      } else {
        unreadable.push(row);
      }
    });
  }

  var ready = openIdb().then(function (opened) {
    backend = idbBackend(opened.db);
    loadRows(opened.rows);
  }).catch(function (idbError) {
    try {
      var rows = readLocal();
      backend = localBackend();
      loadRows(rows);
      status.fallbackReason = TSI.errorText(idbError);
    } catch (localError) {
      backend = memoryBackend();
      status.fallbackReason = TSI.errorText(idbError) + '\n' + TSI.errorText(localError);
    }
  }).then(function () {
    /* Anything unreadable is set aside, never deleted. */
    unreadable.forEach(function (row, i) {
      var from = row && typeof row.key === 'string' ? row.key : 'unknown';
      var key = rules.quarantineKey(rules.isValidKey(from) ? from : 'tsi.unreadable.item' + i, new Date());
      var record = rules.makeRecord(key, safeValue(row), new Date(), { from: from, reason: 'The saved item was damaged.', at: new Date().toISOString() });
      cache.set(key, record);
      pending.set(key, { op: 'put', key: key, record: record });
      if (rules.isValidKey(from) && from !== key) pending.set(from, { op: 'delete', key: from });
    });
    if (pending.size) schedule();
    setStatus(backend.mode === 'idb' ? 'saved' : backend.mode === 'local' ? 'limited' : 'unavailable', null);
    return backend.mode;
  });

  function safeValue(row) {
    try { return rules.toJsonValue(row === undefined ? null : row); } catch (e) { return String(row); }
  }

  /* ---------- Writing ---------- */
  function setStatus(state, error) {
    status = {
      state: state,
      at: new Date(),
      error: error || null,
      reason: error ? rules.describeFailure(error) : '',
      fallbackReason: status.fallbackReason
    };
    statusListeners.slice().forEach(function (fn) {
      try { fn(status); } catch (e) { TSI.reportError(e, 'saving'); }
    });
  }

  function schedule() {
    if (timer || !backend) return;
    timer = setTimeout(function () {
      timer = null;
      writeNow();
    }, WRITE_DELAY);
  }

  function writeNow() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!backend) return ready.then(writeNow);
    if (inflight) return inflight.then(function () { return pending.size && status.state !== 'failed' ? writeNow() : status.state !== 'failed'; });
    if (!pending.size) return Promise.resolve(status.state !== 'failed');

    var batch = Array.from(pending.values());
    pending.clear();
    if (backend.mode === 'idb') setStatus('saving', null);

    inflight = backend.write(batch).then(function () {
      inflight = null;
      if (backend.mode === 'idb') setStatus('saved', null);
      else setStatus(backend.mode === 'local' ? 'limited' : 'unavailable', null);
      return true;
    }, function (err) {
      inflight = null;
      /* Keep the unsaved changes queued (unless something newer replaced them),
         so the next change tries again. */
      batch.forEach(function (op) { if (!pending.has(op.key)) pending.set(op.key, op); });
      setStatus('failed', err);
      return false;
    });
    return inflight.then(function (ok) {
      if (ok && pending.size) return writeNow();
      return ok;
    });
  }

  function requireReady() {
    if (!backend) throw new Error('Saving isn\'t ready yet. Wait for TSI.store.ready first.');
  }

  /* ---------- Public ---------- */
  TSI.store = {
    ready: ready,

    /* 'suite' for the real suite, 'test' for the test page. */
    space: SPACE,
    databaseName: DB_NAME,

    get mode() { return backend ? backend.mode : 'opening'; },

    status: function () { return status; },

    onStatus: function (fn) {
      statusListeners.push(fn);
      return function () {
        var i = statusListeners.indexOf(fn);
        if (i !== -1) statusListeners.splice(i, 1);
      };
    },

    has: function (key) { return cache.has(key); },

    /* A copy of the saved value, or fallback if nothing is saved. */
    get: function (key, fallback) {
      requireReady();
      var record = cache.get(key);
      return record ? TSI.clone(record.value) : fallback;
    },

    /* The value as saved right now, read again from the browser: for another
       tool's save, which a window open on a different tool may have changed
       since this page opened (the Explorer reads the Bastion's party level
       this way). Resolves with a copy, or fallback. A change this page is
       still saving wins, and if the browser can't be read the copy read when
       the page opened is used. */
    fresh: function (key, fallback) {
      requireReady();
      var cached = function () { return TSI.store.get(key, fallback); };
      if (pending.has(key) || inflight || !backend.read) return Promise.resolve(cached());
      return backend.read(key).then(function (row) {
        return rules.isRecord(row) && row.key === key ? TSI.clone(row.value) : (row ? cached() : fallback);
      }, cached);
    },

    /* One tool's records as saved right now, read again from the browser
       (for the campaign save: the Bastion, say, open in another window,
       may have saved since this page opened). If this page has changes of
       that tool's still to save, or the browser can't be read, the copies
       in memory are used. */
    freshRecords: function (tool) {
      requireReady();
      var cached = function () { return TSI.store.records(tool); };
      var mine = Array.from(pending.keys()).some(function (k) { return rules.toolOf(k) === tool; });
      if (mine || !backend.readAll) return Promise.resolve(cached());
      return backend.readAll().then(function (rows) {
        return rows.filter(function (r) {
          return rules.isRecord(r) && rules.toolOf(r.key) === tool && !(SPACE === 'suite' && rules.isTestOnly(r.key));
        }).sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; }).map(function (r) { return TSI.clone(r); });
      }, cached);
    },

    /* When the value was last saved (ISO text), or null. */
    savedAt: function (key) {
      var record = cache.get(key);
      return record ? record.savedAt : null;
    },

    set: function (key, value) {
      requireReady();
      var record = rules.makeRecord(key, value, new Date());
      cache.set(key, record);
      pending.set(key, { op: 'put', key: key, record: record });
      schedule();
      return record;
    },

    remove: function (key) {
      requireReady();
      if (!cache.has(key) && !pending.has(key)) return;
      cache.delete(key);
      pending.set(key, { op: 'delete', key: key });
      schedule();
    },

    /* Every saved key, optionally only one tool's. */
    keys: function (tool) {
      return Array.from(cache.keys()).filter(function (key) {
        return (!tool || rules.toolOf(key) === tool) && !(SPACE === 'suite' && rules.isTestOnly(key));
      }).sort();
    },

    /* Copies of the saved records (for backups), optionally only one tool's. */
    records: function (tool) {
      return TSI.store.keys(tool).map(function (key) { return TSI.clone(cache.get(key)); });
    },

    /* Replace saved records in one go (used by Restore and Import).
       scope: { all: true } replaces everything; { tool: 'bastion' } replaces one tool's;
       { tools: ['explorer', 'bastion'] } replaces those tools' together (the campaign save).
       Resolves true once saved, false if the browser refused. */
    replace: function (records, scope) {
      requireReady();
      scope = scope || {};
      if (!scope.all && Array.isArray(scope.tools)) {
        if (!scope.tools.length || !scope.tools.every(rules.isValidToolId)) throw new Error('Replace needs real tools.');
      } else if (!scope.all && !rules.isValidToolId(scope.tool)) throw new Error('Replace needs a tool or { all: true }.');
      var inScope = function (tool) { return scope.all || (Array.isArray(scope.tools) ? scope.tools.indexOf(tool) !== -1 : tool === scope.tool); };
      /* Test data never goes into the real suite. */
      if (SPACE === 'suite') records = records.filter(function (r) { return !(r && rules.isTestOnly(r.key)); });
      records.forEach(function (r) {
        if (!rules.isRecord(r)) throw new Error('A record in the file is damaged.');
        if (!inScope(rules.toolOf(r.key))) throw new Error('The file holds another tool\'s data (' + r.key + ').');
      });
      var incoming = new Set(records.map(function (r) { return r.key; }));
      TSI.store.keys(null).filter(function (key) { return inScope(rules.toolOf(key)); }).forEach(function (key) {
        if (!incoming.has(key)) {
          cache.delete(key);
          pending.set(key, { op: 'delete', key: key });
        }
      });
      records.forEach(function (r) {
        var record = { key: r.key, value: rules.toJsonValue(r.value), savedAt: r.savedAt };
        if (r.note) record.note = r.note;
        cache.set(r.key, record);
        pending.set(r.key, { op: 'put', key: r.key, record: record });
      });
      return writeNow();
    },

    /* Set a damaged save aside instead of deleting it. Resolves with its new key. */
    quarantine: function (key, reason) {
      requireReady();
      var record = cache.get(key);
      if (!record) return Promise.resolve(null);
      var now = new Date();
      /* Two set aside in the same second get different names, so the first
         isn't overwritten by the second. */
      var base = rules.quarantineKey(key, now);
      var newKey = base;
      for (var n = 2; cache.has(newKey) || pending.has(newKey); n++) newKey = base + '-' + n;
      var moved = rules.makeRecord(newKey, record.value, now, { from: key, reason: reason || 'It couldn\'t be read.', at: now.toISOString() });
      cache.set(newKey, moved);
      cache.delete(key);
      pending.set(newKey, { op: 'put', key: newKey, record: moved });
      pending.set(key, { op: 'delete', key: key });
      return writeNow().then(function () { return newKey; });
    },

    /* Save everything waiting now. Resolves true if all saved. */
    flush: function () { return writeNow(); },

    hasUnsaved: function () { return pending.size > 0 || !!inflight; }
  };

  /* Save straight away when the page is hidden or closed. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && backend) writeNow();
  });
  window.addEventListener('pagehide', function () { if (backend) writeNow(); });
}());
