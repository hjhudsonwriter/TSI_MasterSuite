/* Scarlett Isles: Beast Handler — the player's phone (BH-3a, the offline code swap).

   beasthandler.html loads this with only the companion's own files. There is no
   internet and no server between this phone and the DM's Bastion, so they swap
   short pieces of text (pasted, or sent as a small file), each signed with a
   secret only that handler and the DM's Bastion know (codes.js):

   1. The DM gives a PAIRING code once. Pasting it links this phone to one handler.
   2. The DM sends a SNAPSHOT code: what this handler can see. Pasting it shows the beasts.
   3. A change the player makes becomes a REQUEST code to send back to the DM, who
      pastes it into the Bastion. The Bastion checks it again, does it once, and
      the answer comes back in the next snapshot.
   Nothing here ever changes the Bastion: it only asks. What is kept on this phone
   (the link, the latest snapshot and the requests not yet answered) is in this
   browser only, under keys starting "tsi.beasthandler.phone". */
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
  var KEY = { pairing: 'tsi.beasthandler.phone.pairing', snapshot: 'tsi.beasthandler.phone.snapshot', outbox: 'tsi.beasthandler.phone.outbox' };
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
  var outbox = Array.isArray(read(KEY.outbox)) ? read(KEY.outbox).filter(function (o) { return o && typeof o.id === 'string' && typeof o.code === 'string'; }) : [];
  var view = null;
  var viewRoot = null;

  function snapshot() { return held && held.snapshot ? held.snapshot : null; }
  function saveOutbox() { write(KEY.outbox, outbox); }
  /* What a waiting request asked for. A request kept by an earlier version of this page has no copy of it, but its code holds the whole request. */
  function payloadOf(o) {
    if (o.payload && typeof o.payload === 'object') return o.payload;
    var peek = C.peekCommand(o.code);
    return peek.ok && peek.command && peek.command.payload && typeof peek.command.payload === 'object' ? peek.command.payload : undefined;
  }
  /* Requests the Bastion has answered leave the list when a snapshot shows their receipt. */
  function prune() {
    var s = snapshot();
    if (!s) return;
    var answered = {};
    (Array.isArray(s.receipts) ? s.receipts : []).forEach(function (r) { if (r && typeof r.id === 'string') answered[r.id] = true; });
    var keep = outbox.filter(function (o) { return !answered[o.id] && Date.now() - o.at < C.MAX_AGE_MS; });
    if (keep.length !== outbox.length) { outbox = keep; saveOutbox(); }
  }
  prune();

  /* ---------- Small pieces ---------- */
  function btn(label, onclick, cls, test, attrs) {
    return el('button', Object.assign({ type: 'button', class: 'tsi-btn ' + (cls || ''), 'data-test': test || null, onclick: onclick }, attrs || {}), label);
  }
  function copy(text, button) {
    function ok() { if (!button) return; var was = button.textContent; button.textContent = 'Copied ✓'; life.setTimeout(function () { button.textContent = was; }, 1600); }
    function fallback() {
      var ta = el('textarea', { style: 'position:fixed;opacity:0;left:-999px', 'aria-hidden': 'true' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var copied = false;
      try { copied = document.execCommand('copy'); } catch (e) { /* the code is on screen to copy by hand */ }
      ta.remove();
      if (copied) ok();
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function ago(ms) {
    var m = Math.floor(Math.max(0, Date.now() - ms) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.floor(m / 60);
    if (h < 48) return h + (h === 1 ? ' hour ago' : ' hours ago');
    return Math.floor(h / 24) + ' days ago';
  }
  function showCode(title, intro, code, filename, test) {
    var box = el('textarea', { class: 'tsi-input tsi-bhp-code', readonly: 'readonly', 'aria-label': title + ' (the code to copy)', 'data-test': test, onfocus: function () { box.select(); } });
    box.value = code;
    var copyBtn = btn('Copy', function () { copy(code, copyBtn); }, '', test + '-copy');
    return TSI.modal.open({
      title: title,
      body: el('div', null, [
        el('p', { text: intro }), box,
        el('div', { class: 'tsi-bhp-row' }, [copyBtn, btn('Save as a file', function () { TSI.download(filename, code, 'text/plain'); }, '', test + '-save')])
      ]),
      actions: [{ label: 'Done', value: true, primary: true }],
      onOpen: function (parts) { parts.dialog.setAttribute('data-test', test + '-dialog'); }
    });
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
    prune();
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
      var waiting = outbox.length;
      return 'Snapshot of ' + s.asOfLabel + ', got ' + ago(held.at) + (old ? '. It is more than a day old: ask the DM for a new one' : '') + (waiting ? ' · ' + waiting + (waiting === 1 ? ' request' : ' requests') + ' to send' : '');
    },
    canSubmit: function () {
      var s = snapshot();
      if (!pairing) return 'Link this phone first.';
      if (!s) return 'Get a snapshot from the DM first.';
      if (!s.campaign || s.campaign !== pairing.campaign) return 'The DM needs to open the Bastion once and send a new snapshot before you can ask for anything.';
      return '';
    },
    outbox: function () { return outbox.map(function (o) { return { id: o.id, type: o.type, creature: o.creature, fac: o.fac, label: o.label, at: o.at, payload: payloadOf(o) }; }); },
    submit: function (body) {
      var why = host.canSubmit();
      if (why) return Promise.resolve({ ok: false, message: why });
      var s = snapshot();
      var d = s.creatures[body.creature];
      var label = !d ? '' : body.type === 'profile.set' ? d.name + ' (profile)' : d.name + ': ' + ((d.orders.available.filter(function (o) { return o.fnId === body.payload.fnId; })[0] || {}).label || body.payload.fnId);
      var cmd = { v: 1, id: 'p-' + TSI.hmac.randomId(24), campaign: pairing.campaign, handler: pairing.handler, creature: body.creature, fac: body.fac || '', type: body.type, view: body.view || '', label: label, payload: body.payload, at: Date.now() };
      var code = C.encodeCommand(cmd, pairing.secret);
      outbox.push({ id: cmd.id, type: cmd.type, creature: cmd.creature, fac: cmd.fac, label: label, at: cmd.at, code: code, payload: cmd.payload });
      saveOutbox();
      return Promise.resolve({ ok: true, id: cmd.id, code: code, label: label });
    },
    afterSubmit: function (res) {
      return showCode('Send this to the DM', 'This is your request. Send it to the DM exactly as it is (a message, an email, or save it as a file). It only asks: nothing starts until the DM\'s Bastion checks it and accepts it. Then the DM sends you a new snapshot with the answer.', res.code, 'beast-handler-request.txt', 'bhp-request');
    },
    extraHome: function () { return homeExtras(); }
  };

  /* ---------- Home extras: the snapshot, the requests to send, unlinking ---------- */
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
    return TSI.modal.confirm({ title: 'Unlink this phone', message: 'This forgets the link to your beasts, the snapshot and any requests you have not sent. You would need a new pairing code from the DM. Unlink?', okLabel: 'Unlink', cancelLabel: 'Keep it' }).then(function (go) {
      if (!go) return;
      pairing = null; held = null; outbox = [];
      write(KEY.pairing, null); write(KEY.snapshot, null); write(KEY.outbox, null);
      start();
    });
  });

  /* A request that was never sent (a lost code, a closed chat) would otherwise block new ones for up to 30 days.
     Forgetting it only clears this phone's list: if the code did reach the DM, the Bastion can still apply it. */
  var onForget = TSI.oneAtATime(function (o) {
    return TSI.modal.confirm({ title: 'Forget this request', message: 'Forget "' + o.label + '"? Only do this if you never sent it. If the DM has the code, it can still be applied, and the answer will show in your next snapshot.', okLabel: 'Forget it', cancelLabel: 'Keep it' }).then(function (go) {
      if (!go) return;
      outbox = outbox.filter(function (x) { return x.id !== o.id; });
      saveOutbox();
      refreshAll();
    });
  });

  function homeExtras() {
    var s = snapshot();
    var parts = [];
    if (outbox.length) {
      parts.push(el('section', { class: 'tsi-bh-panel', 'data-test': 'bhp-outbox' }, [
        el('h2', { class: 'tsi-bh-panel__title', text: 'Requests to send to the DM' }),
        el('p', { class: 'tsi-bh-muted', text: 'Send each code to the DM. It leaves this list once a snapshot shows the Bastion\'s answer.' }),
        el('ul', { class: 'tsi-bhp-sendlist' }, outbox.map(function (o) {
          var copyBtn = btn('Copy the code', function () { copy(o.code, copyBtn); }, '', 'bhp-copy-' + o.id);
          return el('li', { class: 'tsi-bhp-send', 'data-id': o.id }, [
            el('span', { class: 'tsi-bhp-send__label', text: o.label }),
            el('span', { class: 'tsi-bh-muted', 'data-made': String(o.at), text: 'Made ' + ago(o.at) + '.' }),
            el('div', { class: 'tsi-bhp-row' }, [copyBtn, btn('Show it', function () { showCode('Request: ' + o.label, 'Send this to the DM exactly as it is.', o.code, 'beast-handler-request.txt', 'bhp-show'); }, 'tsi-btn--ghost', 'bhp-show-' + o.id), btn('Forget it', function () { onForget(o); }, 'tsi-btn--ghost', 'bhp-forget-' + o.id)])
          ]);
        }))
      ]));
    }
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
      el('p', { text: 'This page shows your beasts at the Ironbow and lets you ask your DM for things. It needs no internet.' }),
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
    Array.prototype.forEach.call(root.querySelectorAll('[data-made]'), function (n) { n.textContent = 'Made ' + ago(Number(n.getAttribute('data-made'))) + '.'; });
  }

  start();
}());
