/* The Scarlett Isles: D&D Tool Suite — one window per campaign tool.
   The Explorer and the Bastion now send each other Honour/Respect changes
   (pull request 4 of the facilities overhaul, 13 October 2026), and a
   change must never count twice. Two windows of the same tool could each
   apply it, or one could save over the other, so each of these tools runs
   in one window only.

   It uses the browser's own locks (Web Locks: navigator.locks), which work
   from a double-clicked file. The window that opens the tool first holds
   its lock for as long as the page is open: the browser lets it go by
   itself when the window closes, reloads or switches tool (each is a new
   page load). A second window of the same tool runs none of its code: the
   shell shows a panel saying it's open in another window, and this second
   window opens the tool by itself once the first lets go.

   A browser without these locks (they're untested in Firefox) works as
   before: both windows open, with the "Already open" warning
   (shared/js/tabguard.js). docs/KNOWN_ISSUES.md says so.

   The lock names start with the space's lock prefix (store-rules.js
   spaceNames): tsi.suite.lock.bastion, or tsi.test:lock.bastion on the
   test page, so the test page never waits for the real suite. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var RELOAD_WAIT_MS = 1000;
  var held = null;      /* { name, release } while this window holds a lock */
  var waiting = false;

  function locks() {
    var l = navigator.locks;
    return l && typeof l.request === 'function' ? l : null;
  }
  function lockName(toolId) {
    return TSI.storeRules.spaceNames(TSI.space).lock + toolId;
  }

  TSI.toolLock = {
    /* Can this browser keep a tool to one window? */
    supported: function () { return !!locks(); },
    name: lockName,

    /* Ask for a tool's lock without waiting. Resolves with 'held' (this
       window has it until the page closes), 'busy' (another window has it)
       or 'unsupported' (no locks in this browser: carry on as before). */
    hold: function (toolId) {
      var l = locks();
      if (!l) return Promise.resolve('unsupported');
      var name = lockName(toolId);
      if (held) return Promise.resolve(held.name === name ? 'held' : 'busy');
      return new Promise(function (resolve) {
        var answered = false;
        try {
          l.request(name, { ifAvailable: true }, function (lock) {
            answered = true;
            if (!lock) { resolve('busy'); return null; }
            /* Kept until release(), or until the page closes. */
            return new Promise(function (release) {
              held = { name: name, release: release };
              resolve('held');
            });
          }).catch(function () {
            if (!answered) resolve('unsupported');
          });
        } catch (err) {
          resolve('unsupported');
        }
      });
    },

    /* Let go of the lock this window holds (a tool that failed to open). */
    release: function () {
      if (!held) return;
      var r = held.release;
      held = null;
      r();
    },

    /* Does this window hold a tool's lock? */
    holds: function (toolId) { return !!held && held.name === lockName(toolId); },

    /* A second window: wait in line for the lock. Once the first window has
       let go, keep it (so no Import or Restore can slip in meanwhile), wait
       a moment for the first window's last save to land, then reload, which
       opens the tool from the newest save. Reloading lets the lock go, and
       the new page takes it straight back. onTurn (optional) is called when
       it's this window's turn. */
    waitThenReload: function (toolId, onTurn) {
      var l = locks();
      if (!l || waiting) return;
      waiting = true;
      var name = lockName(toolId);
      l.request(name, function () {
        if (typeof onTurn === 'function') {
          try { onTurn(); } catch (e) { /* the reload still happens */ }
        }
        setTimeout(function () {
          if (TSI.shell && TSI.shell.reload) TSI.shell.reload();
          else location.reload();
        }, RELOAD_WAIT_MS);
        return new Promise(function (release) { held = { name: name, release: release }; });
      }).catch(function () { waiting = false; });
    },

    /* Is the tool open in another window (holding its lock)? Resolves
       false when this window holds it, or when the browser can't say. */
    heldElsewhere: function (toolId) {
      var l = locks();
      if (!l || typeof l.query !== 'function') return Promise.resolve(false);
      var name = lockName(toolId);
      if (held && held.name === name) return Promise.resolve(false);
      return l.query().then(function (snap) {
        return ((snap && snap.held) || []).some(function (x) { return x.name === name; });
      }).catch(function () { return false; });
    }
  };
}());
