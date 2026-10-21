/* Scarlett Isles: Beast Handler — the DM's panel inside the Bastion (BH-2c and BH-3a).

   A box in the Bastion's Management panel (tools/bastion/tool.js builds it with
   TSI.beasthandler.dmPanel.create(host)). It lets the DM:
   - see each handler and how many beasts they have;
   - make (or take back) a handler's PAIRING CODE, which links their phone;
   - make a SNAPSHOT CODE: what that handler can see, to send to their phone;
   - paste in a REQUEST CODE from a phone, which the Bastion checks and applies once
     (the answer shows at once, with a fresh snapshot code to send back);
   - switch requests off, and see the latest requests and how each went.
   Requests from the companion on this laptop arrive by themselves and are
   listed here too. The rules are in bastion-link.js; this file is only the screen.

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
          try { document.execCommand('copy'); ok(); } catch (e) { /* the code is on screen to copy by hand */ }
          ta.remove();
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
          else fallback();
        } catch (e) { fallback(); }
      }

      /* A code on screen: the text, a Copy button and a Save as file button. */
      function showCode(title, intro, code, filename, test) {
        var box = el('textarea', { class: 'tsi-input tsi-bas-beast__code', readonly: 'readonly', rows: '5', 'data-test': test, onfocus: function () { box.select(); } });
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
        var go = await TSI.modal.confirm({ title: 'Take back the code', message: 'Take back ' + h.name + '\'s code? Their phone stops working until you make a new one, and any request signed with the old code is refused.', okLabel: 'Take it back', cancelLabel: 'Cancel' });
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
        var input = el('input', { type: 'text', class: 'tsi-input', maxlength: '40', placeholder: 'The handler\'s name', 'data-test': 'beast-add-name' });
        var ok = await TSI.modal.open({
          title: 'Add a handler', className: 'tsi-bas-modal',
          body: [el('p', { text: 'A handler is a player who looks after a beast. Type the name exactly as it is on their beast\'s profile (capitals don\'t matter).' }), input],
          actions: [{ label: 'Cancel', value: false }, { label: 'Make a pairing code', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'beast-add-dialog'); host.life.setTimeout(function () { input.focus(); }, 0); }
        });
        if (!ok || !host.life.alive) return;
        return onPair(input.value, false);
      });

      /* A request code from a phone: pasted or opened from a file. */
      var onPaste = TSI.oneAtATime(async function () {
        var area = el('textarea', { class: 'tsi-input tsi-bas-beast__code', rows: '5', placeholder: 'Paste the request code here (it starts BHC1.)', 'data-test': 'beast-paste-text' });
        var fileBtn = btn('Open a file…', function () {
          TSI.pickFile('.txt,text/plain').then(function (f) { return f ? TSI.readFileText(f) : null; }).then(function (t) { if (t !== null) area.value = t; }, function () { /* not readable: nothing changes */ });
        }, 'beast-paste-file');
        var ok = await TSI.modal.open({
          title: 'Request from a phone', className: 'tsi-bas-modal',
          body: [el('p', { text: 'The Bastion checks the request against its own save, and does it once. Pasting it again changes nothing.' }), area, el('div', { class: 'tsi-bas-beast__row' }, fileBtn)],
          actions: [{ label: 'Cancel', value: false }, { label: 'Check and apply', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'beast-paste-dialog'); host.life.setTimeout(function () { area.focus(); }, 0); }
        });
        if (!ok || !host.life.alive) return;
        var res = R.beastProcessCode(host.state(), host.data, area.value, Date.now(), Math.random);
        if (res.ok || res.receipt || res.duplicate) host.done();
        var rec = res.receipt;
        var line = res.bad || res.held ? res.why
          : res.duplicate ? 'That request had already been dealt with, so nothing changed: ' + (rec ? rec.label + ': ' + (rec.r === 'applied' ? 'accepted' : 'refused') + '. ' + rec.why : '')
          : rec ? rec.label + ': ' + (rec.r === 'applied' ? 'accepted. ' : 'refused. ') + rec.why : 'Nothing was done.';
        var peek = C.peekCommand(area.value);
        var snap = peek.ok && R.beastSecret(host.state(), peek.command.handler) ? R.beastSnapshotCode(host.state(), host.data, peek.command.handler) : null;
        if (snap && snap.ok && (res.ok || res.receipt || res.duplicate)) {
          await showCode('Result', line + ' This is a fresh snapshot to send back to their phone, so it shows the answer.', snap.code, 'beast-handler-snapshot-' + P().handlerKey(peek.command.handler) + '.txt', 'beast-result');
        } else {
          await TSI.modal.alert({ title: 'Request from a phone', message: line });
        }
      });
      function P() { return BH.projection; }

      function render() {
        var s = host.state();
        TSI.clear(root);
        var B = s.beast || { accept: true, handlers: [], done: {} };
        var accept = el('input', { type: 'checkbox', 'data-test': 'beast-accept', checked: B.accept !== false ? 'checked' : null });
        accept.checked = B.accept !== false;
        accept.addEventListener('change', function () {
          R.beastState(host.state()).accept = accept.checked;
          host.done();
        });
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
        var recent = R.beastRecent(s, 8);
        TSI.append(root, [
          el('p', { class: 'tsi-bas-muted', text: 'Players ask for things in the Beast Handler: a change to a beast\'s profile, or a free training order. The Bastion checks every request again and does each one only once. Nothing a player does costs gold.' }),
          el('label', { class: 'tsi-bas-field' }, [accept, ' Take requests from handlers']),
          list,
          el('div', { class: 'tsi-bas-beast__row' }, [
            btn('Add a handler…', onAdd, 'beast-add'),
            btn('Paste a request code…', onPaste, 'beast-paste')
          ]),
          el('h4', { class: 'tsi-bas-beast__h', text: 'Latest requests' }),
          recent.length
            ? el('ul', { class: 'tsi-bas-res-list', 'data-test': 'beast-recent' }, recent.map(function (r) {
              return el('li', { 'data-state': r.r, text: R.dayLabel(r.day) + ' · ' + r.handler + ' · ' + (r.label || 'a request') + ': ' + (r.r === 'applied' ? 'accepted' : 'refused') + (r.why ? '. ' + r.why : '') });
            }))
            : muted('None yet.')
        ]);
      }
      return { node: root, render: render };
    }
  };
}());
