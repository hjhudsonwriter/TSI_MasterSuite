/* The Scarlett Isles: D&D Tool Suite — snapshots (Harry, 2 November 2026).
   Automatic copies of the campaign (the Explorer's journey and the Bastion), kept inside the browser so a mistake at the table can
   be taken back a step without a backup file. Made at Make Camp, when a Bastion day passes, and every ten minutes of play if
   something changed; the last twelve are kept. Kept in a small database of their own: not in any backup file, and a Restore or
   Import leaves them alone. If the browser has no such database, nothing is kept and nothing breaks.
   Rules (what is kept, what going back writes) are in snapshot-rules.js. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var rules = TSI.snapshotRules;
  var DB_NAME = TSI.storeRules.spaceNames(TSI.space).db + '.snapshots';
  var STORE = 'snaps';

  var dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(null); return; }
      try {
        var rq = window.indexedDB.open(DB_NAME, 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE, { keyPath: 'id' }); };
        rq.onsuccess = function () { resolve(rq.result); };
        rq.onerror = function () { resolve(null); };
        rq.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbPromise;
  }
  function run(mode, work) {
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var t = db.transaction(STORE, mode);
          var out = work(t.objectStore(STORE));
          t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : true); };
          t.onerror = function () { resolve(null); };
          t.onabort = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }
  function all() {
    return run('readonly', function (os) { return os.getAll(); }).then(function (list) { return Array.isArray(list) ? list : []; });
  }

  /* Snapshots are made one at a time, so two at once can't both think they are the newest. */
  var queue = Promise.resolve();

  var api = {
    /* Is anything kept at all? (false if the browser has no database for it) */
    available: function () { return openDb().then(function (db) { return !!db; }); },

    /* Newest first. */
    list: function () { return all().then(function (list) { return rules.prune(list, 9999).kept; }); },

    /* Keep a snapshot of the campaign as it is now. opts.force keeps one even if nothing changed. Resolves the snapshot, or null
       (nothing saved, nothing changed, or the browser would not keep it). */
    take: function (why, opts) {
      opts = opts || {};
      var job = queue.then(function () {
        return TSI.store.ready.then(function () { return TSI.store.flush(); }).then(function () {
          return Promise.all([TSI.store.fresh(rules.KEYS.explorer, null), TSI.store.fresh(rules.KEYS.bastion, null)]);
        }).then(function (vals) {
          var items = rules.makeItems(vals[0], vals[1]);
          return all().then(function (list) {
            var latest = rules.prune(list, 1).kept[0] || null;
            if (!rules.shouldKeep(latest, items, opts.force)) return null;
            var snap = rules.makeSnapshot(items, why);
            return run('readwrite', function (os) { return os.put(snap); }).then(function (ok) {
              if (!ok) return null;
              var drop = rules.prune(list.concat([snap])).dropped;
              if (!drop.length) return snap;
              return run('readwrite', function (os) { drop.forEach(function (s) { os.delete(s.id); }); }).then(function () { return snap; });
            });
          });
        });
      }).catch(function () { return null; });
      queue = job;
      return job;
    },

    /* From now on, a snapshot every ten minutes if something changed (for as long as this page is open). */
    startAuto: function () {
      if (api._auto) return;
      api._auto = window.setInterval(function () { api.take('Automatic, every ten minutes'); }, rules.AUTO_EVERY_MS);
    },

    /* The window with the list of snapshots, and going back to one. */
    open: function () {
      /* One list at a time (a second click while it is opening does nothing). */
      if (api._opening) return Promise.resolve(false);
      api._opening = true;
      return api.list().then(function (list) {
        var rows = list.map(function (snap, i) {
          var when = TSI.dates.human(new Date(snap.at).toISOString());
          return TSI.el('li', { class: 'tsi-snap', 'data-test': 'snapshot-' + i }, [
            TSI.el('div', { class: 'tsi-snap__text' }, [
              TSI.el('strong', { text: snap.why }),
              TSI.el('span', { class: 'tsi-snap__meta', text: when + (rules.summary(snap) ? ' · ' + rules.summary(snap) : '') })
            ]),
            TSI.el('button', { type: 'button', class: 'tsi-btn tsi-btn--small', 'data-test': 'snapshot-go-' + i, onclick: function () { choose(snap); } }, 'Go back to this')
          ]);
        });
        var body = TSI.el('div', null, [
          TSI.el('p', { text: 'The suite keeps a copy of the Explorer and the Bastion at moments that matter (Make Camp, a Bastion day passing, and every ten minutes of play), and the last ' + rules.MAX + ' are listed here. Going back puts both back as they were then. They are kept in this browser only, not in backup files, so keep making backups too.' }),
          rows.length ? TSI.el('ul', { class: 'tsi-snaplist', 'data-test': 'snapshot-list' }, rows) : TSI.el('p', null, TSI.el('em', { text: 'Nothing has been kept yet. The first one is made the next time you make camp, or after ten minutes of play.' }))
        ]);
        var closeDlg = null;
        function choose(snap) { if (closeDlg) closeDlg(snap); }
        return TSI.modal.open({
          title: 'Snapshots',
          className: 'tsi-snapshots',
          body: body,
          escValue: null,
          actions: [{ label: 'Close', value: null, primary: true }],
          onOpen: function (dlg) { closeDlg = dlg.close; }
        }).then(function (snap) { api._opening = false; return snap ? goBack(snap) : false; });
      }).catch(function (err) { api._opening = false; throw err; });
    }
  };

  /* Going back: ask, take a snapshot of now (so this can be undone), stop the tool, write both saves, reload. */
  function goBack(snap) {
    var title = 'Go back to a snapshot';
    var when = TSI.dates.human(new Date(snap.at).toISOString());
    return TSI.backup.campaignOpenElsewhere().then(function (open) {
      if (open) {
        return TSI.modal.alert({ title: title, message: TSI.the(open, true) + ' is open in another window. Close it first: it would save over what is put back. Nothing was changed.' }).then(function () { return false; });
      }
      return TSI.modal.confirm({
        title: title,
        message: 'Put the Explorer and the Bastion back as they were at ' + when + ' (' + snap.why + (rules.summary(snap) ? ', ' + rules.summary(snap) : '') + ')? Everything since then is replaced. A snapshot of right now is kept first, so you can come back to it from this list.',
        okLabel: 'Go back'
      }).then(function (ok) {
        if (!ok) return false;
        return api.take('Before going back to ' + when, { force: true }).then(function () {
          var stop = TSI.shell && TSI.shell.stopTool ? TSI.shell.stopTool() : Promise.resolve();
          return stop;
        }).then(function () {
          return Promise.all([TSI.store.freshRecords('explorer'), TSI.store.freshRecords('bastion')]);
        }).then(function (lists) {
          var current = [].concat.apply([], lists);
          var records = rules.rollbackRecords(current, snap, Date.now());
          return TSI.store.replace(records, { tools: ['explorer', 'bastion'] });
        }).then(function (saved) {
          try { sessionStorage.setItem(TSI.storeRules.spaceNames(TSI.space).flash, JSON.stringify({ text: saved ? 'Went back to the snapshot from ' + when + '.' : 'The snapshot could not be put back: the browser refused to save it.', type: saved ? 'ok' : 'error' })); } catch (e) { /* no flash message */ }
          if (TSI.shell && TSI.shell.reload) TSI.shell.reload(); else window.location.reload();
          return saved;
        });
      });
    });
  }

  TSI.snapshots = api;
}());
