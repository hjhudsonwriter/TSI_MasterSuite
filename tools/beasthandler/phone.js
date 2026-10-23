/* Scarlett Isles: Beast Handler — the player's phone (BH-3a; read-only since 22 October 2026; QR link and online link S17).

   beasthandler.html loads this with only the companion's own files. It shows the
   player's beasts and sends nothing back to the DM.

   LINKING. The DM shows a QR code. The player points the phone's camera at it and taps
   the link that appears: this page opens with the pairing after the # of its address
   (codes.js, C.decodeLink). The page reads it, keeps the pairing exactly as a pasted
   pairing code would be kept, and takes the # part out of the address bar and the
   history straight away (history.replaceState), so the secret doesn't stay where it
   can be read over a shoulder or sent on. A browser never sends a # part to any server.
   An already linked phone asks before it swaps to a different link.

   UPDATING. By default the DM sends a SNAPSHOT code (pasted in under "Offline backup").
   If the DM has also set up the optional online link (relay-config.js, off until then),
   the page looks for new snapshots by itself (puller.js) and shows them the same way.
   Both go through the same check (link-rules.js, L.accept): signed with this handler's
   secret, for this Bastion save and this handler, and never older than the one held.

   What is kept on this phone (the link, the latest snapshot, and which beasts' first
   meeting has been shown) is in this browser only, under keys starting
   "tsi.beasthandler.phone". Unlinking forgets all of it. An iPhone keeps a Home Screen
   icon's saved link apart from Safari's: see the help on the link screen. */
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
  var ago = function (ms) { return BH.link.ago(ms); };
  /* A text box with a button to open a file instead. Returns { node, value() }. */
  function codeInput(placeholder, test) {
    var area = el('textarea', { class: 'tsi-input tsi-bhp-code', placeholder: placeholder, 'data-test': test, 'aria-label': placeholder, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    var file = btn('Open a file…', function () {
      TSI.pickFile('.txt,text/plain').then(function (f) { return f ? TSI.readFileText(f) : null; }).then(function (t) { if (t !== null) { area.value = t; area.dispatchEvent(new Event('input')); } }, function () { /* not readable */ });
    }, 'tsi-btn--ghost', test + '-file');
    return { node: el('div', { class: 'tsi-bhp-field' }, [area, el('div', { class: 'tsi-bhp-row' }, file)]), value: function () { return area.value; }, area: area };
  }
  /* The "Offline backup" box: shut until the player opens it. Everything the old copy-and-paste way needs lives inside it. */
  function backupBox(summary, children) {
    return el('details', { class: 'tsi-bhp-backup', 'data-test': 'bhp-backup' }, [
      el('summary', { class: 'tsi-bhp-backup__summary', 'data-test': 'bhp-backup-toggle', text: summary }),
      el('div', { class: 'tsi-bhp-backup__body' }, children)
    ]);
  }
  /* Copy some text. Resolves true if it was copied; the caller shows the text for copying by hand if not. */
  function copyText(text) {
    return new Promise(function (resolve) {
      function fallback() {
        var ta = el('textarea', { style: 'position:fixed;opacity:0;left:-999px', 'aria-hidden': 'true' });
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        var copied = false;
        try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
        ta.remove();
        resolve(copied);
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { resolve(true); }, fallback);
        else fallback();
      } catch (e) { fallback(); }
    });
  }

  /* ---------- Taking in a snapshot ---------- */
  /* via: 'code' for one pasted in, 'link' for one that came over the online link. */
  function takeSnapshot(code, via) {
    var r = BH.link.accept(pairing, snapshot(), code);
    if (!r.ok) return r;
    held = { snapshot: r.snapshot, at: Date.now(), via: via || 'code' };
    write(KEY.snapshot, held);
    return { ok: true };
  }

  /* ---------- The online link (off unless the DM has set it up: relay-config.js) ---------- */
  var liveText = '';
  var live = BH.puller.create({
    life: life,
    pairing: function () { return pairing; },
    held: snapshot,
    take: function (snap) {
      held = { snapshot: snap, at: Date.now(), via: 'link' };
      write(KEY.snapshot, held);
      if (view) refreshAll(); else start();
    },
    onStatus: function () { paintLive(); }
  });
  function liveOn() { return live.active(); }
  function liveWords() {
    var st = live.status();
    switch (st.state) {
      case 'ok': return 'Updates arrive by themselves while this page is open. Last checked ' + (st.checkedAt ? ago(st.checkedAt) : 'just now') + '.';
      case 'empty': return 'Waiting for your DM\'s Bastion to send your beasts. It sends when it is open.';
      case 'offline': return 'No connection just now. You will see the latest update when you are back online.';
      case 'unreadable': return 'An update arrived that this phone could not read. If it keeps happening, ask your DM to take back your code and show you a new QR code.';
      case 'trouble': return 'Could not reach the update service just now. It will try again.';
      case 'checking': return liveText || 'Checking for an update…';
      default: return '';
    }
  }
  function paintLive() {
    var words = liveWords();
    if (words) liveText = words;
    var node = root.querySelector('[data-test="bhp-live"]');
    if (node) node.textContent = liveText;
  }
  function liveRow() {
    if (!liveOn()) return null;
    return el('div', { class: 'tsi-bhp-live' }, [
      el('p', { class: 'tsi-bh-muted', 'data-test': 'bhp-live', role: 'status', text: liveWords() || liveText || 'Checking for an update…' }),
      el('div', { class: 'tsi-bhp-row' }, btn('Check now', function () { live.check(true); }, 'tsi-btn--ghost', 'bhp-check'))
    ]);
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
      if (held && held.via === 'link') return BH.link.liveLine(s);
      var old = Date.now() - held.at > 24 * 3600 * 1000;
      return 'Snapshot of ' + s.asOfLabel + ', got ' + ago(held.at) + (old ? '. It is more than a day old: ask the DM for a new one' : '');
    },
    /* Which beasts' first meeting has played on this phone (kept here until the phone is unlinked). */
    seen: function () { return seen; },
    markSeen: function (id) { seen = Object.assign({}, seen); seen[id] = true; write(KEY.seen, seen); },
    extraHome: function () { return homeExtras(); }
  };

  /* ---------- Linking from a QR code or a link (the # part of the address) ---------- */
  /* What to tell the player on the next screen: { text, bad }. */
  var flash = null;
  /* Take the # part out of the address bar and the history, whatever it held. */
  function wipeHash() {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* the address bar keeps it; nothing else is affected */ }
  }
  /* Read the # part once, when the page opens. Returns what C.decodeLink made of it, or null if there was none. */
  function readHash() {
    var hash = '';
    try { hash = location.hash || ''; } catch (e) { hash = ''; }
    if (!hash || hash === '#') return null;
    var d = C.decodeLink(hash);
    wipeHash();
    return d;
  }
  /* Make a decoded link this phone's link. If the phone is linked already to someone else, ask first. Resolves true if it changed. */
  function adoptPairing(next) {
    if (pairing && pairing.secret === next.secret && P.handlerKey(pairing.handler) === P.handlerKey(next.handler) && pairing.campaign === next.campaign) {
      flash = { text: 'This phone is already linked to ' + pairing.name + '\'s beasts.' };
      return Promise.resolve(false);
    }
    function apply() {
      var sameBastion = pairing && pairing.campaign === next.campaign && P.handlerKey(pairing.handler) === P.handlerKey(next.handler);
      if (pairing && !sameBastion) { held = null; seen = {}; write(KEY.snapshot, null); write(KEY.seen, null); }
      pairing = next;
      write(KEY.pairing, pairing);
      if (held && !usable(held)) { held = null; write(KEY.snapshot, null); }
      flash = { text: 'Linked. This phone now shows ' + pairing.name + '\'s beasts.' };
      return true;
    }
    if (!pairing) return Promise.resolve(apply());
    return TSI.modal.confirm({ title: 'Replace the link?', message: 'This phone is linked to ' + pairing.name + '\'s beasts. Replace that with the link for ' + next.name + '\'s beasts?', okLabel: 'Replace the link', cancelLabel: 'Keep what I have' }).then(function (go) {
      if (!go) return false;   /* the player chose to keep it: nothing more to say */
      return apply();
    });
  }

  /* ---------- Home extras: the snapshot, the link and unlinking ---------- */
  var onUpdate = TSI.oneAtATime(function () {
    var input = codeInput('Paste the snapshot code here (it starts BHS1.)', 'bhp-snap-input');
    var problem = el('p', { class: 'tsi-bhp-error', hidden: true, role: 'alert', 'data-test': 'bhp-snap-problem' });
    return TSI.modal.open({
      title: 'Update from a snapshot', body: el('div', null, [el('p', { text: 'Paste the snapshot code the DM sent you, or open it as a file.' }), input.node, problem]),
      actions: [{ label: 'Cancel', value: false }, { label: 'Use this snapshot', value: true, primary: true }],
      onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'bhp-snap-dialog'); }
    }).then(function (ok) {
      if (!ok) return null;
      var r = takeSnapshot(input.value(), 'code');
      if (!r.ok) return TSI.modal.alert({ title: 'That didn\'t work', message: r.why }).then(function () { return null; });
      refreshAll();
      return null;
    });
  });
  var onUnlink = TSI.oneAtATime(function () {
    return TSI.modal.confirm({ title: 'Unlink this phone', message: 'This forgets the link to your beasts and the snapshot. You would need your DM\'s QR code again, and each beast\'s first meeting would play again. Unlink?', okLabel: 'Unlink', cancelLabel: 'Keep it' }).then(function (go) {
      if (!go) return;
      pairing = null; held = null; seen = {};
      write(KEY.pairing, null); write(KEY.snapshot, null); write(KEY.seen, null);
      start();
    });
  });
  /* This page's own address with the pairing after the #: for moving the link to another place on the same phone (an iPhone Home Screen icon). */
  function myLink() {
    var base = '';
    try { base = location.href.split('#')[0].split('?')[0]; } catch (e) { base = ''; }
    return base + '#' + C.encodeLink(pairing);
  }
  var onCopyLink = TSI.oneAtATime(function () {
    var text = myLink();
    return copyText(text).then(function (done) {
      if (done) return TSI.modal.alert({ title: 'Link copied', message: 'Your link is copied. It links a phone to your beasts, so only share it with yourself (for example, paste it into the Home Screen icon\'s page).' });
      var box = el('textarea', { class: 'tsi-input tsi-bhp-code', readonly: 'readonly', 'aria-label': 'Your link', 'data-test': 'bhp-mylink', onfocus: function () { box.select(); } });
      box.value = text;
      return TSI.modal.open({ title: 'Your link', body: el('div', null, [el('p', { text: 'Copy this by hand. It links a phone to your beasts, so keep it to yourself.' }), box]), actions: [{ label: 'Done', value: true, primary: true }] });
    });
  });

  function homeExtras() {
    var s = snapshot();
    var parts = [];
    var live = liveOn();
    parts.push(el('section', { class: 'tsi-bh-panel tsi-bh-panel--quiet', 'data-test': 'bhp-snap' }, [
      el('h2', { class: 'tsi-bh-panel__title', text: s ? 'Your snapshot' : 'No snapshot yet' }),
      el('p', { class: 'tsi-bh-muted', text: s
        ? 'This is what the DM\'s Bastion showed for ' + pairing.name + ' on ' + s.asOfLabel + '.' + (live ? ' It updates by itself while this page is open.' : ' Ask the DM for a new snapshot when you want to see changes.')
        : 'Ask the DM for a snapshot code.' }),
      liveRow(),
      el('div', { class: 'tsi-bhp-row' }, [btn('Copy my link', onCopyLink, '', 'bhp-mylink-button'), btn('Unlink this phone', onUnlink, 'tsi-btn--ghost', 'bhp-unlink')]),
      backupBox('Offline backup: update from a snapshot code', [
        el('p', { class: 'tsi-bh-muted', text: 'With no internet, your DM can send you a snapshot code in a message. Paste it here to see the latest.' }),
        el('div', { class: 'tsi-bhp-row' }, btn('Update from a snapshot…', onUpdate, '', 'bhp-update'))
      ])
    ]));
    if (keepsNothing) parts.push(el('p', { class: 'tsi-bh-message', text: 'This browser won\'t keep anything for this page, so closing it forgets your link. Use a normal (not private) window.' }));
    return parts;
  }

  /* ---------- The first-run screens ---------- */
  function flashNode(extra) {
    if (!flash) return null;
    var f = flash;
    flash = null;
    return el('p', { class: f.bad ? 'tsi-bhp-error' : 'tsi-bhp-ok', role: f.bad ? 'alert' : 'status', 'data-test': 'bhp-flash', text: f.text });
  }
  /* A pasted pairing code, link or whole address: what it gives, in the plain words of the old paste box. */
  function readPasted(text) {
    var t = C.tidy(text);
    if (C.looksLikeLink(t)) return C.decodeLink(t);
    var r = C.decodePairing(t);
    if (!r.ok && C.kind(t) !== 'pair') r.why = 'That isn\'t a pairing code or a link. A pairing code starts BHP1. and a link has a # in it. Your DM gives you one of them.';
    return r;
  }
  function screenLink() {
    var input = codeInput('Paste the pairing code or link here', 'bhp-pair-input');
    var problem = el('p', { class: 'tsi-bhp-error', hidden: true, role: 'alert', 'data-test': 'bhp-pair-problem' });
    var go = btn('Link this phone', function () {
      var r = readPasted(input.value());
      if (!r.ok) { problem.textContent = r.why; problem.hidden = false; return; }
      adoptPairing(r.pairing, 'pasted').then(function () { start(); });
    }, 'tsi-btn--primary', 'bhp-link');
    var note = flashNode();
    TSI.append(root, el('div', { class: 'tsi-bh' }, el('div', { class: 'tsi-bhp-card', 'data-test': 'bhp-screen-link' }, [
      el('h1', { text: 'Link your phone' }),
      note,
      el('p', { text: 'This page shows your beasts at the Ironbow: their bond, their profile and their Chronicle. It only looks, so nothing you do here changes anything.' }),
      el('ol', null, [
        el('li', { text: 'Ask your DM to show you your QR code.' }),
        el('li', { text: 'Point your phone\'s camera at it and tap the link that appears.' }),
        el('li', { text: 'This page opens and links itself. Your beasts appear as soon as your DM sends them.' })
      ]),
      el('p', { text: 'If your DM sent you a link in a message instead, just tap it.' }),
      el('details', { class: 'tsi-bhp-help', 'data-test': 'bhp-iphone-help' }, [
        el('summary', { class: 'tsi-bhp-backup__summary', text: 'Using an iPhone Home Screen icon?' }),
        el('div', { class: 'tsi-bhp-backup__body' }, [
          el('p', { text: 'An iPhone keeps a Home Screen icon\'s saved link apart from Safari\'s, so scanning links Safari, not the icon. To use an icon:' }),
          el('ol', null, [
            el('li', { text: 'Scan the QR code with the camera, so this page opens and links in Safari.' }),
            el('li', { text: 'Press Copy my link on that page.' }),
            el('li', { text: 'Choose Share, then Add to Home Screen, from that page.' }),
            el('li', { text: 'Open the new icon, open Offline backup below, and paste the link there.' })
          ]),
          el('p', { text: 'If Safari ever forgets the link (it can after a week unused), tap the link your DM sent you again, or scan the QR code again.' })
        ])
      ]),
      backupBox('Offline backup: link with a pairing code or a pasted link', [
        el('p', { class: 'tsi-bh-muted', text: 'Paste a pairing code (it starts BHP1.) or a whole link here, then press Link this phone.' }),
        input.node, problem, el('div', { class: 'tsi-bhp-row' }, go)
      ])
    ])));
  }
  function screenSnapshot(notice) {
    var input = codeInput('Paste the snapshot code here (it starts BHS1.)', 'bhp-first-snap');
    var problem = el('p', { class: 'tsi-bhp-error', hidden: true, role: 'alert', 'data-test': 'bhp-first-problem' });
    if (notice) { problem.textContent = notice; problem.hidden = false; }
    var go = btn('Show my beasts', function () {
      var r = takeSnapshot(input.value(), 'code');
      if (!r.ok) { problem.textContent = r.why; problem.hidden = false; return; }
      start();
    }, 'tsi-btn--primary', 'bhp-first-go');
    var on = liveOn();
    var note = flashNode();
    TSI.append(root, el('div', { class: 'tsi-bh' }, el('div', { class: 'tsi-bhp-card', 'data-test': 'bhp-screen-snap' }, [
      el('h1', { text: 'Hello, ' + pairing.name }),
      note,
      el('p', { text: on
        ? 'Your phone is linked. Your DM\'s Bastion sends your beasts here by itself whenever it is open.'
        : 'Your phone is linked. Now your DM sends you a snapshot code, which shows your beasts as the Bastion sees them today. Open Offline backup below and paste it there.' }),
      liveRow(),
      backupBox('Offline backup: paste a snapshot code', [input.node, problem, el('div', { class: 'tsi-bhp-row' }, go)]),
      el('div', { class: 'tsi-bhp-row' }, btn('Unlink this phone', onUnlink, 'tsi-btn--ghost', 'bhp-unlink'))
    ])));
    if (notice) { var d = root.querySelector('[data-test="bhp-backup"]'); if (d) d.open = true; }
  }

  function refreshAll() { if (view) view.refresh(); }

  function start() {
    TSI.clear(root);
    view = null;
    if (!pairing) { live.stop(); liveFor = ''; return screenLink(); }
    if (liveFor !== pairing.secret) { liveFor = pairing.secret; live.start(); }
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
  var liveFor = '';
  function tickAges() {
    if (!view) return;
    var line = root.querySelector('[data-test="bh-sync"] span:last-child');
    if (line) line.textContent = host.syncLine();
    paintLive();
  }

  /* When the page is already showing the player's beasts there is no first-run screen to put a message on, so a message
     that is still waiting (that the phone was linked, or why a link didn't work) comes up in a small pop-up. */
  function announce() {
    if (!flash || !view) return;
    var f = flash;
    flash = null;
    TSI.modal.alert({ title: f.bad ? 'That link didn\'t work' : 'Your phone', message: f.text });
  }

  /* A link, however it arrived: take it in (asking first if it would swap this phone's link), then show the right screen. */
  function handleLink(d) {
    if (d && d.ok) return adoptPairing(d.pairing).then(function () { start(); announce(); });
    if (d) flash = { text: pairing ? d.why + ' This phone is still linked to ' + pairing.name + '\'s beasts.' : d.why, bad: true };
    start();
    announce();
    return Promise.resolve();
  }

  /* Open: a link in the address (from a QR code) is read and wiped first, then the right screen is shown. */
  var opened = readHash();
  if (opened) handleLink(opened); else start();
  /* A link opened while this page is already showing (the browser may swap just the # part and not load the page again). */
  life.on(window, 'hashchange', function () {
    var d = readHash();
    if (d) handleLink(d);
  });
}());
