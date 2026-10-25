/* Scarlett Isles: Beast Handler — the DM's panel inside the Bastion (BH-2c and BH-3a; read-only app since 22 October 2026; QR and online link S17).

   A box in the Bastion's Beast Pen panel (tools/bastion/tool.js builds it with
   TSI.beasthandler.dmPanel.create(host)). It lets the DM:
   - see each handler and how many beasts they have;
   - press "Show QR to (name)": a window with a QR code the player scans with their
     phone's camera to link their phone. It makes the handler's pairing the first
     time and shows the same one every time after (nothing changes until the DM
     presses "Take back code");
   - change the "Phone page address" the QR code points at;
   - see (and, once set up, switch on) the OPTIONAL online link, which keeps phones
     up to date by themselves. It is off, and does nothing at all, until the DM sets
     it up (relay-config.js: an address and enabled: true; docs/ONLINE-LINK-SETUP.md)
     and switches it on here. Switch off stops this laptop only;
   - under "Offline backup" (shut until opened): the old copy-and-paste way, a pairing
     code and a snapshot code to send in a message, so the table never depends on
     the internet.
   The app only looks, so there is nothing to take back from a phone. The rules are in
   bastion-link.js and link-rules.js; this file is only the screen.

   host: { state(): the live Bastion save, data, done(): save and redraw, life }. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var BH = TSI.beasthandler = TSI.beasthandler || {};

  BH.dmPanel = {
    create: function (host) {
      var el = TSI.el;
      var R = TSI.bastion.rules;
      var C = BH.codes;
      var root = el('div', { class: 'tsi-bas-beast', 'data-test': 'beast-box' });
      /* The online link's sender: it sleeps (does nothing at all) unless the switch is on and relay-config.js has an address. */
      var pub = BH.publisher ? BH.publisher.create(host) : null;
      var testResults = null;     /* the latest "Test the link" answer, shown until the box is redrawn */
      var testing = false;
      var backupOpen = false;     /* the Offline backup stays open (or shut) across redraws */

      function muted(text) { return el('p', { class: 'tsi-bas-muted', text: text }); }
      function btn(text, onclick, test, cls) {
        return el('button', { type: 'button', class: 'tsi-btn tsi-btn--small ' + (cls || ''), 'data-test': test || null, onclick: onclick }, text);
      }
      function copy(text, button) {
        function ok() { if (!button) return; var was = button.textContent; button.textContent = 'Copied ✓'; host.life.setTimeout(function () { button.textContent = was; }, 1600); }
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
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
          else fallback();
        } catch (e) { fallback(); }
      }

      /* A code on screen: the text, a Copy button and a Save as file button. */
      function showCode(title, intro, code, filename, test) {
        var box = el('textarea', { class: 'tsi-input tsi-bas-beast__code', readonly: 'readonly', rows: '5', 'aria-label': title + ' (the code to copy)', 'data-test': test, onfocus: function () { box.select(); } });
        box.value = code;
        var copyBtn = btn('Copy', function () { copy(code, copyBtn); }, test + '-copy');
        var body = el('div', null, [
          el('p', { text: intro }),
          box,
          el('div', { class: 'tsi-bas-beast__row' }, [copyBtn, btn('Save as a file', function () { TSI.download(filename, code, 'text/plain'); }, test + '-save')]),
          el('p', { class: 'tsi-bas-muted', text: code.length + ' letters. Paste it, or send the file, exactly as it is.' })
        ]);
        return TSI.modal.open({ title: title, body: body, className: 'tsi-bas-modal', actions: [{ label: 'Done', value: true, primary: true }], onOpen: function (parts) { parts.dialog.setAttribute('data-test', test + '-dialog'); } });
      }

      /* ---------- The QR code ---------- */
      var onQr = TSI.oneAtATime(async function (name) {
        var made = R.beastEnsurePaired(host.state(), host.data, name);
        if (!made.ok) { await TSI.modal.alert({ title: 'Beast Handler', message: made.message }); return; }
        if (made.made) host.done();
        var res = R.beastLink(host.state(), host.data, made.handler);
        if (!res.ok) { await TSI.modal.alert({ title: 'Beast Handler', message: res.message }); return; }
        var svg = BH.qr ? BH.qr.svg(res.link, { label: 'QR code that links ' + res.name + '\'s phone' }) : null;
        if (!svg) { await TSI.modal.alert({ title: 'Beast Handler', message: 'The QR code could not be made. You can still copy the link: use the Offline backup pairing code instead.' }); return; }
        /* Plain text (a click selects all of it), not a text box: a box would take the keyboard focus when the window opens and scroll the picture out of sight on a phone-sized screen. */
        var linkBox = el('p', { class: 'tsi-bas-qr__link', 'data-test': 'beast-qr-link', text: res.link });
        var copyBtn = btn('Copy link', function () { copy(res.link, copyBtn); }, 'beast-qr-copy');
        var body = el('div', { class: 'tsi-bas-qr' }, [
          el('p', { class: 'tsi-bas-qr__caption', 'data-test': 'beast-qr-caption', text: 'Show this only to ' + res.name + '.' }),
          el('div', { class: 'tsi-bas-qr__code', 'data-test': 'beast-qr' }, svg),
          el('p', { text: res.name + ' points their phone\'s camera at it and taps the link that appears. The Beast Handler page opens and links itself.' }),
          el('p', { class: 'tsi-bas-muted', 'data-test': 'beast-qr-iphone', text: 'iPhone: scan with the phone camera and add the page to the Home Screen from the page that opens. A Home Screen icon keeps its saved link apart from Safari\'s, so on the icon\'s first screen ' + res.name + ' pastes the link (the page has a Copy my link button for that).' }),
          el('p', { class: 'tsi-bas-muted', text: 'Or send the link itself to a player who isn\'t at the table (privately):' }),
          linkBox,
          el('div', { class: 'tsi-bas-beast__row' }, copyBtn),
          el('p', { class: 'tsi-bas-muted', text: 'Anyone who sees this can read ' + res.name + '\'s beasts, so show it only to them. If it gets out, press Take back code and show a new one.' })
        ]);
        await TSI.modal.open({ title: 'QR code for ' + res.name, body: body, className: 'tsi-bas-modal tsi-bas-modal--qr', actions: [{ label: 'Done', value: true, primary: true }], onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'beast-qr-dialog'); } });
      });

      /* ---------- The offline backup (the old codes) ---------- */
      var onPair = TSI.oneAtATime(async function (name, existing) {
        var s = host.state();
        if (existing) {
          var go = await TSI.modal.confirm({ title: 'New pairing code', message: 'This makes a new code for ' + name + ' and the old one stops working. Their phone will need the new code (or a new QR code).', okLabel: 'Make a new code', cancelLabel: 'Cancel' });
          if (!go || !host.life.alive) return;
        }
        var res = R.beastPair(host.state(), host.data, name);
        if (!res.ok) { await TSI.modal.alert({ title: 'Beast Handler', message: res.message }); return; }
        host.done();
        var code = C.encodePairing(res.pairing);
        await showCode('Pairing code: ' + res.name,
          'Send this once, privately, to ' + res.name + '. It links their phone to their own beasts only. If it ever gets out, press Take back code and make a new one.', code, 'beast-handler-pairing-' + res.handler + '.txt', 'beast-pair');
      });
      var onRevoke = TSI.oneAtATime(async function (h) {
        var go = await TSI.modal.confirm({ title: 'Take back the code', message: 'Take back ' + h.name + '\'s code? Their phone stops showing new snapshots until you make a new code or show a new QR code, and a snapshot made with the old code no longer opens.', okLabel: 'Take it back', cancelLabel: 'Cancel' });
        if (!go || !host.life.alive) return;
        R.beastRevoke(host.state(), h.id);
        host.done();
      });
      var onSnapshot = TSI.oneAtATime(async function (h) {
        var res = R.beastSnapshotCode(host.state(), host.data, h.id);
        if (!res.ok) { await TSI.modal.alert({ title: 'Beast Handler', message: res.message }); return; }
        await showCode('Snapshot for ' + h.name,
          'What ' + h.name + ' can see, as of ' + res.snapshot.asOfLabel + '. Send it to their phone. Make a new one after anything changes.', res.code, 'beast-handler-snapshot-' + h.id + '.txt', 'beast-snap');
      });
      var onAdd = TSI.oneAtATime(async function () {
        var input = el('input', { type: 'text', class: 'tsi-input', maxlength: '40', placeholder: 'The handler\'s name', 'aria-label': 'The handler\'s name', 'data-test': 'beast-add-name' });
        var ok = await TSI.modal.open({
          title: 'Add a handler', className: 'tsi-bas-modal',
          body: [el('p', { text: 'A handler is a player who looks after a beast. Type the name exactly as it is on their beast\'s profile (capitals don\'t matter).' }), input],
          actions: [{ label: 'Cancel', value: false }, { label: 'Show the QR code', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'beast-add-dialog'); host.life.setTimeout(function () { input.focus(); }, 0); }
        });
        if (!ok || !host.life.alive) return;
        /* A name that is already linked just shows its QR code again: nothing is swapped, so there is nothing to ask. */
        var typed = R.beastRegistry(host.state(), host.data).filter(function (h) { return h.id === BH.projection.handlerKey(input.value); })[0];
        return onQr(typed ? typed.name : input.value);
      });

      /* ---------- The phone page's address ---------- */
      /* The box shows the address as plain text and a button opens a small window to change it. There is deliberately no
         text box in the panel itself: a pop-up gives keyboard focus to the first text box in it, which would scroll the
         Beast Pen's panel down to the bottom every time it opened. */
      var onAddress = TSI.oneAtATime(async function () {
        var value = R.beastPhoneUrl(host.state());
        for (;;) {
          var input = el('input', { type: 'url', class: 'tsi-input', maxlength: '200', 'aria-label': 'Phone page address', 'data-test': 'beast-phoneurl-input', autocomplete: 'off', spellcheck: 'false' });
          input.value = value;
          var go = await TSI.modal.open({
            title: 'Phone page address', className: 'tsi-bas-modal',
            body: [el('p', { text: 'The web address of the Beast Handler phone page. A QR code is this address plus the player\'s private link. Leave it as it is unless you put the phone page somewhere else. It must start https://' }), input],
            actions: [{ label: 'Cancel', value: false }, { label: 'Save address', value: true, primary: true }],
            onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'beast-phoneurl-dialog'); }
          });
          if (!go || !host.life.alive) return;
          value = input.value;
          var r = R.setBeastPhoneUrl(host.state(), value);
          if (r.ok) { host.done(); render(); return; }
          await TSI.modal.alert({ title: 'That address won\'t work', message: r.message });
          if (!host.life.alive) return;
        }
      });
      function addressBox(s) {
        var custom = !!(s.beast && s.beast.phoneUrl);
        return el('div', { class: 'tsi-bas-box tsi-bas-beast__box', 'data-test': 'beast-phoneurl' }, [
          el('div', { class: 'tsi-bas-label', text: 'Phone page address' }),
          muted('Where the QR code sends a player\'s phone. Leave it as it is unless you put the Beast Handler phone page somewhere else.'),
          el('p', { class: 'tsi-bas-qr__link', 'data-test': 'beast-phoneurl-value', text: R.beastPhoneUrl(s) }),
          el('div', { class: 'tsi-bas-beast__row' }, [
            btn('Change address…', onAddress, 'beast-phoneurl-change'),
            custom ? btn('Use the standard address', function () { R.setBeastPhoneUrl(host.state(), ''); host.done(); render(); }, 'beast-phoneurl-default', 'tsi-btn--ghost') : null
          ])
        ]);
      }

      /* ---------- The optional online link ---------- */
      var statusNode = null;
      function paintStatus() { if (statusNode && pub) statusNode.textContent = pub.statusLine(); }
      if (pub) pub.onStatus(paintStatus);
      var onSwitch = TSI.oneAtATime(async function (on) {
        if (on) {
          var go = await TSI.modal.confirm({
            title: 'Switch on the online link',
            message: 'This sends each linked player\'s snapshot, scrambled, to your own post box on the internet so their phone keeps itself up to date. Nothing readable is stored there. The Bastion keeps working as it does now if the internet is down. Switch it on?',
            okLabel: 'Switch on', cancelLabel: 'Cancel'
          });
          if (!go || !host.life.alive) return;
        }
        R.setBeastOnlineLink(host.state(), on);
        testResults = null;
        host.done();
        render();
        if (on && pub) pub.tick();
      });
      var onTest = TSI.oneAtATime(async function () {
        if (!pub || testing) return;
        testing = true;
        testResults = { running: true };
        render();
        var res = await pub.selfTest();
        testing = false;
        testResults = res;
        if (host.life.alive) render();
      });
      var onSendNow = TSI.oneAtATime(async function () {
        if (!pub) return;
        await pub.sendNow();
        paintStatus();
      });
      function onlineBox(s) {
        var st = pub ? pub.status() : { state: 'unset' };
        var configured = st.state !== 'unset' && st.state !== 'notenabled';
        var on = configured && st.state !== 'off';
        statusNode = el('p', { class: 'tsi-bas-beast__status', 'data-test': 'beast-online-status', role: 'status', text: BH.link.statusLine(st, Date.now()) });
        var kids = [
          el('div', { class: 'tsi-bas-label', text: 'Online link (optional)' }),
          statusNode,
          muted('Keeps players\' phones up to date by themselves, through a small private post box that you set up. Everything sent is scrambled first. It does nothing until relay-config.js has the address and says enabled: true, and you press Switch on here. Switch off stops this laptop sending; phones keep looking until enabled is set back to false in the published relay-config.js. The codes under Offline backup always still work.'),
          el('p', { class: 'tsi-bas-muted' }, el('a', { href: TSI.path('guide.html') + '#beasthandler-online', target: '_blank', rel: 'noopener', 'data-test': 'beast-online-guide', text: 'How to set it up' }))
        ];
        var row = [];
        if (configured && !on) row.push(btn('Switch on', function () { onSwitch(true); }, 'beast-online-on'));
        if (on) {
          row.push(btn('Test the link', onTest, 'beast-online-test'));
          row.push(btn('Send to phones now', onSendNow, 'beast-online-send', 'tsi-btn--ghost'));
          row.push(btn('Switch off', function () { onSwitch(false); }, 'beast-online-off', 'tsi-btn--ghost'));
        }
        if (row.length) kids.push(el('div', { class: 'tsi-bas-beast__row' }, row));
        if (testResults) {
          kids.push(testResults.running
            ? el('p', { class: 'tsi-bas-muted', role: 'status', 'data-test': 'beast-online-testing', text: 'Testing…' })
            : el('ul', { class: 'tsi-bas-beast__checks', role: 'status', 'data-test': 'beast-online-checks' }, testResults.checks.map(function (c) {
              return el('li', { class: c.ok ? 'tsi-bas-beast__check tsi-bas-beast__check--ok' : 'tsi-bas-beast__check tsi-bas-beast__check--bad', 'data-test': 'beast-online-check-' + c.id, text: (c.ok ? '✓ ' : '✗ ') + c.text });
            })));
        }
        return el('div', { class: 'tsi-bas-box tsi-bas-beast__box', 'data-test': 'beast-online' }, kids);
      }

      function render() {
        var s = host.state();
        TSI.clear(root);
        var regs = R.beastRegistry(s, host.data);
        var list = el('div', { class: 'tsi-bas-list', 'data-test': 'beast-handlers' }, regs.length ? regs.map(function (h) {
          return el('div', { class: 'tsi-bas-item', 'data-test': 'beast-handler-' + h.id }, [
            el('div', { class: 'tsi-bas-item__text' }, [
              el('div', { class: 'tsi-bas-item__name', text: h.name }),
              el('div', { class: 'tsi-bas-item__type', text: (h.count === 1 ? '1 beast' : h.count + ' beasts') + ' · ' + (h.paired ? 'phone linked' : 'no phone linked') })
            ]),
            btn('Show QR to ' + h.name, function () { onQr(h.name); }, 'beast-qr-' + h.id),
            h.paired ? btn('Take back code', function () { onRevoke(h); }, 'beast-revoke-' + h.id, 'tsi-btn--ghost') : null
          ]);
        }) : [muted('No handler yet. Give a beast a handler in the Beast Pen\'s panel, or add one here.')]);
        var backup = el('details', { class: 'tsi-bas-beast__backup', 'data-test': 'beast-backup', open: backupOpen ? true : null, ontoggle: function () { backupOpen = backup.open; } }, [
          el('summary', { class: 'tsi-bas-beast__backup-summary', 'data-test': 'beast-backup-toggle', text: 'Offline backup: codes to copy and paste' }),
          el('div', { class: 'tsi-bas-beast__backup-body' }, [
            muted('For a table with no Wi-Fi, or a phone that can\'t scan. Send the player a pairing code once (privately), then a snapshot code whenever you want them to see something new. They paste each into their phone page under Offline backup.'),
            el('div', { class: 'tsi-bas-list', 'data-test': 'beast-backup-list' }, regs.length ? regs.map(function (h) {
              return el('div', { class: 'tsi-bas-item', 'data-test': 'beast-backup-' + h.id }, [
                el('div', { class: 'tsi-bas-item__text' }, el('div', { class: 'tsi-bas-item__name', text: h.name })),
                btn(h.paired ? 'New pairing code…' : 'Pairing code…', function () { onPair(h.name, h.paired); }, 'beast-pair-' + h.id),
                h.paired ? btn('Snapshot code…', function () { onSnapshot(h); }, 'beast-snap-' + h.id) : null
              ]);
            }) : [muted('No handler yet.')])
          ])
        ]);
        TSI.append(root, [
          el('p', { class: 'tsi-bas-muted', text: 'A player\'s Beast Handler shows their beasts: the bond, the profile and the Chronicle. It only looks: the player can\'t change or ask for anything, and nothing a player does costs gold. A beast shows there once it has passed acclimatisation (Bond 1). To link a player\'s phone, press Show QR and let them scan it.' }),
          list,
          el('div', { class: 'tsi-bas-beast__row' }, btn('Add a handler…', onAdd, 'beast-add')),
          addressBox(s),
          onlineBox(s),
          backup
        ]);
      }
      return { node: root, render: render, publisher: pub };
    }
  };
}());
