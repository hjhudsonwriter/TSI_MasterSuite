/* "Previously, in the Scarlett Isles…" — saving, the list and the editor (guide 4, 5 November 2026). Loaded by index.html, so the home screen,
   End session and the DM doc can all open it. The reel itself plays on the Explorer's Player View (reel.js) and is started by the Explorer
   (the {recap} cue); this file never draws on the TV and never plays a sound.

   TSI.recap.read() → Promise<state>             the saved recaps (tsi.recap.state)
   TSI.recap.put(recap) → Promise<state>         save one (by id)
   TSI.recap.makeNow() → Promise                 draft one from the table log, save it, open the editor
   TSI.recap.open() → Promise                    the list of saved recaps (the home screen's Recap button)
   TSI.recap.edit(id) → Promise                  the editor for one
   TSI.recap.probeAudio(src, cb)                 cb(durationSeconds) if the file is there, cb(null) if not */
(function () {
  'use strict';

  var TSI = window.TSI;
  var R = TSI.recapRules;
  var el = TSI.el;
  var KEY = R.KEY;

  function read() {
    return TSI.store.ready.then(function () { return TSI.store.fresh(KEY, null); }).then(function (raw) { return R.clean(raw) || R.empty(); }, function () { return R.empty(); });
  }
  function put(recap) {
    return read().then(function (s) {
      var next = R.put(s, recap);
      TSI.store.set(KEY, next);
      return next;
    });
  }
  function remove(id) {
    return read().then(function (s) { var next = R.remove(s, id); TSI.store.set(KEY, next); return next; });
  }

  /* Is there an audio file, and how long is it? A missing file calls back null. */
  function probeAudio(src, cb) {
    var done = false, a = new Audio(), timer = null;
    function finish(v) { if (done) return; done = true; clearTimeout(timer); try { a.removeAttribute('src'); a.load(); } catch (e) { /* nothing */ } cb(v); }
    a.preload = 'metadata';
    a.addEventListener('loadedmetadata', function () { finish(isFinite(a.duration) && a.duration > 0 ? a.duration : 0.01); });
    a.addEventListener('error', function () { finish(null); });
    timer = setTimeout(function () { finish(null); }, 3000);
    a.src = /^(data:|blob:|https?:)/.test(src) ? src : TSI.path(src);
  }

  function explorerDay() { try { return TSI.evidence ? TSI.evidence.day() : null; } catch (e) { return null; } }

  /* Draft a recap from the table log and the Evidence Board, and keep it. */
  function draftNow(opts) {
    return Promise.all([TSI.tablelog ? TSI.tablelog.all() : [], TSI.evidence ? TSI.evidence.read().catch(function () { return null; }) : null]).then(function (r) {
      var recap = R.draft(r[0], r[1], Object.assign({ now: new Date(), dayNow: explorerDay() }, opts || {}));
      return put(recap).then(function () { return recap; });
    });
  }

  /* ---------- Playing it: the Explorer drives the TV window, so ask the Explorer ---------- */
  function sendToExplorer(tag, say) {
    if (TSI.cueRunner && TSI.cueRunner.alive()) { TSI.cueRunner.run(tag); say(''); return; }
    var id = 'cue-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var value = { id: id, at: Date.now(), tag: tag };
    if (TSI.tabGuard && TSI.tabGuard.isOpenElsewhere('explorer')) {
      if (!TSI.handoff.write('cue', value)) { say('The browser would not pass that on to the Explorer.'); return; }
      say('Sent to the Explorer window.');
      return;
    }
    say('The Explorer is not open in any window, and it is what runs the TV window.', {
      label: 'Open the Explorer',
      onClick: function () {
        value.at = Date.now();
        TSI.handoff.write('cue', value);          /* the Explorer carries it out as it opens, once the TV window answers */
        TSI.shell.openWindow('explorer');
        say('Opening the Explorer. The recap plays on the TV as soon as its window answers.');
      }
    });
  }

  /* ---------- The editor ---------- */
  function pictureThumb(s) {
    var box = el('span', { class: 'tsi-recap-thumb', 'aria-hidden': 'true' });
    if (s.image) {
      var im = el('img', { alt: '', draggable: 'false', src: /^data:/.test(s.image) ? s.image : TSI.path(s.image) });
      im.addEventListener('error', function () { im.remove(); box.classList.add('is-missing'); });
      box.appendChild(im);
    } else {
      box.classList.add('is-' + s.kind);
      box.textContent = s.kind === 'title' ? 'Title' : s.kind === 'closing' ? 'End' : s.kind === 'clues' ? 'Board' : s.kind === 'meanwhile' ? 'Meanwhile' : '';
    }
    return box;
  }
  var KIND_LABEL = { title: 'Opening words', picture: 'Picture', clues: 'Evidence Board', meanwhile: 'Meanwhile', closing: 'Closing card' };

  function openEditor(id) {
    return read().then(function (state) {
      var recap = R.find(state, id);
      if (!recap) return TSI.modal.alert({ title: 'Recap', message: 'That recap is not saved any more.' });
      recap = JSON.parse(JSON.stringify(recap));
      var list = el('ol', { class: 'tsi-recap-slides', 'data-test': 'recap-slides' });
      var total = el('p', { class: 'tsi-recap-total', 'data-test': 'recap-total', role: 'status' });
      var narrFile = el('code', { class: 'tsi-recap-file', 'data-test': 'recap-narration-file', text: R.narrationFile(recap.id) });
      var narrState = el('span', { class: 'tsi-recap-narr-state', 'data-test': 'recap-narration-state', text: 'Checking…' });
      var msg = el('p', { class: 'tsi-recap-msg', role: 'status', 'data-test': 'recap-msg' });
      var narrSecs = null;

      function save() { put(recap); }
      function showTotal() {
        var secs = R.totalSecs(recap.slides), fit = R.fit(secs);
        total.textContent = 'Total ' + secs + ' seconds' + (narrSecs ? ' (with narration the slides stretch to ' + Math.round(narrSecs) + ' seconds)' : '') + '. ' +
          (fit === 'ok' ? 'A good length (60 to 90 seconds).' : fit === 'short' ? 'A little short (aim for 60 to 90 seconds).' : 'A little long (aim for 60 to 90 seconds).');
        total.dataset.fit = fit;
      }
      function field(label, node) { return el('label', { class: 'tsi-recap-field' }, [el('span', { class: 'tsi-recap-field__label', text: label }), node]); }

      function render() {
        TSI.clear(list);
        recap.slides.forEach(function (s, i) {
          var caption = el('input', { type: 'text', class: 'tsi-input', maxlength: '120', value: s.caption, 'aria-label': (KIND_LABEL[s.kind] || 'Slide') + ' caption', 'data-test': 'recap-caption' });
          caption.addEventListener('input', function () { s.caption = caption.value; if (s.kind === 'title') recap.title = caption.value; save(); });
          var secs = el('input', { type: 'number', class: 'tsi-input tsi-recap-secs', min: String(R.MIN_SECS), max: String(R.MAX_SECS), step: '0.5', value: String(s.secs), 'aria-label': 'Seconds on screen', 'data-test': 'recap-secs' });
          secs.addEventListener('change', function () { s.secs = R.clampSecs(secs.value); secs.value = String(s.secs); save(); showTotal(); });
          var kids = [el('div', { class: 'tsi-recap-row__top' }, [
            pictureThumb(s),
            el('div', { class: 'tsi-recap-row__main' }, [el('span', { class: 'tsi-recap-kind', text: KIND_LABEL[s.kind] || s.kind }), caption]),
            field('Seconds', secs)
          ])];
          if (s.kind === 'clues' || s.kind === 'meanwhile') {
            var lines = el('textarea', { class: 'tsi-input tsi-recap-lines', rows: String(Math.max(2, Math.min(6, s.lines.length))), 'aria-label': 'One line for each', 'data-test': 'recap-lines' });
            lines.value = s.lines.join('\n');
            lines.addEventListener('input', function () { s.lines = lines.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 10); save(); });
            kids.push(field('One line each', lines));
          }
          var fixed = s.kind === 'title' || s.kind === 'closing';
          var tools = el('div', { class: 'tsi-recap-row__tools' }, [
            el('button', { type: 'button', class: 'tsi-btn tsi-btn--small tsi-btn--ghost', 'data-test': 'recap-up', 'aria-label': 'Move earlier', disabled: fixed || i <= 1, onclick: function () { recap.slides = R.moveSlide(recap.slides, i, -1); save(); render(); } }, '↑'),
            el('button', { type: 'button', class: 'tsi-btn tsi-btn--small tsi-btn--ghost', 'data-test': 'recap-down', 'aria-label': 'Move later', disabled: fixed || i >= recap.slides.length - 2, onclick: function () { recap.slides = R.moveSlide(recap.slides, i, 1); save(); render(); } }, '↓'),
            fixed ? null : el('button', { type: 'button', class: 'tsi-btn tsi-btn--small tsi-btn--ghost', 'data-test': 'recap-remove', onclick: function () { recap.slides = R.removeSlide(recap.slides, i); save(); render(); } }, 'Remove')
          ]);
          kids.push(tools);
          list.appendChild(el('li', { class: 'tsi-recap-row tsi-recap-row--' + s.kind, 'data-test': 'recap-slide', 'data-kind': s.kind }, kids));
        });
        showTotal();
      }

      function copyScript() {
        var text = R.narrationScript(recap);
        var done = function () { msg.textContent = 'Copied. Voice it in Kokoro (bm_lewis), then save the MP3 as the file name shown.'; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { msg.textContent = 'Your browser would not copy. Select the text in the box and copy it.'; scriptBox.hidden = false; });
        else { msg.textContent = 'Your browser would not copy. Select the text in the box and copy it.'; scriptBox.hidden = false; }
        scriptBox.value = text;
      }
      var scriptBox = el('textarea', { class: 'tsi-input tsi-recap-script', rows: '4', readonly: true, hidden: true, 'aria-label': 'The narration script', 'data-test': 'recap-script' });
      scriptBox.value = R.narrationScript(recap);

      var playBtn = el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary', 'data-test': 'recap-play' }, 'Play on the TV');
      var backBtn = el('button', { type: 'button', class: 'tsi-btn', 'data-test': 'recap-back' }, 'Back to the map');
      function say(text, action) {
        TSI.clear(msg);
        msg.appendChild(el('span', { text: text }));
        if (action) msg.appendChild(el('button', { type: 'button', class: 'tsi-btn tsi-btn--small', 'data-test': 'recap-msg-action', onclick: action.onClick }, action.label));
      }
      playBtn.addEventListener('click', function () { save(); sendToExplorer('{recap: ' + recap.id + '}', say); });
      backBtn.addEventListener('click', function () { sendToExplorer('{hide}', say); });
      var copyBtn = el('button', { type: 'button', class: 'tsi-btn tsi-btn--small', 'data-test': 'recap-copy' }, 'Copy narration script');
      copyBtn.addEventListener('click', copyScript);
      var redraft = el('button', { type: 'button', class: 'tsi-btn tsi-btn--small tsi-btn--ghost', 'data-test': 'recap-redraft' }, 'Draft again from the log');
      redraft.addEventListener('click', function () {
        TSI.modal.confirm({ title: 'Draft again?', message: 'This throws away your edits to this recap and drafts it afresh from the table log.', okLabel: 'Draft again' }).then(function (yes) {
          if (!yes) return;
          Promise.all([TSI.tablelog.all(), TSI.evidence.read().catch(function () { return null; })]).then(function (r) {
            var fresh = R.draft(r[0], r[1], { now: new Date(), dayNow: explorerDay(), id: recap.id });
            recap = fresh; save(); render(); say('Drafted again.');
          });
        });
      });

      probeAudio(R.narrationFile(recap.id), function (d) {
        narrSecs = d;
        narrState.textContent = d ? 'Found: ' + Math.round(d) + ' seconds. The reel plays it from this laptop and stretches the slides to fit.' : 'Not there yet. The reel runs on the captions alone.';
        narrState.dataset.found = d ? 'yes' : 'no';
        showTotal();
      });

      var body = el('div', { class: 'tsi-recap-editor-body' }, [
        el('p', { class: 'tsi-recap-intro', text: 'Drafted from the table log: ' + (recap.sinceDay !== null && recap.toDay !== null ? 'Day ' + recap.sinceDay + ' to Day ' + recap.toDay + '. ' : '') + 'Change any caption, move or remove slides, and set how long each shows. Everything is saved as you go.' }),
        el('div', { class: 'tsi-recap-btnrow tsi-recap-playrow' }, [playBtn, backBtn]),
        msg,
        list, total,
        el('div', { class: 'tsi-recap-narration' }, [
          el('h3', { class: 'tsi-recap-h', text: 'Narration (optional)' }),
          el('p', { text: 'Copy the script, voice it in Kokoro with Lewis (bm_lewis), and save the MP3 as:' }),
          el('p', null, narrFile),
          el('p', null, narrState),
          el('div', { class: 'tsi-recap-btnrow' }, [copyBtn, redraft]),
          scriptBox
        ]),
      ]);
      render();
      return TSI.modal.open({ title: 'Recap: ' + recap.title, className: 'tsi-recap-editor', body: body, actions: [{ label: 'Close', value: true }], escValue: true });
    });
  }

  /* ---------- The list (the home screen's Recap button) ---------- */
  function openList() {
    return read().then(function (state) {
      var closeIt = null, choice = null;
      var host = el('div', { class: 'tsi-recap-list', 'data-test': 'recap-list' });
      function pick(v) { choice = v; if (closeIt) closeIt(v); }
      var make = el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary', 'data-test': 'recap-make', onclick: function () { pick('make'); } }, 'Make a new recap from the table log');
      host.appendChild(el('p', { text: 'A recap of last session for the TV: your key pictures, the notes pinned to the Evidence Board, and a “Meanwhile…” slide. It plays on the Explorer’s Player View.' }));
      host.appendChild(make);
      var recaps = state.recaps.slice().reverse();
      if (!recaps.length) host.appendChild(el('p', { class: 'tsi-recap-none', 'data-test': 'recap-none', text: 'No recap has been made yet.' }));
      recaps.forEach(function (r) {
        host.appendChild(el('div', { class: 'tsi-recap-item', 'data-test': 'recap-item', 'data-id': r.id }, [
          el('div', { class: 'tsi-recap-item__main' }, [el('strong', { text: r.title }), el('span', { class: 'tsi-recap-item__meta', text: TSI.dates && TSI.dates.human ? TSI.dates.human(new Date(r.made)) + ' • ' + r.slides.length + ' slides • ' + R.totalSecs(r.slides) + ' seconds' : r.made })]),
          el('button', { type: 'button', class: 'tsi-btn tsi-btn--small', 'data-test': 'recap-edit', onclick: function () { pick('edit:' + r.id); } }, 'Edit'),
          el('button', { type: 'button', class: 'tsi-btn tsi-btn--small tsi-btn--ghost', 'data-test': 'recap-delete', onclick: function () { pick('delete:' + r.id); } }, 'Delete')
        ]));
      });
      return TSI.modal.open({
        title: 'Recap', className: 'tsi-recap-listdialog', body: host, actions: [{ label: 'Close', value: 'close' }], escValue: 'close',
        onOpen: function (o) { closeIt = o.close; }
      }).then(function (v) {
        v = choice || v;
        if (v === 'make') return makeNow();
        if (typeof v === 'string' && v.indexOf('edit:') === 0) return openEditor(v.slice(5));
        if (typeof v === 'string' && v.indexOf('delete:') === 0) {
          return TSI.modal.confirm({ title: 'Delete this recap?', message: 'It is removed from the list. The pictures and the narration file are not touched.', okLabel: 'Delete' })
            .then(function (yes) { return yes ? remove(v.slice(7)).then(openList) : openList(); });
        }
        return null;
      });
    });
  }

  function makeNow() {
    return draftNow().then(function (recap) { return openEditor(recap.id); });
  }

  TSI.recap = { KEY: KEY, read: read, put: put, remove: remove, makeNow: makeNow, open: openList, edit: openEditor, probeAudio: probeAudio, draftNow: draftNow };
}());
