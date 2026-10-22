/* Scarlett Isles: Beast Handler — the DM's panel inside the Bastion (BH-2c and BH-3a; read-only app since 22 October 2026).

   A box in the Bastion's Management panel (tools/bastion/tool.js builds it with
   TSI.beasthandler.dmPanel.create(host)). It lets the DM:
   - see each handler and how many beasts they have;
   - make (or take back) a handler's PAIRING CODE, which links their phone;
   - make a SNAPSHOT CODE: what that handler can see, to send to their phone.
   The app only looks, so there is nothing to take back from a phone: no request
   codes, no switch for requests and no list of requests any more. The rules are in
   bastion-link.js; this file is only the screen.

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

      var onPair = TSI.oneAtATime(async function (name, existing) {
        var s = host.state();
        if (existing) {
          var go = await TSI.modal.confirm({ title: 'New pairing code', message: 'This makes a new code for ' + name + ' and the old one stops working. Their phone will need the new code.', okLabel: 'Make a new code', cancelLabel: 'Cancel' });
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
        var go = await TSI.modal.confirm({ title: 'Take back the code', message: 'Take back ' + h.name + '\'s code? Their phone stops showing new snapshots until you make a new code, and a snapshot made with the old code no longer opens.', okLabel: 'Take it back', cancelLabel: 'Cancel' });
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
          actions: [{ label: 'Cancel', value: false }, { label: 'Make a pairing code', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'beast-add-dialog'); host.life.setTimeout(function () { input.focus(); }, 0); }
        });
        if (!ok || !host.life.alive) return;
        /* A name that is already paired makes a NEW code, which stops the old one: ask first, as the button does. */
        var typed = R.beastRegistry(host.state(), host.data).filter(function (h) { return h.id === BH.projection.handlerKey(input.value); })[0];
        return onPair(typed ? typed.name : input.value, !!(typed && typed.paired));
      });

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
            btn(h.paired ? 'New pairing code…' : 'Pairing code…', function () { onPair(h.name, h.paired); }, 'beast-pair-' + h.id),
            h.paired ? btn('Snapshot code…', function () { onSnapshot(h); }, 'beast-snap-' + h.id) : null,
            h.paired ? btn('Take back code', function () { onRevoke(h); }, 'beast-revoke-' + h.id, 'tsi-btn--ghost') : null
          ]);
        }) : [muted('No handler yet. Give a beast a handler in its building\'s panel, or add one here.')]);
        TSI.append(root, [
          el('p', { class: 'tsi-bas-muted', text: 'A player\'s Beast Handler shows their beasts: the bond, the profile and the Chronicle. It only looks: the player can\'t change or ask for anything, and nothing a player does costs gold. A beast shows there once it has passed acclimatisation (Bond 1).' }),
          list,
          el('div', { class: 'tsi-bas-beast__row' }, btn('Add a handler…', onAdd, 'beast-add'))
        ]);
      }
      return { node: root, render: render };
    }
  };
}());
