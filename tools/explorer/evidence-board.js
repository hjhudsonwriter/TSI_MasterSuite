/* Scarlett Isles Explorer — the Evidence Board, on the players' window (guide 2, 4 November 2026).
   A wall of notes pinned to a dark oak board, opened by a button in the players' top row beside the map icon. The players (or the
   DM, with a mouse on the TV) can add a note, change its words, drag it, take it down (asking first) and tie two notes with red
   string. This window never saves anything: every change is sent to the DM's Explorer window as a message ({ op: ... }), which
   applies it to the latest saved board and sends the new picture back (so it is the board's own save, and nothing else, that
   the players' window can change; docs/PLAYER-VIEW-PLAN.md). The board never suggests anything.
   ns.evidenceBoard.create({ api, host, button, reducedMotion }) → { update(snapshot), isOpen(), open(), close() } */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ns = TSI.explorer = TSI.explorer || {};
  var MAX_TEXT = 200;
  var PIC_MAX = 800;
  var NOTE_W = 15.5, NOTE_H = 19;

  ns.evidenceBoard = {
    create: function (o) {
      var el = TSI.el, api = o.api, host = o.host, button = o.button;
      var reduced = o.reducedMotion || function () { return false; };
      var snap = { title: 'The Tides That Remember', notes: [], strings: [] };
      var firstDraw = true;
      var known = {};            /* the notes drawn so far, so a new one can drop in */
      var selected = '';         /* a note's id */
      var selString = '';        /* a string's id */
      var tying = '';            /* the note a string is being tied from, while waiting for the second */
      var dragging = null;
      var form = null;           /* the add / edit form while it is open */
      var asking = '';           /* the note being asked about: "Take this note down?" */
      var openNow = false;

      var title = el('h2', { class: 'tsi-xpv-ev__title', 'data-test': 'pv-ev-title' });
      var closeBtn = el('button', { type: 'button', class: 'tsi-xpv-ev__close', 'data-test': 'pv-ev-close', 'aria-label': 'Close the board', title: 'Close the board (Esc)' }, '×');
      var addBtn = el('button', { type: 'button', class: 'tsi-xpv-ev__btn', 'data-test': 'pv-ev-add' }, 'Add a note');
      var editBtn = el('button', { type: 'button', class: 'tsi-xpv-ev__btn', 'data-test': 'pv-ev-edit' }, 'Edit');
      var tieBtn = el('button', { type: 'button', class: 'tsi-xpv-ev__btn', 'data-test': 'pv-ev-tie' }, 'Tie to…');
      var untieBtn = el('button', { type: 'button', class: 'tsi-xpv-ev__btn', 'data-test': 'pv-ev-untie' }, 'Untie');
      var removeBtn = el('button', { type: 'button', class: 'tsi-xpv-ev__btn', 'data-test': 'pv-ev-remove' }, 'Remove');
      var status = el('span', { class: 'tsi-xpv-ev__status', role: 'status', 'data-test': 'pv-ev-status' });
      var bar = el('div', { class: 'tsi-xpv-ev__bar', 'data-test': 'pv-ev-bar' }, [addBtn, editBtn, tieBtn, untieBtn, removeBtn, status]);
      var NS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'tsi-xpv-ev__strings');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      var notesLayer = el('div', { class: 'tsi-xpv-ev__notes' });
      var empty = el('p', { class: 'tsi-xpv-ev__empty', text: 'Nothing is pinned up yet.', 'data-test': 'pv-ev-empty' });
      var surface = el('div', { class: 'tsi-xpv-ev__surface', 'data-test': 'pv-ev-board' }, [svg, notesLayer, empty]);
      var area = el('div', { class: 'tsi-xpv-ev__area' }, surface);
      var panel = el('div', { class: 'tsi-xpv-ev', role: 'dialog', 'aria-label': 'The Evidence Board' }, [
        el('div', { class: 'tsi-xpv-ev__head' }, [title, closeBtn]), area, bar
      ]);
      host.appendChild(panel);

      function send(op, extra) { api.send('evidence', Object.assign({ op: op }, extra || {})); }
      function noteById(id) { for (var i = 0; i < snap.notes.length; i++) if (snap.notes[i].id === id) return snap.notes[i]; return null; }
      function say(text) { status.textContent = text || ''; }

      /* The board keeps the 16:9 of the TV, as big as the room allows, so a note's place (a percentage) is the same wherever it is shown. */
      function fit() {
        var W = area.clientWidth || 1, H = area.clientHeight || 1;
        var w = Math.min(W, H * 16 / 9), h = w * 9 / 16;
        surface.style.width = w + 'px';
        surface.style.height = h + 'px';
        surface.style.fontSize = (w / 100) + 'px';       /* 1em is 1% of the board's width */
      }
      window.addEventListener('resize', fit);

      function noteNode(n) {
        var head = TSI.explorerEvidenceHeading(n.text), body = TSI.explorerEvidenceBody(n.text);
        var kids = [el('span', { class: 'tsi-xpv-ev__pin', 'aria-hidden': 'true' })];
        if (n.image) kids.push(el('img', { class: 'tsi-xpv-ev__pic', alt: '', draggable: 'false', src: n.image.indexOf('data:') === 0 ? n.image : TSI.path(n.image) }));
        kids.push(el('strong', { class: 'tsi-xpv-ev__head1', text: head }));
        if (body) kids.push(el('span', { class: 'tsi-xpv-ev__body', text: body }));
        var node = el('div', {
          class: 'tsi-xpv-ev__note', tabindex: '0', role: 'button', 'data-id': n.id, 'data-test': 'pv-ev-note',
          'aria-label': 'Note: ' + head, style: 'left:' + n.x + '%;top:' + n.y + '%;--tilt:' + n.tilt + 'deg;width:' + NOTE_W + '%'
        }, kids);
        return node;
      }

      function pinPoint(n) { return { x: n.x, y: n.y - NOTE_H / 2 + 2.2 }; }
      function drawStrings() {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        snap.strings.forEach(function (s) {
          var a = noteById(s.a), b = noteById(s.b);
          if (!a || !b) return;
          var pa = pinPoint(a), pb = pinPoint(b);
          [['tsi-xpv-ev__hit', 'pv-ev-string-hit'], ['tsi-xpv-ev__line' + (selString === s.id ? ' is-selected' : ''), 'pv-ev-string']].forEach(function (c) {
            var line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', pa.x); line.setAttribute('y1', pa.y); line.setAttribute('x2', pb.x); line.setAttribute('y2', pb.y);
            line.setAttribute('class', c[0]);
            line.setAttribute('data-test', c[1]);
            line.setAttribute('data-id', s.id);
            line.setAttribute('vector-effect', 'non-scaling-stroke');
            svg.appendChild(line);
          });
        });
      }

      function draw() {
        if (dragging) return;
        title.textContent = snap.title;
        var seen = {};
        TSI.clear(notesLayer);
        snap.notes.forEach(function (n) {
          seen[n.id] = 1;
          var node = noteNode(n);
          if (!firstDraw && !known[n.id] && !reduced()) node.classList.add('is-new');
          if (selected === n.id) node.classList.add('is-selected');
          if (tying === n.id) node.classList.add('is-tying');
          notesLayer.appendChild(node);
        });
        known = seen;
        firstDraw = false;
        if (selected && !seen[selected]) selected = '';
        if (tying && !seen[tying]) tying = '';
        drawStrings();
        empty.hidden = snap.notes.length > 0;
        buttons();
      }

      function buttons() {
        var has = !!selected;
        editBtn.disabled = !has; tieBtn.disabled = !has && !tying; removeBtn.disabled = !has;
        untieBtn.hidden = !selString;
        tieBtn.textContent = tying ? 'Cancel tying' : 'Tie to…';
        if (tying) say('Now click the note to tie it to.');
        else if (selString) say('A string is selected.');
        else if (!form && !asking) say('');
      }

      /* ---------- Choosing, dragging ---------- */
      function select(id) {
        selected = id; selString = '';
        Array.prototype.forEach.call(notesLayer.children, function (n) { n.classList.toggle('is-selected', n.getAttribute('data-id') === id); });
        drawStrings();
        buttons();
      }
      function noteFrom(target) { return target && target.closest ? target.closest('.tsi-xpv-ev__note') : null; }

      surface.addEventListener('pointerdown', function (e) {
        if (form) return;
        var nodeEl = noteFrom(e.target);
        if (!nodeEl) {
          var line = e.target && e.target.getAttribute && e.target.getAttribute('data-test') === 'pv-ev-string-hit' ? e.target : null;
          if (line) { selString = line.getAttribute('data-id'); selected = ''; tying = ''; Array.prototype.forEach.call(notesLayer.children, function (n) { n.classList.remove('is-selected', 'is-tying'); }); drawStrings(); buttons(); return; }
          selected = ''; selString = ''; tying = ''; draw(); return;
        }
        var id = nodeEl.getAttribute('data-id');
        if (tying && tying !== id) { send('tie', { a: tying, b: id }); tying = ''; select(id); say('Tied.'); return; }
        select(id);
        var n = noteById(id);
        if (!n) return;
        var r = surface.getBoundingClientRect();
        dragging = { id: id, el: nodeEl, sx: e.clientX, sy: e.clientY, x0: n.x, y0: n.y, rw: r.width, rh: r.height, moved: false, pid: e.pointerId };
        try { nodeEl.setPointerCapture(e.pointerId); } catch (x) { /* it still works while the pointer stays over it */ }
      });
      surface.addEventListener('pointermove', function (e) {
        if (!dragging || e.pointerId !== dragging.pid) return;
        var dx = e.clientX - dragging.sx, dy = e.clientY - dragging.sy;
        if (!dragging.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
        dragging.moved = true;
        var x = Math.max(3, Math.min(97, dragging.x0 + dx / dragging.rw * 100)), y = Math.max(3, Math.min(97, dragging.y0 + dy / dragging.rh * 100));
        dragging.x = x; dragging.y = y;
        dragging.el.style.left = x + '%'; dragging.el.style.top = y + '%';
        var n = noteById(dragging.id);
        if (n) { n.x = x; n.y = y; drawStrings(); }
      });
      function endDrag(e) {
        if (!dragging || (e && e.pointerId !== dragging.pid)) return;
        var d = dragging;
        dragging = null;
        if (d.moved) send('move', { id: d.id, x: Math.round(d.x * 10) / 10, y: Math.round(d.y * 10) / 10 });
      }
      surface.addEventListener('pointerup', endDrag);
      surface.addEventListener('pointercancel', endDrag);
      surface.addEventListener('dblclick', function (e) {
        var nodeEl = noteFrom(e.target);
        if (nodeEl) { select(nodeEl.getAttribute('data-id')); openForm(nodeEl.getAttribute('data-id')); }
      });
      surface.addEventListener('keydown', function (e) {
        var nodeEl = noteFrom(e.target);
        if (!nodeEl || form) return;
        var id = nodeEl.getAttribute('data-id'), n = noteById(id);
        if (!n) return;
        if (e.key === 'Enter') { e.preventDefault(); select(id); if (tying && tying !== id) { send('tie', { a: tying, b: id }); tying = ''; } else openForm(id); return; }
        var by = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (by) {
          e.preventDefault();
          n.x = Math.max(3, Math.min(97, n.x + by[0] * (e.shiftKey ? 4 : 1))); n.y = Math.max(3, Math.min(97, n.y + by[1] * (e.shiftKey ? 4 : 1)));
          nodeEl.style.left = n.x + '%'; nodeEl.style.top = n.y + '%'; drawStrings();
          clearTimeout(surface._mv);
          surface._mv = setTimeout(function () { send('move', { id: id, x: n.x, y: n.y }); }, 350);
        }
      });

      /* ---------- Add and edit ---------- */
      function readPicture(file, done) {
        var fr = new FileReader();
        fr.onload = function () {
          var im = new Image();
          im.onload = function () {
            var k = Math.min(1, PIC_MAX / Math.max(im.naturalWidth, im.naturalHeight));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            var url = '';
            try { url = c.toDataURL('image/jpeg', 0.82); } catch (e) { url = ''; }
            done(url);
          };
          im.onerror = function () { done(''); };
          im.src = fr.result;
        };
        fr.onerror = function () { done(''); };
        fr.readAsDataURL(file);
      }
      function closeForm() { if (form) { form.node.remove(); form = null; } say(''); buttons(); }
      function openForm(id) {
        closeForm();
        var n = id ? noteById(id) : null;
        var ta = el('textarea', { class: 'tsi-xpv-ev__text', maxlength: String(MAX_TEXT), rows: '5', 'aria-label': n ? 'The note’s words' : 'The new note’s words', 'data-test': 'pv-ev-text', placeholder: 'The first line is the heading.' });
        ta.value = n ? n.text : '';
        var count = el('span', { class: 'tsi-xpv-ev__count', 'data-test': 'pv-ev-count' });
        var picName = el('span', { class: 'tsi-xpv-ev__picname' });
        var pic = n ? n.image : '';
        var file = el('input', { type: 'file', accept: 'image/*', hidden: true, 'data-test': 'pv-ev-file' });
        var picBtn = el('button', { type: 'button', class: 'tsi-xpv-ev__btn tsi-xpv-ev__btn--small', 'data-test': 'pv-ev-picture' }, 'Add a picture…');
        var picOff = el('button', { type: 'button', class: 'tsi-xpv-ev__btn tsi-xpv-ev__btn--small', 'data-test': 'pv-ev-picture-off', hidden: !pic }, 'No picture');
        function showPic() { picName.textContent = pic ? 'A picture is on this note.' : ''; picOff.hidden = !pic; }
        picBtn.addEventListener('click', function () { file.click(); });
        picOff.addEventListener('click', function () { pic = ''; showPic(); });
        file.addEventListener('change', function () {
          var f = file.files && file.files[0];
          if (!f) return;
          picName.textContent = 'Reading the picture…';
          readPicture(f, function (url) { pic = url; picName.textContent = url ? '' : 'That picture could not be read.'; showPic(); });
        });
        function upd() { count.textContent = ta.value.length + ' of ' + MAX_TEXT; }
        ta.addEventListener('input', upd);
        var ok = el('button', { type: 'button', class: 'tsi-xpv-ev__btn tsi-xpv-ev__btn--primary', 'data-test': 'pv-ev-save' }, n ? 'Save' : 'Pin it');
        var cancel = el('button', { type: 'button', class: 'tsi-xpv-ev__btn', 'data-test': 'pv-ev-cancel' }, 'Cancel');
        ok.addEventListener('click', function () {
          var text = ta.value.trim();
          if (!text) { say('Write something first.'); ta.focus(); return; }
          if (n) send('edit', { id: n.id, text: text, image: pic });
          else send('add', { text: text, image: pic });
          closeForm();
        });
        cancel.addEventListener('click', closeForm);
        ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ok.click(); } });
        var node = el('div', { class: 'tsi-xpv-ev__form', role: 'group', 'aria-label': n ? 'Change this note' : 'Add a note', 'data-test': 'pv-ev-form' }, [
          el('div', { class: 'tsi-xpv-ev__paper' }, [ta, el('div', { class: 'tsi-xpv-ev__formrow' }, [count, picName]), el('div', { class: 'tsi-xpv-ev__formrow' }, [picBtn, picOff, file])]),
          el('div', { class: 'tsi-xpv-ev__formrow tsi-xpv-ev__formrow--end' }, [cancel, ok])
        ]);
        panel.appendChild(node);
        form = { node: node, ta: ta };
        upd(); showPic();
        ta.focus();
      }

      /* ---------- Taking one down ---------- */
      function askRemove(id) {
        if (!id) return;
        asking = id;
        var yes = el('button', { type: 'button', class: 'tsi-xpv-ev__btn tsi-xpv-ev__btn--primary', 'data-test': 'pv-ev-remove-yes' }, 'Take it down');
        var no = el('button', { type: 'button', class: 'tsi-xpv-ev__btn', 'data-test': 'pv-ev-remove-no' }, 'Keep it');
        var node = el('div', { class: 'tsi-xpv-ev__form tsi-xpv-ev__form--ask', role: 'alertdialog', 'aria-label': 'Take this note down?', 'data-test': 'pv-ev-ask' }, [
          el('div', { class: 'tsi-xpv-ev__paper' }, el('p', { class: 'tsi-xpv-ev__q', text: 'Take this note down?' })),
          el('div', { class: 'tsi-xpv-ev__formrow tsi-xpv-ev__formrow--end' }, [no, yes])
        ]);
        function done() { node.remove(); asking = ''; form = null; buttons(); }
        yes.addEventListener('click', function () { send('remove', { id: id }); selected = ''; done(); });
        no.addEventListener('click', done);
        panel.appendChild(node);
        form = { node: node, ta: null, ask: true };
        no.focus();
      }

      addBtn.addEventListener('click', function () { openForm(''); });
      editBtn.addEventListener('click', function () { if (selected) openForm(selected); });
      removeBtn.addEventListener('click', function () { if (selected) askRemove(selected); });
      tieBtn.addEventListener('click', function () {
        if (tying) { tying = ''; draw(); say(''); return; }
        if (!selected) return;
        tying = selected;
        draw();
      });
      untieBtn.addEventListener('click', function () { if (selString) { send('untie', { id: selString }); selString = ''; buttons(); } });

      function setOpen(on) {
        openNow = !!on;
        host.hidden = !openNow;
        button.setAttribute('aria-expanded', openNow ? 'true' : 'false');
        if (openNow) { fit(); draw(); window.requestAnimationFrame(fit); closeBtn.focus({ preventScroll: true }); }
        else { closeForm(); tying = ''; selected = ''; selString = ''; }
      }
      button.addEventListener('click', function () { setOpen(!openNow); });
      closeBtn.addEventListener('click', function () { setOpen(false); });
      window.addEventListener('keydown', function (e) {
        if (!openNow || e.key !== 'Escape') return;
        e.preventDefault();
        if (form) { closeForm(); asking = ''; return; }
        if (tying) { tying = ''; draw(); return; }
        setOpen(false);
      });

      return {
        update: function (s) {
          if (!s) return;
          snap = s;
          if (openNow) draw(); else { known = {}; snap.notes.forEach(function (n) { known[n.id] = 1; }); firstDraw = true; }
        },
        isOpen: function () { return openNow; },
        open: function () { setOpen(true); },
        close: function () { setOpen(false); }
      };
    }
  };

  /* The first line of a note is its heading (the same as shared/js/evidence-rules.js; the players' window does not load the rules). */
  TSI.explorerEvidenceHeading = function (text) { return String(text || '').split('\n')[0].trim(); };
  TSI.explorerEvidenceBody = function (text) { return String(text || '').split('\n').slice(1).join('\n').trim(); };
}());
