/* Scarlett Isles: Beast Handler — the player's phone (BH-3a; read-only since 22 October 2026).

   beasthandler.html loads this with only the companion's own files. There is no
   internet and no server between this phone and the DM's Bastion in this
   version, so the DM sends short pieces of text (pasted, or sent as a small
   file), each signed with a secret only that handler and the DM's Bastion know
   (codes.js). A way to link by scanning a code, and to update by itself, is to come.

   1. The DM gives a PAIRING code once. Pasting it links this phone to one handler.
   2. The DM sends a SNAPSHOT code: what this handler can see. Pasting it shows the beasts.
   The app only LOOKS: nothing is ever sent back to the DM, so there are no request
   codes. What is kept on this phone (the link, the latest snapshot, and which
   beasts' first meeting has been shown) is in this browser only, under keys
   starting "tsi.beasthandler.phone". Unlinking forgets all of it. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var BH = TSI.beasthandler;
  var C = BH.codes;
  var M = BH.model;
  var P = BH.projection;
  var el = TSI.el;
  var life = TSI.createLife('the Beast Handler phone page');
  var root = document.getElementById('tsi-bhp-root');

  /* ---------- What this phone keeps ---------- */
  var KEY = { pairing: 'tsi.beasthandler.phone.pairing', snapshot: 'tsi.beasthandler.phone.snapshot', seen: 'tsi.beasthandler.phone.seen' };
  /* Kept by earlier versions (requests to send, a first-meeting draft): the app sends nothing now, so they are cleared away. */
  var OLD_KEYS = ['tsi.beasthandler.phone.outbox', 'tsi.beasthandler.phone.draft'];
  var memory = {};   /* used only if the browser won't keep anything */
  var keepsNothing = false;
  function read(key) {
    try { var t = localStorage.getItem(key); return t === null ? null : JSON.parse(t); } catch (e) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; }
  }
  function write(key, value) {
    try {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { keepsNothing = true; if (value === null) delete memory[key]; else memory[key] = value; }
  }

  var pairing = read(KEY.pairing);
  if (!pairing || typeof pairing.secret !== 'string' || typeof pairing.handler !== 'string' || typeof pairing.campaign !== 'string') pairing = null;
  var held = read(KEY.snapshot);           /* { snapshot, at } */
  /* A stored snapshot that isn't right for this link (damaged, from another version, another Bastion or
     another handler) is forgotten, so it can never stop the page from opening. */
  function usable(h) {
    if (!h || typeof h !== 'object' || typeof h.at !== 'number' || !pairing) return false;
    var sn = h.snapshot;
    if (!sn || P.check(sn) || typeof sn.campaign !== 'string' || sn.campaign !== pairing.campaign) return false;
    return !!sn.handler && typeof sn.handler.id === 'string' && P.handlerKey(sn.handler.id) === P.handlerKey(pairing.handler);
  }
  if (held && !usable(held)) { held = null; write(KEY.snapshot, null); }
  OLD_KEYS.forEach(function (k) { write(k, null); });
  var seen = read(KEY.seen);          /* { <creature id>: true }: the first meetings that have been shown on this phone */
  if (!seen || typeof seen !== 'object' || Array.isArray(seen)) seen = {};
  var view = null;
  var viewRoot = null;

  function snapshot() { return held && held.snapshot ? held.snapshot : null; }

  /* ---------- Small pieces ---------- */
  function btn(label, onclick, cls, test, attrs) {
    return el('button', Object.assign({ type: 'button', class: 'tsi-btn ' + (cls || ''), 'data-test': test || null, onclick: onclick }, attrs || {}), label);
  }
  function ago(ms) {
    var m = Math.floor(Math.max(0, Date.now() - ms) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.floor(m / 60);
    if (h < 48) return h + (h === 1 ? ' hour ago' : ' hours ago');
    return Math.floor(h / 24) + ' days ago';
  }
  /* A text box with a button to open a file instead. Returns { node, value() }. */
  function codeInput(placeholder, test) {
    var area = el('textarea', { class: 'tsi-input tsi-bhp-code', placeholder: placeholder, 'data-test': test, 'aria-label': placeholder, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    var file = btn('Open a file…', function () {
      TSI.pickFile('.txt,text/plain').then(function (f) { return f ? TSI.readFileText(f) : null; }).then(function (t) { if (t !== null) { area.value = t; area.dispatchEvent(new Event('input')); } }, function () { /* not readable */ });
    }, 'tsi-btn--ghost', test + '-file');
    return { node: el('div', { class: 'tsi-bhp-field' }, [area, el('div', { class: 'tsi-bhp-row' }, file)]), value: function () { return area.value; }, area: area };
  }

  /* ---------- Taking in a snapshot ---------- */
  function takeSnapshot(code) {
    if (!pairing) return { ok: false, why: 'Link this phone first with the pairing code.' };
    var d = C.decodeSnapshot(code, pairing.secret);
    if (!d.ok) return d;
    var bad = P.check(d.snapshot);
    if (bad) return { ok: false, why: bad };
    var s = d.snapshot;
    if (typeof s.campaign !== 'string' || s.campaign !== pairing.campaign) return { ok: false, why: 'That snapshot is from a different Bastion save. Ask the DM for the right one.' };
    if (!s.handler || P.handlerKey(s.handler.id) !== P.handlerKey(pairing.handler)) return { ok: false, why: 'That snapshot is for a different handler.' };
    if (held && held.snapshot && typeof held.snapshot.madeAt === 'number' && typeof s.madeAt === 'number' && s.madeAt < held.snapshot.madeAt) {
      return { ok: false, why: 'That snapshot is older than the one you already have (' + (held.snapshot.asOfLabel || 'a later day') + '). Ask the DM for a newer one, or press Unlink this phone to start again.' };
    }
    held = { snapshot: s, at: Date.now() };
    write(KEY.snapshot, held);
    return { ok: true };
  }

  /* ---------- The host the shared screens use ---------- */
  var host = {
    mode: 'phone',
    life: life,
    snapshot: snapshot,
    problem: function () { return ''; },
    syncOk: function () { return !!snapshot(); },
    syncLine: function () {
      var s = snapshot();
      if (!s) return 'No snapshot yet.';
      var old = Date.now() - held.at > 24 * 3600 * 1000;
      return 'Snapshot of ' + s.asOfLabel + ', got ' + ago(held.at) + (old ? '. It is more than a day old: ask the DM for a new one' : '');
    },
    /* Which beasts' first meeting has played on this phone (kept here until the phone is unlinked). */
    seen: function () { return seen; },
    markSeen: function (id) { seen = Object.assign({}, seen); seen[id] = true; write(KEY.seen, seen); },
    extraHome: function () { return homeExtras(); }
  };

  /* ---------- Home extras: the snapshot and unlinking ---------- */
  var onUpdate = TSI.oneAtATime(function () {
    var input = codeInput('Paste the snapshot code here (it starts BHS1.)', 'bhp-snap-input');
    var problem = el('p', { class: 'tsi-bhp-error', hidden: true, role: 'alert', 'data-test': 'bhp-snap-problem' });
    return TSI.modal.open({
      title: 'Update from a snapshot', body: el('div', null, [el('p', { text: 'Paste the snapshot code the DM sent you, or open it as a file.' }), input.node, problem]),
      actions: [{ label: 'Cancel', value: false }, { label: 'Use this snapshot', value: true, primary: true }],
      onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'bhp-snap-dialog'); }
    }).then(function (ok) {
      if (!ok) return null;
      var r = takeSnapshot(input.value());
      if (!r.ok) return TSI.modal.alert({ title: 'That didn\'t work', message: r.why }).then(function () { return null; });
      refreshAll();
      return null;
    });
  });
  var onUnlink = TSI.oneAtATime(function () {
    return TSI.modal.confirm({ title: 'Unlink this phone', message: 'This forgets the link to your beasts and the snapshot. You would need a new pairing code from the DM, and each beast\'s first meeting would play again. Unlink?', okLabel: 'Unlink', cancelLabel: 'Keep it' }).then(function (go) {
      if (!go) return;
      pairing = null; held = null; seen = {};
      write(KEY.pairing, null); write(KEY.snapshot, null); write(KEY.seen, null);
      start();
    });
  });

  function homeExtras() {
    var s = snapshot();
    var parts = [];
    parts.push(el('section', { class: 'tsi-bh-panel tsi-bh-panel--quiet', 'data-test': 'bhp-snap' }, [
      el('h2', { class: 'tsi-bh-panel__title', text: s ? 'Your snapshot' : 'No snapshot yet' }),
      el('p', { class: 'tsi-bh-muted', text: s ? 'This is what the DM\'s Bastion showed for ' + pairing.name + ' on ' + s.asOfLabel + '. Ask the DM for a new snapshot when you want to see changes.' : 'Ask the DM for a snapshot code.' }),
      el('div', { class: 'tsi-bhp-row' }, [btn('Update from a snapshot…', onUpdate, '', 'bhp-update'), btn('Unlink this phone', onUnlink, 'tsi-btn--ghost', 'bhp-unlink')])
    ]));
    if (keepsNothing) parts.push(el('p', { class: 'tsi-bh-message', text: 'This browser won\'t keep anything for this page, so closing it forgets your link. Use a normal (not private) window.' }));
    return parts;
  }

  /* ---------- The first-run screens ---------- */
  function screenLink() {
    var input = codeInput('Paste the pairing code here (it starts BHP1.)', 'bhp-pair-input');
    var problem = el('p', { class: 'tsi-bhp-error', hidden: true, role: 'alert', 'data-test': 'bhp-pair-problem' });
    var go = btn('Link this phone', function () {
      var r = C.decodePairing(input.value());
      if (!r.ok) { problem.textContent = r.why; problem.hidden = false; return; }
      pairing = r.pairing;
      write(KEY.pairing, pairing);
      start();
    }, 'tsi-btn--primary', 'bhp-link');
    TSI.append(root, el('div', { class: 'tsi-bh' }, el('div', { class: 'tsi-bhp-card', 'data-test': 'bhp-screen-link' }, [
      el('h1', { text: 'Link your phone' }),
      el('p', { text: 'This page shows your beasts at the Ironbow: their bond, their profile and their Chronicle. It only looks, so nothing you do here changes anything. It needs no internet.' }),
      el('ol', null, [el('li', { text: 'Your DM gives you a pairing code. It starts BHP1.' }), el('li', { text: 'Paste it below and press Link this phone.' }), el('li', { text: 'Then your DM sends you a snapshot code to show your beasts.' })]),
      input.node, problem, el('div', { class: 'tsi-bhp-row' }, go)
    ])));
  }
  function screenSnapshot(notice) {
    var input = codeInput('Paste the snapshot code here (it starts BHS1.)', 'bhp-first-snap');
    var problem = el('p', { class: 'tsi-bhp-error', hidden: true, role: 'alert', 'data-test': 'bhp-first-problem' });
    if (notice) { problem.textContent = notice; problem.hidden = false; }
    var go = btn('Show my beasts', function () {
      var r = takeSnapshot(input.value());
      if (!r.ok) { problem.textContent = r.why; problem.hidden = false; return; }
      start();
    }, 'tsi-btn--primary', 'bhp-first-go');
    TSI.append(root, el('div', { class: 'tsi-bh' }, el('div', { class: 'tsi-bhp-card', 'data-test': 'bhp-screen-snap' }, [
      el('h1', { text: 'Hello, ' + pairing.name }),
      el('p', { text: 'Your phone is linked. Now ask your DM for a snapshot code: it shows your beasts as the Bastion sees them today. Paste it here.' }),
      input.node, problem, el('div', { class: 'tsi-bhp-row' }, [go, btn('Unlink this phone', onUnlink, 'tsi-btn--ghost', 'bhp-unlink')])
    ])));
  }

  function refreshAll() { if (view) view.refresh(); }

  function start() {
    TSI.clear(root);
    view = null;
    if (!pairing) return screenLink();
    if (!snapshot()) return screenSnapshot();
    try {
      view = BH.view.mount(root, host);
      view.render();
    } catch (e) {
      /* Whatever was stored couldn't be shown: forget it, so the page can always be used again. */
      view = null;
      held = null;
      write(KEY.snapshot, null);
      TSI.clear(root);
      return screenSnapshot('The page couldn\'t show the snapshot it had saved, so it was cleared. Ask the DM for a new snapshot code.');
    }
    /* Keep "got 3 minutes ago" honest while the page is open, by changing only those words (a full redraw every
       minute would close what the player has open and send a long list back to the top). */
    if (!ageTimer) ageTimer = life.setInterval(tickAges, 60000);
  }
  var ageTimer = null;
  function tickAges() {
    if (!view) return;
    var line = root.querySelector('[data-test="bh-sync"] span:last-child');
    if (line) line.textContent = host.syncLine();
  }

  start();
}());
